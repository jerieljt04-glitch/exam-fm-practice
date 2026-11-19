/**
 * Calculation questions with typed options: ordered pairs, portfolio
 * allocations, table-driven and cash-flow-schedule questions. Each component
 * of every option is recomputed from its own arithmetic and the correct one is
 * checked against an independent reference (lib/engine/validate-choice.ts).
 */
import type { Exhibit, OptionContent } from "../answers";
import { compositeTemplate } from "../concepts/kit";
import { acc, adue, an, convexity, macaulayDuration, pvFlows, sn, solveRoot, v, type Flow } from "../finance";
import type { MisconceptionId } from "../misconceptions";
import type {
  AlgebraMethod,
  AnswerFormat,
  ChainErrorKind,
  ChainStep,
  ChoiceDraft,
  ChoiceTemplate,
  Explanation,
  FormulaChain,
  ItemFormat,
  Presentation,
  QuestionFeatures,
  VisualSpec,
} from "../types";
import {
  MONEY2,
  PCT2,
  aExpr,
  aSym,
  accPow,
  adueExpr,
  amt,
  avTerms,
  dec,
  drawUntil,
  gridAmount,
  gridRate,
  level,
  lit,
  mamt,
  mnum,
  mpc,
  num,
  ord,
  pc,
  periodNoun,
  pvTerms,
  range,
  sExpr,
  shown,
  step,
  sumOf,
  vPow,
} from "./kit";

// ===================================================================== authoring helpers

/** One component of an option: its value and the arithmetic that produces it. */
type Comp = readonly [value: number, calc: string];

interface RightOption {
  parts: Comp[];
  why: string;
  derivation: string;
}

interface WrongOption extends RightOption {
  id: MisconceptionId;
  method: string;
  /** Formula-chain step where the mistake happens, and how. */
  stage: number;
  error: ChainErrorKind;
  conditionTrue?: string;
}

interface CompositeSpec {
  style: "ordered-pair" | "allocation" | "amounts";
  labels: string[];
  formats: AnswerFormat[];
  stem: string;
  exhibits?: Exhibit[];
  correct: RightOption;
  wrong: WrongOption[];
  /** Independent derivations, one per component (explicit cash flows, not the option's closed form). */
  reference: { description: string; values: { expr: string; bracket?: [number, number] }[] };
  explanation: Explanation;
  steps: ChainStep[];
  methods: AlgebraMethod[];
  reasoning: string;
  presentation: Presentation[];
  features?: Partial<QuestionFeatures>;
  params: Record<string, number | string | boolean>;
  itemFormat: ItemFormat;
  modelingDecisions?: number;
  relationship: string;
  markers?: number[];
  visuals?: VisualSpec[];
}

function compositeQuestion(spec: CompositeSpec): ChoiceDraft {
  const content = (parts: Comp[]): OptionContent => ({
    type: "composite",
    style: spec.style,
    parts: parts.map(([value], k) => ({ label: spec.labels[k], value, format: spec.formats[k] })),
  });
  const stages: FormulaChain["stages"] = {};
  for (const w of spec.wrong) stages[w.id] = { stage: w.stage, kind: w.error };
  const formulas = [...new Set(spec.steps.map((s) => s.formula))];
  return {
    kind: "choice",
    stem: spec.stem,
    ...(spec.exhibits ? { exhibits: spec.exhibits } : {}),
    correct: { content: content(spec.correct.parts), explanation: spec.correct.why, derivation: spec.correct.derivation, calc: spec.correct.parts.map((p) => p[1]) },
    distractors: spec.wrong.map((w) => ({
      content: content(w.parts),
      misconception: w.id,
      explanation: w.why,
      method: w.method,
      derivation: w.derivation,
      calc: w.parts.map((p) => p[1]),
      chainStage: w.stage,
      chainError: w.error,
      ...(w.conditionTrue ? { conditionTrue: w.conditionTrue } : {}),
    })),
    reference: { description: spec.reference.description, values: spec.reference.values.map((r, k) => ({ label: spec.labels[k], ...r })) },
    explanation: spec.explanation,
    chain: { steps: spec.steps, methods: spec.methods, reasoning: spec.reasoning, stages },
    relationship: spec.relationship,
    formulas,
    visuals: spec.visuals ?? [],
    markers: spec.markers ?? [],
    presentation: spec.presentation,
    features: {
      multiConcept: formulas.length >= 2,
      formulaRetrieval: true,
      multipleValuationDates: false,
      unfamiliar: false,
      steps: spec.steps.length,
      ...spec.features,
    },
    params: spec.params,
    itemFormat: spec.itemFormat,
    ...(spec.modelingDecisions !== undefined ? { modelingDecisions: spec.modelingDecisions } : {}),
  };
}

function explain(e: {
  intuition: string;
  unknowns: [string, string][];
  relationships: string[];
  conditions: string[];
  valuationDate: string;
  modelChoice: string;
  assumptions: string[];
  solution: [string, string][];
  alternatives: [string, string, string][];
  principle: string;
  unusual: string;
  misread: string;
}): Explanation {
  return {
    intuition: e.intuition,
    translation: {
      unknowns: e.unknowns.map(([symbol, meaning]) => ({ symbol, meaning })),
      relationships: e.relationships,
      conditions: e.conditions,
      valuationDate: e.valuationDate,
      modelChoice: e.modelChoice,
      assumptions: e.assumptions,
    },
    solution: e.solution.map(([title, body]) => ({ title, body })),
    alternatives: e.alternatives.map(([name, body, whenUseful]) => ({ name, body, whenUseful })),
    transfer: { principle: e.principle, unusual: e.unusual, misread: e.misread },
  };
}

/** An option's values as printed, inside math: `(1{,}234.56,\ 789.00)`. */
const tuple = (values: number[], formats: AnswerFormat[]): string => `(${values.map((x, k) => shown(x, formats[k])).join(",\\ ")})`;

const round = (x: number, places: number): number => Number(x.toFixed(places));

const YEARS_T: AnswerFormat = { kind: "time", decimals: 2, unit: "years" };

/** a(n) at a rate expression, written for a template's derivation text. */
const aj = (n: number, rate = "j"): string => aSym(n, rate);

// ===================================================================== loans: (interest, principal) in payment k

const loanComponents = compositeTemplate({
  id: "comp-loan-int-prin",
  family: "comp-loan-components",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.amortization", "LOANS.outstanding_balance"],
  reasoning: ["formula_selection", "cashflow_modelling", "multistep"],
  soaConcept: "Interest and principal portions of one payment of a level-payment loan, answered together as an ordered pair.",
  itemFormat: "ordered-pair",
  variants: 2,
  generate(rng, lvl, variant): ChoiceDraft {
    const m = lvl === 1 ? 1 : rng.int(0, 1) ? 4 : 12;
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const years = m === 1 ? rng.int(10, 25) : rng.int(5, 10);
    const N = years * m;
    const j = m === 1 ? i : Math.pow(1 + i, 1 / m) - 1;
    const jE = m === 1 ? lit(i) : `((1+${lit(i)})**(1/${m})-1)`;
    const k = drawUntil(
      () => rng.int(Math.max(2, Math.ceil(N * 0.15)), Math.floor(N * 0.85)),
      (kk) => Math.abs(v(j, N - kk + 1) - 0.5) > 0.04 && Math.abs(kk - (N + 1) / 2) >= 2
    );
    const e = N - k + 1;
    let L: number;
    let X: number;
    let XE: string;
    let LE: string;
    if (variant === 0) {
      L = gridAmount(rng, 20000, 250000, 1000);
      X = L / an(N, j);
      XE = `${lit(L)}/${aExpr(N, jE)}`;
      LE = lit(L);
    } else {
      X = m === 1 ? gridAmount(rng, 1500, 20000, 50) : gridAmount(rng, 200, 3000, 5);
      L = X * an(N, j);
      XE = lit(X);
      LE = `${lit(X)}*${aExpr(N, jE)}`;
    }
    const Bprev = X * an(e, j);
    const I = X * (1 - v(j, e));
    const P = X * v(j, e);
    const fmts = [MONEY2, MONEY2];
    const pn = periodNoun(m);

    // Chain.
    const steps: ChainStep[] = [];
    const idx: Record<string, number> = {};
    const add = (key: string, s: ChainStep) => {
      idx[key] = steps.length;
      steps.push(s);
    };
    if (m > 1) add("j", step("A.nominal-equivalence", `Payments are made each ${pn}, so convert the annual effective rate to the effective rate per ${pn}.`, ["j", j, `effective rate per ${pn}`], ["i"]));
    if (variant === 0) add("X", step("D.loan-payment", "The level payment repays the loan over all the payments.", ["X", X, "level payment"], ["L", "j", "N"]));
    if (!(m > 1 && variant === 0)) add("B", step("D.prospective", `The balance just after payment ${k - 1} is the value of the ${e} payments still to be made.`, [`B_{${k - 1}}`, Bprev, "balance before the payment"], ["X", "j"]));
    add("I", step("D.interest-component", `Payment ${k} first pays interest on the balance outstanding just before it.`, ["I", I, `interest in payment ${k}`], [`B_{${k - 1}}`, "j"]));
    add("P", step("D.principal-component", "The rest of the payment repays principal.", ["P", P, `principal in payment ${k}`], ["X", "I"]));
    const sB = idx.B ?? idx.I;

    const wrong: WrongOption[] = [];
    if (m > 1) {
      const j2 = i / m;
      const j2E = `(${lit(i)}/${m})`;
      const X2 = variant === 0 ? L / an(N, j2) : X;
      const X2E = variant === 0 ? `${lit(L)}/${aExpr(N, j2E)}` : lit(X);
      wrong.push({
        id: "RATE_DIVIDED_EFFECTIVE",
        parts: [
          [X2 * (1 - v(j2, e)), `${X2E}*(1-${vPow(j2E, e)})`],
          [X2 * v(j2, e), `${X2E}*${vPow(j2E, e)}`],
        ],
        method: `Used ${pc(i)}/${m} as the rate per ${pn}.`,
        derivation: `$j = ${mpc(i)}/${m}$, then $I = X(1 - v^{${e}})$: $${tuple([X2 * (1 - v(j2, e)), X2 * v(j2, e)], fmts)}$`,
        why: `${pc(i)} is an annual effective rate; dividing it by ${m} gives a nominal-style rate whose ${m}-fold compounding exceeds ${pc(i)}. The rate per ${pn} is $(1.${dec(i, 4).slice(2)})^{1/${m}} - 1 = ${dec(j, 6)}$.`,
        stage: idx.j,
        error: "application",
        conditionTrue: `If ${pc(i)} were a nominal annual rate convertible ${m === 4 ? "quarterly" : "monthly"}.`,
      });
    }
    wrong.push(
      {
        id: "MODEL_INTEREST_ON_ORIGINAL",
        parts: [
          [j * L, `${jE}*${LE}`],
          [X - j * L, `${XE} - ${jE}*${LE}`],
        ],
        method: "Charged interest on the original loan amount.",
        derivation: `$I = j \\times ${mamt(round(L, 2))}$, $P = X - I$: $${tuple([j * L, X - j * L], fmts)}$`,
        why: `By payment ${k} part of the loan has been repaid; interest accrues only on the balance $B_{${k - 1}} = ${mnum(Bprev, 2)}$ outstanding just before the payment.`,
        stage: idx.I,
        error: "application",
        conditionTrue: "Only for the first payment, when the outstanding balance is still the original loan.",
      },
      {
        id: "TIMING_BALANCE_INDEX",
        parts: [
          [X * (1 - v(j, e - 1)), `${XE}*(1-${vPow(jE, e - 1)})`],
          [X * v(j, e - 1), `${XE}*${vPow(jE, e - 1)}`],
        ],
        method: `Charged interest on the balance just after payment ${k}.`,
        derivation: `$I = j\\,B_{${k}} = X(1 - v^{${e - 1}})$: $${tuple([X * (1 - v(j, e - 1)), X * v(j, e - 1)], fmts)}$`,
        why: `Interest for the ${pn} ending at payment ${k} accrues on the balance at the start of that ${pn}, $B_{${k - 1}}$, not on $B_{${k}}$, which already reflects payment ${k}.`,
        stage: sB,
        error: "application",
      },
      {
        id: "VAR_INTEREST_FOR_PRINCIPAL",
        parts: [
          [P, `${XE}*${vPow(jE, e)}`],
          [I, `${XE}*(1-${vPow(jE, e)})`],
        ],
        method: "Computed both portions correctly but reported them in each other's places.",
        derivation: `$(P, I)$ instead of $(I, P)$: $${tuple([P, I], fmts)}$`,
        why: `The pair asked for is (interest, principal). The interest portion is $j\\,B_{${k - 1}} = ${mnum(I, 2)}$; the principal portion is ${mnum(P, 2)}.`,
        stage: idx.P,
        error: "interpretation",
      },
      {
        id: "COMP_PRINCIPAL_FROM_START",
        parts: [
          [X * (1 - v(j, k)), `${XE}*(1-${vPow(jE, k)})`],
          [X * v(j, k), `${XE}*${vPow(jE, k)}`],
        ],
        method: `Took the principal portion as $X v^{${k}}$.`,
        derivation: `$P = X v^{${k}}$, $I = X - P$: $${tuple([X * (1 - v(j, k)), X * v(j, k)], fmts)}$`,
        why: `The principal portion of payment ${k} is the payment discounted from the end of the loan, $X v^{${N}-${k}+1} = X v^{${e}}$; $X v^{${k}}$ is the principal portion of payment ${N - k + 1}.`,
        stage: idx.P,
        error: "application",
      },
      {
        id: "MODEL_STRAIGHT_LINE",
        parts: [
          [X - L / N, `${XE} - ${LE}/${N}`],
          [L / N, `${LE}/${N}`],
        ],
        method: `Assumed every payment repays the same principal, ${variant === 0 ? "L" : "the loan"}/${N}.`,
        derivation: `$P = ${mamt(round(L, 2))}/${N}$, $I = X - P$: $${tuple([X - L / N, L / N], fmts)}$`,
        why: "With level payments the principal portions are not level: they grow by the factor $1 + j$ each period, because the interest portion falls as the balance falls.",
        stage: idx.P,
        error: "selection",
        conditionTrue: "For a loan repaid with level principal repayments (non-level total payments).",
      }
    );

    const BR =
      variant === 0
        ? `(${lit(L)}*${accPow(jE, k - 1)} - (${lit(L)}/${pvTerms(level(1, range(1, N)), jE)})*${avTerms(level(1, range(1, k - 1)), jE, k - 1)})`
        : `(${lit(X)}*${pvTerms(level(1, range(1, e)), jE)})`;
    const XR = variant === 0 ? `(${lit(L)}/${pvTerms(level(1, range(1, N)), jE)})` : lit(X);

    const loanText =
      variant === 0
        ? `A loan of ${amt(L)} is repaid by level payments at the end of each ${pn} for ${years} years.`
        : `A loan is repaid by ${N} level payments of ${amt(X)}, made at the end of each ${pn}.`;
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Interest", "Principal"],
      formats: fmts,
      stem: `${loanText} The annual effective interest rate is ${pc(i)}.\n\nLet $I$ be the interest portion and $P$ the principal portion of the ${ord(k)} payment. Calculate $(I, P)$.`,
      correct: {
        parts: [
          [I, `${XE}*(1-${vPow(jE, e)})`],
          [P, `${XE}*${vPow(jE, e)}`],
        ],
        why: `Interest is earned on $B_{${k - 1}} = X\\,${aj(e)} = ${mnum(Bprev, 2)}$, so $I = ${mnum(I, 2)}$ and $P = X - I = ${mnum(P, 2)}$.`,
        derivation: `$I = j\\,B_{${k - 1}},\\ P = X v^{${e}}$: $${tuple([I, P], fmts)}$`,
      },
      wrong,
      reference: {
        description: `Balance just before payment ${k} written out ${variant === 0 ? "retrospectively from the loan" : "prospectively from the remaining payments"}; interest is the rate times that balance and principal is the payment minus interest.`,
        values: [{ expr: `${jE}*${BR}` }, { expr: `${XR} - ${jE}*${BR}` }],
      },
      explanation: explain({
        intuition: `Each payment first pays the interest due on the balance outstanding just before it; whatever is left repays principal. Because that balance is the value of the payments still to come, the principal portion is simply the payment discounted from the end of the loan.`,
        unknowns: [
          ["$X$", "level payment"],
          [`$B_{${k - 1}}$`, `balance just after payment ${k - 1}`],
          ["$I$", `interest portion of payment ${k}`],
          ["$P$", `principal portion of payment ${k}`],
        ],
        relationships: [`$B_{${k - 1}} = X\\,${aj(e)}$`, `$I = j\\,B_{${k - 1}} = X(1 - v^{${e}})$`, `$P = X - I = X v^{${e}}$`],
        conditions: ["Level payments at the end of each period.", "Interest is charged on the balance at the start of each period."],
        valuationDate: `Just after payment ${k - 1}, the start of the period in which payment ${k} falls due.`,
        modelChoice: "Amortization: payment = interest on the outstanding balance + principal repaid.",
        assumptions: ["The rate is constant over the term."],
        solution: [
          ...(m > 1 ? [["Rate per period", `$j = (1 + ${mpc(i)})^{1/${m}} - 1 = ${dec(j, 6)}$`] as [string, string]] : []),
          ...(variant === 0 ? [["Payment", `$X = ${mamt(L)}/${aj(N)} = ${mnum(X, 2)}$`] as [string, string]] : []),
          ["Balance before the payment", `$B_{${k - 1}} = X\\,${aj(e)} = ${mnum(Bprev, 2)}$`],
          ["Interest portion", `$I = j\\,B_{${k - 1}} = ${dec(j, 6)} \\times ${mnum(Bprev, 2)} = ${mnum(I, 2)}$`],
          ["Principal portion", `$P = X - I = ${mnum(P, 2)}$, so $(I, P) = ${tuple([I, P], fmts)}$.`],
        ],
        alternatives: [
          ["Discount from the end of the loan", `$P = X v^{${e}} = ${mnum(P, 2)}$ and $I = X(1 - v^{${e}}) = ${mnum(I, 2)}$ — no balance needed.`, "When only one payment's split is asked for."],
          ["Retrospective balance", `$B_{${k - 1}} = L(1 + j)^{${k - 1}} - X\\,s_{\\overline{${k - 1}|}}$ gives the same balance from the past payments.`, "When the loan amount is given and few payments have been made."],
        ],
        principle: "Interest in payment k is earned on the balance just before it, B_{k−1}; the principal portion is the payment discounted from the end of the term, X v^{n−k+1}.",
        unusual: m > 1 ? `Payments are made each ${pn} while the rate is annual effective, so first find the equivalent rate per ${pn}.` : variant === 1 ? "The loan amount is not given; the payment and the number of payments are enough." : "Both portions are asked for at once, so a slip in either one changes the answer.",
        misread: "Charging interest on the original loan, or on the balance after the payment instead of before it.",
      }),
      steps,
      methods: ["decomposition", "substitution"],
      reasoning: "Write the payment as interest on the balance just before it plus principal; the balance is the present value of the payments still due.",
      presentation: m > 1 ? ["frequency"] : ["direct"],
      params: { L: round(L, 2), X: round(X, 4), i, m, N, k, variant },
      itemFormat: "ordered-pair",
      relationship: "$I_k = j\\,B_{k-1}$, $P_k = X v^{n-k+1}$",
      markers: [Bprev, X],
    });
  },
});

// ===================================================================== loans: (payment, outstanding balance)

