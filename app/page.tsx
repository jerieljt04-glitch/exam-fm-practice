"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Play,
  Calculator,
  ShieldCheck,
  TrendingUp,
  Award,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";

export default function HomePage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const startExam = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "actuarial-candidate" }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        router.push(`/exam/${data.session.id}`);
      } else {
        throw new Error(data.error || "Failed to start exam");
      }
    } catch (err: any) {
      alert("Error generating exam: " + err.message);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20">
              FM
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                SOA Exam FM Practice Platform
              </span>
              <span className="text-[11px] text-blue-400 font-mono block -mt-0.5">
                Financial Mathematics CBT Simulation Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SOA 2026 Syllabus Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-semibold tracking-wide shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Computer-Based Testing (CBT) Simulation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15]">
            Master Society of Actuaries{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Exam FM
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
            Experience authentic Prometric CBT test conditions: 30 dynamic multiple-choice questions,
            algorithmic distractor modeling targeting classic student traps, real-time pause/resume timing, and
            step-by-step KaTeX mathematical derivations.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={startExam}
              disabled={isStarting}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-3 group border border-blue-400/30"
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating 30 Unique Questions...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110 text-white" />
                  <span>Launch Official Mock Exam (30 Questions)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> 150 Minutes (2.5 Hours)
            </span>
            <span className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-sky-400" /> 30 Multiple Choice (A–E)
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-400" /> 70% Pass Standard (21/30)
            </span>
          </div>
        </section>

        {/* 3 Core Architecture Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 shadow-lg hover:border-slate-700 transition-all space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">150 Minutes Timed CBT</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full 2.5-hour countdown timer with high-contrast warning cues, millisecond-accurate tracking,
              and a secure Pause/Resume engine that blurs questions to maintain strict exam integrity.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 shadow-lg hover:border-slate-700 transition-all space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Dynamic Parameterization</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No static repeated questions. Interest rates, loan terms, compounding frequencies, and
              bond coupons vary algorithmically within valid SOA actuarial bounds on every attempt.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 shadow-lg hover:border-slate-700 transition-all space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Error-Driven Distractors</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Incorrect options are computed using real candidate pitfalls: confusing annuity-immediate with
              due, simple interest errors, off-by-one compounding, and nominal rate conversions.
            </p>
          </div>
        </section>

        {/* Syllabus Domain Breakdown */}
        <section className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
            <div>
              <h2 className="text-xl font-bold text-white">5 Core Syllabus Domains (6 Questions Each)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Balanced distribution matching the official Society of Actuaries Exam FM blueprint
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/70">
              Exactly 30 Questions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                num: "01",
                title: "Time Value of Money",
                desc: "Nominal vs effective interest, force of interest integration, equations of value, discounting.",
                formula: "a(t) = \\exp\\left(\\int_0^t \\delta(s)ds\\right)",
              },
              {
                num: "02",
                title: "Annuities & Cash Flows",
                desc: "Level immediate/due, arithmetic increasing (Ia), geometric perpetuities, continuous streams.",
                formula: "(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|} - n v^n}{i}",
              },
              {
                num: "03",
                title: "Loans & Amortization",
                desc: "Amortization schedules, prospective & retrospective balances, interest/principal split, sinking funds.",
                formula: "P_t = R \\cdot v^{n-t+1}",
              },
              {
                num: "04",
                title: "Bonds & Valuation",
                desc: "Pricing formulas, book values, premium write-down, callable bonds under minimum yield rule.",
                formula: "P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n",
              },
              {
                num: "05",
                title: "ALM & Immunization",
                desc: "Macaulay duration, modified duration price sensitivity, convexity, Redington & full immunization.",
                formula: "D_{\\text{mac}} = \\frac{\\sum t C_t v^t}{P}",
              },
            ].map((topic) => (
              <div
                key={topic.num}
                className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-extrabold text-blue-400 tracking-wider">
                      TOPIC {topic.num}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      6 Questions
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{topic.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">{topic.desc}</p>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-xs text-sky-300 font-mono overflow-x-auto">
                  <MathRenderer content={`$${topic.formula}$`} />
                </div>
              </div>
            ))}

            {/* Quick Start Card */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-900/50 via-indigo-900/40 to-slate-900 border border-blue-600/40 flex flex-col justify-between space-y-4 shadow-lg">
              <div>
                <span className="text-[11px] font-mono font-extrabold text-blue-300 tracking-wider uppercase">
                  EXAM PASSING BENCHMARK
                </span>
                <h4 className="text-base font-extrabold text-white mt-1">SOA Grade Scale 0–10</h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Passing requires at least <strong>70% (21/30)</strong>. Step-by-step KaTeX solutions,
                  trap analysis, and video solution streams are provided immediately upon submission.
                </p>
              </div>

              <button
                onClick={startExam}
                disabled={isStarting}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <span>Start Practice Attempt</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500 bg-slate-950">
        <p className="max-w-md mx-auto">
          Society of Actuaries (SOA) Exam FM Practice Platform • Computer-Based Testing Simulation Environment
        </p>
      </footer>
    </div>
  );
}
