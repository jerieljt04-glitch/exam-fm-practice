import { TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "../syllabus";
import { getMisconception, MISCONCEPTION_CATEGORIES, type MisconceptionCategory } from "../engine/misconceptions";
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, isConfident, isUnsure, type Confidence } from "../engine/skills";
import {
  CHAIN_ERROR_LABELS,
  CONCEPT_FAILURE_LABELS,
  CONCEPT_FAILURES,
  DIFFICULTY_LABELS,
  INTEGRATION_LABELS,
  ITEM_FORMAT_LABELS,
  answerTypeOfInstance,
  itemFormatOf,
  type ChainErrorKind,
  type ConceptFailure,
  type Difficulty,
  type IntegrationLevel,
  type ItemFormat,
  type QuestionInstance,
} from "../engine/types";
import { ANSWER_TYPE_LABELS, isNumericAnswer, type AnswerType } from "../engine/answers";
import { calibrate } from "../engine/calibration";
import { getConcept } from "../concepts/registry";
import { conceptItem } from "./concepts";
import { FORMULA_BY_ID } from "../formulas/registry";
import { CAUSE_LABELS, QUALITY_LABELS, classifyAttempt, type AttemptEvidence, type AttemptRecord, type ErrorCause } from "./attempts";
import { skillProfile, type SkillScore } from "./skills";

export interface SessionMeta {
  id: string;
  mode: string;
  difficulty: string;
  timed: boolean;
  durationSeconds: number | null;
  elapsedSeconds: number;
  createdAt: string;
  submittedAt: string;
}

export interface QuestionReview {
  position: number;
  instance: QuestionInstance;
  response: {
    selectedKey: string | null;
    confidence: Confidence | null;
    method: string | null;
    methodNote: string | null;
    working: string;
    timeSpentSeconds: number;
  };
  evidence: AttemptEvidence;
  qualityLabel: string;
  causeLabel: string | null;
}

export interface Comparison {
  label: string;
  withCount: number;
  withErrors: number;
  withoutCount: number;
  withoutErrors: number;
}

export interface DiagnosticReport {
  session: SessionMeta;
  overall: {
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    percent: number;
    averageSeconds: number;
    longQuestions: { position: number; seconds: number }[];
  };
  byDifficulty: { level: Difficulty; label: string; total: number; correct: number }[];
  byTopic: { topic: TopicId; label: string; total: number; correct: number }[];
  reasoning: SkillScore[];
  misconceptions: { id: string; label: string; category: string; count: number; positions: number[]; principle: string; recognition: string }[];
  categories: { category: MisconceptionCategory; label: string; count: number }[];
  causes: { cause: ErrorCause; label: string; count: number; positions: number[] }[];
  confidence: {
    table: { level: Confidence; label: string; total: number; correct: number }[];
    highConfidenceWrong: number[];
    lowConfidenceCorrect: number[];
    weakReasoningCorrect: number[];
    methodRightExecutionWrong: number[];
    unrated: number[];
  };
  timing: { thresholdSeconds: number; comparisons: Comparison[] };
  /** Where in the formula chains the wrong answers left the correct route. */
  chains: {
    byLevel: { level: IntegrationLevel; label: string; total: number; correct: number }[];
    byKind: { kind: ChainErrorKind; label: string; count: number; positions: number[] }[];
    breaks: { position: number; stage: number; steps: number; formula: string; formulaName: string; kind: ChainErrorKind; wrongFormula: string | null }[];
    formulas: { formula: string; name: string; count: number; positions: number[] }[];
  };
  /** Performance by question format and answer type, time by format and difficulty, and reasoning depth. */
  formats: {
    split: { kind: "numerical" | "non-numerical"; label: string; total: number; correct: number; averageSeconds: number }[];
    practice: { kind: "calculation" | "concept"; label: string; total: number; correct: number }[];
    byFormat: { format: ItemFormat; label: string; total: number; correct: number; averageSeconds: number }[];
    byAnswerType: { type: AnswerType; label: string; total: number; correct: number }[];
    time: { format: ItemFormat; label: string; level: Difficulty; total: number; averageSeconds: number }[];
    /** Accuracy by number of reasoning steps (structural calibration); shown for challenge work. */
    depth: { steps: string; total: number; correct: number; averageSeconds: number }[];
  };
  /** Concept items in this session: where reasoning failed, concepts missed and confused. */
  concepts: {
    total: number;
    correct: number;
    byFailure: { kind: ConceptFailure; label: string; count: number; positions: number[] }[];
    missed: { id: string; label: string; positions: number[] }[];
    confused: { a: string; aLabel: string; b: string; bLabel: string; positions: number[] }[];
  };
  questions: QuestionReview[];
  remediation: { misconception: string; label: string; count: number; principle: string }[];
  notes: string[];
}

