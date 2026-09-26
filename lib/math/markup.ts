/**
 * Question / solution markup tokenizer.
 *
 * Question text, answer options and solution steps are authored in a tiny,
 * deliberately unambiguous markup dialect:
 *
 *   `\$`        -> a literal dollar sign (currency). Never math.
 *   `$ ... $`   -> inline math, rendered by KaTeX. Must close on the same line.
 *   `$$ ... $$` -> display math, rendered by KaTeX. May span lines.
 *   `**bold**`, `*italic*`, `` `code` `` -> lightweight emphasis.
 *
 * Every generator in `lib/engine` writes currency through `lib/engine/format`,
 * which escapes it, so authored content is always unambiguous.
 *
 * The tokenizer additionally recognises *unescaped* currency (`$160,000`) so
 * that rows already persisted in PostgreSQL by earlier versions keep rendering
 * correctly. A `$` followed by a complete number is read as currency only when
 * it cannot plausibly be opening math: either it never closes on that line, or
 * the text it would enclose reads as a sentence rather than an expression.
 * This is what keeps `the $12^{\text{th}} payment` in a sentence that also
 * contains `$160,000` typesetting as mathematics instead of leaking raw LaTeX.
 *
 * The tokenizer is pure and framework-free so it can be tested directly.
 */

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "display"; value: string };

/** `$1,250.75` — a complete currency amount anchored at the current `$`. */
const CURRENCY_AT_CURSOR = /^\$(\d[\d,]*(?:\.\d+)?)/;

/**
 * Decides whether the text between two `$` delimiters is prose that merely
 * happens to sit between a price and a real math delimiter.
 *
 * Any LaTeX control sequence settles it as math. Otherwise three or more
 * ordinary words mean prose: `160,000 is repaid with equal annual payments...`
 * is a sentence, whereas `1 - v^{n} = 3` is an expression.
 */
function looksLikeProse(body: string): boolean {
  if (body.includes("\\")) return false;
  const words = body.match(/[A-Za-z]{2,}/g);
  return (words?.length ?? 0) >= 3;
}

/** Finds the closing `$` of an inline expression, or -1 if it never closes on this line. */
function findInlineClose(source: string, from: number): number {
  for (let j = from; j < source.length; j += 1) {
    const ch = source[j];
    if (ch === "\n") return -1; // inline math never spans a line break
    if (ch === "\\") {
      j += 1; // skip the escaped character, e.g. `\$` or `\%` inside math
      continue;
    }
    if (ch === "$") return j;
  }
  return -1;
}

/**
 * Splits authored markup into literal-text and math segments.
 * Unterminated or empty delimiters degrade to literal text rather than throwing,
 * so a malformed template can never blank out a question during an exam.
 */
export function tokenizeMath(source: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer.length > 0) {
      segments.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < source.length) {
    const ch = source[i];

    // `\$` and `\%` are literal characters when they appear outside math.
    if (ch === "\\" && (source[i + 1] === "$" || source[i + 1] === "%")) {
      buffer += source[i + 1];
      i += 2;
      continue;
    }

    if (ch !== "$") {
      buffer += ch;
      i += 1;
      continue;
    }

    // Display math: $$ ... $$
    if (source[i + 1] === "$") {
      const close = source.indexOf("$$", i + 2);
      if (close !== -1) {
        flush();
        segments.push({ type: "display", value: source.slice(i + 2, close).trim() });
        i = close + 2;
        continue;
      }
      buffer += "$$";
      i += 2;
      continue;
    }

    const close = findInlineClose(source, i + 1);
    const body = close === -1 ? "" : source.slice(i + 1, close);

    // Unescaped currency from a legacy row: `$` plus a complete number that
    // either never closes on this line, or would enclose a sentence.
    const currency = CURRENCY_AT_CURSOR.exec(source.slice(i));
    if (currency && (close === -1 || looksLikeProse(body))) {
      buffer += currency[0];
      i += currency[0].length;
      continue;
    }

    // Inline math: $ ... $
    if (close === -1 || body.trim().length === 0) {
      buffer += "$";
      i += 1;
      continue;
    }

    flush();
    segments.push({ type: "inline", value: body.trim() });
    i = close + 1;
  }

  flush();
  return segments;
}

export interface Emphasis {
  strong: boolean;
  em: boolean;
  code: boolean;
}

export type MarkupNode =
  | ({ type: "text"; value: string } & Emphasis)
  | ({ type: "inline"; value: string } & Emphasis)
  | { type: "display"; value: string }
  | { type: "break" };

const EMPHASIS_DELIMITER = /(\*\*|`|\*)/;

const NO_EMPHASIS: Emphasis = { strong: false, em: false, code: false };

/**
 * Full markup parse: math segments plus emphasis and line breaks.
 *
 * Emphasis is resolved *after* math extraction and carries across math
 * segments, so `**Step 1 — solve for $y$.**` renders entirely in bold rather
 * than leaving stray asterisks around the formula. Emphasis state resets at
 * every line break, so a single unclosed `**` can only affect its own line.
 */
export function parseMarkup(source: string): MarkupNode[] {
  const nodes: MarkupNode[] = [];
  let emphasis: Emphasis = { ...NO_EMPHASIS };

  for (const segment of tokenizeMath(source)) {
    if (segment.type === "display") {
      nodes.push(segment);
      emphasis = { ...NO_EMPHASIS };
      continue;
    }

    if (segment.type === "inline") {
      nodes.push({ type: "inline", value: segment.value, ...emphasis });
      continue;
    }

    const lines = segment.value.split("\n");
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        nodes.push({ type: "break" });
        emphasis = { ...NO_EMPHASIS };
      }
      if (line.length === 0) return;

      for (const piece of line.split(EMPHASIS_DELIMITER)) {
        if (piece === "") continue;
        if (piece === "**") {
          emphasis = { ...emphasis, strong: !emphasis.strong };
        } else if (piece === "*") {
          emphasis = { ...emphasis, em: !emphasis.em };
        } else if (piece === "`") {
          emphasis = { ...emphasis, code: !emphasis.code };
        } else {
          nodes.push({ type: "text", value: piece, ...emphasis });
        }
      }
    });
  }

  return nodes;
}

/**
 * Clean up math-only number punctuation that occasionally leaks into prose in
 * older or hand-authored question text (for example, `2{,}718.80`). Apply this
 * only to plain-text nodes in the UI; actual inline/display math is left intact
 * for KaTeX to render.
 */
export function normalizePlainMathText(value: string): string {
  return value.replace(/(\d)\\?\{,\}(?=\d)/g, "$1,");
}
