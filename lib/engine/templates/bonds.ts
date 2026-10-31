import { an, bondPrice, sdue, sn, solveRoot, v } from "../finance";
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY2,
  PCT3,
  aExpr,
  aSym,
  amt,
  dec,
  distractor,
  drawUntil,
  explanation,
  features,
  gridRate,
  lit,
  mamt,
  mnum,
  mpc,
  ord,
  pc,
  pvTerms,
  range,
  sExpr,
  sSym,
  sdueExpr,
  shown,
  step,
  chain,
  sumOf,
  vPow,
} from "./kit";

/** Price expression: coupon × a(N) + C × v^N at per-period rate `j`. */
const priceExpr = (coupon: number, C: number, j: number | string, N: number): string =>
  `(${lit(coupon)}*${aExpr(N, j)} + ${lit(C)}*${vPow(j, N)})`;

/** The same price written as explicit discounted cash flows. */
const priceModel = (coupon: number, C: number, j: number | string, N: number): string =>
  `(${pvTerms(range(1, N).map((t) => ({ t, amount: coupon })), j)} + ${lit(C)}*${vPow(j, N)})`;

function drawRates(rng: Parameters<typeof gridRate>[0], minGap = 0.01) {
  return drawUntil(
    () => ({ r: gridRate(rng, 0.04, 0.1, 0.005), y: gridRate(rng, 0.03, 0.1, 0.0025) }),
    ({ r, y }) => Math.abs(r - y) >= minGap
  );
}

function bondTimeline(F: number, coupon: number, C: number, N: number, j: number, title: string) {
  return {
    kind: "bond" as const,
    title,
    face: F,
    couponRate: coupon / F,
    redemption: C,
    yieldRate: j,
    periods: N,
    unit: "half-year" as const,
  };
}

// ===================================================================== price

const bondPricing: QuestionTemplate = {
  id: "bond-price",
  family: "bond-price",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.coupons", "TVM.effective_nominal"],
  reasoning: ["formula_retrieval", "concept_recognition", "cashflow_modelling"],
  soaConcept: "Price of a coupon bond from its yield: coupons as an annuity plus discounted redemption.",
  generate(rng, lvl): QuestionDraft {
    const F = rng.choice([1000, 5000, 10000]);
    const n = rng.int(5, 20);
    const N = 2 * n;
    const { r, y } = drawRates(rng);
    const fmt = MONEY2;
    if (lvl === 1) {
      const j = y / 2;
      const cp = (F * r) / 2;
      const P = bondPrice(F, r / 2, F, j, N);
      const jE = `(${lit(y)}/2)`;
      const fullCoupon = F * r * an(N, j) + F * v(j, N);
      const jEff = Math.pow(1 + y, 0.5) - 1;
      const asEff = cp * an(N, jEff) + F * v(jEff, N);
      const coupons = cp * an(N, j);
      return {
        stem: `A ${n}-year bond with face amount ${amt(F)} pays coupons semiannually at an annual rate of ${pc(r)} and is redeemed at par. It is bought to yield an annual nominal rate of ${pc(y)} convertible semiannually.\n\nCalculate the price of the bond.`,
        answer: {
          value: P,
          calc: priceExpr(cp, F, jE, N),
          format: fmt,
          derivation: `$${mnum(cp, 2)}\\,${aSym(N)} + ${mamt(F)}v^{${N}}$ at $j = ${dec(j, 5)}$: $${shown(P, fmt)}$`,
        },
        model: { expr: priceModel(cp, F, jE, N), description: "Each coupon and the redemption, discounted at the half-year yield." },
        distractors: [
          distractor("RATE_ANNUAL_FOR_PERIODIC", fullCoupon, priceExpr(F * r, F, jE, N), {
            derivation: `$${mnum(F * r, 2)}\\,${aSym(N)} + ${mamt(F)}v^{${N}} = ${shown(fullCoupon, fmt)}$`,
            method: "Paid the full annual coupon every half-year.",
            feedback: `Each semiannual coupon is ${amt(F)} × ${pc(r)}/2 = ${amt(cp)}.`,
          }),
          distractor("RATE_NOMINAL_AS_EFFECTIVE", asEff, priceExpr(cp, F, `((1+${lit(y)})**0.5-1)`, N), {
            derivation: `half-year rate $(${dec(1 + y, 4)})^{1/2} - 1 = ${dec(jEff, 6)}$: $${shown(asEff, fmt)}$`,
            method: `Treated ${pc(y)} as an annual effective yield.`,
            feedback: `A nominal rate convertible semiannually gives exactly ${pc(y)}/2 per half-year.`,
          }),
          distractor("CONC_IGNORED_REDEMPTION", coupons, `${lit(cp)}*${aExpr(N, jE)}`, {
            derivation: `$${mnum(cp, 2)}\\,${aSym(N)} = ${shown(coupons, fmt)}$`,
            method: "Valued the coupons only.",
            feedback: "The buyer also receives the face amount at maturity; its present value must be added.",
          }),
          distractor("SEQ_TERM_COUNT", cp * an(n, j) + F * v(j, n), priceExpr(cp, F, jE, n), {
            derivation: `${n} periods: $${mnum(cp, 2)}\\,${aSym(n)} + ${mamt(F)}v^{${n}} = ${shown(cp * an(n, j) + F * v(j, n), fmt)}$`,
            method: `Counted ${n} coupon periods instead of ${N}.`,
            feedback: `A ${n}-year bond with semiannual coupons has ${N} coupon periods.`,
          }),
          distractor("CONC_PAR_ASSUMPTION", F, `${lit(F)}`, {
            derivation: `price $= ${mamt(F)} = ${shown(F, fmt)}$`,
            method: "Assumed the bond sells at par.",
            feedback: `A bond sells at par only when its coupon rate equals its yield. Here the coupon rate is ${pc(r)} and the yield is ${pc(y)}.`,
          }),
        ],
        explanation: priceExplanation({ F, r, y, n, P, fmt, C: F, effective: false }),
        visuals: [bondTimeline(F, cp, F, N, j, "Coupons, redemption and book value")],
        markers: [cp, j, an(N, j)],
        presentation: ["direct", "frequency"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("B.annuity-immediate", "Coupons: a level annuity on the half-year clock.", ["Fr a_N", cp * an(N, j), "value of the coupons"], ["Fr", "j", "N"]),
            step("A.discount-factor", "Redemption: one payment at maturity.", ["C v^N", F * v(j, N), "value of the redemption"], ["C", "N"]),
            step("E.price", "Price = coupons + redemption.", ["P", P, "price"], ["coupons", "redemption"]),
          ],
          {
            methods: ["decomposition"],
            stages: {
              RATE_ANNUAL_FOR_PERIODIC: [0, "application"],
              RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
              CONC_IGNORED_REDEMPTION: [2, "selection", "B.annuity-immediate"],
              CONC_PAR_ASSUMPTION: [2, "selection"],
              SEQ_TERM_COUNT: [0, "application"],
            },
            reasoning: "List every promised payment and discount each at the half-year yield.",
          }
        ),
        params: { F, r, y, n },
      };
    }

    const prem = rng.choice([1.05, 1.1, 1.08]);
    const C = F * prem;
    const i = y;
    const j = Math.pow(1 + i, 0.5) - 1;
    const cp = (F * r) / 2;
    const P = cp * an(N, j) + C * v(j, N);
    const jE = `((1+${lit(i)})**0.5-1)`;
    const halfRate = cp * an(N, i / 2) + C * v(i / 2, N);
    const couponOnC = ((C * r) / 2) * an(N, j) + C * v(j, N);
    const redeemPar = cp * an(N, j) + F * v(j, N);
    const coupons = cp * an(N, j);
    return {
      stem: `A ${n}-year bond with face amount ${amt(F)} pays semiannual coupons at an annual rate of ${pc(r)} and is redeemable at ${amt(C)}. It is bought to yield an annual effective rate of ${pc(i)}.\n\nCalculate the price of the bond.`,
      answer: {
        value: P,
        calc: priceExpr(cp, C, jE, N),
        format: fmt,
        derivation: `$j = (${dec(1 + i, 4)})^{1/2} - 1 = ${dec(j, 6)}$; $${mnum(cp, 2)}\\,${aSym(N)} + ${mamt(C)}v^{${N}} = ${shown(P, fmt)}$`,
      },
      model: { expr: priceModel(cp, C, jE, N), description: "Coupons on the face amount and the redemption value, discounted at the half-year rate equivalent to the annual effective yield." },
      distractors: [
        distractor("RATE_DIVIDED_EFFECTIVE", halfRate, priceExpr(cp, C, `(${lit(i)}/2)`, N), {
          derivation: `half-year rate $${dec(i, 4)}/2$: $${shown(halfRate, fmt)}$`,
          method: "Halved the annual effective yield.",
          feedback: "An effective annual rate converts to a half-year rate by a square root.",
        }),
        distractor("VAR_FACE_FOR_PRICE", couponOnC, priceExpr((C * r) / 2, C, jE, N), {
          derivation: `coupons $${mnum((C * r) / 2, 2)}$: $${shown(couponOnC, fmt)}$`,
          method: "Computed the coupons on the redemption value.",
          feedback: "Coupons are always the coupon rate times the face amount; the redemption value only affects the final payment.",
        }),
        distractor("TRANS_IGNORED_CONDITION", redeemPar, priceExpr(cp, F, jE, N), {
          derivation: `redemption ${amt(F)}: $${shown(redeemPar, fmt)}$`,
          method: "Assumed redemption at par.",
          feedback: `The bond is redeemed at ${amt(C)}, not ${amt(F)}.`,
        }),
        distractor("SEQ_TERM_COUNT", cp * an(n, j) + C * v(j, n), priceExpr(cp, C, jE, n), {
          derivation: `${n} periods: $${shown(cp * an(n, j) + C * v(j, n), fmt)}$`,
          method: `Counted ${n} coupon periods instead of ${N}.`,
          feedback: `Semiannual coupons over ${n} years make ${N} periods.`,
        }),
        distractor("CONC_IGNORED_REDEMPTION", coupons, `${lit(cp)}*${aExpr(N, jE)}`, {
          derivation: `$${mnum(cp, 2)}\\,${aSym(N)} = ${shown(coupons, fmt)}$`,
          method: "Valued only the coupons.",
          feedback: "The redemption payment is part of what the buyer receives.",
        }),
      ],
      explanation: priceExplanation({ F, r, y: i, n, P, fmt, C, effective: true }),
      visuals: [bondTimeline(F, cp, C, N, j, "Coupons on face, redemption above face")],
      markers: [j, cp, C * v(j, N)],
      presentation: ["frequency", "combined-topics"],
      features: features({ steps: 3, formulaRetrieval: true, multiConcept: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "Half-year rate equivalent to the annual effective yield.", ["j", j, "half-year yield"], ["i"]),
          step("B.annuity-immediate", "Coupons on the face amount.", ["Fr a_N", cp * an(N, j), "value of the coupons"], ["Fr", "j", "N"]),
          step("A.discount-factor", "Redemption at C, not at face.", ["C v^N", C * v(j, N), "value of the redemption"], ["C", "N"]),
          step("E.price", "Price = coupons + redemption.", ["P", P, "price"], ["coupons", "redemption"]),
        ],
        {
          methods: ["decomposition"],
          stages: {
            RATE_DIVIDED_EFFECTIVE: [0, "application"],
            VAR_FACE_FOR_PRICE: [1, "application"],
            TRANS_IGNORED_CONDITION: [2, "application"],
            CONC_IGNORED_REDEMPTION: [3, "selection", "B.annuity-immediate"],
            SEQ_TERM_COUNT: [1, "application"],
          },
          reasoning: "Every rate must match the coupon period; every amount must match its own definition (coupons on F, redemption at C).",
        }
      ),
      params: { F, r, i, n, C },
    };
  },
};