/** Target seconds per question in each mode, used to flag questions that ran long. */
export function targetSeconds(meta: SessionMeta, count: number): number {
  if (meta.timed && meta.durationSeconds) return meta.durationSeconds / Math.max(count, 1);
  return 360;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildReport(meta: SessionMeta, attempts: readonly AttemptRecord[]): DiagnosticReport {
  const ordered = [...attempts].sort((a, b) => a.position - b.position);
  const evidence = ordered.map(classifyAttempt);
  const total = ordered.length;
  const correct = evidence.filter((e) => e.correct).length;
  const unanswered = evidence.filter((e) => !e.answered).length;
  const times = ordered.map((a) => a.timeSpentSeconds);
  const threshold = Math.max(1.5 * median(times), 1.25 * targetSeconds(meta, total));
  const positionOf = (index: number) => ordered[index].position + 1;

  // Misconceptions chosen.
  const misconceptionMap = new Map<string, number[]>();
  evidence.forEach((e, idx) => {
    if (e.selectedMisconception) misconceptionMap.set(e.selectedMisconception, [...(misconceptionMap.get(e.selectedMisconception) ?? []), positionOf(idx)]);
  });
  const misconceptions = [...misconceptionMap.entries()]
    .map(([id, positions]) => {
      const m = getMisconception(id)!;
      return { id, label: m.label, category: MISCONCEPTION_CATEGORIES[m.category], count: positions.length, positions, principle: m.principle, recognition: m.recognition };
    })
    .sort((a, b) => b.count - a.count);

  const categoryCounts = new Map<MisconceptionCategory, number>();
  for (const [id, positions] of misconceptionMap) {
    const category = getMisconception(id)!.category;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + positions.length);
  }

  const causeMap = new Map<ErrorCause, number[]>();
  evidence.forEach((e, idx) => {
    if (e.cause) causeMap.set(e.cause, [...(causeMap.get(e.cause) ?? []), positionOf(idx)]);
  });

  // Confidence calibration.
  const table = CONFIDENCE_LEVELS.map((level) => {
    const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] })).filter(({ a, e }) => a.confidence === level && e.answered);
    return { level, label: CONFIDENCE_LABELS[level], total: rows.length, correct: rows.filter(({ e }) => e.correct).length };
  });
  const pick = (predicate: (a: AttemptRecord, e: AttemptEvidence) => boolean) =>
    ordered.map((a, idx) => ({ a, e: evidence[idx], idx })).filter(({ a, e }) => predicate(a, e)).map(({ idx }) => positionOf(idx));

  // Time-pressure comparisons: error rate with and without each feature.
  const compare = (label: string, has: (a: AttemptRecord) => boolean): Comparison => {
    const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] }));
    const withRows = rows.filter(({ a }) => has(a));
    const withoutRows = rows.filter(({ a }) => !has(a));
    return {
      label,
      withCount: withRows.length,
      withErrors: withRows.filter(({ e }) => !e.correct).length,
      withoutCount: withoutRows.length,
      withoutErrors: withoutRows.filter(({ e }) => !e.correct).length,
    };
  };

  const notes: string[] = [
    "“Observed” statements describe exactly what was recorded: the option chosen, the confidence given, the time taken and numbers present in the working.",
    "“Inferred” statements are interpretations. An option's misconception tag says which mistake produces that number — not proof that the mistake was made.",
  ];
  if (evidence.filter((e) => e.answered && !e.workingProvided).length > total / 2) {
    notes.push("Most questions have no recorded working, so many causes below are inferred from the option chosen alone.");
  }
  if (total < 10) notes.push("This is a short session; treat percentages as indicative only.");

  return {
    session: meta,
    overall: {
      total,
      correct,
      incorrect: total - correct - unanswered,
      unanswered,
      percent: total ? Math.round((1000 * correct) / total) / 10 : 0,
      averageSeconds: total ? Math.round(times.reduce((a, b) => a + b, 0) / total) : 0,
      longQuestions: ordered
        .map((a, idx) => ({ position: positionOf(idx), seconds: a.timeSpentSeconds }))
        .filter((q) => q.seconds > threshold)
        .sort((a, b) => b.seconds - a.seconds),
    },
    byDifficulty: ([1, 2, 3] as Difficulty[]).map((level) => {
      const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] })).filter(({ a }) => a.instance.difficulty === level);
      return { level, label: DIFFICULTY_LABELS[level], total: rows.length, correct: rows.filter(({ e }) => e.correct).length };
    }),
    byTopic: TOPIC_ORDER.map((topic) => {
      const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] })).filter(({ a }) => a.instance.topic === topic);
      return { topic, label: TOPIC_LABELS[topic], total: rows.length, correct: rows.filter(({ e }) => e.correct).length };
    }),
    reasoning: skillProfile(ordered, evidence),
    misconceptions,
    categories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, label: MISCONCEPTION_CATEGORIES[category], count }))
      .sort((a, b) => b.count - a.count),
    causes: [...causeMap.entries()].map(([cause, positions]) => ({ cause, label: CAUSE_LABELS[cause], count: positions.length, positions })).sort((a, b) => b.count - a.count),
    confidence: {
      table,
      highConfidenceWrong: pick((a, e) => e.answered && !e.correct && isConfident(a.confidence)),
      lowConfidenceCorrect: pick((a, e) => e.correct && isUnsure(a.confidence)),
      weakReasoningCorrect: pick((_, e) => e.correct && (e.quality === "UNVERIFIED" || e.quality === "SUSPECT_METHOD")),
      methodRightExecutionWrong: pick((_, e) => e.cause === "METHOD_RIGHT_EXECUTION_WRONG"),
      unrated: pick((a, e) => e.answered && a.confidence === null),
    },
    timing: {
      thresholdSeconds: Math.round(threshold),
      comparisons: [
        compare("Took unusually long", (a) => a.timeSpentSeconds > threshold),
        compare("Combined several concepts", (a) => a.instance.features.multiConcept),
        compare("Required recalling a formula", (a) => a.instance.features.formulaRetrieval),
        compare("Unfamiliar presentation", (a) => a.instance.features.unfamiliar),
        compare("Several valuation dates", (a) => a.instance.features.multipleValuationDates),
      ],
    },
    chains: chainSummary(ordered, evidence, positionOf),
    formats: formatSummary(ordered, evidence),
    concepts: conceptSummary(ordered, evidence, positionOf),
    questions: ordered.map((a, idx) => ({
      position: a.position + 1,
      instance: a.instance,
      response: {
        selectedKey: a.selectedKey,
        confidence: a.confidence,
        method: a.method,
        methodNote: a.methodNote,
        working: a.working,
        timeSpentSeconds: a.timeSpentSeconds,
      },
      evidence: evidence[idx],
      qualityLabel: QUALITY_LABELS[evidence[idx].quality],
      causeLabel: evidence[idx].cause ? CAUSE_LABELS[evidence[idx].cause!] : null,
    })),
    remediation: misconceptions.map((m) => ({ misconception: m.id, label: m.label, count: m.count, principle: m.principle })),
    notes,
  };
}

