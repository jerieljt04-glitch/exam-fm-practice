/**
 * Level-3 (Challenge) numerical templates added to give every syllabus outcome
 * Challenge coverage. Harder reasoning, never material outside the syllabus.
 *
 * Each template here is Challenge-only: the difficulty comes from hidden
 * structure, inverse problems, several valuation dates, changing rate regimes
 * or mixed frequencies — not from material outside the December 2026 syllabus.
 */
import { an, Ia, sn } from "../finance";
import type { DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  PCT2,
  PCT3,
  PLAIN2,
  aSym,
  amt,
  chain,
  dec,
  distractor,
  drawUntil,
  explanation,
  features,
  frequency,
  gridAmount,
  gridRate,
  lit,
  mamt,
  mnum,
  mpc,
  ord,
  pc,
  periodNoun,
  range,
  shown,
  step,
  sumOf,
} from "./kit";

// ===================================================================== shared expression helpers

/** (1 + i)^(-t) for a rate given as a number or an expression. */
const vE = (i: string, t: number | string): string => `(1+${i})**(-(${t}))`;
/** a_n at a rate given as an expression. */
const aE = (n: number, i: string): string => `((1-${vE(i, n)})/${i})`;
/** s_n at a rate given as an expression. */
const sE = (n: number, i: string): string => `(((1+${i})**(${n})-1)/${i})`;
/** (Ia)_n at a rate given as an expression. */
const IaE = (n: number, i: string): string => `((${aE(n, i)}*(1+${i}) - ${n}*${vE(i, n)})/${i})`;
const L = lit;

// ===================================================================== TVM — simple versus compound

const simpleVersusCompound: QuestionTemplate = {
  id: "chal-tvm-simple-compound",
  family: "chal-tvm-crossover",
  topic: "TVM",
  levels: [3],
  objective: "TVM.simple_compound",
  secondary: ["TVM.equation_of_value", "TVM.present_future_value"],
  reasoning: ["translation", "algebra", "financial_intuition", "multistep"],
  soaConcept: "A simple-interest account and a compound-interest account reconciled at one date and compared at another.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const DA = gridAmount(rng, 5000, 40000, 1000);
    const same = rng.next() < 0.5;
    const DB = same ? DA : DA * rng.choice([0.8, 0.85, 0.9]);
    const s = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(4, 10);
    const m = rng.int(2 * n, Math.min(3 * n, 30));
    const growth = (DA * (1 + s * n)) / DB;
    const i = Math.pow(growth, 1 / n) - 1;
    const An = DA * (1 + s * n);
    const Am = DA * (1 + s * m);
    const Bm = DB * Math.pow(1 + i, m);
    const answer = Bm - Am;

    const iE = `((${L(DA)}*(1+${L(s)}*${n})/${L(DB)})**(1/${n})-1)`;
    const AmE = `${L(DA)}*(1+${L(s)}*${m})`;
    const calc = `${L(DB)}*(1+${iE})**${m} - ${AmE}`;
    const model = `(${L(DB)} + ${sumOf(range(1, m).map((t) => `${L(DB)}*${iE}*(1+${iE})**${t - 1}`))}) - (${L(DA)} + ${sumOf(range(1, m).map(() => `${L(DA)}*${L(s)}`))})`;

    // Account A's simple rate used as if it were compound when solving for B's rate.
    const iC = Math.pow((DA * Math.pow(1 + s, n)) / DB, 1 / n) - 1;
    const vC = DB * Math.pow(1 + iC, m) - Am;
    // B's growth after year n computed with simple interest on the year-n balance.
    const vS = An * (1 + i * (m - n)) - Am;
    // Force of interest used as the effective rate.
    const delta = Math.log(growth) / n;
    const vF = DB * Math.pow(1 + delta, m) - Am;
    // Rate rounded to 0.1% before compounding.
    const iR = Math.round(i * 1000) / 1000;
    const vR = DB * Math.pow(1 + iR, m) - Am;

    const distractors: DistractorCandidate[] = [
      distractor("MODEL_SIMPLE_AS_COMPOUND", vC, `${L(DB)}*((${L(DA)}*(1+${L(s)})**${n}/${L(DB)})**(1/${n}))**${m} - ${AmE}`, {
        derivation: `$${mamt(DB)}(1+i)^{${n}} = ${mamt(DA)}(${dec(1 + s, 3)})^{${n}} \\Rightarrow i = ${dec(iC, 6)}$; $${mamt(DB)}(1+i)^{${m}} - ${mnum(Am, 2)} = ${shown(vC, fmt)}$`,
        method: "Treated Account A as compounding at its simple rate when setting up the equal-balance condition.",
        feedback: `Account A grows linearly: at year ${n} it holds $${mamt(DA)}(1 + ${n} \\times ${dec(s, 3)}) = ${mnum(An, 2)}$, not $${mamt(DA)}(${dec(1 + s, 3)})^{${n}}$. Only that linear balance fixes Account B's rate.`,
      }),
      distractor("MODEL_COMPOUND_AS_SIMPLE", vS, `${L(DA)}*(1+${L(s)}*${n})*(1+${iE}*${m - n}) - ${AmE}`, {
        derivation: `$${mnum(An, 2)}(1 + ${m - n} \\times ${dec(i, 6)}) - ${mnum(Am, 2)} = ${shown(vS, fmt)}$`,
        method: `Grew Account B from year ${n} to year ${m} with simple interest on its year-${n} balance.`,
        feedback: `Account B compounds for all ${m} years: its balance is $${mamt(DB)}(1+i)^{${m}}$, so interest after year ${n} is earned on interest as well.`,
      }),
      distractor("RATE_FORCE_AS_EFFECTIVE", vF, `${L(DB)}*(1+log(${L(DA)}*(1+${L(s)}*${n})/${L(DB)})/${n})**${m} - ${AmE}`, {
        derivation: `$\\tfrac{1}{${n}}\\ln(${dec(growth, 6)}) = ${dec(delta, 6)}$ used as $i$; $${mamt(DB)}(${dec(1 + delta, 6)})^{${m}} - ${mnum(Am, 2)} = ${shown(vF, fmt)}$`,
        method: "Took the logarithm of the growth factor per year (a force of interest) and used it as an annual effective rate.",
        feedback: `$\\ln(1+i)$ is the force of interest $\\delta$, not $i$. Here $i = (${dec(growth, 6)})^{1/${n}} - 1 = ${dec(i, 6)}$.`,
      }),
      distractor("ARITH_ROUNDED_RATE", vR, `${L(DB)}*(1+${L(iR)})**${m} - ${AmE}`, {
        derivation: `$i \\approx ${mpc(iR, 1)}$; $${mamt(DB)}(${dec(1 + iR, 3)})^{${m}} - ${mnum(Am, 2)} = ${shown(vR, fmt)}$`,
        method: `Rounded Account B's rate to ${pc(iR, 1)} before compounding for ${m} years.`,
        feedback: `Keep $i = ${dec(i, 6)}$ at full precision: compounding for ${m} years magnifies the rounding.`,
      }),
      distractor("VAR_TOTAL_FOR_COMPONENT", Bm, `${L(DB)}*(1+${iE})**${m}`, {
        derivation: `$${mamt(DB)}(1+i)^{${m}} = ${shown(Bm, fmt)}$`,
        method: "Reported Account B's balance instead of the difference between the balances.",
        feedback: `The question asks how much more Account B holds: subtract Account A's balance of ${amt(Number(Am.toFixed(2)))}.`,
      }),
    ];

    return {
      stem: `${same ? `At time 0, deposits of ${amt(DA)} are made into each of two accounts.` : `At time 0, ${amt(DA)} is deposited into Account A and ${amt(DB)} is deposited into Account B.`} Account A credits simple interest at an annual rate of ${pc(s)}. Account B credits interest at an annual effective rate of $i$. At the end of year ${n}, the two accounts have equal balances.\n\nCalculate the amount by which the balance in Account B exceeds the balance in Account A at the end of year ${m}.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$i = ${dec(i, 6)}$; $${mamt(DB)}(1+i)^{${m}} - ${mamt(DA)}(1 + ${m} \\times ${dec(s, 3)}) = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: `Account B credits $i\\,B_{t-1}$ each year from the rate fixed by the year-${n} equality; Account A credits the same $s \\times ${mamt(DA)}$ every year. Subtract the year-${m} balances.`,
      },
      distractors,
      explanation: explanation({
        intuition: `Simple interest adds the same amount every year, so Account A's balance is a straight line. Compound interest grows a curve. The two meet at year ${n} — that single fact pins down Account B's rate — and after the meeting point the curve pulls away from the line.`,
        translation: {
          unknowns: [
            { symbol: "$i$", meaning: "Account B's annual effective rate" },
            { symbol: "$\\Delta$", meaning: `B's balance minus A's balance at year ${m}` },
          ],
          relationships: [`$${mamt(DB)}(1+i)^{${n}} = ${mamt(DA)}(1 + ${n}s)$`, `$\\Delta = ${mamt(DB)}(1+i)^{${m}} - ${mamt(DA)}(1 + ${m}s)$`],
          conditions: [`Equal balances at year ${n}.`, "Simple interest is credited on the original deposit only."],
          valuationDate: `Year ${n} to fix $i$; year ${m} for the comparison.`,
          modelChoice: "Two accumulation functions: $a(t) = 1 + st$ and $a(t) = (1+i)^t$.",
          assumptions: ["No withdrawals.", "Interest is credited at the stated rates throughout."],
        },
        solution: [
          { title: `Account A at year ${n}`, body: `$${mamt(DA)}(1 + ${n} \\times ${dec(s, 3)}) = ${mnum(An, 2)}$` },
          { title: "Account B's rate", body: `$(1+i)^{${n}} = ${mnum(An, 2)}/${mamt(DB)} = ${dec(growth, 6)} \\Rightarrow i = ${dec(i, 6)}$` },
          { title: `Balances at year ${m}`, body: `B: $${mamt(DB)}(${dec(1 + i, 6)})^{${m}} = ${mnum(Bm, 2)}$; A: $${mamt(DA)}(1 + ${m} \\times ${dec(s, 3)}) = ${mnum(Am, 2)}$` },
          { title: "Difference", body: `$${mnum(Bm, 2)} - ${mnum(Am, 2)} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Grow from the meeting point",
            body: `From year ${n} both accounts start from ${amt(Number(An.toFixed(2)))}. B multiplies it by $(1+i)^{${m - n}}$; A adds $${m - n} \\times ${mamt(Number((DA * s).toFixed(2)))}$.`,
            whenUseful: "Avoids recomputing the early years and shows why B pulls ahead.",
          },
        ],
        transfer: {
          principle: "A stated equality between two accounts is an equation of value; use it to recover the unknown rate before comparing at any other date.",
          unusual: "The compound rate is not given; it is implied by the date at which the two balances meet.",
          misread: "Simple interest is not compound interest at the same rate: it never earns interest on interest.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Straight line versus curve",
          unit: "year",
          series: [
            { label: "Account A (simple)", values: range(0, m).map((t) => ({ t, amount: DA * (1 + s * t) })) },
            { label: "Account B (compound)", values: range(0, m).map((t) => ({ t, amount: DB * Math.pow(1 + i, t) })) },
          ],
          caption: `The balances meet at year ${n}; after that the compound account pulls ahead.`,
        },
      ],
      markers: [An, i, Bm, Am],
      presentation: ["unknown-rate", "hidden-structure", "valuation-date"],
      features: features({ steps: 5, multipleValuationDates: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.simple", "Account A's balance at the date the balances are equal.", ["A_n", An, `A's balance at year ${n}`], ["D_A", "s", "n"], { valuationDate: `${n}` }),
          step("A.compound", "The equal balances fix Account B's annual effective rate.", ["i", i, "B's annual effective rate"], ["A_n", "D_B", "n"], { rearranged: true }),
          step("A.compound", "Account B's balance at the comparison date.", ["B_m", Bm, `B's balance at year ${m}`], ["D_B", "i", "m"], { valuationDate: `${m}` }),
          step("A.simple", "Account A's balance at the comparison date.", ["A_m", Am, `A's balance at year ${m}`], ["D_A", "s", "m"], { valuationDate: `${m}` }),
          step("A.equation-of-value", "Compare the two balances at the same date.", ["Δ", answer, "B minus A"], ["B_m", "A_m"]),
        ],
        {
          methods: ["equation_construction", "rearrangement", "valuation_dates"],
          stages: {
            MODEL_SIMPLE_AS_COMPOUND: [0, "selection", "A.compound"],
            RATE_FORCE_AS_EFFECTIVE: [1, "application"],
            ARITH_ROUNDED_RATE: [1, "application"],
            MODEL_COMPOUND_AS_SIMPLE: [2, "selection", "A.simple"],
            VAR_TOTAL_FOR_COMPONENT: [4, "interpretation"],
          },
          reasoning: "Write each account's accumulation function, use the stated equality to solve for the one unknown rate, then evaluate both functions at the later date.",
        }
      ),
      params: { DA, DB, s, n, m, i },
    };
  },
};

// ===================================================================== TVM — current value across a rate change

