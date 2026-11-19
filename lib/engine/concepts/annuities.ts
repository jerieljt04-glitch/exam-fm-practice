/**
 * Concept Practice — annuities and non-contingent cash flows.
 */
import {
  accPow,
  adueExpr,
  adueSym,
  aExpr,
  amt,
  aSym,
  avTerms,
  gridAmount,
  gridRate,
  level as levelFlows,
  lit,
  mamt,
  mnum,
  mpc,
  num,
  pc,
  pvTerms,
  range,
  sdueExpr,
  sdueSym,
  sExpr,
  sSym,
  vPow,
} from "../templates/kit";
import { an, sn } from "../finance";
import type { MisconceptionId } from "../misconceptions";
import type { ChoiceTemplate, ConceptFailure } from "../types";
import { conceptQuestion, conceptTemplate, math, statement, statementQuestion, type ConceptOption } from "./kit";

/** Explicit sum of `amount` at times `from..to`, valued at `at`, at rate i — the independent reference. */
const explicit = (amount: number, from: number, to: number, i: number, at: number): string => {
  const terms: string[] = [];
  for (let t = from; t <= to; t += 1) terms.push(`${lit(amount)}*(1+${lit(i)})**(${at - t})`);
  return `(${terms.join(" + ")})`;
};

const dueDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-ann-due-diagnosis",
  family: "con-ann-timing",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing"],
  reasoning: ["cashflow_modelling", "valuation_dates", "validation"],
  soaConcept: "Diagnosing the timing error in a proposed annuity valuation.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(8, 20);
    const P = gridAmount(rng, 200, 1500, 50);
    const accumulate = level === 2 && variant === 1;
    // Level 1: present value of n payments, the first today. Level 2 variant 1: value one year after the last payment.
    const at = accumulate ? n : 0;
    const truth = explicit(P, 0, n - 1, i, at);
    const proposed = accumulate ? P * sn(n, i) : P * an(n, i);
    const proposedExpr = accumulate ? `${lit(P)}*((1+${lit(i)})**${n}-1)/${lit(i)}` : `${lit(P)}*(1-(1+${lit(i)})**(-${n}))/${lit(i)}`;
    const symbol = accumulate ? `s_{\\overline{${n}|}}` : `a_{\\overline{${n}|}}`;
    const target = accumulate ? `the accumulated value of the payments one year after the last payment` : `the present value of the payments`;
    const stem =
      `A series of ${n} annual payments of ${mamt(P)} begins today. The annual effective interest rate is ${pc(i)}. ` +
      `A candidate calculates ${target} as\n\n$$${mamt(P)}\\,${symbol} = ${mnum(proposed, 2)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
    const fixed = (multiplier: string) => `${proposedExpr}*${multiplier}`;
    return conceptQuestion({
      stem,
      correct: {
        content: `The payments form an annuity-due, so the value is understated by one period of interest: multiply by $1 + i$.`,
        why: `Each payment is made one year earlier than $${symbol}$ assumes, so each is worth $1 + i$ times as much: $${mnum(proposed * (1 + i), 2)}$.`,
        check: { expr: fixed(`(1+${lit(i)})`), op: "=", than: truth },
      },
      distractors: [
        {
          content: "The calculation is correct; the factor already counts a payment made today.",
          misconception: "TIMING_DUE_AS_IMMEDIATE",
          why: `$${symbol}$ places the first payment one year from now, not today.`,
          check: { expr: proposedExpr, op: "=", than: truth },
          stage: 0,
          failure: "recognition",
          conditionTrue: "It would be correct if the first payment were one year from now.",
          confusedWith: "ann.immediate-vs-due",
        },
        {
          content: "The value is overstated by one period of interest: divide by $1 + i$.",
          misconception: "CONC_MOVED_WRONG_WAY",
          why: "Paying earlier makes a stream worth more, not less; dividing by $1 + i$ moves the value the wrong way.",
          check: { expr: fixed(`(1+${lit(i)})**(-1)`), op: "=", than: truth },
          stage: 1,
          failure: "application",
          conditionTrue: "This would be the right correction if the payments began two years from now.",
        },
        {
          content: `The candidate should have counted ${n + 1} payments, since payments at times 0 and ${n} are both included.`,
          misconception: "SEQ_TERM_COUNT",
          why: `Payments at times $0, 1, \\ldots, ${n - 1}$ number exactly ${n}; there is no payment at time ${n}.`,
          check: { expr: accumulate ? `${lit(P)}*((1+${lit(i)})**${n + 1}-1)/${lit(i)}` : `${lit(P)}*(1-(1+${lit(i)})**(-${n + 1}))/${lit(i)}`, op: "=", than: truth },
          stage: 0,
          failure: "interpretation",
          conditionTrue: `True only if a payment were also made at time ${n}.`,
        },
        {
          content: accumulate ? "The candidate should have used the present-value factor $a_{\\overline{n}|}$, then accumulated it." : "The candidate should have used the accumulated-value factor $s_{\\overline{n}|}$.",
          misconception: "FORMULA_AV_FOR_PV",
          why: accumulate ? "That changes the route, not the error: $a_{\\overline{n}|}(1+i)^n = s_{\\overline{n}|}$, so the result is the same understated value." : "$s_{\\overline{n}|}$ values the payments at the last payment date, not today.",
          check: { expr: accumulate ? proposedExpr : `${lit(P)}*((1+${lit(i)})**${n}-1)/${lit(i)}`, op: "=", than: truth },
          stage: 1,
          failure: "selection",
        },
        {
          content: "The rate should first be converted to the discount rate $d = i/(1+i)$ and used in the same factor.",
          misconception: "RATE_DISCOUNT_AS_INTEREST",
          why: "Annuity-due values use $d$ in the denominator of $\\ddot{a}$, not by substituting $d$ for $i$ inside $a_{\\overline{n}|}$.",
          check: { expr: accumulate ? `${lit(P)}*((1+${lit(i / (1 + i))})**${n}-1)/${lit(i / (1 + i))}` : `${lit(P)}*(1-(1+${lit(i / (1 + i))})**(-${n}))/${lit(i / (1 + i))}`, op: "=", than: truth },
          stage: 2,
          failure: "connection",
          conditionTrue: "It is true that $\\ddot{a}_{\\overline{n}|} = (1 - v^n)/d$ — the numerator keeps $v$ at rate $i$.",
        },
      ],
      reference: {
        description: `Explicit sum of the ${n} payments at times $0, \\ldots, ${n - 1}$${accumulate ? ` accumulated to time ${n}` : ""}: each option's proposed correction is evaluated and compared with it.`,
      },
      steps: [
        { concept: "ann.immediate-vs-due", reasoning: "“Begins today” makes the first payment at time 0: an annuity-due." },
        { concept: "ann.annuity-value-date", reasoning: `$${symbol}$ values payments at times $1, \\ldots, ${n}$${accumulate ? ` at time ${n}` : " at time 0"}; every payment here is one period earlier.` },
        { concept: "ann.immediate-vs-due", reasoning: "Moving every payment one period earlier multiplies the value by $1 + i$: $\\ddot{a} = (1+i)a$ and $\\ddot{s} = (1+i)s$." },
      ],
      conditions: [`Level payments at a constant annual effective rate of $${mpc(i)}$.`],
      relationship: "$\\ddot{a}_{\\overline{n}|} = (1+i)\\,a_{\\overline{n}|}, \\qquad \\ddot{s}_{\\overline{n}|} = (1+i)\\,s_{\\overline{n}|}$",
      counterexample: "If the first payment were one year from now, the candidate's value would be correct unchanged.",
      transfer: {
        principle: "Locate the first payment on the timeline before choosing a factor; a factor fixes where it leaves its value.",
        unusual: "You judge a worked solution instead of producing one.",
        misread: "“Begins today” is easy to read past.",
      },
      itemFormat: "error-diagnosis",
      presentation: accumulate ? ["valuation-date"] : ["direct"],
      features: { multipleValuationDates: accumulate, unfamiliar: accumulate },
      params: { i, n, P, variant, accumulate },
    });
  },
});

// ================================================================ shared helpers

/** `0.05` → `1.05`. */
const fac = (i: number): string => lit(1 + i);
/** `(1+0.05)` as an expression. */
const onePlusE = (i: number): string => `(1+${lit(i)})`;
/** `(1.05)^{3}` for markup. */
const pow = (i: number, e: number | string): string => `(${fac(i)})^{${e}}`;
const IaSym = (n: number | string): string => `(Ia)_{\\overline{${n}|}}`;
const DaSym = (n: number | string): string => `(Da)_{\\overline{${n}|}}`;
/** (Ia) and (Da) at rate i, as closed forms. */
const IaE = (n: number, i: number): string => `((${adueExpr(n, i)}-${n}*${vPow(i, n)})/${lit(i)})`;
const DaE = (n: number, i: number): string => `((${n}-${aExpr(n, i)})/${lit(i)})`;
/** Level payments of `amount` at times from..to, written out term by term (independent of any annuity factor). */
const pvLev = (amount: number, from: number, to: number, i: number): string => pvTerms(levelFlows(amount, range(from, to)), i);
const avLev = (amount: number, from: number, to: number, i: number, at: number): string => avTerms(levelFlows(amount, range(from, to)), i, at);
/** Payments of `amount` at times first, first+step, … forever, summed as a geometric series. */
const perpFrom = (amount: number, first: number | string, i: number, step: number | string = 1): string =>
  `(${lit(amount)}*${vPow(i, first)}/(1-${vPow(i, step)}))`;
const A_INF = "a_{\\overline{\\infty}|}";
const ADUE_INF = "\\ddot{a}_{\\overline{\\infty}|}";

/** A distractor with its concept-chain stage and failure type. */
const wrong = (
  content: ConceptOption["content"],
  misconception: MisconceptionId,
  stage: number,
  failure: ConceptFailure,
  why: string,
  extra: Partial<ConceptOption> = {}
): ConceptOption => ({ content, misconception, stage, failure, why, ...extra });

/** `a, a+step, …, b` for markup inside math, listing every term when there are at most three. */
const seqList = (first: number, step: number, last: number): string => {
  const count = Math.round((last - first) / step) + 1;
  if (count <= 3) return Array.from({ length: count }, (_, q) => first + q * step).join(", ");
  return `${first}, ${first + step}, \\ldots, ${last}`;
};

// ================================================================ immediate and due

const dueIdentity: ChoiceTemplate = conceptTemplate({
  id: "con-ann-due-identity",
  family: "con-ann-identities",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["terminology", "relationships"],
  reasoning: ["concept_recognition", "formula_reconstruction"],
  soaConcept: "Recognising an expression equivalent to an annuity-due symbol.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(6, 25);
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const d = i / (1 + i);
    const accumulate = variant === 1;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    if (!accumulate) {
      correct =
        level === 1
          ? { content: math(`1 + ${aSym(n - 1)}`), probe: `(1+${aExpr(n - 1, i)})`, why: `Separate the payment at time 0; the other ${n - 1} payments, at times $1, \\ldots, ${n - 1}$, are worth $${aSym(n - 1)}$.` }
          : { content: math(`${aSym(n)} + 1 - v^{${n}}`), probe: `(${aExpr(n, i)}+1-${vPow(i, n)})`, why: `Compared with $${aSym(n)}$, the annuity-due has an extra payment at time 0 and none at time ${n}: add 1 and subtract $v^{${n}}$.` };
      distractors = [
        wrong(math(`1 + ${aSym(n)}`), "CONC_DOUBLE_COUNTED", 1, "application", `This adds a payment at time 0 but keeps all ${n} payments of $${aSym(n)}$, including one at time ${n} that the annuity-due does not make.`, { probe: `(1+${aExpr(n, i)})`, conditionTrue: `It equals $${adueSym(n + 1)}$, the value of ${n + 1} payments.` }),
        wrong(math(`v\\,${aSym(n)}`), "CONC_MOVED_WRONG_WAY", 2, "application", "Paying each amount one year earlier makes it worth more: the factor is $1 + i$, not $v$.", { probe: `(${vPow(i, 1)}*${aExpr(n, i)})`, conditionTrue: `It values payments at times $2, \\ldots, ${n + 1}$.` }),
        wrong(math(`\\dfrac{1 - v^{${n}}}{i}`), "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", `This is $${aSym(n)}$: payments at times $1, \\ldots, ${n}$, each one year later than in the annuity-due.`, { probe: aExpr(n, i), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(`\\dfrac{1 - v^{${n - 1}}}{d}`), "SEQ_TERM_COUNT", 2, "application", `With $d$ in the denominator the numerator must be $1 - v^{${n}}$; this is $${adueSym(n - 1)}$, one payment short.`, { probe: `((1-${vPow(i, n - 1)})/${lit(d)})` }),
        wrong(math(`(1+d)\\,${aSym(n)}`), "RATE_DISCOUNT_AS_INTEREST", 2, "connection", "Moving every payment one year earlier multiplies by $1 + i = 1/v$; $1 + d$ is smaller than that.", { probe: `((1+${lit(d)})*${aExpr(n, i)})` }),
      ];
      if (level === 2)
        distractors.unshift(wrong(math(`${aSym(n)} + 1 + v^{${n}}`), "ALG_SIGN_ERROR", 1, "application", `The payment at time ${n} is removed, so $v^{${n}}$ is subtracted, not added.`, { probe: `(${aExpr(n, i)}+1+${vPow(i, n)})` }));
    } else {
      correct =
        level === 1
          ? { content: math(`${sSym(n + 1)} - 1`), probe: `(${sExpr(n + 1, i)}-1)`, why: `Add a deposit of 1 at time ${n}: deposits at times $0, \\ldots, ${n}$ are worth $${sSym(n + 1)}$ at their last date; then remove the added 1.` }
          : { content: math(`${sSym(n)} + (1+i)^{${n}} - 1`), probe: `(${sExpr(n, i)}+${accPow(i, n)}-1)`, why: `$${sSym(n)}$ counts deposits at times $1, \\ldots, ${n}$; the fund has one at time 0, worth $(1+i)^{${n}}$ at time ${n}, and none at time ${n}.` };
      distractors = [
        wrong(math(`${sdueSym(n - 1)} + 1`), "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", `This equals $${sSym(n)}$: deposits at the end of each year, valued on the date of the last deposit.`, { probe: `(${sdueExpr(n - 1, i)}+1)`, confusedWith: "ann.immediate-vs-due" }),
        level === 1
          ? wrong(math(`${sSym(n + 1)} + 1`), "ALG_SIGN_ERROR", 1, "application", `The deposit added at time ${n} must be removed: subtract 1, do not add it.`, { probe: `(${sExpr(n + 1, i)}+1)` })
          : wrong(math(`${sSym(n)} + (1+i)^{${n}} + 1`), "ALG_SIGN_ERROR", 1, "application", `There is no deposit at time ${n}, so 1 is subtracted, not added.`, { probe: `(${sExpr(n, i)}+${accPow(i, n)}+1)` }),
        wrong(math(`v\\,${sSym(n)}`), "CONC_MOVED_WRONG_WAY", 2, "application", "Deposits made one year earlier earn one more year of interest: multiply by $1 + i$, not $v$.", { probe: `(${vPow(i, 1)}*${sExpr(n, i)})` }),
        wrong(math(`\\dfrac{(1+i)^{${n + 1}} - 1}{d}`), "SEQ_TERM_COUNT", 2, "application", `This is $${sdueSym(n + 1)}$: ${n + 1} deposits instead of ${n}.`, { probe: sdueExpr(n + 1, i) }),
        wrong(math(`(1+d)\\,${sSym(n)}`), "RATE_DISCOUNT_AS_INTEREST", 2, "connection", "One extra year of interest multiplies by $1 + i$; $1 + d$ is smaller.", { probe: `((1+${lit(d)})*${sExpr(n, i)})` }),
        wrong(math(`${sSym(n)} + 1`), "CONC_DOUBLE_COUNTED", 1, "application", `This adds a deposit at time ${n} to deposits already ending at time ${n}.`, { probe: `(${sExpr(n, i)}+1)` }),
      ];
    }
    const symbol = accumulate ? sdueSym(n) : adueSym(n);
    const stem = accumulate
      ? `Deposits of 1 are made at the beginning of each year for ${n} years into a fund earning an annual effective interest rate of ${pc(i)}.\n\nDetermine which of the following equals the amount in the fund at the end of year ${n}.`
      : `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is equal to $${symbol}$.`;
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: {
        values: [{ label: accumulate ? `value at ${n}` : "value at 0", expr: accumulate ? avLev(1, 0, n - 1, i, n) : pvLev(1, 0, n - 1, i) }],
        description: `Payments of 1 at times $0, \\ldots, ${n - 1}$, summed term by term${accumulate ? ` at time ${n}` : " at time 0"}; each option is evaluated at the same rate and only the correct one agrees.`,
      },
      steps: [
        { concept: "ann.immediate-vs-due", reasoning: `$${symbol}$ pays 1 at times $0, 1, \\ldots, ${n - 1}$${accumulate ? ` and is valued at time ${n}, one year after the last payment` : " and is valued at time 0, the first payment date"}.` },
        { concept: "ann.annuity-identities", reasoning: accumulate ? `Compare with an annuity-immediate: adding (or removing) one payment at the boundary converts one into the other, e.g. $${sdueSym(n)} = ${sSym(n + 1)} - 1$.` : `Separate the payment at time 0 from the rest, or compare with $${aSym(n)}$ payment by payment.` },
        { concept: "ann.annuity-value-date", reasoning: `Check the result counts exactly ${n} payments and values them at time ${accumulate ? n : 0}.` },
      ],
      conditions: [`Level payments of 1 at a constant annual effective rate of $${mpc(i)}$.`],
      relationship: accumulate
        ? "$\\ddot{s}_{\\overline{n}|} = s_{\\overline{n+1}|} - 1 = s_{\\overline{n}|} + (1+i)^n - 1 = (1+i)\\,s_{\\overline{n}|}$"
        : "$\\ddot{a}_{\\overline{n}|} = 1 + a_{\\overline{n-1}|} = a_{\\overline{n}|} + 1 - v^n = (1+i)\\,a_{\\overline{n}|}$",
      counterexample: `For $n = 1$: $\\ddot{a}_{\\overline{1}|} = 1$, while $1 + a_{\\overline{1}|} = 1 + v$ counts a payment that is not made.`,
      transfer: {
        principle: "Turn one annuity into another by adding or removing boundary payments, then check the count and the valuation date.",
        unusual: "The options are symbols, not numbers; you judge equivalence rather than compute.",
        misread: "$1 + a_{\\overline{n}|}$ looks natural but pays $n + 1$ times.",
      },
      itemFormat: "expression-selection",
      presentation: level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { n, i, variant },
    });
  },
});

type Sym = "a" | "adue" | "s" | "sdue";
const SYMS: Sym[] = ["a", "adue", "s", "sdue"];
const symLatex = (s: Sym, n: number): string => ({ a: aSym, adue: adueSym, s: sSym, sdue: sdueSym })[s](n);
const symExpr = (s: Sym, n: number, i: number): string => ({ a: aExpr, adue: adueExpr, s: sExpr, sdue: sdueExpr })[s](n, i);
/** The date at which (symbol) values payments of 1 at times k, …, k+n−1. */
const symDate = (s: Sym, k: number, n: number): number => ({ a: k - 1, adue: k, s: k + n - 1, sdue: k + n })[s];
const SYM_PLACE: Record<Sym, string> = {
  a: "one period before the first payment",
  adue: "on the date of the first payment",
  s: "on the date of the last payment",
  sdue: "one period after the last payment",
};
const isDueSym = (s: Sym): boolean => s === "adue" || s === "sdue";
const dueSwap = (s: Sym): Sym => ({ a: "adue", adue: "a", s: "sdue", sdue: "s" } as const)[s];
const pvSwap = (s: Sym): Sym => ({ a: "s", s: "a", adue: "sdue", sdue: "adue" } as const)[s];

const factorDate: ChoiceTemplate = conceptTemplate({
  id: "con-ann-factor-date",
  family: "con-ann-timing",
  topic: "ANNUITIES",
  levels: [1, 3],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  reasoning: ["valuation_dates", "concept_recognition", "cashflow_modelling"],
  soaConcept: "Reading the valuation date that an annuity factor (and any adjustment) produces.",
  variants: 2,
  generate(rng, level, variant) {
    const hard = level === 3;
    const k = rng.int(3, 6);
    const n = rng.int(k + 2, k + 8);
    const P = gridAmount(rng, 100, 2000, 50);
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const X = rng.choice(SYMS);
    const truthAt = (t: number) => explicit(P, k, k + n - 1, i, t);
    const payments = hard
      ? `A sequence of ${n} annual payments of ${amt(P)} begins at the end of year ${k}.`
      : `Payments of ${amt(P)} are made at times $${k}, ${k + 1}, \\ldots, ${k + n - 1}$.`;
    const steps = [
      { concept: "ann.immediate-vs-due", reasoning: `Locate the stream: ${n} payments at times $${k}, \\ldots, ${k + n - 1}$${hard ? ` (the end of year ${k} is time ${k})` : ""}.` },
      { concept: "ann.annuity-value-date", reasoning: "Each factor fixes a date: $a$ one period before the first payment, $\\ddot{a}$ at the first payment, $s$ at the last payment, $\\ddot{s}$ one period after it." },
    ];

    if (variant === 0) {
      const m = hard ? rng.int(1, Math.min(3, k - 1)) : 0;
      const forward = X === "a" || X === "adue";
      const shift = (t: number) => (forward ? t + m : t - m);
      const factorLatex = hard ? (forward ? pow(i, m) : pow(i, -m)) : "";
      const factorExpr = hard ? (forward ? accPow(i, m) : vPow(i, m)) : "1";
      const E = `(${lit(P)}*${symExpr(X, n, i)}*${factorExpr})`;
      const Elatex = `${mamt(P)}\\,${symLatex(X, n)}${hard ? `\\,${factorLatex}` : ""}`;
      const base = symDate(X, k, n);
      const D = shift(base);
      const dateOpt = (t: number, mis: MisconceptionId, stage: number, failure: ConceptFailure, why: string, extra: Partial<ConceptOption> = {}): ConceptOption[] =>
        t >= 0 ? [wrong(`At time ${t}`, mis, stage, failure, why, { check: { expr: E, op: "=", than: truthAt(t) }, ...extra })] : [];
      const swapWhy = (s: Sym) => `Time ${shift(symDate(s, k, n))} is where $${symLatex(s, n)}$${hard ? ` with the same factor` : ""} would place the value: $${symLatex(s, n)}$ values a stream ${SYM_PLACE[s]}.`;
      const distractors = [
        ...dateOpt(shift(symDate(dueSwap(X), k, n)), isDueSym(X) ? "TIMING_DUE_AS_IMMEDIATE" : "TIMING_IMMEDIATE_AS_DUE", 1, "recognition", swapWhy(dueSwap(X)), { confusedWith: "ann.immediate-vs-due" }),
        ...dateOpt(shift(symDate(pvSwap(X), k, n)), "FORMULA_AV_FOR_PV", 1, "interpretation", swapWhy(pvSwap(X))),
        ...(hard ? dateOpt(forward ? base - m : base + m, "CONC_MOVED_WRONG_WAY", 2, "application", `$${factorLatex}$ moves a value ${m} year${m > 1 ? "s" : ""} ${forward ? "later" : "earlier"}; this moves it the other way.`) : []),
        ...dateOpt(shift(symDate(X, 1, n)), "TIMING_IGNORED_DEFERRAL", 0, "interpretation", `Time ${shift(symDate(X, 1, n))} assumes the payments start at time 1; here the first payment is at time ${k}.`, { conditionTrue: "It would be right if the first payment were at time 1." }),
        ...(hard ? dateOpt(base, "TRANS_IGNORED_CONDITION", 2, "application", `Time ${base} is where $${symLatex(X, n)}$ leaves the value before the factor $${factorLatex}$ moves it.`) : []),
        ...dateOpt(shift(symDate(dueSwap(pvSwap(X)), k, n)), "TIMING_VALUATION_DATE", 1, "connection", swapWhy(dueSwap(pvSwap(X)))),
      ];
      return conceptQuestion({
        stem: `${payments} The annual effective interest rate is ${pc(i)}.\n\nDetermine the time at which $${Elatex}$ equals the value of these payments.`,
        correct: {
          content: `At time ${D}`,
          why: `$${symLatex(X, n)}$ values the stream ${SYM_PLACE[X]}, time ${base}${hard ? `; $${factorLatex}$ then moves the value ${m} year${m > 1 ? "s" : ""} ${forward ? "later" : "earlier"}, to time ${D}` : ""}.`,
          check: { expr: E, op: "=", than: truthAt(D) },
        },
        distractors,
        reference: { description: `Each candidate date $t$ is tested by summing the ${n} payments term by term at time $t$ and comparing with $${Elatex}$; only time ${D} agrees.` },
        steps: hard ? [...steps, { concept: "tvm.equation-of-value", reasoning: `Multiplying by $${factorLatex}$ moves a value ${m} year${m > 1 ? "s" : ""} ${forward ? "later" : "earlier"}: from time ${base} to time ${D}.` }, { concept: "ann.annuity-value-date", reasoning: `Check: at time ${D} the explicit sum of the payments equals $${Elatex}$.` }] : steps,
        conditions: ["Level annual payments at a constant annual effective rate.", "A factor's value date depends on the first or last payment, not on time 0."],
        relationship: "$a_{\\overline{n}|}$: one period before the first payment; $\\ddot{a}_{\\overline{n}|}$: at the first payment; $s_{\\overline{n}|}$: at the last payment; $\\ddot{s}_{\\overline{n}|}$: one period after the last.",
        counterexample: `If the first payment were at time 1, $${aSym(n)}$ would give the value at time 0 — the familiar case, and the only one in which it does.`,
        transfer: {
          principle: "Anchor every annuity factor to the first or last payment date, then apply any extra power of $1 + i$ as a move along the timeline.",
          unusual: "You are given the expression and asked for its date, the reverse of the usual task.",
          misread: "Annuity factors are often read as “value at time 0” whatever the payment dates.",
        },
        itemFormat: "interpretation",
        presentation: hard ? ["valuation-date", "indirect-wording"] : ["valuation-date"],
        features: { multipleValuationDates: true, unfamiliar: hard },
        ...(hard ? { modelingDecisions: 1 } : {}),
        params: { k, n, P, i, X, m, variant },
      });
    }

    // Variant 1: the date is given; choose the expression.
    if (!hard) {
      const T = symDate(X, k, n);
      const opt = (s: Sym, nn: number) => math(`${mamt(P)}\\,${symLatex(s, nn)}`);
      const probe = (s: Sym, nn: number) => `(${lit(P)}*${symExpr(s, nn, i)})`;
      const swapWhy = (s: Sym) => `$${symLatex(s, n)}$ values the stream ${SYM_PLACE[s]}, time ${symDate(s, k, n)}, not time ${T}.`;
      return conceptQuestion({
        stem: `${payments} The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the value of these payments at time ${T}.`,
        correct: { content: opt(X, n), probe: probe(X, n), why: `Time ${T} is ${SYM_PLACE[X]}, which is where $${symLatex(X, n)}$ places the value.` },
        distractors: [
          wrong(opt(dueSwap(X), n), isDueSym(dueSwap(X)) ? "TIMING_IMMEDIATE_AS_DUE" : "TIMING_DUE_AS_IMMEDIATE", 1, "recognition", swapWhy(dueSwap(X)), { probe: probe(dueSwap(X), n), confusedWith: "ann.immediate-vs-due" }),
          wrong(opt(pvSwap(X), n), "FORMULA_AV_FOR_PV", 1, "selection", swapWhy(pvSwap(X)), { probe: probe(pvSwap(X), n) }),
          wrong(opt(dueSwap(pvSwap(X)), n), "TIMING_VALUATION_DATE", 1, "connection", swapWhy(dueSwap(pvSwap(X))), { probe: probe(dueSwap(pvSwap(X)), n) }),
          wrong(opt(X, n + 1), "SEQ_TERM_COUNT", 0, "interpretation", `The payments at times $${k}$ to $${k + n - 1}$ number ${n}, not ${n + 1}.`, { probe: probe(X, n + 1) }),
        ],
        reference: { values: [{ label: `value at ${T}`, expr: truthAt(T) }], description: `The ${n} payments summed term by term at time ${T}.` },
        steps,
        conditions: ["Level annual payments at a constant annual effective rate."],
        relationship: "$a$: one period before the first payment; $\\ddot{a}$: at the first payment; $s$: at the last payment; $\\ddot{s}$: one period after the last.",
        transfer: {
          principle: "Match the requested date to the first or last payment before choosing among $a$, $\\ddot{a}$, $s$, $\\ddot{s}$.",
          unusual: "The stream does not start at time 1.",
          misread: "A date between the start and the payments tempts the choice of $a$ by habit.",
        },
        itemFormat: "timeline-reading",
        presentation: ["valuation-date"],
        features: { multipleValuationDates: true },
        params: { k, n, P, i, X, variant },
      });
    }
    const j = rng.int(1, n - 3);
    const T = k + j;
    const two = (left: string, right: string) => math(`${mamt(P)}\\,${left} + ${mamt(P)}\\,${right}`);
    const twoE = (left: string, right: string) => `(${lit(P)}*${left} + ${lit(P)}*${right})`;
    return conceptQuestion({
      stem: `${payments} The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the value of the payments at time ${T}.`,
      correct: { content: two(sSym(j + 1), aSym(n - j - 1)), probe: twoE(sExpr(j + 1, i), aExpr(n - j - 1, i)), why: `At time ${T} the payments at times ${k} to ${T} (${j + 1} of them, the last on the valuation date) are accumulated with $${sSym(j + 1)}$; the remaining ${n - j - 1}, starting one year later, are discounted with $${aSym(n - j - 1)}$.` },
      distractors: [
        wrong(two(sSym(j), aSym(n - j)), "SEQ_TERM_COUNT", 2, "application", `This puts the payment at time ${T} in the future block: it counts ${j} past and ${n - j} future payments, shifting the stream by a year at each end.`, { probe: twoE(sExpr(j, i), aExpr(n - j, i)) }),
        wrong(two(sdueSym(j + 1), aSym(n - j - 1)), "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${sdueSym(j + 1)}$ values the past payments one year after the last of them, at time ${T + 1}.`, { probe: twoE(sdueExpr(j + 1, i), aExpr(n - j - 1, i)), confusedWith: "ann.immediate-vs-due" }),
        wrong(two(sSym(j + 1), adueSym(n - j - 1)), "CONC_DOUBLE_COUNTED", 2, "connection", `$${adueSym(n - j - 1)}$ at time ${T} includes a payment at time ${T}, already counted in $${sSym(j + 1)}$, and omits the last payment.`, { probe: twoE(sExpr(j + 1, i), adueExpr(n - j - 1, i)) }),
        wrong(two(aSym(j + 1), aSym(n - j - 1)), "FORMULA_AV_FOR_PV", 1, "selection", "Payments already made must be accumulated to the valuation date, not discounted.", { probe: twoE(aExpr(j + 1, i), aExpr(n - j - 1, i)) }),
      ],
      reference: { values: [{ label: `value at ${T}`, expr: truthAt(T) }], description: `The ${n} payments summed term by term at time ${T}.` },
      steps: [
        ...steps,
        { concept: "ann.stream-decomposition", reasoning: `Split at time ${T}: payments at times ${k}–${T} are past (the one at ${T} included), payments at ${T + 1}–${k + n - 1} are future.` },
        { concept: "tvm.equation-of-value", reasoning: `Accumulate the past block with $s$ (value at its last payment, time ${T}) and discount the future block with $a$ (value one year before its first payment, time ${T}).` },
      ],
      conditions: ["Level annual payments at a constant annual effective rate.", "Each payment is counted exactly once."],
      relationship: "Value at $T$ = (past payments accumulated to $T$) + (future payments discounted to $T$).",
      counterexample: `The whole stream valued at time ${k} and moved forward, $${mamt(P)}\\,${adueSym(n)}(1+i)^{${j}}$, gives the same number.`,
      transfer: {
        principle: "At a date inside a stream, split it there and check that the payment on the date sits in exactly one block.",
        unusual: "The valuation date falls in the middle of the payments.",
        misread: "The payment on the valuation date is easily counted twice or not at all.",
      },
      itemFormat: "timeline-reading",
      presentation: ["valuation-date", "hidden-structure"],
      features: { multipleValuationDates: true, unfamiliar: true },
      modelingDecisions: 1,
      params: { k, n, P, i, j, variant },
    });
  },
});

// ================================================================ level payments

const levelMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-level-meaning",
  family: "con-ann-level",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.level_payment",
  secondary: ["LOANS.payment_components"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  reasoning: ["concept_recognition", "financial_intuition"],
  soaConcept: "Interpreting the reciprocal of an annuity factor as a loan payment or a sinking-fund deposit.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(5, 30);
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const L = level === 2 && variant === 0 ? gridAmount(rng, 5000, 100000, 1000) : 1;
    const amount = L === 1 ? "1" : amt(L);
    const lv = (e: string) => `(${lit(L)}*${e})`;
    const OPTS = {
      A: { text: `The level payment at the end of each year for ${n} years that repays a loan of ${amount} made today.`, value: lv(`1/${aExpr(n, i)}`) },
      B: { text: `The level deposit at the end of each year for ${n} years that accumulates to ${amount} at time ${n}.`, value: lv(`1/${sExpr(n, i)}`) },
      C: { text: `The level payment at the start of each year for ${n} years that repays a loan of ${amount} made today.`, value: lv(`1/${adueExpr(n, i)}`) },
      D: { text: `The level deposit at the start of each year for ${n} years that accumulates to ${amount} at time ${n}.`, value: lv(`1/${sdueExpr(n, i)}`) },
      E: { text: `The interest due at the end of each year on a loan of ${amount} that is never repaid.`, value: lv(lit(i)) },
      F: { text: `The level payment at the end of each year for ${n} years that repays a loan of ${amount} with no interest.`, value: lv(`1/${n}`) },
    };
    type Key = keyof typeof OPTS;
    // Target quantity, its symbol and the option it equals.
    const cases = {
      "1-0": { latex: `\\dfrac{1}{${aSym(n)}}`, expr: `1/${aExpr(n, i)}`, key: "A" as Key },
      "1-1": { latex: `\\dfrac{1}{${sSym(n)}}`, expr: `1/${sExpr(n, i)}`, key: "B" as Key },
      "2-0": { latex: `X - ${lit(i)}\\times ${mamt(L)}`, expr: `(${lit(L)}/${aExpr(n, i)} - ${lit(i)}*${lit(L)})`, key: "B" as Key },
      "2-1": { latex: `\\dfrac{1}{${sSym(n)}} + ${lit(i)}`, expr: `(1/${sExpr(n, i)} + ${lit(i)})`, key: "A" as Key },
    };
    const c = cases[`${level}-${variant}` as keyof typeof cases];
    const isPayment = c.key === "A";
    const misFor: Record<Key, MisconceptionId> = isPayment
      ? { A: "CONC_RELATED_TERM", B: level === 2 ? "TRANS_IGNORED_CONDITION" : "FORMULA_AV_FOR_PV", C: "TIMING_IMMEDIATE_AS_DUE", D: "TIMING_VALUATION_DATE", E: "VAR_INTEREST_FOR_PRINCIPAL", F: "SEQ_UNDISCOUNTED_SUM" }
      : { A: level === 2 ? "VAR_TOTAL_FOR_COMPONENT" : "FORMULA_AV_FOR_PV", B: "CONC_RELATED_TERM", C: "TIMING_VALUATION_DATE", D: "TIMING_IMMEDIATE_AS_DUE", E: "VAR_INTEREST_FOR_PRINCIPAL", F: "SEQ_UNDISCOUNTED_SUM" };
    const WHY: Record<Key, string> = {
      A: level === 2 && !isPayment ? `That is the whole payment $X$; it covers the interest ${amt(L * i)} as well.` : `That is $1/${aSym(n)}$, the loan payment, which exceeds the deposit by the interest on the loan.`,
      B: isPayment && level === 2 ? `That is $1/${sSym(n)}$ alone; the stated quantity adds the interest $i$ to it.` : `That is $1/${sSym(n)}$: a deposit that only has to accumulate the amount, with no interest owed meanwhile.`,
      C: `Payments at the start of each year are smaller: that quantity is $1/${adueSym(n)}$.`,
      D: `Deposits at the start of each year earn an extra year of interest: that quantity is $1/${sdueSym(n)}$.`,
      E: `That is only the interest, $${lit(i)}$ per unit of loan; it repays no principal.`,
      F: `Repaying with no interest needs $1/${n}$ of the amount each year; interest changes the payment.`,
    };
    const ORDER: Key[] = isPayment ? ["B", "C", "E", "F", "D"] : ["A", "D", "E", "F", "C"];
    const stem =
      level === 2 && variant === 0
        ? `A loan of ${amt(L)} is repaid by level payments of $X$ at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}.\n\nWhich of the following describes $${c.latex}$?`
        : `The annual effective interest rate is ${pc(i)}.\n\nWhich of the following describes $${c.latex}$?`;
    return conceptQuestion({
      stem,
      correct: { content: OPTS[c.key].text, why: isPayment ? `$${c.latex} = 1/${aSym(n)}$: the payment that repays the loan in ${n} years.` : `$${c.latex} = ${L === 1 ? "" : mamt(L)}/${sSym(n)}$: the deposit that accumulates the amount in ${n} years.`, check: { expr: c.expr, op: "=", than: OPTS[c.key].value } },
      distractors: ORDER.map((key, idx) =>
        wrong(OPTS[key].text, misFor[key], key === "E" || key === "F" ? 0 : idx === 0 ? 1 : level === 2 ? 2 : 1, key === "E" ? "interpretation" : key === "F" ? "recognition" : idx === 0 ? "connection" : "application", WHY[key], { check: { expr: c.expr, op: "=", than: OPTS[key].value } })
      ),
      reference: { description: "Each description is converted to a number at the stated rate and compared with the quantity in the stem; only one agrees." },
      steps: [
        { concept: "ann.annuity-value-date", reasoning: `$${aSym(n)}$ is the value at time 0 of 1 per year paid at the end of years 1 to ${n}; $${sSym(n)}$ is the same payments' value at time ${n}.` },
        { concept: "ann.annuity-identities", reasoning: `So $1/${aSym(n)}$ is the payment that a present amount of 1 supports, and $1/${sSym(n)}$ the deposit that builds a future amount of 1; they differ by $i$: $1/${aSym(n)} = 1/${sSym(n)} + i$.` },
        ...(level === 2 ? [{ concept: "loan.interest-principal-split", reasoning: "A loan payment is interest on the loan plus a sinking-fund deposit that accumulates the principal." }] : []),
      ],
      conditions: ["Level annual payments at the end of each year.", "Constant annual effective rate."],
      relationship: "$\\dfrac{1}{a_{\\overline{n}|}} = \\dfrac{1}{s_{\\overline{n}|}} + i$",
      counterexample: "At $i = 0$ both reciprocals equal $1/n$; the difference between them is exactly the interest.",
      transfer: {
        principle: "Read $1/a$ as “payment from a present amount” and $1/s$ as “deposit toward a future amount”.",
        unusual: "The quantity is described, not calculated.",
        misread: "Payment and deposit sound alike; only one has interest on the loan inside it.",
      },
      itemFormat: "definition",
      presentation: level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { n, i, L, variant },
    });
  },
});

