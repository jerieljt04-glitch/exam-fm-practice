import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { CreateSessionBody } from "@/lib/api/schemas";
import { createSession } from "@/lib/server/repository";
import type { TopicId } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseBody(request, CreateSessionBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    const id = await createSession({
      mode: body.mode,
      count: body.count,
      difficulty: body.difficulty === "mixed" || body.difficulty === "hard" || body.difficulty === "elite" ? body.difficulty : (body.difficulty as 1 | 2 | 3 | 4 | undefined),
      timed: body.timed,
      aiWording: Boolean(body.aiWording),
      reference: body.reference,
      integrationMix: body.integrationMix as never,
      conceptFocus: body.focus,
      topic: body.topic ? (body.topic as TopicId) : null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
