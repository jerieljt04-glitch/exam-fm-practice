import { NextResponse } from "next/server";

import { getReport } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const report = await getReport(params.id);
  if (!report) return NextResponse.json({ error: "No report: the session is missing or still active." }, { status: 404 });
  return NextResponse.json(report);
}
