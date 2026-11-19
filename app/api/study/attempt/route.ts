import { NextResponse } from "next/server";

import { STUDY_KINDS, recordStudyAttempt, type StudyKind } from "@/lib/server/study";
import { TOPIC_ORDER, type TopicId } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

/** Records one answer given in a study tool (quick check, formula drill, concept question). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind as StudyKind;
  if (!STUDY_KINDS.includes(kind) || kind === "FLASHCARD" || typeof body.itemId !== "string" || typeof body.correct !== "boolean" || !TOPIC_ORDER.includes(body.topic as TopicId)) {
    return NextResponse.json({ error: "kind, itemId, topic and correct are required." }, { status: 400 });
  }
  await recordStudyAttempt({ kind, itemId: body.itemId, topic: body.topic as string, correct: body.correct, detail: typeof body.detail === "string" ? body.detail.slice(0, 200) : undefined });
  return NextResponse.json({ ok: true });
}
