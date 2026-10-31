/**
 * Deterministic financial mathematics.
 *
 * Every rate here is an effective rate per payment period unless a function
 * says otherwise. These closed forms are what templates use to compute their
 * answers; the validator checks each answer against a separately written
 * equation of value (`model`), so a slip in one of these functions cannot
 * silently become an answer key.
 */

export const v = (i: number, t: number): number => Math.pow(1 + i, -t);
export const acc = (i: number, t: number): number => Math.pow(1 + i, t);

// ---------------------------------------------------------------- rates

export const nomToEff = (rate: number, m: number): number => Math.pow(1 + rate / m, m) - 1;
export const effToNom = (i: number, m: number): number => m * (Math.pow(1 + i, 1 / m) - 1);
export const nomDiscToEff = (d: number, m: number): number => Math.pow(1 - d / m, -m) - 1;
export const effToNomDisc = (i: number, m: number): number => m * (1 - Math.pow(1 + i, -1 / m));
export const discToInt = (d: number): number => d / (1 - d);
export const intToDisc = (i: number): number => i / (1 + i);
export const force = (i: number): number => Math.log(1 + i);
/** Effective rate per period of length 1/m equivalent to annual effective i. */
export const perPeriod = (i: number, m: number): number => Math.pow(1 + i, 1 / m) - 1;
/** Real rate of interest given nominal i and inflation r. */
export const realRate = (i: number, r: number): number => (1 + i) / (1 + r) - 1;

// ---------------------------------------------------------------- annuities

export const an = (n: number, i: number): number => (Math.abs(i) < 1e-14 ? n : (1 - v(i, n)) / i);
export const adue = (n: number, i: number): number => an(n, i) * (1 + i);
export const sn = (n: number, i: number): number => (Math.abs(i) < 1e-14 ? n : (acc(i, n) - 1) / i);
export const sdue = (n: number, i: number): number => sn(n, i) * (1 + i);
export const perp = (i: number): number => 1 / i;
export const perpDue = (i: number): number => (1 + i) / i;

/** Payments 1, 2, ..., n at times 1..n. */
export const Ia = (n: number, i: number): number => (adue(n, i) - n * v(i, n)) / i;
/** Payments n, n-1, ..., 1 at times 1..n. */
export const Da = (n: number, i: number): number => (n - an(n, i)) / i;
/** Accumulated value at time n of payments 1, 2, ..., n at times 1..n. */
export const Is = (n: number, i: number): number => (sdue(n, i) - n) / i;

/**
 * Present value at time 0 of payments 1, (1+g), ..., (1+g)^(n-1) at times 1..n.
 * Pass `n = Infinity` for a growing perpetuity (requires g < i).
 */
export function geometricPV(n: number, i: number, g: number): number {
  if (!Number.isFinite(n)) return 1 / (i - g);
  if (Math.abs(i - g) < 1e-14) return n / (1 + i);
  return (1 - Math.pow((1 + g) / (1 + i), n)) / (i - g);
}

// ---------------------------------------------------------------- general cash flows

export type Flow = { t: number; amount: number };

export const pvFlows = (flows: readonly Flow[], i: number): number =>
  flows.reduce((sum, flow) => sum + flow.amount * v(i, flow.t), 0);

export const avFlows = (flows: readonly Flow[], i: number, at: number): number =>
  flows.reduce((sum, flow) => sum + flow.amount * acc(i, at - flow.t), 0);

export function macaulayDuration(flows: readonly Flow[], i: number): number {
  const price = pvFlows(flows, i);
  return flows.reduce((sum, flow) => sum + flow.t * flow.amount * v(i, flow.t), 0) / price;
}

export const modifiedDuration = (flows: readonly Flow[], i: number): number =>
  macaulayDuration(flows, i) / (1 + i);

/** Convexity as P''(i)/P(i): sum t(t+1) CF v^(t+2) / P. */
export function convexity(flows: readonly Flow[], i: number): number {
  const price = pvFlows(flows, i);
  return flows.reduce((sum, flow) => sum + flow.t * (flow.t + 1) * flow.amount * v(i, flow.t + 2), 0) / price;
}

/** Macaulay convexity: sum t^2 CF v^t / P. */
export function macaulayConvexity(flows: readonly Flow[], i: number): number {
  const price = pvFlows(flows, i);
  return flows.reduce((sum, flow) => sum + flow.t * flow.t * flow.amount * v(i, flow.t), 0) / price;
}

/** Annual forward rate from time a to time b implied by spot rates s_a and s_b. */
export const forwardRate = (sa: number, a: number, sb: number, b: number): number =>
  Math.pow(Math.pow(1 + sb, b) / Math.pow(1 + sa, a), 1 / (b - a)) - 1;

// ---------------------------------------------------------------- loans

export const levelPayment = (loan: number, n: number, i: number): number => loan / an(n, i);

/** Retrospective balance just after the k-th payment. */
export const balanceRetro = (loan: number, payment: number, i: number, k: number): number =>
  loan * acc(i, k) - payment * sn(k, i);

/** Prospective balance just after the k-th of n level payments. */
export const balanceProsp = (payment: number, i: number, n: number, k: number): number =>
  payment * an(n - k, i);

export interface ScheduleRow {
  period: number;
  opening: number;
  interest: number;
  payment: number;
  principal: number;
  closing: number;
}

/** Period-by-period amortization schedule for an arbitrary sequence of payments. */
export function amortize(loan: number, i: number, payments: readonly number[]): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let balance = loan;
  payments.forEach((payment, index) => {
    const interest = balance * i;
    const principal = payment - interest;
    const closing = balance - principal;
    rows.push({ period: index + 1, opening: balance, interest, payment, principal, closing });
    balance = closing;
  });
  return rows;
}

// ---------------------------------------------------------------- bonds

/**
 * Price of a bond with face F, coupon rate r per period (paid on F), redemption
 * C, yield j per period and n coupon periods remaining.
 */
export const bondPrice = (F: number, r: number, C: number, j: number, n: number): number =>
  F * r * an(n, j) + C * v(j, n);

export interface BondRow {
  period: number;
  coupon: number;
  interest: number;
  amortization: number;
  bookValue: number;
}

/** Book-value schedule at the purchase yield. */
export function bondSchedule(F: number, r: number, C: number, j: number, n: number): BondRow[] {
  const rows: BondRow[] = [];
  let book = bondPrice(F, r, C, j, n);
  for (let k = 1; k <= n; k += 1) {
    const interest = book * j;
    const coupon = F * r;
    const amortization = coupon - interest;
    book -= amortization;
    rows.push({ period: k, coupon, interest, amortization, bookValue: book });
  }
  return rows;
}

// ---------------------------------------------------------------- solving

/**
 * Root of `f` on [lo, hi] by bisection, refined with the secant method.
 * Throws if the interval does not bracket a sign change.
 */
export function solveRoot(f: (x: number) => number, lo: number, hi: number, tolerance = 1e-13): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error(`No sign change on [${lo}, ${hi}].`);
  for (let step = 0; step < 300; step += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0 || (b - a) / 2 < tolerance * Math.max(1, Math.abs(mid))) return mid;
    if (fa * fm < 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** The rate per period at which the flows have zero net present value. */
export const irr = (flows: readonly Flow[], lo = -0.5, hi = 1): number =>
  solveRoot((rate) => pvFlows(flows, rate), lo, hi);
