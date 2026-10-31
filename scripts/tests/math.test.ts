import {
  Da,
  Ia,
  acc,
  adue,
  amortize,
  an,
  balanceProsp,
  balanceRetro,
  bondPrice,
  bondSchedule,
  convexity,
  discToInt,
  effToNom,
  effToNomDisc,
  forwardRate,
  geometricPV,
  intToDisc,
  irr,
  levelPayment,
  macaulayDuration,
  nomDiscToEff,
  nomToEff,
  pvFlows,
  realRate,
  sdue,
  sn,
  solveRoot,
  v,
} from "../../lib/engine/finance";
import { evaluate, isEquation, lit, rootNear, solveEquation } from "../../lib/engine/expr";
import { createRng } from "../../lib/engine/random";
import { close, expect, test } from "./harness";

const rng = createRng("math-tests");
const draws = (count: number) =>
  Array.from({ length: count }, () => ({ i: rng.float(0.005, 0.15, 4), n: rng.int(1, 40), k: 0 })).map((d) => ({ ...d, k: rng.int(0, d.n) }));

const sum = (from: number, to: number, f: (t: number) => number) => {
  let total = 0;
  for (let t = from; t <= to; t += 1) total += f(t);
  return total;
};

test("annuity factors equal their explicit sums (property, 200 draws)", () => {
  for (const { i, n } of draws(200)) {
    close(an(n, i), sum(1, n, (t) => v(i, t)), `a(${n}) at ${i}`);
    close(adue(n, i), sum(0, n - 1, (t) => v(i, t)), `ä(${n}) at ${i}`);
    close(sn(n, i), sum(1, n, (t) => acc(i, n - t)), `s(${n}) at ${i}`);
    close(sdue(n, i), sum(1, n, (t) => acc(i, n - t + 1)), `s̈(${n}) at ${i}`);
  }
});

test("annuity-immediate versus annuity-due differ by exactly one period of interest", () => {
  for (const { i, n } of draws(100)) {
    close(adue(n, i), an(n, i) * (1 + i), "ä = (1 + i)a");
    close(sdue(n, i), sn(n, i) * (1 + i), "s̈ = (1 + i)s");
    close(adue(n, i), 1 + an(n - 1, i), "ä(n) = 1 + a(n − 1)");
    expect(adue(n, i) > an(n, i), "annuity-due is worth more");
  }
});

test("varying annuities equal their explicit sums", () => {
  for (const { i, n } of draws(100)) {
    close(Ia(n, i), sum(1, n, (t) => t * v(i, t)), "(Ia)");
    close(Da(n, i), sum(1, n, (t) => (n - t + 1) * v(i, t)), "(Da)");
    close(Ia(n, i) + Da(n, i), (n + 1) * an(n, i), "(Ia) + (Da) = (n + 1)a");
    const g = rng.float(-0.05, 0.1, 4);
    close(geometricPV(n, i, g), sum(1, n, (t) => Math.pow(1 + g, t - 1) * v(i, t)), `geometric at g = ${g}`, 1e-7);
  }
  close(geometricPV(Infinity, 0.06, 0.02), 1 / 0.04, "growing perpetuity");
});

test("rate conversions round-trip", () => {
  for (const m of [2, 4, 12]) {
    for (const i of [0.01, 0.05, 0.12]) {
      close(nomToEff(effToNom(i, m), m), i, `nominal interest m = ${m}`);
      close(nomDiscToEff(effToNomDisc(i, m), m), i, `nominal discount m = ${m}`);
    }
  }
  close(discToInt(intToDisc(0.07)), 0.07, "d ↔ i");
  close(realRate(0.08, 0.03), 1.08 / 1.03 - 1, "real rate");
});

test("loan amortization: schedule, retrospective and prospective balances agree", () => {
  for (const { i, n, k } of draws(120)) {
    const L = 100000;
    const P = levelPayment(L, n, i);
    const rows = amortize(L, i, Array.from({ length: n }, () => P));
    close(rows[n - 1].closing, 0, "loan fully repaid", 1e-7);
    if (k > 0) {
      close(balanceRetro(L, P, i, k), balanceProsp(P, i, n, k), `B_${k} retro = prosp`, 1e-7);
      close(rows[k - 1].closing, balanceProsp(P, i, n, k), `B_${k} schedule = prosp`, 1e-7);
      close(rows[k - 1].principal, P * v(i, n - k + 1), `principal in payment ${k}`, 1e-7);
      close(rows[k - 1].interest, i * rows[k - 1].opening, "interest on the opening balance");
    }
  }
});

