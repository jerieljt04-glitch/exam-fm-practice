import type { ReasoningSkill } from "./skills";

/**
 * Shared types and the constructor for the misconception catalogue
 * (lib/engine/misconceptions.ts and lib/engine/misconceptions-extra/).
 *
 * The catalogue lists the mistakes distractors are built from.
 *
 * Every wrong option names one of these. The category is one of the eleven
 * required misconception categories; the specific id is what remediation
 * targets, so a question built on one template can be followed by a question
 * from a different template that sets the same trap.
 */

export const MISCONCEPTION_CATEGORIES = {
  INCORRECT_FORMULA: "Incorrect formula",
  INCORRECT_MODEL: "Incorrect financial model",
  TIMING: "Cash-flow timing",
  VARIABLE_INTERPRETATION: "Incorrect variable interpretation",
  ALLOCATION: "Incorrect allocation",
  TRANSLATION: "Incorrect mathematical translation",
  ALGEBRA: "Algebraic mistake",
  ARITHMETIC: "Arithmetic mistake",
  SEQUENCE_SERIES: "Sequence or series mistake",
  RATE_CONVERSION: "Unit or rate-conversion mistake",
  CONCEPTUAL: "Conceptual misconception",
} as const;

export type MisconceptionCategory = keyof typeof MISCONCEPTION_CATEGORIES;

export interface Misconception {
  category: MisconceptionCategory;
  label: string;
  description: string;
  skills: ReasoningSkill[];
  /** How to spot this trap in a future question. */
  recognition: string;
  /** The correct relationship, stated generally. */
  principle: string;
}

export const entry = (
  category: MisconceptionCategory,
  label: string,
  description: string,
  skills: ReasoningSkill[],
  recognition: string,
  principle: string
): Misconception => ({ category, label, description, skills, recognition, principle });

