import Anthropic from "@anthropic-ai/sdk";

import { tokenizeMath } from "../math/markup";
import { numbersIn } from "../analysis/attempts";
import { typesetError } from "../engine/validate";
import type { QuestionInstance } from "../engine/types";

/**
 * Optional language-model rewording of question stems.
 *
 * The model is never asked to compute anything and never sees the answer. It
 * may only re-word the scenario so the same mathematics appears in a less
 * familiar form. A rewording is accepted only if it keeps every number and
 * every mathematical expression of the validated original, introduces no new
 * numbers, reveals no method or topic, and still typesets — otherwise the
 * validated original is kept. Without an API key the application uses its
 * built-in, fully validated bank unchanged.
 *
 * The key is read on the server only (ANTHROPIC_API_KEY); it never reaches the
 * browser.
 */

export const LLM_MODEL = process.env.EXAM_FM_LLM_MODEL || "claude-opus-5-5";

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.EXAM_FM_LLM !== "off";
}

const FORBIDDEN = /\b(formula|annuity-immediate|annuity-due|hint|topic|chapter|amortization schedule|use the|duration|convexity|immuniz)/i;

const SYSTEM = `You rewrite actuarial examination questions (SOA Exam FM) so that the same mathematics appears in a fresh, realistic context.

Rules:
- Keep every number exactly as written, and do not add any new numbers.
- Copy every piece of text between $ signs exactly, character for character.
- Keep the final instruction sentence's meaning (what must be calculated) unchanged.
- Do not name the topic, the method, or any formula. Do not add hints.
- Keep it concise and unambiguous, in the plain declarative style of SOA questions.
- Reply with the rewritten question only.`;

export interface RewordResult {
  stem: string;
  accepted: boolean;
  reason?: string;
}

function mathSegments(markup: string): string[] {
  return tokenizeMath(markup)
    .filter((s) => s.type !== "text")
    .map((s) => s.value)
    .sort();
}

function sortedNumbers(markup: string): number[] {
  const textOnly = tokenizeMath(markup)
    .filter((s) => s.type === "text")
    .map((s) => s.value)
    .join(" ");
  return numbersIn(textOnly).map(Math.abs).sort((a, b) => a - b);
}

/** Checks a candidate rewording against the validated original. */
export function checkRewording(original: string, candidate: string): string | null {
  const text = candidate.trim();
  if (text.length < original.length * 0.5 || text.length > original.length * 2) return "length changed too much";
  const a = sortedNumbers(original);
  const b = sortedNumbers(text);
  if (a.length !== b.length || a.some((n, i) => Math.abs(n - b[i]) > 1e-9)) return "numbers changed";
  const ma = mathSegments(original);
  const mb = mathSegments(text);
  if (ma.length !== mb.length || ma.some((m, i) => m !== mb[i])) return "mathematical expressions changed";
  if (FORBIDDEN.test(text) && !FORBIDDEN.test(original)) return "method or topic revealed";
  if (typesetError(text)) return "does not typeset";
  return null;
}

export async function rewordStem(question: QuestionInstance): Promise<RewordResult> {
  if (!llmConfigured()) return { stem: question.stem, accepted: false, reason: "not configured" };
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: LLM_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: question.stem }],
    });
    if (response.stop_reason === "refusal") return { stem: question.stem, accepted: false, reason: "refused" };
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    const problem = checkRewording(question.stem, text);
    if (problem) return { stem: question.stem, accepted: false, reason: problem };
    return { stem: text, accepted: true };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return { stem: question.stem, accepted: false, reason: `API error ${error.status ?? ""}`.trim() };
    }
    return { stem: question.stem, accepted: false, reason: "request failed" };
  }
}
