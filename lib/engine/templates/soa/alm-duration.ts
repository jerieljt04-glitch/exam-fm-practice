/**
 * Duration and convexity: Macaulay and modified duration of cash flows,
 * bonds, loans, annuities and perpetuities, portfolio duration, convexity,
 * and the first-order Macaulay and modified approximations — modelled on the
 * SOA sample-set question types for this part of the syllabus.
 */
import type { Rng } from "../../random";
import {
  distractor,
  type GeneratedChoiceQuestionItem,
  type GeneratedQuestionItem,
  type QuestionTemplateDefinition,
} from "../types";
import {
  adue,
  an,
  bondFlows,
  close,
  dec,
  drawUntil,
  gridAmount,
  gridRate,
  listing,
  macaulay,
  macaulayConvexity,
  mn,
  modified,
  modifiedConvexity,
  n,
  oneOfFive,
  pc,
  pv,
  romanStatements,
  solve,
  table,
  v,
  word,
  type Flow,
  type StatementPair,
} from "./kit";

const ALM = "ALM_IMMUNIZATION" as const;

/** Time-weighted present value, the numerator of Macaulay duration. */
const weighted = (flows: readonly Flow[], i: number) => flows.reduce((s, [t, a]) => s + t * a * v(i, t), 0);

/** Macaulay duration of a geometric perpetuity-immediate with first payment 1 and growth g. */
const perpetuityMac = (i: number, g = 0) => (1 + i) / (i - g);

/** Flows written as prose: "40,000 at time 2, 25,000 at time 3, and 100,000 at time 4". */
const flowProse = (flows: readonly Flow[]) => listing(flows.map(([t, a]) => `${n(a)} at time ${t}`));

