"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator as CalcIcon, ChevronLeft, ChevronRight, Flag, Keyboard, NotebookPen, Sigma, Strikethrough, Timer } from "lucide-react";

import { Exhibits } from "@/components/answers/Exhibits";
import { OptionContentView, statementCountOf } from "@/components/answers/OptionContentView";
import { Calculator } from "@/components/calculator/Calculator";
import { FormulaLibrary } from "@/components/formulas/FormulaLibrary";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button, Modal } from "@/components/ui";
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, METHODS, type Confidence } from "@/lib/engine/skills";
import { REFERENCE_LABELS } from "@/lib/reference";
import type { ResponseState, SessionView } from "@/lib/server/repository";
import { formatClock, remainingSeconds } from "@/lib/timer";
import { cn } from "@/lib/utils";

import { QuestionNavigator } from "./QuestionNavigator";
import { ReviewScreen, type ReviewFilter } from "./ReviewScreen";
import { Scratchpad } from "./Scratchpad";
import { useExamShortcuts } from "./useExamShortcuts";

type Patch = Partial<Omit<ResponseState, "timeSpentSeconds">>;
type SidePane = "working" | "calculator" | "formulas";
type Question = SessionView["questions"][number];

const AUTOSAVE_MS = 8000;
/** Exam pace: 150 minutes over 30 questions. Past 7 minutes a question is a time sink. */
const PACE_SECONDS = 300;
const SINK_SECONDS = 420;

const SHORTCUTS: Array<[string, string]> = [
  ["A – E", "Choose an answer (press again to clear)"],
  ["← / →", "Previous / next question"],
  ["F", "Flag or unflag for review"],
  ["1 – 5", "Confidence, very low to very high"],
  ["Right-click", "Strike out an option (again to restore)"],
  ["?", "Show these shortcuts"],
];

const FILTER_LABEL: Record<ReviewFilter, string> = {
  all: "all questions",
  flagged: "flagged questions",
  unanswered: "unanswered questions",
  incomplete: "questions missing a confidence rating",
};

function matches(filter: ReviewFilter | null, q: Question): boolean {
  if (filter === null || filter === "all") return true;
  if (filter === "flagged") return q.response.flagged;
  if (filter === "unanswered") return !q.response.selectedKey;
  return Boolean(q.response.selectedKey && !q.response.confidence);
}

