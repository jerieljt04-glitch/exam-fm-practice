/**
 * Single-formula templates (integration level 1): the formula is the whole
 * problem, so they test recognising and applying it cleanly. They give the
 * "single formula" share of formula practice its own pool.
 */
import { Da, Ia, adue, an, geometricPV, sdue, sn } from "../finance";
import type { QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY2,
  PCT3,
  aExpr,
  aSym,
  accPow,
  adueExpr,
  amt,
  avTerms,
  chain,
  dec,
  distractor,
  explanation,
  features,
  gridAmount,
  gridRate,
  level,
  lit,
  mnum,
  pc,
  pvTerms,
  range,
  sExpr,
  sSym,
  shown,
  step,
  word,
} from "./kit";

const IaExpr = (n: number, i: number) => `((${adueExpr(n, i)} - ${n}*(1+${lit(i)})**(-${n}))/${lit(i)})`;
const DaExpr = (n: number, i: number) => `((${n} - ${aExpr(n, i)})/${lit(i)})`;

// ===================================================================== present value of a level annuity

const fundWithdrawals: QuestionTemplate = {
  id: "one-fund-withdrawals",
  family: "one-annuity",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.immediate_due"],
  reasoning: ["formula_selection", "cashflow_modelling"],
  soaConcept: "Present value of a level annuity-immediate.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const n = rng.int(8, 25);
    const X = gridAmount(rng, 2000, 15000, 250);
    const PV = X * an(n, i);
    const fmt = MONEY2;
    return {
      stem: `A fund will pay ${amt(X)} at the end of each year for ${n} years, after which it is exhausted. The fund earns an annual effective rate of ${pc(i, 2)}.\n\nCalculate the amount that must be in the fund today.`,
      answer: { value: PV, calc: `${lit(X)}*${aExpr(n, i)}`, format: fmt, derivation: `$${X}\\,${aSym(n)} = ${X} \\times ${dec(an(n, i), 5)} = ${shown(PV, fmt)}$` },
      model: { expr: pvTerms(level(X, range(1, n)), i), description: "Each withdrawal discounted from its own date to today." },
      distractors: [
        distractor("TIMING_IMMEDIATE_AS_DUE", X * adue(n, i), `${lit(X)}*${adueExpr(n, i)}`, {
          derivation: `$${X}\\,\\ddot a_{\\overline{${n}|}} = ${shown(X * adue(n, i), fmt)}$`,
          method: "Treated the first withdrawal as immediate.",
          feedback: "The first payment is at the end of the first year: annuity-immediate.",
        }),
        distractor("FORMULA_AV_FOR_PV", X * sn(n, i), `${lit(X)}*${sExpr(n, i)}`, {
          derivation: `$${X}\\,${sSym(n)} = ${shown(X * sn(n, i), fmt)}$`,
          method: "Used the accumulated-value factor.",
          feedback: "The amount needed today is a present value: use a, not s.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", n * X, `${n}*${lit(X)}`, {
          derivation: `$${n} \\times ${X} = ${shown(n * X, fmt)}$`,
          method: "Added the withdrawals.",
          feedback: "The fund earns interest while it pays out, so it needs less than the total of the withdrawals.",
        }),
        distractor("FORMULA_PERPETUITY_FOR_FINITE", X / i, `${lit(X)}/${lit(i)}`, {
          derivation: `$${X}/i = ${shown(X / i, fmt)}$`,
          method: "Valued the withdrawals as a perpetuity.",
          feedback: `The withdrawals stop after ${n} years.`,
        }),
        distractor("TIMING_EXTRA_PERIOD", X * an(n + 1, i), `${lit(X)}*${aExpr(n + 1, i)}`, {
          derivation: `$${X}\\,${aSym(n + 1)} = ${shown(X * an(n + 1, i), fmt)}$`,
          method: `Counted ${n + 1} withdrawals.`,
          feedback: `Payments at the ends of years 1 to ${n}: exactly ${n} of them.`,
        }),
      ],
      explanation: explanation({
        intuition: "The fund only has to hold what the withdrawals are worth today; interest earned along the way makes up the rest.",
        translation: {
          unknowns: [{ symbol: "$F$", meaning: "fund needed today" }],
          relationships: [`$F = ${X}\\,${aSym(n)}$`],
          conditions: ["The fund is exactly exhausted by the last withdrawal."],
          valuationDate: "Today, one year before the first withdrawal.",
          modelChoice: "Level end-of-year payments: annuity-immediate.",
          assumptions: ["Constant annual effective rate."],
        },
        solution: [
          { title: "Annuity factor", body: `$${aSym(n)} = \\dfrac{1 - v^{${n}}}{i} = ${dec(an(n, i), 5)}$` },
          { title: "Fund", body: `$F = ${X} \\times ${dec(an(n, i), 5)} = ${shown(PV, fmt)}$` },
        ],
        alternatives: [{ name: "Calculator", body: `N = ${n}, I/Y = ${dec(i * 100, 2)}, PMT = ${X}, FV = 0, CPT PV.`, whenUseful: "The fastest route for a level annuity." }],
        transfer: {
          principle: "A fund that is exhausted by its payments holds exactly their present value.",
          unusual: "Nothing — a direct application.",
          misread: "Using s, or starting the payments immediately.",
        },
      }),
      visuals: [{ kind: "timeline", title: "Withdrawals", unit: "year", rate: i, flows: range(1, n).map((t) => ({ t, amount: X, dir: "out" as const })), valuationTimes: [0] }],
      markers: [an(n, i)],
      presentation: ["direct"],
      features: features({ steps: 1 }),
      params: { X, n, i },
      chain: chain([step("B.annuity-immediate", "Level end-of-year payments valued one period before the first.", ["F", PV, "fund needed today"], ["X", "n", "i"])], {
        stages: {
          TIMING_IMMEDIATE_AS_DUE: [0, "selection", "B.annuity-due"],
          FORMULA_AV_FOR_PV: [0, "selection", "B.annuity-immediate-av"],
          SEQ_UNDISCOUNTED_SUM: [0, "selection"],
          FORMULA_PERPETUITY_FOR_FINITE: [0, "selection", "B.perpetuity"],
          TIMING_EXTRA_PERIOD: [0, "application"],
        },
        reasoning: "Sum the discounted withdrawals: a geometric series with first term Xv and ratio v.",
      }),
    };
  },
};

