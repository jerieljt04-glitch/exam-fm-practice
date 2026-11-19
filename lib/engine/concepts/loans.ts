/**
 * Concept Practice — loans: principal and interest, amortization, outstanding
 * balances, payment components, final (drop and balloon) payments, unknown
 * loan variables and refinancing.
 *
 * Notation: a loan of L at an annual effective rate i, repaid by payments at
 * the end of each year; B_k is the balance just after payment k; I_t and R_t
 * are the interest and principal portions of payment t.
 */
import { amortize, an, sn } from "../finance";
import type { Rng } from "../random";
import { aExpr, aSym, accPow, amt, drawUntil, gridAmount, gridRate, lit, mamt, mpc, ord, pc, sExpr, sSym, vPow } from "../templates/kit";
import type { ChoiceTemplate } from "../types";
import { conceptQuestion, conceptTemplate, math, statement, statementQuestion, type ConceptOption } from "./kit";

// ---------------------------------------------------------------- helpers

interface Loan {
  L: number;
  i: number;
  n: number;
  /** Exact level payment L / a_n. */
  P: number;
}

function drawLoan(rng: Rng, nMin = 10, nMax = 25): Loan {
  const i = gridRate(rng, 0.04, 0.09, 0.005);
  const n = rng.int(nMin, nMax);
  const L = gridAmount(rng, 10000, 80000, 1000);
  return { L, i, n, P: L / an(n, i) };
}

/** Level payment as an expression. */
const payE = (ln: Loan): string => `(${lit(ln.L)}/${aExpr(ln.n, ln.i)})`;
/** Retrospective balance just after payment k, written independently of the prospective form. */
const retroE = (ln: Loan, k: number): string => `(${lit(ln.L)}*${accPow(ln.i, k)} - ${payE(ln)}*${sExpr(k, ln.i)})`;
/** Prospective balance just after payment k. */
const prospE = (ln: Loan, k: number): string => `(${payE(ln)}*${aExpr(ln.n - k, ln.i)})`;
/** Balance just after payment k (numeric). */
const balance = (ln: Loan, k: number): number => ln.P * an(ln.n - k, ln.i);
/** Schedule rows from the amortization recursion (an independent route to every component). */
const schedule = (ln: Loan) => amortize(ln.L, ln.i, Array.from({ length: ln.n }, () => ln.P));
/** Annuity-immediate value as an expression at rate `r` (number or "x"). */
const annE = (n: number, r: number | string): string => aExpr(n, r);
const v = (i: number, t: number): number => Math.pow(1 + i, -t);

/** `a_{\overline{n}|\,j}` with an explicit rate subscript. */
/** A rate as a subscript, without floating-point noise (0.039999999999999994 → 0.04). */
const rateText = (rate: number): string => String(Number(rate.toPrecision(12)));
const aAt = (n: number | string, rate: number): string => aSym(n, rateText(rate));
const sAt = (n: number | string, rate: number): string => sSym(n, rateText(rate));

const LEVEL_CONDITIONS = ["Level payments at the end of each year.", "A constant annual effective rate of interest."];

// ================================================================ LOANS.principal_interest

const piDefine: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pi-components-define",
  family: "con-loan-pi",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.payment_components"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "timing"],
  reasoning: ["concept_recognition", "cashflow_modelling"],
  soaConcept: "Identifying the balance on which the interest in a loan payment is charged, and what the principal portion is.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 2);
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const L = gridAmount(rng, 10000, 80000, 1000);
    const step = gridAmount(rng, 100, 500, 50);
    const nonLevel = level === 2;
    const scenario = nonLevel
      ? `A loan of ${amt(L)} is repaid by ${n} annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}. Each payment after the first is ${amt(step)} larger than the one before it.`
      : `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}.`;
    const asksInterest = variant === 0;
    const rate = `$${mpc(i)}$`;
    const prev = `the ${ord(k - 1)} payment`;
    const curr = `the ${ord(k)} payment`;
    const stem = `${scenario}\n\nDetermine which of the following is the ${asksInterest ? "interest" : "principal"} portion of the ${ord(k)} payment.`;
    const exponent = n - k + 1;

    const levelTrap: ConceptOption = {
      content: asksInterest ? `The ${ord(k)} payment times $1 - v^{${exponent}}$ at ${rate}` : `The ${ord(k)} payment times $v^{${exponent}}$ at ${rate}`,
      misconception: "MODEL_LEVEL_FOR_VARYING",
      why: `That expression describes payment ${k} of a loan with level payments; here the payments grow by ${amt(step)} a year, so the split must come from the actual balance.`,
      stage: 2,
      failure: "selection",
      conditionTrue: "It would be correct if all the payments were equal.",
      confusedWith: "loan.principal-structure",
    };

    const correct: ConceptOption = asksInterest
      ? { content: `Interest at ${rate} on the balance just after ${prev}`, why: `Year ${k} begins just after payment ${k - 1}; interest for that year accrues on the balance then outstanding.` }
      : { content: `The ${ord(k)} payment less interest at ${rate} on the balance just after ${prev}`, why: `Payment ${k} first pays the interest for year ${k}, charged on the balance just after payment ${k - 1}; what remains repays principal.` };

    const distractors: ConceptOption[] = asksInterest
      ? [
          { content: `Interest at ${rate} on the original loan of ${amt(L)}`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `By year ${k} part of the loan has been repaid; interest is charged only on what is still owed.`, stage: 0, failure: "selection", conditionTrue: "True for the first payment only, or for a loan on which no principal is repaid before the end." },
          { content: `Interest at ${rate} on the balance just after ${curr}`, misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `The balance just after payment ${k} exists only at the end of year ${k}; interest for year ${k} accrued on the balance at its start.`, stage: 0, failure: "application", conditionTrue: `This is the interest portion of payment ${k + 1}.` },
          { content: `Interest at ${rate} on the amount of ${curr}`, misconception: "MODEL_INTEREST_ON_PAYMENT", why: "Interest is earned by the lender on the money still lent, not on the payment the borrower makes.", stage: 0, failure: "interpretation" },
          { content: `The total interest over the ${n} years divided by ${n}`, misconception: "ALLOC_EVEN_SPLIT", why: "Interest falls as the balance falls, so it is not shared equally among the payments.", stage: 1, failure: "application", conditionTrue: "Only if the balance stayed constant until the end, as in an interest-only loan." },
          ...(nonLevel ? [] : [{ content: `The ${ord(k)} payment less interest at ${rate} on the balance just after ${prev}`, misconception: "VAR_INTEREST_FOR_PRINCIPAL" as const, why: "That is the principal portion: the part of the payment left after interest.", stage: 1, failure: "interpretation" as const }]),
        ]
      : [
          { content: `The ${ord(k)} payment less interest at ${rate} on the original loan`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `Interest for year ${k} is charged on the balance still owed, not on the original ${amt(L)}.`, stage: 0, failure: "selection", conditionTrue: "True for the first payment only." },
          { content: `The ${ord(k)} payment less interest at ${rate} on the balance just after ${curr}`, misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `Interest for year ${k} accrued on the balance at the start of the year, just after payment ${k - 1}.`, stage: 0, failure: "application" },
          { content: `Interest at ${rate} on the balance just after ${prev}`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "That is the interest portion; the principal portion is what remains of the payment after it.", stage: 1, failure: "interpretation" },
          { content: `The original loan of ${amt(L)} divided by ${n}`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Principal is whatever the payment leaves after interest; it is not a fixed share of the loan.", stage: 1, failure: "selection", conditionTrue: "True only for a loan repaid by equal principal amounts." },
        ];

    return conceptQuestion({
      stem,
      correct,
      distractors: nonLevel ? [levelTrap, ...distractors] : distractors,
      steps: [
        { concept: "loan.interest-principal-split", reasoning: `Interest for year ${k} accrues on the balance outstanding during that year: the balance just after payment ${k - 1}.` },
        { concept: "loan.amortization-schedule", reasoning: "The payment covers that interest first; the rest repays principal and reduces the balance." },
        ...(nonLevel ? [{ concept: "loan.non-level-payments", reasoning: "Nothing here depends on the payments being level, so level-payment expressions such as $v^{n-k+1}$ do not apply." }] : []),
      ],
      conditions: nonLevel ? ["Payments at the end of each year.", "A constant annual effective rate of interest."] : LEVEL_CONDITIONS,
      relationship: "$I_k = i\\,B_{k-1}, \\qquad R_k = K_k - I_k$, where $K_k$ is the $k$-th payment.",
      counterexample: "For the first payment the balance just after payment 0 is the loan itself, so interest on the original loan is right only there.",
      transfer: {
        principle: "Interest for a period is charged on the balance at the start of that period; principal is the payment less that interest.",
        unusual: nonLevel ? "The payments are not level, so no shortcut in $v$ applies." : "The question asks for a description rather than a value.",
        misread: "“Just after payment k” and “just after payment k − 1” differ by a whole year.",
      },
      itemFormat: "definition",
      presentation: nonLevel ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: nonLevel },
      params: { n, k, i, L, step, variant },
    });
  },
});

const piTrend: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pi-trend",
  family: "con-loan-pi",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.amortization", "LOANS.payment_components"],
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["financial_intuition", "concept_recognition"],
  soaConcept: "How the interest and principal portions of level payments change over time and across loans.",
  variants: 2,
  generate(rng, level, variant) {
    const ln = drawLoan(rng, 12, 25);
    const { L, i, n } = ln;
    const rows = schedule(ln);
    const trendSteps = [
      { concept: "loan.interest-principal-split", reasoning: "Interest is $i$ times the balance at the start of the period, and the balance falls with every payment." },
      { concept: "loan.amortization-schedule", reasoning: "With a level payment, principal = payment − interest, so as interest falls the principal portion rises." },
      { concept: "loan.principal-structure", reasoning: "Because $I_t - I_{t+1} = iR_t$, the principal portions satisfy $R_{t+1} = R_t(1+i)$." },
    ];
    const relationship = "$I_{t+1} = I_t - iR_t, \\qquad R_{t+1} = (1+i)R_t, \\qquad R_t = Pv^{n-t+1}$";
    const transfer = {
      principle: "Interest tracks the balance; with level payments every fall in interest becomes an equal rise in principal, which compounds at $1+i$.",
      unusual: "The comparison is between payments or loans, not a single value.",
      misread: "“Level payment” does not mean level principal.",
    };

    if (level === 1 && variant === 0) {
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nWhich of the following describes how the composition of the payments changes from one payment to the next?`,
        correct: { content: "The interest portion falls and the principal portion grows by the factor $1+i$.", why: "The balance falls each year, so interest falls; the principal portion absorbs the difference and grows by $1+i$." },
        distractors: [
          { content: "The interest portion falls and the principal portion grows by a fixed amount.", misconception: "SEQ_GEOMETRIC_AS_ARITHMETIC", why: "The increase $R_{t+1} - R_t = iR_t$ itself grows, so the growth is geometric, not arithmetic.", stage: 2, failure: "application" },
          { content: "The interest portion grows and the principal portion falls by the factor $v$.", misconception: "CONC_DIRECTION_REVERSED", why: "The balance falls over time, so the interest charged on it falls too.", stage: 0, failure: "interpretation", conditionTrue: "It would describe the payments read from the last one backwards." },
          { content: "Both portions stay the same, because the payments are level.", misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Only the total is level; interest on a falling balance cannot stay the same.", stage: 1, failure: "recognition", conditionTrue: "True only if the balance never fell, as in an interest-only loan." },
          { content: "The interest portion falls and the principal portion grows by the factor $1+d$.", misconception: "RATE_DISCOUNT_AS_INTEREST", why: "The ratio of successive principal portions is $1+i$; the discount rate $d$ plays no role.", stage: 2, failure: "selection" },
          { content: "The interest portion stays at $i$ times the loan; only the principal portion changes.", misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Interest is charged on the balance outstanding, which falls with each payment.", stage: 0, failure: "selection" },
        ],
        steps: trendSteps,
        conditions: LEVEL_CONDITIONS,
        relationship,
        transfer,
        itemFormat: "comparative-statics",
        params: { L, i, n, variant },
      });
    }

    if (level === 1) {
      const t = rng.int(2, n - 2);
      const ratio = rows[t].principal / rows[t - 1].principal;
      return conceptQuestion({
        stem: `A loan is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate $i > 0$. Let $R_t$ denote the principal portion of the $t$-th payment.\n\nDetermine which of the following equals $R_{t+1}/R_t$ for $1 \\le t \\le ${n - 1}$.`,
        correct: { content: math("1+i"), why: "$R_t = Pv^{n-t+1}$, so $R_{t+1}/R_t = v^{-1} = 1+i$.", probe: lit(1 + i) },
        distractors: [
          { content: math("v"), misconception: "ALG_INVERTED_RATIO", why: "Later payments repay more principal, so the ratio exceeds 1; $v$ is the reciprocal.", probe: lit(1 / (1 + i)), stage: 2, failure: "application", conditionTrue: "$v$ is $R_t/R_{t+1}$." },
          { content: math("1"), misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Level payments do not repay level principal.", probe: "1", stage: 1, failure: "recognition" },
          { content: math("(1+i)^{2}"), misconception: "TIMING_EXTRA_PERIOD", why: "Consecutive payments are one period apart, so the ratio is one factor of $1+i$.", probe: lit((1 + i) ** 2), stage: 2, failure: "application", conditionTrue: "This is $R_{t+2}/R_t$." },
          { content: math("1+d"), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "The ratio comes from $v^{-1} = 1+i$, not from the discount rate.", probe: lit(1 + i / (1 + i)), stage: 2, failure: "selection" },
        ],
        reference: { values: [{ label: "R_{t+1}/R_t", expr: lit(ratio) }], description: `Ratio of consecutive principal portions read from the amortization schedule at $i = ${mpc(i)}$, $t = ${t}$.` },
        steps: trendSteps,
        conditions: LEVEL_CONDITIONS,
        relationship,
        transfer,
        itemFormat: "expression-selection",
        params: { i, n, t, variant },
      });
    }

    if (level === 2) {
      const byTerm = variant === 0;
      const nA = rng.int(10, 15);
      const nB = nA + rng.int(5, 12);
      const iA = i;
      const iB = i + gridRate(rng, 0.01, 0.03, 0.005);
      const sA = byTerm ? sExpr(nA, i) : sExpr(n, iA);
      const sB = byTerm ? sExpr(nB, i) : sExpr(n, iB);
      const RA = `(${lit(L)}/${sA})`;
      const RB = `(${lit(L)}/${sB})`;
      const IA = `(${lit(byTerm ? i : iA)}*${lit(L)})`;
      const IB = `(${lit(byTerm ? i : iB)}*${lit(L)})`;
      const PA = `(${IA}+${RA})`;
      const PB = `(${IB}+${RB})`;
      const stem = byTerm
        ? `Loans A and B are each for ${amt(L)} at an annual effective interest rate of ${pc(i)}, and each is repaid by level annual payments at the end of each year. Loan A is repaid over ${nA} years and loan B over ${nB} years.\n\nWhich of the following is true of the first payment on each loan?`
        : `Loans A and B are each for ${amt(L)} and each is repaid by ${n} level annual payments at the end of each year. Loan A has an annual effective interest rate of ${pc(iA)} and loan B a rate of ${pc(iB)}.\n\nWhich of the following is true of the first payment on each loan?`;
      const distractors: ConceptOption[] = byTerm
        ? [
            { content: "Loan B's contains less interest and less principal than loan A's.", misconception: "MODEL_INTEREST_ON_PAYMENT", why: "The first year's interest is $i$ times the loan for both loans; it does not shrink with the smaller payment.", check: { expr: IB, op: "<", than: IA }, stage: 0, failure: "interpretation" },
            { content: "Both contain the same interest; loan B's contains more principal.", misconception: "CONC_DIRECTION_REVERSED", why: "A longer term repays principal more slowly: $R_1 = L/s_{\\overline{n}|}$ falls as $n$ grows.", check: { expr: RB, op: ">", than: RA }, stage: 1, failure: "application" },
            { content: "Loan B's contains more interest, since it is outstanding longer.", misconception: "CONC_RELATED_TERM", why: "Loan B pays more interest in total, but its first payment carries the same $iL$.", check: { expr: IB, op: ">", than: IA }, stage: 0, failure: "interpretation", conditionTrue: "True of the total interest over each loan's term." },
            { content: "Both contain the same interest and the same principal.", misconception: "TRANS_IGNORED_CONDITION", why: "The payments differ, and the interest is the same, so the principal portions must differ.", check: { expr: RB, op: "=", than: RA }, stage: 1, failure: "conclusion" },
            { content: `Both contain the same interest; loan B's principal is ${nA}/${nB} of loan A's.`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The first principal portion is $L/s_{\\overline{n}|}$, not $L/n$.", check: { expr: RB, op: "=", than: `${RA}*${nA}/${nB}` }, stage: 2, failure: "selection" },
          ]
        : [
            { content: "Loan B's contains more interest and more principal than loan A's.", misconception: "MODEL_INTEREST_ON_PAYMENT", why: "Loan B's larger payment goes entirely to its extra interest and more; its principal portion $L/s_{\\overline{n}|}$ is smaller at the higher rate.", check: { expr: RB, op: ">", than: RA }, stage: 2, failure: "application" },
            { content: "Loan B's contains less interest and more principal than loan A's.", misconception: "CONC_DIRECTION_REVERSED", why: "The first year's interest is the rate times the loan, which is larger at the higher rate.", check: { expr: IB, op: "<", than: IA }, stage: 0, failure: "interpretation" },
            { content: "Both contain the same principal; loan B's contains more interest.", misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The first principal portion is $L/s_{\\overline{n}|}$, which depends on the rate.", check: { expr: RB, op: "=", than: RA }, stage: 1, failure: "selection" },
            { content: "The payments are equal; loan B's has more interest and less principal.", misconception: "TRANS_IGNORED_CONDITION", why: "A higher rate raises the level payment $L/a_{\\overline{n}|}$.", check: { expr: PB, op: "=", than: PA }, stage: 2, failure: "conclusion" },
          ];
      return conceptQuestion({
        stem,
        correct: byTerm
          ? { content: "Both contain the same interest; loan B's contains less principal.", why: "First-year interest is $iL$ for both; the first principal portion $L/s_{\\overline{n}|}$ is smaller for the longer term.", check: { expr: RB, op: "<", than: RA } }
          : { content: "Loan B's contains more interest and less principal than loan A's.", why: "First-year interest $iL$ rises with the rate, and $R_1 = L/s_{\\overline{n}|}$ falls because $s_{\\overline{n}|}$ rises with the rate.", check: { expr: RB, op: "<", than: RA } },
        distractors,
        steps: [
          { concept: "loan.interest-principal-split", reasoning: "The first payment's interest is $i$ times the whole loan." },
          { concept: "loan.principal-structure", reasoning: "Its principal portion is $Pv^{n} = L/s_{\\overline{n}|}$." },
          { concept: "loan.amortization-schedule", reasoning: byTerm ? "A longer term increases $s_{\\overline{n}|}$, so less principal is repaid at first." : "A higher rate increases $s_{\\overline{n}|}$, so less principal is repaid at first even though the payment is larger." },
        ],
        conditions: LEVEL_CONDITIONS,
        relationship: "$I_1 = iL, \\qquad R_1 = Pv^{n} = \\dfrac{L}{s_{\\overline{n}|}}$",
        counterexample: "A loan repaid in one payment ($n = 1$) has $R_1 = L$ whatever the rate.",
        transfer,
        itemFormat: "comparative-statics",
        presentation: ["compare-streams"],
        features: { unfamiliar: true },
        params: { L, i, nA, nB, iB, variant },
      });
    }

    // Level 3: relationships between successive rows, given only symbols.
    const t = rng.int(3, n - 4);
    const I = rows[t - 1].interest;
    const R = rows[t - 1].principal;
    const P = ln.P;
    if (variant === 0) {
      const target = rows[t].interest;
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate $i$. The ${ord(t)} payment consists of interest $I$ and principal $R$.\n\nDetermine which of the following expressions equals the interest portion of the ${ord(t + 1)} payment.`,
        correct: { content: math("I - iR"), why: `Payment ${t} reduces the balance by $R$, so the next year's interest is $i$ times a balance smaller by $R$: $I - iR$.`, probe: `${lit(I)} - ${lit(i)}*${lit(R)}` },
        distractors: [
          { content: math("I - R"), misconception: "CONC_LOAN_BALANCE_INTEREST_CONFUSED", why: "The balance falls by $R$; the interest on it falls by only $iR$.", probe: `${lit(I)} - ${lit(R)}`, stage: 2, failure: "connection" },
          { content: math("Iv"), misconception: "CONC_LOAN_INTEREST_GEOMETRIC", why: "Only the principal portions form a geometric sequence; interest is the payment less principal.", probe: `${lit(I)}/${onePlusLit(i)}`, stage: 2, failure: "selection" },
          { content: math("I - iR(1+i)"), misconception: "TIMING_BALANCE_INDEX", why: `$R(1+i)$ is the principal of payment ${t + 1}, which is repaid only at the end of year ${t + 1}.`, probe: `${lit(I)} - ${lit(i)}*${lit(R)}*${onePlusLit(i)}`, stage: 1, failure: "application", conditionTrue: `This is the interest portion of payment ${t + 2}.` },
          { content: math("I + iR"), misconception: "CONC_DIRECTION_REVERSED", why: "Repaying principal lowers the balance, so interest falls.", probe: `${lit(I)} + ${lit(i)}*${lit(R)}`, stage: 0, failure: "interpretation" },
          { content: math("I"), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Interest is charged on the falling balance, so it cannot stay at $I$.", probe: lit(I), stage: 0, failure: "selection" },
        ],
        reference: { values: [{ label: `I_{${t + 1}}`, expr: lit(target) }], description: `Interest portion of payment ${t + 1} read from the amortization schedule ($i = ${mpc(i)}$ for the check).` },
        steps: [...trendSteps, { concept: "loan.amortization-schedule", reasoning: `So $I_{${t + 1}} = i(B_{${t - 1}} - R) = I - iR$.` }],
        conditions: LEVEL_CONDITIONS,
        relationship,
        transfer,
        itemFormat: "expression-selection",
        presentation: ["hidden-structure"],
        modelingDecisions: 1,
        params: { L, i, n, t, variant },
      });
    }
    const target = rows[t + 1].interest;
    return conceptQuestion({
      stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$ made at the end of each year at an annual effective interest rate $i$. The principal portion of the ${ord(t)} payment is $R$.\n\nDetermine which of the following expressions equals the interest portion of the ${ord(t + 2)} payment.`,
      correct: { content: math("P - R(1+i)^{2}"), why: `Principal grows by $1+i$ per payment, so payment ${t + 2} repays $R(1+i)^2$; the rest of $P$ is interest.`, probe: `${lit(P)} - ${lit(R)}*${onePlusLit(i)}**2` },
      distractors: [
        { content: math("P - R(1+i)"), misconception: "TIMING_MISSING_PERIOD", why: `Payment ${t + 2} is two payments after payment ${t}, so two factors of $1+i$ are needed.`, probe: `${lit(P)} - ${lit(R)}*${onePlusLit(i)}`, stage: 2, failure: "application", conditionTrue: `This is the interest portion of payment ${t + 1}.` },
        { content: math("P - R(1+i)^{3}"), misconception: "TIMING_EXTRA_PERIOD", why: "Only two payment intervals separate the payments.", probe: `${lit(P)} - ${lit(R)}*${onePlusLit(i)}**3`, stage: 2, failure: "application" },
        { content: math("P - Rv^{2}"), misconception: "ALG_INVERTED_RATIO", why: "Principal portions grow over time, so later principal is $R(1+i)^2$, not $Rv^2$.", probe: `${lit(P)} - ${lit(R)}*${onePlusLit(i)}**(-2)`, stage: 2, failure: "application" },
        { content: math("P - R(1+2i)"), misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Each principal portion is $1+i$ times the previous one, so the growth compounds.", probe: `${lit(P)} - ${lit(R)}*(1+2*${lit(i)})`, stage: 2, failure: "selection" },
        { content: math("R(1+i)^{2}"), misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: `$R(1+i)^2$ is the principal portion of payment ${t + 2}; the interest portion is the rest of the payment.`, probe: `${lit(R)}*${onePlusLit(i)}**2`, stage: 1, failure: "interpretation" },
      ],
      reference: { values: [{ label: `I_{${t + 2}}`, expr: lit(target) }], description: `Interest portion of payment ${t + 2} read from the amortization schedule ($i = ${mpc(i)}$ for the check).` },
      steps: [...trendSteps, { concept: "loan.interest-principal-split", reasoning: `The interest portion of payment ${t + 2} is $P - R_{${t + 2}} = P - R(1+i)^2$.` }],
      conditions: LEVEL_CONDITIONS,
      relationship,
      transfer,
      itemFormat: "expression-selection",
      presentation: ["hidden-structure", "indirect-wording"],
      modelingDecisions: 1,
      params: { L, i, n, t, variant },
    });
  },
});

function onePlusLit(i: number): string {
  return `(1+${lit(i)})`;
}

const piStatements: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pi-statements",
  family: "con-loan-pi",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.payment_components", "LOANS.amortization"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["concept_recognition", "validation"],
  soaConcept: "Judging statements about the interest and principal in level loan payments.",
  variants: 2,
  generate(rng, level, variant) {
    const ln = drawLoan(rng, 10, 25);
    const { L, i, n, P: _P } = ln;
    const rows = schedule(ln);
    const R1 = `(${payE(ln)}*${vPow(i, n)})`;
    const steps = [
      { concept: "loan.interest-principal-split", reasoning: "Each payment pays interest on the opening balance; the remainder repays principal." },
      { concept: "loan.amortization-schedule", reasoning: "The principal portions repay the loan exactly, and grow by the factor $1+i$." },
      { concept: "loan.principal-structure", reasoning: "Payment $t$ repays $Pv^{n-t+1}$; the last repays $Pv$." },
    ];
    const transfer = {
      principle: "Check every claim against the row recursion: interest on the opening balance, principal = payment − interest.",
      unusual: "Several claims must be judged at once.",
      misread: "A statement can be true of the first payment but not of the others.",
    };
    const common = { steps, conditions: LEVEL_CONDITIONS, relationship: "$I_t = iB_{t-1}, \\quad R_t = Pv^{n-t+1}, \\quad \\sum_t R_t = L$", transfer };

    if (level === 1 && variant === 0) {
      return statementQuestion({
        ...common,
        stem: "A loan is repaid by level annual payments made at the end of each year at a positive annual effective interest rate $i$.\n\nDetermine which of the following statements are true.",
        statements: [
          statement("I", "The principal portions of all the payments add up to the amount of the loan.", true, "Each principal portion reduces the balance, and the balance falls from $L$ to 0.", "VAR_TOTAL_FOR_COMPONENT", { stage: 1, failure: "interpretation" }),
          statement("II", "The interest portion of every payment equals $i$ times the amount of the loan.", false, "Interest is charged on the balance outstanding, which falls with each payment.", "MODEL_INTEREST_ON_ORIGINAL", { stage: 0, failure: "selection", conditionTrue: "True only of the first payment, or of an interest-only loan." }),
          statement("III", "The principal portion of the last payment equals the payment times $v$.", true, "The last payment clears the balance $B_{n-1}$ plus one year's interest on it, so $P = B_{n-1}(1+i)$ and the principal is $B_{n-1} = Pv$.", "CONC_LOAN_SCHEDULE_REVERSED", { stage: 2, failure: "application", conditionTrue: "$Pv^n$ is the principal in the first payment." }),
        ],
        extra: [
          { keys: ["I", "II"], misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Treating every payment as the same split — interest $iL$ and principal $L/n$ — accepts II and rejects III.", stage: 1, failure: "recognition" },
          { keys: ["II"], misconception: "MODEL_INTEREST_ON_PAYMENT", why: "Judging the portions from the payment rather than the balance rejects both I and III.", stage: 0, failure: "interpretation" },
        ],
        params: { variant },
      });
    }
    if (level === 1) {
      return statementQuestion({
        ...common,
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The interest portion of the first payment is ${amt(i * L)}.`, true, `The first year's interest is charged on the whole loan: $${mpc(i)} \\times ${mamt(L)}$.`, "MODEL_INTEREST_ON_PAYMENT", { stage: 0, failure: "interpretation", check: { expr: `${lit(i)}*${lit(L)}`, op: "=", than: rows[0].interest } }),
          statement("II", `The principal portion of the first payment is less than ${amt(L / n)}.`, true, `It is $L/s_{\\overline{${n}|}}$ and $s_{\\overline{${n}|}} > ${n}$, so it is below $L/${n}$.`, "CONC_LOAN_PRINCIPAL_LEVEL", { stage: 1, failure: "recognition", check: { expr: R1, op: "<", than: lit(L / n) } }),
          statement("III", `The total interest paid over the ${n} years is ${amt(n * i * L)}.`, false, `That is ${n} years of interest on the whole loan; the balance falls, so the total is $${n}P - L$.`, "MODEL_INTEREST_ON_ORIGINAL", { stage: 0, failure: "selection", check: { expr: `${n}*${payE(ln)} - ${lit(L)}`, op: "=", than: n * i * L, tol: 1e-4 }, conditionTrue: "True for an interest-only loan with the principal repaid at the end." }),
        ],
        extra: [{ keys: ["I", "III"], misconception: "ALLOC_EVEN_SPLIT", why: "Splitting every payment the same way — interest $iL$ and principal $L/n$ — accepts III and rejects II.", stage: 1, failure: "application" }],
        params: { L, i, n, variant },
      });
    }
    const k = rng.int(3, n - 3);
    const Ik = rows[k - 1].interest;
    const Rk = rows[k - 1].principal;
    const r1 = rows[0].principal;
    const symbolic = variant === 0;
    const statements = symbolic
      ? [
          statement("I", `$I_{${k}} - I_{${k + 1}} = iR_{${k}}$`, true, `Payment ${k} lowers the balance by $R_{${k}}$, so the next year's interest is lower by $iR_{${k}}$.`, "CONC_LOAN_BALANCE_INTEREST_CONFUSED", { stage: 0, failure: "connection", check: { expr: `${lit(Ik)} - ${lit(rows[k].interest)}`, op: "=", than: `${lit(i)}*${lit(Rk)}` } }),
          statement("II", `$R_{${k}} = R_1(1+i)^{${k}}$`, false, `Payment ${k} is ${k - 1} payments after the first, so $R_{${k}} = R_1(1+i)^{${k - 1}}$.`, "TIMING_EXTRA_PERIOD", { stage: 1, failure: "application", check: { expr: lit(Rk), op: "=", than: `${lit(r1)}*${onePlusLit(i)}**${k}` }, conditionTrue: `It holds for $R_{${k + 1}}$.` }),
          statement("III", `$B_{${k}} = L - ${k}R_1$`, false, `The principal portions grow, so the first ${k} repay $R_1 s_{\\overline{${k}|}}$, more than $${k}R_1$.`, "CONC_LOAN_PRINCIPAL_LEVEL", { stage: 2, failure: "selection", check: { expr: retroE(ln, k), op: "=", than: `${lit(L)} - ${k}*${lit(r1)}` }, conditionTrue: "True for a loan repaid by equal principal amounts." }),
        ]
      : [
          statement("I", `The interest portion of the ${ord(k + 1)} payment is ${amt(Ik - i * Rk)}.`, true, `It is $I_{${k}} - iR_{${k}}$: the balance fell by $R_{${k}}$.`, "CONC_LOAN_BALANCE_INTEREST_CONFUSED", { stage: 0, failure: "connection", check: { expr: lit(rows[k].interest), op: "=", than: Number((Ik - i * Rk).toFixed(2)), tol: 1e-4 } }),
          statement("II", `The principal portion of the ${ord(k + 2)} payment is ${amt(Rk * (1 + i))}.`, false, `Two payments later the principal is $R_{${k}}(1+i)^2 = ${mamt(Number((Rk * (1 + i) ** 2).toFixed(2)))}$.`, "TIMING_MISSING_PERIOD", { stage: 1, failure: "application", check: { expr: lit(rows[k + 1].principal), op: "=", than: Number((Rk * (1 + i)).toFixed(2)), tol: 1e-4 }, conditionTrue: `It is the principal portion of payment ${k + 1}.` }),
          statement("III", `The balance just after the ${ord(k)} payment is ${amt(L - k * r1)}.`, false, `The principal portions grow, so the balance is $L - R_1 s_{\\overline{${k}|}}$, below $L - ${k}R_1$.`, "CONC_LOAN_PRINCIPAL_LEVEL", { stage: 2, failure: "selection", check: { expr: retroE(ln, k), op: "=", than: Number((L - k * r1).toFixed(2)), tol: 1e-4 } }),
        ];
    return statementQuestion({
      ...common,
      stem: symbolic
        ? `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate $i > 0$. For payment $t$, $I_t$ and $R_t$ denote the interest and principal portions, and $B_t$ is the balance just after payment $t$.\n\nDetermine which of the following statements are true.`
        : `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}. The ${ord(k)} payment consists of interest of ${amt(Ik)} and principal of ${amt(Rk)}. The principal portion of the first payment is ${amt(r1)}.\n\nDetermine which of the following statements are true.`,
      statements,
      extra: [
        { keys: ["I", "II", "III"], misconception: "MODEL_LEVEL_FOR_VARYING", why: "Accepting every statement treats the growing principal portions as if they could be added or compounded either way.", stage: 2, failure: "conclusion" },
        { keys: ["II"], misconception: "CONC_LOAN_INTEREST_GEOMETRIC", why: "Treating interest as falling geometrically rejects I; miscounting the factors accepts II.", stage: 0, failure: "selection" },
      ],
      presentation: symbolic ? ["indirect-wording"] : ["rearrange-first"],
      features: { unfamiliar: true },
      params: { L, i, n, k, variant },
    });
  },
});

// ================================================================ LOANS.amortization

