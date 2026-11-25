/**
 * Authoring kit for the Elite (level 4) bank.
 *
 * Elite questions chain four to six stages — several rate regimes, valuation
 * dates, frequencies or an inversion — so their arithmetic is long. To keep
 * every number and the expression the validator re-evaluates in step, each
 * quantity is built once as an `X`: a value together with the expression
 * that produces it. An unknown is the symbol `x`; the same builder function
 * then gives both the equation of value (for the validator's root finder)
 * and, evaluated at a trial number, the bisection target.
 *
 * Each template offers several *cases* — different situations, unknowns and
 * routes through the same syllabus idea — so that a repeated template comes
 * back as a different problem, not the same one with new numbers.
 */
import type { MisconceptionId } from "../misconceptions";
import type { Rng } from "../random";
import type { AlgebraMethod, AnswerFormat, ChainStep, DistractorCandidate, Presentation, QuestionDraft, QuestionFeatures } from "../types";
import { bisect, compose } from "./approach-kit";
import { lit, shown } from "./kit";

// ---------------------------------------------------------------- value + expression algebra

export class X {
  constructor(
    readonly v: number,
    readonly e: string
  ) {}
}

/** A constant. */
export const K = (v: number): X => new X(v, lit(v));
/** The unknown `x`, carrying a trial value. */
export const sym = (t: number): X => new X(t, "x");

const asX = (a: X | number): X => (typeof a === "number" ? K(a) : a);

export const add = (...xs: Array<X | number>): X => {
  const ys = xs.map(asX);
  return new X(
    ys.reduce((a, b) => a + b.v, 0),
    `(${ys.map((y) => y.e).join(" + ")})`
  );
};
export const sub = (a: X | number, b: X | number): X => {
  const [p, q] = [asX(a), asX(b)];
  return new X(p.v - q.v, `(${p.e} - ${q.e})`);
};
export const mul = (...xs: Array<X | number>): X => {
  const ys = xs.map(asX);
  return new X(
    ys.reduce((a, b) => a * b.v, 1),
    `(${ys.map((y) => y.e).join("*")})`
  );
};
export const div = (a: X | number, b: X | number): X => {
  const [p, q] = [asX(a), asX(b)];
  return new X(p.v / q.v, `(${p.e}/${q.e})`);
};
export const pow = (a: X | number, b: X | number): X => {
  const [p, q] = [asX(a), asX(b)];
  return new X(Math.pow(p.v, q.v), `(${p.e})**(${q.e})`);
};
export const exp = (a: X | number): X => {
  const p = asX(a);
  return new X(Math.exp(p.v), `exp(${p.e})`);
};
export const ln = (a: X | number): X => {
  const p = asX(a);
  return new X(Math.log(p.v), `log(${p.e})`);
};
export const sum = (xs: X[]): X => (xs.length ? add(...xs) : K(0));

// ---------------------------------------------------------------- finance on X

export const onep = (i: X | number): X => add(1, i);
/** Discount factor (1 + i)^−t. */
export const vt = (i: X | number, t: X | number): X => pow(onep(i), typeof t === "number" ? -t : mul(-1, t));
/** Accumulation factor (1 + i)^t. */
export const at = (i: X | number, t: X | number): X => pow(onep(i), t);
/** a(n) at i. */
export const an = (i: X | number, n: number | X): X => div(sub(1, vt(i, n)), i);
/** s(n) at i. */
export const sn = (i: X | number, n: number | X): X => div(sub(at(i, n), 1), i);
/** ä(n) at i. */
export const adue = (i: X | number, n: number | X): X => mul(an(i, n), onep(i));
/** PV at time 0 of 1, (1+g), …, (1+g)^{n−1} paid at times 1..n. */
export const geoA = (i: X | number, g: X | number, n: number): X => div(sub(1, pow(div(onep(g), onep(i)), n)), sub(i, g));
/** (Ia)(n) at i. */
export const ia = (i: X | number, n: number): X => div(sub(adue(i, n), mul(n, vt(i, n))), i);
/** (Da)(n) at i. */
export const da = (i: X | number, n: number): X => div(sub(n, an(i, n)), i);
/** Effective rate per period of length k from the effective rate i per unit: (1 + i)^k − 1. */
export const perK = (i: X | number, k: number | X): X => sub(at(i, k), 1);
/** Annual effective from a nominal rate convertible m times. */
export const fromNominal = (im: X | number, m: number): X => sub(pow(add(1, div(im, m)), m), 1);
/** Annual effective from a nominal discount rate convertible m times. */
export const fromNominalDiscount = (dm: X | number, m: number): X => sub(pow(sub(1, div(dm, m)), -m), 1);
/** Nominal rate convertible m times from the annual effective i. */
export const toNominal = (i: X | number, m: number): X => mul(m, sub(pow(onep(i), 1 / m), 1));

/** Term-by-term present value of explicit flows at the given rate (each flow written out). */
export const pvFlows = (flows: Array<{ t: number; amount: X | number }>, i: X | number): X => sum(flows.map((f) => mul(f.amount, vt(i, f.t))));

// ---------------------------------------------------------------- equations

/** An unknown defined by f(x) = 0, with a bracket that contains exactly one root. */
export interface Eq {
  eq: (x: X) => X;
  lo: number;
  hi: number;
}

export function rootOf(q: Eq): number {
  return bisect((t) => q.eq(sym(t)).v, q.lo, q.hi);
}

const isEq = (a: X | Eq): a is Eq => !(a instanceof X);

/** Value and expression of a quantity that is either computed directly or a root. */
function resolve(a: X | Eq): { value: number; expr: string } {
  if (!isEq(a)) return { value: a.v, expr: a.e };
  const value = rootOf(a);
  return { value, expr: a.eq(sym(value)).e };
}