const loanPaymentBalance = compositeTemplate({
  id: "comp-loan-payment-balance",
  family: "comp-loan-balance",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.outstanding_balance",
  secondary: ["LOANS.unknown_variables", "LOANS.payment_components"],
  reasoning: ["formula_selection", "algebra", "multistep", "formula_reconstruction"],
  soaConcept: "Level payment and outstanding balance of an amortized loan, recovered from the loan amount or from principal portions of individual payments.",
  itemFormat: "ordered-pair",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const n = rng.int(12, 25);
    const i0 = gridRate(rng, 0.04, 0.09, 0.0025);
    const k = rng.int(3, n - 3);
    const L0 = gridAmount(rng, 30000, 250000, 1000);
    const X0 = L0 / an(n, i0);
    const fmts = [MONEY2, MONEY2];

    if (lvl === 1) {
      const i = i0;
      const L = L0;
      const X = X0;
      const XE = `${lit(L)}/${aExpr(n, i)}`;
      const B = X * an(n - k, i);
      const Xd = L / adue(n, i);
      const XdE = `${lit(L)}/${adueExpr(n, i)}`;
      const Xs = L / sn(n, i);
      const XsE = `${lit(L)}/${sExpr(n, i)}`;
      const steps = [
        step("D.loan-payment", "The level payment repays the loan over n payments.", ["X", X, "level payment"], ["L", "i", "n"]),
        step("D.prospective", `The balance after payment ${k} is the value of the ${n - k} payments still due.`, ["B", B, `balance after payment ${k}`], ["X", "i"]),
      ];
      const XR = `(${lit(L)}/${pvTerms(level(1, range(1, n)), i)})`;
      return compositeQuestion({
        style: "ordered-pair",
        labels: ["Payment", "Balance"],
        formats: fmts,
        stem: `A loan of ${amt(L)} is repaid by ${n} level annual payments, the first one year after the loan is made. The annual effective interest rate is ${pc(i)}.\n\nLet $X$ be the level payment and $B$ the outstanding balance immediately after the ${ord(k)} payment. Calculate $(X, B)$.`,
        correct: {
          parts: [
            [X, XE],
            [B, `${XE}*${aExpr(n - k, i)}`],
          ],
          why: `$X = ${mamt(L)}/${aSym(n, "i")} = ${mnum(X, 2)}$ and $B = X\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$.`,
          derivation: `$X = L/${aSym(n, "i")},\\ B = X\\,${aSym(n - k, "i")}$: $${tuple([X, B], fmts)}$`,
        },
        wrong: [
          {
            id: "TIMING_BALANCE_INDEX",
            parts: [
              [X, XE],
              [X * an(n - k + 1, i), `${XE}*${aExpr(n - k + 1, i)}`],
            ],
            method: `Valued ${n - k + 1} remaining payments instead of ${n - k}.`,
            derivation: `$B = X\\,${aSym(n - k + 1, "i")}$: $${tuple([X, X * an(n - k + 1, i)], fmts)}$`,
            why: `Immediately after payment ${k}, payments ${k + 1} to ${n} remain: ${n - k} payments. Valuing ${n - k + 1} gives the balance just after payment ${k - 1}.`,
            stage: 1,
            error: "application",
          },
          {
            id: "TIMING_IMMEDIATE_AS_DUE",
            parts: [
              [Xd, XdE],
              [Xd * an(n - k, i), `${XdE}*${aExpr(n - k, i)}`],
            ],
            method: "Valued the payments as an annuity-due when computing X.",
            derivation: `$X = L/${"\\ddot{a}"}_{\\overline{${n}|}}$: $${tuple([Xd, Xd * an(n - k, i)], fmts)}$`,
            why: "The first payment is one year after the loan, so the payments form an annuity-immediate; the annuity-due factor credits each payment with an extra year of interest and understates X.",
            stage: 0,
            error: "selection",
            conditionTrue: "If the first payment were made on the day the loan is made.",
          },
          {
            id: "SEQ_UNDISCOUNTED_SUM",
            parts: [
              [X, XE],
              [L - k * X, `${lit(L)} - ${k}*${XE}`],
            ],
            method: `Subtracted ${k} payments from the loan without interest.`,
            derivation: `$B = ${mamt(L)} - ${k}X$: $${tuple([X, L - k * X], fmts)}$`,
            why: "Part of each payment is interest, so the balance falls by less than the payment; the balance is the present value of the remaining payments.",
            stage: 1,
            error: "selection",
          },
          {
            id: "FORMULA_AV_FOR_PV",
            parts: [
              [Xs, XsE],
              [Xs * an(n - k, i), `${XsE}*${aExpr(n - k, i)}`],
            ],
            method: `Divided the loan by $s_{\\overline{${n}|}}$.`,
            derivation: `$X = L/s_{\\overline{${n}|}}$: $${tuple([Xs, Xs * an(n - k, i)], fmts)}$`,
            why: "The loan is a present value, so it equals the present value of the payments, $X a_{\\overline{n|}}$; $s_{\\overline{n|}}$ would be used for a sinking fund that accumulates to the loan.",
            stage: 0,
            error: "selection",
            conditionTrue: "If L were an amount to be accumulated by time n.",
          },
          {
            id: "MODEL_STRAIGHT_LINE",
            parts: [
              [X, XE],
              [(L * (n - k)) / n, `${lit(L)}*${n - k}/${n}`],
            ],
            method: `Assumed ${k}/${n} of the loan has been repaid.`,
            derivation: `$B = ${mamt(L)}(1 - ${k}/${n})$: $${tuple([X, (L * (n - k)) / n], fmts)}$`,
            why: "Principal is repaid slowly at first and faster later, so the balance after k level payments is more than a straight-line fraction of the loan.",
            stage: 1,
            error: "selection",
          },
        ],
        reference: {
          description: `The payment equates the loan with the explicit sum of discounted payments; the balance is computed retrospectively: loan accumulated for ${k} years less the accumulated payments.`,
          values: [{ expr: XR }, { expr: `${lit(L)}*${accPow(i, k)} - ${XR}*${avTerms(level(1, range(1, k)), i, k)}` }],
        },
        explanation: explain({
          intuition: "The payment spreads the loan's present value over n payments. After k payments, what is still owed is exactly the value of the payments still to come.",
          unknowns: [
            ["$X$", "level annual payment"],
            ["$B$", `balance just after payment ${k}`],
          ],
          relationships: [`$L = X\\,${aSym(n, "i")}$`, `$B = X\\,${aSym(n - k, "i")}$`],
          conditions: ["Payments at the end of each year (annuity-immediate)."],
          valuationDate: `Time 0 for the payment; time ${k} for the balance.`,
          modelChoice: "Prospective balance: present value of the remaining payments.",
          assumptions: ["Constant annual effective rate."],
          solution: [
            ["Payment", `$X = ${mamt(L)}/${aSym(n, "i")} = ${mnum(X, 2)}$`],
            ["Balance", `$B = ${mnum(X, 2)}\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$, so $(X, B) = ${tuple([X, B], fmts)}$.`],
          ],
          alternatives: [["Retrospective method", `$B = L(1 + i)^{${k}} - X\\,s_{\\overline{${k}|}} = ${mnum(B, 2)}$.`, "When few payments have been made, or when payments have been irregular."]],
          principle: "The outstanding balance is the present value of the payments still due (prospective) — or, equivalently, the accumulated loan less the accumulated payments (retrospective).",
          unusual: "Two linked quantities are asked for; the second depends on the first.",
          misread: `Counting ${n - k + 1} remaining payments after the ${ord(k)} payment.`,
        }),
        steps,
        methods: ["substitution"],
        reasoning: "Equation of value at time 0 gives X; the balance is the present value at time k of the remaining payments.",
        presentation: ["direct"],
        params: { L, i, n, k },
        itemFormat: "ordered-pair",
        relationship: "$X = L/a_{\\overline{n|}}$, $B_k = X a_{\\overline{n-k|}}$",
      });
    }

    if (lvl === 2) {
      const i = i0;
      const a = drawUntil(() => rng.int(2, n - 2), (aa) => aa !== k);
      const Pa = round(X0 * v(i, n - a + 1), 2);
      const X = Pa * acc(i, n - a + 1);
      const XE = `${lit(Pa)}*${accPow(i, n - a + 1)}`;
      const B = X * an(n - k, i);
      const alt = (val: number, ex: string): Comp[] => [
        [val, ex],
        [val * an(n - k, i), `${ex}*${aExpr(n - k, i)}`],
      ];
      const Xm = Pa * acc(i, n - a);
      const Xs = Pa * acc(i, a);
      const Xi = Pa / (1 - v(i, n - a + 1));
      const Xv = Pa * v(i, n - a + 1);
      const steps = [
        step("D.principal-component", `Principal in payment ${a} is $X v^{${n - a + 1}}$; solve for X.`, ["X", X, "level payment"], ["P_a", "i"], { rearranged: true }),
        step("D.prospective", `The balance after payment ${k} is the value of the ${n - k} payments still due.`, ["B", B, `balance after payment ${k}`], ["X", "i"]),
      ];
      return compositeQuestion({
        style: "ordered-pair",
        labels: ["Payment", "Balance"],
        formats: fmts,
        stem: `A loan is repaid by ${n} level annual payments, the first one year after the loan is made, at an annual effective interest rate of ${pc(i)}. The principal portion of the ${ord(a)} payment is ${amt(Pa)}.\n\nLet $X$ be the level payment and $B$ the outstanding balance immediately after the ${ord(k)} payment. Calculate $(X, B)$.`,
        correct: {
          parts: [
            [X, XE],
            [B, `${XE}*${aExpr(n - k, i)}`],
          ],
          why: `$X v^{${n - a + 1}} = ${mamt(Pa)}$ gives $X = ${mnum(X, 2)}$; then $B = X\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$.`,
          derivation: `$X = ${mamt(Pa)}(1 + i)^{${n - a + 1}}$: $${tuple([X, B], fmts)}$`,
        },
        wrong: [
          {
            id: "TIMING_MISSING_PERIOD",
            parts: alt(Xm, `${lit(Pa)}*${accPow(i, n - a)}`),
            method: `Used the exponent ${n - a} instead of ${n - a + 1}.`,
            derivation: `$X = ${mamt(Pa)}(1 + i)^{${n - a}}$: $${tuple([Xm, Xm * an(n - k, i)], fmts)}$`,
            why: `Payment ${a} is followed by ${n - a} more payments, so the balance just before it covers ${n - a + 1} payments and its principal portion is $X v^{${n - a + 1}}$.`,
            stage: 0,
            error: "application",
          },
          {
            id: "COMP_PRINCIPAL_FROM_START",
            parts: alt(Xs, `${lit(Pa)}*${accPow(i, a)}`),
            method: `Took the principal portion of payment ${a} as $X v^{${a}}$.`,
            derivation: `$X = ${mamt(Pa)}(1 + i)^{${a}}$: $${tuple([Xs, Xs * an(n - k, i)], fmts)}$`,
            why: `The principal portion is discounted from the end of the loan: $P_${a} = X v^{n - ${a} + 1}$, not $X v^{${a}}$.`,
            stage: 0,
            error: "application",
          },
          {
            id: "VAR_INTEREST_FOR_PRINCIPAL",
            parts: alt(Xi, `${lit(Pa)}/(1-${vPow(i, n - a + 1)})`),
            method: `Treated ${amt(Pa)} as the interest portion.`,
            derivation: `$X(1 - v^{${n - a + 1}}) = ${mamt(Pa)}$: $${tuple([Xi, Xi * an(n - k, i)], fmts)}$`,
            why: `${amt(Pa)} is the principal portion, $X v^{${n - a + 1}}$; $X(1 - v^{${n - a + 1}})$ is the interest portion.`,
            stage: 0,
            error: "interpretation",
          },
          {
            id: "TIMING_BALANCE_INDEX",
            parts: [
              [X, XE],
              [X * an(n - k + 1, i), `${XE}*${aExpr(n - k + 1, i)}`],
            ],
            method: `Valued ${n - k + 1} remaining payments.`,
            derivation: `$B = X\\,${aSym(n - k + 1, "i")}$: $${tuple([X, X * an(n - k + 1, i)], fmts)}$`,
            why: `After payment ${k}, ${n - k} payments remain.`,
            stage: 1,
            error: "application",
          },
          {
            id: "SEQ_UNDISCOUNTED_SUM",
            parts: [
              [X, XE],
              [(n - k) * X, `${n - k}*${XE}`],
            ],
            method: "Added the remaining payments without discounting.",
            derivation: `$B = ${n - k}X$: $${tuple([X, (n - k) * X], fmts)}$`,
            why: "The balance is the present value of the remaining payments, not their sum.",
            stage: 1,
            error: "selection",
          },
          {
            id: "ALG_INVERTED_RATIO",
            parts: alt(Xv, `${lit(Pa)}*${vPow(i, n - a + 1)}`),
            method: "Discounted the principal portion instead of accumulating it.",
            derivation: `$X = ${mamt(Pa)}\\,v^{${n - a + 1}}$: $${tuple([Xv, Xv * an(n - k, i)], fmts)}$`,
            why: `$P_${a} = X v^{${n - a + 1}}$, so $X = P_${a}(1 + i)^{${n - a + 1}}$: the payment is larger than any principal portion.`,
            stage: 0,
            error: "application",
          },
        ],
        reference: {
          description: `X solves "principal in payment ${a} = X − i × (value of payments ${a} to ${n} just before payment ${a})"; B is the sum of the remaining principal portions, each ${amt(Pa)}(1 + i)^(t − ${a}).`,
          values: [
            { expr: `x - ${lit(i)}*x*${pvTerms(level(1, range(1, n - a + 1)), i)} - ${lit(Pa)}`, bracket: [0, 4 * X] },
            { expr: sumOf(range(k + 1, n).map((t) => `${lit(Pa)}*${accPow(i, t - a)}`)) },
          ],
        },
        explanation: explain({
          intuition: "Principal portions of a level-payment loan grow geometrically: the principal in the last payment is X v, in the one before X v², and so on. One known principal portion therefore pins down the payment.",
          unknowns: [
            ["$X$", "level payment"],
            ["$B$", `balance after payment ${k}`],
          ],
          relationships: [`$P_{${a}} = X v^{${n - a + 1}} = ${mamt(Pa)}$`, `$B = X\\,${aSym(n - k, "i")}$`],
          conditions: ["Level annual payments in arrears."],
          valuationDate: `Time ${k} for the balance.`,
          modelChoice: "Principal-portion formula solved for X, then the prospective balance.",
          assumptions: ["Constant annual effective rate."],
          solution: [
            ["Payment", `$X = ${mamt(Pa)}(1.${dec(i, 4).slice(2)})^{${n - a + 1}} = ${mnum(X, 2)}$`],
            ["Balance", `$B = ${mnum(X, 2)}\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$, so $(X, B) = ${tuple([X, B], fmts)}$.`],
          ],
          alternatives: [["Sum of remaining principal", `The balance equals the principal still to be repaid: $B = \\sum_{t=${k + 1}}^{${n}} ${mamt(Pa)}(1 + i)^{t-${a}} = ${mnum(B, 2)}$.`, "When principal portions are given and the payment is not needed."]],
          principle: "Principal portions of a level-payment loan form a geometric sequence with ratio 1 + i; P_k = X v^{n−k+1}.",
          unusual: "Neither the loan amount nor the payment is given; one principal portion replaces them.",
          misread: "Counting the exponent from the start of the loan, or reading the principal portion as interest.",
        }),
        steps,
        methods: ["rearrangement", "substitution"],
        reasoning: "Invert the principal-portion relation for X, then value the remaining payments.",
        presentation: ["inverse"],
        params: { Pa, i, n, a, k },
        itemFormat: "ordered-pair",
        relationship: "$P_k = X v^{n-k+1}$, $B_k = X a_{\\overline{n-k|}}$",
      });
    }

    // Level 3: rate unknown, recovered from two principal portions.
    const a = rng.int(2, Math.floor(n / 2));
    const b = Math.min(n - 1, a + rng.int(2, 5));
    const Pa = round(X0 * v(i0, n - a + 1), 2);
    const Pb = round(X0 * v(i0, n - b + 1), 2);
    const R = Pb / Pa;
    const i = Math.pow(R, 1 / (b - a)) - 1;
    const iE = `((${lit(Pb)}/${lit(Pa)})**(1/${b - a})-1)`;
    const X = Pb * acc(i, n - b + 1);
    const XE = `${lit(Pb)}*${accPow(iE, n - b + 1)}`;
    const B = X * an(n - k, i);
    const withRate = (rate: number, rE: string): Comp[] => {
      const XX = Pb * acc(rate, n - b + 1);
      const XXE = `${lit(Pb)}*${accPow(rE, n - b + 1)}`;
      return [
        [XX, XXE],
        [XX * an(n - k, rate), `${XXE}*${aExpr(n - k, rE)}`],
      ];
    };
    const iRoot = Math.pow(R, 1 / (b - a + 1)) - 1;
    const iRootE = `((${lit(Pb)}/${lit(Pa)})**(1/${b - a + 1})-1)`;
    const iSimple = (R - 1) / (b - a);
    const iSimpleE = `((${lit(Pb)}/${lit(Pa)}-1)/${b - a})`;
    const iInv = Math.pow(1 / R, 1 / (b - a)) - 1;
    const iInvE = `((${lit(Pa)}/${lit(Pb)})**(1/${b - a})-1)`;
    const Xm = Pb * acc(i, n - b);
    const XmE = `${lit(Pb)}*${accPow(iE, n - b)}`;
    const steps = [
      step("D.principal-component", `Principal portions grow by $1 + i$ each period, so $P_{${b}}/P_{${a}} = (1 + i)^{${b - a}}$.`, ["R", R, "ratio of the principal portions"], ["P_a", "P_b"], { derived: true }),
      step("A.compound", `Take the ${b - a}-th root to recover the rate.`, ["i", i, "annual effective rate"], ["R"], { rearranged: true }),
      step("D.principal-component", `$P_{${b}} = X v^{${n - b + 1}}$, solved for X.`, ["X", X, "level payment"], ["P_b", "i"], { rearranged: true }),
      step("D.prospective", `The balance after payment ${k} is the value of the ${n - k} remaining payments.`, ["B", B, `balance after payment ${k}`], ["X", "i"]),
    ];
    const rs = withRate(iRoot, iRootE);
    const ss = withRate(iSimple, iSimpleE);
    const vs = withRate(iInv, iInvE);
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Payment", "Balance"],
      formats: fmts,
      stem: `A loan is repaid by ${n} level annual payments, the first one year after the loan is made. The principal portion of the ${ord(a)} payment is ${amt(Pa)} and the principal portion of the ${ord(b)} payment is ${amt(Pb)}.\n\nLet $X$ be the level payment and $B$ the outstanding balance immediately after the ${ord(k)} payment. Calculate $(X, B)$.`,
      correct: {
        parts: [
          [X, XE],
          [B, `${XE}*${aExpr(n - k, iE)}`],
        ],
        why: `$(1 + i)^{${b - a}} = ${mamt(Pb)}/${mamt(Pa)}$ gives $i = ${dec(i, 6)}$; then $X = ${mamt(Pb)}(1 + i)^{${n - b + 1}} = ${mnum(X, 2)}$ and $B = X\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$.`,
        derivation: `$i = (P_{${b}}/P_{${a}})^{1/${b - a}} - 1$: $${tuple([X, B], fmts)}$`,
      },
      wrong: [
        {
          id: "ALG_ROOT_ERROR",
          parts: rs,
          method: `Took the ${b - a + 1}-th root of the ratio.`,
          derivation: `$i = (${mamt(Pb)}/${mamt(Pa)})^{1/${b - a + 1}} - 1 = ${dec(iRoot, 6)}$: $${tuple([rs[0][0], rs[1][0]], fmts)}$`,
          why: `From payment ${a} to payment ${b} there are ${b - a} periods of growth, so the ratio is $(1 + i)^{${b - a}}$.`,
          stage: 1,
          error: "application",
        },
        {
          id: "MODEL_COMPOUND_AS_SIMPLE",
          parts: ss,
          method: "Treated the growth of the principal portions as simple interest.",
          derivation: `$i = (R - 1)/${b - a} = ${dec(iSimple, 6)}$: $${tuple([ss[0][0], ss[1][0]], fmts)}$`,
          why: "Each principal portion is the previous one times 1 + i, so the growth compounds: $R = (1 + i)^{" + (b - a) + "}$, not $1 + " + (b - a) + "i$.",
          stage: 1,
          error: "selection",
        },
        {
          id: "TIMING_MISSING_PERIOD",
          parts: [
            [Xm, XmE],
            [Xm * an(n - k, i), `${XmE}*${aExpr(n - k, iE)}`],
          ],
          method: `Used the exponent ${n - b} for payment ${b}.`,
          derivation: `$X = P_{${b}}(1 + i)^{${n - b}}$: $${tuple([Xm, Xm * an(n - k, i)], fmts)}$`,
          why: `The principal portion of payment ${b} is $X v^{${n}-${b}+1} = X v^{${n - b + 1}}$.`,
          stage: 2,
          error: "application",
        },
        {
          id: "TIMING_BALANCE_INDEX",
          parts: [
            [X, XE],
            [X * an(n - k + 1, i), `${XE}*${aExpr(n - k + 1, iE)}`],
          ],
          method: `Valued ${n - k + 1} remaining payments.`,
          derivation: `$B = X\\,${aSym(n - k + 1, "i")}$: $${tuple([X, X * an(n - k + 1, i)], fmts)}$`,
          why: `After payment ${k}, ${n - k} payments remain.`,
          stage: 3,
          error: "application",
        },
        {
          id: "SEQ_UNDISCOUNTED_SUM",
          parts: [
            [X, XE],
            [(n - k) * X, `${n - k}*${XE}`],
          ],
          method: "Added the remaining payments without discounting.",
          derivation: `$B = ${n - k}X$: $${tuple([X, (n - k) * X], fmts)}$`,
          why: "The balance is the present value of the remaining payments.",
          stage: 3,
          error: "selection",
        },
        {
          id: "ALG_INVERTED_RATIO",
          parts: vs,
          method: "Inverted the ratio of the principal portions.",
          derivation: `$i = (P_{${a}}/P_{${b}})^{1/${b - a}} - 1 = ${dec(iInv, 6)}$: $${tuple([vs[0][0], vs[1][0]], fmts)}$`,
          why: "Later principal portions are larger, so the growth factor is the later one over the earlier one.",
          stage: 0,
          error: "application",
        },
      ],
      reference: {
        description: `Payment from the earlier principal portion, X = P_${a}(1 + i)^${n - a + 1}; balance as the sum of the remaining principal portions P_${b}(1 + i)^(t − ${b}) for t = ${k + 1}…${n}.`,
        values: [{ expr: `${lit(Pa)}*${accPow(iE, n - a + 1)}` }, { expr: sumOf(range(k + 1, n).map((t) => `${lit(Pb)}*${accPow(iE, t - b)}`)) }],
      },
      explanation: explain({
        intuition: "In a level-payment loan the principal portions grow like a savings account: each is the previous one times 1 + i. Two of them reveal the rate; either one then reveals the payment, and the payment gives the balance.",
        unknowns: [
          ["$i$", "annual effective rate"],
          ["$X$", "level payment"],
          ["$B$", `balance after payment ${k}`],
        ],
        relationships: [`$P_{${b}}/P_{${a}} = (1 + i)^{${b - a}}$`, `$P_{${b}} = X v^{${n - b + 1}}$`, `$B = X\\,${aSym(n - k, "i")}$`],
        conditions: ["Level annual payments in arrears; constant rate."],
        valuationDate: `Time ${k} for the balance.`,
        modelChoice: "The hidden structure is the geometric growth of the principal portions; recognising it turns two numbers into the rate.",
        assumptions: ["No extra payments were made."],
        solution: [
          ["Rate", `$(1 + i)^{${b - a}} = ${mamt(Pb)}/${mamt(Pa)} = ${dec(R, 6)}$, so $i = ${dec(i, 6)}$.`],
          ["Payment", `$X = ${mamt(Pb)}(1 + i)^{${n - b + 1}} = ${mnum(X, 2)}$`],
          ["Balance", `$B = X\\,${aSym(n - k, "i")} = ${mnum(B, 2)}$, so $(X, B) = ${tuple([X, B], fmts)}$.`],
        ],
        alternatives: [["Balance as remaining principal", `$B = \\sum_{t=${k + 1}}^{${n}} P_t$ with $P_t = ${mamt(Pb)}(1 + i)^{t-${b}}$ — the same ${mnum(B, 2)}.`, "A check that needs only the principal portions and the rate."]],
        principle: "Principal portions of a level-payment loan grow geometrically at 1 + i: P_{k+1} = P_k (1 + i).",
        unusual: "The rate is not given; it is hidden in the ratio of two principal portions.",
        misread: "Using the wrong root or a simple-interest ratio for the rate.",
      }),
      steps,
      methods: ["work_backwards", "rearrangement", "substitution"],
      reasoning: "Recognise the principal portions as a geometric sequence, recover the rate, then the payment, then the balance.",
      presentation: ["inverse", "hidden-structure", "work-backwards"],
      modelingDecisions: 2,
      params: { Pa, Pb, n, a, b, k },
      itemFormat: "ordered-pair",
      relationship: "$P_{k+1} = P_k(1 + i)$, $P_k = X v^{n-k+1}$, $B_k = X a_{\\overline{n-k|}}$",
    });
  },
});

