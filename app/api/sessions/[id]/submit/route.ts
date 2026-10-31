import { NextResponse } from "next/server";

import { saveProgress, submitSession, type ProgressPatch } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const patch = (await request.json().catch(() => ({}))) as ProgressPatch;
  try {
    if (patch.answers?.length || patch.elapsedSeconds !== undefined) await saveProgress(params.id, patch);
    await submitSession(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
