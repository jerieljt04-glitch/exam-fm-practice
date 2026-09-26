/**
 * General cash flows and the term structure: spot and forward rates, net
 * present value, and yield rates of projects — modelled on the SOA sample-set
 * question types for the general cash flows part of the syllabus.
 */
import type { Rng } from "../../random";
import {
  distractor,
  type AuthoredChoice,
  type GeneratedChoiceQuestionItem,
  type GeneratedQuestionItem,
  type QuestionTemplateDefinition,
} from "../types";
import {
  acc,
  adue,
  amt,
  an,
  bondFlows,
  cents,
  close,
  dec,
  drawUntil,
  gridAmount,
  gridRate,
  listing,
  mn,
  mpc,
  n,
  ord,
  pc,
  pv,
  pvAtSpots,
  sn,
  solve,
  table,
  trySolve,
  v,
  word,
  type Flow,
} from "./kit";

const ALM = "ALM_IMMUNIZATION" as const;

const amountFormat = (value: number) => (Math.abs(value) < 200 ? "AMOUNT_2" : "AMOUNT_0") as "AMOUNT_2" | "AMOUNT_0";

/** A term structure of spot rates on a 0.25% grid: rising, falling or humped. */
function drawSpots(rng: Rng, count: number): number[] {
  const shape = rng.choice(["UP", "UP", "UP", "DOWN", "HUMP"] as const);
  const base = gridRate(rng, 0.02, 0.07, 0.0025);
  const step = rng.choice([0.0025, 0.005, 0.0075, 0.01]);
  return Array.from({ length: count }, (_, k) => {
    const shift = shape === "UP" ? k * step : shape === "DOWN" ? -k * step : (k < count / 2 ? k : count - 1 - k) * step;
    return Number((base + shift + (shape === "DOWN" ? (count - 1) * step : 0)).toFixed(6));
  });
}

/** The spot-rate table as the sample set prints it. */
function spotTable(spots: readonly number[], label = "Spot rate"): string {
  return table(["Term (years)", label], spots.map((s, k) => [String(k + 1), mpc(s)]));
}

/** Yield rate of a price against a list of cash flows. */
function yieldOf(price: number, flows: readonly Flow[]): number {
  return solve((i) => pv(flows, i) - price, -0.5, 2);
}