// ---------------------------------------------------------------- draws and prose

export const pick = <T>(rng: Rng, xs: readonly T[]): T => rng.choice([...xs]);

const NAMES = ["Ana", "Bilal", "Chen", "Dara", "Elif", "Farid", "Grace", "Hiro", "Imani", "Jonas", "Kofi", "Lena", "Mateo", "Nadia", "Omar", "Priya", "Rosa", "Sven", "Tariq", "Uma", "Viktor", "Wen", "Yara", "Zane"] as const;
/** A person's name for a case narrative. Stems refer back by name, never by pronoun. */
export const nameOf = (rng: Rng): string => pick(rng, NAMES);
/** Two different names. */
export function twoNames(rng: Rng): [string, string] {
  const a = nameOf(rng);
  let b = nameOf(rng);
  for (let k = 0; b === a && k < 10; k += 1) b = nameOf(rng);
  return [a, b === a ? "Quinn" : b];
}

// ---------------------------------------------------------------- draft builder

export interface Trap {
  id: MisconceptionId;
  /** The flawed computation: a value, or an equation solved like the answer. */
  value: X | Eq;
  /** Plain words for the derivation label (no maths, no special characters). */
  label: string;
  method: string;
  feedback: string;
}

export interface EliteSpec {
  stem: string;
  fmt: AnswerFormat;
  answer: X | Eq;
  /** First-principles model: explicit cash flows, independent of the closed form. */
  model: X | Eq;
  modelDescription: string;
  traps: Trap[];
  steps: ChainStep[];
  methods: AlgebraMethod[];
  reasoning: string;
  intuition: string;
  unknowns: { symbol: string; meaning: string }[];
  relationships: string[];
  conditions: string[];
  valuationDate: string;
  modelChoice: string;
  assumptions: string[];
  alternative?: { name: string; body: string; whenUseful: string };
  principle: string;
  unusual: string;
  misread: string;
  presentation: Presentation[];
  features?: Partial<QuestionFeatures>;
  params: Record<string, number | string | boolean>;
  route: string;
  /** Deliberately unconventional presentation (default true for Elite). */
  unconventional?: boolean;
}

/**
 * Builds an Elite numerical draft. Traps whose flawed equation has no root
 * in the bracket are dropped (the validator then needs four of the rest).
 */
export function elite(s: EliteSpec): QuestionDraft {
  const answer = resolve(s.answer);
  const modelExpr = isEq(s.model) ? s.model.eq(sym(answer.value)).e : s.model.e;
  const bracket: [number, number] | undefined = isEq(s.model) ? [s.model.lo, s.model.hi] : undefined;
  const distractors: DistractorCandidate[] = [];
  for (const trap of s.traps) {
    try {
      const r = resolve(trap.value);
      if (!Number.isFinite(r.value)) continue;
      distractors.push({
        misconception: trap.id,
        value: r.value,
        calc: r.expr,
        derivation: `$\\text{${trap.label}} \\Rightarrow ${shown(r.value, s.fmt)}$`,
        method: trap.method,
        feedback: trap.feedback,
      });
    } catch {
      // No root for this flawed equation in the bracket: not a usable option.
    }
  }
  const steps = s.steps.map((st, k) => (k === s.steps.length - 1 ? { ...st, output: { ...st.output, value: answer.value } } : st));
  return compose({
    stem: s.stem,
    fmt: s.fmt,
    value: answer.value,
    calc: answer.expr,
    model: { expr: modelExpr, ...(bracket ? { bracket } : {}), description: s.modelDescription },
    distractors,
    steps,
    methods: s.methods,
    reasoning: s.reasoning,
    unconventional: s.unconventional ?? true,
    intuition: s.intuition,
    unknowns: s.unknowns,
    relationships: s.relationships,
    conditions: s.conditions,
    valuationDate: s.valuationDate,
    modelChoice: s.modelChoice,
    assumptions: s.assumptions,
    alternative: s.alternative,
    principle: s.principle,
    unusual: s.unusual,
    misread: s.misread,
    presentation: s.presentation,
    features: { multiConcept: true, unfamiliar: true, ...s.features },
    params: s.params,
    route: s.route,
  });
}

// ---------------------------------------------------------------- SOA-standard (level 1) builder

export interface StdSpec {
  stem: string;
  fmt: AnswerFormat;
  answer: X | Eq;
  model: X | Eq;
  modelDescription: string;
  traps: Trap[];
  steps: ChainStep[];
  methods: AlgebraMethod[];
  reasoning: string;
  intuition: string;
  unknown: [symbol: string, meaning: string];
  relationships: string[];
  valuationDate: string;
  principle: string;
  misread: string;
  presentation: Presentation[];
  params: Record<string, number | string | boolean>;
  route: string;
}

/**
 * A standard-level draft: the same validated pipeline as Elite questions, with
 * a conventional presentation and one or two connected formulas. Standard
 * templates offer several cases (a value, and inverse questions for a rate,
 * a term or a payment) so a template that returns asks for different steps.
 */
export function std(s: StdSpec): QuestionDraft {
  return elite({
    ...s,
    unknowns: [{ symbol: s.unknown[0], meaning: s.unknown[1] }],
    conditions: [],
    modelChoice: s.route,
    assumptions: ["Rates as stated; no other cash flows; no default."],
    unusual: "A standard SOA-style setting.",
    features: { multiConcept: false, unfamiliar: false },
    unconventional: false,
  });
}

/** Rounds a drawn rate to the grid used in stems. */
export const r4 = (x: number): number => Number(x.toFixed(4));

export { lit };
