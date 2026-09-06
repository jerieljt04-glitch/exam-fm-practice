"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Clock,
  RotateCcw,
  BookOpen,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ExamReviewData, TopicDomain } from "../lib/types/exam";
import { MathRenderer } from "./MathRenderer";
import { VideoPlayer } from "./VideoPlayer";

interface ExamReviewProps {
  reviewData: ExamReviewData;
}

export const ExamReview: React.FC<ExamReviewProps> = ({ reviewData }) => {
  const [activeFilter, setActiveFilter] = useState<"ALL" | "INCORRECT" | "CORRECT" | "FLAGGED">("ALL");
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    reviewData.questions.find((q) => !q.isCorrect)?.id || reviewData.questions[0]?.id || null
  );

  const {
    correctCount,
    totalQuestions,
    scorePercent,
    isPassed,
    totalTimeSpentSeconds,
    totalPausedTimeSeconds,
    domainMetrics,
    questions,
  } = reviewData;

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (activeFilter === "INCORRECT" && q.isCorrect) return false;
    if (activeFilter === "CORRECT" && !q.isCorrect) return false;
    if (activeFilter === "FLAGGED" && !q.isFlagged) return false;
    if (selectedDomain !== "ALL" && q.domain !== selectedDomain) return false;
    return true;
  });

  // Format seconds to mm:ss
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // SOA scaled score 0 to 10 (approximate: passing mark 70% is score 6)
  const scaledScore = Math.min(10, Math.floor((correctCount / 21) * 6));

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ========================================================================= */}
        {/* 1. TOP RESULT HERO & SCORECARD */}
        {/* ========================================================================= */}
        <div
          className={`rounded-2xl p-6 sm:p-8 text-white shadow-xl transition-all ${
            isPassed
              ? "bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 border border-emerald-700/50"
              : "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800"
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-white/10 text-slate-200 border border-white/20">
                  SOA Exam FM CBT Diagnostic
                </span>
                <span className="text-xs text-slate-400 font-mono">Session: {reviewData.sessionId}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isPassed ? "Congratulations! Passing Performance" : "Exam Complete — Diagnostic Report"}
              </h1>
              <p className="text-slate-300 text-sm max-w-xl">
                SOA Exam FM passing threshold is typically 70% (21/30). Review your topic breakdown and step-by-step mathematical solutions below.
              </p>
            </div>

            {/* Score Badge */}
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm self-stretch md:self-auto justify-around">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-black tracking-tight font-mono">
                  {correctCount}
                  <span className="text-lg text-slate-400 font-normal">/{totalQuestions}</span>
                </div>
                <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
                  Total Score ({scorePercent}%)
                </div>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-black tracking-tight font-mono text-blue-400">
                  {scaledScore}
                  <span className="text-lg text-slate-400 font-normal">/10</span>
                </div>
                <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
                  SOA Grade
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Award className={`w-4 h-4 ${isPassed ? "text-emerald-400" : "text-amber-400"}`} />
              <span className="text-slate-300">Result:</span>
              <span className={`font-bold ${isPassed ? "text-emerald-300" : "text-amber-300"}`}>
                {isPassed ? "PASS (Certified)" : "DID NOT PASS"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">Active Test Time:</span>
              <span className="font-semibold text-white">{formatDuration(totalTimeSpentSeconds)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">Pause Duration:</span>
              <span className="font-semibold text-white">{formatDuration(totalPausedTimeSeconds)}</span>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start New Mock Exam</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOPIC DOMAIN PERFORMANCE BREAKDOWN */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Topic Domain Diagnostics</h2>
              <p className="text-xs text-slate-500">
                Detailed proficiency breakdown across the 5 SOA Exam FM syllabus domains
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
              5 Core Domains
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(Object.keys(domainMetrics) as TopicDomain[]).map((d) => {
              const metric = domainMetrics[d];
              let statusColor = "bg-emerald-500 text-emerald-700";
              let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";

              if (metric.status === "CRITICAL") {
                statusColor = "bg-red-500 text-red-700";
                badgeColor = "bg-red-50 text-red-700 border-red-200";
              } else if (metric.status === "NEEDS_IMPROVEMENT") {
                statusColor = "bg-amber-500 text-amber-700";
                badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
              } else if (metric.status === "ADEQUATE") {
                statusColor = "bg-blue-500 text-blue-700";
                badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
              }

              return (
                <div
                  key={d}
                  onClick={() => setSelectedDomain(selectedDomain === d ? "ALL" : d)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedDomain === d
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 line-clamp-1" title={metric.label}>
                      {metric.label}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                      {metric.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xl font-mono font-extrabold text-slate-800">
                      {metric.percentage}%
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {metric.correct}/{metric.total}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${statusColor}`}
                      style={{ width: `${metric.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. QUESTION REVIEW LIST & DETAILED STEP-BY-STEP DIAGNOSTICS */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-2">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>

              <button
                onClick={() => setActiveFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({totalQuestions})
              </button>

              <button
                onClick={() => setActiveFilter("INCORRECT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeFilter === "INCORRECT"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Incorrect ({totalQuestions - correctCount})</span>
              </button>

              <button
                onClick={() => setActiveFilter("CORRECT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeFilter === "CORRECT"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Correct ({correctCount})</span>
              </button>
            </div>

            {selectedDomain !== "ALL" && (
              <button
                onClick={() => setSelectedDomain("ALL")}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Clear Domain Filter
              </button>
            )}
          </div>

          {/* Question Cards */}
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => {
              const isExpanded = expandedQuestionId === q.id;
              const correctOption = q.renderedOptions.find((o) => o.isCorrect);
              const selectedOptionObj = q.renderedOptions.find((o) => o.key === q.selectedOption);

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    q.isCorrect ? "border-slate-200" : "border-red-200 shadow-sm"
                  }`}
                >
                  {/* Collapsible Question Banner */}
                  <div
                    onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {q.isCorrect ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                            <XCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-slate-900">
                            Question {questions.findIndex((item) => item.id === q.id) + 1}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {q.domain.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {q.selectedOption ? (
                            <span>
                              Your answer:{" "}
                              <strong className={q.isCorrect ? "text-emerald-600" : "text-red-600"}>
                                Option {q.selectedOption}
                              </strong>{" "}
                              • Correct answer:{" "}
                              <strong className="text-emerald-600">Option {correctOption?.key}</strong>
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">
                              Unanswered • Correct answer: Option {correctOption?.key}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {isExpanded ? "Hide Details" : "View Solution & Video"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Diagnostic Section */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-6 space-y-6 bg-slate-50/40 animate-fadeIn">
                      {/* 1. Question Statement */}
                      <div className="p-5 rounded-xl bg-white border border-slate-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Question Statement:
                        </h4>
                        <div className="text-base text-slate-800 leading-relaxed">
                          <MathRenderer content={q.renderedQuestion} />
                        </div>
                      </div>

                      {/* 2. Options Grid: Compare Candidate Answer vs Correct Answer */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Option Comparison:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.renderedOptions.map((opt) => {
                            const isUserChoice = q.selectedOption === opt.key;
                            const isCorrectChoice = opt.isCorrect;

                            let cardStyle = "bg-white border-slate-200 text-slate-700";
                            let badge = null;

                            if (isCorrectChoice) {
                              cardStyle = "bg-emerald-50/80 border-emerald-400 text-emerald-900 shadow-sm";
                              badge = (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Correct Answer
                                </span>
                              );
                            } else if (isUserChoice && !isCorrectChoice) {
                              cardStyle = "bg-red-50/80 border-red-400 text-red-900 shadow-sm";
                              badge = (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-600 text-white flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Your Incorrect Selection
                                </span>
                              );
                            }

                            return (
                              <div
                                key={opt.key}
                                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${cardStyle}`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="w-6 h-6 rounded-full bg-slate-200/80 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    {opt.key}
                                  </span>
                                  <div className="text-sm font-medium">
                                    <MathRenderer content={opt.text} />
                                  </div>
                                </div>
                                {badge}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Error Trap Diagnostic Alert (if answered incorrectly) */}
                      {!q.isCorrect && selectedOptionObj && selectedOptionObj.distractorExplanation && (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                              SOA Distractor Diagnostic — {selectedOptionObj.distractorType?.replace(/_/g, " ")}:
                            </h5>
                            <p className="text-sm text-amber-800/90 leading-relaxed">
                              {selectedOptionObj.distractorExplanation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 4. Detailed Written Step-by-Step KaTeX Solution */}
                      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <h4 className="text-sm font-bold text-slate-900">
                            Complete Actuarial Derivation & Mathematical Solution:
                          </h4>
                        </div>
                        <div className="text-sm text-slate-700 leading-relaxed">
                          <MathRenderer content={q.solutionSteps} />
                        </div>
                      </div>

                      {/* 5. Integrated Video Player Solution Stream */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Video Solution Stream:
                        </h4>
                        <VideoPlayer
                          videoUrl={q.videoUrl}
                          title={`Question ${questions.findIndex((item) => item.id === q.id) + 1}: ${q.domain.replace(/_/g, " ")} Walkthrough`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
