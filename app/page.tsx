import Link from "next/link";

import { RemediationButton, ResetHistory, StartPanel } from "@/components/dashboard/Actions";
import { Badge, Meter, Panel } from "@/components/ui";
import { pct } from "@/lib/utils";
import { MASTERY_LABELS, type MasteryStatus } from "@/lib/analysis/mastery";
import { getDashboard } from "@/lib/server/repository";
import { SYLLABUS_VERSION, TOPICS } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

const MASTERY_TONE: Record<MasteryStatus, "neutral" | "bad" | "warn" | "info" | "good"> = {
  NOT_TESTED: "neutral",
  WEAK: "bad",
  DEVELOPING: "warn",
  SECURE: "info",
  MASTERED: "good",
};

/** How each hypothesis status reads, depending on whether the hypothesis is a strength or a weakness. */
const HYPOTHESIS_TEXT = {
  weakness: {
    UNTESTED: { label: "Not yet tested", tone: "neutral" },
    SUPPORTED: { label: "Confirmed by evidence", tone: "bad" },
    NOT_SUPPORTED: { label: "Not supported so far", tone: "good" },
    MIXED: { label: "Mixed evidence", tone: "warn" },
  },
  strength: {
    UNTESTED: { label: "Not yet tested", tone: "neutral" },
    SUPPORTED: { label: "Confirmed by evidence", tone: "good" },
    NOT_SUPPORTED: { label: "Contradicted by evidence", tone: "bad" },
    MIXED: { label: "Mixed evidence", tone: "warn" },
  },
} as const;

