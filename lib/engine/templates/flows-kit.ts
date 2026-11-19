/**
 * Cash-flow valuation kit for the mixed present-value families: streams made
 * of level or geometric segments (finite or perpetual, every period or every
 * k periods) valued under a schedule of rate regimes (a rate that changes at
 * known dates, or a sequence of one-period forward rates).
 *
 * `valueOf` gives the closed form used as the answer's arithmetic; `modelOf`
 * gives an independent route (term-by-term discounting through the regimes,
 * with a perpetual tail in the classical R/(i − g) form). Distractor variants
 * reuse `valueOf` with one modelling decision changed.
 */
import { lit } from "./kit";

const L = lit;

/** Payments at times from, from+every, … (≤ to, or forever when to is null); the k-th payment is amount·(1+growth)^k. */
export interface Seg {
  from: number;
  to: number | null;
  amount: number;
  growth?: number;
  every?: number;
}

/** A rate per period in force up to time `until` (null = thereafter). Regimes are listed in time order. */
export interface Regime {
  until: number | null;
  rate: number;
}

export interface ValueOptions {
  /** Every payment discounted from time 0 at the rate in force on its own payment date. */
  byPaymentDate?: boolean;
  /** Perpetual pieces valued one period before their first payment, but not moved further back to time 0. */
  tailUndeferred?: boolean;
}

export interface Valued {
  value: number;
  expr: string;
}

function rateAt(regimes: Regime[], t: number): Regime {
  for (const r of regimes) if (r.until === null || t <= r.until + 1e-9) return r;
  return regimes[regimes.length - 1];
}

/** Discount factor from time t back to 0 through the regimes, value and expression. */
export function discount(regimes: Regime[], t: number): Valued {
  let value = 1;
  const parts: string[] = [];
  let start = 0;
  for (const r of regimes) {
    if (t <= start + 1e-9) break;
    const end = r.until === null ? t : Math.min(t, r.until);
    const span = end - start;
    if (span > 1e-9) {
      value *= Math.pow(1 + r.rate, -span);
      parts.push(`(1+${L(r.rate)})**(-(${L(span)}))`);
    }
    if (r.until === null || t <= r.until + 1e-9) break;
    start = r.until;
  }
  return { value, expr: parts.length ? parts.join("*") : "1" };
}

/** Pieces of a segment that fall inside single regimes: [first payment time, count (null = forever), regime]. */
function pieces(seg: Seg, regimes: Regime[]): Array<{ t0: number; count: number | null; k0: number; regime: Regime }> {
  const e = seg.every ?? 1;
  const out: Array<{ t0: number; count: number | null; k0: number; regime: Regime }> = [];
  let k = 0;
  let t = seg.from;
  while (seg.to === null || t <= seg.to + 1e-9) {
    const regime = rateAt(regimes, t);
    const hi = regime.until;
    if (hi === null) {
      if (seg.to === null) {
        out.push({ t0: t, count: null, k0: k, regime });
        break;
      }
      const count = Math.floor((seg.to - t) / e + 1e-9) + 1;
      out.push({ t0: t, count, k0: k, regime });
      break;
    }
    const last = seg.to === null ? hi : Math.min(hi, seg.to);
    const count = Math.floor((last - t) / e + 1e-9) + 1;
    if (count <= 0) break;
    out.push({ t0: t, count, k0: k, regime });
    k += count;
    t += count * e;
  }
  return out;
}

/** Closed-form value of a stream at time 0. */
export function valueOf(segs: Seg[], regimes: Regime[], opts: ValueOptions = {}): Valued {
  let value = 0;
  const exprs: string[] = [];
  for (const seg of segs) {
    const e = seg.every ?? 1;
    const g = seg.growth ?? 0;
    for (const p of pieces(seg, regimes)) {
      const r = p.regime.rate;
      const amt = seg.amount * Math.pow(1 + g, p.k0);
      const amtE = p.k0 ? `${L(seg.amount)}*(1+${L(g)})**${p.k0}` : L(seg.amount);
      const q = (1 + g) * Math.pow(1 + r, -e);
      const qE = `((1+${L(g)})*(1+${L(r)})**(-${e}))`;
      const sum = p.count === null ? 1 / (1 - q) : (1 - Math.pow(q, p.count)) / (1 - q);
      const sumE = p.count === null ? `(1/(1-${qE}))` : `((1-${qE}**${p.count})/(1-${qE}))`;
      let d: Valued;
      if (opts.byPaymentDate) d = { value: Math.pow(1 + r, -p.t0), expr: `(1+${L(r)})**(-(${L(p.t0)}))` };
      else if (opts.tailUndeferred && p.count === null) d = { value: Math.pow(1 + r, -e), expr: `(1+${L(r)})**(-${e})` };
      else d = discount(regimes, p.t0);
      value += amt * d.value * sum;
      exprs.push(`${amtE}*${d.expr}*${sumE}`);
    }
  }
  return { value, expr: exprs.join(" + ") };
}

/** Independent route: finite payments discounted one by one; perpetual pieces in the classical form. */
export function modelOf(segs: Seg[], regimes: Regime[]): string {
  const terms: string[] = [];
  for (const seg of segs) {
    const e = seg.every ?? 1;
    const g = seg.growth ?? 0;
    for (const p of pieces(seg, regimes)) {
      const r = p.regime.rate;
      if (p.count === null) {
        // Value one payment interval before the first payment: A/((1+r)^e − (1+g)), then discount to 0.
        const amtE = `${L(seg.amount)}*(1+${L(g)})**${p.k0}`;
        terms.push(`${amtE}/((1+${L(r)})**${e} - (1+${L(g)}))*${discount(regimes, p.t0 - e).expr}`);
      } else {
        for (let k = 0; k < p.count; k += 1) {
          const t = p.t0 + k * e;
          terms.push(`${L(seg.amount)}*(1+${L(g)})**${p.k0 + k}*${discount(regimes, t).expr}`);
        }
      }
    }
  }
  return terms.join(" + ");
}

/** The same stream with every payment moved by `shift` periods. */
export const shifted = (segs: Seg[], shift: number): Seg[] => segs.map((s) => ({ ...s, from: s.from + shift, to: s.to === null ? null : s.to + shift }));
