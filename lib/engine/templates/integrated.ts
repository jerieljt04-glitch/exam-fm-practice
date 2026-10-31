/**
 * Formula-integration templates: problems whose structure has to be recognised
 * before any formula applies, and whose solution chains several formulas with
 * traditional algebra (substitution, elimination, working backwards, series).
 */
import { Ia, acc, an, bondPrice, convexity as _convexity, geometricPV, levelPayment, macaulayDuration, pvFlows, sn, solveRoot, v } from "../finance";
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  PCT3,
  aExpr,
  aSym,
  accPow,
  adueExpr,
  amt,
  chain,
  dec,
  distractor,
  drawUntil,
  explanation,
  features,
  gridAmount,
  gridRate,
  level,
  lit,
  mamt,
  mnum,
  mpc,
  ord,
  pc,
  pvTerms,
  range,
  sExpr,
  sSym,
  shown,
  step,
  sumOf,
  vPow,
  word,
} from "./kit";

void _convexity;
const IaExpr = (n: number, i: number) => `((${adueExpr(n, i)} - ${n}*${vPow(i, n)})/${lit(i)})`;

// ===================================================================== bond price → forward rate

const bondForward: QuestionTemplate = {
  id: "int-bond-forward",
  family: "int-curve",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.spot_forward",
  secondary: ["BONDS.price_redemption", "ALM.yield_curves"],
  reasoning: ["formula_selection", "concept_recognition", "multistep", "transfer", "algebra"],
  soaConcept: "Implied forward rate recovered from a coupon bond's price and the short end of the curve.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = lvl === 2 ? 2 : 3;
    const spots = [gridRate(rng, 0.02, 0.05, 0.0025)];
    for (let t = 1; t < n; t += 1) spots.push(Number((spots[t - 1] + gridRate(rng, 0.0075, 0.02, 0.0025)).toFixed(4)));
    const c = gridRate(rng, 0.04, 0.1, 0.005) * F;
    const vt = (t: number) => Math.pow(1 + spots[t - 1], -t);
    const P = Number((range(1, n).reduce((acc0, t) => acc0 + (t === n ? c + F : c) * vt(t), 0)).toFixed(2));
    const known = range(1, n - 1).reduce((acc0, t) => acc0 + c * vt(t), 0);
    const vN = (P - known) / (c + F);
    const vPrev = vt(n - 1);
    const f = vPrev / vN - 1;
    const fmt = PCT3;
    const ytm = solveRoot((x) => range(1, n).reduce((acc0, t) => acc0 + (t === n ? c + F : c) * Math.pow(1 + x, -t), 0) - P, 0.0001, 0.5);
    const sN = Math.pow(vN, -1 / n) - 1;
    const arith = n * sN - (n - 1) * spots[n - 2];
    const noCoupons = vPrev / ((P - known) / F) - 1;
    const rootErr = Math.pow(vPrev / vN, 1 / n) - 1;
    const knownE = sumOf(range(1, n - 1).map((t) => `${lit(c)}*(1+${lit(spots[t - 1])})**(-${t})`));
    const vNE = `((${lit(P)} - ${knownE})/${lit(c + F)})`;
    const vPrevE = `(1+${lit(spots[n - 2])})**(-${n - 1})`;
    const spotText = spots.slice(0, n - 1).map((s, idx) => `the ${idx + 1}-year spot rate is ${pc(s, 2)}`).join(" and ");
    return {
      stem: `A ${word(n)}-year ${amt(F)} par bond with annual coupons of ${amt(c)} sells for ${mnum(P, 2)}. In the same market, ${spotText}.\n\nCalculate the one-year forward rate from time ${n - 1} to time ${n}.`,
      answer: {
        value: f,
        calc: `${vPrevE}/${vNE} - 1`,
        format: fmt,
        derivation: `$v_${n} = \\dfrac{${mnum(P, 2)} - ${mnum(known, 2)}}{${c + F}} = ${dec(vN, 6)}$, $f = \\dfrac{v_${n - 1}}{v_${n}} - 1 = ${shown(f, fmt)}$`,
      },
      model: {
        expr: `${knownE} + ${lit(c + F)}*${vPrevE}/(1+x) - ${lit(P)}`,
        bracket: [0.0001, 0.4],
        description: `The bond's price equals its coupons discounted on the curve, with the final payment discounted to time ${n - 1} by the spot rate and over the last year by the forward rate.`,
      },
      distractors: [
        distractor("MODEL_SINGLE_RATE", ytm, `${sumOf(range(1, n).map((t) => `${lit(t === n ? c + F : c)}*(1+x)**(-${t})`))} - ${lit(P)}`, {
          derivation: `yield to maturity $= ${shown(ytm, fmt)}$`,
          method: "Solved for the bond's yield to maturity.",
          feedback: "The yield to maturity is one rate averaged over every cash flow. The forward rate applies only to the final year, after the known spot rates have priced the earlier coupons.",
        }),
        distractor("VAR_OTHER_UNKNOWN", sN, `${vNE}**(-1/${n}) - 1`, {
          derivation: `$v_${n}^{-1/${n}} - 1 = ${shown(sN, fmt)}$`,
          method: `Reported the ${n}-year spot rate.`,
          feedback: `The spot rate runs from time 0; the forward rate covers only time ${n - 1} to ${n}.`,
        }),
        distractor("FORMULA_ARITHMETIC_FORWARD", arith, `${n}*(${vNE}**(-1/${n}) - 1) - ${n - 1}*${lit(spots[n - 2])}`, {
          derivation: `$${n}s_${n} - ${n - 1}s_${n - 1} = ${shown(arith, fmt)}$`,
          method: "Combined the spot rates linearly.",
          feedback: "Forward rates come from ratios of discount factors, not differences of rates.",
        }),
        distractor("TRANS_IGNORED_CONDITION", noCoupons, `${vPrevE}/((${lit(P)} - ${knownE})/${lit(F)}) - 1`, {
          derivation: `final payment taken as ${F}: $${shown(noCoupons, fmt)}$`,
          method: "Left the last coupon out of the final payment.",
          feedback: `At time ${n} the bond pays its last coupon and the face amount: ${c + F}.`,
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", 1 / vN - 1, `1/${vNE} - 1`, {
          derivation: `$1/v_${n} - 1 = ${shown(1 / vN - 1, fmt)}$`,
          method: `Reported the total growth from time 0 to time ${n}.`,
          feedback: `$1/v_${n} - 1$ is ${n} years of growth from today; the forward rate is the growth over the last year only, $v_${n - 1}/v_${n} - 1$.`,
        }),
        distractor("ALG_ROOT_ERROR", rootErr, `(${vPrevE}/${vNE})**(1/${n}) - 1`, {
          derivation: `$\\left(\\dfrac{v_${n - 1}}{v_${n}}\\right)^{1/${n}} - 1 = ${shown(rootErr, fmt)}$`,
          method: `Annualised the one-year ratio over ${n} years.`,
          feedback: "v_{n−1}/v_n is already one year of growth; no root is needed.",
        }),
      ],
      explanation: explanation({
        intuition: "The bond's price is a sum of zero-coupon pieces. The earlier pieces are priced by the spot rates you know; whatever is left of the price must pay for the last payment. That pins down the last discount factor, and the forward rate is just the growth between the last two discount factors.",
        translation: {
          unknowns: [
            { symbol: `$v_${n}$`, meaning: `price today of 1 paid at time ${n}` },
            { symbol: "$f$", meaning: `forward rate from ${n - 1} to ${n}` },
          ],
          relationships: [`$${mnum(P, 2)} = \\sum_{t<${n}} ${c}\\,v_t + ${c + F}\\,v_${n}$`, `$v_${n} = v_${n - 1}(1 + f)^{-1}$`],
          conditions: ["The known spot rates price the early coupons."],
          valuationDate: "Time 0 for prices; the forward rate links times n − 1 and n.",
          modelChoice: "Bootstrap the last discount factor, then convert to a forward rate.",
          assumptions: ["No arbitrage: the bond is priced on the same curve."],
        },
        solution: [
          { title: "Known coupons", body: `$\\sum_{t<${n}} ${c}\\,v_t = ${mnum(known, 2)}$` },
          { title: "Last discount factor", body: `$v_${n} = (${mnum(P, 2)} - ${mnum(known, 2)})/${c + F} = ${dec(vN, 6)}$` },
          { title: "Forward rate", body: `$f = ${dec(vPrev, 6)}/${dec(vN, 6)} - 1 = ${shown(f, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Through the spot rate",
            body: `$s_${n} = v_${n}^{-1/${n}} - 1 = ${dec(sN, 6)}$, then $(1 + s_${n})^${n} = (1 + s_${n - 1})^{${n - 1}}(1 + f)$.`,
            whenUseful: "Same answer with one extra step; useful if you think in spot rates.",
          },
          {
            name: "One equation in f",
            body: `$${mnum(P, 2)} = \\sum_{t<${n}} ${c}v_t + ${c + F}\\,v_${n - 1}(1+f)^{-1}$`,
            whenUseful: "Shows the forward rate as the unknown of a single equation of value.",
          },
        ],
        transfer: {
          principle: "Any price on a curve is a sum of discount factors; known pieces can be subtracted to isolate an unknown one, and any forward rate is a ratio of two discount factors.",
          unusual: "Bond, spot and forward ideas appear together and the bond's yield is a decoy.",
          misread: "The yield to maturity looks like the natural rate to compute.",
        },
      }),
      visuals: [
        {
          kind: "curve",
          title: "Known spot rates and the implied forward rate",
          points: [...spots.slice(0, n - 1).map((s, idx) => ({ t: idx + 1, spot: s })), { t: n, spot: sN, forward: f }],
        },
        {
          kind: "flowchart",
          title: "From a bond price to a forward rate",
          nodes: [
            { id: "p", label: `Price ${mnum(P, 2)}`, tone: "input" },
            { id: "k", label: "Subtract coupons priced by known spots", detail: `$${mnum(known, 2)}$`, tone: "step" },
            { id: "v", label: `$v_${n} = ${dec(vN, 5)}$`, tone: "step" },
            { id: "f", label: `$f = v_${n - 1}/v_${n} - 1$`, tone: "result" },
          ],
          edges: [
            { from: "p", to: "k" },
            { from: "k", to: "v" },
            { from: "v", to: "f" },
          ],
        },
      ],
      markers: [known, vN],
      presentation: ["hidden-structure", "combined-topics", "work-backwards", "irrelevant-info"],
      features: features({ steps: 3, multiConcept: true, unfamiliar: true }),
      params: { n, c, P, s1: spots[0], ...(n === 3 ? { s2: spots[1] } : {}) },
      chain: chain(
        [
          step("F.spot", "Price the coupons whose spot rates are known.", ["known", known, "value of the early coupons"], ["s_t", "c"]),
          step("F.spot-pricing", "The rest of the price pays for the final payment.", [`v_${n}`, vN, "last discount factor"], ["P", "known"], { rearranged: true }),
          step("F.forward", "Growth between the last two discount factors.", ["f", f, "forward rate"], [`v_${n - 1}`, `v_${n}`], { rearranged: true }),
        ],
        {
          methods: ["work_backwards", "rearrangement", "equation_construction"],
          unconventional: n === 3,
          stages: {
            MODEL_SINGLE_RATE: [1, "selection"],
            VAR_OTHER_UNKNOWN: [2, "interpretation"],
            FORMULA_ARITHMETIC_FORWARD: [2, "selection"],
            TRANS_IGNORED_CONDITION: [1, "connection"],
            ALG_ROOT_ERROR: [2, "application"],
            VAR_TOTAL_FOR_COMPONENT: [2, "interpretation"],
          },
          reasoning: "Write one equation of value for the bond with the forward rate as the only unknown, and solve it.",
        }
      ),
    };
  },
};

// ===================================================================== unknown refinancing rate

const refiRate: QuestionTemplate = {
  id: "int-refi-rate",
  family: "int-refinance",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.outstanding_balance", "LOANS.unknown_variables"],
  reasoning: ["cashflow_modelling", "multistep", "valuation_dates", "translation", "transfer"],
  soaConcept: "Rate implied by a refinancing: old balance, new payment, unknown new rate.",
  generate(rng, lvl): QuestionDraft {
    const p = drawUntil(
      () => {
        const L = gridAmount(rng, 50000, 250000, 5000);
        const n = rng.int(15, 30);
        const k = rng.int(4, n - 8);
        const i = gridRate(rng, 0.06, 0.1, 0.0025);
        const j0 = Number((i - gridRate(rng, 0.01, 0.03, 0.0025)).toFixed(4));
        const fee = lvl === 3 ? gridAmount(rng, 1000, 6000, 500) : 0;
        const term = lvl === 3 ? rng.int(5, Math.max(6, n - k - 3)) : n - k;
        const P = levelPayment(L, n, i);
        const Bk = P * an(n - k, i);
        const Q = Number(((Bk + fee) / an(term, j0)).toFixed(2));
        return { L, n, k, i, fee, term, P, Bk, Q };
      },
      (d) => d.term >= 5 && d.Q > 0
    );
    const { L, n, k, i, fee, term, P, Bk, Q } = p;
    const base = Bk + fee;
    const j = solveRoot((x) => Q * an(term, x) - base, 0.0001, 0.5);
    const fmt = PCT3;
    const solve = (target: number, count: number, due = false) => {
      try {
        return solveRoot((x) => Q * an(count, x) * (due ? 1 + x : 1) - target, 0.00001, 0.8);
      } catch {
        return Number.NaN;
      }
    };
    const extraPeriod = solve(base, term + 1);
    const prevBalance = solve(P * an(n - k + 1, i) + fee, term);
    const due = solve(base, term, true);
    const proportional = (i * Q) / P;
    const noFee = fee ? solve(Bk, term) : Number.NaN;
    const PE = `(${lit(L)}/${aExpr(n, i)})`;
    const BkE = `(${PE}*${aExpr(n - k, i)})`;
    const rootE = (balance: string, count: number, dueFactor = "") => `${lit(Q)}*((1-(1+x)**(-${count}))/x)${dueFactor} - (${balance})`;
    const stem =
      lvl === 2
        ? `A loan of ${amt(L)} is to be repaid with level payments at the end of each year for ${n} years at an annual effective rate of ${pc(i)}. Immediately after the ${ord(k)} payment the borrower refinances the outstanding balance. The new loan is repaid with ${n - k} level payments of ${mnum(Q, 2)} at the end of each year.\n\nCalculate the annual effective interest rate on the new loan.`
        : `A loan of ${amt(L)} is to be repaid with level payments at the end of each year for ${n} years at an annual effective rate of ${pc(i)}. Immediately after the ${ord(k)} payment the borrower refinances: the new loan equals the outstanding balance plus a ${amt(fee)} refinancing fee, and is repaid with ${term} level payments of ${mnum(Q, 2)} at the end of each year.\n\nCalculate the annual effective interest rate on the new loan.`;
    const candidates = [
      distractor("TIMING_REFINANCE_PERIODS", extraPeriod, rootE(`${BkE} + ${lit(fee)}`, term + 1), {
        derivation: `with ${term + 1} new payments: $${shown(extraPeriod, fmt)}$`,
        method: `Used ${term + 1} payments for the new loan.`,
        feedback: `The new loan has exactly ${term} payments.`,
      }),
      distractor("TIMING_BALANCE_INDEX", prevBalance, rootE(`${PE}*${aExpr(n - k + 1, i)} + ${lit(fee)}`, term), {
        derivation: `balance before payment ${k}: $${shown(prevBalance, fmt)}$`,
        method: `Refinanced the balance before the ${ord(k)} payment.`,
        feedback: `Refinancing is immediately after payment ${k}, so the balance is $P\\,a_{\\overline{${n - k}|}}$.`,
      }),
      distractor("TIMING_IMMEDIATE_AS_DUE", due, rootE(`${BkE} + ${lit(fee)}`, term, "*(1+x)"), {
        derivation: `new payments in advance: $${shown(due, fmt)}$`,
        method: "Treated the new payments as starting immediately.",
        feedback: "The new payments are at the end of each year.",
      }),
      distractor("ALG_DIVIDE_ERROR", proportional, `${lit(i)}*${lit(Q)}/${PE}`, {
        derivation: `$i \\times Q/P = ${shown(proportional, fmt)}$`,
        method: "Scaled the old rate by the ratio of the payments.",
        feedback: "Payments are not proportional to the rate: the annuity factor changes non-linearly with i. The rate must come from an equation of value.",
      }),
      ...(fee
        ? [
            distractor("TRANS_IGNORED_CONDITION", noFee, rootE(BkE, term), {
              derivation: `without the fee: $${shown(noFee, fmt)}$`,
              method: "Left the fee out of the new loan.",
              feedback: `The new loan is the balance plus ${amt(fee)}.`,
            }),
          ]
        : []),
    ].filter((d) => Number.isFinite(d.value) && d.value > 0);
    return {
      stem,
      answer: {
        value: j,
        calc: rootE(`${BkE} + ${lit(fee)}`, term),
        format: fmt,
        derivation: `$${mnum(Q, 2)}\\,${aSym(term, "j")} = ${mnum(base, 2)} \\Rightarrow j = ${shown(j, fmt)}$`,
      },
      model: {
        expr: `${pvTerms(level(Q, range(1, term)), "x")} - (${lit(L)}*${accPow(i, k)} - ${pvTerms(level(PE, range(1, k)), i)}*${accPow(i, k)} + ${lit(fee)})`,
        bracket: [0.0005, 0.4],
        description: "Retrospective old balance (plus any fee) equals the PV of the new payments at the unknown rate.",
      },
      distractors: candidates,
      explanation: explanation({
        intuition: "The refinancing date joins two loans. The old loan's terms decide how much is owed then; the new payments must repay exactly that amount. With the new payment known, the only unknown is the rate that makes the new payments worth the balance.",
        translation: {
          unknowns: [
            { symbol: "$B_k$", meaning: "balance at the refinancing date (old terms)" },
            { symbol: "$j$", meaning: "rate on the new loan" },
          ],
          relationships: [`$P = ${mamt(L)}/${aSym(n)}$ at ${mpc(i)}`, `$B_k = P\\,${aSym(n - k)}$`, `$B_k${fee ? ` + ${fee}` : ""} = ${mnum(Q, 2)}\\,${aSym(term, "j")}$`],
          conditions: [`${term} new payments`],
          valuationDate: `Time ${k}.`,
          modelChoice: "Two equations of value linked by the balance; the second is solved numerically for j.",
          assumptions: ["End-of-year payments under both loans."],
        },
        solution: [
          { title: "Old payment and balance", body: `$P = ${mnum(P, 2)}$, $B_${k} = ${mnum(Bk, 2)}$` },
          { title: "New loan amount", body: `$${mnum(base, 2)}$` },
          { title: "Solve for the rate", body: `$${mnum(Q, 2)}\\,${aSym(term, "j")} = ${mnum(base, 2)} \\Rightarrow j = ${shown(j, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Calculator",
            body: `N = ${term}, PV = ${mnum(base, 2)}, PMT = −${mnum(Q, 2)}, CPT I/Y.`,
            whenUseful: "Fastest once the new loan amount is right.",
          },
          {
            name: "Bracket by hand",
            body: `At $j = ${dec(j - 0.005, 3)}$ the payments are worth ${mnum(Q * an(term, j - 0.005), 2)}; at $${dec(j + 0.005, 3)}$, ${mnum(Q * an(term, j + 0.005), 2)}.`,
            whenUseful: "When no calculator worksheet is available; two trials and an interpolation get close.",
          },
        ],
        transfer: {
          principle: "Refinancing problems always pass through the balance at the old rate; whatever is unknown on the new loan (payment, term or rate) comes from one equation of value at the refinancing date.",
          unusual: "The new rate, not the new payment, is unknown.",
          misread: "It is tempting to scale the rate by the payments.",
        },
      }),
      visuals: [
        {
          kind: "amortization",
          title: "Old loan, then the refinanced loan",
          principal: L,
          rate: i,
          payments: Array.from({ length: k }, () => P),
          unit: "year",
          highlightPeriod: k,
          refinance: { atPeriod: k, newRate: j, newPayments: Array.from({ length: term }, () => Q) },
          caption: fee ? `The fee of ${amt(fee)} is added at the refinancing date, so the schedule after it starts slightly higher than the old balance.` : undefined,
        },
      ],
      markers: [P, Bk, base],
      presentation: ["unknown-rate", "work-backwards", "multi-equation"],
      features: features({ steps: 4, multiConcept: true, multipleValuationDates: true, unfamiliar: true }),
      params: { L, n, k, i, Q, fee, term },
      chain: chain(
        [
          step("D.loan-payment", "Payment on the original loan.", ["P", P, "original payment"], ["L", "n", "i"], { rearranged: true }),
          step("D.prospective", "Balance at the refinancing date, at the old rate.", ["B_k", Bk, "balance"], ["P", "n − k"], { valuationDate: "k" }),
          step("D.loan-payment", "New loan amount = Q × annuity factor at the unknown rate.", ["new loan", base, "amount refinanced"], ["B_k", "fee", "Q"], { valuationDate: "k" }),
          step("M.root-finding", "Solve the annuity equation for the rate.", ["j", j, "new rate"], ["Q", "new loan"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "numerical_root", "valuation_dates"],
          unconventional: lvl === 3,
          stages: {
            TIMING_REFINANCE_PERIODS: [2, "connection"],
            TIMING_BALANCE_INDEX: [1, "application"],
            TIMING_IMMEDIATE_AS_DUE: [2, "selection", "B.annuity-due"],
            ALG_DIVIDE_ERROR: [3, "selection"],
            TRANS_IGNORED_CONDITION: [2, "connection"],
          },
          reasoning: "Equation of value at the refinancing date: balance (+ fee) = PV of the new payments at j. Bracket j by trial.",
        }
      ),
    };
  },
};

// ===================================================================== equivalent level annuity

const equivalentLevel: QuestionTemplate = {
  id: "int-equivalent-level",
  family: "int-equivalence",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.non_level",
  secondary: ["ANNUITIES.arithmetic", "TVM.equation_of_value"],
  reasoning: ["translation", "cashflow_modelling", "formula_reconstruction", "multistep", "algebra"],
  soaConcept: "A non-level stream with a lump sum replaced by an equivalent level annuity.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 15);
    const P = gridAmount(rng, 1000, 4000, 100);
    const Q = gridAmount(rng, 100, 500, 25);
    const S = gridAmount(rng, 5000, 30000, 1000);
    const m = lvl === 3 ? n + rng.choice([-3, -2, 2, 3]) : n;
    const due = lvl === 3;
    const arithPV = (P - Q) * an(n, i) + Q * Ia(n, i);
    const lumpPV = S * v(i, n);
    const total = arithPV + lumpPV;
    const factor = due ? an(m, i) * (1 + i) : an(n, i);
    const X = total / factor;
    const fmt = MONEY2;
    const factorE = due ? adueExpr(m, i) : aExpr(n, i);
    const arithE = `(${lit(P - Q)}*${aExpr(n, i)} + ${lit(Q)}*${IaExpr(n, i)})`;
    const lumpE = `${lit(S)}*${vPow(i, n)}`;
    const avg = ((P + P + (n - 1) * Q) / 2) * (n / (due ? m : n)) + S / (due ? m : n);
    const lumpUndisc = (arithPV + S) / factor;
    const early = (P * an(n, i) + Q * Ia(n, i) + lumpPV) / factor;
    const geo = (P * geometricPV(n, i, Q / P) + lumpPV) / factor;
    const wrongTerm = due ? total / an(n, i) / (1 + i) : NaN;
    const immediate = due ? total / an(m, i) : NaN;
    const candidates = [
      distractor("TIMING_MISSING_PERIOD", lumpUndisc, `(${arithE} + ${lit(S)})/${factorE}`, {
        derivation: `lump sum not discounted: $${shown(lumpUndisc, fmt)}$`,
        method: "Added the lump sum at face value.",
        feedback: `The lump sum is paid at time ${n}; its value today is ${amt(S)}·v^${n}.`,
      }),
      distractor("SEQ_TERM_COUNT", early, `(${lit(P)}*${aExpr(n, i)} + ${lit(Q)}*${IaExpr(n, i)} + ${lumpE})/${factorE}`, {
        derivation: `$(P\\,a + Q(Ia) + Sv^n)/\\text{factor} = ${shown(early, fmt)}$`,
        method: "Started the increments at the first payment.",
        feedback: "With a level part of P and Q(Ia) on top, the first payment would be P + Q. The level part must be P − Q.",
      }),
      distractor("SEQ_ARITHMETIC_AS_GEOMETRIC", geo, `(${lit(P)}*(1-((1+${lit(Q / P)})/(1+${lit(i)}))**${n})/(${lit(i)}-${lit(Q / P)}) + ${lumpE})/${factorE}`, {
        derivation: `growth taken as ${pc(Q / P, 2)} a year: $${shown(geo, fmt)}$`,
        method: "Treated the fixed increase as a percentage growth.",
        feedback: `The payments rise by ${amt(Q)} each year, a fixed amount.`,
      }),
      distractor("SEQ_UNDISCOUNTED_SUM", avg, `((${lit(P)} + ${lit(P + (n - 1) * Q)})/2*${n} + ${lit(S)})/${due ? m : n}`, {
        derivation: `total payments ÷ number of payments: $${shown(avg, fmt)}$`,
        method: "Spread the undiscounted total evenly.",
        feedback: "Equivalence means equal present value; amounts at different dates cannot be added and shared out at face value.",
      }),
      ...(due
        ? [
            distractor("TIMING_IMMEDIATE_AS_DUE", immediate, `(${arithE} + ${lumpE})/${aExpr(m, i)}`, {
              derivation: `level payments at the end of each year: $${shown(immediate, fmt)}$`,
              method: "Valued the level payments as an annuity-immediate.",
              feedback: "The level payments are made at the beginning of each year: annuity-due.",
            }),
            distractor("TIMING_VALUATION_DATE", wrongTerm, `(${arithE} + ${lumpE})/${adueExpr(n, i)}`, {
              derivation: `level payments over ${n} years: $${shown(wrongTerm, fmt)}$`,
              method: `Spread the value over ${n} years instead of ${m}.`,
              feedback: `The level annuity runs for ${m} years.`,
            }),
          ]
        : []),
    ];
    return {
      stem: due
        ? `A contract pays ${amt(P)} at the end of year 1, ${amt(P + Q)} at the end of year 2, increasing by ${amt(Q)} each year until the final payment at the end of year ${n}, plus a lump sum of ${amt(S)} at the end of year ${n}. At an annual effective rate of ${pc(i)}, it is exchanged for a level payment $X$ made at the beginning of each year for ${m} years.\n\nCalculate $X$.`
        : `A contract pays ${amt(P)} at the end of year 1, ${amt(P + Q)} at the end of year 2, increasing by ${amt(Q)} each year until the final payment at the end of year ${n}, plus a lump sum of ${amt(S)} at the end of year ${n}. At an annual effective rate of ${pc(i)}, it is exchanged for a level payment $X$ at the end of each year for ${n} years.\n\nCalculate $X$.`,
      answer: {
        value: X,
        calc: `(${arithE} + ${lumpE})/${factorE}`,
        format: fmt,
        derivation: `$X = \\dfrac{${mnum(arithPV, 2)} + ${mnum(lumpPV, 2)}}{${dec(factor, 5)}} = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `${pvTerms(range(1, n).map((t) => ({ t, amount: P + (t - 1) * Q })), i)} + ${lit(S)}*${vPow(i, n)} - ${pvTerms(level("x", due ? range(0, m - 1) : range(1, n)), i)}`,
        bracket: [0, (total / factor) * 3],
        description: "Present value of every original payment equals present value of every level payment.",
      },
      distractors: candidates,
      explanation: explanation({
        intuition: "Two contracts are equivalent when they are worth the same today. Value the complicated one by splitting it into simple pieces — a level stream, a staircase and a single payment — then find the level payment with the same value.",
        translation: {
          unknowns: [{ symbol: "$X$", meaning: "the equivalent level payment" }],
          relationships: [`$PV = (${P} - ${Q})${aSym(n)} + ${Q}(Ia)_{\\overline{${n}|}} + ${S}v^{${n}}$`, due ? `$PV = X\\,\\ddot a_{\\overline{${m}|}}$` : `$PV = X\\,${aSym(n)}$`],
          conditions: ["Equal present values at the same rate."],
          valuationDate: "Time 0.",
          modelChoice: "Decompose, value each piece, then divide by the level annuity factor.",
          assumptions: ["Same effective rate for both contracts."],
        },
        solution: [
          { title: "Staircase stream", body: `$(${P - Q})${aSym(n)} + ${Q}(Ia)_{\\overline{${n}|}} = ${mnum(arithPV, 2)}$` },
          { title: "Lump sum", body: `$${S}v^{${n}} = ${mnum(lumpPV, 2)}$` },
          { title: "Level payment", body: `$X = ${mnum(total, 2)} / ${dec(factor, 5)} = ${shown(X, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Equivalent level per piece",
            body: `The lump sum alone is worth $S/${sSym(n)}$ per year over ${n} years; the staircase adds $Q\\,(Ia)/a$.`,
            whenUseful: "Shows how much of X each piece contributes.",
          },
          {
            name: "Arithmetic series reasoning",
            body: "Pair the first and last payments to see the average payment, then correct for timing — discounting makes the true X smaller than the average.",
            whenUseful: "A quick plausibility check on the size of X.",
          },
        ],
        transfer: {
          principle: "Equivalent means equal present value. Decompose any stream into level, increasing, geometric and single-payment pieces; value each; recombine.",
          unusual: due ? "Different terms and timing on the two sides of the exchange." : "A lump sum sits on top of a staircase.",
          misread: "Averaging payments ignores when they are paid.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Original payments and the level equivalent",
          unit: "year",
          series: [
            { label: "original", values: range(1, n).map((t) => ({ t, amount: P + (t - 1) * Q + (t === n ? S : 0) })) },
            { label: "level equivalent", values: (due ? range(0, m - 1) : range(1, n)).map((t) => ({ t, amount: X })) },
          ],
        },
      ],
      markers: [arithPV, lumpPV, total],
      presentation: ["indirect-wording", "compare-streams", "combined-topics"],
      features: features({ steps: 4, multiConcept: true, formulaRetrieval: true, unfamiliar: due }),
      params: { P, Q, S, i, n, m },
      chain: chain(
        [
          step("B.annuity-immediate", "The level floor P − Q.", ["(P−Q)a_n", (P - Q) * an(n, i), "floor"], ["P", "Q", "n"]),
          step("B.increasing", "The staircase Q, 2Q, … .", ["Q(Ia)_n", Q * Ia(n, i), "staircase"], ["Q", "n"]),
          step("A.discount-factor", "The lump sum at time n.", ["Sv^n", lumpPV, "lump sum today"], ["S", "n"]),
          step(due ? "B.annuity-due" : "B.annuity-immediate", "Divide the total value by the level annuity factor.", ["X", X, "equivalent level payment"], ["PV"], { rearranged: true }),
        ],
        {
          methods: ["decomposition", "equation_construction"],
          unconventional: due,
          stages: {
            TIMING_MISSING_PERIOD: [2, "application"],
            SEQ_TERM_COUNT: [0, "connection"],
            SEQ_ARITHMETIC_AS_GEOMETRIC: [1, "selection", "B.geometric-annuity"],
            SEQ_UNDISCOUNTED_SUM: [3, "selection", "M.arithmetic-series"],
            TIMING_IMMEDIATE_AS_DUE: [3, "selection", "B.annuity-immediate"],
            TIMING_VALUATION_DATE: [3, "application"],
          },
          reasoning: "Write the equation of value term by term; the original side is an arithmetic-geometric sum that splits into a level and an increasing annuity.",
        }
      ),
    };
  },
};

// ===================================================================== payoff between payment dates

const payoffBetween: QuestionTemplate = {
  id: "int-payoff-between",
  family: "int-balance",
  topic: "LOANS",
  levels: [2],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.amortization", "TVM.present_future_value"],
  reasoning: ["valuation_dates", "cashflow_modelling", "concept_recognition", "multistep"],
  soaConcept: "Outstanding balance at a date between scheduled payments.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 30000, 200000, 5000);
    const i = gridRate(rng, 0.05, 0.1, 0.005);
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 3);
    const months = rng.choice([3, 4, 6, 8, 9]);
    const frac = months / 12;
    const P = levelPayment(L, n, i);
    const Bk = P * an(n - k, i);
    const payoff = Bk * Math.pow(1 + i, frac);
    const fmt = MONEY0;
    const PE = `(${lit(L)}/${aExpr(n, i)})`;
    const BkE = `(${PE}*${aExpr(n - k, i)})`;
    return {
      stem: `A loan of ${amt(L)} is repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}. The borrower decides to repay the loan in full ${word(months)} months after the ${ord(k)} payment.\n\nCalculate the amount required.`,
      answer: {
        value: payoff,
        calc: `${BkE}*(1+${lit(i)})**(${months}/12)`,
        format: fmt,
        derivation: `$B_{${k}}(1+i)^{${months}/12} = ${mnum(Bk, 2)} \\times ${dec(Math.pow(1 + i, frac), 6)} = ${shown(payoff, fmt)}$`,
      },
      model: {
        expr: `${pvTerms(level(PE, range(k + 1, n)), i)}*(1+${lit(i)})**(${k}+${months}/12)`,
        description: `The payoff equals the value, at time ${k} + ${months}/12, of every payment still owed.`,
      },
      distractors: [
        distractor("TIMING_MISSING_PERIOD", Bk, BkE, {
          derivation: `$B_{${k}} = ${shown(Bk, fmt)}$`,
          method: "Paid the balance as it stood just after the payment.",
          feedback: `Interest keeps accruing for ${months} months after the payment.`,
        }),
        distractor("TIMING_BALANCE_INDEX", P * an(n - k - 1, i), `${PE}*${aExpr(n - k - 1, i)}`, {
          derivation: `$B_{${k + 1}} = ${shown(P * an(n - k - 1, i), fmt)}$`,
          method: "Used the balance after the next payment.",
          feedback: "The next payment has not been made yet.",
        }),
        distractor("TIMING_EXTRA_PERIOD", Bk * (1 + i), `${BkE}*(1+${lit(i)})`, {
          derivation: `$B_{${k}}(1+i) = ${shown(Bk * (1 + i), fmt)}$`,
          method: "Accrued a full year of interest.",
          feedback: `Only ${months} months have passed: the factor is $(1+i)^{${months}/12}$.`,
        }),
        distractor("TRANS_IGNORED_CONDITION", Bk * (1 + i) - P, `${BkE}*(1+${lit(i)}) - ${PE}`, {
          derivation: `$B_{${k}}(1+i) - P = ${shown(Bk * (1 + i) - P, fmt)}$`,
          method: "Rolled forward to the next payment date and deducted that payment.",
          feedback: "The loan is repaid before the next payment is due, so no further payment is deducted.",
        }),
        distractor("ALLOC_EVEN_SPLIT", Bk + frac * P, `${BkE} + ${months}/12*${PE}`, {
          derivation: `$B_{${k}} + \\tfrac{${months}}{12}P = ${shown(Bk + frac * P, fmt)}$`,
          method: "Added a proportional share of the next payment.",
          feedback: "The amount owed grows by interest on the balance, not by a share of the payment.",
        }),
      ],
      explanation: explanation({
        intuition: "Between payments nothing is paid, but interest keeps running on the balance. The payoff is the balance just after the last payment, grown for the fraction of the year that has passed.",
        translation: {
          unknowns: [{ symbol: "$X$", meaning: `amount owed ${months} months after payment ${k}` }],
          relationships: [`$B_{${k}} = P\\,${aSym(n - k)}$`, `$X = B_{${k}}(1+i)^{${months}/12}$`],
          conditions: ["Annual effective rate; compound interest for part of a year."],
          valuationDate: `Time ${k} + ${months}/12.`,
          modelChoice: "Prospective balance, then accumulate a fraction of a year.",
          assumptions: ["Compound interest within the year."],
        },
        solution: [
          { title: "Payment", body: `$P = ${mnum(P, 2)}$` },
          { title: "Balance after payment " + k, body: `$B_{${k}} = ${mnum(Bk, 2)}$` },
          { title: "Accrue", body: `$X = ${mnum(Bk, 2)}(1+i)^{${months}/12} = ${shown(payoff, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Discount the remaining payments to the payoff date",
            body: `$X = P(v^{1 - ${months}/12} + v^{2 - ${months}/12} + \\cdots)$`,
            whenUseful: "Shows that the payoff is still the value of what is owed — just measured at a different date.",
          },
        ],
        transfer: {
          principle: "A balance is a value, and values move between dates with (1 + i)^{time}; a balance between payment dates is the last balance accumulated.",
          unusual: "The date falls between scheduled payments.",
          misread: "Using a whole year's interest, or none.",
        },
      }),
      visuals: [{ kind: "amortization", title: "The schedule to the payoff", principal: L, rate: i, payments: Array.from({ length: n }, () => P), unit: "year", highlightPeriod: k }],
      markers: [P, Bk],
      presentation: ["valuation-date", "indirect-wording"],
      features: features({ steps: 3, multipleValuationDates: true, unfamiliar: true }),
      params: { L, i, n, k, months },
      chain: chain(
        [
          step("D.loan-payment", "Recover the payment.", ["P", P, "level payment"], ["L", "n", "i"], { rearranged: true }),
          step("D.prospective", "Balance just after payment k.", ["B_k", Bk, "balance"], ["P", "n − k"], { valuationDate: "k" }),
          step("A.compound", "Grow the balance for the part-year.", ["X", payoff, "payoff amount"], ["B_k", "months"], { valuationDate: "k + months/12" }),
        ],
        {
          methods: ["valuation_dates"],
          stages: {
            TIMING_MISSING_PERIOD: [2, "connection"],
            TIMING_BALANCE_INDEX: [1, "application"],
            TIMING_EXTRA_PERIOD: [2, "application"],
            TRANS_IGNORED_CONDITION: [2, "connection"],
            ALLOC_EVEN_SPLIT: [2, "selection", "A.simple"],
          },
          reasoning: "What is owed at any instant is the value then of the remaining payments; move the prospective balance forward by the elapsed fraction of a year.",
        }
      ),
    };
  },
};

// ===================================================================== business revenue as a growing stream

const revenue: QuestionTemplate = {
  id: "int-revenue-valuation",
  family: "int-growth",
  topic: "ANNUITIES",
  levels: [3],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.streams", "TVM.equation_of_value"],
  reasoning: ["concept_recognition", "translation", "transfer", "multistep", "formula_selection"],
  soaConcept: "A business valuation that is a growing annuity plus a terminal sale value.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.08, 0.14, 0.005);
    const g = gridRate(rng, 0.02, i - 0.03, 0.005);
    const n = rng.int(5, 12);
    const R = gridAmount(rng, 50000, 400000, 10000);
    const M = rng.choice([4, 5, 6, 8]);
    const revPV = R * geometricPV(n, i, g);
    const lastRevenue = R * Math.pow(1 + g, n - 1);
    const salePV = M * lastRevenue * v(i, n);
    const price = revPV + salePV;
    const fmt = MONEY0;
    const ratioE = `((1+${lit(g)})/(1+${lit(i)}))`;
    const revE = `${lit(R)}*(1-${ratioE}**${n})/(${lit(i)}-${lit(g)})`;
    const saleE = `${M}*${lit(R)}*(1+${lit(g)})**${n - 1}*${vPow(i, n)}`;
    const arith = R * an(n, i) + R * g * (Ia(n, i) - an(n, i)) + salePV;
    const levelV = R * an(n, i) + salePV;
    const nextYear = revPV + M * R * Math.pow(1 + g, n) * v(i, n);
    const diffRate = R * an(n, i - g) + salePV;
    const noSaleDisc = revPV + M * lastRevenue;
    return {
      stem: `A small business will generate revenue of ${amt(R)} at the end of the coming year. Revenue is expected to rise by ${pc(g)} a year. An investor plans to receive the revenue for ${n} years and then, immediately after receiving the year-${n} revenue, sell the business for ${word(M)} times that year's revenue.\n\nCalculate the most the investor should pay today to earn an annual effective return of ${pc(i)}.`,
      answer: {
        value: price,
        calc: `${revE} + ${saleE}`,
        format: fmt,
        derivation: `$${mnum(revPV, 2)} + ${mnum(salePV, 2)} = ${shown(price, fmt)}$`,
      },
      model: {
        expr: `${pvTerms(range(1, n).map((t) => ({ t, amount: `${lit(R)}*(1+${lit(g)})**${t - 1}` })), i)} + ${M}*${lit(R)}*(1+${lit(g)})**${n - 1}*(1+${lit(i)})**(-${n})`,
        description: "Each year's revenue discounted from its own date, plus the sale price discounted from year n.",
      },
      distractors: [
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", arith, `${lit(R)}*${aExpr(n, i)} + ${lit(R * g)}*(${IaExpr(n, i)} - ${aExpr(n, i)}) + ${saleE}`, {
          derivation: `revenue rising by ${amt(R * g)} a year: $${shown(arith, fmt)}$`,
          method: "Let revenue rise by a fixed amount.",
          feedback: `A ${pc(g)} rise compounds: year t's revenue is R(1 + g)^{t−1}.`,
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", levelV, `${lit(R)}*${aExpr(n, i)} + ${saleE}`, {
          derivation: `level revenue: $${shown(levelV, fmt)}$`,
          method: "Ignored the revenue growth.",
          feedback: "Revenue grows, so later years are worth more than the first year's revenue.",
        }),
        distractor("TIMING_VALUATION_DATE", nextYear, `${revE} + ${M}*${lit(R)}*(1+${lit(g)})**${n}*${vPow(i, n)}`, {
          derivation: `sale based on year-${n + 1} revenue: $${shown(nextYear, fmt)}$`,
          method: `Based the sale price on the following year's revenue.`,
          feedback: `The sale price is ${M} times the year-${n} revenue, R(1 + g)^{${n - 1}}.`,
        }),
        distractor("SEQ_GROWTH_RATE_DIFFERENCE", diffRate, `${lit(R)}*${aExpr(n, `(${lit(i)}-${lit(g)})`)} + ${saleE}`, {
          derivation: `level annuity at i − g: $${shown(diffRate, fmt)}$`,
          method: "Valued the revenue as a level annuity at i − g.",
          feedback: "The growth-adjusted rate is (1 + i)/(1 + g) − 1, and the first payment must also be divided by 1 + g.",
        }),
        distractor("TIMING_MISSING_PERIOD", noSaleDisc, `${revE} + ${M}*${lit(R)}*(1+${lit(g)})**${n - 1}`, {
          derivation: `sale price not discounted: $${shown(noSaleDisc, fmt)}$`,
          method: "Added the sale price without discounting it.",
          feedback: `The sale happens at time ${n}.`,
        }),
      ],
      explanation: explanation({
        intuition: "Strip away the business language: the investor buys a stream of payments that grows by a fixed percentage, plus one large payment at the end. Each part is a familiar object — a geometric annuity and a discounted lump sum.",
        translation: {
          unknowns: [{ symbol: "$V$", meaning: "maximum price today" }],
          relationships: [`$V = R\\,(Ga)_{\\overline{${n}|}\\,i,g} + ${M}R(1+g)^{${n - 1}}v^{${n}}$`],
          conditions: [`Revenue at end of year t is $R(1+g)^{t-1}$`, `Sale at year ${n} for ${M} × year-${n} revenue`],
          valuationDate: "Time 0.",
          modelChoice: "Geometric annuity for the revenue plus a single discounted payment.",
          assumptions: ["Revenue received at year ends", "Required return is the discount rate"],
        },
        solution: [
          { title: "Revenue stream", body: `$R\\,\\dfrac{1 - (\\frac{1+g}{1+i})^{${n}}}{i - g} = ${mnum(revPV, 2)}$` },
          { title: "Sale", body: `$${M} \\times ${mnum(lastRevenue, 2)} \\times v^{${n}} = ${mnum(salePV, 2)}$` },
          { title: "Price", body: `$V = ${shown(price, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Geometric series from scratch",
            body: "Write the first three discounted revenues; each is (1 + g)/(1 + i) times the previous one. Sum the finite geometric series.",
            whenUseful: "When the growing-annuity formula does not come back under pressure.",
          },
        ],
        transfer: {
          principle: "Business, pension and dividend scenarios are cash-flow streams in disguise; identify the growth pattern and the terminal payment, then value each.",
          unusual: "No annuity vocabulary appears in the question.",
          misread: "The sale multiple is applied to the wrong year's revenue.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Revenue stream and sale",
          unit: "year",
          series: [{ label: "cash to the investor", values: range(1, n).map((t) => ({ t, amount: R * Math.pow(1 + g, t - 1) + (t === n ? M * lastRevenue : 0) })) }],
        },
      ],
      markers: [revPV, salePV, lastRevenue],
      presentation: ["indirect-wording", "hidden-structure", "combined-topics"],
      features: features({ steps: 3, multiConcept: true, unfamiliar: true }),
      params: { R, g, i, n, M },
      chain: chain(
        [
          step("B.geometric-annuity", "Revenue grows by a percentage: geometric annuity.", ["revenue PV", revPV, "value of n years of revenue"], ["R", "g", "i", "n"]),
          step("A.discount-factor", "Discount the sale price from year n.", ["sale PV", salePV, "value of the sale"], ["M", "R(1+g)^{n−1}", "n"]),
          step("A.equation-of-value", "Price = value of everything the investor receives.", ["V", price, "maximum price"], ["revenue PV", "sale PV"]),
        ],
        {
          methods: ["decomposition", "geometric_series"],
          unconventional: true,
          stages: {
            SEQ_GEOMETRIC_AS_ARITHMETIC: [0, "selection", "B.increasing"],
            MODEL_LEVEL_FOR_VARYING: [0, "selection", "B.annuity-immediate"],
            TIMING_VALUATION_DATE: [1, "connection"],
            SEQ_GROWTH_RATE_DIFFERENCE: [0, "selection", "B.annuity-immediate"],
            TIMING_MISSING_PERIOD: [1, "application"],
          },
          reasoning: "List what the investor receives and when; discount each item; the revenue terms form a geometric series.",
        }
      ),
    };
  },
};

// ===================================================================== two annuities: simultaneous equations

const twoAnnuities: QuestionTemplate = {
  id: "int-two-annuities",
  family: "int-simultaneous",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.level_payment", "TVM.equation_of_value"],
  reasoning: ["simultaneous_equations", "translation", "algebra", "valuation_dates", "multistep"],
  soaConcept: "Two level streams linked by conditions at different valuation dates.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const n = rng.int(8, 15);
    const m = rng.int(2, 6);
    const due = lvl === 3;
    const { X, Y } = drawUntil(
      () => ({ X: gridAmount(rng, 1000, 5000, 50), Y: gridAmount(rng, 1000, 6000, 50) }),
      (d) => d.Y - d.X > 300
    );
    const aY = due ? an(n, i) * (1 + i) : an(n, i);
    const sY = due ? sn(n, i) * (1 + i) : sn(n, i);
    const V = Number((X * an(n, i) + Y * aY).toFixed(2));
    const E = Number((Y * sY - X * sn(n, i)).toFixed(2));
    // Solve the two equations exactly from the rounded givens.
    const det = an(n, i) * sY - aY * -sn(n, i);
    const Xs = (V * sY - aY * E) / det;
    const answer = Xs * sn(n, i) * acc(i, m);
    const fmt = MONEY0;
    const aE = aExpr(n, i);
    const sE = sExpr(n, i);
    const aYE = due ? adueExpr(n, i) : aE;
    const sYE = due ? `(${sE}*(1+${lit(i)}))` : sE;
    const XsE = `((${lit(V)}*${sYE} - ${aYE}*${lit(E)})/(${aE}*${sYE} + ${aYE}*${sE}))`;
    const Ys = (V - Xs * an(n, i)) / aY;
    const candidates = [
      distractor("VAR_OTHER_UNKNOWN", Ys * sY * acc(i, m), `(${lit(V)} - ${XsE}*${aE})/${aYE}*${sYE}*(1+${lit(i)})**${m}`, {
        derivation: `the Y stream's value: $${shown(Ys * sY * acc(i, m), fmt)}$`,
        method: "Accumulated the second stream instead of the first.",
        feedback: "The question asks for the stream of X payments.",
      }),
      distractor("TIMING_MISSING_PERIOD", Xs * sn(n, i), `${XsE}*${sE}`, {
        derivation: `$X\\,${sSym(n)} = ${shown(Xs * sn(n, i), fmt)}$`,
        method: `Stopped at time ${n}.`,
        feedback: `The value is wanted ${m} years later: multiply by $(1+i)^{${m}}$.`,
      }),
      distractor("FORMULA_AV_FOR_PV", ((V * an(n, i) - aY * E) / (an(n, i) * an(n, i) + aY * an(n, i))) * sn(n, i) * acc(i, m), `((${lit(V)}*${aE} - ${aYE}*${lit(E)})/(${aE}*${aE} + ${aYE}*${aE}))*${sE}*(1+${lit(i)})**${m}`, {
          derivation: `difference condition written with present values: $${shown(((V * an(n, i) - aY * E) / (an(n, i) * an(n, i) + aY * an(n, i))) * sn(n, i) * acc(i, m), fmt)}$`,
          method: "Wrote the accumulated-value condition with a instead of s.",
          feedback: `The difference is measured at time ${n}, so both streams are accumulated with s there.`,
        }),
      distractor("ALLOC_EVEN_SPLIT", (V / (an(n, i) + aY)) * sn(n, i) * acc(i, m), `${lit(V)}/(${aE} + ${aYE})*${sE}*(1+${lit(i)})**${m}`, {
        derivation: `X = Y assumed: $${shown((V / (an(n, i) + aY)) * sn(n, i) * acc(i, m), fmt)}$`,
        method: "Assumed the two streams pay the same amount.",
        feedback: "The second condition says the streams differ; it is needed to separate X from Y.",
      }),
      ...(due
        ? [
            distractor("TIMING_DUE_AS_IMMEDIATE", ((V * sn(n, i) - an(n, i) * E) / (2 * an(n, i) * sn(n, i))) * sn(n, i) * acc(i, m), `((${lit(V)}*${sE} - ${aE}*${lit(E)})/(2*${aE}*${sE}))*${sE}*(1+${lit(i)})**${m}`, {
              derivation: `second stream treated as end-of-year: $${shown(((V * sn(n, i) - an(n, i) * E) / (2 * an(n, i) * sn(n, i))) * sn(n, i) * acc(i, m), fmt)}$`,
              method: "Valued the second stream as an annuity-immediate.",
              feedback: "The second stream is paid at the beginning of each year: ä and s̈.",
            }),
          ]
        : [
            distractor("ALG_SIGN_ERROR", ((V / an(n, i) + E / sn(n, i)) / 2) * sn(n, i) * acc(i, m), `((${lit(V)}/${aE} + ${lit(E)}/${sE})/2)*${sE}*(1+${lit(i)})**${m}`, {
              derivation: `$X = \\tfrac12(V/a + E/s)$: $${shown(((V / an(n, i) + E / sn(n, i)) / 2) * sn(n, i) * acc(i, m), fmt)}$`,
              method: "Added the difference instead of subtracting it.",
              feedback: "X + Y = V/a and Y − X = E/s; X is half of the first minus the second.",
            }),
          ]),
    ];
    return {
      stem: due
        ? `Two annuities run for ${n} years at an annual effective rate of ${pc(i)}. Annuity A pays $X$ at the end of each year; annuity B pays $Y$ at the beginning of each year. Their combined present value is ${mnum(V, 2)}. At the end of year ${n}, the accumulated value of B exceeds that of A by ${mnum(E, 2)}.\n\nCalculate the value of annuity A's payments ${word(m)} years after the end of year ${n}.`
        : `Two annuities each make payments at the end of every year for ${n} years at an annual effective rate of ${pc(i)}: annuity A pays $X$ and annuity B pays $Y$. Their combined present value is ${mnum(V, 2)}. At the end of year ${n}, the accumulated value of B exceeds that of A by ${mnum(E, 2)}.\n\nCalculate the value of annuity A's payments ${word(m)} years after the end of year ${n}.`,
      answer: {
        value: answer,
        calc: `${XsE}*${sE}*(1+${lit(i)})**${m}`,
        format: fmt,
        derivation: `$X = ${mnum(Xs, 2)}$; $X\\,${sSym(n)}(1+i)^{${m}} = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: (() => {
          const A = sumOf(range(1, n).map((t) => vPow(i, t)));
          const Ay = due ? sumOf(range(0, n - 1).map((t) => vPow(i, t))) : A;
          const S = sumOf(range(1, n).map((t) => accPow(i, n - t)));
          const Sy = due ? sumOf(range(1, n).map((t) => accPow(i, n - t + 1))) : S;
          return `((${lit(V)}*${Sy} - ${Ay}*${lit(E)})/(${A}*${Sy} + ${Ay}*${S}))*${S}*${accPow(i, m)}`;
        })(),
        description: "Both conditions written with explicit sums of discount and accumulation factors, solved by Cramer’s rule, then A’s payments accumulated term by term.",
      },
      distractors: candidates,
      explanation: explanation({
        intuition: "Two unknown payment levels need two conditions. One condition lives at time 0, the other at time n — so each must be written with the factor that values a stream at that date. Then it is ordinary algebra.",
        translation: {
          unknowns: [
            { symbol: "$X$", meaning: "annuity A's payment" },
            { symbol: "$Y$", meaning: "annuity B's payment" },
          ],
          relationships: [`$X\\,${aSym(n)} + Y\\,${due ? "\\ddot a" : "a"}_{\\overline{${n}|}} = ${mnum(V, 2)}$`, `$Y\\,${due ? "\\ddot s" : "s"}_{\\overline{${n}|}} - X\\,${sSym(n)} = ${mnum(E, 2)}$`],
          conditions: ["Two independent conditions at two different dates."],
          valuationDate: `Time 0 for the first condition, time ${n} for the second, time ${n + m} for the answer.`,
          modelChoice: "Two linear equations in X and Y; solve by substitution or elimination.",
          assumptions: ["Same rate for both annuities."],
        },
        solution: [
          { title: "Write both equations", body: `$${dec(an(n, i), 5)}X + ${dec(aY, 5)}Y = ${mnum(V, 2)}$ and $${dec(sY, 5)}Y - ${dec(sn(n, i), 5)}X = ${mnum(E, 2)}$` },
          { title: "Eliminate Y", body: `$X = ${mnum(Xs, 2)}$` },
          { title: "Accumulate A's payments", body: `$X\\,${sSym(n)}(1+i)^{${m}} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Convert both conditions to one date first",
            body: due ? "Multiply the time-0 equation by (1 + i)^n so both conditions are at time n." : `Since $${sSym(n)} = (1+i)^{${n}}${aSym(n)}$, the first equation becomes X + Y = V/a and the second Y − X = E/s.`,
            whenUseful: "Makes the elimination a one-line subtraction.",
          },
          {
            name: "Substitution",
            body: "Solve the second equation for Y and substitute into the first.",
            whenUseful: "Natural when one equation already isolates an unknown easily.",
          },
        ],
        transfer: {
          principle: "Every condition is an equation of value at some date; two unknowns need two conditions, and moving conditions to a common date turns the problem into elementary algebra.",
          unusual: "The two conditions are stated at different dates.",
          misread: "Using a where the condition is about accumulated values.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Both streams and the three dates that matter",
          unit: "year",
          rate: i,
          flows: [
            ...range(1, n).map((t) => ({ t, amount: Xs, dir: "in" as const, label: "X", group: "A" })),
            ...(due ? range(0, n - 1) : range(1, n)).map((t) => ({ t, amount: Ys, dir: "in" as const, label: "Y", group: "B" })),
          ],
          valuationTimes: [0, n, n + m],
        },
      ],
      markers: [Xs, Ys, V / an(n, i)],
      presentation: ["multi-equation", "valuation-date", "indirect-wording"],
      features: features({ steps: 4, multiConcept: true, multipleValuationDates: true, unfamiliar: due }),
      params: { V, E, i, n, m },
      chain: chain(
        [
          step("B.annuity-immediate", "Combined present value condition at time 0.", ["Xa + Ya", V, "combined PV"], ["X", "Y", "a_n"], { valuationDate: "0" }),
          step(due ? "B.annuity-due-av" : "B.annuity-immediate-av", "Accumulated-value difference at time n.", ["Ys − Xs", E, "difference at time n"], ["X", "Y", "s_n"], { valuationDate: "n" }),
          step("M.linear-system", "Eliminate Y.", ["X", Xs, "A's payment"], ["two equations"], { rearranged: true }),
          step("A.compound", "Accumulate A's payments to the requested date.", ["value", answer, `value at time ${n + m}`], ["X s_n", "m"], { valuationDate: `${n + m}` }),
        ],
        {
          methods: ["simultaneous", "elimination", "valuation_dates"],
          unconventional: due,
          stages: {
            VAR_OTHER_UNKNOWN: [3, "interpretation"],
            TIMING_MISSING_PERIOD: [3, "connection"],
            FORMULA_AV_FOR_PV: [1, "selection", "B.annuity-immediate"],
            ALLOC_EVEN_SPLIT: [2, "connection"],
            TIMING_DUE_AS_IMMEDIATE: [1, "selection", "B.annuity-immediate-av"],
            ALG_SIGN_ERROR: [2, "application"],
          },
          reasoning: "Divide the first equation by a and the second by s: X + Y and Y − X appear directly, and half their difference is X.",
        }
      ),
    };
  },
};

// ===================================================================== payments every few years, growing

const biennial: QuestionTemplate = {
  id: "int-biennial-growth",
  family: "int-growth",
  topic: "ANNUITIES",
  levels: [2, 3],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["ANNUITIES.geometric", "TVM.effective_nominal"],
  reasoning: ["formula_reconstruction", "concept_recognition", "transfer", "algebra"],
  soaConcept: "A growing stream paid less often than the rate's period: change the clock, then use a geometric annuity.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const k = lvl === 2 ? 2 : 3;
    const count = rng.int(6, 12);
    const P = gridAmount(rng, 2000, 10000, 250);
    const annualG = lvl === 3 ? gridRate(rng, 0.015, 0.035, 0.005) : 0;
    const gPer = lvl === 2 ? gridRate(rng, 0.02, 0.06, 0.005) : Math.pow(1 + annualG, k) - 1;
    const J = Math.pow(1 + i, k) - 1;
    const PVv = P * geometricPV(count, J, gPer);
    const fmt = MONEY0;
    const JE = `((1+${lit(i)})**${k}-1)`;
    const gE = lvl === 2 ? lit(gPer) : `((1+${lit(annualG)})**${k}-1)`;
    const geoE = (rate: string, growth: string, cnt = count) => `${lit(P)}*(1-((1+${growth})/(1+${rate}))**${cnt})/(${rate}-${growth})`;
    const candidates = [
      distractor("RATE_ANNUAL_FOR_PERIODIC", P * geometricPV(count, i, gPer), geoE(lit(i), gE), {
        derivation: `annual rate per ${k}-year period: $${shown(P * geometricPV(count, i, gPer), fmt)}$`,
        method: `Discounted each ${k}-year step at the annual rate.`,
        feedback: `The payments are ${k} years apart, so each step needs the ${k}-year rate $(1+i)^{${k}} - 1 = ${dec(J, 6)}$.`,
      }),
      distractor("ALLOC_EVEN_SPLIT", P * geometricPV(count, k * i, gPer), geoE(`(${k}*${lit(i)})`, gE), {
        derivation: `${k}-year rate taken as ${k}i: $${shown(P * geometricPV(count, k * i, gPer), fmt)}$`,
        method: `Used ${k}i as the ${k}-year rate.`,
        feedback: `Interest compounds over the ${k} years; ${k}i understates the ${k}-year rate.`,
      }),
      distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", P * an(count, J) + P * gPer * (Ia(count, J) - an(count, J)), `${lit(P)}*${aExpr(count, JE)} + ${lit(P)}*${gE}*(((${aExpr(count, JE)}*(1+${JE})) - ${count}*(1+${JE})**(-${count}))/${JE} - ${aExpr(count, JE)})`, {
        derivation: `fixed increments of ${amt(P * gPer)}: $${shown(P * an(count, J) + P * gPer * (Ia(count, J) - an(count, J)), fmt)}$`,
        method: "Increased each deposit by a fixed amount.",
        feedback: "Each deposit is a percentage larger than the last, so growth compounds.",
      }),
      distractor("MODEL_LEVEL_FOR_VARYING", P * an(count, J), `${lit(P)}*${aExpr(count, JE)}`, {
        derivation: `level deposits: $${shown(P * an(count, J), fmt)}$`,
        method: "Ignored the growth.",
        feedback: "Every deposit after the first is larger.",
      }),
      distractor("TIMING_IMMEDIATE_AS_DUE", PVv * (1 + J), `${geoE(JE, gE)}*(1+${JE})`, {
        derivation: `first deposit treated as made today: $${shown(PVv * (1 + J), fmt)}$`,
        method: "Valued the stream as if the first deposit were immediate.",
        feedback: `The first deposit is ${k} years from now.`,
      }),
      ...(lvl === 3
        ? [
            distractor("TRANS_INVERTED_RELATION", P * geometricPV(count, J, annualG), geoE(JE, lit(annualG)), {
              derivation: `growth of ${pc(annualG)} per deposit: $${shown(P * geometricPV(count, J, annualG), fmt)}$`,
              method: "Applied one year's growth between deposits.",
              feedback: `Deposits are ${k} years apart, so each is $(1+g)^{${k}}$ times the previous one.`,
            }),
          ]
        : []),
    ];
    return {
      stem:
        lvl === 2
          ? `Deposits are made every ${word(k)} years, the first ${word(k)} years from now, for a total of ${count} deposits. The first deposit is ${amt(P)} and each later deposit is ${pc(gPer)} larger than the one before. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the deposits.`
          : `A sponsor will contribute to a fund every ${word(k)} years, the first contribution ${word(k)} years from now, for ${count} contributions. The first contribution is ${amt(P)}; each later contribution is increased to keep pace with inflation of ${pc(annualG)} a year since the previous contribution. The annual effective interest rate is ${pc(i)}.\n\nCalculate the present value of the contributions.`,
      answer: {
        value: PVv,
        calc: geoE(JE, gE),
        format: fmt,
        derivation: `$J = (1+i)^{${k}} - 1 = ${dec(J, 6)}$; $P\\,\\dfrac{1 - (\\frac{1+g}{1+J})^{${count}}}{J - g} = ${shown(PVv, fmt)}$`,
      },
      model: {
        expr: pvTerms(range(1, count).map((s) => ({ t: k * s, amount: `${lit(P)}*(1+${gE})**${s - 1}` })), i),
        description: `Each deposit P(1 + g)^{s−1} discounted from year ${k}s at the annual rate.`,
      },
      distractors: candidates,
      explanation: explanation({
        intuition: `Change the clock: measure time in ${k}-year steps. On that clock the deposits are an ordinary growing annuity-immediate, with the interest rate per step equal to what 1 grows to in ${k} years, minus 1.`,
        translation: {
          unknowns: [{ symbol: "$PV$", meaning: "present value of all deposits" }],
          relationships: [`$J = (1+i)^{${k}} - 1$`, lvl === 3 ? `$g = (1 + ${dec(annualG, 3)})^{${k}} - 1$ per deposit` : `$g = ${mpc(gPer)}$ per deposit`, `$PV = P\\,(Ga)_{\\overline{${count}|}\\,J,g}$`],
          conditions: [`${count} deposits, ${k} years apart, first at time ${k}.`],
          valuationDate: "Time 0.",
          modelChoice: "Convert the rate (and growth) to the deposit period, then use the geometric annuity.",
          assumptions: ["Compound interest and compound growth."],
        },
        solution: [
          { title: `${k}-year rate`, body: `$J = ${dec(J, 6)}$` },
          { title: "Growth per deposit", body: `$g = ${dec(gPer, 6)}$` },
          { title: "Geometric annuity", body: `$PV = ${shown(PVv, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Geometric series directly",
            body: `$PV = P v^{${k}}\\left[1 + r + r^2 + \\cdots + r^{${count - 1}}\\right]$, $r = (1+g)v^{${k}}$.`,
            whenUseful: "No formula to remember: recognise the ratio and sum the series.",
          },
        ],
        transfer: {
          principle: "Whenever payments and the rate have different periods, convert the rate to the payment period; growth must be measured per payment too.",
          unusual: lvl === 3 ? "Growth is quoted per year but applies per contribution." : "Deposits are less frequent than the rate.",
          misread: "Using the annual rate per step, or k·i as the k-year rate.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: `Deposits every ${k} years`,
          unit: "year",
          rate: i,
          flows: range(1, count).map((s) => ({ t: k * s, amount: P * Math.pow(1 + gPer, s - 1), dir: "out" as const })),
          valuationTimes: [0],
        },
      ],
      markers: [J, gPer],
      presentation: ["frequency", "hidden-structure", "indirect-wording"],
      features: features({ steps: 3, formulaRetrieval: true, unfamiliar: true, multiConcept: lvl === 3 }),
      params: { P, i, k, count, g: gPer },
      chain: chain(
        [
          step("A.compound", `The ${k}-year effective rate.`, ["J", J, `rate per ${k}-year step`], ["i", "k"]),
          ...(lvl === 3 ? [step("A.compound", "Growth between contributions compounds over the gap.", ["g", gPer, "growth per contribution"], ["inflation", "k"])] : []),
          step("B.geometric-annuity", "A growing annuity on the k-year clock.", ["PV", PVv, "present value"], ["P", "J", "g", "count"]),
        ],
        {
          methods: ["geometric_series", "valuation_dates"],
          unconventional: lvl === 3,
          stages: {
            RATE_ANNUAL_FOR_PERIODIC: [0, "application"],
            ALLOC_EVEN_SPLIT: [0, "application"],
            SEQ_GEOMETRIC_AS_ARITHMETIC: [lvl === 3 ? 2 : 1, "selection", "B.increasing"],
            MODEL_LEVEL_FOR_VARYING: [lvl === 3 ? 2 : 1, "selection", "B.annuity-immediate"],
            TIMING_IMMEDIATE_AS_DUE: [lvl === 3 ? 2 : 1, "application"],
            TRANS_INVERTED_RELATION: [1, "application"],
          },
          reasoning: "Write the sum of discounted deposits and spot the common ratio (1 + g)v^k — a finite geometric series.",
        }
      ),
    };
  },
};

// ===================================================================== price-change estimate from scratch

const priceChangeFromScratch: QuestionTemplate = {
  id: "int-price-change",
  family: "int-duration",
  topic: "ALM",
  levels: [2],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "BONDS.price_redemption"],
  reasoning: ["multistep", "formula_selection", "formula_retrieval", "financial_intuition"],
  soaConcept: "Bond price → duration → modified duration → first-order price change.",
  generate(rng): QuestionDraft {
    const F = 1000;
    const n = rng.int(4, 10);
    const { r, i } = drawUntil(
      () => ({ r: gridRate(rng, 0.03, 0.1, 0.005), i: gridRate(rng, 0.03, 0.09, 0.005) }),
      (d) => Math.abs(d.r - d.i) >= 0.015
    );
    const up = rng.next() < 0.5;
    const di = gridRate(rng, 0.01, 0.025, 0.0025);
    const flows = range(1, n).map((t) => ({ t, amount: F * r + (t === n ? F : 0) }));
    const P = pvFlows(flows, i);
    const D = macaulayDuration(flows, i);
    const Dmod = D / (1 + i);
    const change = P * Dmod * di;
    const fmt: AnswerFormat = MONEY2;
    const PE = sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`));
    const DE = `(${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}/${PE})`;
    const total = flows.reduce((a0, f) => a0 + f.amount, 0);
    const Dund = flows.reduce((a0, f) => a0 + f.t * f.amount, 0) / total;
    const word0 = up ? "decrease" : "increase";
    return {
      stem: `A ${n}-year ${amt(F)} par bond pays annual coupons at a rate of ${pc(r)} and is priced at an annual effective yield of ${pc(i)}. The yield then ${up ? "rises" : "falls"} by ${pc(di, 2)}.\n\nUsing the first-order modified duration approximation, estimate the ${word0} in the bond's price.`,
      answer: {
        value: change,
        calc: `${PE}*${DE}/(1+${lit(i)})*${lit(di)}`,
        format: fmt,
        derivation: `$P = ${mnum(P, 2)}$, $D_{mod} = ${dec(Dmod, 4)}$: $|\\Delta P| \\approx P\\,D_{mod}\\,|\\Delta i| = ${shown(change, fmt)}$`,
      },
      model: {
        expr: `-${lit(di)}*(${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)}+0.000001)**(-${f.t})`))} - ${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)}-0.000001)**(-${f.t})`))})/0.000002`,
        description: "The tangent-line change −P′(i)·|Δi|, with the derivative of the price computed numerically.",
      },
      distractors: [
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", P * D * di, `${PE}*${DE}*${lit(di)}`, {
          derivation: `$P\\,D\\,|\\Delta i| = ${shown(P * D * di, fmt)}$`,
          method: "Used Macaulay duration in the modified approximation.",
          feedback: "Correct duration, wrong price-change step: divide by (1 + i) first.",
        }),
        distractor("ALG_DIVIDE_ERROR", P * D * (1 + i) * di, `${PE}*${DE}*(1+${lit(i)})*${lit(di)}`, {
          derivation: `$D_{mod} = D(1+i)$: $${shown(P * D * (1 + i) * di, fmt)}$`,
          method: "Multiplied by (1 + i) instead of dividing.",
          feedback: "Modified duration is smaller than Macaulay duration: D/(1 + i).",
        }),
        distractor("CONC_PAR_ASSUMPTION", F * Dmod * di, `${lit(F)}*${DE}/(1+${lit(i)})*${lit(di)}`, {
          derivation: `starting price taken as ${F}: $${shown(F * Dmod * di, fmt)}$`,
          method: "Applied the duration to par instead of the actual price.",
          feedback: "The coupon rate and yield differ, so the bond is not at par; compute P first.",
        }),
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", P * (Dund / (1 + i)) * di, `${PE}*(${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}`))}/${lit(total)})/(1+${lit(i)})*${lit(di)}`, {
          derivation: `duration with undiscounted weights ${dec(Dund, 4)}: $${shown(P * (Dund / (1 + i)) * di, fmt)}$`,
          method: "Weighted the times by undiscounted cash flows.",
          feedback: "Duration weights are present values.",
        }),
        distractor("VAR_OTHER_UNKNOWN", up ? P - change : P + change, `${PE}*(1 ${up ? "-" : "+"} ${DE}/(1+${lit(i)})*${lit(di)})`, {
          derivation: `new price $P(1 ${up ? "-" : "+"} D_{mod}|\\Delta i|) = ${shown(up ? P - change : P + change, fmt)}$`,
          method: "Reported the estimated new price instead of the change.",
          feedback: `The question asks for the ${word0}, not the price after it.`,
        }),
      ],
      explanation: explanation({
        intuition: "Three linked quantities: the price at today's yield, how sensitive that price is (duration), and the tangent-line step for the yield change. Each feeds the next.",
        translation: {
          unknowns: [{ symbol: "$|\\Delta P|$", meaning: `estimated ${word0} in price` }],
          relationships: ["$P = \\sum CF_t v^t$", "$D = \\sum t\\,CF_t v^t / P$", "$D_{mod} = D/(1+i)$", "$\\Delta P \\approx -P\\,D_{mod}\\,\\Delta i$"],
          conditions: [`$|\\Delta i| = ${dec(di, 4)}$`],
          valuationDate: "Time 0 at both yields.",
          modelChoice: "Price → duration → modified duration → linear approximation.",
          assumptions: ["Flat yield curve, parallel shift.", "First-order only."],
        },
        solution: [
          { title: "Price", body: `$P = ${mnum(P, 2)}$` },
          { title: "Durations", body: `$D = ${dec(D, 4)}$, $D_{mod} = ${dec(Dmod, 4)}$` },
          { title: "Change", body: `$${mnum(P, 2)} \\times ${dec(Dmod, 4)} \\times ${dec(di, 4)} = ${shown(change, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Reprice exactly",
            body: `At the new yield the price is ${mnum(pvFlows(flows, up ? i + di : i - di), 2)}, a change of ${mnum(Math.abs(pvFlows(flows, up ? i + di : i - di) - P), 2)} — the difference from the estimate is the convexity effect.`,
            whenUseful: "A check on the size of the approximation error.",
          },
        ],
        transfer: {
          principle: "Sensitivity questions chain: value the cash flows, take the PV-weighted time, convert to modified duration, then apply the tangent line.",
          unusual: "Neither the price nor the duration is given.",
          misread: "Starting from par, or using Macaulay duration in the linear formula.",
        },
      }),
      visuals: [{ kind: "duration", title: "Tangent-line estimate", flows, rate: i, shock: up ? di : -di }],
      markers: [P, D, Dmod],
      presentation: ["combined-topics", "multi-equation"],
      features: features({ steps: 4, multiConcept: true, formulaRetrieval: true }),
      params: { n, r, i, di, up },
      chain: chain(
        [
          step("E.price", "Price at the current yield.", ["P", P, "price"], ["coupons", "redemption", "i"]),
          step("G.macaulay", "PV-weighted average time.", ["D", D, "Macaulay duration"], ["P", "PV_t"]),
          step("G.modified", "Convert to modified duration.", ["D_mod", Dmod, "modified duration"], ["D", "i"]),
          step("G.approx-modified", "Tangent-line change in price.", ["|ΔP|", change, `estimated ${word0}`], ["P", "D_mod", "Δi"]),
        ],
        {
          stages: {
            FORMULA_MODIFIED_FOR_MACAULAY: [2, "connection"],
            ALG_DIVIDE_ERROR: [2, "application"],
            CONC_PAR_ASSUMPTION: [3, "connection"],
            MODEL_UNDISCOUNTED_WEIGHTS: [1, "application"],
            VAR_OTHER_UNKNOWN: [3, "interpretation"],
          },
          reasoning: "P′(i) = −Σ t CF v^{t+1}: compute the derivative directly and multiply by the change in yield.",
        }
      ),
    };
  },
};

export const INTEGRATED_TEMPLATES: QuestionTemplate[] = [bondForward, refiRate, equivalentLevel, payoffBetween, revenue, twoAnnuities, biennial, priceChangeFromScratch];

void bondPrice;
void MONEY2;
