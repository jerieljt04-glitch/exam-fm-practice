import type { AnswerFormat } from "./types";

/**
 * Number formatting for question text and answer choices.
 *
 * Amounts are written as bare numbers, the way the SOA sample set writes them,
 * so a price can never be mistaken for an inline-math delimiter.
 */

/** Grouped number for prose: `12,345.68`. */
export function num(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = value < 0 && Number(fixed) !== 0 ? "−" : "";
  return `${sign}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
}

/** The same number, safe inside `$ ... $`. */
export function mnum(value: number, decimals = 2): string {
  return num(value, decimals).replace(/,/g, "{,}").replace("−", "-");
}

/** A whole amount when whole, otherwise to the cent: `2500`, `1302.50`. */
export function amt(value: number): string {
  return num(value, Math.abs(value - Math.round(value)) < 1e-9 ? 0 : 2);
}

export function mamt(value: number): string {
  return amt(value).replace(/,/g, "{,}").replace("−", "-");
}

/** A rate's percent figure with trailing zeros dropped: 0.0725 -> `7.25`. */
export function rateFigure(rate: number, maxDecimals = 3): string {
  const fixed = (rate * 100).toFixed(maxDecimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/** `6%`, `7.25%` for prose. */
export const pc = (rate: number, maxDecimals = 3): string => `${rateFigure(rate, maxDecimals)}%`;

/** `6\%` inside math. */
export const mpc = (rate: number, maxDecimals = 3): string => `${rateFigure(rate, maxDecimals)}\\%`;

/** A decimal to `places` for derivations. */
export const dec = (value: number, places = 6): string => value.toFixed(places);

/** How an option prints. */
export function formatAnswer(value: number, format: AnswerFormat): string {
  switch (format.kind) {
    case "money":
      return num(value, format.decimals);
    case "percent":
      return `${num(value * 100, format.decimals)}%`;
    case "number":
      return `${num(value, format.decimals)}${format.unit ? ` ${format.unit}` : ""}`;
    case "time":
      return `${num(value, format.decimals)} ${format.unit}`;
  }
}

/** The display value converted back to a number, for distinctness checks. */
export function displayedValue(value: number, format: AnswerFormat): number {
  const decimals = format.kind === "percent" ? format.decimals + 2 : format.decimals;
  return Number(value.toFixed(decimals));
}
