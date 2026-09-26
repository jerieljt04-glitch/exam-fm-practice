import type { TopicDomain } from "./types/exam";

/**
 * Single source of truth for the exam blueprint.
 *
 * The SOA Exam FM computer-based test is 30 multiple-choice questions with
 * five options each, sat over 150 minutes. Every layer — generator, repository,
 * timer hook and UI — reads these constants rather than repeating literals.
 */

/** Exactly 30 multiple-choice questions per mock exam. */
export const EXAM_TOTAL_QUESTIONS = 30;

/** 150 minutes = 2.5 hours = 9000 seconds. */
export const EXAM_DURATION_MINUTES = 150;
export const EXAM_DURATION_SECONDS = EXAM_DURATION_MINUTES * 60;

/** Five options per question. */
export const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** Passing benchmark used by this platform's diagnostics: 70% (21 of 30). */
export const PASS_RATIO = 0.7;
export const PASS_MARK = Math.ceil(EXAM_TOTAL_QUESTIONS * PASS_RATIO);

/** The five syllabus domains, in blueprint order. */
export const DOMAIN_ORDER: readonly TopicDomain[] = [
  "TIME_VALUE_OF_MONEY",
  "ANNUITIES",
  "LOANS",
  "BONDS",
  "ALM_IMMUNIZATION",
] as const;

/**
 * Published topic weights, as percentages, from the current SOA Exam FM
 * syllabus. These are the *bands*, and they are what the whole-question ranges
 * below have to respect.
 *
 * The syllabus states that the weights apply to the large majority of exams
 * but that an individual sitting may fall outside them on occasion; this
 * platform nevertheless holds every generated form inside the bands.
 */
export const DOMAIN_WEIGHT_BANDS: Record<TopicDomain, { min: number; max: number }> = {
  TIME_VALUE_OF_MONEY: { min: 0.05, max: 0.15 },
  ANNUITIES: { min: 0.2, max: 0.3 },
  LOANS: { min: 0.15, max: 0.25 },
  BONDS: { min: 0.15, max: 0.25 },
  ALM_IMMUNIZATION: { min: 0.2, max: 0.3 },
};

/**
 * The whole-question counts a 30-question sitting may use, derived from the
 * bands above rather than hard-coded.
 *
 * A form is 30 questions, so a topic's count has to be a whole number inside
 * its band. The smallest in-band count for each topic sums to 26, and the
 * largest sums to 36, so the legal splits are the ones that add to exactly 30.
 *
 * The count drawn for a sitting is chosen to land as close as possible to each
 * band's midpoint, which is what makes a generated form resemble the published
 * blueprint rather than merely sitting inside it.
 */
export const DOMAIN_QUESTION_RANGES: Record<TopicDomain, { min: number; max: number }> = {
  TIME_VALUE_OF_MONEY: { min: 2, max: 4 },
  ANNUITIES: { min: 6, max: 9 },
  LOANS: { min: 5, max: 7 },
  BONDS: { min: 5, max: 7 },
  ALM_IMMUNIZATION: { min: 6, max: 9 },
};

/**
 * Preferred topic split for a standard 30-question sitting: each topic's share
 * of the published band midpoint, rounded to whole questions so the five counts
 * total exactly 30.
 *
 * Midpoints are 10% / 25% / 20% / 20% / 25%, which in questions is
 * 3 / 7.5 / 6 / 6 / 7.5. Rounding the halves up gives 3 / 8 / 6 / 6 / 8 = 31,
 * so one of the two 8s moves down to 7: the split below, at
 * 10.0% / 26.7% / 20.0% / 20.0% / 23.3%, sits inside every band and misses no
 * midpoint by more than one question's worth of share.
 *
 * This is the split the generator aims at; the ranges above still bound what a
 * sitting may produce.
 */
export const PREFERRED_DOMAIN_COUNTS: Record<TopicDomain, number> = {
  TIME_VALUE_OF_MONEY: 3,
  ANNUITIES: 8,
  LOANS: 6,
  BONDS: 6,
  ALM_IMMUNIZATION: 7,
};

/**
 * App-defined ceiling for qualitative questions, not an official SOA quota.
 * The remaining questions require calculations.
 */
export const MAX_CONCEPTUAL_QUESTIONS = 5;

/**
 * Qualitative items in a 30-question mock. The SOA sample questions include a
 * small number of "Determine which of the following is true" items, so a mock
 * carries a couple rather than none; every other question is computational.
 */
export const EXAM_CONCEPTUAL_QUESTIONS = 2;

