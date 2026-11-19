import type { AnswerType, Exhibit, OptionContent, StatementKey } from "./answers";
import type { OptionKey, TopicId } from "../syllabus";
import type { MisconceptionId } from "./misconceptions";
import type { Rng } from "./random";
import type { ReasoningSkill } from "./skills";

/**
 * 1 — SOA examination standard.
 * 2 — Advanced: connected concepts, inverse problems, unusual timing.
 * 3 — Challenge: deliberately harder reasoning than the examination, still
 *     inside the syllabus.
 */
export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "SOA standard",
  2: "Advanced",
  3: "Challenge",
};

export type AnswerFormat =
  | { kind: "money"; decimals: 0 | 1 | 2 }
  | { kind: "percent"; decimals: 1 | 2 | 3 }
  | { kind: "number"; decimals: number; unit?: string }
  /** A time or a count of periods: "8.42 years", "17 payments". */
  | { kind: "time"; decimals: number; unit: "years" | "months" | "quarters" | "half-years" | "periods" | "payments" };

/**
 * Variation categories a presentation uses (the generator's twelve axes,
 * compressed to the ones that change how a candidate must think).
 */
export type Presentation =
  | "direct"
  | "inverse"
  | "unknown-rate"
  | "unknown-time"
  | "deferred"
  | "mixed-timing"
  | "valuation-date"
  | "frequency"
  | "indirect-wording"
  | "rearrange-first"
  | "multi-equation"
  | "work-backwards"
  | "combined-topics"
  | "irrelevant-info"
  | "hidden-structure"
  | "compare-streams";

/** Features the time-pressure analysis compares error rates across. */
export interface QuestionFeatures {
  multiConcept: boolean;
  formulaRetrieval: boolean;
  multipleValuationDates: boolean;
  unfamiliar: boolean;
  steps: number;
}

// ---------------------------------------------------------------- visuals

export type TimeUnit = "year" | "half-year" | "quarter" | "month";

export interface TimelineFlow {
  t: number;
  amount: number;
  label?: string;
  /** "in" is received by the party whose view the diagram takes. */
  dir: "in" | "out";
  group?: string;
}

export type VisualSpec =
  | {
      kind: "timeline";
      title: string;
      unit: TimeUnit;
      /** Effective rate per unit period, used to move flows between dates. */
      rate: number;
      flows: TimelineFlow[];
      valuationTimes: number[];
      caption?: string;
    }
  | {
      kind: "amortization";
      title: string;
      principal: number;
      rate: number;
      payments: number[];
      unit: TimeUnit;
      highlightPeriod?: number;
      refinance?: { atPeriod: number; newRate: number; newPayments: number[] };
      caption?: string;
    }
  | {
      kind: "bond";
      title: string;
      face: number;
      couponRate: number;
      redemption: number;
      yieldRate: number;
      periods: number;
      unit: TimeUnit;
      highlightPeriod?: number;
      caption?: string;
    }
  | {
      kind: "duration";
      title: string;
      flows: { t: number; amount: number }[];
      rate: number;
      liabilities?: { t: number; amount: number }[];
      shock?: number;
      caption?: string;
    }
  | {
      kind: "flowchart";
      title: string;
      nodes: { id: string; label: string; detail?: string; tone?: "input" | "step" | "result" | "trap" }[];
      edges: { from: string; to: string; label?: string }[];
      caption?: string;
    }
  | {
      kind: "series";
      title: string;
      unit: TimeUnit;
      series: { label: string; values: { t: number; amount: number }[] }[];
      caption?: string;
    }
  | {
      kind: "allocation";
      title: string;
      parts: { label: string; principal: number; interest: number; detail: string }[];
      total: { principal: number; interest: number };
      caption?: string;
    }
  | {
      kind: "curve";
      title: string;
      points: { t: number; spot: number; forward?: number }[];
      caption?: string;
    }
  | {
      kind: "growth";
      title: string;
      /** Accumulation function samples a(t) between start and end. */
      start: number;
      end: number;
      samples: { t: number; value: number }[];
      markers?: { t: number; label: string }[];
      caption?: string;
    };

// ---------------------------------------------------------------- explanation

