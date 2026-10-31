import { NextResponse } from "next/server";

import { getSessionView, saveProgress, type ProgressPatch } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const view = await getSessionView(params.id);
  if (!view) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json(view);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const patch = (await request.json().catch(() => ({}))) as ProgressPatch;
  try {
    return NextResponse.json(await saveProgress(params.id, patch));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}

/** sendBeacon on page close can only POST; treat it as a progress save. */
export const POST = PATCH;
