import { Da, Ia, acc, adue, an, geometricPV, sdue, sn, v } from "../finance";
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  PCT3,
  aExpr,
  aSym,
  adueExpr,
  adueSym,
  amt,
  dec,
  distractor,
  explanation,
  features,
  gridAmount,
  gridRate,
  level,
  lit,
  mamt,
  mnum,
  mpc,
  onePlus,
  ord,
  pc,
  pvTerms,
  range,
  sExpr,
  sSym,
  sdueExpr,
  sdueSym,
  shown,
  step,
  chain,
  sumOf,
  vPow,
  word,
} from "./kit";

const IaExpr = (n: number, i: number) => `((${adueExpr(n, i)} - ${n}*${vPow(i, n)})/${lit(i)})`;
const DaExpr = (n: number, i: number) => `((${n} - ${aExpr(n, i)})/${lit(i)})`;

// ===================================================================== level payment, deferred or due

const levelPayment: QuestionTemplate = {
  id: "ann-level-payment",
  family: "ann-level",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment", "ANNUITIES.streams"],
  reasoning: ["formula_selection", "valuation_dates", "cashflow_modelling", "financial_intuition"],
  soaConcept: "Level payment purchased by a single premium; deferred and annuity-due variants.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 20);
    const PV = gridAmount(rng, 20000, 150000, 5000);
    const fmt = MONEY2;
    const variant = lvl === 2 ? "lump" : rng.choice(["deferred", "due"] as const);

    if (variant === "deferred") {
      const k = rng.int(2, 8);
      const factor = v(i, k) * an(n, i);
      const X = PV / factor;
      return {
        stem: `A single payment of ${amt(PV)} buys an annuity of $X$ per year for ${n} years. The first payment is made ${word(k + 1)} years from today. The annual effective interest rate is ${pc(i)}.\n\nCalculate $X$.`,
        answer: {
          value: X,
          calc: `${lit(PV)}/(${vPow(i, k)}*${aExpr(n, i)})`,
          format: fmt,
          derivation: `$X = \\dfrac{${mamt(PV)}}{v^{${k}}${aSym(n)}} = ${shown(X, fmt)}$`,
        },
        model: {
          expr: `${lit(PV)} - ${pvTerms(level("x", range(k + 1, k + n)), i)}`,
          bracket: [0, PV],
          description: `The price equals the PV of ${n} payments at times ${k + 1}, ..., ${k + n}, each discounted individually.`,
        },
        distractors: [
          distractor("TIMING_DEFERRAL_OFF_BY_ONE", PV / (v(i, k + 1) * an(n, i)), `${lit(PV)}/(${vPow(i, k + 1)}*${aExpr(n, i)})`, {
            derivation: `$\\dfrac{${mamt(PV)}}{v^{${k + 1}}${aSym(n)}} = ${shown(PV / (v(i, k + 1) * an(n, i)), fmt)}$`,
            method: `Discounted by $v^{${k + 1}}$, the time of the first payment.`,
            feedback: `$${aSym(n)}$ already values the first payment one period before it is made — at time ${k}. Only ${k} more years of discounting are needed.`,
          }),
          distractor("TIMING_IGNORED_DEFERRAL", PV / an(n, i), `${lit(PV)}/${aExpr(n, i)}`, {
            derivation: `$\\dfrac{${mamt(PV)}}{${aSym(n)}} = ${shown(PV / an(n, i), fmt)}$`,
            method: "Ignored the deferral.",
            feedback: `The payments start in ${k + 1} years, not next year. The annuity's value at time ${k} must be discounted to today.`,
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", PV / (v(i, k) * adue(n, i)), `${lit(PV)}/(${vPow(i, k)}*${adueExpr(n, i)})`, {
            derivation: `$\\dfrac{${mamt(PV)}}{v^{${k}}${adueSym(n)}} = ${shown(PV / (v(i, k) * adue(n, i)), fmt)}$`,
            method: "Valued the payments as an annuity-due deferred k years.",
            feedback: `$v^{${k}}${adueSym(n)}$ would put the first payment at time ${k}. It is at time ${k + 1}.`,
          }),
          distractor("FORMULA_AV_FOR_PV", PV / (v(i, k) * sn(n, i)), `${lit(PV)}/(${vPow(i, k)}*${sExpr(n, i)})`, {
            derivation: `$\\dfrac{${mamt(PV)}}{v^{${k}}${sSym(n)}} = ${shown(PV / (v(i, k) * sn(n, i)), fmt)}$`,
            method: "Used the accumulated-value factor s in place of a.",
            feedback: "A price paid today is a present value; the annuity's value must be measured before its payments, using a.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", PV / n, `${lit(PV)}/${n}`, {
            derivation: `$${mamt(PV)} / ${n} = ${shown(PV / n, fmt)}$`,
            method: "Divided the price by the number of payments.",
            feedback: "The insurer earns interest on the price until each payment is made, so the payments total more than the price.",
          }),
        ],
        explanation: levelExplanation({ i, n, PV, X, fmt, kind: "deferred", k }),
        visuals: [
          {
            kind: "timeline",
            title: "Where each factor leaves its value",
            unit: "year",
            rate: i,
            flows: range(k + 1, k + n).map((t) => ({ t, amount: X, dir: "in" as const, label: "X" })),
            valuationTimes: [k, 0],
            caption: `a(${n}) lands at time ${k}; then v^${k} brings it to today.`,
          },
        ],
        markers: [v(i, k), an(n, i), v(i, k) * an(n, i)],
        presentation: ["deferred", "inverse"],
        features: features({ steps: 2, multipleValuationDates: true }),
        chain: chain(
          [
            step("B.annuity-immediate", "Value the payments where the factor lands: one period before the first payment.", ["a_n", an(n, i), "annuity factor at time k"], ["n", "i"], { valuationDate: "k" }),
            step("B.deferred", "Move that value back k years to today.", ["v^k a_n", factor, "value today of 1 per year"], ["a_n", "k"], { valuationDate: "0" }),
            step("A.equation-of-value", "Price = X × factor; solve for X.", ["X", X, "annual payment"], ["PV"], { rearranged: true }),
          ],
          {
            methods: ["valuation_dates", "rearrangement"],
            stages: {
              TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
              TIMING_IGNORED_DEFERRAL: [1, "connection"],
              TIMING_IMMEDIATE_AS_DUE: [0, "selection", "B.annuity-due"],
              FORMULA_AV_FOR_PV: [0, "selection", "B.annuity-immediate-av"],
              SEQ_UNDISCOUNTED_SUM: [2, "application"],
            },
            reasoning: "Write the price as the sum of each payment discounted from its own date: X(v^{k+1} + … + v^{k+n}) — a geometric series.",
          }
        ),
        params: { PV, i, n, k },
      };
    }

    if (variant === "due") {
      const X = PV / adue(n, i);
      return {
        stem: `A single payment of ${amt(PV)} buys an annuity of $X$ payable at the beginning of each year for ${n} years, the first payment being made immediately. The annual effective interest rate is ${pc(i)}.\n\nCalculate $X$.`,
        answer: {
          value: X,
          calc: `${lit(PV)}/${adueExpr(n, i)}`,
          format: fmt,
          derivation: `$X = \\dfrac{${mamt(PV)}}{${adueSym(n)}} = \\dfrac{${mamt(PV)}}{${dec(adue(n, i), 5)}} = ${shown(X, fmt)}$`,
        },
        model: {
          expr: `${lit(PV)} - ${pvTerms(level("x", range(0, n - 1)), i)}`,
          bracket: [0, PV],
          description: `The price equals the PV of ${n} payments at times 0, 1, ..., ${n - 1}.`,
        },
        distractors: [
          distractor("TIMING_DUE_AS_IMMEDIATE", PV / an(n, i), `${lit(PV)}/${aExpr(n, i)}`, {
            derivation: `$\\dfrac{${mamt(PV)}}{${aSym(n)}} = ${shown(PV / an(n, i), fmt)}$`,
            method: "Valued the payments as an annuity-immediate.",
            feedback: "The first payment is made immediately, so every payment is one year earlier than in an annuity-immediate and each is worth (1 + i) times as much.",
          }),
          distractor("FORMULA_AV_FOR_PV", PV / sdue(n, i), `${lit(PV)}/${sdueExpr(n, i)}`, {
            derivation: `$\\dfrac{${mamt(PV)}}{${sdueSym(n)}} = ${shown(PV / sdue(n, i), fmt)}$`,
            method: "Used the accumulated-value factor.",
            feedback: "The price is paid today, so it equals the PV of the payments.",
          }),
          distractor("TIMING_EXTRA_PERIOD", PV / (adue(n, i) * (1 + i)), `${lit(PV)}/(${adueExpr(n, i)}*${onePlus(i)})`, {
            derivation: `$\\dfrac{${mamt(PV)}}{${adueSym(n)}(1+i)} = ${shown(PV / (adue(n, i) * (1 + i)), fmt)}$`,
            method: "Applied the (1 + i) adjustment twice.",
            feedback: `$${adueSym(n)} = (1+i)${aSym(n)}$ already includes the one-period shift.`,
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", PV / n, `${lit(PV)}/${n}`, {
            derivation: `$${mamt(PV)}/${n} = ${shown(PV / n, fmt)}$`,
            method: "Divided the price by the number of payments.",
            feedback: "Unpaid amounts earn interest, so the payments can total more than the price.",
          }),
        ],
        explanation: levelExplanation({ i, n, PV, X, fmt, kind: "due" }),
        visuals: [
          {
            kind: "timeline",
            title: "Annuity-due: first payment today",
            unit: "year",
            rate: i,
            flows: range(0, n - 1).map((t) => ({ t, amount: X, dir: "in" as const, label: "X" })),
            valuationTimes: [0],
          },
        ],
        markers: [adue(n, i)],
        presentation: ["inverse"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("B.annuity-due", "Payments start immediately: annuity-due.", ["ä_n", adue(n, i), "annuity-due factor"], ["n", "i"]),
            step("A.equation-of-value", "Price = X × ä; solve for X.", ["X", X, "annual payment"], ["PV"], { rearranged: true }),
          ],
          {
            stages: {
              TIMING_DUE_AS_IMMEDIATE: [0, "selection", "B.annuity-immediate"],
              FORMULA_AV_FOR_PV: [0, "selection", "B.annuity-due-av"],
              TIMING_EXTRA_PERIOD: [0, "application"],
              SEQ_UNDISCOUNTED_SUM: [1, "application"],
            },
            reasoning: "The first payment needs no discounting; the rest are an annuity-immediate of n − 1 payments: ä = 1 + a_{n−1}.",
          }
        ),
        params: { PV, i, n },
      };
    }

    // Level 2: annuity plus a lump sum, both deferred.
    const k = rng.int(2, 6);
    const c = rng.choice([2, 3, 5]);
    const factor = v(i, k) * an(n, i) + c * v(i, k + n);
    const X = PV / factor;
    const lumpEarly = PV / (v(i, k) * an(n, i) + c * v(i, k + n - 1));
    const noLump = PV / (v(i, k) * an(n, i));
    const lumpUndisc = PV / (v(i, k) * an(n, i) + c);
    const offByOne = PV / (v(i, k + 1) * an(n, i) + c * v(i, k + n));
    return {
      stem: `A single payment of ${amt(PV)} buys the following benefits: payments of $X$ at the end of each year for ${n} years, the first payment being made at the end of year ${k + 1}, plus an additional lump sum of $${c}X$ paid together with the last annual payment. The annual effective interest rate is ${pc(i)}.\n\nCalculate $X$.`,
      answer: {
        value: X,
        calc: `${lit(PV)}/(${vPow(i, k)}*${aExpr(n, i)} + ${c}*${vPow(i, k + n)})`,
        format: fmt,
        derivation: `$X = \\dfrac{${mamt(PV)}}{v^{${k}}${aSym(n)} + ${c}v^{${k + n}}} = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `${lit(PV)} - ${pvTerms([...level("x", range(k + 1, k + n)), { t: k + n, amount: `${c}*x` }], i)}`,
        bracket: [0, PV],
        description: "Price equals the PV of every annual payment plus the PV of the lump sum at the date of the last payment.",
      },
      distractors: [
        distractor("TIMING_VALUATION_DATE", lumpEarly, `${lit(PV)}/(${vPow(i, k)}*${aExpr(n, i)} + ${c}*${vPow(i, k + n - 1)})`, {
          derivation: `$\\dfrac{${mamt(PV)}}{v^{${k}}${aSym(n)} + ${c}v^{${k + n - 1}}} = ${shown(lumpEarly, fmt)}$`,
          method: `Placed the lump sum at time ${k + n - 1}.`,
          feedback: `The last annual payment is at time ${k} + ${n} = ${k + n}, and the lump sum is paid with it.`,
        }),
        distractor("TRANS_IGNORED_CONDITION", noLump, `${lit(PV)}/(${vPow(i, k)}*${aExpr(n, i)})`, {
          derivation: `$\\dfrac{${mamt(PV)}}{v^{${k}}${aSym(n)}} = ${shown(noLump, fmt)}$`,
          method: "Left out the lump sum.",
          feedback: "The price buys both the annual payments and the lump sum, so both belong in the equation of value.",
        }),
        distractor("TIMING_MISSING_PERIOD", lumpUndisc, `${lit(PV)}/(${vPow(i, k)}*${aExpr(n, i)} + ${c})`, {
          derivation: `$\\dfrac{${mamt(PV)}}{v^{${k}}${aSym(n)} + ${c}} = ${shown(lumpUndisc, fmt)}$`,
          method: "Added the lump sum without discounting it.",
          feedback: `The lump sum is paid at time ${k + n}; at time 0 it is worth $${c}X v^{${k + n}}$.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, `${lit(PV)}/(${vPow(i, k + 1)}*${aExpr(n, i)} + ${c}*${vPow(i, k + n)})`, {
          derivation: `$\\dfrac{${mamt(PV)}}{v^{${k + 1}}${aSym(n)} + ${c}v^{${k + n}}} = ${shown(offByOne, fmt)}$`,
          method: `Discounted the annuity by $v^{${k + 1}}$.`,
          feedback: `The first payment is at ${k + 1}, so the annuity-immediate factor lands at time ${k}.`,
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", PV / (n + c), `${lit(PV)}/(${n}+${c})`, {
          derivation: `$${mamt(PV)}/(${n} + ${c}) = ${shown(PV / (n + c), fmt)}$`,
          method: "Divided the price by the total number of X's paid.",
          feedback: "Payments made in the future are worth less today; they must be discounted.",
        }),
      ],
      explanation: levelExplanation({ i, n, PV, X, fmt, kind: "lump", k, c }),
      visuals: [
        {
          kind: "timeline",
          title: "Deferred annuity plus a lump sum",
          unit: "year",
          rate: i,
          flows: [
            ...range(k + 1, k + n).map((t) => ({ t, amount: X, dir: "in" as const, label: "X" })),
            { t: k + n, amount: c * X, dir: "in" as const, label: `${c}X` },
          ],
          valuationTimes: [0, k, k + n],
        },
      ],
      markers: [v(i, k) * an(n, i), v(i, k + n)],
      presentation: ["deferred", "inverse", "combined-topics"],
      features: features({ steps: 3, multipleValuationDates: true, multiConcept: true }),
      chain: chain(
        [
          step("B.deferred", "Value the deferred annual payments today.", ["v^k a_n", v(i, k) * an(n, i), "value of 1 per year"], ["k", "n", "i"]),
          step("A.discount-factor", "Value the lump sum paid with the last payment.", ["c v^{k+n}", c * v(i, k + n), "value of the lump per unit X"], ["c", "k + n"]),
          step("A.equation-of-value", "Price = X(annuity factor + lump factor); solve for X.", ["X", X, "annual payment"], ["PV"], { rearranged: true }),
        ],
        {
          methods: ["decomposition", "equation_construction"],
          stages: {
            TIMING_VALUATION_DATE: [1, "application"],
            TRANS_IGNORED_CONDITION: [2, "connection"],
            TIMING_MISSING_PERIOD: [1, "application"],
            TIMING_DEFERRAL_OFF_BY_ONE: [0, "application"],
            SEQ_UNDISCOUNTED_SUM: [2, "application"],
          },
          reasoning: "Split the benefits into a deferred level stream and one lump sum, value each at time 0, and collect the multiples of X.",
        }
      ),
      params: { PV, i, n, k, c },
    };
  },
};

