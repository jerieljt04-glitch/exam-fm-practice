import { NextResponse } from "next/server";

import { error, fromError, parseBody } from "@/lib/api/http";
import { ProgressBody } from "@/lib/api/schemas";
import { getSessionView, saveProgress } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/** Reads a session. Never changes it: an expired session is reported as such and the client submits it. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const view = await getSessionView(params.id);
  if (!view) return error(404, "Session not found.");
  return NextResponse.json(view);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = await parseBody(request, ProgressBody, { optional: true });
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await saveProgress(params.id, parsed.data));
  } catch (e) {
    return fromError(e);
  }
}

/** sendBeacon on page close can only POST; treat it as a progress save. */
export const POST = PATCH;
