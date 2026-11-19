"use client";

import React, { useMemo, useState } from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Tabs } from "@/components/ui";
import { Amortization } from "@/components/visuals/Amortization";
import { Bond } from "@/components/visuals/Bond";
import { Duration } from "@/components/visuals/Duration";
import { Series } from "@/components/visuals/SimpleCharts";
import { Timeline } from "@/components/visuals/Timeline";
import { an, geometricPV, levelPayment, pvFlows, v } from "@/lib/engine/finance";
import { num } from "@/lib/engine/format";
import type { TimelineFlow } from "@/lib/engine/types";

type LabTab = "annuity" | "loan" | "bond" | "duration" | "series" | "timeline";

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-foreground">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[hsl(var(--primary))]" />
    </label>
  );
}

const pctFmt = (v: number) => `${(v * 100).toFixed(2)}%`;

type AnnuityKind = "immediate" | "due" | "deferred" | "increasing" | "decreasing" | "geometric";

function AnnuityLab() {
  const [kind, setKind] = useState<AnnuityKind>("immediate");
  const [n, setN] = useState(10);
  const [i, setI] = useState(0.05);
  const [P, setP] = useState(1000);
  const [k, setK] = useState(3);
  const [g, setG] = useState(0.03);
  const flows: TimelineFlow[] = useMemo(() => {
    const out: TimelineFlow[] = [];
    for (let s = 1; s <= n; s += 1) {
      const t = kind === "due" ? s - 1 : kind === "deferred" ? k + s : s;
      const amount = kind === "increasing" ? P * s : kind === "decreasing" ? P * (n - s + 1) : kind === "geometric" ? P * Math.pow(1 + g, s - 1) : P;
      out.push({ t, amount, dir: "in" });
    }
    return out;
  }, [kind, n, P, k, g]);
  const pv = pvFlows(flows, i);
  const formula: Record<AnnuityKind, string> = {
    immediate: `$PV = P\\,a_{\\overline{n|}} = P\\dfrac{1 - v^n}{i}$`,
    due: `$PV = P\\,\\ddot{a}_{\\overline{n|}} = P(1+i)a_{\\overline{n|}}$`,
    deferred: `$PV = P\\,v^{k}a_{\\overline{n|}}$ — the factor lands at time k, one period before the first payment`,
    increasing: `$PV = P\\,(Ia)_{\\overline{n|}} = P\\dfrac{\\ddot{a}_{\\overline{n|}} - nv^n}{i}$`,
    decreasing: `$PV = P\\,(Da)_{\\overline{n|}} = P\\dfrac{n - a_{\\overline{n|}}}{i}$`,
    geometric: `$PV = P\\dfrac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i - g}$`,
  };
  const closed: Record<AnnuityKind, number> = {
    immediate: P * an(n, i),
    due: P * an(n, i) * (1 + i),
    deferred: P * v(i, k) * an(n, i),
    increasing: (P * (an(n, i) * (1 + i) - n * v(i, n))) / i,
    decreasing: (P * (n - an(n, i))) / i,
    geometric: P * geometricPV(n, i, g),
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(["immediate", "due", "deferred", "increasing", "decreasing", "geometric"] as AnnuityKind[]).map((option) => (
          <button key={option} onClick={() => setKind(option)} className={`rounded-full border px-3 py-1 text-sm ${kind === option ? "border-primary-container bg-primary-container text-primary-on-container" : "hover:bg-accent"}`}>
            {option === "immediate" ? "Annuity-immediate" : option === "due" ? "Annuity-due" : option === "deferred" ? "Deferred" : option === "increasing" ? "Arithmetic increasing" : option === "decreasing" ? "Arithmetic decreasing" : "Geometric"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Slider label="Payments n" value={n} min={2} max={30} step={1} onChange={setN} />
        <Slider label="Rate i" value={i} min={0.005} max={0.15} step={0.0025} onChange={setI} format={pctFmt} />
        <Slider label={kind === "increasing" || kind === "decreasing" ? "Step P" : "Payment P"} value={P} min={100} max={5000} step={100} onChange={setP} />
        {kind === "deferred" && <Slider label="Deferral k" value={k} min={1} max={15} step={1} onChange={setK} />}
        {kind === "geometric" && <Slider label="Growth g" value={g} min={-0.05} max={0.12} step={0.0025} onChange={setG} format={pctFmt} />}
      </div>
      <div className="rounded-lg border p-3 text-sm">
        <MathRenderer content={formula[kind]} />
        <div className="mt-2 tabular-nums">
          Closed form: <b>{num(closed[kind], 2)}</b> · Sum of discounted payments: <b>{num(pv, 2)}</b>
        </div>
      </div>
      <Timeline title="Payments and the valuation date" unit="year" rate={i} flows={flows} valuationTimes={[0, kind === "deferred" ? k : n]} caption="Move the valuation date to see where each factor leaves the stream's value (a: one period before the first payment; ä: at the first payment; s: at the last payment)." />
    </div>
  );
}

function LoanLab() {
  const [L, setL] = useState(100000);
  const [i, setI] = useState(0.06);
  const [n, setN] = useState(15);
  const [refi, setRefi] = useState(false);
  const [k, setK] = useState(5);
  const [j, setJ] = useState(0.04);
  const P = levelPayment(L, n, i);
  const kk = Math.min(k, n - 1);
  const balance = P * an(n - kk, i);
  const Q = balance / an(n - kk, j);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Slider label="Loan" value={L} min={10000} max={500000} step={5000} onChange={setL} format={(x) => num(x, 0)} />
        <Slider label="Rate" value={i} min={0.01} max={0.15} step={0.0025} onChange={setI} format={pctFmt} />
        <Slider label="Term (years)" value={n} min={3} max={30} step={1} onChange={setN} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={refi} onChange={(e) => setRefi(e.target.checked)} /> Refinance
        </label>
        {refi && <Slider label="After payment" value={kk} min={1} max={n - 1} step={1} onChange={setK} />}
        {refi && <Slider label="New rate" value={j} min={0.01} max={0.15} step={0.0025} onChange={setJ} format={pctFmt} />}
      </div>
      <p className="text-sm tabular-nums">
        Level payment {num(P, 2)}
        {refi && (
          <>
            {" "}· balance after payment {kk}: {num(balance, 2)} (at the old rate) · new payment {num(Q, 2)} over the remaining {n - kk} years
          </>
        )}
      </p>
      <Amortization
        title="Loan amortization"
        principal={L}
        rate={i}
        payments={Array.from({ length: n }, () => P)}
        unit="year"
        highlightPeriod={1}
        refinance={refi ? { atPeriod: kk, newRate: j, newPayments: Array.from({ length: n - kk }, () => Q) } : undefined}
        caption="Select a year (or press Play) to see the interest accrue, the payment arrive and the split between interest and principal."
      />
    </div>
  );
}

function BondLab() {
  const [r, setR] = useState(0.06);
  const [y, setY] = useState(0.05);
  const [n, setN] = useState(10);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label="Annual coupon rate (semiannual coupons)" value={r} min={0.01} max={0.12} step={0.0025} onChange={setR} format={pctFmt} />
        <Slider label="Yield (nominal, semiannual)" value={y} min={0.01} max={0.12} step={0.0025} onChange={setY} format={pctFmt} />
        <Slider label="Years" value={n} min={1} max={30} step={1} onChange={setN} />
      </div>
      <Bond key={`${r}-${y}-${n}`} title="1000 par bond" face={1000} couponRate={r / 2} redemption={1000} yieldRate={y / 2} periods={2 * n} unit="half-year" caption="Coupon above yield: premium, book value falls to par. Coupon below yield: discount, book value rises to par." />
    </div>
  );
}

function DurationLab() {
  const [shape, setShape] = useState<"bullet" | "barbell" | "level" | "zero">("bullet");
  const [i, setI] = useState(0.05);
  const flows = useMemo(() => {
    if (shape === "zero") return [{ t: 10, amount: 1628.89 }];
    if (shape === "bullet") return [{ t: 9, amount: 500 }, { t: 10, amount: 600 }, { t: 11, amount: 500 }];
    if (shape === "barbell") return [{ t: 2, amount: 600 }, { t: 18, amount: 1400 }];
    return Array.from({ length: 20 }, (_, idx) => ({ t: idx + 1, amount: 100 }));
  }, [shape]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["zero", "bullet", "barbell", "level"] as const).map((s) => (
          <button key={s} onClick={() => setShape(s)} className={`rounded-full border px-3 py-1 text-sm ${shape === s ? "border-primary-container bg-primary-container text-primary-on-container" : "hover:bg-accent"}`}>
            {s === "zero" ? "Zero-coupon" : s === "bullet" ? "Bullet" : s === "barbell" ? "Barbell" : "Level annuity"}
          </button>
        ))}
        <div className="w-56">
          <Slider label="Rate" value={i} min={0.01} max={0.12} step={0.0025} onChange={setI} format={pctFmt} />
        </div>
      </div>
      <Duration
        key={`${shape}-${i}`}
        title="Price sensitivity"
        flows={flows}
        rate={i}
        caption="The dashed line is the duration estimate; the curve bends above it — that bend is convexity. A barbell has much more convexity than a bullet with a similar duration."
      />
      <Duration
        key="immunize"
        title="Redington immunization: surplus of a barbell against a single liability"
        flows={[
          // Each bond carries half of the liability's present value: (10 − 5)/(15 − 5) = 1/2.
          { t: 5, amount: ((10000 * Math.pow(1.05, -10)) / 2) * Math.pow(1.05, 5) },
          { t: 15, amount: ((10000 * Math.pow(1.05, -10)) / 2) * Math.pow(1.05, 15) },
        ]}
        liabilities={[{ t: 10, amount: 10000 }]}
        rate={0.05}
        caption="Assets at 5 and 15 years matched in PV and duration to a liability at 10 years (at 5%). The surplus has a minimum of zero at 5%: any small rate change leaves assets worth more than liabilities."
      />
    </div>
  );
}

