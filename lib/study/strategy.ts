/**
 * Solution strategy: exam-style problems where the options are not numbers but
 * *plans* — which formula to reach for, what to do first, how to set up the
 * equation of value, which trap to avoid. The aim is the instinct an exam
 * needs: recognising the shape of a problem before calculating anything.
 *
 * Each question carries:
 *   - a correct plan and three plausible wrong plans, each wrong plan with the
 *     reason it fails (and, where it leads to a number, the number it gives);
 *   - an `insight` — the pattern to remember;
 *   - where the problem has a numerical answer, `result.value` (the answer the
 *     correct plan produces, from closed forms) and `result.reference` (the
 *     same quantity computed independently, by brute force). The unit tests
 *     require the two to agree and every wrong plan's number to differ, so a
 *     "correct" plan can never quietly be wrong.
 */
import { Da, Ia, adue, an, sn, v } from "../engine/finance";
import type { FormulaArea } from "../formulas/types";
import type { TopicId } from "../syllabus";

export type StrategyKind = "plan" | "first-step" | "setup" | "trap";

export const STRATEGY_KIND_LABELS: Record<StrategyKind, string> = {
  plan: "Choose the plan",
  "first-step": "First move",
  setup: "Set it up",
  trap: "Spot the trap",
};

export const STRATEGY_KIND_ASK: Record<StrategyKind, string> = {
  plan: "Which plan solves it?",
  "first-step": "What should you do first?",
  setup: "Which set-up is right?",
  trap: "Which approach avoids the trap?",
};

export interface StrategyOption {
  /** The steps, in order (markup). A first-step or set-up option has one. */
  steps: string[];
  /** Wrong options: why the plan fails (markup). */
  why?: string;
  /** Wrong options that lead to a number: the number the plan would give. */
  value?: () => number;
}

export interface StrategyQuestion {
  id: string;
  topic: TopicId;
  area: FormulaArea;
  kind: StrategyKind;
  /** A short name for the problem type. */
  title: string;
  /** The exam-style problem (markup). */
  problem: string;
  correct: StrategyOption;
  wrong: [StrategyOption, StrategyOption, StrategyOption];
  /** The instinct to take away (markup). */
  insight: string;
  /** Formula library ids the correct plan uses. */
  formulas: string[];
  /** The numerical answer the correct plan leads to, when there is one. */
  result?: {
    label: string;
    value: () => number;
    reference: () => number;
    digits?: number;
  };
}

// ---------------------------------------------------------------- independent helpers

const sum = (a: number, b: number, fn: (k: number) => number): number => {
  let total = 0;
  for (let k = a; k <= b; k += 1) total += fn(k);
  return total;
};

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
const annualBond = (F: number, r: number, C: number, n: number): Flow[] => Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: F * r + (k + 1 === n ? C : 0) }));

/** Simulated level loan: balance just after payment t. */
const balance = (L: number, i: number, P: number, t: number) => {
  let b = L;
  for (let k = 1; k <= t; k += 1) b = b * (1 + i) - P;
  return b;
};
/** Payment that clears L in n periods, found by simulation (the end balance is linear in P). */
const payFor = (L: number, i: number, n: number) => {
  const b0 = balance(L, i, 0, n);
  const b1 = balance(L, i, 1, n);
  return b0 / (b0 - b1);
};