const levelEquation: ChoiceTemplate = conceptTemplate({
  id: "con-ann-level-equation",
  family: "con-ann-level",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.level_payment",
  secondary: ["TVM.equation_of_value"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["translation", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Choosing the equation of value for a level payment with a gap between the payments and the valuation date.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const f = fac(i);
    const eq = (lhs: string, rhs: string) => math(`${lhs} = ${rhs}`);
    if (variant === 0) {
      const n = rng.int(5, 15);
      const m = rng.int(2, 6);
      const F = gridAmount(rng, 20000, 90000, 1000);
      const due = level === 2;
      const S = due ? sdueSym(n) : sSym(n);
      const SE = due ? sdueExpr(n, i) : sExpr(n, i);
      const T = n + m;
      const root = `(x*${avLev(1, due ? 0 : 1, due ? n - 1 : n, i, T)} - ${lit(F)})`;
      const fm = mamt(F);
      const stem = due
        ? `Deposits of $X$ are made on January 1 of each year from 2027 through ${2027 + n - 1} into a fund earning an annual effective interest rate of ${pc(i)}. No further deposits are made. The fund is ${amt(F)} on December 31, ${2027 + T - 1}.\n\nDetermine which of the following equations $X$ satisfies.`
        : `Deposits of $X$ are made at the end of each year for ${n} years into a fund earning an annual effective interest rate of ${pc(i)}. No further deposits are made, and the fund is ${amt(F)} at the end of year ${T}.\n\nDetermine which of the following equations $X$ satisfies.`;
      return conceptQuestion({
        stem,
        correct: { content: eq(`X\\,${S}\\,(${f})^{${m}}`, fm), probe: `(x*${SE}*${accPow(i, m)} - ${lit(F)})`, why: `$${S}$ values the deposits at time ${n}${due ? ", one year after the last deposit" : ", the last deposit date"}; they then earn ${m} more years of interest to time ${T}.` },
        distractors: [
          wrong(eq(`X\\,${due ? sSym(n) : sdueSym(n)}\\,(${f})^{${m}}`, fm), due ? "TIMING_DUE_AS_IMMEDIATE" : "TIMING_IMMEDIATE_AS_DUE", 0, "recognition", due ? "Deposits on January 1 are at the start of each year; $s$ loses a year of interest on each." : "Deposits at year-end are an annuity-immediate; $\\ddot{s}$ adds a year of interest to each.", { probe: `(x*${due ? sExpr(n, i) : sdueExpr(n, i)}*${accPow(i, m)} - ${lit(F)})`, confusedWith: "ann.immediate-vs-due" }),
          wrong(eq(`X\\,${due ? sdueSym(T) : sSym(T)}`, fm), "TRANS_IGNORED_CONDITION", 0, "interpretation", `That assumes deposits continue for all ${T} years; they stop after ${n}.`, { probe: `(x*${due ? sdueExpr(T, i) : sExpr(T, i)} - ${lit(F)})`, conditionTrue: `Correct if deposits continued to year ${T}.` }),
          due
            ? wrong(eq(`X\\,${S}\\,(${f})^{${m + 1}}`, fm), "TIMING_EXTRA_PERIOD", 1, "application", `$${S}$ already values at time ${n}; only ${m} more years remain to time ${T}.`, { probe: `(x*${SE}*${accPow(i, m + 1)} - ${lit(F)})` })
            : wrong(eq(`X\\,${S}\\,(${f})^{${m - 1}}`, fm), "TIMING_MISSING_PERIOD", 1, "application", `From the last deposit at time ${n} to time ${T} is ${m} years, not ${m - 1}.`, { probe: `(x*${SE}*${accPow(i, m - 1)} - ${lit(F)})` }),
          wrong(eq(`X\\,${S}`, `${fm}\\,(${f})^{${m}}`), "CONC_MOVED_WRONG_WAY", 1, "application", `To compare at time ${n}, the fund must be discounted ${m} years, not accumulated.`, { probe: `(x*${SE} - ${lit(F)}*${accPow(i, m)})`, conditionTrue: `With $(${f})^{-${m}}$ on the right it would be correct.` }),
          wrong(eq(`X\\,${due ? adueSym(n) : aSym(n)}\\,(${f})^{${m}}`, fm), "FORMULA_AV_FOR_PV", 1, "selection", `$${due ? adueSym(n) : aSym(n)}$ values the deposits at time ${due ? 0 : 0}, so ${m} years of accumulation do not reach time ${T}.`, { probe: `(x*${due ? adueExpr(n, i) : aExpr(n, i)}*${accPow(i, m)} - ${lit(F)})` }),
        ],
        reference: { values: [{ label: "X", expr: root, bracket: [1, F] }], description: `The deposits accumulated one by one to time ${T} and set equal to ${amt(F)}; each option is solved for $X$ and only the correct one has the same root.` },
        steps: [
          { concept: due ? "ann.immediate-vs-due" : "ann.annuity-value-date", reasoning: due ? `January 1, 2027 is time 0: deposits at times $0, \\ldots, ${n - 1}$ — an annuity-due — and December 31, ${2027 + T - 1} is time ${T}.` : `Deposits at times $1, \\ldots, ${n}$; $${S}$ gives their value at time ${n}.` },
          { concept: "ann.annuity-value-date", reasoning: `$${S}$ leaves the value at time ${n}; the fund then grows without deposits for ${m} years.` },
          { concept: "tvm.equation-of-value", reasoning: `Equate values at time ${T}: $X\\,${S}(1+i)^{${m}} = ${fm}$.` },
        ],
        conditions: ["Constant annual effective rate.", "No deposits after the last stated one."],
        relationship: "$X\\,s_{\\overline{n}|}(1+i)^{m} = F$ (end-of-year deposits); $X\\,\\ddot{s}_{\\overline{n}|}(1+i)^{m} = F$ (start-of-year deposits).",
        counterexample: `Discounting the fund instead, $X\\,${S} = ${fm}(${f})^{-${m}}$, is the same equation written at time ${n}.`,
        transfer: {
          principle: "Find where the annuity factor leaves its value, then bridge the gap to the target date with one power of $1 + i$.",
          unusual: due ? "Calendar dates replace times." : "The valuation date is after the payments stop.",
          misread: "“No further deposits” is easy to overlook.",
        },
        itemFormat: "equation-selection",
        presentation: due ? ["valuation-date", "indirect-wording"] : ["valuation-date"],
        features: { multipleValuationDates: true, unfamiliar: due },
        params: { i, n, m, F, variant },
      });
    }
    const k = rng.int(3, 7);
    const n = rng.int(k + 2, k + 15);
    const L = gridAmount(rng, 10000, 80000, 1000);
    const Lm = mamt(L);
    const root = `(x*${pvLev(1, k, k + n - 1, i)} - ${lit(L)})`;
    const deferredForm = level === 2;
    const stem = deferredForm
      ? `A loan of ${amt(L)} is made today at an annual effective interest rate of ${pc(i)}. The borrower makes no payments for the first ${k - 1} years; level payments of $X$ are then made at the end of each year for ${n} years.\n\nDetermine which of the following equations $X$ satisfies.`
      : `A loan of ${amt(L)} is repaid by ${n} annual payments of $X$, the first made ${k} years after the loan. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following equations $X$ satisfies.`;
    const correct: ConceptOption = deferredForm
      ? { content: eq(`X\\,(${aSym(n + k - 1)} - ${aSym(k - 1)})`, Lm), probe: `(x*(${aExpr(n + k - 1, i)}-${aExpr(k - 1, i)}) - ${lit(L)})`, why: `Payments run from time ${k} to ${n + k - 1}: all ${n + k - 1} year-end payments less the first ${k - 1}, which are not made.` }
      : { content: eq(`X\\,${aSym(n)}\\,(${f})^{-${k - 1}}`, Lm), probe: `(x*${aExpr(n, i)}*${vPow(i, k - 1)} - ${lit(L)})`, why: `$${aSym(n)}$ values the payments at time ${k - 1}, one year before the first; discount ${k - 1} years to time 0.` };
    const distractors: ConceptOption[] = deferredForm
      ? [
          wrong(eq(`X\\,(${aSym(n + k - 1)} - ${aSym(k)})`, Lm), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `Subtracting $${aSym(k)}$ removes the payment at time ${k} as well, leaving ${n - 1} payments.`, { probe: `(x*(${aExpr(n + k - 1, i)}-${aExpr(k, i)}) - ${lit(L)})` }),
          wrong(eq(`X\\,(${adueSym(n + k - 1)} - ${adueSym(k - 1)})`, Lm), "TIMING_IMMEDIATE_AS_DUE", 0, "recognition", "Payments are at the end of each year; the due factors move every payment a year earlier.", { probe: `(x*(${adueExpr(n + k - 1, i)}-${adueExpr(k - 1, i)}) - ${lit(L)})`, confusedWith: "ann.immediate-vs-due" }),
          wrong(eq(`X\\,(${aSym(n)} - ${aSym(k - 1)})`, Lm), "SEQ_TERM_COUNT", 1, "interpretation", `The last payment is at time ${n + k - 1}, not ${n}; this keeps only ${n - k + 1} payments.`, { probe: `(x*(${aExpr(n, i)}-${aExpr(k - 1, i)}) - ${lit(L)})` }),
          wrong(eq(`X\\,${aSym(n + k - 1)}`, Lm), "TIMING_IGNORED_DEFERRAL", 0, "interpretation", `That assumes payments in the first ${k - 1} years as well.`, { probe: `(x*${aExpr(n + k - 1, i)} - ${lit(L)})` }),
          wrong(eq(`X\\,(${f})^{-${k - 1}}(${aSym(n + k - 1)} - ${aSym(k - 1)})`, Lm), "CONC_DOUBLE_COUNTED", 2, "connection", "The difference of annuities is already a value at time 0; discounting it again applies the deferral twice.", { probe: `(x*${vPow(i, k - 1)}*(${aExpr(n + k - 1, i)}-${aExpr(k - 1, i)}) - ${lit(L)})` }),
        ]
      : [
          wrong(eq(`X\\,${aSym(n)}\\,(${f})^{-${k}}`, Lm), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${aSym(n)}$ already values the payments one year before the first; discounting ${k} years overshoots by a year.`, { probe: `(x*${aExpr(n, i)}*${vPow(i, k)} - ${lit(L)})` }),
          wrong(eq(`X\\,${aSym(n)}`, Lm), "TIMING_IGNORED_DEFERRAL", 0, "interpretation", `That values the payments as if the first came one year after the loan, not ${k}.`, { probe: `(x*${aExpr(n, i)} - ${lit(L)})` }),
          wrong(eq(`X\\,${adueSym(n)}\\,(${f})^{-${k - 1}}`, Lm), "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${adueSym(n)}$ values the payments at time ${k}, so ${k - 1} years of discount stop at time 1.`, { probe: `(x*${adueExpr(n, i)}*${vPow(i, k - 1)} - ${lit(L)})`, confusedWith: "ann.immediate-vs-due" }),
          wrong(eq(`X\\,${aSym(n)}\\,(${f})^{${k - 1}}`, Lm), "CONC_MOVED_WRONG_WAY", 2, "application", `The value at time ${k - 1} must be discounted to time 0, not accumulated.`, { probe: `(x*${aExpr(n, i)}*${accPow(i, k - 1)} - ${lit(L)})` }),
          wrong(eq(`X\\,${aSym(n + k - 1)}`, Lm), "TRANS_IGNORED_CONDITION", 0, "interpretation", `That adds payments during the ${k - 1} years before the first one.`, { probe: `(x*${aExpr(n + k - 1, i)} - ${lit(L)})` }),
        ];
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "X", expr: root, bracket: [1, L] }], description: `The ${n} payments at times ${k} to ${n + k - 1} discounted one by one to time 0 and set equal to ${amt(L)}; each option is solved for $X$.` },
      steps: [
        { concept: "ann.deferred-annuity", reasoning: deferredForm ? `No payments for ${k - 1} years, then year-end payments: the first is at time ${k}, the last at time ${n + k - 1}.` : `The first payment is at time ${k}; the payments run to time ${n + k - 1}.` },
        { concept: "ann.annuity-value-date", reasoning: `$${aSym(n)}$ values them at time ${k - 1}; equivalently, $${aSym(n + k - 1)} - ${aSym(k - 1)}$ values them at time 0.` },
        { concept: "tvm.equation-of-value", reasoning: "Equate the time-0 value of the payments with the loan." },
      ],
      conditions: ["Year-end payments at a constant annual effective rate.", "No payments during the deferral period."],
      relationship: "$v^{k-1}a_{\\overline{n}|} = a_{\\overline{n+k-1}|} - a_{\\overline{k-1}|}$ for payments at times $k, \\ldots, n+k-1$.",
      counterexample: `With $k = 1$ the deferral vanishes and $X\\,${aSym(n)} = ${Lm}$ is correct.`,
      transfer: {
        principle: "For a deferred annuity, count the deferral to one period before the first payment.",
        unusual: deferredForm ? "The deferral is stated as a period without payments." : "The deferral is stated through the first payment date.",
        misread: "“First payment in $k$ years” is a deferral of $k-1$ periods for an annuity-immediate.",
      },
      itemFormat: "equation-selection",
      presentation: deferredForm ? ["deferred", "indirect-wording"] : ["deferred"],
      features: { multipleValuationDates: true, unfamiliar: deferredForm },
      params: { i, k, n, L, variant },
    });
  },
});

const levelStatements: ChoiceTemplate = conceptTemplate({
  id: "con-ann-level-statements",
  family: "con-ann-level",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.immediate_due", "LOANS.principal_interest"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "terminology"],
  reasoning: ["concept_recognition", "financial_intuition", "validation"],
  soaConcept: "Judging identities and comparisons for level annuities as a set of statements.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(5, 15);
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const a = (k: number) => aExpr(k, i);
    const s = (k: number) => sExpr(k, i);
    const vn = vPow(i, n);
    const steps = [
      { concept: "ann.annuity-identities", reasoning: `Split $${aSym(2 * n)}$ into the first ${n} payments and the next ${n}: $${aSym(2 * n)} = ${aSym(n)} + v^{${n}}${aSym(n)}$.` },
      { concept: "ann.deferred-annuity", reasoning: `The second block is deferred ${n} years, so it is worth $v^{${n}}${aSym(n)} < ${aSym(n)}$.` },
    ];
    const common = {
      conditions: ["Level payments at a constant annual effective rate $i > 0$."],
      relationship: "$a_{\\overline{2n}|} = a_{\\overline{n}|}(1 + v^n), \\quad s_{\\overline{n}|} = a_{\\overline{n}|}(1+i)^n, \\quad \\dfrac{1}{a_{\\overline{n}|}} = \\dfrac{1}{s_{\\overline{n}|}} + i$",
      transfer: {
        principle: "Doubling a term adds a deferred block, which is worth less than the first block.",
        unusual: "Several identities and comparisons are judged at once.",
        misread: "Value is not proportional to the number of payments.",
      },
    };
    if (level === 2 && variant === 0) {
      return statementQuestion({
        stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$${aSym(2 * n)} = ${aSym(n)}\\,(1 + v^{${n}})$`, true, `The last ${n} payments are the first ${n} deferred ${n} years.`, "CONC_ANN_DOUBLING_TERM", { check: { expr: a(2 * n), op: "=", than: `${a(n)}*(1+${vn})` }, stage: 0, failure: "recognition", conditionTrue: "It fails only if the two blocks were valued as if both started at time 1." }),
          statement("II", `$${sSym(n)} = ${aSym(n)}\\,(1+i)^{${n - 1}}$`, false, `$${aSym(n)}$ is a value at time 0 and $${sSym(n)}$ at time ${n}: the gap is ${n} years.`, "TIMING_MISSING_PERIOD", { check: { expr: s(n), op: "=", than: `${a(n)}*${accPow(i, n - 1)}` }, stage: 1, failure: "application", conditionTrue: `It holds with the exponent ${n}.` }),
          statement("III", `$\\dfrac{1}{${aSym(n)}} = \\dfrac{1}{${sSym(n)}} + i$`, true, "A loan payment is the interest on the loan plus the deposit that accumulates its principal.", "VAR_INTEREST_FOR_PRINCIPAL", { check: { expr: `1/${a(n)}`, op: "=", than: `1/${s(n)}+${lit(i)}` }, stage: 1, failure: "connection" }),
        ],
        extra: [
          { keys: ["II"], misconception: "FORMULA_AV_FOR_PV", why: "Mixing up which of $a$ and $s$ is the earlier value rejects both true identities and accepts the wrong exponent.", stage: 1, failure: "interpretation" },
          { keys: [], misconception: "TIMING_DUE_AS_IMMEDIATE", why: "All three relations are exact identities or exact failures; I and III hold for every $n$ and $i$.", stage: 0, failure: "conclusion" },
        ],
        steps: [...steps, { concept: "ann.annuity-value-date", reasoning: `$${sSym(n)}$ is $${aSym(n)}$ moved ${n} years forward; $1/a$ and $1/s$ differ by exactly $i$.` }],
        ...common,
        presentation: ["direct"],
        features: { steps: 3 },
        params: { n, i, variant, level },
      });
    }
    if (level === 2) {
      const A = an(n, i);
      const shown = (x: number) => Number(x.toFixed(4));
      return statementQuestion({
        stem: `At an annual effective interest rate of ${pc(i)}, $${aSym(n)} = ${mnum(A, 4)}$. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$${adueSym(n)} = ${mnum(A * (1 + i), 4)}$`, true, `$${adueSym(n)} = (1+i)\\,${aSym(n)}$.`, "TIMING_DUE_AS_IMMEDIATE", { check: { expr: adueExpr(n, i), op: "=", than: lit(shown(A * (1 + i))), tol: 1e-4 }, stage: 0, failure: "recognition" }),
          statement("II", `$${aSym(2 * n)} = ${mnum(2 * A, 4)}$`, false, `The second block of ${n} payments is deferred ${n} years: $${aSym(2 * n)} = ${aSym(n)}(1 + v^{${n}}) = ${mnum(an(2 * n, i), 4)}$.`, "CONC_ANN_DOUBLING_TERM", { check: { expr: a(2 * n), op: "=", than: lit(shown(2 * A)), tol: 1e-4 }, stage: 1, failure: "application", conditionTrue: "Only at $i = 0$." }),
          statement("III", `$${sSym(n)} = ${mnum(A * Math.pow(1 + i, n + 1), 4)}$`, false, `$${sSym(n)} = ${aSym(n)}(1+i)^{${n}} = ${mnum(sn(n, i), 4)}$; one power too many gives $${sdueSym(n)}$.`, "TIMING_EXTRA_PERIOD", { check: { expr: s(n), op: "=", than: lit(shown(A * Math.pow(1 + i, n + 1))), tol: 1e-4 }, stage: 2, failure: "application", conditionTrue: `It is the value of $${sdueSym(n)}$.` }),
        ],
        extra: [
          { keys: ["I", "II", "III"], misconception: "CONC_RELATED_TERM", why: "Each figure belongs to a related quantity, but only I is the quantity named.", stage: 2, failure: "conclusion" },
          { keys: ["III"], misconception: "FORMULA_AV_FOR_PV", why: "Moving between present and accumulated values by the wrong number of years accepts III and rejects I.", stage: 2, failure: "interpretation" },
        ],
        steps: [...steps, { concept: "ann.annuity-value-date", reasoning: `$${adueSym(n)}$ is $${aSym(n)}$ moved one year forward; $${sSym(n)}$ is $${aSym(n)}$ moved ${n} years forward.` }],
        ...common,
        presentation: ["direct"],
        features: { steps: 3 },
        params: { n, i, variant, level },
      });
    }
    if (variant === 0) {
      const L = gridAmount(rng, 10000, 200000, 5000);
      const X1 = `(${lit(L)}/${a(n)})`;
      const X2 = `(${lit(L)}/${a(2 * n)})`;
      return statementQuestion({
        stem: `Loans A and B are each for ${amt(L)} at an annual effective interest rate of ${pc(i)}. Loan A is repaid by level payments at the end of each year for ${n} years; Loan B by level payments at the end of each year for ${2 * n} years. Determine which of the following statements are true.`,
        statements: [
          statement("I", "The annual payment on Loan B is more than half the annual payment on Loan A.", true, `$${aSym(2 * n)} < 2${aSym(n)}$, so $1/${aSym(2 * n)} > 1/(2${aSym(n)})$.`, "CONC_ANN_DOUBLING_TERM", { check: { expr: X2, op: ">", than: `${X1}/2` }, stage: 1, failure: "application", conditionTrue: "Exactly half only at $i = 0$." }),
          statement("II", "The total interest paid on Loan B is exactly twice the total interest paid on Loan A.", false, "Loan B's balance stays higher for longer; total interest is far more than doubled.", "MODEL_INTEREST_ON_ORIGINAL", { check: { expr: `${2 * n}*${X2} - ${lit(L)}`, op: "=", than: `2*(${n}*${X1} - ${lit(L)})` }, stage: 2, failure: "connection", conditionTrue: "It would hold if interest were charged only on the original principal for each year of the term." }),
          statement("III", `Every payment on Loan B exceeds ${amt(L * i)}.`, true, `Each payment is $${mamt(L)}(i + 1/${sSym(2 * n)})$: the first year's interest plus a positive deposit.`, "VAR_INTEREST_FOR_PRINCIPAL", { check: { expr: X2, op: ">", than: lit(L * i) }, stage: 2, failure: "interpretation" }),
        ],
        extra: [
          { keys: ["II"], misconception: "SEQ_UNDISCOUNTED_SUM", why: "Reasoning from undiscounted totals — twice the payments, twice the interest — rejects I and III.", stage: 0, failure: "selection" },
          { keys: [], misconception: "CONC_DIRECTION_REVERSED", why: "I and III follow from $a_{\\overline{2n}|} < 2a_{\\overline{n}|}$ and $1/a = i + 1/s$.", stage: 1, failure: "conclusion" },
        ],
        steps: [
          ...steps,
          { concept: "ann.annuity-identities", reasoning: "Each payment equals interest on the loan plus a sinking-fund deposit: $L/a_{\\overline{n}|} = Li + L/s_{\\overline{n}|}$." },
          { concept: "loan.interest-principal-split", reasoning: "Total interest is total payments less the principal; a longer term keeps the balance high for longer." },
        ],
        ...common,
        presentation: ["compare-streams", "indirect-wording"],
        features: { steps: 4, unfamiliar: true, multiConcept: true },
        modelingDecisions: 1,
        params: { n, i, L, variant, level },
      });
    }
    return statementQuestion({
      stem: `Annuity A pays 1 at the end of each year for ${2 * n} years. Annuity B pays 2 at the end of each year for ${n} years. The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
      statements: [
        statement("I", "The present value of A is less than the present value of B.", true, `$${aSym(2 * n)} = ${aSym(n)}(1 + v^{${n}}) < 2${aSym(n)}$.`, "SEQ_UNDISCOUNTED_SUM", { check: { expr: a(2 * n), op: "<", than: `2*${a(n)}` }, stage: 1, failure: "application", conditionTrue: "They are equal only at $i = 0$, when both total the same amount." }),
        statement("II", `The value of A at time ${2 * n} is less than the value of B at time ${2 * n}.`, true, "Two streams compared at one rate keep the same order at every valuation date.", "CONC_DIRECTION_REVERSED", { check: { expr: s(2 * n), op: "<", than: `2*${s(n)}*${accPow(i, n)}` }, stage: 2, failure: "connection" }),
        statement("III", `$2${aSym(n)} - ${aSym(2 * n)} = v^{${n}}${aSym(n)}$`, false, `$2${aSym(n)} - ${aSym(2 * n)} = ${aSym(n)}(1 - v^{${n}})$; $v^{${n}}${aSym(n)}$ is $${aSym(2 * n)} - ${aSym(n)}$.`, "TRANS_INVERTED_RELATION", { check: { expr: `2*${a(n)} - ${a(2 * n)}`, op: "=", than: `${vn}*${a(n)}` }, stage: 1, failure: "interpretation", conditionTrue: `True only if $v^{${n}} = 1/2$.` }),
      ],
      extra: [
        { keys: ["III"], misconception: "CONC_ANN_DOUBLING_TERM", why: "Treating value as proportional to the term makes A and B equal, rejecting I and II.", stage: 0, failure: "recognition" },
        { keys: ["I", "III"], misconception: "TIMING_VALUATION_DATE", why: "Expecting the order to change between time 0 and time $2n$ rejects II.", stage: 2, failure: "connection" },
      ],
      steps: [
        ...steps,
        { concept: "tvm.equation-of-value", reasoning: `Values at time ${2 * n} are the time-0 values times $(1+i)^{${2 * n}}$, so the order cannot change.` },
        { concept: "ann.annuity-identities", reasoning: `Subtract: $2${aSym(n)} - ${aSym(2 * n)} = ${aSym(n)} - v^{${n}}${aSym(n)}$.` },
      ],
      ...common,
      presentation: ["compare-streams", "valuation-date"],
      features: { steps: 4, unfamiliar: true, multipleValuationDates: true },
      modelingDecisions: 1,
      params: { n, i, variant, level },
    });
  },
});

// ================================================================ perpetuities

const perpMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-perp-meaning",
  family: "con-ann-perpetuity",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.immediate_due", "TVM.discount_rates"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  reasoning: ["concept_recognition", "financial_intuition"],
  soaConcept: "What the present value of a level perpetuity represents.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 100, 5000, 50);
    const n = rng.int(5, 20);
    const viaDiscount = level === 2;
    const d0 = gridRate(rng, 0.03, 0.07, 0.005);
    const i = viaDiscount ? d0 / (1 - d0) : gridRate(rng, 0.03, 0.08, 0.005);
    const d = i / (1 + i);
    const due = variant === 1;
    const Pm = mamt(P);
    const X = due ? `(${lit(P)}/${lit(d)})` : `(${lit(P)}/${lit(i)})`;
    const rateWords = viaDiscount ? `an annual effective discount rate of ${pc(d0)}` : `an annual effective interest rate of ${pc(i)}`;
    const imm = `(${lit(P)}/${lit(i)})`;
    const NOT_FINITE = wrong("$X$ is finite only because the payments are assumed to stop once their total reaches $X$.", "CONC_ANN_PERP_INFINITE", 0, "recognition", "The payments never stop; the value is finite because the discounted payments shrink geometrically.");
    const correct: ConceptOption = due
      ? { content: `$X$ exceeds the value of a year-end perpetuity of ${amt(P)} by exactly ${amt(P)}.`, why: `The perpetuity-due is the year-end perpetuity plus the payment made today: $${Pm}/d = ${Pm}/i + ${Pm}$.`, check: { expr: `${X} - ${imm}`, op: "=", than: lit(P) } }
      : { content: `One year's interest on $X$ equals ${amt(P)}, so $X$ can make every payment without being reduced.`, why: `$X\\,i = ${Pm}$: the interest each year exactly pays the year-end payment, leaving $X$ intact.`, check: { expr: `${X}*${lit(i)}`, op: "=", than: lit(P) } };
    const distractors: ConceptOption[] = due
      ? [
          wrong(`$X$ equals the value of a year-end perpetuity of ${amt(P)} discounted one year.`, "CONC_MOVED_WRONG_WAY", 1, "application", "Paying each amount a year earlier makes the stream worth more, so the year-end value is accumulated, not discounted.", { check: { expr: `${imm}*${vPow(i, 1)}`, op: "=", than: X } }),
          wrong(`$X$ exceeds the value of a year-end perpetuity of ${amt(P)} by $d$ times that value.`, "RATE_DISCOUNT_AS_INTEREST", 2, "connection", "The excess is $i$ times the year-end value (one payment), not $d$ times it.", { check: { expr: `${X} - ${imm}`, op: "=", than: `${imm}*${lit(d)}` } }),
          wrong(`One year's interest on $X$ equals ${amt(P)}.`, "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", `That describes the year-end perpetuity; the interest on $X$ is ${amt(P)}$(1+i)$ because $X$ also funds the payment made today.`, { check: { expr: `${X}*${lit(i)}`, op: "=", than: lit(P) }, confusedWith: "ann.immediate-vs-due" }),
          wrong(`The payments from time ${n} onward are worth $X\\,v^{${n - 1}}$ at time 0.`, "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `Payments from time ${n} form the same perpetuity-due moved ${n} years: $X\\,v^{${n}}$.`, { check: { expr: perpFrom(P, n, i), op: "=", than: `${X}*${vPow(i, n - 1)}` } }),
          NOT_FINITE,
        ]
      : [
          wrong("$X$ is the value of the payments on the date of the first payment, time 1.", "CONC_ANN_PERP_VALUE_DATE", 0, "interpretation", `$${A_INF}$ values the payments one year before the first; at time 1, including that payment, they are worth $X(1+i)$.`, { check: { expr: `${perpFrom(P, 1, i)}*${accPow(i, 1)}`, op: "=", than: X } }),
          wrong("Halving the interest rate would halve $X$.", "CONC_DIRECTION_REVERSED", 2, "application", "$X = P/i$ moves inversely with the rate: halving $i$ doubles $X$.", { check: { expr: `${lit(P)}/${lit(i / 2)}`, op: "=", than: `${X}/2` } }),
          wrong(`$X$ is also the value of the first ${n} payments, since later payments add almost nothing.`, "FORMULA_PERPETUITY_FOR_FINITE", 1, "connection", `The payments after year ${n} are worth $X\\,v^{${n}}$, which is not negligible.`, { check: { expr: `${lit(P)}*${aExpr(n, i)}`, op: "=", than: X } }),
          wrong(`The payments after year ${n} are worth $X\\,v^{${n + 1}}$ at time 0.`, "TIMING_EXTRA_PERIOD", 1, "application", `Those payments form the same perpetuity deferred ${n} years: $X\\,v^{${n}}$.`, { check: { expr: perpFrom(P, n + 1, i), op: "=", than: `${X}*${vPow(i, n + 1)}` } }),
          NOT_FINITE,
        ];
    if (viaDiscount)
      distractors.unshift(
        due
          ? wrong(`$X = ${Pm}/d$ is the value of the year-end perpetuity, since the rate given is a discount rate.`, "RATE_DISCOUNT_AS_INTEREST", 2, "selection", `$${Pm}/d$ is the perpetuity-due; the year-end perpetuity is $${Pm}/i$ with $i = d/(1-d)$.`, { check: { expr: imm, op: "=", than: X } })
          : wrong(`$X$ equals ${amt(P)} divided by the discount rate, ${pc(d0)}.`, "RATE_DISCOUNT_AS_INTEREST", 2, "selection", `$${Pm}/d$ values the perpetuity-due; the year-end perpetuity is $${Pm}/i$ with $i = d/(1-d)$.`, { check: { expr: `${lit(P)}/${lit(d0)}`, op: "=", than: X } })
      );
    return conceptQuestion({
      stem: `A perpetuity pays ${amt(P)} at the ${due ? "beginning" : "end"} of each year${due ? ", the first payment today" : ""}. At ${rateWords}, its present value is $X$.\n\nWhich of the following statements about $X$ is true?`,
      correct,
      distractors,
      reference: { description: "Each quantitative statement is decided by evaluating both sides at the stated rate (the perpetuity summed as a geometric series); only the correct statement holds." },
      steps: [
        { concept: "ann.perpetuity", reasoning: due ? "A perpetuity-due is worth $P/d = P(1+i)/i$: the year-end perpetuity plus the payment made now." : "$P/i$ is the capital whose interest each year is exactly $P$, so it supports the payments forever." },
        { concept: due ? "ann.immediate-vs-due" : "ann.annuity-value-date", reasoning: due ? "Every payment is one year earlier than in the year-end perpetuity." : "$1/i$ values payments at times $1, 2, \\ldots$ at time 0, one year before the first." },
        { concept: "ann.finite-vs-perpetual", reasoning: `The payments after time ${n} are the same perpetuity deferred ${n} years: $v^{${n}}$ times its value.` },
        ...(viaDiscount ? [{ concept: "tvm.discount-vs-interest", reasoning: `Convert the discount rate: $i = d/(1-d) = ${mnum(i * 100, 4)}\\%$.` }] : []),
      ],
      conditions: ["Level payments forever at a constant annual effective rate."],
      relationship: due ? "$\\ddot{a}_{\\overline{\\infty}|} = \\dfrac{1}{d} = 1 + \\dfrac{1}{i}$" : "$a_{\\overline{\\infty}|} = \\dfrac{1}{i}$, and $v^{n}a_{\\overline{\\infty}|}$ values the payments after time $n$.",
      counterexample: "At $i = 0$ there is no interest to fund the payments and no finite value.",
      transfer: {
        principle: "Read $P/i$ as capital that pays $P$ in interest each period; deferral multiplies it by $v^n$.",
        unusual: "You interpret the value rather than compute it.",
        misread: due ? "Due versus year-end changes the value by exactly one payment." : "The value $P/i$ is at time 0, not at the first payment.",
      },
      itemFormat: "interpretation",
      presentation: viaDiscount ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: viaDiscount },
      params: { P, i, n, variant },
    });
  },
});