function levelExplanation(p: { i: number; n: number; PV: number; X: number; fmt: AnswerFormat; kind: "deferred" | "due" | "lump"; k?: number; c?: number }) {
  const { i, n, PV, X, fmt, kind, k = 0, c = 0 } = p;
  return explanation({
    intuition:
      kind === "due"
        ? "The buyer pays today and receives the first payment straight away. Because each payment arrives one year sooner than in an ordinary annuity, each is worth more today, and the level payment the price supports is smaller."
        : `Nothing is paid for ${kind === "lump" ? k : k} years; then payments start. The price must cover payments that are far in the future, so it is worth thinking in two moves: value the payments where they start, then carry that value back to today.`,
    translation: {
      unknowns: [{ symbol: "$X$", meaning: "the annual payment" }],
      relationships:
        kind === "due"
          ? [`$${mamt(PV)} = X\\,${adueSym(n)}$`]
          : kind === "deferred"
            ? [`$${mamt(PV)} = X\\,v^{${k}}\\,${aSym(n)}$`]
            : [`$${mamt(PV)} = X\\,v^{${k}}\\,${aSym(n)} + ${c}X\\,v^{${k + n}}$`],
      conditions: kind === "due" ? ["First payment at time 0."] : [`First payment at time ${k + 1}.`, ...(kind === "lump" ? [`Lump sum at time ${k + n}.`] : [])],
      valuationDate: "Time 0, when the price is paid.",
      modelChoice: kind === "due" ? "Annuity-due factor." : "Deferred annuity-immediate: a(n) leaves its value one period before the first payment.",
      assumptions: [`Constant effective rate ${pc(i)}.`, "Payments certain (no mortality)."],
    },
    solution:
      kind === "due"
        ? [
            { title: "Factor", body: `$${adueSym(n)} = (1+i)${aSym(n)} = ${dec(adue(n, i), 5)}$` },
            { title: "Equation", body: `$X \\times ${dec(adue(n, i), 5)} = ${mamt(PV)}$` },
            { title: "Solve", body: `$X = ${shown(X, fmt)}$` },
          ]
        : [
            { title: "Annuity factor", body: `$${aSym(n)} = ${dec(an(n, i), 5)}$, valued at time ${k}` },
            { title: "Discount to today", body: `$v^{${k}}${aSym(n)} = ${dec(v(i, k) * an(n, i), 5)}${kind === "lump" ? `$; lump: $${c}v^{${k + n}} = ${dec(c * v(i, k + n), 5)}` : ""}$` },
            { title: "Solve", body: `$X = ${mamt(PV)} / ${dec(kind === "lump" ? v(i, k) * an(n, i) + c * v(i, k + n) : v(i, k) * an(n, i), 5)} = ${shown(X, fmt)}$` },
          ],
    alternatives: [
      {
        name: kind === "due" ? "Annuity-immediate plus the first payment" : "Difference of two annuities",
        body: kind === "due" ? `$${adueSym(n)} = 1 + ${aSym(n - 1)}$` : `$v^{${k}}${aSym(n)} = ${aSym(k + n)} - ${aSym(k)}$`,
        whenUseful: kind === "due" ? "A quick check that avoids any (1 + i) slip." : "Avoids counting the deferral exponent entirely.",
      },
      {
        name: "Calculator",
        body: kind === "due" ? "BGN mode, N = n, I/Y = i, PV = price; solve PMT." : "Find the time-k value needed (price × (1 + i)^k), then solve PMT in END mode.",
        whenUseful: "Fast, provided the mode (BGN/END) and the valuation date are set deliberately.",
      },
    ],
    transfer: {
      principle: "a(n) values a stream one period before its first payment; ä(n) values it at its first payment. Every other date is reached with explicit powers of v.",
      unusual: kind === "lump" ? "Two benefit types share an end date." : kind === "deferred" ? "The first payment's date is given in words, not as a deferral period." : "Payments start immediately.",
      misread: "The deferral exponent and the due/immediate distinction are each off by exactly one period when misread.",
    },
  });
}

// ===================================================================== arithmetic streams

const arithmetic: QuestionTemplate = {
  id: "ann-arithmetic",
  family: "ann-varying",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.non_level", "ANNUITIES.level_payment"],
  reasoning: ["formula_reconstruction", "formula_selection", "concept_recognition", "algebra"],
  soaConcept: "Arithmetically increasing and decreasing annuities, decomposed into level and (Ia)/(Da) parts.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 20);
    const fmt = MONEY0;

    if (lvl === 1) {
      const P = gridAmount(rng, 500, 3000, 100);
      const Q = gridAmount(rng, 50, 400, 25);
      const PVv = (P - Q) * an(n, i) + Q * Ia(n, i);
      const last = P + (n - 1) * Q;
      const geo = P * geometricPV(n, i, Q / P);
      const early = P * an(n, i) + Q * Ia(n, i);
      const due = PVv * (1 + i);
      const avg = ((P + last) / 2) * an(n, i);
      const total = (n * (P + last)) / 2;
      return {
        stem: `An annuity-immediate pays ${amt(P)} at the end of the first year, ${amt(P + Q)} at the end of the second year, and continues to increase by ${amt(Q)} each year, with the last payment of ${amt(last)} made at the end of year ${n}. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the annuity.`,
        answer: {
          value: PVv,
          calc: `${lit(P - Q)}*${aExpr(n, i)} + ${lit(Q)}*${IaExpr(n, i)}`,
          format: fmt,
          derivation: `$(${P} - ${Q})${aSym(n)} + ${Q}(Ia)_{\\overline{${n}|}} = ${shown(PVv, fmt)}$`,
        },
        model: {
          expr: pvTerms(range(1, n).map((t) => ({ t, amount: P + (t - 1) * Q })), i),
          description: "Sum of each payment P + (t − 1)Q discounted from its own date.",
        },
        distractors: [
          distractor("SEQ_ARITHMETIC_AS_GEOMETRIC", geo, `${lit(P)}*(1-((1+${lit(Q / P)})/(1+${lit(i)}))**${n})/(${lit(i)}-${lit(Q / P)})`, {
            derivation: `growth $g = ${Q}/${P} = ${dec(Q / P, 4)}$: $${P}\\dfrac{1 - (\\frac{1+g}{1+i})^{${n}}}{i - g} = ${shown(geo, fmt)}$`,
            method: `Treated the ${amt(Q)} increase as a ${pc(Q / P, 2)} growth rate.`,
            feedback: `The payments rise by a fixed ${amt(Q)}, not by a fixed percentage; a geometric model makes later payments too large.`,
          }),
          distractor("SEQ_TERM_COUNT", early, `${lit(P)}*${aExpr(n, i)} + ${lit(Q)}*${IaExpr(n, i)}`, {
            derivation: `$${P}\\,${aSym(n)} + ${Q}(Ia)_{\\overline{${n}|}} = ${shown(early, fmt)}$`,
            method: "Started the increments at the first payment.",
            feedback: `$Q(Ia)$ pays Q, 2Q, 3Q, ... — so added to a level ${P} it would make the first payment ${P + Q}. Use a level of P − Q.`,
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", due, `(${lit(P - Q)}*${aExpr(n, i)} + ${lit(Q)}*${IaExpr(n, i)})*${onePlus(i)}`, {
            derivation: `$${mnum(PVv, 2)}(1+i) = ${shown(due, fmt)}$`,
            method: "Valued the stream as an annuity-due.",
            feedback: "The first payment is at the end of the first year.",
          }),
          distractor("MODEL_LEVEL_FOR_VARYING", avg, `(${lit(P)} + ${lit(last)})/2*${aExpr(n, i)}`, {
            derivation: `$\\tfrac{${P} + ${last}}{2}\\,${aSym(n)} = ${shown(avg, fmt)}$`,
            method: "Replaced the payments by their average.",
            feedback: "The larger payments come later and are discounted more, so the average payment over-values the stream.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", total, `${n}*(${lit(P)}+${lit(last)})/2`, {
            derivation: `$\\tfrac{${n}}{2}(${P} + ${last}) = ${shown(total, fmt)}$`,
            method: "Summed the arithmetic series without discounting.",
            feedback: "The pairing trick sums the payments, but each payment must first be discounted to time 0.",
          }),
        ],
        explanation: arithmeticExplanation({ i, n, P, Q, value: PVv, fmt }),
        visuals: [
          {
            kind: "series",
            title: "A level stream plus a staircase",
            unit: "year",
            series: [
              { label: "payments", values: range(1, n).map((t) => ({ t, amount: P + (t - 1) * Q })) },
              { label: "present value of each", values: range(1, n).map((t) => ({ t, amount: (P + (t - 1) * Q) * v(i, t) })) },
            ],
            caption: "Payments climb linearly; their present values rise much more slowly.",
          },
        ],
        markers: [an(n, i), Ia(n, i)],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("B.annuity-immediate", "The level floor of P − Q per year.", ["(P−Q) a_n", (P - Q) * an(n, i), "value of the floor"], ["P", "Q", "n", "i"]),
            step("B.increasing", "The staircase Q, 2Q, …, nQ.", ["Q (Ia)_n", Q * Ia(n, i), "value of the staircase"], ["Q", "n", "i"]),
            step("A.equation-of-value", "Add the two pieces.", ["PV", PVv, "present value"], ["floor", "staircase"]),
          ],
          {
            methods: ["decomposition"],
            stages: {
              SEQ_ARITHMETIC_AS_GEOMETRIC: [1, "selection", "B.geometric-annuity"],
              SEQ_TERM_COUNT: [0, "connection"],
              TIMING_IMMEDIATE_AS_DUE: [2, "application"],
              MODEL_LEVEL_FOR_VARYING: [1, "selection", "B.annuity-immediate"],
              SEQ_UNDISCOUNTED_SUM: [2, "selection", "M.arithmetic-series"],
            },
            reasoning: "Write payment t as (P − Q) + Qt and sum each part; or derive (Ia) by subtracting v·S from S.",
          }
        ),
        params: { P, Q, i, n },
      };
    }

    const k = rng.int(2, 6);
    const X = gridAmount(rng, 20000, 100000, 1000);
    const factor = v(i, k) * Da(n, i);
    const Q = X / factor;
    const asInc = X / (v(i, k) * Ia(n, i));
    const offByOne = X / (v(i, k + 1) * Da(n, i));
    const noDefer = X / Da(n, i);
    const levelAvg = X / (((n + 1) / 2) * v(i, k) * an(n, i));
    const undisc = X / ((n * (n + 1)) / 2);
    return {
      stem: `An annuity pays ${n}Q at the end of year ${k + 1}, ${n - 1}Q at the end of year ${k + 2}, and so on, decreasing by Q each year, until a final payment of Q at the end of year ${k + n}. The present value of the annuity is ${amt(X)} at an annual effective interest rate of ${pc(i)}.\n\nCalculate Q.`,
      answer: {
        value: Q,
        calc: `${lit(X)}/(${vPow(i, k)}*${DaExpr(n, i)})`,
        format: MONEY2,
        derivation: `$Q = \\dfrac{${mamt(X)}}{v^{${k}}(Da)_{\\overline{${n}|}}} = ${shown(Q, MONEY2)}$`,
      },
      model: {
        expr: `${lit(X)} - ${pvTerms(range(1, n).map((s) => ({ t: k + s, amount: `${n - s + 1}*x` })), i)}`,
        bracket: [0, X],
        description: "Present value of each payment (n − s + 1)Q at time k + s, summed and set equal to X.",
      },
      distractors: [
        distractor("FORMULA_DECREASING_FOR_INCREASING", asInc, `${lit(X)}/(${vPow(i, k)}*${IaExpr(n, i)})`, {
          derivation: `$\\dfrac{${mamt(X)}}{v^{${k}}(Ia)_{\\overline{${n}|}}} = ${shown(asInc, MONEY2)}$`,
          method: "Used the increasing-annuity factor.",
          feedback: "The largest payment comes first. An increasing factor puts it last, where it is discounted the most.",
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, `${lit(X)}/(${vPow(i, k + 1)}*${DaExpr(n, i)})`, {
          derivation: `$\\dfrac{${mamt(X)}}{v^{${k + 1}}(Da)_{\\overline{${n}|}}} = ${shown(offByOne, MONEY2)}$`,
          method: `Deferred by ${k + 1} years.`,
          feedback: `(Da) is an annuity-immediate, so it lands one year before its first payment: at time ${k}.`,
        }),
        distractor("TIMING_IGNORED_DEFERRAL", noDefer, `${lit(X)}/${DaExpr(n, i)}`, {
          derivation: `$\\dfrac{${mamt(X)}}{(Da)_{\\overline{${n}|}}} = ${shown(noDefer, MONEY2)}$`,
          method: "Ignored the deferral.",
          feedback: `The first payment is at the end of year ${k + 1}.`,
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", levelAvg, `${lit(X)}/((${n}+1)/2*${vPow(i, k)}*${aExpr(n, i)})`, {
          derivation: `$\\dfrac{${mamt(X)}}{\\frac{${n + 1}}{2}v^{${k}}${aSym(n)}} = ${shown(levelAvg, MONEY2)}$`,
          method: "Replaced the decreasing payments by their average.",
          feedback: "Front-loaded payments are worth more than their average, so this under-values the stream.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", undisc, `${lit(X)}/(${n}*${n + 1}/2)`, {
          derivation: `$\\dfrac{${mamt(X)}}{${(n * (n + 1)) / 2}} = ${shown(undisc, MONEY2)}$`,
          method: "Divided by the total number of Q's paid.",
          feedback: "Each payment is in the future and must be discounted.",
        }),
      ],
      explanation: arithmeticExplanation({ i, n, P: 0, Q, value: Q, fmt: MONEY2, decreasing: true, k, X }),
      visuals: [
        {
          kind: "series",
          title: "Decreasing payments after a deferral",
          unit: "year",
          series: [{ label: "payments (in Q)", values: range(1, n).map((s) => ({ t: k + s, amount: n - s + 1 })) }],
        },
      ],
      markers: [Da(n, i), v(i, k)],
      presentation: ["inverse", "deferred"],
      features: features({ steps: 3, formulaRetrieval: true, multipleValuationDates: true }),
      chain: chain(
        [
          step("B.decreasing", "The decreasing stream n, n − 1, …, 1 per unit Q.", ["(Da)_n", Da(n, i), "factor at time k"], ["n", "i"], { valuationDate: "k" }),
          step("B.deferred", "Move it back k years.", ["v^k (Da)_n", factor, "factor today"], ["k"]),
          step("A.equation-of-value", "PV = Q × factor; solve for Q.", ["Q", Q, "step size"], ["X"], { rearranged: true }),
        ],
        {
          methods: ["valuation_dates", "rearrangement"],
          stages: {
            FORMULA_DECREASING_FOR_INCREASING: [0, "selection", "B.increasing"],
            TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
            TIMING_IGNORED_DEFERRAL: [1, "connection"],
            MODEL_LEVEL_FOR_VARYING: [0, "selection", "B.annuity-immediate"],
            SEQ_UNDISCOUNTED_SUM: [2, "application"],
          },
          reasoning: "A decreasing stream is a stack of level annuities of lengths n, n − 1, …, 1: (Da) = Σ a_k.",
        }
      ),
      params: { X, i, n, k },
    };
  },
};

