/**
 * Concept Practice — time value of money.
 */
import { drawUntil, gridAmount, gridRate, lit, mamt, mnum, mpc, pc } from "../templates/kit";
import type { MisconceptionId } from "../misconceptions";
import type { ChoiceTemplate, ConceptFailure, TruthCheck } from "../types";
import { conceptQuestion, conceptTemplate, math, statement, statementQuestion, type ConceptOption } from "./kit";

/** A math option with a numeric probe (or a check), for expression-selection items. */
interface MathOpt {
  latex: string;
  probe?: string;
  check?: TruthCheck;
  why: string;
  misconception?: MisconceptionId;
  stage?: number;
  failure?: ConceptFailure;
  conditionTrue?: string;
  confusedWith?: string;
}
const mathOptions = (c: MathOpt, ds: MathOpt[]): { correct: ConceptOption; distractors: ConceptOption[] } => {
  const one = (o: MathOpt): ConceptOption => ({
    content: math(o.latex),
    why: o.why,
    ...(o.probe ? { probe: o.probe } : {}),
    ...(o.check ? { check: o.check } : {}),
    ...(o.misconception ? { misconception: o.misconception, stage: o.stage, failure: o.failure } : {}),
    ...(o.conditionTrue ? { conditionTrue: o.conditionTrue } : {}),
    ...(o.confusedWith ? { confusedWith: o.confusedWith } : {}),
  });
  return { correct: one(c), distractors: ds.map(one) };
};

/** `0.055` → `1.055`, for writing accumulation factors in options. */
const factor = (i: number): string => lit(1 + i);
/** A rate as a percentage to two decimals, for use inside `$…$`. */
const p2 = (x: number): string => `${(x * 100).toFixed(2)}\\%`;
/** `(1+0.05)` as an expression. */
const g = (i: number): string => `(1+${lit(i)})`;

const equationOfValue: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-equation-select",
  family: "con-tvm-equation",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["translation", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Choosing the equation of value that defines an unknown payment date.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const X = gridAmount(rng, 1000, 5000, 250);
    const Y = gridAmount(rng, 1000, 5000, 250);
    const n = rng.int(3, 8);
    const tTrue = n / 2 + rng.int(1, 6) * 0.5;
    const Z = Math.round((X * Math.pow(1 + i, tTrue) + Y * Math.pow(1 + i, tTrue - n)) * 100) / 100;
    const f = factor(i);
    const v = `(1+${lit(i)})`;
    // f(x) = 0 at the true date: the equation of value at time t, written from the explicit payments.
    const root = `(${lit(X)}*${v}**x + ${lit(Y)}*${v}**(x-${n}) - ${lit(Z)})`;
    const stem =
      variant === 0
        ? `A payment of ${mamt(X)} due now and a payment of ${mamt(Y)} due in ${n} years are to be replaced by a single payment of ${mamt(Z)} due at time $t$. The annual effective interest rate is $${mpc(i)}$.\n\nDetermine which of the following equations $t$ satisfies.`
        : `An obligation consists of ${mamt(X)} payable immediately and ${mamt(Y)} payable at the end of year ${n}. It is settled instead by one payment of ${mamt(Z)} at time $t$, with interest at an annual effective rate of $${mpc(i)}$.\n\nDetermine which of the following equations $t$ satisfies.`;

    return conceptQuestion({
      stem,
      correct: {
        content: math(`${mamt(X)}(${f})^{t} + ${mamt(Y)}(${f})^{t-${n}} = ${mamt(Z)}`),
        why: `Valued at time $t$, the payment due now travels $t$ years and the payment due at time ${n} travels $t-${n}$ years, so both sides are at the same date. Its root is $t = ${tTrue}$.`,
        probe: root,
      },
      distractors: [
        {
          content: math(`${mamt(X)}(${f})^{-t} + ${mamt(Y)}(${f})^{${n}-t} = ${mamt(Z)}`),
          misconception: "CONC_MOVED_WRONG_WAY",
          why: "Both payments were discounted away from time $t$ instead of accumulated to it: every exponent has the wrong sign.",
          method: "Moved each payment the wrong way along the timeline.",
          probe: `(${lit(X)}*${v}**(-x) + ${lit(Y)}*${v}**(${n}-x) - ${lit(Z)})`,
          stage: 1,
          failure: "application",
          conditionTrue: "It would describe the reverse problem: two payments due at time $t$ replaced by one payment now.",
        },
        {
          content: math(`${mamt(X)} + ${mamt(Y)}(${f})^{-${n}} = ${mamt(Z)}(${f})^{t}`),
          misconception: "TIMING_VALUATION_DATE",
          why: "The left side is a value at time 0, but $Z(1+i)^t$ is the replacement payment's value at time $2t$; the two sides are not at one date.",
          method: "Compared values at different dates.",
          probe: `(${lit(X)} + ${lit(Y)}*${v}**(-${n}) - ${lit(Z)}*${v}**x)`,
          stage: 0,
          failure: "selection",
          conditionTrue: "With $Z(1+i)^{-t}$ on the right, the equation is the correct one written at time 0.",
        },
        {
          content: math(`${mamt(X)}(1 + ${lit(i)}t) + ${mamt(Y)}\\bigl(1 + ${lit(i)}(t-${n})\\bigr) = ${mamt(Z)}`),
          misconception: "MODEL_COMPOUND_AS_SIMPLE",
          why: "An effective rate compounds; $1 + it$ is simple-interest growth.",
          method: "Accumulated with simple interest.",
          probe: `(${lit(X)}*(1+${lit(i)}*x) + ${lit(Y)}*(1+${lit(i)}*(x-${n})) - ${lit(Z)})`,
          stage: 2,
          failure: "selection",
          conditionTrue: "Correct only if the question specified simple interest at that rate.",
        },
        {
          content: math(`${mamt(X)}(${f})^{t} + ${mamt(Y)}(${f})^{${n}-t} = ${mamt(Z)}`),
          misconception: "ALG_SIGN_ERROR",
          why: `The second payment is due at time ${n}, so it travels $t-${n}$ years to time $t$, not $${n}-t$.`,
          method: "Reversed the sign of one exponent.",
          probe: `(${lit(X)}*${v}**x + ${lit(Y)}*${v}**(${n}-x) - ${lit(Z)})`,
          stage: 1,
          failure: "application",
        },
        {
          content: math(`${mamt(X)}(${f})^{t+1} + ${mamt(Y)}(${f})^{t-${n}} = ${mamt(Z)}`),
          misconception: "TIMING_EXTRA_PERIOD",
          why: "The payment due now travels exactly $t$ years to time $t$, not $t + 1$.",
          method: "Added an extra period of interest.",
          probe: `(${lit(X)}*${v}**(x+1) + ${lit(Y)}*${v}**(x-${n}) - ${lit(Z)})`,
          stage: 1,
          failure: "application",
        },
      ],
      reference: {
        values: [{ label: "t", expr: root, bracket: [0.01, 4 * n] }],
        description: `The time-$t$ equation of value, solved numerically, gives $t = ${tTrue}$. Each option's equation is solved for $t$ and only the correct one has that root.`,
      },
      steps: [
        { concept: "tvm.equation-of-value", reasoning: "Choose one valuation date for both sides; time $t$ is convenient." },
        { concept: "tvm.equation-of-value", reasoning: "Multiply each payment by $(1+i)^{T-s}$, where $T$ is the valuation date and $s$ the payment date." },
        { concept: "tvm.simple-vs-compound", reasoning: "An effective rate compounds, so the factors are powers of $1 + i$, not linear terms." },
      ],
      conditions: ["Compound interest at a constant annual effective rate.", "Every payment is valued at the same date."],
      relationship: "Value at $T$ of a payment $CF$ at time $s$: $CF\\,(1+i)^{T-s}$.",
      counterexample: `Valuing at time 0 gives $${mamt(X)} + ${mamt(Y)}v^{${n}} = ${mamt(Z)}v^{t}$ — different in appearance, identical in root.`,
      transfer: {
        principle: "Pick one valuation date and give every payment the exponent (valuation date − payment date).",
        unusual: "The unknown is a date rather than an amount.",
        misread: "Equivalent equations at different dates look different; inequivalent ones can look alike.",
      },
      itemFormat: "equation-selection",
      presentation: level === 2 ? ["unknown-time", "indirect-wording"] : ["unknown-time"],
      features: { multipleValuationDates: true, unfamiliar: level === 2 || variant === 1 },
      params: { i, X, Y, n, t: tTrue, Z, variant },
    });
  },
});

// ================================================================ simple and compound interest

const simpleRates: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-simple-rates",
  family: "con-tvm-simple",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.simple_compound",
  secondary: ["TVM.accumulation_discount"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "relationships"],
  soaConcept: "What simple interest (or discount) implies for the effective rate per year, and how simple and compound growth compare over time.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.04, 0.1, 0.005);
    const discount = level === 2;
    if (variant === 0) {
      const K = rng.int(3, 9);
      const a = (t: number) => `(1+${lit(i)}*${t})`;
      const truth = discount ? `(${a(K)}-${a(K - 1)})/${a(K)}` : `(${a(K)}-${a(K - 1)})/${a(K - 1)}`;
      const s = discount ? "d" : "i";
      const opt = (trend: string, value: number) => `$${s}_k$ ${trend}, and $${s}_{${K}} = ${p2(value)}$.`;
      const dec = "decreases as $k$ increases";
      const inc = "increases as $k$ increases";
      const same = "is the same for every $k$";
      const stem = discount
        ? `A deposit made at time 0 earns simple interest at a rate of ${pc(i)} per year. Let $d_k$ denote the effective rate of discount for year $k$.\n\nWhich of the following is true?`
        : `An account credits simple interest at a rate of ${pc(i)} per year on a single deposit made at time 0. Let $i_k$ denote the effective rate of interest earned during year $k$.\n\nWhich of the following is true?`;
      const correctValue = discount ? i / (1 + i * K) : i / (1 + i * (K - 1));
      const correctExpr = discount ? `${lit(i)}/(1+${lit(i)}*${K})` : `${lit(i)}/(1+${lit(i)}*${K - 1})`;
      const distractors = discount
        ? [
            { content: opt(same, i / (1 + i)), misconception: "CONC_TVM_SIMPLE_CONSTANT_RATE" as const, why: "The interest per year is constant, but the amount at the end of each year grows, so the discount rate per unit of that amount falls.", check: { expr: `${lit(i)}/(1+${lit(i)})`, op: "=" as const, than: truth }, stage: 2, failure: "conclusion" as const, conditionTrue: "Only the first year has $d_1 = i/(1+i)$." },
            { content: opt(dec, i / (1 + i * (K - 1))), misconception: "RATE_DISCOUNT_AS_INTEREST" as const, why: `That is the effective rate of interest $i_{${K}}$: the year's interest divided by the amount at the start of the year, not the end.`, check: { expr: `${lit(i)}/(1+${lit(i)}*${K - 1})`, op: "=" as const, than: truth }, stage: 1, failure: "selection" as const, confusedWith: "tvm.discount-vs-interest" },
            { content: opt(inc, (i * K) / (1 + i * K)), misconception: "CONC_TVM_WRONG_INTERVAL" as const, why: `$1 - 1/a(${K})$ is the discount rate over the whole of years 1 to ${K}, not for year ${K} alone.`, check: { expr: `(${lit(i)}*${K})/(1+${lit(i)}*${K})`, op: "=" as const, than: truth }, stage: 1, failure: "interpretation" as const },
            { content: opt(same, 1 - Math.pow(1 + i * K, -1 / K)), misconception: "CONC_TVM_AVERAGE_RATE" as const, why: `The level compound discount rate reproducing $a(${K})$ is an average over ${K} years; the year-by-year rates differ.`, check: { expr: `1-(1+${lit(i)}*${K})**(-1/${K})`, op: "=" as const, than: truth }, stage: 2, failure: "connection" as const },
            { content: opt(dec, i / (1 + i * (K + 1))), misconception: "TIMING_EXTRA_PERIOD" as const, why: `Year ${K} ends at time ${K}, so the base is $a(${K}) = 1 + ${K}i$, not $a(${K + 1})$.`, check: { expr: `${lit(i)}/(1+${lit(i)}*${K + 1})`, op: "=" as const, than: truth }, stage: 1, failure: "application" as const },
          ]
        : [
            { content: opt(same, i), misconception: "CONC_TVM_SIMPLE_CONSTANT_RATE" as const, why: "The interest credited each year is constant, but the balance it is measured against grows, so the rate falls.", check: { expr: lit(i), op: "=" as const, than: truth }, stage: 2, failure: "conclusion" as const, conditionTrue: "True only for year 1, or under compound interest." },
            { content: opt(inc, i * K), misconception: "CONC_TVM_WRONG_INTERVAL" as const, why: `$${K}i$ is the total interest over ${K} years per unit deposited, not the rate for year ${K}.`, check: { expr: `${lit(i)}*${K}`, op: "=" as const, than: truth }, stage: 1, failure: "interpretation" as const },
            { content: opt(dec, i / (1 + i * K)), misconception: "RATE_DISCOUNT_AS_INTEREST" as const, why: `Dividing by the amount at the end of year ${K} gives the effective rate of discount $d_{${K}}$.`, check: { expr: `${lit(i)}/(1+${lit(i)}*${K})`, op: "=" as const, than: truth }, stage: 1, failure: "selection" as const, confusedWith: "tvm.discount-vs-interest" },
            { content: opt(same, Math.pow(1 + i * K, 1 / K) - 1), misconception: "CONC_TVM_AVERAGE_RATE" as const, why: `The compound rate reproducing $a(${K})$ averages over ${K} years; it is not any single year's rate.`, check: { expr: `(1+${lit(i)}*${K})**(1/${K})-1`, op: "=" as const, than: truth }, stage: 2, failure: "connection" as const },
            { content: opt(dec, i / (1 + i * (K - 2))), misconception: "TIMING_MISSING_PERIOD" as const, why: `Year ${K} starts at time ${K - 1}, so the base is $a(${K - 1})$, not $a(${K - 2})$.`, check: { expr: `${lit(i)}/(1+${lit(i)}*${K - 2})`, op: "=" as const, than: truth }, stage: 1, failure: "application" as const },
          ];
      return conceptQuestion({
        stem,
        correct: {
          content: opt(dec, correctValue),
          why: `Interest of $i$ per unit is credited every year, measured against $a(${discount ? K : K - 1})$, which grows: $${s}_{${K}} = ${p2(correctValue)}$.`,
          check: { expr: correctExpr, op: "=", than: truth },
        },
        distractors,
        steps: [
          { concept: "tvm.simple-vs-compound", reasoning: `Simple interest gives $a(t) = 1 + ${lit(i)}t$: the same ${lit(i)} is credited each year.` },
          { concept: "tvm.amount-function", reasoning: discount ? `$d_k = [a(k) - a(k-1)]/a(k)$ — the year's interest over the end-of-year amount.` : `$i_k = [a(k) - a(k-1)]/a(k-1)$ — the year's interest over the start-of-year amount.` },
          { concept: "tvm.simple-vs-compound", reasoning: "A constant numerator over a growing denominator: the rate falls every year." },
        ],
        conditions: ["Simple interest from time 0 on a single deposit.", discount ? "$d_k$ is measured on the amount at the end of year $k$." : "$i_k$ is measured on the amount at the start of year $k$."],
        relationship: discount ? "$d_k = \\dfrac{i}{1 + ik}$" : "$i_k = \\dfrac{i}{1 + i(k-1)}$",
        counterexample: "Under compound interest the effective rate is the same every year.",
        transfer: {
          principle: "A rate for a period is the period's interest divided by the right base; under simple interest the interest is fixed while the base grows.",
          unusual: discount ? "The rate asked for is a discount rate, measured on the end-of-year amount." : "The question asks about the pattern of rates, not one accumulated value.",
          misread: "“Simple interest at 6%” fixes the interest amount, not the effective rate.",
        },
        itemFormat: "interpretation",
        presentation: discount ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: discount },
        params: { i, K, variant },
      });
    }
    // Variant 1: simple versus compound over time.
    const v = (t: number) => (discount ? `(1-${lit(i)}*${t})` : `(1+${lit(i)}*${t})`);
    const w = (t: number) => (discount ? `(1-${lit(i)})**${t}` : `${g(i)}**${t}`);
    const [P, Q] = discount ? ["P", "Q"] : ["X", "Y"];
    const stem = discount
      ? `A payment of 1 is due at time $t$, where $0 < t < 10$. Let $P(t)$ be its present value at time 0 under simple discount at a rate of ${pc(i)} per year, and $Q(t)$ its present value at an annual effective rate of discount of ${pc(i)}.\n\nWhich of the following is true?`
      : `Account X credits simple interest at a rate of ${pc(i)} per year. Account Y credits compound interest at an annual effective rate of ${pc(i)}. Each account receives a single deposit of 1 at time 0; $X(t)$ and $Y(t)$ denote the account values at time $t > 0$.\n\nWhich of the following is true?`;
    return conceptQuestion({
      stem,
      correct: {
        content: `$${P}(t) > ${Q}(t)$ for $0 < t < 1$, $${P}(1) = ${Q}(1)$, and $${Q}(t) > ${P}(t)$ for $t > 1$.`,
        why: `The simple function is linear and the compound one is a convex exponential; they meet at $t = 0$ and $t = 1$, so the line lies above the curve between them and below it afterwards.`,
        check: { expr: `${v(0.5)}-${w(0.5)}`, op: ">", than: 0 },
      },
      distractors: [
        { content: `$${Q}(t) \\ge ${P}(t)$ for every $t > 0$, with equality only at $t = 1$.`, misconception: "CONC_TVM_COMPOUND_ALWAYS_LARGER", why: `At $t = 0.5$, $${P} = ${mnum(discount ? 1 - 0.5 * i : 1 + 0.5 * i, 4)}$ exceeds $${Q} = ${mnum(discount ? Math.pow(1 - i, 0.5) : Math.pow(1 + i, 0.5), 4)}$.`, check: { expr: `${w(0.5)}-${v(0.5)}`, op: ">=", than: 0 }, stage: 2, failure: "conclusion", conditionTrue: "It holds for $t \\ge 1$ only." },
        { content: `$${Q}(t) > ${P}(t)$ for $0 < t < 1$, $${P}(1) = ${Q}(1)$, and $${P}(t) > ${Q}(t)$ for $t > 1$.`, misconception: "CONC_DIRECTION_REVERSED", why: "Every comparison is reversed: a straight line through the two meeting points lies above a convex curve between them.", check: { expr: `${w(2)}-${v(2)}`, op: "<", than: 0 }, stage: 2, failure: "application" },
        { content: `$${P}(t) = ${Q}(t)$ for $0 < t \\le 1$, and $${Q}(t) > ${P}(t)$ for $t > 1$.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Compound growth is exponential within the year as well; it does not run linearly until the first year end.", check: { expr: `${v(0.5)}-${w(0.5)}`, op: "=", than: 0 }, stage: 1, failure: "selection", conditionTrue: "True if compound interest were credited only at whole years with simple interest in between." },
        { content: `$${P}(t) = ${Q}(t)$ for every $t > 0$, because the two rates are equal.`, misconception: "CONC_RELATED_TERM", why: "Equal rates under different models are not equivalent: the functions agree only at $t = 0$ and $t = 1$.", check: { expr: `${v(2)}-${w(2)}`, op: "=", than: 0 }, stage: 0, failure: "recognition", confusedWith: "tvm.simple-vs-compound" },
        { content: `$${Q}(t) - ${P}(t)$ is the same in every year after the first.`, misconception: "SEQ_GEOMETRIC_AS_ARITHMETIC", why: "The gap widens each year because the compound function is geometric.", check: { expr: `(${w(3)}-${v(3)})-(${w(2)}-${v(2)})`, op: "=", than: 0 }, stage: 1, failure: "connection" },
      ],
      steps: [
        { concept: discount ? "tvm.simple-discount" : "tvm.simple-vs-compound", reasoning: discount ? `Simple discount: $P(t) = 1 - ${lit(i)}t$, linear in $t$.` : `Simple interest: $X(t) = 1 + ${lit(i)}t$, linear in $t$.` },
        { concept: "tvm.simple-vs-compound", reasoning: discount ? `Compound discount: $Q(t) = (${lit(1 - i)})^t$, a convex curve.` : `Compound interest: $Y(t) = (${factor(i)})^t$, a convex curve.` },
        { concept: "tvm.accumulation-function", reasoning: "Both functions are equal at $t = 0$ and $t = 1$; a chord of a convex curve lies above it between the points and below it outside." },
      ],
      conditions: ["Single payment or deposit of 1.", "Rates of equal size under the two models."],
      relationship: discount ? "$1 - dt \\ \\text{vs}\\ (1-d)^t$" : "$1 + it \\ \\text{vs}\\ (1+i)^t$",
      counterexample: "At $t = 1$ the two models always agree, whatever the rate.",
      transfer: {
        principle: "Linear and exponential functions that agree at two points cross there: the linear one wins between, the exponential one outside.",
        unusual: discount ? "The comparison is of present values, not accumulations." : "The answer is a pattern over all $t$, not a value at one date.",
        misread: "“Compound is always better” is only true for terms of at least one period.",
      },
      itemFormat: "comparative-statics",
      presentation: discount ? ["compare-streams", "indirect-wording"] : ["compare-streams"],
      features: { unfamiliar: discount },
      params: { i, variant },
    });
  },
});

const simpleExpression: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-simple-expression",
  family: "con-tvm-simple",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.simple_compound",
  secondary: ["TVM.discount_rates", "TVM.accumulation_discount"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "timing", "conditions"],
  soaConcept: "Writing the value of a single payment under simple interest or simple discount, including at a date other than 0.",
  variants: 2,
  generate(rng, level, variant) {
    const X = gridAmount(rng, 1000, 9000, 500);
    const r = gridRate(rng, 0.03, 0.08, 0.005);
    const R = lit(r);
    const disc = variant === 1;
    if (level === 3) {
      const t1 = rng.int(1, 3);
      const t2 = t1 + rng.int(2, 5);
      const num = disc ? `(1-${R}*${t2})` : `(1+${R}*${t1})`;
      const den = disc ? `(1-${R}*${t1})` : `(1+${R}*${t2})`;
      const truth = `${lit(X)}*${num}/${den}`;
      const sgn = disc ? "-" : "+";
      const stem = disc
        ? `The present value at time 0 of 1 payable at time $t$ is $1 - ${R}\\,t$ for $0 \\le t \\le ${t2}$ (simple discount). A payment of ${mamt(X)} is due at time ${t2}.\n\nDetermine which of the following expressions gives the value of this payment at time ${t1}, consistent with this discount function.`
        : `The accumulation function is $a(t) = 1 + ${R}\\,t$ for $t \\ge 0$. A payment of ${mamt(X)} is due at time ${t2}.\n\nDetermine which of the following expressions gives the value of this payment at time ${t1}.`;
      return conceptQuestion({
        stem,
        correct: { content: math(`${mamt(X)}\\,\\dfrac{1${sgn}${R}(${disc ? t2 : t1})}{1${sgn}${R}(${disc ? t1 : t2})}`), why: disc ? `Value at ${t1} = $X\\,v(${t2})/v(${t1})$, using the given discount function at both dates.` : `Value at ${t1} = $X\\,a(${t1})/a(${t2})$: 1 at time ${t1} grows to $a(${t2})/a(${t1})$ by time ${t2}.`, probe: truth },
        distractors: [
          { content: math(disc ? `${mamt(X)}\\bigl(1-${R}(${t2 - t1})\\bigr)` : `\\dfrac{${mamt(X)}}{1+${R}(${t2 - t1})}`), misconception: "CONC_TVM_CLOCK_RESTART", why: "Simple interest here is measured from time 0; restarting it at time " + t1 + " gives a different function.", probe: disc ? `${lit(X)}*(1-${R}*${t2 - t1})` : `${lit(X)}/(1+${R}*${t2 - t1})`, stage: 1, failure: "application", conditionTrue: "Correct under compound interest, where the factor depends only on the length of the interval." },
          { content: math(disc ? `${mamt(X)}\\bigl(1-${R}(${t2})\\bigr)` : `\\dfrac{${mamt(X)}}{1+${R}(${t2})}`), misconception: "TIMING_VALUATION_DATE", why: `That is the value at time 0, not at time ${t1}.`, probe: disc ? `${lit(X)}*(1-${R}*${t2})` : `${lit(X)}/(1+${R}*${t2})`, stage: 2, failure: "interpretation" },
          { content: math(`${mamt(X)}(${disc ? lit(1 - r) : factor(r)})^{${disc ? "" : "-"}${t2 - t1}}`), misconception: "MODEL_SIMPLE_AS_COMPOUND", why: "The given function is linear in $t$; compound factors do not apply.", probe: disc ? `${lit(X)}*(1-${R})**${t2 - t1}` : `${lit(X)}*(1+${R})**(-${t2 - t1})`, stage: 0, failure: "recognition" },
          { content: math(`${mamt(X)}\\,\\dfrac{1${sgn}${R}(${disc ? t1 : t2})}{1${sgn}${R}(${disc ? t2 : t1})}`), misconception: "ALG_INVERTED_RATIO", why: "The ratio is inverted: it moves the payment later, making it larger, instead of earlier.", probe: `${lit(X)}*${den}/${num}`, stage: 1, failure: "application" },
          { content: math(disc ? `\\dfrac{${mamt(X)}}{1+${R}(${t2 - t1})}` : `${mamt(X)}\\bigl(1-${R}(${t2 - t1})\\bigr)`), misconception: "RATE_DISCOUNT_AS_INTEREST", why: disc ? "A discount rate is not used as an interest rate in the denominator." : "An interest rate cannot be deducted as if it were a discount rate.", probe: disc ? `${lit(X)}/(1+${R}*${t2 - t1})` : `${lit(X)}*(1-${R}*${t2 - t1})`, stage: 0, failure: "selection" },
        ],
        reference: { values: [{ label: `value at ${t1}`, expr: disc ? `${lit(X)}*(1-${R}*${t2})*(1-${R}*${t1})**(-1)` : `${lit(X)}*(1+${R}*${t2})**(-1)*(1+${R}*${t1})` }], description: `Value at time ${t1} = $X$ times the ratio of the ${disc ? "discount" : "accumulation"} function at the two dates; each option is evaluated and compared with it.` },
        steps: [
          { concept: disc ? "tvm.simple-discount" : "tvm.accumulation-function", reasoning: disc ? "The discount function $v(t) = 1 - dt$ fixes the value at 0 of 1 due at any $t$." : "The accumulation function fixes how 1 invested at time 0 grows to every later date." },
          { concept: "tvm.present-value", reasoning: `The value at time ${t1} of a payment at ${t2} is $X\\,${disc ? `v(${t2})/v(${t1})` : `a(${t1})/a(${t2})`}$: move it to time 0, then forward to ${t1}.` },
          { concept: "tvm.simple-vs-compound", reasoning: `For a linear function the ratio is not a function of $${t2} - ${t1}$ alone, so the clock cannot be restarted at time ${t1}.` },
        ],
        conditions: ["The given function applies from time 0.", "No other rate is available."],
        relationship: disc ? "$\\text{Value at } t_1 = X\\,\\dfrac{v(t_2)}{v(t_1)}$" : "$\\text{Value at } t_1 = X\\,\\dfrac{a(t_1)}{a(t_2)}$",
        counterexample: `With compound interest, $a(t_1)/a(t_2) = (1+i)^{-(t_2-t_1)}$, so restarting the clock would be harmless.`,
        transfer: {
          principle: "A valuation between two dates is the ratio of the accumulation (or discount) function at those dates.",
          unusual: "The valuation date is neither 0 nor the payment date.",
          misread: "“Simple interest from time 0” is not the same as simple interest from the valuation date.",
        },
        itemFormat: "expression-selection",
        presentation: ["hidden-structure", "valuation-date"],
        features: { multipleValuationDates: true, unfamiliar: true },
        modelingDecisions: 1,
        params: { X, r, t1, t2, variant },
      });
    }
    const months = level === 2 ? drawUntil(() => rng.int(5, 30), (m) => m % 12 !== 0) : 0;
    const t = level === 2 ? months / 12 : rng.int(2, 6);
    const tL = level === 2 ? `\\tfrac{${months}}{12}` : `${t}`;
    const T = lit(t);
    const xs = mamt(X);
    const wording = level === 2 ? `${months} months from now` : `${t} years from now`;
    const stem = disc
      ? `A bank lends money at a simple discount rate of ${pc(r)} per year. A borrower receives ${xs} today and repays the loan with a single payment ${wording}.\n\nDetermine which of the following expressions gives the repayment.`
      : `A payment of ${xs} is due ${wording}. Interest is simple interest at a rate of ${pc(r)} per year.\n\nDetermine which of the following expressions gives the present value of the payment.`;
    const truth = disc ? `${lit(X)}*(1-${R}*${T})**(-1)` : `${lit(X)}*(1+${R}*${T})**(-1)`;
    const distractors = disc
      ? [
          { content: math(`${xs}\\left(1+${R}\\cdot ${tL}\\right)`), misconception: "RATE_DISCOUNT_AS_INTEREST" as const, why: "Simple discount deducts $dt$ of the repayment in advance; it does not add $dt$ of the amount borrowed.", probe: `${lit(X)}*(1+${R}*${T})`, stage: 0, failure: "selection" as const, confusedWith: "tvm.discount-vs-interest" },
          { content: math(`${xs}\\,(${lit(1 - r)})^{-${tL}}`), misconception: "MODEL_SIMPLE_AS_COMPOUND" as const, why: "That is compound discount; simple discount is linear in $t$.", probe: `${lit(X)}*(1-${R})**(-${T})`, stage: 1, failure: "selection" as const },
          { content: math(`${xs}\\left(1-${R}\\cdot ${tL}\\right)`), misconception: "CONC_MOVED_WRONG_WAY" as const, why: "That is the present value of a repayment of " + xs + ", not the repayment for an advance of " + xs + ".", probe: `${lit(X)}*(1-${R}*${T})`, stage: 1, failure: "application" as const },
          { content: math(`${xs}\\,e^{${R}\\cdot ${tL}}`), misconception: "RATE_FORCE_AS_EFFECTIVE" as const, why: "The rate is a simple discount rate, not a force of interest.", probe: `${lit(X)}*exp(${R}*${T})`, stage: 0, failure: "recognition" as const },
        ]
      : [
          { content: math(`${xs}\\left(1-${R}\\cdot ${tL}\\right)`), misconception: "RATE_DISCOUNT_AS_INTEREST" as const, why: "Deducting $it$ treats the interest rate as a simple discount rate.", probe: `${lit(X)}*(1-${R}*${T})`, stage: 0, failure: "selection" as const, confusedWith: "tvm.simple-discount" },
          { content: math(`${xs}\\,(${factor(r)})^{-${tL}}`), misconception: "MODEL_SIMPLE_AS_COMPOUND" as const, why: "That discounts with compound interest; simple interest gives $a(t) = 1 + it$.", probe: `${lit(X)}*(1+${R})**(-${T})`, stage: 1, failure: "selection" as const },
          { content: math(`${xs}\\left(1+${R}\\cdot ${tL}\\right)`), misconception: "CONC_MOVED_WRONG_WAY" as const, why: "The payment is accumulated, not discounted to today.", probe: `${lit(X)}*(1+${R}*${T})`, stage: 1, failure: "application" as const },
          { content: math(`${xs}\\,e^{-${R}\\cdot ${tL}}`), misconception: "RATE_FORCE_AS_EFFECTIVE" as const, why: "The rate is a simple interest rate, not a force of interest.", probe: `${lit(X)}*exp(-${R}*${T})`, stage: 0, failure: "recognition" as const },
          level === 2
            ? { content: math(`\\dfrac{${xs}}{1+${R}\\cdot ${months}}`), misconception: "RATE_ANNUAL_FOR_PERIODIC" as const, why: "The rate is per year, so time must be measured in years.", probe: `${lit(X)}/(1+${R}*${months})`, stage: 1, failure: "application" as const }
            : { content: math(`\\dfrac{${xs}}{1+${R}\\cdot ${t - 1}}`), misconception: "TIMING_MISSING_PERIOD" as const, why: `The payment is ${t} years away, not ${t - 1}.`, probe: `${lit(X)}/(1+${R}*${t - 1})`, stage: 1, failure: "application" as const },
        ];
    return conceptQuestion({
      stem,
      correct: {
        content: math(disc ? `\\dfrac{${xs}}{1-${R}\\cdot ${tL}}` : `\\dfrac{${xs}}{1+${R}\\cdot ${tL}}`),
        why: disc ? "The repayment $R$ satisfies $R(1 - dt) = $ amount advanced, so $R = X/(1 - dt)$." : "Simple interest gives $a(t) = 1 + it$, so the present value is $X/(1 + it)$.",
        probe: disc ? `${lit(X)}/(1-${R}*${T})` : `${lit(X)}/(1+${R}*${T})`,
      },
      distractors,
      reference: { values: [{ label: disc ? "repayment" : "present value", expr: truth }], description: disc ? "Repayment $X\\,(1 - dt)^{-1}$, from the definition of simple discount." : "Present value $X\\,a(t)^{-1}$ with $a(t) = 1 + it$." },
      steps: [
        { concept: disc ? "tvm.simple-discount" : "tvm.simple-vs-compound", reasoning: disc ? "Simple discount: the present value of 1 due at $t$ is $1 - dt$." : "Simple interest: 1 grows to $1 + it$ at time $t$." },
        { concept: "tvm.present-value", reasoning: disc ? "The amount advanced is the present value of the repayment, so divide by $1 - dt$." : "The present value divides the payment by its accumulation factor." },
        ...(level === 2 ? [{ concept: "tvm.simple-vs-compound", reasoning: `Measure $t$ in years: ${months} months is $t = ${months}/12$.` }] : []),
      ],
      conditions: [disc ? "Simple discount at a rate per year." : "Simple interest at a rate per year.", "Time measured in years."],
      relationship: disc ? "$\\text{PV} = R(1 - dt),\\quad R = \\dfrac{\\text{PV}}{1 - dt}$" : "$\\text{PV} = \\dfrac{X}{1 + it}$",
      counterexample: "For $t = 1$, simple and compound interest at the same rate give the same factor.",
      transfer: {
        principle: "Simple interest and simple discount are linear in time, in opposite places: $1 + it$ multiplies, $1 - dt$ discounts.",
        unusual: disc ? "The unknown is the repayment, not the present value." : "The rate is simple, not compound.",
        misread: "The word “discount” decides whether $t$ enters as $1 + rt$ or $1 - rt$.",
      },
      itemFormat: "expression-selection",
      presentation: level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { X, r, t, variant },
    });
  },
});

const simpleStatements: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-simple-statements",
  family: "con-tvm-simple",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.simple_compound",
  secondary: ["TVM.discount_rates", "TVM.equation_of_value"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  soaConcept: "Judging statements that compare simple and compound interest.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "tvm.simple-vs-compound", reasoning: "Simple interest credits a fixed amount each year: $a(t) = 1 + it$; compound interest multiplies: $a(t) = (1+i)^t$." },
      { concept: "tvm.amount-function", reasoning: "The effective rate for a year is that year's interest over the balance at its start." },
      { concept: "tvm.simple-vs-compound", reasoning: "A linear function eventually falls below any increasing exponential, and lies above it between their meeting points." },
    ];
    const transfer = {
      principle: "Simple interest fixes the interest amount; compound interest fixes the rate.",
      unusual: "Each statement must be judged on its own; a familiar phrase can hide a false claim.",
      misread: "A higher simple rate is not a higher effective rate in every year.",
    };
    if (variant === 0) {
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const statements =
        level === 1
          ? [
              statement("I", "Under simple interest, the same amount of interest is credited in every year.", true, "Interest is earned on the original deposit only, so it is $i$ per unit deposited every year.", "MODEL_SIMPLE_AS_COMPOUND", { stage: 0, failure: "recognition" }),
              statement("II", `Under simple interest at a rate of ${pc(i)} per year, the effective rate of interest earned in each year is ${pc(i)}.`, false, `Year $k$ earns ${pc(i)} of the deposit on a balance of $1 + ${lit(i)}(k-1)$, so the rate is below ${pc(i)} after year 1.`, "CONC_TVM_SIMPLE_CONSTANT_RATE", { stage: 1, failure: "interpretation", conditionTrue: "It is true for year 1 only." }),
              statement("III", `For a term shorter than one year, simple interest at ${pc(i)} accumulates to more than compound interest at an annual effective rate of ${pc(i)}.`, true, `$1 + ${lit(i)}t > (${factor(i)})^t$ for $0 < t < 1$.`, "CONC_TVM_COMPOUND_ALWAYS_LARGER", { stage: 2, failure: "conclusion", check: { expr: `(1+${lit(i)}*0.5)-${g(i)}**0.5`, op: ">", than: 0 } }),
            ]
          : [
              statement("I", `Under simple discount at a rate of ${pc(i)} per year, the effective rate of discount for each year increases with the year.`, true, "With $a(t) = 1/(1 - dt)$, $d_k = 1 - a(k-1)/a(k) = d/(1 - d(k-1))$, which rises with $k$.", "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", conditionTrue: "Under simple interest, by contrast, the effective rate of interest falls." }),
              statement("II", `Under simple interest at ${pc(i)}, two payments with equal values at time 0 have equal values at every other date.`, false, "Simple interest does not compound, so moving both payments to another date does not multiply them by the same factor; equivalence depends on the comparison date.", "CONC_OUTSIDE_ASSUMPTIONS", { stage: 2, failure: "connection", conditionTrue: "True under compound interest." }),
              statement("III", `Simple interest at ${pc(i)} and simple discount at a rate of $${lit(i)}/${factor(i)}$ give the same present value for a payment due in one year.`, true, `$1/(1 + i) = 1 - i/(1+i)$ over one year.`, "RATE_DISCOUNT_AS_INTEREST", { stage: 0, failure: "selection", check: { expr: `1/${g(i)}`, op: "=", than: `1-${lit(i)}/${g(i)}` } }),
            ];
      return statementQuestion({
        stem: "Determine which of the following statements are true.",
        statements,
        extra: [
          { keys: ["II"], misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Accepting only II treats the two models as interchangeable and misjudges both true statements.", stage: 0, failure: "recognition" },
          { keys: ["I", "II"], misconception: "CONC_RELATED_TERM", why: "Accepting I and II while rejecting III confuses the rate with the amount of interest.", stage: 1, failure: "interpretation" },
        ],
        steps,
        conditions: ["Single deposit at time 0.", "Rates of equal size compared under different models."],
        relationship: "$1 + it$ (simple), $(1+i)^t$ (compound), $1 - dt$ (simple discount)",
        counterexample: "At $t = 1$ simple and compound interest at the same rate agree.",
        transfer,
        presentation: level === 2 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: level === 2 },
        params: { i, variant },
      });
    }
    // Variant 1: two accounts, numbers.
    const i = gridRate(rng, 0.04, 0.07, 0.005);
    const jj = drawUntil(() => Number((i + gridRate(rng, 0.01, 0.03, 0.005)).toFixed(6)), (x) => 1 + (x - i) / (i * x) >= 4);
    const rateCross = 1 + (jj - i) / (i * jj);
    let cross = 2;
    while (Math.pow(1 + i, cross) <= 1 + jj * cross) cross += 1;
    const X = (t: number) => `(1+${lit(jj)}*${t})`;
    const Y = (t: number) => `${g(i)}**${t}`;
    const rX = (t: number) => `(${lit(jj)}/(1+${lit(jj)}*${t - 1}))`;
    const stem = `Account X credits simple interest at ${pc(jj)} per year. Account Y credits compound interest at an annual effective rate of ${pc(i)}. Each receives a deposit of 1000 at time 0 and no further deposits.\n\nDetermine which of the following statements are true.`;
    let statements;
    if (level === 1) {
      const T0 = rng.int(2, Math.max(2, Math.min(cross - 1, 8)));
      const T2 = Math.ceil(rateCross) + rng.int(1, 3);
      const T3 = cross + rng.int(2, 8);
      statements = [
        statement("I", `At time ${T0}, Account X has the larger balance.`, true, `$1000(1 + ${lit(jj)}\\cdot ${T0}) > 1000(${factor(i)})^{${T0}}$.`, "CONC_TVM_COMPOUND_ALWAYS_LARGER", { stage: 2, failure: "conclusion", check: { expr: `${X(T0)}-${Y(T0)}`, op: ">", than: 0 } }),
        statement("II", `During year ${T2}, Account X earns a higher effective rate of interest than Account Y.`, false, `X's rate in year ${T2} is $${lit(jj)}/(1 + ${lit(jj)}\\cdot ${T2 - 1}) = ${p2(jj / (1 + jj * (T2 - 1)))}$, below ${pc(i)}.`, "CONC_TVM_SIMPLE_CONSTANT_RATE", { stage: 1, failure: "interpretation", check: { expr: `${rX(T2)}-${lit(i)}`, op: ">", than: 0 }, conditionTrue: `True in the early years, before $k = ${mnum(rateCross, 2)}$.` }),
        statement("III", `At time ${T3}, Account Y has the larger balance.`, true, `Compound growth overtakes simple growth; at time ${T3}, $(${factor(i)})^{${T3}} > 1 + ${lit(jj)}\\cdot ${T3}$.`, "SEQ_GEOMETRIC_AS_ARITHMETIC", { stage: 2, failure: "connection", check: { expr: `${Y(T3)}-${X(T3)}`, op: ">", than: 0 } }),
      ];
    } else {
      const T1 = cross + rng.int(1, 6);
      const T2 = rng.int(2, Math.floor(rateCross) - 1 >= 2 ? Math.floor(rateCross) - 1 : 2);
      statements = [
        statement("I", `At time ${T1}, Account Y has the larger balance.`, true, `$(${factor(i)})^{${T1}} > 1 + ${lit(jj)}\\cdot ${T1}$: exponential growth has overtaken linear growth.`, "SEQ_GEOMETRIC_AS_ARITHMETIC", { stage: 2, failure: "connection", check: { expr: `${Y(T1)}-${X(T1)}`, op: ">", than: 0 } }),
        statement("II", `During year ${T2}, Account X earns a higher effective rate of interest than Account Y.`, true, `X's rate in year ${T2} is $${p2(jj / (1 + jj * (T2 - 1)))}$, still above ${pc(i)}.`, "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", check: { expr: `${rX(T2)}-${lit(i)}`, op: ">", than: 0 } }),
        statement("III", `During year ${T1}, Account X earns a higher effective rate of interest than Account Y.`, false, `X's rate in year ${T1} is $${p2(jj / (1 + jj * (T1 - 1)))}$, below ${pc(i)}.`, "CONC_TVM_SIMPLE_CONSTANT_RATE", { stage: 1, failure: "interpretation", check: { expr: `${rX(T1)}-${lit(i)}`, op: ">", than: 0 }, conditionTrue: "It would hold in the early years only." }),
      ];
    }
    return statementQuestion({
      stem,
      statements,
      extra:
        level === 1
          ? [
              { keys: ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "Accepting only II reverses both balance comparisons.", stage: 2, failure: "conclusion" },
              { keys: ["I", "II"], misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Accepting I and II but not III treats Y as growing linearly, so it never catches up.", stage: 0, failure: "selection" },
            ]
          : [
              { keys: ["III"], misconception: "CONC_TVM_COMPOUND_ALWAYS_LARGER", why: "Accepting only III misjudges both balance and rate comparisons.", stage: 2, failure: "conclusion" },
              { keys: ["II", "III"], misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Rejecting I treats Y as growing linearly, so it never overtakes X.", stage: 0, failure: "selection" },
            ],
      steps,
      conditions: ["Single deposit of 1000 at time 0.", "Interest credited as stated; no withdrawals."],
      relationship: "$X(t) = 1000(1 + jt),\\quad Y(t) = 1000(1+i)^t,\\quad i^X_k = \\dfrac{j}{1 + j(k-1)}$",
      counterexample: `The yearly rates cross near $k = ${mnum(rateCross, 1)}$, well before the balances cross.`,
      transfer,
      presentation: ["compare-streams"],
      features: { unfamiliar: level === 2, multiConcept: true },
      params: { i, j: jj, variant },
    });
  },
});

