/**
 * Elite (level 4) loan templates: multi-event timelines (missed payments,
 * refinancing with fees, curtailments, rate resets), payments tied to the
 * interest due or growing geometrically, points and fees, lender
 * reinvestment across a changing rate, and level-principal loans that are
 * refinanced. Each template has two cases.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import { MONEY2, amt, drawUntil, gridAmount, gridRate, ord, pc, step } from "./kit";
import { K, X, add, an, at, div, elite, geoA, mul, nameOf, pick, pow, rootOf, sn, sub, sum, vt, type Eq } from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const pct = (x: number) => pc(x, 3);
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));

/** Retrospective balance written payment by payment: L(1+i)^t − Σ P(1+i)^{t−k}. */
const retro = (L: number, P: X | number, i: X | number, t: number): X => sub(mul(L, at(i, t)), flows(t, (k) => mul(P, at(i, t - k - 1))));

/** Largest whole number of level payments P (first one period from now) that a balance B supports at rate r. */
function fullPayments(B: number, P: number, r: number): number {
  let n = 0;
  let pv = 0;
  while (pv + P * Math.pow(1 + r, -(n + 1)) <= B + 1e-9 && n < 600) {
    pv += P * Math.pow(1 + r, -(n + 1));
    n += 1;
  }
  return n;
}

// ===================================================================== 1. Missed payments, refinancing with a fee and a curtailment

const missedRefi: QuestionTemplate = {
  id: "el-loan-missed-refi",
  family: "el-loan-missed-refi",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.outstanding_balance", "LOANS.final_payments", "LOANS.amortization"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "translation"],
  soaConcept: "Missed payments capitalise interest; a refinancing adds a fee and takes a curtailment; the new schedule runs to the original maturity or pays the old amount until a drop payment.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 40000, 200000, 5000);
    const n = rng.int(15, 25);
    const t = rng.int(4, n - 10);
    const i = gridRate(rng, 0.05, 0.09, 0.0025);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.07, 0.0025), (x) => i - x >= 0.01);
    const f = pick(rng, [0.01, 0.015, 0.02, 0.025]);
    const P = L / an(i, n).v;
    const Bt = P * an(i, n - t).v;
    const E = Math.round((Bt * (0.05 + rng.next() * 0.1)) / 500) * 500;
    const name = nameOf(rng);
    const kase = pick(rng, ["new-payment", "drop"]);
    const PX = div(L, an(i, n));
    const balance = (o: { missRate?: number; noFee?: boolean; addE?: boolean; paidThrough?: boolean } = {}) => {
      const B0 = mul(PX, an(i, n - t));
      const carried = o.paidThrough ? mul(PX, an(i, n - t - 2)) : mul(B0, at(o.missRate ?? i, 2));
      return add(mul(carried, o.noFee ? 1 : 1 + f), o.addE ? E : -E);
    };
    const B2 = balance();
    const story = `${name} borrows ${amt(L)}, to be repaid by level payments at the end of each year for ${n} years at an annual effective rate of ${pct(i)}. ${name} makes the first ${t} payments but misses the payments due at times ${t + 1} and ${t + 2}; unpaid interest is added to the balance. At time ${t + 2} the loan is refinanced at an annual effective rate of ${pct(j)}: a refinancing fee of ${pc(f, 1)} of the balance at that time is added to the balance, and ${name} immediately pays ${amt(E)} to reduce it.`;
    const baseSteps = [
      step("D.loan-payment", "Original level payment.", ["P", P, "original payment"], ["L", "i"]),
      step("D.prospective", `Balance after the ${ord(t)} payment.`, ["B_t", Bt, `balance at time ${t}`], ["P", "i"]),
      step("A.accumulation", "Two missed payments: the balance accumulates two years.", ["B_{t+2}", Bt * Math.pow(1 + i, 2), `balance at time ${t + 2} before refinancing`], ["B_t", "i"]),
      step("A.equation-of-value", "Add the fee, subtract the curtailment.", ["B'", B2.v, "refinanced balance"], ["fee", "E"], { derived: true }),
    ];
    if (kase === "new-payment") {
      const m = n - t - 2;
      const pay = (B: X, o: { term?: number; rate?: number } = {}) => div(B, an(o.rate ?? j, o.term ?? m));
      const ans = pay(B2);
      return elite({
        stem: `${story} The refinanced loan is repaid by level payments at the end of each year, ending at the original maturity date.\n\nCalculate the new annual payment.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(flows(m, (k) => mul(x, vt(j, k + 1))), sub(mul(retro(L, P, i, t), at(i, 2), 1 + f), E)), lo: ans.v * 0.3, hi: ans.v * 3 },
        modelDescription: "Retrospective balance at time t written payment by payment, carried two years, fee and curtailment applied, equated to the new payments discounted one by one.",
        traps: [
          { id: "TIMING_REFINANCE_PERIODS", value: pay(B2, { term: n - t }), label: "new term counted from the last payment made", method: `Spread the balance over ${n - t} payments.`, feedback: `Maturity is time ${n}; the new payments are at times ${t + 3} to ${n}: ${m} payments.` },
          { id: "MODEL_BALANCE_AT_NEW_RATE", value: pay(balance({ missRate: j })), label: "missed years at the new rate", method: `Accumulated the missed years at ${pct(j)}.`, feedback: `The old rate ${pct(i)} applies until the refinancing.` },
          { id: "TRANS_IGNORED_CONDITION", value: pay(balance({ noFee: true })), label: "fee ignored", method: "Left out the refinancing fee.", feedback: `The fee adds ${pc(f, 1)} to the balance.` },
          { id: "ALG_SIGN_ERROR", value: pay(balance({ addE: true })), label: "curtailment added", method: "Added the curtailment to the balance.", feedback: "A curtailment reduces the balance." },
          { id: "CONC_LOAN_REFI_OLD_RATE", value: pay(B2, { rate: i }), label: "new schedule at the old rate", method: `Amortised the new balance at ${pct(i)}.`, feedback: `The refinanced rate is ${pct(j)}.` },
          { id: "TIMING_BALANCE_INDEX", value: pay(balance({ paidThrough: true })), label: "balance as if the payments were made", method: `Used the scheduled balance at time ${t + 2}.`, feedback: "The two payments were missed, so the balance grew instead of falling." },
        ],
        steps: [...baseSteps, step("D.loan-payment", `New level payment over the ${m} remaining years.`, ["P'", ans.v, "new payment"], ["B'", "j"], { rearranged: true })],
        methods: ["valuation_dates", "decomposition", "rearrangement"],
        reasoning: "Balance after the last payment made, carried two years at the old rate, fee added, curtailment subtracted, then amortised at the new rate over the payments left to the original maturity.",
        intuition: "Each event changes the balance at one date: follow the balance along the timeline.",
        unknowns: [{ symbol: "$P'$", meaning: "new annual payment" }],
        relationships: ["$B' = B_t(1+i)^2(1+f) - E$", `$P' = B'/a_{\\overline{${m}|}j}$`],
        conditions: ["Missed interest is capitalised.", "The fee is added before the curtailment."],
        valuationDate: `Time ${t + 2}`,
        modelChoice: "Balance-tracking through events, then amortisation.",
        assumptions: ["No other fees."],
        principle: "A refinancing replaces the balance at that date with a new loan.",
        unusual: "Missed payments, a fee and a curtailment in one event chain.",
        misread: "Counting the new term from the last payment made.",
        presentation: ["mixed-timing", "valuation-date", "irrelevant-info", "work-backwards"],
        features: { multipleValuationDates: true },
        params: { kase, L, n, t, i, j, f, E },
        route: "payment, balance, missed, fee, new payment",
      });
    }
    // drop: keep paying the original P at the new rate until a smaller final payment
    const Bv = B2.v;
    if (Bv * j >= P * 0.9) throw new Error("Payment does not cover interest.");
    const N = fullPayments(Bv, P, j);
    const dropOf = (B: X, o: { rate?: number; late?: number } = {}) => {
      const r = o.rate ?? j;
      const NN = fullPayments(B.v, P, r);
      return mul(sub(B, mul(P, an(r, NN))), at(r, NN + 1 + (o.late ?? 0)));
    };
    const ans = dropOf(B2);
    if (ans.v < 0.1 * P) throw new Error("Drop too small.");
    return elite({
      stem: `${story} After refinancing, ${name} keeps paying ${amt(P)} at the end of each year, followed by one smaller final payment one year after the last full payment.\n\nCalculate the final payment.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (x: X) => sub(add(flows(N, (k) => mul(P, vt(j, k + 1))), mul(x, vt(j, N + 1))), sub(mul(retro(L, P, i, t), at(i, 2), 1 + f), E)), lo: 0.01, hi: P * 2 },
      modelDescription: "Refinanced balance (retrospective, then events) equals the full payments plus the final payment, each discounted at the new rate.",
      traps: [
        { id: "CHAL_BALLOON_FOR_DROP", value: add(P, mul(ans, vt(j, 1))), label: "balloon instead of drop", method: "Added the remainder to the last full payment.", feedback: "A drop payment is separate and one year later." },
        { id: "TIMING_EXTRA_PERIOD", value: dropOf(B2, { late: 1 }), label: "final payment a year late", method: "Accumulated the remainder one year too many.", feedback: `The final payment is at the ${ord(N + 1)} year after refinancing.` },
        { id: "TRANS_IGNORED_CONDITION", value: dropOf(balance({ noFee: true })), label: "fee ignored", method: "Left out the fee.", feedback: `The fee adds ${pc(f, 1)}.` },
        { id: "CONC_LOAN_REFI_OLD_RATE", value: dropOf(B2, { rate: i }), label: "old rate after refinancing", method: `Ran the schedule at ${pct(i)}.`, feedback: `The new rate is ${pct(j)}.` },
        { id: "MODEL_BALANCE_AT_NEW_RATE", value: dropOf(balance({ missRate: j })), label: "missed years at the new rate", method: `Accumulated the missed years at ${pct(j)}.`, feedback: "The old rate applies before the refinancing." },
        { id: "ALG_SIGN_ERROR", value: dropOf(balance({ addE: true })), label: "curtailment added", method: "Added the curtailment.", feedback: "A curtailment reduces the balance." },
      ],
      steps: [
        ...baseSteps,
        step("B.counting", "Number of full payments the refinanced balance supports.", ["N", N, "full payments after refinancing"], ["B'", "P", "j"], { rearranged: true }),
        step("D.drop-balloon", "Remainder accumulated to the date of the final payment.", ["X", ans.v, "final payment"], ["B'", "N"]),
      ],
      methods: ["valuation_dates", "logarithms", "decomposition"],
      reasoning: "Track the balance through the missed payments, fee and curtailment; count the full payments of the old amount at the new rate; accumulate what is left to the next payment date.",
      intuition: "Same payment, lower rate: the loan finishes early with a small last payment.",
      unknowns: [{ symbol: "$X$", meaning: "final payment" }],
      relationships: ["$B' = P a_{\\overline{N|}j} + X v_j^{N+1}$"],
      conditions: ["Payments continue at the original amount."],
      valuationDate: `Time ${t + 2}`,
      modelChoice: "Balance-tracking, counting, drop payment.",
      assumptions: ["No other fees."],
      principle: "A drop payment is the remaining balance accumulated to its own date.",
      unusual: "The refinanced loan keeps the old payment amount.",
      misread: "Adding the remainder to the last full payment.",
      presentation: ["unknown-time", "mixed-timing", "valuation-date", "work-backwards"],
      features: { multipleValuationDates: true },
      params: { kase, L, n, t, i, j, f, E },
      route: "payment, balance, missed, fee, count, drop",
    });
  },
};

