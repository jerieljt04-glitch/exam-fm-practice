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
 * Current SOA topic ranges translated to whole-question bounds for a
 * 30-question sitting. The assembler randomizes inside these bounds while
 * always producing exactly 30 questions.
 */
export const DOMAIN_QUESTION_RANGES: Record<TopicDomain, { min: number; max: number }> = {
  TIME_VALUE_OF_MONEY: { min: 2, max: 4 },
  ANNUITIES: { min: 6, max: 9 },
  LOANS: { min: 5, max: 7 },
  BONDS: { min: 5, max: 7 },
  ALM_IMMUNIZATION: { min: 6, max: 9 },
};

/**
 * Most of the exam is computational. Qualitative "determine which statement is
 * true" items are worth a few marks, not half the paper, so a sitting draws at
 * most this many of them; every other question requires a calculation.
 */
export const MAX_CONCEPTUAL_QUESTIONS = 5;

/** Kept for compact custom-practice defaults and backwards-compatible tests. */
export const QUESTIONS_PER_DOMAIN = EXAM_TOTAL_QUESTIONS / DOMAIN_ORDER.length;

export const DOMAIN_LABELS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY: "Time Value of Money",
  ANNUITIES: "Annuities & Cash Flows",
  LOANS: "Loans & Amortization",
  BONDS: "Bonds",
  ALM_IMMUNIZATION: "Asset-Liability Management",
};

export const DOMAIN_DESCRIPTIONS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY:
    "Interest and discount rates, force of interest, rate equivalence and equations of value.",
  ANNUITIES:
    "Level, deferred, increasing, continuous and perpetual payment streams.",
  LOANS: "Amortization schedules, outstanding balances, payment components and sinking funds.",
  BONDS: "Pricing, book value, premium and discount amortization, yield rates and callable bonds.",
  ALM_IMMUNIZATION:
    "Duration, convexity, price sensitivity, Redington and full immunization.",
};

/**
 * Difficulty taxonomy.
 *
 * 1 — Basic: a direct one- or two-step evaluation. Excluded from generated
 *     exams by default; available only when explicitly requested.
 * 2 — Intermediate: two cash flow streams equated across one structural change.
 * 3 — Advanced: a chain of at least three interdependent sub-problems spanning
 *     two or more syllabus areas.
 * 4 — Elite synthesis: multi-period state tracking, refinancing, swaps or
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

/** Difficulties drawn by a standard sitting. Level 1 is opt-in only. */
export const DEFAULT_DIFFICULTIES: readonly DifficultyLevel[] = [1, 2, 3, 4] as const;

/** Every sitting draws at least this many level 3+ items from each domain. */
export const MIN_ADVANCED_PER_DOMAIN = 2;

/** Topics retained for extra study but excluded from current-syllabus exams. */
export const LEGACY_TOPICS: readonly SyllabusTopic[] = ["SWAPS", "RATE_DETERMINANTS"] as const;

export function isCurrentSyllabusTemplate(topics: readonly SyllabusTopic[]): boolean {
  return !topics.some((topic) => LEGACY_TOPICS.includes(topic));
}

/**
 * Syllabus areas a question can draw on. A level 3+ item must combine at
 * least two of them.
 */
export type SyllabusTopic =
  | "TIME_VALUE"
  | "LOAN_MECHANICS"
  | "BONDS_AND_CURVES"
  | "IMMUNIZATION"
  | "SWAPS"
  | "RATE_DETERMINANTS";

export const TOPIC_LABELS: Record<SyllabusTopic, string> = {
  TIME_VALUE: "Time value & varying annuities",
  LOAN_MECHANICS: "Loans, sinking funds & refinancing",
  BONDS_AND_CURVES: "Bonds, spot & forward rates",
  IMMUNIZATION: "Duration, convexity & immunization",
  SWAPS: "Interest rate swaps",
  RATE_DETERMINANTS: "Determinants of interest rates",
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
