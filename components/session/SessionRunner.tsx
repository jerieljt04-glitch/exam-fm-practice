"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Exhibits } from "@/components/answers/Exhibits";
import { OptionContentView, statementCountOf } from "@/components/answers/OptionContentView";
import { FormulaLibrary } from "@/components/formulas/FormulaLibrary";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button, Modal } from "@/components/ui";
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, METHODS, type Confidence } from "@/lib/engine/skills";
import { REFERENCE_LABELS } from "@/lib/reference";
import type { ResponseState, SessionView } from "@/lib/server/repository";
import { formatClock, remainingSeconds } from "@/lib/timer";
import { cn } from "@/lib/utils";

import { Scratchpad } from "./Scratchpad";

type Patch = Partial<Omit<ResponseState, "timeSpentSeconds">>;

const AUTOSAVE_MS = 8000;

export function SessionRunner({ initial }: { initial: SessionView }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial.questions);
  const [index, setIndex] = useState(Math.min(initial.currentIndex, initial.questions.length - 1));
  const [elapsed, setElapsed] = useState(initial.elapsedSeconds);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [sidePane, setSidePane] = useState<"working" | "formulas">("working");
  const supported = initial.reference === "supported";

  // Pending edits and per-question time not yet sent to the server.
  const pending = useRef(new Map<string, Patch>());
  const pendingSeconds = useRef(new Map<string, number>());
  const elapsedRef = useRef(elapsed);
  const indexRef = useRef(index);
  const submittedRef = useRef(false);
  elapsedRef.current = elapsed;
  indexRef.current = index;

  const current = questions[index];
  const remaining = remainingSeconds(initial.durationSeconds, elapsed);

  const buildPayload = useCallback(() => {
    const ids = new Set([...pending.current.keys(), ...pendingSeconds.current.keys()]);
    const answers = [...ids].map((instanceId) => ({ instanceId, ...pending.current.get(instanceId), addSeconds: pendingSeconds.current.get(instanceId) ?? 0 }));
    return { elapsedSeconds: elapsedRef.current, currentIndex: indexRef.current, answers };
  }, []);

  const save = useCallback(async () => {
    if (submittedRef.current) return;
    const payload = buildPayload();
    pending.current.clear();
    pendingSeconds.current.clear();
    setSaveState("saving");
    try {
      const res = await fetch(`/api/sessions/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaveState("saved");
      if (data.status === "SUBMITTED") {
        submittedRef.current = true;
        router.replace(`/session/${initial.id}/report`);
      }
    } catch {
      // Put the edits back so the next save retries them.
      for (const a of payload.answers) {
        const { instanceId, addSeconds, ...rest } = a;
        pending.current.set(instanceId, { ...rest, ...pending.current.get(instanceId) });
        pendingSeconds.current.set(instanceId, (pendingSeconds.current.get(instanceId) ?? 0) + (addSeconds ?? 0));
      }
      setSaveState("error");
    }
  }, [buildPayload, initial.id, router]);

  // Clock: counts only while the page is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible" || submittedRef.current) return;
      setElapsed((e) => e + 1);
      const qid = questions[indexRef.current]?.instanceId;
      if (qid) pendingSeconds.current.set(qid, (pendingSeconds.current.get(qid) ?? 0) + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [questions]);

  // Autosave on a timer, when the tab is hidden, and when the page closes.
  useEffect(() => {
    const id = setInterval(() => void save(), AUTOSAVE_MS);
    const beacon = () => {
      if (submittedRef.current) return;
      const payload = buildPayload();
      pending.current.clear();
      pendingSeconds.current.clear();
      navigator.sendBeacon(`/api/sessions/${initial.id}`, new Blob([JSON.stringify(payload)], { type: "application/json" }));
    };
    const onVisibility = () => document.visibilityState === "hidden" && beacon();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", beacon);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", beacon);
    };
  }, [save, buildPayload, initial.id]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    setSubmitting(true);
    const payload = buildPayload();
    pending.current.clear();
    pendingSeconds.current.clear();
    submittedRef.current = true;
    const res = await fetch(`/api/sessions/${initial.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      router.replace(`/session/${initial.id}/report`);
    } else {
      submittedRef.current = false;
      setSubmitting(false);
      setSaveState("error");
    }
  }, [buildPayload, initial.id, router]);

  // Time is up: submit whatever has been answered.
  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) void submit();
  }, [remaining, submit]);

  const update = (patch: Patch) => {
    if (!current) return;
    setQuestions((qs) => qs.map((q) => (q.instanceId === current.instanceId ? { ...q, response: { ...q.response, ...patch } } : q)));
    pending.current.set(current.instanceId, { ...pending.current.get(current.instanceId), ...patch });
    setSaveState("unsaved");
  };

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    void save();
  };

  const answered = questions.filter((q) => q.response.selectedKey).length;
  const missingConfidence = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.response.selectedKey && !q.response.confidence);
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => !q.response.selectedKey);
  const flagged = questions.filter((q) => q.response.flagged).length;
  const timerTone = remaining !== null && remaining < 300 ? "text-destructive" : remaining !== null && remaining < 900 ? "text-warning" : "";
  const otherMethod = current?.response.method === "other";

  const navCells = useMemo(
    () =>
      questions.map((q, i) => {
        const state = q.response.selectedKey ? (q.response.confidence ? "done" : "noconf") : "open";
        return { i, state, flagged: q.response.flagged };
      }),
    [questions]
  );

  if (!current) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone="info">{initial.modeLabel}</Badge>
          {initial.reference !== "closed" && <Badge>{REFERENCE_LABELS[initial.reference]}</Badge>}
          {initial.focusLabel && <Badge>{initial.focusLabel}</Badge>}
          <span className="text-sm font-semibold">
            Question {index + 1} of {questions.length}
          </span>
          <span className="text-xs text-muted-foreground">
            {answered} answered · {flagged} flagged
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed — will retry" : "All changes saved"}
          </span>
          {remaining !== null ? (
            <span className={cn("rounded-md border px-3 py-1 font-mono text-base tabular-nums", timerTone)} aria-label="Time remaining">
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="rounded-md border px-3 py-1 font-mono text-sm tabular-nums text-muted-foreground" aria-label="Time spent">
              {formatClock(elapsed)} · untimed
            </span>
          )}
          <Button variant="primary" onClick={() => setSubmitOpen(true)}>
            Submit
          </Button>
        </div>
      </div>
      {initial.notice && (
        <p role="status" className="mb-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm">
          {initial.notice}
        </p>
      )}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={answered} aria-valuemax={questions.length}>
        <div className="h-full bg-primary transition-all" style={{ width: `${(100 * answered) / questions.length}%` }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="panel p-5">
          <MathRenderer key={current.instanceId} content={current.stem} className="text-[15px]" />
          <Exhibits key={`exhibits-${current.instanceId}`} exhibits={current.exhibits} className="mt-4" />
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Answer choices</legend>
            {current.options.map((option) => {
              const selected = current.response.selectedKey === option.key;
              const rich = option.content !== undefined && option.content.type !== "numeric";
              return (
                <label
                  key={option.key}
                  className={cn(
                    "flex min-w-0 cursor-pointer gap-3 rounded-md border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
                    rich ? "items-start" : "items-center",
                    selected ? "border-primary bg-primary/10" : "hover:bg-accent"
                  )}
                >
                  <input
                    type="radio"
                    name={`answer-${current.instanceId}`}
                    className="sr-only"
                    checked={selected}
                    aria-label={`Option ${option.key}: ${option.display}`}
                    onChange={() => update({ selectedKey: option.key })}
                  />
                  <span
                    aria-hidden
                    className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", selected && "border-primary bg-primary text-primary-foreground")}
                  >
                    {option.key}
                  </span>
                  <OptionContentView content={option.content} display={option.display} statementCount={statementCountOf(current.exhibits)} className={cn("flex-1", rich && "pt-0.5")} />
                </label>
              );
            })}
            {current.response.selectedKey && (
              <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => update({ selectedKey: null })}>
                Clear answer
              </button>
            )}
          </fieldset>

          <div className="mt-5 space-y-3 border-t pt-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                Confidence {current.response.selectedKey && !current.response.confidence && <Badge tone="warn">required</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Confidence">
                {CONFIDENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    role="radio"
                    aria-checked={current.response.confidence === level}
                    onClick={() => update({ confidence: level as Confidence })}
                    className={cn("rounded-md border px-3 py-1.5 text-xs", current.response.confidence === level ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    {CONFIDENCE_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">
                  Method <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <select
                  value={current.response.method ?? ""}
                  onChange={(e) => update({ method: e.target.value || null })}
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                >
                  <option value="">Not recorded</option>
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              {otherMethod && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Describe your approach</span>
                  <input value={current.response.methodNote ?? ""} onChange={(e) => update({ methodNote: e.target.value })} className="h-9 w-full rounded-md border bg-card px-2 text-sm" />
                </label>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
              ← Previous
            </Button>
            <button
              onClick={() => update({ flagged: !current.response.flagged })}
              className={cn("rounded-md border px-3 py-1.5 text-sm", current.response.flagged ? "border-warning bg-warning/15" : "hover:bg-accent")}
              aria-pressed={current.response.flagged}
            >
              {current.response.flagged ? "⚑ Flagged for review" : "⚐ Flag for review"}
            </button>
            <Button variant="outline" onClick={() => go(index + 1)} disabled={index === questions.length - 1}>
              Next →
            </Button>
          </div>
        </section>

        <section className="panel flex flex-col p-3">
          <div className="mb-2 flex items-center justify-between">
            {supported ? (
              <div className="flex gap-1" role="tablist">
                {(["working", "formulas"] as const).map((pane) => (
                  <button
                    key={pane}
                    role="tab"
                    aria-selected={sidePane === pane}
                    onClick={() => setSidePane(pane)}
                    className={cn("rounded-md px-3 py-1 text-sm font-semibold", sidePane === pane ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}
                  >
                    {pane === "working" ? "Working" : "Formula library"}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="text-sm font-semibold">Working</h2>
            )}
            <span className="text-xs text-muted-foreground">{sidePane === "formulas" && supported ? "reference only — not scored" : "saved with your answer"}</span>
          </div>
          {supported && sidePane === "formulas" ? (
            <FormulaLibrary key={current.instanceId} compact highlight={current.formulas} />
          ) : (
            <Scratchpad key={current.instanceId} value={current.response.working} onChange={(working) => update({ working })} />
          )}
        </section>
      </div>

      <section className="panel mt-4 p-3">
        <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setNavOpen((o) => !o)} aria-expanded={navOpen}>
          Question navigator
          <span className="text-xs font-normal text-muted-foreground">{navOpen ? "hide" : "show"}</span>
        </button>
        {navOpen && (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {navCells.map((cell) => (
                <button
                  key={cell.i}
                  onClick={() => go(cell.i)}
                  className={cn(
                    "relative h-9 w-9 rounded-md border text-sm tabular-nums",
                    cell.i === index && "ring-2 ring-primary",
                    cell.state === "done" && "bg-primary/15",
                    cell.state === "noconf" && "border-warning bg-warning/10"
                  )}
                  aria-label={`Question ${cell.i + 1}${cell.state === "open" ? ", not answered" : ""}${cell.state === "noconf" ? ", confidence missing" : ""}${cell.flagged ? ", flagged" : ""}`}
                >
                  {cell.i + 1}
                  {cell.flagged && <span className="absolute -right-1 -top-1 text-[10px] text-warning">⚑</span>}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>shaded: answered</span>
              <span className="text-warning">amber: confidence missing</span>
              <span>⚑ flagged</span>
            </div>
          </>
        )}
      </section>

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit this session?"
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Keep working
            </Button>
            <Button onClick={() => void submit()} disabled={submitting || missingConfidence.length > 0}>
              {submitting ? "Submitting…" : "Submit and see the report"}
            </Button>
          </>
        }
      >
        <p>Answers, explanations and the diagnostic report are shown only after submission. You cannot change answers afterwards.</p>
        <ul className="mt-3 space-y-1">
          <li>
            {answered} of {questions.length} answered.
          </li>
          {unanswered.length > 0 && (
            <li>
              Not answered:{" "}
              {unanswered.map(({ i }) => (
                <button key={i} className="mr-1 underline" onClick={() => { setSubmitOpen(false); go(i); }}>
                  {i + 1}
                </button>
              ))}
            </li>
          )}
          {flagged > 0 && <li>{flagged} flagged for review.</li>}
        </ul>
        {missingConfidence.length > 0 && (
          <p className="mt-3 rounded-md bg-warning/15 p-2 text-sm">
            Record a confidence rating for every answered question first:{" "}
            {missingConfidence.map(({ i }) => (
              <button key={i} className="mr-1 font-semibold underline" onClick={() => { setSubmitOpen(false); go(i); }}>
                {i + 1}
              </button>
            ))}
          </p>
        )}
      </Modal>
    </div>
  );
}

