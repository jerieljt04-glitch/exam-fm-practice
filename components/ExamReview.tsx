"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  MinusCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { MathRenderer } from "./MathRenderer";
import { VideoPlayer } from "./VideoPlayer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { DOMAIN_LABELS, DOMAIN_ORDER, PASS_MARK, PASS_RATIO } from "@/lib/exam-config";
import type { ExamQuestionData, ExamReviewData, ProficiencyStatus } from "@/lib/types/exam";
import { cn } from "@/lib/utils";

interface ExamReviewProps {
  reviewData: ExamReviewData;
}

type QuestionFilter = "ALL" | "INCORRECT" | "CORRECT" | "UNANSWERED" | "FLAGGED";

const STATUS_STYLES: Record<ProficiencyStatus, { badge: string; bar: string; label: string }> = {
  MASTERED: { badge: "bg-success/10 text-success border-success/30", bar: "bg-success", label: "Mastered" },
  ADEQUATE: { badge: "bg-primary/10 text-primary border-primary/30", bar: "bg-primary", label: "Adequate" },
  NEEDS_IMPROVEMENT: {
    badge: "bg-warning/10 text-warning border-warning/30",
    bar: "bg-warning",
    label: "Needs work",
  },
  CRITICAL: {
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    bar: "bg-destructive",
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

  const questionNumbers = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((question, index) => map.set(question.id, index + 1));
    return map;
  }, [questions]);

  const incorrectCount = totalQuestions - correctCount;
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

  const weakestDomain = useMemo(
    () =>
      DOMAIN_ORDER.map((domain) => domainMetrics[domain]).reduce(
        (weakest, metric) => (metric && metric.percentage < weakest.percentage ? metric : weakest),
        domainMetrics[DOMAIN_ORDER[0]]
      ),
    [domainMetrics]
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* ================= Scorecard ================= */}
        <section
          className={cn(
            "rounded-2xl border p-6 text-slate-100 shadow-lg sm:p-8",
            isPassed
              ? "border-emerald-700/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950"
              : "border-slate-800 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950"
          )}
        >
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                Practice exam report
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {isPassed
                  ? "Above the practice benchmark"
                  : "Below the practice benchmark"}
              </h1>
              <p className="max-w-xl text-sm text-slate-300">
                This platform marks {PASS_MARK} of {totalQuestions} correct ({Math.round(PASS_RATIO * 100)}%)
                as its benchmark. The SOA does not publish a fixed pass mark for Exam FM, so treat
                this as a study signal rather than a prediction.
              </p>
            </div>

            <div className="flex items-center gap-5 self-stretch rounded-xl border border-white/10 bg-white/5 p-4 md:self-auto">
              <div className="text-center">
                <div className="font-mono text-4xl font-black tabular-nums tracking-tight">
                  {correctCount}
                  <span className="text-lg font-normal text-slate-400">/{totalQuestions}</span>
                </div>
                <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Correct
                </div>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="text-center">
                <div className="font-mono text-4xl font-black tabular-nums tracking-tight text-blue-300">
                  {scorePercent}
                  <span className="text-lg font-normal text-slate-400">%</span>
                </div>
                <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Score
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/10 pt-6 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <Award className={cn("h-4 w-4", isPassed ? "text-emerald-400" : "text-amber-400")} />
              <span className="text-slate-300">Benchmark:</span>
              <span className={cn("font-bold", isPassed ? "text-emerald-300" : "text-amber-300")}>
                {isPassed ? "Met" : "Not met"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-slate-300">Active time:</span>
              <span className="font-semibold text-white">{formatDuration(totalTimeSpentSeconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-slate-300">Paused:</span>
              <span className="font-semibold text-white">{formatDuration(totalPausedTimeSeconds)}</span>
            </div>
            <div className="flex items-center sm:justify-end">
              <Button asChild variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20">
                <Link href="/">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start a new exam
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ================= Domain diagnostics ================= */}
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Performance by syllabus domain</h2>
              <p className="text-xs text-muted-foreground">
                Select a domain to filter the question review below.
              </p>
            </div>
            {weakestDomain && weakestDomain.percentage < 70 && (
              <Badge variant="warning" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Focus next on {weakestDomain.label}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {DOMAIN_ORDER.map((domain) => {
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
                    "rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "bg-muted/40 hover:border-primary/40"
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-xs font-bold leading-tight">{metric.label}</span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold", styles.badge)}>
                      {styles.label}
                    </span>
                  </div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-xl font-extrabold tabular-nums">
                      {metric.percentage}%
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {metric.correct}/{metric.total}
                    </span>
                  </div>
                  <Progress value={metric.percentage} indicatorClassName={styles.bar} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* ================= Question review ================= */}
        <div className="space-y-4">
          <Card className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as QuestionFilter)}>
              <TabsList>
                <TabsTrigger value="ALL">All ({totalQuestions})</TabsTrigger>
                <TabsTrigger value="INCORRECT">
                  <XCircle className="h-3.5 w-3.5" />
                  Incorrect ({incorrectCount})
                </TabsTrigger>
                <TabsTrigger value="CORRECT">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Correct ({correctCount})
                </TabsTrigger>
                <TabsTrigger value="UNANSWERED">
                  <MinusCircle className="h-3.5 w-3.5" />
                  Unanswered ({unansweredCount})
                </TabsTrigger>
                <TabsTrigger value="FLAGGED">
                  <Bookmark className="h-3.5 w-3.5" />
                  Flagged ({flaggedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {selectedDomain !== "ALL" && (
              <Button variant="link" size="sm" onClick={() => setSelectedDomain("ALL")}>
                Clear domain filter
              </Button>
            )}
          </Card>

          {filteredQuestions.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No questions match the current filters.
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
        "overflow-hidden",
        question.isCorrect ? "border-border" : "border-destructive/30"
      )}
    >
      <AccordionItem value={question.id} className="border-b-0">
        <AccordionTrigger className="px-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <span
              className={cn(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                question.isCorrect
                  ? "bg-success/15 text-success"
                  : isUnanswered
                    ? "bg-warning/15 text-warning"
                    : "bg-destructive/15 text-destructive"
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
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold">Question {questionNumber}</span>
                <span className="text-muted-foreground">•</span>
                <Badge variant="muted" className="text-[10px]">
                  {DOMAIN_LABELS[question.domain]}
                </Badge>
                {question.isFlagged && (
                  <Badge variant="warning" className="gap-1 text-[10px]">
                    <Bookmark className="h-3 w-3" />
                    Flagged
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isUnanswered ? (
                  <span className="font-semibold text-warning">Not answered</span>
                ) : (
                  <>
                    Your answer:{" "}
                    <strong className={question.isCorrect ? "text-success" : "text-destructive"}>
                      {question.selectedOption}
                    </strong>
                  </>
                )}
                {" · "}
                Correct answer: <strong className="text-success">{correctOption?.key}</strong>
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="space-y-6 border-t bg-muted/30 px-6 pt-6">
          <section className="rounded-xl border bg-card p-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Question
            </h3>
            <MathRenderer
              content={question.renderedQuestion}
              className="text-base leading-relaxed"
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Answer choices
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {question.renderedOptions.map((option) => {
                const isUserChoice = question.selectedOption === option.key;

                return (
                  <div
                    key={option.key}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border p-4",
                      option.isCorrect
                        ? "border-success/50 bg-success/5"
                        : isUserChoice
                          ? "border-destructive/50 bg-destructive/5"
                          : "bg-card"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {option.key}
                      </span>
                      <MathRenderer content={option.text} className="text-sm font-medium" />
                    </div>
                    {option.isCorrect ? (
                      <Badge variant="success" className="flex-shrink-0 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Correct
                      </Badge>
                    ) : isUserChoice ? (
                      <Badge variant="destructive" className="flex-shrink-0 text-[10px]">
                        <XCircle className="h-3 w-3" />
                        Your answer
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {!question.isCorrect && selectedOption?.distractorExplanation && (
            <section className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <div>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-warning">
                  Why option {selectedOption.key} is wrong —{" "}
                  {DISTRACTOR_LABELS[selectedOption.distractorType ?? ""] ?? "Common error"}
                </h3>
                <MathRenderer
                  content={selectedOption.distractorExplanation}
                  className="text-sm leading-relaxed"
                />
              </div>
            </section>
          )}

          <section className="space-y-3 rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Step-by-step solution</h3>
            </div>
            {question.objective && (
              <>
                <p className="text-xs text-muted-foreground">{question.objective}</p>
                <Separator />
              </>
            )}
            <MathRenderer content={question.solutionSteps} className="text-sm leading-relaxed" />
          </section>

          <section className="space-y-2 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Video walkthrough
            </h3>
            <VideoPlayer
              videoUrl={question.videoUrl}
              title={`Question ${questionNumber} — ${question.templateTitle}`}
            />
          </section>
        </AccordionContent>
      </AccordionItem>
    </Card>
  );
}

export default ExamReview;