const AN = (n: string, rate = "") => `a_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;
const ADN = (n: string) => `\\ddot a_{\\overline{${n}|}}`;
const SN = (n: string, rate = "") => `s_{\\overline{${n}|}${rate ? `\\,${rate}` : ""}}`;

// ---------------------------------------------------------------- the bank

export const STRATEGY_QUESTIONS: StrategyQuestion[] = [
  // ================================================================== TVM
  {
    id: "tvm-mixed-regimes",
    topic: "TVM",
    area: "A",
    kind: "plan",
    title: "Accumulating through two rate regimes",
    problem:
      "1,000 is deposited at time 0. For the first 3 years the fund credits interest at a nominal 6% convertible monthly; for the next 2 years it credits a nominal rate of *discount* of 5% convertible quarterly. Find the accumulated value at time 5.",
    correct: {
      steps: ["Months 1–36: accumulate by $(1 + 0.06/12)^{36}$.", "Quarters 13–20: accumulate by $(1 - 0.05/4)^{-8}$.", "Multiply: $1000(1.005)^{36}(0.9875)^{-8}$."],
    },
    wrong: [
      {
        steps: ["Convert each rate to an annual effective rate.", "Average the two annual rates over the 5 years.", "Accumulate: $1000(1 + \\bar i)^5$."],
        why: "Averaging rates is not the same as chaining growth factors; each regime applies for its own length of time, so multiply the factors.",
        value: () => {
          const i1 = Math.pow(1.005, 12) - 1;
          const i2 = Math.pow(0.9875, -4) - 1;
          return 1000 * Math.pow(1 + (i1 + i2) / 2, 5);
        },
      },
      {
        steps: ["Months 1–36: accumulate by $(1.005)^{36}$.", "Quarters 13–20: accumulate by $(1 + 0.05/4)^{8}$.", "Multiply the two factors by 1,000."],
        why: "Treats the discount rate as an interest rate. Per quarter, a discount rate $d$ accumulates by $1/(1-d)$, which is more than $1 + d$.",
        value: () => 1000 * Math.pow(1.005, 36) * Math.pow(1.0125, 8),
      },
      {
        steps: ["Months 1–36: accumulate by $(1.005)^{36}$.", "Quarters 13–20: multiply by $(1 - 0.05/4)^{8}$.", "Multiply the two factors by 1,000."],
        why: "$(1 - d)^8$ *discounts*: the value would fall during the second regime.",
        value: () => 1000 * Math.pow(1.005, 36) * Math.pow(0.9875, 8),
      },
    ],
    insight: "When the rate changes, never average — chain the accumulation factors, each one in its own periods. A discount rate accumulates through $(1 - d^{(m)}/m)^{-1}$ per period.",
    formulas: ["A.nominal-equivalence", "A.compound"],
    result: {
      label: "Accumulated value at time 5",
      value: () => 1000 * Math.pow(1.005, 36) * Math.pow(0.9875, -8),
      reference: () => {
        let x = 1000;
        for (let k = 0; k < 36; k += 1) x *= 1 + 0.06 / 12;
        for (let k = 0; k < 8; k += 1) x /= 1 - 0.05 / 4;
        return x;
      },
      digits: 2,
    },
  },
  {
    id: "tvm-force-window",
    topic: "TVM",
    area: "A",
    kind: "setup",
    title: "Varying force over a window",
    problem: "The force of interest is $\\delta_t = 0.02t$ for $0 \\le t \\le 6$. 100 is deposited at time 2. Find its accumulated value at time 5.",
    correct: { steps: ["$100\\exp\\!\\left(\\int_2^5 0.02t\\,dt\\right)$"] },
    wrong: [
      { steps: ["$100\\exp\\!\\left(\\int_0^5 0.02t\\,dt\\right)$"], why: "Integrates from 0, but the money only arrives at time 2: it earns nothing before it is deposited.", value: () => 100 * Math.exp(0.25) },
      { steps: ["$100\\exp\\!\\left(3\\,\\delta_5\\right)$"], why: "Applies the force at time 5 to the whole three years; the force changes, so integrate it.", value: () => 100 * Math.exp(3 * 0.1) },
      { steps: ["$100\\left(1 + \\int_2^5 0.02t\\,dt\\right)$"], why: "Linear growth ignores interest on interest; the factor is the exponential of the integral.", value: () => 100 * 1.21 },
    ],
    insight: "Accumulating from $t_1$ to $t_2$: $\\exp\\int_{t_1}^{t_2}\\delta_t\\,dt$ — the limits are the dates the money *moves between*.",
    formulas: ["A.force-accumulation"],
    result: { label: "Accumulated value at time 5", value: () => 100 * Math.exp(0.21), reference: () => 100 * Math.exp(integrate((t) => 0.02 * t, 2, 5)), digits: 2 },
  },
  {
    id: "tvm-doubling-time",
    topic: "TVM",
    area: "A",
    kind: "first-step",
    title: "Unknown time",
    problem: "How long does it take money to double at a nominal 7% convertible semiannually?",
    correct: { steps: ["Solve $(1.035)^{2t} = 2$ with logarithms."] },
    wrong: [
      { steps: ["Use the rule of 72: $t \\approx 72/7$ years."], why: "An approximation (and no longer on the formula sheets); the exam's answer choices are usually closer together than its error.", value: () => 72 / 7 },
      { steps: ["Solve $1 + 0.07t = 2$ for $t$."], why: "That is simple interest. Here interest compounds every half-year.", value: () => 1 / 0.07 },
      { steps: ["Solve $(1.07)^{t} = 2$ with logarithms."], why: "7% is a *nominal* rate: the effective annual rate is $1.035^2 - 1 = 7.1225\\%$, not 7%.", value: () => Math.log(2) / Math.log(1.07) },
    ],
    insight: "Unknown time → equation of value in the rate's own periods, then logarithms. Never use a nominal rate as if it were effective.",
    formulas: ["M.logarithm", "A.nominal-conversion"],
    result: { label: "Years to double", value: () => Math.log(2) / (2 * Math.log(1.035)), reference: () => bisect((t) => Math.pow(1 + 0.07 / 2, 2 * t) - 2, 0, 50), digits: 3 },
  },
  {
    id: "tvm-replace-payments",
    topic: "TVM",
    area: "A",
    kind: "setup",
    title: "Replacing payments by one payment",
    problem: "Payments of 500 now and 800 at time 3 are to be replaced by a single payment $X$ at time 2. Interest is 5% effective. Which equation gives $X$?",
    correct: { steps: ["$X = 500(1.05)^2 + 800(1.05)^{-1}$"] },
    wrong: [
      { steps: ["$X = 500 + 800$"], why: "Adds payments made at different times without moving them to a common date.", value: () => 1300 },
      { steps: ["$X = 500 + 800(1.05)^{-3}$"], why: "That is the value at time 0. $X$ is paid at time 2, so the comparison date should be 2 (or $X$ must be discounted too).", value: () => 500 + 800 * Math.pow(1.05, -3) },
      { steps: ["$X = 500(1.05)^2 + 800(1.05)^{1}$"], why: "The 800 is paid *after* time 2, so bring it back with $v$, not forward.", value: () => 500 * 1.05 ** 2 + 800 * 1.05 },
    ],
    insight: "Pick a comparison date (the date of the unknown is easiest) and move every payment there: earlier payments accumulate, later ones discount.",
    formulas: ["A.equation-of-value"],
    result: { label: "X", value: () => 500 * 1.05 ** 2 + 800 / 1.05, reference: () => (500 + 800 * Math.pow(1.05, -3)) * Math.pow(1.05, 2), digits: 2 },
  },
  {
    id: "tvm-quadratic-rate",
    topic: "TVM",
    area: "A",
    kind: "plan",
    title: "Unknown rate from two deposits",
    problem: "Deposits of 100 at time 0 and 100 at time 1 accumulate to 250 at time 2. Find the annual effective rate.",
    correct: {
      steps: ["Equation of value at time 2 with $x = 1 + i$: $100x^2 + 100x = 250$.", "Take the positive root of $x^2 + x - 2.5 = 0$; $i = x - 1$."],
    },
    wrong: [
      { steps: ["Both deposits at time 0: $200(1+i)^2 = 250$.", "Take the square root: $i = \\sqrt{1.25} - 1$."], why: "The second deposit earns interest for only one year.", value: () => Math.sqrt(1.25) - 1 },
      { steps: ["Simple interest: $100(1 + 2i) + 100(1 + i) = 250$.", "Solve the linear equation for $i$."], why: "The rate is effective (compound); simple interest gives a different answer.", value: () => 50 / 300 },
      { steps: ["Equation of value at time 2 with $x = v$: $100v^2 + 100v = 250$.", "Take the positive root; then $i = 1/v - 1$."], why: "Uses discount factors on accumulating payments: the equation at time 2 needs $(1+i)$, not $v$. (Here it has no root with $v < 1$.)" },
    ],
    insight: "Two or three cash flows with an unknown rate: an equation of value often becomes a polynomial in $1 + i$. Solve it — or use the cash-flow/IRR worksheet.",
    formulas: ["A.equation-of-value", "M.root-finding"],
    result: { label: "Annual effective rate", value: () => (-1 + Math.sqrt(11)) / 2 - 1, reference: () => bisect((i) => 100 * (1 + i) ** 2 + 100 * (1 + i) - 250, 0, 1), digits: 4 },
  },
  {
    id: "tvm-simple-vs-compound",
    topic: "TVM",
    area: "A",
    kind: "trap",
    title: "Equal effective rates in a given year",
    problem: "Fund A earns simple interest at 8%. Fund B earns compound interest at rate $i$. In year 5 the two funds have the same effective rate of interest. Find $i$.",
    correct: { steps: ["A\'s effective rate in year 5: $\\frac{0.08}{1 + 0.08 \\times 4}$.", "Set $i$ equal to it."] },
    wrong: [
      { steps: ["A\'s accumulated value at time 5: $1 + 0.08 \\times 5$.", "Set it equal to $(1+i)^5$ and solve."], why: "Answers a different question — equal *accumulated values* at time 5, not equal *rates in year 5*.", value: () => Math.pow(1.4, 0.2) - 1 },
      { steps: ["A\'s effective rate is 8% in every year.", "Set $i = 8\\%$."], why: "Under simple interest the effective rate falls every year; only in year 1 is it 8%.", value: () => 0.08 },
      { steps: ["A\'s effective rate in year 5: $\\frac{0.08}{1 + 0.08 \\times 5}$.", "Set $i$ equal to it."], why: "Divides by the balance at the *end* of year 5; the effective rate uses the balance at the start, $1 + 0.08 \\cdot 4$.", value: () => 0.08 / 1.4 },
    ],
    insight: "“Effective rate in year $t$” = interest in that year ÷ balance at the start of that year. Under simple interest that is $i/(1 + i(t-1))$.",
    formulas: ["A.simple", "A.effective-interest"],
    result: { label: "i", value: () => 0.08 / 1.32, reference: () => (1 + 0.08 * 5 - (1 + 0.08 * 4)) / (1 + 0.08 * 4), digits: 5 },
  },
  {
    id: "tvm-real-value",
    topic: "TVM",
    area: "F",
    kind: "plan",
    title: "Real purchasing power",
    problem: "An investment earns 7% a year. Inflation is 3% a year. What is 1,000 invested today worth after 10 years, in today's money?",
    correct: { steps: ["Real rate: $1.07/1.03 - 1$.", "Accumulate 1,000 for 10 years at the real rate."] },
    wrong: [
      { steps: ["Real rate: $7\\% - 3\\% = 4\\%$.", "Accumulate 1,000 for 10 years at 4%."], why: "$i - r$ is only an approximation; the exact real rate is $(1.07/1.03) - 1 = 3.88\\%$.", value: () => 1000 * 1.04 ** 10 },
      { steps: ["Money growth: $1000(1.07)^{10}$.", "Report that: the 7% already reflects inflation."], why: "That is the value in *future* money; the question asks for today's purchasing power.", value: () => 1000 * 1.07 ** 10 },
      { steps: ["Money growth: $1000(1.07)^{10}$.", "Adjust for inflation: multiply by $(1.03)^{10}$."], why: "Inflation erodes value: divide by the price growth, don't multiply.", value: () => 1000 * 1.07 ** 10 * 1.03 ** 10 },
    ],
    insight: "Real = money growth ÷ price growth: $1 + i' = (1 + i)/(1 + r)$.",
    formulas: ["F.real-rate"],
    result: { label: "Value in today's money", value: () => 1000 * Math.pow(1.07 / 1.03, 10), reference: () => (1000 * 1.07 ** 10) / 1.03 ** 10, digits: 2 },
  },
  {
    id: "tvm-nominal-to-nominal",
    topic: "TVM",
    area: "A",
    kind: "first-step",
    title: "Nominal interest to nominal discount",
    problem: "Given $i^{(4)} = 8\\%$, find the equivalent $d^{(12)}$.",
    correct: { steps: ["Find $1 + i = (1.02)^4$, then $d^{(12)} = 12[1 - (1+i)^{-1/12}]$."] },
    wrong: [
      { steps: ["Apply $d = i/(1+i)$ directly: $d^{(12)} = 0.08/1.08$."], why: "$d = i/(1+i)$ links *effective* rates for the same period; it says nothing about nominal rates with different frequencies.", value: () => 0.08 / 1.08 },
      { steps: ["Both are annual nominal rates, so $d^{(12)} = 8\\%$."], why: "Nominal rates with different frequencies (and one of interest, one of discount) are not equal; compare accumulation factors.", value: () => 0.08 },
      { steps: ["Find $1 + i = (1.02)^4$, then $d^{(12)} = 12[(1+i)^{1/12} - 1]$."], why: "That is $i^{(12)}$ — the nominal *interest* rate. Discount needs $1 - (1+i)^{-1/12}$.", value: () => 12 * (Math.pow(1.02, 4 / 12) - 1) },
    ],
    insight: "Between any two nominal rates, pass through the annual accumulation factor $1 + i$: $\\left(1 + \\frac{i^{(m)}}{m}\\right)^m = 1 + i = \\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p}$.",
    formulas: ["A.nominal-equivalence"],
    result: { label: "d^(12)", value: () => 12 * (1 - Math.pow(1.02, -4 / 12)), reference: () => bisect((x) => Math.pow(1 - x / 12, -12) - Math.pow(1.02, 4), 0, 0.5), digits: 5 },
  },

  // ================================================================== ANNUITIES
  {
    id: "ann-deferred-perpetuity",
    topic: "ANNUITIES",
    area: "B",
    kind: "setup",
    title: "Deferred perpetuity",
    problem: "A perpetuity pays 100 at the end of each year, with the first payment at time 6. At 5% effective, which expression gives its present value?",
    correct: { steps: ["$100 \\cdot \\frac{1}{0.05} \\cdot v^5$"] },
    wrong: [
      { steps: ["$100 \\cdot \\frac{1}{0.05} \\cdot v^6$"], why: "$1/i$ already values the perpetuity one period before its first payment (time 5). Discount 5 years, not 6.", value: () => (100 / 0.05) * Math.pow(1.05, -6) },
      { steps: ["$100 \\cdot \\frac{1}{d} \\cdot v^5$"], why: "$1/d$ values at the first payment (time 6); discounting only 5 years leaves it at time 1.", value: () => (100 / (0.05 / 1.05)) * Math.pow(1.05, -5) },
      { steps: [`$\\frac{100}{0.05} - 100\\,${AN("6")}$`], why: "Removes the payments at times 1–6, so the first remaining one is at 7. Remove only 1–5.", value: () => 100 / 0.05 - 100 * an(6, 0.05) },
    ],
    insight: "Value an annuity where its formula naturally sits (one period before the first payment for $a$; at the first payment for $\\ddot a$), then move that single value.",
    formulas: ["B.perpetuity", "B.deferred"],
    result: { label: "Present value", value: () => (100 / 0.05) * Math.pow(1.05, -5), reference: () => sum(6, 4000, (t) => 100 * Math.pow(1.05, -t)), digits: 2 },
  },
  {
    id: "ann-increasing-then-level",
    topic: "ANNUITIES",
    area: "B",
    kind: "plan",
    title: "Increasing, then level forever",
    problem: "Payments are 100, 200, …, 1000 at the ends of years 1 to 10, then 1000 at the end of every year after that, forever. Find the present value at 5%.",
    correct: { steps: ["Years 1–10: $100(Ia)_{\\overline{10|}}$.", "Years 11 on: $\\frac{1000}{0.05}v^{10}$.", "Add the two values."] },
    wrong: [
      { steps: ["Treat the payments as one increasing stream.", "Value it as $100(Ia)_{\\overline{\\infty|}}$.", "No split is needed."], why: "Keeps the payments increasing forever; they level off at 1000.", value: () => 100 * (1 / (0.05 * (0.05 / 1.05))) },
      { steps: ["Years 1–10: $100(Ia)_{\\overline{10|}}$.", "Years 11 on: $\\frac{1000}{0.05}$.", "Add the two values."], why: "The perpetuity value sits at time 10; it must be discounted to time 0.", value: () => 100 * Ia(10, 0.05) + 1000 / 0.05 },
      { steps: ["Years 1–10: $100(Ia)_{\\overline{10|}}$.", "Years 11 on: $\\frac{1000}{0.05}v^{11}$.", "Add the two values."], why: "One period too many: $1000/i$ is already valued at time 10, one year before its first payment.", value: () => 100 * Ia(10, 0.05) + (1000 / 0.05) * Math.pow(1.05, -11) },
    ],
    insight: "Break a stream where its pattern changes, value each piece with its standard formula, and move each value to time 0 from where that formula leaves it.",
    formulas: ["B.increasing", "B.perpetuity", "B.deferred"],
    result: { label: "Present value", value: () => 100 * Ia(10, 0.05) + (1000 / 0.05) * Math.pow(1.05, -10), reference: () => sum(1, 4000, (t) => Math.min(100 * t, 1000) * Math.pow(1.05, -t)), digits: 2 },
  },
  {
    id: "ann-monthly-effective",
    topic: "ANNUITIES",
    area: "B",
    kind: "first-step",
    title: "Monthly payments, annual rate",
    problem: "200 is paid at the end of every month for 10 years. The annual effective rate is 6%. Find the present value.",
    correct: { steps: ["Monthly rate $j = 1.06^{1/12} - 1$; value $200\\,a_{\\overline{120|}\\,j}$."] },
    wrong: [
      { steps: ["Monthly rate $j = 6\\%/12$; value $200\\,a_{\\overline{120|}\\,j}$."], why: "Dividing by 12 works for a *nominal* rate convertible monthly; 6% here is annual effective.", value: () => 200 * an(120, 0.005) },
      { steps: ["Annual total 2,400 at each year end; value $2400\\,a_{\\overline{10|}\\,6\\%}$."], why: "Ignores that the money arrives during the year — it undervalues the stream.", value: () => 2400 * an(10, 0.06) },
      { steps: ["Rate 6% per period; value $200\\,a_{\\overline{120|}\\,6\\%}$."], why: "120 periods need the rate per period, not per year.", value: () => 200 * an(120, 0.06) },
    ],
    insight: "Always match the rate to the payment period first. (Alternatively: $2400\\,a^{(12)}_{\\overline{10|}}$ with $i^{(12)}$.)",
    formulas: ["B.mthly-annuity", "A.nominal-conversion"],
    result: { label: "Present value", value: () => 200 * an(120, Math.pow(1.06, 1 / 12) - 1), reference: () => sum(1, 120, (k) => 200 * Math.pow(1.06, -k / 12)), digits: 2 },
  },
  {
    id: "ann-every-third-year",
    topic: "ANNUITIES",
    area: "B",
    kind: "plan",
    title: "Payments every k years",
    problem: "1,000 is paid every 3 years for 30 years, the first payment at time 3. At 4% annual effective, find the present value.",
    correct: { steps: ["3-year rate: $j = 1.04^3 - 1$.", "Value the 10 payments: $1000\\,a_{\\overline{10|}\\,j}$."] },
    wrong: [
      { steps: ["3-year rate: $j = 3 \\times 4\\% = 12\\%$.", "Value the 10 payments: $1000\\,a_{\\overline{10|}\\,j}$."], why: "Compound rates don't scale linearly: three years at 4% is $1.04^3 - 1 = 12.49\\%$.", value: () => 1000 * an(10, 0.12) },
      { steps: [`Spread each payment over its 3 years: $1000/${AN("3")}$ a year.`, `Value that for 30 years: $\\times\\,${AN("30")}$ at 4%.`], why: "Fission needs $s_{\\overline{3|}}$: each 1,000 at the end of a block is spread as $1/s_{\\overline{3|}}$ per year *before* it.", value: () => (1000 * an(30, 0.04)) / an(3, 0.04) },
      { steps: ["Keep the annual rate, 4%.", "Value the 10 payments: $1000\\,a_{\\overline{10|}\\,4\\%}$."], why: "Uses annual periods for payments that are 3 years apart.", value: () => 1000 * an(10, 0.04) },
    ],
    insight: "Payments less often than the rate period: either convert the rate to the payment period, or split each payment into a level annual series ($1/s_{\\overline{k|}}$).",
    formulas: ["B.fission", "A.compound"],
    result: { label: "Present value", value: () => 1000 * an(10, Math.pow(1.04, 3) - 1), reference: () => sum(1, 10, (k) => 1000 * Math.pow(1.04, -3 * k)), digits: 2 },
  },
  {
    id: "ann-geometric",
    topic: "ANNUITIES",
    area: "B",
    kind: "setup",
    title: "Growing payments",
    problem: "Twenty annual payments: 500 at the end of year 1, each later payment 3% larger than the one before. At 6% effective, which expression gives the present value?",
    correct: { steps: ["$500\\,\\frac{1 - (1.03/1.06)^{20}}{0.06 - 0.03}$"] },
    wrong: [
      { steps: ["$500\\,a_{\\overline{20|}\\,j}$ with $j = \\frac{1.06}{1.03} - 1$"], why: "Close: the exact identity is $\\frac{500}{1.03}a_{\\overline{20|}j}$, because the first payment is 500, not $500 \\times 1.03$.", value: () => 500 * an(20, 1.06 / 1.03 - 1) },
      { steps: ["$500\\,a_{\\overline{20|}\\,3\\%}$"], why: "Approximating with $i - k = 3\\%$ ignores the exact form.", value: () => 500 * an(20, 0.03) },
      { steps: ["$500\\,\\frac{1 - (1.03/1.06)^{20}}{0.06 + 0.03}$"], why: "The denominator is the *gap* between the rates, $i - k$.", value: () => (500 * (1 - Math.pow(1.03 / 1.06, 20))) / 0.09 },
    ],
    insight: "Geometric growth → $\\frac{1 - ((1+k)/(1+i))^n}{i - k}$ times the *first* payment.",
    formulas: ["B.geometric-annuity"],
    result: { label: "Present value", value: () => (500 * (1 - Math.pow(1.03 / 1.06, 20))) / 0.03, reference: () => sum(1, 20, (t) => 500 * 1.03 ** (t - 1) * 1.06 ** -t), digits: 2 },
  },
  {
    id: "ann-unknown-n",
    topic: "ANNUITIES",
    area: "B",
    kind: "plan",
    title: "How many payments?",
    problem: "A fund of 15,000 earns 6% effective. It pays 1,000 at the end of each year for as long as possible. How many full payments can it make?",
    correct: { steps: ["Solve $1000\\,a_{\\overline{n|}} = 15{,}000$ with logs: $n = 39.5$.", "Round down: 39."] },
    wrong: [
      { steps: ["Divide: $15{,}000/1{,}000 = 15$ payments.", "Interest only changes the final payment."], why: "Ignores the interest the fund earns while it pays out.", value: () => 15 },
      { steps: ["Solve $1000\\,s_{\\overline{n|}} = 15{,}000$ with logs.", "Round down."], why: "The fund exists *now*: compare present values, not accumulated values.", value: () => Math.floor(Math.log(1 + 15 * 0.06) / Math.log(1.06)) },
      { steps: ["Solve $1000\\,a_{\\overline{n|}} = 15{,}000$ with logs: $n = 39.5$.", "Round to the nearest whole number: 40."], why: "A 40th full payment would overdraw the fund. Count full payments by rounding down.", value: () => 40 },
    ],
    insight: "Unknown $n$ in an annuity: isolate $v^n$, take logs, and round down for full payments.",
    formulas: ["B.annuity-immediate", "M.logarithm"],
    result: {
      label: "Full payments",
      value: () => Math.floor(-Math.log(1 - 15 * 0.06) / Math.log(1.06)),
      reference: () => {
        let b = 15000;
        let n = 0;
        while (b * 1.06 >= 1000) {
          b = b * 1.06 - 1000;
          n += 1;
        }
        return n;
      },
      digits: 0,
    },
  },
  {
    id: "ann-continuous-varying",
    topic: "ANNUITIES",
    area: "B",
    kind: "setup",
    title: "Continuous payments at a varying rate",
    problem: "Payments are made continuously at a rate of $t^2$ per year at time $t$, for $0 \\le t \\le 10$. The force of interest is 5%. Which expression gives the present value?",
    correct: { steps: ["$\\displaystyle\\int_0^{10} t^2 e^{-0.05t}\\,dt$"] },
    wrong: [
      { steps: ["$\\displaystyle\\sum_{t=1}^{10} t^2 v^t$"], why: "Treats a continuous stream as year-end lumps.", value: () => sum(1, 10, (t) => t * t * Math.exp(-0.05 * t)) },
      { steps: ["$\\displaystyle e^{-0.5}\\int_0^{10} t^2\\,dt$"], why: "Discounts everything from time 10; each instant's payment is discounted from its own time.", value: () => Math.exp(-0.5) * (1000 / 3) },
      { steps: ["$\\displaystyle\\int_0^{10} t^2 e^{0.05t}\\,dt$"], why: "Positive exponent accumulates; a present value discounts.", value: () => integrate((t) => t * t * Math.exp(0.05 * t), 0, 10) },
    ],
    insight: "Continuous stream: PV $= \\int (\\text{payment rate at } t) \\times (\\text{discount factor to } t)\\,dt$.",
    formulas: ["B.varying-continuous"],
    result: {
      label: "Present value",
      // Closed form by parts: ∫ t² e^{−at} dt from 0 to T = 2/a³ − e^{−aT}(T²/a + 2T/a² + 2/a³).
      value: () => {
        const a = 0.05;
        const T = 10;
        return 2 / a ** 3 - Math.exp(-a * T) * (T * T / a + (2 * T) / a ** 2 + 2 / a ** 3);
      },
      reference: () => integrate((t) => t * t * Math.exp(-0.05 * t), 0, 10),
      digits: 3,
    },
  },
  {
    id: "ann-pyramid",
    topic: "ANNUITIES",
    area: "B",
    kind: "plan",
    title: "Recognise the pattern",
    problem: "Payments of 1, 2, 3, 4, 5, 4, 3, 2, 1 are made at times 1 to 9. Find the present value at 4%.",
    correct: { steps: ["Recognise a pyramid peaking at 5.", `Value it as $${AN("5")}\\,${ADN("5")}$.`] },
    wrong: [
      { steps: ["Recognise an increasing annuity.", "Value it as $(Ia)_{\\overline{9|}}$."], why: "That keeps increasing to 9; the payments turn down after time 5.", value: () => Ia(9, 0.04) },
      { steps: ["Split at the peak: up 1–5, then down 4–1.", "Value it as $(Ia)_{\\overline{5|}} + v^5(Da)_{\\overline{5|}}$."], why: "Counts the peak twice: after time 5 the payments are 4, 3, 2, 1 — that is $v^5(Da)_{\\overline{4|}}$.", value: () => Ia(5, 0.04) + Math.pow(1.04, -5) * Da(5, 0.04) },
      { steps: ["Take a typical payment as half the peak: 2.5.", `Value it as $2.5\\,${AN("9")}$.`], why: "The 0% test fails (25 vs 22.5), and averaging payments ignores their timing.", value: () => (5 * an(9, 0.04)) / 2 },
    ],
    insight: "Before reaching for sums, look for a known shape: increasing, decreasing, pyramid, level-plus-increasing. A quick 0% check (sum of payments) catches wrong set-ups.",
    formulas: ["B.annuity-tricks", "B.increasing", "B.decreasing"],
    result: { label: "Present value", value: () => an(5, 0.04) * adue(5, 0.04), reference: () => [1, 2, 3, 4, 5, 4, 3, 2, 1].reduce((a, p, k) => a + p * Math.pow(1.04, -(k + 1)), 0), digits: 4 },
  },
  {
    id: "ann-every-other-perpetuity",
    topic: "ANNUITIES",
    area: "B",
    kind: "first-step",
    title: "Perpetuity paying every other year",
    problem: "A perpetuity pays 1 at times 2, 4, 6, …. At 5% effective, find its present value.",
    correct: { steps: ["Use the 2-year rate $j = 1.05^2 - 1$; PV $= 1/j$."] },
    wrong: [
      { steps: ["Use the 2-year rate $j = 2 \\times 5\\%$; PV $= 1/j$."], why: "Doubles the rate linearly; two years at 5% is 10.25%, not 10%.", value: () => 1 / 0.1 },
      { steps: ["Defer a yearly perpetuity one year: PV $= v/i$."], why: "That pays every year from time 2; this one pays only every second year.", value: () => 1 / 1.05 / 0.05 },
      { steps: ["Defer a yearly perpetuity two years: PV $= v^2/i$."], why: "Discounts a yearly perpetuity; the payments are 2 years apart.", value: () => Math.pow(1.05, -2) / 0.05 },
    ],
    insight: "Payment period ≠ rate period → convert the rate to the payment period, then use the standard formula.",
    formulas: ["B.perpetuity", "A.compound"],
    result: { label: "Present value", value: () => 1 / (1.05 ** 2 - 1), reference: () => sum(1, 3000, (k) => Math.pow(1.05, -2 * k)), digits: 4 },
  },
  {
    id: "ann-rate-from-a-and-s",
    topic: "ANNUITIES",
    area: "B",
    kind: "first-step",
    title: "Rate from an annuity and its accumulation",
    problem: "For some $n$ and $i$, $a_{\\overline{n|}} = 7.0$ and $s_{\\overline{n|}} = 12.0$. Find $i$.",
    correct: { steps: ["Use $1/a_{\\overline{n|}} - 1/s_{\\overline{n|}} = i$."] },
    wrong: [
      { steps: ["Solve for $n$ first, then find $i$ on the calculator."], why: "Neither $n$ nor $i$ is known; you would need both equations together — the reciprocal identity eliminates $n$ in one line." },
      { steps: ["Use $s/a = (1+i)^n$ and take the $n$-th root."], why: "True, but $n$ is unknown, so this alone cannot give $i$." },
      { steps: ["Use $s/a = (1+i)^n$, so $i = s/a - 1$."], why: "$s/a = (1+i)^n$, so this is the rate over all $n$ periods together, not the rate per period.", value: () => 12 / 7 - 1 },
    ],
    insight: "Given $a$ and $s$ for the same $n$ and $i$: $i = 1/a - 1/s$.",
    formulas: ["B.reciprocal-identity"],
    result: {
      label: "i",
      value: () => 1 / 7 - 1 / 12,
      reference: () => {
        // Find (n, i) with a = 7 and s = 12 by solving s/a = (1+i)^n and a(1+i)^n... then return i.
        const i0 = bisect((i) => {
          const n = Math.log(12 / 7) / Math.log(1 + i);
          return an(n, i) - 7;
        }, 0.001, 0.5);
        return i0;
      },
      digits: 5,
    },
  },

  // ================================================================== LOANS
  {
    id: "loan-balance-prospective",
    topic: "LOANS",
    area: "D",
    kind: "plan",
    title: "Balance late in a loan",
    problem: "A loan of 20,000 is repaid by 15 level annual payments at 6%. Find the outstanding balance just after the 9th payment.",
    correct: { steps: [`$P = 20{,}000/${AN("15")}$.`, `$B_9 = P\\,${AN("6")}$.`] },
    wrong: [
      { steps: [`$P = 20{,}000/${AN("15")}$.`, `$B_9 = P\\,${AN("9")}$.`], why: "Uses the payments already made; the prospective balance values the payments *remaining*.", value: () => payFor(20000, 0.06, 15) * an(9, 0.06) },
      { steps: [`$P = 20{,}000/${AN("15")}$.`, "$B_9 = 20{,}000 - 9P$."], why: "Each payment is partly interest; the balance falls by the principal parts only.", value: () => 20000 - 9 * payFor(20000, 0.06, 15) },
      { steps: [`$P = 20{,}000/${AN("15")}$.`, `$B_9 = P\\,${AN("7")}$.`], why: "Counts one payment too many: after payment 9 of 15, six remain.", value: () => payFor(20000, 0.06, 15) * an(7, 0.06) },
    ],
    insight: "Late in a loan, the prospective method (PV of what's left) is short; early on, the retrospective method can be. Both give the same balance.",
    formulas: ["D.loan-payment", "D.prospective"],
    result: { label: "Balance after payment 9", value: () => (20000 / an(15, 0.06)) * an(6, 0.06), reference: () => balance(20000, 0.06, payFor(20000, 0.06, 15), 9), digits: 2 },
  },
  {
    id: "loan-interest-portion",
    topic: "LOANS",
    area: "D",
    kind: "setup",
    title: "Interest in one payment",
    problem: "A loan is repaid by 20 annual payments of 1,000 at 5%. Which expression gives the interest in the 10th payment?",
    correct: { steps: ["$1000\\,(1 - v^{11})$"] },
    wrong: [
      { steps: ["$1000\\,v^{11}$"], why: "That is the *principal* in the 10th payment.", value: () => 1000 * Math.pow(1.05, -11) },
      { steps: ["$1000\\,(1 - v^{10})$"], why: "Off by one: payment $t$ of $n$ has principal $Pv^{n-t+1}$, here $v^{11}$.", value: () => 1000 * (1 - Math.pow(1.05, -10)) },
      { steps: [`$0.05 \\times 1000\\,${AN("10")}$`], why: "Interest is on the balance *before* the payment, $B_9 = 1000\\,a_{\\overline{11|}}$.", value: () => 0.05 * 1000 * an(10, 0.05) },
    ],
    insight: "Interest in payment $t$ = $i \\times B_{t-1}$ = $P(1 - v^{n-t+1})$. The exponent counts the payments left *including* this one.",
    formulas: ["D.interest-component"],
    result: {
      label: "Interest in payment 10",
      value: () => 1000 * (1 - Math.pow(1.05, -11)),
      reference: () => 0.05 * balance(1000 * an(20, 0.05), 0.05, 1000, 9),
      digits: 2,
    },
  },
  {
    id: "loan-refinance",
    topic: "LOANS",
    area: "D",
    kind: "plan",
    title: "Refinancing mid-loan",
    problem: "A 10,000 loan at 8% is to be repaid by 10 annual payments. Just after the 4th payment the borrower refinances the balance at 6% over the remaining 6 years. Find the new annual payment.",
    correct: {
      steps: [`Original payment: $P = 10{,}000/${AN("10", "8\\%")}$.`, `Balance after payment 4, at the *old* rate: $B_4 = P\\,${AN("6", "8\\%")}$.`, `New payment: $B_4/${AN("6", "6\\%")}$.`],
    },
    wrong: [
      { steps: [`$P = 10{,}000/${AN("10", "8\\%")}$.`, `$B_4 = P\\,${AN("6", "6\\%")}$.`, `New payment $= B_4/${AN("6", "6\\%")}$.`], why: "The balance owed is set by the *original* loan terms (8%); the new rate only applies to what happens next.", value: () => payFor(10000, 0.08, 10) },
      { steps: [`$P = 10{,}000/${AN("10", "8\\%")}$.`, "The rate falls from 8% to 6%.", "New payment $= P \\times 0.06/0.08$."], why: "Payments do not scale with the rate; the principal must still be repaid.", value: () => payFor(10000, 0.08, 10) * 0.75 },
      { steps: [`$P = 10{,}000/${AN("10", "8\\%")}$.`, "$B_4 = 10{,}000 - 4P$.", `New payment $= B_4/${AN("6", "6\\%")}$.`], why: "The early payments are mostly interest; the balance falls by much less than $4P$.", value: () => (10000 - 4 * payFor(10000, 0.08, 10)) / an(6, 0.06) },
    ],
    insight: "Refinancing = (1) the balance under the old terms, (2) a new loan of that amount under the new terms.",
    formulas: ["D.loan-payment", "D.prospective"],
    result: { label: "New payment", value: () => ((10000 / an(10, 0.08)) * an(6, 0.08)) / an(6, 0.06), reference: () => payFor(balance(10000, 0.08, payFor(10000, 0.08, 10), 4), 0.06, 6), digits: 2 },
  },
  {
    id: "loan-principal-block",
    topic: "LOANS",
    area: "D",
    kind: "plan",
    title: "Principal repaid over several payments",
    problem: "A 25,000 loan is repaid by 20 level annual payments at 7%. Find the total principal repaid in payments 5 through 9.",
    correct: { steps: ["$B_4 = P\\,a_{\\overline{16|}}$ and $B_9 = P\\,a_{\\overline{11|}}$.", "Total $= B_4 - B_9$."] },
    wrong: [
      { steps: ["Principal in payment 5: $Pv^{16}$.", "Total $= 5 \\times Pv^{16}$."], why: "Principal parts grow by a factor $1+i$ each payment; they are not level.", value: () => 5 * payFor(25000, 0.07, 20) * Math.pow(1.07, -16) },
      { steps: ["Value payments 5–9 at time 4: $P\\,a_{\\overline{5|}}$.", "That value is the principal repaid."], why: "That is a present value of whole payments (interest included), not principal.", value: () => payFor(25000, 0.07, 20) * an(5, 0.07) },
      { steps: ["$B_5 = P\\,a_{\\overline{15|}}$ and $B_9 = P\\,a_{\\overline{11|}}$.", "Total $= B_5 - B_9$."], why: "Misses payment 5's principal: start from the balance *before* payment 5, $B_4$.", value: () => balance(25000, 0.07, payFor(25000, 0.07, 20), 5) - balance(25000, 0.07, payFor(25000, 0.07, 20), 9) },
    ],
    insight: "Sum of principal over a block = balance before the block − balance after it. No need to add parts one by one.",
    formulas: ["D.prospective", "D.principal-component"],
    result: {
      label: "Principal in payments 5–9",
      value: () => (25000 / an(20, 0.07)) * (an(16, 0.07) - an(11, 0.07)),
      reference: () => {
        const P = payFor(25000, 0.07, 20);
        let b = 25000;
        let total = 0;
        for (let k = 1; k <= 9; k += 1) {
          const prin = P - b * 0.07;
          if (k >= 5) total += prin;
          b -= prin;
        }
        return total;
      },
      digits: 2,
    },
  },
  {
    id: "loan-unknown-rate",
    topic: "LOANS",
    area: "D",
    kind: "first-step",
    title: "Unknown loan rate",
    problem: "A loan of 10,000 is repaid by 12 annual payments of 1,250. Find the effective rate.",
    correct: { steps: ["Solve $1250\\,a_{\\overline{12|}\\,i} = 10{,}000$ on the calculator (CPT I/Y)."] },
    wrong: [
      { steps: ["Average interest: $(12 \\times 1250 - 10{,}000)/(10{,}000 \\times 12)$."], why: "A simple-interest average ignores that the balance falls over the loan.", value: () => 5000 / 120000 },
      { steps: ["Solve $1250\\,s_{\\overline{12|}\\,i} = 10{,}000$ on the calculator (CPT I/Y)."], why: "The loan is made *now*: compare with present values.", value: () => bisect((i) => 1250 * sn(12, i) - 10000, -0.5, 0.5) },
      { steps: ["Payment over loan: $i = 1250/10{,}000$."], why: "That is the payment as a share of the loan; part of each payment is principal.", value: () => 0.125 },
    ],
    insight: "Unknown rate with level payments: set up $Pa_{\\overline{n|}i} = L$ and let the calculator find $i$.",
    formulas: ["D.loan-payment", "M.root-finding"],
    result: { label: "Effective rate", value: () => bisect((i) => 1250 * an(12, i) - 10000, 0.0001, 0.5), reference: () => bisect((i) => balance(10000, i, 1250, 12), 0.0001, 0.5), digits: 5 },
  },
  {
    id: "loan-drop-payment",
    topic: "LOANS",
    area: "D",
    kind: "plan",
    title: "Final smaller (drop) payment",
    problem: "A loan of 10,000 at 6% is repaid by payments of 1,500 at the end of each year for as long as needed, plus a smaller final payment one year after the last full payment. Find the final payment.",
    correct: { steps: ["$1500\\,a_{\\overline{n|}} = 10{,}000$ gives $n \\approx 8.77$: 8 full payments.", "Final payment $= B_8 \\times 1.06$."] },
    wrong: [
      { steps: ["$1500\\,a_{\\overline{n|}} = 10{,}000$ gives 8 full payments.", "Final payment $= 10{,}000 - 8 \\times 1500$."], why: "Ignores interest altogether — here it is even negative.", value: () => 10000 - 8 * 1500 },
      { steps: ["$1500\\,a_{\\overline{n|}} = 10{,}000$ gives 8 full payments.", "Final payment $= B_8$."], why: "$B_8$ is owed at time 8; the final payment is at time 9 and includes a year's interest.", value: () => balance(10000, 0.06, 1500, 8) },
      { steps: ["$1500\\,a_{\\overline{n|}} = 10{,}000$ gives $n \\approx 8.77$.", "Final payment $= 0.77 \\times 1500$."], why: "The fractional part of $n$ is not the fraction of a payment; compute the balance instead.", value: () => 0.77 * 1500 },
    ],
    insight: "Irregular last payment: count the full payments, find the balance after them, and accumulate it to the date of the final payment.",
    formulas: ["D.drop-balloon", "D.retrospective"],
    result: { label: "Final payment", value: () => (10000 * 1.06 ** 8 - 1500 * sn(8, 0.06)) * 1.06, reference: () => balance(10000, 0.06, 1500, 8) * 1.06, digits: 2 },
  },
  {
    id: "loan-amount-from-parts",
    topic: "LOANS",
    area: "D",
    kind: "plan",
    title: "Loan amount from one payment's split",
    problem: "A loan is repaid by 15 level annual payments at 5%. The 3rd payment contains 530.32 of principal and 469.68 of interest. Find the original loan amount.",
    correct: { steps: ["$P = 530.32 + 469.68 = 1000$.", `$L = 1000\\,${AN("15")}$.`] },
    wrong: [
      { steps: ["Interest of 469.68 is 5% of the loan.", "$L = 469.68/0.05$."], why: "Interest in payment 3 is on the balance after payment 2, $B_2$ — not on the original loan.", value: () => 469.68 / 0.05 },
      { steps: ["Principal of 530.32 is repaid each year.", "$L = 15 \\times 530.32$."], why: "Principal parts are not level; they grow each payment.", value: () => 530.32 * 15 },
      { steps: ["$P = 530.32 + 469.68 = 1000$.", `$L = 1000\\,${SN("15")}$.`], why: "The loan is a present value; $s$ gives the value at the end.", value: () => 1000 * sn(15, 0.05) },
    ],
    insight: "Any payment's split gives you the level payment $P$ (and $B_{t-1} = I_t/i$). Then $L = Pa_{\\overline{n|}}$.",
    formulas: ["D.loan-payment", "D.interest-component"],
    result: {
      label: "Loan amount",
      value: () => 1000 * an(15, 0.05),
      // Independent: the loan that 15 payments of 1000 at 5% exactly clear, found by simulation.
      reference: () => bisect((L) => balance(L, 0.05, 1000, 15), 0, 50000),
      digits: 2,
    },
  },
  {
    id: "loan-increasing-payments",
    topic: "LOANS",
    area: "D",
    kind: "setup",
    title: "Loan with increasing payments",
    problem: "A loan is repaid by 10 annual payments of 1,000, 1,100, 1,200, …, 1,900 at 5%. Which expression gives the loan amount?",
    correct: { steps: [`$900\\,${AN("10")} + 100\\,(Ia)_{\\overline{10|}}$`] },
    wrong: [
      { steps: [`$1000\\,${AN("10")} + 100\\,(Ia)_{\\overline{10|}}$`], why: "That makes the first payment 1,100. Split each payment as $900 + 100t$.", value: () => 1000 * an(10, 0.05) + 100 * Ia(10, 0.05) },
      { steps: ["$1000\\,(Ia)_{\\overline{10|}}$"], why: "Payments 1,000, 2,000, … — growth of 1,000 a year, not 100.", value: () => 1000 * Ia(10, 0.05) },
      { steps: [`$1000\\,${AN("10")} + 100\\,(Da)_{\\overline{10|}}$`], why: "The payments increase; $(Da)$ adds a decreasing stream.", value: () => 1000 * an(10, 0.05) + 100 * Da(10, 0.05) },
    ],
    insight: "Arithmetic payments $P, P + Q, \\dots$: write as $(P - Q)a_{\\overline{n|}} + Q(Ia)_{\\overline{n|}}$ and check with $t = 1$.",
    formulas: ["B.increasing", "D.loan-payment"],
    result: { label: "Loan amount", value: () => 900 * an(10, 0.05) + 100 * Ia(10, 0.05), reference: () => sum(1, 10, (t) => (900 + 100 * t) * Math.pow(1.05, -t)), digits: 2 },
  },
  {
    id: "loan-extra-payment",
    topic: "LOANS",
    area: "D",
    kind: "first-step",
    title: "Extra payment, then fewer payments",
    problem: "A 30,000 loan at 7% has 15 annual payments. With the 5th payment the borrower also pays an extra 5,000, and keeps paying the same amount. How many more full payments are needed?",
    correct: { steps: ["Find $B_5$, subtract 5,000, and solve $P\\,a_{\\overline{m|}} =$ the result for $m$."] },
    wrong: [
      { steps: ["Subtract 5,000 from the original loan and recompute the 15 payments."], why: "The extra payment is made at time 5; what matters is the balance then." },
      { steps: ["Divide 5,000 by $P$ and subtract that many payments from the 10 left."], why: "A payment at time 5 is worth more than later payments it replaces; compare by present value at time 5." },
      { steps: ["Accumulate 5,000 to time 15 and count how many payments it covers."], why: "Shortening the loan removes the *last* payments; solve with the reduced balance instead." },
    ],
    insight: "Any change mid-loan: stop, find the balance at that date, apply the change, then treat what's left as a new loan.",
    formulas: ["D.prospective", "M.logarithm"],
    result: {
      label: "Full payments remaining",
      value: () => {
        const P = 30000 / an(15, 0.07);
        const B = P * an(10, 0.07) - 5000;
        return Math.floor(-Math.log(1 - (B * 0.07) / P) / Math.log(1.07));
      },
      reference: () => {
        const P = payFor(30000, 0.07, 15);
        let b = balance(30000, 0.07, P, 5) - 5000;
        let m = 0;
        while (b * 1.07 >= P) {
          b = b * 1.07 - P;
          m += 1;
        }
        return m;
      },
      digits: 0,
    },
  },

  // ================================================================== BONDS, YIELD RATES, TERM STRUCTURE
  {
    id: "bond-semiannual-yield",
    topic: "BONDS",
    area: "E",
    kind: "first-step",
    title: "Semiannual coupons, annual yield",
    problem: "A 10-year bond with face 1,000 pays coupons at 8% convertible semiannually. Find its price at an annual effective yield of 6%.",
    correct: { steps: ["Half-year rate $\\sqrt{1.06} - 1$; 20 coupons of 40."] },
    wrong: [
      { steps: ["Half-year rate $6\\%/2 = 3\\%$; 20 coupons of 40."], why: "6% is annual *effective*, so the half-year rate is $\\sqrt{1.06} - 1 = 2.956\\%$, not 3%.", value: () => 40 * an(20, 0.03) + 1000 * Math.pow(1.03, -20) },
      { steps: ["Annual rate 6%; 10 annual coupons of 80."], why: "Coupons are paid twice a year; lumping them at year end undervalues the bond.", value: () => 80 * an(10, 0.06) + 1000 * Math.pow(1.06, -10) },
      { steps: ["Rate 6% per period; 20 coupons of 40."], why: "The rate must be per half-year to match 20 half-year periods.", value: () => 40 * an(20, 0.06) + 1000 * Math.pow(1.06, -20) },
    ],
    insight: "Bonds: first fix the period (the coupon period), then the coupon, the number of periods, and the yield *per period*.",
    formulas: ["E.price", "A.nominal-conversion"],
    result: {
      label: "Price",
      value: () => {
        const j = Math.sqrt(1.06) - 1;
        return 40 * an(20, j) + 1000 * Math.pow(1 + j, -20);
      },
      reference: () => sum(1, 20, (k) => (40 + (k === 20 ? 1000 : 0)) * Math.pow(1.06, -k / 2)),
      digits: 2,
    },
  },
  {
    id: "bond-book-value",
    topic: "BONDS",
    area: "E",
    kind: "plan",
    title: "Book value partway through",
    problem: "A 12-year bond, face 1,000, annual coupons of 9%, is bought to yield 7%. Find its book value just after the 4th coupon.",
    correct: { steps: ["Left: 8 coupons of 90 and 1,000 at year 12.", `$BV_4 = 90\\,${AN("8", "7\\%")} + 1000\\,v^8$.`] },
    wrong: [
      { steps: ["Premium $= P - 1000$.", "$BV_4 = P - \\frac{4}{12}(P - 1000)$."], why: "Premium is amortized by the interest method: write-downs grow geometrically, not in equal steps.", value: () => {
        const P = 90 * an(12, 0.07) + 1000 * Math.pow(1.07, -12);
        return P - (4 / 12) * (P - 1000);
      } },
      { steps: ["Price $P$ at 7%.", "$BV_4 = P(1.07)^4$."], why: "Ignores the four coupons received, which reduce the book value.", value: () => (90 * an(12, 0.07) + 1000 * Math.pow(1.07, -12)) * 1.07 ** 4 },
      { steps: ["Left: 8 coupons of 90 and 1,000 at year 12.", `$BV_4 = 90\\,${AN("8", "9\\%")} + 1000\\,v_{9\\%}^8$.`], why: "Book value uses the *yield* (7%), not the coupon rate — at 9% this is just 1,000.", value: () => 90 * an(8, 0.09) + 1000 * Math.pow(1.09, -8) },
    ],
    insight: "A bond is a loan: book value = outstanding balance = PV of what is left, at the yield it was bought at.",
    formulas: ["E.book-value"],
    result: {
      label: "Book value after coupon 4",
      value: () => 90 * an(8, 0.07) + 1000 * Math.pow(1.07, -8),
      reference: () => {
        let bv = pvAt(annualBond(1000, 0.09, 1000, 12), 0.07);
        for (let k = 0; k < 4; k += 1) bv = bv * 1.07 - 90;
        return bv;
      },
      digits: 2,
    },
  },
  {
    id: "bond-callable-premium",
    topic: "BONDS",
    area: "E",
    kind: "trap",
    title: "Callable premium bond",
    problem: "A bond with face 1,000 and 7% annual coupons can be called at par at any coupon date from year 10 to year 15. What is the most an investor can pay and still be sure of a 5% yield?",
    correct: { steps: ["Coupon 7% > yield 5%: a premium bond.", "Price to the earliest call date, year 10."] },
    wrong: [
      { steps: ["Coupon 7% > yield 5%: a premium bond.", "Price to maturity, year 15."], why: "If called at 10, a price based on 15 years would yield less than 5%.", value: () => pvAt(annualBond(1000, 0.07, 1000, 15), 0.05) },
      { steps: ["A call is equally likely in any year 10–15.", "Price to the middle date, year 12."], why: "The guarantee must hold for *every* call date; that means the minimum price.", value: () => pvAt(annualBond(1000, 0.07, 1000, 12), 0.05) },
      { steps: ["Price to each date, 10 through 15.", "Take the highest of those prices."], why: "The highest price only works for the most favourable date; the issuer chooses the date.", value: () => pvAt(annualBond(1000, 0.07, 1000, 15), 0.05) },
    ],
    insight: "Callable bonds: price at every possible date and take the minimum. Shortcut (level redemption value): premium → earliest, discount → latest.",
    formulas: ["E.callable"],
    result: { label: "Price", value: () => 1000 + (70 - 50) * an(10, 0.05), reference: () => Math.min(...[10, 11, 12, 13, 14, 15].map((n) => pvAt(annualBond(1000, 0.07, 1000, n), 0.05))), digits: 2 },
  },
  {
    id: "bond-callable-tiers",
    topic: "BONDS",
    area: "E",
    kind: "trap",
    title: "Call premium that steps down",
    problem: "A 10-year bond, face 1,000, 8% annual coupons, is callable at 1,100 at coupon dates 5–9 and redeemable at 1,000 at year 10. Find the highest price that guarantees a 6% yield.",
    correct: { steps: ["Price to year 5 and year 9 at 1,100, and year 10 at 1,000.", "Take the lowest price."] },
    wrong: [
      { steps: ["Coupon exceeds yield: a premium bond.", "Price to the earliest date, year 5, at 1,100."], why: "With a call premium the earliest date need not be worst: here the year-10 redemption at 1,000 gives a lower price.", value: () => pvAt(annualBond(1000, 0.08, 1100, 5), 0.06) },
      { steps: ["Coupon exceeds yield: a premium bond.", "Price to the latest 1,100 date, year 9."], why: "“Latest date” is the rule for *discount* bonds. This is a premium bond — and the step down to 1,000 at year 10 must be checked as well.", value: () => pvAt(annualBond(1000, 0.08, 1100, 9), 0.06) },
      { steps: ["Price to every date from 5 to 10.", "Average the prices."], why: "A guaranteed yield needs the *minimum* price, not an average." },
    ],
    insight: "With a call schedule (several redemption values), compute the price at each tier's critical date and take the minimum.",
    formulas: ["E.callable"],
    result: {
      label: "Price",
      value: () => Math.min(80 * an(5, 0.06) + 1100 * Math.pow(1.06, -5), 80 * an(9, 0.06) + 1100 * Math.pow(1.06, -9), 80 * an(10, 0.06) + 1000 * Math.pow(1.06, -10)),
      reference: () => Math.min(...[5, 6, 7, 8, 9, 10].map((n) => sum(1, n, (t) => (80 + (t === n ? (n === 10 ? 1000 : 1100) : 0)) * Math.pow(1.06, -t)))),
      digits: 2,
    },
  },
  {
    id: "bond-reinvested-yield",
    topic: "BONDS",
    area: "C",
    kind: "plan",
    title: "Yield with reinvested coupons",
    problem: "An investor buys a 10-year 1,000 bond with 6% annual coupons at par and reinvests the coupons at 4%. Find the investor's annual yield over the 10 years.",
    correct: { steps: ["Have: $1000 + 60\\,s_{\\overline{10|}\\,4\\%}$.", "Solve $1000(1+y)^{10} =$ have."] },
    wrong: [
      { steps: ["Bought at par, so the yield is the coupon rate.", "$y = 6\\%$."], why: "6% assumes coupons are reinvested at 6%; at 4% the realised yield is lower.", value: () => 0.06 },
      { steps: ["Coupons earn 6%, reinvestment 4%.", "$y = (6\\% + 4\\%)/2$."], why: "There is no averaging rule; the weights depend on timing and amounts. Solve the equation.", value: () => 0.05 },
      { steps: ["Have: $1000 + 60\\,s_{\\overline{10|}\\,6\\%}$.", "Solve $1000(1+y)^{10} =$ have."], why: "Accumulates the coupons at the coupon rate instead of the reinvestment rate — returns 6% again.", value: () => 0.06 },
    ],
    insight: "Realised yield: what I have (inflows accumulated at the reinvestment rate) = what I demand (outlay accumulated at $y$).",
    formulas: ["C.yield-rate", "C.reinvestment"],
    result: {
      label: "Annual yield",
      value: () => Math.pow((1000 + 60 * sn(10, 0.04)) / 1000, 0.1) - 1,
      reference: () => {
        let fund = 0;
        for (let k = 1; k <= 10; k += 1) fund = fund * 1.04 + 60;
        return bisect((y) => 1000 * (1 + y) ** 10 - (1000 + fund), 0, 0.2);
      },
      digits: 5,
    },
  },
  {
    id: "bond-spot-then-ytm",
    topic: "BONDS",
    area: "F",
    kind: "plan",
    title: "Price from spot rates, then yield",
    problem: "Spot rates are 3% (1 year) and 4% (2 years). A 2-year bond pays annual coupons of 50 and 1,000 at maturity. Find its yield to maturity.",
    correct: { steps: ["$P = \\frac{50}{1.03} + \\frac{1050}{1.04^2}$.", "Solve $50v + 1050v^2 = P$ for $y$."] },
    wrong: [
      { steps: ["Average the two spot rates.", "$y = (3\\% + 4\\%)/2$."], why: "The YTM is a cash-flow-weighted blend dominated by the large final payment — close to 4%, not 3.5%.", value: () => 0.035 },
      { steps: ["The final cash flow dominates.", "$y = s_2 = 4\\%$."], why: "The coupon at time 1 is discounted at 3%, so the YTM is slightly below 4%.", value: () => 0.04 },
      { steps: ["$P = \\frac{50}{1.04} + \\frac{1050}{1.04^2}$.", "Solve $50v + 1050v^2 = P$ for $y$."], why: "Discounting everything at one rate assumes the answer; each flow uses its own spot rate.", value: () => 0.04 },
    ],
    insight: "Spot rates price; the yield to maturity is a summary found *afterwards* from the price.",
    formulas: ["F.spot-pricing", "M.root-finding"],
    result: {
      label: "Yield to maturity",
      value: () => {
        const P = 50 / 1.03 + 1050 / 1.04 ** 2;
        // 1050 v² + 50 v − P = 0.
        const vv = (-50 + Math.sqrt(2500 + 4 * 1050 * P)) / (2 * 1050);
        return 1 / vv - 1;
      },
      reference: () => {
        const P = 50 / 1.03 + 1050 / 1.04 ** 2;
        return bisect((y) => 50 / (1 + y) + 1050 / (1 + y) ** 2 - P, 0, 0.2);
      },
      digits: 5,
    },
  },
  {
    id: "term-forward-2yr",
    topic: "ALM",
    area: "F",
    kind: "first-step",
    title: "Multi-year forward rate",
    problem: "The 1-year spot rate is 3% and the 3-year spot rate is 5%. Find the annual effective 2-year forward rate starting at time 1.",
    correct: { steps: ["Solve $(1.05)^3 = (1.03)(1 + f)^2$ for $f$."] },
    wrong: [
      { steps: ["Average: $f = (3 \\times 5\\% - 3\\%)/2$."], why: "A linear approximation; growth factors multiply, so the exact answer differs.", value: () => 0.06 },
      { steps: ["Growth ratio: $f = 1.05^3/1.03 - 1$."], why: "That is the total growth over the 2 years; the question wants an annual rate.", value: () => 1.05 ** 3 / 1.03 - 1 },
      { steps: ["Difference: $f = 5\\% - 3\\%$."], why: "Rates don't subtract — and a rising curve has forwards *above* the spot rates.", value: () => 0.02 },
    ],
    insight: "Forward rates: “going the long way” equals “stopping and continuing”: $(1 + s_{t+m})^{t+m} = (1 + s_t)^t(1 + f_{t,t+m})^m$.",
    formulas: ["F.forward"],
    result: { label: "Forward rate", value: () => Math.sqrt(1.05 ** 3 / 1.03) - 1, reference: () => bisect((f) => 1.03 * (1 + f) ** 2 - 1.05 ** 3, 0, 0.5), digits: 5 },
  },
  {
    id: "bond-total-interest",
    topic: "BONDS",
    area: "E",
    kind: "setup",
    title: "Total interest earned on a bond",
    problem: "A bond with $n$ coupons of $Fr$ and redemption value $C$ is bought for $P$. Which expression gives the total interest earned over its life (at the purchase yield)?",
    correct: { steps: ["$nFr + C - P$"] },
    wrong: [
      { steps: ["$nFr$"], why: "Only the coupons. The difference $C - P$ (a gain for a discount bond, a loss for a premium bond) is also interest.", value: () => 12 * 60 },
      { steps: ["$nFr + P - C$"], why: "Sign of the price difference: paying more than $C$ *reduces* the interest earned.", value: () => 12 * 60 + PRICE_12() - 1000 },
      { steps: ["$n\\,i\\,P$"], why: "Interest is earned on a book value that changes each period; it is not $iP$ each time.", value: () => 12 * 0.08 * PRICE_12() },
    ],
    insight: "Everything received minus everything paid is interest: $(nFr + C) - P$. (The same as for a loan: total payments − amount lent.)",
    formulas: ["E.bond-amortization", "D.total-interest"],
    result: {
      label: "Total interest (12 coupons of 60, C = 1000, yield 8%)",
      value: () => 12 * 60 + 1000 - PRICE_12(),
      reference: () => {
        let bv = PRICE_12();
        let total = 0;
        for (let k = 0; k < 12; k += 1) {
          total += 0.08 * bv;
          bv = bv * 1.08 - 60;
        }
        return total;
      },
      digits: 2,
    },
  },
  {
    id: "yield-npv-choice",
    topic: "BONDS",
    area: "C",
    kind: "first-step",
    title: "Choosing between projects",
    problem: "A firm can do only one of two projects. Its required return is 8%. Project A: NPV at 8% is 1,200, IRR 15%. Project B: NPV at 8% is 1,500, IRR 12%. Which rule decides?",
    correct: { steps: ["Pick the larger NPV at 8%: project B."] },
    wrong: [
      { steps: ["Pick the larger IRR: project A."], why: "IRR ignores scale. With one choice and a known required return, the larger NPV adds more value." },
      { steps: ["Reject both unless an IRR equals 8%."], why: "Any project with IRR above the required return (NPV > 0) is acceptable." },
      { steps: ["Rank by NPV and by IRR, and average the ranks."], why: "There is no such rule; NPV at the required return is the decision criterion." },
    ],
    insight: "Accept if NPV > 0 (equivalently IRR > required return, for conventional flows); when choosing among projects, pick the largest NPV.",
    formulas: ["C.npv", "C.irr"],
  },

  // ================================================================== ALM
  {
    id: "alm-target-duration",
    topic: "ALM",
    area: "G",
    kind: "plan",
    title: "Reaching a target duration",
    problem: "A portfolio holds bond A (value 500, Macaulay duration 4) and bond B (value 300, duration 9). How much of a 12-year zero-coupon bond must be added to give the portfolio a duration of 7?",
    correct: { steps: ["The zero\'s duration is its maturity, 12.", "Solve $\\frac{500(4) + 300(9) + 12X}{800 + X} = 7$."] },
    wrong: [
      { steps: ["Current duration: $\\frac{500(4) + 300(9)}{800} = 5.875$.", "The gap is 1.125 and the zero has duration 12, so $X = 800 \\times 1.125/12$."], why: "Not a weighted average: the new bond's value also enters the denominator. Solve $\\frac{4700 + 12X}{800 + X} = 7$.", value: () => (800 * 1.125) / 12 },
      { steps: ["The zero\'s duration is its maturity, 12.", "Solve $\\frac{4 + 9 + 12X}{2 + X} = 7$."], why: "Weights by the number of bonds instead of their values.", value: () => (7 * 2 - 13) / (12 - 7) },
      { steps: ["The zero\'s duration is its maturity, 12.", "Solve $\\frac{500(4) + 300(9) + 12X}{800} = 7$."], why: "The new bond's value must be added to the denominator too.", value: () => (5600 - 4700) / 12 },
    ],
    insight: "Portfolio duration (and convexity) = value-weighted average. Adding an asset changes both numerator and denominator.",
    formulas: ["G.portfolio-duration"],
    result: { label: "Amount of the zero-coupon bond", value: () => (7 * 800 - 4700) / (12 - 7), reference: () => bisect((x) => (2000 + 2700 + 12 * x) / (800 + x) - 7, 0, 10000), digits: 2 },
  },
  {
    id: "alm-redington-setup",
    topic: "ALM",
    area: "G",
    kind: "plan",
    title: "Immunizing with two zero-coupon bonds",
    problem: "A liability of 1,000 is due at time 5. Assets are zero-coupon bonds maturing at times 2 and 8; the yield is 6%. How do you find the amounts to buy for Redington immunization?",
    correct: { steps: ["PVs: $Av^2 + Bv^8 = 1000v^5$.", "Durations: $2Av^2 + 8Bv^8 = 5000v^5$.", "Solve; then check convexity."] },
    wrong: [
      { steps: ["Amounts: $A + B = 1000$.", "Durations: $2Av^2 + 8Bv^8 = 5000v^5$.", "Solve; then check convexity."], why: "Condition (i) is about present values, not face amounts.", value: () => {
        // A + B = 1000 and 2A v² + 8B v⁸ = 5000 v⁵ (inconsistent mix) — report A.
        const v2 = 1.06 ** -2;
        const v8 = 1.06 ** -8;
        const rhs = 5000 * 1.06 ** -5;
        return (rhs - 8 * 1000 * v8) / (2 * v2 - 8 * v8);
      } },
      { steps: ["PVs: $Av^2 + Bv^8 = 1000v^5$.", "Convexities: $4Av^2 + 64Bv^8 = 25000v^5$.", "Solve; then check durations."], why: "Redington matches PV and *duration*; convexity is the inequality checked afterwards." },
      { steps: ["Find one asset with duration 5.", "Buy it with PV $1000v^5$.", "Then check convexity."], why: "Neither asset has duration 5; with these two you need a mix found from two equations." },
    ],
    insight: "Redington: (i) PV assets = PV liabilities, (ii) durations equal, (iii) asset convexity larger. Two unknowns ↔ conditions (i) and (ii).",
    formulas: ["G.redington", "M.linear-system"],
    result: {
      label: "Amount A due at time 2",
      value: () => 1000 * Math.pow(1.06, -3) * ((8 - 5) / (8 - 2)),
      reference: () => {
        const v2 = 1.06 ** -2;
        const v8 = 1.06 ** -8;
        const L = 1000 * 1.06 ** -5;
        // [v2 v8; 2v2 8v8][A;B] = [L; 5L]
        const det = v2 * 8 * v8 - v8 * 2 * v2;
        return (L * 8 * v8 - v8 * 5 * L) / det;
      },
      digits: 2,
    },
  },
  {
    id: "alm-macaulay-approx",
    topic: "ALM",
    area: "G",
    kind: "setup",
    title: "Price after a yield change (Macaulay)",
    problem: "A bond priced at 100 at 6% has Macaulay duration 8. Using the first-order Macaulay approximation, which expression estimates its price at 7%?",
    correct: { steps: ["$100\\left(\\frac{1.06}{1.07}\\right)^{8}$"] },
    wrong: [
      { steps: ["$100\\,(1 - 0.01 \\times 8)$"], why: "That is the *modified* approximation, which needs $D_{mod} = 8/1.06$, not the Macaulay duration.", value: () => 100 * (1 - 0.08) },
      { steps: ["$100\\left(\\frac{1.07}{1.06}\\right)^{8}$"], why: "Upside down: a higher yield must lower the price.", value: () => 100 * Math.pow(1.07 / 1.06, 8) },
      { steps: ["$100\\,(1.07)^{-8}$"], why: "Treats the bond as a zero-coupon bond of 100 rather than scaling the current price.", value: () => 100 * Math.pow(1.07, -8) },
    ],
    insight: "Macaulay: $P_1 \\approx P_0\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_{mac}}$. Modified: $P_1 \\approx P_0[1 - (i_1 - i_0)D_{mod}]$. Don't mix them.",
    formulas: ["G.approx-macaulay"],
    result: { label: "Estimated price", value: () => 100 * Math.pow(1.06 / 1.07, 8), reference: () => 100 * Math.exp(-8 * (Math.log(1.07) - Math.log(1.06))), digits: 4 },
  },
  {
    id: "alm-modified-semiannual",
    topic: "ALM",
    area: "G",
    kind: "first-step",
    title: "Modified duration with semiannual yields",
    problem: "A bond's Macaulay duration is 6 years. Its yield is quoted as 8% convertible semiannually. Find the modified duration with respect to that nominal yield.",
    correct: { steps: ["$D_{mod} = 6/(1 + 0.08/2)$."] },
    wrong: [
      { steps: ["$D_{mod} = 6/(1 + 0.08)$."], why: "Uses the nominal rate as if it were annual effective; one period is a half-year at 4%.", value: () => 6 / 1.08 },
      { steps: ["$D_{mod} = 6/(1.04)^2$."], why: "That is the modified duration with respect to the *annual effective* yield, not the quoted nominal one.", value: () => 6 / 1.0816 },
      { steps: ["$D_{mod} = 6 \\times (1 + 0.08/2)$."], why: "Modified duration is $v \\cdot D_{mac}$ — smaller, not larger.", value: () => 6 * 1.04 },
    ],
    insight: "$D_{mod} = D_{mac}/(1 + j)$, where $j$ is the yield per period of the rate you will shift.",
    formulas: ["G.modified"],
    result: {
      label: "Modified duration",
      value: () => 6 / 1.04,
      // Any cash flows with Macaulay duration 6: a zero-coupon bond at 6 years. Differentiate its price in the nominal yield.
      reference: () => {
        const price = (y: number) => Math.pow(1 + y / 2, -12);
        const h = 1e-6;
        return -(price(0.08 + h) - price(0.08 - h)) / (2 * h) / price(0.08);
      },
      digits: 4,
    },
  },
  {
    id: "alm-dedication",
    topic: "ALM",
    area: "G",
    kind: "plan",
    title: "Exact matching (dedication)",
    problem: "Liabilities: 1,000 at time 1 and 2,000 at time 2. Available: a 1-year zero-coupon bond yielding 5%, and a 2-year bond with 6% annual coupons priced at par. Find the cost of an exactly matching portfolio.",
    correct: { steps: ["Last liability first: $1.06F = 2000$.", "1-year zeros cover $1000 - 0.06F$.", "Cost $= F + (1000 - 0.06F)/1.05$."] },
    wrong: [
      { steps: ["First liability first: 1-year zeros for 1,000.", "2-year bonds: face $2000/1.06$.", "Cost $= 1000/1.05 + 2000/1.06$."], why: "Ignores the coupon the 2-year bond pays at time 1, which already covers part of the first liability — you over-buy.", value: () => 1000 / 1.05 + 2000 / 1.06 },
      { steps: ["2-year bonds: face 2,000.", "1-year zeros for 1,000.", "Cost $= 2000 + 1000/1.05$."], why: "The 2-year bond also pays a coupon at time 2; face 2,000 pays 2,120.", value: () => 2000 + 1000 / 1.05 },
      { steps: ["Use one yield, 6%, for both liabilities.", "Cost $= 1000/1.06 + 2000/1.06^2$.", "Buy any bonds with that PV."], why: "That is a PV at one rate, not the cost of the bonds that actually match the cash flows.", value: () => 1000 / 1.06 + 2000 / 1.06 ** 2 },
    ],
    insight: "Dedication: work *backwards* from the last liability, because longer bonds throw off coupons that reduce what earlier liabilities still need.",
    formulas: ["G.dedication"],
    result: {
      label: "Cost",
      value: () => {
        const F = 2000 / 1.06;
        return F + (1000 - 0.06 * F) / 1.05;
      },
      reference: () => {
        // Solve the 2×2 matching system: time 1: z + 0.06F = 1000; time 2: 1.06F = 2000.
        const F = bisect((f) => 1.06 * f - 2000, 0, 5000);
        const z = 1000 - 0.06 * F;
        return F * 1 + z * Math.pow(1.05, -1);
      },
      digits: 2,
    },
  },
  {
    id: "alm-annuity-duration",
    topic: "ALM",
    area: "G",
    kind: "first-step",
    title: "Duration of a level annuity",
    problem: "Find the Macaulay duration of a 10-year level annuity-immediate at 5%.",
    correct: { steps: ["$D = (Ia)_{\\overline{10|}}/a_{\\overline{10|}}$."] },
    wrong: [
      { steps: ["$D = (1 + 2 + \\dots + 10)/10 = 5.5$."], why: "That weights each time equally; the duration weights by present value, which pulls it below 5.5.", value: () => 5.5 },
      { steps: ["$D = \\ddot a_{\\overline{10|}}$, as for a par bond."], why: "$\\ddot a_{\\overline{n|}}$ is the duration of a *par bond*, whose final redemption shifts the weights.", value: () => adue(10, 0.05) },
      { steps: ["$D = (Ia)_{\\overline{10|}}/\\ddot a_{\\overline{10|}}$."], why: "Divide by the PV of the annuity itself, $a_{\\overline{10|}}$.", value: () => Ia(10, 0.05) / adue(10, 0.05) },
    ],
    insight: "Duration = $\\sum t\\,PV_t / \\sum PV_t$. Know the special cases: level annuity $(Ia)/a$, perpetuity $(1+i)/i$, par bond $\\ddot a$, zero = maturity.",
    formulas: ["G.duration-special", "G.macaulay"],
    result: { label: "Macaulay duration", value: () => Ia(10, 0.05) / an(10, 0.05), reference: () => sum(1, 10, (t) => t * 1.05 ** -t) / sum(1, 10, (t) => 1.05 ** -t), digits: 4 },
  },
  {
    id: "alm-second-order",
    topic: "ALM",
    area: "G",
    kind: "plan",
    title: "Duration plus convexity estimate",
    problem: "At 5%, a bond has price 100, modified duration 7.2 and convexity 70. Estimate its price at 6.5% using duration and convexity.",
    correct: { steps: ["$\\Delta i = 0.015$.", "$P \\approx 100[1 - 7.2(0.015) + \\tfrac12(70)(0.015)^2]$."] },
    wrong: [
      { steps: ["$\\Delta i = 0.015$.", "$P \\approx 100[1 - 7.2(0.015)]$."], why: "Ignores convexity, which the question asks you to use.", value: () => 100 * (1 - 0.108) },
      { steps: ["$\\Delta i = 0.015$.", "$P \\approx 100[1 - 7.2(0.015) - \\tfrac12(70)(0.015)^2]$."], why: "Positive convexity always *raises* the estimate, whichever way the yield moves.", value: () => 100 * (1 - 0.108 - 0.007875) },
      { steps: ["$\\Delta i = 0.015$.", "$P \\approx 100[1 - 7.2(0.015) + 70(0.015)^2]$."], why: "The second-order Taylor term has a $\\tfrac12$.", value: () => 100 * (1 - 0.108 + 70 * 0.015 ** 2) },
    ],
    insight: "$\\frac{\\Delta P}{P} \\approx -D_{mod}\\,\\Delta i + \\tfrac12 C\\,(\\Delta i)^2$.",
    formulas: ["G.approx-second-order"],
    result: { label: "Estimated price", value: () => 100 * (1 - 0.108 + 0.007875), reference: () => 100 * (1 - 7.2 * 0.015 + 0.5 * 70 * 0.015 * 0.015), digits: 4 },
  },
  {
    id: "alm-full-immunization-check",
    topic: "ALM",
    area: "G",
    kind: "trap",
    title: "Full vs Redington immunization",
    problem: "A single liability is due at time 6. Assets with the same PV and duration as the liability consist of cash flows at times 7 and 9 only. Which statement is right?",
    correct: { steps: ["Impossible: with every asset flow after 6, the asset duration exceeds 6."] },
    wrong: [
      { steps: ["Fully immunized, because PV and duration match."], why: "Full immunization also needs an asset flow before and after the liability; and with flows only at 7 and 9 the durations cannot match anyway." },
      { steps: ["Redington-immunized only, not fully immunized."], why: "Not even Redington: the duration condition cannot hold with every asset flow after time 6." },
      { steps: ["Fully immunized if the asset convexity is larger."], why: "Convexity is Redington's condition (iii). Full immunization replaces it with the before-and-after requirement." },
    ],
    insight: "Before calculating, sanity-check durations: a weighted average of times lies between the earliest and latest cash flow.",
    formulas: ["G.full-immunization", "G.redington"],
  },
];

/** Price of a 12-year bond, 60 annual coupons, C = 1000, yield 8% (used by bond-total-interest). */
function PRICE_12(): number {
  return 60 * an(12, 0.08) + 1000 * v(0.08, 12);
}

export const STRATEGY_BY_ID: Record<string, StrategyQuestion> = Object.fromEntries(STRATEGY_QUESTIONS.map((q) => [q.id, q]));