const amScheduleRead: ChoiceTemplate = conceptTemplate({
  id: "con-loan-am-schedule-read",
  family: "con-loan-am",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.amortization",
  secondary: ["LOANS.outstanding_balance"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  reasoning: ["concept_recognition", "translation"],
  soaConcept: "Reading what the entries of an amortization schedule represent.",
  variants: 2,
  generate(rng, level, variant) {
    const balloon = level === 2;
    const base = drawLoan(rng, 12, 20);
    const { L, i, n } = base;
    // Level 2: payments of X (the level payment rounded down) and a larger final payment.
    const X = balloon ? Math.floor((base.P - 11) / 50) * 50 : base.P;
    const payments = Array.from({ length: n }, () => X);
    if (balloon) payments[n - 1] = (L * (1 + i) ** (n - 1) - X * sn(n - 1, i)) * (1 + i);
    const F = payments[n - 1];
    const rows = amortize(L, i, payments);
    const k = rng.int(3, n - 4);
    const Xe = balloon ? lit(X) : payE(base);
    const Bk = `(${lit(L)}*${accPow(i, k)} - ${Xe}*${sExpr(k, i)})`;
    const prosp = balloon ? `(${lit(X)}*${aExpr(n - k - 1, i)} + ${lit(F)}*${vPow(i, n - k)})` : `(${Xe}*${aExpr(n - k, i)})`;
    const table = {
      type: "table" as const,
      caption: "Extract from the amortization schedule",
      columns: ["Payment", "Amount", "Interest", "Principal", "Balance after payment"],
      rows: [k - 1, k, k + 1].map((t) => [String(t), amt(Number(rows[t - 1].payment.toFixed(2))), amt(Number(rows[t - 1].interest.toFixed(2))), amt(Number(rows[t - 1].principal.toFixed(2))), amt(Number(rows[t - 1].closing.toFixed(2)))]),
    };
    const loanText = balloon
      ? `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} annual payments at the end of each year: ${n - 1} payments of ${amt(X)} followed by a final payment of ${amt(Number(F.toFixed(2)))}.`
      : `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments at the end of each year.`;
    const balanceEntry = amt(Number(rows[k - 1].closing.toFixed(2)));
    const sumPrincipal = rows.slice(0, k).reduce((s, r) => s + r.principal, 0);
    const steps = [
      { concept: "loan.balance-prospective-retrospective", reasoning: `The balance after payment ${k} is what the remaining payments are worth at time ${k}, and also the loan accumulated to time ${k} less the payments accumulated to time ${k}.` },
      { concept: "loan.amortization-schedule", reasoning: "Each principal entry is the fall in the balance in that row, so the principal entries up to a row add to the loan less that row's closing balance." },
      ...(balloon ? [{ concept: "loan.non-level-payments", reasoning: `The final payment is not ${amt(X)}, so a level annuity factor does not give the balance.` }] : []),
    ];
    const rel = "$B_k = \\sum_{t>k} K_t v^{t-k} = L(1+i)^k - \\sum_{t \\le k} K_t(1+i)^{k-t}, \\qquad \\sum_{t \\le k} R_t = L - B_k$";
    const transfer = {
      principle: "Every balance entry is a value at that row's date: the present value of what is still to be paid.",
      unusual: "You interpret a schedule entry instead of computing one.",
      misread: "The principal column and the balance column are complements of the loan, not the same thing.",
    };

    if (variant === 0) {
      const distractors: ConceptOption[] = [
        ...(balloon ? [{ content: `${amt(X)} times $a_{\\overline{${n - k}|}}$ at $${mpc(i)}$`, misconception: "CONC_LOAN_IRREGULAR_FINAL_IGNORED" as const, why: `The final payment is ${amt(Number(F.toFixed(2)))}, not ${amt(X)}, so a level annuity of ${amt(X)} understates the balance.`, check: { expr: `${lit(X)}*${aExpr(n - k, i)}`, op: "=" as const, than: Bk }, stage: 2, failure: "selection" as const, conditionTrue: "True if every remaining payment were the regular amount." }] : []),
        { content: `The principal repaid by payments 1 through ${k}`, misconception: "CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", why: "The principal repaid so far is the loan less this entry, not the entry itself.", check: { expr: `${lit(L)} - ${Bk}`, op: "=", than: Bk }, stage: 1, failure: "interpretation" },
        { content: `The present value at time 0 of payments ${k + 1} through ${n}`, misconception: "TIMING_VALUATION_DATE", why: `The entry is a value at time ${k}; discounting it to time 0 gives a smaller amount.`, check: { expr: `${prosp}*${vPow(i, k)}`, op: "=", than: Bk }, stage: 0, failure: "application" },
        { content: `The sum of payments ${k + 1} through ${n}`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Future payments include future interest; the balance is their discounted value.", check: { expr: `${payments.slice(k).reduce((s, x) => s + x, 0)}`, op: "=", than: Bk }, stage: 0, failure: "interpretation" },
        { content: `The present value at time ${k} of payments ${k} through ${n}`, misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has just been made, so it is no longer owed.`, check: { expr: `${prosp} + ${lit(payments[k - 1])}`, op: "=", than: Bk }, stage: 0, failure: "application", conditionTrue: `This is the balance just before payment ${k} is made.` },
        { content: `The loan amount less the sum of payments 1 through ${k}`, misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Interest accrues on the loan; the retrospective balance accumulates both the loan and the payments.", check: { expr: `${lit(L)} - ${k}*${lit(payments[0])}`, op: "=", than: Bk }, stage: 0, failure: "selection" },
      ];
      return conceptQuestion({
        stem: `${loanText} An extract from the amortization schedule is shown.\n\nDetermine which of the following the entry ${balanceEntry} in the last column represents.`,
        exhibits: [table],
        correct: { content: `The present value at time ${k} of payments ${k + 1} through ${n}`, why: `After payment ${k}, the borrower owes exactly what the remaining payments are worth at time ${k} at $${mpc(i)}$.`, check: { expr: prosp, op: "=", than: Bk } },
        distractors,
        steps,
        conditions: balloon ? ["Payments at the end of each year.", "A constant annual effective rate of interest."] : LEVEL_CONDITIONS,
        relationship: rel,
        transfer,
        itemFormat: "interpretation",
        presentation: balloon ? ["hidden-structure"] : ["direct"],
        features: { unfamiliar: balloon },
        params: { L, i, n, k, X, variant },
      });
    }
    const distractors: ConceptOption[] = [
      ...(balloon ? [{ content: `The loan amount less ${amt(X)} times $a_{\\overline{${n - k}|}}$`, misconception: "CONC_LOAN_IRREGULAR_FINAL_IGNORED" as const, why: "The remaining payments are not all level, so the balance is not a level annuity of the regular payment.", check: { expr: `${lit(L)} - ${lit(X)}*${aExpr(n - k, i)}`, op: "=" as const, than: lit(sumPrincipal) }, stage: 2, failure: "selection" as const }] : []),
      { content: `The balance just after payment ${k}`, misconception: "CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", why: "The balance is what is still owed; the principal repaid is the loan less the balance.", check: { expr: Bk, op: "=", than: lit(sumPrincipal) }, stage: 1, failure: "interpretation" },
      { content: `${k} times the principal portion of payment 1`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The principal portions grow from row to row, so they are not all equal to the first.", check: { expr: `${k}*${lit(rows[0].principal)}`, op: "=", than: lit(sumPrincipal) }, stage: 1, failure: "selection" },
      { content: `The present value at time 0 of payments 1 through ${k}`, misconception: "TIMING_VALUATION_DATE", why: `That equals the loan less the balance discounted to time 0, $L - B_{${k}}v^{${k}}$.`, check: { expr: payments.slice(0, k).map((x, t) => `${lit(x)}*${vPow(i, t + 1)}`).join(" + "), op: "=", than: lit(sumPrincipal) }, stage: 0, failure: "application" },
      { content: `The total interest paid in payments 1 through ${k}`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "Interest paid is the payments less the principal repaid; the principal column excludes it.", check: { expr: `${k}*${lit(payments[0])} - (${lit(L)} - ${Bk})`, op: "=", than: lit(sumPrincipal) }, stage: 1, failure: "interpretation" },
    ];
    return conceptQuestion({
      stem: `${loanText} An extract from the amortization schedule is shown.\n\nDetermine which of the following equals the sum of the entries in the principal column for payments 1 through ${k}.`,
      exhibits: [table],
      correct: { content: `The loan amount less the balance just after payment ${k}`, why: "Each principal entry is the fall in the balance in its row; the falls add up to $L - B_k$.", check: { expr: `${lit(L)} - ${Bk}`, op: "=", than: lit(sumPrincipal) } },
      distractors,
      steps,
      conditions: balloon ? ["Payments at the end of each year.", "A constant annual effective rate of interest."] : LEVEL_CONDITIONS,
      relationship: rel,
      transfer,
      itemFormat: "interpretation",
      presentation: balloon ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: balloon },
      params: { L, i, n, k, X, variant },
    });
  },
});

const amPrincipalExpression: ChoiceTemplate = conceptTemplate({
  id: "con-loan-am-principal-expression",
  family: "con-loan-am",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.amortization",
  secondary: ["LOANS.payment_components", "LOANS.outstanding_balance"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["formula_selection", "cashflow_modelling"],
  soaConcept: "The $v^{n-t+1}$ structure of principal and interest in level loan payments.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(12, 25);
    const t = drawUntil(() => rng.int(2, n - 2), (x) => new Set([x, n - x, n - x + 1, n - x + 2]).size === 4);
    const e = n - t + 1;
    const steps = [
      { concept: "loan.principal-structure", reasoning: `Just after payment ${t - 1} the balance is $Pa_{\\overline{${e}|}}$; interest on it is $P(1 - v^{${e}})$, leaving principal $Pv^{${e}}$.` },
      { concept: "loan.amortization-schedule", reasoning: "So principal grows toward the end of the term: the last payment repays $Pv$, the first $Pv^{n}$." },
    ];
    const transfer = {
      principle: "The exponent counts the payments from $t$ to the end inclusive: $n - t + 1$.",
      unusual: "Options are expressions; check them at $t = n$, where principal is $Pv$.",
      misread: "Counting the payments after $t$ instead of from $t$ loses one factor of $v$.",
    };
    if (level === 1) {
      const ln: Loan = { L: an(n, i), i, n, P: 1 };
      const row = schedule(ln)[t - 1];
      const vv = (p: number) => lit(v(i, p));
      const asksPrincipal = variant === 0;
      const stem = `A loan is repaid by ${n} annual payments of 1 made at the end of each year at an annual effective interest rate $i$.\n\nDetermine which of the following expressions gives the ${asksPrincipal ? "principal" : "interest"} portion of the ${ord(t)} payment.`;
      const options: { correct: ConceptOption; distractors: ConceptOption[] } = asksPrincipal
        ? {
            correct: { content: math(`v^{${e}}`), why: `The balance just after payment ${t - 1} is $a_{\\overline{${e}|}}$; payment ${t} pays interest $1 - v^{${e}}$ and repays $v^{${e}}$.`, probe: vv(e) },
            distractors: [
              { content: math(`v^{${n - t}}`), misconception: "TIMING_MISSING_PERIOD", why: `Payments ${t} through ${n} number ${e}, not ${n - t}.`, probe: vv(n - t), stage: 0, failure: "application", conditionTrue: `This is the principal portion of payment ${t + 1}.` },
              { content: math(`v^{${t}}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "Early payments repay the least principal; $v^t$ reverses the pattern.", probe: vv(t), stage: 1, failure: "interpretation" },
              { content: math(`1 - v^{${e}}`), misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "That is the interest portion of the payment.", probe: lit(1 - v(i, e)), stage: 0, failure: "interpretation" },
              { content: math(`v^{${e + 1}}`), misconception: "TIMING_EXTRA_PERIOD", why: "One factor of $v$ too many: that is the principal of the previous payment.", probe: vv(e + 1), stage: 0, failure: "application", conditionTrue: `This is the principal portion of payment ${t - 1}.` },
              { content: math(`\\dfrac{a_{\\overline{${n}|}}}{${n}}`), misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Principal portions are not level; they grow by $1+i$ each year.", probe: `${aExpr(n, i)}/${n}`, stage: 1, failure: "selection" },
            ],
          }
        : {
            correct: { content: math(`1 - v^{${e}}`), why: `Interest is $i$ times the balance $a_{\\overline{${e}|}}$ just after payment ${t - 1}: $ia_{\\overline{${e}|}} = 1 - v^{${e}}$.`, probe: lit(1 - v(i, e)) },
            distractors: [
              { content: math(`i\\,a_{\\overline{${n - t}|}}`), misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `That is interest on the balance just after payment ${t}, which only exists at the end of year ${t}.`, probe: `${lit(i)}*${aExpr(n - t, i)}`, stage: 0, failure: "application", conditionTrue: `This is the interest portion of payment ${t + 1}.` },
              { content: math(`v^{${e}}`), misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "That is the principal portion of the payment.", probe: vv(e), stage: 0, failure: "interpretation" },
              { content: math(`i\\,a_{\\overline{${n}|}}`), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Interest on the original loan applies to the first payment only.", probe: `${lit(i)}*${aExpr(n, i)}`, stage: 0, failure: "selection" },
              { content: math(`1 - v^{${t}}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "Interest is largest early in the term; $1 - v^t$ grows with $t$, reversing the pattern.", probe: lit(1 - v(i, t)), stage: 1, failure: "interpretation" },
              { content: math(`1 - v^{${e + 1}}`), misconception: "TIMING_EXTRA_PERIOD", why: "One factor of $v$ too many: that is the interest in the previous payment.", probe: lit(1 - v(i, e + 1)), stage: 0, failure: "application" },
            ],
          };
      return conceptQuestion({
        stem,
        ...options,
        reference: { values: [{ label: asksPrincipal ? `R_{${t}}` : `I_{${t}}`, expr: lit(asksPrincipal ? row.principal : row.interest) }], description: `Read from the amortization schedule of a loan of $a_{\\overline{${n}|}}$ at $i = ${mpc(i)}$ (the rate used for the numerical check).` },
        steps,
        conditions: LEVEL_CONDITIONS,
        relationship: "$R_t = v^{n-t+1}, \\qquad I_t = 1 - v^{n-t+1}$ for payments of 1.",
        transfer,
        itemFormat: "expression-selection",
        params: { i, n, t, variant },
      });
    }
    const L = gridAmount(rng, 10000, 80000, 1000);
    const ln: Loan = { L, i, n, P: L / an(n, i) };
    const R = ln.P * v(i, e);
    const toPayment = variant === 0;
    const Rl = lit(R);
    const f = onePlusLit(i);
    const stem = `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate $i$. The principal portion of the ${ord(t)} payment is $R$.\n\nDetermine which of the following expressions gives the ${toPayment ? "level payment" : `outstanding balance just after the ${ord(t - 1)} payment`}.`;
    const options: { correct: ConceptOption; distractors: ConceptOption[] } = toPayment
      ? {
          correct: { content: math(`R(1+i)^{${e}}`), why: `$R = Pv^{${e}}$, so $P = R(1+i)^{${e}}$.`, probe: `${Rl}*${f}**${e}` },
          distractors: [
            { content: math(`R(1+i)^{${n - t}}`), misconception: "TIMING_MISSING_PERIOD", why: `The principal of payment ${t} is $Pv^{${e}}$, so ${e} factors are needed.`, probe: `${Rl}*${f}**${n - t}`, stage: 0, failure: "application" },
            { content: math(`Rv^{${e}}`), misconception: "ALG_INVERTED_RATIO", why: "The payment exceeds its principal portion, so $R$ must be multiplied by $(1+i)^{n-t+1}$, not $v^{n-t+1}$.", probe: `${Rl}*${f}**(-${e})`, stage: 2, failure: "application" },
            { content: math(`R(1+i)^{${t}}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The exponent counts the payments from $t$ to the end, not from the start.", probe: `${Rl}*${f}**${t}`, stage: 1, failure: "interpretation" },
            { content: math(`R(1+i)^{${e + 1}}`), misconception: "TIMING_EXTRA_PERIOD", why: "One factor of $1+i$ too many.", probe: `${Rl}*${f}**${e + 1}`, stage: 0, failure: "application" },
            { content: math(`R\\bigl(1+${e}i\\bigr)`), misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "The principal portions grow geometrically, so the factor compounds.", probe: `${Rl}*(1+${e}*${lit(i)})`, stage: 1, failure: "selection" },
          ],
        }
      : {
          correct: { content: math(`R\\,s_{\\overline{${e}|}}`), why: `The balance is repaid by the principal portions $R, R(1+i), \\ldots, R(1+i)^{${e - 1}}$, which add to $Rs_{\\overline{${e}|}}$.`, probe: `${Rl}*${sExpr(e, i)}` },
          distractors: [
            { content: math(`R\\,a_{\\overline{${e}|}}`), misconception: "FORMULA_AV_FOR_PV", why: "The principal portions grow, so their sum is $Rs_{\\overline{n-t+1}|}$, not a present value.", probe: `${Rl}*${aExpr(e, i)}`, stage: 2, failure: "selection" },
            { content: math(`R\\,s_{\\overline{${n - t}|}}`), misconception: "TIMING_MISSING_PERIOD", why: `Payments ${t} through ${n} all repay part of this balance: ${e} principal portions.`, probe: `${Rl}*${sExpr(n - t, i)}`, stage: 1, failure: "application" },
            { content: math(`R\\,s_{\\overline{${e + 1}|}}`), misconception: "TIMING_EXTRA_PERIOD", why: "Only the payments from $t$ onward repay this balance.", probe: `${Rl}*${sExpr(e + 1, i)}`, stage: 1, failure: "application" },
            { content: math(`${e}R`), misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The remaining principal portions grow from $R$, so they are not all equal to $R$.", probe: `${e}*${Rl}`, stage: 2, failure: "selection" },
          ],
        };
    return conceptQuestion({
      stem,
      ...options,
      reference: {
        values: [{ label: toPayment ? "P" : `B_{${t - 1}}`, expr: toPayment ? payE(ln) : retroE(ln, t - 1) }],
        description: toPayment ? `The level payment $L/a_{\\overline{${n}|}}$ at $i = ${mpc(i)}$ (the rate used for the numerical check).` : `Retrospective balance $L(1+i)^{${t - 1}} - Ps_{\\overline{${t - 1}|}}$ at $i = ${mpc(i)}$.`,
      },
      steps: [...steps, { concept: "loan.balance-prospective-retrospective", reasoning: toPayment ? "Invert $R = Pv^{n-t+1}$ for the payment." : "The balance just after payment $t-1$ equals the principal still to be repaid: the sum of the remaining principal portions." }],
      conditions: LEVEL_CONDITIONS,
      relationship: "$R_t = Pv^{n-t+1}, \\qquad B_{t-1} = \\sum_{s \\ge t} R_s = R_t\\,s_{\\overline{n-t+1}|}$",
      transfer,
      itemFormat: "expression-selection",
      presentation: ["inverse", "hidden-structure"],
      modelingDecisions: 1,
      params: { L, i, n, t, variant },
    });
  },
});

const amDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-loan-am-diagnosis",
  family: "con-loan-am",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.amortization",
  secondary: ["LOANS.payment_components", "LOANS.outstanding_balance"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing"],
  reasoning: ["validation", "cashflow_modelling", "valuation_dates"],
  soaConcept: "Diagnosing the error in a proposed amortization-schedule calculation.",
  variants: 2,
  generate(rng, level, variant) {
    const deferred = level === 3;
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(10, 20);
    const L = gridAmount(rng, 10000, 60000, 1000);
    const m = deferred ? rng.int(1, 3) : 0;
    const k = rng.int(3, n - 3);
    const P = (L * (1 + i) ** m) / an(n, i);
    const Pe = `(${lit(L)}*${accPow(i, m)}/${aExpr(n, i)})`;
    /** Balance just after payment j (time m + j), retrospectively. */
    const Bj = (j: number) => `(${lit(L)}*${accPow(i, m + j)} - ${Pe}*${sExpr(j, i)})`;
    const Rk = `(${Pe}*${vPow(i, n - k + 1)})`;
    const Bk = `(${Pe}*${aExpr(n - k, i)})`;
    const loanText = deferred
      ? `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments of $P$. The first payment is made at the end of year ${m + 1}.`
      : `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments of $P$ made at the end of each year.`;
    const steps = [
      { concept: "loan.interest-principal-split", reasoning: "Interest in a payment is $i$ times the balance just after the previous payment; principal is the rest." },
      { concept: "loan.amortization-schedule", reasoning: "The balance falls by each principal portion, and the principal portions grow by $1+i$." },
      { concept: "loan.balance-prospective-retrospective", reasoning: "Retrospectively, the balance is the loan accumulated to that date less the payments accumulated to that date." },
      ...(deferred ? [{ concept: "loan.balance-timing", reasoning: `No payment is made in the first ${m} year${m > 1 ? "s" : ""}, so the balance grows to $L(1+i)^{${m}}$ before the first payment.` }] : []),
    ];
    const conditions = deferred ? [`First payment at the end of year ${m + 1}; level payments thereafter.`, "A constant annual effective rate of interest."] : LEVEL_CONDITIONS;
    const transfer = {
      principle: "Rebuild the row: interest on the opening balance, principal = payment − interest, and every balance at its own date.",
      unusual: "You judge a worked solution instead of producing one.",
      misread: deferred ? "Interest added during a deferral becomes part of the balance." : "The first row's principal is not every row's principal.",
    };
    const common = { steps, conditions, transfer, itemFormat: "error-diagnosis" as const, presentation: deferred ? (["hidden-structure", "valuation-date"] as const).slice() : (["indirect-wording"] as const).slice(), features: { unfamiliar: true, multipleValuationDates: deferred }, ...(deferred ? { modelingDecisions: 1 } : {}), relationship: "$R_k = P - iB_{k-1} = Pv^{n-k+1}, \\qquad B_k = L(1+i)^{m+k} - Ps_{\\overline{k}|}$, with $m$ years of deferral." };

    if (variant === 0) {
      const proposed = P - i * L;
      return conceptQuestion({
        ...common,
        stem: `${loanText} A candidate calculates the principal portion of the ${ord(k)} payment as\n\n$$P - ${mpc(i)} \\times ${mamt(L)} = ${mamt(Number(proposed.toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: {
          content: deferred
            ? `Interest is charged on the balance just after the previous payment, which includes interest added during the deferral.`
            : `Interest is charged on the balance just after the previous payment, not on the amount borrowed.`,
          why: `The interest in payment ${k} is $iB_{${k - 1}}$; replacing $iL$ by it gives the principal $Pv^{${n - k + 1}}$.`,
          check: { expr: `${Pe} - ${lit(i)}*${Bj(k - 1)}`, op: "=", than: Rk },
        },
        distractors: [
          ...(deferred ? [{ content: `Interest is charged on the loan accumulated to the first payment date, $${mamt(L)}(1+i)^{${m + 1}}$.`, misconception: "TIMING_DEFERRAL_OFF_BY_ONE" as const, why: `The first payment is at time ${m + 1}, but interest for payment ${k} accrues on the balance just after payment ${k - 1}.`, check: { expr: `${Pe} - ${lit(i)}*${lit(L)}*${accPow(i, m + 1)}`, op: "=" as const, than: Rk }, stage: 3, failure: "application" as const }] : []),
          { content: "The calculation is correct, since interest is always charged on the amount borrowed.", misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Interest is charged on the balance outstanding, which has changed since the loan was made.", check: { expr: `${Pe} - ${lit(i)}*${lit(L)}`, op: "=", than: Rk }, stage: 0, failure: "selection", conditionTrue: deferred ? undefined : "It is correct for the first payment." },
          { content: `Interest should be charged on the balance just after the ${ord(k)} payment.`, misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `That balance exists only once payment ${k} has been made.`, check: { expr: `${Pe} - ${lit(i)}*${Bk}`, op: "=", than: Rk }, stage: 0, failure: "application" },
          { content: `The result must be accumulated: multiply it by $(1+i)^{${k}}$.`, misconception: "TIMING_EXTRA_PERIOD", why: `Even where $P - iL$ is the first principal portion, payment ${k} is ${k - 1} payments later, not ${k}.`, check: { expr: `(${Pe} - ${lit(i)}*${lit(L)})*${accPow(i, k)}`, op: "=", than: Rk }, stage: 1, failure: "application" },
          { content: `Principal is level, so it is ${amt(L)}/${n} in every payment.`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Level payments repay growing amounts of principal.", check: { expr: `${lit(L)}/${n}`, op: "=", than: Rk }, stage: 1, failure: "selection" },
          { content: "Interest should be charged on the payment, giving $P - iP$.", misconception: "MODEL_INTEREST_ON_PAYMENT", why: "Interest accrues on the money still lent, not on the payment.", check: { expr: `${Pe}*(1-${lit(i)})`, op: "=", than: Rk }, stage: 0, failure: "interpretation" },
        ],
        reference: { description: `Principal portion of payment ${k}: $Pv^{${n - k + 1}}$ with $P = L(1+i)^{${m}}/a_{\\overline{${n}|}}$; each option's correction is evaluated and compared with it.` },
        counterexample: deferred ? "Without the deferral, $P - iL$ would be exactly the first payment's principal." : "For the first payment, $P - iL$ is exactly right.",
        params: { L, i, n, m, k, variant },
      });
    }
    const R1 = P - i * L * (1 + i) ** m;
    const proposed = deferred ? L * (1 + i) ** k - P * sn(k, i) : L - k * (P - i * L);
    const shown = mamt(Number(proposed.toFixed(2)));
    const formula = deferred ? `${mamt(L)}(1+i)^{${k}} - P\\,s_{\\overline{${k}|}}` : `${mamt(L)} - ${k}(P - ${mamt(L)}\\,i)`;
    const distractors: ConceptOption[] = deferred
      ? [
          { content: `The calculation is correct: after ${k} payments the loan is accumulated for ${k} years.`, misconception: "TIMING_IGNORED_DEFERRAL", why: `Payment ${k} is made at time ${m + k}; the loan has accrued interest for ${m + k} years.`, check: { expr: lit(proposed), op: "=", than: Bk }, stage: 3, failure: "recognition", conditionTrue: "Correct if the first payment were at the end of year 1." },
          { content: `The loan should be accumulated to time ${m + k - 1}: $${mamt(L)}(1+i)^{${m + k - 1}} - P\\,s_{\\overline{${k}|}}$.`, misconception: "TIMING_DEFERRAL_OFF_BY_ONE", why: `The ${ord(k)} payment is at time ${m + k}, not ${m + k - 1}.`, check: { expr: `${lit(L)}*${accPow(i, m + k - 1)} - ${Pe}*${sExpr(k, i)}`, op: "=", than: Bk }, stage: 3, failure: "application" },
          { content: `The payments must also be discounted: $${mamt(L)}(1+i)^{${k}} - P\\,s_{\\overline{${k}|}}v^{${m}}$.`, misconception: "CONC_MOVED_WRONG_WAY", why: "The payments are already valued at the date of payment $k$; it is the loan that must be moved forward.", check: { expr: `${lit(L)}*${accPow(i, k)} - ${Pe}*${sExpr(k, i)}*${vPow(i, m)}`, op: "=", than: Bk }, stage: 2, failure: "application" },
          { content: `The deferral years count as payments: $${mamt(L)}(1+i)^{${k}} - P\\,s_{\\overline{${m + k}|}}$.`, misconception: "SEQ_TERM_COUNT", why: `Only ${k} payments have been made; the deferral contributes interest, not payments.`, check: { expr: `${lit(L)}*${accPow(i, k)} - ${Pe}*${sExpr(m + k, i)}`, op: "=", than: Bk }, stage: 2, failure: "interpretation" },
          { content: `The prospective value must be discounted: $P\\,a_{\\overline{${n - k}|}}v^{${m}}$.`, misconception: "TIMING_VALUATION_DATE", why: `The balance is a value at the date of payment ${k}; discounting it moves it to an earlier date.`, check: { expr: `${Bk}*${vPow(i, m)}`, op: "=", than: Bk }, stage: 2, failure: "application" },
        ]
      : [
          { content: "The calculation is correct, since every payment repays the same principal.", misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The principal portions grow by $1+i$, so the first one is the smallest.", check: { expr: lit(proposed), op: "=", than: Bk }, stage: 1, failure: "recognition", conditionTrue: "Correct for a loan repaid by equal principal amounts of $P - iL$." },
          { content: `The ${k} payments repay $(P - ${mamt(L)}\\,i)\\,a_{\\overline{${k}|}}$ of principal.`, misconception: "FORMULA_AV_FOR_PV", why: "The principal portions grow, so their sum is an accumulated value, $s_{\\overline{k}|}$, not $a_{\\overline{k}|}$.", check: { expr: `${lit(L)} - ${lit(R1)}*${aExpr(k, i)}`, op: "=", than: Bk }, stage: 1, failure: "selection" },
          { content: `The balance is the loan less the payments made: ${amt(L)} $- ${k}P$.`, misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Payments include interest; only their principal portions reduce the balance.", check: { expr: `${lit(L)} - ${k}*${Pe}`, op: "=", than: Bk }, stage: 2, failure: "selection" },
          { content: `The ${k} payments repay $(P - ${mamt(L)}\\,i)\\,s_{\\overline{${k + 1}|}}$ of principal.`, misconception: "SEQ_TERM_COUNT", why: `Only ${k} principal portions have been repaid.`, check: { expr: `${lit(L)} - ${lit(R1)}*${sExpr(k + 1, i)}`, op: "=", than: Bk }, stage: 1, failure: "application" },
          { content: `The balance is $${mamt(L)}(1+i)^{${k}} - ${k}P$.`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "The loan was accumulated but the payments were not; both must be valued at the same date.", check: { expr: `${lit(L)}*${accPow(i, k)} - ${k}*${Pe}`, op: "=", than: Bk }, stage: 2, failure: "application" },
        ];
    return conceptQuestion({
      ...common,
      stem: `${loanText} A candidate calculates the outstanding balance just after the ${ord(k)} payment as\n\n$$${formula} = ${shown}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
      correct: deferred
        ? { content: `The loan should be accumulated to time ${m + k}: $${mamt(L)}(1+i)^{${m + k}} - P\\,s_{\\overline{${k}|}}$.`, why: `The ${ord(k)} payment is made at time ${m + k}, so the loan has accrued interest for ${m + k} years.`, check: { expr: Bj(k), op: "=", than: Bk } }
        : { content: `The principal portions grow, so the ${k} payments repay $(P - ${mamt(L)}\\,i)\\,s_{\\overline{${k}|}}$.`, why: `The first principal portion is $P - iL$ and later ones grow by $1+i$, so ${k} of them add to $(P - iL)s_{\\overline{${k}|}}$.`, check: { expr: `${lit(L)} - ${lit(R1)}*${sExpr(k, i)}`, op: "=", than: Bk } },
      distractors,
      reference: { description: `Prospective balance $Pa_{\\overline{${n - k}|}}$ just after payment ${k}; each option's correction is evaluated and compared with it.` },
      counterexample: deferred ? "With no deferral the candidate's formula would be the standard retrospective balance." : "With equal principal repayments the candidate's formula would be right.",
      params: { L, i, n, m, k, variant },
    });
  },
});

// ================================================================ LOANS.outstanding_balance

const obRetroProsp: ChoiceTemplate = conceptTemplate({
  id: "con-loan-ob-retro-prosp",
  family: "con-loan-ob",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.amortization"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "timing"],
  reasoning: ["concept_recognition", "valuation_dates"],
  soaConcept: "The retrospective and prospective forms of the outstanding loan balance.",
  variants: 2,
  generate(rng, level, variant) {
    const retro = variant === 0;
    const steps = [
      { concept: "loan.balance-prospective-retrospective", reasoning: "Prospectively the balance is the value at time $k$ of the payments still to come; retrospectively it is the loan accumulated to time $k$ less the payments made, also accumulated to time $k$." },
      { concept: "loan.balance-timing", reasoning: "“Just after payment $k$” means payment $k$ is among the payments made, and both sides are valued at time $k$." },
    ];
    const transfer = {
      principle: "Both forms value at the balance date: what is still to come (prospective) or what has happened, with interest (retrospective).",
      unusual: level === 2 ? "The final payment differs from the others." : "The question names a method rather than a value.",
      misread: "“Retrospective” looks back at the payments made; “prospective” looks forward at those still due.",
    };
    if (level === 1) {
      const n = rng.int(10, 30);
      const k = rng.int(3, n - 3);
      const scene = `A loan is repaid by ${n} level annual payments made at the end of each year.`;
      const correct: ConceptOption = retro
        ? { content: `The loan accumulated to time ${k}, less the first ${k} payments accumulated to time ${k}`, why: "Looking back: what was lent, with interest, less what has been paid, with interest." }
        : { content: `The present value at time ${k} of payments ${k + 1} through ${n}`, why: "Looking forward: the payments still due, valued at the balance date." };
      const distractors: ConceptOption[] = retro
        ? [
            { content: `The loan accumulated to time ${k}, less the sum of the first ${k} payments`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "The payments made earlier also earn interest to time $k$, so they must be accumulated too.", stage: 0, failure: "application" },
            { content: `The present value at time ${k} of payments ${k + 1} through ${n}`, misconception: "CONC_RELATED_TERM", why: "That is the prospective form; it gives the same value, but it is not the retrospective method.", stage: 0, failure: "recognition", confusedWith: "loan.balance-prospective-retrospective" },
            { content: `The loan amount, less the present value at time 0 of the first ${k} payments`, misconception: "TIMING_VALUATION_DATE", why: `That is the balance discounted to time 0, $B_{${k}}v^{${k}}$, not its value at time ${k}.`, stage: 1, failure: "application" },
            { content: `The loan amount, less the sum of the first ${k} payments`, misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Interest accrues on the loan, so a balance cannot ignore interest.", stage: 0, failure: "selection", conditionTrue: "Only at a zero interest rate." },
            { content: `The loan accumulated to time ${k}, less the first ${k - 1} payments accumulated to time ${k}`, misconception: "TIMING_BALANCE_INDEX", why: `Just after payment ${k}, payment ${k} has been made and must be deducted.`, stage: 1, failure: "application", conditionTrue: `This is the balance just before payment ${k}.` },
          ]
        : [
            { content: `The present value at time 0 of payments ${k + 1} through ${n}`, misconception: "TIMING_VALUATION_DATE", why: `The balance is a value at time ${k}, not at time 0.`, stage: 1, failure: "application" },
            { content: `The sum of payments ${k + 1} through ${n}`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Future payments include interest not yet earned; the balance is their discounted value.", stage: 0, failure: "application" },
            { content: `The present value at time ${k} of payments ${k} through ${n}`, misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has just been made and is no longer owed.`, stage: 1, failure: "application" },
            { content: `The loan accumulated to time ${k}, less the first ${k} payments accumulated to time ${k}`, misconception: "CONC_RELATED_TERM", why: "That is the retrospective form; it gives the same value, but it is not the prospective method.", stage: 0, failure: "recognition", confusedWith: "loan.balance-prospective-retrospective" },
            { content: `The present value at time ${k} of payments ${k + 1} through ${n}, at the current market rate`, misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The balance owed is valued at the loan's own rate; a market rate gives a sale price, not the balance.", stage: 0, failure: "selection", confusedWith: "loan.balance-sale" },
          ];
      return conceptQuestion({
        stem: `${scene}\n\nWhich of the following describes the ${retro ? "retrospective" : "prospective"} form of the outstanding balance just after the ${ord(k)} payment?`,
        correct,
        distractors,
        steps,
        conditions: LEVEL_CONDITIONS,
        relationship: "$B_k = Pa_{\\overline{n-k}|} = L(1+i)^k - Ps_{\\overline{k}|}$",
        counterexample: "At $k = 0$ the retrospective form is $L$ and the prospective form is $Pa_{\\overline{n}|}$: the same number.",
        transfer,
        itemFormat: "definition",
        params: { n, k, variant },
      });
    }
    // Level 2: n - 1 payments of X and a larger final payment F; options are expressions.
    const base = drawLoan(rng, 12, 20);
    const { L, i, n } = base;
    const X = Math.floor((base.P - 11) / 50) * 50;
    const F = (L * (1 + i) ** (n - 1) - X * sn(n - 1, i)) * (1 + i);
    const k = rng.int(3, n - 4);
    const x = mamt(X);
    const f = mamt(Number(F.toFixed(2)));
    const g = lit(1 + i);
    const Bk = `(${lit(L)}*${accPow(i, k)} - ${lit(X)}*${sExpr(k, i)})`;
    const pros = (a: number, e: number) => `(${lit(X)}*${aExpr(a, i)} + ${lit(F)}*${vPow(i, e)})`;
    const stem = `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n - 1} annual payments of ${amt(X)} at the end of each year, followed by a payment of ${amt(Number(F.toFixed(2)))} at the end of year ${n}. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following expressions is the ${retro ? "retrospective" : "prospective"} form of the outstanding balance just after the ${ord(k)} payment.`;
    const correct: ConceptOption = retro
      ? { content: math(`${mamt(L)}(${g})^{${k}} - ${x}\\,s_{\\overline{${k}|}}`), why: "The loan accumulated to time $k$ less the payments made, accumulated to time $k$; the final payment plays no part.", probe: `${lit(L)}*${accPow(i, k)} - ${lit(X)}*${sExpr(k, i)}` }
      : { content: math(`${x}\\,a_{\\overline{${n - k - 1}|}} + ${f}\\,v^{${n - k}}`), why: `The remaining payments are ${n - k - 1} of ${amt(X)} and the final payment ${n - k} years after time ${k}.`, probe: pros(n - k - 1, n - k) };
    const distractors: ConceptOption[] = [
      { content: math(`${x}\\,a_{\\overline{${n - k}|}}`), misconception: "CONC_LOAN_IRREGULAR_FINAL_IGNORED", why: "The final payment is not the regular amount, so a level annuity misstates the balance.", probe: `${lit(X)}*${aExpr(n - k, i)}`, stage: 2, failure: "selection", conditionTrue: "Correct if every remaining payment were the regular amount." },
      ...(retro
        ? [
            { content: math(`${mamt(L)}(${g})^{${k}} - ${k}(${x})`), misconception: "SEQ_UNDISCOUNTED_SUM" as const, why: "The payments made also earn interest to time $k$.", probe: `${lit(L)}*${accPow(i, k)} - ${k}*${lit(X)}`, stage: 0, failure: "application" as const },
            { content: math(`${mamt(L)} - ${x}\\,a_{\\overline{${k}|}}`), misconception: "TIMING_VALUATION_DATE" as const, why: `That is the balance valued at time 0, not at time ${k}.`, probe: `${lit(L)} - ${lit(X)}*${aExpr(k, i)}`, stage: 1, failure: "application" as const },
            { content: math(`${mamt(L)}(${g})^{${k}} - ${x}\\,s_{\\overline{${k - 1}|}}(${g})`), misconception: "TIMING_BALANCE_INDEX" as const, why: `Payment ${k} has been made, so all ${k} payments are deducted.`, probe: `${lit(L)}*${accPow(i, k)} - ${lit(X)}*${sExpr(k - 1, i)}*${g}`, stage: 1, failure: "application" as const, conditionTrue: `This is the balance just before payment ${k}.` },
            { content: math(`${mamt(L)}(${g})^{${k}} - ${x}\\,s_{\\overline{${k}|}} - ${f}\\,v^{${n - k}}`), misconception: "CONC_DOUBLE_COUNTED" as const, why: "The final payment has not been made, so it is not deducted retrospectively.", probe: `${Bk} - ${lit(F)}*${vPow(i, n - k)}`, stage: 0, failure: "connection" as const },
          ]
        : [
            { content: math(`${x}\\,a_{\\overline{${n - k - 1}|}} + ${f}\\,v^{${n - k - 1}}`), misconception: "TIMING_MISSING_PERIOD" as const, why: `The final payment is at time ${n}, which is ${n - k} years after time ${k}.`, probe: pros(n - k - 1, n - k - 1), stage: 1, failure: "application" as const },
            { content: math(`${x}\\,a_{\\overline{${n - k}|}} + ${f}\\,v^{${n - k}}`), misconception: "CONC_DOUBLE_COUNTED" as const, why: "The last regular payment and the final payment were both counted at time $n$.", probe: pros(n - k, n - k), stage: 0, failure: "connection" as const },
            { content: math(`\\bigl(${x}\\,a_{\\overline{${n - k - 1}|}} + ${f}\\,v^{${n - k}}\\bigr)v^{${k}}`), misconception: "TIMING_VALUATION_DATE" as const, why: `The balance is a value at time ${k}, not at time 0.`, probe: `${pros(n - k - 1, n - k)}*${vPow(i, k)}`, stage: 1, failure: "application" as const },
            { content: math(`${x}\\,\\ddot{a}_{\\overline{${n - k - 1}|}} + ${f}\\,v^{${n - k}}`), misconception: "TIMING_IMMEDIATE_AS_DUE" as const, why: "The next payment is one year away, so the regular payments form an annuity-immediate.", probe: `${lit(X)}*${aExpr(n - k - 1, i)}*${g} + ${lit(F)}*${vPow(i, n - k)}`, stage: 1, failure: "application" as const },
          ]),
    ];
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: `B_{${k}}`, expr: retro ? `(${pros(n - k - 1, n - k)})` : Bk }], description: `The balance computed by the ${retro ? "prospective" : "retrospective"} method, independently of the option's form.` },
      steps: [...steps, { concept: "loan.non-level-payments", reasoning: `The payments are not all ${amt(X)}, so the prospective form must list the final payment separately; the retrospective form needs only the payments made.` }],
      conditions: ["Payments at the end of each year.", "A constant annual effective rate of interest."],
      relationship: "$B_k = \\sum_{t>k} K_t v^{t-k} = L(1+i)^k - \\sum_{t \\le k} K_t(1+i)^{k-t}$",
      transfer,
      itemFormat: "expression-selection",
      presentation: ["hidden-structure"],
      features: { unfamiliar: true },
      params: { L, i, n, k, X, variant },
    });
  },
});

const obEquation: ChoiceTemplate = conceptTemplate({
  id: "con-loan-ob-equation",
  family: "con-loan-ob",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.amortization", "LOANS.unknown_variables"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["formula_selection", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Selecting the expression or equation for a balance at a stated date, including after an extra payment.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const g = lit(1 + i);
    const transfer = {
      principle: "Fix the date first; then the balance is the value at that date of every payment still to come.",
      unusual: level === 3 ? "An extra payment changes either the payment or the term." : "The options differ only in timing.",
      misread: "“Just before” a payment includes it; “just after” does not.",
    };
    if (level === 1) {
      const n = rng.int(12, 25);
      const k = rng.int(3, n - 3);
      const P = gridAmount(rng, 500, 4000, 25);
      const ln: Loan = { L: P * an(n, i), i, n, P };
      const p = mamt(P);
      const after = variant === 0;
      const stem = `A loan is repaid by ${n} annual payments of ${amt(P)} made at the end of each year at an annual effective interest rate of ${pc(i)}. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following expressions gives the outstanding balance just ${after ? "after" : "before"} the ${ord(k)} payment is made.`;
      const options: { correct: ConceptOption; distractors: ConceptOption[] } = after
        ? {
            correct: { content: math(`${p}\\,a_{\\overline{${n - k}|}}`), why: `Payments ${k + 1} through ${n} remain: ${n - k} payments, the first one year away.`, probe: `${lit(P)}*${aExpr(n - k, i)}` },
            distractors: [
              { content: math(`${p}\\,a_{\\overline{${n - k + 1}|}}`), misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has been made; only ${n - k} remain.`, probe: `${lit(P)}*${aExpr(n - k + 1, i)}`, stage: 1, failure: "application", conditionTrue: `This is the balance just after payment ${k - 1}.` },
              { content: math(`${p}\\,a_{\\overline{${n - k}|}}\\,v^{${k}}`), misconception: "TIMING_VALUATION_DATE", why: `The balance is a value at time ${k}, not time 0.`, probe: `${lit(P)}*${aExpr(n - k, i)}*${vPow(i, k)}`, stage: 0, failure: "application" },
              { content: math(`${p}\\,s_{\\overline{${n - k}|}}`), misconception: "FORMULA_AV_FOR_PV", why: "$s$ values the remaining payments at time $n$, not now.", probe: `${lit(P)}*${sExpr(n - k, i)}`, stage: 0, failure: "selection" },
              { content: math(`${n - k} \\times ${p}`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The remaining payments include future interest and must be discounted.", probe: `${n - k}*${lit(P)}`, stage: 0, failure: "application" },
              { content: math(`${p}\\,\\ddot{a}_{\\overline{${n - k}|}}`), misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "The next payment is a year away, so the annuity is immediate.", probe: `${lit(P)}*${aExpr(n - k, i)}*${g}`, stage: 1, failure: "interpretation", conditionTrue: `This is the balance just before payment ${k + 1}.` },
            ],
          }
        : {
            correct: { content: math(`${p}\\,\\ddot{a}_{\\overline{${n - k + 1}|}}`), why: `Payments ${k} through ${n} are still owed and the first is due now: an annuity-due of ${n - k + 1} payments.`, probe: `${lit(P)}*${aExpr(n - k + 1, i)}*${g}` },
            distractors: [
              { content: math(`${p}\\,a_{\\overline{${n - k + 1}|}}`), misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: `That is the balance a year earlier, just after payment ${k - 1}; a year's interest has since accrued.`, probe: `${lit(P)}*${aExpr(n - k + 1, i)}`, stage: 1, failure: "interpretation" },
              { content: math(`${p}\\,a_{\\overline{${n - k}|}}`), misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has not yet been made.`, probe: `${lit(P)}*${aExpr(n - k, i)}`, stage: 1, failure: "application", conditionTrue: `This is the balance just after payment ${k}.` },
              { content: math(`${p}\\,\\ddot{a}_{\\overline{${n - k}|}}`), misconception: "SEQ_TERM_COUNT", why: `Payments ${k} through ${n} number ${n - k + 1}.`, probe: `${lit(P)}*${aExpr(n - k, i)}*${g}`, stage: 0, failure: "application" },
              { content: math(`${p}\\,a_{\\overline{${n - k + 1}|}}\\,v`), misconception: "CONC_MOVED_WRONG_WAY", why: "Moving the balance forward a year accumulates it; this discounts it.", probe: `${lit(P)}*${aExpr(n - k + 1, i)}/${g}`, stage: 0, failure: "application" },
              { content: math(`${n - k + 1} \\times ${p}`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The remaining payments must be discounted.", probe: `${n - k + 1}*${lit(P)}`, stage: 0, failure: "application" },
            ],
          };
      return conceptQuestion({
        stem,
        ...options,
        reference: { values: [{ label: "B", expr: after ? retroE(ln, k) : `${retroE(ln, k - 1)}*${g}` }], description: "Retrospective balance (loan accumulated less payments accumulated), computed independently of the options." },
        steps: [
          { concept: "loan.balance-prospective-retrospective", reasoning: "Prospectively, the balance is the value of the remaining payments at the stated date." },
          { concept: "loan.balance-timing", reasoning: after ? `Just after payment ${k}, the next payment is a year away: an annuity-immediate.` : `Just before payment ${k}, that payment is still owed and due now: an annuity-due.` },
        ],
        conditions: LEVEL_CONDITIONS,
        relationship: "$B_k = Pa_{\\overline{n-k}|}, \\qquad B_{k-1}(1+i) = P\\ddot{a}_{\\overline{n-k+1}|}$",
        transfer,
        itemFormat: "expression-selection",
        params: { i, n, k, P, variant },
      });
    }
    if (level === 2) {
      const n = rng.int(14, 25);
      const mm = rng.int(5, n - 5);
      const k = rng.int(2, mm - 2);
      const P = gridAmount(rng, 800, 3000, 50);
      const Q = P + gridAmount(rng, 200, 1500, 100) * (rng.int(0, 1) ? 1 : -1);
      const L = P * an(mm, i) + Q * an(n - mm, i) * v(i, mm);
      const retroRef = `(${lit(L)}*${accPow(i, k)} - ${lit(P)}*${sExpr(k, i)})`;
      const pp = mamt(P);
      const qq = mamt(Q);
      if (variant === 0) {
        return conceptQuestion({
          stem: `A loan is repaid by annual payments at the end of each year at an annual effective interest rate of ${pc(i)}: ${amt(P)} for the first ${mm} years and ${amt(Q)} for the following ${n - mm} years. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following expressions gives the outstanding balance just after the ${ord(k)} payment.`,
          correct: { content: math(`${pp}\\,a_{\\overline{${mm - k}|}} + ${qq}\\,a_{\\overline{${n - mm}|}}\\,v^{${mm - k}}`), why: `At time ${k}, ${mm - k} payments of ${amt(P)} remain, then ${n - mm} payments of ${amt(Q)} whose annuity value sits at time ${mm}, ${mm - k} years later.`, probe: `${lit(P)}*${aExpr(mm - k, i)} + ${lit(Q)}*${aExpr(n - mm, i)}*${vPow(i, mm - k)}` },
          distractors: [
            { content: math(`${pp}\\,a_{\\overline{${n - k}|}}`), misconception: "MODEL_LEVEL_FOR_VARYING", why: `The payments change to ${amt(Q)} after year ${mm}.`, probe: `${lit(P)}*${aExpr(n - k, i)}`, stage: 2, failure: "selection", conditionTrue: "Correct if the payments stayed level." },
            { content: math(`${pp}\\,a_{\\overline{${mm - k}|}} + ${qq}\\,a_{\\overline{${n - mm}|}}\\,v^{${mm}}`), misconception: "TIMING_VALUATION_DATE", why: `The second block is discounted to time 0 while the first is valued at time ${k}.`, probe: `${lit(P)}*${aExpr(mm - k, i)} + ${lit(Q)}*${aExpr(n - mm, i)}*${vPow(i, mm)}`, stage: 1, failure: "application" },
            { content: math(`${pp}\\,a_{\\overline{${mm - k}|}} + ${qq}\\,a_{\\overline{${n - mm}|}}\\,v^{${mm - k + 1}}`), misconception: "TIMING_DEFERRAL_OFF_BY_ONE", why: `$a_{\\overline{${n - mm}|}}$ already values the block one year before its first payment, at time ${mm}.`, probe: `${lit(P)}*${aExpr(mm - k, i)} + ${lit(Q)}*${aExpr(n - mm, i)}*${vPow(i, mm - k + 1)}`, stage: 1, failure: "application" },
            { content: math(`${pp}\\,a_{\\overline{${mm - k}|}} + ${qq}\\,a_{\\overline{${n - mm}|}}`), misconception: "TIMING_IGNORED_DEFERRAL", why: `The second block starts ${mm - k} years after time ${k}; it must be discounted.`, probe: `${lit(P)}*${aExpr(mm - k, i)} + ${lit(Q)}*${aExpr(n - mm, i)}`, stage: 1, failure: "application" },
          ],
          reference: { values: [{ label: `B_{${k}}`, expr: retroRef }], description: "Retrospective balance from the loan amount implied by the payments, computed independently of the options." },
          steps: [
            { concept: "loan.balance-prospective-retrospective", reasoning: "The balance is the value at time $k$ of the remaining payments." },
            { concept: "loan.non-level-payments", reasoning: "The remaining payments are two level blocks, valued separately." },
            { concept: "loan.balance-timing", reasoning: `The second block's annuity value is at time ${mm}; discount it ${mm - k} years to time ${k}.` },
          ],
          conditions: ["Two blocks of level payments at the end of each year.", "A constant annual effective rate of interest."],
          relationship: "$B_k = Pa_{\\overline{m-k}|} + Qa_{\\overline{n-m}|}v^{m-k}$ for $k < m$.",
          transfer,
          itemFormat: "expression-selection",
          presentation: ["deferred", "valuation-date"],
          features: { multipleValuationDates: true },
          params: { i, n, m: mm, k, P, Q, variant },
        });
      }
      const LL = mamt(Number(L.toFixed(2)));
      const Lr = lit(Number(L.toFixed(2)));
      return conceptQuestion({
        stem: `A loan of ${amt(Number(L.toFixed(2)))} is repaid at an annual effective interest rate of ${pc(i)} by payments of ${amt(P)} at the end of each of the first ${mm} years, followed by level payments at the end of each of the next ${n - mm} years. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following expressions gives the outstanding balance just after the ${ord(k)} payment.`,
        correct: { content: math(`${LL}(${g})^{${k}} - ${pp}\\,s_{\\overline{${k}|}}`), why: "Only the payments already made are needed: the retrospective form avoids the unknown later payment.", probe: `${Lr}*${accPow(i, k)} - ${lit(P)}*${sExpr(k, i)}` },
        distractors: [
          { content: math(`${pp}\\,a_{\\overline{${n - k}|}}`), misconception: "MODEL_LEVEL_FOR_VARYING", why: `The payments after year ${mm} are not ${amt(P)}.`, probe: `${lit(P)}*${aExpr(n - k, i)}`, stage: 2, failure: "selection" },
          { content: math(`${LL}(${g})^{${k}} - ${k}(${pp})`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The payments made earn interest to time $k$ as well.", probe: `${Lr}*${accPow(i, k)} - ${k}*${lit(P)}`, stage: 0, failure: "application" },
          { content: math(`${LL}(${g})^{${k}} - ${pp}\\,a_{\\overline{${k}|}}`), misconception: "FORMULA_AV_FOR_PV", why: "The payments must be accumulated to time $k$, not discounted to time 0.", probe: `${Lr}*${accPow(i, k)} - ${lit(P)}*${aExpr(k, i)}`, stage: 1, failure: "selection" },
          { content: math(`${LL}(${g})^{${k}} - ${pp}\\,s_{\\overline{${k + 1}|}}`), misconception: "SEQ_TERM_COUNT", why: `Only ${k} payments have been made.`, probe: `${Lr}*${accPow(i, k)} - ${lit(P)}*${sExpr(k + 1, i)}`, stage: 1, failure: "application" },
          { content: math(`${LL} - ${pp}\\,a_{\\overline{${k}|}}`), misconception: "TIMING_VALUATION_DATE", why: `That is the balance valued at time 0, not at time ${k}.`, probe: `${Lr} - ${lit(P)}*${aExpr(k, i)}`, stage: 1, failure: "application" },
        ],
        reference: { values: [{ label: `B_{${k}}`, expr: `${Lr}*${accPow(i, k)} - ${lit(P)}*${sExpr(k, i)}` }], description: "Loan accumulated to time $k$ less the payments made, accumulated to time $k$." },
        steps: [
          { concept: "loan.balance-prospective-retrospective", reasoning: "Retrospectively, the balance is the loan accumulated less the payments made, accumulated." },
          { concept: "loan.non-level-payments", reasoning: "The later payment is not stated, so the prospective form is not directly available." },
          { concept: "loan.balance-timing", reasoning: `Value both the loan and the ${k} payments at time ${k}.` },
        ],
        conditions: ["Payments at the end of each year.", "A constant annual effective rate of interest."],
        relationship: "$B_k = L(1+i)^k - Ps_{\\overline{k}|}$ whatever the later payments are.",
        transfer,
        itemFormat: "expression-selection",
        presentation: ["hidden-structure"],
        features: { unfamiliar: true },
        params: { i, n, m: mm, k, P, variant },
      });
    }
    // Level 3: an extra payment just after payment k.
    const n = rng.int(15, 25);
    const k = rng.int(4, n - 8);
    const P = gridAmount(rng, 800, 3000, 50);
    const ln: Loan = { L: P * an(n, i), i, n, P };
    const B = balance(ln, k);
    const E = Math.round((B * (0.2 + 0.1 * rng.int(0, 3))) / 100) * 100;
    const pp = mamt(P);
    const ee = mamt(E);
    const steps = [
      { concept: "loan.balance-prospective-retrospective", reasoning: `Just after payment ${k} the balance is $${pp}\\,a_{\\overline{${n - k}|}}$.` },
      { concept: "loan.balance-timing", reasoning: `The extra ${amt(E)} paid at that moment reduces it immediately, with no discounting.` },
      { concept: "loan.refinancing", reasoning: variant === 0 ? `The reduced balance is re-amortized over the same ${n - k} remaining years.` : "The reduced balance is repaid by the same payment for as long as needed." },
      { concept: "loan.unknown-variable", reasoning: variant === 0 ? "Dividing by the annuity factor gives the new payment." : "The remaining term is the root of one equation of value." },
    ];
    const common = {
      steps,
      conditions: ["Level payments at the end of each year.", "A constant annual effective rate of interest.", "The extra payment is made just after a regular payment."],
      relationship: "$B_k - E = P'a_{\\overline{n-k}|}$ (same term) or $B_k - E = Pa_{\\overline{m}|}$ (same payment).",
      transfer,
      itemFormat: variant === 0 ? ("expression-selection" as const) : ("equation-selection" as const),
      presentation: (variant === 0 ? ["hidden-structure", "indirect-wording"] : ["hidden-structure", "unknown-time"]) as ("hidden-structure" | "indirect-wording" | "unknown-time")[],
      modelingDecisions: 1,
      features: { unfamiliar: true },
    };
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem: `A loan is repaid by ${n} annual payments of ${amt(P)} made at the end of each year at an annual effective interest rate of ${pc(i)}. Just after the ${ord(k)} payment, the borrower pays an additional ${amt(E)}, and the remaining ${n - k} payments are reduced to a new level amount. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following expressions gives the new payment.`,
        correct: { content: math(`${pp} - \\dfrac{${ee}}{a_{\\overline{${n - k}|}}}`), why: `The new payment is $(${pp}\\,a_{\\overline{${n - k}|}} - ${ee})/a_{\\overline{${n - k}|}}$, which simplifies to this.`, probe: `${lit(P)} - ${lit(E)}/${aExpr(n - k, i)}` },
        distractors: [
          { content: math(`\\dfrac{${pp}\\,a_{\\overline{${n}|}} - ${ee}}{a_{\\overline{${n}|}}}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "The extra payment reduces the balance at time $k$, not the original loan, and only the remaining years are left.", probe: `${lit(P)} - ${lit(E)}/${aExpr(n, i)}`, stage: 0, failure: "selection" },
          { content: math(`${pp} - \\dfrac{${ee}}{a_{\\overline{${n - k + 1}|}}}`), misconception: "TIMING_BALANCE_INDEX", why: `Only ${n - k} payments remain after payment ${k}.`, probe: `${lit(P)} - ${lit(E)}/${aExpr(n - k + 1, i)}`, stage: 2, failure: "application" },
          { content: math(`${pp} - \\dfrac{${ee}}{${n - k}}`), misconception: "ALLOC_EVEN_SPLIT", why: "Spreading the extra payment evenly ignores the interest it saves; it must be divided by an annuity factor.", probe: `${lit(P)} - ${lit(E)}/${n - k}`, stage: 3, failure: "application" },
          { content: math(`\\dfrac{${pp}\\,a_{\\overline{${n - k}|}} - ${ee}}{a_{\\overline{${n}|}}}`), misconception: "TIMING_REFINANCE_PERIODS", why: `The loan still ends at time ${n}, so ${n - k} payments remain, not ${n}.`, probe: `(${lit(P)}*${aExpr(n - k, i)} - ${lit(E)})/${aExpr(n, i)}`, stage: 2, failure: "application" },
          { content: math(`${pp} - \\dfrac{${ee}\\,v^{${k}}}{a_{\\overline{${n - k}|}}}`), misconception: "TIMING_VALUATION_DATE", why: `The extra payment is made at time ${k}, the same date as the balance; it is not discounted.`, probe: `${lit(P)} - ${lit(E)}*${vPow(i, k)}/${aExpr(n - k, i)}`, stage: 1, failure: "application" },
        ],
        reference: { values: [{ label: "P'", expr: `(${retroE(ln, k)} - ${lit(E)})/${aExpr(n - k, i)}` }], description: "Retrospective balance less the extra payment, re-amortized over the remaining years." },
        params: { i, n, k, P, E, variant },
      });
    }
    const target = -Math.log(1 - ((B - E) * i) / P) / Math.log(1 + i);
    const ax = (e: string) => `((1-(1+${lit(i)})**(-(${e})))/${lit(i)})`;
    return conceptQuestion({
      ...common,
      stem: `A loan is repaid by ${n} annual payments of ${amt(P)} made at the end of each year at an annual effective interest rate of ${pc(i)}. Just after the ${ord(k)} payment, the borrower pays an additional ${amt(E)}. Payments of ${amt(P)} then continue until the loan is repaid. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following equations is satisfied by the number of payments $m$ remaining after the additional payment.`,
      correct: { content: math(`${pp}\\,a_{\\overline{m}|} = ${pp}\\,a_{\\overline{${n - k}|}} - ${ee}`), why: `At time ${k} the balance $${pp}\\,a_{\\overline{${n - k}|}}$ falls by ${amt(E)}; the payments of ${amt(P)} must repay what is left.`, probe: `${lit(P)}*${ax("x")} - (${lit(P)}*${aExpr(n - k, i)} - ${lit(E)})` },
      distractors: [
        { content: math(`${pp}\\,a_{\\overline{m}|} = ${pp}\\,a_{\\overline{${n}|}} - ${ee}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: `The extra payment reduces the balance at time ${k}, not the original loan.`, probe: `${lit(P)}*${ax("x")} - (${lit(P)}*${aExpr(n, i)} - ${lit(E)})`, stage: 0, failure: "selection" },
        { content: math(`${pp}\\,a_{\\overline{${k}+m|}} = ${pp}\\,a_{\\overline{${n}|}} - ${ee}`), misconception: "TIMING_VALUATION_DATE", why: `Written at time 0, the extra payment must be discounted: ${amt(E)}$v^{${k}}$.`, probe: `${lit(P)}*${ax(`${k}+x`)} - (${lit(P)}*${aExpr(n, i)} - ${lit(E)})`, stage: 1, failure: "application" },
        { content: math(`${pp}\\,s_{\\overline{m}|} = ${pp}\\,a_{\\overline{${n - k}|}} - ${ee}`), misconception: "FORMULA_AV_FOR_PV", why: "The remaining payments are valued at time $k$, so their present value is needed.", probe: `${lit(P)}*((1+${lit(i)})**x-1)/${lit(i)} - (${lit(P)}*${aExpr(n - k, i)} - ${lit(E)})`, stage: 3, failure: "selection" },
        { content: math(`${pp}\\,a_{\\overline{m}|} = ${pp}\\,a_{\\overline{${n - k}|}} - ${ee}(${g})^{${n - k}}`), misconception: "CONC_MOVED_WRONG_WAY", why: `The extra payment is made at time ${k}, the same date as the balance; it needs no accumulation.`, probe: `${lit(P)}*${ax("x")} - (${lit(P)}*${aExpr(n - k, i)} - ${lit(E)}*${accPow(i, n - k)})`, stage: 1, failure: "application" },
      ],
      reference: { values: [{ label: "m", expr: `${lit(P)}*${ax("x")} - (${retroE(ln, k)} - ${lit(E)})`, bracket: [0.05, n] }], description: `Retrospective balance less the extra payment, set equal to the value of the continuing payments; root $m \\approx ${target.toFixed(3)}$.` },
      params: { i, n, k, P, E, variant },
    });
  },
});

const obStatements: ChoiceTemplate = conceptTemplate({
  id: "con-loan-ob-statements",
  family: "con-loan-ob",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.final_payments", "LOANS.payment_components"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "timing"],
  reasoning: ["validation", "valuation_dates", "concept_recognition"],
  soaConcept: "Judging statements about outstanding balances, including loans with an irregular final payment.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Test each balance claim by the date it refers to and by which payments are still owed then.",
      unusual: "Several balance claims at different dates are judged together.",
      misread: "A balance just before a payment is one year's interest larger than the balance just after the previous one.",
    };
    if (level === 2) {
      const ln = drawLoan(rng, 12, 24);
      const { L, i, n, P } = ln;
      const k = rng.int(3, n - 3);
      const Bk = balance(ln, k);
      const steps = [
        { concept: "loan.balance-prospective-retrospective", reasoning: "Prospective and retrospective balances agree at the loan rate." },
        { concept: "loan.amortization-schedule", reasoning: "Principal is repaid slowly at first, so the balance stays above a straight line from $L$ to 0." },
        { concept: "loan.balance-timing", reasoning: "Between payments the balance grows with interest; just before payment $k+1$ it is $B_k(1+i)$." },
      ];
      if (variant === 0) {
        const h = Math.round(n / 2);
        return statementQuestion({
          steps,
          conditions: LEVEL_CONDITIONS,
          relationship: "$B_k = Pa_{\\overline{n-k}|} = L(1+i)^k - Ps_{\\overline{k}|}$; just before payment $k+1$: $B_k(1+i)$.",
          transfer,
          stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nDetermine which of the following statements are true.`,
          statements: [
            statement("I", `The balance just after the ${ord(k)} payment equals the loan accumulated for ${k} years at ${pc(i)}, less the first ${k} payments accumulated to that date at ${pc(i)}.`, true, "This is the retrospective form, which always equals the prospective form at the loan rate.", "CONC_LOAN_RETRO_PROSP_DIFFER", { stage: 0, failure: "recognition", check: { expr: retroE(ln, k), op: "=", than: prospE(ln, k) } }),
            statement("II", `The balance just after the ${ord(h)} payment is more than ${amt(Number((L * (n - h) / n).toFixed(2)))}.`, true, `Early payments are mostly interest, so the balance stays above the straight line $L(1 - k/n)$.`, "CONC_LOAN_PRINCIPAL_LEVEL", { stage: 1, failure: "selection", check: { expr: prospE(ln, h), op: ">", than: lit((L * (n - h)) / n) }, conditionTrue: "With equal principal repayments the balance would equal that amount." }),
            statement("III", `The balance just before the ${ord(k + 1)} payment is ${amt(Number(Bk.toFixed(2)))}.`, false, `That is the balance just after payment ${k}; a year's interest later it is $${mamt(Number((Bk * (1 + i)).toFixed(2)))}$.`, "CONC_LOAN_BEFORE_AFTER_PAYMENT", { stage: 2, failure: "application", check: { expr: `${prospE(ln, k)}*${onePlusLit(i)}`, op: "=", than: Number(Bk.toFixed(2)), tol: 1e-4 } }),
          ],
          extra: [
            { keys: ["II"], misconception: "SEQ_UNDISCOUNTED_SUM", why: "Treating the retrospective form as needing undiscounted payments rejects I.", stage: 0, failure: "application" },
            { keys: ["I", "III"], misconception: "TIMING_BALANCE_INDEX", why: "Confusing which payment has been made rejects II and accepts III.", stage: 2, failure: "interpretation" },
          ],
          presentation: ["indirect-wording"],
          features: { unfamiliar: true },
          params: { L, i, n, k, variant },
        });
      }
      const j = i + gridRate(rng, 0.01, 0.03, 0.005);
      const interestPaid = k * P - (L - Bk);
      return statementQuestion({
        steps,
        conditions: LEVEL_CONDITIONS,
        relationship: "$B_k = Pa_{\\overline{n-k}|\\,i}$; interest paid so far $= kP - (L - B_k)$; a buyer at yield $j$ pays $Pa_{\\overline{n-k}|\\,j}$.",
        transfer,
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of ${amt(Number(P.toFixed(2)))} made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The balance just after the ${ord(k)} payment is ${amt(Number(Bk.toFixed(2)))}.`, true, `It is $Pa_{\\overline{${n - k}|}}$ at ${pc(i)}.`, "TIMING_BALANCE_INDEX", { stage: 0, failure: "application", check: { expr: retroE(ln, k), op: "=", than: Number(Bk.toFixed(2)), tol: 1e-4 } }),
          statement("II", `The interest portions of the first ${k} payments total ${amt(Number(interestPaid.toFixed(2)))}.`, true, `The ${k} payments total $${k}P$, of which $L - B_{${k}}$ is principal.`, "VAR_TOTAL_FOR_COMPONENT", { stage: 1, failure: "interpretation", check: { expr: lit(schedule(ln).slice(0, k).reduce((s, r) => s + r.interest, 0)), op: "=", than: Number(interestPaid.toFixed(2)), tol: 1e-4 } }),
          statement("III", `Just after the ${ord(k)} payment, an investor who buys the remaining payments to yield ${pc(j)} pays ${amt(Number(Bk.toFixed(2)))}.`, false, `The investor discounts at ${pc(j)}, above the loan rate, and so pays less than the balance.`, "CONC_LOAN_PRICE_IS_BALANCE", { stage: 0, failure: "selection", confusedWith: "loan.balance-sale", check: { expr: `${payE(ln)}*${annE(n - k, j)}`, op: "=", than: Number(Bk.toFixed(2)), tol: 1e-4 }, conditionTrue: `True only for an investor yield of ${pc(i)}.` }),
        ],
        extra: [
          { keys: ["II", "III"], misconception: "CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", why: "Reading the balance as principal repaid rejects I.", stage: 0, failure: "interpretation" },
          { keys: ["I"], misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `Taking ${k} years of interest on the whole loan rejects II.`, stage: 1, failure: "selection" },
        ],
        presentation: ["combined-topics"],
        features: { unfamiliar: true },
        params: { L, i, n, k, j, variant },
      });
    }
    // Level 3: an irregular final payment hidden in the description.
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const L = gridAmount(rng, 20000, 60000, 1000);
    const steps = [
      { concept: "loan.drop-balloon", reasoning: "First pin down the payment pattern: how many regular payments, and when and how large the final one is." },
      { concept: "loan.non-level-payments", reasoning: "The final payment differs from the others, so a level annuity factor does not give the balance." },
      { concept: "loan.balance-prospective-retrospective", reasoning: "The retrospective form needs only the payments made, so it is unaffected by the final payment." },
      { concept: "loan.balance-timing", reasoning: "The final payment equals the balance just before it is paid: the previous balance plus a year's interest." },
    ];
    const common = {
      steps,
      conditions: ["Payments at the end of each year.", "A constant annual effective rate of interest."],
      relationship: "Final payment $= B_{\\text{last regular}}\\,(1+i)$; $B_k = L(1+i)^k - Xs_{\\overline{k}|}$ for any $k$ before it.",
      transfer,
      presentation: ["hidden-structure"] as "hidden-structure"[],
      modelingDecisions: 1,
      features: { unfamiliar: true },
    };
    if (variant === 0) {
      // Drop payment: X per year as long as necessary, then a smaller payment one year later.
      const X = gridAmount(rng, Math.ceil((L * i * 1.6) / 50) * 50, Math.ceil((L * i * 3) / 50) * 50, 50);
      const nStar = -Math.log(1 - (L * i) / X) / Math.log(1 + i);
      const N = Math.floor(nStar);
      if (nStar - N < 0.05 || nStar - N > 0.95) throw new Error("fractional term too close to an integer");
      const F = (L - X * an(N, i)) * (1 + i) ** (N + 1);
      const k = rng.int(2, N - 2);
      const Bk = L * (1 + i) ** k - X * sn(k, i);
      const BkE = `(${lit(L)}*${accPow(i, k)} - ${lit(X)}*${sExpr(k, i)})`;
      const level = X * an(N + 1 - k, i);
      return statementQuestion({
        ...common,
        stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by payments of ${amt(X)} at the end of each year for as long as necessary, followed by a smaller final payment one year after the last payment of ${amt(X)}.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", `The balance just after the ${ord(k)} payment is ${amt(Number(level.toFixed(2)))}.`, false, `That values ${N + 1 - k} full payments of ${amt(X)}; the last remaining payment is smaller, so the balance is $${mamt(Number(Bk.toFixed(2)))}$.`, "CONC_LOAN_IRREGULAR_FINAL_IGNORED", { stage: 1, failure: "selection", check: { expr: BkE, op: "=", than: Number(level.toFixed(2)), tol: 1e-4 } }),
          statement("II", `The balance just after the ${ord(k)} payment is ${amt(Number(Bk.toFixed(2)))}.`, true, "Retrospectively: the loan accumulated less the payments made, accumulated.", "CONC_LOAN_RETRO_WITHOUT_INTEREST", { stage: 2, failure: "selection", check: { expr: `${lit(X)}*${aExpr(N - k, i)} + ${lit(F)}*${vPow(i, N + 1 - k)}`, op: "=", than: Number(Bk.toFixed(2)), tol: 1e-4 } }),
          statement("III", `The final payment is made at the end of year ${N + 1} and equals the balance just after the ${ord(N)} payment accumulated for one year.`, true, `${N} payments of ${amt(X)} fall short of the loan; the remaining balance plus a year's interest is paid at time ${N + 1}.`, "CONC_LOAN_BEFORE_AFTER_PAYMENT", { stage: 3, failure: "application", check: { expr: `(${lit(L)}*${accPow(i, N)} - ${lit(X)}*${sExpr(N, i)})*${onePlusLit(i)}`, op: "=", than: lit(F) } }),
        ],
        extra: [
          { keys: ["I", "III"], misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "Treating the final payment as a regular payment accepts I and rejects II.", stage: 0, failure: "recognition" },
          { keys: ["II"], misconception: "CONC_LOAN_PRORATED_FINAL", why: "Taking the final payment as a prorated share of a payment rejects III.", stage: 0, failure: "interpretation" },
        ],
        params: { L, i, X, N, k, variant },
      });
    }
    // Balloon payment: n payments, the first n - 1 of X (below the level payment), the last larger.
    const n = rng.int(10, 18);
    const Pexact = L / an(n, i);
    const X = Math.floor((Pexact - 11) / 50) * 50;
    const F = (L * (1 + i) ** (n - 1) - X * sn(n - 1, i)) * (1 + i);
    const k = rng.int(3, n - 3);
    const BkE = `(${lit(L)}*${accPow(i, k)} - ${lit(X)}*${sExpr(k, i)})`;
    const Bn1 = L * (1 + i) ** (n - 1) - X * sn(n - 1, i);
    const naive = X + n * (Pexact - X);
    return statementQuestion({
      ...common,
      stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} payments at the end of each year. Each of the first ${n - 1} payments is ${amt(X)}, and the final payment is larger, so that the loan is repaid exactly.\n\nDetermine which of the following statements are true.`,
      statements: [
        statement("I", `The balance just after the ${ord(k)} payment exceeds ${amt(X)}$\\,a_{\\overline{${n - k}|}}$ at ${pc(i)}.`, true, `The remaining payments are ${n - k - 1} of ${amt(X)} and one larger final payment, so they are worth more than ${n - k} payments of ${amt(X)}.`, "CONC_LOAN_IRREGULAR_FINAL_IGNORED", { stage: 1, failure: "selection", check: { expr: BkE, op: ">", than: `${lit(X)}*${aExpr(n - k, i)}` } }),
        statement("II", `The final payment is ${amt(Number(naive.toFixed(2)))}.`, false, `The shortfall of each payment below the level payment accumulates with interest: the final payment is $${mamt(Number(F.toFixed(2)))}$.`, "SEQ_UNDISCOUNTED_SUM", { stage: 0, failure: "application", check: { expr: lit(F), op: "=", than: Number(naive.toFixed(2)), tol: 1e-4 } }),
        statement("III", `The final payment equals the balance just after the ${ord(n - 1)} payment.`, false, "The final payment also pays a year's interest on that balance.", "CONC_LOAN_BEFORE_AFTER_PAYMENT", { stage: 3, failure: "application", check: { expr: lit(F), op: "=", than: lit(Bn1) }, conditionTrue: "True only at a zero interest rate." }),
      ],
      extra: [
        { keys: ["II", "III"], misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "Treating the larger final payment as a regular payment rejects I.", stage: 0, failure: "recognition" },
        { keys: ["I", "II", "III"], misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Ignoring interest on the shortfalls and on the last balance accepts II and III.", stage: 2, failure: "selection" },
      ],
      params: { L, i, n, X, k, variant },
    });
  },
});

const obSaleCross: ChoiceTemplate = conceptTemplate({
  id: "con-loan-ob-sale-cross",
  family: "con-loan-ob",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.outstanding_balance",
  secondary: ["ANNUITIES.level_payment", "ANNUITIES.immediate_due", "TVM.equation_of_value"],
  itemFormat: "comparative-statics",
  conceptFamily: "cross-topic",
  dimensions: ["transfer", "timing", "interpretation"],
  reasoning: ["concept_recognition", "valuation_dates", "transfer"],
  soaConcept: "A lender sells the remaining loan payments: the price is an annuity value at the buyer's yield, not the outstanding balance.",
  variants: 2,
  generate(rng, level, variant) {
    const ln = drawLoan(rng, 12, 25);
    const { L, i, n, P: _P } = ln;
    const k = rng.int(3, n - 4);
    const higher = level === 2 ? variant === 0 : rng.int(0, 1) === 1;
    const delta = gridRate(rng, 0.01, 0.025, 0.005);
    const j = higher ? i + delta : i - delta;
    const remaining = Array.from({ length: n - k }, (_, t) => t + 1);
    const explicitAt = (r: number, shift: number) => `(${remaining.map((t) => `${payE(ln)}*(1+${lit(r)})**(-(${t - shift}))`).join(" + ")})`;
    const steps = [
      { concept: "loan.balance-sale", reasoning: `The buyer receives the remaining payments and values them at the buyer's yield of ${pc(j)}.` },
      { concept: "loan.balance-prospective-retrospective", reasoning: `The balance values the same payments at the loan rate of ${pc(i)}.` },
      { concept: "ann.immediate-vs-due", reasoning: "Whether the next payment is due at once or a year away decides between $\\ddot{a}$ and $a$." },
    ];
    const transfer = {
      principle: "A price is a present value at the buyer's rate; a balance is a present value at the loan rate.",
      unusual: "The loan's payments are valued by someone other than the borrower.",
      misread: "The amount owed and the amount a buyer pays coincide only when the two rates agree.",
    };
    const conditions = ["Level payments at the end of each year.", "The buyer values the remaining payments at a constant annual effective yield."];
    const relationship = "Price $= Pa_{\\overline{n-k}|\\,j}$ just after payment $k$; balance $= Pa_{\\overline{n-k}|\\,i}$.";
    const pp = `P`;
    if (level === 2 && variant === 0) {
      const price = `(${payE(ln)}*${annE(n - k, j)})`;
      const B = prospE(ln, k);
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}. Just after the ${ord(k)} payment, the lender sells the remaining payments to an investor at a price that gives the investor an annual effective yield of ${pc(j)}.\n\nWhich of the following describes the price?`,
        correct: { content: "Less than the outstanding balance, because the payments are discounted at the higher yield", why: `The same payments discounted at ${pc(j)} instead of ${pc(i)} are worth less.`, check: { expr: price, op: "<", than: B } },
        distractors: [
          { content: "Exactly the outstanding balance, because that is what the borrower owes", misconception: "CONC_LOAN_PRICE_IS_BALANCE", why: "The borrower's debt is valued at the loan rate; the investor discounts at a different yield.", check: { expr: price, op: "=", than: B }, stage: 0, failure: "selection", conditionTrue: `True only for an investor yield of ${pc(i)}.`, confusedWith: "loan.balance-prospective-retrospective" },
          { content: "More than the outstanding balance, because the investor earns the higher yield", misconception: "CONC_DIRECTION_REVERSED", why: "A higher discount rate lowers present value, so the investor pays less.", check: { expr: price, op: ">", than: B }, stage: 1, failure: "application", conditionTrue: "True if the investor's yield were below the loan rate." },
          { content: "The balance recomputed retrospectively at the investor's yield", misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The investor buys only the future payments; the loan's past at a hypothetical rate is irrelevant.", check: { expr: price, op: "=", than: `${lit(L)}*(1+${lit(j)})**${k} - ${payE(ln)}*${sExpr(k, j)}` }, stage: 1, failure: "selection" },
          { content: "The remaining payments discounted at the investor's yield to the loan's start", misconception: "TIMING_VALUATION_DATE", why: `The sale takes place at time ${k}, so the payments are valued at time ${k}.`, check: { expr: price, op: "=", than: `${price}*(1+${lit(j)})**(-${k})` }, stage: 2, failure: "application" },
        ],
        reference: { values: [], description: `Price $Pa_{\\overline{${n - k}|}}$ at ${pc(j)} compared with the balance $Pa_{\\overline{${n - k}|}}$ at ${pc(i)}.` },
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "comparative-statics",
        presentation: ["combined-topics", "compare-streams"],
        features: { multiConcept: true },
        params: { L, i, n, k, j, variant },
      });
    }
    const due = level === 3 && variant === 0;
    const half = level === 3 && variant === 1;
    const shift = due ? 1 : half ? 0.5 : 0;
    const timing = due ? `just before the ${ord(k + 1)} payment is made, so that the investor also receives that payment` : half ? `six months after the ${ord(k)} payment` : `just after the ${ord(k)} payment`;
    const r = lit(1 + j);
    const aj = (m: number) => `${pp}\\,${aAt(m, j)}`;
    const ajE = (m: number) => `${payE(ln)}*${annE(m, j)}`;
    const correct: ConceptOption = due
      ? { content: math(`${pp}\\,\\ddot{a}_{\\overline{${n - k}|}\\,${j}}`), why: `${n - k} payments remain and the first is due at the sale: an annuity-due at ${pc(j)}.`, probe: `${ajE(n - k)}*${r}` }
      : half
        ? { content: math(`${aj(n - k)}\\,(${r})^{0.5}`), why: `Valued at the last payment date, the remaining payments are worth $${aj(n - k)}$; half a year later that value has grown by $(${r})^{0.5}$.`, probe: `${ajE(n - k)}*${r}**0.5` }
        : { content: math(aj(n - k)), why: `${n - k} payments remain, the first a year away, discounted at ${pc(j)}.`, probe: ajE(n - k) };
    const distractors: ConceptOption[] = [
      { content: math(due ? `${pp}\\,\\ddot{a}_{\\overline{${n - k}|}\\,${i}}` : half ? `${pp}\\,${aAt(n - k, i)}\\,(${lit(1 + i)})^{0.5}` : `${pp}\\,${aAt(n - k, i)}`), misconception: "CONC_LOAN_PRICE_IS_BALANCE", why: "This values the payments at the loan rate: it is the borrower's balance, not the investor's price.", probe: `${payE(ln)}*${annE(n - k, i)}*(1+${lit(i)})**${shift}`, stage: 0, failure: "selection", confusedWith: "loan.balance-prospective-retrospective", conditionTrue: `Correct only if the investor's yield were ${pc(i)}.` },
      { content: math(due ? aj(n - k) : half ? aj(n - k) : `${aj(n - k)}\\,(${r})`), misconception: due ? "TIMING_DUE_AS_IMMEDIATE" : half ? "TIMING_VALUATION_DATE" : "TIMING_IMMEDIATE_AS_DUE", why: due ? "The next payment is received at once, so it is not discounted." : half ? "That is the value six months earlier, just after the last payment." : "The next payment is a year away, so the annuity is immediate.", probe: due || half ? ajE(n - k) : `${ajE(n - k)}*${r}`, stage: 2, failure: "application" },
      { content: math(due ? `${aj(n - k - 1)}` : half ? `${aj(n - k)}\\,(1 + 0.5 \\times ${j})` : `${aj(n - k + 1)}`), misconception: due ? "TIMING_BALANCE_INDEX" : half ? "MODEL_COMPOUND_AS_SIMPLE" : "TIMING_BALANCE_INDEX", why: due ? "The payment due at the sale goes to the investor and must be included." : half ? "Value at an effective annual yield grows by $(1+j)^{0.5}$ over half a year, not by simple interest." : `Payment ${k} has been made; ${n - k} remain.`, probe: due ? ajE(n - k - 1) : half ? `${ajE(n - k)}*(1+0.5*${lit(j)})` : ajE(n - k + 1), stage: due ? 2 : 1, failure: "application" },
      { content: math(due ? `\\bigl(${mamt(L)}(${r})^{${k}} - ${pp}\\,${sAt(k, j)}\\bigr)(${r})` : half ? `${aj(n - k)}\\,(${r})^{-0.5}` : `${mamt(L)}(${r})^{${k}} - ${pp}\\,${sAt(k, j)}`), misconception: half ? "CONC_MOVED_WRONG_WAY" : "MODEL_BALANCE_AT_NEW_RATE", why: half ? "Moving a value later accumulates it." : "The investor buys only the future payments; replaying the loan's past at the investor's yield is irrelevant.", probe: half ? `${ajE(n - k)}*${r}**(-0.5)` : `(${lit(L)}*${r}**${k} - ${payE(ln)}*${sExpr(k, j)})*${r}**${due ? 1 : 0}`, stage: 1, failure: half ? "application" : "selection" },
      { content: math(`${aj(n - k)}\\,(${r})^{-${k}}`), misconception: half ? "TIMING_IMMEDIATE_AS_DUE" : "TIMING_VALUATION_DATE", why: `The sale is at time ${k}${due || half ? " or later" : ""}; discounting to time 0 values the payments at the wrong date.`, probe: `${ajE(n - k)}*${r}**(-${k})`, stage: 2, failure: "application" },
    ];
    return conceptQuestion({
      stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$ made at the end of each year at an annual effective interest rate of ${pc(i)}. The lender sells the remaining payments ${timing}, at a price that gives the investor an annual effective yield of ${pc(j)}.\n\nDetermine which of the following expressions gives the price.`,
      correct,
      distractors,
      reference: { values: [{ label: "price", expr: explicitAt(j, shift) }], description: `Each remaining payment discounted at ${pc(j)} from its own date to the sale date.` },
      steps: level === 3 ? [...steps, { concept: "loan.balance-timing", reasoning: due ? `At the sale, payment ${k + 1} is due immediately.` : "The sale falls between payment dates, so the value at the last payment date is accumulated for half a year." }] : steps,
      conditions,
      relationship,
      transfer,
      itemFormat: "expression-selection",
      presentation: level === 3 ? ["combined-topics", "valuation-date"] : ["combined-topics"],
      ...(level === 3 ? { modelingDecisions: 1 } : {}),
      features: { multiConcept: true, multipleValuationDates: level === 3 },
      params: { L, i, n, k, j, variant },
    });
  },
});

// ================================================================ LOANS.payment_components

const pcInterpret: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pc-interpret",
  family: "con-loan-pc",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.amortization", "LOANS.outstanding_balance"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  reasoning: ["concept_recognition", "translation"],
  soaConcept: "Interpreting a loan quantity written as an expression: interest, principal, balance or principal repaid.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Translate the expression back into the schedule: which balance, which payment, and which date.",
      unusual: "You name the quantity instead of computing it.",
      misread: "Interest in a payment and the balance it is charged on differ by a factor of $i$.",
    };
    if (level === 1) {
      const ln = drawLoan(rng, 12, 25);
      const { L, i, n, P } = ln;
      const rows = schedule(ln);
      const t = drawUntil(() => rng.int(3, n - 3), (x) => n - x + 1 !== x && n - x + 1 !== x + 1);
      const e = n - t + 1;
      const steps = [
        { concept: "loan.principal-structure", reasoning: `Just after payment ${t - 1} the balance is $Pa_{\\overline{${e}|}}$, so payment ${t} pays interest $P(1 - v^{${e}})$ and principal $Pv^{${e}}$.` },
        { concept: "loan.interest-principal-split", reasoning: "Interest is $i$ times the opening balance; principal is the rest of the payment." },
        { concept: "loan.amortization-schedule", reasoning: "The principal portions add up to the fall in the balance: $L - B_t$ after $t$ payments." },
      ];
      const sum = (key: "interest" | "principal", from: number, to: number) => lit(rows.slice(from - 1, to).reduce((s, r) => s + r[key], 0));
      if (variant === 0) {
        const q = `${payE(ln)}*(1-${vPow(i, e)})`;
        return conceptQuestion({
          stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$ made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nWhich of the following does the quantity $P\\bigl(1 - v^{${e}}\\bigr)$ represent?`,
          correct: { content: `The interest portion of the ${ord(t)} payment`, why: `$P(1 - v^{${e}}) = i\\,Pa_{\\overline{${e}|}} = iB_{${t - 1}}$, the interest in payment ${t}.`, check: { expr: q, op: "=", than: lit(rows[t - 1].interest) } },
          distractors: [
            { content: `The principal portion of the ${ord(t)} payment`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: `The principal portion is $Pv^{${e}}$, the rest of the payment.`, check: { expr: q, op: "=", than: lit(rows[t - 1].principal) }, stage: 1, failure: "interpretation" },
            { content: `The interest portion of the ${ord(t + 1)} payment`, misconception: "TIMING_BALANCE_INDEX", why: `Payment ${t + 1} pays interest $P(1 - v^{${e - 1}})$.`, check: { expr: q, op: "=", than: lit(rows[t].interest) }, stage: 0, failure: "application" },
            { content: `The total interest in payments ${t} through ${n}`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: "The expression is one payment's interest, not a sum over payments.", check: { expr: q, op: "=", than: sum("interest", t, n) }, stage: 2, failure: "interpretation" },
            { content: `The balance just after the ${ord(t - 1)} payment`, misconception: "CONC_RELATED_TERM", why: `That balance is $Pa_{\\overline{${e}|}}$; the expression is $i$ times it.`, check: { expr: q, op: "=", than: retroE(ln, t - 1) }, stage: 1, failure: "interpretation" },
            { content: `The interest portion of the ${ord(e)} payment`, misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: `The exponent counts the payments from ${t} to ${n}, not from the start.`, check: { expr: q, op: "=", than: lit(rows[e - 1].interest) }, stage: 0, failure: "interpretation" },
          ],
          steps,
          conditions: LEVEL_CONDITIONS,
          relationship: "$I_t = P(1 - v^{n-t+1}), \\qquad R_t = Pv^{n-t+1}$",
          transfer,
          itemFormat: "interpretation",
          params: { L, i, n, t, variant },
        });
      }
      const q = `${lit(L)} - ${prospE(ln, t)}`;
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$ made at the end of each year at an annual effective interest rate of ${pc(i)}.\n\nWhich of the following does the quantity $${mamt(L)} - P\\,a_{\\overline{${n - t}|}}$ represent?`,
        correct: { content: `The principal repaid in the first ${t} payments`, why: `$Pa_{\\overline{${n - t}|}}$ is the balance just after payment ${t}; the loan less that balance is the principal already repaid.`, check: { expr: q, op: "=", than: sum("principal", 1, t) } },
        distractors: [
          { content: `The interest paid in the first ${t} payments`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: `Interest paid is $${t}P$ less the principal repaid.`, check: { expr: q, op: "=", than: sum("interest", 1, t) }, stage: 1, failure: "interpretation" },
          { content: `The balance just after the ${ord(t)} payment`, misconception: "CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", why: "The balance is the subtracted term itself; the difference is what has been repaid.", check: { expr: q, op: "=", than: retroE(ln, t) }, stage: 2, failure: "interpretation" },
          { content: `The principal portion of the ${ord(t)} payment`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: `The expression covers all of the first ${t} payments, not just the last of them.`, check: { expr: q, op: "=", than: lit(rows[t - 1].principal) }, stage: 2, failure: "interpretation" },
          { content: `The present value at time 0 of the first ${t} payments`, misconception: "TIMING_VALUATION_DATE", why: `That equals $L - B_{${t}}v^{${t}}$: the balance discounted to time 0.`, check: { expr: q, op: "=", than: `${payE(ln)}*${aExpr(t, i)}` }, stage: 0, failure: "application" },
          { content: `The principal repaid in the first ${t + 1} payments`, misconception: "TIMING_BALANCE_INDEX", why: `$a_{\\overline{${n - t}|}}$ covers payments ${t + 1} through ${n}, so payment ${t + 1} is still owed.`, check: { expr: q, op: "=", than: sum("principal", 1, t + 1) }, stage: 0, failure: "application" },
        ],
        steps,
        conditions: LEVEL_CONDITIONS,
        relationship: "$\\sum_{s \\le t} R_s = L - B_t = L - Pa_{\\overline{n-t}|}$",
        transfer,
        itemFormat: "interpretation",
        params: { L, i, n, t, P, variant },
      });
    }
    // Level 2: a loan repaid by equal principal amounts.
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.choice([10, 12, 15, 16, 20, 24, 25]);
    const L = n * gridAmount(rng, 500, 3000, 100);
    const c = L / n;
    const t = drawUntil(() => rng.int(3, n - 3), (x) => n - x + 1 !== x && n - x + 1 !== x + 1 && n - x !== x);
    const e = n - t + 1;
    const bal = (k: number) => lit(L - k * c);
    const intr = (k: number) => `${lit(i)}*${bal(k - 1)}`;
    const steps = [
      { concept: "loan.equal-principal", reasoning: `Each payment repays ${amt(c)} of principal, so the balance just after payment $k$ is ${amt(c)}$\\,(${n} - k)$.` },
      { concept: "loan.interest-principal-split", reasoning: "Interest in a payment is $i$ times the balance just after the previous payment." },
      { concept: "loan.amortization-schedule", reasoning: "The payment is the fixed principal plus that interest, so the payments fall each year." },
    ];
    const scene = `A loan of ${amt(L)} is repaid over ${n} years by annual payments at the end of each year. Each payment consists of ${amt(c)} of principal plus interest at an annual effective rate of ${pc(i)} on the balance outstanding.`;
    if (variant === 0) {
      const q = `${lit(c)}*${e}*${lit(i)}`;
      return conceptQuestion({
        stem: `${scene}\n\nWhich of the following does the quantity $${mamt(c)} \\times ${e} \\times ${mpc(i)}$ represent?`,
        correct: { content: `The interest portion of the ${ord(t)} payment`, why: `Just after payment ${t - 1}, ${e} principal instalments of ${amt(c)} remain; interest on that balance is paid in payment ${t}.`, check: { expr: q, op: "=", than: intr(t) } },
        distractors: [
          { content: `The interest portion of the ${ord(t + 1)} payment`, misconception: "TIMING_BALANCE_INDEX", why: `Before payment ${t + 1}, only ${e - 1} instalments remain.`, check: { expr: q, op: "=", than: intr(t + 1) }, stage: 0, failure: "application" },
          { content: `The ${ord(t)} payment`, misconception: "VAR_TOTAL_FOR_COMPONENT", why: `The payment also includes the principal of ${amt(c)}.`, check: { expr: q, op: "=", than: `${lit(c)} + ${intr(t)}` }, stage: 2, failure: "interpretation" },
          { content: `The balance just after the ${ord(t - 1)} payment`, misconception: "CONC_RELATED_TERM", why: `That balance is ${amt(c)} $\\times ${e}$; the quantity is interest on it.`, check: { expr: q, op: "=", than: bal(t - 1) }, stage: 1, failure: "interpretation" },
          { content: `The interest portion of the ${ord(e)} payment`, misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: `The factor ${e} counts the instalments still owed before payment ${t}, not payments from the start.`, check: { expr: q, op: "=", than: intr(e) }, stage: 0, failure: "interpretation" },
          { content: `The interest portion of the ${ord(t)} payment on a level-payment loan`, misconception: "MODEL_LEVEL_FOR_VARYING", why: "A level-payment loan of the same amount has a different balance at that date.", check: { expr: q, op: "=", than: `(${lit(L)}/${aExpr(n, i)})*(1-${vPow(i, e)})` }, stage: 0, failure: "selection" },
        ],
        steps,
        conditions: ["Equal principal repayments at the end of each year.", "A constant annual effective rate of interest."],
        relationship: "$B_k = \\tfrac{L}{n}(n-k), \\qquad I_t = i\\,\\tfrac{L}{n}(n-t+1), \\qquad K_t = \\tfrac{L}{n} + I_t$",
        transfer,
        itemFormat: "interpretation",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true },
        params: { L, i, n, t, variant },
      });
    }
    const q = `${lit(c)}*${n - t}`;
    const payments = (from: number) => Array.from({ length: n - from + 1 }, (_, s) => `${lit(c)} + ${intr(from + s)}`).join(" + ");
    return conceptQuestion({
      stem: `${scene}\n\nWhich of the following does the quantity $${mamt(c)} \\times ${n - t}$ represent?`,
      correct: { content: `The balance just after the ${ord(t)} payment`, why: `After ${t} payments, ${n - t} principal instalments of ${amt(c)} remain unpaid.`, check: { expr: q, op: "=", than: bal(t) } },
      distractors: [
        { content: `The principal repaid in the first ${t} payments`, misconception: "CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID", why: `Principal repaid so far is ${amt(c)} $\\times ${t}$; the quantity is what remains.`, check: { expr: q, op: "=", than: `${lit(c)}*${t}` }, stage: 0, failure: "interpretation" },
        { content: `The balance just after the ${ord(t - 1)} payment`, misconception: "TIMING_BALANCE_INDEX", why: `Just after payment ${t - 1}, ${n - t + 1} instalments remain.`, check: { expr: q, op: "=", than: bal(t - 1) }, stage: 0, failure: "application" },
        { content: `The interest portion of the ${ord(t + 1)} payment`, misconception: "CONC_RELATED_TERM", why: "Interest is $i$ times this balance, not the balance itself.", check: { expr: q, op: "=", than: intr(t + 1) }, stage: 1, failure: "interpretation" },
        { content: `The sum of payments ${t + 1} through ${n}`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "The remaining payments include interest as well as the principal still owed.", check: { expr: q, op: "=", than: `(${payments(t + 1)})` }, stage: 2, failure: "interpretation" },
      ],
      steps,
      conditions: ["Equal principal repayments at the end of each year.", "A constant annual effective rate of interest."],
      relationship: "$B_k = \\tfrac{L}{n}(n-k), \\qquad I_t = i\\,B_{t-1}$",
      transfer,
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { L, i, n, t, variant },
    });
  },
});

const pcTotals: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pc-totals",
  family: "con-loan-pc",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.principal_interest", "LOANS.amortization"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "relationships"],
  reasoning: ["formula_selection", "translation"],
  soaConcept: "Expressions for the total interest paid over all or part of a loan's term.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Interest paid = payments made − principal repaid; principal repaid over any stretch is the fall in the balance.",
      unusual: "The answer is an expression, not a number.",
      misread: "Total interest is not $n$ years of interest on the original loan.",
    };
    if (level === 1) {
      const ln = drawLoan(rng, 10, 25);
      const { L, i, n } = ln;
      const rows = schedule(ln);
      const ll = mamt(L);
      const steps = [
        { concept: "loan.interest-principal-split", reasoning: "In every payment, interest = payment − principal." },
        { concept: "loan.amortization-schedule", reasoning: "Over a stretch of payments, the principal repaid is the fall in the balance." },
        { concept: "loan.balance-prospective-retrospective", reasoning: "The balance at any date is the value of the payments still due." },
      ];
      if (variant === 0) {
        const pay = `\\dfrac{${ll}}{a_{\\overline{${n}|}}}`;
        return conceptQuestion({
          stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments made at the end of each year at an annual effective interest rate $i$. Annuity symbols are at rate $i$.\n\nDetermine which of the following expressions gives the total interest paid over the term of the loan.`,
          correct: { content: math(`${n}\\,${pay} - ${ll}`), why: `The ${n} payments total $${n}P$ and repay principal of exactly ${amt(L)}; the rest is interest.`, probe: `${n}*${payE(ln)} - ${lit(L)}` },
          distractors: [
            { content: math(`${n}\\,i\\,(${ll})`), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The balance falls each year, so the interest charged falls too.", probe: `${n}*${lit(i)}*${lit(L)}`, stage: 0, failure: "selection", conditionTrue: "Correct for an interest-only loan repaid in one sum at the end." },
            { content: math(`${n}\\,${pay}`), misconception: "VAR_TOTAL_FOR_COMPONENT", why: "That is the total of the payments, principal included.", probe: `${n}*${payE(ln)}`, stage: 1, failure: "interpretation" },
            { content: math(`${ll}\\,(1+i)^{${n}} - ${ll}`), misconception: "CONC_RELATED_TERM", why: "That is the interest a single deposit would earn if nothing were repaid.", probe: `${lit(L)}*${accPow(i, n)} - ${lit(L)}`, stage: 2, failure: "selection" },
            { content: math(`${n}\\,\\dfrac{${ll}}{\\ddot{a}_{\\overline{${n}|}}} - ${ll}`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The payments are at the end of each year, so the level payment is $L/a_{\\overline{n}|}$, not $L/\\ddot{a}_{\\overline{n}|}$.", probe: `${n}*${lit(L)}/(${aExpr(n, i)}*${onePlusLit(i)}) - ${lit(L)}`, stage: 1, failure: "application" },
          ],
          reference: { values: [{ label: "total interest", expr: lit(rows.reduce((s, r) => s + r.interest, 0)) }], description: `Sum of the interest column of the amortization schedule (checked at $i = ${mpc(i)}$).` },
          steps,
          conditions: LEVEL_CONDITIONS,
          relationship: "Total interest $= nP - L$",
          transfer,
          itemFormat: "expression-selection",
          params: { L, i, n, variant },
        });
      }
      const k = rng.int(3, n - 3);
      const r = n - k;
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$ made at the end of each year at an annual effective interest rate $i$. Annuity symbols are at rate $i$.\n\nDetermine which of the following expressions gives the total interest paid in payments ${k + 1} through ${n}.`,
        correct: { content: math(`${r}P - P\\,a_{\\overline{${r}|}}`), why: `Payments ${k + 1} to ${n} total $${r}P$ and repay the balance just after payment ${k}, $Pa_{\\overline{${r}|}}$.`, probe: `${r}*${payE(ln)} - ${prospE(ln, k)}` },
        distractors: [
          { content: math(`${r}P - ${ll}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: `These payments repay only the balance outstanding at time ${k}, not the whole loan.`, probe: `${r}*${payE(ln)} - ${lit(L)}`, stage: 1, failure: "selection" },
          { content: math(`${r}\\,i\\,P\\,a_{\\overline{${r}|}}`), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The balance keeps falling after payment $k$, so interest on it is not the same each year.", probe: `${r}*${lit(i)}*${prospE(ln, k)}`, stage: 0, failure: "selection" },
          { content: math(`${r}P - P\\,a_{\\overline{${r + 1}|}}`), misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has been made; the balance repaid by the later payments is $Pa_{\\overline{${r}|}}$.`, probe: `${r}*${payE(ln)} - ${payE(ln)}*${aExpr(r + 1, i)}`, stage: 2, failure: "application" },
          { content: math(`${r}P`), misconception: "VAR_TOTAL_FOR_COMPONENT", why: "That is the total of the payments, principal included.", probe: `${r}*${payE(ln)}`, stage: 1, failure: "interpretation" },
          { content: math(`${r}P - P\\,a_{\\overline{${r}|}}\\,v^{${k}}`), misconception: "TIMING_VALUATION_DATE", why: `The principal repaid is the balance at time ${k}, not its value at time 0.`, probe: `${r}*${payE(ln)} - ${prospE(ln, k)}*${vPow(i, k)}`, stage: 2, failure: "application" },
        ],
        reference: { values: [{ label: "interest", expr: lit(rows.slice(k).reduce((s, x) => s + x.interest, 0)) }], description: `Sum of the interest column for payments ${k + 1} to ${n} (checked at $i = ${mpc(i)}$).` },
        steps,
        conditions: LEVEL_CONDITIONS,
        relationship: "Interest in payments $k+1$ to $n$ $= (n-k)P - B_k$",
        transfer,
        itemFormat: "expression-selection",
        params: { L, i, n, k, variant },
      });
    }
    // Level 2: equal principal repayments.
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(10, 25);
    const L = n * gridAmount(rng, 500, 3000, 100);
    const c = L / n;
    const ll = mamt(L);
    const interestRows = Array.from({ length: n }, (_, s) => i * (L - s * c));
    const steps = [
      { concept: "loan.equal-principal", reasoning: `The balance just before payment $t$ is $\\tfrac{L}{n}(n - t + 1)$.` },
      { concept: "loan.interest-principal-split", reasoning: "So the interest portions are $i\\tfrac{L}{n}$ times $n, n-1, \\ldots, 1$: an arithmetic sequence." },
      { concept: "loan.amortization-schedule", reasoning: "Add the arithmetic sequence: $1 + 2 + \\cdots + m = m(m+1)/2$." },
    ];
    const common = {
      steps,
      conditions: ["Equal principal repayments at the end of each year.", "A constant annual effective rate of interest."],
      relationship: "$I_t = i\\tfrac{L}{n}(n-t+1)$, so $\\sum_{t=1}^{n} I_t = \\dfrac{iL(n+1)}{2}$.",
      transfer,
      itemFormat: "expression-selection" as const,
      presentation: ["indirect-wording"] as "indirect-wording"[],
      features: { unfamiliar: true },
    };
    const scene = `A loan of ${amt(L)} is repaid over ${n} years by annual payments at the end of each year. Each payment repays ${amt(c)} of principal plus interest at an annual effective rate $i$ on the balance outstanding.`;
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem: `${scene}\n\nDetermine which of the following expressions gives the total interest paid over the term of the loan.`,
        correct: { content: math(`\\dfrac{${n + 1}\\,i\\,(${ll})}{2}`), why: `Interest is $i\\tfrac{L}{n}(${n} + ${n - 1} + \\cdots + 1) = i\\tfrac{L}{n}\\cdot\\tfrac{${n}(${n + 1})}{2}$.`, probe: `${n + 1}*${lit(i)}*${lit(L)}/2` },
        distractors: [
          { content: math(`\\dfrac{${n}\\,i\\,(${ll})}{2}`), misconception: "SEQ_TERM_COUNT", why: "The balances on which interest is charged run from $L$ down to $L/n$: their average is $L(n+1)/(2n)$, not $L/2$.", probe: `${n}*${lit(i)}*${lit(L)}/2`, stage: 2, failure: "application" },
          { content: math(`${n}\\,i\\,(${ll})`), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "The balance falls each year, so the interest does too.", probe: `${n}*${lit(i)}*${lit(L)}`, stage: 1, failure: "selection" },
          { content: math(`${n}\\,\\dfrac{${ll}}{a_{\\overline{${n}|}}} - ${ll}`), misconception: "MODEL_LEVEL_FOR_VARYING", why: "That is the total interest of a level-payment loan; these payments are not level.", probe: `${n}*${lit(L)}/${aExpr(n, i)} - ${lit(L)}`, stage: 0, failure: "selection" },
          { content: math(`\\dfrac{${n - 1}\\,i\\,(${ll})}{2}`), misconception: "TIMING_BALANCE_INDEX", why: "That charges interest on the balance after each payment instead of before it.", probe: `${n - 1}*${lit(i)}*${lit(L)}/2`, stage: 1, failure: "application" },
          { content: math(`${ll} + \\dfrac{${n + 1}\\,i\\,(${ll})}{2}`), misconception: "VAR_TOTAL_FOR_COMPONENT", why: "That is the total of all payments, principal included.", probe: `${lit(L)} + ${n + 1}*${lit(i)}*${lit(L)}/2`, stage: 2, failure: "interpretation" },
        ],
        reference: { values: [{ label: "total interest", expr: lit(interestRows.reduce((a, b) => a + b, 0)) }], description: `Sum of the interest portions $iB_{t-1}$ (checked at $i = ${mpc(i)}$).` },
        params: { L, i, n, variant },
      });
    }
    const k = drawUntil(() => rng.int(3, n - 3), (x) => x !== n - x && x !== n - x - 1);
    const r = n - k;
    return conceptQuestion({
      ...common,
      stem: `${scene}\n\nDetermine which of the following expressions gives the total interest paid in payments ${k + 1} through ${n}.`,
      correct: { content: math(`i\\,\\dfrac{${ll}}{${n}}\\cdot\\dfrac{${r}(${r + 1})}{2}`), why: `Before payment ${k + 1}, ${r} instalments remain; interest falls from $${r}\\,i\\tfrac{L}{n}$ to $i\\tfrac{L}{n}$.`, probe: `${lit(i)}*${lit(L)}/${n}*${r}*${r + 1}/2` },
      distractors: [
        { content: math(`i\\,\\dfrac{${ll}}{${n}}\\cdot\\dfrac{${r}(${r - 1})}{2}`), misconception: "TIMING_BALANCE_INDEX", why: "That charges interest on the balance after each payment instead of before it.", probe: `${lit(i)}*${lit(L)}/${n}*${r}*${r - 1}/2`, stage: 1, failure: "application" },
        { content: math(`${r}\\,i\\,\\dfrac{${ll}}{${n}}\\cdot ${r}`), misconception: "MODEL_INTEREST_ON_ORIGINAL", why: `The balance at time ${k} keeps falling; interest is not charged on it for all ${r} years.`, probe: `${r}*${lit(i)}*${lit(L)}/${n}*${r}`, stage: 1, failure: "selection" },
        { content: math(`i\\,\\dfrac{${ll}}{${n}}\\cdot\\dfrac{${n}(${n + 1})}{2}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "That is the interest over the whole term, starting from the original loan.", probe: `${lit(i)}*${lit(L)}/${n}*${n}*${n + 1}/2`, stage: 0, failure: "selection" },
        { content: math(`i\\,\\dfrac{${ll}}{${n}}\\cdot\\dfrac{${k}(${k + 1})}{2}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The later payments carry the least interest; this counts instalments from the start.", probe: `${lit(i)}*${lit(L)}/${n}*${k}*${k + 1}/2`, stage: 2, failure: "application" },
      ],
      reference: { values: [{ label: "interest", expr: lit(interestRows.slice(k).reduce((a, b) => a + b, 0)) }], description: `Sum of the interest portions of payments ${k + 1} to ${n} (checked at $i = ${mpc(i)}$).` },
      params: { L, i, n, k, variant },
    });
  },
});

const pcDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-loan-pc-diagnosis",
  family: "con-loan-pc",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.principal_interest"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "rate_conversion"],
  reasoning: ["validation", "formula_selection"],
  soaConcept: "Diagnosing the error in a proposed interest or principal component.",
  variants: 2,
  generate(rng, level, variant) {
    const monthly = level === 2;
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const L = gridAmount(rng, 10000, 80000, 1000);
    const years = rng.int(10, 25);
    const n = monthly ? 12 * years : years;
    const j = monthly ? i / 12 : i;
    const ln: Loan = { L, i: j, n, P: L / an(n, j) };
    const rows = schedule(ln);
    const t = drawUntil(() => rng.int(3, n - 3), (x) => new Set([x, n - x, n - x + 1, n - x - 1, n - x + 2]).size === 5);
    const e = n - t + 1;
    const P = ln.P;
    const Pe = payE(ln);
    const vj = (p: number | string) => `(1+${lit(j)})**(-(${p}))`;
    const unit = monthly ? "month" : "year";
    const rateText = monthly ? `a nominal annual interest rate of ${pc(i)} convertible monthly` : `an annual effective interest rate of ${pc(i)}`;
    const scene = `A loan of ${amt(L)} is repaid by ${n} level ${monthly ? "monthly" : "annual"} payments of ${amt(Number(P.toFixed(2)))} made at the end of each ${unit}, at ${rateText}.`;
    const steps = [
      { concept: "loan.interest-principal-split", reasoning: `Interest in payment ${t} is the periodic rate times the balance just after payment ${t - 1}.` },
      { concept: "loan.principal-structure", reasoning: `With level payments that balance is $Pa_{\\overline{${e}|}}$, so the principal portion is $Pv^{${e}}$.` },
      ...(monthly ? [{ concept: "tvm.nominal-vs-effective", reasoning: `The periodic rate is $i^{(12)}/12 = ${mpc(j, 4)}$ per month, and $v$ must be at that rate.` }] : []),
    ];
    const common = {
      steps,
      conditions: monthly ? ["Level monthly payments at the end of each month.", "A constant nominal rate convertible monthly."] : LEVEL_CONDITIONS,
      relationship: "$I_t = jB_{t-1} = P(1 - v_j^{n-t+1}), \\qquad R_t = Pv_j^{n-t+1}$ with $j$ the rate per payment period.",
      transfer: {
        principle: "Work per payment period: the rate, the exponent and the balance all count payment periods.",
        unusual: "You judge a worked solution instead of producing one.",
        misread: monthly ? "A nominal annual rate is not a monthly rate." : "Counting the payments after $t$ instead of from $t$ loses one factor of $v$.",
      },
      itemFormat: "error-diagnosis" as const,
      presentation: monthly ? (["frequency"] as "frequency"[]) : (["direct"] as "direct"[]),
      features: { unfamiliar: monthly, multiConcept: monthly },
    };
    const Rt = lit(rows[t - 1].principal);
    const It = lit(rows[t - 1].interest);
    if (!monthly && variant === 0) {
      const proposed = P * v(i, n - t);
      return conceptQuestion({
        ...common,
        stem: `${scene} A candidate calculates the principal portion of the ${ord(t)} payment as\n\n$$${mamt(Number(P.toFixed(2)))}\\,v^{${n - t}} = ${mamt(Number(proposed.toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: { content: `The exponent is one too small: the principal portion is $Pv^{${e}}$.`, why: `Payments ${t} through ${n} number ${e}; the principal in payment ${t} is $Pv^{${e}}$.`, check: { expr: `${Pe}*${vj(e)}`, op: "=", than: Rt } },
        distractors: [
          { content: `The calculation is correct: the principal portion is $Pv^{${n - t}}$.`, misconception: "TIMING_BALANCE_INDEX", why: `$Pv^{${n - t}}$ is the principal in payment ${t + 1}.`, check: { expr: `${Pe}*${vj(n - t)}`, op: "=", than: Rt }, stage: 1, failure: "application", conditionTrue: `Correct for payment ${t + 1}.` },
          { content: `The exponent is one too large: the principal portion is $Pv^{${n - t - 1}}$.`, misconception: "ALG_SIGN_ERROR", why: "Earlier payments repay less principal, so the exponent must rise, not fall.", check: { expr: `${Pe}*${vj(n - t - 1)}`, op: "=", than: Rt }, stage: 1, failure: "application" },
          { content: `The exponent should be ${t}: the principal portion is $Pv^{${t}}$.`, misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The exponent counts payments to the end of the term, not from the start.", check: { expr: `${Pe}*${vj(t)}`, op: "=", than: Rt }, stage: 1, failure: "interpretation" },
          { content: `That is the interest; the principal portion is $P(1 - v^{${n - t}})$.`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "$Pv^{\\ldots}$ is a principal expression; interest is $P(1 - v^{\\ldots})$.", check: { expr: `${Pe}*(1-${vj(n - t)})`, op: "=", than: Rt }, stage: 0, failure: "interpretation" },
          { content: `Principal is level: it is ${amt(L)}/${n} in every payment.`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Level payments repay growing principal.", check: { expr: `${lit(L)}/${n}`, op: "=", than: Rt }, stage: 1, failure: "selection" },
        ],
        reference: { description: `Principal portion of payment ${t} read from the amortization schedule; each option's correction is compared with it.` },
        params: { L, i, n, t, variant },
      });
    }
    if (!monthly) {
      const proposed = i * balance(ln, t);
      return conceptQuestion({
        ...common,
        stem: `${scene} A candidate calculates the interest portion of the ${ord(t)} payment as\n\n$$${mpc(i)} \\times ${mamt(Number(P.toFixed(2)))}\\,a_{\\overline{${n - t}|}} = ${mamt(Number(proposed.toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: { content: `Interest accrues on the balance at the start of the year: $iPa_{\\overline{${e}|}}$.`, why: `The balance during year ${t} is the one just after payment ${t - 1}, $Pa_{\\overline{${e}|}}$.`, check: { expr: `${lit(i)}*${Pe}*${aExpr(e, i)}`, op: "=", than: It } },
        distractors: [
          { content: "The calculation is correct: interest is charged on the balance after the payment.", misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `$Pa_{\\overline{${n - t}|}}$ is the balance after payment ${t}, which exists only at the end of the year.`, check: { expr: lit(proposed), op: "=", than: It }, stage: 0, failure: "application", conditionTrue: `Correct for payment ${t + 1}.` },
          { content: `Interest should be charged on the original loan: $${mpc(i)} \\times ${mamt(L)}$.`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Part of the loan has been repaid; interest is charged on what is still owed.", check: { expr: `${lit(i)}*${lit(L)}`, op: "=", than: It }, stage: 0, failure: "selection" },
          { content: "Interest should be charged on the payment: $iP$.", misconception: "MODEL_INTEREST_ON_PAYMENT", why: "Interest accrues on the money lent, not on the payment.", check: { expr: `${lit(i)}*${Pe}`, op: "=", than: It }, stage: 0, failure: "interpretation" },
          { content: `The annuity should cover ${e + 1} payments: $iPa_{\\overline{${e + 1}|}}$.`, misconception: "TIMING_EXTRA_PERIOD", why: `Just after payment ${t - 1}, ${e} payments remain.`, check: { expr: `${lit(i)}*${Pe}*${aExpr(e + 1, i)}`, op: "=", than: It }, stage: 1, failure: "application" },
          { content: `The discount rate should be used: $dPa_{\\overline{${n - t}|}}$.`, misconception: "RATE_DISCOUNT_AS_INTEREST", why: "Interest at the end of a year is $i$ times the opening balance; $d$ times the closing balance is a different quantity.", check: { expr: `${lit(i / (1 + i))}*${Pe}*${aExpr(n - t, i)}`, op: "=", than: It }, stage: 0, failure: "selection" },
        ],
        reference: { description: `Interest portion of payment ${t} read from the amortization schedule; each option's correction is compared with it.` },
        params: { L, i, n, t, variant },
      });
    }
    const jm = `\\tfrac{${mpc(i)}}{12}`;
    if (variant === 0) {
      const proposed = P * Math.pow(1 + i, -e);
      return conceptQuestion({
        ...common,
        stem: `${scene} A candidate calculates the principal portion of the ${ord(t)} payment as\n\n$$${mamt(Number(P.toFixed(2)))}\\,(1 + ${lit(i)})^{-${e}} = ${mamt(Number(proposed.toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
        correct: { content: `The discount factor must be at the monthly rate: $(1 + ${jm})^{-${e}}$.`, why: `Payments are monthly, so $v$ is at $i^{(12)}/12$ per month; the exponent ${e} already counts months.`, check: { expr: `${Pe}*${vj(e)}`, op: "=", than: Rt } },
        distractors: [
          { content: "The calculation is correct, since the stated rate is the annual rate.", misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "Each factor in the exponent is one month, so the rate must be per month.", check: { expr: lit(proposed), op: "=", than: Rt }, stage: 2, failure: "application" },
          { content: `The discount factor should be $(1 + ${lit(i)})^{-${e}/12}$.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That treats the nominal rate as an annual effective rate.", check: { expr: `${Pe}*(1+${lit(i)})**(-${e}/12)`, op: "=", than: Rt }, stage: 2, failure: "selection" },
          { content: `The rate should be monthly and the exponent ${n - t}: $(1 + ${jm})^{-${n - t}}$.`, misconception: "TIMING_MISSING_PERIOD", why: `Payments ${t} through ${n} number ${e}.`, check: { expr: `${Pe}*${vj(n - t)}`, op: "=", than: Rt }, stage: 1, failure: "application" },
          { content: `The rate should be monthly and the exponent ${t}: $(1 + ${jm})^{-${t}}$.`, misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The exponent counts payments to the end of the term.", check: { expr: `${Pe}*${vj(t)}`, op: "=", than: Rt }, stage: 1, failure: "interpretation" },
          { content: `Principal is level: it is ${amt(L)}/${n} in every payment.`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "Level payments repay growing principal.", check: { expr: `${lit(L)}/${n}`, op: "=", than: Rt }, stage: 1, failure: "selection" },
        ],
        reference: { description: `Principal portion of payment ${t} read from the monthly amortization schedule; each option's correction is compared with it.` },
        params: { L, i, n, t, variant },
      });
    }
    const Bprev = rows[t - 1].opening;
    const bb = mamt(Number(Bprev.toFixed(2)));
    return conceptQuestion({
      ...common,
      stem: `${scene} The balance just after the ${ord(t - 1)} payment is ${amt(Number(Bprev.toFixed(2)))}. A candidate calculates the interest portion of the ${ord(t)} payment as\n\n$$${mpc(i)} \\times ${bb} = ${mamt(Number((i * Bprev).toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
      correct: { content: `The monthly rate must be used: $${jm} \\times ${bb}$.`, why: "One month's interest at a nominal rate convertible monthly is $i^{(12)}/12$ times the balance.", check: { expr: `${lit(j)}*${lit(Bprev)}`, op: "=", than: It } },
      distractors: [
        { content: "The calculation is correct, since the stated rate is the annual rate.", misconception: "RATE_ANNUAL_FOR_PERIODIC", why: "That is a full year's interest; each payment covers one month.", check: { expr: `${lit(i)}*${lit(Bprev)}`, op: "=", than: It }, stage: 2, failure: "application" },
        { content: `The rate should be $(1 + ${lit(i)})^{1/12} - 1$ applied to ${amt(Number(Bprev.toFixed(2)))}.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", why: "That treats the nominal rate as an annual effective rate.", check: { expr: `((1+${lit(i)})**(1/12)-1)*${lit(Bprev)}`, op: "=", than: It }, stage: 2, failure: "selection" },
        { content: `The monthly rate should be applied to the balance just after the ${ord(t)} payment.`, misconception: "CONC_LOAN_INTEREST_ON_CLOSING", why: `Interest for month ${t} accrues on the balance at the start of the month.`, check: { expr: `${lit(j)}*${lit(rows[t - 1].closing)}`, op: "=", than: It }, stage: 0, failure: "application" },
        { content: `The monthly rate should be applied to the original loan of ${amt(L)}.`, misconception: "MODEL_INTEREST_ON_ORIGINAL", why: "Interest is charged on the balance still owed.", check: { expr: `${lit(j)}*${lit(L)}`, op: "=", than: It }, stage: 0, failure: "selection" },
      ],
      reference: { description: `Interest portion of payment ${t} read from the monthly amortization schedule; each option's correction is compared with it.` },
      params: { L, i, n, t, variant },
    });
  },
});

// ================================================================ LOANS.final_payments

interface DropLoan {
  L: number;
  i: number;
  X: number;
  /** Unrounded term solving X a_n = L. */
  nStar: number;
  /** Number of regular payments. */
  N: number;
  /** Drop payment at time N + 1. */
  F: number;
}

/** A loan repaid by X a year for as long as necessary plus a smaller payment one year later. */
function drawDrop(rng: Rng): DropLoan {
  const i = gridRate(rng, 0.04, 0.08, 0.005);
  const L = gridAmount(rng, 20000, 60000, 1000);
  const X = gridAmount(rng, Math.ceil((L * i * 1.6) / 50) * 50, Math.ceil((L * i * 3) / 50) * 50, 50);
  const nStar = -Math.log(1 - (L * i) / X) / Math.log(1 + i);
  const N = Math.floor(nStar);
  if (nStar - N < 0.05 || nStar - N > 0.95 || N < 5) throw new Error("fractional term too close to an integer");
  return { L, i, X, nStar, N, F: (L - X * an(N, i)) * (1 + i) ** (N + 1) };
}

interface BalloonLoan {
  L: number;
  i: number;
  n: number;
  /** Exact level payment. */
  P: number;
  /** Regular payment, below P. */
  X: number;
  /** Balloon payment at time n. */
  F: number;
}

function drawBalloon(rng: Rng): BalloonLoan {
  const i = gridRate(rng, 0.04, 0.08, 0.005);
  const L = gridAmount(rng, 20000, 60000, 1000);
  const n = rng.int(10, 18);
  const P = L / an(n, i);
  const X = Math.floor((P - 11) / 50) * 50;
  return { L, i, n, P, X, F: (L * (1 + i) ** (n - 1) - X * sn(n - 1, i)) * (1 + i) };
}

const fpDropBalloon: ChoiceTemplate = conceptTemplate({
  id: "con-loan-fp-drop-balloon",
  family: "con-loan-fp",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.outstanding_balance"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "timing"],
  reasoning: ["concept_recognition", "cashflow_modelling"],
  soaConcept: "Recognising drop and balloon final payments and what each equals.",
  variants: 2,
  generate(rng, level, variant) {
    const drop = variant === 0;
    const steps = [
      { concept: "loan.drop-balloon", reasoning: drop ? "Payments of the regular amount continue while they do not overpay; a smaller payment one period later clears the loan: a drop payment." : "The regular payments are too small to repay the loan, so the final payment is larger: a balloon payment." },
      { concept: "loan.balance-timing", reasoning: "Any final payment equals the balance just before it is paid: the previous balance plus a period's interest." },
      { concept: "loan.balance-prospective-retrospective", reasoning: "That balance is found retrospectively from the loan and the regular payments." },
    ];
    const transfer = {
      principle: "Whatever its name, the final payment is the balance just before it is paid.",
      unusual: level === 2 ? "The number of regular payments is not stated." : "The question asks what the final payment is, not its value.",
      misread: "“Drop” means smaller and one period later; “balloon” means larger and in place of the last regular payment.",
    };
    const conditions = ["Payments at the end of each year.", "A constant annual effective rate of interest."];
    const relationship = "Final payment $= B_{\\text{last regular}}(1+i) = \\bigl(L(1+i)^{N} - Xs_{\\overline{N}|}\\bigr)(1+i)$";
    if (drop) {
      const d = drawDrop(rng);
      const { L, i, X, N, F, nStar } = d;
      const BN = L * (1 + i) ** N - X * sn(N, i);
      const stem = `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by payments of ${amt(X)} at the end of each year for as long as necessary, followed by a smaller final payment one year after the last payment of ${amt(X)}.\n\n${level === 1 ? "Which of the following describes the final payment?" : "Which of the following describes the final payment?"}`;
      if (level === 1) {
        return conceptQuestion({
          stem,
          correct: { content: `A drop payment: the balance just after the last payment of ${amt(X)}, accumulated for one year`, why: "The final payment is made one year after the last regular payment, so it must also pay that year's interest." },
          distractors: [
            { content: `A balloon payment: the last payment of ${amt(X)} plus the balance remaining after it`, misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "The final payment comes one year after the last regular payment, not with it.", stage: 0, failure: "recognition", conditionTrue: "That describes combining the final amount with the last regular payment." },
            { content: `A drop payment: the balance just after the last payment of ${amt(X)}, with no interest added`, misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "A year passes before the final payment, and interest accrues on the balance in that year.", stage: 1, failure: "application" },
            { content: `A drop payment: ${amt(X)} times the fractional part of the unrounded term`, misconception: "CONC_LOAN_PRORATED_FINAL", why: "The fractional part of $n$ in $Xa_{\\overline{n}|} = L$ has no direct meaning as a payment.", stage: 1, failure: "selection" },
            { content: `A drop payment: the loan less the total of the payments of ${amt(X)}`, misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Interest accrues on the loan; the balance is found with interest on both the loan and the payments.", stage: 2, failure: "selection" },
          ],
          steps,
          conditions,
          relationship,
          transfer,
          itemFormat: "definition",
          params: { L, i, X, N, variant },
        });
      }
      const opt = (value: number, time: number) => `A final payment of ${amt(Number(value.toFixed(2)))} at the end of year ${time}`;
      const FE = `(${lit(L)}*${accPow(i, N)} - ${lit(X)}*${sExpr(N, i)})*${onePlusLit(i)}`;
      return conceptQuestion({
        stem: stem.replace("Which of the following describes the final payment?", "Which of the following is the final payment?"),
        correct: { content: opt(F, N + 1), why: `${N} payments of ${amt(X)} leave a balance of $${mamt(Number(BN.toFixed(2)))}$ at time ${N}; one year's interest later it is paid off at time ${N + 1}.`, check: { expr: lit(F), op: "=", than: FE } },
        distractors: [
          { content: opt(BN, N + 1), misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "The balance at time $N$ earns a year's interest before the final payment.", check: { expr: lit(BN), op: "=", than: FE }, stage: 1, failure: "application" },
          { content: opt(X + BN, N), misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "The final payment is one year after the last regular payment, not added to it.", check: { expr: lit(X + BN), op: "=", than: FE }, stage: 0, failure: "recognition" },
          { content: opt(X * (nStar - N), N + 1), misconception: "CONC_LOAN_PRORATED_FINAL", why: "Prorating the payment by the fractional term ignores how interest accrues.", check: { expr: lit(X * (nStar - N)), op: "=", than: FE }, stage: 1, failure: "selection" },
          { content: opt(BN / (1 + i), N + 1), misconception: "CONC_MOVED_WRONG_WAY", why: "Moving the balance one year later accumulates it.", check: { expr: lit(BN / (1 + i)), op: "=", than: FE }, stage: 1, failure: "application" },
        ],
        reference: { description: "The final payment as the loan's unpaid present value accumulated to its date, compared with each option." },
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "definition",
        presentation: ["hidden-structure"],
        features: { unfamiliar: true },
        params: { L, i, X, N, variant },
      });
    }
    const b = drawBalloon(rng);
    const { L, i, n, P, X, F } = b;
    const Bn1 = L * (1 + i) ** (n - 1) - X * sn(n - 1, i);
    const stem = `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} payments at the end of each year. Each of the first ${n - 1} payments is ${amt(X)}, and the final payment is larger, so that the loan is repaid exactly.\n\nWhich of the following ${level === 1 ? "describes" : "is"} the final payment?`;
    if (level === 1) {
      return conceptQuestion({
        stem,
        correct: { content: `A balloon payment: the balance just after the ${ord(n - 1)} payment, accumulated for one year`, why: "The final payment is the balance just before it is paid: the previous balance plus a year's interest." },
        distractors: [
          { content: `A balloon payment: ${amt(X)} plus the total shortfall of the earlier payments`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Each shortfall stays owed and accrues interest until the final payment.", stage: 2, failure: "application" },
          { content: `A balloon payment: the balance just after the ${ord(n - 1)} payment, with no interest added`, misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "A year passes before the final payment, and the balance accrues interest in that year.", stage: 1, failure: "application" },
          { content: `A drop payment, smaller than ${amt(X)}, one year after the ${ord(n - 1)} payment`, misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "The regular payments are too small, so the final one must be larger.", stage: 0, failure: "recognition", conditionTrue: "True if the regular payment exceeded the level payment." },
          { content: `The level payment $${mamt(L)}/a_{\\overline{${n}|}}$, as for any ${n}-payment loan`, misconception: "TRANS_IGNORED_CONDITION", why: "The first payments are below the level payment, so the last one must make up the difference with interest.", stage: 0, failure: "interpretation" },
        ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "definition",
        params: { L, i, n, X, variant },
      });
    }
    const opt = (value: number) => `A final payment of ${amt(Number(value.toFixed(2)))}`;
    const FE = `(${lit(L)} - ${lit(X)}*${aExpr(n - 1, i)})*${accPow(i, n)}`;
    return conceptQuestion({
      stem,
      correct: { content: opt(F), why: `The shortfalls below the level payment accumulate with interest: the final payment is the balance at time ${n - 1} plus a year's interest.`, check: { expr: lit(F), op: "=", than: FE } },
      distractors: [
        { content: opt(X + n * (P - X)), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The shortfalls accrue interest until time $n$.", check: { expr: lit(X + n * (P - X)), op: "=", than: FE }, stage: 2, failure: "application" },
        { content: opt(Bn1), misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "The final payment also pays a year's interest on that balance.", check: { expr: lit(Bn1), op: "=", than: FE }, stage: 1, failure: "application" },
        { content: opt(X + (P - X) * an(n, i)), misconception: "FORMULA_AV_FOR_PV", why: "The shortfalls must be accumulated to time $n$, not discounted to time 0.", check: { expr: lit(X + (P - X) * an(n, i)), op: "=", than: FE }, stage: 2, failure: "selection" },
        { content: opt(F - X), misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "That treats the final payment as an extra amount paid on top of a regular payment.", check: { expr: lit(F - X), op: "=", than: FE }, stage: 0, failure: "recognition" },
      ],
      reference: { description: "The final payment as the unpaid present value accumulated to time $n$, compared with each option." },
      steps,
      conditions,
      relationship,
      transfer,
      itemFormat: "definition",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { L, i, n, X, variant },
    });
  },
});

const fpEquation: ChoiceTemplate = conceptTemplate({
  id: "con-loan-fp-equation",
  family: "con-loan-fp",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.unknown_variables"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["translation", "valuation_dates", "cashflow_modelling"],
  soaConcept: "The equation of value defining a drop or balloon payment, or the rate when the final payment is known.",
  variants: 2,
  generate(rng, level, variant) {
    const drop = variant === 0;
    const steps = [
      { concept: "loan.drop-balloon", reasoning: drop ? "The regular payments run to time $N$; the drop payment is one year later, at $N+1$." : "The regular payments run to time $n-1$; the balloon payment is at time $n$." },
      { concept: "loan.unknown-variable", reasoning: "The loan equals the value of all its payments at one date; each payment is moved by its own distance to that date." },
      ...(level >= 2 ? [{ concept: "loan.balance-timing", reasoning: level === 2 ? "At the chosen date, earlier payments are accumulated and later ones discounted." : "With the rate unknown, the same equation is read as an equation in $i$." }] : []),
    ];
    const transfer = {
      principle: "Write every payment at its own date first; then move each one to a single valuation date.",
      unusual: level === 3 ? "The unknown is the rate, with the final payment given." : level === 2 ? "The valuation date is not time 0." : "The options differ only in exponents and term counts.",
      misread: "A drop payment is one period after the last regular payment; a balloon payment replaces it.",
    };
    const conditions = ["Payments at the end of each year.", "A constant annual effective rate of interest."];
    const relationship = drop ? "$L = Xa_{\\overline{N}|} + Fv^{N+1}$" : "$L = Xa_{\\overline{n-1}|} + Fv^{n}$";
    const common = { steps, conditions, relationship, transfer, itemFormat: "equation-selection" as const };
    const d = drop ? drawDrop(rng) : null;
    const b = drop ? null : drawBalloon(rng);
    const L = drop ? d!.L : b!.L;
    const i = drop ? d!.i : b!.i;
    const X = drop ? d!.X : b!.X;
    const F = drop ? d!.F : b!.F;
    const N = drop ? d!.N : b!.n - 1; // number of regular payments
    const T = N + 1; // final payment time
    const ll = mamt(L);
    const xx = mamt(X);
    const stemLoan = drop
      ? `A loan of ${amt(L)} is repaid by ${N} payments of ${amt(X)} at the end of each year followed by a smaller final payment $F$ at the end of year ${T}`
      : `A loan of ${amt(L)} is repaid by ${N} payments of ${amt(X)} at the end of each year followed by a larger final payment $F$ at the end of year ${T}`;
    if (level <= 2) {
      const g = onePlusLit(i);
      const vv = (e: string) => `${g}**(-(${e}))`;
      const sx = (k: number) => sExpr(k, i);
      const ax = (k: number) => aExpr(k, i);
      const at0 = level === 1;
      const D = at0 ? 0 : N; // valuation date
      // f(x) = value at D of the payments minus value at D of the loan, x = F.
      const eq = (loanFactor: string, regular: string, finalFactor: string) => `${regular} + x*${finalFactor} - ${lit(L)}*${loanFactor}`;
      const correctProbe = at0 ? eq("1", `${lit(X)}*${ax(N)}`, vv(`${T}`)) : eq(accPow(i, D), `${lit(X)}*${sx(N)}`, vv("1"));
      const lhs = at0 ? ll : `${ll}(${lit(1 + i)})^{${D}}`;
      const options: ConceptOption[] = at0
        ? [
            { content: math(`${ll} = ${xx}\\,a_{\\overline{${N}|}} + F\\,v^{${N}}`), misconception: "TIMING_MISSING_PERIOD", why: `The final payment is at time ${T}, so it is discounted ${T} years.`, probe: eq("1", `${lit(X)}*${ax(N)}`, vv(`${N}`)), stage: 0, failure: "application" },
            { content: math(`${ll} = ${xx}\\,a_{\\overline{${N + 1}|}} + F\\,v^{${T}}`), misconception: "CONC_DOUBLE_COUNTED", why: `There is no regular payment at time ${T}; the final payment replaces it.`, probe: eq("1", `${lit(X)}*${ax(N + 1)}`, vv(`${T}`)), stage: 0, failure: "recognition" },
            { content: math(`${ll}(${lit(1 + i)})^{${T}} = ${xx}\\,s_{\\overline{${N}|}} + F`), misconception: "TIMING_VALUATION_DATE", why: `$s_{\\overline{${N}|}}$ values the regular payments at time ${N}, not ${T}.`, probe: eq(accPow(i, T), `${lit(X)}*${sx(N)}`, "1"), stage: 1, failure: "application" },
            { content: math(`${ll} = ${xx}\\,a_{\\overline{${N}|}} + F`), misconception: "TIMING_IGNORED_DEFERRAL", why: `The final payment is ${T} years away and must be discounted.`, probe: eq("1", `${lit(X)}*${ax(N)}`, "1"), stage: 1, failure: "application" },
            ...(drop
              ? [{ content: math(`${ll} = ${xx}\\,a_{\\overline{${N}|}} + F(${lit(1 + i)})^{${T}}`), misconception: "CONC_MOVED_WRONG_WAY" as const, why: "Valuing at time 0 discounts the final payment.", probe: eq("1", `${lit(X)}*${ax(N)}`, accPow(i, T)), stage: 1, failure: "application" as const }]
              : [{ content: math(`${ll} = ${xx}\\,a_{\\overline{${N}|}} + (F + ${xx})\\,v^{${T}}`), misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED" as const, why: "The balloon payment is the whole final payment, not an addition to a regular payment.", probe: eq("1", `${lit(X)}*${ax(N)}`, vv(`${T}`)) + ` + ${lit(X)}*${vv(`${T}`)}`, stage: 0, failure: "recognition" as const }]),
          ]
        : [
            { content: math(`${lhs} = ${xx}\\,s_{\\overline{${N}|}} + F`), misconception: "TIMING_MISSING_PERIOD", why: `The final payment is one year after time ${N}, so it is discounted by $v$.`, probe: eq(accPow(i, D), `${lit(X)}*${sx(N)}`, "1"), stage: 1, failure: "application" },
            { content: math(`${lhs} = ${xx}\\,\\ddot{s}_{\\overline{${N}|}} + F\\,v`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: `The last regular payment is at time ${N} itself, so the payments form an annuity-immediate valued at ${N}.`, probe: eq(accPow(i, D), `${lit(X)}*${sx(N)}*${g}`, vv("1")), stage: 1, failure: "application" },
            { content: math(`${lhs} = ${xx}\\,s_{\\overline{${N}|}} + F(${lit(1 + i)})`), misconception: "CONC_MOVED_WRONG_WAY", why: `Bringing a later payment back to time ${N} discounts it.`, probe: eq(accPow(i, D), `${lit(X)}*${sx(N)}`, g), stage: 1, failure: "application" },
            { content: math(`${ll}(${lit(1 + i)})^{${T}} = ${xx}\\,s_{\\overline{${N}|}} + F`), misconception: "TIMING_VALUATION_DATE", why: `$s_{\\overline{${N}|}}$ is a value at time ${N} while the other terms are at time ${T}.`, probe: eq(accPow(i, T), `${lit(X)}*${sx(N)}`, "1"), stage: 1, failure: "application" },
            { content: math(`${lhs} = ${xx}\\,s_{\\overline{${N - 1}|}} + F\\,v`), misconception: "SEQ_TERM_COUNT", why: `${N} regular payments have been made by time ${N}.`, probe: eq(accPow(i, D), `${lit(X)}*${sx(N - 1)}`, vv("1")), stage: 0, failure: "application" },
          ];
      return conceptQuestion({
        ...common,
        stem: `${stemLoan}. The annual effective interest rate is ${pc(i)}, and annuity symbols are at that rate.\n\nDetermine which of the following equations $F$ satisfies.`,
        correct: { content: math(at0 ? `${ll} = ${xx}\\,a_{\\overline{${N}|}} + F\\,v^{${T}}` : `${lhs} = ${xx}\\,s_{\\overline{${N}|}} + F\\,v`), why: at0 ? `At time 0: ${N} regular payments form $${xx}\\,a_{\\overline{${N}|}}$ and $F$ is discounted ${T} years.` : `At time ${N}: the loan accumulated ${N} years equals the regular payments accumulated to time ${N} plus $F$ discounted one year.`, probe: correctProbe },
        distractors: options,
        reference: { values: [{ label: "F", expr: `x - ${lit(F)}`, bracket: [0, 4 * X] }], description: `The final payment from the balance just after payment ${N}, accumulated one year: $F = ${mamt(Number(F.toFixed(2)))}$.` },
        presentation: level === 2 ? ["valuation-date"] : ["direct"],
        features: { multipleValuationDates: level === 2 },
        params: { L, i, X, N, variant },
      });
    }
    // Level 3: F given, the rate unknown.
    const Fd = Number(F.toFixed(2));
    const ff = mamt(Fd);
    const ax = (k: number) => `((1-(1+x)**(-${k}))/x)`;
    const sx = (k: number) => `(((1+x)**${k}-1)/x)`;
    const explicit = `${Array.from({ length: N }, (_, t) => `${lit(X)}*(1+x)**(-${t + 1})`).join(" + ")} + ${lit(Fd)}*(1+x)**(-${T}) - ${lit(L)}`;
    const ai = (k: number | string) => `a_{\\overline{${k}|}\\,i}`;
    const distractors: ConceptOption[] = [
      { content: math(`${ll} = ${xx}\\,${ai(N)} + ${ff}\\,v^{${N}}`), misconception: "TIMING_MISSING_PERIOD", why: `The final payment is at time ${T}.`, probe: `${lit(X)}*${ax(N)} + ${lit(Fd)}*(1+x)**(-${N}) - ${lit(L)}`, stage: 0, failure: "application" },
      { content: math(`${ll} = ${xx}\\,${ai(N + 1)} + ${ff}\\,v^{${T}}`), misconception: "CONC_DOUBLE_COUNTED", why: `There is no regular payment at time ${T}.`, probe: `${lit(X)}*${ax(N + 1)} + ${lit(Fd)}*(1+x)**(-${T}) - ${lit(L)}`, stage: 0, failure: "recognition" },
      { content: math(`${ll}(1+i)^{${T}} = ${N}(${xx}) + ${ff}`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The regular payments earn interest to time $T$ as well.", probe: `${lit(L)}*(1+x)**${T} - ${N}*${lit(X)} - ${lit(Fd)}`, stage: 1, failure: "application" },
      { content: math(`${ll}(1+i)^{${T}} = ${xx}\\,s_{\\overline{${N}|}\\,i} + ${ff}`), misconception: "TIMING_VALUATION_DATE", why: `$s_{\\overline{${N}|}}$ values the regular payments at time ${N}, not ${T}.`, probe: `${lit(L)}*(1+x)**${T} - ${lit(X)}*${sx(N)} - ${lit(Fd)}`, stage: 1, failure: "application" },
      { content: math(`${ll} = ${xx}\\,${ai(N)} + ${ff}`), misconception: "TIMING_IGNORED_DEFERRAL", why: "The final payment must be discounted.", probe: `${lit(X)}*${ax(N)} + ${lit(Fd)} - ${lit(L)}`, stage: 1, failure: "application" },
    ];
    return conceptQuestion({
      ...common,
      stem: `${stemLoan.replace("final payment $F$", `final payment of ${amt(Fd)}`)}.\n\nDetermine which of the following equations the annual effective interest rate $i$ satisfies.`,
      correct: { content: math(`${ll} = ${xx}\\,${ai(N)} + ${ff}\\,v^{${T}}`), why: `At time 0 the ${N} regular payments form an annuity-immediate and the final payment is discounted ${T} years.`, probe: `${lit(X)}*${ax(N)} + ${lit(Fd)}*(1+x)**(-${T}) - ${lit(L)}` },
      distractors,
      reference: { values: [{ label: "i", expr: explicit, bracket: [0.005, 0.3] }], description: "Each payment discounted term by term from its own date, solved numerically for the rate." },
      presentation: ["unknown-rate", "hidden-structure"],
      modelingDecisions: 1,
      features: { unfamiliar: true },
      params: { L, i, X, N, F: Fd, variant },
    });
  },
});

const fpStatements: ChoiceTemplate = conceptTemplate({
  id: "con-loan-fp-statements",
  family: "con-loan-fp",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.final_payments",
  secondary: ["LOANS.principal_interest", "LOANS.outstanding_balance"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  reasoning: ["validation", "financial_intuition"],
  soaConcept: "Comparing repayment plans with drop and balloon final payments.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Track each plan's balance: rounding the payment up repays faster, leaves a smaller final payment and costs less interest.",
      unusual: "Two repayment plans are compared through statements.",
      misread: "Totals of payments are not present values; they differ by interest.",
    };
    const conditions = ["Payments at the end of each year.", "A constant annual effective rate of interest."];
    if (variant === 0) {
      const i = gridRate(rng, 0.04, 0.08, 0.005);
      const L = gridAmount(rng, 20000, 60000, 1000);
      const n = rng.int(8, 15);
      const P = L / an(n, i);
      const Xu = Math.ceil((P + 11) / 50) * 50;
      const Xd = Math.floor((P - 11) / 50) * 50;
      const final = (X: number) => (L * (1 + i) ** (n - 1) - X * sn(n - 1, i)) * (1 + i);
      const FA = final(Xu);
      const _FB = final(Xd);
      if (FA < 0.2 * P) throw new Error("plan A overpays");
      const k = rng.int(3, n - 3);
      const finalE = (X: number) => `(${lit(L)}*${accPow(i, n - 1)} - ${lit(X)}*${sExpr(n - 1, i)})*${onePlusLit(i)}`;
      const balE = (X: number, t: number) => `(${lit(L)}*${accPow(i, t)} - ${lit(X)}*${sExpr(t, i)})`;
      const totA = `(${n - 1}*${lit(Xu)} + ${finalE(Xu)})`;
      const totB = `(${n - 1}*${lit(Xd)} + ${finalE(Xd)})`;
      const steps = [
        { concept: "loan.drop-balloon", reasoning: "Paying more than the level payment leaves a final payment below the regular one; paying less leaves a balloon." },
        { concept: "loan.balance-prospective-retrospective", reasoning: "Retrospectively, the balances of the two plans differ by the accumulated difference in payments." },
        { concept: "loan.interest-principal-split", reasoning: "The plan that repays principal sooner pays interest on smaller balances, so less interest in total." },
        ...(level === 3 ? [{ concept: "loan.balance-timing", reasoning: "Each final payment is its plan's balance just after payment $n-1$, plus a year's interest." }] : []),
      ];
      const statements =
        level === 2
          ? [
              statement("I", `Under plan A, the final payment is less than ${amt(Xu)}.`, true, `Paying ${amt(Xu)} exceeds the level payment, so less is left for the end: $${mamt(Number(FA.toFixed(2)))}$.`, "CONC_LOAN_DROP_BALLOON_CONFUSED", { stage: 0, failure: "recognition", check: { expr: finalE(Xu), op: "<", than: Xu } }),
              statement("II", `Under plan B, the final payment exceeds ${amt(Xd)} by ${amt(Number((n * (P - Xd)).toFixed(2)))}.`, false, "The shortfalls accrue interest, so the excess is larger than their plain total.", "SEQ_UNDISCOUNTED_SUM", { stage: 1, failure: "application", check: { expr: `${finalE(Xd)} - ${lit(Xd)}`, op: "=", than: Number((n * (P - Xd)).toFixed(2)), tol: 1e-4 } }),
              statement("III", "The total of all payments under plan A is less than under plan B.", true, "Plan A repays principal sooner, so it pays less interest; both repay the same principal.", "CONC_LOAN_TOTAL_INTEREST_FIXED", { stage: 2, failure: "conclusion", check: { expr: totA, op: "<", than: totB } }),
            ]
          : [
              statement("I", `Just after the ${ord(k)} payment, the balance under plan B exceeds the balance under plan A by ${amt(Xu - Xd)}$\\,s_{\\overline{${k}|}}$ at ${pc(i)}.`, true, "The plans differ only in the payments made, and that difference accumulates with interest.", "SEQ_UNDISCOUNTED_SUM", { stage: 1, failure: "application", check: { expr: `${balE(Xd, k)} - ${balE(Xu, k)}`, op: "=", than: `${lit(Xu - Xd)}*${sExpr(k, i)}` } }),
              statement("II", `Under plan B, the final payment equals the balance just after the ${ord(n - 1)} payment.`, false, "The final payment also pays a year's interest on that balance.", "CONC_LOAN_BEFORE_AFTER_PAYMENT", { stage: 3, failure: "application", check: { expr: finalE(Xd), op: "=", than: balE(Xd, n - 1) } }),
              statement("III", "The total interest paid under plan A is less than under plan B.", true, "Plan A's balance is lower at every date, so less interest accrues.", "CONC_LOAN_TOTAL_INTEREST_FIXED", { stage: 2, failure: "conclusion", check: { expr: `${totA} - ${lit(L)}`, op: "<", than: `${totB} - ${lit(L)}` } }),
            ];
      return statementQuestion({
        steps,
        conditions,
        relationship: "Final payment $= (L(1+i)^{n-1} - Xs_{\\overline{n-1}|})(1+i)$; balances differ by $(X_A - X_B)s_{\\overline{k}|}$.",
        transfer,
        stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is to be repaid by ${n} payments at the end of each year, the last of which is adjusted so that the loan is repaid exactly. Under plan A each of the first ${n - 1} payments is ${amt(Xu)}; under plan B each is ${amt(Xd)}.\n\nDetermine which of the following statements are true.`,
        statements,
        extra: [
          { keys: ["II"], misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "Ignoring interest makes the plans look alike: it rejects I and III and accepts the undiscounted claim in II.", stage: 1, failure: "selection" },
          { keys: ["II", "III"], misconception: "CONC_LOAN_IRREGULAR_FINAL_IGNORED", why: "Overlooking how the final payment is built rejects I and accepts II.", stage: 0, failure: "conclusion" },
        ],
        presentation: level === 3 ? ["compare-streams", "hidden-structure"] : ["compare-streams"],
        ...(level === 3 ? { modelingDecisions: 1 } : {}),
        features: { unfamiliar: true },
        params: { L, i, n, Xu, Xd, k, variant },
      });
    }
    const d = drawDrop(rng);
    const { L, i, X, N, F, nStar } = d;
    const T = N + 1;
    const BN = `(${lit(L)}*${accPow(i, N)} - ${lit(X)}*${sExpr(N, i)})`;
    const steps = [
      { concept: "loan.drop-balloon", reasoning: `Find how many payments of ${amt(X)} fit: $${mamt(X)}\\,a_{\\overline{n}|} = ${mamt(L)}$ has root $n \\approx ${nStar.toFixed(2)}$, so ${N} full payments.` },
      { concept: "loan.balance-prospective-retrospective", reasoning: `The balance just after payment ${N} is $${mamt(L)}(1+i)^{${N}} - ${mamt(X)}\\,s_{\\overline{${N}|}}$.` },
      { concept: "loan.balance-timing", reasoning: `The drop payment at time ${T} is that balance plus a year's interest; paid at time ${N} instead, it would be worth $Fv$.` },
      ...(level === 3 ? [{ concept: "loan.non-level-payments", reasoning: "The fractional term itself is not a payment amount; only the balance is." }] : []),
    ];
    const statements =
      level === 2
        ? [
            statement("I", `Exactly ${N + 1} payments of ${amt(X)} are made.`, false, `${N + 1} payments of ${amt(X)} would be worth more than the loan; only ${N} are made.`, "SEQ_TERM_COUNT", { stage: 0, failure: "application", check: { expr: `${lit(X)}*${aExpr(N + 1, i)}`, op: "<=", than: lit(L) } }),
            statement("II", `The final payment is ${amt(Number(F.toFixed(2)))}.`, true, `It is the balance just after payment ${N}, accumulated for one year.`, "CONC_LOAN_BEFORE_AFTER_PAYMENT", { stage: 2, failure: "application", check: { expr: `${BN}*${onePlusLit(i)}`, op: "=", than: Number(F.toFixed(2)), tol: 1e-4 } }),
            statement("III", `If the final payment were instead combined with the last payment of ${amt(X)}, the combined payment would be ${amt(Number((X + F).toFixed(2)))}.`, false, `Paid a year earlier, the final amount is worth only $Fv$: the combined payment would be $${mamt(Number((X + F / (1 + i)).toFixed(2)))}$.`, "TIMING_VALUATION_DATE", { stage: 2, failure: "application", check: { expr: `${lit(X)} + ${BN}`, op: "=", than: Number((X + F).toFixed(2)), tol: 1e-4 } }),
          ]
        : [
            statement("I", `The balance just after the ${ord(N)} payment of ${amt(X)} is less than ${amt(X)}.`, true, "Otherwise another full payment of the regular amount would be needed.", "SEQ_TERM_COUNT", { stage: 0, failure: "application", check: { expr: BN, op: "<", than: X } }),
            statement("II", `The final payment is ${amt(Number((X * (nStar - N)).toFixed(2)))}, the regular payment times the fractional part of ${nStar.toFixed(4)}.`, false, `The final payment is the balance accumulated one year: $${mamt(Number(F.toFixed(2)))}$.`, "CONC_LOAN_PRORATED_FINAL", { stage: 3, failure: "selection", check: { expr: lit(F), op: "=", than: Number((X * (nStar - N)).toFixed(2)), tol: 1e-4 } }),
            statement("III", `If the final payment were instead combined with the ${ord(N)} payment, the combined payment would be ${amt(Number((X + F / (1 + i)).toFixed(2)))}.`, true, `Combined at time ${N}, it must clear the balance just before payment ${N}: $X + Fv$.`, "TIMING_VALUATION_DATE", { stage: 2, failure: "application", check: { expr: `(${lit(L)}*${accPow(i, N - 1)} - ${lit(X)}*${sExpr(N - 1, i)})*${onePlusLit(i)}`, op: "=", than: Number((X + F / (1 + i)).toFixed(2)), tol: 1e-4 } }),
          ];
    return statementQuestion({
      steps,
      conditions,
      relationship: "$F = \\bigl(L(1+i)^N - Xs_{\\overline{N}|}\\bigr)(1+i)$; combined at time $N$: $X + Fv$.",
      transfer,
      stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by payments of ${amt(X)} at the end of each year for as long as necessary, followed by a smaller final payment one year after the last payment of ${amt(X)}.\n\nDetermine which of the following statements are true.`,
      statements,
      extra:
        level === 2
          ? [
              { keys: ["I"], misconception: "CONC_LOAN_PRORATED_FINAL", why: "Rounding the term up and prorating the last payment accepts I and rejects II.", stage: 0, failure: "interpretation" },
              { keys: ["I", "II", "III"], misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "Treating the final payment as part of a regular payment accepts all three.", stage: 0, failure: "recognition" },
            ]
          : [
              { keys: ["II"], misconception: "CONC_LOAN_DROP_BALLOON_CONFUSED", why: "Treating the final amount as a share of a regular payment accepts II and rejects I and III.", stage: 0, failure: "recognition" },
              { keys: ["I", "II"], misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "Misplacing which balance the final payment clears rejects III and accepts II.", stage: 2, failure: "interpretation" },
            ],
      presentation: ["hidden-structure"],
      ...(level === 3 ? { modelingDecisions: 1 } : {}),
      features: { unfamiliar: true },
      params: { L, i, X, N, variant },
    });
  },
});

// ================================================================ LOANS.unknown_variables

const uvSufficient: ChoiceTemplate = conceptTemplate({
  id: "con-loan-uv-sufficient",
  family: "con-loan-uv",
  topic: "LOANS",
  levels: [1],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.payment_components"],
  itemFormat: "enumerated-conditions",
  conceptFamily: "interpretation",
  dimensions: ["conditions", "interpretation"],
  reasoning: ["concept_recognition", "translation"],
  soaConcept: "Recognising which loan facts are enough to pin down an unknown loan variable.",
  variants: 2,
  generate(rng, level, variant) {
    const n = rng.int(10, 30);
    const i = gridRate(rng, 0.03, 0.09, 0.005);
    const knowsTerm = variant === 0;
    const steps = [
      { concept: "loan.unknown-variable", reasoning: knowsTerm ? "With $n$ known, the unknowns are $L$, $P$ and $i$, tied by $L = Pa_{\\overline{n}|}$: two more independent facts are needed." : "With $i$ known, the unknowns are $L$, $P$ and $n$, tied by $L = Pa_{\\overline{n}|}$: two more independent facts are needed." },
      { concept: "loan.principal-structure", reasoning: "Translate each fact: $I_1 = iL$, $R_1 = Pv^{n}$, $R_n = Pv$, $R_{t+1}/R_t = 1+i$, total payments $nP$." },
      { concept: "loan.interest-principal-split", reasoning: "Count independent equations: a fact implied by what is already known adds nothing." },
    ];
    const stem = knowsTerm
      ? `A loan is repaid by ${n} level annual payments made at the end of each year. The amount of the loan, the payment and the annual effective interest rate are not stated.\n\nWhich of the following pieces of information, together with the number of payments, is sufficient to determine the amount of the loan?`
      : `A loan is repaid by level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}. The amount of the loan, the payment and the number of payments are not stated.\n\nWhich of the following pieces of information, together with the interest rate, is sufficient to determine the number of payments?`;
    const correct: ConceptOption = knowsTerm
      ? { content: "The principal portions of the first and the last payments", why: "Their ratio is $v^{n-1}$, which gives $i$; then $P = R_n(1+i)$ and $L = Pa_{\\overline{n}|}$." }
      : { content: "The level payment and the interest portion of the first payment", why: "$I_1 = iL$ gives $L$; then $L = Pa_{\\overline{n}|}$ gives $n$." };
    const distractors: ConceptOption[] = knowsTerm
      ? [
          { content: "The interest portion of the first payment", misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: "$I_1 = iL$ is one equation in two unknowns, $i$ and $L$.", stage: 0, failure: "conclusion", conditionTrue: "Sufficient if the rate were also known." },
          { content: "The total of all the payments", misconception: "SEQ_UNDISCOUNTED_SUM", why: "The total gives $P$, but without the rate the payments cannot be discounted.", stage: 1, failure: "interpretation" },
          { content: "The principal portion of the first payment", misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: `$R_1 = Pv^{${n}}$ involves both $P$ and $i$; the loan is not ${n} times $R_1$.`, stage: 1, failure: "selection" },
          { content: "The total interest paid over the term", misconception: "VAR_TOTAL_FOR_COMPONENT", why: `$${n}P - L$ is a single equation, and $P$ and $i$ are both unknown.`, stage: 2, failure: "conclusion" },
        ]
      : [
          { content: "The level payment, without any other information", misconception: "CONC_NECESSARY_AS_SUFFICIENT", why: "Without the loan amount, $L = Pa_{\\overline{n}|}$ has two unknowns.", stage: 0, failure: "conclusion" },
          { content: "The amount of the loan, without any other information", misconception: "TRANS_IGNORED_CONDITION", why: "Without the payment, $L = Pa_{\\overline{n}|}$ has two unknowns.", stage: 0, failure: "conclusion" },
          { content: "The principal portions of the first and second payments", misconception: "CONC_LOAN_DEPENDENT_EQUATIONS", why: "Their ratio is $1+i$, which is already known, so only $R_1 = Pv^n$ is new: one equation in $P$ and $n$.", stage: 2, failure: "connection" },
          { content: "The total of all the payments made over the term", misconception: "SEQ_UNDISCOUNTED_SUM", why: "$nP$ is one equation, and $P$, $n$ and $L$ remain linked by only one more.", stage: 1, failure: "interpretation" },
        ];
    return conceptQuestion({
      stem,
      correct,
      distractors,
      steps,
      conditions: LEVEL_CONDITIONS,
      relationship: "$L = Pa_{\\overline{n}|}, \\quad I_1 = iL, \\quad R_t = Pv^{n-t+1}$",
      counterexample: knowsTerm ? "Two loans with different rates can share the same first-year interest: $I_1$ alone does not fix $L$." : "Many loans pay the same level amount at the same rate: the payment alone does not fix the term.",
      transfer: {
        principle: "Count unknowns and independent equations; each stated fact must add a new equation.",
        unusual: "No calculation is asked for: only whether one is possible.",
        misread: "A fact that follows from what is already known looks useful but adds nothing.",
      },
      itemFormat: "enumerated-conditions",
      params: { n, i, variant },
    });
  },
});

const uvEquation: ChoiceTemplate = conceptTemplate({
  id: "con-loan-uv-equation",
  family: "con-loan-uv",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.payment_components", "LOANS.amortization"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "relationships"],
  reasoning: ["translation", "formula_selection", "algebra"],
  soaConcept: "The equation defining an unknown loan rate, payment or term from the information given.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Translate each fact into the loan's payment structure, then write one equation in the unknown.",
      unusual: level === 1 ? "The options are equations, not values." : "The facts are about components of payments, not the loan amount.",
      misread: "Exponents count payments from $t$ to the end, not from the start.",
    };
    const conditions = LEVEL_CONDITIONS;
    if (level === 1 && variant === 0) {
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const n = rng.int(10, 25);
      const P = gridAmount(rng, 500, 4000, 50);
      const L = Math.round((P * an(n, i)) / 100) * 100;
      const ax = (k: number) => `((1-(1+x)**(-${k}))/x)`;
      const pp = mamt(P);
      const ll = mamt(L);
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} annual payments of ${amt(P)} made at the end of each year.\n\nDetermine which of the following equations the annual effective interest rate $i$ satisfies.`,
        correct: { content: math(`${ll} = ${pp}\\,a_{\\overline{${n}|}\\,i}`), why: "The loan is the present value of the payments at the loan rate.", probe: `${lit(P)}*${ax(n)} - ${lit(L)}` },
        distractors: [
          { content: math(`${ll}(1+i)^{${n}} = ${n}(${pp})`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The payments are made over the term and earn interest; they cannot simply be added at time $n$.", probe: `${lit(L)}*(1+x)**${n} - ${n}*${lit(P)}`, stage: 1, failure: "application" },
          { content: math(`${ll} = ${pp}\\,s_{\\overline{${n}|}\\,i}`), misconception: "FORMULA_AV_FOR_PV", why: "$s$ values the payments at time $n$; the loan is a value at time 0.", probe: `${lit(P)}*((1+x)**${n}-1)/x - ${lit(L)}`, stage: 1, failure: "selection" },
          { content: math(`${ll} = ${pp}\\,\\ddot{a}_{\\overline{${n}|}\\,i}`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The first payment is at the end of the first year.", probe: `${lit(P)}*${ax(n)}*(1+x) - ${lit(L)}`, stage: 1, failure: "application" },
          { content: math(`${ll} = ${pp}\\,a_{\\overline{${n - 1}|}\\,i}`), misconception: "SEQ_TERM_COUNT", why: `There are ${n} payments.`, probe: `${lit(P)}*${ax(n - 1)} - ${lit(L)}`, stage: 0, failure: "application" },
        ],
        reference: { values: [{ label: "i", expr: `${Array.from({ length: n }, (_, t) => `${lit(P)}*(1+x)**(-${t + 1})`).join(" + ")} - ${lit(L)}`, bracket: [0.001, 0.4] }], description: "The payments discounted term by term, solved numerically for the rate." },
        steps: [
          { concept: "loan.unknown-variable", reasoning: "One unknown, the rate: one equation of value." },
          { concept: "loan.balance-prospective-retrospective", reasoning: "At time 0 the balance is the loan itself: the present value of all the payments." },
        ],
        conditions,
        relationship: "$L = Pa_{\\overline{n}|\\,i}$",
        transfer,
        itemFormat: "equation-selection",
        presentation: ["unknown-rate"],
        params: { L, P, n, variant },
      });
    }
    if (level === 1) {
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const n = rng.int(10, 20);
      const m = rng.int(2, 4);
      const L = gridAmount(rng, 10000, 60000, 1000);
      const ll = mamt(L);
      const g = lit(1 + i);
      const a = (k: number) => aExpr(k, i);
      const eq = (lhs: string, rhs: string) => `${rhs} - ${lhs}`;
      return conceptQuestion({
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments of $P$. The first payment is made at the end of year ${m + 1}. The annual effective interest rate is ${pc(i)}, and annuity symbols are at that rate.\n\nDetermine which of the following equations $P$ satisfies.`,
        correct: { content: math(`${ll} = P\\,a_{\\overline{${n}|}}\\,v^{${m}}`), why: `$a_{\\overline{${n}|}}$ values the payments at time ${m}, one year before the first; discount ${m} more years to time 0.`, probe: eq(lit(L), `x*${a(n)}*${vPow(i, m)}`) },
        distractors: [
          { content: math(`${ll} = P\\,a_{\\overline{${n}|}}\\,v^{${m + 1}}`), misconception: "TIMING_DEFERRAL_OFF_BY_ONE", why: `$a_{\\overline{${n}|}}$ already places the value one year before the first payment, at time ${m}.`, probe: eq(lit(L), `x*${a(n)}*${vPow(i, m + 1)}`), stage: 1, failure: "application" },
          { content: math(`${ll} = P\\,a_{\\overline{${n}|}}`), misconception: "TIMING_IGNORED_DEFERRAL", why: "The payments start later, so their value at time 0 is smaller.", probe: eq(lit(L), `x*${a(n)}`), stage: 0, failure: "recognition" },
          { content: math(`${ll} = P\\,a_{\\overline{${n + m}|}}`), misconception: "SEQ_TERM_COUNT", why: "No payments are made during the deferral.", probe: eq(lit(L), `x*${a(n + m)}`), stage: 0, failure: "interpretation" },
          { content: math(`${ll}(${g})^{${m}} = P\\,\\ddot{a}_{\\overline{${n}|}}`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: `Valued at time ${m}, the first payment is a year away: an annuity-immediate.`, probe: eq(`${lit(L)}*${accPow(i, m)}`, `x*${a(n)}*${g}`), stage: 1, failure: "application" },
          { content: math(`${ll} = P\\,a_{\\overline{${n}|}}(${g})^{${m}}`), misconception: "CONC_MOVED_WRONG_WAY", why: "Bringing the annuity value back to time 0 discounts it.", probe: eq(lit(L), `x*${a(n)}*${accPow(i, m)}`), stage: 1, failure: "application" },
        ],
        reference: { values: [{ label: "P", expr: `${lit(L)}/(${Array.from({ length: n }, (_, t) => vPow(i, m + 1 + t)).join(" + ")})` }], description: "The loan divided by the sum of the discount factors of the actual payment dates." },
        steps: [
          { concept: "loan.unknown-variable", reasoning: "The unknown payment is fixed by one equation of value at time 0." },
          { concept: "loan.balance-timing", reasoning: `$a_{\\overline{${n}|}}$ values the payments at time ${m}; a further $v^{${m}}$ brings them to time 0.` },
        ],
        conditions: [`First payment at the end of year ${m + 1}; level payments thereafter.`, "A constant annual effective rate of interest."],
        relationship: "$L = Pa_{\\overline{n}|}v^{m}$",
        transfer,
        itemFormat: "equation-selection",
        presentation: ["deferred"],
        params: { L, i, n, m, variant },
      });
    }
    if (level === 2) {
      const ln = drawLoan(rng, 12, 25);
      const { i, n } = ln;
      const rows = schedule(ln);
      if (variant === 0) {
        const k = drawUntil(() => rng.int(3, n - 3), (x) => new Set([x, n - x, n - x + 1, n - x + 2]).size === 4);
        const e = n - k + 1;
        const I = Number(rows[k - 1].interest.toFixed(2));
        const R = Number(rows[k - 1].principal.toFixed(2));
        const ii = mamt(I);
        const rr = mamt(R);
        const f = (lhs: string, rhs: string) => `${lhs} - (${rhs})`;
        return conceptQuestion({
          stem: `A loan is repaid by ${n} level annual payments made at the end of each year. The ${ord(k)} payment consists of ${amt(I)} of interest and ${amt(R)} of principal.\n\nDetermine which of the following equations the annual effective interest rate $i$ satisfies.`,
          correct: { content: math(`${rr}(1+i)^{${e}} = ${ii} + ${rr}`), why: `The payment is $${ii} + ${rr}$ and its principal portion is $Pv^{${e}}$.`, probe: f(`${lit(R)}*(1+x)**${e}`, `${lit(I)} + ${lit(R)}`) },
          distractors: [
            { content: math(`${rr}(1+i)^{${n - k}} = ${ii} + ${rr}`), misconception: "TIMING_MISSING_PERIOD", why: `Payments ${k} through ${n} number ${e}.`, probe: f(`${lit(R)}*(1+x)**${n - k}`, `${lit(I)} + ${lit(R)}`), stage: 1, failure: "application" },
            { content: math(`${rr}(1+i)^{${k}} = ${ii} + ${rr}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The exponent counts payments to the end of the term.", probe: f(`${lit(R)}*(1+x)**${k}`, `${lit(I)} + ${lit(R)}`), stage: 1, failure: "interpretation" },
            { content: math(`${ii}(1+i)^{${e}} = ${ii} + ${rr}`), misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "It is the principal portion that equals $Pv^{n-k+1}$.", probe: f(`${lit(I)}*(1+x)**${e}`, `${lit(I)} + ${lit(R)}`), stage: 0, failure: "interpretation" },
            { content: math(`${rr}(1+${e}i) = ${ii} + ${rr}`), misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Discounting compounds: $v^{n-k+1}$, not a linear factor.", probe: f(`${lit(R)}*(1+${e}*x)`, `${lit(I)} + ${lit(R)}`), stage: 2, failure: "selection" },
            { content: math(`${rr}(1+i)^{${e + 1}} = ${ii} + ${rr}`), misconception: "TIMING_EXTRA_PERIOD", why: "One factor too many.", probe: f(`${lit(R)}*(1+x)**${e + 1}`, `${lit(I)} + ${lit(R)}`), stage: 1, failure: "application" },
          ],
          reference: { values: [{ label: "i", expr: `((${lit(I)} + ${lit(R)})/${lit(R)})**(1/${e}) - 1` }], description: "From $1 + I/R = (1+i)^{n-k+1}$, solved directly." },
          steps: [
            { concept: "loan.interest-principal-split", reasoning: "The payment is the sum of its two portions." },
            { concept: "loan.principal-structure", reasoning: `The principal portion of payment ${k} is $Pv^{${e}}$.` },
            { concept: "loan.unknown-variable", reasoning: "Equate the two descriptions of the payment: one equation in $i$." },
          ],
          conditions,
          relationship: "$R_k = (I_k + R_k)v^{n-k+1}$",
          transfer,
          itemFormat: "equation-selection",
          presentation: ["unknown-rate", "hidden-structure"],
          features: { unfamiliar: true },
          params: { i, n, k, variant },
        });
      }
      const j = rng.int(2, 5);
      const k = j + rng.int(3, 7);
      const A = Number(rows[j - 1].principal.toFixed(2));
      const B = Number(rows[k - 1].principal.toFixed(2));
      const d = k - j;
      const aa = mamt(A);
      const bb = mamt(B);
      return conceptQuestion({
        stem: `A loan is repaid by level annual payments made at the end of each year. The principal portion of the ${ord(j)} payment is ${amt(A)} and that of the ${ord(k)} payment is ${amt(B)}.\n\nDetermine which of the following equations the annual effective interest rate $i$ satisfies.`,
        correct: { content: math(`${aa}(1+i)^{${d}} = ${bb}`), why: `Principal portions grow by $1+i$ per payment, and payments ${j} and ${k} are ${d} apart.`, probe: `${lit(A)}*(1+x)**${d} - ${lit(B)}` },
        distractors: [
          { content: math(`${aa}(1+i)^{${d + 1}} = ${bb}`), misconception: "SEQ_TERM_COUNT", why: `Payments ${j} through ${k} number ${d + 1}, but they are ${d} periods apart.`, probe: `${lit(A)}*(1+x)**${d + 1} - ${lit(B)}`, stage: 1, failure: "application" },
          { content: math(`${bb}(1+i)^{${d}} = ${aa}`), misconception: "ALG_INVERTED_RATIO", why: "Later principal portions are larger, so the earlier one grows into the later one.", probe: `${lit(B)}*(1+x)**${d} - ${lit(A)}`, stage: 2, failure: "application" },
          { content: math(`${aa}(1+${d}i) = ${bb}`), misconception: "SEQ_GEOMETRIC_AS_ARITHMETIC", why: "The growth is geometric: each portion is $1+i$ times the previous one.", probe: `${lit(A)}*(1+${d}*x) - ${lit(B)}`, stage: 1, failure: "selection" },
          { content: math(`${aa}(1+i)^{${d - 1}} = ${bb}`), misconception: "TIMING_MISSING_PERIOD", why: `${d} intervals separate the payments.`, probe: `${lit(A)}*(1+x)**${d - 1} - ${lit(B)}`, stage: 1, failure: "application" },
        ],
        reference: { values: [{ label: "i", expr: `(${lit(B)}/${lit(A)})**(1/${d}) - 1` }], description: "From the ratio of the principal portions, solved directly." },
        steps: [
          { concept: "loan.principal-structure", reasoning: "Principal portions are $Pv^{n-t+1}$, so consecutive ones differ by the factor $1+i$." },
          { concept: "loan.amortization-schedule", reasoning: `Between payments ${j} and ${k} there are ${d} such factors.` },
          { concept: "loan.unknown-variable", reasoning: "Neither $n$ nor $P$ is needed: the ratio isolates $i$." },
        ],
        conditions,
        relationship: "$R_k = R_j(1+i)^{k-j}$",
        transfer,
        itemFormat: "equation-selection",
        presentation: ["unknown-rate", "irrelevant-info"],
        features: { unfamiliar: true },
        params: { i, j, k, variant },
      });
    }
    // Level 3: the term is unknown, given one principal portion, the loan and the rate.
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const n = rng.int(10, 25);
    const L = gridAmount(rng, 10000, 80000, 1000);
    const P = L / an(n, i);
    const first = variant === 0;
    const R = Number((first ? P * v(i, n) : P * v(i, 1)).toFixed(2));
    const rr = mamt(R);
    const ll = mamt(L);
    const sx = (e: string) => `(((1+${lit(i)})**(${e})-1)/${lit(i)})`;
    const ax = (e: string) => `((1-(1+${lit(i)})**(-(${e})))/${lit(i)})`;
    const g = onePlusLit(i);
    const refN = first ? `log(1 + ${lit(L)}*${lit(i)}/${lit(R)})/log(${g})` : `-log(1 - ${lit(L)}*${lit(i)}/(${lit(R)}*${g}))/log(${g})`;
    const steps = [
      { concept: "loan.principal-structure", reasoning: first ? "The principal portions are $R_1, R_1(1+i), \\ldots, R_1(1+i)^{n-1}$." : "The last payment repays $R_n = Pv$, so $P = R_n(1+i)$." },
      { concept: "loan.amortization-schedule", reasoning: first ? "They repay the whole loan, so their sum is $L$: $R_1s_{\\overline{n}|} = L$." : "So the loan is $Pa_{\\overline{n}|} = R_n(1+i)a_{\\overline{n}|} = R_n\\ddot{a}_{\\overline{n}|}$." },
      { concept: "loan.unknown-variable", reasoning: "One equation in the unknown term $n$." },
    ];
    const distractors: ConceptOption[] = first
      ? [
          { content: math(`${rr}\\,a_{\\overline{n}|} = ${ll}`), misconception: "FORMULA_AV_FOR_PV", why: "The principal portions grow, so they add to an accumulated value, not a present value.", probe: `${lit(R)}*${ax("x")} - ${lit(L)}`, stage: 1, failure: "selection" },
          { content: math(`n \\times ${rr} = ${ll}`), misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The principal portions are not all equal to the first.", probe: `x*${lit(R)} - ${lit(L)}`, stage: 0, failure: "selection" },
          { content: math(`${rr}\\,s_{\\overline{n+1}|} = ${ll}`), misconception: "SEQ_TERM_COUNT", why: "There are $n$ principal portions, one per payment.", probe: `${lit(R)}*${sx("x+1")} - ${lit(L)}`, stage: 1, failure: "application" },
          { content: math(`${rr}\\,\\ddot{s}_{\\overline{n}|} = ${ll}`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The sum is $R_1(1 + (1+i) + \\cdots + (1+i)^{n-1}) = R_1s_{\\overline{n}|}$, with no extra factor.", probe: `${lit(R)}*${sx("x")}*${g} - ${lit(L)}`, stage: 1, failure: "application" },
        ]
      : [
          { content: math(`${rr}\\,a_{\\overline{n}|} = ${ll}`), misconception: "TIMING_DUE_AS_IMMEDIATE", why: "The payment is $R_n(1+i)$, not $R_n$.", probe: `${lit(R)}*${ax("x")} - ${lit(L)}`, stage: 0, failure: "application" },
          { content: math(`n \\times ${rr} = ${ll}`), misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The principal portions are not all equal to the last.", probe: `x*${lit(R)} - ${lit(L)}`, stage: 1, failure: "selection" },
          { content: math(`${rr}\\,s_{\\overline{n}|} = ${ll}`), misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "$s_{\\overline{n}|}$ sums principal portions growing from the first; the last is the largest.", probe: `${lit(R)}*${sx("x")} - ${lit(L)}`, stage: 1, failure: "interpretation" },
          { content: math(`${rr}\\,\\ddot{a}_{\\overline{n+1}|} = ${ll}`), misconception: "SEQ_TERM_COUNT", why: "There are $n$ payments.", probe: `${lit(R)}*${ax("x+1")}*${g} - ${lit(L)}`, stage: 2, failure: "application" },
          { content: math(`${rr}\\,v\\,a_{\\overline{n}|} = ${ll}`), misconception: "CONC_MOVED_WRONG_WAY", why: "The payment is larger than its last principal portion, so $R_n$ must be accumulated, not discounted.", probe: `${lit(R)}*${ax("x")}/${g} - ${lit(L)}`, stage: 0, failure: "application" },
        ];
    return conceptQuestion({
      stem: `A loan of ${amt(L)} is repaid by level annual payments made at the end of each year at an annual effective interest rate of ${pc(i)}. The principal portion of the ${first ? "first" : "last"} payment is ${amt(R)}. Annuity symbols are at ${pc(i)}.\n\nDetermine which of the following equations the number of payments $n$ satisfies.`,
      correct: first
        ? { content: math(`${rr}\\,s_{\\overline{n}|} = ${ll}`), why: "The principal portions grow by $1+i$ from $R_1$ and add up to the loan.", probe: `${lit(R)}*${sx("x")} - ${lit(L)}` }
        : { content: math(`${rr}\\,\\ddot{a}_{\\overline{n}|} = ${ll}`), why: "$P = R_n(1+i)$ and $L = Pa_{\\overline{n}|} = R_n\\ddot{a}_{\\overline{n}|}$.", probe: `${lit(R)}*${ax("x")}*${g} - ${lit(L)}` },
      distractors,
      reference: { values: [{ label: "n", expr: refN }], description: "The term solved in closed form from the stated principal portion." },
      steps,
      conditions,
      relationship: first ? "$L = \\sum_t R_t = R_1s_{\\overline{n}|}$" : "$L = Pa_{\\overline{n}|} = R_n\\ddot{a}_{\\overline{n}|}$",
      transfer,
      itemFormat: "equation-selection",
      presentation: ["unknown-time", "hidden-structure"],
      modelingDecisions: 1,
      features: { unfamiliar: true },
      params: { L, i, n, R, variant },
    });
  },
});

const uvDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-loan-uv-diagnosis",
  family: "con-loan-uv",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.payment_components"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "equation_construction"],
  reasoning: ["validation", "translation", "algebra"],
  soaConcept: "Diagnosing the error in a proposed solution for an unknown loan payment, term or rate.",
  variants: 2,
  generate(rng, level, variant) {
    const transfer = {
      principle: "Rebuild the equation of value from the payment dates; then the unknown follows.",
      unusual: "You judge a worked solution instead of producing one.",
      misread: level === 1 ? "A loan amount is a value at time 0." : "Exponents count payment intervals, not payments.",
    };
    if (level === 1) {
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const L = gridAmount(rng, 10000, 60000, 1000);
      const ll = mamt(L);
      if (variant === 0) {
        const n = rng.int(10, 20);
        const m = rng.int(2, 4);
        const trueP = `${lit(L)}/(${Array.from({ length: n }, (_, t) => vPow(i, m + 1 + t)).join(" + ")})`;
        const a = aExpr(n, i);
        const proposed = L / an(n, i);
        return conceptQuestion({
          stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments, the first made at the end of year ${m + 1}. A candidate calculates the payment as\n\n$$\\frac{${ll}}{a_{\\overline{${n}|}}} = ${mamt(Number(proposed.toFixed(2)))}.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
          correct: { content: `The loan must first be accumulated to time ${m}: $${ll}(1+i)^{${m}}/a_{\\overline{${n}|}}$.`, why: `$a_{\\overline{${n}|}}$ values the payments at time ${m}, so the loan must be valued there too.`, check: { expr: `${lit(L)}*${accPow(i, m)}/${a}`, op: "=", than: trueP } },
          distractors: [
            { content: "The calculation is correct: the payment is the loan divided by $a_{\\overline{n}|}$.", misconception: "TIMING_IGNORED_DEFERRAL", why: "The deferral lets interest accrue before the first payment.", check: { expr: lit(proposed), op: "=", than: trueP }, stage: 0, failure: "recognition", conditionTrue: "Correct if the first payment were at the end of year 1." },
            { content: `The loan must be accumulated to time ${m + 1}: $${ll}(1+i)^{${m + 1}}/a_{\\overline{${n}|}}$.`, misconception: "TIMING_DEFERRAL_OFF_BY_ONE", why: `$a_{\\overline{${n}|}}$ values the payments one year before the first, at time ${m}.`, check: { expr: `${lit(L)}*${accPow(i, m + 1)}/${a}`, op: "=", than: trueP }, stage: 1, failure: "application" },
            { content: `The loan must be discounted: $${ll}\\,v^{${m}}/a_{\\overline{${n}|}}$.`, misconception: "CONC_MOVED_WRONG_WAY", why: "The loan is moved later, to time $m$, so it is accumulated.", check: { expr: `${lit(L)}*${vPow(i, m)}/${a}`, op: "=", than: trueP }, stage: 1, failure: "application" },
            { content: `The annuity should cover ${n + m} years: $${ll}/a_{\\overline{${n + m}|}}$.`, misconception: "SEQ_TERM_COUNT", why: "No payments are made during the deferral.", check: { expr: `${lit(L)}/${aExpr(n + m, i)}`, op: "=", than: trueP }, stage: 0, failure: "interpretation" },
            { content: `The annuity should be due: $${ll}(1+i)^{${m}}/\\ddot{a}_{\\overline{${n}|}}$.`, misconception: "TIMING_IMMEDIATE_AS_DUE", why: `Valued at time ${m}, the first payment is a year away.`, check: { expr: `${lit(L)}*${accPow(i, m)}/(${a}*${onePlusLit(i)})`, op: "=", than: trueP }, stage: 1, failure: "application" },
          ],
          reference: { description: "The payment from the loan and the discount factors of the actual payment dates; each option's correction is compared with it." },
          steps: [
            { concept: "loan.unknown-variable", reasoning: "The payment is fixed by one equation of value at a single date." },
            { concept: "loan.balance-timing", reasoning: `$a_{\\overline{${n}|}}$ places the payments' value at time ${m}; the loan has grown to $L(1+i)^{${m}}$ by then.` },
          ],
          conditions: [`First payment at the end of year ${m + 1}.`, "A constant annual effective rate of interest."],
          relationship: "$P = \\dfrac{L(1+i)^m}{a_{\\overline{n}|}}$",
          transfer,
          itemFormat: "error-diagnosis",
          presentation: ["deferred"],
          params: { L, i, n, m, variant },
        });
      }
      const X = gridAmount(rng, Math.ceil((L * i * 1.4) / 50) * 50, Math.ceil((L * i * 3) / 50) * 50, 50);
      const g = Math.log(1 + i);
      const nTrue = -Math.log(1 - (L * i) / X) / g;
      const nS = Math.log(1 + (L * i) / X) / g;
      const nDue = -Math.log(1 - (L * i) / (X * (1 + i))) / g;
      const nPlain = L / X;
      const nLevel = L / (X - i * L);
      const holds = (nn: number) => `${lit(X)}*${aExpr(nn, i)}`;
      return conceptQuestion({
        stem: `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by level payments of ${amt(X)} at the end of each year. A candidate finds the number of payments $n$ by solving\n\n$$${mamt(X)}\\,s_{\\overline{n}|} = ${ll},$$\n\nobtaining $n = ${nS.toFixed(2)}$. Which of the following correctly describes the candidate's calculation?`,
        correct: { content: `The loan is a value at time 0, so $${mamt(X)}\\,a_{\\overline{n}|} = ${ll}$ must be solved instead.`, why: `The loan equals the present value of the payments: $n = ${nTrue.toFixed(2)}$.`, check: { expr: holds(nTrue), op: "=", than: lit(L) } },
        distractors: [
          { content: "The calculation is correct: the payments accumulate to the loan.", misconception: "FORMULA_AV_FOR_PV", why: "Accumulated payments are compared with the loan at time $n$, where the loan has also grown.", check: { expr: holds(nS), op: "=", than: lit(L) }, stage: 1, failure: "selection" },
          { content: `The payments are due at the start of each year: solve $${mamt(X)}\\,\\ddot{a}_{\\overline{n}|} = ${ll}$.`, misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The payments are made at the end of each year.", check: { expr: holds(nDue), op: "=", than: lit(L) }, stage: 1, failure: "application" },
          { content: `Interest is irrelevant to the count: $n = ${ll}/${mamt(X)}$.`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Part of each payment is interest, so more payments are needed than the loan divided by the payment.", check: { expr: holds(nPlain), op: "=", than: lit(L) }, stage: 0, failure: "selection" },
          { content: `Each payment repays ${amt(X)} less first-year interest: $n = ${ll}/(${mamt(X)} - ${mpc(i)} \\times ${ll})$.`, misconception: "CONC_LOAN_PRINCIPAL_LEVEL", why: "The principal repaid grows each year, so fewer payments are needed than this.", check: { expr: holds(nLevel), op: "=", than: lit(L) }, stage: 0, failure: "selection" },
        ],
        reference: { description: "Each option's term is substituted into $Xa_{\\overline{n}|}$ and compared with the loan." },
        steps: [
          { concept: "loan.unknown-variable", reasoning: "The term is the root of one equation of value." },
          { concept: "loan.balance-prospective-retrospective", reasoning: "At time 0 the loan equals the present value of all the payments." },
        ],
        conditions: LEVEL_CONDITIONS,
        relationship: "$L = Xa_{\\overline{n}|} \\Rightarrow n = -\\ln(1 - Li/X)/\\ln(1+i)$",
        transfer,
        itemFormat: "error-diagnosis",
        presentation: ["unknown-time"],
        params: { L, i, X, variant },
      });
    }
    const ln = drawLoan(rng, 12, 25);
    const { i, n } = ln;
    const rows = schedule(ln);
    const steps = [
      { concept: "loan.principal-structure", reasoning: "Principal portions are $Pv^{n-t+1}$; consecutive ones differ by $1+i$." },
      { concept: "loan.interest-principal-split", reasoning: "A payment is its interest plus its principal." },
      { concept: "loan.unknown-variable", reasoning: "The stated facts give one equation in $i$." },
    ];
    const common = { steps, conditions: LEVEL_CONDITIONS, transfer, itemFormat: "error-diagnosis" as const, presentation: ["unknown-rate", "work-backwards"] as ("unknown-rate" | "work-backwards")[], features: { unfamiliar: true } };
    const iL = lit(i);
    if (variant === 0) {
      const k = drawUntil(() => rng.int(3, n - 3), (x) => new Set([x, n - x, n - x + 1, n - x + 2]).size === 4);
      const e = n - k + 1;
      const I = rows[k - 1].interest;
      const R = rows[k - 1].principal;
      const ratio = `(${lit(I)} + ${lit(R)})/${lit(R)}`;
      const wrong = Math.pow((I + R) / R, 1 / (n - k)) - 1;
      return conceptQuestion({
        ...common,
        stem: `A loan is repaid by ${n} level annual payments made at the end of each year. The ${ord(k)} payment consists of ${amt(Number(I.toFixed(2)))} of interest and ${amt(Number(R.toFixed(2)))} of principal. A candidate finds the annual effective interest rate from\n\n$$(1+i)^{${n - k}} = \\frac{${mamt(Number((I + R).toFixed(2)))}}{${mamt(Number(R.toFixed(2)))}},$$\n\nobtaining $i = ${(wrong * 100).toFixed(3)}\\%$. Which of the following correctly describes the candidate's calculation?`,
        correct: { content: `The exponent should be ${e}, the number of payments from the ${ord(k)} to the last.`, why: `$R_{${k}} = Pv^{${e}}$, so $(1+i)^{${e}} = P/R_{${k}}$.`, check: { expr: `(${ratio})**(1/${e}) - 1`, op: "=", than: iL } },
        distractors: [
          { content: "The calculation is correct: the exponent counts the payments after this one.", misconception: "TIMING_BALANCE_INDEX", why: `$(1+i)^{${n - k}}$ is $P/R_{${k + 1}}$, the ratio for the next payment.`, check: { expr: lit(wrong), op: "=", than: iL }, stage: 0, failure: "application" },
          { content: `The exponent should be ${e + 1}, allowing one more period of discounting.`, misconception: "TIMING_EXTRA_PERIOD", why: "One factor too many.", check: { expr: `(${ratio})**(1/${e + 1}) - 1`, op: "=", than: iL }, stage: 0, failure: "application" },
          { content: `The exponent should be ${k}, the number of payments made so far.`, misconception: "CONC_LOAN_SCHEDULE_REVERSED", why: "The exponent counts payments to the end of the term, not from the start.", check: { expr: `(${ratio})**(1/${k}) - 1`, op: "=", than: iL }, stage: 0, failure: "interpretation" },
          { content: `The ratio should be the payment over its interest portion, with exponent ${n - k}.`, misconception: "VAR_INTEREST_FOR_PRINCIPAL", why: "It is the principal portion that equals $Pv^{n-k+1}$.", check: { expr: `((${lit(I)} + ${lit(R)})/${lit(I)})**(1/${n - k}) - 1`, op: "=", than: iL }, stage: 1, failure: "interpretation" },
          { content: `Interest grows linearly: $i = \\text{interest}/(${e} \\times \\text{principal})$.`, misconception: "MODEL_COMPOUND_AS_SIMPLE", why: "Discounting compounds, so the relationship is a power, not a product.", check: { expr: `${lit(I)}/(${e}*${lit(R)})`, op: "=", than: iL }, stage: 2, failure: "selection" },
        ],
        reference: { description: "Each option's implied rate is compared with the loan's actual rate." },
        relationship: "$\\dfrac{I_k + R_k}{R_k} = (1+i)^{n-k+1}$",
        params: { i, n, k, variant },
      });
    }
    const j = rng.int(2, 5);
    const k = j + rng.int(3, 7);
    const A = rows[j - 1].principal;
    const B = rows[k - 1].principal;
    const d = k - j;
    const ratio = `${lit(B)}/${lit(A)}`;
    const wrong = Math.pow(B / A, 1 / (d + 1)) - 1;
    return conceptQuestion({
      ...common,
      stem: `A loan is repaid by level annual payments made at the end of each year. The principal portion of the ${ord(j)} payment is ${amt(Number(A.toFixed(2)))} and that of the ${ord(k)} payment is ${amt(Number(B.toFixed(2)))}. A candidate counts the payments from the ${ord(j)} to the ${ord(k)} inclusive and calculates\n\n$$i = \\left(\\frac{${mamt(Number(B.toFixed(2)))}}{${mamt(Number(A.toFixed(2)))}}\\right)^{1/${d + 1}} - 1 = ${(wrong * 100).toFixed(3)}\\%.$$\n\nWhich of the following correctly describes the candidate's calculation?`,
      correct: { content: `The payments are ${d} intervals apart, so the root should be $1/${d}$.`, why: `$R_{${k}} = R_{${j}}(1+i)^{${d}}$: one factor of $1+i$ per interval.`, check: { expr: `(${ratio})**(1/${d}) - 1`, op: "=", than: iL } },
      distractors: [
        { content: "The calculation is correct.", misconception: "SEQ_TERM_COUNT", why: `${d + 1} payments span only ${d} intervals.`, check: { expr: lit(wrong), op: "=", than: iL }, stage: 1, failure: "application" },
        { content: `The ratio should be inverted, with root $1/${d}$.`, misconception: "ALG_INVERTED_RATIO", why: "Later principal portions are larger, so the ratio of later to earlier exceeds 1.", check: { expr: `(${lit(A)}/${lit(B)})**(1/${d}) - 1`, op: "=", than: iL }, stage: 2, failure: "application" },
        { content: `The growth is linear: $i = (${mamt(Number(B.toFixed(2)))} - ${mamt(Number(A.toFixed(2)))})/(${d} \\times ${mamt(Number(A.toFixed(2)))})$.`, misconception: "SEQ_GEOMETRIC_AS_ARITHMETIC", why: "The principal portions grow geometrically.", check: { expr: `(${lit(B)} - ${lit(A)})/(${d}*${lit(A)})`, op: "=", than: iL }, stage: 0, failure: "selection" },
        { content: `The root should be $1/${d - 1}$.`, misconception: "TIMING_MISSING_PERIOD", why: `There are ${d} intervals between the payments.`, check: { expr: `(${ratio})**(1/${d - 1}) - 1`, op: "=", than: iL }, stage: 1, failure: "application" },
        { content: `The ratio should be raised to the power ${d}, not rooted.`, misconception: "ALG_ROOT_ERROR", why: "Solving $(1+i)^{d} = B/A$ takes the $d$-th root.", check: { expr: `(${ratio})**${d} - 1`, op: "=", than: iL }, stage: 2, failure: "application" },
      ],
      reference: { description: "Each option's implied rate is compared with the loan's actual rate." },
      relationship: "$R_k = R_j(1+i)^{k-j}$",
      params: { i, j, k, variant },
    });
  },
});

// ================================================================ LOANS.refinancing

interface Refi {
  ln: Loan;
  k: number;
  /** Remaining payments under the original loan. */
  r: number;
  j: number;
  /** Balance just after payment k at the original rate. */
  B: number;
  /** Retrospective balance expression. */
  BE: string;
}

function drawRefi(rng: Rng, lower = true): Refi {
  const i = gridRate(rng, 0.05, 0.09, 0.005);
  const n = rng.int(15, 30);
  const L = gridAmount(rng, 20000, 90000, 1000);
  const P = gridAmount(rng, 0, 0, 1) + L / an(n, i);
  const ln: Loan = { L, i, n, P };
  const k = rng.int(4, n - 6);
  const delta = gridRate(rng, 0.01, 0.025, 0.005);
  const j = lower ? i - delta : i + delta;
  return { ln, k, r: n - k, j, B: balance(ln, k), BE: retroE(ln, k) };
}

const REFI_STEPS = (extra: { concept: string; reasoning: string }[] = []) => [
  { concept: "loan.balance-prospective-retrospective", reasoning: "Just after payment $k$ the borrower owes the balance at the original rate: the value of the remaining payments at that rate." },
  { concept: "loan.refinancing", reasoning: "The new loan replaces exactly that balance and is amortized at the new rate over the new term." },
  ...extra,
];

const rfReplaced: ChoiceTemplate = conceptTemplate({
  id: "con-loan-rf-replaced",
  family: "con-loan-rf",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.outstanding_balance"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "timing"],
  reasoning: ["concept_recognition", "valuation_dates"],
  soaConcept: "What a refinancing replaces, and how the new payment is determined.",
  variants: 2,
  generate(rng, level, variant) {
    const f = drawRefi(rng);
    const { ln, k, r, j, B: _B, BE } = f;
    const { L, i, n, P: _P } = ln;
    const Pe = payE(ln);
    const transfer = {
      principle: "The old rate decides what is owed; the new rate and term decide how it is repaid.",
      unusual: level === 2 ? "The refinancing date or term is not the plain one." : "The question asks what is replaced, not a value.",
      misread: "The new rate never revalues the debt already owed.",
    };
    const scene = `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments at the end of each year.`;
    const conditions = ["Level payments at the end of each year.", "The old loan's balance is valued at the old rate; the new loan uses the new rate."];
    const relationship = "New loan $= B_k = Pa_{\\overline{n-k}|\\,i}$; new payment $= B_k / a_{\\overline{m}|\\,j}$.";
    if (level === 1 && variant === 0) {
      return conceptQuestion({
        stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances the loan at an annual effective rate of ${pc(j)} over the remaining ${r} years.\n\nWhich of the following is the amount of the new loan?`,
        correct: { content: `The present value at ${pc(i)} of the remaining payments under the original loan`, why: "That is the outstanding balance: exactly what the borrower owes when the old loan is closed.", check: { expr: prospE(ln, k), op: "=", than: BE } },
        distractors: [
          { content: `The original loan amount of ${amt(L)}`, misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: `${k} payments have already repaid part of the loan.`, check: { expr: lit(L), op: "=", than: BE }, stage: 0, failure: "selection" },
          { content: `The present value at ${pc(j)} of the remaining payments under the original loan`, misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The debt is fixed by the old loan's rate; the new rate only governs the new loan.", check: { expr: `${Pe}*${annE(r, j)}`, op: "=", than: BE }, stage: 1, failure: "selection", confusedWith: "loan.balance-sale" },
          { content: "The total of the remaining payments under the original loan", misconception: "SEQ_UNDISCOUNTED_SUM", why: "The remaining payments include future interest that will no longer be charged.", check: { expr: `${r}*${Pe}`, op: "=", than: BE }, stage: 0, failure: "application" },
          { content: `The present value at ${pc(i)} of payments ${k} through ${n} under the original loan`, misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has already been made.`, check: { expr: `${Pe}*${annE(r + 1, i)}`, op: "=", than: BE }, stage: 0, failure: "application" },
          { content: `The original loan less the ${k} payments already made`, misconception: "CONC_LOAN_RETRO_WITHOUT_INTEREST", why: "That ignores the interest included in the payments made.", check: { expr: `${lit(L)} - ${k}*${Pe}`, op: "=", than: BE }, stage: 0, failure: "selection" },
        ],
        steps: REFI_STEPS(),
        conditions,
        relationship,
        transfer,
        itemFormat: "interpretation",
        params: { L, i, n, k, j, variant },
      });
    }
    if (level === 1) {
      const Q = `(${BE}/(${Array.from({ length: r }, (_, t) => `(1+${lit(j)})**(-${t + 1})`).join(" + ")}))`;
      return conceptQuestion({
        stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances the loan at an annual effective rate of ${pc(j)} over the remaining ${r} years.\n\nWhich of the following gives the new annual payment?`,
        correct: { content: `The balance at ${pc(i)} divided by $a_{\\overline{${r}|}}$ at ${pc(j)}`, why: "The debt is valued at the old rate and repaid at the new rate over the new term.", check: { expr: `${BE}/${annE(r, j)}`, op: "=", than: Q } },
        distractors: [
          { content: `The balance at ${pc(i)} divided by $a_{\\overline{${r}|}}$ at ${pc(i)}`, misconception: "CONC_LOAN_REFI_OLD_RATE", why: "That just reproduces the old payment; the new rate must be used to amortize the new loan.", check: { expr: `${BE}/${annE(r, i)}`, op: "=", than: Q }, stage: 1, failure: "selection" },
          { content: `The original loan divided by $a_{\\overline{${n}|}}$ at ${pc(j)}`, misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced, over the remaining years.", check: { expr: `${lit(L)}/${annE(n, j)}`, op: "=", than: Q }, stage: 0, failure: "selection" },
          { content: `The balance at ${pc(i)} divided by $a_{\\overline{${n}|}}$ at ${pc(j)}`, misconception: "TIMING_REFINANCE_PERIODS", why: `Only ${r} years remain.`, check: { expr: `${BE}/${annE(n, j)}`, op: "=", than: Q }, stage: 1, failure: "application" },
          { content: `The balance at ${pc(j)} divided by $a_{\\overline{${r}|}}$ at ${pc(j)}`, misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "Revaluing the debt at the new rate also gives back the old payment.", check: { expr: `${Pe}*${annE(r, j)}/${annE(r, j)}`, op: "=", than: Q }, stage: 0, failure: "selection" },
          { content: `The balance at ${pc(i)} divided by $a_{\\overline{${r + 1}|}}$ at ${pc(j)}`, misconception: "TIMING_BALANCE_INDEX", why: `${r} payments remain after payment ${k}.`, check: { expr: `${BE}/${annE(r + 1, j)}`, op: "=", than: Q }, stage: 1, failure: "application" },
        ],
        steps: REFI_STEPS(),
        conditions,
        relationship,
        transfer,
        itemFormat: "interpretation",
        params: { L, i, n, k, j, variant },
      });
    }
    if (variant === 0) {
      const target = `(${Pe}*${annE(r, i)}*${onePlusLit(i)})`;
      return conceptQuestion({
        stem: `${scene} The ${ord(k + 1)} payment is not made. Instead, at the date it is due, the borrower refinances the whole amount owed at an annual effective rate of ${pc(j)}.\n\nWhich of the following is the amount of the new loan?`,
        correct: { content: `The balance just after the ${ord(k)} payment plus one year's interest at ${pc(i)}`, why: `The missed payment is still owed: the debt is $B_{${k}}(1+i) = P\\ddot{a}_{\\overline{${r}|}}$ at ${pc(i)}.`, check: { expr: `${BE}*${onePlusLit(i)}`, op: "=", than: target } },
        distractors: [
          { content: `The balance just after the ${ord(k)} payment, with no interest added`, misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "A year's interest has accrued since that payment.", check: { expr: BE, op: "=", than: target }, stage: 2, failure: "application" },
          { content: `The balance just after the ${ord(k + 1)} payment under the original schedule`, misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k + 1} was not made, so it has not reduced the balance.`, check: { expr: retroE(ln, k + 1), op: "=", than: target }, stage: 2, failure: "interpretation" },
          { content: `The present value at ${pc(j)} of payments ${k + 1} through ${n}, at their due date`, misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The amount owed is valued at the old loan's rate.", check: { expr: `${Pe}*${annE(r, j)}*(1+${lit(j)})`, op: "=", than: target }, stage: 1, failure: "selection" },
          { content: `The original loan amount of ${amt(L)}`, misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: `${k} payments have repaid part of the loan.`, check: { expr: lit(L), op: "=", than: target }, stage: 0, failure: "selection" },
          { content: `The total of payments ${k + 1} through ${n}`, misconception: "SEQ_UNDISCOUNTED_SUM", why: "Future interest is not owed at the refinancing date.", check: { expr: `${r}*${Pe}`, op: "=", than: target }, stage: 0, failure: "application" },
        ],
        steps: REFI_STEPS([{ concept: "loan.balance-timing", reasoning: `Just before payment ${k + 1} the balance is $B_{${k}}(1+i)$, which includes the missed payment.` }]),
        conditions,
        relationship: "Amount owed just before payment $k+1$: $B_k(1+i) = P\\ddot{a}_{\\overline{n-k}|\\,i}$.",
        transfer,
        itemFormat: "interpretation",
        presentation: ["valuation-date"],
        features: { multipleValuationDates: true },
        params: { L, i, n, k, j, variant },
      });
    }
    const ext = rng.int(3, 8);
    const m = r + ext;
    const Q = `(${BE}/(${Array.from({ length: m }, (_, t) => `(1+${lit(j)})**(-${t + 1})`).join(" + ")}))`;
    return conceptQuestion({
      stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances at an annual effective rate of ${pc(j)} and extends the term so that the new loan is repaid by ${m} level annual payments.\n\nWhich of the following gives the new annual payment?`,
      correct: { content: `The balance at ${pc(i)} divided by $a_{\\overline{${m}|}}$ at ${pc(j)}`, why: `The debt is valued at the old rate and spread over the ${m} new payments at the new rate.`, check: { expr: `${BE}/${annE(m, j)}`, op: "=", than: Q } },
      distractors: [
        { content: `The balance at ${pc(i)} divided by $a_{\\overline{${r}|}}$ at ${pc(j)}`, misconception: "TRANS_IGNORED_CONDITION", why: `The term is extended to ${m} payments.`, check: { expr: `${BE}/${annE(r, j)}`, op: "=", than: Q }, stage: 1, failure: "application" },
        { content: `The balance at ${pc(i)} divided by $a_{\\overline{${n + ext}|}}$ at ${pc(j)}`, misconception: "TIMING_REFINANCE_PERIODS", why: `The ${k} payments already made do not belong to the new loan.`, check: { expr: `${BE}/${annE(n + ext, j)}`, op: "=", than: Q }, stage: 1, failure: "application" },
        { content: `The original loan divided by $a_{\\overline{${m}|}}$ at ${pc(j)}`, misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced.", check: { expr: `${lit(L)}/${annE(m, j)}`, op: "=", than: Q }, stage: 0, failure: "selection" },
        { content: `The balance at ${pc(i)} divided by $a_{\\overline{${m}|}}$ at ${pc(i)}`, misconception: "CONC_LOAN_REFI_OLD_RATE", why: "The new loan is amortized at the new rate.", check: { expr: `${BE}/${annE(m, i)}`, op: "=", than: Q }, stage: 1, failure: "selection" },
      ],
      steps: REFI_STEPS([{ concept: "loan.unknown-variable", reasoning: `The new payment solves $Qa_{\\overline{${m}|}\\,j} = B_{${k}}$.` }]),
      conditions,
      relationship: "New payment $= B_k / a_{\\overline{m}|\\,j}$ for a new term of $m$ payments.",
      transfer,
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { L, i, n, k, j, m, variant },
    });
  },
});

const rfEquation: ChoiceTemplate = conceptTemplate({
  id: "con-loan-rf-equation",
  family: "con-loan-rf",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.unknown_variables", "LOANS.outstanding_balance"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["translation", "valuation_dates", "formula_selection"],
  soaConcept: "The equation of value defining the new payment, term or rate in a refinancing.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.05, 0.09, 0.005);
    const n = rng.int(15, 30);
    const P = gridAmount(rng, 800, 4000, 50);
    const k = rng.int(4, n - 6);
    const r = n - k;
    const j = i - gridRate(rng, 0.01, 0.025, 0.005);
    const ln: Loan = { L: P * an(n, i), i, n, P };
    const B = balance(ln, k);
    const pp = mamt(P);
    const ai = (m: number | string) => aAt(m, i);
    const aj = (m: number | string) => aAt(m, j);
    const axj = (m: number | string, rate: number | string) => `((1-(1+${typeof rate === "number" ? lit(rate) : rate})**(-(${m})))/${typeof rate === "number" ? lit(rate) : rate})`;
    const scene = `A loan is repaid by ${n} annual payments of ${amt(P)} at the end of each year at an annual effective interest rate of ${pc(i)}.`;
    const transfer = {
      principle: "Old rate for what is owed, new rate and new term for the new loan, one valuation date for both sides.",
      unusual: level === 3 ? "The refinancing date or the unknown is not the plain one." : "The options differ in which rate and term go where.",
      misread: "Refinancing does not change what is owed; it changes how it is repaid.",
    };
    const conditions = ["Level payments at the end of each year.", "The old balance at the old rate; the new loan at the new rate."];
    const Bref = `${retroE(ln, k)}`;
    if (level === 1 && variant === 0) {
      return conceptQuestion({
        stem: `${scene} Just after the ${ord(k)} payment, the loan is refinanced at an annual effective rate of ${pc(j)}, with level payments $Q$ over the remaining ${r} years.\n\nDetermine which of the following equations $Q$ satisfies.`,
        correct: { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(r)}`), why: "The new loan is the old balance at the old rate, repaid at the new rate.", probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r, i)}` },
        distractors: [
          { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(n)}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "The right side is the original loan; only the balance is refinanced.", probe: `x*${axj(r, j)} - ${lit(P)}*${axj(n, i)}`, stage: 0, failure: "selection" },
          { content: math(`Q\\,${aj(r)} = ${pp}\\,${aj(r)}`), misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The debt is valued at the old rate; at the new rate this just returns the old payment.", probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r, j)}`, stage: 0, failure: "selection" },
          { content: math(`Q\\,${aj(n)} = ${pp}\\,${ai(r)}`), misconception: "TIMING_REFINANCE_PERIODS", why: `Only ${r} payments remain.`, probe: `x*${axj(n, j)} - ${lit(P)}*${axj(r, i)}`, stage: 1, failure: "application" },
          { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(r + 1)}`), misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has been made.`, probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r + 1, i)}`, stage: 0, failure: "application" },
          { content: math(`Q\\,${aj(r)} = ${r} \\times ${pp}`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The remaining payments include future interest at the old rate.", probe: `x*${axj(r, j)} - ${r}*${lit(P)}`, stage: 0, failure: "application" },
        ],
        reference: { values: [{ label: "Q", expr: `${Bref}/(${Array.from({ length: r }, (_, t) => `(1+${lit(j)})**(-${t + 1})`).join(" + ")})` }], description: "Retrospective balance divided by the new-rate discount factors of the remaining dates." },
        steps: REFI_STEPS(),
        conditions,
        relationship: "$Qa_{\\overline{n-k}|\\,j} = Pa_{\\overline{n-k}|\\,i}$",
        transfer,
        itemFormat: "equation-selection",
        params: { i, n, P, k, j, variant },
      });
    }
    if (level === 1) {
      const target = -Math.log(1 - (B * j) / P) / Math.log(1 + j);
      return conceptQuestion({
        stem: `${scene} Just after the ${ord(k)} payment, the loan is refinanced at an annual effective rate of ${pc(j)}. The borrower keeps paying ${amt(P)} a year, so the loan is repaid sooner.\n\nDetermine which of the following equations the number of remaining payments $m$ satisfies.`,
        correct: { content: math(`${pp}\\,${aj("m")} = ${pp}\\,${ai(r)}`), why: "The old balance, valued at the old rate, is repaid by payments of the same size at the new rate.", probe: `${lit(P)}*${axj("x", j)} - ${lit(P)}*${axj(r, i)}` },
        distractors: [
          { content: math(`${pp}\\,${ai("m")} = ${pp}\\,${aj(r)}`), misconception: "ALLOC_SWAPPED", why: "The two rates are attached to the wrong loans.", probe: `${lit(P)}*${axj("x", i)} - ${lit(P)}*${axj(r, j)}`, stage: 1, failure: "selection" },
          { content: math(`${pp}\\,${aj("m")} = ${pp}\\,${ai(n)}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced.", probe: `${lit(P)}*${axj("x", j)} - ${lit(P)}*${axj(n, i)}`, stage: 0, failure: "selection" },
          { content: math(`${pp}\\,${aj("m")} = ${pp}\\,${ai(r + 1)}`), misconception: "TIMING_BALANCE_INDEX", why: `Payment ${k} has been made.`, probe: `${lit(P)}*${axj("x", j)} - ${lit(P)}*${axj(r + 1, i)}`, stage: 0, failure: "application" },
          { content: math(`${pp}\\,s_{\\overline{m}|\\,${j}} = ${pp}\\,${ai(r)}`), misconception: "FORMULA_AV_FOR_PV", why: "The new payments are valued at the refinancing date, so a present value is needed.", probe: `${lit(P)}*((1+${lit(j)})**x-1)/${lit(j)} - ${lit(P)}*${axj(r, i)}`, stage: 1, failure: "selection" },
          { content: math(`${pp}\\,a_{\\overline{${k}+m|}\\,${j}} = ${pp}\\,${ai(n)}`), misconception: "TIMING_REFINANCE_PERIODS", why: "The payments already made were at the old rate; they cannot be revalued at the new one.", probe: `${lit(P)}*${axj(`${k}+x`, j)} - ${lit(P)}*${axj(n, i)}`, stage: 1, failure: "application" },
        ],
        reference: { values: [{ label: "m", expr: `-log(1 - ${Bref}*${lit(j)}/${lit(P)})/log(1+${lit(j)})` }], description: `The remaining term solved in closed form: $m \\approx ${target.toFixed(3)}$.` },
        steps: REFI_STEPS([{ concept: "loan.unknown-variable", reasoning: "With the payment fixed, the new term is the root of one equation." }]),
        conditions,
        relationship: "$Pa_{\\overline{m}|\\,j} = Pa_{\\overline{n-k}|\\,i}$",
        transfer,
        itemFormat: "equation-selection",
        presentation: ["unknown-time"],
        params: { i, n, P, k, j, variant },
      });
    }
    if (level === 2) {
      const F = Math.round((B * 0.02 * rng.int(1, 3)) / 50) * 50;
      const ff = mamt(F);
      const added = variant === 0;
      const Q = `((${Bref}${added ? ` + ${lit(F)}` : ""})/(${Array.from({ length: r }, (_, t) => `(1+${lit(j)})**(-${t + 1})`).join(" + ")}))`;
      const rhs = (extra: string) => `${pp}\\,${ai(r)}${extra}`;
      const pr = (lhsAnn: string, rhsVal: string) => `x*${lhsAnn} - (${rhsVal})`;
      const Bx = `${lit(P)}*${axj(r, i)}`;
      const options: ConceptOption[] = added
        ? [
            { content: math(`Q\\,${aj(r)} = ${rhs("")}`), misconception: "TRANS_IGNORED_CONDITION", why: "The fee is added to the new loan, so it must be repaid too.", probe: pr(axj(r, j), Bx), stage: 1, failure: "application" },
            { content: math(`Q\\,${aj(r)} + ${ff} = ${rhs("")}`), misconception: "ALG_SIGN_ERROR", why: "The fee increases what is borrowed; it belongs with the balance.", probe: pr(axj(r, j), `${Bx} - ${lit(F)}`), stage: 1, failure: "application" },
            { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(n)} + ${ff}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced.", probe: pr(axj(r, j), `${lit(P)}*${axj(n, i)} + ${lit(F)}`), stage: 0, failure: "selection" },
            { content: math(`Q\\,${aj(r)} = ${pp}\\,${aj(r)} + ${ff}`), misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The debt is valued at the old rate.", probe: pr(axj(r, j), `${lit(P)}*${axj(r, j)} + ${lit(F)}`), stage: 0, failure: "selection" },
            { content: math(`Q\\,${aj(r)} = ${rhs("")} + ${ff}(1+${j})^{${r}}`), misconception: "TIMING_VALUATION_DATE", why: "The fee is charged at the refinancing date, the same date as the balance.", probe: pr(axj(r, j), `${Bx} + ${lit(F)}*(1+${lit(j)})**${r}`), stage: 2, failure: "application" },
          ]
        : [
            { content: math(`Q\\,${aj(r)} = ${rhs(` + ${ff}`)}`), misconception: "TRANS_IRRELEVANT_INFO", why: "The fee is paid in cash, so it is not borrowed.", probe: pr(axj(r, j), `${Bx} + ${lit(F)}`), stage: 2, failure: "interpretation" },
            { content: math(`Q\\,${aj(r)} = ${rhs(` - ${ff}`)}`), misconception: "ALG_SIGN_ERROR", why: "Paying a fee does not reduce the debt.", probe: pr(axj(r, j), `${Bx} - ${lit(F)}`), stage: 2, failure: "application" },
            { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(n)}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced.", probe: pr(axj(r, j), `${lit(P)}*${axj(n, i)}`), stage: 0, failure: "selection" },
            { content: math(`Q\\,${aj(r)} = ${pp}\\,${aj(r)}`), misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The debt is valued at the old rate.", probe: pr(axj(r, j), `${lit(P)}*${axj(r, j)}`), stage: 0, failure: "selection" },
            { content: math(`Q\\,${aj(n)} = ${rhs("")}`), misconception: "TIMING_REFINANCE_PERIODS", why: `Only ${r} payments remain.`, probe: pr(axj(n, j), Bx), stage: 1, failure: "application" },
          ];
      return conceptQuestion({
        stem: `${scene} Just after the ${ord(k)} payment, the loan is refinanced at an annual effective rate of ${pc(j)}, with level payments $Q$ over the remaining ${r} years. The lender charges a fee of ${amt(F)}, which ${added ? "is added to the amount of the new loan" : "the borrower pays in cash at the time of refinancing"}.\n\nDetermine which of the following equations $Q$ satisfies.`,
        correct: { content: math(added ? `Q\\,${aj(r)} = ${rhs(` + ${ff}`)}` : `Q\\,${aj(r)} = ${rhs("")}`), why: added ? "The new loan is the old balance plus the fee, repaid at the new rate." : "The fee is paid separately, so the new loan is just the old balance.", probe: pr(axj(r, j), added ? `${Bx} + ${lit(F)}` : Bx) },
        distractors: options,
        reference: { values: [{ label: "Q", expr: Q }], description: "The amount borrowed divided by the new-rate discount factors of the remaining dates." },
        steps: REFI_STEPS([{ concept: "loan.unknown-variable", reasoning: added ? "Whatever is borrowed at the refinancing date, fee included, is what the new payments repay." : "A fee paid in cash is not borrowed, so it does not enter the new loan." }]),
        conditions,
        relationship: added ? "$Qa_{\\overline{n-k}|\\,j} = B_k + F$" : "$Qa_{\\overline{n-k}|\\,j} = B_k$ (the fee is paid separately)",
        transfer,
        itemFormat: "equation-selection",
        presentation: added ? ["indirect-wording"] : ["irrelevant-info"],
        features: { unfamiliar: true },
        params: { i, n, P, k, j, F, variant },
      });
    }
    const steps = REFI_STEPS([
      { concept: "loan.balance-timing", reasoning: variant === 0 ? `The refinancing is at the due date of payment ${k + 1}, which is not made, so the debt is $P\\ddot{a}_{\\overline{${r}|}}$ at ${pc(i)}.` : "The new payment is stated, so the new rate is the unknown." },
      { concept: "loan.unknown-variable", reasoning: "One equation of value at the refinancing date defines the unknown." },
    ]);
    if (variant === 0) {
      const g = onePlusLit(i);
      const Bx = `${lit(P)}*${axj(r, i)}*${g}`;
      return conceptQuestion({
        stem: `${scene} The ${ord(k + 1)} payment is not made; instead, on its due date, the loan is refinanced at an annual effective rate of ${pc(j)}. The new loan is repaid by ${r} level annual payments $Q$, the first one year after the refinancing.\n\nDetermine which of the following equations $Q$ satisfies.`,
        correct: { content: math(`Q\\,${aj(r)} = ${pp}\\,\\ddot{a}_{\\overline{${r}|}\\,${i}}`), why: `The missed payment is still owed: the debt is $P\\ddot{a}_{\\overline{${r}|}}$ at ${pc(i)}, repaid by an annuity-immediate at ${pc(j)}.`, probe: `x*${axj(r, j)} - ${Bx}` },
        distractors: [
          { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(r)}`), misconception: "CONC_LOAN_BEFORE_AFTER_PAYMENT", why: "That is the balance a year earlier; it has since grown by a year's interest.", probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r, i)}`, stage: 2, failure: "application" },
          { content: math(`Q\\,\\ddot{a}_{\\overline{${r}|}\\,${j}} = ${pp}\\,\\ddot{a}_{\\overline{${r}|}\\,${i}}`), misconception: "TIMING_IMMEDIATE_AS_DUE", why: "The first new payment is a year after the refinancing.", probe: `x*${axj(r, j)}*(1+${lit(j)}) - ${Bx}`, stage: 1, failure: "application" },
          { content: math(`Q\\,${aj(r)} = ${pp}\\,\\ddot{a}_{\\overline{${r}|}\\,${j}}`), misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "The debt is valued at the old rate.", probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r, j)}*(1+${lit(j)})`, stage: 0, failure: "selection" },
          { content: math(`Q\\,${aj(r - 1)} = ${pp}\\,\\ddot{a}_{\\overline{${r}|}\\,${i}}`), misconception: "TIMING_REFINANCE_PERIODS", why: `The new loan has ${r} payments.`, probe: `x*${axj(r - 1, j)} - ${Bx}`, stage: 1, failure: "application" },
          { content: math(`Q\\,${aj(r)} = ${pp}\\,${ai(r - 1)}`), misconception: "TIMING_BALANCE_INDEX", why: `That treats payment ${k + 1} as made.`, probe: `x*${axj(r, j)} - ${lit(P)}*${axj(r - 1, i)}`, stage: 2, failure: "interpretation" },
        ],
        reference: { values: [{ label: "Q", expr: `${Bref}*${g}/(${Array.from({ length: r }, (_, t) => `(1+${lit(j)})**(-${t + 1})`).join(" + ")})` }], description: "Retrospective balance just after payment $k$, plus a year's interest, divided by the new-rate discount factors." },
        steps,
        conditions,
        relationship: "$Qa_{\\overline{n-k}|\\,j} = B_k(1+i) = P\\ddot{a}_{\\overline{n-k}|\\,i}$",
        transfer,
        itemFormat: "equation-selection",
        presentation: ["valuation-date", "hidden-structure"],
        modelingDecisions: 1,
        features: { multipleValuationDates: true, unfamiliar: true },
        params: { i, n, P, k, j, variant },
      });
    }
    const Qd = Number((B / an(r, j)).toFixed(2));
    const qq = mamt(Qd);
    const ax = (m: number | string) => axj(m, "x");
    return conceptQuestion({
      stem: `${scene} Just after the ${ord(k)} payment, the loan is refinanced so that the remaining ${r} payments become ${amt(Qd)} each.\n\nDetermine which of the following equations the new annual effective rate $j$ satisfies.`,
      correct: { content: math(`${qq}\\,a_{\\overline{${r}|}\\,j} = ${pp}\\,${ai(r)}`), why: "The new payments, valued at the new rate, repay the balance valued at the old rate.", probe: `${lit(Qd)}*${ax(r)} - ${lit(P)}*${axj(r, i)}` },
      distractors: [
        { content: math(`${qq}\\,a_{\\overline{${r}|}\\,j} = ${pp}\\,${ai(n)}`), misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Only the outstanding balance is refinanced.", probe: `${lit(Qd)}*${ax(r)} - ${lit(P)}*${axj(n, i)}`, stage: 0, failure: "selection" },
        { content: math(`${qq}\\,a_{\\overline{${n}|}\\,j} = ${pp}\\,${ai(r)}`), misconception: "TIMING_REFINANCE_PERIODS", why: `Only ${r} payments remain.`, probe: `${lit(Qd)}*${ax(n)} - ${lit(P)}*${axj(r, i)}`, stage: 1, failure: "application" },
        { content: math(`${qq}\\,s_{\\overline{${r}|}\\,j} = ${pp}\\,s_{\\overline{${r}|}\\,${i}}`), misconception: "FORMULA_AV_FOR_PV", why: "The two streams are valued at the end of the term at different rates, so the balance at the refinancing date is no longer what is matched.", probe: `${lit(Qd)}*((1+x)**${r}-1)/x - ${lit(P)}*((1+${lit(i)})**${r}-1)/${lit(i)}`, stage: 1, failure: "selection" },
        { content: math(`${qq}\\,a_{\\overline{${r + 1}|}\\,j} = ${pp}\\,${ai(r)}`), misconception: "TIMING_BALANCE_INDEX", why: `${r} new payments repay the balance.`, probe: `${lit(Qd)}*${ax(r + 1)} - ${lit(P)}*${axj(r, i)}`, stage: 1, failure: "application" },
        { content: math(`${qq}\\,a_{\\overline{${r}|}\\,j} = ${r} \\times ${pp}`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "The debt is the discounted value of the remaining payments.", probe: `${lit(Qd)}*${ax(r)} - ${r}*${lit(P)}`, stage: 0, failure: "application" },
      ],
      reference: { values: [{ label: "j", expr: `${Array.from({ length: r }, (_, t) => `${lit(Qd)}*(1+x)**(-${t + 1})`).join(" + ")} - ${Bref}`, bracket: [0.002, i] }], description: "The new payments discounted term by term at the unknown rate, set equal to the retrospective balance." },
      steps,
      conditions,
      relationship: "$Q a_{\\overline{n-k}|\\,j} = Pa_{\\overline{n-k}|\\,i}$, solved for $j$.",
      transfer,
      itemFormat: "equation-selection",
      presentation: ["unknown-rate", "hidden-structure"],
      modelingDecisions: 1,
      features: { unfamiliar: true },
      params: { i, n, P, k, j, variant },
    });
  },
});

const rfStatements: ChoiceTemplate = conceptTemplate({
  id: "con-loan-rf-statements",
  family: "con-loan-rf",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.refinancing",
  secondary: ["LOANS.principal_interest", "LOANS.outstanding_balance"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  reasoning: ["validation", "financial_intuition"],
  soaConcept: "Judging statements about the amount refinanced, the new payment and the interest saved.",
  variants: 2,
  generate(rng, level, variant) {
    const f = drawRefi(rng);
    const { ln, k, r, j, B, BE } = f;
    const { L, i, n, P } = ln;
    const Pe = payE(ln);
    const transfer = {
      principle: "Value the debt at the old rate; compare plans by present value at a stated rate, not by totals.",
      unusual: "Several consequences of one refinancing are judged together.",
      misread: "A lower payment or a lower rate does not by itself mean less interest or a better deal.",
    };
    const conditions = ["Level payments at the end of each year.", "The old balance at the old rate; the new loan at the new rate."];
    const scene = `A loan of ${amt(L)} at an annual effective interest rate of ${pc(i)} is repaid by ${n} level annual payments at the end of each year.`;
    const disc = (m: number, rate: number) => Array.from({ length: m }, (_, t) => `(1+${lit(rate)})**(-${t + 1})`).join(" + ");
    if (level === 1) {
      if (variant === 0) {
        const Q = B / an(r, j);
        const QE = `(${BE}/(${disc(r, j)}))`;
        return statementQuestion({
          steps: REFI_STEPS([{ concept: "loan.interest-principal-split", reasoning: "Both plans repay the same principal over the remaining years, so the difference in total payments is all interest." }]),
          conditions,
          relationship: "$Q = B_k/a_{\\overline{n-k}|\\,j}$; interest saved $= (n-k)(P - Q)$.",
          transfer,
          stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances at an annual effective rate of ${pc(j)} over the remaining ${r} years.\n\nDetermine which of the following statements are true.`,
          statements: [
            statement("I", `The amount of the new loan is ${amt(Number((P * an(r, j)).toFixed(2)))}.`, false, `The debt is valued at the old rate: $${mamt(Number(B.toFixed(2)))}$.`, "MODEL_BALANCE_AT_NEW_RATE", { stage: 0, failure: "selection", check: { expr: BE, op: "=", than: Number((P * an(r, j)).toFixed(2)), tol: 1e-4 }, conditionTrue: "True if the new rate equalled the old one." }),
            statement("II", `The new annual payment is ${amt(Number(Q.toFixed(2)))}.`, true, "The balance at the old rate divided by the annuity factor at the new rate.", "CONC_LOAN_REFI_OLD_RATE", { stage: 1, failure: "selection", check: { expr: QE, op: "=", than: Number(Q.toFixed(2)), tol: 1e-4 } }),
            statement("III", `Over the remaining ${r} years the borrower pays ${amt(Number((r * (P - Q)).toFixed(2)))} less interest than under the original loan.`, true, "Both plans repay the same principal, so the difference in total payments is all interest.", "CONC_LOAN_TOTAL_INTEREST_FIXED", { stage: 1, failure: "conclusion", check: { expr: `(${r}*${Pe} - ${BE}) - (${r}*${QE} - ${BE})`, op: "=", than: Number((r * (P - Q)).toFixed(2)), tol: 1e-4 } }),
          ],
          extra: [
            { keys: ["I"], misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Revaluing the debt and misjudging the payment rejects II and III.", stage: 0, failure: "selection" },
            { keys: ["I", "III"], misconception: "SEQ_UNDISCOUNTED_SUM", why: "Accepting the revalued balance leads to the wrong payment, rejecting II.", stage: 1, failure: "application" },
          ],
          params: { L, i, n, k, j, variant },
        });
      }
      const ext = rng.int(4, 8);
      const m = r + ext;
      const Q = B / an(m, j);
      if (!(m * Q > r * P)) throw new Error("extension does not raise total interest");
      const QE = `(${BE}/(${disc(m, j)}))`;
      return statementQuestion({
        steps: REFI_STEPS([{ concept: "loan.interest-principal-split", reasoning: "Total interest is total payments less principal; a longer term can raise it even at a lower rate." }]),
        conditions,
        relationship: "$Q = B_k/a_{\\overline{m}|\\,j}$; total interest $= mQ - B_k$ versus $(n-k)P - B_k$.",
        transfer,
        stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances at an annual effective rate of ${pc(j)} and extends the term, so that the new loan is repaid by ${m} level annual payments.\n\nDetermine which of the following statements are true.`,
        statements: [
          statement("I", "The new annual payment is less than the original payment.", true, "A lower rate and a longer term both reduce the payment.", "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", check: { expr: QE, op: "<", than: Pe } }),
          statement("II", "The total interest paid after refinancing is less than the interest remaining under the original loan.", false, `The longer term outweighs the lower rate here: $${m}Q - B > ${r}P - B$.`, "CONC_LOAN_TOTAL_INTEREST_FIXED", { stage: 1, failure: "conclusion", check: { expr: `${m}*${QE} - ${BE}`, op: "<", than: `${r}*${Pe} - ${BE}` }, conditionTrue: "True if the term were not extended." }),
          statement("III", `The present value at ${pc(j)} of the new payments equals the present value at ${pc(i)} of the remaining original payments.`, true, "Both equal the outstanding balance: that is what refinancing means.", "MODEL_BALANCE_AT_NEW_RATE", { stage: 0, failure: "selection", check: { expr: `${QE}*${annE(m, j)}`, op: "=", than: `${Pe}*${annE(r, i)}` } }),
        ],
        extra: [
          { keys: ["II"], misconception: "CONC_LOAN_REFI_OLD_RATE", why: "Mixing up which rate values which stream rejects I and III.", stage: 0, failure: "selection" },
          { keys: ["II", "III"], misconception: "TIMING_REFINANCE_PERIODS", why: "Overlooking the extension accepts II and misjudges the payment.", stage: 1, failure: "application" },
        ],
        params: { L, i, n, k, j, m, variant },
      });
    }
    const pvOld = P * an(r, j);
    const gain = pvOld - B;
    const added = variant === 0;
    const Q0 = B / an(r, j);
    const F = added ? Math.max(50, Math.floor((gain * 0.5) / 50) * 50) : Math.ceil((gain + (r * (P - Q0) - gain) * 0.4) / 50) * 50;
    if (!added && !(F > gain && F < r * (P - Q0))) throw new Error("fee outside the trap interval");
    const Qf = added ? (B + F) / an(r, j) : Q0;
    const QE = added ? `((${BE} + ${lit(F)})/(${disc(r, j)}))` : `(${BE}/(${disc(r, j)}))`;
    const steps = REFI_STEPS([{ concept: "tvm.equation-of-value", reasoning: `Compare the two plans by present value at ${pc(j)}, fee included.` }]);
    const statements = added
      ? [
          statement("I", `The amount of the new loan is ${amt(Number((B + F).toFixed(2)))}.`, true, "The old balance at the old rate plus the fee.", "TRANS_IGNORED_CONDITION", { stage: 1, failure: "application", check: { expr: `${BE} + ${lit(F)}`, op: "=", than: Number((B + F).toFixed(2)), tol: 1e-4 } }),
          statement("II", `Refinancing reduces the present value at ${pc(j)} of the borrower's remaining payments.`, true, `Old payments are worth $${mamt(Number(pvOld.toFixed(2)))}$ at ${pc(j)}; the new ones are worth the new loan, $${mamt(Number((B + F).toFixed(2)))}$.`, "SEQ_UNDISCOUNTED_SUM", { stage: 2, failure: "conclusion", check: { expr: `${QE}*${annE(r, j)}`, op: "<", than: `${Pe}*${annE(r, j)}` } }),
          statement("III", `The new annual payment is ${amt(Number(((B + F) / an(r, i)).toFixed(2)))}.`, false, `The new loan is amortized at ${pc(j)}: $${mamt(Number(Qf.toFixed(2)))}$.`, "CONC_LOAN_REFI_OLD_RATE", { stage: 1, failure: "selection", check: { expr: QE, op: "=", than: Number(((B + F) / an(r, i)).toFixed(2)), tol: 1e-4 } }),
        ]
      : [
          statement("I", `The amount of the new loan is ${amt(Number(B.toFixed(2)))}.`, true, "The fee is paid in cash, so only the old balance is borrowed.", "TRANS_IRRELEVANT_INFO", { stage: 1, failure: "interpretation", check: { expr: BE, op: "=", than: Number(B.toFixed(2)), tol: 1e-4 } }),
          statement("II", `Including the fee, refinancing reduces the present value at ${pc(j)} of the borrower's outlays.`, false, `The saving in present value at ${pc(j)} is $${mamt(Number(gain.toFixed(2)))}$, less than the fee of ${amt(F)}.`, "SEQ_UNDISCOUNTED_SUM", { stage: 2, failure: "conclusion", check: { expr: `${lit(F)} + ${QE}*${annE(r, j)}`, op: "<", than: `${Pe}*${annE(r, j)}` }, conditionTrue: `True if the fee were below ${amt(Number(gain.toFixed(2)))}.` }),
          statement("III", "The new annual payment is less than the original payment.", true, "The same balance is repaid over the same term at a lower rate.", "CONC_DIRECTION_REVERSED", { stage: 1, failure: "application", check: { expr: QE, op: "<", than: Pe } }),
        ];
    return statementQuestion({
      steps,
      conditions,
      relationship: "New loan $= B_k$ (+ fee if borrowed); worthwhile at rate $j$ iff fee $< Pa_{\\overline{n-k}|\\,j} - B_k$.",
      transfer,
      stem: `${scene} Just after the ${ord(k)} payment, the borrower refinances at an annual effective rate of ${pc(j)} over the remaining ${r} years. The lender charges a fee of ${amt(F)}, which ${added ? "is added to the new loan" : "the borrower pays in cash at the time of refinancing"}.\n\nDetermine which of the following statements are true.`,
      statements,
      extra: [
        { keys: ["III"], misconception: "VAR_ORIGINAL_FOR_OUTSTANDING", why: "Misjudging what is borrowed rejects I and the comparison in II.", stage: 0, failure: "selection" },
        { keys: added ? ["II", "III"] : ["II"], misconception: "MODEL_BALANCE_AT_NEW_RATE", why: "Revaluing the debt at the new rate misjudges the amount borrowed.", stage: 0, failure: "selection" },
      ],
      presentation: added ? ["indirect-wording"] : ["irrelevant-info"],
      features: { unfamiliar: true },
      params: { L, i, n, k, j, F, variant },
    });
  },
});

const rfCross: ChoiceTemplate = conceptTemplate({
  id: "con-loan-rf-cross",
  family: "con-loan-rf",
  topic: "LOANS",
  levels: [2, 3],
  objective: "LOANS.refinancing",
  secondary: ["TVM.equation_of_value", "ANNUITIES.level_payment"],
  itemFormat: "expression-selection",
  conceptFamily: "cross-topic",
  dimensions: ["transfer", "equation_construction", "relationships"],
  reasoning: ["financial_intuition", "translation", "transfer"],
  soaConcept: "Whether a refinancing with a fee is worthwhile, judged by an equation of value at the new rate.",
  variants: 2,
  generate(rng, level, variant) {
    const i = gridRate(rng, 0.06, 0.09, 0.005);
    const n = rng.int(15, 30);
    const P = gridAmount(rng, 800, 4000, 50);
    const k = rng.int(4, n - 8);
    const r = n - k;
    const jt = i - gridRate(rng, 0.01, 0.025, 0.005);
    const ln: Loan = { L: P * an(n, i), i, n, P };
    const B = balance(ln, k);
    const BE = retroE(ln, k);
    const pp = mamt(P);
    const ext = level === 3 ? rng.int(3, 8) : 0;
    const m = r + ext;
    const aI = (t: number | string) => aAt(t, i);
    const axr = (t: number | string, rate: number | string) => `((1-(1+${typeof rate === "number" ? lit(rate) : rate})**(-(${t})))/${typeof rate === "number" ? lit(rate) : rate})`;
    const added = level === 3;
    const scene = `A loan is repaid by ${n} annual payments of ${amt(P)} at the end of each year at an annual effective interest rate of ${pc(i)}. Just after the ${ord(k)} payment, the borrower can refinance the balance at a lower annual effective rate${variant === 0 ? ` of ${pc(jt)}` : " $j$"}${ext ? `, repaying the new loan by ${m} level annual payments instead of the remaining ${r}` : ` over the remaining ${r} years`}. The lender charges a fee${variant === 1 ? ` of ${amt(Math.round((P * an(r, jt) - B) / 10) * 10)}` : " $F$"}, which ${added ? "is added to the new loan" : "is paid in cash at the time of refinancing"}.`;
    const steps = [
      { concept: "loan.refinancing", reasoning: `The debt being replaced is $${pp}\\,${aI(r)}$, the balance at the old rate.` },
      { concept: "tvm.equation-of-value", reasoning: `Judge the plans by present value at the new rate: keeping the loan costs $${pp}\\,a_{\\overline{${r}|}}$ at that rate; refinancing costs the balance plus the fee.` },
      { concept: "loan.balance-prospective-retrospective", reasoning: "Any new loan, whatever its term, is worth exactly its amount at its own rate." },
      ...(level === 3 ? [{ concept: "loan.unknown-variable", reasoning: `Extending the term to ${m} payments changes the new payment but not the present value of the new loan, so the break-even condition does not involve ${m}.` }] : []),
    ];
    const conditions = ["Level payments at the end of each year.", "The plans are compared by present value at the new loan's rate."];
    const transfer = {
      principle: "A refinancing is worthwhile at rate $j$ exactly when the old payments, valued at $j$, exceed what the new arrangement costs at $j$.",
      unusual: level === 3 ? "The fee is borrowed and the term changes, yet the condition is the same." : "A loan decision becomes an equation of value.",
      misread: "Total payments saved are not a present value.",
    };
    const common = { steps, conditions, transfer, presentation: (level === 3 ? ["combined-topics", "hidden-structure"] : ["combined-topics"]) as ("combined-topics" | "hidden-structure")[], ...(level === 3 ? { modelingDecisions: 1 } : {}), features: { multiConcept: true, unfamiliar: true } };
    if (variant === 0) {
      const j = jt;
      const Q = B / an(m, j);
      const qE = `(${BE}/${axr(m, j)})`;
      const ajr = `a_{\\overline{${r}|}\\,${j}}`;
      const ajm = `a_{\\overline{${m}|}\\,${j}}`;
      const distractors: ConceptOption[] = [
        { content: math(level === 3 ? `${r} \\times ${pp} - ${m} \\times Q` : `${r} \\times ${pp} - ${r} \\times Q`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "Payment savings occur over many years; they must be discounted at the new rate.", probe: `${r}*${lit(P)} - ${m}*${qE}`, stage: 1, failure: "application" },
        { content: math(`${pp}\\bigl(${aI(r)} - ${ajr}\\bigr)`), misconception: "CONC_DIRECTION_REVERSED", why: "At the lower rate the old payments are worth more than the balance, not less.", probe: `${lit(P)}*${axr(r, i)} - ${lit(P)}*${axr(r, j)}`, stage: 1, failure: "application" },
        { content: math(`(${pp} - Q)\\,${aI(r)}`), misconception: "CONC_LOAN_REFI_OLD_RATE", why: "The saving stream should be valued at the rate at which the borrower can now borrow.", probe: `(${lit(P)} - ${qE})*${axr(r, i)}`, stage: 1, failure: "selection" },
        ...(level === 3
          ? [{ content: math(`(${pp} - Q)\\,${ajm}`), misconception: "TIMING_REFINANCE_PERIODS" as const, why: `The original payments of ${amt(P)} would only have run for ${r} more years.`, probe: `(${lit(P)} - ${qE})*${axr(m, j)}`, stage: 3, failure: "application" as const }]
          : [{ content: math(`(${pp} - Q)\\,a_{\\overline{${n}|}\\,${j}}`), misconception: "TIMING_REFINANCE_PERIODS" as const, why: `Only ${r} payments remain.`, probe: `(${lit(P)} - ${qE})*${axr(n, j)}`, stage: 1, failure: "application" as const }]),
      ];
      return conceptQuestion({
        ...common,
        stem: `${scene} Let $Q$ be the new annual payment the borrower would have if no fee were charged.\n\nDetermine which of the following expressions gives the largest fee $F$ for which refinancing reduces the present value, at ${pc(j)}, of the borrower's outlays.`,
        correct: { content: math(`${pp}\\bigl(${ajr} - ${aI(r)}\\bigr)`), why: `Keeping the loan costs $${pp}\\,${ajr}$ at ${pc(j)}; refinancing costs the balance plus the fee${added ? ", since a borrowed fee is repaid at the same rate" : ""}.`, probe: `${lit(P)}*${axr(r, j)} - ${lit(P)}*${axr(r, i)}` },
        distractors,
        reference: { values: [{ label: "F_max", expr: `${Array.from({ length: r }, (_, t) => `${lit(P)}*(1+${lit(j)})**(-${t + 1})`).join(" + ")} - ${BE}` }], description: "Old remaining payments discounted term by term at the new rate, less the retrospective balance." },
        relationship: "Worthwhile iff $F < Pa_{\\overline{n-k}|\\,j} - Pa_{\\overline{n-k}|\\,i}$, whatever the new term.",
        itemFormat: "expression-selection",
        params: { i, n, P, k, j, m, variant, Q },
      });
    }
    const F = Math.round((P * an(r, jt) - B) / 10) * 10;
    const ff = mamt(F);
    const Bx = `${lit(P)}*${axr(r, i)}`;
    const distractors: ConceptOption[] = [
      { content: math(`${ff} + ${pp}\\,a_{\\overline{${r}|}\\,j} = ${pp}\\,${aI(r)}`), misconception: "ALG_SIGN_ERROR", why: "The fee is an extra cost of refinancing, so it sits with the balance.", probe: `${lit(F)} + ${lit(P)}*${axr(r, "x")} - ${Bx}`, stage: 1, failure: "application" },
      { content: math(`${pp}\\,${aI(r)} = ${pp}\\,a_{\\overline{${r}|}\\,j} + ${ff}(1+j)^{${r}}`), misconception: "TIMING_VALUATION_DATE", why: "The fee is paid at the refinancing date, so it is not moved.", probe: `${Bx} - ${lit(P)}*${axr(r, "x")} - ${lit(F)}*(1+x)**${r}`, stage: 1, failure: "application" },
      { content: math(`${ff} + ${pp}\\,${aI(r)} = ${pp}\\,a_{\\overline{${level === 3 ? m : n}|}\\,j}`), misconception: "TIMING_REFINANCE_PERIODS", why: level === 3 ? `The original payments would run for only ${r} more years; the new term does not change their value.` : `Only ${r} payments remain.`, probe: `${lit(F)} + ${Bx} - ${lit(P)}*${axr(level === 3 ? m : n, "x")}`, stage: level === 3 ? 3 : 1, failure: "application" },
      { content: math(`${ff} = ${r}\\Bigl(${pp} - \\dfrac{${pp}\\,${aI(r)}}{a_{\\overline{${r}|}\\,j}}\\Bigr)`), misconception: "SEQ_UNDISCOUNTED_SUM", why: "Payment savings must be discounted, not added.", probe: `${lit(F)} - ${r}*(${lit(P)} - ${Bx}/${axr(r, "x")})`, stage: 1, failure: "application" },
    ];
    return conceptQuestion({
      ...common,
      stem: `${scene}\n\nDetermine which of the following equations is satisfied by the rate $j$ at which the borrower is indifferent, comparing present values at $j$.`,
      correct: { content: math(`${ff} + ${pp}\\,${aI(r)} = ${pp}\\,a_{\\overline{${r}|}\\,j}`), why: `At the break-even rate, the old payments valued at $j$ equal the balance plus the fee${added ? ", whatever the new term" : ""}.`, probe: `${lit(F)} + ${Bx} - ${lit(P)}*${axr(r, "x")}` },
      distractors,
      reference: { values: [{ label: "j", expr: `${lit(F)} + ${BE} - (${Array.from({ length: r }, (_, t) => `${lit(P)}*(1+x)**(-${t + 1})`).join(" + ")})`, bracket: [0.002, i] }], description: "The old remaining payments discounted term by term at the unknown rate, set equal to the retrospective balance plus the fee." },
      relationship: "Indifference: $F + Pa_{\\overline{n-k}|\\,i} = Pa_{\\overline{n-k}|\\,j}$.",
      itemFormat: "equation-selection",
      params: { i, n, P, k, F, m, variant },
    });
  },
});

export const LOAN_CONCEPT_TEMPLATES: ChoiceTemplate[] = [piDefine, piTrend, piStatements, amScheduleRead, amPrincipalExpression, amDiagnosis, obRetroProsp, obEquation, obStatements, obSaleCross, pcInterpret, pcTotals, pcDiagnosis, fpDropBalloon, fpEquation, fpStatements, uvSufficient, uvEquation, uvDiagnosis, rfReplaced, rfEquation, rfStatements, rfCross];
