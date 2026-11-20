"use client";

import React, { useEffect, useReducer, useRef, useState } from "react";

import { amortize, CalcError, irr, npv, type CashFlow } from "@/lib/calculator/finance";
import { DECIMAL_CHOICES, displayText, INITIAL_STATE, press, type CalcState, type Decimals, type Key } from "@/lib/calculator/machine";
import { cn } from "@/lib/utils";

interface KeyDef {
  label: string;
  /** Secondary label printed above the key (the 2nd function). */
  alt?: string;
  key?: Key;
  altKey?: Key;
  /** Keys that open a worksheet panel instead of acting on the display. */
  panel?: "cf" | "amort" | "settings";
  altPanel?: "cf" | "amort" | "settings";
  tone?: "fn" | "num" | "op" | "tvm" | "accent";
  clearEntry?: boolean;
}

const D = (d: number): KeyDef => ({ label: String(d), key: { kind: "digit", d }, tone: "num" });

/** Layout after the BA II Plus: worksheet row, TVM row, functions, then the keypad. */
const ROWS: KeyDef[][] = [
  [
    { label: "2nd", key: { kind: "second" }, tone: "accent" },
    { label: "CPT", key: { kind: "cpt" }, tone: "fn" },
    { label: "CF", panel: "cf", alt: "NPV/IRR", tone: "fn" },
    { label: "AMORT", panel: "amort", tone: "fn" },
    { label: "CE/C", clearEntry: true, tone: "fn" },
  ],
  [
    { label: "N", alt: "xP/Y", key: { kind: "tvm", reg: "N" }, altKey: { kind: "xpy" }, tone: "tvm" },
    { label: "I/Y", alt: "P/Y", key: { kind: "tvm", reg: "IY" }, altPanel: "settings", tone: "tvm" },
    { label: "PV", key: { kind: "tvm", reg: "PV" }, tone: "tvm" },
    { label: "PMT", alt: "BGN", key: { kind: "tvm", reg: "PMT" }, altKey: { kind: "bgn" }, tone: "tvm" },
    { label: "FV", alt: "CLR TVM", key: { kind: "tvm", reg: "FV" }, altKey: { kind: "clrTvm" }, tone: "tvm" },
  ],
  [
    { label: "%", key: { kind: "unary", fn: "pct" }, tone: "fn" },
    { label: "√x", key: { kind: "unary", fn: "sqrt" }, tone: "fn" },
    { label: "x²", key: { kind: "unary", fn: "sq" }, tone: "fn" },
    { label: "1/x", key: { kind: "unary", fn: "inv" }, tone: "fn" },
    { label: "÷", key: { kind: "op", op: "/" }, tone: "op" },
  ],
  [{ label: "LN", alt: "eˣ", key: { kind: "unary", fn: "ln" }, altKey: { kind: "unary", fn: "exp" }, tone: "fn" }, D(7), D(8), D(9), { label: "×", key: { kind: "op", op: "*" }, tone: "op" }],
  [{ label: "yˣ", alt: "x!", key: { kind: "op", op: "pow" }, altKey: { kind: "unary", fn: "fact" }, tone: "fn" }, D(4), D(5), D(6), { label: "−", key: { kind: "op", op: "-" }, tone: "op" }],
  [{ label: "STO", key: { kind: "sto" }, tone: "fn" }, D(1), D(2), D(3), { label: "+", key: { kind: "op", op: "+" }, tone: "op" }],
  [
    { label: "RCL", key: { kind: "rcl" }, tone: "fn" },
    { label: "+/−", key: { kind: "sign" }, tone: "num" },
    D(0),
    { label: ".", key: { kind: "dot" }, tone: "num" },
    { label: "=", key: { kind: "equals" }, tone: "accent" },
  ],
];

const TONE: Record<NonNullable<KeyDef["tone"]>, string> = {
  num: "bg-elevated text-foreground hover:shadow-resting",
  fn: "bg-surface-alt text-foreground hover:bg-secondary",
  op: "bg-primary-container text-primary-on-container hover:shadow-resting",
  tvm: "bg-primary-container/60 text-primary-on-container hover:shadow-resting",
  accent: "bg-primary text-primary-foreground hover:bg-primary-hover",
};

interface Saved {
  state: CalcState;
  decimals: Decimals;
  cf0: number;
  flows: CashFlow[];
  rate: number;
  p1: number;
  p2: number;
}

const KEYBOARD: Record<string, Key> = {
  "+": { kind: "op", op: "+" },
  "-": { kind: "op", op: "-" },
  "*": { kind: "op", op: "*" },
  x: { kind: "op", op: "*" },
  "/": { kind: "op", op: "/" },
  "^": { kind: "op", op: "pow" },
  "=": { kind: "equals" },
  Enter: { kind: "equals" },
  ".": { kind: "dot" },
  Backspace: { kind: "backspace" },
  Escape: { kind: "clear" },
};

function load(storageKey: string | undefined): Saved | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/**
 * A BA II Plus-style calculator: chain arithmetic, memories, the TVM keys
 * with CPT (and BGN, P/Y, C/Y), and the cash-flow and amortization
 * worksheets. It keeps its memory between questions, like the handheld.
 */
