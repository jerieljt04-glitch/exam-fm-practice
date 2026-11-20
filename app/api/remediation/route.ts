import { NextResponse } from "next/server";

import { error, fromError } from "@/lib/api/http";
import { createRemediationSession } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const id = await createRemediationSession();
    if (!id) return error(409, "Nothing is due for remediation.");
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
