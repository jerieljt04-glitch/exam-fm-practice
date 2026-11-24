/**
 * Formula drill, second bank: the formulas on the two reference sheets
 * (TIA FM formula sheets, 2026-08-10, and the ACTEX FM formula & review
 * sheet) that the first bank in `drill.ts` does not drill — effective rates
 * per period, nominal ↔ effective in every direction, continuous and m-thly
 * annuities, the due / accumulated versions of the varying annuities,
 * geometric variants, annuity tricks, drop payments, callable bonds, spot
 * pricing, bond durations and convexities, full immunization.
 *
 * Same contract as `drill.ts`: every item carries an independent `reference`
 * computation at its sample point, the correct form must match it and every
 * near-miss must differ (enforced in scripts/tests/study.test.ts).
 */
import { Da, Ia, adue, an, geometricPV, sdue, sn, v } from "../engine/finance";
import type { DrillItem } from "./drill";

type S = Record<string, number>;

// ---------------------------------------------------------------- independent helpers

const sum = (a: number, b: number, fn: (k: number) => number): number => {
  let total = 0;
  for (let k = a; k <= b; k += 1) total += fn(k);
  return total;
};

/** Midpoint-rule integral of fn over [a, b]. */
const integrate = (fn: (t: number) => number, a: number, b: number, steps = 40000): number => {
  const h = (b - a) / steps;
  let total = 0;
  for (let k = 0; k < steps; k += 1) total += fn(a + (k + 0.5) * h);
  return total * h;
};

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

type Flow = { t: number; amount: number };
const pvAt = (flows: Flow[], i: number) => flows.reduce((acc, f) => acc + f.amount * Math.pow(1 + i, -f.t), 0);
const pvForce = (flows: Flow[], delta: number) => flows.reduce((acc, f) => acc + f.amount * Math.exp(-delta * f.t), 0);

/** Annual-coupon bond flows. */
const bondFlows = (F: number, r: number, C: number, n: number): Flow[] =>
  Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: F * r + (k + 1 === n ? C : 0) }));

/** Book value of an annual-coupon bond after t coupons, by the recursion BV ← BV(1+i) − Fr. */
const bookValue = (s: S, t: number) => {
  let bv = pvAt(bondFlows(s.F, s.r, s.C, s.n), s.i);
  for (let k = 1; k <= t; k += 1) bv = bv * (1 + s.i) - s.F * s.r;
  return bv;
};

/** A level loan, simulated: balance just after payment t. */
const balanceAfter = (L: number, i: number, P: number, t: number) => {
  let b = L;
  for (let k = 1; k <= t; k += 1) b = b * (1 + i) - P;
  return b;
};

/** Number of full payments P before a loan L at rate i would be over-repaid. */
const fullPayments = (L: number, i: number, P: number) => {
  let t = 0;
  while (balanceAfter(L, i, P, t + 1) > 0) t += 1;
  return t;
};

/** −P'(δ)/P(δ) and P''(δ)/P(δ) by central differences in the force of interest. */
const macD = (flows: Flow[], i: number) => {
  const d = Math.log(1 + i);
  const h = 1e-5;
  return -(pvForce(flows, d + h) - pvForce(flows, d - h)) / (2 * h) / pvForce(flows, d);
};
const macC = (flows: Flow[], i: number) => {
  const d = Math.log(1 + i);
  const h = 1e-4;
  return (pvForce(flows, d + h) - 2 * pvForce(flows, d) + pvForce(flows, d - h)) / (h * h) / pvForce(flows, d);
};
const modC = (flows: Flow[], i: number) => {
  const h = 1e-4;
  return (pvAt(flows, i + h) - 2 * pvAt(flows, i) + pvAt(flows, i - h)) / (h * h) / pvAt(flows, i);
};

const delta = (i: number) => Math.log(1 + i);
const dOf = (i: number) => i / (1 + i);
const iM = (i: number, m: number) => m * (Math.pow(1 + i, 1 / m) - 1);
const dM = (i: number, m: number) => m * (1 - Math.pow(1 + i, -1 / m));
const abar = (n: number, i: number) => (1 - v(i, n)) / delta(i);
const sbar = (n: number, i: number) => (Math.pow(1 + i, n) - 1) / delta(i);
const adueM = (n: number, i: number, m: number) => (1 - v(i, n)) / dM(i, m);
const Is = (n: number, i: number) => (sdue(n, i) - n) / i;

const AN = (n: string) => `a_{\\overline{${n}|}}`;
const ADN = (n: string) => `\\ddot a_{\\overline{${n}|}}`;
const SN = (n: string) => `s_{\\overline{${n}|}}`;
const SDN = (n: string) => `\\ddot s_{\\overline{${n}|}}`;
const ABN = (n: string) => `\\bar a_{\\overline{${n}|}}`;

// ---------------------------------------------------------------- sample data used above

function A(s: S, t: number): number {
  return s.K * (1 + 0.03 * t + 0.004 * t * t);
}

function J(s: S): number {
  return Math.pow(1 + s.i, 1 / s.m) - 1;
}

function N(s: S): number {
  return fullPayments(s.L, s.i, s.P);
}

function price(s: S): number {
  return s.F * s.r * an(s.n, s.i) + s.C * v(s.i, s.n);
}

/** A spot curve: s_1..s_4. */
const SPOTS: Record<number, number> = { 1: 0.03, 2: 0.037, 3: 0.043, 4: 0.048 };
function P(_s: S, t: number): number {
  return Math.pow(1 + SPOTS[t], -t);
}

/** A 7-year 6% annual-coupon bond, face 100 — the convexity items. */
const CONV_FLOWS: Flow[] = [1, 2, 3, 4, 5, 6, 7].map((t) => ({ t, amount: t === 7 ? 106 : 6 }));
const S0 = (i: number) => CONV_FLOWS.reduce((a, f) => a + f.amount * v(i, f.t), 0);
const S1 = (i: number) => CONV_FLOWS.reduce((a, f) => a + f.t * f.amount * v(i, f.t), 0);
const S2 = (i: number) => CONV_FLOWS.reduce((a, f) => a + f.t * f.t * f.amount * v(i, f.t), 0);
const S2mod = (i: number) => CONV_FLOWS.reduce((a, f) => a + f.t * (f.t + 1) * f.amount * v(i, f.t + 2), 0);

/** A 5-year bond, semiannual coupons of 3 per 100 (times in years). */
const SEMI_FLOWS: Flow[] = Array.from({ length: 10 }, (_, k) => ({ t: (k + 1) / 2, amount: 3 + (k === 9 ? 100 : 0) }));
function macDNominal(im: number): number {
  const i = Math.pow(1 + im / 2, 2) - 1;
  return SEMI_FLOWS.reduce((a, f) => a + f.t * f.amount * v(i, f.t), 0) / pvAt(SEMI_FLOWS, i);
}

// ---------------------------------------------------------------- the bank

