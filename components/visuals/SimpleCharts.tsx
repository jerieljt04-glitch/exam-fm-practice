"use client";

import React, { useState } from "react";

import { num } from "@/lib/engine/format";
import { MathRenderer } from "@/components/MathRenderer";
import type { TimeUnit } from "@/lib/engine/types";
import { C, Frame, Legend, StepControls, UNIT_LABEL, compact, linear, ticks, usePlayer } from "./chart";

const SERIES_COLORS = [C.principal, C.interest, C.in, C.balance];

export function Series({ title, unit, series, caption }: { title: string; unit: TimeUnit; series: { label: string; values: { t: number; amount: number }[] }[]; caption?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const all = series.flatMap((s) => s.values);
  const tMin = Math.min(...all.map((p) => p.t));
  const tMax = Math.max(...all.map((p) => p.t));
  const yMax = Math.max(...all.map((p) => p.amount), 0) * 1.08 || 1;
  const yMin = Math.min(0, ...all.map((p) => p.amount));
  const slots = tMax - tMin + 1;
  const x = linear([tMin - 0.5, tMax + 0.5], [52, W - 12]);
  const y = linear([yMin, yMax], [H - 24, 10]);
  const groupW = Math.max(3, (W - 70) / slots - 3);
  const barW = groupW / series.length;
  const hovered = hover === null ? null : series.map((s) => s.values.find((p) => p.t === hover));
  return (
    <Frame title={title} caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {ticks(yMin, yMax, 4).map((t) => (
          <g key={t}>
            <line x1={52} x2={W - 12} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={48} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        {series.map((s, si) =>
          s.values.map((p) => (
            <rect
              key={`${si}-${p.t}`}
              x={x(p.t) - groupW / 2 + si * barW}
              y={y(Math.max(0, p.amount))}
              width={Math.max(1, barW - 1)}
              height={Math.abs(y(0) - y(p.amount))}
              fill={SERIES_COLORS[si % SERIES_COLORS.length]}
              opacity={hover === null || hover === p.t ? 1 : 0.45}
              onMouseEnter={() => setHover(p.t)}
            />
          ))
        )}
        <text x={x(tMin)} y={H - 6} fontSize="10" fill={C.text} textAnchor="middle">
          {tMin}
        </text>
        <text x={x(tMax)} y={H - 6} fontSize="10" fill={C.text} textAnchor="middle">
          {tMax}
        </text>
      </svg>
      <Legend items={series.map((s, si) => ({ label: s.label, color: SERIES_COLORS[si % SERIES_COLORS.length] }))} />
      <p className="mt-1 h-5 text-xs tabular-nums text-muted-foreground">
        {hovered
          ? `${UNIT_LABEL[unit]} ${hover}: ${series.map((s, si) => `${s.label} ${hovered[si] ? num(hovered[si]!.amount, 2) : "—"}`).join(" · ")}`
          : "Hover a bar to read its values."}
      </p>
    </Frame>
  );
}

export function Allocation({
  title,
  parts,
  total,
  caption,
}: {
  title: string;
  parts: { label: string; principal: number; interest: number; detail: string }[];
  total: { principal: number; interest: number };
  caption?: string;
}) {
  const max = Math.max(total.principal + total.interest, ...parts.map((p) => p.principal + p.interest));
  const rows = [...parts, { label: "Combined", principal: total.principal, interest: total.interest, detail: "the only figure the question gives directly" }];
  return (
    <Frame title={title} caption={caption}>
      <div className="space-y-3">
        {rows.map((p, idx) => (
          <div key={p.label}>
            <div className="flex justify-between text-xs">
              <span className={idx === rows.length - 1 ? "font-semibold" : ""}>{p.label}</span>
              <span className="text-muted-foreground">{p.detail}</span>
            </div>
            <div className="mt-1 flex h-6 overflow-hidden rounded bg-secondary text-[10px] font-medium text-white">
              <div className="flex items-center justify-center" style={{ width: `${(100 * p.principal) / max}%`, background: C.principal }}>
                {num(p.principal, 0)}
              </div>
              {p.interest > 0 && (
                <div className="flex items-center justify-center" style={{ width: `${(100 * p.interest) / max}%`, background: C.interest }}>
                  {num(p.interest, 0)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Legend items={[{ label: "amount invested", color: C.principal }, { label: "interest / growth", color: C.interest }]} />
    </Frame>
  );
}

export function Curve({ title, points, caption }: { title: string; points: { t: number; spot: number; forward?: number }[]; caption?: string }) {
  const W = 720;
  const H = 200;
  const rates = points.flatMap((p) => [p.spot, p.forward ?? p.spot]);
  const lo = Math.min(...rates) * 0.9;
  const hi = Math.max(...rates) * 1.08;
  const x = linear([points[0].t - 0.3, points[points.length - 1].t + 0.3], [52, W - 14]);
  const y = linear([lo, hi], [H - 24, 12]);
  return (
    <Frame title={title} caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {ticks(lo, hi, 4).map((t) => (
          <g key={t}>
            <line x1={52} x2={W - 14} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={48} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {(t * 100).toFixed(2)}%
            </text>
          </g>
        ))}
        <polyline fill="none" stroke={C.principal} strokeWidth="2.5" points={points.map((p) => `${x(p.t)},${y(p.spot)}`).join(" ")} />
        {points.map((p) => (
          <g key={p.t}>
            <circle cx={x(p.t)} cy={y(p.spot)} r="4" fill={C.principal} />
            <text x={x(p.t)} y={y(p.spot) - 8} textAnchor="middle" fontSize="10" fill={C.fg}>
              {(p.spot * 100).toFixed(3)}%
            </text>
            {p.forward !== undefined && p.t > points[0].t && (
              <>
                <line x1={x(p.t - 1)} x2={x(p.t)} y1={y(p.forward)} y2={y(p.forward)} stroke={C.interest} strokeWidth="3" />
                <text x={x(p.t - 0.5)} y={y(p.forward) + 14} textAnchor="middle" fontSize="10" fill={C.interest}>
                  f = {(p.forward * 100).toFixed(3)}%
                </text>
              </>
            )}
            <text x={x(p.t)} y={H - 6} textAnchor="middle" fontSize="10" fill={C.text}>
              {p.t}
            </text>
          </g>
        ))}
      </svg>
      <Legend items={[{ label: "spot rate to time t", color: C.principal }, { label: "one-year forward rate for the year ending at t", color: C.interest }]} />
    </Frame>
  );
}

export function Growth({ title, start, end, samples, markers, caption }: { title: string; start: number; end: number; samples: { t: number; value: number }[]; markers?: { t: number; label: string }[]; caption?: string }) {
  const W = 720;
  const H = 200;
  const lo = Math.min(...samples.map((s) => s.value));
  const hi = Math.max(...samples.map((s) => s.value));
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1;
  const x = linear([start, end], [56, W - 16]);
  const y = linear([lo - pad, hi + pad], [H - 24, 12]);
  return (
    <Frame title={title} caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {ticks(lo - pad, hi + pad, 4).map((t) => (
          <g key={t}>
            <line x1={56} x2={W - 16} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={52} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke={C.balance} strokeWidth="2.5" points={samples.map((s) => `${x(s.t)},${y(s.value)}`).join(" ")} />
        {samples.length <= 13 && samples.map((s) => <circle key={s.t} cx={x(s.t)} cy={y(s.value)} r="3" fill={C.balance} />)}
        {(markers ?? []).map((m) => (
          <g key={`${m.t}-${m.label}`}>
            <line x1={x(m.t)} x2={x(m.t)} y1={12} y2={H - 24} stroke={C.text} strokeDasharray="3 4" />
            <text x={x(m.t)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.fg}>
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/** A multi-step calculation as a sequence of linked stages, revealed one step at a time. */
export function Flowchart({
  title,
  nodes,
  edges,
  caption,
}: {
  title: string;
  nodes: { id: string; label: string; detail?: string; tone?: "input" | "step" | "result" | "trap" }[];
  edges: { from: string; to: string; label?: string }[];
  caption?: string;
}) {
  const player = usePlayer(nodes.length, nodes.length - 1, 1100);
  const toneClass = { input: "border-primary/40 bg-primary/5", step: "bg-card", result: "border-success/50 bg-success/10", trap: "border-destructive/40 bg-destructive/5" };
  return (
    <Frame
      title={title}
      caption={caption}
      controls={<StepControls index={player.index} count={nodes.length} onChange={player.setIndex} playing={player.playing} onTogglePlay={player.toggle} label={`step ${player.index + 1} of ${nodes.length}`} />}
    >
      <div className="flex flex-wrap items-stretch gap-2">
        {nodes.map((node, idx) => {
          const incoming = edges.find((e) => e.to === node.id && e.from === nodes[idx - 1]?.id);
          const extra = edges.filter((e) => e.to === node.id && e.from !== nodes[idx - 1]?.id);
          return (
            <React.Fragment key={node.id}>
              {idx > 0 && (
                <div className={`flex flex-col items-center justify-center px-1 text-center text-[11px] text-muted-foreground transition-opacity ${idx <= player.index ? "opacity-100" : "opacity-25"}`}>
                  <span aria-hidden="true" className="text-lg leading-none">
                    →
                  </span>
                  {incoming?.label && <span className="max-w-[8rem]">{incoming.label}</span>}
                </div>
              )}
              <div className={`min-w-[9rem] max-w-[15rem] flex-1 rounded-md border p-2 text-sm transition-opacity ${toneClass[node.tone ?? "step"]} ${idx <= player.index ? "opacity-100" : "opacity-25"}`}>
                <MathRenderer content={node.label} className="font-medium" />
                {node.detail && <MathRenderer content={node.detail} className="text-xs text-muted-foreground" />}
                {extra.map((e) => (
                  <div key={e.from} className="mt-1 text-[11px] text-muted-foreground">
                    ← also from {nodes.find((n) => n.id === e.from)?.label.replace(/\$/g, "") ?? e.from}
                  </div>
                ))}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Frame>
  );
}
