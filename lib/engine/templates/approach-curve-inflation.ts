/**
 * Spot-rate and inflation families, each with several twists per level.
 *
 *   spot-bootstrap      spot and forward rates bootstrapped from coupon-bond prices
 *   spot-annuity-strip  zero-coupon prices hidden in a ladder of annuity prices
 *   infl-indexed-stream inflation-indexed annuities and perpetuities (nominal vs real)
 *   infl-indexed-bond   index-linked bonds: coupons and/or redemption indexed
 *   infl-savings-target saving for a goal stated in today's money
 */
import type { AnswerFormat, ChainStep, DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { bisect, compose, round2 } from "./approach-kit";
import { modelOf, valueOf, type Seg } from "./flows-kit";
import { MONEY2, amt, distractor, gridAmount, gridRate, lit, pc, shown, step } from "./kit";

const L = lit;
const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const pct = (x: number) => pc(x, 3);
const d = (id: Parameters<typeof distractor>[0], value: number, calc: string, fmt: AnswerFormat, method: string, feedback: string): DistractorCandidate =>
  distractor(id, value, calc, { derivation: `$= ${shown(value, fmt)}$`, method, feedback });
const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Rate x with Σ cf_t (1+x)^-t = price, by bisection. */
function irr(flows: { t: number; cf: number }[], price: number): number {
  return bisect((x) => flows.reduce((a, f) => a + f.cf * Math.pow(1 + x, -f.t), 0) - price, -0.5, 1);
}
const flowsE = (flows: { t: number; cf: number }[], x: string) => flows.map((f) => `${L(f.cf)}*(1+${x})**(-${f.t})`).join(" + ");

// ===================================================================== Bootstrapping from coupon bonds

const bootstrap: QuestionTemplate = {
  id: "spot-bootstrap",
  family: "spot-bootstrap",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "BONDS.yield"],
  reasoning: ["cashflow_modelling", "algebra", "concept_recognition", "multistep"],
  soaConcept: "Spot rates bootstrapped from the prices of coupon bonds, then forward rates, par yields or another bond's yield from the bootstrapped curve.",
  generate(rng, level): QuestionDraft {
    const fmt = PCT3;
    const s1 = gridRate(rng, 0.02, 0.04, 0.0025);
    const s2t = s1 + rng.choice([0.0075, 0.01, 0.0125, 0.015]);
    const s3t = s2t + rng.choice([0.0075, 0.01, 0.0125, 0.015]);
    const c2 = gridAmount(rng, 5, 10, 0.5);
    const c3 = gridAmount(rng, 5, 10, 0.5);
    const P2 = round2(c2 / (1 + s1) + (100 + c2) * Math.pow(1 + s2t, -2));
    const P3 = round2(c3 / (1 + s1) + c3 * Math.pow(1 + s2t, -2) + (100 + c3) * Math.pow(1 + s3t, -3));
    const V1 = 1 / (1 + s1);
    const V2 = (P2 - c2 * V1) / (100 + c2);
    const V3 = (P3 - c3 * (V1 + V2)) / (100 + c3);
    const V1E = `(1+${L(s1)})**(-1)`;
    const V2E = `((${L(P2)} - ${L(c2)}*${V1E})/${L(100 + c2)})`;
    const V3E = `((${L(P3)} - ${L(c3)}*(${V1E}+${V2E}))/${L(100 + c3)})`;
    const twist = rng.choice(["A", "B"]);
    const y2 = irr([{ t: 1, cf: c2 }, { t: 2, cf: 100 + c2 }], P2);
    const y3 = irr([{ t: 1, cf: c3 }, { t: 2, cf: c3 }, { t: 3, cf: 100 + c3 }], P3);
    const s2 = Math.pow(V2, -0.5) - 1;
    const s3 = Math.pow(V3, -1 / 3) - 1;
    const bond2 = `a 2-year bond with annual coupons at ${pc(c2 / 100)} sells for ${amt(P2)} per 100 of face`;
    const bond3 = `a 3-year bond with annual coupons at ${pc(c3 / 100)} sells for ${amt(P3)} per 100 of face`;
    const base = level === 1 ? `The 1-year spot rate is ${pct(s1)}, and ${bond2}.` : `The 1-year spot rate is ${pct(s1)}; ${bond2}; and ${bond3}.`;
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    const ds: DistractorCandidate[] = [];
    const steps = [step("F.spot-pricing", "Strip the 2-year bond: its first coupon is worth $c_2 v_1$, so the rest buys the 2-year zero.", ["v_2", V2, "2-year discount factor"], ["P_2", "s_1"], { rearranged: true })];
    const ytm2E = `${L(c2)}*(1+x)**(-1) + ${L(100 + c2)}*(1+x)**(-2) - ${L(P2)}`;
    const ytm3E = `${L(c3)}*(1+x)**(-1) + ${L(c3)}*(1+x)**(-2) + ${L(100 + c3)}*(1+x)**(-3) - ${L(P3)}`;
    let cp = 0;
    if (level === 1 && twist === "A") {
      value = s2;
      calc = `${V2E}**(-1/2)-1`;
      model = { expr: `${L(c2)}*${V1E} + ${L(100 + c2)}*(1+x)**(-2) - ${L(P2)}`, description: "The bond priced with the 1-year spot rate and the unknown 2-year spot rate." };
      ask = "Calculate the 2-year spot rate.";
      ds.push(
        distractor("CHAL_YTM_AS_SPOT", y2, ytm2E, { derivation: `$\\text{YTM} = ${shown(y2, fmt)}$`, method: "Took the bond's yield to maturity as the 2-year spot rate.", feedback: "A coupon bond's yield averages the 1- and 2-year rates; the spot rate prices only the year-2 cash flow." }),
        d("COMP_COUPON_BOND_AS_ZERO", Math.pow(P2 / (100 + c2), -0.5) - 1, `(${L(P2)}/${L(100 + c2)})**(-1/2)-1`, fmt, "Treated the whole price as buying the year-2 payment.", "Part of the price pays for the year-1 coupon."),
        d("CONC_ALM_FORWARD_NOT_ANNUALIZED", 1 / V2 - 1, `1/${V2E}-1`, fmt, "Left the 2-year rate unannualised.", "$(1+s_2)^2 = 1/v_2$: take the square root."),
        d("COMP_FORWARD_AS_SPOT", V1 / V2 - 1, `${V1E}/${V2E}-1`, fmt, "Gave the one-year forward rate for year 2.", "The spot rate averages years 1 and 2."),
        d("ALG_ROOT_ERROR", (1 / V2 - 1) / 2, `(1/${V2E}-1)/2`, fmt, "Halved the 2-year growth instead of taking its square root.", "$(1+s_2)^2 = 1/v_2$.")
      );
      steps.push(step("F.spot", "Annualise.", ["s_2", value, "2-year spot rate"], ["v_2"]));
    } else if (level === 1) {
      value = V1 / V2 - 1;
      calc = `${V1E}/${V2E}-1`;
      model = { expr: `${L(c2)}*${V1E} + ${L(100 + c2)}*${V1E}/(1+x) - ${L(P2)}`, description: "The bond priced with the 1-year spot rate and the year-2 forward rate." };
      ask = "Calculate the one-year forward rate from time 1 to time 2.";
      ds.push(
        d("FORMULA_ARITHMETIC_FORWARD", 2 * s2 - s1, `2*(${V2E}**(-1/2)-1) - ${L(s1)}`, fmt, "Used $2s_2 - s_1$.", "Forward rates compound: $1 + f = (1+s_2)^2/(1+s_1)$."),
        d("COMP_SPOT_AS_FORWARD", s2, `${V2E}**(-1/2)-1`, fmt, "Gave the 2-year spot rate.", "The forward rate is for year 2 alone."),
        d("CHAL_YTM_AS_SPOT", Math.pow(1 + y2, 2) / (1 + s1) - 1, `(1+${L(y2)})**2/(1+${L(s1)})-1`, fmt, "Used the bond's yield as the 2-year spot rate.", "Bootstrap the 2-year discount factor from the price first."),
        d("ALLOC_EVEN_SPLIT", (s1 + s2) / 2, `(${L(s1)} + ${V2E}**(-1/2)-1)/2`, fmt, "Averaged the 1- and 2-year spot rates.", "The forward rate is what year 2 alone earns: $(1+s_2)^2/(1+s_1) - 1$."),
        d("SEQ_TERM_COUNT", Math.sqrt(V1 / V2) - 1, `(${V1E}/${V2E})**(1/2)-1`, fmt, "Annualised the one-year forward rate over two years.", "From time 1 to time 2 is one year."),
        d("RATE_FORCE_AS_EFFECTIVE", Math.log(V1 / V2), `log(${V1E}/${V2E})`, fmt, "Took the logarithm of the ratio of discount factors.", "That is a forward force of interest; the effective rate is the ratio minus one.")
      );
      steps.push(step("F.forward", "Forward rate: ratio of discount factors.", ["f", value, "forward rate for year 2"], ["v_1", "v_2"]));
    } else {
      steps.push(step("F.spot-pricing", "Strip the 3-year bond with $v_1$ and $v_2$.", ["v_3", V3, "3-year discount factor"], ["P_3", "v_1", "v_2"], { rearranged: true }));
      if (level === 2 && twist === "A") {
        value = s3;
        calc = `${V3E}**(-1/3)-1`;
        model = { expr: `${L(c3)}*(${V1E}+${V2E}) + ${L(100 + c3)}*(1+x)**(-3) - ${L(P3)}`, description: "The 3-year bond priced with known 1- and 2-year discount factors and the unknown 3-year spot rate." };
        ask = "Calculate the 3-year spot rate.";
        const V3s = (P3 - c3 * (V1 + V1 * V1)) / (100 + c3);
        ds.push(
          distractor("CHAL_YTM_AS_SPOT", y3, ytm3E, { derivation: `$\\text{YTM} = ${shown(y3, fmt)}$`, method: "Took the 3-year bond's yield as the spot rate.", feedback: "Its yield blends all three years' rates." }),
          d("COMP_COUPON_BOND_AS_ZERO", Math.pow(P3 / (100 + c3), -1 / 3) - 1, `(${L(P3)}/${L(100 + c3)})**(-1/3)-1`, fmt, "Treated the whole price as buying the year-3 payment.", "Subtract the value of the year-1 and year-2 coupons."),
          d("CONC_ALM_FORWARD_NOT_ANNUALIZED", 1 / V3 - 1, `1/${V3E}-1`, fmt, "Left the 3-year rate unannualised.", "Take the cube root."),
          d("MODEL_SINGLE_RATE", Math.pow(V3s, -1 / 3) - 1, `((${L(P3)} - ${L(c3)}*(${V1E}+${V1E}**2))/${L(100 + c3)})**(-1/3)-1`, fmt, "Discounted the year-2 coupon at the 1-year spot rate.", "The year-2 coupon is discounted with $v_2$ from the 2-year bond."),
          d("COMP_FORWARD_AS_SPOT", V2 / V3 - 1, `${V2E}/${V3E}-1`, fmt, "Gave the forward rate for year 3.", "The spot rate averages all three years."),
          d("ALG_ROOT_ERROR", (1 / V3 - 1) / 3, `(1/${V3E}-1)/3`, fmt, "Divided the 3-year growth by 3 instead of taking the cube root.", "$(1+s_3)^3 = 1/v_3$.")
        );
        steps.push(step("F.spot", "Annualise.", ["s_3", value, "3-year spot rate"], ["v_3"]));
      } else if (level === 2) {
        value = Math.sqrt(V1 / V3) - 1;
        calc = `(${V1E}/${V3E})**(1/2)-1`;
        model = { expr: `${L(c3)}*(${V1E}+${V2E}) + ${L(100 + c3)}*${V1E}*(1+x)**(-2) - ${L(P3)}`, description: "The year-3 payment discounted two years at the forward rate and one year at the spot rate." };
        ask = "Calculate the annual effective forward rate for the two-year period from time 1 to time 3.";
        ds.push(
          d("FORMULA_ARITHMETIC_FORWARD", (3 * s3 - s1) / 2, `(3*(${V3E}**(-1/3)-1) - ${L(s1)})/2`, fmt, "Used $(3s_3 - s_1)/2$.", "Forward rates compound: $(1+f)^2 = (1+s_3)^3/(1+s_1)$."),
          d("CONC_ALM_FORWARD_NOT_ANNUALIZED", V1 / V3 - 1, `${V1E}/${V3E}-1`, fmt, "Gave the two-year forward growth without annualising.", "Take the square root for an annual rate."),
          d("COMP_SPOT_AS_FORWARD", s3, `${V3E}**(-1/3)-1`, fmt, "Gave the 3-year spot rate.", "The forward rate excludes year 1."),
          d("SEQ_TERM_COUNT", Math.pow(V1 / V3, 1 / 3) - 1, `(${V1E}/${V3E})**(1/3)-1`, fmt, "Annualised over three years.", "Time 1 to time 3 is two years."),
          d("CHAL_YTM_AS_SPOT", Math.sqrt(Math.pow(1 + y3, 3) / (1 + s1)) - 1, `((1+${L(y3)})**3/(1+${L(s1)}))**(1/2)-1`, fmt, "Used the 3-year bond's yield as the 3-year spot rate.", "Bootstrap $v_3$ first.")
        );
        steps.push(step("F.forward", "Two-year forward rate from the ratio of discount factors.", ["f", value, "forward rate, time 1 to 3"], ["v_1", "v_3"]));
      } else if (twist === "A") {
        value = (1 - V3) / (V1 + V2 + V3);
        calc = `(1-${V3E})/(${V1E}+${V2E}+${V3E})`;
        model = { expr: `x*(${V1E}+${V2E}+${V3E}) + ${V3E} - 1`, description: "A bond priced at par: coupons plus redemption equal the face." };
        ask = "Calculate the 3-year par yield, the coupon rate at which an annual-coupon 3-year bond sells at par.";
        const avg = (s1 + s2 + s3) / 3;
        ds.push(
          d("COMP_YIELD_AS_LONGEST_SPOT", s3, `${V3E}**(-1/3)-1`, fmt, "Took the 3-year spot rate.", "A par bond's coupons are paid earlier, at lower rates, so its yield is below the 3-year spot rate on an upward curve."),
          d("ALLOC_EVEN_SPLIT", avg, `(${L(s1)} + ${V2E}**(-1/2)-1 + ${V3E}**(-1/3)-1)/3`, fmt, "Averaged the three spot rates.", "Par yield weights the rates by discounted cash flows."),
          distractor("CHAL_YTM_AS_SPOT", y3, ytm3E, { derivation: `$${shown(y3, fmt)}$`, method: "Gave the yield of the given 3-year bond.", feedback: "That bond is not at par; its yield depends on its coupon." }),
          d("SEQ_TERM_COUNT", (1 - V3) / (V1 + V2), `(1-${V3E})/(${V1E}+${V2E})`, fmt, "Summed only two discount factors for the coupons.", "There are three coupons."),
          d("COMP_FORWARD_AS_SPOT", V2 / V3 - 1, `${V2E}/${V3E}-1`, fmt, "Took the forward rate for year 3.", "The par yield is a weighted average of the whole curve, not its last segment.")
        );
        steps.push(step("E.price", "A par bond's price equals its face: $c(v_1+v_2+v_3) + v_3 = 1$.", ["c", value, "par coupon rate"], ["v_1", "v_2", "v_3"], { rearranged: true }));
      } else {
        cp = gridAmount(rng, 2, 9, 0.5);
        if (Math.abs(cp - c3) < 0.5) cp = c3 + 1.5;
        const Pn = cp * (V1 + V2) + (100 + cp) * V3;
        const PnE = `(${L(cp)}*(${V1E}+${V2E}) + ${L(100 + cp)}*${V3E})`;
        value = irr([{ t: 1, cf: cp }, { t: 2, cf: cp }, { t: 3, cf: 100 + cp }], Pn);
        calc = `${L(cp)}*(1+x)**(-1) + ${L(cp)}*(1+x)**(-2) + ${L(100 + cp)}*(1+x)**(-3) - ${PnE}`;
        model = { expr: `${L(cp)}*(1-(1+x)**(-3))/x + 100*(1+x)**(-3) - ${PnE}`, bracket: [value - 0.02, value + 0.02], description: "Price from the curve set equal to the bond's cash flows at a single yield." };
        ask = `Calculate the annual effective yield to maturity of a 3-year bond with annual coupons at ${pc(cp / 100)}.`;
        const avg = (s1 + s2 + s3) / 3;
        ds.push(
          d("COMP_YIELD_AS_LONGEST_SPOT", s3, `${V3E}**(-1/3)-1`, fmt, "Took the 3-year spot rate.", "Coupons arrive earlier and are discounted at lower rates."),
          d("ALLOC_EVEN_SPLIT", avg, `(${L(s1)} + ${V2E}**(-1/2)-1 + ${V3E}**(-1/3)-1)/3`, fmt, "Averaged the spot rates.", "The yield weights each rate by its cash flow's present value."),
          d("CONC_BOND_YIELD_IS_COUPON_RATE", cp / 100, L(cp / 100), fmt, "Took the coupon rate.", "Only a par bond yields its coupon rate."),
          d("FORMULA_CURRENT_YIELD", cp / Pn, `${L(cp)}/${PnE}`, fmt, "Divided the coupon by the price.", "Current yield ignores the gain or loss at redemption."),
          distractor("CHAL_YTM_AS_SPOT", y3, ytm3E, { derivation: `$${shown(y3, fmt)}$`, method: "Gave the yield of the other 3-year bond.", feedback: "Bonds with different coupons have different yields on a sloped curve." }),
          d("COMP_FORWARD_AS_SPOT", V2 / V3 - 1, `${V2E}/${V3E}-1`, fmt, "Took the forward rate for year 3.", "The yield averages the whole curve.")
        );
        steps.push(step("F.spot-pricing", "Price the new bond with $v_1, v_2, v_3$.", ["P", Pn, "price per 100"], ["v_t"]));
        steps.push(step("M.root-finding", "Solve for the single yield that reproduces that price.", ["y", value, "yield to maturity"], ["P"], { rearranged: true }));
      }
    }
    return compose({
      stem: `${base} All rates are annual effective.\n\n${ask}`,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: ["work_backwards", "substitution"],
      reasoning: "Bootstrap: each coupon bond adds one new discount factor once the earlier ones are known.",
      intuition: "A coupon bond is a bundle of zero-coupon bonds. Knowing the 1-year rate, the 2-year bond's first coupon can be valued and removed, leaving the price of its year-2 payment alone — the 2-year discount factor. The 3-year bond then gives the 3-year factor the same way.",
      unknowns: [{ symbol: "$v_t$", meaning: "t-year discount factor" }],
      relationships: ["$P_2 = c_2 v_1 + (100 + c_2) v_2$", "$P_3 = c_3(v_1 + v_2) + (100 + c_3)v_3$", "$v_t = (1+s_t)^{-t}$"],
      conditions: ["Annual coupons; no arbitrage."],
      valuationDate: "Time 0",
      modelChoice: "Bootstrapping.",
      assumptions: ["Prices are consistent with one spot curve."],
      alternative: { name: "Solve directly in rates", body: "Write each bond's price with the unknown spot rate and solve — the same equations in different notation.", whenUseful: "When only one rate is unknown." },
      principle: "A yield to maturity is not a spot rate; strip coupon bonds into zeros.",
      unusual: level === 3 ? "The curve must be built before the question can be answered." : "The curve is hidden in coupon-bond prices.",
      misread: "The coupon bond's yield is not the spot rate for its maturity.",
      presentation: level === 1 ? ["work-backwards"] : ["work-backwards", "hidden-structure", "multi-equation"],
      features: { multiConcept: level > 1, unfamiliar: level > 1 },
      params: { s1, c2, c3, P2, P3, cp, twist, level },
      route: "strip coupons, then read rates",
    });
  },
};

