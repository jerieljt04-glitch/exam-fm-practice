"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Pause,
  Play,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { ExamQuestionData, ExamSessionData } from "../lib/types/exam";
import { useExamTimer } from "../hooks/useExamTimer";
import { MathRenderer } from "./MathRenderer";
import { FormulaSheetModal } from "./FormulaSheetModal";

interface ExamRunnerProps {
  initialSession: ExamSessionData;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({ initialSession }) => {
  const router = useRouter();
  const [session, setSession] = useState<ExamSessionData>(initialSession);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  const currentQuestion: ExamQuestionData = session.questions[currentIndex] || session.questions[0];

  // Callback to sync pause state with backend
  const handlePauseSync = useCallback(async (isPaused: boolean) => {
    try {
      await fetch(`/api/exams/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_PAUSE", isPaused }),
      });
    } catch (e) {
      console.error("Failed to sync pause state:", e);
    }
  }, [session.id]);

  // Handle timer expiration
  const handleTimeExpire = useCallback(async () => {
    alert("Exam time has expired! Your exam will now be automatically submitted.");
    await submitExam();
  }, []);

  // Initialize timer hook
  const {
    remainingSeconds,
    formattedTime,
    isPaused,
    pausedTimeMs,
    togglePause,
    isWarning,
    isCritical,
  } = useExamTimer({
    durationSeconds: session.durationSeconds || 9000,
    startTime: session.startTime,
    initialPausedTimeMs: session.pausedTimeMs || 0,
    initialIsPaused: session.isPaused || false,
    onTimeExpire: handleTimeExpire,
    onPauseToggle: handlePauseSync,
  });

  // Save selected option
  const handleSelectOption = async (optionKey: "A" | "B" | "C" | "D" | "E") => {
    if (isPaused) return;

    // Optimistic UI update
    setSession((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[currentIndex] = {
        ...updatedQuestions[currentIndex],
        selectedOption: optionKey,
      };
      return { ...prev, questions: updatedQuestions };
    });

    try {
      await fetch(`/api/exams/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SELECT_OPTION",
          questionId: currentQuestion.id,
          selectedOption: optionKey,
        }),
      });
    } catch (err) {
      console.error("Failed to save answer:", err);
    }
  };

  // Toggle flag status for current question
  const handleToggleFlag = async () => {
    if (isPaused) return;

    const nextFlag = !currentQuestion.isFlagged;
    setSession((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[currentIndex] = {
        ...updatedQuestions[currentIndex],
        isFlagged: nextFlag,
      };
      return { ...prev, questions: updatedQuestions };
    });

    try {
      await fetch(`/api/exams/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_FLAG",
          questionId: currentQuestion.id,
          isFlagged: nextFlag,
        }),
      });
    } catch (err) {
      console.error("Failed to toggle flag:", err);
    }
  };

  // Submit the exam
  const submitExam = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/exams/${session.id}/submit`, {
        method: "POST",
      });
      if (res.ok) {
        router.push(`/exam/${session.id}/review`);
      } else {
        throw new Error("Submission failed");
      }
    } catch (err) {
      alert("Error submitting exam. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Navigation handlers
  const goToNext = () => {
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (e.key === "ArrowRight" && currentIndex < session.questions.length - 1) {
        goToNext();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, isPaused, session.questions.length]);

  // Statistics
  const answeredCount = session.questions.filter((q) => q.selectedOption !== null).length;
  const flaggedCount = session.questions.filter((q) => q.isFlagged).length;
  const totalQuestions = session.questions.length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* ========================================================================= */}
      {/* 1. STICKY CBT TOP BAR */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Exam title & Question indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-blue-400 tracking-wider text-sm sm:text-base">
                SOA CBT
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-200 font-semibold text-sm hidden sm:inline">
                Exam FM Practice
              </span>
            </div>

            <div className="bg-slate-800/90 px-3 py-1 rounded-full border border-slate-700 text-xs font-medium text-slate-300">
              Question <span className="text-white font-bold">{currentIndex + 1}</span> of{" "}
              <span>{totalQuestions}</span>
            </div>
          </div>

          {/* Center: High-contrast Countdown Timer */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border font-mono font-bold text-base sm:text-lg tracking-wider transition-colors ${
                isCritical
                  ? "bg-red-950/80 border-red-500 text-red-400 animate-pulse"
                  : isWarning
                  ? "bg-amber-950/80 border-amber-500 text-amber-300"
                  : "bg-slate-800/90 border-slate-700 text-emerald-400"
              }`}
            >
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{formattedTime}</span>
            </div>
          </div>

          {/* Right: Actions (Pause, Formula Sheet, Flag, Submit) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Pause Toggle Button */}
            <button
              onClick={togglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
              title={isPaused ? "Resume Exam" : "Pause Exam Timer"}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              )}
            </button>

            {/* Formula Reference Sheet */}
            <button
              onClick={() => setShowFormulaModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Open Formula Sheet"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Formulas</span>
            </button>

            {/* Submit Exam Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CBT EXAM BODY & NAVIGATION GRID */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
        {/* Left / Center 3 Columns: Active Question Card */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
            {/* Question Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                  {currentQuestion.domain.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ID: #{currentQuestion.templateId}
                </span>
              </div>

              {/* Bookmark / Flag Toggle */}
              <button
                onClick={handleToggleFlag}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  currentQuestion.isFlagged
                    ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${
                    currentQuestion.isFlagged ? "fill-amber-500 text-amber-500" : "text-slate-400"
                  }`}
                />
                <span>{currentQuestion.isFlagged ? "Flagged for Review" : "Flag Question"}</span>
              </button>
            </div>

            {/* Question Text with KaTeX formulas */}
            <div className="p-6 sm:p-8 flex-1">
              <div className="text-base sm:text-lg text-slate-800 leading-relaxed font-normal mb-8">
                <MathRenderer content={currentQuestion.renderedQuestion} />
              </div>

              {/* 5 Options: A, B, C, D, E */}
              <div className="space-y-3">
                {currentQuestion.renderedOptions.map((opt) => {
                  const isSelected = currentQuestion.selectedOption === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                      }`}
                    >
                      {/* Option Radio Circle */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white ring-2 ring-blue-200"
                            : "bg-slate-100 text-slate-700 border border-slate-300"
                        }`}
                      >
                        {opt.key}
                      </div>

                      {/* Option Formula / Text */}
                      <div className="pt-0.5 text-sm sm:text-base text-slate-800 font-medium flex-1">
                        <MathRenderer content={opt.text} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Nav Bar within Question Card */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="text-xs text-slate-500 hidden sm:inline">
                Use Left / Right arrow keys to navigate
              </span>

              <button
                onClick={goToNext}
                disabled={currentIndex === session.questions.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: 30 Question CBT Pagination Grid & Progress */}
        <aside className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Questions Navigation (1–{totalQuestions})
            </h3>

            {/* Summary Counters */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-base font-extrabold text-emerald-700">{answeredCount}</div>
                <div className="text-[10px] text-emerald-600 uppercase font-semibold">Answered</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-base font-extrabold text-amber-700">{flaggedCount}</div>
                <div className="text-[10px] text-amber-600 uppercase font-semibold">Flagged</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-base font-extrabold text-slate-700">{unansweredCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Remaining</div>
              </div>
            </div>

            {/* 30-Question Grid */}
            <div className="grid grid-cols-5 gap-2">
              {session.questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = q.selectedOption !== null;
                const isFlagged = q.isFlagged;

                let btnStyles = "bg-white border-slate-200 text-slate-700 hover:bg-slate-100";
                if (isCurrent) {
                  btnStyles = "bg-blue-600 border-blue-600 text-white font-bold ring-2 ring-blue-300";
                } else if (isFlagged && isAnswered) {
                  btnStyles = "bg-emerald-50 border-amber-400 text-emerald-800 font-semibold";
                } else if (isFlagged) {
                  btnStyles = "bg-amber-100 border-amber-400 text-amber-900 font-semibold";
                } else if (isAnswered) {
                  btnStyles = "bg-emerald-600 border-emerald-600 text-white font-medium";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      if (!isPaused) setCurrentIndex(idx);
                    }}
                    className={`h-10 rounded-lg text-xs border relative flex items-center justify-center transition-all ${btnStyles}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-600" />
                <span>Current Question</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-600" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span>Flagged for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-slate-300 bg-white" />
                <span>Unanswered</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* ========================================================================= */}
      {/* 3. PAUSE MODAL OVERLAY (Blurs exam, prevents viewing, pauses timer) */}
      {/* ========================================================================= */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Pause className="w-8 h-8 fill-current" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">Exam Timer Paused</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your exam timer is currently paused. Question contents are concealed to uphold test
              integrity. You may resume at any time to continue from where you left off.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-6">
              <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Time Remaining</div>
              <div className="text-2xl font-mono font-bold text-slate-800">{formattedTime}</div>
            </div>

            <button
              onClick={togglePause}
              className="w-full py-3 px-4 rounded-xl text-base font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Resume Exam</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUBMIT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-slate-900 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Submit Practice Exam?</h3>
            </div>

            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to end this exam attempt and submit for grading?
            </p>

            {/* Unanswered warning banner */}
            {unansweredCount > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4 flex items-start gap-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{unansweredCount} unanswered questions</span> remain.
                  Unanswered questions are scored as incorrect.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Answered</span>
                <span className="text-base font-bold text-slate-800">{answeredCount} / {totalQuestions}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Flagged</span>
                <span className="text-base font-bold text-amber-600">{flaggedCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Return to Exam
              </button>
              <button
                onClick={submitExam}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <span>Grading...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Grade</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Sheet Modal */}
      <FormulaSheetModal
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
      />
    </div>
  );
};
