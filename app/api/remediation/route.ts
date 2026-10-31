import { NextResponse } from "next/server";

import { createRemediationSession } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST() {
  const id = await createRemediationSession();
  if (!id) return NextResponse.json({ error: "Nothing is due for remediation." }, { status: 409 });
  return NextResponse.json({ id });
}
