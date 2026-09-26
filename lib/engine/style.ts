import type { Rng } from "./random";
import { mathPct, pct } from "./format";

/**
 * House style for question prose, matched to the SOA Exam FM sample questions.
 *
 * Those questions are written to a consistent pattern: a named person, a short
 * declarative given per sentence, amounts as bare numbers, and a closing
 * "Calculate ..." line. These helpers keep 47 generators writing in that one
 * voice instead of 47 slightly different ones.
 */

/** Names for the actors in a question. Drawn per question, so they vary by attempt. */
const NAMES = [
  "Aakash", "Amara", "Andre", "Beatriz", "Bruce", "Camila", "Chidi", "Colleen",
  "Daniela", "Elena", "Farida", "Grace", "Hiroshi", "Ingrid", "Jamal", "Jian",
  "Josefina", "Kenji", "Lars", "Leila", "Mateo", "Mei", "Nadia", "Nikhil",
  "Olamide", "Priya", "Rafael", "Rosa", "Sofia", "Tariq", "Thandiwe", "Tomas",
  "Wen", "Yara", "Yusuf", "Zainab",
];

/** Institutions, for questions whose actor is a company rather than a person. */
const INSTITUTIONS = [
  "Meridian Bank", "Northgate Trust", "Corvus Insurance", "Halcyon Mutual",
  "Larkspur Capital", "Sable Pension Fund", "Vantage Assurance", "Westbrook Bank",
];

/** `count` distinct names for one question. */
export function cast(rng: Rng, count = 1): string[] {
  return rng.shuffle(NAMES).slice(0, count);
}

export function institution(rng: Rng): string {
  return rng.choice(INSTITUTIONS);
}

/** `frequencyWord(2)` -> `semiannually`. */
export function frequencyWord(perYear: number): string {
  switch (perYear) {
    case 1:
      return "annually";
    case 2:
      return "semiannually";
    case 4:
      return "quarterly";
    case 12:
      return "monthly";
    default:
      return `${perYear} times per year`;
  }
}

/** `an annual effective interest rate of 6.40%` */
export function effectiveRate(rate: number, kind: "interest" | "discount" = "interest"): string {
  return `an annual effective ${kind} rate of ${pct(rate)}`;
}

/**
 * `an annual nominal interest rate of 6.40% convertible semiannually`
 * — "convertible" is the phrasing the sample questions use most often.
 */
export function nominalRate(
  rate: number,
  perYear: number,
  kind: "interest" | "discount" = "interest"
): string {
  return `an annual nominal ${kind} rate of ${pct(rate)} convertible ${frequencyWord(perYear)}`;
}

/** `at an annual force of interest of 0.055` */
export function forceOfInterest(delta: number): string {
  return `an annual force of interest of ${delta}`;
}

/**
 * "a 8-year loan" reads as "a eight-year loan"; numbers spoken with a leading
 * vowel sound (8, 11, 18, 80-89, 11,000, 18,500 ...) take "an".
 */
export function withArticles(text: string): string {
  return text
    .replace(/\b([Aa]) (?=(?:8[\d,.]*|1[18](?:,\d{3})*)(?!\d))/g, "$1n ")
    .replace(/\b([Aa]) (?=(?:eight|eleven|eighteen)\b)/g, "$1n ");
}

/**
 * Gives every prompt the same visual cadence as the published sample set:
 * compact declarative givens, followed by a clear blank line and a standalone
 * instruction. The content remains original and parameterized.
 */
export function sampleExamQuestion(source: string): string {
  const lines = withArticles(source)
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());
  // The instruction either opens its line ("Calculate X.") or follows a lead-in
  // clause, as the sample set often writes it ("Using an annual effective
  // interest rate of 10%, calculate the Macaulay duration of the stock.").
  const taskIndex = lines.findIndex((line) =>
    /^(Calculate|Determine|Which)\b|^[A-Z][^\n]*?,\s(calculate|determine)\b/.test(line.trim())
  );

  if (taskIndex <= 0) return lines.join("\n");

  const givens = lines.slice(0, taskIndex).join("\n").trimEnd();
  const task = lines.slice(taskIndex).join("\n").trim();
  return `${givens}\n\n${task}`;
}

/** A compact term-structure table matching the data-first layout of the sample questions. */
export function sampleSpotRateTable(spots: readonly number[]): string {
  const maturities = spots.map((_, index) => index + 1).join(" & ");
  const rates = spots.map((spot) => mathPct(spot)).join(" & ");
  return `You are given the following annual effective spot rates:
$$\\begin{array}{c|${"c".repeat(spots.length)}}
\\text{Maturity in years} & ${maturities} \\\\
\\hline
\\text{Spot rate} & ${rates}
\\end{array}$$`;
}
