import { DOMAIN_LABELS, DOMAIN_ORDER } from "./exam-config";
import type { ExamReviewData, TopicDomain } from "./types/exam";

export const STUDY_HISTORY_KEY = "exam-fm-study-history-v1";

export interface AttemptSummary {
  sessionId: string;
  mode: ExamReviewData["mode"];
  completedAt: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  averageSecondsPerQuestion: number;
  calculatorUseRate: number;
  calculatorAccuracy: number | null;
  domainScores: Partial<Record<TopicDomain, number>>;
}

export interface MasteryRecord {
  templateId: string;
  objective: string;
  domain: TopicDomain;
  attempts: number;
  correct: number;
  streak: number;
  lastCorrect: boolean;
  lastAttemptAt: string;
  nextReviewAt: string;
}

export interface StudyHistory {
  attempts: AttemptSummary[];
  mastery: Record<string, MasteryRecord>;
}

export const EMPTY_STUDY_HISTORY: StudyHistory = { attempts: [], mastery: {} };

export function readStudyHistory(storage: Pick<Storage, "getItem">): StudyHistory {
  try {
    const raw = storage.getItem(STUDY_HISTORY_KEY);
    if (!raw) return EMPTY_STUDY_HISTORY;
    const parsed = JSON.parse(raw) as Partial<StudyHistory>;
    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      mastery: parsed.mastery && typeof parsed.mastery === "object" ? parsed.mastery : {},
    };
  } catch {
    return EMPTY_STUDY_HISTORY;
  }
}

export function recordReview(
  storage: Pick<Storage, "getItem" | "setItem">,
  review: ExamReviewData
): StudyHistory {
  const history = readStudyHistory(storage);
  if (history.attempts.some((attempt) => attempt.sessionId === review.sessionId)) return history;

  const completedAt = review.endTime;
  const attempt: AttemptSummary = {
    sessionId: review.sessionId,
    mode: review.mode,
    completedAt,
    scorePercent: review.scorePercent,
    correctCount: review.correctCount,
    totalQuestions: review.totalQuestions,
    averageSecondsPerQuestion:
      review.totalQuestions > 0
        ? Math.round(
            review.questions.reduce((sum, question) => sum + (question.timeSpentSeconds ?? 0), 0) /
              review.totalQuestions
          )
        : 0,
    calculatorUseRate:
      review.totalQuestions > 0
        ? Math.round(
            (review.questions.filter((question) => question.calculatorUsed).length /
              review.totalQuestions) *
              100
          )
        : 0,
    calculatorAccuracy: (() => {
      const used = review.questions.filter((question) => question.calculatorUsed);
      return used.length > 0
        ? Math.round((used.filter((question) => question.isCorrect).length / used.length) * 100)
        : null;
    })(),
    domainScores: DOMAIN_ORDER.reduce((scores, domain) => {
      const metric = review.domainMetrics[domain];
      if (metric?.total) scores[domain] = metric.percentage;
      return scores;
    }, {} as Partial<Record<TopicDomain, number>>),
  };

  const nextMastery = { ...history.mastery };
  const correctIntervals = [3, 7, 14, 30];
  for (const question of review.questions) {
    const previous = nextMastery[question.templateId];
    const wasCorrect = Boolean(question.isCorrect);
    const streak = wasCorrect ? (previous?.streak ?? 0) + 1 : 0;
    const days = wasCorrect
      ? correctIntervals[Math.min(streak - 1, correctIntervals.length - 1)]
      : 1;
    const nextReview = new Date(new Date(completedAt).getTime() + days * 86_400_000);
    nextMastery[question.templateId] = {
      templateId: question.templateId,
      objective: question.objective,
      domain: question.domain,
      attempts: (previous?.attempts ?? 0) + 1,
      correct: (previous?.correct ?? 0) + (wasCorrect ? 1 : 0),
      streak,
      lastCorrect: wasCorrect,
      lastAttemptAt: completedAt,
      nextReviewAt: nextReview.toISOString(),
    };
  }

  const next: StudyHistory = {
    attempts: [attempt, ...history.attempts].slice(0, 100),
    mastery: nextMastery,
  };
  storage.setItem(STUDY_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function dueTemplateIds(history: StudyHistory, now = new Date()): string[] {
  return Object.values(history.mastery)
    .filter((record) => new Date(record.nextReviewAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())
    .map((record) => record.templateId);
}

export function mistakeTemplateIds(history: StudyHistory): string[] {
  return Object.values(history.mastery)
    .filter((record) => !record.lastCorrect)
    .sort((a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime())
    .map((record) => record.templateId);
}

/** The topics of the given templates, in blueprint order, for a review that has to fall back to topics. */
export function reviewDomains(history: StudyHistory, templateIds: readonly string[]): TopicDomain[] {
  const wanted = new Set(templateIds.map((id) => history.mastery[id]?.domain).filter(Boolean));
  return DOMAIN_ORDER.filter((domain) => wanted.has(domain));
}

export function domainMastery(history: StudyHistory): Array<{
  domain: TopicDomain;
  label: string;
  attempted: number;
  accuracy: number;
}> {
  return DOMAIN_ORDER.map((domain) => {
    const records = Object.values(history.mastery).filter((record) => record.domain === domain);
    const attempts = records.reduce((sum, record) => sum + record.attempts, 0);
    const correct = records.reduce((sum, record) => sum + record.correct, 0);
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      attempted: records.length,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    };
  });
}
