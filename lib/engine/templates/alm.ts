import { convexity, forwardRate, macaulayConvexity, macaulayDuration, pvFlows, solveRoot, v, type Flow } from "../finance";
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  PCT3,
  amt,
  dec,
  distractor,
  drawUntil,
  explanation,
  features,
  gridAmount,
  gridRate,
  lit,
  mamt,
  mnum,
  mpc,
  pc,
  range,
  shown,
  step,
  chain,
  sumOf,
  word,
} from "./kit";

const YEARS: AnswerFormat = { kind: "number", decimals: 3 };
const PLAIN: AnswerFormat = { kind: "number", decimals: 2 };

/** An increasing spot curve s_1..s_n. */
function spotCurve(rng: Parameters<typeof gridRate>[0], n: number): number[] {
  const start = gridRate(rng, 0.02, 0.05, 0.0025);
  const rates = [start];
  for (let t = 1; t < n; t += 1) rates.push(Number((rates[t - 1] + gridRate(rng, 0.005, 0.015, 0.0025)).toFixed(4)));
  return rates;
}

const spotList = (s: number[]): string => s.map((rate, idx) => `$s_{${idx + 1}} = ${mpc(rate, 2)}$`).join(", ");
const spotV = (s: number[], t: number): string => `(1+${lit(s[t - 1])})**(-${t})`;

/** Explicit Σ t·CF·v^t / Σ CF·v^t at a flat rate, as an expression. */
const durationExpr = (flows: Flow[], i: number): string =>
  `${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}/${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}`;

// ===================================================================== forward rates