// ===================================================================== accumulated value of deposits in advance

const depositsAdvance: QuestionTemplate = {
  id: "one-deposits-advance",
  family: "one-annuity",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "valuation_dates"],
  soaConcept: "Accumulated value of a level annuity-due.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const n = rng.int(8, 25);
    const X = gridAmount(rng, 500, 6000, 100);
    const AV = X * sdue(n, i);
    const fmt = MONEY2;
    const simple = X * n + X * i * ((n * (n + 1)) / 2);
    return {
      stem: `${amt(X)} is deposited at the beginning of each year for ${n} years into an account earning an annual effective rate of ${pc(i, 2)}.\n\nCalculate the account balance at the end of year ${n}.`,
      answer: { value: AV, calc: `${lit(X)}*${sExpr(n, i)}*(1+${lit(i)})`, format: fmt, derivation: `$${X}\\,\\ddot s_{\\overline{${n}|}} = ${shown(AV, fmt)}$` },
      model: { expr: avTerms(level(X, range(0, n - 1)), i, n), description: "Each deposit accumulated from its own date to the end of year n." },
      distractors: [
        distractor("TIMING_DUE_AS_IMMEDIATE", X * sn(n, i), `${lit(X)}*${sExpr(n, i)}`, {
          derivation: `$${X}\\,${sSym(n)} = ${shown(X * sn(n, i), fmt)}$`,
          method: "Valued the deposits as end-of-year payments.",
          feedback: "Each deposit earns one more year of interest than an end-of-year deposit would.",
        }),
        distractor("TIMING_VALUATION_DATE", X * adue(n, i), `${lit(X)}*${adueExpr(n, i)}`, {
          derivation: `$${X}\\,\\ddot a_{\\overline{${n}|}} = ${shown(X * adue(n, i), fmt)}$`,
          method: "Computed the present value.",
          feedback: `The balance is wanted at the end of year ${n}, not today.`,
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", n * X, `${n}*${lit(X)}`, {
          derivation: `$${n} \\times ${X} = ${shown(n * X, fmt)}$`,
          method: "Added the deposits.",
          feedback: "Every deposit earns interest until the end of the term.",
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `${lit(X)}*${n} + ${lit(X)}*${lit(i)}*${(n * (n + 1)) / 2}`, {
          derivation: `simple interest on each deposit: $${shown(simple, fmt)}$`,
          method: "Accumulated each deposit with simple interest.",
          feedback: "Interest is credited and itself earns interest: compound accumulation.",
        }),
        distractor("TIMING_EXTRA_PERIOD", AV * (1 + i), `${lit(X)}*${sExpr(n, i)}*(1+${lit(i)})**2`, {
          derivation: `$${X}\\,\\ddot s_{\\overline{${n}|}}(1+i) = ${shown(AV * (1 + i), fmt)}$`,
          method: "Accumulated one year too far.",
          feedback: `$\\ddot s$ already gives the value at the end of year ${n}.`,
        }),
      ],
      explanation: explanation({
        intuition: "A deposit at the start of a year has the whole year to grow, so the first deposit grows for n years and the last for one.",
        translation: {
          unknowns: [{ symbol: "$B$", meaning: `balance at the end of year ${n}` }],
          relationships: [`$B = ${X}\\,\\ddot s_{\\overline{${n}|}} = ${X}\\,${sSym(n)}(1+i)$`],
          conditions: ["Deposits at the beginning of each year."],
          valuationDate: `End of year ${n}, one year after the last deposit.`,
          modelChoice: "Annuity-due, accumulated value.",
          assumptions: ["Constant annual effective rate."],
        },
        solution: [
          { title: "Factor", body: `$\\ddot s_{\\overline{${n}|}} = ${dec(sdue(n, i), 5)}$` },
          { title: "Balance", body: `$B = ${X} \\times ${dec(sdue(n, i), 5)} = ${shown(AV, fmt)}$` },
        ],
        alternatives: [{ name: "From the annuity-immediate", body: `$${sSym(n)} = ${dec(sn(n, i), 5)}$, then multiply by $1+i$.`, whenUseful: "When only s is remembered." }],
        transfer: {
          principle: "Annuity-due values are annuity-immediate values one period later: multiply by (1 + i).",
          unusual: "Nothing — a direct application.",
          misread: "Missing the extra year of interest on beginning-of-year deposits.",
        },
      }),
      visuals: [{ kind: "timeline", title: "Deposits at the start of each year", unit: "year", rate: i, flows: range(0, n - 1).map((t) => ({ t, amount: X, dir: "out" as const })), valuationTimes: [n] }],
      markers: [sdue(n, i), sn(n, i)],
      presentation: ["direct", "valuation-date"],
      features: features({ steps: 1 }),
      params: { X, n, i },
      chain: chain([step("B.annuity-due-av", "Beginning-of-year deposits valued at the end of the term.", ["B", AV, `balance at the end of year ${n}`], ["X", "n", "i"], { valuationDate: `${n}` })], {
        stages: {
          TIMING_DUE_AS_IMMEDIATE: [0, "selection", "B.annuity-immediate-av"],
          TIMING_VALUATION_DATE: [0, "selection", "B.annuity-due"],
          SEQ_UNDISCOUNTED_SUM: [0, "selection"],
          MODEL_COMPOUND_AS_SIMPLE: [0, "selection", "A.simple"],
          TIMING_EXTRA_PERIOD: [0, "application"],
        },
        reasoning: "Accumulate each deposit: X(1+i)^n + … + X(1+i) — a geometric series with ratio 1 + i.",
      }),
    };
  },
};

