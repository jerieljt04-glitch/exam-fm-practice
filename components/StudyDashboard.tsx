"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Brain, CalendarClock, History, RotateCcw, Target, Trash2, Sparkles } from "lucide-react";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  domainMastery,
  dueTemplateIds,
  EMPTY_STUDY_HISTORY,
  mistakeTemplateIds,
  reviewDomains,
  readStudyHistory,
  STUDY_HISTORY_KEY,
  type StudyHistory,
} from "@/lib/study-history";
import type { TopicDomain } from "@/lib/types/exam";

interface StudyDashboardProps {
  onStartReview: (templateIds: string[], label: "due" | "mistakes", domains: TopicDomain[]) => void;
  isStarting: boolean;
}

export function StudyDashboard({ onStartReview, isStarting }: StudyDashboardProps) {
  const [history, setHistory] = useState<StudyHistory>(EMPTY_STUDY_HISTORY);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    setHistory(readStudyHistory(window.localStorage));
  }, []);

  // History is per-device, so clearing it is a local operation. Attempts and
  // mastery go; nothing about how the platform works changes.
  const clearHistory = () => {
    try {
      window.localStorage.removeItem(STUDY_HISTORY_KEY);
    } catch {
      // A browser with site data blocked has nothing stored to clear.
    }
    setHistory(EMPTY_STUDY_HISTORY);
    setConfirmingClear(false);
  };

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-2 gap-1.5 border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-400" /> Study analytics
          </Badge>
          <h2 id="study-dashboard-title" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Progress and spaced review
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Completed attempts are stored on this device; new practice questions still use fresh numbers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => onStartReview(due, "due", reviewDomains(history, due))}
            disabled={isStarting || due.length === 0}
            className="border-white/10 bg-white/[0.04] text-slate-200 hover:border-blue-400/30 hover:bg-white/[0.08]"
          >
            <CalendarClock className="h-4 w-4 text-sky-400" /> Review due ({due.length})
          </Button>
          <Button
            variant="secondary"
            onClick={() => onStartReview(mistakes, "mistakes", reviewDomains(history, mistakes))}
            disabled={isStarting || mistakes.length === 0}
            className="border-white/10 bg-slate-800/80 hover:border-indigo-400/30"
          >
            <RotateCcw className="h-4 w-4 text-indigo-400" /> Retry mistakes ({mistakes.length})
          </Button>
          {confirmingClear ? (
            <div className="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" onClick={clearHistory}>
                <Trash2 className="h-3.5 w-3.5" /> Confirm delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingClear(true)}
              disabled={history.attempts.length === 0}
              title="Delete the attempts and mastery stored on this device"
              className="text-slate-400 hover:text-slate-200"
            >
              <Trash2 className="h-4 w-4" /> Clear history
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: History, label: "Completed attempts", value: history.attempts.length, glow: "from-blue-600/20 to-sky-600/5", iconColor: "text-blue-400" },
          { icon: Target, label: "Average score", value: `${average}%`, glow: "from-indigo-600/20 to-purple-600/5", iconColor: "text-indigo-400" },
          { icon: Brain, label: "Best score", value: `${best}%`, glow: "from-emerald-600/20 to-teal-600/5", iconColor: "text-emerald-400" },
        ].map((metric) => (
          <Card key={metric.label} className="relative overflow-hidden border-white/[0.08] bg-slate-900/60 p-5">
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${metric.glow}`} />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] shadow-inner">
                <metric.icon className={`h-6 w-6 ${metric.iconColor}`} />
              </div>
              <div>
                <div className="text-3xl font-black tracking-tight tabular-nums text-white">{metric.value}</div>
                <div className="text-xs font-medium text-slate-400">{metric.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-white/[0.08] bg-slate-900/60 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h3 className="font-bold text-white">Learning-outcome coverage</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Accuracy across the distinct question skills you have attempted.</p>
          </div>
          {history.attempts.length === 0 && <Badge variant="muted">Complete a set to begin</Badge>}
        </div>
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-5">
          {mastery.map((item) => (
            <div
              key={item.domain}
              className="group space-y-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 hover:border-blue-400/30 hover:bg-white/[0.06]"
            >
              <div className="min-h-9 text-xs font-bold leading-tight text-slate-200">{item.label}</div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black tracking-tight tabular-nums text-white">{item.accuracy}%</span>
                <span className="text-[10px] font-medium text-slate-400">{item.attempted} skills</span>
              </div>
              <Progress value={item.accuracy} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      {history.attempts.length > 0 && (
        <div className="grid gap-3.5 md:grid-cols-3">
          {history.attempts.slice(0, 3).map((attempt) => (
            <Card key={attempt.sessionId} className="border-white/[0.08] bg-slate-900/50 p-5 transition-[transform,background-color,border-color,box-shadow,color,opacity] hover:border-white/15">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant={attempt.mode === "EXAM" ? "default" : "outline"} className="text-[10px] uppercase">
                  {attempt.mode === "EXAM" ? "Mock exam" : attempt.mode === "MISTAKES" ? "Mistake review" : "Practice"}
                </Badge>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(attempt.completedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-3xl font-black text-white">{attempt.scorePercent}%</div>
              <p className="mt-1 text-xs text-slate-300">
                {attempt.correctCount}/{attempt.totalQuestions} correct
                {attempt.averageSecondsPerQuestion > 0 ? ` · ${attempt.averageSecondsPerQuestion}s/question` : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
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
