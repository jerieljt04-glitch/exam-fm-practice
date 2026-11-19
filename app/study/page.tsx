import Link from "next/link";

import { Badge, Meter, Panel } from "@/components/ui";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { studyOverview } from "@/lib/server/study";
import { DRILL_ITEMS } from "@/lib/study/drill";
import { QUICK_CHECKS } from "@/lib/study/quick-checks";
import { STAGE_LABELS } from "@/lib/study/schedule";
import { TOPIC_LABELS, TOPIC_ORDER } from "@/lib/syllabus";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stages({ stages, total }: { stages: Record<"new" | "learning" | "young" | "mature", number>; total: number }) {
  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary" role="presentation">
        <div className="bg-success" style={{ width: `${(100 * stages.mature) / Math.max(1, total)}%` }} />
        <div className="bg-primary" style={{ width: `${(100 * stages.young) / Math.max(1, total)}%` }} />
        <div className="bg-warning" style={{ width: `${(100 * stages.learning) / Math.max(1, total)}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {(["mature", "young", "learning", "new"] as const).map((s) => (
          <span key={s}>
            {STAGE_LABELS[s]} {stages[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tool({ href, title, children, action }: { href: string; title: string; children: React.ReactNode; action: string }) {
  return (
    <div className="flex flex-col rounded-card bg-card p-6">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 flex-1 space-y-2 text-sm">{children}</div>
      <Link href={href} className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {action}
      </Link>
    </div>
  );
}

export default async function StudyHub() {
  const o = await studyOverview();
  const f = o.decks.formulas;
  const c = o.decks.concepts;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-[30px] font-semibold sm:text-[32px]">Study</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Learning with instant feedback: memorise the formulas on the two reference sheets, and build the conceptual understanding the exam tests. Nothing here counts toward the
            closed-book mastery measured by the sessions on the dashboard — use those to check what has stuck.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge tone={o.streakDays ? "good" : "neutral"}>{o.streakDays ? `${o.streakDays}-day streak` : "No streak yet"}</Badge>
          <Badge>{o.reviewsLast7Days} card reviews in 7 days</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tool href="/study/flashcards?deck=formulas" title="Formula flashcards" action={f.due ? `Review ${f.due} due` : "Learn new cards"}>
          <p className="text-muted-foreground">
            {f.total} cards: every core formula on the sheets, name → formula and formula → name and use. Spaced repetition.
          </p>
          <div className="flex items-baseline gap-2">
            <span className="stat">{f.due}</span>
            <span className="text-xs text-muted-foreground">due now · {f.total - f.reviewed} not started</span>
          </div>
          <Stages stages={f.stages} total={f.total} />
        </Tool>

        <Tool href="/study/drill" title="Formula drill" action="Start a drill">
          <p className="text-muted-foreground">{DRILL_ITEMS.length} formulas beside three near-misses each (wrong rate, off-by-one, a for ä…). Pick the right form.</p>
          <div className="flex items-baseline gap-2">
            <span className="stat">{pct(o.drill.correct, o.drill.attempts)}</span>
            <span className="text-xs text-muted-foreground">
              of {o.drill.attempts} answered correctly · {o.drill.missed.length} to revisit
            </span>
          </div>
        </Tool>

        <Tool href="/study/concepts" title="Concept quick checks" action="True or false?">
          <p className="text-muted-foreground">{QUICK_CHECKS.length} true/false statements on what the formulas mean and when they apply, sourced to the sheets.</p>
          <div className="flex items-baseline gap-2">
            <span className="stat">{pct(o.quickChecks.correct, o.quickChecks.attempts)}</span>
            <span className="text-xs text-muted-foreground">
              of {o.quickChecks.attempts} judged correctly · {o.quickChecks.missed.length} to revisit
            </span>
          </div>
        </Tool>

        <Tool href="/study/concepts?tab=questions" title="Concept questions" action="Practise with feedback">
          <p className="text-muted-foreground">SOA-style conceptual questions (statements I/II/III, equations of value, error diagnosis…) explained the moment you answer.</p>
          <div className="flex items-baseline gap-2">
            <span className="stat">{pct(o.conceptQuestions.correct, o.conceptQuestions.attempts)}</span>
            <span className="text-xs text-muted-foreground">of {o.conceptQuestions.attempts} correct</span>
          </div>
        </Tool>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Concept flashcards" className="lg:col-span-1">
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">{c.total} concepts — explain each in your own words, then compare with the summary and the ideas it is often confused with.</p>
            <div className="flex items-baseline gap-2">
              <span className="stat">{c.due}</span>
              <span className="text-xs text-muted-foreground">due now · {c.total - c.reviewed} not started</span>
            </div>
            <Stages stages={c.stages} total={c.total} />
            <Link href="/study/flashcards?deck=concepts" className="inline-block pt-1 text-sm font-medium text-primary hover:underline">
              Review concept cards →
            </Link>
          </div>
        </Panel>

        <Panel title="By topic" className="lg:col-span-2">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Topic</th>
                  <th>Quick checks</th>
                  <th>Formula drill</th>
                  <th>Concept questions</th>
                </tr>
              </thead>
              <tbody>
                {TOPIC_ORDER.map((t) => {
                  const cells = [o.quickChecks.byTopic[t], o.drill.byTopic[t], o.conceptQuestions.byTopic[t]];
                  return (
                    <tr key={t} className="border-t align-middle">
                      <td className="py-2 pr-2">{TOPIC_LABELS[t]}</td>
                      {cells.map((cell, idx) => (
                        <td key={idx} className="pr-4">
                          {cell.attempts ? (
                            <div className="w-36 space-y-0.5">
                              <div className="text-xs tabular-nums">
                                {pct(cell.correct, cell.attempts)} <span className="text-muted-foreground">({cell.correct}/{cell.attempts})</span>
                              </div>
                              <Meter value={cell.correct / cell.attempts} tone={cell.correct / cell.attempts >= 0.8 ? "good" : cell.correct / cell.attempts >= 0.6 ? "warn" : "bad"} />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Trouble spots">
          {o.troubleCards.length === 0 && o.drill.troubleFormulas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet. Cards you forget and drill items you miss collect here.</p>
          ) : (
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-1">Cards forgotten most</div>
                <ul className="space-y-1">
                  {o.troubleCards.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span className="truncate">{t.title}</span>
                      <span className="tabular-nums text-muted-foreground">×{t.lapses}</span>
                    </li>
                  ))}
                  {!o.troubleCards.length && <li className="text-muted-foreground">—</li>}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-1">Formulas missed in the drill</div>
                <ul className="space-y-1">
                  {o.drill.troubleFormulas.map((t) => (
                    <li key={t.formula} className="flex justify-between gap-2">
                      <a href={`/formulas#f-${t.formula}`} className="truncate hover:underline">
                        {FORMULA_BY_ID[t.formula]?.name ?? t.formula}
                      </a>
                      <span className="tabular-nums text-muted-foreground">×{t.misses}</span>
                    </li>
                  ))}
                  {!o.drill.troubleFormulas.length && <li className="text-muted-foreground">—</li>}
                </ul>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="A daily routine that works">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>
              <b>Flashcards first</b> — clear the due cards, then add 10–15 new ones. Write each formula out before flipping.
            </li>
            <li>
              <b>One drill</b> on the sheet section you are studying (10 items). Missed items stay on your list until you get them right.
            </li>
            <li>
              <b>15 quick checks</b> — they test the conditions and directions (premium vs discount, earliest vs latest call, which rate is larger) that calculation alone does not.
            </li>
            <li>
              <b>A few concept questions</b> with feedback, reading the explanation for every wrong option, not just yours.
            </li>
            <li>
              Every few days, a closed-book <Link href="/" className="text-primary hover:underline">Concept Practice or Formula practice session</Link> to measure what has stuck.
            </li>
          </ol>
        </Panel>
      </div>
    </main>
  );
}