const currentValue: QuestionTemplate = {
  id: "chal-tvm-current-value",
  family: "chal-tvm-regimes",
  topic: "TVM",
  levels: [3],
  objective: "TVM.present_future_value",
  secondary: ["TVM.effective_nominal", "TVM.discount_rates", "TVM.equation_of_value"],
  reasoning: ["valuation_dates", "cashflow_modelling", "formula_selection", "multistep"],
  soaConcept: "An unknown payment recovered from the current value of a set of payments at an intermediate date when the rate basis changes part-way.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const b = rng.int(4, 7);
    const before = rng.next() < 0.5;
    let t1: number, t2: number, t3: number, c: number;
    if (before) {
      c = rng.int(2, b - 1);
      t1 = rng.int(1, c - 1);
      t2 = rng.int(c + 1, b);
      t3 = rng.int(b + 3, b + 8);
    } else {
      t1 = rng.int(1, b - 2);
      t2 = rng.int(b + 1, b + 3);
      c = rng.int(t2 + 1, t2 + 3);
      t3 = rng.int(c + 2, c + 6);
    }
    const useForce = rng.next() < 0.5;
    const m2 = rng.choice([2, 4, 12]);
    const rates = drawUntil(
      () => {
        const r1 = gridRate(rng, 0.03, 0.08, 0.005);
        const j = gridRate(rng, 0.04, 0.1, 0.005);
        const i1 = useForce ? Math.exp(r1) - 1 : r1 / (1 - r1);
        const i2 = Math.pow(1 + j / m2, m2) - 1;
        return { r1, j, i1, i2 };
      },
      (x) => Math.abs(x.i1 - x.i2) >= 0.015
    );
    const { r1, j, i1, i2 } = rates;
    const known = [
      { t: t1, p: gridAmount(rng, 2000, 20000, 500) },
      { t: t2, p: gridAmount(rng, 2000, 20000, 500) },
    ];
    const acc = (t: number, a1 = i1, a2 = i2) => Math.pow(1 + a1, Math.min(t, b)) * Math.pow(1 + a2, Math.max(t - b, 0));
    const Xdraw = gridAmount(rng, 10000, 40000, 500);
    const Kc = known.reduce((sum, x) => sum + (x.p * acc(c)) / acc(x.t), 0);
    const V = Math.round((Kc + (Xdraw * acc(c)) / acc(t3)) / 10) * 10;
    const solveX = (a1: number, a2: number) => ((V - known.reduce((sum, x) => sum + (x.p * acc(c, a1, a2)) / acc(x.t, a1, a2), 0)) * acc(t3, a1, a2)) / acc(c, a1, a2);
    const answer = solveX(i1, i2);
    const share = V - Kc;

    const f1 = useForce ? `exp(${L(r1)})` : `(1/(1-${L(r1)}))`;
    const f2 = `((1+${L(j)}/${m2})**${m2})`;
    const accE = (t: number, g1 = f1, g2 = f2) => `${g1}**${Math.min(t, b)}*${g2}**${Math.max(t - b, 0)}`;
    const XE = (g1: string, g2: string) =>
      `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}*(${accE(c, g1, g2)})/(${accE(x.t, g1, g2)})`))})*(${accE(t3, g1, g2)})/(${accE(c, g1, g2)})`;
    const calc = XE(f1, f2);
    // Model: each payment moved to year c period by period — regime 1 in years, regime 2 in m-thly periods.
    const step1 = useForce ? `exp(${L(r1)}*(EXP))` : `(1-${L(r1)})**(-(EXP))`;
    const move = (t: number) => {
      const y1 = Math.min(c, b) - Math.min(t, b);
      const y2 = Math.max(c - b, 0) - Math.max(t - b, 0);
      return `${step1.replace("EXP", String(y1))}*(1+${L(j)}/${m2})**(${m2 * y2})`;
    };
    const model = `${sumOf(known.map((x) => `${L(x.p)}*${move(x.t)}`))} + x*${move(t3)} - ${L(V)}`;

    // Each payment moved entirely at the rate in force at its own date.
    const rateAt = (t: number) => (t <= b ? i1 : i2);
    const fAt = (t: number) => (t <= b ? f1 : f2);
    const byDate = (V - known.reduce((sum, x) => sum + x.p * Math.pow(1 + rateAt(x.t), c - x.t), 0)) * Math.pow(1 + rateAt(t3), t3 - c);
    const byDateE = `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}*(${fAt(x.t)})**(${c - x.t})`))})*(${fAt(t3)})**(${t3 - c})`;
    // One rate (the one in force at the valuation date) for every move.
    const rc = c <= b ? i1 : i2;
    const fc = c <= b ? f1 : f2;
    const oneRate = (V - known.reduce((sum, x) => sum + x.p * Math.pow(1 + rc, c - x.t), 0)) * Math.pow(1 + rc, t3 - c);
    const oneRateE = `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}*(${fc})**(${c - x.t})`))})*(${fc})**(${t3 - c})`;
    const nomEff = solveX(i1, j);
    const raw = solveX(r1, i2);
    // The stated value treated as a value at time 0.
    const atZero = (V - known.reduce((sum, x) => sum + x.p / acc(x.t), 0)) * acc(t3);
    const atZeroE = `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}/(${accE(x.t)})`))})*(${accE(t3)})`;
    // The unknown payment's share discounted instead of accumulated.
    const wrongWay = (share * acc(c)) / acc(t3);
    const wrongWayE = `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}*(${accE(c)})/(${accE(x.t)})`))})*(${accE(c)})/(${accE(t3)})`;

    const short = (share * acc(t3 - 1)) / acc(c);
    const shortE = `(${L(V)} - ${sumOf(known.map((x) => `${L(x.p)}*(${accE(c)})/(${accE(x.t)})`))})*(${accE(t3 - 1)})/(${accE(c)})`;
    const rate1Text = useForce ? `a constant force of interest of ${pc(r1)}` : `an annual effective rate of discount of ${pc(r1)}`;
    const regime2Text = `an annual nominal rate of interest of ${pc(j)} convertible ${frequency(m2)}`;
    const factorText = (from: number, to: number) => `\\dfrac{a(${to})}{a(${from})}`;

    return {
      stem: `Interest is credited at ${rate1Text} for the first ${b} years and at ${regime2Text} thereafter. Payments of ${amt(known[0].p)} and ${amt(known[1].p)} are made at the ends of years ${t1} and ${t2}, respectively, and a payment of $X$ is made at the end of year ${t3}. The value of these three payments at the end of year ${c} is ${amt(V)}.\n\nCalculate $X$.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$X = (${mamt(V)} - ${mnum(Kc, 2)})\\,a(${t3})/a(${c}) = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        bracket: [0, 20 * V],
        description: `Each payment moved to year ${c} period by period — annual factors up to year ${b}, ${periodNoun(m2)}ly factors $1 + j/${m2}$ after it — and the total set equal to ${amt(V)}.`,
      },
      distractors: [
        distractor("CHAL_RATE_BY_PAYMENT_DATE", byDate, byDateE, {
          derivation: `each payment moved at the rate in force on its own date: $X = ${shown(byDate, fmt)}$`,
          method: "Moved each payment the whole way at the rate in force when it was paid.",
          feedback: `A payment that crosses year ${b} on its way to year ${c} earns (or is discounted at) each regime's rate for the years it spends in that regime.`,
        }),
        distractor("MODEL_CONSTANT_FORCE", oneRate, oneRateE, {
          derivation: `every move at $${dec(rc, 6)}$: $X = ${shown(oneRate, fmt)}$`,
          method: `Used the rate in force at year ${c} for every year.`,
          feedback: `The rate changes at year ${b}; years on the other side of that date must use the other rate.`,
        }),
        distractor("RATE_NOMINAL_AS_EFFECTIVE", nomEff, XE(f1, `(1+${L(j)})`), {
          derivation: `$i_2 = ${dec(j, 4)}$ used as effective: $X = ${shown(nomEff, fmt)}$`,
          method: `Used the nominal rate ${pc(j)} as an annual effective rate after year ${b}.`,
          feedback: `Convertible ${frequency(m2)} means $1 + i_2 = (1 + ${dec(j, 3)}/${m2})^{${m2}} = ${dec(1 + i2, 6)}$.`,
        }),
        distractor(useForce ? "RATE_FORCE_AS_EFFECTIVE" : "RATE_DISCOUNT_AS_INTEREST", raw, XE(`(1+${L(r1)})`, f2), {
          derivation: `$${dec(r1, 3)}$ used as $i_1$: $X = ${shown(raw, fmt)}$`,
          method: useForce ? "Used the force of interest as an annual effective rate." : "Used the rate of discount as a rate of interest.",
          feedback: useForce ? `$1 + i_1 = e^{\\delta} = ${dec(1 + i1, 6)}$.` : `$1 + i_1 = 1/(1 - d) = ${dec(1 + i1, 6)}$.`,
        }),
        distractor("TIMING_VALUATION_DATE", atZero, atZeroE, {
          derivation: `${amt(V)} treated as a value at time 0: $X = ${shown(atZero, fmt)}$`,
          method: "Set up the equation of value at time 0 with the stated value.",
          feedback: `${amt(V)} is the value at the end of year ${c}; every payment must be moved to that date before the equation is written.`,
        }),
        distractor("TIMING_MISSING_PERIOD", short, shortE, {
          derivation: `$(${mamt(V)} - ${mnum(Kc, 2)})\\,a(${t3 - 1})/a(${c}) = ${shown(short, fmt)}$`,
          method: `Carried the remaining value from year ${c} for only ${t3 - c - 1} years.`,
          feedback: `$X$ is paid at the end of year ${t3}, ${t3 - c} years after the valuation date.`,
        }),
        distractor("CONC_MOVED_WRONG_WAY", wrongWay, wrongWayE, {
          derivation: `$(${mamt(V)} - ${mnum(Kc, 2)})\\,a(${c})/a(${t3}) = ${shown(wrongWay, fmt)}$`,
          method: `Discounted the remaining value from year ${c} to year ${t3} instead of accumulating it.`,
          feedback: `$X$ is paid after year ${c}, so $X$ is larger than its year-${c} value: multiply by $a(${t3})/a(${c}) > 1$.`,
        }),
      ],
      explanation: explanation({
        intuition: `Build one accumulation function $a(t)$ that uses the first rate up to year ${b} and the second after it. At year ${c}, the two known payments account for part of ${amt(V)}; the rest is the year-${c} value of $X$, which then only has to be carried to year ${t3}.`,
        translation: {
          unknowns: [{ symbol: "$X$", meaning: `the payment at the end of year ${t3}` }],
          relationships: [
            `$1 + i_1 = ${useForce ? `e^{${dec(r1, 3)}}` : `(1 - ${dec(r1, 3)})^{-1}`} = ${dec(1 + i1, 6)}$`,
            `$1 + i_2 = (1 + ${dec(j, 3)}/${m2})^{${m2}} = ${dec(1 + i2, 6)}$`,
            `$${mamt(known[0].p)}\\,${factorText(t1, c)} + ${mamt(known[1].p)}\\,${factorText(t2, c)} + X\\,${factorText(t3, c)} = ${mamt(V)}$`,
          ],
          conditions: [`The rate changes at the end of year ${b}.`, `The stated value is at the end of year ${c}.`],
          valuationDate: `End of year ${c}: earlier payments accumulated, later payments discounted.`,
          modelChoice: "A piecewise accumulation function; each move is split at the rate-change date.",
          assumptions: ["Rates apply to periods of time, not to payments.", "Within each regime the rate is constant."],
        },
        solution: [
          { title: "Effective rates", body: `$i_1 = ${dec(i1, 6)}$, $i_2 = ${dec(i2, 6)}$` },
          { title: `Known payments at year ${c}`, body: `${known.map((x) => `$${mamt(x.p)}\\,${factorText(x.t, c)}$`).join(" + ")} $= ${mnum(Kc, 2)}$` },
          { title: `Value of $X$ at year ${c}`, body: `$${mamt(V)} - ${mnum(Kc, 2)} = ${mnum(share, 2)}$` },
          { title: `Carry to year ${t3}`, body: `$X = ${mnum(share, 2)} \\times ${dec(acc(t3) / acc(c), 6)} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Equation at the rate-change date",
            body: `Write the same equation of value at year ${b}: every factor then involves one regime only, and the stated value is moved to year ${b} first.`,
            whenUseful: "When several payments cross the same rate-change date.",
          },
        ],
        transfer: {
          principle: "A rate belongs to a period of time, not to a payment: split any move that crosses a rate change, then solve the equation of value for the unknown.",
          unusual: before ? "The valuation date falls before the rate change, so later payments are discounted through both regimes." : "An early payment is accumulated through both regimes.",
          misread: "Using the rate in force on the payment date for the whole move.",
        },
      }),
      visuals: [
        {
          kind: "growth",
          title: "Accumulation function with a rate change",
          start: 0,
          end: t3,
          samples: range(0, t3).map((t) => ({ t, value: acc(t) })),
          markers: [
            { t: b, label: "rate changes" },
            { t: c, label: "valuation date" },
          ],
        },
      ],
      markers: [i1, i2, Kc, share],
      presentation: ["inverse", "valuation-date", "mixed-timing", "frequency"],
      features: features({ steps: 5, multipleValuationDates: true, formulaRetrieval: true, multiConcept: true }),
      chain: chain(
        [
          step(useForce ? "A.constant-force" : "A.interest-discount", "Annual effective rate for the first regime.", ["i_1", i1, "first-regime effective rate"], [useForce ? "δ" : "d"]),
          step("A.nominal-equivalence", "Annual effective rate for the second regime.", ["i_2", i2, "second-regime effective rate"], ["j", "m"]),
          step("A.compound", `Move the known payments to year ${c}, splitting at year ${b}.`, ["K", Kc, `value at year ${c} of the known payments`], ["P", "i_1", "i_2"], { valuationDate: `${c}` }),
          step("A.equation-of-value", `The rest of the stated value belongs to X.`, ["V − K", share, `value of X at year ${c}`], ["V", "K"], { valuationDate: `${c}` }),
          step("A.compound", `Carry that value to year ${t3}.`, ["X", answer, `payment at year ${t3}`], ["V − K", "i_1", "i_2"], { valuationDate: `${t3}` }),
        ],
        {
          methods: ["equation_construction", "valuation_dates"],
          stages: {
            RATE_FORCE_AS_EFFECTIVE: [0, "application"],
            RATE_DISCOUNT_AS_INTEREST: [0, "application"],
            RATE_NOMINAL_AS_EFFECTIVE: [1, "application"],
            CHAL_RATE_BY_PAYMENT_DATE: [2, "application"],
            MODEL_CONSTANT_FORCE: [2, "selection"],
            TIMING_VALUATION_DATE: [3, "connection"],
            CONC_MOVED_WRONG_WAY: [4, "application"],
            TIMING_MISSING_PERIOD: [4, "application"],
          },
          reasoning: "Build a(t) from the two regimes, write the equation of value at the stated date, and solve it for the one unknown payment.",
        }
      ),
      params: { b, c, t1, t2, t3, r1, j, m2, useForce, V },
    };
  },
};

// ===================================================================== TVM — inflation-indexed versus level stream

const indexedVersusLevel: QuestionTemplate = {
  id: "chal-tvm-indexed-level",
  family: "chal-tvm-real",
  topic: "TVM",
  levels: [3],
  objective: "TVM.inflation_real",
  secondary: ["ANNUITIES.level_payment", "TVM.present_future_value"],
  reasoning: ["concept_recognition", "translation", "financial_intuition", "multistep"],
  soaConcept: "An inflation-indexed payment stream and an equivalent level stream, with the result read in real terms.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const P = gridAmount(rng, 10000, 40000, 500);
    const n = rng.int(10, 25);
    const i = gridRate(rng, 0.05, 0.09, 0.005);
    const r = gridRate(rng, 0.015, Math.min(0.04, i - 0.015), 0.005);
    const q = rng.int(Math.ceil(n / 2), n);
    const jr = (1 + i) / (1 + r) - 1;
    const pvI = P * an(n, jr);
    const X = pvI / an(n, i);
    const answer = X / Math.pow(1 + r, q);

    const jE = `((1+${L(i)})/(1+${L(r)})-1)`;
    const iS = L(i);
    const XE = `${L(P)}*${aE(n, jE)}/${aE(n, iS)}`;
    const calc = `${XE}/(1+${L(r)})**${q}`;
    const model = `${sumOf(range(1, n).map((t) => `${L(P)}*(1+${L(r)})**${t}*(1+${iS})**(-${t})`))}/${sumOf(range(1, n).map((t) => `(1+${iS})**(-${t})`))}*(1+${L(r)})**(-${q})`;

    const approxX = (P * an(n, i - r)) / an(n, i);
    const approx = approxX / Math.pow(1 + r, q);
    const level = P / Math.pow(1 + r, q);
    const lag = answer / (1 + r);
    const inflated = X * Math.pow(1 + r, q);

    return {
      stem: `A retiree chooses between two annuities, each making ${n} annual payments with the first payment one year from now.\n\nUnder Option I, each payment is increased with inflation so that every payment has a purchasing power of ${amt(P)} at time-0 prices. Under Option II, every payment is the same amount $X$.\n\nInflation is ${pc(r)} per year. The two options have equal present values at an annual effective interest rate of ${pc(i)}.\n\nCalculate the purchasing power, in time-0 prices, of the ${ord(q)} payment under Option II.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$X = ${mnum(X, 2)}$; $X/(${dec(1 + r, 3)})^{${q}} = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: `Option I pays $${mamt(P)}(1+r)^t$ at time $t$; equate its present value with $X\\sum v^t$, then deflate the year-${q} payment by $(1+r)^{${q}}$.`,
      },
      distractors: [
        distractor("FORMULA_APPROX_REAL", approx, `${L(P)}*${aE(n, `(${L(i)}-${L(r)})`)}/${aE(n, iS)}/(1+${L(r)})**${q}`, {
          derivation: `real rate $\\approx ${dec(i - r, 3)}$: $X = ${mnum(approxX, 2)}$, $X/(${dec(1 + r, 3)})^{${q}} = ${shown(approx, fmt)}$`,
          method: "Valued the indexed stream at i − r.",
          feedback: `The real rate is $(1+i)/(1+r) - 1 = ${dec(jr, 6)}$, slightly below $i - r$; over ${n} payments the difference matters.`,
        }),
        distractor("CONC_REAL_NOMINAL_MIX", level, `${L(P)}/(1+${L(r)})**${q}`, {
          derivation: `Option I taken as level ${amt(P)} at ${pc(i)}, so $X = ${mamt(P)}$; $${mamt(P)}/(${dec(1 + r, 3)})^{${q}} = ${shown(level, fmt)}$`,
          method: "Valued Option I's payments as if they were level amounts of the time-0 purchasing power.",
          feedback: "Option I's payments rise with inflation in money terms; at a money rate of interest they must be valued as rising amounts (or at the real rate as level real amounts).",
        }),
        distractor("VAR_OTHER_UNKNOWN", X, XE, {
          derivation: `$X = ${shown(X, fmt)}$`,
          method: "Reported the level payment in money terms.",
          feedback: `The question asks for purchasing power at time-0 prices: divide by $(1+r)^{${q}}$.`,
        }),
        distractor("TIMING_MISSING_PERIOD", lag, `${XE}/(1+${L(r)})**${q + 1}`, {
          derivation: `Option I's first payment taken as ${amt(P)}: $X = ${mnum(X / (1 + r), 2)}$, real value $= ${shown(lag, fmt)}$`,
          method: "Started the inflation adjustment one year late.",
          feedback: `The first payment is made at time 1, when prices are already up by ${pc(r)}; it is $${mamt(P)}(1+r)$ in money.`,
        }),
        distractor("ALG_DIVIDE_ERROR", inflated, `${XE}*(1+${L(r)})**${q}`, {
          derivation: `$X(${dec(1 + r, 3)})^{${q}} = ${shown(inflated, fmt)}$`,
          method: "Multiplied by the inflation factor instead of dividing.",
          feedback: "Inflation reduces what a fixed amount buys, so converting to time-0 prices divides.",
        }),
      ],
      explanation: explanation({
        intuition: "Option I is level in real terms, so it is cheapest to value it at the real rate. Option II is level in money terms, so it is valued at the money rate. Equal present values give X; the last step is to convert one of X's payments back into time-0 purchasing power.",
        translation: {
          unknowns: [
            { symbol: "$X$", meaning: "Option II's level payment, in money" },
            { symbol: "$R$", meaning: `purchasing power of Option II's ${ord(q)} payment` },
          ],
          relationships: [`$j = \\dfrac{1+i}{1+r} - 1 = ${dec(jr, 6)}$`, `$${mamt(P)}\\,${aSym(n)}{}_{\\,j} = X\\,${aSym(n)}{}_{\\,i}$`, `$R = X/(1+r)^{${q}}$`],
          conditions: ["Option I keeps its purchasing power; Option II is fixed in money."],
          valuationDate: "Time 0 for the comparison; year " + q + " for the payment being converted.",
          modelChoice: "Real rate for the indexed stream, money rate for the level stream.",
          assumptions: ["Inflation is constant.", "Both streams are valued at the same money rate of interest."],
        },
        solution: [
          { title: "Real rate", body: `$j = ${dec(1 + i, 3)}/${dec(1 + r, 3)} - 1 = ${dec(jr, 6)}$` },
          { title: "Option I", body: `$${mamt(P)}\\,${aSym(n)}{}_{\\,j} = ${mnum(pvI, 2)}$` },
          { title: "Option II", body: `$X = ${mnum(pvI, 2)}/${aSym(n)}{}_{\\,i} = ${mnum(pvI, 2)}/${dec(an(n, i), 5)} = ${mnum(X, 2)}$` },
          { title: "Purchasing power", body: `$${mnum(X, 2)}/(${dec(1 + r, 3)})^{${q}} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Money terms throughout",
            body: `Value Option I as $\\sum ${mamt(P)}(1+r)^t v^t$ at ${pc(i)}; this is a geometric series with ratio $(1+r)/(1+i)$ and gives the same ${amt(Number(pvI.toFixed(2)))}.`,
            whenUseful: "A check that the real rate was formed correctly.",
          },
        ],
        transfer: {
          principle: "Level-in-real-terms streams are valued at the real rate; level-in-money streams at the money rate. Convert between money and purchasing power with $(1+r)^t$.",
          unusual: "The answer is a real value of one payment of the money-level option, not the payment itself.",
          misread: "Using $i - r$ as the real rate, or valuing indexed payments as if level in money.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "The two options in time-0 purchasing power",
          unit: "year",
          series: [
            { label: "Option I (indexed)", values: range(1, n).map((t) => ({ t, amount: P })) },
            { label: "Option II (level money)", values: range(1, n).map((t) => ({ t, amount: X / Math.pow(1 + r, t) })) },
          ],
          caption: "Option II starts higher in real terms and falls below Option I as prices rise.",
        },
      ],
      markers: [jr, pvI, X],
      presentation: ["compare-streams", "hidden-structure", "indirect-wording"],
      features: features({ steps: 4, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("F.real-rate", "Indexed payments are level in real terms: value them at the real rate.", ["j", jr, "real rate"], ["i", "r"]),
          step("B.annuity-immediate", "Present value of Option I.", ["PV_I", pvI, "PV of the indexed option"], ["P", "j", "n"], { valuationDate: "0" }),
          step("B.annuity-immediate", "Equal present values give Option II's level payment.", ["X", X, "level money payment"], ["PV_I", "i", "n"], { rearranged: true }),
          step("A.discount-factor", "Convert the payment to time-0 purchasing power.", ["R", answer, `real value of payment ${q}`], ["X", "r", "q"]),
        ],
        {
          methods: ["equation_construction", "rearrangement"],
          stages: {
            FORMULA_APPROX_REAL: [0, "selection"],
            CONC_REAL_NOMINAL_MIX: [1, "selection"],
            TIMING_MISSING_PERIOD: [1, "application"],
            ALG_DIVIDE_ERROR: [3, "application"],
            VAR_OTHER_UNKNOWN: [3, "interpretation"],
          },
          reasoning: "Match the rate to the stream: real rate for the indexed stream, money rate for the level stream; then deflate the one payment asked about.",
        }
      ),
      params: { P, n, i, r, q },
    };
  },
};

// ===================================================================== TVM — equivalent nominal rates with staggered deposits

const staggeredFunds: QuestionTemplate = {
  id: "chal-tvm-staggered-funds",
  family: "chal-tvm-equivalence",
  topic: "TVM",
  levels: [3],
  objective: "TVM.effective_nominal",
  secondary: ["TVM.discount_rates", "TVM.equation_of_value"],
  reasoning: ["translation", "valuation_dates", "algebra", "multistep"],
  soaConcept: "Two funds on different nominal bases, opened at different dates, equal at a later date; solve for one nominal rate.",
  generate(rng): QuestionDraft {
    const fmt = PCT3;
    const mA = rng.choice([2, 4, 12]);
    const mB = rng.choice([2, 4, 12].filter((m) => m !== mA));
    const draw = drawUntil(
      () => {
        const X = gridAmount(rng, 2000, 20000, 500);
        const jA = gridRate(rng, 0.03, 0.08, 0.005);
        const n = rng.int(8, 20);
        const k = rng.int(2, Math.floor(n / 2));
        const Y = gridAmount(rng, X, X * 2.5, 500);
        const AV = X * Math.pow(1 + jA / mA, mA * n);
        const G = AV / Y;
        const d = mB * (1 - Math.pow(G, -1 / (mB * (n - k))));
        return { X, jA, n, k, Y, AV, G, d };
      },
      (p) => p.d > 0.02 && p.d < 0.12
    );
    const { X, jA, n, k, Y, AV, G, d } = draw;
    const T = n - k;
    const answer = d;
    const AVE = `${L(X)}*(1+${L(jA)}/${mA})**${mA * n}`;
    const GE = `(${AVE}/${L(Y)})`;
    const dOf = (g: string, years: number) => `${mB}*(1-${g}**(-1/${mB * years}))`;
    const calc = dOf(GE, T);
    const model = `${L(Y)}*(1-x/${mB})**(-${mB * T}) - ${L(X)}*(1+${L(jA)}/${mA})**${mA * n}`;

    const noDefer = mB * (1 - Math.pow(G, -1 / (mB * n)));
    const asInterest = mB * (Math.pow(G, 1 / (mB * T)) - 1);
    const GN = (X * Math.pow(1 + jA, n)) / Y;
    const nomEff = mB * (1 - Math.pow(GN, -1 / (mB * T)));
    const dEff = 1 - Math.pow(G, -1 / T);
    const offByOne = mB * (1 - Math.pow(G, -1 / (mB * (T + 1))));
    const fA = frequency(mA);
    const fB = frequency(mB);

    return {
      stem: `At time 0, ${amt(X)} is deposited into Fund A, which credits interest at an annual nominal rate of ${pc(jA)} convertible ${fA}. At the end of year ${k}, ${amt(Y)} is deposited into Fund B, which credits interest at an annual nominal rate of discount of $d$ convertible ${fB}. No other deposits or withdrawals are made. At the end of year ${n}, the two funds have equal balances.\n\nCalculate $d$.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$(1 - d/${mB})^{-${mB * T}} = ${dec(G, 6)} \\Rightarrow d = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        bracket: [0.001, 0.4],
        description: `Fund B grows for ${T} years at $(1 - d/${mB})^{-${mB}}$ per year; set its year-${n} balance equal to Fund A's.`,
      },
      distractors: [
        distractor("TIMING_IGNORED_DEFERRAL", noDefer, dOf(GE, n), {
          derivation: `growth over ${n} years: $d = ${shown(noDefer, fmt)}$`,
          method: `Let Fund B grow for ${n} years instead of ${T}.`,
          feedback: `Fund B opens at the end of year ${k}, so it earns interest for only ${T} years before the comparison date.`,
        }),
        distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `${mB}*(${GE}**(1/${mB * T})-1)`, {
          derivation: `$${mB}\\left[(${dec(G, 6)})^{1/${mB * T}} - 1\\right] = ${shown(asInterest, fmt)}$`,
          method: "Solved for the nominal rate of interest instead of the nominal rate of discount.",
          feedback: `With a rate of discount the ${periodNoun(mB)}ly accumulation factor is $(1 - d/${mB})^{-1}$, not $1 + d/${mB}$.`,
        }),
        distractor("RATE_NOMINAL_AS_EFFECTIVE", nomEff, dOf(`(${L(X)}*(1+${L(jA)})**${n}/${L(Y)})`, T), {
          derivation: `Fund A at $(${dec(1 + jA, 3)})^{${n}}$: $d = ${shown(nomEff, fmt)}$`,
          method: `Treated Fund A's ${pc(jA)} as an annual effective rate.`,
          feedback: `Convertible ${fA} means Fund A grows by $(1 + ${dec(jA, 3)}/${mA})^{${mA}}$ each year.`,
        }),
        distractor("VAR_OTHER_UNKNOWN", dEff, `1-${GE}**(-1/${T})`, {
          derivation: `annual effective discount $1 - (${dec(G, 6)})^{-1/${T}} = ${shown(dEff, fmt)}$`,
          method: "Reported the annual effective rate of discount.",
          feedback: `The question asks for the nominal rate convertible ${fB}: $d^{(${mB})} = ${mB}\\left[1 - (1 - d)^{1/${mB}}\\right]$.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, dOf(GE, T + 1), {
          derivation: `growth over ${T + 1} years: $d = ${shown(offByOne, fmt)}$`,
          method: `Counted ${T + 1} years of growth for Fund B.`,
          feedback: `A deposit at the end of year ${k} grows from time ${k} to time ${n}: ${T} years.`,
        }),
      ],
      explanation: explanation({
        intuition: "Fund A's balance at the comparison date is known outright. Fund B must turn its deposit into exactly that amount in the time it has, which fixes its accumulation factor; the nominal discount rate is a translation of that factor.",
        translation: {
          unknowns: [{ symbol: "$d$", meaning: `annual nominal rate of discount convertible ${fB}` }],
          relationships: [`$${mamt(X)}(1 + ${dec(jA, 3)}/${mA})^{${mA * n}} = ${mamt(Y)}(1 - d/${mB})^{-${mB * T}}$`],
          conditions: [`Fund B exists only from year ${k}.`, "Both balances are compared at the same date."],
          valuationDate: `End of year ${n}.`,
          modelChoice: "One equation of value at the comparison date; each fund on its own conversion basis.",
          assumptions: ["No other deposits or withdrawals.", "Rates are constant."],
        },
        solution: [
          { title: "Fund A", body: `$${mamt(X)}(1 + ${dec(jA / mA, 6)})^{${mA * n}} = ${mnum(AV, 2)}$` },
          { title: "Fund B's required growth", body: `$${mnum(AV, 2)}/${mamt(Y)} = ${dec(G, 6)}$ over ${T} years` },
          { title: `${periodNoun(mB)}ly factor`, body: `$1 - d/${mB} = (${dec(G, 6)})^{-1/${mB * T}} = ${dec(Math.pow(G, -1 / (mB * T)), 6)}$` },
          { title: "Nominal rate of discount", body: `$d = ${mB}(1 - ${dec(Math.pow(G, -1 / (mB * T)), 6)}) = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Through the annual effective rate",
            body: `Fund B's annual factor is $(${dec(G, 6)})^{1/${T}}$; convert it to $d$ (effective discount) and then to $d^{(${mB})} = ${mB}[1 - (1-d)^{1/${mB}}]$.`,
            whenUseful: "When the equivalence table $i \\leftrightarrow d \\leftrightarrow d^{(m)}$ is more familiar than the direct route.",
          },
        ],
        transfer: {
          principle: "Every rate basis is a statement about an accumulation factor; set up the equation of value in factors, then translate the factor into the basis asked for.",
          unusual: "The two funds start at different dates and use different conversion bases.",
          misread: "Treating a rate of discount as a rate of interest when converting.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "Fix Fund B's growth, then translate it",
          nodes: [
            { id: "a", label: `Fund A at year ${n}`, detail: `$${mnum(AV, 2)}$`, tone: "input" },
            { id: "g", label: "Required growth factor", detail: `$${dec(G, 6)}$ over ${T} years`, tone: "step" },
            { id: "d", label: `Nominal discount convertible ${fB}`, tone: "result" },
          ],
          edges: [
            { from: "a", to: "g", label: `÷ ${amt(Y)}` },
            { from: "g", to: "d", label: `root, then × ${mB}` },
          ],
        },
      ],
      markers: [AV, G],
      presentation: ["unknown-rate", "valuation-date", "frequency"],
      features: features({ steps: 4, multipleValuationDates: true, formulaRetrieval: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Fund A's annual effective rate.", ["i_A", Math.pow(1 + jA / mA, mA) - 1, "Fund A annual effective rate"], ["j_A", "m_A"]),
          step("A.compound", "Fund A's balance at the comparison date.", ["AV_A", AV, `Fund A at year ${n}`], ["X", "i_A", "n"], { valuationDate: `${n}` }),
          step("A.equation-of-value", "Equal balances give Fund B's growth factor.", ["G", G, `Fund B's growth over ${T} years`], ["AV_A", "Y"], { valuationDate: `${n}` }),
          step("A.nominal-equivalence", "Translate the growth factor into a nominal rate of discount.", ["d", answer, `d^(${mB})`], ["G", "m_B"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "rearrangement"],
          stages: {
            RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
            TIMING_IGNORED_DEFERRAL: [2, "application"],
            TIMING_DEFERRAL_OFF_BY_ONE: [2, "application"],
            RATE_DISCOUNT_AS_INTEREST: [3, "selection"],
            VAR_OTHER_UNKNOWN: [3, "interpretation"],
          },
          reasoning: "Write the equality at the comparison date in accumulation factors, isolate Fund B's factor, then convert it to the requested nominal basis.",
        }
      ),
      params: { X, Y, jA, mA, mB, n, k },
    };
  },
};

// ===================================================================== LOANS — interest over a window of a varying-payment loan

const interestWindow: QuestionTemplate = {
  id: "chal-loan-interest-window",
  family: "chal-loan-varying",
  topic: "LOANS",
  levels: [3],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.outstanding_balance", "ANNUITIES.arithmetic", "LOANS.unknown_variables"],
  reasoning: ["cashflow_modelling", "formula_selection", "financial_intuition", "multistep"],
  soaConcept: "Total interest in a run of payments of an arithmetically varying loan, from payments minus principal repaid.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const n = rng.int(8, 15);
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const Ln = gridAmount(rng, 50000, 300000, 5000);
    const level = Ln / an(n, i);
    const up = rng.next() < 0.5;
    const Qabs = Math.max(50, Math.round((level * rng.choice([0.04, 0.06, 0.08, 0.1])) / 50) * 50);
    const Q = up ? Qabs : -Qabs;
    const k = rng.int(3, n - 3);
    const late = rng.next() < 0.5;
    const P1 = (Ln - Q * (Ia(n, i) - an(n, i))) / an(n, i);
    const pay = (t: number) => P1 + (t - 1) * Q;
    const bal = (kk: number) => range(kk + 1, n).reduce((sum, t) => sum + pay(t) * Math.pow(1 + i, -(t - kk)), 0);
    const Bk = bal(k);
    const S = late ? range(k + 1, n).reduce((a, t) => a + pay(t), 0) : range(1, k).reduce((a, t) => a + pay(t), 0);
    const principal = late ? Bk : Ln - Bk;
    const answer = S - principal;

    const iS = L(i);
    const P1E = `((${L(Ln)} - ${L(Q)}*(${IaE(n, iS)} - ${aE(n, iS)}))/${aE(n, iS)})`;
    const BkE = (kk: number) => `((${P1E} + ${kk}*${L(Q)})*${aE(n - kk, iS)} + ${L(Q)}*(${IaE(n - kk, iS)} - ${aE(n - kk, iS)}))`;
    const sumIdx = late ? ((n - 1) * n) / 2 - ((k - 1) * k) / 2 : ((k - 1) * k) / 2;
    const count = late ? n - k : k;
    const SE = `(${count}*${P1E} + ${L(Q)}*${sumIdx})`;
    const calc = late ? `${SE} - ${BkE(k)}` : `${SE} - (${L(Ln)} - ${BkE(k)})`;
    // Model: first payment from the explicit equation of value, then interest = payments − principal.
    const P1M = `((${L(Ln)} - ${sumOf(range(1, n).map((t) => `${t - 1}*${L(Q)}*(1+${iS})**(-${t})`))})/${sumOf(range(1, n).map((t) => `(1+${iS})**(-${t})`))})`;
    const payM = (t: number) => `(${P1M} + ${t - 1}*${L(Q)})`;
    const model = late
      ? sumOf(range(k + 1, n).map((t) => `${payM(t)}*(1-(1+${iS})**(-${t - k}))`))
      : `${sumOf(range(1, k).map((t) => payM(t)))} - ${L(Ln)} + ${sumOf(range(k + 1, n).map((t) => `${payM(t)}*(1+${iS})**(-${t - k})`))}`;

    const levelAns = late ? (n - k) * level - level * an(n - k, i) : k * level - (Ln - level * an(n - k, i));
    const levelE = `(${L(Ln)}/${aE(n, iS)})`;
    const levelCalc = late ? `${n - k}*${levelE} - ${levelE}*${aE(n - k, iS)}` : `${k}*${levelE} - (${L(Ln)} - ${levelE}*${aE(n - k, iS)})`;
    const idx = late ? Bk - bal(k + 1) : bal(k - 1) - Bk;
    const wrongIndex = late ? S - bal(k + 1) : S - (Ln - bal(k - 1));
    const wrongIndexE = late ? `${SE} - ${BkE(k + 1)}` : `${SE} - (${L(Ln)} - ${BkE(k - 1)})`;
    const onOriginal = i * Ln * count;
    const extraTerm = late ? answer + pay(k) : answer + pay(k + 1);
    const extraTermE = late ? `${calc} + (${P1E} + ${k - 1}*${L(Q)})` : `${calc} + (${P1E} + ${k}*${L(Q)})`;
    const range1 = late ? `${k + 1}` : "1";
    const range2 = late ? `${n}` : `${k}`;

    return {
      stem: `A loan of ${amt(Ln)} is repaid by ${n} annual payments, the first one year after the loan is made. Each payment is ${amt(Qabs)} ${up ? "more" : "less"} than the previous payment. The annual effective interest rate is ${pc(i)}.\n\nCalculate the total amount of interest paid in payments ${range1} through ${range2}.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `payments $${mnum(S, 2)}$ minus principal repaid $${mnum(principal, 2)}$ $= ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: late
          ? `Interest in payments ${k + 1}–${n} = Σ P_t − B_${k}, with $B_{${k}} = \\sum P_t v^{t-${k}}$ and $P_1$ fixed by the loan's equation of value.`
          : `Interest in payments 1–${k} = Σ P_t − (L − B_${k}), with $B_{${k}} = \\sum_{t>${k}} P_t v^{t-${k}}$.`,
      },
      distractors: [
        distractor("VAR_TOTAL_FOR_COMPONENT", S, SE, {
          derivation: `$\\sum P_t = ${shown(S, fmt)}$`,
          method: "Added the payments without removing the principal they repay.",
          feedback: "Each payment is interest plus principal; the principal repaid over the window is the drop in the outstanding balance.",
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", levelAns, levelCalc, {
          derivation: `level payment $${mnum(level, 2)}$: interest $= ${shown(levelAns, fmt)}$`,
          method: "Treated the loan as repaid by level payments.",
          feedback: `The payments ${up ? "increase" : "decrease"} by ${amt(Qabs)} each year, which changes how fast principal is repaid and so the interest in any window.`,
        }),
        distractor("TIMING_BALANCE_INDEX", wrongIndex, wrongIndexE, {
          derivation: `balance after payment ${late ? k + 1 : k - 1} used: $${shown(wrongIndex, fmt)}$`,
          method: `Used the balance just after payment ${late ? k + 1 : k - 1} as the dividing point.`,
          feedback: `Payments ${range1}–${range2} repay exactly the change in balance across that window, measured just after payment ${k}. The balances differ by $${mnum(idx, 2)}$.`,
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", onOriginal, `${iS}*${L(Ln)}*${count}`, {
          derivation: `$${count} \\times ${dec(i, 3)} \\times ${mamt(Ln)} = ${shown(onOriginal, fmt)}$`,
          method: "Charged a year's interest on the original loan for every payment in the window.",
          feedback: "Interest each year is charged on the balance outstanding at the start of that year, which falls as principal is repaid.",
        }),
        distractor("SEQ_TERM_COUNT", extraTerm, extraTermE, {
          derivation: `${count + 1} payments summed: $${shown(extraTerm, fmt)}$`,
          method: `Included payment ${late ? k : k + 1} in the sum.`,
          feedback: `Payments ${range1} through ${range2} are ${count} payments.`,
        }),
      ],
      explanation: explanation({
        intuition: "There is no need to build the schedule. Over any run of payments, the principal repaid is the fall in the outstanding balance, and everything else paid was interest. So the task reduces to one balance and one arithmetic sum.",
        translation: {
          unknowns: [
            { symbol: "$P_1$", meaning: "the first payment" },
            { symbol: `$B_{${k}}$`, meaning: `balance just after payment ${k}` },
          ],
          relationships: [
            `$${mamt(Ln)} = P_1\\,${aSym(n)} + ${mamt(Q)}\\left[(Ia)_{\\overline{${n}|}} - ${aSym(n)}\\right]$`,
            `$B_{${k}} = \\sum_{t=${k + 1}}^{${n}} P_t\\,v^{t-${k}}$`,
            late ? `Interest $= \\sum_{t=${k + 1}}^{${n}} P_t - B_{${k}}$` : `Interest $= \\sum_{t=1}^{${k}} P_t - (${mamt(Ln)} - B_{${k}})$`,
          ],
          conditions: [`$P_t = P_1 + (t-1)(${mamt(Q)})$`],
          valuationDate: `Time 0 for the loan; time ${k} for the balance.`,
          modelChoice: "Prospective balance of the remaining arithmetic payments; interest = payments − principal.",
          assumptions: ["Payments are made exactly as scheduled.", "The rate is constant."],
        },
        solution: [
          { title: "First payment", body: `$P_1 = ${mnum(P1, 2)}$` },
          { title: `Balance after payment ${k}`, body: `$B_{${k}} = ${mnum(Bk, 2)}$` },
          { title: "Payments in the window", body: `$\\sum P_t = ${count}(${mnum(P1, 2)}) + ${mamt(Q)} \\times ${sumIdx} = ${mnum(S, 2)}$` },
          { title: "Interest", body: `$${mnum(S, 2)} - ${mnum(principal, 2)} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Interest year by year",
            body: `Interest in year $t$ is $i\\,B_{t-1}$; summing these over the window gives the same total but needs every balance.`,
            whenUseful: "Only for short windows.",
          },
        ],
        transfer: {
          principle: "Total interest over a window = total payments in the window − (balance at the start − balance at the end).",
          unusual: "The payments vary arithmetically and the first payment is not given.",
          misread: "Using the balance at the wrong payment, or charging interest on the original loan.",
        },
      }),
      visuals: [
        {
          kind: "amortization",
          title: "Varying payments and the balance",
          principal: Ln,
          rate: i,
          payments: range(1, n).map(pay),
          unit: "year",
          highlightPeriod: k,
        },
      ],
      markers: [P1, Bk, S],
      presentation: ["inverse", "hidden-structure"],
      features: features({ steps: 4, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("B.increasing", "The loan's equation of value fixes the first payment.", ["P_1", P1, "first payment"], ["L", "Q", "i", "n"], { rearranged: true }),
          step("D.prospective", "Balance just after payment k from the remaining payments.", ["B_k", Bk, `balance after payment ${k}`], ["P_1", "Q", "i"], { valuationDate: `${k}` }),
          step("M.arithmetic-series", "Total of the payments in the window.", ["S", S, "sum of payments"], ["P_1", "Q"]),
          step("D.total-interest", "Interest is what the payments contain beyond principal repaid.", ["I", answer, "total interest in the window"], ["S", "B_k"], { derived: true }),
        ],
        {
          methods: ["decomposition", "arithmetic_series", "rearrangement"],
          stages: {
            MODEL_LEVEL_FOR_VARYING: [0, "selection"],
            TIMING_BALANCE_INDEX: [1, "application"],
            SEQ_TERM_COUNT: [2, "application"],
            VAR_TOTAL_FOR_COMPONENT: [3, "interpretation"],
            MODEL_INTEREST_ON_ORIGINAL: [3, "selection", "D.interest-component"],
          },
          reasoning: "Interest in a window is payments minus the fall in the balance; find the first payment, one balance and one arithmetic sum.",
        }
      ),
      params: { L: Ln, n, i, Q, k, late },
    };
  },
};

// ===================================================================== LOANS — drop payment after an extra repayment

const dropAfterExtra: QuestionTemplate = {
  id: "chal-loan-drop-extra",
  family: "chal-loan-final",
  topic: "LOANS",
  levels: [3],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.outstanding_balance", "LOANS.unknown_variables", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "algebra", "multistep"],
  soaConcept: "A loan repaid by level payments and a smaller final (drop) payment, after an additional repayment shortens the term.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const m = rng.choice([1, 2, 4]);
    const draw = drawUntil(
      () => {
        const j = m === 1 ? gridRate(rng, 0.04, 0.09, 0.005) : gridRate(rng, 0.04, 0.09, 0.005);
        const jp = j / m;
        const Ln = gridAmount(rng, 20000, 150000, 1000);
        const N0 = rng.int(12, 30);
        const P = Math.ceil(Ln / an(N0, jp) / 10) * 10;
        const k = rng.int(3, Math.max(4, Math.floor(N0 / 3)));
        const E = gridAmount(rng, Math.max(500, Math.round((Ln * 0.05) / 500) * 500), Math.max(1000, Math.round((Ln * 0.2) / 500) * 500), 500);
        const Bk = Ln * Math.pow(1 + jp, k) - P * sn(k, jp);
        const B1 = Bk - E;
        const ratio = 1 - (B1 * jp) / P;
        const Nstar = ratio > 0 ? -Math.log(ratio) / Math.log(1 + jp) : Number.NaN;
        return { j, jp, Ln, P, k, E, Bk, B1, Nstar };
      },
      (p) => p.B1 > 3 * p.P && Number.isFinite(p.Nstar) && p.Nstar - Math.floor(p.Nstar) > 0.15 && p.Nstar - Math.floor(p.Nstar) < 0.85
    );
    const { j, jp, Ln, P, k, E, Bk, B1, Nstar } = draw;
    const N = Math.floor(Nstar);
    const BN = B1 * Math.pow(1 + jp, N) - P * sn(N, jp);
    const answer = BN * (1 + jp);

    const jpS = m === 1 ? L(j) : `(${L(j)}/${m})`;
    const dropE = (loan: string, rate: string, kk: number, extra: string, NN: number) =>
      `((${loan}*(1+${rate})**${kk} - ${L(P)}*${sE(kk, rate)} - ${extra})*(1+${rate})**${NN} - ${L(P)}*${sE(NN, rate)})*(1+${rate})`;
    const calc = dropE(L(Ln), jpS, k, L(E), N);
    const T = k + N + 1;
    const model = `${L(Ln)} - ${sumOf(range(1, k + N).map((t) => `${L(P)}*(1+${jpS})**(-${t})`))} - ${L(E)}*(1+${jpS})**(-${k}) - x*(1+${jpS})**(-${T})`;

    // Generic drop for alternative inputs.
    const dropFor = (balanceAfterK: number, rate: number) => {
      const ns = -Math.log(1 - (balanceAfterK * rate) / P) / Math.log(1 + rate);
      const nn = Math.floor(ns);
      const bn = balanceAfterK * Math.pow(1 + rate, nn) - P * sn(nn, rate);
      return { nn, value: bn * (1 + rate), frac: ns - nn };
    };
    const ignore = dropFor(Bk, jp);
    const atZero = dropFor((Ln - E) * Math.pow(1 + jp, k) - P * sn(k, jp), jp);
    const balloon = P + BN;
    const frac = P * (Nstar - N);
    const distractors: DistractorCandidate[] = [
      distractor("CHAL_BALLOON_FOR_DROP", balloon, `${L(P)} + ${calc}/(1+${jpS})`, {
        derivation: `$${mamt(P)} + B_{${k + N}} = ${mamt(P)} + ${mnum(BN, 2)} = ${shown(balloon, fmt)}$`,
        method: "Added the remaining balance to the last regular payment.",
        feedback: `The final payment is made one ${periodNoun(m)} after the last payment of ${amt(P)}, so it is the remaining balance with one more ${periodNoun(m)} of interest: $${mnum(BN, 2)}(1 + ${dec(jp, 4)})$.`,
      }),
      distractor("TIMING_MISSING_PERIOD", BN, `${calc}/(1+${jpS})`, {
        derivation: `$B_{${k + N}} = ${shown(BN, fmt)}$`,
        method: "Paid off the balance without the last period's interest.",
        feedback: `The balance ${amt(Number(BN.toFixed(2)))} is owed at time ${k + N}; paid one ${periodNoun(m)} later it has grown by $1 + ${dec(jp, 4)}$.`,
      }),
      distractor("TRANS_IGNORED_CONDITION", ignore.value, dropE(L(Ln), jpS, k, "0", ignore.nn), {
        derivation: `without the extra payment: ${ignore.nn} further payments, final $= ${shown(ignore.value, fmt)}$`,
        method: "Ignored the additional payment.",
        feedback: `The extra ${amt(E)} reduces the balance at time ${k} and so shortens the loan.`,
      }),
      distractor("TIMING_VALUATION_DATE", atZero.value, dropE(L(Ln - E), jpS, k, "0", atZero.nn), {
        derivation: `$(${mamt(Ln)} - ${mamt(E)})$ accumulated from time 0: final $= ${shown(atZero.value, fmt)}$`,
        method: "Subtracted the extra payment from the original loan at time 0.",
        feedback: `The extra payment is made at time ${k}; it reduces the balance at that date, not the amount borrowed.`,
      }),
      distractor("CHAL_FRACTIONAL_PAYMENT", frac, `${L(P)}*(${L(Nstar)} - ${N})`, {
        derivation: `$n = ${dec(Nstar, 4)}$; $${mamt(P)} \\times ${dec(Nstar - N, 4)} = ${shown(frac, fmt)}$`,
        method: "Took the fractional part of the solved number of payments times the payment.",
        feedback: "The fraction of a period is not the fraction of a payment: the final payment is the balance after the last full payment, with interest.",
      }),
    ];
    if (m > 1) {
      const jq = Math.pow(1 + j, 1 / m) - 1;
      const BkQ = Ln * Math.pow(1 + jq, k) - P * sn(k, jq) - E;
      const alt = dropFor(BkQ, jq);
      if (Number.isFinite(alt.value) && alt.value > 0) {
        const jqS = `((1+${L(j)})**(1/${m})-1)`;
        distractors.push(
          distractor("RATE_NOMINAL_AS_EFFECTIVE", alt.value, dropE(L(Ln), jqS, k, L(E), alt.nn), {
            derivation: `${periodNoun(m)}ly rate $(${dec(1 + j, 3)})^{1/${m}} - 1 = ${dec(jq, 6)}$: final $= ${shown(alt.value, fmt)}$`,
            method: `Treated ${pc(j)} as an annual effective rate.`,
            feedback: `Convertible ${frequency(m)} means the ${periodNoun(m)}ly rate is $${dec(j, 3)}/${m} = ${dec(jp, 4)}$.`,
          })
        );
      }
    }
    const periodWord = periodNoun(m);
    const rateText = m === 1 ? `an annual effective rate of ${pc(j)}` : `an annual nominal rate of ${pc(j)} convertible ${frequency(m)}`;

    return {
      stem: `A loan of ${amt(Ln)} is repaid by payments of ${amt(P)} at the end of each ${periodWord}, followed by a smaller final payment made one ${periodWord} after the last payment of ${amt(P)}. Interest is charged at ${rateText}.\n\nTogether with the ${ord(k)} payment, the borrower makes an additional payment of ${amt(E)}. Payments of ${amt(P)} then continue until the smaller final payment.\n\nCalculate the amount of the final payment.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `${N} more payments of ${amt(P)}; $B_{${k + N}}(1 + ${dec(jp, 4)}) = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        bracket: [0, 2 * P],
        description: `Loan = PV of ${k + N} payments of ${amt(P)}, the extra ${amt(E)} at time ${k} and the final payment $x$ at time ${T}.`,
      },
      distractors,
      explanation: explanation({
        intuition: "After the extra payment the loan is a new, smaller loan with the same payment. Find how many full payments it still needs, then whatever is left — with one more period of interest — is the final payment.",
        translation: {
          unknowns: [
            { symbol: "$N$", meaning: "number of full payments after the extra payment" },
            { symbol: "$F$", meaning: "the final payment" },
          ],
          relationships: [
            `$B_{${k}} = ${mamt(Ln)}(1+j)^{${k}} - ${mamt(P)}\\,s_{\\overline{${k}|}} - ${mamt(E)}$`,
            `$${mamt(P)}\\,a_{\\overline{n|}} = B_{${k}}$ gives $n = ${dec(Nstar, 4)}$, so $N = ${N}$`,
            `$F = \\left[B_{${k}}(1+j)^{${N}} - ${mamt(P)}\\,s_{\\overline{${N}|}}\\right](1+j)$`,
          ],
          conditions: [`$j = ${dec(jp, 4)}$ per ${periodWord}.`, `The final payment is one ${periodWord} after the last full payment.`],
          valuationDate: `Time ${k} after the extra payment; final payment at time ${T}.`,
          modelChoice: "Retrospective balance, then solve for the number of payments, then a drop payment.",
          assumptions: ["Payments are made exactly as scheduled.", "The rate is constant."],
        },
        solution: [
          { title: `Balance after payment ${k}`, body: `$${mnum(Bk, 2)} - ${mamt(E)} = ${mnum(B1, 2)}$` },
          { title: "Full payments remaining", body: `$${mamt(P)}\\,a_{\\overline{n|}} = ${mnum(B1, 2)} \\Rightarrow n = ${dec(Nstar, 4)}$, so ${N} full payments` },
          { title: "Balance after the last full payment", body: `$B_{${k + N}} = ${mnum(BN, 2)}$` },
          { title: "Final payment", body: `$${mnum(BN, 2)}(1 + ${dec(jp, 4)}) = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Equation of value at the final date",
            body: `Accumulate the balance after the extra payment to time ${T} and subtract the accumulated full payments: $F = B_{${k}}(1+j)^{${N + 1}} - ${mamt(P)}\\,\\ddot{s}_{\\overline{${N}|}}$.`,
            whenUseful: "A single line once N is known.",
          },
        ],
        transfer: {
          principle: "An extra payment only changes the balance at its date; after that the loan is re-solved with the same payment.",
          unusual: "The number of remaining payments must be found before the final payment can be.",
          misread: "Confusing a drop payment (one period later) with a balloon payment (with the last regular payment).",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "From the extra payment to the final payment",
          nodes: [
            { id: "b", label: `Balance after payment ${k}`, detail: `$${mnum(B1, 2)}$`, tone: "input" },
            { id: "n", label: "Solve for n", detail: `$n = ${dec(Nstar, 3)}$ → ${N} full payments`, tone: "step" },
            { id: "r", label: "Remaining balance", detail: `$${mnum(BN, 2)}$`, tone: "step" },
            { id: "f", label: "Final payment", detail: `one ${periodWord} later`, tone: "result" },
          ],
          edges: [
            { from: "b", to: "n" },
            { from: "n", to: "r" },
            { from: "r", to: "f", label: "× (1 + j)" },
          ],
        },
      ],
      markers: [Bk, B1, Nstar, BN],
      presentation: ["unknown-time", "hidden-structure", "valuation-date"],
      features: features({ steps: 5, multipleValuationDates: true, unfamiliar: true }),
      chain: chain(
        [
          step(m === 1 ? "A.effective-interest" : "A.nominal-equivalence", "Rate per payment period.", ["j", jp, `rate per ${periodWord}`], ["i"]),
          step("D.retrospective", `Balance just after payment ${k}.`, ["B_k", Bk, `balance after payment ${k}`], ["L", "P", "j", "k"], { valuationDate: `${k}` }),
          step("D.balance-recursion", "The extra payment reduces the balance at its date.", ["B_k'", B1, "balance after the extra payment"], ["B_k", "E"]),
          step("M.logarithm", "Number of full payments the reduced balance needs.", ["n", Nstar, "payments solving P a_n = B"], ["B_k'", "P", "j"], { rearranged: true }),
          step("D.drop-balloon", "Final payment one period after the last full payment.", ["F", answer, "drop payment"], ["B_k'", "N", "j"]),
        ],
        {
          methods: ["logarithms", "valuation_dates"],
          stages: {
            RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
            TIMING_VALUATION_DATE: [2, "application"],
            TRANS_IGNORED_CONDITION: [2, "connection"],
            CHAL_FRACTIONAL_PAYMENT: [4, "selection"],
            CHAL_BALLOON_FOR_DROP: [4, "selection"],
            TIMING_MISSING_PERIOD: [4, "application"],
          },
          reasoning: "Reduce the balance at the extra payment's date, solve for how many full payments fit, and pay the remainder with one more period of interest.",
        }
      ),
      params: { L: Ln, P, j, m, k, E, N },
    };
  },
};

// ===================================================================== BONDS — sale price against book value

const saleAgainstBook: QuestionTemplate = {
  id: "chal-bond-sale-book",
  family: "chal-bond-book",
  topic: "BONDS",
  levels: [3],
  objective: "BONDS.book_market",
  secondary: ["BONDS.price_redemption", "TVM.effective_nominal"],
  reasoning: ["concept_recognition", "valuation_dates", "formula_selection", "multistep"],
  soaConcept: "Book value at the purchase yield against market value at a new yield, with semiannual coupons and annual effective yields.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const F = rng.choice([1000, 5000, 10000]);
    const Cmult = rng.choice([1, 1, 1.05, 1.1]);
    const C = F * Cmult;
    const r = gridRate(rng, 0.03, 0.08, 0.005);
    const n = rng.int(8, 20);
    const k = rng.int(2, n - 3);
    const y1 = gridRate(rng, 0.04, 0.09, 0.005);
    const down = rng.next() < 0.5;
    const shift = gridRate(rng, 0.005, 0.02, 0.0025);
    const y2 = down ? y1 - shift : y1 + shift;
    const h = (y: number) => Math.sqrt(1 + y) - 1;
    const h1 = h(y1);
    const h2 = h(y2);
    const N = 2 * n;
    const R = 2 * (n - k);
    const cpn = (F * r) / 2;
    const pv = (rate: number, periods: number) => cpn * an(periods, rate) + C * Math.pow(1 + rate, -periods);
    const P0 = Number(pv(h1, N).toFixed(2));
    const BV = pv(h1, R);
    const MV = pv(h2, R);
    const signed = (mv: number, bv: number) => (down ? mv - bv : bv - mv);
    const answer = signed(MV, BV);

    const pvE = (rate: string, periods: number) => `(${L(cpn)}*${aE(periods, rate)} + ${L(C)}*${vE(rate, periods)})`;
    const hE = (y: number) => `((1+${L(y)})**0.5-1)`;
    const BVE = pvE(hE(y1), R);
    const MVE = pvE(hE(y2), R);
    const sgn = (mv: string, bv: string) => (down ? `${mv} - ${bv}` : `${bv} - ${mv}`);
    const calc = sgn(MVE, BVE);
    const pvM = (y: number) => `(${sumOf(range(1, R).map((t) => `${L(cpn)}*(1+${L(y)})**(-${t}/2)`))} + ${L(C)}*(1+${L(y)})**(-${R / 2}))`;
    const model = sgn(pvM(y2), pvM(y1));

    const divided = signed(pv(y2 / 2, R), pv(y1 / 2, R));
    const annualPer = signed(pv(y2, R), pv(y1, R));
    const vsPaid = signed(MV, P0);
    const BVsl = P0 + ((C - P0) * k) / n;
    const straight = signed(MV, BVsl);
    const redemption = Cmult === 1 ? "" : `, redeemable at ${amt(C)},`;
    const moveText = down ? "exceeds" : "is less than";

    return {
      stem: `A ${n}-year bond with a par value of ${amt(F)}${redemption} pays coupons semiannually at an annual rate of ${pc(r)}. An investor buys the bond at issue for ${amt(P0)}, a price that gives an annual effective yield of ${pc(y1)}.\n\nAt the end of year ${k}, immediately after a coupon is paid, the investor sells the bond at a price that gives the buyer an annual effective yield of ${pc(y2)}.\n\nCalculate the amount by which the sale price ${down ? "exceeds the investor's book value of the bond" : "is less than the investor's book value of the bond"} at the time of sale.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$|${mnum(MV, 2)} - ${mnum(BV, 2)}| = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: `The same ${R} remaining coupons and redemption, discounted half-year by half-year at $(1+y)^{-t/2}$: once at ${pc(y2)} (sale price) and once at ${pc(y1)} (book value).`,
      },
      distractors: [
        distractor("RATE_DIVIDED_EFFECTIVE", divided, sgn(pvE(`(${L(y2)}/2)`, R), pvE(`(${L(y1)}/2)`, R)), {
          derivation: `half-year rates $y/2$: $${shown(divided, fmt)}$`,
          method: "Halved the annual effective yields to get half-year rates.",
          feedback: `An annual effective yield ${pc(y1)} corresponds to $(${dec(1 + y1, 3)})^{1/2} - 1 = ${dec(h1, 6)}$ per half-year, not ${dec(y1 / 2, 4)}.`,
        }),
        distractor("RATE_ANNUAL_FOR_PERIODIC", annualPer, sgn(pvE(L(y2), R), pvE(L(y1), R)), {
          derivation: `annual yields used per half-year: $${shown(annualPer, fmt)}$`,
          method: "Discounted each half-year at the full annual effective yield.",
          feedback: "The coupons are half a year apart, so each discount step uses the half-year rate.",
        }),
        distractor("TRANS_IRRELEVANT_INFO", vsPaid, sgn(MVE, L(P0)), {
          derivation: `book value taken as the price paid ${amt(P0)}: $${shown(vsPaid, fmt)}$`,
          method: "Compared the sale price with the original purchase price.",
          feedback: `Book value changes every coupon: after ${2 * k} coupons it is the present value of the remaining payments at the purchase yield, ${amt(Number(BV.toFixed(2)))}.`,
        }),
        distractor("MODEL_STRAIGHT_LINE", straight, sgn(MVE, `(${L(P0)} + (${L(C)} - ${L(P0)})*${k}/${n})`), {
          derivation: `book value $${mamt(P0)} + (${mamt(C)} - ${mamt(P0)})\\tfrac{${k}}{${n}} = ${mnum(BVsl, 2)}$; difference $${shown(straight, fmt)}$`,
          method: "Moved the book value from the price to the redemption value in equal steps.",
          feedback: "Book value follows the yield method: it is the present value of the remaining cash flows at the purchase yield.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", MV, MVE, {
          derivation: `sale price $= ${shown(MV, fmt)}$`,
          method: "Reported the sale price.",
          feedback: "The question asks for the gap between the sale price and the book value.",
        }),
      ],
      explanation: explanation({
        intuition: "Book value and sale price are present values of exactly the same remaining payments; the only difference is the rate. Book value uses the yield the investor bought at, the sale price uses the buyer's yield. The price paid at issue is not needed.",
        translation: {
          unknowns: [
            { symbol: "$BV$", meaning: `book value after ${2 * k} coupons, at the purchase yield` },
            { symbol: "$MV$", meaning: "sale price at the buyer's yield" },
          ],
          relationships: [
            `$j_1 = (1 + ${dec(y1, 3)})^{1/2} - 1 = ${dec(h1, 6)}$, $j_2 = (1 + ${dec(y2, 3)})^{1/2} - 1 = ${dec(h2, 6)}$`,
            `$BV = ${mamt(cpn)}\\,${aSym(R)}{}_{\\,j_1} + ${mamt(C)}\\,v_{j_1}^{${R}}$`,
            `$MV = ${mamt(cpn)}\\,${aSym(R)}{}_{\\,j_2} + ${mamt(C)}\\,v_{j_2}^{${R}}$`,
          ],
          conditions: [`${R} coupons of ${amt(cpn)} remain.`, "The sale is immediately after a coupon."],
          valuationDate: `End of year ${k}.`,
          modelChoice: "Prospective valuation of the remaining payments at two different rates.",
          assumptions: ["Book value is on the yield (amortization) basis at the purchase yield.", "Yields are annual effective; coupons are half-yearly."],
        },
        solution: [
          { title: "Half-year rates", body: `$j_1 = ${dec(h1, 6)}$, $j_2 = ${dec(h2, 6)}$` },
          { title: "Book value", body: `$BV = ${mnum(BV, 2)}$` },
          { title: "Sale price", body: `$MV = ${mnum(MV, 2)}$` },
          { title: "Difference", body: `$${down ? `${mnum(MV, 2)} - ${mnum(BV, 2)}` : `${mnum(BV, 2)} - ${mnum(MV, 2)}`} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Retrospective book value",
            body: `$BV = ${mamt(P0)}(1+j_1)^{${2 * k}} - ${mamt(cpn)}\\,s_{\\overline{${2 * k}|}\\,j_1}$ gives the same ${amt(Number(BV.toFixed(2)))}: here the price paid is a check, not an input.`,
            whenUseful: "When the remaining term is long and the elapsed term short.",
          },
        ],
        transfer: {
          principle: "Book value and market value differ only in the rate used: purchase yield versus current yield, applied to the same remaining cash flows.",
          unusual: "Yields are annual effective while coupons are semiannual, and the original price is given but not needed.",
          misread: `Comparing with the original price, or halving an annual effective rate. The sale price ${moveText} the book value because the yield ${down ? "fell" : "rose"}.`,
        },
      }),
      visuals: [
        {
          kind: "bond",
          title: "Remaining payments at the sale date",
          face: F,
          couponRate: r / 2,
          redemption: C,
          yieldRate: h2,
          periods: R,
          unit: "half-year",
        },
      ],
      markers: [h1, h2, BV, MV],
      presentation: ["frequency", "irrelevant-info", "valuation-date", "compare-streams"],
      features: features({ steps: 5, multipleValuationDates: true, multiConcept: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Half-year rate equivalent to the purchase yield.", ["j_1", h1, "half-year purchase yield"], ["y_1"]),
          step("E.book-value", "Book value: remaining payments at the purchase yield.", ["BV", BV, "book value"], ["j_1", "R"], { valuationDate: `${k}` }),
          step("A.nominal-equivalence", "Half-year rate equivalent to the buyer's yield.", ["j_2", h2, "half-year market yield"], ["y_2"]),
          step("E.price", "Sale price: remaining payments at the buyer's yield.", ["MV", MV, "market value"], ["j_2", "R"], { valuationDate: `${k}` }),
          step("E.book-value", "Compare the sale price with the book value.", ["Δ", answer, "gap between market and book value"], ["MV", "BV"]),
        ],
        {
          methods: ["valuation_dates", "rearrangement"],
          stages: {
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            RATE_ANNUAL_FOR_PERIODIC: [0, "selection"],
            TRANS_IRRELEVANT_INFO: [1, "selection"],
            MODEL_STRAIGHT_LINE: [1, "selection"],
            VAR_TOTAL_FOR_COMPONENT: [4, "interpretation"],
          },
          reasoning: "Value the same remaining cash flows twice — at the purchase yield (book) and at the buyer's yield (market) — after converting both yields to half-year rates.",
        }
      ),
      params: { F, C, r, n, k, y1, y2 },
    };
  },
};

