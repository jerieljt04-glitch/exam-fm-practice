import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await examRepository.getExamSession(params.id);
    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Submit if not completed, or compile review
    const reviewData = await examRepository.submitExam(params.id);
    return NextResponse.json({ success: true, review: reviewData });
  } catch (error: any) {
    console.error("Error fetching review data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch review data" },
      { status: 500 }
    );
  }
}
