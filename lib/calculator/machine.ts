/**
 * Key-by-key behaviour of the on-screen calculator, modelled on the TI BA II
 * Plus in its default chain (Chn) mode: operations are applied left to right
 * as they are entered; TVM keys store the display (or, after CPT, compute);
 * STO/RCL with a digit use memories 0–9; 2nd selects the secondary function.
 *
 * Pure and serialisable, so it is unit-tested and its state can be saved with
 * the session.
 */
import { CalcError, computeTvm, TVM_DEFAULTS, type TvmKey, type TvmRegisters } from "./finance";

export type BinaryOp = "+" | "-" | "*" | "/" | "pow";
export type UnaryFn = "sq" | "sqrt" | "inv" | "ln" | "exp" | "pct" | "fact";

export type Key =
  | { kind: "digit"; d: number }
  | { kind: "dot" }
  | { kind: "sign" }
  | { kind: "op"; op: BinaryOp }
  | { kind: "equals" }
  | { kind: "unary"; fn: UnaryFn }
  | { kind: "ce" }
  | { kind: "clear" }
  | { kind: "backspace" }
  | { kind: "second" }
  | { kind: "sto" }
  | { kind: "rcl" }
  | { kind: "cpt" }
  | { kind: "tvm"; reg: TvmKey }
  | { kind: "clrTvm" }
  | { kind: "bgn" }
  | { kind: "xpy" }
  | { kind: "setPeriods"; py: number; cy: number }
  | { kind: "setValue"; value: number };

export const DECIMAL_CHOICES = [2, 4, 6, 9] as const;
export type Decimals = (typeof DECIMAL_CHOICES)[number];

export interface CalcState {
  /** Text being typed, or null when the display shows a result. */
  entry: string | null;
  /** The value on the display. */
  x: number;
  acc: number | null;
  pending: BinaryOp | null;
  second: boolean;
  /** Waiting for a digit (STO/RCL) or a TVM key (CPT). */
  awaiting: "sto" | "rcl" | "cpt" | null;
  tvm: TvmRegisters;
  memory: number[];
  /** Label shown beside the value: "PMT=", "Error 5", "BGN" … */
  label: string | null;
  error: boolean;
}

export const INITIAL_STATE: CalcState = {
  entry: null,
  x: 0,
  acc: null,
  pending: null,
  second: false,
  awaiting: null,
  tvm: { ...TVM_DEFAULTS },
  memory: Array.from({ length: 10 }, () => 0),
  label: null,
  error: false,
};

export const TVM_LABELS: Record<TvmKey, string> = { N: "N", IY: "I/Y", PV: "PV", PMT: "PMT", FV: "FV" };

const current = (s: CalcState): number => (s.entry !== null ? Number(s.entry === "-" || s.entry === "" ? 0 : s.entry) : s.x);

function apply(a: number, op: BinaryOp, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new CalcError("Error 2");
      return a / b;
    case "pow":
      return Math.pow(a, b);
  }
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 69) throw new CalcError("Error 2");
  let f = 1;
  for (let k = 2; k <= n; k += 1) f *= k;
  return f;
}

function unary(fn: UnaryFn, x: number): number {
  switch (fn) {
    case "sq":
      return x * x;
    case "sqrt":
      if (x < 0) throw new CalcError("Error 2");
      return Math.sqrt(x);
    case "inv":
      if (x === 0) throw new CalcError("Error 2");
      return 1 / x;
    case "ln":
      if (x <= 0) throw new CalcError("Error 2");
      return Math.log(x);
    case "exp":
      return Math.exp(x);
    case "pct":
      return x / 100;
    case "fact":
      return factorial(x);
  }
}

function result(s: CalcState, x: number, label: string | null = null): CalcState {
  if (!Number.isFinite(x)) return fail(s, "Error 1");
  return { ...s, x, entry: null, label, error: false };
}

function fail(s: CalcState, message: string): CalcState {
  return { ...s, x: 0, entry: null, acc: null, pending: null, awaiting: null, label: message, error: true };
}

