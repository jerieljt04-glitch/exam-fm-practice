/**
 * Read models: the dashboard summary and the per-session report.
 */
import { getMisconception, MISCONCEPTION_CATEGORIES } from "../engine/misconceptions";
import type { SessionMode } from "../engine/session";
import { isNumericAnswer } from "../engine/answers";
import { answerTypeOfInstance, isConceptItem, itemFormatOf } from "../engine/types";
import { classifyAttempt, type AttemptRecord } from "../analysis/attempts";
import { evaluateHypotheses, masteryByObjective } from "../analysis/mastery";
import { isDue } from "../analysis/remediation";
import { buildReport, type DiagnosticReport, type SessionMeta } from "../analysis/report";
import { skillProfile } from "../analysis/skills";
import { formulaMastery } from "../analysis/formulas";
import { conceptMastery } from "../analysis/concepts";
import { llmConfigured } from "../llm/provider";
import { prisma } from "./db";
import { attemptHistory, attemptsForSession, historyVersion, loadRemediationItems } from "./history";
import { MODE_LABELS } from "./config";

export async function getReport(id: string): Promise<DiagnosticReport | null> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.status !== "SUBMITTED") return null;
  const meta: SessionMeta = {
    id: session.id,
    mode: session.mode,
    difficulty: session.difficulty,
    timed: session.timed,
    durationSeconds: session.durationSeconds,
    elapsedSeconds: session.elapsedSeconds,
    createdAt: session.createdAt.toISOString(),
    submittedAt: (session.submittedAt ?? session.updatedAt).toISOString(),
  };
  return buildReport(meta, await attemptsForSession(id));
}

// ---------------------------------------------------------------- dashboard

/** Pass mark used for the readiness estimate. The SOA does not publish a fixed raw cut score; about 70% is the usual guide. */
export const PASS_MARK = 0.7;

/**
 * The expensive part of the dashboard: every analysis that reads the full
 * attempt history. Computed once per history version and stored (memory and
 * the Snapshot table), so loading the dashboard or starting an exam does not
 * re-read every answered question until something new is submitted.
 */
function computeAnalytics(history: AttemptRecord[]) {
  const evidence = history.map(classifyAttempt);
  const misconceptionCounts = new Map<string, number>();
  evidence.forEach((e) => {
    if (e.selectedMisconception) misconceptionCounts.set(e.selectedMisconception, (misconceptionCounts.get(e.selectedMisconception) ?? 0) + 1);
  });

  // Recent improvement: SOA-standard calculation accuracy, latest 20 attempts against the 20 before.
  // Challenge sessions and Concept Practice are measured separately and never enter this figure.
  const standard = history.filter((a) => a.instance.difficulty === 1 && a.mode !== "CHALLENGE" && !isConceptItem(a.instance));
  const share = (list: AttemptRecord[]) => (list.length ? list.filter((a) => a.isCorrect).length / list.length : null);
  const recent = standard.slice(-20);
  const before = standard.slice(-40, -20);

  // Readiness: SOA-standard accuracy over the latest 60 exam-style questions (calculation and concept),
  // with a 90% Wilson interval so a short history reads as uncertain rather than precise.
  const examStyle = history.filter((a) => a.instance.difficulty === 1 && a.mode !== "CHALLENGE" && a.mode !== "PRACTICE").slice(-60);
  const n = examStyle.length;
  const p = n ? examStyle.filter((a) => a.isCorrect).length / n : 0;
  const z = 1.645;
  const centre = n ? (p + (z * z) / (2 * n)) / (1 + (z * z) / n) : 0;
  const half = n ? (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n) : 0;
  const readiness = {
    sample: n,
    estimate: n ? p : null,
    low: n ? Math.max(0, centre - half) : null,
    high: n ? Math.min(1, centre + half) : null,
    passMark: PASS_MARK,
    verdict: n < 15 ? "insufficient" : centre - half >= PASS_MARK ? "ready" : centre + half < PASS_MARK ? "not-yet" : "borderline",
  } as const;

  const formulas = formulaMastery(history);
  const concepts = conceptMastery(history);
  const numeric = history.filter((a) => isNumericAnswer(answerTypeOfInstance(a.instance)));
  const typed = history.filter((a) => !isNumericAnswer(answerTypeOfInstance(a.instance)));
  const formatRows = new Map<string, { total: number; correct: number }>();
  history.forEach((a) => {
    const key = itemFormatOf(a.instance);
    const row = formatRows.get(key) ?? { total: 0, correct: 0 };
    row.total += 1;
    if (a.isCorrect) row.correct += 1;
    formatRows.set(key, row);
  });

  return {
    concepts,
    formats: {
      numerical: { total: numeric.length, correct: numeric.filter((a) => a.isCorrect).length },
      nonNumerical: { total: typed.length, correct: typed.filter((a) => a.isCorrect).length },
      byFormat: [...formatRows.entries()].map(([format, row]) => ({ format, ...row })).sort((a, b) => b.total - a.total),
    },
    formulaStatus: formulas.formulas.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }), {}),
    weakFormulas: formulas.formulas.filter((f) => f.status === "WEAK").map((f) => ({ id: f.formula, name: f.name, reason: f.reason })),
    weakCombinations: formulas.combinations.filter((c) => c.attempts >= 2 && c.success / c.attempts < 0.5).slice(0, 6),
    skills: skillProfile(history, evidence),
    misconceptions: [...misconceptionCounts.entries()]
      .map(([id, count]) => {
        const m = getMisconception(id)!;
        return { id, count, label: m.label, category: MISCONCEPTION_CATEGORIES[m.category], principle: m.principle };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    hypotheses: evaluateHypotheses(history),
    mastery: masteryByObjective(history),
    improvement: { recent: share(recent), recentCount: recent.length, before: share(before), beforeCount: before.length },
    readiness,
    totals: { attempts: history.length, correct: history.filter((a) => a.isCorrect).length },
  };
}
export type Analytics = ReturnType<typeof computeAnalytics>;

