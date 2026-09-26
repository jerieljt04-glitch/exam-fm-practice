"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  Calculator,
  ChevronRight,
  Clock,
  Compass,
  Loader2,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerOff,
  TrendingUp,
  Zap,
} from "lucide-react";

import { MathRenderer } from "@/components/MathRenderer";
import { DOMAIN_FORMULAS } from "@/lib/math/reference-formulas";
import { StudyDashboard } from "@/components/StudyDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_DIFFICULTIES,
  DOMAIN_DESCRIPTIONS,
  DOMAIN_LABELS,
  DOMAIN_QUESTION_RANGES,
  DOMAIN_ORDER,
  EXAM_DURATION_MINUTES,
  EXAM_TOTAL_QUESTIONS,
  PASS_MARK,
  PASS_RATIO,
  type DifficultyLevel,
} from "@/lib/exam-config";
import type { TopicDomain } from "@/lib/types/exam";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasClosed, setWasClosed] = useState(false);
  const [practiceCount, setPracticeCount] = useState(10);
  const [practiceTimed, setPracticeTimed] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<TopicDomain[]>([...DOMAIN_ORDER]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([
    ...DEFAULT_DIFFICULTIES,
  ]);

  // Set when the exam page redirects here because its sitting had ended.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("closed")) {
      setWasClosed(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const startExam = async (options: Record<string, unknown> = { mode: "EXAM" }) => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "candidate-1", ...options }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.session) {
        throw new Error(data.error ?? "The exam could not be generated.");
      }
      router.push(`/exam/${data.session.id}`);
    } catch (caught) {
      console.error("Failed to start exam:", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while generating the exam. Please try again."
      );
      setIsStarting(false);
    }
  };

  /**
   * Domain selector helper logic:
   * First click from all-selected isolates that domain;
   * subsequent clicks toggle on/off with at least one remaining.
   */
  const toggleDomain = (domain: TopicDomain) => {
    setSelectedDomains((current) => {
      if (current.length === DOMAIN_ORDER.length) return [domain];
      if (!current.includes(domain)) {
        return DOMAIN_ORDER.filter((item) => current.includes(item) || item === domain);
      }
      return current.length === 1 ? current : current.filter((item) => item !== domain);
    });
  };

  const selectAllDomains = () => setSelectedDomains([...DOMAIN_ORDER]);

  const toggleDifficulty = (difficulty: DifficultyLevel) => {
    setSelectedDifficulties((current) => {
      if (current.length === DEFAULT_DIFFICULTIES.length) return [difficulty];
      if (!current.includes(difficulty)) {
        return DEFAULT_DIFFICULTIES.filter((item) => current.includes(item) || item === difficulty);
      }
      return current.length === 1 ? current : current.filter((item) => item !== difficulty);
    });
  };

  const selectAllDifficulties = () => setSelectedDifficulties([...DEFAULT_DIFFICULTIES]);

  const startPractice = () =>
    startExam({
      mode: "PRACTICE",
      totalQuestions: practiceCount,
      domains: selectedDomains,
      difficulties: selectedDifficulties,
      isTimed: practiceTimed,
    });

  // `domains` are the topics of the reviewed questions: if a question's
  // template has since been retired, the review draws fresh questions on the
  // same topics instead.
  const startReview = (templateIds: string[], label: "due" | "mistakes", domains: TopicDomain[]) =>
    startExam({
      mode: "MISTAKES",
      totalQuestions: Math.min(15, templateIds.length),
      templateIds,
      domains,
      difficulties: [1, 2, 3, 4],
      isTimed: false,
      reviewLabel: label,
    });

  return (
    <div className="flex min-h-screen flex-col text-foreground selection:bg-blue-500/30 selection:text-white">
      {/* ================= Glass Floating Header ================= */}
      {/* Sticky, so page content really does scroll behind it — one of the few
          places a backdrop-filter earns its cost. */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080c15]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/40 bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black tracking-wider text-white shadow-lg shadow-blue-500/30 before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-white/30 before:content-['']">
              FM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="block text-sm font-black tracking-tight text-white sm:text-base">
                  Exam FM Practice
                </span>
                <span className="hidden rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300 md:inline-block">
                  CBT Simulator
                </span>
              </div>
              <span className="-mt-0.5 block text-[11px] font-medium text-slate-400">
                Financial mathematics · interactive practice & diagnostic review
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Independent study tool
            </div>
          </div>
        </div>
      </header>

      {/* ================= Main Glass Content Area ================= */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-3xl space-y-7 pt-2 text-center sm:pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>Interactive Exam Workspace</span>
          </div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">
            Master every calculation on{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-sm">
              Exam FM
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Work through an official-cadence {EXAM_TOTAL_QUESTIONS}-question timed mock exam or build targeted practice sets.
            Every problem features fresh randomized values, error-driven distractor analysis, and step-by-step KaTeX solutions.
          </p>

          {wasClosed && (
            <div className="mx-auto flex max-w-md items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 shadow-lg">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <p>
                Your previous sitting concluded when the tab was closed. Start a fresh exam below with newly generated parameters.
              </p>
            </div>
          )}

          {/* Primary CTA and Error Display */}
          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => void startExam({ mode: "EXAM" })}
              disabled={isStarting}
              className="relative h-13 min-w-[240px] px-8 text-base font-bold shadow-[0_0_35px_rgba(37,99,235,0.4)]"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating {EXAM_TOTAL_QUESTIONS} questions...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  Start full mock exam
                </>
              )}
            </Button>

            {error && (
              <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/15 px-3.5 py-2 text-xs font-medium text-red-200">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                {error}
              </p>
            )}
          </div>

          {/* Glass Spec Ribbon */}
          <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-x-6 gap-y-2.5 rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-3 text-xs font-semibold text-slate-300 shadow-lg">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" /> {EXAM_DURATION_MINUTES} minutes countdown
            </span>
            <span className="h-3 w-px bg-white/10 hidden sm:block" />
            <span className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-sky-400" /> {EXAM_TOTAL_QUESTIONS} questions · options A–E
            </span>
            <span className="h-3 w-px bg-white/10 hidden sm:block" />
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-400" /> {Math.round(PASS_RATIO * 100)}% benchmark ({PASS_MARK}/{EXAM_TOTAL_QUESTIONS})
            </span>
          </div>
        </section>

        {/* ================= Practice Studio Section ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-slate-900/55 p-6 shadow-2xl sm:p-9 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
          {/* Soft corner washes drawn as radial gradients. A gradient is
              rasterised once; a blurred element is re-filtered on every
              repaint, so this looks the same and costs far less. */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16),transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.16),transparent_70%)]" />

          {/* Left Feature Column */}
          <div className="space-y-5">
            <Badge variant="outline" className="gap-2 border-sky-400/30 bg-sky-500/10 text-sky-300">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Practice Mode
            </Badge>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Build a targeted study set</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Customize your study experience. Practice Mode offers immediate teaching, formula lookups,
              confidence markers, and step-by-step worked derivations for each problem.
            </p>

            <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-[transform,background-color,border-color,box-shadow,color,opacity] hover:border-blue-400/30 hover:bg-white/[0.06]">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/15 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold text-white">Immediate teaching</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">
                  See why an option is a distractor immediately and open the worked solution before moving on.
                </div>
              </div>

              <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-[transform,background-color,border-color,box-shadow,color,opacity] hover:border-indigo-400/30 hover:bg-white/[0.06]">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                  <TimerOff className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold text-white">Your own pace</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">
                  Train untimed to focus on derivations, or turn the clock on to simulate exam pacing.
                </div>
              </div>
            </div>
          </div>

          {/* Right Config Deck */}
          <div className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-slate-950/50 p-6 lg:mt-0">
            {/* Question count selector */}
            <div>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Number of questions
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map((count) => {
                  const isSelected = practiceCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPracticeCount(count)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                        isSelected
                          ? "border border-blue-400/50 bg-blue-600/25 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/40"
                          : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                      )}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Syllabus Domain Filter */}
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Subjects</span>
                {selectedDomains.length < DOMAIN_ORDER.length && (
                  <button
                    type="button"
                    onClick={selectAllDomains}
                    className="text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300 hover:underline"
                  >
                    Select all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DOMAIN_ORDER.map((domain) => {
                  const isSelected = selectedDomains.includes(domain);
                  return (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => toggleDomain(domain)}
                      aria-pressed={isSelected}
                      className={cn(
                        "rounded-xl px-3.5 py-2 text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                        isSelected
                          ? "border border-blue-400/40 bg-blue-600/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                          : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
                      )}
                    >
                      {DOMAIN_LABELS[domain]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {selectedDomains.length === DOMAIN_ORDER.length
                  ? "All 5 syllabus domains selected. Click any subject to study it in isolation."
                  : `Focusing on: ${selectedDomains.map((domain) => DOMAIN_LABELS[domain]).join(", ")}.`}
              </p>
            </div>

            {/* Difficulty Level Filter */}
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Difficulty</span>
                {selectedDifficulties.length < DEFAULT_DIFFICULTIES.length && (
                  <button
                    type="button"
                    onClick={selectAllDifficulties}
                    className="text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300 hover:underline"
                  >
                    Select all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([1, 2, 3, 4] as DifficultyLevel[]).map((difficulty) => {
                  const isSelected = selectedDifficulties.includes(difficulty);
                  const labels = { 1: "Basic", 2: "Intermediate", 3: "Advanced", 4: "Challenge" };
                  const colors = {
                    1: "border-sky-400/40 bg-sky-500/20 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.2)]",
                    2: "border-blue-400/40 bg-blue-500/20 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]",
                    3: "border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
                    4: "border-red-400/40 bg-red-500/20 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.2)]",
                  };
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => toggleDifficulty(difficulty)}
                      aria-pressed={isSelected}
                      className={cn(
                        "rounded-xl py-2 px-2 text-center text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
                        isSelected
                          ? colors[difficulty]
                          : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
                      )}
                    >
                      {labels[difficulty]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPracticeTimed((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-[transform,background-color,border-color,box-shadow,color,opacity]",
                  practiceTimed
                    ? "border-blue-400/40 bg-blue-500/20 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                )}
              >
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span>{practiceTimed ? "Timed (5 min/q)" : "Untimed"}</span>
              </button>

            </div>

            {/* Start Practice Button */}
            <Button
              size="lg"
              onClick={() => void startPractice()}
              disabled={isStarting}
              className="w-full text-base font-bold shadow-lg shadow-blue-500/20"
            >
              {isStarting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              Start {practiceCount}-question practice set
            </Button>
          </div>
        </section>

        {/* ================= Core Pillars (3 Glass Cards) ================= */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Wall-clock timed sitting",
              body: `A strict ${EXAM_DURATION_MINUTES}-minute countdown driven by real timestamps so page refreshes never alter time. Pausing halts the clock and conceals questions.`,
              accent: "from-blue-500/20 to-sky-500/5",
              iconTint: "text-blue-400 border-blue-400/30 bg-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.25)]",
            },
            {
              icon: TrendingUp,
              title: "Fresh numbers every attempt",
              body: "Interest rates, terms, compounding modes, and cash flow structures are generated parametrically so you never encounter identical numbers twice.",
              accent: "from-indigo-500/20 to-purple-500/5",
              iconTint: "text-indigo-400 border-indigo-400/30 bg-indigo-500/15 shadow-[0_0_15px_rgba(99,102,241,0.25)]",
            },
            {
              icon: ShieldCheck,
              title: "Distractors from real mistakes",
              body: "Every incorrect choice models a genuine candidate slip — annuity-due timing, simple interest, or nominal conversions — and the review explains exactly which was picked.",
              accent: "from-emerald-500/20 to-teal-500/5",
              iconTint: "text-emerald-400 border-emerald-400/30 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.25)]",
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="group relative space-y-3.5 rounded-2xl border border-white/[0.08] bg-slate-900/55 p-6 transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-300 hover:border-white/20 hover:bg-slate-900/70 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40"
            >
              <div className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${pillar.accent} opacity-60 transition-opacity group-hover:opacity-100`} />
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", pillar.iconTint)}>
                <pillar.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{pillar.title}</h3>
              <p className="text-xs leading-relaxed text-slate-300">{pillar.body}</p>
            </div>
          ))}
        </section>

        {/* ================= Syllabus Blueprint Explorer ================= */}
        <section className="relative space-y-6 rounded-3xl border border-white/[0.09] bg-slate-900/55 p-7 shadow-2xl sm:p-9">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-blue-400" />
                <h2 className="text-xl font-black text-white sm:text-2xl">
                  Official Exam FM syllabus blueprint
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Each mock exam reflects published Society of Actuaries percentage distributions.
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 font-mono text-emerald-300">
              {EXAM_TOTAL_QUESTIONS} questions per sitting
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOMAIN_ORDER.map((domain, index) => (
              <div
                key={domain}
                className="group flex flex-col justify-between space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 hover:border-blue-400/30 hover:bg-white/[0.05]"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-black tracking-wider text-blue-400">
                      TOPIC {String(index + 1).padStart(2, "0")}
                    </span>
                    <Badge variant="muted" className="text-[10px] uppercase font-mono">
                      {DOMAIN_QUESTION_RANGES[domain].min}–{DOMAIN_QUESTION_RANGES[domain].max} questions
                    </Badge>
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-white">{DOMAIN_LABELS[domain]}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {DOMAIN_DESCRIPTIONS[domain]}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                  <MathRenderer
                    content={`$${DOMAIN_FORMULAS[domain]}$`}
                    className="scrollbar-slim overflow-x-auto text-xs text-sky-300"
                  />
                </div>
              </div>
            ))}

            {/* 6th Diagnostic Report Glass Card */}
            <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-slate-950/80 p-6 shadow-xl">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                  <Zap className="h-3 w-3" /> Diagnostic Engine
                </span>
                <h3 className="mt-2 text-base font-black text-white">Full post-exam review</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Scores out of {EXAM_TOTAL_QUESTIONS}, percentage breakdowns for each domain, specific error tags
                  for every distractor picked, and fully typeset KaTeX derivations.
                </p>
              </div>

              <Button
                onClick={() => void startExam({ mode: "EXAM" })}
                disabled={isStarting}
                size="sm"
                className="w-full text-xs font-bold"
              >
                Launch mock exam
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>

        {/* ================= Study Dashboard Component ================= */}
        <StudyDashboard onStartReview={(ids, label, domains) => void startReview(ids, label, domains)} isStarting={isStarting} />
      </main>

      {/* ================= Glass Footer ================= */}
      <footer className="border-t border-white/[0.08] bg-[#080c15]/80 py-8 text-center text-xs text-slate-400">
        <p className="mx-auto max-w-2xl px-4 leading-relaxed">
          An independent study tool for SOA Exam FM (Financial Mathematics). Not affiliated with,
          endorsed by, or sponsored by the Society of Actuaries. Question content is generated parametrically
          and is not drawn from any official confidential examination.
        </p>
      </footer>
    </div>
  );
}