const perpDeferred: ChoiceTemplate = conceptTemplate({
  id: "con-ann-perp-deferred",
  family: "con-ann-perpetuity",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.streams", "ANNUITIES.frequency_timing"],
  itemFormat: "expression-selection",
  conceptFamily: "timeline",
  dimensions: ["timing", "equation_construction"],
  reasoning: ["valuation_dates", "cashflow_modelling", "formula_selection"],
  soaConcept: "Placing a deferred perpetuity on the timeline and choosing the matching expression.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 100, 5000, 50);
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const Pm = mamt(P);
    const k = rng.int(level === 2 ? 4 : 3, 9);
    const opt = (latex: string, probe: string) => ({ content: math(latex), probe });
    const perp = (factor: string, due = false) => `${Pm}\\,${due ? ADUE_INF : A_INF}${factor ? `\\,${factor}` : ""}`;
    const perpE = (exp: number, due = false) => `(${lit(P)}/${lit(due ? i / (1 + i) : i)}*${accPow(i, exp)})`;
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let truth: string;
    let steps = [
      { concept: "ann.perpetuity", reasoning: "$a_{\\overline{\\infty}|}$ values year-end payments one year before the first; $\\ddot{a}_{\\overline{\\infty}|}$ values them on the first payment date." },
      { concept: "ann.deferred-annuity", reasoning: "" },
      { concept: "ann.annuity-value-date", reasoning: "Check the result by its first term: the first payment must be discounted to the valuation date exactly once." },
    ];
    if (level === 1 && variant === 0) {
      truth = perpFrom(P, k, i);
      stem = `A perpetuity pays ${amt(P)} at the end of each year. The first payment is at the end of year ${k}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the perpetuity.`;
      correct = { ...opt(perp(pow(i, -(k - 1))), perpE(-(k - 1))), why: `$${A_INF}$ values the payments at time ${k - 1}, one year before the first; discount ${k - 1} years.` };
      distractors = [
        wrong(math(perp(pow(i, -k))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `Discounting ${k} years treats $${A_INF}$ as a value at the first payment date.`, { probe: perpE(-k) }),
        wrong(math(perp("")), "TIMING_IGNORED_DEFERRAL", 1, "interpretation", "That values the perpetuity as if the first payment were one year away.", { probe: perpE(0) }),
        wrong(math(perp(pow(i, -(k - 1)), true)), "TIMING_IMMEDIATE_AS_DUE", 0, "selection", `$${ADUE_INF}$ already values at the first payment date, time ${k}; with ${k - 1} years of discount it stops at time 1.`, { probe: perpE(-(k - 1), true), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(perp(pow(i, k - 1))), "CONC_MOVED_WRONG_WAY", 2, "application", "A value at a later date must be discounted to time 0, not accumulated.", { probe: perpE(k - 1) }),
        wrong(math(`${Pm}\\,(${A_INF} + ${aSym(k - 1)})`), "ALG_SIGN_ERROR", 1, "application", `The ${k - 1} missing payments must be subtracted from the full perpetuity.`, { probe: `(${lit(P)}*(1/${lit(i)}+${aExpr(k - 1, i)}))` }),
      ];
      steps[1] = { concept: "ann.deferred-annuity", reasoning: `The first payment is at time ${k}, so the deferral is ${k - 1} years.` };
    } else if (level === 1) {
      truth = perpFrom(P, k, i);
      stem = `Payments of ${amt(P)} are made at the end of each year, beginning at the end of year ${k} and continuing forever. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const diff = (sub: string, inf = A_INF, sign = "-") => `${Pm}\\,(${inf} ${sign} ${sub})`;
      correct = { ...opt(diff(aSym(k - 1)), `(${lit(P)}*(1/${lit(i)}-${aExpr(k - 1, i)}))`), why: `A perpetuity from time 1, less the ${k - 1} payments at times 1 to ${k - 1} that are not made.` };
      distractors = [
        wrong(math(diff(aSym(k))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `Subtracting $${aSym(k)}$ also removes the payment at time ${k}.`, { probe: `(${lit(P)}*(1/${lit(i)}-${aExpr(k, i)}))` }),
        wrong(math(diff(aSym(k - 1), ADUE_INF)), "TIMING_IMMEDIATE_AS_DUE", 0, "selection", "$\\ddot{a}_{\\overline{\\infty}|}$ adds a payment at time 0, which is never made.", { probe: `(${lit(P)}*(1/${lit(i / (1 + i))}-${aExpr(k - 1, i)}))`, confusedWith: "ann.immediate-vs-due" }),
        wrong(math(diff(aSym(k - 1), A_INF, "+")), "ALG_SIGN_ERROR", 1, "application", "The missing early payments are subtracted, not added.", { probe: `(${lit(P)}*(1/${lit(i)}+${aExpr(k - 1, i)}))` }),
        wrong(math(diff(sSym(k - 1))), "FORMULA_AV_FOR_PV", 2, "selection", `$${sSym(k - 1)}$ is a value at time ${k - 1}; the subtraction needs their value at time 0.`, { probe: `(${lit(P)}*(1/${lit(i)}-${sExpr(k - 1, i)}))` }),
        wrong(math(`${Pm}\\,${A_INF} - ${mamt((k - 1) * P)}`), "SEQ_UNDISCOUNTED_SUM", 2, "application", "The missing payments are worth their present value, not their face total.", { probe: `(${lit(P)}/${lit(i)}-${lit((k - 1) * P)})` }),
      ];
      steps[1] = { concept: "ann.deferred-annuity", reasoning: `Deferred perpetuity = full perpetuity less the first ${k - 1} payments: $a_{\\overline{\\infty}|} - a_{\\overline{${k - 1}}|} = v^{${k - 1}}a_{\\overline{\\infty}|}$.` };
    } else if (level === 2 && variant === 0) {
      const T = rng.int(1, k - 2);
      const e = k - 1 - T;
      truth = `(${perpFrom(P, k, i)}*${accPow(i, T)})`;
      stem = `A perpetuity pays ${amt(P)} at the end of each year. The first payment is at the end of year ${k}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the value of the perpetuity at time ${T}.`;
      correct = { ...opt(perp(pow(i, -e)), perpE(-e)), why: `$${A_INF}$ gives the value at time ${k - 1}; time ${T} is ${e} year${e > 1 ? "s" : ""} earlier.` };
      distractors = [
        wrong(math(perp(pow(i, -(e + 1)))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `That discounts from the first payment date, time ${k}, instead of from time ${k - 1}.`, { probe: perpE(-(e + 1)) }),
        wrong(math(perp(pow(i, -(k - 1)))), "TIMING_VALUATION_DATE", 2, "application", `That is the value at time 0, not at time ${T}.`, { probe: perpE(-(k - 1)) }),
        wrong(math(perp(pow(i, -e), true)), "TIMING_IMMEDIATE_AS_DUE", 0, "selection", `$${ADUE_INF}$ values the payments at time ${k}; the same discount then reaches time ${T + 1}.`, { probe: perpE(-e, true), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(perp(pow(i, e))), "CONC_MOVED_WRONG_WAY", 2, "application", `Time ${T} is before time ${k - 1}: discount, do not accumulate.`, { probe: perpE(e) }),
        wrong(math(perp("")), "TIMING_IGNORED_DEFERRAL", 1, "interpretation", `That is the value at time ${k - 1}.`, { probe: perpE(0) }),
      ];
      steps[1] = { concept: "ann.deferred-annuity", reasoning: `Value at time ${k - 1}, then discount ${e} year${e > 1 ? "s" : ""} to time ${T}.` };
    } else if (level === 2) {
      truth = perpFrom(P, k, i);
      stem = `A perpetuity pays ${amt(P)} at the beginning of each year. The first payment is made at the beginning of year ${k + 1}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the perpetuity.`;
      correct = { ...opt(perp(pow(i, -(k - 1))), perpE(-(k - 1))), why: `The beginning of year ${k + 1} is time ${k}. Viewed from time ${k - 1}, the payments are at the end of each year, so $${A_INF}$ values them at time ${k - 1}.` };
      distractors = [
        wrong(math(perp(pow(i, -(k - 1)), true)), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${ADUE_INF}$ values the payments at time ${k}; ${k - 1} years of discount stop at time 1.`, { probe: perpE(-(k - 1), true), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(perp(pow(i, -k))), "TIMING_EXTRA_PERIOD", 0, "interpretation", `That places the first payment at time ${k + 1}, the end of year ${k + 1}.`, { probe: perpE(-k) }),
        wrong(math(perp("", true)), "TIMING_IGNORED_DEFERRAL", 1, "interpretation", "That is the value if the first payment were made today.", { probe: perpE(0, true) }),
        wrong(math(perp(pow(i, k - 1))), "CONC_MOVED_WRONG_WAY", 2, "application", "A value at a later date must be discounted to time 0, not accumulated.", { probe: perpE(k - 1) }),
      ];
      steps[1] = { concept: "ann.immediate-vs-due", reasoning: `Beginning of year ${k + 1} = time ${k}. The same payments are a perpetuity-due from time ${k} or a perpetuity-immediate from time ${k - 1}.` };
    } else if (variant === 0) {
      const j2 = `(${accPow(i, 2)}-1)`;
      truth = perpFrom(P, k, i, 2);
      const two = (den: string, e: number) => `\\dfrac{${Pm}}{${den}}\\,${pow(i, e)}`;
      const twoE = (den: string, e: number) => `(${lit(P)}/${den}*${accPow(i, e)})`;
      const J = `(${fac(i)})^{2} - 1`;
      stem = `A perpetuity pays ${amt(P)} every two years. The first payment is at time ${k}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the perpetuity.`;
      correct = { ...opt(two(J, -(k - 2)), twoE(j2, -(k - 2))), why: `The payment period is two years, with effective rate $(1+i)^2 - 1$. A perpetuity-immediate at that rate values the payments one payment period before the first, at time ${k - 2}.` };
      distractors = [
        wrong(math(two(`2(${lit(i)})`, -(k - 2))), "MODEL_COMPOUND_AS_SIMPLE", 1, "selection", "Two years at an effective rate compound to $(1+i)^2 - 1$, which exceeds $2i$.", { probe: twoE(`(2*${lit(i)})`, -(k - 2)) }),
        wrong(math(two(J, -(k - 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", "The factor values one payment period (two years) before the first payment, not one year.", { probe: twoE(j2, -(k - 1)) }),
        wrong(math(two(J, -k)), "TIMING_EXTRA_PERIOD", 2, "application", "That discounts from the first payment date, as if the factor valued at time $k$.", { probe: twoE(j2, -k) }),
        wrong(math(two(lit(i), -(k - 1))), "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "selection", "The annual rate fits annual payments; these are two years apart.", { probe: twoE(lit(i), -(k - 1)) }),
        wrong(math(two(J, k - 2)), "CONC_MOVED_WRONG_WAY", 2, "application", "The value must be discounted back to time 0, not accumulated.", { probe: twoE(j2, k - 2) }),
      ];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "Payments are two years apart: use the effective two-year rate $(1+i)^2 - 1$." },
        { concept: "ann.perpetuity", reasoning: "At that rate the perpetuity is worth $P/[(1+i)^2 - 1]$ one payment period before the first payment." },
        { concept: "ann.deferred-annuity", reasoning: `One payment period before time ${k} is time ${k - 2}; discount ${k - 2} years to time 0.` },
        { concept: "ann.annuity-value-date", reasoning: "Check the first term: the payment at time $k$ is discounted $k$ years in total." },
      ];
    } else {
      const jh = `(${accPow(i, 0.5)}-1)`;
      truth = perpFrom(P, k, i, 0.5);
      const half = (den: string, e: number | string) => `\\dfrac{${Pm}}{${den}}\\,${pow(i, e)}`;
      const halfE = (den: string, e: number) => `(${lit(P)}/${den}*${accPow(i, e)})`;
      const J = `(${fac(i)})^{1/2} - 1`;
      stem = `A perpetuity pays ${amt(P)} at the end of every six months. The first payment is made ${k} years from now. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the perpetuity.`;
      correct = { ...opt(half(J, `-${k - 0.5}`), halfE(jh, -(k - 0.5))), why: `The effective half-year rate is $(1+i)^{1/2} - 1$; the perpetuity factor values the payments half a year before the first, at time ${k - 0.5}.` };
      distractors = [
        wrong(math(half(lit(i / 2), `-${k - 0.5}`)), "RATE_DIVIDED_EFFECTIVE", 1, "selection", "Halving an annual effective rate does not give the effective half-year rate.", { probe: halfE(lit(i / 2), -(k - 0.5)) }),
        wrong(math(half(J, -(k - 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", "The factor values one payment period — half a year — before the first payment, not a full year.", { probe: halfE(jh, -(k - 1)) }),
        wrong(math(half(J, -k)), "TIMING_EXTRA_PERIOD", 2, "application", "That discounts from the first payment date, as if the factor valued there.", { probe: halfE(jh, -k) }),
        wrong(math(half(lit(i), `-${k - 0.5}`)), "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "selection", "The annual rate fits annual payments; these are six months apart.", { probe: halfE(lit(i), -(k - 0.5)) }),
        wrong(math(half(J, `${k - 0.5}`)), "CONC_MOVED_WRONG_WAY", 2, "application", "The value must be discounted back to time 0, not accumulated.", { probe: halfE(jh, k - 0.5) }),
      ];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "Payments are half a year apart: use the effective half-year rate $(1+i)^{1/2} - 1$." },
        { concept: "ann.perpetuity", reasoning: "At that rate the perpetuity is worth $P/[(1+i)^{1/2} - 1]$ one half-year before the first payment." },
        { concept: "ann.deferred-annuity", reasoning: `One half-year before time ${k} is time ${k - 0.5}; discount that many years to time 0.` },
        { concept: "ann.annuity-value-date", reasoning: "Check the first term: the payment at time $k$ is discounted $k$ years in total." },
      ];
    }
    const hard = level === 3;
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "value", expr: truth }], description: "The payments summed as a geometric series from the first payment date; each option is evaluated and only the correct one agrees." },
      steps,
      conditions: ["Level payments forever at a constant annual effective rate.", ...(hard ? ["The interest rate used must be the effective rate per payment period."] : [])],
      relationship: hard ? "Value at time 0 $= v^{k - h}\\,\\dfrac{P}{j}$, where $h$ is the payment interval and $j = (1+i)^h - 1$." : "$v^{k-1}a_{\\overline{\\infty}|} = a_{\\overline{\\infty}|} - a_{\\overline{k-1}|}$ for payments at times $k, k+1, \\ldots$",
      counterexample: "With the first payment one period from now there is no deferral and $P/i$ is correct.",
      transfer: {
        principle: "Find the date the perpetuity factor values at — one payment period before the first payment — then move that value to the requested date.",
        unusual: hard ? "The payment interval differs from the interest period." : "The first payment is not one period away.",
        misread: "“First payment at time $k$” means a deferral of one period less.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["frequency", "deferred", "hidden-structure"] : level === 2 ? ["deferred", "valuation-date"] : ["deferred"],
      features: { multipleValuationDates: level >= 2, unfamiliar: level >= 2 },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { P, i, k, variant },
    });
  },
});

const perpDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-ann-perp-diagnosis",
  family: "con-ann-perpetuity",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.frequency_timing", "TVM.effective_nominal"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing", "rate_conversion"],
  reasoning: ["validation", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Diagnosing the error in a proposed perpetuity valuation.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 100, 5000, 50);
    const Pm = mamt(P);
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const d = i / (1 + i);
    const ask = "Which of the following correctly describes the candidate's calculation?";
    const fix = (expr: string, truth: string) => ({ expr, op: "=" as const, than: truth });
    if (level === 2 && variant === 0) {
      const k = rng.int(3, 9);
      const truth = perpFrom(P, k, i);
      const W = `(${lit(P)}/${lit(i)}*${vPow(i, k)})`;
      const Wv = (P / i) * Math.pow(1 + i, -k);
      return conceptQuestion({
        stem: `A perpetuity pays ${amt(P)} at the end of each year, the first payment at the end of year ${k}. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Pm}\\,${A_INF}\\,${pow(i, -k)} = ${mnum(Wv, 2)}.$$\n\n${ask}`,
        correct: { content: `$${A_INF}$ already values the payments one year before the first, so the discount should be for ${k - 1} years: multiply by $1 + i$.`, why: `The factor leaves the value at time ${k - 1}; the correct value is $${mnum(Wv * (1 + i), 2)}$.`, check: fix(`${W}*${accPow(i, 1)}`, truth) },
        distractors: [
          wrong(`The calculation is correct: $${A_INF}$ values a perpetuity on the date of its first payment.`, "CONC_ANN_PERP_VALUE_DATE", 0, "interpretation", "$1/i$ values the payments one year before the first payment.", { check: fix(W, truth) }),
          wrong("The value is overstated by one year of interest: divide by $1 + i$.", "CONC_MOVED_WRONG_WAY", 1, "application", "The candidate discounted one year too many, so the value is too small, not too large.", { check: fix(`${W}*${vPow(i, 1)}`, truth) }),
          wrong(`The payments are deferred, so $${ADUE_INF}$ should replace $${A_INF}$, with ${k - 1} years of discount.`, "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${ADUE_INF}$ values at time ${k}; ${k - 1} more years of discount reach time 1, not 0.`, { check: fix(`${lit(P)}/${lit(d)}*${vPow(i, k - 1)}`, truth), confusedWith: "ann.immediate-vs-due" }),
          wrong(`Deferral does not change a perpetuity's value, so the answer is $${Pm}\\,${A_INF}$.`, "TIMING_IGNORED_DEFERRAL", 0, "recognition", "Payments that start later are worth less today.", { check: fix(`${lit(P)}/${lit(i)}`, truth) }),
          wrong(`The candidate should instead subtract ${amt(P)}$\\,${aSym(k)}$ from ${amt(P)}$\\,${A_INF}$.`, "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `That removes ${k} payments, including the one at time ${k}, and gives the same value as the candidate.`, { check: fix(`${lit(P)}*(1/${lit(i)}-${aExpr(k, i)})`, truth) }),
        ],
        reference: { description: `The payments summed as a geometric series from time ${k}; each diagnosis's correction is applied and compared with it.` },
        steps: [
          { concept: "ann.perpetuity", reasoning: `$${A_INF}$ values year-end payments one year before the first.` },
          { concept: "ann.deferred-annuity", reasoning: `First payment at time ${k}, so the factor gives the value at time ${k - 1}; discount ${k - 1} years.` },
          { concept: "ann.annuity-value-date", reasoning: "The candidate discounted one year too many: multiply by $1 + i$." },
        ],
        conditions: ["Level year-end payments forever at a constant annual effective rate."],
        relationship: "$v^{k-1}a_{\\overline{\\infty}|}$ for payments at times $k, k+1, \\ldots$",
        counterexample: "For a first payment at time 1, no discount is needed and $P/i$ is correct.",
        transfer: { principle: "Before discounting a factor's value, locate the date the factor leaves it at.", unusual: "You judge a worked solution.", misread: "“First payment at time $k$” invites discounting $k$ years." },
        itemFormat: "error-diagnosis",
        presentation: ["deferred"],
        features: { multipleValuationDates: true },
        params: { P, i, k, variant },
      });
    }
    if (level === 2) {
      const truth = perpFrom(P, 0, i);
      const W = `(${lit(P)}/${lit(i)})`;
      return conceptQuestion({
        stem: `A perpetuity pays ${amt(P)} at the beginning of each year, the first payment today. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Pm}\\,${A_INF} = ${mnum(P / i, 2)}.$$\n\n${ask}`,
        correct: { content: `Each payment is one year earlier than $${A_INF}$ assumes: multiply by $1 + i$.`, why: `The perpetuity-due is worth $${Pm}/d = ${mnum(P / d, 2)}$.`, check: fix(`${W}*${accPow(i, 1)}`, truth) },
        distractors: [
          wrong(`The calculation is correct: $${A_INF}$ includes the payment made today.`, "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", "$1/i$ starts with a payment one year from now.", { check: fix(W, truth), confusedWith: "ann.immediate-vs-due" }),
          wrong("The value is overstated by one year of interest: divide by $1 + i$.", "CONC_MOVED_WRONG_WAY", 1, "application", "Earlier payments are worth more, not less.", { check: fix(`${W}*${vPow(i, 1)}`, truth) }),
          wrong("The value should be multiplied by $1 + d$, where $d$ is the discount rate.", "RATE_DISCOUNT_AS_INTEREST", 2, "connection", "Moving payments one year earlier multiplies by $1 + i$; $1 + d$ is too small.", { check: fix(`${W}*(1+${lit(d)})`, truth) }),
          wrong(`The payment made today has been counted twice: subtract ${amt(P)}.`, "CONC_DOUBLE_COUNTED", 1, "interpretation", "$1/i$ contains no payment today, so nothing is counted twice; one payment is missing.", { check: fix(`${W}-${lit(P)}`, truth) }),
          wrong("A perpetuity-due has no finite value, so no correction can fix the calculation.", "CONC_ANN_PERP_INFINITE", 0, "recognition", "Its value is $P/d$, finite whenever $i > 0$."),
        ],
        reference: { description: "The payments summed as a geometric series from time 0; each diagnosis's correction is applied and compared with it." },
        steps: [
          { concept: "ann.immediate-vs-due", reasoning: "“First payment today” makes the perpetuity a perpetuity-due." },
          { concept: "ann.perpetuity", reasoning: "$a_{\\overline{\\infty}|} = 1/i$ values payments at times $1, 2, \\ldots$" },
          { concept: "ann.annuity-value-date", reasoning: "Every payment here is one year earlier: $\\ddot{a}_{\\overline{\\infty}|} = (1+i)/i = 1/d$." },
        ],
        conditions: ["Level payments forever, first payment today."],
        relationship: "$\\ddot{a}_{\\overline{\\infty}|} = (1+i)\\,a_{\\overline{\\infty}|} = 1/d$",
        counterexample: "If the first payment were in one year, $P/i$ would be correct.",
        transfer: { principle: "Find the first payment on the timeline before choosing between $1/i$ and $1/d$.", unusual: "You judge a worked solution.", misread: "“First payment today” is easy to skip." },
        itemFormat: "error-diagnosis",
        presentation: ["direct"],
        features: { multiConcept: true },
        params: { P, i, variant },
      });
    }
    if (variant === 0) {
      const truth = perpFrom(P, 2, i, 2);
      const J = `(${accPow(i, 2)}-1)`;
      const W = `(${lit(P)}/(2*${lit(i)}))`;
      return conceptQuestion({
        stem: `A perpetuity pays ${amt(P)} every two years, the first payment at time 2. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$\\dfrac{${Pm}}{2(${lit(i)})} = ${mnum(P / (2 * i), 2)}.$$\n\n${ask}`,
        correct: { content: "Interest compounds over each two-year period: divide by the two-year effective rate $(1+i)^2 - 1$ instead.", why: `$${Pm}/[(1+i)^2 - 1] = ${mnum(P / (Math.pow(1 + i, 2) - 1), 2)}$, smaller than the candidate's value.`, check: fix(`${lit(P)}/${J}`, truth) },
        distractors: [
          wrong("The calculation is correct: $2i$ is the effective rate for a two-year period.", "MODEL_COMPOUND_AS_SIMPLE", 1, "selection", "Two years at rate $i$ accumulate to $(1+i)^2$, so the two-year rate is $2i + i^2$.", { check: fix(W, truth) }),
          wrong("Interest is credited annually, so divide by the annual rate $i$ instead.", "CONC_ANN_RATE_PERIOD_MISMATCH", 0, "recognition", "$P/i$ would value a payment every year; the rate must match the two-year payment period.", { check: fix(`${lit(P)}/${lit(i)}`, truth) }),
          wrong(`Divide by $i\\,${aSym(2)}$ instead, spreading each payment over the two years before it.`, "CONC_ANN_KYEAR_DIVISOR", 2, "connection", `Spreading a payment at the end of a block over that block needs $${sSym(2)}$, not $${aSym(2)}$; this values payments starting today.`, { check: fix(`${lit(P)}/(${lit(i)}*${aExpr(2, i)})`, truth) }),
          wrong("Divide by $(1+i)^2 - 1$, then multiply by $(1+i)^2$ because the first payment is at time 2.", "CONC_ANN_PERP_VALUE_DATE", 2, "application", "At the two-year rate the perpetuity factor already values one payment period before the first payment, time 0.", { check: fix(`${lit(P)}/${J}*${accPow(i, 2)}`, truth) }),
        ],
        reference: { description: "The payments at times 2, 4, … summed as a geometric series; each diagnosis's correction is applied and compared with it." },
        steps: [
          { concept: "ann.payment-frequency", reasoning: "Payments are two years apart, so the rate must be the effective two-year rate." },
          { concept: "tvm.simple-vs-compound", reasoning: "Compounding gives $(1+i)^2 - 1 = 2i + i^2$, not $2i$." },
          { concept: "ann.perpetuity", reasoning: "At that rate the perpetuity-immediate formula values the payments at time 0, one payment period before time 2." },
        ],
        conditions: ["Constant annual effective rate; payments every two years forever."],
        relationship: "$\\dfrac{P}{(1+i)^2 - 1} = \\dfrac{P}{i\\,s_{\\overline{2}|}}$",
        counterexample: "With payments every year, $P/i$ is right because the payment and interest periods coincide.",
        transfer: { principle: "Match the rate to the payment period before using a level-payment formula.", unusual: "Payments are less frequent than interest is credited.", misread: "$2i$ looks like a two-year rate but ignores interest on interest." },
        itemFormat: "error-diagnosis",
        presentation: ["frequency", "hidden-structure"],
        features: { unfamiliar: true },
        modelingDecisions: 1,
        params: { P, i, variant },
      });
    }
    const k = rng.int(3, 8);
    const r = 12 * gridRate(rng, 0.003, 0.007, 0.0005);
    const m = r / 12;
    const g = `(1+${lit(m)})`;
    const ie = `(${g}**12-1)`;
    const truth = `(${lit(P)}*${g}**(-${12 * k})/(1-${g}**(-12)))`;
    const W = `(${lit(P)}/${lit(r)}*${g}**(-${12 * (k - 1)}))`;
    const Wv = (P / r) * Math.pow(1 + m, -12 * (k - 1));
    return conceptQuestion({
      stem: `A perpetuity pays ${amt(P)} at the end of each year, the first payment at the end of year ${k}. Interest is at a nominal annual rate of ${pc(r)} convertible monthly. A candidate calculates the present value as\n\n$$\\dfrac{${Pm}}{${lit(r)}}\\left(1 + \\dfrac{${lit(r)}}{12}\\right)^{-${12 * (k - 1)}} = ${mnum(Wv, 2)}.$$\n\n${ask}`,
      correct: { content: `The deferral is right, but the perpetuity needs the annual effective rate: replace ${lit(r)} by $(1 + ${lit(r)}/12)^{12} - 1$.`, why: `Annual payments need an annual effective rate, ${num((Math.pow(1 + m, 12) - 1) * 100, 4)}%, which exceeds the nominal rate.`, check: fix(`${lit(P)}/${ie}*${g}**(-${12 * (k - 1)})`, truth) },
      distractors: [
        wrong(`The calculation is correct: ${lit(r)} is an annual rate and the payments are annual.`, "RATE_NOMINAL_AS_EFFECTIVE", 0, "recognition", "A nominal rate convertible monthly is not the annual effective rate.", { check: fix(W, truth), confusedWith: "tvm.nominal-vs-effective" }),
        wrong(`Interest is credited monthly, so replace ${lit(r)} by the monthly rate ${lit(m)}.`, "CONC_ANN_RATE_PERIOD_MISMATCH", 0, "selection", "A monthly rate would fit monthly payments; these are annual.", { check: fix(`${lit(P)}/${lit(m)}*${g}**(-${12 * (k - 1)})`, truth) }),
        wrong(`The deferral should be ${12 * k} months, since the first payment is at the end of year ${k}.`, "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `The perpetuity factor values at time ${k - 1}, so ${12 * (k - 1)} months of discount is right.`, { check: fix(`${lit(P)}/${lit(r)}*${g}**(-${12 * k})`, truth) }),
        wrong(`Use the annual effective rate in the perpetuity and discount ${12 * k} months, to the first payment date.`, "CONC_ANN_PERP_VALUE_DATE", 1, "application", `$P/i$ values one year before the first payment, at time ${k - 1}; discounting ${12 * k} months overshoots by a year.`, { check: fix(`${lit(P)}/${ie}*${g}**(-${12 * k})`, truth) }),
        wrong(`Convert the payments to monthly amounts of ${amt(P / 12)} and value them at ${lit(m)} per month.`, "RATE_PAYMENT_FREQUENCY", 2, "connection", "Splitting the annual payment into twelve moves money earlier; it does not describe these payments.", { check: fix(`${lit(P / 12)}/${lit(m)}*${g}**(-${12 * (k - 1)})`, truth) }),
      ],
      reference: { description: `Each annual payment discounted monthly at ${lit(m)}, summed as a geometric series from time ${k}; each diagnosis's correction is compared with it.` },
      steps: [
        { concept: "tvm.nominal-vs-effective", reasoning: `The annual effective rate is $(1 + ${lit(r)}/12)^{12} - 1$.` },
        { concept: "ann.payment-frequency", reasoning: "Annual payments need the effective rate per year in the perpetuity factor." },
        { concept: "ann.deferred-annuity", reasoning: `The factor values at time ${k - 1}; the candidate's ${12 * (k - 1)}-month discount at the monthly rate is equivalent to ${k - 1} years.` },
        { concept: "ann.perpetuity", reasoning: "Only the rate in $P/i$ is wrong." },
      ],
      conditions: ["Nominal rate convertible monthly; annual payments forever."],
      relationship: "$\\dfrac{P}{i}\\,v^{k-1}$ with $1 + i = (1 + i^{(12)}/12)^{12}$",
      counterexample: "With payments every month, $P/(i^{(12)}/12)$ would be the right perpetuity factor.",
      transfer: { principle: "Convert the rate to the payment period first; check deferral separately.", unusual: "Two features of the solution must be judged: one is right, one is wrong.", misread: "“Annual rate” does not mean “annual effective rate”." },
      itemFormat: "error-diagnosis",
      presentation: ["frequency", "deferred", "indirect-wording"],
      features: { multipleValuationDates: true, unfamiliar: true },
      modelingDecisions: 1,
      params: { P, r, k, variant },
    });
  },
});

// ================================================================ arithmetic

/** Markup for payments first, first+step, …, at times t0, t0+1, …. */
const arithText = (first: number, step: number, count: number, t0: number): string =>
  `Payments of $${mamt(first)}, ${mamt(first + step)}, \\ldots, ${mamt(first + (count - 1) * step)}$ at times $${t0}, ${t0 + 1}, \\ldots, ${t0 + count - 1}$`;
const arithPV = (first: number, step: number, count: number, t0: number, i: number): string =>
  pvTerms(Array.from({ length: count }, (_, k) => ({ t: t0 + k, amount: first + k * step })), i);

const arithMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-arith-meaning",
  family: "con-ann-arithmetic",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.non_level"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  reasoning: ["concept_recognition", "cashflow_modelling"],
  soaConcept: "Reading the payment pattern an increasing or decreasing annuity symbol describes.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(6, 15);
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const Q = gridAmount(rng, 50, 500, 50);
    const P = gridAmount(rng, 200, 2000, 100);
    const Qm = mamt(Q);
    let E: string;
    let Elatex: string;
    let cor: [number, number];
    let rows: Array<[number, number, number, number, MisconceptionId, number, ConceptFailure, string]>;
    if (level === 1 && variant === 0) {
      E = `(${lit(Q)}*${IaE(n, i)})`;
      Elatex = `${Qm}\\,${IaSym(n)}`;
      cor = [Q, Q];
      rows = [
        [n * Q, -Q, n, 1, "FORMULA_DECREASING_FOR_INCREASING", 0, "recognition", "That is $(Da)$: the largest payment first."],
        [Q, Q, n, 0, "TIMING_IMMEDIATE_AS_DUE", 1, "interpretation", "$(Ia)$ is an annuity-immediate: the first payment is at time 1."],
        [Q, Q, n - 1, 2, "SEQ_TERM_COUNT", 1, "application", `$(Ia)_{\\overline{${n}}|}$ has ${n} payments, the first at time 1.`],
        [Q * (n + 1) / 2, 0, n, 1, "MODEL_LEVEL_FOR_VARYING", 0, "selection", "Level payments at the average amount are worth less: the larger payments come later but the discounting is not linear."],
      ];
    } else if (level === 1) {
      E = `(${lit(Q)}*${DaE(n, i)})`;
      Elatex = `${Qm}\\,${DaSym(n)}`;
      cor = [n * Q, -Q];
      rows = [
        [Q, Q, n, 1, "FORMULA_DECREASING_FOR_INCREASING", 0, "recognition", "That is $(Ia)$: the smallest payment first."],
        [n * Q, -Q, n, 0, "TIMING_IMMEDIATE_AS_DUE", 1, "interpretation", "$(Da)$ is an annuity-immediate: the first payment is at time 1."],
        [(n - 1) * Q, -Q, n, 1, "SEQ_TERM_COUNT", 1, "application", `$(Da)_{\\overline{${n}}|}$ starts at ${n} and ends at 1, not 0.`],
        [Q * (n + 1) / 2, 0, n, 1, "MODEL_LEVEL_FOR_VARYING", 0, "selection", "Level payments at the average amount are worth less, since the larger payments here come first."],
      ];
    } else if (variant === 0) {
      E = `(${lit(P)}*${aExpr(n, i)}+${lit(Q)}*${IaE(n, i)})`;
      Elatex = `${mamt(P)}\\,${aSym(n)} + ${Qm}\\,${IaSym(n)}`;
      cor = [P + Q, Q];
      rows = [
        [P, Q, n, 1, "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `$(Ia)$ already pays ${amt(Q)} at time 1, so the first payment is ${amt(P + Q)}.`],
        [P + n * Q, -Q, n, 1, "FORMULA_DECREASING_FOR_INCREASING", 0, "recognition", "$(Ia)$ increases; this pattern decreases."],
        [P + Q, Q, n, 0, "TIMING_IMMEDIATE_AS_DUE", 1, "interpretation", "Both symbols are annuities-immediate: payments at times 1 to $n$."],
        [P + Q, 0, n, 1, "MODEL_LEVEL_FOR_VARYING", 2, "connection", "The $(Ia)$ part grows each year; it is not a level addition."],
      ];
    } else {
      E = `(${lit((n + 1) * Q)}*${aExpr(n, i)}-${lit(Q)}*${IaE(n, i)})`;
      Elatex = `${mamt((n + 1) * Q)}\\,${aSym(n)} - ${Qm}\\,${IaSym(n)}`;
      cor = [n * Q, -Q];
      rows = [
        [Q, Q, n, 1, "FORMULA_DECREASING_FOR_INCREASING", 0, "recognition", "Subtracting an increasing stream from a level one leaves a decreasing stream."],
        [(n + 1) * Q, -Q, n, 1, "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `$(Ia)$ already subtracts ${amt(Q)} at time 1, so the first payment is ${amt(n * Q)}.`],
        [(n - 1) * Q, -Q, n, 1, "SEQ_TERM_COUNT", 1, "application", `At time ${n} the payment is $${n + 1} - ${n} = 1$ unit of ${amt(Q)}, not zero.`],
        [n * Q, -Q, n, 0, "TIMING_IMMEDIATE_AS_DUE", 2, "interpretation", "Both symbols are annuities-immediate: payments at times 1 to $n$."],
      ];
    }
    return conceptQuestion({
      stem: `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following has present value $${Elatex}$ at time 0.`,
      correct: { content: `${arithText(cor[0], cor[1], n, 1)}.`, why: level === 2 && variant === 1 ? `$(n+1)a - (Ia)$ pays $${n + 1} - t$ units at time $t$: ${n}, ${n - 1}, …, 1 — that is $(Da)_{\\overline{${n}}|}$.` : `The symbol pays the stated amounts at the end of years 1 to ${n}.`, check: { expr: E, op: "=", than: arithPV(cor[0], cor[1], n, 1, i) } },
      distractors: rows.map(([first, step, count, t0, mis, stage, failure, why]) =>
        wrong(`${step === 0 ? `Payments of ${amt(first)} at times $${t0}, ${t0 + 1}, \\ldots, ${t0 + count - 1}$` : arithText(first, step, count, t0)}.`, mis, stage, failure, why, { check: { expr: E, op: "=", than: arithPV(first, step, count, t0, i) } })
      ),
      reference: { description: "Each described pattern is valued term by term at time 0 and compared with the expression; only the correct pattern agrees." },
      steps: [
        { concept: "ann.arithmetic", reasoning: "$(Ia)_{\\overline{n}|}$ pays $1, 2, \\ldots, n$ and $(Da)_{\\overline{n}|}$ pays $n, n-1, \\ldots, 1$, at times $1, \\ldots, n$." },
        { concept: "ann.annuity-value-date", reasoning: "Both are annuities-immediate, valued at time 0, one year before the first payment." },
        ...(level === 2 ? [{ concept: "ann.stream-decomposition", reasoning: "Add the payments of each piece year by year: check the first and last payments." }] : []),
      ],
      conditions: ["Payments at the end of each year; constant annual effective rate."],
      relationship: "$(Ia)_{\\overline{n}|} + (Da)_{\\overline{n}|} = (n+1)\\,a_{\\overline{n}|}$",
      counterexample: "For $n = 1$ both symbols reduce to $a_{\\overline{1}|} = v$.",
      transfer: { principle: "Translate each symbol into its first and last payments, then add the pieces year by year.", unusual: "You go from expression to payments.", misread: "$(Ia)$ and $(Da)$ are easily swapped." },
      itemFormat: "interpretation",
      presentation: level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { n, i, Q, P, variant },
    });
  },
});