export function Calculator({ storageKey, className }: { storageKey?: string; className?: string }) {
  const saved = useRef<Saved | null>(null);
  if (saved.current === null && typeof window !== "undefined") saved.current = load(storageKey);
  const [state, dispatch] = useReducer(press, saved.current?.state ?? INITIAL_STATE);
  const [decimals, setDecimals] = useState<Decimals>(saved.current?.decimals ?? 2);
  const [panel, setPanel] = useState<"cf" | "amort" | "settings" | null>(null);
  const [cf0, setCf0] = useState(saved.current?.cf0 ?? 0);
  const [flows, setFlows] = useState<CashFlow[]>(saved.current?.flows ?? [{ amount: 0, count: 1 }]);
  const [rate, setRate] = useState(saved.current?.rate ?? 0);
  const [p1, setP1] = useState(saved.current?.p1 ?? 1);
  const [p2, setP2] = useState(saved.current?.p2 ?? 1);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ state, decimals, cf0, flows, rate, p1, p2 } satisfies Saved));
    } catch {
      // Storage unavailable: the calculator still works for this page.
    }
  }, [storageKey, state, decimals, cf0, flows, rate, p1, p2]);

  const onKey = (def: KeyDef) => {
    if (def.clearEntry) {
      dispatch(state.entry !== null || state.error ? { kind: "ce" } : { kind: "clear" });
      return;
    }
    const useAlt = state.second && (def.altKey || def.altPanel);
    const targetPanel = useAlt ? def.altPanel : def.panel;
    if (targetPanel) {
      if (state.second) dispatch({ kind: "second" });
      setPanel((p) => (p === targetPanel ? null : targetPanel));
      return;
    }
    const key = useAlt ? def.altKey : def.key;
    if (key) dispatch(key);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") return;
    e.stopPropagation();
    if (/^[0-9]$/.test(e.key)) {
      dispatch({ kind: "digit", d: Number(e.key) });
      e.preventDefault();
      return;
    }
    const key = KEYBOARD[e.key];
    if (key) {
      dispatch(key);
      e.preventDefault();
    }
  };

  const status = [state.second && "2nd", state.tvm.bgn ? "BGN" : null, state.tvm.PY !== 1 || state.tvm.CY !== 1 ? `P/Y ${state.tvm.PY} · C/Y ${state.tvm.CY}` : null, state.pending && "…"].filter(Boolean);

  return (
    <div data-no-shortcuts className={cn("flex flex-col gap-3 outline-none", className)} tabIndex={0} onKeyDown={onKeyDown} aria-label="Calculator (BA II Plus style). Type numbers and operators while it has focus.">
      <div className="rounded-card bg-elevated px-4 py-3 shadow-resting" aria-live="polite">
        <div className="flex h-5 items-center justify-between text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <span>{state.label ?? ""}</span>
          <span className="flex gap-2">
            {status.map((s) => (
              <span key={String(s)} className={cn(s === "2nd" && "text-primary")}>
                {s}
              </span>
            ))}
          </span>
        </div>
        <output className={cn("block truncate text-right font-mono text-[28px] font-medium tabular-nums", state.error && "text-destructive")} aria-label="Display">
          {displayText(state, decimals)}
        </output>
      </div>

      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Calculator keys">
        {ROWS.flat().map((def, k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(def)}
            className={cn("relative flex h-11 flex-col items-center justify-center rounded-field text-sm font-medium active:scale-[0.97]", TONE[def.tone ?? "fn"], def.label === "2nd" && state.second && "ring-2 ring-primary ring-offset-1 ring-offset-card")}
            aria-label={def.alt ? `${def.label} (2nd: ${def.alt})` : def.label}
          >
            {def.alt && <span className={cn("absolute top-0.5 text-[9px] leading-none", state.second ? "text-primary" : "text-muted-foreground")}>{def.alt}</span>}
            <span className={cn(def.alt && "mt-2")}>{def.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          Decimals
          <select className="h-8 rounded-field border bg-elevated px-2" value={decimals} onChange={(e) => setDecimals(Number(e.target.value) as Decimals)}>
            {DECIMAL_CHOICES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <span>
          TVM: N {fmt(state.tvm.N)} · I/Y {fmt(state.tvm.IY)} · PV {fmt(state.tvm.PV)} · PMT {fmt(state.tvm.PMT)} · FV {fmt(state.tvm.FV)}
        </span>
      </div>

      {panel === "settings" && (
        <Worksheet title="P/Y and C/Y" onClose={() => setPanel(null)}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(["PY", "CY"] as const).map((field) => (
              <label key={field} className="flex items-center gap-2">
                {field === "PY" ? "Payments per year" : "Compoundings per year"}
                <input
                  type="number"
                  min={1}
                  className="h-9 w-20 rounded-field border bg-elevated px-2"
                  value={state.tvm[field]}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    dispatch({ kind: "setPeriods", py: field === "PY" ? v : state.tvm.PY, cy: field === "CY" ? v : state.tvm.CY });
                  }}
                />
              </label>
            ))}
            <span className="text-xs text-muted-foreground">I/Y is an annual nominal rate with C/Y compoundings; payments are per P/Y.</span>
          </div>
        </Worksheet>
      )}

      {panel === "cf" && (
        <Worksheet title="Cash flows · NPV · IRR" onClose={() => setPanel(null)}>
          <CashFlows cf0={cf0} setCf0={setCf0} flows={flows} setFlows={setFlows} rate={rate} setRate={setRate} send={(v) => dispatch({ kind: "setValue", value: v })} />
        </Worksheet>
      )}

      {panel === "amort" && (
        <Worksheet title="Amortization (uses the TVM registers)" onClose={() => setPanel(null)}>
          <Amort tvm={state.tvm} p1={p1} p2={p2} setP1={setP1} setP2={setP2} send={(v) => dispatch({ kind: "setValue", value: v })} />
        </Worksheet>
      )}
    </div>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 1e6 ? v.toExponential(2) : String(Number(v.toFixed(4))));

function Worksheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="animate-rise rounded-card bg-elevated p-4 shadow-resting">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <button type="button" onClick={onClose} className="rounded-pill px-3 py-1 text-xs font-medium text-primary hover:bg-primary/[0.08]">
          Close
        </button>
      </div>
      {children}
    </section>
  );
}