function arithmeticExplanation(p: { i: number; n: number; P: number; Q: number; value: number; fmt: AnswerFormat; decreasing?: boolean; k?: number; X?: number }) {
  const { i, n, P, Q, value, fmt, decreasing, k = 0, X = 0 } = p;
  return explanation({
    intuition: decreasing
      ? "A decreasing stream is a pile of level annuities of different lengths stacked on top of each other: Q for n years, Q for n − 1 years, and so on. That stack is exactly what (Da) values."
      : "An arithmetic stream is a level annuity with a staircase on top. Value the floor and the staircase separately and add.",
    translation: {
      unknowns: decreasing ? [{ symbol: "$Q$", meaning: "the step size and final payment" }] : [{ symbol: "$PV$", meaning: "the value today of every payment" }],
      relationships: decreasing
        ? [`$${mamt(X)} = Q\\,v^{${k}}(Da)_{\\overline{${n}|}}$`, `$(Da)_{\\overline{${n}|}} = \\dfrac{${n} - ${aSym(n)}}{i}$`]
        : [`$\\text{payment}_t = ${P} + (t-1)${Q} = (${P} - ${Q}) + ${Q}t$`, `$PV = (${P} - ${Q})${aSym(n)} + ${Q}(Ia)_{\\overline{${n}|}}$`],
      conditions: [`${n} payments`, decreasing ? `first payment at time ${k + 1}` : "first payment at time 1"],
      valuationDate: "Time 0.",
      modelChoice: decreasing ? "Deferred (Da)." : "Decompose into a level annuity and (Ia).",
      assumptions: [`Constant effective rate ${pc(i)}.`],
    },
    solution: decreasing
      ? [
          { title: "Factor", body: `$(Da)_{\\overline{${n}|}} = \\dfrac{${n} - ${dec(an(n, i), 5)}}{${dec(i, 3)}} = ${dec(Da(n, i), 5)}$` },
          { title: "Defer", body: `$v^{${k}}(Da) = ${dec(v(i, k) * Da(n, i), 5)}$` },
          { title: "Solve", body: `$Q = ${mamt(X)} / ${dec(v(i, k) * Da(n, i), 5)} = ${shown(value, fmt)}$` },
        ]
      : [
          { title: "Level part", body: `$(${P} - ${Q})${aSym(n)} = ${P - Q} \\times ${dec(an(n, i), 5)} = ${mnum((P - Q) * an(n, i), 2)}$` },
          { title: "Increasing part", body: `$(Ia)_{\\overline{${n}|}} = \\dfrac{${adueSym(n)} - ${n}v^{${n}}}{i} = ${dec(Ia(n, i), 5)}$, times ${Q} $= ${mnum(Q * Ia(n, i), 2)}$` },
          { title: "Total", body: `$PV = ${shown(value, fmt)}$` },
        ],
    alternatives: [
      {
        name: decreasing ? "Increasing + level identity" : "Sum of deferred level annuities",
        body: decreasing
          ? `$(Da)_{\\overline{n|}} + (Ia)_{\\overline{n|}} = (n+1)${aSym("n")}$, so $(Da) = (n+1)${aSym("n")} - (Ia)$.`
          : `$PV = ${P}\\,${aSym(n)} + ${Q}\\sum_{s=1}^{${n - 1}} v^{s}${aSym(`${n}-s`)}$`,
        whenUseful: "Useful for reconstructing a forgotten formula from one you remember.",
      },
      {
        name: "Reconstruct (Ia) from first principles",
        body: "Write $S = v + 2v^2 + \\dots + nv^n$, subtract $vS$, and the difference is a level annuity minus a final term.",
        whenUseful: "When the formula will not come back under pressure — it takes about a minute.",
      },
    ],
    transfer: {
      principle: "Any arithmetic stream = level annuity + multiple of (Ia) or (Da). Fix the level so the first payment matches.",
      unusual: decreasing ? "The stream is decreasing and deferred, and the step size is the unknown." : "The increments start from the second payment.",
      misread: "Fixed-amount increases are arithmetic, not geometric; and the level part is P − Q, not P.",
    },
  });
}

// ===================================================================== geometric streams

const geometric: QuestionTemplate = {
  id: "ann-geometric",
  family: "ann-varying",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.frequency_timing"],
  reasoning: ["formula_reconstruction", "formula_selection", "concept_recognition", "transfer"],
  soaConcept: "Geometrically growing annuities and perpetuities.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.05, 0.09, 0.005);
    const g = gridRate(rng, 0.02, i - 0.015, 0.005);
    const n = rng.int(8, 20);
    const P = gridAmount(rng, 1000, 5000, 100);
    const ratio = `((1+${lit(g)})/(1+${lit(i)}))`;

    if (lvl === 1) {
      const fmt = MONEY0;
      const PVv = P * geometricPV(n, i, g);
      const arith = P * an(n, i) + P * g * (Ia(n, i) - an(n, i));
      const diff = P * an(n, i - g);
      const due = PVv * (1 + i);
      const extra = P * geometricPV(n + 1, i, g);
      const levelV = P * an(n, i);
      return {
        stem: `An annuity-immediate makes ${n} annual payments. The first payment is ${amt(P)}, and each subsequent payment is ${pc(g)} larger than the one before. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the annuity.`,
        answer: {
          value: PVv,
          calc: `${lit(P)}*(1-${ratio}**${n})/(${lit(i)}-${lit(g)})`,
          format: fmt,
          derivation: `$${P}\\cdot\\dfrac{1 - (\\frac{${dec(1 + g, 3)}}{${dec(1 + i, 3)}})^{${n}}}{${dec(i, 3)} - ${dec(g, 3)}} = ${shown(PVv, fmt)}$`,
        },
        model: {
          expr: pvTerms(range(1, n).map((t) => ({ t, amount: `${lit(P)}*(1+${lit(g)})**${t - 1}` })), i),
          description: "Each payment P(1 + g)^(t−1) discounted from time t, summed.",
        },
        distractors: [
          distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", arith, `${lit(P)}*${aExpr(n, i)} + ${lit(P * g)}*(${IaExpr(n, i)} - ${aExpr(n, i)})`, {
            derivation: `payments $${P} + (t-1)${mnum(P * g, 0)}$: $${shown(arith, fmt)}$`,
            method: `Increased each payment by ${pc(g)} of the first payment.`,
            feedback: `“${pc(g)} larger than the one before” compounds: the t-th payment is $P(1+g)^{t-1}$.`,
          }),
          distractor("SEQ_GROWTH_RATE_DIFFERENCE", diff, `${lit(P)}*${aExpr(n, `(${lit(i)}-${lit(g)})`)}`, {
            derivation: `$${P}\\,${aSym(n)}$ at $${dec(i - g, 3)}$ $= ${shown(diff, fmt)}$`,
            method: "Discounted a level stream at i − g.",
            feedback: "The equivalent level rate is (1 + i)/(1 + g) − 1, and the first payment must also be adjusted by 1/(1 + g).",
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", due, `${lit(P)}*(1-${ratio}**${n})/(${lit(i)}-${lit(g)})*${onePlus(i)}`, {
            derivation: `$${mnum(PVv, 2)}(1 + i) = ${shown(due, fmt)}$`,
            method: "Treated the first payment as made today.",
            feedback: "An annuity-immediate's first payment is one year away.",
          }),
          distractor("SEQ_TERM_COUNT", extra, `${lit(P)}*(1-${ratio}**${n + 1})/(${lit(i)}-${lit(g)})`, {
            derivation: `$${P}\\cdot\\dfrac{1 - (\\frac{1+g}{1+i})^{${n + 1}}}{i - g} = ${shown(extra, fmt)}$`,
            method: `Summed ${n + 1} terms.`,
            feedback: `There are ${n} payments, so the ratio is raised to the power ${n}.`,
          }),
          distractor("MODEL_LEVEL_FOR_VARYING", levelV, `${lit(P)}*${aExpr(n, i)}`, {
            derivation: `$${P}\\,${aSym(n)} = ${shown(levelV, fmt)}$`,
            method: "Ignored the growth.",
            feedback: "Every payment after the first is larger than P.",
          }),
        ],
        explanation: geometricExplanation({ i, g, n, P, value: PVv, fmt, kind: "finite" }),
        visuals: [
          {
            kind: "series",
            title: "Payments grow; their present values shrink more slowly",
            unit: "year",
            series: [
              { label: "payment", values: range(1, n).map((t) => ({ t, amount: P * Math.pow(1 + g, t - 1) })) },
              { label: "present value", values: range(1, n).map((t) => ({ t, amount: P * Math.pow(1 + g, t - 1) * v(i, t) })) },
            ],
            caption: "Each present value is the previous one times (1 + g)/(1 + i).",
          },
        ],
        markers: [(1 + g) / (1 + i), (1 + i) / (1 + g) - 1],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [step("B.geometric-annuity", "Payments grow by a percentage: geometric annuity.", ["PV", PVv, "present value"], ["P", "g", "i", "n"])],
          {
            stages: {
              SEQ_GEOMETRIC_AS_ARITHMETIC: [0, "selection", "B.increasing"],
              SEQ_GROWTH_RATE_DIFFERENCE: [0, "selection", "B.annuity-immediate"],
              TIMING_IMMEDIATE_AS_DUE: [0, "application"],
              SEQ_TERM_COUNT: [0, "application"],
              MODEL_LEVEL_FOR_VARYING: [0, "selection", "B.annuity-immediate"],
            },
            reasoning: "Write the first three discounted payments: each is (1 + g)/(1 + i) times the last — sum the geometric series.",
          }
        ),
        params: { P, g, i, n },
      };
    }

    if (lvl === 2) {
      const k = rng.int(3, 8);
      const X = gridAmount(rng, 50000, 400000, 5000);
      const Pans = (X * (i - g)) / v(i, k - 1);
      const fmt = MONEY2;
      const offByOne = (X * (i - g)) / v(i, k);
      const noDefer = X * (i - g);
      const levelPerp = (X * i) / v(i, k - 1);
      const diffRate = (X * (i - g)) / (1 + g) / v(i, k - 1);
      return {
        stem: `A perpetuity makes annual payments, the first of which is made at the end of year ${k}. Each payment is ${pc(g)} larger than the previous one. At an annual effective interest rate of ${pc(i)}, the present value of the perpetuity is ${amt(X)}.\n\nCalculate the amount of the first payment.`,
        answer: {
          value: Pans,
          calc: `${lit(X)}*(${lit(i)}-${lit(g)})/${vPow(i, k - 1)}`,
          format: fmt,
          derivation: `$P = \\dfrac{${mamt(X)}(${dec(i, 3)} - ${dec(g, 3)})}{v^{${k - 1}}} = ${shown(Pans, fmt)}$`,
        },
        model: {
          expr: `${lit(X)} - x*${vPow(i, k - 1)}/(${lit(i)}-${lit(g)})`,
          bracket: [0, X],
          description: `A growing perpetuity-immediate starting at time ${k} is worth P/(i − g) at time ${k - 1}; discount that to time 0.`,
        },
        distractors: [
          distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, `${lit(X)}*(${lit(i)}-${lit(g)})/${vPow(i, k)}`, {
            derivation: `$\\dfrac{${mamt(X)}(${dec(i - g, 3)})}{v^{${k}}} = ${shown(offByOne, fmt)}$`,
            method: `Discounted by $v^{${k}}$.`,
            feedback: `P/(i − g) values the perpetuity one year before its first payment — at time ${k - 1}.`,
          }),
          distractor("TIMING_IGNORED_DEFERRAL", noDefer, `${lit(X)}*(${lit(i)}-${lit(g)})`, {
            derivation: `$${mamt(X)}(${dec(i - g, 3)}) = ${shown(noDefer, fmt)}$`,
            method: "Ignored the deferral.",
            feedback: `The first payment is at time ${k}, not time 1.`,
          }),
          distractor("MODEL_LEVEL_FOR_VARYING", levelPerp, `${lit(X)}*${lit(i)}/${vPow(i, k - 1)}`, {
            derivation: `$\\dfrac{${mamt(X)}(${dec(i, 3)})}{v^{${k - 1}}} = ${shown(levelPerp, fmt)}$`,
            method: "Used a level perpetuity.",
            feedback: "A growing perpetuity is worth more than a level one with the same first payment; the denominator is i − g.",
          }),
          distractor("ALG_DIVIDE_ERROR", diffRate, `${lit(X)}*(${lit(i)}-${lit(g)})/(1+${lit(g)})/${vPow(i, k - 1)}`, {
            derivation: `$\\dfrac{${mamt(X)}(${dec(i - g, 3)})}{(1+g)v^{${k - 1}}} = ${shown(diffRate, fmt)}$`,
            method: "Divided by (1 + g) an extra time.",
            feedback: "P/(i − g) already reflects that the first payment is P; no further growth adjustment is needed.",
          }),
        ],
        explanation: geometricExplanation({ i, g, n: 0, P: Pans, value: Pans, fmt, kind: "perpetuity", k, X }),
        visuals: [
          {
            kind: "series",
            title: "A deferred growing perpetuity (first 25 payments)",
            unit: "year",
            series: [{ label: "payment", values: range(k, k + 24).map((t) => ({ t, amount: Pans * Math.pow(1 + g, t - k) })) }],
          },
        ],
        markers: [i - g, v(i, k - 1)],
        presentation: ["inverse", "deferred"],
        features: features({ steps: 2, formulaRetrieval: true, multipleValuationDates: true }),
        chain: chain(
          [
            step("A.discount-factor", "Move the given present value forward to where the growing perpetuity factor lands (time k − 1).", ["X(1+i)^{k−1}", X / v(i, k - 1), "value at time k − 1"], ["X", "k"], { valuationDate: "k − 1" }),
            step("B.geometric-perpetuity", "That value is P/(i − g); solve for P.", ["P", Pans, "first payment"], ["i", "g"], { rearranged: true }),
          ],
          {
            methods: ["work_backwards", "rearrangement"],
            stages: {
              TIMING_DEFERRAL_OFF_BY_ONE: [0, "application"],
              TIMING_IGNORED_DEFERRAL: [0, "connection"],
              MODEL_LEVEL_FOR_VARYING: [1, "selection", "B.perpetuity"],
              ALG_DIVIDE_ERROR: [1, "application"],
            },
            reasoning: "Each payment's PV is the previous one × (1 + g)/(1 + i): an infinite geometric series starting with Pv^k.",
          }
        ),
        params: { X, i, g, k },
      };
    }

    // Level 3: quarterly payments, level within each year, growing yearly.
    const years = rng.int(6, 15);
    const Xq = gridAmount(rng, 200, 1500, 50);
    const jq = Math.pow(1 + i, 0.25) - 1;
    const yearFactor = an(4, jq);
    const growth = geometricPV(years, i, g) * (1 + i);
    const PVv = Xq * yearFactor * growth;
    const fmt = MONEY0;
    const divided = Xq * an(4, i / 4) * growth;
    const annual = 4 * Xq * geometricPV(years, i, g);
    const quarterly = Xq * geometricPV(4 * years, jq, Math.pow(1 + g, 0.25) - 1);
    const arith = Xq * yearFactor * (an(years, i) + g * (Ia(years, i) - an(years, i))) * (1 + i);
    const yf = `((1-(1+${lit(i)})**(-1))/((1+${lit(i)})**0.25-1))`;
    const growthE = `((1-${ratio}**${years})/(${lit(i)}-${lit(g)})*(1+${lit(i)}))`;
    return {
      stem: `Payments are made at the end of each quarter for ${years} years. Each payment in the first year is ${amt(Xq)}. In each later year, every quarterly payment is ${pc(g)} larger than the quarterly payments of the previous year. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the payments.`,
      answer: {
        value: PVv,
        calc: `${lit(Xq)}*${yf}*${growthE}`,
        format: fmt,
        derivation: `$${Xq}\\,a^{(q)}_{\\overline{4|}} \\times \\sum_{y=1}^{${years}} \\left(\\tfrac{1+g}{1+i}\\right)^{y-1} = ${shown(PVv, fmt)}$`,
      },
      model: {
        expr: sumOf(
          range(1, years).flatMap((y) =>
            [1, 2, 3, 4].map((q) => `${lit(Xq)}*(1+${lit(g)})**${y - 1}*(1+${lit(i)})**(-(${y - 1}+${q}/4))`)
          )
        ),
        description: "Every quarterly payment written out: year y, quarter q pays X(1 + g)^(y−1) at time y − 1 + q/4.",
      },
      distractors: [
        distractor("TIMING_EXTRA_PERIOD", PVv / (1 + i), `${lit(Xq)}*${yf}*${growthE}/(1+${lit(i)})`, {
          derivation: `block value $${Xq}\\,a_{\\overline{4|}j}$ treated as paid at year end: $${shown(PVv / (1 + i), fmt)}$`,
          method: "Discounted each year's block from the end of its year instead of from its start.",
          feedback: "a(4) at the quarterly rate values a year's payments at the start of that year; the year-1 block is already at time 0.",
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", PVv * (1 + jq), `${lit(Xq)}*${yf}*${growthE}*(1+${lit(i)})**0.25`, {
          derivation: `quarterly payments in advance: $${shown(PVv * (1 + jq), fmt)}$`,
          method: "Treated the quarterly payments as made at the start of each quarter.",
          feedback: "Payments are at the end of each quarter.",
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", Xq * an(4 * years, jq), `${lit(Xq)}*${aExpr(4 * years, `((1+${lit(i)})**0.25-1)`)}`, {
          derivation: `$${Xq}\\,a_{\\overline{${4 * years}|}j} = ${shown(Xq * an(4 * years, jq), fmt)}$`,
          method: "Ignored the yearly growth.",
          feedback: "From year 2 onward every payment is larger.",
        }),
        distractor("RATE_DIVIDED_EFFECTIVE", divided, `${lit(Xq)}*((1-(1+${lit(i)}/4)**(-4))/(${lit(i)}/4))*${growthE}`, {
          derivation: `quarterly rate $${dec(i, 3)}/4$: $${shown(divided, fmt)}$`,
          method: "Divided the annual effective rate by 4 to get a quarterly rate.",
          feedback: `An effective annual rate converts to a quarterly rate by a root: $(1.${String(i).slice(2)})^{1/4} - 1 = ${dec(jq, 6)}$.`,
        }),
        distractor("RATE_PAYMENT_FREQUENCY", annual, `4*${lit(Xq)}*(1-${ratio}**${years})/(${lit(i)}-${lit(g)})`, {
          derivation: `$4(${Xq})\\cdot\\dfrac{1 - (\\frac{1+g}{1+i})^{${years}}}{i - g} = ${shown(annual, fmt)}$`,
          method: "Treated each year's four payments as one payment at year end.",
          feedback: "Quarterly payments arrive earlier than year-end, so a year's payments are worth more than 4X at the end of the year.",
        }),
        distractor("TRANS_INVERTED_RELATION", quarterly, `${lit(Xq)}*(1-((1+${lit(g)})/(1+${lit(i)}))**${years})/((1+${lit(i)})**0.25-(1+${lit(g)})**0.25)`, {
          derivation: `growth spread over every quarter: $${shown(quarterly, fmt)}$`,
          method: "Let the payments grow a little every quarter instead of once a year.",
          feedback: "Payments are level within each year and step up once a year.",
        }),
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", arith, `${lit(Xq)}*${yf}*(${aExpr(years, i)} + ${lit(g)}*(${IaExpr(years, i)} - ${aExpr(years, i)}))*(1+${lit(i)})`, {
          derivation: `yearly increase of $${dec(g, 3)}X$: $${shown(arith, fmt)}$`,
          method: `Raised the payments by ${pc(g)} of the first year's payment each year.`,
          feedback: "Each year's payment is a percentage of the previous year's, so the growth compounds.",
        }),
      ],
      explanation: geometricExplanation({ i, g, n: years, P: Xq, value: PVv, fmt, kind: "quarterly" }),
      visuals: [
        {
          kind: "series",
          title: "Level within a year, stepping up each year",
          unit: "quarter",
          series: [
            {
              label: "payment",
              values: range(1, Math.min(years, 6) * 4).map((q) => ({ t: q, amount: Xq * Math.pow(1 + g, Math.floor((q - 1) / 4)) })),
            },
          ],
        },
      ],
      markers: [jq, yearFactor],
      presentation: ["frequency", "combined-topics", "hidden-structure"],
      features: features({ steps: 4, multiConcept: true, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Quarterly payments need the quarterly effective rate.", ["j", jq, "effective rate per quarter"], ["i"]),
          step("B.annuity-immediate", "One year's four payments, valued at the start of that year.", ["X a_{4|j}", Xq * yearFactor, "value of one year's block"], ["X", "j"]),
          step("B.geometric-annuity-due", "The yearly blocks grow geometrically and the first block is valued at time 0.", ["PV", PVv, "present value"], ["block", "g", "i", "years"]),
        ],
        {
          methods: ["decomposition", "geometric_series"],
          unconventional: true,
          stages: {
            TIMING_EXTRA_PERIOD: [2, "connection"],
            TIMING_IMMEDIATE_AS_DUE: [1, "application"],
            MODEL_LEVEL_FOR_VARYING: [2, "selection", "B.annuity-immediate"],
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            RATE_PAYMENT_FREQUENCY: [1, "selection", "B.geometric-annuity"],
            TRANS_INVERTED_RELATION: [2, "connection"],
            SEQ_GEOMETRIC_AS_ARITHMETIC: [2, "selection", "B.increasing"],
          },
          reasoning: "Group the payments into yearly blocks: each block is a fixed multiple of that year's payment, and the blocks form a geometric series.",
        }
      ),
      params: { Xq, i, g, years },
    };
  },
};

