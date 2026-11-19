import { REFERENCE_LABELS, type ReferenceMode } from "../reference";
import { randomUUID } from "crypto";

import { EXAM_STRUCTURE, TOPIC_ORDER, type TopicId } from "../syllabus";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "../engine/misconceptions";
import {
  CONCEPT_FOCUS_LABELS,
  DEFAULT_INTEGRATION_MIX,
  buildSession,
  type ConceptFocus,
  type DifficultySetting,
  type IntegrationMix,
  type SessionMode,
  type Target,
} from "../engine/session";
import { isNumericAnswer } from "../engine/answers";
import { recencyMaps } from "../engine/approach";
import { answerTypeOfInstance, isConceptItem, itemFormatOf, practiceOf } from "../engine/types";
import { CONFIDENCE_LEVELS, METHODS, REASONING_SKILLS, type Confidence, type ReasoningSkill } from "../engine/skills";
import { toPublicQuestion, type PublicQuestion, type QuestionInstance } from "../engine/types";
import { PROFILE_FOCUS_MISCONCEPTIONS } from "../profile";
import { classifyAttempt, type AttemptRecord } from "../analysis/attempts";
import { evaluateHypotheses, masteryByObjective } from "../analysis/mastery";
import { applySession, isDue, remediationTargets, type RemediationItemData } from "../analysis/remediation";
import { buildReport, type DiagnosticReport, type SessionMeta } from "../analysis/report";
import { skillProfile } from "../analysis/skills";
import { formulaMastery } from "../analysis/formulas";
import { conceptMastery } from "../analysis/concepts";
import { llmConfigured, rewordStem } from "../llm/provider";
import { acceptElapsed, isExpired } from "../timer";
import { prisma } from "./db";

// ---------------------------------------------------------------- configuration

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

/** Seconds per question when a session is timed: 150 minutes over 30 questions. */
const SECONDS_PER_QUESTION = (EXAM_STRUCTURE.durationMinutes * 60) / EXAM_STRUCTURE.questionCount;

function parseDifficulty(value: unknown, fallback: DifficultySetting): DifficultySetting {
  if (value === "mixed") return "mixed";
  if (value === "hard") return "hard";
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : fallback;
}

// ---------------------------------------------------------------- creation

