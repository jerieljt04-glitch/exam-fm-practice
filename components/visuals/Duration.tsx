"use client";

import React, { useMemo, useState } from "react";

import { convexity, macaulayDuration, pvFlows, type Flow } from "@/lib/engine/finance";
import { num } from "@/lib/engine/format";
import { C, Frame, Legend, compact, linear, ticks } from "./chart";

/**
 * Present value against interest rate. The tangent line is the duration
 * approximation; the gap between the curve and the line is convexity. With
 * liabilities, the surplus curve shows Redington immunization: a minimum of
 * zero at the current rate.
 */
export function Duration({
  title,
  flows,
  rate,
  liabilities,
  shock = 0.02,
  caption,
}: {
  title: string;
  flows: Flow[];
  rate: number;
  liabilities?: Flow[];
  shock?: number;
  caption?: string;
}) {
  const [delta, setDelta] = useState(Math.abs(shock) || 0.02);
  const P0 = pvFlows(flows, rate);
  const D = macaulayDuration(flows, rate);
  const Dmod = D / (1 + rate);
  const Cv = convexity(flows, rate);
  const surplusMode = Boolean(liabilities?.length);
  const value = (i: number) => (surplusMode ? pvFlows(flows, i) - pvFlows(liabilities!, i) : pvFlows(flows, i));
  const lo = Math.max(0.001, rate - 0.06);
  const hi = rate + 0.06;
  const samples = useMemo(() => Array.from({ length: 61 }, (_, k) => lo + ((hi - lo) * k) / 60).map((i) => ({ i, p: value(i) })), [lo, hi, flows, liabilities]); // eslint-disable-line react-hooks/exhaustive-deps
  const tangent = (i: number) => P0 * (1 - Dmod * (i - rate));
  const quad = (i: number) => P0 * (1 - Dmod * (i - rate) + 0.5 * Cv * (i - rate) ** 2);
  const W = 720;
  const H = 240;
  const ys = samples.map((s) => s.p).concat(surplusMode ? [0] : samples.map((s) => tangent(s.i)));
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const pad = (yMax - yMin) * 0.08 || 1;
  const x = linear([lo, hi], [56, W - 14]);
  const y = linear([yMin - pad, yMax + pad], [H - 26, 12]);
  const i1 = rate + delta;
  const actual = value(i1);

  // Balance beam: PV weights by time with the duration as the fulcrum.
  const pvs = flows.map((f) => ({ t: f.t, pv: f.amount * Math.pow(1 + rate, -f.t) }));
  const tMax = Math.max(...flows.map((f) => f.t), ...(liabilities ?? []).map((l) => l.t), 1);
  const bx = linear([0, tMax], [30, W - 30]);
  const maxPv = Math.max(...pvs.map((p) => p.pv), 1);

  return (
    <Frame
      title={title}
      caption={caption}
      controls={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rate change
          <input type="range" min={-0.05} max={0.05} step={0.0025} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-40 accent-[hsl(var(--primary))]" aria-label="Rate change" />
          <span className="w-16 tabular-nums text-foreground">{delta >= 0 ? "+" : ""}{(delta * 100).toFixed(2)}%</span>
        </label>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={surplusMode ? "Surplus against interest rate" : "Present value against interest rate"}>
        {ticks(yMin - pad, yMax + pad, 4).map((t) => (
          <g key={t}>
            <line x1={56} x2={W - 14} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={52} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        {ticks(lo, hi, 6).map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.text}>
            {(t * 100).toFixed(1)}%
          </text>
        ))}
        <polyline fill="none" stroke={C.balance} strokeWidth="2.5" points={samples.map((s) => `${x(s.i)},${y(s.p)}`).join(" ")} />
        {!surplusMode && (
          <>
            <polyline fill="none" stroke={C.out} strokeWidth="1.8" strokeDasharray="6 4" points={samples.map((s) => `${x(s.i)},${y(tangent(s.i))}`).join(" ")} />
            <polyline fill="none" stroke={C.interest} strokeWidth="1.5" strokeDasharray="2 3" points={samples.map((s) => `${x(s.i)},${y(quad(s.i))}`).join(" ")} />
          </>
        )}
        {surplusMode && <line x1={56} x2={W - 14} y1={y(0)} y2={y(0)} stroke={C.text} strokeDasharray="4 4" />}
        <line x1={x(rate)} x2={x(rate)} y1={12} y2={H - 26} stroke={C.text} strokeDasharray="2 4" />
        <line x1={x(i1)} x2={x(i1)} y1={12} y2={H - 26} stroke={C.trap} strokeDasharray="2 4" />
        <circle cx={x(i1)} cy={y(actual)} r="4.5" fill={C.balance} />
        {!surplusMode && <circle cx={x(i1)} cy={y(tangent(i1))} r="4" fill={C.out} />}
      </svg>
      <Legend
        items={
          surplusMode
            ? [{ label: "surplus: PV(assets) − PV(liabilities)", color: C.balance }]
            : [
                { label: "actual present value", color: C.balance },
                { label: "duration (tangent) approximation", color: C.out, dashed: true },
                { label: "duration + convexity", color: C.interest, dashed: true },
              ]
        }
      />
      <div className="mt-3 grid gap-2 text-sm tabular-nums sm:grid-cols-4">
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">{surplusMode ? "Asset PV" : "Present value"}</div>
          <b>{num(P0, 2)}</b>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">Macaulay / modified duration</div>
          <b>
            {D.toFixed(3)} / {Dmod.toFixed(3)}
          </b>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">Convexity P″/P</div>
          <b>{Cv.toFixed(2)}</b>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-xs text-muted-foreground">At {(i1 * 100).toFixed(2)}%: actual {surplusMode ? "surplus" : "PV"}</div>
          <b>{num(actual, 2)}</b>
          {!surplusMode && <div className="text-xs text-muted-foreground">tangent {num(tangent(i1), 2)}</div>}
        </div>
      </div>
      <div className="mt-3">
        <div className="eyebrow mb-1">Present values on a balance beam — duration is the balance point</div>
        <svg viewBox={`0 0 ${W} 110`} className="w-full" role="img" aria-label="Present values by time with duration as fulcrum">
          <line x1={30} x2={W - 30} y1={70} y2={70} stroke={C.text} strokeWidth="2" />
          {pvs.map((p, idx) => {
            const h = 8 + (p.pv / maxPv) * 46;
            return (
              <g key={idx}>
                <rect x={bx(p.t) - 6} y={70 - h} width={12} height={h} fill={C.in} />
                <text x={bx(p.t)} y={86} textAnchor="middle" fontSize="10" fill={C.text}>
                  {Number.isInteger(p.t) ? p.t : p.t.toFixed(2)}
                </text>
              </g>
            );
          })}
          {(liabilities ?? []).map((l, idx) => (
            <g key={`l${idx}`}>
              <rect x={bx(l.t) - 6} y={72} width={12} height={10} fill={C.trap} />
              <text x={bx(l.t)} y={100} textAnchor="middle" fontSize="10" fill={C.trap}>
                liability
              </text>
            </g>
          ))}
          <polygon points={`${bx(D) - 9},${92} ${bx(D) + 9},${92} ${bx(D)},${72}`} fill={C.balance} />
          <text x={bx(D)} y={106} textAnchor="middle" fontSize="10" fill={C.balance} fontWeight="600">
            D = {D.toFixed(2)}
          </text>
        </svg>
      </div>
    </Frame>
  );
}
