/**
 * The rich answer model.
 *
 * An answer choice is one of a small set of typed contents rather than a
 * free HTML string, so every kind can be validated, compared for duplicates,
 * rendered accessibly and stored without ambiguity:
 *
 *   numeric     a money amount, percentage, plain number or time/period count
 *   text        a definition, classification, interpretation or statement
 *               (markup: prose with inline `$…$` mathematics)
 *   math        a single formula, equation of value, relationship or condition
 *               (LaTeX, typeset as display mathematics)
 *   statements  a combination of the question's numbered statements
 *               ("I and III only", "None")
 *   composite   several values answered together: an ordered pair, a
 *               portfolio allocation, or a list of cash-flow amounts
 *   table       a small table (for example, a proposed payment schedule)
 *
 * Questions stored before this model existed have options without `content`;
 * `optionContent` reads them as the numeric variant, so old sessions and
 * reports keep rendering exactly as before.
 */
import { formatAnswer } from "./format";
import type { AnswerFormat } from "./types";

export const STATEMENT_KEYS = ["I", "II", "III", "IV"] as const;
export type StatementKey = (typeof STATEMENT_KEYS)[number];

export interface CompositePart {
  /** What this component is, e.g. "Bond X" or "Macaulay duration". */
  label: string;
  value: number;
  format: AnswerFormat;
}

export type OptionContent =
  | { type: "numeric"; value: number; format: AnswerFormat }
  | { type: "text"; text: string }
  | { type: "math"; latex: string }
  | { type: "statements"; keys: StatementKey[] }
  | { type: "composite"; style: "ordered-pair" | "allocation" | "amounts"; parts: CompositePart[] }
  | { type: "table"; columns: string[]; rows: string[][] };

export type AnswerType = "numeric" | "text" | "math" | "statements" | "composite" | "table";

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  numeric: "Numerical value",
  text: "Text (definition, classification, interpretation)",
  math: "Mathematical expression or equation",
  statements: "Statement combination",
  composite: "Composite values (ordered pair or allocation)",
  table: "Table",
};

/** Numerical-calculation answers versus conceptual, symbolic, statement and composite answers. */
export const isNumericAnswer = (type: AnswerType | undefined): boolean => !type || type === "numeric";

/** Structured information presented with a question: a table or the statements I, II, III. */
export type Exhibit =
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  | { type: "statements"; items: { key: StatementKey; text: string }[] };

// ---------------------------------------------------------------- display

const joinKeys = (keys: readonly string[]): string => {
  if (keys.length === 1) return keys[0];
  if (keys.length === 2) return `${keys[0]} and ${keys[1]}`;
  return `${keys.slice(0, -1).join(", ")}, and ${keys[keys.length - 1]}`;
};

/**
 * "I only", "I and III only", "I, II, and III", "None". When every statement
 * is selected the word "only" is dropped, matching the SOA convention.
 */
export function statementsLabel(keys: readonly StatementKey[], statementCount: number): string {
  const sorted = sortStatementKeys(keys);
  if (!sorted.length) return "None";
  if (sorted.length === statementCount) return joinKeys(sorted);
  return `${joinKeys(sorted)} only`;
}

export function sortStatementKeys(keys: readonly StatementKey[]): StatementKey[] {
  return [...new Set(keys)].sort((a, b) => STATEMENT_KEYS.indexOf(a) - STATEMENT_KEYS.indexOf(b));
}

