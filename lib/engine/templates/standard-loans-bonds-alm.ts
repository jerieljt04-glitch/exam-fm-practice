/**
 * SOA-standard (level 1) multi-case templates — loans, bonds and general
 * cash flows / ALM. Each template asks one of three questions about the same
 * kind of situation, so a template that returns asks for different steps.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import type { MisconceptionId } from "../misconceptions";
import { MONEY2, amt, drawUntil, gridAmount, gridRate, ord, pc, step } from "./kit";
import { K, X, add, adue, an, at, div, ia, ln, mul, nameOf, pick, pow, sn, std, sub, sum, vt, type Eq, type Trap } from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const YEARS2: AnswerFormat = { kind: "number", decimals: 2 };
const PLAIN3: AnswerFormat = { kind: "number", decimals: 3 };
const pct = (x: number) => pc(x, 3);
const t = (id: MisconceptionId, value: X | Eq, label: string, method: string, feedback: string): Trap => ({ id, value, label, method, feedback });
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));
const bondPrice = (c: number, C: number, j: number | X, n: number) => add(mul(c, an(j, n)), mul(C, vt(j, n)));

// ===================================================================== LOANS 1: payment, prospective and retrospective balances

const loanBalance: QuestionTemplate = {
  id: "std-loan-balance",
  family: "std-loan-balance",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.amortization", "LOANS.principal_interest"],
  reasoning: ["formula_selection", "valuation_dates", "arithmetic"],
  soaConcept: "An amortised loan: the level payment, the balance from the payments still due, and the balance from what has happened so far.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const L = gridAmount(rng, 10000, 200000, 1000);
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const n = rng.int(8, 30);
    const k = rng.int(2, n - 3);
    const P = div(L, an(i, n));
    const kase = pick(rng, ["payment", "prospective", "retrospective"]);
    if (kase === "payment") {
      return std({
        stem: `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)}, to be repaid by level payments at the end of each year for ${n} years. Calculate the annual payment.`,
        fmt: MONEY2,
        answer: P,
        model: { eq: (x: X) => sub(flows(n, (q) => mul(x, vt(i, q + 1))), L), lo: 1, hi: L },
        modelDescription: "Payments discounted one by one equal the loan.",
        traps: [
          t("TIMING_IMMEDIATE_AS_DUE", div(L, adue(i, n)), "annuity-due", "Used an annuity-due.", "Payments are at year ends."),
          t("SEQ_UNDISCOUNTED_SUM", K(L / n), "loan divided by term", `Divided by ${n}.`, "Payments include interest."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(L * i), "interest only", "Paid only the interest.", "The payments must also repay the loan."),
          t("FORMULA_AV_FOR_PV", div(L, sn(i, n)), "accumulation factor", "Divided by $s_{\\overline{n|}}$.", "Use $a_{\\overline{n|}}$."),
          t("SEQ_TERM_COUNT", div(L, an(i, n - 1)), "one payment short", `Used ${n - 1} payments.`, `There are ${n} payments.`),
        ],
        steps: [step("B.annuity-immediate", "Annuity factor.", ["a_n", an(i, n).v, "annuity factor"], ["i"]), step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"], { rearranged: true })],
        methods: ["rearrangement"],
        reasoning: "Divide the loan by a(n).",
        intuition: "The loan is the present value of the payments.",
        unknown: ["$P$", "annual payment"],
        relationships: ["$L = P\\,a_{\\overline{n|}}$"],
        valuationDate: "Time 0",
        principle: "A loan equals the present value of its payments.",
        misread: "Using an annuity-due.",
        presentation: ["inverse"],
        params: { kase, L, i, n },
        route: "factor, payment",
      });
    }
    if (kase === "prospective") {
      const ans = mul(P, an(i, n - k));
      return std({
        stem: `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)}, repaid by level payments at the end of each year for ${n} years. Calculate the outstanding balance immediately after the ${ord(k)} payment.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(mul(L, at(i, k)), flows(k, (q) => mul(div(L, an(i, n)), at(i, k - q - 1)))),
        modelDescription: "Retrospective balance: the loan accumulated less each payment accumulated.",
        traps: [
          t("TIMING_BALANCE_INDEX", mul(P, an(i, n - k + 1)), "balance one payment earlier", `Used ${n - k + 1} remaining payments.`, `After payment ${k}, ${n - k} payments remain.`),
          t("CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", sub(L, mul(k, P)), "loan less payments", "Subtracted the payments from the loan.", "Payments contain interest."),
          t("SEQ_UNDISCOUNTED_SUM", mul(n - k, P), "remaining payments added", "Added the remaining payments.", "Discount them."),
          t("TRANS_IGNORED_CONDITION", mul(L, at(i, k)), "payments ignored", "Accumulated the loan without payments.", "Subtract the payments made."),
        ],
        steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L", "i"]), step("D.prospective", "Value of the remaining payments.", ["B_k", ans.v, "balance"], ["P"])],
        methods: ["valuation_dates"],
        reasoning: "The balance is the present value of the payments still due.",
        intuition: "Look forward: what is left to pay?",
        unknown: ["$B_k$", "balance"],
        relationships: ["$B_k = P\\,a_{\\overline{n-k|}}$"],
        valuationDate: `Time ${k}`,
        principle: "Prospective and retrospective balances agree.",
        misread: "Counting one payment too many.",
        presentation: ["valuation-date"],
        params: { kase, L, i, n, k },
        route: "payment, prospective",
      });
    }
    const Xp = Math.round((P.v * (0.8 + rng.next() * 0.15)) / 10) * 10;
    const ans = sub(mul(L, at(i, k)), mul(Xp, sn(i, k)));
    return std({
      stem: `${name} borrows ${amt(L)} at an annual effective rate of ${pct(i)} and pays ${amt(Xp)} at the end of each year. Calculate the outstanding balance immediately after the ${ord(k)} payment.`,
      fmt: MONEY2,
      answer: ans,
      model: sub(mul(L, at(i, k)), flows(k, (q) => mul(Xp, at(i, k - q - 1)))),
      modelDescription: "Loan accumulated less each payment accumulated.",
      traps: [
        t("CONC_LOAN_RETRO_WITHOUT_INTEREST", K(L - k * Xp), "no interest", "Subtracted the payments from the loan.", "Interest accrues on the balance."),
        t("SEQ_UNDISCOUNTED_SUM", sub(mul(L, at(i, k)), k * Xp), "payments not accumulated", "Subtracted the payments at face value.", "Each payment is accumulated too."),
        t("TIMING_IMMEDIATE_AS_DUE", sub(mul(L, at(i, k)), mul(Xp, sn(i, k), 1 + i)), "payments at year starts", "Accumulated the payments as an annuity-due.", "Payments are at year ends."),
        t("TIMING_BALANCE_INDEX", sub(mul(L, at(i, k - 1)), mul(Xp, sn(i, k - 1))), "one year early", `Stopped after ${k - 1} payments.`, `${k} payments have been made.`),
      ],
      steps: [step("A.accumulation", "Loan accumulated.", ["L(1+i)^k", L * Math.pow(1 + i, k), "loan accumulated"], ["L", "i"]), step("D.retrospective", "Less payments accumulated.", ["B_k", ans.v, "balance"], ["X"])],
      methods: ["valuation_dates"],
      reasoning: "Retrospective method: loan accumulated minus payments accumulated.",
      intuition: "Payments are not level-amortising, so look back.",
      unknown: ["$B_k$", "balance"],
      relationships: ["$B_k = L(1+i)^k - X s_{\\overline{k|}}$"],
      valuationDate: `Time ${k}`,
      principle: "The retrospective balance works for any payments.",
      misread: "Ignoring interest.",
      presentation: ["valuation-date"],
      params: { kase, L, i, k, Xp },
      route: "accumulate, retrospective",
    });
  },
};

// ===================================================================== LOANS 2: interest, principal, total interest

const loanComponents: QuestionTemplate = {
  id: "std-loan-components",
  family: "std-loan-components",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.principal_interest", "LOANS.amortization"],
  reasoning: ["formula_selection", "arithmetic", "translation"],
  soaConcept: "Interest and principal in a given payment of a level-payment loan, and the total interest over the loan.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const L = gridAmount(rng, 10000, 200000, 1000);
    const i = gridRate(rng, 0.04, 0.1, 0.0025);
    const n = rng.int(10, 30);
    const k = rng.int(2, n - 2);
    const P = div(L, an(i, n));
    const kase = pick(rng, ["interest", "principal", "total"]);
    const stem0 = `${name} repays a loan of ${amt(L)} with level payments at the end of each year for ${n} years at an annual effective rate of ${pct(i)}.`;
    const balance = (idx: number) => mul(P, an(i, n - idx));
    const explicitB = (idx: number) => sub(mul(L, at(i, idx)), flows(idx, (q) => mul(div(L, an(i, n)), at(i, idx - q - 1))));
    if (kase === "interest") {
      const ans = mul(i, balance(k - 1));
      return std({
        stem: `${stem0} Calculate the interest in the ${ord(k)} payment.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(i, explicitB(k - 1)),
        modelDescription: "Interest on the retrospective balance after the previous payment.",
        traps: [
          t("VAR_INTEREST_FOR_PRINCIPAL", mul(P, vt(i, n - k + 1)), "principal portion", "Gave the principal portion.", "Interest = i × previous balance."),
          t("TIMING_BALANCE_INDEX", mul(i, balance(k)), "balance after the payment", `Used the balance after payment ${k}.`, `Use the balance after payment ${k - 1}.`),
          t("MODEL_INTEREST_ON_ORIGINAL", K(i * L), "interest on the original loan", "Charged interest on the original loan.", "Interest is on the outstanding balance."),
          t("CONC_LOAN_PRINCIPAL_LEVEL", K(i * (L - ((k - 1) * L) / n)), "equal principal assumed", "Assumed equal principal repayments.", "Level payments repay principal unevenly."),
        ],
        steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"]), step("D.prospective", `Balance after payment ${k - 1}.`, ["B", balance(k - 1).v, "previous balance"], ["P"]), step("D.interest-component", "Interest.", ["I_k", ans.v, "interest"], ["B", "i"])],
        methods: ["substitution"],
        reasoning: "Interest in a payment = i × balance after the previous payment.",
        intuition: "Interest accrues on what is owed during the year.",
        unknown: ["$I_k$", "interest in the payment"],
        relationships: ["$I_k = iB_{k-1} = P(1 - v^{n-k+1})$"],
        valuationDate: `Time ${k - 1}`,
        principle: "Interest is charged on the previous balance.",
        misread: "Using the balance after the payment.",
        presentation: ["direct"],
        params: { kase, L, i, n, k },
        route: "payment, balance, interest",
      });
    }
    if (kase === "principal") {
      const ans = mul(P, vt(i, n - k + 1));
      return std({
        stem: `${stem0} Calculate the principal repaid in the ${ord(k)} payment.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(div(L, an(i, n)), mul(i, explicitB(k - 1))),
        modelDescription: "Payment minus interest on the retrospective previous balance.",
        traps: [
          t("VAR_INTEREST_FOR_PRINCIPAL", mul(i, balance(k - 1)), "interest portion", "Gave the interest portion.", "Principal = payment − interest."),
          t("TIMING_BALANCE_INDEX", mul(P, vt(i, n - k)), "power one short", `Used $v^{${n - k}}$.`, `Use $v^{n-k+1} = v^{${n - k + 1}}$.`),
          t("CONC_LOAN_PRINCIPAL_LEVEL", K(L / n), "equal principal", `Used ${amt(L)}/${n}.`, "Principal grows over time."),
          t("CONC_LOAN_SCHEDULE_REVERSED", mul(P, vt(i, k)), "schedule reversed", `Used $v^{${k}}$.`, "Early payments repay little principal."),
        ],
        steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"]), step("D.principal-component", "Principal.", ["PR_k", ans.v, "principal"], ["P", "i"])],
        methods: ["substitution"],
        reasoning: "Principal in payment k is P·v^{n−k+1}.",
        intuition: "Principal portions grow by (1 + i) each year.",
        unknown: ["$PR_k$", "principal in the payment"],
        relationships: ["$PR_k = Pv^{n-k+1}$"],
        valuationDate: `Time ${k}`,
        principle: "Principal repaid grows geometrically.",
        misread: "Giving the interest.",
        presentation: ["direct"],
        params: { kase, L, i, n, k },
        route: "payment, principal",
      });
    }
    const ans = sub(mul(n, P), L);
    return std({
      stem: `${stem0} Calculate the total interest paid over the life of the loan.`,
      fmt: MONEY2,
      answer: ans,
      model: sum(Array.from({ length: n }, (_, q) => mul(i, explicitB(q)))),
      modelDescription: "Interest of each year (i × previous balance) added up.",
      traps: [
        t("VAR_TOTAL_FOR_COMPONENT", mul(n, P), "total payments", "Gave the total of the payments.", "Subtract the principal."),
        t("MODEL_INTEREST_ON_ORIGINAL", K(i * L * n), "interest on the original loan every year", "Charged interest on the original loan each year.", "The balance falls."),
        t("CONC_LOAN_PRINCIPAL_LEVEL", K((i * L * (n + 1)) / 2), "equal-principal formula", "Used the equal-principal interest formula.", "Payments here are level."),
        t("TIMING_IMMEDIATE_AS_DUE", sub(mul(n, div(L, adue(i, n))), L), "payments at year starts", "Used an annuity-due payment.", "Payments are at year ends."),
      ],
      steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"]), step("D.total-interest", "Total payments minus principal.", ["I", ans.v, "total interest"], ["P", "L"])],
      methods: ["substitution"],
      reasoning: "Total interest = nP − L.",
      intuition: "Everything paid beyond the principal is interest.",
      unknown: ["$I$", "total interest"],
      relationships: ["$I = nP - L$"],
      valuationDate: "Undiscounted total",
      principle: "Total interest is total payments less principal.",
      misread: "Giving total payments.",
      presentation: ["direct"],
      params: { kase, L, i, n },
      route: "payment, total",
    });
  },
};

// ===================================================================== LOANS 3: monthly loans

const loanMonthly: QuestionTemplate = {
  id: "std-loan-monthly",
  family: "std-loan-monthly",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.amortization",
  secondary: ["LOANS.outstanding_balance", "TVM.effective_nominal"],
  reasoning: ["formula_selection", "translation", "arithmetic"],
  soaConcept: "A monthly-payment loan quoted at a nominal rate: the payment, a balance, and the interest paid in the first year.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const L = gridAmount(rng, 50000, 400000, 5000);
    const i12 = gridRate(rng, 0.03, 0.08, 0.00125);
    const y = pick(rng, [10, 15, 20, 25, 30]);
    const r = i12 / 12;
    const N = 12 * y;
    const P = div(L, an(r, N));
    const kase = pick(rng, ["payment", "balance", "first-year-interest"]);
    const stem0 = `${name} takes a ${y}-year loan of ${amt(L)} with level monthly payments at the end of each month, at a nominal annual rate of ${pct(i12)} convertible monthly.`;
    if (kase === "payment") {
      return std({
        stem: `${stem0} Calculate the monthly payment.`,
        fmt: MONEY2,
        answer: P,
        model: { eq: (x: X) => sub(mul(x, div(sub(1, pow(1 + r, -N)), r)), L), lo: 1, hi: L },
        modelDescription: "Payment times the monthly annuity factor equals the loan.",
        traps: [
          t("CONC_ANN_MTHLY_PAYMENT_SIZE", div(div(L, an(Math.pow(1 + r, 12) - 1, y)), 12), "annual payment divided by 12", "Divided an annual payment by 12.", "Work in months."),
          t("COMP_PERIODS_AS_YEARS", div(L, an(r, y)), "years used as months", `Used ${y} periods.`, `There are ${N} payments.`),
          t("SEQ_UNDISCOUNTED_SUM", K(L / N), "loan divided by months", `Divided by ${N}.`, "Payments include interest."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(L * r), "interest only", "Paid only the monthly interest.", "The payments also repay the loan."),
        ],
        steps: [step("A.nominal-equivalence", "Monthly rate.", ["i/12", r, "monthly rate"], ["i^(12)"]), step("D.loan-payment", "Payment.", ["P", P.v, "monthly payment"], ["L"], { rearranged: true })],
        methods: ["rearrangement"],
        reasoning: "Use the monthly rate and the number of months.",
        intuition: "Match the rate period to the payment period.",
        unknown: ["$P$", "monthly payment"],
        relationships: ["$L = P\\,a_{\\overline{12n|}\\,i^{(12)}/12}$"],
        valuationDate: "Time 0",
        principle: "Work in the payment period.",
        misread: "Using years as periods.",
        presentation: ["inverse", "frequency"],
        params: { kase, L, i12, y },
        route: "monthly rate, payment",
      });
    }
    if (kase === "balance") {
      const m = 12 * rng.int(2, y - 2) + rng.int(0, 11);
      const ans = mul(P, an(r, N - m));
      return std({
        stem: `${stem0} Calculate the outstanding balance immediately after the ${ord(m)} payment.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(mul(L, pow(1 + r, m)), mul(div(L, an(r, N)), div(sub(pow(1 + r, m), 1), r))),
        modelDescription: "Retrospective balance at the monthly rate.",
        traps: [
          t("TIMING_BALANCE_INDEX", mul(P, an(r, N - m + 1)), "one payment too many left", `Used ${N - m + 1} remaining payments.`, `${N - m} payments remain.`),
          t("CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", sub(L, mul(m, P)), "loan less payments", "Subtracted the payments.", "Payments contain interest."),
          t("SEQ_UNDISCOUNTED_SUM", mul(N - m, P), "remaining payments added", "Added the remaining payments.", "Discount them."),
          t("COMP_PERIODS_AS_YEARS", mul(P, an(i12, (N - m) / 12)), "years at the nominal rate", "Discounted yearly at the nominal rate.", "Work in months."),
          t("TRANS_IGNORED_CONDITION", mul(L, pow(1 + r, m)), "payments ignored", "Accumulated the loan without payments.", "Subtract the payments made."),
        ],
        steps: [step("D.loan-payment", "Monthly payment.", ["P", P.v, "monthly payment"], ["L"]), step("D.prospective", "Remaining payments.", ["B", ans.v, "balance"], ["P"])],
        methods: ["valuation_dates"],
        reasoning: "Balance = present value of the remaining monthly payments.",
        intuition: "Look forward from the payment date.",
        unknown: ["$B$", "balance"],
        relationships: ["$B_m = P\\,a_{\\overline{N-m|}}$"],
        valuationDate: `Month ${m}`,
        principle: "Prospective balance.",
        misread: "Subtracting payments without interest.",
        presentation: ["valuation-date", "frequency"],
        params: { kase, L, i12, y, m },
        route: "payment, prospective",
      });
    }
    const B12 = mul(P, an(r, N - 12));
    const ans = sub(mul(12, P), sub(L, B12));
    return std({
      stem: `${stem0} Calculate the total interest paid in the first year.`,
      fmt: MONEY2,
      answer: ans,
      model: sum(Array.from({ length: 12 }, (_, q) => mul(r, sub(mul(L, pow(1 + r, q)), mul(div(L, an(r, N)), div(sub(pow(1 + r, q), 1), r)))))),
      modelDescription: "Each month's interest on the retrospective balance, added.",
      traps: [
        t("VAR_TOTAL_FOR_COMPONENT", mul(12, P), "total payments", "Gave the year's payments.", "Subtract the principal repaid."),
        t("MODEL_INTEREST_ON_ORIGINAL", K(L * i12), "interest on the original loan", "Charged a year's interest on the original loan.", "The balance falls each month."),
        t("VAR_INTEREST_FOR_PRINCIPAL", sub(L, B12), "principal repaid", "Gave the principal repaid.", "Interest = payments − principal."),
        t("SEQ_TERM_COUNT", sub(mul(11, P), sub(L, mul(P, an(r, N - 11)))), "eleven months", "Used 11 months.", "A year has 12 payments."),
        t("TIMING_BALANCE_INDEX", sub(mul(12, P), sub(B12, mul(P, an(r, N - 24)))), "second year's interest", "Computed the interest for year 2.", "The question asks for the first year."),
      ],
      steps: [step("D.loan-payment", "Monthly payment.", ["P", P.v, "monthly payment"], ["L"]), step("D.prospective", "Balance after 12 payments.", ["B_{12}", B12.v, "balance after a year"], ["P"]), step("D.total-interest", "Payments less principal repaid.", ["I", ans.v, "first-year interest"], ["P", "B_12"])],
      methods: ["decomposition"],
      reasoning: "Interest in the year = 12P − (L − B₁₂).",
      intuition: "What was paid, less what reduced the balance.",
      unknown: ["$I$", "first-year interest"],
      relationships: ["$I = 12P - (L - B_{12})$"],
      valuationDate: "Month 12",
      principle: "Interest over a period = payments − principal repaid.",
      misread: "Giving the payments.",
      presentation: ["frequency", "direct"],
      params: { kase, L, i12, y },
      route: "payment, balance, interest",
    });
  },
};

// ===================================================================== LOANS 4: unknown rate, drop payment, deferred start

const loanUnknown: QuestionTemplate = {
  id: "std-loan-unknown",
  family: "std-loan-unknown",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.final_payments", "LOANS.amortization"],
  reasoning: ["algebra", "translation", "valuation_dates"],
  soaConcept: "Loan unknowns: the rate from the payment, the final drop payment, the amount when payments are deferred.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const kase = pick(rng, ["rate", "drop", "deferred"]);
    if (kase === "rate") {
      const L = gridAmount(rng, 10000, 100000, 1000);
      const n = rng.int(5, 20);
      const iTrue = gridRate(rng, 0.03, 0.1, 0.0025);
      const P = Math.round((L / an(iTrue, n).v) * 100) / 100;
      const eq = (o: { due?: boolean } = {}): Eq => ({ eq: (x: X) => sub(mul(P, an(x, n), o.due ? add(1, x) : 1), L), lo: 0.0001, hi: 0.6 });
      return std({
        stem: `${name} borrows ${amt(L)} and repays it with ${n} level payments of ${amt(P)} at the end of each year. Calculate the annual effective rate of interest.`,
        fmt: PCT3,
        answer: eq(),
        model: { eq: (x: X) => sub(flows(n, (q) => mul(P, pow(add(1, x), -(q + 1)))), L), lo: 0.0001, hi: 0.6 },
        modelDescription: "Payments discounted one by one at the unknown rate equal the loan.",
        traps: [
          t("TIMING_IMMEDIATE_AS_DUE", eq({ due: true }), "annuity-due", "Solved with an annuity-due.", "Payments are at year ends."),
          t("CONC_RETURN_ON_WRONG_BASE", K((n * P - L) / (n * L)), "simple average", "Divided total interest by the loan and term.", "Solve the equation of value."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(P / L), "payment over loan", "Took payment ÷ loan.", "That is a perpetuity's rate."),
          t("ALG_DIVIDE_ERROR", K((2 * (n * P - L)) / (L * (n + 1))), "average-balance approximation", "Used total interest over the average balance.", "Solve the equation of value exactly."),
        ],
        steps: [step("B.annuity-immediate", "Annuity factor needed.", ["a_n", L / P, "annuity factor needed"], ["L", "P"], { rearranged: true }), step("M.root-finding", "Solve for the rate.", ["i", iTrue, "rate"], ["a_n"], { rearranged: true })],
        methods: ["numerical_root"],
        reasoning: "Find i with a(n) = L/P (calculator I/Y).",
        intuition: "The rate makes the payments worth exactly the loan.",
        unknown: ["$i$", "rate"],
        relationships: ["$P\\,a_{\\overline{n|}i} = L$"],
        valuationDate: "Time 0",
        principle: "An unknown rate needs a numerical solution.",
        misread: "Using an annuity-due.",
        presentation: ["unknown-rate"],
        params: { kase, L, P, n },
        route: "factor, solve",
      });
    }
    if (kase === "drop") {
      const L = gridAmount(rng, 10000, 100000, 1000);
      const i = gridRate(rng, 0.04, 0.09, 0.0025);
      const P = gridAmount(rng, Math.round(L * (i + 0.04)), Math.round(L * (i + 0.15)), 50);
      let N = 0;
      while (an(i, N + 1).v * P <= L) N += 1;
      const drop = mul(sub(L, mul(P, an(i, N))), at(i, N + 1));
      if (drop.v < 0.12 * P) throw new Error("Drop too small.");
      return std({
        stem: `${name} repays a loan of ${amt(L)} at an annual effective rate of ${pct(i)} with payments of ${amt(P)} at the end of each year for as long as necessary, plus a smaller final payment one year after the last full payment. Calculate the final payment.`,
        fmt: MONEY2,
        answer: drop,
        model: { eq: (x: X) => sub(add(flows(N, (q) => mul(P, vt(i, q + 1))), mul(x, vt(i, N + 1))), L), lo: 0.01, hi: P },
        modelDescription: "Full payments and the final payment, discounted, equal the loan.",
        traps: [
          t("CHAL_BALLOON_FOR_DROP", add(P, mul(drop, vt(i, 1))), "balloon instead of drop", "Added the remainder to the last full payment.", "The final payment is a year after the last full one."),
          t("TIMING_EXTRA_PERIOD", mul(drop, 1 + i), "a year late", "Accumulated a year too many.", `The final payment is at time ${N + 1}.`),
          t("TIMING_MISSING_PERIOD", div(drop, 1 + i), "a year short", "Accumulated a year too few.", `Accumulate to time ${N + 1}.`),
          t("CHAL_FRACTIONAL_PAYMENT", mul(P, (Math.log(1 - (L * i) / P) / Math.log(1 / (1 + i))) - N), "fraction of a payment", "Took the fractional part of n times a payment.", "The final payment is the accumulated remaining balance."),
        ],
        steps: [step("B.counting", "Number of full payments.", ["N", N, "full payments"], ["L", "P", "i"]), step("D.retrospective", "Remaining balance.", ["B_N", sub(L, mul(P, an(i, N))).v * Math.pow(1 + i, N), `balance at time ${N}`], ["N"]), step("D.drop-balloon", "Final payment.", ["X", drop.v, "final payment"], ["B_N"])],
        methods: ["logarithms", "valuation_dates"],
        reasoning: "Count the full payments, then accumulate what remains to the next payment date.",
        intuition: "The last payment clears what is left, with a year's interest.",
        unknown: ["$X$", "final payment"],
        relationships: ["$L = P\\,a_{\\overline{N|}} + Xv^{N+1}$"],
        valuationDate: `Time ${N + 1}`,
        principle: "A drop payment is the balance accumulated one period.",
        misread: "Treating it as a balloon.",
        presentation: ["unknown-time", "valuation-date"],
        params: { kase, L, i, P, N },
        route: "count, balance, drop",
      });
    }
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const P = gridAmount(rng, 1000, 10000, 100);
    const n = rng.int(5, 20);
    const d = rng.int(1, 4);
    const ans = mul(P, an(i, n), vt(i, d));
    return std({
      stem: `${name} can afford ${n} annual payments of ${amt(P)}, the first one ${d + 1} years from now. At an annual effective rate of ${pct(i)}, calculate the largest amount ${name} can borrow today.`,
      fmt: MONEY2,
      answer: ans,
      model: flows(n, (q) => mul(P, vt(i, d + q + 1))),
      modelDescription: "Each payment discounted from its date.",
      traps: [
        t("TIMING_IGNORED_DEFERRAL", mul(P, an(i, n)), "not deferred", "Did not defer.", `The first payment is at time ${d + 1}.`),
        t("TIMING_DEFERRAL_OFF_BY_ONE", mul(P, an(i, n), vt(i, d + 1)), "deferred a year too long", `Deferred ${d + 1} years.`, `The annuity value sits at time ${d}.`),
        t("TIMING_IMMEDIATE_AS_DUE", mul(P, adue(i, n), vt(i, d + 1)), "annuity-due deferred", "Used a due annuity from the first payment date, deferred too far.", `Value at time ${d} with an annuity-immediate.`),
        t("SEQ_UNDISCOUNTED_SUM", K(n * P), "payments added", "Added the payments.", "Discount each payment."),
        t("SEQ_TERM_COUNT", mul(P, an(i, n - 1), vt(i, d)), "one payment short", `Used ${n - 1} payments.`, `There are ${n} payments.`),
        t("FORMULA_AV_FOR_PV", mul(P, an(i, n), at(i, d)), "accumulated instead of discounted", "Moved the value forward instead of back.", "Discount to today."),
      ],
      steps: [step("B.annuity-immediate", "Value at time d.", ["P a_n", mul(P, an(i, n)).v, `value at time ${d}`], ["P"]), step("B.deferred", "Discount to today.", ["L", ans.v, "loan amount"], ["i"])],
      methods: ["valuation_dates"],
      reasoning: `Annuity-immediate value at time ${d}, then discount ${d} years.`,
      intuition: "Deferral: value one period before the first payment, then discount.",
      unknown: ["$L$", "loan amount"],
      relationships: [`$L = P\\,a_{\\overline{n|}}v^{${d}}$`],
      valuationDate: "Time 0",
      principle: "Deferred annuities: discount from one period before the first payment.",
      misread: "Deferring by the first payment's time.",
      presentation: ["deferred", "valuation-date"],
      params: { kase, i, P, n, d },
      route: "annuity, defer",
    });
  },
};

// ===================================================================== LOANS 5: refinancing

const loanRefi: QuestionTemplate = {
  id: "std-loan-refinance",
  family: "std-loan-refinance",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.outstanding_balance", "LOANS.amortization"],
  reasoning: ["valuation_dates", "formula_selection", "arithmetic"],
  soaConcept: "Refinancing an amortised loan at a lower rate: the new payment, the saving, and the effect of a refinancing fee.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const L = gridAmount(rng, 50000, 300000, 5000);
    const i = gridRate(rng, 0.05, 0.1, 0.0025);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.07, 0.0025), (x) => i - x >= 0.0125);
    const n = rng.int(15, 30);
    const k = rng.int(3, n - 5);
    const P = div(L, an(i, n));
    const B = mul(P, an(i, n - k));
    const Pn = (bal: X, rate = j, term = n - k) => div(bal, an(rate, term));
    const kase = pick(rng, ["new-payment", "saving", "fee"]);
    const stem0 = `${name} borrowed ${amt(L)} at an annual effective rate of ${pct(i)}, repaid by level payments at the end of each year for ${n} years. Immediately after the ${ord(k)} payment, the loan is refinanced at ${pct(j)} with level payments over the remaining ${n - k} years.`;
    const explicitB = sub(mul(L, at(i, k)), flows(k, (q) => mul(div(L, an(i, n)), at(i, k - q - 1))));
    const baseSteps = [step("D.loan-payment", "Original payment.", ["P", P.v, "original payment"], ["L", "i"]), step("D.prospective", "Balance at refinancing.", ["B_k", B.v, "balance"], ["P"])];
    if (kase === "new-payment") {
      const ans = Pn(B);
      return std({
        stem: `${stem0} Calculate the new annual payment.`,
        fmt: MONEY2,
        answer: ans,
        model: div(explicitB, an(j, n - k)),
        modelDescription: "Retrospective balance amortised at the new rate.",
        traps: [
          t("TIMING_REFINANCE_PERIODS", Pn(B, j, n), "full original term", `Used ${n} payments.`, `${n - k} payments remain.`),
          t("MODEL_BALANCE_AT_NEW_RATE", Pn(mul(P, an(j, n - k))), "balance at the new rate", "Valued the balance at the new rate.", "The balance uses the original rate."),
          t("VAR_ORIGINAL_FOR_OUTSTANDING", Pn(K(L)), "original loan refinanced", "Refinanced the original amount.", "Only the balance is refinanced."),
          t("SEQ_UNDISCOUNTED_SUM", K(B.v / (n - k)), "balance divided by term", `Divided by ${n - k}.`, "Payments include interest."),
          t("TIMING_IMMEDIATE_AS_DUE", div(B, adue(j, n - k)), "annuity-due", "Used an annuity-due.", "Payments are at year ends."),
        ],
        steps: [...baseSteps, step("D.loan-payment", "New payment.", ["P'", ans.v, "new payment"], ["B_k", "j"], { rearranged: true })],
        methods: ["valuation_dates", "rearrangement"],
        reasoning: "Find the balance at the old rate, then amortise it at the new rate over the remaining term.",
        intuition: "A refinancing replaces the balance with a new loan.",
        unknown: ["$P'$", "new payment"],
        relationships: ["$P' = B_k/a_{\\overline{n-k|}j}$"],
        valuationDate: `Time ${k}`,
        principle: "Refinance the outstanding balance.",
        misread: "Using the full original term.",
        presentation: ["valuation-date"],
        params: { kase, L, i, j, n, k },
        route: "payment, balance, new payment",
      });
    }
    if (kase === "saving") {
      const ans = mul(sub(P, Pn(B)), n - k);
      return std({
        stem: `${stem0} Calculate the total reduction in payments (undiscounted) over the remaining term.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(sub(div(L, an(i, n)), div(explicitB, an(j, n - k))), n - k),
        modelDescription: "Difference in payments times the number of remaining payments.",
        traps: [
          t("VAR_TOTAL_FOR_COMPONENT", sub(P, Pn(B)), "one year's saving", "Gave the saving per payment.", `Multiply by ${n - k} payments.`),
          t("TIMING_REFINANCE_PERIODS", mul(sub(P, Pn(B)), n), "full term", `Multiplied by ${n}.`, `${n - k} payments remain.`),
          t("FORMULA_AV_FOR_PV", mul(sub(P, Pn(B)), an(j, n - k)), "present value of the saving", "Discounted the savings.", "The question asks for the undiscounted total."),
          t("TIMING_IMMEDIATE_AS_DUE", mul(sub(P, div(B, adue(j, n - k))), n - k), "annuity-due", "Used an annuity-due for the new payments.", "Payments are at year ends."),
          t("SEQ_TERM_COUNT", mul(sub(P, Pn(B)), n - k - 1), "one payment short", `Multiplied by ${n - k - 1}.`, `${n - k} payments remain.`),
        ],
        steps: [...baseSteps, step("D.loan-payment", "New payment.", ["P'", Pn(B).v, "new payment"], ["B_k", "j"], { rearranged: true }), step("D.total-interest", "Total reduction.", ["S", ans.v, "total reduction"], ["P", "P'"])],
        methods: ["valuation_dates", "decomposition"],
        reasoning: "New payment from the balance at the new rate; multiply the difference by the remaining payments.",
        intuition: "Same remaining term, lower rate: each payment falls.",
        unknown: ["$S$", "total reduction"],
        relationships: ["$S = (n-k)(P - P')$"],
        valuationDate: "Undiscounted total",
        principle: "Undiscounted totals add payments directly.",
        misread: "Giving one year's saving.",
        presentation: ["valuation-date"],
        params: { kase, L, i, j, n, k },
        route: "payment, balance, new payment, saving",
      });
    }
    const f = pick(rng, [0.01, 0.015, 0.02, 0.03]);
    const ans = Pn(mul(B, 1 + f));
    return std({
      stem: `${stem0} A refinancing fee of ${pc(f, 1)} of the balance is added to the amount refinanced. Calculate the new annual payment.`,
      fmt: MONEY2,
      answer: ans,
      model: div(mul(explicitB, 1 + f), an(j, n - k)),
      modelDescription: "Retrospective balance plus fee, amortised at the new rate.",
      traps: [
        t("TRANS_IGNORED_CONDITION", Pn(B), "fee ignored", "Left out the fee.", `The fee adds ${pc(f, 1)}.`),
        t("TIMING_REFINANCE_PERIODS", Pn(mul(B, 1 + f), j, n), "full original term", `Used ${n} payments.`, `${n - k} payments remain.`),
        t("CONC_LOAN_REFI_OLD_RATE", Pn(mul(B, 1 + f), i), "old rate", "Used the old rate.", `The new rate is ${pct(j)}.`),
        t("MODEL_BALANCE_AT_NEW_RATE", Pn(mul(P, an(j, n - k), 1 + f)), "balance at the new rate", "Valued the balance at the new rate.", "The balance uses the original rate."),
        t("ALG_SIGN_ERROR", Pn(mul(B, 1 - f)), "fee subtracted", "Subtracted the fee.", "The fee is added to the balance."),
        t("SEQ_UNDISCOUNTED_SUM", K((B.v * (1 + f)) / (n - k)), "balance divided by term", `Divided by ${n - k}.`, "Payments include interest."),
      ],
      steps: [...baseSteps, step("A.equation-of-value", "Add the fee.", ["B'", B.v * (1 + f), "amount refinanced"], ["B_k", "f"], { derived: true }), step("D.loan-payment", "New payment.", ["P'", ans.v, "new payment"], ["B'", "j"], { rearranged: true })],
      methods: ["valuation_dates", "rearrangement"],
      reasoning: "Balance at the old rate, plus the fee, amortised at the new rate.",
      intuition: "The fee is borrowed too.",
      unknown: ["$P'$", "new payment"],
      relationships: ["$P' = B_k(1+f)/a_{\\overline{n-k|}j}$"],
      valuationDate: `Time ${k}`,
      principle: "Fees added to a refinanced balance are amortised with it.",
      misread: "Ignoring the fee.",
      presentation: ["valuation-date", "irrelevant-info"],
      params: { kase, L, i, j, n, k, f },
      route: "payment, balance, fee, new payment",
    });
  },
};

// ===================================================================== LOANS 6: an extra payment

const loanExtra: QuestionTemplate = {
  id: "std-loan-extra-payment",
  family: "std-loan-extra-payment",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.outstanding_balance", "LOANS.unknown_variables"],
  reasoning: ["valuation_dates", "cashflow_modelling", "arithmetic"],
  soaConcept: "An extra payment on an amortised loan: the new balance, a new level payment, or a shorter term with a drop payment.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const L = gridAmount(rng, 20000, 200000, 5000);
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 5);
    const P = div(L, an(i, n));
    const B = mul(P, an(i, n - k));
    const E = Math.round((B.v * (0.1 + rng.next() * 0.2)) / 500) * 500;
    const kase = pick(rng, ["balance", "new-payment", "drop"]);
    const stem0 = `${name} borrowed ${amt(L)} at an annual effective rate of ${pct(i)}, with level payments at the end of each year for ${n} years. Together with the ${ord(k)} regular payment, ${name} pays an extra ${amt(E)}.`;
    const explicitB = sub(mul(L, at(i, k)), flows(k, (q) => mul(div(L, an(i, n)), at(i, k - q - 1))));
    if (kase === "balance") {
      const ans = sub(B, E);
      return std({
        stem: `${stem0} Calculate the balance immediately after these payments.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(explicitB, E),
        modelDescription: "Retrospective balance less the extra payment.",
        traps: [
          t("TRANS_IGNORED_CONDITION", B, "extra payment ignored", "Left out the extra payment.", "It reduces the balance."),
          t("TIMING_BALANCE_INDEX", sub(mul(P, an(i, n - k + 1)), E), "balance one payment earlier", "Used the balance before the regular payment.", `Use the balance after payment ${k}.`),
          t("CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", sub(sub(L, mul(k, P)), E), "loan less payments", "Subtracted payments without interest.", "Payments contain interest."),
          t("ALG_SIGN_ERROR", add(B, E), "extra payment added", "Added the extra payment.", "A payment reduces the balance."),
        ],
        steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"]), step("D.prospective", "Scheduled balance.", ["B_k", B.v, "scheduled balance"], ["P"]), step("A.equation-of-value", "Less the extra payment.", ["B", ans.v, "balance"], ["E"])],
        methods: ["valuation_dates"],
        reasoning: "Scheduled balance less the extra payment.",
        intuition: "Extra money goes straight to principal.",
        unknown: ["$B$", "balance"],
        relationships: ["$B = P\\,a_{\\overline{n-k|}} - E$"],
        valuationDate: `Time ${k}`,
        principle: "Extra payments reduce principal directly.",
        misread: "Ignoring the extra payment.",
        presentation: ["valuation-date"],
        params: { kase, L, i, n, k, E },
        route: "payment, balance, subtract",
      });
    }
    if (kase === "new-payment") {
      const ans = div(sub(B, E), an(i, n - k));
      return std({
        stem: `${stem0} The remaining payments are then recalculated so the loan still ends at time ${n}. Calculate the new annual payment.`,
        fmt: MONEY2,
        answer: ans,
        model: div(sub(explicitB, E), an(i, n - k)),
        modelDescription: "Retrospective balance less the extra payment, amortised over the remaining years.",
        traps: [
          t("ALLOC_EVEN_SPLIT", sub(P, E / (n - k)), "extra payment spread evenly", "Spread the extra payment evenly over the remaining payments.", "Its value includes interest: amortise it."),
          t("TRANS_IGNORED_CONDITION", P, "unchanged payment", "Kept the old payment.", "The balance fell."),
          t("TIMING_REFINANCE_PERIODS", div(sub(B, E), an(i, n - k + 1)), "one payment too many", `Used ${n - k + 1} payments.`, `${n - k} remain.`),
          t("SEQ_UNDISCOUNTED_SUM", K((B.v - E) / (n - k)), "balance divided by term", `Divided by ${n - k}.`, "Payments include interest."),
        ],
        steps: [step("D.loan-payment", "Payment.", ["P", P.v, "payment"], ["L"]), step("D.prospective", "Balance after the extra payment.", ["B", B.v - E, "balance"], ["P", "E"]), step("D.loan-payment", "New payment.", ["P'", ans.v, "new payment"], ["B"], { rearranged: true })],
        methods: ["valuation_dates", "rearrangement"],
        reasoning: "Reduce the balance by the extra payment and re-amortise over the remaining years.",
        intuition: "Same end date, smaller balance: smaller payments.",
        unknown: ["$P'$", "new payment"],
        relationships: ["$P' = (B_k - E)/a_{\\overline{n-k|}}$"],
        valuationDate: `Time ${k}`,
        principle: "Re-amortise the new balance.",
        misread: "Spreading the extra payment evenly.",
        presentation: ["valuation-date", "inverse"],
        params: { kase, L, i, n, k, E },
        route: "payment, balance, new payment",
      });
    }
    const Bv = B.v - E;
    let N = 0;
    while (an(i, N + 1).v * P.v <= Bv) N += 1;
    const drop = mul(sub(Bv, mul(P, an(i, N))), at(i, N + 1));
    if (drop.v < 0.1 * P.v) throw new Error("Drop too small.");
    return std({
      stem: `${stem0} ${name} keeps paying the regular amount until a smaller final payment, one year after the last full payment, repays the loan. Calculate the final payment.`,
      fmt: MONEY2,
      answer: drop,
      model: { eq: (x: X) => sub(add(flows(N, (q) => mul(div(L, an(i, n)), vt(i, q + 1))), mul(x, vt(i, N + 1))), sub(explicitB, E)), lo: 0.01, hi: P.v * 2 },
      modelDescription: "Balance after the extra payment equals the full payments and the final payment, discounted.",
      traps: [
        t("CHAL_BALLOON_FOR_DROP", add(P, mul(drop, vt(i, 1))), "balloon instead of drop", "Added the remainder to the last full payment.", "The final payment is a year later."),
        t("TIMING_EXTRA_PERIOD", mul(drop, 1 + i), "a year late", "Accumulated an extra year.", `The final payment is ${N + 1} years after the extra payment.`),
        t("TIMING_MISSING_PERIOD", div(drop, 1 + i), "a year short", "Accumulated a year too few.", "Accumulate one more year."),
        t("SEQ_UNDISCOUNTED_SUM", K(Bv - N * P.v), "remainder without interest", "Subtracted the full payments at face value.", "The balance earns interest."),
        t("CHAL_FRACTIONAL_PAYMENT", mul(P, Math.log(1 - (Bv * i) / P.v) / Math.log(1 / (1 + i)) - N), "fraction of a payment", "Took the fractional part of the term times a payment.", "The final payment is the accumulated remaining balance."),
      ],
      steps: [step("D.prospective", "Balance after the extra payment.", ["B", Bv, "balance"], ["P", "E"]), step("B.counting", "Full payments remaining.", ["N", N, "full payments"], ["B", "P"]), step("D.drop-balloon", "Final payment.", ["X", drop.v, "final payment"], ["B", "N"])],
      methods: ["valuation_dates", "logarithms"],
      reasoning: "Balance after the extra payment; count full payments; accumulate the remainder.",
      intuition: "The extra payment shortens the loan.",
      unknown: ["$X$", "final payment"],
      relationships: ["$B = P\\,a_{\\overline{N|}} + Xv^{N+1}$"],
      valuationDate: `Time ${k + N + 1}`,
      principle: "Extra payments shorten the term when the payment is unchanged.",
      misread: "Treating the final payment as a balloon.",
      presentation: ["unknown-time", "valuation-date"],
      params: { kase, L, i, n, k, E },
      route: "balance, count, drop",
    });
  },
};

// ===================================================================== BONDS 1: price, premium, yield

const bondPriceT: QuestionTemplate = {
  id: "std-bond-price",
  family: "std-bond-price",
  topic: "BONDS",
  levels: [1],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.yield", "BONDS.coupons"],
  reasoning: ["formula_selection", "cashflow_modelling", "arithmetic"],
  soaConcept: "A semiannual-coupon bond: its price, its premium over the redemption value, and its yield from a price.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const F = pick(rng, [1000, 5000, 10000]);
    const C = F * pick(rng, [1, 1, 1.05, 1.1]);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const n = rng.int(5, 25);
    const c = (F * r) / 2;
    const kase = pick(rng, ["price", "premium", "yield"]);
    const stem0 = `A ${n}-year bond with face amount ${amt(F)} pays coupons at a nominal annual rate of ${pct(r)} convertible semiannually and is redeemable at ${amt(C)}.`;
    if (kase === "price") {
      const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.0025), (x) => Math.abs(x - r) >= 0.01);
      const ans = bondPrice(c, C, y / 2, 2 * n);
      return std({
        stem: `${stem0} Calculate the price to yield ${pct(y)} convertible semiannually.`,
        fmt: MONEY2,
        answer: ans,
        model: add(flows(2 * n, (q) => mul(c, vt(y / 2, q + 1))), mul(C, vt(y / 2, 2 * n))),
        modelDescription: "Each coupon and the redemption discounted.",
        traps: [
          t("COMP_PERIODS_AS_YEARS", bondPrice(2 * c, C, y, n), "annual coupons", "Treated the bond as paying annual coupons at the annual rate.", "Work in half-years."),
          t("CONC_BOND_YIELD_IS_COUPON_RATE", bondPrice(c, C, r / 2, 2 * n), "priced at the coupon rate", "Discounted at the coupon rate.", "Discount at the yield."),
          t("CONC_IGNORED_REDEMPTION", mul(c, an(y / 2, 2 * n)), "redemption ignored", "Left out the redemption value.", "Add the discounted redemption."),
          t("RATE_ANNUAL_FOR_PERIODIC", bondPrice(c, C, y, 2 * n), "annual yield per half-year", "Used the annual yield per half-year.", `Use ${pct(y / 2)} per half-year.`),
          t("FORMULA_AV_FOR_PV", add(mul(c, sn(y / 2, 2 * n)), C), "accumulated value", "Accumulated the coupons instead of discounting.", "Price is a present value."),
          ...(C !== F ? [t("CONC_BOND_REDEMPTION_AS_FACE", bondPrice(c, F, y / 2, 2 * n), "redeemed at face", `Redeemed at ${amt(F)}.`, `Redemption is ${amt(C)}.`)] : []),
        ],
        steps: [step("A.nominal-conversion", "Yield per half-year.", ["j", y / 2, "semiannual yield"], ["y"]), step("E.price", "Price.", ["P", ans.v, "price"], ["c", "C", "j"])],
        methods: ["decomposition"],
        reasoning: "Coupons as an annuity plus the discounted redemption, all per half-year.",
        intuition: "A bond is an annuity plus a lump sum.",
        unknown: ["$P$", "price"],
        relationships: ["$P = Fr\\,a_{\\overline{n|}j} + Cv_j^n$"],
        valuationDate: "Time 0",
        principle: "Work in coupon periods.",
        misread: "Using the coupon rate to discount.",
        presentation: ["direct", "frequency"],
        params: { kase, F, C, r, n, y },
        route: "period yield, price",
      });
    }
    if (kase === "premium") {
      const y = drawUntil(() => gridRate(rng, 0.02, 0.09, 0.0025), (x) => c - (C * x) / 2 > 1 && r - x >= 0.0075);
      const j = y / 2;
      const ans = mul(c - C * j, an(j, 2 * n));
      return std({
        stem: `${stem0} ${name} buys it to yield ${pct(y)} convertible semiannually. Calculate the premium paid over the redemption value.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(add(flows(2 * n, (q) => mul(c, vt(j, q + 1))), mul(C, vt(j, 2 * n))), C),
        modelDescription: "Price from the cash flows less the redemption value.",
        traps: [
          t("SEQ_UNDISCOUNTED_SUM", K((c - C * j) * 2 * n), "excess coupons added", "Added the excess coupons without discounting.", "Discount them."),
          t("VAR_OTHER_UNKNOWN", add(C, ans), "price", "Gave the price.", "The premium is the price minus the redemption value."),
          t("RATE_ANNUAL_FOR_PERIODIC", mul(c - C * y, an(y, 2 * n)), "annual yield per half-year", "Used the annual yield per period.", `Use ${pct(j)}.`),
          t("COMP_PERIODS_AS_YEARS", mul(2 * c - C * y, an(y, n)), "annual periods", "Worked in years.", "Coupons are semiannual."),
          t("FORMULA_AV_FOR_PV", mul(c - C * j, sn(j, 2 * n)), "accumulated factor", "Used $s_{\\overline{n|}}$.", "Use $a_{\\overline{n|}}$."),
          ...(C !== F ? [t("CONC_BOND_REDEMPTION_AS_FACE", mul(c - F * j, an(j, 2 * n)), "face in place of redemption", "Used F in place of C.", `Use C = ${amt(C)}.`)] : []),
        ],
        steps: [step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]), step("E.premium-discount", "Premium = (Fr − Cj)a.", ["P - C", ans.v, "premium"], ["c", "C", "j"])],
        methods: ["substitution"],
        reasoning: "Premium = (Fr − Cj)·a(n) at the yield per coupon period.",
        intuition: "The premium is the value of the coupons' excess over the yield on C.",
        unknown: ["$P - C$", "premium"],
        relationships: ["$P - C = (Fr - Cj)a_{\\overline{n|}j}$"],
        valuationDate: "Time 0",
        principle: "Premium/discount formula.",
        misread: "Giving the price.",
        presentation: ["direct", "frequency"],
        params: { kase, F, C, r, n, y },
        route: "period yield, premium",
      });
    }
    const yTrue = gridRate(rng, 0.03, 0.1, 0.0025);
    const P = Math.round(bondPrice(c, C, yTrue / 2, 2 * n).v * 100) / 100;
    const eq = (o: { annual?: boolean } = {}): Eq => ({ eq: (x: X) => sub(o.annual ? bondPrice(2 * c, C, x, n) : bondPrice(c, C, div(x, 2), 2 * n), P), lo: 0.0001, hi: 0.6 });
    return std({
      stem: `${stem0} ${name} buys it for ${amt(P)}. Calculate the yield, convertible semiannually.`,
      fmt: PCT3,
      answer: eq(),
      model: { eq: (x: X) => sub(add(flows(2 * n, (q) => mul(c, pow(add(1, div(x, 2)), -(q + 1)))), mul(C, pow(add(1, div(x, 2)), -2 * n))), P), lo: 0.0001, hi: 0.6 },
      modelDescription: "Price equation at the unknown yield.",
      traps: [
        t("FORMULA_CURRENT_YIELD", K((2 * c) / P), "current yield", "Gave annual coupons ÷ price.", "The yield includes the redemption gain or loss."),
        t("CONC_BOND_YIELD_IS_COUPON_RATE", K(r), "coupon rate", "Gave the coupon rate.", "Solve the price equation."),
        t("VAR_OTHER_UNKNOWN", { eq: (x: X) => sub(bondPrice(c, C, sub(pow(add(1, x), 0.5), 1), 2 * n), P), lo: 0.0001, hi: 0.6 }, "annual effective yield", "Gave the annual effective yield.", "Give the rate convertible semiannually."),
        t("COMP_PERIODS_AS_YEARS", eq({ annual: true }), "annual coupons", "Solved as an annual-coupon bond.", "Coupons are semiannual."),
        t("RATE_ANNUAL_FOR_PERIODIC", { eq: (x: X) => sub(bondPrice(c, C, x, 2 * n), P), lo: 0.0001, hi: 0.6 }, "yield per half-year", "Gave the yield per half-year.", "Double it."),
      ],
      steps: [step("E.price", "Price equation.", ["P", P, "price"], ["c", "C"], { derived: true }), step("M.root-finding", "Solve for the yield.", ["y", yTrue, "yield"], ["P"], { rearranged: true })],
      methods: ["numerical_root"],
      reasoning: "Solve the price equation per half-year (calculator), then double.",
      intuition: "Price below C means yield above the coupon rate (and vice versa).",
      unknown: ["$y$", "yield"],
      relationships: ["$P = c\\,a_{\\overline{2n|}} + Cv^{2n}$"],
      valuationDate: "Time 0",
      principle: "A yield equates the price and the discounted cash flows.",
      misread: "Using the current yield.",
      presentation: ["unknown-rate", "frequency"],
      params: { kase, F, C, r, n, P },
      route: "price equation, solve",
    });
  },
};

// ===================================================================== BONDS 2: book value, amortisation, interest earned

const bondBV: QuestionTemplate = {
  id: "std-bond-book-value",
  family: "std-bond-book-value",
  topic: "BONDS",
  levels: [1],
  objective: "BONDS.book_market",
  secondary: ["BONDS.amortization", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "valuation_dates", "arithmetic"],
  soaConcept: "Amortisation of a bond bought at a premium: book value, the write-down in a coupon, and the interest earned in a coupon.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const F = pick(rng, [1000, 5000, 10000]);
    const r = gridRate(rng, 0.05, 0.12, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.02, 0.09, 0.0025), (x) => r - x >= 0.01);
    const n = 2 * rng.int(5, 15);
    const j = y / 2;
    const c = (F * r) / 2;
    const tt = rng.int(2, n - 2);
    const bv = (k: number, jj: number | X = j) => bondPrice(c, F, jj, n - k);
    const kase = pick(rng, ["book-value", "write-down", "interest"]);
    const stem0 = `${name} buys a ${n / 2}-year bond with par value ${amt(F)} and coupons at a nominal annual rate of ${pct(r)} convertible semiannually, to yield ${pct(y)} convertible semiannually.`;
    const explicitBV = (k: number) => add(flows(n - k, (q) => mul(c, vt(j, q + 1))), mul(F, vt(j, n - k)));
    if (kase === "book-value") {
      const ans = bv(tt);
      const P = bv(0);
      return std({
        stem: `${stem0} Calculate the book value immediately after the ${ord(tt)} coupon.`,
        fmt: MONEY2,
        answer: ans,
        model: explicitBV(tt),
        modelDescription: "Remaining coupons and redemption discounted.",
        traps: [
          t("TIMING_BALANCE_INDEX", bv(tt - 1), "one coupon earlier", `Used the book value after coupon ${tt - 1}.`, `After coupon ${tt}, ${n - tt} coupons remain.`),
          t("MODEL_STRAIGHT_LINE", sub(P, mul(div(sub(P, F), n), tt)), "straight-line amortisation", "Amortised the premium in equal amounts.", "Amortisation is at the yield rate."),
          t("CONC_BOOK_MARKET_CONFUSION", bv(tt, r / 2), "valued at the coupon rate", "Discounted at the coupon rate.", "Book value uses the purchase yield."),
          t("VAR_FACE_FOR_PRICE", K(F), "par value", "Gave the par value.", "Book value approaches par only at maturity."),
          t("RATE_ANNUAL_FOR_PERIODIC", bv(tt, y), "annual yield per half-year", "Used the annual yield per half-year.", `Use ${pct(j)}.`),
          t("TIMING_EXTRA_PERIOD", bv(tt + 1), "one coupon later", `Used the book value after coupon ${tt + 1}.`, `After coupon ${tt}, ${n - tt} coupons remain.`),
        ],
        steps: [step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]), step("E.book-value", "Remaining cash flows at the yield.", ["BV", ans.v, "book value"], ["c", "F", "j"])],
        methods: ["valuation_dates"],
        reasoning: "Book value = price of the remaining coupons and redemption at the purchase yield.",
        intuition: "Look forward at what is left.",
        unknown: ["$BV_t$", "book value"],
        relationships: ["$BV_t = c\\,a_{\\overline{n-t|}} + Fv^{n-t}$"],
        valuationDate: `Coupon ${tt}`,
        principle: "Book value is the prospective value at the purchase yield.",
        misread: "Straight-line amortisation.",
        presentation: ["valuation-date"],
        params: { kase, F, r, y, n, tt },
        route: "period yield, book value",
      });
    }
    if (kase === "write-down") {
      const ans = mul(c - F * j, vt(j, n - tt + 1));
      return std({
        stem: `${stem0} Calculate the amount by which the book value is written down with the ${ord(tt)} coupon.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(c, mul(j, explicitBV(tt - 1))),
        modelDescription: "Coupon less interest earned on the previous book value.",
        traps: [
          t("TIMING_BALANCE_INDEX", mul(c - F * j, vt(j, n - tt)), "power one short", `Used $v^{${n - tt}}$.`, `Use $v^{n-t+1}$.`),
          t("VAR_INTEREST_FOR_PRINCIPAL", mul(j, bv(tt - 1)), "interest earned", "Gave the interest earned.", "Write-down = coupon − interest earned."),
          t("MODEL_STRAIGHT_LINE", div(sub(bv(0), F), n), "straight line", "Divided the premium equally.", "Write-downs grow geometrically."),
          t("CONC_LOAN_SCHEDULE_REVERSED", mul(c - F * j, vt(j, tt)), "schedule reversed", `Used $v^{${tt}}$.`, "Early write-downs are the smallest."),
        ],
        steps: [step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]), step("E.bond-amortization", "Write-down.", ["PA_t", ans.v, "write-down"], ["c", "F", "j"])],
        methods: ["substitution"],
        reasoning: "Write-down in coupon t = (Fr − Fj)v^{n−t+1}.",
        intuition: "Premium amortisation grows like loan principal.",
        unknown: ["$PA_t$", "write-down"],
        relationships: ["$PA_t = (Fr - Cj)v^{n-t+1}$"],
        valuationDate: `Coupon ${tt}`,
        principle: "Bond amortisation mirrors a loan schedule.",
        misread: "Straight-line amortisation.",
        presentation: ["direct"],
        params: { kase, F, r, y, n, tt },
        route: "period yield, write-down",
      });
    }
    const ans = mul(j, bv(tt - 1));
    return std({
      stem: `${stem0} Calculate the interest earned in the ${ord(tt)} coupon period on the book-value basis.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(j, explicitBV(tt - 1)),
      modelDescription: "Yield times the previous book value (written out).",
      traps: [
        t("CONC_BOND_COUPON_AS_INTEREST", K(c), "coupon", "Gave the coupon.", "Interest earned = yield × book value."),
        t("VAR_INTEREST_FOR_PRINCIPAL", mul(c - F * j, vt(j, n - tt + 1)), "write-down", "Gave the write-down.", "Interest earned = coupon − write-down."),
        t("TIMING_BALANCE_INDEX", mul(j, bv(tt)), "book value after the coupon", `Used the book value after coupon ${tt}.`, `Use the book value after coupon ${tt - 1}.`),
        t("MODEL_INTEREST_ON_ORIGINAL", mul(j, bv(0)), "interest on the price", "Charged the yield on the purchase price.", "Book value falls over time."),
      ],
      steps: [step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]), step("E.book-value", "Previous book value.", ["BV", bv(tt - 1).v, "previous book value"], ["c", "F"]), step("D.interest-component", "Interest earned.", ["I", ans.v, "interest earned"], ["BV", "j"])],
      methods: ["substitution"],
      reasoning: "Interest earned = j × book value after the previous coupon.",
      intuition: "The investor earns the yield on what is invested.",
      unknown: ["$I_t$", "interest earned"],
      relationships: ["$I_t = j\\,BV_{t-1}$"],
      valuationDate: `Coupon ${tt - 1}`,
      principle: "Interest earned is yield × book value.",
      misread: "Taking the coupon as interest earned.",
      presentation: ["valuation-date"],
      params: { kase, F, r, y, n, tt },
      route: "period yield, book value, interest",
    });
  },
};

// ===================================================================== BONDS 3: coupon rate, redemption value, term

const bondSolve: QuestionTemplate = {
  id: "std-bond-solve",
  family: "std-bond-solve",
  topic: "BONDS",
  levels: [1],
  objective: "BONDS.terms",
  secondary: ["BONDS.coupons", "BONDS.price_redemption"],
  reasoning: ["algebra", "formula_selection", "translation"],
  soaConcept: "Solving the bond price formula for a missing term: the coupon rate, the redemption value or the term.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const F = pick(rng, [1000, 5000, 10000]);
    const y = gridRate(rng, 0.03, 0.09, 0.0025);
    const j = y / 2;
    const kase = pick(rng, ["coupon-rate", "redemption", "term"]);
    if (kase === "coupon-rate") {
      const n = rng.int(5, 20);
      const rTrue = drawUntil(() => gridRate(rng, 0.03, 0.12, 0.005), (x) => Math.abs(x - y) >= 0.01);
      const P = Math.round(bondPrice((F * rTrue) / 2, F, j, 2 * n).v * 100) / 100;
      const ans = mul(2, add(j, div((P - F) / F, an(j, 2 * n))));
      return std({
        stem: `${name} buys a ${n}-year par-value ${amt(F)} bond with semiannual coupons, redeemable at par, for ${amt(P)}, to yield ${pct(y)} convertible semiannually. Calculate its nominal annual coupon rate.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(add(flows(2 * n, (q) => mul(mul(F, div(x, 2)), vt(j, q + 1))), mul(F, vt(j, 2 * n))), P), lo: 0, hi: 0.5 },
        modelDescription: "Price equation with the unknown coupon written out.",
        traps: [
          t("CONC_BOND_YIELD_IS_COUPON_RATE", K(y), "yield", "Gave the yield.", "The bond is not at par."),
          t("RATE_ANNUAL_FOR_PERIODIC", add(j, div((P - F) / F, an(j, 2 * n))), "rate per half-year", "Gave the coupon rate per half-year.", "Double it."),
          t("SEQ_UNDISCOUNTED_SUM", K(y + (P - F) / (F * n)), "premium spread evenly", "Spread the premium evenly over the years.", "Use the annuity factor."),
          t("COMP_PERIODS_AS_YEARS", add(y, div((P - F) / F, an(y, n))), "annual periods", "Worked in years.", "Coupons are semiannual."),
          t("ALG_SIGN_ERROR", mul(2, sub(j, div((P - F) / F, an(j, 2 * n)))), "sign slip", "Subtracted the premium term.", "A premium means a coupon above the yield."),
          t("FORMULA_CURRENT_YIELD", K((y * P) / F), "yield scaled by price", "Took yield × price / face.", "Solve the price equation."),
        ],
        steps: [step("E.premium-discount", "Premium = (Fr − Fj)a.", ["P - F", P - F, "premium"], ["P", "F"]), step("E.price", "Coupon rate per half-year.", ["r/2", ans.v / 2, "coupon rate per half-year"], ["j"], { rearranged: true }), step("A.nominal-equivalence", "Nominal coupon rate.", ["r", ans.v, "coupon rate"], ["r/2"])],
        methods: ["rearrangement"],
        reasoning: "From P − F = F(r/2 − j)a(2n), solve for r.",
        intuition: "The premium is the value of the coupons' excess over the yield.",
        unknown: ["$r$", "coupon rate"],
        relationships: ["$P - F = F(r/2 - j)a_{\\overline{2n|}j}$"],
        valuationDate: "Time 0",
        principle: "The premium/discount formula solves cleanly for the coupon.",
        misread: "Giving the yield.",
        presentation: ["inverse"],
        params: { kase, F, y, n, P },
        route: "premium, coupon rate",
      });
    }
    if (kase === "redemption") {
      const n = rng.int(5, 20);
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const c = (F * r) / 2;
      const Ctrue = F * pick(rng, [1.02, 1.05, 1.08, 1.1, 1.15]);
      const P = Math.round(bondPrice(c, Ctrue, j, 2 * n).v * 100) / 100;
      const ans = div(sub(P, mul(c, an(j, 2 * n))), vt(j, 2 * n));
      return std({
        stem: `A ${n}-year bond with face amount ${amt(F)} pays coupons at a nominal annual rate of ${pct(r)} convertible semiannually and sells for ${amt(P)} to yield ${pct(y)} convertible semiannually. Calculate the redemption value.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(add(flows(2 * n, (q) => mul(c, vt(j, q + 1))), mul(x, vt(j, 2 * n))), P), lo: 1, hi: F * 5 },
        modelDescription: "Price equation with the unknown redemption value.",
        traps: [
          t("TIMING_IGNORED_DEFERRAL", sub(P, mul(c, an(j, 2 * n))), "not accumulated", "Stopped at price minus coupons' value.", "That is the redemption's present value: accumulate it."),
          t("MODEL_IGNORED_COUPON", div(P, vt(j, 2 * n)), "coupons ignored", "Accumulated the whole price.", "Subtract the coupons' value first."),
          t("COMP_PERIODS_AS_YEARS", div(sub(P, mul(2 * c, an(y, n))), vt(y, n)), "annual periods", "Worked in years.", "Coupons are semiannual."),
          t("VAR_FACE_FOR_PRICE", K(F), "face amount", "Assumed redemption at face.", "Solve the price equation."),
          t("TIMING_EXTRA_PERIOD", mul(ans, 1 + j), "a half-year too many", "Accumulated one extra half-year.", `Accumulate ${2 * n} half-years.`),
          t("RATE_ANNUAL_FOR_PERIODIC", div(sub(P, mul(c, an(y, 2 * n))), vt(y, 2 * n)), "annual yield per half-year", "Used the annual yield per half-year.", `Use ${pct(j)}.`),
        ],
        steps: [step("B.annuity-immediate", "Value of the coupons.", ["c a", mul(c, an(j, 2 * n)).v, "value of coupons"], ["c", "j"]), step("E.price", "Redemption value.", ["C", ans.v, "redemption value"], ["P"], { rearranged: true })],
        methods: ["rearrangement"],
        reasoning: "C = (P − c·a)/v^n.",
        intuition: "What the coupons do not explain is the redemption's present value.",
        unknown: ["$C$", "redemption value"],
        relationships: ["$P = c\\,a_{\\overline{2n|}} + Cv^{2n}$"],
        valuationDate: `Year ${n}`,
        principle: "Solve the price formula for the redemption value.",
        misread: "Forgetting to accumulate.",
        presentation: ["inverse"],
        params: { kase, F, y, n, r, P },
        route: "coupons, redemption",
      });
    }
    const r = drawUntil(() => gridRate(rng, 0.03, 0.12, 0.005), (x) => x - y >= 0.01);
    const c = (F * r) / 2;
    const nTrue = rng.int(5, 20);
    const P = Math.round(bondPrice(c, F, j, 2 * nTrue).v * 100) / 100;
    const aNeeded = (P - F) / (c - F * j);
    const periods = (o: { force?: boolean; sign?: number } = {}) => div(mul(-1, ln(1 + (o.sign ?? -1) * j * aNeeded)), o.force ? j : ln(1 + j));
    const ans = div(periods(), 2);
    return std({
      stem: `A par-value ${amt(F)} bond with coupons at a nominal annual rate of ${pct(r)} convertible semiannually, redeemable at par, sells for ${amt(P)} to yield ${pct(y)} convertible semiannually. Calculate its term in years.`,
      fmt: YEARS2,
      answer: ans,
      model: { eq: (x: X) => sub(add(mul(c, div(sub(1, pow(1 + j, mul(-2, x))), j)), mul(F, pow(1 + j, mul(-2, x)))), P), lo: 0.5, hi: 100 },
      modelDescription: "Price equation in the unknown number of years.",
      traps: [
        t("COMP_PERIODS_AS_YEARS", periods(), "number of coupons", "Gave the number of coupon periods.", "Divide by 2 for years."),
        t("RATE_FORCE_AS_EFFECTIVE", div(periods({ force: true }), 2), "divided by j", "Divided by j instead of ln(1 + j).", "Take logarithms properly."),
        t("ALG_SIGN_ERROR", div(div(ln(1 + j * aNeeded), ln(1 + j)), 2), "sign slip", "Used $\\ln(1 + j\\,a)$.", "$v^n = 1 - j\\,a$."),
        t("SEQ_UNDISCOUNTED_SUM", K(aNeeded / 2), "premium over excess coupon", "Divided the premium by the excess coupon.", "That ignores discounting."),
      ],
      steps: [step("E.premium-discount", "Annuity factor from the premium.", ["a_n", aNeeded, "annuity factor"], ["P", "c", "F", "j"], { rearranged: true }), step("M.logarithm", "Number of coupons.", ["n", periods().v, "coupons"], ["a_n"], { rearranged: true }), step("B.counting", "Years.", ["n/2", ans.v, "term in years"], ["n"])],
      methods: ["logarithms", "rearrangement"],
      reasoning: "Premium = (Fr − Fj)a(n): solve for a(n), then n by logarithms, then halve.",
      intuition: "The premium tells you how many excess coupons there are.",
      unknown: ["$n$", "term"],
      relationships: ["$P - F = (c - Fj)a_{\\overline{n|}j}$"],
      valuationDate: "Time 0",
      principle: "An unknown term is found with logarithms.",
      misread: "Giving the number of coupons.",
      presentation: ["unknown-time"],
      params: { kase, F, y, r, P },
      route: "factor, logarithm, years",
    });
  },
};

// ===================================================================== BONDS 4: callable at par

const bondCall: QuestionTemplate = {
  id: "std-bond-callable",
  family: "std-bond-callable",
  topic: "BONDS",
  levels: [1],
  objective: "BONDS.callable",
  secondary: ["BONDS.price_redemption", "BONDS.yield"],
  reasoning: ["financial_intuition", "valuation_dates", "arithmetic"],
  soaConcept: "A bond callable at par: premium bonds are priced to the earliest call date, discount bonds to maturity; the yield to call from a price.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const F = pick(rng, [1000, 5000, 10000]);
    const N = rng.int(12, 25);
    const a = rng.int(4, N - 6);
    const b = rng.int(a + 2, N - 2);
    const kase = pick(rng, ["premium", "discount", "yield-to-call"]);
    const stem0 = (r: number) => `A ${N}-year bond with par value ${amt(F)} pays coupons at a nominal annual rate of ${pct(r)} convertible semiannually. It is callable at par on any coupon date from the end of year ${a} to the end of year ${b}, and otherwise redeemed at par at the end of year ${N}.`;
    if (kase === "premium" || kase === "discount") {
      const r = gridRate(rng, 0.04, 0.1, 0.005);
      const y = kase === "premium" ? drawUntil(() => gridRate(rng, 0.02, 0.09, 0.0025), (x) => r - x >= 0.01) : drawUntil(() => gridRate(rng, 0.05, 0.13, 0.0025), (x) => x - r >= 0.01);
      const c = (F * r) / 2;
      const j = y / 2;
      const at2 = (years: number) => bondPrice(c, F, j, 2 * years);
      const ans = kase === "premium" ? at2(a) : at2(N);
      const avg = div(add(at2(a), at2(b), at2(N)), 3);
      return std({
        stem: `${stem0(r)} Calculate the maximum price ${name} can pay and be certain of a yield of ${pct(y)} convertible semiannually.`,
        fmt: MONEY2,
        answer: ans,
        model: add(flows(2 * (kase === "premium" ? a : N), (q) => mul(c, vt(j, q + 1))), mul(F, vt(j, 2 * (kase === "premium" ? a : N)))),
        modelDescription: "Coupons and redemption to the worst-case date, discounted.",
        traps: [
          t(kase === "premium" ? "CONC_BOND_CALL_IGNORED" : "MODEL_WRONG_CALL_DATE", kase === "premium" ? at2(N) : at2(a), kase === "premium" ? "priced to maturity" : "priced to the first call", kase === "premium" ? "Priced to maturity." : `Priced to year ${a}.`, kase === "premium" ? "A premium bond is worst for the investor if called early." : "A discount bond is worst for the investor if redeemed late."),
          t("TIMING_VALUATION_DATE", at2(b), "priced to the last call date", `Priced to year ${b}.`, kase === "premium" ? `The earliest date (year ${a}) is the worst case.` : `Maturity (year ${N}) is the worst case.`),
          t("CONC_BOND_CALL_AVERAGE", avg, "average of prices", "Averaged prices at several dates.", "Take the lowest price."),
          t("COMP_PERIODS_AS_YEARS", bondPrice(2 * c, F, y, kase === "premium" ? a : N), "annual periods", "Worked in years.", "Coupons are semiannual."),
          t("CONC_IGNORED_REDEMPTION", mul(c, an(j, 2 * (kase === "premium" ? a : N))), "redemption left out", "Left out the redemption.", "Add the discounted par value."),
          t("CONC_BOND_YIELD_IS_COUPON_RATE", K(F), "priced at the coupon rate", "Discounted at the coupon rate (giving par).", "Discount at the required yield."),
        ],
        steps: [step("E.premium-discount", "Premium or discount: compare the coupon rate with the yield.", ["r - y", r - y, "coupon rate minus yield"], ["r", "y"]), step("E.callable", "Worst-case redemption date.", ["T", kase === "premium" ? a : N, "worst-case year"], ["r - y"]), step("E.price", "Price to that date.", ["P", ans.v, "maximum price"], ["c", "j"])],
        methods: ["valuation_dates"],
        reasoning: kase === "premium" ? "Coupon rate above the yield: premium, so assume the earliest call." : "Coupon rate below the yield: discount, so assume the latest redemption.",
        intuition: "The issuer calls when that hurts the investor.",
        unknown: ["$P$", "maximum price"],
        relationships: ["$P = \\min_T [c\\,a_{\\overline{2T|}} + Fv^{2T}]$"],
        valuationDate: "Time 0",
        principle: "Premium → earliest call; discount → latest.",
        misread: "Ignoring the call.",
        presentation: ["valuation-date", "frequency"],
        params: { kase, F, N, a, b, r, y },
        route: "premium test, worst date, price",
      });
    }
    const r = gridRate(rng, 0.06, 0.12, 0.005);
    const c = (F * r) / 2;
    const yTrue = drawUntil(() => gridRate(rng, 0.02, 0.09, 0.0025), (x) => r - x >= 0.015);
    const P = Math.round(bondPrice(c, F, yTrue / 2, 2 * a).v * 100) / 100;
    const ytc = (years: number): Eq => ({ eq: (x: X) => sub(bondPrice(c, F, div(x, 2), 2 * years), P), lo: 0.0005, hi: 0.6 });
    return std({
      stem: `${stem0(r)} ${name} buys it for ${amt(P)}. Calculate the yield, convertible semiannually, if the bond is called at the first possible date.`,
      fmt: PCT3,
      answer: ytc(a),
      model: { eq: (x: X) => sub(add(flows(2 * a, (q) => mul(c, pow(add(1, div(x, 2)), -(q + 1)))), mul(F, pow(add(1, div(x, 2)), -2 * a))), P), lo: 0.0005, hi: 0.6 },
      modelDescription: "Price equation to the first call date.",
      traps: [
        t("CONC_BOND_CALL_IGNORED", ytc(N), "yield to maturity", "Computed the yield to maturity.", `The bond is called at year ${a}.`),
        t("FORMULA_CURRENT_YIELD", K((2 * c) / P), "current yield", "Gave the current yield.", "Include the loss of the premium."),
        t("CONC_BOND_YIELD_IS_COUPON_RATE", K(r), "coupon rate", "Gave the coupon rate.", "Solve the price equation."),
        t("MODEL_WRONG_CALL_DATE", ytc(b), "yield to the last call date", `Used year ${b}.`, `The first call date is year ${a}.`),
      ],
      steps: [step("E.callable", "Redemption at the first call date.", ["T", a, "call year"], []), step("E.price", "Price equation to that date.", ["P", P, "price"], ["c", "F"], { derived: true }), step("M.root-finding", "Solve for the yield.", ["y", yTrue, "yield to call"], ["P"], { rearranged: true })],
      methods: ["numerical_root"],
      reasoning: "Solve the price equation with redemption at the first call date.",
      intuition: "An early call cuts the premium's recovery period short.",
      unknown: ["$y$", "yield to call"],
      relationships: [`$P = c\\,a_{\\overline{${2 * a}|}} + Fv^{${2 * a}}$`],
      valuationDate: "Time 0",
      principle: "Yield to call uses the call date and call price.",
      misread: "Using the yield to maturity.",
      presentation: ["unknown-rate", "valuation-date"],
      params: { kase, F, N, a, b, r, P },
      route: "call date, price equation, solve",
    });
  },
};

// ===================================================================== BONDS 5: reinvestment

const bondReinvest: QuestionTemplate = {
  id: "std-bond-reinvest",
  family: "std-bond-reinvest",
  topic: "BONDS",
  levels: [1],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.yield", "ALM.rates_of_return"],
  reasoning: ["cashflow_modelling", "valuation_dates", "arithmetic"],
  soaConcept: "Coupons reinvested at a different rate: the accumulated value at maturity, the realised yield, and the total interest earned.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const F = pick(rng, [1000, 5000, 10000]);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const y = gridRate(rng, 0.03, 0.09, 0.0025);
    const k = drawUntil(() => gridRate(rng, 0.02, 0.07, 0.0025), (x) => Math.abs(x - y) >= 0.01);
    const n = rng.int(5, 20);
    const c = (F * r) / 2;
    const P = bondPrice(c, F, y / 2, 2 * n);
    const AV = (rate: number, reinvest = true) => add(reinvest ? mul(c, sn(rate / 2, 2 * n)) : K(2 * n * c), F);
    const kase = pick(rng, ["accumulated", "realised", "interest"]);
    const stem0 = `${name} buys an ${n}-year par-value ${amt(F)} bond with coupons at a nominal annual rate of ${pct(r)} convertible semiannually, at a price to yield ${pct(y)} convertible semiannually, and holds it to maturity. Coupons are reinvested at a nominal annual rate of ${pct(k)} convertible semiannually.`;
    const explicitAV = add(flows(2 * n, (q) => mul(c, at(k / 2, 2 * n - q - 1))), F);
    if (kase === "accumulated") {
      const ans = AV(k);
      return std({
        stem: `${stem0} Calculate the total accumulated value at maturity.`,
        fmt: MONEY2,
        answer: ans,
        model: explicitAV,
        modelDescription: "Each coupon accumulated, plus the redemption.",
        traps: [
          t("MODEL_REINVEST_AT_YIELD", AV(y), "reinvested at the yield", `Reinvested at ${pct(y)}.`, `Coupons earn ${pct(k)}.`),
          t("CONC_BOND_COUPONS_NOT_REINVESTED", AV(k, false), "coupons not reinvested", "Added the coupons.", "Coupons earn interest."),
          t("CONC_IGNORED_REDEMPTION", mul(c, sn(k / 2, 2 * n)), "redemption left out", "Left out the redemption.", "Add the par value."),
          t("COMP_PERIODS_AS_YEARS", add(mul(2 * c, sn(k, n)), F), "annual periods", "Worked in years.", "Coupons are semiannual."),
        ],
        steps: [step("C.reinvestment", "Accumulated coupons.", ["S", mul(c, sn(k / 2, 2 * n)).v, "accumulated coupons"], ["c", "k"]), step("A.equation-of-value", "Plus redemption.", ["AV", ans.v, "accumulated value"], ["S", "F"])],
        methods: ["valuation_dates"],
        reasoning: "Accumulate the coupons at the reinvestment rate and add the redemption.",
        intuition: "The purchase yield plays no part in the accumulation.",
        unknown: ["$AV$", "accumulated value"],
        relationships: ["$AV = c\\,s_{\\overline{2n|}k/2} + F$"],
        valuationDate: `Year ${n}`,
        principle: "Coupons accumulate at the reinvestment rate.",
        misread: "Reinvesting at the purchase yield.",
        presentation: ["valuation-date", "irrelevant-info"],
        params: { kase, F, r, y, k, n },
        route: "reinvest, add",
      });
    }
    if (kase === "realised") {
      const ans = sub(pow(div(AV(k), P), 1 / n), 1);
      return std({
        stem: `${stem0} Calculate ${name}'s annual effective yield over the ${n} years.`,
        fmt: PCT3,
        answer: ans,
        model: sub(pow(div(explicitAV, add(flows(2 * n, (q) => mul(c, vt(y / 2, q + 1))), mul(F, vt(y / 2, 2 * n)))), 1 / n), 1),
        modelDescription: "Accumulated value over price, written out, then the n-th root.",
        traps: [
          t("CONC_BOND_REALIZED_EQUALS_YIELD", K(Math.pow(1 + y / 2, 2) - 1), "purchase yield", "Gave the purchase yield.", "Reinvestment at a different rate changes the yield."),
          t("CONC_BOND_COUPONS_NOT_REINVESTED", sub(pow(div(AV(k, false), P), 1 / n), 1), "coupons not reinvested", "Added the coupons without interest.", "Coupons earn interest."),
          t("VAR_OTHER_UNKNOWN", mul(2, sub(pow(div(AV(k), P), 1 / (2 * n)), 1)), "nominal semiannual", "Gave the nominal rate convertible semiannually.", "Give the annual effective rate."),
          t("CONC_RETURN_ON_WRONG_BASE", div(sub(div(AV(k), P), 1), n), "simple average", "Divided the total return by the years.", "Compound: take the n-th root."),
        ],
        steps: [step("E.price", "Price.", ["P", P.v, "price"], ["c", "F", "y"]), step("C.reinvestment", "Accumulated value.", ["AV", AV(k).v, "accumulated value"], ["c", "k"]), step("C.yield-rate", "Annual yield.", ["i", ans.v, "annual yield"], ["AV", "P"], { rearranged: true })],
        methods: ["rearrangement", "valuation_dates"],
        reasoning: "Price at the yield; accumulate at the reinvestment rate; (AV/P)^{1/n} − 1.",
        intuition: "The realised yield blends the purchase yield and the reinvestment rate.",
        unknown: ["$i$", "realised yield"],
        relationships: ["$P(1+i)^n = AV$"],
        valuationDate: `Year ${n}`,
        principle: "Realised yield depends on reinvestment.",
        misread: "Giving the purchase yield.",
        presentation: ["valuation-date"],
        params: { kase, F, r, y, k, n },
        route: "price, reinvest, yield",
      });
    }
    const ans = sub(AV(k), P);
    return std({
      stem: `${stem0} Calculate the total interest earned over the ${n} years (coupons, interest on reinvested coupons, and any redemption gain or loss).`,
      fmt: MONEY2,
      answer: ans,
      model: sub(explicitAV, add(flows(2 * n, (q) => mul(c, vt(y / 2, q + 1))), mul(F, vt(y / 2, 2 * n)))),
      modelDescription: "Accumulated value less the price, both written out.",
      traps: [
        t("CONC_BOND_COUPON_AS_INTEREST", K(2 * n * c), "coupons only", "Added the coupons.", "Include reinvestment interest and the redemption gain or loss."),
        t("VAR_TOTAL_FOR_COMPONENT", AV(k), "accumulated value", "Gave the accumulated value.", "Subtract the price."),
        t("CONC_BOND_COUPONS_NOT_REINVESTED", sub(AV(k, false), P), "coupons not reinvested", "Left out the reinvestment interest.", "Coupons earn interest."),
        t("MODEL_REINVEST_AT_YIELD", sub(AV(y), P), "reinvested at the yield", `Reinvested at ${pct(y)}.`, `Use ${pct(k)}.`),
      ],
      steps: [step("E.price", "Price.", ["P", P.v, "price"], ["c", "F", "y"]), step("C.reinvestment", "Accumulated value.", ["AV", AV(k).v, "accumulated value"], ["c", "k"]), step("A.equation-of-value", "Interest earned.", ["I", ans.v, "interest earned"], ["AV", "P"])],
      methods: ["decomposition"],
      reasoning: "Total interest = accumulated value − price.",
      intuition: "Everything gained over what was paid.",
      unknown: ["$I$", "total interest"],
      relationships: ["$I = AV - P$"],
      valuationDate: `Year ${n}`,
      principle: "Total return = ending value − initial outlay.",
      misread: "Counting only the coupons.",
      presentation: ["valuation-date"],
      params: { kase, F, r, y, k, n },
      route: "price, reinvest, difference",
    });
  },
};

// ===================================================================== ALM 1: NPV and IRR

const npvIrr: QuestionTemplate = {
  id: "std-alm-npv",
  family: "std-alm-npv",
  topic: "ALM",
  levels: [1],
  objective: "ALM.rates_of_return",
  secondary: ["TVM.equation_of_value", "ANNUITIES.immediate_due"],
  reasoning: ["cashflow_modelling", "algebra", "arithmetic"],
  soaConcept: "Net present value of a project, its IRR when it lasts two periods, and NPV with deferred level income.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const I = gridAmount(rng, 10000, 100000, 1000);
    const kase = pick(rng, ["npv", "irr", "deferred"]);
    if (kase === "npv") {
      const i4 = gridRate(rng, 0.04, 0.12, 0.0025);
      const i = Math.pow(1 + i4 / 4, 4) - 1;
      const R = [0, gridAmount(rng, Math.round(I * 0.2), Math.round(I * 0.5), 100), gridAmount(rng, Math.round(I * 0.2), Math.round(I * 0.5), 100), gridAmount(rng, Math.round(I * 0.2), Math.round(I * 0.6), 100)];
      const npv = (rate: number, shift = 0) => sub(sum([1, 2, 3].map((tt) => mul(R[tt], vt(rate, tt + shift)))), I);
      const ans = npv(i);
      return std({
        stem: `${name}'s project costs ${amt(I)} today and returns ${amt(R[1])}, ${amt(R[2])} and ${amt(R[3])} at the ends of years 1, 2 and 3. At a nominal annual rate of ${pct(i4)} convertible quarterly, calculate the net present value.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(sum([1, 2, 3].map((tt) => mul(R[tt], pow(1 + i4 / 4, -4 * tt)))), I),
        modelDescription: "Each return discounted quarter by quarter.",
        traps: [
          t("RATE_NOMINAL_AS_EFFECTIVE", npv(i4), "nominal rate used as effective", `Discounted at ${pct(i4)} effective.`, "Convert the quarterly rate."),
          t("SEQ_UNDISCOUNTED_SUM", K(R[1] + R[2] + R[3] - I), "undiscounted", "Added the cash flows.", "Discount each return."),
          t("TIMING_EXTRA_PERIOD", npv(i, 1), "each return a year late", "Discounted each return one extra year.", "Returns are at the ends of years 1–3."),
          t("TIMING_IMMEDIATE_AS_DUE", npv(i, -1), "returns at year starts", "Discounted each return one year too few.", "Returns are at year ends."),
          t("FORMULA_AV_FOR_PV", mul(npv(i), pow(1 + i, 3)), "value at year 3", "Accumulated the NPV to year 3.", "NPV is measured today."),
        ],
        steps: [step("A.nominal-equivalence", "Annual effective rate.", ["i", i, "annual effective rate"], ["i^(4)"]), step("C.npv", "NPV.", ["NPV", ans.v, "net present value"], ["R", "I", "i"])],
        methods: ["substitution"],
        reasoning: "Convert the rate, discount the returns, subtract the cost.",
        intuition: "NPV is value created at the cost of capital.",
        unknown: ["$NPV$", "net present value"],
        relationships: ["$NPV = \\sum R_t v^t - I$"],
        valuationDate: "Time 0",
        principle: "Discount each cash flow at the cost of capital.",
        misread: "Using the nominal rate as effective.",
        presentation: ["frequency"],
        params: { kase, I, i4 },
        route: "convert, NPV",
      });
    }
    if (kase === "irr") {
      const iTrue = gridRate(rng, 0.04, 0.2, 0.0025);
      const R1 = gridAmount(rng, Math.round(I * 0.2), Math.round(I * 0.6), 100);
      const R2 = Math.round((I * Math.pow(1 + iTrue, 2) - R1 * (1 + iTrue)) * 100) / 100;
      if (R2 <= 0) throw new Error("Negative second return.");
      const irr = (div2 = 2) => sub(div(1, div(add(-R1, pow(R1 * R1 + 4 * I * R2, 0.5)), div2 * R2)), 1);
      const ans = irr();
      return std({
        stem: `${name}'s project costs ${amt(I)} today and returns ${amt(R1)} at the end of year 1 and ${amt(R2)} at the end of year 2. Calculate the internal rate of return.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(add(mul(R1, pow(add(1, x), -1)), mul(R2, pow(add(1, x), -2))), I), lo: -0.5, hi: 1 },
        modelDescription: "NPV = 0 at the unknown rate.",
        traps: [
          t("CONC_RETURN_ON_WRONG_BASE", K((R1 + R2 - I) / I / 2), "simple average return", "Divided total profit by cost and years.", "Solve NPV = 0."),
          t("VAR_OTHER_UNKNOWN", K((R1 + R2) / I - 1), "total return", "Gave the total return over two years.", "Give the annual IRR."),
          t("ALG_DIVIDE_ERROR", irr(1), "quadratic formula without the 2", "Divided by $c$ instead of $2c$ in the quadratic formula.", "$v = (-b + \\sqrt{b^2+4ac})/(2a)$."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(R1 / I), "first return over cost", "Took the first return ÷ cost.", "Use both returns in an equation of value."),
          t("RATE_DISCOUNT_AS_INTEREST", sub(1, div(div(add(-R1, pow(R1 * R1 + 4 * I * R2, 0.5)), 2 * R2), 1)), "rate of discount", "Gave 1 − v.", "The IRR is a rate of interest: 1/v − 1."),
        ],
        steps: [step("C.npv", "NPV = 0 is a quadratic in v.", ["I", I, "cost to recover"], ["R", "I"], { derived: true }), step("M.root-finding", "Positive root for v.", ["v", 1 / (1 + iTrue), "discount factor"], ["quadratic"], { rearranged: true }), step("C.irr", "IRR.", ["i", ans.v, "IRR"], ["v"])],
        methods: ["factorisation", "equation_construction"],
        reasoning: "R₂v² + R₁v − I = 0; take the positive root and convert v to i.",
        intuition: "Two periods give a quadratic.",
        unknown: ["$i$", "IRR"],
        relationships: ["$R_2v^2 + R_1v = I$"],
        valuationDate: "Time 0",
        principle: "The IRR makes NPV zero.",
        misread: "Using a simple average return.",
        presentation: ["unknown-rate"],
        params: { kase, I, R1, R2 },
        route: "quadratic, root, rate",
      });
    }
    const i = gridRate(rng, 0.05, 0.12, 0.0025);
    const R = gridAmount(rng, Math.round(I * 0.15), Math.round(I * 0.35), 100);
    const n = rng.int(5, 12);
    const d = rng.int(1, 3);
    const npv = (defer: number) => sub(mul(R, an(i, n), vt(i, defer)), I);
    const ans = npv(d);
    return std({
      stem: `${name}'s project costs ${amt(I)} today and returns ${amt(R)} at the end of each year for ${n} years, the first return at the end of year ${d + 1}. At an annual effective rate of ${pct(i)}, calculate the net present value.`,
      fmt: MONEY2,
      answer: ans,
      model: sub(flows(n, (q) => mul(R, vt(i, d + q + 1))), I),
      modelDescription: "Each return discounted from its date, less the cost.",
      traps: [
        t("TIMING_IGNORED_DEFERRAL", npv(0), "not deferred", "Started the returns at year 1.", `The first return is at year ${d + 1}.`),
        t("TIMING_DEFERRAL_OFF_BY_ONE", npv(d + 1), "deferred a year too long", `Deferred ${d + 1} years.`, `Defer ${d} years.`),
        t("SEQ_UNDISCOUNTED_SUM", K(n * R - I), "undiscounted", "Added the returns.", "Discount them."),
        t("TIMING_IMMEDIATE_AS_DUE", sub(mul(R, adue(i, n), vt(i, d)), I), "annuity-due", "Used an annuity-due from time d.", "Returns are at year ends."),
      ],
      steps: [step("B.annuity-immediate", "Annuity value at time d.", ["R a_n", mul(R, an(i, n)).v, `value at time ${d}`], ["R", "i"]), step("B.deferred", "Discount to today.", ["PV", mul(R, an(i, n), vt(i, d)).v, "value of returns"], ["i"]), step("C.npv", "NPV.", ["NPV", ans.v, "net present value"], ["PV", "I"])],
      methods: ["valuation_dates"],
      reasoning: "Deferred annuity value less the cost.",
      intuition: "Returns start late, so discount them further.",
      unknown: ["$NPV$", "net present value"],
      relationships: [`$NPV = R\\,a_{\\overline{${n}|}}v^{${d}} - I$`],
      valuationDate: "Time 0",
      principle: "Deferred annuities are discounted from one period before the first payment.",
      misread: "Ignoring the deferral.",
      presentation: ["deferred"],
      params: { kase, I, R, n, d, i },
      route: "annuity, defer, NPV",
    });
  },
};

// ===================================================================== ALM 2: duration

const durationT: QuestionTemplate = {
  id: "std-alm-duration",
  family: "std-alm-duration",
  topic: "ALM",
  levels: [1],
  objective: "ALM.duration",
  secondary: ["ALM.approx_pv_change", "ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "arithmetic", "financial_intuition"],
  soaConcept: "Macaulay duration of a few cash flows, modified duration of an annuity, and a first-order estimate of a price change.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const kase = pick(rng, ["macaulay", "modified-annuity", "estimate"]);
    if (kase === "macaulay") {
      const ts = [rng.int(1, 3), rng.int(4, 7), rng.int(8, 15)];
      const cf = ts.map(() => gridAmount(rng, 1000, 20000, 500));
      const pvs = ts.map((tt, k) => mul(cf[k], vt(i, tt)));
      const ans = div(sum(ts.map((tt, k) => mul(tt, pvs[k]))), sum(pvs));
      return std({
        stem: `${name}'s portfolio pays ${amt(cf[0])} at time ${ts[0]}, ${amt(cf[1])} at time ${ts[1]} and ${amt(cf[2])} at time ${ts[2]}. At an annual effective rate of ${pct(i)}, calculate its Macaulay duration.`,
        fmt: PLAIN3,
        answer: ans,
        model: div(sum(ts.map((tt, k) => mul(tt * cf[k], pow(1 + i, -tt)))), sum(ts.map((tt, k) => mul(cf[k], pow(1 + i, -tt))))),
        modelDescription: "Present-value-weighted average time.",
        traps: [
          t("MODEL_UNDISCOUNTED_WEIGHTS", K((ts[0] * cf[0] + ts[1] * cf[1] + ts[2] * cf[2]) / (cf[0] + cf[1] + cf[2])), "undiscounted weights", "Weighted by the cash flows.", "Weight by present values."),
          t("FORMULA_MODIFIED_FOR_MACAULAY", div(ans, 1 + i), "modified duration", "Divided by (1 + i).", "Macaulay duration is not divided by (1 + i)."),
          t("CONC_ALM_DURATION_NOT_NORMALIZED", div(sum(ts.map((tt, k) => mul(tt, pvs[k]))), cf[0] + cf[1] + cf[2]), "divided by undiscounted total", "Divided by the undiscounted total.", "Divide by the present value."),
          t("TIMING_VALUATION_DATE", K((ts[0] + ts[1] + ts[2]) / 3), "average of the times", "Averaged the times.", "Weight by present values."),
        ],
        steps: [step("A.discount-factor", "Present values.", ["PV", sum(pvs).v, "present value"], ["CF", "i"]), step("G.macaulay", "Weighted average time.", ["D", ans.v, "Macaulay duration"], ["PV"])],
        methods: ["decomposition"],
        reasoning: "D = Σ t·PV_t / Σ PV_t.",
        intuition: "Duration is the average time weighted by value.",
        unknown: ["$D$", "Macaulay duration"],
        relationships: ["$D = \\dfrac{\\sum t\\,CF_tv^t}{\\sum CF_tv^t}$"],
        valuationDate: "Time 0",
        principle: "Macaulay duration is a PV-weighted average time.",
        misread: "Weighting by undiscounted cash flows.",
        presentation: ["direct"],
        params: { kase, i, t1: ts[0], t2: ts[1], t3: ts[2] },
        route: "present values, weighted time",
      });
    }
    const n = rng.int(5, 25);
    const D = div(ia(i, n), an(i, n));
    if (kase === "modified-annuity") {
      const ans = div(D, 1 + i);
      return std({
        stem: `Calculate the modified duration of an annuity-immediate paying 1 per year for ${n} years at an annual effective rate of ${pct(i)}.`,
        fmt: PLAIN3,
        answer: ans,
        model: div(div(flows(n, (q) => mul(q + 1, vt(i, q + 1))), flows(n, (q) => vt(i, q + 1))), 1 + i),
        modelDescription: "PV-weighted average time from the payments, divided by (1 + i).",
        traps: [
          t("FORMULA_MODIFIED_FOR_MACAULAY", D, "Macaulay duration", "Gave the Macaulay duration.", "Divide by (1 + i)."),
          t("MODEL_UNDISCOUNTED_WEIGHTS", K((n + 1) / 2 / (1 + i)), "undiscounted average time", "Used the average payment time.", "Weight by present values."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(1 / i), "perpetuity duration", "Used the perpetuity's modified duration.", `The annuity lasts ${n} years.`),
          t("ALG_DIVIDE_ERROR", div(D, (1 + i) ** 2), "divided twice", "Divided by (1 + i)².", "Divide once."),
        ],
        steps: [step("G.duration-special", "Macaulay duration (Ia)/a.", ["D", D.v, "Macaulay duration"], ["i"]), step("G.modified", "Modified duration.", ["D_{mod}", ans.v, "modified duration"], ["D", "i"])],
        methods: ["substitution"],
        reasoning: "Modified duration = (Ia)/(a·(1+i)).",
        intuition: "Modified duration measures price sensitivity to i.",
        unknown: ["$D_{mod}$", "modified duration"],
        relationships: ["$D_{mod} = \\dfrac{(Ia)_{\\overline{n|}}}{a_{\\overline{n|}}(1+i)}$"],
        valuationDate: "Time 0",
        principle: "$D_{mod} = D_{Mac}/(1+i)$.",
        misread: "Giving the Macaulay duration.",
        presentation: ["direct"],
        params: { kase, i, n },
        route: "Macaulay, modified",
      });
    }
    const R = gridAmount(rng, 1000, 10000, 500);
    const P = mul(R, an(i, n));
    const dy = pick(rng, [0.01, 0.015, 0.02, -0.01, -0.015]);
    const ans = mul(P, sub(1, mul(div(D, 1 + i), dy)));
    return std({
      stem: `${name} holds an annuity paying ${amt(R)} at the end of each year for ${n} years, valued at an annual effective rate of ${pct(i)}. The rate changes to ${pct(i + dy)}. Using the first-order modified approximation, estimate the new value.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(flows(n, (q) => mul(R, vt(i, q + 1))), sub(1, mul(div(div(flows(n, (q) => mul(q + 1, vt(i, q + 1))), flows(n, (q) => vt(i, q + 1))), 1 + i), dy))),
      modelDescription: "Value and duration from the payments, then the estimate.",
      traps: [
        t("FORMULA_MODIFIED_FOR_MACAULAY", mul(P, sub(1, mul(D, dy))), "Macaulay used as modified", "Used the Macaulay duration.", "Divide by (1 + i)."),
        t("CONC_DIRECTION_REVERSED", mul(P, add(1, mul(div(D, 1 + i), dy))), "direction reversed", "Moved the value with the rate.", "Value moves opposite to the rate."),
        t("VAR_OTHER_UNKNOWN", P, "original value", "Gave the original value.", "Apply the change."),
        t("CHAL_WRONG_APPROXIMATION", mul(P, pow((1 + i) / (1 + i + dy), D)), "Macaulay approximation", "Used the first-order Macaulay approximation.", "Use the modified approximation."),
        t("CONC_ALM_APPROX_EXACT", mul(R, an(i + dy, n)), "exact value", "Revalued exactly.", "The question asks for the first-order estimate."),
        t("MODEL_UNDISCOUNTED_WEIGHTS", mul(P, sub(1, mul((n + 1) / 2 / (1 + i), dy))), "undiscounted duration", "Used the average payment time as the duration.", "Weight times by present values."),
        t("FORMULA_PERPETUITY_FOR_FINITE", mul(P, sub(1, mul(1 / i, dy))), "perpetuity duration", "Used the perpetuity's modified duration 1/i.", `The annuity lasts ${n} years.`),
      ],
      steps: [step("B.annuity-immediate", "Value.", ["P", P.v, "value"], ["R", "i"]), step("G.duration-special", "Macaulay duration.", ["D", D.v, "Macaulay duration"], ["i"]), step("G.approx-modified", "Estimate.", ["P'", ans.v, "estimated value"], ["P", "D", "\\Delta i"])],
      methods: ["substitution"],
      reasoning: "P(1 − D/(1+i)·Δi).",
      intuition: "Duration converts a rate change into a percentage price change.",
      unknown: ["$P'$", "estimated value"],
      relationships: ["$P' \\approx P(1 - D_{mod}\\Delta i)$"],
      valuationDate: "Time 0",
      principle: "First-order modified approximation.",
      misread: "Using the Macaulay duration.",
      presentation: ["direct"],
      params: { kase, i, n, R, dy },
      route: "value, duration, estimate",
    });
  },
};

// ===================================================================== ALM 3: spot and forward rates

const spotForward: QuestionTemplate = {
  id: "std-alm-spot-forward",
  family: "std-alm-spot-forward",
  topic: "ALM",
  levels: [1],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "arithmetic", "translation"],
  soaConcept: "Forward rates from spot rates, pricing a bond with spot rates, and a spot rate from forward rates.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const s1 = gridRate(rng, 0.02, 0.05, 0.0025);
    const s2 = s1 + gridRate(rng, 0.005, 0.015, 0.0025);
    const s3 = s2 + gridRate(rng, 0.005, 0.015, 0.0025);
    const kase = pick(rng, ["forward", "price", "spot-from-forwards"]);
    if (kase === "forward") {
      const ans = sub(div(pow(1 + s3, 3), pow(1 + s2, 2)), 1);
      return std({
        stem: `Annual effective spot rates are ${pct(s1)} for one year, ${pct(s2)} for two years and ${pct(s3)} for three years. Calculate the one-year forward rate from time 2 to time 3.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(mul(pow(1 + s2, 2), add(1, x)), pow(1 + s3, 3)), lo: -0.1, hi: 0.5 },
        modelDescription: "Investing for 2 years then rolling forward equals investing for 3 years.",
        traps: [
          t("COMP_FORWARD_RATIO_NO_POWERS", sub(div(1 + s3, 1 + s2), 1), "ratio without powers", "Divided (1 + s₃) by (1 + s₂).", "Use the powers 3 and 2."),
          t("FORMULA_ARITHMETIC_FORWARD", K(3 * s3 - 2 * s2), "arithmetic approximation", "Used 3s₃ − 2s₂.", "Compound: divide the accumulation factors."),
          t("CONC_ALM_FORWARD_AS_SPOT", K(s3), "three-year spot", "Gave the 3-year spot rate.", "The forward covers only year 3."),
          t("CONC_ALM_FORWARD_NOT_ANNUALIZED", sub(div(pow(1 + s3, 3), 1 + s1), 1), "two-year forward", "Gave the forward from 1 to 3 as one figure.", "Use years 2 to 3."),
          t("TIMING_VALUATION_DATE", sub(div(pow(1 + s2, 2), 1 + s1), 1), "forward for year 2", "Gave the forward from 1 to 2.", "The question asks for years 2 to 3."),
          t("VAR_OTHER_UNKNOWN", K(s3 - s2), "difference of spot rates", "Subtracted the spot rates.", "Divide accumulation factors."),
        ],
        steps: [step("F.spot", "Accumulation factors.", ["(1+s_3)^3", Math.pow(1 + s3, 3), "3-year factor"], ["s_3"]), step("F.forward", "Forward rate.", ["f", ans.v, "forward rate"], ["s_2", "s_3"])],
        methods: ["substitution"],
        reasoning: "(1 + f) = (1 + s₃)³/(1 + s₂)².",
        intuition: "No arbitrage between 3 years directly and 2 years then 1.",
        unknown: ["$f_{2,3}$", "forward rate"],
        relationships: ["$(1+s_2)^2(1+f) = (1+s_3)^3$"],
        valuationDate: "Time 2",
        principle: "Forward rates link spot rates.",
        misread: "Dropping the powers.",
        presentation: ["direct"],
        params: { kase, s1, s2, s3 },
        route: "factors, forward",
      });
    }
    if (kase === "price") {
      const F = pick(rng, [100, 1000]);
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const cpn = F * r;
      const ans = add(mul(cpn, vt(s1, 1)), mul(cpn, vt(s2, 2)), mul(F + cpn, vt(s3, 3)));
      return std({
        stem: `Annual effective spot rates are ${pct(s1)}, ${pct(s2)} and ${pct(s3)} for one, two and three years. ${name} buys a 3-year bond with face ${amt(F)} and annual coupons at ${pct(r)}. Calculate its price.`,
        fmt: MONEY2,
        answer: ans,
        model: add(div(cpn, 1 + s1), div(cpn, pow(1 + s2, 2)), div(F + cpn, pow(1 + s3, 3))),
        modelDescription: "Each cash flow divided by its accumulation factor.",
        traps: [
          t("COMP_YIELD_AS_LONGEST_SPOT", add(mul(cpn, an(s3, 3)), mul(F, vt(s3, 3))), "three-year spot throughout", "Discounted everything at the 3-year spot.", "Each cash flow has its own spot rate."),
          t("MODEL_SINGLE_RATE", add(mul(cpn, an(s1, 3)), mul(F, vt(s1, 3))), "one-year spot throughout", "Discounted everything at the 1-year spot.", "Each cash flow has its own spot rate."),
          t("COMP_SPOT_AS_FORWARD", add(mul(cpn, vt(s1, 1)), mul(cpn, vt(s2, 1), vt(s1, 1)), mul(F + cpn, vt(s3, 1), vt(s2, 1), vt(s1, 1))), "spot rates used as forwards", "Chained the spot rates as one-year forwards.", "A t-year spot discounts t years at once."),
          t("MODEL_IGNORED_COUPON", mul(F, vt(s3, 3)), "coupons ignored", "Priced only the redemption.", "Include the coupons."),
          t("SEQ_UNDISCOUNTED_SUM", K(F + 3 * cpn), "cash flows added", "Added the cash flows.", "Discount each one."),
          t("CONC_IGNORED_REDEMPTION", add(mul(cpn, vt(s1, 1)), mul(cpn, vt(s2, 2)), mul(cpn, vt(s3, 3))), "redemption left out", "Priced only the coupons.", "Include the redemption."),
        ],
        steps: [step("F.spot", "Discount factors.", ["v_3", Math.pow(1 + s3, -3), "3-year discount factor"], ["s"]), step("F.spot-pricing", "Price.", ["P", ans.v, "price"], ["v"])],
        methods: ["decomposition"],
        reasoning: "Discount each cash flow at its own spot rate.",
        intuition: "A coupon bond is a bundle of zeros.",
        unknown: ["$P$", "price"],
        relationships: ["$P = \\sum CF_t(1+s_t)^{-t}$"],
        valuationDate: "Time 0",
        principle: "Spot-rate pricing.",
        misread: "Using one rate for all cash flows.",
        presentation: ["direct"],
        params: { kase, s1, s2, s3, F, r },
        route: "factors, price",
      });
    }
    const f0 = s1;
    const f1 = f0 + gridRate(rng, 0.005, 0.02, 0.0025);
    const f2 = f1 + gridRate(rng, 0.005, 0.02, 0.0025);
    const ans = sub(pow(mul(1 + f0, 1 + f1, 1 + f2), 1 / 3), 1);
    return std({
      stem: `One-year forward rates are ${pct(f0)} for year 1, ${pct(f1)} for year 2 and ${pct(f2)} for year 3. Calculate the three-year spot rate.`,
      fmt: PCT3,
      answer: ans,
      model: { eq: (x: X) => sub(pow(add(1, x), 3), (1 + f0) * (1 + f1) * (1 + f2)), lo: -0.1, hi: 0.5 },
      modelDescription: "Three-year accumulation equals the chain of forwards.",
      traps: [
        t("CONC_ALM_RETURNS_AVERAGED", K((f0 + f1 + f2) / 3), "arithmetic average", "Averaged the forwards.", "Take the geometric average."),
        t("CONC_ALM_SPOT_NOT_COMPOUNDED", K((1 + f0) * (1 + f1) * (1 + f2) - 1), "three-year total", "Gave the total growth.", "Annualise: take the cube root."),
        t("CONC_ALM_FORWARD_AS_SPOT", K(f2), "last forward", "Gave the year-3 forward.", "The spot covers all three years."),
        t("COMP_FORWARD_AS_SPOT", K(f0), "first forward", "Gave the year-1 rate.", "The spot covers all three years."),
        t("TIMING_VALUATION_DATE", sub(pow(mul(1 + f0, 1 + f1), 0.5), 1), "two-year spot", "Gave the 2-year spot rate.", "Chain all three forwards."),
        t("SEQ_TERM_COUNT", sub(pow(mul(1 + f0, 1 + f1, 1 + f2), 0.5), 1), "square root", "Took a square root.", "Three years: cube root."),
      ],
      steps: [step("F.forward-chain", "Chain the forwards.", ["(1+s_3)^3", (1 + f0) * (1 + f1) * (1 + f2), "3-year factor"], ["f"]), step("F.spot", "Spot rate.", ["s_3", ans.v, "3-year spot"], ["(1+s_3)^3"], { rearranged: true })],
      methods: ["rearrangement"],
      reasoning: "(1 + s₃)³ = (1 + f₀)(1 + f₁)(1 + f₂).",
      intuition: "A spot rate is a geometric average of forwards.",
      unknown: ["$s_3$", "3-year spot rate"],
      relationships: ["$(1+s_3)^3 = \\prod (1+f_k)$"],
      valuationDate: "Time 0",
      principle: "Spot rates chain forward rates.",
      misread: "Averaging arithmetically.",
      presentation: ["direct"],
      params: { kase, f0, f1, f2 },
      route: "chain, root",
    });
  },
};

// ===================================================================== ALM 4: immunization basics

const immunize: QuestionTemplate = {
  id: "std-alm-immunize",
  family: "std-alm-immunize",
  topic: "ALM",
  levels: [1],
  objective: "ALM.full_immunization",
  secondary: ["ALM.duration", "ALM.redington"],
  reasoning: ["simultaneous_equations", "algebra", "financial_intuition"],
  soaConcept: "Matching a liability's present value and duration: full immunization with two zeros, and a single zero matched to two liabilities.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const kase = pick(rng, ["full", "single-zero-date", "single-zero-face"]);
    if (kase === "full") {
      const L = gridAmount(rng, 50000, 500000, 10000);
      const T = rng.int(6, 15);
      const a = rng.int(1, Math.min(5, T - 1));
      const b = drawUntil(() => rng.int(1, 6), (x) => x !== a);
      const PVL = L * Math.pow(1 + i, -T);
      const PVa = (PVL * b) / (a + b);
      const ans = mul(PVa, at(i, T - a));
      return std({
        stem: `${name} must pay ${amt(L)} at time ${T} and fully immunizes the liability at an annual effective rate of ${pct(i)} with two zero-coupon bonds maturing at times ${T - a} and ${T + b}. Calculate the face amount of the bond maturing at time ${T - a}.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(mul(a, x, pow(1 + i, -(T - a))), mul(b, sub(PVL, mul(x, pow(1 + i, -(T - a)))))), lo: 1, hi: L * 3 },
        modelDescription: "Duration balance about the liability date with the earlier face as the unknown.",
        traps: [
          t("ALLOC_EVEN_SPLIT", mul(PVL / 2, at(i, T - a)), "present value split evenly", "Split the present value equally.", "Balance the durations: a·PV₁ = b·PV₂."),
          t("ALLOC_SWAPPED", mul((PVL * a) / (a + b), at(i, T - a)), "weights swapped", "Swapped the weights.", "The nearer bond carries more value."),
          t("VAR_OTHER_UNKNOWN", K(PVa), "present value", "Gave the present value.", `Accumulate to time ${T - a}.`),
          t("MODEL_UNDISCOUNTED_WEIGHTS", K((L * b) / (a + b)), "undiscounted", "Split the liability itself.", "Work with present values."),
        ],
        steps: [step("A.discount-factor", "Present value of the liability.", ["PV_L", PVL, "present value"], ["L", "i"]), step("G.full-immunization", "PV and duration conditions.", ["PV_1", PVa, "present value of the earlier bond"], ["PV_L", "a", "b"], { rearranged: true }), step("A.accumulation", "Face amount.", ["F_1", ans.v, "face amount"], ["PV_1", "i"])],
        methods: ["simultaneous", "substitution"],
        reasoning: "PV₁ + PV₂ = PV_L and a·PV₁ = b·PV₂, so PV₁ = PV_L·b/(a+b); accumulate.",
        intuition: "The bond nearer the liability carries more value.",
        unknown: ["$F_1$", "face amount"],
        relationships: ["$a\\,PV_1 = b\\,PV_2$"],
        valuationDate: "Time 0",
        principle: "Full immunization: PV match, duration match, assets on both sides.",
        misread: "Splitting the present value equally.",
        presentation: ["multi-equation"],
        params: { kase, i, L, T, a, b },
        route: "PV, conditions, face",
      });
    }
    const L1 = gridAmount(rng, 10000, 80000, 1000);
    const L2 = gridAmount(rng, 10000, 80000, 1000);
    const t1 = rng.int(2, 6);
    const t2 = t1 + rng.int(3, 8);
    const pv1 = L1 * Math.pow(1 + i, -t1);
    const pv2 = L2 * Math.pow(1 + i, -t2);
    const D = (t1 * pv1 + t2 * pv2) / (pv1 + pv2);
    if (kase === "single-zero-date") {
      const ans = div(add(mul(t1 * L1, vt(i, t1)), mul(t2 * L2, vt(i, t2))), add(mul(L1, vt(i, t1)), mul(L2, vt(i, t2))));
      return std({
        stem: `${name} must pay ${amt(L1)} at time ${t1} and ${amt(L2)} at time ${t2}. To match the liabilities' present value and Macaulay duration at an annual effective rate of ${pct(i)} with a single zero-coupon bond, at what time should the bond mature?`,
        fmt: YEARS2,
        answer: ans,
        model: { eq: (x: X) => sub(mul(sub(x, t1), pv1), mul(sub(t2, x), pv2)), lo: t1, hi: t2 },
        modelDescription: "The balance point of the liabilities' present values.",
        traps: [
          t("MODEL_UNDISCOUNTED_WEIGHTS", K((t1 * L1 + t2 * L2) / (L1 + L2)), "undiscounted weights", "Weighted by the liabilities.", "Weight by present values."),
          t("TIMING_VALUATION_DATE", K((t1 + t2) / 2), "midpoint", "Took the midpoint.", "Weight by present values."),
          t("FORMULA_MODIFIED_FOR_MACAULAY", K(D / (1 + i)), "modified duration", "Used the modified duration.", "A zero's maturity equals its Macaulay duration."),
          t("CONC_ALM_DURATIONS_ADDED", K((t1 * pv1 + t2 * pv2) / (L1 + L2)), "divided by undiscounted total", "Divided by the undiscounted total.", "Divide by the present value."),
        ],
        steps: [step("A.discount-factor", "Present values.", ["PV", pv1 + pv2, "present value"], ["L", "i"]), step("G.macaulay", "Macaulay duration of the liabilities.", ["D", D, "duration"], ["PV"])],
        methods: ["decomposition"],
        reasoning: "A zero-coupon bond's duration is its maturity: set it to the liabilities' duration.",
        intuition: "The bond must sit at the liabilities' centre of value.",
        unknown: ["$T$", "maturity of the bond"],
        relationships: ["$T = \\dfrac{\\sum t\\,PV_t}{\\sum PV_t}$"],
        valuationDate: "Time 0",
        principle: "A zero's Macaulay duration is its term.",
        misread: "Weighting by undiscounted amounts.",
        presentation: ["direct"],
        params: { kase, i, L1, L2, t1, t2 },
        route: "present values, duration",
      });
    }
    const ans = mul(pv1 + pv2, pow(1 + i, D));
    return std({
      stem: `${name} must pay ${amt(L1)} at time ${t1} and ${amt(L2)} at time ${t2}, and buys one zero-coupon bond matching the liabilities' present value and Macaulay duration at an annual effective rate of ${pct(i)}. Calculate the bond's maturity value.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(add(mul(L1, pow(1 + i, -t1)), mul(L2, pow(1 + i, -t2))), exp1(i, D)),
      modelDescription: "Present value accumulated to the duration date.",
      traps: [
        t("VAR_OTHER_UNKNOWN", K(pv1 + pv2), "present value", "Gave the present value.", "Accumulate to the bond's maturity."),
        t("SEQ_UNDISCOUNTED_SUM", K(L1 + L2), "liabilities added", "Added the liabilities.", "The bond pays at one date: accumulate the PV to it."),
        t("TIMING_VALUATION_DATE", mul(pv1 + pv2, pow(1 + i, (t1 + t2) / 2)), "accumulated to the midpoint", "Accumulated to the midpoint of the dates.", "Accumulate to the duration."),
        t("MODEL_UNDISCOUNTED_WEIGHTS", mul(pv1 + pv2, pow(1 + i, (t1 * L1 + t2 * L2) / (L1 + L2))), "undiscounted duration", "Used an undiscounted average time.", "Use the Macaulay duration."),
        t("TIMING_EXTRA_PERIOD", mul(pv1 + pv2, pow(1 + i, D + 1)), "one year too many", "Accumulated one year past the duration.", "Accumulate to the duration."),
        t("FORMULA_MODIFIED_FOR_MACAULAY", mul(pv1 + pv2, pow(1 + i, D / (1 + i))), "modified duration date", "Accumulated to the modified duration.", "Use the Macaulay duration."),
      ],
      steps: [step("A.discount-factor", "Present value.", ["PV", pv1 + pv2, "present value"], ["L", "i"]), step("G.macaulay", "Duration.", ["D", D, "duration"], ["PV"]), step("A.accumulation", "Maturity value.", ["F", ans.v, "maturity value"], ["PV", "D"])],
      methods: ["decomposition"],
      reasoning: "Mature the bond at the duration; its value there is PV × (1 + i)^D.",
      intuition: "Match value and timing with one bond.",
      unknown: ["$F$", "maturity value"],
      relationships: ["$F = PV_L(1+i)^{D}$"],
      valuationDate: "Time D",
      principle: "Matching PV and duration with a single zero.",
      misread: "Giving the present value.",
      presentation: ["direct"],
      params: { kase, i, L1, L2, t1, t2 },
      route: "present value, duration, accumulate",
    });
  },
};

/** (1 + i)^t written through logarithms, for an independent model. */
function exp1(i: number, tt: number): X {
  return pow(1 + i, tt);
}

export const STANDARD_LOAN_BOND_ALM_TEMPLATES: QuestionTemplate[] = [loanBalance, loanComponents, loanMonthly, loanUnknown, loanRefi, loanExtra, bondPriceT, bondBV, bondSolve, bondCall, bondReinvest, npvIrr, durationT, spotForward, immunize];

