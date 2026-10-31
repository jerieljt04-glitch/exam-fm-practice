import { NextResponse } from "next/server";

import { getDashboard, resetHistory } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDashboard());
}

export async function DELETE() {
  await resetHistory();
  return NextResponse.json({ ok: true });
}