function geometricExplanation(p: { i: number; g: number; n: number; P: number; value: number; fmt: AnswerFormat; kind: "finite" | "perpetuity" | "quarterly"; k?: number; X?: number }) {
  const { i, g, n, P, value, fmt, kind, k = 0, X = 0 } = p;
  const r = (1 + g) / (1 + i);
  return explanation({
    intuition:
      kind === "quarterly"
        ? "Treat each year as a block: the four quarterly payments in year y are worth one fixed multiple of that year's payment at the start of the year. Then the blocks form a geometric stream growing at g."
        : "Each payment is (1 + g) times the last, but each is also one year further away. So each payment's present value is (1 + g)/(1 + i) times the previous one's — a geometric series.",
    translation: {
      unknowns: kind === "perpetuity" ? [{ symbol: "$P$", meaning: `the first payment, at time ${k}` }] : [{ symbol: "$PV$", meaning: "present value of all payments" }],
      relationships:
        kind === "perpetuity"
          ? [`$${mamt(X)} = v^{${k - 1}}\\dfrac{P}{i - g}$`]
          : kind === "quarterly"
            ? [`$PV = X\\,a^{(q)}_{\\overline{4|}}\\,\\ddot{a}_{\\overline{${n}|}}$ at the growth-adjusted rate`, `$a^{(q)}_{\\overline{4|}}$ at the quarterly rate $(1+i)^{1/4} - 1$`]
            : [`$PV = \\sum_{t=1}^{${n}} P(1+g)^{t-1}v^t = P\\dfrac{1 - r^{${n}}}{i - g}$, $r = \\tfrac{1+g}{1+i}$`],
      conditions: [`$g = ${mpc(g)} < i = ${mpc(i)}$`],
      valuationDate: kind === "perpetuity" ? `Time ${k - 1} for the formula, then time 0.` : "Time 0.",
      modelChoice: "Geometric series in the ratio (1 + g)/(1 + i).",
      assumptions: ["Growth compounds.", "Constant effective rate."],
    },
    solution:
      kind === "perpetuity"
        ? [
            { title: "Value at time " + (k - 1), body: `$\\dfrac{P}{i - g} = \\dfrac{P}{${dec(i - g, 3)}}$` },
            { title: "Discount", body: `$${mamt(X)} = \\dfrac{P}{${dec(i - g, 3)}}\\,v^{${k - 1}}$` },
            { title: "Solve", body: `$P = ${shown(value, fmt)}$` },
          ]
        : kind === "quarterly"
          ? [
              { title: "Quarterly rate", body: `$j = (${dec(1 + i, 3)})^{1/4} - 1 = ${dec(Math.pow(1 + i, 0.25) - 1, 6)}$` },
              { title: "One year's block", body: `$${P}\\,a_{\\overline{4|}j} = ${mnum(P * an(4, Math.pow(1 + i, 0.25) - 1), 2)}$ at the start of each year` },
              { title: "Grow and sum the blocks", body: `$\\times \\sum_{y=0}^{${n - 1}} r^{y} = ${dec(geometricPV(n, i, g) * (1 + i), 5)}$, so $PV = ${shown(value, fmt)}$` },
            ]
          : [
              { title: "Ratio", body: `$r = ${dec(1 + g, 3)}/${dec(1 + i, 3)} = ${dec(r, 6)}$` },
              { title: "Series", body: `$\\dfrac{1 - r^{${n}}}{i - g} = ${dec(geometricPV(n, i, g), 5)}$` },
              { title: "Present value", body: `$PV = ${P} \\times ${dec(geometricPV(n, i, g), 5)} = ${shown(value, fmt)}$` },
            ],
    alternatives: [
      {
        name: "Equivalent level annuity",
        body: `$PV = \\dfrac{P}{1+g}\\,${aSym(kind === "perpetuity" ? "\\infty" : n)}$ at $j = \\tfrac{1+i}{1+g} - 1 = ${dec((1 + i) / (1 + g) - 1, 6)}$.`,
        whenUseful: "Lets a calculator's level-annuity keys do the work.",
      },
      {
        name: "Reconstruct the series",
        body: "Write the first three present values and spot the common ratio; the finite geometric sum formula does the rest.",
        whenUseful: "When the closed form will not come back under pressure.",
      },
    ],
    transfer: {
      principle: "A geometric stream discounted at i is a geometric series with ratio (1 + g)/(1 + i); every growing-annuity formula follows from that one fact.",
      unusual: kind === "quarterly" ? "Growth is annual but payments are quarterly — two clocks." : kind === "perpetuity" ? "The perpetuity is deferred and the first payment is unknown." : "Nothing unusual: the trap is in which growth model applies.",
      misread: "A percentage increase compounds; i − g is not the right level rate.",
    },
  });
}

// ===================================================================== perpetuities

