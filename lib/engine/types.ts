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
  | { kind: "number"; decimals: number; unit?: string };

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

/** What a template's `generate` returns, before validation and assembly. */
export interface QuestionDraft {
  stem: string;
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
}

export interface QuestionTemplate {
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

// ---------------------------------------------------------------- instances

export interface OptionDetail {
  key: OptionKey;
  display: string;
  value: number;
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
  options: { key?: OptionKey; misconception: string; value: number; calcValue: number | null; selected: boolean }[];
  rejectedCandidates: { misconception: string; reason: string }[];
  validatedAt: string;
}

/** A fully generated, validated question as stored with a session. */
export interface QuestionInstance {
  instanceId: string;
  templateId: string;
  family: string;
  topic: TopicId;
  difficulty: Difficulty;
  seed: string;
  stem: string;
  options: OptionDetail[];
  correctKey: OptionKey;
  format: AnswerFormat;
  objective: string;
  secondary: string[];
  reasoning: ReasoningSkill[];
  presentation: Presentation[];
  features: QuestionFeatures;
  explanation: Explanation;
  visuals: VisualSpec[];
  markers: number[];
  model: QuestionDraft["model"];
  chain: FormulaChain;
  integration: IntegrationLevel;
  soaConcept: string;
  params: QuestionDraft["params"];
  validation: ValidationRecord;
  /** Set when the stem was reworded by the optional language model. */
  reworded?: boolean;
}

/** What the candidate sees during an active session — nothing that reveals the answer. */
export interface PublicQuestion {
  instanceId: string;
  stem: string;
  options: { key: OptionKey; display: string }[];
  /** Only in formula-supported learning: the formulas relevant to this question, in no particular order. */
  formulas?: string[];
}

export function toPublicQuestion(question: QuestionInstance, opts: { revealFormulas?: boolean } = {}): PublicQuestion {
  return {
    instanceId: question.instanceId,
    stem: question.stem,
    options: question.options.map(({ key, display }) => ({ key, display })),
    ...(opts.revealFormulas ? { formulas: [...new Set(question.chain.steps.map((s) => s.formula))].sort() } : {}),
  };
}