/**
 * Level 3+ items each domain contributes to a mock sitting.
 *
 * An app-defined mix, not a published SOA statistic: the SOA does not release a
 * difficulty breakdown. The point is that a sitting must not run at a single
 * difficulty. These counts put roughly half the paper in multi-stage synthesis
 * work and leave the rest as direct and intermediate evaluations, which is
 * closer to a real form than an all-advanced paper.
 *
 * Time value of money asks for one: on the real exam that topic is mostly short
 * rate conversion and equation-of-value work, with the occasional multi-stage
 * force-of-interest or equivalent-rate problem.
 */
export const EXAM_ADVANCED_COUNTS: Record<TopicDomain, number> = {
  TIME_VALUE_OF_MONEY: 1,
  ANNUITIES: 4,
  LOANS: 3,
  BONDS: 3,
  ALM_IMMUNIZATION: 4,
};

/** Kept for compact custom-practice defaults and backwards-compatible tests. */
export const QUESTIONS_PER_DOMAIN = EXAM_TOTAL_QUESTIONS / DOMAIN_ORDER.length;

export const DOMAIN_LABELS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY: "Time Value of Money",
  ANNUITIES: "Annuities & Cash Flows",
  LOANS: "Loans & Amortization",
  BONDS: "Bonds",
  ALM_IMMUNIZATION: "General Cash Flows, Portfolios & ALM",
};

export const DOMAIN_DESCRIPTIONS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY:
    "Interest and discount rates, force of interest, rate equivalence and equations of value.",
  ANNUITIES:
    "Level, deferred, increasing, continuous and perpetual payment streams.",
  LOANS: "Amortization schedules, outstanding balances, payment components and refinancing.",
  BONDS: "Pricing, book value, premium and discount amortization, yield rates and callable bonds.",
  ALM_IMMUNIZATION:
    "Yield curves, spot and forward rates, rates of return, duration, convexity, cash-flow matching and immunization.",
};

/**
 * Difficulty taxonomy.
 *
 * These are internal study labels, not official SOA difficulty ratings.
 * 1 — Basic: a direct evaluation or conceptual recognition item.
 * 2 — Intermediate: two cash flow streams equated across one structural change.
 * 3 — Advanced: a chain of at least three interdependent sub-problems.
 * 4 — Elite synthesis: multi-period state tracking, refinancing or
 *     portfolio-level immunization.
 */
export type DifficultyLevel = 1 | 2 | 3 | 4;

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: "Basic",
  2: "Intermediate",
  3: "Advanced",
  4: "Elite synthesis",
};

/** Level 3 and above must chain at least this many sub-problems. */
export const MIN_ADVANCED_STEPS = 3;

/** All difficulty levels available through custom Practice Mode. */
export const DEFAULT_DIFFICULTIES: readonly DifficultyLevel[] = [1, 2, 3, 4] as const;

/**
 * Mixed-difficulty practice approximation, not a published SOA difficulty mix.
 * Include direct calculations, conceptual recognition and multi-step problems.
 */
export const EXAM_DIFFICULTIES: readonly DifficultyLevel[] = [1, 2, 3, 4] as const;

/** Every sitting draws at least this many level 3+ items from each domain. */
export const MIN_ADVANCED_PER_DOMAIN = 2;

/**
 * Syllabus areas a question can draw on. A question is tagged with the areas it
 * actually assesses; shared discounting algebra is a prerequisite, not a tag.
 */
export type SyllabusTopic =
  | "TIME_VALUE"
  | "LOAN_MECHANICS"
  | "BONDS_AND_CURVES"
  | "IMMUNIZATION"
  | "GENERAL_CASH_FLOWS";

export const TOPIC_LABELS: Record<SyllabusTopic, string> = {
  TIME_VALUE: "Time value & varying annuities",
  LOAN_MECHANICS: "Loans & refinancing",
  BONDS_AND_CURVES: "Bonds, spot & forward rates",
  IMMUNIZATION: "Duration, convexity & immunization",
  GENERAL_CASH_FLOWS: "General cash flows, portfolios & ALM",
};

/** Proficiency bands applied to each domain in the review report. */
export function proficiencyStatus(
  percentage: number
): "MASTERED" | "ADEQUATE" | "NEEDS_IMPROVEMENT" | "CRITICAL" {
  if (percentage < 50) return "CRITICAL";
  if (percentage < 70) return "NEEDS_IMPROVEMENT";
  if (percentage < 85) return "ADEQUATE";
  return "MASTERED";
}
