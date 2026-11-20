import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { StudyReviewBody } from "@/lib/api/schemas";
import { reviewCard } from "@/lib/server/study";
import type { Rating } from "@/lib/study/schedule";

export const dynamic = "force-dynamic";

/** Records a flashcard rating and returns the card's next schedule. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, StudyReviewBody);
  if (!parsed.ok) return parsed.response;
  try {
    const next = await reviewCard(parsed.data.cardId, parsed.data.rating as Rating);
    return NextResponse.json({ ...next, dueAt: next.dueAt.toISOString() });
  } catch (e) {
    return fromError(e);
  }
}