const perpetuity: QuestionTemplate = {
  id: "ann-perpetuity",
  family: "ann-perpetuity",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.frequency_timing", "TVM.effective_nominal"],
  reasoning: ["formula_selection", "valuation_dates", "formula_reconstruction"],
  soaConcept: "Deferred perpetuities and perpetuities paying every k years.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const fmt = MONEY0;
    if (lvl === 1) {
      const X = gridAmount(rng, 1000, 8000, 250);
      const m = rng.int(3, 10);
      const PVv = (X * v(i, m - 1)) / i;
      return {
        stem: `A perpetuity pays ${amt(X)} at the end of each year, with the first payment at the end of year ${m}. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the perpetuity.`,
        answer: {
          value: PVv,
          calc: `${lit(X)}/${lit(i)}*${vPow(i, m - 1)}`,
          format: fmt,
          derivation: `$\\dfrac{${X}}{${dec(i, 3)}}v^{${m - 1}} = ${shown(PVv, fmt)}$`,
        },
        model: {
          expr: `${lit(X)}/${lit(i)} - ${pvTerms(level(X, range(1, m - 1)), i)}`,
          description: `A perpetuity from time 1, less the ${m - 1} payments at times 1, ..., ${m - 1} that are not made.`,
        },
        distractors: [
          distractor("TIMING_DEFERRAL_OFF_BY_ONE", (X * v(i, m)) / i, `${lit(X)}/${lit(i)}*${vPow(i, m)}`, {
            derivation: `$\\dfrac{${X}}{${dec(i, 3)}}v^{${m}} = ${shown((X * v(i, m)) / i, fmt)}$`,
            method: `Discounted by $v^{${m}}$.`,
            feedback: `X/i values a perpetuity-immediate one year before its first payment, which is time ${m - 1}.`,
          }),
          distractor("TIMING_IGNORED_DEFERRAL", X / i, `${lit(X)}/${lit(i)}`, {
            derivation: `$${X}/${dec(i, 3)} = ${shown(X / i, fmt)}$`,
            method: "Ignored the deferral.",
            feedback: `No payments are made in the first ${m - 1} years.`,
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", ((X * (1 + i)) / i) * v(i, m - 1), `${lit(X)}*(1+${lit(i)})/${lit(i)}*${vPow(i, m - 1)}`, {
            derivation: `$\\dfrac{${X}(1+i)}{i}v^{${m - 1}} = ${shown(((X * (1 + i)) / i) * v(i, m - 1), fmt)}$`,
            method: "Used a perpetuity-due factor with the same deferral.",
            feedback: `A perpetuity-due deferred ${m - 1} years would start at time ${m - 1}. The first payment is at time ${m}.`,
          }),
          distractor("ALG_DIVIDE_ERROR", X * i * v(i, m - 1) * 100, `${lit(X)}*${lit(i)}*100*${vPow(i, m - 1)}`, {
            derivation: `$${X} \\times ${mpc(i)} \\text{ (as } ${Math.round(i * 100)}) \\times v^{${m - 1}} = ${shown(X * i * v(i, m - 1) * 100, fmt)}$`,
            method: "Multiplied by the rate (in percent) instead of dividing by it.",
            feedback: "A perpetuity is worth payment ÷ rate: the amount whose interest each year equals the payment.",
          }),
        ],
        explanation: perpetuityExplanation({ i, value: PVv, fmt, m, X }),
        visuals: [
          {
            kind: "timeline",
            title: "A perpetuity that starts late (first 12 payments shown)",
            unit: "year",
            rate: i,
            flows: range(m, m + 11).map((t) => ({ t, amount: X, dir: "in" as const, label: "X" })),
            valuationTimes: [m - 1, 0],
          },
        ],
        markers: [X / i, v(i, m - 1)],
        presentation: ["deferred"],
        features: features({ steps: 2, multipleValuationDates: true }),
        chain: chain(
          [
            step("B.perpetuity", "A level perpetuity is worth X/i one period before its first payment.", ["X/i", X / i, "value at time m − 1"], ["X", "i"], { valuationDate: "m − 1" }),
            step("A.discount-factor", "Discount that value to today.", ["PV", PVv, "present value"], ["m − 1"], { valuationDate: "0" }),
          ],
          {
            methods: ["valuation_dates"],
            stages: {
              TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
              TIMING_IGNORED_DEFERRAL: [1, "connection"],
              TIMING_IMMEDIATE_AS_DUE: [0, "application"],
              ALG_DIVIDE_ERROR: [0, "application"],
            },
            reasoning: "A perpetuity from time 1 minus the m − 1 payments that never happen: X/i − X a_{m−1}.",
          }
        ),
        params: { X, m, i },
      };
    }

    const k = rng.choice([2, 3, 4, 5]);
    const PVv = gridAmount(rng, 20000, 200000, 5000);
    const X = PVv * (Math.pow(1 + i, k) - 1);
    const evenSplit = PVv * k * i;
    const due = PVv * i * an(k, i);
    const firstNow = PVv * (Math.pow(1 + i, k) - 1) * Math.pow(1 + i, k);
    const annualPerp = PVv * i;
    return {
      stem: `A perpetuity pays $X$ every ${word(k)} years, with the first payment ${word(k)} years from now. Its present value at an annual effective interest rate of ${pc(i)} is ${amt(PVv)}.\n\nCalculate $X$.`,
      answer: {
        value: X,
        calc: `${lit(PVv)}*((1+${lit(i)})**${k}-1)`,
        format: fmt,
        derivation: `$X = ${mamt(PVv)}\\big[(1.${String(i).slice(2)})^{${k}} - 1\\big] = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `${lit(PVv)} - x/((1+${lit(i)})**${k}-1)`,
        bracket: [0, PVv],
        description: `With j = (1 + i)^${k} − 1 the effective rate per ${k}-year period, the perpetuity is worth X/j.`,
      },
      distractors: [
        distractor("ALLOC_EVEN_SPLIT", evenSplit, `${lit(PVv)}*${k}*${lit(i)}`, {
          derivation: `$${mamt(PVv)} \\times ${k} \\times ${dec(i, 3)} = ${shown(evenSplit, fmt)}$`,
          method: `Used ${k}i as the ${k}-year rate.`,
          feedback: `Interest compounds over the ${k} years: the ${k}-year rate is $(1+i)^{${k}} - 1$, which exceeds ${k}i.`,
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", due, `${lit(PVv)}*${lit(i)}*${aExpr(k, i)}`, {
          derivation: `$X = ${mamt(PVv)}\\,i\\,${aSym(k)} = ${shown(due, fmt)}$`,
          method: "Valued the perpetuity as if the first payment were made now.",
          feedback: `$X/(i\\,${aSym(k)})$ is the value of a perpetuity whose first payment is today. Here the first payment is in ${k} years.`,
        }),
        distractor("TIMING_EXTRA_PERIOD", firstNow, `${lit(PVv)}*((1+${lit(i)})**${k}-1)*(1+${lit(i)})**${k}`, {
          derivation: `$X v^{${k}} / j = ${mamt(PVv)} \\Rightarrow X = ${shown(firstNow, fmt)}$`,
          method: `Discounted the ${k}-year perpetuity by a further ${k} years.`,
          feedback: `X/j already values the payments at time 0, one ${k}-year period before the first payment. No further discounting is needed.`,
        }),
        distractor("ALG_SIGN_ERROR", PVv * Math.pow(1 + i, k), `${lit(PVv)}*(1+${lit(i)})**${k}`, {
          derivation: `$X = ${mamt(PVv)}(1+i)^{${k}} = ${shown(PVv * Math.pow(1 + i, k), fmt)}$`,
          method: `Used $(1+i)^{${k}}$ as the ${k}-year rate, forgetting to subtract 1.`,
          feedback: `The ${k}-year effective rate is $(1+i)^{${k}} - 1$; $(1+i)^{${k}}$ is the accumulation factor.`,
        }),
        distractor("RATE_PAYMENT_FREQUENCY", annualPerp, `${lit(PVv)}*${lit(i)}`, {
          derivation: `$X = ${mamt(PVv)} \\times ${dec(i, 3)} = ${shown(annualPerp, fmt)}$`,
          method: "Treated the payments as annual.",
          feedback: `Payments come only every ${k} years; each must be larger to support the same present value.`,
        }),
      ],
      explanation: perpetuityExplanation({ i, value: X, fmt, k, PV: PVv }),
      visuals: [
        {
          kind: "timeline",
          title: `Payments every ${k} years`,
          unit: "year",
          rate: i,
          flows: range(1, 6).map((s) => ({ t: s * k, amount: X, dir: "in" as const, label: "X" })),
          valuationTimes: [0],
        },
      ],
      markers: [Math.pow(1 + i, k) - 1],
      presentation: ["frequency", "inverse"],
      features: features({ steps: 2, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.compound", "Measure time in k-year blocks: the k-year effective rate.", ["(1+i)^k − 1", Math.pow(1 + i, k) - 1, "rate per k-year period"], ["i", "k"]),
          step("B.fission", "A perpetuity on the k-year clock: PV = X / (k-year rate); solve for X.", ["X", X, "payment every k years"], ["PV"], { rearranged: true }),
        ],
        {
          methods: ["rearrangement"],
          stages: {
            ALLOC_EVEN_SPLIT: [0, "application"],
            TIMING_IMMEDIATE_AS_DUE: [1, "application"],
            TIMING_EXTRA_PERIOD: [1, "application"],
            ALG_SIGN_ERROR: [0, "application"],
            RATE_PAYMENT_FREQUENCY: [1, "selection", "B.perpetuity"],
          },
          reasoning: "Sum the geometric series X(v^k + v^{2k} + …) = X v^k/(1 − v^k).",
        }
      ),
      params: { PV: PVv, i, k },
    };
  },
};

function perpetuityExplanation(p: { i: number; value: number; fmt: AnswerFormat; m?: number; X?: number; k?: number; PV?: number }) {
  const { i, value, fmt, m, X = 0, k, PV = 0 } = p;
  const kYear = k !== undefined;
  return explanation({
    intuition: kYear
      ? `Re-measure time in ${k}-year blocks. On that clock the payments are an ordinary perpetuity-immediate, and the interest rate per block is whatever 1 grows to in ${k} years, minus 1.`
      : "A perpetuity is the amount of money whose interest alone pays the benefit forever: X/i. If the payments start later, that pot is only needed later.",
    translation: {
      unknowns: kYear ? [{ symbol: "$X$", meaning: `the payment every ${k} years` }] : [{ symbol: "$PV$", meaning: "the value today" }],
      relationships: kYear
        ? [`$j = (1+i)^{${k}} - 1$`, `$${mamt(PV)} = X / j$`]
        : [`$PV = v^{${(m ?? 1) - 1}}\\cdot\\dfrac{${X}}{i}$`],
      conditions: kYear ? ["First payment at the end of the first block."] : [`First payment at time ${m}.`],
      valuationDate: kYear ? "Time 0." : `Time ${(m ?? 1) - 1} for the perpetuity formula, then time 0.`,
      modelChoice: kYear ? "Change the period to match the payments." : "Deferred perpetuity-immediate.",
      assumptions: ["Payments continue forever.", "Constant effective rate."],
    },
    solution: kYear
      ? [
          { title: `${k}-year rate`, body: `$j = (${dec(1 + i, 3)})^{${k}} - 1 = ${dec(Math.pow(1 + i, k) - 1, 6)}$` },
          { title: "Perpetuity", body: `$X = ${mamt(PV)} \\times j$` },
          { title: "Solve", body: `$X = ${shown(value, fmt)}$` },
        ]
      : [
          { title: "Perpetuity value", body: `$${X}/${dec(i, 3)} = ${mnum(X / i, 2)}$ at time ${(m ?? 1) - 1}` },
          { title: "Discount", body: `$v^{${(m ?? 1) - 1}} = ${dec(v(i, (m ?? 1) - 1), 6)}$` },
          { title: "Present value", body: `$PV = ${shown(value, fmt)}$` },
        ],
    alternatives: kYear
      ? [
          {
            name: "Annual-equivalent payment",
            body: `$X/${sSym(k)}$ paid annually is equivalent to X every ${k} years; then the PV is $X/(i\\,${sSym(k)})$.`,
            whenUseful: "Shows where $(1+i)^k - 1 = i\\,s_{\\overline{k|}}$ comes from.",
          },
        ]
      : [
          {
            name: "Perpetuity minus the missing payments",
            body: `$PV = \\dfrac{X}{i} - X\\,${aSym((m ?? 1) - 1)}$`,
            whenUseful: "Avoids the deferral exponent.",
          },
        ],
    transfer: {
      principle: "Any regular stream can be valued on its own clock: convert the rate to the payment period first.",
      unusual: kYear ? "Payments are less frequent than the rate's period." : "The deferral is stated through the first payment's date.",
      misread: kYear ? "k·i understates the k-year rate because interest compounds." : "Off-by-one deferral is the main trap.",
    },
  });
}

// ===================================================================== monthly payments

const monthly: QuestionTemplate = {
  id: "ann-monthly",
  family: "ann-frequency",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["TVM.effective_nominal", "TVM.discount_rates"],
  reasoning: ["formula_retrieval", "cashflow_modelling", "concept_recognition"],
  soaConcept: "Annuities payable more frequently than the interest conversion period.",
  generate(rng, lvl): QuestionDraft {
    const n = rng.int(5, 20);
    const fmt = MONEY2;
    if (lvl === 1) {
      const i = gridRate(rng, 0.05, 0.1, 0.005);
      const X = gridAmount(rng, 200, 2500, 50);
      const j = Math.pow(1 + i, 1 / 12) - 1;
      const PVv = X * an(12 * n, j);
      const divided = X * an(12 * n, i / 12);
      const annual = 12 * X * an(n, i);
      const due = PVv * (1 + j);
      const count = X * an(n, j);
      const jE = `((1+${lit(i)})**(1/12)-1)`;
      return {
        stem: `Payments of ${amt(X)} are made at the end of each month for ${n} years. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the payments.`,
        answer: {
          value: PVv,
          calc: `${lit(X)}*${aExpr(12 * n, jE)}`,
          format: fmt,
          derivation: `$${X}\\,${aSym(12 * n)}$ at $j = ${dec(j, 6)}$ $= ${shown(PVv, fmt)}$`,
        },
        model: {
          expr: sumOf(range(1, 12 * n).map((t) => `${lit(X)}*(1+${lit(i)})**(-${t}/12)`)),
          description: "Each monthly payment discounted at the annual rate for t/12 years.",
        },
        distractors: [
          distractor("RATE_DIVIDED_EFFECTIVE", divided, `${lit(X)}*${aExpr(12 * n, `(${lit(i)}/12)`)}`, {
            derivation: `monthly rate $${dec(i, 3)}/12$: $${shown(divided, fmt)}$`,
            method: "Divided the annual effective rate by 12.",
            feedback: `An annual effective rate is not nominal. The equivalent monthly rate is $(1.${String(i).slice(2)})^{1/12} - 1 = ${dec(j, 6)}$.`,
          }),
          distractor("RATE_PAYMENT_FREQUENCY", annual, `12*${lit(X)}*${aExpr(n, i)}`, {
            derivation: `$12(${X})\\,${aSym(n)} = ${shown(annual, fmt)}$`,
            method: "Treated each year's payments as one payment at the end of the year.",
            feedback: "Monthly payments arrive during the year, so they are worth more than 12X paid at year-end.",
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", due, `${lit(X)}*${aExpr(12 * n, jE)}*(1+${jE})`, {
            derivation: `$${mnum(PVv, 2)}(1 + j) = ${shown(due, fmt)}$`,
            method: "Treated the payments as made at the start of each month.",
            feedback: "Payments are at the end of each month.",
          }),
          distractor("FORMULA_AV_FOR_PV", X * sn(12 * n, j), `${lit(X)}*${sExpr(12 * n, jE)}`, {
            derivation: `$${X}\\,${sSym(12 * n)}$ at $j$ $= ${shown(X * sn(12 * n, j), fmt)}$`,
            method: "Used the accumulated-value factor.",
            feedback: "A present value sits before the payments: use a, not s.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", 12 * n * X, `12*${n}*${lit(X)}`, {
            derivation: `$${12 * n} \\times ${X} = ${shown(12 * n * X, fmt)}$`,
            method: "Added the payments without discounting.",
            feedback: "Future payments are worth less today.",
          }),
          distractor("SEQ_TERM_COUNT", count, `${lit(X)}*${aExpr(n, jE)}`, {
            derivation: `$${X}\\,${aSym(n)}$ at $j$ $= ${shown(count, fmt)}$`,
            method: `Used ${n} payments instead of ${12 * n}.`,
            feedback: `${n} years of monthly payments is ${12 * n} payments.`,
          }),
        ],
        explanation: monthlyExplanation({ i, n, X, value: PVv, fmt }),
        visuals: [
          {
            kind: "timeline",
            title: "First two years of monthly payments",
            unit: "month",
            rate: j,
            flows: range(1, 24).map((t) => ({ t, amount: X, dir: "in" as const })),
            valuationTimes: [0],
          },
        ],
        markers: [j],
        presentation: ["frequency"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("A.nominal-equivalence", "Convert the annual effective rate to a monthly effective rate.", ["j", j, "monthly rate"], ["i"]),
            step("B.mthly-annuity", "Value 12n monthly payments at the monthly rate.", ["PV", PVv, "present value"], ["X", "j", "12n"]),
          ],
          {
            stages: {
              RATE_DIVIDED_EFFECTIVE: [0, "application"],
              RATE_PAYMENT_FREQUENCY: [1, "selection", "B.annuity-immediate"],
              TIMING_IMMEDIATE_AS_DUE: [1, "application"],
              SEQ_TERM_COUNT: [1, "application"],
              FORMULA_AV_FOR_PV: [1, "selection", "B.annuity-immediate-av"],
              SEQ_UNDISCOUNTED_SUM: [1, "application"],
            },
            reasoning: "Work on a monthly clock throughout: a level annuity of 12n payments at the equivalent monthly rate.",
          }
        ),
        params: { X, i, n },
      };
    }

    const d4 = gridRate(rng, 0.05, 0.1, 0.005);
    const PVv = gridAmount(rng, 50000, 300000, 5000);
    const i = Math.pow(1 - d4 / 4, -4) - 1;
    const j = Math.pow(1 + i, 1 / 12) - 1;
    const X = PVv / adue(12 * n, j);
    const jE = `((1-${lit(d4)}/4)**(-1/3)-1)`;
    const asInt = PVv / adue(12 * n, Math.pow(1 + d4 / 4, 1 / 3) - 1);
    const immediate = PVv / an(12 * n, j);
    const monthlyDiv = PVv / adue(12 * n, i / 12);
    const annualDue = PVv / (12 * adue(n, i));
    return {
      stem: `A loan of ${amt(PVv)} is repaid by level payments at the beginning of each month for ${n} years. Interest is at an annual nominal rate of discount of ${pc(d4)} convertible quarterly.\n\nCalculate the monthly payment.`,
      answer: {
        value: X,
        calc: `${lit(PVv)}/${adueExpr(12 * n, jE)}`,
        format: fmt,
        derivation: `$X = \\dfrac{${mamt(PVv)}}{${adueSym(12 * n)}}$ at $j = (1 - ${dec(d4 / 4, 5)})^{-1/3} - 1 = ${dec(j, 6)}$, so $X = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `${lit(PVv)} - ${sumOf(range(0, 12 * n - 1).map((t) => `x*(1-${lit(d4)}/4)**(${t}/3)`))}`,
        bracket: [0, PVv],
        description: "Each payment at month t is discounted by (1 − d⁽⁴⁾/4) per quarter, i.e. to the power t/3.",
      },
      distractors: [
        distractor("RATE_DISCOUNT_AS_INTEREST", asInt, `${lit(PVv)}/${adueExpr(12 * n, `((1+${lit(d4)}/4)**(1/3)-1)`)}`, {
          derivation: `monthly rate $(1 + ${dec(d4 / 4, 5)})^{1/3} - 1$: $X = ${shown(asInt, fmt)}$`,
          method: "Treated the discount rate as an interest rate.",
          feedback: "A quarterly discount rate means the quarterly discount factor is $1 - d^{(4)}/4$, so growth per quarter is its reciprocal.",
        }),
        distractor("TIMING_DUE_AS_IMMEDIATE", immediate, `${lit(PVv)}/${aExpr(12 * n, jE)}`, {
          derivation: `$${mamt(PVv)}/${aSym(12 * n)} = ${shown(immediate, fmt)}$`,
          method: "Valued the payments as end-of-month payments.",
          feedback: "Payments at the beginning of each month form an annuity-due.",
        }),
        distractor("RATE_DIVIDED_EFFECTIVE", monthlyDiv, `${lit(PVv)}/${adueExpr(12 * n, `(((1-${lit(d4)}/4)**(-4)-1)/12)`)}`, {
          derivation: `monthly rate $i/12$ with $i = ${dec(i, 6)}$: $X = ${shown(monthlyDiv, fmt)}$`,
          method: "Converted to an annual effective rate, then divided by 12.",
          feedback: "Dividing an effective rate by 12 overstates the monthly rate; take the 12th root instead.",
        }),
        distractor("FORMULA_AV_FOR_PV", PVv / sdue(12 * n, j), `${lit(PVv)}/${sdueExpr(12 * n, jE)}`, {
          derivation: `$${mamt(PVv)}/${sdueSym(12 * n)} = ${shown(PVv / sdue(12 * n, j), fmt)}$`,
          method: "Divided by the accumulated-value factor.",
          feedback: "The loan is a present value, so it is matched with ä, not s̈.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", PVv / (12 * n), `${lit(PVv)}/(12*${n})`, {
          derivation: `$${mamt(PVv)}/${12 * n} = ${shown(PVv / (12 * n), fmt)}$`,
          method: "Divided the loan by the number of payments, ignoring interest.",
          feedback: "The lender charges interest on the balance, so payments must exceed this.",
        }),
        distractor("RATE_PAYMENT_FREQUENCY", annualDue, `${lit(PVv)}/(12*${adueExpr(n, `((1-${lit(d4)}/4)**(-4)-1)`)})`, {
          derivation: `$\\dfrac{${mamt(PVv)}}{12\\,${adueSym(n)}} = ${shown(annualDue, fmt)}$`,
          method: "Found an annual payment and divided by 12.",
          feedback: "Monthly payments are spread through the year and repay the loan faster than one annual payment.",
        }),
      ],
      explanation: monthlyExplanation({ i, n, X, value: X, fmt, d4, PV: PVv }),
      visuals: [
        {
          kind: "timeline",
          title: "Monthly payments, quarterly discount",
          unit: "month",
          rate: j,
          flows: range(0, 23).map((t) => ({ t, amount: X, dir: "out" as const })),
          valuationTimes: [0],
        },
      ],
      markers: [j, i],
      presentation: ["frequency", "inverse", "combined-topics"],
      features: features({ steps: 3, formulaRetrieval: true, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Monthly rate equivalent to a quarterly discount rate.", ["j", j, "monthly effective rate"], ["d^{(4)}"]),
          step("B.annuity-due", "Monthly payments in advance: annuity-due.", ["ä_{12n}", adue(12 * n, j), "annuity-due factor"], ["j", "12n"]),
          step("D.loan-payment", "Loan = payment × factor; solve for the payment.", ["X", X, "monthly payment"], ["PV"], { rearranged: true }),
        ],
        {
          methods: ["rearrangement"],
          stages: {
            RATE_DISCOUNT_AS_INTEREST: [0, "selection"],
            TIMING_DUE_AS_IMMEDIATE: [1, "selection", "B.annuity-immediate"],
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            RATE_PAYMENT_FREQUENCY: [2, "selection"],
            FORMULA_AV_FOR_PV: [1, "selection", "B.annuity-due-av"],
            SEQ_UNDISCOUNTED_SUM: [2, "application"],
          },
          reasoning: "(1 − d/4) discounts one quarter, so one month discounts by its cube root; then it is a monthly loan.",
        }
      ),
      params: { PV: PVv, d4, n },
    };
  },
};

