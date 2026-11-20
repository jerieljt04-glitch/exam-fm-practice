"use client";

import { useMemo, useState } from "react";

import type { SessionView } from "@/lib/server/repository";
import { cn } from "@/lib/utils";

/** Numbered question grid: answered, missing confidence, flagged and current at a glance. */
export function QuestionNavigator({
  questions,
  index,
  confidenceRequired,
  onGo,
}: {
  questions: SessionView["questions"];
  index: number;
  confidenceRequired: boolean;
  onGo: (index: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const cells = useMemo(
    () =>
      questions.map((q, i) => ({
        i,
        state: q.response.selectedKey ? (q.response.confidence || !confidenceRequired ? "done" : "noconf") : "open",
        flagged: q.response.flagged,
      })),
    [questions, confidenceRequired]
  );
  return (
    <section className="panel mt-4 p-4">
      <button className="flex w-full items-center justify-between text-sm font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Question navigator
        <span className="text-xs font-normal text-muted-foreground">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cells.map((cell) => (
              <button
                key={cell.i}
                onClick={() => onGo(cell.i)}
                className={cn(
                  "relative h-9 w-9 rounded-full border text-sm tabular-nums hover:bg-accent",
                  cell.i === index && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  cell.state === "done" && "border-primary-container bg-primary-container text-primary-on-container",
                  cell.state === "noconf" && "border-warning bg-warning-container"
                )}
                aria-label={`Question ${cell.i + 1}${cell.state === "open" ? ", not answered" : ""}${cell.state === "noconf" ? ", confidence missing" : ""}${cell.flagged ? ", flagged" : ""}`}
                aria-current={cell.i === index ? "step" : undefined}
              >
                {cell.i + 1}
                {cell.flagged && <span className="absolute -right-1 -top-1 text-[10px] text-warning">⚑</span>}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>shaded: answered</span>
            {confidenceRequired && <span className="text-warning">amber: confidence missing</span>}
            <span>⚑ flagged</span>
          </div>
        </>
      )}
    </section>
  );
}