const forward: QuestionTemplate = {
  id: "alm-forward-rate",
  family: "alm-curve",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.price_redemption"],
  reasoning: ["formula_reconstruction", "formula_selection", "concept_recognition"],
  soaConcept: "Forward rates implied by a spot-rate curve; pricing with a mixture of spot and forward information.",
  generate(rng, lvl): QuestionDraft {
    if (lvl === 1) {
      const s = spotCurve(rng, 4);
      const a = rng.int(1, 2);
      const b = a + rng.int(1, 2);
      const f = forwardRate(s[a - 1], a, s[b - 1], b);
      const fmt = PCT3;
      const ratio = `(1+${lit(s[b - 1])})**${b}/(1+${lit(s[a - 1])})**${a}`;
      const arith = (b * s[b - 1] - a * s[a - 1]) / (b - a);
      const rootErr = Math.pow(Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a), 1 / b) - 1;
      const diff = s[b - 1] - s[a - 1];
      return {
        stem: `The following annual effective spot rates are given: ${spotList(s)}.\n\nCalculate the annual effective forward rate from time ${a} to time ${b}.`,
        answer: {
          value: f,
          calc: `(${ratio})**(1/${b - a})-1`,
          format: fmt,
          derivation: `$\\left(\\dfrac{(1 + s_{${b}})^{${b}}}{(1 + s_{${a}})^{${a}}}\\right)^{1/${b - a}} - 1 = ${shown(f, fmt)}$`,
        },
        model: {
          expr: `(1+${lit(s[a - 1])})**${a}*(1+x)**${b - a} - (1+${lit(s[b - 1])})**${b}`,
          bracket: [0.0001, 0.3],
          description: `No arbitrage: investing to time ${b} directly equals investing to time ${a} and then at the forward rate.`,
        },
        distractors: [
          distractor("FORMULA_ARITHMETIC_FORWARD", arith, `(${b}*${lit(s[b - 1])} - ${a}*${lit(s[a - 1])})/${b - a}`, {
            derivation: `$\\dfrac{${b}(${dec(s[b - 1], 4)}) - ${a}(${dec(s[a - 1], 4)})}{${b - a}} = ${shown(arith, fmt)}$`,
            method: "Combined the spot rates linearly.",
            feedback: "Rates compound, so the no-arbitrage relation is between accumulation factors, not rates.",
          }),
          distractor("ALG_ROOT_ERROR", rootErr, `(${ratio})**(1/${b})-1`, {
            derivation: `$\\left(\\dfrac{(1+s_{${b}})^{${b}}}{(1+s_{${a}})^{${a}}}\\right)^{1/${b}} - 1 = ${shown(rootErr, fmt)}$`,
            method: `Took the ${b === 2 ? "square" : b === 3 ? "cube" : `${b}th`} root.`,
            feedback: `The forward period is ${b - a} year${b - a > 1 ? "s" : ""} long, so the root is 1/${b - a}.`,
          }),
          distractor("VAR_OTHER_UNKNOWN", s[b - 1], lit(s[b - 1]), {
            derivation: `$s_{${b}} = ${shown(s[b - 1], fmt)}$`,
            method: `Reported the ${b}-year spot rate.`,
            feedback: "A spot rate applies from time 0; the forward rate applies only from the later start date.",
          }),
          distractor("ALLOC_EVEN_SPLIT", (s[a - 1] + s[b - 1]) / 2, `(${lit(s[a - 1])}+${lit(s[b - 1])})/2`, {
            derivation: `$\\tfrac12(s_{${a}} + s_{${b}}) = ${shown((s[a - 1] + s[b - 1]) / 2, fmt)}$`,
            method: "Averaged the two spot rates.",
            feedback: "The forward rate lies beyond both spot rates on a rising curve: it is the rate earned only in the later period.",
          }),
          ...(b - a > 1
            ? [
                distractor("VAR_TOTAL_FOR_COMPONENT", Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a) - 1, `${ratio}-1`, {
                  derivation: `$\\dfrac{(1+s_{${b}})^{${b}}}{(1+s_{${a}})^{${a}}} - 1 = ${shown(Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a) - 1, fmt)}$`,
                  method: `Reported the ${b - a}-year forward growth instead of an annual rate.`,
                  feedback: "The question asks for an annual effective forward rate: take the root over the forward period's length.",
                }),
              ]
            : []),
          distractor("ALG_SIGN_ERROR", diff, `${lit(s[b - 1])} - ${lit(s[a - 1])}`, {
            derivation: `$s_{${b}} - s_{${a}} = ${shown(diff, fmt)}$`,
            method: "Subtracted the spot rates.",
            feedback: "The forward rate is a rate in its own right; a difference of rates measures only the slope of the curve.",
          }),
        ],
        explanation: forwardExplanation({ s, a, b, f, fmt }),
        visuals: [
          {
            kind: "curve",
            title: "Spot curve and one-year forward rates",
            points: s.map((rate, idx) => ({ t: idx + 1, spot: rate, forward: idx === 0 ? rate : forwardRate(s[idx - 1], idx, rate, idx + 1) })),
            caption: "When the spot curve rises, forward rates lie above it.",
          },
        ],
        markers: [Math.pow(1 + s[b - 1], b), Math.pow(1 + s[a - 1], a)],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("F.spot", "Accumulation factors to each date from the spot rates.", ["(1+s_b)^b/(1+s_a)^a", Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a), "growth between a and b"], ["s_a", "s_b"]),
            step("F.forward", "Annualise the growth over the b − a years.", ["f_{a,b}", f, "annual forward rate"], ["growth", "b − a"], { rearranged: true }),
          ],
          {
            stages: {
              FORMULA_ARITHMETIC_FORWARD: [1, "selection"],
              ALG_ROOT_ERROR: [1, "application"],
              VAR_OTHER_UNKNOWN: [1, "interpretation"],
              ALLOC_EVEN_SPLIT: [1, "selection"],
              VAR_TOTAL_FOR_COMPONENT: [1, "interpretation"],
              ALG_SIGN_ERROR: [1, "selection"],
            },
            reasoning: "No arbitrage: investing to b directly must equal investing to a and then rolling forward.",
          }
        ),
        params: { s1: s[0], s2: s[1], s3: s[2], s4: s[3], a, b },
      };
    }

    const s = spotCurve(rng, 3);
    const F = 1000;
    const c = gridRate(rng, 0.05, 0.1, 0.005) * F;
    const v1 = 1 / (1 + s[0]);
    const v2 = Math.pow(1 + s[1], -2);
    const P = Number((c * v1 + c * v2 + (c + F) * Math.pow(1 + s[2], -3)).toFixed(2));
    const rest = P - c * v1 - c * v2;
    const s3 = Math.pow((c + F) / rest, 1 / 3) - 1;
    const fmt = PCT3;
    const restE = `(${lit(P)} - ${lit(c)}/(1+${lit(s[0])}) - ${lit(c)}/(1+${lit(s[1])})**2)`;
    const ytm = solveRoot((x) => c / (1 + x) + c / Math.pow(1 + x, 2) + (c + F) / Math.pow(1 + x, 3) - P, 0.0001, 0.5);
    const noRoot = (c + F) / rest - 1;
    const ignoreCoupons = Math.pow((c + F) / P, 1 / 3) - 1;
    const fwd = Math.pow(1 + s3, 3) / Math.pow(1 + s[1], 2) - 1;
    return {
      stem: `The one-year and two-year annual effective spot rates are ${pc(s[0], 2)} and ${pc(s[1], 2)}. A three-year ${amt(F)} par bond with annual coupons of ${amt(c)} sells for ${mnum(P, 2)}.\n\nCalculate the three-year annual effective spot rate.`,
      answer: {
        value: s3,
        calc: `((${lit(c + F)})/${restE})**(1/3)-1`,
        format: fmt,
        derivation: `$(1 + s_3)^{-3} = \\dfrac{${mnum(P, 2)} - ${c}v_1 - ${c}v_2}{${c + F}} \\Rightarrow s_3 = ${shown(s3, fmt)}$`,
      },
      model: {
        expr: `${lit(c)}/(1+${lit(s[0])}) + ${lit(c)}/(1+${lit(s[1])})**2 + ${lit(c + F)}/(1+x)**3 - ${lit(P)}`,
        bracket: [0.0001, 0.4],
        description: "The bond's price equals its coupons discounted at s₁ and s₂ plus the final payment discounted at the unknown s₃.",
      },
      distractors: [
        distractor("MODEL_SINGLE_RATE", ytm, `${lit(c)}/(1+x) + ${lit(c)}/(1+x)**2 + ${lit(c + F)}/(1+x)**3 - ${lit(P)}`, {
          derivation: `one rate for every cash flow: $${shown(ytm, fmt)}$`,
          method: "Solved for the bond's yield to maturity.",
          feedback: "The yield to maturity uses one rate for all three cash flows. The coupons at times 1 and 2 are already priced by s₁ and s₂; only the final payment determines s₃.",
        }),
        distractor("ALG_ROOT_ERROR", noRoot, `(${lit(c + F)})/${restE}-1`, {
          derivation: `$\\dfrac{${c + F}}{${mnum(rest, 2)}} - 1 = ${shown(noRoot, fmt)}$`,
          method: "Forgot the cube root.",
          feedback: "The final payment is three years away, so its discount factor is $(1 + s_3)^{-3}$.",
        }),
        distractor("TRANS_IGNORED_CONDITION", ignoreCoupons, `(${lit(c + F)}/${lit(P)})**(1/3)-1`, {
          derivation: `$\\left(\\dfrac{${c + F}}{${mnum(P, 2)}}\\right)^{1/3} - 1 = ${shown(ignoreCoupons, fmt)}$`,
          method: "Ignored the coupons at times 1 and 2.",
          feedback: "Part of the price pays for the first two coupons; subtract their value before isolating the final payment.",
        }),
        distractor("VAR_OTHER_UNKNOWN", fwd, `((${lit(c + F)})/${restE})/(1+${lit(s[1])})**2-1`, {
          derivation: `$\\dfrac{(1+s_3)^3}{(1+s_2)^2} - 1 = ${shown(fwd, fmt)}$`,
          method: "Computed the forward rate from time 2 to time 3.",
          feedback: "The question asks for the three-year spot rate, which applies from time 0.",
        }),
      ],
      explanation: explanation({
        intuition: "A coupon bond is a bundle of zero-coupon payments. Two of its three payments are already priced by the known spot rates, so whatever is left of the price must be the value of the final payment — and that pins down the three-year spot rate. This is bootstrapping.",
        translation: {
          unknowns: [{ symbol: "$s_3$", meaning: "the three-year spot rate" }],
          relationships: [`$${mnum(P, 2)} = ${c}(1+s_1)^{-1} + ${c}(1+s_2)^{-2} + ${c + F}(1+s_3)^{-3}$`],
          conditions: ["Known s₁ and s₂ price the first two coupons."],
          valuationDate: "Time 0.",
          modelChoice: "Strip the known pieces off the price, then solve for one discount factor.",
          assumptions: ["No arbitrage: the bond is priced on the spot curve."],
        },
        solution: [
          { title: "Value of the first two coupons", body: `$${c}(${dec(v1, 6)}) + ${c}(${dec(v2, 6)}) = ${mnum(c * (v1 + v2), 2)}$` },
          { title: "Value left for the final payment", body: `$${mnum(P, 2)} - ${mnum(c * (v1 + v2), 2)} = ${mnum(rest, 2)}$` },
          { title: "Solve", body: `$(1 + s_3)^3 = ${c + F}/${mnum(rest, 2)} \\Rightarrow s_3 = ${shown(s3, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Discount factor first",
            body: `$v_3 = ${mnum(rest, 2)}/${c + F} = ${dec(rest / (c + F), 6)}$, then $s_3 = v_3^{-1/3} - 1$.`,
            whenUseful: "Keeps the algebra in discount factors, which add linearly.",
          },
        ],
        transfer: {
          principle: "Bootstrapping: each longer bond adds exactly one new discount factor once the shorter ones are known.",
          unusual: "The unknown is a rate on the curve, recovered from a price.",
          misread: "The yield to maturity looks like the answer but blends all three spot rates.",
        },
      }),
      visuals: [
        {
          kind: "curve",
          title: "Spot curve with the bootstrapped s₃",
          points: [
            { t: 1, spot: s[0] },
            { t: 2, spot: s[1], forward: forwardRate(s[0], 1, s[1], 2) },
            { t: 3, spot: s3, forward: fwd },
          ],
        },
      ],
      markers: [rest, c * (v1 + v2)],
      presentation: ["inverse", "work-backwards", "combined-topics"],
      features: features({ steps: 3, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("F.spot", "Price the first two coupons at their own spot rates.", ["c v_1 + c v_2", c * (v1 + v2), "value of the first two coupons"], ["s_1", "s_2", "c"]),
          step("F.spot-pricing", "What is left of the price pays for the final payment.", ["remaining value", rest, "value of the time-3 payment"], ["P"], { rearranged: true }),
          step("F.spot", "Solve (1 + s₃)⁻³ × final payment = remaining value.", ["s_3", s3, "three-year spot rate"], ["remaining value"], { rearranged: true }),
        ],
        {
          methods: ["work_backwards", "rearrangement"],
          stages: {
            MODEL_SINGLE_RATE: [1, "selection"],
            ALG_ROOT_ERROR: [2, "application"],
            TRANS_IGNORED_CONDITION: [1, "connection"],
            VAR_OTHER_UNKNOWN: [2, "interpretation"],
          },
          reasoning: "Bootstrapping: each longer bond adds one unknown discount factor once the shorter ones are known.",
        }
      ),
      params: { s1: s[0], s2: s[1], c, P },
    };
  },
};

function forwardExplanation(p: { s: number[]; a: number; b: number; f: number; fmt: AnswerFormat }) {
  const { s, a, b, f, fmt } = p;
  return explanation({
    intuition: `Two ways to invest 1 until time ${b}: lock in the ${b}-year spot rate, or lock in the ${a}-year spot rate and then the forward rate from ${a} to ${b}. If they gave different results, one would be a free lunch — so the forward rate is whatever makes them equal.`,
    translation: {
      unknowns: [{ symbol: `$f_{${a},${b}}$`, meaning: `the annual forward rate from ${a} to ${b}` }],
      relationships: [`$(1 + s_{${b}})^{${b}} = (1 + s_{${a}})^{${a}}(1 + f)^{${b - a}}$`],
      conditions: ["No arbitrage."],
      valuationDate: `Times 0, ${a} and ${b}.`,
      modelChoice: "Equate accumulation factors.",
      assumptions: ["Annual effective rates."],
    },
    solution: [
      { title: "Accumulation factors", body: `$(${dec(1 + s[b - 1], 4)})^{${b}} = ${dec(Math.pow(1 + s[b - 1], b), 6)}$, $(${dec(1 + s[a - 1], 4)})^{${a}} = ${dec(Math.pow(1 + s[a - 1], a), 6)}$` },
      { title: "Ratio", body: `$(1 + f)^{${b - a}} = ${dec(Math.pow(1 + s[b - 1], b) / Math.pow(1 + s[a - 1], a), 6)}$` },
      { title: "Forward rate", body: `$f = ${shown(f, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Chain one-year forwards",
        body: `$(1 + f_{${a},${b}})^{${b - a}} = \\prod_{t=${a}}^{${b - 1}}(1 + f_{t,t+1})$`,
        whenUseful: "Useful when one-year forward rates are given instead of spot rates.",
      },
    ],
    transfer: {
      principle: "Forward rates come from ratios of accumulation factors; never from differences of rates.",
      unusual: "Nothing — the trap is the linear shortcut.",
      misread: "Annualising over the wrong number of years.",
    },
  });
}

// ===================================================================== pricing with spot rates

const spotPricing: QuestionTemplate = {
  id: "alm-spot-pricing",
  family: "alm-curve",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward", "BONDS.coupons"],
  reasoning: ["concept_recognition", "formula_selection", "cashflow_modelling", "algebra"],
  soaConcept: "Bond pricing and par yields from a spot curve.",
  generate(rng, lvl): QuestionDraft {
    const n = rng.int(3, 4);
    const s = spotCurve(rng, n);
    const vt = (t: number) => Math.pow(1 + s[t - 1], -t);
    const sumv = range(1, n).reduce((acc, t) => acc + vt(t), 0);
    const sumvE = sumOf(range(1, n).map((t) => spotV(s, t)));
    if (lvl === 1) {
      const F = 1000;
      const c = gridRate(rng, 0.03, 0.08, 0.005) * F;
      const P = c * sumv + F * vt(n);
      const fmt = MONEY2;
      const single = c * range(1, n).reduce((acc, t) => acc + Math.pow(1 + s[n - 1], -t), 0) + F * vt(n);
      const fwd = range(1, n).map((t) => (t === 1 ? s[0] : forwardRate(s[t - 2], t - 1, s[t - 1], t)));
      const asSpot = c * range(1, n).reduce((acc, t) => acc + Math.pow(1 + fwd[t - 1], -t), 0) + F * Math.pow(1 + fwd[n - 1], -n);
      const avg = s.reduce((a, b) => a + b, 0) / n;
      const avgP = c * range(1, n).reduce((acc, t) => acc + Math.pow(1 + avg, -t), 0) + F * Math.pow(1 + avg, -n);
      return {
        stem: `Annual effective spot rates are ${spotList(s)}.\n\nCalculate the price of an ${word(n)}-year ${amt(F)} par bond with annual coupons at ${pc(c / F)}.`,
        answer: {
          value: P,
          calc: `${lit(c)}*${sumvE} + ${lit(F)}*${spotV(s, n)}`,
          format: fmt,
          derivation: `$${c}\\sum_{t=1}^{${n}}(1+s_t)^{-t} + ${F}(1+s_{${n}})^{-${n}} = ${shown(P, fmt)}$`,
        },
        model: {
          expr: `x - (${range(1, n).map((t) => `${lit(t === n ? c + F : c)}/(1+${lit(s[t - 1])})**${t}`).join(" + ")})`,
          bracket: [100, 3000],
          description: "Each cash flow divided by its own spot accumulation factor.",
        },
        distractors: [
          distractor("MODEL_SINGLE_RATE", single, `${lit(c)}*${sumOf(range(1, n).map((t) => `(1+${lit(s[n - 1])})**(-${t})`))} + ${lit(F)}*${spotV(s, n)}`, {
            derivation: `all at $s_{${n}}$: $${shown(single, fmt)}$`,
            method: `Discounted every cash flow at the ${n}-year spot rate.`,
            feedback: "A coupon at time t is a t-year zero-coupon payment and is discounted at the t-year spot rate.",
          }),
          distractor("MODEL_SINGLE_RATE", c * range(1, n).reduce((acc, t) => acc + Math.pow(1 + s[0], -t), 0) + F * Math.pow(1 + s[0], -n), `${lit(c)}*${sumOf(range(1, n).map((t) => `(1+${lit(s[0])})**(-${t})`))} + ${lit(F)}*(1+${lit(s[0])})**(-${n})`, {
            derivation: `all at $s_1$: $${shown(c * range(1, n).reduce((acc, t) => acc + Math.pow(1 + s[0], -t), 0) + F * Math.pow(1 + s[0], -n), fmt)}$`,
            method: "Discounted every cash flow at the one-year spot rate.",
            feedback: "A payment at time t is discounted at the t-year spot rate.",
          }),
          distractor("CONC_PAR_ASSUMPTION", F, lit(F), {
            derivation: `$${shown(F, fmt)}$`,
            method: "Assumed the bond is priced at par.",
            feedback: "A bond sells at par only if its coupon equals the par yield for the curve.",
          }),
          distractor("VAR_OTHER_UNKNOWN", asSpot, `${sumOf(range(1, n).map((t) => `${lit(t === n ? c + F : c)}*(1+${lit(fwd[t - 1])})**(-${t})`))}`, {
            derivation: `one-year forward rates used as spot rates: $${shown(asSpot, fmt)}$`,
            method: "Used one-year forward rates in place of spot rates.",
            feedback: "Forward rates apply to one year each; a cash flow at time t is discounted by the product of t of them, which is $(1 + s_t)^{-t}$.",
          }),
          distractor("ALLOC_EVEN_SPLIT", avgP, `${sumOf(range(1, n).map((t) => `${lit(t === n ? c + F : c)}*(1+${lit(avg)})**(-${t})`))}`, {
            derivation: `average spot rate ${dec(avg, 4)}: $${shown(avgP, fmt)}$`,
            method: "Discounted everything at the average spot rate.",
            feedback: "Averaging the rates has no financial meaning here; each flow has its own rate.",
          }),
          distractor("CONC_IGNORED_REDEMPTION", c * sumv, `${lit(c)}*${sumvE}`, {
            derivation: `coupons only: $${shown(c * sumv, fmt)}$`,
            method: "Valued only the coupons.",
            feedback: "Include the par amount at maturity.",
          }),
        ],
        explanation: spotExplanation({ s, n, value: P, fmt, par: false, c, F }),
        visuals: [{ kind: "curve", title: "Spot curve", points: s.map((rate, idx) => ({ t: idx + 1, spot: rate })) }],
        markers: [sumv, vt(n)],
        presentation: ["direct"],
        features: features({ steps: 2 }),
        chain: chain(
          [
            step("F.spot", "Discount factor for each cash-flow date.", ["Σ v_t", sumv, "sum of discount factors"], ["s_1", "…", "s_n"]),
            step("F.spot-pricing", "Each cash flow at its own spot rate.", ["P", P, "price"], ["c", "F", "v_t"]),
          ],
          {
            stages: {
              MODEL_SINGLE_RATE: [1, "selection"],
              VAR_OTHER_UNKNOWN: [0, "selection", "F.forward"],
              ALLOC_EVEN_SPLIT: [1, "selection"],
              CONC_IGNORED_REDEMPTION: [1, "application"],
              CONC_PAR_ASSUMPTION: [1, "selection"],
            },
            reasoning: "Strip the bond into zero-coupon pieces and price each piece.",
          }
        ),
        params: { n, c, ...Object.fromEntries(s.map((rate, idx) => [`s${idx + 1}`, rate])) },
      };
    }

    const par = (1 - vt(n)) / sumv;
    const fmt = PCT3;
    const avg = s.reduce((a, b) => a + b, 0) / n;
    return {
      stem: `Annual effective spot rates are ${spotList(s)}.\n\nCalculate the annual coupon rate of an ${word(n)}-year bond with annual coupons that sells at par.`,
      answer: {
        value: par,
        calc: `(1 - ${spotV(s, n)})/${sumvE}`,
        format: fmt,
        derivation: `$c = \\dfrac{1 - v_{${n}}}{\\sum v_t} = \\dfrac{1 - ${dec(vt(n), 6)}}{${dec(sumv, 6)}} = ${shown(par, fmt)}$`,
      },
      model: {
        expr: `${range(1, n).map((t) => `${t === n ? "(x+1)" : "x"}/(1+${lit(s[t - 1])})**${t}`).join(" + ")} - 1`,
        bracket: [0.0001, 0.3],
        description: "A coupon c per unit of par: the bond's price at the spot curve equals 1.",
      },
      distractors: [
        distractor("MODEL_SINGLE_RATE", s[n - 1], lit(s[n - 1]), {
          derivation: `$s_{${n}} = ${shown(s[n - 1], fmt)}$`,
          method: `Took the ${n}-year spot rate as the par coupon.`,
          feedback: "The par coupon blends every spot rate up to maturity; with a rising curve it lies below the longest spot rate.",
        }),
        distractor("ALLOC_EVEN_SPLIT", avg, `(${s.map(lit).join("+")})/${n}`, {
          derivation: `average spot rate $= ${shown(avg, fmt)}$`,
          method: "Averaged the spot rates.",
          feedback: "The par coupon weights each year's rate by its discount factor; a simple average ignores that.",
        }),
        distractor("CONC_IGNORED_REDEMPTION", 1 / sumv, `1/${sumvE}`, {
          derivation: `$1/\\sum v_t = ${shown(1 / sumv, fmt)}$`,
          method: "Set the coupons alone equal to par.",
          feedback: "The redemption payment is worth $v_n$ per unit of par, which the coupons do not have to cover.",
        }),
        distractor("ALG_SIGN_ERROR", (1 + vt(n)) / sumv, `(1 + ${spotV(s, n)})/${sumvE}`, {
          derivation: `$\\dfrac{1 + v_{${n}}}{\\sum v_t} = ${shown((1 + vt(n)) / sumv, fmt)}$`,
          method: "Added the redemption's value instead of subtracting it.",
          feedback: "$c\\sum v_t + v_n = 1$, so $c = (1 - v_n)/\\sum v_t$.",
        }),
      ],
      explanation: spotExplanation({ s, n, value: par, fmt, par: true }),
      visuals: [{ kind: "curve", title: "Spot curve", points: s.map((rate, idx) => ({ t: idx + 1, spot: rate })) }],
      markers: [sumv, vt(n)],
      presentation: ["inverse", "rearrange-first"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("F.spot", "Discount factors from the spot curve.", ["Σ v_t", sumv, "sum of discount factors"], ["s_t"]),
          step("F.spot-pricing", "Par condition c·Σv_t + v_n = 1; solve for c.", ["c", par, "par coupon rate"], ["Σ v_t", "v_n"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "rearrangement"],
          stages: {
            MODEL_SINGLE_RATE: [1, "selection"],
            ALLOC_EVEN_SPLIT: [1, "selection"],
            CONC_IGNORED_REDEMPTION: [1, "application"],
            ALG_SIGN_ERROR: [1, "application"],
          },
          reasoning: "Selling at par means the bond's value per unit of face is exactly 1; that single equation fixes the coupon.",
        }
      ),
      params: { n, ...Object.fromEntries(s.map((rate, idx) => [`s${idx + 1}`, rate])) },
    };
  },
};

function spotExplanation(p: { s: number[]; n: number; value: number; fmt: AnswerFormat; par: boolean; c?: number; F?: number }) {
  const { s, n, value, fmt, par, c = 0, F = 0 } = p;
  const vt = (t: number) => Math.pow(1 + s[t - 1], -t);
  return explanation({
    intuition: "A coupon bond is a bundle of zero-coupon bonds: one for each coupon and one for the redemption. Each piece is priced at the spot rate for its own maturity.",
    translation: {
      unknowns: par ? [{ symbol: "$c$", meaning: "the par coupon rate" }] : [{ symbol: "$P$", meaning: "the bond's price" }],
      relationships: par ? ["$c\\sum_{t=1}^{n} v_t + v_n = 1$"] : [`$P = ${c}\\sum v_t + ${F}v_{${n}}$`],
      conditions: ["$v_t = (1 + s_t)^{-t}$"],
      valuationDate: "Time 0.",
      modelChoice: "Strip the bond into zero-coupon pieces.",
      assumptions: ["Annual cash flows on the curve's dates."],
    },
    solution: [
      { title: "Discount factors", body: range(1, n).map((t) => `$v_{${t}} = ${dec(vt(t), 6)}$`).join(", ") },
      { title: par ? "Par condition" : "Sum", body: par ? `$c(${dec(range(1, n).reduce((a, t) => a + vt(t), 0), 6)}) + ${dec(vt(n), 6)} = 1$` : `$${c}(${dec(range(1, n).reduce((a, t) => a + vt(t), 0), 6)}) + ${F}(${dec(vt(n), 6)})$` },
      { title: par ? "Coupon rate" : "Price", body: `$${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Bootstrap view",
        body: "Spot rates are what you get by stripping par bonds one maturity at a time; reversing that process gives this answer.",
        whenUseful: "Builds intuition for why every coupon needs its own rate.",
      },
    ],
    transfer: {
      principle: "Price = Σ cash flow × spot discount factor for its date; a yield to maturity is just a single rate that reproduces that price.",
      unusual: par ? "The unknown is the coupon rate." : "Several rates in one valuation.",
      misread: "Using one rate for every cash flow.",
    },
  });
}

// ===================================================================== Macaulay duration

const duration: QuestionTemplate = {
  id: "alm-duration",
  family: "alm-duration",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.duration",
  secondary: ["ALM.approx_pv_change", "BONDS.price_redemption"],
  reasoning: ["formula_retrieval", "concept_recognition", "arithmetic", "formula_selection"],
  soaConcept: "Macaulay duration of a set of cash flows or of a coupon bond.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.09, 0.005);
    const fmt = YEARS;
    let flows: Flow[];
    let stem: string;
    let isBond = false;
    if (lvl === 1) {
      const times = rng.shuffle([1, 2, 3, 4, 5]).slice(0, 3).sort((a, b) => a - b);
      flows = times.map((t) => ({ t, amount: gridAmount(rng, 1000, 10000, 500) }));
      stem = `An investment produces cash flows of ${flows.map((f) => amt(f.amount)).join(", ")} at the end of years ${flows.map((f) => f.t).join(", ")} respectively. The annual effective interest rate is ${pc(i)}.\n\nCalculate the Macaulay duration of the cash flows.`;
    } else {
      isBond = true;
      const n = rng.int(4, 10);
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      flows = range(1, n).map((t) => ({ t, amount: 1000 * r + (t === n ? 1000 : 0) }));
      stem = `A ${n}-year 1000 par bond pays annual coupons at a rate of ${pc(r)}. The annual effective yield is ${pc(i)}.\n\nCalculate the Macaulay duration of the bond.`;
    }
    const D = macaulayDuration(flows, i);
    const total = flows.reduce((acc, f) => acc + f.amount, 0);
    const undisc = flows.reduce((acc, f) => acc + f.t * f.amount, 0) / total;
    const modified = D / (1 + i);
    const P = pvFlows(flows, i);
    const half = flows.reduce((acc, f) => acc + f.t * f.amount * v(i, f.t), 0) / total;
    const avgTime = flows.reduce((acc, f) => acc + f.t, 0) / flows.length;
    const last = flows[flows.length - 1];
    const distractors = [
      distractor("MODEL_UNDISCOUNTED_WEIGHTS", undisc, `${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}`))}/${lit(total)}`, {
        derivation: `$\\dfrac{\\sum t\\,CF_t}{\\sum CF_t} = ${shown(undisc, fmt)}$`,
        method: "Weighted each time by its cash flow instead of its present value.",
        feedback: "Duration weights are present values: later cash flows count for less because they are discounted more.",
      }),
      distractor("FORMULA_MODIFIED_FOR_MACAULAY", modified, `(${durationExpr(flows, i)})/(1+${lit(i)})`, {
        derivation: `$D/(1 + i) = ${shown(modified, fmt)}$`,
        method: "Computed modified duration.",
        feedback: "Macaulay duration is the PV-weighted average time. Dividing by (1 + i) gives modified duration, a different measure.",
      }),
      distractor("ARITH_ORDER_OF_OPERATIONS", half, `${sumOf(flows.map((f) => `${f.t}*${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}/${lit(total)}`, {
        derivation: `$\\dfrac{\\sum t\\,CF_t v^t}{\\sum CF_t} = ${shown(half, fmt)}$`,
        method: "Discounted the numerator but not the denominator.",
        feedback: "Both sums must use present values; the denominator is the price.",
      }),
      distractor("ALLOC_EVEN_SPLIT", avgTime, `(${flows.map((f) => f.t).join("+")})/${flows.length}`, {
        derivation: `average of the times $= ${shown(avgTime, fmt)}$`,
        method: "Averaged the payment times.",
        feedback: "Times must be weighted by the present value of the cash flow at each time.",
      }),
    ];
    if (isBond) {
      const coupons = flows.map((f) => ({ t: f.t, amount: f.amount - (f.t === last.t ? 1000 : 0) }));
      const couponD = macaulayDuration(coupons, i);
      distractors.push(
        distractor("CONC_IGNORED_REDEMPTION", couponD, durationExpr(coupons, i), {
          derivation: `coupons only: $${shown(couponD, fmt)}$`,
          method: "Left the redemption payment out.",
          feedback: "The redemption is the largest cash flow and must be weighted at maturity.",
        }),
        distractor("TRANS_IGNORED_CONDITION", last.t, lit(last.t), {
          derivation: `maturity $= ${shown(last.t, fmt)}$`,
          method: "Treated the bond as a zero-coupon bond.",
          feedback: "Only a zero-coupon bond has duration equal to its maturity; coupons pull the duration earlier.",
        })
      );
    }
    return {
      stem,
      answer: {
        value: D,
        calc: durationExpr(flows, i),
        format: fmt,
        derivation: `$D = \\dfrac{\\sum t\\,CF_t v^t}{\\sum CF_t v^t} = \\dfrac{${mnum(D * P, 2)}}{${mnum(P, 2)}} = ${shown(D, fmt)}$`,
      },
      model: {
        expr: `(-(1+${lit(i)})*(${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)}+0.000001)**(-${f.t})`))} - ${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)}-0.000001)**(-${f.t})`))})/0.000002)/${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`))}`,
        description: "Duration as −(1 + i)·P′(i)/P(i), with the derivative taken numerically — a different route from the weighted-average definition.",
      },
      distractors,
      explanation: explanation({
        intuition: "Macaulay duration is the balance point of the cash flows on a timeline, when each cash flow is weighted by its present value. It answers: on average, when does the money arrive, in today's terms?",
        translation: {
          unknowns: [{ symbol: "$D$", meaning: "Macaulay duration" }],
          relationships: ["$D = \\dfrac{\\sum t\\,CF_t v^t}{\\sum CF_t v^t}$"],
          conditions: [`$i = ${mpc(i)}$`],
          valuationDate: "Time 0.",
          modelChoice: "PV-weighted average time.",
          assumptions: ["Flat yield curve at the stated rate."],
        },
        solution: [
          { title: "Present values", body: flows.map((f) => `$${mnum(f.amount * v(i, f.t), 2)}$ at $t = ${f.t}$`).join(", ") },
          { title: "Weighted times", body: `$\\sum t\\,PV_t = ${mnum(D * P, 2)}$, $\\sum PV_t = ${mnum(P, 2)}$` },
          { title: "Duration", body: `$D = ${shown(D, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Derivative definition",
            body: "$D = -(1 + i)\\dfrac{P'(i)}{P(i)}$",
            whenUseful: "Explains why duration measures price sensitivity.",
          },
        ],
        transfer: {
          principle: "Duration is a weighted average of times with PV weights; anything that shifts PV toward later dates raises it.",
          unusual: isBond ? "Coupons and redemption have very different weights." : "Irregular cash flows.",
          misread: "Undiscounted weights or modified duration are the usual confusions.",
        },
      }),
      visuals: [{ kind: "duration", title: "Present values balance at the duration", flows, rate: i }],
      markers: [P, D * P],
      presentation: ["direct"],
      features: features({ steps: 2, formulaRetrieval: true }),
      chain: chain(
        [
          step("G.price-function", "Present value of every cash flow.", ["P", P, "price"], ["CF_t", "i"]),
          step("G.macaulay", "PV-weighted average time.", ["D", D, "Macaulay duration"], ["t", "PV_t", "P"]),
        ],
        {
          stages: {
            MODEL_UNDISCOUNTED_WEIGHTS: [1, "application"],
            FORMULA_MODIFIED_FOR_MACAULAY: [1, "selection", "G.modified"],
            ARITH_ORDER_OF_OPERATIONS: [1, "application"],
            ALLOC_EVEN_SPLIT: [1, "selection"],
            CONC_IGNORED_REDEMPTION: [0, "application"],
            TRANS_IGNORED_CONDITION: [1, "selection"],
          },
          reasoning: "Duration is the balance point of the present values on a timeline: Σ t·PV_t / Σ PV_t.",
        }
      ),
      params: { i, flows: JSON.stringify(flows) },
    };
  },
};

// ===================================================================== first-order price approximations

const priceApprox: QuestionTemplate = {
  id: "alm-price-approx",
  family: "alm-duration",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration"],
  reasoning: ["formula_selection", "financial_intuition", "formula_retrieval"],
  soaConcept: "First-order approximations to a price change using modified or Macaulay duration.",
  generate(rng, lvl): QuestionDraft {
    const P = gridAmount(rng, 800, 1200, 5) + 0.5 * rng.int(0, 1);
    const D = rng.float(7, 15, 2);
    const i = gridRate(rng, 0.05, 0.09, 0.005);
    const up = rng.next() < 0.5;
    const di = gridRate(rng, 0.015, 0.03, 0.0025) * (up ? 1 : -1);
    const i2 = Number((i + di).toFixed(4));
    const fmt = MONEY2;
    const dir = up ? "increases" : "decreases";
    if (lvl === 1) {
      const est = P * (1 - (D / (1 + i)) * di);
      return {
        stem: `A bond has price ${amt(P)} and Macaulay duration ${D} years at an annual effective yield of ${pc(i)}. The yield ${dir} to ${pc(i2)}.\n\nUsing the first-order modified duration approximation, estimate the new price.`,
        answer: {
          value: est,
          calc: `${lit(P)}*(1 - ${lit(D)}/(1+${lit(i)})*(${lit(i2)}-${lit(i)}))`,
          format: fmt,
          derivation: `$P(1 - D_{mod}\\Delta i) = ${mamt(P)}(1 - ${dec(D / (1 + i), 4)} \\times ${dec(di, 4)}) = ${shown(est, fmt)}$`,
        },
        model: {
          expr: `${lit(P)} - ${lit(P)}*(${lit(D)}/(1+${lit(i)}))*(${lit(i2)} - ${lit(i)})`,
          description: "ΔP ≈ −P·D_mod·Δi with D_mod = D/(1 + i).",
        },
        distractors: [
          distractor("FORMULA_MODIFIED_FOR_MACAULAY", P * (1 - D * di), `${lit(P)}*(1 - ${lit(D)}*(${lit(i2)}-${lit(i)}))`, {
            derivation: `$${mamt(P)}(1 - ${D} \\times ${dec(di, 4)}) = ${shown(P * (1 - D * di), fmt)}$`,
            method: "Used Macaulay duration in the modified-duration formula.",
            feedback: "The modified approximation uses $D_{mod} = D/(1 + i)$.",
          }),
          distractor("CONC_PRICE_YIELD_DIRECTION", P * (1 + (D / (1 + i)) * di), `${lit(P)}*(1 + ${lit(D)}/(1+${lit(i)})*(${lit(i2)}-${lit(i)}))`, {
            derivation: `$${mamt(P)}(1 + ${dec(D / (1 + i), 4)} \\times ${dec(di, 4)}) = ${shown(P * (1 + (D / (1 + i)) * di), fmt)}$`,
            method: "Moved the price in the same direction as the yield.",
            feedback: `When yields ${up ? "rise" : "fall"}, prices ${up ? "fall" : "rise"}: $\\Delta P \\approx -P D_{mod}\\Delta i$.`,
          }),
          distractor("ALG_DIVIDE_ERROR", P * (1 - D * (1 + i) * di), `${lit(P)}*(1 - ${lit(D)}*(1+${lit(i)})*(${lit(i2)}-${lit(i)}))`, {
            derivation: `$D_{mod} = D(1 + i) = ${dec(D * (1 + i), 4)}$: $${shown(P * (1 - D * (1 + i) * di), fmt)}$`,
            method: "Multiplied by (1 + i) instead of dividing.",
            feedback: "Modified duration is smaller than Macaulay: $D/(1 + i)$.",
          }),
          distractor("VAR_OTHER_UNKNOWN", Math.abs(P * (D / (1 + i)) * di), `${lit(P)}*${lit(D)}/(1+${lit(i)})*${lit(Math.abs(di))}`, {
            derivation: `$|\\Delta P| = ${shown(Math.abs(P * (D / (1 + i)) * di), fmt)}$`,
            method: "Reported the size of the price change instead of the new price.",
            feedback: "The question asks for the new price: the old price plus the (signed) change.",
          }),
        ],
        explanation: approxExplanation({ P, D, i, i2, est, fmt, macaulay: false }),
        visuals: [{ kind: "duration", title: "The tangent-line approximation", flows: [{ t: D, amount: P * Math.pow(1 + i, D) }], rate: i, shock: di }],
        markers: [D / (1 + i), di],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("G.modified", "Convert Macaulay to modified duration.", ["D_mod", D / (1 + i), "modified duration"], ["D", "i"]),
            step("G.approx-modified", "Tangent-line estimate of the new price.", ["P(i')", est, "estimated price"], ["P", "D_mod", "Δi"]),
          ],
          {
            stages: {
              FORMULA_MODIFIED_FOR_MACAULAY: [0, "selection", "G.macaulay"],
              CONC_PRICE_YIELD_DIRECTION: [1, "application"],
              ALG_DIVIDE_ERROR: [0, "application"],
              VAR_OTHER_UNKNOWN: [1, "interpretation"],
            },
            reasoning: "P′(i) = −P·D_mod, so a small change Δi moves the price by about −P·D_mod·Δi.",
          }
        ),
        params: { P, D, i, i2 },
      };
    }

    const est = P * Math.pow((1 + i) / (1 + i2), D);
    return {
      stem: `A portfolio has present value ${amt(P)} and Macaulay duration ${D} years at an annual effective rate of ${pc(i)}. The rate ${dir} to ${pc(i2)}.\n\nUsing the first-order Macaulay approximation, estimate the new present value.`,
      answer: {
        value: est,
        calc: `${lit(P)}*((1+${lit(i)})/(1+${lit(i2)}))**${lit(D)}`,
        format: fmt,
        derivation: `$P\\left(\\dfrac{1 + i}{1 + i'}\\right)^{D} = ${mamt(P)}\\left(\\dfrac{${dec(1 + i, 4)}}{${dec(1 + i2, 4)}}\\right)^{${D}} = ${shown(est, fmt)}$`,
      },
      model: {
        expr: `${lit(P)}*(1+${lit(i)})**${lit(D)}*(1+${lit(i2)})**(-${lit(D)})`,
        description: "Treat the portfolio as a single payment at its duration: accumulate to time D at i, discount back at i′.",
      },
      distractors: [
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", P * (1 - (D / (1 + i)) * (i2 - i)), `${lit(P)}*(1 - ${lit(D)}/(1+${lit(i)})*(${lit(i2)}-${lit(i)}))`, {
          derivation: `modified approximation: $${shown(P * (1 - (D / (1 + i)) * (i2 - i)), fmt)}$`,
          method: "Used the modified-duration (linear) approximation.",
          feedback: "The question asks for the Macaulay approximation, which uses the ratio of accumulation factors raised to the power D.",
        }),
        distractor("CONC_PRICE_YIELD_DIRECTION", P * Math.pow((1 + i2) / (1 + i), D), `${lit(P)}*((1+${lit(i2)})/(1+${lit(i)}))**${lit(D)}`, {
          derivation: `$${mamt(P)}\\left(\\dfrac{${dec(1 + i2, 4)}}{${dec(1 + i, 4)}}\\right)^{${D}} = ${shown(P * Math.pow((1 + i2) / (1 + i), D), fmt)}$`,
          method: "Inverted the ratio, so the value moves with the rate.",
          feedback: "Higher rates mean lower present values: the ratio is (1 + i)/(1 + i′).",
        }),
        distractor("ALG_DIVIDE_ERROR", P * Math.pow((1 + i) / (1 + i2), D / (1 + i)), `${lit(P)}*((1+${lit(i)})/(1+${lit(i2)}))**(${lit(D)}/(1+${lit(i)}))`, {
          derivation: `exponent $D/(1+i)$: $${shown(P * Math.pow((1 + i) / (1 + i2), D / (1 + i)), fmt)}$`,
          method: "Used modified duration as the exponent.",
          feedback: "The Macaulay approximation raises the ratio to the Macaulay duration.",
        }),
        distractor("FORMULA_AV_FOR_PV", P * Math.pow(1 + i2 - i, -D), `${lit(P)}*(1+${lit(i2)}-${lit(i)})**(-${lit(D)})`, {
          derivation: `$${mamt(P)}(1 + \\Delta i)^{-${D}} = ${shown(P * Math.pow(1 + i2 - i, -D), fmt)}$`,
          method: "Discounted at the change in rate.",
          feedback: "The factor compares accumulation at the two rates; it is (1 + i)/(1 + i′), not 1/(1 + Δi).",
        }),
      ],
      explanation: approxExplanation({ P, D, i, i2, est, fmt, macaulay: true }),
      visuals: [{ kind: "duration", title: "One payment at time D approximates the portfolio", flows: [{ t: D, amount: P * Math.pow(1 + i, D) }], rate: i, shock: i2 - i }],
      markers: [(1 + i) / (1 + i2)],
      presentation: ["direct", "rearrange-first"],
      features: features({ steps: 2, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [step("G.approx-macaulay", "Treat the portfolio as one payment at time D and move it between the two rates.", ["P(i')", est, "estimated value"], ["P", "D", "i", "i'"])],
        {
          stages: {
            FORMULA_MODIFIED_FOR_MACAULAY: [0, "selection", "G.approx-modified"],
            CONC_PRICE_YIELD_DIRECTION: [0, "application"],
            ALG_DIVIDE_ERROR: [0, "application"],
            FORMULA_AV_FOR_PV: [0, "application"],
          },
          reasoning: "A single payment at time D worth P today is P(1 + i)^D at time D; discount that back at i′.",
        }
      ),
      params: { P, D, i, i2 },
    };
  },
};

function approxExplanation(p: { P: number; D: number; i: number; i2: number; est: number; fmt: AnswerFormat; macaulay: boolean }) {
  const { P, D, i, i2, est, fmt, macaulay } = p;
  return explanation({
    intuition: macaulay
      ? "Replace the whole portfolio by one payment due at its duration. Its value moves exactly like a zero-coupon bond of that maturity, which is a much better approximation than a straight line for large rate changes."
      : "Near the current yield, the price–yield curve looks like a straight line. Modified duration is (minus) the slope of that line as a fraction of price, so price changes by about −D_mod × Δi of itself.",
    translation: {
      unknowns: [{ symbol: "$P(i')$", meaning: "the new price/present value" }],
      relationships: macaulay ? ["$P(i') \\approx P(i)\\left(\\dfrac{1+i}{1+i'}\\right)^{D}$"] : ["$P(i') \\approx P(i)\\,(1 - D_{mod}(i' - i))$", "$D_{mod} = D/(1 + i)$"],
      conditions: [`$i = ${mpc(i)}$, $i' = ${mpc(i2)}$`],
      valuationDate: "Time 0 at both rates.",
      modelChoice: macaulay ? "Macaulay first-order approximation." : "Modified-duration (tangent-line) approximation.",
      assumptions: ["Parallel shift of a flat yield curve.", "First order only — convexity ignored."],
    },
    solution: macaulay
      ? [
          { title: "Ratio", body: `$\\dfrac{${dec(1 + i, 4)}}{${dec(1 + i2, 4)}} = ${dec((1 + i) / (1 + i2), 6)}$` },
          { title: "Power D", body: `$${dec((1 + i) / (1 + i2), 6)}^{${D}} = ${dec(Math.pow((1 + i) / (1 + i2), D), 6)}$` },
          { title: "Estimate", body: `$${shown(est, fmt)}$` },
        ]
      : [
          { title: "Modified duration", body: `$D_{mod} = ${D}/${dec(1 + i, 3)} = ${dec(D / (1 + i), 4)}$` },
          { title: "Relative change", body: `$-D_{mod}\\Delta i = ${dec(-(D / (1 + i)) * (i2 - i), 5)}$` },
          { title: "Estimate", body: `$${mamt(P)}(1 ${(i2 - i) > 0 ? "-" : "+"} ${dec(Math.abs((D / (1 + i)) * (i2 - i)), 5)}) = ${shown(est, fmt)}$` },
        ],
    alternatives: [
      {
        name: macaulay ? "Modified-duration estimate for comparison" : "Macaulay estimate for comparison",
        body: macaulay ? `$${mamt(P)}(1 - ${dec(D / (1 + i), 4)}\\,\\Delta i) = ${mnum(P * (1 - (D / (1 + i)) * (i2 - i)), 2)}$` : `$${mamt(P)}(\\tfrac{1+i}{1+i'})^{${D}} = ${mnum(P * Math.pow((1 + i) / (1 + i2), D), 2)}$`,
        whenUseful: "Seeing both shows how much the choice of approximation matters for this rate move.",
      },
    ],
    transfer: {
      principle: "First-order approximations: modified duration gives a tangent line; Macaulay duration treats the portfolio as one payment at time D.",
      unusual: macaulay ? "The less familiar of the two approximations is requested." : "Only Macaulay duration is given.",
      misread: "Mixing up which duration goes in which formula.",
    },
  });
}

// ===================================================================== convexity

const convexityTemplate: QuestionTemplate = {
  id: "alm-convexity",
  family: "alm-duration",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.convexity",
  secondary: ["ALM.duration", "ALM.redington"],
  reasoning: ["formula_retrieval", "formula_selection", "arithmetic"],
  soaConcept: "Convexity of a set of cash flows: P''(i)/P(i).",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const fmt = PLAIN;
    let flows: Flow[];
    let stem: string;
    if (lvl === 1) {
      const times = rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3).sort((a, b) => a - b);
      flows = times.map((t) => ({ t, amount: gridAmount(rng, 1000, 8000, 500) }));
      stem = `Cash flows of ${flows.map((f) => amt(f.amount)).join(", ")} are due at the end of years ${flows.map((f) => f.t).join(", ")} respectively. The annual effective interest rate is ${pc(i)}.\n\nCalculate the convexity of the cash flows, defined as $P''(i)/P(i)$.`;
    } else {
      const t1 = rng.int(2, 5);
      const t2 = t1 + rng.int(4, 10);
      const A = gridAmount(rng, 5000, 30000, 1000);
      const B = gridAmount(rng, 5000, 30000, 1000);
      flows = [
        { t: t1, amount: A * Math.pow(1 + i, t1) },
        { t: t2, amount: B * Math.pow(1 + i, t2) },
      ];
      stem = `A portfolio consists of zero-coupon bonds with present values ${amt(A)} (maturing in ${t1} years) and ${amt(B)} (maturing in ${t2} years), valued at an annual effective rate of ${pc(i)}.\n\nCalculate the convexity of the portfolio, defined as $P''(i)/P(i)$.`;
    }
    const C = convexity(flows, i);
    const P = pvFlows(flows, i);
    const mac = macaulayConvexity(flows, i);
    const noV2 = C * Math.pow(1 + i, 2);
    const total = flows.reduce((a, f) => a + f.amount, 0);
    const undisc = flows.reduce((a, f) => a + f.t * (f.t + 1) * f.amount, 0) / total / Math.pow(1 + i, 2);
    const tMinus = flows.reduce((a, f) => a + f.t * (f.t - 1) * f.amount * v(i, f.t + 2), 0) / P;
    const dSq = Math.pow(macaulayDuration(flows, i) / (1 + i), 2);
    const sumE = (weight: (t: number) => string, extra: number) =>
      sumOf(flows.map((f) => `${weight(f.t)}*${lit(f.amount)}*(1+${lit(i)})**(-${f.t + extra})`));
    const priceE = sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(i)})**(-${f.t})`));
    return {
      stem,
      answer: {
        value: C,
        calc: `${sumE((t) => `${t * (t + 1)}`, 2)}/${priceE}`,
        format: fmt,
        derivation: `$\\dfrac{\\sum t(t+1)CF_t v^{t+2}}{\\sum CF_t v^t} = ${shown(C, fmt)}$`,
      },
      model: {
        expr: `(${sumE((t) => `${t * t}`, 0)} + ${sumE((t) => `${t}`, 0)})/${priceE}/(1+${lit(i)})**2`,
        description: "Convexity through the identity C = (Σ t²w_t + Σ t w_t)/(1 + i)², with PV weights w_t — a different route from differentiating twice.",
      },
      distractors: [
        distractor("FORMULA_MACAULAY_CONVEXITY", mac, `${sumE((t) => `${t * t}`, 0)}/${priceE}`, {
          derivation: `$\\dfrac{\\sum t^2 CF_t v^t}{P} = ${shown(mac, fmt)}$`,
          method: "Computed Macaulay convexity.",
          feedback: "The definition here is P″(i)/P(i), which brings t(t + 1) and an extra $v^2$.",
        }),
        distractor("ARITH_ORDER_OF_OPERATIONS", noV2, `${sumE((t) => `${t * (t + 1)}`, 0)}/${priceE}`, {
          derivation: `$\\dfrac{\\sum t(t+1)CF_t v^{t}}{P} = ${shown(noV2, fmt)}$`,
          method: "Left out the extra $v^2$ from differentiating twice.",
          feedback: "Differentiating $v^t = (1+i)^{-t}$ twice gives $t(t+1)(1+i)^{-t-2}$.",
        }),
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", undisc, `${sumOf(flows.map((f) => `${f.t * (f.t + 1)}*${lit(f.amount)}`))}/${lit(total)}/(1+${lit(i)})**2`, {
          derivation: `undiscounted weights: $${shown(undisc, fmt)}$`,
          method: "Weighted by cash flows instead of present values.",
          feedback: "Convexity, like duration, weights each date by its present value.",
        }),
        distractor("SEQ_TERM_COUNT", tMinus, `${sumE((t) => `${t * (t - 1)}`, 2)}/${priceE}`, {
          derivation: `$\\dfrac{\\sum t(t-1)CF_t v^{t+2}}{P} = ${shown(tMinus, fmt)}$`,
          method: "Used t(t − 1) instead of t(t + 1).",
          feedback: "The exponent of v is −t, so the second derivative brings down t and then t + 1.",
        }),
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", dSq, `(${durationExpr(flows, i)}/(1+${lit(i)}))**2`, {
          derivation: `$D_{mod}^2 = ${shown(dSq, fmt)}$`,
          method: "Squared the modified duration.",
          feedback: "Convexity measures the spread of cash flows as well as their average timing; it is not the square of duration.",
        }),
      ],
      explanation: explanation({
        intuition: "Duration is the slope of the price–yield curve; convexity is its curvature. Cash flows spread far apart in time make the curve bend more, which is why barbell portfolios are more convex than bullets.",
        translation: {
          unknowns: [{ symbol: "$C$", meaning: "convexity $P''(i)/P(i)$" }],
          relationships: ["$P(i) = \\sum CF_t v^t$", "$P''(i) = \\sum t(t+1)CF_t v^{t+2}$"],
          conditions: [`$i = ${mpc(i)}$`],
          valuationDate: "Time 0.",
          modelChoice: "Differentiate the price twice.",
          assumptions: ["Flat yield curve."],
        },
        solution: [
          { title: "Price", body: `$P = ${mnum(P, 2)}$` },
          { title: "Second derivative", body: `$P'' = ${mnum(C * P, 2)}$` },
          { title: "Convexity", body: `$C = ${shown(C, fmt)}$` },
        ],
        alternatives: [
          {
            name: "From Macaulay convexity",
            body: "$C = \\dfrac{\\bar{C}_{mac} + D}{(1+i)^2}$, where $\\bar{C}_{mac} = \\sum t^2 w_t$.",
            whenUseful: "If you already have the PV weights for duration, this reuses them.",
          },
        ],
        transfer: {
          principle: "Every sensitivity measure is a derivative of the same price function divided by price.",
          unusual: lvl === 2 ? "The portfolio is described by present values, not cash flows." : "Irregular cash flows.",
          misread: "The definition in use (P″/P versus Macaulay convexity) changes the answer.",
        },
      }),
      visuals: [{ kind: "duration", title: "Curvature of the price–yield curve", flows, rate: i, shock: 0.02 }],
      markers: [P, C * P],
      presentation: lvl === 2 ? ["indirect-wording"] : ["direct"],
      features: features({ steps: 2, formulaRetrieval: true, unfamiliar: lvl === 2 }),
      chain: chain(
        [
          step("G.price-function", "Present value of the cash flows.", ["P", P, "price"], ["CF_t", "i"]),
          step("G.convexity", "Second derivative of price over price.", ["C", C, "convexity"], ["t(t+1)", "v^{t+2}", "P"]),
        ],
        {
          stages: {
            FORMULA_MACAULAY_CONVEXITY: [1, "selection", "G.macaulay-convexity"],
            ARITH_ORDER_OF_OPERATIONS: [1, "application"],
            MODEL_UNDISCOUNTED_WEIGHTS: [1, "application"],
            SEQ_TERM_COUNT: [1, "application"],
            FORMULA_MODIFIED_FOR_MACAULAY: [1, "selection", "G.modified"],
          },
          reasoning: "Differentiate Σ CF_t(1 + i)^{−t} twice: each term brings down t(t + 1) and two extra factors of v.",
        }
      ),
      params: { i, flows: JSON.stringify(flows) },
    };
  },
};

// ===================================================================== Redington immunization (simultaneous equations)

const redington: QuestionTemplate = {
  id: "alm-redington",
  family: "alm-immunization",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.redington",
  secondary: ["ALM.duration", "ALM.portfolio"],
  reasoning: ["simultaneous_equations", "translation", "cashflow_modelling", "algebra", "multistep"],
  soaConcept: "Two zero-coupon assets chosen to match the present value and duration of liabilities.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const t1 = rng.int(1, 4);
    const t2 = t1 + rng.int(6, 12);
    const fmt = MONEY0;
    let liabilities: Flow[];
    if (lvl === 2) {
      const T = rng.int(t1 + 2, t2 - 2);
      liabilities = [{ t: T, amount: gridAmount(rng, 50000, 500000, 10000) }];
    } else {
      const T1 = rng.int(t1 + 1, t2 - 3);
      const T2 = rng.int(T1 + 1, t2 - 1);
      liabilities = [
        { t: T1, amount: gridAmount(rng, 20000, 200000, 5000) },
        { t: T2, amount: gridAmount(rng, 20000, 200000, 5000) },
      ];
    }
    const PVL = pvFlows(liabilities, i);
    const DL = macaulayDuration(liabilities, i);
    const y2 = (PVL * (DL - t1)) / (t2 - t1);
    const y1 = PVL - y2;
    const askLong = lvl === 2;
    const ask = askLong ? y2 * Math.pow(1 + i, t2) : y1 * Math.pow(1 + i, t1);
    const askT = askLong ? t2 : t1;
    const liabE = sumOf(liabilities.map((l) => `${lit(l.amount)}*(1+${lit(i)})**(-${l.t})`));
    const durNumE = sumOf(liabilities.map((l) => `${l.t}*${lit(l.amount)}*(1+${lit(i)})**(-${l.t})`));
    const DLE = `(${durNumE}/${liabE})`;
    const yLongE = `(${liabE}*(${DLE}-${t1})/${t2 - t1})`;
    const yShortE = `(${liabE} - ${yLongE})`;
    const answerCalc = askLong ? `${yLongE}*(1+${lit(i)})**${t2}` : `${yShortE}*(1+${lit(i)})**${t1}`;
    const totalL = liabilities.reduce((a, l) => a + l.amount, 0);
    const avgT = liabilities.reduce((a, l) => a + l.t * l.amount, 0) / totalL;
    const faceWeight = askLong ? (totalL * (avgT - t1)) / (t2 - t1) : (totalL * (t2 - avgT)) / (t2 - t1);
    const swapped = askLong ? y1 * Math.pow(1 + i, t2) : y2 * Math.pow(1 + i, t1);
    const pvOnly = askLong ? y2 : y1;
    const even = (PVL / 2) * Math.pow(1 + i, askT);
    const liabText = liabilities.map((l) => `${amt(l.amount)} at the end of year ${l.t}`).join(" and ");
    return {
      stem: `A company must pay ${liabText}. It will buy two zero-coupon bonds, one maturing at the end of year ${t1} and one maturing at the end of year ${t2}, so that the present value and the Macaulay duration of its assets equal those of its liabilities at an annual effective rate of ${pc(i)}.\n\nCalculate the amount the company will receive at the end of year ${askT}.`,
      answer: {
        value: ask,
        calc: answerCalc,
        format: fmt,
        derivation: `PV in the ${askLong ? "long" : "short"} bond $= ${mnum(askLong ? y2 : y1, 2)}$; maturity amount $= ${mnum(askLong ? y2 : y1, 2)}(1+i)^{${askT}} = ${shown(ask, fmt)}$`,
      },
      model: {
        expr: askLong
          ? `(${liabE} - x*(1+${lit(i)})**(-${t2}))*${t1} + x*(1+${lit(i)})**(-${t2})*${t2} - ${durNumE}`
          : `x*(1+${lit(i)})**(-${t1})*${t1} + (${liabE} - x*(1+${lit(i)})**(-${t1}))*${t2} - ${durNumE}`,
        bracket: [0, 50 * totalL],
        description: "Write the other bond's PV as (PV of liabilities − this bond's PV) and require Σ t·PV to match the liabilities.",
      },
      distractors: [
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", faceWeight, askLong ? `${lit(totalL)}*(${sumOf(liabilities.map((l) => `${l.t}*${lit(l.amount)}`))}/${lit(totalL)} - ${t1})/${t2 - t1}` : `${lit(totalL)}*(${t2} - ${sumOf(liabilities.map((l) => `${l.t}*${lit(l.amount)}`))}/${lit(totalL)})/${t2 - t1}`, {
          derivation: `matching face amounts and face-weighted times: $${shown(faceWeight, fmt)}$`,
          method: "Matched the undiscounted liability amounts and times.",
          feedback: "Immunization matches present values and PV-weighted durations; face amounts at different dates are not comparable.",
        }),
        distractor("ALLOC_SWAPPED", swapped, askLong ? `${yShortE}*(1+${lit(i)})**${t2}` : `${yLongE}*(1+${lit(i)})**${t1}`, {
          derivation: `other bond's PV, grown to year ${askT}: $${shown(swapped, fmt)}$`,
          method: "Attached the short bond's share to the long bond (or vice versa).",
          feedback: `The bond further from the liability duration gets the smaller share: PV share of the year-${t2} bond is $(D_L - ${t1})/(${t2} - ${t1})$.`,
        }),
        distractor("VAR_FACE_FOR_PRICE", pvOnly, askLong ? yLongE : yShortE, {
          derivation: `present value $= ${shown(pvOnly, fmt)}$`,
          method: "Reported the amount invested today instead of the amount received at maturity.",
          feedback: `The question asks for the payment at year ${askT}; accumulate the PV for ${askT} years.`,
        }),
        distractor("ALLOC_EVEN_SPLIT", even, `${liabE}/2*(1+${lit(i)})**${askT}`, {
          derivation: `half the PV, grown: $${shown(even, fmt)}$`,
          method: "Split the present value equally between the two bonds.",
          feedback: "An equal split matches PV but not duration, unless the liability duration is exactly halfway.",
        }),
      ],
      explanation: explanation({
        intuition: "Think of a see-saw on a timeline. The liabilities balance at their duration. Two asset bonds sit either side; to balance at the same point with the same total weight, the bond nearer the balance point must carry more weight. That gives two equations in two unknowns.",
        translation: {
          unknowns: [
            { symbol: "$A$", meaning: `PV invested in the year-${t1} bond` },
            { symbol: "$B$", meaning: `PV invested in the year-${t2} bond` },
          ],
          relationships: [`$A + B = PV_L = ${mnum(PVL, 2)}$`, `$${t1}A + ${t2}B = D_L\\,PV_L$, with $D_L = ${dec(DL, 4)}$`],
          conditions: ["PV match.", "Duration match."],
          valuationDate: "Time 0 for PVs; maturity for the amount received.",
          modelChoice: "Two linear equations; solve by substitution or elimination.",
          assumptions: ["Flat yield curve.", "Redington: assets bracket the liabilities, so convexity of assets exceeds that of liabilities."],
        },
        solution: [
          { title: "Liability PV and duration", body: `$PV_L = ${mnum(PVL, 2)}$, $D_L = ${dec(DL, 4)}$` },
          { title: "Solve", body: `$B = PV_L\\dfrac{D_L - ${t1}}{${t2} - ${t1}} = ${mnum(y2, 2)}$, $A = ${mnum(y1, 2)}$` },
          { title: "Amount at maturity", body: `$${mnum(askLong ? y2 : y1, 2)}(${dec(1 + i, 3)})^{${askT}} = ${shown(ask, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Elimination",
            body: `Multiply the PV equation by ${t1} and subtract it from the duration equation: $(${t2} - ${t1})B = (D_L - ${t1})PV_L$.`,
            whenUseful: "The cleanest route: one subtraction eliminates A.",
          },
          {
            name: "Weights on a line",
            body: "The PV share in each bond is its distance from the far end over the total distance — the lever rule.",
            whenUseful: "Fast sanity check: the shares must be between 0 and 1.",
          },
        ],
        transfer: {
          principle: "Matching two conditions with two instruments is always a pair of linear equations in present values; translate maturity amounts last.",
          unusual: lvl === 3 ? "Two liabilities must first be combined into one PV and one duration." : "The answer is a maturity amount, not a present value.",
          misread: "Mixing face amounts with present values in the same equation.",
        },
      }),
      visuals: [
        {
          kind: "duration",
          title: "Assets bracket the liabilities",
          flows: [
            { t: t1, amount: y1 * Math.pow(1 + i, t1) },
            { t: t2, amount: y2 * Math.pow(1 + i, t2) },
          ],
          liabilities,
          rate: i,
          shock: 0.02,
        },
      ],
      markers: [PVL, DL, y1, y2],
      presentation: ["multi-equation", "combined-topics"],
      features: features({ steps: lvl === 3 ? 5 : 4, multiConcept: true, multipleValuationDates: true, unfamiliar: lvl === 3 }),
      chain: chain(
        [
          step("G.price-function", "Present value of the liabilities.", ["PV_L", PVL, "liability PV"], ["L_t", "i"]),
          step("G.macaulay", "Duration of the liabilities.", ["D_L", DL, "liability duration"], ["L_t"]),
          step("G.redington", "Assets must match PV and duration: two linear equations in the two PVs.", ["D_A = D_L", DL, "matched duration"], ["PV_L", "D_L"]),
          step("M.linear-system", "Eliminate one bond's PV.", [askLong ? "PV of long bond" : "PV of short bond", askLong ? y2 : y1, "amount invested"], ["equations"], { rearranged: true }),
          step("A.compound", "Grow the investment to its maturity.", ["face", ask, "amount received at maturity"], ["PV", "t"]),
        ],
        {
          methods: ["simultaneous", "elimination"],
          unconventional: lvl === 3,
          stages: {
            MODEL_UNDISCOUNTED_WEIGHTS: [2, "application"],
            ALLOC_SWAPPED: [3, "connection"],
            VAR_FACE_FOR_PRICE: [4, "interpretation"],
            ALLOC_EVEN_SPLIT: [3, "selection"],
          },
          reasoning: "A lever: total PV is fixed, and the PV-weighted time must balance at the liability duration.",
        }
      ),
      params: { i, t1, t2, liabilities: JSON.stringify(liabilities) },
    };
  },
};

// ===================================================================== full immunization

const fullImmunization: QuestionTemplate = {
  id: "alm-full-immunization",
  family: "alm-immunization",
  topic: "ALM",
  levels: [2, 3],
  objective: "ALM.full_immunization",
  secondary: ["ALM.duration", "ALM.redington"],
  reasoning: ["simultaneous_equations", "algebra", "valuation_dates", "multistep", "transfer"],
  soaConcept: "Full immunization of a single liability by asset cash flows either side of it.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const L = gridAmount(rng, 50000, 500000, 10000);
    const T = rng.int(6, 15);
    const a = rng.int(1, 4);
    const g = 1 + i;
    const { X } = drawUntil(
      () => ({ X: gridAmount(rng, Math.round((0.3 * L) / 1000) * 1000, Math.round((0.7 * L) / 1000) * 1000, 1000) }),
      ({ X: x }) => x * Math.pow(g, a) > 0.3 * L && x * Math.pow(g, a) < 0.75 * L
    );
    const XA = X * Math.pow(g, a);
    const b = (a * XA) / (L - XA);
    const Y = (L - XA) * Math.pow(g, b);
    const ga = `(1+${lit(i)})**${a}`;
    const bE = `(${a}*${lit(X)}*${ga}/(${lit(L)} - ${lit(X)}*${ga}))`;
    if (lvl === 2) {
      const fmt = YEARS;
      const undisc = (a * X) / (L - X);
      const inverted = (a * (L - XA)) / XA;
      const wrongDir = (a * X * Math.pow(g, -a)) / (L - X * Math.pow(g, -a));
      return {
        stem: `A liability of ${amt(L)} is due at the end of year ${T}. It is to be fully immunized at an annual effective rate of ${pc(i)} by an asset payment of ${amt(X)} at time ${T - a} and an asset payment of $Y$ at time ${T} + $b$.\n\nCalculate $b$.`,
        answer: {
          value: b,
          calc: bE,
          format: fmt,
          derivation: `$b = \\dfrac{${a}\\,X(1+i)^{${a}}}{L - X(1+i)^{${a}}} = \\dfrac{${a}(${mnum(XA, 2)})}{${mnum(L - XA, 2)}} = ${shown(b, fmt)}$`,
        },
        model: {
          expr: `${lit(X)}*(1+${lit(i)})**(-${T - a})*(${T - a}) + (${lit(L)}*(1+${lit(i)})**(-${T}) - ${lit(X)}*(1+${lit(i)})**(-${T - a}))*(${T}+x) - ${T}*${lit(L)}*(1+${lit(i)})**(-${T})`,
          bracket: [0.01, 40],
          description: "With the PV condition used to fix Y's present value, the duration condition Σ t·PV(asset) = T·PV(liability) is solved for b.",
        },
        distractors: [
          distractor("MODEL_UNDISCOUNTED_WEIGHTS", undisc, `${a}*${lit(X)}/(${lit(L)}-${lit(X)})`, {
            derivation: `$\\dfrac{${a}X}{L - X} = ${shown(undisc, fmt)}$`,
            method: "Balanced face amounts instead of values at time T.",
            feedback: `The asset at time ${T - a} is worth $X(1+i)^{${a}}$ at time ${T}; that is the amount that must be balanced.`,
          }),
          distractor("ALG_INVERTED_RATIO", inverted, `${a}*(${lit(L)} - ${lit(X)}*${ga})/(${lit(X)}*${ga})`, {
            derivation: `$\\dfrac{${a}(L - X(1+i)^{${a}})}{X(1+i)^{${a}}} = ${shown(inverted, fmt)}$`,
            method: "Inverted the balance ratio.",
            feedback: "The asset carrying more value sits closer to the liability: $a \\cdot V_1 = b \\cdot V_2$.",
          }),
          distractor("TRANS_IGNORED_CONDITION", a, lit(a), {
            derivation: `$b = a = ${shown(a, fmt)}$`,
            method: "Placed the second asset symmetrically about the liability.",
            feedback: "Symmetry works only if both assets have the same value at time T.",
          }),
          distractor("TIMING_VALUATION_DATE", wrongDir, `${a}*${lit(X)}*(1+${lit(i)})**(-${a})/(${lit(L)} - ${lit(X)}*(1+${lit(i)})**(-${a}))`, {
            derivation: `$\\dfrac{${a}Xv^{${a}}}{L - Xv^{${a}}} = ${shown(wrongDir, fmt)}$`,
            method: `Discounted the time-${T - a} asset to time ${T} instead of accumulating it.`,
            feedback: `Time ${T - a} is before time ${T}, so the asset accumulates by $(1+i)^{${a}}$.`,
          }),
        ],
        explanation: fullExplanation({ i, L, T, a, X, XA, b, Y, value: b, fmt, askY: false }),
        visuals: [
          {
            kind: "duration",
            title: "Assets either side of the liability",
            flows: [
              { t: T - a, amount: X },
              { t: T + b, amount: Y },
            ],
            liabilities: [{ t: T, amount: L }],
            rate: i,
            shock: 0.02,
          },
        ],
        markers: [XA, L - XA],
        presentation: ["multi-equation", "rearrange-first"],
        features: features({ steps: 3, multipleValuationDates: true, multiConcept: true }),
        chain: chain(
          [
            step("A.compound", "Value the early asset at the liability date.", ["X(1+i)^a", XA, "value at T"], ["X", "a"], { valuationDate: "T" }),
            step("G.full-immunization", "PV condition at T: the late asset supplies the rest.", ["Yv^b", L - XA, "late asset's value at T"], ["L", "X(1+i)^a"]),
            step("G.macaulay", "Duration condition about T: value × distance balances.", ["b", b, "time after T"], ["a", "values at T"], { rearranged: true, derived: true }),
          ],
          {
            methods: ["equation_construction", "substitution"],
            stages: {
              MODEL_UNDISCOUNTED_WEIGHTS: [0, "application"],
              ALG_INVERTED_RATIO: [2, "application"],
              TRANS_IGNORED_CONDITION: [2, "selection"],
              TIMING_VALUATION_DATE: [0, "application"],
            },
            reasoning: "Measure time from the liability date: matching duration then reads a·(early value) = b·(late value).",
          }
        ),
        params: { L, T, a, X, i },
      };
    }

    const fmt = MONEY0;
    const noGrow = L - XA;
    const face = L - X;
    const wrongDir = (L - X * Math.pow(g, -a)) * Math.pow(g, (a * X * Math.pow(g, -a)) / (L - X * Math.pow(g, -a)));
    const undiscB = (a * X) / (L - X);
    const undiscY = (L - XA) * Math.pow(g, undiscB);
    return {
      stem: `A liability of ${amt(L)} is due at the end of year ${T}. It is to be fully immunized at an annual effective rate of ${pc(i)} by two asset payments: ${amt(X)} at time ${T - a}, and $Y$ at some time after ${T}.\n\nCalculate $Y$.`,
      answer: {
        value: Y,
        calc: `(${lit(L)} - ${lit(X)}*${ga})*(1+${lit(i)})**${bE}`,
        format: fmt,
        derivation: `$b = ${dec(b, 4)}$, $Y = (L - X(1+i)^{${a}})(1+i)^{b} = ${mnum(L - XA, 2)}(${dec(1 + i, 3)})^{${dec(b, 4)}} = ${shown(Y, fmt)}$`,
      },
      model: {
        expr: `${lit(X)}*(1+${lit(i)})**${a} + x*(1+${lit(i)})**(-(${a}*${lit(X)}*(1+${lit(i)})**${a}/(${lit(L)} - ${lit(X)}*(1+${lit(i)})**${a}))) - ${lit(L)}`,
        bracket: [0, 3 * L],
        description: "PV at time T: the early asset accumulated plus Y discounted from T + b equals L, with b from the duration condition.",
      },
      distractors: [
        distractor("TIMING_MISSING_PERIOD", noGrow, `${lit(L)} - ${lit(X)}*${ga}`, {
          derivation: `$L - X(1+i)^{${a}} = ${shown(noGrow, fmt)}$`,
          method: `Stopped at the value needed at time ${T}.`,
          feedback: `Y is paid b years after time ${T}; its value at time ${T} must be accumulated to its own date.`,
        }),
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", face, `${lit(L)} - ${lit(X)}`, {
          derivation: `$L - X = ${shown(face, fmt)}$`,
          method: "Matched face amounts.",
          feedback: "Assets and liability are matched in value at a common date, not in face amount.",
        }),
        distractor("TIMING_VALUATION_DATE", wrongDir, `(${lit(L)} - ${lit(X)}*(1+${lit(i)})**(-${a}))*(1+${lit(i)})**(${a}*${lit(X)}*(1+${lit(i)})**(-${a})/(${lit(L)} - ${lit(X)}*(1+${lit(i)})**(-${a})))`, {
          derivation: `with $Xv^{${a}}$ in place of $X(1+i)^{${a}}$: $${shown(wrongDir, fmt)}$`,
          method: `Discounted the time-${T - a} asset to time ${T}.`,
          feedback: `An amount at an earlier date accumulates to time ${T}.`,
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", undiscY, `(${lit(L)} - ${lit(X)}*${ga})*(1+${lit(i)})**(${a}*${lit(X)}/(${lit(L)}-${lit(X)}))`, {
          derivation: `b from face amounts $= ${dec(undiscB, 4)}$: $${shown(undiscY, fmt)}$`,
          method: "Found b by balancing face amounts.",
          feedback: "The duration condition balances values at time T, not face amounts.",
        }),
      ],
      explanation: fullExplanation({ i, L, T, a, X, XA, b, Y, value: Y, fmt, askY: true }),
      visuals: [
        {
          kind: "duration",
          title: "Assets either side of the liability",
          flows: [
            { t: T - a, amount: X },
            { t: T + b, amount: Y },
          ],
          liabilities: [{ t: T, amount: L }],
          rate: i,
          shock: 0.02,
        },
      ],
      markers: [XA, b, L - XA],
      presentation: ["multi-equation", "work-backwards", "hidden-structure"],
      features: features({ steps: 4, multipleValuationDates: true, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.compound", "Value the early asset at the liability date.", ["X(1+i)^a", XA, "value at T"], ["X", "a"], { valuationDate: "T" }),
          step("G.full-immunization", "PV condition at T: the late asset's value at T.", ["Yv^b", L - XA, "late asset's value at T"], ["L"]),
          step("G.macaulay", "Duration balance fixes b.", ["b", b, "time after T"], ["a"], { rearranged: true, derived: true }),
          step("A.compound", "Grow the late asset's value at T to its own date.", ["Y", Y, "second asset payment"], ["b"]),
        ],
        {
          methods: ["equation_construction", "substitution", "work_backwards"],
          unconventional: true,
          stages: {
            TIMING_MISSING_PERIOD: [3, "connection"],
            MODEL_UNDISCOUNTED_WEIGHTS: [1, "application"],
            TIMING_VALUATION_DATE: [0, "application"],
            SEQ_UNDISCOUNTED_SUM: [2, "application"],
          },
          reasoning: "Two conditions, two unknowns (b and Y): use the PV condition for Y·v^b, the duration condition for b, then undo the discount.",
        }
      ),
      params: { L, T, a, X, i },
    };
  },
};

function fullExplanation(p: { i: number; L: number; T: number; a: number; X: number; XA: number; b: number; Y: number; value: number; fmt: AnswerFormat; askY: boolean }) {
  const { i, L, T, a, XA, b, value, fmt, askY } = p;
  return explanation({
    intuition: `Value everything at time ${T}, the liability date. The early asset has grown to ${mnum(XA, 0)}; the late asset is worth what is left of ${amt(L)}. For the duration to match, those two values must balance on a lever with the liability as the pivot: value × distance must be equal on both sides.`,
    translation: {
      unknowns: [
        { symbol: "$b$", meaning: `how long after time ${T} the second asset is paid` },
        { symbol: "$Y$", meaning: "the second asset payment" },
      ],
      relationships: [`$X(1+i)^{${a}} + Yv^{b} = ${mamt(L)}$ (value at time ${T})`, `$${a}\\,X(1+i)^{${a}} = b\\,Yv^{b}$ (duration about time ${T})`],
      conditions: ["Full immunization: PV match, duration match, one asset on each side."],
      valuationDate: `Time ${T} — measuring times from the liability turns duration matching into a lever balance.`,
      modelChoice: "Two equations in two unknowns; substitute the first into the second.",
      assumptions: ["Flat yield curve at the stated rate."],
    },
    solution: [
      { title: "Value of the early asset at T", body: `$${mamt(p.X)}(${dec(1 + i, 3)})^{${a}} = ${mnum(XA, 2)}$` },
      { title: "Balance", body: `$Yv^b = ${mnum(L - XA, 2)}$; $b = ${a} \\times ${mnum(XA, 2)} / ${mnum(L - XA, 2)} = ${dec(b, 4)}$` },
      askY ? { title: "Second asset", body: `$Y = ${mnum(L - XA, 2)}(${dec(1 + i, 3)})^{${dec(b, 4)}} = ${shown(value, fmt)}$` } : { title: "Result", body: `$b = ${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Equations at time 0",
        body: `$Xv^{${T - a}} + Yv^{${T}+b} = Lv^{${T}}$ and $(${T - a})Xv^{${T - a}} + (${T}+b)Yv^{${T}+b} = ${T}Lv^{${T}}$.`,
        whenUseful: "Gives the same answer but with heavier algebra; valuing at the liability date is a deliberate simplification.",
      },
    ],
    transfer: {
      principle: "Choose the valuation date that makes the condition simplest: duration matching about the liability date is a balance of value × distance.",
      unusual: askY ? "Y can only be found after b, so the order of solving matters." : "The unknown is a time.",
      misread: "Face amounts at different dates are not comparable — values at the pivot date are.",
    },
  });
}

