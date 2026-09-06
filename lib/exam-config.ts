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

/** Questions drawn from each domain: 30 / 5 = 6. */
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

/** Proficiency bands applied to each domain in the review report. */
export function proficiencyStatus(
  percentage: number
): "MASTERED" | "ADEQUATE" | "NEEDS_IMPROVEMENT" | "CRITICAL" {
  if (percentage < 50) return "CRITICAL";
  if (percentage < 70) return "NEEDS_IMPROVEMENT";
  if (percentage < 85) return "ADEQUATE";
  return "MASTERED";
}
