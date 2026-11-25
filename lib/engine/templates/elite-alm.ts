/**
 * Elite (level 4) general cash-flow and asset–liability templates: spot-rate
 * bootstrapping, forward-starting loans, portfolio duration with first-order
 * approximations, Redington and full immunization, exact matching, convexity
 * of mixed portfolios and project IRR/NPV. Second-order (convexity-based)
 * price approximations are deliberately not used. Each template has two cases.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import { MONEY2, amt, gridAmount, gridRate, pc, step } from "./kit";
import { K, X, add, an, at, div, elite, geoA, ia, mul, nameOf, pick, pow, rootOf, sub, sum, vt, type Eq } from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const PLAIN3: AnswerFormat = { kind: "number", decimals: 3 };
const YEARS2: AnswerFormat = { kind: "number", decimals: 2 };
const pct = (x: number) => pc(x, 3);
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));

// ===================================================================== 1. Bootstrap spot rates from coupon bonds

const bootstrap: QuestionTemplate = {
  id: "el-alm-bootstrap",
  family: "el-alm-bootstrap",
  topic: "ALM",
  levels: [4],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.price_redemption", "BONDS.yield"],
  reasoning: ["cashflow_modelling", "algebra", "multistep", "formula_selection"],
  soaConcept: "Spot rates bootstrapped from a zero-coupon bond and two coupon bonds, then used for a forward rate or to price and yield a new bond.",
  generate(rng): QuestionDraft {
    const s1 = gridRate(rng, 0.02, 0.05, 0.0025);
    const s2 = s1 + gridRate(rng, 0.006, 0.02, 0.001);
    const s3 = s2 + gridRate(rng, 0.006, 0.02, 0.001);
    const c2 = gridRate(rng, 0.03, 0.08, 0.005) * 100;
    const c3 = gridRate(rng, 0.03, 0.09, 0.005) * 100;
    const P1 = Math.round((100 / (1 + s1)) * 1000) / 1000;
    const P2 = Math.round((c2 / (1 + s1) + (100 + c2) / Math.pow(1 + s2, 2)) * 1000) / 1000;
    const P3 = Math.round((c3 / (1 + s1) + c3 / Math.pow(1 + s2, 2) + (100 + c3) / Math.pow(1 + s3, 3)) * 1000) / 1000;
    const kase = pick(rng, ["forward", "new-bond-yield"]);
    const v1 = div(P1, 100);
    const v2 = div(sub(P2, mul(c2, v1)), 100 + c2);
    const v3 = div(sub(P3, mul(c3, add(v1, v2))), 100 + c3);
    const spot = (v: X, t: number) => sub(pow(v, -1 / t), 1);
    const ytm = (P: number, c: number, n: number) => rootOf({ eq: (x: X) => sub(add(mul(c, an(x, n)), mul(100, vt(x, n))), P), lo: -0.2, hi: 0.5 });
    const stem0 = `The following prices are for bonds with face and redemption value 100 and annual coupons:\n\n- a 1-year zero-coupon bond: ${P1.toFixed(3)};\n- a 2-year bond with annual coupons of ${c2.toFixed(2)}: ${P2.toFixed(3)};\n- a 3-year bond with annual coupons of ${c3.toFixed(2)}: ${P3.toFixed(3)}.`;
    const steps = [
      step("F.spot", "One-year spot rate from the zero-coupon bond.", ["s_1", s1, "one-year spot rate"], ["P_1"]),
      step("F.spot-pricing", "Two-year discount factor from the 2-year bond.", ["v_2", v2.v, "two-year discount factor"], ["P_2", "v_1"], { rearranged: true }),
      step("F.spot-pricing", "Three-year discount factor from the 3-year bond.", ["v_3", v3.v, "three-year discount factor"], ["P_3", "v_1", "v_2"], { rearranged: true }),
    ];
    if (kase === "forward") {
      const f = sub(div(v2, v3), 1);
      const y3 = ytm(P3, c3, 3);
      return elite({
        stem: `${stem0}\n\nCalculate the one-year forward rate from time 2 to time 3 implied by these prices.`,
        fmt: PCT3,
        answer: f,
        model: { eq: (x: X) => sub(add(mul(c3, v1), mul(c3, v2), mul(100 + c3, v2, pow(add(1, x), -1))), P3), lo: -0.1, hi: 0.4 },
        modelDescription: "The 3-year bond priced with the bootstrapped one- and two-year factors and an unknown forward rate for the third year.",
        traps: [
          { id: "CONC_ALM_SPOT_AS_YTM", value: sub(div(pow(1 + y3, 3), pow(add(1, spot(v2, 2)), 2)), 1), label: "yield to maturity as the 3-year spot rate", method: "Used the 3-year bond's yield as the 3-year spot rate.", feedback: "A coupon bond's yield averages the spot rates; bootstrap instead." },
          { id: "COMP_COUPON_BOND_AS_ZERO", value: sub(div(div(P2, 100 + c2), div(P3, 100 + c3)), 1), label: "coupon bonds treated as zeros", method: "Treated each coupon bond's final payment as its only payment.", feedback: "Earlier coupons must be valued at earlier spot rates first." },
          { id: "COMP_FORWARD_RATIO_NO_POWERS", value: sub(div(add(1, spot(v3, 3)), add(1, spot(v2, 2))), 1), label: "spot ratio without powers", method: "Divided $(1+s_3)$ by $(1+s_2)$.", feedback: "Use $(1+s_3)^3/(1+s_2)^2$." },
          { id: "CONC_ALM_FORWARD_AS_SPOT", value: spot(v3, 3), label: "three-year spot rate", method: "Gave the 3-year spot rate.", feedback: "The forward rate covers only year 3." },
          { id: "CONC_ALM_FORWARD_NOT_ANNUALIZED", value: sub(div(v1, v3), 1), label: "two-year forward not annualised", method: "Gave the forward rate from time 1 to 3 as one figure.", feedback: "The question asks for the one-year forward rate from 2 to 3." },
        ],
        steps: [...steps, step("F.forward", "Forward rate for year 3.", ["f_{2,3}", f.v, "forward rate from 2 to 3"], ["v_2", "v_3"])],
        methods: ["work_backwards", "substitution", "decomposition"],
        reasoning: "Value each bond's earlier coupons with discount factors already found, solve for the next discount factor, and take the ratio of the last two.",
        intuition: "Bootstrapping peels one maturity at a time.",
        unknowns: [{ symbol: "$f_{2,3}$", meaning: "forward rate from time 2 to 3" }],
        relationships: ["$P_3 = c_3 v_1 + c_3 v_2 + (100 + c_3)v_3$", "$1 + f_{2,3} = v_2 / v_3$"],
        conditions: ["Annual coupons, no arbitrage."],
        valuationDate: "Time 0",
        modelChoice: "Bootstrapping.",
        assumptions: ["Prices consistent with one spot curve."],
        principle: "A coupon bond is a portfolio of zero-coupon bonds.",
        unusual: "Three bonds, two of them coupon bonds.",
        misread: "Using a yield to maturity as a spot rate.",
        presentation: ["work-backwards", "multi-equation", "hidden-structure", "rearrange-first"],
        params: { kase, P1, P2, P3, c2, c3 },
        route: "spot 1, bootstrap 2, bootstrap 3, forward",
      });
    }
    const q = gridRate(rng, 0.02, 0.1, 0.005) * 100;
    const newPrice = add(mul(q, add(v1, v2)), mul(100 + q, v3));
    const yEq = (Pn: X): Eq => ({ eq: (x: X) => sub(add(mul(q, an(x, 3)), mul(100, vt(x, 3))), Pn), lo: -0.2, hi: 0.5 });
    const flatS3 = spot(v3, 3);
    return elite({
      stem: `${stem0}\n\nA new 3-year bond with face and redemption value 100 pays annual coupons of ${q.toFixed(2)} and is priced consistently with these bonds. Calculate its annual effective yield to maturity.`,
      fmt: PCT3,
      answer: yEq(newPrice),
      model: { eq: (x: X) => sub(add(mul(q, pow(add(1, x), -1)), mul(q, pow(add(1, x), -2)), mul(100 + q, pow(add(1, x), -3))), add(mul(q, div(P1, 100)), mul(q, v2), mul(100 + q, v3))), lo: -0.2, hi: 0.5 },
      modelDescription: "The new bond's cash flows discounted at its yield equal its price from the bootstrapped factors.",
      traps: [
        { id: "COMP_YIELD_AS_LONGEST_SPOT", value: flatS3, label: "three-year spot rate", method: "Gave the 3-year spot rate.", feedback: "A coupon bond's yield is an average of the spot rates weighted by its cash flows." },
        { id: "CONC_ALM_SPOT_AS_YTM", value: K(ytm(P3, c3, 3)), label: "the given 3-year bond's yield", method: "Gave the yield of the quoted 3-year bond.", feedback: "Different coupons give different yields on the same spot curve." },
        { id: "COMP_COUPON_BOND_AS_ZERO", value: yEq(mul(100 + q, pow(div(P3, 100 + c3), 1))), label: "quoted bond treated as a zero", method: "Priced the new bond with the quoted 3-year bond's price per unit of final payment.", feedback: "Bootstrap the discount factors first." },
        { id: "CONC_ALM_RETURNS_AVERAGED", value: div(add(s1, spot(v2, 2), flatS3), 3), label: "average of spot rates", method: "Averaged the three spot rates.", feedback: "Solve the yield equation; the weights are the cash flows' present values." },
        { id: "MODEL_SINGLE_RATE", value: yEq(add(mul(q, an(s1, 3)), mul(100, vt(s1, 3)))), label: "one-year spot rate throughout", method: "Priced the new bond at the 1-year spot rate.", feedback: "Each cash flow has its own spot rate." },
      ],
      steps: [...steps, step("F.spot-pricing", "Price the new bond with the discount factors.", ["P", newPrice.v, "price of the new bond"], ["v_1", "v_2", "v_3"]), step("M.root-finding", "Solve for its yield.", ["y", 0, "yield to maturity"], ["P"], { rearranged: true })],
      methods: ["work_backwards", "numerical_root", "substitution"],
      reasoning: "Bootstrap the three discount factors, price the new bond with them, and solve its yield equation.",
      intuition: "Price from the curve first; the yield is just a summary of that price.",
      unknowns: [{ symbol: "$y$", meaning: "yield to maturity of the new bond" }],
      relationships: ["$q\\,a_{\\overline{3|}y} + 100v_y^3 = q(v_1 + v_2) + (100+q)v_3$"],
      conditions: ["No arbitrage."],
      valuationDate: "Time 0",
      modelChoice: "Bootstrapping, pricing, yield.",
      assumptions: ["Annual coupons."],
      principle: "Bonds with different coupons on the same curve have different yields.",
      unusual: "The yield of a bond that is not quoted.",
      misread: "Using the quoted bond's yield.",
      presentation: ["work-backwards", "unknown-rate", "multi-equation", "hidden-structure"],
      params: { kase, P1, P2, P3, c2, c3, q },
      route: "spot 1, bootstrap 2, bootstrap 3, price, yield",
    });
  },
};

// ===================================================================== 2. Forward-starting loan or deferred stream on a spot curve

const forwardLoan: QuestionTemplate = {
  id: "el-alm-forward-loan",
  family: "el-alm-forward-loan",
  topic: "ALM",
  levels: [4],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "LOANS.amortization", "ANNUITIES.immediate_due"],
  reasoning: ["valuation_dates", "cashflow_modelling", "multistep", "formula_selection"],
  soaConcept: "A loan agreed today but starting later is priced at forward rates: payments are valued at the start date using ratios of spot discount factors.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const kase = pick(rng, ["annual", "semiannual"]);
    if (kase === "annual") {
      const s = [0, gridRate(rng, 0.02, 0.045, 0.0025)];
      for (let t = 2; t <= 5; t += 1) s.push(s[t - 1] + gridRate(rng, 0.002, 0.008, 0.001));
      const L = gridAmount(rng, 10000, 100000, 5000);
      const v = (t: number, rate = s[t]) => pow(1 + rate, -t);
      const fwdValue = (o: { flat?: number; toZero?: boolean; noPowers?: boolean } = {}) => {
        const terms = [2, 3, 4, 5].map((t) => (o.flat !== undefined ? pow(1 + o.flat, -(t - 1)) : o.noPowers ? pow((1 + s[t]) / (1 + s[1]), -(t - 1)) : div(v(t), v(1))));
        const f = sum(terms);
        return o.toZero ? mul(f, v(1)) : f;
      };
      const pay = (o: Parameters<typeof fwdValue>[0] = {}) => div(L, fwdValue(o));
      const ans = pay();
      return elite({
        stem: `Annual effective spot rates are ${[1, 2, 3, 4, 5].map((t) => `${pct(s[t])} for ${t} year${t > 1 ? "s" : ""}`).join(", ")}. ${name} agrees today to borrow ${amt(L)} at time 1, repaid by four level payments at times 2, 3, 4 and 5, with the loan rate set from today's forward rates.\n\nCalculate the level payment.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(sum([2, 3, 4, 5].map((t) => mul(x, pow(1 + s[t], -t)))), mul(L, pow(1 + s[1], -1))), lo: ans.v * 0.3, hi: ans.v * 3 },
        modelDescription: "No arbitrage at time 0: the loan amount discounted from time 1 equals the payments discounted at their spot rates.",
        traps: [
          { id: "TIMING_VALUATION_DATE", value: div(L, fwdValue({ toZero: true })), label: "loan treated as advanced today", method: "Equated the loan to the payments' value at time 0.", feedback: "The loan is advanced at time 1: compare values at time 1." },
          { id: "MODEL_SINGLE_RATE", value: pay({ flat: s[5] }), label: "five-year spot rate flat", method: `Discounted at ${pct(s[5])} throughout.`, feedback: "Each payment is valued with its own forward discounting." },
          { id: "COMP_SPOT_AS_FORWARD", value: div(L, sum([2, 3, 4, 5].map((t) => pow(1 + s[t], -(t - 1))))), label: "spot rates used from time 1", method: "Discounted each payment from time t to 1 at the t-year spot rate.", feedback: "From time 1 the discount factor is $v(t)/v(1)$." },
          { id: "COMP_FORWARD_RATIO_NO_POWERS", value: pay({ noPowers: true }), label: "spot ratio without powers", method: "Used $((1+s_t)/(1+s_1))^{-(t-1)}$.", feedback: "Use $(1+s_1)/(1+s_t)^t$." },
          { id: "TIMING_IMMEDIATE_AS_DUE", value: div(L, sum([1, 2, 3, 4].map((t) => div(v(t), v(1))))), label: "payments a year early", method: "Placed the payments at times 1 to 4.", feedback: "The payments are at times 2 to 5." },
        ],
        steps: [
          step("F.spot", "Spot discount factors.", ["v(5)", v(5).v, "five-year discount factor"], ["s_t"]),
          step("F.forward-chain", "Discount factors from time t back to time 1: v(t)/v(1).", ["v(5)/v(1)", div(v(5), v(1)).v, "forward discount factor 1 to 5"], ["v(t)"], { derived: true }),
          step("B.annuity-immediate", "Forward value at time 1 of 1 per year at times 2–5.", ["\\ddot a", fwdValue().v, "forward annuity factor"], ["v(t)/v(1)"]),
          step("D.loan-payment", "Level payment.", ["P", ans.v, "level payment"], ["L"], { rearranged: true }),
        ],
        methods: ["valuation_dates", "substitution", "rearrangement"],
        reasoning: "Value the payments at time 1 using forward discount factors v(t)/v(1), then divide the loan amount by that annuity factor.",
        intuition: "A forward-starting loan is priced as if today's curve is rolled forward to the start date.",
        unknowns: [{ symbol: "$P$", meaning: "level payment" }],
        relationships: ["$L = P\\sum_{t=2}^{5} \\dfrac{(1+s_1)}{(1+s_t)^t}$"],
        conditions: ["No arbitrage."],
        valuationDate: "Time 1",
        modelChoice: "Forward discount factors.",
        assumptions: ["Rates locked today."],
        principle: "Forward discount factors are ratios of spot discount factors.",
        unusual: "The loan starts one year from now.",
        misread: "Discounting with spot rates from time 1.",
        presentation: ["deferred", "valuation-date", "hidden-structure", "rearrange-first"],
        features: { multipleValuationDates: true },
        params: { kase, L, s1: s[1], s5: s[5] },
        route: "spot factors, forward factors, annuity, payment",
      });
    }
    const half = [0];
    let cur = gridRate(rng, 0.02, 0.04, 0.0025);
    for (let k = 1; k <= 6; k += 1) {
      half.push(cur);
      cur += gridRate(rng, 0.003, 0.008, 0.0005);
    }
    const X0 = gridAmount(rng, 1000, 10000, 500);
    const v = (k: number, rate = half[k]) => pow(1 + rate / 2, -k);
    const value1 = (o: { zero?: boolean; eff?: boolean; flat?: number } = {}) => {
      const disc = (k: number) => (o.flat !== undefined ? pow(1 + o.flat / 2, -k) : o.eff ? pow(1 + half[k], -k / 2) : v(k));
      const pv = mul(X0, sum([3, 4, 5, 6].map((k) => disc(k))));
      return o.zero ? pv : div(pv, disc(2));
    };
    const ans = value1();
    return elite({
      stem: `Spot rates, as nominal annual rates convertible semiannually, are ${[1, 2, 3, 4, 5, 6].map((k) => `${pct(half[k])} for ${k / 2} year${k === 2 ? "" : "s"}`).join(", ")}. A contract pays ${amt(X0)} at times 1.5, 2, 2.5 and 3 years. ${name} agrees today on a price for the contract, to be paid at time 1.\n\nCalculate the no-arbitrage forward price.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(sum([3, 4, 5, 6].map((k) => mul(X0, pow(1 + half[k] / 2, -k)))), pow(1 + half[2] / 2, 2)),
      modelDescription: "Present value of the payments at the half-year spot rates, accumulated to time 1 at the one-year spot rate.",
      traps: [
        { id: "TIMING_VALUATION_DATE", value: value1({ zero: true }), label: "price paid today", method: "Gave the present value at time 0.", feedback: "The price is paid at time 1: accumulate it." },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: value1({ eff: true }), label: "nominal spot rates used as effective", method: "Treated the spot rates as annual effective.", feedback: "Spot rates are convertible semiannually: $(1 + s/2)^{-2t}$." },
        { id: "MODEL_SINGLE_RATE", value: value1({ flat: half[6] }), label: "three-year spot rate flat", method: `Discounted at ${pct(half[6])} throughout.`, feedback: "Each payment uses its own spot rate." },
        { id: "COMP_SPOT_AS_FORWARD", value: mul(X0, sum([3, 4, 5, 6].map((k) => pow(1 + half[k] / 2, -(k - 2))))), label: "spot rates applied from time 1", method: "Discounted each payment to time 1 at its own spot rate.", feedback: "From time 1, use $v(t)/v(1)$." },
        { id: "TIMING_EXTRA_PERIOD", value: mul(value1(), pow(1 + half[2] / 2, 1)), label: "accumulated an extra half-year", method: "Accumulated to time 1.5.", feedback: "The price is paid at time 1." },
        { id: "SEQ_UNDISCOUNTED_SUM", value: K(4 * X0), label: "payments added up", method: "Added the four payments.", feedback: "Each payment must be discounted to time 1." },
        { id: "COMP_PERIODS_AS_YEARS", value: div(mul(X0, sum([3, 4, 5, 6].map((k) => pow(1 + half[k] / 2, -k / 2)))), pow(1 + half[2] / 2, -1)), label: "years used as half-year periods", method: "Raised $(1 + s/2)$ to the number of years.", feedback: "Count half-years: the exponent is $2t$." },
      ],
      steps: [
        step("A.nominal-conversion", "Half-year spot discount factors.", ["v(3)", v(6).v, "three-year discount factor"], ["s_k"]),
        step("F.spot-pricing", "Present value of the payments.", ["PV", value1({ zero: true }).v, "present value"], ["v"]),
        step("F.forward-chain", "Accumulate to time 1 at the one-year spot rate.", ["1/v(1)", div(1, v(2)).v, "accumulation to time 1"], ["s_1"]),
        step("A.equation-of-value", "Forward price.", ["F", ans.v, "forward price"], ["PV", "1/v(1)"]),
      ],
      methods: ["valuation_dates", "substitution", "decomposition"],
      reasoning: "Value the payments today at the half-year spot rates, then accumulate to the payment date of the price at the one-year spot rate.",
      intuition: "A forward price is today's value carried to the settlement date.",
      unknowns: [{ symbol: "$F$", meaning: "forward price at time 1" }],
      relationships: ["$F = \\dfrac{\\sum X v(t)}{v(1)}$"],
      conditions: ["Semiannual compounding."],
      valuationDate: "Time 1",
      modelChoice: "Spot pricing then forward accumulation.",
      assumptions: ["No arbitrage."],
      principle: "Forward value = present value ÷ discount factor to the settlement date.",
      unusual: "Semiannual spot conventions and a settlement date in the future.",
      misread: "Giving the present value.",
      presentation: ["deferred", "valuation-date", "frequency", "hidden-structure"],
      features: { multipleValuationDates: true },
      params: { kase, X0, h1: half[1], h6: half[6] },
      route: "spot factors, present value, accumulate, forward price",
    });
  },
};

// ===================================================================== 3. Portfolio duration: weights, then a first-order estimate

const portfolioDuration: QuestionTemplate = {
  id: "el-alm-portfolio-duration",
  family: "el-alm-portfolio-duration",
  topic: "ALM",
  levels: [4],
  objective: "ALM.duration",
  secondary: ["ALM.portfolio", "ALM.approx_pv_change", "BONDS.price_redemption"],
  reasoning: ["formula_selection", "algebra", "multistep", "financial_intuition"],
  soaConcept: "A coupon bond's Macaulay duration computed from its cash flows, combined with a zero-coupon bond to hit a target duration; then a first-order estimate of the portfolio's value after a yield change.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const nA = rng.int(5, 10);
    const cA = gridRate(rng, 0.03, 0.1, 0.005) * 100;
    const nB = nA + rng.int(4, 12);
    const V = gridAmount(rng, 100000, 1000000, 50000);
    const name = nameOf(rng);
    const kase = pick(rng, ["amount", "estimate"]);
    const PA = add(mul(cA, an(i, nA)), mul(100, vt(i, nA)));
    const tPA = add(mul(cA, ia(i, nA)), mul(100 * nA, vt(i, nA)));
    const DA = div(tPA, PA);
    const Dstar = Math.round((DA.v + (nB - DA.v) * (0.3 + rng.next() * 0.4)) * 10) / 10;
    const wA = (o: { undiscounted?: boolean; notNormal?: boolean } = {}) => {
      const d = o.undiscounted ? (cA * (nA * (nA + 1)) / 2 + 100 * nA) / (cA * nA + 100) : o.notNormal ? tPA.v : DA.v;
      return div(nB - Dstar, nB - d);
    };
    const explicitDA = div(flows(nA, (k) => mul((k + 1) * (k === nA - 1 ? cA + 100 : cA), vt(i, k + 1))), flows(nA, (k) => mul(k === nA - 1 ? cA + 100 : cA, vt(i, k + 1))));
    const steps = [
      step("E.price", "Price of Bond A per 100.", ["P_A", PA.v, "Bond A price"], ["c", "i"]),
      step("G.macaulay", "Macaulay duration of Bond A from its cash flows.", ["D_A", DA.v, "Bond A Macaulay duration"], ["P_A"]),
      step("G.duration-special", "The zero-coupon bond's duration is its term.", ["D_B", nB, "Bond B duration"], []),
      step("G.portfolio-duration", "Weights from the target duration.", ["w_A", wA().v, "weight of Bond A"], ["D_A", "D_B", "D^*"], { rearranged: true }),
    ];
    const story = `At an annual effective yield of ${pct(i)}, Bond A is a ${nA}-year bond with annual coupons of ${cA.toFixed(2)} per 100 of face, redeemable at par, and Bond B is a ${nB}-year zero-coupon bond. ${name} invests ${amt(V)} in the two bonds so that the portfolio's Macaulay duration is ${Dstar.toFixed(1)}.`;
    if (kase === "amount") {
      const ans = mul(V, wA());
      return elite({
        stem: `${story}\n\nCalculate the amount invested in Bond A.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(V, div(nB - Dstar, sub(nB, explicitDA))),
        modelDescription: "Bond A's duration from its cash flows written out; weights from the duration-matching equation.",
        traps: [
          { id: "ALLOC_SWAPPED", value: mul(V, sub(1, wA())), label: "amount in Bond B", method: "Gave the amount in Bond B.", feedback: "The weight of A is (D_B − D*)/(D_B − D_A)." },
          { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: mul(V, wA({ undiscounted: true })), label: "undiscounted duration", method: "Weighted the times by undiscounted cash flows.", feedback: "Duration weights are present values." },
          { id: "ALLOC_EVEN_SPLIT", value: K(V / 2), label: "even split", method: "Split the money evenly.", feedback: "The split must give the target duration." },
          { id: "FORMULA_MODIFIED_FOR_MACAULAY", value: mul(V, div(nB - Dstar, sub(nB, div(DA, 1 + i)))), label: "modified duration for Bond A only", method: "Used Bond A's modified duration with Bond B's term.", feedback: "Use Macaulay durations for both (or modified for both)." },
          { id: "CONC_ALM_DURATIONS_ADDED", value: mul(V, div(Dstar, add(DA, nB))), label: "durations added", method: "Set the weight to $D^*/(D_A + D_B)$.", feedback: "Portfolio duration is a weighted average." },
        ],
        steps: [...steps, step("G.portfolio-duration", "Amount in Bond A.", ["V_A", ans.v, "amount in Bond A"], ["w_A", "V"])],
        methods: ["equation_construction", "decomposition", "rearrangement"],
        reasoning: "Compute Bond A's Macaulay duration from its cash flows, then solve w·D_A + (1 − w)·D_B = D* for the weight.",
        intuition: "The target sits between the two durations; the weights are its position on that segment.",
        unknowns: [{ symbol: "$V_A$", meaning: "amount in Bond A" }],
        relationships: ["$D_A = \\dfrac{\\sum t\\,CF_t v^t}{P_A}$", "$w = \\dfrac{D_B - D^*}{D_B - D_A}$"],
        conditions: ["Both bonds at the same yield."],
        valuationDate: "Time 0",
        modelChoice: "Portfolio duration as a value-weighted average.",
        assumptions: ["Flat yield curve."],
        principle: "Portfolio duration is the value-weighted average of the components' durations.",
        unusual: "Bond A's duration has to be built from its cash flows.",
        misread: "Swapping the weights.",
        presentation: ["multi-equation", "rearrange-first", "combined-topics", "hidden-structure"],
        params: { kase, i, nA, cA, nB, V, Dstar },
        route: "price, duration, zero duration, weights, amount",
      });
    }
    const dy = pick(rng, [0.015, 0.02, 0.025, 0.03, -0.015, -0.02, -0.025]);
    const Dmod = Dstar / (1 + i);
    const ans = mul(V, sub(1, mul(Dmod, dy)));
    const exactV = mul(V, add(mul(wA(), div(add(mul(cA, an(i + dy, nA)), mul(100, vt(i + dy, nA))), PA)), mul(sub(1, wA()), pow((1 + i) / (1 + i + dy), nB))));
    return elite({
      stem: `${story} The yield then changes to ${pct(i + dy)} for both bonds.\n\nUsing the first-order modified approximation, estimate the new value of the portfolio.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(V, sub(1, mul(div(add(mul(wA(), explicitDA), mul(sub(1, wA()), nB)), 1 + i), dy))),
      modelDescription: "Portfolio Macaulay duration rebuilt from the weights and Bond A's explicit duration, then the first-order modified estimate.",
      traps: [
        { id: "FORMULA_MODIFIED_FOR_MACAULAY", value: mul(V, sub(1, mul(Dstar, dy))), label: "Macaulay duration in the modified estimate", method: "Used the Macaulay duration as if modified.", feedback: "Modified duration = Macaulay/(1 + i)." },
        { id: "CHAL_WRONG_APPROXIMATION", value: mul(V, pow((1 + i) / (1 + i + dy), Dstar)), label: "first-order Macaulay approximation", method: "Used the first-order Macaulay approximation.", feedback: "The question asks for the first-order modified approximation." },
        { id: "CONC_DIRECTION_REVERSED", value: mul(V, add(1, mul(Dmod, dy))), label: "direction reversed", method: "Moved the value in the same direction as the yield.", feedback: "Value moves opposite to the yield." },
        { id: "ALLOC_SWAPPED", value: mul(V, sub(1, mul(div(add(mul(sub(1, wA()), DA), mul(wA(), nB)), 1 + i), dy))), label: "weights swapped", method: "Swapped the two weights when finding the portfolio duration.", feedback: `The weight of Bond A is ${"$"}(D_B - D^*)/(D_B - D_A)${"$"}.` },
        { id: "CONC_ALM_APPROX_EXACT", value: exactV, label: "exact revaluation", method: "Revalued both bonds exactly.", feedback: "The question asks for the first-order modified estimate." },
        { id: "CONC_ALM_DURATION_NOT_NORMALIZED", value: mul(V, sub(1, mul(div(add(mul(wA(), div(tPA, 100)), mul(sub(1, wA()), nB)), 1 + i), dy))), label: "Bond A duration divided by face", method: "Divided $\\sum t\\,CF_t v^t$ by the face amount instead of the price.", feedback: "Duration divides by the price (present value)." },
      ],
      steps: [...steps, step("G.modified", "Portfolio modified duration.", ["D_{mod}", Dmod, "portfolio modified duration"], ["D^*", "i"]), step("G.approx-modified", "First-order modified estimate.", ["V'", ans.v, "estimated new value"], ["V", "D_mod", "\\Delta i"])],
      methods: ["equation_construction", "decomposition", "substitution"],
      reasoning: "The portfolio's Macaulay duration is the target, so the modified duration is D*/(1 + i); apply V(1 − D_mod Δi).",
      intuition: "Once the portfolio is built to a target duration, the estimate needs only that target.",
      unknowns: [{ symbol: "$V'$", meaning: "estimated portfolio value" }],
      relationships: ["$V' \\approx V(1 - D_{mod}\\,\\Delta i)$", "$D_{mod} = D^*/(1+i)$"],
      conditions: ["Parallel change in yield."],
      valuationDate: "Time 0",
      modelChoice: "First-order modified approximation.",
      assumptions: ["Flat yield curve, small change."],
      principle: "First-order estimates use duration only; they are approximations.",
      unusual: "The portfolio is built first, then shocked.",
      misread: "Using the Macaulay duration as if it were modified.",
      presentation: ["multi-equation", "combined-topics", "hidden-structure", "rearrange-first"],
      params: { kase, i, nA, cA, nB, V, Dstar, dy },
      route: "price, duration, zero duration, weights, modified, estimate",
    });
  },
};

// ===================================================================== 4. First-order approximations: Macaulay estimate, or the shift implied by an estimate

const approxCompare: QuestionTemplate = {
  id: "el-alm-approx-compare",
  family: "el-alm-approx-compare",
  topic: "ALM",
  levels: [4],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ANNUITIES.level_payment", "TVM.effective_nominal"],
  reasoning: ["formula_selection", "algebra", "multistep", "validation"],
  soaConcept: "First-order Macaulay and modified approximations of a change in present value, and working backwards from an estimate to the yield change it implies.",
  generate(rng): QuestionDraft {
    const n = rng.int(15, 30);
    const R = gridAmount(rng, 1000, 10000, 500);
    const i2 = gridRate(rng, 0.04, 0.09, 0.0025);
    const i = Math.pow(1 + i2 / 2, 2) - 1;
    const name = nameOf(rng);
    const kase = pick(rng, ["macaulay-estimate", "implied-shift"]);
    const P = mul(R, an(i, n));
    const D = div(ia(i, n), an(i, n));
    const explicitD = div(flows(n, (k) => mul(k + 1, vt(i, k + 1))), flows(n, (k) => vt(i, k + 1)));
    const story = `${name} values an annuity of ${amt(R)} at the end of each year for ${n} years at a nominal annual rate of ${pct(i2)} convertible semiannually.`;
    const steps = [
      step("A.nominal-equivalence", "Annual effective rate.", ["i", i, "annual effective rate"], ["i^(2)"]),
      step("B.annuity-immediate", "Present value.", ["P", P.v, "present value"], ["R", "i"]),
      step("G.duration-special", "Macaulay duration of a level annuity: (Ia)/a.", ["D", D.v, "Macaulay duration"], ["i"]),
    ];
    if (kase === "macaulay-estimate") {
      const j = i + pick(rng, [0.02, 0.025, 0.03, 0.04, -0.02, -0.025]);
      const mac = (d: X | number, rate = i) => mul(P, pow(div(1 + rate, 1 + j), d));
      const ans = mac(D);
      return elite({
        stem: `${story} The annual effective rate then changes to ${pct(j)}.\n\nUsing the first-order Macaulay approximation, estimate the new present value.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(R, flows(n, (k) => vt(i, k + 1)), pow((1 + i) / (1 + j), explicitD)),
        modelDescription: "Present value and duration from the payments written out, then the Macaulay estimate.",
        traps: [
          { id: "CHAL_WRONG_APPROXIMATION", value: mul(P, sub(1, mul(div(D, 1 + i), j - i))), label: "first-order modified estimate", method: "Used the first-order modified approximation.", feedback: "The question asks for the Macaulay form $P\\,((1+i)/(1+j))^D$." },
          { id: "CONC_ALM_APPROX_EXACT", value: mul(R, an(j, n)), label: "exact value", method: "Revalued the annuity exactly.", feedback: "The question asks for the approximation." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: mul(mul(R, an(i2, n)), pow(div(1 + i2, 1 + j), div(ia(i2, n), an(i2, n)))), label: "nominal rate used as effective", method: `Valued at ${pct(i2)} effective.`, feedback: `Convert: $i = (1 + ${i2 / 2})^2 - 1$.` },
          { id: "CONC_ALM_DURATION_NOT_NORMALIZED", value: mul(P, pow(div(1 + i, 1 + j), div(ia(i, n), 1))), label: "duration not divided by the annuity", method: "Used (Ia) as the duration.", feedback: "Divide by $a_{\\overline{n|}}$." },
          { id: "CONC_DIRECTION_REVERSED", value: mul(P, pow(div(1 + j, 1 + i), D)), label: "ratio inverted", method: "Used $((1+j)/(1+i))^D$.", feedback: "Value falls when the rate rises: $((1+i)/(1+j))^D$." },
        ],
        steps: [...steps, step("G.approx-macaulay", "Macaulay estimate.", ["P'", ans.v, "estimated present value"], ["P", "D", "j"])],
        methods: ["substitution", "decomposition"],
        reasoning: "Convert the rate, compute the present value and Macaulay duration, and apply P(i)·((1+i)/(1+j))^D.",
        intuition: "The Macaulay estimate treats the annuity as a zero-coupon bond maturing at its duration.",
        unknowns: [{ symbol: "$P'$", meaning: "estimated present value" }],
        relationships: ["$P(j) \\approx P(i)\\left(\\dfrac{1+i}{1+j}\\right)^D$"],
        conditions: ["Level payments."],
        valuationDate: "Time 0",
        modelChoice: "First-order Macaulay approximation.",
        assumptions: ["Flat yield."],
        principle: "A cash flow stream behaves, to first order, like a zero at its Macaulay duration.",
        unusual: "The rate is given convertible semiannually.",
        misread: "Using the modified approximation.",
        presentation: ["frequency", "hidden-structure", "rearrange-first", "multi-equation"],
        params: { kase, n, R, i2, j },
        route: "convert, value, duration, Macaulay estimate",
      });
    }
    const pctDrop = pick(rng, [0.15, 0.2, 0.25, 0.3]);
    const dy = (o: { mac?: boolean } = {}) => (o.mac ? div(pctDrop, D) : div(mul(pctDrop, 1 + i), D));
    const exact = (o: { mac?: boolean } = {}) => mul(R, an(add(i, dy(o)), n));
    const ans = exact();
    return elite({
      stem: `${story} A first-order modified approximation estimates that a rise in the annual effective rate will reduce the present value by ${pc(pctDrop, 1)}.\n\nCalculate the exact present value at the new annual effective rate.`,
      fmt: MONEY2,
      answer: ans,
      model: flows(n, (k) => mul(R, pow(add(1 + i, div(mul(pctDrop, 1 + i), explicitD)), -(k + 1)))),
      modelDescription: "The rise in rate recovered from the modified estimate, then every payment discounted at the new rate.",
      traps: [
        { id: "FORMULA_MODIFIED_FOR_MACAULAY", value: exact({ mac: true }), label: "Macaulay duration used as modified", method: "Divided the drop by the Macaulay duration.", feedback: "The modified estimate uses $D/(1+i)$." },
        { id: "CONC_ALM_APPROX_EXACT", value: mul(P, 1 - pctDrop), label: "estimate taken as exact", method: `Reduced the value by ${pc(pctDrop, 1)}.`, feedback: "That is the estimate; revalue at the new rate." },
        { id: "CONC_DIRECTION_REVERSED", value: mul(R, an(sub(i, dy()), n)), label: "rate moved the wrong way", method: "Lowered the rate.", feedback: "A fall in value comes from a rise in the rate." },
        { id: "CONC_ALM_DURATION_NOT_NORMALIZED", value: mul(R, an(add(i, div(mul(pctDrop, 1 + i), ia(i, n))), n)), label: "duration not divided by the annuity", method: "Used (Ia) as the duration.", feedback: "Divide by $a_{\\overline{n|}}$." },
        { id: "VAR_OTHER_UNKNOWN", value: mul(P, 1), label: "original value", method: "Gave the value before the change.", feedback: "Revalue at the new rate." },
      ],
      steps: [...steps, step("G.modified", "Modified duration.", ["D_{mod}", D.v / (1 + i), "modified duration"], ["D", "i"]), step("G.approx-modified", "Rate change implied by the estimate.", ["\\Delta i", dy().v, "rise in the rate"], ["D_mod"], { rearranged: true }), step("B.annuity-immediate", "Exact value at the new rate.", ["P'", ans.v, "exact present value"], ["R", "i + \\Delta i"])],
      methods: ["work_backwards", "rearrangement", "substitution"],
      reasoning: "The modified estimate says ΔP/P ≈ −D_mod·Δi, so Δi = drop/D_mod; revalue the annuity exactly at i + Δi.",
      intuition: "The estimate is a statement about the rate change; recover it, then price exactly.",
      unknowns: [{ symbol: "$\\Delta i$", meaning: "change in rate" }],
      relationships: ["$\\dfrac{\\Delta P}{P} \\approx -\\dfrac{D}{1+i}\\Delta i$"],
      conditions: ["Annual effective rates."],
      valuationDate: "Time 0",
      modelChoice: "Inverse use of the first-order modified approximation.",
      assumptions: ["Parallel change."],
      principle: "First-order approximations can be inverted to read the implied rate change.",
      unusual: "Working backwards from an estimate.",
      misread: "Taking the estimate as the exact value.",
      presentation: ["work-backwards", "inverse", "frequency", "hidden-structure"],
      params: { kase, n, R, i2, pctDrop },
      route: "convert, value, duration, modified, implied shift, exact value",
    });
  },
};