// ===================================================================== nominal discount to effective interest

const discountToInterest: QuestionTemplate = {
  id: "one-discount-to-interest",
  family: "one-rates",
  topic: "TVM",
  levels: [1],
  objective: "TVM.discount_rates",
  secondary: ["TVM.effective_nominal"],
  reasoning: ["formula_selection", "translation"],
  soaConcept: "Equivalent annual effective interest rate from a nominal discount rate.",
  generate(rng): QuestionDraft {
    const m = rng.choice([2, 4, 12]);
    const dm = gridRate(rng, 0.04, 0.09, 0.0025);
    const i = Math.pow(1 - dm / m, -m) - 1;
    const fmt = PCT3;
    const words: Record<number, string> = { 2: "semiannually", 4: "quarterly", 12: "monthly" };
    const asInterest = Math.pow(1 + dm / m, m) - 1;
    const effDiscount = 1 - Math.pow(1 - dm / m, m);
    const simpleConv = dm / (1 - dm);
    const perPeriod = Math.pow(1 - dm / m, -1) - 1;
    return {
      stem: `An account is credited using a nominal annual rate of discount of ${pc(dm, 2)} convertible ${words[m]}.\n\nCalculate the equivalent annual effective rate of interest.`,
      answer: { value: i, calc: `(1-${lit(dm)}/${m})**(-${m}) - 1`, format: fmt, derivation: `$\\left(1 - \\tfrac{${dec(dm, 4)}}{${m}}\\right)^{-${m}} - 1 = ${shown(i, fmt)}$` },
      model: { expr: `(1+x)*(1-${lit(dm)}/${m})**${m} - 1`, bracket: [0.0001, 0.3], description: "One unit grows to 1 + i in a year; discounting it back with the nominal discount rate returns exactly 1." },
      distractors: [
        distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `(1+${lit(dm)}/${m})**${m} - 1`, {
          derivation: `$(1 + d^{(${m})}/${m})^{${m}} - 1 = ${shown(asInterest, fmt)}$`,
          method: "Converted the discount rate as if it were an interest rate.",
          feedback: "A discount rate is charged in advance: the factor is (1 − d/m)^{−m}, not (1 + d/m)^m.",
        }),
        distractor("RATE_NOMINAL_AS_EFFECTIVE", dm, lit(dm), {
          derivation: `$d^{(${m})} = ${shown(dm, fmt)}$`,
          method: "Reported the nominal rate.",
          feedback: "A nominal rate is not an annual effective rate; it must be converted.",
        }),
        distractor("VAR_OTHER_UNKNOWN", effDiscount, `1 - (1-${lit(dm)}/${m})**${m}`, {
          derivation: `$1 - (1 - d^{(${m})}/${m})^{${m}} = ${shown(effDiscount, fmt)}$`,
          method: "Found the annual effective rate of discount.",
          feedback: "That is d, the effective discount rate; the question asks for the effective interest rate i = d/(1 − d).",
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", simpleConv, `${lit(dm)}/(1-${lit(dm)})`, {
          derivation: `$d/(1-d)$ with the nominal rate: $${shown(simpleConv, fmt)}$`,
          method: "Applied i = d/(1 − d) to the nominal rate directly.",
          feedback: `The nominal rate compounds ${m} times a year; convert it to an effective rate first.`,
        }),
        distractor("RATE_PAYMENT_FREQUENCY", perPeriod, `(1-${lit(dm)}/${m})**(-1) - 1`, {
          derivation: `$(1 - d^{(${m})}/${m})^{-1} - 1 = ${shown(perPeriod, fmt)}$`,
          method: `Gave the effective rate per ${m === 12 ? "month" : m === 4 ? "quarter" : "half-year"}.`,
          feedback: "That is the rate for one conversion period; compound it over the year.",
        }),
      ],
      explanation: explanation({
        intuition: `Discount at ${pc(dm / m, 4)} per period means paying ${dec(1 - dm / m, 6)} now for 1 at the end of the period. Over the year 1 grows by the reciprocal of that factor, ${m} times.`,
        translation: {
          unknowns: [{ symbol: "$i$", meaning: "annual effective interest rate" }],
          relationships: [`$1 + i = \\left(1 - \\tfrac{d^{(${m})}}{${m}}\\right)^{-${m}}$`],
          conditions: [`Discount convertible ${m} times a year.`],
          valuationDate: "One year.",
          modelChoice: "Equate one-year accumulation factors.",
          assumptions: ["Compound interest."],
        },
        solution: [
          { title: "Per-period factor", body: `$1 - ${dec(dm, 4)}/${m} = ${dec(1 - dm / m, 6)}$` },
          { title: "Annual", body: `$i = ${dec(1 - dm / m, 6)}^{-${m}} - 1 = ${shown(i, fmt)}$` },
        ],
        alternatives: [{ name: "Through d", body: `$d = 1 - (1 - d^{(${m})}/${m})^{${m}} = ${dec(effDiscount, 6)}$, then $i = d/(1 - d)$.`, whenUseful: "When you prefer to convert to effective discount first." }],
        transfer: {
          principle: "All equivalent rates give the same one-year accumulation factor; write each one as a factor and set them equal.",
          unusual: "The rate quoted is a discount rate, not an interest rate.",
          misread: "Treating d^{(m)} like i^{(m)}.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "From the quoted rate to the effective rate",
          nodes: [
            { id: "q", label: `$d^{(${m})} = ${dec(dm, 4)}$`, tone: "input" },
            { id: "p", label: `$1 - d^{(${m})}/${m} = ${dec(1 - dm / m, 6)}$`, tone: "step" },
            { id: "i", label: `$i = ${dec(i, 6)}$`, tone: "result" },
          ],
          edges: [
            { from: "q", to: "p", label: "per period" },
            { from: "p", to: "i", label: `power −${m}` },
          ],
        },
      ],
      markers: [1 - dm / m, effDiscount],
      presentation: ["direct"],
      features: features({ steps: 1, formulaRetrieval: true }),
      params: { dm, m },
      chain: chain([step("A.nominal-equivalence", "Equate the one-year accumulation factors.", ["i", i, "annual effective interest rate"], ["d^(m)", "m"])], {
        stages: {
          RATE_DISCOUNT_AS_INTEREST: [0, "application"],
          RATE_NOMINAL_AS_EFFECTIVE: [0, "selection"],
          VAR_OTHER_UNKNOWN: [0, "interpretation"],
          MODEL_COMPOUND_AS_SIMPLE: [0, "selection", "A.interest-discount"],
          RATE_PAYMENT_FREQUENCY: [0, "application"],
        },
        reasoning: "Paying 1 − d/m now buys 1 at the end of each period; one year is m such periods.",
      }),
    };
  },
};

