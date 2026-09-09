import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";
import { OPTION_KEYS } from "@/lib/exam-config";
import type { ConfidenceLevel } from "@/lib/types/exam";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await examRepository.getExamSession(params.id);
    if (!session) {
      return NextResponse.json({ success: false, error: "Exam session not found" }, { status: 404 });
    }
    if (session.status === "ABANDONED") {
      return NextResponse.json(
        { success: false, error: "This exam was closed and has ended" },
        { status: 410 }
      );
    }
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error fetching exam session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load the exam session" },
      { status: 500 }
    );
  }
}

type PatchBody =
  | { action: "TOGGLE_PAUSE"; isPaused: boolean }
  | { action: "SELECT_OPTION"; questionId: string; selectedOption: string | null }
  | { action: "TOGGLE_FLAG"; questionId: string; isFlagged: boolean }
  | {
      action: "UPDATE_META";
      questionId: string;
      confidence?: ConfidenceLevel | null;
      timeSpentSeconds?: number;
      calculatorUsed?: boolean;
    }
  | { action: "ABANDON" };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as PatchBody;

    switch (body.action) {
      case "TOGGLE_PAUSE": {
        if (typeof body.isPaused !== "boolean") {
          return NextResponse.json(
            { success: false, error: "isPaused must be a boolean" },
            { status: 400 }
          );
        }
        const session = await examRepository.updatePauseState(params.id, body.isPaused);
        return NextResponse.json({
          success: true,
          session: {
            id: session.id,
            isPaused: session.isPaused,
            pausedTimeMs: session.pausedTimeMs,
            status: session.status,
          },
        });
      }

      case "SELECT_OPTION": {
        const isValidKey =
          body.selectedOption === null ||
          (OPTION_KEYS as readonly string[]).includes(body.selectedOption);
        if (!body.questionId || !isValidKey) {
          return NextResponse.json(
            { success: false, error: "questionId and a selectedOption of A–E (or null) are required" },
            { status: 400 }
          );
        }
        await examRepository.updateQuestionAnswer(params.id, body.questionId, body.selectedOption);
        return NextResponse.json({ success: true });
      }

      case "TOGGLE_FLAG": {
        if (!body.questionId || typeof body.isFlagged !== "boolean") {
          return NextResponse.json(
            { success: false, error: "questionId and a boolean isFlagged are required" },
            { status: 400 }
          );
        }
        await examRepository.updateQuestionAnswer(
          params.id,
          body.questionId,
          undefined,
          body.isFlagged
        );
        return NextResponse.json({ success: true });
      }

      case "UPDATE_META": {
        const confidenceIsValid =
          body.confidence === undefined ||
          body.confidence === null ||
          ["SURE", "UNSURE", "GUESS"].includes(body.confidence);
        if (
          !body.questionId ||
          !confidenceIsValid ||
          (body.timeSpentSeconds !== undefined &&
            (!Number.isFinite(body.timeSpentSeconds) || body.timeSpentSeconds < 0)) ||
          (body.calculatorUsed !== undefined && typeof body.calculatorUsed !== "boolean")
        ) {
          return NextResponse.json(
            { success: false, error: "Invalid question study metadata" },
            { status: 400 }
          );
        }
        await examRepository.updateQuestionMeta(params.id, body.questionId, {
          confidence: body.confidence,
          timeSpentSeconds: body.timeSpentSeconds,
          calculatorUsed: body.calculatorUsed,
        });
        return NextResponse.json({ success: true });
      }


      case "ABANDON": {
        await examRepository.abandonExam(params.id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating exam session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update the exam session" },
      { status: 500 }
    );
  }
}
