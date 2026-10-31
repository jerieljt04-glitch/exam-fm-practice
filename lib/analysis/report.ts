import { TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "../syllabus";
import { getMisconception, MISCONCEPTION_CATEGORIES, type MisconceptionCategory } from "../engine/misconceptions";
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, isConfident, isUnsure, type Confidence } from "../engine/skills";
import { CHAIN_ERROR_LABELS, DIFFICULTY_LABELS, INTEGRATION_LABELS, type ChainErrorKind, type Difficulty, type IntegrationLevel, type QuestionInstance } from "../engine/types";
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
      steps: a.instance.chain.steps.length,
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