export interface Translation {
  unknowns: { symbol: string; meaning: string }[];
  relationships: string[];
  conditions: string[];
  valuationDate: string;
  modelChoice: string;
  assumptions: string[];
}

export interface Explanation {
  intuition: string;
  translation: Translation;
  solution: { title: string; body: string }[];
  alternatives: { name: string; body: string; whenUseful: string }[];
  transfer: { principle: string; unusual: string; misread: string };
}

// ---------------------------------------------------------------- formula chains

/** Traditional mathematical techniques a solution uses alongside the formulas. */
export type AlgebraMethod =
  | "substitution"
  | "elimination"
  | "simultaneous"
  | "work_backwards"
  | "rearrangement"
  | "geometric_series"
  | "arithmetic_series"
  | "factorisation"
  | "equation_construction"
  | "decomposition"
  | "valuation_dates"
  | "logarithms"
  | "numerical_root";

export const ALGEBRA_METHOD_LABELS: Record<AlgebraMethod, string> = {
  substitution: "Substitution",
  elimination: "Elimination",
  simultaneous: "Simultaneous equations",
  work_backwards: "Working backwards",
  rearrangement: "Algebraic rearrangement",
  geometric_series: "Geometric-series summation",
  arithmetic_series: "Arithmetic-series summation",
  factorisation: "Factorisation",
  equation_construction: "Constructing an equation from relationships",
  decomposition: "Decomposing cash flows into simpler parts",
  valuation_dates: "Comparing values at different valuation dates",
  logarithms: "Logarithms",
  numerical_root: "Numerical root finding",
};

/**
 * Where in a formula chain a mistake happens:
 *   selection      — the wrong formula or model was chosen for a step;
 *   application    — the right formula was applied with the wrong inputs, timing or rate;
 *   connection     — a correct result was carried into the next step wrongly;
 *   interpretation — the chain was right but the resulting value was misread.
 */
export type ChainErrorKind = "selection" | "application" | "connection" | "interpretation";

export const CHAIN_ERROR_LABELS: Record<ChainErrorKind, string> = {
  selection: "Selecting the right formula",
  application: "Applying the formula correctly",
  connection: "Connecting one formula to the next",
  interpretation: "Interpreting the resulting value",
};

export interface ChainStep {
  /** Formula id in lib/formulas/registry.ts. */
  formula: string;
  /** Why this formula is needed at this point. */
  purpose: string;
  output: { symbol: string; value: number; meaning: string };
  /** Symbols this step consumes: givens or earlier outputs. */
  inputs: string[];
  valuationDate?: string;
  /** The formula is used solved for a different quantity than usual. */
  rearranged?: boolean;
  /** The relationship must be derived rather than recalled. */
  derived?: boolean;
}

export interface TrapStage {
  stage: number;
  kind?: ChainErrorKind;
  /** The formula wrongly selected at that stage, when the mistake is a formula substitution. */
  wrongFormula?: string;
}

export interface FormulaChain {
  steps: ChainStep[];
  methods: AlgebraMethod[];
  /** How to reach the answer by plain mathematical reasoning, without a memorised shortcut. */
  reasoning: string;
  /** Presentation deliberately unconventional (contributes to integration level 5). */
  unconventional?: boolean;
  /** Where in the chain each distractor's mistake happens. */
  stages: Partial<Record<MisconceptionId, TrapStage>>;
}

/** 1 single formula … 5 unfamiliar multi-concept problem; computed from the chain. */
export type IntegrationLevel = 1 | 2 | 3 | 4 | 5;

export const INTEGRATION_LABELS: Record<IntegrationLevel, string> = {
  1: "Single formula",
  2: "Two-formula combination",
  3: "Multi-formula combination",
  4: "Complex integrated problem",
  5: "Unfamiliar multi-concept challenge",
};

const HEAVY_METHODS: ReadonlySet<AlgebraMethod> = new Set(["substitution", "elimination", "simultaneous", "work_backwards", "equation_construction", "factorisation", "geometric_series"]);