const arithDecompose: ChoiceTemplate = conceptTemplate({
  id: "con-ann-arith-decompose",
  family: "con-ann-arithmetic",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.perpetuities"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "relationships"],
  reasoning: ["formula_selection", "cashflow_modelling", "formula_reconstruction"],
  soaConcept: "Writing an arithmetic stream as level and increasing (or decreasing) annuity pieces.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const Q = gridAmount(rng, 20, 200, 10);
    const n = rng.int(6, 20);
    const Qm = mamt(Q);
    const I = lit(i);
    const v1 = vPow(i, 1);
    let stem: string;
    let truth: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps: { concept: string; reasoning: string }[];
    const lin = (A: number, sym1: string, e1: string, B: number, sym2: string, e2: string, sign = "+") => ({ latex: `${mamt(A)}\\,${sym1} ${sign} ${mamt(B)}\\,${sym2}`, probe: `(${lit(A)}*${e1} ${sign} ${lit(B)}*${e2})` });
    if (level === 1 && variant === 0) {
      const P = Q * rng.int(2, 10);
      truth = arithPV(P, Q, n, 1, i);
      stem = `Payments are made at the end of each year for ${n} years. The first payment is ${amt(P)}, and each later payment is ${amt(Q)} more than the one before. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const c = lin(P - Q, aSym(n), aExpr(n, i), Q, IaSym(n), IaE(n, i));
      correct = { content: math(c.latex), probe: c.probe, why: `$(Ia)$ pays ${amt(Q)} at time 1, so the level part is ${amt(P - Q)}: $${amt(P - Q)} + ${amt(Q)}t$ at time $t$.` };
      const b = lin(P, aSym(n), aExpr(n, i), Q, IaSym(n), IaE(n, i));
      const dd = lin(P - Q, aSym(n), aExpr(n, i), Q, DaSym(n), DaE(n, i));
      const du = lin(P - Q, adueSym(n), adueExpr(n, i), Q, `(I\\ddot{a})_{\\overline{${n}|}}`, `(${IaE(n, i)}*${onePlusE(i)})`);
      const sg = lin(P + Q, aSym(n), aExpr(n, i), Q, IaSym(n), IaE(n, i));
      distractors = [
        wrong(math(b.latex), "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `That pays ${amt(P + Q)} at time 1: $(Ia)$ already contributes ${amt(Q)} to the first payment.`, { probe: b.probe }),
        wrong(math(dd.latex), "FORMULA_DECREASING_FOR_INCREASING", 0, "selection", "$(Da)$ decreases over time; these payments increase.", { probe: dd.probe }),
        wrong(math(du.latex), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Due symbols place the first payment at time 0; the payments are at year-end.", { probe: du.probe, confusedWith: "ann.immediate-vs-due" }),
        wrong(math(`${mamt(P + ((n - 1) * Q) / 2)}\\,${aSym(n)}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "Level payments at the average amount ignore that the larger payments come later and are discounted more.", { probe: `(${lit(P + ((n - 1) * Q) / 2)}*${aExpr(n, i)})` }),
        wrong(math(sg.latex), "ALG_SIGN_ERROR", 1, "application", `The level part is ${amt(P)} less ${amt(Q)}, not plus.`, { probe: sg.probe }),
      ];
      steps = [
        { concept: "ann.arithmetic", reasoning: "$(Ia)_{\\overline{n}|}$ pays $1, 2, \\ldots, n$ at times $1, \\ldots, n$." },
        { concept: "ann.stream-decomposition", reasoning: `Payment at time $t$ is $${amt(P)} + ${amt(Q)}(t-1) = ${amt(P - Q)} + ${amt(Q)}t$: a level ${amt(P - Q)} plus ${amt(Q)} times $(Ia)$.` },
        { concept: "ann.annuity-value-date", reasoning: "Check the first payment of the decomposition at time 1." },
      ];
    } else if (level === 1) {
      const P = Q * rng.int(n + 1, n + 8);
      truth = arithPV(P, -Q, n, 1, i);
      stem = `Payments are made at the end of each year for ${n} years. The first payment is ${amt(P)}, and each later payment is ${amt(Q)} less than the one before. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const c = lin(P - n * Q, aSym(n), aExpr(n, i), Q, DaSym(n), DaE(n, i));
      correct = { content: math(c.latex), probe: c.probe, why: `$(Da)$ pays ${n} units at time 1, so the level part is $${amt(P)} - ${n}(${amt(Q)}) = ${amt(P - n * Q)}$.` };
      const b = lin(P - (n - 1) * Q, aSym(n), aExpr(n, i), Q, DaSym(n), DaE(n, i));
      const di = lin(P - n * Q, aSym(n), aExpr(n, i), Q, IaSym(n), IaE(n, i));
      const du = lin(P - n * Q, adueSym(n), adueExpr(n, i), Q, `(D\\ddot{a})_{\\overline{${n}|}}`, `(${DaE(n, i)}*${onePlusE(i)})`);
      const sg = lin(P + n * Q, aSym(n), aExpr(n, i), Q, DaSym(n), DaE(n, i), "-");
      distractors = [
        wrong(math(b.latex), "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `That uses the last payment as the level part; the first payment becomes ${amt(P + Q)}.`, { probe: b.probe }),
        wrong(math(di.latex), "FORMULA_DECREASING_FOR_INCREASING", 0, "selection", "$(Ia)$ increases over time; these payments decrease.", { probe: di.probe }),
        wrong(math(du.latex), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Due symbols place the first payment at time 0; the payments are at year-end.", { probe: du.probe, confusedWith: "ann.immediate-vs-due" }),
        wrong(math(`${mamt(P - ((n - 1) * Q) / 2)}\\,${aSym(n)}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "Level payments at the average amount ignore that the larger payments come first.", { probe: `(${lit(P - ((n - 1) * Q) / 2)}*${aExpr(n, i)})` }),
        wrong(math(sg.latex), "ALG_SIGN_ERROR", 1, "application", "Subtracting $(Da)$ from a level stream gives increasing payments.", { probe: sg.probe }),
      ];
      steps = [
        { concept: "ann.arithmetic", reasoning: "$(Da)_{\\overline{n}|}$ pays $n, n-1, \\ldots, 1$ at times $1, \\ldots, n$." },
        { concept: "ann.stream-decomposition", reasoning: `Payment at time $t$ is $${amt(P - n * Q)} + ${amt(Q)}(${n} - t + 1)$.` },
        { concept: "ann.annuity-value-date", reasoning: "Check the first and last payments of the decomposition." },
      ];
    } else if (level === 2 && variant === 0) {
      const P = gridAmount(rng, 200, 2000, 100);
      const v = `(${v1})`;
      truth = `(${lit(P)}*${v}/(1-${v}) + ${lit(Q)}*${v}**2/(1-${v})**2)`;
      stem = `Payments are made at the end of each year forever. The first payment is ${amt(P)}, and each later payment is ${amt(Q)} more than the one before. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const frac = (A: string, B: string, sign = "+") => `\\dfrac{${A}}{${I}} ${sign} \\dfrac{${B}}{${I}^{2}}`;
      correct = { content: math(frac(mamt(P), Qm)), probe: `(${lit(P)}/${I}+${lit(Q)}/${I}**2)`, why: `A level perpetuity of ${amt(P)} plus increases of ${amt(Q)} starting at time 2, each a perpetuity: $\\sum_{s\\ge 2} ${Qm}\\,v^{s-1}/i = ${Qm}/i^2$.` };
      distractors = [
        wrong(math(frac(mamt(P), `${Qm}(${fac(i)})`)), "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `That is $${mamt(P)}/i + ${Qm}(Ia)_{\\overline{\\infty}|}$, whose first payment is ${amt(P + Q)}.`, { probe: `(${lit(P)}/${I}+${lit(Q)}*${onePlusE(i)}/${I}**2)` }),
        wrong(math(`\\dfrac{${mamt(P)}}{${I}} + \\dfrac{${Qm}}{${I}}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "The increases accumulate year after year; $Q/i$ adds only one level layer.", { probe: `(${lit(P)}/${I}+${lit(Q)}/${I})` }),
        wrong(math(frac(`${mamt(P)}(${fac(i)})`, `${Qm}(${fac(i)})`)), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "That values payments starting today.", { probe: `((${lit(P)}/${I}+${lit(Q)}/${I}**2)*${onePlusE(i)})`, confusedWith: "ann.immediate-vs-due" }),
        wrong(math(frac(mamt(P), Qm, "-")), "ALG_SIGN_ERROR", 1, "application", "That values payments decreasing by $Q$ each year.", { probe: `(${lit(P)}/${I}-${lit(Q)}/${I}**2)` }),
        wrong(math(`\\dfrac{${mamt(P)}}{${I}^{2}} + \\dfrac{${Qm}}{${I}}`), "ALLOC_SWAPPED", 1, "connection", "The level amount takes $1/i$ and the increase $1/i^2$, not the reverse.", { probe: `(${lit(P)}/${I}**2+${lit(Q)}/${I})` }),
      ];
      steps = [
        { concept: "ann.arithmetic-perpetuity", reasoning: "Layer the stream: a level perpetuity of $P$, plus a perpetuity of $Q$ from time 2, plus one from time 3, …" },
        { concept: "ann.perpetuity", reasoning: "A layer starting at time $s$ is worth $Qv^{s-1}/i$; the layers sum to $Q/i^2$." },
        { concept: "ann.stream-decomposition", reasoning: "Check the first payment: $P$ at time 1." },
      ];
    } else if (level === 2) {
      const X = n * Q;
      truth = arithPV(X, -Q, n, 1, i);
      stem = `A sequence of payments is made at the end of each year. The first payment is ${amt(X)}; each later payment is ${amt(Q)} less than the one before, and the last payment is ${amt(Q)}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${Qm}\\,${DaSym(n)}`), probe: `(${lit(Q)}*${DaE(n, i)})`, why: `There are ${amt(X)}/${amt(Q)} = ${n} payments: ${n}, ${n - 1}, …, 1 units of ${amt(Q)}.` };
      distractors = [
        wrong(math(`${Qm}\\,${DaSym(n + 1)}`), "SEQ_TERM_COUNT", 0, "interpretation", `From ${n} units down to 1 is ${n} payments, not ${n + 1}.`, { probe: `(${lit(Q)}*${DaE(n + 1, i)})` }),
        wrong(math(`${Qm}\\,${IaSym(n)}`), "FORMULA_DECREASING_FOR_INCREASING", 1, "selection", "$(Ia)$ pays the smallest amount first.", { probe: `(${lit(Q)}*${IaE(n, i)})` }),
        wrong(math(`${Qm}\\,(D\\ddot{a})_{\\overline{${n}|}}`), "TIMING_IMMEDIATE_AS_DUE", 1, "application", "The payments are at the end of each year.", { probe: `(${lit(Q)}*${DaE(n, i)}*${onePlusE(i)})`, confusedWith: "ann.immediate-vs-due" }),
        wrong(math(`${mamt(X)}\\,${aSym(n)} - ${Qm}\\,${IaSym(n)}`), "CONC_ANN_ARITH_BASE_SPLIT", 2, "application", `$(Ia)$ subtracts ${amt(Q)} already at time 1, so the first payment would be ${amt(X - Q)} and the last zero.`, { probe: `(${lit(X)}*${aExpr(n, i)}-${lit(Q)}*${IaE(n, i)})` }),
        wrong(math(`${mamt((X + Q) / 2)}\\,${aSym(n)}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "Level payments at the average amount ignore that the larger payments come first.", { probe: `(${lit((X + Q) / 2)}*${aExpr(n, i)})` }),
      ];
      steps = [
        { concept: "ann.arithmetic", reasoning: `Payments fall by ${amt(Q)} from ${amt(X)} to ${amt(Q)}: in units of ${amt(Q)}, $${n}, ${n - 1}, \\ldots, 1$.` },
        { concept: "ann.stream-decomposition", reasoning: `That is exactly $(Da)_{\\overline{${n}}|}$ scaled by ${amt(Q)}; the count ${n} must be inferred.` },
        { concept: "ann.annuity-value-date", reasoning: "Year-end payments: an annuity-immediate symbol." },
      ];
    } else {
      const P = gridAmount(rng, 200, 2000, 100);
      const top = P + (n - 1) * Q;
      truth = `(${arithPV(P, Q, n, 1, i)} + ${perpFrom(top, n + 1, i)})`;
      const parts = (lev: string, Asym: string, den = I) => `\\dfrac{${lev}}{${I}} + \\dfrac{${Qm}\\,${Asym}}{${den}}`;
      const partsE = (lev: number, Ae: string, den = I) => `(${lit(lev)}/${I}+${lit(Q)}*${Ae}/${den})`;
      if (variant === 0) {
        stem = `Payments are made at the end of each year forever. The first payment is ${amt(P)}; each subsequent payment is ${amt(Q)} more than the one before until the payment at the end of year ${n}, after which payments remain level. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
        correct = { content: math(parts(mamt(P), aSym(n - 1))), probe: partsE(P, aExpr(n - 1, i)), why: `A level perpetuity of ${amt(P)} plus ${n - 1} increases of ${amt(Q)}, beginning at times 2 to ${n}; the one beginning at time $s$ is worth $${Qm}v^{s-1}/i$, and $\\sum_{s=2}^{${n}} v^{s-1} = ${aSym(n - 1)}$.` };
        distractors = [
          wrong(math(parts(mamt(P), aSym(n))), "SEQ_TERM_COUNT", 1, "application", `Only ${n - 1} increases occur (at times 2 to ${n}), not ${n}.`, { probe: partsE(P, aExpr(n, i)) }),
          wrong(math(`\\dfrac{${mamt(P)}}{${I}} + \\dfrac{${Qm}}{${I}^{2}}`), "TRANS_IGNORED_CONDITION", 0, "interpretation", `That lets the payments increase forever; they stop increasing after year ${n}.`, { probe: `(${lit(P)}/${I}+${lit(Q)}/${I}**2)` }),
          wrong(math(parts(mamt(P), adueSym(n - 1))), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "The first increase starts at time 2, so its layer is discounted one year: $v^{s-1}$ sums to $a$, not $\\ddot{a}$.", { probe: partsE(P, adueExpr(n - 1, i)) }),
          wrong(math(`\\dfrac{${mamt(top)}}{${I}}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "That pays the final level amount from the start.", { probe: `(${lit(top)}/${I})` }),
          wrong(math(parts(mamt(P), aSym(n - 1), "d")), "RATE_DISCOUNT_AS_INTEREST", 2, "connection", "Each increase layer is a perpetuity-immediate, worth $Q/i$ one year before it starts.", { probe: partsE(P, aExpr(n - 1, i), lit(i / (1 + i))) }),
        ];
      } else {
        stem = `The first payment of a perpetuity, at the end of year 1, is ${amt(P)}. Payments then increase by ${amt(Q)} each year until they reach ${amt(top)}, and remain at ${amt(top)} thereafter. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
        correct = { content: math(parts(mamt(P - Q), adueSym(n))), probe: partsE(P - Q, adueExpr(n, i)), why: `${amt(P - Q)} forever, plus ${amt(Q)} times the stream $1, 2, \\ldots, ${n}, ${n}, \\ldots$, whose value is $${adueSym(n)}/i$ (layers of 1 starting at times 1 to ${n}).` };
        distractors = [
          wrong(math(parts(mamt(P - Q), aSym(n))), "TIMING_DUE_AS_IMMEDIATE", 2, "application", "The first layer starts at time 1 and is worth $1/i$ undiscounted: the layers sum to $\\ddot{a}/i$.", { probe: partsE(P - Q, aExpr(n, i)), confusedWith: "ann.immediate-vs-due" }),
          wrong(math(parts(mamt(P), adueSym(n))), "CONC_ANN_ARITH_BASE_SPLIT", 1, "application", `The increasing part already contributes ${amt(Q)} at time 1; the level part is ${amt(P - Q)}.`, { probe: partsE(P, adueExpr(n, i)) }),
          wrong(math(`\\dfrac{${mamt(P - Q)}}{${I}} + \\dfrac{${Qm}(${fac(i)})}{${I}^{2}}`), "TRANS_IGNORED_CONDITION", 0, "interpretation", `That lets the increases continue forever; they stop at ${amt(top)}.`, { probe: `(${lit(P - Q)}/${I}+${lit(Q)}*${onePlusE(i)}/${I}**2)` }),
          wrong(math(`\\dfrac{${mamt(top)}}{${I}}`), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "That pays the final level amount from the start.", { probe: `(${lit(top)}/${I})` }),
          wrong(math(parts(mamt(P - Q), adueSym(n + 1))), "SEQ_TERM_COUNT", 1, "interpretation", `From ${amt(P)} to ${amt(top)} takes ${n} payments; there are ${n} layers, not ${n + 1}.`, { probe: partsE(P - Q, adueExpr(n + 1, i)) }),
        ];
      }
      steps = [
        { concept: "ann.arithmetic-perpetuity", reasoning: "Layer the stream into level perpetuities, one per increase." },
        { concept: "ann.stream-decomposition", reasoning: `The increases stop after year ${n}: there are finitely many layers.` },
        { concept: "ann.perpetuity", reasoning: "A layer of 1 starting at time $s$ is worth $v^{s-1}/i$." },
        { concept: "ann.annuity-identities", reasoning: `Summing $v^{s-1}$ over the layers gives an annuity factor: $${adueSym(n)} = 1 + ${aSym(n - 1)}$.` },
      ];
    }
    const hard = level === 3;
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "PV", expr: truth }], description: "Each payment discounted term by term (any perpetual tail summed as a geometric series); each option is evaluated and only the correct one agrees." },
      steps,
      conditions: ["Year-end payments at a constant annual effective rate.", ...(hard ? ["The increases stop after a finite number of years."] : [])],
      relationship: hard ? "Level forever plus layered increases: $\\dfrac{P}{i} + \\dfrac{Q\\,a_{\\overline{n-1}|}}{i} = \\dfrac{P - Q}{i} + \\dfrac{Q\\,\\ddot{a}_{\\overline{n}|}}{i}$" : "$P, P+Q, \\ldots = (P-Q)\\,a_{\\overline{n}|} + Q\\,(Ia)_{\\overline{n}|}$; forever: $P/i + Q/i^2$",
      counterexample: "With $Q = 0$ every form collapses to a level annuity; differences appear only through the increases.",
      transfer: {
        principle: "Check any decomposition by its first payment and, for a finite stream, its last.",
        unusual: hard ? "Increases stop, so neither a finite nor a perpetual standard symbol fits alone." : "The options differ only in how the stream is split.",
        misread: "$P\\,a + Q\\,(Ia)$ starts at $P + Q$, not $P$.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["hidden-structure", "indirect-wording"] : level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level >= 2 },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { i, Q, n, variant },
    });
  },
});

const arithStatements: ChoiceTemplate = conceptTemplate({
  id: "con-ann-arith-statements",
  family: "con-ann-arithmetic",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.perpetuities"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "terminology"],
  reasoning: ["concept_recognition", "validation", "financial_intuition"],
  soaConcept: "Identities and comparisons for increasing and decreasing annuities, judged as statements.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(5, 15);
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const d = i / (1 + i);
    const Ia = IaE(n, i);
    const Da = DaE(n, i);
    const common = {
      conditions: ["Year-end payments at a constant annual effective rate $i > 0$."],
      relationship: "$(Ia)_{\\overline{n}|} = \\dfrac{\\ddot{a}_{\\overline{n}|} - nv^n}{i}, \\quad (Da)_{\\overline{n}|} = \\dfrac{n - a_{\\overline{n}|}}{i}, \\quad (Ia)_{\\overline{\\infty}|} = \\dfrac{1}{id}$",
      transfer: {
        principle: "Picture each varying annuity as a stack of level layers; identities follow from adding the layers.",
        unusual: "Several identities and comparisons are judged together.",
        misread: "$i$ and $d$ appear in similar places in these formulas.",
      },
    };
    const baseSteps = [
      { concept: "ann.arithmetic", reasoning: "$(Ia)$ pays $1, \\ldots, n$; $(Da)$ pays $n, \\ldots, 1$; together they pay $n + 1$ every year." },
      { concept: "ann.stream-decomposition", reasoning: "$(Da)_{\\overline{n}|}$ is the sum of layers $a_{\\overline{n}|}, a_{\\overline{n-1}|}, \\ldots, a_{\\overline{1}|}$." },
    ];
    if (level === 2 && variant === 0) {
      return statementQuestion({
        stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$${IaSym(n)} + ${DaSym(n)} = ${n + 1}\\,${aSym(n)}$`, true, `Together the two streams pay ${n + 1} every year for ${n} years.`, "SEQ_TERM_COUNT", { check: { expr: `${Ia}+${Da}`, op: "=", than: `${n + 1}*${aExpr(n, i)}` }, stage: 0, failure: "recognition", conditionTrue: "It fails for any multiplier other than $n + 1$." }),
          statement("II", `$${DaSym(n)} = \\dfrac{${n} - ${aSym(n)}}{d}$`, false, "The denominator is $i$; $d$ goes with $\\ddot{a}$ in the numerator.", "RATE_DISCOUNT_AS_INTEREST", { check: { expr: Da, op: "=", than: `(${n}-${aExpr(n, i)})/${lit(d)}` }, stage: 1, failure: "application", conditionTrue: "It would be true of $(D\\ddot{a})_{\\overline{n}|}$." }),
          statement("III", `$${IaSym(n)} > ${DaSym(n)}$`, false, "The decreasing stream pays its larger amounts first, so it is worth more at any positive rate.", "CONC_DIRECTION_REVERSED", { check: { expr: Ia, op: ">", than: Da }, stage: 1, failure: "conclusion", conditionTrue: "They are equal at $i = 0$; the inequality never holds for $i > 0$." }),
        ],
        extra: [
          { keys: ["III"], misconception: "FORMULA_DECREASING_FOR_INCREASING", why: "Swapping the increasing and decreasing symbols reverses III and loses I.", stage: 0, failure: "recognition" },
          { keys: ["II", "III"], misconception: "TIMING_DUE_AS_IMMEDIATE", why: "Only I holds; II mixes the due and immediate formulas.", stage: 1, failure: "selection" },
        ],
        steps: [...baseSteps, { concept: "ann.annuity-value-date", reasoning: "Earlier money is worth more: compare where each stream's large payments fall." }],
        ...common,
        presentation: ["direct"],
        features: { steps: 3 },
        params: { n, i, variant, level },
      });
    }
    if (level === 2) {
      const IsExplicit = avTerms(Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: k + 1 })), i, n);
      const DaExplicit = pvTerms(Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: n - k })), i);
      return statementQuestion({
        stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$${IaSym(n)} = \\dfrac{${adueSym(n)} - ${n}v^{${n}}}{i}$`, true, "The standard closed form: layers of 1 starting at times $1, \\ldots, n$ and ending at time $n$.", "TIMING_DUE_AS_IMMEDIATE", { check: { expr: pvTerms(Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: k + 1 })), i), op: "=", than: `(${adueExpr(n, i)}-${n}*${vPow(i, n)})/${lit(i)}` }, stage: 0, failure: "recognition", conditionTrue: "With $a$ in place of $\\ddot{a}$ it would be false." }),
          statement("II", `$(Is)_{\\overline{${n}}|} = ${IaSym(n)}\\,(1+i)^{${n + 1}}$`, false, `$(Is)$ values the same payments at time ${n}: the factor is $(1+i)^{${n}}$.`, "TIMING_EXTRA_PERIOD", { check: { expr: IsExplicit, op: "=", than: `${Ia}*${accPow(i, n + 1)}` }, stage: 1, failure: "application", conditionTrue: `True of $(I\\ddot{s})_{\\overline{${n}}|}$.` }),
          statement("III", `$${DaSym(n)} = ${n}\\,${aSym(n)} - v\\,${IaSym(n - 1)}$`, true, `Pay ${n} every year, then remove $0, 1, \\ldots, ${n - 1}$ at times $1, \\ldots, ${n}$ — that removal is $v\\,${IaSym(n - 1)}$.`, "CONC_ANN_ARITH_BASE_SPLIT", { check: { expr: DaExplicit, op: "=", than: `${n}*${aExpr(n, i)}-${vPow(i, 1)}*${IaE(n - 1, i)}` }, stage: 1, failure: "connection" }),
        ],
        extra: [
          { keys: ["II"], misconception: "FORMULA_DECREASING_FOR_INCREASING", why: "Misplacing which symbol increases rejects I and III.", stage: 0, failure: "selection" },
          { keys: [], misconception: "CONC_RELATED_TERM", why: "I and III are exact identities.", stage: 1, failure: "conclusion" },
        ],
        steps: [...baseSteps, { concept: "ann.annuity-value-date", reasoning: "$(Is)$ is $(Ia)$ moved $n$ years forward." }],
        ...common,
        presentation: ["direct"],
        features: { steps: 3 },
        params: { n, i, variant, level },
      });
    }
    if (variant === 0) {
      const v = vPow(i, 1);
      const IaInf = `(${v}/(1-${v})**2)`;
      const K = Math.ceil(1 / d) + 1;
      return statementQuestion({
        stem: `Perpetuity A pays 1, 2, 3, … at the end of years 1, 2, 3, …. Perpetuity B pays ${K} at the end of each year. The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `The present value of A is ${num(1 / (i * d), 2)}.`, true, `$(Ia)_{\\overline{\\infty}|} = 1/i + 1/i^2 = 1/(id)$.`, "CONC_ANN_IA_PERP_ISQ", { check: { expr: IaInf, op: "=", than: lit(Number((1 / (i * d)).toFixed(2))), tol: 1e-4 }, stage: 0, failure: "selection", conditionTrue: `$1/i^2 = ${mnum(1 / (i * i), 2)}$ would omit the level layer $1/i$.` }),
          statement("II", "A is worth more than B.", false, `B is worth $${K}/i$ and A is worth $(1/d)/i$; since $${K} > 1/d = ${mnum(1 / d, 2)}$, B is worth more.`, "SEQ_UNDISCOUNTED_SUM", { check: { expr: IaInf, op: ">", than: `${K}/${lit(i)}` }, stage: 2, failure: "conclusion", conditionTrue: `True if B paid less than $1/d = ${mnum(1 / d, 2)}$ a year.` }),
          statement("III", `The payments of A after year ${n} are worth $v^{${n}}\\left(\\dfrac{${n}}{i} + \\dfrac{1}{id}\\right)$ at time 0.`, true, `From time ${n} on, A pays ${n} plus $1, 2, \\ldots$: a level perpetuity of ${n} plus another $(Ia)_{\\overline{\\infty}|}$, deferred ${n} years.`, "CONC_ANN_ARITH_BASE_SPLIT", { check: { expr: `${IaInf}-${Ia}`, op: "=", than: `${vPow(i, n)}*(${n}/${lit(i)}+1/(${lit(i)}*${lit(d)}))` }, stage: 1, failure: "connection" }),
        ],
        extra: [
          { keys: ["II"], misconception: "CONC_ANN_PERP_INFINITE", why: "Treating an ever-increasing perpetuity as unbounded rejects I and III and makes A worth more than any level stream.", stage: 0, failure: "recognition" },
          { keys: ["I", "II"], misconception: "TIMING_VALUATION_DATE", why: "III values the tail at time 0 correctly; comparing undiscounted tails does not.", stage: 2, failure: "application" },
        ],
        steps: [
          { concept: "ann.arithmetic-perpetuity", reasoning: "$(Ia)_{\\overline{\\infty}|}$ = layers of level perpetuities starting at times $1, 2, \\ldots$: $\\sum v^{s-1}/i = 1/(id)$." },
          { concept: "ann.perpetuity", reasoning: "B is a level perpetuity: $K/i$." },
          { concept: "ann.deferred-annuity", reasoning: `After year ${n}, A's payments are $${n} + 1, ${n} + 2, \\ldots$, valued at time ${n} and discounted.` },
          { concept: "ann.arithmetic", reasoning: "Compare $1/(id)$ with $K/i$: the comparison reduces to $1/d$ versus $K$." },
        ],
        ...common,
        presentation: ["compare-streams", "hidden-structure"],
        features: { steps: 4, unfamiliar: true },
        modelingDecisions: 1,
        params: { n, i, K, variant, level },
      });
    }
    const i2 = i + 0.01;
    const sumA = `(${range(1, n).map((k) => aExpr(k, i)).join("+")})`;
    const sumS = `(${range(1, n).map((k) => sExpr(k, i)).join("+")})`;
    return statementQuestion({
      stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
      statements: [
        statement("I", `$${DaSym(n)} = \\sum_{k=1}^{${n}} a_{\\overline{k}|}$`, true, `The layers of $(Da)$ are level annuities of 1 lasting ${n}, ${n - 1}, …, 1 years.`, "FORMULA_DECREASING_FOR_INCREASING", { check: { expr: Da, op: "=", than: sumA }, stage: 0, failure: "connection", conditionTrue: "Read as layers that each start at time 1, the sum is decreasing, not increasing." }),
        statement("II", `$${IaSym(n)} = \\sum_{k=1}^{${n}} s_{\\overline{k}|}$`, false, "Each $s_{\\overline{k}|}$ is a value at a different date; adding them is not a present value.", "TIMING_VALUATION_DATE", { check: { expr: Ia, op: "=", than: sumS }, stage: 1, failure: "application", conditionTrue: `With each layer discounted to time 0, $\\sum_k v^{k-1}a_{\\overline{${n}-k+1}|}$, it would be true.` }),
        statement("III", `If the interest rate rises to ${pc(i2)}, $${DaSym(n)}$ falls by a smaller percentage than $${IaSym(n)}$.`, true, "The decreasing stream receives its money earlier, so its value is less sensitive to the rate.", "CONC_DIRECTION_REVERSED", { check: { expr: `${DaE(n, i2)}/${Da}`, op: ">", than: `${IaE(n, i2)}/${Ia}` }, stage: 2, failure: "conclusion" }),
      ],
      extra: [
        { keys: ["II"], misconception: "FORMULA_AV_FOR_PV", why: "Treating accumulated factors as interchangeable with present ones accepts II and rejects I.", stage: 1, failure: "selection" },
        { keys: ["I", "II"], misconception: "CONC_RELATED_TERM", why: "II looks like the companion of I, but the layers of $(Ia)$ start at different dates.", stage: 1, failure: "interpretation" },
      ],
      steps: [
        ...baseSteps,
        { concept: "ann.deferred-annuity", reasoning: "The layers of $(Ia)$ start at times $1, 2, \\ldots$, so each must be deferred before adding." },
        { concept: "ann.annuity-value-date", reasoning: "Values can be added only at one date; earlier cash flows are less sensitive to the rate." },
      ],
      ...common,
      presentation: ["hidden-structure", "compare-streams"],
      features: { steps: 4, unfamiliar: true },
      modelingDecisions: 1,
      params: { n, i, variant, level },
    });
  },
});

// ================================================================ geometric

/** Present value of `count` payments first, first·ratio, … at times t0, t0+1, …, written term by term. */
const geoPV = (first: number, ratio: number, count: number, t0: number, i: number): string =>
  pvTerms(Array.from({ length: count }, (_, k) => ({ t: t0 + k, amount: first * Math.pow(ratio, k) })), i);
const geoAV = (first: number, ratio: number, count: number, t0: number, i: number, at: number): string =>
  avTerms(Array.from({ length: count }, (_, k) => ({ t: t0 + k, amount: first * Math.pow(ratio, k) })), i, at);
/** [1 − ((1+g)/(1+i))^n]/(i − g) as markup and as an expression. */
const geoLatex = (n: number, i: number, g: number): string =>
  `\\dfrac{1 - \\left(\\frac{${lit(1 + g)}}{${fac(i)}}\\right)^{${n}}}{${lit(i)} - ${lit(g)}}`;
const geoE = (n: number, i: number, g: number): string => `((1-(${lit(1 + g)}/${fac(i)})**${n})/(${lit(i)}-${lit(g)}))`;
const geoInvE = (n: number, i: number, g: number): string => `((1-(${fac(i)}/${lit(1 + g)})**${n})/(${lit(g)}-${lit(i)}))`;
const geoInvLatex = (n: number, i: number, g: number): string =>
  `\\dfrac{1 - \\left(\\frac{${fac(i)}}{${lit(1 + g)}}\\right)^{${n}}}{${lit(g)} - ${lit(i)}}`;

const geomApplicability: ChoiceTemplate = conceptTemplate({
  id: "con-ann-geom-applicability",
  family: "con-ann-geometric",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.perpetuities"],
  itemFormat: "applicability",
  conceptFamily: "applicability",
  dimensions: ["applicability", "conditions"],
  reasoning: ["formula_selection", "concept_recognition", "financial_intuition"],
  soaConcept: "When the geometric annuity and growing perpetuity formulas apply, including g = i and g > i.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 500, 5000, 100);
    const Pm = mamt(P);
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 25);
    const I = lit(i);
    const pv = (latex: string, value: number) => `The present value is $${latex} = ${mnum(value, 2)}$.`;
    const chk = (expr: string, truth: string) => ({ check: { expr, op: "=" as const, than: truth } });
    let g: number;
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps: { concept: string; reasoning: string }[];
    const growth = (gg: number) => `each later payment is ${pc(gg)} larger than the one before`;
    if (variant === 0 && level === 1) {
      g = i - gridRate(rng, 0.01, 0.03, 0.005);
      const truth = `(${lit(P)}*${vPow(i, 1)}/(1-${lit(1 + g)}*${vPow(i, 1)}))`;
      stem = `A perpetuity pays ${amt(P)} at the end of year 1, and ${growth(g)}. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      const den = `${I} - ${lit(g)}`;
      correct = { content: pv(`\\dfrac{${Pm}}{${den}}`, P / (i - g)), why: `Since $g < i$, the discounted payments shrink by the factor $(1+g)/(1+i)$ and sum to $P/(i-g)$.`, ...chk(`${lit(P)}/(${I}-${lit(g)})`, truth) };
      distractors = [
        wrong(pv(`\\dfrac{${Pm}(${lit(1 + g)})}{${den}}`, (P * (1 + g)) / (i - g)), "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "application", `The first payment is ${amt(P)}, not ${amt(P * (1 + g))}.`, chk(`${lit(P * (1 + g))}/(${I}-${lit(g)})`, truth)),
        wrong("The present value is not finite, because the payments grow without limit.", "CONC_ANN_PERP_INFINITE", 0, "recognition", `Growth below the interest rate still leaves discounted payments that shrink geometrically.`, { conditionTrue: "It would be true if $g \\ge i$." }),
        wrong(pv(`\\dfrac{${Pm}}{${I}}`, P / i), "MODEL_LEVEL_FOR_VARYING", 0, "selection", "That values level payments; growth makes the stream worth more.", chk(`${lit(P)}/${I}`, truth)),
        wrong(pv(`\\dfrac{${Pm}}{${I} + ${lit(g)}}`, P / (i + g)), "ALG_SIGN_ERROR", 2, "application", "Growth offsets discounting, so it reduces the denominator.", chk(`${lit(P)}/(${I}+${lit(g)})`, truth)),
        wrong(pv(`\\dfrac{${Pm}(${fac(i)})}{${den}}`, (P * (1 + i)) / (i - g)), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "The first payment is at time 1, so no extra factor of $1 + i$.", chk(`${lit(P)}*${onePlusE(i)}/(${I}-${lit(g)})`, truth)),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: `Compare the rates: $g = ${mpc(g)} < i = ${mpc(i)}$, so a finite value exists.` },
        { concept: "ann.geometric", reasoning: "The discounted payments form a geometric series with ratio $(1+g)/(1+i) < 1$." },
        { concept: "ann.perpetuity", reasoning: "Its sum, starting from $Pv$, is $P/(i-g)$." },
      ];
    } else if (variant === 0 && level === 2) {
      g = i + gridRate(rng, 0.005, 0.02, 0.005);
      stem = `A perpetuity pays ${amt(P)} at the end of year 1, and ${growth(g)}. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      correct = { content: `The present value is not finite: each payment's present value is at least ${amt(P / (1 + i))}.`, why: `With $g > i$ the discounted payments $P(1+g)^{t-1}v^t$ grow, so their sum diverges.`, check: { expr: `${lit(P * (1 + g))}*${vPow(i, 2)}`, op: ">=", than: `${lit(P)}*${vPow(i, 1)}` } };
      distractors = [
        wrong(pv(`\\dfrac{${Pm}}{${lit(g)} - ${I}}`, P / (g - i)), "ALG_SIGN_ERROR", 2, "application", "Reversing the denominator to make it positive does not create a finite sum."),
        wrong(pv(`\\dfrac{${Pm}}{${I} - ${lit(g)}}`, P / (i - g)), "CONC_OUTSIDE_ASSUMPTIONS", 1, "application", "$P/(i-g)$ is derived assuming $g < i$; a negative value is the sign that it does not apply."),
        wrong(`The present value is finite, because every payment is discounted at ${pc(i)}.`, "CONC_ANN_GROWTH_AT_OR_ABOVE_RATE", 0, "recognition", "Discounting is outpaced by growth: the discounted payments do not shrink."),
        wrong(pv(`\\dfrac{${Pm}}{${I}}`, P / i), "MODEL_LEVEL_FOR_VARYING", 0, "selection", "That values level payments and ignores the growth."),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: `Compare the rates: $g = ${mpc(g)} > i = ${mpc(i)}$.` },
        { concept: "ann.geometric", reasoning: "The discounted payments form a geometric series with ratio $(1+g)/(1+i) > 1$." },
        { concept: "ann.perpetuity", reasoning: "An infinite geometric series with ratio at least 1 has no finite sum." },
      ];
    } else if (variant === 0) {
      g = i + gridRate(rng, 0.005, 0.02, 0.005);
      const truth = geoPV(P, 1 + g, n, 1, i);
      const VB = (P * (1 - Math.pow((1 + g) / (1 + i), n))) / (i - g);
      const VBinv = (P * (1 - Math.pow((1 + i) / (1 + g), n))) / (g - i);
      const VBlev = P * an(n, i - g);
      stem = `Stream A pays ${amt(P)} at the end of year 1, and ${growth(g)}, forever. Stream B consists of the first ${n} payments of Stream A only. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      const both = (b: number) => `B is worth ${num(b, 2)}; A has no finite present value.`;
      correct = { content: both(VB), why: `B has finitely many payments, so $P\\,${geoLatex(n, i, g)}$ applies even with $g > i$; A's discounted payments grow, so A diverges.`, check: { expr: `${lit(P)}*${geoE(n, i, g)}`, op: "=", than: truth } };
      distractors = [
        wrong("Neither stream has a finite present value, because the growth rate exceeds the interest rate.", "CONC_ANN_FINITE_GROWTH_REJECTED", 1, "application", "The condition $g < i$ matters only for infinitely many payments."),
        wrong(both(VBinv), "ALG_INVERTED_RATIO", 2, "application", "The ratio in the formula is $(1+g)/(1+i)$, not its reciprocal.", { check: { expr: `${lit(P)}*${geoInvE(n, i, g)}`, op: "=", than: truth } }),
        wrong(both((n * P) / (1 + i)), "CONC_OUTSIDE_ASSUMPTIONS", 2, "selection", "$nP/(1+i)$ holds only when $g = i$.", { check: { expr: `${n}*${lit(P)}/${onePlusE(i)}`, op: "=", than: truth } }),
        wrong(`B is worth ${num(VB, 2)}; A is worth ${num(P / (g - i), 2)}.`, "ALG_SIGN_ERROR", 1, "application", "A's value is not $P/(g-i)$: the series for A diverges."),
        wrong(both(VBlev), "SEQ_GROWTH_RATE_DIFFERENCE", 2, "selection", "Discounting a level annuity at $i - g$ is not equivalent to the geometric stream.", { check: { expr: `${lit(P)}*${aExpr(n, i - g)}`, op: "=", than: truth } }),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: `$g = ${mpc(g)} > i = ${mpc(i)}$: the discounted payments grow.` },
        { concept: "ann.perpetuity", reasoning: "Infinitely many growing discounted payments have no finite sum, so A has no value." },
        { concept: "ann.geometric", reasoning: "Finitely many payments always have a finite sum; the finite formula holds for any $g \\ne i$." },
        { concept: "ann.stream-decomposition", reasoning: `B: $P\\,[1 - ((1+g)/(1+i))^{${n}}]/(i-g)$, with numerator and denominator both negative.` },
      ];
    } else if (level === 1) {
      g = i - gridRate(rng, 0.01, 0.03, 0.005);
      const truth = geoPV(P, 1 + g, n, 1, i);
      stem = `A series of ${n} payments is made at the end of each year. The first payment is ${amt(P)}, and ${growth(g)}. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      correct = { content: pv(`${Pm}\\,${geoLatex(n, i, g)}`, P * ((1 - Math.pow((1 + g) / (1 + i), n)) / (i - g))), why: "The discounted payments form a finite geometric series with first term $Pv$ and ratio $(1+g)/(1+i)$.", ...chk(`${lit(P)}*${geoE(n, i, g)}`, truth) };
      distractors = [
        wrong(pv(`${Pm}(${lit(1 + g)})\\,${geoLatex(n, i, g)}`, P * (1 + g) * ((1 - Math.pow((1 + g) / (1 + i), n)) / (i - g))), "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "application", `The first payment is ${amt(P)}; the factor $1 + g$ applies from the second payment.`, chk(`${lit(P * (1 + g))}*${geoE(n, i, g)}`, truth)),
        wrong(pv(`\\dfrac{${Pm}}{${I} - ${lit(g)}}`, P / (i - g)), "FORMULA_PERPETUITY_FOR_FINITE", 0, "selection", `That is the perpetuity; the ${n}-payment stream is worth less.`, chk(`${lit(P)}/(${I}-${lit(g)})`, truth)),
        wrong(pv(`${Pm}\\,a_{\\overline{${n}}|\\,${lit(i - g)}}`, P * an(n, i - g)), "SEQ_GROWTH_RATE_DIFFERENCE", 1, "selection", "A level annuity at $i - g$ is only an approximation to the geometric stream.", chk(`${lit(P)}*${aExpr(n, i - g)}`, truth)),
        wrong(pv(`${Pm}\\,${geoInvLatex(n, i, g)}`, P * ((1 - Math.pow((1 + i) / (1 + g), n)) / (g - i))), "ALG_INVERTED_RATIO", 2, "application", "The ratio is $(1+g)/(1+i)$, not its reciprocal.", chk(`${lit(P)}*${geoInvE(n, i, g)}`, truth)),
        wrong(pv(`${Pm}\\,${aSym(n)}`, P * an(n, i)), "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "That values level payments and ignores the growth.", chk(`${lit(P)}*${aExpr(n, i)}`, truth)),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: `The stream is finite, so the formula applies whatever the sign of $i - g$; here $g < i$.` },
        { concept: "ann.geometric", reasoning: "First discounted payment $Pv$, ratio $(1+g)/(1+i)$, $n$ terms." },
        { concept: "ann.annuity-value-date", reasoning: "Payments at year-end: no extra factor of $1 + i$." },
      ];
    } else if (level === 2) {
      g = i;
      const truth = geoPV(P, 1 + g, n, 1, i);
      stem = `A series of ${n} payments is made at the end of each year. The first payment is ${amt(P)}, and ${growth(g)}. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      correct = { content: pv(`\\dfrac{${n}(${Pm})}{${fac(i)}}`, (n * P) / (1 + i)), why: `With $g = i$ every payment has present value $${Pm}/${fac(i)}$.`, ...chk(`${n}*${lit(P)}/${onePlusE(i)}`, truth) };
      distractors = [
        wrong("The present value cannot be determined, because $i - g = 0$.", "CONC_ANN_EQUAL_RATE_UNDEFINED", 0, "recognition", "Only the closed form breaks down; the payments still have a finite value."),
        wrong(pv(`${n}(${Pm})`, n * P), "SEQ_UNDISCOUNTED_SUM", 1, "application", "Growth offsets discounting from the second payment on, but the first payment is still discounted one year.", chk(`${n}*${lit(P)}`, truth)),
        wrong(pv(`${Pm}\\,${aSym(n)}`, P * an(n, i)), "MODEL_LEVEL_FOR_VARYING", 0, "selection", "That ignores the growth.", chk(`${lit(P)}*${aExpr(n, i)}`, truth)),
        wrong(pv(`\\dfrac{${n}(${Pm})}{(${fac(i)})^{${n}}}`, (n * P) / Math.pow(1 + i, n)), "TIMING_VALUATION_DATE", 2, "application", `Each payment's growth cancels all but one year of discount; discounting every payment ${n} years ignores the growth.`, chk(`${n}*${lit(P)}*${vPow(i, n)}`, truth)),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: "$g = i$: the closed form is $0/0$, so return to the payments." },
        { concept: "ann.geometric", reasoning: "$P(1+i)^{t-1}v^t = P/(1+i)$ for every $t$." },
        { concept: "ann.stream-decomposition", reasoning: `Add ${n} equal present values: $${n}P/(1+i)$.` },
      ];
    } else {
      g = i + gridRate(rng, 0.005, 0.02, 0.005);
      const k = rng.int(3, 8);
      const truth = geoPV(P, 1 + g, n, k, i);
      const df = (e: number) => `(${fac(i)})^{-${e}}`;
      const base = (1 - Math.pow((1 + g) / (1 + i), n)) / (i - g);
      stem = `A series of ${n} annual payments begins at the end of year ${k}. The first payment is ${amt(P)}, and ${growth(g)}. The annual effective interest rate is ${pc(i)}.\n\nWhich of the following is true?`;
      correct = { content: pv(`${Pm}\\,${df(k - 1)}\\,${geoLatex(n, i, g)}`, P * Math.pow(1 + i, -(k - 1)) * base), why: `The finite formula values the payments one year before the first, at time ${k - 1}, and holds for $g > i$; discount ${k - 1} years.`, ...chk(`${lit(P)}*${vPow(i, k - 1)}*${geoE(n, i, g)}`, truth) };
      distractors = [
        wrong("The present value is not finite, because the growth rate exceeds the interest rate.", "CONC_ANN_FINITE_GROWTH_REJECTED", 0, "recognition", "That condition concerns perpetuities; finitely many payments always have a finite value."),
        wrong(pv(`${Pm}\\,${df(k)}\\,${geoLatex(n, i, g)}`, P * Math.pow(1 + i, -k) * base), "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `The formula already values at time ${k - 1}; discounting ${k} years overshoots.`, chk(`${lit(P)}*${vPow(i, k)}*${geoE(n, i, g)}`, truth)),
        wrong(pv(`${Pm}\\,${df(k - 1)}\\,${geoInvLatex(n, i, g)}`, P * Math.pow(1 + i, -(k - 1)) * ((1 - Math.pow((1 + i) / (1 + g), n)) / (g - i))), "ALG_INVERTED_RATIO", 1, "application", "The ratio is $(1+g)/(1+i)$, not its reciprocal.", chk(`${lit(P)}*${vPow(i, k - 1)}*${geoInvE(n, i, g)}`, truth)),
        wrong(pv(`${Pm}\\,${df(k - 1)}\\,a_{\\overline{${n}}|\\,${lit(i - g)}}`, P * Math.pow(1 + i, -(k - 1)) * an(n, i - g)), "SEQ_GROWTH_RATE_DIFFERENCE", 1, "selection", "A level annuity at $i - g$ (here negative) does not reproduce the geometric stream.", chk(`${lit(P)}*${vPow(i, k - 1)}*${aExpr(n, i - g)}`, truth)),
        wrong(pv(`${Pm}(${lit(1 + g)})\\,${df(k - 1)}\\,${geoLatex(n, i, g)}`, P * (1 + g) * Math.pow(1 + i, -(k - 1)) * base), "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "application", `The first payment is ${amt(P)}.`, chk(`${lit(P * (1 + g))}*${vPow(i, k - 1)}*${geoE(n, i, g)}`, truth)),
      ];
      steps = [
        { concept: "ann.growth-condition", reasoning: `$g > i$, but the stream is finite: the formula still applies.` },
        { concept: "ann.geometric", reasoning: "The formula values the payments one year before the first payment." },
        { concept: "ann.deferred-annuity", reasoning: `The first payment is at time ${k}: the formula gives the value at time ${k - 1}; discount ${k - 1} years.` },
        { concept: "ann.annuity-value-date", reasoning: "Check the first term: the payment at time $k$ is discounted $k$ years in total." },
      ];
    }
    const hard = level === 3;
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: "Each stated value is compared with the payments discounted term by term (a perpetual stream with $g < i$ summed as a geometric series); where $g \\ge i$ the perpetual sum diverges." },
      steps,
      conditions: ["Payments grow geometrically at rate $g$; constant annual effective rate $i$.", "A perpetuity needs $g < i$; a finite stream does not."],
      relationship: "$PV = P\\,\\dfrac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i - g}$ ($g \\ne i$), $\\dfrac{nP}{1+i}$ ($g = i$); perpetuity $\\dfrac{P}{i-g}$ only if $g < i$.",
      counterexample: "With $g = i$ and infinitely many payments, every discounted payment equals $P/(1+i)$ and the sum diverges.",
      transfer: {
        principle: "Before using a growth formula, compare $g$ with $i$ and ask whether the stream is finite.",
        unusual: hard ? "The growth rate exceeds the interest rate." : "The question turns on whether a formula applies.",
        misread: "“$g < i$” is a condition for perpetuities only.",
      },
      itemFormat: "applicability",
      presentation: hard ? (variant === 0 ? ["compare-streams", "hidden-structure"] : ["deferred", "hidden-structure"]) : level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level >= 2, multipleValuationDates: hard && variant === 1 },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { P, i, g, n, variant },
    });
  },
});

const geomMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-geom-meaning",
  family: "con-ann-geometric",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.immediate_due"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "rate_conversion"],
  reasoning: ["concept_recognition", "cashflow_modelling"],
  soaConcept: "Reading the payment pattern behind a geometric annuity written at the adjusted rate j.",
  variants: 2,
  generate(rng, level, variant) {
    const g = gridRate(rng, 0.01, 0.04, 0.005);
    const i = g + gridRate(rng, 0.01, 0.04, 0.005);
    const j = (1 + i) / (1 + g) - 1;
    const n = rng.int(6, 15);
    const k = rng.int(3, 8);
    const P = gridAmount(rng, 100, 2000, 100);
    const Pm = mamt(P);
    const accumulate = level === 2 && variant === 0;
    const deferred = level === 2 && variant === 1;
    const at = accumulate ? n : 0;
    const val = (first: number, ratio: number, t0: number) => (accumulate ? geoAV(first, ratio, n, t0, i, n) : geoPV(first, ratio, n, t0, i));
    const times = (t0: number) => `$${t0}, ${t0 + 1}, \\ldots, ${t0 + n - 1}$`;
    const geo = (first: number, t0: number) => `${n} payments at times ${times(t0)}: the first is ${amt(first)}, and each later one is ${pc(g)} larger.`;
    const arith = (t0: number) => `${n} payments at times ${times(t0)}: the first is ${amt(P)}, and each later one is ${amt(P * g)} larger.`;
    const flat = (amount: number, t0: number) => `${n} payments of ${amt(amount)} each at times ${times(t0)}.`;
    const inv = (first: number, t0: number) => `${n} payments at times ${times(t0)}: the first is ${amt(first)}, and each later one is the previous one divided by ${lit(1 + g)}.`;
    const sj = (s: string) => `${s.replace("}|}", `}|\\,j}`)}`;
    let Elatex: string;
    let E: string;
    let t0: number;
    if (level === 1 && variant === 0) {
      Elatex = `\\dfrac{${Pm}}{${lit(1 + g)}}\\,${sj(aSym(n))}`;
      E = `(${lit(P)}/${lit(1 + g)}*${aExpr(n, j)})`;
      t0 = 1;
    } else if (level === 1) {
      Elatex = `${Pm}\\,${sj(adueSym(n))}`;
      E = `(${lit(P)}*${adueExpr(n, j)})`;
      t0 = 0;
    } else if (accumulate) {
      Elatex = `${Pm}(${lit(1 + g)})^{${n - 1}}\\,${sj(sSym(n))}`;
      E = `(${lit(P)}*${lit(1 + g)}**${n - 1}*${sExpr(n, j)})`;
      t0 = 1;
    } else {
      Elatex = `${Pm}\\,(${fac(i)})^{-${k}}\\,${sj(adueSym(n))}`;
      E = `(${lit(P)}*${vPow(i, k)}*${adueExpr(n, j)})`;
      t0 = k;
    }
    const chk = (valueExpr: string) => ({ check: { expr: E, op: "=" as const, than: valueExpr } });
    const distractors: ConceptOption[] = [];
    if (deferred) {
      distractors.push(
        wrong(geo(P, k + 1), "TIMING_DUE_AS_IMMEDIATE", 1, "interpretation", `$\\ddot{a}$ values the stream on its first payment date, so the first payment is at time ${k}, not ${k + 1}.`, { ...chk(val(P, 1 + g, k + 1)), confusedWith: "ann.immediate-vs-due" }),
        wrong(geo(P, 0), "TIMING_IGNORED_DEFERRAL", 2, "application", `The factor $(1+i)^{-${k}}$ moves the value from time ${k} to time 0; the payments start at time ${k}.`, chk(val(P, 1 + g, 0)))
      );
    } else {
      distractors.push(
        t0 === 1
          ? wrong(geo(P, 0), "TIMING_IMMEDIATE_AS_DUE", 1, "interpretation", "The symbol is an annuity-immediate at rate $j$: the first payment is one period after the valuation date.", { ...chk(val(P, 1 + g, 0)), confusedWith: "ann.immediate-vs-due" })
          : wrong(geo(P, 1), "TIMING_DUE_AS_IMMEDIATE", 1, "interpretation", "$\\ddot{a}$ includes a payment on the valuation date, time 0.", { ...chk(val(P, 1 + g, 1)), confusedWith: "ann.immediate-vs-due" })
      );
    }
    distractors.push(
      wrong(geo(P * (1 + g), t0), t0 === 1 && !accumulate ? "CONC_ANN_GEOM_J_FACTOR" : "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "application", t0 === 1 && !accumulate ? `$${sj(aSym(n))}$ alone values payments $(1+g), (1+g)^2, \\ldots$; dividing by $1 + g$ brings the first payment back to ${amt(P)}.` : `The first payment is ${amt(P)}; growth starts with the second.`, chk(val(P * (1 + g), 1 + g, t0))),
      wrong(arith(t0), "SEQ_GEOMETRIC_AS_ARITHMETIC", 2, "interpretation", "The payments grow by a fixed percentage, not by a fixed amount.", chk(pvOrAv(accumulate, Array.from({ length: n }, (_, m) => ({ t: t0 + m, amount: P + m * P * g })), i, n))),
      wrong(accumulate ? inv(P * Math.pow(1 + g, n - 1), t0) : flat(P, t0), accumulate ? "ALG_INVERTED_RATIO" : "MODEL_LEVEL_FOR_VARYING", 0, accumulate ? "interpretation" : "recognition", accumulate ? `The factor $(1+g)^{${n - 1}}$ is the last payment, not the first: the payments grow over time.` : `Level payments valued at $j$ would be ${amt(P)}$\\,a_{\\overline{${n}}|j}$ with no growth; the rate $j$ is what builds the growth in.`, chk(accumulate ? val(P * Math.pow(1 + g, n - 1), 1 / (1 + g), t0) : val(P, 1, t0))),
      wrong(accumulate ? flat(P * Math.pow(1 + g, n - 1), t0) : inv(P, t0), accumulate ? "MODEL_LEVEL_FOR_VARYING" : "ALG_INVERTED_RATIO", 2, "application", accumulate ? "The payments are not level." : "Discounting at the lower rate $j$ makes later payments larger, not smaller.", chk(accumulate ? val(P * Math.pow(1 + g, n - 1), 1, t0) : val(P, 1 / (1 + g), t0)))
    );
    return conceptQuestion({
      stem: `The annual effective interest rate is ${pc(i)}, and $j = \\dfrac{${fac(i)}}{${lit(1 + g)}} - 1$.\n\nDetermine which of the following has value $${Elatex}$ at time ${at}.`,
      correct: { content: geo(P, t0), why: deferred ? `$${sj(adueSym(n))}$ values payments $1, (1+g), \\ldots$ on the first payment date at rate $i$; $(1+i)^{-${k}}$ moves that value from time ${k} to 0.` : accumulate ? `Factor the last payment out: $\\sum_t P(1+g)^{t-1}(1+i)^{${n}-t} = P(1+g)^{${n - 1}}\\sum_{u=0}^{${n - 1}}(1+j)^u$.` : t0 === 1 ? `$\\dfrac{1}{1+g}a_{\\overline{n}|j} = \\sum_{t=1}^{n}(1+g)^{t-1}(1+i)^{-t}$.` : `$\\ddot{a}_{\\overline{n}|j} = \\sum_{t=0}^{n-1}\\left(\\frac{1+g}{1+i}\\right)^t$: payment $(1+g)^t$ at time $t$.`, check: { expr: E, op: "=", than: val(P, 1 + g, t0) } },
      distractors,
      reference: { description: `Each described pattern is valued term by term at rate ${pc(i)} at time ${at} and compared with the expression; only the correct pattern agrees.` },
      steps: [
        { concept: "ann.geometric", reasoning: "At $1 + j = (1+i)/(1+g)$, one period of discount at $j$ equals one period of discount at $i$ combined with one period of growth at $g$." },
        { concept: "ann.annuity-value-date", reasoning: "The symbol still fixes the date: $a$ one period before the first payment, $\\ddot{a}$ at it, $s$ at the last payment." },
        ...(level === 2 ? [{ concept: deferred ? "ann.deferred-annuity" : "ann.annuity-identities", reasoning: deferred ? `The extra factor $(1+i)^{-${k}}$ discounts at the true rate $i$ from the first payment date to time 0.` : `The factor $(1+g)^{${n - 1}}$ is the size of the last payment.` }] : [{ concept: "ann.stream-decomposition", reasoning: "Check the first payment and its date, then the growth from one payment to the next." }]),
      ],
      conditions: ["Payments grow geometrically at rate $g$; constant annual effective rate $i > g$."],
      relationship: "$\\sum_{t=1}^{n}(1+g)^{t-1}v^t = \\dfrac{a_{\\overline{n}|j}}{1+g}$, $\\quad 1 + j = \\dfrac{1+i}{1+g}$",
      counterexample: "With $g = 0$, $j = i$ and the expressions reduce to level annuities.",
      transfer: {
        principle: "Discounting at $j$ already includes the growth; find the first payment by checking the first term.",
        unusual: "The rate in the symbol is not the market rate.",
        misread: "The $1/(1+g)$ factor is easily attributed to the wrong payment.",
      },
      itemFormat: "interpretation",
      presentation: level === 2 ? ["hidden-structure", "valuation-date"] : ["hidden-structure"],
      features: { unfamiliar: true, multipleValuationDates: level === 2 },
      params: { P, i, g, n, k, variant },
    });
  },
});

/** Value at time 0 (or at time `at` when accumulating) of explicit flows. */
function pvOrAv(accumulate: boolean, flows: { t: number; amount: number }[], i: number, at: number): string {
  return accumulate ? avTerms(flows, i, at) : pvTerms(flows, i);
}

const geomDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-ann-geom-diagnosis",
  family: "con-ann-geometric",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.immediate_due"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "relationships"],
  reasoning: ["validation", "formula_selection", "cashflow_modelling"],
  soaConcept: "Diagnosing the error in a proposed geometric-annuity valuation.",
  variants: 2,
  generate(rng, level, variant) {
    const g = gridRate(rng, 0.01, 0.04, 0.005);
    const i = g + gridRate(rng, 0.01, 0.04, 0.005);
    const j = (1 + i) / (1 + g) - 1;
    const n = rng.int(6, 20);
    const P = gridAmount(rng, 500, 5000, 100);
    const Pm = mamt(P);
    const ask = "Which of the following correctly describes the candidate's calculation?";
    const fix = (expr: string, truth: string) => ({ check: { expr, op: "=" as const, than: truth } });
    const grow = `each later payment is ${pc(g)} larger than the one before`;
    const common = {
      conditions: ["Payments grow geometrically at rate $g$; constant annual effective rate $i > g$."],
      relationship: "$PV = P\\,\\dfrac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i-g} = \\dfrac{P}{1+g}\\,a_{\\overline{n}|j}, \\quad 1+j = \\dfrac{1+i}{1+g}$",
      transfer: {
        principle: "Test a geometric formula on its first term: the first payment, its date and its discount.",
        unusual: "You judge a worked solution.",
        misread: "The growth factor and the discount factor are easily attached to the wrong payment.",
      },
    };
    if (level === 2 && variant === 0) {
      const truth = geoPV(P, 1 + g, n, 1, i);
      const W = `(${lit(P * (1 + g))}*${geoE(n, i, g)})`;
      const Wv = P * (1 + g) * ((1 - Math.pow((1 + g) / (1 + i), n)) / (i - g));
      return conceptQuestion({
        stem: `A series of ${n} payments is made at the end of each year. The first payment is ${amt(P)}, and ${grow}. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Pm}(${lit(1 + g)})\\,${geoLatex(n, i, g)} = ${mnum(Wv, 2)}.$$\n\n${ask}`,
        correct: { content: "The first payment has not grown yet: divide the result by $1 + g$.", why: `Every payment was taken one growth step too large; the value is $${mnum(Wv / (1 + g), 2)}$.`, ...fix(`${W}/${lit(1 + g)}`, truth) },
        distractors: [
          wrong("The calculation is correct: the factor $1 + g$ gives the payment at time 1.", "CONC_ANN_FIRST_PAYMENT_GROWTH", 0, "interpretation", `The payment at time 1 is ${amt(P)}.`, fix(W, truth)),
          wrong("The payments are at year-end, so the result should be divided by $1 + i$.", "TIMING_IMMEDIATE_AS_DUE", 1, "application", "The formula already discounts the first payment one year; the extra factor is growth, not interest.", fix(`${W}/${onePlusE(i)}`, truth)),
          wrong("The ratio in the formula should be $(1+i)/(1+g)$, with denominator $g - i$.", "ALG_INVERTED_RATIO", 1, "selection", "Inverting the ratio does not remove the extra growth factor and misstates the series.", fix(`${lit(P * (1 + g))}*${geoInvE(n, i, g)}`, truth)),
          wrong(`The formula should be replaced by ${amt(P)}$\\,a_{\\overline{${n}}|}$ at the rate $i - g$.`, "SEQ_GROWTH_RATE_DIFFERENCE", 2, "connection", "Discounting at $i - g$ only approximates the geometric stream.", fix(`${lit(P)}*${aExpr(n, i - g)}`, truth)),
        ],
        reference: { description: "The payments discounted term by term; each diagnosis's correction is compared with that value." },
        steps: [
          { concept: "ann.geometric", reasoning: "Payments $P, P(1+g), \\ldots$: the formula multiplies the first payment, $P$." },
          { concept: "ann.annuity-value-date", reasoning: "Its first discounted term is $Pv$, the payment at time 1." },
          { concept: "ann.stream-decomposition", reasoning: "Multiplying by $1 + g$ inflates every payment by one growth step: divide it out." },
        ],
        ...common,
        presentation: ["direct"],
        features: { multiConcept: true },
        params: { P, i, g, n, variant },
      });
    }
    if (level === 2) {
      const truth = geoPV(P, 1 + g, n, 1, i);
      const W = `(${lit(P)}*${aExpr(n, i - g)})`;
      return conceptQuestion({
        stem: `A series of ${n} payments is made at the end of each year. The first payment is ${amt(P)}, and ${grow}. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Pm}\\,a_{\\overline{${n}}|\\,${lit(i - g)}} = ${mnum(P * an(n, i - g), 2)}.$$\n\n${ask}`,
        correct: { content: "Discount at $j = (1+i)/(1+g) - 1$ instead of $i - g$, and divide the result by $1 + g$.", why: `$\\dfrac{${Pm}}{${lit(1 + g)}}a_{\\overline{${n}}|j}$ reproduces each payment's present value exactly.`, ...fix(`${lit(P)}/${lit(1 + g)}*${aExpr(n, j)}`, truth) },
        distractors: [
          wrong("The calculation is correct: growth at $g$ offsets interest at $i$, leaving the rate $i - g$.", "SEQ_GROWTH_RATE_DIFFERENCE", 0, "selection", "Rates combine by ratio, not by difference: $(1+i)/(1+g) - 1 \\ne i - g$.", fix(W, truth)),
          wrong("Discount at $j = (1+i)/(1+g) - 1$ instead of $i - g$; no other change is needed.", "CONC_ANN_GEOM_J_FACTOR", 1, "application", "Without the $1/(1+g)$ factor this values payments starting at $P(1+g)$.", fix(`${lit(P)}*${aExpr(n, j)}`, truth)),
          wrong("The rate should be $i + g$, since growth adds to the required return.", "ALG_SIGN_ERROR", 0, "interpretation", "Growth offsets discounting; it does not add to it.", fix(`${lit(P)}*${aExpr(n, i + g)}`, truth)),
          wrong("Discount at $j = (1+i)/(1+g) - 1$ and multiply the result by $1 + g$.", "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "application", "The adjustment is a division by $1 + g$, which brings the first payment back to $P$.", fix(`${lit(P * (1 + g))}*${aExpr(n, j)}`, truth)),
          wrong("The payments should be valued as a level annuity at the rate $i$.", "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "That ignores the growth.", fix(`${lit(P)}*${aExpr(n, i)}`, truth)),
        ],
        reference: { description: "The payments discounted term by term; each diagnosis's correction is compared with that value." },
        steps: [
          { concept: "ann.geometric", reasoning: "$(1+g)^{t-1}v^t = \\dfrac{1}{1+g}\\left(\\dfrac{1+g}{1+i}\\right)^t = \\dfrac{1}{1+g}(1+j)^{-t}$." },
          { concept: "tvm.real-rate", reasoning: "Growth and interest combine by ratio, as real and nominal rates do; $i - g$ is only an approximation." },
          { concept: "ann.annuity-value-date", reasoning: "Check the first term: $\\frac{1}{1+g}(1+j)^{-1} = v$." },
        ],
        ...common,
        presentation: ["direct"],
        features: { multiConcept: true },
        params: { P, i, g, n, variant },
      });
    }
    if (variant === 0) {
      const truth = geoAV(P, 1 + g, n, 0, i, n);
      const W = `(${lit(P)}*(${accPow(i, n)}-${lit(1 + g)}**${n})/(${lit(i)}-${lit(g)}))`;
      const Wv = (P * (Math.pow(1 + i, n) - Math.pow(1 + g, n))) / (i - g);
      return conceptQuestion({
        stem: `Deposits are made at the beginning of each year for ${n} years. The first deposit is ${amt(P)}, and each later deposit is ${pc(g)} larger than the one before. The fund earns an annual effective rate of ${pc(i)}. A candidate calculates the amount in the fund at the end of year ${n} as\n\n$$\\dfrac{${Pm}\\left[(${fac(i)})^{${n}} - (${lit(1 + g)})^{${n}}\\right]}{${lit(i)} - ${lit(g)}} = ${mnum(Wv, 2)}.$$\n\n${ask}`,
        correct: { content: "The deposits are made at the start of each year, so each earns one more year of interest: multiply by $1 + i$.", why: `The candidate's expression accumulates deposits made at times 1 to ${n}; the correct value is $${mnum(Wv * (1 + i), 2)}$.`, ...fix(`${W}*${onePlusE(i)}`, truth) },
        distractors: [
          wrong("The calculation is correct: the expression already counts a deposit at time 0.", "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", `The expression equals $(1+i)^{${n}}$ times the annuity-immediate formula, whose first deposit is at time 1.`, { ...fix(W, truth), confusedWith: "ann.immediate-vs-due" }),
          wrong("Each deposit is one growth step larger than assumed: multiply by $1 + g$.", "CONC_ANN_FIRST_PAYMENT_GROWTH", 1, "interpretation", "The deposit sizes are right; their timing is wrong.", fix(`${W}*${lit(1 + g)}`, truth)),
          wrong(`The expression is a present value: multiply by $(${fac(i)})^{-${n}}$.`, "FORMULA_AV_FOR_PV", 1, "selection", `$[(1+i)^n - (1+g)^n]/(i-g)$ is a value at time ${n}, not time 0.`, fix(`${W}*${vPow(i, n)}`, truth)),
          wrong("The value is overstated by one year of interest: divide by $1 + i$.", "CONC_MOVED_WRONG_WAY", 2, "application", "Earlier deposits earn more interest, not less.", fix(`${W}/${onePlusE(i)}`, truth)),
          wrong(`Both powers should be ${n + 1}, since the deposits cover ${n + 1} dates.`, "SEQ_TERM_COUNT", 2, "application", `There are ${n} deposits, at times 0 to ${n - 1}.`, fix(`(${lit(P)}*(${accPow(i, n + 1)}-${lit(1 + g)}**${n + 1})/(${lit(i)}-${lit(g)}))`, truth)),
        ],
        reference: { description: `The deposits accumulated term by term to time ${n}; each diagnosis's correction is compared with that value.` },
        steps: [
          { concept: "ann.immediate-vs-due", reasoning: `Deposits at the start of each year: times $0, \\ldots, ${n - 1}$.` },
          { concept: "ann.geometric", reasoning: `$[(1+i)^n - (1+g)^n]/(i-g) = (1+i)^n \\times$ (present value of $1, (1+g), \\ldots$ at times $1, \\ldots, n$).` },
          { concept: "ann.annuity-value-date", reasoning: `So the candidate valued deposits at times 1 to ${n}; the actual ones are a year earlier.` },
          { concept: "ann.immediate-vs-due", reasoning: "Moving every deposit one year earlier multiplies the accumulated value by $1 + i$." },
        ],
        ...common,
        presentation: ["valuation-date", "hidden-structure"],
        features: { multipleValuationDates: true, unfamiliar: true },
        modelingDecisions: 1,
        params: { P, i, g, n, variant },
      });
    }
    const k = rng.int(3, 8);
    const truth = `(${lit(P)}*${vPow(i, k)}/(1-${lit(1 + g)}*${vPow(i, 1)}))`;
    const W = `(${lit(P)}/(${lit(i)}-${lit(g)})*${vPow(i, k)})`;
    const Wv = (P / (i - g)) * Math.pow(1 + i, -k);
    return conceptQuestion({
      stem: `A perpetuity makes its first payment, of ${amt(P)}, at the end of year ${k}; each later annual payment is ${pc(g)} larger than the one before. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$\\dfrac{${Pm}}{${lit(i)} - ${lit(g)}}\\,(${fac(i)})^{-${k}} = ${mnum(Wv, 2)}.$$\n\n${ask}`,
      correct: { content: `$P/(i-g)$ values the stream one year before its first payment, so discount ${k - 1} years: multiply by $1 + i$.`, why: `The formula gives the value at time ${k - 1}; the correct value is $${mnum(Wv * (1 + i), 2)}$.`, ...fix(`${W}*${onePlusE(i)}`, truth) },
      distractors: [
        wrong("The calculation is correct: $P/(i-g)$ values the stream on the date of its first payment.", "CONC_ANN_PERP_VALUE_DATE", 1, "interpretation", "Like $1/i$, $P/(i-g)$ values one period before the first payment.", fix(W, truth)),
        wrong(`The first payment has already grown for ${k - 1} years: multiply by $(${lit(1 + g)})^{${k - 1}}$.`, "CONC_ANN_FIRST_PAYMENT_GROWTH", 0, "interpretation", `The first payment is stated as ${amt(P)}; growth applies only to later payments.`, fix(`${W}*${lit(1 + g)}**${k - 1}`, truth)),
        wrong(`The deferral should be discounted at $i - g$: replace $(${fac(i)})^{-${k}}$ by $(${lit(1 + i - g)})^{-${k}}$.`, "SEQ_GROWTH_RATE_DIFFERENCE", 2, "connection", "Nothing grows before the first payment: the deferral is discounted at $i$.", fix(`(${lit(P)}/(${lit(i)}-${lit(g)})*${lit(1 + i - g)}**(-${k}))`, truth)),
        wrong("The value is overstated by one year of interest: divide by $1 + i$.", "CONC_MOVED_WRONG_WAY", 2, "application", "The candidate already discounted one year too many.", fix(`${W}/${onePlusE(i)}`, truth)),
        wrong("No finite value exists, because the payments grow forever.", "CONC_ANN_PERP_INFINITE", 0, "recognition", "With $g < i$ the discounted payments shrink geometrically, so the sum is finite."),
      ],
      reference: { description: `The payments summed as a geometric series from time ${k}; each diagnosis's correction is compared with that value.` },
      steps: [
        { concept: "ann.growth-condition", reasoning: "$g < i$, so the growing perpetuity has a finite value." },
        { concept: "ann.geometric", reasoning: "$P/(i-g)$ is the value one year before the first payment." },
        { concept: "ann.deferred-annuity", reasoning: `First payment at time ${k}: the formula gives the value at time ${k - 1}; discount ${k - 1} years.` },
        { concept: "ann.annuity-value-date", reasoning: "The candidate discounted one year too many: multiply by $1 + i$." },
      ],
      ...common,
      relationship: "$v^{k-1}\\,\\dfrac{P}{i-g}$ for a growing perpetuity whose first payment, $P$, is at time $k$",
      presentation: ["deferred", "valuation-date"],
      features: { multipleValuationDates: true, unfamiliar: true },
      modelingDecisions: 1,
      params: { P, i, g, k, variant },
    });
  },
});

// ================================================================ finite and perpetual streams

type Block = [number, number];
const blockText = (b: Block): string => (Number.isFinite(b[1]) ? (b[0] === b[1] ? `time $${b[0]}$` : `times $${seqList(b[0], 1, b[1])}$`) : `times $${b[0]}, ${b[0] + 1}, ${b[0] + 2}, \\ldots$ forever`);
const blocksText = (bs: Block[]): string => `Payments of 1 at ${bs.map(blockText).join(" and at ")}.`;
const blocksPV = (bs: Block[], i: number): string => `(${bs.map((b) => (Number.isFinite(b[1]) ? pvLev(1, b[0], b[1], i) : perpFrom(1, b[0], i))).join(" + ")})`;

const streamMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-stream-meaning",
  family: "con-ann-streams",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.perpetuities"],
  itemFormat: "interpretation",
  conceptFamily: "definition",
  dimensions: ["interpretation", "timing"],
  reasoning: ["concept_recognition", "cashflow_modelling", "valuation_dates"],
  soaConcept: "Which payments a difference of annuity or perpetuity symbols represents.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const d = i / (1 + i);
    const n = rng.int(4, 15);
    const m = rng.int(3, 12);
    const INF = Infinity;
    let Elatex: string;
    let E: string;
    let cor: Block[];
    let rows: Array<[Block[], MisconceptionId, number, ConceptFailure, string]>;
    if (level === 1 && variant === 0) {
      Elatex = `${A_INF} - ${aSym(n)}`;
      E = `(1/${lit(i)} - ${aExpr(n, i)})`;
      cor = [[n + 1, INF]];
      rows = [
        [[[n, INF]], "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${aSym(n)}$ removes the payments at times 1 to ${n}, including time ${n}.`],
        [[[1, n]], "TRANS_INVERTED_RELATION", 0, "interpretation", "Those are the payments being subtracted, not the ones left."],
        [[[n + 1, 2 * n]], "FORMULA_PERPETUITY_FOR_FINITE", 1, "connection", "What remains of a perpetuity continues forever."],
        [[[n + 2, INF]], "TIMING_EXTRA_PERIOD", 1, "application", `Only ${n} payments are removed; the next one, at time ${n + 1}, remains.`],
      ];
    } else if (level === 1) {
      Elatex = `${aSym(m + n)} - ${aSym(m)}`;
      E = `(${aExpr(m + n, i)} - ${aExpr(m, i)})`;
      cor = [[m + 1, m + n]];
      rows = [
        [[[m, m + n - 1]], "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${aSym(m)}$ removes times 1 to ${m}, so the first remaining payment is at time ${m + 1}.`],
        [[[m + 1, m + n - 1]], "SEQ_TERM_COUNT", 1, "application", `${m + n} payments less ${m} leaves ${n}, not ${n - 1}.`],
        [[[1, m]], "TRANS_INVERTED_RELATION", 0, "interpretation", "Those are the payments being subtracted."],
        [[[m + 1, INF]], "FORMULA_PERPETUITY_FOR_FINITE", 0, "recognition", `$${aSym(m + n)}$ ends at time ${m + n}.`],
      ];
    } else if (variant === 0) {
      Elatex = `${ADUE_INF} - ${aSym(n)}`;
      E = `(1/${lit(d)} - ${aExpr(n, i)})`;
      cor = [[0, 0], [n + 1, INF]];
      rows = [
        [[[n + 1, INF]], "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", "$\\ddot{a}_{\\overline{\\infty}|}$ includes a payment at time 0, which $a_{\\overline{n}|}$ does not remove."],
        [[[n, INF]], "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${aSym(n)}$ removes times 1 to ${n}; time 0 stays, time ${n} goes.`],
        [[[0, n]], "TRANS_INVERTED_RELATION", 0, "interpretation", "That reads the difference as the payments removed."],
        [[[0, 0], [n, INF]], "SEQ_TERM_COUNT", 1, "application", `$${aSym(n)}$ removes ${n} payments, the last at time ${n}.`],
        [[[0, 0], [n + 1, 2 * n]], "FORMULA_PERPETUITY_FOR_FINITE", 1, "connection", "What remains of a perpetuity continues forever."],
      ];
    } else {
      Elatex = `v^{${n}}\\,${ADUE_INF} - v^{${2 * n}}\\,${A_INF}`;
      E = `(${vPow(i, n)}/${lit(d)} - ${vPow(i, 2 * n)}/${lit(i)})`;
      cor = [[n, 2 * n]];
      rows = [
        [[[n + 1, 2 * n]], "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", `$v^{${n}}\\ddot{a}_{\\overline{\\infty}|}$ starts at time ${n}, not ${n + 1}.`],
        [[[n, 2 * n - 1]], "SEQ_TERM_COUNT", 1, "application", `$v^{${2 * n}}a_{\\overline{\\infty}|}$ removes payments from time ${2 * n + 1}, so time ${2 * n} remains.`],
        [[[n + 1, 2 * n + 1]], "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", "Both deferrals are read one period late."],
        [[[n, INF]], "TRANS_IGNORED_CONDITION", 2, "connection", "The second term removes the tail from time $2n+1$ on."],
        [[[2 * n + 1, INF]], "TRANS_INVERTED_RELATION", 2, "interpretation", "That is the tail being subtracted."],
      ];
    }
    return conceptQuestion({
      stem: `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following has present value $${Elatex}$ at time 0.`,
      correct: { content: blocksText(cor), why: `Write each term as payments: the first is a stream starting at its own date, the second removes a block; what remains is ${cor.map(blockText).join(" and ")}.`, check: { expr: E, op: "=", than: blocksPV(cor, i) } },
      distractors: rows.map(([bs, mis, stage, failure, why]) => wrong(blocksText(bs), mis, stage, failure, why, { check: { expr: E, op: "=", than: blocksPV(bs, i) } })),
      reference: { description: "Each described set of payments is valued term by term (any perpetual tail as a geometric series) and compared with the expression." },
      steps: [
        { concept: "ann.finite-vs-perpetual", reasoning: "Translate each symbol into payments: $a_{\\overline{\\infty}|}$ is times $1, 2, \\ldots$; $\\ddot{a}_{\\overline{\\infty}|}$ is times $0, 1, \\ldots$; $a_{\\overline{n}|}$ is times $1, \\ldots, n$." },
        { concept: "ann.deferred-annuity", reasoning: "A factor $v^k$ shifts a stream $k$ periods later." },
        ...(level === 2 ? [{ concept: "ann.immediate-vs-due", reasoning: "A due symbol starts on its valuation date, an immediate one a period after it." }] : []),
      ],
      conditions: ["Payments of 1 at a constant annual effective rate."],
      relationship: "$a_{\\overline{\\infty}|} - a_{\\overline{n}|} = v^n a_{\\overline{\\infty}|}$, $\\quad a_{\\overline{m+n}|} - a_{\\overline{m}|} = v^m a_{\\overline{n}|}$",
      counterexample: "With $n = 0$ nothing is removed and the expression is the whole perpetuity.",
      transfer: {
        principle: "Read a difference of annuities as “these payments, minus those payments”, then list what is left.",
        unusual: "You go from symbols to payments.",
        misread: "The boundary payment is easily counted on the wrong side.",
      },
      itemFormat: "interpretation",
      presentation: level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { i, n, m, variant },
    });
  },
});