export default async function Dashboard() {
  const d = await getDashboard();
  const active = d.sessions.filter((s) => s.status === "ACTIVE");
  const done = d.sessions.filter((s) => s.status === "SUBMITTED");
  const weak = d.skills.filter((s) => s.status === "WEAK" || s.status === "ADEQUATE").sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const tested = d.mastery.filter((m) => m.status !== "NOT_TESTED").length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {SYLLABUS_VERSION} · {d.totals.attempts} questions answered · {d.validation.PASSED ?? 0} questions validated, {d.validation.REJECTED ?? 0} drafts rejected by the checker
          </p>
        </div>
        <ResetHistory />
      </div>

      <StartPanel llm={d.llm} />

      {active.length > 0 && (
        <Panel title="In progress">
          <ul className="divide-y text-sm">
            {active.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>
                  {s.modeLabel} · started {new Date(s.createdAt).toLocaleString()} · {s.answeredSoFar}/{s.total} answered
                </span>
                <Link href={`/session/${s.id}`} className="font-medium text-primary hover:underline">
                  Resume →
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Adaptive remediation" className="lg:col-span-1">
          <p className="text-sm text-muted-foreground">
            Each mistake is retested with two different problems on the same principle, then again after 24 hours. Items resolved so far: {d.remediation.resolved}.
          </p>
          <div className="mt-3">
            <RemediationButton due={d.remediation.due} />
          </div>
          {d.remediation.open.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {d.remediation.open.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  <Badge tone={item.status === "SCHEDULED" ? "info" : "warn"}>
                    {item.status === "SCHEDULED" ? `retest ${new Date(item.dueAt).toLocaleDateString()}` : `stage ${item.stage} of 3`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Most common misconceptions" className="lg:col-span-1">
          {d.misconceptions.length ? (
            <ul className="space-y-2 text-sm">
              {d.misconceptions.map((m) => (
                <li key={m.id}>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{m.label}</span>
                    <span className="tabular-nums text-muted-foreground">×{m.count}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.category}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None yet — complete a session to see which traps you fall into.</p>
          )}
        </Panel>

        <Panel title="Recent improvement (SOA-standard questions)" className="lg:col-span-1">
          {d.improvement.recent === null ? (
            <p className="text-sm text-muted-foreground">No SOA-standard questions answered yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex justify-between">
                  <span>Latest {d.improvement.recentCount}</span>
                  <span className="tabular-nums">{Math.round(d.improvement.recent * 100)}%</span>
                </div>
                <Meter value={d.improvement.recent} />
              </div>
              {d.improvement.before !== null && (
                <div>
                  <div className="flex justify-between">
                    <span>Previous {d.improvement.beforeCount}</span>
                    <span className="tabular-nums">{Math.round(d.improvement.before * 100)}%</span>
                  </div>
                  <Meter value={d.improvement.before} tone="neutral" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Challenge-level results are tracked separately and do not affect this measure.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current weaknesses (reasoning profile, all sessions)">
          {weak.length ? (
            <div className="space-y-3">
              {weak.slice(0, 7).map((s) => (
                <div key={s.skill}>
                  <div className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round((s.score ?? 0) * 100)}%</span>
                  </div>
                  <Meter value={s.score} tone={s.status === "WEAK" ? "bad" : "warn"} />
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.inferredText || s.observedText}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough evidence yet. Skills need at least two observations before they are scored.</p>
          )}
        </Panel>

        <Panel title="Your starting profile, tested against evidence">
          <ul className="space-y-2 text-sm">
            {d.hypotheses.map((h) => (
              <li key={h.hypothesis.id} className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-medium">{h.hypothesis.title}</span>{" "}
                  <span className="text-xs text-muted-foreground">({h.hypothesis.kind === "weakness" ? "suspected weakness" : "observed strength"})</span>
                  <div className="text-xs text-muted-foreground">{h.summary}</div>
                </div>
                <Badge tone={HYPOTHESIS_TEXT[h.hypothesis.kind][h.status].tone}>{HYPOTHESIS_TEXT[h.hypothesis.kind][h.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Formula mastery" action={<Link href="/formulas" className="text-xs text-primary hover:underline">Open formula library</Link>}>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div className="flex flex-wrap gap-2">
            {(["MASTERED", "SECURE", "DEVELOPING", "WEAK", "NOT_TESTED"] as const).map((status) => (
              <Badge key={status} tone={MASTERY_TONE[status]}>
                {MASTERY_LABELS[status]}: {d.formulaStatus[status] ?? 0}
              </Badge>
            ))}
          </div>
          <div>
            <div className="eyebrow mb-1">Weak formulas</div>
            {d.weakFormulas.length ? (
              <ul className="space-y-0.5">
                {d.weakFormulas.slice(0, 6).map((f) => (
                  <li key={f.id} title={f.reason}>
                    {f.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">None identified.</p>
            )}
          </div>
          <div>
            <div className="eyebrow mb-1">Combinations that keep breaking</div>
            {d.weakCombinations.length ? (
              <ul className="space-y-0.5">
                {d.weakCombinations.map((c) => (
                  <li key={`${c.from}-${c.to}`}>
                    {c.label} <span className="text-xs text-muted-foreground">({c.success}/{c.attempts})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">None identified.</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Read from the formula chain of every answered question. A formula counts as mastered only after successful use in three presentations, including at least one combined with another formula and one unfamiliar presentation — reproducing it is not enough.
        </p>
      </Panel>

      <Panel title={`Skill mastery by learning objective (${tested} of ${d.mastery.length} tested)`}>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {TOPICS.map((topic) => (
            <div key={topic.id}>
              <div className="eyebrow mb-2">{topic.label}</div>
              <ul className="space-y-1.5 text-sm">
                {d.mastery
                  .filter((m) => m.topic === topic.id)
                  .map((m) => (
                    <li key={m.objective} className="flex items-center justify-between gap-2" title={m.reason}>
                      <span className="truncate">{m.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {m.attempts > 0 && <span className="text-xs tabular-nums text-muted-foreground">{m.correct}/{m.attempts}</span>}
                        <Badge tone={MASTERY_TONE[m.status]}>{MASTERY_LABELS[m.status]}</Badge>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Mastered requires three correct answers given with at least medium confidence, on three different question presentations, across sittings at least 20 hours apart, with the three most recent attempts all correct.
        </p>
      </Panel>

      <Panel title="Performance history">
        {done.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5">Submitted</th>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>SOA-standard</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {done.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-1.5">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}</td>
                    <td>{s.modeLabel}</td>
                    <td>
                      {s.correct}/{s.total} ({pct(s.correct, s.total)})
                    </td>
                    <td>{s.standardTotal ? `${s.standardCorrect}/${s.standardTotal}` : "—"}</td>
                    <td className="text-right">
                      <Link href={`/session/${s.id}/report`} className="text-primary hover:underline">
                        Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No completed sessions yet. A 15-question diagnostic is a good first step.</p>
        )}
      </Panel>
    </main>
  );
}