export function integrationLevel(chain: FormulaChain): IntegrationLevel {
  const formulas = new Set(chain.steps.map((s) => s.formula)).size;
  const heavy = chain.methods.some((m) => HEAVY_METHODS.has(m)) || chain.steps.some((s) => s.derived);
  if (chain.unconventional && formulas >= 3 && heavy) return 5;
  if (heavy && formulas >= 2) return 4;
  if (formulas >= 3) return 3;
  if (formulas === 2) return 2;
  return 1;
}

// ---------------------------------------------------------------- item formats

/**
 * The structural form of a question, following the range of item types in the
 * SOA's published Exam FM sample questions (original items, not copies).
 */
export const ITEM_FORMATS = [
  "direct-calculation",
  "inverse-calculation",
  "unknown-rate-term",
  "equation-selection",
  "expression-selection",
  "correct-statement",
  "statement-combination",
  "classification",
  "definition",
  "interpretation",
  "comparative-statics",
  "applicability",
  "table-driven",
  "cash-flow-schedule",
  "ordered-pair",
  "portfolio-allocation",
  "enumerated-conditions",
  "error-diagnosis",
  "timeline-reading",
] as const;
export type ItemFormat = (typeof ITEM_FORMATS)[number];

export const ITEM_FORMAT_LABELS: Record<ItemFormat, string> = {
  "direct-calculation": "Direct calculation",
  "inverse-calculation": "Inverse calculation",
  "unknown-rate-term": "Unknown rate or term",
  "equation-selection": "Equation-of-value selection",
  "expression-selection": "Symbolic-expression selection",
  "correct-statement": "Correct-statement identification",
  "statement-combination": "Statement combination (I / II / III)",
  classification: "Conceptual classification",
  definition: "Definition and terminology",
  interpretation: "Interpretation of a quantity",
  "comparative-statics": "Relationship and comparative statics",
  applicability: "Formula applicability and conditions",
  "table-driven": "Table-driven",
  "cash-flow-schedule": "Cash-flow schedule",
  "ordered-pair": "Ordered pair",
  "portfolio-allocation": "Portfolio allocation",
  "enumerated-conditions": "Enumerated conditions",
  "error-diagnosis": "Proposed-solution error diagnosis",
  "timeline-reading": "Timeline and cash-flow reasoning",
};

/** Calculation practice versus Concept Practice. Concept items are scored into concept mastery, not formula mastery. */
export type PracticeKind = "calculation" | "concept";

// ---------------------------------------------------------------- concept chains

/**
 * Where conceptual reasoning breaks down:
 *   recognition    — the idea or term was not recognised;
 *   interpretation — a quantity or statement was read as something else;
 *   selection      — the wrong model, formula or relationship was chosen;
 *   application    — the right relationship was applied with the wrong timing, rate or condition;
 *   connection     — two correct ideas were linked wrongly;
 *   conclusion     — the reasoning was right but the final judgement was not.
 */
export const CONCEPT_FAILURES = ["recognition", "interpretation", "selection", "application", "connection", "conclusion"] as const;
export type ConceptFailure = (typeof CONCEPT_FAILURES)[number];

export const CONCEPT_FAILURE_LABELS: Record<ConceptFailure, string> = {
  recognition: "Recognising the concept",
  interpretation: "Interpreting the quantity or statement",
  selection: "Selecting the right model or relationship",
  application: "Applying it under the right conditions",
  connection: "Connecting two ideas",
  conclusion: "Drawing the conclusion",
};

/** The ten Concept Practice families. */
export const CONCEPT_FAMILIES = [
  "definition",
  "applicability",
  "equation",
  "relationship",
  "statements",
  "interpretation",
  "error-diagnosis",
  "notation",
  "timeline",
  "cross-topic",
] as const;
export type ConceptFamily = (typeof CONCEPT_FAMILIES)[number];

export const CONCEPT_FAMILY_LABELS: Record<ConceptFamily, string> = {
  definition: "Definition and terminology",
  applicability: "Formula applicability",
  equation: "Equation-of-value construction",
  relationship: "Relationships and comparative statics",
  statements: "Statement analysis",
  interpretation: "Interpretation",
  "error-diagnosis": "Error diagnosis",
  notation: "Notation and mathematical structure",
  timeline: "Cash-flow and timeline reasoning",
  "cross-topic": "Cross-topic concepts",
};