// ===================================================================== Zero prices hidden in a ladder of annuity prices

const annuityStrip: QuestionTemplate = {
  id: "spot-annuity-strip",
  family: "spot-annuity-strip",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.yield_curves",
  secondary: ["ALM.spot_forward", "ANNUITIES.level_payment", "ANNUITIES.arithmetic"],
  reasoning: ["concept_recognition", "cashflow_modelling", "formula_reconstruction"],
  soaConcept: "Prices of 1-, 2-, 3- and 4-year annuities on a non-flat curve: consecutive differences are zero-coupon prices, from which spot, forward, bond and increasing-annuity values follow.",
  generate(rng, level): QuestionDraft {
    const s = [gridRate(rng, 0.02, 0.05, 0.0025)];
    for (let k = 1; k < 4; k += 1) s.push(s[k - 1] + rng.choice([0.0075, 0.01, 0.0125]));
    const vt = s.map((r, k) => Math.pow(1 + r, -(k + 1)));
    const A = [1, 2, 3, 4].map((t) => round4(vt.slice(0, t).reduce((a, x) => a + x, 0)));
    const P = A.map((a, k) => (k === 0 ? a : a - A[k - 1]));
    const AE = A.map((a) => L(a));
    const PE = (t: number) => (t === 1 ? AE[0] : `(${AE[t - 1]} - ${AE[t - 2]})`);
    const twist = rng.choice(["A", "B"]);
    const R = gridAmount(rng, 100, 1000, 50);
    const r = gridRate(rng, 0.03, 0.08, 0.005);
    const ladder = `The prices of annuities-immediate paying 1 at the end of each year are ${A[0].toFixed(4)} for 1 year, ${A[1].toFixed(4)} for 2 years, ${A[2].toFixed(4)} for 3 years and ${A[3].toFixed(4)} for 4 years.`;
    let fmt: AnswerFormat = PCT3;
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    const ds: DistractorCandidate[] = [];
    const steps = [step("F.spot-pricing", "Consecutive annuity prices differ by one zero-coupon price: $P_t = A_t - A_{t-1}$.", ["P_2", P[1], "2-year zero price"], ["A_t"], { derived: true })];
    const s2 = Math.pow(P[1], -0.5) - 1;
    const s3 = Math.pow(P[2], -1 / 3) - 1;
    const ann2 = bisect((x) => (1 - Math.pow(1 + x, -2)) / x - A[1], 1e-6, 1);
    if (level === 1 && twist === "A") {
      value = s2;
      calc = `${PE(2)}**(-1/2)-1`;
      model = { expr: `${AE[0]} + (1+x)**(-2) - ${AE[1]}`, description: "The 2-year annuity is the 1-year annuity plus a 2-year zero." };
      ask = "Calculate the 2-year spot rate.";
      ds.push(
        distractor("CHAL_YTM_AS_SPOT", ann2, `(1-(1+x)**(-2))/x - ${AE[1]}`, { derivation: `$${shown(ann2, fmt)}$`, method: "Solved $a_{\\overline{2|}} = A_2$ for a single rate.", feedback: "That is the annuity's yield, a blend of the 1- and 2-year rates." }),
        d("CONC_ALM_FORWARD_NOT_ANNUALIZED", 1 / P[1] - 1, `1/${PE(2)}-1`, fmt, "Left the 2-year rate unannualised.", "Take the square root."),
        d("RATE_FORCE_AS_EFFECTIVE", -Math.log(P[1]) / 2, `-log(${PE(2)})/2`, fmt, "Gave the continuously compounded rate.", "Annual effective: $P_2^{-1/2} - 1$."),
        d("COMP_FORWARD_AS_SPOT", A[0] / P[1] - 1, `${AE[0]}/${PE(2)}-1`, fmt, "Gave the forward rate for year 2.", "The spot rate covers both years.")
      );
      steps.push(step("F.spot", "Annualise.", ["s_2", value, "2-year spot rate"], ["P_2"]));
    } else if (level === 1) {
      value = A[0] / P[1] - 1;
      calc = `${AE[0]}/${PE(2)}-1`;
      model = { expr: `${AE[0]} + ${AE[0]}/(1+x) - ${AE[1]}`, description: "The year-2 payment discounted one year at the forward rate and one at the 1-year rate." };
      ask = "Calculate the one-year forward rate from time 1 to time 2.";
      ds.push(
        d("FORMULA_ARITHMETIC_FORWARD", 2 * s2 - (1 / A[0] - 1), `2*(${PE(2)}**(-1/2)-1) - (1/${AE[0]}-1)`, fmt, "Used $2s_2 - s_1$.", "Compound: $1 + f = P_1/P_2$."),
        d("COMP_SPOT_AS_FORWARD", s2, `${PE(2)}**(-1/2)-1`, fmt, "Gave the 2-year spot rate.", "The forward rate is for year 2 only."),
        d("CHAL_YTM_AS_SPOT", Math.pow(1 + ann2, 2) * A[0] - 1, `(1+${L(ann2)})**2*${AE[0]}-1`, fmt, "Used the 2-year annuity's yield as the 2-year spot rate.", "Difference the annuity prices to get the zero price."),
        d("RATE_FORCE_AS_EFFECTIVE", Math.log(A[0] / P[1]), `log(${AE[0]}/${PE(2)})`, fmt, "Took the logarithm of the price ratio.", "That is a forward force of interest."),
        d("ALLOC_EVEN_SPLIT", (1 / A[0] - 1 + s2) / 2, `((1/${AE[0]}-1) + ${PE(2)}**(-1/2)-1)/2`, fmt, "Averaged the 1- and 2-year spot rates.", "Year 2's own rate is $P_1/P_2 - 1$."),
        d("SEQ_TERM_COUNT", Math.sqrt(A[0] / P[1]) - 1, `(${AE[0]}/${PE(2)})**(1/2)-1`, fmt, "Annualised over two years.", "Time 1 to time 2 is one year.")
      );
      steps.push(step("F.forward", "Forward rate from the ratio of zero prices.", ["f", value, "forward rate for year 2"], ["P_1", "P_2"]));
    } else if (level === 2 && twist === "A") {
      fmt = MONEY2;
      value = 1000 * r * A[2] + 1000 * P[2];
      calc = `1000*${L(r)}*${AE[2]} + 1000*${PE(3)}`;
      model = { expr: `1000*${L(r)}*(${AE[0]} + ${PE(2)} + ${PE(3)}) + 1000*${PE(3)}`, description: "Each coupon and the redemption priced with its own zero price." };
      ask = `Calculate the price of a 3-year bond with face 1000 and annual coupons at ${pc(r)}.`;
      const flat = 1000 * r * ((1 - Math.pow(1 + s3, -3)) / s3) + 1000 * Math.pow(1 + s3, -3);
      ds.push(
        d("TIMING_MISSING_PERIOD", 1000 * r * A[2] + 1000 * P[1], `1000*${L(r)}*${AE[2]} + 1000*${PE(2)}`, fmt, "Discounted the redemption with the 2-year zero price.", "Redemption is at year 3."),
        d("SEQ_TERM_COUNT", 1000 * r * A[1] + 1000 * P[2], `1000*${L(r)}*${AE[1]} + 1000*${PE(3)}`, fmt, "Valued only two coupons.", "There are three annual coupons."),
        d("ALLOC_EVEN_SPLIT", 1000 * r * A[2] + (1000 * A[2]) / 3, `1000*${L(r)}*${AE[2]} + 1000*${AE[2]}/3`, fmt, "Discounted the redemption with the average discount factor $A_3/3$.", "The redemption needs the 3-year zero price $A_3 - A_2$."),
        d("COMP_YIELD_AS_LONGEST_SPOT", flat, `1000*${L(r)}*(1-(1+${L(s3)})**(-3))/${L(s3)} + 1000*(1+${L(s3)})**(-3)`, fmt, "Discounted every cash flow at the 3-year spot rate.", "Earlier cash flows use their own shorter rates."),
        d("CONC_IGNORED_REDEMPTION", 1000 * r * A[2], `1000*${L(r)}*${AE[2]}`, fmt, "Valued the coupons only.", "Add the redemption, priced with the 3-year zero."),
        d("TIMING_EXTRA_PERIOD", 1000 * r * (A[3] - A[0]) + 1000 * P[3], `1000*${L(r)}*(${AE[3]}-${AE[0]}) + 1000*${PE(4)}`, fmt, "Shifted every cash flow one year later.", "Coupons are at years 1, 2 and 3.")
      );
      steps.push(step("F.spot-pricing", "Coupons: $1000r\\,A_3$. Redemption: $1000\\,P_3$.", ["P", value, "bond price"], ["A_3", "P_3"]));
    } else if (level === 2) {
      value = P[1] / P[2] - 1;
      calc = `${PE(2)}/${PE(3)}-1`;
      model = { expr: `${AE[1]} + ${PE(2)}/(1+x) - ${AE[2]}`, description: "The year-3 payment is the year-2 zero discounted one more year at the forward rate." };
      ask = "Calculate the one-year forward rate from time 2 to time 3.";
      ds.push(
        d("FORMULA_ARITHMETIC_FORWARD", 3 * s3 - 2 * s2, `3*(${PE(3)}**(-1/3)-1) - 2*(${PE(2)}**(-1/2)-1)`, fmt, "Used $3s_3 - 2s_2$.", "Compound: $1+f = P_2/P_3$."),
        d("COMP_SPOT_AS_FORWARD", s3, `${PE(3)}**(-1/3)-1`, fmt, "Gave the 3-year spot rate.", "The forward rate is for year 3 alone."),
        d("RATE_FORCE_AS_EFFECTIVE", Math.log(P[1] / P[2]), `log(${PE(2)}/${PE(3)})`, fmt, "Took the logarithm of the price ratio.", "That is a force of interest."),
        d("SEQ_TERM_COUNT", Math.sqrt(A[0] / P[2]) - 1, `(${AE[0]}/${PE(3)})**(1/2)-1`, fmt, "Annualised the forward rate from time 1 to 3.", "The question asks about year 3 only."),
        d("ALLOC_EVEN_SPLIT", (s2 + s3) / 2, `(${PE(2)}**(-1/2)-1 + ${PE(3)}**(-1/3)-1)/2`, fmt, "Averaged the 2- and 3-year spot rates.", "Year 3's own rate is $P_2/P_3 - 1$."),
        d("CONC_ALM_FORWARD_NOT_ANNUALIZED", A[0] / P[2] - 1, `${AE[0]}/${PE(3)}-1`, fmt, "Gave the growth from time 1 to time 3.", "One year: from time 2 to time 3.")
      );
      steps.push(step("F.spot-pricing", "Third zero price.", ["P_3", P[2], "3-year zero price"], ["A_3", "A_2"], { derived: true }));
      steps.push(step("F.forward", "Forward rate from consecutive zero prices.", ["f", value, "forward rate for year 3"], ["P_2", "P_3"]));
    } else if (twist === "A") {
      const price = 1000 * r * A[2] + 1000 * P[2];
      value = irr([{ t: 1, cf: 1000 * r }, { t: 2, cf: 1000 * r }, { t: 3, cf: 1000 + 1000 * r }], price);
      const priceE = `(1000*${L(r)}*${AE[2]} + 1000*${PE(3)})`;
      calc = `${flowsE([{ t: 1, cf: 1000 * r }, { t: 2, cf: 1000 * r }, { t: 3, cf: 1000 + 1000 * r }], "x")} - ${priceE}`;
      model = { expr: `${L(1000 * r)}*(1-(1+x)**(-3))/x + 1000*(1+x)**(-3) - ${priceE}`, bracket: [value - 0.02, value + 0.02], description: "Annuity-form price at one yield equal to the curve price." };
      ask = `Calculate the annual effective yield to maturity of a 3-year bond with face 1000 and annual coupons at ${pc(r)}.`;
      const avg = (1 / A[0] - 1 + s2 + s3) / 3;
      ds.push(
        d("COMP_YIELD_AS_LONGEST_SPOT", s3, `${PE(3)}**(-1/3)-1`, fmt, "Took the 3-year spot rate.", "Coupons are discounted at shorter, lower rates."),
        d("ALLOC_EVEN_SPLIT", avg, `((1/${AE[0]}-1) + (${PE(2)}**(-1/2)-1) + (${PE(3)}**(-1/3)-1))/3`, fmt, "Averaged the spot rates.", "Weights are present values of the cash flows."),
        d("CONC_BOND_YIELD_IS_COUPON_RATE", r, L(r), fmt, "Took the coupon rate.", "Only a par bond yields its coupon rate."),
        d("FORMULA_CURRENT_YIELD", (1000 * r) / price, `1000*${L(r)}/${priceE}`, fmt, "Divided the coupon by the price.", "Current yield ignores redemption."),
        d("COMP_FORWARD_AS_SPOT", P[1] / P[2] - 1, `${PE(2)}/${PE(3)}-1`, fmt, "Took the forward rate for year 3.", "The yield averages the whole curve.")
      );
      steps.push(step("F.spot-pricing", "Price the bond from the zero prices.", ["P", price, "bond price"], ["A_3", "P_3"]));
      steps.push(step("M.root-finding", "Single yield reproducing that price.", ["y", value, "yield to maturity"], ["P"], { rearranged: true }));
    } else {
      fmt = MONEY2;
      value = R * (4 * A[3] - A[2] - A[1] - A[0]);
      calc = `${L(R)}*(4*${AE[3]} - ${AE[2]} - ${AE[1]} - ${AE[0]})`;
      model = { expr: `${L(R)}*(1*${PE(1)} + 2*${PE(2)} + 3*${PE(3)} + 4*${PE(4)})`, description: "Payment t times the t-year zero price, summed." };
      ask = `Calculate the price of an annuity paying ${amt(R)}, ${amt(2 * R)}, ${amt(3 * R)} and ${amt(4 * R)} at the ends of years 1 to 4.`;
      ds.push(
        d("VAR_TOTAL_FOR_COMPONENT", R * (A[0] + 2 * A[1] + 3 * A[2] + 4 * A[3]), `${L(R)}*(${AE[0]} + 2*${AE[1]} + 3*${AE[2]} + 4*${AE[3]})`, fmt, "Used the annuity prices as if they were zero prices.", "Zero prices are the differences $A_t - A_{t-1}$."),
        d("FORMULA_DECREASING_FOR_INCREASING", R * (A[0] + A[1] + A[2] + A[3]), `${L(R)}*(${AE[0]} + ${AE[1]} + ${AE[2]} + ${AE[3]})`, fmt, "Summed the annuity prices — that values the decreasing annuity 4, 3, 2, 1.", "Increasing: $4A_4 - A_3 - A_2 - A_1$."),
        d("ALLOC_EVEN_SPLIT", 2.5 * R * A[3], `2.5*${L(R)}*${AE[3]}`, fmt, "Used the average payment with the 4-year annuity price.", "Later payments are discounted more, so averaging overstates."),
        d("SEQ_TERM_COUNT", R * (4 * A[3] - A[2] - A[1]), `${L(R)}*(4*${AE[3]} - ${AE[2]} - ${AE[1]})`, fmt, "Removed only two of the shorter annuities.", "Remove $A_1$, $A_2$ and $A_3$."),
        d("TRANS_IGNORED_CONDITION", 4 * R * A[3], `4*${L(R)}*${AE[3]}`, fmt, "Valued four level payments of the largest amount.", "The payments increase from R to 4R.")
      );
      steps.push(step("B.increasing", "Write the increasing stream as layers: 4 level annuities of length 4 minus ones of lengths 3, 2, 1.", ["(Ia)", 4 * A[3] - A[2] - A[1] - A[0], "increasing annuity factor"], ["A_t"], { derived: true }));
      steps.push(step("F.spot-pricing", "Scale by the payment.", ["V", value, "price"], ["R"]));
    }
    return compose({
      stem: `${ladder} All rates are annual effective.\n\n${ask}`,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: ["decomposition", "substitution"],
      reasoning: "An n-year annuity is the (n − 1)-year annuity plus one more zero-coupon payment, so differences of annuity prices are zero prices.",
      unconventional: true,
      intuition: "The 2-year annuity contains everything the 1-year annuity does plus one extra payment at year 2. So the difference of their prices is the price of 1 paid at year 2 — a zero-coupon price — on any curve, flat or not.",
      unknowns: [{ symbol: "$P_t$", meaning: "price of 1 at time t" }],
      relationships: ["$P_t = A_t - A_{t-1}$", "$(1+s_t)^{-t} = P_t$", "$1 + f_t = P_{t-1}/P_t$"],
      conditions: ["All annuities priced on the same curve."],
      valuationDate: "Time 0",
      modelChoice: "Zero prices by differencing.",
      assumptions: ["No arbitrage."],
      alternative: { name: "Yield of each annuity", body: "Each annuity has its own yield, but none of them is a spot rate — differencing is the route that gives the curve.", whenUseful: "To see why annuity yields mislead on a sloped curve." },
      principle: "Differences of nested annuity prices are zero-coupon prices.",
      unusual: "The curve is given only through annuity prices.",
      misread: "An annuity's price is not a discount factor.",
      presentation: level === 1 ? ["hidden-structure"] : ["hidden-structure", "work-backwards"],
      features: { unfamiliar: true, multiConcept: level > 1 },
      params: { A1: A[0], A2: A[1], A3: A[2], A4: A[3], r, R, twist, level },
      route: "difference annuity prices into zeros",
    });
  },
};