// ===================================================================== 5. Redington immunization with two zero-coupon assets

const redington: QuestionTemplate = {
  id: "el-alm-redington-two-asset",
  family: "el-alm-redington-two-asset",
  topic: "ALM",
  levels: [4],
  objective: "ALM.redington",
  secondary: ["ALM.duration", "ALM.convexity", "ALM.portfolio"],
  reasoning: ["simultaneous_equations", "algebra", "multistep", "validation"],
  soaConcept: "Two zero-coupon assets bracketing two liabilities: match present value and duration, then confirm the convexity condition.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const t1 = rng.int(3, 7);
    const t2 = t1 + rng.int(2, 6);
    const a = rng.int(1, t1 - 1);
    const b = t2 + rng.int(1, 5);
    const L1 = gridAmount(rng, 10000, 80000, 1000);
    const L2 = gridAmount(rng, 10000, 80000, 1000);
    const kase = pick(rng, ["face", "convexity"]);
    const PVL = add(mul(L1, vt(i, t1)), mul(L2, vt(i, t2)));
    const TPV = add(mul(t1 * L1, vt(i, t1)), mul(t2 * L2, vt(i, t2)));
    const solve = (o: { undiscounted?: boolean } = {}) => {
      const pv = o.undiscounted ? K(L1 + L2) : PVL;
      const tpv = o.undiscounted ? K(t1 * L1 + t2 * L2) : TPV;
      const y = div(sub(tpv, mul(a, pv)), b - a);
      const x = sub(pv, y);
      return { x, y };
    };
    const { x, y } = solve();
    const story = `A company must pay ${amt(L1)} at time ${t1} and ${amt(L2)} at time ${t2}. It holds two zero-coupon bonds, maturing at times ${a} and ${b}, chosen so that the present value and the Macaulay duration of the assets equal those of the liabilities at an annual effective rate of ${pct(i)}.`;
    const steps = [
      step("A.discount-factor", "Present value of the liabilities.", ["PV_L", PVL.v, "present value of liabilities"], ["L", "i"]),
      step("G.macaulay", "Time-weighted present value (duration × PV) of the liabilities.", ["D_L PV_L", TPV.v, "duration times present value"], ["L", "i"]),
      step("M.linear-system", "PV and duration equations for the two assets.", ["PV_b", y.v, `present value of the time-${b} bond`], ["PV_L", "D_L"], { rearranged: true }),
    ];
    if (kase === "face") {
      const face = (o: { undiscounted?: boolean; extra?: number; swapped?: boolean } = {}) => {
        const s = solve(o);
        return o.swapped ? mul(s.x, at(i, a)) : mul(s.y, at(i, b + (o.extra ?? 0)));
      };
      const ans = face();
      if (x.v <= 0 || y.v <= 0) throw new Error("Negative holding.");
      return elite({
        stem: `${story}\n\nCalculate the face amount of the bond maturing at time ${b}.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (q: X) => sub(add(mul(a, sub(PVL, mul(q, vt(i, b)))), mul(b, q, vt(i, b))), TPV), lo: 1, hi: (L1 + L2) * 5 },
        modelDescription: "Duration equation with the time-b holding as the unknown face amount (the time-a holding takes the rest of the present value).",
        traps: [
          { id: "VAR_OTHER_UNKNOWN", value: y, label: "present value instead of face", method: "Gave the present value of the bond.", feedback: `Face amount = present value × $(1+i)^{${b}}$.` },
          { id: "ALLOC_SWAPPED", value: face({ swapped: true }), label: "face of the other bond", method: `Gave the face of the time-${a} bond.`, feedback: `The question asks about the time-${b} bond.` },
          { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: face({ undiscounted: true }), label: "undiscounted liabilities", method: "Matched undiscounted amounts and times.", feedback: "Match present values and durations." },
          { id: "TIMING_EXTRA_PERIOD", value: face({ extra: 1 }), label: "one year too many", method: `Accumulated ${b + 1} years.`, feedback: `The bond matures at time ${b}.` },
          { id: "ALLOC_EVEN_SPLIT", value: mul(div(PVL, 2), at(i, b)), label: "present value split evenly", method: "Put half of the present value in each bond.", feedback: "The split must also match the duration." },
        ],
        steps: [...steps, step("A.accumulation", "Face amount.", ["F_b", ans.v, "face amount"], ["PV_b", "i"]), step("G.redington", "Check convexity: assets bracket the liabilities, so asset convexity exceeds liability convexity.", ["C_A - C_L", (a * a * x.v + b * b * y.v - (t1 * t1 * L1 * Math.pow(1 + i, -t1) + t2 * t2 * L2 * Math.pow(1 + i, -t2))) / PVL.v, "Macaulay convexity surplus"], ["x", "y"])],
        methods: ["simultaneous", "elimination", "substitution"],
        reasoning: "Match PV and duration with two unknown present values, solve the linear system, accumulate to face, and check that the asset convexity exceeds the liability convexity.",
        intuition: "Assets outside the liability dates are more spread out, so convexity is satisfied automatically here.",
        unknowns: [{ symbol: "$F_b$", meaning: "face of the later bond" }],
        relationships: ["$x + y = PV_L$", `$${a}x + ${b}y = D_L PV_L$`],
        conditions: ["Both holdings positive."],
        valuationDate: "Time 0",
        modelChoice: "Redington conditions.",
        assumptions: ["Flat yield curve."],
        principle: "Redington: equal PV, equal duration, greater asset convexity.",
        unusual: "Two liabilities and two assets.",
        misread: "Giving the present value instead of the face.",
        presentation: ["multi-equation", "valuation-date", "combined-topics", "rearrange-first"],
        features: { multipleValuationDates: true },
        params: { kase, i, t1, t2, a, b, L1, L2 },
        route: "PV, duration, system, face, convexity check",
      });
    }
    if (x.v <= 0 || y.v <= 0) throw new Error("Negative holding.");
    const conv = (o: { modified?: boolean; liability?: boolean; notNormal?: boolean; dsq?: boolean; undiscounted?: boolean } = {}) => {
      const s = solve(o);
      if (o.liability) return div(add(mul(t1 * t1 * L1, vt(i, t1)), mul(t2 * t2 * L2, vt(i, t2))), PVL);
      if (o.dsq) return K(Math.pow(TPV.v / PVL.v, 2));
      const num = add(mul(a * a, s.x), mul(b * b, s.y));
      const c = o.notNormal ? num : div(num, add(s.x, s.y));
      return o.modified ? div(add(c, div(add(mul(a, s.x), mul(b, s.y)), add(s.x, s.y))), (1 + i) ** 2) : c;
    };
    const ans = conv();
    return elite({
      stem: `${story}\n\nCalculate the Macaulay convexity of the asset portfolio.`,
      fmt: PLAIN3,
      answer: ans,
      model: div(add(mul(a * a, sub(PVL, div(sub(TPV, mul(a, PVL)), b - a))), mul(b * b, div(sub(TPV, mul(a, PVL)), b - a))), PVL),
      modelDescription: "Asset present values from the matching equations; convexity as Σ t² PV / Σ PV.",
      traps: [
        { id: "FORMULA_MACAULAY_CONVEXITY", value: conv({ modified: true }), label: "modified convexity", method: "Gave the modified convexity.", feedback: "Macaulay convexity is $\\sum t^2 PV_t / \\sum PV_t$." },
        { id: "CONC_ALM_LIABILITY_CONVEXITY", value: conv({ liability: true }), label: "liability convexity", method: "Gave the liabilities' convexity.", feedback: "The question asks about the assets." },
        { id: "CHAL_CONVEXITY_AT_DURATION", value: conv({ dsq: true }), label: "duration squared", method: "Squared the duration.", feedback: "Convexity exceeds $D^2$ unless all cash flows are at one date." },
        { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: conv({ undiscounted: true }), label: "undiscounted matching", method: "Matched undiscounted amounts.", feedback: "Match present values." },
        { id: "CONC_ALM_DURATION_NOT_NORMALIZED", value: div(conv({ notNormal: true }), add(mul(x, at(i, a)), mul(y, at(i, b)))), label: "divided by face amounts", method: "Divided by the total face amount instead of the present value.", feedback: "Divide by the total present value." },
      ],
      steps: [...steps, step("G.portfolio-duration", "Present value of the earlier bond.", ["PV_a", x.v, `present value of the time-${a} bond`], ["PV_L", "PV_b"]), step("G.macaulay-convexity", "Asset convexity.", ["C_A", ans.v, "asset Macaulay convexity"], ["PV_a", "PV_b"])],
      methods: ["simultaneous", "elimination", "substitution"],
      reasoning: "Solve the PV and duration equations for the two holdings, then compute Σt²PV/ΣPV for the assets.",
      intuition: "Matching PV and duration fixes the holdings; convexity then follows and should exceed the liabilities'.",
      unknowns: [{ symbol: "$C_A$", meaning: "asset Macaulay convexity" }],
      relationships: ["$C = \\dfrac{\\sum t^2 PV_t}{\\sum PV_t}$"],
      conditions: ["Both holdings positive."],
      valuationDate: "Time 0",
      modelChoice: "Redington matching, then convexity.",
      assumptions: ["Flat yield curve."],
      principle: "With equal PV and duration, the more spread-out cash flows have greater convexity.",
      unusual: "Convexity of the constructed portfolio.",
      misread: "Giving the modified convexity.",
      presentation: ["multi-equation", "valuation-date", "combined-topics", "hidden-structure"],
      features: { multipleValuationDates: true },
      params: { kase, i, t1, t2, a, b, L1, L2 },
      route: "PV, duration, system, holdings, convexity",
    });
  },
};

// ===================================================================== 6. Full immunization: the second asset's face or maturity

const fullImmunization: QuestionTemplate = {
  id: "el-alm-full-immunization",
  family: "el-alm-full-immunization",
  topic: "ALM",
  levels: [4],
  objective: "ALM.full_immunization",
  secondary: ["ALM.duration", "ALM.redington", "ALM.portfolio"],
  reasoning: ["simultaneous_equations", "algebra", "multistep", "financial_intuition"],
  soaConcept: "One liability fully immunized by assets on either side: given one asset, the PV and duration conditions fix the other's date and size.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const T = rng.int(6, 15);
    const a = rng.int(1, Math.min(5, T - 1));
    const L = gridAmount(rng, 50000, 500000, 10000);
    const name = nameOf(rng);
    const kase = pick(rng, ["face", "maturity"]);
    const PVL = L * Math.pow(1 + i, -T);
    const share = 0.35 + rng.next() * 0.35;
    const F1 = Math.round((PVL * share * Math.pow(1 + i, T - a)) / 100) * 100;
    const PV1 = (o: { undiscounted?: boolean } = {}) => (o.undiscounted ? K(F1) : mul(F1, vt(i, T - a)));
    const PVLx = (o: { undiscounted?: boolean } = {}) => (o.undiscounted ? K(L) : K(PVL));
    const bOf = (o: { undiscounted?: boolean } = {}) => div(mul(a, PV1(o)), sub(PVLx(o), PV1(o)));
    const b = bOf();
    const PV2 = sub(PVL, PV1());
    const face = (o: { undiscounted?: boolean; toT?: boolean; swapped?: boolean } = {}) => (o.swapped ? K(F1) : mul(sub(PVLx(o), PV1(o)), o.undiscounted ? 1 : at(i, o.toT ? T : add(T, bOf(o)))));
    const story = `${name} must pay ${amt(L)} at time ${T}. To fully immunize the liability at an annual effective rate of ${pct(i)}, ${name} buys a zero-coupon bond paying ${amt(F1)} at time ${T - a} and a second zero-coupon bond maturing after time ${T}.`;
    const steps = [
      step("A.discount-factor", "Present value of the liability.", ["PV_L", PVL, "present value of the liability"], ["L", "i"]),
      step("A.discount-factor", "Present value of the first asset.", ["PV_1", PV1().v, "present value of the first asset"], ["F_1", "i"]),
      step("G.full-immunization", "Present value of the second asset: PV_L − PV_1.", ["PV_2", PV2.v, "present value of the second asset"], ["PV_L", "PV_1"]),
      step("G.macaulay", "Duration condition: a·PV_1 = b·PV_2.", ["b", b.v, "years after the liability"], ["PV_1", "PV_2"], { rearranged: true }),
    ];
    if (kase === "face") {
      const ans = face();
      return elite({
        stem: `${story}\n\nCalculate the face amount of the second bond.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(sub(PVL, mul(F1, pow(1 + i, -(T - a)))), pow(1 + i, add(T, div(mul(a, F1, pow(1 + i, -(T - a))), sub(L * Math.pow(1 + i, -T), mul(F1, pow(1 + i, -(T - a)))))))),
        modelDescription: "PV and duration conditions written directly; the second bond's face is its present value accumulated to its maturity.",
        traps: [
          { id: "VAR_OTHER_UNKNOWN", value: PV2, label: "present value instead of face", method: "Gave the present value.", feedback: "Accumulate to the bond's maturity." },
          { id: "TIMING_VALUATION_DATE", value: face({ toT: true }), label: "accumulated to the liability date", method: `Accumulated only to time ${T}.`, feedback: `The bond matures at time ${T} + b.` },
          { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: face({ undiscounted: true }), label: "undiscounted amounts", method: "Matched undiscounted amounts.", feedback: "The conditions are on present values." },
          { id: "ALLOC_SWAPPED", value: face({ swapped: true }), label: "face of the first bond", method: "Gave the first bond's face.", feedback: "The question asks about the second bond." },
          { id: "CONC_ALM_FULL_SAME_SIDE", value: mul(PV2, at(i, T - a)), label: "second bond before the liability", method: `Placed the second bond at time ${T - a}.`, feedback: "Full immunization needs assets on both sides of the liability." },
        ],
        steps: [...steps, step("A.accumulation", "Face amount.", ["F_2", ans.v, "face of the second bond"], ["PV_2", "b"])],
        methods: ["simultaneous", "substitution", "rearrangement"],
        reasoning: "PV match gives the second asset's present value; duration match (a·PV₁ = b·PV₂ about the liability date) gives its maturity; accumulate to that date for the face.",
        intuition: "Durations balance about the liability date like weights on a see-saw.",
        unknowns: [{ symbol: "$F_2$", meaning: "face of the second bond" }],
        relationships: ["$PV_1 + PV_2 = PV_L$", "$a\\,PV_1 = b\\,PV_2$"],
        conditions: ["Assets on both sides of the liability."],
        valuationDate: "Time 0",
        modelChoice: "Full immunization conditions.",
        assumptions: ["Flat yield curve."],
        principle: "Full immunization: PV match, duration match, one asset before and one after the liability.",
        unusual: "The maturity of the second asset is unknown.",
        misread: "Accumulating only to the liability date.",
        presentation: ["multi-equation", "unknown-time", "valuation-date", "rearrange-first"],
        features: { multipleValuationDates: true },
        params: { kase, i, T, a, L, F1 },
        route: "PV liability, PV asset, PV second, duration, face",
      });
    }
    const ans = add(T, b);
    return elite({
      stem: `${story}\n\nCalculate the time at which the second bond matures.`,
      fmt: YEARS2,
      answer: ans,
      model: { eq: (q: X) => sub(mul(sub(PVL, PV1()), sub(q, T)), mul(a, PV1())), lo: T + 0.01, hi: T + 200 },
      modelDescription: "Duration about the liability date: (maturity − T)·PV₂ = a·PV₁, solved for the maturity.",
      traps: [
        { id: "VAR_OTHER_UNKNOWN", value: b, label: "years after the liability", method: "Gave b, the time after the liability.", feedback: `The maturity is ${T} + b.` },
        { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: add(T, bOf({ undiscounted: true })), label: "undiscounted amounts", method: "Used undiscounted amounts in the duration condition.", feedback: "Use present values." },
        { id: "ALG_INVERTED_RATIO", value: add(T, div(mul(a, PV2), PV1())), label: "ratio inverted", method: "Used $b = a\\,PV_2/PV_1$.", feedback: "$a\\,PV_1 = b\\,PV_2$." },
        { id: "CONC_ALM_FULL_SAME_SIDE", value: K(T + a), label: "symmetric about the liability", method: `Placed the bond ${a} years after the liability.`, feedback: "Only equal present values would make it symmetric." },
        { id: "TIMING_VALUATION_DATE", value: div(mul(T, PVL), PV2), label: "durations measured from time 0", method: "Set the second bond's maturity so that its duration alone equals the liability's PV-weighted time.", feedback: "Both assets together must match the liability's duration." },
      ],
      steps: [...steps, step("G.full-immunization", "Maturity of the second bond.", ["T + b", ans.v, "maturity of the second bond"], ["b"])],
      methods: ["simultaneous", "substitution", "rearrangement"],
      reasoning: "PV match gives PV₂ = PV_L − PV₁; duration match about the liability date gives b = a·PV₁/PV₂; the maturity is T + b.",
      intuition: "The bigger asset sits closer to the liability.",
      unknowns: [{ symbol: "$T+b$", meaning: "maturity of the second bond" }],
      relationships: ["$a\\,PV_1 = b\\,PV_2$"],
      conditions: ["Assets on both sides of the liability."],
      valuationDate: "Time 0",
      modelChoice: "Full immunization conditions.",
      assumptions: ["Flat yield curve."],
      principle: "Duration matching about the liability date balances the present values.",
      unusual: "The unknown is a maturity.",
      misread: "Reporting b instead of T + b.",
      presentation: ["unknown-time", "multi-equation", "valuation-date", "rearrange-first"],
      features: { multipleValuationDates: true },
      params: { kase, i, T, a, L, F1 },
      route: "PV liability, PV asset, PV second, duration, maturity",
    });
  },
};

