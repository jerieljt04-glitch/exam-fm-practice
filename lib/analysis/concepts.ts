import { CONCEPTS, getConcept } from "../concepts/registry";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "../engine/misconceptions";
import {
  CONCEPT_DIMENSION_LABELS,
  CONCEPT_DIMENSIONS,
  CONCEPT_FAILURE_LABELS,
  CONCEPT_FAILURES,
  isConceptItem,
  type ConceptDimension,
  type ConceptFailure,
  type QuestionInstance,
} from "../engine/types";
import { OUTCOMES, TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "../syllabus";
import { classifyAttempt, type AttemptEvidence, type AttemptRecord } from "./attempts";
import { masteryStatus, type MasteryStatus } from "./mastery";

/**
 * Concept mastery, tracked separately from formula mastery and from
 * calculation accuracy.
 *
 * Only Concept Practice items (and other items carrying a concept chain)
 * count. A correct calculation never implies conceptual mastery, and a
 * correct concept answer never implies formula-application mastery
 * (lib/analysis/formulas.ts skips concept items).
 *
 * Per dimension: a secure correct answer credits every dimension the item
 * tests; a wrong answer debits the dimensions that match where its reasoning
 * failed (recognition → terminology, interpretation → interpretation, …), or
 * all of the item's dimensions when none match. A low-confidence correct
 * answer is not counted either way.
 */

const FAILURE_DIMENSIONS: Record<ConceptFailure, ConceptDimension[]> = {
  recognition: ["terminology"],
  interpretation: ["interpretation"],
  selection: ["applicability", "equation_construction"],
  application: ["conditions", "timing", "rate_conversion"],
  connection: ["relationships", "equation_construction"],
  conclusion: ["relationships", "interpretation", "error_recognition"],
};

export const conceptItem = (instance: QuestionInstance): boolean => isConceptItem(instance) || (instance.kind === "choice" && Boolean(instance.concept));

export interface ConceptStatusRow {
  attempts: number;
  correct: number;
  status: MasteryStatus;
  reason: string;
}

export interface ConceptMasteryReport {
  totals: { attempts: number; correct: number };
  byTopic: ({ topic: TopicId; label: string } & ConceptStatusRow)[];
  byOutcome: ({ objective: string; label: string; topic: TopicId } & ConceptStatusRow)[];
  byConcept: ({ id: string; label: string; topic: TopicId } & ConceptStatusRow)[];
  byDimension: { dimension: ConceptDimension; label: string; success: number; fail: number }[];
  byFailure: { kind: ConceptFailure; label: string; count: number }[];
  weakConcepts: { id: string; label: string; attempts: number; correct: number; reason: string }[];
  confusedPairs: { a: string; aLabel: string; b: string; bLabel: string; count: number }[];
  misconceptions: { id: string; label: string; category: string; count: number; principle: string }[];
  trend: { sessionId: string; mode: string; submittedAt: string; attempts: number; correct: number }[];
  versus: { topic: TopicId; label: string; concept: { attempts: number; correct: number }; calculation: { attempts: number; correct: number } }[];
}

function statusRow(attempts: readonly AttemptRecord[]): ConceptStatusRow {
  const { status, reason } = masteryStatus(attempts);
  return { attempts: attempts.length, correct: attempts.filter((a) => a.isCorrect).length, status, reason };
}

/** Concepts an attempt engages: the chain's concepts. */
function conceptsOf(instance: QuestionInstance): string[] {
  return instance.kind === "choice" && instance.concept ? [...new Set(instance.concept.concepts)] : [];
}

/** The concept at the step where the chosen option's reasoning failed, else the question's first concept. */
function failingConcept(instance: QuestionInstance, e: AttemptEvidence): string | null {
  if (instance.kind !== "choice" || !instance.concept) return null;
  const step = e.conceptStage !== null ? instance.concept.steps[e.conceptStage] : undefined;
  return step?.concept ?? instance.concept.concepts[0] ?? null;
}

export function conceptMastery(history: readonly AttemptRecord[]): ConceptMasteryReport {
  const concept = history.filter((a) => conceptItem(a.instance));
  const calculation = history.filter((a) => !conceptItem(a.instance));
  const evidence = new Map(concept.map((a) => [a, classifyAttempt(a)]));

  const dims = new Map<ConceptDimension, { success: number; fail: number }>(CONCEPT_DIMENSIONS.map((d) => [d, { success: 0, fail: 0 }]));
  const failures = new Map<ConceptFailure, number>();
  const pairs = new Map<string, number>();
  const misconceptions = new Map<string, number>();

  for (const attempt of concept) {
    const e = evidence.get(attempt)!;
    if (!e.answered || attempt.instance.kind !== "choice") continue;
    const declared = attempt.instance.concept?.dimensions ?? [];
    const unfamiliar = attempt.instance.features.unfamiliar;
    if (e.correct) {
      if (e.quality === "POSSIBLE_GUESS") continue;
      declared.forEach((d) => (dims.get(d)!.success += 1));
      if (unfamiliar && !declared.includes("transfer")) dims.get("transfer")!.success += 1;
      continue;
    }
    const kind = e.conceptFailure;
    const matched = kind ? declared.filter((d) => FAILURE_DIMENSIONS[kind].includes(d)) : [];
    (matched.length ? matched : declared).forEach((d) => (dims.get(d)!.fail += 1));
    if (unfamiliar && !declared.includes("transfer")) dims.get("transfer")!.fail += 1;
    if (kind) failures.set(kind, (failures.get(kind) ?? 0) + 1);
    if (e.selectedMisconception) misconceptions.set(e.selectedMisconception, (misconceptions.get(e.selectedMisconception) ?? 0) + 1);
    const right = failingConcept(attempt.instance, e);
    if (right && e.confusedWith && right !== e.confusedWith) {
      const [a, b] = [right, e.confusedWith].sort();
      pairs.set(`${a}|${b}`, (pairs.get(`${a}|${b}`) ?? 0) + 1);
    }
  }

  const byConcept = CONCEPTS.map((c) => ({ id: c.id, label: c.label, topic: c.topic, ...statusRow(concept.filter((a) => conceptsOf(a.instance).includes(c.id))) }));

  const sessions = new Map<string, { sessionId: string; mode: string; submittedAt: string; attempts: number; correct: number }>();
  for (const a of concept) {
    const row = sessions.get(a.sessionId) ?? { sessionId: a.sessionId, mode: a.mode, submittedAt: a.submittedAt, attempts: 0, correct: 0 };
    row.attempts += 1;
    if (a.isCorrect) row.correct += 1;
    sessions.set(a.sessionId, row);
  }

  const tally = (rows: readonly AttemptRecord[]) => ({ attempts: rows.length, correct: rows.filter((a) => a.isCorrect).length });

  return {
    totals: tally(concept),
    byTopic: TOPIC_ORDER.map((topic) => ({ topic, label: TOPIC_LABELS[topic], ...statusRow(concept.filter((a) => a.instance.topic === topic)) })),
    byOutcome: Object.values(OUTCOMES).map((o) => ({ objective: o.id, label: o.label, topic: o.topic, ...statusRow(concept.filter((a) => a.instance.objective === o.id)) })),
    byConcept,
    byDimension: CONCEPT_DIMENSIONS.map((d) => ({ dimension: d, label: CONCEPT_DIMENSION_LABELS[d], ...dims.get(d)! })),
    byFailure: CONCEPT_FAILURES.map((kind) => ({ kind, label: CONCEPT_FAILURE_LABELS[kind], count: failures.get(kind) ?? 0 })).filter((r) => r.count > 0),
    weakConcepts: byConcept
      .filter((c) => c.status === "WEAK" || (c.attempts >= 2 && c.correct / c.attempts < 0.5))
      .sort((a, b) => a.correct / Math.max(a.attempts, 1) - b.correct / Math.max(b.attempts, 1))
      .map((c) => ({ id: c.id, label: c.label, attempts: c.attempts, correct: c.correct, reason: c.reason })),
    confusedPairs: [...pairs.entries()]
      .map(([key, count]) => {
        const [a, b] = key.split("|");
        return { a, aLabel: getConcept(a)?.label ?? a, b, bLabel: getConcept(b)?.label ?? b, count };
      })
      .sort((x, y) => y.count - x.count),
    misconceptions: [...misconceptions.entries()]
      .map(([id, count]) => {
        const m = getMisconception(id);
        return { id, label: m?.label ?? id, category: m ? MISCONCEPTION_CATEGORIES[m.category] : "", count, principle: m?.principle ?? "" };
      })
      .sort((a, b) => b.count - a.count),
    trend: [...sessions.values()].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    versus: TOPIC_ORDER.map((topic) => ({
      topic,
      label: TOPIC_LABELS[topic],
      concept: tally(concept.filter((a) => a.instance.topic === topic)),
      calculation: tally(calculation.filter((a) => a.instance.topic === topic)),
    })),
  };
}
