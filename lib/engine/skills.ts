/** The fourteen reasoning dimensions the diagnostic report measures. */
export const REASONING_SKILLS = [
  "concept_recognition",
  "formula_selection",
  "formula_retrieval",
  "formula_reconstruction",
  "translation",
  "cashflow_modelling",
  "valuation_dates",
  "simultaneous_equations",
  "algebra",
  "arithmetic",
  "financial_intuition",
  "validation",
  "multistep",
  "transfer",
] as const;

export type ReasoningSkill = (typeof REASONING_SKILLS)[number];

export const REASONING_LABELS: Record<ReasoningSkill, string> = {
  concept_recognition: "Financial concept recognition",
  formula_selection: "Formula selection",
  formula_retrieval: "Formula retrieval",
  formula_reconstruction: "Formula reconstruction",
  translation: "Mathematical translation",
  cashflow_modelling: "Cash-flow modelling",
  valuation_dates: "Identifying valuation dates",
  simultaneous_equations: "Simultaneous equation construction",
  algebra: "Algebraic manipulation",
  arithmetic: "Arithmetic accuracy",
  financial_intuition: "Financial intuition",
  validation: "Independent solution validation",
  multistep: "Multi-step reasoning",
  transfer: "Transfer to unfamiliar presentations",
};

export const CONFIDENCE_LEVELS = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  VERY_LOW: "Very low",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very high",
};

export const isConfident = (confidence: Confidence | null | undefined): boolean =>
  confidence === "HIGH" || confidence === "VERY_HIGH";

export const isUnsure = (confidence: Confidence | null | undefined): boolean =>
  confidence === "VERY_LOW" || confidence === "LOW";

export const METHODS = [
  { id: "direct_formula", label: "Direct formula application" },
  { id: "equation_of_value", label: "Equation of value" },
  { id: "timeline", label: "Cash-flow timeline" },
  { id: "substitution", label: "Substitution" },
  { id: "elimination", label: "Elimination" },
  { id: "simultaneous", label: "Simultaneous equations" },
  { id: "work_backwards", label: "Working backwards" },
  { id: "sequence_series", label: "Sequence or series reasoning" },
  { id: "rearrangement", label: "Algebraic rearrangement" },
  { id: "recurrence", label: "Recurrence or iterative calculation" },
  { id: "calculator", label: "Financial calculator" },
  { id: "other", label: "Other / custom approach" },
] as const;

export type MethodId = (typeof METHODS)[number]["id"];

export const METHOD_LABELS: Record<string, string> = Object.fromEntries(METHODS.map((m) => [m.id, m.label]));
