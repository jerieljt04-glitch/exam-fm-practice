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
export type AnswerFormat = "CURRENCY" | "PERCENT" | "YEARS" | "DECIMAL_4" | "DECIMAL_2";

export interface GeneratedQuestionItem {
  questionText: string;
  variables: Record<string, string | number | boolean>;
  correctValue: number;
  distractors: Distractor[];
  format: AnswerFormat;
  solutionSteps: string;
}

export interface QuestionTemplateDefinition {
  /** Stable identifier; also the primary key of the `QuestionTemplate` row. */
  id: string;
  domain: TopicDomain;
  title: string;
  /** The syllabus skill this item assesses, surfaced in the review report. */
  objective: string;
  /** Draws a fresh parameter set and returns a fully rendered question. */
  generate: (rng: Rng) => GeneratedQuestionItem;
}

/** Convenience constructor keeping distractor literals readable. */
export function distractor(
  value: number,
  type: DistractorType,
  explanation: string
): Distractor {
  return { value, type, explanation };
}
