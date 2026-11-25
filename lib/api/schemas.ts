/**
 * Request schemas shared by the API routes (and usable by clients): every
 * body is parsed here, so bad input gets a 400 with the reason instead of a
 * silent default or a misleading 404.
 */
import { z } from "zod";

import { CONFIDENCE_LEVELS, METHODS } from "../engine/skills";
import { RATINGS } from "../study/schedule";
import { TOPIC_ORDER } from "../syllabus";

const topic = z.enum(TOPIC_ORDER as unknown as [string, ...string[]]);
const percent = z.number().min(0).max(100);

export const CreateSessionBody = z
  .object({
    mode: z.enum(["DIAGNOSTIC", "EXAM", "CHALLENGE", "PRACTICE", "CONCEPT"]),
    count: z.number().int().min(1).max(60).optional(),
    difficulty: z.union([z.literal("mixed"), z.literal("hard"), z.literal("elite"), z.coerce.number().int().min(1).max(4)]).optional(),
    timed: z.boolean().optional(),
    aiWording: z.boolean().optional(),
    reference: z.enum(["integration", "supported"]).optional(),
    integrationMix: z.object({ single: percent, pair: percent, multi: percent, reconstruct: percent }).partial().optional(),
    focus: z.enum(["mixed", "definitions", "equations", "statements", "errors"]).optional(),
    topic: topic.nullable().optional().or(z.literal("")),
  })
  .strict();
export type CreateSessionBody = z.infer<typeof CreateSessionBody>;

const AnswerPatch = z
  .object({
    instanceId: z.string().min(1).max(100),
    selectedKey: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
    confidence: z.enum(CONFIDENCE_LEVELS as unknown as [string, ...string[]]).nullable().optional(),
    method: z.enum(METHODS.map((m) => m.id) as [string, ...string[]]).nullable().optional(),
    methodNote: z.string().max(500).nullable().optional(),
    working: z.string().max(20000).optional(),
    flagged: z.boolean().optional(),
    addSeconds: z.number().min(0).max(86400).optional(),
  })
  .strict();

export const ProgressBody = z
  .object({
    elapsedSeconds: z.number().min(0).max(7 * 86400).optional(),
    currentIndex: z.number().int().min(0).max(200).optional(),
    answers: z.array(AnswerPatch).max(200).optional(),
  })
  .strict();
export type ProgressBody = z.infer<typeof ProgressBody>;

export const TransferBody = z.object({ questionId: z.string().min(1).max(100) }).strict();

export const StudyAttemptBody = z
  .object({
    kind: z.enum(["QUICK_CHECK", "DRILL", "CONCEPT_QUESTION", "STRATEGY"]),
    itemId: z.string().min(1).max(200),
    topic,
    correct: z.boolean(),
    detail: z.string().transform((s) => s.slice(0, 200)).optional(),
  })
  .strict();

export const StudyReviewBody = z.object({ cardId: z.string().min(1).max(200), rating: z.enum(RATINGS as unknown as [string, ...string[]]) }).strict();

export const ConceptQuestionBody = z
  .object({
    topic: topic.nullable().optional().or(z.literal("")),
    focus: z.enum(["mixed", "definitions", "equations", "statements", "errors"]).optional(),
    level: z.union([z.literal("mixed"), z.coerce.number().int().min(1).max(3)]).nullable().optional(),
    exclude: z.array(z.string().max(200)).max(500).optional(),
  })
  .strict();

export const ResetHistoryBody = z.object({ confirm: z.literal("ERASE_ALL_HISTORY") }).strict();

const row = z.record(z.unknown());
export const RestoreBody = z
  .object({
    confirm: z.literal("REPLACE_ALL_HISTORY"),
    backup: z.object({
      format: z.literal("exam-fm-practice-backup"),
      version: z.literal(1),
      exportedAt: z.string(),
      sessions: z.array(row),
      questions: z.array(row),
      remediation: z.array(row),
      cards: z.array(row),
      studyAttempts: z.array(row),
    }),
  })
  .strict();