// ===================================================================== 2. Payments tied to interest, or growing geometrically

const interestMultiple: QuestionTemplate = {
  id: "el-loan-interest-multiple",
  family: "el-loan-interest-multiple",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.principal_interest", "LOANS.outstanding_balance", "ANNUITIES.geometric"],
  reasoning: ["algebra", "cashflow_modelling", "multistep", "formula_reconstruction"],
  soaConcept: "Payments defined as a multiple of the interest due make the balance geometric; growing payments make the prospective balance a geometric annuity.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 20000, 150000, 5000);
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const name = nameOf(rng);
    const kase = pick(rng, ["multiple", "geometric"]);
    if (kase === "multiple") {
      const c = pick(rng, [1.5, 1.75, 2, 2.5, 3]);
      const k = rng.int(4, 9);
      const m = rng.int(5, 12);
      const j = drawUntil(() => gridRate(rng, 0.04, 0.09, 0.0025), (x) => Math.abs(x - i) >= 0.01);
      const r = 1 - (c - 1) * i;
      const total = (o: { constInterest?: boolean; phase2Rate?: number; index?: number; totalPay?: boolean; phase2Only?: boolean } = {}) => {
        const kk = o.index ?? k;
        const phase1 = o.constInterest ? K(c * i * L * kk) : mul(c * i * L, div(sub(1, pow(r, kk)), 1 - r));
        const Bk = o.constInterest ? sub(L, (c - 1) * i * L * kk) : mul(L, pow(r, kk));
        const P2 = div(Bk, an(o.phase2Rate ?? j, m));
        const phase2Interest = sub(mul(m, P2), Bk);
        if (o.phase2Only) return phase2Interest;
        const all = add(phase1, mul(m, P2));
        return o.totalPay ? all : sub(all, L);
      };
      const ans = total();
      const explicitPhase1 = flows(k, (t) => mul(c * i * L, pow(r, t)));
      return elite({
        stem: `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)}. At the end of each of the first ${k} years ${name} pays ${c} times the interest due for that year. The balance at time ${k} is then refinanced at an annual effective rate of ${pct(j)} and repaid by level payments at the end of each year for ${m} years.\n\nCalculate the total interest paid over the life of the loan.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(add(explicitPhase1, mul(m, div(sub(L, sum(Array.from({ length: k }, (_, t) => mul((c - 1) * i * L, pow(r, t))))), an(j, m)))), L),
        modelDescription: "First-phase payments listed year by year; the balance at the refinancing as L minus the principal repaid each year; total payments minus the amount borrowed.",
        traps: [
          { id: "MODEL_INTEREST_ON_ORIGINAL", value: total({ constInterest: true }), label: "interest on the original amount", method: "Charged interest on the original amount every year.", feedback: `Each payment exceeds the interest, so the balance falls by the factor ${r.toFixed(4)} each year.` },
          { id: "VAR_TOTAL_FOR_COMPONENT", value: total({ totalPay: true }), label: "total payments", method: "Gave the total of all payments.", feedback: "Subtract the principal (the amount borrowed)." },
          { id: "CONC_LOAN_REFI_OLD_RATE", value: total({ phase2Rate: i }), label: "second phase at the old rate", method: `Amortised the second phase at ${pct(i)}.`, feedback: `The refinanced rate is ${pct(j)}.` },
          { id: "TIMING_BALANCE_INDEX", value: total({ index: k - 1 }), label: "balance one year early", method: `Refinanced the balance at time ${k - 1}.`, feedback: `${k} payments are made before refinancing.` },
          { id: "VAR_OTHER_UNKNOWN", value: total({ phase2Only: true }), label: "second-phase interest only", method: "Counted only the interest in the level payments.", feedback: "The first-phase payments also contain interest." },
        ],
        steps: [
          step("D.balance-recursion", "Each payment repays (c − 1) times the interest: the balance is multiplied by 1 − (c − 1)i.", ["r", r, "balance ratio per year"], ["c", "i"], { derived: true }),
          step("B.geometric-series", "First-phase payments form a geometric series.", ["S_1", mul(c * i * L, div(sub(1, pow(r, k)), 1 - r)).v, "first-phase payments"], ["r"]),
          step("D.retrospective", `Balance at time ${k}.`, ["B_k", L * Math.pow(r, k), `balance at time ${k}`], ["r"]),
          step("D.loan-payment", "Level payment of the second phase.", ["P_2", L * Math.pow(r, k) / an(j, m).v, "second-phase payment"], ["B_k", "j"]),
          step("D.total-interest", "Total payments minus the amount borrowed.", ["I", ans.v, "total interest"], ["S_1", "P_2"]),
        ],
        methods: ["geometric_series", "decomposition", "substitution"],
        reasoning: "A payment of c times the interest repays (c−1)·i·B of principal, so the balance falls geometrically; sum the first-phase payments, find the balance and level payment of the second phase, and subtract the amount borrowed from all payments.",
        intuition: "Total interest = total paid − amount borrowed, however the schedule is shaped.",
        unknowns: [{ symbol: "$I$", meaning: "total interest" }],
        relationships: ["$B_t = L(1 - (c-1)i)^t$", "$I = \\sum \\text{payments} - L$"],
        conditions: ["The refinancing has no fee."],
        valuationDate: "Undiscounted total",
        modelChoice: "Balance recursion and total-interest identity.",
        assumptions: ["Rates as stated."],
        principle: "Total interest is total payments minus principal, with no discounting.",
        unusual: "Payments defined relative to the interest due.",
        misread: "Charging interest on the original amount.",
        presentation: ["hidden-structure", "mixed-timing", "multi-equation", "combined-topics"],
        params: { kase, L, i, j, c, k, m },
        route: "ratio, geometric sum, balance, payment, total",
      });
    }
    const n = rng.int(10, 25);
    const g = drawUntil(() => pick(rng, [0.02, 0.03, 0.04, 0.05]), (x) => Math.abs(x - i) >= 0.005);
    const r = rng.int(3, n - 3);
    const P1 = div(L, geoA(i, g, n));
    const principal = (o: { idx?: number; grown?: boolean; interest?: boolean; level?: boolean } = {}) => {
      if (o.level) {
        const P = div(L, an(i, n));
        return mul(P, vt(i, n - r + 1));
      }
      const p1 = o.grown ? div(L, mul(geoA(i, g, n), 1 + g)) : P1;
      const Pr = mul(p1, Math.pow(1 + g, r - 1));
      const b = o.idx ?? r - 1;
      const B = mul(p1, Math.pow(1 + g, b), geoA(i, g, n - b));
      return o.interest ? mul(i, B) : sub(Pr, mul(i, B));
    };
    const ans = principal();
    const explicitB = (p1: X) => sub(mul(L, at(i, r - 1)), flows(r - 1, (t) => mul(p1, Math.pow(1 + g, t), at(i, r - 2 - t))));
    return elite({
      stem: `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)}, repaid by ${n} payments at the end of each year. Each payment is ${pc(g, 1)} larger than the previous one.\n\nCalculate the amount of principal repaid in the ${ord(r)} payment.`,
      fmt: MONEY2,
      answer: ans,
      model: sub(mul(P1, Math.pow(1 + g, r - 1)), mul(i, explicitB(div(L, flows(n, (t) => mul(Math.pow(1 + g, t), vt(i, t + 1))))))),
      modelDescription: "First payment from the payments discounted one by one; balance before the payment retrospectively; principal = payment − interest on that balance.",
      traps: [
        { id: "VAR_INTEREST_FOR_PRINCIPAL", value: principal({ interest: true }), label: "interest portion", method: "Gave the interest in the payment.", feedback: "Principal = payment − interest." },
        { id: "TIMING_BALANCE_INDEX", value: principal({ idx: r }), label: "balance after the payment", method: `Charged interest on the balance after the ${ord(r)} payment.`, feedback: `Interest in payment ${r} is on the balance after payment ${r - 1}.` },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: principal({ grown: true }), label: "first payment already grown", method: "Grew the first payment.", feedback: "The first payment is the base payment." },
        { id: "MODEL_LEVEL_FOR_VARYING", value: principal({ level: true }), label: "level-payment shortcut", method: "Used the level-payment formula $P v^{n-r+1}$.", feedback: "That shortcut holds only for level payments." },
        { id: "CONC_LOAN_PRINCIPAL_LEVEL", value: K(L / n), label: "equal principal each year", method: `Took principal as ${amt(L)}/${n}.`, feedback: "Principal repayments are not level." },
      ],
      steps: [
        step("B.geometric-annuity", "First payment from the loan amount.", ["P_1", P1.v, "first payment"], ["L", "g", "i"], { rearranged: true }),
        step("D.prospective", `Balance after payment ${r - 1}: the remaining growing payments.`, ["B_{r-1}", mul(P1, Math.pow(1 + g, r - 1), geoA(i, g, n - r + 1)).v, `balance after payment ${r - 1}`], ["P_1", "g", "i"]),
        step("D.interest-component", `Interest in payment ${r}.`, ["I_r", mul(i, mul(P1, Math.pow(1 + g, r - 1), geoA(i, g, n - r + 1))).v, "interest portion"], ["B_{r-1}", "i"]),
        step("D.principal-component", `Payment ${r} minus its interest.`, ["PR_r", ans.v, "principal portion"], ["P_r", "I_r"]),
      ],
      methods: ["geometric_series", "substitution", "rearrangement"],
      reasoning: "Solve the geometric annuity for the first payment, value the remaining growing payments to get the balance, and split the payment into interest and principal.",
      intuition: "The balance is always the value of the payments still to come.",
      unknowns: [{ symbol: "$PR_r$", meaning: "principal in payment r" }],
      relationships: ["$L = P_1\\dfrac{1 - ((1+g)/(1+i))^n}{i - g}$", "$PR_r = P_r - iB_{r-1}$"],
      conditions: ["Payments grow geometrically."],
      valuationDate: `Time ${r - 1}`,
      modelChoice: "Prospective balance of a growing annuity.",
      assumptions: ["Rate constant."],
      principle: "Principal in a payment = payment − interest on the previous balance, for any payment pattern.",
      unusual: "Growing payments, where the level-payment shortcut fails.",
      misread: "Using $Pv^{n-r+1}$.",
      presentation: ["hidden-structure", "valuation-date", "rearrange-first", "combined-topics"],
      features: { multipleValuationDates: true },
      params: { kase, L, i, n, g, r },
      route: "first payment, prospective balance, interest, principal",
    });
  },
};

// ===================================================================== 3. Points and fees: the borrower's effective cost

const pointsCost: QuestionTemplate = {
  id: "el-loan-points-cost",
  family: "el-loan-points-cost",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.amortization", "TVM.effective_nominal", "ALM.rates_of_return"],
  reasoning: ["translation", "cashflow_modelling", "multistep", "algebra"],
  soaConcept: "Points and fees reduce the amount the borrower actually receives, so the borrower's effective rate exceeds the contract rate.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 100000, 400000, 10000);
    const n = pick(rng, [10, 15, 20, 25, 30]);
    const i12 = gridRate(rng, 0.03, 0.07, 0.00125);
    const Fee = gridAmount(rng, 500, 3000, 100);
    const name = nameOf(rng);
    const kase = pick(rng, ["cost", "break-even-points"]);
    const months = 12 * n;
    const Pm = (rate12: number) => div(L, an(rate12 / 12, months));
    const PA = Pm(i12);
    const pvAt = (annual: X, P: X, due = false) => mul(P, div(sub(1, pow(add(1, annual), -n)), sub(pow(add(1, annual), 1 / 12), 1)), due ? pow(add(1, annual), 1 / 12) : 1);
    if (kase === "cost") {
      const p = pick(rng, [0.01, 0.015, 0.02, 0.025, 0.03]);
      const received = (o: { noFee?: boolean; noPoints?: boolean }) => L * (1 - (o.noPoints ? 0 : p)) - (o.noFee ? 0 : Fee);
      const costEq = (o: { noFee?: boolean; noPoints?: boolean; due?: boolean }): Eq => ({ eq: (x: X) => sub(pvAt(x, PA, o.due), received(o)), lo: 0.0005, hi: 0.3 });
      const ans = costEq({});
      const annualOf = (q: Eq) => rootOf(q);
      const contract = Math.pow(1 + i12 / 12, 12) - 1;
      return elite({
        stem: `${name} takes a loan of ${amt(L)} repaid by level monthly payments over ${n} years at a nominal annual rate of ${pct(i12)} convertible monthly. The lender charges ${pc(p, 1)} of the loan amount in points and a fixed fee of ${amt(Fee)}, both deducted from the amount advanced at time 0.\n\nCalculate ${name}'s annual effective cost of borrowing.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(flows(months, (k) => mul(PA, pow(add(1, x), -(k + 1) / 12))), received({})), lo: 0.0005, hi: 0.3 },
        modelDescription: "Every monthly payment discounted at the unknown annual effective rate equals the net amount received.",
        traps: [
          { id: "CONC_LOAN_PRICE_IS_BALANCE", value: K(contract), label: "contract rate", method: "Gave the annual effective contract rate.", feedback: "Points and fees reduce what is received, so the cost is higher." },
          { id: "TRANS_IGNORED_CONDITION", value: costEq({ noFee: true }), label: "fee ignored", method: "Included the points but not the fee.", feedback: `The ${amt(Fee)} fee is also deducted.` },
          { id: "VAR_OTHER_UNKNOWN", value: { eq: (x: X) => sub(pvAt(sub(pow(add(1, div(x, 12)), 12), 1), PA), received({})), lo: 0.0005, hi: 0.3 }, label: "nominal monthly rate", method: "Gave the nominal annual rate convertible monthly.", feedback: "Convert the monthly rate to an annual effective rate." },
          { id: "ALLOC_EVEN_SPLIT", value: K(contract + (p + Fee / L) / n), label: "points spread evenly", method: `Added the points and fee, divided by ${n} years, to the contract rate.`, feedback: "Solve the equation of value; spreading the charges evenly ignores their timing." },
          { id: "TIMING_DUE_AS_IMMEDIATE", value: costEq({ due: true }), label: "payments at the start of months", method: "Discounted the payments as if made at the start of each month.", feedback: "Payments are at the end of each month." },
        ],
        steps: [
          step("D.loan-payment", "Monthly payment at the contract rate.", ["P", PA.v, "monthly payment"], ["L", "i^(12)"]),
          step("A.equation-of-value", "Net amount received.", ["L_{net}", received({}), "amount received"], ["L", "points", "fee"], { derived: true }),
          step("C.irr", "Monthly rate equating payments and net amount.", ["j", Math.pow(1 + annualOf(ans), 1 / 12) - 1, "monthly effective rate"], ["P", "L_net"], { rearranged: true }),
          step("A.nominal-equivalence", "Annual effective rate.", ["i_{eff}", annualOf(ans), "annual effective cost"], ["j"]),
        ],
        methods: ["equation_construction", "numerical_root", "rearrangement"],
        reasoning: "Find the monthly payment at the contract rate, then solve for the rate that equates it with the net amount actually received, and annualise.",
        intuition: `The borrower repays as if ${amt(L)} were borrowed but receives less: the effective rate rises.`,
        unknowns: [{ symbol: "$i$", meaning: "annual effective cost" }],
        relationships: ["$L(1-p) - F = P\\,a_{\\overline{12n|}j}$"],
        conditions: ["Points and fee are deducted at time 0."],
        valuationDate: "Time 0",
        modelChoice: "Borrower's internal rate of return.",
        assumptions: ["The loan runs to maturity."],
        principle: "The cost of borrowing is the IRR of what the borrower actually receives and pays.",
        unusual: "Two different charges reduce the advance.",
        misread: "Reporting the contract rate.",
        presentation: ["unknown-rate", "frequency", "irrelevant-info", "rearrange-first"],
        params: { kase, L, n, i12, p, Fee },
        route: "payment, net advance, IRR, annualise",
      });
    }
    const j12 = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.00125), (x) => x - i12 >= 0.0025 && x - i12 <= 0.0125);
    const PVa = (o: { rateEff?: boolean; due?: boolean } = {}) => {
      const monthly = o.rateEff ? sub(pow(1 + j12, 1 / 12), 1) : K(j12 / 12);
      return mul(PA, an(monthly, months), o.due ? add(1, monthly) : 1);
    };
    const points = (o: { addFee?: boolean; rateEff?: boolean; due?: boolean } = {}) => div(sub(sub(L, o.addFee ? -Fee : Fee), PVa(o)), L);
    const ans = points();
    if (ans.v <= 0.002) throw new Error("No points needed.");
    return elite({
      stem: `${name} can borrow ${amt(L)} for ${n} years with level monthly payments from either of two lenders. Lender A charges a nominal annual rate of ${pct(i12)} convertible monthly, a fixed fee of ${amt(Fee)}, and points equal to a percentage $p$ of the loan, both deducted from the amount advanced. Lender B charges a nominal annual rate of ${pct(j12)} convertible monthly with no fees or points.\n\nCalculate the value of $p$ that makes the two loans equally costly to ${name}.`,
      fmt: PCT3,
      answer: ans,
      model: { eq: (x: X) => sub(flows(months, (k) => mul(PA, pow(1 + j12 / 12, -(k + 1)))), sub(mul(L, sub(1, x)), Fee)), lo: -0.2, hi: 0.5 },
      modelDescription: "Lender A's payments discounted month by month at lender B's rate equal lender A's net advance.",
      traps: [
        { id: "ALG_SIGN_ERROR", value: points({ addFee: true }), label: "fee added instead of deducted", method: "Added the fee to the net advance.", feedback: "The fee reduces what is received." },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: points({ rateEff: true }), label: "B's nominal rate used as effective", method: `Used ${pct(j12)} as an annual effective rate.`, feedback: `Lender B's monthly rate is ${pct(j12)}/12.` },
        { id: "TIMING_DUE_AS_IMMEDIATE", value: points({ due: true }), label: "payments at the start of months", method: "Discounted the payments as an annuity-due.", feedback: "Payments are at the ends of months." },
        { id: "ALLOC_EVEN_SPLIT", value: K((j12 - i12) * n - Fee / L), label: "rate gap times term", method: `Multiplied the rate difference by ${n} years.`, feedback: "Points are paid once at time 0: compare present values." },
        { id: "TRANS_IGNORED_CONDITION", value: div(sub(L, PVa()), L), label: "fee ignored", method: "Left out the fee.", feedback: `The ${amt(Fee)} fee is deducted too.` },
      ],
      steps: [
        step("D.loan-payment", "Lender A's monthly payment.", ["P_A", PA.v, "lender A payment"], ["L", "i^(12)"]),
        step("A.nominal-equivalence", "Lender B's monthly rate.", ["j/12", j12 / 12, "lender B monthly rate"], ["j^(12)"]),
        step("B.annuity-immediate", "Value of A's payments at B's rate.", ["V", PVa().v, "value of A's payments at B's rate"], ["P_A", "j"]),
        step("A.equation-of-value", "Net advance of A must equal that value.", ["L(1-p)-F", PVa().v, "A's net advance"], ["V"], { derived: true }),
        step("M.linear-system", "Solve for the points.", ["p", ans.v, "points"], ["V", "F"], { rearranged: true }),
      ],
      methods: ["equation_construction", "work_backwards", "rearrangement"],
      reasoning: "Equal cost means lender A's payments, valued at lender B's rate (B's cost), equal A's net advance; solve for the points.",
      intuition: "Points buy down the rate: they are worth the present value of the payment saving at the other lender's rate.",
      unknowns: [{ symbol: "$p$", meaning: "points" }],
      relationships: ["$L(1-p) - F = P_A\\,a_{\\overline{12n|}j/12}$"],
      conditions: ["Both loans run to maturity."],
      valuationDate: "Time 0",
      modelChoice: "Equivalence of effective costs.",
      assumptions: ["No prepayment."],
      principle: "Two loans are equally costly when their IRRs agree.",
      unusual: "The unknown is the points, not a rate.",
      misread: "Multiplying the rate difference by the term.",
      presentation: ["compare-streams", "work-backwards", "frequency", "irrelevant-info"],
      params: { kase, L, n, i12, j12, Fee },
      route: "payment, B's rate, value, equate, solve",
    });
  },
};

