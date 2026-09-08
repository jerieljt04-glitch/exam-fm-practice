/**
 * Formatting helpers for authored question markup.
 *
 * Monetary amounts are written the way the SOA writes them in the Exam FM
 * sample questions: as bare numbers with no currency symbol. That is both the
 * house style of the exam and the reason the markup tokenizer can no longer
 * confuse a price with an inline-math delimiter — the class of bug that once
 * turned `the $12^{\text{th}} payment` into literal LaTeX on screen.
 *
 * Two flavours exist for each quantity:
 *   `money()`     — for prose, outside `$ ... $`.
 *   `mathMoney()` — for use *inside* a math expression, where digit grouping
 *                   must be written `{,}` so KaTeX does not add comma spacing.
 */

const LOCALE = "en-US";

/** Fixed-decimal number with thousands separators: `12,345.68`. */
export function num(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Whole number with thousands separators: `160,000`. */
export function int(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString(LOCALE);
}

/** An amount in prose, exam style: `money(1250.5)` -> `1,250.50`. */
export function money(value: number, decimals = 2): string {
  return num(value, decimals);
}

/** A whole amount in prose: `moneyInt(160000)` -> `160,000`. */
export function moneyInt(value: number): string {
  return int(value);
}

/** Digit grouping that is safe inside math mode: `12{,}345.68`. */
export function mathNum(value: number, decimals = 2): string {
  return num(value, decimals).replace(/,/g, "{,}");
}

/** Whole-number digit grouping that is safe inside math mode. */
export function mathInt(value: number): string {
  return int(value).replace(/,/g, "{,}");
}

/** An amount inside math mode: `mathMoney(1250.5)` -> `1{,}250.50`. */
export function mathMoney(value: number, decimals = 2): string {
  return mathNum(value, decimals);
}

/** A whole amount inside math mode. */
export function mathMoneyInt(value: number): string {
  return mathInt(value);
}

/** Percentage for prose from a decimal rate: `pct(0.061)` -> `6.10%`. */
export function pct(rate: number, decimals = 2): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** Percentage inside math mode from a decimal rate: `mathPct(0.061)` -> `6.10\%`. */
export function mathPct(rate: number, decimals = 2): string {
  return `${(rate * 100).toFixed(decimals)}\\%`;
}

/** Decimal rate rendered at full precision for derivations: `0.061000`. */
export function rate(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}

/** Ordinal suffix as math-mode markup: `ordinal(12)` -> `12^{\text{th}}`. */
export function ordinal(n: number): string {
  const remainderTen = n % 10;
  const remainderHundred = n % 100;
  let suffix = "th";
  if (remainderTen === 1 && remainderHundred !== 11) suffix = "st";
  else if (remainderTen === 2 && remainderHundred !== 12) suffix = "nd";
  else if (remainderTen === 3 && remainderHundred !== 13) suffix = "rd";
  return `${n}^{\\text{${suffix}}}`;
}
