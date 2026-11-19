/**
 * Spaced-repetition scheduling for study flashcards (a small SM-2 variant).
 *
 * After each review the learner rates recall: again (forgot), hard, good or
 * easy. A card's interval grows by its ease factor on each good review and
 * shrinks back to a short relearning step when it is forgotten. Pure and
 * framework-free so it can be tested directly.
 */

export type Rating = "again" | "hard" | "good" | "easy";
export const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export const RATING_LABELS: Record<Rating, string> = {
  again: "Again — I didn't know it",
  hard: "Hard — got it with effort",
  good: "Good — recalled it",
  easy: "Easy — instant",
};

export interface CardSchedule {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: Date;
}

export const NEW_CARD: Omit<CardSchedule, "dueAt"> = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

const MIN_EASE = 1.3;
const MAX_INTERVAL = 180;
const MINUTE = 60_000;
const DAY = 86_400_000;
/** A forgotten card comes back after ten minutes (and again later in the same sitting). */
const RELEARN_MINUTES = 10;

/** The next schedule after a review at `now`. */
export function nextSchedule(card: Omit<CardSchedule, "dueAt">, rating: Rating, now: Date = new Date()): CardSchedule {
  let { ease, intervalDays, reps, lapses } = card;
  if (rating === "again") {
    lapses += reps > 0 ? 1 : 0;
    reps = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    return { ease, intervalDays: 0, reps, lapses, dueAt: new Date(now.getTime() + RELEARN_MINUTES * MINUTE) };
  }
  if (reps === 0) {
    intervalDays = rating === "hard" ? 0.5 : rating === "good" ? 1 : 4;
  } else if (reps === 1 && intervalDays < 3) {
    intervalDays = rating === "hard" ? Math.max(1, intervalDays * 1.2) : rating === "good" ? 3 : 6;
  } else {
    const factor = rating === "hard" ? 1.2 : rating === "good" ? ease : ease * 1.3;
    intervalDays = Math.max(intervalDays + (rating === "hard" ? 0 : 1), intervalDays * factor);
  }
  if (rating === "hard") ease = Math.max(MIN_EASE, ease - 0.15);
  if (rating === "easy") ease += 0.15;
  intervalDays = Math.min(MAX_INTERVAL, intervalDays);
  reps += 1;
  return { ease, intervalDays, reps, lapses, dueAt: new Date(now.getTime() + intervalDays * DAY) };
}

export type CardStage = "new" | "learning" | "young" | "mature";

export const STAGE_LABELS: Record<CardStage, string> = {
  new: "New",
  learning: "Learning",
  young: "Young",
  mature: "Mature",
};

/** new: never reviewed · learning: interval under a day · young: under three weeks · mature: three weeks or more. */
export function cardStage(state: { reps: number; intervalDays: number } | undefined | null): CardStage {
  if (!state) return "new";
  if (state.reps === 0 || state.intervalDays < 1) return "learning";
  return state.intervalDays < 21 ? "young" : "mature";
}

/** Human description of an interval, for the rating buttons. */
export function describeInterval(days: number): string {
  if (days <= 0) return `${RELEARN_MINUTES} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  return `${Math.round(days / 30)} mo`;
}
