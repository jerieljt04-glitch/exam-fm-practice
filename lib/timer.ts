/**
 * Session clock rules, kept pure so they can be tested without a browser.
 *
 * Time is counted only while a session page is open: the page reports elapsed
 * seconds as it autosaves. If the browser closes by accident, the clock stops
 * and resumes from the last saved value when the session is reopened.
 */

/** Seconds of slack allowed beyond wall-clock time between two saves. */
export const SAVE_SLACK_SECONDS = 5;

export function remainingSeconds(durationSeconds: number | null, elapsedSeconds: number): number | null {
  if (durationSeconds === null) return null;
  return Math.max(0, durationSeconds - elapsedSeconds);
}

export function isExpired(durationSeconds: number | null, elapsedSeconds: number): boolean {
  return durationSeconds !== null && elapsedSeconds >= durationSeconds;
}

/**
 * The elapsed time to store when a client reports `reported`: never less than
 * what is already stored, never more than wall-clock time since the last save
 * allows, and never beyond the session's duration.
 */
export function acceptElapsed(
  stored: number,
  reported: number,
  secondsSinceLastSave: number,
  durationSeconds: number | null
): number {
  const ceiling = stored + Math.max(0, secondsSinceLastSave) + SAVE_SLACK_SECONDS;
  let next = Math.max(stored, Math.min(Math.floor(reported), ceiling));
  if (durationSeconds !== null) next = Math.min(next, durationSeconds);
  return next;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