function chainSummary(ordered: AttemptRecord[], evidence: AttemptEvidence[], positionOf: (idx: number) => number): DiagnosticReport["chains"] {
  const breaks: DiagnosticReport["chains"]["breaks"] = [];
  ordered.forEach((a, idx) => {
    const e = evidence[idx];
    if (!e.answered || e.correct || e.chainStage === null || !e.chainFormula) return;
    breaks.push({
      position: positionOf(idx),
      stage: e.chainStage,
      steps: a.instance.chain?.steps.length ?? 0,
      formula: e.chainFormula,
      formulaName: FORMULA_BY_ID[e.chainFormula]?.name ?? e.chainFormula,
      kind: e.chainError ?? "application",
      wrongFormula: e.wrongFormula,
    });
  });
  const kinds = Object.keys(CHAIN_ERROR_LABELS) as ChainErrorKind[];
  const formulaMap = new Map<string, number[]>();
  breaks.forEach((b) => formulaMap.set(b.formula, [...(formulaMap.get(b.formula) ?? []), b.position]));
  return {
    byLevel: ([1, 2, 3, 4, 5] as IntegrationLevel[])
      .map((level) => {
        const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] })).filter(({ a }) => a.instance.integration === level);
        return { level, label: INTEGRATION_LABELS[level], total: rows.length, correct: rows.filter(({ e }) => e.correct).length };
      })
      .filter((row) => row.total > 0),
    byKind: kinds
      .map((kind) => {
        const positions = breaks.filter((b) => b.kind === kind).map((b) => b.position);
        return { kind, label: CHAIN_ERROR_LABELS[kind], count: positions.length, positions };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count),
    breaks,
    formulas: [...formulaMap.entries()].map(([formula, positions]) => ({ formula, name: FORMULA_BY_ID[formula]?.name ?? formula, count: positions.length, positions })).sort((a, b) => b.count - a.count),
  };
}

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);

/** Calibration of a stored question; questions stored before calibration existed are calibrated on read. */
export function calibrationOf(instance: QuestionInstance) {
  return (
    instance.calibration ??
    calibrate({
      level: instance.difficulty,
      stem: instance.stem,
      exhibits: instance.exhibits,
      features: instance.features,
      presentation: instance.presentation,
      answerType: answerTypeOfInstance(instance),
      chain: instance.chain,
      concept: instance.kind === "choice" ? instance.concept : undefined,
    })
  );
}