/** Applies one key press. */
export function press(state: CalcState, key: Key): CalcState {
  // Any key other than 2nd consumes the 2nd prefix.
  const s: CalcState = key.kind === "second" ? state : { ...state, second: false };
  try {
    if (s.awaiting === "sto" || s.awaiting === "rcl") {
      if (key.kind === "digit") {
        if (s.awaiting === "sto") {
          const memory = [...s.memory];
          memory[key.d] = current(s);
          return { ...result(s, current(s), `STO ${key.d}`), memory, awaiting: null };
        }
        return { ...result(s, s.memory[key.d], `RCL ${key.d}`), awaiting: null };
      }
      if (key.kind === "tvm" && s.awaiting === "rcl") return { ...result(s, s.tvm[key.reg], `${TVM_LABELS[key.reg]}=`), awaiting: null };
      if (key.kind !== "second") return press({ ...s, awaiting: null }, key);
    }
    switch (key.kind) {
      case "digit": {
        const entry = s.entry === null || s.entry === "0" ? String(key.d) : s.entry === "-0" ? `-${key.d}` : s.entry.length >= 12 ? s.entry : s.entry + key.d;
        return { ...s, entry, label: null, error: false, awaiting: null };
      }
      case "dot":
        if (s.entry !== null && s.entry.includes(".")) return s;
        return { ...s, entry: s.entry === null ? "0." : `${s.entry}.`, label: null, error: false };
      case "sign":
        if (s.entry !== null) return { ...s, entry: s.entry.startsWith("-") ? s.entry.slice(1) : `-${s.entry}` };
        return result(s, -s.x, s.label);
      case "backspace":
        if (s.entry === null) return s;
        return { ...s, entry: s.entry.length > 1 && s.entry !== "-0" ? s.entry.slice(0, -1) : "0" };
      case "op": {
        const x = current(s);
        const value = s.pending !== null && s.acc !== null && s.entry !== null ? apply(s.acc, s.pending, x) : s.pending !== null && s.acc !== null && s.entry === null ? s.acc : x;
        return { ...result(s, value), acc: value, pending: key.op };
      }
      case "equals": {
        if (s.pending === null || s.acc === null) return result(s, current(s));
        return { ...result(s, apply(s.acc, s.pending, current(s))), acc: null, pending: null };
      }
      case "unary":
        return result(s, unary(key.fn, current(s)));
      case "ce":
        return { ...s, entry: null, x: 0, label: null, error: false };
      case "clear":
        return { ...s, entry: null, x: 0, acc: null, pending: null, awaiting: null, label: null, error: false };
      case "second":
        return { ...s, second: !s.second };
      case "sto":
        return { ...s, awaiting: "sto", label: "STO" };
      case "rcl":
        return { ...s, awaiting: "rcl", label: "RCL" };
      case "cpt":
        return { ...s, awaiting: "cpt", label: "CPT" };
      case "tvm": {
        if (s.awaiting === "cpt") {
          const value = computeTvm(s.tvm, key.reg);
          return { ...result(s, value, `${TVM_LABELS[key.reg]}=`), tvm: { ...s.tvm, [key.reg]: value }, awaiting: null };
        }
        const value = current(s);
        return { ...result(s, value, `${TVM_LABELS[key.reg]}=`), tvm: { ...s.tvm, [key.reg]: value } };
      }
      case "clrTvm":
        return { ...result(s, 0, "TVM cleared"), tvm: { ...TVM_DEFAULTS, PY: s.tvm.PY, CY: s.tvm.CY, bgn: s.tvm.bgn } };
      case "bgn":
        return { ...result(s, current(s), s.tvm.bgn ? "END" : "BGN"), tvm: { ...s.tvm, bgn: !s.tvm.bgn } };
      case "xpy":
        return result(s, current(s) * s.tvm.PY);
      case "setPeriods":
        return { ...s, tvm: { ...s.tvm, PY: key.py, CY: key.cy }, label: `P/Y=${key.py} C/Y=${key.cy}` };
      case "setValue":
        return result(s, key.value);
    }
  } catch (e) {
    return fail(s, e instanceof CalcError ? e.message : "Error");
  }
}

/** The display text: the entry as typed, or the value at the chosen number of decimals. */
export function displayText(s: CalcState, decimals: Decimals): string {
  if (s.error) return s.label ?? "Error";
  if (s.entry !== null) return s.entry;
  const x = Math.abs(s.x) < 1e-12 ? 0 : s.x;
  if (Math.abs(x) >= 1e10 || (x !== 0 && Math.abs(x) < 1e-6)) return x.toExponential(Math.min(decimals, 6));
  const fixed = x.toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}
