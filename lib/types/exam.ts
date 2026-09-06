import type { DifficultyLevel, OptionKey, SyllabusTopic } from "../exam-config";

export type TopicDomain =
  | "TIME_VALUE_OF_MONEY"
  | "ANNUITIES"
  | "LOANS"
  | "BONDS"
  | "ALM_IMMUNIZATION";

export type DistractorType =
  | "CORRECT"
  | "ANNUITY_DUE_CONFUSION"
  | "SIMPLE_INTEREST_ERROR"
  | "OFF_BY_ONE_PERIOD"
  | "NOMINAL_RATE_ERROR"
  | "CALCULATION_DISTRACTOR";

export interface RenderedOption {
  key: OptionKey;
  /** Authored in the markup dialect of `lib/math/markup.ts`. */
  text: string;
  isCorrect: boolean;
  distractorType?: DistractorType;
  /** Names the specific misconception this option models. */
  distractorExplanation?: string;
}

export interface ExamQuestionData {
  id: string;
  examSessionId: string;
  templateId: string;
  templateTitle: string;
  /** The syllabus skill assessed, shown in the review report. */
  objective: string;
  difficulty: DifficultyLevel;
  /** Syllabus areas this item combines. */
  topics: SyllabusTopic[];
  /** Number of interdependent sub-problems the candidate must chain. */
  steps: number;
  domain: TopicDomain;
  renderedQuestion: string;
  renderedOptions: RenderedOption[];
  selectedOption: string | null;
  isFlagged?: boolean;
  /** Parameter set drawn for this instance, including its generation seed. */
  variables: Record<string, unknown>;
  isCorrect: boolean | null;
  solutionSteps: string;
}

export type ExamStatus = "IN_PROGRESS" | "PAUSED" | "COMPLETED";

export interface ExamSessionData {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  pausedTimeMs: number;
  isPaused: boolean;
  lastPausedAt: string | null;
  /** 9000 seconds = 150 minutes. */
  durationSeconds: number;
  status: ExamStatus;
  questions: ExamQuestionData[];
}

export type ProficiencyStatus = "MASTERED" | "ADEQUATE" | "NEEDS_IMPROVEMENT" | "CRITICAL";

export interface DomainMetric {
  domain: TopicDomain;
  label: string;
  total: number;
  correct: number;
  percentage: number;
  status: ProficiencyStatus;
}

export interface ExamReviewData {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  totalQuestions: number;
  correctCount: number;
  unansweredCount: number;
  scorePercent: number;
  /** True when the candidate met this platform's 70% practice benchmark. */
  isPassed: boolean;
  totalTimeSpentSeconds: number;
  totalPausedTimeSeconds: number;
  domainMetrics: Record<TopicDomain, DomainMetric>;
  questions: ExamQuestionData[];
}