// ===================================================================== 7. Exact matching with coupon bonds: cost, or the yield of the dedicated portfolio

const dedication: QuestionTemplate = {
  id: "el-alm-dedication",
  family: "el-alm-dedication",
  topic: "ALM",
  levels: [4],
  objective: "ALM.cash_flow_matching",
  secondary: ["BONDS.price_redemption", "ALM.portfolio", "ALM.rates_of_return"],
  reasoning: ["cashflow_modelling", "algebra", "multistep", "valuation_dates"],
  soaConcept: "Exact matching with coupon bonds works backwards from the last liability: each longer bond's coupons reduce what shorter bonds must cover.",
  generate(rng): QuestionDraft {
    const L = [0, gridAmount(rng, 20000, 80000, 1000), gridAmount(rng, 20000, 80000, 1000), gridAmount(rng, 20000, 80000, 1000)];
    const c2 = gridRate(rng, 0.06, 0.1, 0.005);
    const c3 = gridRate(rng, 0.07, 0.12, 0.005);
    const y = [0, gridRate(rng, 0.02, 0.04, 0.0025), 0, 0];
    y[2] = y[1] + gridRate(rng, 0.0075, 0.02, 0.0025);
    y[3] = y[2] + gridRate(rng, 0.0075, 0.02, 0.0025);
    const name = nameOf(rng);
    const kase = pick(rng, ["cost", "portfolio-yield"]);
    const units = (o: { noSpill?: boolean } = {}) => {
      const n3 = L[3] / (1 + c3);
      const n2 = (L[2] - (o.noSpill ? 0 : n3 * c3)) / (1 + c2);
      const n1 = L[1] - (o.noSpill ? 0 : n3 * c3 + n2 * c2);
      return { n1, n2, n3 };
    };
    const priceOf = (yy: number[]) => ({ p1: K(1 / (1 + yy[1])), p2: add(mul(c2, an(yy[2], 2)), vt(yy[2], 2)), p3: add(mul(c3, an(yy[3], 3)), vt(yy[3], 3)) });
    const cost = (o: { noSpill?: boolean; flat?: number; face?: boolean } = {}) => {
      const u = units(o);
      if (o.face) return K(u.n1 + u.n2 + u.n3);
      const p = priceOf(o.flat !== undefined ? [0, o.flat, o.flat, o.flat] : y);
      return add(mul(u.n1, p.p1), mul(u.n2, p.p2), mul(u.n3, p.p3));
    };
    const u = units();
    if (u.n1 <= 0) throw new Error("Negative holding.");
    const story = `${name} must pay ${amt(L[1])} at time 1, ${amt(L[2])} at time 2 and ${amt(L[3])} at time 3, and matches these exactly with three bonds, each redeemable at par: a 1-year zero-coupon bond yielding ${pct(y[1])}, a 2-year bond with annual coupons at ${pc(c2, 1)} yielding ${pct(y[2])}, and a 3-year bond with annual coupons at ${pc(c3, 1)} yielding ${pct(y[3])}.`;
    const steps = [
      step("G.dedication", "Face of the 3-year bond: covers the last liability with its final coupon.", ["n_3", u.n3, "face of the 3-year bond"], ["L_3", "c_3"]),
      step("G.dedication", "Face of the 2-year bond: year-2 liability less the 3-year bond's coupon.", ["n_2", u.n2, "face of the 2-year bond"], ["L_2", "n_3"]),
      step("G.dedication", "Face of the 1-year zero: what remains at year 1.", ["n_1", u.n1, "face of the 1-year bond"], ["L_1", "n_2", "n_3"]),
      step("E.price", "Price each bond at its yield.", ["P_3", priceOf(y).p3.v, "price per 1 of the 3-year bond"], ["y"]),
    ];
    if (kase === "cost") {
      const ans = cost();
      const explicitCost = add(
        mul(u.n1, pow(1 + y[1], -1)),
        mul(u.n2, add(mul(c2, pow(1 + y[2], -1)), mul(1 + c2, pow(1 + y[2], -2)))),
        mul(u.n3, add(mul(c3, pow(1 + y[3], -1)), mul(c3, pow(1 + y[3], -2)), mul(1 + c3, pow(1 + y[3], -3))))
      );
      return elite({
        stem: `${story}\n\nCalculate the total cost of the matching portfolio.`,
        fmt: MONEY2,
        answer: ans,
        model: explicitCost,
        modelDescription: "Each bond's cash flows discounted one by one at its own yield, times the face held.",
        traps: [
          { id: "COMP_COUPON_BOND_AS_ZERO", value: cost({ noSpill: true }), label: "coupons not carried to earlier years", method: "Matched each liability with its own bond only.", feedback: "Coupons of longer bonds also pay earlier liabilities: work backwards." },
          { id: "VAR_FACE_FOR_PRICE", value: cost({ face: true }), label: "total face", method: "Gave the total face amount bought.", feedback: "The cost uses the bonds' prices." },
          { id: "MODEL_SINGLE_RATE", value: cost({ flat: y[3] }), label: "longest yield for all bonds", method: `Priced all bonds at ${pct(y[3])}.`, feedback: "Each bond has its own yield." },
          { id: "COMP_YIELD_AS_LONGEST_SPOT", value: sum([1, 2, 3].map((t) => mul(L[t], vt(y[3], t)))), label: "liabilities discounted at the 3-year yield", method: "Discounted the liabilities at the 3-year bond's yield.", feedback: "Cost is what the bonds cost, at their own yields." },
          { id: "CONC_ALM_SPOT_AS_YTM", value: sum([1, 2, 3].map((t) => mul(L[t], vt(y[t], t)))), label: "each liability at its bond's yield", method: "Discounted each liability at the yield of the bond maturing then.", feedback: "Yields to maturity are not spot rates; price the bonds actually held." },
          { id: "CONC_ALM_RETURNS_AVERAGED", value: sum([1, 2, 3].map((t) => mul(L[t], vt((y[1] + y[2] + y[3]) / 3, t)))), label: "average yield", method: "Discounted the liabilities at the average yield.", feedback: "Price the actual bonds." },
        ],
        steps: [...steps, step("A.equation-of-value", "Total cost.", ["Cost", ans.v, "total cost"], ["n", "P"])],
        methods: ["work_backwards", "decomposition", "substitution"],
        reasoning: "Work backwards from the last liability: each longer bond's coupons reduce what the shorter bonds must cover; then price each holding at its yield.",
        intuition: "Exact matching starts at the end because only the longest bond reaches the last date.",
        unknowns: [{ symbol: "$\\text{Cost}$", meaning: "cost of the matching portfolio" }],
        relationships: ["$n_3(1+c_3) = L_3$", "$n_2(1+c_2) + n_3c_3 = L_2$", "$n_1 + n_2c_2 + n_3c_3 = L_1$"],
        conditions: ["Par redemption, annual coupons."],
        valuationDate: "Time 0",
        modelChoice: "Backward exact matching.",
        assumptions: ["Fractional holdings allowed."],
        principle: "Exact matching makes asset cash flows equal liability cash flows at every date.",
        unusual: "Coupon spill-over into earlier years.",
        misread: "Matching each liability with its own bond only.",
        presentation: ["work-backwards", "multi-equation", "valuation-date", "hidden-structure"],
        features: { multipleValuationDates: true },
        params: { kase, L1: L[1], L2: L[2], L3: L[3], c2, c3, y1: y[1], y2: y[2], y3: y[3] },
        route: "3-year face, 2-year face, 1-year face, prices, cost",
      });
    }
    const C0 = cost();
    const yEq = (Cst: X): Eq => ({ eq: (x: X) => sub(sum([1, 2, 3].map((t) => mul(L[t], vt(x, t)))), Cst), lo: -0.2, hi: 0.5 });
    return elite({
      stem: `${story}\n\nCalculate the annual effective yield rate at which the liabilities' present value equals the cost of the matching portfolio.`,
      fmt: PCT3,
      answer: yEq(C0),
      model: { eq: (x: X) => sub(add(mul(L[1], pow(add(1, x), -1)), mul(L[2], pow(add(1, x), -2)), mul(L[3], pow(add(1, x), -3))), C0), lo: -0.2, hi: 0.5 },
      modelDescription: "Liability cash flows discounted at the unknown yield equal the portfolio cost.",
      traps: [
        { id: "COMP_COUPON_BOND_AS_ZERO", value: yEq(cost({ noSpill: true })), label: "coupons not carried to earlier years", method: "Matched each liability with its own bond only.", feedback: "Work backwards; coupons pay earlier liabilities." },
        { id: "VAR_FACE_FOR_PRICE", value: yEq(cost({ face: true })), label: "total face as the cost", method: "Used the total face as the cost.", feedback: "Use prices." },
        { id: "CONC_ALM_RETURNS_AVERAGED", value: K((y[1] + y[2] + y[3]) / 3), label: "average of the yields", method: "Averaged the three yields.", feedback: "Solve the equation of value." },
        { id: "COMP_YIELD_AS_LONGEST_SPOT", value: K(y[3]), label: "longest bond's yield", method: "Gave the 3-year bond's yield.", feedback: "The portfolio yield depends on all three bonds." },
        { id: "MODEL_SINGLE_RATE", value: yEq(cost({ flat: y[1] })), label: "all bonds at the shortest yield", method: `Priced every bond at ${pct(y[1])}.`, feedback: "Each bond has its own yield." },
      ],
      steps: [...steps, step("A.equation-of-value", "Total cost.", ["Cost", C0.v, "total cost"], ["n", "P"]), step("C.irr", "Yield equating liabilities and cost.", ["y", 0, "portfolio yield"], ["Cost"], { rearranged: true })],
      methods: ["work_backwards", "numerical_root", "decomposition"],
      reasoning: "Build the matching portfolio backwards, price it, then solve for the single rate at which the liabilities' present value equals that cost.",
      intuition: "The portfolio's yield is a cash-flow-weighted blend of the three bonds' yields.",
      unknowns: [{ symbol: "$y$", meaning: "portfolio yield" }],
      relationships: ["$\\sum L_t v_y^t = \\text{Cost}$"],
      conditions: ["Par redemption."],
      valuationDate: "Time 0",
      modelChoice: "Backward exact matching, then IRR.",
      assumptions: ["Fractional holdings allowed."],
      principle: "An exactly matched portfolio earns the rate equating its cost with the liabilities.",
      unusual: "The yield of a constructed portfolio.",
      misread: "Averaging the yields.",
      presentation: ["work-backwards", "unknown-rate", "multi-equation", "hidden-structure"],
      params: { kase, L1: L[1], L2: L[2], L3: L[3], c2, c3, y1: y[1], y2: y[2], y3: y[3] },
      route: "faces, prices, cost, IRR",
    });
  },
};

