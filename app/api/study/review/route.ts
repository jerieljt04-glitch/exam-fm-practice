import { NextResponse } from "next/server";

import { reviewCard } from "@/lib/server/study";
import { RATINGS, type Rating } from "@/lib/study/schedule";

export const dynamic = "force-dynamic";

/** Records a flashcard rating and returns the card's next schedule. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { cardId?: unknown; rating?: unknown };
  if (typeof body.cardId !== "string" || !RATINGS.includes(body.rating as Rating)) {
    return NextResponse.json({ error: "cardId and a rating (again, hard, good, easy) are required." }, { status: 400 });
  }
  try {
    const next = await reviewCard(body.cardId, body.rating as Rating);
    return NextResponse.json({ ...next, dueAt: next.dueAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