const streamSplit: ChoiceTemplate = conceptTemplate({
  id: "con-ann-stream-split",
  family: "con-ann-streams",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.non_level"],
  itemFormat: "expression-selection",
  conceptFamily: "timeline",
  dimensions: ["timing", "equation_construction"],
  reasoning: ["cashflow_modelling", "valuation_dates", "formula_selection"],
  soaConcept: "Valuing a stream that changes level, with finite and perpetual pieces, at a chosen date.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const d = i / (1 + i);
    const n = rng.int(3, 12);
    const m = rng.int(2, 8);
    const X = gridAmount(rng, 100, 1000, 50);
    const Y = X + gridAmount(rng, 50, 1000, 50);
    const Z = Y + gridAmount(rng, 50, 500, 50);
    const [Xm, Ym, Zm] = [X, Y, Z].map(mamt);
    const v = (e: number) => (e === 0 ? "" : `\\,${pow(i, -e)}`);
    const ve = (e: number) => accPow(i, -e);
    const inf = (amt0: string, e: number, due = false) => `${amt0}${v(e)}\\,${due ? ADUE_INF : A_INF}`;
    const infE = (a0: number, e: number, due = false) => `(${lit(a0)}*${ve(e)}/${lit(due ? d : i)})`;
    const sum = (...parts: string[]) => parts.join(" + ");
    const sumE = (...parts: string[]) => `(${parts.join("+")})`;
    const ax = (a0: string, s: string) => `${a0}\\,${s}`;
    const axE = (a0: number, e: string) => `(${lit(a0)}*${e})`;
    let stem: string;
    let truth: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps: { concept: string; reasoning: string }[];
    const rate = `The annual effective interest rate is ${pc(i)}.`;
    if (level === 1 && variant === 0) {
      truth = `(${pvLev(X, 1, n, i)} + ${perpFrom(Y, n + 1, i)})`;
      stem = `Payments of ${amt(X)} are made at the end of each year for ${n} years. Beginning at the end of year ${n + 1}, payments of ${amt(Y)} are made at the end of each year forever. ${rate}\n\nDetermine which of the following is the present value of the payments.`;
      const head = ax(Xm, aSym(n));
      const headE = axE(X, aExpr(n, i));
      correct = { content: math(sum(head, inf(Ym, n))), probe: sumE(headE, infE(Y, n)), why: `The ${amt(Y)} perpetuity is valued at time ${n}, one year before its first payment, then discounted ${n} years.` };
      distractors = [
        wrong(math(sum(head, inf(Ym, n + 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${A_INF}$ already values one year before the first payment, at time ${n}.`, { probe: sumE(headE, infE(Y, n + 1)) }),
        wrong(math(sum(head, inf(Ym, 0))), "TIMING_IGNORED_DEFERRAL", 1, "interpretation", "The second stream starts after the first ends.", { probe: sumE(headE, infE(Y, 0)) }),
        wrong(math(sum(head, inf(mamt(Y - X), n))), "CONC_ANN_LAYER_MIX", 0, "selection", `Only the increase is added after year ${n}, but the ${amt(X)} payments have stopped.`, { probe: sumE(headE, infE(Y - X, n)) }),
        wrong(math(sum(head, inf(Ym, n - 1))), "CONC_DOUBLE_COUNTED", 1, "application", `That starts the ${amt(Y)} payments at time ${n}, where ${amt(X)} is already paid.`, { probe: sumE(headE, infE(Y, n - 1)) }),
        wrong(math(`${head} + ${Ym}\\,${pow(i, n)}\\,${A_INF}`), "CONC_MOVED_WRONG_WAY", 2, "application", "A later value is discounted to time 0, not accumulated.", { probe: sumE(headE, infE(Y, -n)) }),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Sequential blocks: ${amt(X)} at times 1–${n}, then ${amt(Y)} from time ${n + 1}.` },
        { concept: "ann.deferred-annuity", reasoning: `The perpetuity factor values the second block at time ${n}; discount ${n} years.` },
        { concept: "ann.annuity-value-date", reasoning: "Check each block's first payment is discounted exactly to time 0." },
      ];
    } else if (level === 1) {
      truth = `(${pvLev(X, 1, n, i)} + ${perpFrom(Y, n + 1, i)})`;
      stem = `A perpetuity pays ${amt(X)} at the end of each year for the first ${n} years and ${amt(Y)} at the end of each year thereafter. ${rate}\n\nDetermine which of the following is the present value of the perpetuity.`;
      const head = inf(Xm, 0);
      const headE = infE(X, 0);
      correct = { content: math(sum(head, inf(mamt(Y - X), n))), probe: sumE(headE, infE(Y - X, n)), why: `Layer it: ${amt(X)} forever, plus an extra ${amt(Y - X)} forever from time ${n + 1}.` };
      distractors = [
        wrong(math(sum(head, inf(Ym, n))), "CONC_ANN_LAYER_MIX", 0, "selection", `With ${amt(X)} continuing forever, only the increase ${amt(Y - X)} is added from time ${n + 1}.`, { probe: sumE(headE, infE(Y, n)) }),
        wrong(math(sum(head, inf(mamt(Y - X), n + 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `The extra layer starts at time ${n + 1}; its value at time ${n} is discounted ${n} years.`, { probe: sumE(headE, infE(Y - X, n + 1)) }),
        wrong(math(sum(head, inf(mamt(Y - X), 0))), "TIMING_IGNORED_DEFERRAL", 1, "interpretation", "The extra layer starts after year $n$.", { probe: sumE(headE, infE(Y - X, 0)) }),
        wrong(math(sum(head, inf(mamt(Y - X), n - 1))), "CONC_DOUBLE_COUNTED", 1, "application", `That pays the higher amount at time ${n} as well.`, { probe: sumE(headE, infE(Y - X, n - 1)) }),
        wrong(math(`${head} - ${mamt(Y - X)}${v(n)}\\,${A_INF}`), "ALG_SIGN_ERROR", 2, "application", "The payments rise, so the layer is added.", { probe: `(${headE}-${infE(Y - X, n)})` }),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Layered: ${amt(X)} forever plus ${amt(Y - X)} forever from time ${n + 1}.` },
        { concept: "ann.deferred-annuity", reasoning: `The extra layer is a perpetuity valued at time ${n}, discounted ${n} years.` },
        { concept: "ann.annuity-value-date", reasoning: "Check: at time 1 the total is $X$; at time $n+1$ it is $Y$." },
      ];
    } else if (level === 2 && variant === 0) {
      truth = `((${pvLev(X, 1, n, i)} + ${perpFrom(Y, n + 1, i)})*${accPow(i, n)})`;
      stem = `Payments of ${amt(X)} are made at the end of each year for ${n} years. Beginning at the end of year ${n + 1}, payments of ${amt(Y)} are made at the end of each year forever. ${rate}\n\nDetermine which of the following is the value of all the payments at time ${n}.`;
      const head = ax(Xm, sSym(n));
      const headE = axE(X, sExpr(n, i));
      correct = { content: math(sum(head, inf(Ym, 0))), probe: sumE(headE, infE(Y, 0)), why: `At time ${n}, the first block is accumulated to its last payment and the perpetuity is valued one year before its first payment: both at time ${n}.` };
      distractors = [
        wrong(math(sum(head, inf(Ym, 1))), "TIMING_EXTRA_PERIOD", 1, "application", `$${A_INF}$ already values at time ${n}.`, { probe: sumE(headE, infE(Y, 1)) }),
        wrong(math(sum(ax(Xm, aSym(n)), inf(Ym, 0))), "TIMING_VALUATION_DATE", 0, "selection", `$${aSym(n)}$ is a value at time 0, while the perpetuity term is at time ${n}.`, { probe: sumE(axE(X, aExpr(n, i)), infE(Y, 0)) }),
        wrong(math(sum(ax(Xm, sdueSym(n)), inf(Ym, 0))), "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${sdueSym(n)}$ values the first block at time ${n + 1}.`, { probe: sumE(axE(X, sdueExpr(n, i)), infE(Y, 0)), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(sum(head, inf(Ym, 0, true))), "CONC_DOUBLE_COUNTED", 2, "application", `$${ADUE_INF}$ adds a ${amt(Y)} payment at time ${n}.`, { probe: sumE(headE, infE(Y, 0, true)) }),
        wrong(math(sum(head, inf(Ym, n))), "CONC_MOVED_WRONG_WAY", 2, "application", `The perpetuity's value at time ${n} needs no further discount.`, { probe: sumE(headE, infE(Y, n)) }),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Split at time ${n}: past block and future perpetuity.` },
        { concept: "ann.annuity-value-date", reasoning: `$${sSym(n)}$ values the past block at time ${n}; $${A_INF}$ values the future one at time ${n}.` },
        { concept: "tvm.equation-of-value", reasoning: "Both terms are at the same date, so they may be added." },
      ];
    } else if (level === 2) {
      truth = `(${pvLev(X, 1, n, i)} + ${perpFrom(Y, n + m + 1, i)})`;
      stem = `Payments of ${amt(X)} are made at the end of each year for ${n} years. No payments are made for the following ${m} years; then payments of ${amt(Y)} are made at the end of each year forever. ${rate}\n\nDetermine which of the following is the present value of the payments.`;
      const head = ax(Xm, aSym(n));
      const headE = axE(X, aExpr(n, i));
      correct = { content: math(sum(head, inf(Ym, n + m))), probe: sumE(headE, infE(Y, n + m)), why: `The ${amt(Y)} payments start at time ${n + m + 1}; the perpetuity factor values them at time ${n + m}.` };
      distractors = [
        wrong(math(sum(head, inf(Ym, n + m + 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$${A_INF}$ values one year before the first payment, at time ${n + m}.`, { probe: sumE(headE, infE(Y, n + m + 1)) }),
        wrong(math(sum(head, inf(Ym, m))), "TIMING_VALUATION_DATE", 1, "application", `That discounts only over the gap; the gap ends at time ${n + m}, not ${m}.`, { probe: sumE(headE, infE(Y, m)) }),
        wrong(math(sum(head, inf(Ym, n + m - 1))), "TIMING_MISSING_PERIOD", 1, "application", `${n + m} years of discount are needed, not ${n + m - 1}.`, { probe: sumE(headE, infE(Y, n + m - 1)) }),
        wrong(math(sum(head, inf(Ym, n))), "TRANS_IGNORED_CONDITION", 0, "interpretation", `That ignores the ${m}-year gap.`, { probe: sumE(headE, infE(Y, n)) }),
        wrong(math(`${head} + ${Ym}\\,${pow(i, n + m)}\\,${A_INF}`), "CONC_MOVED_WRONG_WAY", 2, "application", "A later value is discounted to time 0, not accumulated.", { probe: sumE(headE, infE(Y, -(n + m))) }),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Blocks: ${amt(X)} at times 1–${n}, nothing for ${m} years, ${amt(Y)} from time ${n + m + 1}.` },
        { concept: "ann.deferred-annuity", reasoning: `The perpetuity factor values the last block at time ${n + m}.` },
        { concept: "tvm.equation-of-value", reasoning: `Discount ${n + m} years to time 0.` },
      ];
    } else if (variant === 0) {
      truth = `((${pvLev(X, 1, n, i)} + ${pvLev(Y, n + 1, n + m, i)} + ${perpFrom(Z, n + m + 1, i)})*${accPow(i, n)})`;
      stem = `A stream pays ${amt(X)} at the end of each year for ${n} years, then ${amt(Y)} at the end of each year for the next ${m} years, then ${amt(Z)} at the end of each year forever. ${rate}\n\nDetermine which of the following is the value of the stream at time ${n}.`;
      const a1 = ax(Xm, sSym(n));
      const a1E = axE(X, sExpr(n, i));
      const a2 = ax(Ym, aSym(m));
      const a2E = axE(Y, aExpr(m, i));
      correct = { content: math(sum(a1, a2, inf(Zm, m))), probe: sumE(a1E, a2E, infE(Z, m)), why: `Past block accumulated to time ${n}; the ${amt(Y)} block discounted to time ${n}; the ${amt(Z)} perpetuity valued at time ${n + m} and discounted ${m} years.` };
      distractors = [
        wrong(math(sum(a1, a2, inf(Zm, m + 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `$${A_INF}$ values the last block at time ${n + m}; only ${m} years remain to time ${n}.`, { probe: sumE(a1E, a2E, infE(Z, m + 1)) }),
        wrong(math(sum(ax(Xm, aSym(n)), a2, inf(Zm, m))), "TIMING_VALUATION_DATE", 0, "selection", `Payments before time ${n} must be accumulated to time ${n}.`, { probe: sumE(axE(X, aExpr(n, i)), a2E, infE(Z, m)) }),
        wrong(math(sum(a1, a2, inf(Zm, 0))), "TIMING_IGNORED_DEFERRAL", 2, "interpretation", `The ${amt(Z)} payments start ${m} years after time ${n + 1}.`, { probe: sumE(a1E, a2E, infE(Z, 0)) }),
        wrong(math(sum(a1, ax(Ym, adueSym(m)), inf(Zm, m))), "CONC_DOUBLE_COUNTED", 1, "application", `$${adueSym(m)}$ adds a ${amt(Y)} payment at time ${n}, where ${amt(X)} is paid.`, { probe: sumE(a1E, axE(Y, adueExpr(m, i)), infE(Z, m)) }),
        wrong(math(sum(a1, a2, inf(mamt(Z - Y), m))), "CONC_ANN_LAYER_MIX", 1, "selection", `The ${amt(Y)} block stops after ${m} years; only a layered decomposition adds just the increase.`, { probe: sumE(a1E, a2E, infE(Z - Y, m)) }),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: "Three sequential blocks; split at the valuation date." },
        { concept: "ann.annuity-value-date", reasoning: `$${sSym(n)}$ for the past block and $${aSym(m)}$ for the next block both give values at time ${n}.` },
        { concept: "ann.deferred-annuity", reasoning: `The perpetuity is worth $${Zm}/i$ at time ${n + m}; discount ${m} years.` },
        { concept: "tvm.equation-of-value", reasoning: "Add the three values at the common date." },
      ];
    } else {
      truth = `(${pvLev(X, 0, n - 1, i)} + ${perpFrom(Y, n + 1, i)})`;
      stem = `Payments of ${amt(X)} are made at the beginning of each year for ${n} years, the first today. Payments of ${amt(Y)} are then made at the end of each year, starting with the end of year ${n + 1}, forever. ${rate}\n\nDetermine which of the following is the present value of the payments.`;
      const head = ax(Xm, adueSym(n));
      const headE = axE(X, adueExpr(n, i));
      correct = { content: math(sum(head, inf(Ym, n))), probe: sumE(headE, infE(Y, n)), why: `Start-of-year payments occupy times 0–${n - 1}; the ${amt(Y)} perpetuity starts at time ${n + 1}, so its factor values at time ${n}.` };
      distractors = [
        wrong(math(sum(head, inf(Ym, n + 1))), "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `$${A_INF}$ values at time ${n}, one year before its first payment.`, { probe: sumE(headE, infE(Y, n + 1)) }),
        wrong(math(sum(ax(Xm, aSym(n)), inf(Ym, n))), "TIMING_DUE_AS_IMMEDIATE", 0, "recognition", "The first block starts today.", { probe: sumE(axE(X, aExpr(n, i)), infE(Y, n)), confusedWith: "ann.immediate-vs-due" }),
        wrong(math(sum(head, inf(Ym, n, true))), "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${ADUE_INF}$ at time ${n} adds a payment at time ${n}, which is not made.`, { probe: sumE(headE, infE(Y, n, true)) }),
        wrong(math(sum(head, inf(Ym, n - 1))), "TIMING_MISSING_PERIOD", 2, "application", `That starts the ${amt(Y)} payments at time ${n}.`, { probe: sumE(headE, infE(Y, n - 1)) }),
        wrong(math(sum(head, inf(mamt(Y - X), n))), "CONC_ANN_LAYER_MIX", 1, "selection", `The ${amt(X)} payments stop; the second block is the full ${amt(Y)}.`, { probe: sumE(headE, infE(Y - X, n)) }),
      ];
      steps = [
        { concept: "ann.immediate-vs-due", reasoning: `First block: times 0 to ${n - 1} (annuity-due).` },
        { concept: "ann.stream-decomposition", reasoning: `Second block: end of year ${n + 1} is time ${n + 1}; nothing is paid at time ${n}.` },
        { concept: "ann.deferred-annuity", reasoning: `The perpetuity factor values the second block at time ${n}; discount ${n} years.` },
        { concept: "ann.annuity-value-date", reasoning: "Check each block's first payment date." },
      ];
    }
    const hard = level === 3;
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "value", expr: truth }], description: "Every payment valued term by term at the requested date (the perpetual tail as a geometric series); each option is evaluated and only the correct one agrees." },
      steps,
      conditions: ["Year-end payments unless stated; constant annual effective rate.", "Each payment is counted in exactly one block."],
      relationship: "Sequential: $X a_{\\overline{n}|} + Y v^n a_{\\overline{\\infty}|}$; layered: $X a_{\\overline{\\infty}|} + (Y - X) v^n a_{\\overline{\\infty}|}$.",
      counterexample: "If $X = Y$ the two pieces merge into one perpetuity and every correct form reduces to $X/i$.",
      transfer: {
        principle: "Draw the blocks on a timeline, mark where each factor leaves its value, then bring every block to one date.",
        unusual: hard ? "The valuation date or the payment timing changes between blocks." : "One stream is finite, the other perpetual.",
        misread: "The boundary payment is easily counted in both blocks or in neither.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["valuation-date", "mixed-timing"] : level === 2 ? (variant === 0 ? ["valuation-date"] : ["deferred", "indirect-wording"]) : ["deferred"],
      features: { multipleValuationDates: level >= 2, unfamiliar: level >= 2 },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { i, n, m, X, Y, Z, variant },
    });
  },
});

const streamStatements: ChoiceTemplate = conceptTemplate({
  id: "con-ann-stream-statements",
  family: "con-ann-streams",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.level_payment"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["concept_recognition", "financial_intuition", "validation"],
  soaConcept: "Relationships between finite annuities and perpetuities, judged as statements.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const I = lit(i);
    const d = i / (1 + i);
    const P = gridAmount(rng, 100, 5000, 50);
    const common = {
      conditions: ["Level payments at a constant annual effective rate $i > 0$."],
      relationship: "$a_{\\overline{n}|} = a_{\\overline{\\infty}|}(1 - v^n) = \\dfrac{1}{i} - \\dfrac{v^n}{i}$, $\\quad \\ddot{a}_{\\overline{\\infty}|} = 1 + a_{\\overline{\\infty}|}$",
      transfer: {
        principle: "A finite annuity is a perpetuity minus a deferred perpetuity; a perpetuity looks the same from every payment date.",
        unusual: "Finite and perpetual streams are compared.",
        misread: "Limits of present values do not carry over to accumulated values.",
      },
    };
    const baseSteps = [
      { concept: "ann.finite-vs-perpetual", reasoning: "$a_{\\overline{n}|}$ = perpetuity now less perpetuity deferred $n$ years." },
      { concept: "ann.perpetuity", reasoning: "Just after any payment, the remaining payments of a level perpetuity are again a perpetuity: worth $P/i$." },
    ];
    if (level === 2 && variant === 0) {
      const n = rng.int(5, 20);
      return statementQuestion({
        stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$${aSym(n)} = ${A_INF}\\,(1 - v^{${n}})$`, true, `The payments after time ${n} are a perpetuity deferred ${n} years, worth $v^{${n}}/i$.`, "TIMING_IGNORED_DEFERRAL", { check: { expr: aExpr(n, i), op: "=", than: `(1-${vPow(i, n)})/${I}` }, stage: 0, failure: "connection" }),
          statement("II", "$s_{\\overline{n}|}$ approaches $1/i$ as $n$ increases.", false, "$s_{\\overline{n}|} = ((1+i)^n - 1)/i$ grows without bound; it is $a_{\\overline{n}|}$ that approaches $1/i$.", "CONC_ANN_ACCUM_LIMIT", { stage: 1, failure: "interpretation", conditionTrue: "True of $a_{\\overline{n}|}$." }),
          statement("III", `$${ADUE_INF} - ${A_INF} = 1$`, true, "The perpetuity-due is the perpetuity-immediate plus the payment of 1 made today.", "RATE_DISCOUNT_AS_INTEREST", { check: { expr: `1/${lit(d)}-1/${I}`, op: "=", than: 1 }, stage: 1, failure: "connection" }),
        ],
        extra: [
          { keys: ["II"], misconception: "FORMULA_PERPETUITY_FOR_FINITE", why: "Treating finite and perpetual values as interchangeable rejects I and III.", stage: 0, failure: "selection" },
          { keys: [], misconception: "CONC_RELATED_TERM", why: "I and III are exact identities.", stage: 1, failure: "conclusion" },
        ],
        steps: [...baseSteps, { concept: "ann.immediate-vs-due", reasoning: "$1/d - 1/i = (1+i)/i - 1/i = 1$." }],
        ...common,
        presentation: ["direct"],
        features: { steps: 3, multiConcept: true },
        params: { i, n, variant, level },
      });
    }
    if (level === 2) {
      let n = rng.int(5, 40);
      for (let t = 0; t < 200 && Math.abs(Math.pow(1 + i, -n) - 0.5) < 0.06; t += 1) n = rng.int(5, 40);
      const more = Math.pow(1 + i, -n) < 0.5;
      const tail = (P / i) * Math.pow(1 + i, -n);
      const statements = [
        statement("I", `The annuity is worth more than half of the perpetuity.`, more, `The annuity is worth $(1 - v^{${n}})$ times the perpetuity, and $v^{${n}} = ${mnum(Math.pow(1 + i, -n), 4)}$.`, "FORMULA_PERPETUITY_FOR_FINITE", { check: { expr: `${lit(P)}*${aExpr(n, i)}`, op: ">", than: `0.5*${lit(P)}/${I}` }, stage: 0, failure: "conclusion", conditionTrue: more ? `False whenever $v^{${n}} > 1/2$.` : `True whenever $v^{${n}} < 1/2$.` }),
        statement("II", `The perpetuity's payments after year ${n} are worth ${num(tail, 2)} at time 0.`, true, `They form a perpetuity deferred ${n} years: $${mamt(P)}v^{${n}}/i$.`, "TIMING_DEFERRAL_OFF_BY_ONE", { check: { expr: perpFrom(P, n + 1, i), op: "=", than: lit(Number(tail.toFixed(2))), tol: 1e-4 }, stage: 1, failure: "application" }),
        statement("III", `Immediately after the payment at time ${n}, the perpetuity's remaining payments are worth what the whole perpetuity was worth at time 0.`, true, "The remaining payments are again a level perpetuity starting one year later.", "TIMING_VALUATION_DATE", { check: { expr: `${perpFrom(P, n + 1, i)}*${accPow(i, n)}`, op: "=", than: `${lit(P)}/${I}` }, stage: 2, failure: "interpretation" }),
      ];
      const truth = statements.filter((s) => s.truth).map((s) => s.key).join("");
      const flips = statements.map((s) => statements.filter((t) => (t.key === s.key ? !t.truth : t.truth)).map((t) => t.key).join(""));
      const pool: Array<["I" | "II" | "III", ...("I" | "II" | "III")[]] | []> = [["II"], ["III"], [], ["I"], ["I", "II", "III"], ["I", "II"], ["I", "III"], ["II", "III"]];
      const free = pool.filter((k) => k.join("") !== truth && !flips.includes(k.join(""))).slice(0, 2);
      const mis: MisconceptionId[] = ["CONC_ANN_PERP_INFINITE", "CONC_RELATED_TERM"];
      return statementQuestion({
        stem: `A perpetuity pays ${amt(P)} at the end of each year. An annuity pays ${amt(P)} at the end of each year for ${n} years. The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements,
        extra: free.map((k, idx) => ({ keys: k, misconception: mis[idx], why: idx === 0 ? "Treating the perpetuity as having no finite value makes every comparison with it unreliable." : "Each statement follows from writing the annuity as the perpetuity less its deferred tail.", stage: 0, failure: "conclusion" as ConceptFailure })),
        steps: [...baseSteps, { concept: "ann.deferred-annuity", reasoning: `The tail after year ${n} is worth $v^{${n}}$ times the perpetuity.` }],
        ...common,
        presentation: ["compare-streams"],
        features: { steps: 3, multiConcept: true },
        params: { i, n, P, variant, level },
      });
    }
    const n = rng.int(5, 20);
    if (variant === 0) {
      const Q = Number((P * (1 - Math.pow(1 + i, -n))).toFixed(2));
      const i2 = i + 0.01;
      return statementQuestion({
        stem: `Stream A pays ${amt(P)} at the end of each year for ${n} years. Stream B is a perpetuity paying ${amt(Q)} at the end of each year. The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", "A and B have the same present value.", true, `$${mamt(P)}\\,${aSym(n)} = ${mamt(P)}(1 - v^{${n}})/i$, and ${amt(Q)} $= ${mamt(P)}(1 - v^{${n}})$.`, "CONC_ANN_PERP_INFINITE", { check: { expr: `${lit(P)}*${aExpr(n, i)}`, op: "=", than: `${lit(Q)}/${I}`, tol: 1e-4 }, stage: 0, failure: "recognition" }),
          statement("II", `At time ${n}, the accumulated value of A's payments exceeds the value at time ${n} of all of B's payments, past and future.`, false, "Equal values at time 0 mean equal values at every date at the same rate.", "TIMING_VALUATION_DATE", { check: { expr: `${lit(P)}*${sExpr(n, i)}`, op: ">", than: `${lit(Q)}*${sExpr(n, i)}+${lit(Q)}/${I}`, tol: 1e-4 }, stage: 2, failure: "connection", conditionTrue: "It would follow only if A were worth more at time 0." }),
          statement("III", `If the interest rate rose to ${pc(i2)}, B's present value would fall by a larger percentage than A's.`, true, "B's payments extend forever, so more of its value sits far in the future, where rate changes bite hardest.", "CONC_DIRECTION_REVERSED", { check: { expr: `${I}/${lit(i2)}`, op: "<", than: `${aExpr(n, i2)}/${aExpr(n, i)}` }, stage: 2, failure: "conclusion" }),
        ],
        extra: [
          { keys: ["III"], misconception: "SEQ_UNDISCOUNTED_SUM", why: "Comparing undiscounted totals makes B look far larger, rejecting I.", stage: 0, failure: "selection" },
          { keys: ["II"], misconception: "FORMULA_PERPETUITY_FOR_FINITE", why: "Mixing finite and perpetual values rejects the equality and the sensitivity ranking.", stage: 1, failure: "selection" },
        ],
        steps: [
          ...baseSteps,
          { concept: "ann.annuity-identities", reasoning: `$${mamt(P)}\\,${aSym(n)} = ${mamt(P)}(1 - v^{${n}})/i$: a perpetuity of $${mamt(P)}(1 - v^{${n}})$.` },
          { concept: "tvm.equation-of-value", reasoning: "Equivalent at one date means equivalent at every date." },
        ],
        ...common,
        presentation: ["compare-streams", "hidden-structure"],
        features: { steps: 4, unfamiliar: true },
        modelingDecisions: 1,
        params: { i, n, P, Q, variant, level },
      });
    }
    return statementQuestion({
      stem: `An investor buys a perpetuity paying ${amt(P)} at the end of each year, at its present value at an annual effective rate of ${pc(i)}, and sells it immediately after receiving the ${n}th payment. Determine which of the following statements are true.`,
      statements: [
        statement("I", `At ${pc(i)}, the sale price is ${amt(P / i)}.`, true, "After the payment, the remaining payments are a perpetuity-immediate again: $P/i$.", "TIMING_VALUATION_DATE", { check: { expr: `${perpFrom(P, n + 1, i)}*${accPow(i, n)}`, op: "=", than: `${lit(P)}/${I}` }, stage: 1, failure: "interpretation", conditionTrue: `$${mamt(P)}v^{${n}}/i$ would be the value at time 0 of those payments.` }),
        statement("II", `If the sale price is calculated at ${pc(i)}, the investor's annual yield over the ${n} years is ${pc(i)}, whatever the value of ${n}.`, true, `Price $P/i$ equals the payments plus the sale price discounted at $i$: $P\\,a_{\\overline{${n}}|} + (P/i)v^{${n}} = P/i$.`, "CONC_RETURN_ON_WRONG_BASE", { check: { expr: `${lit(P)}*${aExpr(n, i)}+${lit(P)}/${I}*${vPow(i, n)}`, op: "=", than: `${lit(P)}/${I}` }, stage: 2, failure: "connection" }),
        statement("III", `If the sale price is calculated at a rate higher than ${pc(i)}, the investor receives more than ${amt(P / i)}.`, false, "A higher rate discounts the remaining payments more: the price falls.", "CONC_PRICE_YIELD_DIRECTION", { check: { expr: `${lit(P)}/${lit(i + 0.01)}`, op: ">", than: `${lit(P)}/${I}` }, stage: 2, failure: "conclusion", conditionTrue: "True if the rate were lower." }),
      ],
      extra: [
        { keys: ["III"], misconception: "CONC_ANN_PERP_VALUE_DATE", why: "Misplacing the date at which $P/i$ applies rejects I and II.", stage: 1, failure: "interpretation" },
        { keys: ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "Getting the direction of the price wrong flips III; misplacing the sale value rejects I.", stage: 2, failure: "conclusion" },
      ],
      steps: [
        ...baseSteps,
        { concept: "ann.deferred-annuity", reasoning: `The purchase price equals the first ${n} payments plus the remaining perpetuity deferred ${n} years.` },
        { concept: "tvm.equation-of-value", reasoning: "Selling at the same rate reproduces the purchase equation, so the yield is $i$." },
      ],
      ...common,
      presentation: ["valuation-date", "indirect-wording"],
      features: { steps: 4, unfamiliar: true, multipleValuationDates: true },
      modelingDecisions: 1,
      params: { i, n, P, variant, level },
    });
  },
});
// ================================================================ non-level and unconventional sequences

type Seg = [amount: number, from: number, to: number];
const timesText = (a: number, b: number): string => (a === b ? `time $${a}$` : `times $${seqList(a, 1, b)}$`);
const segsText = (segs: Seg[]): string => `Payments of ${segs.map((s) => `${amt(s[0])} at ${timesText(s[1], s[2])}`).join(", and ")}.`;
const segFlows = (segs: Seg[]) => segs.flatMap((s) => range(s[1], s[2]).map((t) => ({ t, amount: s[0] })));

const nonlevelMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-nonlevel-meaning",
  family: "con-ann-nonlevel",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.non_level",
  secondary: ["ANNUITIES.streams"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  reasoning: ["cashflow_modelling", "concept_recognition"],
  soaConcept: "Reading the non-level payment pattern behind a sum or difference of annuity symbols.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(8, 20);
    const m = rng.int(2, n - 4);
    const k = rng.int(1, n - m - 1);
    const accumulate = level === 2 && variant === 0;
    const at = accumulate ? n : 0;
    const val = (segs: Seg[]) => (accumulate ? avTerms(segFlows(segs), i, n) : pvTerms(segFlows(segs), i));
    let Elatex: string;
    let E: string;
    let cor: Seg[];
    let rows: Array<[Seg[], MisconceptionId, number, ConceptFailure, string]>;
    if (level === 1 && variant === 0) {
      Elatex = `${aSym(n)} + ${aSym(m)}`;
      E = `(${aExpr(n, i)} + ${aExpr(m, i)})`;
      cor = [[2, 1, m], [1, m + 1, n]];
      rows = [
        [[[1, 1, n - m], [2, n - m + 1, n]], "TRANS_INVERTED_RELATION", 1, "interpretation", `Both annuities start at time 1; the overlap is at the start, times 1 to ${m}.`],
        [[[1, 1, n], [1, n + 1, n + m]], "CONC_ANN_LAYER_MIX", 0, "selection", `$${aSym(m)}$ is not deferred: it runs alongside $${aSym(n)}$, not after it.`],
        [[[2, 1, m + 1], [1, m + 2, n]], "SEQ_TERM_COUNT", 1, "application", `$${aSym(m)}$ has ${m} payments, the last at time ${m}.`],
        [[[2, 1, n]], "MODEL_LEVEL_FOR_VARYING", 0, "recognition", `$${aSym(m)}$ stops at time ${m}.`],
        [[[2, 0, m - 1], [1, m, n - 1]], "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Both symbols are annuities-immediate: the first payment is at time 1."],
      ];
    } else if (level === 1) {
      Elatex = `2${aSym(n)} - ${aSym(m)}`;
      E = `(2*${aExpr(n, i)} - ${aExpr(m, i)})`;
      cor = [[1, 1, m], [2, m + 1, n]];
      rows = [
        [[[2, 1, m], [1, m + 1, n]], "TRANS_INVERTED_RELATION", 1, "interpretation", `Subtracting $${aSym(m)}$ reduces the early payments, times 1 to ${m}.`],
        [[[2, m + 1, n]], "CONC_ANN_LAYER_MIX", 0, "selection", `Only one of the two units is removed at times 1 to ${m}.`],
        [[[1, 1, m + 1], [2, m + 2, n]], "SEQ_TERM_COUNT", 1, "application", `$${aSym(m)}$ removes ${m} payments, the last at time ${m}.`],
        [[[1, 0, m - 1], [2, m, n - 1]], "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Both symbols are annuities-immediate: the first payment is at time 1."],
      ];
    } else if (accumulate) {
      Elatex = `${sSym(n)} + (1+i)^{${n - m}}\\,${sSym(m)}`;
      E = `(${sExpr(n, i)} + ${accPow(i, n - m)}*${sExpr(m, i)})`;
      cor = [[2, 1, m], [1, m + 1, n]];
      rows = [
        [[[1, 1, n - m], [2, n - m + 1, n]], "TIMING_VALUATION_DATE", 1, "interpretation", `$${sSym(m)}$ values payments at times 1 to ${m} at time ${m}; $(1+i)^{${n - m}}$ carries that value to time ${n}.`],
        [[[1, 1, n], [1, n + 1, n + m]], "CONC_ANN_LAYER_MIX", 0, "selection", `The second block runs alongside the first, ending at time ${m}.`],
        [[[2, 0, m - 1], [1, m, n - 1]], "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Immediate symbols: the payments are at times 1 to $n$."],
        [[[2, 1, m + 1], [1, m + 2, n]], "SEQ_TERM_COUNT", 1, "application", `$${sSym(m)}$ has ${m} payments.`],
        [[[2, 1, n]], "MODEL_LEVEL_FOR_VARYING", 0, "recognition", `The second term covers only ${m} payments.`],
      ];
    } else {
      Elatex = `${aSym(n)} + v^{${k}}\\,${aSym(m)}`;
      E = `(${aExpr(n, i)} + ${vPow(i, k)}*${aExpr(m, i)})`;
      cor = [[1, 1, k], [2, k + 1, k + m], [1, k + m + 1, n]];
      rows = [
        [[[1, 1, k - 1], [2, k, k + m - 1], [1, k + m, n]].filter((s) => s[1] <= s[2]) as Seg[], "TIMING_DEFERRAL_OFF_BY_ONE", 1, "application", `$v^{${k}}${aSym(m)}$ starts at time ${k + 1}, not ${k}.`],
        [[[2, 1, m], [1, m + 1, n]], "TIMING_IGNORED_DEFERRAL", 1, "interpretation", `The factor $v^{${k}}$ moves the extra payments ${k} years later.`],
        [[[1, 1, k], [2, k + 1, k + m + 1], [1, k + m + 2, n]].filter((s) => s[1] <= s[2]) as Seg[], "SEQ_TERM_COUNT", 1, "application", `$${aSym(m)}$ has ${m} payments.`],
        [[[1, 1, n], [1, n + k + 1, n + k + m]], "CONC_ANN_LAYER_MIX", 0, "selection", `The extra payments are deferred from time 0, not from the end of the first stream.`],
      ];
    }
    return conceptQuestion({
      stem: `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following has value $${Elatex}$ at time ${at}.`,
      correct: { content: segsText(cor), why: "Add the payments of each term year by year: the terms overlap rather than follow one another.", check: { expr: E, op: "=", than: val(cor) } },
      distractors: rows.map(([segs, mis, stage, failure, why]) => wrong(segsText(segs), mis, stage, failure, why, { check: { expr: E, op: "=", than: val(segs) } })),
      reference: { description: `Each described pattern is valued term by term at time ${at} and compared with the expression.` },
      steps: [
        { concept: "ann.stream-decomposition", reasoning: "Translate each term into payments: which times, which amounts." },
        { concept: "ann.annuity-value-date", reasoning: `Immediate symbols start one period after their own valuation date${accumulate ? "; $s$ values at its last payment" : ""}.` },
        { concept: level === 2 ? "ann.deferred-annuity" : "ann.annuity-identities", reasoning: level === 2 ? "A power of $v$ or $1+i$ moves a block along the timeline without changing its payments." : "Where the blocks overlap, the payments add." },
      ],
      conditions: ["Year-end payments; constant annual effective rate."],
      relationship: "$a_{\\overline{n}|} + a_{\\overline{m}|}$: 2 per year to time $m$, then 1 to time $n$; $v^k a_{\\overline{m}|}$: payments at times $k+1, \\ldots, k+m$.",
      counterexample: "If $m = n$ every form collapses to a level annuity of 2.",
      transfer: {
        principle: "Read sums of annuities as layers that start together unless a factor defers one of them.",
        unusual: "The pattern is hidden in the expression.",
        misread: "Sums of annuities are easily read as consecutive blocks.",
      },
      itemFormat: "interpretation",
      presentation: level === 2 ? ["hidden-structure", "valuation-date"] : ["direct"],
      features: { unfamiliar: level === 2, multipleValuationDates: accumulate },
      params: { i, n, m, k, variant },
    });
  },
});

