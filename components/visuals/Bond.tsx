"use client";

import React, { useMemo, useState } from "react";

import { an, v } from "@/lib/engine/finance";
import { num } from "@/lib/engine/format";
import type { TimeUnit } from "@/lib/engine/types";
import { C, Frame, Legend, StepControls, UNIT_LABEL, compact, linear, ticks, usePlayer } from "./chart";

/**
 * A bond's book value moving from its price toward its redemption value, with
 * each coupon split into interest at the yield and write-down (or write-up).
 * The yield slider shows how price responds to the yield.
 */
export function Bond({
  title,
  face,
  couponRate,
  redemption,
  yieldRate,
  periods,
  unit,
  highlightPeriod,
  caption,
}: {
  title: string;
  face: number;
  couponRate: number;
  redemption: number;
  yieldRate: number;
  periods: number;
  unit: TimeUnit;
  highlightPeriod?: number;
  caption?: string;
}) {
  const [j, setJ] = useState(yieldRate);
  const coupon = face * couponRate;
  const rows = useMemo(() => {
    let book = coupon * an(periods, j) + redemption * v(j, periods);
    const out = [{ period: 0, book, interest: 0, change: 0 }];
    for (let k = 1; k <= periods; k += 1) {
      const interest = book * j;
      const change = coupon - interest;
      book -= change;
      out.push({ period: k, book, interest, change });
    }
    return out;
  }, [coupon, j, periods, redemption]);
  const price = rows[0].book;
  const player = usePlayer(periods + 1, highlightPeriod ?? 0);
  const row = rows[player.index];
  const W = 720;
  const H = 220;
  const lo = Math.min(...rows.map((r) => r.book), redemption) * 0.98;
  const hi = Math.max(...rows.map((r) => r.book), redemption) * 1.02;
  const x = linear([0, periods], [52, W - 14]);
  const y = linear([lo, hi], [H - 24, 14]);
  const premium = price > redemption;
  const unitWord = UNIT_LABEL[unit];

  return (
    <Frame
      title={title}
      caption={caption}
      controls={<StepControls index={player.index} count={periods + 1} onChange={player.setIndex} playing={player.playing} onTogglePlay={player.toggle} label={`coupon ${player.index} of ${periods}`} />}
    >
      <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        Yield per {unitWord}
        <input type="range" min={Math.max(0.001, yieldRate - 0.03)} max={yieldRate + 0.03} step={0.0005} value={j} onChange={(e) => setJ(Number(e.target.value))} className="w-48 accent-[hsl(var(--primary))]" aria-label="Yield rate" />
        <span className="tabular-nums text-foreground">{(j * 100).toFixed(2)}%</span>
        <span>→ price {num(price, 2)} ({premium ? "premium" : price < redemption ? "discount" : "par"})</span>
        {Math.abs(j - yieldRate) > 1e-9 && (
          <button className="rounded border px-1.5 py-0.5 hover:bg-accent" onClick={() => setJ(yieldRate)}>
            reset
          </button>
        )}
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Book value of the bond by coupon">
        {ticks(lo, hi, 4).map((t) => (
          <g key={t}>
            <line x1={52} x2={W - 14} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={48} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        <line x1={52} x2={W - 14} y1={y(redemption)} y2={y(redemption)} stroke={C.text} strokeDasharray="4 4" />
        <text x={W - 16} y={y(redemption) - 4} textAnchor="end" fontSize="10" fill={C.text}>
          redemption {compact(redemption)}
        </text>
        <polyline fill="none" stroke={C.balance} strokeWidth="2.5" points={rows.map((r) => `${x(r.period)},${y(r.book)}`).join(" ")} />
        {rows.map((r) => (
          <circle key={r.period} cx={x(r.period)} cy={y(r.book)} r={r.period === player.index ? 5 : 2.2} fill={r.period === player.index ? C.fg : C.balance} onClick={() => player.setIndex(r.period)} style={{ cursor: "pointer" }} />
        ))}
      </svg>
      <Legend items={[{ label: "book value at the yield", color: C.balance }, { label: "redemption value", color: C.text, dashed: true }]} />
      <div className="mt-3 rounded-md bg-muted p-3 text-sm tabular-nums">
        {player.index === 0 ? (
          <div>
            Price = coupons {num(coupon, 2)} × a({periods}) + {num(redemption, 2)} × v^{periods} = <b>{num(price, 2)}</b>
          </div>
        ) : (
          <ol className="space-y-1">
            <li>
              Book value before coupon {player.index}: <b>{num(rows[player.index - 1].book, 2)}</b>
            </li>
            <li>
              Interest earned at {(j * 100).toFixed(3)}%: <b style={{ color: C.interest }}>{num(row.interest, 2)}</b>
            </li>
            <li>
              Coupon received: <b>{num(coupon, 2)}</b>
            </li>
            <li>
              {row.change >= 0 ? "Write-down (premium amortized)" : "Write-up (discount accumulated)"}: <b>{num(Math.abs(row.change), 2)}</b>
            </li>
            <li>
              Book value after: <b style={{ color: C.balance }}>{num(row.book, 2)}</b>
            </li>
          </ol>
        )}
      </div>
    </Frame>
  );
}
