/**
 * Elite (level 4) bond templates: callable bonds with several call windows
 * and non-par redemptions, leveraged purchases, stepped coupons and book
 * values, Makeham inversions from two prices, realised horizon yields,
 * amortisation-schedule inversions and geometric coupons. Each template has
 * two cases.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import { MONEY2, amt, drawUntil, gridAmount, gridRate, ord, pc, step } from "./kit";
import { K, X, add, an, at, div, elite, geoA, mul, nameOf, pick, pow, rootOf, sn, sub, sum, vt, type Eq } from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const pct = (x: number) => pc(x, 3);
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));
/** Bond price per period rate j: coupon c for n periods, redemption C. */
const price = (c: number | X, C: number | X, j: number | X, n: number): X => add(mul(c, an(j, n)), mul(C, vt(j, n)));
const explicitPrice = (c: number, C: number, j: X | number, n: number): X => add(flows(n, (k) => mul(c, vt(j, k + 1))), mul(C, vt(j, n)));

// ===================================================================== 1. Callable bond with two call windows and non-par redemptions

const multiCall: QuestionTemplate = {
  id: "el-bond-multi-call",
  family: "el-bond-multi-call",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.callable",
  secondary: ["BONDS.price_redemption", "BONDS.yield", "BONDS.terms"],
  reasoning: ["financial_intuition", "cashflow_modelling", "multistep", "validation"],
  soaConcept: "A bond callable in two windows at different call prices and redeemable at maturity at a third price: every boundary date must be checked for the investor's worst case.",
  generate(rng): QuestionDraft {
    const F = pick(rng, [1000, 5000, 10000]);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const N = rng.int(15, 25);
    const a1 = rng.int(5, 8);
    const b1 = a1 + rng.int(2, 4);
    const a2 = b1 + 1;
    const b2 = a2 + rng.int(2, 4);
    if (b2 >= N) throw new Error("Windows past maturity.");
    const prem = pick(rng, [[1.08, 1.04, 1.0], [1.06, 1.03, 1.02], [1.1, 1.05, 1.0], [1.05, 1.0, 1.04]] as const);
    const [C1, C2, C3] = prem.map((p) => F * p);
    const c = (F * r) / 2;
    const name = nameOf(rng);
    const kase = pick(rng, ["max-price", "min-yield"]);
    const candidates: Array<{ T: number; C: number; label: string }> = [];
    for (let h = 2 * a1; h <= 2 * b1; h += 1) candidates.push({ T: h, C: C1, label: "window 1" });
    for (let h = 2 * a2; h <= 2 * b2; h += 1) candidates.push({ T: h, C: C2, label: "window 2" });
    candidates.push({ T: 2 * N, C: C3, label: "maturity" });
    const story = `A ${N}-year bond with face amount ${amt(F)} pays coupons at a nominal annual rate of ${pct(r)} convertible semiannually. It may be called at the issuer's option on any coupon date from the end of year ${a1} to the end of year ${b1} at ${amt(C1)}, or on any coupon date from the end of year ${a2} to the end of year ${b2} at ${amt(C2)}. If not called, it is redeemed at the end of year ${N} at ${amt(C3)}.`;
    const worst = (j: number, cands = candidates) => cands.map((d) => ({ d, p: price(c, d.C, j, d.T) })).sort((x, y) => x.p.v - y.p.v)[0];
    if (kase === "max-price") {
      const y = gridRate(rng, 0.03, 0.09, 0.0025);
      const j = y / 2;
      const w = worst(j);
      const first = candidates[0];
      const lastW2 = candidates.filter((d) => d.label === "window 2").slice(-1)[0];
      const avg = div(sum(candidates.map((d) => price(c, d.C, j, d.T))), candidates.length);
      const atFace = price(c, F, j, w.d.T);
      return elite({
        stem: `${story}\n\nCalculate the maximum price ${name} can pay and still be certain of a yield of at least ${pct(y)} convertible semiannually.`,
        fmt: MONEY2,
        answer: w.p,
        model: explicitPrice(c, w.d.C, j, w.d.T),
        modelDescription: "Coupons and redemption at the worst-case date, discounted half-year by half-year.",
        traps: [
          { id: "CONC_BOND_CALL_IGNORED", value: price(c, C3, j, 2 * N), label: "held to maturity", method: "Priced the bond to maturity.", feedback: "The issuer calls when that is worst for the investor; every possible date must be checked." },
          { id: "MODEL_WRONG_CALL_DATE", value: price(c, first.C, j, first.T), label: "first call date", method: `Priced to the first call date (year ${a1}).`, feedback: "The earliest date is the worst case only when the bond is at a premium on every call price." },
          { id: "TIMING_VALUATION_DATE", value: price(c, lastW2.C, j, lastW2.T), label: "end of the second window", method: `Priced to the end of the second window (year ${b2}).`, feedback: "Compare the boundary dates of every window and maturity." },
          { id: "CONC_BOND_REDEMPTION_AS_FACE", value: atFace, label: "redemption at face", method: `Redeemed at ${amt(F)} at the worst date.`, feedback: `The call price on that date is ${amt(w.d.C)}.` },
          { id: "CONC_BOND_CALL_AVERAGE", value: avg, label: "average over call dates", method: "Averaged the prices over all possible dates.", feedback: "Take the minimum, not an average." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: worst(Math.pow(1 + y, 0.5) - 1).p, label: "yield used as annual effective", method: `Treated ${pct(y)} as annual effective.`, feedback: `The yield is convertible semiannually: ${pct(j)} per half-year.` },
        ],
        steps: [
          step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]),
          step("E.premium-discount", "Window 1: compare the coupon with j times the call price to see which end of the window is worst.", ["g_1", c / C1, "modified coupon rate, window 1"], ["c", "C_1"]),
          step("E.premium-discount", "Window 2 and maturity: same comparison.", ["g_2", c / C2, "modified coupon rate, window 2"], ["c", "C_2", "C_3"]),
          step("E.price", "Price at each boundary date.", ["P_{T}", w.p.v, "lowest boundary price"], ["candidates"]),
          step("E.callable", "The guaranteed-yield price is the minimum.", ["P", w.p.v, "maximum price"], ["P_T"]),
        ],
        methods: ["decomposition", "valuation_dates"],
        reasoning: "For each redemption price compare c with jC (premium → earliest date in the window is worst, discount → latest); price at each candidate date, and take the lowest.",
        intuition: "The investor must assume the issuer picks the date that is worst for the investor.",
        unknowns: [{ symbol: "$P$", meaning: "maximum price" }],
        relationships: ["$P = \\min_T\\,[c\\,a_{\\overline{T|}j} + C_T v^T]$"],
        conditions: ["Calls only on coupon dates in the windows."],
        valuationDate: "Time 0",
        modelChoice: "Minimum over boundary dates.",
        assumptions: ["The issuer acts against the investor."],
        principle: "Price a callable bond at the redemption date that gives the lowest price.",
        unusual: "Three different redemption prices across two windows and maturity.",
        misread: "Pricing only to maturity.",
        presentation: ["compare-streams", "valuation-date", "hidden-structure", "frequency"],
        features: { multipleValuationDates: true },
        params: { kase, F, r, N, a1, b1, a2, b2, C1, C2, C3 },
        route: "rate, window tests, boundary prices, minimum",
      });
    }
    const yTrue = gridRate(rng, 0.03, 0.09, 0.0025);
    const P = Math.round(worst(yTrue / 2).p.v * 100) / 100;
    const yieldAt = (d: { T: number; C: number }) => 2 * rootOf({ eq: (x: X) => sub(price(c, d.C, x, d.T), P), lo: 0.0001, hi: 0.5 });
    const ys = candidates.map((d) => ({ d, y: yieldAt(d) })).sort((a, b) => a.y - b.y);
    const w = ys[0];
    const eqAt = (d: { T: number; C: number }, scale = 2): Eq => ({ eq: (x: X) => sub(price(c, d.C, div(x, scale), d.T), P), lo: -0.2, hi: 0.8 });
    return elite({
      stem: `${story} ${name} buys the bond for ${amt(P)}.\n\nCalculate the minimum yield, convertible semiannually, ${name} is certain to earn.`,
      fmt: PCT3,
      answer: eqAt(w.d),
      model: { eq: (x: X) => sub(explicitPrice(c, w.d.C, div(x, 2), w.d.T), P), lo: -0.2, hi: 0.8 },
      modelDescription: "Yield equation at the worst-case date with each coupon written out.",
      traps: [
        { id: "CONC_BOND_CALL_IGNORED", value: eqAt({ T: 2 * N, C: C3 }), label: "yield to maturity", method: "Computed the yield to maturity.", feedback: "The issuer may call; take the lowest yield over all dates." },
        { id: "MODEL_WRONG_CALL_DATE", value: eqAt(candidates[0]), label: "yield to first call", method: `Used the first call date (year ${a1}).`, feedback: "Check every boundary date." },
        { id: "CONC_BOND_REDEMPTION_AS_FACE", value: eqAt({ T: w.d.T, C: F }), label: "redemption at face", method: `Redeemed at ${amt(F)}.`, feedback: `The call price at that date is ${amt(w.d.C)}.` },
        { id: "VAR_OTHER_UNKNOWN", value: K(Math.pow(1 + w.y / 2, 2) - 1), label: "annual effective yield", method: "Gave the annual effective yield.", feedback: "The question asks for the nominal yield convertible semiannually." },
        { id: "CONC_BOND_CALL_AVERAGE", value: K(ys.reduce((a, b) => a + b.y, 0) / ys.length), label: "average yield over dates", method: "Averaged the yields over possible dates.", feedback: "The guaranteed yield is the minimum." },
      ],
      steps: [
        step("E.premium-discount", "Is the bond at a premium or discount relative to each call price?", ["P - C", P - w.d.C, "premium over the worst-case redemption"], ["P", "C"]),
        step("E.price", "Yield equation at each boundary date.", ["y_T", w.y, "yield at the worst date"], ["candidates"], { rearranged: true }),
        step("E.callable", "The guaranteed yield is the smallest.", ["T^*", w.d.T / 2, "worst-case redemption year"], ["y_T"]),
        step("M.root-finding", "Solve the yield equation at that date.", ["y", w.y, "minimum guaranteed yield"], ["T^*"], { rearranged: true }),
      ],
      methods: ["numerical_root", "valuation_dates", "decomposition"],
      reasoning: "Solve the yield equation at each window boundary and at maturity; the guaranteed yield is the smallest of them.",
      intuition: "Paying a premium hurts most if redeemed early; a discount hurts most if redeemed late — with several call prices, check them all.",
      unknowns: [{ symbol: "$y$", meaning: "minimum guaranteed yield" }],
      relationships: ["$P = c\\,a_{\\overline{T|}j} + C_T v^T$ for each candidate T"],
      conditions: ["Calls only on coupon dates in the windows."],
      valuationDate: "Time 0",
      modelChoice: "Minimum yield over boundary dates.",
      assumptions: ["The issuer acts against the investor."],
      principle: "The guaranteed yield of a callable bond is the lowest yield over possible redemption dates.",
      unusual: "A redemption value at maturity that differs from both call prices.",
      misread: "Computing only the yield to maturity.",
      presentation: ["unknown-rate", "compare-streams", "valuation-date", "hidden-structure"],
      features: { multipleValuationDates: true },
      params: { kase, F, r, N, a1, b1, a2, b2, C1, C2, C3, P },
      route: "premium test, boundary yields, minimum, solve",
    });
  },
};

