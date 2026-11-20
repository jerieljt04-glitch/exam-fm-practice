import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { ProgressBody } from "@/lib/api/schemas";
import { saveProgress, submitSession } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const parsed = await parseBody(request, ProgressBody, { optional: true });
  if (!parsed.ok) return parsed.response;
  try {
    const patch = parsed.data;
    if (patch.answers?.length || patch.elapsedSeconds !== undefined) await saveProgress(params.id, patch);
    await submitSession(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fromError(e);
  }
}
