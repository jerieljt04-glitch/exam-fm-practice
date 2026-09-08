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
import { Progress } from "./ui/progress";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useExamTimer } from "@/hooks/useExamTimer";
import {
  DIFFICULTY_LABELS,
  DOMAIN_LABELS,
  HEARTBEAT_INTERVAL_MS,
  OPTION_KEYS,
} from "@/lib/exam-config";
import type { ExamSessionData } from "@/lib/types/exam";
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalQuestions = session.questions.length;
  const currentQuestion = session.questions[currentIndex] ?? session.questions[0];
  const hasSubmittedRef = useRef(false);

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

  const submitExam = useCallback(async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
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
  }, [router, session.id]);

  const handleTimeExpire = useCallback(() => {
    setShowSubmitDialog(false);
    setShowTimeUpDialog(true);
    void submitExam();
  }, [submitExam]);

  const handlePauseSync = useCallback(
    async (isPaused: boolean) => {
      await patchSession({ action: "TOGGLE_PAUSE", isPaused });
    },
    [patchSession]
  );

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

  const handleSelectOption = useCallback(
    async (optionKey: string) => {
      if (interactionLocked) return;
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
    [currentIndex, interactionLocked, patchSession, session.questions, updateQuestion]
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

  // Report that this tab is still open. The server ends a sitting that stops
  // reporting, so closing the tab ends the exam while a reload — which resumes
  // the heartbeat within a second — does not.
  useEffect(() => {
    if (isSubmitting) return;

    const beat = () => {
      void fetch(`/api/exams/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "HEARTBEAT" }),
        keepalive: true,
      }).catch(() => undefined);
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isSubmitting, session.id]);

  const goToNext = useCallback(() => {
    setCurrentIndex((index) => Math.min(index + 1, totalQuestions - 1));
  }, [totalQuestions]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }, []);

  // Keyboard shortcuts mirroring the CBT: arrows to move, A–E to answer, F to flag.
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen flex-col bg-background">
        {/* ================= Sticky CBT status bar ================= */}
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-slate-100 shadow-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-bold tracking-wide text-blue-400 sm:inline">
                Exam FM Practice
              </span>
              <span className="hidden text-slate-600 sm:inline">|</span>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                Question <span className="font-bold text-white">{currentIndex + 1}</span> of{" "}
                {totalQuestions}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-base font-bold tracking-wider tabular-nums transition-colors sm:text-lg",
                isCritical
                  ? "animate-pulse border-red-500 bg-red-950/70 text-red-300"
                  : isWarning
                    ? "border-amber-500 bg-amber-950/70 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-emerald-400"
              )}
              role="timer"
              aria-live="off"
              aria-label={`Time remaining ${formattedTime}`}
            >
              <Clock className="h-4 w-4 text-slate-400" />
              <span>{formattedTime}</span>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void togglePause()}
                    disabled={isSyncing || isExpired}
                    // The visible label collapses on narrow viewports, so the
                    // button needs its own accessible name.
                    aria-label={isPaused ? "Resume exam" : "Pause exam"}
                    className="border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowFormulaSheet(true)}
                    disabled={isPaused}
                    aria-label="Open the formula reference sheet"
                    className="border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                  >
                    <BookOpen className="h-4 w-4 text-blue-400" />
                    <span className="hidden md:inline">Formulas</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open the formula reference sheet</TooltipContent>
              </Tooltip>

              <Button
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                aria-label="Submit the exam for grading"
              >
                <Send className="h-4 w-4" />
                <span>Submit</span>
              </Button>
            </div>
          </div>
          <Progress
            value={elapsedPercent}
            className="h-1 rounded-none bg-slate-800"
            indicatorClassName={cn(
              "rounded-none",
              isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500"
            )}
          />
        </header>

        {/* ================= Exam body ================= */}
        <main
          className={cn(
            "mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 transition-all sm:p-6 lg:grid-cols-4",
            isPaused && "pointer-events-none select-none blur-md"
          )}
          aria-hidden={isPaused}
        >
          <section className="flex flex-col gap-4 lg:col-span-3">
            <Card className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/50 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="uppercase tracking-wide">
                    {DOMAIN_LABELS[currentQuestion.domain]}
                  </Badge>
                  <Badge
                    variant={currentQuestion.difficulty >= 3 ? "warning" : "muted"}
                    className="uppercase tracking-wide"
                    title={`This item chains ${currentQuestion.steps} interdependent steps`}
                  >
                    {DIFFICULTY_LABELS[currentQuestion.difficulty]}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground lg:inline">
                    {currentQuestion.templateTitle}
                  </span>
                </div>

                <Button
                  variant={currentQuestion.isFlagged ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => void handleToggleFlag()}
                  className={cn(
                    currentQuestion.isFlagged &&
                      "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  )}
                  aria-pressed={currentQuestion.isFlagged}
                >
                  <Bookmark
                    className={cn(
                      "h-4 w-4",
                      currentQuestion.isFlagged ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
                    )}
                  />
                  {currentQuestion.isFlagged ? "Flagged for review" : "Flag for review"}
                </Button>
              </div>

              <div className="flex-1 p-6 sm:p-8">
                <MathRenderer
                  content={currentQuestion.renderedQuestion}
                  className="mb-8 text-base leading-relaxed text-foreground sm:text-lg"
                />

                <RadioGroup
                  value={currentQuestion.selectedOption ?? ""}
                  onValueChange={(value) => void handleSelectOption(value)}
                  aria-label="Answer choices"
                >
                  {currentQuestion.renderedOptions.map((option) => {
                    const isSelected = currentQuestion.selectedOption === option.key;
                    return (
                      <RadioGroupItem key={option.key} value={option.key} id={`option-${option.key}`}>
                        <span
                          className={cn(
                            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground ring-2 ring-primary/25"
                              : "border border-border bg-muted text-muted-foreground"
                          )}
                        >
                          {option.key}
                        </span>
                        <MathRenderer
                          content={option.text}
                          className="pt-0.5 text-sm font-medium text-foreground sm:text-base"
                        />
                      </RadioGroupItem>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4">
                <Button variant="outline" onClick={goToPrevious} disabled={currentIndex === 0}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Shortcuts: ← → to move, A–E to answer, F to flag
                </span>

                <Button
                  variant="secondary"
                  onClick={goToNext}
                  disabled={currentIndex === totalQuestions - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </section>

          {/* ================= Question navigator ================= */}
          <aside className="lg:col-span-1">
            <Card className="p-5 lg:sticky lg:top-24">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Question navigator
              </h2>

              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                  <div className="text-base font-extrabold text-success">{answeredCount}</div>
                  <div className="text-[10px] font-semibold uppercase text-success">Answered</div>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                  <div className="text-base font-extrabold text-warning">{flaggedCount}</div>
                  <div className="text-[10px] font-semibold uppercase text-warning">Flagged</div>
                </div>
                <div className="rounded-lg border bg-muted p-2">
                  <div className="text-base font-extrabold text-foreground">{unansweredCount}</div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Remaining
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {session.questions.map((question, index) => {
                  const isCurrent = index === currentIndex;
                  const isAnswered = question.selectedOption !== null;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", not answered"}${
                        question.isFlagged ? ", flagged" : ""
                      }`}
                      className={cn(
                        "relative flex h-10 items-center justify-center rounded-lg border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isCurrent
                          ? "border-primary bg-primary font-bold text-primary-foreground ring-2 ring-primary/30"
                          : isAnswered
                            ? "border-success bg-success font-medium text-success-foreground"
                            : "border-border bg-card text-foreground hover:bg-accent"
                      )}
                    >
                      {index + 1}
                      {question.isFlagged && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-card" />
                      )}
                    </button>
                  );
                })}
              </div>

              <dl className="mt-5 space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-primary" />
                  <span>Current question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-success" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border bg-card" />
                  <span>Not answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-warning" />
                  <span>Flagged for review</span>
                </div>
              </dl>
            </Card>
          </aside>
        </main>

        {/* ================= Pause overlay ================= */}
        <Dialog open={isPaused} onOpenChange={() => undefined}>
          <DialogContent
            hideCloseButton
            className="max-w-md text-center"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">
                <Pause className="h-8 w-8 fill-current" />
              </div>
              <DialogTitle>Exam paused</DialogTitle>
              <DialogDescription>
                The clock is stopped and the questions are hidden. Resume whenever you are ready —
                your answers and flags have been saved.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border bg-muted/60 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Time remaining
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {formattedTime}
              </div>
            </div>

            <Button size="lg" className="w-full" onClick={() => void togglePause()} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
              Resume exam
            </Button>
          </DialogContent>
        </Dialog>

        {/* ================= Submit confirmation ================= */}
        <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit this exam?</DialogTitle>
              <DialogDescription>
                Submitting ends the sitting and produces your diagnostic report. You will not be able
                to change your answers afterwards.
              </DialogDescription>
            </DialogHeader>

            {unansweredCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p>
                  <span className="font-bold">
                    {unansweredCount} question{unansweredCount === 1 ? " is" : "s are"} unanswered.
                  </span>{" "}
                  Unanswered questions are scored as incorrect.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="rounded-lg border bg-muted/60 p-2.5">
                <span className="block text-muted-foreground">Answered</span>
                <span className="text-base font-bold text-foreground">
                  {answeredCount} / {totalQuestions}
                </span>
              </div>
              <div className="rounded-lg border bg-muted/60 p-2.5">
                <span className="block text-muted-foreground">Flagged</span>
                <span className="text-base font-bold text-warning">{flaggedCount}</span>
              </div>
            </div>

            {submitError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {submitError}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowSubmitDialog(false)}
                disabled={isSubmitting}
              >
                Return to exam
              </Button>
              <Button onClick={() => void submitExam()} disabled={isSubmitting}>
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

        {/* ================= Time expired ================= */}
        <Dialog open={showTimeUpDialog} onOpenChange={() => undefined}>
          <DialogContent hideCloseButton className="max-w-sm text-center">
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Clock className="h-7 w-7" />
              </div>
              <DialogTitle>Time is up</DialogTitle>
              <DialogDescription>
                The 150-minute limit has been reached. Your exam is being submitted automatically.
              </DialogDescription>
            </DialogHeader>
            {submitError ? (
              <>
                <p className="text-xs text-destructive">{submitError}</p>
                <Button onClick={() => void submitExam()}>Try again</Button>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Grading your answers
              </div>
            )}
          </DialogContent>
        </Dialog>

        <FormulaSheetModal open={showFormulaSheet} onOpenChange={setShowFormulaSheet} />
      </div>
    </TooltipProvider>
  );
};

export default ExamRunner;
