import { NextResponse } from "next/server";

import { getDashboard, resetHistory } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDashboard());
}

/** Erases all history. Requires an explicit confirmation token so a stray request cannot wipe it. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "ERASE_ALL_HISTORY") return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  await resetHistory();
  return NextResponse.json({ ok: true });
}