// ================================================================ accumulation and amount functions

/** A quadratic amount function A(t) = K + bt + ct², drawn from rng. */
function quadraticAmount(rng: { int(a: number, b: number): number }) {
  const K = rng.int(5, 20) * 100;
  const b = rng.int(2, 12) * 5;
  const c = rng.int(1, 6);
  const A = (t: number | string) => `(${K}+${b}*${t}+${c}*(${t})**2)`;
  const val = (t: number) => K + b * t + c * t * t;
  const dA = (t: number) => `(${b}+${2 * c}*${t})`;
  const latex = `A(t) = ${K} + ${b}t + ${c === 1 ? "" : c}t^2`;
  return { K, b, c, A, val, dA, latex };
}

const amountInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-amount-interpretation",
  family: "con-tvm-amount",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.accumulation_discount",
  secondary: ["TVM.discount_rates"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "Reading what a ratio of amount-function values measures: rate of interest or discount, for which interval.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "tvm.amount-function", reasoning: "Interest earned over an interval is the change in the amount function over it." },
      { concept: "tvm.discount-vs-interest", reasoning: "A rate of interest divides that interest by the amount at the start of the interval; a rate of discount divides by the amount at the end." },
      { concept: "tvm.accumulation-function", reasoning: "The interval is fixed by the two arguments of $A$, not by time 0." },
    ];
    const transfer = {
      principle: "Every period rate is (interest over the interval) ÷ (amount at the start for interest, at the end for discount).",
      unusual: "The quantity is given and its meaning is asked for.",
      misread: "Closing and opening amounts look alike in a formula; check which one is in the denominator.",
    };
    if (variant === 0) {
      const n = rng.int(3, 9);
      const t1 = rng.int(1, 4);
      const t2 = t1 + rng.int(2, 4);
      const stem =
        level === 1
          ? `An investment's amount function is $A(t)$, $t \\ge 0$, where $A$ is positive and increasing.\n\nWhich of the following describes the quantity\n$$\\frac{A(${n}) - A(${n - 1})}{A(${n})}\\,?$$`
          : `An investment's amount function is $A(t)$, $t \\ge 0$, where $A$ is positive and increasing.\n\nWhich of the following describes the quantity\n$$\\frac{A(${t2}) - A(${t1})}{A(${t1})}\\,?$$`;
      const [lo, hi] = level === 1 ? [n - 1, n] : [t1, t2];
      const span = level === 1 ? `year ${n}` : `the period from time ${t1} to time ${t2}`;
      return conceptQuestion({
        stem,
        correct: {
          content: level === 1 ? `The effective rate of discount for year ${n}` : `The effective rate of interest for ${span}`,
          why: level === 1 ? `The interest earned in year ${n} is divided by the amount at the end of that year: that is $d_{${n}}$.` : `The interest earned from ${t1} to ${t2} is divided by the amount at time ${t1}: the effective rate for that whole period.`,
        },
        distractors: [
          { content: level === 1 ? `The effective rate of interest for year ${n}` : `The effective rate of discount for ${span}`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: level === 1 ? `The rate of interest divides by $A(${n - 1})$, the opening amount.` : `The rate of discount divides by $A(${t2})$, the closing amount.`, stage: 1, failure: "selection", confusedWith: "tvm.discount-vs-interest" },
          { content: `The amount of interest earned during ${span}`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: `The interest earned is the numerator $A(${hi}) - A(${lo})$ alone; the ratio is a rate.`, stage: 0, failure: "interpretation" },
          { content: level === 1 ? `The effective rate of discount for years 1 through ${n}` : `The effective rate of interest for year ${t2}`, misconception: "CONC_TVM_WRONG_INTERVAL", why: `The interval runs from time ${lo} to time ${hi}, as the two arguments of $A$ show.`, stage: 2, failure: "interpretation" },
          { content: `The force of interest at time ${hi}`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "The force of interest is the instantaneous rate $A'(t)/A(t)$, not a ratio over an interval.", stage: 1, failure: "selection", confusedWith: "tvm.force-of-interest" },
          level === 1
            ? { content: `The present value at time ${n - 1} of 1 payable at time ${n}`, misconception: "CONC_RELATED_TERM", why: `That is $A(${n - 1})/A(${n}) = 1 - d_{${n}}$, the complement of this quantity.`, stage: 1, failure: "interpretation" }
            : { content: `The annual effective rate of interest during ${span}`, misconception: "CONC_TVM_AVERAGE_RATE", why: `The ratio covers all ${t2 - t1} years at once; an annual rate would be $[A(${t2})/A(${t1})]^{1/${t2 - t1}} - 1$.`, stage: 2, failure: "connection" },
        ],
        steps,
        conditions: ["$A(t)$ is the amount function of a single investment with no further deposits."],
        relationship: "$i_{[s,t]} = \\dfrac{A(t) - A(s)}{A(s)},\\qquad d_{[s,t]} = \\dfrac{A(t) - A(s)}{A(t)}$",
        transfer,
        itemFormat: "interpretation",
        presentation: level === 2 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: level === 2 },
        params: { n, t1, t2, variant },
      });
    }
    const q = quadraticAmount(rng);
    const A = q.A;
    const n = rng.int(3, 8);
    const t1 = rng.int(1, 3);
    const t2 = t1 + rng.int(2, 4);
    const frac = (top: string, bottom: string) => `\\dfrac{${top}}{${bottom}}`;
    if (level === 1) {
      const truth = `${A(n)}/${A(n - 1)}-1`;
      return conceptQuestion({
        stem: `An investment's amount function is $${q.latex}$, $t \\ge 0$.\n\nDetermine which of the following expressions gives the effective rate of interest during year ${n}.`,
        correct: { content: math(frac(`A(${n}) - A(${n - 1})`, `A(${n - 1})`)), why: `Interest earned in year ${n} over the amount at the start of year ${n}.`, probe: `(${A(n)}-${A(n - 1)})/${A(n - 1)}` },
        distractors: [
          { content: math(frac(`A(${n}) - A(${n - 1})`, `A(${n})`)), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Dividing by the closing amount gives the effective rate of discount.", probe: `(${A(n)}-${A(n - 1)})/${A(n)}`, stage: 1, failure: "selection", confusedWith: "tvm.discount-vs-interest" },
          { content: math(`${frac(`A(${n})`, "A(0)")} - 1`), misconception: "CONC_TVM_WRONG_INTERVAL", why: `That is the rate for years 1 to ${n} combined.`, probe: `${A(n)}/${A(0)}-1`, stage: 2, failure: "interpretation" },
          { content: math(frac(`A(${n}) - A(${n - 1})`, "A(0)")), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The base must be the amount invested during year " + n + ", not the original amount.", probe: `(${A(n)}-${A(n - 1)})/${A(0)}`, stage: 1, failure: "application" },
          { content: math(frac(`A'(${n})`, `A(${n})`)), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is the force of interest at time " + n + ", an instantaneous rate.", probe: `${q.dA(n)}/${A(n)}`, stage: 1, failure: "selection", confusedWith: "tvm.force-of-interest" },
          { content: math(`\\left(${frac(`A(${n})`, "A(0)")}\\right)^{1/${n}} - 1`), misconception: "CONC_TVM_AVERAGE_RATE", why: `That is the level annual rate over ${n} years, not year ${n}'s rate.`, probe: `(${A(n)}/${A(0)})**(1/${n})-1`, stage: 2, failure: "connection" },
        ],
        reference: { values: [{ label: `i_${n}`, expr: truth }], description: `$i_{${n}} = A(${n})/A(${n - 1}) - 1$ evaluated from the given $A(t)$; each option is evaluated and compared.` },
        steps,
        conditions: ["Amount function of a single investment.", "Year $n$ runs from time $n-1$ to time $n$."],
        relationship: "$i_n = \\dfrac{A(n) - A(n-1)}{A(n-1)}$",
        transfer,
        itemFormat: "expression-selection",
        presentation: ["direct"],
        params: { K: q.K, b: q.b, c: q.c, n, variant },
      });
    }
    const truth = `1-${A(t1)}/${A(t2)}`;
    return conceptQuestion({
      stem: `An investment's amount function is $${q.latex}$, $t \\ge 0$.\n\nDetermine which of the following expressions gives the effective rate of discount for the period from time ${t1} to time ${t2}.`,
      correct: { content: math(frac(`A(${t2}) - A(${t1})`, `A(${t2})`)), why: `Interest over the period divided by the amount at its end, time ${t2}.`, probe: `(${A(t2)}-${A(t1)})/${A(t2)}` },
      distractors: [
        { content: math(frac(`A(${t2}) - A(${t1})`, `A(${t1})`)), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Dividing by the opening amount gives the rate of interest for the period.", probe: `(${A(t2)}-${A(t1)})/${A(t1)}`, stage: 1, failure: "selection", confusedWith: "tvm.discount-vs-interest" },
        { content: math(`1 - ${frac("A(0)", `A(${t2})`)}`), misconception: "CONC_TVM_WRONG_INTERVAL", why: `That measures discount from time 0, not from time ${t1}.`, probe: `1-${A(0)}/${A(t2)}`, stage: 2, failure: "interpretation" },
        { content: math(frac(`A(${t2}) - A(${t1})`, "A(0)")), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The base is the amount at the end of the period, not the original amount.", probe: `(${A(t2)}-${A(t1)})/${A(0)}`, stage: 1, failure: "application" },
        { content: math(`1 - \\left(${frac(`A(${t1})`, `A(${t2})`)}\\right)^{1/${t2 - t1}}`), misconception: "CONC_TVM_AVERAGE_RATE", why: "That is an annual rate averaged over the period, not the rate for the whole period.", probe: `1-(${A(t1)}/${A(t2)})**(1/${t2 - t1})`, stage: 2, failure: "connection" },
        { content: math(frac(`A'(${t2})`, `A(${t2})`)), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is the force of interest at time " + t2 + ".", probe: `${q.dA(t2)}/${A(t2)}`, stage: 1, failure: "selection" },
      ],
      reference: { values: [{ label: "d", expr: truth }], description: `$d = 1 - A(${t1})/A(${t2})$ from the given amount function.` },
      steps,
      conditions: ["Amount function of a single investment.", "The period runs from the first date to the second."],
      relationship: "$d_{[s,t]} = \\dfrac{A(t) - A(s)}{A(t)}$",
      transfer,
      itemFormat: "expression-selection",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { K: q.K, b: q.b, c: q.c, t1, t2, variant },
    });
  },
});

interface Candidate {
  latex: string;
  /** a(t) as an expression in the placeholder T. */
  expr: string;
}
const at = (f: Candidate, t: number) => f.expr.split("T").join(`(${t})`);

const accumulationValid: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-accumulation-valid",
  family: "con-tvm-amount",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.accumulation_discount",
  secondary: ["TVM.force_of_interest", "TVM.simple_compound"],
  itemFormat: "classification",
  conceptFamily: "applicability",
  dimensions: ["conditions", "terminology"],
  soaConcept: "Which functions can serve as an accumulation function: a(0) = 1 and never decreasing.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const d = gridRate(rng, 0.03, 0.08, 0.005);
    const del = gridRate(rng, 0.03, 0.08, 0.005);
    const alpha = rng.int(2, 9) / 1000;
    const k0 = Number((1 + gridRate(rng, 0.02, 0.1, 0.01)).toFixed(2));
    const bq = gridRate(rng, 0.04, 0.08, 0.01);
    const cq = rng.int(2, 6) / 1000;
    const Tq = Math.ceil((3 * bq) / cq);
    const valid = {
      simple: { latex: `a(t) = 1 + ${lit(i)}t`, expr: `(1+${lit(i)}*T)` },
      compound: { latex: `a(t) = (${factor(i)})^{t}`, expr: `${g(i)}**T` },
      force: { latex: `a(t) = e^{${lit(del)}t}`, expr: `exp(${lit(del)}*T)` },
      disc: { latex: `a(t) = (${lit(1 - d)})^{-t}`, expr: `(${lit(1 - d)})**(-T)` },
      quad: { latex: `a(t) = 1 + ${lit(alpha)}t^2`, expr: `(1+${lit(alpha)}*T**2)` },
      gauss: { latex: `a(t) = e^{${lit(alpha)}t^2}`, expr: `exp(${lit(alpha)}*T**2)` },
    };
    const invalid = {
      amount: { latex: `a(t) = ${k0} + ${lit(i)}t`, expr: `(${k0}+${lit(i)}*T)` },
      linearDown: { latex: `a(t) = 1 - ${lit(d)}t`, expr: `(1-${lit(d)}*T)` },
      hump: { latex: `a(t) = 1 + ${lit(bq)}t - ${lit(cq)}t^2`, expr: `(1+${lit(bq)}*T-${lit(cq)}*T**2)` },
      decay: { latex: `a(t) = e^{-${lit(del)}t}`, expr: `exp(-${lit(del)}*T)` },
      shifted: { latex: `a(t) = (${factor(i)})^{t+1}`, expr: `${g(i)}**(T+1)` },
      dip: { latex: `a(t) = (${factor(i)})^{t} - ${lit(i)}t`, expr: `(${g(i)}**T-${lit(i)}*T)` },
    };
    /** Where each invalid function fails, as a claim that holds for it. */
    const failure: Record<keyof typeof invalid, (f: Candidate) => { expr: string; op: "!=" | "<"; than: number }> = {
      amount: (f) => ({ expr: at(f, 0), op: "!=", than: 1 }),
      shifted: (f) => ({ expr: at(f, 0), op: "!=", than: 1 }),
      linearDown: (f) => ({ expr: at(f, 1), op: "<", than: 1 }),
      decay: (f) => ({ expr: at(f, 1), op: "<", than: 1 }),
      hump: (f) => ({ expr: at(f, Tq), op: "<", than: 1 }),
      dip: (f) => ({ expr: at(f, 0.5), op: "<", than: 1 }),
    };
    const steps = [
      { concept: "tvm.accumulation-function", reasoning: "An accumulation function is the value at $t$ of 1 invested at 0, so $a(0) = 1$." },
      { concept: "tvm.accumulation-function", reasoning: "An investment that never loses value has $a(t)$ non-decreasing for all $t \\ge 0$." },
      { concept: "tvm.force-of-interest", reasoning: "Any form — linear, exponential in $t$ or $t^2$, or written with $d$ or $\\delta$ — qualifies if both conditions hold." },
    ];
    const common = {
      steps,
      conditions: ["$a(t)$ is defined for every $t \\ge 0$.", "The investment never loses value."],
      relationship: "$a(0) = 1$ and $a(t)$ non-decreasing",
      counterexample: "An amount function $A(t) = k\\,a(t)$ has the right shape but starts at $k$, not 1.",
      transfer: {
        principle: "Test the defining properties, not the algebraic form.",
        unusual: "Options are functions, judged against conditions.",
        misread: "A function can start at 1 and still decrease later.",
      },
      itemFormat: "classification" as const,
      presentation: level === 2 ? (["hidden-structure"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2 },
    };
    if (variant === 0) {
      const pool = level === 1 ? (["simple", "compound", "force"] as const) : (["disc", "quad", "gauss"] as const);
      const key = rng.choice(pool);
      const right = valid[key];
      const bad = (k: keyof typeof invalid) => ({ ...invalid[k], check: { ...failure[k](invalid[k]), op: failure[k](invalid[k]).op === "!=" ? ("=" as const) : (">=" as const) } });
      const amount = bad("amount");
      const second = level === 1 ? bad("linearDown") : bad("dip");
      const hump = bad("hump");
      const decay = bad("decay");
      const shifted = bad("shifted");
      return conceptQuestion({
        ...common,
        stem: "Which of the following functions could be the accumulation function $a(t)$, $t \\ge 0$, of an investment whose value never decreases?",
        correct: { content: math(right.latex), why: "It starts at $a(0) = 1$ and is increasing for every $t \\ge 0$.", check: { expr: at(right, 0), op: "=", than: 1 } },
        distractors: [
          { content: math(amount.latex), misconception: "CONC_TVM_AMOUNT_FOR_ACCUM", why: `$a(0) = ${k0}$: this could be an amount function, not an accumulation function.`, check: { expr: amount.check.expr, op: "=", than: 1 }, stage: 0, failure: "recognition", conditionTrue: `It would be valid divided by ${k0}.` },
          level === 1
            ? { content: math(second.latex), misconception: "ALG_INVERTED_RATIO", why: "It decreases: it is a simple-discount function, the reciprocal of an accumulation function.", check: { expr: second.check.expr, op: ">=", than: 1 }, stage: 1, failure: "interpretation", conditionTrue: "Its reciprocal $1/(1 - dt)$ is a valid accumulation function for $t < 1/d$." }
            : { content: math(second.latex), misconception: "TRANS_IGNORED_CONDITION", why: `$a(0) = 1$ but $a(0.5) = ${mnum(Math.pow(1 + i, 0.5) - 0.5 * i, 5)} < 1$: the value dips before recovering.`, check: { expr: second.check.expr, op: ">=", than: 1 }, stage: 1, failure: "application" },
          { content: math(hump.latex), misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: `$a(0) = 1$, but the function decreases after $t = ${mnum(bq / (2 * cq), 1)}$ and falls below 1 by $t = ${Tq}$.`, check: { expr: hump.check.expr, op: ">=", than: 1 }, stage: 1, failure: "application" },
          { content: math(decay.latex), misconception: "CONC_MOVED_WRONG_WAY", why: "It decreases: it is a discount function $v(t)$, not an accumulation function.", check: { expr: decay.check.expr, op: ">=", than: 1 }, stage: 1, failure: "interpretation", conditionTrue: "Its reciprocal is a valid accumulation function." },
          { content: math(shifted.latex), misconception: "TIMING_EXTRA_PERIOD", why: `$a(0) = ${factor(i)}$: one period of interest too many.`, check: { expr: shifted.check.expr, op: "=", than: 1 }, stage: 0, failure: "recognition" },
        ],
        params: { i, d, del, alpha, variant },
      });
    }
    const badKey = level === 1 ? rng.choice(["amount", "shifted"] as const) : rng.choice(["hump", "dip"] as const);
    const wrong = invalid[badKey];
    const claim = failure[badKey];
    const reason: Record<string, string> = {
      amount: `$a(0) = ${k0} \\ne 1$.`,
      shifted: `$a(0) = ${factor(i)} \\ne 1$.`,
      hump: `It starts at 1 but decreases after $t = ${mnum(bq / (2 * cq), 1)}$ and is below 1 at $t = ${Tq}$.`,
      dip: `It starts at 1 but $a(0.5) < 1$: the value dips before recovering at $t = 1$.`,
    };
    const okOpt = (f: Candidate) => claim(f);
    return conceptQuestion({
      ...common,
      stem: "Each of the following is proposed as the accumulation function $a(t)$, $t \\ge 0$, of a fund that never loses value.\n\nWhich one cannot be the fund's accumulation function?",
      correct: { content: math(wrong.latex), why: reason[badKey], check: claim(wrong) },
      distractors: [
        { content: math(valid.simple.latex), misconception: "CONC_TVM_ONLY_EXPONENTIAL", why: "Simple interest is a valid accumulation function: $a(0) = 1$ and it increases.", check: okOpt(valid.simple), stage: 2, failure: "recognition" },
        { content: math(valid.force.latex), misconception: "RATE_FORCE_AS_EFFECTIVE", why: `A constant force gives $e^{\\delta t}$, the same as $(1+i)^t$ with $i = e^{\\delta} - 1$.`, check: okOpt(valid.force), stage: 2, failure: "recognition", confusedWith: "tvm.force-of-interest" },
        { content: math(valid.disc.latex), misconception: "RATE_DISCOUNT_AS_INTEREST", why: `Written with $d$, it is $(1+i)^t$ with $i = d/(1-d)$: valid.`, check: okOpt(valid.disc), stage: 2, failure: "recognition", confusedWith: "tvm.discount-vs-interest" },
        { content: math(valid.quad.latex), misconception: "MODEL_CONSTANT_FORCE", why: "The rate of growth varies with $t$, but $a(0) = 1$ and $a$ increases: valid.", check: okOpt(valid.quad), stage: 2, failure: "recognition" },
      ],
      params: { i, d, del, alpha, variant },
    });
  },
});

const amountDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-amount-diagnosis",
  family: "con-tvm-amount",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.accumulation_discount",
  secondary: ["TVM.discount_rates"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "interpretation"],
  soaConcept: "Diagnosing the error in a proposed period rate computed from an amount function.",
  variants: 2,
  generate(rng, level, variant) {
    const q = quadraticAmount(rng);
    const A = q.A;
    const n = rng.int(3, 8);
    const t1 = rng.int(1, 3);
    const t2 = t1 + rng.int(3, 4);
    type Opt = { content: string; misconception?: never; why: string; check: { expr: string; op: "="; than: string } };
    let target: string;
    let proposedLatex: string;
    let proposed: number;
    let truth: string;
    let correct: Opt;
    let distractors: Array<Omit<Opt, "misconception"> & { misconception: "RATE_DISCOUNT_AS_INTEREST" | "MODEL_INTEREST_ON_ORIGINAL" | "CONC_TVM_WRONG_INTERVAL" | "RATE_FORCE_AS_EFFECTIVE" | "CONC_TVM_AVERAGE_RATE" | "ALG_INVERTED_RATIO" | "SEQ_GEOMETRIC_AS_ARITHMETIC"; stage: number; failure: "selection" | "application" | "interpretation" | "connection" | "recognition" | "conclusion"; conditionTrue?: string }>;
    const eq = (expr: string) => ({ expr, op: "=" as const, than: "" });
    const v = q.val;
    if (level === 2 && variant === 0) {
      target = `the effective rate of interest during year ${n}`;
      proposed = (v(n) - v(n - 1)) / v(n);
      proposedLatex = `\\frac{A(${n}) - A(${n - 1})}{A(${n})}`;
      truth = `${A(n)}/${A(n - 1)}-1`;
      correct = { content: `The year's interest was divided by the closing amount $A(${n})$; dividing by $A(${n - 1})$ gives the required rate.`, why: `$i_{${n}} = ${p2((v(n) - v(n - 1)) / v(n - 1))}$.`, check: eq(`(${A(n)}-${A(n - 1)})/${A(n - 1)}`) };
      distractors = [
        { content: "The calculation is correct: a year's interest divided by the closing amount is its rate of interest.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That ratio is the effective rate of discount for the year.", check: eq(`(${A(n)}-${A(n - 1)})/${A(n)}`), stage: 1, failure: "selection", conditionTrue: "It is correct if the rate of discount is asked for." },
        { content: "The year's interest should be divided by $A(0)$, the amount originally invested.", misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `During year ${n} the amount invested is $A(${n - 1})$.`, check: eq(`(${A(n)}-${A(n - 1)})/${A(0)}`), stage: 1, failure: "application" },
        { content: `The rate should be $A(${n})/A(0) - 1$; only the growth since time 0 matters.`, misconception: "CONC_TVM_WRONG_INTERVAL", why: `That is the rate for years 1 to ${n} combined.`, check: eq(`${A(n)}/${A(0)}-1`), stage: 2, failure: "interpretation" },
        { content: `The rate should be the force of interest $A'(${n})/A(${n})$.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force is instantaneous; the effective rate covers the whole year.", check: eq(`${q.dA(n)}/${A(n)}`), stage: 1, failure: "selection" },
        { content: `The rate should be $[A(${n})/A(0)]^{1/${n}} - 1$, the level rate over the ${n} years.`, misconception: "CONC_TVM_AVERAGE_RATE", why: "A level average differs from year " + n + "'s own rate when growth is not geometric.", check: eq(`(${A(n)}/${A(0)})**(1/${n})-1`), stage: 2, failure: "connection" },
      ];
    } else if (level === 2) {
      target = `the effective rate of discount for year ${n}`;
      proposed = (v(n) - v(n - 1)) / v(n - 1);
      proposedLatex = `\\frac{A(${n}) - A(${n - 1})}{A(${n - 1})}`;
      truth = `1-${A(n - 1)}/${A(n)}`;
      correct = { content: `The year's interest was divided by the opening amount $A(${n - 1})$; dividing by $A(${n})$ gives the required rate.`, why: `$d_{${n}} = ${p2((v(n) - v(n - 1)) / v(n))}$.`, check: eq(`(${A(n)}-${A(n - 1)})/${A(n)}`) };
      distractors = [
        { content: "The calculation is correct: a year's interest divided by the opening amount is its rate of discount.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That ratio is the effective rate of interest for the year.", check: eq(`(${A(n)}-${A(n - 1)})/${A(n - 1)}`), stage: 1, failure: "selection", conditionTrue: "Correct if the rate of interest were asked for." },
        { content: "The year's interest should be divided by $A(0)$, the amount originally invested.", misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The original amount is not the base of any rate for year " + n + ".", check: eq(`(${A(n)}-${A(n - 1)})/${A(0)}`), stage: 1, failure: "application" },
        { content: `The rate should be $1 - A(0)/A(${n})$, measured from time 0.`, misconception: "CONC_TVM_WRONG_INTERVAL", why: `That is the discount rate for years 1 to ${n} combined.`, check: eq(`1-${A(0)}/${A(n)}`), stage: 2, failure: "interpretation" },
        { content: `The candidate's value should be converted with $d = i/(1 - i)$.`, misconception: "ALG_INVERTED_RATIO", why: "The conversion is $d = i/(1+i)$; $i/(1-i)$ moves the wrong way.", check: eq(`(${lit(proposed)})/(1-${lit(proposed)})`), stage: 1, failure: "application" },
        { content: `The rate should be the force of interest $A'(${n})/A(${n})$.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force is instantaneous, not a rate for the year.", check: eq(`${q.dA(n)}/${A(n)}`), stage: 1, failure: "selection" },
      ];
    } else if (variant === 0) {
      target = `the effective rate of discount for year ${n}`;
      const avg = Math.pow(v(n) / v(0), 1 / n) - 1;
      proposed = avg / (1 + avg);
      proposedLatex = `i = \\left(\\frac{A(${n})}{A(0)}\\right)^{1/${n}} - 1, \\qquad d = \\frac{i}{1+i}`;
      truth = `1-${A(n - 1)}/${A(n)}`;
      const avgE = `((${A(n)}/${A(0)})**(1/${n})-1)`;
      correct = { content: `The value of $i$ averages over ${n} years; with $i = A(${n})/A(${n - 1}) - 1$, the step $d = i/(1+i)$ is right.`, why: `Year ${n}'s own rate gives $d_{${n}} = ${p2((v(n) - v(n - 1)) / v(n))}$.`, check: eq(`(${A(n)}/${A(n - 1)}-1)/(${A(n)}/${A(n - 1)})`) };
      distractors = [
        { content: "The calculation is correct: the level rate over the first " + n + " years is year " + n + "'s rate.", misconception: "CONC_TVM_AVERAGE_RATE", why: "The amount function is not geometric, so each year has its own rate.", check: eq(`${avgE}/(1+${avgE})`), stage: 0, failure: "interpretation", conditionTrue: "It would be correct if $A(t)$ grew at a constant compound rate." },
        { content: "The value of $i$ is right, but the conversion should be $d = i/(1 - i)$.", misconception: "ALG_INVERTED_RATIO", why: "$d = i/(1+i)$ is the correct conversion.", check: eq(`${avgE}/(1-${avgE})`), stage: 2, failure: "application" },
        { content: `The answer should be $1 - A(0)/A(${n})$, the discount over the whole period.`, misconception: "CONC_TVM_WRONG_INTERVAL", why: `That covers years 1 to ${n} together.`, check: eq(`1-${A(0)}/${A(n)}`), stage: 0, failure: "interpretation" },
        { content: `The answer should be the force of interest $A'(${n})/A(${n})$.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force is instantaneous, not a discount rate for a year.", check: eq(`${q.dA(n)}/${A(n)}`), stage: 1, failure: "selection" },
        { content: `The answer should be $[A(${n}) - A(${n - 1})]/A(0)$.`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The base of a discount rate is the closing amount, not the original amount.", check: eq(`(${A(n)}-${A(n - 1)})/${A(0)}`), stage: 1, failure: "application" },
      ];
    } else {
      target = `the effective rate of interest for the period from time ${t1} to time ${t2}`;
      let sum = 0;
      const terms: string[] = [];
      for (let k = t1 + 1; k <= t2; k += 1) {
        sum += v(k) / v(k - 1) - 1;
        terms.push(`(${A(k)}/${A(k - 1)}-1)`);
      }
      proposed = sum;
      proposedLatex = `\\sum_{k=${t1 + 1}}^{${t2}} \\frac{A(k) - A(k-1)}{A(k-1)}`;
      truth = `${A(t2)}/${A(t1)}-1`;
      const sumE = `(${terms.join("+")})`;
      correct = { content: `Yearly rates compound, so they cannot be added; the rate for the period is $A(${t2})/A(${t1}) - 1$.`, why: `The correct value is $${p2(v(t2) / v(t1) - 1)}$.`, check: eq(`(${A(t2)}-${A(t1)})/${A(t1)}`) };
      distractors = [
        { content: "The calculation is correct: the rate for a period is the sum of the yearly rates within it.", misconception: "SEQ_GEOMETRIC_AS_ARITHMETIC", why: "Each year's interest is earned on the previous year's interest too; factors multiply.", check: eq(sumE), stage: 2, failure: "connection", conditionTrue: "Adding rates is exact only under simple interest on a fixed base." },
        { content: `The total interest should be divided by $A(${t2})$, the amount at the end.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That gives the rate of discount for the period.", check: eq(`(${A(t2)}-${A(t1)})/${A(t2)}`), stage: 1, failure: "selection" },
        { content: `The total interest should be divided by $A(0)$.`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `The amount invested at the start of the period is $A(${t1})$.`, check: eq(`(${A(t2)}-${A(t1)})/${A(0)}`), stage: 1, failure: "application" },
        { content: "The yearly rates should be averaged rather than added.", misconception: "CONC_TVM_AVERAGE_RATE", why: "An average of yearly rates is neither the period rate nor its annual equivalent.", check: eq(`${sumE}/${t2 - t1}`), stage: 2, failure: "connection" },
        { content: `The rate should be $A(${t2})/A(0) - 1$.`, misconception: "CONC_TVM_WRONG_INTERVAL", why: `That measures from time 0, not from time ${t1}.`, check: eq(`${A(t2)}/${A(0)}-1`), stage: 0, failure: "interpretation" },
      ];
    }
    const L3 = level === 3;
    correct.check.than = truth;
    for (const d of distractors) d.check.than = truth;
    return conceptQuestion({
      stem: `An investment's amount function is $${q.latex}$, $t \\ge 0$. A candidate calculates ${target} as\n\n$$${proposedLatex} = ${mnum(proposed * 100, 2)}\\%.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
      correct,
      distractors,
      reference: { description: `The required rate is computed directly from $A(t)$; each option's proposed fix is evaluated and compared with it.` },
      steps: [
        { concept: "tvm.amount-function", reasoning: "Identify the interval the rate refers to and the interest earned over it." },
        { concept: "tvm.discount-vs-interest", reasoning: "Rate of interest: divide by the amount at the start of the interval; rate of discount: by the amount at the end." },
        { concept: "tvm.accumulation-function", reasoning: "Across several years, accumulation factors multiply; rates are neither added nor averaged." },
        ...(L3 ? [{ concept: "tvm.simple-vs-compound", reasoning: "The amount function is not geometric, so one year's rate cannot be inferred from an average over several years." }] : []),
      ],
      conditions: ["Single investment with amount function $A(t)$; no deposits or withdrawals.", "Year $n$ runs from time $n - 1$ to time $n$."],
      relationship: "$i_{[s,t]} = \\dfrac{A(t)}{A(s)} - 1,\\qquad d_{[s,t]} = 1 - \\dfrac{A(s)}{A(t)}$",
      counterexample: "If $A(t)$ were $k(1+i)^t$, every yearly rate would equal the average rate.",
      transfer: {
        principle: "Name the interval, then use the amount at its start (interest) or its end (discount).",
        unusual: "You judge a worked calculation instead of producing one.",
        misread: "An average rate looks like a yearly rate but describes a different interval.",
      },
      itemFormat: "error-diagnosis",
      presentation: L3 ? ["hidden-structure", "indirect-wording"] : ["indirect-wording"],
      features: { unfamiliar: true, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { K: q.K, b: q.b, c: q.c, n, t1, t2, variant },
    });
  },
});

// ================================================================ present, current and future values

/** Explicit sum of flows valued at time `T` at a single rate. */
const valueAt = (flows: { t: number; amount: number }[], i: number, T: number): string =>
  `(${flows.map((f) => `${lit(f.amount)}*${g(i)}**(${T - f.t})`).join("+")})`;

const valueInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-value-interpretation",
  family: "con-tvm-value",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.present_future_value",
  secondary: ["TVM.equation_of_value"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  soaConcept: "Identifying the date and meaning of a computed value: present, current or accumulated value, or a fund balance.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const f = factor(i);
    const steps = [
      { concept: "tvm.present-value", reasoning: "Each term is a payment multiplied by $(1+i)^{T - s}$; read $T - s$ from every exponent." },
      { concept: "tvm.equation-of-value", reasoning: "Terms valued at one common date $T$ can be added; that date is the one the expression describes." },
      { concept: "tvm.present-value", reasoning: "Check which payments are included and in which direction each is moved." },
    ];
    const transfer = {
      principle: "An expression's valuation date is the date every exponent is measured from: payment at $s$, factor $(1+i)^{T-s}$.",
      unusual: "The number is given; its meaning must be identified.",
      misread: "A current value includes past payments (accumulated) as well as future ones (discounted).",
    };
    if (variant === 0) {
      const a = rng.int(2, 5);
      const b = a + rng.int(2, 5);
      const T = level === 1 ? a : rng.int(1, a - 1);
      const P = [gridAmount(rng, 200, 2000, 100), gridAmount(rng, 200, 2000, 100), gridAmount(rng, 200, 2000, 100)];
      const flows = [{ t: 0, amount: P[0] }, { t: a, amount: P[1] }, { t: b, amount: P[2] }];
      const E = valueAt(flows, i, T);
      const pv0 = `(${lit(P[0])}+${lit(P[1])}*${g(i)}**(-${a})+${lit(P[2])}*${g(i)}**(-${b}))`;
      const term = (amount: number, s: number) => (T === s ? mamt(amount) : T > s ? `${mamt(amount)}(${f})^{${T - s}}` : `${mamt(amount)}v^{${s - T}}`);
      const expression = `${term(P[0], 0)} + ${term(P[1], a)} + ${term(P[2], b)}`;
      const future = flows.filter((x) => x.t >= T);
      return conceptQuestion({
        stem: `Payments of ${mamt(P[0])}, ${mamt(P[1])} and ${mamt(P[2])} are made at times 0, ${a} and ${b}. The annual effective interest rate is ${pc(i)}, and $v = 1/${f}$. A candidate evaluates\n\n$$${expression}.$$\n\nWhich of the following does this expression represent?`,
        correct: { content: `The value at time ${T} of all three payments`, why: `Every exponent equals ${T} minus the payment date.`, check: { expr: `${pv0}*${g(i)}**${T}`, op: "=", than: E } },
        distractors: [
          { content: "The present value at time 0 of all three payments", misconception: "TIMING_VALUATION_DATE", why: `The payment at time 0 is accumulated ${T} years, so the expression is not valued at time 0.`, check: { expr: pv0, op: "=", than: E }, stage: 1, failure: "interpretation" },
          { content: `The accumulated value at time ${b} of all three payments`, misconception: "CONC_RELATED_TERM", why: `At time ${b} the last payment would appear without a discount factor.`, check: { expr: `${pv0}*${g(i)}**${b}`, op: "=", than: E }, stage: 1, failure: "interpretation", confusedWith: "tvm.equation-of-value" },
          { content: `The value at time ${T} of the payments due at or after time ${T}`, misconception: "CONC_TVM_PAST_PAYMENT_EXCLUDED", why: "The payment made at time 0 is included, accumulated to time " + T + ".", check: { expr: valueAt(future, i, T), op: "=", than: E }, stage: 2, failure: "application" },
          { content: "The total of the three payments, which is the same at every date", misconception: "SEQ_UNDISCOUNTED_SUM", why: "The payments are moved with interest, so the expression differs from their sum.", check: { expr: `${lit(P[0] + P[1] + P[2])}`, op: "=", than: E }, stage: 0, failure: "recognition" },
          { content: `The value at time ${T + 1} of all three payments`, misconception: "TIMING_EXTRA_PERIOD", why: `The payment at time 0 carries exponent ${T}, not ${T + 1}.`, check: { expr: `${pv0}*${g(i)}**${T + 1}`, op: "=", than: E }, stage: 0, failure: "application" },
        ],
        steps,
        conditions: ["Compound interest at a constant annual effective rate."],
        relationship: "Value at $T$ of all payments $= \\sum_s CF_s(1+i)^{T-s}$",
        counterexample: "The same payments have a different value at each date, but all those values are equivalent.",
        transfer,
        itemFormat: "interpretation",
        presentation: level === 2 ? ["valuation-date", "indirect-wording"] : ["valuation-date"],
        features: { multipleValuationDates: true, unfamiliar: level === 2 },
        params: { i, a, b, T, variant },
      });
    }
    const X = gridAmount(rng, 2000, 9000, 500);
    const n = rng.int(6, 12);
    const ws = level === 1 ? [{ t: rng.int(2, n - 2), amount: gridAmount(rng, 200, 1500, 100) }] : (() => {
      const k1 = rng.int(1, n - 4);
      const k2 = k1 + rng.int(1, 3);
      return [{ t: k1, amount: gridAmount(rng, 200, 1200, 100) }, { t: k2, amount: gridAmount(rng, 200, 1200, 100) }];
    })();
    const last = ws[ws.length - 1].t;
    const Q = `(${lit(X)}*${g(i)}**${n}${ws.map((w) => `-${lit(w.amount)}*${g(i)}**${n - w.t}`).join("")})`;
    const shown = `${mamt(X)}(${f})^{${n}}${ws.map((w) => ` - ${mamt(w.amount)}(${f})^{${n - w.t}}`).join("")}`;
    const withdrawals = ws.length === 1 ? `a withdrawal of ${mamt(ws[0].amount)} is made at time ${ws[0].t}` : `withdrawals of ${mamt(ws[0].amount)} and ${mamt(ws[1].amount)} are made at times ${ws[0].t} and ${ws[1].t}`;
    const atLast = `(${lit(X)}*${g(i)}**${last}${ws.map((w) => `-${lit(w.amount)}*${g(i)}**${last - w.t}`).join("")})`;
    const word = ws.length === 1 ? "withdrawal" : "withdrawals";
    return conceptQuestion({
      stem: `A fund receives a deposit of ${mamt(X)} at time 0, and ${withdrawals}. The fund earns an annual effective rate of ${pc(i)}. A candidate calculates\n\n$$Q = ${shown}.$$\n\nWhich of the following does $Q$ represent?`,
      correct: { content: `The fund balance at time ${n}, after the ${word}`, why: `Each amount is carried to time ${n} with interest; withdrawals reduce the balance and stop earning interest when made.`, check: { expr: `(${atLast})*${g(i)}**${n - last}`, op: "=", than: Q } },
      distractors: [
        { content: `The fund balance at time ${n} had no ${word} been made`, misconception: "TRANS_IGNORED_CONDITION", why: `$Q$ deducts the accumulated ${word}.`, check: { expr: `${lit(X)}*${g(i)}**${n}`, op: "=", than: Q }, stage: 2, failure: "application" },
        { content: `The present value at time 0 of the fund balance at time ${n}`, misconception: "TIMING_VALUATION_DATE", why: `Every term is accumulated to time ${n}; nothing is discounted back to 0.`, check: { expr: `${Q}*${g(i)}**(-${n})`, op: "=", than: Q }, stage: 1, failure: "interpretation" },
        { content: `The fund balance at time ${last}, just after the ${ws.length === 1 ? "withdrawal" : "second withdrawal"}`, misconception: "TIMING_BALANCE_INDEX", why: `The balance at time ${last} is carried a further ${n - last} years in $Q$.`, check: { expr: atLast, op: "=", than: Q }, stage: 1, failure: "interpretation" },
        { content: `The interest earned by the fund from time 0 to time ${n}`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: `$Q$ is the whole balance; the interest is $Q$ minus the net amount deposited.`, check: { expr: `${Q}-${lit(X - ws.reduce((s, w) => s + w.amount, 0))}`, op: "=", than: Q }, stage: 2, failure: "interpretation" },
      ],
      steps,
      conditions: ["The fund credits one annual effective rate on its whole balance.", "No deposits or withdrawals other than those stated."],
      relationship: "Balance at $n$ $= \\sum (\\text{deposits})(1+i)^{n-s} - \\sum (\\text{withdrawals})(1+i)^{n-s}$",
      counterexample: "Valued retrospectively or step by step, the balance at time " + n + " is the same number.",
      transfer,
      itemFormat: "interpretation",
      presentation: level === 2 ? ["valuation-date", "indirect-wording"] : ["valuation-date"],
      features: { multipleValuationDates: true, unfamiliar: level === 2 },
      params: { i, X, n, variant },
    });
  },
});

const valueTimeline: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-value-timeline",
  family: "con-tvm-value",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.present_future_value",
  secondary: ["TVM.equation_of_value", "TVM.accumulation_discount"],
  itemFormat: "timeline-reading",
  conceptFamily: "timeline",
  dimensions: ["timing", "equation_construction"],
  soaConcept: "Reading a table of cash flows and writing their value, or a fund balance, at an intermediate date.",
  variants: 2,
  generate(rng, level, variant) {
    const L3 = level === 3;
    const i1 = gridRate(rng, 0.03, 0.07, 0.005);
    const i2 = L3 ? drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (x) => Math.abs(x - i1) >= 0.015) : i1;
    const f1 = factor(i1);
    const f2 = factor(i2);
    /** Accumulation factor from time s to time T (s ≤ T or s > T), with the rate changing at time k. */
    const k = rng.int(3, 4);
    const accE = (s: number, T: number): string => {
      if (!L3) return `${g(i1)}**(${T - s})`;
      const lo = Math.min(s, T);
      const hi = Math.max(s, T);
      const y1 = Math.max(0, Math.min(hi, k) - lo);
      const y2 = Math.max(0, hi - Math.max(lo, k));
      const e = `${g(i1)}**${y1}*${g(i2)}**${y2}`;
      return s <= T ? `(${e})` : `(${e})**(-1)`;
    };
    const accL = (s: number, T: number, ra: string, rb: string): string => {
      if (s === T) return "";
      if (!L3) return T > s ? `(${ra})^{${T - s}}` : `(${ra})^{-${s - T}}`;
      const lo = Math.min(s, T);
      const hi = Math.max(s, T);
      const y1 = Math.max(0, Math.min(hi, k) - lo);
      const y2 = Math.max(0, hi - Math.max(lo, k));
      const sign = T > s ? "" : "-";
      return `${y1 ? `(${ra})^{${sign}${y1}}` : ""}${y2 ? `(${rb})^{${sign}${y2}}` : ""}`;
    };
    const rateText = L3 ? `The fund earns an annual effective rate of ${pc(i1)} up to time ${k} and ${pc(i2)} thereafter.` : `The annual effective interest rate is ${pc(i1)}.`;
    if (variant === 0) {
      const t1 = rng.int(1, 2);
      const T = k + rng.int(1, 2);
      const t2 = T + rng.int(2, 4);
      const [A, B, C] = [gridAmount(rng, 500, 3000, 100), gridAmount(rng, 500, 3000, 100), gridAmount(rng, 500, 3000, 100)];
      const flows = [{ t: 0, amount: A }, { t: t1, amount: B }, { t: t2, amount: C }];
      const term = (x: number, s: number, ra = f1, rb = f2) => `${mamt(x)}${accL(s, T, ra, rb)}`;
      const sum = (ra = f1, rb = f2, shift = 0) => flows.map((x) => `${mamt(x.amount)}${accL(x.t, T + shift, ra, rb)}`).join(" + ");
      const ev = (fn: (s: number) => string) => `(${flows.map((x) => `${lit(x.amount)}*${fn(x.t)}`).join("+")})`;
      const truth = ev((s) => accE(s, T));
      const ask = level === 2 ? `the single payment at time ${T} that is equivalent to the three cash flows` : `the value at time ${T} of the three cash flows`;
      const distractors = L3
        ? [
            { content: math(flows.map((x) => `${mamt(x.amount)}(${f2})^{${T - x.t}}`).join(" + ")), misconception: "CONC_TVM_RATE_CHANGE_RETRO" as const, why: `${pc(i2)} applies only after time ${k}.`, probe: ev((s) => `${g(i2)}**(${T - s})`), stage: 2, failure: "application" as const },
            { content: math(sum(f2, f1)), misconception: "ALLOC_SWAPPED" as const, why: "The two rates are applied to each other's intervals.", probe: ev((s) => { const lo = Math.min(s, T), hi = Math.max(s, T); const y1 = Math.max(0, Math.min(hi, k) - lo), y2 = Math.max(0, hi - Math.max(lo, k)); const e = `${g(i2)}**${y1}*${g(i1)}**${y2}`; return s <= T ? `(${e})` : `(${e})**(-1)`; }), stage: 2, failure: "application" as const },
            { content: math(flows.map((x) => `${mamt(x.amount)}(${lit(1 + (i1 + i2) / 2)})^{${T - x.t}}`).join(" + ")), misconception: "CONC_TVM_AVERAGE_RATE" as const, why: "Averaging the two rates does not reproduce the product of the factors over the actual intervals.", probe: ev((s) => `(1+${lit((i1 + i2) / 2)})**(${T - s})`), stage: 2, failure: "connection" as const },
            { content: math(`${term(A, 0)} + ${term(B, t1)} + ${mamt(C)}(${f2})^{${t2 - T}}`), misconception: "CONC_MOVED_WRONG_WAY" as const, why: `The payment at time ${t2} comes after time ${T}, so it is discounted, not accumulated.`, probe: `(${lit(A)}*${accE(0, T)}+${lit(B)}*${accE(t1, T)}+${lit(C)}*${g(i2)}**${t2 - T})`, stage: 1, failure: "application" as const },
            { content: math(`${mamt(A)} + ${mamt(B)}(${f1})^{-${t1}} + ${mamt(C)}(${f1})^{-${k}}(${f2})^{-${t2 - k}}`), misconception: "TIMING_VALUATION_DATE" as const, why: `That is the value at time 0, not at time ${T}.`, probe: ev((s) => accE(s, 0)), stage: 0, failure: "interpretation" as const },
          ]
        : [
            { content: math(`${mamt(A)} + ${mamt(B)}(${f1})^{-${t1}} + ${mamt(C)}(${f1})^{-${t2}}`), misconception: "TIMING_VALUATION_DATE" as const, why: `That is the value at time 0, not at time ${T}.`, probe: ev((s) => `${g(i1)}**(-${s})`), stage: 0, failure: "interpretation" as const },
            { content: math(`${term(A, 0)} + ${term(B, t1)} + ${mamt(C)}(${f1})^{${t2 - T}}`), misconception: "CONC_MOVED_WRONG_WAY" as const, why: `The payment at time ${t2} is after time ${T}, so it is discounted.`, probe: `(${lit(A)}*${g(i1)}**${T}+${lit(B)}*${g(i1)}**${T - t1}+${lit(C)}*${g(i1)}**${t2 - T})`, stage: 1, failure: "application" as const },
            { content: math(`${term(A, 0)} + ${term(B, t1)}`), misconception: "TRANS_IGNORED_CONDITION" as const, why: `The cash flow at time ${t2} also has a value at time ${T}.`, probe: `(${lit(A)}*${g(i1)}**${T}+${lit(B)}*${g(i1)}**${T - t1})`, stage: 2, failure: "application" as const },
            { content: math(sum(f1, f2, 1)), misconception: "TIMING_EXTRA_PERIOD" as const, why: `Each exponent is one year too far: that is the value at time ${T + 1}.`, probe: ev((s) => `${g(i1)}**(${T + 1 - s})`), stage: 1, failure: "application" as const },
            { content: math(`${mamt(A)} + ${mamt(B)} + ${mamt(C)}`), misconception: "SEQ_UNDISCOUNTED_SUM" as const, why: "Amounts at different dates cannot be added without moving them to one date.", probe: `${lit(A + B + C)}`, stage: 0, failure: "recognition" as const },
          ];
      return conceptQuestion({
        stem: `The table shows cash flows into an account. ${rateText}\n\nDetermine which of the following expressions gives ${ask}.`,
        exhibits: [{ type: "table", columns: ["Time (years)", "Cash flow"], rows: flows.map((x) => [String(x.t), mamt(x.amount)]) }],
        correct: { content: math(sum()), why: `Payments before time ${T} are accumulated to it; the payment at time ${t2} is discounted back ${t2 - T} years${L3 ? `, each at the rate in force over each interval` : ""}.`, probe: truth },
        distractors,
        reference: { values: [{ label: `value at ${T}`, expr: L3 ? `(${lit(A)}*${g(i1)}**${k}*${g(i2)}**${T - k}+${lit(B)}*${g(i1)}**${k - t1}*${g(i2)}**${T - k}+${lit(C)}*${g(i2)}**(${T - t2}))` : `${valueAt(flows, i1, 0)}*${g(i1)}**${T}` }], description: `The cash flows valued at time ${T}${L3 ? ", with each rate used only over its own interval" : " (present value at 0 accumulated to " + T + ")"}.` },
        steps: [
          { concept: "tvm.present-value", reasoning: `Fix the valuation date at time ${T}${level === 2 ? ": an equivalent single payment there equals the value of the flows at that date" : ""}.` },
          { concept: "tvm.present-value", reasoning: `Accumulate the flows at times 0 and ${t1}; discount the flow at time ${t2}.` },
          { concept: L3 ? "tvm.changing-rates" : "tvm.equation-of-value", reasoning: L3 ? `Split every movement at time ${k}: ${pc(i1)} before, ${pc(i2)} after.` : "Add the three values, all now at the same date." },
          ...(L3 ? [{ concept: "tvm.equation-of-value", reasoning: "Add the three values, all at the same date." }] : []),
        ],
        conditions: ["Compound interest.", L3 ? `The rate changes at time ${k} for all money in the account.` : "One annual effective rate throughout."],
        relationship: L3 ? "Factor from $s$ to $T$ = product of the yearly factors in force over $[s, T]$" : "Value at $T$ $= \\sum CF_s (1+i)^{T-s}$",
        counterexample: `Valued at time 0 the expression looks different but is equivalent: multiply it by the factor from 0 to ${T}.`,
        transfer: {
          principle: "Read each flow's date from the table and move it to the valuation date — forward with interest, backward with discount.",
          unusual: level === 2 ? "The value is described as an equivalent single payment." : "The valuation date lies between payments.",
          misread: "A flow after the valuation date is discounted, not accumulated.",
        },
        itemFormat: "timeline-reading",
        presentation: L3 ? ["valuation-date", "hidden-structure"] : level === 2 ? ["valuation-date", "indirect-wording"] : ["valuation-date"],
        features: { multipleValuationDates: true, unfamiliar: level >= 2, multiConcept: L3 },
        modelingDecisions: L3 ? 1 : undefined,
        params: { i1, i2, T, t1, t2, variant },
      });
    }
    const t1 = rng.int(1, 2);
    const t2 = Math.max(k + 1, t1 + 2) + rng.int(0, 2);
    const t3 = t2 + rng.int(1, 3);
    const [D1, D2, W, D3] = [gridAmount(rng, 1000, 4000, 100), gridAmount(rng, 500, 3000, 100), gridAmount(rng, 300, 1500, 100), gridAmount(rng, 500, 3000, 100)];
    const later = level >= 2;
    const rows = [["0", `Deposit ${mamt(D1)}`], [String(t1), `Deposit ${mamt(D2)}`], [String(t2), `Withdrawal ${mamt(W)}`], ...(later ? [[String(t3), `Deposit ${mamt(D3)}`]] : [])];
    const a = (s: number) => accL(s, t2, f1, f2);
    const truth = `(${lit(D1)}*${accE(0, t2)}+${lit(D2)}*${accE(t1, t2)}-${lit(W)})`;
    const base = `${mamt(D1)}${a(0)} + ${mamt(D2)}${a(t1)}`;
    const distractors = [
      { content: math(`${base} + ${mamt(W)}`), misconception: "ALG_SIGN_ERROR" as const, why: "A withdrawal reduces the balance.", probe: `(${lit(D1)}*${accE(0, t2)}+${lit(D2)}*${accE(t1, t2)}+${lit(W)})`, stage: 1, failure: "application" as const },
      { content: math(`${mamt(D1)} + ${mamt(D2)} - ${mamt(W)}`), misconception: "SEQ_UNDISCOUNTED_SUM" as const, why: "The deposits earn interest until time " + t2 + ".", probe: `${lit(D1 + D2 - W)}`, stage: 0, failure: "recognition" as const },
      { content: math(`${mamt(D1)}${a(0)} + ${mamt(D2)} - ${mamt(W)}`), misconception: "TIMING_MISSING_PERIOD" as const, why: `The deposit at time ${t1} earns interest for ${t2 - t1} years before the withdrawal.`, probe: `(${lit(D1)}*${accE(0, t2)}+${lit(D2)}-${lit(W)})`, stage: 1, failure: "application" as const },
      ...(later ? [{ content: math(`${base} - ${mamt(W)} + ${mamt(D3)}${accL(t3, t2, f1, f2)}`), misconception: "TRANS_IRRELEVANT_INFO" as const, why: `The deposit at time ${t3} has not been made at time ${t2}; it is not part of the balance.`, probe: `(${truth}+${lit(D3)}*${accE(t3, t2)})`, stage: 2, failure: "interpretation" as const }] : []),
      ...(L3
        ? [
            { content: math(`${mamt(D1)}(${f2})^{${t2}} + ${mamt(D2)}(${f2})^{${t2 - t1}} - ${mamt(W)}`), misconception: "CONC_TVM_RATE_CHANGE_RETRO" as const, why: `${pc(i2)} applies only after time ${k}.`, probe: `(${lit(D1)}*${g(i2)}**${t2}+${lit(D2)}*${g(i2)}**${t2 - t1}-${lit(W)})`, stage: 2, failure: "application" as const },
            { content: math(`${mamt(D1)}${accL(0, t2, f2, f1)} + ${mamt(D2)}${accL(t1, t2, f2, f1)} - ${mamt(W)}`), misconception: "ALLOC_SWAPPED" as const, why: "The two rates are applied to each other's intervals.", probe: `(${lit(D1)}*${g(i2)}**${k}*${g(i1)}**${t2 - k}+${lit(D2)}*${g(i2)}**${k - t1}*${g(i1)}**${t2 - k}-${lit(W)})`, stage: 2, failure: "application" as const },
          ]
        : [{ content: math(`${mamt(D1)} + ${mamt(D2)}(${f1})^{-${t1}} - ${mamt(W)}(${f1})^{-${t2}}`), misconception: "TIMING_VALUATION_DATE" as const, why: `That is the present value at time 0 of the flows, not the balance at time ${t2}.`, probe: `(${lit(D1)}+${lit(D2)}*${g(i1)}**(-${t1})-${lit(W)}*${g(i1)}**(-${t2}))`, stage: 0, failure: "interpretation" as const }]),
    ];
    return conceptQuestion({
      stem: `The table shows the transactions in a fund. ${rateText}\n\nDetermine which of the following expressions gives the balance of the fund immediately after the withdrawal at time ${t2}.`,
      exhibits: [{ type: "table", columns: ["Time (years)", "Transaction"], rows }],
      correct: { content: math(`${base} - ${mamt(W)}`), why: `Both deposits are accumulated to time ${t2}${L3 ? " using each rate over its own interval" : ""}, then the withdrawal is deducted.`, probe: truth },
      distractors,
      reference: { values: [{ label: "balance", expr: L3 ? `((${lit(D1)}*${g(i1)}**${t1}+${lit(D2)})*${g(i1)}**${k - t1}*${g(i2)}**${t2 - k}-${lit(W)})` : `((${lit(D1)}*${g(i1)}**${t1}+${lit(D2)})*${g(i1)}**${t2 - t1}-${lit(W)})` }], description: "Balance rolled forward step by step: deposit, accumulate, deposit, accumulate, withdraw." },
      steps: [
        { concept: "tvm.present-value", reasoning: `The balance at time ${t2} includes only transactions up to and including time ${t2}.` },
        { concept: "tvm.present-value", reasoning: `Accumulate each deposit to time ${t2} and deduct the withdrawal.` },
        { concept: L3 ? "tvm.changing-rates" : "tvm.equation-of-value", reasoning: L3 ? `Use ${pc(i1)} up to time ${k} and ${pc(i2)} after, for every amount in the fund.` : "All terms are now at time " + t2 + " and can be combined." },
        ...(L3 ? [{ concept: "tvm.equation-of-value", reasoning: "Combine the values, all at time " + t2 + "." }] : []),
      ],
      conditions: ["Interest is credited on the whole balance.", later ? `The deposit at time ${t3} occurs after the date asked about.` : "No other transactions."],
      relationship: "Balance at $T$ $= \\sum_{s \\le T} (\\text{net flow at } s)\\times(\\text{factor from } s \\text{ to } T)$",
      counterexample: "The retrospective balance equals the prospective one only when future flows are included on the other side.",
      transfer: {
        principle: "A balance at a date is the accumulated value of every transaction up to that date.",
        unusual: later ? "The table contains a transaction after the date asked about." : "Deposits and a withdrawal are mixed in one table.",
        misread: "Later deposits do not belong in an earlier balance.",
      },
      itemFormat: "timeline-reading",
      presentation: L3 ? ["irrelevant-info", "valuation-date", "hidden-structure"] : later ? ["irrelevant-info", "valuation-date"] : ["valuation-date"],
      features: { multipleValuationDates: true, unfamiliar: later, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { i1, i2, t1, t2, variant },
    });
  },
});

const valueStatements: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-value-statements",
  family: "con-tvm-value",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.present_future_value",
  secondary: ["TVM.equation_of_value"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "timing"],
  soaConcept: "Comparing two single payments at different dates: preference, equivalence, and how both depend on the rate.",
  variants: 2,
  generate(rng, level, variant) {
    const L3 = level === 3;
    const X = gridAmount(rng, 1000, 5000, 250);
    const a = rng.int(1, 3);
    const b = a + rng.int(2, 6);
    const jTarget = gridRate(rng, 0.04, 0.09, 0.005);
    const Y = Math.round(X * Math.pow(1 + jTarget, b - a));
    const jStar = Math.pow(Y / X, 1 / (b - a)) - 1;
    const pvA = (r: number | string) => `${lit(X)}*(1+${typeof r === "number" ? lit(r) : r})**(-${a})`;
    const pvB = (r: number | string) => `${lit(Y)}*(1+${typeof r === "number" ? lit(r) : r})**(-${b})`;
    const intro = `Payment A is ${mamt(X)} at time ${a}. Payment B is ${mamt(Y)} at time ${b}.`;
    const steps = [
      { concept: "tvm.present-value", reasoning: "Compare the payments at one date by discounting (or accumulating) each with $(1+i)^{T-s}$." },
      { concept: "tvm.equation-of-value", reasoning: `At a fixed rate, moving both to another date multiplies both by the same factor, so the comparison does not depend on the date.` },
      { concept: "tvm.equation-of-value", reasoning: "Raising the rate shrinks the later payment's present value more; the two are equal at exactly one rate." },
    ];
    const transfer = {
      principle: "Rank payments at one date and one rate; the ranking is the same at every date but can change with the rate.",
      unusual: "Each statement tests a different consequence of the same comparison.",
      misread: "A larger payment is not worth more if it comes later at a high enough rate.",
    };
    const common = {
      steps,
      conditions: ["Compound interest at an annual effective rate.", "Single payments, no default risk."],
      relationship: "$A \\succ B \\iff X v^{a} > Y v^{b} \\iff i > (Y/X)^{1/(b-a)} - 1$",
      counterexample: `At $i = ${p2(jStar)}$ the two payments have equal value at every date.`,
      transfer,
      presentation: L3 ? (["compare-streams", "hidden-structure"] as const).slice() : (["compare-streams"] as const).slice(),
      features: { multipleValuationDates: true, unfamiliar: true },
      modelingDecisions: L3 ? 1 : undefined,
      params: { X, Y, a, b, variant },
    };
    if (variant === 0) {
      if (!L3) {
        const i = Number((Math.ceil(jStar / 0.005) * 0.005 + 0.005 * rng.int(1, 3)).toFixed(4));
        return statementQuestion({
          ...common,
          stem: `${intro}\n\nDetermine which of the following statements are true.`,
          statements: [
            statement("I", `At an annual effective rate of ${pc(i)}, A has the larger present value.`, true, `$${mamt(X)}v^{${a}} = ${mnum(X * Math.pow(1 + i, -a))}$ exceeds $${mamt(Y)}v^{${b}} = ${mnum(Y * Math.pow(1 + i, -b))}$.`, "SEQ_UNDISCOUNTED_SUM", { stage: 0, failure: "application", check: { expr: `${pvA(i)}-${pvB(i)}`, op: ">", than: 0 } }),
            statement("II", `At any given rate, if A has the larger value at time 0, A also has the larger value at time ${b}.`, true, `Both values are multiplied by $(1+i)^{${b}}$.`, "CONC_TVM_EQUIV_DATE_DEPENDS", { stage: 1, failure: "connection" }),
            statement("III", `At an annual effective rate of ${pc(2 * i)}, the present value of B is half its present value at ${pc(i)}.`, false, `The ratio is $(${factor(i)}/${factor(2 * i)})^{${b}} = ${mnum(Math.pow((1 + i) / (1 + 2 * i), b), 4)}$, not 0.5.`, "CONC_TVM_LINEAR_IN_RATE", { stage: 2, failure: "application", check: { expr: pvB(2 * i), op: "=", than: `0.5*${pvB(i)}` } }),
          ],
          extra: [
            { keys: ["II", "III"], misconception: "CONC_DIRECTION_REVERSED", why: "Rejecting I prefers the larger, later payment at a rate above the break-even.", stage: 0, failure: "conclusion" },
            { keys: ["III"], misconception: "TIMING_VALUATION_DATE", why: "Accepting only III treats the ranking as depending on the date of comparison.", stage: 1, failure: "connection" },
          ],
          params: { ...common.params, i },
        });
      }
      const rLo = Number((Math.floor(jStar / 0.005) * 0.005 - 0.005 * rng.int(0, 2)).toFixed(4));
      const rHi = Number((Math.ceil(jStar / 0.005) * 0.005 + 0.005 * rng.int(0, 2)).toFixed(4));
      return statementQuestion({
        ...common,
        stem: `${intro}\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `At an annual effective rate of ${pc(rHi)}, A has the larger present value.`, true, `The break-even rate is $(${mamt(Y)}/${mamt(X)})^{1/${b - a}} - 1 = ${p2(jStar)}$, below ${pc(rHi)}.`, "SEQ_UNDISCOUNTED_SUM", { stage: 0, failure: "application", check: { expr: `${pvA(rHi)}-${pvB(rHi)}`, op: ">", than: 0 } }),
          statement("II", `At an annual effective rate of ${pc(rLo)}, A has the larger present value.`, false, `${pc(rLo)} is below the break-even rate ${p2(jStar)}, so B is worth more.`, "CONC_DIRECTION_REVERSED", { stage: 2, failure: "application", check: { expr: `${pvA(rLo)}-${pvB(rLo)}`, op: ">", than: 0 }, conditionTrue: `True for any rate above ${p2(jStar)}.` }),
          statement("III", `There is a rate between ${pc(rLo)} and ${pc(rHi)} at which A and B have equal present values.`, true, `That rate is ${p2(jStar)}.`, "CONC_TVM_EQUIV_RATE_FREE", { stage: 2, failure: "conclusion", check: { expr: `1000000*(${lit(jStar)}-${lit(rLo)})*(${lit(rHi)}-${lit(jStar)})`, op: ">", than: 0 } }),
        ],
        extra: [
          { keys: ["II"], misconception: "TIMING_VALUATION_DATE", why: "Accepting only II misreads which payment is discounted more.", stage: 1, failure: "connection" },
          { keys: ["II", "III"], misconception: "CONC_TVM_EQUIV_DATE_DEPENDS", why: "Rejecting I while accepting II reverses the effect of the rate.", stage: 1, failure: "connection" },
        ],
        params: { ...common.params, rLo, rHi },
      });
    }
    if (!L3) {
      const j = jTarget;
      const Yx = X * Math.pow(1 + j, b - a);
      const c = rng.int(b + 1, b + 5);
      const pa = (r: number) => `${lit(X)}*(1+${lit(r)})**(-${a})`;
      const pb = (r: number) => `${lit(Yx)}*(1+${lit(r)})**(-${b})`;
      return statementQuestion({
        ...common,
        stem: `Payment A is ${mamt(X)} at time ${a}. Payment B is due at time ${b}, and the two payments have equal present values at an annual effective rate of ${pc(j)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `At any annual effective rate above ${pc(j)}, A has the larger present value.`, true, "The later payment loses more value as the rate rises.", "CONC_DIRECTION_REVERSED", { stage: 2, failure: "application", check: { expr: `${pa(j + 0.01)}-${pb(j + 0.01)}`, op: ">", than: 0 } }),
          statement("II", `At ${pc(j)}, A and B have equal values at time ${c}.`, true, `Both values at time 0 are multiplied by $(${factor(j)})^{${c}}$.`, "CONC_TVM_EQUIV_DATE_DEPENDS", { stage: 1, failure: "connection", check: { expr: `${lit(X)}*(1+${lit(j)})**${c - a}`, op: "=", than: `${lit(Yx)}*(1+${lit(j)})**${c - b}` } }),
          statement("III", `At ${pc(j)}, the value at time 0 of A and B together is $2(${mamt(X)})(${factor(j)})^{-${a}}$.`, true, "Each payment has the same present value as A.", "TIMING_VALUATION_DATE", { stage: 0, failure: "application", check: { expr: `${pa(j)}+${pb(j)}`, op: "=", than: `2*${pa(j)}` } }),
        ],
        extra: [{ keys: ["II"], misconception: "CONC_TVM_EQUIV_RATE_FREE", why: "Accepting only II treats the equivalence as holding at every rate yet misjudges the other two statements.", stage: 2, failure: "conclusion" }],
        params: { ...common.params, j, c },
      });
    }
    const kRate = Number((Math.floor(jStar / 0.005) * 0.005 - 0.005 * rng.int(0, 2)).toFixed(4));
    return statementQuestion({
      ...common,
      stem: `${intro} At some annual effective rate $j$, A and B have equal present values.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `$j$ exceeds ${pc(kRate)}.`, true, `$j = (${mamt(Y)}/${mamt(X)})^{1/${b - a}} - 1 = ${p2(jStar)}$.`, "ALG_ROOT_ERROR", { stage: 0, failure: "application", check: { expr: `(${lit(Y)}/${lit(X)})**(1/${b - a})-1`, op: ">", than: kRate } }),
        statement("II", "At any annual effective rate below $j$, B has the larger present value.", true, "At a lower rate the later, larger payment is discounted less.", "CONC_DIRECTION_REVERSED", { stage: 2, failure: "application", check: { expr: `${pvB(jStar - 0.01)}-${pvA(jStar - 0.01)}`, op: ">", than: 0 } }),
        statement("III", `At rate $j$, the value of A at time ${b} equals ${mamt(X)} + ${mamt(Y)}.`, false, `At time ${b}, A is worth $${mamt(X)}(1+j)^{${b - a}} = ${mamt(Y)}$, the same as B.`, "SEQ_UNDISCOUNTED_SUM", { stage: 1, failure: "interpretation", check: { expr: `${lit(X)}*(1+${lit(jStar)})**${b - a}`, op: "=", than: X + Y } }),
      ],
      extra: [
        { keys: ["III"], misconception: "CONC_TVM_EQUIV_RATE_FREE", why: "Accepting only III misjudges the rate and its effect.", stage: 2, failure: "conclusion" },
        { keys: ["I", "III"], misconception: "TIMING_VALUATION_DATE", why: "Accepting III adds values at different dates.", stage: 1, failure: "interpretation" },
      ],
      params: { ...common.params, kRate },
    });
  },
});

// ================================================================ nominal and effective rates

const FREQ: Record<string, { word: string; period: string }> = {
  "2": { word: "semiannually", period: "half-year" },
  "4": { word: "quarterly", period: "quarter" },
  "12": { word: "monthly", period: "month" },
  "6": { word: "every two months", period: "two-month period" },
  "0.5": { word: "every two years", period: "two-year period" },
};

const nominalDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-nominal-definition",
  family: "con-tvm-nominal",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.effective_nominal",
  secondary: ["TVM.discount_rates"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "rate_conversion"],
  soaConcept: "What a nominal rate convertible m-thly means, and naming the rate behind a stated crediting pattern.",
  variants: 2,
  generate(rng, level, variant) {
    const m = level === 1 ? rng.choice([2, 4, 12]) : rng.choice([6, 0.5]);
    const { word, period } = FREQ[String(m)];
    const r = gridRate(rng, 0.04, 0.12, 0.01);
    const j = r / m;
    const eff = Math.pow(1 + j, m) - 1;
    const steps = [
      { concept: "tvm.nominal-vs-effective", reasoning: `“Convertible ${word}” means interest is credited once every ${period}, i.e. ${m === 0.5 ? "every two years" : `${m} times a year`}.` },
      { concept: "tvm.nominal-vs-effective", reasoning: `Each crediting is at the nominal rate divided by $m = ${m === 0.5 ? "1/2" : m}$ on the current balance.` },
      { concept: "tvm.nominal-vs-effective", reasoning: `Compounding gives an annual effective rate $(1 + i^{(m)}/m)^m - 1$, which differs from the nominal rate.` },
    ];
    const common = {
      steps,
      conditions: ["Compound interest credited on the whole balance.", `Conversion ${word}.`],
      relationship: "$1 + i = \\left(1 + \\dfrac{i^{(m)}}{m}\\right)^m$",
      counterexample: "With $m = 1$ the nominal and effective annual rates coincide.",
      transfer: {
        principle: "A nominal rate is a label: divide by $m$ to get the rate actually credited each $1/m$ of a year.",
        unusual: m === 0.5 ? "Conversion is less frequent than once a year, so $m = 1/2$." : m === 6 ? "The conversion period is two months." : "The rate is described, not used in a calculation.",
        misread: "A nominal annual rate is not an annual effective rate unless $m = 1$.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2 },
      params: { m, r, variant },
    };
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem: `A deposit earns interest at a nominal annual rate of ${pc(r)} convertible ${word}.\n\nWhich of the following describes how interest is credited?`,
        correct: { content: `Interest of ${pc(j, 4)} of the balance is credited at the end of each ${period}.`, why: `$i^{(m)}/m = ${mpc(r)}/${m === 0.5 ? "(1/2)" : m} = ${mpc(j, 4)}$ per ${period}, compounded.` },
        distractors: [
          { content: `Interest of ${pc(r)} of the balance is credited at the end of each year.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That describes an annual effective rate, which is credited once a year.", stage: 0, failure: "recognition", confusedWith: "tvm.nominal-vs-effective" },
          { content: `Interest of ${pc(r)} of the balance is credited at the end of each ${period}.`, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: `The annual figure must be divided by $m$ for each ${period}.`, stage: 1, failure: "application" },
          { content: `Interest of ${pc(j, 4)} of the original deposit is credited at the end of each ${period}.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Interest is credited on the whole balance, including earlier interest.", stage: 2, failure: "selection" },
          { content: `Interest of ${pc(Math.pow(1 + r, 1 / m) - 1, 4)} of the balance is credited at the end of each ${period}.`, misconception: "CONC_RELATED_TERM", why: "That treats the quoted rate as annual effective and converts it; a nominal rate is simply divided by $m$.", stage: 1, failure: "interpretation" },
          { content: `Interest of ${pc(j, 4)} of the end-of-${period} balance is deducted at the start of each ${period}.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That describes a nominal rate of discount.", stage: 0, failure: "recognition", confusedWith: "tvm.discount-vs-interest" },
        ],
        itemFormat: "definition",
      });
    }
    const opt = (kind: string, nominal: number, effective: number) => `${kind} of ${pc(nominal, 4)}${kind.includes("force") ? "" : ` convertible ${word}`}, equivalent to an annual effective rate of ${pc(effective, 3)}`;
    return conceptQuestion({
      ...common,
      stem: `An account credits interest of ${pc(j, 4)} of the balance at the end of every ${period}.\n\nWhich of the following describes the rate of interest the account credits?`,
      correct: { content: opt("A nominal annual rate", r, eff), why: `$i^{(m)} = m \\times ${mpc(j, 4)} = ${mpc(r)}$ and $(1 + ${lit(j)})^{${m === 0.5 ? "1/2" : m}} - 1 = ${p2(eff)}$.` },
      distractors: [
        { content: opt("A nominal annual rate", r, r), misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "Compounding makes the effective rate differ from the nominal rate.", stage: 2, failure: "conclusion" },
        { content: opt("A nominal annual rate", j, eff), misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `${pc(j, 4)} is the rate per ${period}; the nominal annual rate is $m$ times it.`, stage: 1, failure: "interpretation" },
        { content: opt("A nominal annual rate", eff, r), misconception: "CONC_RELATED_TERM", why: "The nominal and effective figures are swapped.", stage: 1, failure: "interpretation", confusedWith: "tvm.nominal-vs-effective" },
        { content: opt("A nominal annual rate of discount", r, eff), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Interest credited at the end of each period on the balance is interest, not discount.", stage: 0, failure: "recognition" },
        { content: opt("A force of interest", r, eff), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force describes continuous crediting; here interest is credited at discrete dates.", stage: 0, failure: "recognition" },
      ],
      itemFormat: "definition",
    });
  },
});

