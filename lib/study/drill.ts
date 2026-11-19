/**
 * Formula drill: "which of these is the formula?" — the correct form from the
 * reference sheets beside three near-misses of the kind memory actually
 * produces (i for d, n for n − t + 1, a for ä, a missing root, a flipped
 * ratio…). Each wrong form says what it really computes, if anything.
 *
 * Every item carries numerical evaluators at a sample point:
 *   - `reference` computes the quantity independently (cash flows summed one
 *     by one, a schedule simulated period by period, a rate found by
 *     bisection, a derivative by finite differences);
 *   - the correct form must match it, and every near-miss must differ from it.
 * `scripts/tests/study.test.ts` enforces both, so a near-miss can never be an
 * equivalent form of the right answer.
 */
import { Ia, Da, adue, an, sdue, sn, v } from "../engine/finance";
import type { FormulaArea } from "../formulas/types";
import type { TopicId } from "../syllabus";

type S = Record<string, number>;

export interface DrillForm {
  latex: string;
  /** Wrong forms: what goes wrong (and what the form actually computes). */
  why?: string;
  f: (s: S) => number;
}

export interface DrillItem {
  id: string;
  /** Formula library id the item drills. */
  formula: string;
  area: FormulaArea;
  topic: TopicId;
  /** What the formula must give (markup). */
  prompt: string;
  correct: DrillForm;
  wrong: [DrillForm, DrillForm, DrillForm];
  /** A short memory hook shown after answering (markup). */
  hook: string;
  sample: S;
  /** Independent computation of the quantity at the sample point. */
  reference: (s: S) => number;
  /** False for approximation formulas, whose reference is the approximation itself. */
  exact?: boolean;
}

// ---------------------------------------------------------------- independent helpers

/** Σ_{k=a}^{b} fn(k). */
const sum = (a: number, b: number, fn: (k: number) => number): number => {
  let total = 0;
  for (let k = a; k <= b; k += 1) total += fn(k);
  return total;
};

