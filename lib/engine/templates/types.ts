import type { DifficultyLevel, SyllabusTopic } from "../../exam-config";
import type { TopicDomain } from "../../types/exam";
import type { Rng } from "../random";

/**
 * Error models used to build distractors. Every incorrect option is produced by
 * simulating one of these mistakes, so the review report can name the exact
 * misconception a candidate fell for.
 */
export type DistractorType =
  | "CORRECT"
  | "ANNUITY_DUE_CONFUSION"
  | "SIMPLE_INTEREST_ERROR"
  | "OFF_BY_ONE_PERIOD"
  | "NOMINAL_RATE_ERROR"
  | "CALCULATION_DISTRACTOR";

export interface Distractor {
  value: number;
  type: DistractorType;
  /** Written in the same markup dialect as question text; rendered with KaTeX. */
  explanation: string;
}

/** How a numeric answer is rendered into an option label. */
export type AnswerFormat =
  | "CURRENCY"
  | "PERCENT"
  | "BASIS_POINTS"
  | "YEARS"
  | "DECIMAL_4"
  | "DECIMAL_2";

/**
 * A self-verification assertion emitted by a generator.
 *
 * Multi-step templates re-derive their own chain (re-pricing at a solved yield,
 * confirming a matched duration, confirming a swap values to zero at inception)
 * and publish the result here. The engine test suite fails the build if any
 * check comes back false, which is the automated form of the authoring rule
 * that every question be verified numerically before it ships.
 */
export interface ConsistencyCheck {
  label: string;
  ok: boolean;
}

/** Any value that survives a round trip through the `variables` JSON column. */
export type ParameterValue = string | number | boolean | number[] | string[];

export interface GeneratedQuestionItem {
  kind?: "NUMERIC";
  questionText: string;
  variables: Record<string, ParameterValue>;
  correctValue: number;
  distractors: Distractor[];
  format: AnswerFormat;
  solutionSteps: string;
  /** Invariants asserted by the engine test suite. */
  checks?: ConsistencyCheck[];
}

export interface AuthoredChoice {
  text: string;
  isCorrect: boolean;
  type?: DistractorType;
  explanation: string;
}

export interface GeneratedChoiceQuestionItem {
  kind: "CHOICE";
  questionText: string;
  variables: Record<string, ParameterValue>;
  choices: AuthoredChoice[];
  solutionSteps: string;
  checks?: ConsistencyCheck[];
}

export type GeneratedTemplateItem = GeneratedQuestionItem | GeneratedChoiceQuestionItem;

export interface QuestionTemplateDefinition {
  /** Stable identifier; also the primary key of the `QuestionTemplate` row. */
  id: string;
  /** Primary domain, used for the report's per-domain breakdown. */
  domain: TopicDomain;
  title: string;
  /** The syllabus skill this item assesses, surfaced in the review report. */
  objective: string;
  difficulty: DifficultyLevel;
  /** Syllabus areas combined; level 3+ items must list at least two. */
  topics: SyllabusTopic[];
  /** Number of interdependent sub-problems the candidate must chain. */
  steps: number;
  /** Draws a fresh parameter set and returns a fully rendered question. */
  generate: (rng: Rng) => GeneratedTemplateItem;
}

/** Convenience constructor keeping distractor literals readable. */
export function distractor(
  value: number,
  type: DistractorType,
  explanation: string
): Distractor {
  return { value, type, explanation };
}
