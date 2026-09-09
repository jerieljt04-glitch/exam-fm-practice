"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Brain, CalendarClock, History, RotateCcw, Target } from "lucide-react";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  domainMastery,
  dueTemplateIds,
  EMPTY_STUDY_HISTORY,
  mistakeTemplateIds,
  readStudyHistory,
  type StudyHistory,
} from "@/lib/study-history";

interface StudyDashboardProps {
  onStartReview: (templateIds: string[], label: "due" | "mistakes") => void;
  isStarting: boolean;
}

export function StudyDashboard({ onStartReview, isStarting }: StudyDashboardProps) {
  const [history, setHistory] = useState<StudyHistory>(EMPTY_STUDY_HISTORY);

  useEffect(() => {
    setHistory(readStudyHistory(window.localStorage));
  }, []);

  const due = useMemo(() => dueTemplateIds(history), [history]);
  const mistakes = useMemo(() => mistakeTemplateIds(history), [history]);
  const mastery = useMemo(() => domainMastery(history), [history]);
  const average = history.attempts.length
    ? Math.round(history.attempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0) / history.attempts.length)
    : 0;
  const best = history.attempts.length
    ? Math.max(...history.attempts.map((attempt) => attempt.scorePercent))
    : 0;

  return (
    <section className="space-y-6" aria-labelledby="study-dashboard-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-2 gap-1.5 border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
            <BarChart3 className="h-3.5 w-3.5" /> Study analytics
          </Badge>
          <h2 id="study-dashboard-title" className="text-2xl font-black tracking-tight">
            Progress and spaced review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed attempts are stored on this device; new practice questions still use fresh numbers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onStartReview(due, "due")}
            disabled={isStarting || due.length === 0}
          >
            <CalendarClock className="h-4 w-4" /> Review due ({due.length})
          </Button>
          <Button
            variant="secondary"
            onClick={() => onStartReview(mistakes, "mistakes")}
            disabled={isStarting || mistakes.length === 0}
          >
            <RotateCcw className="h-4 w-4" /> Retry mistakes ({mistakes.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: History, label: "Completed attempts", value: history.attempts.length },
          { icon: Target, label: "Average score", value: `${average}%` },
          { icon: Brain, label: "Best score", value: `${best}%` },
        ].map((metric) => (
          <Card key={metric.label} className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <metric.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black tabular-nums">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Learning-outcome coverage</h3>
            <p className="text-xs text-muted-foreground">Accuracy across the distinct question skills you have attempted.</p>
          </div>
          {history.attempts.length === 0 && <Badge variant="muted">Complete a set to begin</Badge>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {mastery.map((item) => (
            <div key={item.domain} className="space-y-2 rounded-xl border bg-background/50 p-4">
              <div className="min-h-9 text-xs font-bold leading-tight">{item.label}</div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black tabular-nums">{item.accuracy}%</span>
                <span className="text-[10px] text-muted-foreground">{item.attempted} skills</span>
              </div>
              <Progress value={item.accuracy} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      {history.attempts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {history.attempts.slice(0, 3).map((attempt) => (
            <Card key={attempt.sessionId} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant={attempt.mode === "EXAM" ? "default" : "muted"}>
                  {attempt.mode === "EXAM" ? "Mock exam" : attempt.mode === "MISTAKES" ? "Mistake review" : "Practice"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(attempt.completedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-2xl font-black">{attempt.scorePercent}%</div>
              <p className="text-xs text-muted-foreground">
                {attempt.correctCount}/{attempt.totalQuestions} correct
                {attempt.averageSecondsPerQuestion > 0 ? ` · ${attempt.averageSecondsPerQuestion}s/question` : ""}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Calculator marked on {attempt.calculatorUseRate ?? 0}%
                {attempt.calculatorAccuracy !== null && attempt.calculatorAccuracy !== undefined
                  ? ` · ${attempt.calculatorAccuracy}% accuracy with it`
                  : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
