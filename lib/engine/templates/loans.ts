import { acc, adue, an, balanceRetro, levelPayment, sdue, sn, v } from "../finance";
import type { QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  aExpr,
  aSym,
  accPow,
  adueExpr,
  adueSym,
  amt,
  avTerms,
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
} from "./kit";

/** Explicit sum of discount factors v^from + ... + v^to, as an expression. */
const sumV = (i: number, from: number, to: number): string => sumOf(range(from, to).map((t) => vPow(i, t)));

// ===================================================================== running balance

const runningBalance: QuestionTemplate = {
  id: "loan-running-balance",
  family: "loan-balance",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.principal_interest", "TVM.equation_of_value"],
  reasoning: ["cashflow_modelling", "valuation_dates", "financial_intuition", "arithmetic", "algebra"],
  soaConcept: "Loan balance tracked through irregular end-of-year payments (retrospective method).",
  generate(rng, lvl): QuestionDraft {
    const L = gridAmount(rng, 8000, 20000, 500);
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const g = 1 + i;
    const G = onePlus(i);
    const p1 = gridAmount(rng, Math.round((L * 0.15) / 100) * 100, Math.round((L * 0.3) / 100) * 100, 100);

    if (lvl === 1) {
      const p2 = gridAmount(rng, Math.round((L * 0.15) / 100) * 100, Math.round((L * 0.3) / 100) * 100, 100);
      const p3 = gridAmount(rng, Math.round((L * 0.15) / 100) * 100, Math.round((L * 0.3) / 100) * 100, 100);
      const B1 = L * g - p1;
      const B2 = B1 * g - p2;
      const B3 = B2 * g - p3;
      const total = p1 + p2 + p3;
      const before = (((L - p1) * g - p2) * g - p3) * g;
      const onPayment = L - total * (1 - i);
      const onOriginal = L * (1 + 3 * i) - total;
      const undiscounted = L * g * g * g - total;
      const extra = B3 * g;
      const fmt = MONEY0;
      return {
        stem: `A loan of ${amt(L)} is made at an annual effective interest rate of ${pc(i)}. The borrower makes payments of ${amt(p1)}, ${amt(p2)} and ${amt(p3)} at the end of years 1, 2 and 3 respectively.\n\nCalculate the outstanding loan balance immediately after the third payment.`,
        answer: {
          value: B3,
          calc: `((${lit(L)}*${G}-${lit(p1)})*${G}-${lit(p2)})*${G}-${lit(p3)}`,
          format: fmt,
          derivation: `$B_3 = \\big((${mamt(L)}(${dec(g, 4)}) - ${p1})(${dec(g, 4)}) - ${p2}\\big)(${dec(g, 4)}) - ${p3} = ${shown(B3, fmt)}$`,
        },
        model: {
          expr: `${lit(L)}*${accPow(i, 3)} - ${avTerms([{ t: 1, amount: p1 }, { t: 2, amount: p2 }, { t: 3, amount: p3 }], i, 3)}`,
          description: "The balance is the loan accumulated to time 3 minus every payment accumulated to time 3 (retrospective equation of value).",
        },
        distractors: [
          distractor("TIMING_PAYMENT_BEFORE_INTEREST", before, `(((${lit(L)}-${lit(p1)})*${G}-${lit(p2)})*${G}-${lit(p3)})*${G}`, {
            derivation: `$\\big(((${mamt(L)} - ${p1})(${dec(g, 4)}) - ${p2})(${dec(g, 4)}) - ${p3}\\big)(${dec(g, 4)}) = ${shown(before, fmt)}$`,
            method: "Subtracted each payment at the start of its year, then added a year's interest on the reduced balance.",
            feedback: `Each payment arrives at the end of its year, after that year's interest of ${pc(i)} has accrued on the full balance. Deducting the payment first credits every payment with a year of interest it never earned.`,
            markers: [(L - p1) * g],
          }),
          distractor("MODEL_INTEREST_ON_PAYMENT", onPayment, `${lit(L)} - ${lit(total)}*(1-${lit(i)})`, {
            derivation: `$${mamt(L)} + ${dec(i, 3)}(${total}) - ${total} = ${shown(onPayment, fmt)}$`,
            method: "Charged interest on each payment instead of on the balance owed.",
            feedback: `Interest is the price of the money still borrowed. In year 1 that is ${amt(L)}, not the ${amt(p1)} payment. Interest on the payments ignores almost all of the debt.`,
            markers: [total * i],
          }),
          distractor("MODEL_INTEREST_ON_ORIGINAL", onOriginal, `${lit(L)}*(1+3*${lit(i)}) - ${lit(total)}`, {
            derivation: `$${mamt(L)}(1 + 3 \\times ${dec(i, 3)}) - ${total} = ${shown(onOriginal, fmt)}$`,
            method: "Charged a year's interest on the original loan in each of the three years.",
            feedback: "After the first payment the debt is smaller, so later years' interest is charged on a smaller base. Interest on the original amount every year is simple interest on the loan and ignores the repayments.",
            markers: [L * i * 3],
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", undiscounted, `${lit(L)}*${accPow(i, 3)} - ${lit(total)}`, {
            derivation: `$${mamt(L)}(${dec(g, 4)})^3 - (${p1} + ${p2} + ${p3}) = ${shown(undiscounted, fmt)}$`,
            method: "Accumulated the loan to time 3 but subtracted the payments at face value.",
            feedback: "The loan was accumulated to time 3, so every payment must be too: the first payment reduced the debt two years before time 3 and saved two years of interest.",
            markers: [L * g * g * g],
          }),
          distractor("TIMING_EXTRA_PERIOD", extra, `(((${lit(L)}*${G}-${lit(p1)})*${G}-${lit(p2)})*${G}-${lit(p3)})*${G}`, {
            derivation: `$B_3(1+i) = ${mnum(B3, 2)} \\times ${dec(g, 4)} = ${shown(extra, fmt)}$`,
            method: "Rolled the balance forward one more year after the third payment.",
            feedback: "The question asks for the balance immediately after the third payment, at time 3. No further interest has accrued.",
          }),
        ],
        explanation: explanation({
          intuition: `Treat the loan as an account the borrower owes. Each year the lender adds a year's interest on whatever is owed at the start of that year, and then the payment comes off. Only the amount still owed earns interest — a payment, once made, stops costing anything.`,
          translation: {
            unknowns: [{ symbol: "$B_t$", meaning: "the balance owed immediately after the payment at time t" }],
            relationships: ["$B_0 = " + mamt(L) + "$", `$B_t = B_{t-1}(1 + i) - P_t$ with $i = ${mpc(i)}$`],
            conditions: ["Interest for year t accrues on $B_{t-1}$.", "Each payment is made at the end of its year, after that year's interest."],
            valuationDate: "Time 3, immediately after the third payment.",
            modelChoice: "The payments are irregular, so no annuity factor applies. A one-line recursion — or the retrospective equation of value — models the account directly.",
            assumptions: [`Interest compounds annually at ${pc(i)} effective.`, "Payments are made exactly at times 1, 2 and 3."],
          },
          solution: [
            { title: "Year 1", body: `$B_1 = ${mamt(L)}(${dec(g, 4)}) - ${p1} = ${mnum(B1, 2)}$` },
            { title: "Year 2", body: `$B_2 = ${mnum(B1, 2)}(${dec(g, 4)}) - ${p2} = ${mnum(B2, 2)}$` },
            { title: "Year 3", body: `$B_3 = ${mnum(B2, 2)}(${dec(g, 4)}) - ${p3} = ${mnum(B3, 2)} \\approx ${shown(B3, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Retrospective equation of value",
              body: `$B_3 = ${mamt(L)}(${dec(g, 4)})^3 - ${p1}(${dec(g, 4)})^2 - ${p2}(${dec(g, 4)}) - ${p3} = ${mnum(B3, 2)}$`,
              whenUseful: "One calculator line. Best when the payments are irregular but few.",
            },
            {
              name: "Equation of value at time 0",
              body: `$${mamt(L)} = ${p1}v + ${p2}v^2 + ${p3}v^3 + B_3 v^3$, so $B_3 = \\big(${mamt(L)} - ${p1}v - ${p2}v^2 - ${p3}v^3\\big)(1+i)^3$.`,
              whenUseful: "Natural when the unknown is one of the payments rather than the balance; the same equation rearranges for either.",
            },
          ],
          transfer: {
            principle: "Interest for a period is the rate times the amount owed during that period. A payment reduces what is owed only from the moment it is made.",
            unusual: "With irregular payments there is no annuity formula to reach for; the question tests whether you can model the account itself.",
            misread: "It is easy to subtract the payments first and add interest afterwards, or to charge interest on the payments themselves.",
          },
        }),
        visuals: [
          { kind: "amortization", title: "How the balance evolves", principal: L, rate: i, payments: [p1, p2, p3], unit: "year", highlightPeriod: 3 },
          {
            kind: "timeline",
            title: "Loan and payments on one timeline",
            unit: "year",
            rate: i,
            flows: [
              { t: 0, amount: L, dir: "in", label: "loan" },
              { t: 1, amount: p1, dir: "out", label: "P₁" },
              { t: 2, amount: p2, dir: "out", label: "P₂" },
              { t: 3, amount: p3, dir: "out", label: "P₃" },
            ],
            valuationTimes: [3],
            caption: "Move every flow to time 3: what was borrowed, minus what was repaid, is what is still owed.",
          },
        ],
        markers: [B1, B2, L * g * g * g],
        presentation: ["direct", "mixed-timing"],
        features: features({ steps: 3, multipleValuationDates: false }),
        chain: chain(
          [
            step("D.balance-recursion", "Year 1: interest on the full loan, then the payment.", ["B_1", B1, "balance after payment 1"], ["L", "i", "P_1"]),
            step("D.balance-recursion", "Year 2: interest on B₁, then the payment.", ["B_2", B2, "balance after payment 2"], ["B_1", "P_2"]),
            step("D.balance-recursion", "Year 3: interest on B₂, then the payment.", ["B_3", B3, "balance after payment 3"], ["B_2", "P_3"]),
          ],
          {
            stages: {
              TIMING_PAYMENT_BEFORE_INTEREST: [0, "application"],
              MODEL_INTEREST_ON_PAYMENT: [0, "application"],
              MODEL_INTEREST_ON_ORIGINAL: [1, "application"],
              SEQ_UNDISCOUNTED_SUM: [0, "application"],
              TIMING_EXTRA_PERIOD: [2, "interpretation"],
            },
            reasoning: "Retrospective equation of value at time 3: the loan accumulated, less each payment accumulated from its own date.",
          }
        ),
        params: { L, i, p1, p2, p3 },
      };
    }

    // Level 2: a payment is unknown and the balance is given.
    const { X, Bt } = drawUntil(
      () => {
        const X0 = gridAmount(rng, Math.round((L * 0.15) / 50) * 50, Math.round((L * 0.28) / 50) * 50, 50);
        const B0 = Math.round(L * g ** 3 - p1 * g * g - X0 * g - 2 * X0);
        const Xexact = (L * g ** 3 - p1 * g * g - B0) / (g + 2);
        return { X: Xexact, Bt: B0 };
      },
      ({ Bt: b }) => b > 0.2 * L && b < 0.7 * L
    );
    const fmt = MONEY2;
    const before = (L * g ** 3 - p1 * g ** 3 - Bt) / (g * g + 2 * g);
    const undiscounted = (L * g ** 3 - p1 - Bt) / 3;
    const inverted = (L * g ** 3 - p1 * g * g - Bt) / (g + 0.5);
    const mixed = (L - p1 / g - Bt) / (1 / g ** 2 + 2 / g ** 3);
    const original = (L * (1 + 3 * i) - p1 - Bt) / 3;
    const Ls = lit(L);
    return {
      stem: `A loan of ${amt(L)} is made at an annual effective interest rate of ${pc(i)}. The borrower pays ${amt(p1)} at the end of the first year, $X$ at the end of the second year and $2X$ at the end of the third year. Immediately after the third payment the outstanding balance is ${amt(Bt)}.\n\nCalculate $X$.`,
      answer: {
        value: X,
        calc: `(${Ls}*${accPow(i, 3)} - ${lit(p1)}*${accPow(i, 2)} - ${lit(Bt)})/(${G} + 2)`,
        format: fmt,
        derivation: `$X = \\dfrac{${mamt(L)}(${dec(g, 4)})^3 - ${p1}(${dec(g, 4)})^2 - ${mamt(Bt)}}{${dec(g, 4)} + 2} = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `${Ls}*${accPow(i, 3)} - ${avTerms([{ t: 1, amount: p1 }, { t: 2, amount: "x" }, { t: 3, amount: "2*x" }], i, 3)} - ${lit(Bt)}`,
        bracket: [0, L],
        description: "At time 3 the loan accumulated, less every payment accumulated, equals the stated balance; X is the root of that equation.",
      },
      distractors: [
        distractor("TIMING_PAYMENT_BEFORE_INTEREST", before, `(${Ls}*${accPow(i, 3)} - ${lit(p1)}*${accPow(i, 3)} - ${lit(Bt)})/(${accPow(i, 2)} + 2*${G})`, {
          derivation: `$X = \\dfrac{${mamt(L)}(${dec(g, 4)})^3 - ${p1}(${dec(g, 4)})^3 - ${mamt(Bt)}}{(${dec(g, 4)})^2 + 2(${dec(g, 4)})} = ${shown(before, fmt)}$`,
          method: "Accumulated every payment one year too long, as if each were made at the start of its year.",
          feedback: "Payments are made at the end of each year. The payment at time 2 earns one year of interest to time 3, and the payment at time 3 earns none.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", undiscounted, `(${Ls}*${accPow(i, 3)} - ${lit(p1)} - ${lit(Bt)})/3`, {
          derivation: `$${mamt(L)}(${dec(g, 4)})^3 - ${p1} - X - 2X = ${mamt(Bt)} \\Rightarrow X = ${shown(undiscounted, fmt)}$`,
          method: "Accumulated the loan but subtracted the payments at face value.",
          feedback: "Every term must sit at time 3. Payments made earlier reduced the debt earlier, so they carry interest to time 3 exactly as the loan does.",
        }),
        distractor("TRANS_INVERTED_RELATION", inverted, `(${Ls}*${accPow(i, 3)} - ${lit(p1)}*${accPow(i, 2)} - ${lit(Bt)})/(${G} + 0.5)`, {
          derivation: `$X(${dec(g, 4)}) + \\tfrac{1}{2}X = ${mnum(L * g ** 3 - p1 * g * g - Bt, 2)} \\Rightarrow X = ${shown(inverted, fmt)}$`,
          method: "Read “2X at the end of the third year” as half of the second payment.",
          feedback: "The third payment is twice the second: write it as 2X and check by substituting X = 100, which should give a third payment of 200.",
        }),
        distractor("TIMING_VALUATION_DATE", mixed, `(${Ls} - ${lit(p1)}*${vPow(i, 1)} - ${lit(Bt)})/(${vPow(i, 2)} + 2*${vPow(i, 3)})`, {
          derivation: `$${mamt(L)} = ${p1}v + Xv^2 + 2Xv^3 + ${mamt(Bt)} \\Rightarrow X = ${shown(mixed, fmt)}$`,
          method: "Wrote the equation at time 0 but left the time-3 balance undiscounted.",
          feedback: "The balance of " + amt(Bt) + " is owed at time 3. In an equation of value at time 0 it must be multiplied by $v^3$ like every other time-3 amount.",
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", original, `(${Ls}*(1+3*${lit(i)}) - ${lit(p1)} - ${lit(Bt)})/3`, {
          derivation: `$${mamt(L)}(1 + 3 \\times ${dec(i, 3)}) - ${p1} - 3X = ${mamt(Bt)} \\Rightarrow X = ${shown(original, fmt)}$`,
          method: "Charged interest on the original loan each year and ignored interest on the reductions.",
          feedback: "Interest compounds on the balance actually owed. Simple interest on the original loan overstates the debt in later years.",
        }),
      ],
      explanation: explanation({
        intuition: "This is the running-balance account run backwards: we know where the account ends, and one of the deposits into it (the payments) is unknown. Moving everything to one date turns the story into one linear equation in X.",
        translation: {
          unknowns: [{ symbol: "$X$", meaning: "the second payment (the third is $2X$)" }],
          relationships: [`$B_3 = L(1+i)^3 - P_1(1+i)^2 - X(1+i) - 2X$`],
          conditions: [`$B_3 = ${mamt(Bt)}$`, `$i = ${mpc(i)}$`],
          valuationDate: "Time 3 — the date at which the balance is given, so nothing needs to be moved twice.",
          modelChoice: "A retrospective equation of value: loan accumulated minus payments accumulated equals balance.",
          assumptions: ["Payments are at the end of years 1, 2 and 3.", "The balance is measured immediately after the third payment."],
        },
        solution: [
          { title: "Accumulate the known amounts", body: `$${mamt(L)}(${dec(g, 4)})^3 - ${p1}(${dec(g, 4)})^2 = ${mnum(L * g ** 3 - p1 * g * g, 2)}$` },
          { title: "Collect the X terms", body: `$X(${dec(g, 4)}) + 2X = X(${dec(g + 2, 4)})$` },
          { title: "Solve", body: `$X = \\dfrac{${mnum(L * g ** 3 - p1 * g * g, 2)} - ${mamt(Bt)}}{${dec(g + 2, 4)}} = ${shown(X, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Work backwards from the balance",
            body: `$B_2 = \\dfrac{B_3 + 2X}{1+i}$ and $B_2 = (${mamt(L)}(1+i) - ${p1})(1+i) - X$; equate the two expressions for $B_2$.`,
            whenUseful: "Helpful for checking the timing intuition, but it carries X through two lines; the single equation at time 3 is quicker.",
          },
          {
            name: "Equation of value at time 0",
            body: `$${mamt(L)} = ${p1}v + Xv^2 + 2Xv^3 + ${mamt(Bt)}v^3$ gives the same X.`,
            whenUseful: "Any valuation date works if every term moves to it; time 3 just needs the fewest moves.",
          },
        ],
        transfer: {
          principle: "Pick the valuation date where the given information lives and move every cash flow there; an unknown payment then appears linearly.",
          unusual: "The unknown is a payment, not a balance, and two payments are linked by a multiple.",
          misread: "The time-3 balance is easy to forget to discount when the equation is written at time 0.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Equation of value at time 3",
          unit: "year",
          rate: i,
          flows: [
            { t: 0, amount: L, dir: "in", label: "loan" },
            { t: 1, amount: p1, dir: "out", label: "P₁" },
            { t: 2, amount: X, dir: "out", label: "X" },
            { t: 3, amount: 2 * X, dir: "out", label: "2X" },
            { t: 3, amount: Bt, dir: "out", label: "balance" },
          ],
          valuationTimes: [3, 0],
          caption: "Drag the valuation date: the equation balances at every date, but time 3 needs the fewest moves.",
        },
        { kind: "amortization", title: "The schedule implied by the solution", principal: L, rate: i, payments: [p1, X, 2 * X], unit: "year", highlightPeriod: 3 },
      ],
      markers: [L * g ** 3 - p1 * g * g, g + 2],
      presentation: ["inverse", "work-backwards", "rearrange-first"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("A.compound", "Accumulate the known amounts (loan and first payment) to time 3.", ["L(1+i)^3 − P_1(1+i)^2", L * g ** 3 - p1 * g * g, "known part at time 3"], ["L", "P_1", "i"], { valuationDate: "3" }),
          step("D.retrospective", "Retrospective balance at time 3 with the unknown payments X and 2X.", ["B_3 equation", Bt, "given balance"], ["X", "2X"], { valuationDate: "3" }),
          step("A.equation-of-value", "Collect the X terms and solve.", ["X", X, "second payment"], ["B_3"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "work_backwards"],
          stages: {
            TIMING_PAYMENT_BEFORE_INTEREST: [1, "application"],
            SEQ_UNDISCOUNTED_SUM: [1, "application"],
            TRANS_INVERTED_RELATION: [2, "connection"],
            TIMING_VALUATION_DATE: [1, "application"],
            MODEL_INTEREST_ON_ORIGINAL: [0, "selection", "A.simple"],
          },
          reasoning: "Run the recursion backwards from the known balance, or write one equation at time 3 — both are linear in X.",
        }
      ),
      params: { L, i, p1, Bt },
    };
  },
};

// ===================================================================== level-payment balance

const levelBalance: QuestionTemplate = {
  id: "loan-level-balance",
  family: "loan-balance",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.amortization", "ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "formula_retrieval", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Outstanding balance of a level-payment loan by the prospective or retrospective method.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 4);

    if (lvl === 1) {
      const L = gridAmount(rng, 20000, 150000, 5000);
      const P = levelPayment(L, n, i);
      const B = P * an(n - k, i);
      const fmt = MONEY0;
      const Pexpr = `(${lit(L)}/${aExpr(n, i)})`;
      const PexprExplicit = `(${lit(L)}/${sumV(i, 1, n)})`;
      const early = P * an(n - k + 1, i);
      const onOriginal = L - k * (P - i * L);
      const before = L * acc(i, k) - P * sdue(k, i);
      const due = P * adue(n - k, i);
      const undisc = L - k * P;
      return {
        stem: `A loan of ${amt(L)} is repaid with level payments at the end of each year for ${n} years. The annual effective interest rate is ${pc(i)}.\n\nCalculate the outstanding balance immediately after the ${ord(k)} payment.`,
        answer: {
          value: B,
          calc: `${Pexpr}*${aExpr(n - k, i)}`,
          format: fmt,
          derivation: `$B_{${k}} = P\\,${aSym(n - k)} = ${mnum(P, 2)} \\times ${dec(an(n - k, i), 5)} = ${shown(B, fmt)}$`,
        },
        model: {
          expr: `${lit(L)} - (${PexprExplicit}*${sumV(i, 1, k)} + x*${vPow(i, k)})`,
          bracket: [0, L],
          description: "At time 0 the loan equals the PV of the first k payments plus the PV of the balance then outstanding; the balance is the root.",
        },
        distractors: [
          distractor("TIMING_BALANCE_INDEX", early, `${Pexpr}*${aExpr(n - k + 1, i)}`, {
            derivation: `$P\\,${aSym(n - k + 1)} = ${mnum(P, 2)} \\times ${dec(an(n - k + 1, i), 5)} = ${shown(early, fmt)}$`,
            method: `Used ${n - k + 1} remaining payments — the balance just after payment ${k - 1}.`,
            feedback: `After the ${ord(k)} payment, ${k} payments have been made and ${n - k} remain. Counting the ${ord(k)} payment as still due gives the balance one year earlier.`,
          }),
          distractor("MODEL_INTEREST_ON_ORIGINAL", onOriginal, `${lit(L)} - ${k}*(${Pexpr} - ${lit(i)}*${lit(L)})`, {
            derivation: `$${mamt(L)} - ${k}(P - i \\cdot ${mamt(L)}) = ${mamt(L)} - ${k}(${mnum(P - i * L, 2)}) = ${shown(onOriginal, fmt)}$`,
            method: "Assumed each payment repays the same principal, with interest always on the original loan.",
            feedback: "As the balance falls, less of each payment is interest and more is principal. The principal repaid grows by a factor of (1 + i) each year, so it is not constant.",
            markers: [P - i * L],
          }),
          distractor("TIMING_PAYMENT_BEFORE_INTEREST", before, `${lit(L)}*${accPow(i, k)} - ${Pexpr}*${sdueExpr(k, i)}`, {
            derivation: `$L(1+i)^{${k}} - P\\,${sdueSym(k)} = ${shown(before, fmt)}$`,
            method: "Accumulated the payments as an annuity-due in the retrospective formula.",
            feedback: "Payments are at the end of each year, so their accumulated value at time k uses $s$, not $\\ddot{s}$: the k-th payment is made at time k and earns no interest.",
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", due, `${Pexpr}*${adueExpr(n - k, i)}`, {
            derivation: `$P\\,${adueSym(n - k)} = ${shown(due, fmt)}$`,
            method: "Valued the remaining payments as an annuity-due.",
            feedback: "Immediately after payment k, the next payment is one year away. The remaining payments form an annuity-immediate.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", undisc, `${lit(L)} - ${k}*${Pexpr}`, {
            derivation: `$${mamt(L)} - ${k} \\times ${mnum(P, 2)} = ${shown(undisc, fmt)}$`,
            method: "Subtracted the payments made from the loan, ignoring interest.",
            feedback: "Part of every payment is interest, so the payments do not all reduce the balance. Interest must be accrued on the balance each year.",
          }),
        ],
        explanation: explanation({
          intuition: `The balance at any moment is simply what the lender is still owed. Looking forward, that is the value of the ${n - k} payments still to come. Looking back, it is what was lent, grown with interest, less what has been repaid, also grown with interest. Both views must agree.`,
          translation: {
            unknowns: [
              { symbol: "$P$", meaning: "the level annual payment" },
              { symbol: `$B_{${k}}$`, meaning: `the balance immediately after the ${ord(k)} payment` },
            ],
            relationships: [`$${mamt(L)} = P\\,${aSym(n)}$`, `$B_{${k}} = P\\,${aSym(n - k)}$ (prospective)`],
            conditions: [`${n} payments in total, ${k} already made`, `$i = ${mpc(i)}$`],
            valuationDate: `Time ${k}, immediately after the ${ord(k)} payment.`,
            modelChoice: "The prospective method is fastest here: the payment is level and the remaining term is known.",
            assumptions: ["Payments are at the end of each year.", "The rate is constant over the loan."],
          },
          solution: [
            { title: "Find the payment", body: `$P = \\dfrac{${mamt(L)}}{${aSym(n)}} = \\dfrac{${mamt(L)}}{${dec(an(n, i), 5)}} = ${mnum(P, 2)}$` },
            { title: "Count the remaining payments", body: `$${n} - ${k} = ${n - k}$ payments remain, the first one year from now.` },
            { title: "Prospective balance", body: `$B_{${k}} = ${mnum(P, 2)}\\,${aSym(n - k)} = ${mnum(P, 2)} \\times ${dec(an(n - k, i), 5)} = ${shown(B, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Retrospective method",
              body: `$B_{${k}} = L(1+i)^{${k}} - P\\,${sSym(k)} = ${mnum(L * acc(i, k), 2)} - ${mnum(P * sn(k, i), 2)} = ${mnum(balanceRetro(L, P, i, k), 2)}$`,
              whenUseful: "Use when the payments were irregular or the remaining term is unknown (for example after a refinancing).",
            },
            {
              name: "Equation of value at time 0",
              body: `$L = P\\,${aSym(k)} + B_{${k}}v^{${k}}$, so $B_{${k}} = (L - P\\,${aSym(k)})(1+i)^{${k}}$.`,
              whenUseful: "Shows why the two methods agree: it is the same equation viewed at different dates.",
            },
          ],
          transfer: {
            principle: "Outstanding balance = PV of the payments still owed = accumulated loan minus accumulated payments made. Choose whichever needs less information.",
            unusual: "The payment is not given; it must be reconstructed from the loan amount first.",
            misread: `“Immediately after the ${ord(k)} payment” means ${n - k} payments remain — miscounting by one is the most common slip.`,
          },
        }),
        visuals: [
          {
            kind: "amortization",
            title: "Balance after each payment",
            principal: L,
            rate: i,
            payments: Array.from({ length: n }, () => P),
            unit: "year",
            highlightPeriod: k,
          },
        ],
        markers: [P, an(n - k, i)],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("D.loan-payment", "The payment is not given: recover it from the loan.", ["P", P, "level payment"], ["L", "n", "i"], { rearranged: true }),
            step("D.prospective", "Value the payments still owed.", ["B_k", B, "balance after payment k"], ["P", "n − k"], { valuationDate: "k" }),
          ],
          {
            stages: {
              TIMING_BALANCE_INDEX: [1, "application"],
              MODEL_INTEREST_ON_ORIGINAL: [1, "selection", "D.interest-component"],
              TIMING_PAYMENT_BEFORE_INTEREST: [1, "selection", "B.annuity-due-av"],
              TIMING_IMMEDIATE_AS_DUE: [1, "selection", "B.annuity-due"],
              SEQ_UNDISCOUNTED_SUM: [1, "application"],
            },
            reasoning: "Equation of value at time 0: L = P·a_k + B_k·v^k, so B_k = (L − P·a_k)(1 + i)^k.",
          }
        ),
        params: { L, i, n, k },
      };
    }

    // Level 2: inverse — the original loan from a later balance.
    const P = gridAmount(rng, 800, 6000, 50);
    const n0 = n;
    const B = Math.round(P * an(n0 - k, i));
    const L = P * an(k, i) + B * v(i, k);
    const fmt = MONEY0;
    const values = {
      undisc: B + k * P,
      noDiscount: P * an(k, i) + B,
      due: P * adue(k, i) + B * v(i, k),
      extra: P * an(k, i) + B * v(i, k + 1),
      accumulated: P * sn(k, i) + B * acc(i, k),
    };
    return {
      stem: `A loan is repaid with level payments of ${amt(P)} at the end of each year. The annual effective interest rate is ${pc(i)}. Immediately after the ${ord(k)} payment the outstanding balance is ${amt(B)}.\n\nCalculate the original amount of the loan.`,
      answer: {
        value: L,
        calc: `${lit(P)}*${aExpr(k, i)} + ${lit(B)}*${vPow(i, k)}`,
        format: fmt,
        derivation: `$L = ${P}\\,${aSym(k)} + ${mamt(B)}v^{${k}} = ${shown(L, fmt)}$`,
      },
      model: {
        expr: `x*${accPow(i, k)} - ${avTerms(level(P, range(1, k)), i, k)} - ${lit(B)}`,
        bracket: [B, B + k * P * 2],
        description: "Retrospectively, the loan accumulated to time k less the k payments accumulated to time k equals the stated balance.",
      },
      distractors: [
        distractor("SEQ_UNDISCOUNTED_SUM", values.undisc, `${lit(B)} + ${k}*${lit(P)}`, {
          derivation: `$${mamt(B)} + ${k} \\times ${P} = ${shown(values.undisc, fmt)}$`,
          method: "Added the payments made back to the balance at face value.",
          feedback: "Some of each payment was interest, so adding the payments back overstates the original loan. Each amount has to be discounted to time 0.",
        }),
        distractor("TIMING_MISSING_PERIOD", values.noDiscount, `${lit(P)}*${aExpr(k, i)} + ${lit(B)}`, {
          derivation: `$${P}\\,${aSym(k)} + ${mamt(B)} = ${shown(values.noDiscount, fmt)}$`,
          method: "Discounted the payments but added the time-k balance without discounting it.",
          feedback: `The balance is owed at time ${k}. In a time-0 equation it must be multiplied by $v^{${k}}$.`,
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", values.due, `${lit(P)}*${adueExpr(k, i)} + ${lit(B)}*${vPow(i, k)}`, {
          derivation: `$${P}\\,${adueSym(k)} + ${mamt(B)}v^{${k}} = ${shown(values.due, fmt)}$`,
          method: "Valued the payments made as an annuity-due.",
          feedback: "The first payment is one year after the loan is made, so the payments made form an annuity-immediate.",
        }),
        distractor("TIMING_EXTRA_PERIOD", values.extra, `${lit(P)}*${aExpr(k, i)} + ${lit(B)}*${vPow(i, k + 1)}`, {
          derivation: `$${P}\\,${aSym(k)} + ${mamt(B)}v^{${k + 1}} = ${shown(values.extra, fmt)}$`,
          method: `Discounted the balance over ${k + 1} years.`,
          feedback: `The balance is measured at time ${k}, immediately after the ${ord(k)} payment, so it is discounted over ${k} years.`,
        }),
        distractor("ALG_INVERTED_RATIO", values.accumulated, `${lit(P)}*${sExpr(k, i)} + ${lit(B)}*${accPow(i, k)}`, {
          derivation: `$${P}\\,${sSym(k)} + ${mamt(B)}(1+i)^{${k}} = ${shown(values.accumulated, fmt)}$`,
          method: "Accumulated the amounts forward instead of discounting them back to time 0.",
          feedback: "The original loan is a time-0 amount. Amounts from later dates must be discounted to time 0; accumulating them moves them further into the future.",
        }),
      ],
      explanation: explanation({
        intuition: "Whatever the lender handed over at time 0 must equal the value, at time 0, of everything the lender gets back: the payments already made plus the balance still owed. The balance acts like a single final payment.",
        translation: {
          unknowns: [{ symbol: "$L$", meaning: "the original loan amount" }],
          relationships: [`$L = P\\,${aSym(k)} + B_{${k}}v^{${k}}$`],
          conditions: [`$P = ${P}$`, `$B_{${k}} = ${mamt(B)}$`, `$i = ${mpc(i)}$`],
          valuationDate: "Time 0, when the loan is made.",
          modelChoice: "The loan term is not needed: the balance replaces all of the future payments in the equation of value.",
          assumptions: ["Payments are at the end of each year.", "The balance is measured immediately after the stated payment."],
        },
        solution: [
          { title: "Value of the payments made", body: `$${P}\\,${aSym(k)} = ${P} \\times ${dec(an(k, i), 5)} = ${mnum(P * an(k, i), 2)}$` },
          { title: "Value of the balance", body: `$${mamt(B)}v^{${k}} = ${mamt(B)} \\times ${dec(v(i, k), 6)} = ${mnum(B * v(i, k), 2)}$` },
          { title: "Original loan", body: `$L = ${mnum(P * an(k, i), 2)} + ${mnum(B * v(i, k), 2)} = ${shown(L, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Retrospective formula rearranged",
            body: `$B_{${k}} = L(1+i)^{${k}} - P\\,${sSym(k)}$, so $L = (B_{${k}} + P\\,${sSym(k)})v^{${k}}$.`,
            whenUseful: "The same equation at time k; useful if you remember the retrospective formula better than the time-0 view.",
          },
        ],
        transfer: {
          principle: "An outstanding balance is a single sum that replaces all remaining payments in any equation of value.",
          unusual: "The loan term is never given — and is not needed.",
          misread: "It is tempting to think the original term must be found first.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Loan = payments made + balance, all at time 0",
          unit: "year",
          rate: i,
          flows: [
            ...range(1, k).map((t) => ({ t, amount: P, dir: "out" as const, label: "P" })),
            { t: k, amount: B, dir: "out" as const, label: "balance" },
          ],
          valuationTimes: [0, k],
        },
      ],
      markers: [P * an(k, i), B * v(i, k)],
      presentation: ["inverse", "indirect-wording"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("B.annuity-immediate", "Value the payments already made at time 0.", ["P a_k", P * an(k, i), "value of payments made"], ["P", "k", "i"]),
          step("A.discount-factor", "The balance replaces every future payment; discount it to time 0.", ["B v^k", B * v(i, k), "value of the balance"], ["B", "k"]),
          step("A.equation-of-value", "Loan = value of payments made + value of balance.", ["L", L, "original loan"], ["P a_k", "B v^k"]),
        ],
        {
          methods: ["decomposition", "valuation_dates"],
          stages: {
            SEQ_UNDISCOUNTED_SUM: [2, "application"],
            TIMING_MISSING_PERIOD: [1, "application"],
            TIMING_IMMEDIATE_AS_DUE: [0, "selection", "B.annuity-due"],
            TIMING_EXTRA_PERIOD: [1, "application"],
            ALG_INVERTED_RATIO: [1, "application"],
          },
          reasoning: "The retrospective balance formula, read backwards: B_k = L(1 + i)^k − P·s_k, solved for L.",
        }
      ),
      params: { P, i, k, B },
    };
  },
};

// ===================================================================== payment components

const paymentComponents: QuestionTemplate = {
  id: "loan-payment-components",
  family: "loan-components",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.amortization", "LOANS.unknown_variables"],
  reasoning: ["concept_recognition", "formula_retrieval", "translation", "algebra", "multistep"],
  soaConcept: "Interest and principal components of an amortized payment; principal repaid grows geometrically.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(12, 25);

    if (lvl === 1) {
      const L = gridAmount(rng, 20000, 120000, 5000);
      const t = rng.int(3, n - 3);
      const askPrincipal = rng.next() < 0.5;
      const P = levelPayment(L, n, i);
      const principal = P * v(i, n - t + 1);
      const interest = P - principal;
      const fmt = MONEY2;
      const Pexpr = `(${lit(L)}/${aExpr(n, i)})`;
      const Pexplicit = `(${lit(L)}/${sumV(i, 1, n)})`;
      // Independent model: interest = i × B_(t-1), with B_(t-1) retrospective and explicit.
      const balanceExplicit = `(${lit(L)}*${accPow(i, t - 1)} - ${Pexplicit}*${sumOf(range(0, t - 2).map((e) => accPow(i, e)))})`;
      const interestModel = `${lit(i)}*${balanceExplicit}`;
      const target = askPrincipal ? principal : interest;
      const word0 = askPrincipal ? "principal" : "interest";
      const offByOneP = P * v(i, n - t);
      const vals = askPrincipal
        ? {
            offByOne: offByOneP,
            swapped: interest,
            original: P - i * L,
            onPayment: P * (1 - i),
            even: L / n,
          }
        : {
            offByOne: P - offByOneP,
            swapped: principal,
            original: i * L,
            onPayment: P * i,
            even: P - L / n,
          };
      const pExp = (e: number) => `${Pexpr}*${vPow(i, e)}`;
      return {
        stem: `A loan of ${amt(L)} is repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}.\n\nCalculate the amount of ${word0} in the ${ord(t)} payment.`,
        answer: {
          value: target,
          calc: askPrincipal ? pExp(n - t + 1) : `${Pexpr} - ${pExp(n - t + 1)}`,
          format: fmt,
          derivation: askPrincipal
            ? `$P v^{${n - t + 1}} = ${mnum(P, 2)} \\times ${dec(v(i, n - t + 1), 6)} = ${shown(target, fmt)}$`
            : `$P(1 - v^{${n - t + 1}}) = ${mnum(P, 2)}(1 - ${dec(v(i, n - t + 1), 6)}) = ${shown(target, fmt)}$`,
        },
        model: {
          expr: askPrincipal ? `${Pexplicit} - ${interestModel}` : interestModel,
          description: `Interest in payment ${t} is i times the balance after payment ${t - 1} (computed retrospectively); principal is the rest of the payment.`,
        },
        distractors: [
          distractor("TIMING_BALANCE_INDEX", vals.offByOne, askPrincipal ? pExp(n - t) : `${Pexpr} - ${pExp(n - t)}`, {
            derivation: askPrincipal
              ? `$P v^{${n - t}} = ${shown(vals.offByOne, fmt)}$`
              : `$P(1 - v^{${n - t}}) = ${shown(vals.offByOne, fmt)}$`,
            method: `Used the exponent $n - t = ${n - t}$ instead of $n - t + 1$.`,
            feedback: `Payment ${t} is made when ${n - t + 1} payments (including itself) remain, so its principal part is $Pv^{${n - t + 1}}$. The last payment, t = n, has principal $Pv$, which is a good check on the exponent.`,
          }),
          distractor("VAR_INTEREST_FOR_PRINCIPAL", vals.swapped, askPrincipal ? `${Pexpr} - ${pExp(n - t + 1)}` : pExp(n - t + 1), {
            derivation: askPrincipal
              ? `$P(1 - v^{${n - t + 1}}) = ${shown(vals.swapped, fmt)}$`
              : `$Pv^{${n - t + 1}} = ${shown(vals.swapped, fmt)}$`,
            method: `Computed the ${askPrincipal ? "interest" : "principal"} portion instead of the ${word0}.`,
            feedback: `The two components add up to the payment. The question asks for the ${word0} part.`,
          }),
          distractor(
            "MODEL_INTEREST_ON_ORIGINAL",
            vals.original,
            askPrincipal ? `${Pexpr} - ${lit(i)}*${lit(L)}` : `${lit(i)}*${lit(L)}`,
            {
              derivation: askPrincipal
                ? `$P - i \\times ${mamt(L)} = ${mnum(P, 2)} - ${mnum(i * L, 2)} = ${shown(vals.original, fmt)}$`
                : `$i \\times ${mamt(L)} = ${shown(vals.original, fmt)}$`,
              method: "Charged interest on the original loan rather than on the balance before this payment.",
              feedback: `Only the first payment's interest is $iL$. By payment ${t}, ${t - 1} payments have reduced the balance, so the interest is $i\\,B_{${t - 1}}$.`,
            }
          ),
          distractor("MODEL_INTEREST_ON_PAYMENT", vals.onPayment, askPrincipal ? `${Pexpr}*(1-${lit(i)})` : `${Pexpr}*${lit(i)}`, {
            derivation: askPrincipal
              ? `$P - iP = ${mnum(P, 2)}(1 - ${dec(i, 3)}) = ${shown(vals.onPayment, fmt)}$`
              : `$iP = ${dec(i, 3)} \\times ${mnum(P, 2)} = ${shown(vals.onPayment, fmt)}$`,
            method: "Computed interest as the rate times the payment.",
            feedback: "Interest is charged on the amount borrowed during the year — the outstanding balance — not on the payment.",
          }),
          distractor("ALLOC_EVEN_SPLIT", vals.even, askPrincipal ? `${lit(L)}/${n}` : `${Pexpr} - ${lit(L)}/${n}`, {
            derivation: askPrincipal
              ? `$${mamt(L)} / ${n} = ${shown(vals.even, fmt)}$`
              : `$P - ${mamt(L)}/${n} = ${shown(vals.even, fmt)}$`,
            method: "Spread the principal evenly across the payments.",
            feedback: "With level payments, early payments are mostly interest and later ones mostly principal. Principal repaid grows by (1 + i) each year.",
          }),
        ],
        explanation: explanation({
          intuition: `Every payment does two jobs: it pays this year's interest on the balance, and whatever is left over repays principal. Early in the loan the balance is large, so interest takes most of the payment; near the end, almost all of it is principal. The principal portions form a geometric sequence growing at (1 + i).`,
          translation: {
            unknowns: [
              { symbol: "$P$", meaning: "the level payment" },
              { symbol: `$I_{${t}}, R_{${t}}$`, meaning: `interest and principal in payment ${t}` },
            ],
            relationships: [`$I_{${t}} = i\\,B_{${t - 1}} = P(1 - v^{${n - t + 1}})$`, `$R_{${t}} = P - I_{${t}} = Pv^{${n - t + 1}}$`],
            conditions: [`$P = L / ${aSym(n)}$`],
            valuationDate: `The date of payment ${t}; the balance before it is $B_{${t - 1}} = P\\,${aSym(n - t + 1)}$.`,
            modelChoice: "Prospective balance plus the interest/principal split.",
            assumptions: ["Level payments at the end of each year.", "Constant annual effective rate."],
          },
          solution: [
            { title: "Payment", body: `$P = ${mamt(L)} / ${dec(an(n, i), 5)} = ${mnum(P, 2)}$` },
            { title: "Balance before the payment", body: `$B_{${t - 1}} = P\\,${aSym(n - t + 1)} = ${mnum(P * an(n - t + 1, i), 2)}$` },
            {
              title: askPrincipal ? "Principal portion" : "Interest portion",
              body: askPrincipal
                ? `$R_{${t}} = P - iB_{${t - 1}} = ${mnum(P, 2)} - ${mnum(interest, 2)} = ${shown(target, fmt)}$`
                : `$I_{${t}} = i\\,B_{${t - 1}} = ${dec(i, 3)} \\times ${mnum(P * an(n - t + 1, i), 2)} = ${shown(target, fmt)}$`,
            },
          ],
          alternatives: [
            {
              name: "Direct formula",
              body: `$R_t = P v^{n-t+1}$ and $I_t = P(1 - v^{n-t+1})$: here $v^{${n - t + 1}} = ${dec(v(i, n - t + 1), 6)}$.`,
              whenUseful: "Fastest once you trust the exponent; check it with t = n, which must give $Pv$.",
            },
            {
              name: "Geometric growth of principal",
              body: `$R_1 = P - iL = ${mnum(P - i * L, 2)}$ and $R_t = R_1(1+i)^{t-1}$.`,
              whenUseful: "Useful when only the first payment's split is known.",
            },
          ],
          transfer: {
            principle: "Interest in any payment is i × (balance just before it). Principal portions of a level-payment loan grow geometrically at rate i.",
            unusual: "Nothing is unusual here — which is why the off-by-one in the exponent is the main trap.",
            misread: "Interest on the original loan, or on the payment, sounds plausible but uses the wrong base.",
          },
        }),
        visuals: [
          {
            kind: "amortization",
            title: "Interest and principal in every payment",
            principal: L,
            rate: i,
            payments: Array.from({ length: n }, () => P),
            unit: "year",
            highlightPeriod: t,
          },
        ],
        markers: [P, P * an(n - t + 1, i)],
        presentation: ["direct"],
        features: features({ steps: 3, formulaRetrieval: true }),
        chain: chain(
          [
            step("D.loan-payment", "Recover the level payment.", ["P", P, "level payment"], ["L", "n", "i"], { rearranged: true }),
            step("D.prospective", "Balance just before payment t.", ["B_{t−1}", P * an(n - t + 1, i), "balance before payment t"], ["P", "n − t + 1"]),
            askPrincipal
              ? step("D.principal-component", "Principal = payment − interest on that balance.", ["R_t", principal, "principal in payment t"], ["P", "B_{t−1}"])
              : step("D.interest-component", "Interest = rate × balance before the payment.", ["I_t", interest, "interest in payment t"], ["B_{t−1}"]),
          ],
          {
            stages: {
              TIMING_BALANCE_INDEX: [2, "application"],
              VAR_INTEREST_FOR_PRINCIPAL: [2, "interpretation"],
              MODEL_INTEREST_ON_ORIGINAL: [2, "connection"],
              MODEL_INTEREST_ON_PAYMENT: [2, "application"],
              ALLOC_EVEN_SPLIT: [2, "selection", "M.arithmetic-series"],
            },
            reasoning: "Interest is i × (what is owed just before the payment); the prospective balance gives what is owed.",
          }
        ),
        params: { L, i, n, t, ask: word0 },
      };
    }

    // Levels 2 and 3: two principal portions reveal the rate (hidden geometric structure).
    const L = gridAmount(rng, 30000, 150000, 5000);
    const P0 = levelPayment(L, n, i);
    const t1 = rng.int(2, Math.floor(n / 2) - 1);
    const t2 = t1 + rng.int(3, 6);
    const t3 = lvl === 3 ? rng.int(t2 + 1, n - 1) : rng.int(t1 + 1, t2 - 1);
    const A = Number((P0 * v(i, n - t1 + 1)).toFixed(2));
    const Bp = Number((P0 * v(i, n - t2 + 1)).toFixed(2));
    const gap = t2 - t1;
    const r = Math.pow(Bp / A, 1 / gap) - 1;
    const P = A * Math.pow(1 + r, n - t1 + 1);
    const prin3 = A * Math.pow(1 + r, t3 - t1);
    const int3 = P - prin3;
    const fmt = MONEY2;
    const rExpr = `((${lit(Bp)}/${lit(A)})**(1/${gap})-1)`;
    const R = `(1+${rExpr})`;
    const Pexpr = `(${lit(A)}*${R}**${n - t1 + 1})`;
    const answerCalc = `${Pexpr} - ${lit(A)}*${R}**${t3 - t1}`;
    // Independent model: balance before payment t3 is PV of remaining payments, interest = r × balance.
    const model = `${rExpr}*${Pexpr}*${sumOf(range(1, n - t3 + 1).map((e) => `${R}**(-${e})`))}`;
    const linear = P - (A + ((t3 - t1) * (Bp - A)) / gap);
    const rWrong = Math.pow(Bp / A, 1 / (gap + 1)) - 1;
    const rootErr = A * Math.pow(1 + rWrong, n - t1 + 1) - A * Math.pow(1 + rWrong, t3 - t1);
    const shifted = A * Math.pow(1 + r, n - t1) - prin3;
    const loanImplied = P * an(n, r);
    const original = r * loanImplied;
    return {
      stem: `A loan is repaid with ${n} level payments at the end of each year. The principal repaid in the ${ord(t1)} payment is ${mnumPlain(A)}, and the principal repaid in the ${ord(t2)} payment is ${mnumPlain(Bp)}.\n\nCalculate the amount of interest paid in the ${ord(t3)} payment.`,
      answer: {
        value: int3,
        calc: answerCalc,
        format: fmt,
        derivation: `$I_{${t3}} = P - R_{${t3}} = ${mnum(P, 2)} - ${mnum(prin3, 2)} = ${shown(int3, fmt)}$`,
      },
      model: {
        expr: model,
        description: `Interest in payment ${t3} equals the rate times the balance just before it, which is the PV of the ${n - t3 + 1} payments then remaining.`,
      },
      distractors: [
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", linear, `${Pexpr} - (${lit(A)} + ${t3 - t1}*(${lit(Bp)}-${lit(A)})/${gap})`, {
          derivation: `$R_{${t3}} \\approx ${mnum(A, 2)} + ${t3 - t1}\\cdot\\tfrac{${mnum(Bp - A, 2)}}{${gap}}$, so $I_{${t3}} = ${mnum(P, 2)} - ${mnum(A + ((t3 - t1) * (Bp - A)) / gap, 2)} = ${shown(linear, fmt)}$`,
          method: "Interpolated the principal portions linearly between the two given payments.",
          feedback: "Principal portions grow by a constant factor (1 + i), not by a constant amount. Interpolating linearly misstates the principal in every other payment.",
        }),
        distractor("ALG_ROOT_ERROR", rootErr, `${lit(A)}*(${lit(Bp)}/${lit(A)})**(${n - t1 + 1}/${gap + 1}) - ${lit(A)}*(${lit(Bp)}/${lit(A)})**(${t3 - t1}/${gap + 1})`, {
          derivation: `$1 + i = (${mnum(Bp, 2)}/${mnum(A, 2)})^{1/${gap + 1}} = ${dec(1 + rWrong, 6)}$, giving $I_{${t3}} = ${shown(rootErr, fmt)}$`,
          method: `Took the ${ord(gap + 1)} root of the ratio instead of the ${ord(gap)} root.`,
          feedback: `From payment ${t1} to payment ${t2} the principal is multiplied by (1 + i) exactly ${gap} times: $R_{${t2}} = R_{${t1}}(1+i)^{${gap}}$.`,
        }),
        distractor("VAR_INTEREST_FOR_PRINCIPAL", prin3, `${lit(A)}*${R}**${t3 - t1}`, {
          derivation: `$R_{${t3}} = ${mnum(A, 2)}(${dec(1 + r, 6)})^{${t3 - t1}} = ${shown(prin3, fmt)}$`,
          method: `Reported the principal in payment ${t3} instead of the interest.`,
          feedback: "The question asks for interest. Once the principal portion is known, interest is the payment minus that principal.",
        }),
        distractor("TIMING_BALANCE_INDEX", shifted, `${lit(A)}*${R}**${n - t1} - ${lit(A)}*${R}**${t3 - t1}`, {
          derivation: `$P = R_{${t1}}(1+i)^{${n - t1}} = ${mnum(A * Math.pow(1 + r, n - t1), 2)}$, so $I_{${t3}} = ${shown(shifted, fmt)}$`,
          method: `Recovered the payment with exponent n − t instead of n − t + 1.`,
          feedback: `$R_t = Pv^{n-t+1}$, so $P = R_{${t1}}(1+i)^{${n - t1 + 1}}$. The last payment's principal is $Pv$, not P.`,
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", original, `${rExpr}*${Pexpr}*((1-${R}**(-${n}))/${rExpr})`, {
          derivation: `$i \\times L = ${dec(r, 6)} \\times ${mnum(loanImplied, 2)} = ${shown(original, fmt)}$`,
          method: "Computed interest on the original loan amount.",
          feedback: `Interest on the original loan is the interest in the first payment only. By payment ${t3} the balance has fallen to $P\\,${aSym(n - t3 + 1)}$.`,
        }),
      ],
      explanation: explanation({
        intuition: "In a level-payment loan, the principal repaid each year is the previous year's principal times (1 + i): the balance falls, interest falls by i × (last principal), and the freed-up part of the payment goes to principal. So two principal amounts reveal the interest rate, and one principal amount plus the rate reveals the payment.",
        translation: {
          unknowns: [
            { symbol: "$i$", meaning: "the loan's effective rate (not given)" },
            { symbol: "$P$", meaning: "the level payment (not given)" },
          ],
          relationships: [`$R_{${t2}} = R_{${t1}}(1+i)^{${gap}}$`, `$R_{${t1}} = Pv^{${n - t1 + 1}}$`, `$I_{${t3}} = P - R_{${t3}}$`],
          conditions: [`$R_{${t1}} = ${mnum(A, 2)}$`, `$R_{${t2}} = ${mnum(Bp, 2)}$`, `${n} payments`],
          valuationDate: "No single valuation date is needed; the relationships link payments directly.",
          modelChoice: "Recognise the geometric sequence of principal portions, then reconstruct P.",
          assumptions: ["Level payments at the end of each year.", "A constant effective rate over the whole loan."],
        },
        solution: [
          { title: "Rate from the ratio", body: `$(1+i)^{${gap}} = \\dfrac{${mnum(Bp, 2)}}{${mnum(A, 2)}} \\Rightarrow i = ${dec(r, 6)}$` },
          { title: "Payment", body: `$P = R_{${t1}}(1+i)^{${n - t1 + 1}} = ${mnum(P, 2)}$` },
          { title: "Principal then interest", body: `$R_{${t3}} = ${mnum(A, 2)}(1+i)^{${t3 - t1}} = ${mnum(prin3, 2)}$, so $I_{${t3}} = ${mnum(P, 2)} - ${mnum(prin3, 2)} = ${shown(int3, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Through the balance",
            body: `$I_{${t3}} = i\\,B_{${t3 - 1}} = i\\,P\\,${aSym(n - t3 + 1)} = P(1 - v^{${n - t3 + 1}})$.`,
            whenUseful: "Same answer; useful when you want to sanity-check against the balance.",
          },
        ],
        transfer: {
          principle: "Principal portions of a level-payment loan form a geometric sequence with ratio (1 + i); interest portions are the payment minus that sequence.",
          unusual: "Neither the rate nor the payment is given. Both are hidden inside two principal amounts.",
          misread: "It looks like there is not enough information until the geometric structure is recognised.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Principal portions grow geometrically",
          unit: "year",
          series: [
            { label: "principal", values: range(1, n).map((t) => ({ t, amount: P * Math.pow(1 + r, -(n - t + 1)) })) },
            { label: "interest", values: range(1, n).map((t) => ({ t, amount: P - P * Math.pow(1 + r, -(n - t + 1)) })) },
          ],
          caption: `Each bar of principal is (1 + i) times the one before; payments ${t1} and ${t2} pin down i.`,
        },
      ],
      markers: [r, P, prin3],
      presentation: ["hidden-structure", "unknown-rate", "indirect-wording", "multi-equation"],
      features: features({ steps: 4, unfamiliar: true, multiConcept: true }),
      chain: chain(
        [
          step("D.principal-component", "Principal portions grow by (1 + i): their ratio reveals the rate.", ["i", r, "loan rate"], ["R_{t1}", "R_{t2}"], { rearranged: true, derived: true }),
          step("D.principal-component", "R_{t1} = P v^{n−t1+1}: recover the payment.", ["P", P, "level payment"], ["R_{t1}", "i"], { rearranged: true }),
          step("D.interest-component", "Interest = payment − principal in the target payment.", ["I_{t3}", int3, "interest in payment t3"], ["P", "R_{t3}"]),
        ],
        {
          methods: ["work_backwards", "rearrangement"],
          unconventional: lvl === 3,
          stages: {
            SEQ_GEOMETRIC_AS_ARITHMETIC: [0, "selection", "M.arithmetic-series"],
            ALG_ROOT_ERROR: [0, "application"],
            VAR_INTEREST_FOR_PRINCIPAL: [2, "interpretation"],
            TIMING_BALANCE_INDEX: [1, "application"],
            MODEL_INTEREST_ON_ORIGINAL: [2, "connection"],
          },
          reasoning: "Interest falls by i × (previous principal) each year, so principal rises by (1 + i): a geometric sequence pins down i, then P.",
        }
      ),
      params: { n, t1, t2, t3, A, B: Bp },
    };
  },
};

/** A number for prose with two decimals (stems that quote cents). */
function mnumPlain(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ===================================================================== drop payment

const dropPayment: QuestionTemplate = {
  id: "loan-drop-payment",
  family: "loan-final-payment",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.outstanding_balance", "ANNUITIES.level_payment"],
  reasoning: ["cashflow_modelling", "valuation_dates", "translation", "multistep"],
  soaConcept: "Loan repaid by level payments followed by a smaller final (drop) payment.",
  generate(rng, lvl): QuestionDraft {
    const { L, i, P, N } = drawUntil(
      () => {
        const L0 = gridAmount(rng, 10000, 60000, 1000);
        const i0 = gridRate(rng, 0.04, 0.09, 0.005);
        const P0 = gridAmount(rng, Math.round(L0 * 0.09 / 50) * 50, Math.round(L0 * 0.18 / 50) * 50, 50);
        const nStar = -Math.log(1 - (L0 * i0) / P0) / Math.log(1 + i0);
        return { L: L0, i: i0, P: P0, N: Math.floor(nStar), frac: nStar - Math.floor(nStar) };
      },
      (d) => Number.isFinite(d.N) && d.N >= 6 && d.N <= 20 && d.frac > 0.2 && d.frac < 0.8
    );
    const BN = balanceRetro(L, P, i, N);
    const fmt = MONEY2;
    const G = onePlus(i);
    // Level 2 defers the first payment to the end of year 2.
    const deferWords = lvl === 2;
    const shift = deferWords ? 1 : 0;
    const loanShown = deferWords ? Number((L * v(i, shift)).toFixed(2)) : L;
    const BNfinal = deferWords ? loanShown * acc(i, N + shift) - P * sn(N, i) : BN;
    const dropFinal = BNfinal * (1 + i);
    const BNfinalExpr = `(${lit(loanShown)}*${accPow(i, N + shift)} - ${lit(P)}*${sExpr(N, i)})`;
    const lastRegular = N + shift;
    return {
      stem: deferWords
        ? `A loan of ${mnumPlain(loanShown)} is made at an annual effective interest rate of ${pc(i)}. It is repaid with payments of ${amt(P)} at the end of each year, the first payment being made two years after the loan is made, for as long as necessary, followed by a smaller final payment one year after the last payment of ${amt(P)}.\n\nCalculate the amount of the final payment.`
        : `A loan of ${amt(L)} is made at an annual effective interest rate of ${pc(i)}. It is repaid with payments of ${amt(P)} at the end of each year for as long as necessary, followed by a smaller final payment one year after the last payment of ${amt(P)}.\n\nCalculate the amount of the final payment.`,
      answer: {
        value: dropFinal,
        calc: `${BNfinalExpr}*${G}`,
        format: fmt,
        derivation: `$\\text{final} = B_{${lastRegular}}(1+i) = ${mnum(BNfinal, 2)} \\times ${dec(1 + i, 4)} = ${shown(dropFinal, fmt)}$`,
      },
      model: {
        expr: `${lit(loanShown)} - (${pvTerms(level(P, range(1 + shift, N + shift)), i)} + x*${vPow(i, N + shift + 1)})`,
        bracket: [0, P],
        description: "At the loan date, the loan equals the PV of every regular payment plus the PV of the final payment one year after the last regular one.",
      },
      distractors: [
        distractor("TIMING_MISSING_PERIOD", BNfinal, BNfinalExpr, {
          derivation: `$B_{${lastRegular}} = ${shown(BNfinal, fmt)}$`,
          method: "Reported the balance after the last regular payment as the final payment.",
          feedback: "The final payment is made one year after the last regular payment, so the balance accrues a further year of interest before it is paid off.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", P + BNfinal, `${lit(P)} + ${BNfinalExpr}`, {
          derivation: `$${P} + ${mnum(BNfinal, 2)} = ${shown(P + BNfinal, fmt)}$`,
          method: "Computed a balloon payment (the last regular payment enlarged) instead of a separate drop payment.",
          feedback: "A balloon payment adds the remaining balance to the last regular payment. Here the loan is cleared by a separate smaller payment one year later — a drop payment.",
        }),
        distractor("TIMING_EXTRA_PERIOD", BNfinal * (1 + i) * (1 + i), `${BNfinalExpr}*${G}**2`, {
          derivation: `$B_{${lastRegular}}(1+i)^2 = ${shown(BNfinal * (1 + i) ** 2, fmt)}$`,
          method: "Accumulated the remaining balance for two years.",
          feedback: "The final payment comes one year after the last regular payment: one year of interest, not two.",
        }),
        distractor("VAR_INTEREST_FOR_PRINCIPAL", BNfinal * i, `${BNfinalExpr}*${lit(i)}`, {
          derivation: `$i\\,B_{${lastRegular}} = ${dec(i, 3)} \\times ${mnum(BNfinal, 2)} = ${shown(BNfinal * i, fmt)}$`,
          method: "Took only the interest on the remaining balance.",
          feedback: "The final payment must repay the remaining balance as well as its interest.",
        }),
        distractor("ALG_INVERTED_RATIO", BNfinal / (1 + i), `${BNfinalExpr}/${G}`, {
          derivation: `$B_{${lastRegular}}\\,v = ${shown(BNfinal / (1 + i), fmt)}$`,
          method: "Discounted the remaining balance instead of accumulating it to the later payment date.",
          feedback: "Moving an amount to a later date adds interest; the final payment is later than the balance date.",
        }),
      ],
      explanation: explanation({
        intuition: `Payments of ${amt(P)} are too large to come out exactly even. After the last full payment a little is still owed; it sits for one more year collecting interest, and the final payment clears it.`,
        translation: {
          unknowns: [
            { symbol: "$N$", meaning: "the number of regular payments" },
            { symbol: "$F$", meaning: "the final payment" },
          ],
          relationships: [
            deferWords ? `$L = ${P}\\,v\\,${aSym("N")} + F v^{N+2}$` : `$L = ${P}\\,${aSym("N")} + F v^{N+1}$`,
            `$F = B_{\\text{last}}(1+i)$`,
          ],
          conditions: [`$N$ is the largest whole number of regular payments the loan supports`, `$0 < F < ${P}$`],
          valuationDate: `Time ${lastRegular}, the last regular payment — then one year forward.`,
          modelChoice: "Find N from the annuity factor, then the retrospective balance, then one year's interest.",
          assumptions: deferWords
            ? ["The first payment is at time 2.", "The final payment is exactly one year after the last regular payment."]
            : ["The first payment is at time 1.", "The final payment is exactly one year after the last regular payment."],
        },
        solution: [
          {
            title: "Number of regular payments",
            body: deferWords
              ? `$${P}\\,${aSym("n")} = L(1+i) = ${mnum(loanShown * (1 + i), 2)}$ gives $n = ${dec(Math.log(1 - (loanShown * (1 + i) * i) / P) / -Math.log(1 + i), 3)}$, so $N = ${N}$.`
              : `$${P}\\,${aSym("n")} = ${mamt(L)}$ gives $n = ${dec(-Math.log(1 - (L * i) / P) / Math.log(1 + i), 3)}$, so $N = ${N}$.`,
          },
          {
            title: "Balance after the last regular payment",
            body: `$B_{${lastRegular}} = ${deferWords ? mnum(loanShown, 2) : mamt(L)}(1+i)^{${lastRegular}} - ${P}\\,${sSym(N)} = ${mnum(BNfinal, 2)}$`,
          },
          { title: "One more year", body: `$F = ${mnum(BNfinal, 2)} \\times ${dec(1 + i, 4)} = ${shown(dropFinal, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Equation of value at time 0",
            body: `$F = \\big(L - ${P}${deferWords ? "\\,v" : ""}\\,${aSym(N)}\\big)(1+i)^{${lastRegular + 1}}$`,
            whenUseful: "One line once N is known.",
          },
          {
            name: "Calculator",
            body: "Solve for N, then compute the future value after N payments and roll forward one period.",
            whenUseful: "Fast with a financial calculator, but make sure the remaining balance is moved forward a year.",
          },
        ],
        transfer: {
          principle: "Any final irregular payment equals the balance owed just before it, accumulated to its own date.",
          unusual: deferWords ? "The first payment is deferred, so every date shifts by a year." : "The number of payments must be found before anything else.",
          misread: "Drop and balloon payments sound alike but sit at different dates.",
        },
      }),
      visuals: [
        {
          kind: "amortization",
          title: "Regular payments, then the drop payment",
          principal: deferWords ? loanShown * (1 + i) : L,
          rate: i,
          payments: [...Array.from({ length: N }, () => P), dropFinal],
          unit: "year",
          highlightPeriod: N + 1,
          caption: deferWords ? "Shown from time 1, when the deferred loan has grown to L(1 + i)." : undefined,
        },
      ],
      markers: [N, BNfinal],
      presentation: deferWords ? ["unknown-time", "deferred", "work-backwards"] : ["unknown-time"],
      features: features({ steps: 3, unfamiliar: deferWords, multipleValuationDates: true }),
      chain: chain(
        [
          step("D.loan-payment", "How many full payments the loan supports: solve P a_n = L for n, round down.", ["N", N, "number of regular payments"], ["L", "P", "i"], { rearranged: true }),
          step("D.retrospective", "Balance just after the last regular payment.", ["B_N", BNfinal, "balance after the last full payment"], ["L", "P", "N"], { valuationDate: "last regular payment" }),
          step("D.drop-balloon", "The drop payment clears that balance one year later.", ["final", dropFinal, "drop payment"], ["B_N", "i"]),
        ],
        {
          methods: deferWords ? ["logarithms", "valuation_dates", "work_backwards"] : ["logarithms", "valuation_dates"],
          stages: {
            TIMING_MISSING_PERIOD: [2, "connection"],
            VAR_TOTAL_FOR_COMPONENT: [2, "selection"],
            TIMING_EXTRA_PERIOD: [2, "application"],
            VAR_INTEREST_FOR_PRINCIPAL: [2, "interpretation"],
            ALG_INVERTED_RATIO: [2, "application"],
          },
          reasoning: "Equation of value at time 0: L = P·(regular payments) + F·v^{last+1}; solve for F once N is known.",
        }
      ),
      params: { L: loanShown, i, P, N },
    };
  },
};

// ===================================================================== refinancing

const refinance: QuestionTemplate = {
  id: "loan-refinance",
  family: "loan-refinance",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.outstanding_balance", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "translation", "formula_selection"],
  soaConcept: "Loan refinanced part-way through its term at a new rate.",
  generate(rng, lvl): QuestionDraft {
    const L = gridAmount(rng, 50000, 250000, 5000);
    const n = rng.int(15, 30);
    const k = rng.int(4, n - 6);
    const i = gridRate(rng, 0.05, 0.09, 0.0025);
    const j = Number((i - gridRate(rng, 0.01, 0.025, 0.0025)).toFixed(4));
    const P = levelPayment(L, n, i);
    const Bk = P * an(n - k, i);
    const Pexpr = `(${lit(L)}/${aExpr(n, i)})`;
    const Pexplicit = `(${lit(L)}/${sumV(i, 1, n)})`;
    const BkExpr = `(${Pexpr}*${aExpr(n - k, i)})`;
    const BkExplicit = `(${lit(L)}*${accPow(i, k)} - ${Pexplicit}*${sumOf(range(0, k - 1).map((e) => accPow(i, e)))})`;
    const fmt = MONEY2;

    if (lvl === 2) {
      const Q = Bk / an(n - k, j);
      const extraPeriod = Bk / an(n - k + 1, j);
      const original = L / an(n - k, j);
      const atNew = (L * acc(j, k) - P * sn(k, j)) / an(n - k, j);
      const due = Bk / adue(n - k, j);
      return {
        stem: `A loan of ${amt(L)} is to be repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}. Immediately after the ${ord(k)} payment, the borrower refinances the outstanding balance at an annual effective rate of ${pc(j)}. The new loan is repaid with level payments at the end of each year, ending on the same date as the original loan.\n\nCalculate the new annual payment.`,
        answer: {
          value: Q,
          calc: `${BkExpr}/${aExpr(n - k, j)}`,
          format: fmt,
          derivation: `$Q = \\dfrac{B_{${k}}}{${aSym(n - k, "j")}} = \\dfrac{${mnum(Bk, 2)}}{${dec(an(n - k, j), 5)}} = ${shown(Q, fmt)}$`,
        },
        model: {
          expr: `${BkExplicit} - x*${sumV(j, 1, n - k)}`,
          bracket: [0, Bk],
          description: `The balance owed at time ${k} under the old loan (accumulated at ${pc(i)}) equals the PV at ${pc(j)} of the ${n - k} new payments.`,
        },
        distractors: [
          distractor("TIMING_REFINANCE_PERIODS", extraPeriod, `${BkExpr}/${aExpr(n - k + 1, j)}`, {
            derivation: `$B_{${k}} / ${aSym(n - k + 1, "j")} = ${shown(extraPeriod, fmt)}$`,
            method: `Spread the balance over ${n - k + 1} new payments.`,
            feedback: `The new loan ends when the old one would have. After ${k} of ${n} payments, ${n - k} payments remain.`,
          }),
          distractor("VAR_ORIGINAL_FOR_OUTSTANDING", original, `${lit(L)}/${aExpr(n - k, j)}`, {
            derivation: `$${mamt(L)} / ${aSym(n - k, "j")} = ${shown(original, fmt)}$`,
            method: "Refinanced the original loan amount rather than the outstanding balance.",
            feedback: `By time ${k}, ${k} payments have reduced the debt to ${amt(Bk)}. Only that balance is refinanced.`,
          }),
          distractor("MODEL_BALANCE_AT_NEW_RATE", atNew, `(${lit(L)}*${accPow(j, k)} - ${Pexpr}*${sExpr(k, j)})/${aExpr(n - k, j)}`, {
            derivation: `$B'_{${k}} = L(1.${String(j).slice(2)})^{${k}} - P\\,${sSym(k, "j")} = ${mnum(L * acc(j, k) - P * sn(k, j), 2)}$, then $\\div ${aSym(n - k, "j")} = ${shown(atNew, fmt)}$`,
            method: "Computed the balance at the refinancing date using the new rate.",
            feedback: `The old loan charged ${pc(i)} for its first ${k} years. The balance owed at time ${k} is fixed by those terms; the new rate applies only from time ${k} onward.`,
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", due, `${BkExpr}/${adueExpr(n - k, j)}`, {
            derivation: `$B_{${k}} / ${adueSym(n - k, "j")} = ${shown(due, fmt)}$`,
            method: "Started the new payments immediately at the refinancing date.",
            feedback: `The new payments, like the old ones, are at the end of each year — the first is one year after refinancing.`,
          }),
          distractor("TIMING_BALANCE_INDEX", (P * an(n - k + 1, i)) / an(n - k, j), `${Pexpr}*${aExpr(n - k + 1, i)}/${aExpr(n - k, j)}`, {
            derivation: `$P\\,${aSym(n - k + 1)} / ${aSym(n - k, "j")} = ${shown((P * an(n - k + 1, i)) / an(n - k, j), fmt)}$`,
            method: "Refinanced the balance before the k-th payment.",
            feedback: `Refinancing is immediately after the ${ord(k)} payment, so that payment has already reduced the balance.`,
          }),
        ],
        explanation: refinanceExplanation({ L, n, k, i, j, P, Bk, Q, fmt, monthly: false }),
        visuals: [
          {
            kind: "amortization",
            title: "Old loan, refinancing date, new loan",
            principal: L,
            rate: i,
            payments: Array.from({ length: k }, () => P),
            unit: "year",
            refinance: { atPeriod: k, newRate: j, newPayments: Array.from({ length: n - k }, () => Q) },
            highlightPeriod: k,
          },
          refinanceFlow(L, k, n, i, j, P, Bk, Q, "annual"),
        ],
        markers: [P, Bk],
        presentation: ["mixed-timing", "multi-equation"],
        features: features({ steps: 3, multiConcept: true, multipleValuationDates: true }),
        chain: chain(
          [
            step("D.loan-payment", "Payment on the original loan.", ["P", P, "original payment"], ["L", "n", "i"], { rearranged: true }),
            step("D.prospective", "Balance owed at the refinancing date — at the OLD rate.", ["B_k", Bk, "balance at refinancing"], ["P", "n − k", "i"], { valuationDate: "k" }),
            step("B.annuity-immediate", "Annuity factor for the new loan at the NEW rate.", ["a_{n−k|j}", an(n - k, j), "new annuity factor"], ["n − k", "j"]),
            step("D.loan-payment", "The balance becomes the new principal: Q = B_k / factor.", ["Q", Q, "new payment"], ["B_k", "a"], { rearranged: true }),
          ],
          {
            stages: {
              TIMING_REFINANCE_PERIODS: [2, "connection"],
              VAR_ORIGINAL_FOR_OUTSTANDING: [3, "connection"],
              MODEL_BALANCE_AT_NEW_RATE: [1, "application"],
              TIMING_IMMEDIATE_AS_DUE: [2, "selection", "B.annuity-due"],
              TIMING_BALANCE_INDEX: [1, "application"],
            },
            reasoning: "Two equations of value: at time 0 for the old loan and at time k for the new one, joined by the balance at time k.",
          }
        ),
        params: { L, n, k, i, j },
      };
    }

    // Level 3: cash-out refinance into monthly payments at a nominal rate.
    const m = rng.int(8, 20);
    const C = gridAmount(rng, 5000, 30000, 1000);
    const j12 = Number((j + 0.0025).toFixed(4));
    const mj = j12 / 12;
    const Q = (Bk + C) / an(12 * m, mj);
    const effMonthly = Math.pow(1 + j12, 1 / 12) - 1;
    const asEffective = (Bk + C) / an(12 * m, effMonthly);
    const annualOver12 = (Bk + C) / an(m, Math.pow(1 + mj, 12) - 1) / 12;
    const noCash = Bk / an(12 * m, mj);
    const fromOriginal = (L + C) / an(12 * m, mj);
    const wrongCount = (P * an(n - k + 1, i) + C) / an(12 * m, mj);
    const mjs = `(${lit(j12)}/12)`;
    return {
      stem: `A loan of ${amt(L)} is to be repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}. Immediately after the ${ord(k)} payment, the borrower takes out a new loan equal to the outstanding balance plus an additional ${amt(C)} in cash. The new loan has an annual nominal interest rate of ${pc(j12)} convertible monthly and is repaid with level payments at the end of each month for ${m} years.\n\nCalculate the new monthly payment.`,
      answer: {
        value: Q,
        calc: `(${BkExpr} + ${lit(C)})/${aExpr(12 * m, mjs)}`,
        format: fmt,
        derivation: `$Q = \\dfrac{${mnum(Bk, 2)} + ${C}}{${aSym(12 * m)}\\text{ at } ${dec(mj, 6)}} = ${shown(Q, fmt)}$`,
      },
      model: {
        expr: `${BkExplicit} + ${lit(C)} - x*${sumOf(range(1, 12 * m).map((t) => vPow(mjs, t)))}`,
        bracket: [0, Bk + C],
        description: "Old-loan balance (at the old rate) plus the cash equals the PV of the monthly payments at the monthly rate j⁽¹²⁾/12.",
      },
      distractors: [
        distractor("RATE_NOMINAL_AS_EFFECTIVE", asEffective, `(${BkExpr} + ${lit(C)})/${aExpr(12 * m, `((1+${lit(j12)})**(1/12)-1)`)}`, {
          derivation: `monthly rate $(1.${String(j12).slice(2)})^{1/12} - 1 = ${dec(effMonthly, 6)}$, so $Q = ${shown(asEffective, fmt)}$`,
          method: `Treated ${pc(j12)} as an annual effective rate and converted it to a monthly rate.`,
          feedback: `“Nominal, convertible monthly” means the monthly rate is exactly ${pc(j12)}/12 = ${dec(mj, 6)}. No root is taken.`,
        }),
        distractor("RATE_PAYMENT_FREQUENCY", annualOver12, `(${BkExpr} + ${lit(C)})/${aExpr(m, `((1+${mjs})**12-1)`)}/12`, {
          derivation: `annual payment $= ${mnum((Bk + C) / an(m, Math.pow(1 + mj, 12) - 1), 2)}$, then $\\div 12 = ${shown(annualOver12, fmt)}$`,
          method: "Found an equivalent annual payment and divided it by 12.",
          feedback: "Monthly payments made during the year repay the loan earlier than one annual payment. Work in months throughout: 12m payments at the monthly rate.",
        }),
        distractor("TRANS_IGNORED_CONDITION", noCash, `${BkExpr}/${aExpr(12 * m, mjs)}`, {
          derivation: `$${mnum(Bk, 2)} / ${aSym(12 * m)} = ${shown(noCash, fmt)}$`,
          method: `Left the additional ${amt(C)} out of the new loan.`,
          feedback: `The new loan is the balance plus ${amt(C)} of cash; both must be repaid.`,
        }),
        distractor("VAR_ORIGINAL_FOR_OUTSTANDING", fromOriginal, `(${lit(L)} + ${lit(C)})/${aExpr(12 * m, mjs)}`, {
          derivation: `$(${mamt(L)} + ${C}) / ${aSym(12 * m)} = ${shown(fromOriginal, fmt)}$`,
          method: "Refinanced the original loan amount plus the cash.",
          feedback: `Only the balance outstanding at time ${k} — ${amt(Bk)} — is still owed.`,
        }),
        distractor("TIMING_REFINANCE_PERIODS", wrongCount, `(${Pexpr}*${aExpr(n - k + 1, i)} + ${lit(C)})/${aExpr(12 * m, mjs)}`, {
          derivation: `$(P\\,${aSym(n - k + 1)} + ${C}) / ${aSym(12 * m)} = ${shown(wrongCount, fmt)}$`,
          method: `Counted ${n - k + 1} old payments as still outstanding.`,
          feedback: `Immediately after the ${ord(k)} payment, ${n - k} old payments remain.`,
        }),
      ],
      explanation: refinanceExplanation({ L, n, k, i, j: j12, P, Bk, Q, fmt, monthly: true, C, m }),
      visuals: [
        {
          kind: "amortization",
          title: "Old loan to the refinancing date",
          principal: L,
          rate: i,
          payments: Array.from({ length: k }, () => P),
          unit: "year",
          highlightPeriod: k,
        },
        refinanceFlow(L, k, n, i, j12, P, Bk, Q, "monthly", C),
      ],
      markers: [P, Bk, Bk + C, mj],
      presentation: ["frequency", "multi-equation", "combined-topics", "mixed-timing"],
      features: features({ steps: 4, multiConcept: true, multipleValuationDates: true, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("D.loan-payment", "Payment on the original loan.", ["P", P, "original payment"], ["L", "n", "i"], { rearranged: true }),
          step("D.prospective", "Balance at the refinancing date, at the old rate.", ["B_k", Bk, "balance at refinancing"], ["P", "n − k"], { valuationDate: "k" }),
          step("A.nominal-equivalence", "Nominal rate convertible monthly → monthly rate.", ["j/12", mj, "monthly rate"], ["j^{(12)}"]),
          step("B.annuity-immediate", "Annuity factor for 12m monthly payments.", ["a_{12m}", an(12 * m, mj), "new annuity factor"], ["12m", "j/12"]),
          step("D.loan-payment", "New principal (balance + cash) ÷ factor.", ["Q", Q, "monthly payment"], ["B_k + C"], { rearranged: true }),
        ],
        {
          methods: ["valuation_dates"],
          unconventional: true,
          stages: {
            RATE_NOMINAL_AS_EFFECTIVE: [2, "application"],
            RATE_PAYMENT_FREQUENCY: [3, "selection"],
            TRANS_IGNORED_CONDITION: [4, "connection"],
            VAR_ORIGINAL_FOR_OUTSTANDING: [4, "connection"],
            TIMING_REFINANCE_PERIODS: [1, "application"],
          },
          reasoning: "Value the old loan at time k with its own terms; at time k start a monthly loan for the balance plus the cash.",
        }
      ),
      params: { L, n, k, i, j12, C, m },
    };
  },
};

function refinanceFlow(
  L: number,
  k: number,
  n: number,
  i: number,
  j: number,
  P: number,
  Bk: number,
  Q: number,
  frequency: "annual" | "monthly",
  C = 0
) {
  return {
    kind: "flowchart" as const,
    title: "How the refinancing chains together",
    nodes: [
      { id: "loan", label: `Original loan ${amt(L)}`, detail: `${n} payments at ${pc(i)}`, tone: "input" as const },
      { id: "pay", label: `Payment $P = ${mnum(P, 2)}$`, detail: `from $L / ${aSym(n)}$ at ${pc(i)}`, tone: "step" as const },
      { id: "bal", label: `Balance at time ${k}: $${mnum(Bk, 2)}$`, detail: `$P\\,${aSym(n - k)}$ at the OLD rate`, tone: "step" as const },
      ...(C ? [{ id: "cash", label: `Plus cash ${amt(C)}`, tone: "input" as const }] : []),
      {
        id: "new",
        label: `New payment $${mnum(Q, 2)}$`,
        detail: frequency === "annual" ? `over ${n - k} years at ${pc(j)}` : `monthly at ${pc(j)}/12`,
        tone: "result" as const,
      },
    ],
    edges: [
      { from: "loan", to: "pay" },
      { from: "pay", to: "bal", label: `${k} payments made` },
      ...(C ? [{ from: "cash", to: "new" }] : []),
      { from: "bal", to: "new", label: "re-amortize at the NEW rate" },
    ],
  };
}

function refinanceExplanation(p: {
  L: number;
  n: number;
  k: number;
  i: number;
  j: number;
  P: number;
  Bk: number;
  Q: number;
  fmt: typeof MONEY2;
  monthly: boolean;
  C?: number;
  m?: number;
}) {
  const { L, n, k, i, j, P, Bk, Q, fmt, monthly, C = 0, m = 0 } = p;
  return explanation({
    intuition: `Refinancing ends one loan and starts another on the same date. The old loan's terms decide how much is owed on that date; the new loan's terms decide how that amount is repaid. The two rates never mix.`,
    translation: {
      unknowns: [
        { symbol: "$P$", meaning: "the original annual payment" },
        { symbol: `$B_{${k}}$`, meaning: `the balance owed immediately after payment ${k}, at the old rate` },
        { symbol: "$Q$", meaning: monthly ? "the new monthly payment" : "the new annual payment" },
      ],
      relationships: [
        `$P = L/${aSym(n)}$ at ${mpc(i)}`,
        `$B_{${k}} = P\\,${aSym(n - k)}$ at ${mpc(i)}`,
        monthly
          ? `$B_{${k}} + ${C} = Q\\,${aSym(12 * m)}$ at ${mpc(j)}/12 per month`
          : `$B_{${k}} = Q\\,${aSym(n - k, "j")}$ at ${mpc(j)}`,
      ],
      conditions: monthly
        ? [`The new loan includes ${amt(C)} of cash.`, `${12 * m} monthly payments.`]
        : [`The new loan ends with the original: ${n - k} payments remain.`],
      valuationDate: `Time ${k}, the refinancing date — the hinge between the two loans.`,
      modelChoice: "Two-stage model: prospective balance on the old loan, then a new level-payment loan.",
      assumptions: ["Refinancing happens immediately after a regular payment.", "Payments under both loans are made at the end of each period."],
    },
    solution: [
      { title: "Original payment", body: `$P = ${mamt(L)} / ${dec(an(n, i), 5)} = ${mnum(P, 2)}$` },
      { title: "Balance at refinancing (old rate)", body: `$B_{${k}} = ${mnum(P, 2)} \\times ${dec(an(n - k, i), 5)} = ${mnum(Bk, 2)}$` },
      monthly
        ? { title: "New monthly payment", body: `$Q = \\dfrac{${mnum(Bk + C, 2)}}{${dec(an(12 * m, j / 12), 5)}} = ${shown(Q, fmt)}$` }
        : { title: "New payment (new rate)", body: `$Q = \\dfrac{${mnum(Bk, 2)}}{${dec(an(n - k, j), 5)}} = ${shown(Q, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Retrospective balance",
        body: `$B_{${k}} = L(1+i)^{${k}} - P\\,${sSym(k)} = ${mnum(balanceRetro(L, P, i, k), 2)}$ — the same balance.`,
        whenUseful: "Use it when the old loan's remaining term is awkward or the old payments were irregular.",
      },
      {
        name: "Calculator: two worksheets",
        body: "Amortize the old loan to payment k, read the balance, then solve a fresh loan for the payment.",
        whenUseful: "Fast, but only if you consciously change the rate and the number of periods between the two worksheets.",
      },
    ],
    transfer: {
      principle: "At a refinancing date, value what is owed under the OLD terms, then treat it as a brand-new loan under the NEW terms.",
      unusual: monthly ? "The new loan changes payment frequency and adds cash, so three things change at once." : "The new loan ends when the old one would have, so the remaining count must be derived.",
      misread: "Using the new rate for the old balance, or counting one payment too many, are the classic slips.",
    },
  });
}

// ===================================================================== two-phase payments

const stepPayments: QuestionTemplate = {
  id: "loan-step-payments",
  family: "loan-structure",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.unknown_variables",
  secondary: ["ANNUITIES.non_level", "ANNUITIES.immediate_due"],
  reasoning: ["translation", "cashflow_modelling", "valuation_dates", "algebra"],
  soaConcept: "Loan repaid by payments that change level part-way through the term.",
  generate(rng, lvl): QuestionDraft {
    const L = gridAmount(rng, 20000, 120000, 5000);
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(12, 25);
    const m = rng.int(4, n - 5);
    const fmt = MONEY2;
    const am = an(m, i);
    const rest = an(n - m, i);
    const vm = v(i, m);

    if (lvl === 1) {
      const c = rng.choice([2, 3]);
      const cw = c === 2 ? "twice" : "three times";
      const X = L / (am + c * vm * rest);
      const noDefer = L / (am + c * rest);
      const offByOne = L / (am + c * v(i, m + 1) * rest);
      const levelV = L / an(n, i);
      const inverted = L / (am + (1 / c) * vm * rest);
      const undisc = L / (m + c * (n - m));
      return {
        stem: `A loan of ${amt(L)} is repaid with payments at the end of each year for ${n} years. Each of the first ${m} payments is $X$, and each of the remaining ${n - m} payments is ${cw} as large. The annual effective interest rate is ${pc(i)}.\n\nCalculate $X$.`,
        answer: {
          value: X,
          calc: `${lit(L)}/(${aExpr(m, i)} + ${c}*${vPow(i, m)}*${aExpr(n - m, i)})`,
          format: fmt,
          derivation: `$X = \\dfrac{${mamt(L)}}{${aSym(m)} + ${c}v^{${m}}${aSym(n - m)}} = ${shown(X, fmt)}$`,
        },
        model: {
          expr: `${lit(L)} - ${pvTerms([...level("x", range(1, m)), ...level(`${c}*x`, range(m + 1, n))], i)}`,
          bracket: [0, L],
          description: "The loan equals the PV of every payment, written one by one.",
        },
        distractors: [
          distractor("TIMING_IGNORED_DEFERRAL", noDefer, `${lit(L)}/(${aExpr(m, i)} + ${c}*${aExpr(n - m, i)})`, {
            derivation: `$${mamt(L)} / (${aSym(m)} + ${c}${aSym(n - m)}) = ${shown(noDefer, fmt)}$`,
            method: "Valued the later payments as if they started at time 1.",
            feedback: `The larger payments start at time ${m + 1}. Their annuity factor values them at time ${m}, so they must be discounted by $v^{${m}}$.`,
          }),
          distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, `${lit(L)}/(${aExpr(m, i)} + ${c}*${vPow(i, m + 1)}*${aExpr(n - m, i)})`, {
            derivation: `$${mamt(L)} / (${aSym(m)} + ${c}v^{${m + 1}}${aSym(n - m)}) = ${shown(offByOne, fmt)}$`,
            method: `Discounted the second stream by $v^{${m + 1}}$ (to the date of its first payment).`,
            feedback: `An annuity-immediate factor leaves its value one period before the first payment, at time ${m}, so the discount is $v^{${m}}$.`,
          }),
          distractor("MODEL_LEVEL_FOR_VARYING", levelV, `${lit(L)}/${aExpr(n, i)}`, {
            derivation: `$${mamt(L)} / ${aSym(n)} = ${shown(levelV, fmt)}$`,
            method: "Treated all payments as level.",
            feedback: "The later payments are larger, so a level payment over-states X.",
          }),
          distractor("TRANS_INVERTED_RELATION", inverted, `${lit(L)}/(${aExpr(m, i)} + (1/${c})*${vPow(i, m)}*${aExpr(n - m, i)})`, {
            derivation: `$${mamt(L)} / (${aSym(m)} + \\tfrac{1}{${c}}v^{${m}}${aSym(n - m)}) = ${shown(inverted, fmt)}$`,
            method: `Made the later payments $X/${c}$ instead of $${c}X$.`,
            feedback: `“${cw} as large” means each later payment is ${c}X.`,
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", undisc, `${lit(L)}/(${m} + ${c}*${n - m})`, {
            derivation: `$${mamt(L)} / (${m} + ${c}\\times${n - m}) = ${shown(undisc, fmt)}$`,
            method: "Divided the loan by the total of the payment multiples, ignoring interest.",
            feedback: "Interest is charged on the balance, so the payments must be worth the loan at the loan's rate — their undiscounted total is larger than the loan.",
          }),
        ],
        explanation: stepExplanation({ L, i, n, m, X, fmt, factor: c }),
        visuals: [
          {
            kind: "timeline",
            title: "Two payment phases",
            unit: "year",
            rate: i,
            flows: [
              ...range(1, m).map((t) => ({ t, amount: X, dir: "out" as const, label: "X", group: "phase 1" })),
              ...range(m + 1, n).map((t) => ({ t, amount: c * X, dir: "out" as const, label: `${c}X`, group: "phase 2" })),
            ],
            valuationTimes: [0, m],
            caption: `The second phase's annuity factor leaves its value at time ${m}, not at time ${m + 1}.`,
          },
        ],
        markers: [am, vm * rest],
        presentation: ["deferred", "rearrange-first"],
        features: features({ steps: 3, multipleValuationDates: true }),
        chain: chain(
          [
            step("B.annuity-immediate", "First phase: m payments of X.", ["a_m", am, "first-phase factor"], ["m", "i"]),
            step("B.deferred", "Second phase starts after m years: deferred annuity.", ["v^m a_{n−m}", vm * rest, "second-phase factor"], ["m", "n − m"], { valuationDate: "m → 0" }),
            step("A.equation-of-value", "Loan = X·(first) + cX·(second); solve for X.", ["X", X, "first-phase payment"], ["L", "c"], { rearranged: true }),
          ],
          {
            methods: ["decomposition", "equation_construction"],
            stages: {
              TIMING_IGNORED_DEFERRAL: [1, "application"],
              TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
              MODEL_LEVEL_FOR_VARYING: [0, "selection"],
              TRANS_INVERTED_RELATION: [2, "connection"],
              SEQ_UNDISCOUNTED_SUM: [2, "application"],
            },
            reasoning: "v^m a_{n−m} = a_n − a_m: the second phase is the whole term minus the first phase, so no deferral exponent is needed.",
          }
        ),
        params: { L, i, n, m, c },
      };
    }

    const D = gridAmount(rng, 500, 4000, 100);
    const X = (L - D * vm * rest) / an(n, i);
    const Y = X + D;
    const noDefer = (L - D * rest) / an(n, i) + D;
    const offByOne = (L - D * v(i, m + 1) * rest) / an(n, i) + D;
    return {
      stem: `A loan of ${amt(L)} is repaid with payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}. Each of the last ${n - m} payments is ${amt(D)} larger than each of the first ${m} payments.\n\nCalculate the amount of each of the last ${n - m} payments.`,
      answer: {
        value: Y,
        calc: `(${lit(L)} - ${lit(D)}*${vPow(i, m)}*${aExpr(n - m, i)})/${aExpr(n, i)} + ${lit(D)}`,
        format: fmt,
        derivation: `$Y = X + ${D} = \\dfrac{${mamt(L)} - ${D}v^{${m}}${aSym(n - m)}}{${aSym(n)}} + ${D} = ${shown(Y, fmt)}$`,
      },
      model: {
        expr: `${lit(L)} - ${pvTerms([...level(`(x-${lit(D)})`, range(1, m)), ...level("x", range(m + 1, n))], i)}`,
        bracket: [0, L],
        description: "With Y the later payment, the earlier ones are Y − D; the loan equals the PV of all payments.",
      },
      distractors: [
        distractor("VAR_OTHER_UNKNOWN", X, `(${lit(L)} - ${lit(D)}*${vPow(i, m)}*${aExpr(n - m, i)})/${aExpr(n, i)}`, {
          derivation: `$X = ${shown(X, fmt)}$`,
          method: "Reported the first-phase payment X.",
          feedback: `The question asks for the later payments, X + ${D}.`,
        }),
        distractor("TIMING_IGNORED_DEFERRAL", noDefer, `(${lit(L)} - ${lit(D)}*${aExpr(n - m, i)})/${aExpr(n, i)} + ${lit(D)}`, {
          derivation: `$\\dfrac{${mamt(L)} - ${D}${aSym(n - m)}}{${aSym(n)}} + ${D} = ${shown(noDefer, fmt)}$`,
          method: "Valued the extra amount D as if it were paid from time 1.",
          feedback: `The extra ${amt(D)} is paid only from time ${m + 1}; its value sits at time ${m} and needs $v^{${m}}$.`,
        }),
        distractor("TIMING_DEFERRAL_OFF_BY_ONE", offByOne, `(${lit(L)} - ${lit(D)}*${vPow(i, m + 1)}*${aExpr(n - m, i)})/${aExpr(n, i)} + ${lit(D)}`, {
          derivation: `$\\dfrac{${mamt(L)} - ${D}v^{${m + 1}}${aSym(n - m)}}{${aSym(n)}} + ${D} = ${shown(offByOne, fmt)}$`,
          method: `Discounted the extra-payment annuity by $v^{${m + 1}}$.`,
          feedback: `A deferred annuity-immediate whose first payment is at ${m + 1} is $v^{${m}}${aSym(n - m)}$.`,
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", L / an(n, i) + D, `${lit(L)}/${aExpr(n, i)} + ${lit(D)}`, {
          derivation: `$${mamt(L)}/${aSym(n)} + ${D} = ${shown(L / an(n, i) + D, fmt)}$`,
          method: "Computed a level payment for the whole loan and added D to it.",
          feedback: "If every payment were the level amount the loan would already be repaid; the extra D in later years must reduce the earlier payments.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", (L - D * (n - m)) / an(n, i) + D, `(${lit(L)} - ${lit(D)}*${n - m})/${aExpr(n, i)} + ${lit(D)}`, {
          derivation: `$\\dfrac{${mamt(L)} - ${D}\\times${n - m}}{${aSym(n)}} + ${D} = ${shown((L - D * (n - m)) / an(n, i) + D, fmt)}$`,
          method: "Subtracted the extra payments from the loan at face value.",
          feedback: "The extra payments are made in the future, so their value at time 0 is their discounted value, not their sum.",
        }),
      ],
      explanation: stepExplanation({ L, i, n, m, X: Y, fmt, D }),
      visuals: [
        {
          kind: "timeline",
          title: "A level stream plus a deferred extra",
          unit: "year",
          rate: i,
          flows: [
            ...range(1, m).map((t) => ({ t, amount: X, dir: "out" as const, label: "X" })),
            ...range(m + 1, n).map((t) => ({ t, amount: Y, dir: "out" as const, label: "X + D" })),
          ],
          valuationTimes: [0, m],
        },
      ],
      markers: [X, D * vm * rest],
      presentation: ["deferred", "indirect-wording", "rearrange-first"],
      features: features({ steps: 3, multipleValuationDates: true, unfamiliar: true }),
      chain: chain(
        [
          step("B.annuity-immediate", "A level stream of X over the whole term.", ["a_n", an(n, i), "level factor"], ["n", "i"]),
          step("B.deferred", "The extra D is paid only in the second phase.", ["D v^m a_{n−m}", D * vm * rest, "value of the extra payments"], ["D", "m"]),
          step("A.equation-of-value", "Solve L = X a_n + D v^m a_{n−m} for X, then substitute Y = X + D.", ["Y", Y, "later payment"], ["L", "X"], { rearranged: true }),
        ],
        {
          methods: ["decomposition", "substitution"],
          stages: {
            VAR_OTHER_UNKNOWN: [2, "interpretation"],
            TIMING_IGNORED_DEFERRAL: [1, "application"],
            TIMING_DEFERRAL_OFF_BY_ONE: [1, "application"],
            MODEL_LEVEL_FOR_VARYING: [0, "selection"],
            SEQ_UNDISCOUNTED_SUM: [1, "application"],
          },
          reasoning: "Let Y be the unknown directly: L = (Y − D)a_m + Y v^m a_{n−m}, one linear equation.",
        }
      ),
      params: { L, i, n, m, D },
    };
  },
};

function stepExplanation(p: { L: number; i: number; n: number; m: number; X: number; fmt: typeof MONEY2; factor?: number; D?: number }) {
  const { L, i, n, m, X, fmt, factor, D } = p;
  const multiplicative = factor !== undefined;
  return explanation({
    intuition: multiplicative
      ? `The loan is repaid by two blocks of payments. The first block starts next year; the second block is the same shape, just larger and pushed ${m} years into the future. Each block's value has to be brought back to today before the two can be added.`
      : `Split every later payment into “X” plus an extra ${amt(D ?? 0)}. Then the loan is repaid by a level stream of X for all ${n} years, plus a deferred stream of ${amt(D ?? 0)} for the last ${n - m} years.`,
    translation: {
      unknowns: multiplicative
        ? [{ symbol: "$X$", meaning: "each of the first-phase payments" }]
        : [
            { symbol: "$X$", meaning: "each of the first-phase payments" },
            { symbol: "$Y = X + D$", meaning: "each of the later payments (asked for)" },
          ],
      relationships: multiplicative
        ? [`$L = X\\,${aSym(m)} + ${factor}X\\,v^{${m}}\\,${aSym(n - m)}$`]
        : [`$L = X\\,${aSym(n)} + D\\,v^{${m}}\\,${aSym(n - m)}$`],
      conditions: [`${m} payments in the first phase`, `${n - m} in the second`],
      valuationDate: "Time 0 for the equation; the deferred stream is first valued at time " + m + ".",
      modelChoice: "Decompose into an immediate level annuity plus a deferred annuity.",
      assumptions: ["All payments at the end of each year.", `Constant rate ${pc(i)}.`],
    },
    solution: multiplicative
      ? [
          { title: "Factors", body: `$${aSym(m)} = ${dec(an(m, i), 5)}$, $v^{${m}}${aSym(n - m)} = ${dec(v(i, m) * an(n - m, i), 5)}$` },
          { title: "Equation of value", body: `$${mamt(L)} = X(${dec(an(m, i), 5)} + ${factor} \\times ${dec(v(i, m) * an(n - m, i), 5)})$` },
          { title: "Solve", body: `$X = ${shown(X, fmt)}$` },
        ]
      : [
          { title: "Factors", body: `$${aSym(n)} = ${dec(an(n, i), 5)}$, $v^{${m}}${aSym(n - m)} = ${dec(v(i, m) * an(n - m, i), 5)}$` },
          { title: "First-phase payment", body: `$X = \\dfrac{${mamt(L)} - ${D}\\times${dec(v(i, m) * an(n - m, i), 5)}}{${dec(an(n, i), 5)}} = ${mnum(X - (D ?? 0), 2)}$` },
          { title: "Later payment", body: `$Y = X + ${D} = ${shown(X, fmt)}$` },
        ],
    alternatives: [
      {
        name: "Difference of annuities",
        body: `$v^{${m}}${aSym(n - m)} = ${aSym(n)} - ${aSym(m)}$, so no deferral factor is needed at all.`,
        whenUseful: "Avoids the deferral exponent entirely — a good check on it.",
      },
      {
        name: "Equation of value at time " + m,
        body: `Accumulate the first phase with $${sSym(m)}$ and value the second with $${aSym(n - m)}$, both at time ${m}.`,
        whenUseful: "Natural when the phase change is the key date in the story.",
      },
    ],
    transfer: {
      principle: "A stream that starts later is an ordinary annuity moved back in time; $v^k a_{\\overline{n|}}$ values payments at k + 1, ..., k + n.",
      unusual: multiplicative ? "The unknown appears in both phases with different multipliers." : "The answer is the later payment, but the natural unknown is the earlier one.",
      misread: "Deferral exponents are easy to miscount by one; the difference-of-annuities identity is a reliable check.",
    },
  });
}

// ===================================================================== total interest

const totalInterest: QuestionTemplate = {
  id: "loan-interest-window",
  family: "loan-components",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.outstanding_balance", "LOANS.payment_components"],
  reasoning: ["translation", "concept_recognition", "cashflow_modelling", "arithmetic"],
  soaConcept: "Total interest paid over a block of payments in an amortized loan.",
  generate(rng, lvl): QuestionDraft {
    const L = gridAmount(rng, 20000, 150000, 5000);
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(12, 25);
    const k = rng.int(2, Math.floor(n / 2));
    const mEnd = rng.int(k + 3, n - 2);
    const P = levelPayment(L, n, i);
    const Bk = P * an(n - k, i);
    const Bm = P * an(n - mEnd, i);
    const count = mEnd - k;
    const total = count * P - (Bk - Bm);
    const fmt = MONEY0;
    const Pexpr = `(${lit(L)}/${aExpr(n, i)})`;
    const Pexplicit = `(${lit(L)}/${sumV(i, 1, n)})`;
    const answerCalc = `${count}*${Pexpr} - (${Pexpr}*${aExpr(n - k, i)} - ${Pexpr}*${aExpr(n - mEnd, i)})`;
    const model = sumOf(range(k + 1, mEnd).map((t) => `(${Pexplicit} - ${Pexplicit}*${vPow(i, n - t + 1)})`));
    const principal = Bk - Bm;
    const extra = total + P * (1 - v(i, n - k + 1));
    const onOriginal = count * i * L;
    const whole = n * P - L;
    const onPayment = count * i * P;
    const askWords =
      lvl === 1
        ? `Calculate the total amount of interest paid in payments ${k + 1} through ${mEnd}, inclusive.`
        : `Calculate the total amount of interest paid from time ${k} (just after the payment then due) to time ${mEnd} (including the payment then due).`;
    return {
      stem: `A loan of ${amt(L)} is repaid with level payments at the end of each year for ${n} years at an annual effective interest rate of ${pc(i)}.\n\n${askWords}`,
      answer: {
        value: total,
        calc: answerCalc,
        format: fmt,
        derivation: `$${count}P - (B_{${k}} - B_{${mEnd}}) = ${mnum(count * P, 2)} - ${mnum(principal, 2)} = ${shown(total, fmt)}$`,
      },
      model: {
        expr: model,
        description: `Sum of the interest portions $P(1 - v^{n-t+1})$ for t = ${k + 1}, ..., ${mEnd}, each written out.`,
      },
      distractors: [
        distractor("VAR_INTEREST_FOR_PRINCIPAL", principal, `${Pexpr}*${aExpr(n - k, i)} - ${Pexpr}*${aExpr(n - mEnd, i)}`, {
          derivation: `$B_{${k}} - B_{${mEnd}} = ${shown(principal, fmt)}$`,
          method: "Computed the principal repaid over the block instead of the interest.",
          feedback: "The fall in the balance is the principal repaid. Interest is the rest of what was paid.",
        }),
        distractor("SEQ_TERM_COUNT", extra, `${answerCalc} + ${Pexpr}*(1-${vPow(i, n - k + 1)})`, {
          derivation: `including payment ${k}: $${shown(extra, fmt)}$`,
          method: `Included payment ${k} as well, summing ${count + 1} payments.`,
          feedback: `Payments ${k + 1} through ${mEnd} number ${mEnd} − ${k} = ${count}.`,
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", onOriginal, `${count}*${lit(i)}*${lit(L)}`, {
          derivation: `$${count} \\times ${dec(i, 3)} \\times ${mamt(L)} = ${shown(onOriginal, fmt)}$`,
          method: "Charged interest on the original loan in every payment.",
          feedback: "Interest in each payment is on the current balance, which keeps falling.",
        }),
        distractor("TRANS_IGNORED_CONDITION", whole, `${n}*${Pexpr} - ${lit(L)}`, {
          derivation: `$${n}P - L = ${shown(whole, fmt)}$`,
          method: "Computed the total interest over the whole loan.",
          feedback: `Only payments ${k + 1} to ${mEnd} are asked about.`,
        }),
        distractor("MODEL_INTEREST_ON_PAYMENT", onPayment, `${count}*${lit(i)}*${Pexpr}`, {
          derivation: `$${count} \\times ${dec(i, 3)} \\times ${mnum(P, 2)} = ${shown(onPayment, fmt)}$`,
          method: "Charged interest on each payment.",
          feedback: "Interest is the rate times the balance owed, not times the payment.",
        }),
      ],
      explanation: explanation({
        intuition: "Over any block of payments, money paid splits into two piles: interest, and principal (the drop in the balance). Finding the principal pile is easy from two balances; interest is whatever is left.",
        translation: {
          unknowns: [{ symbol: "$I$", meaning: `total interest in payments ${k + 1}, ..., ${mEnd}` }],
          relationships: [`$I = ${count}P - (B_{${k}} - B_{${mEnd}})$`],
          conditions: [`$P = L / ${aSym(n)}$`, `${count} payments in the block`],
          valuationDate: `Balances at time ${k} and time ${mEnd}; no discounting of the interest amounts.`,
          modelChoice: "Total paid minus principal repaid. Summing each interest portion works but is slower.",
          assumptions: ["Interest amounts are added at face value — the question asks for a total, not a present value."],
        },
        solution: [
          { title: "Payment", body: `$P = ${mnum(P, 2)}$` },
          { title: "Balances", body: `$B_{${k}} = P\\,${aSym(n - k)} = ${mnum(Bk, 2)}$, $B_{${mEnd}} = P\\,${aSym(n - mEnd)} = ${mnum(Bm, 2)}$` },
          { title: "Interest", body: `$${count} \\times ${mnum(P, 2)} - (${mnum(Bk, 2)} - ${mnum(Bm, 2)}) = ${shown(total, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Sum the interest portions",
            body: `$\\sum_{t=${k + 1}}^{${mEnd}} P(1 - v^{n-t+1}) = ${count}P - P\\,(${aSym(n - k)} - ${aSym(n - mEnd)})$`,
            whenUseful: "Shows why the shortcut works: the principal parts telescope.",
          },
        ],
        transfer: {
          principle: "Over any block of payments: total paid = interest + principal, and principal = fall in the outstanding balance.",
          unusual: lvl === 2 ? "The block is described by dates, so you must convert dates to payment numbers yourself." : "The block starts part-way through the loan.",
          misread: "Off-by-one counts at the start of the block, and confusing interest with principal.",
        },
      }),
      visuals: [
        {
          kind: "amortization",
          title: "Interest inside the highlighted block",
          principal: L,
          rate: i,
          payments: Array.from({ length: n }, () => P),
          unit: "year",
          highlightPeriod: mEnd,
        },
      ],
      markers: [P, Bk, Bm, principal],
      presentation: lvl === 2 ? ["indirect-wording"] : ["direct"],
      features: features({ steps: 3, unfamiliar: lvl === 2 }),
      chain: chain(
        [
          step("D.loan-payment", "Recover the payment.", ["P", P, "level payment"], ["L", "n", "i"], { rearranged: true }),
          step("D.prospective", "Principal repaid over the block = fall in the balance.", ["B_k − B_m", principal, "principal repaid in the block"], ["P"]),
          step("D.total-interest", "Interest = total paid − principal repaid.", ["I", total, "interest in the block"], ["P", "count"]),
        ],
        {
          stages: {
            VAR_INTEREST_FOR_PRINCIPAL: [2, "interpretation"],
            SEQ_TERM_COUNT: [2, "application"],
            MODEL_INTEREST_ON_ORIGINAL: [2, "selection", "D.interest-component"],
            TRANS_IGNORED_CONDITION: [2, "application"],
            MODEL_INTEREST_ON_PAYMENT: [2, "application"],
          },
          reasoning: "Sum the interest portions P(1 − v^{n−t+1}) directly — the principal parts telescope to the fall in balance.",
        }
      ),
      params: { L, i, n, k, m: mEnd },
    };
  },
};

// ===================================================================== reconstructing a loan from one payment

const firstPayment: QuestionTemplate = {
  id: "loan-from-first-payment",
  family: "loan-structure",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.payment_components", "LOANS.outstanding_balance"],
  reasoning: ["formula_reconstruction", "algebra", "multistep", "translation", "transfer"],
  soaConcept: "Loan variables recovered from the split of a single payment.",
  generate(rng, lvl): QuestionDraft {
    const L0 = gridAmount(rng, 20000, 100000, 5000);
    const i0 = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 4);
    const P0 = levelPayment(L0, n, i0);
    const I1 = Number((i0 * L0).toFixed(2));
    const R1 = Number((P0 - i0 * L0).toFixed(2));
    const P = I1 + R1;
    const i = Math.pow(P / R1, 1 / n) - 1;
    const L = I1 / i;
    const Bk = L - R1 * sn(k, i);
    const askInterest = lvl === 3;
    const target = askInterest ? i * Bk : Bk;
    const fmt = MONEY2;
    const iExpr = `((${lit(P)}/${lit(R1)})**(1/${n})-1)`;
    const BkExpr = `(${lit(I1)}/${iExpr} - ${lit(R1)}*((1+${iExpr})**${k}-1)/${iExpr})`;
    const wrap = (expr: string, rate: string) => (askInterest ? `${rate}*(${expr})` : expr);
    const wrapV = (value: number, rate: number) => (askInterest ? rate * value : value);
    const BkModel = `(${lit(P)}*${sumOf(range(1, n - k).map((e) => `(1+${iExpr})**(-${e})`))})`;
    const constant = L - k * R1;
    const iRoot = Math.pow(P / R1, 1 / (n - 1)) - 1;
    const rootB = I1 / iRoot - R1 * sn(k, iRoot);
    const prevB = L - R1 * sn(k - 1, i);
    const before = L * acc(i, k) - P * sdue(k, i);
    const iGuess = I1 / P;
    return {
      stem: `A loan is repaid with ${n} level payments at the end of each year. The first payment consists of ${mnumPlain(I1)} of interest and ${mnumPlain(R1)} of principal.\n\nCalculate the ${askInterest ? `amount of interest in the ${ord(k + 1)} payment` : `outstanding balance immediately after the ${ord(k)} payment`}.`,
      answer: {
        value: target,
        calc: wrap(BkExpr, iExpr),
        format: fmt,
        derivation: askInterest
          ? `$I_{${k + 1}} = i\\,B_{${k}} = ${dec(i, 6)} \\times ${mnum(Bk, 2)} = ${shown(target, fmt)}$`
          : `$B_{${k}} = L - R_1\\,${sSym(k)} = ${mnum(L, 2)} - ${mnum(R1 * sn(k, i), 2)} = ${shown(target, fmt)}$`,
      },
      model: {
        expr: wrap(BkModel, iExpr),
        description: askInterest
          ? `The balance after payment ${k} is the PV of the ${n - k} payments left; the next payment's interest is i times it.`
          : `The balance after payment ${k} is the PV of the ${n - k} payments left.`,
      },
      distractors: [
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", wrapV(constant, i), wrap(`${lit(I1)}/${iExpr} - ${k}*${lit(R1)}`, iExpr), {
          derivation: `$L - ${k}R_1 = ${mnum(L, 2)} - ${k}(${mnumPlain(R1)})${askInterest ? `$, times $i$` : ""} = ${shown(wrapV(constant, i), fmt)}$`,
          method: "Assumed every payment repays the same principal as the first.",
          feedback: "Principal repaid grows by (1 + i) each year, so after k payments the principal repaid is $R_1 s_{\\overline{k|}}$, not $kR_1$.",
        }),
        distractor(
          "ALG_ROOT_ERROR",
          wrapV(rootB, iRoot),
          wrap(`${lit(I1)}/((${lit(P)}/${lit(R1)})**(1/${n - 1})-1) - ${lit(R1)}*((${lit(P)}/${lit(R1)})**(${k}/${n - 1})-1)/((${lit(P)}/${lit(R1)})**(1/${n - 1})-1)`, `((${lit(P)}/${lit(R1)})**(1/${n - 1})-1)`),
          {
            derivation: `$(1+i)^{${n - 1}} = P/R_1 \\Rightarrow i = ${dec(iRoot, 6)}$, giving $${shown(wrapV(rootB, iRoot), fmt)}$`,
            method: `Used $R_1 = Pv^{${n - 1}}$, taking the ${ord(n - 1)} root.`,
            feedback: `The first payment's principal is $Pv^{n} = Pv^{${n}}$: the first payment is made when all ${n} payments remain.`,
          }
        ),
        distractor("TIMING_BALANCE_INDEX", wrapV(prevB, i), wrap(`${lit(I1)}/${iExpr} - ${lit(R1)}*((1+${iExpr})**${k - 1}-1)/${iExpr}`, iExpr), {
          derivation: `$B_{${k - 1}}${askInterest ? "\\,i" : ""} = ${shown(wrapV(prevB, i), fmt)}$`,
          method: `Used the balance after payment ${k - 1}.`,
          feedback: askInterest
            ? `Interest in payment ${k + 1} is charged on the balance just after payment ${k}.`
            : `The question asks for the balance just after payment ${k}.`,
        }),
        distractor("TIMING_PAYMENT_BEFORE_INTEREST", wrapV(before, i), wrap(`${lit(I1)}/${iExpr}*(1+${iExpr})**${k} - ${lit(P)}*((1+${iExpr})**${k}-1)/${iExpr}*(1+${iExpr})`, iExpr), {
          derivation: `$L(1+i)^{${k}} - P\\,${sdueSym(k)}${askInterest ? ",\\ \\times i" : ""} = ${shown(wrapV(before, i), fmt)}$`,
          method: "Accumulated the payments as if each were made at the start of its year.",
          feedback: "Each payment is at the end of its year, so the accumulated payments use $s$, not $\\ddot{s}$.",
        }),
        distractor(
          "RATE_DISCOUNT_AS_INTEREST",
          wrapV(I1 / iGuess - R1 * sn(k, iGuess), iGuess),
          wrap(`${lit(I1)}/(${lit(I1)}/${lit(P)}) - ${lit(R1)}*((1+${lit(I1)}/${lit(P)})**${k}-1)/(${lit(I1)}/${lit(P)})`, `(${lit(I1)}/${lit(P)})`),
          {
            derivation: `$i \\approx I_1/P = ${dec(iGuess, 6)}$, giving $${shown(wrapV(I1 / iGuess - R1 * sn(k, iGuess), iGuess), fmt)}$`,
            method: "Took the interest share of the payment, I₁/P, as the interest rate.",
            feedback: "I₁/P is the fraction of the payment that is interest — it equals $1 - v^n$, not i. The rate comes from $v^n = R_1/P$.",
          }
        ),
      ],
      explanation: explanation({
        intuition: "A single payment's split carries the whole loan's DNA. The principal part of the first payment is the payment discounted over the full term, which gives the rate; the interest part is the rate times the loan, which gives the loan.",
        translation: {
          unknowns: [
            { symbol: "$P$", meaning: "the level payment" },
            { symbol: "$i$", meaning: "the effective rate" },
            { symbol: "$L$", meaning: "the original loan" },
          ],
          relationships: ["$P = I_1 + R_1$", `$R_1 = Pv^{${n}}$`, "$I_1 = iL$", askInterest ? `$I_{${k + 1}} = i\\,B_{${k}}$` : `$B_{${k}} = L - R_1\\,${sSym(k)}$`],
          conditions: [`$I_1 = ${mnumPlain(I1)}$`, `$R_1 = ${mnumPlain(R1)}$`, `${n} payments`],
          valuationDate: `Time ${k}, immediately after the ${ord(k)} payment.`,
          modelChoice: "Chain three relationships: the payment from its parts, the rate from the first principal portion, the loan from the first interest portion.",
          assumptions: ["Level payments at the end of each year.", "Constant effective rate."],
        },
        solution: [
          { title: "Payment and rate", body: `$P = ${mnum(P, 2)}$; $v^{${n}} = ${mnumPlain(R1)}/${mnum(P, 2)} \\Rightarrow i = ${dec(i, 6)}$` },
          { title: "Loan", body: `$L = I_1 / i = ${mnum(L, 2)}$` },
          {
            title: askInterest ? "Balance, then interest" : "Balance",
            body: askInterest
              ? `$B_{${k}} = L - R_1${sSym(k)} = ${mnum(Bk, 2)}$, so $I_{${k + 1}} = ${dec(i, 6)} \\times ${mnum(Bk, 2)} = ${shown(target, fmt)}$`
              : `$B_{${k}} = ${mnum(L, 2)} - ${mnumPlain(R1)}\\,${sSym(k)} = ${shown(target, fmt)}$`,
          },
        ],
        alternatives: [
          {
            name: "Prospective balance",
            body: `$B_{${k}} = P\\,${aSym(n - k)}$ at $i = ${dec(i, 6)}$ gives ${mnum(Bk, 2)} as well.`,
            whenUseful: "Avoids computing L at all once the rate is known.",
          },
          ...(askInterest
            ? [
                {
                  name: "Interest from principal",
                  body: `$I_{${k + 1}} = P - R_{${k + 1}} = P - R_1(1+i)^{${k}}$.`,
                  whenUseful: "Faster: uses the geometric growth of principal directly.",
                },
              ]
            : []),
        ],
        transfer: {
          principle: "In a level-payment loan, $R_t = Pv^{n-t+1}$ and $I_t = iB_{t-1}$: any one payment's split determines the rate and the loan.",
          unusual: "No rate and no loan amount are given — both are hidden in the first payment.",
          misread: "The interest share of the payment looks like an interest rate, but it is $1 - v^n$.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "From one payment to the whole loan",
          nodes: [
            { id: "split", label: `$I_1 = ${mnumPlain(I1)},\\ R_1 = ${mnumPlain(R1)}$`, tone: "input" },
            { id: "P", label: `$P = I_1 + R_1 = ${mnum(P, 2)}$`, tone: "step" },
            { id: "i", label: `$v^{${n}} = R_1/P \\Rightarrow i = ${dec(i, 5)}$`, tone: "step" },
            { id: "L", label: `$L = I_1/i = ${mnum(L, 0)}$`, tone: "step" },
            { id: "B", label: askInterest ? `$I_{${k + 1}} = i\\,B_{${k}}$` : `$B_{${k}}$`, tone: "result" },
          ],
          edges: [
            { from: "split", to: "P" },
            { from: "P", to: "i" },
            { from: "i", to: "L" },
            { from: "L", to: "B" },
          ],
        },
        { kind: "amortization", title: "The reconstructed loan", principal: L, rate: i, payments: Array.from({ length: n }, () => P), unit: "year", highlightPeriod: k },
      ],
      markers: [P, i, L, Bk],
      presentation: ["hidden-structure", "unknown-rate", "work-backwards", "multi-equation"],
      features: features({ steps: askInterest ? 5 : 4, unfamiliar: true, multiConcept: true }),
      chain: chain(
        [
          step("D.principal-component", "R₁ = P vⁿ with P = I₁ + R₁: solve for the rate.", ["i", i, "loan rate"], ["I_1", "R_1", "n"], { rearranged: true, derived: true }),
          step("D.interest-component", "I₁ = i·L: recover the loan.", ["L", L, "loan amount"], ["I_1", "i"], { rearranged: true }),
          step("D.retrospective", "Balance after payment k (principal repaid grows geometrically).", ["B_k", Bk, "balance after payment k"], ["L", "R_1", "k"], { valuationDate: "k" }),
          ...(askInterest ? [step("D.interest-component", "Interest in the next payment = i × B_k.", ["I_{k+1}", target, "interest in payment k + 1"], ["B_k", "i"])] : []),
        ],
        {
          methods: ["work_backwards", "substitution"],
          unconventional: askInterest,
          stages: {
            SEQ_GEOMETRIC_AS_ARITHMETIC: [2, "application"],
            ALG_ROOT_ERROR: [0, "application"],
            TIMING_BALANCE_INDEX: [2, "application"],
            TIMING_PAYMENT_BEFORE_INTEREST: [2, "selection", "B.annuity-due-av"],
            RATE_DISCOUNT_AS_INTEREST: [0, "selection"],
          },
          reasoning: "One payment's split encodes the loan: the principal part is the payment discounted over the whole term, and the interest part is i × L.",
        }
      ),
      params: { n, k, I1, R1 },
    };
  },
};

export const LOAN_TEMPLATES: QuestionTemplate[] = [
  runningBalance,
  levelBalance,
  paymentComponents,
  dropPayment,
  refinance,
  stepPayments,
  totalInterest,
  firstPayment,
];