// ===================================================================== BONDS — reconstruct from two amortization amounts

const amortizationReconstruct: QuestionTemplate = {
  id: "chal-bond-amortization-pair",
  family: "chal-bond-amortization",
  topic: "BONDS",
  levels: [3],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.yield"],
  reasoning: ["formula_reconstruction", "algebra", "translation", "multistep"],
  soaConcept: "Two amounts of premium amortization (or discount accumulation) reveal the yield and the coupon gap; the total over a later run of coupons follows.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const m = rng.choice([1, 2]);
    const F = rng.choice([5000, 10000, 20000]);
    const years = m === 2 ? rng.int(8, 15) : rng.int(15, 25);
    const N = years * m;
    const jp = m === 2 ? gridRate(rng, 0.02, 0.04, 0.0025) : gridRate(rng, 0.04, 0.08, 0.005);
    const premium = rng.next() < 0.5;
    const gap = m === 2 ? gridRate(rng, 0.0025, 0.01, 0.0025) : gridRate(rng, 0.005, 0.02, 0.0025);
    const cp = premium ? jp + gap : jp - gap;
    const t1 = rng.int(1, Math.floor(N / 3));
    const t2 = rng.int(t1 + 4, Math.min(N - 4, t1 + 12));
    const t3 = rng.int(2, N - 5);
    const t4 = rng.int(t3 + 3, Math.min(N - 1, t3 + 9));
    const K = t4 - t3 + 1;
    const D = t2 - t1;
    const amort = (t: number) => Math.abs(F * cp - F * jp) * Math.pow(1 + jp, -(N - t + 1));
    const A1 = Number(amort(t1).toFixed(2));
    const A2 = Number(amort(t2).toFixed(2));
    const jr = Math.pow(A2 / A1, 1 / D) - 1;
    const G = A1 * Math.pow(1 + jr, N - t1 + 1);
    const sign = premium ? 1 : -1;
    const coupon = F * jr + sign * G;
    const windowSum = (g: number, rate: number) => g * (an(N - t3 + 1, rate) - an(N - t4, rate));
    const answer = windowSum(G, jr);
    const bvBefore = F + sign * G * an(N - t3 + 1, jr);
    const bvAfter = F + sign * G * an(N - t4, jr);

    const jE = `((${L(A2)}/${L(A1)})**(1/${D})-1)`;
    const GE = (rate: string, exp: number) => `(${L(A1)}*(1+${rate})**${exp})`;
    const winE = (g: string, rate: string) => `${g}*(${aE(N - t3 + 1, rate)} - ${aE(N - t4, rate)})`;
    const calc = winE(GE(jE, N - t1 + 1), jE);
    const couponE = `(${L(F)}*${jE} ${sign > 0 ? "+" : "-"} ${GE(jE, N - t1 + 1)})`;
    const bvM = (rem: number) => `(${sumOf(range(1, rem).map((t) => `${couponE}*(1+${jE})**(-${t})`))} + ${L(F)}*(1+${jE})**(-${rem}))`;
    const model = premium ? `${bvM(N - t3 + 1)} - ${bvM(N - t4)}` : `${bvM(N - t4)} - ${bvM(N - t3 + 1)}`;

    const jw = Math.pow(A2 / A1, 1 / (D + 1)) - 1;
    const rootErr = windowSum(A1 * Math.pow(1 + jw, N - t1 + 1), jw);
    const jwE = `((${L(A2)}/${L(A1)})**(1/${D + 1})-1)`;
    const offOne = answer / (1 + jr);
    const extra = answer + G * Math.pow(1 + jr, -(N - t4));
    const missing = answer - G * Math.pow(1 + jr, -(N - t3 + 1));
    const slope = (A2 - A1) / D;
    const linear = K * A1 + slope * (K * (t3 + t4)) / 2 - slope * K * t1;
    const kind = premium ? "premium amortized" : "discount accumulated";
    const per = m === 2 ? "semiannually" : "annually";
    const unit = m === 2 ? "half-year" : "year";

    return {
      stem: `A ${years}-year bond with a par value of ${amt(F)}, redeemable at par, pays coupons ${per}. It was bought at issue at a price that gives a constant yield rate. The amount of ${kind} in the ${ord(t1)} coupon is ${num2(A1)}, and the amount of ${kind} in the ${ord(t2)} coupon is ${num2(A2)}.\n\nCalculate the total amount of ${kind} in coupons ${t3} through ${t4}.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$j = ${dec(jr, 6)}$, $|Fr - Cj| = ${mnum(G, 4)}$; $${mnum(G, 4)}\\left(${aSym(N - t3 + 1)} - ${aSym(N - t4)}\\right) = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: `With the yield from the ratio of the two amounts and the coupon from the first amount, the total over coupons ${t3}–${t4} is the change in book value from just after coupon ${t3 - 1} to just after coupon ${t4}, each book value written as the PV of the remaining coupons and redemption.`,
      },
      distractors: [
        distractor("ALG_ROOT_ERROR", rootErr, winE(GE(jwE, N - t1 + 1), jwE), {
          derivation: `$(${num2(A2)}/${num2(A1)})^{1/${D + 1}} - 1 = ${dec(jw, 6)}$; total $= ${shown(rootErr, fmt)}$`,
          method: `Took the ${ord(D + 1)} root of the ratio.`,
          feedback: `The two amounts are ${D} coupons apart, so their ratio is $(1+j)^{${D}}$.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offOne, winE(GE(jE, N - t1), jE), {
          derivation: `$|Fr - Cj| = ${num2(A1)}(1+j)^{${N - t1}}$; total $= ${shown(offOne, fmt)}$`,
          method: `Used $v^{${N - t1}}$ for the ${ord(t1)} coupon's amount.`,
          feedback: `The amount in coupon $t$ is $|Fr - Cj|\\,v^{n-t+1}$: for $t = ${t1}$ that is $v^{${N - t1 + 1}}$.`,
        }),
        distractor("MODEL_STRAIGHT_LINE", linear, `${K}*${L(A1)} + (${L(A2)} - ${L(A1)})/${D}*(${K * (t3 + t4)}/2 - ${K * t1})`, {
          derivation: `amounts extended in equal steps of $${dec(slope, 4)}$: total $= ${shown(linear, fmt)}$`,
          method: "Assumed the amounts change by the same amount every coupon.",
          feedback: "Under the yield method the amounts grow by the factor $1 + j$ each coupon, not by a fixed amount.",
        }),
        distractor("TIMING_BALANCE_INDEX", missing, `${calc} - ${GE(jE, N - t1 + 1)}*(1+${jE})**(-${N - t3 + 1})`, {
          derivation: `$BV_{${t3}} - BV_{${t4}}$ used: $${shown(missing, fmt)}$`,
          method: `Measured the change in book value from just after coupon ${t3}.`,
          feedback: `Coupons ${t3}–${t4} change the book value from just after coupon ${t3 - 1} to just after coupon ${t4}.`,
        }),
        distractor("SEQ_TERM_COUNT", extra, `${calc} + ${GE(jE, N - t1 + 1)}*(1+${jE})**(-${N - t4})`, {
          derivation: `${K + 1} coupons summed: $${shown(extra, fmt)}$`,
          method: `Included coupon ${t4 + 1}.`,
          feedback: `Coupons ${t3} through ${t4} are ${K} coupons.`,
        }),
      ],
      explanation: explanation({
        intuition: `Under the yield method, the amount of ${kind} grows by the factor $1 + j$ every coupon. Two of them therefore reveal $j$, and either one then reveals the gap between the coupon and the interest at the yield. Every other amount — and any run of them — follows.`,
        translation: {
          unknowns: [
            { symbol: "$j$", meaning: `yield per ${unit}` },
            { symbol: "$|Fr - Cj|$", meaning: "coupon minus interest at the yield, per coupon" },
          ],
          relationships: [
            `Amount in coupon $t$: $|Fr - Cj|\\,v^{${N} - t + 1}$`,
            `$\\dfrac{${num2(A2)}}{${num2(A1)}} = (1+j)^{${D}}$`,
            `$\\sum_{t=${t3}}^{${t4}} |Fr - Cj|\\,v^{${N}-t+1} = |Fr - Cj|\\left(${aSym(N - t3 + 1)} - ${aSym(N - t4)}\\right)$`,
          ],
          conditions: [`${N} coupons in total.`, "Redeemable at par."],
          valuationDate: `Coupons ${t3} to ${t4}.`,
          modelChoice: "Amortization amounts form a geometric sequence; a run of them is a difference of annuity factors (or of book values).",
          assumptions: ["Book value on the yield (scientific) basis.", "Amounts as given, to the cent."],
        },
        solution: [
          { title: "Yield", body: `$(1+j)^{${D}} = ${dec(A2 / A1, 6)} \\Rightarrow j = ${dec(jr, 6)}$` },
          { title: "Coupon minus interest", body: `$|Fr - Cj| = ${num2(A1)}(1+j)^{${N - t1 + 1}} = ${mnum(G, 4)}$` },
          { title: "Discount factors for the run", body: `$${aSym(N - t3 + 1)} - ${aSym(N - t4)} = ${dec(an(N - t3 + 1, jr) - an(N - t4, jr), 6)}$` },
          { title: "Total", body: `$${mnum(G, 4)} \\times ${dec(an(N - t3 + 1, jr) - an(N - t4, jr), 6)} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Change in book value",
            body: `$BV_{${t3 - 1}} = ${mnum(bvBefore, 2)}$ and $BV_{${t4}} = ${mnum(bvAfter, 2)}$; the ${kind} over the run is the difference.`,
            whenUseful: "A check, and the link to book values.",
          },
        ],
        transfer: {
          principle: "Yield-method amortization amounts grow geometrically at the yield; their ratio gives the yield, their size gives the coupon gap, and a run of them is a change in book value.",
          unusual: "Neither the yield nor the coupon rate is given; both are recovered from the schedule.",
          misread: "Taking the wrong root, the wrong power of v for a coupon number, or the wrong endpoints of the run.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "Rebuild the bond from its schedule",
          nodes: [
            { id: "a", label: "Two amortization amounts", detail: `coupons ${t1} and ${t2}`, tone: "input" },
            { id: "j", label: "Yield", detail: `$j = ${dec(jr, 5)}$`, tone: "step" },
            { id: "g", label: "Coupon gap", detail: `$|Fr - Cj| = ${mnum(G, 2)}$`, tone: "step" },
            { id: "b", label: `Total over coupons ${t3}–${t4}`, tone: "result" },
          ],
          edges: [
            { from: "a", to: "j", label: "ratio, root" },
            { from: "j", to: "g" },
            { from: "g", to: "b" },
          ],
        },
      ],
      markers: [jr, G, coupon, bvBefore, bvAfter],
      presentation: ["work-backwards", "hidden-structure", "inverse"],
      features: features({ steps: 5, unfamiliar: true, multiConcept: true }),
      chain: chain(
        [
          step("E.bond-amortization", "Successive amounts grow by 1 + j: the ratio gives the yield.", ["j", jr, `yield per ${unit}`], ["A_t1", "A_t2"], { derived: true }),
          step("E.bond-amortization", "The first amount gives the coupon gap.", ["|Fr − Cj|", G, "coupon minus interest at the yield"], ["A_t1", "j"], { rearranged: true }),
          step("E.premium-discount", "Coupon from the gap.", ["Fr", coupon, "coupon"], ["G", "j"], { rearranged: true }),
          step("E.book-value", `Book value just after coupon ${t3 - 1}.`, ["BV", bvBefore, `book value after coupon ${t3 - 1}`], ["G", "j"], { valuationDate: `${t3 - 1}` }),
          step("E.bond-amortization", `Total over coupons ${t3}–${t4}.`, ["W", answer, `total ${kind}`], ["G", "j"]),
        ],
        {
          methods: ["work_backwards", "geometric_series"],
          stages: {
            ALG_ROOT_ERROR: [0, "application"],
            MODEL_STRAIGHT_LINE: [0, "selection"],
            TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
            TIMING_BALANCE_INDEX: [3, "application"],
            SEQ_TERM_COUNT: [4, "application"],
          },
          reasoning: "Amortization amounts are a geometric sequence in the yield: recover j from their ratio, the coupon gap from one amount, then sum the run as a difference of annuity factors.",
        }
      ),
      params: { F, m, N, A1, A2, t1, t2, t3, t4, premium },
    };
  },
};

/** An amount to the cent, as printed in a stem. */
function num2(value: number): string {
  return value.toFixed(2);
}

// ===================================================================== BONDS — step-up coupon solved from the price

const stepUpCoupon: QuestionTemplate = {
  id: "chal-bond-step-coupon",
  family: "chal-bond-coupons",
  topic: "BONDS",
  levels: [3],
  objective: "BONDS.coupons",
  secondary: ["BONDS.price_redemption", "ANNUITIES.immediate_due", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "algebra", "multistep"],
  soaConcept: "A bond whose coupon rate steps up part-way; recover the later coupon rate from the price.",
  generate(rng): QuestionDraft {
    const fmt = PCT2;
    const F = rng.choice([1000, 5000, 10000]);
    const C = F * rng.choice([1, 1, 1.05, 1.1]);
    const n = rng.int(10, 20);
    const n1 = rng.int(3, n - 4);
    const r1 = gridRate(rng, 0.03, 0.07, 0.005);
    const r2 = r1 + gridRate(rng, 0.01, 0.03, 0.005);
    const effective = rng.next() < 0.5;
    const y = gridRate(rng, 0.04, 0.09, 0.005);
    const h = effective ? Math.sqrt(1 + y) - 1 : y / 2;
    const N1 = 2 * n1;
    const N = 2 * n;
    const known = (rate: number) => ((F * r1) / 2) * an(N1, rate) + C * Math.pow(1 + rate, -N);
    const defer = (rate: number, shift = 0) => Math.pow(1 + rate, -(N1 + shift)) * an(N - N1, rate);
    const price = Number((known(h) + ((F * r2) / 2) * defer(h)).toFixed(2));
    const solve = (rate: number, k: number, d: number) => (2 * (price - k)) / (F * d);
    const answer = solve(h, known(h), defer(h));

    const hE = effective ? `((1+${L(y)})**0.5-1)` : `(${L(y)}/2)`;
    const knownE = (rate: string, withC = true) => `(${L((F * r1) / 2)}*${aE(N1, rate)}${withC ? ` + ${L(C)}*${vE(rate, N)}` : ""})`;
    const deferE = (rate: string, shift = 0) => `(${vE(rate, N1 + shift)}*${aE(N - N1, rate)})`;
    const solveE = (rate: string, withC = true, shift = 0) => `2*(${L(price)} - ${knownE(rate, withC)})/(${L(F)}*${deferE(rate, shift)})`;
    const calc = solveE(hE);
    const yv = (t: number) => (effective ? `(1+${L(y)})**(-${t}/2)` : `(1+${L(y)}/2)**(-${t})`);
    const model = `${sumOf(range(1, N1).map((t) => `${L((F * r1) / 2)}*${yv(t)}`))} + ${sumOf(range(N1 + 1, N).map((t) => `${L(F)}*x/2*${yv(t)}`))} + ${L(C)}*${yv(N)} - ${L(price)}`;

    const noDefer = solve(h, known(h), an(N - N1, h));
    const offOne = solve(h, known(h), defer(h, 1));
    const noRedemption = solve(h, ((F * r1) / 2) * an(N1, h), defer(h));
    const half = answer / 2;
    const hw = effective ? y / 2 : Math.sqrt(1 + y) - 1;
    const hwE = effective ? `(${L(y)}/2)` : `((1+${L(y)})**0.5-1)`;
    const wrongRate = solve(hw, known(hw), defer(hw));
    const redemption = C === F ? "" : `, redeemable at ${amt(C)},`;
    const yieldText = effective ? `an annual effective yield of ${pc(y)}` : `a yield of ${pc(y)} convertible semiannually`;

    return {
      stem: `A ${n}-year bond with a par value of ${amt(F)}${redemption} pays semiannual coupons. For the first ${n1} years the coupons are at an annual rate of ${pc(r1)} convertible semiannually; for the remaining ${n - n1} years they are at an annual rate of $r$ convertible semiannually. The bond is bought for ${amt(price)} to give ${yieldText}.\n\nCalculate $r$.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$\\dfrac{${F}r}{2}\\,v^{${N1}}a_{\\overline{${N - N1}|}} = ${mnum(price - known(h), 2)} \\Rightarrow r = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        bracket: [0, 0.5],
        description: `Price = ${N1} coupons of ${amt((F * r1) / 2)} + ${N - N1} coupons of ${F}r/2 + redemption, each discounted half-year by half-year at the yield.`,
      },
      distractors: [
        distractor("TIMING_IGNORED_DEFERRAL", noDefer, `2*(${L(price)} - ${knownE(hE)})/(${L(F)}*${aE(N - N1, hE)})`, {
          derivation: `later coupons valued as starting now: $r = ${shown(noDefer, fmt)}$`,
          method: "Valued the later coupons without deferring them.",
          feedback: `The higher coupons start after ${N1} half-years, so their annuity value is multiplied by $v^{${N1}}$.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offOne, solveE(hE, true, 1), {
          derivation: `$v^{${N1 + 1}}a_{\\overline{${N - N1}|}}$ used: $r = ${shown(offOne, fmt)}$`,
          method: `Deferred the later coupons by ${N1 + 1} half-years.`,
          feedback: `The first higher coupon is at half-year ${N1 + 1}; an annuity-immediate valued one period before its first payment needs $v^{${N1}}$.`,
        }),
        distractor("CONC_IGNORED_REDEMPTION", noRedemption, solveE(hE, false), {
          derivation: `redemption left out: $r = ${shown(noRedemption, fmt)}$`,
          method: "Left the redemption payment out of the price.",
          feedback: `The price includes the present value of ${amt(C)} at the end of year ${n}.`,
        }),
        distractor("VAR_OTHER_UNKNOWN", half, `(${calc})/2`, {
          derivation: `half-year coupon rate $= ${shown(half, fmt)}$`,
          method: "Reported the coupon rate per half-year.",
          feedback: "The question asks for the annual rate convertible semiannually: twice the half-year rate.",
        }),
        distractor(effective ? "RATE_DIVIDED_EFFECTIVE" : "RATE_NOMINAL_AS_EFFECTIVE", wrongRate, solveE(hwE), {
          derivation: `half-year yield $${dec(hw, 6)}$: $r = ${shown(wrongRate, fmt)}$`,
          method: effective ? "Halved the annual effective yield." : "Treated the yield as annual effective.",
          feedback: effective ? `The half-year rate is $(${dec(1 + y, 3)})^{1/2} - 1 = ${dec(h, 6)}$.` : `Convertible semiannually means the half-year rate is ${dec(y / 2, 4)}.`,
        }),
      ],
      explanation: explanation({
        intuition: "The price is the sum of three pieces: the early coupons, the later coupons and the redemption. Two of them are fully known. What is left of the price must be the value of the later coupons, which is the unknown rate times a deferred annuity factor.",
        translation: {
          unknowns: [{ symbol: "$r$", meaning: "annual coupon rate (convertible semiannually) for the later years" }],
          relationships: [`$${mamt(price)} = ${mamt((F * r1) / 2)}\\,${aSym(N1)} + \\dfrac{${F}r}{2}\\,v^{${N1}}${aSym(N - N1)} + ${mamt(C)}\\,v^{${N}}$`],
          conditions: [`Half-year yield $j = ${dec(h, 6)}$.`, `The step-up happens after ${N1} coupons.`],
          valuationDate: "Time 0 (purchase).",
          modelChoice: "Split the coupons into an immediate and a deferred annuity.",
          assumptions: ["Coupons are paid on the par value.", "The yield is constant."],
        },
        solution: [
          { title: "Half-year yield", body: `$j = ${dec(h, 6)}$` },
          { title: "Known pieces", body: `$${mamt((F * r1) / 2)}\\,${aSym(N1)} + ${mamt(C)}\\,v^{${N}} = ${mnum(known(h), 2)}$` },
          { title: "Deferred annuity factor", body: `$v^{${N1}}\\,${aSym(N - N1)} = ${dec(defer(h), 6)}$` },
          { title: "Solve", body: `$r = \\dfrac{2(${mamt(price)} - ${mnum(known(h), 2)})}{${F} \\times ${dec(defer(h), 6)}} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Difference of annuities",
            body: `$v^{${N1}}${aSym(N - N1)} = ${aSym(N)} - ${aSym(N1)}$ at $j$.`,
            whenUseful: "Avoids the separate discount factor.",
          },
        ],
        transfer: {
          principle: "A price is an equation of value; when one block of payments is unknown, isolate its present value and divide by its annuity factor.",
          unusual: "The coupon rate changes part-way through the bond's life.",
          misread: "Forgetting to defer the later coupons, or reporting the half-year rate.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Coupons step up after year " + n1,
          unit: "half-year",
          rate: h,
          flows: [
            ...range(1, N1).map((t) => ({ t, amount: (F * r1) / 2, dir: "in" as const, group: "early coupons" })),
            ...range(N1 + 1, N).map((t) => ({ t, amount: (F * answer) / 2, dir: "in" as const, group: "later coupons" })),
            { t: N, amount: C, dir: "in" as const, label: "redemption" },
          ],
          valuationTimes: [0],
        },
      ],
      markers: [h, known(h), defer(h)],
      presentation: ["inverse", "frequency", "deferred"],
      features: features({ steps: 4, multiConcept: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Half-year yield.", ["j", h, "half-year yield"], ["y"]),
          step("E.price", "Value of the early coupons and the redemption.", ["K", known(h), "known part of the price"], ["j", "r_1", "C"], { valuationDate: "0" }),
          step("B.deferred", "Deferred annuity factor for the later coupons.", ["v^N1 a", defer(h), "deferred annuity factor"], ["j"], { valuationDate: "0" }),
          step("A.equation-of-value", "Solve the price equation for the later coupon rate.", ["r", answer, "later annual coupon rate"], ["P", "K", "v^N1 a"], { rearranged: true }),
        ],
        {
          methods: ["decomposition", "rearrangement"],
          stages: {
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
            CONC_IGNORED_REDEMPTION: [1, "selection"],
            TIMING_IGNORED_DEFERRAL: [2, "application"],
            TIMING_DEFERRAL_OFF_BY_ONE: [2, "application"],
            VAR_OTHER_UNKNOWN: [3, "interpretation"],
          },
          reasoning: "Subtract the known pieces of the price; what remains is r times a deferred annuity factor.",
        }
      ),
      params: { F, C, n, n1, r1, y, effective, price },
    };
  },
};

