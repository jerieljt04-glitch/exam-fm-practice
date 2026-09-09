"use client";

import React from "react";
import { Calculator, GitCommitHorizontal } from "lucide-react";

import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import type { ExamQuestionData, TopicDomain } from "@/lib/types/exam";

const TIMELINE_COPY: Record<
  TopicDomain,
  { start: string; middle: string; end: string }
> = {
  TIME_VALUE_OF_MONEY: {
    start: "Initial value / focal date",
    middle: "Accumulate or discount consistently",
    end: "Target value",
  },
  ANNUITIES: {
    start: "Valuation date",
    middle: "Scheduled payment stream",
    end: "Final payment / terminal value",
  },
  LOANS: {
    start: "Principal advanced",
    middle: "Interest and principal payments",
    end: "Final balance repaid",
  },
  BONDS: {
    start: "Purchase price",
    middle: "Coupon cash flows",
    end: "Redemption value",
  },
  ALM_IMMUNIZATION: {
    start: "Assets and liabilities valued",
    middle: "Intermediate portfolio cash flows",
    end: "Liability horizon",
  },
};

const CALCULATOR_COPY: Record<TopicDomain, { title: string; steps: string[] }> = {
  TIME_VALUE_OF_MONEY: {
    title: "BA II Plus rate route",
    steps: ["2nd CLR TVM", "Enter known N, PV, PMT, FV", "Enter or compute I/Y", "Check signs: inflows and outflows must differ"],
  },
  ANNUITIES: {
    title: "BA II Plus annuity route",
    steps: ["2nd CLR TVM", "Set END or BGN deliberately", "Enter N, I/Y, PMT and one value", "CPT the remaining PV or FV"],
  },
  LOANS: {
    title: "BA II Plus loan route",
    steps: ["2nd CLR TVM", "Enter N and periodic I/Y", "Enter PV with the opposite sign to PMT", "Use AMORT for interest/principal checks"],
  },
  BONDS: {
    title: "BA II Plus bond route",
    steps: ["2nd CLR WORK", "Open BOND worksheet when applicable", "Match coupon and yield periods", "Recheck redemption and settlement timing"],
  },
  ALM_IMMUNIZATION: {
    title: "Calculator verification route",
    steps: ["Compute each discounted cash flow", "Store weighted-time products", "Divide by total present value", "Apply duration/convexity signs last"],
  },
};

function horizonLabel(question: ExamQuestionData): string {
  const keys = ["n", "term", "years", "loanTerm", "bondTerm", "totalYears", "maturity"];
  for (const key of keys) {
    const value = question.variables[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return `t = ${value}`;
  }
  return "t = n";
}

export function QuestionStudyAids({ question }: { question: ExamQuestionData }) {
  const timeline = TIMELINE_COPY[question.domain];
  const calculator = CALCULATOR_COPY[question.domain];
  const isConceptual = Object.keys(question.variables).every((key) => key.startsWith("_"));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-5 flex items-center gap-2">
          <GitCommitHorizontal className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Cash-flow map</h3>
        </div>
        <div className="relative grid grid-cols-3 gap-3 text-center">
          <div className="absolute left-[16%] right-[16%] top-3 h-0.5 bg-border" />
          {[
            { time: "t = 0", label: timeline.start },
            { time: "…", label: timeline.middle },
            { time: horizonLabel(question), label: timeline.end },
          ].map((point) => (
            <div key={point.time} className="relative">
              <span className="mx-auto mb-2 block h-6 w-6 rounded-full border-4 border-card bg-primary" />
              <div className="font-mono text-xs font-bold text-primary">{point.time}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{point.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">{calculator.title}</h3>
          </div>
          <Badge variant="muted">Optional check</Badge>
        </div>
        {isConceptual ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            This item tests recognition rather than calculator mechanics. State the governing relationship before evaluating any numbers.
          </p>
        ) : (
          <ol className="grid gap-2 text-xs text-muted-foreground">
            {calculator.steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-mono font-bold text-primary">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
          Practice on your own approved calculator. This guide is a study aid and is hidden during strict Exam Mode.
        </p>
      </Card>
    </div>
  );
}
