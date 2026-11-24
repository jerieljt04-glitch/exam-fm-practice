"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button, Meter } from "@/components/ui";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { STRATEGY_KIND_ASK, STRATEGY_KIND_LABELS, STRATEGY_QUESTIONS, type StrategyKind, type StrategyOption, type StrategyQuestion } from "@/lib/study/strategy";
import { TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "@/lib/syllabus";
import { cn, pct, shuffle } from "@/lib/utils";

const KEYS = ["A", "B", "C", "D"] as const;
const KINDS = Object.keys(STRATEGY_KIND_LABELS) as StrategyKind[];
/** Seconds per question in a timed mock: recognising the plan, not calculating. */
const SECONDS_PER_QUESTION = 90;

type Mode = "practice" | "mock";

interface Shown {
  q: StrategyQuestion;
  /** Option order: -1 is the correct plan, 0–2 the wrong plans. */
  order: number[];
}

const optionOf = (q: StrategyQuestion, slot: number): StrategyOption => (slot === -1 ? q.correct : q.wrong[slot]);

const fmt = (x: number, digits = 4) => {
  if (Math.abs(x) < 1 && digits >= 4 && x !== 0) return x.toFixed(digits);
  return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

async function record(q: StrategyQuestion, correct: boolean, detail: string) {
  await fetch("/api/study/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "STRATEGY", itemId: q.id, topic: q.topic, correct, detail }),
  }).catch(() => undefined);
}

/** The plan as a numbered list of steps. */
function Steps({ steps }: { steps: string[] }) {
  if (steps.length === 1) return <MathRenderer content={steps[0]} className="text-sm" />;
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {steps.map((s, k) => (
        <li key={k}>
          <MathRenderer content={s} />
        </li>
      ))}
    </ol>
  );
}

function Problem({ q, index, total }: { q: StrategyQuestion; index: number; total: number }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <Badge>{TOPIC_LABELS[q.topic]}</Badge>
          <Badge tone="primary">{STRATEGY_KIND_LABELS[q.kind]}</Badge>
        </div>
        <span className="tabular-nums">
          Question {index + 1} of {total}
        </span>
      </div>
      <div className="font-medium">{q.title}</div>
      <MathRenderer content={q.problem} className="text-[15px]" />
      <div className="eyebrow pt-1">{STRATEGY_KIND_ASK[q.kind]}</div>
    </div>
  );
}