export async function createSession(input: CreateSessionInput): Promise<string> {
  const defaults = MODE_DEFAULTS[input.mode];
  const count = Math.max(1, Math.min(60, Math.round(input.count ?? defaults.count)));
  const difficulty = parseDifficulty(input.difficulty, defaults.difficulty);
  const timed = input.timed ?? defaults.timed;
  const durationSeconds = timed ? Math.round(count * SECONDS_PER_QUESTION) : null;
  // Diagnostics, exams, challenges and Concept Practice are always closed book.
  const reference: ReferenceMode = input.mode === "PRACTICE" ? input.reference ?? "integration" : "closed";
  const integrationMix = input.mode === "PRACTICE" ? sanitizeMix(input.integrationMix) : undefined;
  const id = randomUUID();

  const history = await attemptHistory();
  let probeSkills: Set<ReasoningSkill> | undefined;
  if (input.mode === "DIAGNOSTIC") {
    const profile = skillProfile(history);
    probeSkills = new Set(profile.filter((p) => p.observations < 3).map((p) => p.skill));
  }
  // Lean toward weak and untested outcomes (concept mastery for Concept Practice, calculation mastery otherwise),
  // and away from presentations seen in the last few sessions.
  const outcomeRows =
    input.mode === "CONCEPT"
      ? conceptMastery(history).byOutcome.map((o) => ({ objective: o.objective, status: o.status }))
      : masteryByObjective(history).map((o) => ({ objective: o.objective, status: o.status }));
  const weakObjectives = new Set(outcomeRows.filter((o) => o.status === "WEAK").map((o) => o.objective));
  const untestedObjectives = new Set(outcomeRows.filter((o) => o.status === "NOT_TESTED").map((o) => o.objective));
  const recentSessions = [...new Set(history.map((a) => a.sessionId))].slice(-4);
  const recent = new Set<string>();
  history
    .filter((a) => recentSessions.includes(a.sessionId))
    .forEach((a) => {
      recent.add(a.instance.templateId);
      if (a.instance.kind === "choice") recent.add(`${a.instance.templateId}|${a.instance.variant}`);
    });
  // Solution approaches and templates from the last six sessions served — submitted or not, so an
  // abandoned attempt still counts as seen — weighted by recency.
  const recency = recencyMaps(await recentlyServed(6));
  const conceptFocus: ConceptFocus | undefined = input.mode === "CONCEPT" ? (input.conceptFocus && input.conceptFocus in CONCEPT_FOCUS_LABELS ? input.conceptFocus : "mixed") : undefined;
  const topic = input.mode === "CONCEPT" && input.topic && TOPIC_ORDER.includes(input.topic) ? input.topic : null;

  const built = buildSession({
    mode: input.mode,
    count,
    difficulty,
    seed: id,
    prefer: input.mode === "DIAGNOSTIC" || input.mode === "REMEDIATION" ? PROFILE_FOCUS_MISCONCEPTIONS : undefined,
    probeSkills,
    targets: input.targets,
    integrationMix,
    conceptFocus,
    topic,
    weakObjectives,
    untestedObjectives,
    recent,
    recentApproaches: recency.approaches,
    recentTemplates: recency.templates,
  });
  if (!built.questions.length) {
    throw new Error(built.shortfall?.reason ?? "No validated questions could be generated for this session.");
  }
  // A shorter session is disclosed, never silently padded from another difficulty level.
  const notice = built.shortfall
    ? `${built.shortfall.reason} This session has ${built.shortfall.built} of the ${built.shortfall.requested} questions requested; no question was replaced by one from another difficulty level.`
    : null;

  const questions: QuestionInstance[] = built.questions;
  const aiWording = Boolean(input.aiWording) && llmConfigured();
  if (aiWording) {
    for (let start = 0; start < questions.length; start += 5) {
      const batch = questions.slice(start, start + 5);
      const results = await Promise.all(batch.map((q) => rewordStem(q)));
      results.forEach((result, k) => {
        const q = batch[k];
        q.validation.checks.push({ name: "language-model rewording", ok: true, detail: result.accepted ? "accepted after checks" : `kept original (${result.reason})` });
        if (result.accepted) {
          q.params = { ...q.params, originalStem: q.stem };
          q.stem = result.stem;
          q.reworded = true;
        }
      });
    }
  }

  await prisma.$transaction([
    prisma.session.create({
      data: {
        id,
        mode: input.mode,
        status: "ACTIVE",
        difficulty: String(difficulty),
        timed,
        durationSeconds,
        config: JSON.stringify({ count: questions.length, requested: count, aiWording, flagged: built.flagged, reference, integrationMix, conceptFocus, topic, notice }),
      },
    }),
    prisma.sessionQuestion.createMany({
      data: questions.map((q, position) => ({
        id: q.instanceId,
        sessionId: id,
        position,
        templateId: q.templateId,
        family: q.family,
        topic: q.topic,
        difficulty: q.difficulty,
        answerType: answerTypeOfInstance(q),
        itemFormat: itemFormatOf(q),
        practice: practiceOf(q),
        payload: JSON.stringify(q),
      })),
    }),
    prisma.validationLog.createMany({
      data: [
        ...questions.map((q) => ({ templateId: q.templateId, level: q.difficulty, seed: q.seed, status: "PASSED", record: JSON.stringify(q.validation), sessionId: id })),
        ...built.rejected.map((r) => ({ templateId: r.templateId, level: r.level, seed: r.seed, status: "REJECTED", record: JSON.stringify(r), sessionId: id })),
      ],
    }),
  ]);
  return id;
}

function sanitizeMix(mix: IntegrationMix | undefined): IntegrationMix {
  const base = { ...DEFAULT_INTEGRATION_MIX, ...(mix ?? {}) };
  const clean = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.max(0, Math.min(100, Number(v) || 0))])) as IntegrationMix;
  return Object.values(clean).some((v) => v > 0) ? clean : { ...DEFAULT_INTEGRATION_MIX };
}

export async function createRemediationSession(): Promise<string | null> {
  const items = await loadRemediationItems();
  const targets = remediationTargets(items, new Date());
  if (!targets.length) return null;
  return createSession({ mode: "REMEDIATION", count: targets.length, targets });
}