// ===================================================================== 4. Lender's yield with reinvestment at a changing rate

const lenderReinvest: QuestionTemplate = {
  id: "el-loan-lender-reinvest",
  family: "el-loan-lender-reinvest",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.amortization",
  secondary: ["ALM.rates_of_return", "BONDS.reinvestment", "LOANS.final_payments"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "financial_intuition"],
  soaConcept: "A lender reinvests each payment at a rate that changes during the term; the lender's yield is the rate taking the loan amount to the accumulated value.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 20000, 100000, 5000);
    const n = rng.int(8, 15);
    const T = rng.int(3, n - 3);
    const i = gridRate(rng, 0.05, 0.09, 0.0025);
    const j1 = drawUntil(() => gridRate(rng, 0.02, 0.06, 0.0025), (x) => i - x >= 0.01);
    const j2 = drawUntil(() => gridRate(rng, 0.02, 0.07, 0.0025), (x) => Math.abs(x - j1) >= 0.01);
    const name = nameOf(rng);
    const kase = pick(rng, ["amortized-skip", "interest-only"]);
    /** Accumulation from time t to n through the two reinvestment regimes. */
    const acc = (t: number, r1: number = j1, r2: number = j2): X => (t >= T ? at(r2, n - t) : mul(at(r1, T - t), at(r2, n - T)));
    const yieldOf = (AV: X, years = n) => sub(pow(div(AV, L), 1 / years), 1);
    if (kase === "amortized-skip") {
      const P = L / an(i, n).v;
      const k = rng.int(2, n - 2);
      const received = (o: { noCatchupInterest?: boolean } = {}) =>
        Array.from({ length: n }, (_, t) => t + 1).map((t) => ({ t, amount: t === k ? 0 : t === k + 1 ? P * (o.noCatchupInterest ? 2 : 2 + i) : P }));
      const AV = (o: { r1?: number; r2?: number; noCatchupInterest?: boolean; noSkip?: boolean } = {}) => {
        const r1 = o.r1 ?? j1;
        const r2 = o.r2 ?? j2;
        const base = add(mul(P, sn(r1, T), at(r2, n - T)), mul(P, sn(r2, n - T)));
        if (o.noSkip) return base;
        return add(base, mul(-P, acc(k, r1, r2)), mul(P * (o.noCatchupInterest ? 1 : 1 + i), acc(k + 1, r1, r2)));
      };
      const ans = yieldOf(AV());
      const explicit = sum(received().map((f) => mul(f.amount, acc(f.t))));
      return elite({
        stem: `${name} lends ${amt(L)}, to be repaid by level payments at the end of each year for ${n} years at an annual effective rate of ${pct(i)}. The borrower skips the payment due at time ${k} and at time ${k + 1} pays the regular payment plus the skipped payment with one year's interest at the loan rate. ${name} reinvests every amount received at an annual effective rate of ${pct(j1)} until time ${T} and ${pct(j2)} thereafter.\n\nCalculate ${name}'s annual effective yield over the ${n} years.`,
        fmt: PCT3,
        answer: ans,
        model: sub(pow(div(explicit, L), 1 / n), 1),
        modelDescription: "Each amount received accumulated to time n through the two reinvestment regimes, then the n-th root of the growth of the loan amount.",
        traps: [
          { id: "MODEL_REINVEST_AT_YIELD", value: K(i), label: "loan rate", method: "Took the lender's yield as the loan rate.", feedback: `Payments are reinvested at ${pct(j1)} and ${pct(j2)}, below the loan rate.` },
          { id: "MODEL_SINGLE_RATE", value: yieldOf(AV({ r2: j1 })), label: "first reinvestment rate throughout", method: `Reinvested at ${pct(j1)} throughout.`, feedback: `The reinvestment rate is ${pct(j2)} after time ${T}.` },
          { id: "TRANS_IGNORED_CONDITION", value: yieldOf(AV({ noCatchupInterest: true })), label: "catch-up without interest", method: "Took the catch-up as two plain payments.", feedback: "The skipped payment is repaid with one year's interest." },
          { id: "CONC_RETURN_ON_WRONG_BASE", value: div(sub(div(AV().v, L), 1), n), label: "simple average return", method: `Divided the total return by ${n}.`, feedback: "Annual effective yield compounds: take the n-th root." },
          { id: "TIMING_EXTRA_PERIOD", value: yieldOf(AV(), n + 1), label: "one year too many", method: `Took the ${n + 1}-th root.`, feedback: `The investment lasts ${n} years.` },
          { id: "CONC_TVM_RATE_CHANGE_RETRO", value: yieldOf(AV({ r1: j2 })), label: "second rate throughout", method: `Reinvested at ${pct(j2)} throughout.`, feedback: `The first ${T} years earn ${pct(j1)}.` },
        ],
        steps: [
          step("D.loan-payment", "Level payment.", ["P", P, "annual payment"], ["L", "i"]),
          step("C.reinvestment", "Reinvested regular payments through both regimes.", ["S", AV({ noSkip: true }).v, "accumulated regular payments"], ["P", "j_1", "j_2"]),
          step("A.equation-of-value", "Adjust for the skipped payment and the catch-up with interest.", ["AV", AV().v, "accumulated value at time n"], ["S", "k"], { derived: true }),
          step("C.yield-rate", "Lender's yield.", ["y", ans.v, "annual effective yield"], ["AV", "L"], { rearranged: true }),
        ],
        methods: ["valuation_dates", "decomposition", "rearrangement"],
        reasoning: "Accumulate the regular payments through the two reinvestment regimes, correct for the skipped payment and the catch-up, and solve L(1+y)^n = AV.",
        intuition: "The lender's yield depends on what the payments earn after they are received, not only on the loan rate.",
        unknowns: [{ symbol: "$y$", meaning: "lender's annual yield" }],
        relationships: ["$L(1+y)^n = AV$"],
        conditions: [`Reinvestment rate changes at time ${T}.`],
        valuationDate: `Time ${n}`,
        modelChoice: "Accumulation through two regimes.",
        assumptions: ["Reinvestment rates hold."],
        principle: "A lender's realised yield is driven by the reinvestment rate.",
        unusual: "A skipped payment and a reinvestment rate that changes.",
        misread: "Taking the loan rate as the yield.",
        presentation: ["valuation-date", "mixed-timing", "irrelevant-info", "combined-topics"],
        features: { multipleValuationDates: true },
        params: { kase, L, n, T, i, j1, j2, k },
        route: "payment, reinvest, adjust, yield",
      });
    }
    // interest-only loan with a balloon of principal at the end
    const AV = (o: { r1?: number; r2?: number; noInterestReinvest?: boolean } = {}) => {
      const r1 = o.r1 ?? j1;
      const r2 = o.r2 ?? j2;
      const coupons = o.noInterestReinvest ? K(i * L * n) : add(mul(i * L, sn(r1, T), at(r2, n - T)), mul(i * L, sn(r2, n - T)));
      return add(coupons, L);
    };
    const ans = yieldOf(AV());
    const explicit = add(flows(n, (t) => mul(i * L, acc(t + 1))), L);
    return elite({
      stem: `${name} lends ${amt(L)} for ${n} years at an annual effective rate of ${pct(i)}. The borrower pays only the interest at the end of each year and repays the full amount at time ${n}. ${name} reinvests each interest payment at an annual effective rate of ${pct(j1)} until time ${T} and ${pct(j2)} thereafter.\n\nCalculate ${name}'s annual effective yield over the ${n} years.`,
      fmt: PCT3,
      answer: ans,
      model: sub(pow(div(explicit, L), 1 / n), 1),
      modelDescription: "Each interest payment accumulated to time n through the two regimes, plus the principal, then the n-th root.",
      traps: [
        { id: "MODEL_REINVEST_AT_YIELD", value: K(i), label: "loan rate", method: "Took the yield as the loan rate.", feedback: "Interest is reinvested at lower rates." },
        { id: "MODEL_SINGLE_RATE", value: yieldOf(AV({ r2: j1 })), label: "first reinvestment rate throughout", method: `Reinvested at ${pct(j1)} throughout.`, feedback: `The rate is ${pct(j2)} after time ${T}.` },
        { id: "CONC_BOND_COUPONS_NOT_REINVESTED", value: yieldOf(AV({ noInterestReinvest: true })), label: "interest not reinvested", method: "Added the interest payments without reinvestment.", feedback: "Each interest payment is reinvested." },
        { id: "CONC_RETURN_ON_WRONG_BASE", value: div(sub(div(AV().v, L), 1), n), label: "simple average return", method: `Divided the total return by ${n}.`, feedback: "Take the n-th root." },
        { id: "CONC_TVM_RATE_CHANGE_RETRO", value: yieldOf(AV({ r1: j2 })), label: "second rate throughout", method: `Reinvested at ${pct(j2)} throughout.`, feedback: `The first ${T} years earn ${pct(j1)}.` },
      ],
      steps: [
        step("D.interest-component", "Annual interest payment.", ["I", i * L, "interest payment"], ["L", "i"]),
        step("C.reinvestment", `Interest reinvested up to time ${T}, then carried at the second rate.`, ["S_1", mul(i * L, sn(j1, T), at(j2, n - T)).v, "early interest at time n"], ["I", "j_1", "j_2"]),
        step("B.annuity-immediate-av", "Later interest at the second rate.", ["S_2", mul(i * L, sn(j2, n - T)).v, "later interest at time n"], ["I", "j_2"]),
        step("A.equation-of-value", "Add the principal repaid at time n.", ["AV", AV().v, "accumulated value"], ["S_1", "S_2", "L"]),
        step("C.yield-rate", "Lender's yield.", ["y", ans.v, "annual effective yield"], ["AV", "L"], { rearranged: true }),
      ],
      methods: ["valuation_dates", "decomposition", "rearrangement"],
      reasoning: "Accumulate the interest payments through the two reinvestment regimes, add the principal, and solve L(1+y)^n = AV.",
      intuition: "Only the interest is reinvested; the principal comes back at the end.",
      unknowns: [{ symbol: "$y$", meaning: "lender's annual yield" }],
      relationships: ["$AV = iL\\,s_{\\overline{T|}j_1}(1+j_2)^{n-T} + iL\\,s_{\\overline{n-T|}j_2} + L$"],
      conditions: ["Interest only, principal at the end."],
      valuationDate: `Time ${n}`,
      modelChoice: "Accumulation through two regimes.",
      assumptions: ["Reinvestment rates hold."],
      principle: "Reinvestment below the loan rate pulls the realised yield below the loan rate.",
      unusual: "The reinvestment rate changes mid-term.",
      misread: "Not reinvesting the interest.",
      presentation: ["valuation-date", "mixed-timing", "combined-topics", "hidden-structure"],
      features: { multipleValuationDates: true },
      params: { kase, L, n, T, i, j1, j2 },
      route: "interest, reinvest, reinvest, add, yield",
    });
  },
};