export const SOA_ALM_RATE_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ALM_PRICE_FROM_SPOTS",
    domain: ALM,
    title: "Present Value from Spot Rates",
    objective: "Value a bond or a stream of cash flows by discounting each payment at the spot rate for its own term.",
    difficulty: 1,
    topics: ["BONDS_AND_CURVES", "GENERAL_CASH_FLOWS"],
    steps: 2,
    soaSamples: [28, 225],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const count = rng.int(3, 5);
      const spots = drawSpots(rng, count);
      const isBond = rng.next() < 0.5;
      let flows: Flow[];
      let stem: string;
      let variables: Record<string, number | string | number[]>;
      if (isBond) {
        const F = rng.choice([100, 1000, 1000, 1000]);
        const r = gridRate(rng, 0.03, 0.1, 0.005);
        flows = bondFlows(F * r, F, count);
        const spotsText =
          count === 3
            ? `You are also given that the one-, two-, and three-year annual spot interest rates are ${listing(spots.map((s) => pc(s)))}, respectively.`
            : `You are also given the following annual spot interest rates:\n${spotTable(spots)}`;
        stem = `You are given the following information with respect to a bond:
(i) par value: ${n(F)}
(ii) term to maturity: ${count} years
(iii) annual coupon rate: ${pc(r)} payable annually
${spotsText}
Calculate the value of the bond.`;
        variables = { variant: "BOND", F, r, spots };
      } else {
        const amounts = Array.from({ length: count }, () => gridAmount(rng, 5, 60, 1));
        flows = amounts.map((a, k) => [k + 1, a] as const);
        stem = `The table below shows the cash flows for a particular investment and the prevailing spot rates.
${table(["n", "Cash flow (end of year n)", "n-year spot rate"], amounts.map((a, k) => [String(k + 1), mn(a), mpc(spots[k])]))}
Calculate the present value of this investment at the start of year 1.`;
        variables = { variant: "FLOWS", amounts, spots };
      }
      const value = pvAtSpots(flows, spots);
      const mean = spots.reduce((s, x) => s + x, 0) / count;
      return {
        questionText: stem,
        variables,
        correctValue: value,
        format: amountFormat(value),
        distractors: [
          distractor(pv(flows, spots[count - 1]), "CALCULATION_DISTRACTOR", "Discounted every payment at the longest spot rate."),
          distractor(pv(flows, spots[0]), "CALCULATION_DISTRACTOR", "Discounted every payment at the one-year spot rate."),
          distractor(pv(flows, mean), "CALCULATION_DISTRACTOR", "Discounted every payment at the average spot rate."),
          distractor(flows.reduce((s, [t, a]) => s + a / (1 + spots[t - 1] * t), 0), "SIMPLE_INTEREST_ERROR", "Discounted with simple interest at each spot rate."),
        ],
        solutionSteps: `**Step 1 — Discount each payment at its own spot rate.** A payment at time $t$ is divided by $(1 + s_t)^t$:
${flows.map(([t, a]) => `- time ${t}: $${mn(a, 2)}/(${dec(1 + spots[t - 1], 4)})^{${t}} = ${mn(a * v(spots[t - 1], t), 4)}$`).join("\n")}

**Step 2 — Add.** The value is ${n(value, 2)}.`,
        checks: [{ label: "at least one spot differs", ok: spots.some((s) => s !== spots[0]) }],
      };
    },
  },

  {
    id: "FM_ALM_YIELD_FROM_SPOTS",
    domain: ALM,
    title: "Yield Rate Implied by Spot Rates",
    objective: "Price cash flows off the spot curve, then find the single rate that gives the same price.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES", "GENERAL_CASH_FLOWS"],
    steps: 3,
    soaSamples: [29, 404, 408],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const count = rng.int(3, 5);
      const spots = drawSpots(rng, count);
      const isBond = rng.next() < 0.55;
      let flows: Flow[];
      let stem: string;
      let variables: Record<string, number | string | number[]>;
      if (isBond) {
        const F = 1000;
        const r = gridRate(rng, 0.02, 0.1, 0.005);
        flows = bondFlows(F * r, F, count);
        stem = `The following term structure of interest rates is based on available bond market data:
${spotTable(spots)}
A ${word(count)}-year ${n(F)} face amount bond with an annual coupon rate of ${pc(r)} paid annually is issued today and sold at a price equal to its value under this term structure.
Calculate the yield to maturity for this bond.`;
        variables = { variant: "BOND", F, r, spots };
      } else {
        flows = Array.from({ length: count }, (_, k) => [k + 1, 1] as const);
        stem = `You are given the following table of spot rates to calculate the present value of a level ${word(count)}-year annuity-immediate:
${spotTable(spots)}
Calculate the annual effective interest rate for this annuity.`;
        variables = { variant: "ANNUITY", spots };
      }
      const value = pvAtSpots(flows, spots);
      const y = yieldOf(value, flows);
      const mean = spots.reduce((s, x) => s + x, 0) / count;
      const weighted = flows.reduce((s, [t, a]) => s + a * spots[t - 1], 0) / flows.reduce((s, [, a]) => s + a, 0);
      return {
        questionText: stem,
        variables,
        correctValue: y * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(spots[count - 1] * 100, "CALCULATION_DISTRACTOR", "Took the longest spot rate as the yield."),
          distractor(mean * 100, "CALCULATION_DISTRACTOR", "Averaged the spot rates."),
          distractor(weighted * 100, "CALCULATION_DISTRACTOR", "Averaged the spot rates weighted by the undiscounted payments."),
          distractor(spots[0] * 100, "CALCULATION_DISTRACTOR", "Took the one-year spot rate as the yield."),
        ],
        solutionSteps: `**Step 1 — Value at the spot rates.**
$$${flows.map(([t, a]) => `\\frac{${mn(a, 2)}}{(${dec(1 + spots[t - 1], 4)})^{${t}}}`).join(" + ")} = ${mn(value, 4)}.$$

**Step 2 — Single rate with the same value.** Solve $${mn(value, 4)} = ${isBond ? `${mn(flows[0][1], 2)}\\,a_{\\overline{${count}}|i} + ${mn(1000)}v^{${count}}` : `a_{\\overline{${count}}|i}`}$ for $i$ (financial calculator).

**Step 3 — Result.** $i = ${dec(y, 6)}$, that is, ${(y * 100).toFixed(3)}%.`,
        checks: [{ label: "yield reprices", ok: close(pv(flows, y), value, 1e-9) }],
      };
    },
  },

  {
    id: "FM_ALM_FORWARD_RATE",
    domain: ALM,
    title: "Forward Rates from the Term Structure",
    objective: "Move between spot rates, zero-coupon prices and forward rates, including forward rates for periods longer than a year.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS", "BONDS_AND_CURVES"],
    steps: 2,
    soaSamples: [52, 73, 222, 294, 331, 99],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["ONE_YEAR", "ONE_YEAR", "MULTI", "ZERO_PRICES", "INDIFFERENCE", "SPOT_FROM_FORWARDS"] as const);
      if (variant === "SPOT_FROM_FORWARDS") {
        const count = rng.int(4, 6);
        const forwards = drawSpots(rng, count);
        const term = rng.int(2, count - 1);
        const product = forwards.slice(0, term).reduce((p, f) => p * (1 + f), 1);
        const key = (Math.pow(product, 1 / term) - 1) * 100;
        return {
          questionText: `The one-year forward rates, deferred $t$ years, are estimated to be:
${table(["Year (t)", "Forward rate"], forwards.map((f, k) => [String(k), mpc(f)]))}
Calculate the spot rate for a zero-coupon bond maturing ${word(term)} years from now.`,
          variables: { variant, forwards, term },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor((forwards.slice(0, term).reduce((s, f) => s + f, 0) / term) * 100, "CALCULATION_DISTRACTOR", "Took the arithmetic average of the forward rates."),
            distractor(forwards[term - 1] * 100, "CALCULATION_DISTRACTOR", "Took the last forward rate as the spot rate."),
            distractor((Math.pow(product * (1 + forwards[term]), 1 / (term + 1)) - 1) * 100, "OFF_BY_ONE_PERIOD", "Included one forward rate too many."),
            distractor((product - 1) * 100, "CALCULATION_DISTRACTOR", `Gave the total growth over ${term} years instead of the annual rate.`),
          ],
          solutionSteps: `**Step 1 — Growth over ${term} years.** The forward rates for years 0 to ${term - 1} compound to
$$${forwards.slice(0, term).map((f) => `(${dec(1 + f, 4)})`).join("")} = ${dec(product, 6)}.$$

**Step 2 — Annual spot rate.** $s_{${term}} = ${dec(product, 6)}^{1/${term}} - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "spot reproduces growth", ok: close(Math.pow(1 + key / 100, term), product, 1e-12) }],
        };
      }
      const count = rng.int(4, 6);
      const spots = drawSpots(rng, count);
      const growth = (t: number) => acc(spots[t - 1], t);
      if (variant === "ZERO_PRICES") {
        const shown = Math.min(count, 4);
        const prices = Array.from({ length: shown }, (_, k) => Number(v(spots[k], k + 1).toFixed(5)));
        const k = rng.int(1, shown - 1);
        const key = (prices[k - 1] / prices[k] - 1) * 100;
        return {
          questionText: `The prices of zero-coupon bonds per unit of face amount are:
${table(["Maturity", "Price"], prices.map((p, t) => [String(t + 1), p.toFixed(5)]))}
Calculate the one-year forward rate, deferred ${word(k)} year${k === 1 ? "" : "s"}.`,
          variables: { variant, prices, k },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor((1 - prices[k] / prices[k - 1]) * 100, "CALCULATION_DISTRACTOR", "Gave the forward discount rate instead of the interest rate."),
            distractor((Math.pow(1 / prices[k], 1 / (k + 1)) - 1) * 100, "CALCULATION_DISTRACTOR", `Gave the ${k + 1}-year spot rate.`),
            distractor(k >= 2 ? (prices[k - 2] / prices[k - 1] - 1) * 100 : (1 / prices[0] - 1) * 100, "OFF_BY_ONE_PERIOD", "Deferred the forward rate one year too few."),
            distractor((prices[k - 1] - prices[k]) * 100, "CALCULATION_DISTRACTOR", "Took the difference in prices as the rate."),
          ],
          solutionSteps: `**Step 1 — Forward rate from prices.** A price $P_t$ discounts 1 from time $t$ to today, so moving 1 from time ${k + 1} back to time ${k} uses the factor $P_{${k + 1}}/P_{${k}} = 1/(1 + f)$.

**Step 2 — Compute.** $1 + f = ${prices[k - 1].toFixed(5)}/${prices[k].toFixed(5)} = ${dec(prices[k - 1] / prices[k], 6)}$, so $f = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "forward positive", ok: key > -5 && key < 25 }],
        };
      }
      if (variant === "ONE_YEAR") {
        const k = rng.int(1, count - 1);
        const f = growth(k + 1) / growth(k) - 1;
        const phrase = rng.next() < 0.5 ? `the one-year forward rate, deferred ${word(k)} year${k === 1 ? "" : "s"}, implied by this term structure` : `the one-year annual effective rate for the ${ord(k + 1)} year implied by this term structure`;
        return {
          questionText: `You are given the following term structure of interest rates:
${spotTable(spots)}
Calculate ${phrase}.`,
          variables: { variant, spots, k },
          correctValue: f * 100,
          format: "PERCENT_2",
          distractors: [
            distractor(spots[k] * 100, "CALCULATION_DISTRACTOR", `Took the ${k + 1}-year spot rate as the forward rate.`),
            distractor(k >= 2 ? (growth(k) / growth(k - 1) - 1) * 100 : spots[0] * 100, "OFF_BY_ONE_PERIOD", "Deferred the forward rate one year too few."),
            ...(k + 2 <= count ? [distractor((growth(k + 2) / growth(k + 1) - 1) * 100, "OFF_BY_ONE_PERIOD", "Deferred the forward rate one year too many.")] : []),
            distractor((spots[k] + spots[k] - spots[k - 1]) * 100, "CALCULATION_DISTRACTOR", "Extended the change in spot rates in a straight line."),
          ],
          solutionSteps: `**Step 1 — Relation.** Investing for ${k + 1} years at the spot rate equals investing for ${k} years and then one more year at the forward rate:
$$(1 + s_{${k + 1}})^{${k + 1}} = (1 + s_{${k}})^{${k}}(1 + f).$$

**Step 2 — Solve.** $1 + f = \\frac{(${dec(1 + spots[k], 4)})^{${k + 1}}}{(${dec(1 + spots[k - 1], 4)})^{${k}}} = \\frac{${dec(growth(k + 1), 6)}}{${dec(growth(k), 6)}} = ${dec(1 + f, 6)}$, so $f = ${dec(f, 6)}$, that is, ${(f * 100).toFixed(3)}%.`,
          checks: [{ label: "arbitrage-free growth", ok: close(growth(k) * (1 + f), growth(k + 1), 1e-12) }],
        };
      }
      // MULTI and INDIFFERENCE: an m-year rate starting k years from now.
      const k = rng.int(1, count - 2);
      const m = rng.int(2, count - k);
      const total = growth(k + m) / growth(k);
      const key = (Math.pow(total, 1 / m) - 1) * 100;
      const stem =
        variant === "MULTI"
          ? `The current yield rates for zero-coupon bonds are as follows:
${table(["Term (years)", "Annual effective yield rate"], spots.map((s, t) => [String(t + 1), mpc(s)]))}
Calculate the implied ${word(m)}-year spot rate at the end of year ${word(k)}.`
          : `Current loan rates are based on the following term structure of interest rates:
${spotTable(spots)}
A loan of ${n(gridAmount(rng, 2000, 20000, 1000))} is to be repaid with a single payment of principal plus interest at the end of ${word(k + m)} years. The borrower has two choices:
(i) a ${k + m}-year loan.
(ii) a ${k}-year loan to be repaid with a single payment of principal plus interest by taking out a ${m}-year loan at the beginning of year ${k + 1}.
Calculate the annual effective interest rate on the ${m}-year loan such that the borrower is indifferent between the two choices.`;
      return {
        questionText: stem,
        variables: { variant, spots, k, m },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor((total - 1) * 100, "CALCULATION_DISTRACTOR", `Gave the total growth over ${m} years instead of the annual rate.`),
          distractor(((total - 1) / m) * 100, "SIMPLE_INTEREST_ERROR", "Divided the total growth by the number of years."),
          distractor(spots[k + m - 1] * 100, "CALCULATION_DISTRACTOR", `Took the ${k + m}-year spot rate.`),
          distractor(((k + m) * spots[k + m - 1] - k * spots[k - 1]) / m * 100, "CALCULATION_DISTRACTOR", "Combined the spot rates linearly instead of compounding."),
        ],
        solutionSteps: `**Step 1 — Relation.** $(1 + s_{${k + m}})^{${k + m}} = (1 + s_{${k}})^{${k}}(1 + f)^{${m}}$, where $f$ is the ${m}-year rate starting at time ${k}.

**Step 2 — Growth over the ${m} years.** $(1 + f)^{${m}} = \\frac{(${dec(1 + spots[k + m - 1], 4)})^{${k + m}}}{(${dec(1 + spots[k - 1], 4)})^{${k}}} = ${dec(total, 6)}$.

**Step 3 — Annual rate.** $f = ${dec(total, 6)}^{1/${m}} - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
        checks: [{ label: "arbitrage-free growth", ok: close(growth(k) * Math.pow(1 + key / 100, m), growth(k + m), 1e-12) }],
      };
    },
  },

  {
    id: "FM_ALM_ZERO_PRICE_SAVINGS",
    domain: ALM,
    title: "Accumulating a Target with Zero-Coupon Bonds",
    objective: "Accumulate a target by buying zero-coupon bonds at quoted prices, using the reciprocal of each price as its growth factor.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS"],
    steps: 2,
    soaSamples: [91],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const monthly = rng.next() < 0.6;
      const count = monthly ? 6 : 4;
      const unit = monthly ? "month" : "quarter";
      const drop = rng.choice([0.25, 0.5, 0.75, 1, 1.25]);
      const prices = Array.from({ length: count }, (_, k) => Number((100 - drop * (k + 1) - (rng.next() < 0.3 ? 0.25 : 0)).toFixed(2)));
      for (let k = 1; k < count; k += 1) if (prices[k] >= prices[k - 1]) prices[k] = Number((prices[k - 1] - 0.25).toFixed(2));
      const target = gridAmount(rng, 20000, 200000, 5000);
      const growth = prices.reduce((s, p) => s + 100 / p, 0);
      const X = target / growth;
      return {
        questionText: `A company plans to invest $X$ at the beginning of each ${unit} in a zero-coupon bond in order to accumulate ${n(target)} at the end of ${word(count)} ${unit}s. The price of each bond as a percentage of redemption value is given in the following chart:
${table([`Maturity (${unit}s)`, "Price"], prices.map((p, k) => [String(k + 1), `${p}\\%`]))}
Calculate $X$ given that the bond prices will not change during the ${word(count)}-${unit} period.`,
        variables: { prices, target, count },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(target / count, "CALCULATION_DISTRACTOR", "Ignored the growth from the bonds."),
          distractor(target / prices.reduce((s, p) => s + p / 100, 0), "CALCULATION_DISTRACTOR", "Multiplied by the prices instead of dividing by them."),
          distractor((target * prices[count - 1]) / 100 / count, "CALCULATION_DISTRACTOR", `Discounted the target with the ${count}-${unit} price and spread it evenly.`),
          distractor(target / prices.slice(0, count - 1).reduce((s, p) => s + 100 / p, 0), "OFF_BY_ONE_PERIOD", `Made only ${count - 1} purchases.`),
        ],
        solutionSteps: `**Step 1 — Growth of each purchase.** The purchase made at the start of ${unit} $k$ buys a bond maturing at the end of ${unit} ${count}, so it grows by the reciprocal of the price for its remaining term. The purchases use the ${count}-, ${count - 1}-, ..., 1-${unit} bonds, one each.

**Step 2 — Solve.** $X\\left(${prices.map((p) => `\\frac{1}{${(p / 100).toFixed(4)}}`).join(" + ")}\\right) = ${mn(target)}$, so $X = ${mn(target)}/${dec(growth, 5)} = ${mn(X, 2)}$.`,
        checks: [{ label: "prices decreasing", ok: prices.every((p, k) => k === 0 || p < prices[k - 1]) }],
      };
    },
  },

  {
    id: "FM_ALM_NPV",
    domain: ALM,
    title: "Net Present Value of a Project",
    objective: "Discount a project's outlays and returns, including returns reinvested at a different rate before the horizon.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS"],
    steps: 2,
    soaSamples: [180, 27],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const { I0, I1, I2, R, years, i } = drawUntil(
          () => ({
            I0: gridAmount(rng, 300, 1000, 50),
            I1: gridAmount(rng, 50, 200, 10),
            I2: gridAmount(rng, 20, 150, 10),
            R: gridAmount(rng, 100, 300, 10),
            years: rng.int(4, 8),
            i: gridRate(rng, 0.05, 0.15, 0.01),
          }),
          (p) => Math.abs(-p.I0 - p.I1 * v(p.i, 1) - p.I2 * v(p.i, 2) + p.R * an(p.years, p.i)) > 20,
          { I0: 600, I1: 100, I2: 50, R: 150, years: 5, i: 0.15 }
        );
        const npv = -I0 - I1 * v(i, 1) - I2 * v(i, 2) + R * an(years, i);
        return {
          questionText: `A company is considering a project that will require an initial investment of ${n(I0)} and additional investments of ${n(I1)} and ${n(I2)} at the end of years one and two, respectively. It is expected that revenue from this project will be ${n(R)} per year for ${word(years)} years, beginning one year from the initial investment.
