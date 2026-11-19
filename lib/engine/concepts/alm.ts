/**
 * Concept Practice — general cash flows, portfolios and asset-liability management.
 *
 * Every outcome of the topic has a recognition item, an equation / notation /
 * relationship item and a statement or error-diagnosis item. Quantitative
 * claims carry checks written from the explicit cash flows, so the validator
 * re-derives them independently of the code that chose the correct option.
 */
import { convexity, macaulayDuration, pvFlows, solveRoot } from "../finance";
import { drawUntil, gridAmount, gridRate, lit, mamt, mnum, mpc, pc, sumOf } from "../templates/kit";
import type { ChoiceDraft, ChoiceTemplate, Difficulty, Presentation } from "../types";
import { conceptQuestion as buildConcept, conceptTemplate, math, statement, statementQuestion as buildStatements } from "./kit";

/** Math-safe thousands separators (`{,}`) become plain commas outside `$…$` in prose. */
const proseCommas = (m: string): string =>
  m
    .split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$)/)
    .map((seg, k) => (k % 2 ? seg : seg.replace(/\{,\}/g, ",")))
    .join("");
const CODE_KEYS = new Set(["latex", "expr", "probe", "than", "calc"]);
function tidy<T>(x: T, key = ""): T {
  if (typeof x === "string") return (CODE_KEYS.has(key) ? x : proseCommas(x)) as T;
  if (Array.isArray(x)) return x.map((y) => tidy(y, key)) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, tidy(v, k)])) as T;
  return x;
}
const conceptQuestion = (spec: Parameters<typeof buildConcept>[0]): ChoiceDraft => tidy(buildConcept(spec));
const statementQuestion = (spec: Parameters<typeof buildStatements>[0]): ChoiceDraft => tidy(buildStatements(spec));

// ---------------------------------------------------------------- shared helpers

type Flow = { t: number; amount: number };

/** `(1+i)**(-(t))` written for the expression engine. */
const disc = (i: number | string, t: number | string): string => `(1+${typeof i === "number" ? lit(i) : i})**(-(${typeof t === "number" ? lit(t) : t}))`;
/** Present value of explicit flows at a flat rate, term by term. */
const pvE = (flows: readonly Flow[], i: number | string): string => sumOf(flows.map((f) => `${lit(f.amount)}*${disc(i, f.t)}`));
/** Macaulay duration of explicit flows, term by term. */
const durE = (flows: readonly Flow[], i: number | string): string =>
  `(${sumOf(flows.map((f) => `${lit(f.t)}*${lit(f.amount)}*${disc(i, f.t)}`))}/${pvE(flows, i)})`;
/** Convexity P''/P of explicit flows, term by term. */
const convE = (flows: readonly Flow[], i: number | string): string =>
  `(${sumOf(flows.map((f) => `${lit(f.t * (f.t + 1))}*${lit(f.amount)}*${disc(i, f.t + 2)}`))}/${pvE(flows, i)})`;
/** min(a, b) in the expression grammar, for checking two inequalities at once. */
const minE = (a: string, b: string): string => `(((${a})+(${b})-sqrt(((${a})-(${b}))**2))/2)`;
/** Value of explicit flows discounted at spot rates s[t-1] for time t. */
const spotPvE = (flows: readonly Flow[], s: readonly number[]): string => sumOf(flows.map((f) => `${lit(f.amount)}*${disc(s[f.t - 1], f.t)}`));
/** A rate as a percent figure inside math: `5.53\%`. */
const mpct = (x: number, d = 2): string => `${mnum(x * 100, d)}\\%`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "a, b and c". */
const andList = (xs: string[]): string => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** Level-dependent presentation tags. */
const tags = (level: Difficulty, l2: Presentation[], l3: Presentation[]): Presentation[] => (level === 3 ? l3 : level === 2 ? l2 : ["direct"]);

const durationStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-duration-statements",
  family: "con-alm-duration",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.duration",
  secondary: ["ALM.convexity"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "terminology"],
  soaConcept: "Properties of Macaulay and modified duration, judged as a set of statements.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(6, 15);
    const r = gridRate(rng, 0.02, 0.09, 0.005);
    const flows = Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: 100 * r + (k + 1 === n ? 100 : 0) }));
    const D = macaulayDuration(flows, i);
    const durationExpr = `${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}/${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}`;
    const intro =
      level === 1 || variant === 0
        ? "Determine which of the following statements about duration are true."
        : `A ${n}-year bond pays annual coupons at a rate of ${pc(r)} and is priced at an annual effective yield of ${pc(i)}. Determine which of the following statements are true.`;
    const statements =
      level === 1 || variant === 0
        ? [
            statement("I", "Modified duration equals Macaulay duration divided by $1 + i$, where $i$ is the annual effective yield.", true, "Differentiating $P(i) = \\sum CF_t v^t$ gives $-P'(i)/P(i) = \\sum t\\,CF_t v^{t+1}/P = D_{mac}/(1+i)$.", "FORMULA_MODIFIED_FOR_MACAULAY", { stage: 0, failure: "recognition", conditionTrue: "It would fail if $i$ were a nominal rate convertible more than once a year; then divide by $1 + i^{(m)}/m$.", confusedWith: "alm.macaulay-vs-modified" }),
            statement("II", "Holding the yield and the term fixed, a higher coupon rate gives a longer Macaulay duration.", false, "A higher coupon moves present value toward the early coupon dates, so the PV-weighted mean time falls.", "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", conditionTrue: "It would be true of the bond's *price*, which rises with the coupon rate." }),
            statement("III", "Macaulay duration weights each payment time by the payment amount.", false, "The weights are present values, $CF_t v^t / P$, not the amounts themselves.", "MODEL_UNDISCOUNTED_WEIGHTS", { stage: 0, failure: "interpretation", conditionTrue: "Only at a zero interest rate do amounts and present values give the same weights." }),
          ]
        : [
            statement("I", `The bond's Macaulay duration is less than ${n} years.`, true, `Every coupon before year ${n} carries weight, so the PV-weighted mean time is below the maturity: $D = ${mnum(D, 2)}$.`, "CONC_RELATED_TERM", { stage: 0, failure: "recognition", check: { expr: durationExpr, op: "<", than: n }, conditionTrue: "Only a zero-coupon bond has duration equal to its term." }),
            statement("II", "If the yield rises, the bond's Macaulay duration rises.", false, "A higher yield discounts distant payments more heavily, shifting weight to earlier dates; duration falls.", "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", conditionTrue: "It would be true if the yield fell." }),
            statement("III", `The bond's modified duration is less than its Macaulay duration.`, true, `$D_{mod} = D/(1+i) = ${mnum(D / (1 + i), 2)} < ${mnum(D, 2)}$ for any positive yield.`, "FORMULA_MODIFIED_FOR_MACAULAY", { stage: 2, failure: "connection", check: { expr: `${durationExpr}/(1+${lit(i)})`, op: "<", than: durationExpr }, conditionTrue: "They are equal only when $i = 0$." }),
          ];
    return statementQuestion({
      stem: intro,
      statements,
      extra: [
        {
          keys: level === 1 || variant === 0 ? ["I", "II", "III"] : ["II"],
          misconception: level === 1 || variant === 0 ? "CONC_RELATED_TERM" : "MODEL_UNDISCOUNTED_WEIGHTS",
          why:
            level === 1 || variant === 0
              ? "Accepting II and III together treats duration as the plain average of payment times — a related quantity, not Macaulay duration."
              : "Judging all three statements from undiscounted cash flows reverses I and III as well as II.",
          stage: 0,
          failure: "interpretation",
        },
      ],
      steps: [
        { concept: "alm.macaulay-vs-modified", reasoning: "Macaulay duration is the present-value-weighted mean time of the cash flows; modified duration is $-P'(i)/P(i) = D/(1+i)$." },
        { concept: "alm.macaulay-vs-modified", reasoning: "Anything that moves present value toward earlier dates (a higher coupon, a higher yield) shortens duration." },
        { concept: "alm.convexity", reasoning: "Compare the two durations: dividing by $1 + i > 1$ always makes modified duration the smaller." },
      ],
      conditions: ["Annual effective yield, flat yield curve.", "Cash flows fixed in amount and timing (no options)."],
      relationship: "$D_{mac} = \\dfrac{\\sum t\\,CF_t v^t}{\\sum CF_t v^t}, \\qquad D_{mod} = \\dfrac{D_{mac}}{1+i}$",
      counterexample: "A zero-coupon bond: all weight sits at maturity, so its Macaulay duration equals its term whatever the yield.",
      transfer: {
        principle: "Duration is a weighted mean time with present-value weights; ask how a change moves present value along the timeline.",
        unusual: "Statements mix definitions with comparative statics.",
        misread: "Price and duration respond to the coupon rate in opposite directions.",
      },
      presentation: level === 2 ? ["indirect-wording"] : ["direct"],
      features: { steps: 3, unfamiliar: level === 2 },
      params: { i, n, r, variant },
    });
  },
});

// ================================================================ rates of return

const returnMeasureDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-alm-return-measure-definition",
  family: "con-alm-returns",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.rates_of_return",
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "What the dollar-weighted and the time-weighted rates of return measure.",
  variants: 2,
  generate(rng, level, variant) {
    const timeWeighted = variant === 0;
    const months = rng.int(2, 10);
    const TW = "The product of the fund's growth factors over the subperiods between cash flows, minus 1, whatever the cash flows' sizes.";
    const DW = "The rate at which the opening balance and each net contribution, accumulated to year end, equal the closing balance.";
    const stem =
      level === 1
        ? `During a year a fund receives deposits and pays withdrawals. Which of the following describes the fund's ${timeWeighted ? "time-weighted" : "dollar-weighted"} rate of return for the year?`
        : timeWeighted
          ? `An investor holds units of a pooled fund and alone decides when to add or withdraw money; one deposit was made after ${months} months. The investor's adviser wants a measure of the year's return that reflects the fund manager's investment results but not the investor's timing. Which of the following is that measure?`
          : `An investor holds units of a pooled fund and alone decides when to add or withdraw money; one deposit was made after ${months} months. The investor wants the single annual effective rate actually earned on the investor's own money, allowing for when it was invested. Which of the following is that measure?`;
    const other = timeWeighted
      ? { content: DW, misconception: "CONC_ALM_DWR_TWR_SWAPPED" as const, why: "That is the dollar-weighted return: it depends on how much money was invested in each part of the year, so it reflects the investor's timing.", stage: 0, failure: "recognition" as const, conditionTrue: "It is the time-weighted return too when there are no intermediate cash flows.", confusedWith: "alm.dwr-equation" }
      : { content: TW, misconception: "CONC_ALM_DWR_TWR_SWAPPED" as const, why: "That is the time-weighted return: it removes the effect of the size and timing of the cash flows.", stage: 0, failure: "recognition" as const, conditionTrue: "It equals the dollar-weighted return when every subperiod earns the same rate.", confusedWith: "alm.dwr-vs-twr" };
    return conceptQuestion({
      stem,
      correct: {
        content: timeWeighted ? TW : DW,
        why: timeWeighted
          ? "The time-weighted return chains the growth factor of each subperiod between cash flows, so a deposit or withdrawal changes no factor: it measures the fund's investment performance."
          : "The dollar-weighted return is the yield rate of the investor's own cash flows: the equation of value $A(1+j) + \\sum C_t (1+j)^{1-t} = B$ weights each contribution by the time it is invested.",
      },
      distractors: [
        other,
        {
          content: "The investment gain for the year, net of contributions, divided by the balance at the start of the year.",
          misconception: "CONC_RETURN_ON_WRONG_BASE",
          why: "Dividing by the opening balance ignores the money added or withdrawn during the year: the base is not the capital actually invested.",
          stage: 1,
          failure: "application",
          conditionTrue: "With no cash flows during the year all three measures coincide with this ratio.",
        },
        {
          content: "The closing balance divided by the opening balance, minus 1, with each contribution left in the balances.",
          misconception: "CONC_ALM_CONTRIBUTION_AS_GAIN",
          why: "Deposits are new money, not investment growth; leaving them in the ratio counts them as return.",
          stage: 1,
          failure: "interpretation",
        },
        {
          content: "The arithmetic average of the returns earned in the subperiods between cash flows, weighted by their lengths.",
          misconception: "CONC_ALM_RETURNS_AVERAGED",
          why: "Returns of successive subperiods combine multiplicatively; an average of rates is neither measure.",
          stage: 1,
          failure: "selection",
        },
        {
          content: "The gain divided by the opening balance plus each contribution weighted by the time elapsed before it was made.",
          misconception: "CONC_ALM_DWR_WEIGHT_TIMING",
          why: "A contribution earns interest for the rest of the year after it is made, so its weight is the time remaining, $1 - t$.",
          stage: 1,
          failure: "application",
        },
      ],
      steps:
        level === 1
          ? [
              { concept: "alm.dwr-vs-twr", reasoning: "The time-weighted return measures the fund's growth; the dollar-weighted return measures the investor's yield on the money actually invested." },
              { concept: "alm.dwr-equation", reasoning: "Match each description to its construction: chained subperiod factors, or one equation of value for all the cash flows." },
            ]
          : [
              { concept: "alm.dwr-vs-twr", reasoning: "Decide whose decisions the measure should reflect: the manager's (time-weighted) or the investor's own money and timing (dollar-weighted)." },
              { concept: "alm.dwr-equation", reasoning: "The dollar-weighted return solves one equation of value, so the timing of the deposit enters it; chained subperiod factors do not depend on the deposit." },
              { concept: "alm.dwr-vs-twr", reasoning: "Select the description whose construction has the required dependence on the investor's cash flows." },
            ],
      conditions: ["Fund values are known just before each cash flow (time-weighted).", "Cash flows are external deposits and withdrawals, not investment income."],
      relationship: "$1 + j_{TW} = \\prod_k \\dfrac{B_k}{B_{k-1} + C_{k-1}}, \\qquad A(1+j_{DW}) + \\sum_t C_t (1+j_{DW})^{1-t} = B$",
      counterexample: "With no deposits or withdrawals during the year, both measures equal $B/A - 1$.",
      transfer: {
        principle: "Time-weighted: the fund's performance. Dollar-weighted: the investor's yield, which depends on how much money was invested when.",
        unusual: level === 2 ? "The question describes the purpose of the measure, not its name." : "Two definitions look similar because both use the opening and closing balances.",
        misread: "A deposit is not investment growth.",
      },
      itemFormat: "definition",
      presentation: tags(level, ["indirect-wording"], ["indirect-wording"]),
      features: { unfamiliar: level === 2 },
      params: { variant, months },
    });
  },
});

const returnTimingCompare: ChoiceTemplate = conceptTemplate({
  id: "con-alm-return-timing-compare",
  family: "con-alm-returns",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.rates_of_return",
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["concept_recognition", "financial_intuition", "cashflow_modelling"],
  soaConcept: "How a mid-year cash flow moves the dollar-weighted return relative to the time-weighted return.",
  variants: 2,
  generate(rng, level, variant) {
    // Two half-year returns that differ clearly.
    const [r1, r2] = drawUntil(
      () => [gridRate(rng, -0.06, 0.14, 0.01), gridRate(rng, -0.06, 0.14, 0.01)],
      ([a, b]) => Math.abs(a - b) >= 0.05
    );
    /** Exact dollar-weighted rate with one cash flow C at mid-year: A u^2 + C u = E, u = (1+j)^(1/2). */
    const dwrE = (A: string, C: string, E: string) => `((((-(${C}))+sqrt((${C})**2+4*(${A})*(${E})))/(2*(${A})))**2-1)`;
    const dwr = (A: number, C: number, E: number) => ((-C + Math.sqrt(C * C + 4 * A * E)) / (2 * A)) ** 2 - 1;

    if (level === 2) {
      const deposit = variant === 0;
      const A = gridAmount(rng, 20000, 80000, 1000);
      const B = Math.round(A * (1 + r1));
      const C = deposit ? gridAmount(rng, Math.round(0.3 * A / 1000) * 1000, Math.round(0.8 * A / 1000) * 1000, 1000) : -gridAmount(rng, Math.round(0.2 * B / 1000) * 1000, Math.round(0.5 * B / 1000) * 1000, 1000);
      const E = Math.round((B + C) * (1 + r2) * 100) / 100;
      const twr = (B / A) * (E / (B + C)) - 1;
      const jd = dwr(A, C, E);
      const twrE = `(${lit(B)}/${lit(A)}*${lit(E)}/(${lit(B)}+${lit(C)})-1)`;
      const dE = dwrE(lit(A), lit(C), lit(E));
      const lower = jd < twr;
      const lowerText = "$j_D < j_T$: more of the money was invested during the weaker half-year.";
      const higherText = "$j_D > j_T$: more of the money was invested during the stronger half-year.";
      const heavier = deposit ? "second" : "first";
      const stem =
        `The table shows an investment fund's values during a year. The only cash flow is on July 1.\n\n` +
        `Let $j_D$ be the annual effective dollar-weighted rate of return and $j_T$ the time-weighted rate of return for the year.\n\nWhich of the following is true?`;
      return conceptQuestion({
        stem,
        exhibits: [
          {
            type: "table",
            columns: ["Date", "Fund value before the cash flow", "Cash flow"],
            rows: [
              ["January 1", amtText(A), "—"],
              ["July 1", amtText(B), deposit ? `Deposit of ${amtText(C)}` : `Withdrawal of ${amtText(-C)}`],
              ["December 31", amtText(E), "—"],
            ],
          },
        ],
        correct: {
          content: lower ? lowerText : higherText,
          why: `The ${deposit ? "deposit" : "withdrawal"} leaves more money in the fund during the ${heavier} half-year, which earned ${pc(heavier === "second" ? r2 : r1)} against ${pc(heavier === "second" ? r1 : r2)}. The dollar-weighted rate leans toward that half: $j_D = ${mpct(jd)}$, $j_T = ${mpct(twr)}$.`,
          check: { expr: dE, op: lower ? "<" : ">", than: twrE },
        },
        distractors: [
          {
            content: lower ? higherText : lowerText,
            misconception: "CONC_DIRECTION_REVERSED",
            why: `The ${heavier} half-year carried more money, and it was the ${lower ? "weaker" : "stronger"} half, so $j_D$ is ${lower ? "below" : "above"} $j_T$.`,
            check: { expr: dE, op: lower ? ">" : "<", than: twrE },
            stage: 2,
            failure: "application",
            conditionTrue: `It would hold if the ${heavier} half-year had earned the higher return.`,
          },
          {
            content: "$j_D = j_T$: both rates are computed from the same fund values over the same year.",
            misconception: "CONC_ALM_RETURNS_COINCIDE",
            why: "With a cash flow during the year and unequal half-year returns, the two measures weight the halves differently.",
            check: { expr: dE, op: "=", than: twrE },
            stage: 0,
            failure: "recognition",
            conditionTrue: "It holds when both half-years earn the same rate, or when there is no cash flow.",
          },
          {
            content: "$j_T$ equals the December 31 value divided by the January 1 value, minus 1.",
            misconception: "CONC_ALM_CONTRIBUTION_AS_GAIN",
            why: `That ratio counts the ${deposit ? "deposit as growth" : "withdrawal as a loss"}; $j_T$ chains the two half-year factors instead.`,
            check: { expr: `(${lit(E)}/${lit(A)}-1)`, op: "=", than: twrE },
            stage: 1,
            failure: "interpretation",
          },
          {
            content: "$j_D$ equals the year's gain, net of the cash flow, divided by the January 1 value.",
            misconception: "CONC_RETURN_ON_WRONG_BASE",
            why: "The base for $j_D$ must allow for the money added or removed at mid-year; the opening value alone is not the capital invested.",
            check: { expr: `((${lit(E)}-${lit(A)}-(${lit(C)}))/${lit(A)})`, op: "=", than: dE },
            stage: 1,
            failure: "application",
          },
          {
            content: "$j_T$ cannot be found without the date of the cash flow; only $j_D$ can be found here.",
            misconception: "CONC_ALM_DWR_TWR_SWAPPED",
            why: "$j_T$ needs the fund value just before the cash flow, which is given; it is $j_D$ that needs the date.",
            stage: 0,
            failure: "recognition",
          },
        ],
        steps: [
          { concept: "alm.dwr-vs-twr", reasoning: `$j_T$ chains the half-year factors ${mnum(1 + r1, 2)} and ${mnum(1 + r2, 2)}; the cash flow does not affect it.` },
          { concept: "alm.dwr-equation", reasoning: `$j_D$ solves $${mamt(A)}(1+j) ${C >= 0 ? "+" : "-"} ${mamt(Math.abs(C))}(1+j)^{1/2} = ${mamt(E)}$, weighting each half-year by the money invested in it.` },
          { concept: "alm.dwr-vs-twr", reasoning: `The ${deposit ? "deposit" : "withdrawal"} puts more money into the ${heavier} half-year, so $j_D$ moves toward that half's return.` },
        ],
        conditions: ["Annual effective rates; the cash flow is external new money.", "Fund values are given just before the cash flow."],
        relationship: "$1 + j_T = \\dfrac{B}{A}\\cdot\\dfrac{E}{B + C}, \\qquad A(1+j_D) + C(1+j_D)^{1/2} = E$",
        counterexample: "If both half-years earned the same rate, $j_D = j_T$ whatever the size of the cash flow.",
        transfer: {
          principle: "The dollar-weighted return is pulled toward the return of the periods in which more money was invested.",
          unusual: "No calculation is required to rank the two rates.",
          misread: "A withdrawal shifts the weight toward the first half-year, not the second.",
        },
        itemFormat: "comparative-statics",
        presentation: ["compare-streams"],
        features: { unfamiliar: !deposit },
        params: { A, B, C, E, r1, r2, variant },
      });
    }

    // Level 3: two investors in the same fund (unit values), different cash flows.
    const U0 = gridAmount(rng, 10, 40, 1);
    const U1 = Math.round(U0 * (1 + r1) * 100) / 100;
    const U2 = Math.round(U1 * (1 + r2) * 100) / 100;
    const X = gridAmount(rng, 10000, 50000, 1000);
    const Y = gridAmount(rng, 5000, X, 1000);
    const withdraw = variant === 0;
    const W = withdraw ? gridAmount(rng, 2000, Math.floor((0.6 * X * U1) / U0 / 1000) * 1000, 1000) : 0;
    const EP = (X * U2) / U0 + (Y * U2) / U1;
    const EQ = (X * U2) / U0 - (W * U2) / U1;
    const EPe = `(${lit(X)}*${lit(U2)}/${lit(U0)}+${lit(Y)}*${lit(U2)}/${lit(U1)})`;
    const EQe = `(${lit(X)}*${lit(U2)}/${lit(U0)}-${lit(W)}*${lit(U2)}/${lit(U1)})`;
    const dP = dwrE(lit(X), lit(Y), EPe);
    const dQ = withdraw ? dwrE(lit(X), lit(-W), EQe) : `(${EQe}/${lit(X)}-1)`;
    const BPe = `(${lit(X)}*${lit(U1)}/${lit(U0)})`;
    const tP = `(${BPe}/${lit(X)}*${EPe}/(${BPe}+${lit(Y)})-1)`;
    const tQ = withdraw ? `(${BPe}/${lit(X)}*${EQe}/(${BPe}-${lit(W)})-1)` : `(${EQe}/${lit(X)}-1)`;
    const jP = dwr(X, Y, EP);
    const jQ = withdraw ? dwr(X, -W, EQ) : EQ / X - 1;
    const lower = jP < jQ;
    const word = lower ? "lower" : "higher";
    const opp = lower ? "higher" : "lower";
    const stem =
      `The unit value of a fund is ${mnum(U0, 2)} on January 1, ${mnum(U1, 2)} on July 1 and ${mnum(U2, 2)} on December 31. ` +
      `Investor P invests ${mamt(X)} on January 1 and a further ${mamt(Y)} on July 1. ` +
      (withdraw ? `Investor Q invests ${mamt(X)} on January 1 and withdraws ${mamt(W)} on July 1. ` : `Investor Q invests ${mamt(X)} on January 1 and makes no other transaction. `) +
      `Units are bought and sold at the unit value on the day.\n\nWhich of the following is true of the two investors' annual rates of return for the year?`;
    const stronger = r2 > r1 ? "second" : "first";
    return conceptQuestion({
      stem,
      correct: {
        content: `Their time-weighted returns are equal, and P's dollar-weighted return is ${word} than Q's.`,
        why: `Both time-weighted returns are $${mnum(U2, 2)}/${mnum(U0, 2)} - 1 = ${mpct(U2 / U0 - 1)}$. P has more money in the second half-year than Q, and the ${stronger} half-year was stronger, so $j_D^P = ${mpct(jP)}$ is ${word} than $j_D^Q = ${mpct(jQ)}$.`,
        check: { expr: dP, op: lower ? "<" : ">", than: dQ },
      },
      distractors: [
        {
          content: `Their time-weighted returns are equal, and P's dollar-weighted return is ${opp} than Q's.`,
          misconception: "CONC_DIRECTION_REVERSED",
          why: `P's extra money is invested in the second half-year, which was the ${r2 > r1 ? "stronger" : "weaker"} half, so P's dollar-weighted return is ${word}, not ${opp}.`,
          check: { expr: dP, op: lower ? ">" : "<", than: dQ },
          stage: 3,
          failure: "conclusion",
          conditionTrue: `It would hold if the ${stronger === "second" ? "first" : "second"} half-year had been the stronger.`,
        },
        {
          content: `Their dollar-weighted returns are equal, and P's time-weighted return is ${word} than Q's.`,
          misconception: "CONC_ALM_DWR_TWR_SWAPPED",
          why: "The roles are swapped: the time-weighted return depends only on the unit values, which both investors share; the dollar-weighted returns differ.",
          check: { expr: tP, op: lower ? "<" : ">", than: tQ },
          stage: 0,
          failure: "recognition",
          confusedWith: "alm.dwr-equation",
        },
        {
          content: "Both of their returns are equal, since they hold the same fund over the same year.",
          misconception: "CONC_ALM_RETURNS_COINCIDE",
          why: "The investors' cash flows differ, so the money exposed to each half-year differs and the dollar-weighted returns differ.",
          check: { expr: dP, op: "=", than: dQ },
          stage: 1,
          failure: "connection",
          conditionTrue: "It would hold if the two half-years had earned the same rate.",
        },
        {
          content: `P's time-weighted return is higher than Q's, because P's closing balance is the larger.`,
          misconception: "CONC_ALM_CONTRIBUTION_AS_GAIN",
          why: "P's larger balance comes from new money, not from better investment performance; the time-weighted returns are equal.",
          check: { expr: tP, op: ">", than: tQ },
          stage: 0,
          failure: "interpretation",
        },
      ],
      steps: [
        { concept: "alm.dwr-vs-twr", reasoning: "Each investor's time-weighted return chains the fund's half-year growth factors, which are the ratios of unit values; both get $U_2/U_0 - 1$." },
        { concept: "alm.dwr-equation", reasoning: "Each dollar-weighted return solves that investor's own equation of value, so it weights each half-year by the money that investor had in the fund." },
        { concept: "alm.dwr-equation", reasoning: `P has more money in the second half-year than Q${withdraw ? ", who withdrew" : ""}.` },
        { concept: "alm.dwr-vs-twr", reasoning: `The second half-year earned ${pc(U2 / U1 - 1, 2)} against ${pc(U1 / U0 - 1, 2)} for the first, so P's dollar-weighted return is the ${word}.` },
      ],
      conditions: ["Both investors trade at the published unit values.", "Annual effective rates; the July 1 cash flows are the only ones."],
      relationship: "$1 + j_T = \\dfrac{U_1}{U_0}\\cdot\\dfrac{U_2}{U_1}$ for every investor; $j_D$ solves each investor's own equation of value.",
      counterexample: "If the unit value grew at the same rate in both halves, all four returns would be equal.",
      transfer: {
        principle: "Investors in one fund share its time-weighted return; their dollar-weighted returns differ with the timing of their own cash flows.",
        unusual: "Two investors are compared through unit values rather than one fund's balances.",
        misread: "A larger closing balance says nothing about the rate earned.",
      },
      itemFormat: "comparative-statics",
      presentation: ["hidden-structure", "compare-streams"],
      modelingDecisions: 1,
      features: { unfamiliar: true, multiConcept: true },
      params: { U0, U1, U2, X, Y, W, variant },
    });
  },
});

/** An amount for table cells (prose, not math). */
function amtText(x: number): string {
  return mamt(x).replace(/\{,\}/g, ",");
}

const returnDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-alm-return-diagnosis",
  family: "con-alm-returns",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.rates_of_return",
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing"],
  reasoning: ["cashflow_modelling", "valuation_dates", "validation"],
  soaConcept: "Diagnosing the error in a proposed time-weighted or simple dollar-weighted return.",
  variants: 2,
  generate(rng, level, variant) {
    const A = gridAmount(rng, 10000, 60000, 1000);
    const m = rng.choice([2, 3, 4, 8, 9, 10]);
    const t = m / 12;
    const month = MONTHS[m];
    const r1 = gridRate(rng, -0.04, 0.12, 0.01);
    const r2 = drawUntil(() => gridRate(rng, -0.04, 0.12, 0.01), (x) => Math.abs(x - r1) >= 0.03);
    const withdrawal = level === 2;

    if (variant === 0) {
      // Time-weighted return: the candidate keeps the cash flow inside the first factor.
      const B = Math.round(A * (1 + r1));
      const C = withdrawal ? -gridAmount(rng, 1000, Math.floor((0.4 * B) / 1000) * 1000, 1000) : gridAmount(rng, 2000, A, 1000);
      const E = Math.round((B + C) * (1 + r2) * 100) / 100;
      const truth = `((1+${lit(r1)})*(1+${lit(r2)})-1)`;
      const after = B + C;
      const cand = E / A - 1;
      const sign = C > 0 ? "+" : "-";
      const flow = C > 0 ? `a deposit of ${mamt(C)}` : `a withdrawal of ${mamt(-C)}`;
      const stem =
        `A fund is worth ${mamt(A)} on January 1 and ${mamt(B)} on ${month} 1, just before ${flow}. It is worth ${mamt(E)} on December 31. ` +
        `A candidate calculates the time-weighted rate of return for the year as\n\n$$\\frac{${mamt(B)} ${sign} ${mamt(Math.abs(C))}}{${mamt(A)}}\\cdot\\frac{${mamt(E)}}{${mamt(B)} ${sign} ${mamt(Math.abs(C))}} - 1 = ${mpct(cand)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      return conceptQuestion({
        stem,
        correct: {
          content: `The first factor must end just before the cash flow: it should be $${mamt(B)}/${mamt(A)}$.`,
          why: `The first subperiod ends with the value before the cash flow, so $1 + j_T = \\frac{${mamt(B)}}{${mamt(A)}}\\cdot\\frac{${mamt(E)}}{${mamt(after)}}$ and $j_T = ${mpct((B / A) * (E / after) - 1)}$.`,
          check: { expr: `(${lit(B)}/${lit(A)}*${lit(E)}/${lit(after)}-1)`, op: "=", than: truth },
        },
        distractors: [
          {
            content: "The calculation is correct: the factors telescope to the ratio of the closing to the opening value.",
            misconception: "CONC_ALM_CONTRIBUTION_AS_GAIN",
            why: `The telescoped ratio counts the ${C > 0 ? "deposit as growth" : "withdrawal as a loss"} of the fund.`,
            check: { expr: `(${lit(E)}/${lit(A)}-1)`, op: "=", than: truth },
            stage: 1,
            failure: "interpretation",
            conditionTrue: "It would be correct if there were no cash flow during the year.",
          },
          {
            content: `The second factor must start before the cash flow: it should be $${mamt(E)}/${mamt(B)}$.`,
            misconception: "CONC_ALM_TWR_SUBPERIOD",
            why: "The second subperiod starts with the money actually invested after the cash flow; starting it at the value before the cash flow treats the cash flow as investment result.",
            check: { expr: `(${lit(after)}/${lit(A)}*${lit(E)}/${lit(B)}-1)`, op: "=", than: truth },
            stage: 1,
            failure: "application",
          },
          {
            content: `The cash flow must be removed from the closing value: $j_T = (${mamt(E)} ${C > 0 ? "-" : "+"} ${mamt(Math.abs(C))})/${mamt(A)} - 1$.`,
            misconception: "CONC_RETURN_ON_WRONG_BASE",
            why: "Removing the cash flow from the closing value ignores that it also earned (or lost) the second subperiod's return; this is not the time-weighted return.",
            check: { expr: `((${lit(E)}-(${lit(C)}))/${lit(A)}-1)`, op: "=", than: truth },
            stage: 2,
            failure: "selection",
          },
          {
            content: `The date of the cash flow must enter: $j_T$ solves $${mamt(A)}(1+j) ${sign} ${mamt(Math.abs(C))}(1+j)^{${mnum(1 - t, 4)}} = ${mamt(E)}$.`,
            misconception: "CONC_ALM_DWR_TWR_SWAPPED",
            why: "That equation defines the dollar-weighted return; the time-weighted return uses the fund value at the cash flow, not its date.",
            check: { expr: `(${lit(A)}*(1+${truth})+(${lit(C)})*(1+${truth})**${lit(1 - t)}-${lit(E)})`, op: "=", than: 0 },
            stage: 0,
            failure: "recognition",
            confusedWith: "alm.dwr-equation",
          },
          {
            content: `The two subperiod returns should be averaged, weighted by ${m}/12 and ${12 - m}/12.`,
            misconception: "CONC_ALM_RETURNS_AVERAGED",
            why: "Subperiod returns compound; an average of them is not the time-weighted return.",
            check: { expr: `(${lit(t)}*(${lit(B)}/${lit(A)}-1)+${lit(1 - t)}*(${lit(E)}/${lit(after)}-1))`, op: "=", than: truth },
            stage: 2,
            failure: "selection",
          },
        ],
        reference: { description: `The time-weighted return chains the subperiod factors $${mnum(1 + r1, 2)}$ and $${mnum(1 + r2, 2)}$; each proposed correction is evaluated and compared with it.` },
        steps: [
          { concept: "alm.dwr-vs-twr", reasoning: `Split the year at ${month} 1, the date of the cash flow.` },
          { concept: "alm.dwr-vs-twr", reasoning: "Each factor runs from the value just after one cash flow to the value just before the next." },
          { concept: "alm.dwr-equation", reasoning: "Chain the factors; the date of the cash flow is not needed, only the fund value at it." },
        ],
        conditions: ["Fund values are known just before the cash flow.", "The cash flow is external new money."],
        relationship: "$1 + j_T = \\dfrac{B}{A}\\cdot\\dfrac{E}{B + C}$",
        counterexample: "Without a cash flow during the year, the candidate's telescoped ratio would be correct.",
        transfer: {
          principle: "A time-weighted factor never contains the cash flow in its numerator; the cash flow starts the next factor.",
          unusual: "You judge a worked calculation rather than produce one.",
          misread: "A ratio that telescopes neatly is a warning sign, not a check.",
        },
        itemFormat: "error-diagnosis",
        presentation: withdrawal ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: withdrawal },
        params: { A, B, C, E, m, variant },
      });
    }

    // Simple-interest dollar-weighted return: the candidate weights cash flows by elapsed time.
    const D = gridAmount(rng, 2000, A, 1000);
    const m2 = withdrawal ? drawUntil(() => rng.int(2, 10), (k) => k !== m && 12 - k !== m && k !== 6) : 0;
    const t2 = m2 / 12;
    const W = withdrawal ? gridAmount(rng, 1000, Math.floor(A / 2000) * 1000, 1000) : 0;
    const I = Math.round((A + D - W) * gridRate(rng, 0.02, 0.12, 0.005));
    const E = A + D - W + I;
    const truthE = `((${lit(E)}-${lit(A)}-${lit(D)}+${lit(W)})/(${lit(A)}+${lit(D)}*${lit(1 - t)}-${lit(W)}*${lit(1 - t2)}))`;
    const candE = `((${lit(E)}-${lit(A)}-${lit(D)}+${lit(W)})/(${lit(A)}+${lit(D)}*${lit(t)}-${lit(W)}*${lit(t2)}))`;
    const cand = (E - A - D + W) / (A + D * t - W * t2);
    const gain = `${mamt(E)} - ${mamt(A)} - ${mamt(D)}${withdrawal ? ` + ${mamt(W)}` : ""}`;
    const stem =
      `A fund is worth ${mamt(A)} on January 1 and ${mamt(E)} on December 31. A deposit of ${mamt(D)} was made on ${month} 1` +
      (withdrawal ? ` and a withdrawal of ${mamt(W)} on ${MONTHS[m2]} 1` : "") +
      `. A candidate approximates the dollar-weighted rate of return for the year, using simple interest, as\n\n` +
      `$$\\frac{${gain}}{${mamt(A)} + \\tfrac{${m}}{12}(${mamt(D)})${withdrawal ? ` - \\tfrac{${m2}}{12}(${mamt(W)})` : ""}} = ${mpct(cand)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
    return conceptQuestion({
      stem,
      correct: {
        content: withdrawal ? "Each cash flow should be weighted by the fraction of the year remaining after it, not the fraction elapsed." : `The deposit is invested for the rest of the year, so its weight should be $\\tfrac{${12 - m}}{12}$, not $\\tfrac{${m}}{12}$.`,
        why: `A cash flow at time $t$ earns interest for $1 - t$ of the year, so $j \\approx ${mpct((E - A - D + W) / (A + D * (1 - t) - W * (1 - t2)))}$.`,
        check: { expr: truthE, op: "=", than: `((${lit(E)}-${lit(A)}-${lit(D)}+${lit(W)})/(${lit(A)}+${lit(D)}*(1-${lit(t)})-${lit(W)}*(1-${lit(t2)})))` },
      },
      distractors: [
        {
          content: "The calculation is correct: each cash flow is weighted by the time at which it is made.",
          misconception: "CONC_ALM_DWR_WEIGHT_TIMING",
          why: "Weighting by the time elapsed reverses the exposure: an early deposit is invested for most of the year.",
          check: { expr: candE, op: "=", than: truthE },
          stage: 1,
          failure: "application",
          conditionTrue: "It would be correct if every cash flow were made exactly at mid-year.",
        },
        {
          content: withdrawal ? "Each cash flow should be given full weight, as if made on January 1." : "The deposit should be given full weight, as if made on January 1.",
          misconception: "TIMING_IGNORED_DEFERRAL",
          why: "A cash flow made during the year is not invested for the whole year.",
          check: { expr: `((${lit(E)}-${lit(A)}-${lit(D)}+${lit(W)})/(${lit(A)}+${lit(D)}-${lit(W)}))`, op: "=", than: truthE },
          stage: 1,
          failure: "application",
        },
        {
          content: withdrawal ? "The numerator should be the change in value, with the cash flows counted as gain." : "The numerator should be the change in value, with the deposit counted as gain.",
          misconception: "CONC_ALM_CONTRIBUTION_AS_GAIN",
          why: "New money is not investment income; the interest earned is the change in value net of contributions.",
          check: { expr: `((${lit(E)}-${lit(A)})/(${lit(A)}+${lit(D)}*${lit(t)}-${lit(W)}*${lit(t2)}))`, op: "=", than: truthE },
          stage: 0,
          failure: "interpretation",
        },
        {
          content: "The denominator should be the January 1 value alone, the capital at the start of the year.",
          misconception: "CONC_RETURN_ON_WRONG_BASE",
          why: "The capital exposed during the year includes the cash flows for the time they are invested.",
          check: { expr: `((${lit(E)}-${lit(A)}-${lit(D)}+${lit(W)})/${lit(A)})`, op: "=", than: truthE },
          stage: 2,
          failure: "selection",
        },
        {
          content: "A dollar-weighted return needs the fund value on each cash-flow date; without it no estimate is possible.",
          misconception: "CONC_ALM_DWR_TWR_SWAPPED",
          why: "Fund values at the cash-flow dates are needed for the time-weighted return, not the dollar-weighted one.",
          stage: 0,
          failure: "recognition",
          confusedWith: "alm.dwr-vs-twr",
        },
      ],
      reference: { description: "The simple-interest dollar-weighted rate $I/(A + \\sum C_t(1-t))$ is computed from the data; each proposed correction is evaluated and compared with it." },
      steps: [
        { concept: "alm.dwr-equation", reasoning: "Interest earned is the change in value net of the cash flows." },
        { concept: "alm.dwr-equation", reasoning: "Each cash flow at time $t$ is exposed for $1 - t$ of the year, so it is weighted by $1 - t$." },
        { concept: "alm.dwr-vs-twr", reasoning: "Fund values at the cash-flow dates are not needed for this measure." },
      ],
      conditions: ["Simple interest within the year.", "Cash flows are external deposits and withdrawals."],
      relationship: "$j \\approx \\dfrac{I}{A + \\sum_t C_t(1-t)}$",
      counterexample: "For a cash flow exactly at mid-year, $t = 1 - t$ and the candidate's weights would happen to be right.",
      transfer: {
        principle: "Weight each cash flow by how long it is invested, measured to the end of the period.",
        unusual: "The candidate's formula looks complete; the error is in one weight.",
        misread: `"${month} 1" gives the time elapsed; the weight needs the time remaining.`,
      },
      itemFormat: "error-diagnosis",
      presentation: withdrawal ? ["valuation-date"] : ["direct"],
      features: { multipleValuationDates: withdrawal },
      params: { A, D, W, E, m, m2, variant },
    });
  },
});

// ================================================================ spot and forward rates

/** A monotone spot curve s_1..s_n on a 0.5% grid: rising (dir 1) or falling (dir -1). */
function spotCurve(rng: { int(a: number, b: number): number }, n: number, dir: 1 | -1): number[] {
  const start = dir > 0 ? 0.02 + rng.int(0, 6) * 0.005 : 0.06 + rng.int(0, 6) * 0.005;
  const s = [Number(start.toFixed(6))];
  for (let k = 1; k < n; k += 1) s.push(Number((s[k - 1] + dir * rng.int(1, 3) * 0.005).toFixed(6)));
  return s;
}
/** `1.045` for a rate of 4.5%, for writing factors in options. */
const fac = (s: number): string => lit(1 + s);
/** Annual forward rate from a to b implied by spot rates (a >= 1). */
const fwd = (s: readonly number[], a: number, b: number): number => Math.pow(Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a), 1 / (b - a)) - 1;
const fwdE = (s: readonly number[], a: number, b: number): string => `((((1+${lit(s[b - 1])})**${b})/((1+${lit(s[a - 1])})**${a}))**(1/${b - a})-1)`;
const spotTable = (s: readonly number[]) => ({
  type: "table" as const,
  columns: ["Term (years)", ...s.map((_, k) => String(k + 1))],
  rows: [["Annual effective spot rate", ...s.map((x) => pc(x))]],
});
/** All values differ by at least `gap` (for options that state rates). */
const distinctBy = (xs: number[], gap: number) => xs.every((x, k) => xs.every((y, m) => m === k || Math.abs(x - y) >= gap));

const forwardDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-alm-forward-definition",
  family: "con-alm-spot-forward",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "What a spot rate and a forward rate are, and which one can be locked in today.",
  variants: 2,
  generate(rng, level, variant) {
    const steps1 = [
      { concept: "alm.spot-forward", reasoning: "A spot rate $s_n$ is the annual yield on a zero-coupon investment from today to time $n$; a forward rate is the rate fixed today for a period that starts later." },
      { concept: "alm.ytm-vs-spot", reasoning: "A coupon bond's yield to maturity blends several spot rates, so it is neither a spot nor a forward rate in general." },
    ];
    const common = {
      conditions: ["Annual effective rates.", "No arbitrage between zero-coupon investments of different terms."],
      relationship: "$(1+s_t)^t(1+f_{t,t+1}) = (1+s_{t+1})^{t+1}$",
      transfer: {
        principle: "Spot: from today to time $n$. Forward: agreed today for a later period, implied by two spot rates.",
        unusual: "The question asks what a rate means rather than for its value.",
        misread: "A forward rate is not a forecast of the future one-year rate.",
      },
    };
    if (level === 1) {
      const t = rng.int(1, 4);
      const forward = variant === 0;
      const n = t + 1;
      const F = `The annual rate agreed today for a one-year investment from time ${forward ? "$t$ to time $t+1$" : `${n - 1} to time ${n}`}.`;
      const S = `The annual effective yield on a zero-coupon investment made today and maturing at time ${forward ? "$t+1$" : n}.`;
      return conceptQuestion({
        stem: forward
          ? `Let $s_k$ denote the annual effective $k$-year spot rate. Which of the following describes the one-year forward rate $f_{t,t+1}$?`
          : `Let $f_{k,k+1}$ denote the one-year forward rate from time $k$ to time $k+1$. Which of the following describes the ${n}-year spot rate $s_{${n}}$?`,
        correct: { content: forward ? F : S, why: forward ? "The forward rate is fixed today for the year from $t$ to $t+1$; it satisfies $(1+s_t)^t(1+f_{t,t+1}) = (1+s_{t+1})^{t+1}$." : `The spot rate is the yield on a single payment due at time ${n}; $(1+s_{${n}})^{${n}}$ is the product of the forward factors for years 1 to ${n}.` },
        distractors: [
          { content: forward ? S : F, misconception: "CONC_RELATED_TERM", why: forward ? "That is the spot rate $s_{t+1}$, which covers the whole period from today." : "That is the forward rate for the final year only.", stage: 0, failure: "recognition", confusedWith: "alm.spot-forward" },
          { content: forward ? "The one-year spot rate that will prevail at time $t$, which today's prices reveal with certainty." : `The annual rate that will be available on ${n}-year investments made one year from now.`, misconception: "CONC_ALM_FORWARD_KNOWN_FUTURE", why: "Future rates are not known today; forward and spot rates are both read from today's prices.", stage: 0, failure: "interpretation" },
          { content: `The yield to maturity of ${forward ? "a coupon bond maturing at time $t+1$" : `any bond, coupon or zero-coupon, maturing at time ${n}`}.`, misconception: "CONC_ALM_SPOT_AS_YTM", why: "A coupon bond's yield blends the spot rates of all its payment dates.", stage: 1, failure: "selection", conditionTrue: "It would be true for a flat yield curve.", confusedWith: "alm.ytm-vs-spot" },
          { content: forward ? "The term-weighted difference $(t+1)s_{t+1} - t\\,s_t$ of the two spot rates." : `The arithmetic average of the forward rates for years 1 to ${n}.`, misconception: forward ? "FORMULA_ARITHMETIC_FORWARD" : "CONC_ALM_RETURNS_AVERAGED", why: "Rates combine through products of accumulation factors, not sums of rates; the linear form is only an approximation.", stage: 1, failure: "selection" },
          { content: forward ? "The average of the two spot rates $s_t$ and $s_{t+1}$." : `The one-year forward rate from time ${n - 1} to time ${n}, compounded over ${n} years.`, misconception: forward ? "CONC_ALM_RETURNS_AVERAGED" : "CONC_ALM_FORWARD_AS_SPOT", why: forward ? "An average of spot rates ignores how they compound; on a rising curve the forward rate exceeds both." : "One forward rate applies to one year only; the spot factor is the product of all the forward factors.", stage: 1, failure: "selection" },
        ],
        steps: steps1,
        ...common,
        itemFormat: "definition",
        presentation: ["direct"],
        params: { t, variant },
      });
    }
    // Level 2: which rate can be locked in, with values.
    const s = drawUntil(
      () => spotCurve(rng, 4, rng.int(0, 1) === 0 ? 1 : -1),
      (c) => {
        const a = variant === 0 ? 2 : 1;
        const b = variant === 0 ? 3 : 3;
        return distinctBy([fwd(c, a, b), c[b - 1], c[b - a - 1], (b * c[b - 1] - a * c[a - 1]) / (b - a), Math.pow((1 + c[b - 1]) / (1 + c[a - 1]), 1 / (b - a)) - 1, variant === 0 ? (c[a - 1] + c[b - 1]) / 2 : Math.pow(1 + c[b - 1], b) / Math.pow(1 + c[a - 1], a) - 1], 0.0001);
      }
    );
    const a = variant === 0 ? 2 : 1;
    const b = 3;
    const k = b - a;
    const f = fwd(s, a, b);
    const truth = fwdE(s, a, b);
    const sa = lit(s[a - 1]);
    const sb = lit(s[b - 1]);
    const stem =
      variant === 0
        ? `The table shows annual effective spot rates. An investor will receive a payment at time ${a} and wants to fix today the annual effective rate at which it will be invested from time ${a} to time ${b}.\n\nWhich of the following is that rate?`
        : `The table shows annual effective spot rates. A company will need to borrow at time ${a}, for ${k} years, and wants to fix today the annual effective rate on the loan.\n\nWhich of the following is that rate?`;
    const rate = (x: number) => `$${mpct(x, 3)}$`;
    const sk = s[k - 1];
    return conceptQuestion({
      stem,
      exhibits: [spotTable(s)],
      correct: { content: `${rate(f)}, the forward rate from time ${a} to time ${b}`, why: `$(1+s_${a})^{${a}}(1+f)^{${k}} = (1+s_${b})^{${b}}$ gives $f = ${mpct(f, 3)}$: investing to time ${b} directly or to time ${a} and then at $f$ must give the same result.`, check: { expr: `((((1+${sb})**${b})/((1+${sa})**${a}))**(1/${k})-1)`, op: "=", than: truth } },
      distractors: [
        { content: `${rate(s[b - 1])}, the ${b}-year spot rate`, misconception: "CONC_RELATED_TERM", why: `$s_${b}$ applies from today to time ${b}, not from time ${a}.`, check: { expr: sb, op: "=", than: truth }, stage: 0, failure: "recognition", confusedWith: "alm.spot-forward" },
        { content: `${rate(sk)}, today's ${k}-year spot rate`, misconception: "CONC_ALM_FORWARD_KNOWN_FUTURE", why: `Today's ${k}-year rate applies to an investment starting now; the rate that will prevail at time ${a} is unknown, and what can be fixed today is the forward rate.`, check: { expr: lit(sk), op: "=", than: truth }, stage: 0, failure: "interpretation" },
        { content: `${rate((b * s[b - 1] - a * s[a - 1]) / k)}, the term-weighted difference of the spot rates`, misconception: "FORMULA_ARITHMETIC_FORWARD", why: "Spot rates compound; the linear difference only approximates the forward rate.", check: { expr: `((${b}*${sb}-${a}*${sa})/${k})`, op: "=", than: truth }, stage: 1, failure: "selection" },
        { content: `${rate(Math.pow((1 + s[b - 1]) / (1 + s[a - 1]), 1 / k) - 1)}, from the ratio of the factors $1 + s$`, misconception: "CONC_ALM_SPOT_NOT_COMPOUNDED", why: "Each spot factor must be raised to its term before the ratio is formed.", check: { expr: `(((1+${sb})/(1+${sa}))**(1/${k})-1)`, op: "=", than: truth }, stage: 1, failure: "application" },
        variant === 0
          ? { content: `${rate((s[a - 1] + s[b - 1]) / 2)}, the average of the two spot rates`, misconception: "CONC_ALM_RETURNS_AVERAGED", why: "Averaging rates ignores compounding and the different terms.", check: { expr: `((${sa}+${sb})/2)`, op: "=", than: truth }, stage: 1, failure: "selection" }
          : { content: `${rate(Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a) - 1)}, the ratio of accumulation factors minus 1`, misconception: "CONC_ALM_FORWARD_NOT_ANNUALIZED", why: `That is the ${k}-year effective rate; the annual rate is its ${k}th root.`, check: { expr: `(((1+${sb})**${b})/((1+${sa})**${a})-1)`, op: "=", than: truth }, stage: 2, failure: "conclusion" },
      ],
      steps: [
        { concept: "alm.spot-forward", reasoning: `The rate fixed today for the period from time ${a} to time ${b} is the forward rate $f_{${a},${b}}$.` },
        { concept: "alm.spot-forward", reasoning: `No arbitrage: $(1+s_${a})^{${a}}(1+f)^{${k}} = (1+s_${b})^{${b}}$.` },
        { concept: "alm.yield-curve-shape", reasoning: `Solve and annualize: $f = ${mpct(f, 3)}$.` },
      ],
      conditions: ["Annual effective spot rates.", "No arbitrage between zero-coupon investments."],
      relationship: "$(1+s_a)^a(1+f_{a,b})^{b-a} = (1+s_b)^b$",
      transfer: {
        principle: "Any rate fixed today for a future period is a forward rate implied by two spot rates.",
        unusual: "The rate is described by its use, not by its name.",
        misread: `The ${k}-year spot rate looks relevant because the period lasts ${k} year${k > 1 ? "s" : ""}.`,
      },
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { s: s.join(","), a, b, variant },
    });
  },
});

const forwardEquation: ChoiceTemplate = conceptTemplate({
  id: "con-alm-forward-equation",
  family: "con-alm-spot-forward",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.spot_forward",
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "rate_conversion"],
  reasoning: ["translation", "formula_selection"],
  soaConcept: "Selecting the no-arbitrage equation that defines a forward rate.",
  variants: 2,
  generate(rng, level, variant) {
    const s = drawUntil(() => spotCurve(rng, 5, rng.int(0, 2) === 0 ? -1 : 1), (c) => c.every((x) => x > 0.01));
    const k = variant === 0 ? 1 : rng.int(2, 3);
    const a = rng.int(1, 5 - k);
    const b = a + k;
    const sa = s[a - 1];
    const sb = s[b - 1];
    const truth = fwd(s, a, b);
    const what = k === 1 ? `the one-year forward rate $f$ from time ${a} to time ${b}` : `the annual effective forward rate $f$ for the ${k}-year period from time ${a} to time ${b}`;
    if (level === 1) {
      const A = `(1+${lit(sa)})`;
      const B = `(1+${lit(sb)})`;
      const root = `(${A}**${a}*(1+x)**${k}-${B}**${b})`;
      const cands = [
        { content: math(`(${fac(sb)})^{${b}}(1+f)^{${k}} = (${fac(sa)})^{${a}}`), misconception: "CONC_FORWARD_REVERSED" as const, why: "The longer and shorter accumulations are swapped: the forward factor carries the short investment up to the long one.", probe: `(${B}**${b}*(1+x)**${k}-${A}**${a})`, stage: 1, failure: "application" as const },
        { content: math(`${a}(${lit(sa)}) + ${k}f = ${b}(${lit(sb)})`), misconception: "FORMULA_ARITHMETIC_FORWARD" as const, why: "Rates compound; adding term-weighted rates is only a first-order approximation.", probe: `(${a}*${lit(sa)}+${k}*x-${b}*${lit(sb)})`, stage: 1, failure: "selection" as const },
        { content: math(`(${fac(sa)})(1+f)^{${k}} = ${fac(sb)}`), misconception: "CONC_ALM_SPOT_NOT_COMPOUNDED" as const, why: `Each spot rate must be compounded over its term: $(1+s_${a})^{${a}}$ and $(1+s_${b})^{${b}}$.`, probe: `(${A}*(1+x)**${k}-${B})`, stage: 1, failure: "application" as const },
        { content: math(`(${fac(sa)})^{${a}}(1+f)^{${b}} = (${fac(sb)})^{${b}}`), misconception: "ALG_ROOT_ERROR" as const, why: `The forward period lasts ${k} year${k > 1 ? "s" : ""}, so $1 + f$ is raised to the power ${k}, not ${b}.`, probe: `(${A}**${a}*(1+x)**${b}-${B}**${b})`, stage: 2, failure: "application" as const },
        ...(k > 1
          ? [{ content: math(`(${fac(sa)})^{${a}}(1+f) = (${fac(sb)})^{${b}}`), misconception: "CONC_ALM_FORWARD_NOT_ANNUALIZED" as const, why: `This $f$ is the ${k}-year effective rate, not the annual rate asked for.`, probe: `(${A}**${a}*(1+x)-${B}**${b})`, stage: 2, failure: "conclusion" as const }]
          : [{ content: math(`(1+f)^{${b}} = (${fac(sb)})^{${b}}`), misconception: "CONC_RELATED_TERM" as const, why: `This defines the ${b}-year spot rate, not the forward rate.`, probe: `((1+x)**${b}-${B}**${b})`, stage: 0, failure: "recognition" as const, confusedWith: "alm.spot-forward" }]),
      ];
      return conceptQuestion({
        stem: `The annual effective spot rates for terms of ${a} and ${b} years are $s_${a} = ${mpc(sa)}$ and $s_${b} = ${mpc(sb)}$.\n\nDetermine which of the following equations ${what} satisfies.`,
        correct: { content: math(`(${fac(sa)})^{${a}}(1+f)^{${k}} = (${fac(sb)})^{${b}}`), why: `Investing to time ${a} at the spot rate and then to time ${b} at $f$ must accumulate to the same amount as investing to time ${b} directly: $f = ${mpct(truth, 3)}$.`, probe: root },
        distractors: cands,
        reference: { values: [{ label: "f", expr: root, bracket: [-0.5, 1] }], description: `The no-arbitrage equation gives $f = ${mpct(truth, 3)}$; each option is solved for $f$ and only the correct one has that root.` },
        steps: [
          { concept: "alm.spot-forward", reasoning: `Two routes to time ${b}: directly at $s_${b}$, or to time ${a} at $s_${a}$ and then at $f$.` },
          { concept: "alm.spot-forward", reasoning: `Equate the accumulations: $(1+s_${a})^{${a}}(1+f)^{${k}} = (1+s_${b})^{${b}}$.` },
          { concept: "alm.yield-curve-shape", reasoning: `The forward period has length ${k}, which fixes the power on $1 + f$.` },
        ],
        conditions: ["Annual effective spot rates.", "No arbitrage."],
        relationship: "$(1+s_a)^a(1+f)^{b-a} = (1+s_b)^b$",
        counterexample: "With a flat curve every option that compounds correctly gives $f = s_a = s_b$.",
        transfer: { principle: "Write the two routes to the later date and equate their accumulations.", unusual: k > 1 ? "The forward period is longer than one year." : "The equation, not the rate, is asked for.", misread: "The power on $1+f$ is the length of the forward period." },
        itemFormat: "equation-selection",
        presentation: k > 1 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: k > 1 },
        params: { a, b, sa, sb, variant },
      });
    }
    // Level 2: data are zero-coupon bond prices per 1000 of face.
    const Pa = Math.round(1000 * Math.pow(1 + sa, -a) * 100) / 100;
    const Pb = Math.round(1000 * Math.pow(1 + sb, -b) * 100) / 100;
    const ratio = `(${lit(Pa)}/${lit(Pb)})`;
    const root = `((1+x)**${k}-${ratio})`;
    const P = (x: number) => mnum(x, 2);
    const cands = [
      { content: math(`(1+f)^{${k}} = \\dfrac{${P(Pb)}}{${P(Pa)}}`), misconception: "CONC_FORWARD_REVERSED" as const, why: "The price ratio is inverted: the earlier (dearer) bond's price goes in the numerator.", probe: `((1+x)**${k}-${lit(Pb)}/${lit(Pa)})`, stage: 1, failure: "application" as const },
      { content: math(`(1+f)^{${b}} = \\dfrac{1000}{${P(Pb)}}`), misconception: "CONC_RELATED_TERM" as const, why: `This defines the ${b}-year spot rate, which runs from today rather than from time ${a}.`, probe: `((1+x)**${b}-1000/${lit(Pb)})`, stage: 0, failure: "recognition" as const, confusedWith: "alm.spot-forward" },
      { content: math(`f = \\dfrac{${P(Pa)} - ${P(Pb)}}{${P(Pa)}}${k > 1 ? `\\cdot\\dfrac{1}{${k}}` : ""}`), misconception: "RATE_DISCOUNT_AS_INTEREST" as const, why: "Dividing the price difference by the earlier price gives a discount rate; interest is measured on the starting value.", probe: `(${lit(Pa)}-${lit(Pb)})/${lit(Pa)}/${k}`, stage: 2, failure: "application" as const },
      ...(k > 1
        ? [
            { content: math(`1 + f = \\dfrac{${P(Pa)}}{${P(Pb)}}`), misconception: "CONC_ALM_FORWARD_NOT_ANNUALIZED" as const, why: `That is the ${k}-year effective forward rate; the annual rate needs the ${k}th root.`, probe: `(1+x-${ratio})`, stage: 2, failure: "conclusion" as const },
            { content: math(`${k}f = \\dfrac{${P(Pa)} - ${P(Pb)}}{${P(Pb)}}`), misconception: "MODEL_COMPOUND_AS_SIMPLE" as const, why: "Dividing the multi-year growth by the number of years treats compound interest as simple.", probe: `(${k}*x-(${lit(Pa)}-${lit(Pb)})/${lit(Pb)})`, stage: 2, failure: "selection" as const },
          ]
        : [{ content: math(`(1+f)^{${b}} = \\dfrac{${P(Pa)}}{${P(Pb)}}`), misconception: "ALG_ROOT_ERROR" as const, why: "The forward period is one year, so the price ratio is $1 + f$ itself.", probe: `((1+x)**${b}-${ratio})`, stage: 2, failure: "application" as const }]),
    ];
    return conceptQuestion({
      stem: `Zero-coupon bonds of face 1000 maturing at times ${a} and ${b} sell for ${P(Pa)} and ${P(Pb)}, respectively.\n\nDetermine which of the following equations ${what} satisfies.`,
      correct: { content: math(`(1+f)^{${k}} = \\dfrac{${P(Pa)}}{${P(Pb)}}`), why: `$P_a/P_b = (1+s_b)^b/(1+s_a)^a$, the accumulation from time ${a} to time ${b}: $f = ${mpct(Math.pow(Pa / Pb, 1 / k) - 1, 3)}$.`, probe: root },
      distractors: cands,
      reference: { values: [{ label: "f", expr: root, bracket: [-0.5, 1] }], description: "The ratio of the prices is the forward accumulation factor; each option is solved for $f$ and compared with it." },
      steps: [
        { concept: "alm.spot-forward", reasoning: "A zero-coupon price per unit of face is $(1+s_t)^{-t}$, so prices encode spot rates." },
        { concept: "alm.spot-forward", reasoning: `$\\dfrac{P_${a}}{P_${b}} = \\dfrac{(1+s_${b})^{${b}}}{(1+s_${a})^{${a}}} = (1+f)^{${k}}$.` },
        { concept: "alm.yield-curve-shape", reasoning: `Annualize over the ${k}-year forward period.` },
      ],
      conditions: ["Zero-coupon prices consistent with annual effective spot rates.", "No arbitrage."],
      relationship: "$(1+f_{a,b})^{b-a} = P_a / P_b$",
      counterexample: "If the two prices were equal, the forward rate would be zero.",
      transfer: { principle: "Zero-coupon prices are discount factors; their ratio is a forward accumulation factor.", unusual: "Rates are hidden in prices.", misread: "The bond with the higher price is the shorter one." },
      itemFormat: "equation-selection",
      presentation: ["hidden-structure"],
      features: { unfamiliar: true },
      params: { a, b, Pa, Pb, variant },
    });
  },
});

const forwardDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-alm-forward-diagnosis",
  family: "con-alm-spot-forward",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.spot_forward",
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "rate_conversion"],
  reasoning: ["formula_selection", "validation"],
  soaConcept: "Diagnosing the error in a proposed forward-rate calculation.",
  variants: 2,
  generate(rng, level, variant) {
    const s = drawUntil(() => spotCurve(rng, 5, rng.int(0, 2) === 0 ? -1 : 1), (c) => c.every((x) => x > 0.01));
    const k = variant === 0 ? 1 : rng.int(2, 3);
    const a = rng.int(1, 5 - k);
    const b = a + k;
    const sa = lit(s[a - 1]);
    const sb = lit(s[b - 1]);
    const prices = level === 2;
    const Pa = Math.round(1000 * Math.pow(1 + s[a - 1], -a) * 100) / 100;
    const Pb = Math.round(1000 * Math.pow(1 + s[b - 1], -b) * 100) / 100;
    const truth = prices ? `((${lit(Pa)}/${lit(Pb)})**(1/${k})-1)` : fwdE(s, a, b);
    const tv = prices ? Math.pow(Pa / Pb, 1 / k) - 1 : fwd(s, a, b);
    const target = k === 1 ? `the one-year forward rate from time ${a} to time ${b}` : `the annual effective forward rate from time ${a} to time ${b}`;
    const data = prices
      ? `Zero-coupon bonds of face 1000 maturing at times ${a} and ${b} sell for ${mnum(Pa, 2)} and ${mnum(Pb, 2)}.`
      : `The annual effective spot rates are $s_${a} = ${mpc(s[a - 1])}$ and $s_${b} = ${mpc(s[b - 1])}$.`;
    type Opt = { content: string; misconception?: never; why: string; check: { expr: string; op: "="; than: string } };
    let candidateLatex: string;
    let candidateValue: number;
    let correct: Opt;
    let distractors: Parameters<typeof conceptQuestion>[0]["distractors"];
    const eq = (expr: string) => ({ expr, op: "=" as const, than: truth });
    if (!prices && k === 1) {
      candidateLatex = `f = \\frac{${fac(s[b - 1])}}{${fac(s[a - 1])}} - 1`;
      candidateValue = (1 + s[b - 1]) / (1 + s[a - 1]) - 1;
      correct = { content: `Each spot factor must be raised to its term: $1 + f = (${fac(s[b - 1])})^{${b}}/(${fac(s[a - 1])})^{${a}}$.`, why: `Accumulating to time ${b} takes $(1+s_${b})^{${b}}$, to time ${a} takes $(1+s_${a})^{${a}}$; their ratio gives $f = ${mpct(tv, 3)}$.`, check: eq(`(((1+${sb})**${b})/((1+${sa})**${a})-1)`) } as Opt;
      distractors = [
        { content: "The calculation is correct: a one-year forward factor is the ratio of the two spot factors.", misconception: "CONC_ALM_SPOT_NOT_COMPOUNDED", why: "The spot factors are annual; over their terms they must be compounded before the ratio is formed.", check: eq(`((1+${sb})/(1+${sa})-1)`), stage: 1, failure: "application", conditionTrue: "It would be right only for $a = 0$, $b = 1$." },
        { content: `The ratio is inverted: $1 + f = ${fac(s[a - 1])}/${fac(s[b - 1])}$.`, misconception: "CONC_FORWARD_REVERSED", why: "The forward factor carries the shorter accumulation up to the longer one.", check: eq(`((1+${sa})/(1+${sb})-1)`), stage: 1, failure: "application" },
        { content: `The forward rate is the term-weighted difference $${b}s_${b} - ${a}s_${a}$.`, misconception: "FORMULA_ARITHMETIC_FORWARD", why: "That linear form only approximates the compounding relationship.", check: eq(`(${b}*${sb}-${a}*${sa})`), stage: 1, failure: "selection" },
        { content: `The forward rate for that year is simply $s_${b}$, the longer spot rate.`, misconception: "CONC_RELATED_TERM", why: `$s_${b}$ covers the whole period from today to time ${b}.`, check: eq(sb), stage: 0, failure: "recognition", confusedWith: "alm.spot-forward" },
        { content: `Compound the spot factors, then take the ${b}th root of their ratio.`, misconception: "ALG_ROOT_ERROR", why: "The forward period lasts one year, so no root is needed.", check: eq(`((((1+${sb})**${b})/((1+${sa})**${a}))**(1/${b})-1)`), stage: 2, failure: "application" },
      ];
    } else if (!prices) {
      candidateLatex = `f = \\frac{(${fac(s[b - 1])})^{${b}}}{(${fac(s[a - 1])})^{${a}}} - 1`;
      candidateValue = Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a) - 1;
      correct = { content: `The ratio is a ${k}-year factor: its ${k === 2 ? "square" : "cube"} root, minus 1, is the annual rate.`, why: `$(1+f)^{${k}}$ equals the ratio, so $f = ${mpct(tv, 3)}$.`, check: eq(`((((1+${sb})**${b})/((1+${sa})**${a}))**(1/${k})-1)`) } as Opt;
      distractors = [
        { content: "The calculation is correct: the ratio of the accumulation factors, minus 1, is the forward rate.", misconception: "CONC_ALM_FORWARD_NOT_ANNUALIZED", why: `That is the effective rate for the whole ${k}-year period.`, check: eq(`(((1+${sb})**${b})/((1+${sa})**${a})-1)`), stage: 2, failure: "conclusion", conditionTrue: "It would be correct for a one-year forward period." },
        { content: `The result should be divided by ${k}, the number of years in the period.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Dividing compound growth by the number of years treats it as simple interest.", check: eq(`((((1+${sb})**${b})/((1+${sa})**${a})-1)/${k})`), stage: 2, failure: "selection" },
        { content: `The ratio's ${b}th root, minus 1, is the annual rate.`, misconception: "ALG_ROOT_ERROR", why: `The forward period is ${k} years long, not ${b}.`, check: eq(`((((1+${sb})**${b})/((1+${sa})**${a}))**(1/${b})-1)`), stage: 2, failure: "application" },
        { content: "The ratio is inverted: the shorter accumulation belongs in the numerator.", misconception: "CONC_FORWARD_REVERSED", why: "The forward factor carries the shorter accumulation up to the longer one.", check: eq(`(((1+${sa})**${a})/((1+${sb})**${b})-1)`), stage: 1, failure: "application" },
        { content: `The forward rate is $(${b}s_${b} - ${a}s_${a})/${k}$, from the spot rates directly.`, misconception: "FORMULA_ARITHMETIC_FORWARD", why: "That linear form only approximates the compounding relationship.", check: eq(`((${b}*${sb}-${a}*${sa})/${k})`), stage: 1, failure: "selection" },
      ];
    } else if (k === 1) {
      candidateLatex = `f = \\frac{${mnum(Pa, 2)} - ${mnum(Pb, 2)}}{${mnum(Pa, 2)}}`;
      candidateValue = (Pa - Pb) / Pa;
      correct = { content: `Interest is measured on the starting value: divide by $${mnum(Pb, 2)}$, not $${mnum(Pa, 2)}$.`, why: `Over the year from time ${a} to time ${b} the value grows from $P_${b}$-equivalent to $P_${a}$-equivalent: $1 + f = P_${a}/P_${b}$, so $f = ${mpct(tv, 3)}$.`, check: eq(`((${lit(Pa)}-${lit(Pb)})/${lit(Pb)})`) } as Opt;
      distractors = [
        { content: "The calculation is correct: the price difference over the earlier bond's price is the forward rate.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Dividing by the larger price gives an effective discount rate, $d = i/(1+i)$.", check: eq(`((${lit(Pa)}-${lit(Pb)})/${lit(Pa)})`), stage: 2, failure: "application" },
        { content: "The price difference should be divided by the face amount, 1000.", misconception: "VAR_FACE_FOR_PRICE", why: "Face is not the value invested at either date.", check: eq(`((${lit(Pa)}-${lit(Pb)})/1000)`), stage: 2, failure: "selection" },
        { content: `The prices are inverted: $f = ${mnum(Pb, 2)}/${mnum(Pa, 2)} - 1$.`, misconception: "CONC_FORWARD_REVERSED", why: "The later bond is cheaper; the ratio must exceed 1.", check: eq(`(${lit(Pb)}/${lit(Pa)}-1)`), stage: 1, failure: "application" },
        { content: `The forward rate is the ${b}-year spot rate, $(1000/${mnum(Pb, 2)})^{1/${b}} - 1$.`, misconception: "CONC_RELATED_TERM", why: "That rate runs from today, not from time " + a + ".", check: eq(`((1000/${lit(Pb)})**(1/${b})-1)`), stage: 0, failure: "recognition", confusedWith: "alm.spot-forward" },
        { content: `The ${b}th root of $${mnum(Pa, 2)}/${mnum(Pb, 2)}$, minus 1, is the forward rate.`, misconception: "ALG_ROOT_ERROR", why: "The forward period is one year, so no root is needed.", check: eq(`((${lit(Pa)}/${lit(Pb)})**(1/${b})-1)`), stage: 2, failure: "application" },
      ];
    } else {
      candidateLatex = `f = \\frac{${mnum(Pa, 2)}}{${mnum(Pb, 2)}} - 1`;
      candidateValue = Pa / Pb - 1;
      correct = { content: `The price ratio is a ${k}-year factor: its ${k === 2 ? "square" : "cube"} root, minus 1, is the annual rate.`, why: `$(1+f)^{${k}} = P_${a}/P_${b}$, so $f = ${mpct(tv, 3)}$.`, check: eq(`((${lit(Pa)}/${lit(Pb)})**(1/${k})-1)`) } as Opt;
      distractors = [
        { content: "The calculation is correct: the ratio of the two prices, minus 1, is the forward rate.", misconception: "CONC_ALM_FORWARD_NOT_ANNUALIZED", why: `That is the effective rate for the whole ${k}-year period.`, check: eq(`(${lit(Pa)}/${lit(Pb)}-1)`), stage: 2, failure: "conclusion", conditionTrue: "It would be correct for a one-year forward period." },
        { content: `The result should be divided by ${k}, the number of years in the period.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Dividing compound growth by the number of years treats it as simple interest.", check: eq(`((${lit(Pa)}/${lit(Pb)}-1)/${k})`), stage: 2, failure: "selection" },
        { content: `The ratio's ${b}th root, minus 1, is the annual rate.`, misconception: "ALG_ROOT_ERROR", why: `The forward period is ${k} years long, not ${b}.`, check: eq(`((${lit(Pa)}/${lit(Pb)})**(1/${b})-1)`), stage: 2, failure: "application" },
        { content: "The prices are inverted: the later bond's price belongs in the numerator.", misconception: "CONC_FORWARD_REVERSED", why: "The later bond is cheaper; the forward factor must exceed 1.", check: eq(`(${lit(Pb)}/${lit(Pa)}-1)`), stage: 1, failure: "application" },
        { content: "The price difference should be divided by the earlier bond's price.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "That is a discount rate for the whole period, not an annual effective interest rate.", check: eq(`((${lit(Pa)}-${lit(Pb)})/${lit(Pa)})`), stage: 2, failure: "application" },
      ];
    }
    return conceptQuestion({
      stem: `${data} A candidate calculates ${target} as\n\n$$${candidateLatex} = ${mpct(candidateValue, 3)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
      correct: { content: correct.content, why: correct.why, check: correct.check },
      distractors,
      reference: { description: `No arbitrage gives $f = ${mpct(tv, 3)}$; each proposed correction is evaluated and compared with it.` },
      steps: [
        { concept: "alm.spot-forward", reasoning: prices ? "Zero-coupon prices are discount factors: $P_t/1000 = (1+s_t)^{-t}$." : "Spot rates are annual effective rates over their whole terms." },
        { concept: "alm.spot-forward", reasoning: `The forward factor over the period is $(1+s_${b})^{${b}}/(1+s_${a})^{${a}}${prices ? ` = P_${a}/P_${b}` : ""}$.` },
        { concept: "alm.yield-curve-shape", reasoning: `The period lasts ${k} year${k > 1 ? "s" : ""}; take the ${k > 1 ? `${k}th root` : "factor itself"} for an annual effective rate.` },
      ],
      conditions: ["Annual effective rates.", "No arbitrage."],
      relationship: "$(1+f_{a,b})^{b-a} = \\dfrac{(1+s_b)^b}{(1+s_a)^a} = \\dfrac{P_a}{P_b}$",
      transfer: { principle: "Form the forward factor from compounded accumulations (or prices), then annualize over the forward period.", unusual: "A worked calculation is judged rather than produced.", misread: "A one-line ratio can hide a missing power or root." },
      itemFormat: "error-diagnosis",
      presentation: prices ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: prices },
      params: { a, b, k, variant, prices },
    });
  },
});

const crossSpotBond: ChoiceTemplate = conceptTemplate({
  id: "con-alm-cross-spot-bond",
  family: "con-alm-cross",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.price_redemption", "BONDS.yield"],
  itemFormat: "expression-selection",
  conceptFamily: "cross-topic",
  dimensions: ["equation_construction", "transfer"],
  reasoning: ["formula_selection", "cashflow_modelling", "translation"],
  soaConcept: "Pricing a coupon bond from spot or forward rates, and bootstrapping a spot rate from a bond price.",
  variants: 2,
  generate(rng, level, variant) {
    const s = drawUntil(() => spotCurve(rng, 3, rng.int(0, 1) === 0 ? 1 : -1), (c) => c.every((x) => x > 0.01));
    const F = 1000;
    const r = gridRate(rng, 0.03, 0.09, 0.005);
    const C = F * r;
    const flows: Flow[] = [{ t: 1, amount: C }, { t: 2, amount: C }, { t: 3, amount: C + F }];
    const f = [s[0], fwd(s, 1, 2), fwd(s, 2, 3)].map((x) => Math.round(x * 10000) / 10000);
    const Cm = mamt(C);
    const CF = mamt(C + F);
    const concepts = ["alm.spot-forward", "bond.price-yield", "alm.ytm-vs-spot"];
    if (level === 2) {
      const useForwards = variant === 0;
      const rates = useForwards ? f : s;
      const sp = useForwards ? [f[0], Math.sqrt((1 + f[0]) * (1 + f[1])) - 1, Math.cbrt((1 + f[0]) * (1 + f[1]) * (1 + f[2])) - 1] : s;
      const truthE = useForwards
        ? `(${lit(C)}/(1+${lit(f[0])})+${lit(C)}/((1+${lit(f[0])})*(1+${lit(f[1])}))+${lit(C + F)}/((1+${lit(f[0])})*(1+${lit(f[1])})*(1+${lit(f[2])})))`
        : spotPvE(flows, s);
      const g = rates.map(fac);
      const single = (x: number) => `\\dfrac{${Cm}}{${fac(x)}} + \\dfrac{${Cm}}{(${fac(x)})^{2}} + \\dfrac{${CF}}{(${fac(x)})^{3}}`;
      const singleE = (x: number) => pvE(flows, x);
      const avg = (rates[0] + rates[1] + rates[2]) / 3;
      const correctLatex = useForwards
        ? `\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{(${g[0]})(${g[1]})} + \\dfrac{${CF}}{(${g[0]})(${g[1]})(${g[2]})}`
        : `\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{(${g[1]})^{2}} + \\dfrac{${CF}}{(${g[2]})^{3}}`;
      const stem = useForwards
        ? `The one-year forward rates are $f_{0,1} = ${mpc(f[0], 2)}$, $f_{1,2} = ${mpc(f[1], 2)}$ and $f_{2,3} = ${mpc(f[2], 2)}$. A 3-year bond of face ${F} pays annual coupons at a rate of ${pc(r)}.\n\nWhich of the following expressions equals the price of the bond?`
        : `The annual effective spot rates are $s_1 = ${mpc(s[0])}$, $s_2 = ${mpc(s[1])}$ and $s_3 = ${mpc(s[2])}$. A 3-year bond of face ${F} pays annual coupons at a rate of ${pc(r)}.\n\nWhich of the following expressions equals the price of the bond?`;
      const distractors = [
        useForwards
          ? { content: math(`\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{(${g[1]})^{2}} + \\dfrac{${CF}}{(${g[2]})^{3}}`), misconception: "CONC_ALM_FORWARD_AS_SPOT" as const, why: "Each forward rate applies to one year only; a payment at time $t$ is discounted through all the forward factors before it.", probe: `(${lit(C)}/(1+${lit(f[0])})+${lit(C)}/(1+${lit(f[1])})**2+${lit(C + F)}/(1+${lit(f[2])})**3)`, stage: 0, failure: "selection" as const, confusedWith: "alm.spot-forward" }
          : { content: math(`\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{${g[1]}} + \\dfrac{${CF}}{${g[2]}}`), misconception: "CONC_ALM_SPOT_NOT_COMPOUNDED" as const, why: "A spot rate is annual; a payment at time $t$ is discounted by $(1+s_t)^t$.", probe: `(${lit(C)}/(1+${lit(s[0])})+${lit(C)}/(1+${lit(s[1])})+${lit(C + F)}/(1+${lit(s[2])}))`, stage: 0, failure: "application" as const },
        { content: math(single(rates[2])), misconception: "MODEL_SINGLE_RATE" as const, why: "Discounting every payment at the last rate ignores the term structure: earlier payments have their own rates.", probe: singleE(rates[2]), stage: 1, failure: "selection" as const, conditionTrue: "It would be correct for a flat curve.", confusedWith: "alm.single-yield" },
        { content: math(single(Math.round(avg * 1e6) / 1e6)), misconception: "CONC_ALM_RETURNS_AVERAGED" as const, why: "An average of the rates is not the bond's yield and does not discount each payment correctly.", probe: singleE(Math.round(avg * 1e6) / 1e6), stage: 1, failure: "selection" as const },
        {
          content: math(useForwards ? `\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{(${g[0]})(${g[1]})} + \\dfrac{${Cm}}{(${g[0]})(${g[1]})(${g[2]})}` : `\\dfrac{${Cm}}{${g[0]}} + \\dfrac{${Cm}}{(${g[1]})^{2}} + \\dfrac{${Cm}}{(${g[2]})^{3}}`),
          misconception: "CONC_IGNORED_REDEMPTION" as const,
          why: "The face amount repaid at time 3 is part of the bond's cash flows.",
          probe: useForwards ? `(${lit(C)}/(1+${lit(f[0])})+${lit(C)}/((1+${lit(f[0])})*(1+${lit(f[1])}))+${lit(C)}/((1+${lit(f[0])})*(1+${lit(f[1])})*(1+${lit(f[2])})))` : spotPvE(flows.map((x) => ({ t: x.t, amount: C })), s),
          stage: 2,
          failure: "application" as const,
        },
        ...(useForwards
          ? [{ content: math(single(f[0])), misconception: "CONC_ALM_FORWARD_KNOWN_FUTURE" as const, why: "Discounting everything at today's one-year rate ignores the later forward rates.", probe: singleE(f[0]), stage: 1, failure: "selection" as const }]
          : []),
      ];
      return conceptQuestion({
        stem,
        correct: { content: math(correctLatex), why: `Each payment is discounted at the spot rate for its date${useForwards ? ", which is the product of the forward factors up to that date" : ""}: the price is ${mnum(flows.reduce((x, fl) => x + fl.amount * Math.pow(1 + sp[fl.t - 1], -fl.t), 0), 2)}.`, probe: truthE },
        distractors,
        reference: { values: [{ label: "P", expr: useForwards ? spotPvE(flows, sp) : truthE }], description: "The price is the sum of each payment times the discount factor for its date; each expression is evaluated and compared with it." },
        steps: [
          { concept: "alm.spot-forward", reasoning: useForwards ? "The discount factor for time $t$ is $\\prod_{k<t}(1+f_{k,k+1})^{-1} = (1+s_t)^{-t}$." : "The discount factor for time $t$ is $(1+s_t)^{-t}$." },
          { concept: "bond.price-yield", reasoning: `The bond pays ${Cm} at times 1 and 2 and ${CF} at time 3.` },
          { concept: "alm.ytm-vs-spot", reasoning: "Each payment gets its own discount factor; a single rate would be the bond's yield, which is what the price defines, not what it is computed from." },
        ],
        concepts,
        conditions: ["Annual effective rates; annual coupons.", "No arbitrage: every payment is valued with today's term structure."],
        relationship: "$P = \\sum_t CF_t (1+s_t)^{-t}, \\qquad (1+s_t)^t = \\prod_{k=0}^{t-1}(1+f_{k,k+1})$",
        counterexample: "With a flat curve all the single-rate expressions would agree with the correct one.",
        transfer: { principle: "Price any fixed cash flows by discounting each at the spot rate (or chained forward rates) for its own date.", unusual: useForwards ? "Rates are given as forward rates." : "Spot rates differ by term.", misread: "A forward rate is not the discount rate for a whole $t$-year period." },
        itemFormat: "expression-selection",
        presentation: ["combined-topics"],
        features: { multiConcept: true },
        params: { r, s: s.join(","), variant },
      });
    }
    // Level 3: bootstrap s_3 (variant 0) or f_{2,3} (variant 1) from the bond's price.
    const P = Math.round(flows.reduce((x, fl) => x + fl.amount * Math.pow(1 + s[fl.t - 1], -fl.t), 0) * 100) / 100;
    const known = `${lit(C)}/(1+${lit(s[0])})+${lit(C)}/(1+${lit(s[1])})**2`;
    const knownL = `\\dfrac{${Cm}}{${fac(s[0])}} + \\dfrac{${Cm}}{(${fac(s[1])})^{2}}`;
    const spotEq = { latex: `${knownL} + \\dfrac{${CF}}{(1+x)^{3}} = ${mnum(P, 2)}`, probe: `(${known}+${lit(C + F)}/(1+x)**3-${lit(P)})` };
    const fwdEq = { latex: `${knownL} + \\dfrac{${CF}}{(${fac(s[1])})^{2}(1+x)} = ${mnum(P, 2)}`, probe: `(${known}+${lit(C + F)}/((1+${lit(s[1])})**2*(1+x))-${lit(P)})` };
    const ytmEq = { latex: `\\dfrac{${Cm}}{1+x} + \\dfrac{${Cm}}{(1+x)^{2}} + \\dfrac{${CF}}{(1+x)^{3}} = ${mnum(P, 2)}`, probe: `(${pvE(flows, "x")}-${lit(P)})` };
    const parEq = { latex: `${knownL} + \\dfrac{${CF}}{(1+x)^{3}} = ${F}`, probe: `(${known}+${lit(C + F)}/(1+x)**3-${F})` };
    const wantSpot = variant === 0;
    const correctEq = wantSpot ? spotEq : fwdEq;
    const target = wantSpot ? "the 3-year spot rate $s_3$" : "the one-year forward rate $f_{2,3}$";
    return conceptQuestion({
      stem: `The annual effective spot rates for 1 and 2 years are ${pc(s[0])} and ${pc(s[1])}. A 3-year bond of face ${F} with annual coupons at a rate of ${pc(r)} sells for ${mnum(P, 2)}.\n\nDetermine which of the following equations ${target}, written $x$, satisfies.`,
      correct: { content: math(correctEq.latex), why: wantSpot ? `The first two coupons are valued at their own spot rates; the final payment is discounted at the unknown $s_3$ for three years. The root is $s_3 = ${mpct(s[2], 3)}$.` : `The final payment is discounted to time 2 at $f_{2,3}$ and then to time 0 at $s_2$. The root is $f_{2,3} = ${mpct(fwd(s, 2, 3), 3)}$.`, probe: correctEq.probe },
      distractors: [
        wantSpot
          ? { content: math(fwdEq.latex), misconception: "CONC_RELATED_TERM", why: "This equation's unknown is the forward rate for the third year, not the 3-year spot rate.", probe: fwdEq.probe, stage: 2, failure: "interpretation", confusedWith: "alm.spot-forward" }
          : { content: math(spotEq.latex), misconception: "CONC_RELATED_TERM", why: "This equation's unknown is the 3-year spot rate, not the forward rate for the third year.", probe: spotEq.probe, stage: 2, failure: "interpretation", confusedWith: "alm.spot-forward" },
        { content: math(ytmEq.latex), misconception: "CONC_ALM_SPOT_AS_YTM", why: "Discounting every payment at one unknown rate defines the bond's yield to maturity, which blends all three spot rates.", probe: ytmEq.probe, stage: 1, failure: "selection", conditionTrue: "It would give $s_3$ if the curve were flat.", confusedWith: "alm.ytm-vs-spot" },
        wantSpot
          ? { content: math(`${knownL} + \\dfrac{${CF}}{1+x} = ${mnum(P, 2)}`), misconception: "CONC_ALM_SPOT_NOT_COMPOUNDED", why: "The 3-year spot rate discounts over three years: $(1+s_3)^{-3}$.", probe: `(${known}+${lit(C + F)}/(1+x)-${lit(P)})`, stage: 2, failure: "application" }
          : { content: math(`${knownL} + \\dfrac{${CF}}{(${fac(s[1])})^{2}(1+x)^{3}} = ${mnum(P, 2)}`), misconception: "CONC_ALM_FORWARD_AS_SPOT", why: "The forward rate covers one year, from time 2 to time 3, so it enters once.", probe: `(${known}+${lit(C + F)}/((1+${lit(s[1])})**2*(1+x)**3)-${lit(P)})`, stage: 2, failure: "application" },
        { content: math(wantSpot ? parEq.latex : `${knownL} + \\dfrac{${CF}}{(${fac(s[1])})^{2}(1+x)} = ${F}`), misconception: "CONC_PAR_ASSUMPTION", why: "The bond's actual price, not its face, is the value of its payments.", probe: wantSpot ? parEq.probe : `(${known}+${lit(C + F)}/((1+${lit(s[1])})**2*(1+x))-${F})`, stage: 1, failure: "interpretation" },
        { content: math(wantSpot ? `${knownL} + \\dfrac{${mamt(F)}}{(1+x)^{3}} = ${mnum(P, 2)}` : `${knownL} + \\dfrac{${mamt(F)}}{(${fac(s[1])})^{2}(1+x)} = ${mnum(P, 2)}`), misconception: "TRANS_IGNORED_CONDITION", why: "The final payment is the last coupon plus the face amount.", probe: wantSpot ? `(${known}+${F}/(1+x)**3-${lit(P)})` : `(${known}+${F}/((1+${lit(s[1])})**2*(1+x))-${lit(P)})`, stage: 1, failure: "application" },
      ],
      reference: { values: [{ label: wantSpot ? "s3" : "f23", expr: correctEq.probe, bracket: [-0.2, 0.5] }], description: `Valuing the coupons at the known spot rates leaves one unknown discount factor for time 3; the price was generated from $s_3 = ${mpct(s[2], 3)}$.` },
      steps: [
        { concept: "bond.price-yield", reasoning: `The price ${mnum(P, 2)} equals the PV of ${Cm} at times 1 and 2 and ${CF} at time 3.` },
        { concept: "alm.spot-forward", reasoning: "Value the first two payments at the known spot rates $s_1$ and $s_2$." },
        { concept: "alm.ytm-vs-spot", reasoning: "The remaining unknown is the discount factor for time 3, not a single yield for the whole bond." },
        { concept: "alm.spot-forward", reasoning: wantSpot ? "Write that factor as $(1+s_3)^{-3}$." : "Write that factor as $(1+s_2)^{-2}(1+f_{2,3})^{-1}$." },
      ],
      concepts,
      conditions: ["Annual effective rates; annual coupons.", "The bond is priced consistently with the spot curve."],
      relationship: "$P = \\dfrac{C}{1+s_1} + \\dfrac{C}{(1+s_2)^2} + \\dfrac{C+F}{(1+s_3)^3}$",
      counterexample: "If the curve were flat, the yield-to-maturity equation would give the same root.",
      transfer: { principle: "Bootstrapping: value the known payments at known spot rates and solve for the one unknown discount factor.", unusual: "The price is given and a rate is the unknown.", misread: "The unknown rate is not the bond's yield." },
      itemFormat: "equation-selection",
      presentation: ["hidden-structure", "work-backwards"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { r, P, s: s.join(","), variant },
    });
  },
});

// ================================================================ yield curves

const curveShape: ChoiceTemplate = conceptTemplate({
  id: "con-alm-curve-shape",
  family: "con-alm-yield-curve",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "relationships"],
  soaConcept: "What a rising or an inverted spot curve implies for forward rates and coupon-bond yields.",
  variants: 2,
  generate(rng, level, variant) {
    const rising = variant === 0;
    const steps = [
      { concept: "alm.spot-forward", reasoning: "$(1+s_{t+1})^{t+1} = (1+s_t)^t(1+f_{t,t+1})$: the longer spot rate is a geometric average of $s_t$ (over $t$ years) and $f_{t,t+1}$." },
      { concept: "alm.yield-curve-shape", reasoning: `For the average to ${rising ? "rise above" : "fall below"} $s_t$, the new forward rate must lie ${rising ? "above" : "below"} $s_{t+1}$.` },
      { concept: "alm.ytm-vs-spot", reasoning: `A coupon bond's yield blends the spot rates of all its payment dates, which are ${rising ? "lower" : "higher"} than $s_n$.` },
    ];
    const common = {
      conditions: ["Annual effective spot rates.", "No arbitrage."],
      relationship: "$(1+s_{t+1})^{t+1} = (1+s_t)^t(1+f_{t,t+1})$",
      transfer: {
        principle: "A spot rate is an average of the forward rates before it; an average moves toward each new term.",
        unusual: "Only the shape of the curve is given.",
        misread: "Forward rates lie beyond the spot curve, not between its points.",
      },
    };
    if (level === 1) {
      const above = rising ? "exceeds" : "is less than";
      const below = rising ? "is less than" : "exceeds";
      return conceptQuestion({
        stem: `Annual effective spot rates $s_t$ ${rising ? "increase" : "decrease"} with term $t$. Let $f_{t,t+1}$ be the one-year forward rate from time $t$ to time $t+1$.\n\nWhich of the following must be true?`,
        correct: { content: `Each forward rate $f_{t,t+1}$ ${above} the spot rate $s_{t+1}$.`, why: `$s_{t+1}$ averages $s_t$ (weight $t$) and $f_{t,t+1}$ (weight 1); for $s_{t+1}$ to ${rising ? "exceed" : "fall below"} $s_t$, $f_{t,t+1}$ must ${rising ? "exceed" : "fall below"} $s_{t+1}$.` },
        distractors: [
          { content: `Each forward rate $f_{t,t+1}$ ${below} the spot rate $s_{t+1}$.`, misconception: "CONC_ALM_CURVE_SLOPE_REVERSED", why: "This is the pattern of the opposite curve shape.", stage: 1, failure: "application", conditionTrue: `It holds when spot rates ${rising ? "decrease" : "increase"} with term.` },
          { content: "Each forward rate $f_{t,t+1}$ lies between the spot rates $s_t$ and $s_{t+1}$.", misconception: "CONC_ALM_RETURNS_AVERAGED", why: "The spot rate is the average; the forward rate is the new term that pulls it, so it lies beyond $s_{t+1}$.", stage: 1, failure: "connection" },
          { content: `The yield to maturity of an $n$-year coupon bond ${above} the spot rate $s_n$.`, misconception: "CONC_ALM_SPOT_AS_YTM", why: `The coupons are discounted at shorter spot rates, which are ${rising ? "below" : "above"} $s_n$, so the yield is ${rising ? "below" : "above"} $s_n$.`, stage: 2, failure: "application", confusedWith: "alm.ytm-vs-spot" },
          { content: "Any $n$-year bond can be priced by discounting all of its payments at $s_n$.", misconception: "MODEL_SINGLE_RATE", why: "Each payment must be discounted at the spot rate for its own date.", stage: 2, failure: "selection", conditionTrue: "It would be true only for a flat curve.", confusedWith: "alm.single-yield" },
          { content: "The one-year spot rate one year from now will equal today's forward rate $f_{1,2}$.", misconception: "CONC_ALM_FORWARD_KNOWN_FUTURE", why: "A forward rate can be locked in today; it is not a known future spot rate.", stage: 0, failure: "interpretation" },
        ],
        steps,
        ...common,
        itemFormat: "interpretation",
        presentation: ["direct"],
        params: { variant },
      });
    }
    const s = drawUntil(() => spotCurve(rng, 3, rising ? 1 : -1), (c) => c.every((x) => x > 0.01));
    const r = gridRate(rng, 0.02, 0.1, 0.005);
    const flows: Flow[] = [{ t: 1, amount: 100 * r }, { t: 2, amount: 100 * r }, { t: 3, amount: 100 + 100 * r }];
    const f23 = fwdE(s, 2, 3);
    const spotP = spotPvE(flows, s);
    const atS3 = pvE(flows, s[2]);
    return conceptQuestion({
      stem: `The table shows annual effective spot rates. Let $f_{2,3}$ be the one-year forward rate from time 2 to time 3, and consider a 3-year bond with annual coupons at a rate of ${pc(r)}.\n\nWhich of the following is true?`,
      exhibits: [spotTable(s)],
      correct: { content: rising ? "$f_{2,3}$ is greater than $s_3$." : "$f_{2,3}$ is less than $s_3$.", why: `$f_{2,3} = ${mpct(fwd(s, 2, 3), 3)}$ ${rising ? "exceeds" : "is below"} $s_3 = ${mpc(s[2])}$ because the curve ${rising ? "rises" : "falls"}.`, check: { expr: f23, op: rising ? ">" : "<", than: lit(s[2]) } },
      distractors: [
        { content: rising ? "$f_{2,3}$ is less than $s_2$." : "$f_{2,3}$ is greater than $s_2$.", misconception: "CONC_ALM_CURVE_SLOPE_REVERSED", why: "On this curve the forward rate lies beyond $s_3$, not below the shorter rate.", check: { expr: f23, op: rising ? "<" : ">", than: lit(s[1]) }, stage: 1, failure: "application" },
        { content: "$f_{2,3}$ lies between $s_2$ and $s_3$.", misconception: "CONC_ALM_RETURNS_AVERAGED", why: "$s_3$ is the average; $f_{2,3}$ lies outside the interval.", check: { expr: `((${f23})-${lit(s[1])})*((${f23})-${lit(s[2])})`, op: "<", than: 0 }, stage: 1, failure: "connection" },
        { content: `The bond's yield to maturity is ${rising ? "greater" : "less"} than $s_3$.`, misconception: "CONC_ALM_SPOT_AS_YTM", why: `The coupons are discounted at the ${rising ? "lower" : "higher"} rates $s_1$ and $s_2$, so the yield is ${rising ? "below" : "above"} $s_3$.`, check: { expr: `(${spotP})-(${atS3})`, op: rising ? "<" : ">", than: 0 }, stage: 2, failure: "application", confusedWith: "alm.ytm-vs-spot" },
        { content: "The bond's price is the value of its payments discounted at $s_3$.", misconception: "MODEL_SINGLE_RATE", why: "Each payment is discounted at its own spot rate.", check: { expr: spotP, op: "=", than: atS3 }, stage: 2, failure: "selection", confusedWith: "alm.single-yield" },
        { content: "The one-year spot rate at time 2 will be $f_{2,3}$.", misconception: "CONC_ALM_FORWARD_KNOWN_FUTURE", why: "The future one-year rate is unknown today; $f_{2,3}$ is the rate that can be locked in now.", stage: 0, failure: "interpretation" },
      ],
      steps,
      ...common,
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { multiConcept: true },
      params: { s: s.join(","), r, variant },
    });
  },
});

const couponEffect: ChoiceTemplate = conceptTemplate({
  id: "con-alm-curve-coupon-effect",
  family: "con-alm-yield-curve",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward", "BONDS.yield"],
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["concept_recognition", "financial_intuition"],
  soaConcept: "How the coupon rate moves a bond's yield to maturity relative to the spot rate for its term.",
  variants: 2,
  generate(rng, level, variant) {
    const rising = variant === 0;
    const n = 4;
    const s = drawUntil(() => spotCurve(rng, n, rising ? 1 : -1), (c) => c.every((x) => x > 0.01));
    const bond = (r: number): Flow[] => Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: 100 * r + (k + 1 === n ? 100 : 0) }));
    if (level === 2) {
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const fl = bond(r);
      const a = `((${spotPvE(fl, s)})-(${pvE(fl, s[n - 1])}))`;
      const zero: Flow[] = [{ t: n, amount: 100 }];
      const corr = rising
        ? "$y_C < y_Z$: part of the coupon bond's value is discounted at the lower short-term spot rates."
        : "$y_C > y_Z$: part of the coupon bond's value is discounted at the higher short-term spot rates.";
      const rev = rising
        ? "$y_C > y_Z$: the coupons add income, so the coupon bond's yield is the higher one."
        : "$y_C < y_Z$: the coupons are paid sooner, so the coupon bond's yield is the lower one.";
      const avg = s.reduce((x, y) => x + y, 0) / n;
      return conceptQuestion({
        stem: `The table shows annual effective spot rates. Bond Z is a ${n}-year zero-coupon bond and bond C is a ${n}-year bond with annual coupons at a rate of ${pc(r)}. Their yields to maturity are $y_Z$ and $y_C$.\n\nWhich of the following is true?`,
        exhibits: [spotTable(s)],
        correct: { content: corr, why: `$y_Z = s_${n} = ${mpc(s[n - 1])}$. Bond C's yield is a blend of $s_1, \\ldots, s_${n}$, all ${rising ? "below" : "above"} $s_${n}$ except the last, so $y_C$ is ${rising ? "below" : "above"} $y_Z$.`, check: { expr: a, op: rising ? ">" : "<", than: 0 } },
        distractors: [
          { content: rev, misconception: "CONC_DIRECTION_REVERSED", why: `What matters is the rates at which the coupons are discounted; on this curve they are ${rising ? "lower" : "higher"} than $s_${n}$.`, check: { expr: a, op: rising ? "<" : ">", than: 0 }, stage: 2, failure: "application", conditionTrue: `It would hold if spot rates ${rising ? "fell" : "rose"} with term.` },
          { content: "$y_C = y_Z$: bonds with the same maturity have the same yield to maturity.", misconception: "CONC_ALM_SPOT_AS_YTM", why: "Yields depend on the timing of all the payments, not only the maturity.", check: { expr: a, op: "=", than: 0 }, stage: 0, failure: "recognition", conditionTrue: "It would hold for a flat curve.", confusedWith: "alm.ytm-vs-spot" },
          { content: `$y_Z < s_${n}$: a zero-coupon bond's yield lies below the spot rate for its term.`, misconception: "CONC_RELATED_TERM", why: "A zero-coupon bond's yield is, by definition, the spot rate for its term.", check: { expr: `((${pvE(zero, s[n - 1])})-(${spotPvE(zero, s)}))`, op: "<", than: 0 }, stage: 0, failure: "recognition", confusedWith: "alm.spot-forward" },
          { content: `$y_C$ equals the average of $s_1$ to $s_${n}$, since each year counts equally.`, misconception: "CONC_ALM_RETURNS_AVERAGED", why: "The yield weights the rates by the present values of the payments, dominated by the redemption at time " + n + ".", check: { expr: pvE(fl, Math.round(avg * 1e8) / 1e8), op: "=", than: spotPvE(fl, s) }, stage: 1, failure: "selection" },
        ],
        steps: [
          { concept: "alm.ytm-vs-spot", reasoning: `A zero-coupon bond's yield is the spot rate for its term: $y_Z = s_${n}$.` },
          { concept: "alm.ytm-vs-spot", reasoning: "A coupon bond's yield is the single rate that reproduces its price, a PV-weighted blend of the spot rates of its payment dates." },
          { concept: "alm.yield-curve-shape", reasoning: `On a ${rising ? "rising" : "falling"} curve the earlier spot rates are ${rising ? "lower" : "higher"}, so the blend is ${rising ? "below" : "above"} $s_${n}$.` },
        ],
        conditions: ["Annual effective spot rates; annual coupons.", "Both bonds priced from the same spot curve."],
        relationship: "$\\sum_t CF_t(1+y)^{-t} = \\sum_t CF_t(1+s_t)^{-t}$",
        counterexample: "With a flat curve, every bond's yield equals the common spot rate.",
        transfer: { principle: "A coupon bond's yield sits between the spot rates of its payment dates, closest to those carrying most present value.", unusual: "No yield needs to be computed.", misread: "A higher coupon does not mean a higher yield." },
        itemFormat: "comparative-statics",
        presentation: ["compare-streams"],
        params: { s: s.join(","), r, variant },
      });
    }
    // Level 3: three bonds, data as zero-coupon prices.
    const P = s.map((x, k) => Math.round(100 * Math.pow(1 + x, -(k + 1)) * 10000) / 10000);
    const sp = P.map((p, k) => Math.pow(100 / p, 1 / (k + 1)) - 1);
    const rL = gridRate(rng, 0.01, 0.04, 0.005);
    const rH = gridRate(rng, 0.08, 0.14, 0.01);
    const fL = bond(rL);
    const fH = bond(rH);
    const priceE = (fl: Flow[]) => sumOf(fl.map((x) => `${lit(x.amount)}*${lit(P[x.t - 1])}/100`));
    const price = (fl: Flow[]) => fl.reduce((t, x) => t + (x.amount * P[x.t - 1]) / 100, 0);
    const yL = solveRoot((y) => pvFlows(fL, y) - price(fL), -0.5, 1);
    const yZ = `((100/${lit(P[n - 1])})**(1/${n})-1)`;
    const a1 = `((${priceE(fH)})-(${pvE(fH, yL)}))`; // > 0 iff y_H < y_L
    const a2 = `((${priceE(fL)})-(${pvE(fL, yZ)}))`; // > 0 iff y_L < y_Z
    const neg = (e: string) => `(-(${e}))`;
    const opts = rising
      ? { c: "$y_H < y_L < y_Z$", d1: "$y_L < y_H < y_Z$", d2: "$y_Z < y_L < y_H$", d4: "$y_H = y_L < y_Z$", cc: minE(a1, a2), c1: minE(neg(a1), a2), c2: minE(neg(a2), neg(a1)) }
      : { c: "$y_Z < y_L < y_H$", d1: "$y_Z < y_H < y_L$", d2: "$y_H < y_L < y_Z$", d4: "$y_Z < y_H = y_L$", cc: minE(neg(a1), neg(a2)), c1: minE(a1, neg(a2)), c2: minE(a1, a2) };
    return conceptQuestion({
      stem: `The table shows the prices of zero-coupon bonds of face 100. Three ${n}-year bonds of face 100 are priced consistently with them: bond Z pays no coupons, bond L pays annual coupons at ${pc(rL)} and bond H pays annual coupons at ${pc(rH)}. Their annual effective yields to maturity are $y_Z$, $y_L$ and $y_H$.\n\nWhich of the following is true?`,
      exhibits: [{ type: "table", columns: ["Maturity (years)", ...P.map((_, k) => String(k + 1))], rows: [["Zero-coupon price", ...P.map((p) => mnum(p, 4).replace(/\{,\}/g, ","))]] }],
      correct: { content: opts.c, why: `The prices imply spot rates ${sp.map((x) => pc(x, 2)).join(", ")}, ${rising ? "rising" : "falling"} with term. $y_Z = s_${n}$; a coupon bond's yield is pulled toward the ${rising ? "lower" : "higher"} short rates, and more so the larger its coupons.`, check: { expr: opts.cc, op: ">", than: 0 } },
      distractors: [
        { content: opts.d1, misconception: "CONC_DIRECTION_REVERSED", why: "A larger coupon puts more value on early dates, moving the yield further toward the short spot rates, not back toward $s_4$.", check: { expr: opts.c1, op: ">", than: 0 }, stage: 3, failure: "application" },
        { content: opts.d2, misconception: "CONC_ALM_CURVE_SLOPE_REVERSED", why: `The implied spot rates ${rising ? "rise" : "fall"} with term, so the coupon bonds' yields lie ${rising ? "below" : "above"} $y_Z$.`, check: { expr: opts.c2, op: ">", than: 0 }, stage: 1, failure: "interpretation" },
        { content: "$y_H = y_L = y_Z$", misconception: "CONC_ALM_SPOT_AS_YTM", why: "Equal maturities do not give equal yields when spot rates differ by term.", check: { expr: `sqrt((${a1})**2+(${a2})**2)`, op: "=", than: 0 }, stage: 2, failure: "recognition", conditionTrue: "It would hold for a flat curve.", confusedWith: "alm.ytm-vs-spot" },
        { content: opts.d4, misconception: "MODEL_SINGLE_RATE", why: "Bonds with different coupons weight the spot rates differently, so their yields differ.", check: { expr: a1, op: "=", than: 0 }, stage: 3, failure: "connection", confusedWith: "alm.single-yield" },
      ],
      steps: [
        { concept: "alm.spot-forward", reasoning: "A zero-coupon price of face 100 is $100(1+s_t)^{-t}$, so the table gives the spot rates." },
        { concept: "alm.yield-curve-shape", reasoning: `The implied spot rates ${rising ? "rise" : "fall"} with term.` },
        { concept: "alm.ytm-vs-spot", reasoning: `$y_Z = s_${n}$; each coupon bond's yield blends $s_1, \\ldots, s_${n}$ with present-value weights.` },
        { concept: "alm.ytm-vs-spot", reasoning: "The larger the coupon, the more weight on the early rates, so the further the yield moves from $s_4$." },
      ],
      concepts: ["alm.spot-forward", "alm.yield-curve-shape", "alm.ytm-vs-spot"],
      conditions: ["Annual coupons; prices consistent with one spot curve.", "Yields are annual effective."],
      relationship: "$\\sum_t CF_t(1+y)^{-t} = \\sum_t CF_t\\,P_t/100$",
      counterexample: "With a flat curve all three yields coincide.",
      transfer: { principle: "Read the curve's shape from the prices, then place each yield by where its present value sits on the timeline.", unusual: "Spot rates are hidden in zero-coupon prices and three bonds are ranked.", misread: "Higher coupon income is not a higher yield." },
      itemFormat: "comparative-statics",
      presentation: ["hidden-structure", "compare-streams"],
      modelingDecisions: 1,
      features: { unfamiliar: true, multiConcept: true },
      params: { P: P.join(","), rL, rH, variant },
    });
  },
});

const curveStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-curve-statements",
  family: "con-alm-yield-curve",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "terminology"],
  soaConcept: "Statements about spot rates, forward rates and yields on a given term structure.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.spot-forward", reasoning: "Spot and forward rates are linked by $(1+s_{t+1})^{t+1} = (1+s_t)^t(1+f_{t,t+1})$." },
      { concept: "alm.yield-curve-shape", reasoning: "Compare each forward rate with the spot rates around it using the curve's shape." },
      { concept: "alm.ytm-vs-spot", reasoning: "A coupon bond's yield blends the spot rates of all its payment dates." },
    ];
    const common = {
      steps,
      conditions: ["Annual effective rates.", "No arbitrage."],
      relationship: "$(1+s_n)^n = \\prod_{t=0}^{n-1}(1+f_{t,t+1})$",
      transfer: { principle: "Spot rates are geometric averages of forward rates; yields are PV-weighted blends of spot rates.", unusual: "Several relationships are judged together.", misread: "Arithmetic averages of rates are not the compound rates." },
    };
    if (level === 1) {
      const statements =
        variant === 0
          ? [
              statement("I", "If spot rates increase with term, then $f_{t,t+1} > s_{t+1}$ for every $t$.", true, "$s_{t+1}$ averages $s_t$ and $f_{t,t+1}$; it can exceed $s_t$ only if $f_{t,t+1}$ exceeds $s_{t+1}$.", "CONC_ALM_CURVE_SLOPE_REVERSED", { stage: 1, failure: "application" }),
              statement("II", "The yield to maturity of an $n$-year coupon bond equals the $n$-year spot rate $s_n$.", false, "The yield blends the spot rates of every payment date.", "CONC_ALM_SPOT_AS_YTM", { stage: 2, failure: "recognition", conditionTrue: "True for a zero-coupon bond, or when the curve is flat.", confusedWith: "alm.ytm-vs-spot" }),
              statement("III", "$(1+s_3)^3 = (1+s_1)(1+f_{1,2})(1+f_{2,3})$.", true, "Investing for three years equals rolling over one-year forward investments, starting with $f_{0,1} = s_1$.", "FORMULA_ARITHMETIC_FORWARD", { stage: 0, failure: "selection" }),
            ]
          : [
              statement("I", "If spot rates decrease with term, the yield to maturity of an $n$-year coupon bond exceeds $s_n$.", true, "The coupons are discounted at shorter spot rates, which are higher than $s_n$.", "CONC_ALM_SPOT_AS_YTM", { stage: 2, failure: "application", confusedWith: "alm.ytm-vs-spot" }),
              statement("II", "If spot rates decrease with term, then $f_{1,2} > s_2$.", false, "On a falling curve each forward rate lies below the longer spot rate.", "CONC_ALM_CURVE_SLOPE_REVERSED", { stage: 1, failure: "application", conditionTrue: "True when spot rates increase with term." }),
              statement("III", "The forward rate $f_{1,2}$ is the one-year spot rate that will prevail one year from now.", false, "It is the rate that can be fixed today; the future spot rate is not known.", "CONC_ALM_FORWARD_KNOWN_FUTURE", { stage: 0, failure: "interpretation" }),
            ];
      const truth = statements.filter((x) => x.truth).map((x) => x.key);
      const complement = statements.filter((x) => !x.truth).map((x) => x.key);
      return statementQuestion({
        stem: "Determine which of the following statements are true.",
        statements,
        extra: [
          { keys: complement, misconception: "MODEL_SINGLE_RATE", why: "Every statement is misjudged, as if one rate described the whole curve.", stage: 0, failure: "recognition" },
          { keys: variant === 0 ? ["II"] : ["II", "III"], misconception: "CONC_ALM_RETURNS_AVERAGED", why: "Treating rates as simple averages reverses the forward-rate and yield comparisons.", stage: 1, failure: "connection" },
          { keys: truth.length === 3 ? [] : ["I", "II", "III"], misconception: "CONC_RELATED_TERM", why: "Spot, forward and yield rates were treated as interchangeable.", stage: 0, failure: "recognition" },
        ],
        ...common,
        presentation: ["direct"],
        params: { variant },
      });
    }
    // Level 2: a specific curve, statements checked numerically.
    const r = gridRate(rng, 0.03, 0.1, 0.005);
    const s = drawUntil(
      () => {
        const s1 = gridRate(rng, 0.03, 0.06, 0.005);
        const d1 = rng.choice([-0.01, -0.005, 0.005, 0.01, 0.015]);
        const d2 = variant === 0 ? rng.choice([0.005, 0.01, -0.005, -0.01]) : rng.choice([-0.015, -0.01, 0.01, 0.015]);
        return [s1, Number((s1 + d1).toFixed(6)), Number((s1 + d1 + d2).toFixed(6))];
      },
      (c) => c.every((x) => x > 0.01) && Math.abs(fwd(c, 1, 2) - fwd(c, 2, 3)) > 0.002
    );
    const flows: Flow[] = [{ t: 1, amount: 100 * r }, { t: 2, amount: 100 * r }, { t: 3, amount: 100 + 100 * r }];
    const f12 = fwdE(s, 1, 2);
    const f23 = fwdE(s, 2, 3);
    const f13 = fwdE(s, 1, 3);
    const t1 = fwd(s, 2, 3) > s[2];
    const spotP = spotPvE(flows, s);
    const atS3 = pvE(flows, s[2]);
    const pSpot = flows.reduce((t, x) => t + x.amount * Math.pow(1 + s[x.t - 1], -x.t), 0);
    const pS3 = pvFlows(flows, s[2]);
    const t2 = pSpot > pS3;
    const statements = [
      statement("I", "$f_{2,3}$ exceeds $s_3$.", t1, `$f_{2,3} = ${mpct(fwd(s, 2, 3), 3)}$ and $s_3 = ${mpc(s[2])}$.`, "CONC_ALM_CURVE_SLOPE_REVERSED", { stage: 1, failure: "application", check: { expr: f23, op: ">", than: lit(s[2]) }, conditionTrue: t1 ? "It would fail if $s_3$ were below $s_2$." : "It would hold if $s_3$ were above $s_2$." }),
      statement("II", `A 3-year bond with annual coupons at ${pc(r)} has a yield to maturity below $s_3$.`, t2, `Its price at the spot rates, ${mnum(pSpot, 4)}, is ${t2 ? "above" : "below"} its value at the single rate $s_3$, ${mnum(pS3, 4)}, so its yield is ${t2 ? "below" : "above"} $s_3$.`, "CONC_ALM_SPOT_AS_YTM", { stage: 2, failure: "application", check: { expr: `(${spotP})-(${atS3})`, op: ">", than: 0 }, confusedWith: "alm.ytm-vs-spot" }),
      statement("III", "The annual effective forward rate $f_{1,3}$ for the two years from time 1 to time 3 equals the average of $f_{1,2}$ and $f_{2,3}$.", false, `$1 + f_{1,3} = \\sqrt{(1+f_{1,2})(1+f_{2,3})}$, a geometric mean, which is below the arithmetic mean when $f_{1,2} \\ne f_{2,3}$.`, "CONC_ALM_RETURNS_AVERAGED", { stage: 0, failure: "selection", check: { expr: f13, op: "=", than: `((${f12})+(${f23}))/2` } }),
    ];
    const truth = statements.filter((x) => x.truth).map((x) => x.key);
    const complement = statements.filter((x) => !x.truth).map((x) => x.key);
    return statementQuestion({
      stem: `The table shows annual effective spot rates. Let $f_{a,b}$ denote the annual effective forward rate from time $a$ to time $b$.\n\nDetermine which of the following statements are true.`,
      exhibitsBefore: [spotTable(s)],
      statements,
      extra: [
        { keys: complement, misconception: "MODEL_SINGLE_RATE", why: "Every statement is misjudged, as if one rate described the whole curve.", stage: 0, failure: "recognition" },
        { keys: truth.length === 3 ? ["I"] : ["I", "II", "III"], misconception: "FORMULA_ARITHMETIC_FORWARD", why: "Linear approximations to the forward rates hide the comparisons that decide the statements.", stage: 0, failure: "selection" },
        { keys: truth.length === 0 ? ["II", "III"] : [], misconception: "CONC_RELATED_TERM", why: "Spot, forward and yield rates were treated as interchangeable.", stage: 0, failure: "recognition" },
      ],
      ...common,
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { s: s.join(","), r, variant },
    });
  },
});

// ================================================================ duration

const durationMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-alm-duration-meaning",
  family: "con-alm-duration",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.duration",
  secondary: ["ALM.approx_pv_change"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "What Macaulay duration and modified duration measure, and how a stated duration is read.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.macaulay-vs-modified", reasoning: "Macaulay duration is the present-value-weighted mean time of the payments; modified duration is $-P'(i)/P(i) = D_{mac}/(1+i)$." },
      { concept: "alm.duration-approximation", reasoning: "Modified duration is the relative fall in value per unit rise in $i$, so a rise of 0.01 lowers the value by about $D_{mod}$ percent." },
    ];
    const conditions = ["Annual effective rate; flat yield curve.", "Cash flows fixed in amount and timing."];
    const relationship = "$D_{mac} = \\dfrac{\\sum t\\,CF_t v^t}{\\sum CF_t v^t}, \\qquad D_{mod} = -\\dfrac{P'(i)}{P(i)} = \\dfrac{D_{mac}}{1+i}$";
    if (level === 1) {
      const mac = variant === 0;
      const MAC = "The average time of the payments, each time weighted by the payment's present value.";
      const MOD = "$-P'(i)/P(i)$: the relative fall in value per unit increase in the interest rate.";
      return conceptQuestion({
        stem: `Let $P(i)$ be the present value at annual effective rate $i$ of a set of positive cash flows. Which of the following describes ${mac ? "the Macaulay" : "the modified"} duration of the cash flows?`,
        correct: { content: mac ? MAC : MOD, why: mac ? "Macaulay duration is $\\sum t\\,CF_t v^t / \\sum CF_t v^t$, a mean time with present-value weights." : "Modified duration is minus the derivative of $\\ln P(i)$, the proportional sensitivity of value to $i$." },
        distractors: [
          { content: mac ? MOD : MAC, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: mac ? "That is modified duration, $D_{mac}/(1+i)$." : "That is Macaulay duration, which is $(1+i)$ times the modified duration.", stage: 0, failure: "recognition", confusedWith: "alm.macaulay-vs-modified" },
          { content: "The average time of the payments, each time weighted by the payment's amount.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "The weights are present values, not amounts.", stage: 0, failure: "interpretation", conditionTrue: "Amount weights and present-value weights agree only at $i = 0$." },
          { content: "$-P'(i)$: the fall in value per unit increase in the interest rate.", misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "Without dividing by $P(i)$ this is a change in value, not a duration.", stage: 1, failure: "application" },
          { content: "$P''(i)/P(i)$: the relative curvature of value as a function of the interest rate.", misconception: "CONC_RELATED_TERM", why: "That is convexity, the second-order measure.", stage: 1, failure: "recognition", confusedWith: "alm.convexity" },
          { content: "The time of the last payment, at which the whole present value has been received.", misconception: "CONC_ALM_APPROX_EXACT", why: "Only a single payment has duration equal to its date; otherwise duration is below the last payment time.", stage: 0, failure: "interpretation" },
        ],
        steps,
        conditions,
        relationship,
        transfer: { principle: "Macaulay: a time. Modified: a relative sensitivity. Convexity: a curvature.", unusual: "Definitions are compared side by side.", misread: "Both durations are often written $D$; check which is meant." },
        itemFormat: "definition",
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const D = rng.int(40, 120) / 10;
    const mod = variant === 0;
    const Dt = mnum(D, 1);
    if (mod) {
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i)}, a liability stream has present value ${mamt(gridAmount(rng, 100000, 900000, 50000))} and modified duration ${Dt}. Which of the following best describes the meaning of ${Dt}?`,
        correct: { content: `If the rate rises by 0.01, the present value falls by approximately ${Dt}%.`, why: `$\\Delta P / P \\approx -D_{mod}\\,\\Delta i = -${Dt} \\times 0.01$, a fall of about ${Dt}%.` },
        distractors: [
          { content: `If the rate rises by 0.01, the present value falls by approximately ${Dt}.`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "Modified duration is a relative sensitivity: the change is a percentage of the present value.", stage: 1, failure: "interpretation" },
          { content: `The present-value-weighted average time of the payments is ${Dt} years.`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: `That describes Macaulay duration, here $${Dt} \\times ${lit(1 + i)} = ${mnum(D * (1 + i), 2)}$ years.`, stage: 0, failure: "recognition", confusedWith: "alm.macaulay-vs-modified" },
          { content: `If the rate rises by 0.01, the present value rises by approximately ${Dt}%.`, misconception: "CONC_PRICE_YIELD_DIRECTION", why: "Present values fall when the rate rises.", stage: 1, failure: "application" },
          { content: `If the rate rises by 0.01, the present value falls by exactly ${Dt}%.`, misconception: "CONC_ALM_APPROX_EXACT", why: "The relationship is first-order; convexity makes the true fall slightly smaller.", stage: 1, failure: "conclusion" },
          { content: `The average time of the payments, weighted by their amounts, is ${Dt} years.`, misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Duration uses present-value weights, and this number is a modified duration.", stage: 0, failure: "interpretation" },
        ],
        steps: [...steps, { concept: "alm.macaulay-vs-modified", reasoning: "A modified duration is not a time; it converts to a time only after multiplying by $1+i$." }],
        conditions,
        relationship,
        transfer: { principle: "Modified duration reads as a percentage change per 0.01 of rate; Macaulay duration reads as a time.", unusual: "A number is interpreted rather than computed.", misread: "The unit of modified duration is percent per point, not years." },
        itemFormat: "interpretation",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true },
        params: { i, D, variant },
      });
    }
    return conceptQuestion({
      stem: `At an annual effective rate of ${pc(i)}, a stream of positive payments has Macaulay duration ${Dt} years. Which of the following is true?`,
      correct: { content: `A single payment at time ${Dt} with the same present value has the same sensitivity to small changes in the rate.`, why: `A single payment at time $D$ has Macaulay duration $D$, hence the same modified duration $D/(1+i)$ and the same first-order response to $\\Delta i$.` },
      distractors: [
        { content: `If the rate rises by 0.01, the present value falls by approximately ${Dt}%.`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: `The percentage fall uses modified duration, $${Dt}/${lit(1 + i)} = ${mnum(D / (1 + i), 2)}$.`, stage: 1, failure: "application" },
        { content: `Half of the present value of the payments is due before time ${Dt} and half after.`, misconception: "CONC_RELATED_TERM", why: "Duration is a mean, not a median, of the payment times.", stage: 0, failure: "interpretation" },
        { content: `The average due date of the payments, weighted by their amounts, is ${Dt} years.`, misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Macaulay duration uses present-value weights.", stage: 0, failure: "interpretation" },
        { content: `A single payment at time ${Dt} with the same total amount has the same present value.`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Concentrating the payments at the duration preserves present value only if the amount is set from the present value, not the undiscounted total.", stage: 1, failure: "connection" },
        { content: `The present value would be unchanged if every payment were moved to time ${Dt}.`, misconception: "CONC_ALM_APPROX_EXACT", why: "Moving payments changes their present values; only the matching single payment of equal present value is equivalent, and only to first order.", stage: 1, failure: "conclusion" },
      ],
      steps: [...steps, { concept: "alm.duration-approximation", reasoning: "A single payment at time $D$ with the same present value is the stream's first-order equivalent." }],
      conditions,
      relationship,
      transfer: { principle: "A stream behaves, to first order, like one payment at its Macaulay duration with the same present value.", unusual: "The equivalence is stated in words.", misread: "Duration is a mean time, not a median." },
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { i, D, variant },
    });
  },
});

/** Closed-form annuity symbols as expressions at rate i. */
const ann = (n: number, i: number) => {
  const I = lit(i);
  const v = `(1+${I})**(-${n})`;
  const a = `((1-${v})/${I})`;
  const s = `(((1+${I})**${n}-1)/${I})`;
  return {
    a,
    s,
    Ia: `((${a}*(1+${I})-${n}*${v})/${I})`,
    Da: `((${n}-${a})/${I})`,
    Is: `((${s}*(1+${I})-${n})/${I})`,
    Ds: `((${n}*(1+${I})**${n}-${s})/${I})`,
  };
};
const sym = (name: "a" | "s" | "Ia" | "Da" | "Is" | "Ds", n: number | string) =>
  name.length === 1 ? `${name}_{\\overline{${n}|}}` : `(${name})_{\\overline{${n}|}}`;

const durationExpression: ChoiceTemplate = conceptTemplate({
  id: "con-alm-duration-expression",
  family: "con-alm-duration",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.duration",
  secondary: ["ANNUITIES.arithmetic"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "terminology"],
  reasoning: ["formula_selection", "formula_reconstruction"],
  soaConcept: "Symbolic expressions for the duration of level, bond and deferred payment streams.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(5, 20);
    const A = ann(n, i);
    const level1: Flow[] = Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: 1 }));
    const at = `all functions are evaluated at $i = ${mpc(i)}$`;
    const pick = (latex: string) => math(latex);
    if (level === 1) {
      const ref = durE(level1, i);
      const equivalent = variant === 1;
      return conceptQuestion({
        stem: `An annuity-immediate pays 1 at the end of each year for ${n} years. The annual effective rate is ${pc(i)}.\n\nWhich of the following expressions equals the Macaulay duration of the payments? In each expression ${at}.`,
        correct: equivalent
          ? { content: pick(`\\dfrac{${sym("Is", n)}}{${sym("s", n)}}`), why: `Accumulating every weight and the total to time ${n} multiplies both by $(1+i)^{${n}}$, so $(Is)/s = (Ia)/a$.`, probe: `${A.Is}/${A.s}` }
          : { content: pick(`\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`), why: "The numerator is $\\sum t v^t$ and the denominator $\\sum v^t$: present-value-weighted mean time.", probe: `${A.Ia}/${A.a}` },
        distractors: [
          { content: pick(`\\dfrac{${sym(equivalent ? "Is" : "Ia", n)}}{(1+i)\\,${sym(equivalent ? "s" : "a", n)}}`), misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "Dividing by $1+i$ gives modified duration.", probe: equivalent ? `${A.Is}/((1+${lit(i)})*${A.s})` : `${A.Ia}/((1+${lit(i)})*${A.a})`, stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
          { content: pick(`\\dfrac{${n + 1}}{2}`), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "That is the mean payment time with equal weights; present-value weights favour earlier payments.", probe: `${(n + 1) / 2}`, stage: 0, failure: "interpretation", conditionTrue: "It is the limit as $i \\to 0$." },
          { content: pick(`\\dfrac{${sym(equivalent ? "Ds" : "Da", n)}}{${sym(equivalent ? "s" : "a", n)}}`), misconception: "FORMULA_DECREASING_FOR_INCREASING", why: "The weights are $t = 1, 2, \\ldots$, an increasing sequence.", probe: equivalent ? `${A.Ds}/${A.s}` : `${A.Da}/${A.a}`, stage: 1, failure: "selection" },
          { content: pick(equivalent ? `\\dfrac{${sym("Ia", n)}}{${sym("s", n)}}` : sym("Ia", n)), misconception: equivalent ? "TIMING_VALUATION_DATE" : "CONC_ALM_DURATION_NOT_NORMALIZED", why: equivalent ? "Numerator and denominator must be valued at the same date." : "The weighted sum must be divided by the present value $a_{\\overline{n}|}$.", probe: equivalent ? `${A.Ia}/${A.s}` : A.Ia, stage: 2, failure: "application" },
          { content: pick(equivalent ? `\\dfrac{${sym("Is", n)}}{${sym("a", n)}}` : `\\dfrac{${sym("Ia", n)}}{${sym("s", n)}}`), misconception: equivalent ? "CONC_MOVED_WRONG_WAY" : "TIMING_VALUATION_DATE", why: "Numerator and denominator must be valued at the same date.", probe: equivalent ? `${A.Is}/${A.a}` : `${A.Ia}/${A.s}`, stage: 2, failure: "application" },
        ],
        reference: { values: [{ label: "D", expr: ref }], description: `The duration is computed term by term from the ${n} payments; each expression is evaluated and compared with it.` },
        steps: [
          { concept: "alm.macaulay-vs-modified", reasoning: "Macaulay duration is $\\sum t\\,v^t / \\sum v^t$ for level payments." },
          { concept: "alm.macaulay-vs-modified", reasoning: "$\\sum t\\,v^t = (Ia)_{\\overline{n}|}$ and $\\sum v^t = a_{\\overline{n}|}$; valuing both at time $n$ gives the same ratio." },
          { concept: "ann.annuity-value-date", reasoning: "Numerator and denominator must be valued at the same date, or the ratio picks up a factor $(1+i)^n$." },
        ],
        concepts: ["alm.macaulay-vs-modified", "ann.annuity-value-date"],
        conditions: ["Level annual payments; annual effective rate.", "Numerator and denominator valued at one date."],
        relationship: "$D = \\dfrac{(Ia)_{\\overline{n}|}}{a_{\\overline{n}|}} = \\dfrac{(Is)_{\\overline{n}|}}{s_{\\overline{n}|}}$",
        counterexample: "At $i = 0$ the duration reduces to $(n+1)/2$.",
        transfer: { principle: "Duration = (time-weighted value) / (value), both at one date.", unusual: equivalent ? "The correct expression is written at the end date." : "Annuity symbols stand for the sums.", misread: "$(Ia)$ alone is not a duration." },
        itemFormat: "expression-selection",
        presentation: equivalent ? ["valuation-date"] : ["direct"],
        params: { i, n, variant },
      });
    }
    if (level === 2) {
      const bond = variant === 0;
      const r = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - i) >= 0.01);
      const I = lit(i);
      const vn = `(1+${I})**(-${n})`;
      if (bond) {
        const fl: Flow[] = Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: r + (k + 1 === n ? 1 : 0) }));
        const R = lit(r);
        return conceptQuestion({
          stem: `A ${n}-year bond of face 1 pays annual coupons at a rate of ${pc(r)} and is priced at an annual effective yield of ${pc(i)}.\n\nWhich of the following expressions equals the bond's Macaulay duration? In each expression ${at}, and $v = 1/(1+i)$.`,
          correct: { content: pick(`\\dfrac{${R}\\,${sym("Ia", n)} + ${n}v^{${n}}}{${R}\\,${sym("a", n)} + v^{${n}}}`), why: "Coupons contribute $r(Ia)$ to the time-weighted value and $r\\,a$ to the price; the redemption contributes $n v^n$ and $v^n$.", probe: `(${R}*${A.Ia}+${n}*${vn})/(${R}*${A.a}+${vn})` },
          distractors: [
            { content: pick(`\\dfrac{${R}\\,${sym("Ia", n)} + ${n}v^{${n}}}{(1+i)\\left(${R}\\,${sym("a", n)} + v^{${n}}\\right)}`), misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The extra factor $1/(1+i)$ gives modified duration.", probe: `(${R}*${A.Ia}+${n}*${vn})/((1+${I})*(${R}*${A.a}+${vn}))`, stage: 2, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
            { content: pick(`\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`), misconception: "CONC_IGNORED_REDEMPTION", why: "The redemption at time " + n + " carries most of the present value and must be included.", probe: `${A.Ia}/${A.a}`, stage: 1, failure: "application" },
            { content: pick(`\\dfrac{${R}\\,${sym("Da", n)} + ${n}v^{${n}}}{${R}\\,${sym("a", n)} + v^{${n}}}`), misconception: "FORMULA_DECREASING_FOR_INCREASING", why: "The time weights $1, 2, \\ldots, n$ increase.", probe: `(${R}*${A.Da}+${n}*${vn})/(${R}*${A.a}+${vn})`, stage: 1, failure: "selection" },
            { content: pick(`\\dfrac{${R}\\cdot\\tfrac{${n}(${n + 1})}{2} + ${n}}{${R}\\cdot ${n} + 1}`), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Payments must be weighted by their present values, not their amounts.", probe: `(${R}*${(n * (n + 1)) / 2}+${n})/(${R}*${n}+1)`, stage: 0, failure: "interpretation" },
            { content: pick(`${R}\\,${sym("Ia", n)} + ${n}v^{${n}}`), misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "The time-weighted value must be divided by the price.", probe: `(${R}*${A.Ia}+${n}*${vn})`, stage: 2, failure: "application" },
          ],
          reference: { values: [{ label: "D", expr: durE(fl, i) }], description: "The duration is computed term by term from the coupons and redemption; each expression is evaluated and compared with it." },
          steps: [
            { concept: "bond.price-yield", reasoning: `The bond pays ${R} at times $1, \\ldots, ${n}$ and 1 at time ${n}; its price is $${R}a_{\\overline{${n}|}} + v^{${n}}$.` },
            { concept: "alm.macaulay-vs-modified", reasoning: `The time-weighted value is $${R}(Ia)_{\\overline{${n}|}} + ${n}v^{${n}}$.` },
            { concept: "alm.macaulay-vs-modified", reasoning: "Divide by the price for Macaulay duration (and by $1+i$ again only for modified duration)." },
          ],
          conditions: ["Annual coupons; annual effective yield.", "Redemption at face."],
          relationship: "$D = \\dfrac{r(Ia)_{\\overline{n}|} + n v^n}{r\\,a_{\\overline{n}|} + v^n}$",
          counterexample: "With $r = 0$ the expression reduces to $n$, the duration of a zero-coupon bond.",
          transfer: { principle: "Split the stream into recognisable pieces; add their time-weighted values and their values separately, then divide.", unusual: "Several symbols combine in one expression.", misread: "The redemption is part of both numerator and denominator." },
          itemFormat: "expression-selection",
          presentation: ["indirect-wording"],
          features: { multiConcept: true },
          params: { i, n, r, variant },
        });
      }
      const ref = `(${durE(level1, i)}/(1+${I}))`;
      return conceptQuestion({
        stem: `An annuity-immediate pays 1 at the end of each year for ${n} years. The annual effective rate is ${pc(i)}.\n\nWhich of the following expressions equals the modified duration of the payments? In each expression ${at}, and $v = 1/(1+i)$.`,
        correct: { content: pick(`v\\,\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`), why: "Modified duration is $-P'(i)/P(i) = \\sum t\\,v^{t+1} / \\sum v^t = v\\,(Ia)/a$.", probe: `${A.Ia}/${A.a}/(1+${I})` },
        distractors: [
          { content: pick(`\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`), misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "That is the Macaulay duration.", probe: `${A.Ia}/${A.a}`, stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
          { content: pick(`(1+i)\\,\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`), misconception: "ALG_INVERTED_RATIO", why: "Modified duration divides the Macaulay duration by $1+i$; it does not multiply it.", probe: `${A.Ia}/${A.a}*(1+${I})`, stage: 2, failure: "application" },
          { content: pick(`v\\,\\dfrac{${n + 1}}{2}`), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "The weights are present values, not equal amounts.", probe: `${(n + 1) / 2}/(1+${I})`, stage: 0, failure: "interpretation" },
          { content: pick(`v\\,\\dfrac{${sym("Da", n)}}{${sym("a", n)}}`), misconception: "FORMULA_DECREASING_FOR_INCREASING", why: "The time weights increase with $t$.", probe: `${A.Da}/${A.a}/(1+${I})`, stage: 1, failure: "selection" },
          { content: pick(`v\\,${sym("Ia", n)}`), misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "$-P'(i)$ must be divided by $P(i) = a_{\\overline{n}|}$.", probe: `${A.Ia}/(1+${I})`, stage: 2, failure: "application" },
        ],
        reference: { values: [{ label: "Dmod", expr: ref }], description: "Macaulay duration from the explicit payments, divided by $1+i$; each expression is evaluated and compared with it." },
        steps: [
          { concept: "alm.macaulay-vs-modified", reasoning: "$P(i) = a_{\\overline{n}|}$ and $-P'(i) = \\sum t\\,v^{t+1} = v\\,(Ia)_{\\overline{n}|}$." },
          { concept: "alm.macaulay-vs-modified", reasoning: "Modified duration is their ratio, $v(Ia)/a = D_{mac}/(1+i)$." },
          { concept: "alm.duration-approximation", reasoning: "This is the duration that enters the first-order approximation $\\Delta P/P \\approx -D_{mod}\\Delta i$." },
        ],
        conditions: ["Level annual payments; annual effective rate."],
        relationship: "$D_{mod} = -\\dfrac{P'(i)}{P(i)} = v\\,\\dfrac{(Ia)_{\\overline{n}|}}{a_{\\overline{n}|}}$",
        transfer: { principle: "Differentiate $v^t$ to get $-t\\,v^{t+1}$: modified duration carries one extra factor $v$.", unusual: "The question asks for modified, not Macaulay, duration.", misread: "Multiplying and dividing by $1 + i$ are easily swapped." },
        itemFormat: "expression-selection",
        presentation: ["indirect-wording"],
        features: { multiConcept: true },
        params: { i, n, variant },
      });
    }
    // Level 3: deferred streams.
    const k = rng.int(2, 6);
    const I = lit(i);
    const perpetuity = variant === 1;
    const stem = perpetuity
      ? `A perpetuity pays 1 at the end of each year, the first payment ${k + 1} years from now. The annual effective rate is ${pc(i)}.\n\nWhich of the following expressions equals the Macaulay duration of the payments?`
      : `A stream pays 1 at the end of each year for ${n} years, the first payment ${k + 1} years from now. The annual effective rate is ${pc(i)}.\n\nWhich of the following expressions equals the Macaulay duration of the payments? In each expression ${at}, and $v = 1/(1+i)$.`;
    const base = perpetuity ? `\\dfrac{${lit(1 + i)}}{${I}}` : `\\dfrac{${sym("Ia", n)}}{${sym("a", n)}}`;
    const baseE = perpetuity ? `((1+${I})/${I})` : `(${A.Ia}/${A.a})`;
    const ref = perpetuity ? `(${k}+1/(1-1/(1+${I})))` : durE(level1.map((f) => ({ t: f.t + k, amount: 1 })), i);
    return conceptQuestion({
      stem,
      correct: { content: pick(`${k} + ${base}`), why: `Delaying every payment by ${k} years adds ${k} to every payment time and leaves the present-value weights' proportions unchanged, so the duration increases by exactly ${k}.`, probe: `(${k}+${baseE})` },
      distractors: [
        { content: pick(base), misconception: "TIMING_IGNORED_DEFERRAL", why: `That is the duration of the stream starting at time 1; every payment here is ${k} years later.`, probe: baseE, stage: 0, failure: "recognition" },
        { content: pick(`${k + 1} + ${base}`), misconception: "TIMING_DEFERRAL_OFF_BY_ONE", why: `The first payment is at time ${k + 1}, which is ${k} years after time 1, the first payment of the undeferred stream.`, probe: `(${k + 1}+${baseE})`, stage: 1, failure: "application" },
        { content: pick(`v^{${k}}\\,${base}`), misconception: "TIMING_VALUATION_DATE", why: "Duration is a time, not a value: deferral shifts it; it is not discounted.", probe: `(1+${I})**(-${k})*${baseE}`, stage: 2, failure: "connection" },
        { content: pick(`${k} + ${perpetuity ? `\\dfrac{1}{${I}}` : `\\dfrac{${sym("Ia", n)}}{(1+i)\\,${sym("a", n)}}`}`), misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The expression added to the deferral is a modified duration.", probe: perpetuity ? `(${k}+1/${I})` : `(${k}+${A.Ia}/((1+${I})*${A.a}))`, stage: 3, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
        perpetuity
          ? { content: pick(`\\dfrac{${lit(1 + i)}}{(${I})^{2}}`), misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "$\\sum t\\,v^t = (1+i)/i^2$ must be divided by the present value.", probe: `((1+${I})/${I}**2)`, stage: 3, failure: "application" }
          : { content: pick(`${k} + \\dfrac{${n + 1}}{2}`), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Present-value weights, not equal weights, are needed.", probe: `${k + (n + 1) / 2}`, stage: 3, failure: "interpretation" },
      ],
      reference: { values: [{ label: "D", expr: ref }], description: perpetuity ? "The duration from $\\sum_{t>k} t v^t / \\sum_{t>k} v^t$, summed in closed form; each expression is evaluated and compared with it." : "The duration is computed term by term from the deferred payments; each expression is evaluated and compared with it." },
      steps: [
        { concept: "ann.annuity-value-date", reasoning: `The first payment is at time ${k + 1}: the stream is an ordinary ${perpetuity ? "perpetuity" : "annuity"} deferred ${k} years.` },
        { concept: "alm.macaulay-vs-modified", reasoning: `Each payment time is $t + ${k}$; each present value is multiplied by the same $v^{${k}}$, which cancels in the weights.` },
        { concept: "alm.macaulay-vs-modified", reasoning: `So $D = ${k} + D_0$, where $D_0$ is the duration of the undeferred stream${perpetuity ? ", $(1+i)/i$" : ", $(Ia)/a$"}.` },
        { concept: "alm.duration-approximation", reasoning: "The result is a Macaulay (time) duration; no factor $1/(1+i)$ is applied." },
      ],
      concepts: ["ann.annuity-value-date", "alm.macaulay-vs-modified"],
      conditions: ["Level annual payments; annual effective rate.", "Deferral shifts every payment by the same amount."],
      relationship: "$D(\\text{deferred } k) = k + D(\\text{undeferred})$",
      counterexample: "A single payment deferred $k$ years has duration equal to its new date, $k$ more than before.",
      transfer: { principle: "Shifting every payment by $k$ shifts the Macaulay duration by exactly $k$.", unusual: "The deferral must be recognised from the first payment date.", misread: "The first payment at time $k+1$ means a deferral of $k$, not $k+1$." },
      itemFormat: "expression-selection",
      presentation: ["hidden-structure"],
      modelingDecisions: 1,
      features: { unfamiliar: true, multiConcept: true },
      params: { i, n, k, variant },
    });
  },
});

// ================================================================ convexity

const convexityMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-alm-convexity-meaning",
  family: "con-alm-convexity",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.convexity",
  secondary: ["ALM.approx_pv_change"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "What convexity measures and how it ranks positions with equal value and duration.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.convexity", reasoning: "Convexity $C = P''(i)/P(i)$ is the relative curvature of the price–yield curve; it is positive for positive cash flows." },
      { concept: "alm.macaulay-vs-modified", reasoning: "Duration sets the slope (first-order term); convexity adds $\\tfrac12 C(\\Delta i)^2 \\ge 0$." },
    ];
    const conditions = ["Positive, fixed cash flows; flat yield curve.", "Annual effective rate."];
    const relationship = "$\\dfrac{\\Delta P}{P} \\approx -D_{mod}\\,\\Delta i + \\tfrac12 C\\,(\\Delta i)^2, \\qquad C = \\dfrac{\\sum t(t+1)CF_t v^{t+2}}{\\sum CF_t v^t}$";
    const n = rng.int(5, 15);
    const transfer = { principle: "Duration is the slope; convexity is the bend. At equal slope, more bend means more value after any move.", unusual: "Properties are compared rather than computed.", misread: "Convexity does not make a position more sensitive in the losing direction." };
    if (level === 1 && variant === 0) {
      return conceptQuestion({
        stem: "Let $P(i)$ be the present value at annual effective rate $i$ of a set of positive cash flows. Which of the following describes the convexity $P''(i)/P(i)$?",
        correct: { content: "The relative curvature of the price–yield curve; it sets the second-order term of the change in value.", why: "Convexity is the second derivative scaled by price; it enters as $\\tfrac12 C(\\Delta i)^2$." },
        distractors: [
          { content: "The relative slope of the price–yield curve; it sets the first-order term of the change in value.", misconception: "CONC_RELATED_TERM", why: "That is modified duration.", stage: 1, failure: "recognition", confusedWith: "alm.macaulay-vs-modified" },
          { content: "The present-value-weighted average of the squared payment times, $\\sum t^2 CF_t v^t / P$.", misconception: "FORMULA_MACAULAY_CONVEXITY", why: "That is Macaulay convexity; $P''/P$ uses $t(t+1)v^{t+2}$.", stage: 0, failure: "selection" },
          { content: "A negative number for a bond, because its price falls as the yield rises.", misconception: "CONC_ALM_CONVEXITY_SIGN", why: "The slope is negative; the curvature of positive cash flows is positive.", stage: 0, failure: "interpretation" },
          { content: "The amount by which the first-order estimate overstates the price when the yield falls.", misconception: "CONC_DIRECTION_REVERSED", why: "With positive convexity the first-order estimate understates the price for a fall (and a rise) in yield.", stage: 1, failure: "application" },
        ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "definition",
        presentation: ["direct"],
        params: { variant },
      });
    }
    if (level === 1) {
      return conceptQuestion({
        stem: `Two non-callable bonds have the same price and the same Macaulay duration, ${n} years, at the current yield. Bond A has the greater convexity. Which of the following is true after a small, immediate parallel change in the yield?`,
        correct: { content: "Bond A gains more if the yield falls and loses less if the yield rises.", why: "At equal price and slope, the more curved price–yield function lies above the other on both sides." },
        distractors: [
          { content: "Bond A gains more if the yield falls and loses more if the yield rises.", misconception: "CONC_RELATED_TERM", why: "That describes a longer duration, not a greater convexity.", stage: 1, failure: "connection", confusedWith: "alm.macaulay-vs-modified" },
          { content: "Bond A gains less if the yield falls and loses more if the yield rises.", misconception: "CONC_DIRECTION_REVERSED", why: "Extra convexity raises value on both sides.", stage: 1, failure: "application" },
          { content: "Both bonds change in price by the same amount, since price changes depend only on duration.", misconception: "CONC_IGNORED_CONVEXITY", why: "Duration matches the first-order term only; convexity separates them at second order.", stage: 1, failure: "conclusion" },
          { content: "Bond A's cash flows are more concentrated around " + n + " years, so its value is more stable.", misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "At equal duration, greater convexity means cash flows more spread out around the duration.", stage: 0, failure: "interpretation" },
        ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "interpretation",
        presentation: ["direct"],
        params: { n, variant },
      });
    }
    if (variant === 0) {
      return conceptQuestion({
        stem: "For a set of positive cash flows valued at annual effective rate $i$, a candidate computes $\\sum t^2 CF_t v^t \\big/ \\sum CF_t v^t$. With $D$ the Macaulay duration and $C = P''(i)/P(i)$, which of the following describes the candidate's quantity?",
        correct: { content: "It is the Macaulay convexity, equal to $(1+i)^2 C - D$.", why: "$\\sum t(t+1)CF_t v^{t+2}/P = v^2\\left(\\sum t^2 w_t + \\sum t\\,w_t\\right)$, so $C(1+i)^2 = C_{mac} + D$." },
        distractors: [
          { content: "It is the convexity $C$ itself, since both measure curvature.", misconception: "FORMULA_MACAULAY_CONVEXITY", why: "$C$ uses $t(t+1)v^{t+2}$, not $t^2 v^t$.", stage: 0, failure: "selection" },
          { content: "It is the Macaulay convexity, equal to $(1+i)^2 C$.", misconception: "TRANS_IGNORED_CONDITION", why: "The $t$ in $t(t+1)$ contributes $D$, which must be subtracted.", stage: 1, failure: "application" },
          { content: "It is the square of the Macaulay duration, $D^2$.", misconception: "CONC_RELATED_TERM", why: "The mean of $t^2$ exceeds the square of the mean of $t$ by the variance of the payment times.", stage: 1, failure: "connection" },
          { content: "It is the Macaulay convexity, equal to $C/(1+i)^2 + D$.", misconception: "ALG_INVERTED_RATIO", why: "Converting $C$ multiplies by $(1+i)^2$; it does not divide.", stage: 1, failure: "application" },
        ],
        steps: [...steps, { concept: "alm.convexity", reasoning: "Write $t(t+1) = t^2 + t$ and $v^{t+2} = v^2 v^t$ to relate the two measures." }],
        conditions,
        relationship: "$(1+i)^2\\,C = C_{mac} + D_{mac}$",
        transfer,
        itemFormat: "definition",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true },
        params: { variant },
      });
    }
    return conceptQuestion({
      stem: "For sets of positive cash flows valued at the same annual effective rate, which of the following statements about convexity is correct?",
      correct: { content: "At a fixed Macaulay duration, convexity is larger the more the payments are spread out in time.", why: "$C(1+i)^2 = D^2 + D + \\sum w_t(t-D)^2$: the dispersion term grows with spread." },
      distractors: [
        { content: "At a fixed Macaulay duration, convexity is larger the more the payments are concentrated in time.", misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "Concentration lowers the dispersion term.", stage: 0, failure: "application" },
        { content: "Convexity can be negative when the payments are spread far apart in time.", misconception: "CONC_ALM_CONVEXITY_SIGN", why: "Every term $t(t+1)CF_t v^{t+2}$ is positive.", stage: 0, failure: "interpretation" },
        { content: "A zero-coupon bond has zero convexity, since its payments are not spread out.", misconception: "CONC_RELATED_TERM", why: "Its dispersion is zero, but its convexity is $n(n+1)/(1+i)^2 > 0$.", stage: 1, failure: "connection" },
        { content: "Convexity depends on the dates of the payments but not on the interest rate.", misconception: "CONC_OUTSIDE_ASSUMPTIONS", why: "The weights and the factor $v^2$ both depend on $i$.", stage: 1, failure: "application" },
      ],
      steps: [...steps, { concept: "alm.convexity", reasoning: "Decompose $\\sum w_t t(t+1)$ into $D^2 + D$ plus the PV-weighted variance of the payment times." }],
      conditions,
      relationship: "$C(1+i)^2 = D^2 + D + \\sum_t w_t (t - D)^2, \\quad w_t = CF_t v^t / P$",
      transfer,
      itemFormat: "definition",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { variant },
    });
  },
});

const convexityBarbell: ChoiceTemplate = conceptTemplate({
  id: "con-alm-convexity-barbell",
  family: "con-alm-convexity",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.convexity",
  secondary: ["ALM.redington", "ALM.duration"],
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "conditions"],
  reasoning: ["financial_intuition", "concept_recognition"],
  soaConcept: "Barbell versus bullet positions with equal present value and duration.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const D = rng.int(5, 10);
    const [a, b] = drawUntil(() => [rng.int(1, 4), rng.int(1, 4)], ([x, y]) => x !== y && x < D);
    const V = gridAmount(rng, 100000, 900000, 50000);
    const w = b / (a + b);
    const bullet: Flow[] = [{ t: D, amount: V * Math.pow(1 + i, D) }];
    const barbell: Flow[] = [
      { t: D - a, amount: V * w * Math.pow(1 + i, D - a) },
      { t: D + b, amount: V * (1 - w) * Math.pow(1 + i, D + b) },
    ];
    if (level === 2 && variant === 0) {
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i)}, portfolio A consists of a zero-coupon bond maturing at time ${D}; portfolio B consists of zero-coupon bonds maturing at times ${D - a} and ${D + b}. Both portfolios have present value ${mamt(V)} and Macaulay duration ${D}.\n\nWhich of the following is true?`,
        correct: { content: "Portfolio B has the greater convexity.", why: `B's payments are spread around ${D} years while A's sit exactly at ${D}: $C_B = ${mnum(convexity(barbell, i), 2)} > C_A = ${mnum(convexity(bullet, i), 2)}$.`, check: { expr: convE(barbell, i), op: ">", than: convE(bullet, i) } },
        distractors: [
          { content: `Portfolio A has the greater convexity, since its payment is at time ${D}.`, misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "At equal duration, concentration lowers convexity.", check: { expr: convE(bullet, i), op: ">", than: convE(barbell, i) }, stage: 1, failure: "application" },
          { content: "The convexities are equal, since the present values and durations are equal.", misconception: "CONC_IGNORED_CONVEXITY", why: "Matching value and duration fixes only the zeroth and first derivatives.", check: { expr: convE(barbell, i), op: "=", than: convE(bullet, i) }, stage: 0, failure: "recognition" },
          { content: "Portfolio B has the greater modified duration.", misconception: "CONC_RELATED_TERM", why: "Equal Macaulay durations at the same rate give equal modified durations.", check: { expr: `${durE(barbell, i)}/(1+${lit(i)})`, op: ">", than: `${durE(bullet, i)}/(1+${lit(i)})` }, stage: 0, failure: "connection", confusedWith: "alm.macaulay-vs-modified" },
          { content: "After an immediate rise in the rate of 0.01, portfolio A is worth more than portfolio B.", misconception: "CONC_ALM_CONVEXITY_SIGN", why: "Greater convexity raises value after a move in either direction.", check: { expr: pvE(bullet, i + 0.01), op: ">", than: pvE(barbell, i + 0.01) }, stage: 2, failure: "conclusion" },
        ],
        steps: [
          { concept: "alm.macaulay-vs-modified", reasoning: "Equal values and durations match the level and slope of the two price–yield curves at the current rate." },
          { concept: "alm.convexity", reasoning: "Convexity grows with the dispersion of payment times around the duration." },
          { concept: "alm.convexity", reasoning: "B is dispersed, A is not, so B is more convex." },
        ],
        conditions: ["Flat yield curve; parallel changes.", "Zero-coupon bonds, no default."],
        relationship: "$C(1+i)^2 = D^2 + D + \\sum_t w_t(t - D)^2$",
        counterexample: "If B's two maturities moved toward " + D + ", its convexity would fall toward A's.",
        transfer: { principle: "Barbell beats bullet on convexity at equal duration.", unusual: "Convexity is ranked without being computed.", misread: "Equal duration is not equal risk." },
        itemFormat: "comparative-statics",
        presentation: ["compare-streams"],
        params: { i, D, a, b, variant },
      });
    }
    if (level === 2) {
      const d = rng.choice([0.01, 0.015, 0.02]);
      const pA = pvE(bullet, i - d);
      const pB = pvE(barbell, i - d);
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i)}, portfolio A is a zero-coupon bond maturing at time ${D} and portfolio B is a pair of zero-coupon bonds maturing at times ${D - a} and ${D + b}, chosen so that both portfolios have present value ${mamt(V)} and Macaulay duration ${D}. The rate then falls immediately to ${pc(i - d)}.\n\nWhich of the following is true?`,
        correct: { content: "Both values rise, and portfolio B's rises by more.", why: `Equal durations give equal first-order gains; B's extra convexity adds more: A becomes ${mnum(pvFlows(bullet, i - d), 0)}, B becomes ${mnum(pvFlows(barbell, i - d), 0)}.`, check: { expr: minE(`(${pB})-(${pA})`, `(${pA})-${lit(V)}`), op: ">", than: 0 } },
        distractors: [
          { content: "Both values rise by the same amount, since the durations are equal.", misconception: "CONC_IGNORED_CONVEXITY", why: "Duration fixes only the first-order change.", check: { expr: pB, op: "=", than: pA }, stage: 1, failure: "conclusion" },
          { content: "Both values rise, and portfolio A's rises by more.", misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "The concentrated portfolio is the less convex one.", check: { expr: `(${pA})-(${pB})`, op: ">", than: 0 }, stage: 1, failure: "application" },
          { content: "Portfolio B's value rises and portfolio A's value falls.", misconception: "CONC_PRICE_YIELD_DIRECTION", why: "Every positive cash flow gains value when the rate falls.", check: { expr: pA, op: "<", than: V }, stage: 0, failure: "interpretation" },
          { content: "Both values fall, because convexity reduces value when rates change.", misconception: "CONC_ALM_CONVEXITY_SIGN", why: "Present values rise when the rate falls; convexity adds to the gain.", check: { expr: pB, op: "<", than: V }, stage: 0, failure: "interpretation" },
        ],
        steps: [
          { concept: "alm.macaulay-vs-modified", reasoning: "Equal values and durations give equal first-order changes." },
          { concept: "alm.convexity", reasoning: "The second-order term $\\tfrac12 C(\\Delta i)^2$ is larger for the dispersed portfolio B." },
          { concept: "alm.duration-approximation", reasoning: "A fall in the rate raises both values; B's rises more." },
        ],
        conditions: ["Flat yield curve; immediate parallel change.", "Zero-coupon bonds, no default."],
        relationship: "$\\Delta P \\approx P\\left[-D_{mod}\\Delta i + \\tfrac12 C(\\Delta i)^2\\right]$",
        transfer: { principle: "At equal duration, the more convex position ends higher after any parallel move.", unusual: "The comparison is of changes in value, not of convexities.", misread: "Equal durations give equal first-order changes only." },
        itemFormat: "comparative-statics",
        presentation: ["compare-streams"],
        params: { i, D, a, b, d, variant },
      });
    }
    // Level 3: surplus against a liability.
    const d = 0.005;
    const S = (assets: Flow[], liabs: Flow[], r: number) => `((${pvE(assets, r)})-(${pvE(liabs, r)}))`;
    if (variant === 0) {
      const equal: Flow[] = [
        { t: D - a, amount: (V / 2) * Math.pow(1 + i, D - a) },
        { t: D + b, amount: (V / 2) * Math.pow(1 + i, D + b) },
      ];
      const L = bullet;
      const minOf = (assets: Flow[]) => minE(S(assets, L, i + d), S(assets, L, i - d));
      return conceptQuestion({
        stem:
          `An insurer must pay ${mamt(L[0].amount)} at time ${D}; at the annual effective rate of ${pc(i)} this has present value ${mamt(V)}. It considers three asset portfolios, each costing ${mamt(V)}:\n\n` +
          `X: a zero-coupon bond maturing at time ${D}.\n\nY: zero-coupon bonds maturing at times ${D - a} and ${D + b}, with present values chosen so that the portfolio's Macaulay duration is ${D}.\n\nZ: zero-coupon bonds maturing at times ${D - a} and ${D + b}, with equal present values.\n\n` +
          `Which portfolios leave the insurer with a positive surplus after any small, immediate parallel change in the rate?`,
        correct: { content: "Y only", why: `Y matches value and duration and is more convex than the liability, so the surplus has a strict minimum of 0 at ${pc(i)}. X matches exactly (surplus stays 0, never positive); Z's duration is ${mnum(macaulayDuration(equal, i), 2)}, not ${D}, so one direction loses.`, check: { expr: minOf(barbell), op: ">", than: 0 } },
        distractors: [
          { content: "X and Y only", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "X matches the liability exactly: its surplus is 0 after any change, not positive.", check: { expr: minOf(bullet), op: ">", than: 0 }, stage: 2, failure: "conclusion" },
          { content: "Y and Z only", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Z matches value but not duration, so its surplus falls for a change in one direction.", check: { expr: minOf(equal), op: ">", than: 0 }, stage: 1, failure: "application" },
          { content: "X, Y and Z", misconception: "CONC_IGNORED_CONVEXITY", why: "Equal cost alone does not protect the surplus; Z fails and X stays at zero.", check: { expr: minE(minOf(bullet), minOf(equal)), op: ">", than: 0 }, stage: 0, failure: "recognition" },
          { content: "X only", misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "X locks the surplus at zero; it never becomes positive.", check: { expr: minOf(bullet), op: ">", than: 0 }, stage: 2, failure: "interpretation" },
          { content: "None of them", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "Y satisfies all three Redington conditions with asset convexity above the liability's.", check: { expr: minOf(barbell), op: "<=", than: 0 }, stage: 2, failure: "conclusion" },
        ],
        steps: [
          { concept: "alm.surplus", reasoning: "The surplus $S(j) = PV_A(j) - PV_L(j)$ is 0 at the current rate for all three portfolios." },
          { concept: "alm.macaulay-vs-modified", reasoning: "Only X and Y match the liability's duration, so only they have $S'(i) = 0$." },
          { concept: "alm.convexity", reasoning: "Y is more dispersed than the liability, so $S''(i) > 0$; X has the same convexity, so $S \\equiv 0$." },
          { concept: "alm.redington", reasoning: "Strictly positive surplus on both sides needs all three conditions with strict convexity: Y only." },
        ],
        concepts: ["alm.surplus", "alm.convexity", "alm.redington"],
        conditions: ["Flat yield curve; small parallel shifts.", "Zero-coupon assets, no default."],
        relationship: "$S(i) = 0,\\ S'(i) = 0,\\ S''(i) > 0 \\Rightarrow S(i \\pm \\varepsilon) > 0$",
        counterexample: "X is the exact match: the surplus is zero whatever happens, which is safe but never positive.",
        transfer: { principle: "Rank immunizing portfolios by value, slope and curvature of the surplus, in that order.", unusual: "Three portfolios with the same cost are compared.", misread: "'Positive' excludes a surplus that stays at exactly zero." },
        itemFormat: "comparative-statics",
        presentation: ["compare-streams", "hidden-structure"],
        modelingDecisions: 1,
        features: { multiConcept: true, unfamiliar: true },
        params: { i, D, a, b, variant },
      });
    }
    const Sp = S(bullet, barbell, i + d);
    const Sm = S(bullet, barbell, i - d);
    return conceptQuestion({
      stem: `A pension plan owes ${mamt(barbell[0].amount)} at time ${D - a} and ${mamt(barbell[1].amount)} at time ${D + b}. To fund them it buys a single zero-coupon bond maturing at time ${D} with the same present value as the obligations at the annual effective rate of ${pc(i)}. The obligations' Macaulay duration is ${D}.\n\nWhich of the following describes the plan's surplus after a small, immediate parallel change in the rate?`,
      correct: { content: "It becomes negative whether the rate rises or falls.", why: "Values and durations match, but the liabilities are the more dispersed side, so $S''(i) < 0$: the surplus has a maximum of 0 at the current rate.", check: { expr: minE(`-(${Sp})`, `-(${Sm})`), op: ">", than: 0 } },
      distractors: [
        { content: "It becomes positive whether the rate rises or falls.", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "That needs the assets to be the more convex side; here the liabilities are.", check: { expr: minE(Sp, Sm), op: ">", than: 0 }, stage: 2, failure: "application" },
        { content: "It stays zero, since present values and durations match.", misconception: "CONC_IGNORED_CONVEXITY", why: "Matching value and duration fixes only the first-order change.", check: { expr: Sp, op: "=", than: 0 }, stage: 1, failure: "conclusion" },
        { content: "It becomes negative if the rate rises and positive if it falls.", misconception: "CONC_RELATED_TERM", why: "That pattern comes from a duration mismatch; the durations match here.", check: { expr: minE(`-(${Sp})`, Sm), op: ">", than: 0 }, stage: 1, failure: "connection", confusedWith: "alm.macaulay-vs-modified" },
        { content: "It becomes positive if the rate rises and negative if it falls.", misconception: "CONC_DIRECTION_REVERSED", why: "With matched durations there is no first-order asymmetry; curvature decides both sides.", check: { expr: minE(Sp, `-(${Sm})`), op: ">", than: 0 }, stage: 1, failure: "connection" },
      ],
      steps: [
        { concept: "alm.surplus", reasoning: "The surplus is zero at the current rate and its slope is zero because the durations match." },
        { concept: "alm.convexity", reasoning: "The liabilities are spread around time " + D + "; the single asset is not, so the liabilities are more convex." },
        { concept: "alm.surplus", reasoning: "$S''(i) = PV_A'' - PV_L'' < 0$: the current rate is a local maximum of the surplus." },
      ],
      concepts: ["alm.surplus", "alm.convexity", "alm.redington"],
      conditions: ["Flat yield curve; small parallel shifts.", "Zero-coupon asset, no default."],
      relationship: "$S''(i) = PV_A''(i) - PV_L''(i)$ decides the sign of $S(i \\pm \\varepsilon)$ when $S(i) = S'(i) = 0$.",
      counterexample: "Swapping roles — a barbell of assets against a single liability — makes the surplus positive on both sides.",
      transfer: { principle: "When value and duration match, the more convex side wins after any small move.", unusual: "The liabilities, not the assets, form the barbell.", misread: "Matching durations is not immunization." },
      itemFormat: "comparative-statics",
      presentation: ["hidden-structure"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i, D, a, b, variant },
    });
  },
});

const convexityStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-convexity-statements",
  family: "con-alm-convexity",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.convexity",
  secondary: ["ALM.approx_pv_change"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "terminology"],
  soaConcept: "Properties of convexity and of the second-order price approximation, judged as a set of statements.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(5, 20);
    const steps = [
      { concept: "alm.convexity", reasoning: "Convexity $C = \\sum t(t+1)CF_t v^{t+2} / P$ is positive for positive cash flows and does not change when every flow is scaled." },
      { concept: "alm.duration-approximation", reasoning: "The second-order estimate adds $\\tfrac12 C(\\Delta i)^2 \\ge 0$ to the first-order estimate, which understates value on both sides." },
      { concept: "alm.convexity", reasoning: "At fixed duration, convexity grows with the dispersion of payment times." },
    ];
    const common = {
      steps,
      conditions: ["Positive, fixed cash flows; flat yield curve.", "Annual effective rate."],
      relationship: "$P(i) \\approx P(i_0)\\left[1 - D_{mod}\\Delta i + \\tfrac12 C(\\Delta i)^2\\right]$",
      transfer: { principle: "Convexity is a positive, scale-free curvature that rewards dispersion.", unusual: "Several properties are judged together.", misread: "Convexity is not Macaulay convexity, and it never subtracts value." },
    };
    if (level === 1) {
      const statements =
        variant === 0
          ? [
              statement("I", "For positive cash flows, the convexity $P''(i)/P(i)$ is positive.", true, "Every term $t(t+1)CF_t v^{t+2}$ is positive.", "CONC_ALM_CONVEXITY_SIGN", { stage: 0, failure: "interpretation" }),
              statement("II", "Of two portfolios with equal present value and equal Macaulay duration, the one whose payments are more concentrated near the duration has the greater convexity.", false, "Concentration lowers the dispersion term, so the concentrated portfolio is less convex.", "CONC_ALM_BULLET_MORE_CONVEX", { stage: 2, failure: "application" }),
              statement("III", `The convexity of a zero-coupon bond maturing at time ${n} is $${n}(${n + 1})/(1+i)^2$.`, true, "$P = v^n$, $P'' = n(n+1)v^{n+2}$, so $P''/P = n(n+1)v^2$.", "FORMULA_MACAULAY_CONVEXITY", { stage: 0, failure: "selection", conditionTrue: `Its Macaulay convexity is $${n}^2$.` }),
            ]
          : [
              statement("I", "For positive cash flows, the first-order (modified duration) estimate of the new value is below the true value whether the rate rises or falls.", true, "The price–yield curve is convex, so it lies above its tangent line.", "CONC_IGNORED_CONVEXITY", { stage: 1, failure: "conclusion" }),
              statement("II", "Including the convexity term lowers the estimated value when the rate rises.", false, "The term $\\tfrac12 C(\\Delta i)^2$ is non-negative whatever the sign of $\\Delta i$.", "CONC_ALM_CONVEXITY_SIGN", { stage: 1, failure: "application" }),
              statement("III", "Doubling every cash flow doubles the convexity.", false, "Convexity is $P''/P$; scaling the flows scales numerator and denominator alike.", "CONC_ALM_DURATION_NOT_NORMALIZED", { stage: 0, failure: "interpretation", conditionTrue: "It is true of $P''$, the unscaled second derivative." }),
            ];
      const truth = statements.filter((x) => x.truth).map((x) => x.key);
      const complement = statements.filter((x) => !x.truth).map((x) => x.key);
      return statementQuestion({
        stem: "Determine which of the following statements are true.",
        statements,
        extra: [
          { keys: complement, misconception: "CONC_RELATED_TERM", why: "Every statement is misjudged, as if convexity were the slope rather than the curvature.", stage: 0, failure: "recognition", confusedWith: "alm.macaulay-vs-modified" },
          { keys: truth.length === 1 ? [] : ["II"], misconception: "CONC_DIRECTION_REVERSED", why: "The direction of every convexity effect is reversed.", stage: 1, failure: "application" },
        ],
        ...common,
        presentation: ["direct"],
        params: { n, variant },
      });
    }
    const r = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - i) >= 0.01);
    const m = rng.int(6, 15);
    const fl: Flow[] = Array.from({ length: m }, (_, k) => ({ t: k + 1, amount: 100 * r + (k + 1 === m ? 100 : 0) }));
    const P0 = pvE(fl, i);
    const Dm = `(${durE(fl, i)}/(1+${lit(i)}))`;
    const C = convE(fl, i);
    const di = variant === 0 ? 0.01 : -0.01;
    const P1 = pvE(fl, i + di);
    const E1 = `((${P0})*(1-(${Dm})*(${lit(di)})))`;
    const E2 = `((${P0})*(1-(${Dm})*(${lit(di)})+0.5*(${C})*(${lit(di * di)})))`;
    const cmac = fl.reduce((t, f) => t + f.t * f.t * f.amount * Math.pow(1 + i, -f.t), 0) / pvFlows(fl, i);
    const D = macaulayDuration(fl, i);
    const statements = [
      statement("I", `For a ${di > 0 ? "rise" : "fall"} in the yield to ${pc(i + di)}, the second-order estimate of the price is closer to the true price than the first-order estimate.`, true, "The true price lies above the tangent line; the convexity term moves the estimate up toward it.", "CONC_IGNORED_CONVEXITY", { stage: 1, failure: "conclusion", check: { expr: `sqrt(((${E2})-(${P1}))**2)`, op: "<", than: `sqrt(((${E1})-(${P1}))**2)` } }),
      statement("II", `The bond's convexity $P''(i)/P(i)$ is ${mnum(cmac, 2)}.`, false, `${mnum(cmac, 2)} is the Macaulay convexity $\\sum t^2 w_t$; $P''/P = ${mnum(convexity(fl, i), 2)}$.`, "FORMULA_MACAULAY_CONVEXITY", { stage: 0, failure: "selection", check: { expr: C, op: "=", than: lit(cmac), tol: 1e-4 } }),
      statement("III", `A zero-coupon bond with the same price and the same Macaulay duration (${mnum(D, 2)} years) has a smaller convexity than this bond.`, true, `The zero-coupon bond has convexity $D(D+1)/(1+i)^2 = ${mnum((D * (D + 1)) / (1 + i) ** 2, 2)}$, below ${mnum(convexity(fl, i), 2)} because the coupon bond's payments are dispersed.`, "CONC_ALM_BULLET_MORE_CONVEX", { stage: 2, failure: "application", check: { expr: `(${durE(fl, i)})*((${durE(fl, i)})+1)/(1+${lit(i)})**2`, op: "<", than: C } }),
    ];
    return statementQuestion({
      stem: `A ${m}-year bond of face 100 pays annual coupons at a rate of ${pc(r)} and is priced at an annual effective yield of ${pc(i)}. Determine which of the following statements are true.`,
      statements,
      extra: [
        { keys: ["II"], misconception: "CONC_RELATED_TERM", why: "Every statement is misjudged, as if convexity were the slope rather than the curvature.", stage: 0, failure: "recognition", confusedWith: "alm.macaulay-vs-modified" },
        { keys: [], misconception: "CONC_ALM_CONVEXITY_SIGN", why: "Treating convexity as a penalty rejects both true statements.", stage: 1, failure: "application" },
      ],
      ...common,
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { i, r, m, variant },
    });
  },
});

// ================================================================ approximate changes in present value

type MathOpt = { latex: string; probe: string; misconception: import("../misconceptions").MisconceptionId; why: string; stage: number; failure: "recognition" | "interpretation" | "selection" | "application" | "connection" | "conclusion"; conditionTrue?: string; confusedWith?: string };
const mathOpts = (xs: MathOpt[]) => xs.map(({ latex, ...rest }) => ({ content: math(latex), ...rest }));

const approxMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-alm-approx-meaning",
  family: "con-alm-approx",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ALM.convexity"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "conditions"],
  soaConcept: "What the first-order modified and the first-order Macaulay approximations estimate, and how they compare.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.duration-approximation", reasoning: "The modified approximation follows the tangent line $P(i_0)[1 - D_{mod}(i - i_0)]$; the Macaulay approximation replaces the cash flows by one payment at time $D_{mac}$ with the same present value." },
      { concept: "alm.convexity", reasoning: "A single payment is less convex than the dispersed cash flows, and a line is less convex than either." },
    ];
    const conditions = ["Positive, fixed cash flows; flat yield curve.", "Annual effective rates."];
    const relationship = "$P(i) \\approx P(i_0)\\left[1 - (i - i_0)D_{mod}\\right], \\qquad P(i) \\approx P(i_0)\\left(\\dfrac{1+i_0}{1+i}\\right)^{D_{mac}}$";
    const transfer = { principle: "Linear estimate ≤ Macaulay estimate ≤ true value, with equality in the Macaulay case only for a single payment.", unusual: "The approximations are compared rather than computed.", misread: "Both are first-order: neither uses convexity." };
    if (level === 1) {
      const assumes = variant === 0;
      return conceptQuestion({
        stem: assumes
          ? "The first-order Macaulay approximation estimates the present value at rate $i$ as $P(i_0)\\left(\\frac{1+i_0}{1+i}\\right)^{D}$, where $D$ is the Macaulay duration at $i_0$. Which of the following describes what this approximation does?"
          : "The first-order Macaulay approximation estimates the present value at rate $i$ as $P(i_0)\\left(\\frac{1+i_0}{1+i}\\right)^{D}$, where $D$ is the Macaulay duration at $i_0$. For which of the following is this approximation exact for every $i$?",
        correct: assumes
          ? { content: "It values the cash flows as one payment at time $D$ with the same present value at $i_0$.", why: "A payment $X$ at time $D$ with $Xv_0^D = P(i_0)$ is worth $P(i_0)\\left(\\frac{1+i_0}{1+i}\\right)^D$ at rate $i$." }
          : { content: "A single payment, such as a zero-coupon bond.", why: "For one payment at time $n$, $D = n$ and $P(i) = P(i_0)\\left(\\frac{1+i_0}{1+i}\\right)^n$ exactly." },
        distractors: assumes
          ? [
              { content: "It replaces the price–yield curve by its tangent line at $i_0$.", misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "That is the first-order modified approximation, linear in $i - i_0$.", stage: 0, failure: "recognition", confusedWith: "alm.duration-approximation" },
              { content: "It uses the modified duration $D/(1+i_0)$ as the exponent of the ratio.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The exponent is the Macaulay duration, the time of the equivalent payment.", stage: 0, failure: "selection" },
              { content: "It adds a term in $(i - i_0)^2$ for the curvature of the cash flows.", misconception: "CONC_IGNORED_CONVEXITY", why: "It uses duration only; any curvature comes from the power function, not from the cash flows' convexity.", stage: 1, failure: "connection" },
              { content: "It gives the exact present value at $i$ for any cash flows.", misconception: "CONC_ALM_APPROX_EXACT", why: "It is exact only for a single payment.", stage: 1, failure: "conclusion" },
            ]
          : [
              { content: "Any cash flows, provided the change $i - i_0$ is small.", misconception: "CONC_ALM_APPROX_EXACT", why: "A small change makes the error small, not zero.", stage: 1, failure: "conclusion" },
              { content: "No cash flows: an exact value always needs the convexity term.", misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "For a single payment the power function is the exact price function.", stage: 1, failure: "connection" },
              { content: "A level annuity, whose payments are equally spaced.", misconception: "CONC_OUTSIDE_ASSUMPTIONS", why: "Several payments are more dispersed than one, so the estimate is below the true value.", stage: 1, failure: "application" },
              { content: "Any cash flows, provided modified duration is used as the exponent.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The exponent must be the Macaulay duration, and even then exactness needs a single payment.", stage: 0, failure: "selection" },
            ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "interpretation",
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i0 = gridRate(rng, 0.03, 0.07, 0.005);
    const m = rng.int(6, 15);
    const r = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - i0) >= 0.01);
    const dlt = (variant === 0 ? 1 : -1) * rng.choice([0.01, 0.015, 0.02]);
    const i1 = Number((i0 + dlt).toFixed(6));
    const fl: Flow[] = Array.from({ length: m }, (_, k) => ({ t: k + 1, amount: 100 * r + (k + 1 === m ? 100 : 0) }));
    const P0 = pvE(fl, i0);
    const D = durE(fl, i0);
    const E1 = `((${P0})*(1-(${lit(dlt)})*(${D})/(1+${lit(i0)})))`;
    const E2 = `((${P0})*((1+${lit(i0)})/(1+${lit(i1)}))**(${D}))`;
    const P = pvE(fl, i1);
    return conceptQuestion({
      stem: `A ${m}-year bond of face 100 with annual coupons at ${pc(r)} is priced at an annual effective yield of $i_0 = ${mpc(i0)}$. The yield then ${dlt > 0 ? "rises" : "falls"} to $i_1 = ${mpc(i1)}$. Let $E_1$ be the first-order modified approximation and $E_2$ the first-order Macaulay approximation to the new price $P(i_1)$.\n\nWhich of the following is true?`,
      correct: { content: "$E_1 < E_2 < P(i_1)$", why: `Both estimates ignore the bond's dispersion and lie below the convex true price; the line lies below the power curve. Here $E_1 = ${mnum(pvFlows(fl, i0) * (1 - (dlt * macaulayDuration(fl, i0)) / (1 + i0)), 3)}$, $E_2 = ${mnum(pvFlows(fl, i0) * Math.pow((1 + i0) / (1 + i1), macaulayDuration(fl, i0)), 3)}$, $P(i_1) = ${mnum(pvFlows(fl, i1), 3)}$.`, check: { expr: minE(`(${E2})-(${E1})`, `(${P})-(${E2})`), op: ">", than: 0 } },
      distractors: [
        { content: "$E_2 < E_1 < P(i_1)$", misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "The Macaulay estimate is itself convex in $i$, so it lies above the tangent line.", check: { expr: minE(`(${E1})-(${E2})`, `(${P})-(${E1})`), op: ">", than: 0 }, stage: 1, failure: "connection" },
        { content: "$E_1 < P(i_1) < E_2$", misconception: "CONC_ALM_APPROX_EXACT", why: "The Macaulay estimate treats the bond as one payment, which is less convex than the bond, so it falls short of the true price.", check: { expr: minE(`(${P})-(${E1})`, `(${E2})-(${P})`), op: ">", than: 0 }, stage: 1, failure: "application" },
        { content: "$P(i_1) < E_1 < E_2$", misconception: "CONC_DIRECTION_REVERSED", why: "A convex price function lies above its tangent line, so the first-order estimates understate the price.", check: { expr: minE(`(${E1})-(${P})`, `(${E2})-(${E1})`), op: ">", than: 0 }, stage: 1, failure: "conclusion" },
        { content: "$E_1 = E_2 < P(i_1)$", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The two estimates use different functional forms and agree only to first order.", check: { expr: E1, op: "=", than: E2 }, stage: 0, failure: "recognition" },
      ],
      steps: [...steps, { concept: "alm.convexity", reasoning: "Ordering by curvature: tangent line < single-payment curve < true price, for a rise or a fall in yield." }],
      conditions,
      relationship,
      transfer,
      itemFormat: "comparative-statics",
      presentation: ["compare-streams"],
      features: { multiConcept: true },
      params: { i0, i1, m, r, variant },
    });
  },
});

const approxEquation: ChoiceTemplate = conceptTemplate({
  id: "con-alm-approx-equation",
  family: "con-alm-approx",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ALM.convexity"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "applicability"],
  reasoning: ["formula_selection", "translation"],
  soaConcept: "Selecting the expression for a duration-based (or duration-and-convexity) estimate of a new present value.",
  variants: 2,
  generate(rng, level, variant) {
    const i0 = gridRate(rng, 0.03, 0.07, 0.005);
    const dlt = (rng.int(0, 1) === 0 ? 1 : -1) * rng.choice([0.005, 0.01, 0.015, 0.02]);
    const i1 = Number((i0 + dlt).toFixed(6));
    const P0 = gridAmount(rng, 5000, 50000, 250);
    const D = rng.int(30, 150) / 10;
    const g = lit(1 + i0);
    const h = lit(1 + i1);
    const DL = lit(dlt);
    const DLs = String(Number(dlt.toFixed(4)));
    const Pm = mamt(P0);
    const Pl = lit(P0);
    const rateWords = `from $i_0 = ${mpc(i0)}$ to $i_1 = ${mpc(i1)}$`;
    if (level === 1 || level === 2) {
      const macaulay = variant === 0;
      const givenMod = level === 2 && macaulay; // L2 v0: modified given, Macaulay approximation asked
      const Dmac = givenMod ? D * (1 + i0) : D;
      const DmacE = givenMod ? `(${lit(D)}*${g})` : lit(D);
      const Dshow = mnum(D, 1);
      const ref = macaulay ? `(${Pl}*(${g}/${h})**${DmacE})` : `(${Pl}*(1-${DL}*${DmacE}/${g}))`;
      const stem = macaulay
        ? `At an annual effective rate of ${pc(i0)}, a set of cash flows has present value ${Pm} and ${givenMod ? "modified" : "Macaulay"} duration ${Dshow}. The rate changes ${rateWords}.\n\nWhich of the following is the first-order Macaulay approximation to the new present value?`
        : `At an annual effective rate of ${pc(i0)}, a set of cash flows has present value ${Pm} and Macaulay duration ${Dshow}. The rate changes ${rateWords}.\n\nWhich of the following is the first-order modified approximation to the new present value?`;
      const opts: MathOpt[] = macaulay
        ? [
            { latex: `${Pm}\\left(\\frac{${h}}{${g}}\\right)^{${givenMod ? `${Dshow}(${g})` : Dshow}}`, probe: `(${Pl}*(${h}/${g})**${DmacE})`, misconception: "ALG_INVERTED_RATIO", why: "The ratio is inverted: a higher rate must lower the value.", stage: 1, failure: "application" },
            givenMod
              ? { latex: `${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${Dshow}}`, probe: `(${Pl}*(${g}/${h})**${lit(D)})`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The exponent must be the Macaulay duration, $D_{mod}(1+i_0)$.", stage: 0, failure: "selection", confusedWith: "alm.macaulay-vs-modified" }
              : { latex: `${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${Dshow}/${g}}`, probe: `(${Pl}*(${g}/${h})**(${lit(D)}/${g}))`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The exponent is the Macaulay duration itself, not the modified duration.", stage: 0, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
            { latex: `${Pm}\\left[1 - (${DLs})(${givenMod ? Dshow : `${Dshow}/${g}`})\\right]`, probe: `(${Pl}*(1-${DL}*${givenMod ? lit(D) : `${lit(D)}/${g}`}))`, misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "That is the first-order modified (linear) approximation.", stage: 0, failure: "recognition", confusedWith: "alm.duration-approximation" },
            { latex: `${Pm}\\,(${h})^{-${givenMod ? `${Dshow}(${g})` : Dshow}}`, probe: `(${Pl}*${h}**(-${DmacE}))`, misconception: "TIMING_VALUATION_DATE", why: `${Pm} is a value at time 0, not a payment at time $D$; it must first be carried to time $D$ at $i_0$.`, stage: 1, failure: "application" },
            { latex: `${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${givenMod ? `${Dshow}/${g}` : `${Dshow}(${g})`}}`, probe: `(${Pl}*(${g}/${h})**(${givenMod ? `${lit(D)}/${g}` : `${lit(D)}*${g}`}))`, misconception: "ALG_DIVIDE_ERROR", why: `Converting between the durations ${givenMod ? "multiplies" : "is not needed: the given duration is already Macaulay"}.`, stage: 1, failure: "application" },
          ]
        : [
            { latex: `${Pm}\\left[1 - (${DLs})(${Dshow})\\right]`, probe: `(${Pl}*(1-${DL}*${lit(D)}))`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The linear approximation uses modified duration, $D_{mac}/(1+i_0)$.", stage: 0, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
            { latex: `${Pm}\\left[1 + (${DLs})\\dfrac{${Dshow}}{${g}}\\right]`, probe: `(${Pl}*(1+${DL}*${lit(D)}/${g}))`, misconception: "CONC_PRICE_YIELD_DIRECTION", why: "Value moves opposite to the rate: the change term is $-D_{mod}\\Delta i$.", stage: 1, failure: "application" },
            { latex: `${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${h}}\\right]`, probe: `(${Pl}*(1-${DL}*${lit(D)}/${h}))`, misconception: "TIMING_VALUATION_DATE", why: "Duration and its conversion are evaluated at the starting rate $i_0$.", stage: 1, failure: "application" },
            { latex: `${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${Dshow}}`, probe: `(${Pl}*(${g}/${h})**${lit(D)})`, misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "That is the first-order Macaulay approximation.", stage: 0, failure: "recognition", confusedWith: "alm.duration-approximation" },
            { latex: `${Pm} - (${DLs})\\dfrac{${Dshow}}{${g}}`, probe: `(${Pl}-${DL}*${lit(D)}/${g})`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "Modified duration is a relative change: the change term must be multiplied by the present value.", stage: 2, failure: "application" },
          ];
      return conceptQuestion({
        stem,
        correct: macaulay
          ? { content: math(`${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${givenMod ? `${Dshow}(${g})` : Dshow}}`), why: `The cash flows act like one payment at time $D_{mac}${givenMod ? ` = ${Dshow}(${g}) = ${mnum(Dmac, 4)}` : ""}$ with present value ${Pm}; revaluing it at $i_1$ multiplies by $\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_{mac}}$.`, probe: ref }
          : { content: math(`${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}}\\right]`), why: `$D_{mod} = ${Dshow}/${g}$; the linear estimate is $P(i_0)[1 - D_{mod}\\Delta i]$.`, probe: ref },
        distractors: mathOpts(opts),
        reference: { values: [{ label: "estimate", expr: ref }], description: "The named approximation evaluated from the given present value, duration and rates; each expression is evaluated and compared with it." },
        steps: [
          { concept: "alm.duration-approximation", reasoning: macaulay ? "The Macaulay approximation is $P(i_0)\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_{mac}}$." : "The modified approximation is $P(i_0)[1 - (i_1 - i_0)D_{mod}]$." },
          { concept: "alm.macaulay-vs-modified", reasoning: givenMod ? "Convert: $D_{mac} = D_{mod}(1 + i_0)$." : macaulay ? "The given duration is already Macaulay." : "Convert: $D_{mod} = D_{mac}/(1 + i_0)$." },
          { concept: "alm.duration-approximation", reasoning: `Substitute $\\Delta i = ${DL}$ with the sign that lowers value when the rate rises.` },
        ],
        conditions: ["Flat yield curve; parallel change.", "Annual effective rates; durations at $i_0$."],
        relationship: "$P(i_1) \\approx P(i_0)[1 - (i_1 - i_0)D_{mod}] \\quad\\text{or}\\quad P(i_0)\\left(\\tfrac{1+i_0}{1+i_1}\\right)^{D_{mac}}$",
        counterexample: "For a single payment the Macaulay form is exact; the linear form is not.",
        transfer: { principle: "Match the duration to the form: modified with the line, Macaulay with the power.", unusual: givenMod ? "The duration given is not the one the form needs." : "Several plausible forms are offered.", misread: "A rate rise lowers value in both forms." },
        itemFormat: "expression-selection",
        presentation: givenMod ? ["hidden-structure"] : level === 2 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: level === 2 },
        params: { i0, i1, P0, D, variant },
      });
    }
    if (variant === 0) {
      // Second-order estimate from Macaulay duration and convexity.
      const C = Number((D * (D + 1) / (1 + i0) ** 2 * (1 + rng.int(5, 40) / 100)).toFixed(1));
      const Dmod = `(${lit(D)}/${g})`;
      const ref = `(${Pl}*(1-${DL}*${Dmod}+0.5*${lit(C)}*${DL}**2))`;
      const Dshow = mnum(D, 1);
      const Cs = mnum(C, 1);
      const opts: MathOpt[] = [
        { latex: `${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}} - \\tfrac12(${Cs})(${DLs})^2\\right]`, probe: `(${Pl}*(1-${DL}*${Dmod}-0.5*${lit(C)}*${DL}**2))`, misconception: "CONC_ALM_CONVEXITY_SIGN", why: "The convexity term is added: positive curvature raises value after any change.", stage: 2, failure: "application" },
        { latex: `${Pm}\\left[1 - (${DLs})(${Dshow}) + \\tfrac12(${Cs})(${DLs})^2\\right]`, probe: `(${Pl}*(1-${DL}*${lit(D)}+0.5*${lit(C)}*${DL}**2))`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The first-order term needs modified duration.", stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
        { latex: `${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}}\\right]`, probe: `(${Pl}*(1-${DL}*${Dmod}))`, misconception: "CONC_IGNORED_CONVEXITY", why: "That is only the first-order estimate.", stage: 2, failure: "conclusion" },
        { latex: `${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}} + \\tfrac12(${Cs})(${DLs})\\right]`, probe: `(${Pl}*(1-${DL}*${Dmod}+0.5*${lit(C)}*${DL}))`, misconception: "ALG_ROOT_ERROR", why: "The convexity term is second order: it multiplies $(\\Delta i)^2$.", stage: 2, failure: "application" },
        { latex: `${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}} + (${Cs})(${DLs})^2\\right]`, probe: `(${Pl}*(1-${DL}*${Dmod}+${lit(C)}*${DL}**2))`, misconception: "TRANS_IGNORED_CONDITION", why: "The Taylor coefficient of the second-order term is $\\tfrac12$.", stage: 2, failure: "application" },
      ];
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i0)}, a bond portfolio has value ${Pm}, Macaulay duration ${Dshow} and convexity ${Cs}, where convexity is $P''(i)/P(i)$. The rate changes ${rateWords}.\n\nWhich of the following is the second-order estimate of the portfolio's new value using duration and convexity?`,
        correct: { content: math(`${Pm}\\left[1 - (${DLs})\\dfrac{${Dshow}}{${g}} + \\tfrac12(${Cs})(${DLs})^2\\right]`), why: "Taylor's theorem: $P(i_1) \\approx P(i_0)[1 - D_{mod}\\Delta i + \\tfrac12 C(\\Delta i)^2]$, with $D_{mod} = D_{mac}/(1+i_0)$.", probe: ref },
        distractors: mathOpts(opts),
        reference: { values: [{ label: "estimate", expr: ref }], description: "The second-order Taylor estimate evaluated from the given data; each expression is evaluated and compared with it." },
        steps: [
          { concept: "alm.duration-approximation", reasoning: "Expand $P(i_1)$ to second order: $P(i_0) + P'(i_0)\\Delta i + \\tfrac12 P''(i_0)(\\Delta i)^2$." },
          { concept: "alm.macaulay-vs-modified", reasoning: `$P'/P = -D_{mod} = -${Dshow}/${g}$: convert the Macaulay duration.` },
          { concept: "alm.convexity", reasoning: `$P''/P = C = ${Cs}$ enters as $+\\tfrac12 C(\\Delta i)^2$.` },
        ],
        concepts: ["alm.duration-approximation", "alm.macaulay-vs-modified", "alm.convexity"],
        conditions: ["Flat yield curve; parallel change.", "Convexity defined as $P''/P$."],
        relationship: "$P(i_1) \\approx P(i_0)\\left[1 - D_{mod}\\Delta i + \\tfrac12 C(\\Delta i)^2\\right]$",
        transfer: { principle: "Second order = first order + ½·convexity·(Δi)², with duration converted to modified.", unusual: "Two measures must be combined, one after conversion.", misread: "Convexity is added whether the rate rises or falls." },
        itemFormat: "expression-selection",
        presentation: ["hidden-structure"],
        modelingDecisions: 1,
        features: { multiConcept: true, unfamiliar: true },
        params: { i0, i1, P0, D, C, variant },
      });
    }
    // Portfolio of two bonds: Macaulay estimate with the portfolio duration.
    const VA = gridAmount(rng, 2000, 20000, 500);
    const VB = gridAmount(rng, 2000, 20000, 500);
    const DA = rng.int(10, 50) / 10;
    const DB = rng.int(60, 150) / 10;
    const FA = gridAmount(rng, 2000, 25000, 1000);
    const FB = gridAmount(rng, 2000, 25000, 1000);
    const V = VA + VB;
    const Vm = mamt(V);
    const pw = `((${lit(VA)}*${lit(DA)}+${lit(VB)}*${lit(DB)})/${lit(V)})`;
    const ref = `(${lit(V)}*(${g}/${h})**${pw})`;
    const est = (exp: string, latex: string) => ({ latex: `${Vm}\\left(\\frac{${g}}{${h}}\\right)^{${latex}}`, probe: `(${lit(V)}*(${g}/${h})**(${exp}))` });
    const A = mamt(VA);
    const B = mamt(VB);
    const opts: MathOpt[] = [
      { ...est(`(${lit(DA)}+${lit(DB)})/2`, `\\frac{${mnum(DA, 1)} + ${mnum(DB, 1)}}{2}`), misconception: "ALLOC_EVEN_SPLIT", why: "Durations are averaged with present-value weights, not equally.", stage: 1, failure: "application" },
      { ...est(`(${lit(FA)}*${lit(DA)}+${lit(FB)}*${lit(DB)})/(${lit(FA)}+${lit(FB)})`, `\\frac{${mamt(FA)}(${mnum(DA, 1)}) + ${mamt(FB)}(${mnum(DB, 1)})}{${mamt(FA + FB)}}`), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Face amounts are not present values; the weights must be market values.", stage: 1, failure: "selection" },
      { ...est(`${lit(DA)}+${lit(DB)}`, `${mnum(DA, 1)} + ${mnum(DB, 1)}`), misconception: "CONC_ALM_DURATIONS_ADDED", why: "A portfolio's duration lies between its components' durations.", stage: 1, failure: "application" },
      { ...est(`(${lit(VB)}*${lit(DA)}+${lit(VA)}*${lit(DB)})/${lit(V)}`, `\\frac{${B}(${mnum(DA, 1)}) + ${A}(${mnum(DB, 1)})}{${Vm}}`), misconception: "ALLOC_SWAPPED", why: "Each duration is weighted by its own bond's value.", stage: 1, failure: "application" },
      { latex: `${Vm}\\left[1 - (${DLs})\\frac{${A}(${mnum(DA, 1)}) + ${B}(${mnum(DB, 1)})}{${Vm}(${g})}\\right]`, probe: `(${lit(V)}*(1-${DL}*${pw}/${g}))`, misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "That is the linear (modified) approximation, not the Macaulay one.", stage: 2, failure: "recognition", confusedWith: "alm.duration-approximation" },
    ];
    return conceptQuestion({
      stem: `At an annual effective rate of ${pc(i0)}, a portfolio holds bond A, with face ${mamt(FA)}, market value ${A} and Macaulay duration ${mnum(DA, 1)}, and bond B, with face ${mamt(FB)}, market value ${B} and Macaulay duration ${mnum(DB, 1)}. The rate changes ${rateWords}.\n\nWhich of the following is the first-order Macaulay approximation to the portfolio's new value, based on the portfolio's Macaulay duration?`,
      correct: { content: math(`${Vm}\\left(\\frac{${g}}{${h}}\\right)^{\\frac{${A}(${mnum(DA, 1)}) + ${B}(${mnum(DB, 1)})}{${Vm}}}`), why: `The portfolio's duration is the value-weighted average ${mnum((VA * DA + VB * DB) / V, 4)}; the face amounts play no part.`, probe: ref },
      distractors: mathOpts(opts),
      reference: { values: [{ label: "estimate", expr: ref }], description: "The Macaulay estimate with the value-weighted portfolio duration; each expression is evaluated and compared with it." },
      steps: [
        { concept: "alm.portfolio-duration", reasoning: "At a common rate, the portfolio's Macaulay duration is the market-value-weighted average of the bonds' durations." },
        { concept: "alm.portfolio-duration", reasoning: "Face amounts are irrelevant: only present values weight the durations." },
        { concept: "alm.duration-approximation", reasoning: "Apply $V\\left(\\frac{1+i_0}{1+i_1}\\right)^{D_P}$ to the whole portfolio." },
      ],
      concepts: ["alm.portfolio-duration", "alm.duration-approximation"],
      conditions: ["Both bonds valued at the same rate; parallel change.", "Annual effective rates."],
      relationship: "$D_P = \\dfrac{V_A D_A + V_B D_B}{V_A + V_B}, \\qquad V(i_1) \\approx V\\left(\\dfrac{1+i_0}{1+i_1}\\right)^{D_P}$",
      transfer: { principle: "Aggregate durations with market-value weights before applying any approximation.", unusual: "Face amounts are given but play no part.", misread: "Face is not value." },
      itemFormat: "expression-selection",
      presentation: ["irrelevant-info", "hidden-structure"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i0, i1, VA, VB, DA, DB, variant },
    });
  },
});

const approxDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-alm-approx-diagnosis",
  family: "con-alm-approx",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ALM.portfolio"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "applicability"],
  reasoning: ["formula_selection", "validation"],
  soaConcept: "Diagnosing a duration-based estimate that uses the wrong duration or the wrong weights.",
  variants: 2,
  generate(rng, level, variant) {
    const i0 = gridRate(rng, 0.03, 0.07, 0.005);
    const dlt = (rng.int(0, 1) === 0 ? 1 : -1) * rng.choice([0.01, 0.015, 0.02]);
    const i1 = Number((i0 + dlt).toFixed(6));
    const g = lit(1 + i0);
    const h = lit(1 + i1);
    const DL = lit(dlt);
    const DLs = String(Number(dlt.toFixed(4)));
    const eq = (than: string) => (expr: string) => ({ expr, op: "=" as const, than });
    const steps2 = [
      { concept: "alm.duration-approximation", reasoning: "Identify the form used: linear (modified duration) or power (Macaulay duration)." },
      { concept: "alm.macaulay-vs-modified", reasoning: "Check that the duration supplied matches the form: $D_{mod} = D_{mac}/(1+i_0)$." },
      { concept: "alm.duration-approximation", reasoning: "Correct the duration and re-evaluate the estimate." },
    ];
    if (level === 2) {
      const P0 = gridAmount(rng, 5000, 50000, 250);
      const D = rng.int(30, 150) / 10;
      const Pl = lit(P0);
      const Dl = lit(D);
      const Pm = mamt(P0);
      const Ds = mnum(D, 1);
      const linear = variant === 0;
      const ref = linear ? `(${Pl}*(1-${DL}*${Dl}/${g}))` : `(${Pl}*(${g}/${h})**(${Dl}*${g}))`;
      const ck = eq(ref);
      const candidate = linear ? `${Pm}\\left[1 - (${DLs})(${Ds})\\right]` : `${Pm}\\left(\\frac{${g}}{${h}}\\right)^{${Ds}}`;
      const candValue = linear ? P0 * (1 - dlt * D) : P0 * Math.pow((1 + i0) / (1 + i1), D);
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i0)}, a set of cash flows has present value ${Pm} and ${linear ? "Macaulay" : "modified"} duration ${Ds}. The rate changes to ${pc(i1)}. A candidate estimates the new present value with the first-order ${linear ? "modified" : "Macaulay"} approximation as\n\n$$${candidate} = ${mnum(candValue, 2)}.$$\n\nWhich of the following correctly describes the candidate's estimate?`,
        correct: linear
          ? { content: `The duration must first be converted to modified duration, $${Ds}/${g}$.`, why: `The linear form needs $D_{mod} = ${mnum(D / (1 + i0), 4)}$, giving ${mnum(P0 * (1 - (dlt * D) / (1 + i0)), 2)}.`, check: ck(`(${Pl}*(1-${DL}*(${Dl}/${g})))`) }
          : { content: `The exponent must be the Macaulay duration, $${Ds}(${g})$.`, why: `The power form needs $D_{mac} = ${mnum(D * (1 + i0), 4)}$, giving ${mnum(P0 * Math.pow((1 + i0) / (1 + i1), D * (1 + i0)), 2)}.`, check: ck(`(${Pl}*(${g}/${h})**(${Dl}*${g}))`) },
        distractors: [
          { content: "The estimate is correct as it stands.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: `The ${linear ? "linear form needs modified" : "power form needs Macaulay"} duration, but the ${linear ? "Macaulay" : "modified"} duration was used.`, check: ck(linear ? `(${Pl}*(1-${DL}*${Dl}))` : `(${Pl}*(${g}/${h})**${Dl})`), stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
          { content: linear ? "The sign of the change term is wrong: it should be $1 + \\Delta i \\cdot D$." : "The ratio is inverted: it should be $(1+i_1)/(1+i_0)$.", misconception: linear ? "CONC_PRICE_YIELD_DIRECTION" : "ALG_INVERTED_RATIO", why: "The candidate's direction is right: value falls when the rate rises.", check: ck(linear ? `(${Pl}*(1+${DL}*${Dl}))` : `(${Pl}*(${h}/${g})**${Dl})`), stage: 2, failure: "application" },
          { content: linear ? `The duration must first be multiplied by $${g}$.` : `The exponent should be $${Ds}/${g}$.`, misconception: "ALG_DIVIDE_ERROR", why: "The conversion goes the other way.", check: ck(linear ? `(${Pl}*(1-${DL}*${Dl}*${g}))` : `(${Pl}*(${g}/${h})**(${Dl}/${g}))`), stage: 1, failure: "application" },
          { content: linear ? `The duration should be converted at the new rate: $${Ds}/${h}$.` : `The exponent should be converted at the new rate: $${Ds}(${h})$.`, misconception: "TIMING_VALUATION_DATE", why: "Durations are measured at the starting rate $i_0$.", check: ck(linear ? `(${Pl}*(1-${DL}*${Dl}/${h}))` : `(${Pl}*(${g}/${h})**(${Dl}*${h}))`), stage: 2, failure: "application" },
          { content: "The estimate needs a convexity term before it can be used.", misconception: "CONC_ALM_APPROX_ORDER_CONFUSED", why: "A first-order estimate is complete without convexity; the error is the duration used.", stage: 0, failure: "recognition" },
        ],
        reference: { description: `The ${linear ? "linear" : "Macaulay"} estimate with the correct duration is ${mnum(linear ? P0 * (1 - (dlt * D) / (1 + i0)) : P0 * Math.pow((1 + i0) / (1 + i1), D * (1 + i0)), 2)}; each proposed correction is evaluated and compared with it.` },
        steps: steps2,
        conditions: ["Flat yield curve; parallel change.", "Durations measured at $i_0$."],
        relationship: "$P(i_0)[1 - \\Delta i\\,D_{mod}], \\qquad P(i_0)\\left(\\tfrac{1+i_0}{1+i_1}\\right)^{D_{mac}}, \\qquad D_{mac} = (1+i_0)D_{mod}$",
        transfer: { principle: "Before plugging in a duration, check which one the formula is built on.", unusual: "The given duration is the other kind.", misread: "Both durations are written $D$." },
        itemFormat: "error-diagnosis",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true, multiConcept: true },
        params: { i0, i1, P0, D, variant },
      });
    }
    if (variant === 0) {
      // Surplus change: candidate weights the duration gap by the surplus.
      const VA = gridAmount(rng, 600000, 1200000, 10000);
      const VL = drawUntil(() => gridAmount(rng, 400000, 1100000, 10000), (x) => x < VA - 50000);
      const DA = rng.int(30, 90) / 10;
      const DLb = drawUntil(() => rng.int(30, 120) / 10, (x) => Math.abs(x - DA) >= 1);
      const S = VA - VL;
      const ref = `(-${DL}*(${lit(VA)}*${lit(DA)}-${lit(VL)}*${lit(DLb)})/${g})`;
      const ck = eq(ref);
      const cand = (-dlt * S * (DA - DLb)) / (1 + i0);
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i0)}, an insurer's assets have value ${mamt(VA)} and Macaulay duration ${mnum(DA, 1)}; its liabilities have value ${mamt(VL)} and Macaulay duration ${mnum(DLb, 1)}. The rate changes to ${pc(i1)}. A candidate estimates the change in surplus to first order as\n\n$$-(${DLs})\\cdot\\frac{(${mamt(VA)} - ${mamt(VL)})(${mnum(DA, 1)} - ${mnum(DLb, 1)})}{${g}} = ${mnum(cand, 2)}.$$\n\nWhich of the following correctly describes the candidate's estimate?`,
        correct: { content: "Each duration must be weighted by its own present value: use $V_A D_A - V_L D_L$.", why: `$\\Delta S \\approx -\\Delta i\\,(V_A D_A - V_L D_L)/(1+i_0) = ${mnum((-dlt * (VA * DA - VL * DLb)) / (1 + i0), 2)}$.`, check: ck(`(-${DL}*(${lit(VA)}*${lit(DA)}-${lit(VL)}*${lit(DLb)})/${g})`) },
        distractors: [
          { content: "The estimate is correct: the surplus times the duration gap is the first-order change.", misconception: "ALLOC_AGGREGATE_AS_EACH", why: "The surplus is not the value exposed to either duration; each side moves with its own value.", check: ck(`(-${DL}*${lit(S)}*(${lit(DA)}-${lit(DLb)})/${g})`), stage: 1, failure: "connection" },
          { content: "The durations should be averaged: use $S\\cdot\\tfrac12(D_A + D_L)$.", misconception: "ALLOC_EVEN_SPLIT", why: "Assets and liabilities enter with opposite signs and their own values.", check: ck(`(-${DL}*${lit(S)}*(${lit(DA)}+${lit(DLb)})/2/${g})`), stage: 1, failure: "application" },
          { content: "The division by $1 + i_0$ is wrong: Macaulay durations apply directly.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The first-order change in value uses modified durations.", check: ck(`(-${DL}*(${lit(VA)}*${lit(DA)}-${lit(VL)}*${lit(DLb)}))`), stage: 2, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
          { content: "The sign is wrong: the surplus moves with the rate.", misconception: "CONC_PRICE_YIELD_DIRECTION", why: "Each present value falls as the rate rises; the sign of the change depends on $V_A D_A - V_L D_L$.", check: ck(`(${DL}*(${lit(VA)}*${lit(DA)}-${lit(VL)}*${lit(DLb)})/${g})`), stage: 2, failure: "application" },
        ],
        reference: { description: "The first-order surplus change $-\\Delta i\\,(V_A D_A - V_L D_L)/(1+i_0)$; each proposed correction is evaluated and compared with it." },
        steps: [
          { concept: "alm.surplus", reasoning: "$S(i) = V_A(i) - V_L(i)$, so $S'(i) = V_A'(i) - V_L'(i)$." },
          { concept: "alm.portfolio-duration", reasoning: "$V'(i) = -V\\,D_{mac}/(1+i)$ for each side, weighted by that side's own value." },
          { concept: "alm.duration-approximation", reasoning: "$\\Delta S \\approx -\\Delta i\\,(V_A D_A - V_L D_L)/(1+i_0)$." },
          { concept: "alm.surplus", reasoning: "The candidate's product (surplus × duration gap) mixes the two sides' values." },
        ],
        concepts: ["alm.surplus", "alm.portfolio-duration", "alm.duration-approximation"],
        conditions: ["Assets and liabilities valued at one flat rate; parallel change.", "Macaulay durations at $i_0$."],
        relationship: "$\\Delta S \\approx -\\dfrac{\\Delta i}{1+i_0}\\left(V_A D_A - V_L D_L\\right)$",
        counterexample: "If $V_A = V_L$, the candidate's form would be right up to that zero surplus — and would give zero.",
        transfer: { principle: "A surplus is a portfolio with a short position: aggregate dollar durations, $V \\cdot D$, side by side.", unusual: "The quantity estimated is a difference of two present values.", misread: "Equal durations do not protect a surplus when the values differ." },
        itemFormat: "error-diagnosis",
        presentation: ["hidden-structure"],
        modelingDecisions: 1,
        features: { multiConcept: true, unfamiliar: true },
        params: { i0, i1, VA, VL, DA, DLb, variant },
      });
    }
    // Portfolio: candidate weights by face.
    const VA = gridAmount(rng, 2000, 20000, 500);
    const VB = gridAmount(rng, 2000, 20000, 500);
    const DA = rng.int(10, 50) / 10;
    const DB = rng.int(60, 150) / 10;
    const FA = drawUntil(() => gridAmount(rng, 2000, 25000, 1000), (x) => Math.abs(x - VA) > 500);
    const FB = drawUntil(() => gridAmount(rng, 2000, 25000, 1000), (x) => Math.abs(x / (x + FA) - VB / (VA + VB)) > 0.03);
    const V = VA + VB;
    const pw = (wa: string, wb: string) => `((${wa}*${lit(DA)}+${wb}*${lit(DB)})/(${wa}+${wb}))`;
    const estE = (dur: string) => `(${lit(V)}*(${g}/${h})**(${dur}))`;
    const ref = estE(pw(lit(VA), lit(VB)));
    const ck = eq(ref);
    const dFace = (FA * DA + FB * DB) / (FA + FB);
    return conceptQuestion({
      stem: `At an annual effective rate of ${pc(i0)}, a portfolio holds bond A (face ${mamt(FA)}, market value ${mamt(VA)}, Macaulay duration ${mnum(DA, 1)}) and bond B (face ${mamt(FB)}, market value ${mamt(VB)}, Macaulay duration ${mnum(DB, 1)}). The rate changes to ${pc(i1)}. A candidate takes the portfolio's duration as $\\frac{${mamt(FA)}(${mnum(DA, 1)}) + ${mamt(FB)}(${mnum(DB, 1)})}{${mamt(FA + FB)}} = ${mnum(dFace, 4)}$ and estimates the new value as $${mamt(V)}\\left(\\frac{${g}}{${h}}\\right)^{${mnum(dFace, 4)}}$.\n\nWhich of the following correctly describes the candidate's estimate?`,
      correct: { content: "The durations must be weighted by market values, not face amounts.", why: `$D_P = (V_A D_A + V_B D_B)/V = ${mnum((VA * DA + VB * DB) / V, 4)}$; face amounts are not values.`, check: ck(estE(pw(lit(VA), lit(VB)))) },
      distractors: [
        { content: "The estimate is correct; any consistent weights give the portfolio duration.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Only present-value weights reproduce the derivative of the portfolio's value.", check: ck(estE(pw(lit(FA), lit(FB)))), stage: 0, failure: "selection" },
        { content: "The durations should be weighted equally, since there is one bond of each.", misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore how much of the portfolio each bond represents.", check: ck(estE(`(${lit(DA)}+${lit(DB)})/2`)), stage: 0, failure: "application" },
        { content: "The two durations should be added: the portfolio is exposed to both.", misconception: "CONC_ALM_DURATIONS_ADDED", why: "A portfolio's duration is an average, lying between its components'.", check: ck(estE(`${lit(DA)}+${lit(DB)}`)), stage: 0, failure: "application" },
        { content: "The face-weighted duration is right but must be divided by $1 + i_0$ before use.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The power form uses Macaulay duration; the problem is the weights.", check: ck(estE(`${pw(lit(FA), lit(FB))}/${g}`)), stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
        { content: "Each bond's value should be weighted by the other bond's duration.", misconception: "ALLOC_SWAPPED", why: "Each duration goes with its own bond's value.", check: ck(estE(`(${lit(VB)}*${lit(DA)}+${lit(VA)}*${lit(DB)})/${lit(V)}`)), stage: 0, failure: "application" },
      ],
      reference: { description: "The Macaulay estimate with the value-weighted portfolio duration; each proposed correction is evaluated and compared with it." },
      steps: [
        { concept: "alm.portfolio-duration", reasoning: "$V_P'(i) = V_A'(i) + V_B'(i)$, so $D_P = (V_A D_A + V_B D_B)/V_P$." },
        { concept: "alm.portfolio-duration", reasoning: "Face amounts differ from values whenever bonds trade away from par." },
        { concept: "alm.duration-approximation", reasoning: "Apply the Macaulay form to the whole portfolio with $D_P$." },
      ],
      concepts: ["alm.portfolio-duration", "alm.duration-approximation"],
      conditions: ["Both bonds valued at one flat rate; parallel change.", "Macaulay durations at $i_0$."],
      relationship: "$D_P = \\dfrac{V_A D_A + V_B D_B}{V_A + V_B}$",
      transfer: { principle: "Weights in any duration average are present values.", unusual: "Both face and market values are given.", misread: "Face looks like a natural weight." },
      itemFormat: "error-diagnosis",
      presentation: ["irrelevant-info", "hidden-structure"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i0, i1, VA, VB, FA, FB, variant },
    });
  },
});

// ================================================================ cash-flow matching

const matchingMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-alm-matching-meaning",
  family: "con-alm-matching",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.cash_flow_matching",
  secondary: ["ALM.redington"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "conditions"],
  soaConcept: "What exact cash-flow matching is and how it differs from immunization.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.cash-flow-matching", reasoning: "Exact matching buys assets whose cash flows equal the liability cash flows date by date." },
      { concept: "alm.redington", reasoning: "Immunization only equates present values and their derivatives at one rate; matching equates the flows themselves." },
    ];
    const conditions = ["Default-free, non-callable assets.", "Asset payments available on the liability dates."];
    const relationship = "Matching: $A_t = L_t$ for every $t$, so $PV_A(j) = PV_L(j)$ for every rate $j$.";
    const transfer = { principle: "If the cash flows coincide, interest rates never enter.", unusual: "Matching is contrasted with immunization.", misread: "Equal present values are not equal cash flows." };
    if (level === 1) {
      const def = variant === 0;
      return conceptQuestion({
        stem: def
          ? "Which of the following describes exact cash-flow matching of an insurer's liabilities?"
          : "An insurer has bought default-free bonds whose cash flows equal its liability payments on every date. Interest rates then change, and the yield curve also changes shape. Which of the following is true?",
        correct: def
          ? { content: "Buying assets whose cash flows equal the liability payments on every date.", why: "Each liability payment is met by an asset payment on the same date, so no reinvestment or sale is needed." }
          : { content: "Every liability payment is still met; the surplus stays zero whatever rates do.", why: "No asset is sold or reinvested before it is needed, so no interest rate ever enters the result." },
        distractors: def
          ? [
              { content: "Buying assets with the same present value as the liabilities.", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Equal present values at one rate do not make the flows coincide.", stage: 0, failure: "recognition" },
              { content: "Buying assets with the same present value and duration as the liabilities.", misconception: "CONC_RELATED_TERM", why: "That is part of Redington immunization.", stage: 1, failure: "recognition", confusedWith: "alm.redington" },
              { content: "Buying assets whose undiscounted total equals the total of the liability payments.", misconception: "SEQ_UNDISCOUNTED_SUM", why: "Totals can agree while the timing differs.", stage: 0, failure: "interpretation" },
              { content: "Buying assets that are rebalanced each year to keep their duration equal to the liabilities'.", misconception: "CONC_ALM_MATCHING_REBALANCE", why: "A matched portfolio never needs rebalancing.", stage: 1, failure: "application" },
              { content: "Buying two assets that bracket each liability date, with matched value and duration.", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "That is full immunization of a single liability.", stage: 1, failure: "recognition", confusedWith: "alm.full-immunization" },
            ]
          : [
              { content: "The portfolio must be rebalanced to restore equal durations.", misconception: "CONC_ALM_MATCHING_REBALANCE", why: "The flows coincide, so there is nothing to restore.", stage: 0, failure: "application" },
              { content: "The insurer is protected only if the change in rates is a small parallel shift.", misconception: "CONC_RELATED_TERM", why: "That is the limitation of Redington immunization, not of exact matching.", stage: 1, failure: "connection", confusedWith: "alm.redington" },
              { content: "The surplus becomes positive, because the assets are more convex than the liabilities.", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "Identical flows have identical convexity; the surplus stays exactly zero.", stage: 1, failure: "connection" },
              { content: "Losses can arise from reinvesting asset payments at the new rates.", misconception: "MODEL_REINVEST_AT_YIELD", why: "Each asset payment is paid straight out to meet a liability; nothing is reinvested.", stage: 0, failure: "interpretation" },
              { content: "The non-parallel change creates a loss, since only parallel shifts are covered.", misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "The shape of the curve does not matter when the flows coincide.", stage: 1, failure: "application" },
            ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: def ? "definition" : "interpretation",
        presentation: ["direct"],
        params: { variant },
      });
    }
    if (variant === 0) {
      return conceptQuestion({
        stem: "An insurer plans to meet a schedule of liability payments by exact cash-flow matching with bonds. Which of the following does the plan require?",
        correct: { content: "Default-free, non-callable bonds that pay on the liability dates in the required amounts.", why: "Matching relies only on the asset flows arriving as scheduled." },
        distractors: [
          { content: "A flat yield curve, so that one rate values every cash flow.", misconception: "CONC_OUTSIDE_ASSUMPTIONS", why: "Matching makes no assumption about the curve.", stage: 1, failure: "application" },
          { content: "Only small, parallel changes in interest rates after purchase.", misconception: "CONC_RELATED_TERM", why: "That is the condition for Redington immunization.", stage: 1, failure: "connection", confusedWith: "alm.redington" },
          { content: "A single liability payment, bracketed by two asset payments.", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "That describes full immunization; matching handles any schedule.", stage: 1, failure: "recognition", confusedWith: "alm.full-immunization" },
          { content: "Regular rebalancing as interest rates change.", misconception: "CONC_ALM_MATCHING_REBALANCE", why: "A matched portfolio needs no rebalancing.", stage: 0, failure: "application" },
          { content: "Asset convexity greater than the liabilities' convexity.", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "Identical flows have identical convexity; no inequality is needed.", stage: 1, failure: "connection" },
        ],
        steps: [...steps, { concept: "alm.cash-flow-matching", reasoning: "What can still fail is the asset flows themselves: default or early call." }],
        conditions,
        relationship,
        transfer,
        itemFormat: "applicability",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true },
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const j = Number((i + (rng.int(0, 1) === 0 ? 1 : -1) * rng.choice([0.01, 0.02, 0.03])).toFixed(6));
    const L: Flow[] = [1, 2, 3].map((t) => ({ t, amount: gridAmount(rng, 10000, 60000, 1000) }));
    const pvA = pvE(L, j);
    const pvL = pvE([...L], j);
    return conceptQuestion({
      stem: `An insurer must pay ${andList(L.map((x) => mamt(x.amount)))} at times 1, 2 and 3, respectively. It holds zero-coupon bonds paying exactly these amounts at these times, bought at an annual effective rate of ${pc(i)}. The rate then changes to ${pc(j)}.\n\nWhich of the following is true?`,
      correct: { content: "Asset and liability values change by the same amount; the surplus stays zero.", why: "The asset and liability flows are identical, so their values agree at every rate.", check: { expr: `(${pvA})-(${pvL})`, op: "=", than: 0 } },
      distractors: [
        { content: "The asset value changes by more, because bonds are more rate-sensitive than liabilities.", misconception: "CONC_RELATED_TERM", why: "Identical flows have identical sensitivity.", check: { expr: `sqrt(((${pvA})-${lit(pvFlows(L, i))})**2)`, op: ">", than: `sqrt(((${pvL})-${lit(pvFlows(L, i))})**2)` }, stage: 1, failure: "connection" },
        { content: "The surplus becomes positive, because the bonds are more convex than the liabilities.", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "Identical flows have identical convexity.", check: { expr: `(${pvA})-(${pvL})`, op: ">", than: 0 }, stage: 1, failure: "connection" },
        { content: "Both values are unchanged, because the cash flows are fixed in amount.", misconception: "SEQ_UNDISCOUNTED_SUM", why: "Fixed flows have values that move with the rate; only the difference stays zero.", check: { expr: pvL, op: "=", than: lit(pvFlows(L, i)) }, stage: 0, failure: "interpretation" },
        { content: "The portfolio must now be rebalanced to restore equal durations.", misconception: "CONC_ALM_MATCHING_REBALANCE", why: "The durations remain equal because the flows are equal.", stage: 0, failure: "application" },
        { content: "The surplus becomes negative, since liabilities gain value when rates fall.", misconception: "CONC_DIRECTION_REVERSED", why: "Assets gain exactly the same value.", check: { expr: `(${pvA})-(${pvL})`, op: "<", than: 0 }, stage: 1, failure: "conclusion" },
      ],
      steps: [
        { concept: "alm.cash-flow-matching", reasoning: "The asset and liability flows coincide date by date." },
        { concept: "alm.surplus", reasoning: "So $PV_A(j) - PV_L(j) = 0$ at every rate $j$, though each value moves." },
        { concept: "alm.redington", reasoning: "No duration or convexity condition is needed: they are automatically equal." },
      ],
      concepts: ["alm.cash-flow-matching", "alm.surplus"],
      conditions,
      relationship,
      transfer,
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { multiConcept: true },
      params: { i, j, variant },
    });
  },
});

const matchingOrder: ChoiceTemplate = conceptTemplate({
  id: "con-alm-matching-order",
  family: "con-alm-matching",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.cash_flow_matching",
  secondary: ["BONDS.coupons"],
  itemFormat: "timeline-reading",
  conceptFamily: "timeline",
  dimensions: ["timing", "equation_construction"],
  reasoning: ["cashflow_modelling", "valuation_dates", "translation"],
  soaConcept: "Building an exactly matched bond portfolio from the last liability backwards.",
  variants: 2,
  generate(rng, level, variant) {
    const n = level === 2 ? 2 : 3;
    const rates = drawUntil(() => Array.from({ length: n }, () => gridRate(rng, 0.02, 0.08, 0.005)), (rs) => new Set(rs).size === n);
    const L = Array.from({ length: n }, () => gridAmount(rng, 20000, 80000, 1000));
    const names = ["A", "B", "C"].slice(0, n);
    const R = rates.map(lit);
    const fac1 = rates.map((x) => lit(1 + x));
    // Faces from the last liability backwards.
    const F: number[] = new Array(n).fill(0);
    for (let t = n; t >= 1; t -= 1) {
      let later = 0;
      for (let u = t + 1; u <= n; u += 1) later += F[u - 1] * rates[u - 1];
      F[t - 1] = (L[t - 1] - later) / (1 + rates[t - 1]);
    }
    const Fs = F.map((x) => Math.round(x * 100) / 100);
    const target = level === 2 ? (variant === 0 ? 2 : 1) : variant === 0 ? 2 : 1;
    const bondList = names.map((nm, k) => `bond ${nm} matures at time ${k + 1} and pays annual coupons at ${pc(rates[k])}`).join("; ");
    const stem =
      `An insurer must pay ${andList(L.map((x, k) => `${mamt(x)} at time ${k + 1}`))}. It will match these payments exactly using ${n === 2 ? "two" : "three"} bonds, each redeemable at face: ${bondList}.\n\n` +
      `Let $x$ be the face amount of bond ${names[target - 1]}. Determine which of the following equations $x$ satisfies.`;
    // Coupons at time `target` from longer bonds (with faces written as shown numbers).
    const later = Array.from({ length: n - target }, (_, k) => target + k + 1);
    const laterTerm = (useRate: (u: number) => number) => later.map((u) => `${mnum(Fs[u - 1], 2)}(${lit(useRate(u))})`).join(" + ");
    const laterE = (useRate: (u: number) => number, face = (u: number) => Fs[u - 1]) => later.map((u) => `${lit(face(u))}*${lit(useRate(u))}`).join("+") || "0";
    const T = target - 1;
    const Lm = mamt(L[T]);
    const root = `(x*${fac1[T]}+${laterE((u) => rates[u - 1])}-${lit(L[T])})`;
    const showLater = later.length ? ` + ${laterTerm((u) => rates[u - 1])}` : "";
    const opts: MathOpt[] = [];
    if (later.length) {
      opts.push({ latex: `x(${fac1[T]}) = ${Lm}`, probe: `(x*${fac1[T]}-${lit(L[T])})`, misconception: "MODEL_IGNORED_COUPON", why: `Longer bonds also pay coupons at time ${target}, which reduce what bond ${names[T]} must provide.`, stage: 1, failure: "application" });
      opts.push({ latex: `x(${fac1[T]}) + ${later.map((u) => `${mnum(Fs[u - 1], 2)}(${fac1[u - 1]})`).join(" + ")} = ${Lm}`, probe: `(x*${fac1[T]}+${later.map((u) => `${lit(Fs[u - 1])}*${fac1[u - 1]}`).join("+")}-${lit(L[T])})`, misconception: "CONC_DOUBLE_COUNTED", why: "Longer bonds pay only a coupon at time " + target + "; their redemption comes later.", stage: 1, failure: "application" });
      opts.push({ latex: later.length > 1 ? `x(${fac1[T]}) - \\left[${laterTerm((u) => rates[u - 1])}\\right] = ${Lm}` : `x(${fac1[T]}) - ${laterTerm((u) => rates[u - 1])} = ${Lm}`, probe: `(x*${fac1[T]}-(${laterE((u) => rates[u - 1])})-${lit(L[T])})`, misconception: "ALG_SIGN_ERROR", why: "The longer bonds' coupons are received, so they add to the time-" + target + " inflow.", stage: 2, failure: "application" });
      opts.push({ latex: `x(${fac1[later[0] - 1]})${showLater} = ${Lm}`, probe: `(x*${lit(1 + rates[later[0] - 1])}+${laterE((u) => rates[u - 1])}-${lit(L[T])})`, misconception: "ALLOC_SWAPPED", why: `Bond ${names[T]}'s own coupon rate is ${pc(rates[T])}.`, stage: 2, failure: "selection" });
      opts.push({ latex: `x${showLater} = ${Lm}`, probe: `(x+${laterE((u) => rates[u - 1])}-${lit(L[T])})`, misconception: "TRANS_IGNORED_CONDITION", why: `Bond ${names[T]} pays its final coupon as well as its face at time ${target}.`, stage: 2, failure: "application" });
    } else {
      opts.push({ latex: `x = ${Lm}`, probe: `(x-${lit(L[T])})`, misconception: "TRANS_IGNORED_CONDITION", why: `At maturity bond ${names[T]} pays its face plus a final coupon.`, stage: 2, failure: "application" });
      opts.push({ latex: `x(1 + 2(${R[T]})) = ${mamt(L[T])} + ${mamt(L[0])}`, probe: `(x*(1+2*${R[T]})-${lit(L[T] + L[0])})`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Matching is date by date; totals over several dates are not matched.", stage: 0, failure: "interpretation" });
      opts.push({ latex: `x(${fac1[T]}) + x(${R[T]}) = ${Lm}`, probe: `(x*${fac1[T]}+x*${R[T]}-${lit(L[T])})`, misconception: "CONC_DOUBLE_COUNTED", why: `Bond ${names[T]}'s time-1 coupon is paid at time 1, not at time ${target}.`, stage: 1, failure: "application" });
      opts.push({ latex: `x(${fac1[0]}) = ${Lm}`, probe: `(x*${fac1[0]}-${lit(L[T])})`, misconception: "ALLOC_SWAPPED", why: `Bond ${names[T]}'s coupon rate is ${pc(rates[T])}, not ${pc(rates[0])}.`, stage: 2, failure: "selection" });
      opts.push({ latex: `x(${fac1[T]}) = ${Lm}(${fac1[T]})^{-${target}}`, probe: `(x*${fac1[T]}-${lit(L[T])}*${fac1[T]}**(-${target}))`, misconception: "TIMING_VALUATION_DATE", why: "Matching equates payments on the same date; no discounting is involved.", stage: 1, failure: "application" });
    }
    const xTrue = (L[T] - later.reduce((t, u) => t + Fs[u - 1] * rates[u - 1], 0)) / (1 + rates[T]);
    return conceptQuestion({
      stem,
      correct: { content: math(`x(${fac1[T]})${showLater} = ${Lm}`), why: `At time ${target} bond ${names[T]} pays $x(1 + ${R[T]})$${later.length ? ` and the longer bond${later.length > 1 ? "s pay coupons" : " pays a coupon"} on face${later.length > 1 ? "s" : ""} already fixed by the later liabilit${later.length > 1 ? "ies" : "y"}` : ""}; together they must equal the liability: $x = ${mnum(xTrue, 2)}$.`, probe: root },
      distractors: mathOpts(opts),
      reference: { values: [{ label: "x", expr: `((${lit(L[T])}-(${laterE((u) => rates[u - 1])}))/${fac1[T]})` }], description: `Working back from the last liability: ${names.map((nm, k) => `${nm} = ${mnum(Fs[k], 2)}`).join(", ")}. Each option is solved for $x$ and compared.` },
      steps: [
        { concept: "alm.cash-flow-matching", reasoning: `Start with the last liability: only bond ${names[n - 1]} pays at time ${n}, so its face is fixed first.` },
        { concept: "alm.cash-flow-matching", reasoning: "Move back one date at a time; at each date the longer bonds already chosen contribute coupons." },
        { concept: "bond.price-yield", reasoning: `At its maturity, bond ${names[T]} pays face plus final coupon, $x(1 + ${R[T]})$.` },
        ...(level === 3 ? [{ concept: "alm.cash-flow-matching", reasoning: `Equate the total inflow at time ${target} to ${Lm}.` }] : []),
      ],
      concepts: ["alm.cash-flow-matching", "bond.price-yield"],
      conditions: ["Annual coupons on face; redemption at face.", "Asset inflows equal liability outflows on each date."],
      relationship: `Inflow at time $t$: $F_t(1 + r_t) + \\sum_{u > t} F_u r_u = L_t$`,
      counterexample: "With zero-coupon bonds each face would simply equal its liability.",
      transfer: { principle: "Match from the last date backwards so that each longer bond's coupons are known before the earlier dates are filled.", unusual: target === n ? "The unknown is the longest bond." : "The unknown is a shorter bond whose need is reduced by later bonds' coupons.", misread: "Coupons of longer bonds arrive at earlier dates." },
      itemFormat: "timeline-reading",
      presentation: level === 3 ? ["hidden-structure", "multi-equation"] : ["multi-equation"],
      ...(level === 3 ? { modelingDecisions: 1 } : {}),
      features: { multiConcept: true, unfamiliar: level === 3 },
      params: { L: L.join(","), rates: rates.join(","), target, variant },
    });
  },
});

const matchingStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-matching-statements",
  family: "con-alm-matching",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.cash_flow_matching",
  secondary: ["ALM.redington"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["conditions", "relationships"],
  soaConcept: "Statements about exact matching, equal present values and rate changes.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.cash-flow-matching", reasoning: "Exact matching equates asset and liability cash flows on every date." },
      { concept: "alm.surplus", reasoning: "Equal flows give equal values at every rate; equal values at one rate do not give equal flows." },
      { concept: "alm.redington", reasoning: "Immunization conditions concern present values and derivatives, not the flows themselves." },
    ];
    const common = {
      steps,
      conditions: ["Default-free, non-callable assets.", "Annual effective rates."],
      relationship: "$A_t = L_t\\ \\forall t \\;\\Rightarrow\\; PV_A(j) = PV_L(j)\\ \\forall j$, but not conversely.",
      transfer: { principle: "Matching is about cash flows; immunization is about present values and their derivatives.", unusual: "Several properties are judged together.", misread: "A present-value match at one rate is not a cash-flow match." },
    };
    if (level === 1) {
      const statements =
        variant === 0
          ? [
              statement("I", "An exactly matched portfolio needs no rebalancing when interest rates change.", true, "Every liability payment is met by an asset payment on the same date.", "CONC_ALM_MATCHING_REBALANCE", { stage: 0, failure: "application" }),
              statement("II", "Any asset portfolio with the same present value as the liabilities is exactly matched.", false, "Equal present values at one rate allow very different timing.", "CONC_PV_MATCH_IMMUNIZES", { stage: 1, failure: "recognition" }),
              statement("III", "When matching with coupon bonds, the face amount of the longest bond is determined first.", true, "Only the longest bond pays at the last date; its coupons then reduce the earlier needs.", "MODEL_IGNORED_COUPON", { stage: 0, failure: "application" }),
            ]
          : [
              statement("I", "Exact matching protects against non-parallel changes in the yield curve.", true, "No rate enters when every payment is met on its date.", "CONC_RELATED_TERM", { stage: 2, failure: "connection", confusedWith: "alm.redington" }),
              statement("II", "Exact matching requires the assets' convexity to exceed the liabilities'.", false, "Identical flows have identical convexity; matching needs no inequality.", "CONC_ALM_MATCHING_AS_IMMUNIZATION", { stage: 2, failure: "recognition" }),
              statement("III", "The surplus of an exactly matched portfolio is zero at every interest rate.", true, "Asset and liability values are the same function of the rate.", "CONC_ALM_MATCHING_REBALANCE", { stage: 1, failure: "application" }),
            ];
      return statementQuestion({
        stem: "Determine which of the following statements are true.",
        statements,
        extra: [
          { keys: ["II"], misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "Every statement is misjudged, as if matching were a form of immunization.", stage: 2, failure: "connection" },
          { keys: [], misconception: "SEQ_UNDISCOUNTED_SUM", why: "Rejecting every statement treats matching as a comparison of totals.", stage: 0, failure: "interpretation" },
        ],
        ...common,
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const j = Number((i + (variant === 0 ? 1 : -1) * rng.choice([0.01, 0.02])).toFixed(6));
    const L: Flow[] = [1, 2, 3].map((t) => ({ t, amount: gridAmount(rng, 10000, 50000, 1000) }));
    const A1 = drawUntil(() => gridAmount(rng, 10000, 60000, 1000), (x) => x * Math.pow(1 + i, -1) < pvFlows(L, i) * 0.8 && Math.abs(x - L[0].amount) > 2000);
    const A3 = Math.round(((pvFlows(L, i) - A1 / (1 + i)) * Math.pow(1 + i, 3)) * 100) / 100;
    const A: Flow[] = [{ t: 1, amount: A1 }, { t: 3, amount: A3 }];
    const statements = [
      statement("I", `At ${pc(i)}, the assets and the liabilities have equal present values.`, true, `$${mamt(A1)}v + ${mnum(A3, 2)}v^3$ equals the liabilities' value at ${pc(i)}, although the undiscounted totals differ.`, "SEQ_UNDISCOUNTED_SUM", { stage: 1, failure: "interpretation", check: { expr: pvE(A, i), op: "=", than: pvE(L, i), tol: 1e-6 } }),
      statement("II", "The insurer's position is an exact cash-flow match.", false, "No asset pays at time 2, and the time-1 and time-3 amounts differ from the liabilities.", "CONC_PV_MATCH_IMMUNIZES", { stage: 0, failure: "recognition" }),
      statement("III", `If the rate changes to ${pc(j)}, the surplus remains zero.`, false, `At ${pc(j)} the surplus is ${mnum(pvFlows(A, j) - pvFlows(L, j), 2)}: the timing differs, so values diverge.`, "CONC_ALM_MATCHING_AS_IMMUNIZATION", { stage: 2, failure: "conclusion", check: { expr: pvE(A, j), op: "=", than: pvE(L, j), tol: 1e-6 } }),
    ];
    return statementQuestion({
      stem: `An insurer must pay ${andList(L.map((x) => mamt(x.amount)))} at times 1, 2 and 3, respectively. It holds zero-coupon bonds paying ${mamt(A1)} at time 1 and ${mnum(A3, 2)} at time 3. The annual effective rate is ${pc(i)}.\n\nDetermine which of the following statements are true.`,
      statements,
      extra: [
        { keys: ["I", "II", "III"], misconception: "CONC_ALM_MATCHING_REBALANCE", why: "Accepting every statement treats a present-value match as a cash-flow match.", stage: 0, failure: "recognition" },
        { keys: ["II", "III"], misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "Statements II and III both treat equal present values as full protection.", stage: 2, failure: "connection" },
      ],
      ...common,
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { i, j, A1, A3, variant },
    });
  },
});

// ================================================================ full immunization

/** Two zero-coupon assets at n-a and n+b that fully immunize L at n (PV and Macaulay duration matched). */
const fullPair = (L: number, n: number, a: number, b: number, i: number): Flow[] => [
  { t: n - a, amount: Math.round(((L * b) / (a + b)) * Math.pow(1 + i, -a) * 100) / 100 },
  { t: n + b, amount: Math.round(((L * a) / (a + b)) * Math.pow(1 + i, b) * 100) / 100 },
];
/** Two zero-coupon assets at times t1, t2 with given PV share w in the first and total PV V. */
const pvSplit = (V: number, t1: number, t2: number, w: number, i: number): Flow[] => [
  { t: t1, amount: Math.round(V * w * Math.pow(1 + i, t1) * 100) / 100 },
  { t: t2, amount: Math.round(V * (1 - w) * Math.pow(1 + i, t2) * 100) / 100 },
];
const surplusE = (A: Flow[], L: Flow[], r: number | string) => `((${pvE(A, r)})-(${pvE(L, r)}))`;
/** min of the surplus after a parallel shift of +d and -d. */
const minSurplus = (A: Flow[], L: Flow[], i: number, d: number) => minE(surplusE(A, L, i + d), surplusE(A, L, i - d));
const flowText = (fs: Flow[]) => fs.map((f) => `${mamt(f.amount)} at time ${f.t}`).join(" and ");
const flowProse = (fs: Flow[]) => fs.map((f) => `${amtText(f.amount)} at time ${f.t}`).join(" and ");

const fullConditions: ChoiceTemplate = conceptTemplate({
  id: "con-alm-full-conditions",
  family: "con-alm-full",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.full_immunization",
  secondary: ["ALM.redington"],
  itemFormat: "enumerated-conditions",
  conceptFamily: "definition",
  dimensions: ["conditions", "applicability"],
  soaConcept: "The conditions for full immunization of a single liability, and what it protects against.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.full-immunization", reasoning: "Full immunization of a single liability uses one asset flow before and one after the liability date." },
      { concept: "alm.surplus", reasoning: "With equal present values and equal Macaulay durations, the surplus is zero at the current rate and non-negative at every other flat rate." },
      { concept: "alm.redington", reasoning: "Redington immunization guarantees this only for small shifts; full immunization extends it to parallel shifts of any size." },
    ];
    const conditions = ["Flat yield curve; parallel shifts.", "Zero-coupon (default-free) asset flows."];
    const relationship = "$A v^{n-a} + B v^{n+b} = L v^n, \\qquad (n-a)A v^{n-a} + (n+b)B v^{n+b} = n L v^n, \\qquad a, b > 0$";
    const transfer = { principle: "Full immunization = Redington conditions + one asset flow on each side of a single liability.", unusual: "Conditions are listed rather than applied.", misread: "Parallel shifts of any size, but still only parallel shifts." };
    if (level === 1) {
      const conds = variant === 0;
      return conceptQuestion({
        stem: conds
          ? "A single liability $L$ due at time $n$ is to be fully immunized with asset cash flows $A$ at time $n - a$ and $B$ at time $n + b$, where $A, B > 0$. Which of the following sets of conditions is required?"
          : "An insurer has fully immunized a single liability with two zero-coupon assets. Which of the following describes the protection this gives?",
        correct: conds
          ? { content: "Equal present values, equal Macaulay durations, and $a > 0$, $b > 0$.", why: "Matching value and duration with one flow on each side makes the surplus non-negative for every parallel shift." }
          : { content: "The surplus is non-negative after a parallel shift in rates of any size.", why: "With bracketing flows and matched value and duration, the surplus has a global minimum of zero at the current rate." },
        distractors: conds
          ? [
              { content: "Equal present values only, with $a$ and $b$ of either sign.", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Without matched durations the surplus falls for a shift in one direction.", stage: 1, failure: "recognition" },
              { content: "Equal present values and equal Macaulay durations, with $a < 0$ allowed.", misconception: "CONC_ALM_FULL_SAME_SIDE", why: "With both flows after time $n$ the durations cannot match; one flow must precede the liability.", stage: 0, failure: "application" },
              { content: "Equal present values, equal durations, and asset convexity below the liability's.", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "The asset side must be the more convex one.", stage: 2, failure: "application" },
              { content: "Equal undiscounted totals and equal amount-weighted mean times.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Value and duration are measured with present values.", stage: 1, failure: "interpretation" },
            ]
          : [
              { content: "The surplus is non-negative only after small parallel shifts in rates.", misconception: "CONC_ALM_FULL_SMALL_SHIFTS", why: "That is Redington's guarantee; full immunization holds for any size of parallel shift.", stage: 2, failure: "conclusion", confusedWith: "alm.redington" },
              { content: "The surplus is non-negative after any change in rates, including changes in the shape of the curve.", misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "Non-parallel shifts can produce a loss.", stage: 2, failure: "application" },
              { content: "The asset payments equal the liability payment on its due date.", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "That is exact matching; the assets here pay on other dates.", stage: 0, failure: "recognition", confusedWith: "alm.cash-flow-matching" },
              { content: "The present values of assets and liabilities stay equal after any parallel shift.", misconception: "CONC_IGNORED_CONVEXITY", why: "The surplus becomes positive after a shift; the present values do not stay equal.", stage: 1, failure: "interpretation" },
            ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: conds ? "enumerated-conditions" : "interpretation",
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const n = rng.int(5, 10);
    const [a, b] = drawUntil(() => [rng.int(1, 4), rng.int(1, 4)], ([x, y]) => x !== y && x < n);
    const L = gridAmount(rng, 50000, 500000, 10000);
    const liab: Flow[] = [{ t: n, amount: L }];
    const V = L * Math.pow(1 + i, -n);
    const d = 0.01;
    if (variant === 0) {
      const full = fullPair(L, n, a, b, i);
      const after = pvSplit(V, n + 1, n + b + 2, 0.5, i);
      const even = pvSplit(V, n - a, n + b, 0.5, i);
      // Amount-weighted duration match: A a = B b with present values equal.
      const Aamt = (L * Math.pow(1 + i, -n)) / (Math.pow(1 + i, -(n - a)) + (a / b) * Math.pow(1 + i, -(n + b)));
      const amountW: Flow[] = [{ t: n - a, amount: Math.round(Aamt * 100) / 100 }, { t: n + b, amount: Math.round(((Aamt * a) / b) * 100) / 100 }];
      const single: Flow[] = [{ t: n + b, amount: Math.round(V * Math.pow(1 + i, n + b) * 100) / 100 }];
      return conceptQuestion({
        stem: `An insurer must pay ${mamt(L)} at time ${n}. The annual effective rate is ${pc(i)}, and each of the following zero-coupon portfolios has the same present value as the liability.\n\nWhich portfolio fully immunizes the liability?`,
        correct: { content: flowText(full), why: `Present values match and the PV-weighted mean time is ${n}, with one flow on each side of time ${n}: the surplus is non-negative for every parallel shift.`, check: { expr: minSurplus(full, liab, i, d), op: ">", than: 0 } },
        distractors: [
          { content: flowText(after), misconception: "CONC_ALM_FULL_SAME_SIDE", why: `Both flows follow time ${n}, so the assets' duration exceeds ${n} and a rise in rates creates a loss.`, check: { expr: minSurplus(after, liab, i, d), op: ">", than: 0 }, stage: 0, failure: "application" },
          { content: flowText(even), misconception: "ALLOC_EVEN_SPLIT", why: "Equal present values in the two bonds give a duration of $n + (b - a)/2$, not $n$.", check: { expr: minSurplus(even, liab, i, d), op: ">", than: 0 }, stage: 1, failure: "application" },
          { content: flowText(amountW), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "These amounts match the amount-weighted mean time, not the Macaulay duration.", check: { expr: minSurplus(amountW, liab, i, d), op: ">", than: 0 }, stage: 1, failure: "interpretation" },
          { content: flowText(single), misconception: "CONC_PV_MATCH_IMMUNIZES", why: "A single later flow matches value only; its duration is " + (n + b) + ".", check: { expr: minSurplus(single, liab, i, d), op: ">", than: 0 }, stage: 1, failure: "recognition" },
        ],
        steps: [...steps.slice(0, 2), { concept: "alm.macaulay-vs-modified", reasoning: "Check each portfolio's PV-weighted mean time against " + n + "." }],
        conditions,
        relationship,
        transfer,
        itemFormat: "applicability",
        presentation: ["compare-streams"],
        features: { multiConcept: true },
        params: { i, n, a, b, L, variant },
      });
    }
    const liabs = fullPair(L, n, a, b, i);
    const asset: Flow[] = [{ t: n, amount: L }];
    const Sp = surplusE(asset, liabs, i + d);
    const Sm = surplusE(asset, liabs, i - d);
    return conceptQuestion({
      stem: `A pension fund must pay ${flowProse(liabs)}. At the annual effective rate of ${pc(i)}, these have the same present value and Macaulay duration as a zero-coupon bond paying ${mamt(L)} at time ${n}, which the fund buys.\n\nWhich of the following is true?`,
      correct: { content: "The position is not immunized: the surplus falls below zero after a parallel shift in either direction.", why: "The liabilities bracket the asset, so they are the more convex side: the surplus has a maximum, not a minimum, at the current rate.", check: { expr: minE(`-(${Sp})`, `-(${Sm})`), op: ">", than: 0 } },
      distractors: [
        { content: "The position is fully immunized, since present values and durations match.", misconception: "CONC_IGNORED_CONVEXITY", why: "Matching value and duration is not enough; the convexity condition fails.", check: { expr: minE(Sp, Sm), op: ">=", than: 0 }, stage: 2, failure: "conclusion" },
        { content: "The position is immunized against small shifts but not against large ones.", misconception: "CONC_ALM_FULL_SMALL_SHIFTS", why: "It fails even for small shifts: $S''(i) < 0$.", check: { expr: minE(surplusE(asset, liabs, i + 0.001), surplusE(asset, liabs, i - 0.001)), op: ">=", than: 0 }, stage: 2, failure: "application" },
        { content: "The position is immunized, because the asset lies between the two liability dates.", misconception: "CONC_DIRECTION_REVERSED", why: "Bracketing works the other way: the assets must surround the liability.", check: { expr: minE(Sp, Sm), op: ">", than: 0 }, stage: 0, failure: "application" },
        { content: "The surplus rises if rates rise and falls if rates fall.", misconception: "CONC_RELATED_TERM", why: "That would indicate a duration mismatch; the durations match here.", check: { expr: minE(Sp, `-(${Sm})`), op: ">", than: 0 }, stage: 1, failure: "connection", confusedWith: "alm.macaulay-vs-modified" },
      ],
      steps: [
        { concept: "alm.full-immunization", reasoning: "Full immunization needs the asset flows to surround the liability; here the roles are reversed." },
        { concept: "alm.convexity", reasoning: "The two liabilities are spread around the single asset, so the liabilities are more convex." },
        { concept: "alm.surplus", reasoning: "With $S = S' = 0$ and $S'' < 0$, the surplus is negative after any shift." },
      ],
      concepts: ["alm.full-immunization", "alm.convexity", "alm.surplus"],
      conditions,
      relationship: "$S''(i) = PV_A''(i) - PV_L''(i) < 0$ when the liabilities are the dispersed side.",
      transfer,
      itemFormat: "applicability",
      presentation: ["hidden-structure"],
      features: { multiConcept: true, unfamiliar: true },
      params: { i, n, a, b, L, variant },
    });
  },
});

const fullDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-alm-full-diagnosis",
  family: "con-alm-full",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.full_immunization",
  secondary: ["ALM.duration", "ALM.redington"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "conditions"],
  reasoning: ["validation", "concept_recognition"],
  soaConcept: "Diagnosing a proposed full-immunization plan.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const n = rng.int(6, 12);
    const [a, b] = drawUntil(() => [rng.int(1, 5), rng.int(1, 5)], ([x, y]) => x !== y && x < n && x + y >= 3);
    const L = gridAmount(rng, 50000, 500000, 10000);
    const liab: Flow[] = [{ t: n, amount: L }];
    const V = L * Math.pow(1 + i, -n);
    const full = fullPair(L, n, a, b, i);
    const d = 0.01;
    const ok = (A: Flow[]) => ({ expr: minSurplus(A, liab, i, d), op: ">" as const, than: 0 });
    const base = `An insurer must pay ${mamt(L)} at time ${n}. The annual effective rate is ${pc(i)}. Zero-coupon bonds maturing at times ${n - a} and ${n + b} are available.`;
    const steps = [
      { concept: "alm.full-immunization", reasoning: `One asset flow before and one after time ${n}: the times are suitable.` },
      { concept: "alm.macaulay-vs-modified", reasoning: "The duration condition uses present-value weights and like-for-like durations." },
      { concept: "alm.surplus", reasoning: "With value and duration matched, the surplus is non-negative for every parallel shift." },
    ];
    const conditions = ["Flat yield curve; parallel shifts.", "Zero-coupon, default-free assets."];
    const relationship = "$A v^{n-a} + B v^{n+b} = L v^n, \\qquad -aA v^{n-a} + bB v^{n+b} = 0$";
    if (level === 2) {
      const amountWeights = variant === 0;
      let cand: Flow[];
      let method: string;
      if (amountWeights) {
        const Aamt = V / (Math.pow(1 + i, -(n - a)) + (a / b) * Math.pow(1 + i, -(n + b)));
        cand = [{ t: n - a, amount: Math.round(Aamt * 100) / 100 }, { t: n + b, amount: Math.round(((Aamt * a) / b) * 100) / 100 }];
        method = `equal present values and $${n - a}A + ${n + b}B = ${n}(A + B)$`;
      } else {
        const w = (b - n * i) / (a + b);
        cand = pvSplit(V, n - a, n + b, w, i);
        method = `equal present values and a modified duration of the assets equal to ${n}`;
      }
      const even = pvSplit(V, n - a, n + b, 0.5, i);
      return conceptQuestion({
        stem: `${base} A candidate chooses the amounts $A$ (time ${n - a}) and $B$ (time ${n + b}) from ${method}, obtaining ${flowText(cand)}, and concludes that the liability is fully immunized.\n\nWhich of the following correctly describes the candidate's plan?`,
        correct: amountWeights
          ? { content: "The duration condition must weight each time by present value, not by amount.", why: `With present-value weights the amounts are ${flowText(full)}, which fully immunize the liability.`, check: ok(full) }
          : { content: `The Macaulay duration of the assets must equal ${n}, like the liability's.`, why: `The liability's Macaulay duration is ${n}; comparing it with a modified duration mismatches them by about $${n}i$. Correct amounts: ${flowText(full)}.`, check: ok(full) },
        distractors: [
          { content: "The plan is correct and fully immunizes the liability.", misconception: amountWeights ? "MODEL_UNDISCOUNTED_WEIGHTS" : "FORMULA_MODIFIED_FOR_MACAULAY", why: "The assets' Macaulay duration is not " + n + ", so a parallel shift in one direction creates a loss.", check: ok(cand), stage: 1, failure: amountWeights ? "interpretation" : "selection" },
          { content: "The amounts should be chosen with equal present values in the two bonds.", misconception: "ALLOC_EVEN_SPLIT", why: `Equal present values give a duration of ${n + (b - a) / 2}, not ${n}.`, check: ok(even), stage: 1, failure: "application" },
          { content: "Only the present values need to match; the duration condition can be dropped.", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Without a duration match the surplus falls for a shift in one direction.", stage: 1, failure: "recognition" },
          { content: `Both bonds must mature after time ${n} for the plan to work.`, misconception: "CONC_ALM_FULL_SAME_SIDE", why: "One asset flow must precede the liability.", stage: 0, failure: "application" },
          { content: "The assets' convexity must also equal the liability's convexity.", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "The assets must be more convex; equal convexity is neither needed nor possible here.", stage: 2, failure: "application" },
        ],
        reference: { description: `Full immunization requires ${flowText(full)}; each proposed correction is tested by the surplus after parallel shifts of $\\pm${d}$.` },
        steps,
        conditions,
        relationship,
        transfer: { principle: "Check each immunization condition separately: value, Macaulay duration with PV weights, bracketing.", unusual: "The plan is judged, not built.", misread: "A duration condition can be written with the wrong weights or the wrong duration." },
        itemFormat: "error-diagnosis",
        presentation: ["indirect-wording"],
        features: { multiConcept: true, unfamiliar: true },
        params: { i, n, a, b, L, variant },
      });
    }
    if (variant === 0) {
      const even = pvSplit(V, n - a, n + b, 0.5, i);
      const longer = b > a;
      const up = surplusE(even, liab, i + d);
      const dn = surplusE(even, liab, i - d);
      return conceptQuestion({
        stem: `${base} A candidate buys ${flowText(even)}, which have equal present values summing to that of the liability, and argues: "The assets are more spread out than the liability, so their convexity is greater; the surplus is therefore protected against parallel shifts."\n\nWhich of the following correctly describes the candidate's argument?`,
        correct: { content: `It fails: the durations differ, so the surplus falls if the rate ${longer ? "rises" : "falls"}.`, why: `The assets' Macaulay duration is ${n + (b - a) / 2}, ${longer ? "above" : "below"} ${n}; convexity cannot offset a first-order mismatch.`, check: { expr: longer ? up : dn, op: "<", than: 0 } },
        distractors: [
          { content: "It is correct: equal present values and greater asset convexity protect the surplus.", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "The duration condition is missing.", check: ok(even), stage: 1, failure: "recognition" },
          { content: `It fails: the durations differ, so the surplus falls if the rate ${longer ? "falls" : "rises"}.`, misconception: "CONC_DIRECTION_REVERSED", why: `The assets are ${longer ? "longer" : "shorter"} than the liability, so a ${longer ? "rise" : "fall"} in the rate hurts.`, check: { expr: longer ? dn : up, op: "<", than: 0 }, stage: 2, failure: "application" },
          { content: "It fails: the asset convexity must be lower than the liability's.", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "Greater asset convexity is required, not excluded; the flaw is the duration.", stage: 2, failure: "application" },
          { content: "It is correct for small shifts; only large shifts can cause a loss.", misconception: "CONC_ALM_FULL_SMALL_SHIFTS", why: "With unequal durations even small shifts in one direction cause a loss.", check: { expr: minSurplus(even, liab, i, 0.001), op: ">", than: 0 }, stage: 2, failure: "conclusion" },
          { content: `It fails: both bonds would have to mature after time ${n}.`, misconception: "CONC_ALM_FULL_SAME_SIDE", why: "Bracketing is satisfied; the durations are what differ.", stage: 0, failure: "application" },
        ],
        reference: { description: "The surplus after a parallel shift is evaluated directly from the cash flows; the claims are tested against it." },
        steps: [
          { concept: "alm.full-immunization", reasoning: "The asset times bracket the liability, so bracketing is satisfied." },
          { concept: "alm.macaulay-vs-modified", reasoning: `Equal present values give duration $${n} + (${b} - ${a})/2 \\ne ${n}$.` },
          { concept: "alm.surplus", reasoning: "$S'(i) \\ne 0$: the first-order term dominates for small shifts." },
          { concept: "alm.convexity", reasoning: "Convexity only matters once $S'(i) = 0$; it cannot rescue the mismatch." },
        ],
        concepts: ["alm.full-immunization", "alm.surplus", "alm.convexity"],
        conditions,
        relationship,
        transfer: { principle: "Order of conditions: value, then slope, then curvature. A later condition never repairs an earlier one.", unusual: "The argument cites a true fact (greater convexity) to reach a false conclusion.", misread: "Dispersion is necessary, not sufficient." },
        itemFormat: "error-diagnosis",
        presentation: ["hidden-structure"],
        modelingDecisions: 1,
        features: { multiConcept: true, unfamiliar: true },
        params: { i, n, a, b, L, variant },
      });
    }
    // Non-parallel change against a correct full immunization.
    const dd = 0.01;
    const twistE = `((${full[0].amount})*(1+${lit(i - dd)})**(-${full[0].t})+${lit(full[1].amount)}*(1+${lit(i)})**(-${full[1].t})-${lit(L)}*(1+${lit(i - dd)})**(-${n}))`;
    return conceptQuestion({
      stem: `${base} A candidate buys ${flowText(full)}, which fully immunize the liability, and claims the surplus can never become negative. The spot rates for terms of ${n} years or less then fall to ${pc(i - dd)}, while longer rates stay at ${pc(i)}.\n\nWhich of the following correctly describes the candidate's claim?`,
      correct: { content: "It is false: this change is not a parallel shift, and the surplus becomes negative.", why: `The liability and the shorter asset are revalued at the lower rate but the longer asset is not; the liability gains more: the surplus is ${mnum(full[0].amount * Math.pow(1 + i - dd, -full[0].t) + full[1].amount * Math.pow(1 + i, -full[1].t) - L * Math.pow(1 + i - dd, -n), 2)}.`, check: { expr: twistE, op: "<", than: 0 } },
      distractors: [
        { content: "It is true: full immunization protects against any change in rates.", misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "The guarantee covers parallel shifts only.", check: { expr: twistE, op: ">=", than: 0 }, stage: 2, failure: "application" },
        { content: "It is true here: the change is small, and full immunization covers small changes.", misconception: "CONC_ALM_FULL_SMALL_SHIFTS", why: "Size is not the issue; the shape of the change is.", check: { expr: twistE, op: ">", than: 0 }, stage: 2, failure: "conclusion" },
        { content: "The surplus is unchanged, since present values and durations were matched.", misconception: "CONC_IGNORED_CONVEXITY", why: "The assets and liability are revalued at different rates, so the surplus moves.", check: { expr: twistE, op: "=", than: 0 }, stage: 1, failure: "interpretation" },
        { content: `It is false, but only because both bonds should mature after time ${n}.`, misconception: "CONC_ALM_FULL_SAME_SIDE", why: "The bracketing is right; the change in rates is not parallel.", stage: 0, failure: "application" },
      ],
      reference: { description: "The surplus is recomputed with each flow discounted at its new spot rate." },
      steps: [
        { concept: "alm.full-immunization", reasoning: "The plan meets the full-immunization conditions at a flat rate." },
        { concept: "alm.surplus", reasoning: "Its guarantee is for flat (parallel) shifts of the whole curve." },
        { concept: "alm.spot-forward", reasoning: "Here each flow is revalued at the spot rate for its own term: the change is a twist." },
        { concept: "alm.surplus", reasoning: "Revalue each flow; the liability gains more than the shorter asset and the longer asset does not gain." },
      ],
      concepts: ["alm.full-immunization", "alm.surplus", "alm.spot-forward"],
      conditions,
      relationship: "$S = A(1+s_{n-a})^{-(n-a)} + B(1+s_{n+b})^{-(n+b)} - L(1+s_n)^{-n}$",
      transfer: { principle: "Every immunization guarantee is for parallel shifts; check the shape of the change before invoking it.", unusual: "The plan is correct; the claim about it is not.", misread: "'Any shift' means any parallel shift." },
      itemFormat: "error-diagnosis",
      presentation: ["hidden-structure", "indirect-wording"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i, n, a, b, L, variant },
    });
  },
});

const fullStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-full-statements",
  family: "con-alm-full",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.full_immunization",
  secondary: ["ALM.redington", "ALM.cash_flow_matching"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["conditions", "relationships"],
  soaConcept: "Statements about full immunization of a single liability.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.full-immunization", reasoning: "Full immunization: one liability, asset flows on both sides, equal present values and Macaulay durations." },
      { concept: "alm.surplus", reasoning: "The surplus then has a global minimum of zero at the current rate, for flat rates." },
      { concept: "alm.redington", reasoning: "Non-parallel changes and missing conditions fall outside the guarantee." },
    ];
    const common = {
      steps,
      conditions: ["Flat yield curve; parallel shifts.", "Zero-coupon, default-free assets."],
      relationship: "$S(j) = A v_j^{n-a} + B v_j^{n+b} - L v_j^n \\ge 0$ for every rate $j$ when the conditions hold.",
      transfer: { principle: "State exactly what is protected: one liability, parallel shifts, any size.", unusual: "True and false properties are mixed.", misread: "Full immunization is not protection against every change in the curve." },
    };
    if (level === 1) {
      const statements =
        variant === 0
          ? [
              statement("I", "Full immunization of a single liability protects the surplus against parallel shifts of any size.", true, "The surplus is non-negative at every flat rate.", "CONC_ALM_FULL_SMALL_SHIFTS", { stage: 1, failure: "conclusion" }),
              statement("II", "Both asset cash flows may fall after the liability date, provided present values and durations match.", false, "Two flows after time $n$ have duration above $n$, so durations cannot match.", "CONC_ALM_FULL_SAME_SIDE", { stage: 0, failure: "application" }),
              statement("III", "Full immunization protects the surplus against any change in the shape of the yield curve.", false, "Only parallel shifts are covered.", "CONC_ALM_REDINGTON_ALL_SHIFTS", { stage: 2, failure: "application" }),
            ]
          : [
              statement("I", "Under full immunization the surplus is zero at the current rate and non-negative at every other flat rate.", true, "The current rate is a global minimum of the surplus.", "CONC_ALM_FULL_SMALL_SHIFTS", { stage: 1, failure: "conclusion" }),
              statement("II", "Full immunization requires only that the assets and the liability have equal present values.", false, "Durations must also match, with flows on both sides.", "CONC_PV_MATCH_IMMUNIZES", { stage: 0, failure: "recognition" }),
              statement("III", "Exact cash-flow matching of a single liability keeps the surplus at zero at every rate.", true, "Asset and liability flows are identical.", "CONC_ALM_MATCHING_AS_IMMUNIZATION", { stage: 2, failure: "connection", confusedWith: "alm.cash-flow-matching" }),
            ];
      return statementQuestion({
        stem: "Determine which of the following statements are true.",
        statements,
        extra: [
          { keys: variant === 0 ? ["II", "III"] : ["II"], misconception: "CONC_IGNORED_CONVEXITY", why: "Every statement is misjudged, as if matching present values were the whole story.", stage: 1, failure: "recognition" },
          { keys: variant === 0 ? [] : ["III"], misconception: "CONC_RELATED_TERM", why: "Full immunization is confused with Redington immunization.", stage: 2, failure: "connection", confusedWith: "alm.redington" },
        ],
        ...common,
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const n = rng.int(6, 12);
    const [a, b] = drawUntil(() => [rng.int(1, 4), rng.int(1, 4)], ([x, y]) => x !== y && x < n);
    const L = gridAmount(rng, 50000, 500000, 10000);
    const liab: Flow[] = [{ t: n, amount: L }];
    const A = variant === 0 ? fullPair(L, n, a, b, i) : pvSplit(L * Math.pow(1 + i, -n), n - a, n + b, 0.5, i);
    const up = 0.03;
    const s2 = pvFlows(A, i + up) - pvFlows(liab, i + up) < 0;
    const s3 = convexity(A, i) > convexity(liab, i);
    const statements = [
      statement("I", `At ${pc(i)}, the assets and the liability have equal present values.`, true, "Both present values are equal by construction, though the undiscounted totals differ.", "SEQ_UNDISCOUNTED_SUM", { stage: 0, failure: "interpretation", check: { expr: pvE(A, i), op: "=", than: pvE(liab, i), tol: 1e-6 } }),
      statement("II", `If the rate rises to ${pc(i + up)}, the surplus becomes negative.`, s2, `At ${pc(i + up)} the surplus is ${mnum(pvFlows(A, i + up) - pvFlows(liab, i + up), 2)}.`, variant === 0 ? "CONC_ALM_FULL_SMALL_SHIFTS" : "CONC_PV_MATCH_IMMUNIZES", { stage: 1, failure: "conclusion", check: { expr: surplusE(A, liab, i + up), op: "<", than: 0 } }),
      statement("III", "The assets' convexity exceeds the liability's convexity.", s3, `Asset convexity ${mnum(convexity(A, i), 2)} against ${mnum(convexity(liab, i), 2)} for the liability${variant === 1 ? "; with equal present values the assets' duration is not " + n + ", so dispersion alone does not decide it" : ""}.`, "CONC_ALM_LIABILITY_CONVEXITY", { stage: 2, failure: "application", check: { expr: convE(A, i), op: ">", than: convE(liab, i) } }),
    ];
    const truth = statements.filter((x) => x.truth).map((x) => x.key);
    const complement = statements.filter((x) => !x.truth).map((x) => x.key);
    return statementQuestion({
      stem: `An insurer must pay ${mamt(L)} at time ${n}. It holds zero-coupon bonds paying ${flowText(A)}. The annual effective rate is ${pc(i)}.\n\nDetermine which of the following statements are true.`,
      statements,
      extra: [
        { keys: complement, misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "Every statement is misjudged.", stage: 2, failure: "conclusion" },
        { keys: truth.length === 3 ? ["I"] : [], misconception: "CONC_RELATED_TERM", why: "The immunization conditions were confused with one another.", stage: 0, failure: "recognition" },
      ],
      ...common,
      presentation: ["indirect-wording"],
      features: { unfamiliar: true, multiConcept: true },
      params: { i, n, a, b, L, variant },
    });
  },
});

// ================================================================ Redington immunization

const redingtonConditions: ChoiceTemplate = conceptTemplate({
  id: "con-alm-redington-conditions",
  family: "con-alm-redington",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.redington",
  secondary: ["ALM.duration", "ALM.convexity"],
  itemFormat: "enumerated-conditions",
  conceptFamily: "notation",
  dimensions: ["conditions", "terminology"],
  soaConcept: "The three Redington conditions, written in derivatives, durations, the surplus function or dispersion.",
  variants: 2,
  generate(rng, level, variant) {
    const i0 = gridRate(rng, 0.03, 0.08, 0.005);
    const at = `at $i_0 = ${mpc(i0)}$`;
    const steps = [
      { concept: "alm.surplus", reasoning: "Write the surplus $S(i) = PV_A(i) - PV_L(i)$ and expand it about $i_0$." },
      { concept: "alm.redington", reasoning: "A local minimum of 0 at $i_0$ needs $S(i_0) = 0$, $S'(i_0) = 0$ and $S''(i_0) > 0$." },
      { concept: "alm.convexity", reasoning: "With equal present values, $S' = 0$ is equal durations and $S'' > 0$ is greater asset convexity." },
    ];
    const common = {
      steps,
      conditions: ["Flat yield curve; small parallel shifts.", "Derivatives with respect to the annual effective rate."],
      relationship: "$PV_A(i_0) = PV_L(i_0), \\quad PV_A'(i_0) = PV_L'(i_0), \\quad PV_A''(i_0) > PV_L''(i_0)$",
      transfer: { principle: "Redington: value, slope and curvature of the surplus — zero, zero, positive.", unusual: level === 2 ? "The conditions are written in an unfamiliar form." : "Similar condition sets differ in one symbol.", misread: "The curvature condition is strict and favours the assets." },
    };
    type D = { content: string; misconception: import("../misconceptions").MisconceptionId; why: string; stage: number; failure: "recognition" | "interpretation" | "selection" | "application" | "connection" | "conclusion" };
    const make = (correct: string, why: string, ds: D[], format: "enumerated-conditions" | "definition") =>
      conceptQuestion({
        stem:
          level === 1
            ? `An insurer wants its surplus to be non-negative after any small parallel shift in the interest rate from its current level $i_0$. Which of the following sets of conditions ${at} is required for Redington immunization?`
            : variant === 0
              ? `Let $S(i) = PV_A(i) - PV_L(i)$ be an insurer's surplus as a function of the annual effective rate. Which of the following sets of conditions ${at} gives Redington immunization?`
              : `An insurer's assets and liabilities are positive cash flows. Which of the following sets of conditions ${at} gives Redington immunization?`,
        correct: { content: correct, why },
        distractors: ds,
        ...common,
        itemFormat: format,
        presentation: level === 2 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: level === 2 },
        params: { i0, variant },
      });
    if (level === 1 && variant === 0) {
      return make("$PV_A = PV_L$, $PV_A' = PV_L'$ and $PV_A'' > PV_L''$", "The surplus is zero with zero slope and positive curvature at $i_0$.", [
        { content: "$PV_A = PV_L$, $PV_A' = PV_L'$ and $PV_A'' < PV_L''$", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "The assets must have the greater curvature.", stage: 2, failure: "application" },
        { content: "$PV_A = PV_L$ and $PV_A'' > PV_L''$", misconception: "TRANS_IGNORED_CONDITION", why: "Without equal slopes the surplus falls in one direction.", stage: 1, failure: "application" },
        { content: "$PV_A = PV_L$, $PV_A' = PV_L'$ and $PV_A'' = PV_L''$", misconception: "CONC_IGNORED_CONVEXITY", why: "Equal curvature gives no second-order protection.", stage: 2, failure: "conclusion" },
        { content: "$PV_A = PV_L$", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Equal values alone do not protect against any shift.", stage: 1, failure: "recognition" },
        { content: "$PV_A' = PV_L'$ and $PV_A'' > PV_L''$", misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: "The surplus must also start at zero (equal values).", stage: 0, failure: "application" },
      ], "enumerated-conditions");
    }
    if (level === 1) {
      return make("$PV_A = PV_L$, $D_A = D_L$ and $C_A > C_L$", "With equal values, equal durations give equal slopes and greater convexity gives greater curvature.", [
        { content: "$PV_A = PV_L$, $D_A = D_L$ and $C_A < C_L$", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "The asset side must be the more convex.", stage: 2, failure: "application" },
        { content: "$PV_A = PV_L$, $D_A > D_L$ and $C_A > C_L$", misconception: "CONC_DIRECTION_REVERSED", why: "Unequal durations leave a first-order exposure.", stage: 1, failure: "application" },
        { content: "$PV_A = PV_L$, $D_A = D_L$ and $C_A = C_L$", misconception: "CONC_IGNORED_CONVEXITY", why: "Equal convexity gives no second-order gain.", stage: 2, failure: "conclusion" },
        { content: "$PV_A = PV_L$ and $C_A > C_L$", misconception: "TRANS_IGNORED_CONDITION", why: "The duration condition is missing.", stage: 1, failure: "application" },
        { content: "$PV_A = PV_L$", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Equal values alone do not protect against any shift.", stage: 1, failure: "recognition" },
      ], "enumerated-conditions");
    }
    if (variant === 0) {
      return make("$S(i_0) = 0$, $S'(i_0) = 0$ and $S''(i_0) > 0$", "A strict local minimum of zero at $i_0$.", [
        { content: "$S(i_0) = 0$, $S'(i_0) = 0$ and $S''(i_0) < 0$", misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "That is a local maximum: every small shift creates a loss.", stage: 2, failure: "application" },
        { content: "$S(i_0) = 0$ and $S''(i_0) > 0$", misconception: "TRANS_IGNORED_CONDITION", why: "With $S'(i_0) \\ne 0$, one direction loses to first order.", stage: 1, failure: "application" },
        { content: "$S(i_0) = 0$, $S'(i_0) > 0$ and $S''(i_0) > 0$", misconception: "CONC_DIRECTION_REVERSED", why: "A positive slope means a loss when the rate falls.", stage: 1, failure: "application" },
        { content: "$S(i_0) = 0$", misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Equal values alone do not protect against any shift.", stage: 1, failure: "recognition" },
        { content: "$S'(i_0) = 0$ and $S''(i_0) > 0$", misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: "The surplus must also start at zero.", stage: 0, failure: "application" },
      ], "enumerated-conditions");
    }
    return make("Equal present values, equal Macaulay durations, and asset cash flows more dispersed about that duration than the liability cash flows", "With equal values and durations, $C(1+i)^2 = D^2 + D + \\text{dispersion}$, so greater asset dispersion is greater asset convexity.", [
      { content: "Equal present values, equal Macaulay durations, and asset cash flows less dispersed about that duration than the liability cash flows", misconception: "CONC_ALM_BULLET_MORE_CONVEX", why: "Less dispersion means less convexity.", stage: 2, failure: "application" },
      { content: "Equal present values and asset cash flows more dispersed in time than the liability cash flows", misconception: "TRANS_IGNORED_CONDITION", why: "The duration condition is missing.", stage: 1, failure: "application" },
      { content: "Equal present values, equal Macaulay durations, and equally dispersed asset and liability cash flows", misconception: "CONC_IGNORED_CONVEXITY", why: "Equal dispersion means equal convexity: no second-order protection.", stage: 2, failure: "conclusion" },
      { content: "Equal undiscounted totals, equal amount-weighted mean times, and more dispersed asset cash flows", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "All three conditions are measured with present values.", stage: 0, failure: "interpretation" },
      { content: "Equal present values only, with the asset cash flows paid on the liability dates", misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "That mixes up matching and immunization.", stage: 0, failure: "recognition" },
    ], "definition");
  },
});

const redingtonStatements: ChoiceTemplate = conceptTemplate({
  id: "con-alm-redington-statements",
  family: "con-alm-redington",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.redington",
  secondary: ["ALM.full_immunization", "ALM.convexity"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["conditions", "relationships"],
  soaConcept: "Necessary and sufficient conditions for Redington immunization, judged as a set of statements.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const n = rng.int(6, 12);
    const [a, b] = drawUntil(() => [rng.int(1, 4), rng.int(1, 4)], ([x, y]) => x < n && x + y >= 3);
    const L = gridAmount(rng, 50000, 500000, 10000);
    const steps = [
      { concept: "alm.surplus", reasoning: "Write the surplus and its first two derivatives at the current rate." },
      { concept: "alm.redington", reasoning: "Redington needs equal values, equal durations and greater asset convexity; it protects against small parallel shifts." },
      { concept: "alm.full-immunization", reasoning: "Large shifts are covered only under full immunization; non-parallel changes are never covered." },
    ];
    const common = {
      conditions: ["Flat yield curve unless a change in shape is stated.", "Zero-coupon, default-free cash flows."],
      relationship: "$S(i) = 0,\\ S'(i) = 0,\\ S''(i) > 0$",
      transfer: { principle: "Each immunization condition is necessary; none is sufficient alone.", unusual: "Conditions are judged in a specific position.", misread: "'Any size' and 'any shape' are different claims." },
    };
    if (level === 2 && variant === 0) {
      return statementQuestion({
        stem: "Assets and liabilities are valued at the same annual effective rate. Determine which of the following statements are true.",
        statements: [
          statement("I", "If assets and liabilities have equal present values and equal Macaulay durations, they also have equal modified durations.", true, "Both modified durations are the Macaulay duration divided by the same $1 + i$.", "FORMULA_MODIFIED_FOR_MACAULAY", { stage: 1, failure: "connection", confusedWith: "alm.macaulay-vs-modified" }),
          statement("II", "Redington immunization guarantees a non-negative surplus after a parallel shift of any size.", false, "It guarantees this only for small shifts.", "CONC_ALM_REDINGTON_ALL_SHIFTS", { stage: 2, failure: "conclusion", conditionTrue: "True under full immunization of a single liability." }),
          statement("III", "Equal present values alone keep the surplus non-negative after small parallel shifts.", false, "Without equal durations the surplus falls to first order in one direction.", "CONC_PV_MATCH_IMMUNIZES", { stage: 1, failure: "recognition" }),
        ],
        extra: [
          { keys: ["II", "III"], misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: "Every statement is misjudged.", stage: 1, failure: "conclusion" },
          { keys: [], misconception: "CONC_RELATED_TERM", why: "Rejecting I confuses the two durations' relationship.", stage: 1, failure: "connection" },
        ],
        steps,
        ...common,
        presentation: ["indirect-wording"],
        features: { unfamiliar: true, multiConcept: true },
        params: { variant },
      });
    }
    if (level === 2) {
      const liabs = fullPair(L, n, a, b, i);
      const asset: Flow[] = [{ t: n, amount: L }];
      const PVeq = `sqrt(((${pvE(asset, i)})/(${pvE(liabs, i)})-1)**2+((${durE(asset, i)})-(${durE(liabs, i)}))**2)`;
      return statementQuestion({
        stem: `A fund must pay ${flowText(liabs)}. It holds one zero-coupon bond paying ${mamt(L)} at time ${n}. The annual effective rate is ${pc(i)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", "The asset and the liabilities have equal present values and equal Macaulay durations.", true, `Both have present value ${mnum(pvFlows(asset, i), 2)} and duration ${n}.`, "MODEL_UNDISCOUNTED_WEIGHTS", { stage: 0, failure: "interpretation", check: { expr: PVeq, op: "<", than: 1e-5 } }),
          statement("II", `The surplus is positive after a small rise in the rate, to ${pc(i + 0.001, 4)}.`, false, "The liabilities are more convex, so the surplus falls on both sides.", "CONC_IGNORED_CONVEXITY", { stage: 2, failure: "conclusion", check: { expr: surplusE(asset, liabs, i + 0.001), op: ">", than: 0 } }),
          statement("III", "The asset's convexity is less than the liabilities' convexity.", true, "A single payment at the duration is the least convex position with that duration.", "CONC_ALM_BULLET_MORE_CONVEX", { stage: 1, failure: "application", check: { expr: convE(asset, i), op: "<", than: convE(liabs, i) } }),
        ],
        extra: [
          { keys: ["II"], misconception: "CONC_ALM_LIABILITY_CONVEXITY", why: "Every statement is misjudged, with the convexity condition reversed.", stage: 1, failure: "application" },
          { keys: ["I", "II"], misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Matching value and duration was taken as immunization.", stage: 1, failure: "recognition" },
        ],
        steps,
        ...common,
        presentation: ["hidden-structure"],
        features: { unfamiliar: true, multiConcept: true },
        params: { i, n, a, b, L, variant },
      });
    }
    // Level 3.
    if (variant === 0) {
      const liab: Flow[] = [{ t: n, amount: L }];
      const A = fullPair(L, n, a, b, i);
      const dd = 0.01;
      const twist = `((${lit(A[0].amount)})*(1+${lit(i - dd)})**(-${A[0].t})+${lit(A[1].amount)}*(1+${lit(i)})**(-${A[1].t})-${lit(L)}*(1+${lit(i - dd)})**(-${n}))`;
      return statementQuestion({
        stem: `An insurer must pay ${mamt(L)} at time ${n}. It holds zero-coupon bonds paying ${flowText(A)}, chosen so that present values and Macaulay durations match at the annual effective rate of ${pc(i)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The three Redington conditions hold at ${pc(i)}.`, true, "Values and durations match by construction, and the bracketing assets are more convex.", "CONC_ALM_LIABILITY_CONVEXITY", { stage: 1, failure: "application", check: { expr: convE(A, i), op: ">", than: convE(liab, i) } }),
          statement("II", `After an immediate parallel shift to ${pc(i + 0.03)}, the surplus is non-negative.`, true, "With one asset on each side of a single liability, the position is fully immunized: any parallel shift is covered.", "CONC_ALM_FULL_SMALL_SHIFTS", { stage: 2, failure: "conclusion", check: { expr: surplusE(A, liab, i + 0.03), op: ">=", than: 0 } }),
          statement("III", `If rates for terms of ${n} years or less fall to ${pc(i - dd)} while longer rates stay at ${pc(i)}, the surplus is non-negative.`, false, `This is not a parallel shift: the surplus becomes ${mnum(A[0].amount * Math.pow(1 + i - dd, -A[0].t) + A[1].amount * Math.pow(1 + i, -A[1].t) - L * Math.pow(1 + i - dd, -n), 2)}.`, "CONC_ALM_REDINGTON_ALL_SHIFTS", { stage: 2, failure: "application", check: { expr: twist, op: ">=", than: 0 } }),
        ],
        extra: [
          { keys: ["III"], misconception: "CONC_ALM_MATCHING_AS_IMMUNIZATION", why: "Every statement is misjudged.", stage: 0, failure: "recognition" },
          { keys: ["I"], misconception: "CONC_RELATED_TERM", why: "Redington and full immunization were treated as the same guarantee.", stage: 2, failure: "connection" },
        ],
        steps: [...steps, { concept: "alm.spot-forward", reasoning: "Revalue each flow at its own term's rate after the non-parallel change." }],
        concepts: ["alm.surplus", "alm.redington", "alm.full-immunization", "alm.spot-forward"],
        ...common,
        presentation: ["hidden-structure", "indirect-wording"],
        modelingDecisions: 1,
        features: { unfamiliar: true, multiConcept: true },
        params: { i, n, a, b, L, variant },
      });
    }
    // Two liabilities inside the asset range: Redington holds; check a larger shift numerically.
    const n1 = n - 1;
    const n2 = n + rng.int(1, 3);
    const L1 = gridAmount(rng, 20000, 200000, 10000);
    const L2 = gridAmount(rng, 20000, 200000, 10000);
    const liabs: Flow[] = [{ t: n1, amount: L1 }, { t: n2, amount: L2 }];
    const V = pvFlows(liabs, i);
    const DL = macaulayDuration(liabs, i);
    const t1 = n1 - a;
    const t2 = n2 + b;
    const w = (t2 - DL) / (t2 - t1);
    const A = pvSplit(V, t1, t2, w, i);
    const big = 0.04;
    const sBig = pvFlows(A, i + big) - pvFlows(liabs, i + big) >= 0;
    return statementQuestion({
      stem: `A fund must pay ${flowText(liabs)}. It holds zero-coupon bonds paying ${flowText(A)}, chosen so that present values and Macaulay durations match at the annual effective rate of ${pc(i)}.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `The three Redington conditions hold at ${pc(i)}.`, true, "Values and durations match, and the assets lie outside both liability dates, so they are more dispersed and more convex.", "CONC_ALM_LIABILITY_CONVEXITY", { stage: 1, failure: "application", check: { expr: convE(A, i), op: ">", than: convE(liabs, i) } }),
        statement("II", `After an immediate parallel shift to ${pc(i + big)}, the surplus is non-negative.`, sBig, `At ${pc(i + big)} the surplus is ${mnum(pvFlows(A, i + big) - pvFlows(liabs, i + big), 2)}.`, "CONC_ALM_FULL_SMALL_SHIFTS", { stage: 2, failure: "conclusion", check: { expr: surplusE(A, liabs, i + big), op: ">=", than: 0 } }),
        statement("III", "The position is an exact cash-flow match.", false, "No asset pays on a liability date.", "CONC_ALM_MATCHING_AS_IMMUNIZATION", { stage: 0, failure: "recognition", confusedWith: "alm.cash-flow-matching" }),
      ],
      extra: [
        { keys: sBig ? ["III"] : ["II", "III"], misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Every statement is misjudged.", stage: 1, failure: "recognition" },
        { keys: ["I", "II", "III"], misconception: "CONC_ALM_REDINGTON_ALL_SHIFTS", why: "Immunization was taken to cover everything, including a cash-flow match.", stage: 2, failure: "application" },
      ],
      steps: [...steps, { concept: "alm.portfolio-duration", reasoning: "The liabilities' duration is the PV-weighted mean of their two dates." }],
      concepts: ["alm.surplus", "alm.redington", "alm.full-immunization", "alm.portfolio-duration"],
      ...common,
      presentation: ["hidden-structure", "irrelevant-info"],
      modelingDecisions: 1,
      features: { unfamiliar: true, multiConcept: true },
      params: { i, n1, n2, L1, L2, variant },
    });
  },
});

const crossDurationImmunization: ChoiceTemplate = conceptTemplate({
  id: "con-alm-cross-duration-immunization",
  family: "con-alm-cross",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.redington",
  secondary: ["ALM.duration", "ALM.portfolio", "BONDS.price_redemption"],
  itemFormat: "portfolio-allocation",
  conceptFamily: "cross-topic",
  dimensions: ["transfer", "conditions"],
  reasoning: ["multistep", "financial_intuition", "formula_selection"],
  soaConcept: "Allocating between two assets to match a liability's duration, then deciding whether the position is immunized.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const d = 0.002;
    const pct = (x: number) => `${mnum(x * 100, 2)}%`;
    if (level === 2) {
      // Liability at n; zero-coupon bond at t1 < n and an annual-coupon bond with duration above n.
      const n = rng.int(5, 9);
      const t1 = rng.int(1, n - 2);
      const r = gridRate(rng, 0.03, 0.09, 0.005);
      const m = drawUntil(() => rng.int(n + 2, n + 12), (mm) => macaulayDuration(Array.from({ length: mm }, (_, k) => ({ t: k + 1, amount: r + (k + 1 === mm ? 1 : 0) })), i) > n + 0.75);
      const bond: Flow[] = Array.from({ length: m }, (_, k) => ({ t: k + 1, amount: 100 * r + (k + 1 === m ? 100 : 0) }));
      const D2 = macaulayDuration(bond, i);
      const D2u = bond.reduce((s, f) => s + f.t * f.amount, 0) / bond.reduce((s, f) => s + f.amount, 0);
      const L = gridAmount(rng, 100000, 900000, 10000);
      const liab: Flow[] = [{ t: n, amount: L }];
      const V = L * Math.pow(1 + i, -n);
      const P = pvFlows(bond, i);
      const port = (w: number): Flow[] => [{ t: t1, amount: V * w * Math.pow(1 + i, t1) }, ...bond.map((f) => ({ t: f.t, amount: (f.amount * V * (1 - w)) / P }))];
      const w = (D2 - n) / (D2 - t1);
      const cands = [
        { w: 1 - w, mis: "ALLOC_SWAPPED" as const, why: "The shares are swapped: the short asset must carry the larger weight the further the bond's duration lies beyond the liability." },
        { w: (D2 / (1 + i) - n) / (D2 / (1 + i) - t1), mis: "FORMULA_MODIFIED_FOR_MACAULAY" as const, why: "The bond's modified duration was mixed with Macaulay durations elsewhere." },
        { w: (D2u - n) / (D2u - t1), mis: "MODEL_UNDISCOUNTED_WEIGHTS" as const, why: "The bond's duration was computed from undiscounted payments." },
        { w: (m - n) / (m - t1), mis: "CONC_RELATED_TERM" as const, why: "The bond's maturity was used in place of its duration." },
        { w: 0.5, mis: "ALLOC_EVEN_SPLIT" as const, why: "An even split ignores the durations." },
      ].filter((c) => c.w > 0 && c.w < 1 && Math.abs(c.w - w) > 0.03);
      const used: number[] = [w];
      const ds = cands.filter((c) => (used.every((u) => Math.abs(u - c.w) > 0.01) ? (used.push(c.w), true) : false));
      const inZero = variant === 0;
      const show = (x: number) => (inZero ? x : 1 - x);
      const label = (x: number) => `${pct(show(x))} of the funds in the ${inZero ? `${t1}-year zero-coupon bond` : `${m}-year bond`}; the position is then Redington immunized.`;
      return conceptQuestion({
        stem: `An insurer must pay ${mamt(L)} at time ${n}. It will invest the present value of this payment, at the annual effective rate of ${pc(i)}, in a ${t1}-year zero-coupon bond and a ${m}-year bond with annual coupons at ${pc(r)}, so that the asset portfolio's Macaulay duration equals the liability's.\n\nWhich of the following is correct?`,
        correct: { content: label(w), why: `The bond's duration is ${mnum(D2, 4)}; a share $w$ in the zero satisfies $${t1}w + ${mnum(D2, 4)}(1-w) = ${n}$, so $w$ = ${pct(w)}. Spreading assets around time ${n} makes them more convex than the single liability.`, check: { expr: minSurplus(port(w), liab, i, d), op: ">", than: 0 } },
        distractors: ds.map((c) => ({ content: label(c.w), misconception: c.mis, why: c.why, check: { expr: minSurplus(port(c.w), liab, i, d), op: ">" as const, than: 0 }, stage: c.mis === "ALLOC_SWAPPED" || c.mis === "ALLOC_EVEN_SPLIT" ? 2 : 1, failure: (c.mis === "ALLOC_SWAPPED" ? "application" : c.mis === "ALLOC_EVEN_SPLIT" ? "connection" : "selection") as "application" | "connection" | "selection" })),
        reference: { description: "Each allocation is tested by the surplus after parallel shifts of $\\pm 0.002$: only the duration-matching allocation keeps it positive on both sides." },
        steps: [
          { concept: "bond.price-yield", reasoning: `Find the coupon bond's Macaulay duration from its payments: ${mnum(D2, 4)}.` },
          { concept: "alm.portfolio-duration", reasoning: "The portfolio's duration is the PV-weighted average of the two assets' durations." },
          { concept: "alm.redington", reasoning: `Solve for the share that gives duration ${n}; with one asset before and the other's payments spread beyond, the assets are more convex than the liability.` },
        ],
        concepts: ["bond.price-yield", "alm.portfolio-duration", "alm.redington"],
        conditions: ["Flat yield curve; small parallel shifts.", "All assets valued at the same annual effective rate."],
        relationship: "$w D_1 + (1-w) D_2 = D_L$",
        transfer: { principle: "Duration matching is a weighted-average problem with present-value weights; convexity then decides immunization.", unusual: "One asset is a coupon bond whose duration must be found.", misread: "Maturity is not duration." },
        itemFormat: "portfolio-allocation",
        presentation: ["combined-topics"],
        features: { multiConcept: true },
        params: { i, n, t1, m, r, variant },
      });
    }
    // Level 3: two liabilities, two zero-coupon assets; decide whether Redington holds.
    const n1 = rng.int(3, 6);
    const n2 = n1 + rng.int(5, 9);
    const L1 = gridAmount(rng, 50000, 300000, 10000);
    const L2 = gridAmount(rng, 50000, 300000, 10000);
    const liabs: Flow[] = [{ t: n1, amount: L1 }, { t: n2, amount: L2 }];
    const V = pvFlows(liabs, i);
    const DL = macaulayDuration(liabs, i);
    const outside = variant === 0;
    const t1 = outside ? n1 - rng.int(1, 2) : n1 + 1;
    const t2 = outside ? n2 + rng.int(1, 3) : n2 - 1;
    if (!(DL > t1 + 0.3 && DL < t2 - 0.3)) throw new Error("Liability duration outside the asset range.");
    const portE = (w: number): Flow[] => [{ t: t1, amount: V * w * Math.pow(1 + i, t1) }, { t: t2, amount: V * (1 - w) * Math.pow(1 + i, t2) }];
    const w = (t2 - DL) / (t2 - t1);
    const DLu = (n1 * L1 + n2 * L2) / (L1 + L2);
    const immunized = convexity(portE(w), i) > convexity(liabs, i);
    const S = (x: number, r: number) => surplusE(portE(x), liabs, r);
    const yes = (x: number) => ({ expr: minE(S(x, i + d), S(x, i - d)), op: ">" as const, than: 0 });
    const no = (x: number) => ({ expr: minE(`-(${S(x, i + d)})`, `-(${S(x, i - d)})`), op: ">" as const, than: 0 });
    const imm = (x: number) => `${pct(x)} in the ${t1}-year bond; the Redington conditions then hold.`;
    const notImm = (x: number) => `${pct(x)} in the ${t1}-year bond; durations then match, but the position is not immunized.`;
    const wU = (t2 - DLu) / (t2 - t1);
    const alt = [
      { w: 1 - w, mis: "ALLOC_SWAPPED" as const, why: "The shares are swapped between the two bonds." },
      { w: wU, mis: "MODEL_UNDISCOUNTED_WEIGHTS" as const, why: "The liabilities' duration was taken from undiscounted amounts." },
      { w: 0.5, mis: "ALLOC_EVEN_SPLIT" as const, why: "An even split ignores the durations." },
    ].filter((c) => c.w > 0 && c.w < 1 && Math.abs(c.w - w) > 0.03);
    return conceptQuestion({
      stem: `A fund must pay ${flowText(liabs)}. It will invest the present value of these payments, at the annual effective rate of ${pc(i)}, in zero-coupon bonds maturing at times ${t1} and ${t2}, choosing the split so that the assets' Macaulay duration equals the liabilities'.\n\nWhich of the following is correct?`,
      correct: { content: immunized ? imm(w) : notImm(w), why: `The liabilities' duration is ${mnum(DL, 4)}, so the share in the ${t1}-year bond is $(${t2} - ${mnum(DL, 4)})/(${t2} - ${t1})$ = ${pct(w)}. The assets are ${immunized ? "more" : "less"} dispersed than the liabilities, so asset convexity is ${immunized ? "greater" : "smaller"}${immunized ? ": all three conditions hold." : ": the surplus falls after any small shift."}`, check: immunized ? yes(w) : no(w) },
      distractors: [
        { content: immunized ? notImm(w) : imm(w), misconception: immunized ? "CONC_ALM_BULLET_MORE_CONVEX" : "CONC_ALM_LIABILITY_CONVEXITY", why: immunized ? "The assets surround both liabilities, so they are the more dispersed, more convex side." : "The assets lie between the liabilities, so they are the less convex side.", check: immunized ? no(w) : yes(w), stage: 3, failure: "conclusion" as const },
        ...alt.map((c) => ({ content: immunized ? imm(c.w) : notImm(c.w), misconception: c.mis, why: c.why, check: immunized ? yes(c.w) : no(c.w), stage: c.mis === "MODEL_UNDISCOUNTED_WEIGHTS" ? 0 : 2, failure: (c.mis === "MODEL_UNDISCOUNTED_WEIGHTS" ? "interpretation" : "application") as "interpretation" | "application" })),
        { content: immunized ? imm(Math.min(0.95, Math.max(0.05, 1 - wU))) : notImm(Math.min(0.95, Math.max(0.05, 1 - wU))), misconception: "CONC_PV_MATCH_IMMUNIZES", why: "Any split that matches present value was accepted, without checking the duration.", check: immunized ? yes(Math.min(0.95, Math.max(0.05, 1 - wU))) : no(Math.min(0.95, Math.max(0.05, 1 - wU))), stage: 1, failure: "recognition" as const },
      ],
      reference: { description: "Each claim is tested by the surplus after parallel shifts of $\\pm 0.002$." },
      steps: [
        { concept: "alm.portfolio-duration", reasoning: `The liabilities' Macaulay duration is the PV-weighted mean of ${n1} and ${n2}: ${mnum(DL, 4)}.` },
        { concept: "alm.portfolio-duration", reasoning: `Solve $${t1}w + ${t2}(1-w) = ${mnum(DL, 4)}$ for the share $w$.` },
        { concept: "alm.convexity", reasoning: `Compare dispersion: assets at ${t1} and ${t2} versus liabilities at ${n1} and ${n2}.` },
        { concept: "alm.redington", reasoning: immunized ? "Asset convexity exceeds the liabilities': Redington immunized." : "Asset convexity is below the liabilities': not immunized." },
      ],
      concepts: ["alm.portfolio-duration", "alm.convexity", "alm.redington"],
      conditions: ["Flat yield curve; small parallel shifts.", "Zero-coupon, default-free assets."],
      relationship: "$w t_1 + (1-w) t_2 = D_L, \\qquad C_A > C_L \\iff$ assets more dispersed about $D_L$",
      counterexample: "If the assets lay outside both liability dates, the same duration match would immunize.",
      transfer: { principle: "Match the duration first; then let dispersion decide whether the match immunizes.", unusual: "The final judgement can be negative even when the arithmetic is right.", misread: "A duration match is necessary, not sufficient." },
      itemFormat: "portfolio-allocation",
      presentation: ["hidden-structure", "combined-topics"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i, n1, n2, L1, L2, t1, t2, variant },
    });
  },
});

// ================================================================ portfolio construction

const portfolioMeaning: ChoiceTemplate = conceptTemplate({
  id: "con-alm-portfolio-duration-meaning",
  family: "con-alm-portfolio",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.portfolio",
  secondary: ["ALM.duration"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "relationships"],
  soaConcept: "The duration of a portfolio as a present-value-weighted average of its components' durations.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "alm.portfolio-duration", reasoning: "A portfolio's present value is the sum of its components', and so is its derivative." },
      { concept: "alm.macaulay-vs-modified", reasoning: "Dividing by the total value makes the portfolio's duration a PV-weighted average of the components' durations (Macaulay or modified alike, at a common rate)." },
    ];
    const conditions = ["All components valued at the same annual effective rate.", "Durations measured at that rate."];
    const relationship = "$D_P = \\dfrac{P_A D_A + P_B D_B}{P_A + P_B}$";
    const transfer = { principle: "Portfolio duration is a value-weighted average; it lies between the components' durations.", unusual: "Weights, not formulas, are tested.", misread: "Face amounts and numbers of bonds are not values." };
    if (level === 1) {
      const mac = variant === 0;
      return conceptQuestion({
        stem: mac
          ? "A portfolio consists of bonds A and B with present values $P_A$ and $P_B$ and Macaulay durations $D_A$ and $D_B$, all at the same annual effective rate. Which of the following describes the portfolio's Macaulay duration?"
          : "A portfolio consists of several bonds, all valued at the same annual effective rate. Which of the following is true of the portfolio's modified duration?",
        correct: mac
          ? { content: "The average of $D_A$ and $D_B$, weighted by $P_A$ and $P_B$.", why: "$\\sum t\\,CF_t v^t$ and $\\sum CF_t v^t$ both add across bonds." }
          : { content: "It is the average of the bonds' modified durations, weighted by their present values.", why: "$-P'/P$ for the sum is the PV-weighted average of each $-P_k'/P_k$." },
        distractors: mac
          ? [
              { content: "The simple average of $D_A$ and $D_B$.", misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore the bonds' values.", stage: 1, failure: "application" },
              { content: "The average of $D_A$ and $D_B$, weighted by their face amounts.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Face amounts are not present values.", stage: 1, failure: "selection" },
              { content: "The sum $D_A + D_B$.", misconception: "CONC_ALM_DURATIONS_ADDED", why: "A portfolio's duration lies between its components'.", stage: 1, failure: "application" },
              { content: "The larger of $D_A$ and $D_B$.", misconception: "CONC_RELATED_TERM", why: "The longest component does not set the portfolio's duration.", stage: 0, failure: "interpretation" },
              { content: "The average of $D_A$ and $D_B$, weighted by $P_B$ and $P_A$.", misconception: "ALLOC_SWAPPED", why: "Each duration is weighted by its own bond's value.", stage: 1, failure: "application" },
            ]
          : [
              { content: "It is the average of the bonds' Macaulay durations, weighted by their present values.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "That average is the portfolio's Macaulay duration.", stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
              { content: "It is the sum of the bonds' modified durations.", misconception: "CONC_ALM_DURATIONS_ADDED", why: "Durations are averaged, not added.", stage: 1, failure: "application" },
              { content: "It is the simple average of the bonds' modified durations.", misconception: "ALLOC_EVEN_SPLIT", why: "The weights must be present values.", stage: 1, failure: "application" },
              { content: "It is the average of the bonds' modified durations, weighted by their face amounts.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Face amounts are not present values.", stage: 1, failure: "selection" },
              { content: "It cannot be found from the bonds' durations; the combined cash flows are needed.", misconception: "CONC_OUTSIDE_ASSUMPTIONS", why: "At a common rate the weighted average is exact.", stage: 0, failure: "recognition" },
            ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "definition",
        presentation: ["direct"],
        params: { variant },
      });
    }
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const [PA, PB, DA, DB, FA, FB] = drawUntil(
      () => [gridAmount(rng, 5000, 40000, 500), gridAmount(rng, 5000, 40000, 500), rng.int(10, 50) / 10, rng.int(60, 150) / 10, gridAmount(rng, 5000, 40000, 1000), gridAmount(rng, 5000, 40000, 1000)],
      ([pa, pb, da, db, fa, fb]) => {
        const vals = [(pa * da + pb * db) / (pa + pb), (fa * da + fb * db) / (fa + fb), (da + db) / 2, (pb * da + pa * db) / (pa + pb), (pa * da + pb * db) / (pa + pb) / (1 + i)];
        return distinctBy(vals, 0.05);
      }
    );
    const V = PA + PB;
    const DP = (PA * DA + PB * DB) / V;
    if (variant === 0) {
      const truth = `((${lit(PA)}*${lit(DA)}+${lit(PB)}*${lit(DB)})/${lit(V)})`;
      const opt = (x: number) => `${mnum(x, 2)} years`;
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i)}, a portfolio holds bond A (face ${mamt(FA)}, market value ${mamt(PA)}, Macaulay duration ${mnum(DA, 1)}) and bond B (face ${mamt(FB)}, market value ${mamt(PB)}, Macaulay duration ${mnum(DB, 1)}).\n\nWhich of the following is the portfolio's Macaulay duration?`,
        correct: { content: opt(DP), why: `Weights are market values: $(${mamt(PA)}\\cdot ${mnum(DA, 1)} + ${mamt(PB)}\\cdot ${mnum(DB, 1)})/${mamt(V)}$.`, check: { expr: truth, op: "=", than: truth } },
        distractors: [
          { content: opt((FA * DA + FB * DB) / (FA + FB)), misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Face amounts are not values.", check: { expr: `((${lit(FA)}*${lit(DA)}+${lit(FB)}*${lit(DB)})/${lit(FA + FB)})`, op: "=", than: truth }, stage: 1, failure: "selection" },
          { content: opt((DA + DB) / 2), misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore the bonds' values.", check: { expr: `((${lit(DA)}+${lit(DB)})/2)`, op: "=", than: truth }, stage: 1, failure: "application" },
          { content: opt((PB * DA + PA * DB) / V), misconception: "ALLOC_SWAPPED", why: "Each duration goes with its own bond's value.", check: { expr: `((${lit(PB)}*${lit(DA)}+${lit(PA)}*${lit(DB)})/${lit(V)})`, op: "=", than: truth }, stage: 1, failure: "application" },
          { content: opt(DP / (1 + i)), misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "Dividing by $1 + i$ gives the modified duration.", check: { expr: `(${truth}/(1+${lit(i)}))`, op: "=", than: truth }, stage: 1, failure: "selection" },
          { content: opt(DA + DB), misconception: "CONC_ALM_DURATIONS_ADDED", why: "Durations are averaged, not added.", check: { expr: `(${lit(DA)}+${lit(DB)})`, op: "=", than: truth }, stage: 1, failure: "application" },
        ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "interpretation",
        presentation: ["irrelevant-info"],
        features: { unfamiliar: true, multiConcept: true },
        params: { i, PA, PB, DA, DB, variant },
      });
    }
    const Dt = drawUntil(() => rng.int(Math.ceil(DA * 10) + 5, Math.floor(DB * 10) - 5) / 10, () => true);
    const w = (DB - Dt) / (DB - DA);
    const truth = `((${lit(DB)}-${lit(Dt)})/(${lit(DB)}-${lit(DA)}))`;
    const cands = [
      { x: 1 - w, e: `((${lit(Dt)}-${lit(DA)})/(${lit(DB)}-${lit(DA)}))`, mis: "ALLOC_SWAPPED" as const, why: "That is the share in bond B." },
      { x: 0.5, e: "0.5", mis: "ALLOC_EVEN_SPLIT" as const, why: "An even split gives the simple average of the durations." },
      { x: Dt / (DA + DB), e: `(${lit(Dt)}/(${lit(DA)}+${lit(DB)}))`, mis: "CONC_ALM_DURATIONS_ADDED" as const, why: "Durations are averaged, not added." },
      { x: (DB - Dt / (1 + i)) / (DB - DA), e: `((${lit(DB)}-${lit(Dt)}/(1+${lit(i)}))/(${lit(DB)}-${lit(DA)}))`, mis: "FORMULA_MODIFIED_FOR_MACAULAY" as const, why: "The target is a Macaulay duration and must not be converted." },
    ].filter((c) => c.x > 0 && c.x < 1.5 && Math.abs(c.x - w) > 0.01);
    const opt = (x: number) => `${mnum(x * 100, 2)}% of the funds in bond A`;
    return conceptQuestion({
      stem: `At an annual effective rate of ${pc(i)}, bond A has Macaulay duration ${mnum(DA, 1)} and bond B has Macaulay duration ${mnum(DB, 1)}. An investor wants a portfolio of the two bonds with Macaulay duration ${mnum(Dt, 1)}.\n\nWhich of the following allocations, by market value, achieves this?`,
      correct: { content: opt(w), why: `Solve $${mnum(DA, 1)}w + ${mnum(DB, 1)}(1-w) = ${mnum(Dt, 1)}$: $w = ${mnum(w * 100, 2)}\\%$.`, check: { expr: truth, op: "=", than: truth } },
      distractors: cands.map((c) => ({ content: opt(c.x), misconception: c.mis, why: c.why, check: { expr: c.e, op: "=" as const, than: truth }, stage: 1, failure: "application" as const })),
      steps: [...steps, { concept: "alm.portfolio-duration", reasoning: "Invert the weighted average to find the share in bond A." }],
      conditions,
      relationship,
      transfer,
      itemFormat: "portfolio-allocation",
      presentation: ["inverse"],
      features: { multiConcept: true },
      params: { i, DA, DB, Dt, variant },
    });
  },
});

const portfolioExpression: ChoiceTemplate = conceptTemplate({
  id: "con-alm-portfolio-duration-expression",
  family: "con-alm-portfolio",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.portfolio",
  secondary: ["ALM.duration"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "relationships"],
  reasoning: ["formula_selection", "translation", "algebra"],
  soaConcept: "Equivalent symbolic expressions for a portfolio's duration, and the equation for a target-duration allocation.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const n = rng.int(2, 6);
    const m = n + rng.int(3, 10);
    const X = gridAmount(rng, 1000, 10000, 500);
    const Y = drawUntil(() => gridAmount(rng, 1000, 10000, 500), (y) => y !== X);
    const g = lit(1 + i);
    const vn = `(1+${lit(i)})**(-${n})`;
    const vm = `(1+${lit(i)})**(-${m})`;
    const Xs = mamt(X);
    const Ys = mamt(Y);
    const flows: Flow[] = [{ t: n, amount: X }, { t: m, amount: Y }];
    const steps = [
      { concept: "alm.portfolio-duration", reasoning: "Add the two bonds' time-weighted present values and their present values separately." },
      { concept: "alm.macaulay-vs-modified", reasoning: "Their ratio is the Macaulay duration; one more factor $v$ gives modified duration." },
      { concept: "alm.portfolio-duration", reasoning: "Rewriting the weighted average as $n + (m - n)\\times$ (share of value at $m$) is an equivalent form." },
    ];
    const common = {
      conditions: ["Zero-coupon bonds valued at one annual effective rate.", "$v = 1/(1+i)$."],
      relationship: "$D = \\dfrac{nXv^n + mYv^m}{Xv^n + Yv^m} = n + (m-n)\\dfrac{Yv^m}{Xv^n + Yv^m}$",
      transfer: { principle: "Duration = Σ t·PV / Σ PV; any rearrangement that keeps PV weights is equivalent.", unusual: "Several correct-looking forms differ in one weight.", misread: "Face amounts need discounting before they can weight anything." },
    };
    const stemBase = `A portfolio consists of a zero-coupon bond paying ${Xs} at time ${n} and a zero-coupon bond paying ${Ys} at time ${m}. The annual effective rate is ${pc(i)} and $v = 1/${g}$.`;
    if (level === 1 || (level === 2 && variant === 0)) {
      const modified = level === 2;
      const equivalent = level === 1 && variant === 1;
      const ref = modified ? `(${durE(flows, i)}/${g})` : durE(flows, i);
      const corr = equivalent
        ? { latex: `${n} + ${m - n}\\cdot\\dfrac{${Ys}v^{${m}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `(${n}+${m - n}*${Y}*${vm}/(${X}*${vn}+${Y}*${vm}))` }
        : { latex: `\\dfrac{${n}(${Xs})v^{${n + (modified ? 1 : 0)}} + ${m}(${Ys})v^{${m + (modified ? 1 : 0)}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `((${n}*${X}*${vn}+${m}*${Y}*${vm})/(${X}*${vn}+${Y}*${vm})${modified ? `/${g}` : ""})` };
      const opts: MathOpt[] = equivalent
        ? [
            { latex: `${n} + ${m - n}\\cdot\\dfrac{${Ys}}{${Xs} + ${Ys}}`, probe: `(${n}+${m - n}*${Y}/(${X + Y}))`, misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "The share must be a share of present value, not of face.", stage: 2, failure: "application" },
            { latex: `${n} + ${m - n}\\cdot\\dfrac{${Xs}v^{${n}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `(${n}+${m - n}*${X}*${vn}/(${X}*${vn}+${Y}*${vm}))`, misconception: "ALLOC_SWAPPED", why: "The step from $n$ to $m$ is weighted by the share of value paid at $m$.", stage: 2, failure: "application" },
            { latex: `${m} - ${m - n}\\cdot\\dfrac{${Ys}v^{${m}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `(${m}-${m - n}*${Y}*${vm}/(${X}*${vn}+${Y}*${vm}))`, misconception: "ALG_SIGN_ERROR", why: "Starting from $m$, the step back is weighted by the share at $n$.", stage: 2, failure: "application" },
            { latex: `${m - n}\\cdot\\dfrac{${Ys}v^{${m}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `(${m - n}*${Y}*${vm}/(${X}*${vn}+${Y}*${vm}))`, misconception: "TRANS_IGNORED_CONDITION", why: "The base time $n$ is missing.", stage: 2, failure: "application" },
            { latex: `\\dfrac{${n} + ${m}}{2}`, probe: `${(n + m) / 2}`, misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore the bonds' values.", stage: 0, failure: "application" },
          ]
        : [
            { latex: `\\dfrac{${n}(${Xs}) + ${m}(${Ys})}{${Xs} + ${Ys}}${modified ? "\\,v" : ""}`, probe: `((${n}*${X}+${m}*${Y})/${X + Y}${modified ? `/${g}` : ""})`, misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Face amounts must be discounted before they weight the times.", stage: 0, failure: "interpretation" },
            modified
              ? { latex: `\\dfrac{${n}(${Xs})v^{${n}} + ${m}(${Ys})v^{${m}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `((${n}*${X}*${vn}+${m}*${Y}*${vm})/(${X}*${vn}+${Y}*${vm}))`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "That is the Macaulay duration.", stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" }
              : { latex: `\\dfrac{${n}(${Xs})v^{${n + 1}} + ${m}(${Ys})v^{${m + 1}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `((${n}*${X}*${vn}+${m}*${Y}*${vm})/(${X}*${vn}+${Y}*${vm})/${g})`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The extra factor $v$ gives the modified duration.", stage: 1, failure: "selection", confusedWith: "alm.macaulay-vs-modified" },
            { latex: `${n}(${Xs})v^{${n}} + ${m}(${Ys})v^{${m}}`, probe: `(${n}*${X}*${vn}+${m}*${Y}*${vm})`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "The time-weighted value must be divided by the total value.", stage: 1, failure: "application" },
            { latex: `\\dfrac{${n}(${Ys})v^{${m}} + ${m}(${Xs})v^{${n}}}{${Xs}v^{${n}} + ${Ys}v^{${m}}}`, probe: `((${n}*${Y}*${vm}+${m}*${X}*${vn})/(${X}*${vn}+${Y}*${vm}))`, misconception: "ALLOC_SWAPPED", why: "Each time is weighted by the value paid at that time.", stage: 0, failure: "application" },
            { latex: `\\dfrac{${n} + ${m}}{2}`, probe: `${(n + m) / 2}`, misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore the bonds' values.", stage: 0, failure: "application" },
          ];
      return conceptQuestion({
        stem: `${stemBase}\n\nWhich of the following expressions equals the portfolio's ${modified ? "modified" : "Macaulay"} duration?`,
        correct: { content: math(corr.latex), why: equivalent ? "Write the PV-weighted mean as $n$ plus $(m - n)$ times the share of value paid at $m$." : `Time-weighted value over value${modified ? ", times one more $v$" : ""}.`, probe: corr.probe },
        distractors: mathOpts(opts),
        reference: { values: [{ label: "D", expr: ref }], description: "The duration computed from the two cash flows; each expression is evaluated and compared with it." },
        steps,
        ...common,
        itemFormat: "expression-selection",
        presentation: equivalent ? ["indirect-wording"] : level === 2 ? ["indirect-wording"] : ["direct"],
        features: { unfamiliar: equivalent || level === 2, multiConcept: true },
        params: { i, n, m, X, Y, variant },
      });
    }
    if (level === 2) {
      // Holdings of two coupon bonds: units, prices and durations.
      const kA = rng.int(5, 40);
      const kB = drawUntil(() => rng.int(5, 40), (k) => k !== kA);
      const PA = rng.int(800, 1200) + rng.int(0, 99) / 100;
      const PB = rng.int(800, 1200) + rng.int(0, 99) / 100;
      const DA = rng.int(20, 60) / 10;
      const DB = rng.int(70, 140) / 10;
      const ref = `((${kA}*${lit(PA)}*${lit(DA)}+${kB}*${lit(PB)}*${lit(DB)})/(${kA}*${lit(PA)}+${kB}*${lit(PB)}))`;
      const pa = mnum(PA, 2);
      const pb = mnum(PB, 2);
      const opts: MathOpt[] = [
        { latex: `\\dfrac{${kB}(${pb})(${mnum(DA, 1)}) + ${kA}(${pa})(${mnum(DB, 1)})}{${kA}(${pa}) + ${kB}(${pb})}`, probe: `((${kB}*${lit(PB)}*${lit(DA)}+${kA}*${lit(PA)}*${lit(DB)})/(${kA}*${lit(PA)}+${kB}*${lit(PB)}))`, misconception: "ALLOC_SWAPPED", why: "Each duration goes with its own holding's value.", stage: 0, failure: "application" },
        { latex: `\\dfrac{${kA}(${pa})(${mnum(DA, 1)}) + ${kB}(${pb})(${mnum(DB, 1)})}{${pa} + ${pb}}`, probe: `((${kA}*${lit(PA)}*${lit(DA)}+${kB}*${lit(PB)}*${lit(DB)})/(${lit(PA)}+${lit(PB)}))`, misconception: "ALG_DIVIDE_ERROR", why: "The denominator must be the portfolio's total value, including the numbers of units.", stage: 1, failure: "application" },
        { latex: `\\dfrac{${kA}(${mnum(DA, 1)}) + ${kB}(${mnum(DB, 1)})}{${kA} + ${kB}}`, probe: `((${kA}*${lit(DA)}+${kB}*${lit(DB)})/${kA + kB})`, misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Numbers of bonds are not values; each holding's value is units × price.", stage: 0, failure: "interpretation" },
        { latex: `\\dfrac{${pa}(${mnum(DA, 1)}) + ${pb}(${mnum(DB, 1)})}{${pa} + ${pb}}`, probe: `((${lit(PA)}*${lit(DA)}+${lit(PB)}*${lit(DB)})/(${lit(PA)}+${lit(PB)}))`, misconception: "TRANS_IGNORED_CONDITION", why: "The weights must include the number of bonds held.", stage: 0, failure: "application" },
        { latex: `${kA}(${pa})(${mnum(DA, 1)}) + ${kB}(${pb})(${mnum(DB, 1)})`, probe: `(${kA}*${lit(PA)}*${lit(DA)}+${kB}*${lit(PB)}*${lit(DB)})`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "The weighted sum must be divided by the portfolio's value.", stage: 1, failure: "application" },
      ];
      return conceptQuestion({
        stem: `At one annual effective rate, bond A has price ${pa} and Macaulay duration ${mnum(DA, 1)}, and bond B has price ${pb} and Macaulay duration ${mnum(DB, 1)}. A portfolio holds ${kA} units of bond A and ${kB} units of bond B.\n\nWhich of the following expressions equals the portfolio's Macaulay duration?`,
        correct: { content: math(`\\dfrac{${kA}(${pa})(${mnum(DA, 1)}) + ${kB}(${pb})(${mnum(DB, 1)})}{${kA}(${pa}) + ${kB}(${pb})}`), why: "Each holding's value is units × price; durations are averaged with those weights.", probe: ref },
        distractors: mathOpts(opts),
        reference: { values: [{ label: "D", expr: ref }], description: "The value-weighted average of the bonds' durations; each expression is evaluated and compared with it." },
        steps: [
          { concept: "alm.portfolio-duration", reasoning: "Each holding's value is the number of units times the price." },
          { concept: "alm.portfolio-duration", reasoning: "Weight each bond's duration by its holding's value and divide by the total." },
          { concept: "alm.macaulay-vs-modified", reasoning: "All durations are Macaulay durations at one rate, so no conversion is needed." },
        ],
        ...common,
        itemFormat: "expression-selection",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true, multiConcept: true },
        params: { kA, kB, PA, PB, DA, DB, variant },
      });
    }
    // Level 3: equation for a target-duration allocation.
    const W = gridAmount(rng, 10000, 100000, 1000);
    const Dt = rng.int(n * 10 + 5, m * 10 - 5) / 10;
    const faceUnknown = variant === 1;
    const Ws = mamt(W);
    const Dts = mnum(Dt, 1);
    const ref = faceUnknown ? `((${m}-${lit(Dt)})*${W}/((${m}-${n})*${vn}))` : `((${m}-${lit(Dt)})*${W}/(${m}-${n}))`;
    const vN = `v^{${n}}`;
    const corr = faceUnknown
      ? { latex: `${n}x${vN} + ${m}(${Ws} - x${vN}) = ${Ws}(${Dts})`, probe: `(${n}*x*${vn}+${m}*(${W}-x*${vn})-${W}*${lit(Dt)})` }
      : { latex: `${n}x + ${m}(${Ws} - x) = ${Ws}(${Dts})`, probe: `(${n}*x+${m}*(${W}-x)-${W}*${lit(Dt)})` };
    const opts: MathOpt[] = faceUnknown
      ? [
          { latex: `${n}x + ${m}(${Ws} - x) = ${Ws}(${Dts})`, probe: `(${n}*x+${m}*(${W}-x)-${W}*${lit(Dt)})`, misconception: "VAR_FACE_FOR_PRICE", why: "$x$ is a face amount; its cost is $xv^n$.", stage: 1, failure: "interpretation" },
          { latex: `${m}x${vN} + ${n}(${Ws} - x${vN}) = ${Ws}(${Dts})`, probe: `(${m}*x*${vn}+${n}*(${W}-x*${vn})-${W}*${lit(Dt)})`, misconception: "ALLOC_SWAPPED", why: "Each value goes with its own bond's time.", stage: 2, failure: "application" },
          { latex: `${n}x${vN} + ${m}(${Ws} - x${vN})v^{${m}} = ${Ws}(${Dts})`, probe: `(${n}*x*${vn}+${m}*(${W}-x*${vn})*${vm}-${W}*${lit(Dt)})`, misconception: "TIMING_VALUATION_DATE", why: "The money in the longer bond is already a present value.", stage: 2, failure: "application" },
          { latex: `${n}x${vN} + ${m}(${Ws} - x${vN}) = ${Dts}`, probe: `(${n}*x*${vn}+${m}*(${W}-x*${vn})-${lit(Dt)})`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "The time-weighted value equals the target duration times the total value.", stage: 2, failure: "application" },
          { latex: `${n}x${vN} + ${m}(${Ws} - x${vN}) = ${Ws}(${Dts})v`, probe: `(${n}*x*${vn}+${m}*(${W}-x*${vn})-${W}*${lit(Dt)}/${g})`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The target is a Macaulay duration.", stage: 2, failure: "selection" },
        ]
      : [
          { latex: `${m}x + ${n}(${Ws} - x) = ${Ws}(${Dts})`, probe: `(${m}*x+${n}*(${W}-x)-${W}*${lit(Dt)})`, misconception: "ALLOC_SWAPPED", why: "The amount $x$ is in the bond maturing at time " + n + ".", stage: 2, failure: "application" },
          { latex: `${n}x${vN} + ${m}(${Ws} - x)v^{${m}} = ${Ws}(${Dts})`, probe: `(${n}*x*${vn}+${m}*(${W}-x)*${vm}-${W}*${lit(Dt)})`, misconception: "TIMING_VALUATION_DATE", why: "The amounts invested are already present values; discounting them again is wrong.", stage: 1, failure: "application" },
          { latex: `${n}x + ${m}(${Ws} - x) = ${Dts}`, probe: `(${n}*x+${m}*(${W}-x)-${lit(Dt)})`, misconception: "CONC_ALM_DURATION_NOT_NORMALIZED", why: "The time-weighted value equals the target times the total value.", stage: 2, failure: "application" },
          { latex: `${n}x + ${m}(${Ws} - x) = ${Ws}(${Dts})v`, probe: `(${n}*x+${m}*(${W}-x)-${W}*${lit(Dt)}/${g})`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "The target is a Macaulay duration.", stage: 2, failure: "selection" },
          { latex: `${n}x + ${m}x = ${Ws}(${Dts})`, probe: `(${n + m}*x-${W}*${lit(Dt)})`, misconception: "ALLOC_AGGREGATE_AS_EACH", why: "Only $" + Ws + " - x$ is invested in the longer bond.", stage: 1, failure: "application" },
        ];
    return conceptQuestion({
      stem: `An investor spends ${Ws} on zero-coupon bonds maturing at times ${n} and ${m}, at an annual effective rate of ${pc(i)}, so that the portfolio's Macaulay duration is ${Dts}. Let $x$ be the ${faceUnknown ? `face amount (maturity value) of the ${n}-year bond` : `amount spent on the ${n}-year bond`}, and $v = 1/${g}$.\n\nDetermine which of the following equations $x$ satisfies.`,
      correct: { content: math(corr.latex), why: faceUnknown ? `The ${n}-year bond costs $xv^{${n}}$; the rest of the ${Ws} buys the ${m}-year bond. PV-weighted times must average to ${Dts}.` : `Amounts spent are present values; the PV-weighted mean of ${n} and ${m} must be ${Dts}.`, probe: corr.probe },
      distractors: mathOpts(opts),
      reference: { values: [{ label: "x", expr: ref }], description: "Solving the duration condition directly gives $x$; each equation is solved and compared with it." },
      steps: [
        { concept: "alm.portfolio-duration", reasoning: "The portfolio's Macaulay duration is the value-weighted mean of the two maturities." },
        { concept: "alm.portfolio-duration", reasoning: faceUnknown ? `The value of the ${n}-year holding is $xv^{${n}}$, not $x$.` : "The amounts spent are already present values." },
        { concept: "alm.macaulay-vs-modified", reasoning: "The target is a Macaulay duration, so no factor $v$ enters the right side." },
        { concept: "alm.portfolio-duration", reasoning: `Multiply through by ${Ws}: time-weighted value = target × total value.` },
      ],
      concepts: ["alm.portfolio-duration", "alm.macaulay-vs-modified"],
      ...common,
      itemFormat: "equation-selection",
      presentation: faceUnknown ? ["hidden-structure", "inverse"] : ["inverse"],
      modelingDecisions: 1,
      features: { unfamiliar: true, multiConcept: true },
      params: { i, n, m, W, Dt, variant },
    });
  },
});

const portfolioDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-alm-portfolio-diagnosis",
  family: "con-alm-portfolio",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.portfolio",
  secondary: ["ALM.duration", "ALM.redington"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "relationships"],
  reasoning: ["validation", "formula_selection"],
  soaConcept: "Diagnosing an allocation meant to give a portfolio a target duration.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.03, 0.07, 0.005);
    const DA = rng.int(15, 50) / 10;
    const DB = rng.int(80, 150) / 10;
    const W = gridAmount(rng, 100000, 900000, 10000);
    const pct = (x: number) => `${mnum(x * 100, 2)}\\%`;
    const g = lit(1 + i);
    const ck = (truth: string) => (expr: string) => ({ expr, op: "=" as const, than: truth });
    if (level === 2) {
      const Dt = rng.int(Math.ceil(DA * 10) + 10, Math.floor(DB * 10) - 10) / 10;
      const truthE = `((${lit(DB)}-${lit(Dt)})/(${lit(DB)}-${lit(DA)}))`;
      const c = ck(truthE);
      const w = (DB - Dt) / (DB - DA);
      if (variant === 0) {
        const cand = (Dt - DA) / (DB - DA);
        return conceptQuestion({
          stem: `At an annual effective rate of ${pc(i)}, bond A has Macaulay duration ${mnum(DA, 1)} and bond B has Macaulay duration ${mnum(DB, 1)}. An investor wants a portfolio with Macaulay duration ${mnum(Dt, 1)}. A candidate computes $\\dfrac{${mnum(Dt, 1)} - ${mnum(DA, 1)}}{${mnum(DB, 1)} - ${mnum(DA, 1)}} = ${pct(cand)}$ and invests that share of the funds, by market value, in bond A.\n\nWhich of the following correctly describes the candidate's allocation?`,
          correct: { content: `The share computed belongs to bond B; bond A's share is $${pct(w)}$.`, why: `$${mnum(DA, 1)}w + ${mnum(DB, 1)}(1-w) = ${mnum(Dt, 1)}$ gives $w = (${mnum(DB, 1)} - ${mnum(Dt, 1)})/(${mnum(DB, 1)} - ${mnum(DA, 1)})$.`, check: c(`(1-(${lit(Dt)}-${lit(DA)})/(${lit(DB)}-${lit(DA)}))`) },
          distractors: [
            { content: "The allocation is correct.", misconception: "ALLOC_SWAPPED", why: `With that share in bond A the duration is ${mnum(cand * DA + (1 - cand) * DB, 2)}, not ${mnum(Dt, 1)}.`, check: c(`((${lit(Dt)}-${lit(DA)})/(${lit(DB)}-${lit(DA)}))`), stage: 1, failure: "application" },
            { content: "The funds should be split equally between the bonds.", misconception: "ALLOC_EVEN_SPLIT", why: "An even split gives the simple average of the durations.", check: c("0.5"), stage: 1, failure: "application" },
            { content: `The target must first be converted to modified duration, $${mnum(Dt, 1)}/${g}$.`, misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "Target and components are all Macaulay durations.", check: c(`((${lit(Dt)}/${g}-${lit(DA)})/(${lit(DB)}-${lit(DA)}))`), stage: 0, failure: "selection" },
            { content: `Bond A's share should be the target divided by the sum of the durations.`, misconception: "CONC_ALM_DURATIONS_ADDED", why: "Durations average; they do not add.", check: c(`(${lit(Dt)}/(${lit(DA)}+${lit(DB)}))`), stage: 1, failure: "application" },
          ],
          reference: { description: `The weighted-average equation gives bond A's share as ${mnum(w * 100, 2)}%; each proposed correction is compared with it.` },
          steps: [
            { concept: "alm.portfolio-duration", reasoning: "Write the portfolio duration as $wD_A + (1-w)D_B$." },
            { concept: "alm.portfolio-duration", reasoning: "Solve for $w$: the share in A is the distance from the target to $D_B$ over the spread." },
            { concept: "alm.macaulay-vs-modified", reasoning: "All durations are Macaulay at one rate: no conversion." },
          ],
          conditions: ["Both bonds valued at one annual effective rate.", "Shares by market value."],
          relationship: "$w = \\dfrac{D_B - D^*}{D_B - D_A}$",
          transfer: { principle: "The share in an asset is proportional to the distance from the target to the other asset's duration.", unusual: "The candidate's formula is right for the other bond.", misread: "Lever rule: the closer duration gets the larger share." },
          itemFormat: "error-diagnosis",
          presentation: ["inverse"],
          features: { multiConcept: true, unfamiliar: true },
          params: { i, DA, DB, Dt, variant },
        });
      }
      // Candidate uses numbers of bonds as weights.
      const PA = rng.int(800, 1200);
      const PB = drawUntil(() => rng.int(800, 1200), (p) => Math.abs(p - PA) > 100);
      const kA = Math.round((W * w) / PA);
      const kB = Math.round((W * (1 - w)) / PB);
      const durE2 = (wa: string, wb: string) => `((${wa}*${lit(DA)}+${wb}*${lit(DB)})/(${wa}+${wb}))`;
      const truth = durE2(`${kA}*${PA}`, `${kB}*${PB}`);
      const c2 = ck(truth);
      const candD = (kA * DA + kB * DB) / (kA + kB);
      return conceptQuestion({
        stem: `At an annual effective rate of ${pc(i)}, bond A has price ${PA} and Macaulay duration ${mnum(DA, 1)}, and bond B has price ${PB} and Macaulay duration ${mnum(DB, 1)}. A portfolio holds ${kA} units of A and ${kB} units of B. A candidate computes the portfolio's Macaulay duration as $\\dfrac{${kA}(${mnum(DA, 1)}) + ${kB}(${mnum(DB, 1)})}{${kA + kB}} = ${mnum(candD, 4)}$.\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: { content: "Each duration must be weighted by its holding's value, units times price.", why: `The holdings are worth ${kA * PA} and ${kB * PB}; the portfolio's duration is ${mnum((kA * PA * DA + kB * PB * DB) / (kA * PA + kB * PB), 4)}.`, check: c2(durE2(`${kA}*${PA}`, `${kB}*${PB}`)) },
        distractors: [
          { content: "The calculation is correct: each bond counts once per unit held.", misconception: "MODEL_UNDISCOUNTED_WEIGHTS", why: "Units of different bonds have different values.", check: c2(durE2(`${kA}`, `${kB}`)), stage: 0, failure: "interpretation" },
          { content: "Each duration must be weighted by its bond's price alone.", misconception: "TRANS_IGNORED_CONDITION", why: "The number of units held also sets the holding's value.", check: c2(durE2(`${PA}`, `${PB}`)), stage: 0, failure: "application" },
          { content: "The durations should simply be averaged.", misconception: "ALLOC_EVEN_SPLIT", why: "Equal weights ignore the holdings' values.", check: c2(`((${lit(DA)}+${lit(DB)})/2)`), stage: 0, failure: "application" },
          { content: "The result must be divided by $1 + i$ to give a Macaulay duration.", misconception: "FORMULA_MODIFIED_FOR_MACAULAY", why: "Dividing by $1 + i$ would give a modified duration; the weights are the problem.", check: c2(`(${durE2(`${kA}`, `${kB}`)}/${g})`), stage: 1, failure: "selection" },
        ],
        reference: { description: "The value-weighted portfolio duration; each proposed correction is compared with it." },
        steps: [
          { concept: "alm.portfolio-duration", reasoning: "Each holding's value is units × price." },
          { concept: "alm.portfolio-duration", reasoning: "Durations average with value weights." },
          { concept: "alm.macaulay-vs-modified", reasoning: "No conversion is needed: all durations are Macaulay." },
        ],
        conditions: ["Both bonds valued at one annual effective rate."],
        relationship: "$D_P = \\dfrac{k_A P_A D_A + k_B P_B D_B}{k_A P_A + k_B P_B}$",
        transfer: { principle: "Weights in a duration average are market values of holdings.", unusual: "Holdings are given in units.", misread: "A unit of one bond is not worth a unit of another." },
        itemFormat: "error-diagnosis",
        presentation: ["indirect-wording"],
        features: { multiConcept: true, unfamiliar: true },
        params: { i, DA, DB, PA, PB, kA, kB, variant },
      });
    }
    // Level 3: match a two-payment liability's duration.
    const n1 = Math.ceil(DA) + 1;
    const n2 = Math.floor(DB) - 1;
    const L1 = gridAmount(rng, 50000, 300000, 10000);
    const L2 = gridAmount(rng, 50000, 300000, 10000);
    const liabs: Flow[] = [{ t: n1, amount: L1 }, { t: n2, amount: L2 }];
    const DLE = durE(liabs, i);
    const DLv = macaulayDuration(liabs, i);
    const truthE = `((${lit(DB)}-${DLE})/(${lit(DB)}-${lit(DA)}))`;
    const c = ck(truthE);
    const w = (DB - DLv) / (DB - DA);
    const mixed = variant === 0;
    const DLu = (n1 * L1 + n2 * L2) / (L1 + L2);
    const candTarget = mixed ? DLv : DLu;
    const candW = mixed ? (DB / (1 + i) - candTarget) / (DB / (1 + i) - DA / (1 + i)) : (DB - DLu) / (DB - DA);
    if (!(candW > 0.02 && candW < 0.98 && Math.abs(candW - w) > 0.01)) throw new Error("Candidate share outside the usable range.");
    const candText = mixed
      ? `sets the bonds' modified durations, $${mnum(DA, 1)}/${g}$ and $${mnum(DB, 1)}/${g}$, against the liabilities' Macaulay duration ${mnum(DLv, 4)}`
      : `takes the liabilities' duration as $\\frac{${n1}(${mamt(L1)}) + ${n2}(${mamt(L2)})}{${mamt(L1 + L2)}} = ${mnum(DLu, 4)}$`;
    return conceptQuestion({
      stem: `A fund must pay ${flowText(liabs)}. At an annual effective rate of ${pc(i)}, bond A has Macaulay duration ${mnum(DA, 1)} and bond B has Macaulay duration ${mnum(DB, 1)}. To match the liabilities' duration, a candidate ${candText}, and invests ${pct(candW)} of the funds, by market value, in bond A.\n\nWhich of the following correctly describes the candidate's allocation?`,
      correct: mixed
        ? { content: "Durations must be compared like with like: Macaulay with Macaulay.", why: `With Macaulay durations throughout, bond A's share is ${mnum(w * 100, 2)}%.`, check: c(`((${lit(DB)}-${DLE})/(${lit(DB)}-${lit(DA)}))`) }
        : { content: "The liabilities' duration must weight their times by present values.", why: `The liabilities' Macaulay duration is ${mnum(DLv, 4)}, so bond A's share is ${mnum(w * 100, 2)}%.`, check: c(`((${lit(DB)}-${DLE})/(${lit(DB)}-${lit(DA)}))`) },
      distractors: [
        { content: "The allocation is correct.", misconception: mixed ? "FORMULA_MODIFIED_FOR_MACAULAY" : "MODEL_UNDISCOUNTED_WEIGHTS", why: "The assets' duration would not equal the liabilities'.", check: c(lit(candW)), stage: mixed ? 2 : 0, failure: mixed ? "selection" : "interpretation" },
        { content: "The funds should be split in proportion to the liability payments.", misconception: "ALLOC_AGGREGATE_AS_EACH", why: "Liability amounts do not set the asset shares; durations do.", check: c(`(${lit(L1)}/${lit(L1 + L2)})`), stage: 1, failure: "connection" },
        { content: "Bond A's share should be the liabilities' duration over the sum of the bonds' durations.", misconception: "CONC_ALM_DURATIONS_ADDED", why: "Durations average; they do not add.", check: c(`(${DLE}/(${lit(DA)}+${lit(DB)}))`), stage: 2, failure: "application" },
        { content: "The share computed belongs to bond B; bond A gets the rest.", misconception: "ALLOC_SWAPPED", why: "Swapping does not repair the target used.", check: c(`(1-${lit(candW)})`), stage: 2, failure: "application" },
      ],
      reference: { description: `With the liabilities' Macaulay duration ${mnum(DLv, 4)}, bond A's share is ${mnum(w * 100, 2)}%; each proposed correction is compared with it.` },
      steps: [
        { concept: "alm.portfolio-duration", reasoning: `The liabilities' Macaulay duration is the PV-weighted mean of ${n1} and ${n2}: ${mnum(DLv, 4)}.` },
        { concept: "alm.macaulay-vs-modified", reasoning: "Compare like with like: Macaulay durations on both sides (or modified on both)." },
        { concept: "alm.portfolio-duration", reasoning: "Solve $wD_A + (1-w)D_B = D_L$." },
        { concept: "alm.redington", reasoning: "This matches the first-order condition for immunization; convexity is a separate check." },
      ],
      concepts: ["alm.portfolio-duration", "alm.macaulay-vs-modified", "alm.redington"],
      conditions: ["Assets and liabilities valued at one annual effective rate.", "Shares by market value."],
      relationship: "$w D_A + (1-w)D_B = D_L = \\dfrac{\\sum t L_t v^t}{\\sum L_t v^t}$",
      transfer: { principle: "Build every duration in the same way — PV weights, same kind — before matching.", unusual: "The liability side is itself a portfolio.", misread: "Payment amounts are not present values." },
      itemFormat: "error-diagnosis",
      presentation: ["hidden-structure"],
      modelingDecisions: 1,
      features: { multiConcept: true, unfamiliar: true },
      params: { i, DA, DB, n1, n2, L1, L2, variant },
    });
  },
});

export const ALM_CONCEPT_TEMPLATES: ChoiceTemplate[] = [
  durationStatements,
  returnMeasureDefinition,
  returnTimingCompare,
  returnDiagnosis,
  forwardDefinition,
  forwardEquation,
  forwardDiagnosis,
  crossSpotBond,
  curveShape,
  couponEffect,
  curveStatements,
  durationMeaning,
  durationExpression,
  convexityMeaning,
  convexityBarbell,
  convexityStatements,
  approxMeaning,
  approxEquation,
  approxDiagnosis,
  matchingMeaning,
  matchingOrder,
  matchingStatements,
  fullConditions,
  fullDiagnosis,
  fullStatements,
  redingtonConditions,
  redingtonStatements,
  crossDurationImmunization,
  portfolioMeaning,
  portfolioExpression,
  portfolioDiagnosis,
];
