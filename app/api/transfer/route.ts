import { NextResponse } from "next/server";

import { error, fromError, parseBody } from "@/lib/api/http";
import { TransferBody } from "@/lib/api/schemas";
import { createTransferSession } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseBody(request, TransferBody);
  if (!parsed.ok) return parsed.response;
  try {
    const id = await createTransferSession(parsed.data.questionId);
    if (!id) return error(404, "Question not found.");
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