Assuming an annual effective rate of ${pc(i)}, calculate the net present value of this project.`,
          variables: { variant: "PLAIN", I0, I1, I2, R, years, i },
          correctValue: npv,
          format: "AMOUNT_0",
          distractors: [
            distractor(-I0 + R * an(years, i), "CALCULATION_DISTRACTOR", "Left out the additional investments."),
            distractor(-I0 - I1 * v(i, 1) - I2 * v(i, 2) + R * adue(years, i), "ANNUITY_DUE_CONFUSION", "Treated the revenue as payable at the start of each year."),
            distractor(-I0 - I1 - I2 + R * an(years, i), "CALCULATION_DISTRACTOR", "Did not discount the additional investments."),
            distractor(-I0 - I1 * v(i, 1) - I2 * v(i, 2) + R * years, "CALCULATION_DISTRACTOR", "Did not discount the revenue."),
          ],
          solutionSteps: `**Step 1 — Outlays.** $${mn(I0)} + ${mn(I1)}v + ${mn(I2)}v^2 = ${mn(I0 + I1 * v(i, 1) + I2 * v(i, 2), 2)}$ at ${pc(i)}.

**Step 2 — Revenue and NPV.** $${mn(R)}\\,a_{\\overline{${years}}|${mpc(i)}} = ${mn(R * an(years, i), 2)}$, so the NPV is $${mn(R * an(years, i), 2)} - ${mn(I0 + I1 * v(i, 1) + I2 * v(i, 2), 2)} = ${mn(npv, 2)}$.`,
          checks: [{ label: "not negligible", ok: Math.abs(npv) > 5 }],
        };
      }
      const params = drawUntil(
        () => {
          const years = rng.int(3, 6);
          const first = rng.int(2, years - 1);
          const count = years - first + 1;
          const C = gridAmount(rng, 10000, 120000, 5000);
          const P = Math.round((C * count * rng.choice([0.8, 0.85, 0.9, 0.95])) / 5000) * 5000;
          return { years, first, count, C, P, r: gridRate(rng, 0.02, 0.06, 0.005), i: gridRate(rng, 0.03, 0.08, 0.005) };
        },
        (p) => {
          const value = -p.P + p.C * sn(p.count, p.r) * v(p.i, p.years);
          return Math.abs(value) > 200 && Math.abs(value) < 0.2 * p.P && p.r !== p.i;
        },
        { years: 4, first: 3, count: 2, C: 60000, P: 100000, r: 0.04, i: 0.05 }
      );
      const { years, first, count, C, P, r, i } = params;
      const npv = -P + C * sn(count, r) * v(i, years);
      const years1 = Array.from({ length: count }, (_, k) => first + k);
      return {
        questionText: `An investor pays ${n(P)} today for a ${word(years)}-year investment that returns cash flows of ${n(C)} at the end of each of years ${listing(years1)}. The cash flows can be reinvested at ${pc(r)} per annum effective until the end of year ${years}.
Using an annual effective interest rate of ${pc(i)}, calculate the net present value of this investment today.`,
        variables: { variant: "REINVEST", P, years, first, C, r, i },
        correctValue: npv,
        format: "AMOUNT_0",
        distractors: [
          distractor(-P + years1.reduce((s, t) => s + C * v(i, t), 0), "CALCULATION_DISTRACTOR", "Ignored the reinvestment and discounted each cash flow directly."),
          distractor(-P + C * sn(count, r) * v(r, years), "CALCULATION_DISTRACTOR", "Discounted at the reinvestment rate."),
          distractor(-P + C * count * v(i, years), "SIMPLE_INTEREST_ERROR", "Did not accumulate the cash flows with interest."),
          distractor(-P + C * sn(count, r) * v(i, first), "CALCULATION_DISTRACTOR", `Discounted the accumulated value from year ${first} instead of year ${years}.`),
        ],
        solutionSteps: `**Step 1 — Value at the end of year ${years}.** The ${count} cash flows accumulate at ${pc(r)}: $${mn(C)}\\,s_{\\overline{${count}}|${mpc(r)}} = ${mn(C * sn(count, r), 2)}$.