/** A short check that the principle behind a reviewed question transfers to a different presentation. */
export async function createTransferSession(questionId: string): Promise<string | null> {
  const row = await prisma.sessionQuestion.findUnique({ where: { id: questionId } });
  if (!row) return null;
  const instance = JSON.parse(row.payload) as QuestionInstance;
  const traps = instance.options.filter((o) => !o.isCorrect).map((o) => o.misconceptionTag);
  const targets: Target[] = [
    { objective: instance.objective, avoidTemplates: [instance.templateId] },
    { misconception: traps[0], objective: instance.objective, avoidTemplates: [instance.templateId] },
  ];
  return createSession({ mode: "TRANSFER", count: 2, targets });
}

// ---------------------------------------------------------------- active sessions

export interface ResponseState {
  selectedKey: string | null;
  confidence: Confidence | null;
  method: string | null;
  methodNote: string | null;
  working: string;
  flagged: boolean;
  timeSpentSeconds: number;
}

export interface SessionView {
  id: string;
  mode: SessionMode;
  modeLabel: string;
  status: "ACTIVE" | "SUBMITTED";
  reference: ReferenceMode;
  difficulty: string;
  timed: boolean;
  durationSeconds: number | null;
  elapsedSeconds: number;
  currentIndex: number;
  /** Disclosed when the session is shorter than requested. */
  notice: string | null;
  /** Concept Practice focus label, when the session is one. */
  focusLabel: string | null;
  questions: Array<PublicQuestion & { position: number; response: ResponseState }>;
}

export async function getSessionView(id: string): Promise<SessionView | null> {
  const session = await prisma.session.findUnique({ where: { id }, include: { questions: { orderBy: { position: "asc" } } } });
  if (!session) return null;
  if (session.status === "ACTIVE" && isExpired(session.durationSeconds, session.elapsedSeconds)) {
    await submitSession(id);
    return getSessionView(id);
  }
  const config = JSON.parse(session.config) as { reference?: ReferenceMode; notice?: string | null; conceptFocus?: ConceptFocus };
  return {
    id: session.id,
    mode: session.mode as SessionMode,
    modeLabel: MODE_LABELS[session.mode as SessionMode] ?? session.mode,
    status: session.status as SessionView["status"],
    notice: config.notice ?? null,
    focusLabel: config.conceptFocus ? CONCEPT_FOCUS_LABELS[config.conceptFocus] : null,
    reference: config.reference ?? "closed",
    difficulty: session.difficulty,
    timed: session.timed,
    durationSeconds: session.durationSeconds,
    elapsedSeconds: session.elapsedSeconds,
    currentIndex: session.currentIndex,
    // Only the stem and the option text leave the server while a session is active.
    questions: session.questions.map((row) => ({
      ...toPublicQuestion(JSON.parse(row.payload) as QuestionInstance, { revealFormulas: config.reference === "supported" }),
      position: row.position,
      response: {
        selectedKey: row.selectedKey,
        confidence: (row.confidence as Confidence | null) ?? null,
        method: row.method,
        methodNote: row.methodNote,
        working: row.working,
        flagged: row.flagged,
        timeSpentSeconds: row.timeSpentSeconds,
      },
    })),
  };
}

export interface ProgressPatch {
  elapsedSeconds?: number;
  currentIndex?: number;
  answers?: Array<{
    instanceId: string;
    selectedKey?: string | null;
    confidence?: string | null;
    method?: string | null;
    methodNote?: string | null;
    working?: string;
    flagged?: boolean;
    addSeconds?: number;
  }>;
}

const METHOD_IDS = new Set<string>(METHODS.map((m) => m.id));

