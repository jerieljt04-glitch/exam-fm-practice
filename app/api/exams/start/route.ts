import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as { userId?: string });
    const userId = typeof body.userId === "string" && body.userId ? body.userId : "candidate-1";

    const session = await examRepository.createExamSession(userId);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error starting exam session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate a new exam" },
      { status: 500 }
    );
  }
}
