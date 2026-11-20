import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StartPanel } from "@/components/dashboard/Actions";
import { LocalTime } from "@/components/LocalTime";
import { MisconceptionsPanel, RemediationPanel } from "@/components/progress/panels";
import { ReadinessCard } from "@/components/progress/ReadinessCard";
import { ScoreTrendChart } from "@/components/progress/ScoreTrendChart";
import { Panel } from "@/components/ui";
import { getDashboard, PASS_MARK, scoreTrend } from "@/lib/server/repository";
import { studyOverview } from "@/lib/server/study";
import { SYLLABUS_VERSION } from "@/lib/syllabus";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Home: start something, resume what is open, and the few numbers that matter. Details live on /progress. */
export default async function Home() {
  const [d, study, trend] = await Promise.all([getDashboard(), studyOverview(), scoreTrend()]);
  const active = d.sessions.filter((s) => s.status === "ACTIVE");
  const recent = d.sessions.filter((s) => s.status === "SUBMITTED").slice(0, 5);
  const tiles = [
    { label: "Questions answered", value: String(d.totals.attempts), sub: d.totals.attempts ? `${pct(d.totals.correct, d.totals.attempts)} correct overall` : "start a session below" },
    {
      label: "Recent SOA-standard accuracy",
      value: d.improvement.recent === null ? "—" : `${Math.round(d.improvement.recent * 100)}%`,
      sub: d.improvement.before === null ? `latest ${d.improvement.recentCount} questions` : `previous ${Math.round(d.improvement.before * 100)}%`,
    },
    { label: "Remediation due", value: String(d.remediation.due), sub: `${d.remediation.resolved} resolved so far` },
  ];

  return (
    <main className="hero-wash bg-no-repeat">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-4 pb-2 pt-6">
          <div className="max-w-[68ch] animate-rise">
            <div className="micro mb-2">{SYLLABUS_VERSION}</div>
            <h1 className="font-display text-[34px] font-semibold sm:text-[40px]">
              <span className="text-gradient">Practise with purpose.</span>
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {d.totals.attempts} questions answered · {d.validation.PASSED ?? 0} questions validated · {d.validation.REJECTED ?? 0} drafts rejected by the checker
            </p>
          </div>
          <Link href="/progress" className="inline-flex items-center gap-1 rounded-pill px-4 py-2 text-sm font-medium text-primary hover:bg-primary/[0.08]">
            Full progress <ArrowRight size={16} aria-hidden />
          </Link>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <ReadinessCard readiness={d.readiness} />
          <div className="grid gap-4 sm:grid-cols-3">
            {tiles.map((t) => (
              <section key={t.label} className="panel flex flex-col justify-between p-6">
                <h2 className="text-sm font-medium text-muted-foreground">{t.label}</h2>
                <div className="stat mt-3 text-[32px]">{t.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.sub}</p>
              </section>
            ))}
          </div>
        </div>

        {active.length > 0 && (
          <Panel title="In progress">
            <ul className="divide-y text-sm">
              {active.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    {s.modeLabel} · started <LocalTime iso={s.createdAt} format="relative" /> · {s.answeredSoFar}/{s.total} answered
                  </span>
                  <Link href={`/session/${s.id}`} className="inline-flex items-center gap-1 rounded-pill px-3 py-1 font-medium text-primary hover:bg-primary/[0.08]">
                    Resume <ArrowRight size={14} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <StartPanel llm={d.llm} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Score trend" action={<Link href="/progress" className="text-sm font-medium text-primary hover:underline">Details</Link>}>
            <ScoreTrendChart points={trend.slice(-12)} passMark={PASS_MARK} compact />
          </Panel>
          <Panel title="Recent sessions" action={<Link href="/progress?tab=history" className="text-sm font-medium text-primary hover:underline">All sessions</Link>}>
            {recent.length ? (
              <ul className="divide-y text-sm">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <span className="font-medium">{s.modeLabel}</span> · {s.submittedAt ? <LocalTime iso={s.submittedAt} format="relative" /> : "—"}
                    </span>
                    <span className="flex items-center gap-3 tabular-nums">
                      {s.correct}/{s.total} ({pct(s.correct, s.total)})
                      <Link href={`/session/${s.id}/report`} className="font-medium text-primary hover:underline">
                        Report
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No completed sessions yet. A 15-question diagnostic is a good first step.</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <RemediationPanel d={d} />
          <MisconceptionsPanel d={d} />
        </div>

        <Panel title="Study: formula memorisation and concepts, with instant feedback" action={<Link href="/study" className="text-sm font-medium text-primary hover:underline">Open study →</Link>}>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/study/flashcards?deck=formulas" className="rounded-lg border p-3 hover:bg-accent">
              <div className="font-medium">Formula flashcards</div>
              <div className="text-xs text-muted-foreground">
                {study.decks.formulas.due} due · {study.decks.formulas.total - study.decks.formulas.reviewed} new · {study.decks.formulas.stages.mature} memorised long-term
              </div>
            </Link>
            <Link href="/study/drill" className="rounded-lg border p-3 hover:bg-accent">
              <div className="font-medium">Formula drill</div>
              <div className="text-xs text-muted-foreground">Spot the right form among near-misses · {pct(study.drill.correct, study.drill.attempts)} so far</div>
            </Link>
            <Link href="/study/concepts" className="rounded-lg border p-3 hover:bg-accent">
              <div className="font-medium">Concept quick checks</div>
              <div className="text-xs text-muted-foreground">True or false, from the sheets · {pct(study.quickChecks.correct, study.quickChecks.attempts)} so far</div>
            </Link>
            <Link href="/study/concepts?tab=questions" className="rounded-lg border p-3 hover:bg-accent">
              <div className="font-medium">Concept questions</div>
              <div className="text-xs text-muted-foreground">Explained as you answer · {study.decks.concepts.due} concept cards due</div>
            </Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}
