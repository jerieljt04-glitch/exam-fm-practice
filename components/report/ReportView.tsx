"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LocalTime } from "@/components/LocalTime";
import { Tabs } from "@/components/ui";
import type { DiagnosticReport } from "@/lib/analysis/report";
import { cn } from "@/lib/utils";

import { QuestionReview } from "./QuestionReview";
import type { ReportContext } from "./shared";
import { CalibrationTab } from "./tabs/CalibrationTab";
import { ChainsTab } from "./tabs/ChainsTab";
import { ConceptsTab } from "./tabs/ConceptsTab";
import { FormatsTab } from "./tabs/FormatsTab";
import { MistakesTab } from "./tabs/MistakesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ReasoningTab } from "./tabs/ReasoningTab";

type Tab = "overview" | "reasoning" | "mistakes" | "chains" | "formats" | "concepts" | "calibration" | "questions";

const MODE_LABELS: Record<string, string> = {
  DIAGNOSTIC: "Diagnostic",
  EXAM: "Exam simulation",
  CHALLENGE: "Challenge",
  PRACTICE: "Formula practice",
  CONCEPT: "Concept practice",
  REMEDIATION: "Remediation",
  TRANSFER: "Transfer check",
};

const TABS: Tab[] = ["overview", "reasoning", "mistakes", "chains", "formats", "concepts", "calibration", "questions"];

export function ReportView({ report, remediationDue, initialTab, initialQuestion }: { report: DiagnosticReport; remediationDue: number; initialTab?: string; initialQuestion?: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");
  const [open, setOpen] = useState<number>(initialQuestion && report.questions.some((q) => q.position === initialQuestion) ? initialQuestion : report.questions[0]?.position ?? 1);
  const [starting, setStarting] = useState(false);

  const openQuestion = (position: number) => {
    setOpen(position);
    setTab("questions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startRemediation = async () => {
    setStarting(true);
    const res = await fetch("/api/remediation", { method: "POST" });
    const data = await res.json();
    if (res.ok) router.push(`/session/${data.id}`);
    else setStarting(false);
  };

  const current = report.questions.find((q) => q.position === open);
  const ctx: ReportContext = { report, openQuestion, remediationDue, starting, startRemediation };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{MODE_LABELS[report.session.mode] ?? report.session.mode} · submitted <LocalTime iso={report.session.submittedAt} /></div>
          <h1 className="font-display text-[30px] font-semibold sm:text-[32px]">Diagnostic report</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/progress" className="inline-flex h-10 items-center rounded-pill border px-6 text-sm font-medium text-primary hover:bg-primary/[0.08]">
            Progress
          </Link>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reasoning", label: "Reasoning profile" },
          { id: "mistakes", label: "Misconceptions" },
          { id: "chains", label: "Formula chains" },
          { id: "formats", label: "Question formats" },
          ...(report.concepts.total > 0 ? [{ id: "concepts" as const, label: "Concepts" }] : []),
          { id: "calibration", label: "Confidence & time" },
          { id: "questions", label: "Question review" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && <OverviewTab ctx={ctx} />}

      {tab === "reasoning" && <ReasoningTab ctx={ctx} />}

      {tab === "mistakes" && <MistakesTab ctx={ctx} />}

      {tab === "chains" && <ChainsTab ctx={ctx} />}

      {tab === "formats" && <FormatsTab ctx={ctx} />}

      {tab === "concepts" && <ConceptsTab ctx={ctx} />}

      {tab === "calibration" && <CalibrationTab ctx={ctx} />}

      {tab === "questions" && (
        <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav className="panel h-fit p-2 lg:sticky lg:top-4">
            <ul className="grid grid-cols-6 gap-1 lg:grid-cols-1">
              {report.questions.map((q) => (
                <li key={q.position}>
                  <button
                    onClick={() => setOpen(q.position)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                      q.position === open ? "bg-accent font-semibold" : "hover:bg-accent"
                    )}
                  >
                    <span>Q{q.position}</span>
                    <span className="hidden text-xs lg:inline">{q.evidence.correct ? "✓" : q.evidence.answered ? "✗" : "—"}</span>
                    <span
                      className={cn("h-2 w-2 rounded-full lg:hidden", q.evidence.correct ? "bg-success" : q.evidence.answered ? "bg-destructive" : "bg-muted-foreground")}
                      aria-label={q.evidence.correct ? "correct" : q.evidence.answered ? "incorrect" : "not answered"}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="panel p-4">
            <h2 className="mb-3 text-lg font-semibold">Question {current?.position}</h2>
            {current && <QuestionReview key={current.position} review={current} />}
          </div>
        </div>
      )}
    </div>
  );
}