export async function saveProgress(id: string, patch: ProgressPatch): Promise<{ ok: boolean; elapsedSeconds: number; status: string }> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) throw new Error("Session not found.");
  if (session.status !== "ACTIVE") return { ok: false, elapsedSeconds: session.elapsedSeconds, status: session.status };

  const sinceLastSave = (Date.now() - session.updatedAt.getTime()) / 1000;
  const elapsed =
    patch.elapsedSeconds !== undefined
      ? acceptElapsed(session.elapsedSeconds, patch.elapsedSeconds, sinceLastSave, session.durationSeconds)
      : session.elapsedSeconds;

  const writes = [];
  for (const answer of patch.answers ?? []) {
    const data: Record<string, unknown> = {};
    if (answer.selectedKey !== undefined) {
      data.selectedKey = answer.selectedKey && (EXAM_STRUCTURE.optionKeys as readonly string[]).includes(answer.selectedKey) ? answer.selectedKey : null;
      data.answeredAt = data.selectedKey ? new Date() : null;
    }
    if (answer.confidence !== undefined) data.confidence = answer.confidence && (CONFIDENCE_LEVELS as readonly string[]).includes(answer.confidence) ? answer.confidence : null;
    if (answer.method !== undefined) data.method = answer.method && METHOD_IDS.has(answer.method) ? answer.method : null;
    if (answer.methodNote !== undefined) data.methodNote = answer.methodNote ? String(answer.methodNote).slice(0, 500) : null;
    if (answer.working !== undefined) data.working = String(answer.working).slice(0, 20000);
    if (answer.flagged !== undefined) data.flagged = Boolean(answer.flagged);
    if (answer.addSeconds) data.timeSpentSeconds = { increment: Math.max(0, Math.min(Math.round(answer.addSeconds), Math.ceil(sinceLastSave) + 5)) };
    if (Object.keys(data).length) writes.push(prisma.sessionQuestion.updateMany({ where: { id: answer.instanceId, sessionId: id }, data }));
  }
  writes.push(
    prisma.session.update({
      where: { id },
      data: { elapsedSeconds: elapsed, ...(patch.currentIndex !== undefined ? { currentIndex: Math.max(0, Math.floor(patch.currentIndex)) } : {}) },
    })
  );
  await prisma.$transaction(writes);

  if (isExpired(session.durationSeconds, elapsed)) {
    await submitSession(id);
    return { ok: true, elapsedSeconds: elapsed, status: "SUBMITTED" };
  }
  return { ok: true, elapsedSeconds: elapsed, status: "ACTIVE" };
}

// ---------------------------------------------------------------- submission

export async function submitSession(id: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id }, include: { questions: true } });
  if (!session) throw new Error("Session not found.");
  if (session.status === "SUBMITTED") return;
  const now = new Date();
  // Idempotent: the status change is claimed atomically, so a repeated or concurrent submit
  // (timer expiry racing the button, a retried request) scores and applies remediation once.
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.session.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "SUBMITTED", submittedAt: now } });
    if (claim.count === 0) return false;
    for (const row of session.questions) {
      const instance = JSON.parse(row.payload) as QuestionInstance;
      const selected = instance.options.find((o) => o.key === row.selectedKey);
      await tx.sessionQuestion.update({
        where: { id: row.id },
        data: {
          isCorrect: Boolean(selected?.isCorrect),
          selectedMisconception: selected && !selected.isCorrect ? selected.misconceptionTag : null,
        },
      });
    }
    return true;
  });
  if (!claimed) return;

  // Advance the remediation cycle with this session's evidence.
  const attempts = await attemptsForSession(id);
  const items = await loadRemediationItems();
  const changed = applySession(items, attempts, now);
  await prisma.$transaction(
    changed.map((item) =>
      item.id
        ? prisma.remediationItem.update({
            where: { id: item.id },
            data: { stage: item.stage, status: item.status, dueAt: new Date(item.dueAt), attempts: JSON.stringify(item.attempts) },
          })
        : prisma.remediationItem.create({
            data: {
              target: item.target,
              kind: item.kind,
              objective: item.objective,
              sourceQuestionId: item.sourceQuestionId,
              sourceTemplateId: item.sourceTemplateId,
              stage: item.stage,
              status: item.status,
              dueAt: new Date(item.dueAt),
              attempts: JSON.stringify(item.attempts),
            },
          })
    )
  );
}

// ---------------------------------------------------------------- history

type Row = Awaited<ReturnType<typeof prisma.sessionQuestion.findMany>>[number] & { session: { mode: string; submittedAt: Date | null } };

function toAttempt(row: Row): AttemptRecord {
  return {
    questionId: row.id,
    sessionId: row.sessionId,
    mode: row.session.mode,
    position: row.position,
    submittedAt: (row.session.submittedAt ?? new Date()).toISOString(),
    instance: JSON.parse(row.payload) as QuestionInstance,
    selectedKey: row.selectedKey,
    confidence: (row.confidence as Confidence | null) ?? null,
    method: row.method,
    methodNote: row.methodNote,
    working: row.working,
    timeSpentSeconds: row.timeSpentSeconds,
    isCorrect: Boolean(row.isCorrect),
  };
}

