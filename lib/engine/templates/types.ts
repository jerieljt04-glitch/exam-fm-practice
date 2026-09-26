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

/**
 * How a numeric answer is printed as an option, in the SOA sample set's style.
 *
 * `AMOUNT_d`  — a plain number to d decimals, with grouping commas only from
 *               10,000 upward: `4695`, `20,689`, `32.60`, `0.0396`.
 * `PERCENT_d` — a percentage to d decimals. The correct value and every
 *               distractor are supplied in percent units (9.46 prints `9.46%`).
 */
export type AnswerFormat =
  | "AMOUNT_0"
  | "AMOUNT_1"
  | "AMOUNT_2"
  | "AMOUNT_3"
  | "AMOUNT_4"
  | "PERCENT_0"
  | "PERCENT_1"
  | "PERCENT_2"
  | "PERCENT_3";

/**
 * How the four wrong options of a numeric item are chosen.
 *
 * `LADDER`   — evenly spaced values around the key, the way many sample-set
 *              items are written (4.33%, 4.43%, 4.53%, 4.63%, 4.73%).
 * `MODELLED` — the template's simulated mistakes, topped up with ladder rungs.
 * `MIXED`    — either, decided per draw (the default).
 */
export type OptionStyle = "LADDER" | "MODELLED" | "MIXED";

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
  /** Defaults to `MIXED`. */
  optionStyle?: OptionStyle;
  /**
   * Spacing of a ladder in printed units — 1 for a count of payments, 0.25 for
   * a percentage quoted to two places. Chosen from the answer's size if omitted.
   */
  ladderStep?: number;
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
  /**
   * Print the choices in the authored order instead of shuffling them. The
   * sample set lists "I only, II only, III only, ..." in a fixed order, and
   * lists paired amounts and dates in ascending order.
   */
  fixedOrder?: boolean;
  solutionSteps: string;
  checks?: ConsistencyCheck[];
}

export type GeneratedTemplateItem = GeneratedQuestionItem | GeneratedChoiceQuestionItem;

export interface QuestionTemplateDefinition {
  /** Stable identifier; also the primary key of the `QuestionTemplate` row. */
  id: string;
  /** Primary domain, used for the report's per-domain breakdown. */
  domain: TopicDomain;
  /** Assessed domains for strict practice filtering; shared TVM prerequisites are implicit. */
  practiceDomains?: readonly TopicDomain[];
  title: string;
  /** The syllabus skill this item assesses, surfaced in the review report. */
  objective: string;
  difficulty: DifficultyLevel;
  /** Syllabus areas combined; level 3+ items must list at least two. */
  topics: SyllabusTopic[];
  /** Number of interdependent sub-problems the candidate must chain. */
  steps: number;
  /**
   * Identifies the *method* an item drills — the derivation shape a candidate
   * would recognise, independent of the numbers drawn.
   *
   * Two templates that share a fingerprint ask the candidate to perform the
   * same algebraic manoeuvre on different figures, which reads as repetition
   * inside a single sitting even though the wording and the answer differ. The
   * generator refuses to place two items with the same fingerprint in one
   * exam, so a test cannot be assembled from variations on one idea.
   *
   * When omitted the template's id is used, which is already unique, so a
   * template only needs to declare this when several ids drill one manoeuvre.
   */
  methodFingerprint?: string;
  /**
   * A qualitative item — true/false statements, choosing an equation of value,
   * naming a term — rather than a calculation. A mock sitting caps how many of
   * these it draws.
   */
  qualitative?: boolean;
  /**
   * Numbers of the questions in the SOA's Exam FM sample set (August 2026
   * revision) that this template's question type is modelled on. The questions
   * themselves are copyrighted and are not reproduced; the template writes its
   * own stem and draws its own figures.
   */
  soaSamples?: readonly number[];
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