// ===================================================================== 5. Rate reset with a curtailment: principal in a later payment, or the curtailment needed

const rateReset: QuestionTemplate = {
  id: "el-loan-rate-reset",
  family: "el-loan-rate-reset",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.refinancing", "LOANS.outstanding_balance", "LOANS.unknown_variables"],
  reasoning: ["valuation_dates", "multistep", "cashflow_modelling", "algebra"],
  soaConcept: "A variable-rate loan resets its rate and payment; a curtailment later changes the balance (or the term).",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 50000, 300000, 5000);
    const n = rng.int(15, 30);
    const t = rng.int(3, 8);
    const s = rng.int(2, 6);
    const i1 = gridRate(rng, 0.03, 0.07, 0.0025);
    const i2 = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.0025), (x) => Math.abs(x - i1) >= 0.0125);
    const name = nameOf(rng);
    const kase = pick(rng, ["principal", "curtailment"]);
    const P1 = L / an(i1, n).v;
    const Bt = (rate = i1) => mul(div(L, an(i1, n)), an(rate, n - t));
    const P2 = (B: X = Bt()) => div(B, an(i2, n - t));
    const story = `${name} borrows ${amt(L)}, to be repaid by level payments at the end of each year for ${n} years at an annual effective rate of ${pct(i1)}. Immediately after the ${ord(t)} payment the rate resets to ${pct(i2)} and the payment is recalculated so that the loan is still repaid at the original maturity.`;
    if (kase === "principal") {
      const E = Math.round((Bt().v * (0.05 + rng.next() * 0.1)) / 500) * 500;
      const after = (o: { btRate?: number; noE?: boolean; addE?: boolean; extra?: number } = {}) => {
        const b = Bt(o.btRate);
        const p2 = P2(b);
        const B = sub(mul(p2, an(i2, n - t - s - (o.extra ?? 0))), o.noE ? 0 : o.addE ? -E : E);
        return { p2, B };
      };
      const principal = (o: Parameters<typeof after>[0] & { rate?: number; interest?: boolean } = {}) => {
        const { p2, B } = after(o);
        return o.interest ? mul(o.rate ?? i2, B) : sub(p2, mul(o.rate ?? i2, B));
      };
      const ans = principal();
      const retroBt = retro(L, P1, i1, t);
      const p2Model = div(retroBt, an(i2, n - t));
      const BtsModel = sub(sub(mul(retroBt, at(i2, s)), flows(s, (k) => mul(p2Model, at(i2, s - k - 1)))), E);
      return elite({
        stem: `${story} Together with the ${ord(t + s)} payment ${name} also pays an extra ${amt(E)}, and the payment amount is not changed afterwards (the loan finishes early).\n\nCalculate the principal repaid in the ${ord(t + s + 1)} payment.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(p2Model, mul(i2, BtsModel)),
        modelDescription: "Balances found retrospectively payment by payment; principal = payment − interest on the balance after the extra payment.",
        traps: [
          { id: "VAR_INTEREST_FOR_PRINCIPAL", value: principal({ interest: true }), label: "interest portion", method: "Gave the interest in the payment.", feedback: "Principal = payment − interest." },
          { id: "CONC_LOAN_REFI_OLD_RATE", value: principal({ rate: i1 }), label: "interest at the old rate", method: `Charged interest at ${pct(i1)}.`, feedback: `After the reset the rate is ${pct(i2)}.` },
          { id: "TRANS_IGNORED_CONDITION", value: principal({ noE: true }), label: "extra payment ignored", method: "Left out the extra payment.", feedback: `The extra ${amt(E)} reduces the balance.` },
          { id: "ALG_SIGN_ERROR", value: principal({ addE: true }), label: "extra payment added to the balance", method: "Added the extra payment to the balance.", feedback: "An extra payment reduces the balance." },
          { id: "MODEL_BALANCE_AT_NEW_RATE", value: principal({ btRate: i2 }), label: "reset balance at the new rate", method: `Valued the balance at the reset with ${pct(i2)}.`, feedback: `The balance at the reset is the value of the old payments at the old rate ${pct(i1)}.` },
          { id: "TIMING_BALANCE_INDEX", value: principal({ extra: 1 }), label: "balance one payment later", method: `Used the balance after payment ${t + s + 1}.`, feedback: `Interest in payment ${t + s + 1} is on the balance after payment ${t + s}.` },
        ],
        steps: [
          step("D.loan-payment", "Original payment.", ["P_1", P1, "original payment"], ["L", "i_1"]),
          step("D.prospective", "Balance at the reset (old payments, old rate).", ["B_t", Bt().v, `balance at time ${t}`], ["P_1", "i_1"]),
          step("D.loan-payment", "Recalculated payment at the new rate.", ["P_2", P2().v, "new payment"], ["B_t", "i_2"], { rearranged: true }),
          step("D.prospective", `Balance after payment ${t + s}, less the extra payment.`, ["B", after().B.v, `balance at time ${t + s}`], ["P_2", "i_2", "E"]),
          step("D.interest-component", "Interest in the next payment.", ["I", mul(i2, after().B).v, "interest portion"], ["B", "i_2"]),
          step("D.principal-component", "Payment minus interest.", ["PR", ans.v, "principal portion"], ["P_2", "I"]),
        ],
        methods: ["valuation_dates", "decomposition", "substitution"],
        reasoning: "Balance at the reset at the old rate, new payment at the new rate, prospective balance before the extra payment, subtract it, then split the next payment.",
        intuition: "Follow the balance: each event changes it at one date.",
        unknowns: [{ symbol: "$PR$", meaning: `principal in payment ${t + s + 1}` }],
        relationships: ["$PR = P_2 - i_2(B_{t+s} - E)$"],
        conditions: ["Payment unchanged after the extra payment."],
        valuationDate: `Time ${t + s}`,
        modelChoice: "Balance-tracking with a reset and a curtailment.",
        assumptions: ["No fees."],
        principle: "Principal in a payment depends only on the payment and the previous balance.",
        unusual: "A reset and a curtailment before the payment asked about.",
        misread: "Charging interest at the old rate after the reset.",
        presentation: ["mixed-timing", "valuation-date", "irrelevant-info", "hidden-structure"],
        features: { multipleValuationDates: true },
        params: { kase, L, n, t, s, i1, i2, E },
        route: "payment, reset balance, new payment, balance, interest, principal",
      });
    }
    const early = rng.int(2, 5);
    const remaining = n - t - s;
    const E = (o: { btRate?: number; rate?: number; early?: number; remainAfter?: number } = {}) => {
      const p2 = P2(Bt(o.btRate));
      const r = o.rate ?? i2;
      return sub(mul(p2, an(r, remaining)), mul(p2, an(r, o.remainAfter ?? remaining - (o.early ?? early))));
    };
    const ans = E();
    return elite({
      stem: `${story} Together with the ${ord(t + s)} payment, ${name} makes an extra payment so that, with the payment amount unchanged, the loan is repaid exactly ${early} years before the original maturity.\n\nCalculate the extra payment.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (x: X) => sub(sub(mul(retro(L, P1, i1, t), at(i2, s)), flows(s, (k) => mul(div(retro(L, P1, i1, t), an(i2, n - t)), at(i2, s - k - 1)))), add(x, flows(remaining - early, (k) => mul(div(retro(L, P1, i1, t), an(i2, n - t)), vt(i2, k + 1))))), lo: 1, hi: L },
      modelDescription: "Retrospective balance at the extra payment equals the extra payment plus the shortened run of payments, each discounted.",
      traps: [
        { id: "MODEL_BALANCE_AT_NEW_RATE", value: E({ btRate: i2 }), label: "reset balance at the new rate", method: `Valued the balance at the reset with ${pct(i2)}.`, feedback: "The balance at the reset uses the old payments at the old rate." },
        { id: "CONC_LOAN_REFI_OLD_RATE", value: E({ rate: i1 }), label: "old rate after the reset", method: `Discounted at ${pct(i1)} after the reset.`, feedback: `The rate is ${pct(i2)} after the reset.` },
        { id: "SEQ_TERM_COUNT", value: E({ remainAfter: remaining - early + 1 }), label: "one payment too many left", method: `Left ${remaining - early + 1} payments.`, feedback: `Payments ${t + s + 1} to ${n - early}: ${remaining - early} payments.` },
        { id: "SEQ_UNDISCOUNTED_SUM", value: mul(P2(), early), label: "skipped payments undiscounted", method: `Paid ${early} payments' worth.`, feedback: "The payments saved are at the end; their present value is smaller." },
        { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: mul(P2(), an(i2, early), vt(i2, remaining - early + 1)), label: "saved payments discounted a year too long", method: "Discounted the saved payments one year too many.", feedback: "The saved payments are the last ones of the original schedule." },
      ],
      steps: [
        step("D.loan-payment", "Original payment.", ["P_1", P1, "original payment"], ["L", "i_1"]),
        step("D.prospective", "Balance at the reset.", ["B_t", Bt().v, `balance at time ${t}`], ["P_1", "i_1"]),
        step("D.loan-payment", "Recalculated payment.", ["P_2", P2().v, "new payment"], ["B_t", "i_2"], { rearranged: true }),
        step("D.prospective", `Balance after payment ${t + s} on the reset schedule.`, ["B", mul(P2(), an(i2, remaining)).v, `balance at time ${t + s}`], ["P_2"]),
        step("B.deferred", "Extra payment = value of the payments no longer needed.", ["E", ans.v, "extra payment"], ["B", "P_2"], { rearranged: true }),
      ],
      methods: ["valuation_dates", "work_backwards", "decomposition"],
      reasoning: "The extra payment equals the balance minus the value of the shortened run of payments — that is, the value of the last payments that are no longer needed.",
      intuition: "Paying off early is buying back the final payments at their present value.",
      unknowns: [{ symbol: "$E$", meaning: "extra payment" }],
      relationships: ["$E = P_2(a_{\\overline{r|}} - a_{\\overline{r-e|}})$ at the new rate"],
      conditions: ["Payment amount unchanged."],
      valuationDate: `Time ${t + s}`,
      modelChoice: "Prospective balances before and after.",
      assumptions: ["No fees."],
      principle: "A curtailment is worth the present value of the payments it removes.",
      unusual: "The unknown is the curtailment that shortens the term by a set amount.",
      misread: "Paying the saved payments undiscounted.",
      presentation: ["work-backwards", "mixed-timing", "valuation-date", "inverse"],
      features: { multipleValuationDates: true },
      params: { kase, L, n, t, s, i1, i2, early },
      route: "payment, reset balance, new payment, balance, value of removed payments",
    });
  },
};