function monthlyExplanation(p: { i: number; n: number; X: number; value: number; fmt: AnswerFormat; d4?: number; PV?: number }) {
  const { i, n, value, fmt, d4, PV = 0 } = p;
  const j = Math.pow(1 + i, 1 / 12) - 1;
  return explanation({
    intuition: "The payments come every month, so the cleanest clock is a monthly one. Translate the quoted rate into the rate that one unit earns in a month, and the problem becomes an ordinary level annuity.",
    translation: {
      unknowns: d4 ? [{ symbol: "$X$", meaning: "the monthly payment" }] : [{ symbol: "$PV$", meaning: "the value of all payments today" }],
      relationships: d4
        ? [`$1 + j = (1 - d^{(4)}/4)^{-1/3}$`, `$${mamt(PV)} = X\\,${adueSym(12 * n)}$ at $j$`]
        : [`$1 + j = (1 + i)^{1/12}$`, `$PV = X\\,${aSym(12 * n)}$ at $j$`],
      conditions: [`${12 * n} monthly payments`],
      valuationDate: "Time 0.",
      modelChoice: "Convert the rate to the payment period, then use a level annuity.",
      assumptions: ["Rates convert by compounding, never by simple division unless the rate is nominal."],
    },
    solution: [
      { title: "Monthly rate", body: d4 ? `$j = (1 - ${dec(d4 / 4, 5)})^{-1/3} - 1 = ${dec(j, 6)}$` : `$j = (${dec(1 + i, 3)})^{1/12} - 1 = ${dec(j, 6)}$` },
      { title: "Annuity factor", body: d4 ? `$${adueSym(12 * n)} = ${dec(adue(12 * n, j), 5)}$` : `$${aSym(12 * n)} = ${dec(an(12 * n, j), 5)}$` },
      { title: d4 ? "Payment" : "Present value", body: `$${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Annual payment with an m-thly factor",
        body: `$12X\\,a^{(12)}_{\\overline{${n}|}}$ with $a^{(12)} = \\dfrac{1 - v^n}{i^{(12)}}$.`,
        whenUseful: "Fast if you remember the upper-m annuity symbols.",
      },
    ],
    transfer: {
      principle: "Always match the rate to the payment period first. Nominal rates divide by m; effective rates take an m-th root.",
      unusual: d4 ? "The rate is a quarterly discount rate but payments are monthly and in advance." : "The rate is effective annual but payments are monthly.",
      misread: "Dividing an effective annual rate by 12 is the most common slip.",
    },
  });
}

// ===================================================================== hidden structure in annuity values

const hiddenRatio: QuestionTemplate = {
  id: "ann-hidden-structure",
  family: "ann-identities",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.streams", "TVM.equation_of_value"],
  reasoning: ["formula_reconstruction", "algebra", "transfer", "concept_recognition"],
  soaConcept: "Relationships between annuity values of different terms used to recover the rate or extend the term.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const n = rng.int(5, 15);
    if (lvl === 2) {
      const A = Number(an(n, i).toFixed(4));
      const S = Number(sn(n, i).toFixed(4));
      const r = 1 / A - 1 / S;
      const fmt = PCT3;
      return {
        stem: `For a certain interest rate, the present value of an annuity-immediate of 1 per year for ${n} years is ${A}, and the accumulated value of the same annuity at the time of the last payment is ${S}.\n\nCalculate the annual effective interest rate.`,
        answer: {
          value: r,
          calc: `1/${lit(A)} - 1/${lit(S)}`,
          format: fmt,
          derivation: `$i = \\dfrac{1}{${A}} - \\dfrac{1}{${S}} = ${shown(r, fmt)}$`,
        },
        model: {
          expr: `(1+x)**${n} - ${lit(S)}/${lit(A)}`,
          bracket: [0.001, 0.3],
          description: `Since s = (1 + i)^${n}·a, the ratio of the two values is the ${n}-year accumulation factor.`,
        },
        distractors: [
          distractor("ALG_SIGN_ERROR", 1 / A + 1 / S, `1/${lit(A)} + 1/${lit(S)}`, {
            derivation: `$\\dfrac{1}{${A}} + \\dfrac{1}{${S}} = ${shown(1 / A + 1 / S, fmt)}$`,
            method: "Added the reciprocals.",
            feedback: "$1/a_{\\overline{n|}} = i + 1/s_{\\overline{n|}}$, so i is the difference.",
          }),
          distractor("VAR_TOTAL_FOR_COMPONENT", S / A - 1, `${lit(S)}/${lit(A)} - 1`, {
            derivation: `$${S}/${A} - 1 = ${shown(S / A - 1, fmt)}$`,
            method: `Reported the ${n}-year growth rate as the annual rate.`,
            feedback: `$S/A = (1+i)^{${n}}$: take the ${ord(n)} root to get the annual rate.`,
          }),
          distractor("FORMULA_PERPETUITY_FOR_FINITE", 1 / A, `1/${lit(A)}`, {
            derivation: `$1/${A} = ${shown(1 / A, fmt)}$`,
            method: "Treated the annuity value like a perpetuity value, i = 1/a.",
            feedback: "Only a perpetuity has value 1/i. A finite annuity is worth less, so 1/a overstates i.",
          }),
          distractor("ALG_ROOT_ERROR", Math.pow(S / A, 1 / (n - 1)) - 1, `(${lit(S)}/${lit(A)})**(1/${n - 1})-1`, {
            derivation: `$(${S}/${A})^{1/${n - 1}} - 1 = ${shown(Math.pow(S / A, 1 / (n - 1)) - 1, fmt)}$`,
            method: `Took the ${ord(n - 1)} root.`,
            feedback: `$s_{\\overline{${n}|}} = (1+i)^{${n}}a_{\\overline{${n}|}}$: the two values are ${n} years apart.`,
          }),
        ],
        explanation: explanation({
          intuition: "The present value and the accumulated value describe the same payments seen from two dates n years apart. So their ratio is pure interest: (1 + i)^n.",
          translation: {
            unknowns: [{ symbol: "$i$", meaning: "the annual effective rate" }],
            relationships: [`$s_{\\overline{n|}} = (1+i)^n a_{\\overline{n|}}$`, "$\\dfrac{1}{a_{\\overline{n|}}} = \\dfrac{1}{s_{\\overline{n|}}} + i$"],
            conditions: [`$a = ${A}$, $s = ${S}$`],
            valuationDate: `Times 0 and ${n}.`,
            modelChoice: "Use an identity linking a and s rather than solving for i numerically.",
            assumptions: ["Level payments at the end of each year."],
          },
          solution: [
            { title: "Identity", body: "$\\dfrac{1}{a_{\\overline{n|}}} - \\dfrac{1}{s_{\\overline{n|}}} = \\dfrac{i}{1 - v^n} - \\dfrac{iv^n}{1 - v^n} = i$" },
            { title: "Substitute", body: `$i = ${dec(1 / A, 6)} - ${dec(1 / S, 6)}$` },
            { title: "Result", body: `$i = ${shown(r, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Ratio and root",
              body: `$(1+i)^{${n}} = ${S}/${A} = ${dec(S / A, 6)}$, so $i = ${dec(S / A, 6)}^{1/${n}} - 1$.`,
              whenUseful: "Equally valid; needs a root rather than two reciprocals.",
            },
          ],
          transfer: {
            principle: "a and s of the same annuity differ only by n years of interest; their reciprocals differ by exactly i (the sinking-fund identity).",
            unusual: "No cash flows are described — only two factor values.",
            misread: "The ratio gives n years of growth, not one.",
          },
        }),
        visuals: [
          {
            kind: "timeline",
            title: "Same payments, two valuation dates",
            unit: "year",
            rate: i,
            flows: range(1, n).map((t) => ({ t, amount: 1, dir: "in" as const })),
            valuationTimes: [0, n],
          },
        ],
        markers: [S / A],
        presentation: ["hidden-structure", "unknown-rate"],
        features: features({ steps: 2, unfamiliar: true, formulaRetrieval: true }),
        chain: chain(
          [step("B.reciprocal-identity", "1/a − 1/s = i links the two given values to the rate.", ["i", r, "effective rate"], ["a_n", "s_n"], { derived: true })],
          {
            stages: {
              ALG_SIGN_ERROR: [0, "application"],
              VAR_TOTAL_FOR_COMPONENT: [0, "interpretation"],
              FORMULA_PERPETUITY_FOR_FINITE: [0, "selection", "B.perpetuity"],
              ALG_ROOT_ERROR: [0, "application"],
            },
            reasoning: "s = (1 + i)ⁿ a, so S/A is n years of growth: take the n-th root.",
          }
        ),
        params: { n, A, S },
      };
    }

    const A = Number(an(n, i).toFixed(4));
    const B = Number(an(2 * n, i).toFixed(4));
    const w = B / A - 1;
    const C = A * (1 + w + w * w);
    const fmt: AnswerFormat = { kind: "number", decimals: 3 };
    return {
      stem: `At a certain interest rate, the present value of an annuity-immediate of 1 per year for ${n} years is ${A}, and the present value of an annuity-immediate of 1 per year for ${2 * n} years is ${B}.\n\nCalculate the present value, at the same rate, of an annuity-immediate of 1 per year for ${3 * n} years.`,
      answer: {
        value: C,
        calc: `${lit(A)}*(1 + (${lit(B)}/${lit(A)}-1) + (${lit(B)}/${lit(A)}-1)**2)`,
        format: fmt,
        derivation: `$a_{\\overline{${3 * n}|}} = a_{\\overline{${n}|}}(1 + v^{${n}} + v^{${2 * n}}) = ${A}(1 + ${dec(w, 5)} + ${dec(w * w, 5)}) = ${shown(C, fmt)}$`,
      },
      model: {
        expr: `${lit(B)} + (${lit(B)} - ${lit(A)})**2/${lit(A)}`,
        description: `The third block of ${n} payments is the second block discounted a further ${n} years: (B − A)·v^${n}, with v^${n} = (B − A)/A.`,
      },
      distractors: [
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", 2 * B - A, `2*${lit(B)} - ${lit(A)}`, {
          derivation: `$${B} + (${B} - ${A}) = ${shown(2 * B - A, fmt)}$`,
          method: "Assumed each extra block of payments adds the same value.",
          feedback: `Each block is further away, so it is worth $v^{${n}}$ times the previous block — a geometric, not arithmetic, pattern.`,
        }),
        distractor("TIMING_IGNORED_DEFERRAL", 3 * A, `3*${lit(A)}`, {
          derivation: `$3 \\times ${A} = ${shown(3 * A, fmt)}$`,
          method: "Valued each block as if it started now.",
          feedback: `The second and third blocks start after ${n} and ${2 * n} years and must be discounted.`,
        }),
        distractor("ALG_SIGN_ERROR", A * (1 + B / A + (B / A) ** 2), `${lit(A)}*(1 + ${lit(B)}/${lit(A)} + (${lit(B)}/${lit(A)})**2)`, {
          derivation: `$v^{${n}} = ${B}/${A}$: $${A}(1 + ${dec(B / A, 4)} + ${dec((B / A) ** 2, 4)}) = ${shown(A * (1 + B / A + (B / A) ** 2), fmt)}$`,
          method: `Took $v^{${n}} = B/A$, forgetting to subtract 1.`,
          feedback: `$a_{\\overline{${2 * n}|}} = a_{\\overline{${n}|}}(1 + v^{${n}})$, so $v^{${n}} = B/A - 1$; a discount factor must be below 1.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", A * (1 + w + w * w * w), `${lit(A)}*(1 + (${lit(B)}/${lit(A)}-1) + (${lit(B)}/${lit(A)}-1)**3)`, {
          derivation: `$${A}(1 + v^{${n}} + v^{${3 * n}}) = ${shown(A * (1 + w + w * w * w), fmt)}$`,
          method: `Discounted the third block by $v^{${3 * n}}$.`,
          feedback: `The third block starts after ${2 * n} years; its value at time ${2 * n} is $a_{\\overline{${n}|}}$, discounted by $v^{${2 * n}}$.`,
        }),
      ],
      explanation: explanation({
        intuition: `Split ${3 * n} years of payments into three blocks of ${n}. Each block looks identical from its own start date; the only difference is how far away that start date is. So the blocks are worth $a$, $a v^{${n}}$, $a v^{${2 * n}}$ — and the first two values reveal $v^{${n}}$ without ever finding i.`,
        translation: {
          unknowns: [{ symbol: `$w = v^{${n}}$`, meaning: `the ${n}-year discount factor` }],
          relationships: [`$a_{\\overline{${2 * n}|}} = a_{\\overline{${n}|}}(1 + w)$`, `$a_{\\overline{${3 * n}|}} = a_{\\overline{${n}|}}(1 + w + w^2)$`],
          conditions: [`$a_{\\overline{${n}|}} = ${A}$, $a_{\\overline{${2 * n}|}} = ${B}$`],
          valuationDate: "Time 0, with blocks starting at 0, n and 2n.",
          modelChoice: "Block decomposition; the interest rate is never needed.",
          assumptions: ["The same rate applies throughout."],
        },
        solution: [
          { title: "Block factor", body: `$w = ${B}/${A} - 1 = ${dec(w, 6)}$` },
          { title: "Three blocks", body: `$1 + w + w^2 = ${dec(1 + w + w * w, 6)}$` },
          { title: "Result", body: `$a_{\\overline{${3 * n}|}} = ${A} \\times ${dec(1 + w + w * w, 6)} = ${shown(C, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Solve for i first",
            body: `$v^{${n}} = ${dec(w, 6)}$ gives $i = ${dec(Math.pow(w, -1 / n) - 1, 6)}$; then compute $a_{\\overline{${3 * n}|}}$ directly.`,
            whenUseful: "Works but is longer and invites rounding error.",
          },
          {
            name: "Last block from the previous difference",
            body: `$a_{\\overline{${3 * n}|}} = B + (B - A)w$`,
            whenUseful: "Shortest route once the geometric pattern of blocks is seen.",
          },
        ],
        transfer: {
          principle: "Long annuities decompose into blocks; each block is the first block times a power of the block discount factor.",
          unusual: "The interest rate is never stated and never needed.",
          misread: "It is natural to assume each block adds the same value.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Three blocks, each worth less",
          unit: "year",
          series: [{ label: "PV of each payment", values: range(1, 3 * n).map((t) => ({ t, amount: v(i, t) })) }],
          caption: `Block values: ${A}, ${dec(A * w, 4)}, ${dec(A * w * w, 4)}.`,
        },
      ],
      markers: [w, 1 + w + w * w],
      presentation: ["hidden-structure", "indirect-wording"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("B.grouping", "a_{2n} = a_n(1 + vⁿ) reveals the block discount factor.", ["vⁿ", w, "n-year discount factor"], ["a_n", "a_{2n}"], { rearranged: true }),
          step("B.geometric-series", "Three blocks: a_n(1 + vⁿ + v^{2n}).", ["1+w+w²", 1 + w + w * w, "block multiplier"], ["w"]),
          step("B.grouping", "Apply the multiplier to the first block.", ["a_{3n}", C, "value of 3n payments"], ["a_n"]),
        ],
        {
          methods: ["geometric_series", "decomposition"],
          unconventional: true,
          stages: {
            SEQ_GEOMETRIC_AS_ARITHMETIC: [1, "selection", "M.arithmetic-series"],
            TIMING_IGNORED_DEFERRAL: [1, "application"],
            ALG_SIGN_ERROR: [0, "application"],
            TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
          },
          reasoning: "Each later block is the first block seen from a later date: multiply by vⁿ each time. The rate is never needed.",
        }
      ),
      params: { n, A, B },
    };
  },
};