export function SessionRunner({ initial }: { initial: SessionView }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial.questions);
  const [index, setIndex] = useState(Math.min(initial.currentIndex, initial.questions.length - 1));
  const [elapsed, setElapsed] = useState(initial.elapsedSeconds);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [reviewing, setReviewing] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidePane, setSidePane] = useState<SidePane>("working");
  const supported = initial.reference === "supported";
  // Confidence feeds the diagnostic's calibration analysis; in a timed exam, as on the real exam, it is optional.
  const confidenceRequired = !initial.timed;

  // Pending edits and per-question time not yet sent to the server.
  const pending = useRef(new Map<string, Patch>());
  const pendingSeconds = useRef(new Map<string, number>());
  const elapsedRef = useRef(elapsed);
  const indexRef = useRef(index);
  const submittedRef = useRef(false);
  // A timed exam's clock is wall-clock time, like the real exam: it keeps running in another tab.
  const clockStart = useRef(Date.now() - initial.elapsedSeconds * 1000);
  elapsedRef.current = elapsed;
  indexRef.current = index;

  const current = questions[index];
  const remaining = remainingSeconds(initial.durationSeconds, elapsed);

  // Seconds spent on each question so far (stored time plus this visit), for the pacing pill.
  const questionSeconds = useRef(new Map<string, number>());
  const secondsOn = (q: Question) => questionSeconds.current.get(q.instanceId) ?? q.response.timeSpentSeconds ?? 0;

  // Options struck out by the candidate (elimination aid only; never saved as an answer).
  const struckKey = `struck:${initial.id}`;
  const [struck, setStruck] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(struckKey);
      if (saved) setStruck(JSON.parse(saved) as Record<string, string[]>);
    } catch {
      // Storage unavailable: elimination still works for this page view.
    }
  }, [struckKey]);
  const toggleStrike = useCallback(
    (instanceId: string, key: string) => {
      setStruck((prev) => {
        const list = prev[instanceId] ?? [];
        const next = { ...prev, [instanceId]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
        try {
          sessionStorage.setItem(struckKey, JSON.stringify(next));
        } catch {
          // Ignore storage failures.
        }
        return next;
      });
    },
    [struckKey]
  );

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

  // Clock: timed sessions follow the wall clock; untimed ones count only while the page is visible.
  // Time on the current question accrues only while it is on screen.
  useEffect(() => {
    const id = setInterval(() => {
      if (submittedRef.current) return;
      const visible = document.visibilityState === "visible";
      if (initial.timed) setElapsed(Math.floor((Date.now() - clockStart.current) / 1000));
      else if (visible) setElapsed((e) => e + 1);
      const q = questions[indexRef.current];
      const qid = q?.instanceId;
      if (visible && qid) {
        pendingSeconds.current.set(qid, (pendingSeconds.current.get(qid) ?? 0) + 1);
        questionSeconds.current.set(qid, (questionSeconds.current.get(qid) ?? q.response.timeSpentSeconds ?? 0) + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [questions, initial.timed]);

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

  // Time is up (or the session expired while it was closed): submit whatever has been answered.
  useEffect(() => {
    if ((remaining === 0 || initial.expired) && !submittedRef.current) void submit();
  }, [remaining, submit, initial.expired]);

  const update = (patch: Patch) => {
    if (!current) return;
    setQuestions((qs) => qs.map((q) => (q.instanceId === current.instanceId ? { ...q, response: { ...q.response, ...patch } } : q)));
    pending.current.set(current.instanceId, { ...pending.current.get(current.instanceId), ...patch });
    setSaveState("unsaved");
  };

  // Review mode restricts navigation to the questions in the chosen group.
  const route = useMemo(() => questions.map((q, i) => ({ q, i })).filter(({ q }) => matches(filter, q)).map(({ i }) => i), [questions, filter]);
  const posInRoute = route.indexOf(index);
  const atEnd = filter === null ? index === questions.length - 1 : posInRoute === route.length - 1;
  const atStart = filter === null ? index === 0 : posInRoute <= 0;

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    setReviewing(false);
    void save();
  };
  const openReview = () => {
    setReviewing(true);
    void save();
  };
  const step = (dir: 1 | -1) => {
    if (dir === 1 && atEnd) return openReview();
    if (dir === -1 && atStart) return;
    if (filter === null) return go(index + dir);
    const target = route[(posInRoute < 0 ? 0 : posInRoute) + dir];
    if (target !== undefined) go(target);
  };

  useExamShortcuts(
    {
      choose: (key) => {
        if (reviewing || !current.options.some((o) => o.key === key)) return;
        update({ selectedKey: current.response.selectedKey === key ? null : key });
      },
      next: () => !reviewing && step(1),
      previous: () => !reviewing && step(-1),
      flag: () => !reviewing && update({ flagged: !current.response.flagged }),
      confidence: (level) => {
        if (!reviewing && current.response.selectedKey) update({ confidence: CONFIDENCE_LEVELS[level - 1] as Confidence });
      },
      help: () => setHelpOpen(true),
    },
    !submitting
  );

  if (!current) return null;

  const answered = questions.filter((q) => q.response.selectedKey).length;
  const flagged = questions.filter((q) => q.response.flagged).length;
  const timerTone = remaining !== null && remaining < 300 ? "text-destructive" : remaining !== null && remaining < 900 ? "text-warning" : "";
  const otherMethod = current.response.method === "other";
  const reviewItems = questions.map((q, i) => ({ index: i, answered: Boolean(q.response.selectedKey), flagged: q.response.flagged, confidence: q.response.confidence }));
  const panes: Array<{ id: SidePane; label: string; icon: typeof NotebookPen }> = [
    { id: "working", label: "Working", icon: NotebookPen },
    { id: "calculator", label: "Calculator", icon: CalcIcon },
    ...(supported ? [{ id: "formulas" as const, label: "Formulas", icon: Sigma }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="info">{initial.modeLabel}</Badge>
          {initial.reference !== "closed" && <Badge>{REFERENCE_LABELS[initial.reference]}</Badge>}
          {initial.focusLabel && <Badge>{initial.focusLabel}</Badge>}
          <span className="text-sm font-semibold">{reviewing ? "Review screen" : `Question ${index + 1} of ${questions.length}`}</span>
          <span className="text-xs text-muted-foreground">
            {answered} answered · {flagged} flagged
          </span>
          {filter !== null && !reviewing && (
            <Badge tone="warn">
              Reviewing {FILTER_LABEL[filter]} ({posInRoute + 1} of {route.length})
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Save failed — will retry" : "All changes saved"}
          </span>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-pill text-muted-foreground hover:bg-primary/[0.08]" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <Keyboard size={18} strokeWidth={1.75} aria-hidden />
          </button>
          {remaining !== null ? (
            <span className={cn("rounded-pill border px-4 py-1.5 font-mono text-base tabular-nums", timerTone)} aria-label="Time remaining" role="timer">
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="rounded-pill border px-4 py-1.5 font-mono text-sm tabular-nums text-muted-foreground" aria-label="Time spent">
              {formatClock(elapsed)} · untimed
            </span>
          )}
          {!reviewing && <Button onClick={openReview}>Review &amp; submit</Button>}
        </div>
      </div>
      {initial.notice && (
        <p role="status" className="mb-3 rounded-field bg-warning-container px-4 py-2 text-sm text-warning">
          {initial.notice}
        </p>
      )}
      <div className="mb-4 h-[3px] w-full overflow-hidden rounded-pill bg-secondary" role="progressbar" aria-label="Questions answered" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={questions.length}>
        <div className="google-bar h-full rounded-pill transition-[width] duration-slow ease-emphasized" style={{ width: `${(100 * answered) / questions.length}%`, backgroundSize: `${questions.length ? (100 * questions.length) / Math.max(1, answered) : 100}% 100%` }} />
      </div>

      {reviewing ? (
        <ReviewScreen
          items={reviewItems}
          confidenceRequired={confidenceRequired}
          remainingLabel={remaining !== null ? formatClock(remaining) : null}
          submitting={submitting}
          onReview={(f) => {
            setFilter(f);
            const first = questions.findIndex((q) => matches(f, q));
            go(first >= 0 ? first : 0);
          }}
          onJump={(i) => {
            setFilter(null);
            go(i);
          }}
          onReturn={() => setReviewing(false)}
          onEnd={() => void submit()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="panel p-6 sm:p-7" aria-label={`Question ${index + 1}`}>
            <div className="mb-3 flex justify-end">
              <PacePill seconds={secondsOn(current)} />
            </div>
            <MathRenderer key={current.instanceId} content={current.stem} className="text-[15px]" />
            <Exhibits key={`exhibits-${current.instanceId}`} exhibits={current.exhibits} className="mt-4" />
            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">Answer choices</legend>
              {current.options.map((option) => {
                const selected = current.response.selectedKey === option.key;
                const rich = option.content !== undefined && option.content.type !== "numeric";
                const isStruck = (struck[current.instanceId] ?? []).includes(option.key);
                return (
                  <label
                    key={option.key}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleStrike(current.instanceId, option.key);
                    }}
                    className={cn(
                      "group flex min-w-0 cursor-pointer gap-3 rounded-lg border px-4 py-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
                      rich ? "items-start" : "items-center",
                      selected ? "border-primary bg-primary-container" : "bg-elevated hover:border-primary/40 hover:shadow-resting",
                      isStruck && !selected && "bg-transparent"
                    )}
                  >
                    <input type="radio" name={`answer-${current.instanceId}`} className="sr-only" checked={selected} aria-label={`Option ${option.key}: ${option.display}`} onChange={() => update({ selectedKey: option.key })} />
                    <span aria-hidden className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", selected && "border-primary bg-primary text-primary-foreground")}>
                      {option.key}
                    </span>
                    <OptionContentView
                      content={option.content}
                      display={option.display}
                      statementCount={statementCountOf(current.exhibits)}
                      className={cn("flex-1", rich && "pt-0.5", isStruck && "text-muted-foreground line-through decoration-muted-foreground decoration-2 opacity-60")}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleStrike(current.instanceId, option.key);
                      }}
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-pill text-muted-foreground hover:bg-primary/[0.08] focus-visible:opacity-100",
                        isStruck ? "opacity-100 text-foreground" : "opacity-40 group-hover:opacity-100"
                      )}
                      aria-pressed={isStruck}
                      aria-label={isStruck ? `Restore option ${option.key}` : `Strike out option ${option.key}`}
                      title={isStruck ? "Restore option" : "Strike out option (or right-click)"}
                    >
                      <Strikethrough size={16} strokeWidth={1.75} aria-hidden />
                    </button>
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
                  Confidence
                  {confidenceRequired ? (
                    current.response.selectedKey && !current.response.confidence && <Badge tone="warn">required</Badge>
                  ) : (
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Confidence">
                  {CONFIDENCE_LEVELS.map((level, k) => (
                    <button
                      key={level}
                      role="radio"
                      aria-checked={current.response.confidence === level}
                      onClick={() => update({ confidence: current.response.confidence === level ? null : (level as Confidence) })}
                      title={`Shortcut: ${k + 1}`}
                      className={cn(
                        "rounded-pill border px-4 py-1.5 text-xs font-medium",
                        current.response.confidence === level ? "border-primary-container bg-primary-container text-primary-on-container" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {current.response.confidence === level ? "✓ " : ""}
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
                  <select value={current.response.method ?? ""} onChange={(e) => update({ method: e.target.value || null })} className="h-10 w-full rounded-field border bg-elevated px-3 text-sm">
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
                    <input value={current.response.methodNote ?? ""} onChange={(e) => update({ methodNote: e.target.value })} className="h-10 w-full rounded-field border bg-elevated px-3 text-sm" />
                  </label>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <Button variant="outlined" onClick={() => step(-1)} disabled={atStart}>
                <ChevronLeft size={16} aria-hidden /> Previous
              </Button>
              <button
                onClick={() => update({ flagged: !current.response.flagged })}
                className={cn("inline-flex items-center gap-2 rounded-pill border px-4 py-1.5 text-sm font-medium", current.response.flagged ? "border-warning/40 bg-warning-container text-warning" : "text-muted-foreground hover:bg-accent")}
                aria-pressed={current.response.flagged}
                title="Shortcut: F"
              >
                <Flag size={14} strokeWidth={1.75} aria-hidden /> {current.response.flagged ? "Flagged for review" : "Flag for review"}
              </button>
              <Button variant="outlined" onClick={() => step(1)}>
                {atEnd ? "Review screen" : "Next"} <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          </section>

          <section className="panel flex flex-col p-3" aria-label="Tools">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex gap-1" role="tablist" aria-label="Tools">
                {panes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={sidePane === id}
                    onClick={() => setSidePane(id)}
                    className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-medium", sidePane === id ? "bg-primary-container text-primary-on-container" : "text-muted-foreground hover:bg-accent")}
                  >
                    <Icon size={15} strokeWidth={1.75} aria-hidden /> {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{sidePane === "working" ? "saved with your answer" : sidePane === "calculator" ? "BA II Plus style" : "reference only — not scored"}</span>
            </div>
            {/* The calculator stays mounted across questions, keeping its memory like the handheld. */}
            <div className={cn(sidePane !== "calculator" && "hidden")}>
              <Calculator storageKey={`exam-fm-calc:${initial.id}`} />
            </div>
            {sidePane === "formulas" && supported && <FormulaLibrary key={current.instanceId} compact highlight={current.formulas} />}
            {sidePane === "working" && <Scratchpad key={current.instanceId} value={current.response.working} onChange={(working) => update({ working })} />}
          </section>
        </div>
      )}

      {!reviewing && (
        <QuestionNavigator
          questions={questions}
          index={index}
          confidenceRequired={confidenceRequired}
          onGo={(i) => {
            setFilter(null);
            go(i);
          }}
        />
      )}

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" footer={<Button onClick={() => setHelpOpen(false)}>Close</Button>}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {SHORTCUTS.map(([keys, what]) => (
            <React.Fragment key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd className="text-foreground">{what}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="mt-3">Shortcuts pause while you type in the working pad, the calculator or a field.</p>
      </Modal>
    </div>
  );
}

/** Time on the current question against the five-minute exam pace. */
function PacePill({ seconds }: { seconds: number }) {
  const tone = seconds > SINK_SECONDS ? "border-destructive/40 bg-destructive-container text-destructive" : seconds > PACE_SECONDS ? "border-warning/40 bg-warning-container text-warning" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs tabular-nums", tone)} aria-label={`Time on this question ${formatClock(seconds)}, target 5:00`} title="Time on this question (target 5:00)">
      <Timer size={14} strokeWidth={1.75} aria-hidden />
      {formatClock(seconds)} / 5:00
    </span>
  );
}
