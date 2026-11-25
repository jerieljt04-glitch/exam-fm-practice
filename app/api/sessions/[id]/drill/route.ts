import { NextResponse } from "next/server";

import { fromError } from "@/lib/api/http";
import { createHardDrill } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

/** Starts a drill on the Challenge and Elite questions missed in a submitted session. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = await createHardDrill(params.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