function priceExplanation(p: { F: number; r: number; y: number; n: number; P: number; fmt: AnswerFormat; C: number; effective: boolean }) {
  const { F, r, y, n, P, fmt, C, effective } = p;
  const N = 2 * n;
  const j = effective ? Math.pow(1 + y, 0.5) - 1 : y / 2;
  const cp = (F * r) / 2;
  return explanation({
    intuition: "Buying a bond buys two things: a level stream of coupons, and one lump sum at the end. Its price is just the present value of both at the investor's yield.",
    translation: {
      unknowns: [{ symbol: "$P$", meaning: "the price" }],
      relationships: [`$P = Fr\\,${aSym(N)} + C\\,v^{${N}}$ at $j$`, `$Fr = ${mnum(cp, 2)}$, $C = ${mamt(C)}$`],
      conditions: [`${N} semiannual coupons`, effective ? `$j = (1+i)^{1/2} - 1$` : `$j = i^{(2)}/2 = ${dec(j, 5)}$`],
      valuationDate: "The purchase date, just after a coupon (or at issue).",
      modelChoice: "Price = PV of coupons + PV of redemption, all on a half-year clock.",
      assumptions: ["Coupons are paid on the face amount.", "No default."],
    },
    solution: [
      { title: "Half-year yield", body: `$j = ${dec(j, 6)}$` },
      { title: "Coupons", body: `$${mnum(cp, 2)} \\times ${dec(an(N, j), 5)} = ${mnum(cp * an(N, j), 2)}$` },
      { title: "Redemption, then price", body: `$${mamt(C)} \\times ${dec(v(j, N), 6)} = ${mnum(C * v(j, N), 2)}$; $P = ${shown(P, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Premium/discount formula",
        body: `$P = C + (Fr - Cj)\\,${aSym(N)} = ${mamt(C)} + (${mnum(cp, 2)} - ${mnum(C * j, 2)}) \\times ${dec(an(N, j), 5)}$`,
        whenUseful: "Shows at a glance whether the bond is at a premium (Fr > Cj) or a discount.",
      },
      {
        name: "Calculator",
        body: `N = ${N}, I/Y = ${dec(j * 100, 4)}, PMT = ${mnum(cp, 2)}, FV = ${mamt(C)}; compute PV.`,
        whenUseful: "Fastest under time pressure, once the per-period inputs are right.",
      },
    ],
    transfer: {
      principle: "Every bond price is an equation of value on the coupon clock: convert the yield and the coupon to the coupon period first.",
      unusual: effective ? "The yield is effective annual while coupons are semiannual, and redemption is not at par." : "Coupons and yield are quoted annually but paid semiannually.",
      misread: "Annual figures used per half-year, and forgetting the redemption, are the classic slips.",
    },
  });
}

// ===================================================================== amortization of premium / accumulation of discount

const amortization: QuestionTemplate = {
  id: "bond-amortization",
  family: "bond-schedule",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.yield"],
  reasoning: ["formula_retrieval", "concept_recognition", "algebra", "transfer"],
  soaConcept: "Write-down (or write-up) of book value in a given coupon under the scientific method.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = rng.int(8, 20);
    const N = 2 * n;
    const { r, y } = drawRates(rng, 0.015);
    const j = y / 2;
    const cp = (F * r) / 2;
    const premium = cp > F * j;
    const fmt = MONEY2;
    const jE = `(${lit(y)}/2)`;
    const P = bondPrice(F, r / 2, F, j, N);

    if (lvl === 1) {
      const k = rng.int(2, N - 2);
      const base = Math.abs(cp - F * j);
      const amt0 = base * v(j, N - k + 1);
      const sign = premium ? "" : "-";
      const baseE = premium ? `(${lit(cp)} - ${lit(F)}*${jE})` : `(${lit(F)}*${jE} - ${lit(cp)})`;
      const bookPrev = bondPrice(F, r / 2, F, j, N - k + 1);
      const interest = j * bookPrev;
      const straight = Math.abs(P - F) / N;
      const original = Math.abs(cp - j * P);
      const word0 = premium ? "amortization of premium" : "accumulation of discount";
      return {
        stem: `A ${n}-year ${amt(F)} par bond with semiannual coupons at an annual rate of ${pc(r)} is bought to yield an annual nominal rate of ${pc(y)} convertible semiannually.\n\nCalculate the amount of ${word0} in the ${ord(k)} coupon.`,
        answer: {
          value: amt0,
          calc: `${baseE}*${vPow(jE, N - k + 1)}`,
          format: fmt,
          derivation: `$|Fr - Fj|\\,v^{${N - k + 1}} = ${mnum(base, 2)} \\times ${dec(v(j, N - k + 1), 6)} = ${shown(amt0, fmt)}$`,
        },
        model: {
          expr: `${sign}(${lit(cp)} - ${jE}*${priceModel(cp, F, jE, N - k + 1)})`,
          description: `The book value before coupon ${k} is the price with ${N - k + 1} coupons left; the write-${premium ? "down" : "up"} is the coupon minus interest at j on that book value.`,
        },
        distractors: [
          distractor("TIMING_BALANCE_INDEX", base * v(j, N - k), `${baseE}*${vPow(jE, N - k)}`, {
            derivation: `$|Fr - Fj|\\,v^{${N - k}} = ${shown(base * v(j, N - k), fmt)}$`,
            method: "Used the exponent N − k.",
            feedback: `Coupon ${k} is paid when ${N - k + 1} coupons (including it) remain, so the exponent is N − k + 1. The last coupon's amortization is $|Fr - Fj|v$.`,
          }),
          distractor("VAR_INTEREST_FOR_PRINCIPAL", interest, `${jE}*${priceExpr(cp, F, jE, N - k + 1)}`, {
            derivation: `$j \\times BV_{${k - 1}} = ${dec(j, 5)} \\times ${mnum(bookPrev, 2)} = ${shown(interest, fmt)}$`,
            method: "Reported the interest earned in the coupon instead of the write-down.",
            feedback: `The coupon of ${amt(cp)} splits into interest (j × book value) and the ${premium ? "premium amortized" : "discount accumulated (negative)"}; the question asks for the latter.`,
          }),
          distractor("MODEL_STRAIGHT_LINE", straight, `(${premium ? "" : "-"}(${priceExpr(cp, F, jE, N)} - ${lit(F)}))/${N}`, {
            derivation: `$\\dfrac{|P - F|}{${N}} = \\dfrac{${mnum(Math.abs(P - F), 2)}}{${N}} = ${shown(straight, fmt)}$`,
            method: "Spread the premium (or discount) evenly across the coupons.",
            feedback: "Under the scientific method the write-downs grow geometrically at (1 + j); they are not equal.",
          }),
          distractor("VAR_ORIGINAL_FOR_OUTSTANDING", original, `${premium ? "" : "-"}(${lit(cp)} - ${jE}*${priceExpr(cp, F, jE, N)})`, {
            derivation: `$|Fr - jP| = |${mnum(cp, 2)} - ${dec(j, 5)}(${mnum(P, 2)})| = ${shown(original, fmt)}$`,
            method: "Charged interest on the purchase price rather than the current book value.",
            feedback: `That is the first coupon's write-down. By coupon ${k} the book value has moved to ${mnum(bookPrev, 2)}.`,
          }),
        ],
        explanation: amortizationExplanation({ F, cp, j, N, k, value: amt0, fmt, premium }),
        visuals: [{ ...bondTimeline(F, cp, F, N, j, "Book value moving toward par"), highlightPeriod: k }],
        markers: [base, v(j, N - k + 1), bookPrev],
        presentation: ["direct"],
        features: features({ steps: 3, formulaRetrieval: true }),
        chain: chain(
          [
            step("E.price", "Purchase price at the yield.", ["P", P, "price"], ["F", "r", "j", "N"]),
            step("E.book-value", "Book value just before coupon k: price with N − k + 1 coupons left.", ["BV_{k−1}", bookPrev, "book value before coupon k"], ["N − k + 1"]),
            step("E.bond-amortization", "Write-down = coupon − interest on book value.", ["amort_k", amt0, "change in book value"], ["Fr", "j", "BV_{k−1}"]),
          ],
          {
            stages: {
              TIMING_BALANCE_INDEX: [2, "application"],
              VAR_INTEREST_FOR_PRINCIPAL: [2, "interpretation"],
              MODEL_STRAIGHT_LINE: [2, "selection"],
              VAR_ORIGINAL_FOR_OUTSTANDING: [1, "connection"],
            },
            reasoning: "A bond is a loan with the coupon as the payment: the write-down is the 'principal' part, (Fr − Cj)v^{N−k+1}.",
          }
        ),
        params: { F, r, y, n, k },
      };
    }

    // Level 2: two amortization amounts reveal the yield.
    const pr = drawUntil(
      () => drawRates(rng, 0.015),
      ({ r: rr, y: yy }) => rr > yy
    );
    const cp2 = (F * pr.r) / 2;
    const j2 = pr.y / 2;
    const k1 = rng.int(2, 8);
    const k2 = k1 + rng.int(4, 10);
    const A = Number(((cp2 - F * j2) * v(j2, N - k1 + 1)).toFixed(2));
    const B = Number(((cp2 - F * j2) * v(j2, N - k2 + 1)).toFixed(2));
    const gap = k2 - k1;
    const jj = Math.pow(B / A, 1 / gap) - 1;
    const yNom = 2 * jj;
    const fmt2 = PCT3;
    const ratioE = `(${lit(B)}/${lit(A)})`;
    return {
      stem: `A bond with semiannual coupons is bought at a premium. Under the scientific method, the amount of premium amortized in the ${ord(k1)} coupon is ${mnum(A, 2)}, and the amount amortized in the ${ord(k2)} coupon is ${mnum(B, 2)}.\n\nCalculate the yield rate, expressed as an annual nominal rate convertible semiannually.`,
      answer: {
        value: yNom,
        calc: `2*(${ratioE}**(1/${gap})-1)`,
        format: fmt2,
        derivation: `$(1+j)^{${gap}} = \\dfrac{${mnum(B, 2)}}{${mnum(A, 2)}} \\Rightarrow j = ${dec(jj, 6)}$, so $i^{(2)} = ${shown(yNom, fmt2)}$`,
      },
      model: {
        expr: `${lit(A)}*(1+x/2)**${gap} - ${lit(B)}`,
        bracket: [0.001, 0.4],
        description: "Each write-down is the previous one times (1 + j), so A(1 + j)^(gap) = B.",
      },
      distractors: [
        distractor("VAR_OTHER_UNKNOWN", jj, `${ratioE}**(1/${gap})-1`, {
          derivation: `$j = ${shown(jj, fmt2)}$`,
          method: "Reported the half-year rate.",
          feedback: "The answer must be an annual nominal rate convertible semiannually: twice the half-year rate.",
        }),
        distractor("RATE_NOMINAL_AS_EFFECTIVE", (1 + jj) ** 2 - 1, `(${ratioE}**(1/${gap}))**2-1`, {
          derivation: `$(1 + j)^2 - 1 = ${shown((1 + jj) ** 2 - 1, fmt2)}$`,
          method: "Gave the annual effective rate.",
          feedback: "A nominal rate convertible semiannually is 2j, not (1 + j)² − 1.",
        }),
        distractor("ALG_ROOT_ERROR", 2 * (Math.pow(B / A, 1 / (gap + 1)) - 1), `2*(${ratioE}**(1/${gap + 1})-1)`, {
          derivation: `$2[(${mnum(B, 2)}/${mnum(A, 2)})^{1/${gap + 1}} - 1] = ${shown(2 * (Math.pow(B / A, 1 / (gap + 1)) - 1), fmt2)}$`,
          method: `Counted ${gap + 1} periods between the two coupons.`,
          feedback: `From coupon ${k1} to coupon ${k2} the write-down grows ${gap} times.`,
        }),
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", (2 * (B - A)) / (gap * A), `2*(${lit(B)}-${lit(A)})/(${gap}*${lit(A)})`, {
          derivation: `$2 \\cdot \\dfrac{${mnum(B, 2)} - ${mnum(A, 2)}}{${gap} \\times ${mnum(A, 2)}} = ${shown((2 * (B - A)) / (gap * A), fmt2)}$`,
          method: "Treated the growth in write-downs as linear.",
          feedback: "Write-downs grow geometrically: each is (1 + j) times the previous one.",
        }),
      ],
      explanation: explanation({
        intuition: "Each coupon's premium write-down is bigger than the last by exactly one period's interest factor: as book value falls, interest falls, and more of the coupon goes to writing down the premium. So two write-downs reveal the yield.",
        translation: {
          unknowns: [{ symbol: "$j$", meaning: "the half-year yield" }],
          relationships: [`$\\text{amort}_{t} = (Fr - Cj)v^{n-t+1}$`, `$\\text{amort}_{${k2}} = \\text{amort}_{${k1}}(1+j)^{${gap}}$`],
          conditions: [`$${mnum(A, 2)}(1+j)^{${gap}} = ${mnum(B, 2)}$`],
          valuationDate: "Not needed — the relationship is between coupons.",
          modelChoice: "Recognise the geometric sequence of write-downs.",
          assumptions: ["Scientific (yield) method of amortization.", "Level coupons."],
        },
        solution: [
          { title: "Ratio", body: `$${mnum(B, 2)}/${mnum(A, 2)} = ${dec(B / A, 6)}$` },
          { title: "Half-year rate", body: `$j = ${dec(B / A, 6)}^{1/${gap}} - 1 = ${dec(jj, 6)}$` },
          { title: "Nominal annual", body: `$i^{(2)} = 2j = ${shown(yNom, fmt2)}$` },
        ],
        alternatives: [
          {
            name: "Through book values",
            body: "Write-down = coupon − j × book value, and book values fall by the previous write-down; eliminating the coupon gives the same ratio.",
            whenUseful: "Explains why the ratio is (1 + j).",
          },
        ],
        transfer: {
          principle: "Principal repaid in a loan and premium amortized in a bond follow the same law: each is (1 + per-period yield) times the last.",
          unusual: "Neither coupon nor price is given; the yield is hidden in two write-downs.",
          misread: "The answer format (nominal convertible semiannually) is easy to miss.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Write-downs grow geometrically",
          unit: "half-year",
          series: [{ label: "premium amortized", values: range(1, N).map((t) => ({ t, amount: (cp2 - F * j2) * v(j2, N - t + 1) })) }],
        },
      ],
      markers: [B / A, jj],
      presentation: ["hidden-structure", "unknown-rate", "indirect-wording"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("E.bond-amortization", "Write-downs grow by (1 + j): the ratio of two reveals j.", ["j", jj, "half-year yield"], ["amort_{k1}", "amort_{k2}"], { rearranged: true, derived: true }),
          step("A.nominal-equivalence", "Express as a nominal rate convertible semiannually: 2j.", ["i^{(2)}", yNom, "nominal yield"], ["j"]),
        ],
        {
          methods: ["work_backwards", "rearrangement"],
          stages: {
            VAR_OTHER_UNKNOWN: [1, "interpretation"],
            RATE_NOMINAL_AS_EFFECTIVE: [1, "application"],
            ALG_ROOT_ERROR: [0, "application"],
            SEQ_GEOMETRIC_AS_ARITHMETIC: [0, "selection", "M.arithmetic-series"],
          },
          reasoning: "Book value falls by the write-down, so interest falls by j × write-down and the next write-down is (1 + j) times larger.",
        }
      ),
      params: { k1, k2, A, B },
    };
  },
};

