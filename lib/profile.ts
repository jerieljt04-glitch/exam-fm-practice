import type { MisconceptionCategory, MisconceptionId } from "./engine/misconceptions";
import type { ReasoningSkill } from "./engine/skills";

/**
 * The initial diagnostic profile, from the candidate's own account of their
 * preparation. Every entry is a hypothesis to be tested, not a label: the
 * dashboard shows each one alongside the evidence for and against it, and the
 * diagnostic generator prefers questions that test hypotheses with little
 * evidence yet.
 */

export interface Hypothesis {
  id: string;
  kind: "strength" | "weakness";
  title: string;
  statement: string;
  /** Reasoning skills whose performance tests this hypothesis. */
  skills: ReasoningSkill[];
  /** Misconceptions whose selection counts as evidence for a weakness. */
  misconceptions?: MisconceptionId[];
  categories?: MisconceptionCategory[];
}

export const INITIAL_HYPOTHESES: Hypothesis[] = [
  {
    id: "S-translation",
    kind: "strength",
    title: "Translating straightforward relationships into equations",
    statement: "Can turn single-condition verbal relationships into algebraic equations.",
    skills: ["translation"],
  },
  {
    id: "S-simultaneous",
    kind: "strength",
    title: "Two-variable simultaneous equations",
    statement: "Solves pairs of linear equations by substitution and elimination.",
    skills: ["simultaneous_equations", "algebra"],
  },
  {
    id: "S-sequences",
    kind: "strength",
    title: "Arithmetic sequences and their sums",
    statement: "Recognises arithmetic sequences, derives general terms and sums by pairing terms.",
    skills: ["formula_reconstruction"],
    misconceptions: ["SEQ_TERM_COUNT", "SEQ_ARITHMETIC_AS_GEOMETRIC"],
  },
  {
    id: "S-separate-flows",
    kind: "strength",
    title: "Separate cash flows at different times",
    statement: "Values individual cash flows at different dates with compound interest.",
    skills: ["cashflow_modelling"],
  },
  {
    id: "S-annuity-intuition",
    kind: "strength",
    title: "Annuity-immediate versus annuity-due intuition",
    statement: "Understands the broad difference between payments at the start and end of periods.",
    skills: ["financial_intuition"],
    misconceptions: ["TIMING_DUE_AS_IMMEDIATE", "TIMING_IMMEDIATE_AS_DUE"],
  },
  {
    id: "S-retrospective",
    kind: "strength",
    title: "Retrospective outstanding balance",
    statement: "Understands the retrospective approach to a loan's outstanding balance.",
    skills: ["cashflow_modelling", "valuation_dates"],
    misconceptions: ["TIMING_BALANCE_INDEX", "TIMING_PAYMENT_BEFORE_INTEREST"],
  },
  {
    id: "W-formula-selection",
    kind: "weakness",
    title: "A. Formula selection",
    statement: "Recognises the topic but cannot always determine which mathematical model applies.",
    skills: ["formula_selection", "concept_recognition"],
    categories: ["INCORRECT_FORMULA", "INCORRECT_MODEL"],
  },
  {
    id: "W-formula-retention",
    kind: "weakness",
    title: "B. Formula retention and reconstruction",
    statement: "Remembers the principle but forgets the exact formula; relies on memory rather than derivation.",
    skills: ["formula_retrieval", "formula_reconstruction"],
    categories: ["SEQUENCE_SERIES", "RATE_CONVERSION"],
  },
  {
    id: "W-translation",
    kind: "weakness",
    title: "C. Translation with multiple constraints",
    statement: "Struggles to translate descriptions with several constraints or combined quantities into equations.",
    skills: ["translation", "simultaneous_equations"],
    categories: ["TRANSLATION", "VARIABLE_INTERPRETATION"],
  },
  {
    id: "W-transfer",
    kind: "weakness",
    title: "D. Transfer to unfamiliar presentations",
    statement: "Remembers the trick from a reviewed solution rather than the general principle; rarely practised unlabelled mixed questions.",
    skills: ["transfer", "multistep"],
  },
  {
    id: "W-validation",
    kind: "weakness",
    title: "E. Independent validation",
    statement: "When two formulas seem plausible, relies on wording and intuition rather than checking the model.",
    skills: ["validation"],
  },
  {
    id: "W-timing",
    kind: "weakness",
    title: "F. Timing, interest base and allocation",
    statement: "Possible confusion about which amount accrues interest and when payments affect a balance; misallocated a combined interest amount.",
    skills: ["cashflow_modelling", "valuation_dates"],
    misconceptions: [
      "MODEL_INTEREST_ON_PAYMENT",
      "MODEL_INTEREST_ON_ORIGINAL",
      "TIMING_PAYMENT_BEFORE_INTEREST",
      "ALLOC_AGGREGATE_AS_EACH",
      "ALLOC_EVEN_SPLIT",
    ],
    categories: ["TIMING", "ALLOCATION"],
  },
];

/** Misconceptions the generator prefers to include as distractors, so suspected weaknesses are actually tested. */
export const PROFILE_FOCUS_MISCONCEPTIONS: ReadonlySet<string> = new Set(
  INITIAL_HYPOTHESES.filter((h) => h.kind === "weakness").flatMap((h) => h.misconceptions ?? [])
);