// ===================================================================== 2. Leveraged bond purchase

const leveraged: QuestionTemplate = {
  id: "el-bond-leveraged",
  family: "el-bond-leveraged",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.yield",
  secondary: ["LOANS.amortization", "ALM.rates_of_return", "BONDS.price_redemption"],
  reasoning: ["cashflow_modelling", "financial_intuition", "multistep", "algebra"],
  soaConcept: "A bond bought partly with borrowed money: the investor's net cash flows (coupons less loan payments, redemption less loan repayment) define the leveraged yield.",
  generate(rng): QuestionDraft {
    const F = pick(rng, [1000, 10000, 50000]);
    const n = rng.int(5, 12);
    const r = gridRate(rng, 0.05, 0.1, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.04, 0.09, 0.0025), (x) => Math.abs(x - r) >= 0.005);
    const C = F * pick(rng, [1, 1, 1.02, 1.05]);
    const kaseDraw = pick(rng, ["interest-only", "amortized"]);
    const alpha = kaseDraw === "amortized" ? pick(rng, [0.2, 0.25, 0.3, 0.4]) : pick(rng, [0.4, 0.5, 0.6, 0.7]);
    const ell = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => x < r - 0.005);
    const name = nameOf(rng);
    const kase = kaseDraw;
    const c = (F * r) / 2;
    const P = price(c, C, y / 2, 2 * n).v;
    const B = alpha * P;
    const own = P - B;
    const m = 2 * n;
    const story = `${name} buys a ${n}-year bond with face amount ${amt(F)}, coupons at a nominal annual rate of ${pct(r)} convertible semiannually and redemption value ${amt(C)}, at a price yielding ${pct(y)} convertible semiannually. ${name} pays ${pc(1 - alpha, 0)} of the price in cash and borrows the rest at a nominal annual rate of ${pct(ell)} convertible semiannually`;
    const netEq = (perPeriod: number, final: number, outlay: number, o: { annual?: boolean } = {}): Eq => ({
      eq: (x: X) => {
        const per = o.annual ? sub(pow(add(1, x), 0.5), 1) : div(x, 2);
        return sub(add(mul(perPeriod, an(per, m)), mul(final, vt(per, m))), outlay);
      },
      lo: -0.3,
      hi: 2,
    });
    if (kase === "interest-only") {
      const net = c - (B * ell) / 2;
      if (net <= 0) throw new Error("Negative net coupon.");
      return elite({
        stem: `${story}, paying only the interest each half-year and repaying the loan from the redemption proceeds at maturity.\n\nCalculate ${name}'s yield, convertible semiannually, on the cash invested.`,
        fmt: PCT3,
        answer: netEq(net, C - B, own),
        model: { eq: (x: X) => sub(add(flows(m, (k) => mul(c - (B * ell) / 2, vt(div(x, 2), k + 1))), mul(C - B, vt(div(x, 2), m))), own), lo: -0.3, hi: 2 },
        modelDescription: "Each half-year's coupon less loan interest, and the redemption less the loan, discounted at the unknown yield, equal the cash invested.",
        traps: [
          { id: "MODEL_REINVEST_AT_YIELD", value: K(y), label: "bond yield", method: "Gave the bond's own yield.", feedback: "Borrowing below the bond yield raises the yield on the cash invested." },
          { id: "TRANS_IGNORED_CONDITION", value: netEq(c, C - B, own), label: "loan interest ignored", method: "Left out the loan interest.", feedback: "Each coupon pays the loan interest first." },
          { id: "CONC_RETURN_ON_WRONG_BASE", value: netEq(net, C - B, P), label: "yield on the full price", method: "Used the full price as the outlay.", feedback: "Only the cash part of the price is invested by the investor." },
          { id: "VAR_OTHER_UNKNOWN", value: netEq(net, C - B, own, { annual: true }), label: "annual effective yield", method: "Gave the annual effective yield.", feedback: "The question asks for the nominal yield convertible semiannually." },
          { id: "ALG_SIGN_ERROR", value: netEq(c + (B * ell) / 2, C - B, own), label: "loan interest added", method: "Added the loan interest to the coupons.", feedback: "Loan interest is a cost." },
          { id: "TIMING_IGNORED_DEFERRAL", value: netEq(net, C, own), label: "loan never repaid", method: "Kept the whole redemption value.", feedback: "The loan is repaid from the redemption value." },
        ],
        steps: [
          step("E.price", "Price of the bond at its yield.", ["P", P, "bond price"], ["c", "C", "y"]),
          step("D.interest-component", "Loan and its half-yearly interest.", ["I_L", (B * ell) / 2, "loan interest per half-year"], ["P", "\\alpha", "\\ell"]),
          step("A.equation-of-value", "Net cash flows: coupon − interest each half-year; redemption − loan at maturity.", ["c_{net}", net, "net coupon"], ["c", "I_L"], { derived: true }),
          step("C.irr", "Yield equation on the cash invested.", ["P(1-\\alpha)", own, "cash invested"], ["c_net", "C - B"], { derived: true }),
          step("M.root-finding", "Solve.", ["y'", 0, "leveraged yield"], ["equation"], { rearranged: true }),
        ],
        methods: ["equation_construction", "numerical_root", "decomposition"],
        reasoning: "Price the bond, compute the loan and its interest, form the investor's net cash flows, and solve for the rate that equates them with the cash invested.",
        intuition: "Leverage magnifies the spread between the bond yield and the borrowing rate.",
        unknowns: [{ symbol: "$y'$", meaning: "leveraged yield" }],
        relationships: ["$P(1-\\alpha) = (c - \\alpha P\\ell/2)a_{\\overline{2n|}} + (C - \\alpha P)v^{2n}$"],
        conditions: ["Loan interest paid each half-year."],
        valuationDate: "Time 0",
        modelChoice: "Internal rate of return on net cash flows.",
        assumptions: ["No default."],
        principle: "The yield on equity uses only the investor's own cash flows.",
        unusual: "The bond yield and the equity yield differ.",
        misread: "Measuring the return on the full price.",
        presentation: ["unknown-rate", "combined-topics", "hidden-structure", "frequency"],
        params: { kase, F, n, r, y, C, alpha, ell },
        route: "price, loan interest, net flows, IRR",
      });
    }
    const Lpay = B / an(ell / 2, m).v;
    // A net coupon below zero is fine: one outlay, then flows that change sign once at most.
    const net = c - Lpay;
    return elite({
      stem: `${story}, repaying the loan by level payments each half-year over the life of the bond.\n\nCalculate ${name}'s yield, convertible semiannually, on the cash invested.`,
      fmt: PCT3,
      answer: netEq(net, C, own),
      model: { eq: (x: X) => sub(add(flows(m, (k) => mul(sub(c, div(B, an(ell / 2, m))), vt(div(x, 2), k + 1))), mul(C, vt(div(x, 2), m))), own), lo: -0.3, hi: 2 },
      modelDescription: "Each half-year's coupon less the loan payment, plus the redemption, discounted at the unknown yield, equal the cash invested.",
      traps: [
        { id: "MODEL_REINVEST_AT_YIELD", value: K(y), label: "bond yield", method: "Gave the bond's own yield.", feedback: "The investor's cash flows differ from the bond's." },
        { id: "TRANS_IGNORED_CONDITION", value: netEq(c, C, own), label: "loan payments ignored", method: "Left out the loan payments.", feedback: "Each coupon pays a loan instalment." },
        { id: "CONC_RETURN_ON_WRONG_BASE", value: netEq(net, C, P), label: "yield on the full price", method: "Used the full price as the outlay.", feedback: "Only the cash part is invested." },
        { id: "VAR_INTEREST_FOR_PRINCIPAL", value: netEq(c - (B * ell) / 2, C, own), label: "loan interest only deducted", method: "Deducted only the loan interest each half-year.", feedback: "The level loan payment includes principal." },
        { id: "VAR_OTHER_UNKNOWN", value: netEq(net, C, own, { annual: true }), label: "annual effective yield", method: "Gave the annual effective yield.", feedback: "Give the nominal yield convertible semiannually." },
      ],
      steps: [
        step("E.price", "Price of the bond.", ["P", P, "bond price"], ["c", "C", "y"]),
        step("D.loan-payment", "Level loan payment each half-year.", ["L_p", Lpay, "loan payment"], ["\\alpha P", "\\ell"]),
        step("A.equation-of-value", "Net cash flow each half-year.", ["c_{net}", net, "net coupon"], ["c", "L_p"], { derived: true }),
        step("C.irr", "Yield equation on the cash invested.", ["P(1-\\alpha)", own, "cash invested"], ["c_net", "C"], { derived: true }),
        step("M.root-finding", "Solve.", ["y'", 0, "leveraged yield"], ["equation"], { rearranged: true }),
      ],
      methods: ["equation_construction", "numerical_root", "decomposition"],
      reasoning: "Price the bond, find the level loan payment, form the net cash flows and solve for the yield on the cash invested.",
      intuition: "Amortising the loan uses up most of each coupon; the redemption is then all the investor's.",
      unknowns: [{ symbol: "$y'$", meaning: "leveraged yield" }],
      relationships: ["$P(1-\\alpha) = (c - L_p)a_{\\overline{2n|}} + Cv^{2n}$"],
      conditions: ["Loan amortised over the bond's life."],
      valuationDate: "Time 0",
      modelChoice: "IRR of net cash flows.",
      assumptions: ["No default."],
      principle: "The equity yield uses only the investor's own net cash flows.",
      unusual: "The financing is amortised rather than interest-only.",
      misread: "Deducting only the loan interest.",
      presentation: ["unknown-rate", "combined-topics", "hidden-structure", "frequency"],
      params: { kase, F, n, r, y, C, alpha, ell },
      route: "price, loan payment, net flows, IRR",
    });
  },
};