// ===================================================================== 8. Annuity plus zero: convexity, or the zero needed for a target duration

const annuityZeroMix: QuestionTemplate = {
  id: "el-alm-annuity-zero-mix",
  family: "el-alm-annuity-zero-mix",
  topic: "ALM",
  levels: [4],
  objective: "ALM.convexity",
  secondary: ["ALM.duration", "ALM.portfolio", "ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "algebra", "multistep", "validation"],
  soaConcept: "A portfolio of a level annuity and a zero-coupon bond: its duration and convexity are present-value-weighted averages of the components'.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const n = rng.int(5, 15);
    const R = gridAmount(rng, 1000, 10000, 500);
    const T = n + rng.int(2, 10);
    const name = nameOf(rng);
    const kase = pick(rng, ["convexity", "zero-for-duration"]);
    const PA = mul(R, an(i, n));
    const DA = div(ia(i, n), an(i, n));
    const sumT2 = flows(n, (k) => mul((k + 1) * (k + 1), vt(i, k + 1)));
    const CA = div(sumT2, an(i, n));
    if (kase === "convexity") {
      const Z = gridAmount(rng, 10000, 100000, 5000);
      const PZ = mul(Z, vt(i, T));
      const w = div(PA, add(PA, PZ));
      const mac = (o: { notWeighted?: boolean; undiscounted?: boolean } = {}) => {
        if (o.notWeighted) return add(CA, T * T);
        if (o.undiscounted) {
          const wa = (R * n) / (R * n + Z);
          return add(mul(wa, CA), mul(1 - wa, T * T));
        }
        return add(mul(w, CA), mul(sub(1, w), T * T));
      };
      const dur = add(mul(w, DA), mul(sub(1, w), T));
      const modified = (o: Parameters<typeof mac>[0] = {}) => div(add(mac(o), dur), (1 + i) ** 2);
      const ans = modified();
      return elite({
        stem: `${name}'s portfolio consists of an annuity paying ${amt(R)} at the end of each year for ${n} years and a zero-coupon bond paying ${amt(Z)} at time ${T}. The annual effective rate is ${pct(i)}.\n\nCalculate the modified convexity of the portfolio.`,
        fmt: PLAIN3,
        answer: ans,
        model: div(add(flows(n, (k) => mul(R * (k + 1) * (k + 2), vt(i, k + 3))), mul(Z * T * (T + 1), vt(i, T + 2))), add(flows(n, (k) => mul(R, vt(i, k + 1))), mul(Z, vt(i, T)))),
        modelDescription: "Modified convexity from its definition: Σ t(t+1) CF_t v^{t+2} / Σ CF_t v^t.",
        traps: [
          { id: "FORMULA_MACAULAY_CONVEXITY", value: mac(), label: "Macaulay convexity", method: "Gave the Macaulay convexity.", feedback: "Modified convexity = (Macaulay convexity + Macaulay duration)/(1+i)²." },
          { id: "CHAL_CONVEXITY_AT_DURATION", value: div(add(mul(dur, dur), dur), (1 + i) ** 2), label: "duration squared in place of convexity", method: "Replaced the Macaulay convexity by the squared duration.", feedback: "Convexity exceeds $D^2$ for spread-out cash flows." },
          { id: "CONC_ALM_DURATIONS_ADDED", value: div(add(mac({ notWeighted: true }), add(DA, T)), (1 + i) ** 2), label: "components added", method: "Added the components' convexities and durations.", feedback: "Weight by present value." },
          { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: modified({ undiscounted: true }), label: "undiscounted weights", method: "Weighted the components by undiscounted amounts.", feedback: "Weights are present values." },
          { id: "ALG_DIVIDE_ERROR", value: div(add(mac(), dur), 1 + i), label: "divided by (1+i) once", method: "Divided by $(1+i)$ instead of $(1+i)^2$.", feedback: "Modified convexity divides by $(1+i)^2$." },
        ],
        steps: [
          step("B.annuity-immediate", "Annuity value.", ["P_A", PA.v, "annuity value"], ["R", "i"]),
          step("G.duration-special", "Annuity duration (Ia)/a.", ["D_A", DA.v, "annuity Macaulay duration"], ["i"]),
          step("G.macaulay-convexity", "Annuity Macaulay convexity Σt²v^t / a.", ["C_A", CA.v, "annuity Macaulay convexity"], ["i"]),
          step("G.portfolio-duration", "Present-value-weighted duration and convexity of the portfolio.", ["C_P", mac().v, "portfolio Macaulay convexity"], ["P_A", "P_Z"]),
          step("G.convexity", "Modified convexity.", ["C_{mod}", ans.v, "modified convexity"], ["C_P", "D_P", "i"]),
        ],
        methods: ["decomposition", "substitution"],
        reasoning: "Compute each component's PV, duration and convexity, weight by PV, and convert Macaulay to modified convexity.",
        intuition: "Portfolio measures are PV-weighted averages; conversion to modified convexity adds the duration and divides by (1+i)².",
        unknowns: [{ symbol: "$C_{mod}$", meaning: "modified convexity" }],
        relationships: ["$C_{mod} = \\dfrac{C_{Mac} + D_{Mac}}{(1+i)^2}$"],
        conditions: ["Flat yield."],
        valuationDate: "Time 0",
        modelChoice: "Portfolio convexity.",
        assumptions: ["Annual effective rate."],
        principle: "Duration and convexity of a portfolio are PV-weighted averages.",
        unusual: "Mixing an annuity with a zero.",
        misread: "Giving the Macaulay convexity.",
        presentation: ["combined-topics", "multi-equation", "hidden-structure", "rearrange-first"],
        params: { kase, i, n, R, T, Z },
        route: "value, duration, convexity, weight, modify",
      });
    }
    const Dstar = Math.round((DA.v + (T - DA.v) * (0.3 + rng.next() * 0.4)) * 10) / 10;
    const zeroFor = (o: { undiscounted?: boolean; modified?: boolean; pvOnly?: boolean } = {}) => {
      const d = o.modified ? div(DA, 1 + i) : DA;
      const pvz = div(mul(PA, sub(Dstar, d)), sub(T, Dstar));
      if (o.pvOnly) return pvz;
      return o.undiscounted ? pvz : mul(pvz, at(i, T));
    };
    const ans = zeroFor();
    return elite({
      stem: `${name}'s portfolio consists of an annuity paying ${amt(R)} at the end of each year for ${n} years and a zero-coupon bond maturing at time ${T}. The annual effective rate is ${pct(i)}.\n\nCalculate the zero-coupon bond's maturity value that makes the portfolio's Macaulay duration ${Dstar.toFixed(1)}.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (z: X) => sub(add(flows(n, (k) => mul(R * (k + 1), vt(i, k + 1))), mul(z, T, vt(i, T))), mul(Dstar, add(flows(n, (k) => mul(R, vt(i, k + 1))), mul(z, vt(i, T))))), lo: 1, hi: R * n * 50 },
      modelDescription: "Σ t·PV_t = D*·Σ PV_t with every cash flow written out, solved for the zero's maturity value.",
      traps: [
        { id: "VAR_OTHER_UNKNOWN", value: zeroFor({ pvOnly: true }), label: "present value of the zero", method: "Gave the present value of the zero.", feedback: `Accumulate to time ${T}.` },
        { id: "FORMULA_MODIFIED_FOR_MACAULAY", value: zeroFor({ modified: true }), label: "annuity's modified duration", method: "Used the annuity's modified duration.", feedback: "Use Macaulay durations throughout." },
        { id: "ALG_INVERTED_RATIO", value: mul(div(mul(PA, sub(T, Dstar)), sub(Dstar, DA)), at(i, T)), label: "ratio inverted", method: "Used $P_Z = P_A (T - D^*)/(D^* - D_A)$.", feedback: "$P_Z = P_A (D^* - D_A)/(T - D^*)$." },
        { id: "MODEL_UNDISCOUNTED_WEIGHTS", value: div(mul(R * n, sub(Dstar, (n + 1) / 2)), sub(T, Dstar)), label: "undiscounted weights", method: "Used undiscounted amounts and times.", feedback: "Weights are present values." },
        { id: "TIMING_EXTRA_PERIOD", value: mul(zeroFor(), 1 + i), label: "one year too many", method: `Accumulated ${T + 1} years.`, feedback: `The bond matures at time ${T}.` },
      ],
      steps: [
        step("B.annuity-immediate", "Annuity value.", ["P_A", PA.v, "annuity value"], ["R", "i"]),
        step("G.duration-special", "Annuity duration.", ["D_A", DA.v, "annuity Macaulay duration"], ["i"]),
        step("G.portfolio-duration", "PV of the zero from the target duration.", ["P_Z", zeroFor({ pvOnly: true }).v, "present value of the zero"], ["P_A", "D_A", "D^*"], { rearranged: true }),
        step("A.accumulation", "Maturity value.", ["Z", ans.v, "maturity value"], ["P_Z", "i"]),
      ],
      methods: ["equation_construction", "rearrangement", "substitution"],
      reasoning: "With PV weights, P_A D_A + P_Z T = D*(P_A + P_Z); solve for P_Z and accumulate to time T.",
      intuition: "The zero pulls the duration toward T; the target fixes how much is needed.",
      unknowns: [{ symbol: "$Z$", meaning: "maturity value of the zero" }],
      relationships: ["$P_Z = P_A\\dfrac{D^* - D_A}{T - D^*}$"],
      conditions: ["Flat yield."],
      valuationDate: "Time 0",
      modelChoice: "Duration matching.",
      assumptions: ["Annual effective rate."],
      principle: "Portfolio duration is a PV-weighted average.",
      unusual: "The unknown is the size of the zero.",
      misread: "Giving the zero's present value.",
      presentation: ["multi-equation", "rearrange-first", "combined-topics", "hidden-structure"],
      params: { kase, i, n, R, T, Dstar },
      route: "value, duration, solve PV, accumulate",
    });
  },
};

// ===================================================================== 9. Project with a deferred growing stream and a mid-life outlay: IRR or NPV

const projectReturn: QuestionTemplate = {
  id: "el-alm-project-return",
  family: "el-alm-project-return",
  topic: "ALM",
  levels: [4],
  objective: "ALM.rates_of_return",
  secondary: ["ANNUITIES.geometric", "ANNUITIES.streams", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "algebra"],
  soaConcept: "A project's cash flows combine an initial cost, a deferred growing stream and a refit cost: the IRR solves NPV = 0; NPV at a quoted rate needs the rate converted first.",
  generate(rng): QuestionDraft {
    const I0 = gridAmount(rng, 100000, 500000, 10000);
    const d = rng.int(1, 3);
    const n = rng.int(8, 15);
    const g = pick(rng, [0.02, 0.03, 0.04]);
    const k = d + rng.int(3, n - 2);
    const name = nameOf(rng);
    const kase = pick(rng, ["irr", "npv"]);
    const Rfirst = Math.round((I0 * (0.15 + rng.next() * 0.1)) / 1000) * 1000;
    const Ok = Math.round((I0 * (0.1 + rng.next() * 0.15)) / 1000) * 1000;
    const npv = (rate: X | number, o: { noDefer?: boolean; noOutlay?: boolean; grown?: boolean; arithmetic?: boolean } = {}) => {
      const defer = o.noDefer ? 0 : d;
      const first = o.grown ? Rfirst * (1 + g) : Rfirst;
      const stream = o.arithmetic ? flows(n, (q) => mul(first * (1 + g * q), vt(rate, defer + q + 1))) : mul(first, geoA(rate, g, n), vt(rate, defer));
      return sub(sub(stream, I0), o.noOutlay ? 0 : mul(Ok, vt(rate, k)));
    };
    const explicitNPV = (rate: X | number) => sub(sub(flows(n, (q) => mul(Rfirst * Math.pow(1 + g, q), vt(rate, d + q + 1))), I0), mul(Ok, vt(rate, k)));
    const story = `${name} evaluates a project costing ${amt(I0)} today. It produces net income at the end of each year for ${n} years, the first ${amt(Rfirst)} at the end of year ${d + 1}, each later amount ${pc(g, 0)} larger than the one before. A refit costing ${amt(Ok)} is needed at the end of year ${k}.`;
    if (kase === "irr") {
      const eqFor = (o: Parameters<typeof npv>[1] = {}): Eq => ({ eq: (x: X) => npv(x, o), lo: g + 0.001, hi: 0.8 });
      const irr = rootOf(eqFor());
      return elite({
        stem: `${story}\n\nCalculate the project's internal rate of return.`,
        fmt: PCT3,
        answer: eqFor(),
        model: { eq: (x: X) => explicitNPV(x), lo: g + 0.001, hi: 0.8 },
        modelDescription: "Net present value with every cash flow written out, set to zero.",
        traps: [
          { id: "TIMING_IGNORED_DEFERRAL", value: eqFor({ noDefer: true }), label: "income starting at year 1", method: "Started the income at the end of year 1.", feedback: `The first income is at the end of year ${d + 1}.` },
          { id: "TRANS_IGNORED_CONDITION", value: eqFor({ noOutlay: true }), label: "refit ignored", method: "Left out the refit.", feedback: `The refit costs ${amt(Ok)} at year ${k}.` },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: eqFor({ grown: true }), label: "first income already grown", method: "Grew the first income.", feedback: `The first income is ${amt(Rfirst)}.` },
          { id: "SEQ_GEOMETRIC_AS_ARITHMETIC", value: eqFor({ arithmetic: true }), label: "growth treated as arithmetic", method: `Increased the income by ${pc(g, 0)} of the first amount each year.`, feedback: "Each amount is the previous one times (1 + g)." },
          { id: "CONC_RETURN_ON_WRONG_BASE", value: K((Rfirst * ((Math.pow(1 + g, n) - 1) / g) - I0 - Ok) / I0 / (d + n)), label: "simple average return", method: "Divided the total profit by the cost and the number of years.", feedback: "The IRR solves NPV = 0 and accounts for timing." },
        ],
        steps: [
          step("B.geometric-annuity", "Value of the growing income one year before its first amount (at the IRR).", ["V", mul(Rfirst, geoA(irr, g, n)).v, "growing income at the IRR"], ["R", "g"]),
          step("B.deferred", `Defer ${d} years.`, ["v^d", Math.pow(1 + irr, -d), "deferral factor at the IRR"], ["d"]),
          step("C.npv", "NPV including the refit: at the IRR the income's value equals the cost plus the discounted refit.", ["I_0 + O_k v^k", I0 + Ok * Math.pow(1 + irr, -k), "cost plus discounted refit"], ["V", "I_0", "O_k"], { derived: true }),
          step("C.irr", "Solve NPV = 0.", ["IRR", 0, "internal rate of return"], ["NPV"], { rearranged: true }),
        ],
        methods: ["equation_construction", "numerical_root", "geometric_series"],
        reasoning: "Write the NPV as a deferred geometric annuity less the cost and the discounted refit, and find the rate that makes it zero.",
        intuition: "The refit is small relative to the income, so NPV falls steadily with the rate: one IRR.",
        unknowns: [{ symbol: "$IRR$", meaning: "internal rate of return" }],
        relationships: ["$0 = R\\,v^d\\dfrac{1 - ((1+g)/(1+j))^n}{j - g} - I_0 - O_k v^k$"],
        conditions: ["Income is deferred; the refit is a single outlay."],
        valuationDate: "Time 0",
        modelChoice: "NPV equation solved for the rate.",
        assumptions: ["Cash flows certain."],
        principle: "The IRR is the rate at which NPV is zero.",
        unusual: "A deferred growing stream and a mid-life outlay.",
        misread: "Starting the income at year 1.",
        presentation: ["unknown-rate", "deferred", "mixed-timing", "irrelevant-info"],
        features: { multipleValuationDates: true },
        params: { kase, I0, d, n, g, k, Rfirst, Ok },
        route: "geometric income, defer, NPV, IRR",
      });
    }
    const j4 = gridRate(rng, 0.06, 0.12, 0.0025);
    const j = Math.pow(1 + j4 / 4, 4) - 1;
    const ans = npv(j);
    return elite({
      stem: `${story} ${name}'s cost of capital is a nominal annual rate of ${pct(j4)} convertible quarterly.\n\nCalculate the project's net present value.`,
      fmt: MONEY2,
      answer: ans,
      model: explicitNPV(j),
      modelDescription: "Every cash flow discounted at the annual effective cost of capital.",
      traps: [
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: npv(j4), label: "nominal rate used as effective", method: `Discounted at ${pct(j4)} effective.`, feedback: `Convert: $(1 + ${j4 / 4})^4 - 1$.` },
        { id: "TIMING_IGNORED_DEFERRAL", value: npv(j, { noDefer: true }), label: "income starting at year 1", method: "Started the income at year 1.", feedback: `The first income is at year ${d + 1}.` },
        { id: "TRANS_IGNORED_CONDITION", value: npv(j, { noOutlay: true }), label: "refit ignored", method: "Left out the refit.", feedback: `Include the refit at year ${k}.` },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: npv(j, { grown: true }), label: "first income already grown", method: "Grew the first income.", feedback: `The first income is ${amt(Rfirst)}.` },
        { id: "SEQ_GEOMETRIC_AS_ARITHMETIC", value: npv(j, { arithmetic: true }), label: "growth treated as arithmetic", method: "Grew the income arithmetically.", feedback: "Growth is geometric." },
      ],
      steps: [
        step("A.nominal-equivalence", "Annual effective cost of capital.", ["j", j, "annual effective rate"], ["j^(4)"]),
        step("B.geometric-annuity", "Growing income valued one year before its first amount.", ["V", mul(Rfirst, geoA(j, g, n)).v, "growing income"], ["R", "g", "j"]),
        step("B.deferred", `Defer ${d} years.`, ["V_0", mul(Rfirst, geoA(j, g, n), vt(j, d)).v, "income at time 0"], ["V", "j"]),
        step("C.npv", "Subtract the cost and the discounted refit.", ["NPV", ans.v, "net present value"], ["V_0", "I_0", "O_k"]),
      ],
      methods: ["decomposition", "geometric_series", "valuation_dates"],
      reasoning: "Convert the cost of capital, value the deferred growing income, and subtract the cost and the discounted refit.",
      intuition: "Convert first; then the income is a standard deferred geometric annuity.",
      unknowns: [{ symbol: "$NPV$", meaning: "net present value" }],
      relationships: ["$NPV = R v^d\\dfrac{1 - ((1+g)/(1+j))^n}{j - g} - I_0 - O_k v^k$"],
      conditions: ["Cost of capital given quarterly."],
      valuationDate: "Time 0",
      modelChoice: "NPV of a deferred growing stream.",
      assumptions: ["Cash flows certain."],
      principle: "NPV discounts each cash flow at the cost of capital.",
      unusual: "Deferred growth, a refit and a quarterly rate.",
      misread: "Using the nominal rate as effective.",
      presentation: ["deferred", "mixed-timing", "frequency", "irrelevant-info"],
      features: { multipleValuationDates: true },
      params: { kase, I0, d, n, g, k, Rfirst, Ok, j4 },
      route: "convert, growing income, defer, NPV",
    });
  },
};

export const ELITE_ALM_TEMPLATES: QuestionTemplate[] = [bootstrap, forwardLoan, portfolioDuration, approxCompare, redington, fullImmunization, dedication, annuityZeroMix, projectReturn];