const nonlevelEquation: ChoiceTemplate = conceptTemplate({
  id: "con-ann-nonlevel-equation",
  family: "con-ann-nonlevel",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.non_level",
  secondary: ["ANNUITIES.arithmetic", "ANNUITIES.perpetuities"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "relationships"],
  reasoning: ["cashflow_modelling", "formula_reconstruction", "formula_selection"],
  soaConcept: "Choosing the expression for an unconventional (pyramid, or increasing-then-level) payment sequence.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const I = lit(i);
    const d = i / (1 + i);
    const P = gridAmount(rng, 50, 1000, 50);
    const Pm = mamt(P);
    const hard = level === 3;
    const o = (latex: string, probe: string) => ({ latex, probe: `(${lit(P)}*${probe})` });
    let stem: string;
    let truth: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps: { concept: string; reasoning: string }[];
    if (variant === 0) {
      const k = rng.int(4, 10);
      truth = pvTerms(range(1, 2 * k - 1).map((t) => ({ t, amount: P * (t <= k ? t : 2 * k - t) })), i);
      stem = `Payments of ${amt(P)}, ${amt(2 * P)}, …, ${amt(k * P)} are made at the end of years 1 through ${k}, followed by ${amt((k - 1) * P)}, ${amt((k - 2) * P)}, …, ${amt(P)} at the end of years ${k + 1} through ${2 * k - 1}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const split = o(`${Pm}\\left[${IaSym(k)} + v^{${k}}\\,${DaSym(k - 1)}\\right]`, `(${IaE(k, i)}+${vPow(i, k)}*${DaE(k - 1, i)})`);
      const prod = o(`${Pm}\\,${aSym(k)}\\,${adueSym(k)}`, `(${aExpr(k, i)}*${adueExpr(k, i)})`);
      const c = hard ? prod : split;
      correct = { content: math(c.latex), probe: c.probe, why: hard ? `$${aSym(k)}\\,${adueSym(k)} = \\sum_{s=1}^{${k}}\\sum_{t=0}^{${k - 1}} v^{s+t}$: the number of ways to write each time as $s + t$ is $1, 2, \\ldots, ${k}, \\ldots, 2, 1$.` : `$${IaSym(k)}$ covers the rising payments; the falling ones, $${k - 1}, \\ldots, 1$, start at time ${k + 1}, so $${DaSym(k - 1)}$ is deferred ${k} years.` };
      const dd = (latex: string, probe: string, mis: MisconceptionId, stage: number, failure: ConceptFailure, why: string) => {
        const x = o(latex, probe);
        return wrong(math(x.latex), mis, stage, failure, why, { probe: x.probe });
      };
      distractors = [
        dd(`${Pm}\\left[${IaSym(k)} + v^{${k}}\\,${DaSym(k)}\\right]`, `(${IaE(k, i)}+${vPow(i, k)}*${DaE(k, i)})`, "CONC_DOUBLE_COUNTED", 1, "application", `$${DaSym(k)}$ deferred ${k} years pays ${k} again at time ${k + 1}: the peak is counted twice.`),
        dd(`${Pm}\\left[${IaSym(k)} + v^{${k - 1}}\\,${DaSym(k - 1)}\\right]`, `(${IaE(k, i)}+${vPow(i, k - 1)}*${DaE(k - 1, i)})`, "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `The falling payments start at time ${k + 1}, so the deferral is ${k} years.`),
        dd(`${Pm}\\left(${aSym(k)}\\right)^{2}`, `${aExpr(k, i)}**2`, "TIMING_DUE_AS_IMMEDIATE", 2, "connection", "$a\\cdot a$ places every payment one year too late."),
        dd(`${Pm}\\left(${adueSym(k)}\\right)^{2}`, `${adueExpr(k, i)}**2`, "TIMING_IMMEDIATE_AS_DUE", 2, "connection", "$\\ddot{a}\\cdot\\ddot{a}$ starts the pattern at time 0."),
        dd(`${Pm}\\left[${IaSym(k)} + ${DaSym(k - 1)}\\right]`, `(${IaE(k, i)}+${DaE(k - 1, i)})`, "TIMING_IGNORED_DEFERRAL", 1, "interpretation", "The falling payments begin after the rising ones end."),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Rising part $1, \\ldots, ${k}$ at times 1 to ${k}; falling part $${k - 1}, \\ldots, 1$ at times ${k + 1} to ${2 * k - 1}.` },
        { concept: "ann.arithmetic", reasoning: `$${IaSym(k)}$ values the rising part; $${DaSym(k - 1)}$ values the falling part at time ${k}.` },
        { concept: "ann.deferred-annuity", reasoning: `Discount the falling part ${k} years.` },
        ...(hard ? [{ concept: "ann.annuity-identities", reasoning: `The pyramid equals the product $${aSym(k)}\\,${adueSym(k)}$: multiplying the two series counts each time $s + t$ once per pair.` }] : []),
      ];
    } else {
      const n = rng.int(4, 12);
      truth = `(${pvTerms(range(1, n).map((t) => ({ t, amount: P * t })), i)} + ${perpFrom(n * P, n + 1, i)})`;
      stem = hard
        ? `A perpetuity pays ${amt(P)} at the end of year 1. Each year's payment is ${amt(P)} more than the previous year's until it reaches ${amt(n * P)}; thereafter it remains ${amt(n * P)}. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`
        : `Payments of ${amt(P)}, ${amt(2 * P)}, …, ${amt(n * P)} are made at the end of years 1 through ${n}, and payments of ${amt(n * P)} are made at the end of each year thereafter, forever. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      const split = o(`${Pm}\\left[${IaSym(n)} + ${n}v^{${n}}\\,${A_INF}\\right]`, `(${IaE(n, i)}+${n}*${vPow(i, n)}/${I})`);
      const prod = o(`${Pm}\\,${adueSym(n)}\\,${A_INF}`, `(${adueExpr(n, i)}/${I})`);
      const c = hard ? prod : split;
      correct = { content: math(c.latex), probe: c.probe, why: hard ? `Layer the stream: perpetuities of ${amt(P)} starting at times 1, 2, …, ${n}, worth $${Pm}(1 + v + \\cdots + v^{${n - 1}})/i = ${Pm}\\,${adueSym(n)}/i$.` : `$${IaSym(n)}$ covers years 1 to ${n}; the level ${amt(n * P)} from time ${n + 1} is a perpetuity valued at time ${n}.` };
      const dd = (latex: string, probe: string, mis: MisconceptionId, stage: number, failure: ConceptFailure, why: string) => {
        const x = o(latex, probe);
        return wrong(math(x.latex), mis, stage, failure, why, { probe: x.probe });
      };
      distractors = [
        dd(`${Pm}\\left[${IaSym(n)} + ${n}v^{${n + 1}}\\,${A_INF}\\right]`, `(${IaE(n, i)}+${n}*${vPow(i, n + 1)}/${I})`, "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `$${A_INF}$ already values the level part at time ${n}.`),
        dd(`${Pm}\\left[${IaSym(n)} + ${n}\\,${A_INF}\\right]`, `(${IaE(n, i)}+${n}/${I})`, "TIMING_IGNORED_DEFERRAL", 1, "interpretation", `The level payments start after year ${n}.`),
        dd(`${Pm}\\,(Ia)_{\\overline{\\infty}|}`, `(1/(${I}*${lit(d)}))`, "TRANS_IGNORED_CONDITION", 0, "interpretation", `The payments stop increasing at ${amt(n * P)}.`),
        dd(`${Pm}\\,${aSym(n)}\\,${A_INF}`, `(${aExpr(n, i)}/${I})`, "TIMING_DUE_AS_IMMEDIATE", 2, "connection", "The first layer starts at time 1, so it is not discounted: the layers sum to $\\ddot{a}$, not $a$."),
        dd(`${Pm}\\left[${IaSym(n)} + v^{${n}}\\,${A_INF}\\right]`, `(${IaE(n, i)}+${vPow(i, n)}/${I})`, "CONC_ANN_LAYER_MIX", 1, "application", `The level payments are ${amt(n * P)}, not ${amt(P)}.`),
        dd(`${Pm}\\,${adueSym(n)}\\,${ADUE_INF}`, `(${adueExpr(n, i)}/${lit(d)})`, "TIMING_IMMEDIATE_AS_DUE", 2, "connection", "That starts the pattern at time 0."),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Increasing part to time ${n}, level ${amt(n * P)} from time ${n + 1}.` },
        { concept: "ann.arithmetic", reasoning: `$${IaSym(n)}$ values the increasing part.` },
        { concept: "ann.deferred-annuity", reasoning: `The level part is a perpetuity valued at time ${n}: $${n}v^{${n}}/i$ per unit.` },
        ...(hard ? [{ concept: "ann.annuity-identities", reasoning: "Equivalently, layers of 1 starting at times $1, \\ldots, n$: $\\sum v^{s-1}/i = \\ddot{a}_{\\overline{n}|}/i$." }] : []),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "PV", expr: truth }], description: "Every payment discounted term by term (the perpetual tail as a geometric series); each option is evaluated and only the correct one agrees." },
      steps,
      conditions: ["Year-end payments; constant annual effective rate."],
      relationship: variant === 0 ? "$(Ia)_{\\overline{k}|} + v^k(Da)_{\\overline{k-1}|} = a_{\\overline{k}|}\\,\\ddot{a}_{\\overline{k}|}$" : "$(Ia)_{\\overline{n}|} + n v^n a_{\\overline{\\infty}|} = \\ddot{a}_{\\overline{n}|}\\,a_{\\overline{\\infty}|}$",
      counterexample: "For the smallest case ($k = 1$ or $n = 1$) the identity reduces to a single payment or a level perpetuity.",
      transfer: {
        principle: "Split a stream where its pattern changes, defer the later piece correctly, then look for a compact equivalent.",
        unusual: hard ? "The correct option is a compact product, not a sum of pieces." : "The pattern changes direction or stops increasing.",
        misread: "The turning-point payment is easily counted twice.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["hidden-structure", "indirect-wording"] : ["hidden-structure"],
      features: { unfamiliar: true },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { i, P, variant },
    });
  },
});

const nonlevelDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-ann-nonlevel-diagnosis",
  family: "con-ann-nonlevel",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.non_level",
  secondary: ["ANNUITIES.streams", "ANNUITIES.frequency_timing"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing"],
  reasoning: ["validation", "cashflow_modelling", "valuation_dates"],
  soaConcept: "Diagnosing an omitted, doubled or misplaced payment in a proposed valuation of a non-level stream.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const X = gridAmount(rng, 100, 1000, 50);
    const Y = X + gridAmount(rng, 50, 800, 50);
    const [Xm, Ym] = [X, Y].map(mamt);
    const ask = "Which of the following correctly describes the candidate's calculation?";
    const fix = (expr: string, truth: string) => ({ check: { expr, op: "=" as const, than: truth } });
    const L = (a: number, e: string) => `${lit(a)}*${e}`;
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let truth: string;
    let steps: { concept: string; reasoning: string }[];
    if (level === 1 && variant === 0) {
      const n = rng.int(3, 10);
      const m = n + rng.int(4, 12);
      truth = pvTerms(segFlows([[X, 1, n], [Y, n + 1, m]]), i);
      const W = `(${L(X, aExpr(n, i))}+${L(Y, `(${aExpr(m, i)}-${aExpr(n + 1, i)})`)})`;
      const Wv = X * an(n, i) + Y * (an(m, i) - an(n + 1, i));
      stem = `Payments of ${amt(X)} are made at the end of each year for ${n} years, followed by payments of ${amt(Y)} at the end of each year from year ${n + 1} through year ${m}. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Xm}\\,${aSym(n)} + ${Ym}\\left(${aSym(m)} - ${aSym(n + 1)}\\right) = ${mnum(Wv, 2)}.$$\n\n${ask}`;
      correct = { content: `The payment at time ${n + 1} is left out: subtract $${aSym(n)}$, not $${aSym(n + 1)}$.`, why: `The ${amt(Y)} payments run from time ${n + 1} to ${m}: $${aSym(m)} - ${aSym(n)}$.`, ...fix(`(${L(X, aExpr(n, i))}+${L(Y, `(${aExpr(m, i)}-${aExpr(n, i)})`)})`, truth) };
      distractors = [
        wrong(`The calculation is correct: the difference covers the payments from time ${n + 1} to time ${m}.`, "SEQ_TERM_COUNT", 1, "interpretation", `$${aSym(n + 1)}$ removes ${n + 1} payments, including the one at time ${n + 1}.`, fix(W, truth)),
        wrong(`The second term should be ${amt(Y)}$\\left(${aSym(m)} - ${aSym(n - 1)}\\right)$.`, "CONC_DOUBLE_COUNTED", 1, "application", `That adds a ${amt(Y)} payment at time ${n}, where ${amt(X)} is already paid.`, fix(`(${L(X, aExpr(n, i))}+${L(Y, `(${aExpr(m, i)}-${aExpr(n - 1, i)})`)})`, truth)),
        wrong(`The second term should be ${amt(Y)}$\\,v^{${n + 1}}${aSym(m - n)}$.`, "TIMING_DEFERRAL_OFF_BY_ONE", 2, "application", `That starts the ${amt(Y)} payments at time ${n + 2}.`, fix(`(${L(X, aExpr(n, i))}+${L(Y, `${vPow(i, n + 1)}*${aExpr(m - n, i)}`)})`, truth)),
        wrong(`The first term should be ${amt(X)}$\\,${adueSym(n)}$.`, "TIMING_IMMEDIATE_AS_DUE", 0, "recognition", "The first payments are at year-end; the first term is right.", fix(`(${L(X, adueExpr(n, i))}+${L(Y, `(${aExpr(m, i)}-${aExpr(n + 1, i)})`)})`, truth)),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Blocks: ${amt(X)} at times 1–${n}, ${amt(Y)} at times ${n + 1}–${m}.` },
        { concept: "ann.deferred-annuity", reasoning: `Payments at times ${n + 1} to ${m} are $${aSym(m)} - ${aSym(n)}$.` },
        { concept: "ann.annuity-value-date", reasoning: `The candidate subtracted one payment too many: the one at time ${n + 1}.` },
      ];
    } else if (level === 1) {
      const n = rng.int(3, 10);
      const m = n + rng.int(4, 12);
      truth = avTerms(segFlows([[X, 1, n], [Y, n + 1, m]]), i, m);
      const W = `(${L(X, `${sExpr(n, i)}*${accPow(i, m - n)}`)}+${L(Y, sExpr(m - n - 1, i))})`;
      const Wv = X * sn(n, i) * Math.pow(1 + i, m - n) + Y * sn(m - n - 1, i);
      stem = `Payments of ${amt(X)} are made at the end of each year for ${n} years, followed by payments of ${amt(Y)} at the end of each year from year ${n + 1} through year ${m}. The annual effective interest rate is ${pc(i)}. A candidate calculates the accumulated value at time ${m} as\n\n$$${Xm}\\,${sSym(n)}\\,(${fac(i)})^{${m - n}} + ${Ym}\\,${sSym(m - n - 1)} = ${mnum(Wv, 2)}.$$\n\n${ask}`;
      correct = { content: `The ${amt(Y)} payments number ${m - n}, not ${m - n - 1}: the second term should use $${sSym(m - n)}$.`, why: `Times ${n + 1} to ${m} inclusive are ${m - n} payments.`, ...fix(`(${L(X, `${sExpr(n, i)}*${accPow(i, m - n)}`)}+${L(Y, sExpr(m - n, i))})`, truth) };
      distractors = [
        wrong(`The calculation is correct: from year ${n + 1} through year ${m} is ${m - n - 1} years.`, "SEQ_TERM_COUNT", 0, "interpretation", "Counting inclusive endpoints gives one more payment.", fix(W, truth)),
        wrong(`The second term should use $${sSym(m - n + 1)}$.`, "CONC_DOUBLE_COUNTED", 1, "application", `That adds a ${amt(Y)} payment at time ${n}.`, fix(`(${L(X, `${sExpr(n, i)}*${accPow(i, m - n)}`)}+${L(Y, sExpr(m - n + 1, i))})`, truth)),
        wrong(`The first term should be accumulated for ${m - n - 1} years.`, "TIMING_MISSING_PERIOD", 2, "application", `From time ${n} to ${m} is ${m - n} years; the first term is right.`, fix(`(${L(X, `${sExpr(n, i)}*${accPow(i, m - n - 1)}`)}+${L(Y, sExpr(m - n - 1, i))})`, truth)),
        wrong(`The second term should use $${sdueSym(m - n - 1)}$.`, "TIMING_IMMEDIATE_AS_DUE", 1, "selection", `$${sdueSym(m - n - 1)}$ values the same ${m - n - 1} payments a year later; one payment is still missing.`, fix(`(${L(X, `${sExpr(n, i)}*${accPow(i, m - n)}`)}+${L(Y, sdueExpr(m - n - 1, i))})`, truth)),
        wrong(`The second term should use $${aSym(m - n)}$.`, "FORMULA_AV_FOR_PV", 2, "selection", `$${aSym(m - n)}$ is a value at time ${n}, not ${m}.`, fix(`(${L(X, `${sExpr(n, i)}*${accPow(i, m - n)}`)}+${L(Y, aExpr(m - n, i))})`, truth)),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `Blocks: ${amt(X)} at times 1–${n}, ${amt(Y)} at times ${n + 1}–${m}.` },
        { concept: "ann.annuity-value-date", reasoning: `$${sSym(n)}$ values the first block at time ${n}; accumulate ${m - n} years.` },
        { concept: "ann.annuity-identities", reasoning: `The second block has ${m - n} payments ending at time ${m}: $${sSym(m - n)}$.` },
      ];
    } else if (variant === 0) {
      const q = rng.int(3, 8);
      const N = 3 * q;
      const Q = gridAmount(rng, 200, 2000, 100);
      truth = pvTerms([...range(1, N).map((t) => ({ t, amount: X })), ...range(1, q).map((s) => ({ t: 3 * s, amount: Q }))], i);
      const W = `(${L(X, aExpr(N, i))}+${L(Q, `${aExpr(N, i)}/${aExpr(3, i)}`)})`;
      const Wv = X * an(N, i) + (Q * an(N, i)) / an(3, i);
      stem = `Payments of ${amt(X)} are made at the end of each year for ${N} years. In addition, a payment of ${amt(Q)} is made at the end of every third year (years 3, 6, …, ${N}). The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Xm}\\,${aSym(N)} + ${mamt(Q)}\\,\\dfrac{${aSym(N)}}{${aSym(3)}} = ${mnum(Wv, 2)}.$$\n\n${ask}`;
      correct = { content: `The extra payments fall at the end of each three-year block: divide by $${sSym(3)}$, not $${aSym(3)}$.`, why: `$1/${sSym(3)}$ per year accumulates to 1 at the end of each block; $1/${aSym(3)}$ corresponds to payments at the start of each block.`, ...fix(`(${L(X, aExpr(N, i))}+${L(Q, `${aExpr(N, i)}/${sExpr(3, i)}`)})`, truth) };
      distractors = [
        wrong("The calculation is correct: dividing by $a_{\\overline{3}|}$ spreads each extra payment over its three years.", "CONC_ANN_KYEAR_DIVISOR", 0, "selection", "Dividing by $a_{\\overline{3}|}$ values payments made at the start of each block.", fix(W, truth)),
        wrong(`The extra payments should be valued as ${amt(Q)}$\\,${aSym(q)}$.`, "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "selection", "That uses the annual rate for payments three years apart.", fix(`(${L(X, aExpr(N, i))}+${L(Q, aExpr(q, i))})`, truth)),
        wrong(`The extra payments should be valued as $\\tfrac{1}{3}$ of ${amt(Q)}$\\,${aSym(N)}$.`, "RATE_PAYMENT_FREQUENCY", 1, "application", "Spreading the amount evenly ignores interest within each block.", fix(`(${L(X, aExpr(N, i))}+${L(Q / 3, aExpr(N, i))})`, truth)),
        wrong(`The divisor should be $${sdueSym(3)}$.`, "TIMING_EXTRA_PERIOD", 2, "application", "$\\ddot{s}$ accumulates one year past the end of each block.", fix(`(${L(X, aExpr(N, i))}+${L(Q, `${aExpr(N, i)}/${sdueExpr(3, i)}`)})`, truth)),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: "Level annual payments plus a second stream every three years." },
        { concept: "ann.payment-frequency", reasoning: "Replace each payment of 1 at the end of a three-year block by $1/s_{\\overline{3}|}$ per year in that block." },
        { concept: "ann.annuity-value-date", reasoning: "So the extra stream is worth $Q\\,a_{\\overline{N}|}/s_{\\overline{3}|}$." },
      ];
    } else {
      const N = rng.int(8, 25);
      const k = rng.int(3, N - 2);
      truth = pvTerms([...range(1, N).map((t) => ({ t, amount: X })), { t: k, amount: X }], i);
      const W = `(${L(X, aExpr(N, i))}+${L(X, vPow(i, k - 1))})`;
      const Wv = X * an(N, i) + X * Math.pow(1 + i, -(k - 1));
      stem = `Payments of ${amt(X)} are made at the end of each year for ${N} years, except that the payment at the end of year ${k} is doubled. The annual effective interest rate is ${pc(i)}. A candidate calculates the present value as\n\n$$${Xm}\\,${aSym(N)} + ${Xm}\\,v^{${k - 1}} = ${mnum(Wv, 2)}.$$\n\n${ask}`;
      correct = { content: `The extra payment is at time ${k}, so it should be discounted ${k} years: use $v^{${k}}$.`, why: `The end of year ${k} is time ${k}.`, ...fix(`(${L(X, aExpr(N, i))}+${L(X, vPow(i, k))})`, truth) };
      distractors = [
        wrong(`The calculation is correct: the payment at the end of year ${k} is ${k - 1} years after the first.`, "TIMING_DEFERRAL_OFF_BY_ONE", 0, "interpretation", "Discounting is measured from time 0, not from the first payment.", fix(W, truth)),
        wrong(`The extra amount should be ${amt(X)}$\\,${aSym(k)}$.`, "CONC_ANN_LAYER_MIX", 1, "selection", `Only one payment is doubled, not the first ${k}.`, fix(`(${L(X, aExpr(N, i))}+${L(X, aExpr(k, i))})`, truth)),
        wrong(`The value should be ${amt(2 * X)}$\\,${aSym(N)}$.`, "MODEL_LEVEL_FOR_VARYING", 0, "recognition", "That doubles every payment.", fix(`${L(2 * X, aExpr(N, i))}`, truth)),
        wrong(`The extra payment should be discounted with $v^{${k + 1}}$.`, "TIMING_EXTRA_PERIOD", 2, "application", `The payment is at time ${k}, not ${k + 1}.`, fix(`(${L(X, aExpr(N, i))}+${L(X, vPow(i, k + 1))})`, truth)),
      ];
      steps = [
        { concept: "ann.stream-decomposition", reasoning: `A level annuity plus one extra payment of ${amt(X)} at time ${k}.` },
        { concept: "tvm.equation-of-value", reasoning: `A single payment at time ${k} is worth $Xv^{${k}}$ at time 0.` },
        { concept: "ann.annuity-value-date", reasoning: "The candidate discounted one year too few." },
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: "The payments valued term by term; each diagnosis's correction is applied and compared with that value." },
      steps,
      conditions: ["Year-end payments; constant annual effective rate.", "Each payment is counted exactly once."],
      relationship: "Value = sum over blocks, each block's factor placed at its own first or last payment date.",
      counterexample: "If both blocks paid the same amount, the stream would be a single level annuity and no boundary could be miscounted.",
      transfer: {
        principle: "Check every block of a proposed solution by its first payment, its last payment and its count.",
        unusual: "You judge a worked solution.",
        misread: "Inclusive date ranges contain one more payment than their difference.",
      },
      itemFormat: "error-diagnosis",
      presentation: level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { i, X, Y, variant },
    });
  },
});

// ================================================================ payment frequency and timing

const FREQ: Record<number, { noun: string; adv: string }> = { 2: { noun: "half-year", adv: "semiannually" }, 4: { noun: "quarter", adv: "quarterly" }, 12: { noun: "month", adv: "monthly" } };
/** i^(m) at annual effective i, as an expression. */
const imE = (i: number, m: number): string => `(${m}*(${accPow(i, 1 / m)}-1))`;

const freqMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-ann-freq-meaning",
  family: "con-ann-frequency",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["TVM.effective_nominal"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "rate_conversion"],
  reasoning: ["concept_recognition", "cashflow_modelling"],
  soaConcept: "What $a^{(m)}_{\\overline{n}|}$ and $a_{\\overline{n}|}/s_{\\overline{k}|}$ represent.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const PV = (flows: { t: number; amount: number }[]) => pvTerms(flows, i);
    const every = (amount: number, step: number, first: number, last: number) =>
      Array.from({ length: Math.round((last - first) / step) + 1 }, (_, q) => ({ t: first + q * step, amount }));
    if (variant === 0) {
      const m = rng.choice([2, 4, 12]);
      const n = rng.int(3, 15);
      const { noun } = FREQ[m];
      const E = level === 1 ? `((1-${vPow(i, n)})/${imE(i, m)})` : `(${lit(i)}/${imE(i, m)}*${aExpr(n, i)})`;
      const Elatex = level === 1 ? `a^{(${m})}_{\\overline{${n}}|}` : `\\dfrac{i}{i^{(${m})}}\\,${aSym(n)}`;
      const frac = `$\\tfrac{1}{${m}}$`;
      const im = m * (Math.pow(1 + i, 1 / m) - 1);
      const chk = (flows: { t: number; amount: number }[]) => ({ check: { expr: E, op: "=" as const, than: PV(flows) } });
      return conceptQuestion({
        stem: `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following has present value $${Elatex}$.`,
        correct: { content: `Payments of ${frac} at the end of each ${noun} for ${n} years.`, why: `The symbol pays a total of 1 a year in ${m} instalments of $1/${m}$, each at the end of its ${noun}.`, ...chk(every(1 / m, 1 / m, 1 / m, n)) },
        distractors: [
          wrong(`Payments of 1 at the end of each ${noun} for ${n} years.`, "CONC_ANN_MTHLY_PAYMENT_SIZE", 0, "interpretation", `That pays ${m} a year; the symbol pays 1 a year.`, chk(every(1, 1 / m, 1 / m, n))),
          wrong(`Payments of ${frac} at the beginning of each ${noun} for ${n} years.`, "TIMING_IMMEDIATE_AS_DUE", 1, "recognition", `That is $\\ddot{a}^{(${m})}_{\\overline{${n}}|}$.`, { ...chk(every(1 / m, 1 / m, 0, n - 1 / m)), confusedWith: "ann.immediate-vs-due" }),
          wrong(`Payments of 1 at the end of each year for ${n} years, at an annual effective rate equal to $i^{(${m})}$.`, "RATE_NOMINAL_AS_EFFECTIVE", 2, "connection", `$i^{(${m})}$ is a nominal rate; the symbol's denominator does not make it an effective rate for annual payments.`, { check: { expr: E, op: "=", than: aExpr(n, im) }, confusedWith: "tvm.nominal-vs-effective" }),
          wrong(`Payments of ${frac} at the end of each ${noun} for ${n} ${noun}s.`, "SEQ_TERM_COUNT", 1, "interpretation", `The term is ${n} years: ${m * n} payments.`, chk(every(1 / m, 1 / m, 1 / m, n / m))),
          wrong(`Payments of 1 at the end of each year for ${n} years.`, "CONC_RELATED_TERM", 0, "recognition", `That is $${aSym(n)}$, which is smaller because the payments come later.`, chk(every(1, 1, 1, n))),
        ],
        reference: { description: "Each described payment pattern is valued term by term at the stated rate and compared with the symbol's value." },
        steps: [
          { concept: "ann.payment-frequency", reasoning: `$a^{(${m})}_{\\overline{n}|}$ pays $1/${m}$ at the end of every ${noun}: 1 per year in total.` },
          { concept: "tvm.nominal-vs-effective", reasoning: `Its value is $(1 - v^n)/i^{(${m})}$, with $i^{(${m})}$ the nominal rate equivalent to $i$.` },
          { concept: "ann.annuity-value-date", reasoning: level === 2 ? `So $\\dfrac{i}{i^{(${m})}}a_{\\overline{n}|} = a^{(${m})}_{\\overline{n}|}$.` : "Immediate: each instalment at the end of its period." },
        ],
        conditions: ["Annual effective rate $i$; $i^{(m)}$ is the equivalent nominal rate."],
        relationship: "$a^{(m)}_{\\overline{n}|} = \\dfrac{1 - v^n}{i^{(m)}} = \\dfrac{i}{i^{(m)}}\\,a_{\\overline{n}|}$",
        counterexample: "With $m = 1$, $a^{(1)}_{\\overline{n}|} = a_{\\overline{n}|}$.",
        transfer: {
          principle: "Every standard symbol pays 1 per year; the superscript only splits it into instalments.",
          unusual: level === 2 ? "The symbol is disguised as a ratio times $a_{\\overline{n}|}$." : "The question is about payment size and timing, not a value.",
          misread: "“$m$ payments a year” tempts “1 each time”.",
        },
        itemFormat: "definition",
        presentation: level === 2 ? ["frequency", "hidden-structure"] : ["frequency"],
        features: { unfamiliar: level === 2 },
        params: { i, m, n, variant },
      });
    }
    const k = rng.int(2, 5);
    const q = rng.int(3, 8);
    const n = k * q;
    const atEnd = level === 1;
    const E = atEnd ? `(${aExpr(n, i)}/${sExpr(k, i)})` : `(${aExpr(n, i)}/${aExpr(k, i)})`;
    const Elatex = atEnd ? `\\dfrac{${aSym(n)}}{${sSym(k)}}` : `\\dfrac{${aSym(n)}}{${aSym(k)}}`;
    const chk = (flows: { t: number; amount: number }[]) => ({ check: { expr: E, op: "=" as const, than: PV(flows) } });
    const listT = (first: number, last: number) => `$${seqList(first, k, last)}$`;
    const endPay = `Payments of 1 at times ${listT(k, n)}.`;
    const startPay = `Payments of 1 at times ${listT(0, n - k)}.`;
    const corPay = atEnd ? endPay : startPay;
    const corFlows = atEnd ? every(1, k, k, n) : every(1, k, 0, n - k);
    return conceptQuestion({
      stem: `The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following has present value $${Elatex}$.`,
      correct: { content: corPay, why: atEnd ? `$1/${sSym(k)}$ a year for ${k} years accumulates to 1 at the end of each block, so $${aSym(n)}/${sSym(k)}$ values 1 at times ${k}, ${2 * k}, …, ${n}.` : `$1/${aSym(k)}$ a year for ${k} years is worth 1 at the start of each block, so $${aSym(n)}/${aSym(k)}$ values 1 at times 0, ${k}, …, ${n - k}.`, ...chk(corFlows) },
      distractors: [
        wrong(atEnd ? startPay : endPay, "CONC_ANN_KYEAR_DIVISOR", 1, "selection", atEnd ? `Dividing by $${sSym(k)}$ places each payment at the end of its block.` : `Dividing by $${aSym(k)}$ places each payment at the start of its block.`, chk(atEnd ? every(1, k, 0, n - k) : every(1, k, k, n))),
        wrong(`Payments of 1 at times $${seqList(atEnd ? 1 : 0, 1, atEnd ? q : q - 1)}$.`, "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "interpretation", `The ${q} payments are ${k} years apart, not one.`, chk(every(1, 1, atEnd ? 1 : 0, atEnd ? q : q - 1))),
        wrong(`Payments of $\\tfrac{1}{${k}}$ at times $${seqList(atEnd ? 1 : 0, 1, atEnd ? n : n - 1)}$.`, "RATE_PAYMENT_FREQUENCY", 2, "connection", "Spreading each payment evenly over its block ignores interest within the block.", chk(every(1 / k, 1, atEnd ? 1 : 0, atEnd ? n : n - 1))),
        wrong(`Payments of 1 at times ${atEnd ? listT(k, n - k) : listT(0, n)}.`, "SEQ_TERM_COUNT", 0, "interpretation", `There are ${q} payments over ${n} years.`, chk(atEnd ? every(1, k, k, n - k) : every(1, k, 0, n))),
      ],
      reference: { description: "Each described payment pattern is valued term by term and compared with the expression." },
      steps: [
        { concept: "ann.payment-frequency", reasoning: `Payments every ${k} years: replace each by level annual amounts within its block.` },
        { concept: "ann.annuity-value-date", reasoning: atEnd ? `A payment of 1 at the end of a block equals $1/${sSym(k)}$ a year in that block.` : `A payment of 1 at the start of a block equals $1/${aSym(k)}$ a year in that block.` },
        { concept: "ann.stream-decomposition", reasoning: `Over ${q} blocks these annual amounts form $${aSym(n)}$ times that constant.` },
      ],
      conditions: [`Annual effective rate; ${n} is a multiple of ${k}.`],
      relationship: "Payments of 1 every $k$ years for $n$ years: $\\dfrac{a_{\\overline{n}|}}{s_{\\overline{k}|}}$ (end of each block), $\\dfrac{a_{\\overline{n}|}}{a_{\\overline{k}|}}$ (start of each block).",
      counterexample: "With $k = 1$ both divisors equal 1 or $v$, and the end-of-block form is $a_{\\overline{n}|}$.",
      transfer: {
        principle: "Convert infrequent payments into equivalent annual payments inside each block.",
        unusual: "Payments are less frequent than interest conversion.",
        misread: "$a$ and $s$ in the divisor are easily swapped.",
      },
      itemFormat: "definition",
      presentation: level === 2 ? ["frequency", "hidden-structure"] : ["frequency"],
      features: { unfamiliar: level === 2 },
      params: { i, k, n, variant },
    });
  },
});

