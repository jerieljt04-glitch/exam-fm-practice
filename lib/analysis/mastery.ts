import { OUTCOMES, TOPIC_LABELS, type TopicId } from "../syllabus";
import { isUnsure } from "../engine/skills";
import { INITIAL_HYPOTHESES, type Hypothesis } from "../profile";
import { classifyAttempt, categoryOf, type AttemptRecord } from "./attempts";
import { skillProfile } from "./skills";

export type MasteryStatus = "NOT_TESTED" | "WEAK" | "DEVELOPING" | "SECURE" | "MASTERED";

export const MASTERY_LABELS: Record<MasteryStatus, string> = {
  NOT_TESTED: "Not yet tested",
  WEAK: "Weak",
  DEVELOPING: "Developing",
  SECURE: "Secure",
  MASTERED: "Mastered",
};

export interface MasteryEntry {
  objective: string;
  label: string;
  topic: TopicId;
  topicLabel: string;
  attempts: number;
  correct: number;
  /** Distinct templates (presentations) answered correctly with at least medium confidence. */
  distinctCorrect: number;
  standard: { attempts: number; correct: number };
  challenge: { attempts: number; correct: number };
  status: MasteryStatus;
  reason: string;
  lastAttemptAt: string | null;
}

/** Hours between two secure correct answers before an objective can count as mastered. */
export const RETEST_DELAY_HOURS = 20;

/**
 * Mastery of a learning objective. A single correct answer never masters
 * anything: mastery needs three secure correct answers on three different
 * presentations, spread over at least two sittings separated in time, with the
 * three most recent attempts all correct.
 */
export function masteryStatus(attempts: readonly AttemptRecord[]): { status: MasteryStatus; reason: string } {
  if (!attempts.length) return { status: "NOT_TESTED", reason: "No attempts yet." };
  const sorted = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.position - b.position);
  const secure = sorted.filter((a) => a.isCorrect && !isUnsure(a.confidence) && a.confidence !== null);
  const templates = new Set(secure.map((a) => a.instance.templateId));
  const correct = sorted.filter((a) => a.isCorrect).length;
  const accuracy = correct / sorted.length;
  const recent = sorted.slice(-3);
  const recentAllCorrect = recent.length === 3 && recent.every((a) => a.isCorrect);
  const span =
    secure.length >= 2 ? (Date.parse(secure[secure.length - 1].submittedAt) - Date.parse(secure[0].submittedAt)) / 3_600_000 : 0;

  if (secure.length >= 3 && templates.size >= 3 && recentAllCorrect && span >= RETEST_DELAY_HOURS) {
    return { status: "MASTERED", reason: `${secure.length} secure correct answers on ${templates.size} presentations, over ${Math.round(span)} hours.` };
  }
  if (sorted.length >= 2 && accuracy < 0.5) {
    return { status: "WEAK", reason: `${correct} of ${sorted.length} correct.` };
  }
  const last4 = sorted.slice(-4);
  const recentAccuracy = last4.filter((a) => a.isCorrect).length / last4.length;
  if (secure.length >= 2 && templates.size >= 2 && recentAccuracy >= 0.75) {
    const missing = [
      templates.size < 3 ? "a third presentation" : null,
      span < RETEST_DELAY_HOURS ? "a retest on a later day" : null,
      !recentAllCorrect ? "three correct in a row" : null,
    ].filter(Boolean);
    return { status: "SECURE", reason: `Needs ${missing.join(" and ") || "one more secure attempt"} to count as mastered.` };
  }
  return { status: "DEVELOPING", reason: `${correct} of ${sorted.length} correct; ${templates.size} presentation${templates.size === 1 ? "" : "s"} answered securely.` };
}