test("refinancing: old balance at the old rate, re-amortized at the new rate", () => {
  const L = 200000;
  const n = 25;
  const k = 7;
  const i = 0.07;
  const j = 0.05;
  const P = levelPayment(L, n, i);
  const B = balanceProsp(P, i, n, k);
  const Q = B / an(n - k, j);
  const rows = amortize(B, j, Array.from({ length: n - k }, () => Q));
  close(rows[rows.length - 1].closing, 0, "new loan fully repaid", 1e-7);
  expect(Q < P, "a lower rate lowers the payment");
  const wrong = B / an(n - k + 1, j);
  expect(Math.abs(wrong - Q) / Q > 0.01, "an extra remaining period changes the payment materially");
});

test("bond price, book value and amortization", () => {
  for (let s = 0; s < 60; s += 1) {
    const F = 1000;
    const r = rng.float(0.01, 0.06, 4);
    const j = rng.float(0.01, 0.06, 4);
    const C = rng.choice([1000, 1050, 1100]);
    const n = rng.int(2, 40);
    const P = bondPrice(F, r, C, j, n);
    close(P, sum(1, n, (t) => F * r * v(j, t)) + C * v(j, n), "price = explicit cash flows");
    close(P, C + (F * r - C * j) * an(n, j), "premium/discount formula");
    const rows = bondSchedule(F, r, C, j, n);
    close(rows[n - 1].bookValue, C, "book value reaches redemption", 1e-7);
    const t = rng.int(1, n);
    close(rows[t - 1].amortization, (F * r - C * j) * v(j, n - t + 1), "write-down in coupon t", 1e-7);
  }
  close(bondPrice(1000, 0.04, 1000, 0.04, 20), 1000, "coupon = yield → par");
});

test("duration and convexity", () => {
  close(macaulayDuration([{ t: 7, amount: 500 }], 0.05), 7, "zero-coupon duration = maturity");
  const flows = [{ t: 1, amount: 60 }, { t: 2, amount: 60 }, { t: 3, amount: 1060 }];
  const i = 0.05;
  const h = 1e-5;
  const P = pvFlows(flows, i);
  const dP = (pvFlows(flows, i + h) - pvFlows(flows, i - h)) / (2 * h);
  const d2P = (pvFlows(flows, i + 1e-3) - 2 * P + pvFlows(flows, i - 1e-3)) / 1e-6;
  close(macaulayDuration(flows, i), (-(1 + i) * dP) / P, "D = −(1 + i)P′/P", 1e-6);
  close(convexity(flows, i), d2P / P, "C = P″/P", 1e-4);
});

test("forward rates satisfy no-arbitrage", () => {
  const s1 = 0.03;
  const s3 = 0.042;
  const f = forwardRate(s1, 1, s3, 3);
  close((1 + s1) * Math.pow(1 + f, 2), Math.pow(1 + s3, 3), "(1 + s1)(1 + f)² = (1 + s3)³");
});

test("equation solving", () => {
  const root = solveRoot((x) => x * x - 2, 0, 2);
  close(root, Math.SQRT2, "√2", 1e-12);
  const flows = [{ t: 0, amount: -1000 }, { t: 1, amount: 100 }, { t: 2, amount: 1100 }];
  close(irr(flows), 0.1, "IRR of a par bond", 1e-10);
});

test("expression evaluator agrees with JavaScript and finds roots", () => {
  close(evaluate("2**3**2"), 512, "right-associative powers");
  close(evaluate("-2**2"), -4, "unary minus binds looser than power");
  close(evaluate("(1+0.05)**(-10)"), Math.pow(1.05, -10), "discount factor");
  close(evaluate("exp(log(5))+sqrt(16)"), 9, "functions");
  close(evaluate(`${lit(1234.5678)}*2`), 2469.1356, "lit round-trips");
  expect(isEquation("x*2-4") && !isEquation("2*4"), "equation detection");
  expect(rootNear("x**2-2", Math.SQRT2), "root detected near √2");
  expect(!rootNear("x**2-2", 1.42), "non-root rejected");
  const roots = solveEquation("(x-1)*(x-3)", [0, 2]);
  expect(roots.length === 1 && Math.abs(roots[0] - 1) < 1e-9, "unique root on a bracket");
});
