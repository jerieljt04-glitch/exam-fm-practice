import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { RestoreBody } from "@/lib/api/schemas";
import { exportHistory, restoreHistory, saveSafetyCopy, type HistoryBackup } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/** Downloads a complete backup of your history as a JSON file. */
export async function GET() {
  try {
    const backup = await exportHistory();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 1), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="exam-fm-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fromError(e);
  }
}

/** Replaces all history with a backup file. A copy of the current history is saved first. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, RestoreBody);
  if (!parsed.ok) return parsed.response;
  try {
    const safetyCopy = await saveSafetyCopy();
    const restored = await restoreHistory(parsed.data.backup as unknown as HistoryBackup);
    return NextResponse.json({ ok: true, ...restored, safetyCopy });
  } catch (e) {
    return fromError(e);
  }
}
