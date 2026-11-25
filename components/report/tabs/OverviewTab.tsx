"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Hourglass, ListChecks, RotateCcw, Target } from "lucide-react";

import { Badge, Button, Meter, Panel } from "@/components/ui";
import { MOCK_PROFILES, mockProfileOf } from "@/lib/engine/mock-profiles";
import { formatClock } from "@/lib/timer";
import { pct } from "@/lib/utils";

import { PositionList, toneFor, type ReportContext } from "../shared";

/** Pass mark used for the summary verdict (the SOA sets it per sitting; about 70% is the usual guide). */
const PASS = 0.7;

/** The headline: score, how it compares with the pass mark, the three things to look at, and what to do next. */
function Summary({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion, remediationDue, starting, startRemediation } = ctx;
  const o = report.overall;
  const standard = report.byDifficulty.find((d) => d.level === 1);
  const basis = standard && standard.total >= 5 ? { label: "SOA-standard questions", share: standard.correct / standard.total } : { label: "all questions", share: o.total ? o.correct / o.total : 0 };
  const verdict = basis.share >= PASS ? { text: "At or above the pass mark", tone: "text-success" } : basis.share >= PASS - 0.1 ? { text: "Close to the pass mark", tone: "text-warning" } : { text: "Below the pass mark", tone: "text-destructive" };
  const weakest = report.byTopic.filter((t) => t.total > 0).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  const topCause = report.causes[0];
  const firstWrong = report.questions.find((q) => q.response.selectedKey && !q.evidence.correct)?.position ?? report.questions.find((q) => !q.evidence.correct)?.position;
  const points = [
    topCause ? `Most wrong answers came from: ${topCause.label.toLowerCase()} (${topCause.positions.length}).` : "No incorrect answers to classify.",
    weakest && weakest.correct < weakest.total ? `Weakest topic: ${weakest.label} (${weakest.correct}/${weakest.total}).` : "Every topic answered correctly.",
    o.unanswered ? `${o.unanswered} question${o.unanswered === 1 ? "" : "s"} left unanswered — on the exam a guess costs nothing.` : o.longQuestions.length ? `${o.longQuestions.length} question${o.longQuestions.length === 1 ? "" : "s"} took over ${formatClock(report.timing.thresholdSeconds)}.` : `Average ${formatClock(o.averageSeconds)} per question.`,
  ];
  return (
    <section className="panel hero-wash grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr]" aria-labelledby="summary-title">
      <div>
        <h2 id="summary-title" className="micro">
          Summary
        </h2>
        <ProfileChip difficulty={report.session.difficulty} mode={report.session.mode} />
        <div className="mt-2 font-display text-[56px] font-semibold leading-none tabular-nums">{o.percent}%</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {o.correct} of {o.total} correct · {formatClock(o.averageSeconds)} average
        </div>
        <div className={`mt-2 text-sm font-medium ${verdict.tone}`}>
          {verdict.text} on {basis.label} ({Math.round(basis.share * 100)}% vs ≈{Math.round(PASS * 100)}%)
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4">
        <ul className="space-y-2 text-[15px]">
          {points.map((pt) => (
            <li key={pt} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {pt}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {firstWrong !== undefined && (
            <Button onClick={() => openQuestion(firstWrong)}>
              <ListChecks size={16} aria-hidden /> Review what went wrong
            </Button>
          )}
          {remediationDue > 0 && (
            <Button variant="tonal" onClick={() => void startRemediation()} disabled={starting}>
              <RotateCcw size={16} aria-hidden /> {starting ? "Generating…" : `Practise these mistakes (${remediationDue})`}
            </Button>
          )}
          <Link href="/progress" className="inline-flex h-10 items-center gap-1 rounded-pill px-5 text-sm font-medium text-primary hover:bg-primary/[0.08]">
            Overall progress <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The mock profile (Standard / Mixed / Hard / Elite) and its target level, for exam sittings. */
function ProfileChip({ difficulty, mode }: { difficulty: string; mode: string }) {
  const profile = mockProfileOf(difficulty);
  if (!profile || (mode !== "EXAM" && mode !== "CHALLENGE")) return null;
  const p = MOCK_PROFILES[profile];
  return (
    <div className="mt-2">
      <Badge tone={profile === "ELITE_9" ? "bad" : profile === "HARD_7" ? "warn" : "info"}>
        {p.label} mock · {p.target}
      </Badge>
    </div>
  );
}

/** Trap and time-sink diagnostics, with a one-click drill on the hard questions that were missed. */
function TrapsAndTimeSinks({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion } = ctx;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drill = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${report.session.id}/drill`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the drill.");
      router.push(`/session/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const traps = report.misconceptions.slice(0, 5);
  return (
    <Panel
      title="Traps and time sinks"
      action={
        report.hardMissed > 0 ? (
          <Button variant="tonal" onClick={() => void drill()} disabled={busy}>
            <Target size={16} aria-hidden /> {busy ? "Building drill…" : `Drill missed hard archetypes (${report.hardMissed})`}
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="micro mb-2">Traps you fell into</h3>
          {traps.length ? (
            <ul className="space-y-2 text-sm">
              {traps.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3">
                  <span>
                    {t.label}
                    <span className="block text-xs text-muted-foreground">{t.category}</span>
                  </span>
                  <PositionList positions={t.positions} onOpen={openQuestion} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No modelled trap was chosen.</p>
          )}
        </div>
        <div>
          <h3 className="micro mb-2 flex items-center gap-1">
            <Hourglass size={14} aria-hidden /> Over 7 minutes
          </h3>
          {report.timeSinks.length ? (
            <ul className="space-y-1 text-sm">
              {report.timeSinks.map((q) => (
                <li key={q.position} className="flex items-center justify-between gap-2">
                  <button className="underline-offset-2 hover:underline" onClick={() => openQuestion(q.position)}>
                    Question {q.position}
                  </button>
                  <span className="flex items-center gap-2">
                    <Badge tone={q.correct ? "good" : "bad"}>{q.correct ? "right" : "wrong"}</Badge>
                    <span className="tabular-nums">{formatClock(q.seconds)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No question took longer than 7:00.</p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </Panel>
  );
}

export function OverviewTab({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion } = ctx;
  const o = report.overall;
  return (
    <div className="space-y-4">
      <Summary ctx={ctx} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Accuracy and pace by difficulty (kept separate)">
          <div className="space-y-3">
            {report.byDifficulty.filter((d) => d.total > 0).map((d) => (
              <div key={d.level}>
                <div className="flex justify-between text-sm">
                  <span>
                    Level {d.level} · {d.label}
                  </span>
                  <span className="tabular-nums">
                    {d.correct}/{d.total} · {pct(d.correct, d.total)} · {formatClock(d.averageSeconds)} avg
                  </span>
                </div>
                <Meter value={d.total ? d.correct / d.total : null} tone={toneFor(d.total ? d.correct / d.total : null)} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">SOA-standard accuracy is what measures exam readiness; challenge questions are deliberately harder and are not required for it.</p>
          </div>
        </Panel>
        <Panel title="Accuracy by syllabus topic (revealed after submission)">
          <div className="space-y-3">
            {report.byTopic
              .filter((t) => t.total > 0)
              .map((t) => (
                <div key={t.topic}>
                  <div className="flex justify-between text-sm">
                    <span>{t.label}</span>
                    <span className="tabular-nums">
                      {t.correct}/{t.total}
                    </span>
                  </div>
                  <Meter value={t.correct / t.total} tone={toneFor(t.correct / t.total)} />
                </div>
              ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Why answers were wrong (inferred from the options chosen and your working)">
          {report.causes.length ? (
            <ul className="space-y-2 text-sm">
              {report.causes.map((c) => (
                <li key={c.cause} className="flex items-center justify-between gap-2">
                  <span>{c.label}</span>
                  <PositionList positions={c.positions} onOpen={openQuestion} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No incorrect answers to classify.</p>
          )}
        </Panel>
        <Panel title="Questions that took unusually long">
          {o.longQuestions.length ? (
            <ul className="space-y-1 text-sm">
              {o.longQuestions.map((q) => (
                <li key={q.position} className="flex justify-between">
                  <button className="underline-offset-2 hover:underline" onClick={() => openQuestion(q.position)}>
                    Question {q.position}
                  </button>
                  <span className="tabular-nums">{formatClock(q.seconds)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None beyond {formatClock(report.timing.thresholdSeconds)}.</p>
          )}
        </Panel>
      </div>
      <TrapsAndTimeSinks ctx={ctx} />
      <Panel title="How to read this report">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