/** The dimensions concept mastery is tracked on (independent of formula mastery). */
export const CONCEPT_DIMENSIONS = [
  "terminology",
  "interpretation",
  "conditions",
  "applicability",
  "equation_construction",
  "timing",
  "rate_conversion",
  "relationships",
  "error_recognition",
  "transfer",
] as const;
export type ConceptDimension = (typeof CONCEPT_DIMENSIONS)[number];

export const CONCEPT_DIMENSION_LABELS: Record<ConceptDimension, string> = {
  terminology: "Terminology recognition",
  interpretation: "Interpretation",
  conditions: "Conditions and assumptions",
  applicability: "Formula applicability",
  equation_construction: "Equation construction",
  timing: "Timing and valuation dates",
  rate_conversion: "Rate-conversion understanding",
  relationships: "Relationship and comparative reasoning",
  error_recognition: "Error recognition",
  transfer: "Transfer to unfamiliar presentations",
};

export interface ConceptStep {
  /** Concept id in lib/concepts. */
  concept: string;
  /** The reasoning at this step, in markup. */
  reasoning: string;
}

/** The conceptual analogue of a formula chain. */
export interface ConceptChain {
  /** Concepts or relationships the question requires (ids in lib/concepts). */
  concepts: string[];
  /** The reasoning sequence, in order. */
  steps: ConceptStep[];
  /** Conditions and assumptions the reasoning relies on. */
  conditions: string[];
  /** The step at which each distractor's reasoning fails, and how. */
  stages: Partial<Record<MisconceptionId, { stage: number; kind: ConceptFailure }>>;
}

// ---------------------------------------------------------------- calibration

export type TimeBand = "under-3" | "3-6" | "6-9" | "over-9";
export const TIME_BAND_LABELS: Record<TimeBand, string> = { "under-3": "under 3 min", "3-6": "3–6 min", "6-9": "6–9 min", "over-9": "over 9 min" };
export type CalculatorBurden = "none" | "light" | "standard" | "heavy";
export type AnswerClass = "numerical" | "conceptual" | "symbolic" | "composite";

/**
 * Structural difficulty record for one question, measured from the item
 * itself (lib/engine/calibration.ts). These are structural classifications
 * against a documented rubric (docs/difficulty-rubric.md), not psychometric
 * estimates: `basis` separates what is counted from what is inferred.
 */
export interface Calibration {
  stemWords: number;
  modelingDecisions: number;
  reasoningSteps: number;
  formulas: number;
  concepts: number;
  inverse: boolean;
  multipleValuationDates: boolean;
  unfamiliar: boolean;
  multiConcept: boolean;
  reconstruction: boolean;
  irrelevantInfo: boolean;
  answerType: AnswerType;
  answerClass: AnswerClass;
  calculatorBurden: CalculatorBurden;
  timeBand: TimeBand;
  rubric: { level: Difficulty; meets: boolean; reasons: string[] };
  basis: { measured: string[]; inferred: string[] };
}

// ---------------------------------------------------------------- templates

export interface DistractorCandidate {
  misconception: MisconceptionId;
  value: number;
  /** Exact arithmetic producing this value from the question's parameters. */
  calc: string;
  /** Markup: the working a candidate making this mistake would write. */
  derivation: string;
  /** One line: the incorrect method in words. */
  method: string;
  /** Why it is wrong and what the correct interpretation is, for this question. */
  feedback: string;
  /** Intermediate values characteristic of this mistake, matched against working. */
  markers?: number[];
}

/** What a numerical template's `generate` returns, before validation and assembly. */
export interface QuestionDraft {
  kind?: "numeric";
  stem: string;
  exhibits?: Exhibit[];
  answer: {
    value: number;
    /** Exact arithmetic producing the answer (closed form). */
    calc: string;
    format: AnswerFormat;
    /** Short statement of what the answer is, for the correct option's metadata. */
    derivation: string;
  };
  /**
   * The equation of value written from first principles — explicit cash flows,
   * not the closed form. Mentions `x` for the unknown when the answer is a root.
   */
  model: { expr: string; bracket?: [number, number]; description: string };
  distractors: DistractorCandidate[];
  explanation: Explanation;
  visuals: VisualSpec[];
  /** Intermediate values of the correct method, matched against working. */
  markers: number[];
  presentation: Presentation[];
  features: QuestionFeatures;
  params: Record<string, number | string | boolean>;
  /** The reference solution plan: formulas in order, how they connect, and the methods used. */
  chain: FormulaChain;
  /** Non-obvious modelling decisions the solution makes (for calibration; default from the presentation). */
  modelingDecisions?: number;
  itemFormat?: ItemFormat;
}

