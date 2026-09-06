import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || "candidate-1";

    const session = await examRepository.createExamSession(userId);
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error("Error starting exam session:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start exam session" },
      { status: 500 }
    );
  }
}
