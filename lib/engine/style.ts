/**
 * Question-style mix per session mode — the share of items whose answers are
 * not a single calculated number (conceptual, symbolic, equation-selection,
 * statement, ordered-pair, allocation and table-driven items).
 *
 * This is a configurable starting point modelled loosely on the range of item
 * types in the SOA's published Exam FM sample questions. It is NOT an official
 * SOA distribution; the SOA does not publish one. Change it here — the session
 * builder and its tests read nothing else.
 */
import type { SessionMode } from "./session";

export interface StyleMix {
  /** Lowest and highest share of non-numerical-answer items, and the share aimed for. */
  min: number;
  max: number;
  target: number;
}

export const STYLE_MIX: Partial<Record<SessionMode, StyleMix>> = {
  EXAM: { min: 0.2, max: 0.3, target: 0.25 },
  DIAGNOSTIC: { min: 0.2, max: 0.3, target: 0.25 },
  CHALLENGE: { min: 0.1, max: 0.3, target: 0.2 },
};

/** Whole number of non-numerical items for a session, inside the band whenever the band allows one. */
export function nonNumericCount(count: number, mix: StyleMix): number {
  const target = Math.round(count * mix.target);
  const lo = Math.ceil(count * mix.min - 1e-9);
  const hi = Math.floor(count * mix.max + 1e-9);
  if (lo > hi) return Math.max(0, Math.min(count, target));
  return Math.max(lo, Math.min(hi, target));
}