export interface QuestionTemplate {
  kind?: "numeric";
  id: string;
  /** Templates in one family drill related structures; a session avoids repeating a family where it can. */
  family: string;
  topic: TopicId;
  levels: Difficulty[];
  /** Primary learning objective (syllabus outcome id). */
  objective: string;
  /** Secondary syllabus outcomes the question also exercises. */
  secondary: string[];
  reasoning: ReasoningSkill[];
  /** The SOA sample-question archetype this template's concept is built from. */
  soaConcept: string;
  generate(rng: Rng, level: Difficulty): QuestionDraft;
}

/** A claim the validator decides independently: `expr op than`. */
export interface TruthCheck {
  /** Arithmetic in expression-engine syntax. */
  expr: string;
  op: "<" | "<=" | ">" | ">=" | "=" | "!=";
  /** A number or a second expression. */
  than: number | string;
  /** Relative tolerance for "=" and "!=" (default 1e-6). */
  tol?: number;
}

export interface StatementSpec {
  key: StatementKey;
  /** Markup. */
  text: string;
  truth: boolean;
  /** Why the statement is true or false. */
  justification: string;
  /** The misconception that leads a candidate to misjudge this statement. */
  misconception: MisconceptionId;
  /** For a false statement, the condition under which it would be true (and vice versa). */
  conditionTrue?: string;
  /** An independent check of the statement's truth, where the claim is quantitative. */
  check?: TruthCheck;
  stage?: number;
  failure?: ConceptFailure;
  confusedWith?: string;
}

export interface ChoiceCandidate {
  content: OptionContent;
  /** Required on distractors; absent on the correct option. */
  misconception?: MisconceptionId;
  /** Why this option is correct, or why it is wrong for this question. */
  explanation: string;
  /** Distractors: the incorrect reasoning, in words. */
  method?: string;
  /** How a candidate arrives at this option (markup). */
  derivation?: string;
  /** When this option would become correct: the boundary case or changed condition. */
  conditionTrue?: string;
  /** Numeric and composite content: independent arithmetic, one expression per component. */
  calc?: string[];
  /**
   * Math content: a numeric probe. An expression in `x` is an equation whose
   * root is the quantity the option defines; otherwise it is the value it
   * states. Used to recognise equivalent equations and to check that exactly
   * one option agrees with the reference.
   */
  probe?: string;
  /** A claim decided by the validator: it must hold for the correct option and fail for every distractor that carries one. */
  check?: TruthCheck;
  /** Concept id the distractor confuses the correct idea with. */
  confusedWith?: string;
  /** Concept-chain stage and failure type, for distractors. */
  stage?: number;
  failure?: ConceptFailure;
  /** Formula-chain stage, for computational distractors. */
  chainStage?: number;
  chainError?: ChainErrorKind;
  markers?: number[];
}

export interface ChoiceReference {
  /**
   * Independent derivations of the answer: for numeric/composite content one
   * expression per component; for equation selection the quantity the correct
   * equation must define (probes are compared against it).
   */
  values?: { label: string; expr: string; bracket?: [number, number] }[];
  description: string;
}

/** What a choice template's `generate` returns: a question with typed, non-numeric or composite options. */
export interface ChoiceDraft {
  kind: "choice";
  stem: string;
  exhibits?: Exhibit[];
  statements?: StatementSpec[];
  correct: ChoiceCandidate;
  distractors: ChoiceCandidate[];
  /** Keep the authored relative order of options (statement combinations, ordered scales) instead of shuffling. */
  canonicalOrder?: boolean;
  reference: ChoiceReference;
  explanation: Explanation;
  concept?: ConceptChain;
  chain?: FormulaChain;
  /** The applicable formula or relationship, in markup. */
  relationship?: string;
  /** A counterexample or boundary case. */
  counterexample?: string;
  /** Formula ids the question's reasoning rests on (for the review, not for formula mastery). */
  formulas?: string[];
  visuals: VisualSpec[];
  markers: number[];
  presentation: Presentation[];
  features: QuestionFeatures;
  params: Record<string, number | string | boolean>;
  itemFormat: ItemFormat;
  modelingDecisions?: number;
}