// ===================================================================== 3. Stepped coupons: book value and amortisation

const steppedCoupon: QuestionTemplate = {
  id: "el-bond-stepped-coupon",
  family: "el-bond-stepped-coupon",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.coupons", "BONDS.price_redemption"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "formula_selection"],
  soaConcept: "A bond whose coupon rate steps up part-way: book values come from the remaining cash flows, and each coupon's principal adjustment from the book value before it.",
  generate(rng): QuestionDraft {
    const F = pick(rng, [1000, 5000, 10000]);
    const n = 2 * rng.int(8, 15);
    const k = 2 * rng.int(2, n / 2 - 3);
    const r1 = gridRate(rng, 0.04, 0.08, 0.005);
    const r2 = r1 + pick(rng, [0.01, 0.015, 0.02, 0.03]);
    const C = F * pick(rng, [1, 1.02, 1.05, 1.1]);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => x < r1 - 0.0025);
    const j = y / 2;
    const name = nameOf(rng);
    const kase = pick(rng, ["one-coupon", "sum-over-range"]);
    const c1 = (F * r1) / 2;
    const c2 = (F * r2) / 2;
    const coupon = (t: number, level = false) => (level || t <= k ? c1 : c2);
    /** Book value after t coupons: value of the remaining coupons and redemption at j. */
    const bv = (t: number, o: { level?: boolean; CC?: number; jj?: number } = {}) => {
      const jj = o.jj ?? j;
      const CC = o.CC ?? C;
      if (o.level || t >= k) return price(coupon(t + 1, o.level), CC, jj, n - t);
      return add(mul(c1, an(jj, k - t)), mul(c2, an(jj, n - k), vt(jj, k - t)), mul(CC, vt(jj, n - t)));
    };
    const amort = (t: number, o: { level?: boolean; CC?: number; jj?: number; idx?: number; interest?: boolean } = {}) => {
      const b = bv(o.idx ?? t - 1, o);
      return o.interest ? mul(o.jj ?? j, b) : sub(coupon(t, o.level), mul(o.jj ?? j, b));
    };
    const explicitBV = (t: number) => add(flows(n - t, (q) => mul(coupon(t + q + 1), vt(j, q + 1))), mul(C, vt(j, n - t)));
    const story = `A ${n / 2}-year bond with face amount ${amt(F)} and redemption value ${amt(C)} pays semiannual coupons at a nominal annual rate of ${pct(r1)} for the first ${k / 2} years and ${pct(r2)} thereafter. ${name} buys it at a price to yield ${pct(y)} convertible semiannually and amortises it at that yield.`;
    if (kase === "one-coupon") {
      const t = drawUntil(() => rng.int(2, n - 2), (q) => q !== k + 1);
      const ans = amort(t);
      if (ans.v <= 0) throw new Error("Not a premium in this period.");
      return elite({
        stem: `${story}\n\nCalculate the amount by which the book value is written down with the ${ord(t)} coupon.`,
        fmt: MONEY2,
        answer: ans,
        model: sub(coupon(t), mul(j, explicitBV(t - 1))),
        modelDescription: "Coupon minus the yield times the book value after the previous coupon, that book value written as the remaining cash flows discounted one by one.",
        traps: [
          { id: "TIMING_BALANCE_INDEX", value: amort(t, { idx: t }), label: "book value after the coupon", method: `Used the book value after coupon ${t}.`, feedback: `Interest earned in coupon ${t} is on the book value after coupon ${t - 1}.` },
          { id: "MODEL_LEVEL_FOR_VARYING", value: amort(t, { level: true }), label: "first coupon rate throughout", method: `Used ${pct(r1)} coupons for the whole term.`, feedback: `The coupon rate rises to ${pct(r2)} after year ${k / 2}.` },
          { id: "CONC_BOND_REDEMPTION_AS_FACE", value: amort(t, { CC: F }), label: "redemption at face", method: `Redeemed at ${amt(F)}.`, feedback: `Redemption is at ${amt(C)}.` },
          { id: "VAR_INTEREST_FOR_PRINCIPAL", value: amort(t, { interest: true }), label: "interest earned", method: "Gave the interest earned in the coupon.", feedback: "The write-down is the coupon minus the interest earned." },
          { id: "RATE_ANNUAL_FOR_PERIODIC", value: amort(t, { jj: Math.pow(1 + y, 0.5) - 1 }), label: "yield treated as annual effective", method: `Treated ${pct(y)} as annual effective.`, feedback: `The yield is convertible semiannually: ${pct(j)} per half-year.` },
        ],
        steps: [
          step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]),
          step("E.book-value", `Book value after coupon ${t - 1}: remaining coupons (in two levels) and redemption.`, ["BV", bv(t - 1).v, `book value after coupon ${t - 1}`], ["c_1", "c_2", "C", "j"]),
          step("D.interest-component", "Interest earned in the period.", ["I", mul(j, bv(t - 1)).v, "interest earned"], ["BV", "j"]),
          step("E.bond-amortization", "Write-down = coupon − interest earned.", ["PA", ans.v, "write-down of book value"], ["c_t", "I"]),
        ],
        methods: ["decomposition", "valuation_dates"],
        reasoning: "Book value is the value of what is left; the write-down with a coupon is the coupon minus the yield on the previous book value.",
        intuition: "With stepped coupons the shortcut $(Fr - Cj)v^{n-t+1}$ fails — go back to the book value.",
        unknowns: [{ symbol: "$PA_t$", meaning: `write-down with coupon ${t}` }],
        relationships: ["$PA_t = c_t - j\\,BV_{t-1}$"],
        conditions: [`Coupons change after year ${k / 2}.`],
        valuationDate: `Coupon ${t - 1}`,
        modelChoice: "Prospective book value with two coupon levels.",
        assumptions: ["Amortised at the purchase yield."],
        principle: "For any bond, interest earned = yield × previous book value; the rest of the coupon adjusts book value.",
        unusual: "A step-up coupon makes the usual amortisation formula invalid.",
        misread: "Using the book value after the coupon.",
        presentation: ["hidden-structure", "valuation-date", "frequency", "mixed-timing"],
        features: { multipleValuationDates: true },
        params: { kase, F, n, k, r1, r2, C, y, t },
        route: "rate, book value, interest, write-down",
      });
    }
    const t1 = rng.int(2, n - 6);
    const t2 = t1 + rng.int(3, 6);
    const total = (o: { level?: boolean; CC?: number; jj?: number; shift?: number } = {}) => sub(bv(t1 - 1 + (o.shift ?? 0), o), bv(t2 + (o.shift ?? 0), o));
    const ans = total();
    if (ans.v <= 0) throw new Error("Not a net write-down.");
    return elite({
      stem: `${story}\n\nCalculate the total write-down of book value over coupons ${t1} through ${t2} inclusive.`,
      fmt: MONEY2,
      answer: ans,
      model: sub(explicitBV(t1 - 1), explicitBV(t2)),
      modelDescription: "Book value before the first of those coupons minus book value after the last, each written as remaining cash flows discounted one by one.",
      traps: [
        { id: "TIMING_BALANCE_INDEX", value: total({ shift: 1 }), label: "range shifted by one coupon", method: `Used book values after coupons ${t1} and ${t2 + 1}.`, feedback: `The range starts with coupon ${t1}: use the book value after coupon ${t1 - 1}.` },
        { id: "MODEL_LEVEL_FOR_VARYING", value: total({ level: true }), label: "first coupon rate throughout", method: `Used ${pct(r1)} coupons throughout.`, feedback: `Coupons rise to ${pct(r2)} after year ${k / 2}.` },
        { id: "CONC_BOND_REDEMPTION_AS_FACE", value: total({ CC: F }), label: "redemption at face", method: `Redeemed at ${amt(F)}.`, feedback: `Redemption is at ${amt(C)}.` },
        { id: "RATE_ANNUAL_FOR_PERIODIC", value: total({ jj: Math.pow(1 + y, 0.5) - 1 }), label: "yield treated as annual effective", method: `Treated ${pct(y)} as annual effective.`, feedback: `Use ${pct(j)} per half-year.` },
        { id: "SEQ_TERM_COUNT", value: sub(bv(t1 - 1), bv(t2 - 1)), label: "one coupon short", method: `Stopped at coupon ${t2 - 1}.`, feedback: `The range includes coupon ${t2}.` },
      ],
      steps: [
        step("A.nominal-conversion", "Yield per half-year.", ["j", j, "semiannual yield"], ["y"]),
        step("E.book-value", `Book value after coupon ${t1 - 1}.`, ["BV_{a}", bv(t1 - 1).v, `book value after coupon ${t1 - 1}`], ["c_1", "c_2", "C"]),
        step("E.book-value", `Book value after coupon ${t2}.`, ["BV_{b}", bv(t2).v, `book value after coupon ${t2}`], ["c_1", "c_2", "C"]),
        step("E.bond-amortization", "Write-downs telescope: total = difference of book values.", ["\\sum PA", ans.v, "total write-down"], ["BV_a", "BV_b"], { derived: true }),
      ],
      methods: ["decomposition", "valuation_dates", "substitution"],
      reasoning: "Write-downs over a range of coupons add up to the fall in book value over that range, so compute two book values.",
      intuition: "Summing write-downs one by one is unnecessary: they telescope.",
      unknowns: [{ symbol: "$\\sum PA$", meaning: "total write-down" }],
      relationships: ["$\\sum_{t=a}^{b} PA_t = BV_{a-1} - BV_b$"],
      conditions: [`Coupons change after year ${k / 2}.`],
      valuationDate: `Coupons ${t1 - 1} and ${t2}`,
      modelChoice: "Telescoping book values.",
      assumptions: ["Amortised at the purchase yield."],
      principle: "Total principal adjustment over a range = change in book value.",
      unusual: "Stepped coupons with a telescoping sum.",
      misread: "Starting the range at the wrong book value.",
      presentation: ["hidden-structure", "valuation-date", "frequency", "multi-equation"],
      features: { multipleValuationDates: true },
      params: { kase, F, n, k, r1, r2, C, y, t1, t2 },
      route: "rate, two book values, telescope",
    });
  },
};

