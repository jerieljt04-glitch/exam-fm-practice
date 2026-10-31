"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Button, Meter, Panel, Tabs } from "@/components/ui";
import type { DiagnosticReport } from "@/lib/analysis/report";
import { formatClock } from "@/lib/timer";
import { cn, pct } from "@/lib/utils";
import { QuestionReview } from "./QuestionReview";

type Tab = "overview" | "reasoning" | "mistakes" | "chains" | "calibration" | "questions";

const MODE_LABELS: Record<string, string> = {
  DIAGNOSTIC: "Diagnostic",
  EXAM: "Exam simulation",
  CHALLENGE: "Challenge",
  PRACTICE: "Formula practice",
  REMEDIATION: "Remediation",
  TRANSFER: "Transfer check",
};

const toneFor = (score: number | null) => (score === null ? "neutral" : score >= 0.75 ? "good" : score >= 0.5 ? "warn" : "bad");

function PositionList({ positions, onOpen }: { positions: number[]; onOpen: (p: number) => void }) {
  if (!positions.length) return <span className="text-muted-foreground">none</span>;
  return (
    <span className="space-x-1">
      {positions.map((p) => (
        <button key={p} onClick={() => onOpen(p)} className="rounded border px-1.5 text-xs tabular-nums hover:bg-accent">
          Q{p}
        </button>
      ))}
    </span>
  );
}

const TABS: Tab[] = ["overview", "reasoning", "mistakes", "chains", "calibration", "questions"];