// ===================================================================== bonds: (price, book value)

const bondPriceBook = compositeTemplate({
  id: "comp-bond-price-book",
  family: "comp-bond-values",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.book_market",
  secondary: ["BONDS.price_redemption", "BONDS.amortization"],
  reasoning: ["formula_selection", "valuation_dates", "multistep"],
  soaConcept: "Purchase price and later book value of a semiannual-coupon bond, answered as an ordered pair.",
  itemFormat: "ordered-pair",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const years = rng.int(6, 15);
    const N = 2 * years;
    const F = gridAmount(rng, 1000, 10000, 1000);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const Cp = (F * r) / 2;
    const C = lvl === 1 ? F : F * (rng.int(0, 1) ? 1.05 : 1.1);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.11, 0.0025), (yy) => Math.abs(yy - r) >= 0.01);
    const j = lvl === 1 ? y / 2 : Math.pow(1 + y, 0.5) - 1;
    const jE = lvl === 1 ? `(${lit(y)}/2)` : `((1+${lit(y)})**(1/2)-1)`;
    const t = rng.int(2, years - 2);
    const k = 2 * t;
    const fmts = [MONEY2, MONEY2];
    const price = (cp: number, red: number, rate: number, n: number) => cp * an(n, rate) + red * v(rate, n);
    const priceE = (cp: number, red: number, rE: string, n: number) => `${lit(cp)}*${aExpr(n, rE)} + ${lit(red)}*${vPow(rE, n)}`;
    const P = price(Cp, C, j, N);
    const B = price(Cp, C, j, N - k);
    const PE = priceE(Cp, C, jE, N);
    const BE = priceE(Cp, C, jE, N - k);
    const steps: ChainStep[] = [];
    if (lvl === 2) steps.push(step("A.nominal-equivalence", "Coupons are semiannual, so convert the annual effective yield to a semiannual rate.", ["j", j, "yield per half-year"], ["i"]));
    const sP = steps.length;
    steps.push(step("E.price", "Price: coupons as an annuity plus the redemption value, at the purchase yield.", ["P", P, "purchase price"], ["Fr", "C", "j", "n"]));
    const sB = steps.length;
    steps.push(step("E.book-value", `Book value after ${k} coupons: the remaining ${N - k} coupons and the redemption, at the purchase yield.`, ["B", B, `book value at year ${t}`], ["Fr", "C", "j"]));

    const wrong: WrongOption[] = [];
    if (lvl === 2) {
      const jd = y / 2;
      const jdE = `(${lit(y)}/2)`;
      wrong.push({
        id: "RATE_DIVIDED_EFFECTIVE",
        parts: [
          [price(Cp, C, jd, N), priceE(Cp, C, jdE, N)],
          [price(Cp, C, jd, N - k), priceE(Cp, C, jdE, N - k)],
        ],
        method: `Used ${pc(y)}/2 as the semiannual yield.`,
        derivation: `$j = ${mpc(y)}/2$: $${tuple([price(Cp, C, jd, N), price(Cp, C, jd, N - k)], fmts)}$`,
        why: `${pc(y)} is an annual effective yield; the equivalent semiannual rate is $(1 + ${mpc(y)})^{1/2} - 1 = ${dec(j, 6)}$, not half of it.`,
        stage: 0,
        error: "application",
        conditionTrue: `If the yield were ${pc(y)} convertible semiannually.`,
      });
    }
    const Pa = price(2 * Cp, C, j, N);
    const Ba = price(2 * Cp, C, j, N - k);
    const Bs = P - (k * (P - C)) / N;
    const By = price(Cp, C, j, N - t);
    wrong.push(
      {
        id: "RATE_ANNUAL_FOR_PERIODIC",
        parts: [
          [Pa, priceE(2 * Cp, C, jE, N)],
          [Ba, priceE(2 * Cp, C, jE, N - k)],
        ],
        method: `Paid the full annual coupon, ${amt(2 * Cp)}, every half-year.`,
        derivation: `coupon $= ${mamt(F)} \\times ${mpc(r)}$ per half-year: $${tuple([Pa, Ba], fmts)}$`,
        why: `A coupon rate of ${pc(r)} convertible semiannually pays $${mamt(F)} \\times ${mpc(r)}/2 = ${mamt(Cp)}$ each half-year.`,
        stage: sP,
        error: "application",
      },
      {
        id: "MODEL_STRAIGHT_LINE",
        parts: [
          [P, PE],
          [Bs, `(${PE}) - ${k}*((${PE}) - ${lit(C)})/${N}`],
        ],
        method: "Amortized the premium or discount in equal amounts each half-year.",
        derivation: `$B = P - ${k}(P - C)/${N}$: $${tuple([P, Bs], fmts)}$`,
        why: "Book value follows the scientific (yield) method: it is the present value of the remaining payments at the purchase yield, so the write-down is not level.",
        stage: sB,
        error: "selection",
        conditionTrue: "Under straight-line amortization, which the book value here does not use.",
      },
      {
        id: "COMP_PERIODS_AS_YEARS",
        parts: [
          [P, PE],
          [By, priceE(Cp, C, jE, N - t)],
        ],
        method: `Treated ${t} years as ${t} coupon periods.`,
        derivation: `$${N} - ${t} = ${N - t}$ periods remaining: $${tuple([P, By], fmts)}$`,
        why: `At the end of year ${t}, ${k} semiannual coupons have been paid, so ${N - k} periods remain, not ${N - t}.`,
        stage: sB,
        error: "application",
      },
      {
        id: "CONC_IGNORED_REDEMPTION",
        parts: [
          [Cp * an(N, j), `${lit(Cp)}*${aExpr(N, jE)}`],
          [Cp * an(N - k, j), `${lit(Cp)}*${aExpr(N - k, jE)}`],
        ],
        method: "Valued the coupons only.",
        derivation: `$P = ${mamt(Cp)}\\,${aj(N)}$: $${tuple([Cp * an(N, j), Cp * an(N - k, j)], fmts)}$`,
        why: `The bond also repays ${amt(C)} at maturity; both price and book value include its present value.`,
        stage: sP,
        error: "selection",
      },
      {
        id: "CONC_PAR_ASSUMPTION",
        parts: [
          [C, lit(C)],
          [C, lit(C)],
        ],
        method: "Assumed the bond sells and is carried at its redemption value.",
        derivation: `$P = B = ${mamt(C)}$`,
        why: `The coupon per half-year (${amt(Cp)}) differs from $C j = ${mnum(C * j, 2)}$, so the bond sells at a ${Cp > C * j ? "premium" : "discount"} and its book value moves toward ${amt(C)} only gradually.`,
        stage: sP,
        error: "selection",
        conditionTrue: "If the coupon per period equalled C times the yield per period.",
      }
    );

    const flowsAll = [...range(1, N).map((tt) => ({ t: tt, amount: Cp })), { t: N, amount: C }];
    const flowsRest = [...range(1, N - k).map((tt) => ({ t: tt, amount: Cp })), { t: N - k, amount: C }];
    const yieldText = lvl === 1 ? `${pc(y)} per year convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Price", "Book value"],
      formats: fmts,
      stem: `A ${years}-year bond with face amount ${amt(F)} pays coupons at an annual rate of ${pc(r)} convertible semiannually and is redeemable at ${lvl === 1 ? "par" : amt(C)}. It is purchased to yield ${yieldText}.\n\nLet $P$ be the purchase price and $B$ the book value at the end of year ${t}, immediately after the coupon then due. Calculate $(P, B)$.`,
      correct: {
        parts: [
          [P, PE],
          [B, BE],
        ],
        why: `$P = ${mamt(Cp)}\\,${aj(N)} + ${mamt(C)}v^{${N}} = ${mnum(P, 2)}$ and $B = ${mamt(Cp)}\\,${aj(N - k)} + ${mamt(C)}v^{${N - k}} = ${mnum(B, 2)}$.`,
        derivation: `$${tuple([P, B], fmts)}$`,
      },
      wrong,
      reference: {
        description: "Every coupon and the redemption payment discounted individually at the semiannual yield: from time 0 for the price, and from the end of year t for the book value.",
        values: [{ expr: pvTerms(flowsAll, jE) }, { expr: pvTerms(flowsRest, jE) }],
      },
      explanation: explain({
        intuition: "Price and book value are the same calculation at two dates: the present value, at the yield fixed at purchase, of the payments the holder is still to receive.",
        unknowns: [
          ["$P$", "price at purchase"],
          ["$B$", `book value at the end of year ${t}`],
        ],
        relationships: [`$P = Fr\\,${aj(N)} + C v^{${N}}$`, `$B = Fr\\,${aj(N - k)} + C v^{${N - k}}$`],
        conditions: ["Book value uses the purchase yield, not the market yield at the later date."],
        valuationDate: `Time 0 for the price; the end of year ${t} (after ${k} coupons) for the book value.`,
        modelChoice: "Work in half-years: semiannual coupon and semiannual yield.",
        assumptions: ["Book value is computed by the scientific (yield) method."],
        solution: [
          ...(lvl === 2 ? [["Semiannual yield", `$j = (1 + ${mpc(y)})^{1/2} - 1 = ${dec(j, 6)}$`] as [string, string]] : [["Semiannual yield", `$j = ${mpc(y)}/2 = ${dec(j, 6)}$`] as [string, string]]),
          ["Price", `$P = ${mamt(Cp)}\\,${aj(N)} + ${mamt(C)}v^{${N}} = ${mnum(P, 2)}$`],
          ["Book value", `${N - k} half-years remain: $B = ${mamt(Cp)}\\,${aj(N - k)} + ${mamt(C)}v^{${N - k}} = ${mnum(B, 2)}$, so $(P, B) = ${tuple([P, B], fmts)}$.`],
        ],
        alternatives: [["Premium/discount formula", `$P = C + (Fr - Cj)\\,${aj(N)}$ and $B = C + (Fr - Cj)\\,${aj(N - k)}$.`, "Quick when only the premium or discount is needed."]],
        principle: "Book value at any coupon date is the present value of the remaining coupons and redemption at the yield set at purchase.",
        unusual: lvl === 2 ? "The yield is annual effective and the redemption value differs from face." : "Time is stated in years but the bond works in half-years.",
        misread: "Counting years as coupon periods, or paying the full annual coupon each half-year.",
      }),
      steps,
      methods: ["decomposition"],
      reasoning: "Value coupons and redemption separately at the semiannual yield, at purchase and again after k coupons.",
      presentation: lvl === 2 ? ["frequency", "valuation-date"] : ["valuation-date"],
      params: { F, r, C, y, years, t },
      itemFormat: "ordered-pair",
      relationship: "$P = Fr\\,a_{\\overline{n|}j} + C v^n$; $B_k = Fr\\,a_{\\overline{n-k|}j} + C v^{n-k}$",
      visuals: [{ kind: "bond", title: "Book value toward redemption", face: F, couponRate: r / 2, redemption: C, yieldRate: j, periods: N, unit: "half-year", highlightPeriod: k }],
    });
  },
});

// ===================================================================== spot and forward rates from bond prices

const spotForwardPair = compositeTemplate({
  id: "comp-spot-forward-pair",
  family: "comp-spot-forward",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "translation", "algebra"],
  soaConcept: "A two-year spot rate and the one-year forward rate recovered from bond prices, answered as an ordered pair.",
  itemFormat: "ordered-pair",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const s1t = gridRate(rng, 0.02, 0.05, 0.0025);
    const s2t = s1t + gridRate(rng, 0.0075, 0.02, 0.0025);
    const P1 = round(100 / (1 + s1t), 3);
    const fmts = [PCT2, PCT2];
    const s1 = 100 / P1 - 1;
    const s1E = `(100/${lit(P1)}-1)`;
    let s2: number;
    let s2E: string;
    let stem: string;
    let refS2: { expr: string; bracket: [number, number] };
    let refF: { expr: string; bracket: [number, number] };
    let P2 = 0;
    let Pc = 0;
    let cc = 0;
    if (lvl === 1) {
      P2 = round(100 / Math.pow(1 + s2t, 2), 3);
      s2 = Math.sqrt(100 / P2) - 1;
      s2E = `((100/${lit(P2)})**(1/2)-1)`;
      stem = `A one-year zero-coupon bond with face amount 100 sells for ${num(P1, 3)}. A two-year zero-coupon bond with face amount 100 sells for ${num(P2, 3)}.\n\nLet $s_2$ be the two-year spot rate and $f$ the one-year forward rate from time 1 to time 2, both annual effective. Calculate $(s_2, f)$.`;
      refS2 = { expr: `${lit(P2)}*(1+x)**2 - 100`, bracket: [0, 0.5] };
      refF = { expr: `(100/${lit(P1)})*(1+x) - 100/${lit(P2)}`, bracket: [-0.2, 0.5] };
    } else {
      cc = round(100 * gridRate(rng, 0.03, 0.08, 0.005), 2);
      Pc = round(cc / (1 + s1t) + (100 + cc) / Math.pow(1 + s2t, 2), 3);
      const denom = Pc - (cc * P1) / 100;
      s2 = Math.sqrt((100 + cc) / denom) - 1;
      s2E = `((${lit(100 + cc)}/(${lit(Pc)} - ${lit(cc)}*${lit(P1)}/100))**(1/2)-1)`;
      stem = `A one-year zero-coupon bond with face amount 100 sells for ${num(P1, 3)}. A two-year bond with face amount 100 and annual coupons of ${num(cc, 2)}, redeemable at par, sells for ${num(Pc, 3)}.\n\nLet $s_2$ be the two-year spot rate and $f$ the one-year forward rate from time 1 to time 2, both annual effective. Calculate $(s_2, f)$.`;
      refS2 = { expr: `${lit(cc)}*${lit(P1)}/100 + ${lit(100 + cc)}*(1+x)**(-2) - ${lit(Pc)}`, bracket: [0, 0.5] };
      refF = { expr: `${lit(cc)}*${lit(P1)}/100 + ${lit(100 + cc)}*(${lit(P1)}/100)/(1+x) - ${lit(Pc)}`, bracket: [-0.2, 0.5] };
    }
    const f = Math.pow(1 + s2, 2) / (1 + s1) - 1;
    const fE = `(1+${s2E})**2/(1+${s1E}) - 1`;
    const steps: ChainStep[] = [
      step("F.spot", "The one-year zero-coupon price gives the one-year spot rate.", ["s_1", s1, "one-year spot rate"], ["P_1"]),
      lvl === 1
        ? step("F.spot", "The two-year zero-coupon price gives the two-year spot rate.", ["s_2", s2, "two-year spot rate"], ["P_2"])
        : step("F.spot-pricing", "Price the coupon bond on the spot curve; the only unknown is the two-year discount factor.", ["s_2", s2, "two-year spot rate"], ["P_c", "s_1"], { rearranged: true }),
      step("F.forward", "Investing for two years equals investing for one year and rolling over at the forward rate.", ["f", f, "forward rate from 1 to 2"], ["s_1", "s_2"]),
    ];
    const fNo = (1 + s2) / (1 + s1) - 1;
    const wrong: WrongOption[] = [];
    if (lvl === 1) {
      const sNoRoot = 100 / P2 - 1;
      const sSimple = (100 / P2 - 1) / 2;
      wrong.push(
        {
          id: "ALG_ROOT_ERROR",
          parts: [
            [sNoRoot, `100/${lit(P2)} - 1`],
            [f, fE],
          ],
          method: "Read the two-year growth factor as an annual rate.",
          derivation: `$s_2 = 100/${num(P2, 3)} - 1$: $${tuple([sNoRoot, f], fmts)}$`,
          why: `$100/${num(P2, 3)}$ is the accumulation over two years, $(1 + s_2)^2$; the annual spot rate is its square root minus 1.`,
          stage: 1,
          error: "application",
        },
        {
          id: "MODEL_COMPOUND_AS_SIMPLE",
          parts: [
            [sSimple, `(100/${lit(P2)} - 1)/2`],
            [f, fE],
          ],
          method: "Annualised the two-year return by dividing by 2.",
          derivation: `$s_2 = (100/${num(P2, 3)} - 1)/2$: $${tuple([sSimple, f], fmts)}$`,
          why: "Spot rates are annual effective (compound) rates: $(1 + s_2)^2 = 100/P_2$, not $1 + 2s_2$.",
          stage: 1,
          error: "selection",
        }
      );
    } else {
      const sIgn = Math.sqrt((100 + cc) / Pc) - 1;
      const sIgnE = `((${lit(100 + cc)}/${lit(Pc)})**(1/2)-1)`;
      const ytm = solveRoot((x) => cc / (1 + x) + (100 + cc) / Math.pow(1 + x, 2) - Pc, -0.5, 1);
      const ytmE = `${lit(cc)}*(1+x)**(-1) + ${lit(100 + cc)}*(1+x)**(-2) - ${lit(Pc)}`;
      wrong.push(
        {
          id: "MODEL_IGNORED_COUPON",
          parts: [
            [sIgn, sIgnE],
            [Math.pow(1 + sIgn, 2) / (1 + s1) - 1, `(1+${sIgnE})**2/(1+${s1E}) - 1`],
          ],
          method: "Ignored the coupon paid at time 1.",
          derivation: `$(1 + s_2)^2 = ${num(100 + cc, 2)}/${num(Pc, 3)}$: $${tuple([sIgn, Math.pow(1 + sIgn, 2) / (1 + s1) - 1], fmts)}$`,
          why: `Part of the price, $${num(cc, 2)} \\times ${num(P1, 3)}/100$, pays for the time-1 coupon; only the rest buys the time-2 payment.`,
          stage: 1,
          error: "application",
        },
        {
          id: "MODEL_SINGLE_RATE",
          parts: [
            [ytm, ytmE],
            [ytm, ytmE],
          ],
          method: "Used the coupon bond's yield to maturity as the spot rate for both years.",
          derivation: `yield of the coupon bond $= ${dec(ytm, 6)}$ for $s_2$ and $f$: $${tuple([ytm, ytm], fmts)}$`,
          why: "The coupon bond's yield blends the one- and two-year rates; the two-year spot rate must be bootstrapped using the one-year rate for the first coupon.",
          stage: 1,
          error: "selection",
          conditionTrue: "If the yield curve were flat.",
        }
      );
    }
    wrong.push(
      {
        id: "COMP_FORWARD_RATIO_NO_POWERS",
        parts: [
          [s2, s2E],
          [fNo, `(1+${s2E})/(1+${s1E}) - 1`],
        ],
        method: "Divided $1 + s_2$ by $1 + s_1$ without the powers.",
        derivation: `$f = (1 + s_2)/(1 + s_1) - 1$: $${tuple([s2, fNo], fmts)}$`,
        why: "The forward factor links the accumulation factors: $(1 + s_1)(1 + f) = (1 + s_2)^2$, so $f = (1 + s_2)^2/(1 + s_1) - 1$.",
        stage: 2,
        error: "application",
      },
      {
        id: "COMP_PAIR_REVERSED",
        parts: [
          [f, fE],
          [s2, s2E],
        ],
        method: "Reported the forward rate first.",
        derivation: `$(f, s_2)$: $${tuple([f, s2], fmts)}$`,
        why: `The pair is $(s_2, f)$: $s_2 = ${dec(s2, 6)}$ and $f = ${dec(f, 6)}$.`,
        stage: 2,
        error: "interpretation",
      },
      {
        id: "FORMULA_ARITHMETIC_FORWARD",
        parts: [
          [s2, s2E],
          [2 * s2 - s1, `2*${s2E} - ${s1E}`],
        ],
        method: "Took $f = 2s_2 - s_1$.",
        derivation: `$f = 2s_2 - s_1$: $${tuple([s2, 2 * s2 - s1], fmts)}$`,
        why: "Rates combine through accumulation factors, not linearly; $2s_2 - s_1$ only approximates the forward rate.",
        stage: 2,
        error: "selection",
      }
    );
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Two-year spot rate", "Forward rate"],
      formats: fmts,
      stem,
      correct: {
        parts: [
          [s2, s2E],
          [f, fE],
        ],
        why: `$s_1 = ${dec(s1, 6)}$, $s_2 = ${dec(s2, 6)}$, and $(1 + s_1)(1 + f) = (1 + s_2)^2$ gives $f = ${dec(f, 6)}$.`,
        derivation: `$${tuple([s2, f], fmts)}$`,
      },
      wrong,
      reference: {
        description: lvl === 1 ? "s_2 solves P_2(1 + x)² = 100; f solves (1 + s_1)(1 + x) = 100/P_2 with 1 + s_1 = 100/P_1." : "s_2 solves the coupon bond's pricing equation on the spot curve; f solves the same price written with the time-2 payment discounted at s_1 then f.",
        values: [refS2, refF],
      },
      explanation: explain({
        intuition: "A zero-coupon price is a discount factor. The two-year factor gives the two-year spot rate; dividing the one-year factor by the two-year factor gives the growth promised for the second year alone — the forward rate.",
        unknowns: [
          ["$s_1, s_2$", "one- and two-year spot rates"],
          ["$f$", "forward rate from time 1 to time 2"],
        ],
        relationships: lvl === 1 ? ["$P_1 = 100(1 + s_1)^{-1}$", "$P_2 = 100(1 + s_2)^{-2}$", "$(1 + s_1)(1 + f) = (1 + s_2)^2$"] : ["$P_1 = 100(1 + s_1)^{-1}$", `$P_c = ${num(cc, 2)}(1 + s_1)^{-1} + ${num(100 + cc, 2)}(1 + s_2)^{-2}$`, "$(1 + s_1)(1 + f) = (1 + s_2)^2$"],
        conditions: ["No-arbitrage pricing on one spot curve."],
        valuationDate: "Time 0.",
        modelChoice: lvl === 1 ? "Read discount factors from zero-coupon prices." : "Bootstrap: strip the first coupon at the one-year rate, then solve for the two-year factor.",
        assumptions: ["Annual effective rates."],
        solution: [
          ["One-year spot rate", `$s_1 = 100/${num(P1, 3)} - 1 = ${dec(s1, 6)}$`],
          lvl === 1
            ? ["Two-year spot rate", `$(1 + s_2)^2 = 100/${num(P2, 3)}$, so $s_2 = ${dec(s2, 6)}$`]
            : ["Two-year spot rate", `$(1 + s_2)^{-2} = (${num(Pc, 3)} - ${num(cc, 2)} \\times ${num(P1 / 100, 5)})/${num(100 + cc, 2)}$, so $s_2 = ${dec(s2, 6)}$`],
          ["Forward rate", `$1 + f = (1 + s_2)^2/(1 + s_1)$, so $f = ${dec(f, 6)}$ and $(s_2, f) = ${tuple([s2, f], fmts)}$.`],
        ],
        alternatives: [["Ratio of prices", lvl === 1 ? `$1 + f = P_1/P_2 = ${num(P1, 3)}/${num(P2, 3)}$.` : "$1 + f = (100/P_2^{*})/(100/P_1)$, where $P_2^{*}$ is the implied two-year zero price.", "Fast whenever zero-coupon prices are available."]],
        principle: "Zero-coupon prices are discount factors; forward rates are ratios of accumulation factors: (1 + s_1)(1 + f) = (1 + s_2)².",
        unusual: lvl === 2 ? "The two-year rate must be stripped out of a coupon bond's price." : "Rates are given only through prices.",
        misread: "Dividing one-year factors without the powers, or reporting the pair in the wrong order.",
      }),
      steps,
      methods: lvl === 1 ? ["rearrangement"] : ["substitution", "rearrangement"],
      reasoning: "Prices give discount factors; equate investing long with investing short and rolling over.",
      presentation: lvl === 1 ? ["direct"] : ["inverse", "hidden-structure"],
      params: { P1, P2, Pc, cc },
      itemFormat: "ordered-pair",
      relationship: "$(1 + s_1)(1 + f_{1,2}) = (1 + s_2)^2$",
    });
  },
});

// ===================================================================== table-driven: spot (or forward) table → (price, yield)

const spotTableBond = compositeTemplate({
  id: "comp-spot-table-bond",
  family: "comp-yield-curve",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward", "BONDS.yield", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "cashflow_modelling", "multistep"],
  soaConcept: "A coupon bond priced from a table of spot (or one-year forward) rates, and its yield to maturity.",
  itemFormat: "table-driven",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const n = lvl === 1 ? 3 : 4;
    const rates: number[] = [gridRate(rng, 0.02, 0.045, 0.0025)];
    for (let t = 1; t < n; t += 1) rates.push(round(rates[t - 1] + gridRate(rng, 0.005, 0.015, 0.0025), 4));
    const F = 1000;
    const c = gridRate(rng, 0.03, 0.08, 0.005);
    const cpn = F * c;
    const fmts = [MONEY2, PCT2];
    // Discount factors.
    const df = (t: number) => (lvl === 1 ? Math.pow(1 + rates[t - 1], -t) : rates.slice(0, t).reduce((p, f) => p / (1 + f), 1));
    const dfE = (t: number) => (lvl === 1 ? vPow(lit(rates[t - 1]), t) : rates.slice(0, t).map((f) => `(1+${lit(f)})**(-1)`).join("*"));
    const flows = (cp: number) => [...range(1, n).map((t) => ({ t, amount: cp })), { t: n, amount: F }];
    const priceE = sumOf(range(1, n).map((t) => `${lit(t === n ? cpn + F : cpn)}*${dfE(t)}`));
    const P = range(1, n).reduce((s, t) => s + (t === n ? cpn + F : cpn) * df(t), 0);
    const ytmOf = (price: number) => solveRoot((x) => pvFlows(flows(cpn), x) - price, -0.5, 1);
    const ytmE = (pE: string) => `${pvTerms(flows(cpn), "x")} - (${pE})`;
    const y = ytmOf(P);
    const sn_ = lvl === 1 ? rates[n - 1] : Math.pow(range(1, n).reduce((p, t) => p * (1 + rates[t - 1]), 1), 1 / n) - 1;
    const snE = lvl === 1 ? lit(rates[n - 1]) : `(${rates.map((f) => `(1+${lit(f)})`).join("*")})**(1/${n})-1`;

    // Alternative discounting: spots read as forwards (level 1) or forwards read as spots (level 2).
    const dfAlt = (t: number) => (lvl === 1 ? rates.slice(0, t).reduce((p, s) => p / (1 + s), 1) : Math.pow(1 + rates[t - 1], -t));
    const dfAltE = (t: number) => (lvl === 1 ? rates.slice(0, t).map((s) => `(1+${lit(s)})**(-1)`).join("*") : vPow(lit(rates[t - 1]), t));
    const PAlt = range(1, n).reduce((s, t) => s + (t === n ? cpn + F : cpn) * dfAlt(t), 0);
    const PAltE = sumOf(range(1, n).map((t) => `${lit(t === n ? cpn + F : cpn)}*${dfAltE(t)}`));
    const PFlat = pvFlows(flows(cpn), sn_);
    const PFlatE = pvTerms(flows(cpn), `(${snE})`);

    const steps: ChainStep[] = [];
    if (lvl === 2) steps.push(step("F.forward-chain", "Chain the one-year forward rates into discount factors for each maturity.", [`s_${n}`, sn_, `${n}-year spot rate`], ["f_{t-1,t}"]));
    const sP = steps.length;
    steps.push(step("F.spot-pricing", "Discount each payment at the rate for its own maturity.", ["P", P, "price"], ["spot curve"]));
    steps.push(step("E.price", "The yield to maturity is the single rate that reproduces this price.", ["y", y, "yield to maturity"], ["P"], { rearranged: true }));
    const sY = steps.length - 1;

    const exhibit: Exhibit = {
      type: "table",
      caption: lvl === 1 ? "Annual effective spot rates" : "Annual effective one-year forward rates",
      columns: lvl === 1 ? ["Term $t$ (years)", "Spot rate $s_t$"] : ["Year $t$", "Forward rate from time $t-1$ to time $t$"],
      rows: range(1, n).map((t) => [String(t), `${pc(rates[t - 1], 3)}`]),
    };
    const wrong: WrongOption[] = [
      {
        id: lvl === 1 ? "COMP_SPOT_AS_FORWARD" : "COMP_FORWARD_AS_SPOT",
        parts: [
          [PAlt, PAltE],
          [ytmOf(PAlt), ytmE(PAltE)],
        ],
        method: lvl === 1 ? "Discounted year by year, multiplying $(1 + s_u)^{-1}$ for $u \\le t$." : "Used each forward rate as the spot rate for its maturity, $(1 + f_t)^{-t}$.",
        derivation: `price $= ${mnum(PAlt, 2)}$, yield $= ${dec(ytmOf(PAlt), 6)}$`,
        why: lvl === 1 ? "A t-year spot rate already covers all t years: $v(t) = (1 + s_t)^{-t}$. Chaining the spot rates treats them as one-year forward rates." : "Each forward rate covers only its own year, so the discount factor for time t is the product $\\prod_{u \\le t}(1 + f_{u-1,u})^{-1}$.",
        stage: sP,
        error: "selection",
      },
      {
        id: "MODEL_SINGLE_RATE",
        parts: [
          [PFlat, PFlatE],
          [sn_, snE],
        ],
        method: `Discounted every payment at the ${n}-year spot rate.`,
        derivation: `$P$ at $s_${n} = ${dec(sn_, 6)}$: $${tuple([PFlat, sn_], fmts)}$`,
        why: `Coupons paid before time ${n} are discounted at the lower shorter-term rates, so the price is higher and the yield lower than $s_${n}$.`,
        stage: sP,
        error: "selection",
        conditionTrue: "If the yield curve were flat.",
      },
      {
        id: "COMP_YIELD_AS_LONGEST_SPOT",
        parts: [
          [P, priceE],
          [sn_, snE],
        ],
        method: `Priced correctly but gave the ${n}-year spot rate as the yield.`,
        derivation: `$${tuple([P, sn_], fmts)}$`,
        why: `The yield is the single rate reproducing the price: ${dec(y, 6)}, which lies below $s_${n}$ because the coupons are discounted at shorter rates.`,
        stage: sY,
        error: "interpretation",
      },
      {
        id: "FORMULA_CURRENT_YIELD",
        parts: [
          [P, priceE],
          [cpn / P, `${lit(cpn)}/(${priceE})`],
        ],
        method: "Took the yield as coupon ÷ price.",
        derivation: `$${mamt(cpn)}/${mnum(P, 2)}$: $${tuple([P, cpn / P], fmts)}$`,
        why: `Coupon ÷ price is the current yield; it ignores the ${P > F ? "loss" : "gain"} of ${amt(Math.abs(F - P))} at redemption.`,
        stage: sY,
        error: "selection",
      },
      {
        id: "CONC_PAR_ASSUMPTION",
        parts: [
          [F, lit(F)],
          [c, lit(c)],
        ],
        method: "Assumed the bond sells at par, so its yield equals its coupon rate.",
        derivation: `$${tuple([F, c], fmts)}$`,
        why: "A bond sells at par only if its coupon rate equals its yield; here the coupon rate is not the rate implied by the curve.",
        stage: sP,
        error: "selection",
      },
    ];
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Price", "Yield"],
      formats: fmts,
      stem: `The table shows annual effective ${lvl === 1 ? "spot rates" : "one-year forward rates"}. A ${n}-year bond with face amount ${amt(F)} pays annual coupons at a rate of ${pc(c)} and is redeemable at par.\n\nLet $P$ be the price of the bond and $y$ its annual effective yield to maturity. Calculate $(P, y)$.`,
      exhibits: [exhibit],
      correct: {
        parts: [
          [P, priceE],
          [y, ytmE(priceE)],
        ],
        why: `$P = ${mnum(P, 2)}$ from the curve; the single rate giving that price is $y = ${dec(y, 6)}$.`,
        derivation: `$${tuple([P, y], fmts)}$`,
      },
      wrong,
      reference: {
        description: lvl === 1 ? "Each payment discounted at its own spot rate; the yield solves the price equation at one rate (bracketed root)." : "Discount factors as products of the one-year forward factors; the yield solves the price equation at one rate (bracketed root).",
        values: [
          { expr: range(1, n).map((t) => `${lit(cpn)}*${dfE(t)}`).join(" + ") + ` + ${lit(F)}*${dfE(n)}` },
          { expr: `${pvTerms(flows(cpn), "x")} - (${range(1, n).map((t) => `${lit(cpn)}*${dfE(t)}`).join(" + ")} + ${lit(F)}*${dfE(n)})`, bracket: [-0.2, 0.5] },
        ],
      },
      explanation: explain({
        intuition: "The curve prices each payment separately; the yield to maturity then compresses all those rates into one number that reproduces the same price — a weighted blend dominated by the large final payment.",
        unknowns: [
          ["$P$", "price"],
          ["$y$", "yield to maturity"],
        ],
        relationships: [lvl === 1 ? "$P = \\sum_t CF_t (1 + s_t)^{-t}$" : "$P = \\sum_t CF_t \\prod_{u \\le t}(1 + f_{u-1,u})^{-1}$", "$P = \\sum_t CF_t (1 + y)^{-t}$"],
        conditions: ["No-arbitrage: each payment is worth its amount times the discount factor for its date."],
        valuationDate: "Time 0.",
        modelChoice: lvl === 1 ? "Spot rates discount from time 0 over the full term." : "Forward rates chain year by year.",
        assumptions: ["Annual coupons, redeemable at par."],
        solution: [
          ...(lvl === 2 ? [["Discount factors", range(1, n).map((t) => `$v(${t}) = ${dec(df(t), 6)}$`).join(", ")] as [string, string]] : []),
          ["Price", `$P = ${range(1, n).map((t) => `${mamt(t === n ? cpn + F : cpn)}(${dec(df(t), 6)})`).join(" + ")} = ${mnum(P, 2)}$`],
          ["Yield", `Solve $${mamt(cpn)}\\,${aSym(n, "y")} + ${mamt(F)}(1 + y)^{-${n}} = ${mnum(P, 2)}$: $y = ${dec(y, 6)}$, so $(P, y) = ${tuple([P, y], fmts)}$.`],
        ],
        alternatives: [["Calculator cash-flow worksheet", "Enter the coupons and redemption, set the price as a negative time-0 flow, and compute IRR.", "Fastest for the yield step."]],
        principle: "Price a bond on the curve payment by payment; its yield to maturity is the single rate that reproduces that price and lies between the shortest and longest relevant rates.",
        unusual: lvl === 2 ? "The table gives forward rates, not spot rates." : "A table of rates replaces a single yield.",
        misread: lvl === 1 ? "Chaining spot rates as if they were one-year forwards." : "Using forward rates as spot rates.",
      }),
      steps,
      methods: ["decomposition", "numerical_root"],
      reasoning: "Discount each payment at the curve's factor for its date, then solve for the level rate giving the same price.",
      presentation: lvl === 1 ? ["direct"] : ["hidden-structure"],
      features: lvl === 2 ? { unfamiliar: true } : {},
      params: { n, c, rates: JSON.stringify(rates) },
      itemFormat: "table-driven",
      relationship: "$P = \\sum_t CF_t\\,v(t)$; $y$ solves $P = \\sum_t CF_t (1 + y)^{-t}$",
    });
  },
});

// ===================================================================== table-driven: (dollar-weighted, time-weighted) returns

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fundReturns = compositeTemplate({
  id: "comp-dwr-twr",
  family: "comp-fund-returns",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.rates_of_return",
  secondary: ["TVM.equation_of_value"],
  reasoning: ["cashflow_modelling", "valuation_dates", "translation"],
  soaConcept: "Dollar-weighted and time-weighted returns of a fund from a table of values and transactions, answered as an ordered pair.",
  itemFormat: "table-driven",
  variants: 2,
  generate(rng, lvl, variant): ChoiceDraft {
    const exact = variant === 0;
    const fmts = [PCT2, PCT2];
    type Tx = { m: number; amount: number };
    const draw = () => {
      const V0 = gridAmount(rng, 40000, 200000, 1000);
      const count = lvl === 1 ? 1 : 2;
      const months = count === 1 ? [rng.int(3, 9)] : [rng.int(2, 5), rng.int(7, 10)];
      const rs = range(0, count).map(() => gridRate(rng, -0.06, 0.12, 0.01));
      const txs: Tx[] = months.map((m, idx) => ({ m, amount: idx === 0 ? gridAmount(rng, Math.round(V0 * 0.4 / 1000) * 1000, Math.round(V0 * 1.2 / 1000) * 1000, 1000) : -gridAmount(rng, Math.round(V0 * 0.15 / 1000) * 1000, Math.round(V0 * 0.4 / 1000) * 1000, 1000) }));
      const before: number[] = [];
      let value = V0;
      for (let s = 0; s < count; s += 1) {
        value = Math.round((value * (1 + rs[s])) / 100) * 100;
        before.push(value);
        value += txs[s].amount;
      }
      const end = Math.round((value * (1 + rs[count])) / 100) * 100;
      return { V0, txs, before, end };
    };
    const twrOf = (d: ReturnType<typeof draw>, shifted = false) => {
      // shifted: the flow is added to the earlier sub-period's closing value.
      let g = 1;
      let start = d.V0;
      d.txs.forEach((tx, s) => {
        g *= shifted ? (d.before[s] + tx.amount) / start : d.before[s] / start;
        start = shifted ? d.before[s] : d.before[s] + tx.amount;
      });
      return g * (d.end / start) - 1;
    };
    const twrE = (d: ReturnType<typeof draw>, shifted = false) => {
      const factors: string[] = [];
      let start = lit(d.V0);
      d.txs.forEach((tx, s) => {
        factors.push(shifted ? `(${lit(d.before[s])} + ${lit(tx.amount)})/${start}` : `${lit(d.before[s])}/${start}`);
        start = shifted ? lit(d.before[s]) : `(${lit(d.before[s])} + ${lit(tx.amount)})`;
      });
      return `${factors.map((f) => `(${f})`).join("*")}*(${lit(d.end)}/${start}) - 1`;
    };
    const subReturns = (d: ReturnType<typeof draw>) => {
      const out: number[] = [];
      let start = d.V0;
      d.txs.forEach((tx, s) => {
        out.push(d.before[s] / start - 1);
        start = d.before[s] + tx.amount;
      });
      out.push(d.end / start - 1);
      return out;
    };
    const subReturnsE = (d: ReturnType<typeof draw>) => {
      const out: string[] = [];
      let start = lit(d.V0);
      d.txs.forEach((tx, s) => {
        out.push(`(${lit(d.before[s])}/${start} - 1)`);
        start = `(${lit(d.before[s])} + ${lit(tx.amount)})`;
      });
      out.push(`(${lit(d.end)}/${start} - 1)`);
      return out;
    };
    // Dollar-weighted: exact (compound) and simple approximation; `elapsed` weights each flow by m/12 instead of 1 - m/12.
    const dwrExactE = (d: ReturnType<typeof draw>, elapsed = false) =>
      `${lit(d.V0)}*(1+x) + ${d.txs.map((tx) => `${lit(tx.amount)}*(1+x)**(${elapsed ? tx.m : 12 - tx.m}/12)`).join(" + ")} - ${lit(d.end)}`;
    const dwrExact = (d: ReturnType<typeof draw>, elapsed = false) =>
      solveRoot((x) => d.V0 * (1 + x) + d.txs.reduce((s, tx) => s + tx.amount * Math.pow(1 + x, (elapsed ? tx.m : 12 - tx.m) / 12), 0) - d.end, -0.6, 1.5);
    const net = (d: ReturnType<typeof draw>) => d.txs.reduce((s, tx) => s + tx.amount, 0);
    const netE = (d: ReturnType<typeof draw>) => d.txs.map((tx) => lit(tx.amount)).join(" + ");
    const dwrSimple = (d: ReturnType<typeof draw>, elapsed = false) => (d.end - d.V0 - net(d)) / (d.V0 + d.txs.reduce((s, tx) => s + tx.amount * ((elapsed ? tx.m : 12 - tx.m) / 12), 0));
    const dwrSimpleE = (d: ReturnType<typeof draw>, elapsed = false) =>
      `(${lit(d.end)} - ${lit(d.V0)} - (${netE(d)}))/(${lit(d.V0)} + ${d.txs.map((tx) => `${lit(tx.amount)}*${elapsed ? tx.m : 12 - tx.m}/12`).join(" + ")})`;

    const d = drawUntil(draw, (dd) => {
      const t = twrOf(dd);
      const de = dwrExact(dd);
      const ds = dwrSimple(dd);
      return Math.abs(t - de) > 0.012 && Math.abs(t - ds) > 0.012 && Math.abs(de - ds) > 0.0008 * 1.5 && dd.end > 0 && Math.abs(de) > 0.01 && Math.abs(t) > 0.01;
    });
    const T = twrOf(d);
    const TE = twrE(d);
    const D = exact ? dwrExact(d) : dwrSimple(d);
    const DE = exact ? dwrExactE(d) : dwrSimpleE(d);
    const Dother = exact ? dwrSimple(d) : dwrExact(d);
    const DotherE = exact ? dwrSimpleE(d) : dwrExactE(d);
    const Delapsed = exact ? dwrExact(d, true) : dwrSimple(d, true);
    const DelapsedE = exact ? dwrExactE(d, true) : dwrSimpleE(d, true);
    const Tshift = twrOf(d, true);
    const TshiftE = twrE(d, true);
    const subs = subReturns(d);
    const Tsum = subs.reduce((a, b) => a + b, 0);
    const TsumE = subReturnsE(d).join(" + ");
    const Dbase = (d.end - d.V0 - net(d)) / d.V0;
    const DbaseE = `(${lit(d.end)} - ${lit(d.V0)} - (${netE(d)}))/${lit(d.V0)}`;

    const dateOf = (m: number) => `${MONTHS[m]} 1`;
    const exhibit: Exhibit = {
      type: "table",
      caption: "Fund values and transactions during the year",
      columns: ["Date", "Fund value before the transaction", "Deposit (+) or withdrawal (−)"],
      rows: [
        ["January 1", amt(d.V0), "—"],
        ...d.txs.map((tx, s) => [dateOf(tx.m), amt(d.before[s]), `${tx.amount > 0 ? "+" : ""}${num(tx.amount, 0)}`]),
        ["December 31", amt(d.end), "—"],
      ],
    };
    const dwrDef = exact
      ? "the dollar-weighted rate of return for the year, defined as the annual effective rate that solves the equation of value with compound interest"
      : "the dollar-weighted rate of return for the year, calculated with the simple-interest approximation";
    const steps: ChainStep[] = [
      step(exact ? "C.yield-rate" : "C.yield-rate", exact ? "Equate the starting value and the transactions, accumulated with compound interest to December 31, with the closing value." : "Divide the gain by the capital weighted by the fraction of the year it was invested.", ["d", D, "dollar-weighted return"], ["fund values", "transactions"]),
      step("A.accumulation", "Chain the growth factors of the sub-periods between transactions.", ["t", T, "time-weighted return"], ["fund values"]),
    ];
    const gain = d.end - d.V0 - net(d);
    const wrong: WrongOption[] = [
      {
        id: "COMP_DWR_METHOD_CONFUSED",
        parts: [
          [Dother, DotherE],
          [T, TE],
        ],
        method: exact ? "Used the simple-interest approximation for the dollar-weighted return." : "Solved the exact compound-interest equation instead of using the approximation.",
        derivation: `$d = ${dec(Dother, 6)}$: $${tuple([Dother, T], fmts)}$`,
        why: exact ? "The question defines the dollar-weighted return through the compound-interest equation of value; the simple-interest formula only approximates its root." : "The question asks for the simple-interest approximation, gain ÷ time-weighted capital, not the exact compound root.",
        stage: 0,
        error: "selection",
        conditionTrue: exact ? "If the simple-interest approximation had been requested." : "If the exact compound-interest rate had been requested.",
      },
      {
        id: "COMP_TWR_FLOW_IN_WRONG_SUBPERIOD",
        parts: [
          [D, DE],
          [Tshift, TshiftE],
        ],
        method: "Added each transaction to the value at the end of the earlier sub-period.",
        derivation: `$t = ${dec(Tshift, 6)}$: $${tuple([D, Tshift], fmts)}$`,
        why: "A sub-period's growth compares the value just before the next transaction with the value just after the previous one; including the deposit in the closing value counts the deposit as investment growth.",
        stage: 1,
        error: "application",
      },
      {
        id: "SEQ_GEOMETRIC_AS_ARITHMETIC",
        parts: [
          [D, DE],
          [Tsum, TsumE],
        ],
        method: "Added the sub-period returns.",
        derivation: `$t = ${subs.map((x) => dec(x, 4)).join(" + ")}$: $${tuple([D, Tsum], fmts)}$`,
        why: "Sub-period returns compound: $1 + t = \\prod (1 + r_k)$.",
        stage: 1,
        error: "application",
      },
      {
        id: "COMP_PAIR_REVERSED",
        parts: [
          [T, TE],
          [D, DE],
        ],
        method: "Reported the time-weighted return first.",
        derivation: `$(t, d)$: $${tuple([T, D], fmts)}$`,
        why: `The pair is (dollar-weighted, time-weighted) $= (${dec(D, 6)}, ${dec(T, 6)})$.`,
        stage: 1,
        error: "interpretation",
      },
      {
        id: "COMP_DEPOSIT_TIME_WEIGHT",
        parts: [
          [Delapsed, DelapsedE],
          [T, TE],
        ],
        method: "Weighted each transaction by the time elapsed before it.",
        derivation: `$d = ${dec(Delapsed, 6)}$: $${tuple([Delapsed, T], fmts)}$`,
        why: `A transaction on ${dateOf(d.txs[0].m)} is invested for the remaining ${12 - d.txs[0].m}/12 of the year, not the ${d.txs[0].m}/12 already elapsed.`,
        stage: 0,
        error: "application",
      },
      {
        id: "CONC_RETURN_ON_WRONG_BASE",
        parts: [
          [Dbase, DbaseE],
          [T, TE],
        ],
        method: "Divided the gain by the opening value only.",
        derivation: `$d = ${mnum(gain, 0)}/${mamt(d.V0)}$: $${tuple([Dbase, T], fmts)}$`,
        why: "Money deposited during the year was also invested for part of the year, so it belongs in the capital base.",
        stage: 0,
        error: "application",
      },
    ];
    const eqText = `$${mamt(d.V0)}(1 + d) ${d.txs.map((tx) => `${tx.amount > 0 ? "+" : "-"} ${mamt(Math.abs(tx.amount))}(1 + d)^{${12 - tx.m}/12}`).join(" ")} = ${mamt(d.end)}$`;
    const simpleText = `$d = \\dfrac{${mnum(gain, 0)}}{${mamt(d.V0)} ${d.txs.map((tx) => `${tx.amount > 0 ? "+" : "-"} ${mamt(Math.abs(tx.amount))}(${12 - tx.m}/12)`).join(" ")}}$`;
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Dollar-weighted", "Time-weighted"],
      formats: fmts,
      stem: `The table shows the value of an investment fund and the transactions in it during one year.\n\nLet $d$ be ${dwrDef}, and let $t$ be the time-weighted rate of return for the year. Calculate $(d, t)$.`,
      exhibits: [exhibit],
      correct: {
        parts: [
          [D, DE],
          [T, TE],
        ],
        why: `$d = ${dec(D, 6)}$ and $t = ${dec(T, 6)}$.`,
        derivation: `$${tuple([D, T], fmts)}$`,
      },
      wrong,
      reference: {
        description: exact
          ? "d is the bracketed root of the compound equation of value; t is the product of the sub-period growth factors minus 1, each written as (value before next flow)/(value after this flow)."
          : "d is the year's gain divided by time-weighted capital; t is the product of the sub-period growth factors minus 1.",
        values: [
          exact ? { expr: dwrExactE(d), bracket: [-0.6, 1.5] } : { expr: `(${lit(d.end)} - (${lit(d.V0)} + ${netE(d)}))/(${lit(d.V0)} + ${d.txs.map((tx) => `${lit(tx.amount)}*(1 - ${tx.m}/12)`).join(" + ")})` },
          { expr: `${subReturnsE(d).map((r) => `(1+${r})`).join("*")} - 1` },
        ],
      },
      explanation: explain({
        intuition: "The dollar-weighted return measures what the investor's actual money earned, so the timing and size of deposits matter. The time-weighted return measures the fund manager's performance, so each transaction just starts a new sub-period.",
        unknowns: [
          ["$d$", "dollar-weighted return"],
          ["$t$", "time-weighted return"],
        ],
        relationships: [exact ? eqText : simpleText, `$1 + t = ${subReturns(d).map((x) => `(${dec(1 + x, 6)})`).join("")}$`],
        conditions: ["Values in the table are just before each transaction."],
        valuationDate: "December 31 for the dollar-weighted equation; sub-period boundaries for the time-weighted return.",
        modelChoice: exact ? "Exact dollar-weighted rate: root of the compound equation of value." : "Simple-interest approximation to the dollar-weighted rate.",
        assumptions: ["Transactions occur on the first day of the month shown."],
        solution: [
          ["Dollar-weighted", exact ? `${eqText} gives $d = ${dec(D, 6)}$.` : `${simpleText} $= ${dec(D, 6)}$.`],
          ["Sub-period growth", subReturns(d).map((x, s) => `$1 + r_${s + 1} = ${dec(1 + x, 6)}$`).join(", ")],
          ["Time-weighted", `$t = ${dec(T, 6)}$, so $(d, t) = ${tuple([D, T], fmts)}$.`],
        ],
        alternatives: [[exact ? "Simple-interest check" : "Exact rate check", exact ? `The simple approximation gives ${dec(Dother, 6)} — close to, but not equal to, the exact root.` : `The exact compound root is ${dec(Dother, 6)} — close to the approximation.`, "A sanity check on the size of the answer."]],
        principle: "Dollar-weighted return = yield of the investor's cash flows; time-weighted return = product of sub-period growth factors between transactions.",
        unusual: lvl === 2 ? "Both a deposit and a withdrawal occur, so there are three sub-periods." : "The two returns differ because a large deposit was made before a period of different performance.",
        misread: "Including the deposit in the earlier sub-period's closing value, or giving the pair in the wrong order.",
      }),
      steps,
      methods: exact ? ["equation_construction", "numerical_root"] : ["equation_construction"],
      reasoning: "Write the investor's equation of value for d; split the year at each transaction and chain the growth factors for t.",
      presentation: lvl === 2 ? ["mixed-timing"] : ["direct"],
      features: lvl === 2 ? { multipleValuationDates: true } : {},
      params: { V0: d.V0, end: d.end, txs: JSON.stringify(d.txs), before: JSON.stringify(d.before), exact },
      itemFormat: "table-driven",
      relationship: "$A(1 + d) + \\sum C_k (1 + d)^{1 - t_k} = B$; $1 + t = \\prod_k (1 + r_k)$",
    });
  },
});

// ===================================================================== cash-flow schedule: (NPV, IRR)

const cashflowNpvIrr = compositeTemplate({
  id: "comp-cashflow-npv-irr",
  family: "comp-cashflow-schedule",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.rates_of_return",
  secondary: ["TVM.equation_of_value", "TVM.discount_rates"],
  reasoning: ["cashflow_modelling", "valuation_dates", "formula_selection"],
  soaConcept: "Net present value at a stated rate and internal rate of return of an irregular project cash-flow schedule.",
  itemFormat: "cash-flow-schedule",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const T = lvl === 1 ? 4 : 6;
    const fmts = [MONEY2, PCT2];
    const draw = () => {
      const C0 = gridAmount(rng, 10000, 60000, 1000);
      const flows: Flow[] = [{ t: 0, amount: -C0 }];
      if (lvl === 2) flows.push({ t: 1, amount: -gridAmount(rng, Math.round(C0 * 0.2 / 500) * 500, Math.round(C0 * 0.5 / 500) * 500, 500) });
      for (let t = lvl === 1 ? 1 : 2; t <= T; t += 1) flows.push({ t, amount: gridAmount(rng, Math.round(C0 * 0.15 / 100) * 100, Math.round(C0 * 0.5 / 100) * 100, 100) });
      return flows;
    };
    const flows = drawUntil(draw, (fl) => {
      if (pvFlows(fl, 0.0001) <= 0 || pvFlows(fl, 0.6) >= 0) return false;
      const r = solveRoot((x) => pvFlows(fl, x), 0.0001, 0.6);
      return r > 0.03 && r < 0.25;
    });
    const irr = solveRoot((x) => pvFlows(flows, x), 0.0001, 0.6);
    const d = drawUntil(() => gridRate(rng, 0.04, 0.09, 0.005), (dd) => Math.abs((lvl === 1 ? dd : dd / (1 - dd)) - irr) > 0.01);
    const i = lvl === 1 ? d : d / (1 - d);
    const iE = lvl === 1 ? lit(d) : `(${lit(d)}/(1-${lit(d)}))`;
    const npv = pvFlows(flows, i);
    const npvE = pvTerms(flows, iE);
    const irrE = pvTerms(flows, "x");
    const outflows = flows.filter((f) => f.amount < 0);
    const inflows = flows.filter((f) => f.amount > 0);
    const simpleNpv = flows.reduce((s, f) => s + f.amount / (1 + i * f.t), 0);
    const simpleNpvE = sumOf(flows.map((f) => `${lit(f.amount)}/(1+${iE}*${f.t})`));
    const simpleIrrE = sumOf(flows.map((f) => `${lit(f.amount)}/(1+x*${f.t})`));
    const simpleIrr = solveRoot((x) => flows.reduce((s, f) => s + f.amount / (1 + x * f.t), 0), 0.0001, 2);
    const outSum = -outflows.reduce((s, f) => s + f.amount, 0);
    const inSum = inflows.reduce((s, f) => s + f.amount, 0);
    const avgRet = (inSum - outSum) / outSum / T;
    const avgRetE = `(${sumOf(inflows.map((f) => lit(f.amount)))} - ${lit(outSum)})/${lit(outSum)}/${T}`;
    const steps: ChainStep[] = [];
    if (lvl === 2) steps.push(step("A.interest-discount", "Convert the discount rate to the equivalent interest rate.", ["i", i, "annual effective interest rate"], ["d"]));
    const sN = steps.length;
    steps.push(step("C.npv", "Discount every cash flow to time 0 and add.", ["NPV", npv, "net present value"], ["cash flows", "i"]));
    steps.push(step("C.irr", "The internal rate of return makes the net present value zero.", ["IRR", irr, "internal rate of return"], ["cash flows"], { rearranged: true }));
    const sI = steps.length - 1;
    const wrong: WrongOption[] = [];
    if (lvl === 2) {
      const npvD = pvFlows(flows, d);
      wrong.push({
        id: "RATE_DISCOUNT_AS_INTEREST",
        parts: [
          [npvD, pvTerms(flows, lit(d))],
          [irr, irrE],
        ],
        method: `Discounted at ${pc(d)} as if it were an interest rate.`,
        derivation: `NPV at $i = ${mpc(d)}$: $${tuple([npvD, irr], fmts)}$`,
        why: `${pc(d)} is a rate of discount: $v = 1 - d$, so the interest rate is $i = d/(1 - d) = ${dec(i, 6)}$.`,
        stage: 0,
        error: "application",
      });
      const flipped = flows.map((f) => (f.t === 1 ? { t: 1, amount: -f.amount } : f));
      if (pvFlows(flipped, 0.0001) > 0 && pvFlows(flipped, 3) < 0) {
        const irrF = solveRoot((x) => pvFlows(flipped, x), 0.0001, 3);
        wrong.push({
          id: "ALG_SIGN_ERROR",
          parts: [
            [pvFlows(flipped, i), pvTerms(flipped, iE)],
            [irrF, pvTerms(flipped, "x")],
          ],
          method: "Entered the second outlay at time 1 as an inflow.",
          derivation: `$${tuple([pvFlows(flipped, i), irrF], fmts)}$`,
          why: `The time-1 amount, ${num(flows[1].amount, 0)}, is a further investment and enters the equation of value with a negative sign.`,
          stage: sN,
          error: "application",
        });
      }
    }
    wrong.push(
      {
        id: "TIMING_EXTRA_PERIOD",
        parts: [
          [npv / (1 + i), sumOf(flows.map((f) => `${lit(f.amount)}*${vPow(iE, f.t + 1)}`))],
          [irr, irrE],
        ],
        method: "Discounted every cash flow one year too many (time 0 treated as time 1).",
        derivation: `$\\sum CF_t v^{t+1}$: $${tuple([npv / (1 + i), irr], fmts)}$`,
        why: "The first cash flow is at time 0 and is not discounted; shifting every flow one year later divides the NPV by 1 + i (the IRR is unaffected).",
        stage: sN,
        error: "application",
      },
      {
        id: "SEQ_UNDISCOUNTED_SUM",
        parts: [
          [flows.reduce((s, f) => s + f.amount, 0), sumOf(flows.map((f) => lit(f.amount)))],
          [irr, irrE],
        ],
        method: "Added the cash flows without discounting.",
        derivation: `$\\sum CF_t$: $${tuple([flows.reduce((s, f) => s + f.amount, 0), irr], fmts)}$`,
        why: "A net present value discounts each cash flow from its own date to time 0.",
        stage: sN,
        error: "selection",
        conditionTrue: "Only at a zero interest rate.",
      },
      {
        id: "MODEL_COMPOUND_AS_SIMPLE",
        parts: [
          [simpleNpv, simpleNpvE],
          [simpleIrr, simpleIrrE],
        ],
        method: "Discounted with simple interest, $1/(1 + it)$.",
        derivation: `$\\sum CF_t/(1 + it)$: $${tuple([simpleNpv, simpleIrr], fmts)}$`,
        why: "Effective rates compound: a cash flow at time t is discounted by $(1 + i)^{-t}$.",
        stage: sN,
        error: "selection",
      },
      {
        id: "CONC_RETURN_ON_WRONG_BASE",
        parts: [
          [npv, npvE],
          [avgRet, avgRetE],
        ],
        method: "Took the IRR as the total profit per unit invested, divided by the number of years.",
        derivation: `$(${mnum(inSum, 0)} - ${mnum(outSum, 0)})/(${mnum(outSum, 0)} \\times ${T})$: $${tuple([npv, avgRet], fmts)}$`,
        why: "The IRR is the rate at which the discounted inflows equal the discounted outflows; an average simple profit ignores when the money is returned.",
        stage: sI,
        error: "selection",
      }
    );
    const exhibit: Exhibit = {
      type: "table",
      caption: "Project cash flows (negative = investment)",
      columns: ["Time (years)", "Cash flow"],
      rows: flows.map((f) => [String(f.t), num(f.amount, 0)]),
    };
    const rateText = lvl === 1 ? `an annual effective interest rate of ${pc(d)}` : `an annual effective rate of discount of ${pc(d)}`;
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["NPV", "IRR"],
      formats: fmts,
      stem: `The table shows the cash flows of a project.\n\nLet $N$ be the net present value of the project at ${rateText}, and let $j$ be its internal rate of return. Calculate $(N, j)$.`,
      exhibits: [exhibit],
      correct: {
        parts: [
          [npv, npvE],
          [irr, irrE],
        ],
        why: `$N = \\sum CF_t (1 + i)^{-t} = ${mnum(npv, 2)}$ and the rate making the NPV zero is $j = ${dec(irr, 6)}$.`,
        derivation: `$${tuple([npv, irr], fmts)}$`,
      },
      wrong,
      reference: {
        description: `Both computed at time ${T}: N is the accumulated value of all flows at time ${T} discounted back to 0; j is the bracketed root of "accumulated value at time ${T} = 0".`,
        values: [{ expr: `${avTerms(flows, iE, T)}*${vPow(iE, T)}` }, { expr: avTerms(flows, "x", T), bracket: [0.0001, 0.6] }],
      },
      explanation: explain({
        intuition: "The NPV says how much richer the project makes you, measured today at the given rate. The IRR is the break-even rate: the one at which the project is worth exactly nothing.",
        unknowns: [
          ["$N$", "net present value"],
          ["$j$", "internal rate of return"],
        ],
        relationships: [`$N = \\sum_t CF_t (1 + i)^{-t}$`, `$\\sum_t CF_t (1 + j)^{-t} = 0$`],
        conditions: ["Outflows come first, then only inflows, so the IRR is unique."],
        valuationDate: "Time 0.",
        modelChoice: "Equation of value for the explicit cash-flow schedule.",
        assumptions: ["Annual effective rates; cash flows at the times shown."],
        solution: [
          ...(lvl === 2 ? [["Interest rate", `$i = d/(1 - d) = ${dec(i, 6)}$`] as [string, string]] : []),
          ["Net present value", `$N = ${flows.map((f) => `${f.amount < 0 ? "-" : "+"}${mamt(Math.abs(f.amount))}v^{${f.t}}`).join(" ").replace(/^\+/, "")} = ${mnum(npv, 2)}$`],
          ["Internal rate of return", `Solving $\\sum CF_t (1 + j)^{-t} = 0$ gives $j = ${dec(irr, 6)}$, so $(N, j) = ${tuple([npv, irr], fmts)}$.`],
        ],
        alternatives: [["Sign check", `Because the NPV at ${dec(i, 4)} is ${npv > 0 ? "positive" : "negative"}, the IRR must be ${npv > 0 ? "above" : "below"} that rate.`, "To confirm a calculator result before choosing an option."]],
        principle: "NPV discounts each cash flow from its own date; the IRR is the rate that makes the NPV zero, and for a conventional project NPV > 0 exactly when the rate is below the IRR.",
        unusual: lvl === 2 ? "The rate is given as a rate of discount, and the investment is spread over two dates." : "The cash flows are irregular, so no annuity factor applies.",
        misread: "Discounting the time-0 flow, or ignoring compounding.",
      }),
      steps,
      methods: ["equation_construction", "numerical_root"],
      reasoning: "Discount the schedule term by term for N; solve the same equation of value with an unknown rate for j.",
      presentation: lvl === 2 ? ["mixed-timing"] : ["direct"],
      params: { flows: JSON.stringify(flows), d },
      itemFormat: "cash-flow-schedule",
      relationship: "$N = \\sum CF_t v^t$; $\\sum CF_t (1 + j)^{-t} = 0$",
    });
  },
});

// ===================================================================== table-driven: partial amortization schedule

const amortTable = compositeTemplate({
  id: "comp-amort-table",
  family: "comp-amortization-schedule",
  topic: "LOANS",
  levels: [1, 2],
  objective: "LOANS.amortization",
  secondary: ["LOANS.payment_components", "LOANS.outstanding_balance", "LOANS.unknown_variables"],
  reasoning: ["cashflow_modelling", "translation", "multistep"],
  soaConcept: "Missing entries of a partial amortization schedule, answered as an ordered pair.",
  itemFormat: "table-driven",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const n = rng.int(10, 25);
    const iTrue = gridRate(rng, 0.04, 0.1, 0.0025);
    const L0 = gridAmount(rng, 30000, 200000, 1000);
    const X = round(L0 / an(n, iTrue), 2);
    const k = rng.int(3, n - 4);
    const Bkm1 = X * an(n - k + 1, iTrue);
    const Ik = round(iTrue * Bkm1, 2);
    const Pk = round(X - Ik, 2);
    const Bk = round(Bkm1 - Pk, 2);
    const fmts = [MONEY2, MONEY2];
    const i = lvl === 1 ? iTrue : Ik / (Bk + Pk);
    const iE = lvl === 1 ? lit(iTrue) : `(${lit(Ik)}/(${lit(Bk)} + ${lit(Pk)}))`;
    const I1 = i * Bk;
    const P1 = X - I1;
    const B1 = Bk - P1;
    const B2 = Bk * (1 + i) * (1 + i) - X * (1 + i) - X;
    const IE = `${iE}*${lit(Bk)}`;
    const BE = `${lit(Bk)}*${accPow(iE, 2)} - ${lit(X)}*${accPow(iE, 1)} - ${lit(X)}`;
    const recur = (rate: number, start: number) => {
      const b1 = start * (1 + rate) - X;
      return b1 * (1 + rate) - X;
    };
    const steps: ChainStep[] = [];
    if (lvl === 2) steps.push(step("D.interest-component", `Row ${k}: interest ÷ balance before the payment, where that balance is $B_{${k}} + P_{${k}}$.`, ["i", i, "rate per period"], ["I_k", "B_k", "P_k"], { rearranged: true }));
    const sI = steps.length;
    steps.push(step("D.interest-component", `Interest in payment ${k + 1} is earned on the balance after payment ${k}.`, ["I", I1, `interest in payment ${k + 1}`], ["B_k", "i"]));
    steps.push(step("D.principal-component", "The rest of the payment repays principal.", [`P_{${k + 1}}`, P1, `principal in payment ${k + 1}`], ["X", "I"]));
    steps.push(step("D.balance-recursion", "Roll the balance forward two payments.", ["B", B2, `balance after payment ${k + 2}`], ["B_k", "i", "X"]));
    const sB = steps.length - 1;
    const wrong: WrongOption[] = [];
    if (lvl === 2) {
      const iw = Ik / Bk;
      const iwE = `(${lit(Ik)}/${lit(Bk)})`;
      wrong.push({
        id: "COMP_RATE_FROM_CLOSING_BALANCE",
        parts: [
          [iw * Bk, `${iwE}*${lit(Bk)}`],
          [recur(iw, Bk), `${lit(Bk)}*${accPow(iwE, 2)} - ${lit(X)}*${accPow(iwE, 1)} - ${lit(X)}`],
        ],
        method: `Took the rate as ${amt(Ik)} ÷ ${amt(Bk)}.`,
        derivation: `$i = ${mamt(Ik)}/${mamt(Bk)}$: $${tuple([iw * Bk, recur(iw, Bk)], fmts)}$`,
        why: `Interest in payment ${k} accrued on the balance before that payment, $${mamt(Bk)} + ${mamt(Pk)}$, not on the balance after it.`,
        stage: 0,
        error: "interpretation",
      });
    }
    const bPre = (Bk - X) * (1 + i);
    const B2pre = (bPre - X) * (1 + i);
    wrong.push(
      {
        id: "VAR_INTEREST_FOR_PRINCIPAL",
        parts: [
          [P1, `${lit(X)} - ${IE}`],
          [B2, BE],
        ],
        method: `Gave the principal portion of payment ${k + 1} as its interest.`,
        derivation: `$${tuple([P1, B2], fmts)}$`,
        why: `The interest portion is $i\\,B_{${k}} = ${mnum(I1, 2)}$; ${mnum(P1, 2)} is the principal portion.`,
        stage: sI + 1,
        error: "interpretation",
      },
      {
        id: "TIMING_BALANCE_INDEX",
        parts: [
          [i * B1, `${iE}*(${lit(Bk)} - (${lit(X)} - ${IE}))`],
          [B2, BE],
        ],
        method: `Charged interest on the balance after payment ${k + 1}.`,
        derivation: `$I = i\\,B_{${k + 1}}$: $${tuple([i * B1, B2], fmts)}$`,
        why: `Interest for the period ending at payment ${k + 1} accrues on $B_{${k}} = ${mamt(Bk)}$, the balance at the start of that period.`,
        stage: sI,
        error: "application",
      },
      {
        id: "MODEL_STRAIGHT_LINE",
        parts: [
          [X - Pk, `${lit(X)} - ${lit(Pk)}`],
          [Bk - 2 * Pk, `${lit(Bk)} - 2*${lit(Pk)}`],
        ],
        method: `Assumed every payment repays the same principal, ${amt(Pk)}.`,
        derivation: `$I = X - ${mamt(Pk)}$, $B = ${mamt(Bk)} - 2(${mamt(Pk)})$: $${tuple([X - Pk, Bk - 2 * Pk], fmts)}$`,
        why: "With level payments the principal portion grows by the factor 1 + i each period, because interest falls with the balance.",
        stage: sI + 1,
        error: "selection",
      },
      {
        id: "TIMING_PAYMENT_BEFORE_INTEREST",
        parts: [
          [i * (Bk - X), `${iE}*(${lit(Bk)} - ${lit(X)})`],
          [B2pre, `((${lit(Bk)} - ${lit(X)})*${accPow(iE, 1)} - ${lit(X)})*${accPow(iE, 1)}`],
        ],
        method: "Deducted each payment before charging interest.",
        derivation: `$I = i(B_{${k}} - X)$: $${tuple([i * (Bk - X), B2pre], fmts)}$`,
        why: "Payments are made at the end of each period; interest accrues on the full balance during the period first.",
        stage: sI,
        error: "application",
      },
      {
        id: "SEQ_UNDISCOUNTED_SUM",
        parts: [
          [I1, IE],
          [Bk - 2 * X, `${lit(Bk)} - 2*${lit(X)}`],
        ],
        method: "Subtracted two whole payments from the balance.",
        derivation: `$B = ${mamt(Bk)} - 2(${mamt(X)})$: $${tuple([I1, Bk - 2 * X], fmts)}$`,
        why: "Only the principal part of each payment reduces the balance.",
        stage: sB,
        error: "selection",
      }
    );
    const exhibit: Exhibit = {
      type: "table",
      caption: "Part of the amortization schedule",
      columns: ["Payment number", "Payment", "Interest", "Principal", "Outstanding balance"],
      rows: [
        [String(k), num(X, 2), num(Ik, 2), num(Pk, 2), num(Bk, 2)],
        [String(k + 1), num(X, 2), "—", "—", "—"],
        [String(k + 2), num(X, 2), "—", "—", "—"],
      ],
    };
    const rateText = lvl === 1 ? ` The annual effective interest rate is ${pc(iTrue)}.` : "";
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Interest", "Balance"],
      formats: fmts,
      stem: `A loan is repaid by level annual payments. The table shows part of its amortization schedule.${rateText}\n\nLet $I$ be the interest portion of payment ${k + 1} and $B$ the outstanding balance immediately after payment ${k + 2}. Calculate $(I, B)$.`,
      exhibits: [exhibit],
      correct: {
        parts: [
          [I1, IE],
          [B2, BE],
        ],
        why: `$I = i\\,B_{${k}} = ${mnum(I1, 2)}$, and two steps of $B_{t} = B_{t-1}(1 + i) - X$ give $B = ${mnum(B2, 2)}$.`,
        derivation: `$${tuple([I1, B2], fmts)}$`,
      },
      wrong,
      reference: {
        description: `I = rate × balance after payment ${k}${lvl === 2 ? ", with the rate = interest ÷ (balance after + principal in payment " + k + ")" : ""}; B = balance after payment ${k} less the principal portions of payments ${k + 1} and ${k + 2}, the second being the first times 1 + i.`,
        values: [
          { expr: `${lit(Bk)}*${lvl === 1 ? lit(iTrue) : `(${lit(Ik)}/(${lit(Bk)} + ${lit(X)} - ${lit(Ik)}))`}` },
          { expr: `${lit(Bk)} - (${lit(X)} - ${iE}*${lit(Bk)})*(2 + ${iE})` },
        ],
      },
      explanation: explain({
        intuition: "Each row of a schedule is built from the previous row's closing balance: interest is the rate times that balance, principal is the rest of the payment, and the balance falls by the principal.",
        unknowns: [
          ...(lvl === 2 ? [["$i$", "interest rate"] as [string, string]] : []),
          ["$I$", `interest in payment ${k + 1}`],
          ["$B$", `balance after payment ${k + 2}`],
        ],
        relationships: [
          ...(lvl === 2 ? [`$i = I_{${k}}/(B_{${k}} + P_{${k}})$`] : []),
          `$I = i\\,B_{${k}}$`,
          `$B_{t} = B_{t-1}(1 + i) - X$`,
        ],
        conditions: ["Level payments at the end of each year."],
        valuationDate: `Payment dates ${k} to ${k + 2}.`,
        modelChoice: "Balance recursion, row by row.",
        assumptions: ["The schedule's figures are rounded to cents."],
        solution: [
          ...(lvl === 2 ? [["Rate", `$i = ${mamt(Ik)}/(${mamt(Bk)} + ${mamt(Pk)}) = ${dec(i, 6)}$`] as [string, string]] : []),
          ["Interest", `$I = ${dec(i, 6)} \\times ${mamt(Bk)} = ${mnum(I1, 2)}$`],
          ["Next balance", `$P_{${k + 1}} = ${mamt(X)} - ${mnum(I1, 2)} = ${mnum(P1, 2)}$, $B_{${k + 1}} = ${mnum(B1, 2)}$`],
          ["Balance", `$B = B_{${k + 1}}(1 + i) - X = ${mnum(B2, 2)}$, so $(I, B) = ${tuple([I1, B2], fmts)}$.`],
        ],
        alternatives: [["Principal grows by 1 + i", `$P_{${k + 2}} = P_{${k + 1}}(1 + i)$, so $B = B_{${k}} - P_{${k + 1}}(2 + i)$.`, "Avoids recomputing interest twice."]],
        principle: "In an amortization schedule, interest = rate × previous balance and the principal portions of a level-payment loan grow by 1 + i each period.",
        unusual: lvl === 2 ? "The rate is not given; it is recovered from one row of the schedule." : "Values must be read from a partial schedule rather than computed from the loan amount.",
        misread: "Charging interest on the balance after the payment, or subtracting whole payments from the balance.",
      }),
      steps,
      methods: lvl === 2 ? ["work_backwards", "substitution"] : ["substitution"],
      reasoning: "Fill the schedule row by row: interest on the previous balance, principal as the remainder, balance reduced by principal.",
      presentation: lvl === 2 ? ["inverse"] : ["direct"],
      params: { X, Ik, Pk, Bk, k, n, i: lvl === 1 ? iTrue : "implied" },
      itemFormat: "table-driven",
      relationship: "$I_t = i\\,B_{t-1}$, $B_t = B_{t-1}(1 + i) - X$",
    });
  },
});

// ===================================================================== allocation helpers

/** 2×2 or 3×3 determinant of expression strings. */
function detE(M: string[][]): string {
  const d2 = (a: string, b: string, c: string, d: string) => `((${a})*(${d}) - (${b})*(${c}))`;
  if (M.length === 2) return d2(M[0][0], M[0][1], M[1][0], M[1][1]);
  return `((${M[0][0]})*${d2(M[1][1], M[1][2], M[2][1], M[2][2])} - (${M[0][1]})*${d2(M[1][0], M[1][2], M[2][0], M[2][2])} + (${M[0][2]})*${d2(M[1][0], M[1][1], M[2][0], M[2][1])})`;
}

/** Cramer's rule: each unknown as det(M with column j replaced by rhs) / det(M). */
function cramerE(M: string[][], rhs: string[]): string[] {
  const den = detE(M);
  return M[0].map((_, j) => `${detE(M.map((row, r) => row.map((cell, c) => (c === j ? rhs[r] : cell))))}/${den}`);
}

type MatchMode = "correct" | "noDivide" | "inverted" | "sign" | "ignore" | "skipLongest";

/**
 * Faces of an exact-matching portfolio, solved backwards from the last
 * liability. Bond b (0-based) matures at time b + 1; bond 0 is a zero-coupon
 * bond and bond b ≥ 1 pays annual coupons at cs[b].
 */
function backSub(Ls: number[], cs: number[], mode: MatchMode): Comp[] {
  const n = Ls.length;
  const F: Comp[] = new Array(n);
  for (let b = n - 1; b >= 0; b -= 1) {
    let val = Ls[b];
    let ex = lit(Ls[b]);
    if (mode !== "ignore") {
      for (let m = b + 1; m < n; m += 1) {
        if (mode === "skipLongest" && b === 0 && m === n - 1) continue;
        const sgn = mode === "sign" ? 1 : -1;
        val += sgn * cs[m] * F[m][0];
        ex += ` ${sgn > 0 ? "+" : "-"} ${lit(cs[m])}*(${F[m][1]})`;
      }
    }
    if (b === 0 || mode === "ignore" || mode === "noDivide") F[b] = [val, ex];
    else if (mode === "inverted") F[b] = [val * (1 + cs[b]), `(${ex})*(1+${lit(cs[b])})`];
    else F[b] = [val / (1 + cs[b]), `(${ex})/(1+${lit(cs[b])})`];
  }
  return F;
}

/** Amounts in two assets with durations t1 < t2 so that PV and duration D are matched. */
const durAlloc = (PV: number, D: number, t1: number, t2: number): [number, number] => {
  const x = (PV * (t2 - D)) / (t2 - t1);
  return [x, PV - x];
};
const durAllocE = (PVE: string, DE: string, t1E: string, t2E: string): [string, string] => {
  const x = `(${PVE})*((${t2E}) - (${DE}))/((${t2E}) - (${t1E}))`;
  return [x, `(${PVE}) - ${x}`];
};
const pair = (vals: [number, number], exprs: [string, string]): Comp[] => [
  [vals[0], exprs[0]],
  [vals[1], exprs[1]],
];

// ===================================================================== portfolio allocation: exact cash-flow matching

const matchBonds = compositeTemplate({
  id: "comp-match-bonds",
  family: "comp-matching",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.cash_flow_matching",
  secondary: ["BONDS.coupons", "ALM.portfolio"],
  reasoning: ["cashflow_modelling", "simultaneous_equations", "multistep"],
  soaConcept: "Face amounts of a zero-coupon bond and coupon bonds that exactly match a schedule of liabilities, answered as a portfolio allocation.",
  itemFormat: "portfolio-allocation",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const n = lvl === 1 ? 2 : 3;
    const cs = [0, ...range(2, n).map(() => gridRate(rng, 0.04, 0.12, 0.005))];
    const L1 = gridAmount(rng, 20000, 80000, 1000);
    const Ls = [L1, ...range(2, n).map(() => gridAmount(rng, 40000, 150000, 1000))];
    const labels = ["Bond X", "Bond Y", "Bond Z"].slice(0, n);
    const fmts = labels.map(() => MONEY2);
    const F = backSub(Ls, cs, "correct");
    // Self-check: the portfolio reproduces every liability.
    for (let t = 0; t < n; t += 1) {
      let cash = 0;
      for (let b = 0; b < n; b += 1) cash += b === 0 ? (t === 0 ? F[0][0] : 0) : t < b ? cs[b] * F[b][0] : t === b ? (1 + cs[b]) * F[b][0] : 0;
      if (Math.abs(cash - Ls[t]) > 1e-6 * Ls[t]) throw new Error("Matching portfolio does not reproduce the liabilities.");
    }
    const vals = (C: Comp[]) => C.map((c) => c[0]);
    const M = range(0, n - 1).map((t) => range(0, n - 1).map((b) => (b === 0 ? (t === 0 ? "1" : "0") : t < b ? lit(cs[b]) : t === b ? `(1+${lit(cs[b])})` : "0")));
    const ref = cramerE(M, Ls.map(lit));
    const steps: ChainStep[] = [];
    for (let b = n - 1; b >= 1; b -= 1) {
      steps.push(step("G.dedication", b === n - 1 ? `Only Bond ${"XYZ"[b]} pays at time ${b + 1}: face × (1 + coupon) = liability.` : `At time ${b + 1}, Bond ${"XYZ"[b]} pays face plus coupon and the longer bond pays a coupon.`, [`F_${"XYZ"[b]}`, F[b][0], `face of Bond ${"XYZ"[b]}`], [`L_${b + 1}`], { rearranged: true }));
    }
    steps.push(step("M.linear-system", "At time 1 the zero-coupon bond covers what the coupons leave.", ["F_X", F[0][0], "face of Bond X"], ["L_1", "coupons"], { rearranged: true }));
    const last = steps.length - 1;
    const show = (C: Comp[]) => `$${labels.map((l, k) => `${l.slice(-1)} = ${shown(C[k][0], fmts[k])}`).join(",\\ ")}$`;
    const ign = backSub(Ls, cs, "ignore");
    const nod = backSub(Ls, cs, "noDivide");
    const inv = backSub(Ls, cs, "inverted");
    const sgn = backSub(Ls, cs, "sign");
    const swapped = [...F].reverse();
    const wrong: WrongOption[] = [
      {
        id: "MODEL_IGNORED_COUPON",
        parts: ign,
        method: "Bought each bond's face equal to the liability at its maturity.",
        derivation: show(ign),
        why: "The coupon bonds pay coupons before they mature, and a maturing coupon bond pays its last coupon with the face; both reduce what each bond must provide.",
        stage: last,
        error: "connection",
      },
      {
        id: "ALG_DIVIDE_ERROR",
        parts: nod,
        method: "Set each coupon bond's face equal to what it must pay at maturity, forgetting its final coupon.",
        derivation: show(nod),
        why: "At maturity a coupon bond pays face plus coupon, $F(1 + c)$, so $F$ is the amount to cover divided by $1 + c$.",
        stage: 0,
        error: "application",
      },
      {
        id: "TRANS_INVERTED_RELATION",
        parts: inv,
        method: "Multiplied by $1 + c$ instead of dividing.",
        derivation: show(inv),
        why: "Face plus coupon must equal the amount to be covered, so the face is that amount divided by $1 + c$.",
        stage: 0,
        error: "application",
      },
      {
        id: "ALLOC_SWAPPED",
        parts: swapped,
        method: "Attached the face amounts to the wrong bonds.",
        derivation: show(swapped),
        why: `Bond X is the one-year zero-coupon bond and must cover what is left at time 1; the ${n}-year bond covers the time-${n} liability.`,
        stage: last,
        error: "interpretation",
      },
      {
        id: "ALG_SIGN_ERROR",
        parts: sgn,
        method: "Added the coupons received to the liability instead of subtracting them.",
        derivation: show(sgn),
        why: "Coupons received at an earlier date help pay that date's liability, so they reduce what the shorter bond must provide.",
        stage: last,
        error: "application",
      },
      ...(n === 3
        ? [
            {
              id: "TRANS_IGNORED_CONDITION" as MisconceptionId,
              parts: backSub(Ls, cs, "skipLongest"),
              method: "At time 1, subtracted only Bond Y's coupon.",
              derivation: show(backSub(Ls, cs, "skipLongest")),
              why: "Bond Z also pays a coupon at time 1, which reduces the face of Bond X.",
              stage: last,
              error: "connection" as ChainErrorKind,
            },
          ]
        : []),
    ];
    const bondsText =
      n === 2
        ? `Bond X, a one-year zero-coupon bond, and Bond Y, a two-year bond with annual coupons at ${pc(cs[1])}`
        : `Bond X, a one-year zero-coupon bond; Bond Y, a two-year bond with annual coupons at ${pc(cs[1])}; and Bond Z, a three-year bond with annual coupons at ${pc(cs[2])}`;
    const liabText = Ls.map((l, t) => `${amt(l)} at the end of year ${t + 1}`).join(n === 2 ? " and " : ", ");
    return compositeQuestion({
      style: "allocation",
      labels,
      formats: fmts,
      stem: `A company must pay ${liabText}. It will exactly match these liabilities by buying ${bondsText}. All bonds are redeemable at par.\n\nCalculate the face amount of each bond the company buys.`,
      correct: {
        parts: F,
        why: `Solving from the last liability backwards: ${show(F)}.`,
        derivation: show(F),
      },
      wrong,
      reference: {
        description: "Cramer's rule on the matching system: one equation per liability date, columns = cash flow per unit face of each bond at that date.",
        values: ref.map((expr) => ({ expr })),
      },
      explanation: explain({
        intuition: `Only the ${n}-year bond pays anything at time ${n}, so it alone fixes the last liability. Its coupons are then known income at earlier dates, which tells you how much the next-shorter bond must supply — and so on back to time 1.`,
        unknowns: labels.map((l) => [`$F_${l.slice(-1)}$`, `face of ${l}`] as [string, string]),
        relationships: range(0, n - 1).map((t) => `$${range(0, n - 1).filter((b) => M[t][b] !== "0").map((b) => (b === 0 ? "F_X" : t < b ? `${dec(cs[b], 3)}F_${"XYZ"[b]}` : `${dec(1 + cs[b], 3)}F_${"XYZ"[b]}`)).join(" + ")} = ${mamt(Ls[t])}$`),
        conditions: ["Asset cash flows equal liability cash flows at every date."],
        valuationDate: "Each liability date separately — no discounting is needed.",
        modelChoice: "Back-substitution from the longest maturity.",
        assumptions: ["Bonds can be bought in any face amount.", "Coupons are paid on face."],
        solution: [
          ...range(1, n - 1)
            .reverse()
            .map((b) => [`Time ${b + 1}`, `$F_${"XYZ"[b]} = ${shown(F[b][0], MONEY2)}$`] as [string, string]),
          ["Time 1", `$F_X = ${mamt(Ls[0])} - ${range(1, n - 1).map((b) => `${dec(cs[b], 3)}(${mnum(F[b][0], 2)})`).join(" - ")} = ${mnum(F[0][0], 2)}$, so ${show(F)}.`],
        ],
        alternatives: [["Cash-flow table", "Write a row per bond and a column per date; require each column to sum to the liability and solve the triangular system.", "Best with three or more bonds."]],
        principle: "In exact cash-flow matching, solve from the last date backwards: each longer bond's coupons are known income at earlier dates.",
        unusual: n === 3 ? "Three bonds and three dates: every longer bond contributes coupons to every earlier date." : "No interest rate is needed at all.",
        misread: "Forgetting that a coupon bond's final payment is face plus coupon, or that longer bonds pay coupons at earlier dates.",
      }),
      steps,
      methods: ["work_backwards", "substitution"],
      reasoning: "Build the dates × bonds cash-flow table and require each column to equal the liability; solve from the last column.",
      presentation: lvl === 2 ? ["work-backwards", "multi-equation"] : ["multi-equation"],
      params: { coupons: JSON.stringify(cs.slice(1)), liabilities: JSON.stringify(Ls) },
      itemFormat: "portfolio-allocation",
      relationship: "Assets = liabilities at every date; $F_n(1 + c_n) = L_n$, then back-substitute.",
      markers: vals(F),
    });
  },
});

// ===================================================================== portfolio allocation: two zero-coupon bonds matching PV and duration

const zeroDurationMatch = compositeTemplate({
  id: "comp-zero-duration-match",
  family: "comp-duration-allocation",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.portfolio",
  secondary: ["ALM.duration", "ALM.full_immunization"],
  reasoning: ["formula_selection", "simultaneous_equations", "financial_intuition"],
  soaConcept: "Amounts invested in two zero-coupon bonds so that the portfolio's present value and Macaulay duration equal the liabilities'.",
  itemFormat: "portfolio-allocation",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const fmts = [MONEY2, MONEY2];
    let PV: number;
    let D: number;
    let PVE: string;
    let DE: string;
    let TPVE: string;
    let Ltot: number;
    let t1: number;
    let t2: number;
    let liabText: string;
    let Dface = 0;
    let DfaceE = "";
    const liab: { t: number; amount: number }[] = [];
    if (lvl === 1) {
      const T = rng.int(4, 10);
      const L = gridAmount(rng, 50000, 500000, 5000);
      liab.push({ t: T, amount: L });
      const lo = rng.int(1, Math.min(3, T - 1));
      const hi = drawUntil(() => rng.int(1, 4), (h) => h !== lo);
      t1 = T - lo;
      t2 = T + hi;
      liabText = `${amt(L)} at the end of ${T} years`;
    } else {
      const Ta = rng.int(3, 6);
      const Tb = Ta + rng.int(2, 5);
      liab.push({ t: Ta, amount: gridAmount(rng, 50000, 300000, 5000) }, { t: Tb, amount: gridAmount(rng, 50000, 300000, 5000) });
      const Dl = macaulayDuration(liab, i);
      const pick = drawUntil(
        () => [rng.int(1, Ta), rng.int(Ta + 1, Tb + 3)] as const,
        ([a, b]) => a < Dl - 0.3 && b > Dl + 0.3 && Math.abs((b - Dl) / (b - a) - 0.5) > 0.05
      );
      t1 = pick[0];
      t2 = pick[1];
      liabText = `${amt(liab[0].amount)} at the end of ${liab[0].t} years and ${amt(liab[1].amount)} at the end of ${liab[1].t} years`;
    }
    PV = pvFlows(liab, i);
    D = macaulayDuration(liab, i);
    PVE = `(${liab.map((f) => `${lit(f.amount)}*${vPow(i, f.t)}`).join(" + ")})`;
    TPVE = `(${liab.map((f) => `${f.t}*${lit(f.amount)}*${vPow(i, f.t)}`).join(" + ")})`;
    DE = lvl === 1 ? String(liab[0].t) : `${TPVE}/${PVE}`;
    Ltot = liab.reduce((s, f) => s + f.amount, 0);
    if (lvl === 2) {
      Dface = liab.reduce((s, f) => s + f.t * f.amount, 0) / Ltot;
      DfaceE = `(${liab.map((f) => `${f.t}*${lit(f.amount)}`).join(" + ")})/${lit(Ltot)}`;
    }
    const [X, Y] = durAlloc(PV, D, t1, t2);
    const [XE, YE] = durAllocE(PVE, DE, String(t1), String(t2));
    const w = (t2 - D) / (t2 - t1);
    const wE = `((${t2} - (${DE}))/${t2 - t1})`;
    const steps: ChainStep[] = [];
    steps.push(lvl === 1 ? step("A.discount-factor", "Present value of the liability.", ["PV_L", PV, "present value of liabilities"], ["L", "i"]) : step("C.npv", "Present value of the two liabilities.", ["PV_L", PV, "present value of liabilities"], ["L", "i"]));
    let sD = 0;
    if (lvl === 2) {
      sD = steps.length;
      steps.push(step("G.macaulay", "Macaulay duration of the liabilities: PV-weighted average payment time.", ["D_L", D, "liability duration"], ["PV_L"]));
    }
    const sX = steps.length;
    steps.push(step("G.portfolio-duration", `A portfolio's duration is the PV-weighted average of its bonds' durations ${t1} and ${t2}; solve for the weight in Bond X.`, ["X", X, "amount in Bond X"], ["PV_L", "D_L"], { rearranged: true }));
    steps.push(step("A.equation-of-value", "The rest of the liability value goes into Bond Y.", ["Y", Y, "amount in Bond Y"], ["PV_L", "X"]));
    const sY = steps.length - 1;
    const Dmod = D / (1 + i);
    const modA = durAlloc(PV, Dmod, t1, t2);
    const modE = durAllocE(PVE, `(${DE})/(1+${lit(i)})`, String(t1), String(t2));
    const wrong: WrongOption[] = [];
    if (lvl === 2) {
      wrong.push({
        id: "MODEL_UNDISCOUNTED_WEIGHTS",
        parts: pair(durAlloc(PV, Dface, t1, t2), durAllocE(PVE, DfaceE, String(t1), String(t2))),
        method: "Weighted the liability times by their face amounts.",
        derivation: `$D_L = ${dec(Dface, 4)}$: $${tuple(durAlloc(PV, Dface, t1, t2), fmts)}$`,
        why: `Macaulay duration weights each payment time by its present value; with face weights the duration is ${dec(Dface, 4)} instead of ${dec(D, 4)}.`,
        stage: sD,
        error: "application",
      });
    }
    wrong.push(
      {
        id: "ALLOC_SWAPPED",
        parts: [
          [Y, YE],
          [X, XE],
        ],
        method: "Put the larger weight on the bond further from the liability duration.",
        derivation: `$${tuple([Y, X], fmts)}$`,
        why: `The bond closer to the liabilities' duration ${dec(D, 3)} gets the larger share: Bond X's weight is $(${t2} - D)/(${t2} - ${t1}) = ${dec(w, 4)}$.`,
        stage: sX,
        error: "connection",
      },
      {
        id: "ALLOC_EVEN_SPLIT",
        parts: [
          [PV / 2, `${PVE}/2`],
          [PV / 2, `${PVE}/2`],
        ],
        method: "Split the present value equally between the two bonds.",
        derivation: `$${tuple([PV / 2, PV / 2], fmts)}$`,
        why: `An equal split has duration ${dec((t1 + t2) / 2, 2)}, not ${dec(D, 3)}; the split must satisfy the duration condition.`,
        stage: sX,
        error: "selection",
        conditionTrue: "If the liability duration were exactly midway between the two maturities.",
      },
      {
        id: "VAR_FACE_FOR_PRICE",
        parts: [
          [X * acc(i, t1), `(${XE})*${accPow(i, t1)}`],
          [Y * acc(i, t2), `(${YE})*${accPow(i, t2)}`],
        ],
        method: "Reported the amounts payable at maturity.",
        derivation: `$X(1 + i)^{${t1}},\\ Y(1 + i)^{${t2}}$: $${tuple([X * acc(i, t1), Y * acc(i, t2)], fmts)}$`,
        why: "The question asks for the amounts invested today; the face amounts are those amounts accumulated to each maturity.",
        stage: sY,
        error: "interpretation",
      },
      {
        id: "SEQ_UNDISCOUNTED_SUM",
        parts: [
          [Ltot * w, `${lit(Ltot)}*${wE}`],
          [Ltot * (1 - w), `${lit(Ltot)}*(1-${wE})`],
        ],
        method: "Allocated the undiscounted liability total.",
        derivation: `$${mamt(Ltot)} \\times (${dec(w, 4)}, ${dec(1 - w, 4)})$: $${tuple([Ltot * w, Ltot * (1 - w)], fmts)}$`,
        why: "The assets must match the present value of the liabilities, not their face total.",
        stage: 0,
        error: "selection",
      },
      {
        id: "FORMULA_MODIFIED_FOR_MACAULAY",
        parts: pair(modA, modE),
        method: "Matched the liabilities' modified duration to the bonds' Macaulay durations.",
        derivation: `$D = ${dec(D, 4)}/${dec(1 + i, 4)} = ${dec(Dmod, 4)}$: $${tuple(modA, fmts)}$`,
        why: "Both sides must use the same measure. A zero-coupon bond's Macaulay duration is its term; comparing it with a modified duration mixes the two.",
        stage: lvl === 2 ? sD : sX,
        error: "selection",
      }
    );
    const yExpr = `(${TPVE} - ${t1}*${PVE})/${t2 - t1}`;
    return compositeQuestion({
      style: "allocation",
      labels: ["Bond X", "Bond Y"],
      formats: fmts,
      stem: `A company must pay ${liabText}. It will invest in Bond X, a zero-coupon bond maturing in ${t1} years, and Bond Y, a zero-coupon bond maturing in ${t2} years, so that the present value and the Macaulay duration of its assets equal those of its liabilities. The annual effective interest rate is ${pc(i)}.\n\nCalculate the amount invested today in each bond.`,
      correct: {
        parts: [
          [X, XE],
          [Y, YE],
        ],
        why: `PV of liabilities ${mnum(PV, 2)}, duration ${dec(D, 4)}; weight in Bond X $= (${t2} - ${dec(D, 4)})/${t2 - t1} = ${dec(w, 4)}$.`,
        derivation: `$${tuple([X, Y], fmts)}$`,
      },
      wrong,
      reference: {
        description: `Two moment conditions, x + y = PV and ${t1}x + ${t2}y = Σ t·PV(L_t), solved for y and x directly.`,
        values: [{ expr: `${PVE} - ${yExpr}` }, { expr: yExpr }],
      },
      explanation: explain({
        intuition: "A zero-coupon bond's duration is its maturity, so the portfolio's duration is a weighted average of the two maturities. The weights that average to the liabilities' duration are fixed by how far each bond sits from it — the nearer bond gets more.",
        unknowns: [
          ["$X$", "amount invested in Bond X"],
          ["$Y$", "amount invested in Bond Y"],
        ],
        relationships: ["$X + Y = PV_L$", `$${t1}X + ${t2}Y = D_L \\cdot PV_L$`],
        conditions: ["Present values equal.", "Macaulay durations equal."],
        valuationDate: "Time 0.",
        modelChoice: "Portfolio duration = PV-weighted average of the bonds' durations.",
        assumptions: ["Flat yield curve at the stated rate."],
        solution: [
          ["Liability value", `$PV_L = ${liab.map((f) => `${mamt(f.amount)}v^{${f.t}}`).join(" + ")} = ${mnum(PV, 2)}$`],
          ...(lvl === 2 ? [["Liability duration", `$D_L = ${dec(D, 4)}$`] as [string, string]] : [["Liability duration", `$D_L = ${liab[0].t}$ (a single payment)`] as [string, string]]),
          ["Weights", `$w_X = (${t2} - D_L)/(${t2} - ${t1}) = ${dec(w, 4)}$`],
          ["Amounts", `$X = ${mnum(X, 2)}$, $Y = ${mnum(Y, 2)}$, so $(X, Y) = ${tuple([X, Y], fmts)}$.`],
        ],
        alternatives: [["Two equations", "Solve $X + Y = PV_L$ and $t_1X + t_2Y = \\sum t\\,PV(L_t)$ by elimination.", "When the weights formula is not remembered."]],
        principle: "To match PV and Macaulay duration with two zero-coupon bonds, split the PV in the ratio of distances: w_1 = (t_2 − D)/(t_2 − t_1).",
        unusual: lvl === 2 ? "Two liabilities: their duration must be computed first." : "The liability is a single payment, so its duration is its time.",
        misread: "Swapping the weights, or reporting face amounts instead of amounts invested.",
      }),
      steps,
      methods: ["simultaneous", "substitution"],
      reasoning: "Match the zeroth and first moments of the discounted cash flows: total PV and PV-weighted time.",
      presentation: lvl === 2 ? ["multi-equation", "combined-topics"] : ["multi-equation"],
      params: { i, t1, t2, liabilities: JSON.stringify(liab) },
      itemFormat: "portfolio-allocation",
      relationship: "$X + Y = PV_L$, $t_1 X + t_2 Y = D_L\\,PV_L$",
    });
  },
});

// ===================================================================== full immunization of one liability

const fullImmunization = compositeTemplate({
  id: "comp-full-immunization",
  family: "comp-full-immunization",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.full_immunization",
  secondary: ["ALM.duration", "ALM.portfolio"],
  reasoning: ["simultaneous_equations", "financial_intuition", "multistep", "formula_reconstruction"],
  soaConcept: "Two zero-coupon assets on either side of a single liability that fully immunize it: face amounts, or the unknown maturity and face of the second asset.",
  itemFormat: "portfolio-allocation",
  variants: 1,
  generate(rng, lvl): ChoiceDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const T = rng.int(5, 12);
    const L = gridAmount(rng, 100000, 1000000, 10000);
    const a = rng.int(1, 3);
    const PV = L * v(i, T);
    const PVE = `${lit(L)}*${vPow(i, T)}`;

    if (lvl === 2) {
      const b = drawUntil(() => rng.int(1, 4), (bb) => bb !== a);
      const fmts = [MONEY2, MONEY2];
      const wA = b / (a + b);
      const A = PV * wA * acc(i, T - a);
      const B = PV * (1 - wA) * acc(i, T + b);
      const AE = `${PVE}*${b}/${a + b}*${accPow(i, T - a)}`;
      const BE = `${PVE}*${a}/${a + b}*${accPow(i, T + b)}`;
      const M = [
        [vPow(i, T - a), vPow(i, T + b)],
        [`${T - a}*${vPow(i, T - a)}`, `${T + b}*${vPow(i, T + b)}`],
      ];
      const ref = cramerE(M, [PVE, `${T}*${PVE}`]);
      const steps = [
        step("A.discount-factor", "Present value of the liability.", ["PV_L", PV, "present value of the liability"], ["L", "i"]),
        step("G.full-immunization", `Duration matching about time ${T}: $PV_A \\cdot ${a} = PV_B \\cdot ${b}$, so Bond A holds ${b}/${a + b} of the value; accumulate to its maturity.`, ["A", A, "face of Bond A"], ["PV_L"], { derived: true }),
        step("G.full-immunization", `Bond B holds ${a}/${a + b} of the value; accumulate to its maturity.`, ["B", B, "face of Bond B"], ["PV_L"], { derived: true }),
      ];
      const sw = [PV * (a / (a + b)) * acc(i, T - a), PV * (b / (a + b)) * acc(i, T + b)];
      const ev = [(PV / 2) * acc(i, T - a), (PV / 2) * acc(i, T + b)];
      const pvs = [PV * wA, PV * (1 - wA)];
      const und = [L * wA, L * (1 - wA)];
      const ww = [PV * wA * v(i, T - a), PV * (1 - wA) * v(i, T + b)];
      return compositeQuestion({
        style: "allocation",
        labels: ["Bond A", "Bond B"],
        formats: fmts,
        stem: `A company must pay ${amt(L)} at the end of ${T} years. It will fully immunize this liability at an annual effective interest rate of ${pc(i)} by buying two zero-coupon bonds: Bond A, maturing at the end of ${T - a} years, and Bond B, maturing at the end of ${T + b} years.\n\nCalculate the amount payable at maturity by each bond.`,
        correct: {
          parts: [
            [A, AE],
            [B, BE],
          ],
          why: `Present values split ${b}:${a} (inversely to the distances from time ${T}); accumulating gives $A = ${mnum(A, 2)}$ and $B = ${mnum(B, 2)}$.`,
          derivation: `$${tuple([A, B], fmts)}$`,
        },
        wrong: [
          {
            id: "ALLOC_SWAPPED",
            parts: [
              [sw[0], `${PVE}*${a}/${a + b}*${accPow(i, T - a)}`],
              [sw[1], `${PVE}*${b}/${a + b}*${accPow(i, T + b)}`],
            ],
            method: "Gave each bond the weight proportional to its own distance from the liability.",
            derivation: `$${tuple(sw, fmts)}$`,
            why: `Duration matching requires $PV_A \\cdot ${a} = PV_B \\cdot ${b}$, so the nearer bond holds more value: Bond A's share is ${b}/${a + b}.`,
            stage: 1,
            error: "connection",
          },
          {
            id: "ALLOC_EVEN_SPLIT",
            parts: [
              [ev[0], `${PVE}/2*${accPow(i, T - a)}`],
              [ev[1], `${PVE}/2*${accPow(i, T + b)}`],
            ],
            method: "Split the liability's present value equally.",
            derivation: `$${tuple(ev, fmts)}$`,
            why: `With equal present values the portfolio's duration is $${T} + (${b} - ${a})/2$, not ${T}.`,
            stage: 1,
            error: "selection",
            conditionTrue: "If the two bonds were equally far from the liability date.",
          },
          {
            id: "VAR_OTHER_UNKNOWN",
            parts: [
              [pvs[0], `${PVE}*${b}/${a + b}`],
              [pvs[1], `${PVE}*${a}/${a + b}`],
            ],
            method: "Reported the amounts invested today.",
            derivation: `$${tuple(pvs, fmts)}$`,
            why: "These are the present values of the bonds; the amounts payable at maturity are these accumulated to each maturity.",
            stage: 2,
            error: "interpretation",
          },
          {
            id: "SEQ_UNDISCOUNTED_SUM",
            parts: [
              [und[0], `${lit(L)}*${b}/${a + b}`],
              [und[1], `${lit(L)}*${a}/${a + b}`],
            ],
            method: "Split the liability amount itself in the duration ratio.",
            derivation: `$${tuple(und, fmts)}$`,
            why: "The split applies to present values; each bond's face is then its present value accumulated to its own maturity.",
            stage: 0,
            error: "selection",
          },
          {
            id: "CONC_MOVED_WRONG_WAY",
            parts: [
              [ww[0], `${PVE}*${b}/${a + b}*${vPow(i, T - a)}`],
              [ww[1], `${PVE}*${a}/${a + b}*${vPow(i, T + b)}`],
            ],
            method: "Discounted the present values instead of accumulating them to maturity.",
            derivation: `$${tuple(ww, fmts)}$`,
            why: "A maturity value lies in the future: multiply the amount invested today by $(1 + i)^{t}$.",
            stage: 2,
            error: "application",
          },
        ],
        reference: {
          description: "Cramer's rule on the two full-immunization conditions written in face amounts: A v^(T−a) + B v^(T+b) = L v^T and (T−a)A v^(T−a) + (T+b)B v^(T+b) = T·L v^T.",
          values: ref.map((expr) => ({ expr })),
        },
        explanation: explain({
          intuition: "Full immunization puts one asset before and one after the liability, sized so that the portfolio balances on the liability date like a see-saw: the nearer asset carries more present value.",
          unknowns: [
            ["$A$", `face of Bond A (time ${T - a})`],
            ["$B$", `face of Bond B (time ${T + b})`],
          ],
          relationships: [`$Av^{${T - a}} + Bv^{${T + b}} = ${mamt(L)}v^{${T}}$`, `$${a}\\,Av^{${T - a}} = ${b}\\,Bv^{${T + b}}$`],
          conditions: ["PV of assets = PV of liability.", "Durations equal.", "Assets on both sides of the liability (so convexity is larger)."],
          valuationDate: `Time 0 for the conditions; maturity dates for the face amounts.`,
          modelChoice: "Duration matching about the liability date gives the PV ratio directly.",
          assumptions: ["Flat yield curve; parallel shifts."],
          solution: [
            ["Liability value", `$PV_L = ${mamt(L)}v^{${T}} = ${mnum(PV, 2)}$`],
            ["Present values", `$PV_A = ${mnum(PV, 2)} \\times ${b}/${a + b} = ${mnum(pvs[0], 2)}$, $PV_B = ${mnum(pvs[1], 2)}$`],
            ["Face amounts", `$A = PV_A(1 + i)^{${T - a}} = ${mnum(A, 2)}$, $B = PV_B(1 + i)^{${T + b}} = ${mnum(B, 2)}$, so $(A, B) = ${tuple([A, B], fmts)}$.`],
          ],
          alternatives: [["Shortcut in face amounts", `$A = ${mamt(L)} \\cdot \\frac{${b}}{${a + b}} v^{${a}}$ and $B = ${mamt(L)} \\cdot \\frac{${a}}{${a + b}}(1 + i)^{${b}}$.`, "Fast when the asset dates are given relative to the liability."]],
          principle: "Full immunization of a single liability at T with assets at T − a and T + b: PV_A·a = PV_B·b and PV_A + PV_B = PV_L.",
          unusual: "The answer is the maturity amounts, not the amounts invested.",
          misread: "Swapping the weights, or stopping at the present values.",
        }),
        steps,
        methods: ["simultaneous", "substitution"],
        reasoning: "Write the PV and duration conditions; the duration condition about the liability date gives the PV ratio.",
        presentation: ["multi-equation"],
        params: { L, T, a, b, i },
        itemFormat: "portfolio-allocation",
        relationship: "$PV_A + PV_B = PV_L$, $a\\,PV_A = b\\,PV_B$",
      });
    }

    // Level 3: Bond A's face is given; find the maturity and face of Bond B.
    const fmts = [YEARS_T, MONEY2];
    const b0 = drawUntil(() => rng.int(2, 8) / 2, (bb) => Math.abs(bb - a) >= 0.5);
    const A = Math.max(1000, Math.round((PV * (b0 / (a + b0)) * acc(i, T - a)) / 1000) * 1000);
    const pvA = A * v(i, T - a);
    const pvAE = `${lit(A)}*${vPow(i, T - a)}`;
    const Q = PV - pvA;
    if (Q <= 0) throw new Error("Bond A alone exceeds the liability value.");
    const QE = `(${PVE} - ${pvAE})`;
    const b = (a * pvA) / Q;
    const bE = `(${a}*${pvAE}/${QE})`;
    const t = T + b;
    const tE = `${T} + ${bE}`;
    const Fb = Q * acc(i, t);
    const FbE = `${QE}*${accPow(i, `(${tE})`)}`;
    const withB = (bb: number, bbE: string): Comp[] => [
      [T + bb, `${T} + ${bbE}`],
      [Q * acc(i, T + bb), `${QE}*${accPow(i, `(${T} + ${bbE})`)}`],
    ];
    const bU = (a * A) / (L - A);
    const bUE = `(${a}*${lit(A)}/(${lit(L)} - ${lit(A)}))`;
    const bI = (a * Q) / pvA;
    const bIE = `(${a}*${QE}/${pvAE})`;
    const steps = [
      step("A.discount-factor", "Present value of the liability.", ["PV_L", PV, "present value of the liability"], ["L", "i"]),
      step("A.equation-of-value", "PV matching: Bond B must supply the value Bond A does not.", ["PV_B", Q, "present value of Bond B"], ["PV_L", "A"]),
      step("G.full-immunization", `Duration matching about time ${T}: $${a}\\,PV_A = b\\,PV_B$, solved for b.`, ["t", t, "maturity of Bond B"], ["PV_A", "PV_B"], { rearranged: true, derived: true }),
      step("A.compound", "Accumulate Bond B's present value to its maturity.", ["F", Fb, "face of Bond B"], ["PV_B", "t"]),
    ];
    const uw = withB(bU, bUE);
    const iw = withB(bI, bIE);
    const sym = withB(a, String(a));
    return compositeQuestion({
      style: "ordered-pair",
      labels: ["Maturity of Bond B", "Face of Bond B"],
      formats: fmts,
      stem: `A company must pay ${amt(L)} at the end of ${T} years. It holds Bond A, a zero-coupon bond paying ${amt(A)} at the end of ${T - a} years, and will buy one more zero-coupon bond, Bond B, maturing after year ${T}, so that the liability is fully immunized at an annual effective interest rate of ${pc(i)}.\n\nLet $t$ be the time, in years, at which Bond B matures and $F$ the amount it pays. Calculate $(t, F)$.`,
      correct: {
        parts: [
          [t, tE],
          [Fb, FbE],
        ],
        why: `$PV_B = ${mnum(PV, 2)} - ${mnum(pvA, 2)} = ${mnum(Q, 2)}$; $${a}(${mnum(pvA, 2)}) = b(${mnum(Q, 2)})$ gives $b = ${dec(b, 4)}$, so $t = ${dec(t, 4)}$ and $F = ${mnum(Fb, 2)}$.`,
        derivation: `$${tuple([t, Fb], fmts)}$`,
      },
      wrong: [
        {
          id: "MODEL_UNDISCOUNTED_WEIGHTS",
          parts: uw,
          method: "Balanced the face amounts instead of the present values in the duration condition.",
          derivation: `$b = ${a}(${mamt(A)})/(${mamt(L)} - ${mamt(A)}) = ${dec(bU, 4)}$: $${tuple([uw[0][0], uw[1][0]], fmts)}$`,
          why: "Duration weights are present values: the condition is $a\\,PV_A = b\\,PV_B$.",
          stage: 2,
          error: "application",
        },
        {
          id: "VAR_OTHER_UNKNOWN",
          parts: [
            [t, tE],
            [Q, QE],
          ],
          method: "Reported Bond B's present value as its maturity amount.",
          derivation: `$${tuple([t, Q], fmts)}$`,
          why: `${mnum(Q, 2)} is the amount invested today; Bond B pays it accumulated to time ${dec(t, 4)}.`,
          stage: 3,
          error: "interpretation",
        },
        {
          id: "TIMING_VALUATION_DATE",
          parts: [
            [t, tE],
            [Q * acc(i, b), `${QE}*${accPow(i, bE)}`],
          ],
          method: `Accumulated Bond B's present value only from time ${T}.`,
          derivation: `$F = PV_B(1 + i)^{${dec(b, 4)}}$: $${tuple([t, Q * acc(i, b)], fmts)}$`,
          why: `$PV_B$ is a value at time 0, so it must be accumulated over the full ${dec(t, 4)} years.`,
          stage: 3,
          error: "application",
        },
        {
          id: "ALG_INVERTED_RATIO",
          parts: iw,
          method: "Inverted the present-value ratio when solving for b.",
          derivation: `$b = ${a}\\,PV_B/PV_A = ${dec(bI, 4)}$: $${tuple([iw[0][0], iw[1][0]], fmts)}$`,
          why: "From $a\\,PV_A = b\\,PV_B$, $b = a\\,PV_A/PV_B$: the asset carrying less value must sit further away.",
          stage: 2,
          error: "application",
        },
        {
          id: "COMP_SYMMETRIC_DATES",
          parts: sym,
          method: `Placed Bond B ${a} years after the liability, mirroring Bond A.`,
          derivation: `$t = ${T + a}$: $${tuple([sym[0][0], sym[1][0]], fmts)}$`,
          why: "Symmetric dates balance only if the two present values are equal, which they are not here.",
          stage: 2,
          error: "selection",
          conditionTrue: "If Bond A held exactly half of the liability's present value.",
        },
      ],
      reference: {
        description: `t from duration matching about time 0: (T−a)·PV_A + t·PV_B = T·PV_L; F solves F·v^t = PV_B with t written from that moment equation.`,
        values: [
          { expr: `${T - a}*${pvAE} + x*${QE} - ${T}*${PVE}`, bracket: [T, T + 40] },
          { expr: `x*${vPow(i, `(${T}*${PVE} - ${T - a}*${pvAE})/${QE}`)} - ${QE}`, bracket: [0, 50 * L] },
        ],
      },
      explanation: explain({
        intuition: "Bond A already provides part of the liability's value from before the liability date. Bond B must supply the rest of the value, and must sit far enough after the liability that the two balance on the liability date.",
        unknowns: [
          ["$PV_B$", "present value of Bond B"],
          ["$t$", "maturity of Bond B"],
          ["$F$", "face of Bond B"],
        ],
        relationships: [`$PV_B = ${mamt(L)}v^{${T}} - ${mamt(A)}v^{${T - a}}$`, `$${a}\\,PV_A = (t - ${T})PV_B$`, "$F = PV_B(1 + i)^{t}$"],
        conditions: ["PV of assets = PV of liability.", "Durations equal.", "Assets on both sides of the liability."],
        valuationDate: "Time 0 for the conditions; time t for the face.",
        modelChoice: "The unknown is a date, so the duration condition is solved for a time, not for an amount.",
        assumptions: ["Flat yield curve; parallel shifts."],
        solution: [
          ["Values", `$PV_L = ${mnum(PV, 2)}$, $PV_A = ${mnum(pvA, 2)}$, $PV_B = ${mnum(Q, 2)}$`],
          ["Maturity", `$b = ${a}(${mnum(pvA, 2)})/${mnum(Q, 2)} = ${dec(b, 4)}$, so $t = ${dec(t, 4)}$`],
          ["Face", `$F = ${mnum(Q, 2)}(1 + i)^{${dec(t, 4)}} = ${mnum(Fb, 2)}$, so $(t, F) = ${tuple([t, Fb], fmts)}$.`],
        ],
        alternatives: [["Moments about time 0", `$${T - a}\\,PV_A + t\\,PV_B = ${T}\\,PV_L$ gives the same $t$ without the see-saw picture.`, "When the assets are not described relative to the liability date."]],
        principle: "For full immunization of one liability, the duration condition can be solved for a missing date as easily as for a missing amount: a·PV_A = b·PV_B.",
        unusual: "The maturity of an asset is the unknown, so it appears in an exponent when the face is found.",
        misread: "Balancing face amounts instead of present values, or accumulating only from the liability date.",
      }),
      steps,
      methods: ["equation_construction", "substitution", "rearrangement"],
      reasoning: "Fix PV_B from PV matching, solve the duration condition for the date, then accumulate.",
      presentation: ["inverse", "hidden-structure"],
      modelingDecisions: 2,
      params: { L, T, a, A, i },
      itemFormat: "ordered-pair",
      relationship: "$PV_A + PV_B = PV_L$, $a\\,PV_A = b\\,PV_B$, $F = PV_B(1 + i)^{T+b}$",
    });
  },
});

