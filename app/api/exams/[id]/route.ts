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
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error("Error fetching exam session:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "TOGGLE_PAUSE") {
      const { isPaused } = body;
      const updated = await examRepository.updatePauseState(params.id, isPaused);
      return NextResponse.json({ success: true, session: updated });
    }

    if (action === "SELECT_OPTION") {
      const { questionId, selectedOption } = body;
      await examRepository.updateQuestionAnswer(params.id, questionId, selectedOption);
      return NextResponse.json({ success: true });
    }

    if (action === "TOGGLE_FLAG") {
      const { questionId, isFlagged } = body;
      await examRepository.updateQuestionAnswer(params.id, questionId, undefined, isFlagged);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating exam session:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update session" },
      { status: 500 }
    );
  }
}
