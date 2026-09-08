import {
  ABANDON_AFTER_MS,
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  type DifficultyLevel,
  type SyllabusTopic,
  EXAM_DURATION_SECONDS,
  EXAM_TOTAL_QUESTIONS,
  PASS_MARK,
  proficiencyStatus,
} from "./exam-config";
import { SEED_VARIABLE_KEY, examGenerator } from "./engine/generator";
import { QUESTION_TEMPLATES, getTemplateById } from "./engine/templates";
import { createRng } from "./engine/random";
import { prisma } from "./prisma";
import type {
  DomainMetric,
  ExamQuestionData,
  ExamReviewData,
  ExamSessionData,
  TopicDomain,
} from "./types/exam";

export { DOMAIN_LABELS };

/**
 * In-memory session store.
 *
 * It serves two purposes: it is the authoritative store when PostgreSQL is not
 * reachable (so the platform is runnable straight after `npm install`), and it
 * holds the per-question "flagged for review" state, which the SOA-specified
 * `ExamQuestion` schema has no column for.
 */
declare global {
  // eslint-disable-next-line no-var
  var __examStore: Map<string, ExamSessionData> | undefined;
}

const localStore: Map<string, ExamSessionData> =
  globalThis.__examStore ?? (globalThis.__examStore = new Map<string, ExamSessionData>());

/**
 * Circuit breaker around PostgreSQL.
 *
 * When the database is unreachable or unmigrated, every request would otherwise
 * pay a full connection timeout before falling back. After the first such
 * failure the breaker opens for a cooldown window, the platform runs entirely
 * from the in-memory store, and one explanatory warning is logged rather than
 * one per query.
 */
const BREAKER_COOLDOWN_MS = 30_000;
let breakerOpenUntil = 0;
let hasWarnedAboutFallback = false;

/** Prisma codes meaning "the database is not usable", as opposed to a bad query. */
const UNAVAILABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1017", "P2021", "P2022"]);

function isDatabaseUnavailable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code && UNAVAILABLE_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /reach database server|does not exist|Connection refused|ECONNREFUSED/i.test(message);
}

/** Runs `fn` against PostgreSQL, falling back to the in-memory store on any failure. */
async function tryPrisma<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!prisma || Date.now() < breakerOpenUntil) return fallback();

  try {
    return await fn();
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      if (!hasWarnedAboutFallback) {
        hasWarnedAboutFallback = true;
        console.warn(
          "[exam-fm] PostgreSQL is unavailable; running from the in-memory session store. " +
            "Set DATABASE_URL and run `npm run db:push` to persist exams."
        );
      }
    } else {
      console.error("[exam-fm] Database operation failed:", error);
    }
    return fallback();
  }
}

/**
 * A sitting is abandoned once the browser stops reporting in. Closing the tab
 * ends the exam; a reload does not, because the page resumes its heartbeat
 * within a second or two.
 */
function isAbandoned(session: ExamSessionData, now: number = Date.now()): boolean {
  if (session.status === "COMPLETED" || session.status === "ABANDONED") return false;
  const lastSeen = new Date(session.lastSeenAt ?? session.startTime).getTime();
  return now - lastSeen > ABANDON_AFTER_MS;
}

function seedOf(variables: unknown): string | null {
  if (!variables || typeof variables !== "object") return null;
  const seed = (variables as Record<string, unknown>)[SEED_VARIABLE_KEY];
  return typeof seed === "string" ? seed : null;
}

/**
 * Recovers the worked solution for a persisted question.
 *
 * Questions are generated from a seeded PRNG and the seed is stored alongside
 * the drawn parameters, so replaying the template reproduces the exact
 * derivation the candidate saw. The regenerated question text is compared with
 * the persisted text; if a template has been edited since the exam was taken
 * the replay is rejected and the template's reference solution is used instead.
 */
function recoverSolution(row: {
  templateId: string;
  renderedQuestion: string;
  variables: unknown;
}): {
  solutionSteps: string;
  objective: string;
  templateTitle: string;
  difficulty: DifficultyLevel;
  topics: SyllabusTopic[];
  steps: number;
} {
  const template = getTemplateById(row.templateId);
  if (!template) {
    return {
      solutionSteps: "A worked solution is unavailable because this question template was retired.",
      objective: "",
      templateTitle: row.templateId,
      difficulty: 2,
      topics: [],
      steps: 1,
    };
  }

  const metadata = {
    objective: template.objective,
    templateTitle: template.title,
    difficulty: template.difficulty,
    topics: template.topics,
    steps: template.steps,
  };

  const seed = seedOf(row.variables);
  if (seed) {
    const replay = template.generate(createRng(seed));
    if (replay.questionText === row.renderedQuestion) {
      return { solutionSteps: replay.solutionSteps, ...metadata };
    }
  }

  const reference = template.generate(createRng(template.id));
  return { solutionSteps: reference.solutionSteps, ...metadata };
}