function Result({ label, value, send }: { label: string; value: number | null; send: (v: number) => void }) {
  return (
    <button
      type="button"
      disabled={value === null}
      onClick={() => value !== null && send(value)}
      className="flex min-w-[96px] flex-col items-start rounded-field bg-surface-alt px-3 py-2 text-left hover:bg-secondary disabled:opacity-50"
      title="Send to the display"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value === null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
    </button>
  );
}

function CashFlows(props: {
  cf0: number;
  setCf0: (v: number) => void;
  flows: CashFlow[];
  setFlows: (f: CashFlow[]) => void;
  rate: number;
  setRate: (v: number) => void;
  send: (v: number) => void;
}) {
  const { cf0, setCf0, flows, setFlows, rate, setRate, send } = props;
  let npvValue: number | null = null;
  let irrValue: number | null = null;
  try {
    npvValue = npv(rate, cf0, flows);
  } catch {
    npvValue = null;
  }
  try {
    irrValue = irr(cf0, flows);
  } catch (e) {
    if (!(e instanceof CalcError)) throw e;
  }
  const field = "h-9 w-full rounded-field border bg-elevated px-2 text-sm tabular-nums";
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">CF0</span>
        <input type="number" className={field} value={cf0} onChange={(e) => setCf0(Number(e.target.value))} aria-label="CF0" />
        <span />
        {flows.map((f, k) => (
          <React.Fragment key={k}>
            <span className="text-xs font-medium text-muted-foreground">C{String(k + 1).padStart(2, "0")}</span>
            <input type="number" className={field} value={f.amount} onChange={(e) => setFlows(flows.map((x, j) => (j === k ? { ...x, amount: Number(e.target.value) } : x)))} aria-label={`C${k + 1}`} />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              F
              <input type="number" min={1} className="h-9 w-14 rounded-field border bg-elevated px-2 text-sm" value={f.count} onChange={(e) => setFlows(flows.map((x, j) => (j === k ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x)))} aria-label={`F${k + 1}`} />
            </label>
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-pill px-3 py-1 text-xs font-medium text-primary hover:bg-primary/[0.08]" onClick={() => setFlows([...flows, { amount: 0, count: 1 }])}>
          Add cash flow
        </button>
        {flows.length > 1 && (
          <button type="button" className="rounded-pill px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/[0.08]" onClick={() => setFlows(flows.slice(0, -1))}>
            Remove last
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          I (% per period)
          <input type="number" className="h-9 w-24 rounded-field border bg-elevated px-2 text-sm" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </label>
        <Result label="NPV" value={npvValue} send={send} />
        <Result label="IRR %" value={irrValue} send={send} />
      </div>
    </div>
  );
}

function Amort({ tvm, p1, p2, setP1, setP2, send }: { tvm: CalcState["tvm"]; p1: number; p2: number; setP1: (v: number) => void; setP2: (v: number) => void; send: (v: number) => void }) {
  let res: ReturnType<typeof amortize> | null = null;
  try {
    res = amortize(tvm, p1, p2);
  } catch {
    res = null;
  }
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      {[
        ["P1", p1, setP1],
        ["P2", p2, setP2],
      ].map(([label, value, set]) => (
        <label key={label as string} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {label as string}
          <input type="number" min={1} className="h-9 w-20 rounded-field border bg-elevated px-2 text-sm" value={value as number} onChange={(e) => (set as (v: number) => void)(Math.max(1, Math.floor(Number(e.target.value)) || 1))} />
        </label>
      ))}
      <Result label="BAL" value={res?.BAL ?? null} send={send} />
      <Result label="PRN" value={res?.PRN ?? null} send={send} />
      <Result label="INT" value={res?.INT ?? null} send={send} />
    </div>
  );
}
