import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await examRepository.getExamSession(params.id);
    if (!session) {
      return NextResponse.json({ success: false, error: "Exam session not found" }, { status: 404 });
    }

    const review = await examRepository.submitExam(params.id);
    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Error submitting exam:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit the exam" },
      { status: 500 }
    );
  }
}