function amortizationExplanation(p: { F: number; cp: number; j: number; N: number; k: number; value: number; fmt: AnswerFormat; premium: boolean }) {
  const { F, cp, j, N, k, value, fmt, premium } = p;
  const bookPrev = bondPrice(F, cp / F, F, j, N - k + 1);
  return explanation({
    intuition: premium
      ? "A premium bond's book value has to fall from the price to par by maturity. Each coupon pays the yield on the current book value; the excess over that interest writes the book value down. Book value falls, so interest falls, so each write-down is larger than the last."
      : "A discount bond's book value has to rise to par. Each coupon is less than the yield on book value, and the shortfall is added to book value — the discount is accumulated.",
    translation: {
      unknowns: [{ symbol: `$\\text{amort}_{${k}}$`, meaning: `the change in book value at coupon ${k}` }],
      relationships: [`$\\text{amort}_{${k}} = |Fr - Fj|\\,v^{${N - k + 1}}$`, `$= |Fr - j\\,BV_{${k - 1}}|$`],
      conditions: [`$Fr = ${mnum(cp, 2)}$, $Fj = ${mnum(F * j, 2)}$`],
      valuationDate: `Just before coupon ${k}: book value $BV_{${k - 1}}$ is the price with ${N - k + 1} coupons left.`,
      modelChoice: "Scientific amortization: interest at the yield on book value.",
      assumptions: ["Redemption at par.", "Book value at the purchase yield."],
    },
    solution: [
      { title: "Coupon minus interest on par", body: `$|Fr - Fj| = |${mnum(cp, 2)} - ${mnum(F * j, 2)}| = ${mnum(Math.abs(cp - F * j), 2)}$` },
      { title: "Discount factor", body: `$v^{${N - k + 1}} = ${dec(v(j, N - k + 1), 6)}$` },
      { title: "Amount", body: `$${shown(value, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Book value route",
        body: `$BV_{${k - 1}} = ${mnum(bookPrev, 2)}$; interest $= j\\,BV_{${k - 1}} = ${mnum(j * bookPrev, 2)}$; difference from the coupon $= ${mnum(Math.abs(cp - j * bookPrev), 2)}$.`,
        whenUseful: "Slower but builds the full picture of the schedule.",
      },
    ],
    transfer: {
      principle: "Bond book values are amortized exactly like loan balances: the coupon is the payment and the premium is the principal.",
      unusual: "Nothing unusual — the exponent is the trap.",
      misread: "The interest part of the coupon is easy to report instead of the write-down.",
    },
  });
}

// ===================================================================== book value

const bookValue: QuestionTemplate = {
  id: "bond-book-value",
  family: "bond-schedule",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.book_market",
  secondary: ["BONDS.amortization", "BONDS.price_redemption"],
  reasoning: ["concept_recognition", "valuation_dates", "translation"],
  soaConcept: "Book value after k coupons versus market value at a new yield.",
  generate(rng, lvl): QuestionDraft {
    const F = rng.choice([1000, 10000]);
    const n = rng.int(8, 20);
    const N = 2 * n;
    const { r, y } = drawRates(rng, 0.015);
    const j = y / 2;
    const cp = (F * r) / 2;
    const k = rng.int(4, N - 4);
    const jE = `(${lit(y)}/2)`;
    const P = bondPrice(F, r / 2, F, j, N);
    const BV = bondPrice(F, r / 2, F, j, N - k);
    const fmt = MONEY2;
    const y2 = drawUntil(() => gridRate(rng, 0.03, 0.11, 0.0025), (yy) => Math.abs(yy - y) >= 0.01 && Math.abs(yy - r) >= 0.005);
    const market = bondPrice(F, r / 2, F, y2 / 2, N - k);
    const distractors = [
      distractor("TIMING_BALANCE_INDEX", bondPrice(F, r / 2, F, j, N - k + 1), priceExpr(cp, F, jE, N - k + 1), {
        derivation: `${N - k + 1} coupons remaining: $${shown(bondPrice(F, r / 2, F, j, N - k + 1), fmt)}$`,
        method: `Used ${N - k + 1} remaining coupons.`,
        feedback: `Immediately after the ${ord(k)} coupon, ${N - k} coupons remain.`,
      }),
      distractor("MODEL_STRAIGHT_LINE", P - (k * (P - F)) / N, `${priceExpr(cp, F, jE, N)} - ${k}*(${priceExpr(cp, F, jE, N)} - ${lit(F)})/${N}`, {
        derivation: `$P - ${k}\\cdot\\dfrac{P - F}{${N}} = ${shown(P - (k * (P - F)) / N, fmt)}$`,
        method: "Wrote the premium (or discount) off in equal instalments.",
        feedback: "Book value follows the yield: it equals the price at the original yield for the remaining term.",
      }),
      distractor("VAR_ORIGINAL_FOR_OUTSTANDING", P, priceExpr(cp, F, jE, N), {
        derivation: `purchase price $= ${shown(P, fmt)}$`,
        method: "Reported the purchase price.",
        feedback: "Book value changes with every coupon as the premium or discount is amortized.",
      }),
      distractor("VAR_TOTAL_FOR_COMPONENT", BV + cp, `${priceExpr(cp, F, jE, N - k)} + ${lit(cp)}`, {
        derivation: `$BV_{${k}} + ${mnum(cp, 2)} = ${shown(BV + cp, fmt)}$`,
        method: "Included the coupon just paid in the book value.",
        feedback: "Immediately after the coupon is paid it has left the bond; the book value covers only the remaining payments.",
      }),
      distractor("CONC_PAR_ASSUMPTION", F, lit(F), {
        derivation: `par $= ${shown(F, fmt)}$`,
        method: "Assumed book value equals par.",
        feedback: "Book value reaches par only at maturity.",
      }),
    ];
    if (lvl === 2) {
      distractors.unshift(
        distractor("TRANS_IRRELEVANT_INFO", market, priceExpr(cp, F, `(${lit(y2)}/2)`, N - k), {
          derivation: `price at ${pc(y2)}: $${shown(market, fmt)}$`,
          method: "Valued the remaining payments at the current market yield.",
          feedback: "That is the market value. Book value is always computed at the purchase yield; the current market yield is irrelevant to it.",
        })
      );
    }
    return {
      stem:
        lvl === 1
          ? `A ${n}-year bond with face amount ${amt(F)} and semiannual coupons at an annual rate of ${pc(r)} is redeemable at par. It is bought to yield an annual nominal rate of ${pc(y)} convertible semiannually.\n\nCalculate the book value of the bond immediately after the ${ord(k)} coupon is paid.`
          : `An investor buys a ${n}-year bond with face amount ${amt(F)} and semiannual coupons at an annual rate of ${pc(r)}, redeemable at par, to yield an annual nominal rate of ${pc(y)} convertible semiannually. Immediately after the ${ord(k)} coupon, market yields on similar bonds are ${pc(y2)} convertible semiannually.\n\nCalculate the investor's book value of the bond at that time.`,
      answer: {
        value: BV,
        calc: priceExpr(cp, F, jE, N - k),
        format: fmt,
        derivation: `$BV_{${k}} = ${mnum(cp, 2)}\\,${aSym(N - k)} + ${mamt(F)}v^{${N - k}} = ${shown(BV, fmt)}$`,
      },
      model: {
        expr: `${priceModel(cp, F, jE, N)}*(1+${jE})**${k} - ${sumOf(range(1, k).map((t) => `${lit(cp)}*(1+${jE})**${k - t}`))}`,
        description: "Retrospectively: the purchase price accumulated at the yield, less the coupons received, accumulated at the yield.",
      },
      distractors,
      explanation: explanation({
        intuition: "Book value is the bond's value in the investor's own accounts. It is fixed by the yield at purchase: at any date it is the price that the original yield would put on the remaining payments. The market can move; book value does not care.",
        translation: {
          unknowns: [{ symbol: `$BV_{${k}}$`, meaning: `book value just after coupon ${k}` }],
          relationships: [`$BV_{${k}} = Fr\\,${aSym(N - k)} + Fv^{${N - k}}$ at the purchase yield`],
          conditions: [`${N - k} coupons remaining`, `$j = ${dec(j, 5)}$`],
          valuationDate: `Just after the ${ord(k)} coupon.`,
          modelChoice: "Prospective book value at the purchase yield.",
          assumptions: ["Scientific amortization.", ...(lvl === 2 ? ["The new market yield affects market value, not book value."] : [])],
        },
        solution: [
          { title: "Remaining term", body: `$${N} - ${k} = ${N - k}$ coupons` },
          { title: "Coupons and redemption", body: `$${mnum(cp, 2)} \\times ${dec(an(N - k, j), 5)} + ${mamt(F)} \\times ${dec(v(j, N - k), 6)}$` },
          { title: "Book value", body: `$BV_{${k}} = ${shown(BV, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Retrospective",
            body: `$BV_{${k}} = P(1+j)^{${k}} - Fr\\,${sSym(k)}$ with $P = ${mnum(P, 2)}$.`,
            whenUseful: "Natural if the price is already known.",
          },
        ],
        transfer: {
          principle: "Book value = PV of remaining payments at the purchase yield; market value = the same payments at the current market yield.",
          unusual: lvl === 2 ? "A plausible but irrelevant market yield is given." : "The question is about an intermediate date.",
          misread: lvl === 2 ? "Using the market yield computes market value, not book value." : "Counting remaining coupons is the main trap.",
        },
      }),
      visuals: [{ ...bondTimeline(F, cp, F, N, j, "Book value path at the purchase yield"), highlightPeriod: k }],
      markers: [N - k, an(N - k, j)],
      presentation: lvl === 2 ? ["irrelevant-info", "valuation-date"] : ["valuation-date"],
      features: features({ steps: 2, unfamiliar: lvl === 2 }),
      chain: chain(
        [
          step("B.annuity-immediate", "Coupons still to come, at the purchase yield.", ["Fr a_{N−k}", cp * an(N - k, j), "value of remaining coupons"], ["Fr", "j", "N − k"]),
          step("E.book-value", "Book value = remaining coupons + redemption, at the purchase yield.", ["BV_k", BV, "book value"], ["F", "N − k"], { valuationDate: "after coupon k" }),
        ],
        {
          stages: {
            TIMING_BALANCE_INDEX: [1, "application"],
            MODEL_STRAIGHT_LINE: [1, "selection"],
            VAR_ORIGINAL_FOR_OUTSTANDING: [1, "interpretation"],
            CONC_PAR_ASSUMPTION: [1, "selection"],
            VAR_TOTAL_FOR_COMPONENT: [1, "interpretation"],
            TRANS_IRRELEVANT_INFO: [1, "application"],
          },
          reasoning: "Retrospectively: the price accumulated at the yield, less each coupon accumulated at the yield.",
        }
      ),
      params: { F, r, y, n, k, ...(lvl === 2 ? { y2 } : {}) },
    };
  },
};

// ===================================================================== yield from price

const yieldFromPrice: QuestionTemplate = {
  id: "bond-yield",
  family: "bond-yield",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.yield",
  secondary: ["BONDS.price_redemption", "TVM.effective_nominal"],
  reasoning: ["concept_recognition", "formula_selection", "validation"],
  soaConcept: "Yield rate implied by a bond's price.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = rng.int(5, 20);
    const { r, y } = drawRates(rng, 0.0125);
    const fmt = PCT3;
    if (lvl === 1) {
      const N = 2 * n;
      const cp = (F * r) / 2;
      const P = Number(bondPrice(F, r / 2, F, y / 2, N).toFixed(2));
      const j = solveRoot((x) => cp * an(N, x) + F * v(x, N) - P, 0.0001, 0.3);
      return {
        stem: `A ${n}-year ${amt(F)} par bond pays semiannual coupons at an annual rate of ${pc(r)}. Its price is ${mnum(P, 2)}.\n\nCalculate the yield rate, expressed as an annual nominal rate convertible semiannually.`,
        answer: {
          value: 2 * j,
          calc: `${lit(cp)}*((1-(1+x/2)**(-${N}))/(x/2)) + ${lit(F)}*(1+x/2)**(-${N}) - ${lit(P)}`,
          format: fmt,
          derivation: `$${mnum(cp, 2)}\\,${aSym(N, "j")} + ${F}v_j^{${N}} = ${mnum(P, 2)} \\Rightarrow j = ${dec(j, 6)}$, $i^{(2)} = ${shown(2 * j, fmt)}$`,
        },
        model: {
          expr: `${sumOf(range(1, N).map((t) => `${lit(cp)}*(1+x/2)**(-${t})`))} + ${lit(F)}*(1+x/2)**(-${N}) - ${lit(P)}`,
          bracket: [0.001, 0.4],
          description: "The nominal yield x makes the explicit sum of discounted coupons and redemption equal the price.",
        },
        distractors: [
          distractor("FORMULA_CURRENT_YIELD", (F * r) / P, `${lit(F * r)}/${lit(P)}`, {
            derivation: `$\\dfrac{${F * r}}{${mnum(P, 2)}} = ${shown((F * r) / P, fmt)}$`,
            method: "Divided the annual coupon by the price.",
            feedback: `That is the current yield. It ignores the ${P > F ? "loss" : "gain"} of ${mnum(Math.abs(P - F), 2)} at redemption.`,
          }),
          distractor("CONC_PAR_ASSUMPTION", r, lit(r), {
            derivation: `coupon rate $= ${shown(r, fmt)}$`,
            method: "Took the coupon rate as the yield.",
            feedback: `The bond is priced ${P > F ? "above" : "below"} par, so the yield ${P > F ? "is below" : "exceeds"} the coupon rate.`,
          }),
          distractor("VAR_OTHER_UNKNOWN", j, `${lit(cp)}*((1-(1+x)**(-${N}))/x) + ${lit(F)}*(1+x)**(-${N}) - ${lit(P)}`, {
            derivation: `$j = ${shown(j, fmt)}$`,
            method: "Reported the half-year yield.",
            feedback: "Convertible semiannually means twice the half-year rate.",
          }),
          distractor("RATE_NOMINAL_AS_EFFECTIVE", (1 + j) ** 2 - 1, `(1+${lit(j)})**2-1`, {
            derivation: `$(1 + j)^2 - 1 = ${shown((1 + j) ** 2 - 1, fmt)}$`,
            method: "Gave the annual effective yield.",
            feedback: "The question asks for a nominal rate convertible semiannually: 2j.",
          }),
        ],
        explanation: yieldExplanation({ F, r, n, P, j, fmt, semi: true }),
        visuals: [bondTimeline(F, cp, F, N, j, "Cash flows the yield must discount to the price")],
        markers: [j, (F * r) / P],
        presentation: ["unknown-rate", "inverse"],
        features: features({ steps: 2 }),
        chain: chain(
          [
            step("E.price", "Write the price equation with the half-year yield unknown.", ["P", P, "given price"], ["Fr", "F", "N"]),
            step("M.root-finding", "Solve for the half-year yield numerically.", ["j", j, "half-year yield"], ["price equation"], { rearranged: true }),
            step("A.nominal-equivalence", "Report as a nominal rate convertible semiannually.", ["i^{(2)}", 2 * j, "nominal yield"], ["j"]),
          ],
          {
            methods: ["equation_construction", "numerical_root"],
            stages: {
              FORMULA_CURRENT_YIELD: [0, "selection"],
              CONC_PAR_ASSUMPTION: [0, "selection"],
              VAR_OTHER_UNKNOWN: [2, "interpretation"],
              RATE_NOMINAL_AS_EFFECTIVE: [2, "application"],
            },
            reasoning: "Bracket the yield: the coupon rate and the current yield both bound it; reprice to narrow the bracket.",
          }
        ),
        params: { F, r, n, P },
      };
    }

    const C = F * rng.choice([1.05, 1.1]);
    const cpA = F * r;
    const P = Number((cpA * an(n, y) + C * v(y, n)).toFixed(2));
    const i = solveRoot((x) => cpA * an(n, x) + C * v(x, n) - P, 0.0001, 0.4);
    const parRedeem = solveRoot((x) => cpA * an(n, x) + F * v(x, n) - P, 0.0001, 0.4);
    const onC = solveRoot((x) => C * r * an(n, x) + C * v(x, n) - P, 0.0001, 0.4);
    return {
      stem: `A ${n}-year bond with face amount ${amt(F)} pays annual coupons at a rate of ${pc(r)} and is redeemable at ${amt(C)}. Its price is ${mnum(P, 2)}.\n\nCalculate the annual effective yield rate.`,
      answer: {
        value: i,
        calc: `${lit(cpA)}*((1-(1+x)**(-${n}))/x) + ${lit(C)}*(1+x)**(-${n}) - ${lit(P)}`,
        format: fmt,
        derivation: `$${cpA}\\,${aSym(n, "i")} + ${mamt(C)}v^{${n}} = ${mnum(P, 2)} \\Rightarrow i = ${shown(i, fmt)}$`,
      },
      model: {
        expr: `${sumOf(range(1, n).map((t) => `${lit(cpA)}*(1+x)**(-${t})`))} + ${lit(C)}*(1+x)**(-${n}) - ${lit(P)}`,
        bracket: [0.001, 0.4],
        description: "The yield makes the discounted coupons and redemption equal the price.",
      },
      distractors: [
        distractor("FORMULA_CURRENT_YIELD", cpA / P, `${lit(cpA)}/${lit(P)}`, {
          derivation: `$${cpA}/${mnum(P, 2)} = ${shown(cpA / P, fmt)}$`,
          method: "Used the current yield.",
          feedback: "The redemption value differs from the price, and that gain or loss is part of the yield.",
        }),
        distractor("TRANS_IGNORED_CONDITION", parRedeem, `${lit(cpA)}*((1-(1+x)**(-${n}))/x) + ${lit(F)}*(1+x)**(-${n}) - ${lit(P)}`, {
          derivation: `redemption at ${F}: $i = ${shown(parRedeem, fmt)}$`,
          method: "Assumed redemption at par.",
          feedback: `The bond is redeemed at ${amt(C)}.`,
        }),
        distractor("VAR_FACE_FOR_PRICE", onC, `${lit(C * r)}*((1-(1+x)**(-${n}))/x) + ${lit(C)}*(1+x)**(-${n}) - ${lit(P)}`, {
          derivation: `coupons ${mnum(C * r, 2)}: $i = ${shown(onC, fmt)}$`,
          method: "Computed coupons on the redemption value.",
          feedback: "Coupons are based on the face amount.",
        }),
        distractor("CONC_PAR_ASSUMPTION", r, lit(r), {
          derivation: `coupon rate $= ${shown(r, fmt)}$`,
          method: "Took the coupon rate as the yield.",
          feedback: "Coupon rate equals yield only when the price equals the redemption value and coupons are on that value.",
        }),
      ],
      explanation: yieldExplanation({ F, r, n, P, j: i, fmt, semi: false, C }),
      visuals: [{ ...bondTimeline(F, cpA, C, n, i, "Annual coupons and a premium redemption"), unit: "year" as const }],
      markers: [i],
      presentation: ["unknown-rate", "inverse"],
      features: features({ steps: 2, unfamiliar: true }),
      chain: chain(
        [
          step("E.price", "Price equation with coupons on F and redemption at C.", ["P", P, "given price"], ["Fr", "C", "n"]),
          step("M.root-finding", "Solve for the yield numerically.", ["i", i, "annual effective yield"], ["price equation"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "numerical_root"],
          stages: {
            FORMULA_CURRENT_YIELD: [0, "selection"],
            TRANS_IGNORED_CONDITION: [0, "application"],
            VAR_FACE_FOR_PRICE: [0, "application"],
            CONC_PAR_ASSUMPTION: [0, "selection"],
          },
          reasoning: "The yield is the rate at which every promised payment is worth the price; solve by trial or the I/Y key.",
        }
      ),
      params: { F, r, n, P, C },
    };
  },
};

function yieldExplanation(p: { F: number; r: number; n: number; P: number; j: number; fmt: AnswerFormat; semi: boolean; C?: number }) {
  const { F, r, n, P, j, fmt, semi, C = F } = p;
  const N = semi ? 2 * n : n;
  const cp = semi ? (F * r) / 2 : F * r;
  return explanation({
    intuition: `The yield is the single rate at which the bond's promised payments are worth exactly the price. A price ${P > C ? "above" : "below"} the redemption value means the investor ${P > C ? "loses" : "gains"} at maturity, so the yield ${P > C ? "is below" : "is above"} what the coupons alone suggest.`,
    translation: {
      unknowns: [{ symbol: semi ? "$j$" : "$i$", meaning: semi ? "the half-year yield" : "the annual effective yield" }],
      relationships: [`$${mnum(P, 2)} = ${mnum(cp, 2)}\\,${aSym(N)} + ${mamt(C)}v^{${N}}$`],
      conditions: [`${N} coupons of ${mnum(cp, 2)}`],
      valuationDate: "The purchase date.",
      modelChoice: "Equation of value with an unknown rate; solve numerically.",
      assumptions: ["All payments are made as promised."],
    },
    solution: [
      { title: "Equation", body: `$${mnum(cp, 2)}\\,${aSym(N)} + ${mamt(C)}v^{${N}} - ${mnum(P, 2)} = 0$` },
      { title: "Solve", body: `${semi ? "$j" : "$i"} = ${dec(j, 6)}$ (calculator: N = ${N}, PMT = ${mnum(cp, 2)}, FV = ${mamt(C)}, PV = −${mnum(P, 2)})` },
      { title: "Report", body: `$${shown(semi ? 2 * j : j, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Check by repricing",
        body: `At the answer, $${mnum(cp, 2)}\\,${aSym(N)} + ${mamt(C)}v^{${N}} = ${mnum(cp * an(N, j) + C * v(j, N), 2)}$.`,
        whenUseful: "A ten-second validation that catches every conversion error.",
      },
    ],
    transfer: {
      principle: "A yield is always the root of an equation of value; current yield and coupon rate are shortcuts that ignore the redemption gain or loss.",
      unusual: semi ? "The answer must be reported in nominal form." : "Redemption is not at par.",
      misread: "Reporting the per-period rate, or an effective rate, when a nominal one is asked.",
    },
  });
}

// ===================================================================== callable bonds

const callable: QuestionTemplate = {
  id: "bond-callable",
  family: "bond-callable",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.callable",
  secondary: ["BONDS.terms", "BONDS.price_redemption"],
  reasoning: ["concept_recognition", "financial_intuition", "validation", "multistep"],
  soaConcept: "Price of a callable bond that guarantees a minimum yield.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = rng.int(12, 20);
    const a = rng.int(5, n - 4);
    const fmt = MONEY2;
    const premium = lvl === 3 ? true : rng.next() < 0.6;
    const { r, y } = drawUntil(
      () => drawRates(rng, 0.01),
      ({ r: rr, y: yy }) => (premium ? rr > yy : rr < yy)
    );
    const j = y / 2;
    const cp = (F * r) / 2;
    const jE = `(${lit(y)}/2)`;
    const price = (years: number, C: number) => cp * an(2 * years, j) + C * v(j, 2 * years);

    if (lvl <= 2) {
      const yearsUsed = premium ? a : n;
      const other = premium ? n : a;
      // Self-check: the chosen date must be the cheapest of every possible redemption date.
      const cheapest = range(a, n).reduce((best, yr) => (price(yr, F) < price(best, F) ? yr : best), a);
      if (cheapest !== yearsUsed) throw new Error("Binding call date is not the minimum-price date.");
      const P = price(yearsUsed, F);
      const mid = Math.round((a + n) / 2);
      const stem = `A ${amt(F)} par bond with semiannual coupons at an annual rate of ${pc(r)} matures at the end of ${n} years. It may be called at par on any coupon date from the end of year ${a} onward.${lvl === 2 ? " A call is more likely in a falling-rate environment, and the issuer has said it expects to call the bond around year " + mid + "." : ""}\n\nCalculate the price that guarantees the investor an annual nominal yield of at least ${pc(y)} convertible semiannually.`;
      return {
        stem,
        answer: {
          value: P,
          calc: priceExpr(cp, F, jE, 2 * yearsUsed),
          format: fmt,
          derivation: `${premium ? "Premium bond: earliest call" : "Discount bond: latest redemption"} (year ${yearsUsed}): $${shown(P, fmt)}$`,
        },
        model: {
          expr: priceModel(cp, F, jE, 2 * yearsUsed),
          description: "The guaranteed-yield price is the minimum, over every possible redemption date, of the price at the required yield; for this bond the minimum is at the date shown.",
        },
        distractors: [
          distractor("MODEL_WRONG_CALL_DATE", price(other, F), priceExpr(cp, F, jE, 2 * other), {
            derivation: `redemption at year ${other}: $${shown(price(other, F), fmt)}$`,
            method: premium ? "Priced to maturity." : "Priced to the earliest call date.",
            feedback: premium
              ? "For a premium bond, an early call cuts off above-market coupons; the investor is protected only by assuming the earliest call."
              : "For a discount bond, the investor is hurt most by waiting longest for the gain at redemption; assume the latest date.",
          }),
          ...(lvl === 2
            ? [
                distractor("TRANS_IRRELEVANT_INFO", price(mid, F), priceExpr(cp, F, jE, 2 * mid), {
                  derivation: `redemption at year ${mid}: $${shown(price(mid, F), fmt)}$`,
                  method: "Priced to the issuer's expected call date.",
                  feedback: "A guaranteed yield must hold whichever date the issuer actually chooses, so the issuer's forecast is irrelevant.",
                }),
              ]
            : []),
          distractor("CONC_PAR_ASSUMPTION", F, lit(F), {
            derivation: `$${shown(F, fmt)}$`,
            method: "Paid par because the call price is par.",
            feedback: "The call price is what the issuer pays on redemption; the investor's price depends on the coupon rate versus the yield.",
          }),
          distractor("RATE_ANNUAL_FOR_PERIODIC", F * r * an(2 * yearsUsed, j) + F * v(j, 2 * yearsUsed), priceExpr(F * r, F, jE, 2 * yearsUsed), {
            derivation: `coupons of ${F * r} per half-year: $${shown(F * r * an(2 * yearsUsed, j) + F * v(j, 2 * yearsUsed), fmt)}$`,
            method: "Paid the annual coupon every half-year.",
            feedback: `Each semiannual coupon is ${amt(cp)}.`,
          }),
          distractor("CONC_IGNORED_REDEMPTION", cp * an(2 * yearsUsed, j), `${lit(cp)}*${aExpr(2 * yearsUsed, jE)}`, {
            derivation: `coupons only: $${shown(cp * an(2 * yearsUsed, j), fmt)}$`,
            method: "Left out the redemption payment.",
            feedback: "The call or maturity payment of par is part of the investor's return.",
          }),
        ],
        explanation: callableExplanation({ premium, a, n, P, fmt, yearsUsed, r, y }),
        visuals: [
          {
            kind: "series",
            title: "Price at the required yield for each possible redemption year",
            unit: "year",
            series: [{ label: "price", values: range(a, n).map((t) => ({ t, amount: price(t, F) })) }],
            caption: premium ? "Premium bond: price falls as the call date gets earlier — the earliest date is the binding one." : "Discount bond: price falls as redemption gets later — maturity binds.",
          },
        ],
        markers: [yearsUsed],
        presentation: lvl === 2 ? ["irrelevant-info"] : ["direct"],
        features: features({ steps: 2, unfamiliar: lvl === 2 }),
        chain: chain(
          [
            step("E.premium-discount", "Classify the bond: coupon vs yield.", ["Fr − Cj", cp - F * j, "premium per period if positive"], ["Fr", "C", "j"]),
            step("E.callable", "Worst case for the investor: earliest call for a premium, latest for a discount.", ["binding year", yearsUsed, "redemption year to price to"], ["classification"]),
            step("E.price", "Price to that date.", ["P", P, "guaranteed-yield price"], ["binding year"]),
          ],
          {
            stages: {
              MODEL_WRONG_CALL_DATE: [1, "selection"],
              TRANS_IRRELEVANT_INFO: [1, "application"],
              CONC_PAR_ASSUMPTION: [2, "selection"],
              RATE_ANNUAL_FOR_PERIODIC: [2, "application"],
              CONC_IGNORED_REDEMPTION: [2, "application"],
            },
            reasoning: "Price the bond at every possible redemption date and take the smallest price.",
          }
        ),
        params: { F, r, y, n, a },
      };
    }

    // Level 3: call premium schedule.
    const b = rng.int(a + 2, n - 2);
    const Cprem = F * rng.choice([1.05, 1.1]);
    const candidates = range(a, n).map((yr) => ({ yr, C: yr <= b ? Cprem : F, p: price(yr, yr <= b ? Cprem : F) }));
    const best = candidates.reduce((m, c) => (c.p < m.p ? c : m));
    const ignorePrem = price(a, F);
    const atMaturity = price(n, F);
    const earliest = price(a, Cprem);
    const alts = [
      distractor("TRANS_IGNORED_CONDITION", ignorePrem, priceExpr(cp, F, jE, 2 * a), {
        derivation: `call at year ${a} for ${F}: $${shown(ignorePrem, fmt)}$`,
        method: "Ignored the call premium.",
        feedback: `Calls up to year ${b} pay ${amt(Cprem)}, which raises the price on those dates.`,
      }),
      distractor("MODEL_WRONG_CALL_DATE", atMaturity, priceExpr(cp, F, jE, 2 * n), {
        derivation: `maturity: $${shown(atMaturity, fmt)}$`,
        method: "Priced to maturity.",
        feedback: "For a premium bond the investor must assume the issuer calls as soon as it is cheapest for the issuer.",
      }),
      distractor("TIMING_VALUATION_DATE", earliest, priceExpr(cp, Cprem, jE, 2 * a), {
        derivation: `first call date with premium: $${shown(earliest, fmt)}$`,
        method: "Checked only the first call date.",
        feedback: `The premium drops after year ${b}; the first par call date (year ${b + 1}) can be cheaper. Every band's earliest date must be checked.`,
      }),
      distractor("CONC_PAR_ASSUMPTION", F, lit(F), {
        derivation: `$${shown(F, fmt)}$`,
        method: "Paid par.",
        feedback: "The coupon exceeds the yield, so the bond is worth more than par on every redemption date.",
      }),
      distractor("RATE_ANNUAL_FOR_PERIODIC", F * r * an(2 * best.yr, j) + best.C * v(j, 2 * best.yr), priceExpr(F * r, best.C, jE, 2 * best.yr), {
        derivation: `coupons of ${F * r} per half-year: $${shown(F * r * an(2 * best.yr, j) + best.C * v(j, 2 * best.yr), fmt)}$`,
        method: "Paid the annual coupon every half-year.",
        feedback: `Each semiannual coupon is ${amt(cp)}.`,
      }),
      distractor("CONC_IGNORED_REDEMPTION", cp * an(2 * best.yr, j), `${lit(cp)}*${aExpr(2 * best.yr, jE)}`, {
        derivation: `coupons only: $${shown(cp * an(2 * best.yr, j), fmt)}$`,
        method: "Left out the redemption payment.",
        feedback: "The call payment is part of what the investor receives.",
      }),
    ].filter((d) => Math.abs(d.value - best.p) > 1e-6);
    return {
      stem: `A ${amt(F)} par bond with semiannual coupons at an annual rate of ${pc(r)} matures at the end of ${n} years. It may be called on any coupon date from the end of year ${a} through the end of year ${b} at ${amt(Cprem)}, and on any coupon date after that at par.\n\nCalculate the price that guarantees the investor an annual nominal yield of at least ${pc(y)} convertible semiannually.`,
      answer: {
        value: best.p,
        calc: priceExpr(cp, best.C, jE, 2 * best.yr),
        format: fmt,
        derivation: `The minimum over all redemption dates occurs at year ${best.yr} (redemption ${amt(best.C)}): $${shown(best.p, fmt)}$`,
      },
      model: { expr: priceModel(cp, best.C, jE, 2 * best.yr), description: `Minimum over every date of the price at the required yield; the minimum is at year ${best.yr}.` },
      distractors: alts,
      explanation: callableExplanation({ premium: true, a, n, P: best.p, fmt, yearsUsed: best.yr, r, y, schedule: { b, Cprem } }),
      visuals: [
        {
          kind: "series",
          title: "Price for each possible redemption year",
          unit: "year",
          series: [{ label: "price", values: candidates.map((c) => ({ t: c.yr, amount: c.p })) }],
          caption: "The guaranteed-yield price is the lowest bar.",
        },
      ],
      markers: [best.yr],
      presentation: ["multi-equation", "hidden-structure"],
      features: features({ steps: 3, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("E.premium-discount", "Coupon above yield on every redemption value: a premium bond.", ["Fr − Cj", cp - Cprem * j, "premium per period at the call price"], ["Fr", "C", "j"]),
          step("E.callable", "Check the first date of every call band and maturity.", ["binding year", best.yr, "redemption year to price to"], ["call schedule"]),
          step("E.price", "Price to the binding date with its redemption value.", ["P", best.p, "guaranteed-yield price"], ["binding year", "C"]),
        ],
        {
          methods: ["equation_construction"],
          unconventional: true,
          stages: {
            TRANS_IGNORED_CONDITION: [2, "application"],
            MODEL_WRONG_CALL_DATE: [1, "selection"],
            TIMING_VALUATION_DATE: [1, "application"],
            CONC_PAR_ASSUMPTION: [2, "selection"],
            RATE_ANNUAL_FOR_PERIODIC: [2, "application"],
            CONC_IGNORED_REDEMPTION: [2, "application"],
          },
          reasoning: "Compute the price for each candidate date (using that date's call price) and take the minimum — the only method that is always right.",
        }
      ),
      params: { F, r, y, n, a, b, Cprem },
    };
  },
};

function callableExplanation(p: { premium: boolean; a: number; n: number; P: number; fmt: AnswerFormat; yearsUsed: number; r: number; y: number; schedule?: { b: number; Cprem: number } }) {
  const { premium, a, n, P, fmt, yearsUsed, r, y, schedule } = p;
  return explanation({
    intuition: premium
      ? "The issuer calls when it suits the issuer — when the bond is expensive to keep. For a premium bond (coupon above yield) that is as early as possible, ending the investor's above-market coupons. To be safe, the investor pays the lowest price over all possible redemption dates."
      : "The bond's coupon is below the yield, so the investor's extra return comes from the gain at redemption. The longer that gain is delayed, the smaller the yield — so the safe assumption is the latest redemption.",
    translation: {
      unknowns: [{ symbol: "$P$", meaning: "the price that guarantees the yield" }],
      relationships: ["$P = \\min_{t} \\big(Fr\\,a_{\\overline{2t|}} + C_t v^{2t}\\big)$ at $j = i^{(2)}/2$"],
      conditions: schedule ? [`Call price ${amt(schedule.Cprem)} through year ${schedule.b}, par afterwards.`] : [`Callable at par from year ${a}; matures at year ${n}.`],
      valuationDate: "Purchase date.",
      modelChoice: "Worst case over redemption dates.",
      assumptions: [`Coupon rate ${pc(r)} versus yield ${pc(y)}: ${premium ? "premium" : "discount"} bond.`],
    },
    solution: [
      { title: "Classify", body: premium ? "Coupon rate exceeds yield: premium bond." : "Coupon rate below yield: discount bond." },
      { title: "Binding date", body: schedule ? `Check the first date of each call band and maturity; the minimum is at year ${yearsUsed}.` : `${premium ? "Earliest call" : "Maturity"}: year ${yearsUsed}.` },
      { title: "Price", body: `$P = ${shown(P, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Price every candidate date",
        body: "Compute the price at the required yield for each possible redemption date and take the smallest.",
        whenUseful: "Always correct, and the only safe method when call prices change over time.",
      },
    ],
    transfer: {
      principle: "A guaranteed yield means the worst case for the investor: price at the redemption date that minimises the price.",
      unusual: schedule ? "The call price steps down, so more than one date must be checked." : "Two plausible redemption dates.",
      misread: "Assuming the call is at maturity (or at the issuer's stated intention).",
    },
  });
}

// ===================================================================== coupon reinvestment

const reinvestment: QuestionTemplate = {
  id: "bond-reinvestment",
  family: "bond-reinvestment",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.yield", "ALM.rates_of_return"],
  reasoning: ["cashflow_modelling", "concept_recognition", "multistep", "valuation_dates"],
  soaConcept: "Accumulated value and realized yield when coupons are reinvested at a different rate.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = rng.int(5, 15);
    const r = gridRate(rng, 0.05, 0.1, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.04, 0.1, 0.0025), (yy) => Math.abs(yy - r) >= 0.0075);
    const k = drawUntil(() => gridRate(rng, 0.02, 0.06, 0.005), (kk) => Math.abs(kk - y) >= 0.015);
    const cp = F * r;
    const AV = cp * sn(n, k) + F;
    if (lvl === 1) {
      const fmt = MONEY2;
      return {
        stem: `A ${n}-year ${amt(F)} par bond pays annual coupons at a rate of ${pc(r)}. It is bought to yield an annual effective rate of ${pc(y)}. Each coupon is reinvested on receipt at an annual effective rate of ${pc(k)}.\n\nCalculate the total accumulated value of the investment at the end of ${n} years, including the redemption payment.`,
        answer: {
          value: AV,
          calc: `${lit(cp)}*${sExpr(n, k)} + ${lit(F)}`,
          format: fmt,
          derivation: `$${cp}\\,${sSym(n)}$ at ${mpc(k)} $+ ${F} = ${shown(AV, fmt)}$`,
        },
        model: { expr: `${sumOf(range(1, n).map((t) => `${lit(cp)}*(1+${lit(k)})**${n - t}`))} + ${lit(F)}`, description: "Each coupon grows at the reinvestment rate from its own date; add the redemption." },
        distractors: [
          distractor("MODEL_REINVEST_AT_YIELD", cp * sn(n, y) + F, `${lit(cp)}*${sExpr(n, y)} + ${lit(F)}`, {
            derivation: `$${cp}\\,${sSym(n)}$ at ${mpc(y)} $+ ${F} = ${shown(cp * sn(n, y) + F, fmt)}$`,
            method: "Reinvested the coupons at the purchase yield.",
            feedback: `The coupons earn ${pc(k)} once received; the purchase yield applies only to the price.`,
          }),
          distractor("CONC_IGNORED_REDEMPTION", cp * sn(n, k), `${lit(cp)}*${sExpr(n, k)}`, {
            derivation: `$${cp}\\,${sSym(n)} = ${shown(cp * sn(n, k), fmt)}$`,
            method: "Left out the redemption payment.",
            feedback: "At maturity the investor also receives the face amount.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", n * cp + F, `${n}*${lit(cp)} + ${lit(F)}`, {
            derivation: `$${n} \\times ${cp} + ${F} = ${shown(n * cp + F, fmt)}$`,
            method: "Ignored interest on the reinvested coupons.",
            feedback: "Each coupon earns interest from receipt until maturity.",
          }),
          distractor("TIMING_IMMEDIATE_AS_DUE", cp * sdue(n, k) + F, `${lit(cp)}*${sdueExpr(n, k)} + ${lit(F)}`, {
            derivation: `$${cp}\\,\\ddot{s}_{\\overline{${n}|}} + ${F} = ${shown(cp * sdue(n, k) + F, fmt)}$`,
            method: "Gave each coupon one extra year of reinvestment interest.",
            feedback: "The last coupon arrives at maturity and earns nothing; the coupons form an annuity-immediate.",
          }),
        ],
        explanation: reinvestExplanation({ F, cp, n, y, k, AV, fmt, yieldAsked: false }),
        visuals: [
          {
            kind: "timeline",
            title: "Coupons rolled forward at the reinvestment rate",
            unit: "year",
            rate: k,
            flows: [...range(1, n).map((t) => ({ t, amount: cp, dir: "in" as const, label: "coupon" })), { t: n, amount: F, dir: "in" as const, label: "redemption" }],
            valuationTimes: [n],
          },
        ],
        markers: [sn(n, k), cp * sn(n, k)],
        presentation: ["combined-topics"],
        features: features({ steps: 2, multiConcept: true }),
        chain: chain(
          [
            step("B.annuity-immediate-av", "Coupons grow at the reinvestment rate, not the yield.", ["Fr s_n", cp * sn(n, k), "accumulated coupons"], ["Fr", "k", "n"]),
            step("C.reinvestment", "Add the redemption payment.", ["AV", AV, "total at maturity"], ["coupons", "F"]),
          ],
          {
            stages: {
              MODEL_REINVEST_AT_YIELD: [0, "application"],
              CONC_IGNORED_REDEMPTION: [1, "application"],
              SEQ_UNDISCOUNTED_SUM: [0, "selection"],
              TIMING_IMMEDIATE_AS_DUE: [0, "selection", "B.annuity-due-av"],
            },
            reasoning: "Follow the cash: each coupon starts its own deposit at the reinvestment rate; the redemption arrives at maturity.",
          }
        ),
        params: { F, r, y, k, n },
      };
    }

    const semi = lvl === 3;
    const N = semi ? 2 * n : n;
    const cpp = semi ? cp / 2 : cp;
    const yy = semi ? Math.pow(1 + y, 0.5) - 1 : y;
    const kk = semi ? k / 2 : k;
    const P = cpp * an(N, yy) + F * v(yy, N);
    const AV2 = cpp * sn(N, kk) + F;
    const realized = Math.pow(AV2 / P, 1 / n) - 1;
    const fmt = PCT3;
    const PE = semi ? priceExpr(cpp, F, `((1+${lit(y)})**0.5-1)`, N) : priceExpr(cpp, F, y, N);
    const AVE = `(${lit(cpp)}*${sExpr(N, semi ? `(${lit(k)}/2)` : k)} + ${lit(F)})`;
    const simple = (AV2 / P - 1) / n;
    const noInterest = Math.pow((N * cpp + F) / P, 1 / n) - 1;
    const rootErr = Math.pow(AV2 / P, 1 / (n + 1)) - 1;
    return {
      stem: semi
        ? `A ${n}-year ${amt(F)} par bond pays semiannual coupons at an annual rate of ${pc(r)}. It is bought at a price that gives an annual effective yield of ${pc(y)}. Coupons are reinvested on receipt at an annual nominal rate of ${pc(k)} convertible semiannually. The bond is held to maturity.\n\nCalculate the investor's annual effective yield over the ${n} years, taking reinvestment into account.`
        : `A ${n}-year ${amt(F)} par bond pays annual coupons at a rate of ${pc(r)}. It is bought to yield an annual effective rate of ${pc(y)}. Coupons are reinvested on receipt at an annual effective rate of ${pc(k)}. The bond is held to maturity.\n\nCalculate the investor's annual effective yield over the ${n} years, taking reinvestment into account.`,
      answer: {
        value: realized,
        calc: `(${AVE}/${PE})**(1/${n})-1`,
        format: fmt,
        derivation: `$\\left(\\dfrac{${mnum(AV2, 2)}}{${mnum(P, 2)}}\\right)^{1/${n}} - 1 = ${shown(realized, fmt)}$`,
      },
      model: {
        expr: `${PE}*(1+x)**${n} - ${AVE}`,
        bracket: [0.001, 0.3],
        description: "The realized yield grows the price into the total accumulated value over the holding period.",
      },
      distractors: [
        distractor("MODEL_REINVEST_AT_YIELD", y, lit(y), {
          derivation: `purchase yield $= ${shown(y, fmt)}$`,
          method: "Reported the purchase yield.",
          feedback: `The purchase yield assumes coupons are reinvested at ${pc(y)}. They actually earn ${pc(k)}, so the realized yield is ${k < y ? "lower" : "higher"}.`,
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `(${AVE}/${PE} - 1)/${n}`, {
          derivation: `$\\dfrac{${mnum(AV2, 2)}/${mnum(P, 2)} - 1}{${n}} = ${shown(simple, fmt)}$`,
          method: "Divided the total return by the number of years.",
          feedback: "An annual effective yield compounds: take the n-th root of the growth factor.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", noInterest, `((${N}*${lit(cpp)} + ${lit(F)})/${PE})**(1/${n})-1`, {
          derivation: `$\\left(\\dfrac{${mnum(N * cpp + F, 2)}}{${mnum(P, 2)}}\\right)^{1/${n}} - 1 = ${shown(noInterest, fmt)}$`,
          method: "Ignored interest on the reinvested coupons.",
          feedback: "The coupons earn interest after they are received; that interest is part of the investor's return.",
        }),
        distractor("ALG_ROOT_ERROR", rootErr, `(${AVE}/${PE})**(1/${n + 1})-1`, {
          derivation: `$\\left(\\dfrac{${mnum(AV2, 2)}}{${mnum(P, 2)}}\\right)^{1/${n + 1}} - 1 = ${shown(rootErr, fmt)}$`,
          method: `Took the ${ord(n + 1)} root.`,
          feedback: `The investment lasts ${n} years.`,
        }),
      ],
      explanation: reinvestExplanation({ F, cp: cpp, n, y, k, AV: AV2, fmt, yieldAsked: true, P, realized, semi }),
      visuals: [
        {
          kind: "flowchart",
          title: "From price to realized yield",
          nodes: [
            { id: "p", label: `Price $${mnum(P, 2)}$`, detail: `at ${pc(y)}`, tone: "input" },
            { id: "c", label: `Coupons reinvested`, detail: `at ${pc(k)}${semi ? " convertible semiannually" : ""}`, tone: "step" },
            { id: "av", label: `Accumulated $${mnum(AV2, 2)}$`, detail: "coupons + interest + redemption", tone: "step" },
            { id: "y", label: `Realized yield`, detail: "(AV/P)^(1/n) − 1", tone: "result" },
          ],
          edges: [
            { from: "p", to: "c" },
            { from: "c", to: "av" },
            { from: "av", to: "y" },
          ],
        },
      ],
      markers: [P, AV2, AV2 / P],
      presentation: semi ? ["frequency", "combined-topics", "multi-equation"] : ["combined-topics", "multi-equation"],
      features: features({ steps: 3, multiConcept: true, formulaRetrieval: semi, unfamiliar: semi }),
      chain: chain(
        [
          step("E.price", "Price paid at the purchase yield.", ["P", P, "price"], ["coupons", "redemption", "yield"]),
          step("B.annuity-immediate-av", "Coupons accumulated at the reinvestment rate.", ["coupons AV", cpp * sn(N, kk), "accumulated coupons"], ["coupon", "reinvestment rate"]),
          step("C.reinvestment", "Total at maturity = coupons accumulated + redemption.", ["AV", AV2, "total at maturity"], ["coupons AV", "F"]),
          step("C.yield-rate", "What I have = what I demand: P(1 + i*)ⁿ = AV.", ["i*", realized, "realized yield"], ["P", "AV"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction"],
          unconventional: semi,
          stages: {
            MODEL_REINVEST_AT_YIELD: [3, "interpretation"],
            MODEL_COMPOUND_AS_SIMPLE: [3, "application"],
            SEQ_UNDISCOUNTED_SUM: [1, "application"],
            ALG_ROOT_ERROR: [3, "application"],
          },
          reasoning: "The realized yield compares what the money actually grew to with what was paid, over the holding period.",
        }
      ),
      params: { F, r, y, k, n, semi },
    };
  },
};

function reinvestExplanation(p: { F: number; cp: number; n: number; y: number; k: number; AV: number; fmt: AnswerFormat; yieldAsked: boolean; P?: number; realized?: number; semi?: boolean }) {
  const { F, cp, n, y, k, AV, fmt, yieldAsked, P = 0, realized = 0, semi } = p;
  const N = semi ? 2 * n : n;
  const kk = semi ? k / 2 : k;
  return explanation({
    intuition: "A bond's quoted yield quietly assumes every coupon earns that same yield after it is received. If coupons are reinvested at a different rate, the investor's money grows differently — so follow the actual money: coupons into a reinvestment account, plus the redemption.",
    translation: {
      unknowns: yieldAsked ? [{ symbol: "$i^*$", meaning: "the realized annual effective yield" }] : [{ symbol: "$AV$", meaning: "total accumulated value at maturity" }],
      relationships: [`$AV = ${mnum(cp, 2)}\\,${sSym(N)}$ at ${semi ? `${mpc(k)}/2` : mpc(k)} $+ ${F}$`, ...(yieldAsked ? ["$P(1+i^*)^{n} = AV$"] : [])],
      conditions: [`Purchase yield ${pc(y)} sets the price only.`],
      valuationDate: `Maturity, time ${n}.`,
      modelChoice: "Follow the investor's cash: reinvestment account plus redemption.",
      assumptions: ["Coupons reinvested immediately on receipt.", "Bond held to maturity."],
    },
    solution: yieldAsked
      ? [
          { title: "Price", body: `$P = ${mnum(P, 2)}$` },
          { title: "Accumulated value", body: `$${mnum(cp, 2)} \\times ${dec(sn(N, kk), 5)} + ${F} = ${mnum(AV, 2)}$` },
          { title: "Realized yield", body: `$i^* = (${mnum(AV, 2)}/${mnum(P, 2)})^{1/${n}} - 1 = ${shown(realized, fmt)}$` },
        ]
      : [
          { title: "Reinvested coupons", body: `$${mnum(cp, 2)} \\times ${dec(sn(N, kk), 5)} = ${mnum(cp * sn(N, kk), 2)}$` },
          { title: "Add the redemption", body: `$+ ${F}$` },
          { title: "Total", body: `$AV = ${shown(AV, fmt)}$` },
        ],
    alternatives: [
      {
        name: "Interest-on-interest decomposition",
        body: `$AV = \\underbrace{${N} \\times ${mnum(cp, 2)}}_{\\text{coupons}} + \\underbrace{${mnum(cp * sn(N, kk) - N * cp, 2)}}_{\\text{interest on coupons}} + ${F}$`,
        whenUseful: "Shows exactly how much the reinvestment rate contributes.",
      },
    ],
    transfer: {
      principle: "Realized return depends on the rates actually earned on every cash flow; the purchase yield applies to the price only.",
      unusual: "Two different rates apply to the same bond.",
      misread: "The purchase yield is easy to reuse for reinvestment.",
    },
  });
}

// ===================================================================== linearity of price in coupon rate

const linearPrice: QuestionTemplate = {
  id: "bond-linear-coupon",
  family: "bond-price",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.terms",
  secondary: ["BONDS.price_redemption", "BONDS.coupons"],
  reasoning: ["transfer", "algebra", "simultaneous_equations", "formula_reconstruction"],
  soaConcept: "Comparing bonds with the same term and yield: price is linear in the coupon rate.",
  generate(rng, lvl): QuestionDraft {
    const F = 1000;
    const n = rng.int(6, 20);
    const y = gridRate(rng, 0.04, 0.09, 0.0025);
    const rates = rng.shuffle([0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1]).slice(0, 3);
    const [r1, r2, r3] = rates;
    const price = (rr: number) => F * rr * an(n, y) + F * v(y, n);
    const PA = Number(price(r1).toFixed(2));
    const PB = Number(price(r2).toFixed(2));
    const P3 = PA + ((r3 - r1) / (r2 - r1)) * (PB - PA);
    const fmt = MONEY2;
    const prop = (PA * r3) / r1;
    const avg = (PA + PB) / 2;
    const sign = PA - ((r3 - r1) / (r2 - r1)) * (PB - PA);
    const third = lvl === 3;
    return {
      stem: third
        ? `Bonds A, B and C each have face amount ${amt(F)}, pay annual coupons, mature in ${n} years at par and are priced at the same yield rate. Bond A has coupon rate ${pc(r1)} and price ${mnum(PA, 2)}. Bond B has coupon rate ${pc(r2)} and price ${mnum(PB, 2)}. The yield rate is not given.\n\nCalculate the price of Bond C, whose coupon rate is ${pc(r3)}.`
        : `Two ${n}-year ${amt(F)} par bonds with annual coupons are priced at the same yield. The bond with coupon rate ${pc(r1)} costs ${mnum(PA, 2)} and the bond with coupon rate ${pc(r2)} costs ${mnum(PB, 2)}.\n\nCalculate the price, at the same yield, of a ${n}-year ${amt(F)} par bond with annual coupons at ${pc(r3)}.`,
      answer: {
        value: P3,
        calc: `${lit(PA)} + (${lit(r3)}-${lit(r1)})/(${lit(r2)}-${lit(r1)})*(${lit(PB)}-${lit(PA)})`,
        format: fmt,
        derivation: `$P_C = ${mnum(PA, 2)} + \\dfrac{${dec(r3, 2)} - ${dec(r1, 2)}}{${dec(r2, 2)} - ${dec(r1, 2)}}(${mnum(PB, 2)} - ${mnum(PA, 2)}) = ${shown(P3, fmt)}$`,
      },
      model: {
        expr: `x - (${lit(F * r3)}*((${lit(PB)}-${lit(PA)})/(${lit(F)}*(${lit(r2)}-${lit(r1)}))) + (${lit(PA)} - ${lit(F * r1)}*((${lit(PB)}-${lit(PA)})/(${lit(F)}*(${lit(r2)}-${lit(r1)})))))`,
        bracket: [100, 3000],
        description: "From A and B: the annuity factor a = (P_B − P_A)/(F(r_B − r_A)) and the redemption PV Fv^n = P_A − F r_A a. Bond C is F r_C a + Fv^n.",
      },
      distractors: [
        distractor("CONC_IGNORED_REDEMPTION", prop, `${lit(PA)}*${lit(r3)}/${lit(r1)}`, {
          derivation: `$${mnum(PA, 2)} \\times \\dfrac{${dec(r3, 2)}}{${dec(r1, 2)}} = ${shown(prop, fmt)}$`,
          method: "Scaled the price in proportion to the coupon rate.",
          feedback: "Only the coupon part of the price scales with the coupon rate; the redemption part, $Fv^n$, is the same for all three bonds.",
        }),
        distractor("ALLOC_EVEN_SPLIT", avg, `(${lit(PA)}+${lit(PB)})/2`, {
          derivation: `$\\tfrac12(${mnum(PA, 2)} + ${mnum(PB, 2)}) = ${shown(avg, fmt)}$`,
          method: "Averaged the two prices.",
          feedback: `Averaging is right only if Bond C's coupon is halfway between the others. Interpolate by coupon rate.`,
        }),
        distractor("ALG_SIGN_ERROR", sign, `${lit(PA)} - (${lit(r3)}-${lit(r1)})/(${lit(r2)}-${lit(r1)})*(${lit(PB)}-${lit(PA)})`, {
          derivation: `$${mnum(PA, 2)} - \\dfrac{${dec(r3 - r1, 2)}}{${dec(r2 - r1, 2)}}(${mnum(PB - PA, 2)}) = ${shown(sign, fmt)}$`,
          method: "Extrapolated in the wrong direction.",
          feedback: "A higher coupon rate always means a higher price at the same yield.",
        }),
        distractor("CONC_PAR_ASSUMPTION", F, lit(F), {
          derivation: `$${shown(F, fmt)}$`,
          method: "Assumed par.",
          feedback: "Par would require the coupon rate to equal the yield, which the two given prices rule out.",
        }),
      ],
      explanation: explanation({
        intuition: "For bonds with the same term, redemption and yield, the price is (coupon) × (the same annuity factor) + (the same redemption value). So price is a straight line in the coupon rate — two points determine the line.",
        translation: {
          unknowns: [
            { symbol: "$a$", meaning: `the common annuity factor $a_{\\overline{${n}|}}$` },
            { symbol: "$R$", meaning: `the common redemption PV $Fv^{${n}}$` },
          ],
          relationships: [`$${mnum(PA, 2)} = ${F * r1}a + R$`, `$${mnum(PB, 2)} = ${F * r2}a + R$`, `$P_C = ${mnum(F * r3, 0)}a + R$`],
          conditions: ["Same term, face, redemption and yield for all bonds."],
          valuationDate: "The pricing date.",
          modelChoice: "Two equations, two unknowns (a and R) — or straight-line interpolation in the coupon rate.",
          assumptions: ["Prices given exactly at the common yield."],
        },
        solution: [
          { title: "Annuity factor", body: `$a = \\dfrac{${mnum(PB, 2)} - ${mnum(PA, 2)}}{${F * r2} - ${F * r1}} = ${dec((PB - PA) / (F * (r2 - r1)), 5)}$` },
          { title: "Redemption PV", body: `$R = ${mnum(PA, 2)} - ${F * r1}a = ${mnum(PA - F * r1 * ((PB - PA) / (F * (r2 - r1))), 2)}$` },
          { title: "Bond C", body: `$P_C = ${mnum(F * r3, 0)}a + R = ${shown(P3, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Interpolate",
            body: `$P_C = P_A + \\dfrac{r_C - r_A}{r_B - r_A}(P_B - P_A)$`,
            whenUseful: "Fastest once linearity is recognised.",
          },
          {
            name: "Solve for the yield",
            body: "Find the yield from either bond's price numerically, then price Bond C.",
            whenUseful: "Works, but needs a numerical solve and invites rounding error.",
          },
        ],
        transfer: {
          principle: "When several instruments share all terms but one, express each price as a linear function of that term and eliminate the shared unknowns.",
          unusual: third ? "The yield is deliberately withheld." : "Two prices replace the yield.",
          misread: "Scaling the whole price by the coupon ratio ignores the fixed redemption part.",
        },
      }),
      visuals: [
        {
          kind: "series",
          title: "Price is linear in the coupon rate",
          unit: "year",
          series: [{ label: "price", values: [0.02, 0.04, 0.06, 0.08, 0.1].map((rr, idx) => ({ t: idx + 1, amount: price(rr) })) }],
          caption: "Coupon rates 2%, 4%, 6%, 8%, 10% (left to right): equal steps in coupon give equal steps in price.",
        },
      ],
      markers: [(PB - PA) / (F * (r2 - r1))],
      presentation: ["hidden-structure", "multi-equation", "indirect-wording"],
      features: features({ steps: 3, unfamiliar: true }),
      chain: chain(
        [
          step("M.linear-system", "Two price equations share a and Fvⁿ: eliminate Fvⁿ.", ["a_n", (PB - PA) / (F * (r2 - r1)), "common annuity factor"], ["P_A", "P_B"], { rearranged: true }),
          step("E.price", "Recover the redemption part from either bond.", ["Fvⁿ", PA - F * r1 * ((PB - PA) / (F * (r2 - r1))), "value of the redemption"], ["P_A", "a_n"]),
          step("E.price", "Price the third bond with the same two pieces.", ["P_C", P3, "price of bond C"], ["a_n", "Fvⁿ", "r_C"]),
        ],
        {
          methods: ["elimination", "simultaneous"],
          unconventional: lvl === 3,
          stages: {
            CONC_IGNORED_REDEMPTION: [2, "selection"],
            ALLOC_EVEN_SPLIT: [2, "connection"],
            ALG_SIGN_ERROR: [2, "application"],
            CONC_PAR_ASSUMPTION: [2, "selection"],
          },
          reasoning: "Price is a straight line in the coupon rate: interpolate between the two known points.",
        }
      ),
      params: { F, n, r1, r2, r3, PA, PB },
    };
  },
};

export const BOND_TEMPLATES: QuestionTemplate[] = [bondPricing, amortization, bookValue, yieldFromPrice, callable, reinvestment, linearPrice];

