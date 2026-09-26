/**
 * Markup tokenizer test suite (`npm run test:markup`).
 *
 * Table-driven cases for `lib/math/markup.ts`, including the exact question
 * text that used to render as literal `$12^{\text{th}}$` on screen.
 */

import katex from "katex";
import { normalizePlainMathText, parseMarkup, tokenizeMath, type MathSegment } from "../lib/math/markup";
import { DOMAIN_FORMULAS, FORMULA_SECTIONS } from "../lib/math/reference-formulas";

let failures = 0;

function describe(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`  ✗ ${name}\n      expected ${b}\n      actual   ${a}`);
  }
}

const text = (value: string): MathSegment => ({ type: "text", value });
const inline = (value: string): MathSegment => ({ type: "inline", value });
const display = (value: string): MathSegment => ({ type: "display", value });

console.log("Markup tokenizer");
console.log("================");

// --- Prose must not expose math-mode thousands separators --------------------
describe("normalize math separator in plain text", normalizePlainMathText("The book value is 2{,}718.80."), "The book value is 2,718.80.");
describe("normalize escaped math separator in plain text", normalizePlainMathText("The book value is 2\\{,}699.27."), "The book value is 2,699.27.");
describe("leave non-thousands braces alone", normalizePlainMathText("Use x_{,} in this label."), "Use x_{,} in this label.");
describe(
  "render screenshot bond question prose with correct separators",
  parseMarkup("The book value immediately after a coupon is 2{,}718.80, and the book value immediately after the next coupon is 2{,}699.27.")
    .filter((node) => node.type === "text")
    .map((node) => normalizePlainMathText(node.value))
    .join(""),
  "The book value immediately after a coupon is 2,718.80, and the book value immediately after the next coupon is 2,699.27."
);

// --- The reported regression ------------------------------------------------
const REPORTED = `A loan of $160,000 is repaid with equal annual payments at the end of each year for 28 years at an annual effective interest rate of 6.10%.
Calculate the outstanding loan balance immediately after the $12^{\\text{th}}$ payment is made.`;

describe(
  "unescaped price and ordinal math in the same question",
  tokenizeMath(REPORTED),
  [
    text(
      "A loan of $160,000 is repaid with equal annual payments at the end of each year for 28 years at an annual effective interest rate of 6.10%.\nCalculate the outstanding loan balance immediately after the "
    ),
    inline("12^{\\text{th}}"),
    text(" payment is made."),
  ]
);

const SAME_LINE = `A loan of $160,000 is repaid over 28 years; find the balance after the $12^{\\text{th}}$ payment.`;
describe(
  "price and ordinal math on a single line",
  tokenizeMath(SAME_LINE),
  [
    text("A loan of $160,000 is repaid over 28 years; find the balance after the "),
    inline("12^{\\text{th}}"),
    text(" payment."),
  ]
);

// --- Escaped currency, the canonical authored form --------------------------
describe("escaped currency is literal", tokenizeMath("Pay \\$1,250.00 today."), [
  text("Pay $1,250.00 today."),
]);

describe("escaped currency next to math", tokenizeMath("\\$500 at $t = 3$."), [
  text("$500 at "),
  inline("t = 3"),
  text("."),
]);

// --- Math that begins with a digit ------------------------------------------
describe("expression opening with a digit", tokenizeMath("Solving $1 - v^{n} = 0.5$ gives n."), [
  text("Solving "),
  inline("1 - v^{n} = 0.5"),
  text(" gives n."),
]);

describe("payment expression", tokenizeMath("The payment is $300t$ dollars."), [
  text("The payment is "),
  inline("300t"),
  text(" dollars."),
]);

// --- Display math -----------------------------------------------------------
describe(
  "display math across lines",
  tokenizeMath("Given\n$$\\delta(t) = 0.03 + 0.001t$$\nfind the value."),
  [text("Given\n"), display("\\delta(t) = 0.03 + 0.001t"), text("\nfind the value.")]
);

// --- Degenerate input must never throw or swallow content -------------------
describe("unterminated inline math stays literal", tokenizeMath("costs $ and more"), [
  text("costs $ and more"),
]);

describe("unterminated display math stays literal", tokenizeMath("value $$x + 1"), [
  text("value $$x + 1"),
]);

describe("empty delimiters stay literal", tokenizeMath("a $$ b"), [text("a $$ b")]);

describe("escaped percent outside math", tokenizeMath("a rate of 6.10\\%"), [
  text("a rate of 6.10%"),
]);

describe("percent inside math is preserved", tokenizeMath("$i = 6.10\\%$"), [
  inline("i = 6.10\\%"),
]);

// --- Emphasis ---------------------------------------------------------------
describe(
  "bold spanning inline math",
  parseMarkup("**Step 1 — solve for $y$.**"),
  [
    { type: "text", value: "Step 1 — solve for ", strong: true, em: false, code: false },
    { type: "inline", value: "y", strong: true, em: false, code: false },
    { type: "text", value: ".", strong: true, em: false, code: false },
  ]
);

describe("code span", parseMarkup("use `v^n` here"), [
  { type: "text", value: "use ", strong: false, em: false, code: false },
  { type: "text", value: "v^n", strong: false, em: false, code: true },
  { type: "text", value: " here", strong: false, em: false, code: false },
]);

describe("emphasis resets at a line break", parseMarkup("**unclosed\nplain"), [
  { type: "text", value: "unclosed", strong: true, em: false, code: false },
  { type: "break" },
  { type: "text", value: "plain", strong: false, em: false, code: false },
]);

describe("display math clears emphasis", parseMarkup("**bold**\n$$x = 1$$"), [
  { type: "text", value: "bold", strong: true, em: false, code: false },
  { type: "break" },
  { type: "display", value: "x = 1" },
]);

// The reference sheet and landing-page formulas are outside the generated
// question bank, so the engine's KaTeX checks do not otherwise reach them.
const renderMath = (name: string, expression: string, displayMode = false) => {
  try {
    katex.renderToString(expression, { displayMode, throwOnError: true, strict: false });
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}: ${String(error)}`);
  }
};

for (const [domain, formula] of Object.entries(DOMAIN_FORMULAS)) {
  renderMath(`Landing formula ${domain}`, formula);
}
for (const section of FORMULA_SECTIONS) {
  for (const formula of section.formulas) {
    for (const content of [formula.name, formula.latex]) {
      for (const segment of parseMarkup(content)) {
        if (segment.type === "inline" || segment.type === "display") {
          renderMath(`${section.title} / ${formula.name}`, segment.value, segment.type === "display");
        }
      }
    }
  }
}

console.log("\nResult");
console.log("======");
if (failures === 0) {
  console.log("  All markup checks passed.");
} else {
  console.error(`  ${failures} check(s) failed.`);
  process.exitCode = 1;
}
