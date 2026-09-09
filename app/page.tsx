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
  Loader2,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  TimerOff,
  TrendingUp,
} from "lucide-react";

import { MathRenderer } from "@/components/MathRenderer";
import { StudyDashboard } from "@/components/StudyDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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

const DOMAIN_FORMULAS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY: "a(t) = \\exp\\left(\\int_0^t \\delta(s)\\,ds\\right)",
  ANNUITIES: "(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|} - n v^n}{i}",
  LOANS: "P_t = R \\cdot v^{\\,n-t+1}",
  BONDS: "P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n",
  ALM_IMMUNIZATION: "D_{\\text{mac}} = \\frac{\\sum t\\,C_t v^t}{P}",
};

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasClosed, setWasClosed] = useState(false);
  const [practiceCount, setPracticeCount] = useState(10);
  const [practiceTimed, setPracticeTimed] = useState(false);
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<TopicDomain[]>([...DOMAIN_ORDER]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([1, 2, 3]);

  // Set when the exam page redirects here because its sitting had ended.
  // Read from the URL directly rather than through useSearchParams, which would
  // force this page out of static rendering.
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

  const toggleDomain = (domain: TopicDomain) => {
    setSelectedDomains((current) =>
      current.includes(domain)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== domain)
        : [...current, domain]
    );
  };

  const toggleDifficulty = (difficulty: DifficultyLevel) => {
    setSelectedDifficulties((current) =>
      current.includes(difficulty)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== difficulty)
        : [...current, difficulty].sort()
    );
  };

  const startPractice = () =>
    startExam({
      mode: "PRACTICE",
      totalQuestions: practiceCount,
      domains: selectedDomains,
      difficulties: selectedDifficulties,
      isTimed: practiceTimed,
      includeLegacy,
    });

  const startReview = (templateIds: string[], label: "due" | "mistakes") =>
    startExam({
      mode: "MISTAKES",
      totalQuestions: Math.min(15, templateIds.length),
      templateIds,
      difficulties: [1, 2, 3, 4],
      isTimed: false,
      includeLegacy: true,
      reviewLabel: label,
    });

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-sky-500 text-sm font-black text-white shadow-md shadow-blue-500/20">
              FM
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight">
                Exam FM Practice Platform
              </span>
              <span className="-mt-0.5 block font-mono text-[11px] text-blue-400">
                Financial mathematics CBT simulator
              </span>
            </div>
          </div>

          <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Independent study tool
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl space-y-6 pt-4 text-center">
          <Badge variant="outline" className="gap-2 border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Calculator className="h-3.5 w-3.5" />
            Computer-based testing simulation
          </Badge>

          <h1 className="text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            Practice for{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Exam FM
            </span>{" "}
            under exam conditions
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {EXAM_TOTAL_QUESTIONS} multiple-choice questions in {EXAM_DURATION_MINUTES} minutes, with
            fresh numbers on every attempt, wrong answers built from the mistakes candidates actually
            make, a pause/resume clock, and a full worked solution for every question.
          </p>

          {wasClosed && (
            <p className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
              That exam ended when you closed it. Start a new one below — the questions will be
              different.
            </p>
          )}

          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => void startExam({ mode: "EXAM" })} disabled={isStarting} className="w-full sm:w-auto">
              {isStarting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating {EXAM_TOTAL_QUESTIONS} questions
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  Start a {EXAM_TOTAL_QUESTIONS}-question mock exam
                </>
              )}
            </Button>

            {error && (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-400" /> {EXAM_DURATION_MINUTES} minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-sky-400" /> {EXAM_TOTAL_QUESTIONS} questions,
              options A–E
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-emerald-400" /> {Math.round(PASS_RATIO * 100)}%
              benchmark ({PASS_MARK}/{EXAM_TOTAL_QUESTIONS})
            </span>
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-950 via-blue-950/50 to-slate-950 p-6 shadow-2xl sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <Badge variant="outline" className="gap-2 border-sky-500/30 bg-sky-500/10 text-sky-300">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Practice Mode
            </Badge>
            <h2 className="text-2xl font-black">Build a targeted study set</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Choose exactly what to train. Practice Mode gives immediate feedback, optional formulas,
              confidence tracking, and a fresh worked example every time.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <BookOpenCheck className="mb-2 h-5 w-5 text-sky-400" />
                <div className="text-sm font-bold">Immediate teaching</div>
                <div className="mt-1 text-xs text-slate-400">See why an option is wrong and open the solution before moving on.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <TimerOff className="mb-2 h-5 w-5 text-indigo-400" />
                <div className="text-sm font-bold">Your pace</div>
                <div className="mt-1 text-xs text-slate-400">Train untimed or use the exam pace of five minutes per question.</div>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Questions</div>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 30].map((count) => (
                  <Button
                    key={count}
                    type="button"
                    size="sm"
                    variant={practiceCount === count ? "default" : "outline"}
                    onClick={() => setPracticeCount(count)}
                    className={practiceCount === count ? "" : "border-white/15 bg-white/5 text-slate-200"}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Domains</div>
              <div className="flex flex-wrap gap-2">
                {DOMAIN_ORDER.map((domain) => (
                  <Button
                    key={domain}
                    type="button"
                    size="sm"
                    variant={selectedDomains.includes(domain) ? "secondary" : "outline"}
                    onClick={() => toggleDomain(domain)}
                    aria-pressed={selectedDomains.includes(domain)}
                    className={!selectedDomains.includes(domain) ? "border-white/15 bg-white/5 text-slate-300" : ""}
                  >
                    {DOMAIN_LABELS[domain]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Difficulty</div>
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3, 4] as DifficultyLevel[]).map((difficulty) => (
                  <Button
                    key={difficulty}
                    type="button"
                    size="sm"
                    variant={selectedDifficulties.includes(difficulty) ? "secondary" : "outline"}
                    onClick={() => toggleDifficulty(difficulty)}
                    aria-pressed={selectedDifficulties.includes(difficulty)}
                    className={!selectedDifficulties.includes(difficulty) ? "border-white/15 bg-white/5 text-slate-300" : ""}
                  >
                    {difficulty === 1 ? "Basic" : difficulty === 2 ? "Intermediate" : difficulty === 3 ? "Advanced" : "Challenge"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={practiceTimed ? "secondary" : "outline"}
                onClick={() => setPracticeTimed((value) => !value)}
                aria-pressed={practiceTimed}
                className={!practiceTimed ? "border-white/15 bg-white/5 text-slate-300" : ""}
              >
                <Clock className="h-4 w-4" /> {practiceTimed ? "Timed" : "Untimed"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={includeLegacy ? "secondary" : "outline"}
                onClick={() => setIncludeLegacy((value) => !value)}
                aria-pressed={includeLegacy}
                className={!includeLegacy ? "border-white/15 bg-white/5 text-slate-300" : ""}
              >
                Legacy swaps/rate topics: {includeLegacy ? "On" : "Off"}
              </Button>
            </div>

            <Button size="lg" onClick={() => void startPractice()} disabled={isStarting} className="w-full">
              {isStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
              Start {practiceCount}-question practice set
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Timed, pausable sitting",
              body: `A ${EXAM_DURATION_MINUTES}-minute countdown driven by wall-clock timestamps, so reloading the page never gives or takes time. Pausing stops the clock and hides every question.`,
              tint: "text-blue-400 bg-blue-500/10 border-blue-500/20",
            },
            {
              icon: TrendingUp,
              title: "Fresh numbers every attempt",
              body: "Interest rates, terms, compounding frequencies, coupons and cash flow timings are drawn at random within valid bounds, so no two sittings pose the same question twice.",
              tint: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
            },
            {
              icon: ShieldCheck,
              title: "Distractors from real mistakes",
              body: "Each wrong option is computed by simulating a specific error — annuity-due confusion, simple interest, an off-by-one period, or a nominal-rate slip — and the review names it.",
              tint: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="space-y-3.5 rounded-2xl border border-border/80 bg-card/70 p-6 shadow-lg transition-colors hover:border-border"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${pillar.tint}`}>
                <pillar.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold">{pillar.title}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-6 rounded-2xl border border-border bg-card/80 p-8 shadow-xl">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-border pb-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">
                Current Exam FM syllabus blueprint
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each mock exam varies the domain counts inside the current published percentage ranges.
              </p>
            </div>
            <Badge variant="success" className="font-mono">
              {EXAM_TOTAL_QUESTIONS} questions
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOMAIN_ORDER.map((domain, index) => (
              <div
                key={domain}
                className="flex flex-col justify-between space-y-2.5 rounded-xl border border-border/80 bg-background/60 p-5 transition-colors hover:border-border"
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold tracking-wider text-blue-400">
                      TOPIC {String(index + 1).padStart(2, "0")}
                    </span>
                    <Badge variant="muted" className="text-[10px] uppercase">
                      {DOMAIN_QUESTION_RANGES[domain].min}–{DOMAIN_QUESTION_RANGES[domain].max} questions
                    </Badge>
                  </div>
                  <h3 className="mb-1 text-sm font-bold">{DOMAIN_LABELS[domain]}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {DOMAIN_DESCRIPTIONS[domain]}
                  </p>
                </div>
                <MathRenderer
                  content={`$${DOMAIN_FORMULAS[domain]}$`}
                  className="scrollbar-slim overflow-x-auto border-t border-border/60 pt-2 text-xs text-sky-300"
                />
              </div>
            ))}

            <div className="flex flex-col justify-between space-y-4 rounded-xl border border-blue-600/40 bg-gradient-to-br from-blue-900/50 via-indigo-900/40 to-slate-900 p-6 shadow-lg">
              <div>
                <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                  After you submit
                </span>
                <h3 className="mt-1 text-base font-extrabold">Full diagnostic report</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  A score out of {EXAM_TOTAL_QUESTIONS}, a percentage for each domain, the specific
                  error behind every wrong option you chose, and a complete step-by-step derivation
                  rendered in KaTeX.
                </p>
              </div>

              <Button onClick={() => void startExam({ mode: "EXAM" })} disabled={isStarting} size="sm" className="w-full">
                Start full mock exam
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>

        <StudyDashboard onStartReview={(ids, label) => void startReview(ids, label)} isStarting={isStarting} />
      </main>

      <footer className="border-t border-border/80 bg-background py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl px-4 leading-relaxed">
          An independent study tool for SOA Exam FM (Financial Mathematics). Not affiliated with,
          endorsed by, or sponsored by the Society of Actuaries. Question content is generated by
          this application and is not drawn from any official examination.
        </p>
      </footer>
    </div>
  );
}
