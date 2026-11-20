/**
 * Financial engine of the on-screen calculator, following the TI BA II Plus
 * conventions the SOA allows in the exam:
 *
 *   PV·(1+i)^N + PMT·(1+i·k)·s(N, i) + FV = 0      (cash-flow sign convention)
 *
 * where i is the rate per payment period derived from I/Y, P/Y and C/Y, k = 1
 * in BGN mode and 0 in END mode, and s(N, i) = ((1+i)^N − 1)/i.
 */

export type TvmKey = "N" | "IY" | "PV" | "PMT" | "FV";

export interface TvmRegisters {
  N: number;
  IY: number;
  PV: number;
  PMT: number;
  FV: number;
  /** Payments per year (P/Y) and compounding periods per year (C/Y). */
  PY: number;
  CY: number;
  /** Payments at the beginning of each period. */
  bgn: boolean;
}

export const TVM_DEFAULTS: TvmRegisters = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0, PY: 1, CY: 1, bgn: false };

export class CalcError extends Error {}

/** Effective rate per payment period from I/Y (percent per year), P/Y and C/Y. */
export function periodRate(r: Pick<TvmRegisters, "IY" | "PY" | "CY">): number {
  return Math.pow(1 + r.IY / 100 / r.CY, r.CY / r.PY) - 1;
}

/** I/Y (percent per year) that corresponds to a rate per payment period. */
function annualFromPeriod(i: number, r: Pick<TvmRegisters, "PY" | "CY">): number {
  return 100 * r.CY * (Math.pow(1 + i, r.PY / r.CY) - 1);
}

/** Value of the TVM equation at rate i per period (zero when the registers balance). */
function balance(r: TvmRegisters, i: number, n = r.N): number {
  const k = r.bgn ? 1 : 0;
  if (Math.abs(i) < 1e-12) return r.PV + r.PMT * n + r.FV;
  const g = Math.pow(1 + i, n);
  return r.PV * g + r.PMT * (1 + i * k) * ((g - 1) / i) + r.FV;
}

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let flo = f(lo);
  for (let k = 0; k < 300; k += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-13 || hi - lo < 1e-15) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Root of f on [lo, hi], scanning for a sign change first. */
function findRoot(f: (x: number) => number, lo: number, hi: number, steps = 400): number {
  let prevX = lo;
  let prev = f(lo);
  for (let s = 1; s <= steps; s += 1) {
    const x = lo + ((hi - lo) * s) / steps;
    const y = f(x);
    if (Number.isFinite(prev) && Number.isFinite(y) && Math.sign(y) !== Math.sign(prev)) return bisect(f, prevX, x);
    if (y === 0) return x;
    prevX = x;
    prev = y;
  }
  throw new CalcError("No solution");
}

/** Solves the TVM equation for one register (the BA II Plus CPT key). */
export function computeTvm(r: TvmRegisters, target: TvmKey): number {
  const i = periodRate(r);
  const k = r.bgn ? 1 : 0;
  const zero = Math.abs(i) < 1e-12;
  const g = Math.pow(1 + i, r.N);
  const s = zero ? r.N : (g - 1) / i;
  switch (target) {
    case "FV":
      return -(r.PV * g + r.PMT * (1 + i * k) * s);
    case "PV":
      return -(r.FV + r.PMT * (1 + i * k) * s) / g;
    case "PMT":
      if (s === 0) throw new CalcError("No solution");
      return -(r.PV * g + r.FV) / ((1 + i * k) * s);
    case "N": {
      if (zero) {
        if (r.PMT === 0) throw new CalcError("No solution");
        return -(r.PV + r.FV) / r.PMT;
      }
      const a = (r.PMT * (1 + i * k)) / i;
      const ratio = (a - r.FV) / (r.PV + a);
      if (!(ratio > 0)) throw new CalcError("No solution");
      return Math.log(ratio) / Math.log(1 + i);
    }
    case "IY": {
      const root = findRoot((x) => balance(r, x), -0.99, 5, 2000);
      return annualFromPeriod(root, r);
    }
  }
}

export interface CashFlow {
  amount: number;
  /** Number of consecutive periods with this amount (F01, F02, … on the calculator). */
  count: number;
}

/** Net present value at I% per period of CF0 followed by grouped cash flows. */
export function npv(ratePercent: number, cf0: number, flows: readonly CashFlow[]): number {
  const v = 1 / (1 + ratePercent / 100);
  let t = 0;
  let total = cf0;
  for (const f of flows) {
    for (let c = 0; c < f.count; c += 1) {
      t += 1;
      total += f.amount * Math.pow(v, t);
    }
  }
  return total;
}

/** Internal rate of return (percent per period). */
export function irr(cf0: number, flows: readonly CashFlow[]): number {
  const root = findRoot((x) => npv(100 * x, cf0, flows), -0.99, 5, 4000);
  return 100 * root;
}

export interface AmortResult {
  /** Balance after payment P2. */
  BAL: number;
  /** Principal and interest over payments P1..P2, with the sign convention of PMT. */
  PRN: number;
  INT: number;
}

/** The BA II Plus AMORT worksheet: payments P1 through P2 of the loan in the TVM registers. */
export function amortize(r: TvmRegisters, p1: number, p2: number): AmortResult {
  if (!(p1 >= 1 && p2 >= p1)) throw new CalcError("Invalid range");
  const i = periodRate(r);
  let bal = r.PV;
  let prn = 0;
  let int = 0;
  for (let k = 1; k <= p2; k += 1) {
    // END: interest accrues over the period, then the payment. BGN: the payment comes
    // first (the first one carries no interest), then interest accrues on what remains.
    const interest = r.bgn ? (k === 1 ? 0 : bal * i) : bal * i;
    bal = bal + interest + r.PMT;
    if (k >= p1) {
      prn += r.PMT + interest;
      int -= interest;
    }
  }
  return { BAL: bal, PRN: prn, INT: int };
}