**Step 2 — NPV.** $${mn(C * sn(count, r), 2)}(${dec(1 + i, 3)})^{-${years}} - ${mn(P)} = ${mn(npv, 2)}$.`,
        checks: [{ label: "not negligible", ok: Math.abs(npv) > 100 }],
      };
    },
  },

  {
    id: "FM_ALM_PROJECT_SELECTION",
    domain: ALM,
    title: "Choosing Projects by Net Present Value",
    objective: "Rank projects by net present value and choose the best allowed combination.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS"],
    steps: 2,
    qualitative: true,
    soaSamples: [124],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const i = gridRate(rng, 0.06, 0.12, 0.01);
      const I = gridAmount(rng, 500, 1000, 50);
      const limit = rng.choice([1, 2, 2]);
      const params = drawUntil(
        () => {
          const projects = [0, 1, 2].map(() => {
            const first = gridAmount(rng, 0.4 * I, 0.8 * I, 25);
            return [first, gridAmount(rng, 0.2 * I, 0.6 * I, 25), -gridAmount(rng, 0.1 * I, 0.3 * I, 25), gridAmount(rng, 0.05 * I, 0.3 * I, 25), gridAmount(rng, 0, 0.3 * I, 25)];
          });
          const npvs = projects.map((flows) => -I + flows.reduce((s, a, k) => s + a * v(i, k + 1), 0));
          return { projects, npvs };
        },
        (p) => {
          const sorted = p.npvs.slice().sort((a, b) => b - a);
          return p.npvs.every((x) => Math.abs(x) > 5) && sorted[0] - sorted[1] > 5 && sorted[1] - sorted[2] > 5;
        },
        { projects: [[500, 500, -175, 100, 0], [500, 300, -175, 150, 200], [500, 250, -175, 200, 200]], npvs: [0, 0, 0] }
      );
      const { projects } = params;
      const npvs = projects.map((flows) => -I + flows.reduce((s, a, k) => s + a * v(i, k + 1), 0));
      const names = ["A", "B", "C"];
      const positive = [0, 1, 2].filter((k) => npvs[k] > 0).sort((a, b) => npvs[b] - npvs[a]);
      const chosen = positive.slice(0, limit).sort();
      const label = (set: number[]) =>
        set.length === 0 ? "None of the projects" : set.length === 1 ? `Project ${names[set[0]]} only` : `Projects ${set.map((k) => names[k]).join(" and ")}`;
      const all = [[0], [1], [2], [0, 1], [0, 2], [1, 2], []];
      const key = label(chosen);
      const others = rng.shuffle(all.map(label).filter((text) => text !== key)).slice(0, 4);
      const order = all.map(label);
      const texts = [key, ...others].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const choices: AuthoredChoice[] = texts.map((text) => ({
        text,
        isCorrect: text === key,
        type: text === key ? undefined : ("CALCULATION_DISTRACTOR" as const),
        explanation: text === key ? "Takes every allowed project with positive NPV, largest first." : `The NPVs are ${npvs.map((x, k) => `${names[k]}: ${n(x, 2)}`).join(", ")}.`,
      }));
      return {
        kind: "CHOICE",
        questionText: `A company received approval to start no more than ${word(limit)} project${limit === 1 ? "" : "s"} in the current calendar year. Three different projects were recommended, each of which requires an investment of ${n(I)} to be made at the beginning of the year.
The cash flows for each of the three projects are as follows:
${table(["End of year", "Project A", "Project B", "Project C"], [0, 1, 2, 3, 4].map((k) => [String(k + 1), mn(projects[0][k]), mn(projects[1][k]), mn(projects[2][k])]))}
The company uses an annual effective interest rate of ${pc(i)} to discount its cash flows.
Determine which combination of projects the company should select.`,
        variables: { i, I, limit, A: projects[0], B: projects[1], C: projects[2] },
        choices,
        fixedOrder: true,
        solutionSteps: `**Step 1 — Net present value of each project.** At ${pc(i)}, NPV = $-${mn(I)} + \\sum_t CF_t v^t$:
${[0, 1, 2].map((k) => `- Project ${names[k]}: ${n(npvs[k], 2)}`).join("\n")}

**Step 2 — Select.** Take projects with positive NPV, largest first, up to ${word(limit)}: **${key}**.`,
      };
    },
  },

  {
    id: "FM_ALM_PROJECT_YIELD",
    domain: ALM,
    title: "Yield Rate of a Project",
    objective: "Set up a project's net cash flows and solve for the yield rate, including a reinvestment rate that makes NPV zero.",
    difficulty: 3,
    topics: ["GENERAL_CASH_FLOWS", "TIME_VALUE"],
    steps: 3,
    soaSamples: [143, 241],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const params = drawUntil(
          () => {
            const D = gridAmount(rng, 300, 1000, 50);
            const years = rng.int(3, 5);
            const rf = gridRate(rng, 0.03, 0.06, 0.005);
            const claim = gridAmount(rng, 0.1 * D, 0.25 * D, 10);
            const share = rng.choice([0.5, 0.6, 0.7, 0.75, 0.8]);
            const E0 = gridAmount(rng, 0.1 * D, 0.25 * D, 10);
            const k = rng.int(1, years - 1);
            const fee = gridAmount(rng, 0.1 * D, 0.3 * D, 5);
            const balance = D * acc(rf, years) - claim * sn(years, rf);
            const flows: Flow[] = [[0, -E0], [k, fee], [years, (1 - share) * balance]];
            const y = trySolve((x) => pv(flows, x), -0.5, 3);
            return { D, years, rf, claim, share, E0, k, fee, balance, y };
          },
          (p) => p.balance > 0 && p.y > 0.03 && p.y < 0.6,
          { D: 500, years: 4, rf: 0.05, claim: 100, share: 0.75, E0: 100, k: 2, fee: 125, balance: 176.74, y: 0.24 }
        );
        const { D, years, rf, claim, share, E0, k, fee, balance } = params;
        const flows: Flow[] = [[0, -E0], [k, fee], [years, (1 - share) * balance]];
        const y = solve((x) => pv(flows, x), -0.5, 3);
        const wrongShare = trySolve((x) => pv([[0, -E0], [k, fee], [years, share * balance]], x), -0.5, 5);
        return {
          questionText: `An insurer enters into a ${word(years)}-year contract today. The contract requires the insured to deposit ${n(D)} into a fund that earns an annual effective rate of ${pc(rf)}, and from which all claims will be paid.
