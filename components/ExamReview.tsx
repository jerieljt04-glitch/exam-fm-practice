"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  Calculator,
  MinusCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";

import { MathRenderer } from "./MathRenderer";
import { QuestionStudyAids } from "./QuestionStudyAids";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DIFFICULTY_LABELS,
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  PASS_RATIO,
  TOPIC_LABELS,
} from "@/lib/exam-config";
import type { DomainMetric, ExamQuestionData, ExamReviewData, ProficiencyStatus } from "@/lib/types/exam";
import { cn } from "@/lib/utils";
import { recordReview } from "@/lib/study-history";

interface ExamReviewProps {
  reviewData: ExamReviewData;
}

type QuestionFilter = "ALL" | "INCORRECT" | "CORRECT" | "UNANSWERED" | "FLAGGED";

const STATUS_STYLES: Record<ProficiencyStatus, { badge: string; bar: string; label: string }> = {
  MASTERED: { badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30", bar: "bg-emerald-500", label: "Mastered" },
  ADEQUATE: { badge: "bg-blue-500/15 text-blue-300 border-blue-400/30", bar: "bg-blue-500", label: "Adequate" },
  NEEDS_IMPROVEMENT: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    bar: "bg-amber-500",
    label: "Needs work",
  },
  CRITICAL: {
    badge: "bg-red-500/15 text-red-300 border-red-400/30",
    bar: "bg-red-500",
    label: "Critical",
  },
};