const nominalExpression: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-nominal-expression",
  family: "con-tvm-nominal",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.effective_nominal",
  secondary: ["TVM.present_future_value"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["rate_conversion", "equation_construction"],
  soaConcept: "Choosing the expression for an equivalent nominal rate, a periodic rate, or an accumulation at a nominal rate.",
  variants: 2,
  generate(rng, level, variant) {
    type D = { latex: string; probe: string; misconception: "CONC_TVM_PERIODIC_AS_NOMINAL" | "ALG_ROOT_ERROR" | "RATE_DISCOUNT_AS_INTEREST" | "RATE_FORCE_AS_EFFECTIVE" | "RATE_DIVIDED_EFFECTIVE" | "RATE_NOMINAL_AS_EFFECTIVE" | "SEQ_TERM_COUNT" | "RATE_ANNUAL_FOR_PERIODIC" | "MODEL_COMPOUND_AS_SIMPLE" | "CONC_TVM_FREQUENCY_MISMATCH" | "VAR_OTHER_UNKNOWN" | "CONC_RELATED_TERM"; why: string; stage: number; failure: "recognition" | "interpretation" | "selection" | "application" | "connection" | "conclusion" };
    let stem: string;
    let correct: { latex: string; probe: string; why: string };
    let ds: D[];
    let ref: string;
    let label: string;
    const L3 = level === 3;
    if (level === 1 && variant === 0) {
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const m = rng.choice([2, 4, 12]);
      const I = lit(i);
      const F = factor(i);
      stem = `The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions equals $i^{(${m})}$.`;
      correct = { latex: `${m}\\left[(${F})^{1/${m}} - 1\\right]`, probe: `${m}*(${g(i)}**(1/${m})-1)`, why: `$i^{(${m})}/${m}$ is the effective rate per $1/${m}$ year, $(${F})^{1/${m}} - 1$; multiply by ${m}.` };
      ds = [
        { latex: `(${F})^{1/${m}} - 1`, probe: `${g(i)}**(1/${m})-1`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: "That is the rate per $1/m$ year, not the nominal annual rate.", stage: 1, failure: "interpretation" },
        { latex: `${m}\\left[(${F})^{${m}} - 1\\right]`, probe: `${m}*(${g(i)}**${m}-1)`, misconception: "ALG_ROOT_ERROR", why: "The periodic factor is the $m$-th root of $1+i$, not its $m$-th power.", stage: 1, failure: "application" },
        { latex: `${m}\\left[1 - (${F})^{-1/${m}}\\right]`, misconception: "RATE_DISCOUNT_AS_INTEREST", probe: `${m}*(1-${g(i)}**(-1/${m}))`, why: `That is $d^{(${m})}$, the nominal rate of discount.`, stage: 0, failure: "selection" },
        { latex: `${m}\\ln\\left[(${F})^{1/${m}}\\right]`, probe: `log(${g(i)})`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That simplifies to $\\ln(1+i) = \\delta$, the limit as $m \\to \\infty$.", stage: 0, failure: "selection" },
        { latex: `\\left(1 + \\tfrac{${I}}{${m}}\\right)^{${m}} - 1`, probe: `(1+${I}/${m})**${m}-1`, misconception: "RATE_DIVIDED_EFFECTIVE", why: "That treats the effective rate as if it were nominal, dividing it by $m$.", stage: 0, failure: "recognition" },
      ];
      ref = `${m}*(exp(log(${g(i)})/${m})-1)`;
      label = `i^(${m})`;
    } else if (level <= 2 && variant === 1) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const m = rng.choice([2, 4, 12]);
      const q = level === 1 ? rng.int(2, 8) * m : drawUntil(() => rng.int(m + 1, 4 * m), (x) => x % m !== 0);
      const t = q / m;
      const R = lit(r);
      const tL = Number.isInteger(t) ? `${t}` : `${q}/${m}`;
      const tLt = Number.isInteger(t) ? `${t}` : `\\tfrac{${q}}{${m}}`;
      const span = level === 1 ? `${t} years` : `${q * (12 / m)} months`;
      stem = `A deposit of 1 earns interest at a nominal annual rate of ${pc(r)} convertible ${FREQ[String(m)].word}.\n\nDetermine which of the following expressions gives its accumulated value after ${span}.`;
      correct = { latex: `\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${q}}`, probe: `(1+${R}/${m})**${q}`, why: `${span} contain ${q} conversion periods, each at ${R}/${m}.` };
      ds = [
        { latex: `(${factor(r)})^{${tL}}`, probe: `${g(r)}**${lit(t)}`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The nominal rate is not an annual effective rate.", stage: 0, failure: "recognition" },
        { latex: `\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${tL}}`, probe: `(1+${R}/${m})**${lit(t)}`, misconception: "SEQ_TERM_COUNT", why: `The exponent counts conversion periods: ${q}, not ${tL}.`, stage: 1, failure: "application" },
        { latex: `(${factor(r)})^{${q}}`, probe: `${g(r)}**${q}`, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "Each conversion period earns $r/m$, not the full annual figure.", stage: 1, failure: "application" },
        { latex: `1 + ${R}\\cdot ${tLt}`, probe: `1+${R}*${lit(t)}`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Interest is compounded at each conversion date.", stage: 2, failure: "selection" },
        { latex: `e^{${R}\\cdot ${tLt}}`, probe: `exp(${R}*${lit(t)})`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is continuous compounding at force $r$, not conversion " + FREQ[String(m)].word + ".", stage: 0, failure: "selection" },
        { latex: `\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${q}}`, probe: `(1-${R}/${m})**(-${q})`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That accumulates at a nominal rate of discount.", stage: 0, failure: "recognition" },
      ];
      ref = `exp(${q}*log(1+${R}/${m}))`;
      label = "AV";
    } else if (level === 2) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const [m, p] = rng.shuffle([2, 4, 12]).slice(0, 2);
      const R = lit(r);
      stem = `Interest is credited at a nominal annual rate of ${pc(r)} convertible ${FREQ[String(m)].word}.\n\nDetermine which of the following expressions equals the equivalent nominal annual rate of interest convertible ${FREQ[String(p)].word}.`;
      correct = { latex: `${p}\\left[\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}/${p}} - 1\\right]`, probe: `${p}*((1+${R}/${m})**(${m}/${p})-1)`, why: `Equate annual factors: $(1 + i^{(${p})}/${p})^{${p}} = (1 + ${R}/${m})^{${m}}$.` };
      ds = [
        { latex: `\\tfrac{${p}}{${m}}\\cdot ${R}`, probe: `${p}/${m}*${R}`, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "Nominal rates are not rescaled in proportion to the number of conversions.", stage: 1, failure: "selection" },
        { latex: `${p}\\left[\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${p}/${m}} - 1\\right]`, probe: `${p}*((1+${R}/${m})**(${p}/${m})-1)`, misconception: "ALG_ROOT_ERROR", why: "The exponent is inverted.", stage: 2, failure: "application" },
        { latex: `\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}/${p}} - 1`, probe: `(1+${R}/${m})**(${m}/${p})-1`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the rate per $1/${p}$ year; multiply by ${p}.`, stage: 2, failure: "interpretation" },
        { latex: `${p}\\left[(${factor(r)})^{1/${p}} - 1\\right]`, probe: `${p}*(${g(r)}**(1/${p})-1)`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The given rate is nominal, not annual effective.", stage: 0, failure: "recognition" },
        { latex: `\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}} - 1`, probe: `(1+${R}/${m})**${m}-1`, misconception: "VAR_OTHER_UNKNOWN", why: "That is the annual effective rate, an intermediate quantity.", stage: 1, failure: "conclusion" },
      ];
      ref = `${p}*(exp(${m}/${p}*log(1+${R}/${m}))-1)`;
      label = `i^(${p})`;
    } else if (variant === 0) {
      const k = rng.choice([2, 3, 4, 6]);
      const j = gridRate(rng, 0.01, 0.03, 0.0025);
      const J = lit(j);
      stem = `An account credits interest of ${pc(j)} of the balance at the end of every ${k} months.\n\nDetermine which of the following expressions equals the equivalent nominal annual rate of interest convertible monthly.`;
      correct = { latex: `12\\left[(${factor(j)})^{1/${k}} - 1\\right]`, probe: `12*(${g(j)}**(1/${k})-1)`, why: `The monthly rate is $(${factor(j)})^{1/${k}} - 1$; the nominal rate convertible monthly is 12 times it.` };
      ds = [
        { latex: `\\tfrac{12}{${k}}\\cdot ${J}`, probe: `12/${k}*${J}`, misconception: "CONC_RELATED_TERM", why: `That is the nominal rate convertible every ${k} months, not monthly.`, stage: 1, failure: "interpretation" },
        { latex: `12\\left[(${factor(j)})^{${k}} - 1\\right]`, probe: `12*(${g(j)}**${k}-1)`, misconception: "ALG_ROOT_ERROR", why: "A month is $1/" + k + "$ of the crediting period, so take a root, not a power.", stage: 2, failure: "application" },
        { latex: `12\\left[(${factor(j)})^{1/12} - 1\\right]`, probe: `12*(${g(j)}**(1/12)-1)`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: `${pc(j)} is earned per ${k} months, not per year.`, stage: 0, failure: "recognition" },
        { latex: `(${factor(j)})^{12/${k}} - 1`, probe: `${g(j)}**(12/${k})-1`, misconception: "VAR_OTHER_UNKNOWN", why: "That is the annual effective rate.", stage: 2, failure: "conclusion" },
        { latex: `(${factor(j)})^{1/${k}} - 1`, probe: `${g(j)}**(1/${k})-1`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: "That is the monthly rate; the nominal annual rate is 12 times it.", stage: 2, failure: "interpretation" },
      ];
      ref = `12*(exp(log(${g(j)})/${k})-1)`;
      label = "i^(12)";
    } else {
      const k = rng.choice([2, 3, 4, 6]);
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const R = lit(r);
      stem = `Interest is credited at a nominal annual rate of ${pc(r)} convertible monthly.\n\nDetermine which of the following expressions equals the effective rate of interest for a period of ${k} months.`;
      correct = { latex: `\\left(1 + \\tfrac{${R}}{12}\\right)^{${k}} - 1`, probe: `(1+${R}/12)**${k}-1`, why: `${k} months contain ${k} monthly credits at ${R}/12.` };
      ds = [
        { latex: `\\tfrac{${k}}{12}\\cdot ${R}`, probe: `${k}/12*${R}`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Monthly interest compounds within the period.", stage: 2, failure: "selection" },
        { latex: `(${factor(r)})^{${k}/12} - 1`, probe: `${g(r)}**(${k}/12)-1`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The quoted rate is nominal, not annual effective.", stage: 0, failure: "recognition" },
        { latex: `\\left(1 + \\tfrac{${R}}{12}\\right)^{12/${k}} - 1`, probe: `(1+${R}/12)**(12/${k})-1`, misconception: "ALG_ROOT_ERROR", why: "The exponent counts months in the period: " + k + ".", stage: 1, failure: "application" },
        { latex: `\\tfrac{12}{${k}}\\left[\\left(1 + \\tfrac{${R}}{12}\\right)^{${k}} - 1\\right]`, probe: `12/${k}*((1+${R}/12)**${k}-1)`, misconception: "CONC_RELATED_TERM", why: `That is the nominal annual rate convertible every ${k} months.`, stage: 2, failure: "interpretation" },
        { latex: `\\left(1 + \\tfrac{${R}}{12}\\right)^{12} - 1`, probe: `(1+${R}/12)**12-1`, misconception: "VAR_OTHER_UNKNOWN", why: "That is the annual effective rate, not the rate for " + k + " months.", stage: 2, failure: "conclusion" },
      ];
      ref = `exp(${k}*log(1+${R}/12))-1`;
      label = "periodic rate";
    }
    return conceptQuestion({
      stem,
      correct: { content: math(correct.latex), why: correct.why, probe: correct.probe },
      distractors: ds.map((d) => ({ content: math(d.latex), misconception: d.misconception, why: d.why, probe: d.probe, stage: d.stage, failure: d.failure })),
      reference: { values: [{ label, expr: ref }], description: "The required rate or factor computed through the annual accumulation factor (logarithms), compared with each option." },
      steps: [
        { concept: "tvm.nominal-vs-effective", reasoning: "Turn the given rate into an accumulation factor for one period it describes." },
        { concept: L3 ? "tvm.rate-period-matching" : "tvm.nominal-vs-effective", reasoning: "Raise that factor to the power that converts it to the period required (a root for a shorter period)." },
        { concept: "tvm.nominal-vs-effective", reasoning: "Report the quantity asked for: a nominal rate is $m$ times the periodic rate; an accumulation is the factor itself." },
      ],
      conditions: ["Compound interest; all rates equivalent.", "Nominal rates divide by their conversion frequency."],
      relationship: "$\\left(1 + \\dfrac{i^{(m)}}{m}\\right)^m = 1 + i = \\left(1 + \\dfrac{i^{(p)}}{p}\\right)^p$",
      counterexample: "With $m = p$ no conversion is needed; with $m = 1$ nominal and effective coincide.",
      transfer: {
        principle: "Convert through the annual (or any common) accumulation factor; only then divide or multiply by frequencies.",
        unusual: L3 ? "The crediting period is several months and the target frequency differs from it." : "Options differ only in where $m$ appears.",
        misread: "A nominal rate scaled in proportion is not an equivalent rate.",
      },
      itemFormat: "expression-selection",
      presentation: L3 ? ["hidden-structure", "frequency"] : level === 2 ? ["frequency", "indirect-wording"] : ["frequency"],
      features: { unfamiliar: level >= 2, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { variant },
    });
  },
});

const nominalDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-nominal-diagnosis",
  family: "con-tvm-nominal",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.effective_nominal",
  secondary: ["TVM.present_future_value"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "rate_conversion"],
  soaConcept: "Diagnosing a rate-conversion error in a proposed accumulation or rate comparison.",
  variants: 2,
  generate(rng, level, variant) {
    const X = gridAmount(rng, 1000, 9000, 500);
    const XS = mamt(X);
    const steps = [
      { concept: "tvm.nominal-vs-effective", reasoning: "Identify whether the quoted rate is nominal or effective, and its conversion frequency." },
      { concept: "tvm.nominal-vs-effective", reasoning: "Find the effective rate for the period that will be used." },
      { concept: "tvm.rate-period-matching", reasoning: "Count periods in that same unit; then accumulate or compare." },
    ];
    const common = {
      steps,
      conditions: ["Compound interest.", "Rates as quoted; no fees or taxes."],
      relationship: "$1 + i = (1 + i^{(m)}/m)^m$; periodic rate for $1/m$ year from effective $i$: $(1+i)^{1/m} - 1$",
      transfer: {
        principle: "Divide nominal rates by $m$; take roots of effective rates — never the other way round.",
        unusual: "You judge a worked solution.",
        misread: "Two nominal rates with different frequencies are not comparable directly.",
      },
      itemFormat: "error-diagnosis" as const,
      presentation: level === 2 ? (["frequency", "indirect-wording"] as const).slice() : (["frequency"] as const).slice(),
      features: { unfamiliar: level === 2 },
    };
    if (level === 1) {
      if (variant === 0) {
        const r = gridRate(rng, 0.04, 0.12, 0.01);
        const m = rng.choice([2, 4, 12]);
        const n = rng.int(3, 10);
        const R = lit(r);
        const truth = `${lit(X)}*(1+${R}/${m})**${m * n}`;
        const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
        return conceptQuestion({
          ...common,
          stem: `A deposit of ${XS} earns interest at a nominal annual rate of ${pc(r)} convertible ${FREQ[String(m)].word}. A candidate calculates the accumulated value after ${n} years as\n\n$$${XS}(${factor(r)})^{${n}} = ${mnum(X * Math.pow(1 + r, n))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
          correct: { content: `The nominal rate was treated as effective; the value is $${XS}(1 + ${R}/${m})^{${m * n}}$.`, why: `The correct value is ${mnum(X * Math.pow(1 + r / m, m * n))}.`, check: eq(`${lit(X)}*exp(${m * n}*log(1+${R}/${m}))`) },
          distractors: [
            { content: "The calculation is correct, because the quoted rate is an annual rate.", misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "A nominal rate convertible more than once a year produces more than its face value in a year.", check: eq(`${lit(X)}*${g(r)}**${n}`), stage: 0, failure: "recognition" },
            { content: `The rate must be divided by ${m}; the value is $${XS}(1 + ${R}/${m})^{${n}}$.`, misconception: "SEQ_TERM_COUNT", why: `The periodic rate is right but there are ${m * n} periods, not ${n}.`, check: eq(`${lit(X)}*(1+${R}/${m})**${n}`), stage: 2, failure: "application" },
            { content: `Interest is credited ${m} times a year; the value is $${XS}(${factor(r)})^{${m * n}}$.`, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "Each credit is at $r/m$, not $r$.", check: eq(`${lit(X)}*${g(r)}**${m * n}`), stage: 1, failure: "application" },
            { content: `Interest compounds more than once a year; the value is $${XS}e^{${R}(${n})}$.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is continuous compounding; conversion here is " + FREQ[String(m)].word + ".", check: eq(`${lit(X)}*exp(${R}*${n})`), stage: 1, failure: "selection" },
            { content: `The rate is a rate of discount; the value is $${XS}(1 - ${R}/${m})^{-${m * n}}$.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That would apply to a nominal rate of discount.", check: eq(`${lit(X)}*(1-${R}/${m})**(-${m * n})`), stage: 0, failure: "selection" },
          ],
          reference: { description: "Accumulated value with the periodic rate $r/m$ over $mn$ periods, compared with each proposed fix." },
          params: { X, r, m, n, variant },
        });
      }
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const k = drawUntil(() => rng.int(5, 30), (x) => x % 12 !== 0);
      const I = lit(i);
      const truth = `${lit(X)}*${g(i)}**(${k}/12)`;
      const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
      return conceptQuestion({
        ...common,
        stem: `A deposit of ${XS} earns an annual effective rate of interest of ${pc(i)}. A candidate calculates the accumulated value after ${k} months as\n\n$$${XS}\\left(1 + \\tfrac{${I}}{12}\\right)^{${k}} = ${mnum(X * Math.pow(1 + i / 12, k))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: { content: `The effective rate was divided by 12; the value is $${XS}(${factor(i)})^{${k}/12}$.`, why: `The correct value is ${mnum(X * Math.pow(1 + i, k / 12))}.`, check: eq(`${lit(X)}*exp(${k}/12*log(${g(i)}))`) },
        distractors: [
          { content: "The calculation is correct; the monthly rate is the annual rate divided by 12.", misconception: "RATE_DIVIDED_EFFECTIVE", why: "Only nominal rates are divided by 12; an effective rate converts by a root.", check: eq(`${lit(X)}*(1+${I}/12)**${k}`), stage: 1, failure: "selection" },
          { content: `The annual rate applies each month; the value is $${XS}(${factor(i)})^{${k}}$.`, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "The annual rate cannot be applied once per month.", check: eq(`${lit(X)}*${g(i)}**${k}`), stage: 2, failure: "application" },
          { content: `Simple interest applies within a year; the value is $${XS}(1 + ${I}\\cdot\\tfrac{${k}}{12})$.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Compound interest applies to fractional periods too.", check: eq(`${lit(X)}*(1+${I}*${k}/12)`), stage: 1, failure: "selection" },
          { content: `There are ${12 * k} monthly periods; the value is $${XS}(1 + ${I}/12)^{${12 * k}}$.`, misconception: "SEQ_TERM_COUNT", why: `${k} months are ${k} monthly periods.`, check: eq(`${lit(X)}*(1+${I}/12)**${12 * k}`), stage: 2, failure: "application" },
          { content: `The rate compounds continuously; the value is $${XS}e^{${I}\\cdot ${k}/12}$.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "The rate is effective, not a force.", check: eq(`${lit(X)}*exp(${I}*${k}/12)`), stage: 0, failure: "recognition" },
        ],
        reference: { description: "Accumulated value $X(1+i)^{k/12}$, compared with each proposed fix." },
        params: { X, i, k, variant },
      });
    }
    if (variant === 0) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const [m, p] = rng.shuffle([2, 4, 12]).slice(0, 2);
      const R = lit(r);
      const truth = `${p}*(exp(${m}/${p}*log(1+${R}/${m}))-1)`;
      const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
      return conceptQuestion({
        ...common,
        stem: `Interest is credited at a nominal annual rate of ${pc(r)} convertible ${FREQ[String(m)].word}. A candidate states that the equivalent nominal annual rate convertible ${FREQ[String(p)].word} is also ${pc(r)}, since both are annual rates.\n\nWhich of the following correctly describes the candidate's statement?`,
        correct: { content: `The statement is wrong; the equivalent rate is $${p}[(1 + ${R}/${m})^{${m}/${p}} - 1]$.`, why: `That is ${p2(p * (Math.pow(1 + r / m, m / p) - 1))}.`, check: eq(`${p}*((1+${R}/${m})**(${m}/${p})-1)`) },
        distractors: [
          { content: "The statement is correct; equivalent nominal annual rates are always equal.", misconception: "CONC_RELATED_TERM", why: "Equivalent rates give the same annual factor, not the same nominal figure.", check: eq(R), stage: 0, failure: "recognition" },
          { content: `The statement is wrong; the equivalent rate is $${R} \\times ${m}/${p}$.`, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "Nominal rates do not scale with the number of conversions.", check: eq(`${R}*${m}/${p}`), stage: 1, failure: "selection" },
          { content: `The statement is wrong; the equivalent rate is $(1 + ${R}/${m})^{${m}/${p}} - 1$.`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the rate per $1/${p}$ year; the nominal rate is ${p} times it.`, check: eq(`(1+${R}/${m})**(${m}/${p})-1`), stage: 2, failure: "interpretation" },
          { content: `The statement is wrong; the equivalent rate is $${p}[(1 + ${R}/${m})^{${p}/${m}} - 1]$.`, misconception: "ALG_ROOT_ERROR", why: "The exponent is inverted.", check: eq(`${p}*((1+${R}/${m})**(${p}/${m})-1)`), stage: 2, failure: "application" },
          { content: `The statement is wrong; the equivalent rate is $${p}[(${factor(r)})^{1/${p}} - 1]$.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That converts the quoted figure as if it were annual effective.", check: eq(`${p}*(${g(r)}**(1/${p})-1)`), stage: 1, failure: "selection" },
        ],
        reference: { description: "Equivalent nominal rate from equal annual accumulation factors, compared with each option's proposed value." },
        params: { r, m, p, variant },
      });
    }
    const r1 = drawUntil(() => gridRate(rng, 0.06, 0.12, 0.005), () => true);
    const r2 = Number((r1 + 0.0005).toFixed(4));
    const effA = `((1+${lit(r1)}/12)**12-1)`;
    const effB = `((1+${lit(r2)}/2)**2-1)`;
    return conceptQuestion({
      ...common,
      stem: `Offer A credits interest at a nominal annual rate of ${pc(r1)} convertible monthly. Offer B credits interest at a nominal annual rate of ${pc(r2)} convertible semiannually. A candidate concludes that B is better because ${pc(r2)} exceeds ${pc(r1)}.\n\nWhich of the following correctly describes the candidate's reasoning?`,
      correct: { content: `Nominal rates with different frequencies cannot be compared directly; A's annual effective rate is higher, so A is better.`, why: `A: ${p2(Math.pow(1 + r1 / 12, 12) - 1)}; B: ${p2(Math.pow(1 + r2 / 2, 2) - 1)}.`, check: { expr: `${effA}-${effB}`, op: ">", than: 0 } },
      distractors: [
        { content: "The conclusion is right: the higher nominal rate always gives the higher annual effective rate.", misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "More frequent conversion can more than offset a slightly lower nominal rate.", check: { expr: `${effB}-${effA}`, op: ">", than: 0 }, stage: 0, failure: "recognition" },
        { content: "The conclusion is right: less frequent conversion produces more interest over a year.", misconception: "CONC_DIRECTION_REVERSED", why: "For a fixed nominal rate, more frequent conversion produces more interest.", check: { expr: `${effB}-${effA}`, op: ">", than: 0 }, stage: 2, failure: "application" },
        { content: `Compare the periodic rates $${lit(r1)}/12$ and $${lit(r2)}/2$; B's is larger, so B is better.`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: "Periodic rates for periods of different lengths are not comparable either.", check: { expr: `${effB}-${effA}`, op: ">", than: 0 }, stage: 1, failure: "selection" },
        { content: "The offers are equivalent, since their nominal annual rates differ by so little.", misconception: "CONC_RELATED_TERM", why: "Equivalence means equal annual effective rates, which these do not have.", check: { expr: effA, op: "=", than: effB }, stage: 1, failure: "interpretation" },
      ],
      reference: { description: "Annual effective rates of the two offers, compared directly." },
      params: { r1, r2, variant },
    });
  },
});

const rateFrequency: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-rate-frequency",
  family: "con-tvm-nominal",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.effective_nominal",
  secondary: ["ANNUITIES.frequency_timing", "ANNUITIES.level_payment", "TVM.force_of_interest"],
  itemFormat: "expression-selection",
  conceptFamily: "cross-topic",
  dimensions: ["rate_conversion", "transfer", "timing"],
  soaConcept: "Matching the interest rate to the payment period before applying an annuity factor.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 100, 900, 50);
    const n = rng.int(3, 8);
    const r = gridRate(rng, 0.04, 0.1, 0.01);
    const R = lit(r);
    const ann = (N: number, j: string, due: boolean, acc = false) => {
      const base = acc ? `(((1+${j})**${N}-1)/(${j}))` : `((1-(1+${j})**(-${N}))/(${j}))`;
      return due ? `(${base}*(1+${j}))` : base;
    };
    type Spec = { lead: string; sym: string; jL: string; j: string; N: number; due: boolean; acc: boolean; misconception?: "CONC_TVM_FREQUENCY_MISMATCH" | "RATE_ANNUAL_FOR_PERIODIC" | "RATE_NOMINAL_AS_EFFECTIVE" | "ALG_ROOT_ERROR" | "RATE_PAYMENT_FREQUENCY" | "TIMING_DUE_AS_IMMEDIATE" | "RATE_FORCE_AS_EFFECTIVE"; why?: string; stage?: number; failure?: "selection" | "application" | "recognition" | "interpretation"; mult?: number };
    let stem: string;
    let specs: Spec[];
    let ref: string;
    let rel: string;
    const L3 = level === 3;
    if (!L3 && variant === 0) {
      const N = 12 * n;
      stem = `Payments of ${mamt(P)} are made at the end of each month for ${n} years. Interest is at a nominal annual rate of ${pc(r)} convertible quarterly.\n\nDetermine which of the following expressions gives the present value of the payments.`;
      specs = [
        { lead: mamt(P), sym: "a", N, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{1/3} - 1`, j: `((1+${R}/4)**(1/3)-1)`, due: false, acc: false },
        { lead: mamt(P), sym: "a", N, jL: `\\tfrac{${R}}{12}`, j: `(${R}/12)`, due: false, acc: false, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "Dividing by 12 treats the rate as convertible monthly; it is convertible quarterly.", stage: 1, failure: "selection" },
        { lead: mamt(P), sym: "a", N, jL: `\\tfrac{${R}}{4}`, j: `(${R}/4)`, due: false, acc: false, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the quarterly rate, applied here per month.", stage: 1, failure: "application" },
        { lead: mamt(P), sym: "a", N, jL: `(${factor(r)})^{1/12} - 1`, j: `(${g(r)}**(1/12)-1)`, due: false, acc: false, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The quoted rate is nominal, not annual effective.", stage: 0, failure: "recognition" },
        { lead: mamt(P), sym: "a", N, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{3} - 1`, j: `((1+${R}/4)**3-1)`, due: false, acc: false, misconception: "ALG_ROOT_ERROR", why: "A month is one third of a quarter: take the cube root, not the cube.", stage: 1, failure: "application" },
        { lead: mamt(12 * P), sym: "a", N: n, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{4} - 1`, j: `((1+${R}/4)**4-1)`, due: false, acc: false, misconception: "RATE_PAYMENT_FREQUENCY", why: "Replacing twelve monthly payments by one year-end payment ignores interest within the year.", stage: 2, failure: "selection" },
      ];
      ref = `(${Array.from({ length: N }, (_, k) => `(1+${R}/4)**(-${(k + 1) / 3})`).join("+")})*${lit(P)}`;
      rel = "$j = (1 + i^{(4)}/4)^{1/3} - 1$ per month";
    } else if (!L3) {
      const N = 4 * n;
      stem = `Deposits of ${mamt(P)} are made at the beginning of each quarter for ${n} years. Interest is at a nominal annual rate of ${pc(r)} convertible monthly.\n\nDetermine which of the following expressions gives the accumulated value of the deposits at the end of ${n} years.`;
      specs = [
        { lead: mamt(P), sym: "\\ddot{s}", N, jL: `\\left(1 + \\tfrac{${R}}{12}\\right)^{3} - 1`, j: `((1+${R}/12)**3-1)`, due: true, acc: true },
        { lead: mamt(P), sym: "\\ddot{s}", N, jL: `\\tfrac{${R}}{4}`, j: `(${R}/4)`, due: true, acc: true, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "Dividing by 4 treats the rate as convertible quarterly.", stage: 1, failure: "selection" },
        { lead: mamt(P), sym: "\\ddot{s}", N, jL: `\\left(1 + \\tfrac{${R}}{12}\\right)^{1/3} - 1`, j: `((1+${R}/12)**(1/3)-1)`, due: true, acc: true, misconception: "ALG_ROOT_ERROR", why: "A quarter is three months: cube the monthly factor.", stage: 1, failure: "application" },
        { lead: mamt(P), sym: "s", N, jL: `\\left(1 + \\tfrac{${R}}{12}\\right)^{3} - 1`, j: `((1+${R}/12)**3-1)`, due: false, acc: true, misconception: "TIMING_DUE_AS_IMMEDIATE", why: "Deposits at the beginning of each quarter form an annuity-due.", stage: 2, failure: "selection" },
        { lead: mamt(P), sym: "\\ddot{s}", N, jL: `(${factor(r)})^{1/4} - 1`, j: `(${g(r)}**(1/4)-1)`, due: true, acc: true, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The quoted rate is nominal, not annual effective.", stage: 0, failure: "recognition" },
        { lead: mamt(P), sym: "\\ddot{s}", N, jL: `\\tfrac{${R}}{12}`, j: `(${R}/12)`, due: true, acc: true, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the monthly rate, applied here per quarter.", stage: 1, failure: "application" },
      ];
      ref = `(${Array.from({ length: N }, (_, k) => `(1+${R}/12)**${3 * (N - k)}`).join("+")})*${lit(P)}`;
      rel = "$j = (1 + i^{(12)}/12)^{3} - 1$ per quarter";
    } else if (variant === 0) {
      stem = `Payments of ${mamt(P)} are made every two years for ${2 * n} years, the first at time 2. Interest is at a nominal annual rate of ${pc(r)} convertible quarterly.\n\nDetermine which of the following expressions gives the present value of the payments.`;
      specs = [
        { lead: mamt(P), sym: "a", N: n, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{8} - 1`, j: `((1+${R}/4)**8-1)`, due: false, acc: false },
        { lead: mamt(P), sym: "a", N: n, jL: `2(${R})`, j: `(2*${R})`, due: false, acc: false, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "Doubling the nominal rate ignores compounding over the two years.", stage: 1, failure: "selection" },
        { lead: mamt(P), sym: "a", N: n, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{1/8} - 1`, j: `((1+${R}/4)**(1/8)-1)`, due: false, acc: false, misconception: "ALG_ROOT_ERROR", why: "Two years contain eight quarters: raise to the 8th power.", stage: 1, failure: "application" },
        { lead: mamt(P), sym: "a", N: n, jL: `(${factor(r)})^{2} - 1`, j: `(${g(r)}**2-1)`, due: false, acc: false, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "The quoted rate is nominal.", stage: 0, failure: "recognition" },
        { lead: mamt(P), sym: "a", N: n, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{4} - 1`, j: `((1+${R}/4)**4-1)`, due: false, acc: false, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the annual effective rate, used here per two-year period.", stage: 1, failure: "application" },
        { lead: `\\tfrac{${mamt(P)}}{2}`, sym: "a", N: 2 * n, mult: 0.5, jL: `\\left(1 + \\tfrac{${R}}{4}\\right)^{4} - 1`, j: `((1+${R}/4)**4-1)`, due: false, acc: false, misconception: "RATE_PAYMENT_FREQUENCY", why: "Spreading each payment over two years ignores interest within the two-year period.", stage: 2, failure: "selection" },
      ];
      ref = `(${Array.from({ length: n }, (_, k) => `(1+${R}/4)**(-${8 * (k + 1)})`).join("+")})*${lit(P)}`;
      rel = "$j = (1 + i^{(4)}/4)^{8} - 1$ per two years";
    } else {
      const d = gridRate(rng, 0.03, 0.08, 0.005);
      const Dl = lit(d);
      const N = 12 * n;
      stem = `Payments of ${mamt(P)} are made at the beginning of each month for ${n} years, the first one today. Interest is credited at a constant force of interest of ${pc(d)}.\n\nDetermine which of the following expressions gives the present value of the payments.`;
      specs = [
        { lead: mamt(P), sym: "\\ddot{a}", N, jL: `e^{${Dl}/12} - 1`, j: `(exp(${Dl}/12)-1)`, due: true, acc: false },
        { lead: mamt(P), sym: "\\ddot{a}", N, jL: `\\tfrac{${Dl}}{12}`, j: `(${Dl}/12)`, due: true, acc: false, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force divided by 12 is not an effective monthly rate.", stage: 0, failure: "recognition" },
        { lead: mamt(P), sym: "\\ddot{a}", N, jL: `e^{${Dl}} - 1`, j: `(exp(${Dl})-1)`, due: true, acc: false, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the annual effective rate, used here per month.", stage: 1, failure: "application" },
        { lead: mamt(P), sym: "a", N, jL: `e^{${Dl}/12} - 1`, j: `(exp(${Dl}/12)-1)`, due: false, acc: false, misconception: "TIMING_DUE_AS_IMMEDIATE", why: "The first payment is today: an annuity-due.", stage: 2, failure: "selection" },
        { lead: mamt(P), sym: "\\ddot{a}", N, jL: `e^{12(${Dl})} - 1`, j: `(exp(12*${Dl})-1)`, due: true, acc: false, misconception: "ALG_ROOT_ERROR", why: "A month is $1/12$ year, so the exponent is $\\delta/12$.", stage: 1, failure: "application" },
        { lead: mamt(12 * P), sym: "\\ddot{a}", N: n, jL: `e^{${Dl}} - 1`, j: `(exp(${Dl})-1)`, due: true, acc: false, misconception: "RATE_PAYMENT_FREQUENCY", why: "Twelve monthly payments are not one payment of " + mamt(12 * P) + " at the start of the year.", stage: 2, failure: "selection" },
      ];
      ref = `(${Array.from({ length: N }, (_, k) => `exp(-${Dl}*${k}/12)`).join("+")})*${lit(P)}`;
      rel = "$j = e^{\\delta/12} - 1$ per month";
    }
    const content = (s: Spec) => math(`${s.lead}\\,${s.sym}_{\\overline{${s.N}|}\\,j}, \\quad j = ${s.jL}`);
    const probe = (s: Spec) => `${lit(s.mult ? P * s.mult : s.lead === mamt(P) ? P : 12 * P)}*${ann(s.N, s.j, s.due, s.acc)}`;
    const [c, ...ds] = specs;
    return conceptQuestion({
      stem,
      correct: { content: content(c), why: `First find the effective rate for one payment period: ${rel}; then use ${c.N} payment periods.`, probe: probe(c) },
      distractors: ds.map((s) => ({ content: content(s), misconception: s.misconception!, why: s.why!, probe: probe(s), stage: s.stage!, failure: s.failure! })),
      reference: { values: [{ label: "value", expr: ref }], description: "Explicit sum of every payment, each moved at the given rate, compared with each option." },
      steps: [
        { concept: "tvm.rate-period-matching", reasoning: "The annuity factor's rate must be the effective rate for one payment period." },
        { concept: L3 && variant === 1 ? "tvm.force-of-interest" : "tvm.nominal-vs-effective", reasoning: `Convert the quoted rate: ${rel}.` },
        { concept: "ann.immediate-vs-due", reasoning: "Count payment periods and choose the factor for the payment timing." },
        ...(L3 ? [{ concept: "tvm.rate-period-matching", reasoning: "Do not regroup payments into annual totals: interest within each period would be lost." }] : []),
      ],
      conditions: ["Level payments.", "Compound interest; all rates equivalent."],
      relationship: rel,
      counterexample: "If the rate were convertible at the payment frequency, its periodic rate could be used directly.",
      transfer: {
        principle: "Work in the payment period: convert the rate to that period, then count periods.",
        unusual: L3 ? (variant === 0 ? "Payments are less frequent than interest conversion." : "The rate is a force of interest.") : "Payment and conversion frequencies differ.",
        misread: "Dividing a nominal rate by the payment frequency is right only when the two frequencies agree.",
      },
      itemFormat: "expression-selection",
      presentation: L3 ? ["frequency", "combined-topics", "hidden-structure"] : ["frequency", "combined-topics"],
      features: { multiConcept: true, unfamiliar: true },
      modelingDecisions: L3 ? 1 : undefined,
      params: { P, n, r, variant },
    });
  },
});

// ================================================================ rates of discount

const discountDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-discount-definition",
  family: "con-tvm-discount",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.discount_rates",
  secondary: ["TVM.effective_nominal"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "rate_conversion"],
  soaConcept: "What a rate of discount (effective or nominal) means for a loan, and the equivalent rate of interest.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "tvm.discount-vs-interest", reasoning: "Discount is interest paid in advance, measured as a fraction of the amount due at the end of the period." },
      { concept: level === 2 ? "tvm.nominal-discount" : "tvm.discount-vs-interest", reasoning: level === 2 ? "A nominal rate of discount $d^{(m)}$ deducts $d^{(m)}/m$ per $1/m$ of a year." : "The borrower receives $R(1 - d)$ and repays $R$: interest of $dR$ is paid on an advance of $R(1-d)$." },
      { concept: "tvm.discount-vs-interest", reasoning: "Measured on the amount advanced, the same interest is the rate of interest $i = d/(1-d) > d$." },
    ];
    const common = {
      steps,
      conditions: ["One-period loan (or compounding per period).", "No fees."],
      relationship: "$d = \\dfrac{i}{1+i},\\qquad i = \\dfrac{d}{1-d},\\qquad 1 - d = \\left(1 - \\dfrac{d^{(m)}}{m}\\right)^m$",
      counterexample: "Interest and discount rates of the same size are not equivalent: the discount rate always describes the dearer loan.",
      transfer: {
        principle: "Discount: interest as a fraction of the closing amount, paid at the start. Interest: as a fraction of the opening amount, paid at the end.",
        unusual: level === 2 ? "The rate is nominal and convertible more than once a year." : "The loan is described by what is deducted, not added.",
        misread: "A discount rate of $d$ is not an interest rate of $d$.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2 },
    };
    if (variant === 0 && level === 1) {
      const R = gridAmount(rng, 1000, 10000, 500);
      const d = gridRate(rng, 0.04, 0.1, 0.005);
      return conceptQuestion({
        ...common,
        stem: `A lender charges interest at an annual effective rate of discount of ${pc(d)}. A borrower agrees to repay ${mamt(R)} one year from now.\n\nWhich of the following describes the loan?`,
        correct: { content: `The borrower receives ${mnum(R * (1 - d))} now; interest of ${mnum(R * d)} is deducted at the start of the year.`, why: `Discount of ${pc(d)} of the repayment is taken in advance.` },
        distractors: [
          { content: `The borrower receives ${mnum(R / (1 + d))} now; interest of ${mnum(R - R / (1 + d))} is paid at the end of the year.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That treats the rate as an interest rate on the amount advanced.", stage: 0, failure: "recognition", confusedWith: "tvm.discount-vs-interest" },
          { content: `The borrower receives ${mnum(R)} now; interest of ${mnum(R * d)} is paid at the end of the year.`, misconception: "CONC_MOVED_WRONG_WAY", why: `${mamt(R)} is the amount repaid in one year, not the amount received now.`, stage: 1, failure: "interpretation" },
          { content: `The borrower receives ${mnum(R * (1 - d))} now; interest of ${mnum(R * d)} is also paid at the end of the year.`, misconception: "CONC_DOUBLE_COUNTED", why: "The interest is deducted in advance; it is not paid a second time.", stage: 1, failure: "application" },
          { content: `The borrower receives ${mnum(R * Math.exp(-d))} now; interest of ${mnum(R - R * Math.exp(-d))} is deducted at the start of the year.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That discounts at a force of interest equal to " + pc(d) + ".", stage: 0, failure: "selection" },
          { content: `The borrower receives ${mnum(R * (1 - d))} now; interest of ${mnum(R * d * (1 - d))} is deducted at the start of the year.`, misconception: "CONC_RETURN_ON_WRONG_BASE", why: "The discount is a fraction of the repayment, not of the amount received.", stage: 2, failure: "application" },
        ],
        itemFormat: "definition",
        params: { R, d, variant },
      });
    }
    if (variant === 0) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const m = rng.choice([2, 4, 12]);
      const { word, period } = FREQ[String(m)];
      return conceptQuestion({
        ...common,
        stem: `A lender charges interest at a nominal annual rate of discount of ${pc(r)} convertible ${word}.\n\nWhich of the following describes how interest is charged?`,
        correct: { content: `Interest of ${pc(r / m, 4)} of the amount due at the end of each ${period} is deducted at its start.`, why: `$d^{(${m})}/${m} = ${mpc(r / m, 4)}$ per ${period}, paid in advance.` },
        distractors: [
          { content: `Interest of ${pc(r / m, 4)} of the amount at the start of each ${period} is added at its end.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That describes a nominal rate of interest.", stage: 0, failure: "recognition", confusedWith: "tvm.nominal-vs-effective" },
          { content: `Interest of ${pc(r)} of the amount due at the end of each year is deducted at its start.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That is an annual effective rate of discount; a nominal rate is split over the year.", stage: 1, failure: "selection" },
          { content: `Interest of ${pc(r)} of the amount due at the end of each ${period} is deducted at its start.`, misconception: "RATE_ANNUAL_FOR_PERIODIC", why: `The annual figure must be divided by ${m}.`, stage: 1, failure: "application" },
          { content: `Interest of ${pc(1 - Math.pow(1 - r, 1 / m), 4)} of the amount due at the end of each ${period} is deducted at its start.`, misconception: "CONC_RELATED_TERM", why: "That treats the quoted figure as an effective rate of discount and converts it.", stage: 1, failure: "interpretation" },
        ],
        itemFormat: "definition",
        params: { r, m, variant },
      });
    }
    if (level === 1) {
      const d = gridRate(rng, 0.04, 0.1, 0.005);
      const D = lit(d);
      const truth = `1/(1-${D})-1`;
      const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
      const o = (latex: string, v: number, tail: string) => `$${latex} = ${p2(v)}$, ${tail}`;
      return conceptQuestion({
        ...common,
        stem: `A loan is made at an annual effective rate of discount of ${pc(d)}.\n\nWhich of the following gives the annual effective rate of interest on the loan?`,
        correct: { content: o(`\\dfrac{d}{1-d}`, d / (1 - d), `which exceeds ${pc(d)}`), why: "Interest $d$ per unit repaid, on an advance of $1 - d$.", check: eq(`${D}/(1-${D})`) },
        distractors: [
          { content: o("d", d, "the same as the rate of discount"), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "The same interest is measured on a smaller base, so the interest rate is larger.", check: eq(D), stage: 2, failure: "conclusion" },
          { content: o(`\\dfrac{d}{1+d}`, d / (1 + d), `which is less than ${pc(d)}`), misconception: "ALG_INVERTED_RATIO", why: "That inverts the relation $d = i/(1+i)$ in the wrong direction.", check: eq(`${D}/(1+${D})`), stage: 2, failure: "application" },
          { content: o(`-\\ln(1-d)`, -Math.log(1 - d), `which exceeds ${pc(d)}`), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is the force of interest, which lies between $d$ and $i$.", check: eq(`-log(1-${D})`), stage: 1, failure: "selection" },
          { content: o(`d(1-d)`, d * (1 - d), `which is less than ${pc(d)}`), misconception: "ALG_DIVIDE_ERROR", why: "The interest is divided by the advance $1 - d$, not multiplied by it.", check: eq(`${D}*(1-${D})`), stage: 2, failure: "application" },
        ],
        itemFormat: "interpretation",
        params: { d, variant },
      });
    }
    const r = gridRate(rng, 0.04, 0.12, 0.01);
    const m = rng.choice([2, 4, 12]);
    const R = lit(r);
    const truth = `exp(-${m}*log(1-${R}/${m}))-1`;
    const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
    const o = (latex: string, v: number) => `$${latex} = ${p2(v)}$`;
    return conceptQuestion({
      ...common,
      stem: `A loan is made at a nominal annual rate of discount of ${pc(r)} convertible ${FREQ[String(m)].word}.\n\nWhich of the following gives the annual effective rate of interest on the loan?`,
      correct: { content: o(`\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${m}} - 1`, Math.pow(1 - r / m, -m) - 1), why: `$1 + i = (1 - d^{(${m})}/${m})^{-${m}}$.`, check: eq(`(1-${R}/${m})**(-${m})-1`) },
      distractors: [
        { content: o(`\\dfrac{${R}}{1 - ${R}}`, r / (1 - r)), misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That treats the nominal rate as an effective rate of discount.", check: eq(`${R}/(1-${R})`), stage: 1, failure: "selection" },
        { content: o(`\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}} - 1`, Math.pow(1 + r / m, m) - 1), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That treats the rate as a nominal rate of interest.", check: eq(`(1+${R}/${m})**${m}-1`), stage: 0, failure: "recognition" },
        { content: o(`\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-1} - 1`, 1 / (1 - r / m) - 1), misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the effective rate of interest for one $1/${m}$ year only.`, check: eq(`(1-${R}/${m})**(-1)-1`), stage: 2, failure: "application" },
        { content: o(`1 - \\left(1 - \\tfrac{${R}}{${m}}\\right)^{${m}}`, 1 - Math.pow(1 - r / m, m)), misconception: "CONC_RELATED_TERM", why: "That is the annual effective rate of discount.", check: eq(`1-(1-${R}/${m})**${m}`), stage: 2, failure: "conclusion" },
      ],
      itemFormat: "interpretation",
      params: { r, m, variant },
    });
  },
});

const discountExpression: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-discount-expression",
  family: "con-tvm-discount",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.discount_rates",
  secondary: ["TVM.effective_nominal", "TVM.force_of_interest"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["rate_conversion", "terminology"],
  soaConcept: "Choosing the expression equivalent to a rate of discount, nominal or effective, from a rate of interest or force.",
  variants: 2,
  generate(rng, level, variant) {
    const L3 = level === 3;
    let stem: string;
    let opts: { correct: ConceptOption; distractors: ConceptOption[] };
    let ref: string;
    if (level === 1 && variant === 0) {
      const i = gridRate(rng, 0.03, 0.12, 0.005);
      const I = lit(i);
      stem = "Let $i > 0$ be an annual effective rate of interest, $v = 1/(1+i)$ and $d$ the equivalent annual effective rate of discount.\n\nWhich of the following expressions equals $d$ for every $i > 0$?";
      opts = mathOptions({ latex: "iv", probe: `${I}/(1+${I})`, why: "Interest $i$ paid at the end, discounted one year, is the discount $d$ paid at the start." }, [
        { latex: "\\dfrac{i}{1-i}", probe: `${I}/(1-${I})`, misconception: "ALG_SIGN_ERROR", why: "The denominator is $1 + i$.", stage: 1, failure: "application" },
        { latex: "i(1+i)", probe: `${I}*(1+${I})`, misconception: "ALG_DIVIDE_ERROR", why: "The interest is discounted, not accumulated.", stage: 1, failure: "application" },
        { latex: "1 - e^{-i}", probe: `1-exp(-${I})`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That treats $i$ as a force of interest.", stage: 0, failure: "selection" },
        { latex: "v", probe: `1/(1+${I})`, misconception: "CONC_RELATED_TERM", why: "$v = 1 - d$ is the present value of 1, not the discount.", stage: 0, failure: "interpretation" },
        { latex: "i", probe: I, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Discount and interest of the same size are not equivalent.", stage: 0, failure: "recognition" },
      ]);
      ref = `1-1/(1+${I})`;
    } else if (level === 1) {
      const d = gridRate(rng, 0.03, 0.12, 0.005);
      const D = lit(d);
      stem = "Let $d$ be an annual effective rate of discount and $v$ the present value of 1 payable in one year at the equivalent rate of interest.\n\nWhich of the following expressions equals $v$ for every $0 < d < 1$?";
      opts = mathOptions({ latex: "1 - d", probe: `1-${D}`, why: "Discount $d$ is deducted in advance from 1 due in a year." }, [
        { latex: "\\dfrac{1}{1+d}", probe: `1/(1+${D})`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That discounts as if $d$ were a rate of interest.", stage: 0, failure: "recognition" },
        { latex: "1 + d", probe: `1+${D}`, misconception: "CONC_MOVED_WRONG_WAY", why: "A present value is smaller than the amount due.", stage: 1, failure: "application" },
        { latex: "\\dfrac{1}{1-d}", probe: `1/(1-${D})`, misconception: "ALG_INVERTED_RATIO", why: "That is $1 + i$, the reciprocal of $v$.", stage: 1, failure: "application" },
        { latex: "e^{-d}", probe: `exp(-${D})`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That treats $d$ as a force of interest.", stage: 0, failure: "selection" },
        { latex: "1 - \\dfrac{d}{1-d}", probe: `1-${D}/(1-${D})`, misconception: "CONC_RELATED_TERM", why: "That subtracts $i$, not $d$.", stage: 1, failure: "interpretation" },
      ]);
      ref = `1/(1+${D}/(1-${D}))`;
    } else if (level === 2 && variant === 0) {
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const m = rng.choice([2, 4, 12]);
      const F = factor(i);
      stem = `The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions equals $d^{(${m})}$.`;
      opts = mathOptions({ latex: `${m}\\left[1 - (${F})^{-1/${m}}\\right]`, probe: `${m}*(1-${g(i)}**(-1/${m}))`, why: `$1 - d^{(${m})}/${m} = v^{1/${m}}$.` }, [
        { latex: `${m}\\left[(${F})^{1/${m}} - 1\\right]`, probe: `${m}*(${g(i)}**(1/${m})-1)`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: `That is $i^{(${m})}$.`, stage: 0, failure: "selection" },
        { latex: `1 - (${F})^{-1/${m}}`, probe: `1-${g(i)}**(-1/${m})`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the discount per $1/${m}$ year; multiply by ${m}.`, stage: 2, failure: "interpretation" },
        { latex: `${m}\\left[1 - (${F})^{-${m}}\\right]`, probe: `${m}*(1-${g(i)}**(-${m}))`, misconception: "ALG_ROOT_ERROR", why: "The periodic discount factor is $v^{1/m}$, not $v^m$.", stage: 1, failure: "application" },
        { latex: `\\dfrac{${lit(i)}}{${F}}`, probe: `${lit(i)}/${g(i)}`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That is the annual effective rate $d$.", stage: 2, failure: "conclusion" },
      ]);
      ref = `${m}*(1-exp(-log(${g(i)})/${m}))`;
    } else if (level === 2) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const m = rng.choice([2, 4, 12]);
      const R = lit(r);
      stem = `The nominal annual rate of discount convertible ${FREQ[String(m)].word} is ${pc(r)}.\n\nDetermine which of the following expressions equals the annual effective rate of interest.`;
      opts = mathOptions({ latex: `\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${m}} - 1`, probe: `(1-${R}/${m})**(-${m})-1`, why: `$1 + i = (1 - d^{(${m})}/${m})^{-${m}}$.` }, [
        { latex: `\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}} - 1`, probe: `(1+${R}/${m})**${m}-1`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That treats the rate as a nominal rate of interest.", stage: 0, failure: "recognition" },
        { latex: `\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-1} - 1`, probe: `(1-${R}/${m})**(-1)-1`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the interest rate per $1/${m}$ year.`, stage: 2, failure: "application" },
        { latex: `(1 - ${R})^{-1} - 1`, probe: `(1-${R})**(-1)-1`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That treats the nominal rate as an effective rate of discount.", stage: 1, failure: "selection" },
        { latex: `1 - \\left(1 - \\tfrac{${R}}{${m}}\\right)^{${m}}`, probe: `1-(1-${R}/${m})**${m}`, misconception: "CONC_RELATED_TERM", why: "That is the annual effective rate of discount.", stage: 2, failure: "conclusion" },
        { latex: `\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-1/${m}} - 1`, probe: `(1-${R}/${m})**(-1/${m})-1`, misconception: "ALG_ROOT_ERROR", why: `A year contains ${m} periods: raise to the power ${m}.`, stage: 1, failure: "application" },
      ]);
      ref = `exp(-${m}*log(1-${R}/${m}))-1`;
    } else if (variant === 0) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const [m, p] = rng.shuffle([2, 4, 12]).slice(0, 2);
      const R = lit(r);
      stem = `The nominal annual rate of discount convertible ${FREQ[String(m)].word} is ${pc(r)}.\n\nDetermine which of the following expressions equals the equivalent nominal annual rate of interest convertible ${FREQ[String(p)].word}.`;
      opts = mathOptions({ latex: `${p}\\left[\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${m}/${p}} - 1\\right]`, probe: `${p}*((1-${R}/${m})**(-${m}/${p})-1)`, why: `$(1 + i^{(${p})}/${p})^{${p}} = (1 - d^{(${m})}/${m})^{-${m}}$.` }, [
        { latex: `${p}\\left[\\left(1 + \\tfrac{${R}}{${m}}\\right)^{${m}/${p}} - 1\\right]`, probe: `${p}*((1+${R}/${m})**(${m}/${p})-1)`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That treats the given rate as a rate of interest.", stage: 0, failure: "recognition" },
        { latex: `${p}\\left[\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${p}/${m}} - 1\\right]`, probe: `${p}*((1-${R}/${m})**(-${p}/${m})-1)`, misconception: "ALG_ROOT_ERROR", why: "The exponent is inverted.", stage: 2, failure: "application" },
        { latex: `\\left(1 - \\tfrac{${R}}{${m}}\\right)^{-${m}/${p}} - 1`, probe: `(1-${R}/${m})**(-${m}/${p})-1`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the rate per $1/${p}$ year; multiply by ${p}.`, stage: 2, failure: "interpretation" },
        { latex: `\\dfrac{${R}}{1 - ${R}/${m}}`, probe: `${R}/(1-${R}/${m})`, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: `That is $i^{(${m})}$, convertible ${FREQ[String(m)].word}, not ${FREQ[String(p)].word}.`, stage: 1, failure: "selection" },
        { latex: `${p}\\left[(1 - ${R})^{-1/${p}} - 1\\right]`, probe: `${p}*((1-${R})**(-1/${p})-1)`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That treats the nominal rate as an effective rate of discount.", stage: 1, failure: "selection" },
      ]);
      ref = `${p}*(exp(-${m}/${p}*log(1-${R}/${m}))-1)`;
    } else {
      const dl = gridRate(rng, 0.03, 0.1, 0.005);
      const p = rng.choice([2, 4, 12]);
      const Dl = lit(dl);
      stem = `The force of interest is a constant ${pc(dl)}.\n\nDetermine which of the following expressions equals $d^{(${p})}$.`;
      opts = mathOptions({ latex: `${p}\\left(1 - e^{-${Dl}/${p}}\\right)`, probe: `${p}*(1-exp(-${Dl}/${p}))`, why: `$1 - d^{(${p})}/${p} = v^{1/${p}} = e^{-\\delta/${p}}$.` }, [
        { latex: `${p}\\left(e^{${Dl}/${p}} - 1\\right)`, probe: `${p}*(exp(${Dl}/${p})-1)`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: `That is $i^{(${p})}$.`, stage: 2, failure: "selection" },
        { latex: `1 - e^{-${Dl}/${p}}`, probe: `1-exp(-${Dl}/${p})`, misconception: "CONC_TVM_PERIODIC_AS_NOMINAL", why: `That is the discount per $1/${p}$ year; multiply by ${p}.`, stage: 2, failure: "interpretation" },
        { latex: `${p}\\left(1 - e^{-${p}(${Dl})}\\right)`, probe: `${p}*(1-exp(-${p}*${Dl}))`, misconception: "ALG_ROOT_ERROR", why: `A period is $1/${p}$ year, so the exponent is $\\delta/${p}$.`, stage: 1, failure: "application" },
        { latex: `${p}\\left[1 - (1 + ${Dl})^{-1/${p}}\\right]`, probe: `${p}*(1-(1+${Dl})**(-1/${p}))`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That treats the force as an annual effective rate.", stage: 0, failure: "recognition" },
        { latex: `1 - e^{-${Dl}}`, probe: `1-exp(-${Dl})`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That is the annual effective rate of discount $d$.", stage: 2, failure: "conclusion" },
      ]);
      ref = `${p}*(1-1/exp(${Dl}/${p}))`;
    }
    return conceptQuestion({
      stem,
      ...opts,
      reference: { values: [{ label: "rate", expr: ref }], description: "The required rate computed through the annual accumulation factor; each option is evaluated and compared." },
      steps: [
        { concept: "tvm.discount-vs-interest", reasoning: "Express the given rate as a one-period factor: $1 + j$ for interest, $(1 - j)^{-1}$ for discount, $e^{\\delta}$ for a force." },
        { concept: level === 1 ? "tvm.discount-vs-interest" : "tvm.nominal-discount", reasoning: "Convert to the annual factor, then to the period required (a root for a shorter period)." },
        { concept: L3 ? "tvm.nominal-vs-effective" : "tvm.discount-vs-interest", reasoning: "Read off the rate asked for; a nominal rate is $m$ times the periodic rate." },
      ],
      conditions: ["Compound interest; all rates equivalent.", level === 1 ? "The identity must hold for every rate, not only one." : "Rates as quoted."],
      relationship: "$(1 - d^{(m)}/m)^{-m} = 1 + i = (1 + i^{(p)}/p)^p = e^{\\delta}$",
      counterexample: "With $m = 1$, $d^{(1)} = d = iv$.",
      transfer: {
        principle: "Every rate is a way of writing the same annual factor; convert through it.",
        unusual: L3 ? "The given and required rates differ in type (discount vs interest, or force) and in frequency." : "Options differ in sign and exponent only.",
        misread: "$1 - d$ and $1/(1+d)$ look alike; only the first is $v$.",
      },
      itemFormat: "expression-selection",
      presentation: L3 ? ["hidden-structure", "frequency"] : level === 2 ? ["frequency"] : ["direct"],
      features: { unfamiliar: level >= 2, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { variant },
    });
  },
});

const discountStatements: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-discount-statements",
  family: "con-tvm-discount",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.discount_rates",
  secondary: ["TVM.force_of_interest", "TVM.effective_nominal"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "rate_conversion"],
  soaConcept: "Judging statements about rates of discount and their relation to interest rates and the force of interest.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.04, 0.1, 0.005);
    const I = lit(i);
    const steps = [
      { concept: "tvm.discount-vs-interest", reasoning: "$d = iv = 1 - v$: discount is interest paid in advance." },
      { concept: "tvm.nominal-discount", reasoning: "$1 - d = (1 - d^{(m)}/m)^m$; $d^{(m)}$ rises with $m$ toward $\\delta$." },
      { concept: "tvm.rate-ordering", reasoning: "$d < d^{(m)} < \\delta < i^{(m)} < i$ for $m > 1$." },
    ];
    const common = {
      steps,
      conditions: ["Positive rates, compound interest.", "$m > 1$."],
      relationship: "$d = iv,\\quad \\dfrac{1}{d} - \\dfrac{1}{i} = 1,\\quad d < d^{(m)} < \\delta < i^{(m)} < i$",
      counterexample: "At $m = 1$, $d^{(1)} = d$ and $i^{(1)} = i$.",
      transfer: {
        principle: "Judge each statement against the single annual factor all equivalent rates share.",
        unusual: "True and false statements look alike in form.",
        misread: "Nominal discount rates move with $m$ in the opposite direction to nominal interest rates.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2, multiConcept: true },
    };
    if (variant === 0) {
      const statements =
        level === 1
          ? [
              statement("I", "$d = iv$, where $v = 1/(1+i)$.", true, "Interest $i$ paid at the end, discounted one year, equals discount paid at the start.", "ALG_INVERTED_RATIO", { stage: 0, failure: "recognition", check: { expr: `${I}/(1+${I})`, op: "=", than: `1-1/(1+${I})` } }),
              statement("II", "For a fixed annual effective rate, $d^{(m)}$ decreases as $m$ increases.", false, "$d^{(m)}$ increases with $m$, toward $\\delta$.", "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", { stage: 1, failure: "application", conditionTrue: "It is true of $i^{(m)}$.", check: { expr: `12*(1-${g(i)}**(-1/12))-2*(1-${g(i)}**(-1/2))`, op: "<", than: 0 } }),
              statement("III", "Interest at a rate $d$ paid at the end of a year is equivalent to discount at the same rate $d$ deducted at the start.", false, "Discount at $d$ is equivalent to interest at $d/(1-d)$, which exceeds $d$.", "RATE_DISCOUNT_AS_INTEREST", { stage: 0, failure: "recognition", check: { expr: `1/(1+${I})`, op: "=", than: `1-${I}` } }),
            ]
          : [
              statement("I", "For $m > 1$, $d < d^{(m)} < \\delta < i^{(m)} < i$.", true, "Nominal rates move toward $\\delta$ from either side as $m$ grows.", "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", { stage: 2, failure: "connection", check: { expr: `log(${g(i)})-4*(1-${g(i)}**(-1/4))`, op: ">", than: 0 } }),
              statement("II", "$\\dfrac{1}{d} - \\dfrac{1}{i} = 1$.", true, "$1/d = (1+i)/i = 1/i + 1$.", "ALG_INVERTED_RATIO", { stage: 0, failure: "application", check: { expr: `(1+${I})/${I}-1/${I}`, op: "=", than: 1 } }),
              statement("III", "$d^{(m)} = i^{(m)}\\,v$.", false, "$d^{(m)} = i^{(m)} v^{1/m}$: the interest for $1/m$ year is discounted for $1/m$ year only.", "ALG_ROOT_ERROR", { stage: 1, failure: "application", check: { expr: `4*(1-${g(i)}**(-1/4))`, op: "=", than: `4*(${g(i)}**(1/4)-1)/${g(i)}` }, conditionTrue: "True for $m = 1$." }),
            ];
      return statementQuestion({
        ...common,
        stem: "Let $i > 0$ be an annual effective rate of interest, with equivalent rates $d$, $d^{(m)}$, $i^{(m)}$ and $\\delta$.\n\nDetermine which of the following statements are true.",
        statements,
        extra:
          level === 1
            ? [
                { keys: ["I", "II", "III"], misconception: "CONC_RELATED_TERM", why: "Accepting all three treats interest and discount rates as interchangeable.", stage: 0, failure: "recognition" },
                { keys: ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "Accepting only II misjudges both identities.", stage: 1, failure: "application" },
              ]
            : [
                { keys: ["III"], misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Accepting only III misjudges both true relationships.", stage: 0, failure: "recognition" },
                { keys: ["II", "III"], misconception: "CONC_DIRECTION_REVERSED", why: "Rejecting I reverses the ordering of nominal discount rates.", stage: 2, failure: "connection" },
              ],
        params: { i, variant },
      });
    }
    if (level === 1) {
      const d = gridRate(rng, 0.04, 0.1, 0.005);
      const D = lit(d);
      return statementQuestion({
        ...common,
        stem: `The annual effective rate of discount is ${pc(d)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The annual effective rate of interest is ${p2(d / (1 - d))}.`, true, `$i = d/(1-d) = ${p2(d / (1 - d))}$.`, "RATE_DISCOUNT_AS_INTEREST", { stage: 0, failure: "application", check: { expr: `${D}/(1-${D})`, op: "=", than: `1/(1-${D})-1` } }),
          statement("II", `The present value of 1 payable in two years is $(${lit(1 - d)})^2$.`, true, "$v = 1 - d$, so $v^2 = (1-d)^2$.", "MODEL_COMPOUND_AS_SIMPLE", { stage: 0, failure: "application", check: { expr: `(1-${D})**2`, op: "=", than: `(1+${D}/(1-${D}))**(-2)` } }),
          statement("III", `The equivalent nominal annual rate of discount convertible monthly is less than ${pc(d)}.`, false, `$d^{(12)} = ${p2(12 * (1 - Math.pow(1 - d, 1 / 12)))}$ exceeds $d$.`, "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", { stage: 1, failure: "application", check: { expr: `12*(1-(1-${D})**(1/12))`, op: "<", than: d }, conditionTrue: "It would be true of $i^{(12)}$ compared with $i$." }),
        ],
        extra: [
          { keys: ["III"], misconception: "CONC_DIRECTION_REVERSED", why: "Accepting only III misjudges both conversions.", stage: 1, failure: "application" },
          { keys: ["II"], misconception: "ALG_INVERTED_RATIO", why: "Rejecting I inverts the relationship between $d$ and $i$.", stage: 0, failure: "application" },
        ],
        params: { d, variant },
      });
    }
    const r = gridRate(rng, 0.04, 0.12, 0.01);
    const R = lit(r);
    return statementQuestion({
      ...common,
      stem: `The nominal annual rate of discount convertible quarterly is ${pc(r)}.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `The annual effective rate of discount is less than ${pc(r)}.`, true, `$d = 1 - (1 - ${R}/4)^4 = ${p2(1 - Math.pow(1 - r / 4, 4))}$.`, "RATE_NOMINAL_AS_EFFECTIVE", { stage: 1, failure: "application", check: { expr: `1-(1-${R}/4)**4`, op: "<", than: r } }),
        statement("II", `The force of interest is less than ${pc(r)}.`, false, `$\\delta = -4\\ln(1 - ${R}/4) = ${p2(-4 * Math.log(1 - r / 4))}$, above $d^{(4)}$.`, "RATE_FORCE_AS_EFFECTIVE", { stage: 2, failure: "connection", check: { expr: `-4*log(1-${R}/4)`, op: "<", than: r }, conditionTrue: "It would be true if the rate were a nominal rate of interest." }),
        statement("III", `The present value of 1 payable in six months is $1 - ${R}/2$.`, false, `Two quarters of discount compound: $(1 - ${R}/4)^2$.`, "MODEL_COMPOUND_AS_SIMPLE", { stage: 1, failure: "selection", check: { expr: `(1-${R}/4)**2`, op: "=", than: `1-${R}/2` } }),
      ],
      extra: [
        { keys: ["II", "III"], misconception: "CONC_DIRECTION_REVERSED", why: "Rejecting I and accepting II reverses the ordering of $d$, $d^{(4)}$ and $\\delta$.", stage: 2, failure: "connection" },
        { keys: ["I", "II", "III"], misconception: "CONC_RELATED_TERM", why: "Accepting all three treats the nominal rate as if every related rate equalled it.", stage: 0, failure: "recognition" },
      ],
      params: { r, variant },
    });
  },
});

// ================================================================ force of interest

/** A text diagnosis option whose proposed value is checked against the truth. */
type DiagOpt = [content: string, misconception: MisconceptionId, why: string, expr: string, stage: number, failure: ConceptFailure, conditionTrue?: string];
const diagnosis = (truth: string, correct: [content: string, why: string, expr: string], ds: DiagOpt[]): { correct: ConceptOption; distractors: ConceptOption[] } => ({
  correct: { content: correct[0], why: correct[1], check: { expr: correct[2], op: "=", than: truth } },
  distractors: ds.map(([content, misconception, why, expr, stage, failure, conditionTrue]) => ({
    content,
    misconception,
    why,
    check: { expr, op: "=", than: truth },
    stage,
    failure,
    ...(conditionTrue ? { conditionTrue } : {}),
  })),
});

const forceInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-force-interpretation",
  family: "con-tvm-force",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.force_of_interest",
  secondary: ["TVM.variable_force", "TVM.discount_rates"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "What the force of interest measures, and what a given force implies (and does not imply).",
  variants: 2,
  generate(rng, level, variant) {
    const del = gridRate(rng, 0.03, 0.09, 0.005);
    const Dl = lit(del);
    const steps = [
      { concept: "tvm.force-of-interest", reasoning: "$\\delta_t = A'(t)/A(t)$: the instantaneous growth rate per unit of fund, on an annual basis." },
      { concept: "tvm.force-of-interest", reasoning: "Over an interval, the fund grows by $\\exp(\\int \\delta_s\\,ds)$; with a constant force, $1 + i = e^{\\delta}$." },
      { concept: "tvm.rate-ordering", reasoning: "Hence $d < \\delta < i$: the force is neither the effective rate of interest nor of discount." },
    ];
    const common = {
      steps,
      conditions: ["Fund value changes only through interest.", variant === 1 ? "The force is constant." : "The force may vary over time."],
      relationship: "$\\delta_t = \\dfrac{A'(t)}{A(t)},\\qquad 1 + i = e^{\\delta},\\qquad 1 - d = e^{-\\delta}$",
      counterexample: "Only over an infinitesimal interval does the force equal the rate of growth per unit.",
      transfer: {
        principle: "A force is an instantaneous rate per unit of fund; turn it into a factor by exponentiating its integral.",
        unusual: variant === 1 ? "The rate given is a force, not an effective rate." : "The question asks what a value of the force tells you.",
        misread: "A force of 5% does not mean 5% is earned over the next year.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2 },
      params: { del, variant },
    };
    if (variant === 0 && level === 1) {
      return conceptQuestion({
        ...common,
        stem: "A fund has amount function $A(t)$. Which of the following describes the force of interest $\\delta_t = A'(t)/A(t)$?",
        correct: { content: "The instantaneous rate of growth of the fund at time $t$ per unit in the fund, on an annual basis", why: "Dividing the rate of change by the fund size gives a rate per unit." },
        distractors: [
          { content: "The amount by which the fund is growing per year at time $t$", misconception: "CONC_TVM_DERIVATIVE_AS_FORCE", why: "That is $A'(t)$ itself, before dividing by $A(t)$.", stage: 0, failure: "interpretation" },
          { content: "The effective rate of interest earned during the year ending at time $t$", misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That is $A(t)/A(t-1) - 1$, a rate over a whole year.", stage: 1, failure: "selection", confusedWith: "tvm.amount-function" },
          { content: "The instantaneous rate of growth at time $t$ per unit originally invested", misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The base is the current fund $A(t)$, not $A(0)$.", stage: 0, failure: "application" },
          { content: "The effective rate of discount for the year ending at time $t$", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That is $1 - A(t-1)/A(t)$.", stage: 1, failure: "selection" },
          { content: "The average annual rate of growth of the fund from time 0 to time $t$", misconception: "CONC_TVM_AVERAGE_RATE", why: "That would be $\\frac{1}{t}\\ln[A(t)/A(0)]$, an average of the force over $[0, t]$.", stage: 1, failure: "interpretation" },
        ],
        itemFormat: "interpretation",
      });
    }
    if (variant === 0) {
      const F = gridAmount(rng, 1000, 9000, 500);
      return conceptQuestion({
        ...common,
        stem: `The force of interest of a fund varies over time. At time 3 the fund has value ${mamt(F)} and the force of interest is ${pc(del)}.\n\nWhich of the following must be true?`,
        correct: { content: `At time 3 the fund is growing at a rate of ${mnum(F * del)} per year.`, why: `$A'(3) = \\delta_3 A(3) = ${Dl}(${mamt(F)})$.`, check: { expr: `${lit(F)}*${Dl}`, op: "=", than: F * del } },
        distractors: [
          { content: `The fund will earn ${pc(del)} effective interest between time 3 and time 4.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "The effective rate over the year depends on the force throughout it, and even a constant force gives $e^{\\delta} - 1$.", stage: 1, failure: "selection" },
          { content: `At time 3 the fund is growing at a rate of ${Dl} per year.`, misconception: "CONC_TVM_DERIVATIVE_AS_FORCE", why: "The force is a rate per unit of fund; the growth in amount is $\\delta_3 A(3)$.", stage: 0, failure: "interpretation" },
          { content: `The fund's value at time 4 will be ${mamt(F)}$e^{${Dl}}$.`, misconception: "MODEL_CONSTANT_FORCE", why: "That holds only if the force stays at " + pc(del) + " for the whole year.", stage: 1, failure: "application", conditionTrue: "True if the force were constant from time 3 to time 4." },
          { content: `The fund grew by a factor of $e^{3(${Dl})}$ from time 0 to time 3.`, misconception: "CONC_TVM_FORCE_NOT_INTEGRATED", why: "Growth over $[0, 3]$ depends on the force at every time in the interval, not on its value at time 3.", stage: 1, failure: "connection" },
          { content: `The average force of interest from time 0 to time 3 is ${pc(del)}.`, misconception: "CONC_TVM_AVERAGE_RATE", why: "The force at one time says nothing about its average over an interval.", stage: 2, failure: "conclusion" },
        ],
        itemFormat: "interpretation",
      });
    }
    const target = level === 1 ? `exp(${Dl})-1` : `1-exp(-${Dl})`;
    const eq = (expr: string) => ({ expr, op: "=" as const, than: target });
    const o = (latex: string, v: number) => `$${latex} = ${p2(v)}$`;
    return conceptQuestion({
      ...common,
      stem: `A fund grows at a constant force of interest of ${pc(del)}.\n\nWhich of the following gives the annual effective rate of ${level === 1 ? "interest" : "discount"}?`,
      ...(level === 1
        ? {
            correct: { content: o(`e^{${Dl}} - 1`, Math.exp(del) - 1), why: "1 grows to $e^{\\delta}$ in a year.", check: eq(`exp(${Dl})-1`) },
            distractors: [
              { content: o(`\\delta`, del), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "Continuous compounding at $\\delta$ produces more than $\\delta$ in a year.", check: eq(Dl), stage: 1, failure: "selection" },
              { content: o(`\\ln(1 + ${Dl})`, Math.log(1 + del)), misconception: "ALG_INVERTED_RATIO", why: "That inverts $\\delta = \\ln(1+i)$.", check: eq(`log(1+${Dl})`), stage: 1, failure: "application" },
              { content: o(`\\dfrac{${Dl}}{1 - ${Dl}}`, del / (1 - del)), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That treats the force as an effective rate of discount.", check: eq(`${Dl}/(1-${Dl})`), stage: 0, failure: "recognition" },
              { content: o(`\\left(1 + \\tfrac{${Dl}}{12}\\right)^{12} - 1`, Math.pow(1 + del / 12, 12) - 1), misconception: "CONC_RELATED_TERM", why: "That is monthly conversion of a nominal rate, not continuous compounding.", check: eq(`(1+${Dl}/12)**12-1`), stage: 1, failure: "interpretation" },
            ],
          }
        : {
            correct: { content: o(`1 - e^{-${Dl}}`, 1 - Math.exp(-del)), why: "$1 - d = v = e^{-\\delta}$.", check: eq(`1-exp(-${Dl})`) },
            distractors: [
              { content: o(`\\delta`, del), misconception: "CONC_TVM_FORCE_AS_DISCOUNT", why: "The force exceeds $d$.", check: eq(Dl), stage: 1, failure: "selection" },
              { content: o(`e^{${Dl}} - 1`, Math.exp(del) - 1), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That is the effective rate of interest.", check: eq(`exp(${Dl})-1`), stage: 2, failure: "conclusion" },
              { content: o(`\\dfrac{${Dl}}{1 + ${Dl}}`, del / (1 + del)), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That treats the force as an effective rate of interest and converts it.", check: eq(`${Dl}/(1+${Dl})`), stage: 1, failure: "selection" },
              { content: o(`12\\left(1 - e^{-${Dl}/12}\\right)`, 12 * (1 - Math.exp(-del / 12))), misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "That is $d^{(12)}$, a nominal rate convertible monthly.", check: eq(`12*(1-exp(-${Dl}/12))`), stage: 2, failure: "interpretation" },
            ],
          }),
      itemFormat: "interpretation",
    });
  },
});

const rateOrdering: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-rate-ordering",
  family: "con-tvm-force",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.force_of_interest",
  secondary: ["TVM.effective_nominal", "TVM.discount_rates"],
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "rate_conversion"],
  soaConcept: "Ordering equivalent rates of interest, discount and the force of interest, and how nominal rates move with frequency.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.04, 0.12, 0.005);
    const G = g(i);
    const im = (m: number) => `${m}*(${G}**(1/${m})-1)`;
    const dm = (m: number) => `${m}*(1-${G}**(-1/${m}))`;
    const del = `log(${G})`;
    const dd = `(1-1/${G})`;
    const steps = [
      { concept: "tvm.rate-ordering", reasoning: "All the rates describe the same annual factor $1 + i$." },
      { concept: "tvm.nominal-vs-effective", reasoning: "Nominal interest rates fall toward $\\delta$ as conversion becomes more frequent; nominal discount rates rise toward it." },
      { concept: "tvm.discount-vs-interest", reasoning: "Every discount rate lies below every interest rate: $d < d^{(m)} < \\delta < i^{(m)} < i$." },
    ];
    const common = {
      steps,
      conditions: ["$i > 0$; all rates equivalent.", "$m > 1$."],
      relationship: "$d < d^{(m)} < \\delta < i^{(m)} < i$",
      counterexample: "As $i \\to 0$ all the rates come together; the ordering is strict for every positive $i$.",
      transfer: {
        principle: "Picture the rates on a line: discount rates below $\\delta$, interest rates above, nominal ones closer to $\\delta$.",
        unusual: "Several equivalent rates are compared at once.",
        misread: "More frequent conversion raises the effective rate for a fixed nominal rate, but lowers the nominal rate for a fixed effective rate.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2, multiConcept: true },
      params: { i, variant },
    };
    if (level === 1 && variant === 0) {
      const lt = (a: string, b: string): TruthCheck => ({ expr: `${a}-${b}`, op: "<", than: 0 });
      return conceptQuestion({
        ...common,
        stem: "For a positive annual effective rate of interest $i$, with equivalent rates $d$, $d^{(12)}$, $i^{(12)}$ and $\\delta$, which of the following orderings is correct?",
        ...mathOptions({ latex: "d < d^{(12)} < \\delta < i^{(12)} < i", check: lt(dm(12), del), why: "Discount rates lie below $\\delta$ and rise toward it; interest rates lie above and fall toward it." }, [
          { latex: "i < i^{(12)} < \\delta < d^{(12)} < d", check: lt(`${G}-1`, im(12)), misconception: "CONC_DIRECTION_REVERSED", why: "The whole ordering is reversed.", stage: 2, failure: "application" },
          { latex: "d^{(12)} < d < \\delta < i < i^{(12)}", check: lt(`${G}-1`, im(12)), misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "For a fixed effective rate, the nominal rate convertible monthly is smaller, not larger.", stage: 1, failure: "selection" },
          { latex: "d < d^{(12)} < i^{(12)} < \\delta < i", check: lt(im(12), del), misconception: "RATE_FORCE_AS_EFFECTIVE", why: "$\\delta$ is the limit of $i^{(m)}$, so it lies below every $i^{(m)}$.", stage: 1, failure: "connection" },
          { latex: "d^{(12)} < d < \\delta < i^{(12)} < i", check: lt(dm(12), dd), misconception: "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", why: "$d^{(12)}$ exceeds $d$.", stage: 1, failure: "application" },
          { latex: "d = d^{(12)} < \\delta < i^{(12)} = i", check: { expr: dm(12), op: "=", than: dd }, misconception: "CONC_RELATED_TERM", why: "Equivalent rates give the same factor, not the same number.", stage: 0, failure: "recognition" },
        ]),
        itemFormat: "comparative-statics",
      });
    }
    if (level === 1) {
      return conceptQuestion({
        ...common,
        stem: "The annual effective rate of interest $i > 0$ is fixed. Which of the following describes how $i^{(m)}$ and $d^{(m)}$ change as $m$ increases?",
        correct: { content: "$i^{(m)}$ decreases and $d^{(m)}$ increases; both approach $\\delta$.", why: "More frequent conversion needs a smaller nominal interest rate (and a larger nominal discount rate) for the same annual factor." },
        distractors: [
          { content: "$i^{(m)}$ increases and $d^{(m)}$ decreases; both move away from $\\delta$.", misconception: "CONC_DIRECTION_REVERSED", why: "Both directions are reversed.", stage: 1, failure: "application" },
          { content: "$i^{(m)}$ and $d^{(m)}$ both decrease, approaching $\\delta$.", misconception: "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", why: "$d^{(m)}$ starts below $\\delta$ and rises toward it.", stage: 1, failure: "application" },
          { content: "$i^{(m)}$ and $d^{(m)}$ do not change, since $i$ is fixed.", misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "Fixed $i$ fixes the annual factor; the nominal figures depend on $m$.", stage: 0, failure: "recognition" },
          { content: "$i^{(m)}$ decreases toward $d$ and $d^{(m)}$ increases toward $i$.", misconception: "CONC_RELATED_TERM", why: "Both limits are $\\delta$, which lies strictly between $d$ and $i$.", stage: 2, failure: "connection" },
          { content: "$i^{(m)}$ decreases toward 0 and $d^{(m)}$ increases toward $d$.", misconception: "RATE_DIVIDED_EFFECTIVE", why: "$i^{(m)}$ is not $i/m$; it tends to $\\delta > 0$.", stage: 1, failure: "selection" },
        ],
        itemFormat: "comparative-statics",
      });
    }
    if (variant === 0) {
      const gt = (a: string, b: string): TruthCheck => ({ expr: `${a}-${b}`, op: ">", than: 0 });
      return conceptQuestion({
        ...common,
        stem: `The annual effective rate of interest is ${pc(i)}.\n\nWhich of the following is true?`,
        correct: { content: "$i^{(4)}$ exceeds $i^{(12)}$.", why: "Nominal interest rates fall as conversion becomes more frequent.", check: gt(im(4), im(12)) },
        distractors: [
          { content: "$d^{(4)}$ exceeds $d^{(12)}$.", misconception: "CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION", why: "Nominal discount rates rise with $m$.", check: gt(dm(4), dm(12)), stage: 1, failure: "application" },
          { content: "$\\delta$ exceeds $i^{(12)}$.", misconception: "RATE_FORCE_AS_EFFECTIVE", why: "$\\delta$ is the lower limit of $i^{(m)}$.", check: gt(del, im(12)), stage: 2, failure: "connection" },
          { content: "$i^{(12)}$ exceeds $i$.", misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "Monthly compounding of $i^{(12)}$ reproduces $i$, so $i^{(12)} < i$.", check: gt(im(12), `(${G}-1)`), stage: 1, failure: "selection" },
          { content: "$d$ exceeds $d^{(4)}$.", misconception: "CONC_DIRECTION_REVERSED", why: "$d^{(4)} > d$.", check: gt(dd, dm(4)), stage: 1, failure: "application" },
          { content: "$d^{(12)}$ exceeds $i^{(4)}$.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Every discount rate is below $\\delta$ and every interest rate above it.", check: gt(dm(12), im(4)), stage: 2, failure: "conclusion" },
        ],
        itemFormat: "comparative-statics",
      });
    }
    const r = gridRate(rng, 0.04, 0.12, 0.01);
    const R = lit(r);
    const iB2 = `(${R}/(1-${R}/2))`;
    const effB = `((1-${R}/2)**(-2)-1)`;
    const delB = `(-2*log(1-${R}/2))`;
    return conceptQuestion({
      ...common,
      stem: `Account A credits interest at $i^{(2)} = ${mpc(r)}$. Account B credits interest at a nominal annual rate of discount $d^{(2)} = ${mpc(r)}$.\n\nWhich of the following is true?`,
      correct: { content: `B is equivalent to a nominal rate of interest convertible semiannually above ${pc(r)}, so B grows faster.`, why: `$i^{(2)}/2 = (d^{(2)}/2)/(1 - d^{(2)}/2)$, giving $i^{(2)} = ${p2(r / (1 - r / 2))}$.`, check: { expr: `${iB2}-${R}`, op: ">", than: 0 } },
      distractors: [
        { content: "Neither grows faster: the two nominal rates are equal, so the accounts are equivalent.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "A discount rate of $r$ is a dearer rate than an interest rate of $r$.", check: { expr: iB2, op: "=", than: R }, stage: 0, failure: "recognition" },
        { content: `A grows faster: interest is earned on a larger base than discount, so A's rate is the higher.`, misconception: "CONC_DIRECTION_REVERSED", why: "Discount is measured on the closing amount, so the same figure is a larger rate on the opening amount.", check: { expr: `${R}-${iB2}`, op: ">", than: 0 }, stage: 2, failure: "application" },
        { content: `B grows faster: its annual effective rate is $${R}/(1-${R}) = ${p2(r / (1 - r))}$.`, misconception: "CONC_TVM_FREQUENCY_MISMATCH", why: "The conversion is semiannual: $1 + i = (1 - ${R}/2)^{-2}$.", check: { expr: effB, op: "=", than: `${R}/(1-${R})` }, stage: 1, failure: "application" },
        { content: `A grows faster: B's force of interest is below ${pc(r)}, while A's is above it.`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: `B's force is $-2\\ln(1 - ${R}/2) = ${p2(-2 * Math.log(1 - r / 2))}$, above ${pc(r)}.`, check: { expr: `${R}-${delB}`, op: ">", than: 0 }, stage: 2, failure: "connection" },
      ],
      itemFormat: "comparative-statics",
      params: { i, r, variant },
    });
  },
});

const forceDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-force-diagnosis",
  family: "con-tvm-force",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.force_of_interest",
  secondary: ["TVM.effective_nominal", "TVM.variable_force"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "rate_conversion"],
  soaConcept: "Diagnosing the misuse of a force of interest in a proposed accumulation, discount or rate conversion.",
  variants: 2,
  generate(rng, level, variant) {
    const X = gridAmount(rng, 1000, 9000, 500);
    const XS = mamt(X);
    const x = lit(X);
    const del = gridRate(rng, 0.03, 0.09, 0.005);
    const Dl = lit(del);
    const n = rng.int(4, 12);
    let stem: string;
    let opts: { correct: ConceptOption; distractors: ConceptOption[] };
    const ask = (what: string, latex: string, value: number) => `${what}\n\n$$${latex} = ${mnum(value, value < 1 ? 4 : 2)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
    if (level === 1 && variant === 0) {
      stem = ask(`A deposit of ${XS} earns interest at a constant force of interest of ${pc(del)}. A candidate calculates its accumulated value after ${n} years as`, `${XS}(1 + ${Dl})^{${n}}`, X * Math.pow(1 + del, n));
      opts = diagnosis(`${x}*exp(${Dl}*${n})`, [`The force was used as an effective rate; the value is $${XS}e^{${Dl}(${n})}$.`, `Under a constant force, 1 grows to $e^{\\delta t}$.`, `${x}*exp(${Dl})**${n}`], [
        ["The calculation is correct, because a force of interest is an annual rate.", "RATE_FORCE_AS_EFFECTIVE", "A force is an instantaneous rate; the annual effective rate is $e^{\\delta} - 1$.", `${x}*(1+${Dl})**${n}`, 0, "recognition"],
        [`Interest at a force accrues linearly; the value is $${XS}(1 + ${Dl}\\cdot ${n})$.`, "MODEL_COMPOUND_AS_SIMPLE", "Continuous compounding is exponential.", `${x}*(1+${Dl}*${n})`, 1, "selection"],
        [`The force acts as a discount rate; the value is $${XS}(1 - ${Dl})^{-${n}}$.`, "RATE_DISCOUNT_AS_INTEREST", "A force is neither an effective interest nor discount rate.", `${x}*(1-${Dl})**(-${n})`, 0, "selection"],
        [`The force applies once over the term; the value is $${XS}e^{${Dl}}$.`, "CONC_TVM_FORCE_NOT_INTEGRATED", `The exponent is the integral of the force over ${n} years.`, `${x}*exp(${Dl})`, 1, "application"],
      ]);
    } else if (level === 1) {
      stem = ask(`A payment of ${XS} is due in ${n} years. The force of interest is a constant ${pc(del)}. A candidate calculates its present value as`, `${XS}(1 - ${Dl})^{${n}}`, X * Math.pow(1 - del, n));
      opts = diagnosis(`${x}*exp(-${Dl}*${n})`, [`The force was used as a discount rate; the value is $${XS}e^{-${Dl}(${n})}$.`, "$v^t = e^{-\\delta t}$.", `${x}/exp(${Dl}*${n})`], [
        ["The calculation is correct, because the force is deducted each year.", "CONC_TVM_FORCE_AS_DISCOUNT", "$1 - \\delta < e^{-\\delta}$: the force overstates the annual discount.", `${x}*(1-${Dl})**${n}`, 0, "recognition"],
        [`The force acts as an effective rate; the value is $${XS}(1 + ${Dl})^{-${n}}$.`, "RATE_FORCE_AS_EFFECTIVE", "The effective rate is $e^{\\delta} - 1$, not $\\delta$.", `${x}*(1+${Dl})**(-${n})`, 0, "selection"],
        [`Discounting at a force is linear; the value is $${XS}(1 - ${Dl}\\cdot ${n})$.`, "MODEL_COMPOUND_AS_SIMPLE", "Continuous discounting is exponential.", `${x}*(1-${Dl}*${n})`, 1, "selection"],
        [`The payment must be accumulated; the value is $${XS}e^{${Dl}(${n})}$.`, "CONC_MOVED_WRONG_WAY", "A present value moves the payment back in time.", `${x}*exp(${Dl}*${n})`, 1, "application"],
      ]);
    } else if (level === 2 && variant === 0) {
      stem = ask(`A fund grows at a constant force of interest of ${pc(del)}. A candidate calculates the time for the fund to double as`, `\\frac{\\ln 2}{\\ln(1 + ${Dl})}`, Math.log(2) / Math.log(1 + del));
      opts = diagnosis(`log(2)/${Dl}`, [`The force was used as an effective rate; the time is $\\ln 2/${Dl}$.`, "$e^{\\delta t} = 2$ gives $t = \\ln 2/\\delta$.", `log(2)/log(exp(${Dl}))`], [
        [`The calculation is correct; the time is $\\ln 2/\\ln(1 + ${Dl})$.`, "RATE_FORCE_AS_EFFECTIVE", "$\\ln(1 + \\delta)$ would apply if " + pc(del) + " were the effective rate.", `log(2)/log(1+${Dl})`, 0, "recognition", "Correct if the annual effective rate were " + pc(del) + "."],
        [`Growth at a force is linear; the time is $1/${Dl}$.`, "MODEL_COMPOUND_AS_SIMPLE", "Doubling under simple growth, not continuous compounding.", `1/${Dl}`, 1, "selection"],
        [`The denominator is the effective rate; the time is $\\ln 2/(e^{${Dl}} - 1)$.`, "CONC_RELATED_TERM", "The log of the annual factor is $\\delta$, not $i$.", `log(2)/(exp(${Dl})-1)`, 1, "connection"],
        [`The denominator is the discount rate; the time is $\\ln 2/(1 - e^{-${Dl}})$.`, "RATE_DISCOUNT_AS_INTEREST", "The rate of discount plays no role in doubling time.", `log(2)/(1-exp(-${Dl}))`, 1, "selection"],
        [`The ratio is inverted; the time is $\\ln(1 + ${Dl})/\\ln 2$.`, "ALG_INVERTED_RATIO", "Solving $e^{\\delta t} = 2$ puts $\\ln 2$ in the numerator.", `log(1+${Dl})/log(2)`, 2, "application"],
      ]);
    } else if (level === 2) {
      const r = gridRate(rng, 0.04, 0.12, 0.01);
      const m = rng.choice([2, 4, 12]);
      const R = lit(r);
      const pre = "The candidate's value is";
      stem = `Interest is credited at a nominal annual rate of ${pc(r)} convertible ${FREQ[String(m)].word}. A candidate states that the equivalent constant force of interest is also ${pc(r)}.\n\nWhich of the following correctly describes the candidate's statement?`;
      opts = diagnosis(`log((1+${R}/${m})**${m})`, [`${pre} wrong; $\\delta = ${m}\\ln(1 + ${R}/${m})$.`, `$e^{\\delta} = (1 + ${R}/${m})^{${m}}$; $\\delta = ${p2(m * Math.log(1 + r / m))}$.`, `${m}*log(1+${R}/${m})`], [
        [`${pre} right; a nominal rate equals the force of interest.`, "CONC_RELATED_TERM", "$\\delta$ is the limit of $i^{(m)}$ as $m \\to \\infty$, below every $i^{(m)}$.", R, 0, "recognition"],
        [`${pre} wrong; $\\delta = \\ln(1 + ${R})$.`, "RATE_NOMINAL_AS_EFFECTIVE", "That treats the nominal rate as annual effective.", `log(1+${R})`, 1, "selection"],
        [`${pre} wrong; $\\delta = \\ln(1 + ${R}/${m})$.`, "CONC_TVM_PERIODIC_AS_NOMINAL", `That is the force accumulated over $1/${m}$ year; multiply by ${m}.`, `log(1+${R}/${m})`, 2, "application"],
        [`${pre} wrong; $\\delta = ${m}(e^{${R}/${m}} - 1)$.`, "ALG_INVERTED_RATIO", "That applies the inverse relation.", `${m}*(exp(${R}/${m})-1)`, 2, "application"],
      ]);
    } else if (variant === 0) {
      const m = rng.choice([2, 4, 12]);
      const pre = "The candidate's value is";
      stem = ask(`The force of interest is a constant ${pc(del)}. A candidate calculates the equivalent nominal annual rate of interest convertible ${FREQ[String(m)].word} as`, `i^{(${m})} = ${m}\\left(e^{${Dl}} - 1\\right)`, m * (Math.exp(del) - 1));
      opts = diagnosis(`${m}*(exp(${Dl}/${m})-1)`, [`${pre} wrong; $i^{(${m})} = ${m}(e^{${Dl}/${m}} - 1)$.`, `Over $1/${m}$ year 1 grows to $e^{\\delta/${m}}$.`, `${m}*(exp(${Dl})**(1/${m})-1)`], [
        [`${pre} right; $e^{${Dl}} - 1$ is the rate for each period.`, "CONC_TVM_FREQUENCY_MISMATCH", "$e^{\\delta} - 1$ is the annual rate, not the rate per $1/m$ year.", `${m}*(exp(${Dl})-1)`, 1, "selection"],
        [`${pre} wrong; $i^{(${m})} = ${m}(e^{${m}(${Dl})} - 1)$.`, "ALG_ROOT_ERROR", `A period is $1/${m}$ year, so the exponent is $\\delta/${m}$.`, `${m}*(exp(${m}*${Dl})-1)`, 1, "application"],
        [`${pre} wrong; $i^{(${m})} = e^{${Dl}/${m}} - 1$.`, "CONC_TVM_PERIODIC_AS_NOMINAL", `That is the periodic rate; the nominal rate is ${m} times it.`, `exp(${Dl}/${m})-1`, 2, "interpretation"],
        [`${pre} wrong; $i^{(${m})} = ${m}(1 - e^{-${Dl}/${m}})$.`, "RATE_DISCOUNT_AS_INTEREST", `That is $d^{(${m})}$.`, `${m}*(1-exp(-${Dl}/${m}))`, 2, "selection"],
        [`${pre} wrong; $i^{(${m})} = ${Dl}$, the force itself.`, "RATE_FORCE_AS_EFFECTIVE", "The force is the limit of $i^{(m)}$, below every finite-$m$ value.", Dl, 0, "recognition"],
      ]);
    } else {
      const d1 = gridRate(rng, 0.02, 0.06, 0.005);
      const d2 = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (y) => Math.abs(y - d1) >= 0.015);
      const N = rng.int(6, 12);
      const k = drawUntil(() => rng.int(2, N - 2), (y) => 2 * y !== N);
      const [A, B] = [lit(d1), lit(d2)];
      const truth = `${x}*exp(-(${A}*${k}+${B}*${N - k}))`;
      stem = ask(`A payment of ${XS} is due at time ${N}. The force of interest is ${pc(d1)} for $0 \\le t < ${k}$ and ${pc(d2)} for $t \\ge ${k}$. A candidate calculates the present value of the payment as`, `${XS}\\,e^{-${N}(${A} + ${B})/2}`, X * Math.exp((-N * (d1 + d2)) / 2));
      opts = diagnosis(truth, [`Each force must be weighted by its time; the value is $${XS}e^{-(${k}(${A}) + ${N - k}(${B}))}$.`, `The exponent is $\\int_0^{${N}} \\delta_t\\,dt = ${k}(${A}) + ${N - k}(${B})$.`, `${x}*exp(-${A}*${k})*exp(-${B}*${N - k})`], [
        ["The calculation is correct; the average of the two forces applies over the whole term.", "CONC_TVM_AVERAGE_RATE", `The forces apply for ${k} and ${N - k} years, not equal periods.`, `${x}*exp(-${N}*(${A}+${B})/2)`, 1, "connection", `Correct if the change were at time ${N / 2}.`],
        [`The later force applies throughout; the value is $${XS}e^{-${N}(${B})}$.`, "CONC_TVM_RATE_CHANGE_RETRO", `${pc(d2)} applies only from time ${k}.`, `${x}*exp(-${N}*${B})`, 2, "application"],
        [`Forces act as effective rates; the value is $${XS}(1 + ${A})^{-${k}}(1 + ${B})^{-${N - k}}$.`, "RATE_FORCE_AS_EFFECTIVE", "Forces are exponentiated, not used as effective rates.", `${x}*(1+${A})**(-${k})*(1+${B})**(-${N - k})`, 0, "recognition"],
        [`The weights are reversed; the value is $${XS}e^{-(${k}(${B}) + ${N - k}(${A}))}$.`, "ALLOC_SWAPPED", "Each force must be paired with its own interval.", `${x}*exp(-(${B}*${k}+${A}*${N - k}))`, 2, "application"],
        [`The payment must be accumulated; the value is $${XS}e^{${k}(${A}) + ${N - k}(${B})}$.`, "CONC_MOVED_WRONG_WAY", "A present value discounts.", `${x}*exp(${A}*${k}+${B}*${N - k})`, 1, "application"],
      ]);
    }
    const L3 = level === 3;
    return conceptQuestion({
      stem,
      ...opts,
      reference: { description: "The correct value computed from $e^{\\pm\\int\\delta}$; each option's proposed result is evaluated and compared with it." },
      steps: [
        { concept: "tvm.force-of-interest", reasoning: "A force accumulates as $e^{\\int \\delta}$; it is not an effective rate of interest or discount." },
        { concept: L3 && variant === 1 ? "tvm.variable-force" : "tvm.force-of-interest", reasoning: L3 && variant === 1 ? "With a piecewise force, integrate piece by piece: each force times the length of its own interval." : "Over $t$ years at constant $\\delta$, the factor is $e^{\\delta t}$; per $1/m$ year it is $e^{\\delta/m}$." },
        { concept: L3 && variant === 0 ? "tvm.nominal-vs-effective" : "tvm.present-value", reasoning: L3 && variant === 0 ? "A nominal rate is $m$ times the effective rate per $1/m$ year." : "Apply the factor in the right direction: accumulate forward, discount back." },
        ...(L3 ? [{ concept: "tvm.rate-ordering", reasoning: "Check the result against $d^{(m)} < \\delta < i^{(m)}$." }] : []),
      ],
      conditions: [L3 && variant === 1 ? "The force is constant on each piece." : "The force of interest is constant.", "No other cash flows."],
      relationship: "$a(t) = e^{\\int_0^t \\delta_s\\,ds}$; constant force: $1 + i = e^{\\delta}$, $1 + i^{(m)}/m = e^{\\delta/m}$",
      counterexample: "For small $\\delta$, $(1 + \\delta)^n$ and $e^{\\delta n}$ are close, but they are not equal.",
      transfer: {
        principle: "Exponentiate the integrated force; never insert a force where an effective rate belongs.",
        unusual: "You judge a worked calculation.",
        misread: "A force looks like an annual rate but is instantaneous.",
      },
      itemFormat: "error-diagnosis",
      presentation: L3 ? ["hidden-structure", "indirect-wording"] : level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level >= 2, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { X, del, n, variant },
    });
  },
});

