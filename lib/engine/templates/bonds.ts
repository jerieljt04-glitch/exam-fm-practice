import { ActuarialMath } from "../financial-math";
import { mathInt, mathMoney, mathNum, money, moneyInt, ordinal, pct, rate } from "../format";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Domain 4 — Bonds.
 * Pricing, book value, premium/discount amortization, yield rates and call provisions.
 */
export const BOND_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "BOND_BASIC_PRICING",
    domain: "BONDS",
    title: "Pricing a Semiannual Coupon Bond",
    objective: "Price a bond as the present value of its coupons plus redemption value.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = rng.choice([1000, 10000]);
      const years = rng.choice([10, 15, 20]);
      const couponNominal = rng.float(0.05, 0.09, 3);
      const yieldNominal = rng.float(0.04, 0.08, 3);
      const m = 2;

      const periods = years * m;
      const r = couponNominal / m;
      const y = yieldNominal / m;
      const coupon = par * r;

      const annuityFactor = ActuarialMath.annuityImmediate(periods, y);
      const discountFactor = Math.pow(1 + y, -periods);
      const correctValue = coupon * annuityFactor + par * discountFactor;

      const annualPeriods = ActuarialMath.bondPrice(par, couponNominal, yieldNominal, par, years);
      const dueCoupons = coupon * ActuarialMath.annuityDue(periods, y) + par * discountFactor;
      const shortByOne = ActuarialMath.bondPrice(par, r, y, par, periods - 1);
      const simpleDiscount = (par + coupon * periods) / (1 + yieldNominal * years);

      return {
        questionText: `A ${years}-year bond with par value ${moneyInt(par)} pays semiannual coupons at a nominal annual rate of ${pct(couponNominal)} compounded semiannually.
The bond is redeemable at par and is bought to yield a nominal annual rate of ${pct(yieldNominal)} compounded semiannually.
Calculate the price of the bond.`,
        variables: { par, years, couponNominal, yieldNominal, periods, r, y, coupon },
        correctValue,
        distractors: [
          distractor(
            annualPeriods,
            "NOMINAL_RATE_ERROR",
            `Priced the bond with ${years} annual periods at the nominal rates instead of ${periods} semiannual periods at the halved rates.`
          ),
          distractor(
            dueCoupons,
            "ANNUITY_DUE_CONFUSION",
            "Discounted the coupons as an annuity-due, placing each coupon at the start of its half-year."
          ),
          distractor(
            shortByOne,
            "OFF_BY_ONE_PERIOD",
            `Used ${periods - 1} coupon periods instead of ${periods}.`
          ),
          distractor(
            simpleDiscount,
            "SIMPLE_INTEREST_ERROR",
            "Discounted the undiscounted total of coupons and redemption at simple interest."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Convert to semiannual coupon and yield rates.**
$$r = \\frac{${couponNominal}}{2} = ${rate(r)} \\quad\\Longrightarrow\\quad Fr = ${mathMoney(par, 0)} \\times ${rate(r)} = ${mathMoney(coupon)}$$
$$y = \\frac{${yieldNominal}}{2} = ${rate(y)}, \\qquad n = ${years} \\times 2 = ${periods}$$

**Step 2 — Apply the basic bond pricing formula.**
$$P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^{n}, \\qquad C = F = ${mathMoney(par, 0)}$$

**Step 3 — Evaluate the factors.**
$$a_{\\overline{${periods}}|} = ${annuityFactor.toFixed(4)}, \\qquad v^{${periods}} = ${rate(discountFactor, 5)}$$

**Step 4 — Compute the price.**
$$P = ${mathNum(coupon)} \\times ${annuityFactor.toFixed(4)} + ${mathInt(par)} \\times ${rate(discountFactor, 5)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "BOND_PREMIUM_WRITEDOWN",
    domain: "BONDS",
    title: "Premium Written Down in a Coupon Payment",
    objective: "Compute the principal adjustment column of a bond amortization schedule.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const years = rng.int(8, 15);
      const couponNominal = rng.float(0.07, 0.1, 3);
      const yieldNominal = rng.float(0.04, 0.06, 3);
      const m = 2;

      const n = years * m;
      const r = couponNominal / m;
      const y = yieldNominal / m;
      const coupon = par * r;
      const t = rng.int(3, n - 4);

      const excess = coupon - par * y;
      const correctValue = excess * Math.pow(1 + y, -(n - t + 1));

      const nextPeriod = excess * Math.pow(1 + y, -(n - t));
      const previousPeriod = excess * Math.pow(1 + y, -(n - t + 2));
      const undiscounted = excess;
      const initialPrice = ActuarialMath.bondPrice(par, r, y, par, n);
      const straightLine = (initialPrice - par) / n;

      return {
        questionText: `A ${years}-year bond with par value ${moneyInt(par)} pays semiannual coupons at a nominal annual rate of ${pct(couponNominal)} compounded semiannually. The bond is redeemable at par and is purchased at a premium to yield a nominal annual rate of ${pct(yieldNominal)} compounded semiannually.
Calculate the amount of premium written down in the $${ordinal(t)}$ coupon payment.`,
        variables: { par, years, couponNominal, yieldNominal, n, t, coupon, y },
        correctValue,
        distractors: [
          distractor(
            nextPeriod,
            "OFF_BY_ONE_PERIOD",
            `Used the exponent $n - t = ${n - t}$, which is the write-down in coupon ${t + 1}, rather than $n - t + 1 = ${n - t + 1}$.`
          ),
          distractor(
            previousPeriod,
            "OFF_BY_ONE_PERIOD",
            `Used the exponent $n - t + 2 = ${n - t + 2}$, which is the write-down in coupon ${t - 1}.`
          ),
          distractor(
            straightLine,
            "SIMPLE_INTEREST_ERROR",
            "Amortized the premium in equal instalments $(P - C)/n$; under the compound-yield method the write-down grows geometrically at $(1+y)$."
          ),
          distractor(
            undiscounted,
            "CALCULATION_DISTRACTOR",
            `Reported $Fr - Cy$ without discounting by $v^{\\,n-t+1}$; that is the write-down in the final coupon only.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Periodic coupon and yield.**
$$Fr = ${mathInt(par)} \\times \\frac{${couponNominal}}{2} = ${mathMoney(coupon)}, \\qquad y = \\frac{${yieldNominal}}{2} = ${rate(y)}, \\qquad n = ${n}$$

**Step 2 — Write-down formula for coupon $t$.**
$$p_t = (Fr - Cy)\\, v^{\\,n-t+1}, \\qquad n - t + 1 = ${n} - ${t} + 1 = ${n - t + 1}$$

**Step 3 — Evaluate.**
$$Fr - Cy = ${mathNum(coupon)} - (${mathInt(par)} \\times ${rate(y)}) = ${mathNum(excess, 4)}$$
$$v^{${n - t + 1}} = ${rate(Math.pow(1 + y, -(n - t + 1)), 5)}$$
$$p_{${t}} = ${mathNum(excess, 4)} \\times ${rate(Math.pow(1 + y, -(n - t + 1)), 5)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "BOND_CALLABLE_WORST_CASE",
    domain: "BONDS",
    title: "Maximum Price for a Callable Bond",
    objective: "Apply the minimum-yield rule to a bond callable before maturity.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const firstCallYear = rng.int(5, 8);
      const maturityYear = rng.int(15, 20);
      const r = rng.float(0.07, 0.09, 3);
      const y = rng.float(0.04, 0.06, 3);

      const coupon = par * r;
      const priceIfCalled = ActuarialMath.bondPrice(par, r, y, par, firstCallYear);
      const priceIfHeld = ActuarialMath.bondPrice(par, r, y, par, maturityYear);
      const correctValue = Math.min(priceIfCalled, priceIfHeld);

      const highestPrice = Math.max(priceIfCalled, priceIfHeld);
      const averagePrice = (priceIfCalled + priceIfHeld) / 2;
      const dueVersion = correctValue * (1 + y);

      return {
        questionText: `A ${moneyInt(par)} par value bond pays annual coupons at an annual effective rate of ${pct(r)} and matures at par in ${maturityYear} years.
The bond is callable at par at the end of year ${firstCallYear} or on any coupon date thereafter.
An investor wishes to guarantee an annual effective yield of at least ${pct(y)}.
Calculate the maximum price the investor should pay.`,
        variables: { par, firstCallYear, maturityYear, r, y, coupon },
        correctValue,
        distractors: [
          distractor(
            highestPrice,
            "CALCULATION_DISTRACTOR",
            `Priced the bond assuming redemption at maturity (year ${maturityYear}). Because the coupon rate exceeds the yield, this is a premium bond and the *earliest* call date produces the lowest — and therefore the safe — price.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Multiplied the price by $(1+y)$, treating the coupons as payable at the beginning of each year."
          ),
          distractor(
            averagePrice,
            "SIMPLE_INTEREST_ERROR",
            "Averaged the call-date and maturity-date prices; the guarantee requires the minimum over all possible redemption dates, not an average."
          ),
          distractor(
            par,
            "NOMINAL_RATE_ERROR",
            "Assumed the bond trades at par. A bond whose coupon rate exceeds its yield rate always trades at a premium."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Classify the bond.**
The coupon rate ${pct(r)} exceeds the required yield ${pct(y)}, so the bond sells at a **premium**.

**Step 2 — Apply the callable-bond rule.**
For a premium bond the investor's yield is lowest if the issuer calls at the **earliest** date, so price at $n = ${firstCallYear}$ years:
$$P = Fr \\cdot a_{\\overline{${firstCallYear}}|y} + C \\cdot v^{${firstCallYear}}$$

**Step 3 — Evaluate at $y = ${y}$.**
$$P = ${mathNum(coupon)} \\times ${ActuarialMath.annuityImmediate(firstCallYear, y).toFixed(4)} + ${mathInt(par)} \\times ${rate(Math.pow(1 + y, -firstCallYear), 5)} = ${mathMoney(priceIfCalled)}$$

**Step 4 — Confirm it is the binding constraint.**
Pricing to maturity would give ${mathMoney(priceIfHeld)}; paying that much and then being called early would yield less than ${pct(y)}. The investor must therefore pay no more than ${mathMoney(correctValue)}.`,
      };
    },
  },

  {
    id: "BOND_YIELD_TO_MATURITY",
    domain: "BONDS",
    title: "Yield to Maturity of a Coupon Bond",
    objective: "Solve the bond pricing equation for the unknown yield rate.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const n = rng.int(6, 15);
      const r = rng.float(0.05, 0.09, 3);
      const trueYield = rng.float(0.035, 0.095, 4);

      const coupon = par * r;
      // Quote the bond in whole dollars and solve the yield from that exact
      // quoted price, so the answer key matches what the candidate is given.
      const price = Math.round(ActuarialMath.bondPrice(par, r, trueYield, par, n));
      const solvedYield = ActuarialMath.bondYieldToMaturity(par, r, par, n, price);

      const currentYield = coupon / price;
      const couponRateAnswer = r;
      const approximation = (coupon + (par - price) / n) / ((par + price) / 2);
      const shortTerm = ActuarialMath.bondYieldToMaturity(par, r, par, n - 1, price);

      return {
        questionText: `A ${n}-year bond with par value ${moneyInt(par)} pays annual coupons at an annual effective rate of ${pct(r)} and is redeemable at par.
The bond is currently priced at ${moneyInt(price)}.
Calculate the annual effective yield to maturity.`,
        variables: { par, n, r, price, coupon },
        correctValue: solvedYield * 100,
        distractors: [
          distractor(
            currentYield * 100,
            "CALCULATION_DISTRACTOR",
            "Reported the current yield $\\tfrac{Fr}{P}$, which ignores the capital gain or loss realised at redemption."
          ),
          distractor(
            couponRateAnswer * 100,
            "NOMINAL_RATE_ERROR",
            `Assumed the yield equals the coupon rate. That holds only when the bond trades exactly at par, and here the price is ${moneyInt(price)}.`
          ),
          distractor(
            approximation * 100,
            "SIMPLE_INTEREST_ERROR",
            "Used the linear bond-salesman approximation $\\frac{Fr + (C-P)/n}{(C+P)/2}$ rather than solving the equation of value exactly."
          ),
          distractor(
            shortTerm * 100,
            "OFF_BY_ONE_PERIOD",
            `Solved the equation of value over ${n - 1} coupon periods instead of ${n}.`
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Write the equation of value in the unknown yield $y$.**
$$${mathInt(price)} = ${mathNum(coupon)} \\cdot a_{\\overline{${n}}|y} + ${mathInt(par)} \\cdot (1+y)^{-${n}}$$

**Step 2 — Bracket the root.**
The price is strictly decreasing in $y$. Since $P ${price < par ? "<" : ">"} C$, the bond sells at a ${price < par ? "discount" : "premium"}, so the yield must be ${price < par ? "above" : "below"} the coupon rate ${pct(r)}.

**Step 3 — Solve numerically (bisection or the calculator's IRR routine).**
$$y = ${(solvedYield * 100).toFixed(2)}\\%$$

**Step 4 — Verify by re-pricing at the solved yield.**
$$P(${(solvedYield * 100).toFixed(2)}\\%) = ${mathMoney(ActuarialMath.bondPrice(par, r, solvedYield, par, n))} \\approx ${mathMoney(price, 0)}$$`,
      };
    },
  },

  {
    id: "BOND_BOOK_VALUE",
    domain: "BONDS",
    title: "Book Value Immediately After a Coupon",
    objective: "Value the remaining bond cash flows at the original yield rate.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const years = rng.choice([8, 10, 12]);
      const couponNominal = rng.float(0.05, 0.09, 3);
      const yieldNominal = rng.float(0.04, 0.08, 3);
      const m = 2;

      const n = years * m;
      const r = couponNominal / m;
      const y = yieldNominal / m;
      const coupon = par * r;
      const t = rng.int(4, n - 4);

      const remaining = n - t;
      const correctValue = coupon * ActuarialMath.annuityImmediate(remaining, y) + par * Math.pow(1 + y, -remaining);

      const nextPeriod =
        coupon * ActuarialMath.annuityImmediate(remaining - 1, y) + par * Math.pow(1 + y, -(remaining - 1));
      const purchasePrice = ActuarialMath.bondPrice(par, r, y, par, n);
      const dueVersion = coupon * ActuarialMath.annuityDue(remaining, y) + par * Math.pow(1 + y, -remaining);

      return {
        questionText: `A ${years}-year bond with par value ${moneyInt(par)} pays semiannual coupons at a nominal annual rate of ${pct(couponNominal)} compounded semiannually and is redeemable at par. It was purchased to yield a nominal annual rate of ${pct(yieldNominal)} compounded semiannually.
Calculate the book value of the bond immediately after the $${ordinal(t)}$ coupon is paid.`,
        variables: { par, years, couponNominal, yieldNominal, n, t, coupon, y },
        correctValue,
        distractors: [
          distractor(
            nextPeriod,
            "OFF_BY_ONE_PERIOD",
            `Valued ${remaining - 1} remaining coupons, which is the book value after coupon ${t + 1}, rather than ${remaining}.`
          ),
          distractor(
            purchasePrice,
            "CALCULATION_DISTRACTOR",
            `Reported the original purchase price at issue instead of the book value after ${t} coupons have been paid.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued the remaining coupons as an annuity-due, adding a period of interest that has already been received."
          ),
          distractor(
            par,
            "NOMINAL_RATE_ERROR",
            "Assumed the book value equals par. Book value only converges to the redemption value at maturity."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Book value is the prospective value of what remains, at the original yield.**
$$B_t = Fr \\cdot a_{\\overline{n-t}|y} + C \\cdot v^{\\,n-t}$$

**Step 2 — Count the remaining coupons.**
$$n - t = ${n} - ${t} = ${remaining} \\text{ half-years}, \\qquad y = \\frac{${yieldNominal}}{2} = ${rate(y)}$$

**Step 3 — Evaluate.**
$$a_{\\overline{${remaining}}|} = ${ActuarialMath.annuityImmediate(remaining, y).toFixed(4)}, \\qquad v^{${remaining}} = ${rate(Math.pow(1 + y, -remaining), 5)}$$
$$B_{${t}} = ${mathNum(coupon)} \\times ${ActuarialMath.annuityImmediate(remaining, y).toFixed(4)} + ${mathInt(par)} \\times ${rate(Math.pow(1 + y, -remaining), 5)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "BOND_INTEREST_EARNED",
    domain: "BONDS",
    title: "Interest Earned Portion of a Coupon",
    objective: "Separate a coupon into interest earned and principal adjustment.",
    difficulty: 2,
    topics: ["BONDS_AND_CURVES"],
    steps: 2,
    generate: (rng) => {
      const par = 1000;
      const n = rng.int(8, 16);
      const r = rng.float(0.06, 0.09, 3);
      const y = rng.float(0.035, 0.055, 3);
      const t = rng.int(3, n - 3);

      const coupon = par * r;
      const previousBook = ActuarialMath.bondPrice(par, r, y, par, n - (t - 1));
      const correctValue = y * previousBook;
      const principalAdjustment = coupon - correctValue;

      const couponItself = coupon;
      const interestOnPar = par * y;
      const nextPeriodBook = ActuarialMath.bondPrice(par, r, y, par, n - t);
      const offByOne = y * nextPeriodBook;

      return {
        questionText: `A ${n}-year bond with par value ${moneyInt(par)} pays annual coupons at an annual effective rate of ${pct(r)} and is redeemable at par. It was purchased to yield an annual effective rate of ${pct(y)}.
Calculate the interest earned portion of the $${ordinal(t)}$ coupon.`,
        variables: { par, n, r, y, t, coupon },
        correctValue,
        distractors: [
          distractor(
            couponItself,
            "CALCULATION_DISTRACTOR",
            `Reported the full coupon ${money(coupon)}. Only $y \\cdot B_{t-1} = ${money(correctValue)}$ of it is interest earned; the remaining ${money(principalAdjustment)} writes down the premium.`
          ),
          distractor(
            interestOnPar,
            "NOMINAL_RATE_ERROR",
            "Applied the yield rate to the par value rather than to the book value carried into the period."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Applied the yield to $B_{${t}}$ instead of $B_{${t - 1}}$; interest in period $t$ accrues on the balance held at the *start* of the period.`
          ),
          distractor(
            principalAdjustment,
            "CALCULATION_DISTRACTOR",
            "Reported the principal adjustment (premium written down) instead of the interest earned."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Book value entering period ${t}.**
$$B_{${t - 1}} = Fr \\cdot a_{\\overline{${n - t + 1}}|y} + C \\cdot v^{${n - t + 1}} = ${mathMoney(previousBook)}$$

**Step 2 — Interest earned accrues on that book value at the yield rate.**
$$I_{${t}} = y \\cdot B_{${t - 1}} = ${y} \\times ${mathNum(previousBook)} = ${mathMoney(correctValue)}$$

**Step 3 — Reconcile the coupon.**
$$\\text{Coupon} = I_{${t}} + p_{${t}} \\quad\\Longrightarrow\\quad ${mathMoney(coupon)} = ${mathMoney(correctValue)} + ${mathMoney(principalAdjustment)}$$`,
      };
    },
  },
];