The insurer expects that ${n(claim)} in claims will be paid at the end of each year, for the next ${word(years)} years. At the end of the ${ord(years)} year, after all claims are paid, the insurer is required to return ${pc(share)} of the remaining fund balance to the insured.
To issue this policy, the insurer incurs ${n(E0)} in expenses today. It also collects a fee of ${n(fee)} at the end of ${word(k)} year${k === 1 ? "" : "s"}.
Calculate the insurer's yield rate.`,
          variables: { variant: "INSURER", D, years, rf, claim, share, E0, k, fee },
          correctValue: y * 100,
          format: "PERCENT_2",
          distractors: [
            distractor(wrongShare * 100, "CALCULATION_DISTRACTOR", `Kept ${pc(share)} of the fund instead of ${pc(1 - share)}.`),
            distractor(trySolve((x) => pv([[0, -E0], [years, (1 - share) * balance]], x), -0.5, 3) * 100, "CALCULATION_DISTRACTOR", "Left out the fee."),
            distractor(trySolve((x) => pv([[0, -E0], [k, fee], [years, (1 - share) * D * acc(rf, years)]], x), -0.5, 5) * 100, "CALCULATION_DISTRACTOR", "Forgot to pay the claims out of the fund."),
            distractor(trySolve((x) => pv([[0, -E0], [years, fee + (1 - share) * balance]], x), -0.5, 3) * 100, "CALCULATION_DISTRACTOR", "Treated the fee as received at the end of the contract."),
          ],
          solutionSteps: `**Step 1 — Fund balance at the end.** $${mn(D)}(${dec(1 + rf, 3)})^{${years}} - ${mn(claim)}\\,s_{\\overline{${years}}|${mpc(rf)}} = ${mn(balance, 2)}$; the insurer keeps $${dec(1 - share, 2)}(${mn(balance, 2)}) = ${mn((1 - share) * balance, 2)}$.

**Step 2 — Insurer's cash flows.** Pays ${n(E0)} at time 0, receives ${n(fee)} at time ${k} and ${n((1 - share) * balance, 2)} at time ${years}.

**Step 3 — Yield.** Solve $-${mn(E0)} + ${mn(fee)}v^{${k}} + ${mn((1 - share) * balance, 2)}v^{${years}} = 0$: $i = ${dec(y, 6)}$, that is, ${(y * 100).toFixed(3)}%.`,
          checks: [{ label: "unique sign change", ok: E0 > 0 && fee > 0 && (1 - share) * balance > 0 }],
        };
      }
      const params = drawUntil(
        () => {
          const P = gridAmount(rng, 1000, 10000, 100);
          const years = rng.int(3, 8);
          const r = gridRate(rng, 0.03, 0.08, 0.005);
          const C = gridAmount(rng, P / years * 0.95, P / years * 1.3, 10);
          const target = (P * acc(r, years)) / C;
          const i = target > years ? trySolve((x) => sn(years, x) - target, 1e-7, 1) : Number.NaN;
          return { P, years, r, C, i };
        },
        (p) => p.i > 0.01 && p.i < 0.2 && Math.abs(p.i - p.r) > 0.005,
        { P: 4000, years: 3, r: 0.04, C: 1400, i: 0.07 }
      );
      const { P, years, r, C } = params;
      const target = (P * acc(r, years)) / C;
      const i = solve((x) => sn(years, x) - target, 1e-7, 1);
      return {
        questionText: `An investor pays ${n(P)} today for a ${word(years)}-year investment that returns cash flows of ${n(C)} at the end of each year. The cash flows can be reinvested at the positive annual effective interest rate of $i$. Using an annual effective rate of interest of ${pc(r)}, the net present value of this investment is 0.
Calculate $i$.`,
        variables: { variant: "REINVEST_RATE", P, years, r, C },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(r * 100, "CALCULATION_DISTRACTOR", "Took the valuation rate as the reinvestment rate."),
          distractor(solve((x) => C * an(years, x) - P, -0.5, 2) * 100, "CALCULATION_DISTRACTOR", "Gave the yield on the investment without reinvestment."),
          distractor((((P * acc(r, years)) / C - years) / (years * (years - 1) / 2)) * 100, "SIMPLE_INTEREST_ERROR", "Used simple interest on the reinvested cash flows."),
          distractor(solve((x) => sn(years, x) * (1 + x) - target, 1e-7, 1) * 100, "ANNUITY_DUE_CONFUSION", "Accumulated the cash flows as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — NPV zero at ${pc(r)}.** The reinvested cash flows are worth $${mn(C)}\\,s_{\\overline{${years}}|i}$ at time ${years}, so
$$${mn(C)}\\,s_{\\overline{${years}}|i}(${dec(1 + r, 3)})^{-${years}} = ${mn(P)}.$$

**Step 2 — Accumulation factor.** $s_{\\overline{${years}}|i} = ${mn(P)}(${dec(1 + r, 3)})^{${years}}/${mn(C)} = ${dec(target, 6)}$.

**Step 3 — Solve.** $i = ${dec(i, 6)}$, that is, ${(i * 100).toFixed(3)}%.`,
        checks: [{ label: "npv zero", ok: close(C * sn(years, i) * v(r, years), P, 1e-9) }],
      };
    },
  },

  {
    id: "FM_ALM_REINVESTMENT_THRESHOLD",
    domain: ALM,
    title: "Minimum Reinvestment Rate to Meet Payments",
    objective: "Track the surplus from zero-coupon bonds bought to fund an annuity and find the reinvestment rate that just meets the payments.",
    difficulty: 3,
    topics: ["GENERAL_CASH_FLOWS", "BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [221],
    generate: (rng: Rng): GeneratedQuestionItem => {
      // The surplus after the first payment and the required reinvestment rate
      // are drawn; the second bond is then sized to leave exactly that gap.
      const params = drawUntil(
        () => {
          const R = gridAmount(rng, 500, 5000, 100);
          const y1 = gridRate(rng, 0.03, 0.08, 0.005);
          const y2 = gridRate(rng, 0.03, 0.09, 0.005);
          const surplusShare = gridRate(rng, 0.03, 0.12, 0.005);
          const X0 = gridRate(rng, 0.02, 0.15, 0.001);
          const A1 = cents((R * (1 + surplusShare)) / (1 + y1));
          const A2 = cents((R - R * surplusShare * (1 + X0)) / acc(y2, 2));
          const surplus = A1 * (1 + y1) - R;
          const need = R - A2 * acc(y2, 2);
          return { R, y1, y2, A1, A2, X: need / surplus - 1 };
        },
        (p) => p.X > 0.015 && p.X < 0.16 && Math.abs(p.X - p.y2) > 0.003,
        { R: 1000, y1: 0.06, y2: 0.07, A1: 999.35, A2: 817.65, X: 0.0769 }
      );
      const { R, y1, y2, A1, A2 } = params;
      const surplus = A1 * (1 + y1) - R;
      const second = A2 * acc(y2, 2);
      const need = R - second;
      const X = need / surplus - 1;
      return {
        questionText: `A life insurance company sells a two-year immediate annuity with annual payments of ${n(R)} for a price of ${n(A1 + A2, 2)}.
The investment actuary invests the ${n(A1 + A2, 2)} in two zero-coupon bonds.
- The first bond matures in one year and earns an annual effective interest rate of ${pc(y1)}. The second bond matures in two years and earns an annual effective interest rate of ${pc(y2)}.
- ${n(A1, 2)} is invested in the first bond and ${n(A2, 2)} is invested in the second bond.
- The two bonds are held to maturity.
As long as the effective annual one-year reinvestment rate is at least $X$% one year from now, the principal and interest earned will be sufficient to make the two annuity payments.
Calculate $X$.`,
        variables: { R, y1, y2, A1, A2, price: A1 + A2 },
        correctValue: X * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((acc(y2, 2) / (1 + y1) - 1) * 100, "CALCULATION_DISTRACTOR", "Gave the forward rate implied by the two bond yields."),
          distractor(((R - A2 * (1 + y2)) / surplus - 1) * 100, "CALCULATION_DISTRACTOR", "Grew the second bond for one year instead of two."),
          distractor(y2 * 100, "CALCULATION_DISTRACTOR", "Assumed the second bond's yield is enough."),
          distractor((Math.sqrt(need / (surplus / (1 + y1))) - 1) * 100, "CALCULATION_DISTRACTOR", "Reinvested the surplus from time 0 instead of time 1."),
        ],
        solutionSteps: `**Step 1 — Surplus at time 1.** $${mn(A1, 2)}(${dec(1 + y1, 3)}) = ${mn(A1 * (1 + y1), 2)}$ pays the first ${n(R)} and leaves ${n(surplus, 2)} to reinvest.

**Step 2 — Shortfall at time 2.** The second bond pays $${mn(A2, 2)}(${dec(1 + y2, 3)})^2 = ${mn(second, 2)}$, so ${n(need, 2)} must come from the reinvested surplus.

**Step 3 — Required rate.** $${mn(surplus, 2)}(1 + X) = ${mn(need, 2)}$, so $X = ${dec(X, 6)}$, that is, ${(X * 100).toFixed(3)}%.`,
        checks: [{ label: "surplus and shortfall positive", ok: surplus > 0 && need > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_ZERO_COUPON_ROLLOVER",
    domain: ALM,
    title: "Rolling Over and Selling Zero-Coupon Bonds",
    objective: "Follow zero-coupon bonds through a reinvestment and an early sale at new yields to find the gain.",
    difficulty: 3,
    topics: ["GENERAL_CASH_FLOWS", "BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [137],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const { a, b, n1, n2, y, y2, y3 } = drawUntil(
        () => {
          const n1 = rng.choice([5, 8, 10]);
          return {
            a: rng.choice([1, 2, 3, 4]),
            b: rng.choice([2, 3, 4, 5, 6]),
            n1,
            n2: rng.int(2 * n1 + 3, 2 * n1 + 15),
            y: gridRate(rng, 0.04, 0.09, 0.005),
            y2: gridRate(rng, 0.04, 0.12, 0.005),
            y3: gridRate(rng, 0.04, 0.12, 0.005),
          };
        },
        (p) => p.a * acc(p.y, p.n1) * acc(p.y2, p.n1) + p.b * acc(p.y, p.n2) * v(p.y3, p.n2 - 2 * p.n1) > 1.2 * (p.a + p.b) && p.y2 !== p.y && p.y3 !== p.y,
        { a: 2, b: 4, n1: 10, n2: 30, y: 0.08, y2: 0.12, y3: 0.1 }
      );
      const first = a * acc(y, n1) * acc(y2, n1);
      const longMaturity = b * acc(y, n2);
      const sale = longMaturity * v(y3, n2 - 2 * n1);
      const gain = first + sale - (a + b);
      return {
        questionText: `A life insurance company invests ${word(a)} million in a ${n1}-year zero-coupon bond and ${word(b)} million in a ${n2}-year zero-coupon bond. The annual effective yield rate for both bonds is ${pc(y)}.
When the ${n1}-year bond matures, the company reinvests the proceeds in another ${n1}-year zero-coupon bond. At that time the bond yield rate is ${pc(y2)} annual effective.
After ${2 * n1} years from the initial investment, the ${n2}-year bond is sold to yield an annual effective rate of ${pc(y3)} to the buyer. The maturity of the second ${n1}-year bond and the sale of the ${n2}-year bond result in a gain of $X$ million on the company's initial investment of ${word(a + b)} million.
Calculate $X$.`,
        variables: { a, b, n1, n2, y, y2, y3 },
        correctValue: gain,
        format: "AMOUNT_2",
        distractors: [
          distractor(a * acc(y, 2 * n1) + b * acc(y, 2 * n1) - (a + b), "CALCULATION_DISTRACTOR", `Ignored the change in yields and accumulated everything at ${pc(y)}.`),
          distractor(first + longMaturity * v(y, n2 - 2 * n1) - (a + b), "CALCULATION_DISTRACTOR", "Sold the long bond at the original yield."),
          distractor(first + sale, "CALCULATION_DISTRACTOR", "Did not subtract the initial investment."),
          distractor(a * acc(y, n1) * acc(y, n1) + sale - (a + b), "CALCULATION_DISTRACTOR", "Reinvested at the original yield."),
        ],
        solutionSteps: `**Step 1 — Short bonds.** $${a}(${dec(1 + y, 3)})^{${n1}}(${dec(1 + y2, 3)})^{${n1}} = ${dec(first, 4)}$ million at time ${2 * n1}.

**Step 2 — Long bond.** It matures for $${b}(${dec(1 + y, 3)})^{${n2}} = ${dec(longMaturity, 4)}$ million; at time ${2 * n1} a buyer yielding ${pc(y3)} pays $${dec(longMaturity, 4)}(${dec(1 + y3, 3)})^{-${n2 - 2 * n1}} = ${dec(sale, 4)}$ million.

**Step 3 — Gain.** $${dec(first, 4)} + ${dec(sale, 4)} - ${a + b} = ${dec(gain, 4)}$ million.`,
        checks: [{ label: "gain positive", ok: gain > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_CONCEPT_YIELD_CURVE",
    domain: ALM,
    title: "Shape of the Yield Curve from Bond Prices",
    objective: "Recover spot rates from zero-coupon prices and describe the shape of the yield curve.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS", "BONDS_AND_CURVES"],
    steps: 2,
    qualitative: true,
    soaSamples: [371],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const labels = [
        "The yield curve is increasing with constant slope.",
        "The yield curve is flat.",
        "The yield curve is inverted with constant slope.",
        "The yield curve is concave upward.",
        "The yield curve is concave downward.",
      ];
      const target = rng.int(0, 4);
      const base = gridRate(rng, 0.03, 0.07, 0.0025);
      const step = rng.choice([0.0025, 0.005, 0.0075]);
      const shapes: number[][] = [
        [0, 1, 2, 3].map((k) => base + k * step),
        [0, 1, 2, 3].map(() => base),
        [0, 1, 2, 3].map((k) => base + (3 - k) * step),
        [0, 1, 3, 6].map((k) => base + k * step * 0.5),
        [0, 3, 5, 6].map((k) => base + k * step * 0.5),
      ];
      const spots = shapes[target].map((s) => Number(s.toFixed(6)));
      const prices = spots.map((s, k) => cents(1000 * v(s, k + 1)));
      const recovered = prices.map((p, k) => Math.pow(1000 / p, 1 / (k + 1)) - 1);
      return {
        kind: "CHOICE",
        questionText: `The prices for four ${n(1000)} face amount zero-coupon bonds are as follows:
${table(["Term (years)", "Price"], prices.map((p, k) => [String(k + 1), mn(p, 2)]))}
Determine which of the following statements describes the yield curve underlying these prices.`,
        variables: { prices },
        choices: labels.map((text, k) => ({
          text,
          isCorrect: k === target,
          type: k === target ? undefined : ("CALCULATION_DISTRACTOR" as const),
          explanation:
            k === target
              ? "Matches the spot rates recovered from the prices."
              : `The spot rates are ${listing(recovered.map((s) => `${(s * 100).toFixed(2)}%`))}.`,
        })),
        fixedOrder: true,
        solutionSteps: `**Step 1 — Spot rates.** $s_t = (1000/P_t)^{1/t} - 1$:
${recovered.map((s, k) => `- ${k + 1} year${k === 0 ? "" : "s"}: $(1000/${mn(prices[k], 2)})^{1/${k + 1}} - 1 = ${(s * 100).toFixed(3)}\\%$`).join("\n")}

**Step 2 — Shape.** ${labels[target]}`,
        checks: [{ label: "rounding keeps the shape", ok: recovered.every((s, k) => Math.abs(s - spots[k]) < 2e-5) }],
      };
    },
  },

  {
    id: "FM_ALM_CONCEPT_YIELD_RATES",
    domain: ALM,
    title: "Uniqueness of a Project's Yield Rate",
    objective: "Use the sign pattern of a project's cash flows and its NPV at a test rate to locate its yield rate or rates.",
    difficulty: 2,
    topics: ["GENERAL_CASH_FLOWS"],
    steps: 2,
    qualitative: true,
    soaSamples: [452],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      // Draw the key first, then build cash flows and a test rate that realise it.
      const target = rng.int(0, 4);
      const tests = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6];
      const fits = (roots: number[], T: number) => {
        if (roots.some((r) => Math.abs(r - T) < 0.01)) return false;
        if (target === 0) return roots.length === 1 && roots[0] > T;
        if (target === 1) return roots.length === 1 && roots[0] < T;
        if (target === 2) return roots.length === 2 && roots.every((r) => r > T);
        if (target === 3) return roots.length === 2 && roots.every((r) => r < T);
        return roots.length === 2 && roots.some((r) => r < T) && roots.some((r) => r > T);
      };
      const built = drawUntil(
        () => {
          let flows: Flow[];
          let roots: number[];
          if (target >= 2) {
            // -a + b v - c v^2 = 0 has roots 1 + i = x1, x2 when b = a(x1 + x2) and c = a x1 x2.
            const pick = () => Number((1 + gridRate(rng, 0.02, 0.8, 0.02)).toFixed(2));
            const x1 = pick();
            const x2 = drawUntil(pick, (x) => Math.abs(x - x1) >= 0.06, x1 + 0.1);
            const a = 100;
            flows = [[0, -a], [1, Number((a * (x1 + x2)).toFixed(2))], [2, -Number((a * x1 * x2).toFixed(4))]];
            roots = [x1 - 1, x2 - 1].sort((p, q) => p - q);
          } else {
            flows = [[0, -gridAmount(rng, 20, 60, 5)], [1, -gridAmount(rng, 20, 60, 5)], [2, gridAmount(rng, 30, 80, 5)], [3, gridAmount(rng, 30, 120, 5)]];
            roots = [solve((x) => pv(flows, x), -0.99, 20)];
          }
          const options = tests.filter((T) => fits(roots, T));
          return { flows, roots, T: options.length ? rng.choice(options) : Number.NaN };
        },
        (b) => Number.isFinite(b.T),
        { flows: [[0, -100], [1, 230], [2, -132]] as Flow[], roots: [0.1, 0.2], T: target === 2 ? 0.05 : target === 3 ? 0.3 : 0.15 }
      );
      const { flows, roots, T } = built;
      const labels = [
        `There is a unique yield rate, which is higher than ${pc(T)}.`,
        `There is a unique yield rate, which is lower than ${pc(T)}.`,
        `There are multiple yield rates, but all are higher than ${pc(T)}.`,
        `There are multiple yield rates, but all are lower than ${pc(T)}.`,
        `There are multiple yield rates with at least one lower than ${pc(T)} and at least one higher than ${pc(T)}.`,
      ];
      const describe = (t: number, a: number) => (a < 0 ? `pays ${amt(-a)} at time ${t}` : `receives ${amt(a)} at time ${t}`);
      return {
        kind: "CHOICE",
        questionText: `An investment project has the following cash flows, where time is measured in years: the investor ${listing(flows.map(([t, a]) => describe(t, a)))}.
Determine which one of the following statements about the annual effective yield rate is true.`,
        variables: { times: flows.map(([t]) => t), amounts: flows.map(([, a]) => a), T },
        choices: labels.map((text, k) => ({
          text,
          isCorrect: k === target,
          type: k === target ? undefined : ("CALCULATION_DISTRACTOR" as const),
          explanation: k === target ? "Matches the yield rates found." : `The yield rate${roots.length > 1 ? "s are" : " is"} ${listing(roots.map((r) => `${(r * 100).toFixed(2)}%`))}.`,
        })),
        fixedOrder: true,
        solutionSteps: `**Step 1 — Number of yield rates.** ${
          roots.length === 1
            ? "The cash flows change sign once (outlays, then receipts), so the NPV falls steadily as the rate rises and there is exactly one yield rate."
            : "The cash flows change sign twice. Writing $x = 1 + i$, the NPV is zero where a quadratic in $x$ vanishes, which here has two positive roots."
        }

**Step 2 — Locate them.** ${roots.length === 1 ? `At ${pc(T)} the NPV is ${n(pv(flows, T), 4)}, so the yield rate is ${roots[0] > T ? "higher" : "lower"} than ${pc(T)}: it is ${(roots[0] * 100).toFixed(2)}%.` : `The yield rates are ${listing(roots.map((r) => `${(r * 100).toFixed(2)}%`))}.`}`,
        checks: [{ label: "roots are yield rates", ok: roots.every((r) => Math.abs(pv(flows, r)) < 1e-6) }],
      };
    },
  },
];
