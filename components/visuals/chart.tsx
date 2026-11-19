"use client";

import React from "react";

import { num } from "@/lib/engine/format";

export const C = {
  in: "hsl(var(--viz-in))",
  out: "hsl(var(--viz-out))",
  interest: "hsl(var(--viz-interest))",
  principal: "hsl(var(--viz-principal))",
  balance: "hsl(var(--viz-balance))",
  trap: "hsl(var(--viz-trap))",
  grid: "hsl(var(--viz-grid))",
  text: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
};

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (x: number) => r0 + ((x - d0) / span) * (r1 - r0);
}

/** About `count` round tick values covering [min, max]. */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1e-9) return "0";
  if (abs >= 1e6) return `${num(value / 1e6, 2)}M`;
  if (abs >= 1e4) return `${num(value / 1e3, 1)}k`;
  if (abs >= 100) return num(value, 0);
  if (abs >= 1) return num(value, 2);
  return num(value, 4);
}

export const UNIT_LABEL: Record<string, string> = { year: "year", "half-year": "half-year", quarter: "quarter", month: "month" };

export function Frame({ title, caption, children, controls }: { title: string; caption?: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <figure className="rounded-lg border bg-elevated p-4">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {controls}
      </figcaption>
      {children}
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
    </figure>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? "4 3" : undefined} />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StepControls({
  index,
  count,
  onChange,
  playing,
  onTogglePlay,
  label,
}: {
  index: number;
  count: number;
  onChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  label: string;
}) {
  const button = "rounded-full border px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button className={button} onClick={() => onChange(0)} disabled={index === 0} aria-label="First">
        ⏮
      </button>
      <button className={button} onClick={() => onChange(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous">
        ◀
      </button>
      <button className={`${button} min-w-[3.5rem]`} onClick={onTogglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button className={button} onClick={() => onChange(Math.min(count - 1, index + 1))} disabled={index >= count - 1} aria-label="Next">
        ▶
      </button>
      <span className="ml-1 text-xs tabular-nums text-muted-foreground">{label}</span>
    </div>
  );
}

/** Advances an index on a timer while `playing`. */
export function usePlayer(count: number, start = 0, intervalMs = 900) {
  const [index, setIndex] = React.useState(Math.min(start, Math.max(0, count - 1)));
  const [playing, setPlaying] = React.useState(false);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIndex((current) => {
        if (current >= count - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [playing, count, intervalMs]);
  React.useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, count - 1)));
  }, [count]);
  return {
    index,
    setIndex: (i: number) => {
      setPlaying(false);
      setIndex(i);
    },
    playing,
    toggle: () => {
      setIndex((current) => (!playing && current >= count - 1 ? 0 : current));
      setPlaying((p) => !p);
    },
  };
}
