/**
 * Solution-approach fingerprints.
 *
 * Two questions that are solved by the same sequence of formulas, used the
 * same way (rearranged or not) with the same algebraic methods, are the same
 * exercise with different numbers — whatever their wording. The session
 * builder uses these fingerprints to keep an exam from repeating a solution
 * path, and to steer each new exam away from the paths the last few sessions
 * already used.
 */
import type { FormulaChain, QuestionInstance } from "./types";

/** The fingerprint of a solution plan: formulas in order (with how each is used) plus the methods. */
export function chainSignature(chain: FormulaChain): string {
  const steps = chain.steps.map((s) => `${s.formula}${s.rearranged ? "'" : ""}${s.derived ? "*" : ""}`).join(">");
  const methods = [...new Set(chain.methods)].sort().join(",");
  return `${steps}|${methods}`;
}

/**
 * The approach a stored question used. Calculation items are fingerprinted by
 * their formula chain; items without one (concept questions) by template and
 * presentation, which is the closest thing they have to a solution path.
 */
export function approachOf(question: Pick<QuestionInstance, "templateId" | "chain"> & { kind?: string; variant?: number }): string {
  if (question.chain && question.chain.steps.length) return chainSignature(question.chain);
  return `template:${question.templateId}|${question.kind === "choice" ? question.variant ?? 0 : 0}`;
}

/** How strongly a session `k` sessions ago (0 = the most recent) still counts as "recent". */
export const RECENCY_WEIGHTS = [1, 0.8, 0.6, 0.45, 0.3, 0.2] as const;

/**
 * Recency weights by approach and by template from a history of attempts in
 * chronological order. The most recent session weighs 1; older sessions fade.
 */
export function recencyMaps<T extends { sessionId: string; instance: QuestionInstance }>(
  history: readonly T[]
): { approaches: Map<string, number>; templates: Map<string, number> } {
  const sessions = [...new Set(history.map((a) => a.sessionId))].reverse().slice(0, RECENCY_WEIGHTS.length);
  const weightOf = new Map(sessions.map((id, k) => [id, RECENCY_WEIGHTS[k]]));
  const approaches = new Map<string, number>();
  const templates = new Map<string, number>();
  const raise = (map: Map<string, number>, key: string, w: number) => map.set(key, Math.max(map.get(key) ?? 0, w));
  for (const attempt of history) {
    const w = weightOf.get(attempt.sessionId);
    if (w === undefined) continue;
    raise(approaches, approachOf(attempt.instance), w);
    raise(templates, attempt.instance.templateId, w);
  }
  return { approaches, templates };
}