export function masteryByObjective(history: readonly AttemptRecord[]): MasteryEntry[] {
  return Object.values(OUTCOMES).map((outcome) => {
    const attempts = history.filter((a) => a.instance.objective === outcome.id);
    const { status, reason } = masteryStatus(attempts);
    const standard = attempts.filter((a) => a.instance.difficulty === 1);
    const challenge = attempts.filter((a) => a.instance.difficulty === 3);
    return {
      objective: outcome.id,
      label: outcome.label,
      topic: outcome.topic,
      topicLabel: TOPIC_LABELS[outcome.topic],
      attempts: attempts.length,
      correct: attempts.filter((a) => a.isCorrect).length,
      distinctCorrect: new Set(attempts.filter((a) => a.isCorrect && !isUnsure(a.confidence)).map((a) => a.instance.templateId)).size,
      standard: { attempts: standard.length, correct: standard.filter((a) => a.isCorrect).length },
      challenge: { attempts: challenge.length, correct: challenge.filter((a) => a.isCorrect).length },
      status,
      reason,
      lastAttemptAt: attempts.length ? attempts.map((a) => a.submittedAt).sort().slice(-1)[0] : null,
    };
  });
}

// ---------------------------------------------------------------- hypotheses

export type HypothesisStatus = "UNTESTED" | "SUPPORTED" | "NOT_SUPPORTED" | "MIXED";

export interface HypothesisEvidence {
  hypothesis: Hypothesis;
  status: HypothesisStatus;
  observations: number;
  correct: number;
  mistakeHits: number;
  summary: string;
}

/**
 * Tests each hypothesis from the initial profile against actual performance.
 * Weakness hypotheses are supported by low accuracy on the linked skills or by
 * repeatedly choosing the linked mistakes; strength hypotheses by high
 * accuracy with few linked mistakes.
 */
export function evaluateHypotheses(history: readonly AttemptRecord[]): HypothesisEvidence[] {
  const profile = skillProfile(history);
  return INITIAL_HYPOTHESES.map((hypothesis) => {
    // A question is evidence if it exercises a linked skill, or if the option chosen is a linked mistake.
    const hits = (a: AttemptRecord) => {
      const e = classifyAttempt(a);
      if (!e.selectedMisconception) return false;
      const category = categoryOf(e.selectedMisconception);
      return Boolean(
        hypothesis.misconceptions?.includes(e.selectedMisconception as never) ||
          (category !== null && hypothesis.categories?.includes(category))
      );
    };
    const relevant = history.filter((a) => a.instance.reasoning.some((s) => hypothesis.skills.includes(s)) || hits(a));
    const correct = relevant.filter((a) => a.isCorrect).length;
    const mistakeHits = relevant.filter(hits).length;
    const skillScores = profile.filter((p) => hypothesis.skills.includes(p.skill) && p.score !== null);
    const observations = relevant.length;
    const accuracy = observations ? correct / observations : 0;
    const meanSkill = skillScores.length ? skillScores.reduce((a, p) => a + (p.score ?? 0), 0) / skillScores.length : null;

    let status: HypothesisStatus;
    if (observations < 3) status = "UNTESTED";
    else if (hypothesis.kind === "weakness") {
      if (mistakeHits >= 2 || accuracy < 0.55 || (meanSkill !== null && meanSkill < 0.5)) status = "SUPPORTED";
      else if (observations >= 5 && accuracy >= 0.8 && mistakeHits === 0) status = "NOT_SUPPORTED";
      else status = "MIXED";
    } else {
      if (accuracy >= 0.75 && mistakeHits <= 1) status = "SUPPORTED";
      else if (accuracy < 0.5 || mistakeHits >= 2) status = "NOT_SUPPORTED";
      else status = "MIXED";
    }
    const summary =
      observations === 0
        ? "No relevant questions answered yet."
        : `${correct} of ${observations} relevant questions correct${mistakeHits ? `; ${mistakeHits} answer${mistakeHits === 1 ? "" : "s"} matched a linked mistake` : ""}.`;
    return { hypothesis, status, observations, correct, mistakeHits, summary };
  });
}
