"use client";

import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  choose: (key: "A" | "B" | "C" | "D" | "E") => void;
  next: () => void;
  previous: () => void;
  flag: () => void;
  confidence: (level: number) => void;
  help: () => void;
}

/**
 * Exam keyboard shortcuts: A–E choose an answer, ← / → move between
 * questions, F flags, 1–5 set confidence, ? shows the list. Ignored while
 * typing (inputs, the working pad, the calculator) or with a modifier held.
 */
export function useExamShortcuts(handlers: ShortcutHandlers, enabled = true) {
  // The latest handlers, without re-subscribing on every render.
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select, [contenteditable='true'], [data-no-shortcuts]") || target.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      const key = e.key;
      const h = ref.current;
      if (/^[a-eA-E]$/.test(key)) h.choose(key.toUpperCase() as "A" | "B" | "C" | "D" | "E");
      else if (key === "ArrowRight") h.next();
      else if (key === "ArrowLeft") h.previous();
      else if (key === "f" || key === "F") h.flag();
      else if (/^[1-5]$/.test(key)) h.confidence(Number(key));
      else if (key === "?") h.help();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