export interface ChoiceTemplate {
  kind: "choice";
  id: string;
  family: string;
  topic: TopicId;
  levels: Difficulty[];
  objective: string;
  secondary: string[];
  reasoning: ReasoningSkill[];
  soaConcept: string;
  practice: PracticeKind;
  itemFormat: ItemFormat;
  /** Concept Practice family (required when practice is "concept"). */
  conceptFamily?: ConceptFamily;
  /** Concept-mastery dimensions the question tests. */
  dimensions?: ConceptDimension[];
  /** Number of distinct presentations (wordings and option structures) the template can produce. */
  variants: number;
  generate(rng: Rng, level: Difficulty, variant: number): ChoiceDraft;
}

export type AnyTemplate = QuestionTemplate | ChoiceTemplate;
export const isChoiceTemplate = (t: AnyTemplate): t is ChoiceTemplate => t.kind === "choice";

// ---------------------------------------------------------------- instances

export interface OptionDetail {
  key: OptionKey;
  /** Plain-text form of the option (also its accessible label). */
  display: string;
  /** Numeric value; 0 for non-numeric content. */
  value: number;
  /** Typed content. Absent on questions stored before the rich answer model: read as numeric. */
  content?: OptionContent;
  isCorrect: boolean;
  misconceptionTag: MisconceptionId | "CORRECT";
  category: string;
  errorDescription: string;
  incorrectMethod: string;
  calculationDerivation: string;
  calc: string;
  feedbackExplanation: string;
  targetSkill: string;
  recognitionTip: string;
  markers: number[];
  /** Step of the formula chain where this option's mistake happens (null for the correct option). */
  chainStage: number | null;
  chainError: ChainErrorKind | null;
  wrongFormula: string | null;
  /** When this wrong option would become correct. */
  conditionTrue?: string | null;
  /** Concept-chain step where this option's reasoning fails, and how. */
  conceptStage?: number | null;
  conceptFailure?: ConceptFailure | null;
  /** Concept the option confuses the correct idea with. */
  confusedWith?: string | null;
  /** Typed options: the numeric probe and truth check the validator used (kept for independent re-validation). */
  probe?: string | null;
  check?: TruthCheck | null;
}

export interface ValidationCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ValidationRecord {
  templateId: string;
  level: Difficulty;
  seed: string;
  status: "PASSED" | "REJECTED";
  checks: ValidationCheck[];
  model: string;
  correctValue: number;
  modelValue: number | null;
  options: { key?: OptionKey; misconception: string; value: number; calcValue: number | null; selected: boolean; display?: string }[];
  rejectedCandidates: { misconception: string; reason: string }[];
  validatedAt: string;
}

interface InstanceBase {
  instanceId: string;
  templateId: string;
  family: string;
  topic: TopicId;
  difficulty: Difficulty;
  seed: string;
  stem: string;
  exhibits?: Exhibit[];
  options: OptionDetail[];
  correctKey: OptionKey;
  objective: string;
  secondary: string[];
  reasoning: ReasoningSkill[];
  presentation: Presentation[];
  features: QuestionFeatures;
  explanation: Explanation;
  visuals: VisualSpec[];
  markers: number[];
  soaConcept: string;
  params: Record<string, number | string | boolean>;
  validation: ValidationRecord;
  /** Set when the stem was reworded by the optional language model. */
  reworded?: boolean;
  /** Absent on questions stored before the rich answer model ("numeric"). */
  answerType?: AnswerType;
  itemFormat?: ItemFormat;
  practice?: PracticeKind;
  calibration?: Calibration;
}

/** A numerical question (every question stored before the rich answer model is one). */
export interface NumericInstance extends InstanceBase {
  kind?: "numeric";
  format: AnswerFormat;
  model: QuestionDraft["model"];
  chain: FormulaChain;
  integration: IntegrationLevel;
}

