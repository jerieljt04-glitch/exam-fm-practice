"use client";

import React, { useRef, useState } from "react";

import { MathRenderer } from "@/components/MathRenderer";

const SNIPPETS: Array<{ label: string; insert: string; title: string }> = [
  { label: "$…$", insert: "$ $", title: "Inline maths" },
  { label: "a⌝n", insert: "a_{\\overline{n|}}", title: "Annuity-immediate" },
  { label: "ä⌝n", insert: "\\ddot{a}_{\\overline{n|}}", title: "Annuity-due" },
  { label: "s⌝n", insert: "s_{\\overline{n|}}", title: "Accumulated annuity" },
  { label: "vⁿ", insert: "v^{n}", title: "Discount factor" },
  { label: "(1+i)ⁿ", insert: "(1+i)^{n}", title: "Accumulation factor" },
  { label: "a/b", insert: "\\frac{a}{b}", title: "Fraction" },
  { label: "Σ", insert: "\\sum_{t=1}^{n}", title: "Sum" },
  { label: "i⁽ᵐ⁾", insert: "i^{(m)}", title: "Nominal interest" },
  { label: "d⁽ᵐ⁾", insert: "d^{(m)}", title: "Nominal discount" },
  { label: "δ", insert: "\\delta", title: "Force of interest" },
  { label: "×", insert: "\\times", title: "Times" },
  { label: "≈", insert: "\\approx", title: "Approximately" },
];

/**
 * Mathematical working. Plain text and numbers work as typed; anything between
 * $ signs is typeset, so equations stay readable when they are reviewed later.
 */
export function Scratchpad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const insert = (snippet: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const wrapped = snippet === "$ $" ? `$${value.slice(start, end) || " "}$` : snippet;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + (snippet === "$ $" ? 1 : wrapped.length);
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b pb-2">
        {SNIPPETS.map((s) => (
          <button key={s.label} type="button" title={s.title} onClick={() => insert(s.insert)} className="rounded border px-1.5 py-0.5 text-xs hover:bg-accent">
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} className="ml-auto rounded border px-2 py-0.5 text-xs hover:bg-accent" aria-pressed={preview}>
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[16rem] flex-1 overflow-auto whitespace-pre-wrap p-2 text-sm">
          {value.trim() ? <MathRenderer content={value} /> : <span className="text-muted-foreground">Nothing written yet.</span>}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder={"Write your equations and calculations here.\nExample: balance = 10000(1.1) − 2000 = 9000\nUse $…$ for notation such as $a_{\\overline{10|}}$."}
          className="min-h-[16rem] flex-1 resize-none bg-transparent p-2 font-mono text-sm outline-none"
          aria-label="Mathematical working"
        />
      )}
    </div>
  );
}