/** Strips markup to a plain, screen-reader friendly string. */
export function plainText(markup: string): string {
  return markup
    .replace(/(\d)\\?\{,\}(?=\d)/g, "$1,")
    .replace(/\$\$?([^$]*)\$\$?/g, (_, m: string) => latexToSpeech(m))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads a balanced `{…}` group starting at `from` (which must be "{"); returns its body and the index after it. */
function group(source: string, from: number): { body: string; end: number } | null {
  if (source[from] !== "{") return null;
  let depth = 0;
  for (let k = from; k < source.length; k += 1) {
    if (source[k] === "{") depth += 1;
    else if (source[k] === "}") {
      depth -= 1;
      if (depth === 0) return { body: source.slice(from + 1, k), end: k + 1 };
    }
  }
  return null;
}

/** `\frac{a}{b}` (and `\dfrac`, `\tfrac`), with any nesting, as "(a) over (b)". */
function expandFractions(latex: string): string {
  const pattern = /\\[dt]?frac\s*/g;
  let out = "";
  let last = 0;
  for (let m = pattern.exec(latex); m; m = pattern.exec(latex)) {
    const num = group(latex, m.index + m[0].length);
    const den = num ? group(latex, num.end) : null;
    if (!num || !den) continue;
    out += latex.slice(last, m.index) + `(${expandFractions(num.body)}) over (${expandFractions(den.body)})`;
    last = den.end;
    pattern.lastIndex = den.end;
  }
  return out + latex.slice(last);
}

/** A rough spoken form of LaTeX for accessible labels (the visual form is typeset by KaTeX). */
export function latexToSpeech(latex: string): string {
  return expandFractions(latex)
    .replace(/\\overline\{([^}]*)\|\}/g, "angle $1")
    .replace(/\\overline\{([^}]*)\}\|/g, "angle $1")
    .replace(/\\ddot\{a\}/g, "a-double-dot")
    .replace(/\\ddot\{s\}/g, "s-double-dot")
    .replace(/\\(left|right|,|;|!|quad|qquad)/g, " ")
    .replace(/\\cdot|\\times/g, " times ")
    .replace(/\\le(q)?\b/g, " ≤ ")
    .replace(/\\ge(q)?\b/g, " ≥ ")
    .replace(/\\neq\b/g, " ≠ ")
    .replace(/\\sum/g, " sum ")
    .replace(/\\(text|mathrm|operatorname)\{([^}]*)\}/g, "$2")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\^/g, " to the power ")
    .replace(/_/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

export function compositeDisplay(content: Extract<OptionContent, { type: "composite" }>): string {
  if (content.style === "ordered-pair") return `(${content.parts.map((p) => formatAnswer(p.value, p.format)).join(", ")})`;
  return content.parts.map((p) => `${p.label}: ${formatAnswer(p.value, p.format)}`).join("; ");
}

/**
 * The plain-text form of an option: the accessible label, the text stored in
 * `OptionDetail.display`, and what old report views fall back to.
 */
export function contentDisplay(content: OptionContent, statementCount = 3): string {
  switch (content.type) {
    case "numeric":
      return formatAnswer(content.value, content.format);
    case "text":
      return plainText(content.text);
    case "math":
      return latexToSpeech(content.latex);
    case "statements":
      return statementsLabel(content.keys, statementCount);
    case "composite":
      return compositeDisplay(content);
    case "table":
      return `${content.columns.join(" | ")}; ${content.rows.map((r) => r.join(" | ")).join("; ")}`;
  }
}

export function answerTypeOf(content: OptionContent): AnswerType {
  return content.type;
}

// ---------------------------------------------------------------- comparison

/**
 * A normalised form used to reject two options that say the same thing:
 * case, spacing, punctuation and trivial LaTeX spacing commands are ignored,
 * statement keys are compared as sets, and composite values by their displays.
 */
export function normalizedContent(content: OptionContent): string {
  const squash = (s: string) =>
    s
      .toLowerCase()
      .replace(/\\(left|right|,|;|!|quad|qquad|displaystyle)/g, "")
      .replace(/\\dfrac/g, "\\frac")
      .replace(/[\s.,;:!?'"`*]+/g, "")
      .replace(/[{}]/g, "");
  switch (content.type) {
    case "numeric":
      return `n:${formatAnswer(content.value, content.format)}`;
    case "text":
      return `t:${squash(content.text)}`;
    case "math":
      return `m:${squash(content.latex)}`;
    case "statements":
      return `s:${sortStatementKeys(content.keys).join("+")}`;
    case "composite":
      return `c:${content.parts.map((p) => formatAnswer(p.value, p.format)).join("|")}`;
    case "table":
      return `tb:${squash(content.rows.map((r) => r.join("|")).join("/"))}`;
  }
}

/** Every piece of markup inside a content value, for typesetting checks. */
export function contentMarkup(content: OptionContent): string[] {
  switch (content.type) {
    case "text":
      return [content.text];
    case "math":
      return [`$${content.latex}$`];
    case "table":
      return [...content.columns, ...content.rows.flat()];
    case "composite":
      return content.parts.map((p) => p.label);
    default:
      return [];
  }
}

export function exhibitMarkup(exhibit: Exhibit): string[] {
  return exhibit.type === "table" ? [exhibit.caption ?? "", ...exhibit.columns, ...exhibit.rows.flat()] : exhibit.items.map((i) => i.text);
}

/** Visible length of an option, for checking that the correct option does not stand out by detail. */
export function contentLength(content: OptionContent): number {
  return contentDisplay(content).length;
}

/**
 * The content of a stored option. Options persisted before the rich answer
 * model have no `content`; they are numeric, with the question's format.
 */
export function optionContent(option: { content?: OptionContent; value: number; display: string }, format: AnswerFormat | undefined): OptionContent {
  if (option.content) return option.content;
  return { type: "numeric", value: option.value, format: format ?? { kind: "number", decimals: 2 } };
}
