/**
 * Attempt history: the records every analysis reads, recently served
 * questions, remediation items, export and reset.
 */
import type { AttemptRecord } from "../analysis/attempts";
import type { RemediationItemData } from "../analysis/remediation";
import type { Confidence } from "../engine/skills";
import type { QuestionInstance } from "../engine/types";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { prisma } from "./db";

// ---------------------------------------------------------------- history

/**
 * Parsed question payloads by question id. A payload never changes after its
 * session is created, so each one is read from the database and parsed once
 * per server run; later history reads fetch only the small answer columns.
 * Bounded so a very long history cannot grow memory without limit.
 */
const PAYLOAD_CACHE_LIMIT = 5000;
const payloadCache = new Map<string, QuestionInstance>();

async function instancesFor(ids: readonly string[]): Promise<Map<string, QuestionInstance>> {
  const missing = ids.filter((id) => !payloadCache.has(id));
  for (let k = 0; k < missing.length; k += 400) {
    const rows = await prisma.sessionQuestion.findMany({ where: { id: { in: missing.slice(k, k + 400) } }, select: { id: true, payload: true } });
    for (const row of rows) payloadCache.set(row.id, JSON.parse(row.payload) as QuestionInstance);
  }
  const out = new Map<string, QuestionInstance>();
  for (const id of ids) {
    const instance = payloadCache.get(id);
    if (instance) out.set(id, instance);
  }
  // Evict the oldest entries beyond the limit (Map keeps insertion order).
  for (const key of payloadCache.keys()) {
    if (payloadCache.size <= PAYLOAD_CACHE_LIMIT) break;
    payloadCache.delete(key);
  }
  return out;
}

const ANSWER_COLUMNS = {
  id: true,
  sessionId: true,
  position: true,
  selectedKey: true,
  confidence: true,
  method: true,
  methodNote: true,
  working: true,
  timeSpentSeconds: true,
  isCorrect: true,
  session: { select: { mode: true, submittedAt: true } },
} as const;

type AnswerRow = {
  id: string;
  sessionId: string;
  position: number;
  selectedKey: string | null;
  confidence: string | null;
  method: string | null;
  methodNote: string | null;
  working: string;
  timeSpentSeconds: number;
  isCorrect: boolean | null;
  session: { mode: string; submittedAt: Date | null };
};

function toAttempt(row: AnswerRow, instance: QuestionInstance): AttemptRecord {
  return {
    questionId: row.id,
    sessionId: row.sessionId,
    mode: row.session.mode,
    position: row.position,
    submittedAt: (row.session.submittedAt ?? new Date()).toISOString(),
    instance,
    selectedKey: row.selectedKey,
    confidence: (row.confidence as Confidence | null) ?? null,
    method: row.method,
    methodNote: row.methodNote,
    working: row.working,
    timeSpentSeconds: row.timeSpentSeconds,
    isCorrect: Boolean(row.isCorrect),
  };
}

async function attemptsFrom(rows: AnswerRow[]): Promise<AttemptRecord[]> {
  const instances = await instancesFor(rows.map((r) => r.id));
  return rows.filter((r) => instances.has(r.id)).map((r) => toAttempt(r, instances.get(r.id)!));
}

export async function attemptsForSession(id: string): Promise<AttemptRecord[]> {
  const rows = await prisma.sessionQuestion.findMany({ where: { sessionId: id }, select: ANSWER_COLUMNS, orderBy: { position: "asc" } });
  return attemptsFrom(rows);
}

/** Questions of the most recently created sessions (any status), oldest session first. */
export async function recentlyServed(sessions: number): Promise<Array<{ sessionId: string; instance: QuestionInstance }>> {
  const rows = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: sessions,
    select: { id: true, questions: { select: { id: true }, orderBy: { position: "asc" } } },
  });
  const ordered = rows.reverse();
  const instances = await instancesFor(ordered.flatMap((r) => r.questions.map((q) => q.id)));
  return ordered.flatMap((row) => row.questions.filter((q) => instances.has(q.id)).map((q) => ({ sessionId: row.id, instance: instances.get(q.id)! })));
}

/** Every answered question of every submitted session, oldest first. */
export async function attemptHistory(): Promise<AttemptRecord[]> {
  const rows = await prisma.sessionQuestion.findMany({
    where: { session: { status: "SUBMITTED" } },
    select: ANSWER_COLUMNS,
    orderBy: [{ session: { submittedAt: "asc" } }, { position: "asc" }],
  });
  return attemptsFrom(rows);
}