export const EXTRA_DRILL_ITEMS: DrillItem[] = [
  // ============================================================ A. Measurement of interest
  {
    id: "eff-interest-period",
    formula: "A.effective-interest",
    area: "A",
    topic: "TVM",
    prompt: "From an amount function $A(t)$, the effective rate of interest earned in period $t$, $i_t$.",
    correct: { latex: "i_t = \\frac{A(t) - A(t-1)}{A(t-1)}", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / A(s, s.t - 1) },
    wrong: [
      { latex: "\\frac{A(t) - A(t-1)}{A(t)}", why: "Dividing by the balance at the *end* of the period gives the discount rate $d_t$.", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / A(s, s.t) },
      { latex: "\\frac{A(t) - A(t-1)}{A(0)}", why: "Measures the interest against the original deposit — a simple-interest view. The effective rate uses the balance at the start of the period.", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / A(s, 0) },
      { latex: "\\frac{A(t)}{A(t-1)}", why: "That is $1 + i_t$, the growth factor for the period, not the rate.", f: (s) => A(s, s.t) / A(s, s.t - 1) },
    ],
    hook: "Interest earned in the period over the money invested at the *start* of the period.",
    // A(t) = K(1 + 0.03t + 0.004t²), K = 500, t = 4.
    sample: { K: 500, t: 4 },
    reference: (s) => A(s, s.t) / A(s, s.t - 1) - 1,
  },
  {
    id: "eff-discount-period",
    formula: "A.effective-discount",
    area: "A",
    topic: "TVM",
    prompt: "From an amount function $A(t)$, the effective rate of discount in period $t$, $d_t$.",
    correct: { latex: "d_t = \\frac{A(t) - A(t-1)}{A(t)}", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / A(s, s.t) },
    wrong: [
      { latex: "\\frac{A(t) - A(t-1)}{A(t-1)}", why: "Dividing by the opening balance gives the interest rate $i_t$, which is larger than $d_t$.", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / A(s, s.t - 1) },
      { latex: "1 - \\frac{A(t)}{A(t-1)}", why: "Upside-down ratio: it is $-i_t$. The discount factor for the period is $A(t-1)/A(t) = 1 - d_t$.", f: (s) => 1 - A(s, s.t) / A(s, s.t - 1) },
      { latex: "\\frac{A(t) - A(t-1)}{A(t) + A(t-1)}", why: "Not a rate on any balance: the base must be the end-of-period amount alone.", f: (s) => (A(s, s.t) - A(s, s.t - 1)) / (A(s, s.t) + A(s, s.t - 1)) },
    ],
    hook: "Discount is interest measured against the amount at the *end* of the period: $d_t = 1 - A(t-1)/A(t)$.",
    sample: { K: 500, t: 4 },
    reference: (s) => 1 - A(s, s.t - 1) / A(s, s.t),
  },
  {
    id: "v-from-d",
    formula: "A.discount-factor",
    area: "A",
    topic: "TVM",
    prompt: "The one-year discount factor $v$ in terms of the annual effective rate of discount $d$.",
    correct: { latex: "v = 1 - d", f: (s) => 1 - s.d },
    wrong: [
      { latex: "v = \\frac{1}{1+d}", why: "Treats $d$ as if it were an interest rate. $v = 1/(1+i)$, and $i \\ne d$.", f: (s) => 1 / (1 + s.d) },
      { latex: "v = \\frac{1}{1-d}", why: "That is $1 + i$, the accumulation factor.", f: (s) => 1 / (1 - s.d) },
      { latex: "v = 1 - \\frac{d}{1-d}", why: "$d/(1-d)$ is $i$, so this is $1 - i$ — not a discount factor.", f: (s) => 1 - s.d / (1 - s.d) },
    ],
    hook: "Pay $1 - d$ today to receive 1 in a year: that price *is* $v$.",
    sample: { d: 0.08 },
    reference: (s) => 1 / (1 + s.d / (1 - s.d)),
  },
  {
    id: "i-from-nominal",
    formula: "A.nominal-conversion",
    area: "A",
    topic: "TVM",
    prompt: "The annual effective rate $i$ equivalent to the nominal rate $i^{(m)}$ convertible $m$ times a year.",
    correct: { latex: "i = \\left(1 + \\frac{i^{(m)}}{m}\\right)^{m} - 1", f: (s) => Math.pow(1 + s.j / s.m, s.m) - 1 },
    wrong: [
      { latex: "i = \\left(1 + i^{(m)}\\right)^{1/m} - 1", why: "Splits instead of compounding: the effective rate per $m$-th is $i^{(m)}/m$, and there are $m$ of them in a year.", f: (s) => Math.pow(1 + s.j, 1 / s.m) - 1 },
      { latex: "i = \\left(1 + \\frac{i^{(m)}}{m}\\right)^{m}", why: "Forgot to subtract 1: that is the accumulation factor $1 + i$.", f: (s) => Math.pow(1 + s.j / s.m, s.m) },
      { latex: "i = m\\left(1 + \\frac{i^{(m)}}{m}\\right) - m", why: "Simplifies to $i^{(m)}$: no compounding inside the year.", f: (s) => s.m * (1 + s.j / s.m) - s.m },
    ],
    hook: "Grow at $i^{(m)}/m$ per period for $m$ periods, then subtract the 1 you started with.",
    sample: { j: 0.08, m: 4 },
    reference: (s) => {
      let x = 1;
      for (let k = 0; k < s.m; k += 1) x *= 1 + s.j / s.m;
      return x - 1;
    },
  },
  {
    id: "i-from-nominal-discount",
    formula: "A.nominal-conversion",
    area: "A",
    topic: "TVM",
    prompt: "The annual effective rate of interest $i$ equivalent to the nominal rate of discount $d^{(m)}$ convertible $m$ times a year.",
    correct: { latex: "i = \\left(1 - \\frac{d^{(m)}}{m}\\right)^{-m} - 1", f: (s) => Math.pow(1 - s.dm / s.m, -s.m) - 1 },
    wrong: [
      { latex: "i = \\left(1 + \\frac{d^{(m)}}{m}\\right)^{m} - 1", why: "Treats the discount rate as an interest rate. Each $m$-th of a year accumulates by $1/(1 - d^{(m)}/m)$, not $1 + d^{(m)}/m$.", f: (s) => Math.pow(1 + s.dm / s.m, s.m) - 1 },
      { latex: "i = 1 - \\left(1 - \\frac{d^{(m)}}{m}\\right)^{m}", why: "That is the annual effective *discount* rate $d$.", f: (s) => 1 - Math.pow(1 - s.dm / s.m, s.m) },
      { latex: "i = \\left(1 - \\frac{d^{(m)}}{m}\\right)^{-1/m} - 1", why: "Wrong power: the year has $m$ periods, so the exponent is $-m$.", f: (s) => Math.pow(1 - s.dm / s.m, -1 / s.m) - 1 },
    ],
    hook: "$1 - d^{(m)}/m$ is a discount factor per period; raise to $-m$ to get one year's accumulation factor.",
    sample: { dm: 0.06, m: 12 },
    reference: (s) => {
      let x = 1;
      for (let k = 0; k < s.m; k += 1) x /= 1 - s.dm / s.m;
      return x - 1;
    },
  },
  {
    id: "nominal-i-from-nominal-d",
    formula: "A.nominal-equivalence",
    area: "A",
    topic: "TVM",
    prompt: "The nominal rate of interest $i^{(m)}$ equivalent to the nominal rate of discount $d^{(p)}$.",
    correct: { latex: "i^{(m)} = m\\left[\\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p/m} - 1\\right]", f: (s) => s.m * (Math.pow(1 - s.dp / s.p, -s.p / s.m) - 1) },
    wrong: [
      { latex: "m\\left[\\left(1 - \\frac{d^{(p)}}{p}\\right)^{-m/p} - 1\\right]", why: "Exponent upside down: one year is $p$ discount periods, and you need $1/m$ of a year — power $-p/m$.", f: (s) => s.m * (Math.pow(1 - s.dp / s.p, -s.m / s.p) - 1) },
      { latex: "m\\left[\\left(1 - \\frac{d^{(p)}}{p}\\right)^{p/m} - 1\\right]", why: "Positive power discounts instead of accumulating — the result is negative.", f: (s) => s.m * (Math.pow(1 - s.dp / s.p, s.p / s.m) - 1) },
      { latex: "\\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p/m} - 1", why: "That is the effective rate per $m$-th of a year, $i^{(m)}/m$; multiply by $m$.", f: (s) => Math.pow(1 - s.dp / s.p, -s.p / s.m) - 1 },
    ],
    hook: "Go through a common yardstick: $\\left(1 + \\frac{i^{(m)}}{m}\\right)^m = \\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p}$, then solve.",
    sample: { dp: 0.06, p: 12, m: 4 },
    reference: (s) => bisect((x) => Math.pow(1 + x / s.m, s.m) - Math.pow(1 - s.dp / s.p, -s.p), 0, 1),
  },
  {
    id: "force-from-d",
    formula: "A.constant-force",
    area: "A",
    topic: "TVM",
    prompt: "The constant force of interest $\\delta$ equivalent to the annual effective rate of discount $d$.",
    correct: { latex: "\\delta = -\\ln(1-d)", f: (s) => -Math.log(1 - s.d) },
    wrong: [
      { latex: "\\delta = \\ln(1-d)", why: "$\\ln(1-d) = \\ln v$, which is $-\\delta$: right size, wrong sign.", f: (s) => Math.log(1 - s.d) },
      { latex: "\\delta = \\ln(1+d)", why: "Uses $d$ as if it were $i$. With $d$, the accumulation factor is $1/(1-d)$.", f: (s) => Math.log(1 + s.d) },
      { latex: "\\delta = \\frac{d}{1-d}", why: "That is $i$. The force lies strictly between $d$ and $i$.", f: (s) => s.d / (1 - s.d) },
    ],
    hook: "$e^{-\\delta} = v = 1 - d$, so $\\delta = -\\ln(1-d)$.",
    sample: { d: 0.07 },
    reference: (s) => Math.log(1 + s.d / (1 - s.d)),
  },
  {
    id: "d-from-force",
    formula: "A.constant-force",
    area: "A",
    topic: "TVM",
    prompt: "The annual effective rate of discount $d$ equivalent to a constant force of interest $\\delta$.",
    correct: { latex: "d = 1 - e^{-\\delta}", f: (s) => 1 - Math.exp(-s.delta) },
    wrong: [
      { latex: "d = e^{\\delta} - 1", why: "That is the effective *interest* rate $i$.", f: (s) => Math.exp(s.delta) - 1 },
      { latex: "d = e^{-\\delta}", why: "That is $v$, the discount factor; the rate is $1 - v$.", f: (s) => Math.exp(-s.delta) },
      { latex: "d = 1 - e^{\\delta}", why: "Sign of the exponent: this is $-i$.", f: (s) => 1 - Math.exp(s.delta) },
    ],
    hook: "$v = e^{-\\delta}$ and $d = 1 - v$.",
    sample: { delta: 0.06 },
    reference: (s) => {
      const i = Math.exp(s.delta) - 1;
      return i / (1 + i);
    },
  },
  {
    id: "pv-nominal-discount",
    formula: "A.nominal-equivalence",
    area: "A",
    topic: "TVM",
    prompt: "The present value of 1 due in $t$ years at a nominal rate of discount $d^{(m)}$ convertible $m$ times a year.",
    correct: { latex: "\\left(1 - \\frac{d^{(m)}}{m}\\right)^{mt}", f: (s) => Math.pow(1 - s.dm / s.m, s.m * s.t) },
    wrong: [
      { latex: "\\left(1 - \\frac{d^{(m)}}{m}\\right)^{-mt}", why: "Negative power accumulates: that is the value $t$ years *later* of 1 paid now.", f: (s) => Math.pow(1 - s.dm / s.m, -s.m * s.t) },
      { latex: "\\left(1 - \\frac{d^{(m)}}{m}\\right)^{t}", why: "Counts years instead of periods: there are $mt$ discount periods.", f: (s) => Math.pow(1 - s.dm / s.m, s.t) },
      { latex: "\\left(1 + \\frac{d^{(m)}}{m}\\right)^{-mt}", why: "Treats the discount rate as an interest rate.", f: (s) => Math.pow(1 + s.dm / s.m, -s.m * s.t) },
    ],
    hook: "Each $m$-th of a year multiplies by $1 - d^{(m)}/m$; there are $mt$ of them.",
    sample: { dm: 0.08, m: 4, t: 5 },
    reference: (s) => {
      const i = Math.pow(1 - s.dm / s.m, -s.m) - 1;
      return Math.pow(1 + i, -s.t);
    },
  },
  {
    id: "force-simple",
    formula: "A.force-definition",
    area: "A",
    topic: "TVM",
    prompt: "The force of interest $\\delta_t$ at time $t$ under simple interest at rate $i$, $a(t) = 1 + it$.",
    correct: { latex: "\\delta_t = \\frac{i}{1 + it}", f: (s) => s.i / (1 + s.i * s.t) },
    wrong: [
      { latex: "\\delta_t = \\frac{i}{1 + i(t-1)}", why: "That is the effective rate for year $t$, $i_t$ — a rate over a whole year, not an instantaneous one.", f: (s) => s.i / (1 + s.i * (s.t - 1)) },
      { latex: "\\delta_t = \\ln(1+i)", why: "The constant force belongs to *compound* interest.", f: (s) => Math.log(1 + s.i) },
      { latex: "\\delta_t = i", why: "$a'(t) = i$ is the slope; the force divides by the current amount $a(t)$.", f: (s) => s.i },
    ],
    hook: "$\\delta_t = a'(t)/a(t)$: constant growth $i$ over a growing balance, so the force falls.",
    sample: { i: 0.08, t: 5 },
    reference: (s) => {
      const h = 1e-6;
      return (Math.log(1 + s.i * (s.t + h)) - Math.log(1 + s.i * (s.t - h))) / (2 * h);
    },
  },
  {
    id: "scaled-force",
    formula: "A.scaled-force",
    area: "A",
    topic: "TVM",
    prompt: "Fund X accumulates by $a(t)$. Fund Y's force of interest is always $k$ times fund X's. Fund Y's accumulation function $a^*(t)$.",
    correct: { latex: "a^*(t) = \\left[a(t)\\right]^{k}", f: (s) => Math.pow(1 + s.i * s.t, s.k) },
    wrong: [
      { latex: "a^*(t) = k\\,a(t)", why: "Scaling the force scales the *exponent*: $\\exp(\\int k\\delta) = (\\exp\\int\\delta)^k$. Also $k\\,a(0) \\ne 1$.", f: (s) => s.k * (1 + s.i * s.t) },
      { latex: "a^*(t) = a(kt)", why: "Speeds up time instead of scaling the force — the two agree only for compound interest.", f: (s) => 1 + s.i * s.k * s.t },
      { latex: "a^*(t) = \\left[a(t)\\right]^{1/k}", why: "Power inverted: a larger force must give a larger accumulation.", f: (s) => Math.pow(1 + s.i * s.t, 1 / s.k) },
    ],
    hook: "$a^*(t) = \\exp\\int_0^t k\\delta_r\\,dr = \\left(\\exp\\int_0^t\\delta_r\\,dr\\right)^k$.",
    // X: simple interest at 5%, so δ_t = 0.05/(1 + 0.05t).
    sample: { i: 0.05, k: 2, t: 4 },
    reference: (s) => Math.exp(s.k * integrate((r) => s.i / (1 + s.i * r), 0, s.t)),
  },
  {
    id: "pv-varying-force",
    formula: "A.force-accumulation",
    area: "A",
    topic: "TVM",
    prompt: "The present value at time 0 of 1 due at time $n$ under a varying force of interest $\\delta_t$.",
    // Sample force δ_t = 0.03 + 0.002t, n = 5: ∫ = 0.15 + 0.025 = 0.175.
    correct: { latex: "\\exp\\!\\left(-\\int_0^n \\delta_t\\,dt\\right)", f: (s) => Math.exp(-(0.03 * s.n + 0.001 * s.n ** 2)) },
    wrong: [
      { latex: "\\exp\\!\\left(\\int_0^n \\delta_t\\,dt\\right)", why: "Positive exponent accumulates from 0 to $n$.", f: (s) => Math.exp(0.03 * s.n + 0.001 * s.n ** 2) },
      { latex: "1 - \\int_0^n \\delta_t\\,dt", why: "A linear (simple-discount) picture that ignores compounding.", f: (s) => 1 - (0.03 * s.n + 0.001 * s.n ** 2) },
      { latex: "e^{-n\\,\\delta_n}", why: "Applies the force at time $n$ to the whole period; the force varies, so integrate it.", f: (s) => Math.exp(-s.n * (0.03 + 0.002 * s.n)) },
    ],
    hook: "Accumulate with $e^{+\\int\\delta}$, discount with $e^{-\\int\\delta}$.",
    sample: { n: 5 },
    reference: (s) => 1 / Math.exp(integrate((t) => 0.03 + 0.002 * t, 0, s.n)),
  },
  {
    id: "nominal-from-real",
    formula: "F.real-rate",
    area: "F",
    topic: "TVM",
    prompt: "The nominal rate of interest $i$ needed to earn a real rate $i'$ when inflation is $r$.",
    correct: { latex: "i = i' + r + i'r", f: (s) => s.ip + s.r + s.ip * s.r },
    wrong: [
      { latex: "i = i' + r", why: "The approximation: leaves out the cross term $i'r$ from $(1+i')(1+r)$.", f: (s) => s.ip + s.r },
      { latex: "i = \\frac{i' + r}{1 + r}", why: "Divides by inflation — that is the pattern for *removing* it, not adding it.", f: (s) => (s.ip + s.r) / (1 + s.r) },
      { latex: "i = i' + r - i'r", why: "Sign of the cross term: $(1+i')(1+r) = 1 + i' + r + i'r$.", f: (s) => s.ip + s.r - s.ip * s.r },
    ],
    hook: "$1 + i = (1 + i')(1 + r)$ — expand it.",
    sample: { ip: 0.04, r: 0.03 },
    reference: (s) => (1 + s.ip) * (1 + s.r) - 1,
  },

  // ============================================================ B. Annuities
  {
    id: "perpetuity-immediate",
    formula: "B.perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value, one period before the first payment, of 1 at the end of every period forever: $a_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{i}", f: (s) => 1 / s.i },
    wrong: [
      { latex: "\\frac{1}{d}", why: "That is $\\ddot a_{\\overline{\\infty|}}$, valued at the first payment.", f: (s) => 1 / dOf(s.i) },
      { latex: "\\frac{1}{\\delta}", why: "That is the continuous perpetuity $\\bar a_{\\overline{\\infty|}}$.", f: (s) => 1 / delta(s.i) },
      { latex: "\\frac{v}{i}", why: "Discounts one period too many: $a_{\\overline{\\infty|}}$ already sits one period before the first payment.", f: (s) => 1 / (s.i * (1 + s.i)) },
    ],
    hook: "A deposit of 1 earning $i$ pays $i$ forever; so $i$ forever costs 1, and 1 forever costs $1/i$.",
    sample: { i: 0.05 },
    reference: (s) => sum(1, 3000, (k) => v(s.i, k)),
  },
  {
    id: "continuous-pv",
    formula: "B.continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of 1 a year paid continuously for $n$ years: $\\bar a_{\\overline{n|}}$.",
    correct: { latex: "\\frac{1 - v^n}{\\delta}", f: (s) => abar(s.n, s.i) },
    wrong: [
      { latex: "\\frac{1 - v^n}{i}", why: "That is $a_{\\overline{n|}}$ — payments in lumps at year ends.", f: (s) => an(s.n, s.i) },
      { latex: "\\frac{1 - v^n}{d}", why: "That is $\\ddot a_{\\overline{n|}}$ — payments in lumps at year starts.", f: (s) => adue(s.n, s.i) },
      { latex: "\\frac{(1+i)^n - 1}{\\delta}", why: "That is the accumulated value $\\bar s_{\\overline{n|}}$.", f: (s) => sbar(s.n, s.i) },
    ],
    hook: "Same numerator; the denominator matches the payment timing — $i$ (end), $d$ (start), $\\delta$ (continuous).",
    sample: { i: 0.06, n: 10 },
    reference: (s) => integrate((t) => v(s.i, t), 0, s.n),
  },
  {
    id: "continuous-av",
    formula: "B.continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value at time $n$ of 1 a year paid continuously for $n$ years: $\\bar s_{\\overline{n|}}$.",
    correct: { latex: "\\frac{(1+i)^n - 1}{\\delta}", f: (s) => sbar(s.n, s.i) },
    wrong: [
      { latex: "\\frac{(1+i)^n - 1}{i}", why: "That is $s_{\\overline{n|}}$, for payments at year ends.", f: (s) => sn(s.n, s.i) },
      { latex: "\\frac{(1+i)^n - 1}{d}", why: "That is $\\ddot s_{\\overline{n|}}$, for payments at year starts.", f: (s) => sdue(s.n, s.i) },
      { latex: "\\frac{e^{n} - 1}{\\delta}", why: "Grows by $e^{n}$ instead of $e^{\\delta n} = (1+i)^n$.", f: (s) => (Math.exp(s.n) - 1) / delta(s.i) },
    ],
    hook: "$\\bar s_{\\overline{n|}} = \\bar a_{\\overline{n|}}(1+i)^n = \\frac{i}{\\delta}s_{\\overline{n|}}$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => integrate((t) => Math.pow(1 + s.i, s.n - t), 0, s.n),
  },
  {
    id: "continuous-perpetuity",
    formula: "B.continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of 1 a year paid continuously forever: $\\bar a_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{\\delta}", f: (s) => 1 / delta(s.i) },
    wrong: [
      { latex: "\\frac{1}{i}", why: "Year-end lumps: $a_{\\overline{\\infty|}}$.", f: (s) => 1 / s.i },
      { latex: "\\frac{1}{d}", why: "Year-start lumps: $\\ddot a_{\\overline{\\infty|}}$.", f: (s) => 1 / dOf(s.i) },
      { latex: "\\frac{1}{\\delta^2}", why: "That is $(\\bar I\\bar a)_{\\overline{\\infty|}}$, a continuously *increasing* perpetuity.", f: (s) => 1 / delta(s.i) ** 2 },
    ],
    hook: "Let $n \\to \\infty$ in $(1 - v^n)/\\delta$.",
    sample: { i: 0.05 },
    reference: (s) => integrate((t) => v(s.i, t), 0, 900, 90000),
  },
  {
    id: "due-from-immediate",
    formula: "B.annuity-due",
    area: "B",
    topic: "ANNUITIES",
    prompt: "$\\ddot a_{\\overline{n|}}$ written with an annuity-immediate (the first payment split off).",
    correct: { latex: `1 + ${AN("n-1")}`, f: (s) => 1 + an(s.n - 1, s.i) },
    wrong: [
      { latex: `1 + ${AN("n")}`, why: "Counts $n + 1$ payments: the one at time 0 plus $n$ more.", f: (s) => 1 + an(s.n, s.i) },
      { latex: `(1+i)\\,${AN("n-1")}`, why: "That is $\\ddot a_{\\overline{n-1|}}$ — one payment short.", f: (s) => (1 + s.i) * an(s.n - 1, s.i) },
      { latex: `1 + v\\,${AN("n-1")}`, why: "The remaining payments at times $1, \\dots, n-1$ are already valued at time 0 by $a_{\\overline{n-1|}}$; the extra $v$ pushes them a period late.", f: (s) => 1 + v(s.i, 1) * an(s.n - 1, s.i) },
    ],
    hook: "Payment at time 0, then an $(n-1)$-payment annuity-immediate valued at time 0.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(0, s.n - 1, (k) => v(s.i, k)),
  },
  {
    id: "sdue-from-s",
    formula: "B.annuity-due-av",
    area: "B",
    topic: "ANNUITIES",
    prompt: "$\\ddot s_{\\overline{n|}}$ written with an accumulated annuity-immediate.",
    correct: { latex: `${SN("n+1")} - 1`, f: (s) => sn(s.n + 1, s.i) - 1 },
    wrong: [
      { latex: `${SN("n+1")}`, why: "Includes a payment at time $n + 1$ that the annuity-due does not have.", f: (s) => sn(s.n + 1, s.i) },
      { latex: `1 + ${SN("n")}`, why: "Adds the payment at the wrong end; $s_{\\overline{n|}}$ is valued at time $n$, not $n + 1$.", f: (s) => 1 + sn(s.n, s.i) },
      { latex: `${SN("n-1")} + 1`, why: "That is $\\ddot s_{\\overline{n-1|}}$'s pattern shifted — one payment short and a period early.", f: (s) => sn(s.n - 1, s.i) + 1 },
    ],
    hook: "Imagine an extra payment at time $n + 1$: $s_{\\overline{n+1|}}$, then take it away.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => Math.pow(1 + s.i, k)),
  },
  {
    id: "deferred-difference",
    formula: "B.deferred",
    area: "B",
    topic: "ANNUITIES",
    prompt: "${}_{m|}a_{\\overline{n|}}$ (first payment at time $m + 1$) as a difference of two annuities-immediate.",
    correct: { latex: `${AN("m+n")} - ${AN("m")}`, f: (s) => an(s.m + s.n, s.i) - an(s.m, s.i) },
    wrong: [
      { latex: `${AN("m+n")} - ${AN("n")}`, why: "Removes the last $n$ payments' worth instead of the first $m$.", f: (s) => an(s.m + s.n, s.i) - an(s.n, s.i) },
      { latex: `${AN("n")} - ${AN("m")}`, why: "$a_{\\overline{n|}}$ covers times $1..n$, not $1..m+n$.", f: (s) => an(s.n, s.i) - an(s.m, s.i) },
      { latex: `${AN("m+n")} - ${AN("m+1")}`, why: "Takes away one payment too many (the one at time $m + 1$).", f: (s) => an(s.m + s.n, s.i) - an(s.m + 1, s.i) },
    ],
    hook: "Payments at $1..m+n$ minus the missing ones at $1..m$.",
    sample: { i: 0.05, n: 8, m: 3 },
    reference: (s) => sum(s.m + 1, s.m + s.n, (k) => v(s.i, k)),
  },
  {
    id: "deferred-due",
    formula: "B.deferred",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value at time 0 of $n$ payments of 1, the first at time $m + 1$, written with an annuity-*due*.",
    correct: { latex: `v^{m+1}${ADN("n")}`, f: (s) => v(s.i, s.m + 1) * adue(s.n, s.i) },
    wrong: [
      { latex: `v^{m}${ADN("n")}`, why: "$\\ddot a$ is valued *at* the first payment (time $m + 1$), so discount $m + 1$ periods.", f: (s) => v(s.i, s.m) * adue(s.n, s.i) },
      { latex: `v^{m+1}${AN("n")}`, why: "$a_{\\overline{n|}}$ is valued one period before its first payment — that would put the first payment at $m + 2$.", f: (s) => v(s.i, s.m + 1) * an(s.n, s.i) },
      { latex: `v^{m-1}${ADN("n")}`, why: "Discounts two periods too few.", f: (s) => v(s.i, s.m - 1) * adue(s.n, s.i) },
    ],
    hook: "${}_{m|}a_{\\overline{n|}} = {}_{m+1|}\\ddot a_{\\overline{n|}}$: an annuity-due sits on its first payment.",
    sample: { i: 0.05, n: 8, m: 3 },
    reference: (s) => sum(s.m + 1, s.m + s.n, (k) => v(s.i, k)),
  },
  {
    id: "increasing-due",
    formula: "B.increasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, 2, \\dots, n$ at times $0, 1, \\dots, n-1$: $(I\\ddot a)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{${ADN("n")} - nv^n}{d}`, f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n)) / dOf(s.i) },
    wrong: [
      { latex: `\\frac{${ADN("n")} - nv^n}{i}`, why: "That is $(Ia)_{\\overline{n|}}$, payments at times $1..n$.", f: (s) => Ia(s.n, s.i) },
      { latex: `\\frac{${AN("n")} - nv^n}{d}`, why: "The numerator always uses $\\ddot a$ — only the denominator changes with timing.", f: (s) => (an(s.n, s.i) - s.n * v(s.i, s.n)) / dOf(s.i) },
      { latex: `\\frac{${ADN("n")} - nv^{n-1}}{d}`, why: "The subtracted term is always $nv^n$.", f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n - 1)) / dOf(s.i) },
    ],
    hook: "Increasing annuities: numerator $\\ddot a_{\\overline{n|}} - nv^n$ always; divide by $i$ (immediate) or $d$ (due).",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => k * v(s.i, k - 1)),
  },
  {
    id: "decreasing-av",
    formula: "B.decreasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value at time $n$ of payments $n, n-1, \\dots, 1$ at times $1, 2, \\dots, n$: $(Ds)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{n(1+i)^n - ${SN("n")}}{i}`, f: (s) => (s.n * Math.pow(1 + s.i, s.n) - sn(s.n, s.i)) / s.i },
    wrong: [
      { latex: `\\frac{n - ${SN("n")}}{i}`, why: "Accumulating $(Da) = (n - a)/i$ multiplies the $n$ by $(1+i)^n$ as well. This is negative.", f: (s) => (s.n - sn(s.n, s.i)) / s.i },
      { latex: `\\frac{n(1+i)^n - ${SDN("n")}}{i}`, why: "The subtracted annuity is $s_{\\overline{n|}}$, not $\\ddot s_{\\overline{n|}}$.", f: (s) => (s.n * Math.pow(1 + s.i, s.n) - sdue(s.n, s.i)) / s.i },
      { latex: `\\frac{n(1+i)^n - ${SN("n")}}{d}`, why: "Dividing by $d$ gives $(D\\ddot s)_{\\overline{n|}}$, payments at the start of each period.", f: (s) => (s.n * Math.pow(1 + s.i, s.n) - sn(s.n, s.i)) / dOf(s.i) },
    ],
    hook: "$(Ds)_{\\overline{n|}} = (Da)_{\\overline{n|}}(1+i)^n = \\frac{n(1+i)^n - s_{\\overline{n|}}}{i}$.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (k) => (s.n - k + 1) * Math.pow(1 + s.i, s.n - k)),
  },
  {
    id: "decreasing-due",
    formula: "B.decreasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $n, n-1, \\dots, 1$ at times $0, 1, \\dots, n-1$: $(D\\ddot a)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{n - ${AN("n")}}{d}`, f: (s) => (s.n - an(s.n, s.i)) / dOf(s.i) },
    wrong: [
      { latex: `\\frac{n - ${AN("n")}}{i}`, why: "That is $(Da)_{\\overline{n|}}$, payments at times $1..n$.", f: (s) => Da(s.n, s.i) },
      { latex: `\\frac{n - ${ADN("n")}}{d}`, why: "Decreasing annuities keep $a_{\\overline{n|}}$ in the numerator; only the denominator changes.", f: (s) => (s.n - adue(s.n, s.i)) / dOf(s.i) },
      { latex: `\\frac{n - ${AN("n")}}{\\delta}`, why: "$\\delta$ belongs to continuous payments.", f: (s) => (s.n - an(s.n, s.i)) / delta(s.i) },
    ],
    hook: "Decreasing: numerator $n - a_{\\overline{n|}}$ always; $i$ for immediate, $d$ for due.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(0, s.n - 1, (k) => (s.n - k) * v(s.i, k)),
  },
  {
    id: "increasing-perpetuity-due",
    formula: "B.increasing-perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, 2, 3, \\dots$ at times $0, 1, 2, \\dots$ forever: $(I\\ddot a)_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{d^2}", f: (s) => 1 / dOf(s.i) ** 2 },
    wrong: [
      { latex: "\\frac{1}{id}", why: "That is $(Ia)_{\\overline{\\infty|}}$, payments starting at time 1.", f: (s) => 1 / (s.i * dOf(s.i)) },
      { latex: "\\frac{1}{i^2}", why: "That is $v \\cdot (Ia)_{\\overline{\\infty|}}$ — one period too late.", f: (s) => 1 / s.i ** 2 },
      { latex: "\\frac{1}{\\delta^2}", why: "That is the continuously increasing perpetuity $(\\bar I\\bar a)_{\\overline{\\infty|}}$.", f: (s) => 1 / delta(s.i) ** 2 },
    ],
    hook: "$(I\\ddot a)_{\\overline{\\infty|}} = (1+i)(Ia)_{\\overline{\\infty|}} = \\frac{1+i}{id} = \\frac{1}{d^2}$.",
    sample: { i: 0.05 },
    reference: (s) => sum(1, 4000, (k) => k * v(s.i, k - 1)),
  },
  {
    id: "continuous-increasing",
    formula: "B.varying-continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of a continuous payment stream at rate $t$ per year at time $t$, for $n$ years: $(\\bar I\\bar a)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{${ABN("n")} - nv^n}{\\delta}`, f: (s) => (abar(s.n, s.i) - s.n * v(s.i, s.n)) / delta(s.i) },
    wrong: [
      { latex: `\\frac{${ADN("n")} - nv^n}{\\delta}`, why: "That is $(I\\bar a)_{\\overline{n|}}$: continuous payments whose rate steps up once a year (1 in year 1, 2 in year 2…).", f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n)) / delta(s.i) },
      { latex: `\\frac{${ABN("n")} - nv^n}{i}`, why: "Continuous increase and continuous payment: the denominator is $\\delta$.", f: (s) => (abar(s.n, s.i) - s.n * v(s.i, s.n)) / s.i },
      { latex: `\\frac{${ABN("n")} - v^n}{\\delta}`, why: "The subtracted term is $n v^n$ — the final payment rate $n$, discounted.", f: (s) => (abar(s.n, s.i) - v(s.i, s.n)) / delta(s.i) },
    ],
    hook: "$\\int_0^n t v^t\\,dt$ by parts: $\\frac{\\bar a_{\\overline{n|}} - nv^n}{\\delta}$ — the increasing-annuity pattern with every symbol continuous.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => integrate((t) => t * v(s.i, t), 0, s.n),
  },
  {
    id: "continuous-decreasing",
    formula: "B.varying-continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of a continuous payment stream at rate $n - t$ per year at time $t$, for $n$ years: $(\\bar D\\bar a)_{\\overline{n|}}$.",
    correct: { latex: `\\frac{n - ${ABN("n")}}{\\delta}`, f: (s) => (s.n - abar(s.n, s.i)) / delta(s.i) },
    wrong: [
      { latex: `\\frac{n - ${AN("n")}}{\\delta}`, why: "With payments continuous, the annuity in the numerator is $\\bar a_{\\overline{n|}}$.", f: (s) => (s.n - an(s.n, s.i)) / delta(s.i) },
      { latex: `\\frac{n - ${ABN("n")}}{i}`, why: "Continuous decrease: divide by $\\delta$.", f: (s) => (s.n - abar(s.n, s.i)) / s.i },
      { latex: `\\frac{nv^n - ${ABN("n")}}{\\delta}`, why: "The decreasing pattern has a plain $n$ (the first payment rate, at time 0), not $nv^n$.", f: (s) => (s.n * v(s.i, s.n) - abar(s.n, s.i)) / delta(s.i) },
    ],
    hook: "$(\\bar D\\bar a) + (\\bar I\\bar a) = n\\,\\bar a$: the decreasing stream is $n$ minus the increasing one.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => integrate((t) => (s.n - t) * v(s.i, t), 0, s.n),
  },
  {
    id: "continuous-increasing-perpetuity",
    formula: "B.varying-continuous",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of a continuous payment stream at rate $t$ at time $t$, forever: $(\\bar I\\bar a)_{\\overline{\\infty|}}$.",
    correct: { latex: "\\frac{1}{\\delta^2}", f: (s) => 1 / delta(s.i) ** 2 },
    wrong: [
      { latex: "\\frac{1}{\\delta}", why: "That is a *level* continuous perpetuity.", f: (s) => 1 / delta(s.i) },
      { latex: "\\frac{1}{id}", why: "That is $(Ia)_{\\overline{\\infty|}}$ — annual lump payments.", f: (s) => 1 / (s.i * dOf(s.i)) },
      { latex: "\\frac{1}{i\\delta}", why: "Mixes a discrete and a continuous denominator; every piece here is continuous.", f: (s) => 1 / (s.i * delta(s.i)) },
    ],
    hook: "$\\int_0^\\infty t e^{-\\delta t}\\,dt = 1/\\delta^2$.",
    sample: { i: 0.05 },
    reference: (s) => integrate((t) => t * v(s.i, t), 0, 1200, 120000),
  },
  {
    id: "mthly-due",
    formula: "B.mthly-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of $1/m$ paid at the *start* of every $m$-th of a year for $n$ years: $\\ddot a^{(m)}_{\\overline{n|}}$.",
    correct: { latex: "\\frac{1 - v^n}{d^{(m)}}", f: (s) => adueM(s.n, s.i, s.m) },
    wrong: [
      { latex: "\\frac{1 - v^n}{i^{(m)}}", why: "That is $a^{(m)}_{\\overline{n|}}$, payments at the end of each $m$-th.", f: (s) => (1 - v(s.i, s.n)) / iM(s.i, s.m) },
      { latex: "\\frac{1 - v^n}{d}", why: "That is $\\ddot a_{\\overline{n|}}$, one payment of 1 at the start of each year.", f: (s) => adue(s.n, s.i) },
      { latex: "\\frac{1 - v^n}{d^{(m)}/m}", why: "That values payments of 1 (not $1/m$) every $m$-th of a year — $m$ times too much.", f: (s) => (1 - v(s.i, s.n)) / (dM(s.i, s.m) / s.m) },
    ],
    hook: "Keep $1 - v^n$; the denominator names the payment pattern: $i^{(m)}$ end, $d^{(m)}$ start.",
    sample: { i: 0.06, n: 10, m: 12 },
    reference: (s) => sum(0, s.n * s.m - 1, (k) => v(s.i, k / s.m) / s.m),
  },
  {
    id: "mthly-av",
    formula: "B.mthly-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value at time $n$ of $1/m$ paid at the end of every $m$-th of a year for $n$ years: $s^{(m)}_{\\overline{n|}}$.",
    correct: { latex: "\\frac{(1+i)^n - 1}{i^{(m)}}", f: (s) => (Math.pow(1 + s.i, s.n) - 1) / iM(s.i, s.m) },
    wrong: [
      { latex: "\\frac{(1+i)^n - 1}{i}", why: "That is $s_{\\overline{n|}}$ — one payment of 1 at each year end.", f: (s) => sn(s.n, s.i) },
      { latex: "\\frac{(1+i)^n - 1}{d^{(m)}}", why: "That is $\\ddot s^{(m)}_{\\overline{n|}}$, payments at the start of each $m$-th.", f: (s) => (Math.pow(1 + s.i, s.n) - 1) / dM(s.i, s.m) },
      { latex: "\\frac{(1+i)^{n} - 1}{i^{(m)}/m}", why: "Values payments of 1 each $m$-th — $m$ times the stream.", f: (s) => (Math.pow(1 + s.i, s.n) - 1) / (iM(s.i, s.m) / s.m) },
    ],
    hook: "$s^{(m)}_{\\overline{n|}} = \\frac{i}{i^{(m)}}s_{\\overline{n|}}$: same numerator, nominal rate below.",
    sample: { i: 0.06, n: 10, m: 4 },
    reference: (s) => sum(1, s.n * s.m, (k) => Math.pow(1 + s.i, s.n - k / s.m) / s.m),
  },
  {
    id: "mthly-increasing",
    formula: "B.mthly-increasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "Payments every $m$-th of a year, $k/m$ each throughout year $k$ (so $k$ in total in year $k$), for $n$ years: $(Ia)^{(m)}_{\\overline{n|}}$.",
    correct: { latex: `\\frac{${ADN("n")} - nv^n}{i^{(m)}}`, f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n)) / iM(s.i, s.m) },
    wrong: [
      { latex: `\\frac{${ADN("n")} - nv^n}{i}`, why: "That is $(Ia)_{\\overline{n|}}$ — one lump of $k$ at the end of year $k$.", f: (s) => Ia(s.n, s.i) },
      { latex: `\\frac{\\ddot a^{(m)}_{\\overline{n|}} - nv^n}{i^{(m)}}`, why: "That is $(I^{(m)}a)^{(m)}$, where the payment rises every $m$-th of a year, not once a year.", f: (s) => (adueM(s.n, s.i, s.m) - s.n * v(s.i, s.n)) / iM(s.i, s.m) },
      { latex: `\\frac{${AN("n")} - nv^n}{i^{(m)}}`, why: "The numerator is $\\ddot a_{\\overline{n|}} - nv^n$, as for every increasing annuity.", f: (s) => (an(s.n, s.i) - s.n * v(s.i, s.n)) / iM(s.i, s.m) },
    ],
    hook: "The numerator records *how often the payment grows* (yearly: $\\ddot a$); the denominator *how often it is paid* ($i^{(m)}$).",
    sample: { i: 0.06, n: 8, m: 12 },
    reference: (s) => sum(1, s.n, (k) => sum(1, s.m, (j) => (k / s.m) * v(s.i, k - 1 + j / s.m))),
  },
  {
    id: "mthly-mthly-increasing",
    formula: "B.mthly-increasing",
    area: "B",
    topic: "ANNUITIES",
    prompt: "Payments of $1/m^2, 2/m^2, 3/m^2, \\dots$ at the end of each $m$-th of a year for $n$ years (the rate rises every $m$-th): $(I^{(m)}a)^{(m)}_{\\overline{n|}}$.",
    correct: { latex: "\\frac{\\ddot a^{(m)}_{\\overline{n|}} - nv^n}{i^{(m)}}", f: (s) => (adueM(s.n, s.i, s.m) - s.n * v(s.i, s.n)) / iM(s.i, s.m) },
    wrong: [
      { latex: `\\frac{${ADN("n")} - nv^n}{i^{(m)}}`, why: "That is $(Ia)^{(m)}$: the payment grows only once a year.", f: (s) => (adue(s.n, s.i) - s.n * v(s.i, s.n)) / iM(s.i, s.m) },
      { latex: "\\frac{\\ddot a^{(m)}_{\\overline{n|}} - nv^n}{i}", why: "Payments every $m$-th of a year: the denominator is $i^{(m)}$.", f: (s) => (adueM(s.n, s.i, s.m) - s.n * v(s.i, s.n)) / s.i },
      { latex: "\\frac{\\ddot a^{(m)}_{\\overline{n|}} - nv^n}{d^{(m)}}", why: "Dividing by $d^{(m)}$ moves every payment to the *start* of its $m$-th.", f: (s) => (adueM(s.n, s.i, s.m) - s.n * v(s.i, s.n)) / dM(s.i, s.m) },
    ],
    hook: "Grows every $m$-th → $\\ddot a^{(m)}$ on top; paid every $m$-th → $i^{(m)}$ below.",
    sample: { i: 0.06, n: 5, m: 4 },
    reference: (s) => sum(1, s.n * s.m, (p) => (p / (s.m * s.m)) * v(s.i, p / s.m)),
  },
  {
    id: "mthly-fusion",
    formula: "B.mthly-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "$a^{(m)}_{\\overline{n|}}$ at annual effective $i$, by fusing each year's $m$ payments into one year-end payment ($j$ = effective rate per $m$-th of a year).",
    correct: { latex: `\\tfrac{1}{m}\\,${SN("m")}{}_{j}\\;${AN("n")}{}_{i}`, f: (s) => (sn(s.m, J(s)) / s.m) * an(s.n, s.i) },
    wrong: [
      { latex: `\\tfrac{1}{m}\\,${AN("m")}{}_{j}\\;${AN("n")}{}_{i}`, why: "Each year's payments must be *accumulated* to the year end, where the annual annuity values them.", f: (s) => (an(s.m, J(s)) / s.m) * an(s.n, s.i) },
      { latex: `${SN("m")}{}_{j}\\;${AN("n")}{}_{i}`, why: "Each payment is $1/m$, not 1.", f: (s) => sn(s.m, J(s)) * an(s.n, s.i) },
      { latex: `\\tfrac{1}{m}\\,${SN("m")}{}_{j}\\;${AN("n")}{}_{j}`, why: "The fused payments fall once a year: value them at the annual rate $i$, over $n$ periods.", f: (s) => (sn(s.m, J(s)) / s.m) * an(s.n, J(s)) },
    ],
    hook: "Fuse: each year's payments accumulate to $\\frac1m s_{\\overline{m|}j}$ at the year end; then an ordinary $a_{\\overline{n|}i}$.",
    sample: { i: 0.07, n: 6, m: 2 },
    reference: (s) => sum(1, s.n * s.m, (k) => v(s.i, k / s.m) / s.m),
  },
  {
    id: "geometric-due",
    formula: "B.geometric-annuity-due",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, (1+k), \\dots, (1+k)^{n-1}$ at times $0, 1, \\dots, n-1$ ($k \\ne i$).",
    correct: { latex: "\\frac{1 - \\left(\\frac{1+k}{1+i}\\right)^n}{d - kv}", f: (s) => (1 - Math.pow((1 + s.k) / (1 + s.i), s.n)) / (dOf(s.i) - s.k / (1 + s.i)) },
    wrong: [
      { latex: "\\frac{1 - \\left(\\frac{1+k}{1+i}\\right)^n}{i - k}", why: "That is the annuity-*immediate* version, payments at times $1..n$.", f: (s) => geometricPV(s.n, s.i, s.k) },
      { latex: "\\frac{1 - \\left(\\frac{1+k}{1+i}\\right)^n}{d - k}", why: "The due denominator is $(i - k)v = d - kv$; the $k$ is discounted too.", f: (s) => (1 - Math.pow((1 + s.k) / (1 + s.i), s.n)) / (dOf(s.i) - s.k) },
      { latex: "\\frac{1 - \\left(\\frac{1+k}{1+i}\\right)^{n-1}}{d - kv}", why: "There are $n$ payments, so the ratio is raised to $n$.", f: (s) => (1 - Math.pow((1 + s.k) / (1 + s.i), s.n - 1)) / (dOf(s.i) - s.k / (1 + s.i)) },
    ],
    hook: "Due = immediate × $(1+i)$, and $(i - k)/(1+i) = d - kv$.",
    sample: { i: 0.07, k: 0.03, n: 12 },
    reference: (s) => sum(0, s.n - 1, (t) => Math.pow(1 + s.k, t) * v(s.i, t)),
  },
  {
    id: "geometric-av",
    formula: "B.geometric-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The accumulated value at time $n$ of payments $1, (1+k), \\dots, (1+k)^{n-1}$ at times $1, 2, \\dots, n$ ($k \\ne i$).",
    correct: { latex: "\\frac{(1+i)^n - (1+k)^n}{i - k}", f: (s) => (Math.pow(1 + s.i, s.n) - Math.pow(1 + s.k, s.n)) / (s.i - s.k) },
    wrong: [
      { latex: "\\frac{(1+i)^n - 1}{i - k}", why: "Accumulating the PV multiplies *both* terms of the numerator by $(1+i)^n$.", f: (s) => (Math.pow(1 + s.i, s.n) - 1) / (s.i - s.k) },
      { latex: "\\frac{(1+i)^n - (1+k)^n}{i + k}", why: "The denominator is the gap between the rates, $i - k$.", f: (s) => (Math.pow(1 + s.i, s.n) - Math.pow(1 + s.k, s.n)) / (s.i + s.k) },
      { latex: "\\frac{(1+i)^n - (1+k)^n}{d - kv}", why: "That is the annuity-due accumulated value.", f: (s) => (Math.pow(1 + s.i, s.n) - Math.pow(1 + s.k, s.n)) / (dOf(s.i) - s.k / (1 + s.i)) },
    ],
    hook: "PV × $(1+i)^n$: $\\left[1 - \\left(\\frac{1+k}{1+i}\\right)^n\\right](1+i)^n = (1+i)^n - (1+k)^n$.",
    sample: { i: 0.07, k: 0.03, n: 12 },
    reference: (s) => sum(1, s.n, (t) => Math.pow(1 + s.k, t - 1) * Math.pow(1 + s.i, s.n - t)),
  },
  {
    id: "geometric-equal-rates",
    formula: "B.geometric-annuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, (1+i), \\dots, (1+i)^{n-1}$ at times $1, 2, \\dots, n$ — growth equal to the interest rate.",
    correct: { latex: "nv", f: (s) => s.n / (1 + s.i) },
    wrong: [
      { latex: "n", why: "That is the annuity-*due* version: each payment then discounts to exactly 1.", f: (s) => s.n },
      { latex: "nv^n", why: "Each payment $(1+i)^{t-1}$ discounted $t$ periods is worth $v$, not $v^n$.", f: (s) => s.n * v(s.i, s.n) },
      { latex: AN("n"), why: "Ignores the growth: that is a level annuity.", f: (s) => an(s.n, s.i) },
    ],
    hook: "$(1+i)^{t-1}v^t = v$ for every $t$: $n$ payments each worth $v$. (The general formula gives 0/0 here.)",
    sample: { i: 0.06, n: 10 },
    reference: (s) => sum(1, s.n, (t) => Math.pow(1 + s.i, t - 1) * v(s.i, t)),
  },
  {
    id: "geometric-perpetuity-due",
    formula: "B.geometric-perpetuity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, (1+k), (1+k)^2, \\dots$ at times $0, 1, 2, \\dots$ forever ($k < i$).",
    correct: { latex: "\\frac{1+i}{i - k}", f: (s) => (1 + s.i) / (s.i - s.k) },
    wrong: [
      { latex: "\\frac{1}{i - k}", why: "That is the perpetuity-*immediate*, first payment at time 1.", f: (s) => 1 / (s.i - s.k) },
      { latex: "\\frac{1+k}{i - k}", why: "That values payments $(1+k), (1+k)^2, \\dots$ starting at time 1 — every payment one growth step too big.", f: (s) => (1 + s.k) / (s.i - s.k) },
      { latex: "\\frac{1}{d - k}", why: "The due denominator is $d - kv$, not $d - k$.", f: (s) => 1 / (dOf(s.i) - s.k) },
    ],
    hook: "Due = immediate × $(1+i)$.",
    sample: { i: 0.08, k: 0.03 },
    reference: (s) => sum(0, 4000, (t) => Math.pow((1 + s.k) / (1 + s.i), t)),
  },
  {
    id: "pyramid",
    formula: "B.annuity-tricks",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The present value of payments $1, 2, \\dots, n-1, n, n-1, \\dots, 2, 1$ at times $1, 2, \\dots, 2n-1$ (a pyramid).",
    correct: { latex: `${AN("n")}\\,${ADN("n")}`, f: (s) => an(s.n, s.i) * adue(s.n, s.i) },
    wrong: [
      { latex: `\\left(${AN("n")}\\right)^2`, why: "That pyramid starts at time 2: $a_{\\overline{n|}}^2$ is $v\\,a_{\\overline{n|}}\\ddot a_{\\overline{n|}}$.", f: (s) => an(s.n, s.i) ** 2 },
      { latex: `\\left(${ADN("n")}\\right)^2`, why: "That pyramid starts at time 0 — one period early.", f: (s) => adue(s.n, s.i) ** 2 },
      { latex: `(Ia)_{\\overline{n|}} + v^n (Da)_{\\overline{n|}}`, why: "Counts the peak $n$ twice: the decreasing part after the peak is $(Da)_{\\overline{n-1|}}$.", f: (s) => Ia(s.n, s.i) + v(s.i, s.n) * Da(s.n, s.i) },
    ],
    hook: "A pyramid is a stack of $n$ level annuities: $a_{\\overline{n|}}$ started at times $0, 1, \\dots, n-1$ — that is $a_{\\overline{n|}}\\ddot a_{\\overline{n|}}$.",
    sample: { i: 0.05, n: 6 },
    reference: (s) => sum(1, 2 * s.n - 1, (t) => Math.min(t, 2 * s.n - t) * v(s.i, t)),
  },
  {
    id: "grouping-s3n",
    formula: "B.grouping",
    area: "B",
    topic: "ANNUITIES",
    prompt: "$s_{\\overline{3n|}}$ written with $s_{\\overline{n|}}$ (group the payments in blocks of $n$).",
    correct: { latex: `${SN("n")}\\left[(1+i)^{2n} + (1+i)^{n} + 1\\right]`, f: (s) => sn(s.n, s.i) * (Math.pow(1 + s.i, 2 * s.n) + Math.pow(1 + s.i, s.n) + 1) },
    wrong: [
      { latex: `3\\,${SN("n")}`, why: "Ignores that the earlier blocks keep earning interest after their last payment.", f: (s) => 3 * sn(s.n, s.i) },
      { latex: `${SN("n")}\\left[(1+i)^{3n} + (1+i)^{2n} + (1+i)^{n}\\right]`, why: "The last block is already valued at time $3n$; it needs no further accumulation.", f: (s) => sn(s.n, s.i) * (Math.pow(1 + s.i, 3 * s.n) + Math.pow(1 + s.i, 2 * s.n) + Math.pow(1 + s.i, s.n)) },
      { latex: `${SN("n")}\\left[1 + v^{n} + v^{2n}\\right]`, why: "Discounting the blocks values them before time $3n$; accumulate the early blocks forward.", f: (s) => sn(s.n, s.i) * (1 + v(s.i, s.n) + v(s.i, 2 * s.n)) },
    ],
    hook: "Each block is $s_{\\overline{n|}}$ at its own end ($n, 2n, 3n$); move each to $3n$.",
    sample: { i: 0.05, n: 5 },
    reference: (s) => sn(3 * s.n, s.i),
  },
  {
    id: "geometric-series",
    formula: "B.geometric-series",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The sum $a + ar + ar^2 + \\dots + ar^{n-1}$.",
    correct: { latex: "a\\,\\frac{1 - r^n}{1 - r}", f: (s) => (s.a * (1 - Math.pow(s.r, s.n))) / (1 - s.r) },
    wrong: [
      { latex: "a\\,\\frac{1 - r^{n+1}}{1 - r}", why: "That sums $n + 1$ terms, up to $ar^n$.", f: (s) => (s.a * (1 - Math.pow(s.r, s.n + 1))) / (1 - s.r) },
      { latex: "a\\,\\frac{1 - r^{n-1}}{1 - r}", why: "One term short: the “next” term after $ar^{n-1}$ is $ar^n$.", f: (s) => (s.a * (1 - Math.pow(s.r, s.n - 1))) / (1 - s.r) },
      { latex: "\\frac{1 - r^n}{1 - r}", why: "Leaves out the first term $a$.", f: (s) => (1 - Math.pow(s.r, s.n)) / (1 - s.r) },
    ],
    hook: "(first term − the “next” term) ÷ (1 − ratio).",
    sample: { a: 50, r: 0.93, n: 12 },
    reference: (s) => sum(0, s.n - 1, (k) => s.a * Math.pow(s.r, k)),
  },
  {
    id: "counting-terms",
    formula: "B.counting",
    area: "B",
    topic: "ANNUITIES",
    prompt: "The number of terms in $f, f + h, f + 2h, \\dots, L$.",
    correct: { latex: "\\frac{L - (f - h)}{h}", f: (s) => (s.L - (s.f - s.h)) / s.h },
    wrong: [
      { latex: "\\frac{L - f}{h}", why: "Counts the gaps, not the terms — one short.", f: (s) => (s.L - s.f) / s.h },
      { latex: "\\frac{L - f}{h} + 2", why: "One too many: there is one more term than there are gaps.", f: (s) => (s.L - s.f) / s.h + 2 },
      { latex: "\\frac{L}{h}", why: "Assumes the list starts at $h$.", f: (s) => s.L / s.h },
    ],
    hook: "(last − the “previous” term) ÷ step. E.g. $37, 41, \\dots, 121$: $(121 - 33)/4 = 22$.",
    sample: { f: 37, h: 4, L: 121 },
    reference: (s) => {
      let count = 0;
      for (let x = s.f; x <= s.L + 1e-9; x += s.h) count += 1;
      return count;
    },
  },
  {
    id: "reciprocal-identity",
    formula: "B.reciprocal-identity",
    area: "B",
    topic: "ANNUITIES",
    prompt: "$1/a_{\\overline{n|}}$ in terms of $s_{\\overline{n|}}$.",
    correct: { latex: `\\frac{1}{${AN("n")}} = \\frac{1}{${SN("n")}} + i`, f: (s) => 1 / sn(s.n, s.i) + s.i },
    wrong: [
      { latex: `\\frac{1}{${SN("n")}} - i`, why: "The loan payment is *larger* than the sinking-fund deposit: it also pays the interest $i$.", f: (s) => 1 / sn(s.n, s.i) - s.i },
      { latex: `\\frac{1}{${SN("n")}} + d`, why: "The interest on a loan of 1 paid at the end of each period is $i$, not $d$.", f: (s) => 1 / sn(s.n, s.i) + dOf(s.i) },
      { latex: `\\frac{1}{${SDN("n")}} + i`, why: "The deposits are at period ends, like the loan payments: $s_{\\overline{n|}}$.", f: (s) => 1 / sdue(s.n, s.i) + s.i },
    ],
    hook: "Payment on a loan of 1 = interest $i$ + the deposit $1/s_{\\overline{n|}}$ that rebuilds the 1.",
    sample: { i: 0.06, n: 10 },
    reference: (s) => 1 / sum(1, s.n, (k) => v(s.i, k)),
  },

  // ============================================================ C. Yield rates
  {
    id: "reinvest-level-immediate",
    formula: "C.reinvestment",
    area: "C",
    topic: "BONDS",
    prompt: "1 is deposited at the *end* of each year for $n$ years. Interest at rate $i$ is paid each year end and reinvested at rate $j$. The total accumulated value at time $n$.",
    correct: { latex: "n + i\\,(Is)_{\\overline{n-1|}\\,j}", f: (s) => s.n + s.i * Is(s.n - 1, s.j) },
    wrong: [
      { latex: "n + i\\,(Is)_{\\overline{n|}\\,j}", why: "That is the start-of-year version: here the first deposit earns its first interest only at time 2.", f: (s) => s.n + s.i * Is(s.n, s.j) },
      { latex: "n + i\\,(Is)_{\\overline{n-1|}\\,i}", why: "Reinvests the interest at $i$; the reinvestment rate is $j$.", f: (s) => s.n + s.i * Is(s.n - 1, s.i) },
      { latex: "n + j\\,(Is)_{\\overline{n-1|}\\,j}", why: "Interest is *earned* at $i$; $j$ only applies to the reinvested interest.", f: (s) => s.n + s.j * Is(s.n - 1, s.j) },
    ],
    hook: "Interest payments $0, i, 2i, \\dots, (n-1)i$ — an increasing annuity of $n - 1$ terms at $j$ — plus the $n$ deposits back.",
    sample: { i: 0.07, j: 0.04, n: 10 },
    reference: (s) => {
      let principal = 0;
      let fund = 0;
      for (let k = 1; k <= s.n; k += 1) {
        fund = fund * (1 + s.j) + s.i * principal;
        principal += 1;
      }
      return principal + fund;
    },
  },
  {
    id: "yield-with-reinvestment",
    formula: "C.yield-rate",
    area: "C",
    topic: "BONDS",
    prompt: "1 is invested for $n$ years; interest $i$ is paid each year end and reinvested at $j$; the 1 is returned at time $n$. The investor's annual yield $y$ over the $n$ years.",
    correct: { latex: `y = \\left(1 + i\\,${SN("n")}{}_{j}\\right)^{1/n} - 1`, f: (s) => Math.pow(1 + s.i * sn(s.n, s.j), 1 / s.n) - 1 },
    wrong: [
      { latex: `y = \\left(1 + i\\,${SN("n")}{}_{i}\\right)^{1/n} - 1`, why: "Reinvesting at $i$ just returns $y = i$; the point of the problem is the lower rate $j$.", f: (s) => Math.pow(1 + s.i * sn(s.n, s.i), 1 / s.n) - 1 },
      { latex: `y = \\left(1 + j\\,${SN("n")}{}_{i}\\right)^{1/n} - 1`, why: "Rates swapped: the coupons are $i$, the reinvestment rate is $j$.", f: (s) => Math.pow(1 + s.j * sn(s.n, s.i), 1 / s.n) - 1 },
      { latex: `y = \\frac{i\\,${SN("n")}{}_{j}}{n}`, why: "A simple average ignores compounding: solve $(1+y)^n = \\text{what you have}$.", f: (s) => (s.i * sn(s.n, s.j)) / s.n },
    ],
    hook: "What I have ($1 + i\\,s_{\\overline{n|}j}$) = what I demand ($(1+y)^n$).",
    sample: { i: 0.08, j: 0.05, n: 10 },
    reference: (s) => {
      let fund = 0;
      for (let k = 1; k <= s.n; k += 1) fund = fund * (1 + s.j) + s.i;
      return bisect((y) => Math.pow(1 + y, s.n) - (1 + fund), 0, 1);
    },
  },

  // ============================================================ D. Amortization
  {
    id: "balance-recursion",
    formula: "D.balance-recursion",
    area: "D",
    topic: "LOANS",
    prompt: "The outstanding balance just after payment $t$, $B_t$, from the previous balance $B_{t-1}$ and the payment $P$.",
    correct: { latex: "B_t = B_{t-1}(1+i) - P", f: (s) => balanceAfter(s.L, s.i, s.P, s.t - 1) * (1 + s.i) - s.P },
    wrong: [
      { latex: "B_t = B_{t-1} - P", why: "Leaves out the interest that accrues on $B_{t-1}$ during the period.", f: (s) => balanceAfter(s.L, s.i, s.P, s.t - 1) - s.P },
      { latex: "B_t = (B_{t-1} - P)(1+i)", why: "Pays first, then charges interest — that treats the payment as made at the start of the period.", f: (s) => (balanceAfter(s.L, s.i, s.P, s.t - 1) - s.P) * (1 + s.i) },
      { latex: "B_t = B_{t-1} - (P - iB_t)", why: "Interest in payment $t$ is on the *opening* balance, $iB_{t-1}$.", f: (s) => {
        // Solve B = B0 − P + iB  ⇒  B = (B0 − P)/(1 − i).
        const b0 = balanceAfter(s.L, s.i, s.P, s.t - 1);
        return (b0 - s.P) / (1 - s.i);
      } },
    ],
    hook: "Interest is added on what was owed, then the payment comes off: $B_t = B_{t-1} + iB_{t-1} - P$.",
    sample: { L: 10000, i: 0.07, P: 1400, t: 4 },
    reference: (s) => {
      let b = s.L;
      for (let k = 1; k <= s.t; k += 1) {
        const interest = b * s.i;
        b -= s.P - interest;
      }
      return b;
    },
  },
  {
    id: "principal-later",
    formula: "D.principal-component",
    area: "D",
    topic: "LOANS",
    prompt: "In a level-payment loan, the principal repaid in payment $t + s$ in terms of the principal repaid in payment $t$.",
    correct: { latex: "\\text{Prin}_{t+s} = \\text{Prin}_t\\,(1+i)^s", f: (s) => s.Pt * Math.pow(1 + s.i, s.s) },
    wrong: [
      { latex: "\\text{Prin}_t\\,v^s", why: "Principal parts *grow* through a level-payment loan, as the interest part shrinks.", f: (s) => s.Pt * v(s.i, s.s) },
      { latex: "\\text{Prin}_t\\,(1 + is)", why: "The principal parts grow geometrically ($Pv^{n-t+1}$), not linearly.", f: (s) => s.Pt * (1 + s.i * s.s) },
      { latex: "\\text{Prin}_t\\,(1+i)^{s-1}", why: "Each payment later multiplies by $1+i$: $s$ payments later, $(1+i)^s$.", f: (s) => s.Pt * Math.pow(1 + s.i, s.s - 1) },
    ],
    hook: "$\\text{Prin}_t = Pv^{n-t+1}$: moving $s$ payments later removes $s$ factors of $v$.",
    // Loan: P = 1000, n = 15, i = 6%, t = 3, s = 5: Prin_3 = 1000 v^13.
    sample: { Pt: 1000 * Math.pow(1.06, -13), i: 0.06, s: 5 },
    reference: (s) => {
      // Simulate the loan of 1000 a_15 and read principal in payment 8.
      let b = 1000 * an(15, s.i);
      let prin = 0;
      for (let k = 1; k <= 3 + s.s; k += 1) {
        prin = 1000 - b * s.i;
        b -= prin;
      }
      return prin;
    },
  },
  {
    id: "drop-payment",
    formula: "D.drop-balloon",
    area: "D",
    topic: "LOANS",
    prompt: "A loan $L$ is repaid by level payments $P$ at the end of each period for $N$ periods, then a smaller *drop* payment one period later clears it. The drop payment.",
    correct: { latex: `L(1+i)^{N+1} - P\\,${SDN("N")}`, f: (s) => s.L * Math.pow(1 + s.i, N(s) + 1) - s.P * sdue(N(s), s.i) },
    wrong: [
      { latex: `L(1+i)^{N} - P\\,${SN("N")}`, why: "That is $B_N$, the balance at time $N$; the drop payment is a period later and has earned a period's interest.", f: (s) => s.L * Math.pow(1 + s.i, N(s)) - s.P * sn(N(s), s.i) },
      { latex: `L(1+i)^{N+1} - P\\,${SN("N")}`, why: "The $N$ payments must also be carried to time $N + 1$: $s_{\\overline{N|}}(1+i) = \\ddot s_{\\overline{N|}}$.", f: (s) => s.L * Math.pow(1 + s.i, N(s) + 1) - s.P * sn(N(s), s.i) },
      { latex: `P - \\left[L(1+i)^{N} - P\\,${SN("N")}\\right]`, why: "The drop payment is what is *owed*, not the shortfall from a full payment.", f: (s) => s.P - (s.L * Math.pow(1 + s.i, N(s)) - s.P * sn(N(s), s.i)) },
    ],
    hook: "Drop = $B_N(1+i)$: accumulate the balance after the last regular payment to the drop date.",
    sample: { L: 10000, i: 0.06, P: 1500 },
    reference: (s) => balanceAfter(s.L, s.i, s.P, fullPayments(s.L, s.i, s.P)) * (1 + s.i),
  },
  {
    id: "loan-payment-due",
    formula: "D.loan-payment",
    area: "D",
    topic: "LOANS",
    prompt: "The level payment that repays a loan $L$ by $n$ payments at the *start* of each period (the first on the loan date).",
    correct: { latex: `\\frac{L}{${ADN("n")}}`, f: (s) => s.L / adue(s.n, s.i) },
    wrong: [
      { latex: `\\frac{L}{${AN("n")}}`, why: "That is the payment for end-of-period payments; paying earlier means paying less.", f: (s) => s.L / an(s.n, s.i) },
      { latex: `\\frac{L}{${SDN("n")}}`, why: "Divides by an accumulated value: that is the deposit to *build up* $L$ by time $n$.", f: (s) => s.L / sdue(s.n, s.i) },
      { latex: `\\frac{L}{${ADN("n+1")}}`, why: "There are $n$ payments, not $n + 1$.", f: (s) => s.L / adue(s.n + 1, s.i) },
    ],
    hook: "Loan = PV of payments, valued on the loan date: $L = P\\ddot a_{\\overline{n|}}$.",
    sample: { L: 20000, i: 0.06, n: 8 },
    reference: (s) => {
      // The balance after n start-of-period payments is linear in P; find the zero.
      const end = (P: number) => {
        let b = s.L;
        for (let k = 0; k < s.n; k += 1) b = (b - P) * (1 + s.i);
        return b;
      };
      return end(0) / (end(0) - end(1));
    },
  },
  {
    id: "loan-payment-monthly",
    formula: "D.loan-payment",
    area: "D",
    topic: "LOANS",
    prompt: "The level payment made at the end of every $m$-th of a year that repays a loan $L$ over $n$ years at annual effective rate $i$.",
    correct: { latex: "\\frac{L}{m\\,a^{(m)}_{\\overline{n|}}}", f: (s) => s.L / (s.m * (1 - v(s.i, s.n)) / iM(s.i, s.m)) },
    wrong: [
      { latex: "\\frac{L}{a^{(m)}_{\\overline{n|}}}", why: "$a^{(m)}$ values $1/m$ per payment: that gives the *annual* total, $m$ times the payment.", f: (s) => s.L / ((1 - v(s.i, s.n)) / iM(s.i, s.m)) },
      { latex: `\\frac{L}{m\\,${AN("n")}}`, why: "Uses year-end payments; the money is paid during the year, so $a^{(m)} > a$.", f: (s) => s.L / (s.m * an(s.n, s.i)) },
      { latex: `\\frac{L}{${AN("mn")}{}_{i}}`, why: "$mn$ payments need the rate per $m$-th of a year, $j = (1+i)^{1/m} - 1$, not $i$.", f: (s) => s.L / an(s.m * s.n, s.i) },
    ],
    hook: "Either $L = mX\\,a^{(m)}_{\\overline{n|}i}$, or $L = X\\,a_{\\overline{mn|}j}$ with $j$ the rate per payment period.",
    sample: { L: 50000, i: 0.06, n: 5, m: 12 },
    reference: (s) => s.L / an(s.m * s.n, Math.pow(1 + s.i, 1 / s.m) - 1),
  },

  // ============================================================ E. Bonds
  {
    id: "book-value-retrospective",
    formula: "E.book-value",
    area: "E",
    topic: "BONDS",
    prompt: "The book value of a bond just after the $t$-th coupon, from its price $P$ (retrospective form).",
    correct: { latex: `P(1+i)^t - Fr\\,${SN("t")}`, f: (s) => s.Pr * Math.pow(1 + s.i, s.t) - s.F * s.r * sn(s.t, s.i) },
    wrong: [
      { latex: `P(1+i)^t - Fr\\,${AN("t")}`, why: "The coupons already paid must be *accumulated* to time $t$, not discounted.", f: (s) => s.Pr * Math.pow(1 + s.i, s.t) - s.F * s.r * an(s.t, s.i) },
      { latex: `P(1+i)^t - Fr\\,${SDN("t")}`, why: "Coupons are paid at the end of each period: $s_{\\overline{t|}}$.", f: (s) => s.Pr * Math.pow(1 + s.i, s.t) - s.F * s.r * sdue(s.t, s.i) },
      { latex: `P(1+i)^t - Ci\\,${SN("t")}`, why: "The bond pays $Fr$ per coupon; $Ci$ is the interest the yield demands on $C$.", f: (s) => s.Pr * Math.pow(1 + s.i, s.t) - s.C * s.i * sn(s.t, s.i) },
    ],
    hook: "A bond is a loan: price grown at the yield, minus the coupons received grown at the yield.",
    sample: { F: 1000, r: 0.06, C: 1050, n: 10, i: 0.08, t: 4, Pr: pvAt(bondFlows(1000, 0.06, 1050, 10), 0.08) },
    reference: (s) => bookValue(s, s.t),
  },
  {
    id: "discount-accumulation",
    formula: "E.bond-amortization",
    area: "E",
    topic: "BONDS",
    prompt: "For a bond bought at a discount ($Fr < Ci$), the amount by which the book value is written *up* at coupon $t$.",
    correct: { latex: "(Ci - Fr)\\,v^{n-t+1}", f: (s) => (s.C * s.i - s.F * s.r) * v(s.i, s.n - s.t + 1) },
    wrong: [
      { latex: "(Ci - Fr)\\,v^{n-t}", why: "Off by one: the first write-up is $(Ci - Fr)v^n$, so payment $t$ has $v^{n-t+1}$.", f: (s) => (s.C * s.i - s.F * s.r) * v(s.i, s.n - s.t) },
      { latex: "(Ci - Fr)\\,v^{t}", why: "Write-ups *grow* toward maturity; $v^t$ shrinks.", f: (s) => (s.C * s.i - s.F * s.r) * v(s.i, s.t) },
      { latex: "(Ci - Fr)\\,(1+i)^{t-1}", why: "Growth is right, but the starting size is $(Ci - Fr)v^n$, not $Ci - Fr$.", f: (s) => (s.C * s.i - s.F * s.r) * Math.pow(1 + s.i, s.t - 1) },
    ],
    hook: "Same shape as the premium write-down and the loan's principal part: (level gap) × $v^{n-t+1}$.",
    sample: { F: 1000, r: 0.05, C: 1000, n: 10, i: 0.07, t: 4 },
    reference: (s) => bookValue(s, s.t) - bookValue(s, s.t - 1),
  },
  {
    id: "bond-interest-earned",
    formula: "E.bond-amortization",
    area: "E",
    topic: "BONDS",
    prompt: "The interest earned (at the purchase yield $i$) in the $t$-th coupon period of a bond.",
    correct: { latex: "I_t = i\\,BV_{t-1}", f: (s) => s.i * bookValue(s, s.t - 1) },
    wrong: [
      { latex: "I_t = Fr", why: "That is the coupon. Interest earned differs from the coupon by the write-down/write-up.", f: (s) => s.F * s.r },
      { latex: "I_t = i\\,BV_t", why: "Interest accrues on the book value at the *start* of the period.", f: (s) => s.i * bookValue(s, s.t) },
      { latex: "I_t = Ci", why: "$Ci$ is constant; the interest earned changes as the book value moves toward $C$.", f: (s) => s.C * s.i },
    ],
    hook: "Exactly like a loan: interest = rate × balance at the start of the period.",
    sample: { F: 1000, r: 0.08, C: 1000, n: 10, i: 0.06, t: 3 },
    reference: (s) => bookValue(s, s.t) - bookValue(s, s.t - 1) + s.F * s.r,
  },
  {
    id: "modified-coupon-rate",
    formula: "E.makeham",
    area: "E",
    topic: "BONDS",
    prompt: "The modified coupon rate $g$ of a bond with face $F$, coupon rate $r$ and redemption value $C$.",
    correct: { latex: "g = \\frac{Fr}{C}", f: (s) => (s.F * s.r) / s.C },
    wrong: [
      { latex: "g = \\frac{Fr}{P}", why: "Coupon over price is the *current yield*, not $g$.", f: (s) => (s.F * s.r) / s.Pr },
      { latex: "g = r", why: "Only when $C = F$. $g$ re-expresses the coupon per unit of *redemption* value.", f: (s) => s.r },
      { latex: "g = \\frac{Cr}{F}", why: "Ratio upside down: $Fr = Cg$.", f: (s) => (s.C * s.r) / s.F },
    ],
    hook: "Same coupon, measured against $C$: $Fr = Cg$.",
    sample: { F: 1000, r: 0.06, C: 1100, Pr: 1040 },
    reference: (s) => {
      // g is the rate on C that reproduces the same coupon: solve C·x = Fr.
      return bisect((x) => s.C * x - s.F * s.r, 0, 1);
    },
  },
  {
    id: "premium-amount",
    formula: "E.premium-discount",
    area: "E",
    topic: "BONDS",
    prompt: "The premium $P - C$ on a bond with $Fr > Ci$ ($n$ coupons, yield $i$).",
    correct: { latex: `(Fr - Ci)\\,${AN("n")}`, f: (s) => (s.F * s.r - s.C * s.i) * an(s.n, s.i) },
    wrong: [
      { latex: `(Fr - Ci)\\,${SN("n")}`, why: "The premium is a value *today*: the PV of the excess coupons, not their accumulated value.", f: (s) => (s.F * s.r - s.C * s.i) * sn(s.n, s.i) },
      { latex: `(Fr - Fi)\\,${AN("n")}`, why: "The yield's demanded interest is on the redemption value $C$, not $F$.", f: (s) => (s.F * s.r - s.F * s.i) * an(s.n, s.i) },
      { latex: "(Fr - Ci)\\,n", why: "Adds the excess coupons without discounting them.", f: (s) => (s.F * s.r - s.C * s.i) * s.n },
    ],
    hook: "Each coupon exceeds the interest the buyer demands on $C$ by $Fr - Ci$; the premium is the PV of those excesses.",
    sample: { F: 1000, r: 0.08, C: 1050, n: 12, i: 0.06 },
    reference: (s) => pvAt(bondFlows(s.F, s.r, s.C, s.n), s.i) - s.C,
  },
  {
    id: "callable-premium",
    formula: "E.callable",
    area: "E",
    topic: "BONDS",
    prompt: "A bond with $Fr > Ci$ is callable at $C$ (no call premium) at any coupon date from $m$ to $n$. The highest price that guarantees yield $i$.",
    correct: { latex: `C + (Fr - Ci)\\,${AN("m")}`, f: (s) => s.C + (s.F * s.r - s.C * s.i) * an(s.m, s.i) },
    wrong: [
      { latex: `C + (Fr - Ci)\\,${AN("n")}`, why: "Assumes the latest date — but a premium bond is worst for the buyer when called *early*, cutting off the excess coupons.", f: (s) => s.C + (s.F * s.r - s.C * s.i) * an(s.n, s.i) },
      { latex: `C - (Fr - Ci)\\,${AN("m")}`, why: "Sign: excess coupons add to the price.", f: (s) => s.C - (s.F * s.r - s.C * s.i) * an(s.m, s.i) },
      { latex: `Fr\\,${AN("n")} + Cv^{m}`, why: "Mixes two redemption dates: coupons stop when the bond is redeemed.", f: (s) => s.F * s.r * an(s.n, s.i) + s.C * v(s.i, s.m) },
    ],
    hook: "Price at every possible date and take the lowest. Premium bond → earliest call; discount bond → latest.",
    sample: { F: 1000, r: 0.08, C: 1000, i: 0.06, m: 5, n: 15 },
    reference: (s) => Math.min(...Array.from({ length: s.n - s.m + 1 }, (_, k) => pvAt(bondFlows(s.F, s.r, s.C, s.m + k), s.i))),
  },
  {
    id: "callable-discount",
    formula: "E.callable",
    area: "E",
    topic: "BONDS",
    prompt: "A bond with $Fr < Ci$ is callable at $C$ at any coupon date from $m$ to $n$. The highest price that guarantees yield $i$.",
    correct: { latex: `C - (Ci - Fr)\\,${AN("n")}`, f: (s) => s.C - (s.C * s.i - s.F * s.r) * an(s.n, s.i) },
    wrong: [
      { latex: `C - (Ci - Fr)\\,${AN("m")}`, why: "Earliest date: but a discount bond hurts the buyer most when redeemed *late*, postponing the gain to $C$.", f: (s) => s.C - (s.C * s.i - s.F * s.r) * an(s.m, s.i) },
      { latex: `C + (Ci - Fr)\\,${AN("n")}`, why: "Sign: a discount bond sells *below* $C$.", f: (s) => s.C + (s.C * s.i - s.F * s.r) * an(s.n, s.i) },
      { latex: `C - (Ci - Fr)\\,${AN("\\frac{m+n}{2}")}`, why: "There is no averaging of call dates: the guaranteed price is the minimum over all dates.", f: (s) => s.C - (s.C * s.i - s.F * s.r) * an((s.m + s.n) / 2, s.i) },
    ],
    hook: "Price at every date and take the minimum. Discount bond → latest date.",
    sample: { F: 1000, r: 0.05, C: 1000, i: 0.07, m: 6, n: 14 },
    reference: (s) => Math.min(...Array.from({ length: s.n - s.m + 1 }, (_, k) => pvAt(bondFlows(s.F, s.r, s.C, s.m + k), s.i))),
  },

  // ============================================================ F. Term structure
  {
    id: "forward-from-prices",
    formula: "F.forward",
    area: "F",
    topic: "ALM",
    prompt: "The one-year forward rate $f_{t,t+1}$ from the prices $P_t, P_{t+1}$ of zero-coupon bonds paying 1 at $t$ and $t + 1$.",
    correct: { latex: "f_{t,t+1} = \\frac{P_t}{P_{t+1}} - 1", f: (s) => P(s, s.t) / P(s, s.t + 1) - 1 },
    wrong: [
      { latex: "\\frac{P_{t+1}}{P_t} - 1", why: "Upside down — negative. The later bond is cheaper, so $P_t/P_{t+1} > 1$.", f: (s) => P(s, s.t + 1) / P(s, s.t) - 1 },
      { latex: "\\frac{P_t - P_{t+1}}{P_t}", why: "Measures the gain against the end value $P_t$: that is a forward *discount* rate.", f: (s) => (P(s, s.t) - P(s, s.t + 1)) / P(s, s.t) },
      { latex: "P_{t+1}^{-1/(t+1)} - 1", why: "That is the spot rate $s_{t+1}$, not the forward rate.", f: (s) => Math.pow(P(s, s.t + 1), -1 / (s.t + 1)) - 1 },
    ],
    hook: "Pay $P_{t+1}$ for 1 at $t + 1$ instead of $P_t$ for 1 at $t$: the ratio is one year's growth.",
    sample: { t: 2 },
    reference: (s) => Math.pow(1 + SPOTS[s.t + 1], s.t + 1) / Math.pow(1 + SPOTS[s.t], s.t) - 1,
  },
  {
    id: "spot-from-forwards",
    formula: "F.forward-chain",
    area: "F",
    topic: "ALM",
    prompt: "The 3-year spot rate $s_3$ from the one-year forward rates $f_{0,1}, f_{1,2}, f_{2,3}$.",
    correct: { latex: "s_3 = \\left[(1+f_{0,1})(1+f_{1,2})(1+f_{2,3})\\right]^{1/3} - 1", f: (s) => Math.pow((1 + s.f1) * (1 + s.f2) * (1 + s.f3), 1 / 3) - 1 },
    wrong: [
      { latex: "s_3 = \\frac{f_{0,1} + f_{1,2} + f_{2,3}}{3}", why: "An arithmetic average — close, but the spot rate is the *geometric* average of the growth factors.", f: (s) => (s.f1 + s.f2 + s.f3) / 3 },
      { latex: "s_3 = (1+f_{0,1})(1+f_{1,2})(1+f_{2,3}) - 1", why: "That is the total 3-year return; $s_3$ is an annual rate.", f: (s) => (1 + s.f1) * (1 + s.f2) * (1 + s.f3) - 1 },
      { latex: "s_3 = f_{2,3}", why: "The forward for the last year is not the spot rate for the whole three years.", f: (s) => s.f3 },
    ],
    hook: "$(1+s_3)^3 = (1+f_{0,1})(1+f_{1,2})(1+f_{2,3})$.",
    sample: { f1: 0.02, f2: 0.05, f3: 0.1 },
    reference: (s) => bisect((x) => Math.pow(1 + x, 3) - (1 + s.f1) * (1 + s.f2) * (1 + s.f3), 0, 1),
  },
  {
    id: "spot-pricing",
    formula: "F.spot-pricing",
    area: "F",
    topic: "ALM",
    prompt: "The price of a 3-year bond with annual coupons $c$ and redemption $C$, from the spot rates $s_1, s_2, s_3$.",
    correct: { latex: "\\frac{c}{1+s_1} + \\frac{c}{(1+s_2)^2} + \\frac{c + C}{(1+s_3)^3}", f: (s) => s.c / (1 + s.s1) + s.c / (1 + s.s2) ** 2 + (s.c + s.C) / (1 + s.s3) ** 3 },
    wrong: [
      { latex: "\\frac{c}{1+s_3} + \\frac{c}{(1+s_3)^2} + \\frac{c + C}{(1+s_3)^3}", why: "Discounts every cash flow at the 3-year rate. Each flow uses the spot rate for *its own* date.", f: (s) => s.c / (1 + s.s3) + s.c / (1 + s.s3) ** 2 + (s.c + s.C) / (1 + s.s3) ** 3 },
      { latex: "\\frac{c}{1+s_1} + \\frac{c}{(1+s_1)(1+s_2)} + \\frac{c + C}{(1+s_1)(1+s_2)(1+s_3)}", why: "Chains spot rates as if they were one-year forwards. A spot rate already covers the whole period from 0.", f: (s) => s.c / (1 + s.s1) + s.c / ((1 + s.s1) * (1 + s.s2)) + (s.c + s.C) / ((1 + s.s1) * (1 + s.s2) * (1 + s.s3)) },
      { latex: "\\frac{c}{1+s_1} + \\frac{c}{1+s_2} + \\frac{c + C}{1+s_3}", why: "A $t$-year spot rate is an *annual* rate: raise $1 + s_t$ to the power $t$.", f: (s) => s.c / (1 + s.s1) + s.c / (1 + s.s2) + (s.c + s.C) / (1 + s.s3) },
    ],
    hook: "Each cash flow is a zero-coupon bond: discount it at the spot rate for its date.",
    sample: { c: 60, C: 1000, s1: 0.03, s2: 0.04, s3: 0.05 },
    reference: (s) => {
      // Build the one-year forwards from the spots and discount year by year.
      const f1 = s.s1;
      const f2 = (1 + s.s2) ** 2 / (1 + s.s1) - 1;
      const f3 = (1 + s.s3) ** 3 / (1 + s.s2) ** 2 - 1;
      const d1 = 1 / (1 + f1);
      const d2 = d1 / (1 + f2);
      const d3 = d2 / (1 + f3);
      return s.c * d1 + s.c * d2 + (s.c + s.C) * d3;
    },
  },

  // ============================================================ G. Duration, convexity, immunization
  {
    id: "macaulay-bond",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of a bond (face $F$, coupon rate $r$, redemption $C$, $n$ annual coupons, price $P$ at yield $i$).",
    correct: { latex: "\\frac{Fr\\,(Ia)_{\\overline{n|}} + nCv^n}{P}", f: (s) => (s.F * s.r * Ia(s.n, s.i) + s.n * s.C * v(s.i, s.n)) / price(s) },
    wrong: [
      { latex: "\\frac{Fr\\,(Ia)_{\\overline{n|}} + Cv^n}{P}", why: "The redemption at time $n$ must be weighted by its time, $n$.", f: (s) => (s.F * s.r * Ia(s.n, s.i) + s.C * v(s.i, s.n)) / price(s) },
      { latex: "\\frac{Fr\\,(Da)_{\\overline{n|}} + nCv^n}{P}", why: "Weights are the times $1, 2, \\dots, n$ — increasing, not decreasing.", f: (s) => (s.F * s.r * Da(s.n, s.i) + s.n * s.C * v(s.i, s.n)) / price(s) },
      { latex: "\\frac{Fr\\,(Ia)_{\\overline{n|}} + nCv^n}{C}", why: "Divide by the price $P$ (the total PV), not the redemption value.", f: (s) => (s.F * s.r * Ia(s.n, s.i) + s.n * s.C * v(s.i, s.n)) / s.C },
    ],
    hook: "$\\sum t\\,CF_t v^t / P$: coupons give $Fr(Ia)_{\\overline{n|}}$, redemption gives $nCv^n$.",
    sample: { F: 1000, r: 0.05, C: 1000, n: 8, i: 0.07 },
    reference: (s) => macD(bondFlows(s.F, s.r, s.C, s.n), s.i),
  },
  {
    id: "macaulay-convexity",
    formula: "G.macaulay-convexity",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay convexity $P''(\\delta)/P(\\delta)$ of cash flows $CF_t$.",
    correct: { latex: "\\frac{\\sum t^2\\,CF_t\\,v^t}{\\sum CF_t\\,v^t}", f: (s) => S2(s.i) / S0(s.i) },
    wrong: [
      { latex: "\\left(\\frac{\\sum t\\,CF_t\\,v^t}{\\sum CF_t\\,v^t}\\right)^2", why: "The square of the duration. Convexity averages $t^2$; this squares the average of $t$ (always smaller).", f: (s) => (S1(s.i) / S0(s.i)) ** 2 },
      { latex: "\\frac{\\sum t(t+1)\\,CF_t\\,v^{t+2}}{\\sum CF_t\\,v^t}", why: "That is the *modified* convexity, $P''(i)/P(i)$.", f: (s) => S2mod(s.i) / S0(s.i) },
      { latex: "\\frac{\\sum t^2\\,CF_t\\,v^t}{\\sum t\\,CF_t\\,v^t}", why: "Divide by the price, not by the duration numerator.", f: (s) => S2(s.i) / S1(s.i) },
    ],
    hook: "Differentiate $e^{-\\delta t}$ twice in $\\delta$: $t^2e^{-\\delta t}$. A PV-weighted average of $t^2$.",
    sample: { i: 0.06 },
    reference: (s) => macC(CONV_FLOWS, s.i),
  },
  {
    id: "second-order-approx",
    formula: "G.approx-second-order",
    area: "G",
    topic: "ALM",
    prompt: "The second-order (duration + convexity) approximation of the price at a new yield $i_1$.",
    correct: { latex: "P(i_0)\\left[1 - (i_1 - i_0)D_{mod} + \\frac{(i_1 - i_0)^2}{2}C\\right]", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm + ((s.i1 - s.i0) ** 2 / 2) * s.Cv) },
    wrong: [
      { latex: "P(i_0)\\left[1 - (i_1 - i_0)D_{mod} + (i_1 - i_0)^2C\\right]", why: "Taylor's second-order term carries a $\\tfrac12$.", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm + (s.i1 - s.i0) ** 2 * s.Cv) },
      { latex: "P(i_0)\\left[1 - (i_1 - i_0)D_{mod} - \\frac{(i_1 - i_0)^2}{2}C\\right]", why: "Positive convexity *adds* to the price whichever way the yield moves.", f: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm - ((s.i1 - s.i0) ** 2 / 2) * s.Cv) },
      { latex: "P(i_0)\\left[1 + (i_1 - i_0)D_{mod} + \\frac{(i_1 - i_0)^2}{2}C\\right]", why: "A rise in yield lowers the price: the duration term is negative.", f: (s) => s.P0 * (1 + (s.i1 - s.i0) * s.Dm + ((s.i1 - s.i0) ** 2 / 2) * s.Cv) },
    ],
    hook: "Taylor: $P(i_1) \\approx P + P'\\Delta i + \\tfrac12 P''(\\Delta i)^2$, with $P' = -D_{mod}P$ and $P'' = CP$.",
    sample: { P0: 100, i0: 0.05, i1: 0.07, Dm: 8.2, Cv: 95 },
    reference: (s) => s.P0 * (1 - (s.i1 - s.i0) * s.Dm + 0.5 * (s.i1 - s.i0) ** 2 * s.Cv),
    exact: false,
  },
  {
    id: "modified-mthly",
    formula: "G.modified",
    area: "G",
    topic: "ALM",
    prompt: "Modified duration with respect to a nominal yield $i^{(m)}$ convertible $m$ times a year, from the Macaulay duration (in years).",
    correct: { latex: "D_{mod} = \\frac{D_{mac}}{1 + i^{(m)}/m}", f: (s) => s.Dmac / (1 + s.im / s.m) },
    wrong: [
      { latex: "\\frac{D_{mac}}{1 + i^{(m)}}", why: "The discount factor in $D_{mod} = v\\,D_{mac}$ is for *one period*, $1/(1 + i^{(m)}/m)$.", f: (s) => s.Dmac / (1 + s.im) },
      { latex: "\\frac{D_{mac}}{1 + i}", why: "That is the modified duration with respect to the *annual effective* yield.", f: (s) => s.Dmac / Math.pow(1 + s.im / s.m, s.m) },
      { latex: "D_{mac}\\left(1 + i^{(m)}/m\\right)", why: "Multiplies by $1 + j$ instead of by $v$: modified duration is the smaller one.", f: (s) => s.Dmac * (1 + s.im / s.m) },
    ],
    hook: "$D_{mod} = v\\cdot D_{mac}$, with $v$ the discount factor for *one period* of the quoted rate.",
    // A 5-year bond with semiannual coupons of 3 per 100 at nominal 8% convertible semiannually.
    sample: { m: 2, im: 0.08, Dmac: macDNominal(0.08) },
    reference: (s) => {
      const h = 1e-6;
      const price = (y: number) => SEMI_FLOWS.reduce((a, f) => a + f.amount * Math.pow(1 + y / s.m, -s.m * f.t), 0);
      return -(price(s.im + h) - price(s.im - h)) / (2 * h) / price(s.im);
    },
  },
  {
    id: "par-bond-duration-mthly",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration (in years) of an $n$-year par bond with coupons $m$ times a year, where $j = i^{(m)}/m$ is the yield per coupon period.",
    correct: { latex: "\\tfrac{1}{m}\\,\\ddot a_{\\overline{mn|}\\,j}", f: (s) => adue(s.m * s.n, s.j) / s.m },
    wrong: [
      { latex: "\\ddot a_{\\overline{mn|}\\,j}", why: "That is the duration in *coupon periods*; divide by $m$ for years.", f: (s) => adue(s.m * s.n, s.j) },
      { latex: "\\tfrac{1}{m}\\,a_{\\overline{mn|}\\,j}", why: "A par bond's duration is an annuity-*due*: $\\ddot a_{\\overline{n|}}$.", f: (s) => an(s.m * s.n, s.j) / s.m },
      { latex: "\\ddot a_{\\overline{n|}\\,j}", why: "Mixes years with the per-period rate: there are $mn$ coupon periods.", f: (s) => adue(s.n, s.j) },
    ],
    hook: "Par bond: $D_{mac} = \\ddot a^{(m)}_{\\overline{n|}i} = \\frac1m\\ddot a_{\\overline{mn|}j}$. The coupon size does not matter.",
    sample: { m: 2, n: 6, j: 0.035 },
    reference: (s) => {
      const flows: Flow[] = Array.from({ length: s.m * s.n }, (_, k) => ({ t: (k + 1) / s.m, amount: 100 * s.j + (k + 1 === s.m * s.n ? 100 : 0) }));
      return macD(flows, Math.pow(1 + s.j, s.m) - 1);
    },
  },
  {
    id: "portfolio-convexity",
    formula: "G.portfolio-duration",
    area: "G",
    topic: "ALM",
    prompt: "The convexity of a portfolio of two assets with prices $P_1, P_2$ and convexities $C_1, C_2$ (same yield).",
    correct: { latex: "\\frac{P_1C_1 + P_2C_2}{P_1 + P_2}", f: (s) => (s.P1 * s.C1 + s.P2 * s.C2) / (s.P1 + s.P2) },
    wrong: [
      { latex: "\\frac{C_1 + C_2}{2}", why: "A plain average ignores how much of the portfolio each asset is.", f: (s) => (s.C1 + s.C2) / 2 },
      { latex: "\\frac{P_1C_1 + P_2C_2}{P_1C_2 + P_2C_1}", why: "The weights are the prices; divide by the total price.", f: (s) => (s.P1 * s.C1 + s.P2 * s.C2) / (s.P1 * s.C2 + s.P2 * s.C1) },
      { latex: "C_1 + C_2", why: "Convexities are per unit of price — they average, they don't add.", f: (s) => s.C1 + s.C2 },
    ],
    hook: "Like duration: the price-weighted average.",
    // Zero-coupon 100 at t = 3 and 50 at t = 10, i = 6%: convexity of a zero at t is t(t+1)v².
    sample: { P1: 100 * Math.pow(1.06, -3), P2: 50 * Math.pow(1.06, -10), C1: 12 / 1.06 ** 2, C2: 110 / 1.06 ** 2 },
    reference: () =>
      modC(
        [
          { t: 3, amount: 100 },
          { t: 10, amount: 50 },
        ],
        0.06
      ),
  },
  {
    id: "full-immunization-amount",
    formula: "G.full-immunization",
    area: "G",
    topic: "ALM",
    prompt: "A liability $L$ is due at time $T$. It is fully immunized with zero-coupon bonds maturing at $a < T$ and $b > T$. The amount $A$ payable at time $a$.",
    correct: { latex: "A = L\\,v^{T-a}\\,\\frac{b - T}{b - a}", f: (s) => s.L * v(s.i, s.T - s.a) * ((s.b - s.T) / (s.b - s.a)) },
    wrong: [
      { latex: "L\\,v^{T-a}\\,\\frac{T - a}{b - a}", why: "Weights swapped: the asset *nearer* the liability gets the larger share. $A$'s share is $(b - T)/(b - a)$.", f: (s) => s.L * v(s.i, s.T - s.a) * ((s.T - s.a) / (s.b - s.a)) },
      { latex: "L\\,\\frac{b - T}{b - a}", why: "That share is of the *present value*; the amount paid at $a$ must be moved from $T$ to $a$ with $v^{T-a}$.", f: (s) => s.L * ((s.b - s.T) / (s.b - s.a)) },
      { latex: "L\\,(1+i)^{T-a}\\,\\frac{b - T}{b - a}", why: "Wrong direction: $a$ is before $T$, so the amount at $a$ is smaller — discount it.", f: (s) => s.L * Math.pow(1 + s.i, s.T - s.a) * ((s.b - s.T) / (s.b - s.a)) },
    ],
    hook: "Match PV and duration: $Av^a + Bv^b = Lv^T$ and $aAv^a + bBv^b = TLv^T$. Solve the pair.",
    sample: { L: 10000, T: 6, a: 2, b: 12, i: 0.05 },
    reference: (s) => {
      // Solve x + y = L v^T, a x + b y = T L v^T for the PVs x, y; then A = x (1+i)^a.
      const pv = s.L * v(s.i, s.T);
      const x = (s.b * pv - s.T * pv) / (s.b - s.a);
      return x * Math.pow(1 + s.i, s.a);
    },
  },
  {
    id: "duration-perpetuity-due",
    formula: "G.duration-special",
    area: "G",
    topic: "ALM",
    prompt: "The Macaulay duration of a level perpetuity-*due* (first payment now) at yield $i$.",
    correct: { latex: "\\frac{1}{i}", f: (s) => 1 / s.i },
    wrong: [
      { latex: "\\frac{1+i}{i}", why: "That is the perpetuity-*immediate*. Moving every payment one period earlier cuts the duration by exactly 1.", f: (s) => (1 + s.i) / s.i },
      { latex: "\\frac{1}{\\delta}", why: "Close, but the payments are discrete: $1/\\delta$ is the duration of a *continuous* perpetuity.", f: (s) => 1 / delta(s.i) },
      { latex: "\\frac{1}{i^2}", why: "That is the size of a PV, not an average time.", f: (s) => 1 / s.i ** 2 },
    ],
    hook: "Immediate: $\\frac{1+i}{i} = \\frac1d$. Due: one period less, $\\frac1d - 1 = \\frac1i$.",
    sample: { i: 0.05 },
    reference: (s) => {
      const N = 4000;
      return sum(0, N, (t) => t * v(s.i, t)) / sum(0, N, (t) => v(s.i, t));
    },
  },
];