/** The four options; after answering, each shows whether it is right and why. */
function Options({ shown, choice, revealed, onChoose }: { shown: Shown; choice: number | null; revealed: boolean; onChoose?: (idx: number) => void }) {
  const { q, order } = shown;
  return (
    <ul className="grid gap-2" role="radiogroup" aria-label="Plans">
      {order.map((slot, idx) => {
        const opt = optionOf(q, slot);
        const isCorrect = slot === -1;
        const chosen = choice === idx;
        const value = !isCorrect && opt.value ? opt.value() : null;
        return (
          <li key={idx}>
            <button
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={`Option ${KEYS[idx]}`}
              onClick={() => onChoose?.(idx)}
              disabled={revealed || !onChoose}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border-2 bg-card p-3 text-left transition-colors",
                !revealed && "hover:border-primary/60",
                !revealed && chosen && "border-primary bg-primary-container text-primary-on-container",
                revealed && isCorrect && "border-success bg-success-container",
                revealed && !isCorrect && chosen && "border-destructive bg-destructive-container"
              )}
            >
              <span className="pt-0.5 font-semibold">{KEYS[idx]}</span>
              <div className="min-w-0 flex-1 space-y-1 overflow-x-auto scrollbar-slim">
                <Steps steps={opt.steps} />
                {revealed && (
                  <div className="border-t pt-1 text-xs">
                    {isCorrect ? (
                      <span className="font-semibold text-success">Right plan.</span>
                    ) : (
                      <>
                        <span className={cn("font-semibold", chosen ? "text-destructive" : "text-muted-foreground")}>{chosen ? "Your choice — " : "Why not: "}</span>
                        <MathRenderer content={opt.why ?? ""} className="inline" />
                        {value !== null && Number.isFinite(value) && (
                          <span className="text-muted-foreground"> (This plan gives ≈ {fmt(value, q.result?.digits ?? 4)}.)</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** What to take away: the insight, the number the right plan reaches, the formulas used. */
function Takeaway({ q, right }: { q: StrategyQuestion; right: boolean | null }) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-4 text-sm", right === null ? "" : right ? "border-success" : "border-destructive")}>
      {right !== null && <div className="font-semibold">{right ? "Right." : "Not quite — compare your plan with the right one above."}</div>}
      <div>
        <span className="eyebrow mr-2">Instinct</span>
        <MathRenderer content={q.insight} className="inline" />
      </div>
      {q.result && (
        <div>
          <span className="eyebrow mr-2">Where the right plan leads</span>
          {q.result.label} ≈ <span className="font-semibold tabular-nums">{fmt(q.result.value(), q.result.digits ?? 4)}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Formulas:</span>
        {q.formulas.map((id) => (
          <a key={id} href={`/formulas#f-${id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {FORMULA_BY_ID[id]?.name ?? id} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export function StrategyPractice({ missed }: { missed: string[] }) {
  const [mode, setMode] = useState<Mode>("practice");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [kind, setKind] = useState<StrategyKind | "all">("all");
  const [length, setLength] = useState(10);
  const [timed, setTimed] = useState(true);
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [missedNow, setMissedNow] = useState(new Set(missed));

  const [round, setRound] = useState<Shown[] | null>(null);
  const [roundMode, setRoundMode] = useState<Mode>("practice");
  const [index, setIndex] = useState(0);
  /** Chosen option index per question (null = unanswered). */
  const [choices, setChoices] = useState<Array<number | null>>([]);
  /** Practice: whether the current question has been answered. Mock: whether the mock is submitted. */
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reviewing, setReviewing] = useState<number | null>(null);

  const pool = useMemo(
    () => STRATEGY_QUESTIONS.filter((q) => (topic === "all" || q.topic === topic) && (kind === "all" || q.kind === kind) && (!onlyMissed || missedNow.has(q.id))),
    [topic, kind, onlyMissed, missedNow]
  );
  const size = Math.min(pool.length, length === 0 ? pool.length : length);

  const start = () => {
    const picked = shuffle(pool).slice(0, size);
    setRound(picked.map((q) => ({ q, order: shuffle([-1, 0, 1, 2]) })));
    setRoundMode(mode);
    setChoices(picked.map(() => null));
    setIndex(0);
    setRevealed(false);
    setFinished(false);
    setReviewing(null);
    setDeadline(mode === "mock" && timed ? Date.now() + picked.length * SECONDS_PER_QUESTION * 1000 : null);
  };

  const markMissed = (id: string, correct: boolean) =>
    setMissedNow((m) => {
      const next = new Set(m);
      if (correct) next.delete(id);
      else next.add(id);
      return next;
    });

  const isRight = (shown: Shown, choice: number | null) => choice !== null && shown.order[choice] === -1;

  const submitMock = useCallback(() => {
    if (!round) return;
    round.forEach((shown, k) => {
      const c = choices[k];
      const correct = isRight(shown, c);
      void record(shown.q, correct, c === null ? "mock:unanswered" : `mock:${correct ? "correct" : `wrong-${shown.order[c]}`}`);
      markMissed(shown.q.id, correct);
    });
    setRevealed(true);
    setFinished(true);
    setDeadline(null);
  }, [round, choices]);

  // Mock timer: tick, and submit when time runs out.
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [deadline]);
  useEffect(() => {
    if (deadline !== null && now >= deadline && !finished) submitMock();
  }, [now, deadline, finished, submitMock]);

  const choose = (idx: number) => {
    if (!round || finished) return;
    if (roundMode === "practice") {
      if (revealed) return;
      const shown = round[index];
      const correct = isRight(shown, idx);
      setChoices((c) => c.map((x, k) => (k === index ? idx : x)));
      setRevealed(true);
      markMissed(shown.q.id, correct);
      void record(shown.q, correct, correct ? "practice:correct" : `practice:wrong-${shown.order[idx]}`);
    } else {
      setChoices((c) => c.map((x, k) => (k === index ? idx : x)));
    }
  };

  const next = () => {
    if (!round) return;
    if (roundMode === "practice") {
      if (index + 1 >= round.length) setFinished(true);
      else {
        setIndex(index + 1);
        setRevealed(false);
      }
    } else setIndex(Math.min(round.length - 1, index + 1));
  };

  // Keyboard: A–D (or 1–4) choose; Enter / → moves on.
  useEffect(() => {
    if (!round || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      const pos = ["a", "b", "c", "d"].indexOf(k) >= 0 ? ["a", "b", "c", "d"].indexOf(k) : ["1", "2", "3", "4"].indexOf(k);
      if (pos >= 0) {
        e.preventDefault();
        choose(pos);
      } else if ((e.key === "Enter" || e.key === "ArrowRight") && (roundMode === "mock" || revealed)) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" && roundMode === "mock") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------ setup / results
  if (round === null || finished) {
    const results = round?.map((shown, k) => ({ shown, choice: choices[k], right: isRight(shown, choices[k]) })) ?? [];
    const score = results.filter((r) => r.right).length;
    const byTopic = TOPIC_ORDER.map((t) => {
      const list = results.filter((r) => r.shown.q.topic === t);
      return { t, n: list.length, right: list.filter((r) => r.right).length };
    }).filter((x) => x.n > 0);
    const byKind = KINDS.map((k) => {
      const list = results.filter((r) => r.shown.q.kind === k);
      return { k, n: list.length, right: list.filter((r) => r.right).length };
    }).filter((x) => x.n > 0);

    return (
      <div className="space-y-4">
        {finished && round && (
          <section className="space-y-3 rounded-lg border p-4 text-sm" aria-label="Results">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {roundMode === "mock" ? "Mock results" : "Round complete"}: {score} / {results.length} plans right ({pct(score, results.length)})
              </h2>
              {roundMode === "mock" && <span className="text-xs text-muted-foreground">{results.filter((r) => r.choice === null).length} unanswered</span>}
            </div>
            <Meter value={results.length ? score / results.length : 0} tone={score / Math.max(1, results.length) >= 0.8 ? "good" : score / Math.max(1, results.length) >= 0.6 ? "warn" : "bad"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-1">By topic</div>
                <ul className="space-y-0.5">
                  {byTopic.map((x) => (
                    <li key={x.t} className="flex justify-between gap-2">
                      <span>{TOPIC_LABELS[x.t]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {x.right}/{x.n}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-1">By question type</div>
                <ul className="space-y-0.5">
                  {byKind.map((x) => (
                    <li key={x.k} className="flex justify-between gap-2">
                      <span>{STRATEGY_KIND_LABELS[x.k]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {x.right}/{x.n}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Review every question</div>
              <ul className="space-y-1">
                {results.map((r, k) => (
                  <li key={r.shown.q.id}>
                    <button type="button" onClick={() => setReviewing(reviewing === k ? null : k)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-secondary" aria-expanded={reviewing === k}>
                      <span>
                        {k + 1}. {r.shown.q.title}
                      </span>
                      <Badge tone={r.right ? "good" : r.choice === null ? "neutral" : "bad"}>{r.right ? "right" : r.choice === null ? "unanswered" : "missed"}</Badge>
                    </button>
                    {reviewing === k && (
                      <div className="mt-2 space-y-2 pl-2">
                        <Problem q={r.shown.q} index={k} total={results.length} />
                        <Options shown={r.shown} choice={r.choice} revealed />
                        <Takeaway q={r.shown.q} right={null} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">Missed questions stay on your “missed” list until you get them right; tick “Only questions I missed” to retry them.</p>
          </section>
        )}

        <section className="space-y-3 rounded-lg border p-4 text-sm" aria-label="Set up a round">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
            {(["practice", "mock"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn("rounded-pill border px-4 py-1.5 font-medium", mode === m ? "border-primary bg-primary-container text-primary-on-container" : "hover:bg-secondary")}
              >
                {m === "practice" ? "Practice — feedback after each" : "Mock — feedback at the end"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="eyebrow block">Topic</span>
              <select className="rounded-field border bg-elevated px-2 py-1.5" value={topic} onChange={(e) => setTopic(e.target.value as TopicId | "all")}>
                <option value="all">All topics ({STRATEGY_QUESTIONS.length})</option>
                {TOPIC_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]} ({STRATEGY_QUESTIONS.filter((q) => q.topic === t).length})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="eyebrow block">Question type</span>
              <select className="rounded-field border bg-elevated px-2 py-1.5" value={kind} onChange={(e) => setKind(e.target.value as StrategyKind | "all")}>
                <option value="all">All types</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {STRATEGY_KIND_LABELS[k]} ({STRATEGY_QUESTIONS.filter((q) => q.kind === k).length})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="eyebrow block">Questions</span>
              <select aria-label="Number of questions" className="rounded-field border bg-elevated px-2 py-1.5" value={length} onChange={(e) => setLength(Number(e.target.value))}>
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={0}>All in selection</option>
              </select>
            </label>
            {mode === "mock" && (
              <label className="flex items-center gap-2 pb-1.5">
                <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
                Timed ({SECONDS_PER_QUESTION} s per question)
              </label>
            )}
            <label className="flex items-center gap-2 pb-1.5">
              <input type="checkbox" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} />
              Only questions I missed ({missedNow.size})
            </label>
            <Button onClick={start} disabled={size === 0}>
              {mode === "practice" ? `Start practice (${size})` : `Start mock (${size})`}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------ a question
  const shown = round[index];
  const choice = choices[index];
  const answeredCount = choices.filter((c) => c !== null).length;
  const remaining = deadline === null ? null : Math.max(0, Math.round((deadline - now) / 1000));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{roundMode === "practice" ? `Practice · ${choices.slice(0, index + (revealed ? 1 : 0)).filter((c, k) => isRight(round[k], c)).length} right so far` : `Mock · ${answeredCount}/${round.length} answered`}</span>
        {remaining !== null && (
          <span className={cn("tabular-nums font-medium", remaining < 60 ? "text-destructive" : "text-foreground")} aria-live="off">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} left
          </span>
        )}
      </div>
      <Meter value={(index + (revealed ? 1 : 0)) / round.length} />

      {roundMode === "mock" && (
        <nav className="flex flex-wrap gap-1" aria-label="Questions">
          {round.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setIndex(k)}
              aria-current={k === index ? "step" : undefined}
              aria-label={`Question ${k + 1}${choices[k] !== null ? ", answered" : ""}`}
              className={cn(
                "h-8 w-8 rounded-md border text-xs font-medium tabular-nums",
                k === index ? "border-primary bg-primary text-primary-foreground" : choices[k] !== null ? "bg-primary-container text-primary-on-container" : "hover:bg-secondary"
              )}
            >
              {k + 1}
            </button>
          ))}
        </nav>
      )}

      <Problem q={shown.q} index={index} total={round.length} />
      <Options shown={shown} choice={choice} revealed={roundMode === "practice" && revealed} onChoose={choose} />

      {roundMode === "practice" && revealed && (
        <>
          <Takeaway q={shown.q} right={isRight(shown, choice)} />
          <div className="flex justify-end">
            <Button onClick={next}>{index + 1 < round.length ? "Next →" : "See results"}</Button>
          </div>
        </>
      )}

      {roundMode === "mock" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outlined" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
              ← Previous
            </Button>
            <Button variant="outlined" onClick={next} disabled={index + 1 >= round.length}>
              Next →
            </Button>
          </div>
          <Button
            onClick={() => {
              const unanswered = round.length - answeredCount;
              if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) return;
              submitMock();
            }}
          >
            Submit mock
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Keys: A–D to choose{roundMode === "mock" ? ", ← → to move" : ", Enter for the next question"}.</p>
    </div>
  );
}

