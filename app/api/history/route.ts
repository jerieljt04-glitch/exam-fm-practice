import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { ResetHistoryBody } from "@/lib/api/schemas";
import { getDashboard, resetHistory } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getDashboard());
  } catch (e) {
    return fromError(e);
  }
}

/** Erases all history. Requires { "confirm": "ERASE_ALL_HISTORY" } so a stray request cannot wipe it. */
export async function DELETE(request: Request) {
  const parsed = await parseBody(request, ResetHistoryBody);
  if (!parsed.ok) return parsed.response;
  await resetHistory();
  return NextResponse.json({ ok: true });
}