// ===================================================================== 4. Makeham inversion from two prices

const makehamInverse: QuestionTemplate = {
  id: "el-bond-makeham-inverse",
  family: "el-bond-makeham-inverse",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.coupons", "BONDS.terms", "BONDS.yield"],
  reasoning: ["algebra", "simultaneous_equations", "multistep", "formula_reconstruction"],
  soaConcept: "Two bonds with the same redemption value and modified coupon rate, priced at one yield, determine both unknowns through Makeham's formula.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const j = Math.pow(1 + i, 0.5) - 1;
    const C = gridAmount(rng, 1000, 5000, 50);
    const g = drawUntil(() => gridRate(rng, 0.015, 0.05, 0.0025), (x) => Math.abs(x - j) >= 0.004);
    const n1 = 2 * rng.int(4, 10);
    const n2 = n1 + 2 * rng.int(3, 8);
    const name = nameOf(rng);
    const kase = pick(rng, ["coupon", "redemption"]);
    const P = (n: number) => C * (Math.pow(1 + j, -n) + (g / j) * (1 - Math.pow(1 + j, -n)));
    const P1 = Math.round(P(n1) * 100) / 100;
    const P2 = Math.round(P(n2) * 100) / 100;
    /** Solve P_k = C v^{n_k} + D (1 − v^{n_k}) for C and D = Cg/j. */
    const solveCD = (jj: number | X, o: { n2?: number; years?: boolean } = {}) => {
      const v1 = vt(jj, o.years ? n1 / 2 : n1);
      const v2 = vt(jj, o.years ? n2 / 2 : o.n2 ?? n2);
      const det = sub(mul(v1, sub(1, v2)), mul(v2, sub(1, v1)));
      const Cx = div(sub(mul(P1, sub(1, v2)), mul(P2, sub(1, v1))), det);
      const Dx = div(sub(mul(v1, P2), mul(v2, P1)), det);
      return { Cx, Dx };
    };
    const want = (cd: { Cx: X; Dx: X }, jj: number | X, o: { inverted?: boolean } = {}) =>
      kase === "coupon" ? (o.inverted ? div(mul(cd.Cx, cd.Cx), mul(cd.Dx, jj, cd.Cx)) : mul(cd.Dx, jj)) : cd.Cx;
    const cd = solveCD(j);
    const ans = want(cd, j);
    const other = kase === "coupon" ? cd.Cx : mul(cd.Dx, j);
    // independent route: eliminate C between the two Makeham equations (ratio form)
    const v1 = Math.pow(1 + j, -n1);
    const v2 = Math.pow(1 + j, -n2);
    const ratioModel = (() => {
      // P1/P2 = (v1 + G(1−v1)) / (v2 + G(1−v2))  →  G, then C = P1/(v1 + G(1−v1))
      const G = div(sub(mul(P2, v1), mul(P1, v2)), sub(mul(P1, 1 - v2), mul(P2, 1 - v1)));
      const Cm = div(P1, add(v1, mul(G, 1 - v1)));
      return kase === "coupon" ? mul(Cm, G, j) : Cm;
    })();
    return elite({
      stem: `${name} compares two bonds that have the same redemption value and the same semiannual coupon amount, both priced to yield an annual effective rate of ${pct(i)}. Bond A matures in ${n1 / 2} years and costs ${amt(P1)}; Bond B matures in ${n2 / 2} years and costs ${amt(P2)}.\n\nCalculate ${kase === "coupon" ? "the semiannual coupon amount" : "the common redemption value"}.`,
      fmt: MONEY2,
      answer: ans,
      model: ratioModel,
      modelDescription: "Eliminate the redemption value by dividing the two Makeham equations, solve for g/j, then recover the unknown.",
      traps: [
        { id: "RATE_ANNUAL_FOR_PERIODIC", value: want(solveCD(i / 2), i / 2), label: "annual rate halved", method: `Used ${pct(i)}/2 per half-year.`, feedback: `The semiannual yield is $(1 + ${i})^{1/2} - 1$.` },
        { id: "VAR_OTHER_UNKNOWN", value: other, label: kase === "coupon" ? "redemption value" : "coupon amount", method: kase === "coupon" ? "Gave the redemption value." : "Gave the coupon amount.", feedback: `The question asks for ${kase === "coupon" ? "the coupon" : "the redemption value"}.` },
        ...(kase === "coupon" ? [{ id: "CONC_BOND_COUPON_RATE_AS_MODIFIED" as const, value: mul(cd.Dx, i), label: "coupon from the annual yield", method: "Multiplied g/j-scaled value by the annual yield.", feedback: "In Makeham's formula g and j are both per coupon period." }] : []),
        { id: "CONC_PAR_ASSUMPTION", value: kase === "coupon" ? mul(cd.Cx, j) : cd.Dx, label: "bond assumed at par", method: kase === "coupon" ? "Took the coupon as Cj, as for a par bond." : "Took C as coupon divided by j, as for a par bond.", feedback: "Neither bond is priced at its redemption value, so g differs from j." },
        { id: "SEQ_TERM_COUNT", value: want(solveCD(j, { n2: n2 - 2 }), j), label: "term counted in years for one bond", method: `Used ${n2 - 2} periods for Bond B.`, feedback: `Bond B has ${n2} half-years.` },
        { id: "COMP_PERIODS_AS_YEARS", value: want(solveCD(j, { years: true }), j), label: "years used as periods", method: "Discounted by the number of years at the semiannual rate.", feedback: "Count half-years: the exponents are the numbers of coupons." },
      ],
      steps: [
        step("A.nominal-conversion", "Semiannual yield.", ["j", j, "semiannual yield"], ["i"]),
        step("E.makeham", "Makeham for Bond A: $P_A = Cv^{n_A} + \\frac{g}{j}C(1 - v^{n_A})$.", ["v^{n_A}", v1, "discount factor, Bond A"], ["C", "g", "j"], { derived: true }),
        step("E.makeham", "Makeham for Bond B.", ["v^{n_B}", v2, "discount factor, Bond B"], ["C", "g", "j"], { derived: true }),
        step("M.linear-system", "Two linear equations in C and Cg/j.", ["C", cd.Cx.v, "redemption value"], ["P_A", "P_B"], { rearranged: true }),
        step("E.price", kase === "coupon" ? "Coupon = j × (Cg/j)." : "Redemption value from the system.", ["X", ans.v, kase === "coupon" ? "semiannual coupon" : "redemption value"], ["C", "D"]),
      ],
      methods: ["simultaneous", "elimination", "substitution"],
      reasoning: "Makeham's formula is linear in C and in Cg/j; two prices give two linear equations; solve and read off the unknown.",
      intuition: "Same C and same coupon, different maturities: the difference in prices pins down both.",
      unknowns: [{ symbol: "$C, g$", meaning: "redemption value and modified coupon rate" }],
      relationships: ["$P = K + \\dfrac{g}{j}(C - K),\\ K = Cv^n$"],
      conditions: ["Same coupon and redemption value for both bonds."],
      valuationDate: "Time 0",
      modelChoice: "Two Makeham equations.",
      assumptions: ["Both bonds priced at the same yield."],
      principle: "Makeham's formula separates the redemption value from the coupon stream.",
      unusual: "The redemption value is unknown.",
      misread: "Using the annual yield in place of the semiannual one.",
      presentation: ["multi-equation", "inverse", "frequency", "hidden-structure"],
      params: { kase, i, n1, n2, P1, P2 },
      route: "rate, Makeham twice, linear system, read off",
    });
  },
};

