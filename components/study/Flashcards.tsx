"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button, Meter } from "@/components/ui";
import { CONCEPT_BY_ID } from "@/lib/concepts/registry";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { AREA_LABELS, SOURCE_LABELS, type FormulaArea } from "@/lib/formulas/types";
import type { CardState } from "@/lib/server/study";
import { CARD_KIND_LABELS, DECK_LABELS, filterCards, type CardKind, type Deck, type StudyCardDef } from "@/lib/study/cards";
import { NEW_CARD, RATINGS, RATING_LABELS, cardStage, describeInterval, nextSchedule, type Rating } from "@/lib/study/schedule";
import { OUTCOMES, TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

const LEARN_AHEAD_MS = 20 * 60_000;
const AREAS = Object.keys(AREA_LABELS) as FormulaArea[];
const RATING_TONE: Record<Rating, string> = {
  again: "border-destructive/60 hover:bg-destructive/10",
  hard: "border-warning/60 hover:bg-warning/10",
  good: "border-primary/60 hover:bg-primary/10",
  easy: "border-success/60 hover:bg-success/10",
};

type Mode = "due" | "cram";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="eyebrow mb-0.5">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((item) => (
          <li key={item}>
            <MathRenderer content={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- card faces

function FormulaFront({ card, showHint }: { card: StudyCardDef; showHint: boolean }) {
  const f = FORMULA_BY_ID[card.ref];
  if (card.kind === "recognise") {
    return (
      <div className="space-y-3 text-center">
        <div className="overflow-x-auto py-2 text-lg scrollbar-slim">
          <MathRenderer content={`$$${f.expression}$$`} />
        </div>
        <p className="text-sm text-muted-foreground">Name this formula. What does it compute, and when does it apply (or not)?</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-xl font-semibold">{f.name}</h3>
      <MathRenderer content={f.meaning} className="mx-auto max-w-xl text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Write the formula from memory, then flip.</p>
      {showHint && f.variables.length > 0 && (
        <div className="mx-auto max-w-xl rounded-md bg-muted/60 p-2 text-left text-xs">
          <div className="eyebrow mb-1">Hint: the symbols involved</div>
          <ul className="space-y-0.5">
            {f.variables.map((v) => (
              <li key={v.symbol}>
                <MathRenderer content={`$${v.symbol}$ — ${v.meaning}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FormulaBack({ card }: { card: StudyCardDef }) {
  const f = FORMULA_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-sm">
      {card.kind === "recognise" ? (
        <div className="text-center">
          <h3 className="text-xl font-semibold">{f.name}</h3>
          <MathRenderer content={f.meaning} className="mx-auto mt-1 max-w-xl text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-primary/5 py-2 text-lg scrollbar-slim">
          <MathRenderer content={`$$${f.expression}$$`} />
        </div>
      )}
      {f.discrepancy && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <span className="font-semibold">The sheets differ: </span>
          <MathRenderer content={f.discrepancy} className="inline" />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          {f.variables.length > 0 && (
            <div>
              <div className="eyebrow mb-0.5">Symbols</div>
              <ul className="space-y-0.5">
                {f.variables.map((v) => (
                  <li key={v.symbol}>
                    <MathRenderer content={`$${v.symbol}$ — ${v.meaning}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <List title="Assumptions" items={f.assumptions} />
          <List title="Applies when" items={f.conditions} />
          <List title="Common misuse" items={f.misuse} />
        </div>
        <div className="space-y-2">
          <div>
            <div className="eyebrow mb-0.5">Why it holds (memory hook)</div>
            <MathRenderer content={f.derivation} />
          </div>
          <List title="Used for" items={f.applications} />
          <div>
            <div className="eyebrow mb-0.5">On the formula sheets</div>
            <ul className="space-y-1">
              {f.sources.map((s, idx) => (
                <li key={idx} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                  <div className="text-muted-foreground">
                    {s.doc === "DERIVED" ? SOURCE_LABELS.DERIVED : `${s.doc} · PDF p.${s.page} · ${s.label} · ${s.section}`}
                  </div>
                  {s.doc !== "DERIVED" && (
                    <div className="overflow-x-auto scrollbar-slim">
                      <MathRenderer content={`$${s.notation}$`} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <a href={`/formulas#f-${f.id}`} className="inline-block text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
        Full entry in the formula library ↗
      </a>
    </div>
  );
}

function ConceptFront({ card }: { card: StudyCardDef }) {
  const c = CONCEPT_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-xl font-semibold">{c.label}</h3>
      <p className="mx-auto max-w-xl text-sm text-muted-foreground">
        Explain this idea in your own words: what it means, when it applies, and the relationship behind it. Then flip.
      </p>
    </div>
  );
}

function ConceptBack({ card }: { card: StudyCardDef }) {
  const c = CONCEPT_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md bg-primary/5 p-3">
        <MathRenderer content={c.summary} className="text-[15px]" />
      </div>
      {c.confusable?.length ? (
        <div>
          <div className="eyebrow mb-1">Often confused with</div>
          <ul className="space-y-1.5">
            {c.confusable.map((id) => (
              <li key={id} className="rounded-md border p-2">
                <div className="font-medium">{CONCEPT_BY_ID[id]?.label ?? id}</div>
                {CONCEPT_BY_ID[id] && <MathRenderer content={CONCEPT_BY_ID[id].summary} className="text-muted-foreground" />}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <div className="eyebrow mb-0.5">Syllabus outcomes</div>
        <ul className="list-disc pl-5 text-muted-foreground">
          {c.outcomes.map((o) => (
            <li key={o}>{OUTCOMES[o]?.label ?? o}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the trainer

function buildQueue(cards: StudyCardDef[], states: Record<string, CardState>, mode: Mode, newLimit: number): string[] {
  if (mode === "cram") return [...cards].sort(() => Math.random() - 0.5).map((c) => c.id);
  const horizon = Date.now() + LEARN_AHEAD_MS;
  const due = cards.filter((c) => states[c.id] && new Date(states[c.id].dueAt).getTime() <= horizon).sort((a, b) => states[a.id].dueAt.localeCompare(states[b.id].dueAt));
  const fresh = cards.filter((c) => !states[c.id]);
  // New cards: recall before recognition, in library order (it follows the sheets).
  const ordered = [...fresh.filter((c) => c.kind !== "recognise"), ...fresh.filter((c) => c.kind === "recognise")];
  return [...due.map((c) => c.id), ...ordered.slice(0, newLimit).map((c) => c.id)];
}

export function Flashcards({ initialStates, initialDeck }: { initialStates: Record<string, CardState>; initialDeck: Deck }) {
  const [states, setStates] = useState(initialStates);
  const [deck, setDeck] = useState<Deck>(initialDeck);
  const [area, setArea] = useState<FormulaArea | "all">("all");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [kind, setKind] = useState<CardKind | "both">("both");
  const [includeUnclear, setIncludeUnclear] = useState(false);
  const [mode, setMode] = useState<Mode>("due");
  const [newLimit, setNewLimit] = useState(15);

  const [queue, setQueue] = useState<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [written, setWritten] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });

  const cards = useMemo(
    () => filterCards({ deck, area: deck === "formulas" ? area : "all", topic: deck === "concepts" ? topic : "all", kind: deck === "formulas" ? kind : "both", includeUnclear }),
    [deck, area, topic, kind, includeUnclear]
  );
  const counts = useMemo(() => {
    const horizon = Date.now() + LEARN_AHEAD_MS;
    let due = 0;
    let fresh = 0;
    const stages = { new: 0, learning: 0, young: 0, mature: 0 };
    for (const c of cards) {
      const s = states[c.id];
      stages[cardStage(s)] += 1;
      if (!s) fresh += 1;
      else if (new Date(s.dueAt).getTime() <= horizon) due += 1;
    }
    return { due, fresh, stages };
  }, [cards, states]);

  const currentId = queue ? queue[position] : undefined;
  const current = currentId ? cards.find((c) => c.id === currentId) ?? filterCards({ deck, includeUnclear: true }).find((c) => c.id === currentId) : undefined;
  const finished = queue !== null && position >= queue.length;

  const start = () => {
    setQueue(buildQueue(cards, states, mode, newLimit));
    setPosition(0);
    setFlipped(false);
    setHint(false);
    setWritten("");
    setTally({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || saving) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/study/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: current.id, rating }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save the review.");
        setStates((prev) => ({
          ...prev,
          [current.id]: { ease: data.ease, intervalDays: data.intervalDays, reps: data.reps, lapses: data.lapses, dueAt: data.dueAt, lastRating: rating, lastReviewedAt: new Date().toISOString() },
        }));
        setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
        // A forgotten card comes back at the end of this sitting.
        if (rating === "again") setQueue((q) => (q ? [...q, current.id] : q));
        setPosition((p) => p + 1);
        setFlipped(false);
        setHint(false);
        setWritten("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [current, saving]
  );

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT")) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void rate(RATINGS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, rate]);

  // ---------------------------------------------------------------- setup screen
  if (queue === null || finished) {
    const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-4">
        {finished && (
          <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
            <div className="font-semibold">Round complete — {reviewed} reviews.</div>
            <div className="mt-1 text-muted-foreground">
              Again {tally.again} · Hard {tally.hard} · Good {tally.good} · Easy {tally.easy}. Cards you rated <b>Again</b> came back at the end of the round and are due again in
              ten minutes; the rest are scheduled further out.
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {(["formulas", "concepts"] as Deck[]).map((d) => (
                <Button key={d} size="sm" variant={deck === d ? "primary" : "outlined"} onClick={() => setDeck(d)}>
                  {DECK_LABELS[d]}
                </Button>
              ))}
            </div>
            {deck === "formulas" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="eyebrow block">Sheet section</span>
                  <select className="w-full rounded-field border bg-elevated px-2 py-1.5" value={area} onChange={(e) => setArea(e.target.value as FormulaArea | "all")}>
                    <option value="all">All sections</option>
                    {AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}. {AREA_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="eyebrow block">Card type</span>
                  <select className="w-full rounded-field border bg-elevated px-2 py-1.5" value={kind} onChange={(e) => setKind(e.target.value as CardKind | "both")}>
                    <option value="both">Both directions</option>
                    <option value="recall">{CARD_KIND_LABELS.recall} (name → formula)</option>
                    <option value="recognise">{CARD_KIND_LABELS.recognise} (formula → name and use)</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" checked={includeUnclear} onChange={(e) => setIncludeUnclear(e.target.checked)} />
                  <span>Include formulas of unclear syllabus relevance (continuous annuities, second-order approximation…)</span>
                </label>
              </div>
            ) : (
              <label className="block space-y-1">
                <span className="eyebrow block">Topic</span>
                <select className="w-full rounded-field border bg-elevated px-2 py-1.5 sm:w-72" value={topic} onChange={(e) => setTopic(e.target.value as TopicId | "all")}>
                  <option value="all">All topics</option>
                  {TOPIC_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TOPIC_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="eyebrow block">Mode</span>
                <select className="rounded-field border bg-elevated px-2 py-1.5" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  <option value="due">Spaced review (due cards + new)</option>
                  <option value="cram">Cram (every card in this selection, shuffled)</option>
                </select>
              </label>
              {mode === "due" && (
                <label className="space-y-1">
                  <span className="eyebrow block">New cards this round</span>
                  <select className="rounded-field border bg-elevated px-2 py-1.5" value={newLimit} onChange={(e) => setNewLimit(Number(e.target.value))}>
                    {[0, 5, 10, 15, 25, 40].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button onClick={start} disabled={mode === "due" ? counts.due + Math.min(counts.fresh, newLimit) === 0 : cards.length === 0}>
                {mode === "due" ? `Start: ${counts.due} due + ${Math.min(counts.fresh, newLimit)} new` : `Cram ${cards.length} cards`}
              </Button>
            </div>
            {mode === "due" && counts.due + Math.min(counts.fresh, newLimit) === 0 && (
              <p className="text-xs text-muted-foreground">Nothing due in this selection. Add new cards, widen the selection, or cram.</p>
            )}
          </div>
          <div className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="eyebrow">This selection · {cards.length} cards</div>
            {(["new", "learning", "young", "mature"] as const).map((s) => (
              <div key={s}>
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{s}</span>
                  <span className="tabular-nums text-muted-foreground">{counts.stages[s]}</span>
                </div>
                <Meter value={cards.length ? counts.stages[s] / cards.length : 0} tone={s === "mature" ? "good" : s === "young" ? "info" : s === "learning" ? "warn" : "neutral"} />
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Young: interval under 3 weeks. Mature: 3 weeks or more — memorised for the long term.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- reviewing
  if (!current) return null;
  const state = states[current.id];
  const previews = Object.fromEntries(RATINGS.map((r) => [r, describeInterval(nextSchedule(state ?? NEW_CARD, r).intervalDays)])) as Record<Rating, string>;
  const formula = current.deck === "formulas" ? FORMULA_BY_ID[current.ref] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{CARD_KIND_LABELS[current.kind]}</Badge>
          {formula ? <Badge>{AREA_LABELS[formula.area]}</Badge> : <Badge>{TOPIC_LABELS[current.topic]}</Badge>}
          {formula?.relevance === "unclear" && <Badge tone="warn">relevance unclear</Badge>}
          <span>{state ? `${cardStage(state)} · reviewed ${state.reps}× · lapses ${state.lapses}` : "new card"}</span>
        </div>
        <span className="tabular-nums">
          {position + 1} / {queue.length}
        </span>
      </div>
      <Meter value={position / queue.length} />

      <div className={cn("min-h-[16rem] rounded-xl border-2 bg-card p-5 shadow-sm transition-colors", flipped ? "border-primary/40" : "border-border")}>
        {current.deck === "formulas" ? <FormulaFront card={current} showHint={hint} /> : <ConceptFront card={current} />}
        {flipped && (
          <div className="mt-5 border-t pt-4">{current.deck === "formulas" ? <FormulaBack card={current} /> : <ConceptBack card={current} />}</div>
        )}
      </div>

      <details className="rounded-lg border text-sm" open={written.length > 0}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">Write it out (optional — active recall sticks better; LaTeX in $…$ is previewed)</summary>
        <div className="grid gap-2 border-t p-3 md:grid-cols-2">
          <textarea
            value={written}
            onChange={(e) => setWritten(e.target.value)}
            rows={3}
            placeholder={current.kind === "recall" ? "e.g. $a_{\\overline{n|}} = (1 - v^n)/i$" : "Your explanation…"}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
          <div className="rounded-md bg-muted/40 p-2 text-sm">{written.trim() ? <MathRenderer content={written} /> : <span className="text-xs text-muted-foreground">Preview</span>}</div>
        </div>
      </details>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!flipped ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => setFlipped(true)}>
            Show answer <span className="text-xs opacity-70">(space)</span>
          </Button>
          {current.kind === "recall" && formula && formula.variables.length > 0 && !hint && (
            <Button variant="ghost" onClick={() => setHint(true)}>
              Show a hint
            </Button>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">How well did you recall it? Be honest — the schedule depends on it.</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {RATINGS.map((r, idx) => (
              <button
                key={r}
                type="button"
                disabled={saving}
                onClick={() => void rate(r)}
                className={cn("rounded-lg border-2 bg-card px-3 py-2 text-left text-sm transition-colors disabled:opacity-50", RATING_TONE[r])}
              >
                <div className="font-semibold">
                  {idx + 1}. {RATING_LABELS[r].split(" — ")[0]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {RATING_LABELS[r].split(" — ")[1]} · next in {previews[r]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setQueue(null)}>
          End round
        </Button>
      </div>
    </div>
  );
}
