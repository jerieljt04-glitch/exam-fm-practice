import { prisma } from "./prisma";
import { examGenerator } from "./engine/generator";
import { QUESTION_TEMPLATES } from "./engine/templates";
import {
  ExamQuestionData,
  ExamReviewData,
  ExamSessionData,
  TopicDomain,
  DomainMetric,
} from "./types/exam";

// Global fallback in-memory store if PostgreSQL is unreachable in dev
declare global {
  var __examStore: Map<string, ExamSessionData> | undefined;
}

if (!globalThis.__examStore) {
  globalThis.__examStore = new Map<string, ExamSessionData>();
}

const localStore = globalThis.__examStore;

// Domain labels mapping
export const DOMAIN_LABELS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY: "Time Value of Money",
  ANNUITIES: "Annuities & Cash Flows",
  LOANS: "Loans & Amortization",
  BONDS: "Bonds & Financial Instruments",
  ALM_IMMUNIZATION: "ALM & Immunization",
};

/**
 * Checks if database is available or falls back cleanly
 */
async function tryPrisma<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!prisma) {
    return await fallback();
  }
  try {
    return await fn();
  } catch (error) {
    // Database connection or table unavailable, fall back smoothly
    return await fallback();
  }
}

export const examRepository = {
  /**
   * Initializes question templates in the database if using Prisma
   */
  async seedTemplates(): Promise<void> {
    await tryPrisma(
      async () => {
        for (const t of QUESTION_TEMPLATES) {
          const sample = t.generate();
          await prisma.questionTemplate.upsert({
            where: { id: t.id },
            update: {
              domain: t.domain,
              templateText: sample.questionText,
              solutionSteps: sample.solutionSteps,
              videoUrl: sample.videoUrl,
              parameterSchema: sample.variables,
            },
            create: {
              id: t.id,
              domain: t.domain,
              templateText: sample.questionText,
              solutionSteps: sample.solutionSteps,
              videoUrl: sample.videoUrl,
              parameterSchema: sample.variables,
            },
          });
        }
      },
      () => {
        // Fallback: templates are already stored in memory in QUESTION_TEMPLATES
      }
    );
  },

  /**
   * Creates a new 30-question CBT exam session
   */
  async createExamSession(userId: string = "candidate-1"): Promise<ExamSessionData> {
    const sessionId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const questions = examGenerator.generateFullExam({ sessionId, totalQuestions: 30 });

    const sessionData: ExamSessionData = {
      id: sessionId,
      userId,
      startTime: new Date().toISOString(),
      endTime: null,
      pausedTimeMs: 0,
      isPaused: false,
      lastPausedAt: null,
      durationSeconds: 9000, // 150 minutes
      status: "IN_PROGRESS",
      questions,
    };

    // Save to fallback memory store
    localStore.set(sessionId, sessionData);

    // Also persist to Prisma if database is connected
    await tryPrisma(
      async () => {
        await this.seedTemplates();
        await prisma.examSession.create({
          data: {
            id: sessionId,
            userId,
            startTime: new Date(sessionData.startTime),
            pausedTimeMs: 0,
            isPaused: false,
            durationSeconds: 9000,
            status: "IN_PROGRESS",
            questions: {
              create: questions.map((q) => ({
                id: q.id,
                templateId: q.templateId,
                renderedQuestion: q.renderedQuestion,
                renderedOptions: q.renderedOptions as any,
                selectedOption: null,
                variables: q.variables as any,
                isCorrect: null,
              })),
            },
          },
        });
      },
      () => {
        // Prisma failed, sessionData is already stored in memory
      }
    );

    return sessionData;
  },

  /**
   * Retrieves an exam session by ID
   */
  async getExamSession(sessionId: string): Promise<ExamSessionData | null> {
    return await tryPrisma(
      async () => {
        const session = await prisma.examSession.findUnique({
          where: { id: sessionId },
          include: {
            questions: {
              include: { template: true },
            },
          },
        });

        if (!session) return localStore.get(sessionId) || null;

        const memorySession = localStore.get(sessionId);

        const mappedQuestions: ExamQuestionData[] = session.questions.map((q: any) => {
          const memQ = memorySession?.questions.find((mq) => mq.id === q.id);
          return {
            id: q.id,
            examSessionId: q.examSessionId,
            templateId: q.templateId,
            domain: q.template.domain as TopicDomain,
            renderedQuestion: q.renderedQuestion,
            renderedOptions: q.renderedOptions as any,
            selectedOption: q.selectedOption,
            isFlagged: memQ?.isFlagged ?? false,
            variables: q.variables as any,
            isCorrect: q.isCorrect,
            solutionSteps: q.template.solutionSteps,
            videoUrl: q.template.videoUrl,
          };
        });

        return {
          id: session.id,
          userId: session.userId,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime ? session.endTime.toISOString() : null,
          pausedTimeMs: session.pausedTimeMs,
          isPaused: session.isPaused,
          lastPausedAt: session.lastPausedAt ? session.lastPausedAt.toISOString() : null,
          durationSeconds: session.durationSeconds,
          status: session.status as any,
          questions: mappedQuestions,
        };
      },
      () => {
        return localStore.get(sessionId) || null;
      }
    );
  },

  /**
   * Updates pause / resume state and elapsed pause time
   */
  async updatePauseState(sessionId: string, isPaused: boolean): Promise<ExamSessionData> {
    const session = await this.getExamSession(sessionId);
    if (!session) throw new Error("Session not found");

    const now = new Date();
    let updatedPausedTimeMs = session.pausedTimeMs;
    let lastPausedAt: string | null = null;

    if (isPaused) {
      // Transitioning to paused
      lastPausedAt = now.toISOString();
    } else {
      // Resuming from pause
      if (session.lastPausedAt) {
        const elapsed = now.getTime() - new Date(session.lastPausedAt).getTime();
        updatedPausedTimeMs += Math.max(0, elapsed);
      }
      lastPausedAt = null;
    }

    session.isPaused = isPaused;
    session.pausedTimeMs = updatedPausedTimeMs;
    session.lastPausedAt = lastPausedAt;
    session.status = isPaused ? "PAUSED" : "IN_PROGRESS";

    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: {
            isPaused,
            pausedTimeMs: updatedPausedTimeMs,
            lastPausedAt: lastPausedAt ? new Date(lastPausedAt) : null,
            status: session.status,
          },
        });
      },
      () => {}
    );

    return session;
  },

  /**
   * Records candidate answer selection and flag state
   */
  async updateQuestionAnswer(
    sessionId: string,
    questionId: string,
    selectedOption?: string | null,
    isFlagged?: boolean
  ): Promise<void> {
    const session = localStore.get(sessionId);
    if (session) {
      const q = session.questions.find((item) => item.id === questionId);
      if (q) {
        if (selectedOption !== undefined) q.selectedOption = selectedOption;
        if (isFlagged !== undefined) q.isFlagged = isFlagged;
      }
    }

    await tryPrisma(
      async () => {
        await prisma.examQuestion.update({
          where: { id: questionId },
          data: {
            selectedOption,
          },
        });
      },
      () => {}
    );
  },

  /**
   * Submits the exam, calculates grading and domain diagnostic analytics
   */
  async submitExam(sessionId: string): Promise<ExamReviewData> {
    const session = await this.getExamSession(sessionId);
    if (!session) throw new Error("Session not found");

    const endTime = new Date();
    session.endTime = endTime.toISOString();
    session.status = "COMPLETED";
    session.isPaused = false;

    let correctCount = 0;
    const domainCounts: Record<TopicDomain, { total: number; correct: number }> = {
      TIME_VALUE_OF_MONEY: { total: 0, correct: 0 },
      ANNUITIES: { total: 0, correct: 0 },
      LOANS: { total: 0, correct: 0 },
      BONDS: { total: 0, correct: 0 },
      ALM_IMMUNIZATION: { total: 0, correct: 0 },
    };

    // Grade each question
    for (const q of session.questions) {
      const correctOption = q.renderedOptions.find((opt) => opt.isCorrect);
      const isCorrect = q.selectedOption !== null && q.selectedOption === correctOption?.key;
      q.isCorrect = isCorrect;

      if (isCorrect) correctCount++;

      if (domainCounts[q.domain]) {
        domainCounts[q.domain].total += 1;
        if (isCorrect) domainCounts[q.domain].correct += 1;
      }

      await tryPrisma(
        async () => {
          await prisma.examQuestion.update({
            where: { id: q.id },
            data: { isCorrect },
          });
        },
        () => {}
      );
    }

    localStore.set(sessionId, session);

    await tryPrisma(
      async () => {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: {
            endTime,
            status: "COMPLETED",
            isPaused: false,
          },
        });
      },
      () => {}
    );

    const totalQuestions = session.questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const isPassed = correctCount >= 21; // SOA 70% passing threshold (21/30)

    const startTimestamp = new Date(session.startTime).getTime();
    const endTimestamp = endTime.getTime();
    const grossElapsedMs = endTimestamp - startTimestamp;
    const netElapsedMs = Math.max(0, grossElapsedMs - session.pausedTimeMs);

    const domainMetrics: Record<TopicDomain, DomainMetric> = {} as any;
    for (const d of Object.keys(domainCounts) as TopicDomain[]) {
      const item = domainCounts[d];
      const pct = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
      let status: DomainMetric["status"] = "MASTERED";
      if (pct < 50) status = "CRITICAL";
      else if (pct < 70) status = "NEEDS_IMPROVEMENT";
      else if (pct < 85) status = "ADEQUATE";

      domainMetrics[d] = {
        domain: d,
        label: DOMAIN_LABELS[d] || d,
        total: item.total,
        correct: item.correct,
        percentage: pct,
        status,
      };
    }

    return {
      sessionId,
      userId: session.userId,
      startTime: session.startTime,
      endTime: session.endTime,
      totalQuestions,
      correctCount,
      scorePercent,
      isPassed,
      totalTimeSpentSeconds: Math.floor(netElapsedMs / 1000),
      totalPausedTimeSeconds: Math.floor(session.pausedTimeMs / 1000),
      domainMetrics,
      questions: session.questions,
    };
  },
};
