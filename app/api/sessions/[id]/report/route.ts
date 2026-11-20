import { NextResponse } from "next/server";

import { error } from "@/lib/api/http";
import { getReport, getSessionView } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const report = await getReport(params.id);
  if (report) return NextResponse.json(report);
  const view = await getSessionView(params.id);
  if (!view) return error(404, "Session not found.");
  return error(409, "The session is still active; submit it to see the report.");
}
