/**
 * Bonds: price, yield, book value and the amortization schedule — modelled on
 * the SOA sample-set question types for the bonds section of the syllabus.
 * Bonds are always valued on a coupon date; the syllabus excludes valuation
 * between coupon dates.
 */
import type { Rng } from "../../random";
import { distractor, type GeneratedQuestionItem, type QuestionTemplateDefinition } from "../types";
import {
  adue,
  amt,
  an,
  bondPrice,
  bookValue,
  cents,
  close,
  couponPeriodRate,
  couponText,
  dec,
  drawUntil,
  fraction,
  frequency,
  gridAmount,
  gridRate,
  mn,
  mpc,
  n,
  ord,
  pc,
  perPeriod,
  sn,
  solve,
  trySolve,
  v,
  word,
  yieldText,
} from "./kit";

const BONDS = "BONDS" as const;

/** Prices and amounts print whole from 200 up and to the cent below, as the sample set does. */
const amountFormat = (value: number) => (Math.abs(value) < 200 ? "AMOUNT_2" : "AMOUNT_0") as "AMOUNT_2" | "AMOUNT_0";

const aSym = (count: number | string, rate = "j") => `a_{\\overline{${count}}|${rate}}`;
const sSym = (count: number | string, rate = "j") => `s_{\\overline{${count}}|${rate}}`;

/** Solves for the yield per coupon period that reproduces a price. */
function yieldFor(price: number, coupon: number, redemption: number, periods: number): number {
  return solve((j) => bondPrice(coupon, redemption, j, periods) - price, -0.2, 1);
}

/** The key-stroke line the sample solutions use for a financial-calculator solve. */
const calculator = (N: number, PV: number, PMT: number, FV: number) =>
  `(calculator: $N = ${N}$, $PV = -${mn(PV, 2)}$, $PMT = ${mn(PMT, 4)}$, $FV = ${mn(FV, 2)}$)`;

