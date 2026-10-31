import { getMisconception } from "../engine/misconceptions";
import { REASONING_LABELS, REASONING_SKILLS, isConfident, isUnsure, type ReasoningSkill } from "../engine/skills";
import { classifyAttempt, type AttemptEvidence, type AttemptRecord } from "./attempts";

export interface SkillScore {
  skill: ReasoningSkill;
  label: string;
  /** Weighted number of observations (an unanswered question counts half). */
  observations: number;
  score: number | null;
  correct: number;
  incorrect: number;
  /** Errors attributed to this skill because the chosen option matched a mistake linked to it (inferred). */
  attributedErrors: number;
  status: "INSUFFICIENT" | "STRONG" | "ADEQUATE" | "WEAK";
  observedText: string;
  inferredText: string;
}

const CREDIT = { SOUND: 1, UNVERIFIED: 0.75, POSSIBLE_GUESS: 0.4, SUSPECT_METHOD: 0.5 } as const;

const DERIVED: ReadonlySet<ReasoningSkill> = new Set<ReasoningSkill>(["validation", "transfer", "multistep"]);

/**
 * Scores the fourteen reasoning dimensions from a set of attempts.
 *
 * A correct answer credits every skill the question exercises, scaled by how
 * well the reasoning is evidenced. A wrong answer counts against only the
 * skills linked to the specific mistake its option represents — a timing slip
 * is not evidence about algebra. Validation, transfer and multi-step reasoning
 * are scored from confidence calibration, unfamiliar presentations and
 * question length respectively.
 */
export function skillProfile(attempts: readonly AttemptRecord[], evidence?: readonly AttemptEvidence[]): SkillScore[] {
  const acc = new Map<ReasoningSkill, { obs: number; credit: number; correct: number; incorrect: number; attributed: number }>();
  const bump = (skill: ReasoningSkill, obs: number, credit: number, outcome?: "correct" | "incorrect", attributed = false) => {
    const entry = acc.get(skill) ?? { obs: 0, credit: 0, correct: 0, incorrect: 0, attributed: 0 };
    entry.obs += obs;
    entry.credit += credit;
    if (outcome === "correct") entry.correct += 1;
    if (outcome === "incorrect") entry.incorrect += 1;
    if (attributed) entry.attributed += 1;
    acc.set(skill, entry);
  };

  attempts.forEach((attempt, index) => {
    const e = evidence?.[index] ?? classifyAttempt(attempt);
    const skills = attempt.instance.reasoning.filter((s) => !DERIVED.has(s));
    const factor = e.correct ? CREDIT[e.quality as keyof typeof CREDIT] ?? 1 : 0;

    if (!e.answered) {
      skills.forEach((s) => bump(s, 0.5, 0, "incorrect"));
    } else if (e.correct) {
      skills.forEach((s) => bump(s, 1, factor, "correct"));
    } else {
      const misconception = e.selectedMisconception ? getMisconception(e.selectedMisconception) : undefined;
      const blamed: ReasoningSkill[] =
        e.cause === "METHOD_RIGHT_EXECUTION_WRONG" ? ["arithmetic"] : (misconception?.skills ?? skills).filter((s) => !DERIVED.has(s));
      blamed.forEach((s) => bump(s, 1, 0, "incorrect", true));
    }

    // Validation: does confidence track correctness?
    if (e.answered && attempt.confidence) {
      if (isConfident(attempt.confidence)) bump("validation", 1, e.correct ? 1 : 0, e.correct ? "correct" : "incorrect", !e.correct);
      else if (isUnsure(attempt.confidence)) bump("validation", 1, e.correct ? 0.5 : 1, e.correct ? "incorrect" : "correct");
    }
    // Transfer: unfamiliar presentations and above-standard levels.
    if (attempt.instance.features.unfamiliar || attempt.instance.difficulty >= 2) {
      bump("transfer", e.answered ? 1 : 0.5, factor, e.correct ? "correct" : "incorrect");
    }
    // Multi-step reasoning.
    if (attempt.instance.features.steps >= 3) {
      bump("multistep", e.answered ? 1 : 0.5, factor, e.correct ? "correct" : "incorrect");
    }
  });

  return REASONING_SKILLS.map((skill) => {
    const entry = acc.get(skill) ?? { obs: 0, credit: 0, correct: 0, incorrect: 0, attributed: 0 };
    const score = entry.obs > 0 ? entry.credit / entry.obs : null;
    const status: SkillScore["status"] =
      entry.obs < 2 || score === null ? "INSUFFICIENT" : score >= 0.75 ? "STRONG" : score >= 0.5 ? "ADEQUATE" : "WEAK";
    return {
      skill,
      label: REASONING_LABELS[skill],
      observations: entry.obs,
      score,
      correct: entry.correct,
      incorrect: entry.incorrect,
      attributedErrors: entry.attributed,
      status,
      observedText:
        entry.obs === 0
          ? "Not yet exercised."
          : skill === "validation"
            ? `${entry.correct} of ${entry.correct + entry.incorrect} confidence ratings matched the outcome.`
            : `${entry.correct} correct, ${entry.incorrect} incorrect or unanswered, on questions exercising this skill.`,
      inferredText:
        entry.attributed > 0
          ? `${entry.attributed} error${entry.attributed === 1 ? "" : "s"} attributed here because the option chosen matched a mistake linked to this skill.`
          : entry.obs > 0
            ? "No errors attributed to this skill."
            : "",
    };
  });
}