// ===================================================================== 5. Realised yield over a horizon with reinvestment and sale

const horizonYield: QuestionTemplate = {
  id: "el-bond-horizon-yield",
  family: "el-bond-horizon-yield",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.yield", "BONDS.price_redemption", "ALM.rates_of_return"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "financial_intuition"],
  soaConcept: "A bond bought at one yield, coupons reinvested at another rate, and sold before maturity at a third yield: the realised annual return combines all three.",
  generate(rng): QuestionDraft {
    const F = pick(rng, [1000, 5000, 10000]);
    const n = rng.int(10, 20);
    const h = rng.int(3, n - 4);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const y = gridRate(rng, 0.03, 0.09, 0.0025);
    const ri = gridRate(rng, 0.02, 0.06, 0.0025);
    const name = nameOf(rng);
    const kase = pick(rng, ["realised", "sale-yield"]);
    const c = (F * r) / 2;
    const P = price(c, F, y / 2, 2 * n);
    const reinv = (rate: number) => mul(c, sn(rate / 2, 2 * h));
    const sale = (ys: number | X) => price(c, F, div(ys, 2), 2 * (n - h));
    const realised = (AV: X) => sub(pow(div(AV, P), 1 / h), 1);
    const story = `${name} buys a ${n}-year bond with face and redemption value ${amt(F)} and coupons at a nominal annual rate of ${pct(r)} convertible semiannually, at a price to yield ${pct(y)} convertible semiannually. Coupons are reinvested at a nominal annual rate of ${pct(ri)} convertible semiannually. ${name} sells the bond after ${h} years, immediately after a coupon`;
    if (kase === "realised") {
      const ys = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.0025), (x) => Math.abs(x - y) >= 0.01);
      const ans = realised(add(reinv(ri), sale(ys)));
      return elite({
        stem: `${story}, to a buyer who prices it to yield ${pct(ys)} convertible semiannually.\n\nCalculate ${name}'s annual effective rate of return over the ${h} years.`,
        fmt: PCT3,
        answer: ans,
        model: sub(pow(div(add(flows(2 * h, (k) => mul(c, at(ri / 2, 2 * h - k - 1))), explicitPrice(c, F, ys / 2, 2 * (n - h))), explicitPrice(c, F, y / 2, 2 * n)), 1 / h), 1),
        modelDescription: "Each coupon accumulated at the reinvestment rate; the sale price and purchase price written out coupon by coupon.",
        traps: [
          { id: "MODEL_REINVEST_AT_YIELD", value: realised(add(reinv(y), sale(ys))), label: "coupons reinvested at the purchase yield", method: `Reinvested at ${pct(y)}.`, feedback: `Coupons are reinvested at ${pct(ri)}.` },
          { id: "CONC_BOND_COUPONS_NOT_REINVESTED", value: realised(add(mul(c, 2 * h), sale(ys))), label: "coupons not reinvested", method: "Added the coupons without interest.", feedback: "Coupons earn interest until the sale." },
          { id: "CONC_BOND_REALIZED_EQUALS_YIELD", value: K(Math.pow(1 + y / 2, 2) - 1), label: "purchase yield", method: "Gave the purchase yield (annual effective).", feedback: "The realised return depends on reinvestment and the sale price." },
          { id: "MODEL_SINGLE_RATE", value: realised(add(reinv(ri), sale(y))), label: "sold at the purchase yield", method: `Priced the sale at ${pct(y)}.`, feedback: `The buyer prices it at ${pct(ys)}.` },
          { id: "VAR_OTHER_UNKNOWN", value: mul(2, sub(pow(div(add(reinv(ri), sale(ys)), P), 1 / (2 * h)), 1)), label: "nominal semiannual return", method: "Gave the nominal rate convertible semiannually.", feedback: "The question asks for the annual effective rate." },
        ],
        steps: [
          step("E.price", "Purchase price.", ["P", P.v, "purchase price"], ["c", "F", "y"]),
          step("C.reinvestment", "Coupons accumulated at the reinvestment rate.", ["S", reinv(ri).v, "accumulated coupons"], ["c", "r_i"]),
          step("E.price", "Sale price at the buyer's yield.", ["S_h", sale(ys).v, "sale price"], ["c", "F", "y_s"]),
          step("A.accumulation", "Total accumulated value.", ["AV", add(reinv(ri), sale(ys)).v, "total at sale"], ["S", "S_h"]),
          step("C.yield-rate", "Annual effective return.", ["R", ans.v, "realised annual return"], ["AV", "P"], { rearranged: true }),
        ],
        methods: ["valuation_dates", "decomposition", "rearrangement"],
        reasoning: "Price at purchase, accumulate the coupons at the reinvestment rate, price the sale at the buyer's yield, and solve P(1+R)^h = AV.",
        intuition: "Three rates play three roles: purchase price, reinvestment, sale price.",
        unknowns: [{ symbol: "$R$", meaning: "realised annual effective return" }],
        relationships: ["$P(1+R)^h = c\\,s_{\\overline{2h|}} + P_{sale}$"],
        conditions: ["Sale immediately after a coupon."],
        valuationDate: `Year ${h}`,
        modelChoice: "Accumulated value at the horizon.",
        assumptions: ["Reinvestment rate holds."],
        principle: "A realised return is the rate taking the price to everything received by the horizon.",
        unusual: "Three different rates.",
        misread: "Reinvesting at the purchase yield.",
        presentation: ["valuation-date", "mixed-timing", "frequency", "combined-topics"],
        features: { multipleValuationDates: true },
        params: { kase, F, n, h, r, y, ri, ys },
        route: "price, reinvest, sale price, total, return",
      });
    }
    const target = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => Math.abs(x - (Math.pow(1 + y / 2, 2) - 1)) >= 0.008);
    const needed = (o: { reinvAt?: number; noReinv?: boolean } = {}) => sub(mul(P, Math.pow(1 + target, h)), o.noReinv ? mul(c, 2 * h) : reinv(o.reinvAt ?? ri));
    const yEq = (o: Parameters<typeof needed>[0] & { annual?: boolean } = {}): Eq => ({ eq: (x: X) => sub(o.annual ? price(c, F, sub(pow(add(1, x), 0.5), 1), 2 * (n - h)) : sale(x), needed(o)), lo: -0.1, hi: 0.6 });
    return elite({
      stem: `${story}. ${name} wants an annual effective rate of return of ${pct(target)} over the ${h} years.\n\nCalculate the highest yield, convertible semiannually, at which the buyer can price the bond for ${name} to achieve this.`,
      fmt: PCT3,
      answer: yEq(),
      model: { eq: (x: X) => sub(add(flows(2 * h, (k) => mul(c, at(ri / 2, 2 * h - k - 1))), explicitPrice(c, F, div(x, 2), 2 * (n - h))), mul(explicitPrice(c, F, y / 2, 2 * n), Math.pow(1 + target, h))), lo: -0.1, hi: 0.6 },
      modelDescription: "Accumulated coupons plus the sale price (written out) equal the purchase price grown at the target return.",
      traps: [
        { id: "MODEL_REINVEST_AT_YIELD", value: yEq({ reinvAt: y }), label: "coupons reinvested at the purchase yield", method: `Reinvested at ${pct(y)}.`, feedback: `Coupons are reinvested at ${pct(ri)}.` },
        { id: "CONC_BOND_COUPONS_NOT_REINVESTED", value: yEq({ noReinv: true }), label: "coupons not reinvested", method: "Added the coupons without interest.", feedback: "Coupons earn interest until the sale." },
        { id: "VAR_OTHER_UNKNOWN", value: yEq({ annual: true }), label: "annual effective sale yield", method: "Gave the sale yield as annual effective.", feedback: "Give it convertible semiannually." },
        { id: "CONC_BOND_REALIZED_EQUALS_YIELD", value: K(2 * (Math.pow(1 + target, 0.5) - 1)), label: "target return as the sale yield", method: "Set the sale yield equal to the target return.", feedback: "The sale yield sets only the sale price." },
        { id: "TIMING_EXTRA_PERIOD", value: { eq: (x: X) => sub(sale(x), sub(mul(P, Math.pow(1 + target, h + 1)), reinv(ri))), lo: -0.1, hi: 0.6 }, label: "one year too many", method: `Grew the price ${h + 1} years.`, feedback: `The horizon is ${h} years.` },
      ],
      steps: [
        step("E.price", "Purchase price.", ["P", P.v, "purchase price"], ["c", "F", "y"]),
        step("A.accumulation", "Value needed at the horizon.", ["P(1+R)^h", P.v * Math.pow(1 + target, h), "value needed"], ["P", "R"]),
        step("C.reinvestment", "Coupons accumulated.", ["S", reinv(ri).v, "accumulated coupons"], ["c", "r_i"]),
        step("E.price", "Sale price needed.", ["S_h", needed().v, "sale price needed"], ["S"], { rearranged: true }),
        step("M.root-finding", "Yield that gives that sale price.", ["y_s", 0, "sale yield"], ["S_h"], { rearranged: true }),
      ],
      methods: ["work_backwards", "numerical_root", "valuation_dates"],
      reasoning: "Grow the price at the target, subtract the accumulated coupons to get the sale price needed, and solve the price formula for the yield.",
      intuition: "A higher sale yield means a lower sale price: the highest acceptable yield gives exactly the needed price.",
      unknowns: [{ symbol: "$y_s$", meaning: "highest sale yield" }],
      relationships: ["$P_{sale}(y_s) = P(1+R)^h - c\\,s_{\\overline{2h|}}$"],
      conditions: ["Sale immediately after a coupon."],
      valuationDate: `Year ${h}`,
      modelChoice: "Work backwards from the target.",
      assumptions: ["Reinvestment rate holds."],
      principle: "Price falls as yield rises: the maximum yield gives the minimum acceptable price.",
      unusual: "The unknown is the buyer's yield.",
      misread: "Setting the sale yield equal to the target.",
      presentation: ["work-backwards", "unknown-rate", "valuation-date", "frequency"],
      features: { multipleValuationDates: true },
      params: { kase, F, n, h, r, y, ri, target },
      route: "price, target value, reinvest, sale price, solve yield",
    });
  },
};

