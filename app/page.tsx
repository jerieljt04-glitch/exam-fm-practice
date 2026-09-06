"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  Calculator,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DOMAIN_DESCRIPTIONS,
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  EXAM_DURATION_MINUTES,
  EXAM_TOTAL_QUESTIONS,
  PASS_MARK,
  PASS_RATIO,
  QUESTIONS_PER_DOMAIN,
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

  const startExam = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "candidate-1" }),
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

          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={startExam} disabled={isStarting} className="w-full sm:w-auto">
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
                Five syllabus domains, {QUESTIONS_PER_DOMAIN} questions each
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Every sitting draws {QUESTIONS_PER_DOMAIN} distinct question types per domain, so no
                structure repeats within an exam.
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
                      {QUESTIONS_PER_DOMAIN} questions
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

              <Button onClick={startExam} disabled={isStarting} size="sm" className="w-full">
                Start practice attempt
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>
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
