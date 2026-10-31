"use client";

import React, { useMemo } from "react";

import { num } from "@/lib/engine/format";
import type { TimeUnit } from "@/lib/engine/types";
import { C, Frame, Legend, StepControls, UNIT_LABEL, compact, linear, ticks, usePlayer } from "./chart";

interface Row {
  period: number;
  rate: number;
  opening: number;
  interest: number;
  payment: number;
  principal: number;
  closing: number;
  refinanced: boolean;
}

function schedule(principal: number, rate: number, payments: number[], refinance?: { atPeriod: number; newRate: number; newPayments: number[] }): Row[] {
  const rows: Row[] = [];
  let balance = principal;
  const all = refinance ? [...payments.slice(0, refinance.atPeriod), ...refinance.newPayments] : payments;
  all.forEach((payment, idx) => {
    const period = idx + 1;
    const refinanced = Boolean(refinance && period > refinance.atPeriod);
    const r = refinanced ? refinance!.newRate : rate;
    const interest = balance * r;
    const closing = balance + interest - payment;
    rows.push({ period, rate: r, opening: balance, interest, payment, principal: payment - interest, closing, refinanced });
    balance = closing;
  });
  return rows;
}

/**
 * A loan, one payment at a time: each step shows the balance accruing interest,
 * the payment arriving, and how the payment splits into interest and principal.
 * The selected period is also checked retrospectively and prospectively.
 */
export function Amortization({
  title,
  principal,
  rate,
  payments,
  unit,
  highlightPeriod,
  refinance,
  caption,
}: {
  title: string;
  principal: number;
  rate: number;
  payments: number[];
  unit: TimeUnit;
  highlightPeriod?: number;
  refinance?: { atPeriod: number; newRate: number; newPayments: number[] };
  caption?: string;
}) {
  const rows = useMemo(() => schedule(principal, rate, payments, refinance), [principal, rate, payments, refinance]);
  const player = usePlayer(rows.length, Math.max(0, (highlightPeriod ?? 1) - 1));
  const row = rows[player.index];
  const W = 720;
  const H = 230;
  const maxBalance = Math.max(principal, ...rows.map((r) => r.opening), ...rows.map((r) => r.payment));
  const x = linear([0, rows.length + 0.6], [46, W - 12]);
  const y = linear([0, maxBalance * 1.05], [H - 26, 12]);
  const barW = Math.max(2, Math.min(26, (W - 70) / rows.length - 3));

  // Retrospective and prospective balance at the selected period (same-rate segment only).
  const k = row?.period ?? 0;
  const segmentStart = refinance && k > refinance.atPeriod ? refinance.atPeriod : 0;
  const segmentRate = row?.rate ?? rate;
  const startBalance = segmentStart === 0 ? principal : rows[segmentStart - 1].closing;
  const retro = rows.slice(segmentStart, k).reduce((acc, r) => acc * (1 + segmentRate) - r.payment, startBalance);
  const segmentEnd = refinance && k <= refinance.atPeriod ? refinance.atPeriod : rows.length;
  const remaining = rows.slice(k, segmentEnd);
  const continuesAtSameRate = !(refinance && k <= refinance.atPeriod);
  const prospective = remaining.reduce((acc, r, idx) => acc + r.payment * Math.pow(1 + segmentRate, -(idx + 1)), 0);
  const unitWord = UNIT_LABEL[unit];

  return (
    <Frame
      title={title}
      caption={caption}
      controls={<StepControls index={player.index} count={rows.length} onChange={player.setIndex} playing={player.playing} onTogglePlay={player.toggle} label={`${unitWord} ${k} of ${rows.length}`} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Loan balance and payment split by period">
        {ticks(0, maxBalance * 1.05, 4).map((t) => (
          <g key={t}>
            <line x1={46} x2={W - 12} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={42} y={y(t) + 4} textAnchor="end" fontSize="10" fill={C.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        {refinance && (
          <g>
            <line x1={x(refinance.atPeriod)} x2={x(refinance.atPeriod)} y1={10} y2={H - 26} stroke={C.trap} strokeDasharray="5 4" />
            <text x={x(refinance.atPeriod) + 4} y={20} fontSize="10" fill={C.trap}>
              refinanced
            </text>
          </g>
        )}
        {rows.map((r, idx) => {
          const cx = x(r.period) - barW / 2;
          const active = idx === player.index;
          const interestH = y(0) - y(Math.max(0, r.interest));
          const principalH = y(0) - y(Math.max(0, r.principal));
          return (
            <g key={r.period} opacity={idx <= player.index ? 1 : 0.28} onClick={() => player.setIndex(idx)} style={{ cursor: "pointer" }}>
              <rect x={cx} y={y(0) - principalH} width={barW} height={principalH} fill={C.principal} />
              <rect x={cx} y={y(0) - principalH - interestH} width={barW} height={interestH} fill={C.interest} />
              {active && <rect x={cx - 2} y={y(r.payment) - 2} width={barW + 4} height={y(0) - y(r.payment) + 4} fill="none" stroke={C.fg} strokeWidth="1.5" />}
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke={C.balance}
          strokeWidth="2.5"
          points={[`${x(0)},${y(principal)}`, ...rows.slice(0, player.index + 1).map((r) => `${x(r.period)},${y(Math.max(0, r.closing))}`)].join(" ")}
        />
        <circle cx={x(k)} cy={y(Math.max(0, row?.closing ?? 0))} r="4" fill={C.balance} />
        <text x={x(0)} y={H - 8} fontSize="10" fill={C.text}>
          0
        </text>
        <text x={x(rows.length)} y={H - 8} fontSize="10" fill={C.text} textAnchor="end">
          {rows.length}
        </text>
      </svg>
      <Legend
        items={[
          { label: "balance after payment", color: C.balance },
          { label: "interest part of payment", color: C.interest },
          { label: "principal part of payment", color: C.principal },
        ]}
      />
      {row && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ol className="space-y-1 rounded-md bg-muted p-3 text-sm tabular-nums">
            <li>
              Balance owed at the start of {unitWord} {k}: <b>{num(row.opening, 2)}</b>
            </li>
            <li>
              + interest at {(row.rate * 100).toFixed(4)}% on that balance: <b style={{ color: C.interest }}>{num(row.interest, 2)}</b>
            </li>
            <li>
              − payment at the end of the {unitWord}: <b>{num(row.payment, 2)}</b>
            </li>
            <li>
              = balance after the payment: <b style={{ color: C.balance }}>{num(row.closing, 2)}</b>
            </li>
            <li className="pt-1 text-xs text-muted-foreground">
              The payment covers the interest first; the remaining {num(row.principal, 2)} reduces the balance (principal repaid).
            </li>
          </ol>
          <div className="space-y-1 rounded-md border p-3 text-sm tabular-nums">
            <div className="eyebrow">Two ways to the same balance</div>
            <div>
              Retrospective (what was borrowed, grown, less what was paid, grown): <b>{num(retro, 2)}</b>
            </div>
            {continuesAtSameRate ? (
              <div>
                Prospective (value of the {remaining.length} payment{remaining.length === 1 ? "" : "s"} still to come): <b>{num(prospective, 2)}</b>
              </div>
            ) : (
              <div className="text-muted-foreground">Prospective view: the old loan&apos;s future payments no longer exist after refinancing; the balance is re-amortized at the new rate.</div>
            )}
            {row.refinanced && <div className="text-xs text-muted-foreground">This period is on the refinanced loan at {(row.rate * 100).toFixed(3)}%.</div>}
          </div>
        </div>
      )}
    </Frame>
  );
}