// ===================================================================== 6. Skipped payments then a drop payment; or the total interest that results

const skipPayoff: QuestionTemplate = {
  id: "el-loan-skip-payoff",
  family: "el-loan-skip-payoff",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.outstanding_balance", "LOANS.principal_interest", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "algebra"],
  soaConcept: "Skipped payments extend a loan with level payments; the extension ends with a drop payment, and the total interest grows.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 10000, 60000, 1000);
    const nY = rng.int(4, 8);
    const i12 = gridRate(rng, 0.04, 0.1, 0.0025);
    const r = i12 / 12;
    const n = 12 * nY;
    const a = rng.int(6, n - 20);
    const b = a + rng.int(2, 8);
    const name = nameOf(rng);
    const kase = pick(rng, ["drop", "total-interest"]);
    const P = L / an(r, n).v;
    /** Balance at time b (after the second skip) and the payments that follow. */
    const schedule = (o: { skips?: number[]; rate?: number } = {}) => {
      const rate = o.rate ?? r;
      const skips = o.skips ?? [a, b];
      let B = L;
      let paid = 0;
      let t = 0;
      while (B > 1e-9 && t < 2000) {
        t += 1;
        B *= 1 + rate;
        if (skips.includes(t)) continue;
        if (B <= P + 1e-9) {
          paid += B;
          return { last: B, months: t, totalPaid: paid };
        }
        B -= P;
        paid += P;
      }
      throw new Error("Schedule did not end.");
    };
    const s = schedule();
    if (s.last < 0.1 * P) throw new Error("Drop too small.");
    const Pv = P;
    // closed form for the drop: balance at the drop month from the retrospective formula
    const dropX = (o: { skips?: number[]; rate?: number; extra?: number } = {}) => {
      const rate = o.rate ?? r;
      const sc = schedule(o);
      const skips = o.skips ?? [a, b];
      const paidMonths = Array.from({ length: sc.months - 1 }, (_, k) => k + 1).filter((m) => !skips.includes(m));
      return mul(sub(mul(L, at(rate, sc.months)), sum(paidMonths.map((m) => mul(Pv, at(rate, sc.months - m))))), at(rate, o.extra ?? 0));
    };
    const paidMonths = Array.from({ length: s.months - 1 }, (_, k) => k + 1).filter((m) => m !== a && m !== b);
    const story = `${name} borrows ${amt(L)} at a nominal annual rate of ${pct(i12)} convertible monthly, repaid by level payments at the end of each month for ${nY} years. ${name} skips the ${ord(a)} and ${ord(b)} payments (interest accrues on the unpaid balance) and otherwise pays the original amount each month until a smaller final payment one month after the last full payment repays the loan.`;
    const steps = [
      step("D.loan-payment", "Monthly payment.", ["P", P, "monthly payment"], ["L", "i^(12)"]),
      step("D.retrospective", "Each skip leaves the balance to accrue: the schedule runs past the original term.", ["n'", s.months, "month of the final payment"], ["P", "skips"], { derived: true }),
      step("B.counting", "Full payments made.", ["N", paidMonths.length, "full payments"], ["n'"]),
    ];
    if (kase === "drop") {
      const ans = dropX();
      return elite({
        stem: `${story}\n\nCalculate the final payment.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(add(sum(paidMonths.map((m) => mul(Pv, vt(r, m)))), mul(x, vt(r, s.months))), L), lo: 0.01, hi: 2 * P },
        modelDescription: "Loan = the full payments actually made plus the final payment, each discounted monthly.",
        traps: [
          { id: "TRANS_IGNORED_CONDITION", value: dropX({ skips: [a] }), label: "only one skip counted", method: "Counted only the first skipped payment.", feedback: "Both skipped payments extend the loan." },
          { id: "CHAL_BALLOON_FOR_DROP", value: add(Pv, mul(dropX(), vt(r, 1))), label: "balloon instead of drop", method: "Added the remainder to the last full payment.", feedback: "The final payment is one month after the last full payment." },
          { id: "TIMING_EXTRA_PERIOD", value: dropX({ extra: 1 }), label: "final payment a month late", method: "Accumulated the remainder one month too many.", feedback: "It is paid one month after the last full payment." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: K(schedule({ rate: Math.pow(1 + i12, 1 / 12) - 1 }).last), label: "nominal rate used as effective", method: `Used ${pct(i12)} as an annual effective rate.`, feedback: `The monthly rate is ${pct(i12)}/12.` },
          { id: "TIMING_PAYMENT_BEFORE_INTEREST", value: div(dropX(), 1 + r), label: "last month's interest left out", method: "Paid off the balance without the final month's interest.", feedback: "The remaining balance earns one more month of interest before the final payment." },
        ],
        steps: [...steps, step("D.drop-balloon", "Remaining balance accumulated to the final payment.", ["X", ans.v, "final payment"], ["N"])],
        methods: ["valuation_dates", "decomposition", "work_backwards"],
        reasoning: "Find the month in which the balance falls below a full payment once the two skipped months have accrued interest; the final payment is the balance then.",
        intuition: "Each skip adds a month and a little more interest: the loan ends with a partial payment.",
        unknowns: [{ symbol: "$X$", meaning: "final payment" }],
        relationships: ["$L = P\\sum_{\\text{paid}} v^m + Xv^{n'}$"],
        conditions: ["Skipped payments accrue interest."],
        valuationDate: `Month ${s.months}`,
        modelChoice: "Retrospective balance and drop payment.",
        assumptions: ["No fees on skipped payments."],
        principle: "Skipped payments become a longer loan with a drop payment.",
        unusual: "Two skips in a monthly loan.",
        misread: "Counting only one skip.",
        presentation: ["unknown-time", "mixed-timing", "frequency", "work-backwards"],
        features: { multipleValuationDates: true },
        params: { kase, L, nY, i12, a, b },
        route: "payment, extended schedule, count, drop",
      });
    }
    const totalI = (o: { skips?: number[]; rate?: number } = {}) => {
      const sc = schedule(o);
      const skips = o.skips ?? [a, b];
      const full = Array.from({ length: sc.months - 1 }, (_, k) => k + 1).filter((m) => !skips.includes(m)).length;
      return sub(add(mul(Pv, full), dropX(o)), L);
    };
    const ans = totalI();
    return elite({
      stem: `${story}\n\nCalculate the total interest ${name} pays over the life of the loan.`,
      fmt: MONEY2,
      answer: ans,
      model: sub(add(mul(Pv, paidMonths.length), K(s.last)), L),
      modelDescription: "Total of the payments actually made (from the month-by-month schedule) minus the amount borrowed.",
      traps: [
        { id: "TRANS_IGNORED_CONDITION", value: totalI({ skips: [a] }), label: "only one skip counted", method: "Counted only the first skip.", feedback: "Both skips add interest." },
        { id: "CONC_LOAN_TOTAL_INTEREST_FIXED", value: sub(mul(Pv, n), L), label: "original schedule's interest", method: "Used the interest of the original schedule.", feedback: "Skipped payments increase the total interest." },
        { id: "VAR_TOTAL_FOR_COMPONENT", value: add(mul(Pv, paidMonths.length), K(s.last)), label: "total payments", method: "Gave the total of all payments.", feedback: "Subtract the amount borrowed." },
        { id: "CONC_LOAN_IRREGULAR_FINAL_IGNORED", value: sub(mul(Pv, paidMonths.length + 1), L), label: "final payment taken as full", method: "Took the final payment as a full payment.", feedback: "The final payment is smaller." },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: totalI({ rate: Math.pow(1 + i12, 1 / 12) - 1 }), label: "nominal rate used as effective", method: `Used ${pct(i12)} as annual effective.`, feedback: `The monthly rate is ${pct(i12)}/12.` },
      ],
      steps: [...steps, step("D.drop-balloon", "Final payment.", ["X", s.last, "final payment"], ["N"]), step("D.total-interest", "Total payments minus the amount borrowed.", ["I", ans.v, "total interest"], ["P", "N", "X"])],
      methods: ["valuation_dates", "decomposition", "work_backwards"],
      reasoning: "Find the extended schedule (full payments and the final payment), then total interest = total paid − amount borrowed.",
      intuition: "Total interest is undiscounted: count what was actually paid.",
      unknowns: [{ symbol: "$I$", meaning: "total interest" }],
      relationships: ["$I = NP + X - L$"],
      conditions: ["Skipped payments accrue interest."],
      valuationDate: "Undiscounted total",
      modelChoice: "Schedule, drop payment and total-interest identity.",
      assumptions: ["No fees."],
      principle: "Total interest = total payments − principal.",
      unusual: "Skips change the number of payments and the final amount.",
      misread: "Using the original schedule's interest.",
      presentation: ["unknown-time", "mixed-timing", "frequency", "hidden-structure"],
      params: { kase, L, nY, i12, a, b },
      route: "payment, extended schedule, count, drop, total",
    });
  },
};

// ===================================================================== 7. Level principal, then refinanced: total interest, or the refinancing rate

const levelPrincipalRefi: QuestionTemplate = {
  id: "el-loan-level-principal-refi",
  family: "el-loan-level-principal-refi",
  topic: "LOANS",
  levels: [4],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.refinancing", "LOANS.outstanding_balance", "LOANS.unknown_variables"],
  reasoning: ["cashflow_modelling", "algebra", "multistep", "translation"],
  soaConcept: "Equal principal repayments make interest an arithmetic sequence; refinancing the balance into level payments changes the interest pattern.",
  generate(rng): QuestionDraft {
    const L = gridAmount(rng, 30000, 200000, 5000);
    const n = rng.int(12, 25);
    const t = rng.int(3, n - 6);
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const name = nameOf(rng);
    const kase = pick(rng, ["total-interest", "refi-rate"]);
    const m = n - t;
    const Bt = (idx = t) => L * (1 - idx / n);
    const phase1 = (o: { onOriginal?: boolean } = {}) => (o.onOriginal ? K(i * L * t) : mul(i * L, t - (t * (t - 1)) / (2 * n)));
    const story = (rateText: string) =>
      `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)}. At the end of each year ${name} repays ${amt(L / n)} of principal plus the interest due. Immediately after the ${ord(t)} payment, the balance is refinanced ${rateText} and repaid by level payments at the end of each year, ending at the original maturity.`;
    if (kase === "total-interest") {
      const j = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => Math.abs(x - i) >= 0.01);
      const total = (o: { onOriginal?: boolean; rate2?: number; idx?: number; level?: boolean; totalPay?: boolean } = {}) => {
        if (o.level) {
          const P = L / an(i, n).v;
          return K(P * n - L);
        }
        const idx = o.idx ?? t;
        const b = Bt(idx);
        const p2 = div(b, an(o.rate2 ?? j, n - idx));
        const p1 = o.idx === undefined ? phase1(o) : mul(i * L, idx - (idx * (idx - 1)) / (2 * n));
        const interest = add(p1, sub(mul(n - idx, p2), b));
        return o.totalPay ? add(interest, L) : interest;
      };
      const ans = total();
      const explicit1 = flows(t, (k) => mul(i, L * (1 - k / n)));
      return elite({
        stem: `${story(`at an annual effective rate of ${pct(j)}`)}\n\nCalculate the total interest paid over the life of the loan.`,
        fmt: MONEY2,
        answer: ans,
        model: add(explicit1, sub(mul(m, div(L - t * (L / n), an(j, m))), L - t * (L / n))),
        modelDescription: "Interest of each early year listed; second-phase interest = level payments minus the balance refinanced.",
        traps: [
          { id: "MODEL_INTEREST_ON_ORIGINAL", value: total({ onOriginal: true }), label: "interest on the original amount", method: "Charged interest on the original amount in the first phase.", feedback: "Interest is on the outstanding balance, which falls each year." },
          { id: "CONC_LOAN_REFI_OLD_RATE", value: total({ rate2: i }), label: "second phase at the old rate", method: `Used ${pct(i)} after refinancing.`, feedback: `The refinanced rate is ${pct(j)}.` },
          { id: "TIMING_BALANCE_INDEX", value: total({ idx: t - 1 }), label: "refinanced one year early", method: `Refinanced after ${t - 1} payments.`, feedback: `${t} payments are made first.` },
          { id: "VAR_TOTAL_FOR_COMPONENT", value: total({ totalPay: true }), label: "total payments", method: "Gave total payments.", feedback: "Subtract the principal." },
          { id: "CONC_LOAN_PRINCIPAL_LEVEL", value: total({ level: true }), label: "level-payment loan throughout", method: "Treated the whole loan as a level-payment loan.", feedback: "The first phase repays equal principal, not equal payments." },
        ],
        steps: [
          step("D.principal-component", "Equal principal: the balance falls by L/n a year.", ["B_t", Bt(), `balance at time ${t}`], ["L", "n"]),
          step("M.arithmetic-series", "First-phase interest is an arithmetic series.", ["I_1", phase1().v, "first-phase interest"], ["i", "L"]),
          step("D.loan-payment", "Level payment after refinancing.", ["P_2", Bt() / an(j, m).v, "second-phase payment"], ["B_t", "j"]),
          step("D.total-interest", "Second-phase interest: payments minus balance.", ["I_2", (m * Bt()) / an(j, m).v - Bt(), "second-phase interest"], ["P_2", "B_t"]),
          step("A.equation-of-value", "Add.", ["I", ans.v, "total interest"], ["I_1", "I_2"]),
        ],
        methods: ["arithmetic_series", "decomposition", "substitution"],
        reasoning: "Equal principal repayments make the first-phase interest arithmetic; after refinancing, interest = total level payments − balance refinanced.",
        intuition: "Two schedules, two interest patterns: add them.",
        unknowns: [{ symbol: "$I$", meaning: "total interest" }],
        relationships: ["$I_1 = iL\\left(t - \\dfrac{t(t-1)}{2n}\\right)$", "$I_2 = (n-t)P_2 - B_t$"],
        conditions: ["No refinancing fee."],
        valuationDate: "Undiscounted total",
        modelChoice: "Arithmetic interest then level payments.",
        assumptions: ["Rates as stated."],
        principle: "Total interest over a phase = payments in it − principal repaid in it.",
        unusual: "A level-principal loan refinanced into level payments.",
        misread: "Charging interest on the original amount.",
        presentation: ["hidden-structure", "mixed-timing", "combined-topics", "multi-equation"],
        params: { kase, L, n, t, i, j },
        route: "balance, arithmetic interest, payment, interest, add",
      });
    }
    const jTrue = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => Math.abs(x - i) >= 0.01);
    const P2 = Math.round((Bt() / an(jTrue, m).v) * 100) / 100;
    const rateEq = (o: { idx?: number; termExtra?: number; due?: boolean; orig?: boolean } = {}): Eq => ({
      eq: (x: X) => sub(mul(P2, an(x, m + (o.termExtra ?? 0)), o.due ? add(1, x) : 1), o.orig ? L : Bt(o.idx ?? t)),
      lo: -0.05,
      hi: 0.5,
    });
    return elite({
      stem: `${story("at a new annual effective rate $j$")} The level payment after refinancing is ${amt(P2)}.\n\nCalculate $j$.`,
      fmt: PCT3,
      answer: rateEq(),
      model: { eq: (x: X) => sub(flows(m, (k) => mul(P2, vt(x, k + 1))), sub(L, flows(t, () => K(L / n)))), lo: -0.05, hi: 0.5 },
      modelDescription: "The level payments discounted one by one at j equal the balance left after the equal principal repayments.",
      traps: [
        { id: "TIMING_BALANCE_INDEX", value: rateEq({ idx: t - 1 }), label: "balance one year early", method: `Used the balance after ${t - 1} payments.`, feedback: `${t} principal repayments have been made.` },
        { id: "TIMING_REFINANCE_PERIODS", value: rateEq({ termExtra: 1 }), label: "one payment too many", method: `Used ${m + 1} level payments.`, feedback: `Payments ${t + 1} to ${n}: ${m} payments.` },
        { id: "TIMING_IMMEDIATE_AS_DUE", value: rateEq({ due: true }), label: "payments at the start of years", method: "Treated the level payments as an annuity-due.", feedback: "Payments are at the ends of years." },
        { id: "VAR_ORIGINAL_FOR_OUTSTANDING", value: { eq: (x: X) => sub(mul(P2, an(x, n)), L), lo: -0.05, hi: 0.5 }, label: "original loan and term", method: "Equated the level payment to the original loan over the full term.", feedback: "Only the balance at the refinancing is repaid by the level payments." },
        { id: "CONC_LOAN_REFI_OLD_RATE", value: K(i), label: "original rate", method: "Gave the original rate.", feedback: "Solve for the new rate from the new payment." },
      ],
      steps: [
        step("D.principal-component", "Balance after equal principal repayments.", ["B_t", Bt(), `balance at time ${t}`], ["L", "n"]),
        step("D.loan-payment", "Level payments repay that balance.", ["P_2", P2, "level payment"], ["B_t"], { derived: true }),
        step("B.annuity-immediate", "Annuity factor needed.", ["a", Bt() / P2, "annuity factor"], ["B_t", "P_2"], { rearranged: true }),
        step("M.root-finding", "Solve for j.", ["j", jTrue, "new rate"], ["a"], { rearranged: true }),
      ],
      methods: ["equation_construction", "numerical_root", "work_backwards"],
      reasoning: "The balance after equal principal repayments is L(1 − t/n); the level payments are an annuity on it, so solve the annuity factor for the rate.",
      intuition: "The original rate is irrelevant to the balance of a level-principal loan.",
      unknowns: [{ symbol: "$j$", meaning: "refinancing rate" }],
      relationships: ["$P_2\\,a_{\\overline{n-t|}j} = L(1 - t/n)$"],
      conditions: ["No fee."],
      valuationDate: `Time ${t}`,
      modelChoice: "Annuity equation solved for the rate.",
      assumptions: ["Rates as stated."],
      principle: "With equal principal repayments the balance does not depend on the interest rate.",
      unusual: "The original rate is a distraction.",
      misread: "Valuing the balance with the original rate.",
      presentation: ["unknown-rate", "irrelevant-info", "work-backwards", "hidden-structure"],
      params: { kase, L, n, t, i, P2 },
      route: "balance, level payment, factor, solve rate",
    });
  },
};

export const ELITE_LOAN_TEMPLATES: QuestionTemplate[] = [missedRefi, interestMultiple, pointsCost, lenderReinvest, rateReset, skipPayoff, levelPrincipalRefi];
