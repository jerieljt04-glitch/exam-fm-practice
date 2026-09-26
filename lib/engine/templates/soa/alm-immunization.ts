/**
 * Asset-liability management: exact cash-flow matching, full immunization,
 * Redington immunization, and the qualitative items on these techniques —
 * modelled on the SOA sample-set question types for this part of the syllabus.
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
  amt,
  an,
  cast,
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
  oneOfFive,
  pc,
  romanChoices,
  romanPattern,
  romanStatements,
  table,
  v,
  word,
  type Flow,
  type StatementPair,
} from "./kit";

const ALM = "ALM_IMMUNIZATION" as const;

const amountFormat = (value: number) => (Math.abs(value) < 200 ? "AMOUNT_2" : "AMOUNT_0") as "AMOUNT_2" | "AMOUNT_0";

/**
 * Present values a and b to place at times s1 < s2 so that the assets match the
 * liabilities' present value and Macaulay duration under discount function df.
 */
function matchTwo(liabilities: readonly Flow[], s1: number, s2: number, df: (t: number) => number) {
  const PL = liabilities.reduce((s, [t, a]) => s + a * df(t), 0);
  const TL = liabilities.reduce((s, [t, a]) => s + t * a * df(t), 0);
  const b = (TL - s1 * PL) / (s2 - s1);
  const a = PL - b;
  return { a, b, faceA: a / df(s1), faceB: b / df(s2), PL, DL: TL / PL };
}

/** A matching bond: maturity in periods, coupon and yield per period. */
interface MatchBond {
  maturity: number;
  coupon: number;
  yieldRate: number;
}

/** Price per unit of face of a matching bond. */
const unitPrice = (bond: MatchBond) => bond.coupon * an(bond.maturity, bond.yieldRate) + v(bond.yieldRate, bond.maturity);

/**
 * Face amounts that match liabilities exactly, working back from the last
 * liability: each bond's face plus final coupon covers its maturity's
 * liability less the coupons from longer bonds.
 */
function matchFaces(liabilityAt: (t: number) => number, bonds: readonly MatchBond[]): number[] {
  const faces = bonds.map(() => 0);
  const order = bonds.map((b, k) => k).sort((p, q) => bonds[q].maturity - bonds[p].maturity);
  for (const k of order) {
    const t = bonds[k].maturity;
    const coupons = bonds.reduce((s, b, j) => s + (b.maturity > t ? b.coupon * faces[j] : 0), 0);
    faces[k] = (liabilityAt(t) - coupons) / (1 + bonds[k].coupon);
  }
  return faces;
}

