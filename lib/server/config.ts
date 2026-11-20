/** Session-mode configuration shared by session creation and the read models. */
import { REFERENCE_LABELS, type ReferenceMode } from "../reference";
import { EXAM_STRUCTURE, type TopicId } from "../syllabus";
import type { ConceptFocus, DifficultySetting, IntegrationMix, SessionMode, Target } from "../engine/session";

export { REFERENCE_LABELS, type ReferenceMode };

export interface CreateSessionInput {
  mode: SessionMode;
  reference?: ReferenceMode;
  integrationMix?: IntegrationMix;
  count?: number;
  difficulty?: DifficultySetting;
  timed?: boolean;
  aiWording?: boolean;
  targets?: Target[];
  /** Concept Practice: focus and optional topic filter. */
  conceptFocus?: ConceptFocus;
  topic?: TopicId | null;
}

export const MODE_DEFAULTS: Record<SessionMode, { count: number; difficulty: DifficultySetting; timed: boolean }> = {
  DIAGNOSTIC: { count: 15, difficulty: "mixed", timed: false },
  EXAM: { count: EXAM_STRUCTURE.questionCount, difficulty: 1, timed: true },
  CHALLENGE: { count: 10, difficulty: 3, timed: false },
  PRACTICE: { count: 10, difficulty: "mixed", timed: false },
  CONCEPT: { count: 10, difficulty: "mixed", timed: false },
  REMEDIATION: { count: 8, difficulty: "mixed", timed: false },
  TRANSFER: { count: 2, difficulty: "mixed", timed: false },
};

export const MODE_LABELS: Record<SessionMode, string> = {
  DIAGNOSTIC: "Diagnostic",
  EXAM: "Exam simulation",
  CHALLENGE: "Challenge",
  PRACTICE: "Formula practice",
  CONCEPT: "Concept practice",
  REMEDIATION: "Remediation",
  TRANSFER: "Transfer check",
};