/** A question with typed options: conceptual, symbolic, statement or composite. */
export interface ChoiceInstance extends InstanceBase {
  kind: "choice";
  answerType: AnswerType;
  itemFormat: ItemFormat;
  practice: PracticeKind;
  statements?: StatementSpec[];
  concept?: ConceptChain & { family: ConceptFamily; dimensions: ConceptDimension[]; variant: number };
  chain?: FormulaChain;
  integration?: IntegrationLevel;
  model?: { expr: string; description: string };
  format?: AnswerFormat;
  relationship?: string;
  counterexample?: string;
  formulas?: string[];
  variant: number;
}

/** A fully generated, validated question as stored with a session. */
export type QuestionInstance = NumericInstance | ChoiceInstance;

export const isChoiceInstance = (q: QuestionInstance): q is ChoiceInstance => q.kind === "choice";
export const practiceOf = (q: QuestionInstance): PracticeKind => q.practice ?? "calculation";
export const answerTypeOfInstance = (q: QuestionInstance): AnswerType => q.answerType ?? "numeric";
export const isConceptItem = (q: QuestionInstance): boolean => practiceOf(q) === "concept";

/** The item format of a stored question; old numerical questions are classified from their presentation tags. */
export function itemFormatOf(q: { itemFormat?: ItemFormat; presentation: Presentation[]; exhibits?: Exhibit[] }): ItemFormat {
  if (q.itemFormat) return q.itemFormat;
  return numericItemFormat(q.presentation, q.exhibits);
}

export function numericItemFormat(presentation: readonly Presentation[], exhibits?: readonly Exhibit[]): ItemFormat {
  if (exhibits?.some((e) => e.type === "table")) return "table-driven";
  if (presentation.includes("unknown-rate") || presentation.includes("unknown-time")) return "unknown-rate-term";
  if (presentation.includes("inverse") || presentation.includes("work-backwards") || presentation.includes("rearrange-first")) return "inverse-calculation";
  return "direct-calculation";
}

/** What the candidate sees during an active session — nothing that reveals the answer. */
export interface PublicQuestion {
  instanceId: string;
  stem: string;
  /** Tables and numbered statements shown with the question (statement truth values are never included). */
  exhibits?: Exhibit[];
  /** `content` is present for non-numeric options only; it carries no correctness metadata. */
  options: { key: OptionKey; display: string; content?: OptionContent }[];
  /** Only in formula-supported learning: the formulas relevant to this question, in no particular order. */
  formulas?: string[];
}

export function toPublicQuestion(question: QuestionInstance, opts: { revealFormulas?: boolean } = {}): PublicQuestion {
  const formulas = opts.revealFormulas && question.chain ? [...new Set(question.chain.steps.map((s) => s.formula))].sort() : null;
  return {
    instanceId: question.instanceId,
    stem: question.stem,
    ...(question.exhibits?.length ? { exhibits: question.exhibits.map(publicExhibit) } : {}),
    options: question.options.map(({ key, display, content }) => (content && content.type !== "numeric" ? { key, display, content: publicContent(content) } : { key, display })),
    ...(formulas ? { formulas } : {}),
  };
}

/** Copies only the displayable fields, so nothing added to a content object later can leak. */
function publicContent(content: OptionContent): OptionContent {
  switch (content.type) {
    case "text":
      return { type: "text", text: content.text };
    case "math":
      return { type: "math", latex: content.latex };
    case "statements":
      return { type: "statements", keys: [...content.keys] };
    case "composite":
      return { type: "composite", style: content.style, parts: content.parts.map((p) => ({ label: p.label, value: p.value, format: p.format })) };
    case "table":
      return { type: "table", columns: [...content.columns], rows: content.rows.map((r) => [...r]) };
    case "numeric":
      return { type: "numeric", value: content.value, format: content.format };
  }
}

function publicExhibit(exhibit: Exhibit): Exhibit {
  return exhibit.type === "table"
    ? { type: "table", ...(exhibit.caption ? { caption: exhibit.caption } : {}), columns: [...exhibit.columns], rows: exhibit.rows.map((r) => [...r]) }
    : { type: "statements", items: exhibit.items.map((i) => ({ key: i.key, text: i.text })) };
}