// ================================================================ inflation and real rates

const realInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-real-interpretation",
  family: "con-tvm-real",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.inflation_real",
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "What the real rate measures, its exact form, and the nominal return on an indexed investment.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "tvm.real-rate", reasoning: "Money grows by $1 + i$ a year; prices grow by $1 + r$." },
      { concept: "tvm.real-rate", reasoning: "Purchasing power grows by $(1+i)/(1+r)$: the real rate is $(1+i)/(1+r) - 1 = (i - r)/(1 + r)$." },
      { concept: "tvm.indexed-payments", reasoning: "Real rates go with amounts in today's money; nominal rates with money amounts." },
    ];
    const common = {
      steps,
      conditions: ["Constant annual rates of interest and inflation.", "No taxes."],
      relationship: "$1 + i_{real} = \\dfrac{1 + i}{1 + r}$",
      counterexample: "With $r = 0$ the real and nominal rates coincide.",
      transfer: {
        principle: "Divide accumulation factors, do not subtract rates; then ask whether the amounts are money or purchasing power.",
        unusual: variant === 1 && level === 2 ? "The real rate is given and the nominal return is asked for." : "A computed rate must be interpreted.",
        misread: "A real rate describes purchasing power, not the number of dollars.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2 },
    };
    if (variant === 0) {
      const r = gridRate(rng, 0.02, 0.06, 0.005);
      const i = level === 1 ? Number((r + gridRate(rng, 0.02, 0.05, 0.005)).toFixed(4)) : Number((r - gridRate(rng, 0.01, 0.02, 0.005)).toFixed(4));
      const x = (1 + i) / (1 + r) - 1;
      const X = p2(Math.abs(x)).replace("\\%", "%");
      return conceptQuestion({
        ...common,
        stem: `An investment earns an annual effective rate of ${pc(i)}, and prices rise by ${pc(r)} a year. A candidate calculates\n\n$$\\frac{${factor(i)}}{${factor(r)}} - 1 = ${p2(x)}.$$\n\nWhich of the following describes this quantity?`,
        ...(level === 1
          ? {
              correct: { content: "The annual rate at which the investment's purchasing power grows", why: "Money grows by $1+i$ while prices grow by $1+r$; the ratio measures goods bought." },
              distractors: [
                { content: "The annual rate at which prices rise", misconception: "CONC_RELATED_TERM", why: `Prices rise at ${pc(r)}, the inflation rate.`, stage: 0, failure: "interpretation", confusedWith: "tvm.real-rate" },
                { content: "The annual rate at which the investment's money value grows", misconception: "CONC_TVM_REAL_AS_MONEY_GROWTH", why: `The money value grows at ${pc(i)}.`, stage: 1, failure: "interpretation" },
                { content: `An approximation to the real rate, whose exact value is ${pc(i - r)}`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ is the approximation; the ratio is exact.", stage: 1, failure: "selection" },
                { content: "The rate at which payments fixed in money terms should be discounted", misconception: "CONC_REAL_NOMINAL_MIX", why: "Fixed money payments are discounted at the nominal rate.", stage: 2, failure: "application" },
              ],
            }
          : {
              correct: { content: `Each year the investment buys ${X} less than the year before`, why: "The ratio is below 1: purchasing power shrinks although the money value grows." },
              distractors: [
                { content: `Each year the investment's money value falls by ${X}`, misconception: "CONC_TVM_REAL_AS_MONEY_GROWTH", why: `The money value grows at ${pc(i)}.`, stage: 1, failure: "interpretation" },
                { content: `Purchasing power falls by exactly ${pc(r - i)} a year; ${X} only approximates it`, misconception: "FORMULA_APPROX_REAL", why: "$r - i$ is the approximation; the ratio is exact.", stage: 1, failure: "selection" },
                { content: `Prices fall by ${X} a year`, misconception: "CONC_RELATED_TERM", why: `Prices rise at ${pc(r)}.`, stage: 0, failure: "interpretation" },
                { content: `Purchasing power grows by ${X} a year, since both rates are positive`, misconception: "CONC_DIRECTION_REVERSED", why: "Inflation above the nominal rate erodes purchasing power.", stage: 2, failure: "conclusion" },
              ],
            }),
        itemFormat: "interpretation",
        params: { i, r, variant },
      });
    }
    if (level === 1) {
      const r = gridRate(rng, 0.02, 0.06, 0.005);
      const i = Number((r + gridRate(rng, 0.02, 0.05, 0.005)).toFixed(4));
      const [I, Rr] = [lit(i), lit(r)];
      const truth = `(1+${I})/(1+${Rr})-1`;
      const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
      const o = (latex: string, v: number) => `$${latex} = ${p2(v)}$`;
      return conceptQuestion({
        ...common,
        stem: `An investment earns an annual effective rate of ${pc(i)}. Inflation is ${pc(r)} a year.\n\nWhich of the following gives the real rate of interest?`,
        correct: { content: o(`\\dfrac{${factor(i)}}{${factor(r)}} - 1`, (1 + i) / (1 + r) - 1), why: "Purchasing power grows by the ratio of the two factors.", check: eq(`(${I}-${Rr})/(1+${Rr})`) },
        distractors: [
          { content: o(`${I} - ${Rr}`, i - r), misconception: "FORMULA_APPROX_REAL", why: "That is the first-order approximation.", check: eq(`${I}-${Rr}`), stage: 1, failure: "selection" },
          { content: o(`(${factor(i)})(${factor(r)}) - 1`, (1 + i) * (1 + r) - 1), misconception: "ALG_DIVIDE_ERROR", why: "Inflation reduces purchasing power: divide by $1 + r$.", check: eq(`(1+${I})*(1+${Rr})-1`), stage: 1, failure: "application" },
          { content: o(`\\dfrac{${factor(r)}}{${factor(i)}} - 1`, (1 + r) / (1 + i) - 1), misconception: "ALG_INVERTED_RATIO", why: "The ratio is inverted.", check: eq(`(1+${Rr})/(1+${I})-1`), stage: 1, failure: "application" },
          { content: o(`\\dfrac{${I} - ${Rr}}{${factor(i)}}`, (i - r) / (1 + i)), misconception: "CONC_RETURN_ON_WRONG_BASE", why: "The difference is divided by $1 + r$, not $1 + i$.", check: eq(`(${I}-${Rr})/(1+${I})`), stage: 1, failure: "application" },
        ],
        itemFormat: "interpretation",
        params: { i, r, variant },
      });
    }
    const r = gridRate(rng, 0.02, 0.06, 0.005);
    const j = gridRate(rng, 0.01, 0.04, 0.005);
    const [J, Rr] = [lit(j), lit(r)];
    const truth = `exp(log(1+${J})+log(1+${Rr}))-1`;
    const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
    const o = (latex: string, v: number) => `$${latex} = ${p2(v)}$`;
    return conceptQuestion({
      ...common,
      stem: `An inflation-indexed investment earns a real rate of ${pc(j)} a year. Inflation turns out to be ${pc(r)} a year.\n\nWhich of the following gives the investment's annual effective rate of return in money terms?`,
      correct: { content: o(`(${factor(j)})(${factor(r)}) - 1`, (1 + j) * (1 + r) - 1), why: "Purchasing power grows by $1 + j$ and prices by $1 + r$, so money grows by their product.", check: eq(`(1+${J})*(1+${Rr})-1`) },
      distractors: [
        { content: o(`${J} + ${Rr}`, j + r), misconception: "FORMULA_APPROX_REAL", why: "Adding the rates ignores the cross term $jr$.", check: eq(`${J}+${Rr}`), stage: 1, failure: "selection" },
        { content: o(`\\dfrac{${factor(j)}}{${factor(r)}} - 1`, (1 + j) / (1 + r) - 1), misconception: "ALG_INVERTED_RATIO", why: "Moving from real to money terms multiplies by $1 + r$.", check: eq(`(1+${J})/(1+${Rr})-1`), stage: 1, failure: "application" },
        { content: o(`${J}`, j), misconception: "CONC_REAL_NOMINAL_MIX", why: "The real rate is not the money return when prices rise.", check: eq(J), stage: 0, failure: "recognition" },
        { content: o(`(${factor(j)})(${factor(r)})^2 - 1`, (1 + j) * Math.pow(1 + r, 2) - 1), misconception: "CONC_TVM_INFLATION_TWICE", why: "Inflation is allowed for once.", check: eq(`(1+${J})*(1+${Rr})**2-1`), stage: 2, failure: "application" },
      ],
      itemFormat: "interpretation",
      params: { j, r, variant },
    });
  },
});