export const SOA_ALM_IMMUNIZATION_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ALM_EXACT_MATCH",
    domain: ALM,
    title: "Exact Cash-Flow Matching with Bonds",
    objective: "Work backward from the last liability to find the bond holdings that match every liability exactly, and their cost.",
    difficulty: 2,
    topics: ["IMMUNIZATION", "BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [54, 192, 308, 346, 151, 224, 344],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const ask = rng.choice(["UNITS", "FACE", "COST", "COST", "DIFF", "MISSING"] as const);
      if (ask === "MISSING") {
        // Bonds at years 1, 3 and 4 only; the year-2 liability is met by coupons alone.
        const coupons = [gridRate(rng, 0.01, 0.04, 0.01), gridRate(rng, 0.03, 0.07, 0.01), gridRate(rng, 0.04, 0.09, 0.01)];
        const maturities = [1, 3, 4];
        const faces = [gridAmount(rng, 2000, 8000, 100), gridAmount(rng, 5000, 20000, 100), gridAmount(rng, 5000, 20000, 100)];
        const L4 = faces[2] * (1 + coupons[2]);
        const L3 = faces[1] * (1 + coupons[1]) + coupons[2] * faces[2];
        const X = coupons[1] * faces[1] + coupons[2] * faces[2];
        const L1 = faces[0] * (1 + coupons[0]) + X;
        const liabilities = [Math.round(L1), Math.round(L3), Math.round(L4)];
        // Re-derive from the printed (whole) liabilities.
        const f4 = liabilities[2] / (1 + coupons[2]);
        const f3 = (liabilities[1] - coupons[2] * f4) / (1 + coupons[1]);
        const key = coupons[1] * f3 + coupons[2] * f4;
        return {
          questionText: `A company faces the following liabilities at the end of the corresponding years:
${table(["Year", "1", "2", "3", "4"], [["\\text{Liability}", mn(liabilities[0]), "X", mn(liabilities[1]), mn(liabilities[2])]])}
The company can invest in the following three annual coupon bonds redeemable at par:
${table(["Bond", "Term (in years)", "Annual coupon rate"], maturities.map((t, k) => [["A", "B", "C"][k], String(t), mpc(coupons[k])]))}
The company invests in each bond so that the asset and liability cash flows are exactly matched.
Calculate $X$.`,
          variables: { variant: ask, m: 1, maturities, coupons, liabilities, times: [1, 3, 4] },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(coupons[2] * f4, "CALCULATION_DISTRACTOR", "Counted only the four-year bond's coupon."),
            distractor(coupons[1] * (liabilities[1] / (1 + coupons[1])) + coupons[2] * f4, "CALCULATION_DISTRACTOR", "Did not subtract the four-year bond's coupon when sizing the three-year bond."),
            distractor(key + coupons[0] * (liabilities[0] - key) / (1 + coupons[0]), "CALCULATION_DISTRACTOR", "Added the one-year bond's coupon, which is paid at year 1."),
            distractor(coupons[1] * f3, "CALCULATION_DISTRACTOR", "Counted only the three-year bond's coupon."),
          ],
          solutionSteps: `**Step 1 — Four-year bond.** Its face $F_C$ satisfies $${dec(1 + coupons[2], 2)}F_C = ${mn(liabilities[2])}$, so $F_C = ${mn(f4, 2)}$.

**Step 2 — Three-year bond.** $${dec(1 + coupons[1], 2)}F_B + ${dec(coupons[2], 2)}F_C = ${mn(liabilities[1])}$, so $F_B = ${mn(f3, 2)}$.

**Step 3 — Year 2.** Only the coupons of bonds B and C are paid then: $X = ${dec(coupons[1], 2)}(${mn(f3, 2)}) + ${dec(coupons[2], 2)}(${mn(f4, 2)}) = ${mn(key, 2)}$.`,
          checks: [{ label: "faces positive", ok: f3 > 0 && f4 > 0 }],
        };
      }
      const semi = ask === "COST" && rng.next() < 0.35;
      const m = semi ? 2 : 1;
      const count = semi ? 2 : 3;
      const maturities = Array.from({ length: count }, (_, k) => k + 1);
      const zerosOnly = ask === "DIFF";
      const quotedCoupons = maturities.map((t) =>
        zerosOnly ? 0 : ask === "FACE" && t === count ? 0 : rng.choice([0, 0.01, 0.02, 0.04, 0.05, 0.06, 0.07, 0.08])
      );
      const quotedYields = maturities.map(() => gridRate(rng, 0.03, 0.12, 0.005));
      const bonds: MatchBond[] = maturities.map((t, k) => ({ maturity: t, coupon: quotedCoupons[k] / m, yieldRate: quotedYields[k] / m }));
      const base = ask === "UNITS" ? 100 : ask === "FACE" ? 1000 : gridAmount(rng, 1000, 10000, 500);
      const liabilities = maturities.map(() => (ask === "FACE" && rng.next() < 0.6 ? base : gridAmount(rng, base * 0.9, base * 1.1, ask === "UNITS" ? 1 : 50)));
      const faces = matchFaces((t) => liabilities[t - 1], bonds);
      const prices = bonds.map((b, k) => faces[k] * unitPrice(b));
      const cost = prices.reduce((s, x) => s + x, 0);
      const target = ask === "UNITS" ? 0 : ask === "FACE" ? rng.int(0, count - 2) : 0;
      const bondNames = semi || ask === "FACE" ? ["I", "II", "III"] : ["A", "B", "C"];
      const period = semi ? "six months" : "year";
      const timeText = (t: number) => (semi ? (t === 1 ? "six months" : "one year") : `${word(t)} year${t === 1 ? "" : "s"}`);
      const bondTable = table(
        ["Bond", semi ? "Maturity (months)" : "Maturity (years)", semi ? "Annual coupon rate (paid semiannually)" : "Annual coupon rate", semi ? "Annual nominal yield (conv. semiannually)" : "Annual effective yield"],
        bonds.map((b, k) => [bondNames[k], String(semi ? 6 * b.maturity : b.maturity), mpc(quotedCoupons[k]), mpc(quotedYields[k])])
      );
      const liabilityText = listing(liabilities.map((L, k) => `${n(L)} at the end of ${timeText(k + 1)}`));
      let key: number;
      let askText: string;
      let wrong: ReturnType<typeof distractor>[];
      const naive = liabilities.map((L, k) => L / (1 + bonds[k].coupon));
      if (ask === "UNITS") {
        key = faces[0] / 100;
        askText = "Calculate the number of units of Bond A that must be purchased to match the liabilities exactly.";
        wrong = [
          distractor(naive[0] / 100, "CALCULATION_DISTRACTOR", "Ignored the coupons from the longer bonds."),
          distractor(liabilities[0] / 100, "CALCULATION_DISTRACTOR", "Matched the first liability with face value alone."),
          distractor(prices[0] / 100, "CALCULATION_DISTRACTOR", "Gave the amount invested, per 100, instead of the number of units."),
          distractor(faces[0] / 100 / (1 + bonds[0].yieldRate), "CALCULATION_DISTRACTOR", "Discounted the number of units."),
        ];
      } else if (ask === "FACE") {
        key = faces[target];
        askText = `Calculate the face value of Bond ${["I", "II", "III"][target]} that should be purchased to exactly match the liabilities.`;
        wrong = [
          distractor(naive[target], "CALCULATION_DISTRACTOR", "Ignored the coupons from the longer bonds."),
          distractor(liabilities[target], "CALCULATION_DISTRACTOR", "Set the face value equal to the liability."),
          distractor(prices[target], "CALCULATION_DISTRACTOR", "Gave the purchase price instead of the face value."),
          distractor(faces[target] * (1 + bonds[target].coupon), "CALCULATION_DISTRACTOR", "Included the final coupon in the face value."),
        ];
      } else if (ask === "DIFF") {
        key = prices[0] - prices[count - 1];
        askText = `Calculate how much more will be invested in the 1-year bond than in the ${count}-year bond.`;
        wrong = [
          distractor(liabilities[0] - liabilities[count - 1], "CALCULATION_DISTRACTOR", "Compared the face amounts instead of the amounts invested."),
          distractor(liabilities[0] * v(quotedYields[count - 1], 1) - liabilities[count - 1] * v(quotedYields[count - 1], count), "CALCULATION_DISTRACTOR", `Discounted both at the ${count}-year yield.`),
          distractor(liabilities[0] * v(quotedYields[0], 1) - liabilities[count - 1] * v(quotedYields[0], count), "CALCULATION_DISTRACTOR", "Discounted both at the 1-year yield."),
          distractor(prices[0] - prices[1], "CALCULATION_DISTRACTOR", "Compared with the 2-year bond."),
        ];
      } else {
        key = cost;
        askText = "Calculate the total purchase price of the bonds required to exactly match the liabilities.";
        wrong = [
          distractor(naive.reduce((s, f, k) => s + f * unitPrice(bonds[k]), 0), "CALCULATION_DISTRACTOR", "Ignored the coupons from the longer bonds."),
          distractor(liabilities.reduce((s, L, k) => s + L * v(bonds[k].yieldRate, k + 1), 0), "CALCULATION_DISTRACTOR", "Discounted each liability at the yield of the bond maturing then."),
          distractor(faces.reduce((s, f) => s + f, 0), "CALCULATION_DISTRACTOR", "Gave the total face value."),
          distractor(liabilities.reduce((s, L, k) => s + L * v(quotedYields[k], k + 1), 0), "NOMINAL_RATE_ERROR", semi ? "Treated the nominal yields as annual rates per half-year." : "Discounted each liability as a zero-coupon payment."),
        ];
      }
      const lead =
        ask === "UNITS"
          ? `An insurance company must pay liabilities of ${liabilityText}. The only investments available to the company are the following bonds. All bonds have a par value of 100 and will be redeemed at par; coupons are paid annually.`
          : ask === "FACE"
            ? `A construction firm is facing liabilities of ${liabilityText}. The following bonds are available to match these liabilities; coupons are paid annually and bonds are redeemed at face value.`
            : ask === "DIFF"
              ? `A company has liabilities of ${liabilityText}. The company will exactly match the cash flows of assets and liabilities. The following zero-coupon bonds are available:`
              : `A company must pay liabilities of ${liabilityText}. The only investments available are the following bonds, redeemable at par${semi ? ", with coupons paid every six months" : ", with coupons paid annually"}:`;
      return {
        questionText: `${lead}
${bondTable}
${askText}`,
        variables: { variant: ask, m, maturities, coupons: quotedCoupons, yields: quotedYields, liabilities, target },
        correctValue: key,
        format: ask === "UNITS" ? "AMOUNT_4" : amountFormat(key),
        distractors: wrong,
        solutionSteps: `**Step 1 — Work back from the last liability.** Each bond pays its face plus a final coupon at maturity, and coupons at every earlier ${period}. The face of the longest bond covers the last liability; each shorter bond covers its liability less the coupons from longer bonds:
${bonds
  .map((b, k) => ({ b, k }))
  .reverse()
  .map(({ b, k }) => `- maturing at ${timeText(b.maturity)}: face $= ${mn(faces[k], 4)}$`)
  .join("\n")}

**Step 2 — Prices.** Each face is valued at its bond's yield: ${bonds.map((b, k) => `${n(prices[k], 2)}`).join(", ")}, totalling ${n(cost, 2)}.

**Step 3 — Answer.** ${ask === "UNITS" ? `Bond A's face is ${n(faces[0], 4)}, which is ${n(key, 4)} units of 100.` : ask === "FACE" ? `The face value is ${n(key, 2)}.` : ask === "DIFF" ? `$${mn(prices[0], 2)} - ${mn(prices[count - 1], 2)} = ${mn(key, 2)}$.` : `The total cost is ${n(key, 2)}.`}`,
        checks: [
          { label: "faces positive", ok: faces.every((f) => f > 0) },
          {
            label: "cash flows match",
            ok: maturities.every((t) => close(bonds.reduce((s, b, k) => s + (b.maturity >= t ? faces[k] * b.coupon : 0) + (b.maturity === t ? faces[k] : 0), 0), liabilities[t - 1], 1e-9)),
          },
        ],
      };
    },
  },

  {
    id: "FM_ALM_EXACT_MATCH_PARTIAL",
    domain: ALM,
    title: "Exact Matching with Partial Information",
    objective: "Complete an exactly matched portfolio from a mortgage schedule, a known total cost, a known holding, or a forward reinvestment.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "BONDS_AND_CURVES"],
    steps: 3,
    soaSamples: [38, 150, 274, 39],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [person] = cast(rng);
      const variant = rng.choice(["MORTGAGES", "GIVEN_TOTAL", "GIVEN_LONG", "FORWARD"] as const);
      if (variant === "MORTGAGES") {
        const L2 = gridAmount(rng, 500, 3000, 100);
        const L1 = L2 + gridAmount(rng, 200, 2000, 100);
        const i1 = gridRate(rng, 0.03, 0.09, 0.005);
        const i2 = gridRate(rng, 0.03, 0.09, 0.005);
        const Y = L2 * an(2, i2);
        const X = (L1 - L2) / (1 + i1);
        const key = X + Y;
        return {
          questionText: `${person} must pay liabilities of ${n(L1)} due one year from now and another ${n(L2)} due two years from now. The liabilities are exactly matched with the following two investments:
Mortgage I: A one-year mortgage in which $X$ is lent. It is repaid with a single payment at time one. The annual effective interest rate is ${pc(i1)}.
Mortgage II: A two-year mortgage in which $Y$ is lent. It is repaid with two equal annual payments. The annual effective interest rate is ${pc(i2)}.
Calculate $X + Y$.`,
          variables: { variant, L1, L2, i1, i2 },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(L1 / (1 + i1) + L2 * v(i2, 2), "CALCULATION_DISTRACTOR", "Ignored that Mortgage II also pays at time one."),
            distractor((L1 - L2) / (1 + i1) + (L2 / 2) * an(2, i2), "CALCULATION_DISTRACTOR", "Split the second liability over the two mortgage payments."),
            distractor(L1 * v(i1, 1) + L2 * v(i1, 2), "CALCULATION_DISTRACTOR", "Discounted both liabilities at Mortgage I's rate."),
            distractor(X + L2 * an(2, i1), "CALCULATION_DISTRACTOR", "Valued Mortgage II at Mortgage I's rate."),
          ],
          solutionSteps: `**Step 1 — Mortgage II.** Its equal payments must be ${n(L2)} (the whole time-two liability), so $Y = ${mn(L2)}\\,a_{\\overline{2}|${mpc(i2)}} = ${mn(Y, 2)}$.

**Step 2 — Mortgage I.** Mortgage II already pays ${n(L2)} at time one, so Mortgage I pays $${mn(L1)} - ${mn(L2)} = ${mn(L1 - L2)}$: $X = ${mn(L1 - L2)}/${dec(1 + i1, 3)} = ${mn(X, 2)}$.

**Step 3 — Total.** $X + Y = ${mn(key, 2)}$.`,
          checks: [{ label: "positive", ok: X > 0 && Y > 0 }],
        };
      }
      if (variant === "GIVEN_TOTAL") {
        const L1 = rng.choice([1000, 2000, 5000]);
        const y1 = gridRate(rng, 0.03, 0.08, 0.005);
        const y2 = gridRate(rng, 0.03, 0.09, 0.005);
        const c = rng.choice([0.05, 0.06, 0.08, 0.1]);
        const F = 1000;
        const P2 = (F * c) / (1 + y2) + (F * (1 + c)) / Math.pow(1 + y2, 2);
        const Btrue = gridAmount(rng, 1, 8, 0.5) * (L1 / 1000);
        const Atrue = L1 - F * c * Btrue;
        const total = cents(Atrue / (1 + y1) + Btrue * P2);
        const B = (total - L1 / (1 + y1)) / (P2 - (F * c) / (1 + y1));
        const A = L1 - F * c * B;
        const key = A / (1 + y1);
        return {
          questionText: `A company must pay liabilities of ${n(L1)} at the end of year 1 and $X$ at the end of year 2.
The only investments available are:
(i) One-year zero-coupon bonds with an annual effective yield of ${pc(y1)}
(ii) Two-year bonds with a par value of ${n(F)} and ${pc(c)} annual coupons, with an annual effective yield of ${pc(y2)}
The company constructed a portfolio that creates an exact cash flow matching strategy for these liabilities. The total purchase price of this portfolio is ${n(total, 2)}.
Calculate the amount invested in the one-year zero-coupon bonds.`,
          variables: { variant, L1, y1, y2, c, F, total },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(L1 / (1 + y1), "CALCULATION_DISTRACTOR", "Ignored the coupons of the two-year bonds at year 1."),
            distractor(A, "CALCULATION_DISTRACTOR", "Gave the redemption value of the zero-coupon bonds, not the amount invested."),
            distractor(total - key, "CALCULATION_DISTRACTOR", "Gave the amount invested in the two-year bonds."),
            distractor((L1 - F * c * (total / P2)) / (1 + y1), "CALCULATION_DISTRACTOR", "Assumed the whole portfolio was in two-year bonds when counting coupons."),
          ],
          solutionSteps: `**Step 1 — Unknowns.** Let $A$ be the redemption value of the zero-coupon bonds and $B$ the number of two-year bonds, each priced $${dec(c * F, 0)}v + ${dec(F * (1 + c), 0)}v^2 = ${mn(P2, 4)}$ at ${pc(y2)}.

**Step 2 — Two equations.** Matching year 1: $A + ${dec(F * c, 0)}B = ${mn(L1)}$. Cost: $A/${dec(1 + y1, 3)} + ${mn(P2, 4)}B = ${mn(total, 2)}$. Substituting, $B = ${dec(B, 5)}$ and $A = ${mn(A, 2)}$.

**Step 3 — Amount in the zero-coupon bonds.** $${mn(A, 2)}/${dec(1 + y1, 3)} = ${mn(key, 2)}$.`,
          checks: [{ label: "positive", ok: A > 0 && B > 0 }],
        };
      }
      if (variant === "GIVEN_LONG") {
        const k = rng.choice([1.5, 2, 3]);
        const y1 = gridRate(rng, 0.03, 0.08, 0.005);
        const y2 = gridRate(rng, 0.03, 0.09, 0.005);
        const c = rng.choice([0.03, 0.04, 0.05, 0.06]);
        const unit = c / (1 + y2) + (1 + c) / Math.pow(1 + y2, 2);
        const Ytrue = gridAmount(rng, 5000, 20000, 500);
        const I2 = Math.round(Ytrue * unit);
        const Y = I2 / unit;
        const L2 = Y * (1 + c);
        const L1 = L2 / k;
        const key = (L1 - c * Y) / (1 + y1);
        return {
          questionText: `An insurance company has liabilities due at the end of each of the next two years. The liability due at the end of the second year is ${k === 2 ? "twice" : k === 3 ? "three times" : `${k} times`} that for the first year.
The company uses a combination of the following two bonds to match the liabilities. The second bond has annual coupons.
${table(["Term to maturity (years)", "Annual coupon rate", "Annual effective yield"], [["1", mpc(0), mpc(y1)], ["2", mpc(c), mpc(y2)]])}
Assume both bonds are redeemed at par and the company invests ${n(I2)} in the two-year bond.
Calculate the amount the company should invest in the one-year bond to construct an exactly matched portfolio.`,
          variables: { variant, k, y1, y2, c, c1: 0, I2 },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(L1 / (1 + y1), "CALCULATION_DISTRACTOR", "Ignored the two-year bond's first coupon."),
            distractor((I2 / k - c * Y) / (1 + y1), "CALCULATION_DISTRACTOR", "Took the second liability as the amount invested in the two-year bond."),
            distractor((Y / k - c * Y) / (1 + y1), "CALCULATION_DISTRACTOR", "Took the second liability as the face value, leaving out the final coupon."),
            distractor(L1 - c * Y, "CALCULATION_DISTRACTOR", "Did not discount the one-year bond."),
          ],
          solutionSteps: `**Step 1 — Face of the two-year bond.** $${mn(I2)} = Y\\left(\\frac{${c}}{${dec(1 + y2, 3)}} + \\frac{${dec(1 + c, 2)}}{${dec(1 + y2, 3)}^2}\\right)$, so $Y = ${mn(Y, 2)}$.

**Step 2 — Liabilities.** The second-year liability is $${dec(1 + c, 2)}Y = ${mn(L2, 2)}$, so the first is $${mn(L2, 2)}/${k} = ${mn(L1, 2)}$.

**Step 3 — One-year bond.** It covers the first liability less the coupon $${c}Y = ${mn(c * Y, 2)}$: $(${mn(L1, 2)} - ${mn(c * Y, 2)})/${dec(1 + y1, 3)} = ${mn(key, 2)}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      const L1 = gridAmount(rng, 500, 3000, 100);
      const L3 = gridAmount(rng, 1000, 5000, 100);
      const y1 = gridRate(rng, 0.03, 0.08, 0.005);
      const y2 = gridRate(rng, 0.03, 0.09, 0.005);
      const f = gridRate(rng, 0.03, 0.09, 0.005);
      const key = L1 / (1 + y1) + L3 / ((1 + f) * Math.pow(1 + y2, 2));
      return {
        questionText: `${person} must pay liabilities of ${n(L1)} due one year from now and another ${n(L3)} due three years from now. There are two available investments:
Bond I: A one-year zero-coupon bond that matures for its face amount. The yield rate is ${pc(y1)} per year.
Bond II: A two-year zero-coupon bond. The yield rate is ${pc(y2)} per year.
At the present time the one-year forward rate for an investment made two years from now is ${pc(f)}.
${person} plans to buy amounts of each bond, and to reinvest the proceeds from Bond II in a one-year zero-coupon bond.
Assuming the reinvestment earns the forward rate, calculate the total purchase price of Bond I and Bond II.`,
        variables: { variant, L1, L3, y1, y2, f },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(L1 / (1 + y1) + L3 / Math.pow(1 + y2, 3), "CALCULATION_DISTRACTOR", "Discounted the third-year liability for three years at the two-year yield."),
          distractor(L1 / (1 + y1) + L3 / Math.pow(1 + y2, 2), "CALCULATION_DISTRACTOR", "Left out the reinvestment for the third year."),
          distractor(L1 / (1 + y1) + L3 / ((1 + f) * (1 + y1) * (1 + y2)), "CALCULATION_DISTRACTOR", "Combined the one- and two-year yields for the first two years."),
          distractor(L1 / (1 + y1) + L3 / Math.pow(1 + f, 3), "CALCULATION_DISTRACTOR", "Discounted the third-year liability at the forward rate throughout."),
        ],
        solutionSteps: `**Step 1 — Bond I.** It must pay ${n(L1)} at time 1: cost $${mn(L1)}/${dec(1 + y1, 3)} = ${mn(L1 / (1 + y1), 2)}$.

**Step 2 — Bond II.** At time 2 it must provide $${mn(L3)}/${dec(1 + f, 3)} = ${mn(L3 / (1 + f), 2)}$ to reinvest at the forward rate; its cost is $${mn(L3 / (1 + f), 2)}/${dec(1 + y2, 3)}^2 = ${mn(L3 / (1 + f) / Math.pow(1 + y2, 2), 2)}$.

**Step 3 — Total.** ${n(key, 2)}.`,
        checks: [{ label: "positive", ok: key > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_FULL_IMMUNIZATION",
    domain: ALM,
    title: "Full Immunization of a Single Liability",
    objective: "Match present value and duration with asset cash flows before and after a single liability, solving for an amount, a time, the liability, or the rate.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 3,
    soaSamples: [56, 240, 307, 105, 57, 339, 275, 304],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [person] = cast(rng);
      const variant = rng.choice(["ASK", "ASK", "UNKNOWN_TIME", "LIABILITY", "THREE_ASSETS"] as const);
      if (variant === "ASK") {
        const T = rng.int(2, 10);
        const t1 = rng.int(1, T - 1);
        const t2 = T + rng.int(1, 5);
        const L = gridAmount(rng, 5000, 1000000, 1000);
        const i = gridRate(rng, 0.03, 0.08, 0.001);
        const fit = matchTwo([[T, L]], t1, t2, (t) => v(i, t));
        const ask = rng.choice(["A", "B", "DIFF"] as const);
        // The difference is asked the way round that makes it positive.
        const bigFirst = fit.faceA >= fit.faceB;
        const key = ask === "A" ? fit.faceA : ask === "B" ? fit.faceB : Math.abs(fit.faceA - fit.faceB);
        const diffText = bigFirst ? "$A - B$" : "$B - A$";
        const naive = matchTwo([[T, L]], t1, t2, () => 1);
        return {
          questionText: `${person} has a liability of ${n(L)} due in ${word(T)} years. This liability will be met with payments of $A$ in ${word(t1)} year${t1 === 1 ? "" : "s"} and $B$ in ${word(t2)} years. ${person} is employing a full immunization strategy using an annual effective interest rate of ${pc(i)}.
Calculate ${ask === "A" ? "$A$" : ask === "B" ? "$B$" : diffText}.`,
          variables: { variant, T, t1, t2, L, i, ask },
          correctValue: key,
          format: amountFormat(key),
          distractors: [
            distractor(ask === "A" ? fit.a : ask === "B" ? fit.b : Math.abs(fit.a - fit.b), "CALCULATION_DISTRACTOR", "Gave present values instead of the payment amounts."),
            distractor(ask === "A" ? naive.faceA : ask === "B" ? naive.faceB : Math.abs(naive.faceA - naive.faceB), "CALCULATION_DISTRACTOR", "Matched the undiscounted amounts and times."),
            ...(ask === "DIFF" ? [] : [distractor(ask === "A" ? fit.faceB : fit.faceA, "CALCULATION_DISTRACTOR", "Swapped the two asset payments.")]),
            distractor(ask === "A" ? fit.a * Math.pow(1 + i, t2) : ask === "B" ? fit.b * Math.pow(1 + i, t1) : Math.abs(fit.a * Math.pow(1 + i, t2) - fit.b * Math.pow(1 + i, t1)), "CALCULATION_DISTRACTOR", "Accumulated each present value to the other asset's date."),
          ],
          solutionSteps: `**Step 1 — Liability.** Present value $${mn(L)}v^{${T}} = ${mn(fit.PL, 2)}$, duration ${T}.

**Step 2 — Match present value and duration.** With $a$, $b$ the present values of $A$ and $B$: $a + b = ${mn(fit.PL, 2)}$ and $${t1}a + ${t2}b = ${T}(${mn(fit.PL, 2)})$. So $b = ${mn(fit.PL, 2)}\\cdot\\frac{${T} - ${t1}}{${t2} - ${t1}} = ${mn(fit.b, 2)}$ and $a = ${mn(fit.a, 2)}$.

**Step 3 — Payment amounts.** $A = ${mn(fit.a, 2)}(${dec(1 + i, 3)})^{${t1}} = ${mn(fit.faceA, 2)}$ and $B = ${mn(fit.b, 2)}(${dec(1 + i, 3)})^{${t2}} = ${mn(fit.faceB, 2)}$${ask === "DIFF" ? `, so ${diffText.slice(0, -1)} = ${mn(key, 2)}$` : ""}.`,
          checks: [{ label: "positive amounts", ok: fit.a > 0 && fit.b > 0 }],
        };
      }
      if (variant === "UNKNOWN_TIME") {
        const T = rng.int(4, 15);
        const t1 = rng.int(1, T - 2);
        const t2True = T + rng.int(1, 6);
        const L = gridAmount(rng, 10000, 2000000, 1000);
        const i = gridRate(rng, 0.03, 0.08, 0.005);
        const fitTrue = matchTwo([[T, L]], t1, t2True, (t) => v(i, t));
        const A = Math.round(fitTrue.faceA);
        const a = A * v(i, t1);
        const PL = L * v(i, T);
        const b = PL - a;
        const t2 = (T * PL - t1 * a) / b;
        const B = b * Math.pow(1 + i, t2);
        const ask = rng.choice(["TIME", "AMOUNT", "RATIO"] as const);
        const key = ask === "TIME" ? t2 : ask === "AMOUNT" ? B : B / (t2 - T);
        const later = ask === "RATIO" ? `$${T} + b$ years, where $b > 0$` : `$n$ years, where $n > ${T}$`;
        return {
          questionText: `${person} has a liability of ${n(L)} due in ${word(T)} years. This liability will be met with a payment of ${n(A)} in ${word(t1)} year${t1 === 1 ? "" : "s"} and a payment of $B$ in ${later}. ${person} is employing a full immunization strategy using an annual effective interest rate of ${pc(i)}.
Calculate ${ask === "TIME" ? "$n$" : ask === "AMOUNT" ? "$B$" : "$B/b$"}.`,
          variables: { variant, T, t1, L, i, A, ask },
          correctValue: key,
          format: ask === "TIME" ? "AMOUNT_2" : "AMOUNT_0",
          distractors:
            ask === "TIME"
              ? [
                  distractor((T * L - t1 * A) / (L - A), "CALCULATION_DISTRACTOR", "Matched undiscounted amounts."),
                  distractor(2 * T - t1, "CALCULATION_DISTRACTOR", "Placed the second payment symmetrically about the liability."),
                  distractor((T * PL - t1 * A) / b, "CALCULATION_DISTRACTOR", "Used the undiscounted first payment in the duration equation."),
                ]
              : [
                  distractor(ask === "AMOUNT" ? b : b / (t2 - T), "CALCULATION_DISTRACTOR", "Gave the present value of the second payment."),
                  distractor(ask === "AMOUNT" ? L - A : (L - A) / (t2 - T), "CALCULATION_DISTRACTOR", "Subtracted the first payment from the liability without discounting."),
                  distractor(ask === "AMOUNT" ? b * Math.pow(1 + i, 2 * T - t1) : (b * Math.pow(1 + i, 2 * T - t1)) / (T - t1), "CALCULATION_DISTRACTOR", "Placed the second payment symmetrically about the liability."),
                  ...(ask === "RATIO" ? [distractor(B / t2, "CALCULATION_DISTRACTOR", "Divided by the payment time instead of the time beyond the liability.")] : []),
                ],
          solutionSteps: `**Step 1 — Present values.** Liability: $${mn(L)}v^{${T}} = ${mn(PL, 2)}$. First payment: $${mn(A)}v^{${t1}} = ${mn(a, 2)}$. So the second payment's present value is $b = ${mn(b, 2)}$.

**Step 2 — Duration.** $${t1}(${mn(a, 2)}) + n(${mn(b, 2)}) = ${T}(${mn(PL, 2)})$, so the second payment is at time $${dec(t2, 4)}$${ask === "RATIO" ? `, that is, $b = ${dec(t2 - T, 4)}$` : ""}.

**Step 3 — Amount.** $B = ${mn(b, 2)}(${dec(1 + i, 3)})^{${dec(t2, 4)}} = ${mn(B, 2)}$${ask === "RATIO" ? `, so $B/b = ${mn(key, 2)}$` : ""}.`,
          checks: [{ label: "time beyond liability", ok: t2 > T && Math.abs(t2 - t2True) < 0.05 }],
        };
      }
      if (variant === "LIABILITY") {
        const T = rng.int(2, 6);
        const t1 = rng.int(1, T - 1);
        const t2 = T + rng.int(1, 3);
        const iTrue = gridRate(rng, 0.03, 0.1, 0.005);
        const x = gridAmount(rng, 10000, 100000, 1000);
        // Duration condition: (T - t1) x v^t1 = (t2 - T) y v^t2
        const y = Math.round(((T - t1) * x * v(iTrue, t1)) / ((t2 - T) * v(iTrue, t2)) / 100) * 100;
        const vGap = ((T - t1) * x) / ((t2 - T) * y);
        const i = Math.pow(vGap, -1 / (t2 - t1)) - 1;
        const key = (x * v(i, t1) + y * v(i, t2)) * Math.pow(1 + i, T);
        return {
          questionText: `An insurance company has a single liability due in ${word(T)} years. The company fully immunizes its position by purchasing ${word(t1)}-year and ${word(t2)}-year zero-coupon bonds. The face value of the ${word(t1)}-year bond is ${n(x)} and the face value of the ${word(t2)}-year bond is ${n(y)}.
Assume that the yield curve is flat.
Calculate the amount of the liability.`,
          variables: { variant, T, t1, t2, x, y },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(x + y, "CALCULATION_DISTRACTOR", "Added the face values."),
            distractor((x * v(1 / vGap - 1, t1) + y * v(1 / vGap - 1, t2)) * Math.pow(1 / vGap, T), "CALCULATION_DISTRACTOR", `Took $v^{${t2 - t1}}$ as $v$ when recovering the rate.`),
            distractor((x * v(i, t1) + y * v(i, t2)), "CALCULATION_DISTRACTOR", "Gave the present value of the liability."),
          ],
          solutionSteps: `**Step 1 — Duration condition gives the rate.** With present values $a = ${mn(x)}v^{${t1}}$ and $b = ${mn(y)}v^{${t2}}$, matching duration ${T} requires $(${T} - ${t1})a = (${t2} - ${T})b$, so $v^{${t2 - t1}} = \\frac{${T - t1}(${mn(x)})}{${t2 - T}(${mn(y)})} = ${dec(vGap, 6)}$ and $i = ${dec(i, 6)}$.

**Step 2 — Present value of the assets.** $${mn(x)}v^{${t1}} + ${mn(y)}v^{${t2}} = ${mn(key * v(i, T), 2)}$.

**Step 3 — Liability.** It has the same present value: $${mn(key * v(i, T), 2)}(1 + i)^{${T}} = ${mn(key, 2)}$.`,
          checks: [{ label: "rate recovered", ok: Math.abs(i - iTrue) < 0.01 && i > 0.005 }],
        };
      }
      const vFactor = rng.choice([0.9, 0.92, 0.94, 0.95, 0.96, 0.97]);
      const T = rng.int(3, 6);
      const t1 = rng.int(1, T - 1);
      const t2 = T + rng.int(1, 2);
      const L = gridAmount(rng, 200000, 1000000, 50000);
      const Y = gridAmount(rng, 0.1 * L, 0.5 * L, 10000);
      const rest = L - Y;
      // Values at time T: X v^(t1-T) + Z v^(t2-T) = rest and duration about T.
      const df = (t: number) => Math.pow(vFactor, t);
      const fit = matchTwo([[T, rest]], t1, t2, df);
      const key = fit.faceA;
      return {
        questionText: `An insurance company has a liability of ${n(L)} due ${word(T)} years from now. To protect against interest rate risk, it decides to employ the technique of full immunization. Specifically, it decides to hold three assets, each providing a single cash flow as follows:
(i) Asset X provides a cash flow of $A_X$, exactly ${word(t1)} year${t1 === 1 ? "" : "s"} from now.
(ii) Asset Y provides a cash flow of ${n(Y)}, exactly ${word(T)} years from now.
(iii) Asset Z provides a cash flow of $A_Z$, exactly ${word(t2)} years from now.
The annual discount factor is $v = ${vFactor}$.
Calculate $A_X$.`,
        variables: { variant, T, t1, t2, L, Y, v: vFactor },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(matchTwo([[T, L]], t1, t2, df).faceA, "CALCULATION_DISTRACTOR", "Ignored Asset Y."),
          distractor(fit.a, "CALCULATION_DISTRACTOR", "Gave the present value of $A_X$."),
          distractor(fit.faceB, "CALCULATION_DISTRACTOR", "Gave $A_Z$."),
          distractor(rest * (t2 - T) / (t2 - t1), "CALCULATION_DISTRACTOR", "Split the remaining liability by distance without discounting."),
        ],
        solutionSteps: `**Step 1 — Net the matching asset.** Asset Y pays at the liability date, so it reduces the liability to $${mn(L)} - ${mn(Y)} = ${mn(rest)}$ due at time ${T}.

**Step 2 — Match present value and duration.** With $a$, $b$ the present values of $A_X$ and $A_Z$: $a + b = ${mn(rest)}v^{${T}} = ${mn(fit.PL, 2)}$ and $${t1}a + ${t2}b = ${T}(${mn(fit.PL, 2)})$, so $a = ${mn(fit.a, 2)}$.

**Step 3 — Amount.** $A_X = a/v^{${t1}} = ${mn(fit.a, 2)}/${dec(df(t1), 6)} = ${mn(key, 2)}$.`,
        checks: [{ label: "positive", ok: fit.a > 0 && fit.b > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_FULL_IMMUNIZATION_SURPLUS",
    domain: ALM,
    title: "Surplus of a Fully Immunized Position after a Rate Change",
    objective: "Build a fully immunized position, then value the surplus after a change in the interest rate.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 3,
    soaSamples: [306],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const T = rng.int(5, 15);
      const t1 = rng.int(1, T - 2);
      const t2 = T + rng.int(1, 5);
      const L = gridAmount(rng, 500000, 3000000, 50000);
      const i0 = gridRate(rng, 0.04, 0.09, 0.005);
      const i1 = drawUntil(() => gridRate(rng, 0.02, 0.11, 0.005), (x) => Math.abs(x - i0) >= 0.01, i0 - 0.02);
      const fit = matchTwo([[T, L]], t1, t2, (t) => v(i0, t));
      const A = Math.round(fit.faceA);
      const B = (L * v(i0, T) - A * v(i0, t1)) * Math.pow(1 + i0, t2);
      const surplus = A * v(i1, t1) + B * v(i1, t2) - L * v(i1, T);
      return {
        questionText: `You are given the following information regarding a company:
(i) It has a single liability of ${n(L)} to be paid ${word(T)} years from now.
(ii) Its asset portfolio consists of a zero-coupon bond maturing in ${word(t1)} year${t1 === 1 ? "" : "s"} for ${n(A)} and a zero-coupon bond maturing in ${word(t2)} years for $X$.
(iii) At an annual effective interest rate of ${pc(i0)}, the company's position is fully immunized.
Calculate the present value of the assets less the present value of the liabilities if the annual effective interest rate immediately changes to ${pc(i1)}.`,
        variables: { T, t1, t2, L, i0, i1, A },
        correctValue: surplus,
        format: amountFormat(surplus),
        distractors: [
          distractor(A * v(i1, t1) + B * v(i1, t2) - L * v(i0, T), "CALCULATION_DISTRACTOR", "Kept the liability at the old rate."),
          distractor(surplus * Math.pow(1 + i1, T), "CALCULATION_DISTRACTOR", `Gave the surplus at time ${T} instead of today.`),
          distractor(Math.abs(A * v(i1, t1) + (L - A) * v(i1, t2) - L * v(i1, T)), "CALCULATION_DISTRACTOR", "Took the second bond's face as the liability less the first bond's face."),
          distractor(surplus * 2, "CALCULATION_DISTRACTOR", "Double-counted the change in both assets."),
        ],
        solutionSteps: `**Step 1 — Second bond.** At ${pc(i0)} the liability's present value is ${n(L * v(i0, T), 2)} and the first bond's is ${n(A * v(i0, t1), 2)}, so the second bond is worth ${n(L * v(i0, T) - A * v(i0, t1), 2)} and matures for $X = ${mn(B, 2)}$.

**Step 2 — Values at ${pc(i1)}.** Assets: $${mn(A)}v^{${t1}} + ${mn(B, 2)}v^{${t2}} = ${mn(A * v(i1, t1) + B * v(i1, t2), 2)}$. Liability: $${mn(L)}v^{${T}} = ${mn(L * v(i1, T), 2)}$.

**Step 3 — Surplus.** ${n(surplus, 2)}, positive as full immunization guarantees.`,
        checks: [{ label: "surplus positive", ok: surplus > 0 }],
      };
    },
  },

  {
    id: "FM_ALM_REDINGTON_TWO_ASSETS",
    domain: ALM,
    title: "Redington Immunization with Two Assets",
    objective: "Choose two asset cash flows that match the present value and duration of the liabilities.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 3,
    soaSamples: [44, 58, 184, 188, 249, 270, 299, 425, 426],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["ANNUITY", "SINGLE_PV", "SINGLE_RATIO", "HALF_YEAR", "TWO_LIABS", "FORCE", "TOTAL_GIVEN"] as const);
      if (variant === "ANNUITY") {
        const R = gridAmount(rng, 5000, 50000, 1000);
        const { years, i, s1, s2 } = drawUntil(
          () => {
            const s1 = rng.int(2, 6);
            return { years: rng.int(5, 20), i: gridRate(rng, 0.03, 0.08, 0.001), s1, s2: s1 + rng.int(3, 10) };
          },
          (p) => {
            const f = matchTwo(Array.from({ length: p.years }, (_, k) => [k + 1, 1] as const), p.s1, p.s2, (t) => v(p.i, t));
            return f.a > 0.05 * f.PL && f.b > 0.05 * f.PL;
          },
          { years: 15, i: 0.062, s1: 5, s2: 10 }
        );
        const liabilities = Array.from({ length: years }, (_, k) => [k + 1, R] as const);
        const fit = matchTwo(liabilities, s1, s2, (t) => v(i, t));
        return {
          questionText: `A liability consists of a series of ${years} annual payments of ${n(R)} with the first payment to be made one year from now.
The assets available to immunize this liability are ${word(s1)}-year and ${word(s2)}-year zero-coupon bonds.
The annual effective interest rate used to value the assets and the liability is ${pc(i)}. The liability has the same present value and duration as the asset portfolio.
Calculate the amount invested in the ${word(s1)}-year zero-coupon bonds.`,
          variables: { variant, years, R, i, s1, s2 },
          correctValue: fit.a,
          format: "AMOUNT_0",
          distractors: [
            distractor(fit.b, "CALCULATION_DISTRACTOR", `Gave the amount invested in the ${s2}-year bonds.`),
            distractor(fit.faceA, "CALCULATION_DISTRACTOR", "Gave the maturity value instead of the amount invested."),
            distractor((fit.PL * (s2 - (years + 1) / 2)) / (s2 - s1), "CALCULATION_DISTRACTOR", "Used the average payment time as the liability's duration."),
            distractor(fit.PL / 2, "CALCULATION_DISTRACTOR", "Split the present value equally."),
          ],
          solutionSteps: `**Step 1 — Liability.** $PV = ${mn(R)}\\,a_{\\overline{${years}}|${mpc(i)}} = ${mn(fit.PL, 2)}$ and its Macaulay duration is $\\sum t v^t / a_{\\overline{${years}}|} = ${dec(fit.DL, 4)}$.

**Step 2 — Match.** With amounts $a$ and $b$ in the ${s1}- and ${s2}-year bonds: $a + b = ${mn(fit.PL, 2)}$ and $${s1}a + ${s2}b = ${dec(fit.DL, 4)}(${mn(fit.PL, 2)})$.

**Step 3 — Solve.** $a = ${mn(fit.PL, 2)}\\cdot\\frac{${s2} - ${dec(fit.DL, 4)}}{${s2} - ${s1}} = ${mn(fit.a, 2)}$.`,
          checks: [{ label: "positive", ok: fit.a > 0 && fit.b > 0 }],
        };
      }
      if (variant === "SINGLE_PV" || variant === "SINGLE_RATIO") {
        const T = rng.int(3, 8);
        const s1 = rng.int(1, T - 1);
        const s2 = T + rng.int(1, 4);
        const i = variant === "SINGLE_PV" ? rng.choice([0.05, 0.1, 0.2]) : gridRate(rng, 0.03, 0.08, 0.005);
        const PV = gridAmount(rng, 1000, 50000, 1000);
        const L = variant === "SINGLE_PV" ? Number((PV * Math.pow(1 + i, T)).toFixed(2)) : gridAmount(rng, 10000, 200000, 5000);
        const fit = matchTwo([[T, L]], s1, s2, (t) => v(i, t));
        if (variant === "SINGLE_PV") {
          return {
            questionText: `An insurance company has a liability of ${amt(L)} that is due at the end of ${word(T)} years. The present value of this liability is ${n(PV)}. There are two investments available: a ${word(s1)}-year zero-coupon bond and a ${word(s2)}-year zero-coupon bond.
The company wants to find an investment plan that satisfies Redington immunization.
Calculate the amount the company invests in the ${word(s1)}-year zero-coupon bond.`,
            variables: { variant, T, s1, s2, L, PV },
            correctValue: fit.a,
            format: "AMOUNT_0",
            distractors: [
              distractor(fit.b, "CALCULATION_DISTRACTOR", `Gave the amount in the ${s2}-year bond.`),
              distractor(fit.faceA, "CALCULATION_DISTRACTOR", "Gave the maturity value."),
              distractor(PV / 2, "CALCULATION_DISTRACTOR", "Split the present value equally."),
              distractor((PV * (T - s1)) / (s2 - s1), "CALCULATION_DISTRACTOR", "Reversed the weights."),
            ],
            solutionSteps: `**Step 1 — Rate.** $(1 + i)^{${T}} = ${amt(L)}/${mn(PV)}$, so $i = ${dec(i, 4)}$ (not needed below: the weights depend only on the times).

**Step 2 — Match.** $a + b = ${mn(PV)}$ and $${s1}a + ${s2}b = ${T}(${mn(PV)})$.

**Step 3 — Solve.** $a = ${mn(PV)}\\cdot\\frac{${s2} - ${T}}{${s2} - ${s1}} = ${mn(fit.a, 2)}$.`,
            checks: [{ label: "PV reproduced", ok: close(fit.PL, PV, 1e-6) }],
          };
        }
        const key = fit.faceA / fit.faceB;
        return {
          questionText: `An investor has assets at time ${s1} of $A$ and at time ${s2} of $B$. The investor has a liability of ${n(L)} at time ${T}, and has achieved Redington immunization using an annual effective interest rate of ${pc(i)}.
Calculate $A/B$.`,
          variables: { variant, T, s1, s2, L, i },
          correctValue: key,
          format: "AMOUNT_4",
          distractors: [
            distractor(fit.a / fit.b, "CALCULATION_DISTRACTOR", "Gave the ratio of present values."),
            distractor(fit.faceB / fit.faceA, "CALCULATION_DISTRACTOR", "Inverted the ratio."),
            distractor((s2 - T) / (T - s1), "CALCULATION_DISTRACTOR", "Ignored discounting."),
            distractor((fit.a / fit.b) * Math.pow(1 + i, s2 - s1), "CALCULATION_DISTRACTOR", "Accumulated in the wrong direction."),
          ],
          solutionSteps: `**Step 1 — Present value weights.** Matching present value and duration, the present values satisfy $a/b = (${s2} - ${T})/(${T} - ${s1}) = ${dec(fit.a / fit.b, 5)}$.

**Step 2 — Convert to amounts.** $A = a(1+i)^{${s1}}$ and $B = b(1+i)^{${s2}}$, so $A/B = \\frac{a}{b}v^{${s2 - s1}} = ${dec(fit.a / fit.b, 5)}(${dec(v(i, s2 - s1), 6)})$.

**Step 3 — Result.** $A/B = ${dec(key, 5)}$.`,
          checks: [{ label: "positive", ok: key > 0 }],
        };
      }
      if (variant === "HALF_YEAR") {
        const L = gridAmount(rng, 5000, 50000, 1000);
        const i = gridRate(rng, 0.02, 0.08, 0.005);
        const T = 0.75;
        const fit = matchTwo([[T, L]], 0.5, 1, (t) => v(i, t));
        return {
          questionText: `A company has a liability of ${n(L)} due in nine months. To pay this liability, it has an asset portfolio generating cash flows of $X$ in six months and $Y$ in one year. The portfolio is Redington immunized.
The annual effective interest rate is ${pc(i)}.
Calculate $X$.`,
          variables: { variant, L, i },
          correctValue: fit.faceA,
          format: "AMOUNT_0",
          distractors: [
            distractor(fit.faceB, "CALCULATION_DISTRACTOR", "Gave $Y$."),
            distractor(L / 2, "CALCULATION_DISTRACTOR", "Split the liability equally without discounting."),
            distractor(fit.a, "CALCULATION_DISTRACTOR", "Gave the present value of $X$."),
            distractor((L / 2) * v(i, 0.25), "CALCULATION_DISTRACTOR", "Discounted half the liability for three months."),
          ],
          solutionSteps: `**Step 1 — Equal weights.** Nine months is midway between six months and one year, so the present values of $X$ and $Y$ are equal: each is half the liability's present value, $\\frac{1}{2}(${mn(L)})v^{0.75}$.

**Step 2 — $X$.** $X = \\frac{1}{2}(${mn(L)})v^{0.75}(1 + i)^{0.5} = \\frac{1}{2}(${mn(L)})v^{0.25}$.

**Step 3 — Compute.** $X = ${mn(fit.faceA, 2)}$.`,
          checks: [{ label: "equal present values", ok: close(fit.a, fit.b, 1e-9) }],
        };
      }
      if (variant === "TWO_LIABS") {
        const { L1, L2, t1, t2, s1, s2, i } = drawUntil(
          () => {
            const t1 = rng.int(1, 3);
            const t2 = t1 + rng.int(1, 3);
            return {
              L1: gridAmount(rng, 200, 2000, 50),
              L2: gridAmount(rng, 200, 2000, 50),
              t1,
              t2,
              s1: rng.int(0, t1 - 1),
              s2: rng.int(t1 + 1, t2 + 2),
              i: gridRate(rng, 0.03, 0.08, 0.005),
            };
          },
          (p) => {
            if (p.s2 === p.t2) return false;
            const f = matchTwo([[p.t1, p.L1], [p.t2, p.L2]], p.s1, p.s2, (t) => v(p.i, t));
            return f.a > 0.05 * f.PL && f.b > 0.05 * f.PL;
          },
          { L1: 1000, L2: 300, t1: 2, t2: 4, s1: 1, s2: 3, i: 0.05 }
        );
        const fit = matchTwo([[t1, L1], [t2, L2]], s1, s2, (t) => v(i, t));
        const ask = rng.choice(["RATIO", "Y", "X"] as const);
        const key = ask === "RATIO" ? fit.faceB / fit.faceA : ask === "Y" ? fit.faceB : fit.faceA;
        const when = (t: number) => (t === 0 ? "immediately" : `at the end of year ${word(t)}`);
        return {
          questionText: `A company has liabilities of ${n(L1)} and ${n(L2)} due at the end of years ${word(t1)} and ${word(t2)}, respectively. The company creates an investment portfolio that produces asset cash flows of $X$ ${when(s1)} and $Y$ ${when(s2)}. The portfolio is constructed to match the present value and duration of the company's payment obligations, using an annual effective interest rate of ${pc(i)}.
Calculate ${ask === "RATIO" ? "$Y/X$" : ask === "Y" ? "$Y$" : "$X$"}.`,
          variables: { variant, L1, L2, t1, t2, s1, s2, i, ask },
          correctValue: key,
          format: ask === "RATIO" ? "AMOUNT_3" : "AMOUNT_0",
          distractors:
            ask === "RATIO"
              ? [
                  distractor(fit.b / fit.a, "CALCULATION_DISTRACTOR", "Gave the ratio of present values."),
                  distractor(fit.faceA / fit.faceB, "CALCULATION_DISTRACTOR", "Inverted the ratio."),
                  distractor(matchTwo([[t1, L1], [t2, L2]], s1, s2, () => 1).faceB / matchTwo([[t1, L1], [t2, L2]], s1, s2, () => 1).faceA, "CALCULATION_DISTRACTOR", "Ignored discounting."),
                ]
              : [
                  distractor(ask === "Y" ? fit.b : fit.a, "CALCULATION_DISTRACTOR", "Gave the present value instead of the cash flow."),
                  distractor(ask === "Y" ? fit.faceA : fit.faceB, "CALCULATION_DISTRACTOR", `Gave $${ask === "Y" ? "X" : "Y"}$.`),
                  distractor(ask === "Y" ? matchTwo([[t1, L1], [t2, L2]], s1, s2, () => 1).faceB : matchTwo([[t1, L1], [t2, L2]], s1, s2, () => 1).faceA, "CALCULATION_DISTRACTOR", "Ignored discounting."),
                ],
          solutionSteps: `**Step 1 — Liabilities.** $PV = ${mn(L1)}v^{${t1}} + ${mn(L2)}v^{${t2}} = ${mn(fit.PL, 2)}$, and $\\sum t\\,PV_t = ${mn(fit.PL * fit.DL, 2)}$, so the duration is ${dec(fit.DL, 4)}.

**Step 2 — Match.** With present values $a$ (time ${s1}) and $b$ (time ${s2}): $a + b = ${mn(fit.PL, 2)}$, $${s1}a + ${s2}b = ${mn(fit.PL * fit.DL, 2)}$, so $a = ${mn(fit.a, 2)}$ and $b = ${mn(fit.b, 2)}$.

**Step 3 — Cash flows.** $X = a(1+i)^{${s1}} = ${mn(fit.faceA, 2)}$ and $Y = b(1+i)^{${s2}} = ${mn(fit.faceB, 2)}$${ask === "RATIO" ? `, so $Y/X = ${dec(key, 4)}$` : ""}.`,
          checks: [{ label: "positive", ok: fit.a > 0 && fit.b > 0 }],
        };
      }
      if (variant === "FORCE") {
        const t1 = rng.int(5, 12);
        const t2 = t1 + rng.int(3, 8);
        const s1 = rng.int(2, t1 - 1);
        const s2 = t2 + rng.int(2, 8);
        const L = gridAmount(rng, 100000, 1000000, 50000);
        const delta = gridRate(rng, 0.03, 0.08, 0.005);
        const fit = matchTwo([[t1, L], [t2, L]], s1, s2, (t) => Math.exp(-delta * t));
        const askFirst = rng.next() < 0.5;
        const key = askFirst ? fit.a : fit.b;
        return {
          questionText: `A company is required to pay ${n(L)} ${word(t1)} years from now and ${n(L)} ${word(t2)} years from now. The company needs to create an investment portfolio using ${word(s1)}-year and ${word(s2)}-year zero-coupon bonds, so that, using a ${pc(delta)} annual force of interest, the present value and Macaulay duration of its assets match those of its liabilities.
Calculate the amount invested today in the ${word(askFirst ? s1 : s2)}-year bond.`,
          variables: { variant, t1, t2, s1, s2, L, delta, askFirst: askFirst ? 1 : 0 },
          correctValue: key,
          format: "AMOUNT_0",
          distractors: [
            distractor(askFirst ? fit.b : fit.a, "CALCULATION_DISTRACTOR", "Gave the amount in the other bond."),
            distractor(matchTwo([[t1, L], [t2, L]], s1, s2, (t) => v(delta, t))[askFirst ? "a" : "b"], "NOMINAL_RATE_ERROR", "Treated the force of interest as an annual effective rate."),
            distractor(askFirst ? fit.faceA : fit.faceB, "CALCULATION_DISTRACTOR", "Gave the maturity value."),
            distractor(fit.PL / 2, "CALCULATION_DISTRACTOR", "Split the present value equally."),
          ],
          solutionSteps: `**Step 1 — Liabilities.** $PV = ${mn(L)}(e^{-${delta}(${t1})} + e^{-${delta}(${t2})}) = ${mn(fit.PL, 2)}$ and the time-weighted value is $${mn(fit.PL * fit.DL, 2)}$.

**Step 2 — Match.** $x + y = ${mn(fit.PL, 2)}$ and $${s1}x + ${s2}y = ${mn(fit.PL * fit.DL, 2)}$.

**Step 3 — Solve.** $x = ${mn(fit.a, 2)}$ in the ${s1}-year bond and $y = ${mn(fit.b, 2)}$ in the ${s2}-year bond.`,
          checks: [{ label: "positive", ok: fit.a > 0 && fit.b > 0 }],
        };
      }
      const i = gridRate(rng, 0.04, 0.12, 0.01);
      const total = rng.choice([1000, 5000, 10000]);
      const years = 3;
      const R = cents(total / an(years, i));
      const fit = matchTwo(Array.from({ length: years }, (_, k) => [k + 1, R] as const), 1, 3, (t) => v(i, t));
      const share = (3 - fit.DL) / 2;
      const key = total * share;
      return {
        questionText: `A company has liabilities of ${n(R, 2)} due at the end of each of the next ${word(years)} years.
The company will match the duration of its liabilities by investing a total of ${n(total)} in one-year and three-year zero-coupon bonds. The annual effective yield of both bonds is ${pc(i)}.
Calculate the amount the company will invest in one-year bonds.`,
        variables: { variant: "TOTAL_GIVEN", R, total, i },
        correctValue: key,
        format: "AMOUNT_0",
        distractors: [
          distractor(total - key, "CALCULATION_DISTRACTOR", "Gave the amount in three-year bonds."),
          distractor(total / 2, "CALCULATION_DISTRACTOR", "Split the total equally."),
          distractor(total / 3, "CALCULATION_DISTRACTOR", "Invested a third, one share per liability."),
          distractor(R / (1 + i), "CALCULATION_DISTRACTOR", "Matched only the first liability."),
        ],
        solutionSteps: `**Step 1 — Liability duration.** $\\frac{v + 2v^2 + 3v^3}{v + v^2 + v^3} = ${dec(fit.DL, 4)}$ at ${pc(i)}; the payment size cancels.

**Step 2 — Weights.** With share $w$ in one-year bonds: $w(1) + (1 - w)(3) = ${dec(fit.DL, 4)}$, so $w = ${dec(share, 5)}$.

**Step 3 — Amount.** $${mn(total)}(${dec(share, 5)}) = ${mn(key, 2)}$.`,
        checks: [{ label: "share between 0 and 1", ok: share > 0 && share < 1 }],
      };
    },
  },

  {
    id: "FM_ALM_REDINGTON_DURATIONS",
    domain: ALM,
    title: "Redington Immunization from Durations",
    objective: "Use the fact that a portfolio's duration is the value-weighted average of its holdings' durations to complete a Redington-immunized position.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 3,
    soaSamples: [149, 205, 338],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["MOD_DURATION", "THREE_BONDS", "LIABILITY_TIME"] as const);
      if (variant === "MOD_DURATION") {
        const i = rng.choice([0.05, 0.1, 0.2]);
        // Keep (1 + i)^T to a few decimals so the liability prints exactly.
        const T = i === 0.05 ? 2 : rng.int(2, 3);
        const A1 = gridAmount(rng, 5000, 30000, 1000);
        const A2 = gridAmount(rng, 10000, 60000, 1000);
        const L = Number(((A1 + A2) * Math.pow(1 + i, T)).toFixed(2));
        const D1 = drawUntil(() => gridAmount(rng, 50, 250, 1) / 100, (d) => d < T / (1 + i) - 0.1, 1.2);
        const key = (T / (1 + i) - (A1 / (A1 + A2)) * D1) / (A2 / (A1 + A2));
        return {
          questionText: `A company is required to pay ${amt(L)}, which is due ${word(T)} years from now. The company invests ${n(A1)} in a bond with modified duration ${n(D1, 2)}, and ${n(A2)} in a bond with modified duration $D_{mod}$, to Redington immunize its position against small changes in the yield rate.
The annual effective yield rate for each of the bonds is ${pc(i)}.
Calculate $D_{mod}$.`,
          variables: { variant, i, T, A1, A2, L, D1 },
          correctValue: key,
          format: "AMOUNT_2",
          distractors: [
            distractor((T - (A1 / (A1 + A2)) * D1) / (A2 / (A1 + A2)), "CALCULATION_DISTRACTOR", "Used the liability's Macaulay duration."),
            distractor(T / (1 + i), "CALCULATION_DISTRACTOR", "Gave the liability's modified duration."),
            distractor(2 * (T / (1 + i)) - D1, "CALCULATION_DISTRACTOR", "Averaged the two bonds' durations with equal weights."),
            distractor((T / (1 + i) - (A2 / (A1 + A2)) * D1) / (A1 / (A1 + A2)), "CALCULATION_DISTRACTOR", "Swapped the weights."),
          ],
          solutionSteps: `**Step 1 — Present values match.** $${mn(A1)} + ${mn(A2)} = ${mn(A1 + A2)} = ${amt(L)}v^{${T}}$, and the liability's modified duration is $${T}/${dec(1 + i, 2)} = ${dec(T / (1 + i), 5)}$.

**Step 2 — Weighted average.** $\\frac{${mn(A1)}}{${mn(A1 + A2)}}(${n(D1, 2)}) + \\frac{${mn(A2)}}{${mn(A1 + A2)}}D_{mod} = ${dec(T / (1 + i), 5)}$.

**Step 3 — Solve.** $D_{mod} = ${dec(key, 4)}$.`,
          checks: [{ label: "PV matches", ok: close(L * v(i, T), A1 + A2, 1e-9) }],
        };
      }
      if (variant === "THREE_BONDS") {
        const { L, T, i, DA, DB, DC, k } = drawUntil(
          () => {
            const DA = rng.int(5, 12);
            const DB = DA + rng.int(3, 8);
            return {
              L: gridAmount(rng, 50000, 500000, 10000),
              T: gridAmount(rng, 30, 50, 1) / 2,
              i: gridRate(rng, 0.04, 0.08, 0.005),
              DA,
              DB,
              DC: rng.int(DB + 5, 40),
              k: rng.choice([1.5, 2, 3]),
            };
          },
          (p) => {
            const PL = p.L * v(p.i, p.T);
            const y = (p.T * PL - p.DA * PL) / (p.DB - p.DA + p.k * (p.DC - p.DA));
            return y > 0 && PL - (1 + p.k) * y > 0.05 * PL;
          },
          { L: 190000, T: 20.5, i: 0.07, DA: 10, DB: 15, DC: 30, k: 2 }
        );
        const PL = L * v(i, T);
        // x + y + k y = PL ; DA x + DB y + DC k y = T PL
        const y = (T * PL - DA * PL) / (DB - DA + k * (DC - DA));
        const x = PL - (1 + k) * y;
        return {
          questionText: `A company is required to pay ${n(L)} in ${n(T, Number.isInteger(T) ? 0 : 1)} years. The company creates an investment portfolio using three bonds with annual coupons, so that its position is Redington immunized based on an annual effective interest rate of ${pc(i)}. The table below shows the Macaulay duration for each of the bonds.
${table(["Bond", "Macaulay duration"], [["A", `${DA}\\text{ years}`], ["B", `${DB}\\text{ years}`], ["C", `${DC}\\text{ years}`]])}
The company invests ${k === 2 ? "twice" : k === 3 ? "three times" : `${k} times`} as much money in Bond C as in Bond B.
Calculate the amount the company invests in Bond A.`,
          variables: { variant, L, T, i, DA, DB, DC, k },
          correctValue: x,
          format: "AMOUNT_0",
          distractors: [
            distractor(y, "CALCULATION_DISTRACTOR", "Gave the amount in Bond B."),
            distractor(k * y, "CALCULATION_DISTRACTOR", "Gave the amount in Bond C."),
            distractor(PL / 3, "CALCULATION_DISTRACTOR", "Split the present value equally."),
            distractor(L - (1 + k) * ((T * L - DA * L) / (DB - DA + k * (DC - DA))), "CALCULATION_DISTRACTOR", "Did not discount the liability."),
          ],
          solutionSteps: `**Step 1 — Liability.** $PV = ${mn(L)}v^{${n(T, 1)}} = ${mn(PL, 2)}$ with duration ${n(T, 1)}.

**Step 2 — Two equations.** With $x$ in A, $y$ in B and ${k}$y$ in C: $x + ${dec(1 + k, 1)}y = ${mn(PL, 2)}$ and $${DA}x + ${DB}y + ${DC * k}y = ${n(T, 1)}(${mn(PL, 2)})$.

**Step 3 — Solve.** $y = ${mn(y, 2)}$ and $x = ${mn(x, 2)}$.`,
          checks: [{ label: "positive holdings", ok: x > 0 && y > 0 }],
        };
      }
      const A1 = gridAmount(rng, 10000, 50000, 1000);
      const A2 = gridAmount(rng, 10000, 50000, 1000);
      const T1 = rng.int(10, 30);
      const T2 = T1 + rng.int(3, 10);
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const key = (A1 * T1 + A2 * T2) / (A1 + A2);
      return {
        questionText: `A company is required to pay $${mn(A1 + A2)}(${dec(1 + i, 3)})^y$ in $y$ years. The company invests ${n(A1)} in a ${T1}-year zero-coupon bond and ${n(A2)} in a ${T2}-year zero-coupon bond to Redington immunize its position against small changes in interest rates, based on an annual effective interest rate of ${pc(i)}.
Calculate $y$.`,
        variables: { variant: "LIABILITY_TIME", A1, A2, T1, T2, i },
        correctValue: key,
        format: "AMOUNT_2",
        distractors: [
          distractor((T1 + T2) / 2, "CALCULATION_DISTRACTOR", "Averaged the terms without weights."),
          distractor((A1 * T2 + A2 * T1) / (A1 + A2), "CALCULATION_DISTRACTOR", "Swapped the weights."),
          distractor(key / (1 + i), "CALCULATION_DISTRACTOR", "Gave a modified duration."),
          distractor((A1 * T1 * v(i, T1) + A2 * T2 * v(i, T2)) / (A1 * v(i, T1) + A2 * v(i, T2)), "CALCULATION_DISTRACTOR", "Discounted amounts that are already present values."),
        ],
        solutionSteps: `**Step 1 — Present values.** The liability's present value is $${mn(A1 + A2)}$, equal to the assets'; its duration is $y$.

**Step 2 — Asset duration.** Each zero-coupon bond's duration is its term, so the assets' duration is $\\frac{${mn(A1)}(${T1}) + ${mn(A2)}(${T2})}{${mn(A1 + A2)}}$.

**Step 3 — Match.** $y = ${dec(key, 4)}$.`,
        checks: [{ label: "between terms", ok: key > T1 && key < T2 }],
      };
    },
  },

  {
    id: "FM_ALM_IMMUNIZATION_CHECK",
    domain: ALM,
    title: "Which Positions Are Immunized",
    objective: "Test sets of asset cash flows or portfolio summaries against the conditions for full or Redington immunization.",
    difficulty: 3,
    topics: ["IMMUNIZATION"],
    steps: 3,
    qualitative: true,
    soaSamples: [382, 295, 197, 106],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pattern = romanPattern(rng);
      const roman = ["I", "II", "III"];
      if (rng.next() < 0.5) {
        const L = gridAmount(rng, 1000, 10000, 500);
        const T = rng.int(2, 4);
        const i = gridRate(rng, 0.03, 0.08, 0.01);
        const sets = pattern.truth.map((good) => {
          const t1 = rng.int(1, T - 1);
          const t2 = T + rng.int(1, 2);
          const fit = matchTwo([[T, L]], t1, t2, (t) => v(i, t));
          if (good) return { t1, t2, A1: cents(fit.faceA), A2: cents(fit.faceB), why: "matches present value and duration, with cash flows on both sides of the liability" };
          if (rng.next() < 0.5) {
            // Same present value, wrong split: the duration condition fails.
            const shift = rng.choice([0.2, 0.3, -0.2, -0.3]) * Math.min(fit.a, fit.b);
            return { t1, t2, A1: cents((fit.a + shift) * Math.pow(1 + i, t1)), A2: cents((fit.b - shift) * Math.pow(1 + i, t2)), why: "matches present value but not duration" };
          }
          const scale = rng.choice([0.94, 0.96, 1.04, 1.06]);
          return { t1, t2, A1: cents(fit.faceA * scale), A2: cents(fit.faceB * scale), why: "has the right duration but the wrong present value" };
        });
        const describe = (s: (typeof sets)[number]) => `$A_{${s.t1}} = ${mn(s.A1, 2)}$, $A_{${s.t2}} = ${mn(s.A2, 2)}$`;
        return {
          kind: "CHOICE",
          questionText: `A company would like to be protected from large interest rate changes. It has a liability of ${n(L)} due at time ${T}, and three possible sets of asset cash flows:
${sets.map((s, k) => `${roman[k]}. ${describe(s)}`).join("\n")}
where $A_t$ is the asset cash flow at time $t$.
The effective interest rate is ${pc(i)} per time period.
Determine which set(s) of asset cash flows fully immunize the liability.`,
          variables: { variant: "SETS", scheme: pattern.scheme, L, T, i, times1: sets.map((s) => s.t1), times2: sets.map((s) => s.t2), amounts1: sets.map((s) => s.A1), amounts2: sets.map((s) => s.A2) },
          choices: romanChoices(pattern),
          fixedOrder: true,
          solutionSteps: `**Step 1 — Conditions.** Full immunization of a single liability needs equal present values, equal durations, and asset cash flows before and after the liability. The liability's present value is ${n(L * v(i, T), 2)} and its duration ${T}.

**Step 2 — Test each set.**
${sets
  .map((s, k) => {
    const pv = s.A1 * v(i, s.t1) + s.A2 * v(i, s.t2);
    const dur = (s.t1 * s.A1 * v(i, s.t1) + s.t2 * s.A2 * v(i, s.t2)) / pv;
    return `- ${roman[k]}: present value ${n(pv, 2)}, duration ${dec(dur, 4)} — ${pattern.truth[k] ? "immunizes" : `does not immunize (it ${s.why})`}.`;
  })
  .join("\n")}

**Step 3 — Answer.** Since ${pattern.verdict}, the answer is **${pattern.labels[pattern.target]}**.`,
          checks: [
            {
              label: "verdicts follow the numbers",
              ok: sets.every((s, k) => {
                const pv = s.A1 * v(i, s.t1) + s.A2 * v(i, s.t2);
                const dur = (s.t1 * s.A1 * v(i, s.t1) + s.t2 * s.A2 * v(i, s.t2)) / pv;
                const ok = Math.abs(pv - L * v(i, T)) < 0.5 && Math.abs(dur - T) < 0.001;
                return ok === pattern.truth[k];
              }),
            },
          ],
        };
      }
      const companies = ["U", "V", "W"];
      const rows = pattern.truth.map((good) => {
        const PV = gridAmount(rng, 100000, 500000, 50000);
        const D = gridAmount(rng, 50, 160, 1) / 10;
        const C = gridAmount(rng, 50, 300, 1);
        if (good) return { PVA: PV, DA: D, CA: C + rng.int(2, 10), PVL: PV, DL: D, CL: C, why: "" };
        const fault = rng.choice(["DURATION", "CONVEXITY", "VALUE"] as const);
        if (fault === "DURATION") return { PVA: PV, DA: Number((D + rng.choice([-0.9, -0.5, 0.5, 0.9])).toFixed(1)), CA: C + rng.int(2, 10), PVL: PV, DL: D, CL: C, why: "the modified durations differ" };
        if (fault === "CONVEXITY") return { PVA: PV, DA: D, CA: C - rng.int(2, 10), PVL: PV, DL: D, CL: C, why: "the assets' convexity is below the liabilities'" };
        return { PVA: PV + rng.choice([-20000, 20000]), DA: D, CA: C + rng.int(2, 10), PVL: PV, DL: D, CL: C, why: "the present values differ" };
      });
      return {
        kind: "CHOICE",
        questionText: `The table gives information about the assets and liabilities of three companies.
${table(
  ["Company", "Assets PV", "Assets mod. duration", "Assets convexity", "Liabilities PV", "Liabilities mod. duration", "Liabilities convexity"],
  rows.map((r, k) => [companies[k], mn(r.PVA), n(r.DA, 1), String(r.CA), mn(r.PVL), n(r.DL, 1), String(r.CL)])
)}
Determine which of the following statements are true.
${companies.map((c, k) => `${roman[k]}. Company ${c}'s position is immunized against small interest rate changes.`).join("\n")}`,
        variables: { variant: "TABLE", scheme: pattern.scheme, PVA: rows.map((r) => r.PVA), DA: rows.map((r) => r.DA), CA: rows.map((r) => r.CA), PVL: rows.map((r) => r.PVL), DL: rows.map((r) => r.DL), CL: rows.map((r) => r.CL) },
        choices: romanChoices(pattern),
        fixedOrder: true,
        solutionSteps: `**Step 1 — Redington conditions.** Present values equal, modified durations equal, and the assets' convexity greater than the liabilities'.

**Step 2 — Test each company.**
${rows.map((r, k) => `- ${companies[k]}: ${pattern.truth[k] ? "all three conditions hold — immunized" : `not immunized, because ${r.why}`}.`).join("\n")}

**Step 3 — Answer.** Since ${pattern.verdict}, the answer is **${pattern.labels[pattern.target]}**.`,
        checks: [
          {
            label: "verdicts follow the table",
            ok: rows.every((r, k) => (r.PVA === r.PVL && r.DA === r.DL && r.CA > r.CL) === pattern.truth[k]),
          },
        ],
      };
    },
  },

  {
    id: "FM_ALM_CONCEPT_IMMUNIZATION",
    domain: ALM,
    title: "Immunization and Matching Techniques",
    objective: "Distinguish the assumptions, conditions and protection of Redington immunization, full immunization and exact cash-flow matching.",
    difficulty: 2,
    topics: ["IMMUNIZATION"],
    steps: 2,
    qualitative: true,
    soaSamples: [55, 103, 147, 181, 199, 333, 432],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pairs: StatementPair[] = [
        {
          truth: "Redington immunization protects the surplus against small, parallel shifts in a flat yield curve.",
          falsehood: "Redington immunization protects the surplus against any change in interest rates.",
          why: "The conditions are local: they make the surplus a minimum at the current rate, which only guarantees protection for small changes.",
        },
        {
          truth: "Redington immunization requires the convexity of the assets to exceed the convexity of the liabilities.",
          falsehood: "Redington immunization requires the convexity of the liabilities to exceed the convexity of the assets.",
          why: "With equal values and durations, greater asset convexity makes the surplus rise for a small move either way.",
        },
        {
          truth: "Both Redington and full immunization require the present value of the assets to equal the present value of the liabilities.",
          falsehood: "Full immunization, unlike Redington immunization, does not require the present values of the assets and liabilities to be equal.",
          why: "Matching present values is the first condition of both techniques.",
        },
        {
          truth: "Full immunization of a single liability protects the surplus against any parallel shift of a flat yield curve, large or small.",
          falsehood: "Full immunization of a single liability protects the surplus only against small shifts of a flat yield curve.",
          why: "With asset cash flows on both sides of the liability and matched value and duration, the surplus is non-negative at every rate.",
        },
        {
          truth: "An exactly matched portfolio needs no rebalancing as interest rates change.",
          falsehood: "An exactly matched portfolio needs frequent rebalancing as interest rates change.",
          why: "Each liability is paid by an asset cash flow at the same time and of the same amount, whatever rates do.",
        },
        {
          truth: "A Redington-immunized portfolio must be rebalanced from time to time, because the durations of assets and liabilities change at different rates.",
          falsehood: "A Redington-immunized portfolio never needs rebalancing once the conditions are met.",
          why: "As time passes and rates move, the durations drift apart and the conditions must be restored.",
        },
        {
          truth: "Either Macaulay or modified duration can be used to set up an immunization strategy.",
          falsehood: "Only modified duration can be used to set up an immunization strategy.",
          why: "At a common rate the two measures differ by the same factor $1 + i$ for assets and liabilities, so matching one matches the other.",
        },
        {
          truth: "Full immunization of a single liability requires asset cash flows both before and after the liability date.",
          falsehood: "Full immunization of a single liability requires all asset cash flows to occur after the liability date.",
          why: "Only assets on both sides can match the liability's duration while guaranteeing a non-negative surplus.",
        },
        {
          truth: "An advantage of Redington immunization over exact cash-flow matching is that more investments can be used.",
          falsehood: "An advantage of exact cash-flow matching over Redington immunization is that more investments can be used.",
          why: "Matching needs assets whose cash flows coincide with the liabilities; Redington needs only the right value, duration and convexity.",
        },
        {
          truth: "Redington immunization assumes a flat yield curve that shifts in parallel.",
          falsehood: "Redington immunization assumes a yield curve with higher yields for longer terms.",
          why: "All cash flows are valued at a single rate, and the analysis considers a change in that one rate.",
        },
      ];
      if (rng.next() < 0.5) {
        const { questionText, choices, solutionSteps } = romanStatements(rng, {
          lead: "A company manages the interest rate risk of its liabilities with asset-liability management techniques.",
          ask: "Determine which of the following statements about immunization strategies are true.",
          pairs,
        });
        return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps, fixedOrder: true };
      }
      const { questionText, choices, solutionSteps } = oneOfFive(rng, {
        lead: "A company manages the interest rate risk of its liabilities with asset-liability management techniques.",
        pairs,
        askFalse: rng.next() < 0.4,
      });
      return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps };
    },
  },

  {
    id: "FM_ALM_CONCEPT_TERM",
    domain: ALM,
    title: "Naming the Asset-Liability Position",
    objective: "Name the technique a described position uses, and state the rate changes against which it is protected.",
    difficulty: 1,
    topics: ["IMMUNIZATION"],
    steps: 1,
    qualitative: true,
    soaSamples: [268, 229],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      if (rng.next() < 0.6) {
        const labels = ["Diversified", "Fully immunized", "Fully leveraged", "Exactly matched", "Redington immunized"];
        const scenarios = [
          {
            key: 4,
            text: `(i) Its assets and liabilities have equal present values and equal modified durations.
(ii) The convexity of its assets exceeds the convexity of its liabilities.`,
            why: "Equal value and duration with greater asset convexity are the Redington conditions.",
          },
          {
            key: 1,
            text: `(i) It has a single liability, and its assets have the same present value and the same duration as the liability.
(ii) Its assets provide cash flows both before and after the liability is due.`,
            why: "These are the conditions for full immunization of a single liability.",
          },
          {
            key: 3,
            text: `(i) At every date on which a liability is due, its assets provide a cash flow of exactly the same amount.
(ii) Its assets provide no other cash flows.`,
            why: "Asset cash flows equal to the liability cash flows at every date is exact matching.",
          },
        ];
        const scenario = rng.choice(scenarios);
        const choices: AuthoredChoice[] = labels.map((text, k) => ({
          text,
          isCorrect: k === scenario.key,
          type: k === scenario.key ? undefined : ("CALCULATION_DISTRACTOR" as const),
          explanation: k === scenario.key ? scenario.why : `Does not describe the position. ${scenario.why}`,
        }));
        return {
          kind: "CHOICE",
          questionText: `An insurance company aims to structure a portfolio of assets and liabilities so that:
${scenario.text}
Determine which term precisely describes the company's position.`,
          variables: { key: scenario.key },
          choices,
          fixedOrder: true,
          solutionSteps: `**Step 1 — Match the description to a technique.** ${scenario.why} The answer is **${labels[scenario.key]}**.`,
        };
      }
      const redington = rng.next() < 0.6;
      const labels = [
        "Only a small decrease in the yield rate",
        "Only a small increase in the yield rate",
        "Only a small change in the yield rate",
        "Any decrease in the yield rate",
        "Any change in the yield rate",
      ];
      const key = redington ? 2 : 4;
      const why = redington
        ? "Redington's conditions make the surplus a local minimum at the current rate, which guarantees protection only for a small change in either direction."
        : "Full immunization of a single liability gives a non-negative surplus at every rate, so any parallel change of a flat yield curve is covered.";
      return {
        kind: "CHOICE",
        questionText: redington
          ? `A company created a portfolio in order to protect its position using Redington immunization. Assume a flat yield curve that shifts in parallel.
Determine under which of the following changes in the yield rate the immunization strategy is guaranteed to be effective.`
          : `A company has a single liability and has fully immunized it with asset cash flows before and after the liability date. Assume a flat yield curve that shifts in parallel.
Determine under which of the following changes in the yield rate the immunization strategy is guaranteed to be effective.`,
        variables: { key, redington: redington ? 1 : 0 },
        choices: labels.map((text, k) => ({
          text,
          isCorrect: k === key,
          type: k === key ? undefined : ("CALCULATION_DISTRACTOR" as const),
          explanation: k === key ? why : `Too narrow or too broad. ${why}`,
        })),
        fixedOrder: true,
        solutionSteps: `**Step 1 — Scope of protection.** ${why} The answer is **${labels[key]}**.`,
      };
    },
  },
];