// ===================================================================== ALM — convexity of a two-bond portfolio from its duration

const portfolioConvexity: QuestionTemplate = {
  id: "chal-alm-portfolio-convexity",
  family: "chal-alm-convexity",
  topic: "ALM",
  levels: [3],
  objective: "ALM.convexity",
  secondary: ["ALM.duration", "ALM.portfolio"],
  reasoning: ["formula_selection", "algebra", "financial_intuition", "multistep"],
  soaConcept: "Portfolio weights recovered from a stated duration, then the portfolio's convexity.",
  generate(rng): QuestionDraft {
    const fmt = PLAIN2;
    const i = gridRate(rng, 0.03, 0.08, 0.005);
    const t1 = rng.int(1, 4);
    const t2 = rng.int(t1 + 6, t1 + 14);
    const D = t1 + 1 + 0.25 * rng.int(0, 4 * (t2 - t1 - 2));
    const givenMod = rng.next() < 0.5;
    const askMac = rng.next() < 0.4;
    const value = rng.next() < 0.5 ? gridAmount(rng, 100000, 1000000, 50000) : 0;
    const Dm = Number((D / (1 + i)).toFixed(4));
    const Duse = givenMod ? Dm * (1 + i) : D;
    const w2 = (Duse - t1) / (t2 - t1);
    const w1 = 1 - w2;
    const v2 = Math.pow(1 + i, -2);
    const cx = (t: number) => (askMac ? t * t : t * (t + 1) * v2);
    const cxOther = (t: number) => (askMac ? t * (t + 1) * v2 : t * t);
    const C1 = cx(t1);
    const C2 = cx(t2);
    const answer = w1 * C1 + w2 * C2;

    const iS = L(i);
    const DuseE = givenMod ? `(${L(Dm)}*(1+${iS}))` : L(D);
    const w2E = (d: string) => `((${d} - ${t1})/${t2 - t1})`;
    const cxE = (t: number, mac = askMac) => (mac ? `${t * t}` : `${t * (t + 1)}*(1+${iS})**(-2)`);
    const portE = (d: string, mac = askMac) => `((1-${w2E(d)})*${cxE(t1, mac)} + ${w2E(d)}*${cxE(t2, mac)})`;
    const calc = portE(DuseE);
    const X1 = `(1-${w2E(DuseE)})*(1+${iS})**${t1}`;
    const X2 = `${w2E(DuseE)}*(1+${iS})**${t2}`;
    const model = askMac
      ? `(${t1 * t1}*${X1}*(1+${iS})**(-${t1}) + ${t2 * t2}*${X2}*(1+${iS})**(-${t2}))/(${X1}*(1+${iS})**(-${t1}) + ${X2}*(1+${iS})**(-${t2}))`
      : `(${t1 * (t1 + 1)}*${X1}*(1+${iS})**(-${t1 + 2}) + ${t2 * (t2 + 1)}*${X2}*(1+${iS})**(-${t2 + 2}))/(${X1}*(1+${iS})**(-${t1}) + ${X2}*(1+${iS})**(-${t2}))`;

    const Dwrong = givenMod ? Dm : D * (1 + i);
    const DwrongE = givenMod ? L(Dm) : `(${L(D)}*(1+${iS}))`;
    const ww2 = (Dwrong - t1) / (t2 - t1);
    const wrongDur = (1 - ww2) * C1 + ww2 * C2;
    const other = w1 * cxOther(t1) + w2 * cxOther(t2);
    const atD = askMac ? Duse * Duse : Duse * (Duse + 1) * v2;
    const atDE = askMac ? `${DuseE}**2` : `${DuseE}*(${DuseE}+1)*(1+${iS})**(-2)`;
    const swapped = w2 * C1 + w1 * C2;
    const swappedE = `(${w2E(DuseE)}*${cxE(t1)} + (1-${w2E(DuseE)})*${cxE(t2)})`;
    const even = (C1 + C2) / 2;
    const noV = w1 * t1 * (t1 + 1) + w2 * t2 * (t2 + 1);
    const durWord = givenMod ? "modified" : "Macaulay";
    const shownDur = givenMod ? dec(Dm, 4) : D.toFixed(2);
    const measure = askMac ? "Macaulay convexity" : "convexity";

    const distractors: DistractorCandidate[] = [
      distractor("FORMULA_MODIFIED_FOR_MACAULAY", wrongDur, `((1-${w2E(DwrongE)})*${cxE(t1)} + ${w2E(DwrongE)}*${cxE(t2)})`, {
        derivation: `duration taken as $${dec(Dwrong, 4)}$: weights $${dec(1 - ww2, 4)}, ${dec(ww2, 4)}$; ${measure} $= ${shown(wrongDur, fmt)}$`,
        method: givenMod ? "Used the modified duration as if it were the Macaulay duration." : "Treated the given Macaulay duration as a modified duration and converted it.",
        feedback: `A zero-coupon bond's Macaulay duration is its maturity, so the weights come from the Macaulay duration of the portfolio: ${givenMod ? `$D = ${dec(Dm, 4)} \\times ${dec(1 + i, 3)} = ${dec(Duse, 4)}$` : `$D = ${D.toFixed(2)}$ as given`}.`,
      }),
      distractor("FORMULA_MACAULAY_CONVEXITY", other, portE(DuseE, !askMac), {
        derivation: `${askMac ? "$\\sum w_t\\,t(t+1)v^2$" : "$\\sum w_t\\,t^2$"} $= ${shown(other, fmt)}$`,
        method: askMac ? "Computed the (modified) convexity instead of the Macaulay convexity." : "Computed the Macaulay convexity instead of the convexity.",
        feedback: askMac ? "Macaulay convexity is the PV-weighted average of $t^2$." : "Convexity is $P''(i)/P(i) = \\sum t(t+1)\\,CF_t\\,v^{t+2}/P$, not the PV-weighted average of $t^2$.",
      }),
      distractor("CHAL_CONVEXITY_AT_DURATION", atD, atDE, {
        derivation: `one zero at $D = ${dec(Duse, 4)}$: $${shown(atD, fmt)}$`,
        method: "Treated the portfolio as a single zero-coupon bond maturing at its duration.",
        feedback: "Two bonds either side of the duration have more convexity than one bond at the duration: average the components' convexities with PV weights.",
      }),
      distractor("ALLOC_SWAPPED", swapped, swappedE, {
        derivation: `weights swapped: $${shown(swapped, fmt)}$`,
        method: "Attached each bond's weight to the other bond.",
        feedback: `The weight on the year-${t2} bond is $(D - ${t1})/(${t2} - ${t1}) = ${dec(w2, 4)}$.`,
      }),
      distractor("ALLOC_EVEN_SPLIT", even, `(${cxE(t1)} + ${cxE(t2)})/2`, {
        derivation: `$\\tfrac12(${dec(C1, 4)} + ${dec(C2, 4)}) = ${shown(even, fmt)}$`,
        method: "Averaged the two bonds' convexities equally.",
        feedback: "The portfolio's convexity is weighted by present value, and the duration fixes those weights.",
      }),
    ];
    if (!askMac) {
      distractors.push(
        distractor("ARITH_ORDER_OF_OPERATIONS", noV, `(1-${w2E(DuseE)})*${t1 * (t1 + 1)} + ${w2E(DuseE)}*${t2 * (t2 + 1)}`, {
          derivation: `$\\sum w_t\\,t(t+1) = ${shown(noV, fmt)}$`,
          method: "Left out the factor $v^2$.",
          feedback: `Each zero's convexity is $t(t+1)/(1+i)^2$; the factor $(${dec(1 + i, 3)})^{-2}$ applies to every term.`,
        })
      );
    }

    return {
      stem: `A portfolio consists of two zero-coupon bonds, one maturing at the end of year ${t1} and the other at the end of year ${t2}.${value ? ` The portfolio is worth ${amt(value)}.` : ""} At an annual effective interest rate of ${pc(i)}, the ${durWord} duration of the portfolio is ${shownDur}.\n\nCalculate the ${measure} of the portfolio.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `weights $${dec(w1, 4)}, ${dec(w2, 4)}$; $${dec(w1, 4)}(${dec(C1, 4)}) + ${dec(w2, 4)}(${dec(C2, 4)}) = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: `Face amounts $X_t$ chosen so the PV shares are the weights; ${measure} = ${askMac ? "Σ t² X_t v^t / Σ X_t v^t" : "Σ t(t+1) X_t v^{t+2} / Σ X_t v^t"}.`,
      },
      distractors,
      explanation: explanation({
        intuition: "A zero-coupon bond's duration is its maturity, so the portfolio's duration is a PV-weighted average of the two maturities. That pins down the weights; convexity is the same weighted average of each bond's convexity.",
        translation: {
          unknowns: [
            { symbol: "$w$", meaning: `PV share in the year-${t2} bond` },
            { symbol: "$C$", meaning: `${measure} of the portfolio` },
          ],
          relationships: [
            givenMod ? `$D = ${dec(Dm, 4)}(1 + ${dec(i, 3)}) = ${dec(Duse, 4)}$` : `$D = ${D.toFixed(2)}$`,
            `$D = (1-w)${t1} + w\\,${t2}$`,
            askMac ? "$C = (1-w)t_1^2 + w\\,t_2^2$" : "$C = (1-w)\\dfrac{t_1(t_1+1)}{(1+i)^2} + w\\dfrac{t_2(t_2+1)}{(1+i)^2}$",
          ],
          conditions: ["Both bonds are valued at the same rate.", ...(value ? ["The portfolio's value does not affect the weights."] : [])],
          valuationDate: "Time 0.",
          modelChoice: "Portfolio measures are PV-weighted averages of the components' measures.",
          assumptions: ["Flat yield curve.", `${askMac ? "Macaulay convexity" : "Convexity"} measured as defined at the stated rate.`],
        },
        solution: [
          { title: "Macaulay duration", body: givenMod ? `$${dec(Dm, 4)} \\times ${dec(1 + i, 3)} = ${dec(Duse, 4)}$` : `$D = ${D.toFixed(2)}$` },
          { title: "Weights", body: `$w = (${dec(Duse, 4)} - ${t1})/${t2 - t1} = ${dec(w2, 4)}$` },
          { title: "Each bond", body: `$C_{${t1}} = ${dec(C1, 4)}$, $C_{${t2}} = ${dec(C2, 4)}$` },
          { title: "Portfolio", body: `$${dec(w1, 4)}(${dec(C1, 4)}) + ${dec(w2, 4)}(${dec(C2, 4)}) = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Dispersion",
            body: askMac
              ? `Macaulay convexity $= D^2 + \\text{variance of times} = ${dec(Duse * Duse, 4)} + ${dec(answer - Duse * Duse, 4)}$.`
              : `$C(1+i)^2 = \\sum w_t t^2 + D$; the $t^2$ average exceeds $D^2$ by the variance of the payment times.`,
            whenUseful: "Shows why spreading the bonds raises convexity at a fixed duration.",
          },
        ],
        transfer: {
          principle: "Duration fixes PV weights when the components' durations are known; every other portfolio measure follows with the same weights.",
          unusual: givenMod ? "The duration is given in modified form, but zero-coupon weights work in Macaulay terms." : "The answer depends on how the value is spread, not on the duration alone.",
          misread: "Treating the portfolio as one zero at its duration.",
        },
      }),
      visuals: [
        {
          kind: "duration",
          title: "Two zeros balanced at the portfolio duration",
          flows: [
            { t: t1, amount: w1 * Math.pow(1 + i, t1) * (value || 100) },
            { t: t2, amount: w2 * Math.pow(1 + i, t2) * (value || 100) },
          ],
          rate: i,
        },
      ],
      markers: [Duse, w2, C1, C2],
      presentation: value ? ["inverse", "hidden-structure", "irrelevant-info"] : ["inverse", "hidden-structure"],
      features: features({ steps: 4, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step(givenMod ? "G.modified" : "G.macaulay", "Macaulay duration of the portfolio.", ["D", Duse, "Macaulay duration"], [givenMod ? "D_mod" : "D", "i"]),
          step("G.portfolio-duration", "PV weights from the duration (each zero's duration is its maturity).", ["w", w2, `weight on the year-${t2} bond`], ["D", "t_1", "t_2"], { rearranged: true }),
          step(askMac ? "G.macaulay-convexity" : "G.convexity", "Each zero's convexity.", ["C_t2", C2, `year-${t2} bond's ${measure}`], ["t", "i"]),
          step("G.portfolio-duration", "Portfolio convexity with the same weights.", ["C", answer, `portfolio ${measure}`], ["w", "C_t1", "C_t2"]),
        ],
        {
          methods: ["equation_construction", "rearrangement"],
          stages: {
            FORMULA_MODIFIED_FOR_MACAULAY: [0, "selection"],
            ALLOC_SWAPPED: [1, "connection"],
            ALLOC_EVEN_SPLIT: [1, "selection"],
            FORMULA_MACAULAY_CONVEXITY: [2, "selection", askMac ? "G.convexity" : "G.macaulay-convexity"],
            ARITH_ORDER_OF_OPERATIONS: [2, "application"],
            CHAL_CONVEXITY_AT_DURATION: [3, "selection"],
          },
          reasoning: "Duration is a weighted average of maturities; invert it for the weights and reuse them for convexity.",
        }
      ),
      params: { i, t1, t2, D, givenMod, askMac, value },
    };
  },
};

// ===================================================================== ALM — Macaulay approximation for a mixed-measure portfolio

const portfolioApproximation: QuestionTemplate = {
  id: "chal-alm-portfolio-approx",
  family: "chal-alm-approximation",
  topic: "ALM",
  levels: [3],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ALM.portfolio", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "translation", "financial_intuition", "multistep"],
  soaConcept: "First-order Macaulay approximation for a two-bond portfolio whose durations are quoted on different bases.",
  generate(rng): QuestionDraft {
    const fmt = MONEY0;
    const i0 = gridRate(rng, 0.04, 0.08, 0.005);
    const rise = rng.next() < 0.5;
    const delta = gridRate(rng, 0.005, 0.015, 0.0025);
    const i1 = rise ? i0 + delta : i0 - delta;
    const xPremium = rng.next() < 0.5;
    const draw = drawUntil(
      () => {
        const FX = gridAmount(rng, 100000, 500000, 50000);
        const FY = gridAmount(rng, 100000, 500000, 50000);
        const pX = xPremium ? rng.float(104, 118, 2) : rng.float(82, 96, 2);
        const pY = xPremium ? rng.float(82, 96, 2) : rng.float(104, 118, 2);
        return { FX, FY, pX, pY };
      },
      (p) => Math.abs(p.FX * p.pX - p.FY * p.pY) > 0.15 * (p.FX * p.pX + p.FY * p.pY)
    );
    const { FX, FY, pX, pY } = draw;
    const DX = 2 + 0.25 * rng.int(0, 20);
    const DmY = 6 + 0.25 * rng.int(0, 32);
    const MX = (FX * pX) / 100;
    const MY = (FY * pY) / 100;
    const V0 = MX + MY;
    const DY = DmY * (1 + i0);
    const DP = (MX * DX + MY * DY) / V0;
    const ratio = (1 + i0) / (1 + i1);
    const V1 = V0 * Math.pow(ratio, DP);
    const change = (v1: number) => (rise ? V0 - v1 : v1 - V0);
    const answer = change(V1);

    const MXE = `(${L(FX)}*${L(pX)}/100)`;
    const MYE = `(${L(FY)}*${L(pY)}/100)`;
    const V0E = `(${MXE} + ${MYE})`;
    const DPE = (dy: string, wx = MXE, wy = MYE) => `((${wx}*${L(DX)} + ${wy}*${dy})/(${wx} + ${wy}))`;
    const ratioE = `((1+${L(i0)})/(1+${L(i1)}))`;
    const chg = (v1: string) => (rise ? `${V0E} - ${v1}` : `${v1} - ${V0E}`);
    const DYE = `(${L(DmY)}*(1+${L(i0)}))`;
    const calc = chg(`${V0E}*${ratioE}**${DPE(DYE)}`);
    const model = chg(`(${MXE}*${ratioE}**${DPE(DYE)} + ${MYE}*${ratioE}**${DPE(DYE)})`);

    const DPm = (MX * DX + MY * DmY) / V0;
    const noConvert = change(V0 * Math.pow(ratio, DPm));
    const DPf = (FX * DX + FY * DY) / (FX + FY);
    const faceW = change(V0 * Math.pow(ratio, DPf));
    const DPe = (DX + DY) / 2;
    const evenW = change(V0 * Math.pow(ratio, DPe));
    const modApprox = V0 * (DP / (1 + i0)) * delta;
    const dir = rise ? "decrease" : "increase";

    return {
      stem: `An investor holds the two bonds below. Prices and durations are calculated at an annual effective interest rate of ${pc(i0)}.\n\nThe interest rate ${rise ? "rises" : "falls"} to ${pc(i1)}. Using the first-order Macaulay approximation based on the duration of the whole holding, calculate the ${dir} in the value of the holding.`,
      exhibits: [
        {
          type: "table",
          columns: ["Bond", "Par amount held", "Price per 100 of par", "Duration"],
          rows: [
            ["X", amt(FX), pX.toFixed(2), `Macaulay: ${DX.toFixed(2)}`],
            ["Y", amt(FY), pY.toFixed(2), `Modified: ${DmY.toFixed(2)}`],
          ],
        },
      ],
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$D = ${dec(DP, 4)}$; $${mnum(V0, 2)}\\left|1 - \\left(\\tfrac{${dec(1 + i0, 3)}}{${dec(1 + i1, 4)}}\\right)^{${dec(DP, 4)}}\\right| = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: "Each bond's market value scaled by the common Macaulay factor ((1 + i₀)/(1 + i₁))^D, with D the market-value-weighted Macaulay duration.",
      },
      distractors: [
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", noConvert, chg(`${V0E}*${ratioE}**${DPE(L(DmY))}`), {
          derivation: `Y's ${DmY.toFixed(2)} used as Macaulay: $D = ${dec(DPm, 4)}$, ${dir} $= ${shown(noConvert, fmt)}$`,
          method: "Averaged a Macaulay duration with a modified duration.",
          feedback: `Convert Y first: $D_Y = ${DmY.toFixed(2)} \\times ${dec(1 + i0, 3)} = ${dec(DY, 4)}$.`,
        }),
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", faceW, chg(`${V0E}*${ratioE}**${DPE(DYE, L(FX), L(FY))}`), {
          derivation: `par-weighted $D = ${dec(DPf, 4)}$: ${dir} $= ${shown(faceW, fmt)}$`,
          method: "Weighted the durations by par amounts.",
          feedback: `Portfolio duration weights are market values: ${amt(Number(MX.toFixed(2)))} and ${amt(Number(MY.toFixed(2)))}.`,
        }),
        distractor("ALLOC_EVEN_SPLIT", evenW, chg(`${V0E}*${ratioE}**((${L(DX)} + ${DYE})/2)`), {
          derivation: `$D = \\tfrac12(${DX.toFixed(2)} + ${dec(DY, 4)}) = ${dec(DPe, 4)}$: ${dir} $= ${shown(evenW, fmt)}$`,
          method: "Took a simple average of the two durations.",
          feedback: "The bonds are held in different market values, so their durations carry different weights.",
        }),
        distractor("CHAL_WRONG_APPROXIMATION", modApprox, `${V0E}*${DPE(DYE)}/(1+${L(i0)})*${L(delta)}`, {
          derivation: `$${mnum(V0, 2)} \\times \\tfrac{${dec(DP, 4)}}{${dec(1 + i0, 3)}} \\times ${dec(delta, 4)} = ${shown(modApprox, fmt)}$`,
          method: "Used the first-order modified approximation.",
          feedback: "The Macaulay approximation scales the value by $((1+i_0)/(1+i_1))^D$; it is not linear in the rate change.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", V1, `${V0E}*${ratioE}**${DPE(DYE)}`, {
          derivation: `estimated new value $= ${shown(V1, fmt)}$`,
          method: "Reported the estimated new value.",
          feedback: `The question asks for the ${dir}: subtract from the current value ${amt(Number(V0.toFixed(2)))}.`,
        }),
      ],
      explanation: explanation({
        intuition: "The Macaulay approximation treats the whole holding like a single zero-coupon bond paid at its duration. So first get one duration for the holding — on one basis, weighted by market value — and then move the value as a zero at that date would move.",
        translation: {
          unknowns: [
            { symbol: "$D$", meaning: "Macaulay duration of the holding" },
            { symbol: "$\\Delta V$", meaning: `estimated ${dir} in value` },
          ],
          relationships: [
            `$M_X = ${mnum(MX, 2)}$, $M_Y = ${mnum(MY, 2)}$`,
            `$D_Y = ${DmY.toFixed(2)}(1 + ${dec(i0, 3)})$`,
            `$D = \\dfrac{M_X D_X + M_Y D_Y}{M_X + M_Y}$`,
            `$V(i_1) \\approx V(i_0)\\left(\\dfrac{1+i_0}{1+i_1}\\right)^{D}$`,
          ],
          conditions: ["Both durations at the same starting rate.", "Market value = par × price/100."],
          valuationDate: "Now, before and after the rate change.",
          modelChoice: "Portfolio Macaulay duration with market-value weights; first-order Macaulay approximation.",
          assumptions: ["Flat yield curve that shifts in parallel.", "The approximation is first order (no convexity adjustment)."],
        },
        solution: [
          { title: "Market values", body: `$M_X = ${mnum(MX, 2)}$, $M_Y = ${mnum(MY, 2)}$, total $${mnum(V0, 2)}$` },
          { title: "Y's Macaulay duration", body: `$${DmY.toFixed(2)} \\times ${dec(1 + i0, 3)} = ${dec(DY, 4)}$` },
          { title: "Holding's duration", body: `$D = ${dec(DP, 4)}$` },
          { title: "Approximation", body: `$${mnum(V0, 2)}\\left(${dec(ratio, 6)}\\right)^{${dec(DP, 4)}} = ${mnum(V1, 2)}$; ${dir} $= ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Bond by bond with one exponent",
            body: "Scaling each bond by the same factor and adding gives the same total — the approximation is applied to the holding's duration, not to each bond's own duration.",
            whenUseful: "Shows why the weights must be market values.",
          },
        ],
        transfer: {
          principle: "Combine durations only on one basis and with market-value weights; then apply the approximation the question names.",
          unusual: "The two durations are quoted on different bases and holdings are given as par amounts and prices.",
          misread: "Mixing modified and Macaulay durations, or weighting by par.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "One duration for the holding",
          nodes: [
            { id: "m", label: "Market values", detail: `$${mnum(MX, 0)}$ and $${mnum(MY, 0)}$`, tone: "input" },
            { id: "y", label: "Y to Macaulay", detail: `$${dec(DY, 3)}$`, tone: "step" },
            { id: "d", label: "Weighted duration", detail: `$${dec(DP, 3)}$`, tone: "step" },
            { id: "v", label: `Estimated ${dir}`, tone: "result" },
          ],
          edges: [
            { from: "m", to: "d" },
            { from: "y", to: "d" },
            { from: "d", to: "v", label: "((1+i₀)/(1+i₁))^D" },
          ],
        },
      ],
      markers: [MX, MY, DY, DP, V1],
      presentation: ["combined-topics", "indirect-wording"],
      features: features({ steps: 5, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("E.price", "Market value of each holding from its price per 100.", ["V_0", V0, "market value of the holding"], ["par", "price"]),
          step("G.modified", "Put bond Y on the Macaulay basis.", ["D_Y", DY, "Y's Macaulay duration"], ["D_mod,Y", "i_0"]),
          step("G.portfolio-duration", "Market-value-weighted Macaulay duration of the holding.", ["D", DP, "holding's Macaulay duration"], ["M_X", "M_Y", "D_X", "D_Y"]),
          step("G.approx-macaulay", "First-order Macaulay approximation at the new rate.", ["V_1", V1, "estimated new value"], ["V_0", "D", "i_0", "i_1"]),
          step("G.price-function", "Change in value.", ["ΔV", answer, `estimated ${dir}`], ["V_0", "V_1"]),
        ],
        {
          methods: ["substitution", "decomposition"],
          stages: {
            FORMULA_MODIFIED_FOR_MACAULAY: [1, "selection"],
            MODEL_UNDISCOUNTED_WEIGHTS: [2, "application"],
            ALLOC_EVEN_SPLIT: [2, "selection"],
            CHAL_WRONG_APPROXIMATION: [3, "selection", "G.approx-modified"],
            VAR_TOTAL_FOR_COMPONENT: [4, "interpretation"],
          },
          reasoning: "Market values, one duration basis, market-value weights — then one Macaulay factor for the whole holding.",
        }
      ),
      params: { i0, i1, FX, FY, pX, pY, DX, DmY },
    };
  },
};

// ===================================================================== ALM — dedicated portfolio with coupon bonds priced at their own yields

const dedicatedCost: QuestionTemplate = {
  id: "chal-alm-dedication-cost",
  family: "chal-alm-matching",
  topic: "ALM",
  levels: [3],
  objective: "ALM.cash_flow_matching",
  secondary: ["BONDS.price_redemption", "BONDS.coupons", "ALM.yield_curves"],
  reasoning: ["cashflow_modelling", "simultaneous_equations", "multistep", "formula_selection"],
  soaConcept: "Exact matching of three liabilities with zero and coupon bonds, worked backwards from the last liability, then costed.",
  generate(rng): QuestionDraft {
    const fmt = MONEY2;
    const draw = drawUntil(
      () => {
        const Ls = [gridAmount(rng, 20000, 80000, 1000), gridAmount(rng, 20000, 80000, 1000), gridAmount(rng, 20000, 80000, 1000)];
        const c2 = gridRate(rng, 0.03, 0.08, 0.005);
        const c3 = gridRate(rng, 0.03, 0.08, 0.005);
        const y1 = gridRate(rng, 0.02, 0.04, 0.0025);
        const y2 = y1 + gridRate(rng, 0.0075, 0.015, 0.0025);
        const y3 = y2 + gridRate(rng, 0.0075, 0.015, 0.0025);
        const F3 = Ls[2] / (1 + c3);
        const F2 = (Ls[1] - c3 * F3) / (1 + c2);
        const F1 = Ls[0] - c3 * F3 - c2 * F2;
        return { Ls, c2, c3, y1, y2, y3, F1, F2, F3 };
      },
      (p) => p.F1 > 5000 && p.F2 > 5000 && Math.abs(p.c2 - p.y2) >= 0.01 && Math.abs(p.c3 - p.y3) >= 0.01
    );
    const { Ls, c2, c3, y1, y2, y3, F1, F2, F3 } = draw;
    const P1 = 1 / (1 + y1);
    const P2 = c2 / (1 + y2) + (1 + c2) / Math.pow(1 + y2, 2);
    const P3 = c3 * an(3, y3) + Math.pow(1 + y3, -3);
    const answer = F1 * P1 + F2 * P2 + F3 * P3;

    const F3E = `(${L(Ls[2])}/(1+${L(c3)}))`;
    const F2E = `((${L(Ls[1])} - ${L(c3)}*${F3E})/(1+${L(c2)}))`;
    const F1E = `(${L(Ls[0])} - ${L(c3)}*${F3E} - ${L(c2)}*${F2E})`;
    const P1E = `(1+${L(y1)})**(-1)`;
    const P2E = `(${L(c2)}*(1+${L(y2)})**(-1) + (1+${L(c2)})*(1+${L(y2)})**(-2))`;
    const P3E = `(${L(c3)}*${aE(3, L(y3))} + (1+${L(y3)})**(-3))`;
    const costE = (f1: string, f2: string, f3: string) => `${f1}*${P1E} + ${f2}*${P2E} + ${f3}*${P3E}`;
    const calc = costE(F1E, F2E, F3E);
    const P3M = `(${L(c3)}*(1+${L(y3)})**(-1) + ${L(c3)}*(1+${L(y3)})**(-2) + (1+${L(c3)})*(1+${L(y3)})**(-3))`;
    const model = `${F1E}*${P1E} + ${F2E}*${P2E} + ${F3E}*${P3M}`;

    const iF3 = Ls[2] / (1 + c3);
    const iF2 = Ls[1] / (1 + c2);
    const iF1 = Ls[0];
    const ignored = iF1 * P1 + iF2 * P2 + iF3 * P3;
    const single = Ls[0] / (1 + y3) + Ls[1] / Math.pow(1 + y3, 2) + Ls[2] / Math.pow(1 + y3, 3);
    const faces = F1 + F2 + F3;
    const dF1 = Ls[0] - c2 * F2;
    const omitted = dF1 * P1 + F2 * P2 + F3 * P3;
    const ytm = Ls[0] / (1 + y1) + Ls[1] / Math.pow(1 + y2, 2) + Ls[2] / Math.pow(1 + y3, 3);

    return {
      stem: `A company must pay ${amt(Ls[0])} at the end of year 1, ${amt(Ls[1])} at the end of year 2 and ${amt(Ls[2])} at the end of year 3. It will buy amounts of the three bonds below so that the cash flows from the bonds exactly match these payments. Each bond is redeemable at par, pays annual coupons where shown, and is priced at the annual effective yield given.\n\nCalculate the total cost of the bonds.`,
      exhibits: [
        {
          type: "table",
          columns: ["Bond", "Term", "Annual coupon rate", "Annual effective yield"],
          rows: [
            ["A", "1 year", "0%", pc(y1)],
            ["B", "2 years", pc(c2), pc(y2)],
            ["C", "3 years", pc(c3), pc(y3)],
          ],
        },
      ],
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `pars $${mnum(F1, 2)}, ${mnum(F2, 2)}, ${mnum(F3, 2)}$; cost $= ${shown(answer, fmt)}$`,
      },
      model: {
        expr: model,
        description: "Par amounts from matching year 3, then year 2, then year 1; each bond's price per unit of par from its own cash flows at its own yield.",
      },
      distractors: [
        distractor("MODEL_IGNORED_COUPON", ignored, costE(L(Ls[0]), `(${L(Ls[1])}/(1+${L(c2)}))`, F3E), {
          derivation: `each liability matched by its own bond only: cost $= ${shown(ignored, fmt)}$`,
          method: "Matched each payment with one bond and ignored the coupons from the longer bonds.",
          feedback: "Bond C's coupons arrive at years 1 and 2 and bond B's at year 1; they reduce the amounts of the shorter bonds needed.",
        }),
        distractor("CONC_DOUBLE_COUNTED", omitted, costE(`(${L(Ls[0])} - ${L(c2)}*${F2E})`, F2E, F3E), {
          derivation: `year-1 coupon of bond C left out: par of A $= ${mnum(dF1, 2)}$, cost $= ${shown(omitted, fmt)}$`,
          method: "Left bond C's year-1 coupon out of the year-1 position.",
          feedback: `Bond C pays $${dec(c3, 3)} \\times ${mnum(F3, 2)}$ at year 1 as well as at year 2.`,
        }),
        distractor("MODEL_SINGLE_RATE", single, `${L(Ls[0])}*(1+${L(y3)})**(-1) + ${L(Ls[1])}*(1+${L(y3)})**(-2) + ${L(Ls[2])}*(1+${L(y3)})**(-3)`, {
          derivation: `liabilities discounted at ${pc(y3)}: $${shown(single, fmt)}$`,
          method: "Valued the liabilities at the longest bond's yield.",
          feedback: "The cost is what the bonds cost at their own prices; the bonds have different yields.",
        }),
        distractor("VAR_FACE_FOR_PRICE", faces, `${F1E} + ${F2E} + ${F3E}`, {
          derivation: `$${mnum(F1, 2)} + ${mnum(F2, 2)} + ${mnum(F3, 2)} = ${shown(faces, fmt)}$`,
          method: "Added the par amounts instead of their prices.",
          feedback: "Each bond is bought at its price, which differs from par unless its coupon rate equals its yield.",
        }),
        distractor("CHAL_YTM_AS_SPOT", ytm, `${L(Ls[0])}*(1+${L(y1)})**(-1) + ${L(Ls[1])}*(1+${L(y2)})**(-2) + ${L(Ls[2])}*(1+${L(y3)})**(-3)`, {
          derivation: `each liability discounted at the yield of the bond of that term: $${shown(ytm, fmt)}$`,
          method: "Discounted each liability at the bond yield for its term, as if the yields were spot rates.",
          feedback: "A coupon bond's yield applies to all of its cash flows together; it is not the spot rate for its maturity.",
        }),
      ],
      explanation: explanation({
        intuition: "Only bond C pays at year 3, so it alone must cover the year-3 payment. Its coupons then cover part of years 1 and 2. Bond B covers what is left of year 2, and its coupon helps at year 1; bond A covers the rest of year 1. Work backwards, then price each bond.",
        translation: {
          unknowns: [{ symbol: "$F_A, F_B, F_C$", meaning: "par amounts bought" }],
          relationships: [
            `$F_C(1 + ${dec(c3, 3)}) = ${mamt(Ls[2])}$`,
            `$F_B(1 + ${dec(c2, 3)}) + ${dec(c3, 3)}F_C = ${mamt(Ls[1])}$`,
            `$F_A + ${dec(c2, 3)}F_B + ${dec(c3, 3)}F_C = ${mamt(Ls[0])}$`,
            "Cost $= \\sum F \\times$ price per unit of par",
          ],
          conditions: ["Exact matching at each date.", "Bonds may be bought in any amount."],
          valuationDate: "Time 0 for the cost; years 1–3 for matching.",
          modelChoice: "Back-substitution from the longest bond; prices from each bond's own yield.",
          assumptions: ["No reinvestment is needed because flows match exactly.", "Bonds are redeemable at par."],
        },
        solution: [
          { title: "Bond C", body: `$F_C = ${mamt(Ls[2])}/${dec(1 + c3, 3)} = ${mnum(F3, 2)}$` },
          { title: "Bond B", body: `$F_B = (${mamt(Ls[1])} - ${mnum(c3 * F3, 2)})/${dec(1 + c2, 3)} = ${mnum(F2, 2)}$` },
          { title: "Bond A", body: `$F_A = ${mamt(Ls[0])} - ${mnum(c3 * F3, 2)} - ${mnum(c2 * F2, 2)} = ${mnum(F1, 2)}$` },
          { title: "Prices per unit of par", body: `$${dec(P1, 6)}$, $${dec(P2, 6)}$, $${dec(P3, 6)}$` },
          { title: "Cost", body: `$${mnum(F1, 2)}(${dec(P1, 6)}) + ${mnum(F2, 2)}(${dec(P2, 6)}) + ${mnum(F3, 2)}(${dec(P3, 6)}) = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Implied spot rates",
            body: "Bootstrapping spot rates from the three bonds and discounting the liabilities at those spot rates gives the same cost, because the matched portfolio and the liabilities have identical cash flows.",
            whenUseful: "A check; and the reason yields cannot simply replace spot rates.",
          },
        ],
        transfer: {
          principle: "Exact matching is solved from the last date backwards; the cost is then the market price of the bonds bought.",
          unusual: "The bonds have different yields, so no single rate values the liabilities.",
          misread: "Ignoring coupons of longer bonds, or adding par amounts instead of prices.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "Match from the last date backwards",
          nodes: [
            { id: "c", label: "Bond C covers year 3", detail: `$F_C = ${mnum(F3, 0)}$`, tone: "step" },
            { id: "b", label: "Bond B covers rest of year 2", detail: `$F_B = ${mnum(F2, 0)}$`, tone: "step" },
            { id: "a", label: "Bond A covers rest of year 1", detail: `$F_A = ${mnum(F1, 0)}$`, tone: "step" },
            { id: "p", label: "Price each bond", tone: "result" },
          ],
          edges: [
            { from: "c", to: "b", label: "C's coupon at year 2" },
            { from: "b", to: "a", label: "B's and C's coupons at year 1" },
            { from: "a", to: "p" },
          ],
        },
      ],
      markers: [F3, F2, F1, P2, P3],
      presentation: ["work-backwards", "combined-topics"],
      features: features({ steps: 5, multiConcept: true, multipleValuationDates: true }),
      chain: chain(
        [
          step("G.dedication", "Only bond C pays at year 3.", ["F_C", F3, "par of bond C"], ["L_3", "c_C"]),
          step("G.dedication", "Year 2: bond B covers what C's coupon does not.", ["F_B", F2, "par of bond B"], ["L_2", "F_C"], { rearranged: true }),
          step("G.dedication", "Year 1: bond A covers what the coupons do not.", ["F_A", F1, "par of bond A"], ["L_1", "F_B", "F_C"], { rearranged: true }),
          step("E.price", "Price of each bond at its own yield.", ["P_C", P3, "price of bond C per unit of par"], ["c", "y"], { valuationDate: "0" }),
          step("G.dedication", "Cost of the matched portfolio.", ["cost", answer, "total cost"], ["F", "P"]),
        ],
        {
          methods: ["work_backwards", "substitution"],
          stages: {
            MODEL_IGNORED_COUPON: [1, "application"],
            CONC_DOUBLE_COUNTED: [2, "application"],
            CHAL_YTM_AS_SPOT: [3, "selection", "F.spot-pricing"],
            MODEL_SINGLE_RATE: [3, "selection"],
            VAR_FACE_FOR_PRICE: [4, "interpretation"],
          },
          reasoning: "Back-substitute from the final liability to get each par amount, then price each bond from its own cash flows and yield.",
        }
      ),
      params: { L1: Ls[0], L2: Ls[1], L3: Ls[2], c2, c3, y1, y2, y3 },
    };
  },
};

export const CHALLENGE_TEMPLATES: QuestionTemplate[] = [
  simpleVersusCompound,
  currentValue,
  indexedVersusLevel,
  staggeredFunds,
  interestWindow,
  dropAfterExtra,
  saleAgainstBook,
  amortizationReconstruct,
  stepUpCoupon,
  portfolioConvexity,
  portfolioApproximation,
  dedicatedCost,
];