// ===================================================================== 6. Two amortisation amounts reveal the yield

const amortInverse: QuestionTemplate = {
  id: "el-bond-amort-inverse",
  family: "el-bond-amort-inverse",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.amortization",
  secondary: ["BONDS.price_redemption", "BONDS.coupons", "BONDS.yield"],
  reasoning: ["algebra", "formula_reconstruction", "multistep", "translation"],
  soaConcept: "Premium amortised in two coupons grows by (1 + j) per period, which reveals the yield; one amortisation amount then gives Fr − Cj and the price.",
  generate(rng): QuestionDraft {
    const n = 2 * rng.int(8, 15);
    const C = pick(rng, [1000, 1000, 1050, 1100]);
    const F = 1000;
    const j = gridRate(rng, 0.02, 0.045, 0.0025);
    const r2 = drawUntil(() => gridRate(rng, 0.06, 0.14, 0.005) / 2, (x) => F * x - C * j >= 15);
    const D = F * r2 - C * j;
    const t1 = rng.int(2, 8);
    const t2 = t1 + rng.int(3, 8);
    const A1 = Math.round(D * Math.pow(1 + j, -(n - t1 + 1)) * 100) / 100;
    const A2 = Math.round(D * Math.pow(1 + j, -(n - t2 + 1)) * 100) / 100;
    const kase = pick(rng, ["price", "coupon-rate"]);
    const jOf = (o: { extra?: number; inverted?: boolean } = {}) => (o.inverted ? sub(pow(A1 / A2, 1 / (t2 - t1 + (o.extra ?? 0))), 1) : sub(pow(A2 / A1, 1 / (t2 - t1 + (o.extra ?? 0))), 1));
    const DOf = (jj: X, o: { idx?: number } = {}) => mul(A1, at(jj, o.idx ?? n - t1 + 1));
    const priceOf = (jj: X, o: { idx?: number; term?: number; CC?: number } = {}) => add(o.CC ?? C, mul(DOf(jj, o), an(jj, o.term ?? n)));
    const jx = jOf();
    const ans = kase === "price" ? priceOf(jx) : mul(2, div(add(mul(C, jx), DOf(jx)), F));
    const stem = `A ${n / 2}-year bond with face amount ${amt(F)} and redemption value ${amt(C)} pays semiannual coupons and is bought to yield a constant rate. The premium amortised in the ${ord(t1)} coupon is ${amt(A1)} and the premium amortised in the ${ord(t2)} coupon is ${amt(A2)}.\n\nCalculate ${kase === "price" ? "the purchase price" : "the nominal annual coupon rate convertible semiannually"}.`;
    const fmt = kase === "price" ? MONEY2 : PCT3;
    const of = (jj: X, o: { idx?: number; term?: number; CC?: number } = {}) => (kase === "price" ? priceOf(jj, o) : mul(2, div(add(mul(o.CC ?? C, jj), DOf(jj, o)), F)));
    const vModel = vt(jx, 1);
    // independent route: price as discounted coupons plus redemption, coupon from Cj + D
    const couponX = add(mul(C, jx), DOf(jx));
    const model = kase === "price" ? add(flows(n, (k) => mul(couponX, pow(vModel, k + 1))), mul(C, pow(vModel, n))) : div(mul(2, couponX), F);
    return elite({
      stem,
      fmt,
      answer: ans,
      model,
      modelDescription: kase === "price" ? "Coupon recovered as Cj + (Fr − Cj); price as each coupon and the redemption discounted one by one." : "Coupon recovered as Cj + (Fr − Cj), divided by face and annualised.",
      traps: [
        { id: "TIMING_EXTRA_PERIOD", value: of(jOf({ extra: 1 })), label: "growth exponent one too many", method: `Used exponent ${t2 - t1 + 1} for the ratio.`, feedback: `Between coupons ${t1} and ${t2} there are ${t2 - t1} periods.` },
        { id: "TIMING_BALANCE_INDEX", value: of(jx, { idx: n - t1 }), label: "discount power off by one", method: `Used $v^{${n - t1}}$ for coupon ${t1}.`, feedback: `$PA_t = (Fr - Cj)v^{n-t+1}$: the power is ${n - t1 + 1}.` },
        { id: "SEQ_TERM_COUNT", value: kase === "price" ? priceOf(jx, { term: n / 2 }) : mul(2, div(add(mul(C, jx), DOf(jx)), F * 2)), label: kase === "price" ? "term in years" : "coupon taken per year", method: kase === "price" ? `Used ${n / 2} periods.` : "Treated the semiannual coupon as annual.", feedback: kase === "price" ? `There are ${n} coupons.` : "Coupons are semiannual: annual nominal rate = 2 × coupon/F." },
        { id: "CONC_BOND_REDEMPTION_AS_FACE", value: of(jx, { CC: F }), label: "redemption at face", method: `Used ${amt(F)} as the redemption value.`, feedback: `Redemption is at ${amt(C)}.` },
        { id: "ALG_INVERTED_RATIO", value: of(jOf({ inverted: true })), label: "ratio inverted", method: "Divided the earlier amount by the later.", feedback: "Amortisation grows over time: later / earlier = $(1+j)^{t_2 - t_1}$." },
        kase === "coupon-rate"
          ? { id: "VAR_OTHER_UNKNOWN" as const, value: mul(2, jx), label: "yield rate", method: "Gave the nominal yield.", feedback: "The question asks for the coupon rate." }
          : { id: "VAR_OTHER_UNKNOWN" as const, value: mul(DOf(jx), an(jx, n)), label: "premium only", method: "Gave the premium $P - C$.", feedback: "The price is the redemption value plus the premium." },
      ],
      steps: [
        step("E.bond-amortization", "Ratio of the two amortisation amounts.", ["(1+j)^{t_2-t_1}", A2 / A1, "growth of amortisation"], ["PA_{t_1}", "PA_{t_2}"], { derived: true }),
        step("M.logarithm", "Semiannual yield.", ["j", jx.v, "semiannual yield"], ["ratio"], { rearranged: true }),
        step("E.bond-amortization", "Fr − Cj from one amount.", ["Fr - Cj", DOf(jx).v, "excess of coupon over Cj"], ["PA_{t_1}", "j"], { rearranged: true }),
        step(kase === "price" ? "E.premium-discount" : "E.price", kase === "price" ? "Premium/discount formula." : "Coupon = Cj + (Fr − Cj), then the annual nominal rate.", ["X", ans.v, kase === "price" ? "price" : "coupon rate"], ["C", "Fr - Cj", "j"]),
      ],
      methods: ["work_backwards", "logarithms", "substitution"],
      reasoning: "Amortisation amounts grow by (1 + j) each period, so their ratio gives j; one of them gives Fr − Cj; the premium/discount formula gives the price (or Cj + (Fr − Cj) the coupon).",
      intuition: "The amortisation schedule is a geometric sequence: two terms determine it.",
      unknowns: [{ symbol: "$j$", meaning: "semiannual yield" }],
      relationships: ["$PA_t = (Fr - Cj)v^{n-t+1}$", "$P = C + (Fr - Cj)a_{\\overline{n|}j}$"],
      conditions: ["Yield constant."],
      valuationDate: "Time 0",
      modelChoice: "Inversion of the amortisation schedule.",
      assumptions: ["Semiannual coupons."],
      principle: "Premium amortisation grows geometrically at the yield rate.",
      unusual: "The yield is not given.",
      misread: "Inverting the ratio.",
      presentation: ["work-backwards", "inverse", "hidden-structure", "multi-equation"],
      params: { kase, n, C, F, A1, A2, t1, t2 },
      route: "ratio, yield, excess, price",
    });
  },
};

