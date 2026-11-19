import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { buildChoiceQuestion } from "@/lib/engine/assemble";
import { CONCEPT_FOCUS_LABELS, matchesFocus, type ConceptFocus } from "@/lib/engine/session";
import { CONCEPT_TEMPLATES } from "@/lib/engine/templates";
import type { Difficulty } from "@/lib/engine/types";
import { TOPIC_ORDER, type TopicId } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

/**
 * One Concept Practice question for study with instant feedback. The full
 * instance (answer and explanation included) is returned: the study page
 * reveals it only after an option is chosen, and these answers never count
 * toward the closed-book concept mastery measured by exam-style sessions.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const topic = TOPIC_ORDER.includes(body.topic as TopicId) ? (body.topic as TopicId) : null;
  const focus = (Object.keys(CONCEPT_FOCUS_LABELS) as ConceptFocus[]).includes(body.focus as ConceptFocus) ? (body.focus as ConceptFocus) : "mixed";
  const level = [1, 2, 3].includes(Number(body.level)) ? (Number(body.level) as Difficulty) : null;
  const recent = new Set(Array.isArray(body.exclude) ? body.exclude.filter((x): x is string => typeof x === "string") : []);

  const pool = CONCEPT_TEMPLATES.filter((t) => (!topic || t.topic === topic) && matchesFocus(t, focus) && (!level || t.levels.includes(level)));
  if (!pool.length) return NextResponse.json({ error: "No concept questions match these filters." }, { status: 404 });
  const fresh = pool.filter((t) => !recent.has(t.id));
  const candidates = [...(fresh.length ? fresh : pool)].sort(() => Math.random() - 0.5);

  for (const template of candidates.slice(0, 6)) {
    const lvl = level ?? template.levels[Math.floor(Math.random() * template.levels.length)];
    const { instance } = buildChoiceQuestion(template, lvl, randomUUID());
    if (instance) return NextResponse.json({ instance });
  }
  return NextResponse.json({ error: "Could not generate a valid question; try again." }, { status: 500 });
}
