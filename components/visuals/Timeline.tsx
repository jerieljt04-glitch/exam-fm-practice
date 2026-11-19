"use client";

import React, { useMemo, useState } from "react";

import { num } from "@/lib/engine/format";
import type { TimelineFlow, TimeUnit } from "@/lib/engine/types";
import { C, Frame, Legend, UNIT_LABEL, compact, linear } from "./chart";

/**
 * Cash flows on a timeline with a movable valuation date. Every flow is shown
 * moving to the chosen date with its own accumulation or discount factor, so
 * the equation of value can be watched rather than memorised.
 */
export function Timeline({
  title,
  unit,
  rate,
  flows,
  valuationTimes,
  caption,
}: {
  title: string;
  unit: TimeUnit;
  rate: number;
  flows: TimelineFlow[];
  valuationTimes: number[];
  caption?: string;
}) {
  const times = flows.map((f) => f.t);
  const tMin = Math.min(0, ...times);
  const tMax = Math.max(...times, ...valuationTimes, 1);
  const [T, setT] = useState(valuationTimes[0] ?? 0);
  const W = 720;
  const H = 210;
  const x = linear([tMin, tMax], [40, W - 30]);
  const axisY = 120;
  const maxAmount = Math.max(...flows.map((f) => Math.abs(f.amount)), 1);
  const barScale = (a: number) => 18 + (Math.abs(a) / maxAmount) * 62;
  const tickEvery = tMax - tMin > 40 ? 12 : tMax - tMin > 20 ? 5 : 1;

  const moved = useMemo(
    () =>
      flows.map((f) => {
        const k = T - f.t;
        const factor = Math.pow(1 + rate, k);
        return { ...f, k, factor, value: f.amount * factor };
      }),
    [flows, T, rate]
  );
  const inflow = moved.filter((f) => f.dir === "in").reduce((a, f) => a + f.value, 0);
  const outflow = moved.filter((f) => f.dir === "out").reduce((a, f) => a + f.value, 0);
  const stack = new Map<number, number>();

  return (
    <Frame
      title={title}
      caption={caption}
      controls={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Valuation date
          <input
            type="range"
            min={tMin}
            max={tMax}
            step={1}
            value={T}
            onChange={(e) => setT(Number(e.target.value))}
            className="w-40 accent-[hsl(var(--primary))]"
            aria-label="Valuation date"
          />
          <span className="w-16 tabular-nums text-foreground">t = {T}</span>
        </label>
      }
    >
      <div className="flex flex-wrap gap-1.5 pb-2">
        {valuationTimes.map((v) => (
          <button key={v} onClick={() => setT(v)} className={`rounded-full border px-2 py-0.5 text-xs ${v === T ? "border-primary-container bg-primary-container text-primary-on-container" : "hover:bg-accent"}`}>
            suggested: t = {v}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cash-flow timeline valued at time ${T}`}>
        <line x1={x(tMin)} y1={axisY} x2={x(tMax)} y2={axisY} stroke={C.text} strokeWidth="1.5" />
        {Array.from({ length: Math.floor((tMax - tMin) / tickEvery) + 1 }, (_, idx) => tMin + idx * tickEvery).map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={axisY - 4} x2={x(t)} y2={axisY + 4} stroke={C.text} />
            <text x={x(t)} y={axisY + 18} textAnchor="middle" fontSize="11" fill={C.text}>
              {t}
            </text>
          </g>
        ))}
        <line x1={x(T)} y1={14} x2={x(T)} y2={H - 26} stroke={C.balance} strokeWidth="2" strokeDasharray="5 4" />
        <text x={x(T)} y={11} textAnchor="middle" fontSize="11" fill={C.balance} fontWeight="600">
          valuation date
        </text>
        {flows.map((f, idx) => {
          const up = f.dir === "in";
          const offset = stack.get(f.t) ?? 0;
          stack.set(f.t, offset + 1);
          const len = barScale(f.amount);
          const px = x(f.t) + offset * 7;
          const y2 = up ? axisY - len : axisY + len;
          const color = up ? C.in : C.out;
          return (
            <g key={idx}>
              <line x1={px} y1={axisY} x2={px} y2={y2} stroke={color} strokeWidth="3" />
              <polygon points={up ? `${px - 5},${y2 + 7} ${px + 5},${y2 + 7} ${px},${y2}` : `${px - 5},${y2 - 7} ${px + 5},${y2 - 7} ${px},${y2}`} fill={color} />
              {flows.length <= 16 && (
                <text x={px} y={up ? y2 - 6 : y2 + 14} textAnchor="middle" fontSize="10" fill={C.fg}>
                  {f.label ? `${f.label} ` : ""}
                  {compact(f.amount)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend
        items={[
          { label: "received (up)", color: C.in },
          { label: "paid (down)", color: C.out },
          { label: "valuation date", color: C.balance, dashed: true },
        ]}
      />
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">Received, valued at t = {T}</div>
          <div className="font-semibold tabular-nums">{num(inflow, 2)}</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">Paid, valued at t = {T}</div>
          <div className="font-semibold tabular-nums">{num(outflow, 2)}</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">Ratio (same at every date)</div>
          <div className="font-semibold tabular-nums">{outflow ? (inflow / outflow).toFixed(6) : "—"}</div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">How each cash flow moves to t = {T}</summary>
        <div className="mt-2 max-h-64 overflow-auto scrollbar-slim">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1">time</th>
                <th>amount</th>
                <th>periods moved</th>
                <th>factor</th>
                <th className="text-right">value at t = {T}</th>
              </tr>
            </thead>
            <tbody>
              {moved.map((f, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-1">{f.t}</td>
                  <td>
                    {f.dir === "in" ? "+" : "−"}
                    {num(f.amount, 2)}
                  </td>
                  <td>
                    {f.k > 0 ? `${f.k} forward` : f.k < 0 ? `${-f.k} back` : "none"} ({UNIT_LABEL[unit]}s)
                  </td>
                  <td>(1 + {(rate * 100).toFixed(4)}%)^{f.k}</td>
                  <td className="text-right">{num(f.value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Frame>
  );
}
