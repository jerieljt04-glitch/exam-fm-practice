"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Layers,
  Award,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Calculator,
  ShieldCheck,
  TrendingUp,
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-blue-500/20">
              FM
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">
                SOA Exam FM Practice Platform
              </span>
              <span className="text-xs text-blue-400 block font-mono">
                Financial Mathematics CBT Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              SOA Syllabus 2026 Ready
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-semibold">
            <Calculator className="w-3.5 h-3.5" />
            <span>Computer-Based Testing (CBT) Simulation</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Master Society of Actuaries{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Exam FM
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Experience authentic exam conditions with dynamically generated actuarial questions,
            algorithmic distractors based on classic student traps, real-time pause/resume timing, and
            detailed step-by-step KaTeX mathematical solutions.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={startExam}
              disabled={isStarting}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 group"
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating 30 Questions...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
                  <span>Launch Official Mock Exam (30 Questions)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Key Exam Rules Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">150 Minutes Timed Session</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard 2.5 hour countdown with high-contrast warning cues, millisecond-accurate tracking,
              and a secure Pause/Resume engine that blurs questions to prevent time manipulation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Dynamic Parameterization</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              No static repeated questions. Rates $i$, loan terms $n$, compounding frequencies $m$, and
              coupons $r$ vary algorithmically with bounded random walk parameters.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Error-Driven Distractors</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Distractors are calculated using common actuarial pitfalls: confusing annuity-immediate with
              annuity-due, simple interest errors, and nominal rate conversions.
            </p>
          </div>
        </div>

        {/* Syllabus Domain Breakdown */}
        <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Syllabus Topic Coverage (6 Questions Each)</h2>
              <p className="text-xs text-slate-400">Strictly adheres to SOA Financial Mathematics guidelines</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800">
              30 Multiple Choice Questions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                num: "01",
                title: "Time Value of Money",
                desc: "Nominal vs effective rates, force of interest delta(t) integration, equations of value, discounting.",
                formula: "a(t) = e^{\\int_0^t \\delta(s)ds}",
              },
              {
                num: "02",
                title: "Annuities & Cash Flows",
                desc: "Level immediate and due, arithmetic increasing (Ia), geometric perpetuities, continuous streams.",
                formula: "(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|} - nv^n}{i}",
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
                desc: "Pricing formulas, book values, premium write-down, callable bonds under worst-case yield scenario.",
                formula: "P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n",
              },
              {
                num: "05",
                title: "ALM & Immunization",
                desc: "Macaulay duration, modified duration price sensitivity, Macaulay convexity, Redington & full immunization.",
                formula: "D_{\\text{mac}} = \\frac{\\sum t C_t v^t}{P}",
              },
            ].map((topic) => (
              <div
                key={topic.num}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-400">{topic.num}</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    6 Questions
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{topic.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{topic.desc}</p>
                <div className="pt-2 text-xs text-sky-300 font-mono overflow-x-auto">
                  <MathRenderer content={`$${topic.formula}$`} />
                </div>
              </div>
            ))}

            {/* Quick Start Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-900/60 to-indigo-900/40 border border-blue-700/50 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-blue-300">EXAM SPECIFICATION</span>
                <h4 className="text-sm font-bold text-white mt-1">SOA Scoring Benchmark</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Passing requires at least <strong>70% (21/30)</strong>. Full step-by-step KaTeX derivations
                  and video solution streams are provided immediately after submission.
                </p>
              </div>

              <button
                onClick={startExam}
                disabled={isStarting}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Start Practice Attempt</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 bg-slate-950">
        <p>Society of Actuaries (SOA) Exam FM Practice & Computer-Based Testing Environment</p>
      </footer>
    </div>
  );
}