/**
 * A fingerprint of everything the history analytics read: submitted sessions
 * and remediation items. Cheap to compute (aggregates only), and it changes
 * whenever a session is submitted or a remediation item moves.
 */
export async function historyVersion(): Promise<string> {
  const [sessions, items] = await Promise.all([
    prisma.session.aggregate({ where: { status: "SUBMITTED" }, _count: { _all: true }, _max: { submittedAt: true } }),
    prisma.remediationItem.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
  ]);
  return [sessions._count._all, sessions._max.submittedAt?.getTime() ?? 0, items._count._all, items._max.updatedAt?.getTime() ?? 0].join("|");
}

export async function loadRemediationItems(): Promise<RemediationItemData[]> {
  const rows = await prisma.remediationItem.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    target: row.target,
    kind: row.kind as RemediationItemData["kind"],
    objective: row.objective,
    sourceQuestionId: row.sourceQuestionId,
    sourceTemplateId: row.sourceTemplateId,
    stage: row.stage,
    status: row.status as RemediationItemData["status"],
    dueAt: row.dueAt.toISOString(),
    attempts: JSON.parse(row.attempts),
    createdAt: row.createdAt.toISOString(),
  }));
}


export async function resetHistory(): Promise<void> {
  await prisma.$transaction([
    prisma.sessionQuestion.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.remediationItem.deleteMany({}),
    prisma.validationLog.deleteMany({}),
    prisma.snapshot.deleteMany({}),
  ]);
  payloadCache.clear();
}

// ---------------------------------------------------------------- backup

export const BACKUP_FORMAT = "exam-fm-practice-backup";
export const BACKUP_VERSION = 1;

/** Everything needed to restore your history: sessions with their questions, remediation, and study progress. */
export async function exportHistory() {
  const [sessions, questions, remediation, cards, studyAttempts] = await Promise.all([
    prisma.session.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.sessionQuestion.findMany({ orderBy: [{ sessionId: "asc" }, { position: "asc" }] }),
    prisma.remediationItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.studyCard.findMany(),
    prisma.studyAttempt.findMany({ orderBy: { at: "asc" } }),
  ]);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), sessions, questions, remediation, cards, studyAttempts };
}
export type HistoryBackup = Awaited<ReturnType<typeof exportHistory>>;

/** Replaces all history with a backup (in one transaction: either everything is restored or nothing changes). */
export async function restoreHistory(backup: HistoryBackup): Promise<{ sessions: number; questions: number }> {
  const date = (v: unknown) => (v === null || v === undefined ? v : new Date(v as string));
  await prisma.$transaction([
    prisma.sessionQuestion.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.remediationItem.deleteMany({}),
    prisma.studyAttempt.deleteMany({}),
    prisma.studyCard.deleteMany({}),
    prisma.snapshot.deleteMany({}),
    prisma.session.createMany({ data: backup.sessions.map((r) => ({ ...r, createdAt: date(r.createdAt) as Date, updatedAt: date(r.updatedAt) as Date, submittedAt: date(r.submittedAt) as Date | null })) }),
    prisma.sessionQuestion.createMany({ data: backup.questions.map((r) => ({ ...r, answeredAt: date(r.answeredAt) as Date | null })) }),
    prisma.remediationItem.createMany({ data: backup.remediation.map((r) => ({ ...r, dueAt: date(r.dueAt) as Date, createdAt: date(r.createdAt) as Date, updatedAt: date(r.updatedAt) as Date })) }),
    prisma.studyCard.createMany({ data: backup.cards.map((r) => ({ ...r, dueAt: date(r.dueAt) as Date, lastReviewedAt: date(r.lastReviewedAt) as Date | null, createdAt: date(r.createdAt) as Date, updatedAt: date(r.updatedAt) as Date })) }),
    prisma.studyAttempt.createMany({ data: backup.studyAttempts.map((r) => ({ ...r, at: date(r.at) as Date })) }),
  ]);
  payloadCache.clear();
  return { sessions: backup.sessions.length, questions: backup.questions.length };
}


/** Writes the current history to <database folder>/backups before it is replaced; returns the file path. */
export async function saveSafetyCopy(): Promise<string> {
  const url = process.env.EXAM_FM_DATABASE_URL ?? "";
  const dbFile = url.startsWith("file:") ? url.slice(5) : path.join(process.cwd(), "data", "exam-fm.db");
  const dir = path.join(path.dirname(dbFile), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `history-before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(await exportHistory()));
  return file;
}