function SeriesLab() {
  const [n, setN] = useState(12);
  const [P, setP] = useState(1000);
  const [Q, setQ] = useState(60);
  const g = Q / P;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label="Terms" value={n} min={3} max={30} step={1} onChange={setN} />
        <Slider label="First payment" value={P} min={100} max={3000} step={100} onChange={setP} />
        <Slider label="Arithmetic step Q (and matching growth Q/P)" value={Q} min={10} max={400} step={10} onChange={setQ} />
      </div>
      <Series
        title="Arithmetic versus geometric growth with the same first step"
        unit="year"
        series={[
          { label: `arithmetic: +${Q} each year`, values: Array.from({ length: n }, (_, idx) => ({ t: idx + 1, amount: P + idx * Q })) },
          { label: `geometric: ×(1 + ${(g * 100).toFixed(2)}%) each year`, values: Array.from({ length: n }, (_, idx) => ({ t: idx + 1, amount: P * Math.pow(1 + g, idx) })) },
        ]}
        caption="Both start identically and agree on the second payment; after that the geometric stream pulls ahead. Treating one as the other is a classic distractor."
      />
    </div>
  );
}

function TimelineLab() {
  const [rate, setRate] = useState(0.05);
  const [flows, setFlows] = useState<TimelineFlow[]>([
    { t: 0, amount: 10000, dir: "in", label: "loan" },
    { t: 1, amount: 3000, dir: "out" },
    { t: 3, amount: 4000, dir: "out" },
    { t: 5, amount: 5000, dir: "out" },
  ]);
  const update = (idx: number, patch: Partial<TimelineFlow>) => setFlows((fs) => fs.map((f, k) => (k === idx ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-4">
      <div className="w-56">
        <Slider label="Rate per period" value={rate} min={0} max={0.15} step={0.0025} onChange={setRate} format={pctFmt} />
      </div>
      <table className="text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="pr-3">time</th>
            <th className="pr-3">amount</th>
            <th className="pr-3">direction</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {flows.map((f, idx) => (
            <tr key={idx}>
              <td className="pr-3">
                <input type="number" value={f.t} min={0} max={40} onChange={(e) => update(idx, { t: Number(e.target.value) })} className="h-8 w-16 rounded-field border bg-elevated px-2" />
              </td>
              <td className="pr-3">
                <input type="number" value={f.amount} min={0} onChange={(e) => update(idx, { amount: Number(e.target.value) })} className="h-8 w-28 rounded-field border bg-elevated px-2" />
              </td>
              <td className="pr-3">
                <select value={f.dir} onChange={(e) => update(idx, { dir: e.target.value as "in" | "out" })} className="h-8 rounded-field border bg-elevated px-2">
                  <option value="in">received</option>
                  <option value="out">paid</option>
                </select>
              </td>
              <td>
                <button onClick={() => setFlows((fs) => fs.filter((_, k) => k !== idx))} className="text-xs text-muted-foreground hover:text-destructive">
                  remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setFlows((fs) => [...fs, { t: (fs[fs.length - 1]?.t ?? 0) + 1, amount: 1000, dir: "out" }])} className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
        Add cash flow
      </button>
      <Timeline title="Your cash flows" unit="year" rate={rate} flows={flows} valuationTimes={[0, Math.max(...flows.map((f) => f.t), 0)]} caption="Received and paid totals move by the same factor when the valuation date changes, so an equation of value that balances at one date balances at every date." />
    </div>
  );
}

export function LabClient() {
  const [tab, setTab] = useState<LabTab>("loan");
  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { id: "loan", label: "Loan amortization" },
          { id: "annuity", label: "Annuities" },
          { id: "bond", label: "Bonds" },
          { id: "duration", label: "Duration & convexity" },
          { id: "series", label: "Arithmetic vs geometric" },
          { id: "timeline", label: "Cash-flow timeline" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "annuity" && <AnnuityLab />}
      {tab === "loan" && <LoanLab />}
      {tab === "bond" && <BondLab />}
      {tab === "duration" && <DurationLab />}
      {tab === "series" && <SeriesLab />}
      {tab === "timeline" && <TimelineLab />}
    </div>
  );
}
