/**
 * Bonds, continued: callable bonds, reinvestment of coupons, bonds bought
 * partly with borrowed money, varying coupons, and the qualitative items on
 * premium, discount and call provisions.
 */
import type { Rng } from "../../random";
import {
  distractor,
  type GeneratedChoiceQuestionItem,
  type GeneratedQuestionItem,
  type QuestionTemplateDefinition,
} from "../types";
import {
  amt,
  an,
  bondPrice,
  cast,
  cents,
  close,
  couponPeriodRate,
  couponText,
  dec,
  drawUntil,
  frequency,
  gridAmount,
  gridRate,
  listing,
  mn,
  mpc,
  n,
  oneOfFive,
  ord,
  pc,
  perPeriod,
  periodNoun,
  romanStatements,
  sn,
  solve,
  v,
  word,
  type StatementPair,
} from "./kit";

const BONDS = "BONDS" as const;

const amountFormat = (value: number) => (Math.abs(value) < 200 ? "AMOUNT_2" : "AMOUNT_0") as "AMOUNT_2" | "AMOUNT_0";
const aSym = (count: number | string, rate = "j") => `a_{\\overline{${count}}|${rate}}`;

/** "an annual nominal yield rate of at least 6% convertible semiannually" */
function atLeast(rate: number, m: number, effective: boolean): string {
  return effective || m === 1
    ? `an annual effective yield rate of at least ${pc(rate)}`
    : `an annual nominal yield rate of at least ${pc(rate)} convertible ${frequency(m)}`;
}

/** Yield per coupon period that reproduces a price. */
function yieldFor(price: number, coupon: number, redemption: number, periods: number): number {
  return solve((j) => bondPrice(coupon, redemption, j, periods) - price, -0.5, 2);
}

/** A per-period rate expressed on the quoted basis, in percent. */
const quoted = (j: number, m: number, effective: boolean) => (effective || m === 1 ? Math.pow(1 + j, m) - 1 : m * j) * 100;

// ---------------------------------------------------------------------------
// Call schedules
// ---------------------------------------------------------------------------

interface Redemption {
  /** Coupon number after which the bond is redeemed. */
  t: number;
  value: number;
}

interface CallTerms {
  variant: "FROM_YEAR" | "LAST" | "LISTED";
  m: number;
  years: number;
  K: number;
  L: number;
  X: number;
  CN: number;
  callYears: number[];
  callValues: number[];
}

/** Every date on which the bond can be redeemed, with the amount paid then. */
function redemptionDates(terms: CallTerms): Redemption[] {
  const N = terms.m * terms.years;
  const out: Redemption[] = [];
  if (terms.variant === "FROM_YEAR") {
    for (let t = terms.m * terms.K; t < N; t += 1) out.push({ t, value: terms.X });
  } else if (terms.variant === "LAST") {
    for (let t = N - terms.L + 1; t < N; t += 1) out.push({ t, value: terms.X });
  } else {
    terms.callYears.forEach((year, k) => out.push({ t: terms.m * year, value: terms.callValues[k] }));
  }
  out.push({ t: N, value: terms.CN });
  return out;
}

/**
 * Within a stretch of dates sharing one redemption value C, the price
 * C + (Fr − Cj)a_t (or the yield, for a fixed price) moves steadily with t, so
 * only the first and last date of each stretch can be the worst case.
 */
function candidateDates(dates: readonly Redemption[]): Redemption[] {
  return dates.filter((d, k) => k === 0 || k === dates.length - 1 || dates[k - 1].value !== d.value || dates[k + 1].value !== d.value);
}

/** Describes the call provision in the sample set's wording. */
function describeCalls(terms: CallTerms, F: number): string {
  const { K, L, X, CN, callYears, callValues } = terms;
  const at = (value: number) => (value === F ? "at par" : `at ${n(value)}`);
  if (terms.variant === "FROM_YEAR") {
    return `The bond can be called ${at(X)} on any coupon date${CN !== X ? " prior to maturity" : ""}, starting at the end of year ${K}.${CN !== F ? ` If it is not called, it is redeemed at ${n(CN)} at maturity.` : ""}`;
  }
  if (terms.variant === "LAST") {
    return `The bond is callable at par on any of the last ${word(L)} coupon dates.`;
  }
  const allSame = callValues.every((value) => value === callValues[0]);
  if (allSame) {
    return `The bond is callable ${at(callValues[0])} at the end of years ${listing(callYears)}, immediately after the coupon payment.`;
  }
  const parts = callYears.map((year, k) => `for ${n(callValues[k])} at the end of the ${ord(year)} year`);
  return `The bond is callable ${listing(parts)}, immediately after the coupon payment.`;
}

/** Draws a call provision for a bond of the given term. */
function drawCallTerms(rng: Rng, F: number, m: number, years: number, allowLast: boolean): CallTerms {
  const variant = rng.choice(allowLast && m === 1 ? (["FROM_YEAR", "LAST", "LISTED"] as const) : (["FROM_YEAR", "FROM_YEAR", "LISTED"] as const));
  const base: CallTerms = { variant, m, years, K: 0, L: 0, X: F, CN: F, callYears: [], callValues: [] };
  if (variant === "FROM_YEAR") {
    const K = rng.int(Math.max(2, Math.round(years * 0.3)), years - 3);
    const premiumCall = rng.next() < 0.4;
    const X = premiumCall ? Math.round(F * rng.choice([1.02, 1.05, 1.1, 1.2])) : F;
    const CN = premiumCall && rng.next() < 0.5 ? Math.round(F * rng.choice([1, 1.05, 1.1])) : F;
    return { ...base, K, X, CN: Math.min(CN, X) };
  }
  if (variant === "LAST") {
    return { ...base, L: rng.int(3, 6) };
  }
  const count = rng.choice([2, 3]);
  const pool = Array.from({ length: years - 1 - Math.round(years * 0.3) }, (_, k) => Math.round(years * 0.3) + k);
  const callYears = rng.shuffle(pool).slice(0, count).sort((a, b) => a - b);
  const step = rng.choice([0, 0.02, 0.03]);
  const callValues = callYears.map((_, k) => Math.round(F * (1 + step * (count - k))));
  return { ...base, callYears, callValues };
}

function priceAt(coupon: number, j: number, date: Redemption): number {
  return bondPrice(coupon, date.value, j, date.t);
}