// ===================================================================== loan payment

const loanPayment: QuestionTemplate = {
  id: "one-loan-payment",
  family: "one-loan",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.amortization",
  secondary: ["LOANS.unknown_variables"],
  reasoning: ["formula_selection", "cashflow_modelling"],
  soaConcept: "Level payment of an amortized loan.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 20000, 300000, 5000);
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const n = rng.int(8, 30);
    const P = L / an(n, i);
    const fmt = MONEY2;
    const flat = L / n + L * i;
    return {
      stem: `A loan of ${amt(L)} is repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i, 2)}.\n\nCalculate the annual payment.`,
      answer: { value: P, calc: `${lit(L)}/${aExpr(n, i)}`, format: fmt, derivation: `$P = ${L}/${aSym(n)} = ${L}/${dec(an(n, i), 5)} = ${shown(P, fmt)}$` },
      model: { expr: `${pvTerms(level("x", range(1, n)), i)} - ${lit(L)}`, bracket: [0, L], description: "The loan equals the present value of the payments." },
      distractors: [
        distractor("TIMING_IMMEDIATE_AS_DUE", L / adue(n, i), `${lit(L)}/${adueExpr(n, i)}`, {
          derivation: `$${L}/\\ddot a_{\\overline{${n}|}} = ${shown(L / adue(n, i), fmt)}$`,
          method: "Started the payments immediately.",
          feedback: "Payments are at the end of each year: annuity-immediate.",
        }),
        distractor("FORMULA_AV_FOR_PV", L / sn(n, i), `${lit(L)}/${sExpr(n, i)}`, {
          derivation: `$${L}/${sSym(n)} = ${shown(L / sn(n, i), fmt)}$`,
          method: "Divided by the accumulated-value factor.",
          feedback: "The loan is paid out today, so it equals a present value: divide by a, not s. (L/s is a sinking-fund deposit.)",
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", flat, `${lit(L)}/${n} + ${lit(L)}*${lit(i)}`, {
          derivation: `$${L}/${n} + ${L}i = ${shown(flat, fmt)}$`,
          method: "Repaid L/n each year plus interest on the original loan.",
          feedback: "Interest is charged on the outstanding balance, which falls as the loan is repaid.",
        }),
        distractor("FORMULA_PERPETUITY_FOR_FINITE", L * i, `${lit(L)}*${lit(i)}`, {
          derivation: `$${L}i = ${shown(L * i, fmt)}$`,
          method: "Paid only the interest.",
          feedback: "Interest-only payments never reduce the balance; the payment must also repay principal.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", L / n, `${lit(L)}/${n}`, {
          derivation: `$${L}/${n} = ${shown(L / n, fmt)}$`,
          method: "Divided the loan by the number of payments.",
          feedback: "Payments made later are worth less today, so each must be larger than L/n.",
        }),
      ],
      explanation: explanation({
        intuition: "The lender hands over L today in exchange for n payments; the payments must be worth exactly L at the loan rate.",
        translation: {
          unknowns: [{ symbol: "$P$", meaning: "level annual payment" }],
          relationships: [`$${L} = P\\,${aSym(n)}$`],
          conditions: ["Loan fully repaid by the last payment."],
          valuationDate: "The loan date.",
          modelChoice: "Present value of an annuity-immediate equals the loan.",
          assumptions: ["Constant rate."],
        },
        solution: [
          { title: "Annuity factor", body: `$${aSym(n)} = ${dec(an(n, i), 5)}$` },
          { title: "Payment", body: `$P = ${shown(P, fmt)}$` },
        ],
        alternatives: [{ name: "Calculator", body: `N = ${n}, I/Y = ${dec(i * 100, 2)}, PV = ${L}, FV = 0, CPT PMT.`, whenUseful: "The standard route in the exam." }],
        transfer: {
          principle: "For any amortized loan, the loan equals the present value of the payments at the loan rate.",
          unusual: "Nothing — a direct application.",
          misread: "Dividing by s, or charging interest on the original amount.",
        },
      }),
      visuals: [{ kind: "amortization", title: "Repayment schedule", principal: L, rate: i, payments: Array.from({ length: n }, () => P), unit: "year" }],
      markers: [an(n, i)],
      presentation: ["direct"],
      features: features({ steps: 1 }),
      params: { L, i, n },
      chain: chain([step("D.loan-payment", "The loan equals the present value of the payments.", ["P", P, "annual payment"], ["L", "n", "i"])], {
        stages: {
          TIMING_IMMEDIATE_AS_DUE: [0, "application"],
          FORMULA_AV_FOR_PV: [0, "selection", "B.annuity-immediate-av"],
          MODEL_INTEREST_ON_ORIGINAL: [0, "selection"],
          FORMULA_PERPETUITY_FOR_FINITE: [0, "selection", "B.perpetuity"],
          SEQ_UNDISCOUNTED_SUM: [0, "selection"],
        },
        reasoning: "Write L = Pv + Pv² + … + Pvⁿ and divide by the geometric sum.",
      }),
    };
  },
};