const DISTRACTOR_LABELS: Record<string, string> = {
  ANNUITY_DUE_CONFUSION: "Annuity-immediate vs annuity-due",
  SIMPLE_INTEREST_ERROR: "Simple interest used in place of compound",
  OFF_BY_ONE_PERIOD: "Off-by-one period",
  NOMINAL_RATE_ERROR: "Nominal and effective rate confusion",
  CALCULATION_DISTRACTOR: "Wrong quantity computed",
  CORRECT: "Correct answer",
};

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const ExamReview: React.FC<ExamReviewProps> = ({ reviewData }) => {
  const {
    correctCount,
    totalQuestions,
    unansweredCount,
    scorePercent,
    isPassed,
    totalTimeSpentSeconds,
    totalPausedTimeSeconds,
    domainMetrics,
    questions,
  } = reviewData;

  const [filter, setFilter] = useState<QuestionFilter>("ALL");
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");

  useEffect(() => {
    recordReview(window.localStorage, reviewData);
  }, [reviewData]);

  const questionNumbers = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((question, index) => map.set(question.id, index + 1));
    return map;
  }, [questions]);

  const incorrectCount = totalQuestions - correctCount;
  const benchmarkMark = Math.ceil(totalQuestions * PASS_RATIO);
  const flaggedCount = useMemo(
    () => questions.filter((question) => question.isFlagged).length,
    [questions]
  );

  const filteredQuestions = useMemo(
    () =>
      questions.filter((question) => {
        if (filter === "INCORRECT" && question.isCorrect) return false;
        if (filter === "CORRECT" && !question.isCorrect) return false;
        if (filter === "UNANSWERED" && question.selectedOption !== null) return false;
        if (filter === "FLAGGED" && !question.isFlagged) return false;
        if (selectedDomain !== "ALL" && question.domain !== selectedDomain) return false;
        return true;
      }),
    [filter, questions, selectedDomain]
  );

  const defaultOpen = useMemo(() => {
    const firstIncorrect = filteredQuestions.find((question) => !question.isCorrect);
    return firstIncorrect ? [firstIncorrect.id] : [];
  }, [filteredQuestions]);

  const activeDomains = useMemo(
    () => DOMAIN_ORDER.filter((domain) => (domainMetrics[domain]?.total ?? 0) > 0),
    [domainMetrics]
  );
  const weakestDomain = useMemo(
    () => activeDomains.map((domain) => domainMetrics[domain]).reduce(
      (weakest, metric) => (!weakest || metric.percentage < weakest.percentage ? metric : weakest),
      undefined as DomainMetric | undefined
    ),
    [activeDomains, domainMetrics]
  );
  const calculatorAnalytics = useMemo(() => {
    const summarize = (items: ExamQuestionData[]) => ({
      count: items.length,
      accuracy:
        items.length > 0
          ? Math.round((items.filter((question) => question.isCorrect).length / items.length) * 100)
          : null,
      averageSeconds:
        items.length > 0
          ? Math.round(
              items.reduce((sum, question) => sum + (question.timeSpentSeconds ?? 0), 0) /
                items.length
            )
          : null,
    });
    return {
      used: summarize(questions.filter((question) => question.calculatorUsed)),
      notUsed: summarize(questions.filter((question) => !question.calculatorUsed)),
    };
  }, [questions]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8 selection:bg-blue-500/30 selection:text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* ================= Glass Scorecard Banner ================= */}
        <section
          className={cn(
            // Static banner: nothing here changes state, so no transition is declared.
            "relative overflow-hidden rounded-3xl border p-6 shadow-2xl sm:p-9",
            isPassed
              ? "border-emerald-500/40 bg-slate-900/60 shadow-[0_0_50px_rgba(16,185,129,0.15)]"
              : "border-blue-500/40 bg-slate-900/60 shadow-[0_0_50px_rgba(59,130,246,0.15)]"
          )}
        >
          {/* Ambient glow accent inside scorecard, drawn as a radial gradient
              rather than a blurred element so it costs nothing to repaint. */}
          <div
            className={cn(
              "pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full",
              isPassed
                ? "bg-[radial-gradient(circle,rgba(5,150,105,0.28),transparent_70%)]"
                : "bg-[radial-gradient(circle,rgba(37,99,235,0.28),transparent_70%)]"
            )}
          />

          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-200">
                <Sparkles className="h-3.5 w-3.5" />
                {reviewData.mode === "EXAM" ? "Mock Exam Diagnostic Report" : "Practice Set Diagnostic Report"}
              </span>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {isPassed ? "Above the practice benchmark" : "Below the practice benchmark"}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                This platform marks {benchmarkMark} of {totalQuestions} correct ({Math.round(PASS_RATIO * 100)}%)
                as its study benchmark. The SOA does not publish a static pass mark for Exam FM, so treat
                this as a rigorous calibration metric rather than a prediction.
              </p>
            </div>

            {/* Scorecard Metric Block */}
            <div className="flex items-center gap-6 self-stretch rounded-2xl border border-white/15 bg-white/[0.04] p-5 md:self-auto shadow-inner">
              <div className="text-center">
                <div className="font-mono text-4xl font-black tabular-nums tracking-tight text-white">
                  {correctCount}
                  <span className="text-lg font-normal text-slate-400">/{totalQuestions}</span>
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Correct
                </div>
              </div>

              <div className="h-12 w-px bg-white/15" />

              <div className="text-center">
                <div className="font-mono text-4xl font-black tabular-nums tracking-tight text-sky-300">
                  {scorePercent}
                  <span className="text-lg font-normal text-slate-400">%</span>
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Score
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 border-t border-white/10 pt-6 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2.5">
              <Award className={cn("h-4 w-4", isPassed ? "text-emerald-400" : "text-amber-400")} />
              <span className="text-slate-400">Benchmark:</span>
              <span className={cn("font-bold text-sm", isPassed ? "text-emerald-300" : "text-amber-300")}>
                {isPassed ? "Met" : "Not met"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400">Active time:</span>
              <span className="font-mono font-bold text-white text-sm">{formatDuration(totalTimeSpentSeconds)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-slate-400">Paused time:</span>
              <span className="font-mono font-bold text-white text-sm">{formatDuration(totalPausedTimeSeconds)}</span>
            </div>
            <div className="flex items-center sm:justify-end">
              <Button asChild variant="secondary" size="sm" className="border-white/15 bg-white/10 text-white hover:bg-white/20">
                <Link href="/">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start a new exam
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ================= Calculator Analytics ================= */}
        <Card className="border-white/[0.08] bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-5 flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Calculator analytics</h2>
              <p className="text-xs text-slate-400">
                Performance correlation based on self-reported calculator marks during the exam.
              </p>
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {[
              { label: "Calculator used", metric: calculatorAnalytics.used },
              { label: "No calculator marked", metric: calculatorAnalytics.notUsed },
            ].map(({ label, metric }) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {label} · {metric.count} question{metric.count === 1 ? "" : "s"}
                </div>
                <div className="mt-2.5 flex items-baseline gap-6">
                  <div>
                    <span className="font-mono text-3xl font-black text-white">
                      {metric.accuracy === null ? "—" : `${metric.accuracy}%`}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">accuracy</span>
                  </div>
                  <div>
                    <span className="font-mono text-xl font-bold text-slate-200">
                      {metric.averageSeconds === null ? "—" : formatDuration(metric.averageSeconds)}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">avg time</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-[11px] leading-relaxed text-slate-400">
            Self-reported indicator for personal calibration. Use the comparison to pinpoint topics where calculator mechanics may be causing delays or errors.
          </p>
        </Card>

        {/* ================= Domain Diagnostics ================= */}
        <Card className="border-white/[0.08] bg-slate-900/60 p-6 shadow-xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Performance by syllabus domain</h2>
              <p className="text-xs text-slate-400">
                Select any domain tile to filter the detailed question review below.
              </p>
            </div>
            {weakestDomain && weakestDomain.percentage < 70 && (
              <Badge variant="warning" className="gap-1.5 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                Focus next on {weakestDomain.label}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
            {activeDomains.map((domain) => {
              const metric = domainMetrics[domain];
              if (!metric) return null;
              const styles = STATUS_STYLES[metric.status];
              const isSelected = selectedDomain === domain;

              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setSelectedDomain(isSelected ? "ALL" : domain)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isSelected
                      ? "border-blue-400/80 bg-blue-600/15 shadow-[0_0_20px_rgba(59,130,246,0.25)] ring-1 ring-blue-400/40"
                      : "border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                  )}
                >
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <span className="text-xs font-bold leading-tight text-white">{metric.label}</span>
                    <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", styles.badge)}>
                      {styles.label}
                    </span>
                  </div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-mono text-2xl font-black tabular-nums text-white">
                      {metric.percentage}%
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {metric.correct}/{metric.total}
                    </span>
                  </div>
                  <Progress value={metric.percentage} indicatorClassName={styles.bar} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* ================= Question Review ================= */}
        <div className="space-y-4">
          <Card className="flex flex-col items-start justify-between gap-3 border-white/[0.08] bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as QuestionFilter)}>
              <TabsList>
                <TabsTrigger value="ALL">All ({totalQuestions})</TabsTrigger>
                <TabsTrigger value="INCORRECT">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  Incorrect ({incorrectCount})
                </TabsTrigger>
                <TabsTrigger value="CORRECT">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Correct ({correctCount})
                </TabsTrigger>
                <TabsTrigger value="UNANSWERED">
                  <MinusCircle className="h-3.5 w-3.5 text-amber-400" />
                  Unanswered ({unansweredCount})
                </TabsTrigger>
                <TabsTrigger value="FLAGGED">
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  Flagged ({flaggedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {selectedDomain !== "ALL" && (
              <Button variant="link" size="sm" onClick={() => setSelectedDomain("ALL")} className="text-xs text-blue-400 hover:text-blue-300">
                Clear domain filter ({DOMAIN_LABELS[selectedDomain as keyof typeof DOMAIN_LABELS] ?? selectedDomain})
              </Button>
            )}
          </Card>

          {filteredQuestions.length === 0 ? (
            <Card className="border-white/[0.08] bg-slate-900/60 p-12 text-center text-sm text-slate-400">
              No questions match the current filter selection.
            </Card>
          ) : (
            <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-4">
              {filteredQuestions.map((question) => (
                <QuestionReviewItem
                  key={question.id}
                  question={question}
                  questionNumber={questionNumbers.get(question.id) ?? 0}
                />
              ))}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
};

function QuestionReviewItem({
  question,
  questionNumber,
}: {
  question: ExamQuestionData;
  questionNumber: number;
}) {
  const correctOption = question.renderedOptions.find((option) => option.isCorrect);
  const selectedOption = question.renderedOptions.find(
    (option) => option.key === question.selectedOption
  );
  const isUnanswered = question.selectedOption === null;

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-xl transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
        question.isCorrect
          ? "border-white/[0.08] bg-slate-900/60"
          : "border-red-500/30 bg-slate-900/60"
      )}
    >
      <AccordionItem value={question.id} className="border-b-0">
        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/[0.02]">
          <div className="flex items-center gap-3.5 text-left">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                question.isCorrect
                  ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : isUnanswered
                    ? "border border-amber-400/30 bg-amber-500/15 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                    : "border border-red-400/30 bg-red-500/15 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
              )}
            >
              {question.isCorrect ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isUnanswered ? (
                <MinusCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
            </span>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-white">Question {questionNumber}</span>
                <span className="text-white/20">•</span>
                <Badge variant="outline" className="border-blue-400/25 bg-blue-500/10 text-[10px] text-blue-300">
                  {DOMAIN_LABELS[question.domain]}
                </Badge>
                <Badge
                  variant={question.difficulty >= 3 ? "warning" : "muted"}
                  className="text-[10px]"
                >
                  {DIFFICULTY_LABELS[question.difficulty]}
                </Badge>
                {question.isFlagged && (
                  <Badge variant="warning" className="gap-1 text-[10px]">
                    <Bookmark className="h-3 w-3" />
                    Flagged
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {isUnanswered ? (
                  <span className="font-semibold text-amber-400">Not answered</span>
                ) : (
                  <>
                    Your answer:{" "}
                    <strong className={question.isCorrect ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      Option {question.selectedOption}
                    </strong>
                  </>
                )}
                {" · "}
                Correct answer: <strong className="text-emerald-400 font-bold">Option {correctOption?.key}</strong>
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="space-y-6 border-t border-white/[0.08] bg-slate-950/40 px-6 pt-6">
          {/* Question Prompt */}
          <section className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Question
            </h3>
            <MathRenderer
              content={question.renderedQuestion}
              className="exam-question exam-question-frame text-white"
            />
          </section>

          {/* Options Display */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Answer choices
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {question.renderedOptions.map((option) => {
                const isUserChoice = question.selectedOption === option.key;

                return (
                  <div
                    key={option.key}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-2xl border p-4 transition-[transform,background-color,border-color,box-shadow,color,opacity]",
                      option.isCorrect
                        ? "border-emerald-400/50 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : isUserChoice
                          ? "border-red-400/50 bg-red-950/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                          : "border-white/[0.07] bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-mono text-xs font-bold text-white">
                        {option.key}
                      </span>
                      <MathRenderer content={option.text} className="text-sm font-medium text-slate-100" />
                    </div>
                    {option.isCorrect ? (
                      <Badge variant="success" className="shrink-0 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Correct
                      </Badge>
                    ) : isUserChoice ? (
                      <Badge variant="destructive" className="shrink-0 text-[10px]">
                        <XCircle className="h-3 w-3" />
                        Your answer
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Distractor Explanation */}
          {!question.isCorrect && selectedOption?.distractorExplanation && (
            <section className="flex items-start gap-3.5 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                  Why option {selectedOption.key} is wrong —{" "}
                  {DISTRACTOR_LABELS[selectedOption.distractorType ?? ""] ?? "Common error"}
                </h3>
                <MathRenderer
                  content={selectedOption.distractorExplanation}
                  className="text-sm leading-relaxed text-amber-100"
                />
              </div>
            </section>
          )}

          {/* Worked Solution */}
          <section className="mb-2 space-y-3 rounded-2xl border border-white/[0.08] bg-slate-900/50 p-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Step-by-step worked solution</h3>
            </div>
            {question.objective && (
              <>
                <p className="text-xs text-slate-300">{question.objective}</p>
                {question.topics.length > 0 && (
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-white">
                      {question.steps} interdependent step{question.steps === 1 ? "" : "s"}
                    </span>{" "}
                    across {question.topics.map((topic) => TOPIC_LABELS[topic]).join(" + ")}.
                  </p>
                )}
                <Separator className="bg-white/10 my-2" />
              </>
            )}
            <MathRenderer content={question.solutionSteps} className="text-sm leading-relaxed text-slate-200" />
          </section>

          {/* Study Aids (Timeline + Calculator) */}
          <QuestionStudyAids question={question} />

          {/* Timing & Calibration Strip */}
          <section className="grid gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Time on question
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-white">
                {formatDuration(question.timeSpentSeconds ?? 0)}
                {(question.timeSpentSeconds ?? 0) > 300 && (
                  <span className="ml-2 font-sans text-xs font-normal text-amber-400">Above 5-minute pace</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Confidence calibration
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                {question.confidence === "SURE"
                  ? "Sure"
                  : question.confidence === "UNSURE"
                    ? "Unsure"
                    : question.confidence === "GUESS"
                      ? "Guess"
                      : "Not recorded"}
                {question.confidence === "SURE" && !question.isCorrect && (
                  <span className="ml-2 text-xs font-normal text-amber-400">Priority misconception</span>
                )}
                {question.confidence === "GUESS" && question.isCorrect && (
                  <span className="ml-2 text-xs font-normal text-blue-400">Review despite correct answer</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Calculator marker
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                {question.calculatorUsed ? "Calculator marked" : "No calculator marked"}
              </div>
            </div>
          </section>
        </AccordionContent>
      </AccordionItem>
    </Card>
  );
}

export default ExamReview;
