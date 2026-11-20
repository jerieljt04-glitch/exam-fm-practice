"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Exhibits } from "@/components/answers/Exhibits";
import { OptionContentView, statementCountOf } from "@/components/answers/OptionContentView";
import { MathRenderer } from "@/components/MathRenderer";
import { ChoiceLayers } from "@/components/report/QuestionReview";
import { Badge, Button, Meter, Tabs } from "@/components/ui";
import { CONCEPT_FAMILY_LABELS, DIFFICULTY_LABELS, ITEM_FORMAT_LABELS, type ChoiceInstance } from "@/lib/engine/types";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { QUICK_CHECKS, QUICK_CHECK_BY_ID, type QuickCheck } from "@/lib/study/quick-checks";
import { TOPIC_LABELS, TOPIC_ORDER, type TopicId } from "@/lib/syllabus";
import { cn, shuffle } from "@/lib/utils";

type Tab = "checks" | "questions";

/** Mirrors CONCEPT_FOCUS_LABELS in lib/engine/session (not imported, to keep the engine out of the browser bundle). */
type ConceptFocus = "mixed" | "definitions" | "equations" | "statements" | "errors";
const CONCEPT_FOCUS_LABELS: Record<ConceptFocus, string> = {
  mixed: "Mixed concepts",
  definitions: "Definitions and interpretation",
  equations: "Equations and notation",
  statements: "Statement analysis",
  errors: "Error diagnosis",
};


