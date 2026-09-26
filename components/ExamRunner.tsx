"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calculator,
  Gauge,
  HelpCircle,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Send,
} from "lucide-react";

import { FormulaSheetModal } from "./FormulaSheetModal";
import { MathRenderer } from "./MathRenderer";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useExamTimer } from "@/hooks/useExamTimer";
import {
  DIFFICULTY_LABELS,
  DOMAIN_LABELS,
  OPTION_KEYS,
} from "@/lib/exam-config";
import type { ConfidenceLevel, ExamSessionData } from "@/lib/types/exam";
import { cn } from "@/lib/utils";

interface ExamRunnerProps {
  initialSession: ExamSessionData;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({ initialSession }) => {
  const router = useRouter();
  const [session, setSession] = useState<ExamSessionData>(initialSession);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showFormulaSheet, setShowFormulaSheet] = useState(false);
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);
  const [showPracticeSolution, setShowPracticeSolution] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalQuestions = session.questions.length;
  const currentQuestion = session.questions[currentIndex] ?? session.questions[0];
  const hasSubmittedRef = useRef(false);
  const questionSecondsRef = useRef<Record<string, number>>(
    Object.fromEntries(initialSession.questions.map((question) => [question.id, question.timeSpentSeconds ?? 0]))
  );
  const activeQuestionStartedAtRef = useRef(Date.now());
  const submitExamRef = useRef<() => void>(() => undefined);

  const patchSession = useCallback(
    async (body: Record<string, unknown>) => {
      const response = await fetch(`/api/exams/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    },
    [session.id]
  );

  const handlePauseSync = useCallback(
    async (isPaused: boolean) => {
      await patchSession({ action: "TOGGLE_PAUSE", isPaused });
    },
    [patchSession]
  );

  const handleTimeExpire = useCallback(() => {
    setShowSubmitDialog(false);
    setShowTimeUpDialog(true);
    submitExamRef.current();
  }, []);

  const {
    formattedTime,
    isPaused,
    isSyncing,
    elapsedPercent,
    togglePause,
    isWarning,
    isCritical,
    isExpired,
  } = useExamTimer({
    durationSeconds: session.durationSeconds,
    startTime: session.startTime,
    initialPausedTimeMs: session.pausedTimeMs,
    initialIsPaused: session.isPaused,
    initialLastPausedAt: session.lastPausedAt,
    onTimeExpire: handleTimeExpire,
    onPauseToggle: handlePauseSync,
    enabled: session.isTimed,
  });

  const interactionLocked = isPaused || isExpired || isSubmitting;

  const updateQuestion = useCallback(
    (index: number, patch: Partial<ExamSessionData["questions"][number]>) => {
      setSession((previous) => {
        const questions = [...previous.questions];
        questions[index] = { ...questions[index], ...patch };
        return { ...previous, questions };
      });
    },
    []
  );

  const persistCurrentTime = useCallback(async () => {
    if (isPaused) return;
    const question = session.questions[currentIndex];
    if (!question) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - activeQuestionStartedAtRef.current) / 1000));
    if (elapsed === 0) return;
    const nextSeconds = (questionSecondsRef.current[question.id] ?? 0) + elapsed;
    questionSecondsRef.current[question.id] = nextSeconds;
    activeQuestionStartedAtRef.current = Date.now();
    updateQuestion(currentIndex, { timeSpentSeconds: nextSeconds });
    try {
      await patchSession({
        action: "UPDATE_META",
        questionId: question.id,
        timeSpentSeconds: nextSeconds,
      });
    } catch (error) {
      console.error("Failed to save question timing:", error);
    }
  }, [currentIndex, isPaused, patchSession, session.questions, updateQuestion]);

  const submitExam = useCallback(async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await persistCurrentTime();
      const response = await fetch(`/api/exams/${session.id}/submit`, { method: "POST" });
      if (!response.ok) throw new Error(`Submission failed with status ${response.status}`);
      router.push(`/exam/${session.id}/review`);
    } catch (error) {
      console.error("Failed to submit exam:", error);
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
      setSubmitError(
        "Your answers could not be submitted. Check your connection and try again — nothing has been lost."
      );
    }
  }, [persistCurrentTime, router, session.id]);
  submitExamRef.current = () => void submitExam();

  const handleSelectOption = useCallback(
    async (optionKey: string) => {
      if (
        interactionLocked ||
        (session.immediateFeedback && session.questions[currentIndex]?.selectedOption !== null)
      ) return;
      const index = currentIndex;
      const questionId = session.questions[index]?.id;
      if (!questionId) return;

      const previousSelection = session.questions[index].selectedOption;
      updateQuestion(index, { selectedOption: optionKey });

      try {
        await patchSession({ action: "SELECT_OPTION", questionId, selectedOption: optionKey });
      } catch (error) {
        console.error("Failed to save answer:", error);
        updateQuestion(index, { selectedOption: previousSelection });
      }
    },
    [currentIndex, interactionLocked, patchSession, session.immediateFeedback, session.questions, updateQuestion]
  );

  const handleToggleFlag = useCallback(async () => {
    if (interactionLocked) return;
    const index = currentIndex;
    const question = session.questions[index];
    if (!question) return;

    const nextFlag = !question.isFlagged;
    updateQuestion(index, { isFlagged: nextFlag });

    try {
      await patchSession({
        action: "TOGGLE_FLAG",
        questionId: question.id,
        isFlagged: nextFlag,
      });
    } catch (error) {
      console.error("Failed to update the flag:", error);
      updateQuestion(index, { isFlagged: !nextFlag });
    }
  }, [currentIndex, interactionLocked, patchSession, session.questions, updateQuestion]);

  const handleConfidence = useCallback(
    async (confidence: ConfidenceLevel) => {
      if (interactionLocked) return;
      const question = session.questions[currentIndex];
      if (!question) return;
      updateQuestion(currentIndex, { confidence });
      try {
        await patchSession({ action: "UPDATE_META", questionId: question.id, confidence });
      } catch (error) {
        console.error("Failed to save confidence:", error);
        updateQuestion(currentIndex, { confidence: question.confidence ?? null });
      }
    },
    [currentIndex, interactionLocked, patchSession, session.questions, updateQuestion]
  );

  const handleCalculatorUsed = useCallback(async () => {
    if (interactionLocked) return;
    const question = session.questions[currentIndex];
    if (!question) return;
    const calculatorUsed = !question.calculatorUsed;
    updateQuestion(currentIndex, { calculatorUsed });
    try {
      await patchSession({ action: "UPDATE_META", questionId: question.id, calculatorUsed });
    } catch (error) {
      console.error("Failed to save calculator use:", error);
      updateQuestion(currentIndex, { calculatorUsed: question.calculatorUsed ?? false });
    }
  }, [currentIndex, interactionLocked, patchSession, session.questions, updateQuestion]);

  const moveToQuestion = useCallback(
    (nextIndex: number) => {
      void persistCurrentTime();
      activeQuestionStartedAtRef.current = Date.now();
      setShowPracticeSolution(false);
      setCurrentIndex(Math.max(0, Math.min(nextIndex, totalQuestions - 1)));
    },
    [persistCurrentTime, totalQuestions]
  );

  const goToNext = useCallback(() => {
    moveToQuestion(currentIndex + 1);
  }, [currentIndex, moveToQuestion]);

  const goToPrevious = useCallback(() => {
    moveToQuestion(currentIndex - 1);
  }, [currentIndex, moveToQuestion]);

  const handleTogglePause = useCallback(async () => {
    if (!isPaused) await persistCurrentTime();
    await togglePause();
    activeQuestionStartedAtRef.current = Date.now();
  }, [isPaused, persistCurrentTime, togglePause]);

  // Keyboard shortcuts mirroring CBT: arrows to move, A–E to answer, F to flag.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (interactionLocked || showFormulaSheet || showSubmitDialog) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === "ArrowRight") {
        goToNext();
      } else if (event.key === "ArrowLeft") {
        goToPrevious();
      } else if (event.key.toLowerCase() === "f") {
        void handleToggleFlag();
      } else {
        const key = event.key.toUpperCase();
        if ((OPTION_KEYS as readonly string[]).includes(key)) {
          void handleSelectOption(key);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goToNext,
    goToPrevious,
    handleSelectOption,
    handleToggleFlag,
    interactionLocked,
    showFormulaSheet,
    showSubmitDialog,
  ]);

  const { answeredCount, flaggedCount } = useMemo(() => {
    let answered = 0;
    let flagged = 0;
    for (const question of session.questions) {
      if (question.selectedOption !== null) answered += 1;
      if (question.isFlagged) flagged += 1;
    }
    return { answeredCount: answered, flaggedCount: flagged };
  }, [session.questions]);

  const unansweredCount = totalQuestions - answeredCount;
  const selectedAnswer = currentQuestion.renderedOptions.find(
    (option) => option.key === currentQuestion.selectedOption
  );
  const practiceAnswered = session.immediateFeedback && Boolean(selectedAnswer);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen flex-col selection:bg-blue-500/30 selection:text-white">
        {/* ================= Sticky Glass CBT Header ================= */}
        {/* The header is sticky, so its backdrop-filter is re-composited on every
            scroll frame. A smaller radius over a more opaque base keeps the glass
            read while cutting that per-frame cost substantially. */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080c15]/92 text-white shadow-xl backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="hidden font-bold tracking-tight text-white sm:inline">
                Exam FM Practice
              </span>
              <span className="hidden text-white/20 sm:inline">|</span>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                <span>Question</span>
                <span className="font-mono text-sm font-black text-white">{currentIndex + 1}</span>
                <span className="text-slate-400">of</span>
                <span className="font-mono text-xs font-bold text-slate-300">{totalQuestions}</span>
              </div>
            </div>

            {/* Glowing Timer Capsule */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-sm font-bold tracking-wider tabular-nums transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 sm:text-base",
                isCritical
                  ? "animate-pulse border-red-400/50 bg-red-500/20 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
                  : isWarning
                    ? "border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                    : session.isTimed
                      ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "border-blue-400/30 bg-blue-500/15 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
              )}
              role={session.isTimed ? "timer" : undefined}
              aria-live="off"
              aria-label={session.isTimed ? `Time remaining ${formattedTime}` : "Untimed practice"}
            >
              {session.isTimed ? (
                <>
                  <Clock className="h-4 w-4" />
                  <span>{formattedTime}</span>
                </>
              ) : (
                <>
                  <Gauge className="h-4 w-4 text-blue-400" />
                  <span className="font-sans text-xs tracking-normal text-blue-200">Untimed practice</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {session.isTimed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTogglePause()}
                      disabled={isSyncing || isExpired}
                      aria-label={isPaused ? "Resume exam" : "Pause exam"}
                      className="border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPaused ? (
                        <Play className="h-4 w-4 fill-emerald-400 text-emerald-400" />
                      ) : (
                        <Pause className="h-4 w-4 fill-amber-400 text-amber-400" />
                      )}
                      <span className="hidden sm:inline">{isPaused ? "Resume" : "Pause"}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPaused ? "Resume the exam and restart the clock" : "Pause the clock and hide the questions"}
                  </TooltipContent>
                </Tooltip>
              )}

              {session.formulaSheetEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFormulaSheet(true)}
                      disabled={isPaused}
                      aria-label="Open the formula reference sheet"
                      className="border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      <BookOpen className="h-4 w-4 text-blue-400" />
                      <span className="hidden md:inline">Formulas</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open the formula reference sheet</TooltipContent>
                </Tooltip>
              )}

              <Button
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                aria-label="Submit the exam for grading"
                className="font-bold shadow-lg shadow-blue-500/25"
              >
                <Send className="h-4 w-4" />
                <span>Submit</span>
              </Button>
            </div>
          </div>

          {/* Thin glowing progress track */}
          <div className="h-1 w-full bg-white/[0.06]">
            <div
              className={cn(
                "h-full transition-[width] duration-300 ease-out",
                isCritical
                  ? "bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : isWarning
                    ? "bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    : "bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              )}
              style={{ width: `${Math.min(100, Math.max(0, elapsedPercent))}%` }}
            />
          </div>
        </header>

        {/* ================= Exam Body ================= */}
        <main
          className={cn(
            // Only opacity is transitioned. Animating a full-page blur filter
            // forces a fresh rasterisation of the entire subtree on every frame.
            "mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 transition-opacity duration-300 sm:p-6 lg:grid-cols-4",
            isPaused && "pointer-events-none select-none opacity-30"
          )}
          aria-hidden={isPaused}
        >
          {/* Main Question Panel */}
          <section className="flex flex-col gap-4 lg:col-span-3">
            <Card className="flex flex-1 flex-col overflow-hidden border-white/[0.09] bg-slate-900/75 shadow-2xl">
              {/* Question Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-white/[0.02] px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-blue-400/30 bg-blue-500/15 text-[11px] font-bold uppercase tracking-wider text-blue-300"
                  >
                    {DOMAIN_LABELS[currentQuestion.domain]}
                  </Badge>
                  {session.mode !== "EXAM" && (
                    <Badge
                      variant={currentQuestion.difficulty >= 3 ? "warning" : "muted"}
                      className="text-[11px] uppercase tracking-wide font-semibold"
                      title={`This item chains ${currentQuestion.steps} interdependent steps`}
                    >
                      {DIFFICULTY_LABELS[currentQuestion.difficulty]}
                    </Badge>
                  )}
                  {session.mode !== "EXAM" && (
                    <span className="hidden text-xs font-medium text-slate-400 lg:inline">
                      {currentQuestion.templateTitle}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleFlag()}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                    currentQuestion.isFlagged
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  )}
                  aria-pressed={currentQuestion.isFlagged}
                >
                  <Bookmark
                    className={cn(
                      "h-3.5 w-3.5",
                      currentQuestion.isFlagged ? "fill-amber-400 text-amber-400" : "text-slate-400"
                    )}
                  />
                  <span>{currentQuestion.isFlagged ? "Flagged for review" : "Flag for review"}</span>
                </button>
              </div>

              {/* Question Content & Radios */}
              <div className="flex-1 p-6 sm:p-8">
                <MathRenderer
                  content={currentQuestion.renderedQuestion}
                  className="exam-question exam-question-frame mb-8 text-white"
                />

                <RadioGroup
                  value={currentQuestion.selectedOption ?? ""}
                  onValueChange={(value) => void handleSelectOption(value)}
                  aria-label="Answer choices"
                  disabled={interactionLocked || practiceAnswered}
                >
                  {currentQuestion.renderedOptions.map((option) => {
                    const isSelected = currentQuestion.selectedOption === option.key;
                    const revealCorrect = practiceAnswered && option.isCorrect;
                    const revealWrong = practiceAnswered && isSelected && !option.isCorrect;

                    return (
                      <RadioGroupItem
                        key={option.key}
                        value={option.key}
                        id={`option-${option.key}`}
                        className={cn(
                          revealCorrect &&
                            "border-emerald-400/70 bg-emerald-600/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                          revealWrong &&
                            "border-red-400/70 bg-red-600/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black transition-[transform,background-color,border-color,box-shadow,color,opacity]",
                            isSelected
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400/40"
                              : "border border-white/10 bg-white/[0.05] text-slate-300 group-hover:border-white/20 group-hover:text-white"
                          )}
                        >
                          {option.key}
                        </span>
                        <MathRenderer
                          content={option.text}
                          className="pt-0.5 text-base font-medium leading-relaxed text-slate-100 tabular-nums"
                        />
                      </RadioGroupItem>
                    );
                  })}
                </RadioGroup>

                {/* Confidence & Calculator Toggle Strip */}
                <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-white/[0.08] pt-6">
                  <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <HelpCircle className="h-4 w-4 text-blue-400" /> Confidence:
                  </span>
                  {(["SURE", "UNSURE", "GUESS"] as const).map((confidence) => {
                    const isConfidenceSelected = currentQuestion.confidence === confidence;
                    return (
                      <button
                        key={confidence}
                        type="button"
                        onClick={() => void handleConfidence(confidence)}
                        disabled={interactionLocked}
                        aria-pressed={isConfidenceSelected}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                          isConfidenceSelected
                            ? "border border-blue-400/50 bg-blue-600/25 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                            : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                        )}
                      >
                        {confidence === "SURE" ? "Sure" : confidence === "UNSURE" ? "Unsure" : "Guess"}
                      </button>
                    );
                  })}

                  <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

                  <button
                    type="button"
                    onClick={() => void handleCalculatorUsed()}
                    disabled={interactionLocked}
                    aria-pressed={Boolean(currentQuestion.calculatorUsed)}
                    title="Self-report whether you used your approved calculator for this question"
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                      currentQuestion.calculatorUsed
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                    )}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>
                      {currentQuestion.calculatorUsed ? "Calculator marked" : "Mark calculator used"}
                    </span>
                  </button>
                </div>

                {/* Practice Mode Instant Feedback Banner */}
                {practiceAnswered && (
                  <div
                    className={cn(
                      "mt-6 rounded-2xl border p-5 shadow-xl",
                      selectedAnswer?.isCorrect
                        ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
                        : "border-red-500/40 bg-red-950/40 text-red-100"
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      {selectedAnswer?.isCorrect ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-white">
                          {selectedAnswer?.isCorrect ? "Correct answer" : "Not quite correct"}
                        </h3>
                        {!selectedAnswer?.isCorrect && selectedAnswer?.distractorExplanation && (
                          <MathRenderer
                            content={selectedAnswer.distractorExplanation}
                            className="mt-1 text-sm text-slate-300"
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-3 text-xs text-sky-300 hover:text-white"
                          onClick={() => setShowPracticeSolution((shown) => !shown)}
                        >
                          <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
                          {showPracticeSolution ? "Hide worked derivation" : "View step-by-step worked solution"}
                        </Button>
                        {showPracticeSolution && (
                          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/80 p-4">
                            <MathRenderer
                              content={currentQuestion.solutionSteps}
                              className="text-sm leading-relaxed text-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] bg-white/[0.02] px-6 py-4">
                <Button
                  variant="outline"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <span className="hidden text-xs text-slate-400 sm:inline">
                  Shortcuts: <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">←</kbd> <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">→</kbd> to move · <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">A</kbd>–<kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">E</kbd> to answer · <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">F</kbd> to flag
                </span>

                <Button
                  variant="secondary"
                  onClick={goToNext}
                  disabled={currentIndex === totalQuestions - 1}
                  className="border-white/10 bg-slate-800/80 hover:border-white/20"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </section>

          {/* ================= Question Navigator Sidebar ================= */}
          <aside className="lg:col-span-1">
            <Card className="border-white/[0.09] bg-slate-900/75 p-5 shadow-2xl backdrop-blur-md lg:sticky lg:top-24">
              <h2 className="mb-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Question navigator
              </h2>

              {/* Status summary pills */}
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                  <div className="font-mono text-lg font-black text-emerald-300">{answeredCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Answered</div>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 shadow-[0_0_12px_rgba(245,158,11,0.12)]">
                  <div className="font-mono text-lg font-black text-amber-300">{flaggedCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Flagged</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                  <div className="font-mono text-lg font-black text-slate-200">{unansweredCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining</div>
                </div>
              </div>

              {/* Grid of question buttons */}
              <div className="grid grid-cols-5 gap-2">
                {session.questions.map((question, index) => {
                  const isCurrent = index === currentIndex;
                  const isAnswered = question.selectedOption !== null;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => moveToQuestion(index)}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", not answered"}${
                        question.isFlagged ? ", flagged" : ""
                      }`}
                      className={cn(
                        "relative flex h-10 items-center justify-center rounded-xl font-mono text-xs font-bold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                        isCurrent
                          ? "border border-blue-400/80 bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/40 scale-105"
                          : isAnswered
                            ? "border border-emerald-400/40 bg-emerald-600/30 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                      )}
                    >
                      {index + 1}
                      {question.isFlagged && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <dl className="mt-5 space-y-2 border-t border-white/[0.08] pt-4 text-xs text-slate-400">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <span>Current question</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded border border-white/20 bg-white/[0.05]" />
                  <span>Not answered</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <span>Flagged for review</span>
                </div>
              </dl>
            </Card>
          </aside>
        </main>

        {/* ================= Glass Pause Modal ================= */}
        <Dialog open={isPaused} onOpenChange={() => undefined}>
          <DialogContent
            hideCloseButton
            className="max-w-md border-white/15 bg-slate-950/90 text-center backdrop-blur-md shadow-2xl"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                <Pause className="h-8 w-8 fill-current" />
              </div>
              <DialogTitle className="text-xl font-black text-white">Exam paused</DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                The clock is stopped and the questions are hidden. Resume whenever you are ready — your answers and flags are saved.
              </DialogDescription>
            </DialogHeader>

            <div className="my-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Time remaining
              </div>
              <div className="mt-1 font-mono text-3xl font-black tabular-nums text-white">
                {formattedTime}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-bold shadow-lg shadow-blue-500/25"
              onClick={() => void handleTogglePause()}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              Resume exam
            </Button>
          </DialogContent>
        </Dialog>

        {/* ================= Glass Submit Confirmation Modal ================= */}
        <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <DialogContent className="max-w-md border-white/15 bg-slate-950/90 backdrop-blur-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white">Submit this exam?</DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                Submitting ends your sitting and calculates your complete diagnostic report. You will not be able to change your answers afterwards.
              </DialogDescription>
            </DialogHeader>

            {unansweredCount > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p>
                  <span className="font-bold">
                    {unansweredCount} question{unansweredCount === 1 ? " is" : "s are"} unanswered.
                  </span>{" "}
                  Unanswered questions are scored as incorrect.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="block text-slate-400">Answered</span>
                <span className="mt-1 font-mono text-lg font-black text-white">
                  {answeredCount} / {totalQuestions}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="block text-slate-400">Flagged</span>
                <span className="mt-1 font-mono text-lg font-black text-amber-400">{flaggedCount}</span>
              </div>
            </div>

            {submitError && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/15 p-3 text-xs text-red-200">
                {submitError}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => setShowSubmitDialog(false)}
                disabled={isSubmitting}
                className="text-slate-300 hover:text-white"
              >
                Return to exam
              </Button>
              <Button
                onClick={() => void submitExam()}
                disabled={isSubmitting}
                className="font-bold shadow-lg shadow-blue-500/25"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Grading
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Submit and grade
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================= Time Expired Modal ================= */}
        <Dialog open={showTimeUpDialog} onOpenChange={() => undefined}>
          <DialogContent hideCloseButton className="max-w-sm border-white/15 bg-slate-950/90 text-center backdrop-blur-md shadow-2xl">
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/15 text-destructive">
                <Clock className="h-7 w-7" />
              </div>
              <DialogTitle className="text-xl font-black text-white">Time is up</DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                The {Math.round(session.durationSeconds / 60)}-minute limit has been reached. Your sitting is being submitted automatically.
              </DialogDescription>
            </DialogHeader>
            {submitError ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-red-300">{submitError}</p>
                <Button onClick={() => void submitExam()} className="w-full">Try again</Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 pt-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                Grading your answers...
              </div>
            )}
          </DialogContent>
        </Dialog>

        {session.formulaSheetEnabled && (
          <FormulaSheetModal open={showFormulaSheet} onOpenChange={setShowFormulaSheet} />
        )}
      </div>
    </TooltipProvider>
  );
};

export default ExamRunner;