export const examRepository = {
  /** Upserts a deterministic reference instance of every template. */
  async seedTemplates(): Promise<void> {
    await tryPrisma(
      async () => {
        for (const template of QUESTION_TEMPLATES) {
          const sample = template.generate(createRng(template.id));
          const row = {
            domain: template.domain,
            templateText: sample.questionText,
            solutionSteps: sample.solutionSteps,
            parameterSchema: sample.variables as object,
          };
          await prisma.questionTemplate.upsert({
            where: { id: template.id },
            update: row,
            create: { id: template.id, ...row },
          });
        }
      },
      () => undefined
    );
  },

  async createExamSession(userId: string = "candidate-1"): Promise<ExamSessionData> {
    const sessionId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const questions = examGenerator.generateFullExam({
      sessionId,
      totalQuestions: EXAM_TOTAL_QUESTIONS,
    });

    const session: ExamSessionData = {
      id: sessionId,
      userId,
      startTime: new Date().toISOString(),
      endTime: null,
      pausedTimeMs: 0,
      isPaused: false,
      lastPausedAt: null,
      lastSeenAt: new Date().toISOString(),
      durationSeconds: EXAM_DURATION_SECONDS,
      status: "IN_PROGRESS",
      questions,
    };

    // Starting a new exam retires any sitting this candidate left open, so an
    // old tab or a back button can never resume a stale paper.
    localStore.forEach((existing, id) => {
      if (
        existing.userId === userId &&
        (existing.status === "IN_PROGRESS" || existing.status === "PAUSED")
      ) {
        existing.status = "ABANDONED";
        localStore.set(id, existing);
      }
    });

    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await this.seedTemplates();
        await prisma.examSession.create({
          data: {
            id: sessionId,
            userId,
            startTime: new Date(session.startTime),
            pausedTimeMs: 0,
            isPaused: false,
            lastSeenAt: new Date(session.lastSeenAt),
            durationSeconds: EXAM_DURATION_SECONDS,
            status: "IN_PROGRESS",
            questions: {
              create: questions.map((question) => ({
                id: question.id,
                templateId: question.templateId,
                renderedQuestion: question.renderedQuestion,
                renderedOptions: question.renderedOptions as object,
                selectedOption: null,
                variables: question.variables as object,
                isCorrect: null,
              })),
            },
          },
        });
      },
      () => undefined
    );

    return session;
  },

  async getExamSession(sessionId: string): Promise<ExamSessionData | null> {
    return tryPrisma(
      async () => {
        const row = await prisma.examSession.findUnique({
          where: { id: sessionId },
          include: { questions: { include: { template: true } } },
        });
        if (!row) return localStore.get(sessionId) ?? null;

        const cached = localStore.get(sessionId);

        const questions: ExamQuestionData[] = row.questions.map((question: any) => {
          const cachedQuestion = cached?.questions.find((item) => item.id === question.id);
          const recovered = recoverSolution(question);

          return {
            id: question.id,
            examSessionId: question.examSessionId,
            templateId: question.templateId,
            templateTitle: recovered.templateTitle,
            objective: recovered.objective,
            difficulty: recovered.difficulty,
            topics: recovered.topics,
            steps: recovered.steps,
            domain: question.template.domain as TopicDomain,
            renderedQuestion: question.renderedQuestion,
            renderedOptions: question.renderedOptions,
            selectedOption: question.selectedOption,
            isFlagged: cachedQuestion?.isFlagged ?? false,
            variables: question.variables ?? {},
            isCorrect: question.isCorrect,
            solutionSteps: recovered.solutionSteps,
          };
        });

        // Questions are keyed `q_<sessionId>_<n>`; keep the sitting order stable.
        questions.sort((a, b) => {
          const indexOf = (id: string) => Number(id.split("_").pop() ?? 0);
          return indexOf(a.id) - indexOf(b.id);
        });

        const session: ExamSessionData = {
          id: row.id,
          userId: row.userId,
          startTime: row.startTime.toISOString(),
          endTime: row.endTime ? row.endTime.toISOString() : null,
          pausedTimeMs: row.pausedTimeMs,
          isPaused: row.isPaused,
          lastPausedAt: row.lastPausedAt ? row.lastPausedAt.toISOString() : null,
          lastSeenAt: (row.lastSeenAt ?? row.startTime).toISOString(),
          durationSeconds: row.durationSeconds,
          status: row.status as ExamSessionData["status"],
          questions,
        };

        localStore.set(sessionId, session);
        return this.expireIfAbandoned(session);
      },
      () => {
        const cached = localStore.get(sessionId);
        return cached ? this.expireIfAbandoned(cached) : null;
      }
    );
  },

  /** Marks a stale sitting abandoned and persists that, then returns it. */
  expireIfAbandoned(session: ExamSessionData): ExamSessionData {
    if (!isAbandoned(session)) return session;

    session.status = "ABANDONED";
    session.isPaused = false;
    localStore.set(session.id, session);

    void tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: session.id },
          data: { status: "ABANDONED", isPaused: false },
        });
      },
      () => undefined
    );

    return session;
  },

  /** Records that the exam page is still open. */
  async recordHeartbeat(sessionId: string): Promise<ExamSessionData | null> {
    const session = await this.getExamSession(sessionId);
    if (!session) return null;
    if (session.status !== "IN_PROGRESS" && session.status !== "PAUSED") return session;

    const now = new Date();
    session.lastSeenAt = now.toISOString();
    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: { lastSeenAt: now },
        });
      },
      () => undefined
    );

    return session;
  },

  /** Ends a sitting immediately, without grading it. */
  async abandonExam(sessionId: string): Promise<void> {
    const session = localStore.get(sessionId) ?? (await this.getExamSession(sessionId));
    if (!session) return;
    if (session.status === "COMPLETED") return;

    session.status = "ABANDONED";
    session.isPaused = false;
    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: { status: "ABANDONED", isPaused: false },
        });
      },
      () => undefined
    );
  },

  /**
   * Records a pause or resume.
   *
   * Pause accounting is timestamp-based: the moment of pausing is stored, and
   * on resume the elapsed wall-clock interval is added to `pausedTimeMs`. The
   * remaining time is therefore always derived from real clocks and survives a
   * page reload, a server restart or a candidate closing the laptop lid.
   */
  async updatePauseState(sessionId: string, isPaused: boolean): Promise<ExamSessionData> {
    const session = await this.getExamSession(sessionId);
    if (!session) throw new Error(`Exam session ${sessionId} not found`);
    if (session.status === "COMPLETED" || session.status === "ABANDONED") return session;

    const now = new Date();
    let pausedTimeMs = session.pausedTimeMs;
    let lastPausedAt: string | null = null;

    if (isPaused) {
      // Ignore a duplicate pause so a double-click cannot inflate paused time.
      lastPausedAt = session.lastPausedAt ?? now.toISOString();
    } else if (session.lastPausedAt) {
      pausedTimeMs += Math.max(0, now.getTime() - new Date(session.lastPausedAt).getTime());
    }

    session.isPaused = isPaused;
    session.pausedTimeMs = pausedTimeMs;
    session.lastPausedAt = lastPausedAt;
    session.status = isPaused ? "PAUSED" : "IN_PROGRESS";
    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: {
            isPaused,
            pausedTimeMs,
            lastPausedAt: lastPausedAt ? new Date(lastPausedAt) : null,
            status: session.status,
          },
        });
      },
      () => undefined
    );

    return session;
  },

  async updateQuestionAnswer(
    sessionId: string,
    questionId: string,
    selectedOption?: string | null,
    isFlagged?: boolean
  ): Promise<void> {
    const session = localStore.get(sessionId) ?? (await this.getExamSession(sessionId));
    if (session?.status === "COMPLETED" || session?.status === "ABANDONED") return;

    const question = session?.questions.find((item) => item.id === questionId);
    if (question) {
      if (selectedOption !== undefined) question.selectedOption = selectedOption;
      if (isFlagged !== undefined) question.isFlagged = isFlagged;
      if (session) localStore.set(sessionId, session);
    }

    if (selectedOption === undefined) return; // flagging is client state only

    await tryPrisma(
      async () => {
        await prisma.examQuestion.update({
          where: { id: questionId },
          data: { selectedOption },
        });
      },
      () => undefined
    );
  },

  /** Grades every question and closes the sitting. Safe to call more than once. */
  async completeExam(sessionId: string): Promise<ExamSessionData> {
    const session = await this.getExamSession(sessionId);
    if (!session) throw new Error(`Exam session ${sessionId} not found`);
    if (session.status === "COMPLETED" && session.endTime) return session;

    const endTime = new Date();

    // A pause that is still open when the exam is submitted must be closed out,
    // otherwise its elapsed time would be counted as active exam time.
    if (session.isPaused && session.lastPausedAt) {
      session.pausedTimeMs += Math.max(
        0,
        endTime.getTime() - new Date(session.lastPausedAt).getTime()
      );
    }

    for (const question of session.questions) {
      const correctOption = question.renderedOptions.find((option) => option.isCorrect);
      question.isCorrect =
        question.selectedOption !== null && question.selectedOption === correctOption?.key;
    }

    session.endTime = endTime.toISOString();
    session.status = "COMPLETED";
    session.isPaused = false;
    session.lastPausedAt = null;
    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.$transaction([
          ...session.questions.map((question) =>
            prisma.examQuestion.update({
              where: { id: question.id },
              data: { isCorrect: question.isCorrect },
            })
          ),
          prisma.examSession.update({
            where: { id: sessionId },
            data: {
              endTime,
              status: "COMPLETED",
              isPaused: false,
              lastPausedAt: null,
              pausedTimeMs: session.pausedTimeMs,
            },
          }),
        ]);
      },
      () => undefined
    );

    return session;
  },

  /** Builds the diagnostic report from an already-graded session. */
  buildReview(session: ExamSessionData): ExamReviewData {
    const totals: Record<TopicDomain, { total: number; correct: number }> = DOMAIN_ORDER.reduce(
      (acc, domain) => {
        acc[domain] = { total: 0, correct: 0 };
        return acc;
      },
      {} as Record<TopicDomain, { total: number; correct: number }>
    );

    let correctCount = 0;
    let unansweredCount = 0;

    for (const question of session.questions) {
      if (question.selectedOption === null) unansweredCount += 1;
      if (question.isCorrect) correctCount += 1;
      const bucket = totals[question.domain];
      if (bucket) {
        bucket.total += 1;
        if (question.isCorrect) bucket.correct += 1;
      }
    }

    const domainMetrics = DOMAIN_ORDER.reduce(
      (acc, domain) => {
        const bucket = totals[domain];
        const percentage = bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0;
        acc[domain] = {
          domain,
          label: DOMAIN_LABELS[domain],
          total: bucket.total,
          correct: bucket.correct,
          percentage,
          status: proficiencyStatus(percentage),
        };
        return acc;
      },
      {} as Record<TopicDomain, DomainMetric>
    );

    const totalQuestions = session.questions.length;
    const endTime = session.endTime ?? new Date().toISOString();
    const grossElapsedMs = new Date(endTime).getTime() - new Date(session.startTime).getTime();
    const activeElapsedMs = Math.max(0, grossElapsedMs - session.pausedTimeMs);

    return {
      sessionId: session.id,
      userId: session.userId,
      startTime: session.startTime,
      endTime,
      totalQuestions,
      correctCount,
      unansweredCount,
      scorePercent: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
      isPassed: correctCount >= PASS_MARK,
      totalTimeSpentSeconds: Math.floor(activeElapsedMs / 1000),
      totalPausedTimeSeconds: Math.floor(session.pausedTimeMs / 1000),
      domainMetrics,
      questions: session.questions,
    };
  },

  /** Closes the sitting and returns the diagnostic report. */
  async submitExam(sessionId: string): Promise<ExamReviewData> {
    const session = await this.completeExam(sessionId);
    return this.buildReview(session);
  },

  /**
   * Returns the report for a sitting, grading it first only if it is still open.
   * Revisiting the review page therefore never restarts the clock on a
   * completed exam.
   */
  async getReviewData(sessionId: string): Promise<ExamReviewData | null> {
    const session = await this.getExamSession(sessionId);
    if (!session) return null;
    // An abandoned sitting is never graded; there is no report for it.
    if (session.status === "ABANDONED") return null;
    if (session.status !== "COMPLETED" || !session.endTime) {
      return this.submitExam(sessionId);
    }
    return this.buildReview(session);
  },
};
