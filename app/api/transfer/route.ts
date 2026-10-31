import { NextResponse } from "next/server";

import { createTransferSession } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { questionId?: string };
  const id = body.questionId ? await createTransferSession(body.questionId) : null;
  if (!id) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  return NextResponse.json({ id });
}