// ===================================================================== duration-matched allocation: zero-coupon and coupon bond, two liabilities

const redingtonCoupon = compositeTemplate({
  id: "comp-redington-coupon",
  family: "comp-duration-allocation",
  topic: "ALM",
  levels: [3],
  objective: "ALM.redington",
  secondary: ["ALM.duration", "ALM.portfolio", "ALM.convexity"],
  reasoning: ["formula_selection", "simultaneous_equations", "multistep", "financial_intuition"],
  soaConcept: "Amounts invested in a zero-coupon bond and a coupon bond so that PV and Macaulay duration match two liabilities, with the convexity condition checked.",
  itemFormat: "portfolio-allocation",
  variants: 1,
  generate(rng): ChoiceDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const fmts = [MONEY2, MONEY2];
    const setup = drawUntil(
      () => {
        const Ta = rng.int(3, 5);
        const Tb = Ta + rng.int(3, 6);
        const liab = [
          { t: Ta, amount: gridAmount(rng, 50000, 300000, 5000) },
          { t: Tb, amount: gridAmount(rng, 50000, 300000, 5000) },
        ];
        const tX = rng.int(1, Ta - 1);
        const n = Tb + rng.int(2, 6);
        const c = gridRate(rng, 0.03, 0.08, 0.005);
        const bond = [...range(1, n).map((t) => ({ t, amount: c })), { t: n, amount: 1 }];
        return { liab, tX, n, c, bond, DL: macaulayDuration(liab, i), DY: macaulayDuration(bond, i) };
      },
      (s) => s.tX < s.DL - 0.5 && s.DY > s.DL + 0.5 && Math.abs((s.DY - s.DL) / (s.DY - s.tX) - 0.5) > 0.05
    );
    const { liab, tX, n, c, bond, DL, DY } = setup;
    const PV = pvFlows(liab, i);
    const PVE = `(${liab.map((f) => `${lit(f.amount)}*${vPow(i, f.t)}`).join(" + ")})`;
    const TPVE = `(${liab.map((f) => `${f.t}*${lit(f.amount)}*${vPow(i, f.t)}`).join(" + ")})`;
    const DLE = `${TPVE}/${PVE}`;
    const unitE = `(${lit(c)}*${aExpr(n, i)} + ${vPow(i, n)})`;
    const DYE = `((${sumOf(range(1, n).map((t) => `${t}*${vPow(i, t)}`))})*${lit(c)} + ${n}*${vPow(i, n)})/${unitE}`;
    const [X, Y] = durAlloc(PV, DL, tX, DY);
    const [XE, YE] = durAllocE(PVE, DLE, String(tX), DYE);
    const Ltot = liab.reduce((s, f) => s + f.amount, 0);
    const Dface = liab.reduce((s, f) => s + f.t * f.amount, 0) / Ltot;
    const DfaceE = `(${liab.map((f) => `${f.t}*${lit(f.amount)}`).join(" + ")})/${lit(Ltot)}`;
    const w = (DY - DL) / (DY - tX);
    const wE = `((${DYE}) - (${DLE}))/((${DYE}) - ${tX})`;
    // Convexity check (reported in the explanation).
    const unit = pvFlows(bond, i);
    const assets: Flow[] = [{ t: tX, amount: X * acc(i, tX) }, ...bond.map((f) => ({ t: f.t, amount: (f.amount * Y) / unit }))];
    const CA = convexity(assets, i);
    const CL = convexity(liab, i);
    const steps = [
      step("C.npv", "Present value of the two liabilities.", ["PV_L", PV, "present value of liabilities"], ["L", "i"]),
      step("G.macaulay", "Macaulay duration of the liabilities.", ["D_L", DL, "liability duration"], ["PV_L"]),
      step("G.macaulay", `Macaulay duration of the ${n}-year coupon bond (per unit face).`, ["D_Y", DY, "duration of Bond Y"], ["c", "i", "n"]),
      step("G.portfolio-duration", `Portfolio duration = weighted average of ${tX} and $D_Y$; solve for Bond X's weight.`, ["X", X, "amount in Bond X"], ["PV_L", "D_L", "D_Y"], { rearranged: true }),
      step("A.equation-of-value", "PV matching: the rest goes into Bond Y.", ["Y", Y, "amount in Bond Y"], ["PV_L", "X"]),
    ];
    const uA = durAlloc(PV, Dface, tX, DY);
    const zA = durAlloc(PV, DL, tX, n);
    const mA = durAlloc(PV, DL, tX, DY / (1 + i));
    const wrong: WrongOption[] = [
      {
        id: "COMP_COUPON_BOND_AS_ZERO",
        parts: pair(zA, durAllocE(PVE, DLE, String(tX), String(n))),
        method: `Took Bond Y's duration as its term, ${n}.`,
        derivation: `$D_Y = ${n}$: $${tuple(zA, fmts)}$`,
        why: `Bond Y pays coupons before year ${n}, so its duration is ${dec(DY, 4)}, not ${n}.`,
        stage: 2,
        error: "selection",
        conditionTrue: "If Bond Y were a zero-coupon bond.",
      },
      {
        id: "MODEL_UNDISCOUNTED_WEIGHTS",
        parts: pair(uA, durAllocE(PVE, DfaceE, String(tX), DYE)),
        method: "Weighted the liability times by their face amounts.",
        derivation: `$D_L = ${dec(Dface, 4)}$: $${tuple(uA, fmts)}$`,
        why: `Macaulay duration weights by present values: $D_L = ${dec(DL, 4)}$.`,
        stage: 1,
        error: "application",
      },
      {
        id: "FORMULA_MODIFIED_FOR_MACAULAY",
        parts: pair(mA, durAllocE(PVE, DLE, String(tX), `(${DYE})/(1+${lit(i)})`)),
        method: "Used Bond Y's modified duration with Macaulay durations elsewhere.",
        derivation: `$D_Y = ${dec(DY, 4)}/${dec(1 + i, 4)}$: $${tuple(mA, fmts)}$`,
        why: "All durations in the matching condition must be of the same kind; the question specifies Macaulay duration.",
        stage: 2,
        error: "selection",
      },
      {
        id: "ALLOC_SWAPPED",
        parts: [
          [Y, YE],
          [X, XE],
        ],
        method: "Swapped the two amounts.",
        derivation: `$${tuple([Y, X], fmts)}$`,
        why: `Bond X's share is $(D_Y - D_L)/(D_Y - ${tX}) = ${dec(w, 4)}$.`,
        stage: 3,
        error: "connection",
      },
      {
        id: "ALLOC_EVEN_SPLIT",
        parts: [
          [PV / 2, `${PVE}/2`],
          [PV / 2, `${PVE}/2`],
        ],
        method: "Split the present value equally.",
        derivation: `$${tuple([PV / 2, PV / 2], fmts)}$`,
        why: `An equal split has duration ${dec((tX + DY) / 2, 4)}, not ${dec(DL, 4)}.`,
        stage: 3,
        error: "selection",
      },
      {
        id: "SEQ_UNDISCOUNTED_SUM",
        parts: [
          [Ltot * w, `${lit(Ltot)}*${wE}`],
          [Ltot * (1 - w), `${lit(Ltot)}*(1-${wE})`],
        ],
        method: "Allocated the undiscounted total of the liabilities.",
        derivation: `$${tuple([Ltot * w, Ltot * (1 - w)], fmts)}$`,
        why: "The assets must match the present value of the liabilities.",
        stage: 0,
        error: "selection",
      },
    ];
    const DYref = `(${pvTerms(bond.map((f) => ({ t: f.t, amount: f.t * f.amount })), i)})/(${pvTerms(bond, i)})`;
    const yRef = `(${TPVE} - ${tX}*${PVE})/((${DYref}) - ${tX})`;
    return compositeQuestion({
      style: "allocation",
      labels: ["Bond X", "Bond Y"],
      formats: fmts,
      stem: `A company must pay ${amt(liab[0].amount)} at the end of ${liab[0].t} years and ${amt(liab[1].amount)} at the end of ${liab[1].t} years. It will invest in Bond X, a zero-coupon bond maturing in ${tX} year${tX === 1 ? "" : "s"}, and Bond Y, ${[8, 11, 18].includes(n) ? "an" : "a"} ${n}-year bond with annual coupons at ${pc(c)} redeemable at par, so that the present value and the Macaulay duration of its assets equal those of its liabilities. The annual effective interest rate is ${pc(i)} for all maturities.\n\nCalculate the amount invested today in each bond.`,
      correct: {
        parts: [
          [X, XE],
          [Y, YE],
        ],
        why: `$PV_L = ${mnum(PV, 2)}$, $D_L = ${dec(DL, 4)}$, $D_Y = ${dec(DY, 4)}$; Bond X's share $= (${dec(DY, 4)} - ${dec(DL, 4)})/(${dec(DY, 4)} - ${tX}) = ${dec(w, 4)}$.`,
        derivation: `$${tuple([X, Y], fmts)}$`,
      },
      wrong,
      reference: {
        description: `Moment equations x + y = PV_L and ${tX}x + D_Y·y = Σ t·PV(L_t), with D_Y written as Σ t·CF·v^t / Σ CF·v^t over Bond Y's explicit cash flows; solved for y, then x = PV_L − y.`,
        values: [{ expr: `${PVE} - ${yRef}` }, { expr: yRef }],
      },
      explanation: explain({
        intuition: "Duration is a PV-weighted average time, for a portfolio as for a single bond. The zero-coupon bond's duration is its term; the coupon bond's must be computed. The two amounts are then the weights that average these two durations to the liabilities' duration.",
        unknowns: [
          ["$X, Y$", "amounts invested in Bonds X and Y"],
          ["$D_L, D_Y$", "durations of the liabilities and of Bond Y"],
        ],
        relationships: ["$X + Y = PV_L$", `$${tX}X + D_Y\\,Y = D_L\\,PV_L$`],
        conditions: ["PV and Macaulay duration matched.", "Redington also needs asset convexity above liability convexity."],
        valuationDate: "Time 0.",
        modelChoice: "Treat the coupon bond as one asset with its own duration, not as a zero at its maturity.",
        assumptions: ["Flat yield curve at the stated rate; bonds can be bought in any amount."],
        solution: [
          ["Liabilities", `$PV_L = ${liab.map((f) => `${mamt(f.amount)}v^{${f.t}}`).join(" + ")} = ${mnum(PV, 2)}$, $D_L = ${dec(DL, 4)}$`],
          ["Bond Y", `$D_Y = \\dfrac{\\sum t\\,(${dec(c, 3)})v^t + ${n}v^{${n}}}{${dec(c, 3)}\\,${aSym(n, "i")} + v^{${n}}} = ${dec(DY, 4)}$`],
          ["Weights", `$w_X = (D_Y - D_L)/(D_Y - ${tX}) = ${dec(w, 4)}$`],
          ["Amounts", `$X = ${mnum(X, 2)}$, $Y = ${mnum(Y, 2)}$, so $(X, Y) = ${tuple([X, Y], fmts)}$.`],
          ["Convexity check", `Asset convexity ${dec(CA, 2)} vs liability convexity ${dec(CL, 2)}: Redington's third condition ${CA > CL ? "holds, so the surplus is protected against small parallel shifts" : "fails, so this match is first-order only"}.`],
        ],
        alternatives: [["Elimination", "Solve the two moment equations by elimination instead of using the weight formula.", "When a third asset or a non-flat curve makes the weight formula inapplicable."]],
        principle: "To match PV and duration with two assets, weight their durations to the liabilities' duration: w_1 = (D_2 − D_L)/(D_2 − D_1). A coupon bond's duration is below its term.",
        unusual: "One asset is a coupon bond, so its duration must be computed before allocating.",
        misread: "Using the coupon bond's term as its duration, or face-weighting the liability times.",
      }),
      steps,
      methods: ["simultaneous", "substitution"],
      reasoning: "Compute PV_L, D_L and D_Y, then solve the PV and duration conditions for the two amounts.",
      presentation: ["hidden-structure", "multi-equation", "combined-topics"],
      modelingDecisions: 2,
      params: { i, tX, n, c, liabilities: JSON.stringify(liab) },
      itemFormat: "portfolio-allocation",
      relationship: "$X + Y = PV_L$, $D_X X + D_Y Y = D_L PV_L$",
      visuals: [{ kind: "duration", title: "Assets and liabilities on one timeline", flows: assets, rate: i, liabilities: liab }],
    });
  },
});

export const COMPOSITE_TEMPLATES: ChoiceTemplate[] = [
  loanComponents,
  loanPaymentBalance,
  amortTable,
  bondPriceBook,
  spotForwardPair,
  spotTableBond,
  fundReturns,
  cashflowNpvIrr,
  matchBonds,
  zeroDurationMatch,
  fullImmunization,
  redingtonCoupon,
];
