import { NextResponse } from "next/server";

import { fromError, parseBody } from "@/lib/api/http";
import { StudyAttemptBody } from "@/lib/api/schemas";
import { recordStudyAttempt } from "@/lib/server/study";

export const dynamic = "force-dynamic";

/** Records one answer given in a study tool (quick check, formula drill, concept question). */
export async function POST(request: Request) {
  const parsed = await parseBody(request, StudyAttemptBody);
  if (!parsed.ok) return parsed.response;
  try {
    await recordStudyAttempt(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
