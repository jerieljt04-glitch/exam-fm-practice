import { NextResponse } from "next/server";

import type { ConceptFocus, SessionMode } from "@/lib/engine/session";
import { createSession } from "@/lib/server/repository";
import { TOPIC_ORDER, type TopicId } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

const MODES: SessionMode[] = ["DIAGNOSTIC", "EXAM", "CHALLENGE", "PRACTICE", "CONCEPT"];
const FOCI: ConceptFocus[] = ["mixed", "definitions", "equations", "statements", "errors"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode as SessionMode;
  if (!MODES.includes(mode)) return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  try {
    const id = await createSession({
      mode,
      count: typeof body.count === "number" ? body.count : undefined,
      difficulty: body.difficulty === "mixed" ? "mixed" : body.difficulty ? (Number(body.difficulty) as 1 | 2 | 3) : undefined,
      timed: typeof body.timed === "boolean" ? body.timed : undefined,
      aiWording: Boolean(body.aiWording),
      reference: body.reference === "supported" || body.reference === "integration" ? body.reference : undefined,
      integrationMix: typeof body.integrationMix === "object" && body.integrationMix ? (body.integrationMix as never) : undefined,
      conceptFocus: FOCI.includes(body.focus as ConceptFocus) ? (body.focus as ConceptFocus) : undefined,
      topic: TOPIC_ORDER.includes(body.topic as TopicId) ? (body.topic as TopicId) : null,
    });
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
