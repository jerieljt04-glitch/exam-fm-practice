import { NextResponse } from "next/server";
import { examRepository } from "@/lib/db";
import { DEFAULT_DIFFICULTIES, DOMAIN_ORDER } from "@/lib/exam-config";
import type { DifficultyLevel } from "@/lib/exam-config";
import type { ExamMode, TopicDomain } from "@/lib/types/exam";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as {
      userId?: string;
      mode?: ExamMode;
      totalQuestions?: number;
      domains?: TopicDomain[];
      difficulties?: DifficultyLevel[];
      isTimed?: boolean;
      templateIds?: string[];
    };
    const userId = typeof body.userId === "string" && body.userId ? body.userId : "candidate-1";
    const mode: ExamMode = ["EXAM", "PRACTICE", "MISTAKES"].includes(body.mode ?? "")
      ? body.mode!
      : "EXAM";
    const domains = Array.isArray(body.domains)
      ? body.domains.filter((domain): domain is TopicDomain => DOMAIN_ORDER.includes(domain))
      : undefined;
    const difficulties = Array.isArray(body.difficulties)
      ? body.difficulties.filter((level): level is DifficultyLevel =>
          DEFAULT_DIFFICULTIES.includes(level)
        )
      : undefined;

    const session = await examRepository.createExamSession(userId, {
      mode,
      totalQuestions: body.totalQuestions,
      domains,
      difficulties,
      isTimed: body.isTimed,
      templateIds: Array.isArray(body.templateIds)
        ? body.templateIds.filter((id): id is string => typeof id === "string").slice(0, 30)
        : undefined,
    });
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error starting exam session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate a new exam" },
      { status: 500 }
    );
  }
}