// ===================================================================== Inflation-indexed streams

const indexedStream: QuestionTemplate = {
  id: "infl-indexed-stream",
  family: "infl-indexed-stream",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.inflation_real",
  secondary: ["ANNUITIES.geometric", "ANNUITIES.perpetuities"],
  reasoning: ["translation", "concept_recognition", "cashflow_modelling", "financial_intuition"],
  soaConcept: "Payments indexed to inflation valued either as a geometric stream at the nominal rate or as a level stream at the real rate — and the traps between the two.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const r = gridRate(rng, 0.025, 0.05, 0.0025);
    const i = level === 3 ? 0 : r + gridRate(rng, 0.025, 0.05, 0.0025);
    const rho = level === 3 ? gridRate(rng, 0.025, 0.05, 0.0025) : 0;
    const nominal = level === 3 ? (1 + rho) * (1 + r) - 1 : i;
    const j = (1 + nominal) / (1 + r) - 1;
    const R = gridAmount(rng, 1000, 10000, 500);
    const n = rng.int(8, 25);
    const k = rng.int(3, 8);
    const twist = rng.choice(["A", "B"]);
    let segs: Seg[];
    let what: string;
    if (level === 1) {
      segs = twist === "A" ? [{ from: 1, to: null, amount: R, growth: r }] : [{ from: 1, to: n, amount: R, growth: r }];
      what = twist === "A" ? `A perpetuity pays ${amt(R)} at the end of the first year; each later payment is increased by the rate of inflation, ${pct(r)} a year.` : `An annuity pays ${amt(R)} at the end of the first year and ${n} payments in all; each payment after the first is increased by the rate of inflation, ${pct(r)} a year.`;
    } else if (level === 2) {
      segs = twist === "A" ? [{ from: 1, to: n, amount: R * (1 + r), growth: r }] : [{ from: 1, to: null, amount: R * (1 + r), growth: r }];
      what = `${twist === "A" ? `An annuity makes ${n} annual payments` : "A perpetuity makes annual payments"} at the end of each year, each worth ${amt(R)} in today's purchasing power. Inflation is ${pct(r)} a year.`;
    } else {
      segs = [
        { from: 1, to: k, amount: R },
        { from: k + 1, to: null, amount: R * (1 + r), growth: r },
      ];
      what = `A pension pays ${amt(R)} at the end of each year for ${k} years. From year ${k + 1} on it is paid forever and indexed: the year-${k + 1} payment is ${amt(R)} increased by one year's inflation, and each later payment grows with inflation. Inflation is ${pct(r)} a year.`;
    }
    const regimes = [{ until: null, rate: nominal }];
    const ans = valueOf(segs, regimes);
    const at = (rate: number, s: Seg[] = segs) => valueOf(s, [{ until: null, rate }]);
    const ds: DistractorCandidate[] = [];
    const vd = (id: Parameters<typeof distractor>[0], v: { value: number; expr: string }, method: string, feedback: string) => d(id, v.value, v.expr, fmt, method, feedback);
    const level0 = (s: Seg[]) => s.map((x) => ({ ...x, growth: 0, amount: x === s[s.length - 1] && level !== 3 ? R : x.amount }));
    ds.push(
      vd("TRANS_IGNORED_CONDITION", at(nominal, level0(segs)), "Ignored the indexation: valued level payments.", "The payments rise with inflation, so each later payment is larger."),
      vd("CONC_REAL_NOMINAL_MIX", at(j), "Discounted the growing (nominal) payments at the real rate.", "Grown payments are in money of the day: discount them at the nominal rate."),
      vd(level === 3 ? "RATE_DIVIDED_EFFECTIVE" : "FORMULA_APPROX_REAL", { value: valueOf(segs.map((x) => ({ ...x, growth: 0, amount: x.amount * (x.growth ? 1 / (1 + r) : 1) * (x.growth ? 1 : 1) })), [{ until: null, rate: nominal - r }]).value, expr: valueOf(segs.map((x) => ({ ...x, growth: 0, amount: x.amount * (x.growth ? 1 / (1 + r) : 1) })), [{ until: null, rate: nominal - r }]).expr }, "Discounted level real payments at $i - r$.", `The real rate is $(1+i)/(1+r) - 1 = ${(j * 100).toFixed(4)}\\%$, not $i - r$.`),
      vd("CONC_TVM_INFLATION_TWICE", at((1 + nominal) / Math.pow(1 + r, 2) - 1), "Deflated the payments and also used a real rate on the grown payments.", "Either grow the payments and discount at the nominal rate, or keep them level in real terms and discount at the real rate — not both."),
      vd("TIMING_IMMEDIATE_AS_DUE", valueOf(segs.map((x) => ({ ...x, from: x.from - 1, to: x.to === null ? null : x.to - 1 })), regimes), "Valued the payments as made at the start of each year.", "Payments are at the ends of years."),
      vd("TIMING_EXTRA_PERIOD", valueOf(segs.map((x) => ({ ...x, from: x.from + 1, to: x.to === null ? null : x.to + 1 })), regimes), "Discounted every payment one year too many.", "The first payment is at the end of year 1.")
    );
    if (level === 1) ds.push(vd("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf(segs.map((x) => ({ ...x, amount: x.amount * (1 + r) })), regimes), "Increased the first payment by inflation too.", `The first payment is ${amt(R)}; growth starts with the second.`));
    else if (level === 2) ds.push(vd("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf(segs.map((x) => ({ ...x, amount: R })), regimes), `Took the first nominal payment as ${amt(R)}.`, `${amt(R)} in today's money is ${amt(R * (1 + r))} at the end of year 1.`));
    else {
      ds.push(
        vd("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf([segs[0], { ...segs[1], amount: R }], regimes), `Took the first indexed payment as ${amt(R)}.`, `It is ${amt(R)} increased by one year's inflation: ${amt(R * (1 + r))}.`),
        vd("FORMULA_APPROX_REAL", at(rho + r), "Approximated the nominal rate as $\\rho + r$.", "Rates compound: $1 + i = (1+\\rho)(1+r)$."),
        vd("TIMING_IGNORED_DEFERRAL", valueOf(segs, regimes, { tailUndeferred: true }), "Left the indexed perpetuity at its starting date.", `Its value sits at year ${k}; discount it to time 0.`)
      );
    }
    const steps: ChainStep[] = [];
    if (level === 3) steps.push(step("F.real-rate", "Nominal rate from the real rate and inflation.", ["i", nominal, "nominal rate"], ["ρ", "r"]));
    steps.push(step("F.real-rate", "Real rate: $(1+i)/(1+r) - 1$.", ["j", j, "real rate"], ["i", "r"]));
    if (level === 3) {
      const first = valueOf([segs[0]], regimes);
      steps.push(step("B.annuity-immediate", `Fixed payments for ${k} years at the nominal rate.`, ["V_1", first.value, "fixed block"], ["R", "i"]));
      steps.push(step("B.geometric-perpetuity", `Indexed perpetuity valued at year ${k}: first payment over $(i - r)$.`, ["V_k", (R * (1 + r)) / (nominal - r), `indexed block at year ${k}`], ["R", "r", "i"]));
      steps.push(step("A.discount-factor", `Discount to 0 and add.`, ["PV", ans.value, "present value"], ["V_1", "V_k"]));
    } else {
      steps.push(step(segs[0].to === null ? "B.geometric-perpetuity" : "B.geometric-annuity", "Grow at inflation, discount at the nominal rate — or equivalently level real payments at the real rate.", ["PV", ans.value, "present value"], ["R", "r", "i"]));
    }
    return compose({
      stem: `${what} ${level === 3 ? `The real rate of interest is ${pct(rho)} a year.` : `The nominal annual effective rate of interest is ${pct(nominal)}.`}\n\nCalculate the present value of the payments.`,
      fmt,
      value: ans.value,
      calc: ans.expr,
      model: { expr: modelOf(segs, regimes), description: "Each nominal payment discounted at the nominal rate; the perpetual part in the form $X/(i - r)$." },
      distractors: ds,
      steps,
      methods: ["substitution", "geometric_series"],
      reasoning: "Payments that grow with inflation are level in real terms: discount them at the real rate, or grow them and discount at the nominal rate.",
      intuition: "Indexing makes every payment buy the same amount. So either work in today's money — level payments, real rate — or in money of the day — growing payments, nominal rate. Mixing the two (real payments at a nominal rate, or nominal payments at a real rate) is the trap.",
      unknowns: [{ symbol: "$PV$", meaning: "present value" }],
      relationships: ["$1 + j = \\dfrac{1+i}{1+r}$", "$\\sum_t X(1+r)^{t-1}(1+i)^{-t} = \\dfrac{X}{1+r}\\,a_{\\overline{n|}\\,j}$"],
      conditions: ["Inflation constant.", "End-of-year payments."],
      valuationDate: "Time 0",
      modelChoice: "Geometric stream at the nominal rate.",
      assumptions: ["Inflation and interest rates are annual effective."],
      alternative: { name: "Real terms", body: "Deflate every payment to today's money and discount at the real rate $j$.", whenUseful: "When the payments are stated in today's purchasing power." },
      principle: "Match the money to the rate: nominal with nominal, real with real.",
      unusual: level === 3 ? "Indexing starts only after a fixed period, and the rate is given in real terms." : level === 2 ? "Payments are stated in today's purchasing power." : "Inflation sets the growth rate of the payments.",
      misread: "$i - r$ is only an approximation of the real rate.",
      presentation: level === 1 ? ["direct"] : ["hidden-structure", "combined-topics"],
      features: { multiConcept: true, unfamiliar: level > 1 },
      params: { R, r, i: nominal, n, k, twist, level },
      route: "real vs nominal",
    });
  },
};

// ===================================================================== Index-linked bonds

const indexedBond: QuestionTemplate = {
  id: "infl-indexed-bond",
  family: "infl-indexed-bond",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.price_redemption",
  secondary: ["TVM.inflation_real", "BONDS.yield"],
  reasoning: ["concept_recognition", "translation", "cashflow_modelling", "multistep"],
  soaConcept: "Bonds whose coupons (and possibly redemption) are indexed to inflation: priced at the real yield when fully indexed, and with mixed nominal and real discounting when only the coupons are indexed.",
  generate(rng, level): QuestionDraft {
    const F = 1000;
    const c = gridRate(rng, 0.01, 0.04, 0.0025);
    const r = gridRate(rng, 0.025, 0.05, 0.0025);
    const n = rng.int(5, 20);
    const twist = rng.choice(["A", "B"]);
    const i = r + Math.max(0.01, c + rng.choice([-0.01, -0.005, 0.005, 0.01, 0.015]));
    const j = (1 + i) / (1 + r) - 1;
    const plainAt = (y: number) => F * c * ((1 - Math.pow(1 + y, -n)) / y) + F * Math.pow(1 + y, -n);
    const plainE = (y: string) => `(${L(F * c)}*(1-(1+${y})**(-${n}))/${y} + ${F}*(1+${y})**(-${n}))`;
    const jE = `((1+${L(i)})/(1+${L(r)})-1)`;
    let fmt: AnswerFormat = MONEY2;
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    const ds: DistractorCandidate[] = [];
    const steps: ChainStep[] = [];
    const coupons = `pays annual coupons at a real rate of ${pct(c)}: each coupon is ${pct(c)} of the face amount increased by inflation from issue to the payment date`;
    const flowsIndexed = Array.from({ length: n }, (_, k) => `${L(F * c)}*(1+${L(r)})**${k + 1}*(1+${L(i)})**(-${k + 1})`).join(" + ");
    const mixed = F * c * ((1 - Math.pow(1 + j, -n)) / j) + F * Math.pow(1 + i, -n);
    const mixedE = `${L(F * c)}*(1-(1+${jE})**(-${n}))/${jE} + ${F}*(1+${L(i)})**(-${n})`;
    let stem: string;
    if (level === 1 && twist === "A") {
      value = plainAt(j);
      calc = plainE(jE);
      model = { expr: `${flowsIndexed} + ${F}*(1+${L(r)})**${n}*(1+${L(i)})**(-${n})`, description: "Every indexed cash flow grown with inflation and discounted at the nominal yield." };
      stem = `A ${n}-year bond with face ${F} ${coupons}. The redemption amount is also indexed: ${F} increased by inflation over the ${n} years. Inflation is expected to be ${pct(r)} a year.`;
      ask = `Calculate the price that gives a nominal annual effective yield of ${pct(i)}.`;
      ds.push(
        d("CONC_REAL_NOMINAL_MIX", plainAt(i), plainE(L(i)), fmt, "Priced unindexed cash flows at the nominal yield.", "The cash flows grow with inflation."),
        d("FORMULA_APPROX_REAL", plainAt(i - r), plainE(L(i - r)), fmt, "Used $i - r$ as the real yield.", "Real yield: $(1+i)/(1+r) - 1$."),
        d("CONC_TVM_INDEXATION_ASSUMED", mixed, mixedE, fmt, "Left the redemption unindexed.", "Here the redemption is indexed too."),
        d("CONC_TVM_INFLATION_TWICE", plainAt((1 + i) / Math.pow(1 + r, 2) - 1), plainE(`((1+${L(i)})/(1+${L(r)})**2-1)`), fmt, "Removed inflation twice.", "Fully indexed cash flows at the nominal yield equal real cash flows at the real yield; adjust once."),
        d("TIMING_EXTRA_PERIOD", plainAt(j) / (1 + j), `${plainE(jE)}/(1+${jE})`, fmt, "Discounted every cash flow one year too many.", "Coupons start one year after purchase.")
      );
      steps.push(step("F.real-rate", "Real yield.", ["j", j, "real yield"], ["i", "r"]), step("E.price", "Fully indexed bond = ordinary bond at the real yield.", ["P", value, "price"], ["c", "j"]));
    } else if (level === 1) {
      const k = rng.int(3, n);
      value = F * c * Math.pow(1 + j, -k);
      calc = `${L(F * c)}*(1+${jE})**(-${k})`;
      model = { expr: `${L(F * c)}*(1+${L(r)})**${k}*(1+${L(i)})**(-${k})`, description: "The coupon in money of year k, discounted at the nominal yield." };
      stem = `A ${n}-year bond with face ${F} ${coupons}. Inflation is expected to be ${pct(r)} a year.`;
      ask = `Calculate the present value, at a nominal annual effective yield of ${pct(i)}, of the ${k}th coupon alone.`;
      ds.push(
        d("CONC_REAL_NOMINAL_MIX", F * c * Math.pow(1 + i, -k), `${L(F * c)}*(1+${L(i)})**(-${k})`, fmt, "Ignored the indexation of the coupon.", `The ${k}th coupon is ${F}c increased by ${k} years of inflation.`),
        d("TIMING_IGNORED_DEFERRAL", F * c * Math.pow(1 + r, k), `${L(F * c)}*(1+${L(r)})**${k}`, fmt, "Gave the coupon's amount without discounting it.", "The question asks for its present value."),
        d("TIMING_MISSING_PERIOD", F * c * Math.pow(1 + r, k - 1) * Math.pow(1 + i, -k), `${L(F * c)}*(1+${L(r)})**${k - 1}*(1+${L(i)})**(-${k})`, fmt, "Indexed the coupon for one year too few.", `Indexation runs from issue to the ${k}th payment: ${k} years.`),
        d("FORMULA_APPROX_REAL", F * c * Math.pow(1 + i - r, -k), `${L(F * c)}*(1+${L(i - r)})**(-${k})`, fmt, "Discounted at $i - r$.", "Real rate: $(1+i)/(1+r) - 1$."),
        d("CONC_TVM_INFLATION_TWICE", F * c * Math.pow((1 + i) / Math.pow(1 + r, 2), -k), `${L(F * c)}*((1+${L(i)})/(1+${L(r)})**2)**(-${k})`, fmt, "Removed inflation twice.", "Indexed coupon at the nominal yield = real coupon at the real yield.")
      );
      steps.push(step("F.real-rate", "Real yield.", ["j", j, "real yield"], ["i", "r"]), step("A.discount-factor", "A real coupon of Fc discounted at the real yield.", ["PV", value, "present value of the coupon"], ["j"]));
    } else if (level === 2 && twist === "A") {
      fmt = PCT3;
      const P = round2(plainAt(j));
      const jr = irr([...Array.from({ length: n }, (_, k) => ({ t: k + 1, cf: F * c })), { t: n, cf: F }], P);
      value = (1 + jr) * (1 + r) - 1;
      calc = `${Array.from({ length: n }, (_, k) => `${L(F * c)}*(1+${L(r)})**${k + 1}*(1+x)**(-${k + 1})`).join(" + ")} + ${F}*(1+${L(r)})**${n}*(1+x)**(-${n}) - ${L(P)}`;
      model = { expr: `${L(F * c)}*(1-((1+x)/(1+${L(r)}))**(-${n}))/((1+x)/(1+${L(r)})-1) + ${F}*((1+x)/(1+${L(r)}))**(-${n}) - ${L(P)}`, bracket: [value - 0.03, value + 0.03], description: "Real cash flows at the real yield implied by the nominal yield x." };
      stem = `A ${n}-year bond with face ${F} ${coupons}. The redemption amount is also indexed. Inflation is expected to be ${pct(r)} a year. The bond sells for ${amt(P)}.`;
      ask = "Calculate the nominal annual effective yield.";
      const yPlain = irr([...Array.from({ length: n }, (_, k) => ({ t: k + 1, cf: F * c })), { t: n, cf: F }], P);
      ds.push(
        d("FORMULA_APPROX_REAL", jr + r, `${L(jr)}+${L(r)}`, fmt, "Added inflation to the real yield.", "Compound: $(1+j)(1+r) - 1$."),
        d("VAR_OTHER_UNKNOWN", jr, L(jr), fmt, "Stopped at the real yield.", "The question asks for the nominal yield."),
        d("CONC_PAR_ASSUMPTION", (1 + c) * (1 + r) - 1, `(1+${L(c)})*(1+${L(r)})-1`, fmt, "Assumed the bond sells at par.", `It sells for ${amt(P)}, not ${F}.`),
        d("CONC_TVM_INFLATION_TWICE", (1 + jr) * Math.pow(1 + r, 2) - 1, `(1+${L(jr)})*(1+${L(r)})**2-1`, fmt, "Applied inflation twice.", "Once is enough: the price already reflects real cash flows."),
        d("FORMULA_CURRENT_YIELD", (F * c * (1 + r)) / P, `${L(F * c)}*(1+${L(r)})/${L(P)}`, fmt, "Divided the first nominal coupon by the price.", "Current yield ignores redemption and the growth of later coupons."),
        d("RATE_FORCE_AS_EFFECTIVE", Math.log(1 + jr) + Math.log(1 + r), `log(1+${L(jr)}) + log(1+${L(r)})`, fmt, "Added the real yield and inflation as forces of interest.", "Forces add; effective rates multiply: $(1+j)(1+r) - 1$.")
      );
      void yPlain;
      steps.push(step("M.root-finding", "Real yield: the ordinary bond's yield at this price.", ["j", jr, "real yield"], ["P", "c"], { rearranged: true }), step("F.real-rate", "Nominal yield.", ["i", value, "nominal yield"], ["j", "r"]));
    } else {
      const rho = level === 3 ? gridRate(rng, 0.015, 0.04, 0.0025) : 0;
      const nom = level === 3 ? (1 + rho) * (1 + r) - 1 : i;
      const jj = level === 3 ? rho : j;
      const jjE = level === 3 ? L(rho) : jE;
      const nomE = level === 3 ? `((1+${L(rho)})*(1+${L(r)})-1)` : L(i);
      value = F * c * ((1 - Math.pow(1 + jj, -n)) / jj) + F * Math.pow(1 + nom, -n);
      calc = `${L(F * c)}*(1-(1+${jjE})**(-${n}))/${jjE} + ${F}*(1+${nomE})**(-${n})`;
      model = { expr: `${Array.from({ length: n }, (_, k) => `${L(F * c)}*(1+${L(r)})**${k + 1}*(1+${nomE})**(-${k + 1})`).join(" + ")} + ${F}*(1+${nomE})**(-${n})`, description: "Indexed coupons grown and discounted at the nominal yield; the fixed redemption discounted at the nominal yield." };
      stem = `A ${n}-year bond with face ${F} ${coupons}. The redemption amount is NOT indexed: the bond is redeemed for ${F}. Inflation is expected to be ${pct(r)} a year.`;
      ask = level === 3 ? `An investor requires a real annual effective yield of ${pct(rho)}. Calculate the price.` : `Calculate the price that gives a nominal annual effective yield of ${pct(i)}.`;
      const full = plainAt(jj);
      ds.push(
        d("CONC_TVM_INDEXATION_ASSUMED", full, plainE(jjE), fmt, "Treated the redemption as indexed too.", `The redemption is a fixed ${F}: discount it at the nominal yield.`),
        d("CONC_REAL_NOMINAL_MIX", plainAt(nom), plainE(nomE), fmt, "Treated the coupons as fixed.", "Coupons grow with inflation: at the nominal yield they are worth an annuity at the real yield."),
        d("CONC_ANN_FIRST_PAYMENT_GROWTH", (F * c * ((1 - Math.pow(1 + jj, -n)) / jj)) / (1 + r) + F * Math.pow(1 + nom, -n), `${L(F * c)}*(1-(1+${jjE})**(-${n}))/${jjE}/(1+${L(r)}) + ${F}*(1+${nomE})**(-${n})`, fmt, "Indexed the coupons from the first payment date instead of from issue.", "The first coupon already includes one year of inflation: $Fc(1+r)$."),
        d("FORMULA_APPROX_REAL", F * c * ((1 - Math.pow(1 + (nom - r), -n)) / (nom - r)) + F * Math.pow(1 + nom, -n), `${L(F * c)}*(1-(1+${nomE}-${L(r)})**(-${n}))/(${nomE}-${L(r)}) + ${F}*(1+${nomE})**(-${n})`, fmt, "Used $i - r$ for the coupons.", "The coupons' rate is $(1+i)/(1+r) - 1$."),
        d("CONC_IGNORED_REDEMPTION", F * c * ((1 - Math.pow(1 + jj, -n)) / jj), `${L(F * c)}*(1-(1+${jjE})**(-${n}))/${jjE}`, fmt, "Valued the coupons only.", `Add the redemption of ${F}, discounted at the nominal yield.`),
        d("TIMING_EXTRA_PERIOD", F * c * ((1 - Math.pow(1 + jj, -n)) / jj) + F * Math.pow(1 + nom, -n - 1), `${L(F * c)}*(1-(1+${jjE})**(-${n}))/${jjE} + ${F}*(1+${nomE})**(-${n + 1})`, fmt, "Discounted the redemption one year too many.", `Redemption is at year ${n}, with the last coupon.`),
        d("TRANS_INVERTED_RELATION", F * c * (1 + r) * ((1 - Math.pow(1 + nom, -n)) / nom) + F * Math.pow(1 + nom, -n), `${L(F * c)}*(1+${L(r)})*(1-(1+${nomE})**(-${n}))/${nomE} + ${F}*(1+${nomE})**(-${n})`, fmt, "Indexed every coupon by one year's inflation only.", "Each coupon is indexed from issue to its own payment date.")
      );
      if (level === 3) steps.push(step("F.real-rate", "Nominal yield from the real yield and inflation.", ["i", nom, "nominal yield"], ["ρ", "r"]));
      else steps.push(step("F.real-rate", "Real yield for the indexed coupons.", ["j", j, "real yield"], ["i", "r"]));
      steps.push(step("B.geometric-annuity", "Indexed coupons: an annuity at the real yield.", ["V_c", F * c * ((1 - Math.pow(1 + jj, -n)) / jj), "coupons"], ["c", "j"]));
      steps.push(step("A.discount-factor", "Fixed redemption at the nominal yield.", ["V_R", F * Math.pow(1 + nom, -n), "redemption"], ["i"]));
      steps.push(step("E.price", "Add.", ["P", value, "price"], ["V_c", "V_R"]));
    }
    return compose({
      stem: `${stem}\n\n${ask}`,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: ["decomposition", "substitution"],
      reasoning: "Indexed cash flows are level in real terms (real yield); fixed nominal cash flows stay nominal (nominal yield).",
      intuition: "An index-linked coupon buys the same goods every year, so in real terms the coupons are level — value them at the real yield. A redemption fixed in money is not protected: it must be discounted at the nominal yield. When both are indexed the whole bond is an ordinary bond at the real yield.",
      unknowns: [{ symbol: fmt === PCT3 ? "$i$" : "$P$", meaning: fmt === PCT3 ? "nominal yield" : "price" }],
      relationships: ["$1 + i = (1+j)(1+r)$", "$\\sum Fc(1+r)^t(1+i)^{-t} = Fc\\,a_{\\overline{n|}\\,j}$"],
      conditions: ["Constant expected inflation.", "Annual coupons."],
      valuationDate: "Purchase date",
      modelChoice: "Indexed parts at the real yield; fixed parts at the nominal yield.",
      assumptions: ["Indexation exactly matches inflation."],
      alternative: { name: "Nominal cash flows", body: "Write every cash flow in money of the day and discount at the nominal yield — slower, same answer.", whenUseful: "When indexation is irregular." },
      principle: "Value real cash flows at real rates and nominal cash flows at nominal rates.",
      unusual: "Only some of the cash flows are protected against inflation.",
      misread: "An index-linked bond's coupon rate is a real rate.",
      presentation: level === 1 ? ["combined-topics"] : ["combined-topics", "hidden-structure"],
      features: { multiConcept: true, unfamiliar: level > 1 },
      params: { c, r, n, i, twist, level },
      route: "real and nominal pieces",
    });
  },
};

// ===================================================================== Saving for a goal in today's money

const savingsTarget: QuestionTemplate = {
  id: "infl-savings-target",
  family: "infl-savings-target",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.inflation_real",
  secondary: ["ANNUITIES.level_payment", "ANNUITIES.geometric"],
  reasoning: ["translation", "cashflow_modelling", "financial_intuition", "multistep"],
  soaConcept: "Deposits that must reach a target stated in today's purchasing power: level deposits, deposits growing with inflation, and inflation that changes part-way.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const r = gridRate(rng, 0.02, 0.05, 0.0025);
    const i = r + gridRate(rng, 0.02, 0.05, 0.0025);
    const n = rng.int(10, 25);
    const T = gridAmount(rng, 50000, 500000, 10000);
    const twist = rng.choice(["A", "B"]);
    const sn = (rate: number, m = n) => (Math.pow(1 + rate, m) - 1) / rate;
    const snE = (rate: string, m = n) => `(((1+${rate})**${m}-1)/${rate})`;
    const j = (1 + i) / (1 + r) - 1;
    const jE = `((1+${L(i)})/(1+${L(r)})-1)`;
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let stem: string;
    const ds: DistractorCandidate[] = [];
    const steps: ChainStep[] = [];
    const target = `a fund with the purchasing power of ${amt(T)} today at the end of ${n} years`;
    if (level === 1 && twist === "A") {
      value = (T * Math.pow(1 + r, n)) / sn(i);
      calc = `${L(T)}*(1+${L(r)})**${n}/${snE(L(i))}`;
      model = { expr: `x*${snE(L(i))} - ${L(T)}*(1+${L(r)})**${n}`, description: "Level deposits accumulated at the nominal rate equal the inflated target." };
      stem = `A saver wants ${target}, by level deposits at the end of each year. The fund earns a nominal annual effective rate of ${pct(i)} and inflation is ${pct(r)} a year.\n\nCalculate the annual deposit.`;
      ds.push(
        d("CONC_REAL_NOMINAL_MIX", T / sn(i), `${L(T)}/${snE(L(i))}`, fmt, "Did not inflate the target.", `In ${n} years ${amt(T)} of today's goods will cost ${amt(T * Math.pow(1 + r, n))}.`),
        d("FORMULA_APPROX_REAL", T / sn(i - r), `${L(T)}/${snE(L(i - r))}`, fmt, "Worked at the approximate real rate $i - r$.", "Level nominal deposits must be accumulated at the nominal rate against the inflated target."),
        d("CONC_TVM_INDEXATION_ASSUMED", T / sn(j), `${L(T)}/${snE(jE)}`, fmt, "Accumulated level deposits at the real rate.", "The real-rate shortcut works only for deposits that rise with inflation."),
        d("TIMING_IMMEDIATE_AS_DUE", (T * Math.pow(1 + r, n)) / (sn(i) * (1 + i)), `${L(T)}*(1+${L(r)})**${n}/(${snE(L(i))}*(1+${L(i)}))`, fmt, "Treated the deposits as made at the start of each year.", "Deposits are at year ends."),
        d("CONC_TVM_INFLATION_TWICE", (T * Math.pow(1 + r, 2 * n)) / sn(i), `${L(T)}*(1+${L(r)})**${2 * n}/${snE(L(i))}`, fmt, "Inflated the target twice.", `One adjustment: ${amt(T)} today costs ${amt(T * Math.pow(1 + r, n))} in year ${n}.`),
        d("SEQ_UNDISCOUNTED_SUM", (T * Math.pow(1 + r, n)) / n, `${L(T)}*(1+${L(r)})**${n}/${n}`, fmt, "Divided the target by the number of deposits, ignoring interest.", "Deposits earn interest; use $s_{\\overline{n|}}$.")
      );
      steps.push(step("A.compound", "Inflate the target to money of year n.", ["T_n", T * Math.pow(1 + r, n), "nominal target"], ["T", "r"]), step("B.annuity-immediate-av", "Level deposit from $s_{\\overline{n|}}$ at the nominal rate.", ["X", value, "annual deposit"], ["T_n", "i"], { rearranged: true }));
    } else if (level === 1) {
      const X = gridAmount(rng, 2000, 20000, 500);
      value = (X * sn(i)) / Math.pow(1 + r, n);
      calc = `${L(X)}*${snE(L(i))}/(1+${L(r)})**${n}`;
      model = { expr: `${Array.from({ length: n }, (_, k) => `${L(X)}*(1+${L(i)})**${n - k - 1}`).join(" + ")} - x*(1+${L(r)})**${n}`, description: "Each deposit accumulated, then the total deflated to today's money." };
      stem = `A saver deposits ${amt(X)} at the end of each year for ${n} years into a fund earning a nominal annual effective rate of ${pct(i)}. Inflation is ${pct(r)} a year.\n\nCalculate the value of the fund at the end of ${n} years in today's purchasing power.`;
      ds.push(
        d("CONC_REAL_NOMINAL_MIX", X * sn(i), `${L(X)}*${snE(L(i))}`, fmt, "Gave the nominal fund value.", "Deflate by $(1+r)^n$ to express it in today's money."),
        d("FORMULA_APPROX_REAL", X * sn(i - r), `${L(X)}*${snE(L(i - r))}`, fmt, "Accumulated at $i - r$.", "Level nominal deposits lose purchasing power; accumulate at the nominal rate and deflate the total."),
        d("CONC_TVM_INDEXATION_ASSUMED", X * sn(j), `${L(X)}*${snE(jE)}`, fmt, "Accumulated at the real rate as if the deposits were indexed.", "Each deposit is a fixed amount of money."),
        d("TIMING_IMMEDIATE_AS_DUE", value * (1 + i), `${calc}*(1+${L(i)})`, fmt, "Accumulated deposits made at the start of each year.", "Deposits are at year ends.")
      );
      steps.push(step("B.annuity-immediate-av", "Nominal fund value.", ["F_n", X * sn(i), "nominal fund"], ["X", "i"]), step("A.discount-factor", "Deflate to today's money.", ["F_0", value, "real value"], ["F_n", "r"]));
    } else if (level === 2) {
      const due = twist === "B";
      // Real value of each deposit: X/(1+r) for end-of-year deposits, X for deposits at the start of the year.
      value = due ? T / (sn(j) * (1 + j)) : (T * (1 + r)) / sn(j);
      calc = due ? `${L(T)}/(${snE(jE)}*(1+${jE}))` : `${L(T)}*(1+${L(r)})/${snE(jE)}`;
      const growE = Array.from({ length: n }, (_, k) => `x*(1+${L(r)})**${k}*(1+${L(i)})**${n - k - (due ? 0 : 1)}`).join(" + ");
      model = { expr: `${growE} - ${L(T)}*(1+${L(r)})**${n}`, description: "Growing nominal deposits accumulated at the nominal rate equal the inflated target." };
      stem = `A saver wants ${target}. Deposits are made at the ${due ? "beginning" : "end"} of each year for ${n} years and rise with inflation: the first is $X$ and each later deposit is ${pct(r)} larger than the one before. The fund earns a nominal annual effective rate of ${pct(i)} and inflation is ${pct(r)} a year.\n\nCalculate $X$.`;
      const lvl = (T * Math.pow(1 + r, n)) / (sn(i) * (due ? 1 + i : 1));
      ds.push(
        d("MODEL_LEVEL_FOR_VARYING", lvl, `${L(T)}*(1+${L(r)})**${n}/(${snE(L(i))}${due ? `*(1+${L(i)})` : ""})`, fmt, "Solved for level deposits.", "The deposits grow with inflation, so the first can be smaller."),
        d("CONC_ANN_FIRST_PAYMENT_GROWTH", due ? (T * (1 + r)) / (sn(j) * (1 + j)) : T / sn(j), due ? `${L(T)}*(1+${L(r)})/(${snE(jE)}*(1+${jE}))` : `${L(T)}/${snE(jE)}`, fmt, due ? "Deflated each deposit by one more year than it has." : "Treated the deposits as level X in today's money.", due ? "A deposit made at the start of year t is in that year's money, $(1+r)^{t-1}$ times today's: in real terms each is exactly X." : "Each nominal deposit $X(1+r)^{t-1}$ paid at time t is worth $X/(1+r)$ in today's money."),
        d("FORMULA_APPROX_REAL", value * sn(j) / sn(i - r), `${calc}*${snE(jE)}/${snE(L(i - r))}`, fmt, "Used $i - r$ as the real rate.", "Real rate: $(1+i)/(1+r) - 1$."),
        d("CONC_REAL_NOMINAL_MIX", value / Math.pow(1 + r, n), `${calc}/(1+${L(r)})**${n}`, fmt, "Deflated the target although it is already in today's money.", "The target is stated in today's purchasing power."),
        d("CONC_TVM_INFLATION_TWICE", value * Math.pow(1 + r, n), `${calc}*(1+${L(r)})**${n}`, fmt, "Inflated the target and also worked in real terms.", "Real deposits at the real rate are compared with the real target — no further inflation adjustment."),
        d(due ? "TIMING_DUE_AS_IMMEDIATE" : "TIMING_IMMEDIATE_AS_DUE", due ? (T * (1 + r)) / sn(j) : T / (sn(j) * (1 + j)), due ? `${L(T)}*(1+${L(r)})/${snE(jE)}` : `${L(T)}/(${snE(jE)}*(1+${jE}))`, fmt, due ? "Treated the deposits as made at year ends." : "Treated the deposits as made at the start of each year.", due ? "Deposits are at the start of each year." : "Deposits are at year ends.")
      );
      steps.push(step("F.real-rate", "Real rate.", ["j", j, "real rate"], ["i", "r"]), step("B.geometric-annuity", "In today's money the deposits are level, each $X/(1+r)$; accumulate at the real rate.", ["s", sn(j), "real accumulation factor"], ["j"], { derived: true }), step("B.annuity-immediate-av", "Set the real fund equal to the target and solve.", ["X", value, "first deposit"], ["T", "s"], { rearranged: true }));
    } else {
      const k = rng.int(3, n - 4);
      const r2 = Math.max(0.005, r + rng.choice([-0.015, -0.01, 0.01, 0.015]));
      const idx = (t: number) => (t <= k ? Math.pow(1 + r, t) : Math.pow(1 + r, k) * Math.pow(1 + r2, t - k));
      const idxE = (t: number) => (t <= k ? `(1+${L(r)})**${t}` : `(1+${L(r)})**${k}*(1+${L(r2)})**${t - k}`);
      const factor = Array.from({ length: n }, (_, m) => idx(m) * Math.pow(1 + i, n - m - 1)).reduce((a, b) => a + b, 0);
      const factorE = Array.from({ length: n }, (_, m) => `${idxE(m)}*(1+${L(i)})**${n - m - 1}`).join(" + ");
      value = (T * idx(n)) / factor;
      calc = `${L(T)}*${idxE(n)}/(${factorE})`;
      model = { expr: `x*(${factorE}) - ${L(T)}*${idxE(n)}`, description: "Deposits indexed to actual inflation, accumulated at the nominal rate, equal to the target in money of year n." };
      stem = `A saver wants ${target}. Deposits are made at the end of each year for ${n} years; the first is $X$ and each later deposit increases with that year's inflation. The fund earns a nominal annual effective rate of ${pct(i)}. Inflation is ${pct(r)} a year for the first ${k} years and ${pct(r2)} a year thereafter.\n\nCalculate $X$.`;
      const idx1 = (t: number) => Math.pow(1 + r, t);
      const f1 = Array.from({ length: n }, (_, m) => idx1(m) * Math.pow(1 + i, n - m - 1)).reduce((a, b) => a + b, 0);
      const f1E = Array.from({ length: n }, (_, m) => `(1+${L(r)})**${m}*(1+${L(i)})**${n - m - 1}`).join(" + ");
      ds.push(
        d("MODEL_SINGLE_RATE", (T * idx1(n)) / f1, `${L(T)}*(1+${L(r)})**${n}/(${f1E})`, fmt, `Assumed inflation stays at ${pct(r)}.`, `After year ${k} inflation is ${pct(r2)}.`),
        d("CONC_REAL_NOMINAL_MIX", T / factor, `${L(T)}/(${factorE})`, fmt, "Did not inflate the target.", "The target is in today's money; in money of year n it is larger."),
        d("MODEL_LEVEL_FOR_VARYING", (T * idx(n)) / sn(i), `${L(T)}*${idxE(n)}/${snE(L(i))}`, fmt, "Solved for level deposits.", "The deposits rise with inflation."),
        d("TIMING_IMMEDIATE_AS_DUE", value / (1 + i), `${calc}/(1+${L(i)})`, fmt, "Treated deposits as made at the start of each year.", "Deposits are at year ends."),
        d("CONC_TVM_INFLATION_TWICE", (T * idx(n) * idx(n)) / factor, `${L(T)}*(${idxE(n)})**2/(${factorE})`, fmt, "Inflated the target twice.", "One price-index adjustment from today to year n.")
      );
      steps.push(
        step("A.compound", "Price index at year n through both inflation regimes.", ["I_n", idx(n), "price index"], ["r_1", "r_2"]),
        step("A.compound", "Target in money of year n.", ["T_n", T * idx(n), "nominal target"], ["T", "I_n"]),
        step("B.geometric-annuity", "Accumulation factor of the indexed deposits at the nominal rate.", ["S", factor, "accumulation per unit of X"], ["i", "r_1", "r_2"], { derived: true }),
        step("A.equation-of-value", "Solve $X \\cdot S = T_n$.", ["X", value, "first deposit"], ["T_n", "S"], { rearranged: true })
      );
    }
    return compose({
      stem,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: level === 3 ? ["equation_construction", "decomposition"] : ["rearrangement", "substitution"],
      reasoning: "State the target and the deposits in the same money — today's money with the real rate, or money of the day with the nominal rate.",
      intuition: "A target in today's purchasing power is a moving target in money: it grows with inflation. Level deposits must chase that inflated amount at the nominal rate; deposits that themselves rise with inflation are level in real terms, so the real rate does the work.",
      unknowns: [{ symbol: "$X$", meaning: "deposit" }],
      relationships: ["$T_n = T(1+r)^n$", "$1 + j = (1+i)/(1+r)$"],
      conditions: ["Annual deposits; constant nominal rate."],
      valuationDate: `End of year ${n}`,
      modelChoice: "Accumulation against a target in money of year n.",
      assumptions: ["Inflation as stated."],
      alternative: { name: "Real terms", body: "Deflate every deposit to today's money and accumulate at the real rate against the real target.", whenUseful: "When deposits rise exactly with inflation." },
      principle: "Never compare real and nominal amounts directly.",
      unusual: level === 3 ? "Inflation changes part-way, so no single real rate exists." : "The target is in today's money.",
      misread: "The real-rate shortcut applies only to amounts that rise with inflation.",
      presentation: level === 1 ? ["combined-topics"] : ["combined-topics", "hidden-structure", ...(level === 3 ? (["mixed-timing"] as const) : [])],
      features: { multiConcept: true, unfamiliar: level > 1, multipleValuationDates: level === 3 },
      params: { i, r, n, T, twist, level },
      route: "match real with real, nominal with nominal",
    });
  },
};

export const CURVE_INFLATION_TEMPLATES: QuestionTemplate[] = [bootstrap, annuityStrip, indexedStream, indexedBond, savingsTarget];
