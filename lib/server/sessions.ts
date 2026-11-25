/**
 * Session lifecycle: configuration, creation (exam, diagnostic, challenge,
 * practice, concept, remediation, transfer), the in-progress view, autosave
 * and submission.
 */
import { randomUUID } from "crypto";

import { EXAM_STRUCTURE, TOPIC_ORDER } from "../syllabus";
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
import { RECENCY_WEIGHTS, recencyMaps } from "../engine/approach";
import { answerTypeOfInstance, itemFormatOf, practiceOf, toPublicQuestion, type Difficulty, type PublicQuestion, type QuestionInstance } from "../engine/types";
import { CONFIDENCE_LEVELS, METHODS, type Confidence, type ReasoningSkill } from "../engine/skills";
import { PROFILE_FOCUS_MISCONCEPTIONS } from "../profile";
import { applySession, remediationTargets } from "../analysis/remediation";
import { llmConfigured, rewordStem } from "../llm/provider";
import { acceptElapsed, isExpired } from "../timer";
import { prisma } from "./db";
import { MODE_DEFAULTS, MODE_LABELS, type CreateSessionInput, type ReferenceMode } from "./config";
import { getAnalytics } from "./dashboard";
import { NotFoundError, ValidationError } from "./errors";
import { attemptsForSession, loadRemediationItems, recentlyServed, servedTemplateCounts } from "./history";

// ---------------------------------------------------------------- configuration

export { MODE_DEFAULTS, MODE_LABELS, REFERENCE_LABELS, type CreateSessionInput, type ReferenceMode } from "./config";

/** Seconds per question when a session is timed: 150 minutes over 30 questions. */
const SECONDS_PER_QUESTION = (EXAM_STRUCTURE.durationMinutes * 60) / EXAM_STRUCTURE.questionCount;

function parseDifficulty(value: unknown, fallback: DifficultySetting): DifficultySetting {
  if (value === "mixed" || value === "hard" || value === "elite") return value;
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 ? (n as Difficulty) : fallback;
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

  // History analytics come from the stored summary (recomputed only when new work is submitted).
  const analytics = await getAnalytics();
  let probeSkills: Set<ReasoningSkill> | undefined;
  if (input.mode === "DIAGNOSTIC") probeSkills = new Set(analytics.skills.filter((p) => p.observations < 3).map((p) => p.skill));
  // Lean toward weak and untested outcomes (concept mastery for Concept Practice, calculation mastery otherwise),
  // and away from presentations seen in the last few sessions.
  const outcomeRows =
    input.mode === "CONCEPT"
      ? analytics.concepts.byOutcome.map((o) => ({ objective: o.objective, status: o.status }))
      : analytics.mastery.map((o) => ({ objective: o.objective, status: o.status }));
  const weakObjectives = new Set(outcomeRows.filter((o) => o.status === "WEAK").map((o) => o.objective));
  const untestedObjectives = new Set(outcomeRows.filter((o) => o.status === "NOT_TESTED").map((o) => o.objective));
  const recent = new Set<string>();
  (await recentlyServed(4)).forEach(({ instance }) => {
    recent.add(instance.templateId);
    if (instance.kind === "choice") recent.add(`${instance.templateId}|${instance.variant}`);
  });
  // Solution approaches and templates from the last ten sessions served — submitted or not, so an
  // abandoned attempt still counts as seen — weighted by recency; and every template ever served,
  // so unseen questions are always used before any earlier one returns.
  const recency = recencyMaps(await recentlyServed(RECENCY_WEIGHTS.length));
  const servedTemplates = await servedTemplateCounts();
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
    servedTemplates,
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
  /** Timed out but not yet submitted. */
  expired: boolean;
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
  // Reading never changes a session: an expired one is flagged and the client submits it.
  const expired = session.status === "ACTIVE" && isExpired(session.durationSeconds, session.elapsedSeconds);
  const config = JSON.parse(session.config) as { reference?: ReferenceMode; notice?: string | null; conceptFocus?: ConceptFocus };
  return {
    id: session.id,
    mode: session.mode as SessionMode,
    modeLabel: MODE_LABELS[session.mode as SessionMode] ?? session.mode,
    status: session.status as SessionView["status"],
    expired,
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
  if (!session) throw new NotFoundError("Session not found.");
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

/** Submissions in flight, by session: concurrent submits of one session share a single run. */
const inFlight = new Map<string, Promise<void>>();

/**
 * Submits a session exactly once. Repeated or concurrent calls (timer expiry
 * racing the button, a retried request) share the run already in progress,
 * and the status change is also claimed atomically in the database.
 */
export function submitSession(id: string): Promise<void> {
  const running = inFlight.get(id);
  if (running) return running;
  const run = submitOnce(id).finally(() => inFlight.delete(id));
  inFlight.set(id, run);
  return run;
}

async function submitOnce(id: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id }, include: { questions: true } });
  if (!session) throw new NotFoundError("Session not found.");
  if (session.status === "SUBMITTED") return;
  const now = new Date();
  // Idempotent: the status change is claimed atomically, so a repeated or concurrent submit
  // (timer expiry racing the button, a retried request) scores and applies remediation once.
  // Score outside the transaction (parsing payloads is the slow part), then claim and write the
  // scores in one short transaction: a concurrent submit waits briefly and then sees it claimed.
  const scores = session.questions.map((row) => {
    const instance = JSON.parse(row.payload) as QuestionInstance;
    const selected = instance.options.find((o) => o.key === row.selectedKey);
    return { id: row.id, isCorrect: Boolean(selected?.isCorrect), selectedMisconception: selected && !selected.isCorrect ? selected.misconceptionTag : null };
  });
  const claimed = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.session.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "SUBMITTED", submittedAt: now } });
      if (claim.count === 0) return false;
      for (const score of scores) {
        await tx.sessionQuestion.update({ where: { id: score.id }, data: { isCorrect: score.isCorrect, selectedMisconception: score.selectedMisconception } });
      }
      return true;
    },
    { maxWait: 20_000, timeout: 30_000 }
  );
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

// ---------------------------------------------------------------- hard-archetype drill

/**
 * A drill built from a submitted session's missed Challenge and Elite
 * questions: each trap that caught the candidate is set again in a different
 * template at Challenge level or above, topped up with other hard questions.
 */
export async function createHardDrill(sessionId: string): Promise<string> {
  const attempts = await attemptsForSession(sessionId);
  if (!attempts.length) throw new NotFoundError("Session not found.");
  const missed = attempts.filter((a) => a.instance.difficulty >= 3 && !a.isCorrect);
  if (!missed.length) throw new ValidationError("There are no missed Challenge or Elite questions in this session to drill.");
  const targets: Target[] = missed.slice(0, 12).map((a) => {
    const chosen = a.instance.options.find((o) => o.key === a.selectedKey && !o.isCorrect)?.misconceptionTag;
    // The trap chosen, retested in another hard template; failing that, the same learning outcome at a hard level.
    return { ...(chosen ? { misconception: chosen } : {}), objective: a.instance.objective, avoidTemplates: [a.instance.templateId], minLevel: 3 as const };
  });
  const count = Math.max(6, Math.min(15, targets.length + 3));
  return createSession({ mode: "CHALLENGE", count, difficulty: "hard", targets, timed: false });
}