export const SOA_BOND_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_BOND_PRICE",
    domain: BONDS,
    title: "Price of a Bond",
    objective: "Price a bond from its coupons, redemption value and yield rate, including a yield quoted on a different basis from the coupons.",
    difficulty: 1,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [71, 189, 292],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.3) {
        const F = rng.choice([1000, 1000, 2000, 5000]);
        const C = Math.round(F * rng.choice([1, 1.05, 1.08, 1.1, 1.2]));
        const r = gridRate(rng, 0.04, 0.1, 0.005);
        const y = drawUntil(() => gridRate(rng, 0.04, 0.12, 0.005), (x) => Math.abs(x - r) > 0.004, r + 0.02);
        const years = rng.int(8, 25);
        const j = y / 2;
        const pvC = Math.round(C * v(j, 2 * years));
        const coupon = (F * r) / 2;
        const vn = pvC / C;
        const annuity = (1 - vn) / j;
        const price = coupon * annuity + pvC;
        return {
          questionText: `A bond with a face value of ${n(F)} and a redemption value of ${n(C)} has ${couponText(r, 2)}. The bond is bought to yield an annual nominal rate of ${pc(y)} convertible semiannually.
At this yield rate, the present value of the redemption value is ${n(pvC)} on the purchase date.
Calculate the purchase price of the bond.`,
          variables: { variant: "PV_REDEMPTION", F, C, r, y, pvC },
          correctValue: price,
          format: amountFormat(price),
          distractors: [
            distractor(coupon / j + pvC, "CALCULATION_DISTRACTOR", "Valued the coupons as a perpetuity, leaving out the factor $1 - v^n$."),
            distractor(coupon * ((1 - pvC / F) / j) + pvC, "CALCULATION_DISTRACTOR", "Found $v^n$ by dividing by the face value instead of the redemption value."),
            distractor(coupon * annuity * (1 + j) + pvC, "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
            distractor(((C * r) / 2) * annuity + pvC, "CALCULATION_DISTRACTOR", "Based the coupons on the redemption value instead of the face value."),
            distractor(coupon * ((1 - vn) / y) + pvC, "NOMINAL_RATE_ERROR", "Divided by the annual rate instead of the semiannual rate."),
          ],
          solutionSteps: `**Step 1 — Discount factor over the term.** The redemption value's present value gives $v^n = ${mn(pvC)}/${mn(C)} = ${dec(vn, 6)}$ at $j = ${dec(j, 4)}$ per half-year; the term itself is not needed.

**Step 2 — Price.** The coupons are $${mn(F)}(${dec(r / 2, 4)}) = ${mn(coupon, 2)}$ each, so
$$P = ${mn(coupon, 2)}\\cdot\\frac{1 - ${dec(vn, 6)}}{${dec(j, 4)}} + ${mn(pvC)} = ${mn(coupon * annuity, 2)} + ${mn(pvC)} = ${mn(price, 2)}.$$`,
          checks: [{ label: "premium formula agrees", ok: close(price, C + (coupon - C * j) * annuity, 1e-10) }],
        };
      }
      const m = rng.choice([1, 2, 2, 2, 4]);
      const years = m === 4 ? rng.int(5, 15) : rng.int(5, 30);
      const F = rng.choice([100, 1000, 1000, 1000, 5000, 10000]);
      const C = Math.round(F * rng.choice([1, 1, 1, 1.05, 1.1, 1.2, 0.95]));
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - r) > 0.004, r + 0.015);
      const effective = m > 1 && rng.next() < 0.35;
      const j = couponPeriodRate(y, m, effective);
      const N = m * years;
      const coupon = (F * r) / m;
      const price = bondPrice(coupon, C, j, N);
      const jWrong = effective ? y / m : perPeriod(y, m);
      return {
        questionText: `A ${n(F)} par value ${years}-year bond has ${couponText(r, m)} and ${C === F ? "is redeemable at par" : `a redemption value of ${n(C)}`}. The bond is bought to yield ${yieldText(y, m, effective)}.
Calculate the price of the bond.`,
        variables: { variant: "DIRECT", F, C, r, m, years, y, effective: effective ? 1 : 0 },
        correctValue: price,
        format: amountFormat(price),
        distractors: [
          ...(m > 1
            ? [
                distractor(bondPrice(coupon, C, jWrong, N), "NOMINAL_RATE_ERROR", effective ? `Divided the annual effective rate by ${m} as if it were nominal.` : "Treated the nominal yield as an annual effective rate."),
                distractor(bondPrice(F * r, C, y, years), "CALCULATION_DISTRACTOR", "Priced the bond as if its coupons were paid annually."),
              ]
            : []),
          ...(C !== F
            ? [
                distractor(bondPrice((C * r) / m, C, j, N), "CALCULATION_DISTRACTOR", "Based the coupons on the redemption value instead of the face value."),
                distractor(bondPrice(coupon, F, j, N), "CALCULATION_DISTRACTOR", "Discounted the face value instead of the redemption value."),
              ]
            : []),
          distractor(coupon * adue(N, j) + C * v(j, N), "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
          distractor(bondPrice(coupon, C, j, N - 1), "OFF_BY_ONE_PERIOD", `Counted ${N - 1} coupon periods instead of ${N}.`),
        ],
        solutionSteps: `**Step 1 — Yield per coupon period.** ${m === 1 ? `$j = ${dec(j, 4)}$.` : effective ? `$j = (1 + ${dec(y, 4)})^{1/${m}} - 1 = ${dec(j, 6)}$.` : `$j = ${dec(y, 4)}/${m} = ${dec(j, 6)}$.`} There are ${N} coupons of $${mn(F)}(${dec(r / m, 5)}) = ${mn(coupon, 2)}$.

**Step 2 — Price.**
$$P = ${mn(coupon, 2)}\\,${aSym(N)} + ${mn(C)}\\,v^{${N}} = ${mn(coupon * an(N, j), 2)} + ${mn(C * v(j, N), 2)} = ${mn(price, 2)}.$$`,
        checks: [{ label: "premium formula agrees", ok: close(price, C + (coupon - C * j) * an(N, j), 1e-10) }],
      };
    },
  },

  {
    id: "FM_BOND_YIELD_FROM_PRICE",
    domain: BONDS,
    title: "Yield Rate from a Bond's Price",
    objective: "Solve for the yield rate that reproduces a bond's price and express it on the requested basis.",
    difficulty: 1,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [213, 325],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const short = rng.next() < 0.3;
      const F = short ? rng.choice([100, 1000]) : rng.choice([1000, 1000, 5000]);
      const years = short ? rng.choice([1, 2]) : rng.int(4, 20);
      const r = short ? gridRate(rng, 0.04, 0.1, 0.01) : gridRate(rng, 0.03, 0.1, 0.005);
      const trueY = drawUntil(() => gridRate(rng, 0.03, 0.12, 0.002), (x) => Math.abs(x - r) > 0.005 && (!short || x > r), r + 0.012);
      const N = 2 * years;
      const coupon = (F * r) / 2;
      const D = short ? cents(F - bondPrice(coupon, F, trueY / 2, N)) : 0;
      const price = short ? cents(F - D) : cents(bondPrice(coupon, F, trueY / 2, N));
      const j = yieldFor(price, coupon, F, N);
      const ask = short ? "NOM" : rng.choice(["EFF", "NOM"] as const);
      const eff = Math.pow(1 + j, 2) - 1;
      const key = ask === "EFF" ? eff * 100 : 2 * j * 100;
      const approx = (F * r + (F - price) / years) / ((F + price) / 2);
      const stem = short
        ? `An investor buys a ${word(years)}-year bond with a face amount of ${n(F)} and ${couponText(r, 2)}. The bond is purchased at a discount of ${n(D, 2)} to yield an annual nominal rate of $j$ convertible semiannually.
Calculate $j$.`
        : `A ${word(years)}-year ${n(F)} face amount bond has ${couponText(r, 2)} and is redeemable at par. The bond currently sells for ${n(price, 2)}.
Calculate the ${ask === "EFF" ? "annual effective yield rate" : "annual nominal yield rate convertible semiannually"}.`;
      return {
        questionText: stem,
        variables: { F, r, years, price, D, ask },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor(ask === "EFF" ? 2 * j * 100 : eff * 100, "NOMINAL_RATE_ERROR", ask === "EFF" ? "Doubled the semiannual yield instead of compounding it." : "Compounded the semiannual yield to an annual effective rate."),
          distractor(((F * r) / price) * 100, "CALCULATION_DISTRACTOR", "Gave the current yield, annual coupons divided by price."),
          distractor(approx * 100, "CALCULATION_DISTRACTOR", "Used the approximation (coupon plus discount per year) divided by the average of price and redemption value."),
          distractor(j * 100, "NOMINAL_RATE_ERROR", "Stopped at the yield per half-year."),
        ],
        solutionSteps: `**Step 1 — Yield per half-year.** Solve
$$${mn(price, 2)} = ${mn(coupon, 2)}\\,${aSym(N)} + ${mn(F)}\\,v^{${N}}$$
for $j$ ${calculator(N, price, coupon, F)}: $j = ${dec(j, 6)}$.

**Step 2 — Express on the requested basis.** ${ask === "EFF" ? `$(1 + ${dec(j, 6)})^2 - 1 = ${dec(eff, 6)}$, that is, ${key.toFixed(3)}%.` : `$2(${dec(j, 6)}) = ${dec(2 * j, 6)}$, that is, ${key.toFixed(3)}%.`}`,
        checks: [{ label: "yield reprices the bond", ok: close(bondPrice(coupon, F, j, N), price, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_DISCOUNT_FROM_PRICE",
    domain: BONDS,
    title: "Premium or Discount with an Unknown Face Amount",
    objective: "Recover a par bond's face amount from its price and yield, then state the premium or discount.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [216],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const F = rng.choice([600, 800, 900, 1100, 1200, 1500, 2000, 2500]);
      const years = rng.int(5, 20);
      const r = gridRate(rng, 0.04, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.04, 0.12, 0.005), (x) => Math.abs(x - r) >= 0.01, r + 0.02);
      const premium = r > y;
      const N = 2 * years;
      const j = y / 2;
      const P = cents(F * bondPrice(r / 2, 1, j, N));
      const unit = bondPrice(r / 2, 1, j, N);
      const face = P / unit;
      const key = Math.abs(face - P);
      const jWrong = perPeriod(y, 2);
      const faceWrong = P / bondPrice(r / 2, 1, jWrong, N);
      return {
        questionText: `An investor pays ${n(P, 2)} for a ${word(years)}-year bond with ${couponText(r, 2)}, redeemable at par. The annual nominal yield rate is ${pc(y)} convertible semiannually.
Calculate the ${premium ? "premium" : "discount"} of this purchase.`,
        variables: { P, r, y, years },
        correctValue: key,
        format: amountFormat(key),
        distractors: [
          distractor(Math.abs(1000 - P), "CALCULATION_DISTRACTOR", "Assumed a face amount of 1000."),
          distractor(P * Math.abs(r / 2 - j) * an(N, j), "CALCULATION_DISTRACTOR", "Applied the coupon-yield gap to the price instead of the face amount."),
          distractor(Math.abs(faceWrong - P), "NOMINAL_RATE_ERROR", "Treated the nominal yield as an annual effective rate."),
          distractor(face * Math.abs(r - y) * years, "SIMPLE_INTEREST_ERROR", "Took the rate gap times the term without discounting."),
        ],
        solutionSteps: `**Step 1 — Price per unit of face.** With $j = ${dec(j, 4)}$ and ${N} coupons of $${dec(r / 2, 4)}$ per unit,
$$${dec(r / 2, 4)}\\,${aSym(N)} + v^{${N}} = ${dec(unit, 6)}.$$

**Step 2 — Face amount.** $F = ${mn(P, 2)}/${dec(unit, 6)} = ${mn(face, 2)}$.

**Step 3 — ${premium ? "Premium" : "Discount"}.** ${premium ? `$P - F = ${mn(P, 2)} - ${mn(face, 2)} = ${mn(key, 2)}$.` : `$F - P = ${mn(face, 2)} - ${mn(P, 2)} = ${mn(key, 2)}$.`}`,
        checks: [{ label: "premium formula agrees", ok: close(key, face * Math.abs(r / 2 - j) * an(N, j), 1e-6) }],
      };
    },
  },

  {
    id: "FM_BOND_AMORTIZATION_IN_COUPON",
    domain: BONDS,
    title: "Bond Amortization Schedule Entries",
    objective: "Read an entry of a bond amortization schedule: the interest or principal adjustment in a coupon, a book value, or the total interest.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [7, 431, 281],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const ask = rng.choice(["INTEREST", "ADJUST", "ADJUST", "BOOK", "TOTAL"] as const);
      const params = drawUntil(
        () => {
          const m = rng.choice([1, 2, 2, 4]);
          const years = m === 4 ? rng.int(5, 12) : rng.int(8, 25);
          const F = rng.choice([1000, 1000, 5000, 10000]);
          const C = Math.round(F * rng.choice([1, 1, 1, 1.05, 1.1]));
          const r = gridRate(rng, 0.03, 0.1, 0.005);
          const y = gridRate(rng, 0.03, 0.1, 0.005);
          const effective = m > 1 && rng.next() < 0.35;
          return { m, years, F, C, r, y, effective };
        },
        (p) => {
          const j = couponPeriodRate(p.y, p.m, p.effective);
          const g = (p.F * p.r) / p.m;
          return Math.abs(g - p.C * j) / (p.C * j) > 0.1;
        },
        { m: 2, years: 10, F: 1000, C: 1000, r: 0.08, y: 0.06, effective: false }
      );
      const { m, years, F, C, r, y, effective } = params;
      const N = m * years;
      const j = couponPeriodRate(y, m, effective);
      const g = (F * r) / m;
      const P = bondPrice(g, C, j, N);
      const premium = P > C;
      const k = ask === "BOOK" && m > 1 ? m * rng.int(1, years - 1) : rng.int(2, N - 1);
      const adjust = (t: number) => (g - C * j) * v(j, N - t + 1);
      const book = (t: number) => bookValue(g, C, j, N, t);
      const interest = (t: number) => j * book(t - 1);
      const total = N * g + C - P;
      let key: number;
      let ask2: string;
      let wrong: ReturnType<typeof distractor>[];
      let work: string;
      const wrongJ = effective ? y / m : perPeriod(y, m);
      if (ask === "INTEREST") {
        key = interest(k);
        ask2 = `Calculate the interest portion of the ${ord(k)} coupon.`;
        wrong = [
          distractor(j * book(k), "OFF_BY_ONE_PERIOD", "Applied the yield to the book value after the coupon instead of before it."),
          distractor(g - adjust(k + 1), "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ for the principal adjustment instead of $v^{n-t+1}$."),
          distractor(j * C, "CALCULATION_DISTRACTOR", "Applied the yield to the redemption value instead of the book value."),
          distractor(Math.abs(adjust(k)), "CALCULATION_DISTRACTOR", "Gave the principal adjustment instead of the interest portion."),
        ];
        work = `**Step 2 — Interest portion.** The interest in coupon ${k} is the yield rate times the book value just after coupon ${k - 1}:
$$B_{${k - 1}} = ${mn(g, 2)}\\,${aSym(N - k + 1)} + ${mn(C)}\\,v^{${N - k + 1}} = ${mn(book(k - 1), 2)},\\qquad I_{${k}} = ${dec(j, 6)}(${mn(book(k - 1), 2)}) = ${mn(key, 2)}.$$
Equivalently $I_{${k}} = ${mn(g, 2)} - (${mn(g, 2)} - ${mn(C * j, 4)})v^{${N - k + 1}}$.`;
      } else if (ask === "ADJUST") {
        key = Math.abs(adjust(k));
        ask2 = premium ? `Calculate the amount of the amortization of premium in the ${ord(k)} coupon.` : `Calculate the amount for accumulation of discount in the ${ord(k)} coupon.`;
        wrong = [
          distractor(Math.abs(adjust(k + 1)), "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$."),
          distractor(Math.abs(g - C * j) * v(j, k), "CALCULATION_DISTRACTOR", "Discounted from the purchase date instead of from maturity."),
          distractor(Math.abs(g - C * wrongJ) * v(wrongJ, N - k + 1), "NOMINAL_RATE_ERROR", effective ? "Divided the annual effective yield by the number of coupons a year." : "Treated the nominal yield as an annual effective rate."),
          distractor(Math.abs(P - C) / N, "SIMPLE_INTEREST_ERROR", "Spread the premium or discount evenly over the coupons."),
        ];
        work = `**Step 2 — Principal adjustment.** In coupon $t$ it is $(Fr - Cj)v^{n-t+1}$:
$$|${mn(g, 2)} - ${mn(C)}(${dec(j, 6)})|\\,v^{${N - k + 1}} = ${mn(Math.abs(g - C * j), 4)}(${dec(v(j, N - k + 1), 6)}) = ${mn(key, 4)}.$$`;
      } else if (ask === "BOOK") {
        key = book(k);
        ask2 = m === 1 ? `Calculate the book value of the bond immediately after the ${ord(k)} coupon.` : `Calculate the book value of the bond at the end of year ${k / m} immediately after the coupon payment.`;
        wrong = [
          distractor(book(k - 1), "OFF_BY_ONE_PERIOD", "Valued the bond one coupon earlier."),
          distractor(bookValue(g, C, wrongJ, N, k), "NOMINAL_RATE_ERROR", effective ? "Divided the annual effective yield by the number of coupons a year." : "Treated the nominal yield as an annual effective rate."),
          distractor(P - ((P - C) * k) / N, "SIMPLE_INTEREST_ERROR", "Wrote the premium or discount off in equal instalments."),
          distractor(g * an(N - k, j) + F * v(j, N - k), "CALCULATION_DISTRACTOR", "Discounted the face value instead of the redemption value."),
        ];
        work = `**Step 2 — Book value.** After coupon ${k}, ${N - k} coupons and the redemption value remain:
$$B_{${k}} = ${mn(g, 2)}\\,${aSym(N - k)} + ${mn(C)}\\,v^{${N - k}} = ${mn(key, 2)}.$$`;
      } else {
        key = total;
        ask2 = "Calculate the total amount of interest earned by the investor over the term of the bond.";
        wrong = [
          distractor(N * g, "CALCULATION_DISTRACTOR", "Counted the coupons only, leaving out the premium or discount."),
          distractor(N * g + P - C, "CALCULATION_DISTRACTOR", "Adjusted for the premium or discount with the wrong sign."),
          distractor(N * C * j, "CALCULATION_DISTRACTOR", "Charged the yield on the redemption value for every period."),
          distractor(N * j * P, "SIMPLE_INTEREST_ERROR", "Applied the yield to the purchase price for every period."),
        ];
        work = `**Step 2 — Total interest.** Total received less the price: $${N}(${mn(g, 2)}) + ${mn(C)} - ${mn(P, 2)} = ${mn(key, 2)}$.`;
      }
      return {
        questionText: `A ${n(F)} par value ${years}-year bond with ${couponText(r, m)}${C === F ? "" : ` and a redemption value of ${n(C)}`} is bought at a ${premium ? "premium" : "discount"} to yield ${yieldText(y, m, effective)}.
${ask2}`,
        variables: { F, C, r, m, years, y, effective: effective ? 1 : 0, k, ask },
        correctValue: key,
        format: amountFormat(key),
        distractors: wrong,
        solutionSteps: `**Step 1 — Price.** ${m === 1 ? "" : effective ? `$j = (1 + ${dec(y, 4)})^{1/${m}} - 1 = ${dec(j, 6)}$ per coupon period. ` : `$j = ${dec(y, 4)}/${m} = ${dec(j, 6)}$ per coupon period. `}Each coupon is ${n(g, 2)}, and
$$P = ${mn(g, 2)}\\,${aSym(N)} + ${mn(C)}\\,v^{${N}} = ${mn(P, 2)}.$$

${work}`,
        checks: [
          { label: "interest plus adjustment is the coupon", ok: close(interest(k) + adjust(k), g, 1e-9) },
          { label: "book value recursion", ok: close(book(k - 1) * (1 + j) - g, book(k), 1e-9) },
        ],
      };
    },
  },

  {
    id: "FM_BOND_SOLVE_FROM_AMORTIZATION",
    domain: BONDS,
    title: "Solving a Bond from One Amortization Entry",
    objective: "Use one principal adjustment in the schedule to recover the coupon rate, the redemption value or the price.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [140, 138, 384, 318, 326],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["SOLVE_R", "SOLVE_C", "SOLVE_C", "SOLVE_P"] as const);
      if (variant === "SOLVE_R") {
        const m = rng.choice([2, 2, 4]);
        const years = m === 4 ? rng.int(8, 15) : rng.int(10, 25);
        const N = m * years;
        const F = rng.choice([1000, 1000, 5000]);
        const y = gridRate(rng, 0.05, 0.1, 0.002);
        const rTrue = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (x) => x < y - 0.008, y - 0.02);
        const j = y / m;
        const k = rng.int(3, Math.round(N / 2));
        const A = cents(F * (j - rTrue / m) * v(j, N - k + 1));
        const g = j - A / (F * v(j, N - k + 1));
        const key = m * g * 100;
        return {
          questionText: `You are given the following information about a ${years}-year bond with face amount ${n(F)}:
(i) The bond has an annual coupon rate of $r$ paid ${frequency(m)} and is redeemable at par.
(ii) The annual nominal yield rate convertible ${frequency(m)} is ${pc(y)}.
(iii) The amount for accumulation of discount in the ${ord(k)} coupon payment is ${n(A, 2)}.
Calculate $r$.`,
          variables: { variant, F, m, years, y, k, A },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor(g * 100, "NOMINAL_RATE_ERROR", "Stopped at the coupon rate per coupon period."),
            distractor(m * (j - A / (F * v(j, N - k))) * 100, "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$."),
            distractor(m * (j + A / (F * v(j, N - k + 1))) * 100, "CALCULATION_DISTRACTOR", "Treated the discount accumulation as premium amortization."),
            distractor(m * (j - A / F) * 100, "CALCULATION_DISTRACTOR", "Left out the discount factor in the adjustment."),
          ],
          solutionSteps: `**Step 1 — Formula for the adjustment.** For a discount bond the accumulation of discount in coupon $t$ is $F(j - g)v^{n-t+1}$, where $g$ is the coupon rate per period and $j = ${dec(j, 4)}$.

**Step 2 — Solve for $g$.** With $n = ${N}$ and $t = ${k}$:
$$${mn(A, 2)} = ${mn(F)}(${dec(j, 4)} - g)(1 + ${dec(j, 4)})^{-${N - k + 1}} \\Rightarrow g = ${dec(j, 4)} - \\frac{${mn(A, 2)}}{${mn(F * v(j, N - k + 1), 4)}} = ${dec(g, 6)}.$$

**Step 3 — Annual rate.** $r = ${m}g = ${dec(m * g, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "adjustment reproduced", ok: close(F * (j - g) * v(j, N - k + 1), A, 1e-9) }],
        };
      }
      if (variant === "SOLVE_C") {
        const m = rng.choice([2, 2, 4]);
        const years = m === 4 ? rng.int(8, 15) : rng.int(10, 25);
        const N = m * years;
        const F = rng.choice([1000, 2500, 5000, 7500, 10000]);
        const params = drawUntil(
          () => {
            const r = gridRate(rng, 0.04, 0.1, 0.002);
            const y = gridRate(rng, 0.04, 0.1, 0.002);
            const Ctrue = Math.round(F * rng.choice([0.95, 1, 1.02, 1.03, 1.05, 1.1, 1.2]) / 10) * 10;
            return { r, y, Ctrue };
          },
          (p) => Math.abs((F * p.r) / m - (p.Ctrue * p.y) / m) / ((p.Ctrue * p.y) / m) > 0.1,
          { r: 0.074, y: 0.053, Ctrue: F }
        );
        const { r, y, Ctrue } = params;
        const j = y / m;
        const g = (F * r) / m;
        const premium = g > Ctrue * j;
        const k = rng.int(2, Math.round(N / 2));
        const A = cents(Math.abs(g - Ctrue * j) * v(j, N - k + 1));
        const lift = A * Math.pow(1 + j, N - k + 1);
        const C = premium ? (g - lift) / j : (g + lift) / j;
        const liftWrong = A * Math.pow(1 + j, N - k);
        return {
          questionText: `A ${years}-year bond with a face amount of ${n(F)}, a redemption value of $C$, and ${couponText(r, m)} is purchased at a ${premium ? "premium" : "discount"} to yield an annual nominal rate of ${pc(y)} convertible ${frequency(m)}.
The amount for ${premium ? "amortization of premium" : "accumulation of discount"} in the ${ord(k)} coupon payment is ${n(A, 2)}.
Calculate $C$.`,
          variables: { variant, F, r, m, years, y, k, A, premium: premium ? 1 : 0 },
          correctValue: C,
          format: "AMOUNT_0",
          distractors: [
            distractor(premium ? (g - liftWrong) / j : (g + liftWrong) / j, "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$."),
            distractor(premium ? (g + lift) / j : (g - lift) / j, "CALCULATION_DISTRACTOR", premium ? "Treated the premium amortization as discount accumulation." : "Treated the discount accumulation as premium amortization."),
            distractor(premium ? (g - A) / j : (g + A) / j, "CALCULATION_DISTRACTOR", "Left out the discount factor in the adjustment."),
            distractor(premium ? (g - lift) / (y / m) / (1 + j) : (g + lift) / j / (1 + j), "CALCULATION_DISTRACTOR", "Discounted the redemption value one extra period."),
          ],
          solutionSteps: `**Step 1 — Formula for the adjustment.** In coupon $t$ the principal adjustment is $|Fr - Cj|\\,v^{n-t+1}$, with $Fr = ${mn(g, 2)}$ and $j = ${dec(j, 4)}$. Here $n = ${N}$ and $t = ${k}$.

**Step 2 — Undo the discounting.** $${premium ? `Fr - Cj` : `Cj - Fr`} = ${mn(A, 2)}(1 + ${dec(j, 4)})^{${N - k + 1}} = ${mn(lift, 4)}$.

**Step 3 — Solve for $C$.** $C = \\frac{${mn(g, 2)} ${premium ? "-" : "+"} ${mn(lift, 4)}}{${dec(j, 4)}} = ${mn(C, 2)}$.`,
          checks: [{ label: "adjustment reproduced", ok: close(Math.abs(g - C * j) * v(j, N - k + 1), A, 1e-9) }, { label: "premium/discount as stated", ok: premium === g > C * j }],
        };
      }
      // SOLVE_P: annual coupons, unknown face amount, change in book value in year t.
      const years = rng.int(10, 30);
      const params = drawUntil(
        () => ({ r: gridRate(rng, 0.03, 0.1, 0.005), y: gridRate(rng, 0.03, 0.1, 0.005), Ftrue: gridAmount(rng, 1000, 5000, 100) }),
        (p) => Math.abs(p.r - p.y) >= 0.015,
        { r: 0.08, y: 0.04, Ftrue: 1800 }
      );
      const { r, y, Ftrue } = params;
      const t = rng.int(2, years - 2);
      const A = cents(Math.abs(r - y) * Ftrue * v(y, years - t + 1));
      const F = A / (Math.abs(r - y) * v(y, years - t + 1));
      const P = F * bondPrice(r, 1, y, years);
      const Fwrong = A / (Math.abs(r - y) * v(y, years - t));
      return {
        questionText: `A ${years}-year bond with ${pc(r)} annual coupons is purchased at a price of $P$. The face amount of the bond is $F$, and the bond is redeemable at par. The price assumes an annual effective yield rate of ${pc(y)}.
The change in book value of the bond during the ${ord(t)} year is equal to ${n(A, 2)}.
Calculate $P$.`,
        variables: { variant, r, y, years, t, A },
        correctValue: P,
        format: "AMOUNT_0",
        distractors: [
          distractor(Fwrong * bondPrice(r, 1, y, years), "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$."),
          distractor(F, "CALCULATION_DISTRACTOR", "Stopped at the face amount."),
          distractor((A / Math.abs(r - y)) * bondPrice(r, 1, y, years), "CALCULATION_DISTRACTOR", "Left out the discount factor in the adjustment."),
          distractor(F * (r * adue(years, y) + v(y, years)), "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Change in book value.** The book value changes in year $t$ by the principal adjustment $F|r - i|\\,v^{n-t+1}$:
$$${mn(A, 2)} = F(${dec(Math.abs(r - y), 3)})(${dec(1 + y, 2)})^{-${years - t + 1}}.$$

**Step 2 — Face amount.** $F = ${mn(A, 2)}/${dec(Math.abs(r - y) * v(y, years - t + 1), 6)} = ${mn(F, 2)}$.

**Step 3 — Price.** $P = ${mn(F * r, 2)}\\,${aSym(years, mpc(y))} + ${mn(F, 2)}\\,v^{${years}} = ${mn(P, 2)}$.`,
        checks: [{ label: "ledger adjustment reproduced", ok: close(Math.abs(F * r - y * F * bondPrice(r, 1, y, years - t + 1)), A, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_TWO_AMORTIZATION_AMOUNTS",
    domain: BONDS,
    title: "Premium or Discount from Two Amortization Entries",
    objective: "Use the geometric growth of principal adjustments to recover the yield and the total premium or discount.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [47],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const years = rng.int(20, 40);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const premium = rng.next() < 0.4;
      const X = gridAmount(rng, 40, 600, 5);
      const t1 = rng.int(3, Math.round(years / 2));
      const t2 = t1 + rng.int(3, 8);
      const A1 = cents(X * v(i, years - t1 + 1));
      const A2 = cents(X * v(i, years - t2 + 1));
      const growth = Math.pow(A2 / A1, 1 / (t2 - t1));
      const iHat = growth - 1;
      const gap = A1 * Math.pow(growth, years - t1 + 1);
      const key = gap * an(years, iHat);
      const label = premium ? "amortization of premium" : "accumulation of discount";
      return {
        questionText: `A ${years}-year bond is purchased at a ${premium ? "premium" : "discount"}. The bond pays annual coupons. The amount for ${label} in the ${ord(t1)} coupon is ${n(A1, 2)}. The amount for ${label} in the ${ord(t2)} coupon is ${n(A2, 2)}.
Calculate the amount of ${premium ? "premium" : "discount"} in the purchase price of this bond.`,
        variables: { years, t1, t2, A1, A2, premium: premium ? 1 : 0 },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(A1 * Math.pow(growth, years - t1) * an(years, iHat), "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$."),
          distractor(gap * years, "SIMPLE_INTEREST_ERROR", "Multiplied the coupon-yield gap by the term without discounting."),
          distractor(gap * an(years - 1, iHat), "OFF_BY_ONE_PERIOD", `Valued ${years - 1} gaps instead of ${years}.`),
          distractor(A1 * Math.pow(Math.pow(A2 / A1, 1 / (t2 - t1 + 1)), years - t1 + 1) * an(years, Math.pow(A2 / A1, 1 / (t2 - t1 + 1)) - 1), "OFF_BY_ONE_PERIOD", `Took the ratio of the two amounts as ${t2 - t1 + 1} years of growth.`),
        ],
        solutionSteps: `**Step 1 — Yield from the growth of the adjustments.** Principal adjustments grow by $1 + i$ each year, so
$$(1 + i)^{${t2 - t1}} = \\frac{${mn(A2, 2)}}{${mn(A1, 2)}} \\Rightarrow i = ${dec(iHat, 6)}.$$

**Step 2 — The coupon-yield gap.** The adjustment in coupon $t$ is $|Ci - Fr|\\,v^{n-t+1}$, so $|Ci - Fr| = ${mn(A1, 2)}(1 + i)^{${years - t1 + 1}} = ${mn(gap, 4)}$.

**Step 3 — ${premium ? "Premium" : "Discount"}.** $|Ci - Fr|\\,${aSym(years, "i")} = ${mn(gap, 4)}(${dec(an(years, iHat), 5)}) = ${mn(key, 2)}$.`,
        checks: [{ label: "second amount reproduced", ok: Math.abs(gap * v(iHat, years - t2 + 1) - A2) < 1e-6 }],
      };
    },
  },

  {
    id: "FM_BOND_BOOK_VALUES_SOLVE_RATE",
    domain: BONDS,
    title: "Yield and Redemption from Book Values",
    objective: "Use the book-value recursion between coupon dates to recover the yield rate, then the redemption value or a later amortization entry.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [454, 437, 448],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["LAST_TWO", "FIRST_ACCUM", "LAST_ACCUM"] as const);
      if (variant === "LAST_TWO") {
        const years = rng.int(8, 20);
        const C = rng.choice([1000, 2000, 5000, 10000]);
        const params = drawUntil(
          () => ({ i: gridRate(rng, 0.04, 0.1, 0.005), rate: gridRate(rng, 0.02, 0.1, 0.005) }),
          (p) => Math.abs(p.rate - p.i) >= 0.015,
          { i: 0.07, rate: 0.02 }
        );
        const coupon = C * params.rate;
        const B2 = cents((coupon + C) * v(params.i, 1));
        const B1 = cents((B2 + coupon) * v(params.i, 1));
        const growth = (C - B2) / (B2 - B1);
        const key = (growth - 1) * 100;
        return {
          questionText: `An investor purchases a ${word(years)}-year ${n(C)} bond with annual coupons, bought to yield an annual effective rate of $i$.
The bond's book value is ${n(B1, 2)} just after the ${ord(years - 2)} coupon payment and ${n(B2, 2)} just after the ${ord(years - 1)} coupon payment.
Calculate $i$.`,
          variables: { variant, years, C, B1, B2 },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor(((B2 - B1) / B1) * 100, "CALCULATION_DISTRACTOR", "Took the growth in book value as the yield."),
            distractor(((C - B1) / (2 * B1)) * 100, "SIMPLE_INTEREST_ERROR", "Spread the growth to redemption evenly without accounting for the coupons."),
            distractor(((C - B2) / B2) * 100, "CALCULATION_DISTRACTOR", "Ignored the coupon paid at maturity."),
            distractor((C / B1 - 1) * 50, "SIMPLE_INTEREST_ERROR", "Averaged the book value growth over the last two years."),
          ],
          solutionSteps: `**Step 1 — Two recursions.** With coupon $Fr$ and $B_t(1 + i) - Fr = B_{t+1}$:
$$${mn(B1, 2)}(1 + i) - Fr = ${mn(B2, 2)},\\qquad ${mn(B2, 2)}(1 + i) - Fr = ${mn(C)}.$$

**Step 2 — Eliminate the coupon.** Subtracting, $(${mn(B2, 2)} - ${mn(B1, 2)})(1 + i) = ${mn(C)} - ${mn(B2, 2)}$, so $1 + i = ${dec(growth, 6)}$.

**Step 3 — Yield.** $i = ${dec(growth - 1, 6)}$, that is, ${key.toFixed(3)}%. (The coupon is $${mn(B2 * growth - C, 2)}$.)`,
          checks: [{ label: "coupon positive", ok: B2 * growth - C > 0 }],
        };
      }
      if (variant === "FIRST_ACCUM") {
        const years = rng.int(15, 30);
        const P = rng.choice([5000, 10000, 20000, 25000]);
        const i = gridRate(rng, 0.03, 0.08, 0.005);
        const A1 = gridAmount(rng, 10, 80, 5) * (P / 10000);
        const k = rng.int(5, years - 8);
        const Bk = cents(P + A1 * sn(k, i));
        const iHat = solve((x) => P + A1 * sn(k, x) - Bk, 1e-6, 0.5);
        const key = P + A1 * sn(years, iHat);
        return {
          questionText: `Kelly purchases a ${years}-year annual coupon bond for ${n(P)} with an annual effective yield rate of $i$.
The amount for the accumulation of discount in the first coupon is ${amt(A1)}.
The bond's book value is ${n(Bk, 2)} just after the ${ord(k)} coupon payment.
Calculate the bond's redemption value.`,
          variables: { variant, years, P, A1, k, Bk },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(P + A1 * years, "SIMPLE_INTEREST_ERROR", "Added the first accumulation once for every year."),
            distractor(P + A1 * sn(years - 1, iHat), "OFF_BY_ONE_PERIOD", `Accumulated ${years - 1} adjustments instead of ${years}.`),
            distractor(P + A1 * an(years, iHat), "CALCULATION_DISTRACTOR", "Discounted the adjustments instead of accumulating them."),
            distractor(P + ((Bk - P) * years) / k, "SIMPLE_INTEREST_ERROR", "Extended the growth in book value linearly."),
          ],
          solutionSteps: `**Step 1 — Book value after $k$ coupons.** The adjustments grow by $1 + i$ each year, so $B_k = P + A_1\\,${sSym("k", "i")}$:
$$${mn(Bk, 2)} = ${mn(P)} + ${mn(A1, 2)}\\,${sSym(k, "i")} \\Rightarrow ${sSym(k, "i")} = ${dec((Bk - P) / A1, 5)},\\quad i = ${dec(iHat, 6)}.$$

**Step 2 — Total discount.** The whole discount is $A_1\\,${sSym(years, "i")} = ${mn(A1, 2)}(${dec(sn(years, iHat), 5)}) = ${mn(A1 * sn(years, iHat), 2)}$.

**Step 3 — Redemption value.** At maturity the book value equals the redemption value: $${mn(P)} + ${mn(A1 * sn(years, iHat), 2)} = ${mn(key, 2)}$.`,
          checks: [{ label: "yield recovered", ok: Math.abs(iHat - i) < 5e-4 }],
        };
      }
      // LAST_ACCUM: quarterly coupons, two book values, discount accumulation in the last coupon.
      const years = rng.int(8, 15);
      const m = 4;
      const N = m * years;
      const F = rng.choice([1000, 2500, 5000]);
      const params = drawUntil(
        () => ({ r: gridRate(rng, 0.03, 0.08, 0.0004), y: gridRate(rng, 0.04, 0.1, 0.004), C: Math.round(F * rng.choice([1, 1.05, 1.1]) / 10) * 10 }),
        (p) => (p.C * p.y) / m - (F * p.r) / m > 0.1 * ((p.C * p.y) / m),
        { r: 0.0484, y: 0.0824, C: F }
      );
      const { r, y, C } = params;
      const g = (F * r) / m;
      const jTrue = y / m;
      const k1 = rng.int(2, 8);
      const k2 = k1 + rng.int(8, 18);
      const B1 = cents(bookValue(g, C, jTrue, N, k1));
      const B2 = cents(bookValue(g, C, jTrue, N, k2));
      const j = solve((x) => B1 * Math.pow(1 + x, k2 - k1) - g * sn(k2 - k1, x) - B2, 1e-6, 0.2);
      const next = B2 * j - g;
      const key = next * Math.pow(1 + j, N - k2 - 1);
      return {
        questionText: `A ${word(years)}-year ${n(F)} face amount bond has ${couponText(r, 4)} and is redeemable for $C$.
The book values of the bond following the ${ord(k1)} and ${ord(k2)} coupons are ${n(B1, 2)} and ${n(B2, 2)}, respectively.
Calculate the amount for accumulation of discount in the last coupon.`,
        variables: { variant, F, r, m, years, k1, k2, B1, B2 },
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor(next, "CALCULATION_DISTRACTOR", `Stopped at the accumulation in coupon ${k2 + 1}.`),
          distractor(next * Math.pow(1 + j, N - k2), "OFF_BY_ONE_PERIOD", "Accumulated the adjustment one quarter too long."),
          distractor((B2 - B1) / (k2 - k1), "SIMPLE_INTEREST_ERROR", "Averaged the growth in book value between the two dates."),
          distractor(next * Math.pow(1 + 4 * j, (N - k2 - 1) / 4), "NOMINAL_RATE_ERROR", "Grew the adjustment at the nominal annual rate."),
        ],
        solutionSteps: `**Step 1 — Quarterly yield.** The book value rolls forward as $B_{${k2}} = B_{${k1}}(1 + j)^{${k2 - k1}} - ${mn(g, 2)}\\,${sSym(k2 - k1)}$. Solving ${calculator(k2 - k1, B1, g, B2)} gives $j = ${dec(j, 6)}$.

**Step 2 — Next accumulation.** The accumulation in coupon ${k2 + 1} is $jB_{${k2}} - Fr = ${dec(j, 6)}(${mn(B2, 2)}) - ${mn(g, 2)} = ${mn(next, 5)}$.

**Step 3 — Last coupon.** Accumulations grow by $1 + j$ per coupon, so in coupon ${N} it is $${mn(next, 5)}(1 + j)^{${N - k2 - 1}} = ${mn(key, 4)}$.`,
        checks: [{ label: "quarterly yield recovered", ok: Math.abs(j - jTrue) < 2e-4 }],
      };
    },
  },

  {
    id: "FM_BOND_BOOK_VALUES_SOLVE_TERM",
    domain: BONDS,
    title: "Term of a Bond from Book Values",
    objective: "Recover a bond's term from consecutive book values or from the book value partway through the term.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [97, 98, 457],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["CONSECUTIVE", "CHANGE", "HALF"] as const);
      if (variant === "CONSECUTIVE") {
        const years = rng.int(12, 30);
        const C = rng.choice([1000, 1200, 1500, 1890, 2000, 2500]);
        const i = gridRate(rng, 0.04, 0.09, 0.005);
        const coupon = cents(C * drawUntil(() => gridRate(rng, 0.02, 0.1, 0.0025), (x) => Math.abs(x - i) > 0.01, i - 0.02));
        const k = rng.int(2, 6);
        const B1 = cents(bookValue(coupon, C, i, years, k));
        const B2 = cents(bookValue(coupon, C, i, years, k + 1));
        const couponHat = B1 * (1 + i) - B2;
        const gap = C * i - couponHat;
        const remaining = Math.log(gap / (B2 - B1)) / Math.log(1 + i);
        const key = years;
        return {
          questionText: `An $n$-year bond with annual coupons has the following characteristics:
(i) The redemption value at maturity is ${n(C)}.
(ii) The annual effective yield rate is ${pc(i)}.
(iii) The book value immediately after the ${ord(k)} coupon is ${n(B1, 2)}.
(iv) The book value immediately after the ${ord(k + 1)} coupon is ${n(B2, 2)}.
Calculate $n$.`,
          variables: { variant, C, i, k, B1, B2 },
          correctValue: key,
          format: "AMOUNT_0",
          optionStyle: "LADDER",
          ladderStep: rng.choice([1, 2]),
          distractors: [],
          solutionSteps: `**Step 1 — Coupon.** From $B_{${k}}(1 + i) - Fr = B_{${k + 1}}$: $Fr = ${mn(B1, 2)}(${dec(1 + i, 3)}) - ${mn(B2, 2)} = ${mn(couponHat, 2)}$.

**Step 2 — Adjustment in coupon ${k + 1}.** $B_{${k + 1}} - B_{${k}} = (Ci - Fr)v^{n-${k}}$, so
$$v^{n-${k}} = \\frac{${mn(B2 - B1, 2)}}{${mn(C)}(${dec(i, 3)}) - ${mn(couponHat, 2)}} = ${dec((B2 - B1) / gap, 5)}.$$

**Step 3 — Term.** $n - ${k} = \\ln(${dec(gap / (B2 - B1), 5)})/\\ln(${dec(1 + i, 3)}) = ${remaining.toFixed(2)}$, so $n = ${key}$.`,
          checks: [{ label: "term recovered", ok: Math.abs(k + remaining - years) < 0.05 }],
        };
      }
      if (variant === "CHANGE") {
        const F = rng.choice([1000, 2500, 5000]);
        const periods = rng.int(12, 50);
        const r = gridRate(rng, 0.04, 0.09, 0.005);
        const y = drawUntil(() => gridRate(rng, 0.04, 0.11, 0.005), (x) => x - r >= 0.005, r + 0.01);
        const j = y / 2;
        const k = rng.int(2, 6);
        const delta = cents(F * (j - r / 2) * v(j, periods - k));
        const remaining = Math.log((F * (j - r / 2)) / delta) / Math.log(1 + j);
        const key = periods / 2;
        return {
          questionText: `An $n$-year bond with semiannual coupons has the following characteristics:
(i) The par value and redemption value are ${n(F)}.
(ii) The annual coupon rate is ${pc(r)} payable semiannually.
(iii) The annual nominal yield to maturity is ${pc(y)} convertible semiannually.
(iv) The book value immediately after the ${ord(k + 1)} coupon is ${n(delta, 2)} greater than the book value immediately after the ${ord(k)} coupon.
Calculate $n$.`,
          variables: { variant, F, r, y, k, delta },
          correctValue: key,
          format: "AMOUNT_1",
          optionStyle: "LADDER",
          ladderStep: 0.5,
          distractors: [],
          solutionSteps: `**Step 1 — Accumulation of discount.** The increase in book value is the accumulation in coupon ${k + 1}, $F(j - g)v^{2n - ${k}}$, with $j = ${dec(j, 4)}$ and $Fg = ${mn((F * r) / 2, 2)}$.

**Step 2 — Remaining periods.** $v^{2n-${k}} = ${mn(delta, 2)}/${mn(F * (j - r / 2), 2)} = ${dec(delta / (F * (j - r / 2)), 5)}$, so $2n - ${k} = ${remaining.toFixed(2)}$.

**Step 3 — Term in years.** $2n = ${periods}$, so $n = ${key}$.`,
          checks: [{ label: "term recovered", ok: Math.abs(k + remaining - periods) < 0.05 }],
        };
      }
      // HALF: n-year semiannual bond valued halfway through its coupons.
      const half = rng.int(6, 20);
      const y = gridRate(rng, 0.03, 0.08, 0.005);
      const j = y / 2;
      const r = drawUntil(() => gridRate(rng, 0.02, 0.07, 0.005), (x) => Math.abs(x - y) >= 0.01, y - 0.01);
      const P = Number(bondPrice(r / 2, 1, j, 2 * half).toFixed(6)) * 100;
      const price = Number(P.toFixed(4));
      const book = Number((bondPrice(r / 2, 1, j, half) * 100).toFixed(4));
      const vn = (100 - price) / (100 - book) - 1;
      const nHat = -Math.log(vn) / Math.log(1 + j);
      return {
        questionText: `An $n$-year 100 face amount bond has an annual coupon rate of $r$ paid semiannually. The price of the bond is ${n(price, 4)} based on an annual yield rate of ${pc(y)} compounded semiannually.
The book value of the bond immediately after the $n$th coupon payment is ${n(book, 4)}.
Calculate $n$.`,
        variables: { variant, y, P: price, BV: book },
        correctValue: half,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: rng.choice([1, 2]),
        distractors: [],
        solutionSteps: `**Step 1 — Premium/discount form.** With $D = 100(g - j)$ per coupon, the price is $100 + D\\,${aSym("2n")}$ and the book value after coupon $n$ is $100 + D\\,${aSym("n")}$.

**Step 2 — Ratio.** $\\frac{${aSym("2n")}}{${aSym("n")}} = 1 + v^n = \\frac{${mn(100 - price, 4)}}{${mn(100 - book, 4)}}$, so $v^n = ${dec(vn, 5)}$.

**Step 3 — Solve.** $n = -\\ln(${dec(vn, 5)})/\\ln(${dec(1 + j, 4)}) = ${nHat.toFixed(2)}$, so $n = ${half}$.`,
        checks: [{ label: "term recovered", ok: Math.abs(nHat - half) < 0.05 }],
      };
    },
  },

  {
    id: "FM_BOND_HALF_PREMIUM_AMORTIZED",
    domain: BONDS,
    title: "When a Share of the Premium Has Been Amortized",
    objective: "Find the first coupon after which the cumulative amortization of premium (or accumulation of discount) passes a given share of the original amount.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [456],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const m = rng.choice([1, 2, 2]);
      const years = rng.int(10, 30);
      const N = m * years;
      const r = gridRate(rng, 0.02, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - r) >= 0.01, r - 0.01);
      const premium = r > y;
      const j = y / m;
      const phi = rng.choice([0.25, 0.5, 0.5, 0.75]);
      const target = phi + (1 - phi) * v(j, N);
      // First k with v^(N-k) > target.
      const exact = N - Math.log(1 / target) / Math.log(1 + j);
      const key = Math.floor(exact) + 1;
      const word1 = premium ? "premium amortization" : "discount accumulation";
      return {
        questionText: `A ${years}-year bond has ${couponText(r, m)}. The bond is priced using ${yieldText(y, m, false)}. The cumulative amount of ${word1} exceeds ${pc(phi)} of the ${premium ? "premium" : "discount"} at purchase, for the first time, immediately after the $n$th coupon is paid.
Calculate $n$.`,
        variables: { r, y, m, years, phi },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(Math.round(phi * N), "SIMPLE_INTEREST_ERROR", "Assumed the premium is written off in equal amounts."),
          distractor(key - 1, "OFF_BY_ONE_PERIOD", "Rounded down; the share is only exceeded one coupon later."),
          distractor(Math.floor(N - Math.log(1 / phi) / Math.log(1 + j)) + 1, "CALCULATION_DISTRACTOR", "Left out the term $v^n$ from the cumulative amount."),
          m > 1
            ? distractor(Math.floor(N - Math.log(1 / (phi + (1 - phi) * v(y, N))) / Math.log(1 + y)) + 1, "NOMINAL_RATE_ERROR", "Used the annual rate as the rate per coupon period.")
            : distractor(key + 1, "OFF_BY_ONE_PERIOD", "Counted one coupon past the first one that exceeds the share."),
        ],
        solutionSteps: `**Step 1 — Cumulative adjustment.** With $j = ${dec(j, 4)}$ and ${N} coupons, the adjustments in coupons 1 to $k$ total $|Fg - Cj|(${aSym(N)} - ${aSym(`${N}-k`)})$, and the whole ${premium ? "premium" : "discount"} is $|Fg - Cj|\\,${aSym(N)}$.

**Step 2 — Condition.** The share exceeds ${phi} when
$$\\frac{v^{${N}-k} - v^{${N}}}{1 - v^{${N}}} > ${phi} \\iff v^{${N}-k} > ${phi} + ${1 - phi}v^{${N}} = ${dec(target, 6)}.$$

**Step 3 — Solve.** $${N} - k < \\ln(1/${dec(target, 6)})/\\ln(${dec(1 + j, 4)}) = ${(N - exact).toFixed(3)}$, so $k > ${exact.toFixed(3)}$ and $n = ${key}$.`,
        checks: [
          { label: "not an exact tie", ok: Math.abs(exact - Math.round(exact)) > 1e-6 },
          { label: "key is within the term", ok: key >= 1 && key <= N },
        ],
      };
    },
  },

  {
    id: "FM_BOND_SELL_AND_REINVEST",
    domain: BONDS,
    title: "Selling a Bond Before Maturity",
    objective: "Price a bond at a new yield partway through its term, and compare book value with market value.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [273, 248],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const F1 = 1000;
        const C1 = rng.choice([900, 950, 1050, 1100]);
        const n1 = rng.int(15, 30);
        const y1 = gridRate(rng, 0.05, 0.1, 0.005);
        const T = rng.int(5, n1 - 5);
        const y2 = drawUntil(() => gridRate(rng, 0.04, 0.1, 0.005), (x) => Math.abs(x - y1) >= 0.01, y1 - 0.02);
        const n2 = rng.int(5, 15);
        const F2 = 1000;
        const C2 = rng.choice([1000, 1050, 1100, 1200]);
        const g1 = (C1 * y1) / 2;
        const S = bondPrice(g1, C1, y2 / 2, 2 * (n1 - T));
        const g2 = (S - C2 * v(y2 / 2, 2 * n2)) / an(2 * n2, y2 / 2);
        return {
          questionText: `An investor purchases a ${n1}-year, ${n(F1)} face amount bond with semiannual coupons at a price equal to the redemption value of ${n(C1)}. The bond yields an annual nominal rate of ${pc(y1)} convertible semiannually.
After ${word(T)} years, the investor sells the bond, yielding to the buyer an annual nominal rate of ${pc(y2)} convertible semiannually. The investor uses the proceeds to purchase a ${n2}-year, ${n(F2)} face amount bond with redemption value ${n(C2)} and semiannual coupons. The yield rate on the new bond is an annual nominal rate of ${pc(y2)} convertible semiannually.
Calculate the semiannual coupon payment for the new bond.`,
          variables: { variant: "SELL_BUY", F1, C1, n1, y1, T, y2, n2, F2, C2 },
          correctValue: g2,
          format: "AMOUNT_2",
          distractors: [
            distractor(g1, "CALCULATION_DISTRACTOR", "Kept the first bond's coupon."),
            distractor((C1 - C2 * v(y2 / 2, 2 * n2)) / an(2 * n2, y2 / 2), "CALCULATION_DISTRACTOR", "Reinvested the redemption value of the first bond instead of its sale price."),
            distractor((bondPrice(g1, C1, y1 / 2, 2 * (n1 - T)) - C2 * v(y2 / 2, 2 * n2)) / an(2 * n2, y2 / 2), "CALCULATION_DISTRACTOR", "Sold the first bond at its book value instead of the market price."),
            distractor((F1 * y1) / 2, "CALCULATION_DISTRACTOR", "Took the first coupon as the face amount times the yield."),
          ],
          solutionSteps: `**Step 1 — First bond's coupon.** A price equal to the redemption value means the modified coupon rate equals the yield: $Fr = ${mn(C1)}(${dec(y1 / 2, 4)}) = ${mn(g1, 2)}$.

**Step 2 — Sale price.** With ${2 * (n1 - T)} coupons left, at $${dec(y2 / 2, 4)}$ per half-year:
$$S = ${mn(g1, 2)}\\,${aSym(2 * (n1 - T), dec(y2 / 2, 3))} + ${mn(C1)}\\,v^{${2 * (n1 - T)}} = ${mn(S, 2)}.$$

**Step 3 — New coupon.** $${mn(S, 2)} = X\\,${aSym(2 * n2, dec(y2 / 2, 3))} + ${mn(C2)}\\,v^{${2 * n2}}$, so $X = ${mn(g2, 2)}$.`,
          checks: [{ label: "new bond reprices", ok: close(bondPrice(g2, C2, y2 / 2, 2 * n2), S, 1e-9) }],
        };
      }
      const F = rng.choice([1000, 1000, 2000]);
      const nYears = rng.int(4, 10);
      const r = gridRate(rng, 0.03, 0.08, 0.005);
      const D0 = gridAmount(rng, 30, 150, 10) * (F / 1000);
      const yW = drawUntil(() => gridRate(rng, 0.04, 0.12, 0.005), (x) => x > r + 0.005, r + 0.03);
      const jK = yieldFor(F - D0, (F * r) / 2, F, 2 * nYears);
      const B = bookValue((F * r) / 2, F, jK, 2 * nYears, 2);
      const D = F - bondPrice((F * r) / 2, F, yW / 2, 2 * nYears - 2);
      const key = B - D;
      return {
        questionText: `Kate buys a ${word(nYears)}-year ${n(F)} face amount bond today with a ${n(D0)} discount. The annual nominal coupon rate is ${pc(r)} convertible semiannually.
One year later, Wallace buys a ${word(nYears - 1)}-year bond. It has the same face amount and coupon values as Kate's and is priced to yield an annual nominal interest rate of ${pc(yW)} convertible semiannually.
The discount on Wallace's bond is $D$. The book value of Kate's bond at the time Wallace buys his bond is $B$.
Calculate $B - D$.`,
        variables: { variant: "BOOK_VS_DISCOUNT", F, r, n: nYears, D0, yW },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(F - D0 - D, "CALCULATION_DISTRACTOR", "Used Kate's purchase price instead of her book value a year later."),
          distractor(bookValue((F * r) / 2, F, yW / 2, 2 * nYears, 2) - D, "CALCULATION_DISTRACTOR", "Valued Kate's bond at Wallace's yield."),
          distractor(bookValue((F * r) / 2, F, jK, 2 * nYears, 1) - D, "OFF_BY_ONE_PERIOD", "Rolled Kate's book value forward one coupon instead of two."),
          distractor(B - (F - bondPrice((F * r) / 2, F, yW / 2, 2 * nYears)), "OFF_BY_ONE_PERIOD", `Priced Wallace's bond over ${nYears} years instead of ${nYears - 1}.`),
        ],
        solutionSteps: `**Step 1 — Kate's yield.** Solve $${mn(F - D0)} = ${mn((F * r) / 2, 2)}\\,${aSym(2 * nYears)} + ${mn(F)}\\,v^{${2 * nYears}}$: $j = ${dec(jK, 6)}$ per half-year.

**Step 2 — Book value after a year.** $B = ${mn((F * r) / 2, 2)}\\,${aSym(2 * nYears - 2)} + ${mn(F)}\\,v^{${2 * nYears - 2}} = ${mn(B, 2)}$ at Kate's yield.

**Step 3 — Wallace's discount.** At $${dec(yW / 2, 4)}$, his price is $${mn(F - D, 2)}$, so $D = ${mn(D, 2)}$ and $B - D = ${mn(key, 2)}$.`,
        checks: [{ label: "Kate's yield reprices", ok: close(bondPrice((F * r) / 2, F, jK, 2 * nYears), F - D0, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_PRICE_DIFFERENCE_SOLVE_RATE",
    domain: BONDS,
    title: "Yield Rate from a Difference in Bond Prices",
    objective: "Cancel the common cash flows of two bonds priced at one yield, leaving an annuity to solve for the rate.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [59, 269],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const F = rng.choice([1000, 5000, 10000]);
        const years = rng.int(5, 20);
        const delta = rng.choice([0.01, 0.02, 0.03, 0.04]);
        const iTrue = gridRate(rng, 0.05, 0.1, 0.002);
        const diff = cents(F * delta * an(2 * years, iTrue / 2));
        const target = diff / (F * delta);
        const j = solve((x) => an(2 * years, x) - target, 1e-6, 0.5);
        const key = 2 * j * 100;
        return {
          questionText: `You are given the following information about two bonds, Bond A and Bond B:
(i) Each bond is a ${years}-year bond with semiannual coupons redeemable at its par value of ${n(F)}, and is bought to yield an annual nominal interest rate of $i$, convertible semiannually.
(ii) Bond A has an annual coupon rate of $(i + ${delta})$, paid semiannually.
(iii) Bond B has an annual coupon rate of $(i - ${delta})$, paid semiannually.
(iv) The price of Bond A is ${n(diff, 2)} greater than the price of Bond B.
Calculate $i$.`,
          variables: { variant: "SPREAD", F, years, delta, diff },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor(j * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual rate."),
            distractor((Math.pow(1 + j, 2) - 1) * 100, "NOMINAL_RATE_ERROR", "Compounded to an annual effective rate."),
            distractor(2 * trySolve((x) => an(2 * years, x) - diff / ((F * delta) / 2), 1e-6, 0.5) * 100, "CALCULATION_DISTRACTOR", `Took the coupon gap per half-year as ${delta}/2 of the face instead of ${delta}.`),
            distractor(trySolve((x) => an(years, x) - diff / (2 * F * delta), 1e-6, 0.8) * 100, "CALCULATION_DISTRACTOR", "Treated the coupons as annual."),
          ],
          solutionSteps: `**Step 1 — Difference in coupons.** The bonds differ only in their coupons: each half-year Bond A pays $${mn(F)}\\cdot\\frac{2(${delta})}{2} = ${mn(F * delta, 2)}$ more.

**Step 2 — Annuity factor.** $${mn(diff, 2)} = ${mn(F * delta, 2)}\\,${aSym(2 * years)}$, so $${aSym(2 * years)} = ${dec(target, 5)}$ and $j = ${dec(j, 6)}$.

**Step 3 — Nominal rate.** $i = 2j = ${dec(2 * j, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "rate recovered", ok: Math.abs(2 * j - iTrue) < 1e-4 }],
        };
      }
      const years = rng.int(2, 6);
      const N = 2 * years;
      const c = rng.choice([3, 4, 5, 6, 8, 10]);
      const X = gridAmount(rng, 60, 150, 5);
      const mult = rng.choice([1.5, 1.6, 2, 2.5]);
      const yTrue = gridRate(rng, 0.04, 0.14, 0.01);
      const jTrue = yTrue / 2;
      const P1 = cents(c * an(N, jTrue) + X * v(jTrue, N));
      const P2 = cents(c * an(N, jTrue) + mult * X * v(jTrue, N));
      const target = (mult * P1 - P2) / ((mult - 1) * c);
      const j = solve((x) => an(N, x) - target, 1e-6, 0.5);
      const key = 2 * j * 100;
      return {
        questionText: `A ${word(years)}-year bond with face amount $X$ and a coupon of ${c} paid at the end of every six months is priced at ${n(P1, 2)}. A ${word(years)}-year bond with face value of ${mult}$X$ and a coupon of ${c} paid at the end of every six months is priced at ${n(P2, 2)}. Both have the same yield rate.
Calculate the annual nominal yield rate, convertible semiannually.`,
        variables: { variant: "FACE_MULTIPLE", mult, c, years, P1, P2 },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor(j * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual rate."),
          distractor((Math.pow(1 + j, 2) - 1) * 100, "NOMINAL_RATE_ERROR", "Compounded to an annual effective rate."),
          distractor(2 * trySolve((x) => an(N, x) - (mult * P1 - P2) / (mult * c), 1e-6, 0.8) * 100, "CALCULATION_DISTRACTOR", `Divided by ${mult} times the coupon instead of ${dec(mult - 1, 1)} times.`),
          distractor(2 * trySolve((x) => an(N, x) - (P2 - P1) / ((mult - 1) * c), 1e-6, 0.8) * 100, "CALCULATION_DISTRACTOR", "Subtracted the prices without scaling the first bond."),
        ],
        solutionSteps: `**Step 1 — Eliminate the face amount.** Multiply the first price equation by ${mult}:
$$${mn(mult * P1, 3)} = ${mn(mult * c, 2)}\\,${aSym(N)} + ${mult}X v^{${N}},\\qquad ${mn(P2, 2)} = ${c}\\,${aSym(N)} + ${mult}X v^{${N}}.$$

**Step 2 — Annuity factor.** Subtracting, $${mn(mult * P1 - P2, 3)} = ${mn((mult - 1) * c, 2)}\\,${aSym(N)}$, so $${aSym(N)} = ${dec(target, 5)}$ and $j = ${dec(j, 6)}$.

**Step 3 — Nominal rate.** $2j = ${dec(2 * j, 6)}$, that is, ${key.toFixed(3)}%.`,
        checks: [{ label: "rate recovered", ok: Math.abs(2 * j - yTrue) < 2e-3 }],
      };
    },
  },

  {
    id: "FM_BOND_PRICE_DIFFERENCE_SOLVE_TERM",
    domain: BONDS,
    title: "Term of a Bond from Its Price",
    objective: "Solve for a bond's term from its price, from a price difference, or from equal prices.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [206, 345, 258],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["GAP", "PRICE", "SAME_PRICE"] as const);
      const ladder = { optionStyle: "LADDER" as const, ladderStep: rng.choice([1, 2]) };
      if (variant === "GAP") {
        const F = rng.choice([1000, 5000, 10000]);
        const years = rng.int(8, 25);
        const r1 = gridRate(rng, 0.04, 0.1, 0.005);
        const r2 = r1 - rng.choice([0.005, 0.01, 0.015, 0.02]);
        const e = rng.choice([10, 20, 25, 50, 100]) * (F / 1000 >= 5 ? 1 : 0.5);
        const y = gridRate(rng, 0.04, 0.1, 0.005);
        const j = y / 2;
        const diff = cents(((F * (r1 - r2)) / 2) * an(2 * years, j) - e * v(j, 2 * years));
        const coupons = (F * (r1 - r2)) / 2;
        const vN = (coupons / j - diff) / (coupons / j + e);
        const periods = Math.log(1 / vN) / Math.log(1 + j);
        return {
          questionText: `Bond X and Bond Y are $n$-year bonds with face amount of ${n(F)} and semiannual coupons, each yielding an annual nominal interest rate of ${pc(y)} convertible semiannually. Bond X has an annual coupon rate of ${pc(r1)} and redemption value $c$. Bond Y has an annual coupon rate of ${pc(r2)} and redemption value $c + ${e}$. The price of Bond X exceeds the price of Bond Y by ${n(diff, 2)}.
Calculate $n$.`,
          variables: { variant, F, r1, r2, e, y, diff },
          correctValue: years,
          format: "AMOUNT_0",
          ...ladder,
          distractors: [],
          solutionSteps: `**Step 1 — Difference in cash flows.** Bond X pays $${mn(coupons, 2)}$ more each half-year and ${e} less at maturity, so with $j = ${dec(j, 4)}$:
$$${mn(diff, 2)} = ${mn(coupons, 2)}\\,${aSym("2n")} - ${e}v^{2n}.$$

**Step 2 — Solve for $v^{2n}$.** Writing $${aSym("2n")} = (1 - v^{2n})/j$: $v^{2n} = \\frac{${mn(coupons / j, 4)} - ${mn(diff, 2)}}{${mn(coupons / j, 4)} + ${e}} = ${dec(vN, 6)}$.

**Step 3 — Term.** $2n = \\ln(1/${dec(vN, 6)})/\\ln(${dec(1 + j, 4)}) = ${periods.toFixed(2)}$, so $n = ${years}$.`,
          checks: [{ label: "term recovered", ok: Math.abs(periods - 2 * years) < 0.05 }],
        };
      }
      if (variant === "PRICE") {
        const F = rng.choice([900, 950, 980, 1000, 1050]);
        const C = 1000;
        const c = rng.choice([25, 30, 35, 40, 45, 49, 50]);
        const r = (2 * c) / F;
        const delta = rng.choice([0.01, 0.012, 0.015, 0.018, 0.02]);
        const years = rng.int(4, 15);
        const y = r + delta;
        const j = y / 2;
        const P = cents(bondPrice(c, C, j, 2 * years));
        const vN = (c / j - P) / (c / j - C);
        const periods = Math.log(1 / vN) / Math.log(1 + j);
        const rPct = Number((r * 100).toFixed(4));
        const deltaPct = Number((delta * 100).toFixed(4));
        return {
          questionText: `An $n$-year bond with an annual coupon rate of $r$% has the following characteristics:
(i) The face amount is ${n(F)}.
(ii) Coupons of ${c} are paid semiannually.
(iii) The annual nominal yield rate convertible semiannually is $(r + ${deltaPct})$%.
(iv) The purchase price is ${n(P, 2)}.
(v) The redemption value is ${n(C)}.
Calculate $n$.`,
          variables: { variant, F, c, delta, P, C },
          correctValue: years,
          format: "AMOUNT_0",
          ...ladder,
          distractors: [],
          solutionSteps: `**Step 1 — Rates.** $r = 2(${c})/${mn(F)} = ${dec(r, 6)}$, so the yield is $${dec(y, 6)}$ and $j = ${dec(j, 6)}$ per half-year.

**Step 2 — Solve for $v^{2n}$.** $${mn(P, 2)} = ${c}\\,${aSym("2n")} + ${mn(C)}v^{2n} = \\frac{${c}}{j}(1 - v^{2n}) + ${mn(C)}v^{2n}$, so $v^{2n} = ${dec(vN, 6)}$.

**Step 3 — Term.** $2n = ${periods.toFixed(2)}$, so $n = ${years}$. (Here $r = ${rPct}$.)`,
          checks: [{ label: "term recovered", ok: Math.abs(periods - 2 * years) < 0.05 }],
        };
      }
      const FA = 1000;
      const FB = 1000;
      const { nA, rA, CA, yA, rB, nB } = drawUntil(
        () => ({
          nA: rng.int(10, 25),
          rA: gridRate(rng, 0.05, 0.1, 0.005),
          CA: rng.choice([1000, 1100, 1200]),
          yA: gridRate(rng, 0.05, 0.1, 0.002),
          rB: gridRate(rng, 0.04, 0.1, 0.005),
          nB: rng.int(6, 20),
        }),
        (p) => {
          const pa = bondPrice((FA * p.rA) / 2, p.CA, p.yA / 2, 2 * p.nA);
          const cb = (pa - ((FB * p.rB) / 4) * an(4 * p.nB, p.yA / 4)) / v(p.yA / 4, 4 * p.nB);
          return Math.abs(p.rB - p.yA) > 0.004 && cb > 800 && cb < 2500;
        },
        { nA: 15, rA: 0.09, CA: 1200, yA: 0.084, rB: 0.08, nB: 12 }
      );
      const PA = bondPrice((FA * rA) / 2, CA, yA / 2, 2 * nA);
      const jB = yA / 4;
      const CB = cents((PA - ((FB * rB) / 4) * an(4 * nB, jB)) / v(jB, 4 * nB));
      const gB = (FB * rB) / 4;
      const vN = (gB / jB - PA) / (gB / jB - CB);
      const periods = Math.log(1 / vN) / Math.log(1 + jB);
      return {
        questionText: `Bond A is a ${nA}-year ${n(FA)} face amount bond with ${couponText(rA, 2)}. Bond A will be redeemed at ${n(CA)} and is bought to yield ${pc(yA)} convertible semiannually.
Bond B is an $n$-year ${n(FB)} face amount bond with ${couponText(rB, 4)}. Bond B will be redeemed at ${n(CB, 2)} and is bought to yield ${pc(yA)} convertible quarterly.
The two bonds have the same purchase price.
Calculate $n$.`,
        variables: { variant, FA, rA, CA, nA, yA, FB, rB, CB },
        correctValue: nB,
        format: "AMOUNT_0",
        ...ladder,
        distractors: [],
        solutionSteps: `**Step 1 — Price of Bond A.** $P = ${mn((FA * rA) / 2, 2)}\\,${aSym(2 * nA, dec(yA / 2, 4))} + ${mn(CA)}\\,v^{${2 * nA}} = ${mn(PA, 2)}$.

**Step 2 — Bond B's equation.** With $j = ${dec(jB, 4)}$ per quarter, $${mn(PA, 2)} = ${mn(gB, 2)}\\,${aSym("4n")} + ${mn(CB, 2)}v^{4n}$, so $v^{4n} = \\frac{${mn(gB / jB, 4)} - ${mn(PA, 2)}}{${mn(gB / jB, 4)} - ${mn(CB, 2)}} = ${dec(vN, 6)}$.

**Step 3 — Term.** $4n = ${periods.toFixed(2)}$, so $n = ${nB}$.`,
        checks: [{ label: "term recovered", ok: Math.abs(periods - 4 * nB) < 0.05 }],
      };
    },
  },

  {
    id: "FM_BOND_PRICE_CHANGE_SOLVE_COUPON",
    domain: BONDS,
    title: "Coupon or Redemption Value from a Change in Price",
    objective: "Compare two versions of a bond at one yield to isolate the unknown coupon or redemption value.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [196, 385, 239, 235],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["TERM_DOUBLED", "COUPON_DOUBLED", "SHORTER", "REDEMPTION_GAP"] as const);
      if (variant === "TERM_DOUBLED") {
        const F = rng.choice([1000, 1000, 2000]);
        const less = rng.next() < 0.6;
        const { years, y, D } = drawUntil(
          () => ({ years: rng.int(2, 8), y: gridRate(rng, 0.04, 0.12, 0.005), D: rng.int(10, 80) * (F / 1000) }),
          (p) => {
            const gap = p.D / (an(4 * p.years, p.y / 2) - an(2 * p.years, p.y / 2));
            return gap > 0.05 * F * (p.y / 2) && gap < 0.6 * F * (p.y / 2);
          },
          { years: 3, y: 0.1, D: 49 * (F / 1000) }
        );
        const j = y / 2;
        const growth = an(4 * years, j) - an(2 * years, j);
        const c = less ? F * j - D / growth : F * j + D / growth;
        return {
          questionText: `A ${word(years)}-year bond with a face value of ${n(F)} pays coupons semiannually. The bond is redeemable at face value. It is bought at issue at a price to produce an annual yield rate of ${pc(y)} convertible semiannually. If the term of the bond is doubled and the yield rate remains the same, the purchase price would ${less ? "decrease" : "increase"} by ${D}.
Calculate the amount of a coupon.`,
          variables: { variant, F, years, y, D, less: less ? 1 : 0 },
          correctValue: c,
          format: "AMOUNT_2",
          distractors: [
            distractor(less ? F * j - D / an(2 * years, j) : F * j + D / an(2 * years, j), "CALCULATION_DISTRACTOR", "Spread the change over the original term instead of the added coupons."),
            distractor(less ? F * j + D / growth : F * j - D / growth, "CALCULATION_DISTRACTOR", "Took the bond to be at a premium when it is at a discount, or the reverse."),
            distractor(less ? F * j - D / an(4 * years, j) : F * j + D / an(4 * years, j), "CALCULATION_DISTRACTOR", "Spread the change over the whole doubled term."),
            distractor(less ? F * j - D / (2 * years) : F * j + D / (2 * years), "SIMPLE_INTEREST_ERROR", "Divided the change by the number of added coupons without discounting."),
          ],
          solutionSteps: `**Step 1 — Premium/discount form.** At par redemption, $P_n = F + (Fr - Fj)\\,${aSym("2n")}$ with $j = ${dec(j, 4)}$, so
$$P_{${2 * years}} - P_{${years}} = (Fr - Fj)(${aSym(4 * years)} - ${aSym(2 * years)}) = (Fr - ${mn(F * j, 2)})(${dec(growth, 5)}).$$

**Step 2 — Solve.** This equals $${less ? "-" : ""}${D}$, so $Fr = ${mn(F * j, 2)} ${less ? "-" : "+"} ${D}/${dec(growth, 5)} = ${mn(c, 2)}$.`,
          checks: [{ label: "price change reproduced", ok: close(bondPrice(c, F, j, 4 * years) - bondPrice(c, F, j, 2 * years), less ? -D : D, 1e-9) }],
        };
      }
      if (variant === "COUPON_DOUBLED") {
        const F = rng.choice([1000, 1000, 5000]);
        const years = rng.int(2, 10);
        const m = rng.choice([2, 4]);
        const y = gridRate(rng, 0.04, 0.12, 0.005);
        const j = y / m;
        const D = gridAmount(rng, 100, 800, 50) * (F / 1000);
        const X = D / an(m * years, j);
        return {
          questionText: `A ${word(years)}-year ${n(F)} face amount bond pays coupons of $X$ ${frequency(m)}. It is bought at a price to yield an annual nominal rate of ${pc(y)} convertible ${frequency(m)}. If the amount of each coupon were doubled, the purchase price would have to increase by ${n(D)} for the bond to maintain the same yield rate.
Calculate $X$.`,
          variables: { variant, F, years, m, y, D },
          correctValue: X,
          format: "AMOUNT_2",
          distractors: [
            distractor(D / an(years, y), "NOMINAL_RATE_ERROR", "Treated the coupons as annual."),
            distractor(D / (m * years), "SIMPLE_INTEREST_ERROR", "Divided the increase by the number of coupons without discounting."),
            distractor(D / adue(m * years, j), "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
            distractor((D - F * v(j, m * years)) / an(m * years, j) + (F * j) / 2, "CALCULATION_DISTRACTOR", "Included the redemption value in the change in price."),
          ],
          solutionSteps: `**Step 1 — What changes.** Doubling the coupons adds a second annuity of $X$ per period; the redemption value is unchanged. With $j = ${dec(j, 4)}$ and ${m * years} coupons:
$$${mn(D)} = X\\,${aSym(m * years)} = X(${dec(an(m * years, j), 5)}).$$

**Step 2 — Solve.** $X = ${mn(D)}/${dec(an(m * years, j), 5)} = ${mn(X, 2)}$.`,
          checks: [{ label: "increase reproduced", ok: close(bondPrice(2 * X, F, j, m * years) - bondPrice(X, F, j, m * years), D, 1e-9) }],
        };
      }
      if (variant === "SHORTER") {
        const params = drawUntil(
          () => {
            const F = 1000;
            const r = gridRate(rng, 0.03, 0.08, 0.005);
            const y = gridRate(rng, 0.04, 0.1, 0.005);
            const n1 = rng.int(4, 10);
            const n2 = rng.int(2, n1 - 1);
            const pct = rng.choice([0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08]);
            const less = rng.next() < 0.5;
            const j = y / 2;
            const g = (F * r) / 2;
            const factor = less ? 1 - pct : 1 + pct;
            const C = (factor * g * an(2 * n1, j) - g * an(2 * n2, j)) / (v(j, 2 * n2) - factor * v(j, 2 * n1));
            return { F, r, y, n1, n2, pct, less: less ? 1 : 0, C };
          },
          (p) => Number.isFinite(p.C) && p.C > 400 && p.C < 2500,
          { F: 1000, r: 0.05, y: 0.06, n1: 4, n2: 2, pct: 0.07, less: 1, C: 455.4 }
        );
        const { F, r, y, n1, n2, pct, less, C } = params;
        const j = y / 2;
        const g = (F * r) / 2;
        const factor = less ? 1 - pct : 1 + pct;
        // The same percentage applied the wrong way round: P(long) = factor * P(short).
        const Cwrong = (factor * g * an(2 * n2, j) - g * an(2 * n1, j)) / (v(j, 2 * n1) - factor * v(j, 2 * n2));
        return {
          questionText: `A ${word(n1)}-year ${n(F)} face amount bond, with ${couponText(r, 2)}, has redemption value of $C$. It is bought at a price to yield an annual nominal rate of ${pc(y)} convertible semiannually. If the term of the bond had been ${word(n2)} years, the purchase price would have been ${pc(pct)} ${less ? "less" : "more"}.
Calculate $C$.`,
          variables: { variant, F, r, y, n1, n2, pct, less },
          correctValue: C,
          format: "AMOUNT_0",
          distractors: [
            distractor(Cwrong, "CALCULATION_DISTRACTOR", `Applied the ${pc(pct)} to the shorter bond's price instead of the longer one's.`),
            distractor((factor * F * r * an(n1, y) - F * r * an(n2, y)) / (v(y, n2) - factor * v(y, n1)), "NOMINAL_RATE_ERROR", "Treated the coupons and yield as annual."),
            distractor((factor * g * an(2 * n1, j) - g * an(2 * n2, j)) / (1 - factor), "CALCULATION_DISTRACTOR", "Left the redemption value undiscounted."),
            distractor(F * factor, "CALCULATION_DISTRACTOR", "Scaled the face amount by the change in price."),
          ],
          solutionSteps: `**Step 1 — Two prices.** With $j = ${dec(j, 4)}$ and coupons of ${n(g, 2)}:
$$P_{${n1}} = ${mn(g, 2)}\\,${aSym(2 * n1)} + C v^{${2 * n1}},\\qquad P_{${n2}} = ${mn(g, 2)}\\,${aSym(2 * n2)} + C v^{${2 * n2}} = ${dec(factor, 2)}P_{${n1}}.$$

**Step 2 — Solve the linear equation.**
$$C = \\frac{${dec(factor, 2)}(${mn(g * an(2 * n1, j), 4)}) - ${mn(g * an(2 * n2, j), 4)}}{${dec(v(j, 2 * n2), 6)} - ${dec(factor, 2)}(${dec(v(j, 2 * n1), 6)})} = ${mn(C, 2)}.$$`,
          checks: [{ label: "price ratio reproduced", ok: close(bondPrice(g, C, j, 2 * n2), factor * bondPrice(g, C, j, 2 * n1), 1e-9) }],
        };
      }
      const F = rng.choice([1000, 1500, 2000, 5000]);
      const years = rng.int(8, 25);
      const y = gridRate(rng, 0.04, 0.1, 0.005);
      const r1 = gridRate(rng, 0.05, 0.11, 0.005);
      const r2 = r1 - rng.choice([0.01, 0.015, 0.02, 0.025]);
      const K = gridAmount(rng, 50, 400, 50) * (F / 1000);
      const j = y / 2;
      const coupons = ((F * (r1 - r2)) / 2) * an(2 * years, j);
      const D = cents(coupons - K * v(j, 2 * years));
      const Khat = (coupons - D) / v(j, 2 * years);
      return {
        questionText: `You are given the following information about Bond X and Bond Y:
(i) Both bonds are ${years}-year bonds.
(ii) Both bonds have face amount ${n(F)}.
(iii) Both bonds have an annual nominal yield rate of ${pc(y)} compounded semiannually.
(iv) Bond X has an annual coupon rate of ${pc(r1)} paid semiannually and a redemption value $C$.
(v) Bond Y has an annual coupon rate of ${pc(r2)} paid semiannually and a redemption value $C + K$.
(vi) The price of Bond X exceeds the price of Bond Y by ${n(D, 2)}.
Calculate $K$.`,
        variables: { variant, F, years, y, r1, r2, D },
        correctValue: Khat,
        format: "AMOUNT_0",
        distractors: [
          distractor(coupons - D, "CALCULATION_DISTRACTOR", "Did not discount the extra redemption value."),
          distractor((((F * (r1 - r2)) / 2) * an(2 * years, perPeriod(y, 2)) - D) / v(perPeriod(y, 2), 2 * years), "NOMINAL_RATE_ERROR", "Treated the nominal yield as an annual effective rate."),
          distractor((F * (r1 - r2) * an(years, y) - D) / v(y, years), "NOMINAL_RATE_ERROR", "Treated the coupons and yield as annual."),
          distractor((coupons + D) / v(j, 2 * years), "CALCULATION_DISTRACTOR", "Added the price difference instead of subtracting it."),
        ],
        solutionSteps: `**Step 1 — Difference in cash flows.** Bond X pays $${mn((F * (r1 - r2)) / 2, 2)}$ more each half-year and $K$ less at maturity, so at $j = ${dec(j, 4)}$:
$$${mn(D, 2)} = ${mn((F * (r1 - r2)) / 2, 2)}\\,${aSym(2 * years)} - K v^{${2 * years}} = ${mn(coupons, 4)} - ${dec(v(j, 2 * years), 6)}K.$$

**Step 2 — Solve.** $K = (${mn(coupons, 4)} - ${mn(D, 2)})/${dec(v(j, 2 * years), 6)} = ${mn(Khat, 2)}$.`,
        checks: [{ label: "K recovered", ok: Math.abs(Khat - K) < 0.1 }],
      };
    },
  },

  {
    id: "FM_BOND_SAME_PRICE_SOLVE_COUPON",
    domain: BONDS,
    title: "Coupon Rate from Bonds with Related Prices",
    objective: "Equate or relate the prices of two or more bonds to solve for an unknown coupon rate.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [167, 234, 95, 419, 141],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["DIFF_YIELD", "DIFF_REDEMPTION", "THREE", "ZERO_THEN_COUPON", "PRICE_RATIO"] as const);
      if (variant === "DIFF_YIELD") {
        const F = rng.choice([1000, 1000, 5000]);
        const years = rng.int(3, 15);
        const rA = gridRate(rng, 0.04, 0.1, 0.005);
        const yA = gridRate(rng, 0.03, 0.09, 0.005);
        const yB = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - yA) >= 0.005, yA + 0.01);
        const N = 2 * years;
        const P = bondPrice((F * rA) / 2, F, yA / 2, N);
        const key = ((2 * (P - F * v(yB / 2, N))) / (F * an(N, yB / 2))) * 100;
        return {
          questionText: `Let A and B be bonds with semiannual coupons as described in the table below:
$$\\begin{array}{cccccc}\\text{Bond} & \\text{Price} & \\text{Annual coupon rate} & \\text{Par} & \\text{Years to redemption} & \\text{Annual nominal yield (conv. semiannually)} \\\\ \\hline A & X & ${mpc(rA)} & ${mn(F)} & ${years} & ${mpc(yA)} \\\\ B & X & y & ${mn(F)} & ${years} & ${mpc(yB)}\\end{array}$$
Calculate $y$.`,
          variables: { variant, F, years, rA, yA, yB },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor((rA + (yB - yA)) * 100, "CALCULATION_DISTRACTOR", "Shifted the coupon rate by the difference in yields."),
            distractor(((P - F * v(yB / 2, N)) / (F * an(N, yB / 2))) * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual coupon rate."),
            distractor(((P - F * v(yB, years)) / (F * an(years, yB))) * 100, "NOMINAL_RATE_ERROR", "Treated the coupons and yields as annual."),
            distractor(rA * (yB / yA) * 100, "CALCULATION_DISTRACTOR", "Scaled the coupon rate by the ratio of the yields."),
          ],
          solutionSteps: `**Step 1 — Price of Bond A.** $X = ${mn((F * rA) / 2, 2)}\\,${aSym(N, dec(yA / 2, 4))} + ${mn(F)}\\,v^{${N}} = ${mn(P, 2)}$.

**Step 2 — Bond B at ${pc(yB)}.** $${mn(P, 2)} = \\frac{${mn(F)}y}{2}\\,${aSym(N, dec(yB / 2, 4))} + ${mn(F)}(${dec(1 + yB / 2, 4)})^{-${N}} = ${mn((F / 2) * an(N, yB / 2), 3)}y + ${mn(F * v(yB / 2, N), 3)}$.

**Step 3 — Solve.** $y = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "same price", ok: close(bondPrice((F * key) / 200, F, yB / 2, N), P, 1e-9) }],
        };
      }
      if (variant === "DIFF_REDEMPTION") {
        const years = rng.int(10, 25);
        const i = gridRate(rng, 0.04, 0.09, 0.005);
        const C1 = gridAmount(rng, 3000, 8000, 500);
        const C2 = drawUntil(() => gridAmount(rng, 3000, 9000, 500), (x) => Math.abs(x - C1) >= 1000, C1 + 1500);
        const r1 = gridRate(rng, 0.04, 0.1, 0.001);
        const P = C1 * (r1 * an(years, i) + v(i, years));
        const r = (P - C2 * v(i, years)) / (C2 * an(years, i));
        return {
          questionText: `A bank issues two ${years}-year par-value bonds providing annual coupons. Each bond sells for the same price and provides an annual effective yield rate of ${pc(i)}.
The first bond has a redemption value of ${n(C1)} and a coupon of ${pc(r1)} paid annually. The second bond has a redemption value of ${n(C2)} and a coupon of $r$% paid annually.
Calculate $r$.`,
          variables: { variant, years, i, C1, r1, C2 },
          correctValue: r * 100,
          format: "PERCENT_2",
          distractors: [
            distractor(((r1 * C1) / C2) * 100, "CALCULATION_DISTRACTOR", "Kept the coupon amount equal instead of the price."),
            distractor(r1 * 100, "CALCULATION_DISTRACTOR", "Assumed equal prices need equal coupon rates."),
            distractor(((C1 * (r1 * an(years, i) + v(i, years)) - C2 * v(i, years)) / (C2 * adue(years, i))) * 100, "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
            distractor(((C1 * r1 * an(years, i) + (C1 - C2)) / (C2 * an(years, i))) * 100, "CALCULATION_DISTRACTOR", "Did not discount the difference in redemption values."),
          ],
          solutionSteps: `**Step 1 — Common price.** $P = ${mn(C1)}(${dec(r1, 4)})\\,${aSym(years, mpc(i))} + ${mn(C1)}\\,v^{${years}} = ${mn(P, 2)}$.

**Step 2 — Second bond.** $${mn(P, 2)} = ${mn(C2)}r\\,${aSym(years, mpc(i))} + ${mn(C2)}\\,v^{${years}} = ${mn(C2 * an(years, i), 3)}r + ${mn(C2 * v(i, years), 3)}$.

**Step 3 — Solve.** $r = ${dec(r, 6)}$, that is, ${(r * 100).toFixed(3)}%.`,
          checks: [{ label: "same price", ok: close(C2 * (r * an(years, i) + v(i, years)), P, 1e-10) }],
        };
      }
      if (variant === "THREE") {
        const { F1, F2, F3, r1, r2 } = drawUntil(
          () => {
            const years = rng.int(5, 20);
            const i = gridRate(rng, 0.03, 0.08, 0.005);
            const price = gridAmount(rng, 900, 1200, 50);
            const F1 = rng.choice([800, 900, 1000]);
            const F2 = F1 + rng.choice([100, 150, 200]);
            const F3 = F2 + rng.choice([100, 150, 200, 220]);
            const rate = (F: number) => (price / F - v(i, years)) / an(years, i);
            return { F1, F2, F3, r1: Number(rate(F1).toFixed(4)), r2: Number(rate(F2).toFixed(4)), r3: rate(F3) };
          },
          (p) => p.r3 > 0.01 && p.r1 < 0.15 && p.r1 - p.r2 > 0.002,
          { F1: 1000, F2: 1100, F3: 1320, r1: 0.0528, r2: 0.044, r3: 0.0293 }
        );
        const x = (r1 - r2) / (1 / F1 - 1 / F2);
        const z = r1 - x / F1;
        const r3 = x / F3 + z;
        return {
          questionText: `A bank issues three annual coupon bonds redeemable at par, all with the same term, price, and annual effective yield rate.
The first bond has face value ${n(F1)} and annual coupon rate ${pc(r1)}.
The second bond has face value ${n(F2)} and annual coupon rate ${pc(r2)}.
The third bond has face value ${n(F3)} and annual coupon rate $r$.
Calculate $r$.`,
          variables: { variant, F1, r1, F2, r2, F3 },
          correctValue: r3 * 100,
          format: "PERCENT_2",
          distractors: [
            distractor((r2 - ((r1 - r2) * (F3 - F2)) / (F2 - F1)) * 100, "CALCULATION_DISTRACTOR", "Extrapolated the coupon rate linearly in the face value instead of its reciprocal."),
            distractor(((r2 * F2) / F3) * 100, "CALCULATION_DISTRACTOR", "Kept the coupon amount fixed."),
            distractor((r2 - (r1 - r2)) * 100, "CALCULATION_DISTRACTOR", "Repeated the drop from the first bond to the second."),
            distractor(((r1 * F1) / F3) * 100, "CALCULATION_DISTRACTOR", "Scaled the first coupon rate by the ratio of face values."),
          ],
          solutionSteps: `**Step 1 — Coupon rate as a function of face value.** From $P = F\\,v^n + Fr\\,${aSym("n", "i")}$, $r = \\frac{P}{${aSym("n", "i")}}\\cdot\\frac{1}{F} - \\frac{v^n}{${aSym("n", "i")}}$, which is linear in $1/F$: $r = x/F + z$.

**Step 2 — Fit the two bonds.** $x = \\frac{${dec(r1, 4)} - ${dec(r2, 4)}}{1/${F1} - 1/${F2}} = ${dec(x, 4)}$ and $z = ${dec(r1, 4)} - x/${F1} = ${dec(z, 6)}$.

**Step 3 — Third bond.** $r = ${dec(x, 4)}/${F3} ${z < 0 ? "-" : "+"} ${dec(Math.abs(z), 6)} = ${dec(r3, 6)}$, that is, ${(r3 * 100).toFixed(3)}%.`,
          checks: [{ label: "rate positive and decreasing", ok: r3 > 0.002 && r3 < r2 }],
        };
      }
      if (variant === "ZERO_THEN_COUPON") {
        const { n1, F1, P1, n2, F2, P2 } = drawUntil(
          () => {
            const F1 = rng.choice([1000, 2000, 5000, 10000]);
            return {
              n1: rng.int(5, 15),
              F1,
              P1: gridAmount(rng, 0.45 * F1, 0.85 * F1, F1 / 100),
              n2: rng.int(5, 20),
              F2: rng.choice([900, 950, 1000, 1100]),
              P2: gridAmount(rng, 800, 1200, 50),
            };
          },
          (p) => {
            const ii = Math.pow(p.F1 / p.P1, 1 / p.n1) - 1;
            const rr = (4 * (p.P2 - p.F2 * v(ii, p.n2))) / (p.F2 * an(4 * p.n2, perPeriod(ii, 4)));
            return ii > 0.02 && ii < 0.1 && rr > 0.01 && rr < 0.15;
          },
          { n1: 10, F1: 5000, P1: 3000, n2: 15, F2: 950, P2: 1000 }
        );
        const i = Math.pow(F1 / P1, 1 / n1) - 1;
        const j = perPeriod(i, 4);
        const r = (4 * (P2 - F2 * v(i, n2))) / (F2 * an(4 * n2, j));
        return {
          questionText: `A bank issues two bonds with the same annual effective yield rate. The first bond is a ${word(n1)}-year zero-coupon bond with a price of ${n(P1)} and a face amount of ${n(F1)}. The second bond is a ${n2}-year bond providing quarterly coupons, with a price of ${n(P2)} and a face amount of ${n(F2)}.
Calculate the annual coupon rate for the second bond.`,
          variables: { variant, n1, P1, F1, n2, P2, F2 },
          correctValue: r * 100,
          format: "PERCENT_2",
          distractors: [
            distractor(((4 * (P2 - F2 * v(i, n2))) / (F2 * an(4 * n2, i / 4))) * 100, "NOMINAL_RATE_ERROR", "Divided the annual effective rate by 4."),
            distractor(((P2 - F2 * v(i, n2)) / (F2 * an(n2, i))) * 100, "CALCULATION_DISTRACTOR", "Treated the coupons as annual."),
            distractor(i * 100, "CALCULATION_DISTRACTOR", "Gave the yield rate, not the coupon rate."),
            distractor(((P2 - F2 * v(i, n2)) / (F2 * an(4 * n2, j))) * 100, "NOMINAL_RATE_ERROR", "Stopped at the quarterly coupon rate."),
          ],
          solutionSteps: `**Step 1 — Yield from the zero-coupon bond.** $(1 + i)^{${n1}} = ${mn(F1)}/${mn(P1)}$, so $i = ${dec(i, 6)}$ and the quarterly rate is $j = (1 + i)^{1/4} - 1 = ${dec(j, 6)}$.

**Step 2 — Second bond.** $${mn(P2)} = \\frac{${mn(F2)}r}{4}\\,${aSym(4 * n2)} + ${mn(F2)}(1 + i)^{-${n2}}$, where $${aSym(4 * n2)} = ${dec(an(4 * n2, j), 5)}$ and the redemption term is $${mn(F2 * v(i, n2), 3)}$.

**Step 3 — Solve.** $r = \\frac{4(${mn(P2)} - ${mn(F2 * v(i, n2), 3)})}{${mn(F2)}(${dec(an(4 * n2, j), 5)})} = ${dec(r, 6)}$, that is, ${(r * 100).toFixed(3)}%.`,
          checks: [{ label: "rate sensible", ok: r > 0.005 && r < 0.2 }],
        };
      }
      const F = rng.choice([1000, 5000, 10000]);
      const ratioOf = (p: { years: number; i: number; below: number; above: number; step: number; k: number }) =>
        (p.step * an(p.years, p.i) + ((1 + p.above) - p.k * (1 - p.below)) * v(p.i, p.years)) / ((p.k - 1) * an(p.years, p.i));
      const { years, i, below, above, step, k } = drawUntil(
        () => ({
          years: rng.int(3, 12),
          i: gridRate(rng, 0.03, 0.08, 0.005),
          below: rng.choice([0.05, 0.1]),
          above: rng.choice([0.05, 0.1]),
          step: rng.choice([0.01, 0.02]),
          k: rng.choice([1.1, 1.15, 1.2, 1.25]),
        }),
        (p) => ratioOf(p) > 0.02 && ratioOf(p) < 0.14,
        { years: 5, i: 0.04, below: 0.1, above: 0.1, step: 0.01, k: 1.2 }
      );
      const a = an(years, i);
      const vn = v(i, years);
      const r = ratioOf({ years, i, below, above, step, k });
      return {
        questionText: `Bond A and Bond B are both annual coupon, ${word(years)}-year, ${n(F)} par value bonds bought to yield an annual effective rate of ${pc(i)}.
(i) Bond A has an annual coupon rate of $r$%, a redemption value that is ${pc(below)} below par, and a price of $P$.
(ii) Bond B has an annual coupon rate of $(r + ${step * 100})$%, a redemption value that is ${pc(above)} above par, and a price of ${k}$P$.
Calculate $r$%.`,
        variables: { variant, F, years, i, below, above, step, k },
        correctValue: r * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(((step * a + (above + below) * vn) / ((k - 1) * a)) * 100, "CALCULATION_DISTRACTOR", `Did not scale Bond A's redemption value by ${k}.`),
          distractor(((step * a + ((1 + above) - k * (1 - below))) / ((k - 1) * a)) * 100, "CALCULATION_DISTRACTOR", "Did not discount the redemption values."),
          distractor((step / (k - 1)) * 100, "CALCULATION_DISTRACTOR", "Ignored the redemption values altogether."),
          distractor(((step * adue(years, i) + ((1 + above) - k * (1 - below)) * vn) / ((k - 1) * adue(years, i))) * 100, "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Two prices per unit of par.** With $${aSym(years, mpc(i))} = ${dec(a, 5)}$ and $v^{${years}} = ${dec(vn, 6)}$:
$$P = r(${dec(a, 5)}) + ${dec(1 - below, 2)}(${dec(vn, 6)}),\\qquad ${k}P = (r + ${step})(${dec(a, 5)}) + ${dec(1 + above, 2)}(${dec(vn, 6)}).$$

**Step 2 — Eliminate $P$.** $${dec(k - 1, 2)}(${dec(a, 5)})r = ${step}(${dec(a, 5)}) + (${dec(1 + above, 2)} - ${k}(${dec(1 - below, 2)}))(${dec(vn, 6)})$.

**Step 3 — Solve.** $r = ${dec(r, 6)}$, that is, ${(r * 100).toFixed(3)}%.`,
        checks: [{ label: "price ratio reproduced", ok: close((r + step) * a + (1 + above) * vn, k * (r * a + (1 - below) * vn), 1e-10) }, { label: "rate sensible", ok: r > 0 && r < 0.3 }],
      };
    },
  },

  {
    id: "FM_BOND_SAME_PRICE_SOLVE_YIELD",
    domain: BONDS,
    title: "Yield Rate of a Bond Priced against Another",
    objective: "Price one bond, then solve for the yield at which a related bond has the stated price.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [61, 271],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const F = 1000;
        const years = rng.int(10, 30);
        const r = gridRate(rng, 0.03, 0.08, 0.005);
        const y1 = gridRate(rng, 0.03, 0.08, 0.005);
        const C1 = rng.choice([1100, 1150, 1200, 1250]);
        const C2 = rng.choice([700, 750, 800, 850, 900]);
        const N = 2 * years;
        const P = bondPrice((F * r) / 2, C1, y1 / 2, N);
        const j = yieldFor(P, (F * r) / 2, C2, N);
        const key = 2 * j * 100;
        return {
          questionText: `Consider two ${years}-year bonds with the same purchase price. Each has an annual coupon rate of ${pc(r)} paid semiannually and a par value of ${n(F)}.
The first bond has an annual nominal yield rate of ${pc(y1)} compounded semiannually, and a redemption value of ${n(C1)}.
The second bond has an annual nominal yield rate of $j$ compounded semiannually, and a redemption value of ${n(C2)}.
Calculate $j$.`,
          variables: { variant: "REDEMPTION", F, years, r, y1, C1, C2 },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor(j * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual rate."),
            distractor((Math.pow(1 + j, 2) - 1) * 100, "NOMINAL_RATE_ERROR", "Compounded to an annual effective rate."),
            distractor(2 * yieldFor(bondPrice((F * r) / 2, F, y1 / 2, N), (F * r) / 2, C2, N) * 100, "CALCULATION_DISTRACTOR", "Priced the first bond as if redeemed at par."),
            distractor(((F * r) / C2) * 100, "CALCULATION_DISTRACTOR", "Took the yield as the annual coupon divided by the redemption value."),
          ],
          solutionSteps: `**Step 1 — Price of the first bond.** $P = ${mn((F * r) / 2, 2)}\\,${aSym(N, dec(y1 / 2, 4))} + ${mn(C1)}\\,v^{${N}} = ${mn(P, 2)}$.

**Step 2 — Second bond's yield.** Solve $${mn(P, 2)} = ${mn((F * r) / 2, 2)}\\,${aSym(N)} + ${mn(C2)}\\,v^{${N}}$ ${calculator(N, P, (F * r) / 2, C2)}: $j/2 = ${dec(j, 6)}$.

**Step 3 — Nominal rate.** $j = ${dec(2 * j, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "same price", ok: close(bondPrice((F * r) / 2, C2, j, N), P, 1e-9) }],
        };
      }
      const F = 1000;
      const { years, rA, iA, rB, D } = drawUntil(
        () => ({
          years: rng.int(3, 12),
          rA: gridRate(rng, 0.03, 0.08, 0.005),
          iA: gridRate(rng, 0.03, 0.07, 0.005),
          rB: gridRate(rng, 0.02, 0.07, 0.005),
          D: gridAmount(rng, 20, 150, 10),
        }),
        (p) => {
          const pa = bondPrice((F * p.rA) / 2, F, perPeriod(p.iA, 2), 2 * p.years);
          const ib = trySolve((x) => bondPrice(F * p.rB, F, x, p.years) - (pa - p.D), -0.2, 1);
          return p.rB < p.rA && ib > 0.015 && ib < 0.12 && Math.abs(ib - p.iA) > 0.004;
        },
        { years: 5, rA: 0.05, iA: 0.04, rB: 0.03, D: 100 }
      );
      const jA = perPeriod(iA, 2);
      const PA = bondPrice((F * rA) / 2, F, jA, 2 * years);
      const iB = yieldFor(PA - D, F * rB, F, years);
      return {
        questionText: `Bond A and Bond B are each ${word(years)}-year ${n(F)} face amount bonds. In addition:
(i) Bond A has ${couponText(rA, 2)}.
(ii) Bond B has ${couponText(rB, 1)}.
(iii) The price of Bond B is ${D} less than the price of Bond A.
(iv) The annual effective yield rate for Bond A is ${pc(iA)}.
Calculate the annual effective yield rate for Bond B.`,
        variables: { variant: "FREQUENCY", F, years, rA, iA, rB, D },
        correctValue: iB * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(yieldFor(bondPrice((F * rA) / 2, F, iA / 2, 2 * years) - D, F * rB, F, years) * 100, "NOMINAL_RATE_ERROR", "Halved the annual effective rate to get Bond A's semiannual rate."),
          distractor(yieldFor(PA + D, F * rB, F, years) * 100, "CALCULATION_DISTRACTOR", "Made Bond B's price higher instead of lower."),
          distractor(2 * yieldFor(PA - D, (F * rB) / 2, F, 2 * years) * 100, "CALCULATION_DISTRACTOR", "Treated Bond B's coupons as semiannual."),
          distractor((iA + (D / F) / years) * 100, "SIMPLE_INTEREST_ERROR", "Added the price difference per year to Bond A's yield."),
        ],
        solutionSteps: `**Step 1 — Bond A's price.** Its semiannual yield is $(1 + ${dec(iA, 4)})^{1/2} - 1 = ${dec(jA, 6)}$, so
$$P_A = ${mn((F * rA) / 2, 2)}\\,${aSym(2 * years)} + ${mn(F)}\\,v^{${2 * years}} = ${mn(PA, 2)}.$$

**Step 2 — Bond B's price.** $P_B = ${mn(PA, 2)} - ${D} = ${mn(PA - D, 2)}$.

**Step 3 — Bond B's yield.** Solve $${mn(PA - D, 2)} = ${mn(F * rB, 2)}\\,${aSym(years, "i")} + ${mn(F)}\\,v^{${years}}$ ${calculator(years, PA - D, F * rB, F)}: $i = ${dec(iB, 6)}$, that is, ${(iB * 100).toFixed(3)}%.`,
        checks: [{ label: "Bond B reprices", ok: close(bondPrice(F * rB, F, iB, years), PA - D, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_COMBINED_PRICE_COUPON",
    domain: BONDS,
    title: "Coupon Rate from a Combined Price",
    objective: "Split the combined price of two bonds whose coupon rates differ by a fixed margin.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [163, 317],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const params = drawUntil(
        () => {
          const F = rng.choice([1000, 1000, 5000]);
          const years = rng.int(10, 30);
          const i = gridRate(rng, 0.04, 0.1, 0.005);
          const delta = rng.choice([0.005, 0.01, 0.015, 0.02]);
          const total = gridAmount(rng, 1.2 * F, 3.2 * F, F / 20);
          const a = an(years, i);
          const rA = (total - 2 * F * v(i, years) - F * delta * a) / (2 * F * a);
          return { F, years, i, delta, total, rA };
        },
        (p) => p.rA > 0.02 && p.rA < 0.14,
        { F: 1000, years: 20, i: 0.1, delta: 0.01, total: 1600, rA: 0.0715 }
      );
      const { F, years, i, delta, total, rA } = params;
      const a = an(years, i);
      return {
        questionText: `A bank issues two ${years}-year bonds, A and B, each with annual coupons, an annual effective yield rate of ${pc(i)}, and a face amount of ${n(F)}. The total price of these two bonds is ${n(total)}.
Bond B's annual coupon rate is equal to Bond A's annual coupon rate plus ${pc(delta)}.
Calculate the annual coupon rate of Bond A.`,
        variables: { F, years, i, delta, total },
        correctValue: rA * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(((total / 2 - F * v(i, years)) / (F * a)) * 100, "CALCULATION_DISTRACTOR", "Gave the average coupon rate of the two bonds."),
          distractor(((total - 2 * F * v(i, years) + F * delta * a) / (2 * F * a)) * 100, "CALCULATION_DISTRACTOR", "Added the margin to Bond A instead of Bond B."),
          distractor(((total - 2 * F - F * delta * a) / (2 * F * a)) * 100, "CALCULATION_DISTRACTOR", "Did not discount the face amounts."),
          distractor(((total - 2 * F * v(i, years) - F * delta * adue(years, i)) / (2 * F * adue(years, i))) * 100, "ANNUITY_DUE_CONFUSION", "Valued the coupons as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Combined price.** With $${aSym(years, mpc(i))} = ${dec(a, 5)}$ and $v^{${years}} = ${dec(v(i, years), 6)}$:
$$${mn(total)} = 2(${mn(F)})v^{${years}} + ${mn(F)}(2r + ${delta})\\,${aSym(years, mpc(i))} = ${mn(2 * F * v(i, years), 3)} + ${mn(F * delta * a, 3)} + ${mn(2 * F * a, 3)}r.$$

**Step 2 — Solve.** $r = \\frac{${mn(total)} - ${mn(2 * F * v(i, years), 3)} - ${mn(F * delta * a, 3)}}{${mn(2 * F * a, 3)}} = ${dec(rA, 6)}$, that is, ${(rA * 100).toFixed(3)}%.`,
        checks: [{ label: "prices sum", ok: close(F * (rA * a + v(i, years)) + F * ((rA + delta) * a + v(i, years)), total, 1e-10) }],
      };
    },
  },

  {
    id: "FM_BOND_COUPON_FREQUENCY_TRIO",
    domain: BONDS,
    title: "Three Bonds with Different Coupon Frequencies",
    objective: "Recognise a par bond, recover the common term from a second bond, then solve a third bond's coupon.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [444, 455],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const mZ = rng.choice([2, 4]);
      const mY = mZ === 2 ? 4 : 2;
      const F = 1000;
      const y = gridRate(rng, 0.04, 0.09, 0.005);
      const years = rng.int(8, 25);
      const jZ = y / mZ;
      const cZ = F * jZ;
      const jY = Math.pow(1 + jZ, mZ / mY) - 1;
      const iX = Math.pow(1 + jZ, mZ) - 1;
      // Bond Y is priced above both others, as in the sample questions.
      const { cY, R } = drawUntil(
        () => ({ cY: gridAmount(rng, 10, 60, 1), R: gridAmount(rng, 20, 90, 1) + rng.choice([0, 0.25, 0.5, 0.75]) }),
        (p) => {
          const py = bondPrice(p.cY, F, jY, mY * years);
          const annualY = (p.cY * mY) / F;
          return (
            py - F > 20 &&
            py - bondPrice(p.R, F, iX, years) > 20 &&
            Math.abs(p.R - F * iX) > 5 &&
            annualY - y > 0.004 &&
            annualY - y < 0.03 &&
            Math.abs(p.R - F * iX) < 30
          );
        },
        { cY: Math.round((F * y) / mY) + 5, R: Math.round(F * iX) - 15 }
      );
      const PY = bondPrice(cY, F, jY, mY * years);
      const PX = bondPrice(R, F, iX, years);
      const d1 = cents(PY - PX);
      const d2 = cents(PY - F);
      const PYhat = F + d2;
      const nHat = Math.log(1 / ((cY / jY - PYhat) / (cY / jY - F))) / Math.log(1 + jY) / mY;
      const nRound = Math.round(nHat);
      const PXhat = PYhat - d1;
      const Rhat = (PXhat - F * v(iX, nRound)) / an(nRound, iX);
      const freqWord = (m: number) => (m === 2 ? "semiannual" : "quarterly");
      return {
        questionText: `Bond X, Bond Y, and Bond Z are each $n$-year bonds with face amount ${n(F)}. All three bonds are priced to yield a nominal annual interest rate of ${pc(y)} convertible ${frequency(mZ)}.
Bond X provides annual coupons of $R$, Bond Y provides ${freqWord(mY)} coupons of ${n(cY, 2)}, and Bond Z provides ${freqWord(mZ)} coupons of ${n(cZ, 2)}.
The price of Bond Y exceeds the price of Bond X by ${n(d1, 2)} and the price of Bond Y exceeds the price of Bond Z by ${n(d2, 2)}.
Calculate $R$.`,
        variables: { y, mZ, mY, cY, d1, d2, cZ },
        correctValue: Rhat,
        format: "AMOUNT_2",
        distractors: [
          distractor((PXhat - F * v(y, nRound)) / an(nRound, y), "NOMINAL_RATE_ERROR", "Priced Bond X at the nominal rate instead of the annual effective rate."),
          distractor((PYhat + d1 - F * v(iX, nRound)) / an(nRound, iX), "CALCULATION_DISTRACTOR", "Added the price difference instead of subtracting it."),
          distractor((PXhat - F * v(iX, nRound + 1)) / an(nRound + 1, iX), "OFF_BY_ONE_PERIOD", "Used one year too many."),
          distractor((F - d1 - F * v(iX, nRound)) / an(nRound, iX), "CALCULATION_DISTRACTOR", "Subtracted the price difference from Bond Z's price instead of Bond Y's."),
        ],
        solutionSteps: `**Step 1 — Bond Z sells at par.** Its coupon ${n(cZ, 2)} equals the face amount times the yield per period, so its price is ${n(F)} and Bond Y's price is $${mn(F)} + ${mn(d2, 2)} = ${mn(PYhat, 2)}$.

**Step 2 — The term from Bond Y.** Its yield per ${freqWord(mY) === "quarterly" ? "quarter" : "half-year"} is $(1 + ${dec(jZ, 5)})^{${fraction(mZ, mY)}} - 1 = ${dec(jY, 6)}$. Solving $${mn(PYhat, 2)} = ${mn(cY, 2)}\\,${aSym(`${mY}n`)} + ${mn(F)}v^{${mY}n}$ gives ${mY}n = ${(nHat * mY).toFixed(2)}$, so $n = ${nRound}$.

**Step 3 — Bond X.** Its price is $${mn(PYhat, 2)} - ${mn(d1, 2)} = ${mn(PXhat, 2)}$ and its annual yield is $(1 + ${dec(jZ, 5)})^{${mZ}} - 1 = ${dec(iX, 6)}$, so
$$R = \\frac{${mn(PXhat, 2)} - ${mn(F)}v^{${nRound}}}{${aSym(nRound, "i")}} = \\frac{${mn(PXhat - F * v(iX, nRound), 4)}}{${dec(an(nRound, iX), 5)}} = ${mn(Rhat, 2)}.$$`,
        checks: [
          { label: "term recovered", ok: Math.abs(nHat - years) < 0.02 },
          { label: "R recovered", ok: Math.abs(Rhat - R) < 0.02 },
        ],
      };
    },
  },

  {
    id: "FM_BOND_ZERO_COUPON_EQUIVALENT",
    domain: BONDS,
    title: "Coupon Rate as a Multiple of the Yield",
    objective: "Use price/face = k + (1 − k)vⁿ for a bond whose coupon rate is k times its yield, and link it to a zero-coupon bond.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [335, 352, 430, 416, 226, 297, 263],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["FACE", "MULTIPLE_TERM", "TERM_OF_COUPON", "TERM_OF_ZERO", "PREMIUM_TERM"] as const);
      if (variant === "FACE") {
        const P0 = gridAmount(rng, 500, 920, 10);
        const k = rng.choice([0.25, 0.5, 0.5, 0.75]);
        const vn = P0 / 1000;
        const F2 = P0 / (k + (1 - k) * vn);
        return {
          questionText: `A zero-coupon bond with a face value of 1000 sells for a price of ${n(P0)} and matures in $n$ years, where $n$ is a whole number.
A second bond has the same price, same time until maturity, and same annual effective yield. It pays annual coupons at an annual rate equal to ${pc(k)} of the annual effective yield rate.
Calculate the face value of the second bond.`,
          variables: { variant, P0, k },
          correctValue: F2,
          format: "AMOUNT_0",
          distractors: [
            distractor(P0 / (k * vn + (1 - k)), "CALCULATION_DISTRACTOR", "Swapped the weights on $v^n$ and 1."),
            distractor(1000 * (k + (1 - k) * vn), "CALCULATION_DISTRACTOR", "Priced the second bond with a face value of 1000 instead of solving for the face value."),
            distractor(P0 / (k * (1 - vn)), "CALCULATION_DISTRACTOR", "Left out the redemption value of the second bond."),
            distractor(P0 / vn - P0 * k, "CALCULATION_DISTRACTOR", "Subtracted the coupons from the zero-coupon face value."),
          ],
          solutionSteps: `**Step 1 — Discount factor.** From the zero-coupon bond, $v^n = ${mn(P0)}/1000 = ${dec(vn, 3)}$.

**Step 2 — Price per unit of face.** With coupon rate $${k}i$: $${k}i\\,${aSym("n", "i")} + v^n = ${k}(1 - v^n) + v^n = ${k} + ${1 - k}(${dec(vn, 3)}) = ${dec(k + (1 - k) * vn, 4)}$.

**Step 3 — Face value.** $F = ${mn(P0)}/${dec(k + (1 - k) * vn, 4)} = ${mn(F2, 2)}$.`,
          checks: [{ label: "same price", ok: close(F2 * (k + (1 - k) * vn), P0, 1e-12) }],
        };
      }
      if (variant === "MULTIPLE_TERM") {
        const F = 1000;
        const k = rng.choice([0.25, 0.5, 0.5, 0.75]);
        const P = drawUntil(() => gridAmount(rng, 600, 950, 10), (x) => (x / F - k) / (1 - k) > 0.3 && (x / F - k) / (1 - k) < 0.93, 800);
        const vm = (P / F - k) / (1 - k);
        const q = rng.choice([2, 3]);
        const key = F * (k + (1 - k) * Math.pow(vm, q));
        return {
          questionText: `Bond A and bond B are both annual-coupon bonds.
Bond A is an $m$-year bond with face amount ${n(F)} and price ${n(P)}, where $m$ is a whole number. The coupon rate is ${k === 0.5 ? "half" : pc(k)} of the yield rate.
Bond B is a ${q}$m$-year bond with the same face amount, coupon rate, and yield rate as bond A.
Calculate the price for bond B.`,
          variables: { variant, F, P, k, q },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(F * Math.pow(P / F, q), "CALCULATION_DISTRACTOR", `Raised the price ratio to the power ${q} as if the bond had no coupons.`),
            distractor(F * (k + (1 - k) * Math.pow(vm, q - 1)), "OFF_BY_ONE_PERIOD", `Used $v^{${q - 1}m}$ instead of $v^{${q}m}$.`),
            distractor(F * (k * (1 - Math.pow(vm, q)) + Math.pow(vm, q)) - F * k * (1 - vm), "CALCULATION_DISTRACTOR", "Subtracted Bond A's coupon value."),
            distractor(F * ((1 - k) + k * Math.pow(vm, q)), "CALCULATION_DISTRACTOR", "Swapped the weights on $v^n$ and 1."),
          ],
          solutionSteps: `**Step 1 — Price per unit of face.** With coupon rate $${k}i$, $\\text{price}/F = ${k}(1 - v^m) + v^m = ${k} + ${1 - k}v^m$.

**Step 2 — Bond A.** $${dec(P / F, 3)} = ${k} + ${1 - k}v^m$, so $v^m = ${dec(vm, 5)}$.

**Step 3 — Bond B.** $${mn(F)}(${k} + ${1 - k}(${dec(vm, 5)})^{${q}}) = ${mn(key, 2)}$.`,
          checks: [{ label: "bond A reproduced", ok: close(F * (k + (1 - k) * vm), P, 1e-12) }],
        };
      }
      // Fractions k = (p - p^q)/(1 - p^q) with p = a/b, computed exactly.
      const bases: [number, number][] = [[4, 5], [3, 4], [9, 10], [3, 5], [7, 10]];
      const [a, b] = rng.choice(bases);
      const q = rng.choice([2, 3]);
      const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
      if (variant === "TERM_OF_COUPON" || variant === "TERM_OF_ZERO") {
        // k = (a/b - (a/b)^q)/(1 - (a/b)^q) = a(b^(q-1) - a^(q-1)) / (b^q - a^q)
        let kNum = a * (Math.pow(b, q - 1) - Math.pow(a, q - 1));
        let kDen = Math.pow(b, q) - Math.pow(a, q);
        const g = gcd(kNum, kDen);
        kNum /= g;
        kDen /= g;
        const p = a / b;
        const nZero = rng.int(4, 15);
        const kFrac = `\\frac{${kNum}}{${kDen}}`;
        if (variant === "TERM_OF_COUPON") {
          const key = q * nZero;
          return {
            questionText: `The price of a ${nZero}-year zero-coupon bond is ${pc(p)} of its face value.
A second bond, with the same price, same face value, and same annual effective yield rate, offers annual coupons with the coupon rate equal to $${kFrac}$ of the annual effective yield rate.
Calculate the number of years until maturity for the second bond.`,
            variables: { variant, nZero, p, kNum, kDen },
            correctValue: key,
            format: "AMOUNT_0",
            distractors: [
              distractor(nZero, "CALCULATION_DISTRACTOR", "Assumed the coupon bond has the same term as the zero-coupon bond."),
              distractor((q + 1) * nZero, "CALCULATION_DISTRACTOR", "Took one power too many."),
              distractor(Math.round(nZero / (1 - kNum / kDen)), "CALCULATION_DISTRACTOR", "Scaled the term by $1/(1 - k)$."),
              distractor(q * nZero - q, "CALCULATION_DISTRACTOR", "Dropped a year per power."),
            ],
            solutionSteps: `**Step 1 — Discount factor.** $v^{${nZero}} = ${dec(p, 2)}$.

**Step 2 — Coupon bond.** Price per unit of face is $k + (1 - k)v^m$ with $k = ${kFrac}$:
$$${dec(p, 2)} = ${kFrac} + \\frac{${kDen - kNum}}{${kDen}}v^m \\Rightarrow v^m = \\frac{${dec(p, 2)} - ${dec(kNum / kDen, 6)}}{${dec(1 - kNum / kDen, 6)}} = ${dec(Math.pow(p, q), 6)} = (${dec(p, 2)})^{${q}}.$$

**Step 3 — Term.** $v^m = (v^{${nZero}})^{${q}}$, so $m = ${key}$.`,
            checks: [{ label: "identity holds", ok: close(kNum / kDen + (1 - kNum / kDen) * Math.pow(p, q), p, 1e-12) }],
          };
        }
        const N = q * nZero;
        return {
          questionText: `A ${N}-year bond, with a price equal to ${pc(Math.pow(p, 1))} of its face value, offers annual coupons with the coupon rate equal to $\\frac{${kNum}}{${kDen}}$ of the annual effective yield rate.
An $n$-year zero-coupon bond has the same price, face value, and yield rate.
Calculate $n$.`.replace("equal to $\\frac", "equal to $\\frac"),
          variables: { variant, N, p, kNum, kDen },
          correctValue: nZero,
          format: "AMOUNT_0",
          distractors: [
            distractor(N, "CALCULATION_DISTRACTOR", "Assumed the zero-coupon bond has the same term."),
            distractor(Math.round(N / (q + 1)), "CALCULATION_DISTRACTOR", "Took one power too many."),
            distractor(Math.round(N * (1 - kNum / kDen)), "CALCULATION_DISTRACTOR", "Scaled the term by $1 - k$."),
            distractor(nZero + q, "CALCULATION_DISTRACTOR", "Added a year per power."),
          ],
          solutionSteps: `**Step 1 — Coupon bond.** Price per unit of face is $k + (1 - k)v^{${N}}$:
$$${dec(p, 2)} = \\frac{${kNum}}{${kDen}} + \\frac{${kDen - kNum}}{${kDen}}v^{${N}} \\Rightarrow v^{${N}} = ${dec(Math.pow(p, q), 6)} = (${dec(p, 2)})^{${q}}.$$

**Step 2 — Zero-coupon bond.** Its price gives $v^n = ${dec(p, 2)}$.

**Step 3 — Term.** $v^{${N}} = (v^n)^{${q}}$, so $n = ${N}/${q} = ${nZero}$.`,
          checks: [{ label: "identity holds", ok: close(kNum / kDen + (1 - kNum / kDen) * Math.pow(p, q), p, 1e-12) }],
        };
      }
      // PREMIUM_TERM: coupon rate k times the yield, two terms whose prices are given.
      const k = rng.choice([1.5, 2, 2.5, 3]);
      const base = rng.choice([0.6, 0.7, 0.8, 0.9]);
      const unit = rng.int(3, 8);
      const q1 = 3;
      const q2 = rng.choice([1, 2]);
      const prem1 = Number(((k - 1) * (1 - Math.pow(base, q1))).toFixed(6));
      const prem2 = Number(((k - 1) * (1 - Math.pow(base, q2))).toFixed(6));
      const N = q1 * unit;
      const key = q2 * unit;
      return {
        questionText: `A ${N}-year bond, with a price ${pc(prem1)} higher than its face value, offers annual coupons with the coupon rate equal to ${k} times the annual effective yield rate.
An $n$-year bond, with the same face value, coupon rate, and yield rate, sells for a price that is ${pc(prem2)} higher than its face value.
Calculate $n$.`,
        variables: { variant, N, prem1, k, prem2 },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(Math.round((N * prem2) / prem1), "SIMPLE_INTEREST_ERROR", "Scaled the term in proportion to the premium."),
          distractor(key + unit, "OFF_BY_ONE_PERIOD", "Took one power too many."),
          distractor(key === unit ? key + 2 * unit : key - unit, "OFF_BY_ONE_PERIOD", key === unit ? "Took two powers too many." : "Took one power too few."),
          distractor(N - key, "CALCULATION_DISTRACTOR", "Gave the difference between the terms."),
        ],
        solutionSteps: `**Step 1 — Price per unit of face.** With coupon rate $${k}i$, $\\text{price}/F = ${k} - ${dec(k - 1, 1)}v^n$, so the premium is $${dec(k - 1, 1)}(1 - v^n)$.

**Step 2 — First bond.** $${dec(prem1, 4)} = ${dec(k - 1, 1)}(1 - v^{${N}})$, so $v^{${N}} = ${dec(Math.pow(base, q1), 6)}$ and $v^{${unit}} = ${dec(base, 2)}$.

**Step 3 — Second bond.** $${dec(prem2, 4)} = ${dec(k - 1, 1)}(1 - v^n)$, so $v^n = ${dec(Math.pow(base, q2), 4)} = (${dec(base, 2)})^{${q2}}$ and $n = ${key}$.`,
        checks: [{ label: "premium identity", ok: Math.abs(prem1 - (k - 1) * (1 - Math.pow(base, q1))) < 1e-9 }],
      };
    },
  },
];