// ===================================================================== increasing annuity

const increasing: QuestionTemplate = {
  id: "one-increasing-annuity",
  family: "one-varying",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.non_level"],
  reasoning: ["formula_selection", "formula_retrieval"],
  soaConcept: "Present value of an increasing annuity-immediate.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const n = rng.int(6, 20);
    const X = gridAmount(rng, 100, 1500, 50);
    const PV = X * Ia(n, i);
    const fmt = MONEY2;
    const levelAvg = X * ((n + 1) / 2) * an(n, i);
    return {
      stem: `A payment of ${amt(X)} is made at the end of year 1, ${amt(2 * X)} at the end of year 2, and so on, increasing by ${amt(X)} each year until the final payment of ${amt(n * X)} at the end of year ${n}. The annual effective interest rate is ${pc(i, 2)}.\n\nCalculate the present value of the payments.`,
      answer: { value: PV, calc: `${lit(X)}*${IaExpr(n, i)}`, format: fmt, derivation: `$${X}\\,(Ia)_{\\overline{${n}|}} = ${X} \\times ${dec(Ia(n, i), 5)} = ${shown(PV, fmt)}$` },
      model: { expr: pvTerms(range(1, n).map((t) => ({ t, amount: t * X })), i), description: "Payment t·X discounted from time t, summed." },
      distractors: [
        distractor("FORMULA_DECREASING_FOR_INCREASING", X * Da(n, i), `${lit(X)}*${DaExpr(n, i)}`, {
          derivation: `$${X}\\,(Da)_{\\overline{${n}|}} = ${shown(X * Da(n, i), fmt)}$`,
          method: "Used the decreasing-annuity factor.",
          feedback: "The payments start small and grow: (Ia), not (Da).",
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", levelAvg, `${lit(X)}*${(n + 1) / 2}*${aExpr(n, i)}`, {
          derivation: `average payment $\\times\\,${aSym(n)}$: $${shown(levelAvg, fmt)}$`,
          method: "Valued the average payment as a level annuity.",
          feedback: "The large payments come late and are discounted most, so averaging overstates the value.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", (X * n * (n + 1)) / 2, `${lit(X)}*${(n * (n + 1)) / 2}`, {
          derivation: `$${X}(1 + 2 + \\cdots + ${n}) = ${shown((X * n * (n + 1)) / 2, fmt)}$`,
          method: "Added the payments.",
          feedback: "Each payment must be discounted from its own date.",
        }),
        distractor("SEQ_ARITHMETIC_AS_GEOMETRIC", X * geometricPV(n, i, 1), `${lit(X)}*(1-(2/(1+${lit(i)}))**${n})/(${lit(i)}-1)`, {
          derivation: `growth taken as 100% a year: $${shown(X * geometricPV(n, i, 1), fmt)}$`,
          method: "Treated the payments as doubling each year.",
          feedback: "They rise by a fixed amount: X, 2X, 3X — arithmetic, not geometric.",
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", PV * (1 + i), `${lit(X)}*${IaExpr(n, i)}*(1+${lit(i)})`, {
          derivation: `$${X}\\,(I\\ddot a)_{\\overline{${n}|}} = ${shown(PV * (1 + i), fmt)}$`,
          method: "Treated the payments as made at the start of each year.",
          feedback: "The first payment is at the end of year 1.",
        }),
      ],
      explanation: explanation({
        intuition: "Think of the stream as a stack of level annuities: one paying X for all n years, another paying X from year 2, and so on. The increasing-annuity formula adds them up.",
        translation: {
          unknowns: [{ symbol: "$PV$", meaning: "present value" }],
          relationships: [`$PV = ${X}\\,(Ia)_{\\overline{${n}|}}$`, `$(Ia)_{\\overline{n|}} = \\dfrac{\\ddot a_{\\overline{n|}} - n v^n}{i}$`],
          conditions: [`Payment at time t is ${X}t.`],
          valuationDate: "Time 0.",
          modelChoice: "Arithmetically increasing annuity-immediate.",
          assumptions: ["Constant rate."],
        },
        solution: [
          { title: "Pieces", body: `$\\ddot a_{\\overline{${n}|}} = ${dec(adue(n, i), 5)}$, $${n}v^{${n}} = ${dec(n * Math.pow(1 + i, -n), 5)}$` },
          { title: "(Ia)", body: `$(Ia)_{\\overline{${n}|}} = ${dec(Ia(n, i), 5)}$` },
          { title: "Value", body: `$PV = ${shown(PV, fmt)}$` },
        ],
        alternatives: [{ name: "Stack of deferred annuities", body: `$(Ia)_{\\overline{${n}|}} = \\sum_{k=0}^{${n - 1}} v^k a_{\\overline{${n}-k|}}$`, whenUseful: "When the formula is forgotten — it rebuilds it." }],
        transfer: {
          principle: "Arithmetic growth means (Ia) or (Da) plus a level part; geometric growth means a growing annuity. Identify which before choosing.",
          unusual: "Nothing — a direct application.",
          misread: "Choosing (Da), or averaging the payments.",
        },
      }),
      visuals: [{ kind: "timeline", title: "Increasing payments", unit: "year", rate: i, flows: range(1, n).map((t) => ({ t, amount: t * X, dir: "in" as const })), valuationTimes: [0] }],
      markers: [Ia(n, i), adue(n, i)],
      presentation: ["direct"],
      features: features({ steps: 1, formulaRetrieval: true }),
      params: { X, n, i },
      chain: chain([step("B.increasing", "Payments X, 2X, …, nX at the ends of years 1 to n.", ["PV", PV, "present value"], ["X", "n", "i"])], {
        stages: {
          FORMULA_DECREASING_FOR_INCREASING: [0, "selection", "B.decreasing"],
          MODEL_LEVEL_FOR_VARYING: [0, "selection", "B.annuity-immediate"],
          SEQ_UNDISCOUNTED_SUM: [0, "selection", "M.arithmetic-series"],
          SEQ_ARITHMETIC_AS_GEOMETRIC: [0, "selection", "B.geometric-annuity"],
          TIMING_IMMEDIATE_AS_DUE: [0, "application"],
        },
        reasoning: "Write S = Xv + 2Xv² + … + nXvⁿ, subtract vS, and sum the resulting geometric series.",
      }),
    };
  },
};

export const SINGLE_TEMPLATES: QuestionTemplate[] = [fundWithdrawals, depositsAdvance, discountToInterest, loanPayment, increasing];

void accPow;
void mnum;
void word;
