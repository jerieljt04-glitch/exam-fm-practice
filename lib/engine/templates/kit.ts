/**
 * Authoring kit for question templates: prose helpers, parameter draws,
 * expression builders and constructors that keep every template's output in
 * the same shape.
 */
import { lit, onePlus, sumOf } from "../expr";
import { amt, dec, formatAnswer, mamt, mnum, mpc, num, pc } from "../format";
import type { MisconceptionId } from "../misconceptions";
import type { Rng } from "../random";
import type {
  AlgebraMethod,
  AnswerFormat,
  ChainErrorKind,
  ChainStep,
  DistractorCandidate,
  Explanation,
  FormulaChain,
  QuestionFeatures,
  TimeUnit,
  Translation,
  TrapStage,
} from "../types";

export { amt, dec, formatAnswer, lit, mamt, mnum, mpc, num, onePlus, pc, sumOf };

export const MONEY0: AnswerFormat = { kind: "money", decimals: 0 };
export const MONEY2: AnswerFormat = { kind: "money", decimals: 2 };
export const PCT2: AnswerFormat = { kind: "percent", decimals: 2 };
export const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
export const YEARS2: AnswerFormat = { kind: "number", decimals: 2 };
export const PLAIN2: AnswerFormat = { kind: "number", decimals: 2 };
export const PLAIN3: AnswerFormat = { kind: "number", decimals: 3 };

/** The answer as printed, for derivations: `= 4,695`. */
export const shown = (value: number, format: AnswerFormat): string => formatAnswer(value, format).replace(/,/g, "{,}").replace("%", "\\%");

// ---------------------------------------------------------------- draws

export function gridRate(rng: Rng, min: number, max: number, step: number): number {
  const count = Math.round((max - min) / step);
  return Number((min + rng.int(0, count) * step).toFixed(8));
}

export function gridAmount(rng: Rng, min: number, max: number, step: number): number {
  const count = Math.round((max - min) / step);
  return min + rng.int(0, count) * step;
}

/** Redraws until `accept` holds; throws (rejecting the draft) if it never does. */
export function drawUntil<T>(make: () => T, accept: (value: T) => boolean): T {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const value = make();
    if (accept(value)) return value;
  }
  throw new Error("No acceptable parameter draw.");
}

// ---------------------------------------------------------------- prose

const FREQUENCY_WORDS: Record<number, string> = { 1: "annually", 2: "semiannually", 4: "quarterly", 12: "monthly" };
export const frequency = (m: number): string => FREQUENCY_WORDS[m] ?? `${m} times per year`;

const PERIOD_NOUNS: Record<number, string> = { 1: "year", 2: "half-year", 4: "quarter", 12: "month" };
export const periodNoun = (m: number): string => PERIOD_NOUNS[m] ?? "period";

export const UNIT_FOR: Record<number, TimeUnit> = { 1: "year", 2: "half-year", 4: "quarter", 12: "month" };

export function ord(k: number): string {
  const ten = k % 10;
  const hundred = k % 100;
  if (ten === 1 && hundred !== 11) return `${k}st`;
  if (ten === 2 && hundred !== 12) return `${k}nd`;
  if (ten === 3 && hundred !== 13) return `${k}rd`;
  return `${k}th`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const word = (k: number): string => WORDS[k] ?? String(k);

/** An annuity symbol for markup: `a_{\angl{10}}` at rate `i`. */
export const aSym = (n: number | string, rate?: string): string =>
  `a_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;
export const adueSym = (n: number | string, rate?: string): string =>
  `\\ddot{a}_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;
export const sSym = (n: number | string, rate?: string): string =>
  `s_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;
export const sdueSym = (n: number | string, rate?: string): string =>
  `\\ddot{s}_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;

// ---------------------------------------------------------------- expressions

/** `(1+i)**-t` as an expression. */
export const vPow = (i: number | string, t: number | string): string => `${onePlus(i)}**(-(${t}))`;
/** `(1+i)**t` as an expression. */
export const accPow = (i: number | string, t: number | string): string => `${onePlus(i)}**(${t})`;
/** a(n) at i written as a closed form. */
export const aExpr = (n: number, i: number | string): string => `((1-${vPow(i, n)})/${typeof i === "number" ? lit(i) : i})`;
export const sExpr = (n: number, i: number | string): string => `((${accPow(i, n)}-1)/${typeof i === "number" ? lit(i) : i})`;
export const adueExpr = (n: number, i: number | string): string => `(${aExpr(n, i)}*${onePlus(i)})`;
export const sdueExpr = (n: number, i: number | string): string => `(${sExpr(n, i)}*${onePlus(i)})`;

/** Present value of explicit flows written out term by term. */
export function pvTerms(flows: readonly { t: number; amount: number | string }[], i: number | string): string {
  return sumOf(
    flows.map((flow) => `${typeof flow.amount === "number" ? lit(flow.amount) : `(${flow.amount})`}*${vPow(i, flow.t)}`)
  );
}

/** Accumulated value at time `at` of explicit flows, term by term. */
export function avTerms(flows: readonly { t: number; amount: number | string }[], i: number | string, at: number): string {
  return sumOf(
    flows.map((flow) => `${typeof flow.amount === "number" ? lit(flow.amount) : `(${flow.amount})`}*${accPow(i, at - flow.t)}`)
  );
}

/** Level payments of `amount` at each time in `times`. */
export const level = (amount: number | string, times: readonly number[]) => times.map((t) => ({ t, amount }));

export const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let t = from; t <= to; t += 1) out.push(t);
  return out;
};

// ---------------------------------------------------------------- constructors

export function distractor(
  misconception: MisconceptionId,
  value: number,
  calc: string,
  parts: { derivation: string; method: string; feedback: string; markers?: number[] }
): DistractorCandidate {
  return { misconception, value, calc, ...parts };
}

export function features(partial: Partial<QuestionFeatures> & { steps: number }): QuestionFeatures {
  return {
    multiConcept: false,
    formulaRetrieval: false,
    multipleValuationDates: false,
    unfamiliar: false,
    ...partial,
  };
}

export function translation(t: Translation): Translation {
  return t;
}

export function explanation(e: Explanation): Explanation {
  return e;
}

// ---------------------------------------------------------------- formula chains

/** One step of a solution plan: `step("D.prospective", "why", ["B_k", value, "meaning"], ["P", "i"])`. */
export function step(
  formula: string,
  purpose: string,
  output: [symbol: string, value: number, meaning: string],
  inputs: string[] = [],
  extra: Partial<Pick<ChainStep, "valuationDate" | "rearranged" | "derived">> = {}
): ChainStep {
  return { formula, purpose, output: { symbol: output[0], value: output[1], meaning: output[2] }, inputs, ...extra };
}

type StageSpec = number | [number, ChainErrorKind] | [number, ChainErrorKind, string];

/** A solution plan. `stages` maps each trap to the step where it goes wrong (and optionally how). */
export function chain(
  steps: ChainStep[],
  opts: { methods?: AlgebraMethod[]; stages?: Partial<Record<MisconceptionId, StageSpec>>; reasoning: string; unconventional?: boolean }
): FormulaChain {
  const stages: FormulaChain["stages"] = {};
  for (const [id, spec] of Object.entries(opts.stages ?? {}) as Array<[MisconceptionId, StageSpec]>) {
    const value: TrapStage = typeof spec === "number" ? { stage: spec } : { stage: spec[0], kind: spec[1], ...(spec[2] ? { wrongFormula: spec[2] } : {}) };
    stages[id] = value;
  }
  return { steps, methods: opts.methods ?? [], reasoning: opts.reasoning, unconventional: opts.unconventional, stages };
}