export const SOA_ADVANCED_BOND_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_BOND_CALLABLE_MAX_PRICE",
    domain: BONDS,
    title: "Price of a Callable Bond",
    objective: "Find the highest price that guarantees a yield on a callable bond by checking the worst redemption date.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [41, 72, 136, 292, 301, 435],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const F = rng.choice([100, 1000, 1000, 1000, 5000]);
      const m = rng.choice([1, 2, 2]);
      const years = rng.int(10, 30);
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - r) >= 0.005, r + 0.01);
      const effective = m > 1 && rng.next() < 0.3;
      const terms = drawCallTerms(rng, F, m, years, true);
      const j = couponPeriodRate(y, m, effective);
      const g = (F * r) / m;
      const dates = redemptionDates(terms);
      const prices = dates.map((d) => priceAt(g, j, d));
      const key = Math.min(...prices);
      const worst = dates[prices.indexOf(key)];
      const shortlist = candidateDates(dates);
      const N = m * years;
      const jWrong = effective ? y / m : perPeriod(y, m);
      return {
        questionText: `${buyer} is considering a ${years}-year ${n(F)} par value bond with ${couponText(r, m)}. ${describeCalls(terms, F)}
Calculate the maximum price that guarantees ${buyer} ${atLeast(y, m, effective)}.`,
        variables: { ...terms, variant: terms.variant, F, r, y, effective: effective ? 1 : 0 },
        correctValue: key,
        format: amountFormat(key),
        distractors: [
          distractor(bondPrice(g, terms.CN, j, N), "CALCULATION_DISTRACTOR", "Ignored the call provision and priced to maturity."),
          distractor(priceAt(g, j, dates[0]), "CALCULATION_DISTRACTOR", "Assumed the earliest call date."),
          distractor(Math.max(...prices), "CALCULATION_DISTRACTOR", "Took the most favourable redemption date instead of the least favourable."),
          distractor(priceAt(g, jWrong, worst), "NOMINAL_RATE_ERROR", effective ? "Divided the annual effective rate by the number of coupons a year." : "Treated the nominal yield as an annual effective rate."),
          distractor(priceAt(g, j, dates[dates.length - 2] ?? dates[0]), "CALCULATION_DISTRACTOR", "Assumed the last call date before maturity."),
        ],
        solutionSteps: `**Step 1 — Yield per coupon period.** ${m === 1 ? `$j = ${dec(j, 4)}$.` : effective ? `$j = (1 + ${dec(y, 4)})^{1/${m}} - 1 = ${dec(j, 6)}$.` : `$j = ${dec(y, 4)}/${m} = ${dec(j, 6)}$.`} Each coupon is ${n(g, 2)}.

**Step 2 — Dates worth checking.** For redemption at $C$ after coupon $t$ the price is $C + (Fr - Cj)\\,${aSym("t")}$, which moves steadily with $t$; so within a stretch of dates sharing one redemption value only the first and last dates matter:
${shortlist.map((d) => `- after coupon ${d.t} at ${n(d.value)}: $${mn(g, 2)}\\,${aSym(d.t)} + ${mn(d.value)}\\,v^{${d.t}} = ${mn(priceAt(g, j, d), 2)}$`).join("\n")}

**Step 3 — Guaranteed yield.** The investor must pay no more than the smallest of these, from redemption after coupon ${worst.t}: ${n(key, 2)}.`,
        checks: [
          { label: "shortlist contains the worst date", ok: shortlist.some((d) => d.t === worst.t) },
          { label: "minimum over shortlist equals minimum over all dates", ok: close(Math.min(...shortlist.map((d) => priceAt(g, j, d))), key, 1e-12) },
        ],
      };
    },
  },

  {
    id: "FM_BOND_CALLABLE_MIN_YIELD",
    domain: BONDS,
    title: "Minimum Yield on a Callable Bond",
    objective: "Given the price of a callable bond, find the lowest yield the investor can receive over the possible redemption dates.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [43, 381],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const params = drawUntil(
        () => {
          const F = rng.choice([1000, 1000, 1100, 1111, 5000]);
          const m = rng.choice([1, 2, 2]);
          const years = rng.int(10, 25);
          const r = gridRate(rng, 0.03, 0.1, 0.005);
          const y0 = gridRate(rng, 0.03, 0.1, 0.005);
          const effective = m > 1 && rng.next() < 0.3;
          const terms = drawCallTerms(rng, F, m, years, true);
          const j0 = couponPeriodRate(y0, m, effective);
          const dates = redemptionDates(terms);
          const P = cents(Math.min(...dates.map((d) => priceAt((F * r) / m, j0, d))));
          return { F, m, years, r, effective, terms, P };
        },
        (p) => {
          const dates = redemptionDates(p.terms);
          const ys = dates.map((d) => yieldFor(p.P, (p.F * p.r) / p.m, d.value, d.t));
          const sorted = ys.slice().sort((a, b) => a - b);
          return sorted[0] > 0.005 && Math.abs(p.r - sorted[0] * p.m) > 0.004 && sorted[1] - sorted[0] > 1e-5;
        },
        {
          F: 1111,
          m: 1,
          years: 20,
          r: 0.1,
          effective: false,
          terms: { variant: "LISTED", m: 1, years: 20, K: 0, L: 0, X: 1111, CN: 1111, callYears: [18, 19], callValues: [1111, 1111] } as CallTerms,
          P: 1321,
        }
      );
      const { F, m, years, r, effective, terms, P } = params;
      const g = (F * r) / m;
      const dates = redemptionDates(terms);
      const yields = dates.map((d) => yieldFor(P, g, d.value, d.t));
      const jMin = Math.min(...yields);
      const worst = dates[yields.indexOf(jMin)];
      const key = quoted(jMin, m, effective);
      const shortlist = candidateDates(dates);
      const N = m * years;
      const basis = effective || m === 1 ? "annual effective yield rate" : `annual nominal yield rate convertible ${frequency(m)}`;
      return {
        questionText: `${buyer} buys a ${years}-year ${n(F)} par value bond with ${couponText(r, m)} for ${n(P, 2)}. ${describeCalls(terms, F)}
Calculate the minimum ${basis} that ${buyer} can receive.`,
        variables: { ...terms, variant: terms.variant, F, r, P, effective: effective ? 1 : 0 },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor(quoted(yieldFor(P, g, terms.CN, N), m, effective), "CALCULATION_DISTRACTOR", "Ignored the call provision and used the yield to maturity."),
          distractor(quoted(Math.max(...yields), m, effective), "CALCULATION_DISTRACTOR", "Took the most favourable redemption date instead of the least favourable."),
          distractor(quoted(yieldFor(P, g, dates[0].value, dates[0].t), m, effective), "CALCULATION_DISTRACTOR", "Assumed the earliest call date."),
          distractor(effective || m === 1 ? m * jMin * 100 : (Math.pow(1 + jMin, m) - 1) * 100, "NOMINAL_RATE_ERROR", effective || m === 1 ? "Quoted the nominal rate instead of the effective rate." : "Quoted the effective rate instead of the nominal rate."),
          distractor(jMin * 100, "NOMINAL_RATE_ERROR", "Stopped at the yield per coupon period."),
        ],
        solutionSteps: `**Step 1 — Yield to each candidate date.** For a fixed price, the yield to redemption at $C$ after coupon $t$ moves steadily with $t$, so within a stretch of dates sharing one redemption value only the first and last dates matter. Solving $${mn(P, 2)} = ${mn(g, 2)}\\,${aSym("t")} + C\\,v^{t}$:
${shortlist.map((d) => `- after coupon ${d.t} at ${n(d.value)}: $j = ${dec(yieldFor(P, g, d.value, d.t), 6)}$`).join("\n")}

**Step 2 — Worst case.** The lowest is $j = ${dec(jMin, 6)}$, for redemption after coupon ${worst.t}.

**Step 3 — Quote the rate.** ${effective || m === 1 ? `$(1 + ${dec(jMin, 6)})^{${m}} - 1 = ${dec(key / 100, 6)}$` : `$${m}(${dec(jMin, 6)}) = ${dec(key / 100, 6)}$`}, that is, ${key.toFixed(3)}%.`,
        checks: [
          { label: "shortlist contains the worst date", ok: shortlist.some((d) => d.t === worst.t) },
          { label: "worst yield reprices", ok: close(bondPrice(g, worst.value, jMin, worst.t), P, 1e-9) },
        ],
      };
    },
  },

  {
    id: "FM_BOND_CALLABLE_SOLVE_PAR",
    domain: BONDS,
    title: "Par Value of a Callable Bond from Its Lowest Yield",
    objective: "Identify the worst call date from whether the bond sells at a premium or a discount, then solve for the par value.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [40, 42],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const years = rng.int(10, 30);
      const K = rng.int(Math.max(3, Math.round(years * 0.3)), years - 3);
      const r = gridRate(rng, 0.03, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - r) >= 0.01, r + 0.02);
      const j = y / 2;
      const unit = (t: number) => bondPrice(r / 2, 1, j, t);
      const ts = Array.from({ length: 2 * years - 2 * K + 1 }, (_, k) => 2 * K + k);
      const units = ts.map(unit);
      const worstUnit = Math.min(...units);
      const tWorst = ts[units.indexOf(worstUnit)];
      const Xtrue = gridAmount(rng, 800, 2000, 10);
      const P = cents(Xtrue * worstUnit);
      const key = P / worstUnit;
      const premium = r > y;
      const jWrong = perPeriod(y, 2);
      const unitsWrong = ts.map((t) => bondPrice(r / 2, 1, jWrong, t));
      return {
        questionText: `${buyer} purchased a ${years}-year par value bond with an annual nominal coupon rate of ${pc(r)} payable semiannually at a price of ${n(P, 2)}. The bond can be called at par value $X$ on any coupon date starting at the end of year ${K}. The lowest yield rate that ${buyer} can possibly receive is an annual nominal rate of ${pc(y)} convertible semiannually.
Calculate $X$.`,
        variables: { r, years, K, P, y },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(P / unit(premium ? 2 * years : 2 * K), "CALCULATION_DISTRACTOR", premium ? "Assumed redemption at maturity although the bond sells at a premium." : "Assumed the earliest call although the bond sells at a discount."),
          distractor(P / Math.min(...unitsWrong), "NOMINAL_RATE_ERROR", "Treated the nominal yield as an annual effective rate."),
          distractor(P / unit(tWorst + (premium ? 1 : -1)), "OFF_BY_ONE_PERIOD", "Counted the call date one coupon off."),
          distractor(P / Math.max(...units), "CALCULATION_DISTRACTOR", "Took the most favourable redemption date instead of the least favourable."),
        ],
        solutionSteps: `**Step 1 — Premium or discount.** The coupon rate per half-year, ${dec(r / 2, 4)}, is ${premium ? "above" : "below"} the yield rate ${dec(j, 4)}, so the bond sells at a ${premium ? "premium" : "discount"} and the worst case for ${buyer} is the ${premium ? "earliest call, after coupon" : "latest redemption, at maturity after coupon"} ${tWorst}.

**Step 2 — Price per unit of par at that date.**
$$${dec(r / 2, 4)}\\,${aSym(tWorst)} + v^{${tWorst}} = ${dec(worstUnit, 6)}.$$

**Step 3 — Par value.** $X = ${mn(P, 2)}/${dec(worstUnit, 6)} = ${mn(key, 2)}$.`,
        checks: [{ label: "worst date follows premium/discount rule", ok: tWorst === (premium ? 2 * K : 2 * years) }],
      };
    },
  },

  {
    id: "FM_BOND_CALLABLE_WORST_DATE",
    domain: BONDS,
    title: "Worst Redemption Date under a Call Premium Schedule",
    objective: "Compare the worst date in each period of constant call price to find the redemption date that must be assumed.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [135],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const F = 1000;
      const params = drawUntil(
        () => {
          const years = rng.int(20, 30);
          const K1 = rng.int(5, 10);
          const K2 = rng.int(K1 + 4, years - 4);
          const r = gridRate(rng, 0.05, 0.1, 0.005);
          const C1 = rng.choice([1100, 1150, 1200, 1250]);
          const C2 = rng.choice([1025, 1050, 1075, 1100, 1125].filter((c) => c < C1));
          const y = gridRate(rng, 0.03, 0.1, 0.005);
          return { years, K1, K2, r, C1, C2, y };
        },
        (p) => {
          const g = (F * p.r) / 2;
          const j = p.y / 2;
          const first = 2 * p.K1;
          const shift = 2 * p.K2;
          const N = 2 * p.years;
          const cands = [first, shift - 1, shift, N - 1, N];
          const value = (t: number) => (t < shift ? p.C1 : t < N ? p.C2 : F);
          const prices = cands.map((t) => bondPrice(g, value(t), j, t)).sort((a, b) => a - b);
          return prices[1] - prices[0] > 0.05;
        },
        { years: 30, K1: 10, K2: 20, r: 0.07, C1: 1250, C2: 1125, y: 0.05 }
      );
      const { years, K1, K2, r, C1, C2, y } = params;
      const g = (F * r) / 2;
      const j = y / 2;
      const first = 2 * K1;
      const shift = 2 * K2;
      const N = 2 * years;
      const value = (t: number) => (t < shift ? C1 : t < N ? C2 : F);
      const all = Array.from({ length: N - first + 1 }, (_, k) => first + k);
      const prices = all.map((t) => bondPrice(g, value(t), j, t));
      const worstPrice = Math.min(...prices);
      const key = all[prices.indexOf(worstPrice)];
      const cands = [first, shift - 1, shift, N - 1, N];
      return {
        kind: "CHOICE",
        questionText: `A ${n(F)} par value ${years}-year bond has an annual coupon rate of ${pc(r)} paid semiannually. After an initial ${word(K1)}-year period of call protection, the bond is callable immediately following the payment of any of the ${ord(first)} through the ${ord(N - 1)} coupons.
(i) If the bond is called before payment of the ${ord(shift)} coupon, the redemption value is ${n(C1)}.
(ii) If the bond is called immediately after the payment of any of the ${ord(shift)} through the ${ord(N - 1)} coupons, the redemption value is ${n(C2)}.
(iii) If the bond is not called, it will be redeemed at par.
To ensure that the bond will provide an annual nominal yield rate of at least ${pc(y)} convertible semiannually, it must be assumed that the bond will be called or redeemed immediately after the payment of the $n$th coupon.
Calculate $n$.`,
        variables: { F, years, first, shift, r, C1, C2, y },
        choices: cands.map((t) =>
          t === key
            ? { text: String(t), isCorrect: true, explanation: `Redemption after coupon ${t} gives the lowest price, ${n(worstPrice, 2)}.` }
            : {
                text: String(t),
                isCorrect: false,
                type: "CALCULATION_DISTRACTOR" as const,
                explanation: `Redemption after coupon ${t} gives a price of ${n(bondPrice(g, value(t), j, t), 2)}, higher than ${n(worstPrice, 2)}.`,
              }
        ),
        fixedOrder: true,
        solutionSteps: `**Step 1 — Rule within each period.** At $j = ${dec(j, 4)}$, redemption at $C$ after coupon $t$ has price $C + (${mn(g, 2)} - Cj)\\,${aSym("t")}$. The modified coupon rate ${mn(g, 2)}/C is ${cands
          .slice(0, 4)
          .filter((_, k) => k % 2 === 0)
          .map((t) => `${dec(g / value(t), 4)} for $C = ${mn(value(t))}$`)
          .join(" and ")}; where it exceeds $j$ the earliest date in the period is worst, otherwise the latest.

**Step 2 — Candidate prices.**
${cands.map((t) => `- after coupon ${t} at ${n(value(t))}: ${n(bondPrice(g, value(t), j, t), 2)}`).join("\n")}

**Step 3 — Worst case.** The lowest price, ${n(worstPrice, 2)}, comes from redemption after coupon ${key}, so $n = ${key}$.`,
        checks: [{ label: "worst date is a candidate", ok: cands.includes(key) }],
      };
    },
  },

  {
    id: "FM_BOND_CALLED_EARLY_YIELD",
    domain: BONDS,
    title: "Yield When a Bond Is Called Earlier than Assumed",
    objective: "Price a callable bond under an assumed call, then find the investor's actual yield when it is called on a different date.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [139],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const F = rng.choice([1000, 2000, 3000, 5000]);
      const { years, C, r, i, Ka, Xa, t, Xt } = drawUntil(
        () => {
          const years = rng.int(8, 20);
          const Ka = rng.int(3, years - 2);
          const Xa = Math.round(F * rng.choice([0.98, 1, 1.02, 1.05]));
          return {
            years,
            C: Math.round(F * rng.choice([0.95, 1, 1.05])),
            r: gridRate(rng, 0.05, 0.12, 0.005),
            i: gridRate(rng, 0.04, 0.12, 0.005),
            Ka,
            Xa,
            t: rng.int(1, 2 * Ka - 1),
            Xt: Math.round(Xa + F * rng.choice([0, 0.01, 0.02, 0.03])),
          };
        },
        (p) => {
          const price = bondPrice((F * p.r) / 2, p.Xa, perPeriod(p.i, 2), 2 * p.Ka);
          const kk = Math.pow(1 + yieldFor(price, (F * p.r) / 2, p.Xt, p.t), 2) - 1;
          return kk > 0.02 && kk < 0.2 && Math.abs(kk - p.i) > 0.003;
        },
        { years: 8, C: Math.round(F * 0.95), r: 0.1, i: 0.1, Ka: 4, Xa: Math.round(F * 0.98), t: 1, Xt: Math.round(F * 0.98) + Math.round(F * 0.02) }
      );
      const g = (F * r) / 2;
      const jA = perPeriod(i, 2);
      const P = bondPrice(g, Xa, jA, 2 * Ka);
      const k = yieldFor(P, g, Xt, t);
      const key = (Math.pow(1 + k, 2) - 1) * 100;
      return {
        questionText: `${buyer} purchases a ${word(years)}-year callable bond with ${couponText(r, 2)}. The bond has a face value of ${n(F)} and a redemption value of ${n(C)}.
The purchase price assumes the bond is called at the end of year ${Ka} for ${n(Xa)}, and provides an annual effective yield of ${pc(i)}.
Immediately after the ${ord(t)} coupon payment is received, the bond is called for ${n(Xt)}. ${buyer}'s annual effective yield rate is $i$.
Calculate $i$.`,
        variables: { F, C, r, years, Ka, Xa, i, t, Xt },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor(2 * k * 100, "NOMINAL_RATE_ERROR", "Doubled the semiannual yield instead of compounding it."),
          distractor(i * 100, "CALCULATION_DISTRACTOR", "Assumed the yield is unchanged by the early call."),
          distractor((Math.pow(1 + yieldFor(bondPrice(g, Xa, i / 2, 2 * Ka), g, Xt, t), 2) - 1) * 100, "NOMINAL_RATE_ERROR", "Halved the annual effective yield to price the bond."),
          distractor(k * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual yield."),
        ],
        solutionSteps: `**Step 1 — Purchase price.** The semiannual yield is $(${dec(1 + i, 3)})^{1/2} - 1 = ${dec(jA, 6)}$, so with coupons of ${n(g, 2)}:
$$P = ${mn(g, 2)}\\,${aSym(2 * Ka)} + ${mn(Xa)}\\,v^{${2 * Ka}} = ${mn(P, 2)}.$$

**Step 2 — Actual cash flows.** ${buyer} receives ${t === 1 ? `one coupon and ${n(Xt)} after six months` : `${t} coupons and ${n(Xt)} after coupon ${t}`}. Solve $${mn(P, 2)} = ${mn(g, 2)}\\,${aSym(t, "k")} + ${mn(Xt)}\\,v^{${t}}$: $k = ${dec(k, 6)}$ per half-year.

**Step 3 — Annual effective yield.** $(1 + ${dec(k, 6)})^2 - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
        checks: [{ label: "actual yield reprices", ok: close(bondPrice(g, Xt, k, t), P, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_REINVESTED_COUPONS",
    domain: BONDS,
    title: "Yield with Coupons Reinvested",
    objective: "Accumulate coupons at a reinvestment rate and relate the total to the purchase price through the realised yield.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [34, 399, 427],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const variant = rng.choice(["SOLVE_REINVEST", "SOLVE_PRICE", "SOLVE_YIELD"] as const);
      if (variant === "SOLVE_REINVEST") {
        const params = drawUntil(
          () => ({
            F: rng.choice([1000, 1000, 5000]),
            years: rng.int(5, 20),
            r: gridRate(rng, 0.04, 0.1, 0.005),
            y: gridRate(rng, 0.04, 0.1, 0.005),
            Y: gridRate(rng, 0.04, 0.1, 0.005),
          }),
          (p) => {
            const P = bondPrice((p.F * p.r) / 2, p.F, p.y / 2, 2 * p.years);
            const target = (P * Math.pow(1 + p.Y, p.years) - p.F) / ((p.F * p.r) / 2);
            if (target <= 2 * p.years) return false;
            const k = solve((x) => sn(2 * p.years, x) - target, 1e-9, 1);
            const i = Math.pow(1 + k, 2) - 1;
            return i > 0.02 && i < 0.12 && Math.abs(i - p.Y) > 0.005;
          },
          { F: 1000, years: 10, r: 0.06, y: 0.06, Y: 0.07 }
        );
        const { F, years, r, y, Y } = params;
        const g = (F * r) / 2;
        const P = bondPrice(g, F, y / 2, 2 * years);
        const AV = P * Math.pow(1 + Y, years);
        const target = (AV - F) / g;
        const k = solve((x) => sn(2 * years, x) - target, 1e-9, 1);
        const key = (Math.pow(1 + k, 2) - 1) * 100;
        return {
          questionText: `${buyer} buys a ${years}-year ${n(F)} par value bond with semiannual coupons paid at an annual rate of ${pc(r)}. The price assumes an annual nominal yield of ${pc(y)}, compounded semiannually.
As each coupon payment is received, it is immediately put into an account earning interest at an annual effective rate of $i$.
At the end of ${years} years, immediately after the final coupon payment and the redemption value of the bond are received, ${buyer} has earned an annual effective yield of ${pc(Y)} on the investment in the bond.
Calculate $i$.`,
          variables: { variant, F, C: F, r, m: 2, years, y, Y },
          correctValue: key,
          format: "PERCENT_2",
          distractors: [
            distractor(2 * k * 100, "NOMINAL_RATE_ERROR", "Doubled the semiannual rate instead of compounding it."),
            distractor(k * 100, "NOMINAL_RATE_ERROR", "Stopped at the semiannual rate."),
            distractor((Math.pow(1 + solve((x) => sn(2 * years, x) - (AV - P) / g, -0.5, 1), 2) - 1) * 100, "CALCULATION_DISTRACTOR", "Subtracted the price instead of the redemption value from the accumulated value."),
            distractor(((AV - F - 2 * years * g) / (g * years * years)) * 100, "SIMPLE_INTEREST_ERROR", "Treated the interest on the coupons as simple interest."),
          ],
          solutionSteps: `**Step 1 — Price and accumulated value.** $P = ${mn(g, 2)}\\,${aSym(2 * years, dec(y / 2, 4))} + ${mn(F)}\\,v^{${2 * years}} = ${mn(P, 2)}$; at ${pc(Y)} for ${years} years it must grow to $${mn(P, 2)}(${dec(1 + Y, 4)})^{${years}} = ${mn(AV, 2)}$.

**Step 2 — Reinvested coupons.** $${mn(AV, 2)} = ${mn(F)} + ${mn(g, 2)}\\,s_{\\overline{${2 * years}}|k}$, so $s_{\\overline{${2 * years}}|k} = ${dec(target, 5)}$ and $k = ${dec(k, 6)}$ per half-year.

**Step 3 — Annual effective rate.** $i = (1 + ${dec(k, 6)})^2 - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
          checks: [{ label: "accumulation reproduced", ok: close(F + g * sn(2 * years, k), AV, 1e-9) }],
        };
      }
      const F = rng.choice([1000, 5000, 7000, 10000]);
      const C = rng.next() < 0.6 ? F : Math.round(F * rng.choice([1.05, 1.1]) / 10) * 10;
      const years = rng.int(8, 25);
      const r = gridRate(rng, 0.03, 0.09, 0.005);
      const j = gridRate(rng, 0.03, 0.09, 0.001);
      const Y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.0002), (x) => Math.abs(x - j) > 0.002, j + 0.005);
      const AV = F * r * sn(years, j) + C;
      const X = AV / Math.pow(1 + Y, years);
      if (variant === "SOLVE_PRICE") {
        return {
          questionText: `${buyer} paid $X$ for a ${word(years)}-year ${n(F)} face amount bond at issue with ${couponText(r, 1)}${C === F ? "" : ` and a redemption value of ${n(C)}`}. The coupons are immediately reinvested at an annual effective interest rate of ${pc(j)}. The annual effective yield on the investment of $X$ is ${pc(Y, 2)} over the ${word(years)}-year period.
Calculate $X$.`,
          variables: { variant, F, C, r, years, j, Y },
          correctValue: X,
          format: "AMOUNT_0",
          distractors: [
            distractor(F * r * an(years, Y) + C * v(Y, years), "CALCULATION_DISTRACTOR", "Priced the bond at the realised yield, ignoring the reinvestment rate."),
            distractor((F * r * years + C) / Math.pow(1 + Y, years), "SIMPLE_INTEREST_ERROR", "Accumulated the coupons without interest."),
            distractor(F * r * an(years, j) + C * v(j, years), "CALCULATION_DISTRACTOR", "Priced the bond at the reinvestment rate."),
            distractor((F * r * sn(years, j) * (1 + j) + C) / Math.pow(1 + Y, years), "ANNUITY_DUE_CONFUSION", "Accumulated the coupons one year too long."),
          ],
          solutionSteps: `**Step 1 — Accumulated coupons.** $${mn(F * r, 2)}\\,s_{\\overline{${years}}|${mpc(j)}} = ${mn(F * r * sn(years, j), 2)}$.

**Step 2 — Total at the end.** Adding the redemption value, $${mn(F * r * sn(years, j), 2)} + ${mn(C)} = ${mn(AV, 2)}$.

**Step 3 — Price.** $X(${dec(1 + Y, 4)})^{${years}} = ${mn(AV, 2)}$, so $X = ${mn(X, 2)}$.`,
          checks: [{ label: "yield reproduced", ok: close(X * Math.pow(1 + Y, years), AV, 1e-12) }],
        };
      }
      const i = yieldFor(X, F * r, C, years);
      return {
        questionText: `An investor has purchased a ${years}-year ${n(F)} face amount bond with ${couponText(r, 1)}. The redemption value of the bond is ${n(C)}. The purchase price, $P$, results in an annual effective yield of $i$.
Upon receipt, each coupon payment is immediately reinvested in an account earning an annual effective rate of ${pc(j)}. Immediately following the receipt of the last payment from the bond, the investor has earned an annual effective yield of ${pc(Y, 2)} on the original investment of $P$.
Calculate $i$.`,
        variables: { variant, F, C, r, years, j, Y },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(Y * 100, "CALCULATION_DISTRACTOR", "Took the realised yield as the bond's yield."),
          distractor(j * 100, "CALCULATION_DISTRACTOR", "Took the reinvestment rate as the bond's yield."),
          distractor(yieldFor((F * r * years + C) / Math.pow(1 + Y, years), F * r, C, years) * 100, "SIMPLE_INTEREST_ERROR", "Accumulated the coupons without interest."),
          distractor(yieldFor((F * r * sn(years, j) + F) / Math.pow(1 + Y, years), F * r, F, years) * 100, "CALCULATION_DISTRACTOR", "Used the face amount as the redemption value."),
        ],
        solutionSteps: `**Step 1 — Accumulated value.** $${mn(F * r, 2)}\\,s_{\\overline{${years}}|} + ${mn(C)} = ${mn(F * r * sn(years, j), 2)} + ${mn(C)} = ${mn(AV, 2)}$ at ${pc(j)}.

**Step 2 — Price.** $P = ${mn(AV, 2)}/(${dec(1 + Y, 4)})^{${years}} = ${mn(X, 2)}$.

**Step 3 — Bond yield.** Solve $${mn(X, 2)} = ${mn(F * r, 2)}\\,${aSym(years, "i")} + ${mn(C)}\\,v^{${years}}$: $i = ${dec(i, 6)}$, that is, ${(i * 100).toFixed(3)}%.`,
        checks: [{ label: "bond yield reprices", ok: close(bondPrice(F * r, C, i, years), X, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_BORROWED_PURCHASE_YIELD",
    domain: BONDS,
    title: "Yield on a Bond Bought Partly with a Loan",
    objective: "Net the bond's coupons against interest-only loan payments and find the yield on the investor's own money.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES", "LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [94],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [buyer] = cast(rng);
      const F = rng.choice([10000, 20000, 50000, 100000]);
      const share = rng.choice([0.1, 0.2, 0.25, 0.3, 0.4]);
      const L = F * share;
      const E = F - L;
      const m = rng.choice([12, 12, 4, 2]);
      const years = rng.int(5, 15);
      const rB = gridRate(rng, 0.05, 0.1, 0.005);
      const rL = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => x < rB - 0.005 || x > rB + 0.005, rB - 0.01);
      const net = (F * rB) / m - (L * rL) / m;
      const jE = net / E;
      const key = (Math.pow(1 + jE, m) - 1) * 100;
      return {
        questionText: `${buyer} has ${n(E)} and would like to purchase a ${n(F)} bond. To do so, ${buyer} takes out a ${years}-year loan of ${n(L)} from a bank and will make interest-only payments at the end of each ${periodNoun(m)} at a nominal rate of ${pc(rL)} convertible ${frequency(m)}. ${buyer} immediately pays ${n(F)} for a ${years}-year bond with a par value of ${n(F)} and ${pc(rB)} coupons paid ${frequency(m)}.
Calculate the annual effective yield rate that ${buyer} will realize on the ${n(E)} over the ${years}-year period.`,
        variables: { E, L, m, rL, rB, years },
        correctValue: key,
        format: "PERCENT_2",
        distractors: [
          distractor((Math.pow(1 + rB / m, m) - 1) * 100, "CALCULATION_DISTRACTOR", "Gave the bond's own yield, ignoring the borrowing."),
          distractor(m * jE * 100, "NOMINAL_RATE_ERROR", "Gave the nominal rate instead of the annual effective rate."),
          distractor((Math.pow(1 + (F * rB) / m / E, m) - 1) * 100, "CALCULATION_DISTRACTOR", "Left out the loan interest."),
          distractor(((F * rB - L * rL) / E) * 100, "NOMINAL_RATE_ERROR", "Did not compound the net income within the year."),
        ],
        solutionSteps: `**Step 1 — Net cash flow each ${periodNoun(m)}.** Coupons of $${mn(F)}(${dec(rB, 3)})/${m} = ${mn((F * rB) / m, 2)}$ less loan interest of $${mn(L)}(${dec(rL, 3)})/${m} = ${mn((L * rL) / m, 2)}$ leaves ${n(net, 4)}.

**Step 2 — Yield per period.** At the end ${buyer} receives ${n(F)} and repays ${n(L)}, recovering exactly the ${n(E)} invested, so the yield per period is the net income over the investment: $${mn(net, 4)}/${mn(E)} = ${dec(jE, 6)}$.

**Step 3 — Annual effective rate.** $(1 + ${dec(jE, 6)})^{${m}} - 1 = ${dec(key / 100, 6)}$, that is, ${key.toFixed(3)}%.`,
        checks: [{ label: "equation of value holds", ok: close(net * an(m * years, jE) + E * v(jE, m * years), E, 1e-10) }],
      };
    },
  },

  {
    id: "FM_BOND_VARYING_COUPONS",
    domain: BONDS,
    title: "Bond with Increasing Coupons",
    objective: "Value a bond whose coupons grow arithmetically or geometrically and solve for the coupon parameter.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "TIME_VALUE"],
    steps: 3,
    soaSamples: [81, 96, 340],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["ARITH", "GEO_AFTER", "GEO_FIRST"] as const);
      const years = rng.int(5, 15);
      const N = 2 * years;
      const C = rng.choice([250, 300, 500, 1000]);
      if (variant === "ARITH") {
        const c0 = gridAmount(rng, 10, 40, 0.5);
        const y = gridRate(rng, 0.04, 0.1, 0.005);
        const j = y / 2;
        const Xtrue = gridAmount(rng, 1, 12, 0.25);
        const increasing = Array.from({ length: N }, (_, k) => (k + 1) * v(j, k + 1)).reduce((s, x) => s + x, 0);
        const P = cents(c0 * an(N, j) + Xtrue * increasing + C * v(j, N));
        const X = (P - c0 * an(N, j) - C * v(j, N)) / increasing;
        return {
          questionText: `An investor owns a bond that is redeemable for ${n(C)} in ${word(years)} years. The investor has just received a coupon of ${amt(c0)} and each subsequent semiannual coupon will be $X$ more than the preceding coupon. The present value of this bond immediately after the payment of the coupon is ${n(P, 2)} assuming an annual nominal yield rate of ${pc(y)} convertible semiannually.
Calculate $X$.`,
          variables: { variant, c0, years, C, y, P },
          correctValue: X,
          format: "AMOUNT_2",
          distractors: [
            distractor((P - c0 * an(N, j) - C * v(j, N)) / (an(N, j) * N), "CALCULATION_DISTRACTOR", "Valued the increases as a level annuity of $nX$."),
            distractor((P - c0 * an(N, j) - C * v(j, N)) / (increasing - an(N, j)), "OFF_BY_ONE_PERIOD", "Started the increases one coupon late."),
            distractor((P - c0 * an(N, j) - C * v(j, N)) / Array.from({ length: years }, (_, k) => (k + 1) * v(y, k + 1)).reduce((s, x) => s + x, 0) / 2, "NOMINAL_RATE_ERROR", "Discounted annually at the nominal rate."),
            distractor((P - c0 * an(N, j)) / increasing, "CALCULATION_DISTRACTOR", "Left out the redemption value."),
          ],
          solutionSteps: `**Step 1 — Equation of value.** With $j = ${dec(j, 4)}$ and ${N} coupons of ${amt(c0)} + $tX$:
$$${mn(P, 2)} = ${mn(c0, 2)}\\,${aSym(N)} + X\\,(Ia)_{\\overline{${N}}|j} + ${mn(C)}\\,v^{${N}}.$$

**Step 2 — Factors.** $${aSym(N)} = ${dec(an(N, j), 5)}$, $(Ia)_{\\overline{${N}}|j} = ${dec(increasing, 5)}$, and $${mn(C)}v^{${N}} = ${mn(C * v(j, N), 4)}$.

**Step 3 — Solve.** $X = \\frac{${mn(P, 2)} - ${mn(c0 * an(N, j), 4)} - ${mn(C * v(j, N), 4)}}{${dec(increasing, 5)}} = ${mn(X, 4)}$.`,
          checks: [{ label: "X recovered", ok: Math.abs(X - Xtrue) < 0.01 }],
        };
      }
      const g = rng.choice([0.01, 0.015, 0.02, 0.025, 0.03]);
      const effective = variant === "GEO_AFTER";
      const y = gridRate(rng, 0.03, 0.09, 0.001);
      const j = effective ? perPeriod(y, 2) : y / 2;
      const ctrue = gridAmount(rng, 20, 150, 0.25);
      // GEO_AFTER: payments c(1+g)^t at t = 1..N; GEO_FIRST: R(1+g)^(t-1).
      const factor = Array.from({ length: N }, (_, k) => Math.pow(1 + g, effective ? k + 1 : k) * v(j, k + 1)).reduce((s, x) => s + x, 0);
      const P = cents(ctrue * factor + C * v(j, N));
      const key = (P - C * v(j, N)) / factor;
      const levelFactor = an(N, j);
      const shifted = effective ? factor / (1 + g) : factor * (1 + g);
      return {
        questionText: effective
          ? `An investor owns a bond that is redeemable for ${n(C)} in ${word(years)} years from now. The investor has just received a coupon of $c$ and each subsequent semiannual coupon will be ${pc(g, 2)} larger than the preceding coupon. The present value of this bond immediately after the payment of the coupon is ${n(P, 2)} assuming an annual effective yield rate of ${pc(y)}.
Calculate $c$.`
          : `A ${years}-year bond with semiannual coupons is purchased for ${n(P, 2)}. The bond is redeemable for ${n(C)}. The first coupon payment is equal to $R$ and each subsequent coupon is ${pc(g, 2)} larger than the previous coupon payment. The annual nominal yield rate on this bond is ${pc(y)} convertible semiannually.
Calculate $R$.`,
        variables: { variant, years, C, g, y, P },
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor((P - C * v(j, N)) / shifted, "OFF_BY_ONE_PERIOD", effective ? "Made the first future coupon $c$ instead of $c(1+g)$." : "Grew the first coupon by $1 + g$."),
          distractor((P - C * v(j, N)) / levelFactor, "CALCULATION_DISTRACTOR", "Ignored the growth of the coupons."),
          distractor((P - C * v(effective ? y / 2 : perPeriod(y, 2), N)) / Array.from({ length: N }, (_, k) => Math.pow(1 + g, effective ? k + 1 : k) * v(effective ? y / 2 : perPeriod(y, 2), k + 1)).reduce((s, x) => s + x, 0), "NOMINAL_RATE_ERROR", effective ? "Halved the annual effective rate." : "Treated the nominal rate as annual effective."),
          distractor(P / factor, "CALCULATION_DISTRACTOR", "Left out the redemption value."),
        ],
        solutionSteps: `**Step 1 — Rate per half-year.** ${effective ? `$j = (1 + ${dec(y, 3)})^{1/2} - 1 = ${dec(j, 6)}$.` : `$j = ${dec(y, 4)}/2 = ${dec(j, 6)}$.`}

**Step 2 — Value of the growing coupons per unit.** ${effective ? `Coupon $t$ is $c(${dec(1 + g, 3)})^t$` : `Coupon $t$ is $R(${dec(1 + g, 3)})^{t-1}$`}, so
$$\\sum_{t=1}^{${N}} ${effective ? `(${dec(1 + g, 3)})^t` : `(${dec(1 + g, 3)})^{t-1}`}\\,v^t = ${dec(factor, 5)},$$
a geometric series with ratio $${dec(1 + g, 3)}v$.

**Step 3 — Solve.** $${effective ? "c" : "R"} = \\frac{${mn(P, 2)} - ${mn(C)}v^{${N}}}{${dec(factor, 5)}} = \\frac{${mn(P - C * v(j, N), 4)}}{${dec(factor, 5)}} = ${mn(key, 4)}$.`,
        checks: [{ label: "coupon recovered", ok: Math.abs(key - ctrue) < 0.01 }],
      };
    },
  },

  {
    id: "FM_BOND_STEP_COUPONS",
    domain: BONDS,
    title: "Bond Whose Coupon Rate Changes",
    objective: "Value a bond whose coupon rate steps up or down partway through its term, at the yield rate the question implies.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [434, 449],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const F = 1000;
      const half = rng.int(5, 15);
      const N = 4 * half; // coupons over the whole term
      const years = 2 * half;
      const r1 = gridRate(rng, 0.04, 0.1, 0.005);
      const r2 = drawUntil(() => gridRate(rng, 0.04, 0.1, 0.005), (x) => Math.abs(x - r1) >= 0.01, r1 + 0.02);
      const stepPrice = (j: number, from: number) => {
        let total = 0;
        for (let t = from + 1; t <= N; t += 1) total += ((F * (t <= N / 2 ? r1 : r2)) / 2) * v(j, t - from);
        return total + F * v(j, N - from);
      };
      if (rng.next() < 0.5) {
        const rA = drawUntil(() => gridRate(rng, 0.04, 0.1, 0.005), (x) => x !== r1 && x !== r2, (r1 + r2) / 2);
        const y = gridRate(rng, 0.04, 0.1, 0.001);
        const PA = cents(bondPrice((F * rA) / 2, F, y / 2, N));
        const j = yieldFor(PA, (F * rA) / 2, F, N);
        const key = stepPrice(j, 0);
        return {
          questionText: `You are given the following information about two ${years}-year ${n(F)} face amount bonds, A and B, each yielding an annual nominal interest rate of $i$ convertible semiannually.
(i) Bond A has ${couponText(rA, 2)} and has a price of ${n(PA, 2)}.
(ii) Bond B has an annual coupon rate of ${pc(r1)} for the first ${half} years and ${pc(r2)} for the last ${half} years, all paid semiannually.
Calculate the price of Bond B.`,
          variables: { variant: "PRICE_B", F, years, rA, PA, r1, r2 },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(bondPrice((F * (r1 + r2)) / 4, F, j, N), "CALCULATION_DISTRACTOR", "Used the average coupon rate for the whole term."),
            distractor(bondPrice((F * r1) / 2, F, j, N), "CALCULATION_DISTRACTOR", "Used the first coupon rate for the whole term."),
            distractor(bondPrice((F * r2) / 2, F, j, N), "CALCULATION_DISTRACTOR", "Used the second coupon rate for the whole term."),
            distractor(((F * r1) / 2) * an(N / 2, j) + ((F * r2) / 2) * an(N / 2, j) + F * v(j, N), "CALCULATION_DISTRACTOR", "Did not defer the second block of coupons."),
          ],
          solutionSteps: `**Step 1 — Yield from Bond A.** Solve $${mn(PA, 2)} = ${mn((F * rA) / 2, 2)}\\,${aSym(N)} + ${mn(F)}\\,v^{${N}}$: $j = ${dec(j, 6)}$ per half-year.

**Step 2 — Bond B's coupons.** ${N / 2} coupons of ${n((F * r1) / 2, 2)}, then ${N / 2} coupons of ${n((F * r2) / 2, 2)} deferred ${N / 2} half-years.

**Step 3 — Price.**
$$${mn((F * r1) / 2, 2)}\\,${aSym(N / 2)} + ${mn((F * r2) / 2, 2)}\\,v^{${N / 2}}${aSym(N / 2)} + ${mn(F)}\\,v^{${N}} = ${mn(key, 2)}.$$`,
          checks: [{ label: "split valuation agrees", ok: close(key, ((F * r1) / 2) * an(N / 2, j) + ((F * r2) / 2) * v(j, N / 2) * an(N / 2, j) + F * v(j, N), 1e-10) }],
        };
      }
      const y1 = gridRate(rng, 0.04, 0.1, 0.005);
      const y2 = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - y1) >= 0.01, y1 - 0.02);
      const k = rng.int(2, N - 2);
      const key = stepPrice(y1 / 2, k);
      return {
        questionText: `A ${years}-year ${n(F)} face amount bond has an annual coupon rate of ${pc(r1)} paid semiannually for the first ${half} years, and an annual coupon rate of ${pc(r2)} paid semiannually for the last ${half} years. The bond is purchased to yield an annual nominal interest rate of ${pc(y1)} convertible semiannually.
At the time the ${ord(k)} coupon is paid, the bond has an annual nominal yield rate of ${pc(y2)} convertible semiannually.
Calculate the bond's book value immediately after the ${ord(k)} coupon is paid.`,
        variables: { variant: "BOOK", F, years, r1, r2, y1, y2, k },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(stepPrice(y2 / 2, k), "CALCULATION_DISTRACTOR", "Valued at the current market yield; book value uses the yield at purchase."),
          distractor(stepPrice(y1 / 2, k - 1), "OFF_BY_ONE_PERIOD", "Valued the bond one coupon earlier."),
          distractor(bondPrice((F * (k < N / 2 ? r1 : r2)) / 2, F, y1 / 2, N - k), "CALCULATION_DISTRACTOR", "Kept the current coupon rate for the rest of the term."),
          distractor(stepPrice(perPeriod(y1, 2), k), "NOMINAL_RATE_ERROR", "Treated the nominal yield as an annual effective rate."),
        ],
        solutionSteps: `**Step 1 — Book value uses the purchase yield.** The yield of ${pc(y2)} at coupon ${k} is a market figure; the book value is the price of the remaining payments at the original $j = ${dec(y1 / 2, 4)}$.

**Step 2 — Remaining payments.** ${k < N / 2 ? `${N / 2 - k} coupons of ${n((F * r1) / 2, 2)}, then ${N / 2} coupons of ${n((F * r2) / 2, 2)}` : `${N - k} coupons of ${n((F * r2) / 2, 2)}`}, and ${n(F)} at coupon ${N}.

**Step 3 — Book value.** Discounting these at $j$: ${n(key, 2)}.`,
        checks: [{ label: "book value recursion", ok: close(stepPrice(y1 / 2, k - 1) * (1 + y1 / 2) - (F * (k <= N / 2 ? r1 : r2)) / 2, key, 1e-9) }],
      };
    },
  },

  {
    id: "FM_BOND_CONCEPT_PREMIUM_DISCOUNT",
    domain: BONDS,
    title: "What Must Hold for a Premium or Discount Bond",
    objective: "Separate the relationships a premium (or discount) purchase forces from those that depend on the face and redemption values.",
    difficulty: 1,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    qualitative: true,
    soaSamples: [421],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const premium = rng.next() < 0.6;
      const years = rng.int(8, 30);
      const y = gridRate(rng, 0.03, 0.09, 0.001);
      const m = rng.choice([1, 2, 4]);
      const must = premium
        ? [
            { text: "The purchase price is greater than the redemption value.", why: "A premium is measured against the redemption value: $P - C > 0$." },
            { text: "The book value decreases from each coupon date to the next.", why: "Each coupon repays part of the premium, so the book value falls toward $C$." },
            { text: "The interest portion of each coupon is less than the coupon.", why: "The rest of each coupon amortizes the premium." },
            { text: "The amount for amortization of premium increases from one coupon to the next.", why: "Successive amounts grow by the factor $1 + j$." },
            { text: "The coupon is greater than the redemption value times the yield rate per coupon period.", why: "$P = C + (Fr - Cj)a_{\\overline{n}|}$, so $P > C$ exactly when $Fr > Cj$." },
          ]
        : [
            { text: "The redemption value is greater than the purchase price.", why: "A discount is measured against the redemption value: $C - P > 0$." },
            { text: "The book value increases from each coupon date to the next.", why: "Each period's interest exceeds the coupon, and the difference is added to the book value." },
            { text: "The interest portion of each coupon is greater than the coupon.", why: "The interest earned exceeds the coupon by the accumulation of discount." },
            { text: "The amount for accumulation of discount increases from one coupon to the next.", why: "Successive amounts grow by the factor $1 + j$." },
            { text: "The coupon is less than the redemption value times the yield rate per coupon period.", why: "$P = C + (Fr - Cj)a_{\\overline{n}|}$, so $P < C$ exactly when $Fr < Cj$." },
          ];
      const needNot = [
        { text: "The face amount is greater than the purchase price.", why: "The face amount is not fixed by whether the purchase is at a premium; only the redemption value is." },
        { text: "The redemption value is greater than the face amount.", why: "A bond may be redeemed at, above, or below its face amount." },
        { text: "The face amount is greater than the redemption value.", why: "A bond may be redeemed at, above, or below its face amount." },
        { text: "The purchase price is greater than the face amount.", why: "The price is compared with the redemption value, which need not equal the face amount." },
        { text: "The annual coupon rate is greater than the annual effective yield rate.", why: "What matters is $Fr$ against $Cj$; with $C \\ne F$ the coupon rate and yield rate can be in either order." },
        { text: "The annual coupon rate is less than the annual effective yield rate.", why: "What matters is $Fr$ against $Cj$; with $C \\ne F$ the coupon rate and yield rate can be in either order." },
        premium
          ? { text: "The redemption value is greater than the purchase price.", why: "At a premium the price exceeds the redemption value, so this is false." }
          : { text: "The purchase price is greater than the redemption value.", why: "At a discount the price is below the redemption value, so this is false." },
        premium
          ? { text: "The book value increases from each coupon date to the next.", why: "At a premium the book value falls toward the redemption value." }
          : { text: "The book value decreases from each coupon date to the next.", why: "At a discount the book value rises toward the redemption value." },
      ];
      const key = rng.choice(must);
      const wrong = rng.shuffle(needNot).slice(0, 4);
      const coupons = m === 1 ? "annual" : m === 2 ? "semi-annual" : "quarterly";
      return {
        kind: "CHOICE",
        questionText: `A ${years}-year bond is purchased at a ${premium ? "premium" : "discount"}. The bond has an annual effective yield rate of ${pc(y)} and pays ${coupons} coupons.
Determine which of the following statements about this bond must be true.`,
        variables: { premium: premium ? 1 : 0, years, y, m },
        choices: [
          { text: key.text, isCorrect: true, explanation: key.why },
          ...wrong.map((item) => ({ text: item.text, isCorrect: false, type: "CALCULATION_DISTRACTOR" as const, explanation: `Need not be true. ${item.why}` })),
        ],
        solutionSteps: `**Step 1 — What "${premium ? "premium" : "discount"}" means.** It compares the price with the redemption value $C$, not the face amount $F$: $P = C + (Fr - Cj)\\,a_{\\overline{n}|j}$, so the bond is at a ${premium ? "premium ($P > C$) exactly when $Fr > Cj$" : "discount ($P < C$) exactly when $Fr < Cj$"}.

**Step 2 — The statement that must hold.** "${key.text}" ${key.why} The other statements depend on how the face amount compares with the redemption value, or are false.`,
      };
    },
  },

  {
    id: "FM_BOND_CONCEPT_CALLABLE",
    domain: BONDS,
    title: "Pricing Callable Bonds",
    objective: "State the rules for choosing the redemption date that must be assumed when pricing a callable bond.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    qualitative: true,
    soaSamples: [72, 136, 417],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pairs: StatementPair[] = [
        {
          truth: "If the call price equals the redemption value and the bond is priced at a premium, the price that guarantees the yield assumes the earliest possible call date.",
          falsehood: "If the call price equals the redemption value and the bond is priced at a premium, the price that guarantees the yield assumes redemption at maturity.",
          why: "At a premium the investor loses the premium over fewer coupons if the bond is called early, so the earliest date is the worst case.",
        },
        {
          truth: "If the call price equals the redemption value and the bond is priced at a discount, the price that guarantees the yield assumes redemption at the latest possible date.",
          falsehood: "If the call price equals the redemption value and the bond is priced at a discount, the price that guarantees the yield assumes the earliest possible call date.",
          why: "At a discount the gain from redemption comes soonest with an early call, so the latest date is the worst case.",
        },
        {
          truth: "The price that guarantees the investor's yield is the smallest of the prices calculated at each possible redemption date.",
          falsehood: "The price that guarantees the investor's yield is the largest of the prices calculated at each possible redemption date.",
          why: "Paying the smallest price secures the yield whichever date the issuer chooses.",
        },
        {
          truth: "For a given purchase price, the minimum yield the investor can receive is the smallest of the yields to each possible redemption date.",
          falsehood: "For a given purchase price, the minimum yield the investor can receive is the yield to maturity.",
          why: "The issuer may redeem on any allowed date, so the investor must allow for the worst of them.",
        },
        {
          truth: "If a bond priced for the worst-case redemption date is redeemed on another date, the investor's yield is at least the yield used to set the price.",
          falsehood: "If a bond priced for the worst-case redemption date is redeemed on another date, the investor's yield is less than the yield used to set the price.",
          why: "Every other date gives a price at least as high at that yield, so the yield actually earned can only be higher.",
        },
        {
          truth: "When the call price is higher for earlier call dates, the worst date must be found by checking the dates within each period of constant call price.",
          falsehood: "When the call price is higher for earlier call dates, the earliest call date is always the worst case for the investor.",
          why: "A higher call price can make an early call favourable; only a comparison across the periods finds the worst case.",
        },
      ];
      const { questionText, choices, solutionSteps } = romanStatements(rng, {
        lead: "An investor is pricing a callable bond to guarantee a minimum yield rate. The bond may be redeemed on any of several coupon dates.",
        pairs,
      });
      return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps, fixedOrder: true };
    },
  },

  {
    id: "FM_BOND_CONCEPT_AMORTIZATION",
    domain: BONDS,
    title: "Properties of a Bond Amortization Schedule",
    objective: "Recognise the standard relationships in a bond amortization schedule.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    qualitative: true,
    soaSamples: [7, 47, 431],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pairs: StatementPair[] = [
        {
          truth: "The book value just after coupon $t$ is $Fr\\,a_{\\overline{n-t}|j} + C v^{n-t}$.",
          falsehood: "The book value just after coupon $t$ is $Fr\\,a_{\\overline{n-t+1}|j} + C v^{n-t+1}$.",
          why: "Prospectively, $n - t$ coupons and the redemption value remain.",
        },
        {
          truth: "The principal adjustment in coupon $t$ is $(Fr - Cj)v^{n-t+1}$.",
          falsehood: "The principal adjustment in coupon $t$ is $(Fr - Cj)v^{n-t}$.",
          why: "The adjustment is the coupon less $j$ times the book value after coupon $t - 1$, which works out to $(Fr - Cj)v^{n-t+1}$.",
        },
        {
          truth: "The interest portion of coupon $t$ is $j$ times the book value just after coupon $t - 1$.",
          falsehood: "The interest portion of coupon $t$ is $j$ times the book value just after coupon $t$.",
          why: "Interest is earned over the period on the book value at its start.",
        },
        {
          truth: "The principal adjustments over the whole term add up to $P - C$.",
          falsehood: "The principal adjustments over the whole term add up to $P - F$.",
          why: "The book value moves from the price to the redemption value.",
        },
        {
          truth: "The total interest earned over the term is $n\\,Fr + C - P$.",
          falsehood: "The total interest earned over the term is $n\\,Fr + P - C$.",
          why: "Total received, $n\\,Fr + C$, less the price paid.",
        },
        {
          truth: "Successive principal adjustments grow by the factor $1 + j$.",
          falsehood: "Successive principal adjustments grow by the factor $1 + r$.",
          why: "$v^{n-t}/v^{n-t+1} = 1 + j$.",
        },
        {
          truth: "The book value just after coupon $t$ is $P(1+j)^t - Fr\\,s_{\\overline{t}|j}$.",
          falsehood: "The book value just after coupon $t$ is $P(1+j)^t - Fr\\,\\ddot{s}_{\\overline{t}|j}$.",
          why: "Retrospectively, the price accumulates for $t$ periods less the coupons, each paid at the end of a period.",
        },
      ];
      const { questionText, choices, solutionSteps } = oneOfFive(rng, {
        lead: "A bond with face amount $F$, coupon rate $r$ per coupon period, redemption value $C$ and $n$ coupons is bought at price $P$ to yield $j$ per coupon period, where $j > 0$.",
        pairs,
        askFalse: rng.next() < 0.4,
      });
      return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps };
    },
  },
];