export async function attemptsForSession(id: string): Promise<AttemptRecord[]> {
  const rows = await prisma.sessionQuestion.findMany({
    where: { sessionId: id },
    include: { session: { select: { mode: true, submittedAt: true } } },
    orderBy: { position: "asc" },
  });
  return rows.map(toAttempt);
}

/** Questions of the most recently created sessions (any status), oldest session first. */
export async function recentlyServed(sessions: number): Promise<Array<{ sessionId: string; instance: QuestionInstance }>> {
  const rows = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: sessions,
    select: { id: true, questions: { select: { payload: true }, orderBy: { position: "asc" } } },
  });
  return rows.reverse().flatMap((row) => row.questions.map((q) => ({ sessionId: row.id, instance: JSON.parse(q.payload) as QuestionInstance })));
}

export async function attemptHistory(): Promise<AttemptRecord[]> {
  const rows = await prisma.sessionQuestion.findMany({
    where: { session: { status: "SUBMITTED" } },
    include: { session: { select: { mode: true, submittedAt: true } } },
    orderBy: [{ session: { submittedAt: "asc" } }, { position: "asc" }],
  });
  return rows.map(toAttempt);
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

export async function getDashboard() {
  const [sessions, history, items, validation] = await Promise.all([
    prisma.session.findMany({ orderBy: { createdAt: "desc" }, include: { questions: { select: { isCorrect: true, difficulty: true, selectedKey: true } } } }),
    attemptHistory(),
    loadRemediationItems(),
    prisma.validationLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const now = new Date();
  const evidence = history.map(classifyAttempt);

  const misconceptionCounts = new Map<string, number>();
  evidence.forEach((e) => {
    if (e.selectedMisconception) misconceptionCounts.set(e.selectedMisconception, (misconceptionCounts.get(e.selectedMisconception) ?? 0) + 1);
  });

  // Recent improvement: SOA-standard calculation accuracy, latest 20 attempts against the 20 before.
  // Challenge sessions and Concept Practice are measured separately and never enter this figure.
  const standard = history.filter((a) => a.instance.difficulty === 1 && a.mode !== "CHALLENGE" && !isConceptItem(a.instance));
  const window = (list: AttemptRecord[]) => (list.length ? list.filter((a) => a.isCorrect).length / list.length : null);
  const recent = standard.slice(-20);
  const before = standard.slice(-40, -20);

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
    llm: llmConfigured(),
    formulaStatus: formulas.formulas.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }), {}),
    weakFormulas: formulas.formulas.filter((f) => f.status === "WEAK").map((f) => ({ id: f.formula, name: f.name, reason: f.reason })),
    weakCombinations: formulas.combinations.filter((c) => c.attempts >= 2 && c.success / c.attempts < 0.5).slice(0, 6),
    validation: Object.fromEntries(validation.map((v) => [v.status, v._count._all])) as Record<string, number>,
    sessions: sessions.map((s) => {
      const answered = s.questions.length;
      const correct = s.questions.filter((q) => q.isCorrect).length;
      const std = s.questions.filter((q) => q.difficulty === 1);
      return {
        id: s.id,
        mode: s.mode as SessionMode,
        modeLabel: MODE_LABELS[s.mode as SessionMode] ?? s.mode,
        status: s.status,
        difficulty: s.difficulty,
        createdAt: s.createdAt.toISOString(),
        submittedAt: s.submittedAt?.toISOString() ?? null,
        total: answered,
        correct,
        answeredSoFar: s.questions.filter((q) => q.selectedKey).length,
        standardTotal: std.length,
        standardCorrect: std.filter((q) => q.isCorrect).length,
      };
    }),
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
    improvement: {
      recent: window(recent),
      recentCount: recent.length,
      before: window(before),
      beforeCount: before.length,
    },
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
    totals: { attempts: history.length, correct: history.filter((a) => a.isCorrect).length },
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export async function resetHistory(): Promise<void> {
  await prisma.$transaction([
    prisma.sessionQuestion.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.remediationItem.deleteMany({}),
    prisma.validationLog.deleteMany({}),
  ]);
}

export const ALL_SKILLS: readonly ReasoningSkill[] = REASONING_SKILLS;