export const SOA_ALM_DURATION_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ALM_DURATION_OF_FLOWS",
    domain: ALM,
    title: "Duration of a Set of Cash Flows",
    objective: "Compute the Macaulay or modified duration of cash flows, a bond, a level-payment loan, or a portfolio of zero-coupon bonds.",
    difficulty: 1,
    topics: ["IMMUNIZATION"],
    steps: 2,
    soaSamples: [101, 228, 50, 372, 429, 183, 409, 260],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["FLOWS", "FLOWS", "BOND", "LOAN", "ZEROS"] as const);
      if (variant === "ZEROS") {
        const terms = [1, 2, 3];
        const yields = terms.map(() => gridRate(rng, 0.03, 0.08, 0.005));
        const redemption = terms.map(() => rng.choice([1000, 1000, 1050, 1100]));
        const prices = terms.map((t, k) => Number((redemption[k] * v(yields[k], t)).toFixed(2)));
        const counts = terms.map(() => gridAmount(rng, 5, 40, 5));
        const values = prices.map((p, k) => p * counts[k]);
        const total = values.reduce((s, x) => s + x, 0);
        const key = values.reduce((s, x, k) => s + x * terms[k], 0) / total;
        return {
          questionText: `The table below defines available zero-coupon bonds and their prices:
${table(["Years to maturity", "Bond price per bond", "Redemption value per bond"], terms.map((t, k) => [String(t), mn(prices[k], 2), mn(redemption[k])]))}
A company chooses to purchase ${listing(terms.map((t, k) => `${counts[k]} ${word(t)}-year zero-coupon bonds`))}.
Calculate the Macaulay duration of this portfolio.`,
          variables: { variant, prices, redemption, counts },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(counts.reduce((s, c, k) => s + c * terms[k], 0) / counts.reduce((s, c) => s + c, 0), "CALCULATION_DISTRACTOR", "Weighted the maturities by the number of bonds instead of their value."),
            distractor(counts.reduce((s, c, k) => s + c * redemption[k] * terms[k], 0) / counts.reduce((s, c, k) => s + c * redemption[k], 0), "CALCULATION_DISTRACTOR", "Weighted the maturities by redemption value instead of price."),
            distractor(key / (1 + yields.reduce((s, y) => s + y, 0) / 3), "CALCULATION_DISTRACTOR", "Divided by one plus the average yield, a modified duration."),
            distractor(2, "CALCULATION_DISTRACTOR", "Took the middle maturity."),
          ],
          solutionSteps: `**Step 1 — Market value of each holding.** ${terms.map((t, k) => `${counts[k]}(${n(prices[k], 2)}) = ${n(values[k], 2)}`).join("; ")}; total ${n(total, 2)}.

**Step 2 — Weighted maturity.** A zero-coupon bond's duration is its term, so the portfolio's duration is the value-weighted average term:
$$\\frac{${terms.map((t, k) => `${t}(${mn(values[k], 2)})`).join(" + ")}}{${mn(total, 2)}} = ${dec(key, 4)}.$$`,
          checks: [{ label: "between shortest and longest", ok: key > 1 && key < 3 }],
        };
      }
      const i = gridRate(rng, 0.03, 0.12, 0.005);
      let flows: Flow[];
      let stem: string;
      let variables: Record<string, number | string | number[]>;
      let periodsPerYear = 1;
      let yieldForDuration = i;
      let askModified = variant !== "LOAN" && rng.next() < 0.35;
      if (variant === "FLOWS") {
        const count = rng.int(3, 5);
        const start = rng.int(1, 3);
        const times = Array.from({ length: count }, (_, k) => start + k);
        const scale = rng.choice([1, 1000]);
        const amounts = times.map(() => gridAmount(rng, 10, 100, 5) * scale);
        flows = times.map((t, k) => [t, amounts[k]] as const);
        stem =
          rng.next() < 0.5
            ? `Cash flows are ${flowProse(flows)} (in years). The annual effective yield rate is ${pc(i)}.
Calculate the ${askModified ? "modified" : "Macaulay"} duration.`
            : `An insurer has a liability that is expected to result in the following cash outflows:
${table(["End of year", "Cash outflow"], flows.map(([t, a]) => [String(t), mn(a)]))}
The insurer uses an annual effective interest rate of ${pc(i)} to discount future cash flows.
Calculate the ${askModified ? "modified" : "Macaulay"} duration of this liability.`;
        variables = { variant, times, amounts, i, ask: askModified ? "MOD" : "MAC" };
      } else if (variant === "BOND") {
        const semi = rng.next() < 0.4;
        const F = rng.choice([1000, 5000, 10000]);
        const years = rng.int(3, 15);
        if (semi) {
          // Bought at par, so the yield per half-year equals the coupon rate per half-year.
          const r = gridRate(rng, 0.03, 0.1, 0.002);
          periodsPerYear = 2;
          yieldForDuration = r / 2;
          // Semiannual bonds are asked for Macaulay duration only, as in the sample set.
          askModified = false;
          flows = bondFlows((F * r) / 2, F, 2 * years);
          stem = `An investor bought a ${years}-year, ${n(F)} par value bond with an annual coupon rate of ${pc(r)} paid semiannually, with no premium or discount.
Calculate the Macaulay duration of this bond, in years, with respect to the yield rate on the bond.`;
          variables = { variant, semi: 1, F, years, r, i: r, ask: "MAC" };
        } else {
          const r = gridRate(rng, 0.03, 0.12, 0.005);
          flows = bondFlows(F * r, F, years);
          stem = `A ${n(F)} face amount bond with an annual coupon rate of ${pc(r)} paid annually matures in ${word(years)} years. The annual effective yield rate is ${pc(i)}.
Calculate the ${askModified ? "modified" : "Macaulay"} duration of this bond.`;
          variables = { variant, semi: 0, F, years, r, i, ask: askModified ? "MOD" : "MAC" };
        }
      } else {
        const years = rng.int(4, 30);
        flows = Array.from({ length: years }, (_, k) => [k + 1, 1] as const);
        stem = `A ${word(years)}-year loan is to be repaid with level payments made at the end of each year. The annual effective interest rate is ${pc(i)}.
Calculate the Macaulay duration of the loan payments.`;
        variables = { variant, years, i, ask: "MAC" };
      }
      const macPeriods = macaulay(flows, yieldForDuration);
      const mac = macPeriods / periodsPerYear;
      const key = askModified ? mac / (1 + i) : mac;
      const undiscounted = flows.reduce((s, [t, a]) => s + t * a, 0) / flows.reduce((s, [, a]) => s + a, 0) / periodsPerYear;
      return {
        questionText: stem,
        variables,
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor(askModified ? mac : mac / (1 + yieldForDuration * periodsPerYear), "CALCULATION_DISTRACTOR", askModified ? "Gave the Macaulay duration." : "Gave the modified duration."),
          distractor(undiscounted, "CALCULATION_DISTRACTOR", "Weighted the times by undiscounted cash flows."),
          ...(periodsPerYear === 2 ? [distractor(macPeriods, "NOMINAL_RATE_ERROR", "Left the duration in half-years.")] : []),
          ...(variant === "LOAN" ? [distractor((flows.length + 1) / 2, "SIMPLE_INTEREST_ERROR", "Took the average payment time.")] : []),
          distractor(weighted(flows, yieldForDuration) / flows.reduce((s, [, a]) => s + a, 0) / periodsPerYear, "CALCULATION_DISTRACTOR", "Divided the time-weighted present value by the undiscounted total."),
        ],
        solutionSteps: `**Step 1 — Present value and time-weighted present value.** ${periodsPerYear === 2 ? `Per half-year the yield is ${dec(yieldForDuration, 4)}. ` : ""}With $v = 1/${dec(1 + yieldForDuration, 4)}$:
$$\\sum CF_t\\,v^t = ${mn(pv(flows, yieldForDuration), 4)},\\qquad \\sum t\\,CF_t\\,v^t = ${mn(weighted(flows, yieldForDuration), 4)}.$$

**Step 2 — Duration.** Macaulay duration $= ${mn(weighted(flows, yieldForDuration), 4)}/${mn(pv(flows, yieldForDuration), 4)} = ${dec(macPeriods, 4)}$${periodsPerYear === 2 ? ` half-years, or ${dec(mac, 4)} years` : ""}.${askModified ? ` Modified duration $= ${dec(mac, 4)}/${dec(1 + i, 3)} = ${dec(key, 4)}$.` : ""}`,
        checks: [{ label: "duration within term", ok: key > 0 && mac <= flows[flows.length - 1][0] / periodsPerYear + 1e-9 }],
      };
    },
  },

  {
    id: "FM_ALM_DURATION_CONVERSION",
    domain: ALM,
    title: "Converting between Duration Measures",
    objective: "Move between Macaulay duration, modified duration and the price derivative, recovering the yield rate when it is not given.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 2,
    soaSamples: [30, 353, 227, 383, 102, 411, 375],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["DERIVATIVE", "ZERO", "TWO_FLOWS", "PERP_DUE", "PERP_IMM", "TWO_BONDS"] as const);
      if (variant === "DERIVATIVE") {
        const P = rng.choice([100, 950, 1000, 1050, 5000]);
        const i = gridRate(rng, 0.03, 0.1, 0.005);
        const Dmod = gridRate(rng, 3, 12, 0.05);
        const deriv = -Math.round(P * Dmod);
        const key = (-deriv * (1 + i)) / P;
        return {
          questionText: `The current price of an annual coupon bond is ${n(P)}. The yield to maturity is an annual effective rate of ${pc(i)}. The derivative of the price of the bond with respect to the yield to maturity is $${mn(deriv)}$.
Using the bond's yield rate, calculate the Macaulay duration of the bond in years.`,
          variables: { variant, P, i, deriv },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(-deriv / P, "CALCULATION_DISTRACTOR", "Gave the modified duration."),
            distractor(-deriv / P / (1 + i), "CALCULATION_DISTRACTOR", "Divided by $1 + i$ instead of multiplying."),
          ],
          solutionSteps: `**Step 1 — Modified duration.** $-P'(i)/P(i) = ${mn(-deriv)}/${mn(P)} = ${dec(-deriv / P, 4)}$.

**Step 2 — Macaulay duration.** Multiply by $1 + i$: $${dec(-deriv / P, 4)}(${dec(1 + i, 3)}) = ${dec(key, 4)}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      if (variant === "ZERO") {
        const T = rng.int(3, 15);
        const P = gridAmount(rng, 500, 950, 50);
        const F = drawUntil(() => gridAmount(rng, 1000, 2000, 50), (f) => {
          const i = Math.pow(f / P, 1 / T) - 1;
          return i > 0.015 && i < 0.12;
        }, 1200);
        const i = Math.pow(F / P, 1 / T) - 1;
        const key = T / (1 + i);
        return {
          questionText: `An investor purchases a ${n(F)} face amount zero-coupon bond for a price of ${n(P)}. With respect to the bond's annual effective yield rate, the Macaulay duration is ${word(T)} years and the modified duration is $d$ years.
Calculate $d$.`,
          variables: { variant, F, P, T },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(T * (1 + i), "CALCULATION_DISTRACTOR", "Multiplied by $1 + i$ instead of dividing."),
            distractor(T / (F / P), "CALCULATION_DISTRACTOR", "Divided by the total growth over the term instead of one year's."),
            distractor(T - 1, "OFF_BY_ONE_PERIOD", "Subtracted a year."),
          ],
          solutionSteps: `**Step 1 — Yield.** $(1 + i)^{${T}} = ${mn(F)}/${mn(P)}$, so $i = ${dec(i, 6)}$.

**Step 2 — Modified duration.** A zero-coupon bond's Macaulay duration is its term, ${T}; $d = ${T}/${dec(1 + i, 6)} = ${dec(key, 4)}$.`,
          checks: [{ label: "less than term", ok: key < T }],
        };
      }
      if (variant === "TWO_FLOWS") {
        const A = gridAmount(rng, 10000, 50000, 5000);
        const B = gridAmount(rng, 50000, 200000, 10000);
        const T = rng.int(3, 10);
        const iTrue = gridRate(rng, 0.03, 0.1, 0.005);
        const D = Number(((T * B * v(iTrue, T)) / (A + B * v(iTrue, T))).toFixed(2));
        const vT = (D * A) / (B * (T - D));
        const i = Math.pow(vT, -1 / T) - 1;
        const key = D / (1 + i);
        return {
          questionText: `A company's liabilities are ${n(A)} today and ${n(B)} ${word(T)} years from today. The Macaulay duration of the company's liabilities with respect to the market annual effective yield rate is ${n(D, 2)} years.
Calculate the modified duration of the company's liabilities, in years.`,
          variables: { variant, A, B, T, D },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(D * (1 + i), "CALCULATION_DISTRACTOR", "Multiplied by $1 + i$ instead of dividing."),
            distractor(T / (1 + i), "CALCULATION_DISTRACTOR", "Gave the modified duration of the later payment alone."),
            distractor(D / Math.pow(1 + i, T), "CALCULATION_DISTRACTOR", `Divided by $(1 + i)^{${T}}$.`),
            distractor((T * B) / (A + B) / (1 + i), "CALCULATION_DISTRACTOR", "Weighted by undiscounted amounts."),
          ],
          solutionSteps: `**Step 1 — Recover the yield.** $\\frac{${T}(${mn(B)})v^{${T}}}{${mn(A)} + ${mn(B)}v^{${T}}} = ${n(D, 2)}$ gives $v^{${T}} = \\frac{${n(D, 2)}(${mn(A)})}{${mn(B)}(${T} - ${n(D, 2)})} = ${dec(vT, 6)}$, so $i = ${dec(i, 6)}$.

**Step 2 — Modified duration.** $${n(D, 2)}/${dec(1 + i, 6)} = ${dec(key, 4)}$.`,
          checks: [{ label: "yield recovered", ok: Math.abs(i - iTrue) < 0.003 }],
        };
      }
      if (variant === "PERP_DUE" || variant === "PERP_IMM") {
        const due = variant === "PERP_DUE";
        const given = gridAmount(rng, 8, 40, 1);
        // Perpetuity-due: Macaulay = 1/i. Perpetuity-immediate: modified = 1/i.
        const i = 1 / given;
        const key = due ? given / (1 + i) : given + 1;
        return {
          questionText: due
            ? `A perpetuity provides a payment of 1 at the beginning of each year. The perpetuity's Macaulay duration is ${given} years.
Calculate the modified duration of this perpetuity.`
            : `A perpetuity provides a payment of 1 at the end of each year. The perpetuity's modified duration is ${given} years.
Calculate the Macaulay duration of this perpetuity.`,
          variables: { variant, given },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: due
            ? [
                distractor(given - 1, "CALCULATION_DISTRACTOR", "Subtracted one year."),
                distractor(given * (1 + i), "CALCULATION_DISTRACTOR", "Multiplied by $1 + i$."),
                distractor(given / (1 + 1 / (given + 1)), "CALCULATION_DISTRACTOR", "Used the perpetuity-immediate relation $D = (1+i)/i$ to find the rate."),
              ]
            : [
                distractor(given, "CALCULATION_DISTRACTOR", "Assumed the two durations are equal."),
                distractor(given / (1 + 1 / given), "CALCULATION_DISTRACTOR", "Divided by $1 + i$ instead of multiplying."),
              ],
          solutionSteps: due
            ? `**Step 1 — Rate.** For a perpetuity-due, $\\sum t v^t / \\sum v^t = v/(1 - v) = 1/i$, so $i = 1/${given} = ${dec(i, 6)}$.

**Step 2 — Modified duration.** $${given}/(1 + ${dec(i, 6)}) = ${dec(key, 4)}$.`
            : `**Step 1 — Rate.** For a perpetuity-immediate the price is $1/i$, so the modified duration $-P'/P = 1/i$, giving $i = 1/${given}$.

**Step 2 — Macaulay duration.** $(1 + i)/i = ${given} + 1 = ${key}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      // The printed modified duration belongs to the longer bond and is larger
      // than the shorter bond's Macaulay duration, so only one pairing gives r > 0.
      const { d1, d2, r } = drawUntil(
        () => {
          const d1 = rng.int(3, 12);
          return { d1, d2: d1 + rng.int(1, 4), r: gridRate(rng, 0.02, 0.08, 0.005) };
        },
        (p) => p.d2 / (1 + p.r) > p.d1 + 0.05,
        { d1: 5, d2: 6, r: 0.0417 }
      );
      const givenIsSecond = true;
      const m = Number((d2 / (1 + r)).toFixed(2));
      const onePlusR = (givenIsSecond ? d2 : d1) / m;
      const key = (givenIsSecond ? d1 : d2) / onePlusR;
      return {
        questionText: `Two bonds have the same annual effective yield rate, $r$, where $r > 0$. The bonds have Macaulay durations of ${d1} years and ${d2} years with respect to $r$. One of the bonds has a modified duration of ${n(m, 2)} years while the other bond has a modified duration of $d$ years.
Calculate $d$.`,
        variables: { variant, d1, d2, m },
        correctValue: key,
        format: "AMOUNT_3",
        distractors: [
          distractor((givenIsSecond ? d1 : d2) * onePlusR, "CALCULATION_DISTRACTOR", "Multiplied by $1 + r$ instead of dividing."),
          distractor(m - (d2 - d1) * (givenIsSecond ? 1 : -1), "CALCULATION_DISTRACTOR", "Shifted the modified duration by the difference in Macaulay durations."),
          distractor(((givenIsSecond ? d2 : d1) * m) / (givenIsSecond ? d1 : d2), "CALCULATION_DISTRACTOR", "Paired the given modified duration with the wrong bond."),
        ],
        solutionSteps: `**Step 1 — Which bond.** $1 + r = D_{mac}/D_{mod}$ must exceed 1. With ${n(m, 2)}: $${givenIsSecond ? d2 : d1}/${n(m, 2)} = ${dec(onePlusR, 6)}$ works${(givenIsSecond ? d1 : d2) / m > 1 ? "" : `, while $${givenIsSecond ? d1 : d2}/${n(m, 2)} < 1$ does not`}.

**Step 2 — Other bond.** $d = ${givenIsSecond ? d1 : d2}/${dec(onePlusR, 6)} = ${dec(key, 4)}$.`,
        checks: [{ label: "one-plus-r above 1", ok: onePlusR > 1 && ((givenIsSecond ? d1 : d2) / m <= 1 || !givenIsSecond) }],
      };
    },
  },

  {
    id: "FM_ALM_DURATION_PERPETUITY",
    domain: ALM,
    title: "Duration of Perpetuities",
    objective: "Use the closed forms for the duration of level, growing, deferred and perpetuity-due payments, and recover the rate from a given duration.",
    difficulty: 2,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 2,
    soaSamples: [31, 32, 195, 144, 387, 447, 423, 376],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["LEVEL", "GROWING", "DEFERRED", "RATE_CHANGE", "DUE_GEOMETRIC", "PERP_VS_DUE", "ZERO_TWICE", "ZERO_THEN_ANNUITY"] as const);
      if (variant === "LEVEL" || variant === "GROWING") {
        const i = gridRate(rng, 0.04, 0.12, 0.005);
        const g = variant === "GROWING" ? gridRate(rng, 0.01, i - 0.02, 0.005) : 0;
        const key = perpetuityMac(i, g);
        return {
          questionText: variant === "LEVEL"
            ? `A common stock pays a constant dividend at the end of each year into perpetuity.
Using an annual effective interest rate of ${pc(i)}, calculate the Macaulay duration of the stock.`
            : `A common stock pays dividends at the end of each year into perpetuity. Assume that the dividend increases by ${pc(g)} each year.
Using an annual effective interest rate of ${pc(i)}, calculate the Macaulay duration of the stock in years.`,
          variables: { variant, i, g },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(1 / (i - g), "CALCULATION_DISTRACTOR", "Gave the modified duration."),
            ...(variant === "GROWING" ? [distractor((1 + i) / i, "CALCULATION_DISTRACTOR", "Ignored the growth.")] : []),
            distractor((1 + g) / (i - g), "ANNUITY_DUE_CONFUSION", "Used the perpetuity-due formula."),
            distractor((1 + i) / (i + g), "CALCULATION_DISTRACTOR", "Added the growth rate instead of subtracting it."),
          ],
          solutionSteps: `**Step 1 — Price and derivative.** With payments $(1+g)^{t-1}$ at $t = 1, 2, \\ldots$, the price is $P = 1/(i - g)$, so $-P'/P = 1/(i - g)$.

**Step 2 — Macaulay duration.** Multiply by $1 + i$: $\\frac{${dec(1 + i, 3)}}{${dec(i - g, 3)}} = ${dec(key, 4)}$.`,
          checks: [{ label: "series agrees", ok: close(weighted(Array.from({ length: 4000 }, (_, k) => [k + 1, Math.pow(1 + g, k)] as const), i) / pv(Array.from({ length: 4000 }, (_, k) => [k + 1, Math.pow(1 + g, k)] as const), i), key, 1e-6) }],
        };
      }
      if (variant === "DEFERRED") {
        const i = gridRate(rng, 0.04, 0.12, 0.005);
        const k = rng.int(2, 10);
        const mac = k - 1 + perpetuityMac(i);
        const key = mac / (1 + i);
        return {
          questionText: `A company's preferred stock will pay level annual dividends forever, with the first dividend ${word(k)} years from now.
Using an annual effective interest rate of ${pc(i)}, the modified duration of the stock is $D$.
Calculate $D$.`,
          variables: { variant, i, k },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(mac, "CALCULATION_DISTRACTOR", "Gave the Macaulay duration."),
            distractor((k + perpetuityMac(i)) / (1 + i), "OFF_BY_ONE_PERIOD", `Deferred by ${k} years instead of ${k - 1}.`),
            distractor(perpetuityMac(i) / (1 + i), "CALCULATION_DISTRACTOR", "Ignored the deferral."),
            distractor((k - 2 + perpetuityMac(i)) / (1 + i), "OFF_BY_ONE_PERIOD", `Deferred by ${k - 2} years instead of ${k - 1}.`),
          ],
          solutionSteps: `**Step 1 — Macaulay duration.** Deferring every payment by ${k - 1} years adds ${k - 1} to the duration of a perpetuity-immediate: $${k - 1} + \\frac{${dec(1 + i, 3)}}{${dec(i, 3)}} = ${dec(mac, 4)}$.

**Step 2 — Modified duration.** $${dec(mac, 4)}/${dec(1 + i, 3)} = ${dec(key, 4)}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      if (variant === "RATE_CHANGE") {
        const D = Number((gridAmount(rng, 90, 300, 1) / 10).toFixed(1));
        const i = 1 / (D - 1);
        const factor = rng.choice([2, 2, 0.5, 1.5]);
        const key = perpetuityMac(factor * i);
        const factorText = factor === 2 ? "2i" : factor === 0.5 ? "i/2" : "1.5i";
        return {
          questionText: `An investor buys a perpetuity-immediate providing annual payments of 1, with an annual effective interest rate of $i$ and Macaulay duration of ${n(D, 1)} years.
Calculate the Macaulay duration in years using an annual effective interest rate of $${factorText}$ instead of $i$.`,
          variables: { variant, D, factor },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(D / factor, "CALCULATION_DISTRACTOR", `Divided the duration by ${factor}.`),
            distractor(1 / (factor * i), "CALCULATION_DISTRACTOR", "Gave the modified duration at the new rate."),
            distractor(perpetuityMac(factor / D), "CALCULATION_DISTRACTOR", "Took $i$ as the reciprocal of the duration."),
            distractor(D, "CALCULATION_DISTRACTOR", "Assumed duration does not depend on the rate."),
          ],
          solutionSteps: `**Step 1 — Rate.** $(1 + i)/i = ${n(D, 1)}$, so $1/i = ${n(D - 1, 1)}$ and $i = ${dec(i, 6)}$.

**Step 2 — New duration.** At $${dec(factor * i, 6)}$: $\\frac{1 + ${dec(factor * i, 6)}}{${dec(factor * i, 6)}} = ${dec(key, 4)}$.`,
          checks: [{ label: "rate positive", ok: i > 0 }],
        };
      }
      if (variant === "DUE_GEOMETRIC") {
        const g = -rng.choice([0.005, 0.01, 0.015, 0.02, 0.03]);
        const params = drawUntil(() => gridAmount(rng, 16, 40, 1) / 2, (D) => {
          const i = (1 + g) / D + g;
          return i > 0.02 && i < 0.12;
        }, 12);
        const D = params;
        const i = (1 + g) / D + g;
        const key = D / (1 + i);
        return {
          questionText: `An investor purchases a geometrically decreasing perpetuity-due that provides annual payments. The first payment is 1, and each subsequent payment is ${pc(-g)} less than the previous payment.
At the time of purchase, the Macaulay duration of the perpetuity-due is ${n(D, 2)} years.
Calculate the modified duration of the perpetuity-due, in years, at the time of purchase.`,
          variables: { variant, g, D },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(D / (1 + 1 / D), "CALCULATION_DISTRACTOR", "Ignored the decrease when recovering the rate."),
            distractor(D * (1 + i), "CALCULATION_DISTRACTOR", "Multiplied by $1 + i$."),
            distractor(D / (1 + (1 + g) / D - g), "CALCULATION_DISTRACTOR", "Treated the decrease as an increase when recovering the rate."),
            distractor(D - 1, "CALCULATION_DISTRACTOR", "Subtracted a year."),
          ],
          solutionSteps: `**Step 1 — Duration formula.** Payments $(1+g)^t$ at $t = 0, 1, \\ldots$ with ratio $x = (1+g)/(1+i)$ give Macaulay duration $x/(1 - x) = (1 + g)/(i - g)$, with $g = ${g}$.

**Step 2 — Rate.** $(1 + g)/(i - g) = ${n(D, 2)}$, so $i = ${dec(1 + g, 3)}/${n(D, 2)} ${g < 0 ? "-" : "+"} ${Math.abs(g)} = ${dec(i, 6)}$.

**Step 3 — Modified duration.** $${n(D, 2)}/${dec(1 + i, 6)} = ${dec(key, 4)}$.`,
          checks: [{ label: "rate recovered", ok: close((1 + g) / (i - g), D, 1e-12) }],
        };
      }
      if (variant === "PERP_VS_DUE") {
        const D = Number((gridAmount(rng, 100, 400, 1) / 10 + rng.choice([0, 0.05])).toFixed(2));
        const i = 1 / (D - 1);
        const scale = rng.choice([1.02, 1.05, 1.1, 2]);
        const key = 1 / i / (1 + i);
        return {
          questionText: `A perpetuity-immediate with level annual payments of $k$ has a Macaulay duration of ${n(D, 2)} years based on an annual effective interest rate of $i$. At the same annual effective interest rate, a perpetuity-due with level annual payments of ${scale}$k$ has a modified duration of $X$ years.
Calculate $X$.`,
          variables: { variant, D, scale },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(1 / i, "CALCULATION_DISTRACTOR", "Gave the perpetuity-due's Macaulay duration."),
            distractor(D / (1 + i), "CALCULATION_DISTRACTOR", "Gave the perpetuity-immediate's modified duration."),
            distractor((scale * 1) / i / (1 + i), "CALCULATION_DISTRACTOR", "Scaled the duration by the payment size."),
          ],
          solutionSteps: `**Step 1 — Rate.** For the perpetuity-immediate $(1 + i)/i = ${n(D, 2)}$, so $1/i = ${n(D - 1, 2)}$. Payment size does not affect duration.

**Step 2 — Perpetuity-due.** Its Macaulay duration is $1/i = ${n(D - 1, 2)}$, so its modified duration is $${n(D - 1, 2)}/(1 + ${dec(i, 6)}) = ${dec(key, 4)}$.`,
          checks: [{ label: "rate positive", ok: i > 0 }],
        };
      }
      if (variant === "ZERO_TWICE") {
        const T = rng.int(5, 20);
        const q = rng.choice([1.5, 2, 2, 3]);
        const key = q * T - 1;
        return {
          questionText: `Bond A pays 1 at the end of each year in perpetuity. Bond B is a zero-coupon bond that matures in ${word(T)} years. The Macaulay duration of bond A is ${q === 2 ? "twice" : q === 3 ? "three times" : `${q} times`} that of bond B.
Calculate the modified duration of bond A.`,
          variables: { variant, T, q },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(q * T, "CALCULATION_DISTRACTOR", "Gave the Macaulay duration."),
            distractor((q * T) / (1 + 1 / (q * T)), "CALCULATION_DISTRACTOR", "Took the rate as the reciprocal of the Macaulay duration."),
            distractor(T, "CALCULATION_DISTRACTOR", "Gave bond B's duration."),
          ],
          solutionSteps: `**Step 1 — Rate.** Bond A's Macaulay duration is $(1 + i)/i = ${q}(${T}) = ${q * T}$, so $1/i = ${q * T - 1}$.

**Step 2 — Modified duration.** For a perpetuity-immediate the modified duration is $1/i = ${key}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      const T = rng.int(5, 20);
      const iTrue = gridRate(rng, 0.02, 0.1, 0.005);
      const m = Number((T / (1 + iTrue)).toFixed(2));
      const i = T / m - 1;
      const flows = Array.from({ length: T }, (_, k) => [k + 1, 1] as const);
      const key = macaulay(flows, i);
      return {
        questionText: `The modified duration of a ${word(T)}-year zero-coupon bond with an annual effective yield rate of $i$ is ${n(m, 2)} years.
Based on an annual effective interest rate of $i$, the Macaulay duration of a ${word(T)}-year annuity-immediate with level annual payments is $D$.
Calculate $D$.`,
        variables: { variant: "ZERO_THEN_ANNUITY", T, m },
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor(key / (1 + i), "CALCULATION_DISTRACTOR", "Gave the annuity's modified duration."),
          distractor((T + 1) / 2, "SIMPLE_INTEREST_ERROR", "Took the average payment time."),
          distractor(macaulay(flows.map(([t, a]) => [t - 1, a] as const), i), "ANNUITY_DUE_CONFUSION", "Treated the annuity as an annuity-due."),
          distractor(m, "CALCULATION_DISTRACTOR", "Gave the zero-coupon bond's modified duration."),
        ],
        solutionSteps: `**Step 1 — Rate.** The zero's Macaulay duration is ${T}, so $1 + i = ${T}/${n(m, 2)} = ${dec(1 + i, 6)}$.

**Step 2 — Annuity duration.** $\\frac{\\sum_{t=1}^{${T}} t\\,v^t}{a_{\\overline{${T}}|}} = \\frac{${dec(weighted(flows, i), 4)}}{${dec(an(T, i), 4)}} = ${dec(key, 4)}$.`,
        checks: [{ label: "rate positive", ok: i > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_DURATION_ANNUITY",
    domain: ALM,
    title: "Duration of Annuities and Related Streams",
    objective: "Compute or infer the duration of annuities and of cash-flow streams that are extended, shifted or deferred.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 3,
    soaSamples: [100, 165, 458, 389],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["DUE_EXTENSION", "PHASED", "SHIFTED", "DEFER_AND_ADD"] as const);
      if (variant === "DUE_EXTENSION") {
        const count = rng.int(3, 6);
        const iTrue = gridRate(rng, 0.03, 0.15, 0.005);
        const dueFlows = (k: number) => Array.from({ length: k }, (_, t) => [t, 1] as const);
        const DA = Number(macaulay(dueFlows(count), iTrue).toFixed(2));
        const i = solve((x) => macaulay(dueFlows(count), x) - DA, -0.5, 5);
        const key = macaulay(dueFlows(count + 1), i);
        return {
          questionText: `Annuity A pays 1 at the beginning of each year for ${word(count)} years. Annuity B pays 1 at the beginning of each year for ${word(count + 1)} years.
The Macaulay duration of Annuity A at the time of purchase is ${n(DA, 2)}. Both annuities offer the same yield rate.
Calculate the Macaulay duration of Annuity B at the time of purchase.`,
          variables: { variant, count, DA },
          correctValue: key,
          format: "AMOUNT_3",
          distractors: [
            distractor(DA + 0.5, "SIMPLE_INTEREST_ERROR", "Added half a year for the extra payment."),
            distractor((DA * count) / (count - 1), "CALCULATION_DISTRACTOR", "Scaled the duration by the number of payments."),
            distractor(macaulay(dueFlows(count + 1), 0), "CALCULATION_DISTRACTOR", "Ignored discounting."),
            distractor(DA + 1, "CALCULATION_DISTRACTOR", "Added a full year."),
          ],
          solutionSteps: `**Step 1 — Recover $v$.** $\\frac{${Array.from({ length: count - 1 }, (_, t) => `${t + 1}v^{${t + 1}}`).join(" + ")}}{${Array.from({ length: count }, (_, t) => (t === 0 ? "1" : `v^{${t}}`)).join(" + ")}} = ${n(DA, 2)}$ gives $v = ${dec(v(i, 1), 6)}$.

**Step 2 — Annuity B.** With one more payment at time ${count}:
$$\\frac{\\sum_{t=0}^{${count}} t\\,v^t}{\\sum_{t=0}^{${count}} v^t} = \\frac{${dec(weighted(dueFlows(count + 1), i), 5)}}{${dec(pv(dueFlows(count + 1), i), 5)}} = ${dec(key, 4)}.$$

**Step 3 — Check.** The extra payment is later than every other, so B's duration exceeds A's.`,
          checks: [{ label: "rate recovered", ok: Math.abs(i - iTrue) < 0.01 }],
        };
      }
      if (variant === "PHASED") {
        const n1 = rng.int(5, 20);
        const n2 = rng.int(10, 30);
        const k = rng.choice([2, 3, 4, 5]);
        const i = gridRate(rng, 0.02, 0.08, 0.005);
        const flows: Flow[] = [
          ...Array.from({ length: n1 }, (_, t) => [t, 1] as const),
          ...Array.from({ length: n2 }, (_, t) => [n1 + t, k] as const),
        ];
        const key = macaulay(flows, i);
        return {
          questionText: `An annuity provides the following payments:
(i) $X$ at the beginning of each year for ${n1} years, starting today
(ii) ${k}$X$ at the beginning of each year for ${n2} years, starting ${n1} years from today
Calculate the Macaulay duration of this annuity using an annual effective interest rate of ${pc(i)}.`,
          variables: { variant, n1, n2, k, i },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(key / (1 + i), "CALCULATION_DISTRACTOR", "Gave the modified duration."),
            distractor(macaulay(flows.map(([t, a]) => [t + 1, a] as const), i), "ANNUITY_DUE_CONFUSION", "Treated the payments as made at the end of each year."),
            distractor(flows.reduce((s, [t, a]) => s + t * a, 0) / flows.reduce((s, [, a]) => s + a, 0), "CALCULATION_DISTRACTOR", "Ignored discounting."),
            distractor(macaulay([...Array.from({ length: n1 }, (_, t) => [t, 1] as const), ...Array.from({ length: n2 }, (_, t) => [n1 + t, 1] as const)], i), "CALCULATION_DISTRACTOR", `Left out the factor ${k} on the later payments.`),
          ],
          solutionSteps: `**Step 1 — Present value (in units of $X$).** $\\ddot{a}_{\\overline{${n1}}|} + ${k}v^{${n1}}\\ddot{a}_{\\overline{${n2}}|} = ${dec(pv(flows, i), 4)}$.

**Step 2 — Time-weighted present value.** $\\sum t\\,CF_t\\,v^t = ${dec(weighted(flows, i), 4)}$.

**Step 3 — Duration.** $${dec(weighted(flows, i), 4)}/${dec(pv(flows, i), 4)} = ${dec(key, 4)}$.`,
          checks: [{ label: "within span", ok: key > 0 && key < n1 + n2 }],
        };
      }
      if (variant === "SHIFTED") {
        const i = gridRate(rng, 0.04, 0.12, 0.01);
        const a = gridAmount(rng, 1000, 5000, 1000);
        const b = gridAmount(rng, 1000, 5000, 1000);
        const t1 = rng.int(1, 3);
        const t2 = t1 + rng.int(1, 2);
        const t3 = t2 + rng.int(1, 3);
        const params = drawUntil(
          () => gridAmount(rng, 20, 60, 1) / 10,
          (D) => {
            const denom = t3 * v(i, t3 + 1) - D * v(i, t3);
            const X = (D * (a * v(i, t1) + b * v(i, t2)) - (t1 * a * v(i, t1 + 1) + t2 * b * v(i, t2 + 1))) / denom;
            return X > 0.2 * (a + b) && X < 20 * (a + b);
          },
          (t3 / (1 + i)) * 0.8
        );
        const DA = params;
        const X = (DA * (a * v(i, t1) + b * v(i, t2)) - (t1 * a * v(i, t1 + 1) + t2 * b * v(i, t2 + 1))) / (t3 * v(i, t3 + 1) - DA * v(i, t3));
        const flowsB: Flow[] = [[t1 + 1, a], [t2 + 1, b], [t3 + 2, X]];
        const key = modified(flowsB, i);
        return {
          questionText: `Investment A provides cash flows of ${n(a)}, ${n(b)}, and $X$ at the end of years ${t1}, ${t2}, and ${t3}, respectively.
Investment B provides cash flows of ${n(a)}, ${n(b)}, and $X$ at the end of years ${t1 + 1}, ${t2 + 1}, and ${t3 + 2}, respectively.
The modified durations of Investment A and Investment B are ${n(DA, 1)} years and $Y$ years, respectively, each based on an annual effective interest rate of ${pc(i)}.
Calculate $Y$.`,
          variables: { variant, i, a, b, t1, t2, t3, DA },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(DA + 1 / (1 + i), "CALCULATION_DISTRACTOR", "Shifted every cash flow by one year."),
            distractor(macaulay(flowsB, i), "CALCULATION_DISTRACTOR", "Gave the Macaulay duration."),
            distractor(DA + 1, "CALCULATION_DISTRACTOR", "Added a year to the modified duration."),
            distractor(DA + 2 / (1 + i), "CALCULATION_DISTRACTOR", "Shifted every cash flow by two years."),
          ],
          solutionSteps: `**Step 1 — Solve for $X$ from Investment A.** Modified duration is $-P'(i)/P(i)$:
$$\\frac{${t1}(${mn(a)})v^{${t1 + 1}} + ${t2}(${mn(b)})v^{${t2 + 1}} + ${t3}Xv^{${t3 + 1}}}{${mn(a)}v^{${t1}} + ${mn(b)}v^{${t2}} + Xv^{${t3}}} = ${n(DA, 1)} \\Rightarrow X = ${mn(X, 2)}.$$

**Step 2 — Investment B.** $P_B = ${mn(pv(flowsB, i), 2)}$ and $-P_B' = ${mn(weighted(flowsB, i) / (1 + i), 2)}$.

**Step 3 — Modified duration.** $Y = ${mn(weighted(flowsB, i) / (1 + i), 2)}/${mn(pv(flowsB, i), 2)} = ${dec(key, 4)}$.`,
          checks: [{ label: "A's duration reproduced", ok: close(modified([[t1, a], [t2, b], [t3, X]], i), DA, 1e-9) }],
        };
      }
      const combos: [number, number][] = [[0.2, 6], [0.25, 5], [0.25, 10], [0.5, 3], [0.2, 12], [0.25, 3]];
      const [j, k] = rng.choice(combos);
      const count = rng.int(5, 20);
      const flows = Array.from({ length: count }, (_, t) => [t + 1, 1] as const);
      const D1 = Number(modified(flows, j).toFixed(2));
      const D2 = Number((D1 + k / (1 + j)).toFixed(4));
      const P0 = gridAmount(rng, 5, 50, 1);
      const A = gridAmount(rng, 1, 20, 1);
      const key = ((1 + j) * D1 * P0) / (P0 + A);
      return {
        questionText: `An asset provides equal annual payments, with the first payment occurring one year from today. Based on an annual effective interest rate of $j$, the present value of the payments provided by the asset is ${P0} and the modified duration is ${n(D1, 2)} years.
If all payments were deferred ${word(k)} years so that payments began at the end of year ${k + 1}, the modified duration at interest rate $j$ would be ${n(D2, 2)} years.
If the original set of cash flows is altered by adding a single payment of ${A} today, the Macaulay duration of the altered cash flows is $X$ years, at interest rate $j$.
Calculate $X$.`,
        variables: { variant: "DEFER_AND_ADD", P0, D1, D2, k, A },
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor((D1 * P0) / (P0 + A), "CALCULATION_DISTRACTOR", "Weighted the modified duration instead of the Macaulay duration."),
          distractor((1 + j) * D1, "CALCULATION_DISTRACTOR", "Ignored the added payment."),
          distractor(((1 + j) * D1 * P0) / (P0 + A) / (1 + j), "CALCULATION_DISTRACTOR", "Gave the modified duration of the altered cash flows."),
          distractor(((1 + j) * D1 * P0 + A) / (P0 + A), "CALCULATION_DISTRACTOR", "Gave the added payment a duration of 1."),
        ],
        solutionSteps: `**Step 1 — Rate.** Deferring by ${k} years adds exactly ${k} to the Macaulay duration, and Macaulay $= (1 + j) \\times$ modified, so $(1 + j)(${n(D2, 2)} - ${n(D1, 2)}) = ${k}$, giving $j = ${j}$.

**Step 2 — Original Macaulay duration.** $(1 + ${j})(${n(D1, 2)}) = ${dec((1 + j) * D1, 4)}$.

**Step 3 — Add the payment today.** It has time 0, so it adds to the present value only: $X = \\frac{${dec((1 + j) * D1, 4)}(${P0}) + 0(${A})}{${P0} + ${A}} = ${dec(key, 4)}$.`,
        checks: [{ label: "rate recovered", ok: close((1 + j) * (D2 - D1), k, 1e-9) }],
      };
    },
  },

  {
    id: "FM_ALM_PORTFOLIO_DURATION",
    domain: ALM,
    title: "Duration of a Portfolio",
    objective: "Combine durations of holdings weighted by present value, solve for the weights that give a target duration, and compare asset and liability durations.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 3,
    soaSamples: [354, 350, 53, 219],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["PORTFOLIO", "WEIGHT", "BEFORE_AFTER", "ASSET_LIAB"] as const);
      if (variant === "PORTFOLIO") {
        const F = 1000;
        const years = rng.int(8, 15);
        const r = gridRate(rng, 0.03, 0.08, 0.005);
        const T1 = rng.int(2, years - 2);
        const T2 = years;
        const PA = F;
        const DA = adue(years, r);
        const PB = F * v(r, T1);
        const PC = F * v(r, T2);
        const key = (PA * DA + PB * T1 + PC * T2) / (PA + PB + PC);
        return {
          questionText: `An investor purchases a portfolio consisting of three bonds. Bond A has annual coupons of ${pc(r)} and matures for its face amount of ${n(F)} in ${word(years)} years. It is purchased for ${n(F)}. Bonds B and C are zero-coupon bonds, maturing for ${n(F)} each in ${word(T1)} and ${word(T2)} years, respectively. All three bonds have the same yield rate.
Calculate the Macaulay duration in years at the time of purchase of the portfolio with respect to the common yield rate.`,
          variables: { variant, F, years, r, T1, T2 },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor((DA + T1 + T2) / 3, "CALCULATION_DISTRACTOR", "Averaged the three durations without weights."),
            distractor((F * DA + F * T1 + F * T2) / (3 * F), "CALCULATION_DISTRACTOR", "Weighted by face amounts."),
            distractor((PA * years + PB * T1 + PC * T2) / (PA + PB + PC), "CALCULATION_DISTRACTOR", "Took Bond A's duration as its term."),
            distractor(key / (1 + r), "CALCULATION_DISTRACTOR", "Gave the modified duration."),
          ],
          solutionSteps: `**Step 1 — Yield and Bond A.** Bond A sells at par, so the yield is its coupon rate, ${pc(r)}, and its duration is $\\ddot{a}_{\\overline{${years}}|} = ${dec(DA, 4)}$.

**Step 2 — Prices.** Bond B: $${mn(F)}v^{${T1}} = ${mn(PB, 2)}$; Bond C: $${mn(F)}v^{${T2}} = ${mn(PC, 2)}$; Bond A: ${n(F)}.

**Step 3 — Weighted duration.** $\\frac{${mn(PA)}(${dec(DA, 4)}) + ${mn(PB, 2)}(${T1}) + ${mn(PC, 2)}(${T2})}{${mn(PA + PB + PC, 2)}} = ${dec(key, 4)}$.`,
          checks: [{ label: "par bond duration", ok: close(DA, macaulay(bondFlows(F * r, F, years), r), 1e-9) }],
        };
      }
      if (variant === "WEIGHT") {
        const F = 1000;
        const years = rng.int(3, 8);
        const r = gridRate(rng, 0.03, 0.1, 0.005);
        const i = gridRate(rng, 0.03, 0.08, 0.005);
        const flowsA = bondFlows(F * r, F, years);
        const DA = macaulay(flowsA, i);
        const target = drawUntil(() => gridAmount(rng, 15, Math.floor(DA * 10) - 2, 1) / 10, (x) => x > 1.3 && x < DA - 0.2, 2);
        const w = (target - 1) / (DA - 1);
        return {
          questionText: `A portfolio consists of two bonds. Bond A is a ${word(years)}-year ${n(F)} face amount bond with an annual coupon rate of ${pc(r)} paid annually. Bond B is a one-year zero-coupon bond. Both bonds yield an annual effective rate of ${pc(i)}.
Calculate the percentage of the portfolio to invest in Bond A to obtain a Macaulay duration of ${n(target, 1)} years.`,
          variables: { variant, F, years, r, i, target },
          correctValue: w * 100,
          format: "PERCENT_1",
          distractors: [
            distractor(((target - 1) / (years - 1)) * 100, "CALCULATION_DISTRACTOR", "Took Bond A's duration as its term."),
            distractor((target / DA) * 100, "CALCULATION_DISTRACTOR", "Ignored Bond B's duration of 1."),
            distractor((1 - w) * 100, "CALCULATION_DISTRACTOR", "Gave the share in Bond B."),
            distractor(((target - 1) / (DA / (1 + i) - 1)) * 100, "CALCULATION_DISTRACTOR", "Used Bond A's modified duration."),
          ],
          solutionSteps: `**Step 1 — Bond A's duration.** $\\sum t\\,CF_t v^t / P = ${dec(weighted(flowsA, i), 3)}/${dec(pv(flowsA, i), 3)} = ${dec(DA, 4)}$. Bond B's duration is 1.

**Step 2 — Weights.** A portfolio's duration is the value-weighted average: $w(${dec(DA, 4)}) + (1 - w)(1) = ${n(target, 1)}$.

**Step 3 — Solve.** $w = \\frac{${n(target, 1)} - 1}{${dec(DA, 4)} - 1} = ${dec(w, 5)}$, that is, ${(w * 100).toFixed(2)}%.`,
          checks: [{ label: "weight within (0,1)", ok: w > 0 && w < 1 }],
        };
      }
      if (variant === "BEFORE_AFTER") {
        const years = rng.int(4, 15);
        const r = gridRate(rng, 0.03, 0.1, 0.005);
        const F = rng.choice([1000, 5000, 10000]);
        const d0 = adue(years, r);
        const d1 = d0 - 1;
        const d2 = adue(years - 1, r);
        const key = d1 / d2;
        return {
          questionText: `An investor buys a ${word(years)}-year, ${n(F)} par bond with an annual coupon rate of ${pc(r)}, paid annually. The bond sells for ${n(F)}. Let $d_1$ be the Macaulay duration just before the first coupon is paid. Let $d_2$ be the Macaulay duration just after the first coupon is paid.
Calculate $d_1/d_2$.`,
          variables: { variant, years, r, F },
          correctValue: key,
          format: "AMOUNT_3",
          distractors: [
            distractor(d0 / d2, "CALCULATION_DISTRACTOR", "Used the duration at purchase for $d_1$."),
            distractor(d2 / d1, "CALCULATION_DISTRACTOR", "Inverted the ratio."),
            distractor(d1 / (d2 - 1), "OFF_BY_ONE_PERIOD", "Subtracted a year from $d_2$ as well."),
            distractor((d0 - 1) / d0, "CALCULATION_DISTRACTOR", "Took $d_2$ as the duration at purchase."),
          ],
          solutionSteps: `**Step 1 — Duration at purchase.** A bond selling at par yields its coupon rate, and its Macaulay duration is $\\ddot{a}_{\\overline{${years}}|} = ${dec(d0, 4)}$.

**Step 2 — Just before and after the first coupon.** Just before, the cash flows are the same but each is one year closer: $d_1 = ${dec(d0, 4)} - 1 = ${dec(d1, 4)}$. Just after, the bond is a ${years - 1}-year par bond: $d_2 = \\ddot{a}_{\\overline{${years - 1}}|} = ${dec(d2, 4)}$.

**Step 3 — Ratio.** $${dec(d1, 4)}/${dec(d2, 4)} = ${dec(key, 4)}$.`,
          checks: [{ label: "d2 from flows", ok: close(d2, macaulay(bondFlows(F * r, F, years - 1), r), 1e-9) }],
        };
      }
      const i = gridRate(rng, 0.04, 0.12, 0.01);
      const L1 = gridAmount(rng, 100, 500, 50);
      const L2 = gridAmount(rng, 100, 500, 50);
      const t1 = rng.int(2, 4);
      const t2 = t1 + rng.int(1, 3);
      const s1 = rng.int(1, t1 - 1);
      const s2 = t2 + rng.int(1, 3);
      const DL = macaulay([[t1, L1], [t2, L2]], i);
      const DA = macaulay([[s1, 1], [s2, 1]], i);
      const key = Math.abs(DA - DL);
      return {
        questionText: `A firm has a liability cash flow of ${n(L1)} at the end of year ${word(t1)} and a second liability cash flow of ${n(L2)} at the end of year ${word(t2)}.
The firm also has asset cash flows of $X$ at the end of years ${word(s1)} and ${word(s2)}.
Using an annual effective interest rate of ${pc(i)}, calculate the absolute value of the difference between the Macaulay durations of the asset and liability cash flows.`,
        variables: { variant: "ASSET_LIAB", i, L1, L2, t1, t2, s1, s2 },
        correctValue: key,
        format: "AMOUNT_3",
        distractors: [
          distractor(Math.abs((s1 + s2) / 2 - DL), "CALCULATION_DISTRACTOR", "Averaged the asset times without discounting."),
          distractor(Math.abs(DA - (t1 * L1 + t2 * L2) / (L1 + L2)), "CALCULATION_DISTRACTOR", "Weighted the liability times by undiscounted amounts."),
          distractor(Math.abs(DA - DL) / (1 + i), "CALCULATION_DISTRACTOR", "Gave the difference in modified durations."),
          distractor(Math.abs((s1 + s2) / 2 - (t1 * L1 + t2 * L2) / (L1 + L2)), "CALCULATION_DISTRACTOR", "Ignored discounting on both sides."),
        ],
        solutionSteps: `**Step 1 — Liabilities.** $D_L = \\frac{${t1}(${mn(L1)})v^{${t1}} + ${t2}(${mn(L2)})v^{${t2}}}{${mn(L1)}v^{${t1}} + ${mn(L2)}v^{${t2}}} = ${dec(DL, 4)}$.

**Step 2 — Assets.** $X$ cancels: $D_A = \\frac{${s1}v^{${s1}} + ${s2}v^{${s2}}}{v^{${s1}} + v^{${s2}}} = ${dec(DA, 4)}$.

**Step 3 — Difference.** $|${dec(DA, 4)} - ${dec(DL, 4)}| = ${dec(key, 4)}$.`,
        checks: [{ label: "nonzero", ok: key > 0.001 }],
      };
    },
  },

  {
    id: "FM_ALM_CONVEXITY",
    domain: ALM,
    title: "Convexity of a Set of Cash Flows",
    objective: "Compute Macaulay or modified convexity, and convert between them using the Macaulay duration.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 2,
    soaSamples: [108, 390],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["FLOWS", "FLOWS", "ZERO", "CONVERT"] as const);
      const i = gridRate(rng, 0.03, 0.1, 0.005);
      if (variant === "CONVERT") {
        const count = rng.int(3, 5);
        const flows = Array.from({ length: count }, (_, k) => [k + 1, gridAmount(rng, 100, 1000, 50)] as const);
        const D = Number(macaulay(flows, i).toFixed(2));
        const C = Number(macaulayConvexity(flows, i).toFixed(2));
        const key = (C + D) / Math.pow(1 + i, 2);
        return {
          questionText: `You are given the following information about a company's liabilities, using an annual effective interest rate of ${pc(i)}:
- Macaulay duration: ${n(D, 2)}
- Macaulay convexity: ${n(C, 2)}
Calculate the modified convexity of the liabilities.`,
          variables: { variant, i, D, C },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(C / Math.pow(1 + i, 2), "CALCULATION_DISTRACTOR", "Left out the duration term."),
            distractor((C + D) / (1 + i), "CALCULATION_DISTRACTOR", "Divided by $1 + i$ only once."),
            distractor((C - D) / Math.pow(1 + i, 2), "CALCULATION_DISTRACTOR", "Subtracted the duration instead of adding it."),
            distractor(C + D, "CALCULATION_DISTRACTOR", "Did not divide by $(1 + i)^2$."),
          ],
          solutionSteps: `**Step 1 — Relation.** Modified convexity is $P''(i)/P(i) = \\sum t(t+1)CF_t v^{t+2}/P = \\frac{\\sum t^2 CF_t v^t + \\sum t\\,CF_t v^t}{(1+i)^2 P}$, which is (Macaulay convexity + Macaulay duration)$/(1+i)^2$.

**Step 2 — Compute.** $\\frac{${n(C, 2)} + ${n(D, 2)}}{(${dec(1 + i, 3)})^2} = ${dec(key, 4)}$.`,
          checks: [{ label: "identity on source flows", ok: close(modifiedConvexity(flows, i), (macaulayConvexity(flows, i) + macaulay(flows, i)) / Math.pow(1 + i, 2), 1e-10) }],
        };
      }
      const askModified = rng.next() < 0.5;
      let flows: Flow[];
      let stem: string;
      let variables: Record<string, number | string | number[]>;
      if (variant === "ZERO") {
        const T = rng.int(3, 30);
        const F = rng.choice([1000, 5000, 10000]);
        flows = [[T, F]];
        stem = `A ${n(F)} face amount zero-coupon bond matures in ${word(T)} years. The annual effective yield rate is ${pc(i)}.
Calculate the ${askModified ? "modified" : "Macaulay"} convexity of the bond.`;
        variables = { variant, T, F, i, ask: askModified ? "MOD" : "MAC" };
      } else {
        const count = rng.int(3, 4);
        const start = rng.int(1, 3);
        const gap = rng.int(1, 2);
        const times = Array.from({ length: count }, (_, k) => start + k * gap);
        const amounts = times.map(() => gridAmount(rng, 100, 1000, 50));
        flows = times.map((t, k) => [t, amounts[k]] as const);
        stem = `A set of cash flows consists of ${flowProse(flows)} (in years). The annual effective interest rate is ${pc(i)}.
Calculate the ${askModified ? "modified" : "Macaulay"} convexity of these cash flows.`;
        variables = { variant, times, amounts, i, ask: askModified ? "MOD" : "MAC" };
      }
      const mac = macaulayConvexity(flows, i);
      const mod = modifiedConvexity(flows, i);
      const key = askModified ? mod : mac;
      return {
        questionText: stem,
        variables,
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor(askModified ? mac : mod, "CALCULATION_DISTRACTOR", askModified ? "Gave the Macaulay convexity." : "Gave the modified convexity."),
          distractor(Math.pow(macaulay(flows, i), 2), "CALCULATION_DISTRACTOR", "Squared the Macaulay duration."),
          distractor(askModified ? mac / Math.pow(1 + i, 2) : mac * (1 + i), "CALCULATION_DISTRACTOR", askModified ? "Divided the Macaulay convexity by $(1+i)^2$ without adding the duration." : "Multiplied by $1 + i$."),
          distractor(flows.reduce((s, [t, a]) => s + t * t * a, 0) / flows.reduce((s, [, a]) => s + a, 0), "CALCULATION_DISTRACTOR", "Ignored discounting."),
        ],
        solutionSteps: `**Step 1 — Present value.** $P = ${mn(pv(flows, i), 4)}$ at ${pc(i)}.

**Step 2 — Convexity.** ${
          askModified
            ? `Modified convexity $= \\frac{\\sum t(t+1)CF_t v^{t+2}}{P} = ${dec(key, 4)}$.`
            : `Macaulay convexity $= \\frac{\\sum t^2 CF_t v^t}{P} = ${dec(key, 4)}$.`
        }`,
        checks: [{ label: "convexity at least duration squared", ok: mac >= Math.pow(macaulay(flows, i), 2) - 1e-9 }],
      };
    },
  },

  {
    id: "FM_ALM_FIRST_ORDER_APPROX",
    domain: ALM,
    title: "First-Order Duration Approximations",
    objective: "Estimate a new price with the first-order modified or Macaulay approximation, or work backward from an estimate.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 2,
    soaSamples: [51, 153, 146, 152, 154, 155, 156, 445, 459],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["PRICE", "PCT", "DIFF", "SOLVE_RATE", "SOLVE_DURATION", "OTHER_BOND", "PERPETUITY"] as const);
      const method = rng.choice(["MOD", "MAC"] as const);
      const methodText = method === "MOD" ? "first-order modified approximation" : "first-order Macaulay approximation";
      const estimate = (P: number, Dmac: number, i0: number, i1: number) => (method === "MOD" ? P * (1 - (Dmac / (1 + i0)) * (i1 - i0)) : P * Math.pow((1 + i0) / (1 + i1), Dmac));
      const other = (P: number, Dmac: number, i0: number, i1: number) => (method === "MOD" ? P * Math.pow((1 + i0) / (1 + i1), Dmac) : P * (1 - (Dmac / (1 + i0)) * (i1 - i0)));
      if (variant === "PRICE" || variant === "PCT") {
        const years = rng.int(5, 25);
        const i0 = gridRate(rng, 0.03, 0.1, 0.001);
        const D = Number(adue(years, i0).toFixed(3));
        const delta = rng.choice([-0.01, -0.005, -0.0025, 0.0025, 0.005, 0.008, 0.01]);
        const i1 = Number((i0 + delta).toFixed(6));
        if (variant === "PRICE") {
          const key = estimate(1000, D, i0, i1);
          return {
            questionText: `An investor buys an $n$-year 1000 bond at par. The Macaulay duration is ${n(D, 3)} years using an annual effective interest rate of ${pc(i0, 2)}.
Calculate the estimated price of the bond, using the ${methodText}, if the interest rate ${delta > 0 ? "rises" : "falls"} to ${pc(i1, 2)}.`,
            variables: { variant, method, D, i0, i1 },
            correctValue: key,
            format: "AMOUNT_2",
            distractors: [
              distractor(other(1000, D, i0, i1), "CALCULATION_DISTRACTOR", `Used the ${method === "MOD" ? "Macaulay" : "modified"} approximation.`),
              distractor(1000 * (1 - D * (i1 - i0)), "CALCULATION_DISTRACTOR", "Used the Macaulay duration in the modified approximation."),
              distractor(1000 * (1 + (D / (1 + i0)) * (i1 - i0)), "CALCULATION_DISTRACTOR", "Moved the price in the wrong direction."),
              distractor(1000 * Math.pow((1 + i1) / (1 + i0), D), "CALCULATION_DISTRACTOR", "Inverted the ratio of accumulation factors."),
            ],
            solutionSteps: method === "MOD"
              ? `**Step 1 — Modified duration.** $${n(D, 3)}/${dec(1 + i0, 3)} = ${dec(D / (1 + i0), 5)}$.

**Step 2 — Estimate.** $P(i) \\approx P(i_0)[1 - D_{mod}(i - i_0)] = 1000[1 - ${dec(D / (1 + i0), 5)}(${dec(i1 - i0, 4)})] = ${mn(key, 2)}$.`
              : `**Step 1 — Formula.** $P(i) \\approx P(i_0)\\left(\\frac{1 + i_0}{1 + i}\\right)^{D_{mac}}$.

**Step 2 — Estimate.** $1000\\left(\\frac{${dec(1 + i0, 3)}}{${dec(1 + i1, 3)}}\\right)^{${n(D, 3)}} = ${mn(key, 2)}$.`,
            checks: [{ label: "direction", ok: (key - 1000) * delta < 0 }],
          };
        }
        const key = (estimate(1, D, i0, i1) - 1) * 100;
        return {
          questionText: `A ${years}-year bond priced to have an annual effective yield of ${pc(i0, 2)} has a Macaulay duration of ${n(D, 3)}.
Immediately after the bond is priced, the market yield rate ${delta > 0 ? "increases" : "decreases"} by ${pc(Math.abs(delta), 2)}. The bond's approximate percentage price change, using a ${methodText}, is $X$.
Calculate $X$.`,
          variables: { variant, method, D, i0, delta: Math.abs(delta), sign: delta > 0 ? 1 : -1 },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor((other(1, D, i0, i1) - 1) * 100, "CALCULATION_DISTRACTOR", `Used the ${method === "MOD" ? "Macaulay" : "modified"} approximation.`),
            distractor(-D * delta * 100, "CALCULATION_DISTRACTOR", "Used the Macaulay duration as if it were modified."),
            distractor(D * delta * 100 / (1 + i0), "CALCULATION_DISTRACTOR", "Moved the price in the wrong direction."),
            distractor(-D * delta, "CALCULATION_DISTRACTOR", "Did not convert to a percentage."),
          ],
          solutionSteps: method === "MOD"
            ? `**Step 1 — Modified duration.** $${n(D, 3)}/${dec(1 + i0, 3)} = ${dec(D / (1 + i0), 5)}$.

**Step 2 — Percentage change.** $-D_{mod}\\,\\Delta i = -${dec(D / (1 + i0), 5)}(${dec(delta, 4)}) = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`
            : `**Step 1 — Ratio.** $\\left(\\frac{${dec(1 + i0, 4)}}{${dec(1 + i1, 4)}}\\right)^{${n(D, 3)}} = ${dec(1 + key / 100, 6)}$.

**Step 2 — Percentage change.** $${dec(1 + key / 100, 6)} - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "direction", ok: key * delta < 0 }],
        };
      }
      if (variant === "DIFF") {
        const P = gridAmount(rng, 20000, 200000, 5);
        const Dmod = gridAmount(rng, 30, 150, 1) / 10;
        const i0 = gridRate(rng, 0.03, 0.09, 0.001);
        const i1 = Number((i0 + rng.choice([-0.01, -0.006, 0.004, 0.006, 0.01])).toFixed(6));
        const Dmac = Dmod * (1 + i0);
        const mac = P * Math.pow((1 + i0) / (1 + i1), Dmac);
        const mod = P * (1 - Dmod * (i1 - i0));
        const key = mac - mod;
        return {
          questionText: `A bond has a modified duration of ${n(Dmod, 1)} and a price of ${n(P)} calculated using an annual effective interest rate of ${pc(i0, 2)}.
$E_{MAC}$ is the estimated price of this bond at an interest rate of ${pc(i1, 2)} using the first-order Macaulay approximation.
$E_{MOD}$ is the estimated price of this bond at an interest rate of ${pc(i1, 2)} using the first-order modified approximation.
Calculate $E_{MAC} - E_{MOD}$.`,
          variables: { variant, P, Dmod, i0, i1 },
          correctValue: key,
          format: amountFormatFor(key),
          distractors: [
            distractor(P * Math.pow((1 + i0) / (1 + i1), Dmod) - mod, "CALCULATION_DISTRACTOR", "Used the modified duration in the Macaulay approximation."),
            distractor(mac - P * (1 - Dmac * (i1 - i0)), "CALCULATION_DISTRACTOR", "Used the Macaulay duration in the modified approximation."),
          ],
          solutionSteps: `**Step 1 — Macaulay duration.** $${n(Dmod, 1)}(${dec(1 + i0, 3)}) = ${dec(Dmac, 4)}$.

**Step 2 — Two estimates.** $E_{MAC} = ${mn(P)}\\left(\\frac{${dec(1 + i0, 3)}}{${dec(1 + i1, 3)}}\\right)^{${dec(Dmac, 4)}} = ${mn(mac, 2)}$ and $E_{MOD} = ${mn(P)}[1 - ${n(Dmod, 1)}(${dec(i1 - i0, 3)})] = ${mn(mod, 2)}$.

**Step 3 — Difference.** $${mn(mac, 2)} - ${mn(mod, 2)} = ${mn(key, 2)}$.`,
          checks: [{ label: "Macaulay estimate above modified", ok: key > 0 }],
        };
      }
      if (variant === "SOLVE_RATE") {
        const i0 = gridRate(rng, 0.03, 0.08, 0.0002);
        const P1 = gridAmount(rng, 10000, 80000, 5000);
        const P2 = gridAmount(rng, 10000, 80000, 5000);
        const D1 = gridAmount(rng, 300, 1500, 1) / 100;
        const D2 = gridAmount(rng, 300, 1500, 1) / 100;
        const D = (P1 * D1 + P2 * D2) / (P1 + P2);
        const target = Math.round(((P1 + P2) * rng.choice([1.02, 1.03, 1.05, 0.97, 0.95])) / 1000) * 1000;
        const i = (1 + i0) * Math.pow((P1 + P2) / target, 1 / D) - 1;
        return {
          questionText: `A company has a portfolio of two bonds:
- Bond 1 has a Macaulay duration of ${n(D1, 2)} and a price of ${n(P1)}; and
- Bond 2 has a Macaulay duration of ${n(D2, 2)} and a price of ${n(P2)}.
The price and Macaulay duration for both bonds were calculated using an annual effective interest rate of ${pc(i0, 2)}.
An analyst estimates the value of this portfolio at an interest rate of $i$ using the first-order Macaulay approximation to be ${n(target)}.
Determine $i$.`,
          variables: { variant, i0, P1, P2, D1, D2, target },
          correctValue: i * 100,
          format: "PERCENT_2",
          distractors: [
            distractor((i0 + (1 - target / (P1 + P2)) / (D / (1 + i0))) * 100, "CALCULATION_DISTRACTOR", "Used the modified approximation."),
            distractor(((1 + i0) * Math.pow((P1 + P2) / target, 1 / ((D1 + D2) / 2)) - 1) * 100, "CALCULATION_DISTRACTOR", "Averaged the durations without weights."),
            distractor(((1 + i0) * Math.pow(target / (P1 + P2), 1 / D) - 1) * 100, "CALCULATION_DISTRACTOR", "Inverted the ratio of values."),
          ],
          solutionSteps: `**Step 1 — Portfolio duration.** $\\frac{${mn(P1)}(${n(D1, 2)}) + ${mn(P2)}(${n(D2, 2)})}{${mn(P1 + P2)}} = ${dec(D, 5)}$.

**Step 2 — Approximation.** $${mn(P1 + P2)}\\left(\\frac{${dec(1 + i0, 4)}}{1 + i}\\right)^{${dec(D, 5)}} = ${mn(target)}$, so $\\frac{1 + i}{${dec(1 + i0, 4)}} = \\left(\\frac{${mn(P1 + P2)}}{${mn(target)}}\\right)^{1/${dec(D, 5)}}$.

**Step 3 — Solve.** $i = ${dec(i, 6)}$, that is, ${(i * 100).toFixed(3)}%.`,
          checks: [{ label: "rate positive", ok: i > 0 }],
        };
      }
      if (variant === "SOLVE_DURATION") {
        const P = gridAmount(rng, 50000, 200000, 1000);
        const i0 = gridRate(rng, 0.03, 0.08, 0.005);
        const i1 = Number((i0 + rng.choice([-0.006, -0.004, 0.004, 0.006])).toFixed(6));
        const DmacTrue = gridAmount(rng, 20, 120, 1) / 10;
        const E = Math.round(P * Math.pow((1 + i0) / (1 + i1), DmacTrue));
        const Dmac = Math.log(E / P) / Math.log((1 + i0) / (1 + i1));
        const key = Dmac / (1 + i0);
        return {
          questionText: `A beneficiary is to receive an annuity-due. At an annual effective interest rate of ${pc(i0)}, the present value of the payments is ${n(P)} and the modified duration is $D_{MOD}$.
An analyst uses the first-order Macaulay approximation to estimate the present value of the annuity-due at an annual effective interest rate of ${pc(i1, 2)}, and obtains ${n(E)}.
Calculate $D_{MOD}$, the modified duration of the annuity at ${pc(i0)}.`,
          variables: { variant, P, i0, i1, E },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(Dmac, "CALCULATION_DISTRACTOR", "Gave the Macaulay duration."),
            distractor((1 - E / P) / (i1 - i0), "CALCULATION_DISTRACTOR", "Used the modified approximation instead."),
            distractor(Dmac * (1 + i0), "CALCULATION_DISTRACTOR", "Multiplied by $1 + i$ instead of dividing."),
            distractor(Dmac / (1 + i1), "CALCULATION_DISTRACTOR", "Divided by one plus the new rate."),
          ],
          solutionSteps: `**Step 1 — Macaulay duration.** $${mn(E)} = ${mn(P)}\\left(\\frac{${dec(1 + i0, 3)}}{${dec(1 + i1, 3)}}\\right)^{D_{MAC}}$, so $D_{MAC} = \\frac{\\ln(${mn(E)}/${mn(P)})}{\\ln(${dec(1 + i0, 3)}/${dec(1 + i1, 3)})} = ${dec(Dmac, 4)}$.

**Step 2 — Modified duration.** $${dec(Dmac, 4)}/${dec(1 + i0, 3)} = ${dec(key, 4)}$.`,
          checks: [{ label: "duration recovered", ok: Math.abs(Dmac - DmacTrue) < 0.05 }],
        };
      }
      if (variant === "OTHER_BOND") {
        const PV = gridAmount(rng, 10000, 50000, 100);
        const i0 = gridRate(rng, 0.03, 0.08, 0.005);
        const D1 = gridAmount(rng, 5000, 15000, 1) / 1000;
        const D2 = drawUntil(() => gridAmount(rng, 5000, 15000, 1) / 1000, (x) => Math.abs(x - D1) > 0.5, D1 + 1.5);
        const bp = rng.choice([25, 50, 75, 100]);
        const up = rng.next() < 0.5;
        const i1 = i0 + (up ? bp : -bp) / 10000;
        const E1 = cents2(PV * Math.pow((1 + i0) / (1 + i1), D1 * (1 + i0)));
        const key = PV * Math.pow(E1 / PV, D2 / D1);
        return {
          questionText: `An investor owns two bonds, Bond 1 and Bond 2. At today's annual effective interest rate, the bonds have the following characteristics:
${table(["", "Bond 1", "Bond 2"], [["\\text{Present value}", mn(PV), mn(PV)], ["\\text{Modified duration (years)}", n(D1, 3), n(D2, 3)]])}
If the annual effective interest rate ${up ? "increases" : "decreases"} by ${bp} basis points today, the first-order Macaulay approximations of the present value for Bond 1 and Bond 2 are ${n(E1, 2)} and $X$, respectively.
Calculate $X$.`,
          variables: { variant, PV, D1, D2, bp, E1 },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor(PV * (1 + (E1 / PV - 1) * (D2 / D1)), "CALCULATION_DISTRACTOR", "Scaled the change in value linearly by the durations."),
            distractor(PV * Math.pow(E1 / PV, D1 / D2), "CALCULATION_DISTRACTOR", "Inverted the ratio of durations."),
            distractor(E1 + (D2 - D1) * (E1 - PV), "CALCULATION_DISTRACTOR", "Added the difference in durations times the change."),
            distractor(PV * Math.pow(PV / E1, D2 / D1), "CALCULATION_DISTRACTOR", "Inverted the ratio of values."),
          ],
          solutionSteps: `**Step 1 — Shared factor.** Under the first-order Macaulay approximation, $E_k = PV\\left(\\frac{1 + i_0}{1 + i}\\right)^{D_{mod,k}(1 + i_0)}$, so both bonds use the same factor $\\left(\\frac{1 + i_0}{1 + i}\\right)^{1 + i_0}$ raised to their modified durations.

**Step 2 — From Bond 1.** That factor to the power ${n(D1, 3)} is $${mn(E1, 2)}/${mn(PV)} = ${dec(E1 / PV, 6)}$.

**Step 3 — Bond 2.** $X = ${mn(PV)}(${dec(E1 / PV, 6)})^{${n(D2, 3)}/${n(D1, 3)}} = ${mn(key, 2)}$.`,
          checks: [{ label: "direct computation agrees", ok: Math.abs(key - PV * Math.pow((1 + i0) / (1 + i1), D2 * (1 + i0))) < 0.05 }],
        };
      }
      const R = gridAmount(rng, 1000, 20000, 1000);
      const i0 = gridRate(rng, 0.04, 0.1, 0.005);
      const i1 = Number((i0 + rng.choice([-0.02, -0.01, 0.01, 0.02])).toFixed(6));
      const L = (R * (1 + i0)) / i0;
      const Dmod = 1 / i0 / (1 + i0);
      const M = L * (1 - Dmod * (i1 - i0));
      const key = M - L;
      return {
        questionText: `A perpetuity pays ${n(R)} at the beginning of each year. The present value of the payments calculated using an annual effective interest rate of ${pc(i0)} is $L$.
The annual effective interest rate ${i1 < i0 ? "decreases" : "increases"} to ${pc(i1)} immediately after the perpetuity is purchased. Using the first-order modified duration approximation, the estimated present value of the payments is $M$.
Calculate $M - L$.`,
        variables: { variant: "PERPETUITY", R, i0, i1 },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(L * (1 - (1 / i0) * (i1 - i0)) - L, "CALCULATION_DISTRACTOR", "Used the perpetuity-due's Macaulay duration as if modified."),
          distractor((R * (1 + i1)) / i1 - L, "CALCULATION_DISTRACTOR", "Gave the exact change instead of the approximation."),
          distractor(L * (1 - ((1 + i0) / i0) * (i1 - i0)) - L, "CALCULATION_DISTRACTOR", "Used the perpetuity-immediate's Macaulay duration."),
        ],
        solutionSteps: `**Step 1 — Value and modified duration.** $L = ${mn(R)}(${dec(1 + i0, 3)})/${dec(i0, 3)} = ${mn(L, 2)}$. A perpetuity-due's Macaulay duration is $1/i$, so its modified duration is $\\frac{1}{i(1+i)} = ${dec(Dmod, 5)}$.

**Step 2 — Estimate.** $M = ${mn(L, 2)}[1 - ${dec(Dmod, 5)}(${dec(i1 - i0, 3)})] = ${mn(M, 2)}$, so $M - L = ${mn(key, 2)}$.`,
        checks: [{ label: "direction", ok: key * (i1 - i0) < 0 }],
      };
    },
  },

  {
    id: "FM_ALM_APPROX_ERROR",
    domain: ALM,
    title: "Error in a First-Order Approximation",
    objective: "Compare a first-order duration estimate of a perpetuity's price with its exact price at the new rate.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 3,
    soaSamples: [440, 460, 461],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const due = rng.next() < 0.5;
      const method = rng.choice(["MOD", "MAC"] as const);
      const g = -rng.choice([0, 0, 0.005, 0.01, 0.02]);
      const i0 = gridRate(rng, 0.04, 0.1, 0.0025);
      const i1 = Number((i0 + rng.choice([-0.01, -0.005, 0.005, 0.01])).toFixed(6));
      const price = (i: number) => (due ? (1 + i) / (i - g) : 1 / (i - g));
      const mac = due ? (1 + g) / (i0 - g) : (1 + i0) / (i0 - g);
      const M = price(i0);
      const P = price(i1);
      const E = method === "MOD" ? M * (1 - (mac / (1 + i0)) * (i1 - i0)) : M * Math.pow((1 + i0) / (1 + i1), mac);
      const key = ((E - P) / P) * 100;
      const Ewrong = method === "MOD" ? M * Math.pow((1 + i0) / (1 + i1), mac) : M * (1 - (mac / (1 + i0)) * (i1 - i0));
      // The duration of the other kind of perpetuity (immediate for due, due for immediate).
      const macOther = due ? (1 + i0) / (i0 - g) : (1 + g) / (i0 - g);
      const Eother = method === "MOD" ? M * (1 - (macOther / (1 + i0)) * (i1 - i0)) : M * Math.pow((1 + i0) / (1 + i1), macOther);
      const paymentText = g === 0 ? "level annual payments of 1" : `annual payments. The first payment is 1, and each subsequent payment is ${pc(-g, 2)} less than the previous payment`;
      return {
        questionText: `A ${g === 0 ? "" : "geometric "}perpetuity-${due ? "due" : "immediate"} provides ${paymentText}. Let $M$ be the price of this perpetuity using an annual effective interest rate of ${pc(i0, 2)}.
The price should have been calculated using an annual effective interest rate of ${pc(i1, 2)}. Let $P$ be the correct price of this perpetuity and let $E$ be the estimate of $P$ based on the initial price, $M$, using the first-order ${method === "MOD" ? "modified" : "Macaulay"} approximation.
Calculate $\\frac{E - P}{P}$, the percentage error of the estimate.`,
        variables: { due: due ? 1 : 0, method, g, i0, i1 },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor(((Ewrong - P) / P) * 100, "CALCULATION_DISTRACTOR", `Used the ${method === "MOD" ? "Macaulay" : "modified"} approximation.`),
          distractor(((E - P) / M) * 100, "CALCULATION_DISTRACTOR", "Divided by the initial price instead of the correct price."),
          distractor(((P - E) / P) * 100, "CALCULATION_DISTRACTOR", "Reversed the sign of the error."),
          distractor(((Eother - P) / P) * 100, "ANNUITY_DUE_CONFUSION", `Used the perpetuity-${due ? "immediate" : "due"} duration.`),
        ],
        solutionSteps: `**Step 1 — Prices.** With growth $g = ${g}$, the price is ${due ? "$(1 + i)/(i - g)$" : "$1/(i - g)$"}: $M = ${dec(M, 5)}$ and $P = ${dec(P, 5)}$.

**Step 2 — Duration and estimate.** The Macaulay duration at ${pc(i0, 2)} is ${due ? "$(1 + g)/(i - g)$" : "$(1 + i)/(i - g)$"} $= ${dec(mac, 5)}$${method === "MOD" ? `, modified $${dec(mac / (1 + i0), 5)}$, so $E = M[1 - D_{mod}(${dec(i1 - i0, 4)})] = ${dec(E, 5)}$` : `, so $E = M\\left(\\frac{${dec(1 + i0, 4)}}{${dec(1 + i1, 4)}}\\right)^{${dec(mac, 5)}} = ${dec(E, 5)}$`}.

**Step 3 — Error.** $\\frac{${dec(E, 5)} - ${dec(P, 5)}}{${dec(P, 5)}} = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
        checks: [{ label: "first-order estimates underestimate", ok: E < P }],
      };
    },
  },

  {
    id: "FM_ALM_CONCEPT_DURATION",
    domain: ALM,
    title: "Properties of Duration and Convexity",
    objective: "Recognise how duration and convexity respond to the term, coupon rate, face amount and yield rate.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 2,
    qualitative: true,
    soaSamples: [185, 223, 145, 320, 390],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pairs: StatementPair[] = [
        {
          truth: "The modified duration of an $n$-year zero-coupon bond at yield rate $i$ is $n/(1+i)$.",
          falsehood: "The modified duration of an $n$-year zero-coupon bond at yield rate $i$ is $n(1+i)$.",
          why: "Its Macaulay duration is $n$, and modified duration is Macaulay duration divided by $1 + i$.",
        },
        {
          truth: "Increasing the face amount of a bond, with the coupon rate and yield rate unchanged, leaves its Macaulay duration unchanged.",
          falsehood: "Increasing the face amount of a bond, with the coupon rate and yield rate unchanged, increases its Macaulay duration.",
          why: "Every cash flow scales by the same factor, which cancels in the ratio.",
        },
        {
          truth: "Increasing the coupon rate of a bond, other things equal, decreases its Macaulay duration.",
          falsehood: "Increasing the coupon rate of a bond, other things equal, increases its Macaulay duration.",
          why: "Larger coupons put more weight on the earlier payments.",
        },
        {
          truth: "For two bonds valued at the same yield rate, the ratio of their Macaulay durations equals the ratio of their modified durations.",
          falsehood: "For two bonds valued at the same yield rate, the ratio of their Macaulay durations exceeds the ratio of their modified durations by the factor $1 + i$.",
          why: "Both modified durations are the Macaulay durations divided by the same $1 + i$.",
        },
        {
          truth: "The Macaulay duration of a portfolio is the average of the Macaulay durations of its holdings weighted by their present values.",
          falsehood: "The Macaulay duration of a portfolio is the average of the Macaulay durations of its holdings weighted by their face amounts.",
          why: "Duration is a present-value-weighted average of payment times, and so is the portfolio's.",
        },
        {
          truth: "For positive cash flows, the Macaulay duration decreases as the yield rate increases.",
          falsehood: "For positive cash flows, the Macaulay duration increases as the yield rate increases.",
          why: "A higher rate shrinks the present values of later payments more, shifting weight toward earlier times.",
        },
        {
          truth: "The Macaulay duration of a level perpetuity-immediate at rate $i$ is $(1+i)/i$.",
          falsehood: "The Macaulay duration of a level perpetuity-immediate at rate $i$ is $1/i$.",
          why: "Its modified duration is $1/i$; multiplying by $1 + i$ gives $(1+i)/i$.",
        },
        {
          truth: "The Macaulay convexity of a set of positive cash flows is at least the square of its Macaulay duration.",
          falsehood: "The Macaulay convexity of a set of positive cash flows is at most the square of its Macaulay duration.",
          why: "Convexity less duration squared is the present-value-weighted variance of the payment times, which cannot be negative.",
        },
      ];
      if (rng.next() < 0.5) {
        const { questionText, choices, solutionSteps } = romanStatements(rng, {
          lead: "Consider the Macaulay and modified durations and convexities of sets of positive cash flows valued at an annual effective yield rate $i > 0$.",
          pairs,
        });
        return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps, fixedOrder: true };
      }
      const { questionText, choices, solutionSteps } = oneOfFive(rng, {
        lead: "Consider the Macaulay and modified durations and convexities of sets of positive cash flows valued at an annual effective yield rate $i > 0$.",
        pairs,
        askFalse: rng.next() < 0.4,
      });
      return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps };
    },
  },
];

function amountFormatFor(value: number): "AMOUNT_0" | "AMOUNT_2" {
  return Math.abs(value) < 200 ? "AMOUNT_2" : "AMOUNT_0";
}

function cents2(value: number): number {
  return Math.round(value * 100) / 100;
}