export function ReportView({ report, remediationDue, initialTab, initialQuestion }: { report: DiagnosticReport; remediationDue: number; initialTab?: string; initialQuestion?: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");
  const [open, setOpen] = useState<number>(initialQuestion && report.questions.some((q) => q.position === initialQuestion) ? initialQuestion : report.questions[0]?.position ?? 1);
  const [starting, setStarting] = useState(false);
  const o = report.overall;

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

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{MODE_LABELS[report.session.mode] ?? report.session.mode} · submitted {new Date(report.session.submittedAt).toLocaleString()}</div>
          <h1 className="text-2xl font-semibold">Diagnostic report</h1>
        </div>
        <div className="flex gap-2">
          {remediationDue > 0 && (
            <Button onClick={() => void startRemediation()} disabled={starting}>
              {starting ? "Generating…" : `Start remediation (${remediationDue} due)`}
            </Button>
          )}
          <Link href="/" className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-accent">
            Dashboard
          </Link>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "reasoning", label: "Reasoning profile" },
          { id: "mistakes", label: "Misconceptions" },
          { id: "chains", label: "Formula chains" },
          { id: "calibration", label: "Confidence & time" },
          { id: "questions", label: "Question review" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Score", `${o.percent}%`],
              ["Correct", `${o.correct} / ${o.total}`],
              ["Incorrect", String(o.incorrect)],
              ["Not answered", String(o.unanswered)],
              ["Average time", formatClock(o.averageSeconds)],
            ].map(([label, value]) => (
              <div key={label} className="panel p-3">
                <div className="eyebrow">{label}</div>
                <div className="stat">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Accuracy by difficulty (kept separate)">
              <div className="space-y-3">
                {report.byDifficulty.map((d) => (
                  <div key={d.level}>
                    <div className="flex justify-between text-sm">
                      <span>{d.label}</span>
                      <span className="tabular-nums">
                        {d.correct}/{d.total} · {pct(d.correct, d.total)}
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
          <Panel title="How to read this report">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {tab === "reasoning" && (
        <Panel title="Mathematical reasoning profile (this session)">
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {report.reasoning.map((s) => (
              <div key={s.skill}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.status === "INSUFFICIENT" ? "insufficient evidence" : `${Math.round((s.score ?? 0) * 100)}%`}
                  </span>
                </div>
                <Meter value={s.status === "INSUFFICIENT" ? null : s.score} tone={s.status === "INSUFFICIENT" ? "neutral" : toneFor(s.score)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  <b>Observed:</b> {s.observedText} {s.inferredText && <><b>Inferred:</b> {s.inferredText}</>}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "mistakes" && (
        <div className="space-y-4">
          <Panel title="Mistakes your chosen answers correspond to">
            {report.misconceptions.length ? (
              <div className="space-y-3">
                {report.misconceptions.map((m) => (
                  <div key={m.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{m.label}</span>
                      <Badge tone="bad">{m.category}</Badge>
                      <span className="text-muted-foreground">
                        ×{m.count} — <PositionList positions={m.positions} onOpen={openQuestion} />
                      </span>
                    </div>
                    <p className="mt-1">
                      <b>Correct relationship:</b> {m.principle}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <b>Recognise it:</b> {m.recognition}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No distractor was chosen in this session.</p>
            )}
          </Panel>
          {report.categories.length > 0 && (
            <Panel title="By category">
              <div className="flex flex-wrap gap-2">
                {report.categories.map((c) => (
                  <Badge key={c.category}>
                    {c.label}: {c.count}
                  </Badge>
                ))}
              </div>
            </Panel>
          )}
          {report.remediation.length > 0 && (
            <Panel title="Remediation" action={remediationDue > 0 ? <Button size="sm" onClick={() => void startRemediation()} disabled={starting}>Start remediation set</Button> : undefined}>
              <p className="text-sm">
                Each mistake above opens a remediation item. The next remediation set gives two new problems on the same principle from different templates; when both are answered correctly the item is retested after 24 hours before it counts as corrected.
              </p>
            </Panel>
          )}
        </div>
      )}

      {tab === "chains" && (
        <div className="space-y-4">
          <Panel title="Accuracy by formula-integration level">
            <div className="space-y-2">
              {report.chains.byLevel.map((row) => (
                <div key={row.level} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span>
                    Level {row.level}: {row.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.correct} / {row.total} · {pct(row.correct, row.total)}
                  </span>
                  <Meter value={row.total ? row.correct / row.total : 0} tone={toneFor(row.total ? row.correct / row.total : null)} className="col-span-2" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Where the wrong answers left the formula chain">
            {report.chains.breaks.length ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {report.chains.byKind.map((k) => (
                    <div key={k.kind} className="rounded-md border p-3">
                      <div className="text-2xl font-semibold tabular-nums">{k.count}</div>
                      <div className="font-medium">{k.label}</div>
                      <div className="mt-1">
                        <PositionList positions={k.positions} onOpen={openQuestion} />
                      </div>
                    </div>
                  ))}
                </div>
                <table className="w-full text-left">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1">Question</th>
                      <th>Step</th>
                      <th>Formula at that step</th>
                      <th>Kind of error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.chains.breaks.map((b) => (
                      <tr key={b.position} className="border-t">
                        <td className="py-1.5">
                          <PositionList positions={[b.position]} onOpen={openQuestion} />
                        </td>
                        <td className="tabular-nums">
                          {b.stage + 1} of {b.steps}
                        </td>
                        <td>{b.formulaName}</td>
                        <td>{b.kind === "selection" && b.wrongFormula ? "Selecting the right formula (substituted another)" : report.chains.byKind.find((k) => k.kind === b.kind)?.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.chains.formulas.some((f) => f.count > 1) && (
                  <p>
                    <b>Recurring:</b>{" "}
                    {report.chains.formulas
                      .filter((f) => f.count > 1)
                      .map((f) => `${f.name} (${f.count}×)`)
                      .join(", ")}
                    . Check this formula’s conditions and common misuse in the{" "}
                    <Link href="/formulas" className="text-primary hover:underline">
                      formula library
                    </Link>
                    .
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No wrong answer in this session, so no chain break to locate.</p>
            )}
          </Panel>
          <p className="text-xs text-muted-foreground">
            Each wrong option was generated from a specific mistake at a specific step of the solution, so the step is known exactly from the option chosen. Whether the mistake was in choosing the formula, applying it, linking it to the next step or reading the result is the
            kind recorded for that option; your working, when it contains intermediate values, is used to confirm it in the question review.
          </p>
        </div>
      )}

      {tab === "calibration" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Confidence against outcome">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1">Confidence</th>
                    <th>Answers</th>
                    <th>Correct</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {report.confidence.table.map((row) => (
                    <tr key={row.level} className="border-t">
                      <td className="py-1">{row.label}</td>
                      <td>{row.total}</td>
                      <td>{row.correct}</td>
                      <td>{pct(row.correct, row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Questions to look at">
              <dl className="space-y-2 text-sm">
                {(
                  [
                    ["High confidence, incorrect (overconfidence)", report.confidence.highConfidenceWrong],
                    ["Low confidence, correct", report.confidence.lowConfidenceCorrect],
                    ["Correct, but reasoning not evidenced", report.confidence.weakReasoningCorrect],
                    ["Correct method in working, wrong result", report.confidence.methodRightExecutionWrong],
                  ] as Array<[string, number[]]>
                ).map(([label, positions]) => (
                  <div key={label} className="flex flex-wrap items-center justify-between gap-2">
                    <dt>{label}</dt>
                    <dd>
                      <PositionList positions={positions} onOpen={openQuestion} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
          <Panel title="Where errors cluster (time pressure analysis)">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Question feature</th>
                  <th>Error rate with it</th>
                  <th>Error rate without it</th>
                </tr>
              </thead>
              <tbody>
                {report.timing.comparisons.map((c) => (
                  <tr key={c.label} className="border-t">
                    <td className="py-1">{c.label}</td>
                    <td className={cn(c.withCount && c.withoutCount && c.withErrors / c.withCount > c.withoutErrors / c.withoutCount + 0.15 && "font-semibold text-destructive")}>
                      {c.withCount ? `${c.withErrors}/${c.withCount} (${pct(c.withErrors, c.withCount)})` : "—"}
                    </td>
                    <td>{c.withoutCount ? `${c.withoutErrors}/${c.withoutCount} (${pct(c.withoutErrors, c.withoutCount)})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              “Unusually long” means more than {formatClock(report.timing.thresholdSeconds)}. These are observed counts; with few questions in a group, a difference may be chance.
            </p>
          </Panel>
        </div>
      )}

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