const realExpression: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-real-expression",
  family: "con-tvm-real",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.inflation_real",
  secondary: ["TVM.present_future_value", "ANNUITIES.geometric"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "conditions"],
  soaConcept: "Writing the present value of payments that are fixed in money terms or indexed to inflation.",
  variants: 2,
  generate(rng, level, variant) {
    const X = gridAmount(rng, 1000, 9000, 500);
    const XS = mamt(X);
    const x = lit(X);
    const r = gridRate(rng, 0.02, 0.05, 0.005);
    const i = Number((r + gridRate(rng, 0.02, 0.05, 0.005)).toFixed(4));
    const [I, Rr] = [lit(i), lit(r)];
    const [Fi, Fr] = [factor(i), factor(r)];
    const n = rng.int(5, 15);
    const L3 = level === 3;
    let stem: string;
    let opts: { correct: ConceptOption; distractors: ConceptOption[] };
    let ref: string;
    if (level === 1 && variant === 0) {
      stem = `A payment will be made at time ${n} equal to ${XS} in today's money, increased each year with inflation at ${pc(r)}. The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the payment.`;
      opts = mathOptions({ latex: `${XS}(${Fr})^{${n}}(${Fi})^{-${n}}`, probe: `${x}*${g(r)}**${n}*${g(i)}**(-${n})`, why: `The money amount paid is ${XS}$(${Fr})^{${n}}$, discounted at the nominal rate.` }, [
        { latex: `${XS}(${Fi})^{-${n}}`, probe: `${x}*${g(i)}**(-${n})`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The payment is indexed: it is larger than " + XS + " in money terms.", stage: 0, failure: "recognition" },
        { latex: `${XS}(1 + ${I} - ${Rr})^{-${n}}`, probe: `${x}*(1+${I}-${Rr})**(-${n})`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ only approximates the real rate.", stage: 1, failure: "selection" },
        { latex: `${XS}(${Fr})^{${n}}\\left(\\tfrac{${Fr}}{${Fi}}\\right)^{${n}}`, probe: `${x}*${g(r)}**${n}*(${g(r)}/${g(i)})**${n}`, misconception: "CONC_TVM_INFLATION_TWICE", why: "Inflating the payment and discounting at the real rate counts inflation twice.", stage: 2, failure: "application" },
        { latex: `${XS}(${Fr})^{-${n}}(${Fi})^{-${n}}`, probe: `${x}*${g(r)}**(-${n})*${g(i)}**(-${n})`, misconception: "CONC_MOVED_WRONG_WAY", why: "Indexation increases the payment; it is not a further discount.", stage: 1, failure: "application" },
        { latex: `${XS}(${Fi})^{${n}}(${Fr})^{-${n}}`, probe: `${x}*${g(i)}**${n}*${g(r)}**(-${n})`, misconception: "ALG_INVERTED_RATIO", why: "The ratio is inverted: that accumulates instead of discounting.", stage: 1, failure: "application" },
      ]);
      ref = `${x}*((1+${I})/(1+${Rr}))**(-${n})`;
    } else if (level === 1) {
      stem = `A payment of ${XS}, fixed in money terms, is due at time ${n}. Inflation is expected to be ${pc(r)} a year, and the annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the payment.`;
      opts = mathOptions({ latex: `${XS}(${Fi})^{-${n}}`, probe: `${x}*${g(i)}**(-${n})`, why: "A fixed money payment is discounted at the nominal rate; inflation does not change it." }, [
        { latex: `${XS}\\left(\\tfrac{${Fi}}{${Fr}}\\right)^{-${n}}`, probe: `${x}*(${g(i)}/${g(r)})**(-${n})`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The real rate applies to amounts in today's money, not fixed money amounts.", stage: 0, failure: "recognition" },
        { latex: `${XS}(1 + ${I} - ${Rr})^{-${n}}`, probe: `${x}*(1+${I}-${Rr})**(-${n})`, misconception: "FORMULA_APPROX_REAL", why: "That is an approximate real rate, and a real rate does not apply here anyway.", stage: 1, failure: "selection" },
        { latex: `${XS}(${Fr})^{${n}}(${Fi})^{-${n}}`, probe: `${x}*${g(r)}**${n}*${g(i)}**(-${n})`, misconception: "CONC_TVM_INDEXATION_ASSUMED", why: "The payment is fixed; it is not increased with inflation.", stage: 0, failure: "interpretation" },
        { latex: `${XS}(${Fi})^{-${n}}(${Fr})^{-${n}}`, probe: `${x}*${g(i)}**(-${n})*${g(r)}**(-${n})`, misconception: "CONC_TVM_INFLATION_TWICE", why: "The nominal rate already reflects inflation.", stage: 2, failure: "application" },
        { latex: `${XS}(${Fr})^{-${n}}`, probe: `${x}*${g(r)}**(-${n})`, misconception: "CONC_RELATED_TERM", why: "That gives the payment's value in today's purchasing power, not its present value.", stage: 1, failure: "interpretation" },
      ]);
      ref = `${x}/exp(${n}*log(1+${I}))`;
    } else if (level === 2) {
      const jE = `((1+${I})/(1+${Rr})-1)`;
      const jL = `\\tfrac{${Fi}}{${Fr}} - 1`;
      const ann = (j: string, due = false) => `((1-(1+${j})**(-${n}))/${j}${due ? `*(1+${j})` : ""})`;
      const sym = (lead: string, j: string, due = false) => `${lead}\\,${due ? "\\ddot{a}" : "a"}_{\\overline{${n}|}\\,j},\\ j = ${j}`;
      if (variant === 0) {
        stem = `An annuity makes ${n} annual payments, the first one year from now. The payment at time $t$ is ${XS}$(${Fr})^{t}$, keeping pace with inflation of ${pc(r)}. The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the payments.`;
        opts = mathOptions({ latex: sym(XS, jL), probe: `${x}*${ann(jE)}`, why: "Each payment is a level " + XS + " in today's money; discount at the real rate." }, [
          { latex: sym(XS, I), probe: `${x}*${ann(I)}`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The money payments grow; discounting " + XS + " at the nominal rate ignores the growth.", stage: 0, failure: "recognition" },
          { latex: sym(XS, `${I} - ${Rr}`), probe: `${x}*${ann(`(${I}-${Rr})`)}`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ only approximates the real rate.", stage: 1, failure: "selection" },
          { latex: sym(`${XS}(${Fr})^{${n}}`, I), probe: `${x}*${g(r)}**${n}*${ann(I)}`, misconception: "MODEL_LEVEL_FOR_VARYING", why: "Not every payment is at the final, fully inflated level.", stage: 1, failure: "application" },
          { latex: sym(XS, jL, true), probe: `${x}*${ann(jE, true)}`, misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The first payment is one year from now.", stage: 2, failure: "application" },
        ]);
        ref = `${x}*(${Array.from({ length: n }, (_, k) => `${g(r)}**${k + 1}*${g(i)}**(-${k + 1})`).join("+")})`;
      } else {
        stem = `An annuity makes ${n} annual payments, the first one year from now. The first payment is ${XS}, and each later payment is ${pc(r)} larger than the one before, in line with inflation. The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the payments.`;
        opts = mathOptions({ latex: sym(`\\tfrac{${XS}}{${Fr}}`, jL), probe: `${x}/${g(r)}*${ann(jE)}`, why: `In today's money each payment is ${XS}$/${Fr}$; discount at the real rate.` }, [
          { latex: sym(XS, jL), probe: `${x}*${ann(jE)}`, misconception: "TIMING_EXTRA_PERIOD", why: "The first payment is " + XS + " in money at time 1, i.e. " + XS + "$/" + Fr + "$ in today's money.", stage: 1, failure: "application" },
          { latex: sym(XS, I), probe: `${x}*${ann(I)}`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The payments grow; a level nominal valuation ignores that.", stage: 0, failure: "recognition" },
          { latex: sym(`\\tfrac{${XS}}{${Fr}}`, `${I} - ${Rr}`), probe: `${x}/${g(r)}*${ann(`(${I}-${Rr})`)}`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ only approximates the real rate.", stage: 1, failure: "selection" },
          { latex: sym(`\\tfrac{${XS}}{${Fr}}`, jL, true), probe: `${x}/${g(r)}*${ann(jE, true)}`, misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The first payment is one year from now.", stage: 2, failure: "application" },
        ]);
        ref = `${x}*(${Array.from({ length: n }, (_, k) => `${g(r)}**${k}*${g(i)}**(-${k + 1})`).join("+")})`;
      }
    } else if (variant === 0) {
      const Y = gridAmount(rng, 1000, 9000, 500);
      const YS = mamt(Y);
      const y = lit(Y);
      const n2 = drawUntil(() => rng.int(5, 15), (m) => m !== n);
      stem = `A settlement consists of two payments: at time ${n}, an amount equal to ${XS} in today's money, increased with inflation; and at time ${n2}, a fixed amount of ${YS}. Inflation is ${pc(r)} a year and the annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the settlement.`;
      const idx = (a: string, t: number) => `${a}(${Fr})^{${t}}(${Fi})^{-${t}}`;
      opts = mathOptions({ latex: `${idx(XS, n)} + ${YS}(${Fi})^{-${n2}}`, probe: `${x}*${g(r)}**${n}*${g(i)}**(-${n}) + ${y}*${g(i)}**(-${n2})`, why: "Inflate only the indexed payment; discount both at the nominal rate." }, [
        { latex: `${idx(XS, n)} + ${idx(YS, n2)}`, probe: `${x}*${g(r)}**${n}*${g(i)}**(-${n}) + ${y}*${g(r)}**${n2}*${g(i)}**(-${n2})`, misconception: "CONC_TVM_INDEXATION_ASSUMED", why: "The second payment is fixed in money terms.", stage: 0, failure: "interpretation" },
        { latex: `${XS}\\left(\\tfrac{${Fi}}{${Fr}}\\right)^{-${n}} + ${YS}\\left(\\tfrac{${Fi}}{${Fr}}\\right)^{-${n2}}`, probe: `${x}*(${g(i)}/${g(r)})**(-${n}) + ${y}*(${g(i)}/${g(r)})**(-${n2})`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The real rate suits the indexed payment only; the fixed payment needs the nominal rate.", stage: 2, failure: "application" },
        { latex: `${XS}(1 + ${I} - ${Rr})^{-${n}} + ${YS}(${Fi})^{-${n2}}`, probe: `${x}*(1+${I}-${Rr})**(-${n}) + ${y}*${g(i)}**(-${n2})`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ only approximates the real rate.", stage: 1, failure: "selection" },
        { latex: `${XS}(${Fr})^{${n}}\\left(\\tfrac{${Fr}}{${Fi}}\\right)^{${n}} + ${YS}(${Fi})^{-${n2}}`, probe: `${x}*${g(r)}**${n}*(${g(r)}/${g(i)})**${n} + ${y}*${g(i)}**(-${n2})`, misconception: "CONC_TVM_INFLATION_TWICE", why: "Inflating and then discounting at the real rate counts inflation twice.", stage: 2, failure: "application" },
        { latex: `${XS}(${Fi})^{-${n}} + ${idx(YS, n2)}`, probe: `${x}*${g(i)}**(-${n}) + ${y}*${g(r)}**${n2}*${g(i)}**(-${n2})`, misconception: "ALLOC_SWAPPED", why: "Indexation belongs to the first payment, not the second.", stage: 1, failure: "connection" },
      ]);
      ref = `${x}*exp(${n}*(log(1+${Rr})-log(1+${I}))) + ${y}*exp(-${n2}*log(1+${I}))`;
    } else {
      const r2 = drawUntil(() => gridRate(rng, 0.01, 0.06, 0.005), (y) => Math.abs(y - r) >= 0.01 && y < i);
      const k = rng.int(2, n - 2);
      const R2 = lit(r2);
      const F2 = factor(r2);
      stem = `A payment will be made at time ${n} equal to ${XS} in today's money, increased with inflation. Inflation is ${pc(r)} a year for the first ${k} years and ${pc(r2)} a year thereafter. The annual effective rate of interest is ${pc(i)}.\n\nDetermine which of the following expressions gives the present value of the payment.`;
      opts = mathOptions({ latex: `${XS}(${Fr})^{${k}}(${F2})^{${n - k}}(${Fi})^{-${n}}`, probe: `${x}*${g(r)}**${k}*${g(r2)}**${n - k}*${g(i)}**(-${n})`, why: "Price growth compounds year by year at the rate in force; then discount at the nominal rate." }, [
        { latex: `${XS}(${F2})^{${n}}(${Fi})^{-${n}}`, probe: `${x}*${g(r2)}**${n}*${g(i)}**(-${n})`, misconception: "CONC_TVM_RATE_CHANGE_RETRO", why: `${pc(r2)} applies only after year ${k}.`, stage: 2, failure: "application" },
        { latex: `${XS}(${Fr})^{${n - k}}(${F2})^{${k}}(${Fi})^{-${n}}`, probe: `${x}*${g(r)}**${n - k}*${g(r2)}**${k}*${g(i)}**(-${n})`, misconception: "ALLOC_SWAPPED", why: "Each inflation rate is paired with the other's period.", stage: 2, failure: "application" },
        { latex: `${XS}(1 + ${I} - ${Rr})^{-${k}}(1 + ${I} - ${R2})^{-${n - k}}`, probe: `${x}*(1+${I}-${Rr})**(-${k})*(1+${I}-${R2})**(-${n - k})`, misconception: "FORMULA_APPROX_REAL", why: "$i - r$ only approximates each real rate.", stage: 1, failure: "selection" },
        { latex: `${XS}(${Fi})^{-${n}}`, probe: `${x}*${g(i)}**(-${n})`, misconception: "CONC_REAL_NOMINAL_MIX", why: "The payment is indexed, so it is larger in money terms.", stage: 0, failure: "recognition" },
        { latex: `${XS}(${lit(1 + (r + r2) / 2)})^{${n}}(${Fi})^{-${n}}`, probe: `${x}*(1+${lit((r + r2) / 2)})**${n}*${g(i)}**(-${n})`, misconception: "CONC_TVM_AVERAGE_RATE", why: "A simple average of the two rates ignores how long each applies.", stage: 2, failure: "connection" },
      ]);
      ref = `${x}*exp(${k}*log(1+${Rr})+${n - k}*log(1+${R2})-${n}*log(1+${I}))`;
    }
    return conceptQuestion({
      stem,
      ...opts,
      reference: { values: [{ label: "PV", expr: ref }], description: "Each payment's money amount discounted at the nominal rate (or equivalently its real amount at the real rate); each option is evaluated and compared." },
      steps: [
        { concept: "tvm.indexed-payments", reasoning: "Decide for each payment whether it is fixed in money terms or indexed to prices." },
        { concept: "tvm.real-rate", reasoning: "Indexed: inflate to its money amount (or keep it in today's money and use the real rate). Fixed: leave it." },
        { concept: "tvm.present-value", reasoning: "Discount money amounts at the nominal rate; never apply both inflation adjustments together." },
        ...(L3 ? [{ concept: variant === 0 ? "tvm.indexed-payments" : "tvm.changing-rates", reasoning: variant === 0 ? "Treat the two payments separately: one indexed, one fixed." : "Compound the inflation rates over their own periods." }] : []),
      ],
      conditions: ["Deterministic inflation and interest.", "Indexed payments rise exactly with prices."],
      relationship: "$\\text{PV} = \\dfrac{X(1+r)^n}{(1+i)^n} = X(1+j)^{-n},\\quad 1 + j = \\dfrac{1+i}{1+r}$",
      counterexample: "If $r = 0$ indexed and fixed payments coincide.",
      transfer: {
        principle: "Match the rate to the units: money amounts with the nominal rate, today's-money amounts with the real rate.",
        unusual: L3 ? (variant === 0 ? "Indexed and fixed payments appear together." : "The inflation rate changes during the term.") : "The question hinges on whether the payment is indexed.",
        misread: "Expected inflation does not change a payment fixed in money terms.",
      },
      itemFormat: "expression-selection",
      presentation: L3 ? (variant === 0 ? ["compare-streams", "hidden-structure"] : ["hidden-structure", "indirect-wording"]) : level === 1 && variant === 1 ? ["irrelevant-info"] : level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level >= 2, multiConcept: true },
      modelingDecisions: L3 ? 1 : undefined,
      params: { X, i, r, n, variant },
    });
  },
});

const realStatements: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-real-statements",
  family: "con-tvm-real",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.inflation_real",
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  soaConcept: "Judging statements about real and nominal rates, indexed and fixed payments.",
  variants: 2,
  generate(rng, level, variant) {
    const r = gridRate(rng, 0.02, 0.05, 0.005);
    const i = Number((r + gridRate(rng, 0.02, 0.05, 0.005)).toFixed(4));
    const [I, Rr] = [lit(i), lit(r)];
    const steps = [
      { concept: "tvm.real-rate", reasoning: "$1 + i_{real} = (1+i)/(1+r)$, so $i_{real} = (i - r)/(1+r)$." },
      { concept: "tvm.indexed-payments", reasoning: "Fixed money payments use the nominal rate; indexed payments in today's money use the real rate." },
      { concept: "tvm.real-rate", reasoning: "The sign and size of $i_{real}$ follow from comparing $1 + i$ with $1 + r$." },
    ];
    const common = {
      steps,
      conditions: ["Constant rates of interest and inflation.", "No taxes."],
      relationship: "$i_{real} = \\dfrac{i - r}{1 + r}$",
      counterexample: "If $r = 0$, real and nominal rates are equal and every payment is effectively indexed.",
      transfer: {
        principle: "Real = ratio of factors; decide for each amount whether it is in money or in purchasing power.",
        unusual: "Several properties of the same relationship are tested at once.",
        misread: "“Inflation of 3%” does not change a fixed payment.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2, multiConcept: true },
      params: { i, r, variant },
    };
    if (variant === 0) {
      const statements =
        level === 1
          ? [
              statement("I", "If the nominal rate $i$ exceeds the inflation rate $r > 0$, the real rate is less than $i - r$.", true, "$(i - r)/(1 + r) < i - r$ when $i - r > 0$ and $r > 0$.", "FORMULA_APPROX_REAL", { stage: 0, failure: "application", check: { expr: `(${I}-${Rr})/(1+${Rr})-(${I}-${Rr})`, op: "<", than: 0 } }),
              statement("II", "A payment fixed in money terms should be discounted at the real rate.", false, "Fixed money amounts are discounted at the nominal rate.", "CONC_REAL_NOMINAL_MIX", { stage: 1, failure: "selection", conditionTrue: "True for an indexed payment stated in today's money." }),
              statement("III", "If inflation exceeds the nominal rate, the real rate is negative.", true, "$(1+i)/(1+r) < 1$.", "CONC_TVM_REAL_AS_MONEY_GROWTH", { stage: 2, failure: "conclusion" }),
            ]
          : [
              statement("I", "If prices fall ($r < 0$) while $i > 0$, the real rate exceeds the nominal rate.", true, "Dividing $1 + i$ by $1 + r < 1$ increases it.", "CONC_DIRECTION_REVERSED", { stage: 2, failure: "conclusion", check: { expr: `(1+${I})/(1-0.01)-1-${I}`, op: ">", than: 0 } }),
              statement("II", "The exact real rate is $(i - r)/(1 + i)$.", false, "The denominator is $1 + r$.", "CONC_RETURN_ON_WRONG_BASE", { stage: 0, failure: "selection", check: { expr: `(${I}-${Rr})/(1+${I})`, op: "=", than: `(1+${I})/(1+${Rr})-1` } }),
              statement("III", "Over $n$ years, an investment's growth in purchasing power is its growth in money divided by $(1 + r)^n$.", true, "Prices rise by $(1+r)^n$ over the same period.", "CONC_TVM_REAL_AS_MONEY_GROWTH", { stage: 1, failure: "interpretation" }),
            ];
      return statementQuestion({
        ...common,
        stem: "Let $i$ be the annual effective rate of interest and $r$ the annual rate of inflation.\n\nDetermine which of the following statements are true.",
        statements,
        extra:
          level === 1
            ? [
                { keys: ["II"], misconception: "CONC_RELATED_TERM", why: "Accepting only II treats real and nominal rates as interchangeable.", stage: 1, failure: "selection" },
                { keys: ["II", "III"], misconception: "CONC_DIRECTION_REVERSED", why: "Rejecting I reverses the direction of the approximation error.", stage: 0, failure: "application" },
              ]
            : [
                { keys: ["II"], misconception: "FORMULA_APPROX_REAL", why: "Accepting only II misjudges both true statements.", stage: 0, failure: "selection" },
                { keys: ["I", "II"], misconception: "CONC_REAL_NOMINAL_MIX", why: "Rejecting III confuses money growth with purchasing power.", stage: 1, failure: "interpretation" },
              ],
      });
    }
    const n = rng.int(5, 15);
    if (level === 1) {
      const P = gridAmount(rng, 1000, 9000, 500);
      return statementQuestion({
        ...common,
        stem: `The annual effective rate of interest is ${pc(i)} and inflation is ${pc(r)} a year.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The real rate of interest is ${pc(i - r)}.`, false, `The real rate is $${factor(i)}/${factor(r)} - 1 = ${p2((1 + i) / (1 + r) - 1)}$.`, "FORMULA_APPROX_REAL", { stage: 0, failure: "selection", check: { expr: `(1+${I})/(1+${Rr})-1`, op: "=", than: `${I}-${Rr}` }, conditionTrue: "Approximately true when $r$ is small." }),
          statement("II", `1000 invested now has, after ${n} years, a purchasing power in today's money of $1000\\left(\\tfrac{${factor(i)}}{${factor(r)}}\\right)^{${n}}$.`, true, `Money grows by $(${factor(i)})^{${n}}$, prices by $(${factor(r)})^{${n}}$.`, "CONC_TVM_REAL_AS_MONEY_GROWTH", { stage: 2, failure: "interpretation", check: { expr: `1000*(1+${I})**${n}/(1+${Rr})**${n}`, op: "=", than: `1000*((1+${I})/(1+${Rr}))**${n}` } }),
          statement("III", `A payment equal to ${mamt(P)} in today's money, indexed to inflation and due at time ${n}, has present value ${mamt(P)}$(1 + j)^{-${n}}$, where $j$ is the real rate.`, true, `$${mamt(P)}(${factor(r)})^{${n}}(${factor(i)})^{-${n}} = ${mamt(P)}(1+j)^{-${n}}$.`, "CONC_REAL_NOMINAL_MIX", { stage: 1, failure: "selection", check: { expr: `${lit(P)}*(1+${Rr})**${n}*(1+${I})**(-${n})`, op: "=", than: `${lit(P)}*((1+${I})/(1+${Rr}))**(-${n})` } }),
        ],
        extra: [
          { keys: ["I"], misconception: "CONC_RELATED_TERM", why: "Accepting only I takes the approximation for the real rate and misjudges its uses.", stage: 0, failure: "selection" },
          { keys: ["I", "III"], misconception: "CONC_TVM_INFLATION_TWICE", why: "Rejecting II treats purchasing power as needing a second inflation adjustment.", stage: 2, failure: "interpretation" },
        ],
        params: { ...common.params, P, n },
      });
    }
    const j = gridRate(rng, 0.01, 0.03, 0.005);
    const bNom = (1 + j) * (1 + r) - 1;
    const iA = Number((bNom - gridRate(rng, 0.005, 0.01, 0.005)).toFixed(4));
    return statementQuestion({
      ...common,
      stem: `Bond A pays a fixed annual effective return of ${pc(iA)} in money terms. Bond B is indexed to inflation and pays a real annual effective return of ${pc(j)}. Inflation is expected to be ${pc(r)} a year.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `If inflation is ${pc(r)}, B's return in money terms is ${p2(bNom)}.`, true, `$(${factor(j)})(${factor(r)}) - 1 = ${p2(bNom)}$.`, "FORMULA_APPROX_REAL", { stage: 0, failure: "application", check: { expr: `(1+${lit(j)})*(1+${Rr})-1`, op: "=", than: Number(bNom.toFixed(12)) } }),
        statement("II", `If inflation is ${pc(r)}, A's real return exceeds ${pc(j)}.`, false, `A's real return is $${factor(iA)}/${factor(r)} - 1 = ${p2((1 + iA) / (1 + r) - 1)}$.`, "CONC_REAL_NOMINAL_MIX", { stage: 1, failure: "application", check: { expr: `(1+${lit(iA)})/(1+${Rr})-1`, op: ">", than: j } }),
        statement("III", `If inflation turns out higher than ${pc(r)}, A's real return falls while B's real return is unchanged.`, true, "A's money return is fixed; B's money return rises with prices.", "CONC_TVM_INDEXATION_ASSUMED", { stage: 2, failure: "connection" }),
      ],
      extra: [
        { keys: ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "Accepting only II misjudges both the conversion and the effect of inflation.", stage: 2, failure: "connection" },
        { keys: ["II", "III"], misconception: "CONC_TVM_REAL_AS_MONEY_GROWTH", why: "Rejecting I treats the real return as the money return.", stage: 0, failure: "interpretation" },
      ],
      params: { ...common.params, j, iA },
    });
  },
});

// ================================================================ equations of value

const equivalenceInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-equivalence-interpretation",
  family: "con-tvm-equation",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "relationships"],
  soaConcept: "What it means for two sets of payments to be equivalent, and what equivalence does and does not imply.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const steps = [
      { concept: "tvm.equation-of-value", reasoning: "Equivalent at rate $i$: equal values at one date at that rate." },
      { concept: "tvm.equation-of-value", reasoning: "Moving both sides to another date multiplies both by the same $(1+i)^k$, so they agree at every date." },
      { concept: "tvm.present-value", reasoning: "Changing the rate changes later payments' values more, so equivalence is specific to the rate." },
    ];
    const common = {
      steps,
      conditions: ["Compound interest at a single annual effective rate.", "Payments certain."],
      relationship: "$\\sum_A CF_s (1+i)^{T-s} = \\sum_B CF_s (1+i)^{T-s}$ for one $T$ $\\Rightarrow$ for every $T$",
      counterexample: "Under simple interest, equivalence at one date does not carry to other dates.",
      transfer: {
        principle: "Equivalence is a property of the rate, not of the comparison date.",
        unusual: "The question asks what follows from equivalence, not to compute it.",
        misread: "Equal present values say nothing about equal undiscounted totals.",
      },
      presentation: level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level === 2, multipleValuationDates: true },
      params: { i, variant },
    };
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem:
          level === 1
            ? `Two sets of payments, A and B, have equal present values at an annual effective rate of ${pc(i)}.\n\nWhich of the following must be true?`
            : `Two sets of payments, A and B, have equal present values at an annual effective rate of ${pc(i)}. Every payment in A is made before every payment in B.\n\nWhich of the following must be true?`,
        ...(level === 1
          ? {
              correct: { content: `At ${pc(i)}, A and B have equal values at every date.`, why: "Both values are multiplied by the same factor when moved." },
              distractors: [
                { content: `At ${pc(i)}, A and B have equal values at time 0 only; later, the set with later payments is worth more.`, misconception: "CONC_TVM_EQUIV_DATE_DEPENDS", why: "Under compound interest the comparison does not depend on the date.", stage: 1, failure: "connection" },
                { content: "A and B have equal totals of undiscounted payments.", misconception: "SEQ_UNDISCOUNTED_SUM", why: "Equal present values allow different totals at different dates.", stage: 0, failure: "interpretation" },
                { content: "A and B have equal present values at every interest rate.", misconception: "CONC_TVM_EQUIV_RATE_FREE", why: "A different rate revalues payments at different dates differently.", stage: 2, failure: "conclusion", conditionTrue: "True only if A and B had identical payment dates and amounts." },
                { content: `A and B also have equal present values under simple interest at ${pc(i)}.`, misconception: "CONC_OUTSIDE_ASSUMPTIONS", why: "Simple and compound interest give different present values except at $t = 0, 1$.", stage: 2, failure: "application" },
              ],
            }
          : {
              correct: { content: `At any rate above ${pc(i)}, A has the larger present value.`, why: "B's later payments lose more value when the rate rises." },
              distractors: [
                { content: `At any rate above ${pc(i)}, B has the larger present value.`, misconception: "CONC_DIRECTION_REVERSED", why: "A higher rate penalises later payments, which are B's.", stage: 2, failure: "application" },
                { content: "A and B have equal present values at every interest rate.", misconception: "CONC_TVM_EQUIV_RATE_FREE", why: "Equivalence holds at one rate only when the timing differs.", stage: 2, failure: "conclusion" },
                { content: "The undiscounted total of A's payments exceeds that of B's.", misconception: "SEQ_UNDISCOUNTED_SUM", why: "A's payments are earlier, so with equal present values A's total is the smaller.", stage: 0, failure: "interpretation" },
                { content: "A and B have equal values at time 0, but not at the date of B's last payment.", misconception: "CONC_TVM_EQUIV_DATE_DEPENDS", why: "Equal at one date at the given rate means equal at every date.", stage: 1, failure: "connection" },
              ],
            }),
        itemFormat: "interpretation",
      });
    }
    const X = gridAmount(rng, 1000, 5000, 250);
    const a = rng.int(1, 3);
    const b = a + rng.int(2, 6);
    const Y = X * Math.pow(1 + i, b - a);
    const c = level === 1 ? b + rng.int(1, 5) : b + 0.5 + rng.int(0, 3);
    const i2 = Number((i + 0.01 * rng.int(1, 3)).toFixed(4));
    const [x, y] = [lit(X), lit(Y)];
    const pv = (amt: string, t: number, r: number) => `${amt}*(1+${lit(r)})**(-${t})`;
    return conceptQuestion({
      ...common,
      stem:
        level === 1
          ? `A payment of ${mamt(X)} at time ${a} and a payment of ${mnum(Y)} at time ${b} are equivalent at an annual effective rate of ${pc(i)}.\n\nWhich of the following is true?`
          : `A lender is indifferent, at an annual effective rate of ${pc(i)}, between receiving ${mamt(X)} at time ${a} and ${mnum(Y)} at time ${b}.\n\nWhich of the following is true?`,
      correct: { content: `At ${pc(i)}, the two payments also have equal values at time ${c}.`, why: `Both are multiplied by $(${factor(i)})^{${c}}$ when moved from time 0.`, check: { expr: `${x}*(1+${lit(i)})**(${c - a})`, op: "=", than: `${y}*(1+${lit(i)})**(${c - b})` } },
      distractors: ([
        { content: `At ${pc(i2)}, the payment at time ${b} has the larger present value.`, misconception: "CONC_DIRECTION_REVERSED", why: "A higher rate favours the earlier payment.", check: { expr: `${pv(y, b, i2)}-${pv(x, a, i2)}`, op: ">", than: 0 }, stage: 2, failure: "application" },
        { content: `$${mnum(Y)} - ${mamt(X)} = ${mamt(X)}(${lit(i)})(${b - a})$.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "The difference includes interest on interest.", check: { expr: `${y}-${x}`, op: "=", than: `${x}*${lit(i)}*${b - a}` }, stage: 1, failure: "selection" },
        { content: `$${mamt(X)}(${factor(i)})^{${a}} = ${mnum(Y)}(${factor(i)})^{${b}}$.`, misconception: "CONC_MOVED_WRONG_WAY", why: "Both payments were accumulated from 0 instead of discounted to 0.", check: { expr: `${x}*(1+${lit(i)})**${a}`, op: "=", than: `${y}*(1+${lit(i)})**${b}` }, stage: 1, failure: "application" },
        { content: `At ${pc(i)}, the value at time 0 of both payments together is $${mamt(X)} + ${mnum(Y)}v^{${b}}$.`, misconception: "TIMING_VALUATION_DATE", why: `The payment at time ${a} must be discounted too.`, check: { expr: `${x}+${y}*(1+${lit(i)})**(-${b})`, op: "=", than: `2*${pv(x, a, i)}` }, stage: 1, failure: "interpretation", conditionTrue: "Correct only if the first payment were at time 0." },
      ] as ConceptOption[]).filter((d) => !(a === 0 && d.misconception === "TIMING_VALUATION_DATE")),
      itemFormat: "interpretation",
      params: { ...common.params, X, a, b, c },
    });
  },
});

const equivalenceDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-equivalence-diagnosis",
  family: "con-tvm-equation",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value", "TVM.accumulation_discount"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "equation_construction", "timing"],
  soaConcept: "Diagnosing the valuation-date or rate error in a proposed equation of value.",
  variants: 2,
  generate(rng, level, variant) {
    const L3 = level === 3;
    const i1 = gridRate(rng, 0.03, 0.07, 0.005);
    const i2 = L3 ? drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (y) => Math.abs(y - i1) >= 0.015) : i1;
    const [A, B] = [g(i1), g(i2)];
    const [FA, FB] = [factor(i1), factor(i2)];
    const X = gridAmount(rng, 1000, 5000, 250);
    const Y = gridAmount(rng, 1000, 5000, 250);
    const [x, y] = [lit(X), lit(Y)];
    const [XS, YS] = [mamt(X), mamt(Y)];
    let stem: string;
    let opts: { correct: ConceptOption; distractors: ConceptOption[] };
    const ask = "Which of the following correctly describes the candidate's calculation?";
    if (!L3 && variant === 0) {
      const n = rng.int(6, 12);
      const t = rng.int(2, n - 2);
      const truth = `${x}*${A}**${t}+${y}*${A}**(${t - n})`;
      stem = `Payments of ${XS} now and ${YS} at time ${n} are to be replaced by a single payment $Z$ at time ${t}, at an annual effective rate of ${pc(i1)}. A candidate writes\n\n$$Z = ${XS}(${FA})^{${t}} + ${YS}(${FA})^{-${n}}.$$\n\n${ask}`;
      opts = diagnosis(truth, [`The payment at time ${n} was moved to time 0, not ${t}; $Z = ${XS}(${FA})^{${t}} + ${YS}(${FA})^{-${n - t}}$.`, "Both payments must be valued at time " + t + ".", `(${x}+${y}*${A}**(-${n}))*${A}**${t}`], [
        [`The calculation is correct; $Z = ${XS}(${FA})^{${t}} + ${YS}(${FA})^{-${n}}$.`, "TIMING_VALUATION_DATE", "The two terms are values at different dates.", `${x}*${A}**${t}+${y}*${A}**(-${n})`, 0, "recognition"],
        [`The first payment must be valued at time 0 too; $Z = ${XS} + ${YS}(${FA})^{-${n}}$.`, "VAR_OTHER_UNKNOWN", "That is the value at time 0, not the payment due at time " + t + ".", `${x}+${y}*${A}**(-${n})`, 2, "conclusion"],
        [`The second exponent has the wrong sign; $Z = ${XS}(${FA})^{${t}} + ${YS}(${FA})^{${n - t}}$.`, "ALG_SIGN_ERROR", `The payment at ${n} is after time ${t}, so it is discounted.`, `${x}*${A}**${t}+${y}*${A}**${n - t}`, 1, "application"],
        [`A replacement keeps the total; $Z = ${XS} + ${YS}$.`, "SEQ_UNDISCOUNTED_SUM", "Amounts at different dates cannot be added unadjusted.", `${x}+${y}`, 0, "recognition"],
        [`Interest is simple over each gap; $Z = ${XS}(1 + ${lit(i1)}\\cdot ${t}) + ${YS}/(1 + ${lit(i1)}\\cdot ${n - t})$.`, "MODEL_COMPOUND_AS_SIMPLE", "The rate is an annual effective (compound) rate.", `${x}*(1+${lit(i1)}*${t})+${y}/(1+${lit(i1)}*${n - t})`, 1, "selection"],
      ]);
    } else if (!L3) {
      const t1 = rng.int(2, 4);
      const t2 = t1 + rng.int(2, 5);
      const L = gridAmount(rng, 5000, 20000, 500);
      const R = gridAmount(rng, 1000, Math.floor((L * 0.6) / 500) * 500, 500);
      const [l, rr] = [lit(L), lit(R)];
      const [LS, RS] = [mamt(L), mamt(R)];
      const truth = `${l}*${A}**${t2}-${rr}*${A}**${t2 - t1}`;
      stem = `A loan of ${LS} made now is repaid by ${RS} at time ${t1} and a final payment $F$ at time ${t2}, at an annual effective rate of ${pc(i1)}. A candidate writes\n\n$$F = ${LS}(${FA})^{${t2}} - ${RS}(${FA})^{${t1}}.$$\n\n${ask}`;
      opts = diagnosis(truth, [`The payment at time ${t1} was accumulated ${t1} years, not ${t2 - t1}; $F = ${LS}(${FA})^{${t2}} - ${RS}(${FA})^{${t2 - t1}}$.`, `At time ${t2} the payment made at ${t1} has earned ${t2 - t1} years of interest.`, `(${l}*${A}**${t1}-${rr})*${A}**${t2 - t1}`], [
        [`The calculation is correct; $F = ${LS}(${FA})^{${t2}} - ${RS}(${FA})^{${t1}}$.`, "TIMING_VALUATION_DATE", "The exponent of each term is (valuation date − payment date).", `${l}*${A}**${t2}-${rr}*${A}**${t1}`, 0, "recognition"],
        [`The loan should not be accumulated; $F = ${LS} - ${RS}(${FA})^{${t2 - t1}}$.`, "TIMING_MISSING_PERIOD", `The loan is made at time 0 and must be carried to time ${t2}.`, `${l}-${rr}*${A}**${t2 - t1}`, 1, "application"],
        [`The repayment should be discounted; $F = ${LS}(${FA})^{${t2}} - ${RS}(${FA})^{-${t1}}$.`, "CONC_MOVED_WRONG_WAY", `The payment is earlier than time ${t2}, so it is accumulated.`, `${l}*${A}**${t2}-${rr}*${A}**(-${t1})`, 1, "application"],
        [`The repayment earns no interest once paid; $F = ${LS}(${FA})^{${t2}} - ${RS}$.`, "SEQ_UNDISCOUNTED_SUM", "Paying early reduces the balance, which then avoids interest.", `${l}*${A}**${t2}-${rr}`, 0, "recognition"],
      ]);
    } else if (variant === 0) {
      const k = rng.int(2, 4);
      const t = k + rng.int(1, 3);
      const n = t + rng.int(2, 5);
      const truth = `${x}*${A}**${k}*${B}**${t - k}+${y}*${B}**(-${n - t})`;
      const iBar = lit((i1 + i2) / 2);
      stem = `Payments of ${XS} now and ${YS} at time ${n} are to be replaced by a single payment $Z$ at time ${t}. The annual effective rate is ${pc(i1)} up to time ${k} and ${pc(i2)} thereafter. A candidate writes\n\n$$Z = ${XS}(${FB})^{${t}} + ${YS}(${FB})^{-${n - t}}.$$\n\n${ask}`;
      opts = diagnosis(truth, [`The first payment must earn ${pc(i1)} up to time ${k}; $Z = ${XS}(${FA})^{${k}}(${FB})^{${t - k}} + ${YS}(${FB})^{-${n - t}}$.`, `Only the years after time ${k} use ${pc(i2)}.`, `${x}*exp(${k}*log(${A})+${t - k}*log(${B}))+${y}*${B}**(${t - n})`], [
        [`The calculation is correct; the rate at time ${t} applies to every payment.`, "CONC_TVM_RATE_CHANGE_RETRO", `${pc(i2)} applies only from time ${k}.`, `${x}*${B}**${t}+${y}*${B}**(${t - n})`, 1, "application"],
        [`The first rate applies throughout; $Z = ${XS}(${FA})^{${t}} + ${YS}(${FA})^{-${n - t}}$.`, "TRANS_IGNORED_CONDITION", "The rate change at time " + k + " must be used.", `${x}*${A}**${t}+${y}*${A}**(${t - n})`, 1, "application"],
        [`The average rate applies; $Z = ${XS}(1 + ${iBar})^{${t}} + ${YS}(1 + ${iBar})^{-${n - t}}$.`, "CONC_TVM_AVERAGE_RATE", "An average rate does not reproduce the product of the factors.", `${x}*(1+${iBar})**${t}+${y}*(1+${iBar})**(${t - n})`, 2, "connection"],
        [`The rates are reversed; $Z = ${XS}(${FB})^{${k}}(${FA})^{${t - k}} + ${YS}(${FA})^{-${n - t}}$.`, "ALLOC_SWAPPED", "Each rate belongs to its own interval.", `${x}*${B}**${k}*${A}**${t - k}+${y}*${A}**(${t - n})`, 2, "application"],
        [`The later payment should be accumulated; $Z = ${XS}(${FA})^{${k}}(${FB})^{${t - k}} + ${YS}(${FB})^{${n - t}}$.`, "CONC_MOVED_WRONG_WAY", `The payment at ${n} is after time ${t}: discount it.`, `${x}*${A}**${k}*${B}**${t - k}+${y}*${B}**${n - t}`, 0, "application"],
      ]);
    } else {
      const k = rng.int(2, 5);
      const n = k + rng.int(3, 7);
      const D = X;
      const d = x;
      const DS = XS;
      const truth = `${d}*${A}**${k}*${B}**${n - k}+${d}*${B}**${n - k}`;
      const iBar = lit((i1 + i2) / 2);
      stem = `A fund credits an annual effective rate of ${pc(i1)} up to time ${k} and ${pc(i2)} thereafter, on its whole balance. Deposits of ${DS} are made at time 0 and at time ${k}. A candidate calculates the balance at time ${n} as\n\n$$${DS}(${FA})^{${k}}(${FB})^{${n - k}} + ${DS}(${FA})^{${n - k}}.$$\n\n${ask}`;
      opts = diagnosis(truth, [`After time ${k} all money earns ${pc(i2)}; the second term should be ${DS}$(${FB})^{${n - k}}$.`, `The deposit at time ${k} is made after the rate change.`, `${d}*(${A}**${k}+1)*${B}**${n - k}`], [
        [`The calculation is correct; each deposit earns the rate in force when it was made.`, "CONC_TVM_RATE_LOCKED_AT_DEPOSIT", "The fund's rate applies to its whole balance at each time.", `${d}*${A}**${k}*${B}**${n - k}+${d}*${A}**${n - k}`, 0, "recognition", "Correct under an investment-year method, which the question does not use."],
        [`Both deposits should earn ${pc(i2)} throughout; the first term should be ${DS}$(${FB})^{${n}}$.`, "CONC_TVM_RATE_CHANGE_RETRO", `${pc(i2)} applies only after time ${k}.`, `${d}*${B}**${n}+${d}*${B}**${n - k}`, 1, "application"],
        [`Both deposits earn ${pc(i1)} for ${k} years; the second term should equal the first.`, "TIMING_EXTRA_PERIOD", `The second deposit is made at time ${k}; it earns nothing before then.`, `2*${d}*${A}**${k}*${B}**${n - k}`, 1, "application"],
        [`The average rate applies; the balance is ${DS}$[(1 + ${iBar})^{${n}} + (1 + ${iBar})^{${n - k}}]$.`, "CONC_TVM_AVERAGE_RATE", "An average rate does not reproduce the product of factors.", `${d}*((1+${iBar})**${n}+(1+${iBar})**${n - k})`, 2, "connection"],
        [`The rates are reversed; the balance is ${DS}$(${FB})^{${k}}(${FA})^{${n - k}} + $${DS}$(${FA})^{${n - k}}$.`, "ALLOC_SWAPPED", "Each rate belongs to its own interval.", `${d}*${B}**${k}*${A}**${n - k}+${d}*${A}**${n - k}`, 2, "application"],
      ]);
      void D;
    }
    return conceptQuestion({
      stem,
      ...opts,
      reference: { description: "The equation of value written at the stated date from the explicit payments; each option's proposed result is evaluated and compared with it." },
      steps: [
        { concept: "tvm.equation-of-value", reasoning: "Choose one valuation date and move every payment there." },
        { concept: "tvm.present-value", reasoning: "Each exponent is (valuation date − payment date): positive accumulates, negative discounts." },
        { concept: L3 ? "tvm.changing-rates" : "tvm.equation-of-value", reasoning: L3 ? "With a rate change, each interval uses its own rate, for every amount in the fund." : "Solve for the unknown only once both sides are at that date." },
        ...(L3 ? [{ concept: "tvm.equation-of-value", reasoning: "Check the corrected equation term by term against the timeline." }] : []),
      ],
      conditions: ["Compound interest.", L3 ? "The rate changes once, for all money." : "One annual effective rate throughout."],
      relationship: L3 ? "Factor from $s$ to $T$ = $(1+i_1)^{\\text{years before } k}(1+i_2)^{\\text{years after } k}$" : "$\\sum_s CF_s(1+i)^{T-s}$ on each side, one $T$",
      counterexample: "Written at a different date, a correct equation looks different but has the same solution.",
      transfer: {
        principle: "Every term of an equation of value must sit at one date, carried there at the rates in force along the way.",
        unusual: "You judge a worked equation.",
        misread: "A rate change applies to the whole balance from that date, not to new money only.",
      },
      itemFormat: "error-diagnosis",
      presentation: L3 ? ["valuation-date", "hidden-structure"] : ["valuation-date"],
      features: { unfamiliar: true, multipleValuationDates: true, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { i1, i2, X, Y, variant },
    });
  },
});

// ================================================================ variable force of interest

const VARFORCE_STEPS = (decision: string) => [
  { concept: "tvm.variable-force", reasoning: "1 invested at $t_1$ grows to $\\exp\\bigl(\\int_{t_1}^{t_2}\\delta_s\\,ds\\bigr)$ at $t_2$; discounting uses the reciprocal." },
  { concept: "tvm.variable-force", reasoning: "Integrate over the actual dates: with a varying force the factor is not a function of $t_2 - t_1$ alone." },
  { concept: "tvm.force-of-interest", reasoning: decision },
];

const varforceInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-varforce-interpretation",
  family: "con-tvm-varforce",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.variable_force",
  secondary: ["TVM.force_of_interest", "TVM.present_future_value"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  soaConcept: "Reading what an integral of a varying force represents, and choosing the discount factor between two dates.",
  variants: 2,
  generate(rng, level, variant) {
    const a = rng.int(1, 3);
    const b = a + rng.int(2, 5);
    const common = {
      steps: VARFORCE_STEPS("Identify which date is the start and which the end, and whether the factor accumulates or discounts."),
      conditions: ["The force of interest varies with calendar time.", "No cash flows other than those described."],
      relationship: "$a(t_1, t_2) = \\exp\\Bigl(\\int_{t_1}^{t_2}\\delta_s\\,ds\\Bigr),\\qquad v(t_1, t_2) = \\exp\\Bigl(-\\int_{t_1}^{t_2}\\delta_s\\,ds\\Bigr)$",
      counterexample: "With a constant force the factor would depend only on $t_2 - t_1$.",
      transfer: {
        principle: "The limits of the integral are the two dates; the sign of the exponent is the direction of the move.",
        unusual: level === 2 ? "The quantity is written through the discount function from time 0." : "An integral expression must be read, not evaluated.",
        misread: "A factor is not a rate: the rate over the interval is the factor minus 1.",
      },
      presentation: level === 2 ? (["indirect-wording", "valuation-date"] as const).slice() : (["valuation-date"] as const).slice(),
      features: { unfamiliar: level === 2, multipleValuationDates: true },
    };
    if (variant === 0) {
      const stem =
        level === 1
          ? `The force of interest $\\delta_t$ varies with $t$. Which of the following does\n$$\\exp\\Bigl(\\int_{${a}}^{${b}}\\delta_t\\,dt\\Bigr)$$\nrepresent?`
          : `The force of interest $\\delta_t$ varies with $t$, and $v(t) = \\exp\\bigl(-\\int_0^t \\delta_s\\,ds\\bigr)$. Which of the following does $v(${b})/v(${a})$ represent?`;
      return conceptQuestion({
        ...common,
        stem,
        ...(level === 1
          ? {
              correct: { content: `The accumulated value at time ${b} of 1 invested at time ${a}`, why: "The exponent integrates the force from the investment date to the valuation date." },
              distractors: [
                { content: `The present value at time ${a} of 1 payable at time ${b}`, misconception: "CONC_MOVED_WRONG_WAY", why: "A present value has a negative exponent.", stage: 0, failure: "interpretation" },
                { content: `The accumulated value at time ${b} of 1 invested at time 0`, misconception: "TIMING_VALUATION_DATE", why: `The integral starts at time ${a}.`, stage: 1, failure: "interpretation" },
                { content: `The effective rate of interest earned from time ${a} to time ${b}`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: "The rate is the factor minus 1.", stage: 2, failure: "interpretation" },
                { content: `The accumulated value at time ${b - a} of 1 invested at time 0`, misconception: "CONC_TVM_CLOCK_RESTART", why: "With a varying force the interval's position matters, not only its length.", stage: 1, failure: "application", conditionTrue: "Equal if the force were constant." },
                { content: `The average force of interest from time ${a} to time ${b}`, misconception: "CONC_TVM_AVERAGE_RATE", why: `The average force is $\\frac{1}{${b - a}}\\int \\delta_t\\,dt$, without the exponential.`, stage: 2, failure: "interpretation" },
              ],
            }
          : {
              correct: { content: `The value at time ${a} of 1 payable at time ${b}`, why: `$v(${b})/v(${a}) = \\exp\\bigl(-\\int_{${a}}^{${b}}\\delta_s\\,ds\\bigr)$.` },
              distractors: [
                { content: `The value at time ${b} of 1 invested at time ${a}`, misconception: "CONC_MOVED_WRONG_WAY", why: "That is the reciprocal, $v(" + a + ")/v(" + b + ")$.", stage: 0, failure: "interpretation" },
                { content: `The value at time 0 of 1 payable at time ${b}`, misconception: "TIMING_VALUATION_DATE", why: `That is $v(${b})$ alone.`, stage: 1, failure: "interpretation" },
                { content: `The value at time 0 of 1 payable at time ${b - a}`, misconception: "CONC_TVM_CLOCK_RESTART", why: "With a varying force, the interval's position matters.", stage: 1, failure: "application" },
                { content: `The effective rate of discount from time ${a} to time ${b}`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: "The discount rate over the interval is 1 minus this ratio.", stage: 2, failure: "interpretation" },
              ],
            }),
        itemFormat: "interpretation",
        params: { a, b, variant },
      });
    }
    const c = gridRate(rng, 0.02, 0.05, 0.005);
    const k = level === 1 ? rng.int(2, 6) / 1000 : rng.int(5, 20) / 10000;
    const [C, K] = [lit(c), lit(k)];
    const I = (p: number, q: number) => (level === 1 ? `(${C}*${q - p}+${K}*(${q * q - p * p})/2)` : `(${C}*${q - p}+${K}*(${q ** 3 - p ** 3})/3)`);
    const dAt = (t: number) => (level === 1 ? `(${C}+${K}*${t})` : `(${C}+${K}*${t * t})`);
    const deltaL = level === 1 ? `\\delta_t = ${C} + ${K}\\,t` : `\\delta_t = ${C} + ${K}\\,t^2`;
    const int = (p: number | string, q: number | string) => `\\int_{${p}}^{${q}}\\delta_t\\,dt`;
    return conceptQuestion({
      ...common,
      stem:
        level === 1
          ? `The force of interest is $${deltaL}$, $t \\ge 0$.\n\nDetermine which of the following expressions gives the present value at time ${a} of 1 payable at time ${b}.`
          : `The force of interest is $${deltaL}$, $t \\ge 0$.\n\nDetermine which of the following expressions gives the amount that must be invested at time ${a} to accumulate to 1 at time ${b}.`,
      ...mathOptions({ latex: `e^{-${int(a, b)}}`, probe: `exp(-${I(a, b)})`, why: `Discount from ${b} back to ${a} with the force over exactly that interval.` }, [
        { latex: `e^{${int(a, b)}}`, probe: `exp(${I(a, b)})`, misconception: "CONC_MOVED_WRONG_WAY", why: "That accumulates from " + a + " to " + b + ".", stage: 0, failure: "application" },
        { latex: `e^{-${int(0, b)}}`, probe: `exp(-${I(0, b)})`, misconception: "TIMING_VALUATION_DATE", why: "That is the value at time 0.", stage: 1, failure: "interpretation" },
        { latex: `e^{-${int(0, b - a)}}`, probe: `exp(-${I(0, b - a)})`, misconception: "CONC_TVM_CLOCK_RESTART", why: "With a varying force the interval must keep its actual dates.", stage: 1, failure: "application", conditionTrue: "Correct for a constant force." },
        { latex: `e^{-${b - a}\\,\\delta_{${b}}}`, probe: `exp(-${b - a}*${dAt(b)})`, misconception: "MODEL_CONSTANT_FORCE", why: `The force is not constant at its time-${b} value.`, stage: 2, failure: "selection" },
        { latex: `1 - ${int(a, b)}`, probe: `1-${I(a, b)}`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "That is only a first-order approximation to the exponential.", stage: 2, failure: "selection" },
      ]),
      reference: { values: [{ label: "factor", expr: `exp(-${I(0, b)})/exp(-${I(0, a)})` }], description: "Ratio of the discount functions from time 0, evaluated from the given force; each option is evaluated and compared." },
      itemFormat: "expression-selection",
      params: { a, b, c, k, variant },
    });
  },
});

const varforceExpression: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-varforce-expression",
  family: "con-tvm-varforce",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.variable_force",
  secondary: ["TVM.force_of_interest", "TVM.simple_compound"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  soaConcept: "Writing an accumulated or present value under a given varying force, including forces with hidden simple structure or a change of formula.",
  variants: 2,
  generate(rng, level, variant) {
    const X = gridAmount(rng, 1000, 9000, 500);
    const [XS, x] = [mamt(X), lit(X)];
    let stem: string;
    let opts: { correct: ConceptOption; distractors: ConceptOption[] };
    let ref: string;
    let decision: string;
    const L3 = level === 3;
    if (!L3 && variant === 0) {
      const k = rng.int(4, 12) / 1000;
      const K = lit(k);
      const t1 = rng.int(1, 3);
      const t2 = t1 + rng.int(2, 5);
      stem = `The force of interest is $\\delta_t = ${K}\\,t$, $t \\ge 0$. A deposit of ${XS} is made at time ${t1}.\n\nDetermine which of the following expressions gives its accumulated value at time ${t2}.`;
      opts = mathOptions({ latex: `${XS}\\,e^{${K}(${t2}^2 - ${t1}^2)/2}`, probe: `${x}*exp(${K}*(${t2 * t2}-${t1 * t1})/2)`, why: `$\\int_{${t1}}^{${t2}} ${K}t\\,dt = ${K}(${t2}^2 - ${t1}^2)/2$.` }, [
        { latex: `${XS}\\,e^{${K}(${t2} - ${t1})^2/2}`, probe: `${x}*exp(${K}*${(t2 - t1) ** 2}/2)`, misconception: "CONC_TVM_CLOCK_RESTART", why: "That integrates from 0 to the length of the interval.", stage: 1, failure: "application" },
        { latex: `${XS}\\,e^{${K}(${t2})(${t2 - t1})}`, probe: `${x}*exp(${K}*${t2}*${t2 - t1})`, misconception: "MODEL_CONSTANT_FORCE", why: `The force is below $\\delta_{${t2}}$ for most of the interval.`, stage: 2, failure: "selection" },
        { latex: `${XS}(1 + ${K}\\cdot ${t2})^{${t2 - t1}}`, probe: `${x}*(1+${K}*${t2})**${t2 - t1}`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "A force is not an annual effective rate.", stage: 2, failure: "selection" },
        { latex: `${XS}\\,e^{-${K}(${t2}^2 - ${t1}^2)/2}`, probe: `${x}*exp(-${K}*(${t2 * t2}-${t1 * t1})/2)`, misconception: "CONC_MOVED_WRONG_WAY", why: "That discounts instead of accumulating.", stage: 0, failure: "application" },
        { latex: `${XS}\\,e^{${K}(${t2})}`, probe: `${x}*exp(${K}*${t2})`, misconception: "CONC_TVM_FORCE_NOT_INTEGRATED", why: "The exponent must be the integral of the force, not its value at one time.", stage: 0, failure: "selection" },
      ]);
      ref = `${x}*exp(${K}*${t2}**2/2)/exp(${K}*${t1}**2/2)`;
      decision = "Evaluate the integral of the linear force between the actual dates.";
    } else if (!L3) {
      const k = rng.int(5, 12) / 100;
      const K = lit(k);
      const n = rng.int(3, 10);
      stem = `The force of interest is $\\delta_t = \\dfrac{${K}}{1 + t}$, $t \\ge 0$.\n\nDetermine which of the following expressions gives the present value at time 0 of a payment of ${XS} at time ${n}.`;
      opts = mathOptions({ latex: `${XS}(${n + 1})^{-${K}}`, probe: `${x}*${n + 1}**(-${K})`, why: `$\\int_0^{${n}} \\frac{${K}}{1+t}dt = ${K}\\ln ${n + 1}$, so $v = ${n + 1}^{-${K}}$.` }, [
        { latex: `${XS}\\,e^{-${K}(${n})}`, probe: `${x}*exp(-${K}*${n})`, misconception: "MODEL_CONSTANT_FORCE", why: "The force falls below its time-0 value.", stage: 2, failure: "selection" },
        { latex: `${XS}\\,e^{-${K}/${n + 1}}`, probe: `${x}*exp(-${K}/${n + 1})`, misconception: "CONC_TVM_FORCE_NOT_INTEGRATED", why: "The force at time " + n + " is not its integral.", stage: 0, failure: "selection" },
        { latex: `${XS}(${n + 1})^{${K}}`, probe: `${x}*${n + 1}**${K}`, misconception: "CONC_MOVED_WRONG_WAY", why: "That accumulates.", stage: 0, failure: "application" },
        { latex: `${XS}(1 - ${K}\\ln ${n + 1})`, probe: `${x}*(1-${K}*log(${n + 1}))`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "That is a linear approximation to the exponential.", stage: 2, failure: "selection" },
        { latex: `${XS}(1 + ${K})^{-${n}}`, probe: `${x}*(1+${K})**(-${n})`, misconception: "RATE_FORCE_AS_EFFECTIVE", why: "That treats the coefficient as a constant effective rate.", stage: 2, failure: "selection" },
      ]);
      ref = `${x}*exp(-${K}*log(${n + 1}))`;
      decision = "Recognise $\\int \\frac{k}{1+t}dt = k\\ln(1+t)$, so the accumulation function is a power of $1 + t$.";
    } else if (variant === 0) {
      const r = gridRate(rng, 0.03, 0.08, 0.005);
      const R = lit(r);
      const s = rng.int(1, 3);
      const t = s + rng.int(2, 6);
      stem = `The force of interest is $\\delta_t = \\dfrac{${R}}{1 + ${R}t}$, $t \\ge 0$. A payment of ${XS} is due at time ${t}.\n\nDetermine which of the following expressions gives its value at time ${s}.`;
      opts = mathOptions({ latex: `${XS}\\,\\dfrac{1 + ${R}(${s})}{1 + ${R}(${t})}`, probe: `${x}*(1+${R}*${s})/(1+${R}*${t})`, why: `$\\int \\delta_t\\,dt = \\ln(1 + ${R}t)$: the accumulation function is $a(t) = 1 + ${R}t$, simple interest from time 0.` }, [
        { latex: `\\dfrac{${XS}}{1 + ${R}(${t - s})}`, probe: `${x}/(1+${R}*${t - s})`, misconception: "CONC_TVM_CLOCK_RESTART", why: "Simple interest here runs from time 0, not from time " + s + ".", stage: 1, failure: "application" },
        { latex: `${XS}\\,e^{-${R}(${t - s})}`, probe: `${x}*exp(-${R}*${t - s})`, misconception: "MODEL_CONSTANT_FORCE", why: `The force equals ${R} only at $t = 0$; it falls afterwards.`, stage: 2, failure: "selection" },
        { latex: `${XS}(${factor(r)})^{-${t - s}}`, probe: `${x}*(1+${R})**(-${t - s})`, misconception: "MODEL_SIMPLE_AS_COMPOUND", why: "The structure is simple interest, not compound.", stage: 2, failure: "selection" },
        { latex: `${XS}\\,\\dfrac{1 + ${R}(${t})}{1 + ${R}(${s})}`, probe: `${x}*(1+${R}*${t})/(1+${R}*${s})`, misconception: "ALG_INVERTED_RATIO", why: "That moves the payment later, not earlier.", stage: 0, failure: "application" },
      ]);
      ref = `${x}*exp(log(1+${R}*${s})-log(1+${R}*${t}))`;
      decision = "Recognise the hidden structure: this force is exactly simple interest at rate $r$ from time 0.";
    } else {
      const c = gridRate(rng, 0.02, 0.05, 0.005);
      const q = rng.int(2, 8) / 1000;
      const k = rng.int(2, 4);
      const s = rng.int(0, k - 1);
      const t = k + rng.int(2, 5);
      const [C, Q] = [lit(c), lit(q)];
      const integ = (from: number) => `(${C}*${t - from}+${Q}*${(t - k) ** 2}/2)`;
      stem = `The force of interest is $\\delta_t = ${C}$ for $0 \\le t < ${k}$ and $\\delta_t = ${C} + ${Q}(t - ${k})$ for $t \\ge ${k}$. A payment of ${XS} is due at time ${t}.\n\nDetermine which of the following expressions gives its value at time ${s}.`;
      opts = mathOptions({ latex: `${XS}\\,e^{-[${C}(${t - s}) + ${Q}(${t - k})^2/2]}`, probe: `${x}*exp(-${integ(s)})`, why: `$\\int_{${s}}^{${t}}\\delta_u\\,du = ${C}(${t - s}) + ${Q}(${t - k})^2/2$.` }, [
        { latex: `${XS}\\,e^{-[${C}(${t - s}) + ${Q}(${t - s})^2/2]}`, probe: `${x}*exp(-(${C}*${t - s}+${Q}*${(t - s) ** 2}/2))`, misconception: "CONC_TVM_CLOCK_RESTART", why: `The increasing part starts at time ${k}, not at time ${s}.`, stage: 1, failure: "application" },
        { latex: `${XS}\\,e^{-${C}(${t - s})}`, probe: `${x}*exp(-${C}*${t - s})`, misconception: "TRANS_IGNORED_CONDITION", why: `The force rises after time ${k}.`, stage: 0, failure: "recognition" },
        { latex: `${XS}\\,e^{-(${C} + ${Q}\\cdot ${t - k})(${t - s})}`, probe: `${x}*exp(-(${C}+${Q}*${t - k})*${t - s})`, misconception: "MODEL_CONSTANT_FORCE", why: `That applies the time-${t} force over the whole interval.`, stage: 2, failure: "selection" },
        { latex: `${XS}\\,e^{-[${C}(${k - s}) + ${Q}(${t - k})^2/2]}`, probe: `${x}*exp(-(${C}*${k - s}+${Q}*${(t - k) ** 2}/2))`, misconception: "CONC_DOUBLE_COUNTED", why: `After time ${k} the force still includes ${C}.`, stage: 1, failure: "application" },
        { latex: `${XS}\\,e^{${C}(${t - s}) + ${Q}(${t - k})^2/2}`, probe: `${x}*exp(${integ(s)})`, misconception: "CONC_MOVED_WRONG_WAY", why: "That accumulates.", stage: 0, failure: "application" },
      ]);
      ref = `${x}*exp(-${C}*${k - s})*exp(-(${C}*${t - k}+${Q}*${(t - k) ** 2}/2))`;
      decision = `Split the integral at time ${k} and integrate each formula over its own interval.`;
    }
    return conceptQuestion({
      stem,
      ...opts,
      reference: { values: [{ label: "value", expr: ref }], description: "The factor $\\exp(\\pm\\int\\delta)$ evaluated piece by piece from the given force; each option is evaluated and compared." },
      steps: [...VARFORCE_STEPS(decision), ...(L3 ? [{ concept: variant === 0 ? "tvm.simple-vs-compound" : "tvm.changing-rates", reasoning: variant === 0 ? "Simple interest from time 0 values a payment at $s$ by $a(s)/a(t)$." : "Each piece of the force contributes over its own interval only." }] : [])],
      conditions: ["The force is a deterministic function of calendar time.", "Single payment."],
      relationship: "$\\text{Value at } s = X\\exp\\Bigl(-\\int_s^t \\delta_u\\,du\\Bigr)$",
      counterexample: "If the force were constant, only $t - s$ would matter.",
      transfer: {
        principle: "Integrate the force between the two actual dates; then exponentiate with the sign of the move.",
        unusual: L3 ? (variant === 0 ? "A familiar model is hidden inside the force." : "The force changes formula part-way.") : "The force depends on $t$.",
        misread: "A varying force cannot be replaced by its value at one time.",
      },
      itemFormat: "expression-selection",
      presentation: L3 ? ["hidden-structure", "valuation-date"] : ["valuation-date"],
      features: { unfamiliar: true, multipleValuationDates: true, multiConcept: L3 },
      modelingDecisions: L3 ? 1 : undefined,
      params: { X, variant },
    });
  },
});

const varforceStatements: ChoiceTemplate = conceptTemplate({
  id: "con-tvm-varforce-statements",
  family: "con-tvm-varforce",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.variable_force",
  secondary: ["TVM.force_of_interest", "TVM.accumulation_discount"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  soaConcept: "Judging statements about accumulation under a varying force of interest.",
  variants: 2,
  generate(rng, level, variant) {
    const L3 = level === 3;
    const common = {
      steps: VARFORCE_STEPS("Compare effective rates over intervals with the force at single times; they agree only for a constant force."),
      conditions: ["Deterministic force of interest.", "No cash flows other than those described."],
      relationship: "$a(t_1, t_2) = \\exp\\Bigl(\\int_{t_1}^{t_2}\\delta_s\\,ds\\Bigr)$; effective rate over $[n-1, n]$ $= a(n-1, n) - 1$",
      counterexample: "With a constant force $\\delta$, every year's effective rate is $e^{\\delta} - 1$.",
      transfer: {
        principle: "Turn every claim into an integral of the force over a specific interval.",
        unusual: L3 ? "The structure behind the force must be found before the statements can be judged." : "Statements mix general properties with specific values.",
        misread: "The force at a time is not the effective rate for the year that ends then.",
      },
      presentation: L3 ? (["hidden-structure", "compare-streams"] as const).slice() : level === 2 ? (["indirect-wording"] as const).slice() : (["direct"] as const).slice(),
      features: { unfamiliar: level >= 2, multiConcept: true },
      modelingDecisions: L3 ? 1 : undefined,
    };
    if (level === 1 && variant === 0) {
      return statementQuestion({
        ...common,
        stem: "Determine which of the following statements about the force of interest $\\delta_t$ are true.",
        statements: [
          statement("I", "If $\\delta_t$ is constant, the accumulation factor from $t_1$ to $t_2$ depends only on $t_2 - t_1$.", true, "$\\int_{t_1}^{t_2}\\delta\\,ds = \\delta(t_2 - t_1)$.", "MODEL_CONSTANT_FORCE", { stage: 1, failure: "application" }),
          statement("II", "If $\\delta_t$ increases with $t$, the effective rate of interest earned in year 2 exceeds that earned in year 1.", true, "The integral over $[1, 2]$ exceeds that over $[0, 1]$.", "CONC_DIRECTION_REVERSED", { stage: 2, failure: "conclusion" }),
          statement("III", "The effective rate of interest earned in year $n$ equals $\\delta_n$.", false, "It equals $\\exp(\\int_{n-1}^{n}\\delta_s\\,ds) - 1$.", "RATE_FORCE_AS_EFFECTIVE", { stage: 2, failure: "selection", conditionTrue: "Never exactly; even a constant force gives $e^{\\delta} - 1$." }),
        ],
        extra: [
          { keys: ["II", "III"], misconception: "CONC_TVM_FORCE_NOT_INTEGRATED", why: "Rejecting I and accepting III treats the force at one time as the integral.", stage: 0, failure: "selection" },
          { keys: ["III"], misconception: "CONC_RELATED_TERM", why: "Accepting only III confuses the force with an effective rate.", stage: 2, failure: "selection" },
        ],
        params: { variant },
      });
    }
    if (level === 1) {
      const c = gridRate(rng, 0.02, 0.05, 0.005);
      const k = rng.int(2, 6) / 1000;
      const n = rng.int(3, 8);
      const [C, K] = [lit(c), lit(k)];
      const ln = `(${C}*${n}+${K}*${n * n}/2)`;
      const ln1 = `(${C}*${n - 1}+${K}*${(n - 1) ** 2}/2)`;
      return statementQuestion({
        ...common,
        stem: `The force of interest is $\\delta_t = ${C} + ${K}\\,t$, $t \\ge 0$, and $a(t)$ is the accumulation function.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `$a(${n}) = e^{${C}(${n}) + ${K}(${n})^2/2}$.`, true, `$\\int_0^{${n}}(${C} + ${K}t)\\,dt = ${C}(${n}) + ${K}(${n})^2/2$.`, "CONC_TVM_FORCE_NOT_INTEGRATED", { stage: 0, failure: "application", check: { expr: `exp(${ln})`, op: "=", than: `exp(${n}*(${C}+${K}*${n}/2))` } }),
          statement("II", `The effective rate of interest earned during year ${n} is $${C} + ${K}(${n})$.`, false, `It is $a(${n})/a(${n - 1}) - 1 = ${p2(Math.exp(c + (k * (2 * n - 1)) / 2) - 1)}$.`, "RATE_FORCE_AS_EFFECTIVE", { stage: 2, failure: "selection", check: { expr: `exp(${ln}-${ln1})-1`, op: "=", than: `${C}+${K}*${n}` } }),
          statement("III", `The present value at time 0 of 1 payable at time ${n} is $1/a(${n})$.`, true, "Discounting reverses the accumulation over the same interval.", "CONC_MOVED_WRONG_WAY", { stage: 1, failure: "application" }),
        ],
        extra: [
          { keys: ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "Accepting only II misjudges both true statements.", stage: 2, failure: "conclusion" },
          { keys: ["II", "III"], misconception: "MODEL_CONSTANT_FORCE", why: "Rejecting I and accepting II treats the force as constant at its year-end value.", stage: 1, failure: "selection" },
        ],
        params: { c, k, n, variant },
      });
    }
    if (level === 2 && variant === 0) {
      return statementQuestion({
        ...common,
        stem: "The force of interest $\\delta_t$ is positive and varies with $t$, and $a(t) = \\exp\\bigl(\\int_0^t \\delta_s\\,ds\\bigr)$.\n\nDetermine which of the following statements are true.",
        statements: [
          statement("I", "The value at time 3 of 1 payable at time 5 is $a(3)/a(5)$.", true, "Discount from 5 to 0 with $1/a(5)$, then accumulate to 3 with $a(3)$.", "CONC_MOVED_WRONG_WAY", { stage: 1, failure: "application" }),
          statement("II", "For all $t_1 < t_2$, the accumulation factor from $t_1$ to $t_2$ equals $a(t_2 - t_1)$.", false, "With a varying force the factor depends on where the interval lies.", "CONC_TVM_CLOCK_RESTART", { stage: 1, failure: "application", conditionTrue: "True if the force is constant." }),
          statement("III", "$a(t)$ is increasing.", true, "$a'(t) = \\delta_t\\,a(t) > 0$.", "CONC_TVM_DERIVATIVE_AS_FORCE", { stage: 0, failure: "recognition" }),
        ],
        extra: [
          { keys: ["II"], misconception: "MODEL_CONSTANT_FORCE", why: "Accepting only II treats the force as constant and misjudges the others.", stage: 1, failure: "selection" },
          { keys: ["I", "II"], misconception: "CONC_TVM_FORCE_NOT_INTEGRATED", why: "Rejecting III misreads how a positive force drives the accumulation function.", stage: 0, failure: "recognition" },
        ],
        params: { variant },
      });
    }
    if (level === 2) {
      const k = rng.int(5, 12) / 100;
      const K = lit(k);
      const n = rng.int(2, 8);
      const rate = (m: number) => `((${m + 1}/${m})**${K}-1)`;
      return statementQuestion({
        ...common,
        stem: `The force of interest is $\\delta_t = \\dfrac{${K}}{1 + t}$, $t \\ge 0$, and $a(t)$ is the accumulation function.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `$a(${n}) = (${n + 1})^{${K}}$.`, true, `$\\int_0^{${n}} \\frac{${K}}{1+t}dt = ${K}\\ln ${n + 1}$.`, "CONC_TVM_FORCE_NOT_INTEGRATED", { stage: 0, failure: "application", check: { expr: `exp(${K}*log(${n + 1}))`, op: "=", than: `${n + 1}**${K}` } }),
          statement("II", `The effective rate of interest earned during year ${n} exceeds that earned during year ${n + 1}.`, true, "The force decreases, so each year's integral is smaller than the last.", "CONC_DIRECTION_REVERSED", { stage: 2, failure: "conclusion", check: { expr: `${rate(n)}-${rate(n + 1)}`, op: ">", than: 0 } }),
          statement("III", `The effective rate of interest earned during year ${n} is $${K}/${n + 1}$.`, false, `It is $(${n + 1}/${n})^{${K}} - 1 = ${p2(Math.pow((n + 1) / n, k) - 1)}$.`, "RATE_FORCE_AS_EFFECTIVE", { stage: 2, failure: "selection", check: { expr: rate(n), op: "=", than: `${K}/${n + 1}` } }),
        ],
        extra: [
          { keys: ["III"], misconception: "MODEL_CONSTANT_FORCE", why: "Accepting only III treats the force as an annual rate.", stage: 2, failure: "selection" },
          { keys: ["II", "III"], misconception: "CONC_RELATED_TERM", why: "Rejecting I and accepting III confuses the force with the effective rate.", stage: 0, failure: "application" },
        ],
        params: { k, n, variant },
      });
    }
    if (variant === 0) {
      const c = gridRate(rng, 0.02, 0.05, 0.005);
      const q = rng.int(2, 8) / 1000;
      const k = rng.int(2, 4);
      const n = k + rng.int(3, 6);
      const [C, Q] = [lit(c), lit(q)];
      return statementQuestion({
        ...common,
        stem: `The force of interest is $\\delta_t = ${C}$ for $0 \\le t < ${k}$ and $\\delta_t = ${C} + ${Q}(t - ${k})$ for $t \\ge ${k}$.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The value at time ${k} of 1 payable at time ${n} is $e^{-[${C}(${n - k}) + ${Q}(${n - k})^2/2]}$.`, true, `$\\int_{${k}}^{${n}}\\delta_t\\,dt = ${C}(${n - k}) + ${Q}(${n - k})^2/2$.`, "CONC_TVM_CLOCK_RESTART", { stage: 1, failure: "application", check: { expr: `exp(-(${C}*${n - k}+${Q}*${(n - k) ** 2}/2))`, op: "=", than: `exp(-${C}*${n})/exp(-${C}*${k})*exp(-${Q}*${(n - k) ** 2}/2)` } }),
          statement("II", `The effective rate of interest earned during year ${k + 1} is $e^{${C} + ${Q}/2} - 1$.`, true, `$\\int_{${k}}^{${k + 1}}\\delta_t\\,dt = ${C} + ${Q}/2$.`, "CONC_TVM_FORCE_NOT_INTEGRATED", { stage: 2, failure: "application", check: { expr: `exp(${C}+${Q}/2)-1`, op: "=", than: `exp(${C}*1+${Q}*1/2)-1` } }),
          statement("III", `The present value at time 0 of 1 payable at time ${n} is $e^{-(${C} + ${Q}\\cdot ${n - k})(${n})}$.`, false, `The force reaches $${C} + ${Q}(${n - k})$ only at time ${n}; the exponent is $${C}(${n}) + ${Q}(${n - k})^2/2$.`, "MODEL_CONSTANT_FORCE", { stage: 2, failure: "selection", check: { expr: `exp(-(${C}+${Q}*${n - k})*${n})`, op: "=", than: `exp(-(${C}*${n}+${Q}*${(n - k) ** 2}/2))` } }),
        ],
        extra: [
          { keys: ["III"], misconception: "RATE_FORCE_AS_EFFECTIVE", why: "Accepting only III misjudges both integrals.", stage: 2, failure: "selection" },
          { keys: ["I", "III"], misconception: "TRANS_IGNORED_CONDITION", why: "Rejecting II overlooks that year " + (k + 1) + " lies in the increasing piece.", stage: 1, failure: "application" },
        ],
        params: { c, q, k, n, variant },
      });
    }
    const c = gridRate(rng, 0.03, 0.07, 0.005);
    const n = 2 * rng.int(3, 6);
    const C = lit(c);
    return statementQuestion({
      ...common,
      stem: `Fund A grows at a constant force of interest of ${pc(c)}. Fund B grows at force $\\delta_t = ${lit((2 * c) / n)}\\,t$. Each fund receives 1 at time 0.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `The two funds have the same value at time ${n}.`, true, `$\\int_0^{${n}} ${lit((2 * c) / n)}\\,t\\,dt = ${lit((2 * c) / n)}(${n})^2/2 = ${lit(c * n)}$, the same as A's $${C}(${n})$.`, "CONC_TVM_FORCE_NOT_INTEGRATED", { stage: 0, failure: "application", check: { expr: `exp(${C}*${n})`, op: "=", than: `exp(${lit((2 * c) / n)}*${n * n}/2)` } }),
        statement("II", `Fund B has the larger value at time ${n / 2}.`, false, `B's exponent at ${n / 2} is $${lit(c * n / 4)}$, below A's $${lit(c * n / 2)}$.`, "CONC_TVM_AVERAGE_RATE", { stage: 2, failure: "connection", check: { expr: `exp(${lit((2 * c) / n)}*${(n / 2) ** 2}/2)-exp(${C}*${n / 2})`, op: ">", than: 0 }, conditionTrue: `True at any time after ${n}; before ${n}, A is larger.` }),
        statement("III", "During the final year, Fund B earns a higher effective rate of interest than Fund A.", true, `B's integral over the last year is $${C}(${2 * n - 1})/${n} > ${C}$.`, "CONC_DIRECTION_REVERSED", { stage: 2, failure: "conclusion", check: { expr: `${lit((2 * c) / n)}*(${n * n}-${(n - 1) ** 2})/2-${C}`, op: ">", than: 0 } }),
      ],
      extra: [
        { keys: ["II"], misconception: "MODEL_CONSTANT_FORCE", why: "Accepting only II misjudges both integrals.", stage: 1, failure: "selection" },
        { keys: ["II", "III"], misconception: "RATE_FORCE_AS_EFFECTIVE", why: "Rejecting I compares the forces at one time instead of their integrals.", stage: 0, failure: "application" },
      ],
      params: { c, n, variant },
    });
  },
});

export const TVM_CONCEPT_TEMPLATES: ChoiceTemplate[] = [
  equationOfValue,
  simpleRates,
  simpleExpression,
  simpleStatements,
  amountInterpretation,
  accumulationValid,
  amountDiagnosis,
  valueInterpretation,
  valueTimeline,
  valueStatements,
  nominalDefinition,
  nominalExpression,
  nominalDiagnosis,
  rateFrequency,
  discountDefinition,
  discountExpression,
  discountStatements,
  forceInterpretation,
  rateOrdering,
  forceDiagnosis,
  realInterpretation,
  realExpression,
  realStatements,
  equivalenceInterpretation,
  equivalenceDiagnosis,
  varforceInterpretation,
  varforceExpression,
  varforceStatements,
];