// ===================================================================== deposits then withdrawals

const depositsWithdrawals: QuestionTemplate = {
  id: "ann-deposit-withdraw",
  family: "ann-phases",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.frequency_timing", "ANNUITIES.immediate_due"],
  reasoning: ["valuation_dates", "cashflow_modelling", "multistep", "formula_selection"],
  soaConcept: "Accumulation phase followed by a level withdrawal phase that exhausts the fund.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n1 = rng.int(10, 25);
    const n2 = rng.int(10, 25);
    const D = gridAmount(rng, lvl === 1 ? 2000 : 200, lvl === 1 ? 10000 : 1500, lvl === 1 ? 250 : 50);
    const fmt = MONEY2;
    const gap = lvl === 3 ? rng.int(2, 5) : 0;
    const m = lvl === 1 ? 1 : 12;
    const j = Math.pow(1 + i, 1 / m) - 1;
    const jE = m === 1 ? lit(i) : `((1+${lit(i)})**(1/12)-1)`;
    const N1 = m * n1;
    const N2 = m * n2;
    const G = m * gap;
    const W = (D * sn(N1, j) * acc(j, G)) / an(N2, j);
    const unit = m === 1 ? "year" : "month";
    const growE = gap ? `*(1+${jE})**${G}` : "";
    const due = (D * sn(N1, j) * acc(j, G)) / adue(N2, j);
    const pvDeposits = (D * an(N1, j) * acc(j, G)) / an(N2, j);
    const atEnd = (D * sn(N1, j) * acc(j, G)) / sn(N2, j);
    const sdueDeposits = (D * sdue(N1, j) * acc(j, G)) / an(N2, j);
    const divided = m === 12 ? (D * sn(N1, i / 12) * acc(i / 12, G)) / an(N2, i / 12) : NaN;
    const noGap = gap ? (D * sn(N1, j)) / an(N2, j) : NaN;
    const gapShort = gap ? (D * sn(N1, j) * acc(j, G - m)) / an(N2, j) : NaN;
    const stem =
      lvl === 1
        ? `Deposits of ${amt(D)} are made into a fund at the end of each year for ${n1} years. Starting one year after the last deposit, level withdrawals are made at the end of each year for ${n2} years, exhausting the fund. The fund earns an annual effective interest rate of ${pc(i)}.\n\nCalculate the amount of each withdrawal.`
        : lvl === 2
          ? `Deposits of ${amt(D)} are made into a fund at the end of each month for ${n1} years. Starting one month after the last deposit, level withdrawals are made at the end of each month for ${n2} years, exhausting the fund. The fund earns an annual effective interest rate of ${pc(i)}.\n\nCalculate the amount of each monthly withdrawal.`
          : `Deposits of ${amt(D)} are made into a fund at the end of each month for ${n1} years. No deposits or withdrawals are then made for ${word(gap)} years. Monthly withdrawals then begin one month after the end of that ${word(gap)}-year period and continue at the end of each month for ${n2} years, exhausting the fund. The fund earns an annual effective interest rate of ${pc(i)}.\n\nCalculate the amount of each monthly withdrawal.`;
    const distractors = [
      distractor("TIMING_IMMEDIATE_AS_DUE", due, `${lit(D)}*${sExpr(N1, jE)}${growE}/${adueExpr(N2, jE)}`, {
        derivation: `$\\dfrac{${D}\\,${sSym(N1)}${gap ? `(1+j)^{${G}}` : ""}}{${adueSym(N2)}} = ${shown(due, fmt)}$`,
        method: "Valued the withdrawals as an annuity-due at the changeover date.",
        feedback: `The first withdrawal is one ${unit} after the changeover date, so the withdrawals form an annuity-immediate valued there.`,
      }),
      distractor("FORMULA_AV_FOR_PV", pvDeposits, `${lit(D)}*${aExpr(N1, jE)}${growE}/${aExpr(N2, jE)}`, {
        derivation: `$\\dfrac{${D}\\,${aSym(N1)}${gap ? `(1+j)^{${G}}` : ""}}{${aSym(N2)}} = ${shown(pvDeposits, fmt)}$`,
        method: "Used the present value of the deposits instead of their accumulated value.",
        feedback: "At the changeover date the fund holds the accumulated deposits, $s$, not their value at time 0.",
      }),
      distractor("TIMING_VALUATION_DATE", atEnd, `${lit(D)}*${sExpr(N1, jE)}${growE}/${sExpr(N2, jE)}`, {
        derivation: `$\\dfrac{${D}\\,${sSym(N1)}${gap ? `(1+j)^{${G}}` : ""}}{${sSym(N2)}} = ${shown(atEnd, fmt)}$`,
        method: "Valued the withdrawals at the date of the last withdrawal.",
        feedback: "Both sides of the equation must be at the same date: the deposits' value sits at the changeover, so the withdrawals need $a$ there.",
      }),
      distractor("TIMING_DUE_AS_IMMEDIATE", sdueDeposits, `${lit(D)}*${sdueExpr(N1, jE)}${growE}/${aExpr(N2, jE)}`, {
        derivation: `$\\dfrac{${D}\\,${sdueSym(N1)}${gap ? `(1+j)^{${G}}` : ""}}{${aSym(N2)}} = ${shown(sdueDeposits, fmt)}$`,
        method: "Accumulated the deposits as an annuity-due.",
        feedback: `Deposits are at the end of each ${unit}; the last earns no interest by the changeover date.`,
      }),
      distractor("SEQ_UNDISCOUNTED_SUM", (D * N1) / N2, `${lit(D)}*${N1}/${N2}`, {
        derivation: `$${D} \\times ${N1} / ${N2} = ${shown((D * N1) / N2, fmt)}$`,
        method: "Shared the total deposits among the withdrawals, ignoring interest.",
        feedback: "The fund earns interest throughout, so withdrawals can be larger than this.",
      }),
    ];
    if (m === 12) {
      distractors.unshift(
        distractor("RATE_DIVIDED_EFFECTIVE", divided, `${lit(D)}*${sExpr(N1, `(${lit(i)}/12)`)}${gap ? `*(1+${lit(i)}/12)**${G}` : ""}/${aExpr(N2, `(${lit(i)}/12)`)}`, {
          derivation: `monthly rate $${dec(i, 3)}/12$: $${shown(divided, fmt)}$`,
          method: "Divided the annual effective rate by 12.",
          feedback: "The monthly rate equivalent to an annual effective rate is its 12th root, minus 1.",
        })
      );
    }
    if (gap) {
      distractors.unshift(
        distractor("TIMING_IGNORED_DEFERRAL", noGap, `${lit(D)}*${sExpr(N1, jE)}/${aExpr(N2, jE)}`, {
          derivation: `$\\dfrac{${D}\\,${sSym(N1)}}{${aSym(N2)}} = ${shown(noGap, fmt)}$`,
          method: "Ignored the growth during the waiting period.",
          feedback: `The fund keeps earning interest for the ${gap} quiet years.`,
        }),
        distractor("TIMING_MISSING_PERIOD", gapShort, `${lit(D)}*${sExpr(N1, jE)}*(1+${jE})**${G - m}/${aExpr(N2, jE)}`, {
          derivation: `$\\dfrac{${D}\\,${sSym(N1)}(1+j)^{${G - m}}}{${aSym(N2)}} = ${shown(gapShort, fmt)}$`,
          method: `Grew the fund for ${gap - 1} quiet years.`,
          feedback: `The quiet period lasts ${gap} full years (${G} months).`,
        })
      );
    }
    return {
      stem,
      answer: {
        value: W,
        calc: `${lit(D)}*${sExpr(N1, jE)}${growE}/${aExpr(N2, jE)}`,
        format: fmt,
        derivation: `$W = \\dfrac{${D}\\,${sSym(N1)}${gap ? `(1+j)^{${G}}` : ""}}{${aSym(N2)}} = ${shown(W, fmt)}$`,
      },
      model: {
        expr: `${pvTerms(level(D, range(1, N1)), jE)} - ${pvTerms(level("x", range(N1 + G + 1, N1 + G + N2)), jE)}`,
        bracket: [0, D * 50],
        description: "At time 0, the PV of every deposit equals the PV of every withdrawal (each written out).",
      },
      distractors,
      explanation: explanation({
        intuition: `The fund is a bridge between two annuities. The deposits fill it up to a single balance at the changeover date${gap ? ", the balance grows while nothing happens" : ""}, and then the withdrawals drain exactly that balance. The changeover date is where both halves meet.`,
        translation: {
          unknowns: [{ symbol: "$W$", meaning: `each ${unit === "year" ? "annual" : "monthly"} withdrawal` }],
          relationships: [
            `$\\text{balance} = ${D}\\,${sSym(N1)}${gap ? `(1+j)^{${G}}` : ""}$`,
            `$\\text{balance} = W\\,${aSym(N2)}$`,
          ],
          conditions: [`${N1} deposits, ${N2} withdrawals`, "The fund is exhausted by the last withdrawal."],
          valuationDate: gap ? `The date ${gap} years after the last deposit, one ${unit} before the first withdrawal.` : `The last deposit date, one ${unit} before the first withdrawal.`,
          modelChoice: "Accumulate the deposits to the changeover date; value the withdrawals there with a.",
          assumptions: [m === 12 ? `Monthly rate $j = (1+i)^{1/12} - 1 = ${dec(j, 6)}$.` : `Annual rate ${pc(i)}.`, "No other cash flows."],
        },
        solution: [
          ...(m === 12 ? [{ title: "Monthly rate", body: `$j = (${dec(1 + i, 3)})^{1/12} - 1 = ${dec(j, 6)}$` }] : []),
          { title: "Fund at changeover", body: `$${D}\\,${sSym(N1)}${gap ? `(1+j)^{${G}}` : ""} = ${mnum(D * sn(N1, j) * acc(j, G), 2)}$` },
          { title: "Withdrawal", body: `$W = ${mnum(D * sn(N1, j) * acc(j, G), 2)} / ${dec(an(N2, j), 5)} = ${shown(W, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Equation of value at time 0",
            body: `$${D}\\,${aSym(N1)} = W\\,v^{${N1 + G}}\\,${aSym(N2)}$`,
            whenUseful: "Any date works; time 0 shows clearly that both streams are just cash flows.",
          },
        ],
        transfer: {
          principle: "Two-phase problems meet at a single changeover date: accumulate the first phase to it, value the second phase from it.",
          unusual: gap ? "A quiet period separates the phases." : m === 12 ? "Monthly payments with an effective annual rate." : "The withdrawals start one period after the deposits stop.",
          misread: "Using a for the deposits or s for the withdrawals puts the two sides at different dates.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Deposits, then withdrawals",
          unit: m === 1 ? "year" : "month",
          rate: j,
          flows: [
            ...range(1, Math.min(N1, 36)).map((t) => ({ t, amount: D, dir: "out" as const, group: "deposits" })),
            ...range(N1 + G + 1, N1 + G + Math.min(N2, 36)).map((t) => ({ t, amount: W, dir: "in" as const, group: "withdrawals" })),
          ],
          valuationTimes: [N1 + G, 0],
          caption: N1 > 36 || N2 > 36 ? "Only the first 36 payments of each phase are drawn." : undefined,
        },
      ],
      markers: [D * sn(N1, j), an(N2, j), j],
      presentation: gap ? ["frequency", "deferred", "mixed-timing"] : m === 12 ? ["frequency", "mixed-timing"] : ["mixed-timing"],
      features: features({ steps: m === 12 ? 3 : 2, multipleValuationDates: true, formulaRetrieval: m === 12, multiConcept: gap > 0 }),
      chain: (() => {
        const steps = [
          ...(m === 12 ? [step("A.nominal-equivalence", "Monthly payments need the monthly effective rate.", ["j", j, "monthly rate"], ["i"])] : []),
          step("B.annuity-immediate-av", "Accumulate the deposits to the last deposit date.", ["D s_{N1}", D * sn(N1, j), "fund at the end of the deposits"], ["D", "j"], { valuationDate: "last deposit" }),
          ...(gap ? [step("A.compound", "The fund keeps growing through the quiet years.", ["fund at changeover", D * sn(N1, j) * acc(j, G), "fund one period before the first withdrawal"], ["gap"], { valuationDate: "changeover" })] : []),
          step("D.loan-payment", "The fund is a loan repaid by the withdrawals: W = fund / a.", ["W", W, "withdrawal"], ["fund"], { rearranged: true }),
        ];
        const last = steps.length - 1;
        const sIndex = m === 12 ? 1 : 0;
        return chain(steps, {
          methods: ["valuation_dates", "rearrangement"],
          unconventional: Boolean(gap),
          stages: {
            TIMING_IMMEDIATE_AS_DUE: [last, "selection", "B.annuity-due"],
            FORMULA_AV_FOR_PV: [sIndex, "selection", "B.annuity-immediate"],
            TIMING_VALUATION_DATE: [last, "connection"],
            TIMING_DUE_AS_IMMEDIATE: [sIndex, "selection", "B.annuity-due-av"],
            SEQ_UNDISCOUNTED_SUM: [last, "application"],
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            TIMING_IGNORED_DEFERRAL: [gap ? sIndex + 1 : last, "connection"],
            TIMING_MISSING_PERIOD: [gap ? sIndex + 1 : last, "application"],
          },
          reasoning: "Equation of value at time 0: PV of every deposit = PV of every withdrawal, each written as a deferred annuity.",
        });
      })(),
      params: { D, i, n1, n2, gap, m },
    };
  },
};

// ===================================================================== annuity-due accumulated past the last deposit

const dueAccumulation: QuestionTemplate = {
  id: "ann-due-accumulation",
  family: "ann-level",
  topic: "ANNUITIES",
  levels: [1, 2],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.frequency_timing", "TVM.present_future_value"],
  reasoning: ["valuation_dates", "cashflow_modelling", "formula_selection"],
  soaConcept: "Accumulated value of an annuity-due measured after the last deposit.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 20);
    const mExtra = rng.int(2, 8);
    const fmt = MONEY0;
    if (lvl === 1) {
      const D = gridAmount(rng, 1000, 8000, 250);
      const AV = D * sdue(n, i) * acc(i, mExtra);
      return {
        stem: `Deposits of ${amt(D)} are made at the beginning of each year for ${n} years into a fund earning an annual effective interest rate of ${pc(i)}. No further deposits are made.\n\nCalculate the value of the fund ${word(mExtra)} years after the end of the deposit period.`,
        answer: {
          value: AV,
          calc: `${lit(D)}*${sdueExpr(n, i)}*${onePlus(i)}**${mExtra}`,
          format: fmt,
          derivation: `$${D}\\,${sdueSym(n)}(1+i)^{${mExtra}} = ${shown(AV, fmt)}$`,
        },
        model: {
          expr: sumOf(range(0, n - 1).map((t) => `${lit(D)}*${onePlus(i)}**${n + mExtra - t}`)),
          description: `Deposit at time t grows for ${n + mExtra} − t years to time ${n + mExtra}.`,
        },
        distractors: [
          distractor("TIMING_DUE_AS_IMMEDIATE", D * sn(n, i) * acc(i, mExtra), `${lit(D)}*${sExpr(n, i)}*${onePlus(i)}**${mExtra}`, {
            derivation: `$${D}\\,${sSym(n)}(1+i)^{${mExtra}} = ${shown(D * sn(n, i) * acc(i, mExtra), fmt)}$`,
            method: "Accumulated the deposits as an annuity-immediate.",
            feedback: "Deposits at the beginning of each year earn one more year of interest each: use s̈, which is s times (1 + i).",
          }),
          distractor("TIMING_MISSING_PERIOD", D * sdue(n, i) * acc(i, mExtra - 1), `${lit(D)}*${sdueExpr(n, i)}*${onePlus(i)}**${mExtra - 1}`, {
            derivation: `$${D}\\,${sdueSym(n)}(1+i)^{${mExtra - 1}} = ${shown(D * sdue(n, i) * acc(i, mExtra - 1), fmt)}$`,
            method: `Accumulated for ${mExtra - 1} extra years after s̈.`,
            feedback: `s̈ values the deposits at time ${n} — the end of the deposit period, one year after the last deposit. From there, ${mExtra} more years remain.`,
          }),
          distractor("FORMULA_AV_FOR_PV", D * adue(n, i) * acc(i, mExtra), `${lit(D)}*${adueExpr(n, i)}*${onePlus(i)}**${mExtra}`, {
            derivation: `$${D}\\,${adueSym(n)}(1+i)^{${mExtra}} = ${shown(D * adue(n, i) * acc(i, mExtra), fmt)}$`,
            method: "Used the present-value factor ä.",
            feedback: `ä values the deposits at time 0; to reach time ${n + mExtra} that value would need ${n + mExtra} years of interest.`,
          }),
          distractor("TIMING_IGNORED_DEFERRAL", D * sdue(n, i), `${lit(D)}*${sdueExpr(n, i)}`, {
            derivation: `$${D}\\,${sdueSym(n)} = ${shown(D * sdue(n, i), fmt)}$`,
            method: "Stopped at the end of the deposit period.",
            feedback: `The fund keeps growing for another ${mExtra} years.`,
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", D * n * acc(i, mExtra), `${lit(D)}*${n}*${onePlus(i)}**${mExtra}`, {
            derivation: `$${n} \\times ${D}(1+i)^{${mExtra}} = ${shown(D * n * acc(i, mExtra), fmt)}$`,
            method: "Added the deposits without interest during the deposit period.",
            feedback: "Every deposit earns interest from its own date.",
          }),
        ],
        explanation: dueExplanation({ i, n, mExtra, value: AV, fmt, D }),
        visuals: [
          {
            kind: "timeline",
            title: "Where s̈ leaves its value",
            unit: "year",
            rate: i,
            flows: range(0, n - 1).map((t) => ({ t, amount: D, dir: "out" as const, label: "D" })),
            valuationTimes: [n, n + mExtra],
            caption: `s̈ lands at time ${n}, one year after the last deposit; then ${mExtra} more years.`,
          },
        ],
        markers: [sdue(n, i), D * sdue(n, i)],
        presentation: ["valuation-date"],
        features: features({ steps: 2, multipleValuationDates: true }),
        chain: chain(
          [
            step("B.annuity-due-av", "Deposits in advance accumulate with s̈, landing one year after the last deposit.", ["D s̈_n", D * sdue(n, i), "fund at the end of the deposit period"], ["D", "n", "i"], { valuationDate: "n" }),
            step("A.compound", "Grow that single amount for the extra years.", ["AV", AV, "fund at the valuation date"], ["m"], { valuationDate: "n + m" }),
          ],
          {
            methods: ["valuation_dates"],
            stages: {
              TIMING_DUE_AS_IMMEDIATE: [0, "selection", "B.annuity-immediate-av"],
              TIMING_MISSING_PERIOD: [1, "connection"],
              FORMULA_AV_FOR_PV: [0, "selection", "B.annuity-due"],
              TIMING_IGNORED_DEFERRAL: [1, "connection"],
              SEQ_UNDISCOUNTED_SUM: [0, "application"],
            },
            reasoning: "Each deposit at time t grows to (1 + i)^{n+m−t}; sum the geometric series directly.",
          }
        ),
        params: { D, i, n, mExtra },
      };
    }

    const T = gridAmount(rng, 50000, 400000, 5000);
    const jq = Math.pow(1 + i, 0.25) - 1;
    const N = 4 * n;
    const D = T / (sdue(N, jq) * acc(i, mExtra));
    const jE = `((1+${lit(i)})**0.25-1)`;
    return {
      stem: `Level deposits are made at the beginning of each quarter for ${n} years into a fund earning an annual effective interest rate of ${pc(i)}. ${word(mExtra).replace(/^./, (c) => c.toUpperCase())} years after the end of the deposit period, the fund is worth ${amt(T)}.\n\nCalculate the amount of each quarterly deposit.`,
      answer: {
        value: D,
        calc: `${lit(T)}/(${sdueExpr(N, jE)}*(1+${lit(i)})**${mExtra})`,
        format: MONEY2,
        derivation: `$D = \\dfrac{${mamt(T)}}{${sdueSym(N)}\\,(1+i)^{${mExtra}}} = ${shown(D, MONEY2)}$`,
      },
      model: {
        expr: `${lit(T)} - ${sumOf(range(0, N - 1).map((q) => `x*(1+${lit(i)})**(${n + mExtra} - ${q}/4)`))}`,
        bracket: [0, T],
        description: "Each quarterly deposit at time q/4 grows to the valuation date at the annual rate.",
      },
      distractors: [
        distractor("TIMING_DUE_AS_IMMEDIATE", T / (sn(N, jq) * acc(i, mExtra)), `${lit(T)}/(${sExpr(N, jE)}*(1+${lit(i)})**${mExtra})`, {
          derivation: `$\\dfrac{${mamt(T)}}{${sSym(N)}(1+i)^{${mExtra}}} = ${shown(T / (sn(N, jq) * acc(i, mExtra)), MONEY2)}$`,
          method: "Accumulated as an annuity-immediate.",
          feedback: "Deposits at the beginning of each quarter earn an extra quarter of interest.",
        }),
        distractor("RATE_DIVIDED_EFFECTIVE", T / (sdue(N, i / 4) * acc(i, mExtra)), `${lit(T)}/(${sdueExpr(N, `(${lit(i)}/4)`)}*(1+${lit(i)})**${mExtra})`, {
          derivation: `quarterly rate $${dec(i, 3)}/4$: $${shown(T / (sdue(N, i / 4) * acc(i, mExtra)), MONEY2)}$`,
          method: "Divided the annual effective rate by 4.",
          feedback: "Take the fourth root of 1 + i to get the quarterly rate.",
        }),
        distractor("TIMING_MISSING_PERIOD", T / (sdue(N, jq) * acc(i, mExtra - 1)), `${lit(T)}/(${sdueExpr(N, jE)}*(1+${lit(i)})**${mExtra - 1})`, {
          derivation: `$\\dfrac{${mamt(T)}}{${sdueSym(N)}(1+i)^{${mExtra - 1}}} = ${shown(T / (sdue(N, jq) * acc(i, mExtra - 1)), MONEY2)}$`,
          method: `Accumulated ${mExtra - 1} years after the deposit period.`,
          feedback: `The valuation date is ${mExtra} years after the deposit period ends.`,
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", T / (N * acc(i, mExtra)), `${lit(T)}/(${N}*(1+${lit(i)})**${mExtra})`, {
          derivation: `$\\dfrac{${mamt(T)}}{${N}(1+i)^{${mExtra}}} = ${shown(T / (N * acc(i, mExtra)), MONEY2)}$`,
          method: "Ignored interest during the deposit period.",
          feedback: "Every deposit earns interest from its own date, so fewer dollars need to be deposited.",
        }),
        distractor("FORMULA_AV_FOR_PV", T / (adue(N, jq) * acc(i, mExtra)), `${lit(T)}/(${adueExpr(N, jE)}*(1+${lit(i)})**${mExtra})`, {
          derivation: `$\\dfrac{${mamt(T)}}{${adueSym(N)}(1+i)^{${mExtra}}} = ${shown(T / (adue(N, jq) * acc(i, mExtra)), MONEY2)}$`,
          method: "Used the present-value factor ä.",
          feedback: "ä values the deposits at time 0; the fund's value at the end of the deposits needs s̈.",
        }),
        distractor("RATE_PAYMENT_FREQUENCY", T / (4 * sdue(n, i) * acc(i, mExtra)), `${lit(T)}/(4*${sdueExpr(n, i)}*(1+${lit(i)})**${mExtra})`, {
          derivation: `$\\dfrac{${mamt(T)}}{4\\,${sdueSym(n)}(1+i)^{${mExtra}}} = ${shown(T / (4 * sdue(n, i) * acc(i, mExtra)), MONEY2)}$`,
          method: "Treated each year's four deposits as one deposit at the start of the year.",
          feedback: "Three of each year's deposits are made later in the year and earn less interest.",
        }),
      ],
      explanation: dueExplanation({ i, n, mExtra, value: D, fmt: MONEY2, quarterly: true, T }),
      visuals: [
        {
          kind: "timeline",
          title: "Quarterly deposits in advance",
          unit: "quarter",
          rate: jq,
          flows: range(0, Math.min(N, 24) - 1).map((t) => ({ t, amount: D, dir: "out" as const })),
          valuationTimes: [N, N + 4 * mExtra],
        },
      ],
      markers: [jq, sdue(N, jq)],
      presentation: ["valuation-date", "frequency", "inverse"],
      features: features({ steps: 3, multipleValuationDates: true, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Quarterly deposits need the quarterly effective rate.", ["j", jq, "quarterly rate"], ["i"]),
          step("B.annuity-due-av", "Quarterly deposits in advance accumulate with s̈.", ["s̈_N", sdue(N, jq), "factor at the end of the deposits"], ["j", "N"]),
          step("A.compound", "Further growth to the valuation date.", ["(1+i)^m", acc(i, mExtra), "extra growth"], ["m"]),
          step("A.equation-of-value", "Target = D × s̈ × growth; solve for D.", ["D", D, "quarterly deposit"], ["T"], { rearranged: true }),
        ],
        {
          methods: ["work_backwards", "valuation_dates"],
          stages: {
            TIMING_DUE_AS_IMMEDIATE: [1, "selection", "B.annuity-immediate-av"],
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            TIMING_MISSING_PERIOD: [2, "application"],
            RATE_PAYMENT_FREQUENCY: [1, "selection"],
            SEQ_UNDISCOUNTED_SUM: [1, "application"],
            FORMULA_AV_FOR_PV: [1, "selection", "B.annuity-due"],
          },
          reasoning: "Discount the target back to the end of the deposits, then solve a level-deposit problem on the quarterly clock.",
        }
      ),
      params: { T, i, n, mExtra },
    };
  },
};

function dueExplanation(p: { i: number; n: number; mExtra: number; value: number; fmt: AnswerFormat; D?: number; quarterly?: boolean; T?: number }) {
  const { i, n, mExtra, value, fmt, quarterly, T = 0 } = p;
  const per = quarterly ? 4 * n : n;
  return explanation({
    intuition: "Deposits made at the start of each period each get one extra period of interest compared with end-of-period deposits. The s̈ factor builds that in — and it measures the fund one period after the last deposit, at the end of the deposit period.",
    translation: {
      unknowns: quarterly ? [{ symbol: "$D$", meaning: "each quarterly deposit" }] : [{ symbol: "$AV$", meaning: `the fund at time ${n + mExtra}` }],
      relationships: quarterly
        ? [`$${mamt(T)} = D\\,${sdueSym(per)}\\,(1+i)^{${mExtra}}$ at the quarterly rate`]
        : [`$AV = D\\,${sdueSym(n)}(1+i)^{${mExtra}}$`],
      conditions: [`${per} deposits in advance`, `valuation ${mExtra} years after the deposit period`],
      valuationDate: `Time ${n} (end of deposit period) via s̈, then time ${n + mExtra}.`,
      modelChoice: "Accumulated annuity-due, then single-sum accumulation.",
      assumptions: ["No withdrawals."],
    },
    solution: [
      { title: "Factor", body: `$${sdueSym(per)} = ${dec(quarterly ? sdue(per, Math.pow(1 + i, 0.25) - 1) : sdue(n, i), 5)}$${quarterly ? " at the quarterly rate" : ""}` },
      { title: "Further growth", body: `$(1+i)^{${mExtra}} = ${dec(acc(i, mExtra), 6)}$` },
      { title: quarterly ? "Deposit" : "Value", body: `$${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Annuity-immediate plus a period",
        body: `$\\ddot{s}_{\\overline{n|}} = (1+i)s_{\\overline{n|}}$: accumulate as end-of-period deposits to the last deposit date, then add one period plus the extra years.`,
        whenUseful: "Makes every period of growth explicit, which is the best guard against the off-by-one.",
      },
    ],
    transfer: {
      principle: "s̈ measures the fund one period after the last deposit; s measures it at the last deposit. Count further growth from there.",
      unusual: "The valuation date is after the deposits end.",
      misread: "The extra period from paying in advance is easy to drop — or to count twice.",
    },
  });
}

export const ANNUITY_TEMPLATES: QuestionTemplate[] = [
  levelPayment,
  arithmetic,
  geometric,
  perpetuity,
  monthly,
  hiddenRatio,
  depositsWithdrawals,
  dueAccumulation,
];

