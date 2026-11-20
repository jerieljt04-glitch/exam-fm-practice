import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { error, parseBody } from "@/lib/api/http";
import { ConceptQuestionBody } from "@/lib/api/schemas";
import { buildChoiceQuestion } from "@/lib/engine/assemble";
import { matchesFocus } from "@/lib/engine/session";
import { CONCEPT_TEMPLATES } from "@/lib/engine/templates";
import type { Difficulty } from "@/lib/engine/types";
import { randomIndex, shuffle } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * One Concept Practice question for study with instant feedback. The full
 * instance (answer and explanation included) is returned: the study page
 * reveals it only after an option is chosen, and these answers never count
 * toward the closed-book concept mastery measured by exam-style sessions.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, ConceptQuestionBody, { optional: true });
  if (!parsed.ok) return parsed.response;
  const { topic, focus = "mixed", level: rawLevel, exclude = [] } = parsed.data;
  const level = typeof rawLevel === "number" ? (rawLevel as Difficulty) : null;
  const recent = new Set(exclude);

  const pool = CONCEPT_TEMPLATES.filter((t) => (!topic || t.topic === topic) && matchesFocus(t, focus) && (!level || t.levels.includes(level)));
  if (!pool.length) return error(404, "No concept questions match these filters.");
  const fresh = pool.filter((t) => !recent.has(t.id));
  const candidates = shuffle(fresh.length ? fresh : pool);

  for (const template of candidates.slice(0, 6)) {
    const lvl = level ?? template.levels[randomIndex(template.levels.length)];
    const { instance } = buildChoiceQuestion(template, lvl, randomUUID());
    if (instance) return NextResponse.json({ instance });
  }
  return error(500, "Could not generate a valid question; try again.");
}