function formatSummary(ordered: AttemptRecord[], evidence: AttemptEvidence[]): DiagnosticReport["formats"] {
  const rows = ordered.map((a, idx) => ({ a, e: evidence[idx] }));
  const group = <K extends string | number>(key: (a: AttemptRecord) => K) => {
    const map = new Map<K, typeof rows>();
    rows.forEach((r) => map.set(key(r.a), [...(map.get(key(r.a)) ?? []), r]));
    return map;
  };
  const stats = (list: typeof rows) => ({ total: list.length, correct: list.filter((r) => r.e.correct).length, averageSeconds: avg(list.map((r) => r.a.timeSpentSeconds)) });
  const numeric = rows.filter((r) => isNumericAnswer(answerTypeOfInstance(r.a.instance)));
  const typed = rows.filter((r) => !isNumericAnswer(answerTypeOfInstance(r.a.instance)));
  const concepts = rows.filter((r) => conceptItem(r.a.instance));
  const byFormat = group((a) => itemFormatOf(a.instance));
  const byType = group((a) => answerTypeOfInstance(a.instance));
  const byTime = group((a) => `${itemFormatOf(a.instance)}|${a.instance.difficulty}`);
  const byDepth = group((a): string => {
    const steps = calibrationOf(a.instance).reasoningSteps;
    return steps <= 2 ? "1–2 steps" : steps <= 4 ? "3–4 steps" : "5 or more steps";
  });
  return {
    split: [
      { kind: "numerical" as const, label: "Numerical calculation", ...stats(numeric) },
      { kind: "non-numerical" as const, label: "Conceptual, symbolic, statement or composite", ...stats(typed) },
    ].filter((r) => r.total > 0),
    practice: [
      { kind: "calculation" as const, label: "Calculation items", total: rows.length - concepts.length, correct: rows.filter((r) => !conceptItem(r.a.instance) && r.e.correct).length },
      { kind: "concept" as const, label: "Concept items", total: concepts.length, correct: concepts.filter((r) => r.e.correct).length },
    ].filter((r) => r.total > 0),
    byFormat: [...byFormat.entries()].map(([format, list]) => ({ format, label: ITEM_FORMAT_LABELS[format], ...stats(list) })).sort((a, b) => b.total - a.total),
    byAnswerType: [...byType.entries()].map(([type, list]) => ({ type, label: ANSWER_TYPE_LABELS[type], total: list.length, correct: list.filter((r) => r.e.correct).length })),
    time: [...byTime.entries()]
      .map(([key, list]) => {
        const [format, level] = key.split("|");
        return { format: format as ItemFormat, label: ITEM_FORMAT_LABELS[format as ItemFormat], level: Number(level) as Difficulty, total: list.length, averageSeconds: stats(list).averageSeconds };
      })
      .sort((a, b) => a.level - b.level || b.total - a.total),
    depth: ["1–2 steps", "3–4 steps", "5 or more steps"].filter((k) => byDepth.has(k)).map((steps) => ({ steps, ...stats(byDepth.get(steps)!) })),
  };
}

function conceptSummary(ordered: AttemptRecord[], evidence: AttemptEvidence[], positionOf: (idx: number) => number): DiagnosticReport["concepts"] {
  const failures = new Map<ConceptFailure, number[]>();
  const missed = new Map<string, number[]>();
  const confused = new Map<string, number[]>();
  let total = 0;
  let correct = 0;
  ordered.forEach((a, idx) => {
    if (!conceptItem(a.instance) || a.instance.kind !== "choice") return;
    total += 1;
    const e = evidence[idx];
    if (e.correct) correct += 1;
    if (!e.answered || e.correct) return;
    const p = positionOf(idx);
    if (e.conceptFailure) failures.set(e.conceptFailure, [...(failures.get(e.conceptFailure) ?? []), p]);
    const chain = a.instance.concept;
    const at = chain && e.conceptStage !== null ? chain.steps[e.conceptStage]?.concept : chain?.concepts[0];
    if (at) missed.set(at, [...(missed.get(at) ?? []), p]);
    if (at && e.confusedWith && at !== e.confusedWith) {
      const key = [at, e.confusedWith].sort().join("|");
      confused.set(key, [...(confused.get(key) ?? []), p]);
    }
  });
  return {
    total,
    correct,
    byFailure: CONCEPT_FAILURES.filter((k) => failures.has(k)).map((kind) => ({ kind, label: CONCEPT_FAILURE_LABELS[kind], count: failures.get(kind)!.length, positions: failures.get(kind)! })),
    missed: [...missed.entries()].map(([id, positions]) => ({ id, label: getConcept(id)?.label ?? id, positions })).sort((a, b) => b.positions.length - a.positions.length),
    confused: [...confused.entries()].map(([key, positions]) => {
      const [a, b] = key.split("|");
      return { a, aLabel: getConcept(a)?.label ?? a, b, bLabel: getConcept(b)?.label ?? b, positions };
    }),
  };
}