const freqRate: ChoiceTemplate = conceptTemplate({
  id: "con-ann-freq-rate",
  family: "con-ann-frequency",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["TVM.effective_nominal"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["rate_conversion", "equation_construction"],
  reasoning: ["formula_selection", "translation", "cashflow_modelling"],
  soaConcept: "Choosing the annuity expression when payment and interest-conversion frequencies differ.",
  variants: 2,
  generate(rng, level, variant) {
    const P = gridAmount(rng, 100, 3000, 50);
    const Pm = mamt(P);
    const hard = level === 3;
    let stem: string;
    let truth: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps: { concept: string; reasoning: string }[];
    const opt = (latex: string, probe: string, mis?: MisconceptionId, stage = 0, failure: ConceptFailure = "selection", why = "") =>
      mis ? wrong(math(latex), mis, stage, failure, why, { probe }) : { content: math(latex), probe, why };
    if (level === 1 && variant === 0) {
      const j = gridRate(rng, 0.003, 0.008, 0.0005);
      const r = 12 * j;
      const n = rng.int(5, 25);
      truth = pvLev(P, 1, 12 * n, j);
      stem = `Payments of ${amt(P)} are made at the end of each month for ${n} years. Interest is at a nominal annual rate of ${pc(r)} convertible monthly.\n\nDetermine which of the following is the present value of the payments.`;
      correct = opt(`${Pm}\\,${aSym(12 * n, lit(j))}`, `(${lit(P)}*${aExpr(12 * n, j)})`) as ConceptOption;
      correct.why = `The monthly rate is ${pc(r)}/12 = ${lit(j)}, and there are ${12 * n} monthly payments.`;
      distractors = [
        opt(`${Pm}\\,${aSym(12 * n, lit(r))}`, `(${lit(P)}*${aExpr(12 * n, r)})`, "RATE_ANNUAL_FOR_PERIODIC", 0, "application", "The annual rate is applied to each month."),
        opt(`${mamt(12 * P)}\\,${aSym(n, lit(r))}`, `(${lit(12 * P)}*${aExpr(n, r)})`, "RATE_NOMINAL_AS_EFFECTIVE", 1, "selection", "That treats the payments as annual and the nominal rate as effective."),
        opt(`${Pm}\\,${aSym(n, lit(j))}`, `(${lit(P)}*${aExpr(n, j)})`, "SEQ_TERM_COUNT", 1, "interpretation", `There are ${12 * n} payments, not ${n}.`),
        opt(`${Pm}\\,${adueSym(12 * n, lit(j))}`, `(${lit(P)}*${adueExpr(12 * n, j)})`, "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Payments are at the end of each month."),
      ] as ConceptOption[];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "Monthly payments: use the effective monthly rate and count months." },
        { concept: "tvm.nominal-vs-effective", reasoning: `$i^{(12)} = ${lit(r)}$ means ${lit(j)} per month.` },
        { concept: "ann.annuity-value-date", reasoning: "End-of-month payments: an annuity-immediate." },
      ];
    } else if (level === 1) {
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const n = rng.int(5, 20);
      truth = pvTerms(range(1, 12 * n).map((q) => ({ t: q / 12, amount: P })), i);
      const a12 = `((1-${vPow(i, n)})/${imE(i, 12)})`;
      stem = `Payments of ${amt(P)} are made at the end of each month for ${n} years. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${mamt(12 * P)}\\,a^{(12)}_{\\overline{${n}}|}`), probe: `(${lit(12 * P)}*${a12})`, why: `$a^{(12)}$ pays $1/12$ a month, so ${amt(12 * P)} of it pays ${amt(P)} a month.` };
      distractors = [
        opt(`${Pm}\\,a^{(12)}_{\\overline{${n}}|}`, `(${lit(P)}*${a12})`, "CONC_ANN_MTHLY_PAYMENT_SIZE", 0, "interpretation", "$a^{(12)}$ pays $1/12$ each month, so this pays only $P/12$."),
        opt(`${mamt(12 * P)}\\,${aSym(n)}`, `(${lit(12 * P)}*${aExpr(n, i)})`, "RATE_PAYMENT_FREQUENCY", 1, "selection", "That pays the year's total at year-end, ignoring interest within the year."),
        opt(`${mamt(12 * P)}\\,\\ddot{a}^{(12)}_{\\overline{${n}}|}`, `(${lit(12 * P)}*${a12}*${accPow(i, 1 / 12)})`, "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Payments are at the end of each month."),
        opt(`${Pm}\\,${aSym(12 * n)}`, `(${lit(P)}*${aExpr(12 * n, i)})`, "RATE_ANNUAL_FOR_PERIODIC", 1, "application", "That discounts each month at the annual rate."),
        opt(`${Pm}\\,${aSym(12 * n, `\\tfrac{${lit(i)}}{12}`)}`, `(${lit(P)}*${aExpr(12 * n, i / 12)})`, "RATE_DIVIDED_EFFECTIVE", 1, "application", "Dividing an effective annual rate by 12 does not give the effective monthly rate."),
      ] as ConceptOption[];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "$a^{(12)}_{\\overline{n}|}$ pays 1 per year in monthly instalments of $1/12$." },
        { concept: "tvm.nominal-vs-effective", reasoning: "Its value is $(1 - v^n)/i^{(12)}$ at the given annual effective rate." },
        { concept: "ann.annuity-value-date", reasoning: `Scale by ${amt(12 * P)} to pay ${amt(P)} a month.` },
      ];
    } else if (level === 2 && variant === 0) {
      const j = gridRate(rng, 0.003, 0.008, 0.0005);
      const r = 12 * j;
      const n = rng.int(5, 20);
      truth = pvTerms(range(1, 4 * n).map((q) => ({ t: 3 * q, amount: P })), j);
      const jq = `(1+${lit(j)})^{3} - 1`;
      const jqE = Math.pow(1 + j, 3) - 1;
      stem = `Payments of ${amt(P)} are made at the end of each quarter for ${n} years. Interest is at a nominal annual rate of ${pc(r)} convertible monthly.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${Pm}\\,${aSym(4 * n, jq)}`), probe: `(${lit(P)}*${aExpr(4 * n, jqE)})`, why: `The effective quarterly rate is three months of interest at ${lit(j)}: $(1+${lit(j)})^3 - 1$.` };
      distractors = [
        opt(`${Pm}\\,${aSym(4 * n, lit(r / 4))}`, `(${lit(P)}*${aExpr(4 * n, r / 4)})`, "RATE_NOMINAL_AS_EFFECTIVE", 0, "selection", "That treats the rate as convertible quarterly."),
        opt(`${Pm}\\,${aSym(4 * n, lit(j))}`, `(${lit(P)}*${aExpr(4 * n, j)})`, "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "application", "A monthly rate does not fit quarterly payments."),
        opt(`${Pm}\\,${aSym(4 * n, `(1+${lit(j)})^{4} - 1`)}`, `(${lit(P)}*${aExpr(4 * n, Math.pow(1 + j, 4) - 1)})`, "ALG_ROOT_ERROR", 1, "application", "A quarter is three months, not four."),
        opt(`${Pm}\\,${adueSym(4 * n, jq)}`, `(${lit(P)}*${adueExpr(4 * n, jqE)})`, "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Payments are at the end of each quarter."),
        opt(`${Pm}\\,${aSym(n, jq)}`, `(${lit(P)}*${aExpr(n, jqE)})`, "SEQ_TERM_COUNT", 2, "interpretation", `There are ${4 * n} quarterly payments.`),
      ] as ConceptOption[];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "Quarterly payments: use the effective quarterly rate and count quarters." },
        { concept: "tvm.nominal-vs-effective", reasoning: `Monthly rate ${lit(j)}; a quarter compounds three months.` },
        { concept: "ann.annuity-value-date", reasoning: "End-of-quarter payments: an annuity-immediate." },
      ];
    } else if (level === 2) {
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const q = rng.int(3, 10);
      const n = 2 * q;
      truth = pvTerms(range(1, q).map((s) => ({ t: 2 * s, amount: P })), i);
      stem = `Payments of ${amt(P)} are made at the end of every two years for ${n} years. The annual effective interest rate is ${pc(i)}.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${Pm}\\,\\dfrac{${aSym(n)}}{${sSym(2)}}`), probe: `(${lit(P)}*${aExpr(n, i)}/${sExpr(2, i)})`, why: "Each payment at the end of a two-year block equals $1/s_{\\overline{2}|}$ a year in that block." };
      distractors = [
        opt(`${Pm}\\,\\dfrac{${aSym(n)}}{${aSym(2)}}`, `(${lit(P)}*${aExpr(n, i)}/${aExpr(2, i)})`, "CONC_ANN_KYEAR_DIVISOR", 1, "selection", "Dividing by $a_{\\overline{2}|}$ values payments at the start of each block."),
        opt(`${Pm}\\,${aSym(q)}`, `(${lit(P)}*${aExpr(q, i)})`, "CONC_ANN_RATE_PERIOD_MISMATCH", 0, "selection", "That uses the annual rate for payments two years apart."),
        opt(`\\dfrac{${Pm}}{2}\\,${aSym(n)}`, `(${lit(P / 2)}*${aExpr(n, i)})`, "RATE_PAYMENT_FREQUENCY", 1, "application", "Spreading each payment evenly ignores interest within the block."),
        opt(`${Pm}\\,${aSym(q, lit(2 * i))}`, `(${lit(P)}*${aExpr(q, 2 * i)})`, "MODEL_COMPOUND_AS_SIMPLE", 1, "application", "The two-year rate is $(1+i)^2 - 1$, not $2i$."),
        opt(`${Pm}\\,\\dfrac{${sSym(n)}}{${sSym(2)}}`, `(${lit(P)}*${sExpr(n, i)}/${sExpr(2, i)})`, "FORMULA_AV_FOR_PV", 2, "selection", `That is the value at time ${n}.`),
      ] as ConceptOption[];
      steps = [
        { concept: "ann.payment-frequency", reasoning: "Payments every two years: convert each into level annual amounts within its block." },
        { concept: "ann.annuity-value-date", reasoning: "A payment at the end of a block equals $1/s_{\\overline{2}|}$ a year." },
        { concept: "ann.stream-decomposition", reasoning: `Those annual amounts run for ${n} years: $${aSym(n)}/${sSym(2)}$.` },
      ];
    } else if (variant === 0) {
      const h = gridRate(rng, 0.015, 0.04, 0.005);
      const r = 2 * h;
      const n = rng.int(3, 12);
      const k = rng.int(2, 6);
      truth = pvTerms(range(0, 4 * n - 1).map((q) => ({ t: 2 * k + q / 2, amount: P })), h);
      const jq = `(1+${lit(h)})^{1/2} - 1`;
      const jqE = Math.sqrt(1 + h) - 1;
      const defer = (e: number) => `(1+${lit(h)})^{-${e}}`;
      const deferE = (e: number) => accPow(h, -e);
      stem = `Payments of ${amt(P)} are made at the beginning of each quarter for ${n} years, the first payment ${k} years from now. Interest is at a nominal annual rate of ${pc(r)} convertible semiannually.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${Pm}\\,${defer(2 * k)}\\,${adueSym(4 * n, jq)}`), probe: `(${lit(P)}*${deferE(2 * k)}*${adueExpr(4 * n, jqE)})`, why: `Quarterly rate $(1+${lit(h)})^{1/2} - 1$; $\\ddot{a}$ values the payments at their first date, time ${k} = ${2 * k} half-years, which is then discounted.` };
      distractors = [
        opt(`${Pm}\\,${defer(2 * k)}\\,${aSym(4 * n, jq)}`, `(${lit(P)}*${deferE(2 * k)}*${aExpr(4 * n, jqE)})`, "TIMING_DUE_AS_IMMEDIATE", 2, "application", "Payments are at the beginning of each quarter."),
        opt(`${Pm}\\,${defer(2 * k)}\\,${adueSym(4 * n, lit(r / 4))}`, `(${lit(P)}*${deferE(2 * k)}*${adueExpr(4 * n, r / 4)})`, "RATE_NOMINAL_AS_EFFECTIVE", 0, "selection", "That treats the rate as convertible quarterly."),
        opt(`${Pm}\\,${defer(k)}\\,${adueSym(4 * n, jq)}`, `(${lit(P)}*${deferE(k)}*${adueExpr(4 * n, jqE)})`, "TIMING_MISSING_PERIOD", 2, "application", `${k} years is ${2 * k} half-years of discount, not ${k}.`),
        opt(`${Pm}\\,${defer(2 * k)}\\,${adueSym(4 * n, `(1+${lit(h)})^{2} - 1`)}`, `(${lit(P)}*${deferE(2 * k)}*${adueExpr(4 * n, Math.pow(1 + h, 2) - 1)})`, "ALG_ROOT_ERROR", 1, "application", "A quarter is half of a half-year: the power is 1/2, not 2."),
        opt(`${Pm}\\,${defer(2 * k)}\\,${adueSym(4 * n, lit(h))}`, `(${lit(P)}*${deferE(2 * k)}*${adueExpr(4 * n, h)})`, "CONC_ANN_RATE_PERIOD_MISMATCH", 1, "application", "A half-year rate does not fit quarterly payments."),
      ] as ConceptOption[];
      steps = [
        { concept: "tvm.nominal-vs-effective", reasoning: `$i^{(2)} = ${lit(r)}$: ${lit(h)} per half-year.` },
        { concept: "ann.payment-frequency", reasoning: "Quarterly payments need the effective quarterly rate $(1 + h)^{1/2} - 1$." },
        { concept: "ann.immediate-vs-due", reasoning: `Beginning-of-quarter payments, first at time ${k}: $\\ddot{a}$ values them at time ${k}.` },
        { concept: "ann.deferred-annuity", reasoning: `Discount ${k} years, i.e. ${2 * k} half-years.` },
      ];
    } else {
      const jq = gridRate(rng, 0.01, 0.02, 0.0025);
      const r = 4 * jq;
      const q = rng.int(3, 10);
      const n = 2 * q;
      truth = pvTerms(range(1, q).map((s) => ({ t: 8 * s, amount: P })), jq);
      const j2 = `(1+${lit(jq)})^{8} - 1`;
      const j2E = Math.pow(1 + jq, 8) - 1;
      stem = `Payments of ${amt(P)} are made at the end of every two years for ${n} years. Interest is at a nominal annual rate of ${pc(r)} convertible quarterly.\n\nDetermine which of the following is the present value of the payments.`;
      correct = { content: math(`${Pm}\\,${aSym(q, j2)}`), probe: `(${lit(P)}*${aExpr(q, j2E)})`, why: `Two years are eight quarters: the effective rate per payment period is $(1+${lit(jq)})^8 - 1$, and there are ${q} payments.` };
      distractors = [
        opt(`${Pm}\\,${aSym(q, `(1+${lit(jq)})^{4} - 1`)}`, `(${lit(P)}*${aExpr(q, Math.pow(1 + jq, 4) - 1)})`, "ALG_ROOT_ERROR", 1, "application", "That is the annual effective rate; the payment period is two years."),
        opt(`${Pm}\\,${adueSym(q, j2)}`, `(${lit(P)}*${adueExpr(q, j2E)})`, "TIMING_IMMEDIATE_AS_DUE", 2, "application", "The first payment is at the end of two years."),
        opt(`${Pm}\\,${aSym(q, lit(jq))}`, `(${lit(P)}*${aExpr(q, jq)})`, "CONC_ANN_RATE_PERIOD_MISMATCH", 0, "selection", "A quarterly rate does not fit payments two years apart."),
        opt(`${Pm}\\,${aSym(q, lit(2 * r))}`, `(${lit(P)}*${aExpr(q, 2 * r)})`, "MODEL_COMPOUND_AS_SIMPLE", 1, "application", "Doubling the nominal rate ignores compounding."),
        opt(`${Pm}\\,${aSym(q, lit(r))}`, `(${lit(P)}*${aExpr(q, r)})`, "RATE_NOMINAL_AS_EFFECTIVE", 0, "selection", "A nominal annual rate is neither annual effective nor per two years."),
        opt(`${Pm}\\,${aSym(n, j2)}`, `(${lit(P)}*${aExpr(n, j2E)})`, "SEQ_TERM_COUNT", 2, "interpretation", `There are ${q} payments, not ${n}.`),
      ] as ConceptOption[];
      steps = [
        { concept: "tvm.nominal-vs-effective", reasoning: `$i^{(4)} = ${lit(r)}$: ${lit(jq)} per quarter.` },
        { concept: "ann.payment-frequency", reasoning: "Payments every two years: compound eight quarters." },
        { concept: "ann.annuity-value-date", reasoning: `${q} payments, the first one payment period from now: an annuity-immediate.` },
        { concept: "ann.stream-decomposition", reasoning: "Count payments, not years or quarters." },
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "PV", expr: truth }], description: "Every payment discounted term by term at the interest-conversion rate; each option is evaluated and only the correct one agrees." },
      steps,
      conditions: ["Rates are converted to the effective rate per payment period.", "Payments are counted, not years."],
      relationship: "$PV = P\\,a_{\\overline{N}|j}$ with $N$ = number of payments and $j$ = effective rate per payment period.",
      counterexample: "If payments and conversion coincide (e.g. monthly payments with $i^{(12)}$), $j = i^{(m)}/m$ directly.",
      transfer: {
        principle: "First fix the payment period; then convert the rate to it and count the payments.",
        unusual: hard ? "Three timing features (frequency, conversion, start) must be reconciled." : "Payment and conversion frequencies differ.",
        misread: "A nominal rate's divisor is its conversion frequency, not the payment frequency.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["frequency", "indirect-wording", ...(variant === 0 ? (["deferred"] as const) : [])] : ["frequency"],
      features: { unfamiliar: level >= 2, multipleValuationDates: hard && variant === 0 },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { P, variant },
    });
  },
});

const freqStatements: ChoiceTemplate = conceptTemplate({
  id: "con-ann-freq-statements",
  family: "con-ann-frequency",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["TVM.effective_nominal", "LOANS.amortization"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "rate_conversion"],
  reasoning: ["concept_recognition", "financial_intuition", "validation"],
  soaConcept: "Relationships among annuities payable more or less frequently than interest is converted.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const I = lit(i);
    const common = {
      conditions: ["Constant annual effective rate $i > 0$ (or an equivalent nominal rate)."],
      relationship: "$a^{(m)}_{\\overline{n}|} = \\dfrac{i}{i^{(m)}}a_{\\overline{n}|}, \\quad \\ddot{a}^{(m)}_{\\overline{n}|} = (1+i)^{1/m}a^{(m)}_{\\overline{n}|}, \\quad \\text{every } k \\text{ years: } \\dfrac{a_{\\overline{n}|}}{s_{\\overline{k}|}}$",
      transfer: {
        principle: "Compare streams by when their money arrives; convert rates to the payment period before comparing.",
        unusual: "Frequency, timing and rate conversion are judged together.",
        misread: "The due adjustment for $m$-thly payments is one $m$-th of a year, not a year.",
      },
    };
    if (level === 2 && variant === 0) {
      const m = rng.choice([2, 4, 12]);
      const n = rng.int(3, 15);
      const am = `((1-${vPow(i, n)})/${imE(i, m)})`;
      const smExplicit = avTerms(range(1, m * n).map((q) => ({ t: q / m, amount: 1 / m })), i, n);
      return statementQuestion({
        stem: `The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$a^{(${m})}_{\\overline{${n}}|} > ${aSym(n)}$`, true, "The same annual total is paid in instalments, on average earlier in each year.", "CONC_DIRECTION_REVERSED", { check: { expr: am, op: ">", than: aExpr(n, i) }, stage: 0, failure: "conclusion" }),
          statement("II", `$\\ddot{a}^{(${m})}_{\\overline{${n}}|} = (1+i)\\,a^{(${m})}_{\\overline{${n}}|}$`, false, `Each instalment moves earlier by $1/${m}$ of a year, so the factor is $(1+i)^{1/${m}}$.`, "RATE_ANNUAL_FOR_PERIODIC", { check: { expr: `${am}*${accPow(i, 1 / m)}`, op: "=", than: `${am}*${onePlusE(i)}` }, stage: 1, failure: "application", conditionTrue: "True for annual payments ($m = 1$)." }),
          statement("III", `$s^{(${m})}_{\\overline{${n}}|} = \\dfrac{i}{i^{(${m})}}\\,${sSym(n)}$`, true, "Accumulating both sides of the present-value identity by $(1+i)^n$.", "CONC_ANN_MTHLY_PAYMENT_SIZE", { check: { expr: smExplicit, op: "=", than: `${I}/${imE(i, m)}*${sExpr(n, i)}` }, stage: 1, failure: "connection" }),
        ],
        extra: [
          { keys: ["II"], misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "Treating $i^{(m)}$ as if it were $i$ makes I and III look false and II look plausible.", stage: 0, failure: "selection" },
          { keys: [], misconception: "CONC_RELATED_TERM", why: "I and III hold for every $n$ and $i > 0$.", stage: 1, failure: "conclusion" },
        ],
        steps: [
          { concept: "ann.payment-frequency", reasoning: `$a^{(${m})}$ pays $1/${m}$ at the end of each $1/${m}$ year; its value is $(i/i^{(${m})})a_{\\overline{n}|}$.` },
          { concept: "tvm.nominal-vs-effective", reasoning: `$i^{(${m})} < i$, so $i/i^{(${m})} > 1$.` },
          { concept: "ann.immediate-vs-due", reasoning: `The due version is one $1/${m}$-year earlier: factor $(1+i)^{1/${m}}$.` },
        ],
        ...common,
        presentation: ["frequency"],
        features: { steps: 3, multiConcept: true },
        params: { i, m, n, variant, level },
      });
    }
    if (level === 2) {
      const k = rng.int(2, 5);
      const q = rng.int(3, 8);
      const n = k * q;
      const PV = pvTerms(range(1, q).map((s) => ({ t: k * s, amount: 1 })), i);
      return statementQuestion({
        stem: `Payments of 1 are made at the end of every ${k} years for ${n} years. The annual effective interest rate is ${pc(i)}. Let $PV$ be the present value of the payments. Determine which of the following statements are true.`,
        statements: [
          statement("I", `$PV = \\dfrac{${aSym(n)}}{${sSym(k)}}$`, true, `Each payment equals $1/${sSym(k)}$ a year within its ${k}-year block.`, "CONC_ANN_KYEAR_DIVISOR", { check: { expr: PV, op: "=", than: `${aExpr(n, i)}/${sExpr(k, i)}` }, stage: 0, failure: "selection", conditionTrue: `With $${aSym(k)}$ in the denominator it would value payments at the start of each block.` }),
          statement("II", `$PV = a_{\\overline{${q}}|\\,j}$, where $j = (1+i)^{${k}} - 1$`, true, `There are ${q} payments, one per ${k}-year period, at the ${k}-year effective rate.`, "CONC_ANN_RATE_PERIOD_MISMATCH", { check: { expr: PV, op: "=", than: aExpr(q, Math.pow(1 + i, k) - 1) }, stage: 1, failure: "connection" }),
          statement("III", `$PV > \\dfrac{${aSym(n)}}{${k}}$`, false, `$${aSym(n)}/${k}$ pays $1/${k}$ every year — the same total, received earlier on average — so it is worth more.`, "CONC_DIRECTION_REVERSED", { check: { expr: PV, op: ">", than: `${aExpr(n, i)}/${k}` }, stage: 2, failure: "conclusion", conditionTrue: "Equality holds only at $i = 0$." }),
        ],
        extra: [
          { keys: ["II", "III"], misconception: "RATE_PAYMENT_FREQUENCY", why: "Spreading each payment evenly over its block overstates its value and hides the identity in I.", stage: 1, failure: "application" },
          { keys: ["III"], misconception: "MODEL_COMPOUND_AS_SIMPLE", why: `Using ${k}$i$ as the ${k}-year rate breaks I and II.`, stage: 1, failure: "selection" },
        ],
        steps: [
          { concept: "ann.payment-frequency", reasoning: `Payments every ${k} years: either convert the rate to a ${k}-year rate or each payment to annual amounts.` },
          { concept: "ann.annuity-value-date", reasoning: `A payment at the end of a block equals $1/${sSym(k)}$ a year.` },
          { concept: "ann.stream-decomposition", reasoning: "Compare with $1/k$ a year: the same total paid earlier." },
        ],
        ...common,
        presentation: ["frequency"],
        features: { steps: 3, multiConcept: true },
        params: { i, k, n, variant, level },
      });
    }
    const n = rng.int(5, 25);
    if (variant === 0) {
      const j = gridRate(rng, 0.003, 0.008, 0.0005);
      const r = 12 * j;
      const ie = Math.pow(1 + j, 12) - 1;
      const L = gridAmount(rng, 50000, 400000, 10000);
      const k = rng.int(1, n - 1);
      const XM = `(${lit(L)}/${aExpr(12 * n, j)})`;
      const XA = `(${lit(L)}/${aExpr(n, ie)})`;
      return statementQuestion({
        stem: `Loan M, of ${amt(L)}, is repaid by level payments at the end of each month for ${n} years at a nominal annual rate of ${pc(r)} convertible monthly. Loan A, also of ${amt(L)}, is repaid by level payments at the end of each year for ${n} years at the equivalent annual effective rate. Determine which of the following statements are true.`,
        statements: [
          statement("I", "Twelve times Loan M's monthly payment is less than Loan A's annual payment.", true, "Loan M's payments arrive earlier within each year, so less in total is needed each year.", "RATE_PAYMENT_FREQUENCY", { check: { expr: `12*${XM}`, op: "<", than: XA }, stage: 1, failure: "application", conditionTrue: "They would be equal only at a zero rate." }),
          statement("II", `Immediately after the payments due at the end of year ${k}, the two loans have the same outstanding balance.`, true, `At an equivalent rate both balances equal $${mamt(L)}\\dfrac{1 - v^{${n - k}}}{1 - v^{${n}}}$: each is the loan less the repaid share.`, "CONC_DIRECTION_REVERSED", { check: { expr: `${XM}*${aExpr(12 * (n - k), j)}`, op: "=", than: `${XA}*${aExpr(n - k, ie)}` }, stage: 2, failure: "connection" }),
          statement("III", "The total interest paid on Loan M exceeds the total interest paid on Loan A.", false, "Loan M repays principal earlier within each year, so it pays less interest overall.", "MODEL_INTEREST_ON_ORIGINAL", { check: { expr: `${12 * n}*${XM}-${lit(L)}`, op: ">", than: `${n}*${XA}-${lit(L)}` }, stage: 2, failure: "conclusion" }),
        ],
        extra: [
          { keys: ["III"], misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "Treating the two rates as different (nominal versus effective) undermines both comparisons in I and II.", stage: 0, failure: "recognition" },
          { keys: [], misconception: "CONC_RELATED_TERM", why: "I and II follow from the equivalence of the two rates.", stage: 1, failure: "conclusion" },
        ],
        steps: [
          { concept: "tvm.nominal-vs-effective", reasoning: `$1 + i = (1 + ${lit(j)})^{12}$: the two loans use equivalent rates.` },
          { concept: "ann.payment-frequency", reasoning: "Monthly instalments within the year are worth more than one year-end payment of the same total." },
          { concept: "loan.balance-prospective-retrospective", reasoning: "At a year-end, each balance is $L(1 - v^{n-k})/(1 - v^n)$ — the frequency cancels." },
          { concept: "loan.interest-principal-split", reasoning: "Total interest = total payments − principal." },
        ],
        ...common,
        presentation: ["compare-streams", "combined-topics"],
        features: { steps: 4, unfamiliar: true, multiConcept: true },
        modelingDecisions: 1,
        params: { i: ie, n, L, k, variant, level },
      });
    }
    const a4 = `((1-${vPow(i, n)})/${imE(i, 4)})`;
    const B = pvTerms(range(1, n).map((t) => ({ t: t - 0.5, amount: 1 })), i);
    return statementQuestion({
      stem: `Annuity A pays $\\tfrac{1}{4}$ at the end of each quarter for ${n} years. Annuity B pays 1 at the middle of each year for ${n} years. The annual effective interest rate is ${pc(i)}. Determine which of the following statements are true.`,
      statements: [
        statement("I", `A is worth more than $${aSym(n)}$.`, true, "A pays the same annual total as $a_{\\overline{n}|}$, but earlier within each year.", "CONC_DIRECTION_REVERSED", { check: { expr: a4, op: ">", than: aExpr(n, i) }, stage: 0, failure: "conclusion" }),
        statement("II", `B is worth $(1+i)^{1/2}\\,${aSym(n)}$.`, true, "Every payment of B is half a year earlier than in $a_{\\overline{n}|}$.", "MODEL_COMPOUND_AS_SIMPLE", { check: { expr: B, op: "=", than: `${accPow(i, 0.5)}*${aExpr(n, i)}` }, stage: 1, failure: "application", conditionTrue: "$(1 + i/2)a_{\\overline{n}|}$ would apply only under simple interest within the year." }),
        statement("III", "A is worth more than B.", false, "Within each year A's payments arrive, on average, at 0.625 of the year; B's at 0.5. B's money comes earlier.", "CONC_ANN_FREQUENCY_ALWAYS_BETTER", { check: { expr: a4, op: ">", than: B }, stage: 2, failure: "conclusion", conditionTrue: "It would hold if B paid at the end of each year." }),
      ],
      extra: [
        { keys: ["III"], misconception: "TIMING_DUE_AS_IMMEDIATE", why: "Misplacing B's payments at year-end makes A look better and II look wrong.", stage: 1, failure: "interpretation" },
        { keys: ["I", "III"], misconception: "RATE_PAYMENT_FREQUENCY", why: "Judging by the number of instalments rather than their timing accepts III and doubts II.", stage: 2, failure: "selection" },
      ],
      steps: [
        { concept: "ann.payment-frequency", reasoning: "A: $a^{(4)}_{\\overline{n}|} = (i/i^{(4)})a_{\\overline{n}|}$." },
        { concept: "ann.annuity-value-date", reasoning: "B: each payment half a year earlier than in $a_{\\overline{n}|}$, factor $(1+i)^{1/2}$." },
        { concept: "tvm.nominal-vs-effective", reasoning: "Compare $i/i^{(4)}$ with $(1+i)^{1/2}$: the first is smaller for $i > 0$." },
        { concept: "ann.stream-decomposition", reasoning: "Equivalently, compare average payment times within the year: 0.625 versus 0.5." },
      ],
      ...common,
      presentation: ["compare-streams", "frequency"],
      features: { steps: 4, unfamiliar: true },
      modelingDecisions: 1,
      params: { i, n, variant, level },
    });
  },
});

// ================================================================ cross-topic: loan balance as an annuity value

const loanBalance: ChoiceTemplate = conceptTemplate({
  id: "con-ann-loan-balance",
  family: "con-ann-cross",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.level_payment",
  secondary: ["LOANS.outstanding_balance", "ANNUITIES.frequency_timing", "TVM.effective_nominal"],
  itemFormat: "expression-selection",
  conceptFamily: "cross-topic",
  dimensions: ["transfer", "rate_conversion", "timing"],
  reasoning: ["formula_selection", "valuation_dates", "transfer"],
  soaConcept: "An outstanding loan balance as the value of an annuity, with monthly payments and a converted rate.",
  variants: 2,
  generate(rng, level, variant) {
    const L = gridAmount(rng, 50000, 400000, 10000);
    const Lm = mamt(L);
    const n = rng.int(10, 30);
    const N = 12 * n;
    const hard = level === 3;
    let j: number;
    let rateText: string;
    let jLatex: string;
    let k: number;
    let when: string;
    let iA = 0;
    if (hard) {
      iA = gridRate(rng, 0.03, 0.08, 0.005);
      j = Math.pow(1 + iA, 1 / 12) - 1;
      rateText = `The annual effective interest rate is ${pc(iA)}.`;
      jLatex = `(${fac(iA)})^{1/12} - 1`;
      const y = rng.int(2, n - 2);
      k = 12 * y;
      when = `at the end of year ${y}, immediately after the payment then due`;
    } else {
      j = gridRate(rng, 0.003, 0.008, 0.0005);
      rateText = `Interest is at a nominal annual rate of ${pc(12 * j)} convertible monthly.`;
      jLatex = lit(j);
      k = rng.int(12, N - 12);
      when = `immediately after the ${k}th payment`;
    }
    const X = L / an(N, j);
    const Xe = lit(X);
    const truth = `(${lit(L)}*${accPow(j, k)} - ${avLev(X, 1, k, j, k)})`;
    const o = (latex: string, probe: string) => ({ content: math(latex), probe });
    const sym = (f: typeof aSym, m: number, rate: string) => f(m, rate);
    const stem = `A loan of ${amt(L)} is repaid by level payments of $X$ at the end of each month for ${n} years. ${rateText}\n\nDetermine which of the following is the outstanding balance ${when}.`;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    const retro = variant === 1;
    const acc = hard ? `(${fac(iA)})^{${k / 12}}` : `(${lit(1 + j)})^{${k}}`;
    if (!retro) {
      correct = { ...o(`X\\,${sym(aSym, N - k, jLatex)}`, `(${Xe}*${aExpr(N - k, j)})`), why: `Prospectively, the balance is the value of the ${N - k} remaining monthly payments at the effective monthly rate.` };
      distractors = hard
        ? [
            wrong(math(`X\\,${sym(aSym, N - k, `\\tfrac{${lit(iA)}}{12}`)}`), "RATE_DIVIDED_EFFECTIVE", 0, "selection", "An annual effective rate divided by 12 is not the effective monthly rate.", { probe: `(${Xe}*${aExpr(N - k, iA / 12)})` }),
            wrong(math(`12X\\,${sym(aSym, n - k / 12, lit(iA))}`), "RATE_PAYMENT_FREQUENCY", 1, "selection", "That replaces the monthly payments by annual ones at year-end.", { probe: `(12*${Xe}*${aExpr(n - k / 12, iA)})` }),
            wrong(math(`X\\,${sym(aSym, N - k + 1, jLatex)}`), "TIMING_BALANCE_INDEX", 2, "application", "Counting one payment too many gives the balance just before the payment.", { probe: `(${Xe}*${aExpr(N - k + 1, j)})` }),
            wrong(math(`X\\,${sym(aSym, N - k / 12, jLatex)}`), "TIMING_REFINANCE_PERIODS", 2, "application", `${k / 12} years is ${k} monthly payments, not ${k / 12}.`, { probe: `(${Xe}*${aExpr(N - k / 12, j)})` }),
            wrong(math(`${Lm} - ${k}X`), "SEQ_UNDISCOUNTED_SUM", 1, "interpretation", "Payments include interest; they do not reduce the balance one-for-one.", { probe: `(${lit(L)}-${k}*${Xe})` }),
          ]
        : [
            wrong(math(`X\\,${sym(aSym, N - k + 1, jLatex)}`), "TIMING_BALANCE_INDEX", 2, "application", "Counting one payment too many gives the balance just before the payment.", { probe: `(${Xe}*${aExpr(N - k + 1, j)})` }),
            wrong(math(`X\\,${sym(aSym, N - k, lit(12 * j))}`), "RATE_ANNUAL_FOR_PERIODIC", 0, "selection", "The annual nominal rate is applied to each month.", { probe: `(${Xe}*${aExpr(N - k, 12 * j)})` }),
            wrong(math(`${Lm} - ${k}X`), "SEQ_UNDISCOUNTED_SUM", 1, "interpretation", "Payments include interest; they do not reduce the balance one-for-one.", { probe: `(${lit(L)}-${k}*${Xe})` }),
            wrong(math(`${Lm} - X\\,${sym(aSym, k, jLatex)}`), "TIMING_VALUATION_DATE", 1, "application", `That is the balance's value at time 0, not at month ${k}.`, { probe: `(${lit(L)}-${Xe}*${aExpr(k, j)})` }),
            wrong(math(`X\\,${sym(aSym, N, jLatex)}`), "VAR_ORIGINAL_FOR_OUTSTANDING", 0, "recognition", "That is the original loan.", { probe: `(${Xe}*${aExpr(N, j)})` }),
          ];
    } else {
      correct = { ...o(`${Lm}${acc} - X\\,${sym(sSym, k, jLatex)}`, `(${lit(L)}*${accPow(j, k)}-${Xe}*${sExpr(k, j)})`), why: `Retrospectively, the loan accumulated to month ${k} less the ${k} payments accumulated to the same date.` };
      distractors = hard
        ? [
            wrong(math(`${Lm}${acc} - 12X\\,${sym(sSym, k / 12, lit(iA))}`), "RATE_PAYMENT_FREQUENCY", 1, "selection", "That treats the payments as annual, at year-end.", { probe: `(${lit(L)}*${accPow(j, k)}-12*${Xe}*${sExpr(k / 12, iA)})` }),
            wrong(math(`${Lm}${acc} - X\\,${sym(sSym, k, `\\tfrac{${lit(iA)}}{12}`)}`), "RATE_DIVIDED_EFFECTIVE", 0, "selection", "An annual effective rate divided by 12 is not the effective monthly rate.", { probe: `(${lit(L)}*${accPow(j, k)}-${Xe}*${sExpr(k, iA / 12)})` }),
            wrong(math(`${Lm}(${fac(iA)})^{${k}} - X\\,${sym(sSym, k, jLatex)}`), "RATE_ANNUAL_FOR_PERIODIC", 0, "application", "The loan is accumulated at the annual rate for each month.", { probe: `(${lit(L)}*${accPow(iA, k)}-${Xe}*${sExpr(k, j)})` }),
            wrong(math(`${Lm} - X\\,${sym(aSym, k, jLatex)}`), "TIMING_VALUATION_DATE", 1, "application", "That is a value at time 0.", { probe: `(${lit(L)}-${Xe}*${aExpr(k, j)})` }),
            wrong(math(`${Lm}${acc} - X\\,${sym(sdueSym, k, jLatex)}`), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Payments are at the end of each month.", { probe: `(${lit(L)}*${accPow(j, k)}-${Xe}*${sdueExpr(k, j)})` }),
          ]
        : [
            wrong(math(`${Lm}${acc} - X\\,${sym(sdueSym, k, jLatex)}`), "TIMING_IMMEDIATE_AS_DUE", 2, "application", "Payments are at the end of each month.", { probe: `(${lit(L)}*${accPow(j, k)}-${Xe}*${sdueExpr(k, j)})` }),
            wrong(math(`${Lm}(${lit(1 + 12 * j)})^{${k}} - X\\,${sym(sSym, k, lit(12 * j))}`), "RATE_ANNUAL_FOR_PERIODIC", 0, "selection", "The annual nominal rate is applied to each month.", { probe: `(${lit(L)}*${accPow(12 * j, k)}-${Xe}*${sExpr(k, 12 * j)})` }),
            wrong(math(`${Lm} - X\\,${sym(aSym, k, jLatex)}`), "TIMING_VALUATION_DATE", 1, "application", "That is a value at time 0.", { probe: `(${lit(L)}-${Xe}*${aExpr(k, j)})` }),
            wrong(math(`${Lm}${acc} - ${k}X`), "SEQ_UNDISCOUNTED_SUM", 1, "interpretation", "The payments earn interest too.", { probe: `(${lit(L)}*${accPow(j, k)}-${k}*${Xe})` }),
            wrong(math(`${Lm}${acc} - X\\,${sym(sSym, k - 1, jLatex)}`), "TIMING_BALANCE_INDEX", 2, "application", `${k} payments have been made, not ${k - 1}.`, { probe: `(${lit(L)}*${accPow(j, k)}-${Xe}*${sExpr(k - 1, j)})` }),
          ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "balance", expr: truth }], description: "The loan accumulated month by month less each payment accumulated to the same date; each option is evaluated and only the correct one agrees." },
      steps: [
        { concept: "loan.balance-prospective-retrospective", reasoning: "The balance is the value of the remaining payments, or the accumulated loan less the accumulated payments." },
        { concept: "tvm.nominal-vs-effective", reasoning: hard ? `Monthly payments need the effective monthly rate $(1+i)^{1/12} - 1$.` : `$i^{(12)}/12 = ${lit(j)}$ per month.` },
        { concept: "ann.payment-frequency", reasoning: `Count in months: ${k} payments made, ${N - k} remaining.` },
        ...(hard ? [{ concept: "ann.annuity-value-date", reasoning: `$a_{\\overline{${N - k}}|}$ values the remaining payments at month ${k}; $s_{\\overline{${k}}|}$ values the past ones there.` }] : []),
      ],
      conditions: ["Level end-of-month payments; the rate is converted to an effective monthly rate."],
      relationship: "$B_k = X\\,a_{\\overline{N-k}|j} = L(1+j)^k - X\\,s_{\\overline{k}|j}$",
      counterexample: "At $k = 0$ the prospective form gives $X\\,a_{\\overline{N}|j} = L$.",
      transfer: {
        principle: "A loan balance is an annuity value: choose the remaining payments, the payment-period rate and the date.",
        unusual: hard ? "The rate is annual effective but the payments are monthly." : "The question sits between loans and annuities.",
        misread: "Monthly counts and annual rates are easily mixed.",
      },
      itemFormat: "expression-selection",
      presentation: hard ? ["combined-topics", "frequency", "indirect-wording"] : ["combined-topics", "frequency"],
      features: { multiConcept: true, unfamiliar: hard },
      ...(hard ? { modelingDecisions: 1 } : {}),
      params: { L, n, k, variant },
    });
  },
});

export const ANNUITY_CONCEPT_TEMPLATES: ChoiceTemplate[] = [
  dueDiagnosis, dueIdentity, factorDate,
  levelMeaning, levelEquation, levelStatements, loanBalance,
  perpMeaning, perpDeferred, perpDiagnosis,
  arithMeaning, arithDecompose, arithStatements,
  geomApplicability, geomMeaning, geomDiagnosis,
  streamMeaning, streamSplit, streamStatements,
  nonlevelMeaning, nonlevelEquation, nonlevelDiagnosis,
  freqMeaning, freqRate, freqStatements,
];
