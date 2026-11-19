/**
 * Persistence for the study area: flashcard schedules and the answers given
 * in the study tools. Study answers are learning-with-feedback, so they are
 * kept apart from exam-style sessions and never count toward the formula,
 * concept or calculation mastery measured there.
 */
import { STUDY_CARD_BY_ID, STUDY_CARDS, type Deck } from "../study/cards";
import { DRILL_BY_ID } from "../study/drill";
import { NEW_CARD, cardStage, nextSchedule, type CardSchedule, type CardStage, type Rating } from "../study/schedule";
import { TOPIC_ORDER, type TopicId } from "../syllabus";
import { prisma } from "./db";

export type StudyKind = "FLASHCARD" | "QUICK_CHECK" | "DRILL" | "CONCEPT_QUESTION";
export const STUDY_KINDS: StudyKind[] = ["FLASHCARD", "QUICK_CHECK", "DRILL", "CONCEPT_QUESTION"];

/** Cards falling due within this window count as due now (a relearning step is ten minutes). */
export const LEARN_AHEAD_MS = 20 * 60_000;

export interface CardState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastRating: string | null;
  lastReviewedAt: string | null;
}

export async function cardStates(): Promise<Record<string, CardState>> {
  const rows = await prisma.studyCard.findMany();
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        ease: r.ease,
        intervalDays: r.intervalDays,
        reps: r.reps,
        lapses: r.lapses,
        dueAt: r.dueAt.toISOString(),
        lastRating: r.lastRating,
        lastReviewedAt: r.lastReviewedAt?.toISOString() ?? null,
      },
    ])
  );
}

export async function recordStudyAttempt(a: { kind: StudyKind; itemId: string; topic: string; correct: boolean; detail?: string }): Promise<void> {
  await prisma.studyAttempt.create({ data: { kind: a.kind, itemId: a.itemId, topic: a.topic, correct: a.correct, detail: a.detail ?? null } });
}

/** Applies a rating to a flashcard and stores its next schedule. */
export async function reviewCard(cardId: string, rating: Rating, now: Date = new Date()): Promise<CardSchedule> {
  const card = STUDY_CARD_BY_ID[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}.`);
  const existing = await prisma.studyCard.findUnique({ where: { id: cardId } });
  const next = nextSchedule(existing ?? NEW_CARD, rating, now);
  const data = { deck: card.deck, ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt, lastRating: rating, lastReviewedAt: now };
  await prisma.studyCard.upsert({ where: { id: cardId }, create: { id: cardId, ...data }, update: data });
  await recordStudyAttempt({ kind: "FLASHCARD", itemId: cardId, topic: card.topic, correct: rating !== "again", detail: rating });
  return next;
}

interface Tally {
  attempts: number;
  correct: number;
}

export interface StudyOverview {
  decks: Record<Deck, { total: number; reviewed: number; due: number; stages: Record<CardStage, number> }>;
  /** Formula cards most often forgotten. */
  troubleCards: Array<{ id: string; title: string; lapses: number }>;
  quickChecks: Tally & { byTopic: Record<TopicId, Tally>; missed: string[] };
  drill: Tally & { byTopic: Record<TopicId, Tally>; missed: string[]; troubleFormulas: Array<{ formula: string; misses: number }> };
  conceptQuestions: Tally & { byTopic: Record<TopicId, Tally> };
  reviewsLast7Days: number;
  /** Consecutive days, ending today or yesterday, with any study activity. */
  streakDays: number;
}

const emptyByTopic = (): Record<TopicId, Tally> => Object.fromEntries(TOPIC_ORDER.map((t) => [t, { attempts: 0, correct: 0 }])) as Record<TopicId, Tally>;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export async function studyOverview(now: Date = new Date()): Promise<StudyOverview> {
  const [rows, attempts] = await Promise.all([prisma.studyCard.findMany(), prisma.studyAttempt.findMany({ orderBy: { at: "asc" } })]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const horizon = now.getTime() + LEARN_AHEAD_MS;

  const decks = {} as StudyOverview["decks"];
  for (const deck of ["formulas", "concepts"] as Deck[]) {
    const cards = STUDY_CARDS.filter((c) => c.deck === deck && c.relevance !== "unclear");
    const stages: Record<CardStage, number> = { new: 0, learning: 0, young: 0, mature: 0 };
    let due = 0;
    let reviewed = 0;
    for (const c of cards) {
      const row = byId.get(c.id);
      stages[cardStage(row)] += 1;
      if (row) {
        reviewed += 1;
        if (row.dueAt.getTime() <= horizon) due += 1;
      }
    }
    decks[deck] = { total: cards.length, reviewed, due, stages };
  }

  const troubleCards = rows
    .filter((r) => r.lapses > 0 && STUDY_CARD_BY_ID[r.id])
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 8)
    .map((r) => ({ id: r.id, title: STUDY_CARD_BY_ID[r.id].title, lapses: r.lapses }));

  const tally = (kind: StudyKind) => {
    const list = attempts.filter((a) => a.kind === kind);
    const byTopic = emptyByTopic();
    const last = new Map<string, boolean>();
    for (const a of list) {
      const t = byTopic[a.topic as TopicId];
      if (t) {
        t.attempts += 1;
        if (a.correct) t.correct += 1;
      }
      last.set(a.itemId, a.correct);
    }
    return {
      attempts: list.length,
      correct: list.filter((a) => a.correct).length,
      byTopic,
      missed: [...last].filter(([, ok]) => !ok).map(([id]) => id),
      list,
    };
  };

  const qc = tally("QUICK_CHECK");
  const dr = tally("DRILL");
  const cq = tally("CONCEPT_QUESTION");

  const misses = new Map<string, number>();
  for (const a of dr.list) {
    if (a.correct) continue;
    const formula = DRILL_BY_ID[a.itemId]?.formula;
    if (formula) misses.set(formula, (misses.get(formula) ?? 0) + 1);
  }

  const weekAgo = now.getTime() - 7 * 86_400_000;
  const days = new Set(attempts.map((a) => dayKey(a.at)));
  let streakDays = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    decks,
    troubleCards,
    quickChecks: { attempts: qc.attempts, correct: qc.correct, byTopic: qc.byTopic, missed: qc.missed },
    drill: {
      attempts: dr.attempts,
      correct: dr.correct,
      byTopic: dr.byTopic,
      missed: dr.missed,
      troubleFormulas: [...misses].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([formula, n]) => ({ formula, misses: n })),
    },
    conceptQuestions: { attempts: cq.attempts, correct: cq.correct, byTopic: cq.byTopic },
    reviewsLast7Days: attempts.filter((a) => a.kind === "FLASHCARD" && a.at.getTime() >= weekAgo).length,
    streakDays,
  };
}

/** Ids whose most recent answer of this kind was wrong (for "review my misses"). */
export async function missedItems(kind: StudyKind): Promise<string[]> {
  const list = await prisma.studyAttempt.findMany({ where: { kind }, orderBy: { at: "asc" }, select: { itemId: true, correct: true } });
  const last = new Map<string, boolean>();
  for (const a of list) last.set(a.itemId, a.correct);
  return [...last].filter(([, ok]) => !ok).map(([id]) => id);
}
