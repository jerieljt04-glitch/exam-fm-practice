import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewData = await examRepository.submitExam(params.id);
    return NextResponse.json({ success: true, review: reviewData });
  } catch (error: any) {
    console.error("Error submitting exam:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit exam" },
      { status: 500 }
    );
  }
}