async function record(body: { kind: "QUICK_CHECK" | "CONCEPT_QUESTION"; itemId: string; topic: string; correct: boolean; detail?: string }) {
  await fetch("/api/study/attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);
}

function TopicSelect({ value, onChange }: { value: TopicId | "all"; onChange: (t: TopicId | "all") => void }) {
  return (
    <label className="space-y-1">
      <span className="eyebrow block">Topic</span>
      <select className="rounded-field border bg-elevated px-2 py-1.5" value={value} onChange={(e) => onChange(e.target.value as TopicId | "all")}>
        <option value="all">All topics</option>
        {TOPIC_ORDER.map((t) => (
          <option key={t} value={t}>
            {TOPIC_LABELS[t]}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------- quick checks

function QuickChecks({ missed }: { missed: string[] }) {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [length, setLength] = useState(15);
  const [round, setRound] = useState<QuickCheck[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);
  const [missedNow, setMissedNow] = useState(new Set(missed));

  const pool = useMemo(() => QUICK_CHECKS.filter((q) => (topic === "all" || q.topic === topic) && (!onlyMissed || missedNow.has(q.id))), [topic, onlyMissed, missedNow]);
  const current = round?.[index];
  const finished = round !== null && index >= round.length;

  const start = () => {
    setRound(shuffle(pool).slice(0, length === 0 ? pool.length : length));
    setIndex(0);
    setAnswer(null);
    setResults([]);
  };

  const respond = useCallback(
    (value: boolean) => {
      if (!current || answer !== null) return;
      setAnswer(value);
      const correct = value === current.truth;
      setResults((r) => [...r, { id: current.id, correct }]);
      setMissedNow((m) => {
        const next = new Set(m);
        if (correct) next.delete(current.id);
        else next.add(current.id);
        return next;
      });
      void record({ kind: "QUICK_CHECK", itemId: current.id, topic: current.topic, correct, detail: value ? "true" : "false" });
    },
    [current, answer]
  );

  const next = useCallback(() => {
    setIndex((i) => i + 1);
    setAnswer(null);
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (answer === null && (e.key === "t" || e.key === "T")) respond(true);
      else if (answer === null && (e.key === "f" || e.key === "F")) respond(false);
      else if (answer !== null && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, answer, respond, next]);

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
                <div className="eyebrow mb-1">Statements you misjudged</div>
                <ul className="space-y-2">
                  {results
                    .filter((r) => !r.correct)
                    .map((r) => {
                      const q = QUICK_CHECK_BY_ID[r.id];
                      return (
                        <li key={r.id} className="rounded-md bg-muted/50 p-2">
                          <MathRenderer content={q.text} />
                          <div className="mt-1 text-xs">
                            <b className={q.truth ? "text-success" : "text-destructive"}>{q.truth ? "True" : "False"}</b> — <MathRenderer content={q.why} className="inline text-muted-foreground" />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4 text-sm">
          <TopicSelect value={topic} onChange={setTopic} />
          <label className="space-y-1">
            <span className="eyebrow block">Statements</span>
            <select className="rounded-field border bg-elevated px-2 py-1.5" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[10, 15, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>All in selection</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5">
            <input type="checkbox" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} />
            Only statements I misjudged ({missedNow.size})
          </label>
          <Button onClick={start} disabled={pool.length === 0}>
            Start ({Math.min(pool.length, length === 0 ? pool.length : length)} of {pool.length})
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;
  const correct = answer !== null && answer === current.truth;
  const formula = current.formula ? FORMULA_BY_ID[current.formula] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Badge>{TOPIC_LABELS[current.topic]}</Badge>
        <span className="tabular-nums">
          {index + 1} / {round.length} · {results.filter((r) => r.correct).length} correct
        </span>
      </div>
      <Meter value={index / round.length} />
      <div className="rounded-xl border-2 p-5">
        <div className="eyebrow mb-2">True or false?</div>
        <MathRenderer content={current.text} className="text-base" />
      </div>
      {answer === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outlined" onClick={() => respond(true)}>
            True <span className="text-xs opacity-60">(T)</span>
          </Button>
          <Button size="lg" variant="outlined" onClick={() => respond(false)}>
            False <span className="text-xs opacity-60">(F)</span>
          </Button>
        </div>
      ) : (
        <div className={cn("space-y-2 rounded-lg border p-4 text-sm", correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
          <div className="font-semibold">
            {correct ? "Right" : "Not quite"} — the statement is <span className={current.truth ? "text-success" : "text-destructive"}>{current.truth ? "true" : "false"}</span>.
          </div>
          <MathRenderer content={current.why} />
          {(current.sources?.length || formula) && (
            <div className="text-xs text-muted-foreground">
              {current.sources?.length ? <>On the sheets: {current.sources.map((s) => `${s.doc} p.${s.page} (${s.section})`).join("; ")}. </> : null}
              {formula && (
                <a href={`/formulas#f-${formula.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {formula.name} ↗
                </a>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={next}>{index + 1 < round.length ? "Next →" : "See results"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- concept questions with instant feedback

function ConceptQuestions() {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [focus, setFocus] = useState<ConceptFocus>("mixed");
  const [level, setLevel] = useState<"mixed" | "1" | "2" | "3">("1");
  const [question, setQuestion] = useState<ChoiceInstance | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [score, setScore] = useState({ answered: 0, correct: 0 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/study/concept-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic === "all" ? null : topic, focus, level: level === "mixed" ? null : Number(level), exclude: recent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load a question.");
      const q = data.instance as ChoiceInstance;
      setQuestion(q);
      setSelected(null);
      setRecent((r) => [q.templateId, ...r].slice(0, 12));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const choose = (key: string) => {
    if (!question || selected) return;
    setSelected(key);
    const correct = key === question.correctKey;
    setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }));
    void record({ kind: "CONCEPT_QUESTION", itemId: question.templateId, topic: question.topic, correct, detail: key });
  };

  const statementCount = question ? question.statements?.length || statementCountOf(question.exhibits) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4 text-sm">
        <TopicSelect value={topic} onChange={setTopic} />
        <label className="space-y-1">
          <span className="eyebrow block">Focus</span>
          <select className="rounded-field border bg-elevated px-2 py-1.5" value={focus} onChange={(e) => setFocus(e.target.value as ConceptFocus)}>
            {(Object.keys(CONCEPT_FOCUS_LABELS) as ConceptFocus[]).map((f) => (
              <option key={f} value={f}>
                {CONCEPT_FOCUS_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="eyebrow block">Level</span>
          <select className="rounded-field border bg-elevated px-2 py-1.5" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="1">{DIFFICULTY_LABELS[1]}</option>
            <option value="2">{DIFFICULTY_LABELS[2]}</option>
            <option value="3">{DIFFICULTY_LABELS[3]}</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? "Generating…" : question ? "New question with these settings" : "Start"}
        </Button>
        {score.answered > 0 && (
          <span className="pb-1.5 text-xs text-muted-foreground">
            This sitting: {score.correct} / {score.answered} correct
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {question && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge>{TOPIC_LABELS[question.topic]}</Badge>
            <Badge tone={question.difficulty === 1 ? "neutral" : question.difficulty === 2 ? "info" : "warn"}>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
            <Badge>{ITEM_FORMAT_LABELS[question.itemFormat]}</Badge>
            {question.concept && <Badge tone="info">{CONCEPT_FAMILY_LABELS[question.concept.family]}</Badge>}
          </div>
          <div className="rounded-lg border p-4">
            <MathRenderer content={question.stem} className="text-[15px]" />
            <Exhibits exhibits={question.exhibits} className="mt-3" />
            <ul className="mt-3 grid gap-1.5">
              {question.options.map((o) => {
                const rich = o.content !== undefined && o.content.type !== "numeric";
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      onClick={() => choose(o.key)}
                      disabled={selected !== null}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected === null && "hover:border-primary/60 hover:bg-primary/5",
                        selected !== null && o.isCorrect && "border-success bg-success/10",
                        selected !== null && !o.isCorrect && o.key === selected && "border-destructive bg-destructive/10"
                      )}
                    >
                      <span className="w-5 shrink-0 pt-0.5 font-semibold">{o.key}</span>
                      <OptionContentView content={o.content} display={o.display} statementCount={statementCount} className={rich ? "w-full" : "min-w-[7rem]"} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {selected && (
            <>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm",
                  selected === question.correctKey ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
                )}
              >
                <span className="font-semibold">{selected === question.correctKey ? "Correct." : `Not quite — the answer is ${question.correctKey}. The explanation below shows where your reasoning left the chain.`}</span>
                <Button onClick={() => void load()} disabled={loading}>
                  {loading ? "Generating…" : "Next question →"}
                </Button>
              </div>
              <div className="space-y-3">
                <ChoiceLayers instance={question} selectedKey={selected} statementCount={statementCount} showTransfer={false} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void load()} disabled={loading}>
                  {loading ? "Generating…" : "Next question →"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page body

export function ConceptStudy({ missedChecks, initialTab }: { missedChecks: string[]; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { id: "checks", label: `Quick checks — true or false (${QUICK_CHECKS.length})` },
          { id: "questions", label: "Concept questions with instant feedback" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "checks" ? (
        <>
          <p className="text-sm text-muted-foreground">
            Short statements about what the formulas mean, when they apply and how quantities move — taken from both formula sheets. Answer, see why immediately, and come back to the
            ones you misjudged.
          </p>
          <QuickChecks missed={missedChecks} />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            SOA-style conceptual questions (definitions, applicability, equations of value, statements I/II/III, error diagnosis…) from the validated Concept Practice bank, one at a
            time, with the full explanation the moment you answer. For a closed-book measurement that feeds your concept mastery, use Concept Practice on the dashboard.
          </p>
          <ConceptQuestions />
        </>
      )}
    </div>
  );
}
