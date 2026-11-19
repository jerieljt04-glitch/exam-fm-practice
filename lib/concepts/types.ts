import type { TopicId } from "../syllabus";

/**
 * A financial-mathematics idea Concept Practice tests: a definition, a
 * relationship, a condition or an interpretation. Concept chains refer to
 * these ids, and concept mastery is tracked per concept as well as per
 * learning outcome.
 */
export interface Concept {
  id: string;
  label: string;
  topic: TopicId;
  /** Syllabus outcome ids the concept belongs to. */
  outcomes: string[];
  /** One-sentence statement of the idea (markup). */
  summary: string;
  /** Concepts it is commonly confused with. */
  confusable?: string[];
}

export const concept = (id: string, topic: TopicId, label: string, outcomes: string[], summary: string, confusable: string[] = []): Concept => ({
  id,
  topic,
  label,
  outcomes,
  summary,
  ...(confusable.length ? { confusable } : {}),
});