// ===================================================================== 7. Geometric coupons: interest earned or price under an annual yield

const geometricCoupon: QuestionTemplate = {
  id: "el-bond-geometric-coupon",
  family: "el-bond-geometric-coupon",
  topic: "BONDS",
  levels: [4],
  objective: "BONDS.book_market",
  secondary: ["BONDS.coupons", "ANNUITIES.geometric", "BONDS.price_redemption"],
  reasoning: ["cashflow_modelling", "formula_selection", "multistep", "valuation_dates"],
  soaConcept: "Coupons that grow geometrically: the price is a geometric annuity plus the redemption, and the book value at any date is the value of what is left.",
  generate(rng): QuestionDraft {
    const n = rng.int(10, 20);
    const c1 = gridAmount(rng, 30, 80, 5);
    const g = pick(rng, [0.01, 0.015, 0.02, 0.025, 0.03]);
    const C = pick(rng, [1000, 1000, 1100, 1200]);
    const name = nameOf(rng);
    const kase = pick(rng, ["interest-earned", "semiannual-price"]);
    if (kase === "interest-earned") {
      const j = drawUntil(() => gridRate(rng, 0.04, 0.09, 0.0025), (x) => Math.abs(x - g) >= 0.01);
      const t = rng.int(3, n - 3);
      const bv = (tt: number, o: { grown?: boolean; level?: boolean; noC?: boolean } = {}) => {
        const first = c1 * Math.pow(1 + g, tt + (o.grown ? 1 : 0));
        const stream = o.level ? mul(c1, an(j, n - tt)) : mul(first, geoA(j, g, n - tt));
        return o.noC ? stream : add(stream, mul(C, vt(j, n - tt)));
      };
      const earned = (o: Parameters<typeof bv>[1] & { idx?: number; coupon?: boolean } = {}) => (o.coupon ? K(c1 * Math.pow(1 + g, t)) : mul(j, bv(o.idx ?? t, o)));
      const ans = earned();
      return elite({
        stem: `A ${n}-year bond pays annual coupons, the first of ${amt(c1)} one year from now and each later coupon ${pc(g, 1)} larger than the one before. It is redeemed for ${amt(C)} at the end of year ${n}. ${name} buys it to yield an annual effective rate of ${pct(j)}.\n\nCalculate the interest earned by ${name} in year ${t + 1} on the book-value basis.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(j, add(flows(n - t, (k) => mul(c1 * Math.pow(1 + g, t + k), vt(j, k + 1))), mul(C, vt(j, n - t)))),
        modelDescription: "Yield times the book value after year t, that book value as the remaining coupons and redemption discounted one by one.",
        traps: [
          { id: "TIMING_BALANCE_INDEX", value: earned({ idx: t + 1 }), label: "book value one year later", method: `Used the book value at time ${t + 1}.`, feedback: `Interest in year ${t + 1} is on the book value at time ${t}.` },
          { id: "CONC_BOND_COUPON_AS_INTEREST", value: earned({ coupon: true }), label: "coupon as interest", method: "Took the coupon as the interest earned.", feedback: "Interest earned = yield × book value." },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: earned({ grown: true }), label: "remaining coupons grown once more", method: "Started the remaining coupons one step too high.", feedback: `The coupon at time ${t + 1} is ${amt(c1)}(1 + g)^${t}.` },
          { id: "MODEL_LEVEL_FOR_VARYING", value: earned({ level: true }), label: "level coupons", method: "Valued the coupons as level.", feedback: "The coupons grow geometrically." },
          { id: "CONC_IGNORED_REDEMPTION", value: earned({ noC: true }), label: "redemption left out", method: "Left the redemption value out of the book value.", feedback: "The book value includes the redemption value." },
        ],
        steps: [
          step("B.geometric-annuity", "Remaining coupons as a geometric annuity.", ["V_c", mul(c1 * Math.pow(1 + g, t), geoA(j, g, n - t)).v, "remaining coupons"], ["c_1", "g", "j"]),
          step("A.discount-factor", "Redemption discounted.", ["V_C", C * Math.pow(1 + j, -(n - t)), "redemption value"], ["C", "j"]),
          step("E.book-value", `Book value at time ${t}.`, ["BV_t", bv(t).v, `book value at time ${t}`], ["V_c", "V_C"]),
          step("D.interest-component", "Interest earned = yield × book value.", ["I", ans.v, "interest earned"], ["BV_t", "j"]),
        ],
        methods: ["geometric_series", "valuation_dates", "decomposition"],
        reasoning: "Book value at time t is the remaining (growing) coupons plus the redemption, valued at the yield; interest earned is the yield times that.",
        intuition: "Book value = value of what is left, whatever the coupon pattern.",
        unknowns: [{ symbol: "$I_{t+1}$", meaning: "interest earned in the year" }],
        relationships: ["$BV_t = c_1(1+g)^t\\dfrac{1 - ((1+g)/(1+j))^{n-t}}{j - g} + Cv^{n-t}$"],
        conditions: ["Coupons grow geometrically."],
        valuationDate: `Time ${t}`,
        modelChoice: "Prospective book value.",
        assumptions: ["Amortised at the purchase yield."],
        principle: "Interest earned on the book-value basis is yield × previous book value.",
        unusual: "Geometric coupons.",
        misread: "Taking the coupon as the interest earned.",
        presentation: ["hidden-structure", "valuation-date", "combined-topics", "mixed-timing"],
        features: { multipleValuationDates: true },
        params: { kase, n, c1, g, C, j, t },
        route: "geometric coupons, redemption, book value, interest",
      });
    }
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const js = Math.pow(1 + i, 0.5) - 1;
    const m = 2 * n;
    const gs = g / 2;
    const pr = (o: { jj?: number; level?: boolean; grown?: boolean; noC?: boolean } = {}) => {
      const jj = o.jj ?? js;
      const first = c1 / 2 * (o.grown ? 1 + gs : 1);
      const stream = o.level ? mul(c1 / 2, an(jj, m)) : mul(first, geoA(jj, gs, m));
      return o.noC ? stream : add(stream, mul(C, vt(jj, m)));
    };
    const ans = pr();
    return elite({
      stem: `A ${n}-year bond pays semiannual coupons, the first of ${amt(c1 / 2)} six months from now and each later coupon ${pc(gs, 2)} larger than the one before. It is redeemed for ${amt(C)} at the end of year ${n}. ${name} buys it to yield an annual effective rate of ${pct(i)}.\n\nCalculate the price.`,
      fmt: MONEY2,
      answer: ans,
      model: add(flows(m, (k) => mul((c1 / 2) * Math.pow(1 + gs, k), pow(1 + i, -(k + 1) / 2))), mul(C, pow(1 + i, -n))),
      modelDescription: "Each coupon and the redemption discounted at the annual effective yield over its time in years.",
      traps: [
        { id: "RATE_ANNUAL_FOR_PERIODIC", value: pr({ jj: i / 2 }), label: "annual rate halved", method: `Used ${pct(i)}/2 per half-year.`, feedback: `The semiannual yield is $(1 + ${i})^{1/2} - 1$.` },
        { id: "MODEL_LEVEL_FOR_VARYING", value: pr({ level: true }), label: "level coupons", method: "Valued the coupons as level.", feedback: "The coupons grow geometrically." },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: pr({ grown: true }), label: "first coupon already grown", method: "Grew the first coupon.", feedback: `The first coupon is ${amt(c1 / 2)}.` },
        { id: "CONC_IGNORED_REDEMPTION", value: pr({ noC: true }), label: "redemption left out", method: "Left out the redemption value.", feedback: "Add the redemption value discounted." },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: pr({ jj: i }), label: "annual rate used per half-year", method: `Used ${pct(i)} per half-year.`, feedback: "Convert to a semiannual rate." },
      ],
      steps: [
        step("A.nominal-conversion", "Semiannual yield from the annual effective yield.", ["j", js, "semiannual yield"], ["i"]),
        step("B.geometric-annuity", "Growing coupons as a geometric annuity.", ["V_c", mul(c1 / 2, geoA(js, gs, m)).v, "coupons"], ["c_1", "g", "j"]),
        step("A.discount-factor", "Redemption discounted.", ["V_C", C * Math.pow(1 + i, -n), "redemption value"], ["C", "i"]),
        step("E.price", "Price.", ["P", ans.v, "price"], ["V_c", "V_C"]),
      ],
      methods: ["geometric_series", "decomposition", "substitution"],
      reasoning: "Convert the annual yield to semiannual, value the growing coupons as a geometric annuity, add the discounted redemption.",
      intuition: "Coupons and yield must be on the same period before using the geometric-annuity formula.",
      unknowns: [{ symbol: "$P$", meaning: "price" }],
      relationships: ["$P = c\\dfrac{1 - ((1+g)/(1+j))^{2n}}{j - g} + Cv^{2n}$"],
      conditions: ["Coupons grow every half-year."],
      valuationDate: "Time 0",
      modelChoice: "Geometric annuity plus redemption.",
      assumptions: ["Yield constant."],
      principle: "Put growth, payment and yield on the same period.",
      unusual: "Geometric coupons and an annual yield.",
      misread: "Halving the annual effective yield.",
      presentation: ["frequency", "hidden-structure", "combined-topics", "valuation-date"],
      features: { multipleValuationDates: true },
      params: { kase, n, c1, g, C, i },
      route: "rate, geometric coupons, redemption, price",
    });
  },
};

export const ELITE_BOND_TEMPLATES: QuestionTemplate[] = [multiCall, leveraged, steppedCoupon, makehamInverse, horizonYield, amortInverse, geometricCoupon];
