import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const review = await examRepository.getReviewData(params.id);
    if (!review) {
      return NextResponse.json({ success: false, error: "Exam session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Error building review data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to build the review report" },
      { status: 500 }
    );
  }
}