// ===================================================================== cash-flow matching

const matching: QuestionTemplate = {
  id: "alm-cashflow-matching",
  family: "alm-matching",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.cash_flow_matching",
  secondary: ["BONDS.coupons", "ALM.portfolio"],
  reasoning: ["cashflow_modelling", "translation", "algebra", "multistep"],
  soaConcept: "Exact matching of liabilities with coupon bonds, solved from the last liability backwards.",
  generate(rng, lvl): QuestionDraft {
    const n = lvl === 1 ? 2 : 3;
    const coupons = range(2, n).map(() => gridRate(rng, 0.06, 0.12, 0.005));
    const L1 = gridAmount(rng, 20000, 60000, 1000);
    const Ls = [L1, ...range(2, n).map(() => gridAmount(rng, Math.round(L1 * 2.5 / 1000) * 1000, Math.round(L1 * 5 / 1000) * 1000, 1000))];
    // Work backwards: face of the n-year bond, then (n-1)-year bond, ..., then the 1-year zero.
    const faces: number[] = new Array(n + 1).fill(0);
    let remaining = [...Ls];
    for (let m = n; m >= 2; m -= 1) {
      const c = coupons[m - 2];
      faces[m] = remaining[m - 1] / (1 + c);
      for (let t = 1; t < m; t += 1) remaining[t - 1] -= c * faces[m];
    }
    faces[1] = remaining[0];
    const answer = faces[1];
    const fmt = MONEY0;
    // Mistakes.
    const ignoreCoupons = Ls[0];
    let wrong = [...Ls];
    const facesNoDivide: number[] = new Array(n + 1).fill(0);
    for (let m = n; m >= 2; m -= 1) {
      const c = coupons[m - 2];
      facesNoDivide[m] = wrong[m - 1];
      for (let t = 1; t < m; t += 1) wrong[t - 1] -= c * facesNoDivide[m];
    }
    const noDivide = wrong[0];
    wrong = [...Ls];
    const facesInverted: number[] = new Array(n + 1).fill(0);
    for (let m = n; m >= 2; m -= 1) {
      const c = coupons[m - 2];
      facesInverted[m] = wrong[m - 1] * (1 + c);
      for (let t = 1; t < m; t += 1) wrong[t - 1] -= c * facesInverted[m];
    }
    const inverted = wrong[0];
    const onlyLongest = Ls[0] - coupons[n - 2] * faces[n];
    const calc = buildMatchingCalc(Ls, coupons, n, "correct");
    const bondsText =
      n === 2
        ? `a one-year zero-coupon bond and a two-year bond with annual coupons at ${pc(coupons[0])}`
        : `a one-year zero-coupon bond, a two-year bond with annual coupons at ${pc(coupons[0])}, and a three-year bond with annual coupons at ${pc(coupons[1])}`;
    const distractors = [
      distractor("MODEL_IGNORED_COUPON", ignoreCoupons, lit(ignoreCoupons), {
        derivation: `$${mamt(Ls[0])} = ${shown(ignoreCoupons, fmt)}$`,
        method: "Ignored the coupons the longer bonds pay at time 1.",
        feedback: "The longer bonds also pay coupons at time 1; those coupons reduce how much the one-year bond must provide.",
      }),
      distractor("ALG_DIVIDE_ERROR", noDivide, buildMatchingCalc(Ls, coupons, n, "noDivide"), {
        derivation: `face of the ${n}-year bond taken as ${mamt(Ls[n - 1])}: $${shown(noDivide, fmt)}$`,
        method: `Bought face equal to the time-${n} liability.`,
        feedback: `At maturity the ${n}-year bond pays face plus a coupon, $F(1 + c)$; so $F = L_{${n}}/(1 + c)$.`,
      }),
      distractor("TRANS_INVERTED_RELATION", inverted, buildMatchingCalc(Ls, coupons, n, "inverted"), {
        derivation: `face $= L(1 + c)$: $${shown(inverted, fmt)}$`,
        method: "Multiplied by (1 + c) instead of dividing.",
        feedback: "Face plus coupon must equal the liability, so the face is the liability divided by (1 + c).",
      }),
      ...(n === 3
        ? [
            distractor("TRANS_IGNORED_CONDITION", onlyLongest, `${lit(Ls[0])} - ${lit(coupons[1])}*${lit(Ls[2])}/(1+${lit(coupons[1])})`, {
              derivation: `only the 3-year bond's coupon subtracted: $${shown(onlyLongest, fmt)}$`,
              method: "Subtracted only the longest bond's coupon at time 1.",
              feedback: "Both coupon bonds pay a coupon at time 1.",
            }),
          ]
        : []),
      distractor("ALG_SIGN_ERROR", 2 * Ls[0] - answer, `2*${lit(Ls[0])} - (${calc})`, {
        derivation: `coupons added at time 1: $${shown(2 * Ls[0] - answer, fmt)}$`,
        method: "Added the time-1 coupons to the liability instead of subtracting them.",
        feedback: "Coupons received at time 1 help pay the liability, so they reduce what the one-year bond must provide.",
      }),
      distractor("VAR_OTHER_UNKNOWN", faces[2], `${n === 2 ? `${lit(Ls[1])}/(1+${lit(coupons[0])})` : `(${lit(Ls[1])} - ${lit(coupons[1])}*${lit(Ls[2])}/(1+${lit(coupons[1])}))/(1+${lit(coupons[0])})`}`, {
        derivation: `face of the two-year bond $= ${shown(faces[2], fmt)}$`,
        method: "Reported the face amount of the two-year bond.",
        feedback: "The question asks for the one-year zero-coupon bond.",
      }),
      ...(lvl === 2
        ? [
            distractor("VAR_FACE_FOR_PRICE", answer / 1.045, `(${calc})/1.045`, {
              derivation: `$${mnum(answer, 2)}/1.045 = ${shown(answer / 1.045, fmt)}$`,
              method: "Reported the cost of the one-year bond instead of its face amount.",
              feedback: "The question asks for the face (maturity) amount, not its price.",
            }),
          ]
        : []),
    ];
    // Self-check: the bonds bought must reproduce every liability exactly.
    for (let t = 1; t <= n; t += 1) {
      let cash = t === 1 ? faces[1] : 0;
      for (let m = Math.max(2, t); m <= n; m += 1) cash += coupons[m - 2] * faces[m] + (m === t ? faces[m] : 0);
      if (Math.abs(cash - Ls[t - 1]) > 1e-6 * Ls[t - 1]) throw new Error("Matching portfolio does not reproduce the liabilities.");
    }
    const liabText = Ls.map((l, idx) => `${amt(l)} at the end of year ${idx + 1}`).join(", ");
    return {
      stem: `A company must pay ${liabText}. It will exactly match these liabilities by buying ${bondsText}, each redeemable at par.${lvl === 2 ? " The one-year zero-coupon bond yields 4.5%." : ""}\n\nCalculate the face amount of the one-year zero-coupon bond.`,
      answer: {
        value: answer,
        calc,
        format: fmt,
        derivation: `$F_1 = L_1 - \\text{coupons at time 1} = ${shown(answer, fmt)}$`,
      },
      model: {
        expr: n === 2
          ? `x + ${lit(coupons[0])}*${lit(Ls[1])}/(1+${lit(coupons[0])}) - ${lit(Ls[0])}`
          : `x + ${lit(coupons[0])}*(${lit(Ls[1])} - ${lit(coupons[1])}*${lit(Ls[2])}/(1+${lit(coupons[1])}))/(1+${lit(coupons[0])}) + ${lit(coupons[1])}*${lit(Ls[2])}/(1+${lit(coupons[1])}) - ${lit(Ls[0])}`,
        bracket: [-Ls[0], 2 * Ls[0]],
        description: "At time 1, the one-year bond plus every coupon received must equal the time-1 liability.",
      },
      distractors,
      explanation: explanation({
        intuition: `Only the ${n}-year bond pays anything at time ${n}, so it alone must cover the last liability. Once its size is fixed, its coupons at earlier dates are known, which tells you how much the next-longest bond must cover — and so on back to time 1.`,
        translation: {
          unknowns: range(1, n).map((t) => ({ symbol: `$F_${t}$`, meaning: `face amount of the ${t}-year bond` })),
          relationships: n === 2
            ? [`$F_2(1 + ${dec(coupons[0], 3)}) = ${mamt(Ls[1])}$`, `$F_1 + ${dec(coupons[0], 3)}F_2 = ${mamt(Ls[0])}$`]
            : [
                `$F_3(1 + ${dec(coupons[1], 3)}) = ${mamt(Ls[2])}$`,
                `$F_2(1 + ${dec(coupons[0], 3)}) + ${dec(coupons[1], 3)}F_3 = ${mamt(Ls[1])}$`,
                `$F_1 + ${dec(coupons[0], 3)}F_2 + ${dec(coupons[1], 3)}F_3 = ${mamt(Ls[0])}$`,
              ],
          conditions: ["Assets exactly equal liabilities at every date."],
          valuationDate: "Each liability date separately — no discounting is needed.",
          modelChoice: "Back-substitution from the longest maturity.",
          assumptions: ["Bonds can be bought in any face amount.", "Coupons are paid on face."],
        },
        solution: [
          { title: `Time ${n}`, body: `$F_${n} = ${mamt(Ls[n - 1])}/${dec(1 + coupons[n - 2], 3)} = ${mnum(faces[n], 2)}$` },
          ...(n === 3 ? [{ title: "Time 2", body: `$F_2 = (${mamt(Ls[1])} - ${dec(coupons[1], 3)} \\times ${mnum(faces[3], 2)})/${dec(1 + coupons[0], 3)} = ${mnum(faces[2], 2)}$` }] : []),
          { title: "Time 1", body: `$F_1 = ${mamt(Ls[0])} - ${n === 3 ? `${dec(coupons[0], 3)}(${mnum(faces[2], 2)}) - ${dec(coupons[1], 3)}(${mnum(faces[3], 2)})` : `${dec(coupons[0], 3)}(${mnum(faces[2], 2)})`} = ${shown(answer, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Cash-flow table",
            body: "Write a row per bond and a column per date, fill in coupons and redemptions, and require each column to sum to the liability.",
            whenUseful: "Best for three or more bonds — it makes every coupon visible.",
          },
        ],
        transfer: {
          principle: "In cash-flow matching, solve from the last date backwards: each longer bond's coupons are already-known income at earlier dates.",
          unusual: lvl === 2 ? "A yield is given but no discounting is needed." : "No interest rate is needed at all.",
          misread: "Forgetting that longer bonds pay coupons at earlier dates.",
        },
      }),
      visuals: [
        {
          kind: "flowchart",
          title: "Solve from the last liability backwards",
          nodes: [
            ...range(1, n).reverse().map((t) => ({ id: `t${t}`, label: `Time ${t}: liability ${amt(Ls[t - 1])}`, detail: `face $F_${t} = ${mnum(faces[t], 0)}$`, tone: (t === 1 ? "result" : "step") as "result" | "step" })),
          ],
          edges: range(2, n).reverse().map((t) => ({ from: `t${t}`, to: `t${t - 1}`, label: "coupons flow to earlier dates" })),
        },
      ],
      markers: [faces[n], ...(n === 3 ? [faces[2]] : [])],
      presentation: lvl === 2 ? ["work-backwards", "irrelevant-info", "multi-equation"] : ["work-backwards", "multi-equation"],
      features: features({ steps: n + 1, multiConcept: true, unfamiliar: lvl === 2 }),
      chain: (() => {
        const steps = [
          step("G.dedication", `The ${n}-year bond alone covers the last liability: face × (1 + coupon) = liability.`, [`F_${n}`, faces[n], "face of the longest bond"], [`L_${n}`], { rearranged: true }),
          ...(n === 3 ? [step("G.dedication", "The 2-year bond covers what is left at time 2 after the 3-year coupon.", ["F_2", faces[2], "face of the two-year bond"], ["L_2", "coupon"], { rearranged: true })] : []),
          step("M.linear-system", "Back-substitute: the one-year bond covers what the coupons leave at time 1.", ["F_1", answer, "face of the one-year bond"], ["L_1", "coupons"], { rearranged: true }),
        ];
        const last = steps.length - 1;
        return chain(steps, {
          methods: ["work_backwards", "substitution"],
          stages: {
            MODEL_IGNORED_COUPON: [last, "connection"],
            ALG_DIVIDE_ERROR: [0, "application"],
            TRANS_INVERTED_RELATION: [0, "application"],
            TRANS_IGNORED_CONDITION: [last, "connection"],
            ALG_SIGN_ERROR: [last, "application"],
            VAR_OTHER_UNKNOWN: [last, "interpretation"],
            VAR_FACE_FOR_PRICE: [last, "interpretation"],
          },
          reasoning: "Write a cash-flow table (bonds × dates) and require each date's column to equal the liability; solve from the last column.",
        });
      })(),
      params: { n, coupons: JSON.stringify(coupons), liabilities: JSON.stringify(Ls) },
    };
  },
};

/** Arithmetic for the matching answer (and its mistakes), written out from the parameters. */
function buildMatchingCalc(Ls: number[], coupons: number[], n: number, mode: "correct" | "noDivide" | "inverted"): string {
  const faceExpr = (L: string, c: number) => (mode === "correct" ? `(${L})/(1+${lit(c)})` : mode === "noDivide" ? `(${L})` : `(${L})*(1+${lit(c)})`);
  if (n === 2) {
    const F2 = faceExpr(lit(Ls[1]), coupons[0]);
    return `${lit(Ls[0])} - ${lit(coupons[0])}*${F2}`;
  }
  const F3 = faceExpr(lit(Ls[2]), coupons[1]);
  const F2 = faceExpr(`${lit(Ls[1])} - ${lit(coupons[1])}*${F3}`, coupons[0]);
  return `${lit(Ls[0])} - ${lit(coupons[0])}*${F2} - ${lit(coupons[1])}*${F3}`;
}

// ===================================================================== rates of return

const rateOfReturn: QuestionTemplate = {
  id: "alm-rate-of-return",
  family: "alm-returns",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.rates_of_return",
  secondary: ["TVM.equation_of_value"],
  reasoning: ["cashflow_modelling", "concept_recognition", "valuation_dates", "validation"],
  soaConcept: "Net present value and internal rate of return of a project's cash flows.",
  generate(rng, lvl): QuestionDraft {
    const O0 = gridAmount(rng, 50000, 200000, 5000);
    const O1 = gridAmount(rng, 10000, Math.round(O0 / 2 / 5000) * 5000, 5000);
    const years = rng.int(4, 6);
    const R = range(2, years).map(() => gridAmount(rng, Math.round((O0 * 0.3) / 1000) * 1000, Math.round((O0 * 0.55) / 1000) * 1000, 1000));
    const flows: Flow[] = [{ t: 0, amount: -O0 }, { t: 1, amount: -O1 }, ...R.map((amount, idx) => ({ t: idx + 2, amount }))];
    const rText = R.map((amount, idx) => `${amt(amount)} at the end of year ${idx + 2}`).join(", ");
    const stemBase = `A project requires an investment of ${amt(O0)} now and a further ${amt(O1)} at the end of year 1. It returns ${rText}.`;
    const npvAt = (rate: number, fl: Flow[]) => pvFlows(fl, rate);
    if (lvl === 1) {
      const r = gridRate(rng, 0.04, 0.1, 0.005);
      const npv = npvAt(r, flows);
      if (npv <= 0) throw new Error("NPV not positive; redraw.");
      const fmt = MONEY0;
      const undisc = flows.reduce((a, f) => a + f.amount, 0);
      const extra = -O0 + flows.filter((f) => f.t > 0).reduce((a, f) => a + f.amount * v(r, f.t + 1), 0);
      const ignore = npvAt(r, flows.filter((f) => f.t !== 1));
      const signFlip = npvAt(r, flows.map((f) => (f.t === 1 ? { ...f, amount: -f.amount } : f)));
      const flowE = (fl: Flow[]) => sumOf(fl.map((f) => `${lit(f.amount)}*(1+${lit(r)})**(-${f.t})`));
      return {
        stem: `${stemBase}\n\nCalculate the net present value of the project at an annual effective interest rate of ${pc(r)}.`,
        answer: {
          value: npv,
          calc: flowE(flows),
          format: fmt,
          derivation: `$-${mamt(O0)} - ${mamt(O1)}v + \\sum R_t v^t = ${shown(npv, fmt)}$`,
        },
        model: {
          expr: `(${sumOf(flows.map((f) => `${lit(f.amount)}*(1+${lit(r)})**(${years}-${f.t})`))})*(1+${lit(r)})**(-${years})`,
          description: `Accumulate every flow to time ${years}, then discount the total back — the same NPV by a different route.`,
        },
        distractors: [
          distractor("SEQ_UNDISCOUNTED_SUM", undisc, sumOf(flows.map((f) => lit(f.amount))), {
            derivation: `$\\sum CF_t = ${shown(undisc, fmt)}$`,
            method: "Added the cash flows without discounting.",
            feedback: "A net present value discounts every flow to time 0.",
          }),
          distractor("TIMING_EXTRA_PERIOD", extra, `${sumOf(flows.filter((f) => f.t > 0).map((f) => `${lit(f.amount)}*(1+${lit(r)})**(-${f.t + 1})`))} - ${lit(O0)}`, {
            derivation: `each later flow discounted one extra year: $${shown(extra, fmt)}$`,
            method: "Discounted each future flow one year too many.",
            feedback: "A flow at the end of year t is discounted by $v^t$.",
          }),
          distractor("TRANS_IGNORED_CONDITION", ignore, flowE(flows.filter((f) => f.t !== 1)), {
            derivation: `without the year-1 investment: $${shown(ignore, fmt)}$`,
            method: "Left out the second investment.",
            feedback: "Every outlay belongs in the NPV.",
          }),
          distractor("ALG_SIGN_ERROR", signFlip, flowE(flows.map((f) => (f.t === 1 ? { ...f, amount: -f.amount } : f))), {
            derivation: `year-1 investment added: $${shown(signFlip, fmt)}$`,
            method: "Treated the second investment as income.",
            feedback: "Money paid into the project is an outflow and has a negative sign.",
          }),
        ],
        explanation: returnExplanation({ flows, value: npv, fmt, npv: true, r }),
        visuals: [{ kind: "timeline", title: "Project cash flows", unit: "year", rate: r, flows: flows.map((f) => ({ t: f.t, amount: Math.abs(f.amount), dir: f.amount < 0 ? ("out" as const) : ("in" as const) })), valuationTimes: [0] }],
        markers: [npv],
        presentation: ["direct", "mixed-timing"],
        features: features({ steps: 2 }),
        chain: chain(
          [step("C.npv", "Discount every net cash flow at the required rate.", ["NPV", npv, "net present value"], ["CF_t", "r"])],
          {
            stages: {
              SEQ_UNDISCOUNTED_SUM: [0, "application"],
              TIMING_EXTRA_PERIOD: [0, "application"],
              TRANS_IGNORED_CONDITION: [0, "application"],
              ALG_SIGN_ERROR: [0, "application"],
            },
            reasoning: "An equation of value at time 0 with outflows negative.",
          }
        ),
        params: { O0, O1, R: JSON.stringify(R), r },
      };
    }

    const irr = solveRoot((x) => npvAt(x, flows), -0.5, 1);
    if (irr < 0.01 || irr > 0.3) throw new Error("IRR outside a sensible range; redraw.");
    const fmt = PCT3;
    const totalIn = R.reduce((a, b) => a + b, 0);
    const simple = solveRoot((x) => -O0 - O1 / (1 + x) + R.reduce((acc, amount, idx) => acc + amount / (1 + x * (idx + 2)), 0), -0.5, 2);
    const ignore = solveRoot((x) => npvAt(x, flows.filter((f) => f.t !== 1)), -0.5, 1);
    const atZero = solveRoot((x) => npvAt(x, [{ t: 0, amount: -O0 - O1 }, ...flows.filter((f) => f.t >= 2)]), -0.5, 1);
    const ratio = Math.pow(totalIn / (O0 + O1), 1 / years) - 1;
    const rootE = (fl: Flow[]) => sumOf(fl.map((f) => `${lit(f.amount)}*(1+x)**(-${f.t})`));
    return {
      stem: `${stemBase}\n\nCalculate the project's internal rate of return.`,
      answer: {
        value: irr,
        calc: rootE(flows),
        format: fmt,
        derivation: `$-${mamt(O0)} - ${mamt(O1)}v + \\sum R_t v^t = 0 \\Rightarrow i = ${shown(irr, fmt)}$`,
      },
      model: {
        expr: sumOf(flows.map((f) => `${lit(f.amount)}*(1+x)**(${years}-${f.t})`)),
        bracket: [0.001, 0.5],
        description: `The IRR makes the flows' accumulated value at time ${years} zero.`,
      },
      distractors: [
        distractor("TRANS_IGNORED_CONDITION", ignore, rootE(flows.filter((f) => f.t !== 1)), {
          derivation: `without the year-1 investment: $${shown(ignore, fmt)}$`,
          method: "Left out the second investment.",
          feedback: "All outlays belong in the equation of value.",
        }),
        distractor("TIMING_MISSING_PERIOD", atZero, rootE([{ t: 0, amount: -O0 - O1 }, ...flows.filter((f) => f.t >= 2)]), {
          derivation: `both investments at time 0: $${shown(atZero, fmt)}$`,
          method: "Treated the second investment as made at time 0.",
          feedback: "The second investment is made a year later, which slightly raises the return.",
        }),
        distractor("CONC_RETURN_ON_WRONG_BASE", ratio, `(${lit(totalIn)}/${lit(O0 + O1)})**(1/${years})-1`, {
          derivation: `$\\left(\\dfrac{${mamt(totalIn)}}{${mamt(O0 + O1)}}\\right)^{1/${years}} - 1 = ${shown(ratio, fmt)}$`,
          method: "Compared total receipts with total outlays over the whole period.",
          feedback: "Receipts arrive at different times, and earlier receipts are worth more; the IRR comes from an equation of value.",
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `${lit(-O0)} - ${lit(O1)}/(1+x) + ${sumOf(R.map((amount, idx) => `${lit(amount)}/(1+x*${idx + 2})`))}`, {
          derivation: `simple-interest discounting: $${shown(simple, fmt)}$`,
          method: "Discounted with simple interest.",
          feedback: "Rates of return compound.",
        }),
      ],
      explanation: returnExplanation({ flows, value: irr, fmt, npv: false }),
      visuals: [{ kind: "timeline", title: "Project cash flows", unit: "year", rate: irr, flows: flows.map((f) => ({ t: f.t, amount: Math.abs(f.amount), dir: f.amount < 0 ? ("out" as const) : ("in" as const) })), valuationTimes: [0] }],
      markers: [irr],
      presentation: ["unknown-rate", "mixed-timing"],
      features: features({ steps: 2, unfamiliar: true }),
      chain: chain(
        [
          step("C.npv", "Write the NPV as a function of the rate.", ["NPV(i)", 0, "zero at the IRR"], ["CF_t"]),
          step("C.irr", "Solve NPV(i) = 0 numerically.", ["IRR", irr, "internal rate of return"], ["NPV(i)"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "numerical_root"],
          stages: {
            TRANS_IGNORED_CONDITION: [0, "application"],
            TIMING_MISSING_PERIOD: [0, "application"],
            CONC_RETURN_ON_WRONG_BASE: [1, "selection"],
            MODEL_COMPOUND_AS_SIMPLE: [1, "selection", "A.simple"],
          },
          reasoning: "Try a rate: if the NPV is positive the IRR is higher. Bracket and narrow.",
        }
      ),
      params: { O0, O1, R: JSON.stringify(R) },
    };
  },
};

function returnExplanation(p: { flows: Flow[]; value: number; fmt: AnswerFormat; npv: boolean; r?: number }) {
  const { flows, value, fmt, npv, r = 0 } = p;
  return explanation({
    intuition: npv
      ? "NPV asks: if money costs r a year, is the project worth more than it costs, in today's money? Bring every outlay and receipt to time 0 at r and add them up."
      : "The IRR is the break-even interest rate: the rate at which the project's outlays and receipts have exactly the same present value.",
    translation: {
      unknowns: [{ symbol: npv ? "$NPV$" : "$i$", meaning: npv ? "the net present value" : "the internal rate of return" }],
      relationships: [npv ? "$NPV = \\sum CF_t v^t$" : "$\\sum CF_t (1+i)^{-t} = 0$"],
      conditions: ["Outflows negative, inflows positive."],
      valuationDate: "Time 0.",
      modelChoice: "Equation of value over all project cash flows.",
      assumptions: ["Cash flows at year ends.", "Annual effective rates."],
    },
    solution: [
      { title: "Cash flows", body: flows.map((f) => `$t=${f.t}: ${f.amount < 0 ? "-" : ""}${mamt(Math.abs(f.amount))}$`).join(", ") },
      { title: npv ? "Discount" : "Solve", body: npv ? `at ${mpc(r)}: $\\sum CF_t v^t$` : "Calculator IRR, or trial and error on the NPV." },
      { title: npv ? "NPV" : "IRR", body: `$${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Accumulate instead of discount",
        body: "Value every flow at the last date instead of at time 0; the sign and the root are unchanged.",
        whenUseful: "Useful when most cash flows are late in the project.",
      },
    ],
    transfer: {
      principle: "Every rate of return is the root of an equation of value; every NPV is an equation of value at a given rate.",
      unusual: "Two separate outlays.",
      misread: "Lumping outlays together, or ignoring when they occur.",
    },
  });
}

// ===================================================================== portfolio duration

const portfolio: QuestionTemplate = {
  id: "alm-portfolio-duration",
  family: "alm-portfolio",
  topic: "ALM",
  levels: [1, 2],
  objective: "ALM.portfolio",
  secondary: ["ALM.duration", "ALM.redington"],
  reasoning: ["translation", "simultaneous_equations", "formula_selection", "algebra"],
  soaConcept: "Building a portfolio with a target duration from two bonds.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.005);
    const DA = rng.float(2, 5, 2);
    const DB = rng.float(9, 15, 2);
    const target = rng.float(DA + 1.5, DB - 1.5, 2);
    const total = gridAmount(rng, 100000, 1000000, 10000);
    const pA = gridAmount(rng, 850, 1150, 5);
    const pB = gridAmount(rng, 750, 1250, 5);
    const fmt = MONEY0;
    const modified = lvl === 2;
    const DBgiven = modified ? Number((DB / (1 + i)).toFixed(4)) : DB;
    const DBused = modified ? DBgiven * (1 + i) : DB;
    const wBexact = (target - DA) / (DBused - DA);
    const investExact = total * wBexact;
    const faceExact = (investExact / pB) * 1000;
    const DBE = modified ? `(${lit(DBgiven)}*(1+${lit(i)}))` : lit(DB);
    const calc = `${lit(total)}*(${lit(target)}-${lit(DA)})/(${DBE}-${lit(DA)})/${lit(pB)}*1000`;
    const mixed = (total * ((target - DA) / (DBgiven - DA))) / pB * 1000;
    const swappedW = (DBused - target) / (DBused - DA);
    const evenF = (total / 2 / pB) * 1000;
    // Face-weighted mistake: durations averaged with face amounts as weights.
    const faceWeighted = solveRoot(
      (fB) => {
        const fA = ((total - (fB * pB) / 1000) / pA) * 1000;
        return (fA * DA + fB * DBused) / (fA + fB) - target;
      },
      0.000001,
      (total / pB) * 1000
    );
    return {
      stem: `An investor has ${amt(total)} to invest in two bonds. Bond A costs ${pA} per 1000 of face and has Macaulay duration ${DA} years. Bond B costs ${pB} per 1000 of face and has ${modified ? `modified duration ${DBgiven}` : `Macaulay duration ${DB} years`}. Durations are measured at an annual effective rate of ${pc(i)}. The investor wants the portfolio's Macaulay duration to be ${target} years.\n\nCalculate the face amount of Bond B the investor should buy.`,
      answer: {
        value: faceExact,
        calc,
        format: fmt,
        derivation: `$w_B = \\dfrac{${target} - ${DA}}{${dec(DBused, 4)} - ${DA}} = ${dec(wBexact, 5)}$; invest $${mnum(investExact, 2)}$, face $= ${mnum(investExact, 2)}/${pB} \\times 1000 = ${shown(faceExact, fmt)}$`,
      },
      model: {
        expr: `(${lit(total)} - x*${lit(pB)}/1000)*${lit(DA)} + x*${lit(pB)}/1000*${DBE} - ${lit(total)}*${lit(target)}`,
        bracket: [0, (total / pB) * 1000],
        description: "Portfolio duration is the PV-weighted average of the bonds' durations: Σ (amount invested × duration) = total × target.",
      },
      distractors: [
        distractor("VAR_FACE_FOR_PRICE", investExact, `${lit(total)}*(${lit(target)}-${lit(DA)})/(${DBE}-${lit(DA)})`, {
          derivation: `amount invested $= ${shown(investExact, fmt)}$`,
          method: "Reported the amount invested in Bond B rather than its face.",
          feedback: `Bond B costs ${pB} per 1000 face, so the face bought is the amount invested × 1000/${pB}.`,
        }),
        distractor("ALLOC_SWAPPED", (total * swappedW / pB) * 1000, `${lit(total)}*(${DBE}-${lit(target)})/(${DBE}-${lit(DA)})/${lit(pB)}*1000`, {
          derivation: `$w = \\dfrac{D_B - ${target}}{D_B - D_A}$: $${shown((total * swappedW / pB) * 1000, fmt)}$`,
          method: "Used Bond A's weight for Bond B.",
          feedback: "The weight on the long bond grows as the target moves toward its duration: $w_B = (D^* - D_A)/(D_B - D_A)$.",
        }),
        distractor("ALLOC_EVEN_SPLIT", evenF, `${lit(total)}/2/${lit(pB)}*1000`, {
          derivation: `half the money: $${shown(evenF, fmt)}$`,
          method: "Split the money evenly.",
          feedback: "An even split gives the midpoint of the two durations, which is not the target.",
        }),
        distractor("MODEL_UNDISCOUNTED_WEIGHTS", faceWeighted, `((${lit(total)} - x*${lit(pB)}/1000)/${lit(pA)}*1000*${lit(DA)} + x*${DBE})/((${lit(total)} - x*${lit(pB)}/1000)/${lit(pA)}*1000 + x) - ${lit(target)}`, {
          derivation: `durations weighted by face amount: $${shown(faceWeighted, fmt)}$`,
          method: "Weighted the durations by face amount.",
          feedback: "Portfolio duration weights each bond by its market value (price × quantity), not by face.",
        }),
        ...(modified
          ? [
              distractor("FORMULA_MODIFIED_FOR_MACAULAY", mixed, `${lit(total)}*(${lit(target)}-${lit(DA)})/(${lit(DBgiven)}-${lit(DA)})/${lit(pB)}*1000`, {
                derivation: `mixing modified and Macaulay: $${shown(mixed, fmt)}$`,
                method: "Averaged a modified duration with a Macaulay duration.",
                feedback: `Convert Bond B to Macaulay duration first: $D = D_{mod}(1 + i) = ${dec(DBused, 4)}$.`,
              }),
            ]
          : []),
      ],
      explanation: explanation({
        intuition: "A portfolio's duration is the average of its bonds' durations, weighted by how much money sits in each. Hitting a target duration is choosing where the balance point lies between the two bonds.",
        translation: {
          unknowns: [{ symbol: "$w_B$", meaning: "the fraction of the money in Bond B" }],
          relationships: [`$w_A D_A + w_B D_B = ${target}$`, "$w_A + w_B = 1$", `face of B $= w_B \\times ${mamt(total)} \\times 1000/${pB}$`],
          conditions: modified ? [`$D_B = D_{mod}(1 + i) = ${dec(DBused, 4)}$`] : ["Both durations are Macaulay."],
          valuationDate: "Time 0, at market prices.",
          modelChoice: "Two linear equations (weights sum to 1, weighted duration hits the target).",
          assumptions: ["Durations at the same rate.", "Weights are market values."],
        },
        solution: [
          ...(modified ? [{ title: "Convert", body: `$D_B = ${DBgiven} \\times ${dec(1 + i, 3)} = ${dec(DBused, 4)}$` }] : []),
          { title: "Weight", body: `$w_B = (${target} - ${DA})/(${dec(DBused, 4)} - ${DA}) = ${dec(wBexact, 5)}$` },
          { title: "Money in B", body: `$${dec(wBexact, 5)} \\times ${mamt(total)} = ${mnum(investExact, 2)}$` },
          { title: "Face of B", body: `$${mnum(investExact, 2)} \\times 1000/${pB} = ${shown(faceExact, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Substitution",
            body: `Let $x$ be the money in B: $(${mamt(total)} - x)${DA} + x\\,${dec(DBused, 4)} = ${mamt(total)} \\times ${target}$.`,
            whenUseful: "Avoids weights entirely; one equation in one unknown.",
          },
        ],
        transfer: {
          principle: "Portfolio duration = market-value-weighted average of component durations (all Macaulay, or all modified, at the same rate).",
          unusual: modified ? "The two durations are quoted on different bases." : "Prices per 1000 face separate money invested from face bought.",
          misread: "Face amounts are not weights; money invested is.",
        },
      }),
      visuals: [
        {
          kind: "allocation",
          title: "Splitting the money",
          parts: [
            { label: "Bond A", principal: total - investExact, interest: 0, detail: `duration ${DA}` },
            { label: "Bond B", principal: investExact, interest: 0, detail: `duration ${dec(DBused, 2)}` },
          ],
          total: { principal: total, interest: 0 },
          caption: `Target duration ${target}: the balance point between ${DA} and ${dec(DBused, 2)}.`,
        },
      ],
      markers: [wBexact, investExact],
      presentation: modified ? ["multi-equation", "combined-topics", "indirect-wording"] : ["multi-equation"],
      features: features({ steps: modified ? 4 : 3, multiConcept: modified, unfamiliar: modified }),
      chain: (() => {
        const steps = [
          ...(modified ? [step("G.modified", "Convert Bond B's modified duration to Macaulay.", ["D_B", DBused, "Macaulay duration of B"], ["D_mod", "i"], { rearranged: true })] : []),
          step("G.portfolio-duration", "Market-value weights must average the durations to the target.", ["w_B", wBexact, "fraction of money in B"], ["D_A", "D_B", "D*"], { rearranged: true }),
          step("E.price", "Money invested ÷ price per 1000 face gives the face bought.", ["face_B", faceExact, "face amount of B"], ["w_B", "total", "price"]),
        ];
        const w = modified ? 1 : 0;
        return chain(steps, {
          methods: ["simultaneous", "substitution"],
          unconventional: modified,
          stages: {
            VAR_FACE_FOR_PRICE: [w + 1, "interpretation"],
            ALLOC_SWAPPED: [w, "connection"],
            ALLOC_EVEN_SPLIT: [w, "selection"],
            MODEL_UNDISCOUNTED_WEIGHTS: [w, "application"],
            FORMULA_MODIFIED_FOR_MACAULAY: [0, "application"],
          },
          reasoning: "Let x be the money in B: (total − x)·D_A + x·D_B = total·D*, one linear equation.",
        });
      })(),
      params: { total, pA, pB, DA, DB: DBgiven, target, i },
    };
  },
};

export const ALM_TEMPLATES: QuestionTemplate[] = [
  forward,
  spotPricing,
  duration,
  priceApprox,
  convexityTemplate,
  redington,
  fullImmunization,
  matching,
  rateOfReturn,
  portfolio,
];