const ANALYTICS_KEY = "dashboard-analytics";
let analyticsMemo: { version: string; data: Analytics } | null = null;

/** The history analytics for the current history version: from memory, then the stored snapshot, else computed and stored. */
export async function getAnalytics(): Promise<Analytics> {
  const version = await historyVersion();
  if (analyticsMemo?.version === version) return analyticsMemo.data;
  const stored = await prisma.snapshot.findUnique({ where: { key: ANALYTICS_KEY } });
  if (stored?.version === version) {
    const data = JSON.parse(stored.data) as Analytics;
    analyticsMemo = { version, data };
    return data;
  }
  const data = computeAnalytics(await attemptHistory());
  analyticsMemo = { version, data };
  await prisma.snapshot.upsert({ where: { key: ANALYTICS_KEY }, create: { key: ANALYTICS_KEY, version, data: JSON.stringify(data) }, update: { version, data: JSON.stringify(data) } });
  return data;
}

/** One submitted or active session as listed on the dashboard and in the history table. */
export interface SessionSummary {
  id: string;
  mode: SessionMode;
  modeLabel: string;
  status: string;
  difficulty: string;
  createdAt: string;
  submittedAt: string | null;
  total: number;
  correct: number;
  answeredSoFar: number;
  standardTotal: number;
  standardCorrect: number;
}

type SessionWithAnswers = Awaited<ReturnType<typeof prisma.session.findMany>>[number] & {
  questions: Array<{ isCorrect: boolean | null; difficulty: number; selectedKey: string | null }>;
};

function summarise(s: SessionWithAnswers): SessionSummary {
  const std = s.questions.filter((q) => q.difficulty === 1);
  return {
    id: s.id,
    mode: s.mode as SessionMode,
    modeLabel: MODE_LABELS[s.mode as SessionMode] ?? s.mode,
    status: s.status,
    difficulty: s.difficulty,
    createdAt: s.createdAt.toISOString(),
    submittedAt: s.submittedAt?.toISOString() ?? null,
    total: s.questions.length,
    correct: s.questions.filter((q) => q.isCorrect).length,
    answeredSoFar: s.questions.filter((q) => q.selectedKey).length,
    standardTotal: std.length,
    standardCorrect: std.filter((q) => q.isCorrect).length,
  };
}

const ANSWER_SUMMARY = { questions: { select: { isCorrect: true, difficulty: true, selectedKey: true } } } as const;

/** Submitted sessions, newest first, one page at a time. */
export async function sessionHistory(page: number, pageSize = 20): Promise<{ rows: SessionSummary[]; total: number; page: number; pages: number }> {
  const total = await prisma.session.count({ where: { status: "SUBMITTED" } });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const rows = await prisma.session.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    skip: (current - 1) * pageSize,
    take: pageSize,
    include: ANSWER_SUMMARY,
  });
  return { rows: rows.map(summarise), total, page: current, pages };
}

/** Score per submitted session, oldest first, for the trend chart (the latest 40). */
export async function scoreTrend(): Promise<Array<{ id: string; at: string; mode: SessionMode; modeLabel: string; score: number; standard: number | null; total: number }>> {
  const rows = await prisma.session.findMany({ where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 40, include: ANSWER_SUMMARY });
  return rows
    .reverse()
    .map(summarise)
    .filter((s) => s.total > 0)
    .map((s) => ({ id: s.id, at: s.submittedAt!, mode: s.mode, modeLabel: s.modeLabel, score: s.correct / s.total, standard: s.standardTotal ? s.standardCorrect / s.standardTotal : null, total: s.total }));
}

export async function getDashboard() {
  const [analytics, active, recentDone, items, validation] = await Promise.all([
    getAnalytics(),
    prisma.session.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, include: ANSWER_SUMMARY }),
    prisma.session.findMany({ where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 5, include: ANSWER_SUMMARY }),
    loadRemediationItems(),
    prisma.validationLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const now = new Date();
  return {
    ...analytics,
    llm: llmConfigured(),
    validation: Object.fromEntries(validation.map((v) => [v.status, v._count._all])) as Record<string, number>,
    /** Active sessions and the five most recent submitted ones (the full history is paginated: sessionHistory). */
    sessions: [...active.map(summarise), ...recentDone.map(summarise)],
    remediation: {
      due: items.filter((i) => isDue(i, now)).length,
      scheduled: items.filter((i) => i.status === "SCHEDULED" && !isDue(i, now)).map((i) => ({ target: i.target, dueAt: i.dueAt })),
      resolved: items.filter((i) => i.status === "RESOLVED").length,
      open: items
        .filter((i) => i.status !== "RESOLVED")
        .map((i) => ({
          id: i.id!,
          label:
            i.kind === "MISCONCEPTION"
              ? getMisconception(i.target)?.label ?? i.target
              : i.kind === "CONCEPT"
                ? `Concept: ${getMisconception(i.target)?.label ?? i.target}`
                : `Weak reasoning: ${i.objective}`,
          kind: i.kind,
          stage: i.stage,
          status: i.status,
          dueAt: i.dueAt,
        })),
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
