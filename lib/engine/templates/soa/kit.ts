/**
 * Authoring kit for the SOA-style question bank.
 *
 * Every template in `templates/soa/` is modelled on a question type from the
 * SOA's current Exam FM sample set (the August 2026 revision, 460 items), and
 * writes in the voice that set uses: short declarative givens, bare numbers
 * with commas only from 10,000 upward, rates printed with no trailing zeros
 * ("6%", "7.25%"), and a closing "Calculate ..." or "Determine ..." line.
 *
 * The kit keeps that voice in one place and supplies the cash-flow arithmetic
 * the generators and their self-checks share.
 */
import { soaNumber } from "../../format";
import type { Rng } from "../../random";
import { cast } from "../../style";
import type { AuthoredChoice, DistractorType } from "../types";

export { cast };

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

/** A number for prose, SOA style: `4695`, `20,689`, `1302.50`. */
export function n(value: number, decimals = 0): string {
  return soaNumber(value, decimals);
}

/** The same number, safe inside `$ ... $`: grouping commas become `{,}`. */
export function mn(value: number, decimals = 0): string {
  return soaNumber(value, decimals).replace(/,/g, "{,}").replace("–", "-");
}

/** An amount printed whole when it is whole and to the cent otherwise: `260`, `1302.50`. */
export function amt(value: number): string {
  return soaNumber(value, Math.abs(value - Math.round(value)) < 1e-9 ? 0 : 2);
}

/** `amt` for use inside math mode. */
export function mamt(value: number): string {
  return amt(value).replace(/,/g, "{,}").replace("–", "-");
}

/** A ratio a/b in lowest terms for an exponent: `fraction(12, 4)` -> `3`, `fraction(4, 12)` -> `1/3`. */
export function fraction(numerator: number, denominator: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(numerator, denominator);
  const top = numerator / g;
  const bottom = denominator / g;
  return bottom === 1 ? String(top) : `${top}/${bottom}`;
}

