"use client";

import React, { useMemo, useState } from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button, Meter } from "@/components/ui";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { AREA_LABELS, type FormulaArea } from "@/lib/formulas/types";
import { DRILL_BY_ID, DRILL_ITEMS, type DrillItem } from "@/lib/study/drill";
import { cn } from "@/lib/utils";

const AREAS = [...new Set(DRILL_ITEMS.map((d) => d.area))] as FormulaArea[];
const KEYS = ["A", "B", "C", "D"] as const;

interface Shown {
  item: DrillItem;
  /** Option order: -1 is the correct form, 0–2 the near-misses. */
  order: number[];
}

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

async function record(item: DrillItem, correct: boolean, chosen: string) {
  await fetch("/api/study/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "DRILL", itemId: item.id, topic: item.topic, correct, detail: chosen }),
  }).catch(() => undefined);
}

export function FormulaDrill({ missed }: { missed: string[] }) {
  const [area, setArea] = useState<FormulaArea | "all">("all");
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [length, setLength] = useState(10);
  const [round, setRound] = useState<Shown[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);
  const [missedNow, setMissedNow] = useState(new Set(missed));

  const pool = useMemo(() => DRILL_ITEMS.filter((d) => (area === "all" || d.area === area) && (!onlyMissed || missedNow.has(d.id))), [area, onlyMissed, missedNow]);

  const start = () => {
    const picked = shuffle(pool).slice(0, length === 0 ? pool.length : length);
    setRound(picked.map((item) => ({ item, order: shuffle([-1, 0, 1, 2]) })));
    setIndex(0);
    setChoice(null);
    setResults([]);
  };

  const shown = round?.[index];
  const finished = round !== null && index >= round.length;

  const answer = (slot: number) => {
    if (!shown || choice !== null) return;
    setChoice(slot);
    const correct = shown.order[slot] === -1;
    setResults((r) => [...r, { id: shown.item.id, correct }]);
    setMissedNow((m) => {
      const next = new Set(m);
      if (correct) next.delete(shown.item.id);
      else next.add(shown.item.id);
      return next;
    });
    void record(shown.item, correct, shown.order[slot] === -1 ? "correct" : shown.item.wrong[shown.order[slot]].latex);
  };

  if (round === null || finished) {
    const score = results.filter((r) => r.correct).length;
    return (
      <div className="space-y-4">
        {finished && (
          <div className="rounded-lg border p-4 text-sm">
            <div className="text-base font-semibold">
              {score} / {results.length} correct
            </div>
            <Meter value={results.length ? score / results.length : 0} tone={score / Math.max(1, results.length) >= 0.8 ? "good" : "warn"} className="my-2" />
            {results.some((r) => !r.correct) && (
              <div>
                <div className="eyebrow mb-1">Revisit these formulas</div>
                <ul className="space-y-1">
                  {results
                    .filter((r) => !r.correct)
                    .map((r) => {
                      const item = DRILL_BY_ID[r.id];
                      return (
                        <li key={r.id} className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium">{FORMULA_BY_ID[item.formula]?.name}</span>
                          <span className="overflow-x-auto text-xs scrollbar-slim">
                            <MathRenderer content={`$${item.correct.latex}$`} />
                          </span>
                        </li>
                      );
                    })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Missed items stay on your “missed” list until you answer them correctly; turn on “Only formulas I missed” to drill them.</p>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4 text-sm">
          <label className="space-y-1">
            <span className="eyebrow block">Sheet section</span>
            <select className="rounded-md border bg-card px-2 py-1.5" value={area} onChange={(e) => setArea(e.target.value as FormulaArea | "all")}>
              <option value="all">All sections ({DRILL_ITEMS.length})</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}. {AREA_LABELS[a]} ({DRILL_ITEMS.filter((d) => d.area === a).length})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="eyebrow block">Questions</span>
            <select className="rounded-md border bg-card px-2 py-1.5" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>All in selection</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5">
            <input type="checkbox" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} />
            Only formulas I missed ({missedNow.size})
          </label>
          <Button onClick={start} disabled={pool.length === 0}>
            Start drill ({Math.min(pool.length, length === 0 ? pool.length : length)})
          </Button>
        </div>
      </div>
    );
  }

  if (!shown) return null;
  const { item, order } = shown;
  const formula = FORMULA_BY_ID[item.formula];
  const answered = choice !== null;
  const right = answered && order[choice!] === -1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-2">
          <Badge>{AREA_LABELS[item.area]}</Badge>
          {item.exact === false && <Badge tone="info">approximation</Badge>}
        </div>
        <span className="tabular-nums">
          {index + 1} / {round.length} · {results.filter((r) => r.correct).length} correct
        </span>
      </div>
      <Meter value={index / round.length} />
      <div className="rounded-lg border p-4">
        <div className="eyebrow mb-1">Which is the formula for…</div>
        <MathRenderer content={item.prompt} className="text-[15px]" />
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {order.map((slot, idx) => {
          const form = slot === -1 ? item.correct : item.wrong[slot];
          const isCorrect = slot === -1;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => answer(idx)}
                disabled={answered}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border-2 bg-card p-3 text-left transition-colors",
                  !answered && "hover:border-primary/60 hover:bg-primary/5",
                  answered && isCorrect && "border-success bg-success/10",
                  answered && !isCorrect && choice === idx && "border-destructive bg-destructive/10",
                  answered && !isCorrect && choice !== idx && "opacity-80"
                )}
              >
                <span className="pt-1 font-semibold">{KEYS[idx]}</span>
                <div className="min-w-0 flex-1">
                  <div className="overflow-x-auto scrollbar-slim">
                    <MathRenderer content={`$$${form.latex}$$`} />
                  </div>
                  {answered && (
                    <div className="mt-1 text-xs">
                      {isCorrect ? (
                        <span className="font-semibold text-success">Correct form.</span>
                      ) : (
                        <MathRenderer content={form.why ?? ""} className="text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div className={cn("space-y-2 rounded-lg border p-4 text-sm", right ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
          <div className="font-semibold">{right ? "Right." : `Not quite — the formula is ${KEYS[order.indexOf(-1)]}.`}</div>
          <div>
            <span className="eyebrow mr-2">Memory hook</span>
            <MathRenderer content={item.hook} className="inline" />
          </div>
          {formula && (
            <div className="text-xs text-muted-foreground">
              {formula.name} · on the sheets:{" "}
              {formula.sources
                .filter((s) => s.doc !== "DERIVED")
                .map((s) => `${s.doc} p.${s.page} (${s.section})`)
                .join("; ") || "derived"}{" "}
              ·{" "}
              <a href={`/formulas#f-${formula.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                library entry ↗
              </a>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setIndex((i) => i + 1);
                setChoice(null);
              }}
            >
              {index + 1 < round.length ? "Next →" : "See results"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
