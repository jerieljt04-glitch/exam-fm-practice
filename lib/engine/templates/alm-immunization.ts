import { ActuarialMath } from "../financial-math";
import { mathInt, mathMoney, mathNum, moneyInt, num, pct, rate } from "../format";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Domain 5 — Asset-Liability Management & Immunization.
 * Duration, convexity, price sensitivity, Redington and full immunization.
 */
export const ALM_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "ALM_MACAULAY_DURATION",
    domain: "ALM_IMMUNIZATION",
    title: "Macaulay Duration of a Coupon Bond",
    objective: "Compute the present-value weighted average time of a bond's cash flows.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES", "IMMUNIZATION"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const n = rng.choice([3, 4, 5]);
      const r = rng.float(0.05, 0.08, 3);
      const y = rng.float(0.04, 0.07, 3);

      const price = ActuarialMath.bondPrice(par, r, y, par, n);
      const correctValue = ActuarialMath.bondMacaulayDuration(par, r, y, par, n);

      const modified = correctValue / (1 + y);
      const maturity = n;
      const coupon = par * r;
      let weightedTime = 0;
      let totalCash = 0;
      for (let t = 1; t <= n; t += 1) {
        const amount = t === n ? coupon + par : coupon;
        weightedTime += t * amount;
        totalCash += amount;
      }
      const undiscountedAverage = weightedTime / totalCash;
      const offByOne = correctValue - 1;

      return {
        questionText: `A ${n}-year bond with par value ${moneyInt(par)} pays annual coupons at an annual effective rate of ${pct(r)} and is redeemable at par.
The annual effective yield rate is ${pct(y)}.
Calculate the Macaulay duration of the bond, in years.`,
        variables: { par, n, r, y, price },
        correctValue,
        distractors: [
          distractor(
            modified,
            "CALCULATION_DISTRACTOR",
            "Reported the modified duration $D_{\\text{mod}} = \\frac{D_{\\text{mac}}}{1+y}$ instead of the Macaulay duration."
          ),
          distractor(
            maturity,
            "NOMINAL_RATE_ERROR",
            `Set the duration equal to the term $n = ${n}$. Duration equals maturity only for a zero-coupon bond; coupons pull the weighted average time forward.`
          ),
          distractor(
            undiscountedAverage,
            "SIMPLE_INTEREST_ERROR",
            "Weighted the cash flows by their nominal amounts instead of their present values $C_t v^t$."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            "Subtracted one period from the computed duration."
          ),
        ],
        format: "YEARS",
        solutionSteps: `**Step 1 — Definition of Macaulay duration.**
$$D_{\\text{mac}} = \\frac{\\sum_{t=1}^{n} t \\cdot C_t \\cdot v^{t}}{\\sum_{t=1}^{n} C_t \\cdot v^{t}} = \\frac{\\sum t \\cdot C_t v^{t}}{P}$$

**Step 2 — List the cash flows at $y = ${y}$, $v = ${rate(ActuarialMath.v(y), 4)}$.**
Coupons of ${moneyInt(coupon)} arrive at $t = 1, \\dots, ${n - 1}$, and ${moneyInt(coupon + par)} arrives at $t = ${n}$.

**Step 3 — Evaluate numerator and denominator.**
$$\\sum t \\cdot C_t v^{t} = ${mathNum(correctValue * price)}, \\qquad P = ${mathMoney(price)}$$

**Step 4 — Divide.**
$$D_{\\text{mac}} = \\frac{${mathNum(correctValue * price)}}{${mathNum(price)}} = ${correctValue.toFixed(2)} \\text{ years}$$`,
      };
    },
  },

  {
    id: "ALM_MODIFIED_DURATION_PRICE_CHANGE",
    domain: "ALM_IMMUNIZATION",
    title: "First-Order Price Sensitivity from Modified Duration",
    objective: "Estimate a price change from modified duration and a yield shift in basis points.",
    difficulty: 1,
    topics: ["IMMUNIZATION"],
    steps: 1,
    generate: (rng) => {
      const price = rng.int(90, 115) * 10;
      const modifiedDuration = rng.float(4.5, 9.5, 2);
      const yieldRate = rng.float(0.03, 0.07, 3);
      const basisPoints = rng.choice([25, 50, 75, 100]);
      const deltaY = basisPoints / 10000;
      const direction = rng.choice(["increases", "decreases"]);
      const sign = direction === "increases" ? 1 : -1;

      const priceChange = -modifiedDuration * price * (sign * deltaY);
      const correctValue = price + priceChange;

      const wrongSign = price - priceChange;
      const macaulayDuration = modifiedDuration * (1 + yieldRate);
      const usedMacaulay = price - macaulayDuration * price * (sign * deltaY);
      const changeOnly = Math.abs(priceChange);
      const basisPointConfusion = price - modifiedDuration * price * (sign * (basisPoints / 100));

      return {
        questionText: `A bond portfolio has a market value of ${moneyInt(price)}, a modified duration of ${num(modifiedDuration)} years, and an annual effective yield of ${pct(yieldRate)}.
The yield ${direction} by ${basisPoints} basis points.
Using the first-order modified duration approximation, estimate the new market value of the portfolio.`,
        variables: { price, modifiedDuration, yieldRate, basisPoints, deltaY, direction },
        correctValue,
        distractors: [
          distractor(
            wrongSign,
            "CALCULATION_DISTRACTOR",
            `Applied the price change with the wrong sign. Price moves inversely to yield, so when the yield ${direction} the value must ${direction === "increases" ? "fall" : "rise"}.`
          ),
          distractor(
            usedMacaulay,
            "NOMINAL_RATE_ERROR",
            `Used the Macaulay duration $D_{\\text{mac}} = D_{\\text{mod}}(1+y) = ${num(macaulayDuration)}$ in the sensitivity formula, which requires the modified duration.`
          ),
          distractor(
            changeOnly,
            "CALCULATION_DISTRACTOR",
            "Reported the magnitude of the price change $|\\Delta P|$ instead of the resulting market value $P + \\Delta P$."
          ),
          distractor(
            basisPointConfusion,
            "SIMPLE_INTEREST_ERROR",
            `Treated ${basisPoints} basis points as ${basisPoints} percentage points. One basis point is $0.0001$, so $${basisPoints}\\text{ bp} = ${rate(deltaY, 4)}$.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — First-order approximation.**
$$\\frac{\\Delta P}{P} \\approx -D_{\\text{mod}} \\cdot \\Delta y \\quad\\Longrightarrow\\quad \\Delta P \\approx -D_{\\text{mod}} \\cdot P \\cdot \\Delta y$$

**Step 2 — Identify the inputs.**
$$P = ${mathMoney(price, 0)}, \\qquad D_{\\text{mod}} = ${num(modifiedDuration)}, \\qquad \\Delta y = ${sign > 0 ? "+" : "-"}${rate(deltaY, 4)}$$

**Step 3 — Compute the change and the new value.**
$$\\Delta P \\approx -(${num(modifiedDuration)})(${mathInt(price)})(${sign > 0 ? "" : "-"}${rate(deltaY, 4)}) = ${mathNum(priceChange)}$$
$$P_{\\text{new}} = ${mathInt(price)} + (${mathNum(priceChange)}) = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ALM_REDINGTON_IMMUNIZATION",
    domain: "ALM_IMMUNIZATION",
    title: "Redington Immunization Asset Allocation",
    objective: "Match present value and duration of assets to a single liability.",
    difficulty: 3,
    topics: ["TIME_VALUE", "IMMUNIZATION"],
    steps: 3,
    generate: (rng) => {
      const liabilityTime = rng.choice([6, 8, 10]);
      const liability = rng.int(10, 30) * 10000;
      const y = rng.float(0.05, 0.08, 3);
      const t1 = rng.int(1, 3);
      const t2 = rng.int(liabilityTime + 2, 16);

      const liabilityPv = liability * Math.pow(1 + y, -liabilityTime);
      const asset1Pv = (liabilityPv * (t2 - liabilityTime)) / (t2 - t1);
      const asset2Pv = liabilityPv - asset1Pv;
      const correctValue = asset1Pv * Math.pow(1 + y, t1);

      const presentValueOnly = asset1Pv;
      const otherAsset = asset2Pv * Math.pow(1 + y, t2);
      const undiscounted = (liability * (t2 - liabilityTime)) / (t2 - t1);
      const equalSplit = liability / 2;

      return {
        questionText: `An insurer has a single liability of ${moneyInt(liability)} due at time $t = ${liabilityTime}$. The annual effective interest rate is ${pct(y)}.
To Redington immunize the liability, the insurer buys zero-coupon bonds maturing at $t = ${t1}$ and $t = ${t2}$.
Calculate the maturity value of the zero-coupon bond maturing at $t = ${t1}$.`,
        variables: { liabilityTime, liability, y, t1, t2, asset1Pv, asset2Pv },
        correctValue,
        distractors: [
          distractor(
            presentValueOnly,
            "CALCULATION_DISTRACTOR",
            `Stopped at the present value $PV(A_1)$ rather than accumulating it to its maturity value $PV(A_1)(1+i)^{${t1}}$.`
          ),
          distractor(
            otherAsset,
            "CALCULATION_DISTRACTOR",
            `Computed the maturity value of the $t = ${t2}$ bond instead of the $t = ${t1}$ bond.`
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            "Allocated the undiscounted liability amount between the two bonds without first discounting to time $0$."
          ),
          distractor(
            equalSplit,
            "NOMINAL_RATE_ERROR",
            "Split the liability equally between the two bonds; the split is set by the duration-matching condition, not by symmetry."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Redington conditions.**
$$PV(A) = PV(L), \\qquad D(A) = D(L) = ${liabilityTime}, \\qquad C(A) > C(L)$$
The third condition holds automatically because $t_1 = ${t1} < ${liabilityTime} < ${t2} = t_2$.

**Step 2 — Present value of the liability.**
$$PV(L) = ${mathMoney(liability, 0)} \\times (1 + ${y})^{-${liabilityTime}} = ${mathMoney(liabilityPv)}$$

**Step 3 — Solve the two matching equations.**
$$PV(A_1) + PV(A_2) = PV(L), \\qquad ${t1}\\,PV(A_1) + ${t2}\\,PV(A_2) = ${liabilityTime}\\,PV(L)$$
$$PV(A_1) = PV(L) \\cdot \\frac{${t2} - ${liabilityTime}}{${t2} - ${t1}} = ${mathNum(liabilityPv)} \\times \\frac{${t2 - liabilityTime}}{${t2 - t1}} = ${mathMoney(asset1Pv)}$$

**Step 4 — Accumulate to the bond's maturity date.**
$$A_1 = PV(A_1)(1 + ${y})^{${t1}} = ${mathNum(asset1Pv)} \\times ${rate(Math.pow(1 + y, t1), 4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ALM_FULL_IMMUNIZATION",
    domain: "ALM_IMMUNIZATION",
    title: "Full Immunization with Cash Flows Straddling the Liability",
    objective: "Solve the full immunization conditions for the asset maturing before the liability.",
    difficulty: 3,
    topics: ["TIME_VALUE", "IMMUNIZATION"],
    steps: 3,
    generate: (rng) => {
      const liability = rng.int(20, 60) * 10000;
      const liabilityTime = rng.int(8, 14);
      const before = rng.int(2, 5);
      const after = rng.int(2, 6);
      const y = rng.float(0.04, 0.08, 3);

      const v = ActuarialMath.v(y);
      const correctValue = liability * (after / (before + after)) * Math.pow(v, before);

      const swappedWeights = liability * (before / (before + after)) * Math.pow(v, before);
      const undiscounted = liability * (after / (before + after));
      const accumulated = liability * (after / (before + after)) * Math.pow(1 + y, before);
      const equalSplit = (liability / 2) * Math.pow(v, before);

      return {
        questionText: `An insurer must pay a liability of ${moneyInt(liability)} at time $t = ${liabilityTime}$. The annual effective interest rate is ${pct(y)}.
The insurer fully immunizes the liability with two zero-coupon bonds maturing at $t = ${liabilityTime - before}$ and $t = ${liabilityTime + after}$.
Calculate the maturity value of the bond maturing at $t = ${liabilityTime - before}$.`,
        variables: { liability, liabilityTime, before, after, y },
        correctValue,
        distractors: [
          distractor(
            swappedWeights,
            "CALCULATION_DISTRACTOR",
            `Swapped the weights. The bond maturing ${before} years *before* the liability receives weight $\\frac{b}{a+b} = \\frac{${after}}{${before + after}}$, not $\\frac{a}{a+b}$.`
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            `Allocated the liability amount without discounting it over the ${before}-year gap between the bond's maturity and the liability date.`
          ),
          distractor(
            accumulated,
            "OFF_BY_ONE_PERIOD",
            `Accumulated forward by $(1+i)^{${before}}$ instead of discounting by $v^{${before}}$.`
          ),
          distractor(
            equalSplit,
            "NOMINAL_RATE_ERROR",
            "Split the liability equally between the two bonds; equal splits only immunize when the two maturities are equidistant from the liability."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Full immunization conditions.**
With the liability $L$ at time $T = ${liabilityTime}$ and assets $A$ at $T - a$ and $B$ at $T + b$ (here $a = ${before}$, $b = ${after}$):
$$PV(A) + PV(B) = PV(L), \\qquad (T-a)PV(A) + (T+b)PV(B) = T \\cdot PV(L)$$

**Step 2 — Solve for the present value of the earlier asset.**
Eliminating $PV(B)$ gives
$$PV(A) = PV(L) \\cdot \\frac{b}{a+b} = PV(L) \\cdot \\frac{${after}}{${before + after}}$$

**Step 3 — Convert the present value into a maturity value at $t = ${liabilityTime - before}$.**
$$A = L \\cdot \\frac{b}{a+b} \\cdot v^{\\,a} = ${mathMoney(liability, 0)} \\times \\frac{${after}}{${before + after}} \\times ${rate(Math.pow(v, before), 5)}$$
$$A = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ALM_CONVEXITY_ZERO_COUPON",
    domain: "ALM_IMMUNIZATION",
    title: "Modified Convexity of a Zero-Coupon Bond",
    objective: "Apply the convexity definition to a single future cash flow.",
    difficulty: 1,
    topics: ["IMMUNIZATION"],
    steps: 1,
    generate: (rng) => {
      const n = rng.int(5, 20);
      const y = rng.float(0.03, 0.08, 3);

      const correctValue = (n * (n + 1)) / Math.pow(1 + y, 2);

      const macaulayConvexity = n * n;
      const undiscounted = n * (n + 1);
      const durationForm = n / Math.pow(1 + y, 2);
      const singleDiscount = (n * (n + 1)) / (1 + y);

      return {
        questionText: `A zero-coupon bond matures in ${n} years. The annual effective yield rate is ${pct(y)}.
Calculate the modified convexity of the bond.`,
        variables: { n, y },
        correctValue,
        distractors: [
          distractor(
            macaulayConvexity,
            "CALCULATION_DISTRACTOR",
            `Reported the Macaulay convexity $C_{\\text{mac}} = n^2 = ${n * n}$ instead of the modified convexity $C_{\\text{mod}} = \\frac{n(n+1)}{(1+y)^2}$.`
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            "Evaluated the numerator $n(n+1)$ but omitted the division by $(1+y)^2$."
          ),
          distractor(
            durationForm,
            "NOMINAL_RATE_ERROR",
            "Used the duration numerator $n$ instead of the convexity numerator $n(n+1)$."
          ),
          distractor(
            singleDiscount,
            "OFF_BY_ONE_PERIOD",
            "Divided by $(1+y)$ instead of $(1+y)^2$; convexity is a second derivative and carries two powers of the discount factor."
          ),
        ],
        format: "DECIMAL_2",
        solutionSteps: `**Step 1 — Price of a zero-coupon bond.**
$$P(y) = C (1+y)^{-n}$$

**Step 2 — Differentiate twice with respect to $y$.**
$$P''(y) = n(n+1) \\, C (1+y)^{-n-2}$$

**Step 3 — Modified convexity is the normalised second derivative.**
$$C_{\\text{mod}} = \\frac{P''(y)}{P(y)} = \\frac{n(n+1)(1+y)^{-n-2}}{(1+y)^{-n}} = \\frac{n(n+1)}{(1+y)^{2}}$$

**Step 4 — Evaluate at $n = ${n}$, $y = ${y}$.**
$$C_{\\text{mod}} = \\frac{${n}(${n + 1})}{(1 + ${y})^{2}} = \\frac{${n * (n + 1)}}{${rate(Math.pow(1 + y, 2), 5)}} = ${correctValue.toFixed(2)}$$`,
      };
    },
  },

  {
    id: "ALM_ANNUITY_DURATION",
    domain: "ALM_IMMUNIZATION",
    title: "Macaulay Duration of a Level Annuity",
    objective: "Express the duration of a level annuity as a ratio of annuity factors.",
    difficulty: 2,
    topics: ["TIME_VALUE", "IMMUNIZATION"],
    steps: 2,
    generate: (rng) => {
      const n = rng.int(8, 20);
      const i = rng.float(0.04, 0.09, 3);

      const increasing = ActuarialMath.increasingAnnuityImmediate(n, i);
      const level = ActuarialMath.annuityImmediate(n, i);
      const correctValue = increasing / level;

      const simpleAverage = (n + 1) / 2;
      const modified = correctValue / (1 + i);
      const halfTerm = n / 2;
      const dueRatio = increasing / ActuarialMath.annuityDue(n, i);

      return {
        questionText: `An annuity-immediate pays 1 at the end of each year for ${n} years. The annual effective interest rate is ${pct(i)}.
Calculate the Macaulay duration of the annuity, in years.`,
        variables: { n, i },
        correctValue,
        distractors: [
          distractor(
            simpleAverage,
            "SIMPLE_INTEREST_ERROR",
            `Averaged the payment times without discounting, $\\frac{n+1}{2} = ${num(simpleAverage)}$. Discounting weights the earlier payments more heavily, so the true duration is shorter.`
          ),
          distractor(
            modified,
            "CALCULATION_DISTRACTOR",
            "Reported the modified duration $\\frac{D_{\\text{mac}}}{1+i}$ instead of the Macaulay duration."
          ),
          distractor(
            halfTerm,
            "NOMINAL_RATE_ERROR",
            `Took half the term, $\\frac{n}{2} = ${num(halfTerm)}$, which is neither the discounted nor the undiscounted average payment time.`
          ),
          distractor(
            dueRatio,
            "ANNUITY_DUE_CONFUSION",
            "Divided by the annuity-due factor $\\ddot{a}_{\\overline{n}|}$; the denominator must be the present value of the same annuity-immediate that appears in the numerator."
          ),
        ],
        format: "YEARS",
        solutionSteps: `**Step 1 — Duration as a ratio of weighted present values.**
$$D_{\\text{mac}} = \\frac{\\sum_{t=1}^{n} t \\, v^{t}}{\\sum_{t=1}^{n} v^{t}} = \\frac{(Ia)_{\\overline{n}|i}}{a_{\\overline{n}|i}}$$

**Step 2 — Evaluate both factors at $i = ${i}$.**
$$(Ia)_{\\overline{${n}}|} = \\frac{\\ddot{a}_{\\overline{${n}}|} - ${n} v^{${n}}}{${i}} = ${increasing.toFixed(4)}$$
$$a_{\\overline{${n}}|} = ${level.toFixed(4)}$$

**Step 3 — Divide.**
$$D_{\\text{mac}} = \\frac{${increasing.toFixed(4)}}{${level.toFixed(4)}} = ${correctValue.toFixed(2)} \\text{ years}$$

Note this is well below the undiscounted average payment time $\\frac{n+1}{2} = ${num(simpleAverage)}$ years.`,
      };
    },
  },
];