/** Root of a monotone function on [lo, hi] by bisection. */
const bisect = (fn: (x: number) => number, lo: number, hi: number): number => {
  let flo = fn(lo);
  for (let step = 0; step < 200; step += 1) {
    const mid = (lo + hi) / 2;
    const fm = fn(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
};

/** A level loan simulated payment by payment; returns the row for payment t. */
const loanRow = (L: number, i: number, P: number, t: number) => {
  let balance = L;
  let interest = 0;
  let principal = 0;
  for (let k = 1; k <= t; k += 1) {
    interest = balance * i;
    principal = P - interest;
    balance -= principal;
  }
  return { interest, principal, balance };
};

/** The level payment that clears the loan after n payments, found by simulation (balance is linear in P). */
const payFor = (L: number, i: number, n: number): number => {
  const b0 = loanRow(L, i, 0, n).balance;
  const b1 = loanRow(L, i, 1, n).balance;
  return b0 / (b0 - b1);
};

const bondFlows = (s: S) => [...Array.from({ length: s.n }, (_, k) => ({ t: k + 1, amount: s.F * s.r + (k + 1 === s.n ? s.C : 0) }))];
const pv = (flows: { t: number; amount: number }[], i: number) => flows.reduce((acc, f) => acc + f.amount * Math.pow(1 + i, -f.t), 0);

/** Book value after t coupons, by the recursion BV ← BV(1+i) − Fr from the price. */
const bookValue = (s: S, t: number) => {
  let bv = pv(bondFlows(s), s.i);
  for (let k = 1; k <= t; k += 1) bv = bv * (1 + s.i) - s.F * s.r;
  return bv;
};

/** Cash flows of a 6-year 5% annual-coupon bond, face 100 — used by the duration items. */
const DUR_FLOWS = [1, 2, 3, 4, 5, 6].map((t) => ({ t, amount: t === 6 ? 105 : 5 }));
const priceAt = (i: number) => pv(DUR_FLOWS, i);
const priceForce = (delta: number) => DUR_FLOWS.reduce((acc, f) => acc + f.amount * Math.exp(-delta * f.t), 0);
const H = 1e-5;
const macD = (i: number) => {
  const d = Math.log(1 + i);
  return -(priceForce(d + H) - priceForce(d - H)) / (2 * H) / priceForce(d);
};
const modD = (i: number) => -(priceAt(i + H) - priceAt(i - H)) / (2 * H) / priceAt(i);
const convex = (i: number) => {
  const h = 1e-4;
  return (priceAt(i + h) - 2 * priceAt(i) + priceAt(i - h)) / (h * h) / priceAt(i);
};
const macC = (i: number) => {
  const d = Math.log(1 + i);
  const h = 1e-4;
  return (priceForce(d + h) - 2 * priceForce(d) + priceForce(d - h)) / (h * h) / priceForce(d);
};
const durSums = (i: number) => ({
  tv: DUR_FLOWS.reduce((a, f) => a + f.t * f.amount * v(i, f.t), 0),
  tv1: DUR_FLOWS.reduce((a, f) => a + f.t * f.amount * v(i, f.t + 1), 0),
  t: DUR_FLOWS.reduce((a, f) => a + f.t * f.amount, 0),
  c: DUR_FLOWS.reduce((a, f) => a + f.amount, 0),
  t2v: DUR_FLOWS.reduce((a, f) => a + f.t * f.t * f.amount * v(i, f.t), 0),
  ttv2: DUR_FLOWS.reduce((a, f) => a + f.t * (f.t + 1) * f.amount * v(i, f.t + 2), 0),
  ttv: DUR_FLOWS.reduce((a, f) => a + f.t * (f.t + 1) * f.amount * v(i, f.t), 0),
  tmv2: DUR_FLOWS.reduce((a, f) => a + f.t * (f.t - 1) * f.amount * v(i, f.t + 2), 0),
  p: priceAt(i),
});

const AN = (n: string) => `a_{\\overline{${n}|}}`;
const ADN = (n: string) => `\\ddot a_{\\overline{${n}|}}`;
const SN = (n: string) => `s_{\\overline{${n}|}}`;
const SDN = (n: string) => `\\ddot s_{\\overline{${n}|}}`;

// ---------------------------------------------------------------- the bank

export const DRILL_ITEMS: DrillItem[] = [
  // ============================================================ A. Measurement of interest
  {
    id: "d-from-i",
    formula: "A.interest-discount",
    area: "A",
    topic: "TVM",
    prompt: "The effective rate of discount $d$ equivalent to the effective rate of interest $i$.",
    correct: { latex: "d = \\frac{i}{1+i}", f: (s) => s.i / (1 + s.i) },
    wrong: [
      { latex: "d = \\frac{i}{1-i}", why: "Turns $i = d/(1-d)$ round the wrong way. It is larger than $i$, but $d$ is always smaller than $i$.", f: (s) => s.i / (1 - s.i) },
      { latex: "d = \\frac{1}{1+i}", why: "That is $v$, the discount factor. The rate is $d = 1 - v$.", f: (s) => 1 / (1 + s.i) },
      { latex: "d = i(1+i)", why: "Accumulates the interest for a period instead of discounting it: $d = iv$, not $i(1+i)$.", f: (s) => s.i * (1 + s.i) },
    ],
    hook: "Discount is interest paid in advance, so it is interest discounted one period: $d = iv = i/(1+i)$.",
    sample: { i: 0.08 },
    reference: (s) => 1 - 1 / (1 + s.i),
  },
  {
    id: "i-from-d",
    formula: "A.interest-discount",
    area: "A",
    topic: "TVM",
    prompt: "The effective rate of interest $i$ equivalent to the effective rate of discount $d$.",
    correct: { latex: "i = \\frac{d}{1-d}", f: (s) => s.d / (1 - s.d) },
    wrong: [
      { latex: "i = \\frac{d}{1+d}", why: "Copies the pattern of $d = i/(1+i)$. It would make $i < d$.", f: (s) => s.d / (1 + s.d) },
      { latex: "i = \\frac{1}{1-d}", why: "That is $1 + i$, the accumulation factor, not the rate.", f: (s) => 1 / (1 - s.d) },
      { latex: "i = d(1-d)", why: "Discounts $d$ again instead of accumulating it.", f: (s) => s.d * (1 - s.d) },
    ],
    hook: "Borrow $1 - d$ now, repay 1 later: the interest $d$ over the amount lent $1 - d$.",
    sample: { d: 0.07 },
    reference: (s) => 1 / (1 - s.d) - 1,
  },
  {
    id: "nominal-interest",
    formula: "A.nominal-conversion",
    area: "A",
    topic: "TVM",
    prompt: "The nominal annual rate of interest convertible $m$ times a year, $i^{(m)}$, equivalent to the annual effective rate $i$.",
    correct: { latex: "i^{(m)} = m\\left[(1+i)^{1/m} - 1\\right]", f: (s) => s.m * (Math.pow(1 + s.i, 1 / s.m) - 1) },
    wrong: [
      { latex: "i^{(m)} = (1+i)^{1/m} - 1", why: "That is the effective rate per $m$-th of a year, $i^{(m)}/m$. The nominal rate is $m$ times it.", f: (s) => Math.pow(1 + s.i, 1 / s.m) - 1 },
      { latex: "i^{(m)} = \\frac{i}{m}", why: "Divides the annual rate as if there were no compounding inside the year.", f: (s) => s.i / s.m },
      { latex: "i^{(m)} = m\\left[(1+i)^{m} - 1\\right]", why: "Raises to the power $m$ instead of $1/m$: compounds $m$ years instead of splitting one.", f: (s) => s.m * (Math.pow(1 + s.i, s.m) - 1) },
    ],
    hook: "Start from $\\left(1 + \\frac{i^{(m)}}{m}\\right)^m = 1 + i$ and solve: take the $m$-th root, subtract 1, multiply by $m$.",
    sample: { i: 0.09, m: 4 },
    reference: (s) => bisect((x) => Math.pow(1 + x / s.m, s.m) - (1 + s.i), 0, 1),
  },
  {
    id: "nominal-discount",
    formula: "A.nominal-conversion",
    area: "A",
    topic: "TVM",
    prompt: "The nominal annual rate of discount convertible $m$ times a year, $d^{(m)}$, equivalent to the annual effective rate of discount $d$.",
    correct: { latex: "d^{(m)} = m\\left[1 - (1-d)^{1/m}\\right]", f: (s) => s.m * (1 - Math.pow(1 - s.d, 1 / s.m)) },
    wrong: [
      { latex: "d^{(m)} = m\\left[(1-d)^{-1/m} - 1\\right]", why: "$(1-d)^{-1/m} = (1+i)^{1/m}$, so this is $i^{(m)}$ — the nominal *interest* rate.", f: (s) => s.m * (Math.pow(1 - s.d, -1 / s.m) - 1) },
      { latex: "d^{(m)} = 1 - (1-d)^{1/m}", why: "The discount rate per $m$-th of a year, $d^{(m)}/m$; forgot to multiply by $m$.", f: (s) => 1 - Math.pow(1 - s.d, 1 / s.m) },
      { latex: "d^{(m)} = m\\left[1 - (1-d)^{m}\\right]", why: "Power $m$ instead of $1/m$.", f: (s) => s.m * (1 - Math.pow(1 - s.d, s.m)) },
    ],
    hook: "Start from $\\left(1 - \\frac{d^{(m)}}{m}\\right)^m = 1 - d$: the $m$-th root of $1 - d$, subtracted from 1, times $m$.",
    sample: { d: 0.06, m: 4 },
    reference: (s) => bisect((x) => Math.pow(1 - x / s.m, s.m) - (1 - s.d), 0, 1),
  },
  {
    id: "force-constant",
    formula: "A.constant-force",
    area: "A",
    topic: "TVM",
    prompt: "The constant force of interest $\\delta$ equivalent to the annual effective rate $i$.",
    correct: { latex: "\\delta = \\ln(1+i)", f: (s) => Math.log(1 + s.i) },
    wrong: [
      { latex: "\\delta = e^{i} - 1", why: "Inverts the relation: $i = e^{\\delta} - 1$, so $\\delta$ is the logarithm, not the exponential.", f: (s) => Math.exp(s.i) - 1 },
      { latex: "\\delta = \\ln(1-d)", why: "$\\ln(1-d) = \\ln v = -\\delta$: right size, wrong sign.", f: (s) => Math.log(1 - s.i / (1 + s.i)) },
      { latex: "\\delta = \\frac{i}{1+i}", why: "That is $d$. The force lies strictly between $d$ and $i$.", f: (s) => s.i / (1 + s.i) },
    ],
    hook: "$e^{\\delta} = 1 + i$: one year of continuous growth at force $\\delta$ equals one year at effective $i$.",
    sample: { i: 0.07 },
    reference: (s) => {
      const m = 1e7;
      return m * (Math.pow(1 + s.i, 1 / m) - 1);
    },
  },
  {
    id: "force-varying",
    formula: "A.force-accumulation",
    area: "A",
    topic: "TVM",
    prompt: "The factor that accumulates 1 from time $t_1$ to time $t_2$ under a varying force of interest $\\delta_t$.",
    // Sample force: δ_t = 0.02 + 0.01 t, from t1 = 1 to t2 = 3. ∫ = 0.02·2 + 0.005·(9 − 1) = 0.08.
    correct: { latex: "\\exp\\!\\left(\\int_{t_1}^{t_2}\\delta_t\\,dt\\right)", f: (s) => Math.exp(0.02 * (s.t2 - s.t1) + 0.005 * (s.t2 ** 2 - s.t1 ** 2)) },
    wrong: [
      { latex: "\\exp\\!\\left(-\\int_{t_1}^{t_2}\\delta_t\\,dt\\right)", why: "The minus sign discounts from $t_2$ back to $t_1$.", f: (s) => Math.exp(-(0.02 * (s.t2 - s.t1) + 0.005 * (s.t2 ** 2 - s.t1 ** 2))) },
      { latex: "1 + \\int_{t_1}^{t_2}\\delta_t\\,dt", why: "A simple-interest picture: it leaves out interest on interest.", f: (s) => 1 + 0.02 * (s.t2 - s.t1) + 0.005 * (s.t2 ** 2 - s.t1 ** 2) },
      { latex: "\\exp\\!\\big(\\delta_{t_2}(t_2 - t_1)\\big)", why: "Treats the force at the end date as if it held over the whole interval.", f: (s) => Math.exp((0.02 + 0.01 * s.t2) * (s.t2 - s.t1)) },
    ],
    hook: "Add up the instantaneous growth rates over the interval, then exponentiate. A negative exponent discounts.",
    sample: { t1: 1, t2: 3 },
    reference: (s) => {
      const steps = 20000;
      const h = (s.t2 - s.t1) / steps;
      return Math.exp(sum(0, steps - 1, (k) => (0.02 + 0.01 * (s.t1 + (k + 0.5) * h)) * h));
    },
  },
  {
    id: "simple-period-rate",
    formula: "A.simple",
    area: "A",
    topic: "TVM",
    prompt: "Under simple interest at rate $i$, the effective rate of interest in year $t$, $i_t$.",
    correct: { latex: "i_t = \\frac{i}{1 + i(t-1)}", f: (s) => s.i / (1 + s.i * (s.t - 1)) },
    wrong: [
      { latex: "i_t = \\frac{i}{1 + it}", why: "Divides by the balance at the *end* of year $t$; the effective rate uses the start.", f: (s) => s.i / (1 + s.i * s.t) },
      { latex: "i_t = i", why: "A constant effective rate is compound interest. Under simple interest the rate falls each year.", f: (s) => s.i },
      { latex: "i_t = \\frac{i}{1 - i(t-1)}", why: "Sign slip: the balance at the start of year $t$ is $1 + i(t-1)$.", f: (s) => s.i / (1 - s.i * (s.t - 1)) },
    ],
    hook: "Same interest $i$ every year, divided by a growing opening balance $1 + i(t-1)$, so the effective rate falls.",
    sample: { i: 0.05, t: 4 },
    reference: (s) => (1 + s.i * s.t - (1 + s.i * (s.t - 1))) / (1 + s.i * (s.t - 1)),
  },
  {
    id: "real-rate",
    formula: "F.real-rate",
    area: "F",
    topic: "TVM",
    prompt: "The real rate of interest $i'$, given the nominal rate $i$ and the inflation rate $r$.",
    correct: { latex: "i' = \\frac{i - r}{1 + r}", f: (s) => (s.i - s.r) / (1 + s.r) },
    wrong: [
      { latex: "i' = i - r", why: "The usual approximation. It ignores the cross term $i'r$ in $1 + i = (1 + i')(1 + r)$.", f: (s) => s.i - s.r },
      { latex: "i' = \\frac{i - r}{1 + i}", why: "Divides by the wrong growth factor: deflate by inflation, $1 + r$.", f: (s) => (s.i - s.r) / (1 + s.i) },
      { latex: "i' = (1+i)(1+r) - 1", why: "Multiplies the factors instead of dividing: adds inflation instead of removing it.", f: (s) => (1 + s.i) * (1 + s.r) - 1 },
    ],
    hook: "$1 + i = (1 + i')(1 + r)$: divide the money growth by the price growth.",
    sample: { i: 0.08, r: 0.03 },
    reference: (s) => (1 + s.i) / (1 + s.r) - 1,
  },

  // ============================================================ B. Annuities
  {
    id: "annuity-immediate",
    formula: "B.annuity-immediate",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value, one period before the first payment, of $n$ payments of 1 at the end of each period: $a_{\\overline{n|}}$.",
    correct: { latex: "\\frac{1 - v^n}{i}", f: (s) => an(s.n, s.i) },
    wrong: [
      { latex: "\\frac{1 - v^n}{d}", why: "Dividing by $d$ gives $\\ddot a_{\\overline{n|}}$ — payments at the *start* of each period.", f: (s) => adue(s.n, s.i) },
      { latex: "\\frac{1 - v^{n+1}}{i}", why: "Counts one payment too many.", f: (s) => an(s.n + 1, s.i) },
      { latex: "\\frac{(1+i)^n - 1}{i}", why: "That is $s_{\\overline{n|}}$, the value at the time of the last payment.", f: (s) => sn(s.n, s.i) },
    ],
    hook: "$a = (1 - v^n)/i$: “one minus the PV of the last-term factor, over the rate paid at the end”.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => v(s.i, k)),
  },
  {
    id: "annuity-due",
    formula: "B.annuity-due",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value, at the time of the first payment, of $n$ payments of 1 at the start of each period: $\\ddot a_{\\overline{n|}}$.",
    correct: { latex: "\\frac{1 - v^n}{d}", f: (s) => adue(s.n, s.i) },
    wrong: [
      { latex: "\\frac{1 - v^n}{i}", why: "That is $a_{\\overline{n|}}$ — one period too early a valuation date for an annuity-due.", f: (s) => an(s.n, s.i) },
      { latex: "\\frac{1 - v^{n-1}}{d}", why: "Drops a payment: $\\ddot a_{\\overline{n|}} = 1 + a_{\\overline{n-1|}}$, not $\\ddot a_{\\overline{n-1|}}$.", f: (s) => adue(s.n - 1, s.i) },
      { latex: `1 + ${AN("n")}`, why: "One payment too many: the identity is $1 + a_{\\overline{n-1|}}$.", f: (s) => 1 + an(s.n, s.i) },
    ],
    hook: "Due = immediate × $(1+i)$, and $(1 - v^n)/i \\times (1+i) = (1 - v^n)/d$: swap $i$ for $d$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(0, s.n - 1, (k) => v(s.i, k)),
  },
  {
    id: "annuity-av",
    formula: "B.annuity-immediate-av",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value, at the time of the last payment, of $n$ payments of 1 at the end of each period: $s_{\\overline{n|}}$.",
    correct: { latex: "\\frac{(1+i)^n - 1}{i}", f: (s) => sn(s.n, s.i) },
    wrong: [
      { latex: "\\frac{(1+i)^n - 1}{d}", why: "That is $\\ddot s_{\\overline{n|}}$, valued one period *after* the last payment.", f: (s) => sdue(s.n, s.i) },
      { latex: "\\frac{1 - v^n}{i}", why: "That is the present value $a_{\\overline{n|}}$.", f: (s) => an(s.n, s.i) },
      { latex: "\\frac{(1+i)^{n+1} - 1}{i}", why: "Counts one payment too many.", f: (s) => sn(s.n + 1, s.i) },
    ],
    hook: "$s = a(1+i)^n$: move the PV forward $n$ periods.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(0, s.n - 1, (k) => Math.pow(1 + s.i, k)),
  },
  {
    id: "annuity-due-av",
    formula: "B.annuity-due-av",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value, one period after the last payment, of $n$ payments of 1 at the start of each period: $\\ddot s_{\\overline{n|}}$.",
    correct: { latex: "\\frac{(1+i)^n - 1}{d}", f: (s) => sdue(s.n, s.i) },
    wrong: [
      { latex: "\\frac{(1+i)^n - 1}{i}", why: "That is $s_{\\overline{n|}}$, valued at the last payment.", f: (s) => sn(s.n, s.i) },
      { latex: SN("n+1"), why: "Forgot the $-1$: $\\ddot s_{\\overline{n|}} = s_{\\overline{n+1|}} - 1$ (there is no payment at the valuation date).", f: (s) => sn(s.n + 1, s.i) },
      { latex: "\\frac{(1+i)^{n-1} - 1}{d}", why: "Drops a payment.", f: (s) => sdue(s.n - 1, s.i) },
    ],
    hook: "Swap $i$ for $d$ again: $\\ddot s = s(1+i) = ((1+i)^n - 1)/d$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => Math.pow(1 + s.i, k)),
  },
  {
    id: "deferred",
    formula: "B.deferred",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value at time 0 of $n$ end-of-period payments of 1 deferred $m$ periods (first payment at time $m + 1$): ${}_{m|}a_{\\overline{n|}}$.",
    correct: { latex: `v^m ${AN("n")}`, f: (s) => v(s.i, s.m) * an(s.n, s.i) },
    wrong: [
      { latex: `v^{m+1} ${AN("n")}`, why: "Defers one period too many: $a_{\\overline{n|}}$ is already valued one period before its first payment.", f: (s) => v(s.i, s.m + 1) * an(s.n, s.i) },
      { latex: `${AN("m+n")} - ${AN("n")}`, why: "Removes the wrong block. The identity is $a_{\\overline{m+n|}} - a_{\\overline{m|}}$: take away the first $m$ payments.", f: (s) => an(s.m + s.n, s.i) - an(s.n, s.i) },
      { latex: `v^m ${ADN("n")}`, why: "That puts the first payment at time $m$, not $m + 1$.", f: (s) => v(s.i, s.m) * adue(s.n, s.i) },
    ],
    hook: "Value the annuity where it naturally sits (time $m$, one period before its first payment), then discount $m$ periods.",
    sample: { i: 0.05, n: 8, m: 3 },
    reference: (s) => sum(s.m + 1, s.m + s.n, (k) => v(s.i, k)),
  },
  {
    id: "perpetuity-due",
    formula: "B.perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value, at the first payment, of payments of 1 at the start of every period forever: $\\ddot a_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{d}", f: (s) => (1 + s.i) / s.i },
    wrong: [
      { latex: "\\frac{1}{i}", why: "That is the perpetuity-immediate $a_{\\overline{\\infty|}}$.", f: (s) => 1 / s.i },
      { latex: "\\frac{1}{\\delta}", why: "That is the continuous perpetuity $\\bar a_{\\overline{\\infty|}}$.", f: (s) => 1 / Math.log(1 + s.i) },
      { latex: "\\frac{1}{i} - 1", why: "Subtracts the first payment instead of adding it: $\\ddot a_{\\overline{\\infty|}} = 1 + 1/i$.", f: (s) => 1 / s.i - 1 },
    ],
    hook: "Immediate: $1/i$. Due: one extra payment now, $1 + 1/i = 1/d$.",
    sample: { i: 0.05 },
    reference: (s) => sum(0, 6000, (k) => v(s.i, k)),
  },
  {
    id: "mthly",
    formula: "B.mthly-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of $1/m$ paid at the end of every $m$-th of a year for $n$ years (1 a year in total): $a^{(m)}_{\\overline{n|}}$.",
    correct: { latex: "\\frac{1 - v^n}{i^{(m)}}", f: (s) => (1 - v(s.i, s.n)) / (s.m * (Math.pow(1 + s.i, 1 / s.m) - 1)) },
    wrong: [
      { latex: "\\frac{1 - v^n}{i}", why: "That is the annual annuity $a_{\\overline{n|}}$: payments once a year.", f: (s) => an(s.n, s.i) },
      { latex: "\\frac{1 - v^n}{d^{(m)}}", why: "That is $\\ddot a^{(m)}_{\\overline{n|}}$: payments at the start of each $m$-th.", f: (s) => (1 - v(s.i, s.n)) / (s.m * (1 - Math.pow(1 + s.i, -1 / s.m))) },
      { latex: "\\frac{1 - v^n}{i^{(m)}/m}", why: "Values payments of 1 each $m$-th (total $m$ a year), not $1/m$.", f: (s) => (1 - v(s.i, s.n)) / (Math.pow(1 + s.i, 1 / s.m) - 1) },
    ],
    hook: "Same numerator $1 - v^n$; the denominator is the rate that matches the payment timing: $i^{(m)}$ at the end, $d^{(m)}$ at the start.",
    sample: { i: 0.06, n: 5, m: 12 },
    reference: (s) => sum(1, s.m * s.n, (k) => (1 / s.m) * Math.pow(1 + s.i, -k / s.m)),
  },
  {
    id: "increasing",
    formula: "B.increasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, 2, \\dots, n$ at times $1, 2, \\dots, n$: $(Ia)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{${ADN("n")} - nv^n}{i}`, f: (s) => Ia(s.n, s.i) },
    wrong: [
      { latex: `\\frac{${AN("n")} - nv^n}{i}`, why: "The numerator needs $\\ddot a$, not $a$ — the most common slip with this formula.", f: (s) => (an(s.n, s.i) - s.n * v(s.i, s.n)) / s.i },
      { latex: `\\frac{${ADN("n")} - nv^n}{d}`, why: "Dividing by $d$ gives $(I\\ddot a)_{\\overline{n|}}$: payments at the start of each period.", f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n)) / (s.i / (1 + s.i)) },
      { latex: `\\frac{${SDN("n")} - n}{i}`, why: "That is $(Is)_{\\overline{n|}}$, the accumulated value at time $n$.", f: (s) => (sdue(s.n, s.i) - s.n) / s.i },
    ],
    hook: "“ä minus n v-to-the-n, over i.” The double dot sits in the numerator; the denominator says when payments fall.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => k * v(s.i, k)),
  },
  {
    id: "decreasing",
    formula: "B.decreasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $n, n-1, \\dots, 1$ at times $1, 2, \\dots, n$: $(Da)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{n - ${AN("n")}}{i}`, f: (s) => Da(s.n, s.i) },
    wrong: [
      { latex: `\\frac{n - ${ADN("n")}}{i}`, why: "The decreasing formula has a plain $a$ in the numerator (the increasing one has the $\\ddot a$).", f: (s) => (s.n - adue(s.n, s.i)) / s.i },
      { latex: `\\frac{n - ${AN("n")}}{d}`, why: "That is $(D\\ddot a)_{\\overline{n|}}$: payments at the start of each period.", f: (s) => (s.n - an(s.n, s.i)) / (s.i / (1 + s.i)) },
      { latex: `\\frac{n(1+i)^n - ${SN("n")}}{i}`, why: "That is $(Ds)_{\\overline{n|}}$, the value at time $n$.", f: (s) => (s.n * Math.pow(1 + s.i, s.n) - sn(s.n, s.i)) / s.i },
    ],
    hook: "Decreasing: “n minus a, over i”. Check at $n = 1$: $(1 - v)/i = v$. ✓",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => (s.n - k + 1) * v(s.i, k)),
  },
  {
    id: "increasing-av",
    formula: "B.increasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value at time $n$ of payments $1, 2, \\dots, n$ at times $1, 2, \\dots, n$: $(Is)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{${SDN("n")} - n}{i}`, f: (s) => (sdue(s.n, s.i) - s.n) / s.i },
    wrong: [
      { latex: `\\frac{${SN("n")} - n}{i}`, why: "Needs $\\ddot s$ in the numerator, as $(Ia)$ needs $\\ddot a$.", f: (s) => (sn(s.n, s.i) - s.n) / s.i },
      { latex: `\\frac{${SDN("n")} - n}{d}`, why: "That is $(I\\ddot s)_{\\overline{n|}}$: payments at the start of each period.", f: (s) => (sdue(s.n, s.i) - s.n) / (s.i / (1 + s.i)) },
      { latex: `\\frac{${ADN("n")} - nv^n}{i}`, why: "That is $(Ia)_{\\overline{n|}}$, the present value.", f: (s) => Ia(s.n, s.i) },
    ],
    hook: "$(Is) = (Ia)(1+i)^n$: multiply $\\ddot a - nv^n$ by $(1+i)^n$ and you get $\\ddot s - n$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => k * Math.pow(1 + s.i, s.n - k)),
  },
  {
    id: "increasing-perpetuity",
    formula: "B.increasing-perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, 2, 3, \\dots$ at times $1, 2, 3, \\dots$ forever: $(Ia)_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{id}", f: (s) => 1 / (s.i * (s.i / (1 + s.i))) },
    wrong: [
      { latex: "\\frac{1}{i^2}", why: "Misses one level perpetuity: $(Ia)_{\\overline{\\infty|}} = 1/i + 1/i^2$.", f: (s) => 1 / (s.i * s.i) },
      { latex: "\\frac{1}{d^2}", why: "That is $(I\\ddot a)_{\\overline{\\infty|}}$: payments at the start of each period.", f: (s) => 1 / Math.pow(s.i / (1 + s.i), 2) },
      { latex: "\\frac{1}{i}", why: "That is a level perpetuity of 1.", f: (s) => 1 / s.i },
    ],
    hook: "Let $n \\to \\infty$ in $(\\ddot a - nv^n)/i$: $nv^n \\to 0$ and $\\ddot a \\to 1/d$, so $1/(id)$.",
    sample: { i: 0.05 },
    reference: (s) => sum(1, 20000, (k) => k * v(s.i, k)),
  },
  {
    id: "geometric",
    formula: "B.geometric-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, (1+r), (1+r)^2, \\dots, (1+r)^{n-1}$ at times $1, 2, \\dots, n$ ($r \\ne i$).",
    correct: { latex: "\\frac{1 - \\left(\\frac{1+r}{1+i}\\right)^n}{i - r}", f: (s) => (1 - Math.pow((1 + s.r) / (1 + s.i), s.n)) / (s.i - s.r) },
    wrong: [
      { latex: "\\frac{1 - \\left(\\frac{1+r}{1+i}\\right)^n}{i + r}", why: "Growth works *against* discounting: the denominator is $i - r$.", f: (s) => (1 - Math.pow((1 + s.r) / (1 + s.i), s.n)) / (s.i + s.r) },
      { latex: "\\frac{1 - \\left(\\frac{1+i}{1+r}\\right)^n}{i - r}", why: "The ratio is upside down; each term is multiplied by $(1+r)/(1+i)$.", f: (s) => (1 - Math.pow((1 + s.i) / (1 + s.r), s.n)) / (s.i - s.r) },
      { latex: `${AN("n")}\\,\\text{at } j = \\frac{i - r}{1 + r}`, why: "Close — but the first payment is 1, not $1 + r$: the correct value is $a_{\\overline{n|}j}/(1 + r)$.", f: (s) => an(s.n, (s.i - s.r) / (1 + s.r)) },
    ],
    hook: "Geometric series with first term $v$ and ratio $(1+r)v$: $v\\,\\frac{1 - ((1+r)v)^n}{1 - (1+r)v}$ simplifies to $\\frac{1 - ((1+r)/(1+i))^n}{i - r}$.",
    sample: { i: 0.06, r: 0.03, n: 10 },
    reference: (s) => sum(1, s.n, (k) => Math.pow(1 + s.r, k - 1) * v(s.i, k)),
  },
  {
    id: "geometric-perpetuity",
    formula: "B.geometric-perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, (1+r), (1+r)^2, \\dots$ at times $1, 2, 3, \\dots$ forever ($r < i$).",
    correct: { latex: "\\frac{1}{i - r}", f: (s) => 1 / (s.i - s.r) },
    wrong: [
      { latex: "\\frac{1}{i + r}", why: "Growth raises the value: the denominator shrinks to $i - r$.", f: (s) => 1 / (s.i + s.r) },
      { latex: "\\frac{1 + r}{i - r}", why: "That would be the value if the first payment were $1 + r$.", f: (s) => (1 + s.r) / (s.i - s.r) },
      { latex: "\\frac{1 + i}{i - r}", why: "That is the growing perpetuity-*due* (first payment now).", f: (s) => (1 + s.i) / (s.i - s.r) },
    ],
    hook: "First payment over (rate minus growth). Finite only when $r < i$.",
    sample: { i: 0.06, r: 0.03 },
    reference: (s) => sum(1, 20000, (k) => Math.pow(1 + s.r, k - 1) * v(s.i, k)),
  },
  {
    id: "a2n-trick",
    formula: "B.grouping",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The ratio $a_{\\overline{2n|}} / a_{\\overline{n|}}$.",
    correct: { latex: "1 + v^n", f: (s) => 1 + v(s.i, s.n) },
    wrong: [
      { latex: "1 + (1+i)^n", why: "The second block of $n$ payments is *discounted* $n$ periods, not accumulated.", f: (s) => 1 + Math.pow(1 + s.i, s.n) },
      { latex: "2v^n", why: "The first block is worth $a_{\\overline{n|}}$ itself (factor 1), not $v^n a_{\\overline{n|}}$.", f: (s) => 2 * v(s.i, s.n) },
      { latex: "1 + v^{2n}", why: "The second block starts $n$ periods later, so it is discounted by $v^n$.", f: (s) => 1 + v(s.i, 2 * s.n) },
    ],
    hook: "$a_{\\overline{2n|}} = a_{\\overline{n|}} + v^n a_{\\overline{n|}}$: the first $n$ payments, plus the next $n$ moved back $n$ periods.",
    sample: { i: 0.05, n: 6 },
    reference: (s) => sum(1, 2 * s.n, (k) => v(s.i, k)) / sum(1, s.n, (k) => v(s.i, k)),
  },
  {
    id: "fission",
    formula: "B.fission",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of 1 paid at the end of every $k$ years for $N$ years ($N$ a multiple of $k$; first payment at time $k$).",
    correct: { latex: `\\frac{${AN("N")}}{${SN("k")}}`, f: (s) => an(s.N, s.i) / sn(s.k, s.i) },
    wrong: [
      { latex: `\\frac{${AN("N")}}{${AN("k")}}`, why: "Dividing by $a_{\\overline{k|}}$ values payments at times $0, k, \\dots, N - k$ — each one a block too early.", f: (s) => an(s.N, s.i) / an(s.k, s.i) },
      { latex: `\\frac{${AN("N")}}{k}`, why: "Splits each payment evenly over $k$ years, ignoring interest within the block.", f: (s) => an(s.N, s.i) / s.k },
      { latex: `\\frac{${SN("N")}}{${SN("k")}}`, why: "That is the accumulated value at time $N$.", f: (s) => sn(s.N, s.i) / sn(s.k, s.i) },
    ],
    hook: "Replace each payment of 1 at the end of a $k$-year block by $1/s_{\\overline{k|}}$ a year (the sinking-fund deposit), then value that annual annuity.",
    sample: { i: 0.05, N: 20, k: 4 },
    reference: (s) => sum(1, s.N / s.k, (j) => v(s.i, j * s.k)),
  },

  // ============================================================ C. Yield rates
  {
    id: "reinvest-single",
    formula: "C.reinvestment",
    area: "C",
    topic: "BONDS",
    prompt: "1 is deposited for $n$ years. Interest at rate $i$ is paid at the end of each year and reinvested at rate $j$. The total accumulated value at time $n$.",
    correct: { latex: `1 + i\\,${SN("n")}\\,\\text{at } j`, f: (s) => 1 + s.i * sn(s.n, s.j) },
    wrong: [
      { latex: "(1+i)^n", why: "Assumes the interest is reinvested at $i$ itself.", f: (s) => Math.pow(1 + s.i, s.n) },
      { latex: "(1+j)^n", why: "Grows the whole deposit at the reinvestment rate; the principal earns $i$, paid out as cash.", f: (s) => Math.pow(1 + s.j, s.n) },
      { latex: `1 + i\\,${AN("n")}\\,\\text{at } j`, why: "Discounts the interest payments; they must be *accumulated* to time $n$.", f: (s) => 1 + s.i * an(s.n, s.j) },
    ],
    hook: "Principal back (1) plus the interest payments $i, i, \\dots, i$ accumulated at the reinvestment rate.",
    sample: { i: 0.07, j: 0.04, n: 10 },
    reference: (s) => {
      let fund = 0;
      for (let k = 1; k <= s.n; k += 1) fund = fund * (1 + s.j) + s.i;
      return 1 + fund;
    },
  },
  {
    id: "reinvest-level",
    formula: "C.reinvestment",
    area: "C",
    topic: "BONDS",
    prompt: "1 is deposited at the start of each year for $n$ years. Interest at rate $i$ is paid at the end of each year and reinvested at rate $j$. The total accumulated value at time $n$.",
    correct: { latex: "n + i\\,(Is)_{\\overline{n|}}\\,\\text{at } j", f: (s) => s.n + s.i * (sdue(s.n, s.j) - s.n) / s.j },
    wrong: [
      { latex: "n + i\\,(Ia)_{\\overline{n|}}\\,\\text{at } j", why: "The interest payments $i, 2i, \\dots, ni$ must be accumulated to time $n$, not discounted.", f: (s) => s.n + s.i * Ia(s.n, s.j) },
      { latex: `${SDN("n")}\\,\\text{at } i`, why: "Assumes everything grows at $i$ — ignores the reinvestment rate.", f: (s) => sdue(s.n, s.i) },
      { latex: "n + j\\,(Is)_{\\overline{n|}}\\,\\text{at } i", why: "Swaps the two rates: interest is *earned* at $i$ and *reinvested* at $j$.", f: (s) => s.n + s.j * (sdue(s.n, s.i) - s.n) / s.i },
    ],
    hook: "Deposits return as $n$; interest grows $i, 2i, \\dots, ni$ (an increasing annuity) and accumulates at $j$.",
    sample: { i: 0.07, j: 0.04, n: 10 },
    reference: (s) => {
      let principal = 0;
      let fund = 0;
      for (let k = 1; k <= s.n; k += 1) {
        principal += 1;
        fund = fund * (1 + s.j) + s.i * principal;
      }
      return principal + fund;
    },
  },

  // ============================================================ D. Amortization
  {
    id: "loan-payment",
    formula: "D.loan-payment",
    area: "D",
    topic: "LOANS",
    prompt: "The level end-of-period payment $P$ that repays a loan $L$ in $n$ periods at rate $i$.",
    correct: { latex: `P = \\frac{L}{${AN("n")}}`, f: (s) => s.L / an(s.n, s.i) },
    wrong: [
      { latex: `P = \\frac{L}{${ADN("n")}}`, why: "That is the payment if payments start immediately (annuity-due).", f: (s) => s.L / adue(s.n, s.i) },
      { latex: `P = \\frac{L}{${SN("n")}}`, why: "That is a sinking-fund deposit that accumulates to $L$ — it does not pay the interest.", f: (s) => s.L / sn(s.n, s.i) },
      { latex: "P = \\frac{L(1+i)^n}{n}", why: "Ignores the interest saved as the balance is paid down.", f: (s) => (s.L * Math.pow(1 + s.i, s.n)) / s.n },
    ],
    hook: "Loan = PV of the payments: $L = P\\,a_{\\overline{n|}}$.",
    sample: { L: 10000, i: 0.06, n: 12 },
    reference: (s) => payFor(s.L, s.i, s.n),
  },
  {
    id: "balance-prospective",
    formula: "D.prospective",
    area: "D",
    topic: "LOANS",
    prompt: "A loan is repaid by $n$ level payments $P$. The outstanding balance just after payment $t$ (prospective form).",
    correct: { latex: `P\\,${AN("n-t")}`, f: (s) => s.P * an(s.n - s.t, s.i) },
    wrong: [
      { latex: `P\\,${AN("n-t+1")}`, why: "Includes the payment just made; after payment $t$ only $n - t$ remain.", f: (s) => s.P * an(s.n - s.t + 1, s.i) },
      { latex: `P\\,${AN("t")}`, why: "Values the payments already *made* instead of those remaining.", f: (s) => s.P * an(s.t, s.i) },
      { latex: `L - P\\,${AN("t")}`, why: "That is the balance valued at time 0 ($v^t B_t$) — it was never moved to time $t$.", f: (s) => s.L - s.P * an(s.t, s.i) },
    ],
    hook: "Prospective = look forward: PV of the payments still to come.",
    sample: { L: 10000, i: 0.06, n: 12, t: 5, P: 10000 / an(12, 0.06) },
    reference: (s) => loanRow(s.L, s.i, s.P, s.t).balance,
  },
  {
    id: "balance-retrospective",
    formula: "D.retrospective",
    area: "D",
    topic: "LOANS",
    prompt: "A loan $L$ is repaid by level payments $P$. The outstanding balance just after payment $t$ (retrospective form).",
    correct: { latex: `L(1+i)^t - P\\,${SN("t")}`, f: (s) => s.L * Math.pow(1 + s.i, s.t) - s.P * sn(s.t, s.i) },
    wrong: [
      { latex: `L(1+i)^t - P\\,${SDN("t")}`, why: "Accumulates the payments one period too far; the latest payment is made at time $t$ itself.", f: (s) => s.L * Math.pow(1 + s.i, s.t) - s.P * sdue(s.t, s.i) },
      { latex: `L - P\\,${SN("t")}`, why: "Forgot to accumulate the loan to time $t$.", f: (s) => s.L - s.P * sn(s.t, s.i) },
      { latex: `L(1+i)^t - P\\,${AN("t")}`, why: "Mixes dates: the payments must be valued at time $t$ ($s$), not time 0 ($a$).", f: (s) => s.L * Math.pow(1 + s.i, s.t) - s.P * an(s.t, s.i) },
    ],
    hook: "Retrospective = look back: what was borrowed, grown to now, minus what was paid, grown to now.",
    sample: { L: 10000, i: 0.06, n: 12, t: 5, P: 10000 / an(12, 0.06) },
    reference: (s) => loanRow(s.L, s.i, s.P, s.t).balance,
  },
  {
    id: "principal-part",
    formula: "D.principal-component",
    area: "D",
    topic: "LOANS",
    prompt: "In a loan repaid by $n$ level payments $P$, the principal repaid in payment $t$.",
    correct: { latex: "P\\,v^{n-t+1}", f: (s) => s.P * v(s.i, s.n - s.t + 1) },
    wrong: [
      { latex: "P\\,v^{n-t}", why: "Off by one: payment $t$ is $n - t + 1$ payments from the end (payment $n$ has $Pv$).", f: (s) => s.P * v(s.i, s.n - s.t) },
      { latex: "P\\,v^{t}", why: "Counts from the start instead of from the end.", f: (s) => s.P * v(s.i, s.t) },
      { latex: "P\\left(1 - v^{n-t+1}\\right)", why: "That is the *interest* in payment $t$.", f: (s) => s.P * (1 - v(s.i, s.n - s.t + 1)) },
    ],
    hook: "Count backwards from the last payment, whose principal is $Pv$: payment $t$ has $Pv^{n-t+1}$. Check $t = n$: $Pv$. ✓",
    sample: { L: 10000, i: 0.06, n: 12, t: 5, P: 10000 / an(12, 0.06) },
    reference: (s) => loanRow(s.L, s.i, s.P, s.t).principal,
  },
  {
    id: "interest-part",
    formula: "D.interest-component",
    area: "D",
    topic: "LOANS",
    prompt: "In a loan repaid by $n$ level payments $P$, the interest paid in payment $t$.",
    correct: { latex: "P\\left(1 - v^{n-t+1}\\right)", f: (s) => s.P * (1 - v(s.i, s.n - s.t + 1)) },
    wrong: [
      { latex: "P\\left(1 - v^{n-t}\\right)", why: "That is the interest in payment $t + 1$.", f: (s) => s.P * (1 - v(s.i, s.n - s.t)) },
      { latex: "P\\,v^{n-t+1}", why: "That is the *principal* in payment $t$.", f: (s) => s.P * v(s.i, s.n - s.t + 1) },
      { latex: "iL", why: "The interest in the *first* payment only; later payments pay interest on a smaller balance.", f: (s) => s.i * s.L },
    ],
    hook: "Interest = $i \\times$ balance before the payment $= i\\,P a_{\\overline{n-t+1|}} = P(1 - v^{n-t+1})$.",
    sample: { L: 10000, i: 0.06, n: 12, t: 5, P: 10000 / an(12, 0.06) },
    reference: (s) => loanRow(s.L, s.i, s.P, s.t).interest,
  },
  {
    id: "total-interest",
    formula: "D.total-interest",
    area: "D",
    topic: "LOANS",
    prompt: "The total interest paid over the life of a loan $L$ repaid by $n$ level payments $P$.",
    correct: { latex: "nP - L", f: (s) => s.n * s.P - s.L },
    wrong: [
      { latex: "nP", why: "That is the total of all payments, principal included.", f: (s) => s.n * s.P },
      { latex: "n\\,i\\,L", why: "Charges interest on the full loan every period, as if nothing were repaid.", f: (s) => s.n * s.i * s.L },
      { latex: "(n-1)P - L", why: "Leaves out one payment.", f: (s) => (s.n - 1) * s.P - s.L },
    ],
    hook: "Everything paid, minus the principal (which totals $L$).",
    sample: { L: 10000, i: 0.06, n: 12, P: 10000 / an(12, 0.06) },
    reference: (s) => sum(1, s.n, (t) => loanRow(s.L, s.i, s.P, t).interest),
  },

  // ============================================================ E. Bonds
  {
    id: "bond-price",
    formula: "E.price",
    area: "E",
    topic: "BONDS",
    prompt: "The price of a bond with face $F$, coupon rate $r$ per period, redemption value $C$ and $n$ coupons remaining, at yield $i$ per period.",
    correct: { latex: `Fr\\,${AN("n")} + Cv^n`, f: (s) => s.F * s.r * an(s.n, s.i) + s.C * v(s.i, s.n) },
    wrong: [
      { latex: `Fr\\,${AN("n")} + Fv^n`, why: "Redeems at face. The bond pays $C$ at maturity (here $C \\ne F$).", f: (s) => s.F * s.r * an(s.n, s.i) + s.F * v(s.i, s.n) },
      { latex: `Fr\\,${ADN("n")} + Cv^n`, why: "Coupons are paid at the end of each period, not the start.", f: (s) => s.F * s.r * adue(s.n, s.i) + s.C * v(s.i, s.n) },
      { latex: `Ci\\,${AN("n")} + Cv^n`, why: "Uses the yield to set the coupon. That always gives $C$ — the price only of a bond whose coupon equals $Ci$.", f: (s) => s.C * s.i * an(s.n, s.i) + s.C * v(s.i, s.n) },
    ],
    hook: "Coupons $Fr$ (face × coupon rate) as an annuity, plus the redemption $C$ discounted, all at the yield.",
    sample: { F: 1000, C: 1050, r: 0.05, i: 0.04, n: 10 },
    reference: (s) => pv(bondFlows(s), s.i),
  },
  {
    id: "bond-premium-discount",
    formula: "E.premium-discount",
    area: "E",
    topic: "BONDS",
    prompt: "The premium/discount formula for the bond price.",
    correct: { latex: `C + (Fr - Ci)\\,${AN("n")}`, f: (s) => s.C + (s.F * s.r - s.C * s.i) * an(s.n, s.i) },
    wrong: [
      { latex: `C + (Ci - Fr)\\,${AN("n")}`, why: "Sign reversed: a coupon above $Ci$ makes the price *exceed* $C$.", f: (s) => s.C + (s.C * s.i - s.F * s.r) * an(s.n, s.i) },
      { latex: `F + (Fr - Ci)\\,${AN("n")}`, why: "The base is the redemption value $C$, not the face $F$.", f: (s) => s.F + (s.F * s.r - s.C * s.i) * an(s.n, s.i) },
      { latex: "C + (Fr - Ci)\\,v^n", why: "The coupon excess is paid every period, so it is an annuity, not a single payment.", f: (s) => s.C + (s.F * s.r - s.C * s.i) * v(s.i, s.n) },
    ],
    hook: "Price = $C$ + PV of how much each coupon beats the yield on $C$.",
    sample: { F: 1000, C: 1050, r: 0.05, i: 0.04, n: 10 },
    reference: (s) => pv(bondFlows(s), s.i),
  },
  {
    id: "makeham",
    formula: "E.makeham",
    area: "E",
    topic: "BONDS",
    prompt: "Makeham's formula for the bond price, with $K = Cv^n$ and modified coupon rate $g = Fr/C$.",
    correct: { latex: "K + \\frac{g}{i}(C - K)", f: (s) => s.C * v(s.i, s.n) + ((s.F * s.r) / s.C / s.i) * (s.C - s.C * v(s.i, s.n)) },
    wrong: [
      { latex: "K + \\frac{i}{g}(C - K)", why: "The ratio is upside down: $g/i$.", f: (s) => s.C * v(s.i, s.n) + (s.i / ((s.F * s.r) / s.C)) * (s.C - s.C * v(s.i, s.n)) },
      { latex: "K + \\frac{r}{i}(C - K)", why: "Uses the coupon rate on face, $r$; Makeham needs $g$, the coupon per unit of *redemption* value.", f: (s) => s.C * v(s.i, s.n) + (s.r / s.i) * (s.C - s.C * v(s.i, s.n)) },
      { latex: "C + \\frac{g}{i}(C - K)", why: "Starts from $C$ instead of $K$, the PV of the redemption.", f: (s) => s.C + ((s.F * s.r) / s.C / s.i) * (s.C - s.C * v(s.i, s.n)) },
    ],
    hook: "$C - K = C(1 - v^n) = Ci\\,a_{\\overline{n|}}$, so $\\frac{g}{i}(C - K) = Cg\\,a_{\\overline{n|}}$: the coupons. (TIA's changelog fixed a misprint here — $q$ for $g$.)",
    sample: { F: 1000, C: 1050, r: 0.05, i: 0.04, n: 10 },
    reference: (s) => pv(bondFlows(s), s.i),
  },
  {
    id: "book-value",
    formula: "E.book-value",
    area: "E",
    topic: "BONDS",
    prompt: "The book value of a bond just after the $t$-th coupon ($n$ coupons in total), at the purchase yield $i$.",
    correct: { latex: `Fr\\,${AN("n-t")} + Cv^{n-t}`, f: (s) => s.F * s.r * an(s.n - s.t, s.i) + s.C * v(s.i, s.n - s.t) },
    wrong: [
      { latex: `Fr\\,${AN("t")} + Cv^{t}`, why: "Values the coupons already received instead of those remaining.", f: (s) => s.F * s.r * an(s.t, s.i) + s.C * v(s.i, s.t) },
      { latex: `Fr\\,${AN("n-t+1")} + Cv^{n-t+1}`, why: "Includes the coupon just paid.", f: (s) => s.F * s.r * an(s.n - s.t + 1, s.i) + s.C * v(s.i, s.n - s.t + 1) },
      { latex: `P(1+i)^t - Fr\\,${AN("t")}`, why: "The retrospective form subtracts the coupons *accumulated* to time $t$: $Fr\\,s_{\\overline{t|}}$.", f: (s) => pv(bondFlows(s), s.i) * Math.pow(1 + s.i, s.t) - s.F * s.r * an(s.t, s.i) },
    ],
    hook: "Book value = the price of the remaining bond at the original yield.",
    sample: { F: 1000, C: 1050, r: 0.05, i: 0.04, n: 10, t: 4 },
    reference: (s) => bookValue(s, s.t),
  },
  {
    id: "write-down",
    formula: "E.bond-amortization",
    area: "E",
    topic: "BONDS",
    prompt: "For a bond bought at a premium ($Fr > Ci$), the amount of premium written down in coupon $t$.",
    correct: { latex: "(Fr - Ci)\\,v^{n-t+1}", f: (s) => (s.F * s.r - s.C * s.i) * v(s.i, s.n - s.t + 1) },
    wrong: [
      { latex: "(Fr - Ci)\\,v^{n-t}", why: "Off by one, exactly as for loan principal: coupon $n$ writes down $(Fr - Ci)v$.", f: (s) => (s.F * s.r - s.C * s.i) * v(s.i, s.n - s.t) },
      { latex: "(Fr - Ci)\\,v^{t}", why: "Counts from the start instead of the end; write-downs *grow* over time.", f: (s) => (s.F * s.r - s.C * s.i) * v(s.i, s.t) },
      { latex: "Fr - Ci", why: "Writes down the same amount every period (straight-line); the actuarial method discounts it.", f: (s) => s.F * s.r - s.C * s.i },
    ],
    hook: "A bond is a loan: the write-down is the “principal” part of the coupon, $Fr - i\\,BV_{t-1}$.",
    sample: { F: 1000, C: 1050, r: 0.05, i: 0.04, n: 10, t: 4 },
    reference: (s) => bookValue(s, s.t - 1) - bookValue(s, s.t),
  },

  // ============================================================ F. Term structure
  {
    id: "forward-1",
    formula: "F.forward",
    area: "F",
    topic: "ALM",
    prompt: "The one-year forward rate from time $t$ to $t + 1$, $f_{t,t+1}$, from the spot rates $s_t$ and $s_{t+1}$.",
    correct: { latex: "\\frac{(1+s_{t+1})^{t+1}}{(1+s_t)^t} - 1", f: (s) => Math.pow(1 + s.sb, s.t + 1) / Math.pow(1 + s.sa, s.t) - 1 },
    wrong: [
      { latex: "s_{t+1} - s_t", why: "Rates do not subtract; accumulation factors divide.", f: (s) => s.sb - s.sa },
      { latex: "\\frac{1 + s_{t+1}}{1 + s_t} - 1", why: "Forgot the powers: $s_t$ is an annual rate over $t$ years.", f: (s) => (1 + s.sb) / (1 + s.sa) - 1 },
      { latex: "\\frac{(1+s_{t+1})^{t+1}}{(1+s_t)^{t+1}} - 1", why: "The first $t$ years accumulate at $s_t$ for $t$ years, not $t + 1$.", f: (s) => Math.pow(1 + s.sb, s.t + 1) / Math.pow(1 + s.sa, s.t + 1) - 1 },
    ],
    hook: "$(1+s_t)^t(1+f_{t,t+1}) = (1+s_{t+1})^{t+1}$: grow to $t$, then one more year, equals growing straight to $t + 1$.",
    sample: { t: 2, sa: 0.04, sb: 0.047 },
    reference: (s) => {
      const Pa = Math.pow(1 + s.sa, -s.t);
      const Pb = Math.pow(1 + s.sb, -(s.t + 1));
      return Pa / Pb - 1;
    },
  },
  {
    id: "forward-m",
    formula: "F.forward",
    area: "F",
    topic: "ALM",
    prompt: "The annual effective $m$-year forward rate from time $t$, $f_{t,t+m}$.",
    correct: { latex: "\\left[\\frac{(1+s_{t+m})^{t+m}}{(1+s_t)^t}\\right]^{1/m} - 1", f: (s) => Math.pow(Math.pow(1 + s.sb, s.t + s.m) / Math.pow(1 + s.sa, s.t), 1 / s.m) - 1 },
    wrong: [
      { latex: "\\frac{(1+s_{t+m})^{t+m}}{(1+s_t)^t} - 1", why: "That is the total growth over the $m$ years; take the $m$-th root for an annual rate.", f: (s) => Math.pow(1 + s.sb, s.t + s.m) / Math.pow(1 + s.sa, s.t) - 1 },
      { latex: "\\left[\\frac{(1+s_{t+m})^{t+m}}{(1+s_t)^t}\\right]^{1/(t+m)} - 1", why: "The forward period lasts $m$ years, not $t + m$.", f: (s) => Math.pow(Math.pow(1 + s.sb, s.t + s.m) / Math.pow(1 + s.sa, s.t), 1 / (s.t + s.m)) - 1 },
      { latex: "\\frac{(t+m)\\,s_{t+m} - t\\,s_t}{m}", why: "An arithmetic approximation; rates compound, so the exact answer uses factors.", f: (s) => ((s.t + s.m) * s.sb - s.t * s.sa) / s.m },
    ],
    hook: "Divide the long accumulation factor by the short one, then take the $m$-th root.",
    sample: { t: 2, m: 2, sa: 0.02, sb: 0.06 },
    reference: (s) => bisect((x) => Math.pow(1 + s.sa, s.t) * Math.pow(1 + x, s.m) - Math.pow(1 + s.sb, s.t + s.m), 0, 1),
  },
  {
    id: "spot-from-zero",
    formula: "F.spot",
    area: "F",
    topic: "ALM",
    prompt: "The $t$-year spot rate $s_t$ from the price $P_t$ of a zero-coupon bond paying 1 at time $t$.",
    correct: { latex: "s_t = P_t^{-1/t} - 1", f: (s) => Math.pow(s.P, -1 / s.t) - 1 },
    wrong: [
      { latex: "s_t = \\frac{1}{P_t} - 1", why: "That is the total return over $t$ years, not an annual rate.", f: (s) => 1 / s.P - 1 },
      { latex: "s_t = P_t^{-t} - 1", why: "Power $-t$ instead of $-1/t$.", f: (s) => Math.pow(s.P, -s.t) - 1 },
      { latex: "s_t = \\frac{1 - P_t}{t}", why: "A simple-discount picture; spot rates are annual effective, compounded.", f: (s) => (1 - s.P) / s.t },
    ],
    hook: "$P_t = (1 + s_t)^{-t}$, solved for $s_t$.",
    sample: { P: 0.82, t: 4 },
    reference: (s) => bisect((x) => Math.pow(1 + x, -s.t) - s.P, 0, 1),
  },

  // ============================================================ G. Duration, convexity, immunization
  {
    id: "macaulay",
    formula: "G.macaulay",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of cash flows $CF_t$ at yield $i$ (annual effective, $v = 1/(1+i)$).",
    correct: { latex: "\\frac{\\sum t\\,CF_t\\,v^t}{\\sum CF_t\\,v^t}", f: (s) => durSums(s.i).tv / durSums(s.i).p },
    wrong: [
      { latex: "\\frac{\\sum t\\,CF_t\\,v^{t+1}}{\\sum CF_t\\,v^t}", why: "The extra $v$ makes it the *modified* duration.", f: (s) => durSums(s.i).tv1 / durSums(s.i).p },
      { latex: "\\frac{\\sum t\\,CF_t}{\\sum CF_t}", why: "Undiscounted: weights by amounts, not present values.", f: (s) => durSums(s.i).t / durSums(s.i).c },
      { latex: "\\frac{\\sum t^2\\,CF_t\\,v^t}{\\sum CF_t\\,v^t}", why: "That is the Macaulay *convexity*.", f: (s) => durSums(s.i).t2v / durSums(s.i).p },
    ],
    hook: "A weighted average of payment times, the weights being each cash flow's share of the price.",
    sample: { i: 0.07 },
    reference: (s) => macD(s.i),
  },
  {
    id: "modified",
    formula: "G.modified",
    area: "G",
    topic: "ALM",
    prompt: "Modified duration from Macaulay duration, at annual effective yield $i$.",
    correct: { latex: "D_{mod} = \\frac{D_{mac}}{1+i}", f: (s) => macD(s.i) / (1 + s.i) },
    wrong: [
      { latex: "D_{mod} = D_{mac}(1+i)", why: "Modified duration is the *smaller* one: multiply by $v$.", f: (s) => macD(s.i) * (1 + s.i) },
      { latex: "D_{mod} = \\frac{D_{mac}}{(1+i)^2}", why: "The square belongs to the convexity relation, $C = (C_{mac} + D_{mac})/(1+i)^2$.", f: (s) => macD(s.i) / Math.pow(1 + s.i, 2) },
      { latex: "D_{mod} = \\frac{D_{mac}}{1+\\delta}", why: "Divide by $1 + i$, the one-period growth factor, not $1 + \\delta$.", f: (s) => macD(s.i) / (1 + Math.log(1 + s.i)) },
    ],
    hook: "$D_{mod} = v\\,D_{mac}$. With $m$ coupons a year, $v$ is the discount factor for one coupon period.",
    sample: { i: 0.07 },
    reference: (s) => modD(s.i),
  },
  {
    id: "duration-perpetuity",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of a level perpetuity-immediate at yield $i$.",
    correct: { latex: "\\frac{1+i}{i}", f: (s) => (1 + s.i) / s.i },
    wrong: [
      { latex: "\\frac{1}{i}", why: "That is the *modified* duration of the perpetuity ($v \\times (1+i)/i$).", f: (s) => 1 / s.i },
      { latex: "\\frac{1}{i^2}", why: "Not a duration: $(1/i^2)$ is part of $(Ia)_{\\overline{\\infty|}}$, which must be divided by the price $1/i$.", f: (s) => 1 / (s.i * s.i) },
      { latex: "\\frac{1}{\\delta}", why: "That is the duration of a *continuous* perpetuity.", f: (s) => 1 / Math.log(1 + s.i) },
    ],
    hook: "$D = (Ia)_{\\overline{\\infty|}}/a_{\\overline{\\infty|}} = \\frac{1/(id)}{1/i} = 1/d = (1+i)/i$ — finite even though the payments never end.",
    sample: { i: 0.05 },
    reference: (s) => sum(1, 20000, (k) => k * v(s.i, k)) / sum(1, 20000, (k) => v(s.i, k)),
  },
  {
    id: "duration-par-bond",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of an $n$-year par bond with annual coupons, at its yield $i$.",
    correct: { latex: ADN("n"), f: (s) => adue(s.n, s.i) },
    wrong: [
      { latex: AN("n"), why: "One period short: the par-bond duration is the annuity-*due* factor.", f: (s) => an(s.n, s.i) },
      { latex: "n", why: "That is the duration of a zero-coupon bond; coupons shorten it.", f: (s) => s.n },
      { latex: `\\frac{(Ia)_{\\overline{${"n"}|}}}{${AN("n")}}`, why: "That is the duration of a level annuity (no redemption payment).", f: (s) => Ia(s.n, s.i) / an(s.n, s.i) },
    ],
    hook: "For a par bond $D_{mac} = \\ddot a_{\\overline{n|}}$ at the yield; face value does not matter.",
    sample: { i: 0.05, n: 8 },
    reference: (s) => {
      const flows = Array.from({ length: s.n }, (_, k) => ({ t: k + 1, amount: 100 * s.i + (k + 1 === s.n ? 100 : 0) }));
      return flows.reduce((a, f) => a + f.t * f.amount * v(s.i, f.t), 0) / pv(flows, s.i);
    },
  },
  {
    id: "duration-annuity",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of a level annuity-immediate of $n$ payments, at yield $i$.",
    correct: { latex: `\\frac{(Ia)_{\\overline{n|}}}{${AN("n")}}`, f: (s) => Ia(s.n, s.i) / an(s.n, s.i) },
    wrong: [
      { latex: `\\frac{(Da)_{\\overline{n|}}}{${AN("n")}}`, why: "Weights the times backwards: the decreasing annuity weights early times most.", f: (s) => Da(s.n, s.i) / an(s.n, s.i) },
      { latex: "\\frac{n+1}{2}", why: "The undiscounted average time; discounting pulls the duration earlier.", f: (s) => (s.n + 1) / 2 },
      { latex: `\\frac{(Ia)_{\\overline{n|}}}{${ADN("n")}}`, why: "The price of the annuity-immediate is $a_{\\overline{n|}}$, not $\\ddot a_{\\overline{n|}}$.", f: (s) => Ia(s.n, s.i) / adue(s.n, s.i) },
    ],
    hook: "Numerator $\\sum t\\,v^t = (Ia)_{\\overline{n|}}$, denominator the price $a_{\\overline{n|}}$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => k * v(s.i, k)) / sum(1, s.n, (k) => v(s.i, k)),
  },
  {
    id: "approx-macaulay",
    formula: "G.approx-macaulay",
    area: "G",
    topic: "ALM",
    prompt: "The first-order Macaulay approximation of the price at a new yield $i_1$, from the price and Macaulay duration at $i_0$.",
    correct: { latex: "P(i_1) \\approx P(i_0)\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_{mac}}", f: (s) => s.P0 * Math.pow((1 + s.i0) / (1 + s.i1), s.D) },
    wrong: [
      { latex: "P(i_0)\\left(\\frac{1+i_1}{1+i_0}\\right)^{D_{mac}}", why: "Upside down: a higher yield must give a lower price.", f: (s) => s.P0 * Math.pow((1 + s.i1) / (1 + s.i0), s.D) },
      { latex: "P(i_0)\\left[1 - (i_1 - i_0)D_{mac}\\right]", why: "The linear (modified) form needs $D_{mod}$, not $D_{mac}$.", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.D) },
      { latex: "P(i_0)\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_{mod}}", why: "The exponent is the Macaulay duration (a time in years).", f: (s) => s.P0 * Math.pow((1 + s.i0) / (1 + s.i1), s.D / (1 + s.i0)) },
    ],
    hook: "Treat the bond as a single payment at time $D_{mac}$ and re-discount it at the new yield.",
    sample: { P0: 100, i0: 0.05, i1: 0.06, D: 7 },
    reference: (s) => s.P0 * Math.pow((1 + s.i0) / (1 + s.i1), s.D),
    exact: false,
  },
  {
    id: "approx-modified",
    formula: "G.approx-modified",
    area: "G",
    topic: "ALM",
    prompt: "The first-order modified-duration approximation of the price at a new yield $i_1$.",
    correct: { latex: "P(i_1) \\approx P(i_0)\\left[1 - (i_1 - i_0)D_{mod}\\right]", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm) },
    wrong: [
      { latex: "P(i_0)\\left[1 + (i_1 - i_0)D_{mod}\\right]", why: "Sign: a rise in yield lowers the price.", f: (s) => s.P0 * (1 + (s.i1 - s.i0) * s.Dm) },
      { latex: "P(i_0) - (i_1 - i_0)D_{mod}", why: "$D_{mod}$ is a *percentage* sensitivity; multiply it by the price.", f: (s) => s.P0 - (s.i1 - s.i0) * s.Dm },
      { latex: "P(i_0)\\left[1 - (i_1 - i_0)D_{mac}\\right]", why: "The linear form uses the modified duration.", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm * (1 + s.i0)) },
    ],
    hook: "$\\%\\Delta P \\approx -\\Delta i \\cdot D_{mod}$: a tangent-line estimate, always below the true price for positive convexity.",
    sample: { P0: 100, i0: 0.05, i1: 0.06, Dm: 7 / 1.05 },
    reference: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm),
    exact: false,
  },
  {
    id: "convexity",
    formula: "G.convexity",
    area: "G",
    topic: "ALM",
    prompt: "The (modified) convexity $P''(i)/P(i)$ of cash flows $CF_t$ at annual effective yield $i$.",
    correct: { latex: "\\frac{\\sum t(t+1)\\,CF_t\\,v^{t+2}}{\\sum CF_t\\,v^t}", f: (s) => durSums(s.i).ttv2 / durSums(s.i).p },
    wrong: [
      { latex: "\\frac{\\sum t^2\\,CF_t\\,v^t}{\\sum CF_t\\,v^t}", why: "That is the Macaulay convexity, the second derivative with respect to $\\delta$.", f: (s) => durSums(s.i).t2v / durSums(s.i).p },
      { latex: "\\frac{\\sum t(t+1)\\,CF_t\\,v^{t}}{\\sum CF_t\\,v^t}", why: "Differentiating $v^t$ twice in $i$ adds two powers of $v$: $v^{t+2}$.", f: (s) => durSums(s.i).ttv / durSums(s.i).p },
      { latex: "\\frac{\\sum t(t-1)\\,CF_t\\,v^{t+2}}{\\sum CF_t\\,v^t}", why: "$\\frac{d^2}{di^2}(1+i)^{-t} = t(t+1)(1+i)^{-t-2}$: the factor is $t + 1$, not $t - 1$.", f: (s) => durSums(s.i).tmv2 / durSums(s.i).p },
    ],
    hook: "Differentiate $(1+i)^{-t}$ twice: $t(t+1)(1+i)^{-(t+2)}$.",
    sample: { i: 0.07 },
    reference: (s) => convex(s.i),
  },
  {
    id: "convexity-relation",
    formula: "G.convexity",
    area: "G",
    topic: "ALM",
    prompt: "Modified convexity in terms of Macaulay convexity and Macaulay duration (annual effective yield $i$).",
    correct: { latex: "C = \\frac{C_{mac} + D_{mac}}{(1+i)^2}", f: (s) => (macC(s.i) + macD(s.i)) / Math.pow(1 + s.i, 2) },
    wrong: [
      { latex: "\\frac{C_{mac} - D_{mac}}{(1+i)^2}", why: "$t(t+1) = t^2 + t$, so the duration is *added*.", f: (s) => (macC(s.i) - macD(s.i)) / Math.pow(1 + s.i, 2) },
      { latex: "\\frac{C_{mac}}{(1+i)^2}", why: "Leaves out the $t$ in $t(t+1) = t^2 + t$.", f: (s) => macC(s.i) / Math.pow(1 + s.i, 2) },
      { latex: "\\frac{C_{mac} + D_{mac}}{1+i}", why: "Two derivatives in $i$ bring two factors of $v$: $(1+i)^2$.", f: (s) => (macC(s.i) + macD(s.i)) / (1 + s.i) },
    ],
    hook: "$\\sum t(t+1)v^{t+2} = v^2\\left(\\sum t^2 v^t + \\sum t v^t\\right)$.",
    sample: { i: 0.07 },
    reference: (s) => convex(s.i),
  },
  {
    id: "portfolio-duration",
    formula: "G.portfolio-duration",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of a portfolio of two bonds with prices $P_1, P_2$ and durations $D_1, D_2$ (same yield).",
    correct: { latex: "\\frac{P_1D_1 + P_2D_2}{P_1 + P_2}", f: (s) => (s.P1 * s.D1 + s.P2 * s.D2) / (s.P1 + s.P2) },
    wrong: [
      { latex: "\\frac{D_1 + D_2}{2}", why: "A plain average ignores how much of the portfolio each bond is.", f: (s) => (s.D1 + s.D2) / 2 },
      { latex: "\\frac{P_1D_2 + P_2D_1}{P_1 + P_2}", why: "Weights crossed over.", f: (s) => (s.P1 * s.D2 + s.P2 * s.D1) / (s.P1 + s.P2) },
      { latex: "P_1D_1 + P_2D_2", why: "Forgot to divide by the total price.", f: (s) => s.P1 * s.D1 + s.P2 * s.D2 },
    ],
    hook: "Price-weighted average of the durations (and the same for convexities).",
    // Bond 1: 100 at t = 3; bond 2: 50 at t = 10; i = 6%.
    sample: { P1: 100 * Math.pow(1.06, -3), P2: 50 * Math.pow(1.06, -10), D1: 3, D2: 10 },
    reference: () => {
      const flows = [
        { t: 3, amount: 100 },
        { t: 10, amount: 50 },
      ];
      return flows.reduce((a, f) => a + f.t * f.amount * v(0.06, f.t), 0) / pv(flows, 0.06);
    },
  },
];

export const DRILL_BY_ID: Record<string, DrillItem> = Object.fromEntries(DRILL_ITEMS.map((d) => [d.id, d]));