/** A rate's percent figure with trailing zeros dropped: 0.0725 -> `7.25`. */
export function rateFigure(rate: number, maxDecimals = 2): string {
  const fixed = (rate * 100).toFixed(maxDecimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/** A rate for prose: 0.06 -> `6%`, 0.0725 -> `7.25%`. */
export function pc(rate: number, maxDecimals = 2): string {
  return `${rateFigure(rate, maxDecimals)}%`;
}

/** A rate inside math mode, where `%` must be escaped. */
export function mpc(rate: number, maxDecimals = 2): string {
  return `${rateFigure(rate, maxDecimals)}\\%`;
}

/** A decimal written to `decimals` places for a derivation: `0.052632`. */
export function dec(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}

const FREQUENCY_WORDS: Record<number, string> = {
  1: "annually",
  2: "semiannually",
  4: "quarterly",
  12: "monthly",
  365: "daily",
};

export function frequency(perYear: number): string {
  return FREQUENCY_WORDS[perYear] ?? `${perYear} times per year`;
}

const PERIOD_NOUNS: Record<number, string> = { 1: "year", 2: "six months", 4: "quarter", 12: "month" };

/** `month`, `quarter`, `six months`, `year`. */
export function periodNoun(perYear: number): string {
  return PERIOD_NOUNS[perYear] ?? "period";
}

/** `an annual effective interest rate of 6%` */
export function eff(i: number): string {
  return `an annual effective interest rate of ${pc(i)}`;
}

/** `an annual effective discount rate of 5%` */
export function effDisc(d: number): string {
  return `an annual effective discount rate of ${pc(d)}`;
}

/** `an annual nominal interest rate of 6% convertible monthly` */
export function nom(rate: number, perYear: number): string {
  return `an annual nominal interest rate of ${pc(rate)} convertible ${frequency(perYear)}`;
}

/** `an annual nominal discount rate of 8% convertible quarterly` */
export function nomDisc(rate: number, perYear: number): string {
  return `an annual nominal discount rate of ${pc(rate)} convertible ${frequency(perYear)}`;
}

/** Plain-text ordinal as the sample questions print it: `5th`, `21st`, `12th`. */
export function ord(k: number): string {
  const ten = k % 10;
  const hundred = k % 100;
  if (ten === 1 && hundred !== 11) return `${k}st`;
  if (ten === 2 && hundred !== 12) return `${k}nd`;
  if (ten === 3 && hundred !== 13) return `${k}rd`;
  return `${k}th`;
}

/** Word for small counts, as the sample questions write "ten years", "three bonds". */
export function word(k: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen", "twenty",
  ];
  return words[k] ?? String(k);
}

/** `1, 3, and 5` — a list in prose. */
export function listing(items: readonly (string | number)[]): string {
  const parts = items.map(String);
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** A grid of values written as a KaTeX array, the layout the sample set uses for rate tables. */
export function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const columns = "c".repeat(header.length);
  const body = rows.map((row) => row.join(" & ")).join(" \\\\\n");
  return `$$\\begin{array}{${columns}}\n${header.map((cell) => `\\text{${cell}}`).join(" & ")} \\\\\n\\hline\n${body}\n\\end{array}$$`;
}

// ---------------------------------------------------------------------------
// Parameter draws
// ---------------------------------------------------------------------------

/** A rate on a grid: `gridRate(rng, 0.03, 0.08, 0.0025)` draws 3%, 3.25%, ..., 8%. */
export function gridRate(rng: Rng, min: number, max: number, step: number): number {
  const count = Math.round((max - min) / step);
  return Number((min + rng.int(0, count) * step).toFixed(6));
}

/** A whole amount on a grid: `gridAmount(rng, 1000, 5000, 250)`. */
export function gridAmount(rng: Rng, min: number, max: number, step: number): number {
  const count = Math.round((max - min) / step);
  return min + rng.int(0, count) * step;
}

/**
 * Redraws `make()` until `accept` holds. Parameter draws that would produce an
 * implausible question (a negative deposit, a 40% yield) are rejected here;
 * `fallback` is a parameter set known to work, used only if every draw fails.
 */
export function drawUntil<T>(make: () => T, accept: (value: T) => boolean, fallback: T): T {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = make();
    if (accept(value)) return value;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Interest arithmetic
// ---------------------------------------------------------------------------

export type Flow = readonly [time: number, amount: number];

export const v = (i: number, t: number): number => Math.pow(1 + i, -t);
export const acc = (i: number, t: number): number => Math.pow(1 + i, t);

/** Effective annual rate from a nominal rate convertible m times a year. */
export const nomToEff = (rate: number, m: number): number => Math.pow(1 + rate / m, m) - 1;
/** Nominal rate convertible m times a year equivalent to effective rate i. */
export const effToNom = (i: number, m: number): number => m * (Math.pow(1 + i, 1 / m) - 1);
/** Effective annual interest rate from a nominal discount rate convertible m times a year. */
export const nomDiscToEff = (d: number, m: number): number => Math.pow(1 - d / m, -m) - 1;
/** Rate per period of length 1/m equivalent to effective annual rate i. */
export const perPeriod = (i: number, m: number): number => Math.pow(1 + i, 1 / m) - 1;

export const an = (count: number, i: number): number =>
  Math.abs(i) < 1e-14 ? count : (1 - v(i, count)) / i;
export const adue = (count: number, i: number): number => an(count, i) * (1 + i);
export const sn = (count: number, i: number): number =>
  Math.abs(i) < 1e-14 ? count : (acc(i, count) - 1) / i;
export const sdue = (count: number, i: number): number => sn(count, i) * (1 + i);
/** Payments 1, 2, ..., n at the end of periods 1..n. */
export const Ia = (count: number, i: number): number => (adue(count, i) - count * v(i, count)) / i;
/** Payments n, n-1, ..., 1 at the end of periods 1..n. */
export const Da = (count: number, i: number): number => (count - an(count, i)) / i;
/** Accumulated value at time n of payments 1, 2, ..., n. */
export const Is = (count: number, i: number): number => (sdue(count, i) - count) / i;

/** Present value at time 0 of 1, (1+g), (1+g)^2, ... paid at times 1..n. */
export function geo(count: number, i: number, g: number): number {
  if (Math.abs(i - g) < 1e-12) return count / (1 + i);
  return (1 - Math.pow((1 + g) / (1 + i), count)) / (i - g);
}

/** Present value at time 0 of a cash-flow list. */
export function pv(flows: readonly Flow[], i: number): number {
  return flows.reduce((sum, [t, amount]) => sum + amount * v(i, t), 0);
}

/** Value of a cash-flow list at time `at`. */
export function valueAt(flows: readonly Flow[], i: number, at: number): number {
  return pv(flows, i) * acc(i, at);
}

/** Present value when each cash flow is discounted at its own spot rate `spots[t - 1]`. */
export function pvAtSpots(flows: readonly Flow[], spots: readonly number[]): number {
  return flows.reduce((sum, [t, amount]) => sum + amount * Math.pow(1 + spots[t - 1], -t), 0);
}

/** Level cash flows of `amount` at times first, first+gap, ... (count of them). */
export function level(amount: number, count: number, first = 1, gap = 1): Flow[] {
  return Array.from({ length: count }, (_, k) => [first + k * gap, amount] as const);
}

/**
 * Bisection root finder. `f(lo)` and `f(hi)` must straddle zero; the solver
 * refuses to guess otherwise, because a template that silently returns a
 * wrong root would publish a wrong key.
 */
export function solve(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) {
    throw new Error(`solve: no sign change on [${lo}, ${hi}]`);
  }
  for (let k = 0; k < 200; k += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fa * fm < 0) {
      b = mid;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** `solve`, or NaN when the interval does not bracket a root — for distractors, which are simply dropped. */
export function trySolve(f: (x: number) => number, lo: number, hi: number): number {
  try {
    return solve(f, lo, hi);
  } catch {
    return Number.NaN;
  }
}

/** Yield rate: the rate at which the flows (outlays negative) have zero present value. */
export function irr(flows: readonly Flow[], lo = -0.5, hi = 2): number {
  return solve((i) => pv(flows, i), lo, hi);
}

export function macaulay(flows: readonly Flow[], i: number): number {
  const price = pv(flows, i);
  return flows.reduce((sum, [t, amount]) => sum + t * amount * v(i, t), 0) / price;
}

export function modified(flows: readonly Flow[], i: number): number {
  return macaulay(flows, i) / (1 + i);
}

/** Macaulay convexity: sum t^2 CF v^t / P. */
export function macaulayConvexity(flows: readonly Flow[], i: number): number {
  const price = pv(flows, i);
  return flows.reduce((sum, [t, amount]) => sum + t * t * amount * v(i, t), 0) / price;
}

/** Modified convexity: P''(i) / P(i). */
export function modifiedConvexity(flows: readonly Flow[], i: number): number {
  const price = pv(flows, i);
  return flows.reduce((sum, [t, amount]) => sum + t * (t + 1) * amount * v(i, t + 2), 0) / price;
}

/** Bond cash flows per coupon period: coupons Fr for n periods plus C at the end. */
export function bondFlows(coupon: number, redemption: number, periods: number): Flow[] {
  return Array.from({ length: periods }, (_, k) => [
    k + 1,
    coupon + (k + 1 === periods ? redemption : 0),
  ] as const);
}

/** Price per coupon period: coupon * a_n + C v^n. */
export function bondPrice(coupon: number, redemption: number, j: number, periods: number): number {
  return coupon * an(periods, j) + redemption * v(j, periods);
}

/** Round to the cent, as a quoted price or amount is printed. */
export const cents = (value: number): number => Math.round(value * 100) / 100;

/** `an annual coupon rate of 8% paid semiannually` */
export function couponText(rate: number, perYear: number): string {
  return `an annual coupon rate of ${pc(rate)} paid ${frequency(perYear)}`;
}

/**
 * A bond's yield as the sample set quotes it after "to yield" or "priced
 * using": a nominal rate convertible as often as the coupons are paid, or an
 * annual effective rate.
 */
export function yieldText(rate: number, perYear: number, effective: boolean): string {
  if (effective || perYear === 1) return `an annual effective rate of ${pc(rate)}`;
  return `an annual nominal rate of ${pc(rate)} convertible ${frequency(perYear)}`;
}

/** Yield per coupon period for a quoted annual rate. */
export function couponPeriodRate(rate: number, perYear: number, effective: boolean): number {
  return effective ? perPeriod(rate, perYear) : rate / perYear;
}

/** Book value just after coupon `t` of a bond with `periods` coupons: the price of what remains. */
export function bookValue(coupon: number, redemption: number, j: number, periods: number, t: number): number {
  return bondPrice(coupon, redemption, j, periods - t);
}

/** Level payment that amortizes `principal` over `count` periods at rate i. */
export function payment(principal: number, count: number, i: number): number {
  return principal / an(count, i);
}

/**
 * Year-by-year amortization ledger: interest, principal and closing balance of
 * each payment. Used by the self-checks as a retrospective recomputation.
 */
export function ledger(
  principal: number,
  payments: readonly number[],
  rateForPeriod: (period: number) => number
): { interest: number; principal: number; balance: number }[] {
  const rows: { interest: number; principal: number; balance: number }[] = [];
  let balance = principal;
  payments.forEach((amount, index) => {
    const interest = balance * rateForPeriod(index + 1);
    const repaid = amount - interest;
    balance -= repaid;
    rows.push({ interest, principal: repaid, balance });
  });
  return rows;
}

/** True when two figures agree to a relative tolerance. */
export function close(a: number, b: number, tolerance = 1e-8): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

// ---------------------------------------------------------------------------
// Qualitative items
// ---------------------------------------------------------------------------

/** A statement authored in a true and a false form, with the reason for each. */
export interface StatementPair {
  /** Correct form of the statement. */
  truth: string;
  /** Plausible but wrong form. */
  falsehood: string;
  /** Why the correct form holds; shown in the worked solution. */
  why: string;
}

const NOT_GIVEN = "The correct answer is not given by (A), (B), (C), or (D).";

/**
 * The two answer schemes the sample set uses for three Roman-numeral statements.
 *
 * Scheme ONE: (A) I only, (B) II only, (C) III only, (D) I, II, and III, (E) not given.
 * Scheme PAIRS: (A) None, (B) I and II only, (C) I and III only, (D) II and III only, (E) not given.
 */
const SCHEMES: Record<
  "ONE" | "PAIRS",
  { labels: string[]; truth: boolean[][]; otherwise: boolean[][] }
> = {
  ONE: {
    labels: ["I only", "II only", "III only", "I, II, and III", NOT_GIVEN],
    truth: [
      [true, false, false],
      [false, true, false],
      [false, false, true],
      [true, true, true],
    ],
    otherwise: [
      [false, false, false],
      [true, true, false],
      [true, false, true],
      [false, true, true],
    ],
  },
  PAIRS: {
    labels: ["None", "I and II only", "I and III only", "II and III only", NOT_GIVEN],
    truth: [
      [false, false, false],
      [true, true, false],
      [true, false, true],
      [false, true, true],
    ],
    otherwise: [
      [true, false, false],
      [false, true, false],
      [false, false, true],
      [true, true, true],
    ],
  },
} as const;

const ROMAN = ["I", "II", "III"] as const;

function describeTruth(values: readonly boolean[]): string {
  const trueOnes = values.map((value, k) => (value ? ROMAN[k] : null)).filter(Boolean);
  if (trueOnes.length === 0) return "none of the statements is true";
  if (trueOnes.length === 3) return "all three statements are true";
  return `only ${trueOnes.join(" and ")} ${trueOnes.length === 1 ? "is" : "are"} true`;
}

/**
 * Draws one of the sample set's Roman-numeral answer schemes and a key letter,
 * and returns the truth value each of I, II and III must take for that letter
 * to be the key. Drawing the letter first spreads the key evenly over A-E.
 */
export function romanPattern(rng: Rng): {
  scheme: "ONE" | "PAIRS";
  labels: string[];
  truth: boolean[];
  target: number;
  verdict: string;
} {
  const schemeName = rng.choice(["ONE", "PAIRS"] as const);
  const scheme = SCHEMES[schemeName];
  const target = rng.int(0, 4);
  const truth = (target < 4 ? scheme.truth[target] : rng.choice(scheme.otherwise)).slice();
  return { scheme: schemeName, labels: scheme.labels, truth, target, verdict: describeTruth(truth) };
}

/** The five printed choices for a Roman-numeral pattern, with the key marked. */
export function romanChoices(pattern: { labels: string[]; target: number; verdict: string }): AuthoredChoice[] {
  return pattern.labels.map((label, k) => ({
    text: label,
    isCorrect: k === pattern.target,
    type: "CALCULATION_DISTRACTOR" as DistractorType,
    explanation: k === pattern.target ? "Matches the verdict on each item." : `Not consistent with the verdicts: ${pattern.verdict}.`,
  }));
}

/**
 * Builds a "Determine which of the following statements are true" item from
 * three statement pairs. The key letter is drawn first and the statements are
 * set true or false to realise it, so the answer is spread evenly across A-E
 * instead of piling up on "not given".
 */
export function romanStatements(
  rng: Rng,
  options: { lead: string; pairs: readonly StatementPair[]; ask?: string }
): {
  questionText: string;
  choices: AuthoredChoice[];
  solutionSteps: string;
  truth: boolean[];
} {
  const { labels, truth, target } = romanPattern(rng);
  const scheme = { labels };
  const chosen = rng.shuffle(options.pairs).slice(0, 3);
  const lines = chosen.map((pair, k) => `${ROMAN[k]}. ${truth[k] ? pair.truth : pair.falsehood}`);

  const actual = describeTruth(truth);
  const choices: AuthoredChoice[] = scheme.labels.map((label, k) => ({
    text: label,
    isCorrect: k === target,
    type: "CALCULATION_DISTRACTOR" as DistractorType,
    explanation:
      k === target
        ? "Matches the verdict on each statement."
        : `Not consistent with the statements: ${actual}.`,
  }));

  const verdicts = chosen
    .map(
      (pair, k) =>
        `**${ROMAN[k]}. ${truth[k] ? "True" : "False"}.** ${truth[k] ? "" : `The correct statement is: ${pair.truth} `}${pair.why}`
    )
    .join("\n\n");

  return {
    questionText: `${options.lead}\n${options.ask ?? "Determine which of the following statements are true."}\n${lines.join("\n")}`,
    choices,
    solutionSteps: `**Step 1 — Judge each statement.**\n\n${verdicts}\n\n**Step 2 — Match the verdicts to an answer.** Since ${actual}, the answer is **${scheme.labels[target]}**.`,
    truth,
  };
}

/**
 * "Determine which of the following statements is true" (or false): exactly one
 * of the five printed statements has the asked-for truth value.
 */
export function oneOfFive(
  rng: Rng,
  options: {
    lead: string;
    pairs: readonly StatementPair[];
    askFalse?: boolean;
  }
): { questionText: string; choices: AuthoredChoice[]; solutionSteps: string } {
  const picked = rng.shuffle(options.pairs).slice(0, 5);
  const keyIndex = rng.int(0, 4);
  const askFalse = options.askFalse ?? false;
  const choices: AuthoredChoice[] = picked.map((pair, k) => {
    const isKey = k === keyIndex;
    // The key is the lone false statement when asking for the false one.
    const printedTrue = askFalse ? !isKey : isKey;
    return {
      text: printedTrue ? pair.truth : pair.falsehood,
      isCorrect: isKey,
      type: "CALCULATION_DISTRACTOR" as DistractorType,
      explanation: printedTrue
        ? askFalse
          ? `This statement is true. ${pair.why}`
          : "This is the true statement."
        : askFalse
          ? "This is the false statement."
          : `This statement is false. ${pair.why}`,
    };
  });
  const key = choices[keyIndex];
  const keyPair = picked[keyIndex];
  const questionText = `${options.lead}\nDetermine which of the following statements is ${askFalse ? "false" : "true"}.`;
  const solutionSteps = askFalse
    ? `**Step 1 — Find the statement that fails.** "${key.text}" is false. ${keyPair.why}\n\n**Step 2 — Confirm the others.** The remaining four statements are correct as printed.`
    : `**Step 1 — Find the statement that holds.** "${key.text}" is true. ${keyPair.why}\n\n**Step 2 — Rule out the others.** Each of the other four statements misstates the relationship.`;
  return { questionText, choices, solutionSteps };
}

/**
 * Five printed choices that each carry a number (a pair of amounts, a date),
 * listed in ascending order of that number the way the sample set lists them,
 * with the key's position drawn first so it does not always land in the middle.
 */
export function orderedChoices(
  rng: Rng,
  correct: { text: string; sortKey: number },
  wrong: readonly { text: string; sortKey: number; explanation: string; type?: DistractorType }[]
): AuthoredChoice[] {
  const distinct = wrong.filter(
    (item, k) =>
      item.text !== correct.text &&
      wrong.findIndex((other) => other.text === item.text) === k
  );
  const below = distinct.filter((item) => item.sortKey < correct.sortKey);
  const above = distinct.filter((item) => item.sortKey > correct.sortKey);
  // The key sits after however many options fall below it, so drawing that
  // count uniformly over its feasible range spreads the key across A-E.
  const minBelow = Math.max(0, 4 - above.length);
  const maxBelow = Math.min(4, below.length);
  const wantBelow = minBelow <= maxBelow ? rng.int(minBelow, maxBelow) : below.length;
  const pickedBelow = rng.shuffle(below).slice(0, wantBelow);
  const pickedAbove = rng.shuffle(above).slice(0, 4 - pickedBelow.length);
  const pool = [...pickedBelow, ...pickedAbove];
  if (pool.length < 4) {
    const rest = distinct.filter((item) => !pool.includes(item));
    pool.push(...rest.slice(0, 4 - pool.length));
  }
  const all = [
    { ...correct, explanation: "Matches the worked solution.", isCorrect: true, type: undefined },
    ...pool.map((item) => ({ ...item, isCorrect: false })),
  ].sort((a, b) => a.sortKey - b.sortKey);
  return all.map((item) => ({
    text: item.text,
    isCorrect: item.isCorrect,
    type: item.isCorrect ? undefined : (item.type ?? "CALCULATION_DISTRACTOR"),
    explanation: item.explanation,
  }));
}
