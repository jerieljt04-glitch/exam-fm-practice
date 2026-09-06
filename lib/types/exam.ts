export type TopicDomain =
  | "TIME_VALUE_OF_MONEY"
  | "ANNUITIES"
  | "LOANS"
  | "BONDS"
  | "ALM_IMMUNIZATION";

export interface RenderedOption {
  key: "A" | "B" | "C" | "D" | "E";
  text: string;
  isCorrect: boolean;
  distractorType?:
    | "CORRECT"
    | "ANNUITY_DUE_CONFUSION"
    | "SIMPLE_INTEREST_ERROR"
    | "OFF_BY_ONE_PERIOD"
    | "NOMINAL_RATE_ERROR"
    | "CALCULATION_DISTRACTOR";
  distractorExplanation?: string;
}

export interface ExamQuestionData {
  id: string;
  examSessionId: string;
  templateId: string;
  domain: TopicDomain;
  renderedQuestion: string;
  renderedOptions: RenderedOption[];
  selectedOption: string | null;
  isFlagged?: boolean;
  variables: Record<string, any>;
  isCorrect: boolean | null;
  solutionSteps: string;
  videoUrl: string;
}

export interface ExamSessionData {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  pausedTimeMs: number;
  isPaused: boolean;
  lastPausedAt: string | null;
  durationSeconds: number; // 9000s = 150m
  status: "IN_PROGRESS" | "PAUSED" | "COMPLETED";
  questions: ExamQuestionData[];
}

export interface DomainMetric {
  domain: TopicDomain;
  label: string;
  total: number;
  correct: number;
  percentage: number;
  status: "MASTERED" | "ADEQUATE" | "NEEDS_IMPROVEMENT" | "CRITICAL";
}

export interface ExamReviewData {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  isPassed: boolean; // >= 70% (21/30)
  totalTimeSpentSeconds: number;
  totalPausedTimeSeconds: number;
  domainMetrics: Record<TopicDomain, DomainMetric>;
  questions: ExamQuestionData[];
}
