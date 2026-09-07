import { ActuarialMath } from "../financial-math";
import {
  mathInt,
  mathMoney,
  mathNum,
  mathPct,
  money,
  moneyInt,
  num,
  ordinal,
  pct,
  rate,
} from "../format";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Level 3 and level 4 synthesis items.
 *
 * Each template chains at least three interdependent sub-problems across two or
 * more syllabus areas: the result of stage one is an input to stage two, which
 * changes the condition solved in stage three. Every generator also publishes
 * `checks` — invariants it re-derives independently (re-pricing at a solved
 * yield, confirming a matched duration, confirming a swap prices to par) — which
 * the engine test suite asserts across hundreds of parameter draws.
 */

/** Rounds to cents, so figures quoted in a question are the figures solved from. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

export const MULTI_STEP_TEMPLATES: QuestionTemplateDefinition[] = [
  // ==========================================================================
  // TIME VALUE OF MONEY
  // ==========================================================================
  {
    id: "TVM_PIECEWISE_FORCE_TO_LOAN",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Piecewise Force of Interest Funding a Level-Payment Loan",
    objective:
      "Integrate a piecewise force of interest, amortize the accumulated fund, then value the balance outstanding partway through the term.",
    difficulty: 3,
    topics: ["TIME_VALUE", "LOAN_MECHANICS"],
    steps: 3,
    generate: (rng) => {
      const deposit = rng.int(4, 12) * 5000;
      const a = rng.float(0.02, 0.045, 3);
      const b = rng.float(0.015, 0.03, 3);
      const c = rng.float(0.002, 0.006, 4);
      const k = rng.int(3, 5);
      const m = k + rng.int(3, 6);
      const i = rng.float(0.05, 0.08, 3);
      const n = rng.int(10, 18);
      const p = rng.int(3, n - 3);

      const firstIntegral = a * k;
      const secondIntegral = b * (m - k) + (c * (m * m - k * k)) / 2;
      const fund = deposit * Math.exp(firstIntegral + secondIntegral);

      const annuityFactor = ActuarialMath.annuityImmediate(n, i);
      const payment = fund / annuityFactor;
      const remainingFactor = ActuarialMath.annuityImmediate(n - p, i);
      const correctValue = payment * remainingFactor;

      // Distractor chains: each re-runs the whole calculation with one flawed stage.
      const constantForceFund = deposit * Math.exp(a * m);
      const constantForce =
        (constantForceFund / annuityFactor) * remainingFactor;

      const forgotHalfFund = deposit * Math.exp(firstIntegral + b * (m - k) + c * (m * m - k * k));
      const forgotHalf = (forgotHalfFund / annuityFactor) * remainingFactor;

      const duePayment = fund / ActuarialMath.annuityDue(n, i);
      const dueVersion = duePayment * remainingFactor;

      const offByOne = payment * ActuarialMath.annuityImmediate(n - p + 1, i);

      // Verification: the prospective balance must equal the retrospective one.
      const retrospective =
        fund * Math.pow(1 + i, p) - payment * ActuarialMath.accumulatedAnnuityImmediate(p, i);

      return {
        questionText: `A deposit of ${moneyInt(deposit)} is made at time $t = 0$ into a fund whose force of interest is
$$\\delta(t) = \\begin{cases} ${a} & 0 \\le t < ${k} \\\\ ${b} + ${c}t & t \\ge ${k} \\end{cases}$$
At time $t = ${m}$ the entire fund is lent to a borrower, who repays it with ${n} level annual payments at an annual effective interest rate of ${pct(i)}, the first payment due one year after the loan is made.
Calculate the outstanding loan balance immediately after the $${ordinal(p)}$ payment.`,
        variables: { deposit, a, b, c, k, m, i, n, p },
        correctValue,
        distractors: [
          distractor(
            constantForce,
            "NOMINAL_RATE_ERROR",
            `Applied the constant force $\\delta = ${a}$ over the whole ${m} years, ignoring that the force switches to $${b} + ${c}t$ at $t = ${k}$.`
          ),
          distractor(
            forgotHalf,
            "CALCULATION_DISTRACTOR",
            `Integrated $${c}t$ as $${c}t^2$ rather than $\\tfrac{1}{2}(${c})t^2$, doubling the variable part of the second interval's integral.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Derived the level payment from $\\ddot{a}_{\\overline{n}|i}$, placing the first repayment at the moment the loan is made."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Valued ${n - p + 1} remaining payments, which is the balance immediately *before* payment ${p}.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Accumulate the deposit under the piecewise force.**
The exponent is the integral of $\\delta$ over $[0, ${m}]$, split at $t = ${k}$:
$$\\int_0^{${k}} ${a}\\,dt = ${a}(${k}) = ${rate(firstIntegral, 4)}$$
$$\\int_{${k}}^{${m}} (${b} + ${c}t)\\,dt = ${b}(${m - k}) + \\tfrac{1}{2}(${c})\\left(${m}^2 - ${k}^2\\right) = ${rate(secondIntegral, 4)}$$
$$A(${m}) = ${mathMoney(deposit, 0)} \\cdot e^{${rate(firstIntegral + secondIntegral, 4)}} = ${mathMoney(fund)}$$

**Step 2 — Amortize that fund over ${n} years.**
$$R = \\frac{A(${m})}{a_{\\overline{${n}}|${i}}} = \\frac{${mathNum(fund)}}{${num(annuityFactor, 4)}} = ${mathMoney(payment)}$$

**Step 3 — Value the ${n - p} payments still outstanding.**
$$B_{${p}} = R \\cdot a_{\\overline{${n - p}}|${i}} = ${mathNum(payment)} \\times ${num(remainingFactor, 4)} = ${mathMoney(correctValue)}$$

**Verification —** the retrospective route agrees:
$$A(${m})(1 + ${i})^{${p}} - R \\cdot s_{\\overline{${p}}|${i}} = ${mathMoney(retrospective)}$$`,
        checks: [
          {
            label: "prospective balance equals retrospective balance",
            ok: Math.abs(correctValue - retrospective) < 1e-6 * Math.max(1, correctValue),
          },
          { label: "fund is positive", ok: fund > 0 },
        ],
      };
    },
  },

  {
    id: "TVM_DOLLAR_TO_TIME_WEIGHTED",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Recovering a Time-Weighted Yield from a Dollar-Weighted Yield",
    objective:
      "Invert the dollar-weighted yield to recover the year-end balance, then chain the sub-period ratios into a time-weighted yield.",
    difficulty: 3,
    topics: ["TIME_VALUE", "LOAN_MECHANICS"],
    steps: 3,
    generate: (rng) => {
      const opening = rng.int(20, 60) * 1000;
      const deposit = rng.int(5, 18) * 1000;
      const withdrawal = rng.int(4, 14) * 1000;

      // Deposit on 1 April (t = 1/4), withdrawal on 1 October (t = 3/4).
      const depositTime = 0.25;
      const withdrawalTime = 0.75;

      const beforeDeposit = cents(opening * (1 + rng.float(0.01, 0.06, 4)));
      const afterDeposit = beforeDeposit + deposit;
      const beforeWithdrawal = cents(afterDeposit * (1 + rng.float(-0.02, 0.05, 4)));
      const afterWithdrawal = beforeWithdrawal - withdrawal;

      const dollarWeighted = rng.float(0.04, 0.11, 4);

      const exposure =
        opening + deposit * (1 - depositTime) - withdrawal * (1 - withdrawalTime);
      const interestEarned = dollarWeighted * exposure;
      const closing = cents(opening + deposit - withdrawal + interestEarned);

      const correctValue =
        ((beforeDeposit / opening) *
          (beforeWithdrawal / afterDeposit) *
          (closing / afterWithdrawal) -
          1) *
        100;

      const openingOnlyClosing = cents(opening + deposit - withdrawal + dollarWeighted * opening);
      const openingOnly =
        ((beforeDeposit / opening) *
          (beforeWithdrawal / afterDeposit) *
          (openingOnlyClosing / afterWithdrawal) -
          1) *
        100;

      const unweightedExposure = opening + deposit - withdrawal;
      const unweightedClosing = cents(
        opening + deposit - withdrawal + dollarWeighted * unweightedExposure
      );
      const unweighted =
        ((beforeDeposit / opening) *
          (beforeWithdrawal / afterDeposit) *
          (unweightedClosing / afterWithdrawal) -
          1) *
        100;

      const simpleReturn = ((closing - opening - deposit + withdrawal) / opening) * 100;

      return {
        questionText: `A fund holds ${moneyInt(opening)} on 1 January. During the year:
- on 1 April the fund is worth ${money(beforeDeposit)} immediately before a deposit of ${moneyInt(deposit)};
- on 1 October the fund is worth ${money(beforeWithdrawal)} immediately before a withdrawal of ${moneyInt(withdrawal)}.

The dollar-weighted (money-weighted) yield for the year, computed with the simple-interest exposure approximation, is ${pct(dollarWeighted)}.
Calculate the time-weighted yield for the year.`,
        variables: {
          opening,
          deposit,
          withdrawal,
          beforeDeposit,
          beforeWithdrawal,
          dollarWeighted,
          closing,
        },
        correctValue,
        distractors: [
          distractor(
            openingOnly,
            "SIMPLE_INTEREST_ERROR",
            "Applied the dollar-weighted yield to the opening balance alone, ignoring that the deposit is exposed for three quarters of the year and the withdrawal removes exposure for one quarter."
          ),
          distractor(
            unweighted,
            "NOMINAL_RATE_ERROR",
            "Used an unweighted exposure $A + C - W$ instead of weighting each flow by the fraction of the year it remains invested, $A + C(1-t_C) - W(1-t_W)$."
          ),
          distractor(
            dollarWeighted * 100,
            "CALCULATION_DISTRACTOR",
            "Reported the dollar-weighted yield itself. The two measures differ whenever the fund's return varies across the year, because only the dollar-weighted figure is sensitive to the timing of the flows."
          ),
          distractor(
            simpleReturn,
            "CALCULATION_DISTRACTOR",
            "Divided total interest by the opening balance, which is neither measure: the time-weighted yield chains the sub-period growth ratios and is unaffected by the size of the flows."
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Recover the interest earned from the dollar-weighted yield.**
The exposure denominator weights each flow by the time it stays invested:
$$\\text{Exposure} = A + C\\left(1 - \\tfrac{1}{4}\\right) - W\\left(1 - \\tfrac{3}{4}\\right) = ${mathInt(opening)} + ${mathNum(deposit * 0.75)} - ${mathNum(withdrawal * 0.25)} = ${mathNum(exposure, 4)}$$
$$I = i^{DW} \\times \\text{Exposure} = ${dollarWeighted} \\times ${mathNum(exposure, 4)} = ${mathMoney(interestEarned)}$$

**Step 2 — Close the year.**
$$B = A + C - W + I = ${mathInt(opening)} + ${mathInt(deposit)} - ${mathInt(withdrawal)} + ${mathNum(interestEarned)} = ${mathMoney(closing)}$$

**Step 3 — Chain the three sub-period growth ratios.**
$$1 + i^{TW} = \\frac{${mathNum(beforeDeposit)}}{${mathInt(opening)}} \\times \\frac{${mathNum(beforeWithdrawal)}}{${mathNum(afterDeposit)}} \\times \\frac{${mathNum(closing)}}{${mathNum(afterWithdrawal)}}$$
$$1 + i^{TW} = ${rate(beforeDeposit / opening, 4)} \\times ${rate(beforeWithdrawal / afterDeposit, 4)} \\times ${rate(closing / afterWithdrawal, 4)}$$
$$i^{TW} = ${correctValue.toFixed(2)}\\%$$`,
        checks: [
          {
            label: "dollar-weighted yield reproduces from the recovered interest",
            ok: Math.abs(interestEarned / exposure - dollarWeighted) < 1e-9,
          },
          { label: "fund stays solvent after the withdrawal", ok: afterWithdrawal > 0 },
        ],
      };
    },
  },

  // ==========================================================================
  // ANNUITIES & CASH FLOWS
  // ==========================================================================
  {
    id: "ANNUITY_SPOT_CURVE_LEVEL_YIELD",
    domain: "ANNUITIES",
    title: "Level Yield Equivalent to a Non-Flat Spot Curve",
    objective:
      "Price an annuity off a term structure, then solve for the single level rate that reproduces that price.",
    difficulty: 3,
    topics: ["TIME_VALUE", "BONDS_AND_CURVES"],
    steps: 3,
    generate: (rng) => {
      const payment = rng.int(20, 60) * 500;
      const base = rng.float(0.028, 0.045, 4);
      const slope = rng.float(0.003, 0.009, 4);
      const spots = [0, 1, 2, 3].map((offset) => Number((base + slope * offset).toFixed(6)));
      const n = spots.length;

      const discountFactors = ActuarialMath.spotDiscountFactors(spots);
      const annuityAtSpots = discountFactors.reduce((total, factor) => total + factor, 0);
      const presentValue = payment * annuityAtSpots;

      const correctValue = ActuarialMath.levelYield(
        Array.from({ length: n }, (_, index) => ({ t: index + 1, amount: payment })),
        presentValue
      );

      const averageSpot = spots.reduce((total, spot) => total + spot, 0) / n;
      const dueYield = ActuarialMath.levelYield(
        Array.from({ length: n }, (_, index) => ({ t: index, amount: payment })),
        presentValue
      );

      return {
        questionText: `The annual effective spot rates are ${spots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
An annuity-immediate pays ${moneyInt(payment)} at the end of each of the next ${n} years.
Calculate the level annual effective yield rate $i$ at which the same ${n} payments have the same present value.`,
        variables: { payment, spots, presentValue },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            spots[n - 1] * 100,
            "NOMINAL_RATE_ERROR",
            `Used the longest spot rate $s_{${n}} = ${mathPct(spots[n - 1])}$ as the level yield. That rate discounts only the final payment; the earlier payments are discounted at lower rates, so the equivalent level yield is below it.`
          ),
          distractor(
            averageSpot * 100,
            "SIMPLE_INTEREST_ERROR",
            "Took the arithmetic mean of the spot rates. The equivalent level yield is a present-value weighted average, which leans towards the rates applying to the larger discounted payments."
          ),
          distractor(
            spots[0] * 100,
            "CALCULATION_DISTRACTOR",
            `Used the one-year spot rate $s_1 = ${mathPct(spots[0])}$ for every payment.`
          ),
          distractor(
            dueYield * 100,
            "ANNUITY_DUE_CONFUSION",
            "Solved with payments at the start of each year, $\\ddot{a}_{\\overline{n}|i}$, which understates the yield needed to reach the same present value."
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Discount each payment at its own spot rate.**
${spots
  .map(
    (spot, index) =>
      `$$v_{${index + 1}} = (1 + ${spot})^{-${index + 1}} = ${rate(discountFactors[index], 4)}$$`
  )
  .join("\n")}

**Step 2 — Price the annuity off the curve.**
$$PV = ${mathMoney(payment, 0)} \\times \\left(${discountFactors
          .map((factor) => rate(factor, 4))
          .join(" + ")}\\right) = ${mathMoney(presentValue)}$$

**Step 3 — Solve for the level rate reproducing that price.**
$$a_{\\overline{${n}}|i} = \\frac{PV}{P} = \\frac{${mathNum(presentValue)}}{${mathInt(payment)}} = ${num(presentValue / payment, 4)}$$
Solving $\\frac{1 - (1+i)^{-${n}}}{i} = ${num(presentValue / payment, 4)}$ numerically:
$$i = ${(correctValue * 100).toFixed(2)}\\%$$

The level yield sits inside the range of the spot rates, ${pct(spots[0])} to ${pct(spots[n - 1])}, as it must.`,
        checks: [
          {
            label: "level yield reproduces the spot-curve price",
            ok:
              Math.abs(payment * ActuarialMath.annuityImmediate(n, correctValue) - presentValue) <
              1e-6 * presentValue,
          },
          {
            label: "level yield lies between the shortest and longest spot rate",
            ok: correctValue > spots[0] && correctValue < spots[n - 1],
          },
        ],
      };
    },
  },

  {
    id: "ANNUITY_INCREASING_THEN_LEVEL",
    domain: "ANNUITIES",
    title: "Increasing Annuity Followed by a Level Continuation",
    objective:
      "Value an arithmetically increasing block, then a deferred level block that continues at the final increased amount.",
    difficulty: 3,
    topics: ["TIME_VALUE", "IMMUNIZATION"],
    steps: 3,
    generate: (rng) => {
      const step = rng.int(2, 8) * 100;
      const n = rng.int(6, 12);
      const m = rng.int(5, 12);
      const i = rng.float(0.04, 0.08, 3);

      const v = ActuarialMath.v(i);
      const increasingFactor = ActuarialMath.increasingAnnuityImmediate(n, i);
      const levelFactor = ActuarialMath.annuityImmediate(m, i);
      const deferral = Math.pow(v, n);

      const increasingBlock = step * increasingFactor;
      const levelBlock = n * step * deferral * levelFactor;
      const correctValue = increasingBlock + levelBlock;

      const noDeferral = increasingBlock + n * step * levelFactor;
      const keepsIncreasing = step * ActuarialMath.increasingAnnuityImmediate(n + m, i);
      const wrongLevelAmount = increasingBlock + step * deferral * levelFactor;
      const dueVersion = correctValue * (1 + i);

      // Verification: sum the cash flows one by one.
      let bruteForce = 0;
      for (let t = 1; t <= n; t += 1) bruteForce += t * step * Math.pow(v, t);
      for (let t = n + 1; t <= n + m; t += 1) bruteForce += n * step * Math.pow(v, t);

      return {
        questionText: `An annuity-immediate makes payments at the end of each year for ${n + m} years. The payment at the end of year $t$ is $${step}t$ for $t = 1, 2, \\dots, ${n}$, and is level at ${moneyInt(n * step)} for $t = ${n + 1}, \\dots, ${n + m}$.
The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity.`,
        variables: { step, n, m, i },
        correctValue,
        distractors: [
          distractor(
            noDeferral,
            "CALCULATION_DISTRACTOR",
            `Valued the level block as if it started at the end of year 1, omitting the deferral factor $v^{${n}} = ${rate(deferral, 4)}$.`
          ),
          distractor(
            keepsIncreasing,
            "OFF_BY_ONE_PERIOD",
            `Applied $(Ia)_{\\overline{${n + m}}|i}$ over the whole term, letting the payments keep increasing past year ${n} instead of levelling off at ${moneyInt(n * step)}.`
          ),
          distractor(
            wrongLevelAmount,
            "CALCULATION_DISTRACTOR",
            `Continued at ${moneyInt(step)} per year rather than at the final increased payment of ${moneyInt(n * step)}.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued the whole stream one period earlier, as an annuity-due."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Value the increasing block over the first ${n} years.**
$$(Ia)_{\\overline{${n}}|${i}} = \\frac{\\ddot{a}_{\\overline{${n}}|} - ${n}v^{${n}}}{${i}} = ${num(increasingFactor, 4)}$$
$$PV_1 = ${mathInt(step)} \\times ${num(increasingFactor, 4)} = ${mathMoney(increasingBlock)}$$

**Step 2 — Value the level block, which is deferred ${n} years.**
The payment settles at $${n} \\times ${mathInt(step)} = ${mathMoney(n * step, 0)}$ per year for ${m} years:
$$a_{\\overline{${m}}|${i}} = ${num(levelFactor, 4)}, \\qquad v^{${n}} = ${rate(deferral, 4)}$$
$$PV_2 = ${mathInt(n * step)} \\times ${rate(deferral, 4)} \\times ${num(levelFactor, 4)} = ${mathMoney(levelBlock)}$$

**Step 3 — Add the two blocks.**
$$PV = ${mathNum(increasingBlock)} + ${mathNum(levelBlock)} = ${mathMoney(correctValue)}$$`,
        checks: [
          {
            label: "closed form matches a direct cash-flow summation",
            ok: Math.abs(correctValue - bruteForce) < 1e-6 * Math.max(1, correctValue),
          },
        ],
      };
    },
  },

  {
    id: "ANNUITY_CONTINUOUS_INCREASING",
    domain: "ANNUITIES",
    title: "Continuously Increasing, Continuously Payable Annuity",
    objective:
      "Integrate a linearly growing continuous payment rate against a constant force of interest.",
    difficulty: 3,
    topics: ["TIME_VALUE", "IMMUNIZATION"],
    steps: 3,
    generate: (rng) => {
      const step = rng.int(4, 20) * 250;
      const n = rng.int(8, 20);
      const i = rng.float(0.04, 0.09, 3);
      const delta = ActuarialMath.delta(i);

      const factor = ActuarialMath.continuousIncreasingAnnuity(n, delta);
      const correctValue = step * factor;

      const usedInterestRate =
        step * ((1 - Math.pow(1 + i, -n) * (1 + i * n)) / (i * i));
      const discreteVersion = step * ActuarialMath.increasingAnnuityImmediate(n, i);
      const missingTerm = step * ((1 - Math.exp(-delta * n)) / (delta * delta));
      const singleDelta = step * ((1 - Math.exp(-delta * n) * (1 + delta * n)) / delta);

      // Verification: Simpson's rule on the defining integral.
      const steps = 2000;
      const h = n / steps;
      let simpson = 0;
      for (let index = 0; index <= steps; index += 1) {
        const t = index * h;
        const weight = index === 0 || index === steps ? 1 : index % 2 === 1 ? 4 : 2;
        simpson += weight * t * Math.exp(-delta * t);
      }
      simpson *= (h / 3) * step;

      return {
        questionText: `An annuity is payable continuously for ${n} years. At time $t$ the payment rate is $${step}t$ per year.
The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity.`,
        variables: { step, n, i, delta },
        correctValue,
        distractors: [
          distractor(
            usedInterestRate,
            "NOMINAL_RATE_ERROR",
            `Used the annual effective rate $i = ${mathPct(i)}$ in place of the force $\\delta = \\ln(1+i) = ${rate(delta, 4)}$ throughout the integral.`
          ),
          distractor(
            discreteVersion,
            "CALCULATION_DISTRACTOR",
            "Valued a discrete increasing annuity-immediate $(Ia)_{\\overline{n}|i}$, which pays in lumps at year ends rather than continuously."
          ),
          distractor(
            missingTerm,
            "CALCULATION_DISTRACTOR",
            "Dropped the $(1 + \\delta n)$ factor produced by integrating $t e^{-\\delta t}$ by parts."
          ),
          distractor(
            singleDelta,
            "OFF_BY_ONE_PERIOD",
            "Divided by $\\delta$ rather than $\\delta^2$. Integrating $t e^{-\\delta t}$ by parts introduces a second power of the force."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Convert the interest rate to a force.**
$$\\delta = \\ln(1 + ${i}) = ${rate(delta, 4)}$$

**Step 2 — Integrate the growing payment rate by parts.**
$$PV = \\int_0^{${n}} ${mathInt(step)}\\,t\\,e^{-\\delta t}\\,dt = ${mathInt(step)} \\cdot \\frac{1 - e^{-\\delta n}\\left(1 + \\delta n\\right)}{\\delta^{2}}$$

**Step 3 — Evaluate at $n = ${n}$.**
$$e^{-\\delta n} = ${rate(Math.exp(-delta * n), 4)}, \\qquad 1 + \\delta n = ${rate(1 + delta * n, 4)}$$
$$(\\bar{I}\\bar{a})_{\\overline{${n}}|} = \\frac{1 - ${rate(Math.exp(-delta * n), 4)}(${rate(1 + delta * n, 4)})}{${rate(delta, 4)}^2} = ${num(factor, 4)}$$
$$PV = ${mathInt(step)} \\times ${num(factor, 4)} = ${mathMoney(correctValue)}$$`,
        checks: [
          {
            label: "closed form matches numerical integration",
            ok: Math.abs(correctValue - simpson) < 1e-4 * Math.max(1, correctValue),
          },
        ],
      };
    },
  },

  // ==========================================================================
  // LOANS & AMORTIZATION
  // ==========================================================================
  {
    id: "LOAN_SINKING_FUND_SWITCH",
    domain: "LOANS",
    title: "Switching from Amortization to a Sinking Fund Mid-Term",
    objective:
      "Value the balance outstanding at a renegotiation date, then re-express it as interest service plus a sinking-fund deposit at a different rate.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS", "TIME_VALUE"],
    steps: 3,
    generate: (rng) => {
      const loanAmount = rng.int(12, 40) * 10000;
      const n = rng.int(14, 24);
      const k = rng.int(4, 8);
      const loanRate = rng.float(0.06, 0.095, 3);
      const fundRate = rng.float(0.03, 0.05, 3);

      const originalPayment = ActuarialMath.loanPayment(loanAmount, n, loanRate);
      const balance = originalPayment * ActuarialMath.annuityImmediate(n - k, loanRate);

      const interestService = balance * loanRate;
      const sinkingFactor = ActuarialMath.accumulatedAnnuityImmediate(n - k, fundRate);
      const deposit = balance / sinkingFactor;
      const correctValue = interestService + deposit;

      const onOriginalPrincipal =
        loanAmount * loanRate + loanAmount / ActuarialMath.accumulatedAnnuityImmediate(n - k, fundRate);
      const fundAtLoanRate =
        interestService + balance / ActuarialMath.accumulatedAnnuityImmediate(n - k, loanRate);
      const depositOnly = deposit;
      const fullTermFund =
        interestService + balance / ActuarialMath.accumulatedAnnuityImmediate(n, fundRate);

      return {
        questionText: `A loan of ${moneyInt(loanAmount)} is being repaid with ${n} level annual payments at an annual effective interest rate of ${pct(loanRate)}.
Immediately after the $${ordinal(k)}$ payment the borrower renegotiates. For the remaining ${n - k} years the borrower will pay interest annually at ${pct(loanRate)} on the balance outstanding at the renegotiation date, and will make level annual deposits into a sinking fund earning ${pct(fundRate)} so that the fund exactly repays that balance at the end of year ${n}.
Calculate the borrower's total annual outlay under the new arrangement.`,
        variables: { loanAmount, n, k, loanRate, fundRate },
        correctValue,
        distractors: [
          distractor(
            onOriginalPrincipal,
            "CALCULATION_DISTRACTOR",
            `Serviced and sank the original principal of ${moneyInt(loanAmount)} rather than the balance of ${money(balance)} outstanding after ${k} payments.`
          ),
          distractor(
            fundAtLoanRate,
            "NOMINAL_RATE_ERROR",
            `Accumulated the sinking fund at the loan rate ${pct(loanRate)} instead of the fund rate ${pct(fundRate)}.`
          ),
          distractor(
            depositOnly,
            "CALCULATION_DISTRACTOR",
            "Reported only the sinking-fund deposit. Under this arrangement the principal is untouched until year $n$, so interest is payable in full every year as well."
          ),
          distractor(
            fullTermFund,
            "OFF_BY_ONE_PERIOD",
            `Accumulated the fund over the original ${n} years rather than the ${n - k} years that remain.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Level payment under the original amortization.**
$$R = \\frac{${mathMoney(loanAmount, 0)}}{a_{\\overline{${n}}|${loanRate}}} = \\frac{${mathInt(loanAmount)}}{${num(ActuarialMath.annuityImmediate(n, loanRate), 4)}} = ${mathMoney(originalPayment)}$$

**Step 2 — Balance outstanding at the renegotiation date.**
$$B_{${k}} = R \\cdot a_{\\overline{${n - k}}|${loanRate}} = ${mathNum(originalPayment)} \\times ${num(ActuarialMath.annuityImmediate(n - k, loanRate), 4)} = ${mathMoney(balance)}$$

**Step 3 — Split the new outlay into interest service and sinking-fund deposit.**
$$I = B_{${k}} \\cdot i = ${mathNum(balance)} \\times ${loanRate} = ${mathMoney(interestService)}$$
$$s_{\\overline{${n - k}}|${fundRate}} = ${num(sinkingFactor, 4)} \\quad\\Longrightarrow\\quad D = \\frac{${mathNum(balance)}}{${num(sinkingFactor, 4)}} = ${mathMoney(deposit)}$$
$$\\text{Outlay} = I + D = ${mathMoney(correctValue)}$$

Note the outlay exceeds the original payment of ${money(originalPayment)}, because the sinking fund earns less than the loan charges.`,
        checks: [
          {
            label: "sinking fund accumulates exactly to the outstanding balance",
            ok: Math.abs(deposit * sinkingFactor - balance) < 1e-6 * balance,
          },
        ],
      };
    },
  },

  {
    id: "LOAN_DROP_PAYMENT",
    domain: "LOANS",
    title: "Final Drop Payment on a Loan with Fixed Instalments",
    objective:
      "Find how many full instalments a loan supports, carry the balance forward, then size the smaller final payment.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS", "TIME_VALUE"],
    steps: 3,
    generate: (rng) => {
      const loanAmount = rng.int(12, 40) * 5000;
      const i = rng.float(0.05, 0.09, 3);
      const nominalTerm = rng.int(12, 20);
      const basePayment = ActuarialMath.loanPayment(loanAmount, nominalTerm, i);
      const payment = Math.round(basePayment * rng.float(1.05, 1.18, 3));

      const exactTerm = -Math.log(1 - (loanAmount * i) / payment) / Math.log(1 + i);
      const fullPayments = Math.floor(exactTerm);

      const balance =
        loanAmount * Math.pow(1 + i, fullPayments) -
        payment * ActuarialMath.accumulatedAnnuityImmediate(fullPayments, i);
      const correctValue = balance * (1 + i);

      const balanceOnly = balance;
      const simpleRetrospective =
        (loanAmount * Math.pow(1 + i, fullPayments) - payment * fullPayments) * (1 + i);
      const prorated = payment * (exactTerm - fullPayments);
      const balloon = payment + balance;

      // Verification: the whole schedule must reproduce the original advance.
      const reconstructed =
        payment * ActuarialMath.annuityImmediate(fullPayments, i) +
        correctValue * Math.pow(1 + i, -(fullPayments + 1));

      return {
        questionText: `A loan of ${moneyInt(loanAmount)} is repaid with payments of ${moneyInt(payment)} at the end of each year for as many full payments as possible, followed by a smaller final payment one year after the last full payment. The annual effective interest rate is ${pct(i)}.
Calculate the amount of the final payment.`,
        variables: { loanAmount, payment, i, fullPayments },
        correctValue,
        distractors: [
          distractor(
            balanceOnly,
            "OFF_BY_ONE_PERIOD",
            `Reported the balance outstanding at time ${fullPayments}. The final payment is made one year later, so that balance must be carried forward one more year at ${pct(i)}.`
          ),
          distractor(
            simpleRetrospective,
            "SIMPLE_INTEREST_ERROR",
            `Subtracted ${fullPayments} undiscounted payments from the accumulated loan, using $L(1+i)^n - nR$ instead of the retrospective balance $L(1+i)^n - R\\,s_{\\overline{n}|i}$.`
          ),
          distractor(
            prorated,
            "CALCULATION_DISTRACTOR",
            `Prorated a regular payment over the fractional part of the exact term $t = ${num(exactTerm, 4)}$ years. The equation of value is not linear in time, so a fraction of a payment does not clear the balance.`
          ),
          distractor(
            balloon,
            "CALCULATION_DISTRACTOR",
            `Computed a balloon payment — the enlarged payment ${money(payment)} + ${money(balance)} that would settle the loan at time ${fullPayments} — rather than a drop payment made one year later.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — How many full payments does the loan support?**
$$v^{t} = 1 - \\frac{L \\cdot i}{R} = 1 - \\frac{(${mathInt(loanAmount)})(${i})}{${mathInt(payment)}} = ${rate(1 - (loanAmount * i) / payment, 4)}$$
$$t = \\frac{-\\ln(${rate(1 - (loanAmount * i) / payment, 4)})}{\\ln(1 + ${i})} = ${num(exactTerm, 4)} \\quad\\Longrightarrow\\quad ${fullPayments} \\text{ full payments}$$

**Step 2 — Balance immediately after payment ${fullPayments} (retrospective method).**
$$B_{${fullPayments}} = L(1+i)^{${fullPayments}} - R \\cdot s_{\\overline{${fullPayments}}|${i}}$$
$$= ${mathInt(loanAmount)}(${rate(Math.pow(1 + i, fullPayments), 4)}) - ${mathInt(payment)}(${num(ActuarialMath.accumulatedAnnuityImmediate(fullPayments, i), 4)}) = ${mathMoney(balance)}$$

**Step 3 — Carry that balance forward one year.**
$$\\text{Drop payment} = B_{${fullPayments}}(1 + ${i}) = ${mathNum(balance)} \\times ${rate(1 + i, 4)} = ${mathMoney(correctValue)}$$

**Verification —** the full schedule reproduces the advance:
$$R \\cdot a_{\\overline{${fullPayments}}|} + ${mathNum(correctValue)}\\,v^{${fullPayments + 1}} = ${mathMoney(reconstructed)}$$`,
        checks: [
          {
            label: "schedule reproduces the original loan amount",
            ok: Math.abs(reconstructed - loanAmount) < 1e-6 * loanAmount,
          },
          {
            label: "drop payment is positive and smaller than a full instalment",
            ok: correctValue > 0 && correctValue < payment,
          },
        ],
      };
    },
  },

  {
    id: "LOAN_RATE_RESET_REFINANCE",
    domain: "LOANS",
    title: "Total Interest on a Loan with a Mid-Term Rate Reset",
    objective:
      "Track a loan across a rate reset: original payment, balance at the reset, recalculated payment, and lifetime interest.",
    difficulty: 4,
    topics: ["LOAN_MECHANICS", "TIME_VALUE"],
    steps: 4,
    generate: (rng) => {
      const loanAmount = rng.int(15, 45) * 10000;
      const n = rng.int(15, 25);
      const k = rng.int(5, 9);
      const firstRate = rng.float(0.04, 0.06, 3);
      const secondRate = Number((firstRate + rng.float(0.015, 0.035, 3)).toFixed(4));

      const firstPayment = ActuarialMath.loanPayment(loanAmount, n, firstRate);
      const balance = firstPayment * ActuarialMath.annuityImmediate(n - k, firstRate);
      const secondPayment = balance / ActuarialMath.annuityImmediate(n - k, secondRate);

      const totalPaid = k * firstPayment + (n - k) * secondPayment;
      const correctValue = totalPaid - loanAmount;

      const noReset = n * firstPayment - loanAmount;
      const resetFromStart = n * ActuarialMath.loanPayment(loanAmount, n, secondRate) - loanAmount;
      const wrongRemainingTerm =
        k * firstPayment +
        (n - k) * (balance / ActuarialMath.annuityImmediate(n, secondRate)) -
        loanAmount;
      const totalPaidNotInterest = totalPaid;

      return {
        questionText: `A loan of ${moneyInt(loanAmount)} is to be repaid with ${n} level annual payments at an annual effective interest rate of ${pct(firstRate)}.
Immediately after the $${ordinal(k)}$ payment the interest rate resets to ${pct(secondRate)}. The payment is recalculated so that the loan is still fully repaid by the end of year ${n}.
Calculate the total interest paid over the life of the loan.`,
        variables: { loanAmount, n, k, firstRate, secondRate },
        correctValue,
        distractors: [
          distractor(
            noReset,
            "CALCULATION_DISTRACTOR",
            `Ignored the reset and totalled ${n} payments of ${money(firstPayment)} at the original rate.`
          ),
          distractor(
            resetFromStart,
            "NOMINAL_RATE_ERROR",
            `Applied the new rate ${pct(secondRate)} from inception. The first ${k} payments were fixed under the original ${pct(firstRate)} schedule and are unaffected by the reset.`
          ),
          distractor(
            wrongRemainingTerm,
            "OFF_BY_ONE_PERIOD",
            `Recalculated the new payment over ${n} years instead of the ${n - k} years that remain.`
          ),
          distractor(
            totalPaidNotInterest,
            "CALCULATION_DISTRACTOR",
            `Reported total payments of ${money(totalPaid)} without subtracting the ${money(loanAmount)} of principal.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Original level payment.**
$$R_1 = \\frac{${mathMoney(loanAmount, 0)}}{a_{\\overline{${n}}|${firstRate}}} = \\frac{${mathInt(loanAmount)}}{${num(ActuarialMath.annuityImmediate(n, firstRate), 4)}} = ${mathMoney(firstPayment)}$$

**Step 2 — Balance carried into the reset.**
$$B_{${k}} = R_1 \\cdot a_{\\overline{${n - k}}|${firstRate}} = ${mathNum(firstPayment)} \\times ${num(ActuarialMath.annuityImmediate(n - k, firstRate), 4)} = ${mathMoney(balance)}$$

**Step 3 — Recalculate the payment at the new rate over the remaining ${n - k} years.**
$$R_2 = \\frac{B_{${k}}}{a_{\\overline{${n - k}}|${secondRate}}} = \\frac{${mathNum(balance)}}{${num(ActuarialMath.annuityImmediate(n - k, secondRate), 4)}} = ${mathMoney(secondPayment)}$$

**Step 4 — Lifetime interest is total cash paid less principal.**
$$\\text{Total paid} = ${k}(${mathNum(firstPayment)}) + ${n - k}(${mathNum(secondPayment)}) = ${mathMoney(totalPaid)}$$
$$\\text{Interest} = ${mathNum(totalPaid)} - ${mathInt(loanAmount)} = ${mathMoney(correctValue)}$$`,
        checks: [
          {
            label: "recalculated payment discharges the reset balance",
            ok:
              Math.abs(
                secondPayment * ActuarialMath.annuityImmediate(n - k, secondRate) - balance
              ) <
              1e-6 * balance,
          },
          { label: "total interest is positive", ok: correctValue > 0 },
        ],
      };
    },
  },

  // ==========================================================================
  // BONDS
  // ==========================================================================
  {
    id: "BOND_SPOT_CURVE_TO_DURATION",
    domain: "BONDS",
    title: "Duration of a Bond Priced off a Non-Flat Spot Curve",
    objective:
      "Price a coupon bond along a term structure, extract its single yield to maturity, then measure duration at that yield.",
    difficulty: 3,
    topics: ["BONDS_AND_CURVES", "IMMUNIZATION"],
    steps: 3,
    generate: (rng) => {
      const par = 1000;
      const couponRate = rng.float(0.05, 0.09, 3);
      const base = rng.float(0.03, 0.05, 4);
      const slope = rng.float(0.004, 0.01, 4);
      const spots = [0, 1, 2].map((offset) => Number((base + slope * offset).toFixed(6)));
      const n = spots.length;

      const coupon = par * couponRate;
      const cashFlows = Array.from({ length: n }, (_, index) => ({
        t: index + 1,
        amount: index === n - 1 ? coupon + par : coupon,
      }));

      const price = ActuarialMath.presentValueAtSpots(cashFlows, spots);
      const ytm = ActuarialMath.levelYield(cashFlows, price);
      const correctValue = ActuarialMath.macaulayDuration(cashFlows, ytm);

      const atLongestSpot = ActuarialMath.macaulayDuration(cashFlows, spots[n - 1]);
      const undiscounted =
        cashFlows.reduce((total, cf) => total + cf.t * cf.amount, 0) /
        cashFlows.reduce((total, cf) => total + cf.amount, 0);
      const modified = correctValue / (1 + ytm);
      const maturity = n;

      return {
        questionText: `The annual effective spot rates are ${spots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
A ${n}-year bond with par value ${moneyInt(par)} pays annual coupons at an annual rate of ${pct(couponRate)} and is redeemable at par. It is priced consistently with the spot curve.
Calculate the Macaulay duration of the bond, in years, measured at its yield to maturity.`,
        variables: { par, couponRate, spots, price },
        correctValue,
        distractors: [
          distractor(
            atLongestSpot,
            "NOMINAL_RATE_ERROR",
            `Weighted the cash flows using the ${n}-year spot rate ${pct(spots[n - 1])} rather than the bond's own yield to maturity of ${pct(ytm)}.`
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            "Weighted the payment times by nominal cash flow amounts instead of by their present values."
          ),
          distractor(
            modified,
            "CALCULATION_DISTRACTOR",
            "Reported the modified duration $D_{\\text{mac}}/(1+y)$ rather than the Macaulay duration."
          ),
          distractor(
            maturity,
            "CALCULATION_DISTRACTOR",
            `Used the term to maturity of ${n} years, which equals duration only for a zero-coupon bond.`
          ),
        ],
        format: "YEARS",
        solutionSteps: `**Step 1 — Price each cash flow at its own spot rate.**
${cashFlows
  .map(
    (cf, index) =>
      `$$${mathNum(cf.amount)}\\,(1 + ${spots[index]})^{-${cf.t}} = ${mathNum(
        cf.amount * ActuarialMath.spotDiscountFactor(spots[index], cf.t)
      )}$$`
  )
  .join("\n")}
$$P = ${mathMoney(price)}$$

**Step 2 — Solve for the single yield reproducing that price.**
$$${mathNum(price)} = ${mathNum(coupon)}\\,a_{\\overline{${n}}|y} + ${mathInt(par)}(1+y)^{-${n}} \\quad\\Longrightarrow\\quad y = ${(ytm * 100).toFixed(4)}\\%$$

**Step 3 — Weight the payment times by present value at that yield.**
$$D_{\\text{mac}} = \\frac{\\sum t \\cdot C_t (1+y)^{-t}}{P} = \\frac{${mathNum(correctValue * price, 4)}}{${mathNum(price, 4)}} = ${correctValue.toFixed(4)} \\text{ years}$$`,
        checks: [
          {
            label: "re-pricing at the solved yield reproduces the spot-curve price",
            ok:
              Math.abs(
                cashFlows.reduce(
                  (total, cf) => total + cf.amount * Math.pow(1 + ytm, -cf.t),
                  0
                ) - price
              ) <
              1e-6 * price,
          },
          { label: "duration is shorter than maturity for a coupon bond", ok: correctValue < n },
        ],
      };
    },
  },

  {
    id: "BOND_FUND_TO_CALLABLE_YIELD",
    domain: "BONDS",
    title: "Guaranteed Yield on a Callable Bond Bought with an Accumulated Fund",
    objective:
      "Accumulate a semiannual savings stream, use it as the purchase price of a callable bond, and identify the yield the investor is guaranteed.",
    difficulty: 4,
    topics: ["TIME_VALUE", "BONDS_AND_CURVES"],
    steps: 4,
    generate: (rng) => {
      const halfYearDeposit = rng.int(10, 36) * 100;
      const savingYears = rng.int(6, 11);
      const nominalRate = rng.float(0.04, 0.075, 3);
      const periodicRate = nominalRate / 2;
      const periods = savingYears * 2;

      const fund = halfYearDeposit * ActuarialMath.accumulatedAnnuityImmediate(periods, periodicRate);

      const couponRate = rng.float(0.07, 0.095, 3);
      const premiumTarget = rng.float(1.05, 1.12, 3);
      const par = Math.floor(fund / premiumTarget / 1000) * 1000;
      const callYear = rng.int(5, 9);
      const maturityYear = callYear + rng.int(6, 11);

      const coupon = par * couponRate;
      const flowsTo = (redemptionYear: number) =>
        Array.from({ length: redemptionYear }, (_, index) => ({
          t: index + 1,
          amount: index === redemptionYear - 1 ? coupon + par : coupon,
        }));

      const yieldIfCalled = ActuarialMath.levelYield(flowsTo(callYear), fund);
      const yieldIfHeld = ActuarialMath.levelYield(flowsTo(maturityYear), fund);
      const correctValue = Math.min(yieldIfCalled, yieldIfHeld);

      const currentYield = coupon / fund;
      const lateCall = ActuarialMath.levelYield(flowsTo(callYear + 1), fund);

      return {
        questionText: `An investor deposits ${moneyInt(halfYearDeposit)} at the end of every six months for ${savingYears} years into an account earning a nominal annual rate of ${pct(nominalRate)} compounded semiannually.
The accumulated balance is used, in full, to buy a bond with par value ${moneyInt(par)} paying annual coupons at an annual rate of ${pct(couponRate)}. The bond is redeemable at par, callable at par at the end of year ${callYear} or on any coupon date thereafter, and matures at the end of year ${maturityYear}.
Calculate the annual effective yield rate the investor is guaranteed to earn.`,
        variables: {
          halfYearDeposit,
          savingYears,
          nominalRate,
          par,
          couponRate,
          callYear,
          maturityYear,
        },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            Math.max(yieldIfCalled, yieldIfHeld) * 100,
            "CALCULATION_DISTRACTOR",
            `Assumed the bond runs to maturity in year ${maturityYear}. The issuer chooses when to call, so the guaranteed yield is the *lowest* outcome across all redemption dates.`
          ),
          distractor(
            couponRate * 100,
            "NOMINAL_RATE_ERROR",
            `Took the yield to equal the coupon rate ${pct(couponRate)}. That holds only at par, and the fund of ${money(fund)} buys ${moneyInt(par)} of par — a premium.`
          ),
          distractor(
            currentYield * 100,
            "CALCULATION_DISTRACTOR",
            "Reported the current yield, coupon divided by price, which ignores the capital loss suffered when a premium bond redeems at par."
          ),
          distractor(
            lateCall * 100,
            "OFF_BY_ONE_PERIOD",
            `Priced the earliest call at the end of year ${callYear + 1} instead of year ${callYear}.`
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Accumulate the savings stream.**
$$j = \\frac{${nominalRate}}{2} = ${rate(periodicRate, 4)}, \\qquad n = ${savingYears} \\times 2 = ${periods}$$
$$AV = ${mathInt(halfYearDeposit)} \\cdot s_{\\overline{${periods}}|j} = ${mathInt(halfYearDeposit)} \\times ${num(
          ActuarialMath.accumulatedAnnuityImmediate(periods, periodicRate),
          4
        )} = ${mathMoney(fund)}$$

**Step 2 — Establish the purchase terms.**
The fund buys ${moneyInt(par)} of par at a price of ${money(fund)}, so the bond is bought at a **premium** of ${money(fund - par)}. Annual coupon:
$$Fr = ${mathInt(par)} \\times ${couponRate} = ${mathMoney(coupon)}$$

**Step 3 — Yield if the bond is called at the earliest date, year ${callYear}.**
$$${mathNum(fund)} = ${mathNum(coupon)}\\,a_{\\overline{${callYear}}|y} + ${mathInt(par)}(1+y)^{-${callYear}} \\quad\\Longrightarrow\\quad y = ${(yieldIfCalled * 100).toFixed(4)}\\%$$

**Step 4 — Yield if the bond runs to maturity, year ${maturityYear}.**
$$y = ${(yieldIfHeld * 100).toFixed(4)}\\%$$
Because the bond was bought at a premium, the earliest call gives the lower return. The issuer controls the call, so the investor is guaranteed only
$$y_{\\min} = ${(correctValue * 100).toFixed(2)}\\%$$`,
        checks: [
          {
            label: "premium purchase, so the earliest call is the worst case",
            ok: fund > par && yieldIfCalled <= yieldIfHeld,
          },
          {
            label: "re-pricing at the guaranteed yield reproduces the fund",
            ok:
              Math.abs(
                flowsTo(callYear).reduce(
                  (total, cf) => total + cf.amount * Math.pow(1 + yieldIfCalled, -cf.t),
                  0
                ) - fund
              ) <
              1e-6 * fund,
          },
        ],
      };
    },
  },

  // ==========================================================================
  // ASSET-LIABILITY MANAGEMENT
  // ==========================================================================
  {
    id: "SWAP_DEFERRED_RATE",
    domain: "ALM_IMMUNIZATION",
    title: "Par Rate on a Deferred Interest Rate Swap",
    objective:
      "Build discount factors from a spot curve and price the fixed leg of a swap whose settlements begin in a later year.",
    difficulty: 3,
    topics: ["SWAPS", "BONDS_AND_CURVES"],
    steps: 3,
    generate: (rng) => {
      const base = rng.float(0.025, 0.04, 4);
      const slope = rng.float(0.004, 0.009, 4);
      const spots = [0, 1, 2, 3].map((offset) => Number((base + slope * offset).toFixed(6)));
      const factors = ActuarialMath.spotDiscountFactors(spots);

      const deferredAnnuity = factors[1] + factors[2] + factors[3];
      const correctValue = (factors[0] - factors[3]) / deferredAnnuity;

      const spotSwapRate = ActuarialMath.swapRate(factors);
      const numeratorNotDeferred = (1 - factors[3]) / deferredAnnuity;
      const forwardAverage =
        (ActuarialMath.forwardRate(spots, 1, 2) +
          ActuarialMath.forwardRate(spots, 2, 3) +
          ActuarialMath.forwardRate(spots, 3, 4)) /
        3;

      return {
        questionText: `The annual effective spot rates are ${spots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
A company enters an interest rate swap deferred one year: settlements occur at the end of years 2, 3 and 4, with no settlement at the end of year 1.
Calculate the par swap rate on this deferred swap.`,
        variables: { spots },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            spotSwapRate * 100,
            "CALCULATION_DISTRACTOR",
            "Priced a standard four-year swap starting immediately, $\\frac{1 - P(0,4)}{\\sum_{t=1}^{4} P(0,t)}$, rather than one whose first settlement is at time 2."
          ),
          distractor(
            numeratorNotDeferred * 100,
            "OFF_BY_ONE_PERIOD",
            "Deferred the denominator but not the numerator. The floating leg of a deferred swap is worth $P(0,1) - P(0,4)$, not $1 - P(0,4)$, because no exchange occurs at time 1."
          ),
          distractor(
            forwardAverage * 100,
            "SIMPLE_INTEREST_ERROR",
            "Took the arithmetic mean of the one-year forward rates. The par rate is a discount-factor weighted average, so later forwards carry less weight."
          ),
          distractor(
            spots[3] * 100,
            "NOMINAL_RATE_ERROR",
            `Used the four-year spot rate ${pct(spots[3])} as the swap rate.`
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Build the discount factors.**
${spots
  .map(
    (spot, index) =>
      `$$P(0,${index + 1}) = (1 + ${spot})^{-${index + 1}} = ${rate(factors[index], 4)}$$`
  )
  .join("\n")}

**Step 2 — Value the floating leg over the settlement window.**
A floating leg running from time 1 to time 4 is worth the difference of the two endpoint discount factors:
$$PV_{\\text{float}} = P(0,1) - P(0,4) = ${rate(factors[0], 4)} - ${rate(factors[3], 4)} = ${rate(factors[0] - factors[3], 4)}$$

**Step 3 — Divide by the annuity of the settlement dates.**
$$\\sum_{t=2}^{4} P(0,t) = ${rate(factors[1], 4)} + ${rate(factors[2], 4)} + ${rate(factors[3], 4)} = ${rate(deferredAnnuity, 4)}$$
$$R = \\frac{${rate(factors[0] - factors[3], 4)}}{${rate(deferredAnnuity, 4)}} = ${(correctValue * 100).toFixed(2)}\\%$$`,
        checks: [
          {
            label: "fixed leg prices to the floating leg",
            ok: Math.abs(correctValue * deferredAnnuity - (factors[0] - factors[3])) < 1e-12,
          },
          {
            label: "deferred rate exceeds the immediate swap rate on a rising curve",
            ok: correctValue > spotSwapRate,
          },
        ],
      };
    },
  },

  {
    id: "SWAP_MARKET_VALUE",
    domain: "ALM_IMMUNIZATION",
    title: "Market Value of a Seasoned Interest Rate Swap",
    objective:
      "Derive the original swap rate, re-price the remaining settlements on a shifted curve, and value the position.",
    difficulty: 4,
    topics: ["SWAPS", "BONDS_AND_CURVES"],
    steps: 4,
    generate: (rng) => {
      const notional = rng.int(2, 10) * 500000;

      const baseOriginal = rng.float(0.045, 0.065, 4);
      const slopeOriginal = rng.float(0.003, 0.008, 4);
      const originalSpots = [0, 1, 2, 3].map((offset) =>
        Number((baseOriginal + slopeOriginal * offset).toFixed(6))
      );
      const originalFactors = ActuarialMath.spotDiscountFactors(originalSpots);
      const originalRate = ActuarialMath.swapRate(originalFactors);

      const drop = rng.float(0.012, 0.025, 4);
      const currentSpots = [0, 1, 2].map((offset) =>
        Number((baseOriginal - drop + slopeOriginal * offset).toFixed(6))
      );
      const currentFactors = ActuarialMath.spotDiscountFactors(currentSpots);
      const currentAnnuity = currentFactors.reduce((total, factor) => total + factor, 0);
      const currentRate = ActuarialMath.swapRate(currentFactors);

      const correctValue = notional * (originalRate - currentRate) * currentAnnuity;

      const noAnnuity = notional * (originalRate - currentRate);
      const originalAnnuity = originalFactors.reduce((total, factor) => total + factor, 0);
      const wrongCurve = notional * (originalRate - currentRate) * originalAnnuity;
      const againstSpot =
        notional * (originalRate - currentSpots[2]) * currentAnnuity;
      const undiscountedCount = notional * (originalRate - currentRate) * currentFactors.length;

      return {
        questionText: `One year ago a company entered a four-year interest rate swap on a notional of ${moneyInt(notional)}, with annual settlements, as the **fixed-rate receiver**. The swap was priced at the market rate implied by the then-current spot curve ${originalSpots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
Three settlements remain. The spot curve today is ${currentSpots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
Calculate the current market value of the swap to the company.`,
        variables: { notional, originalSpots, currentSpots, originalRate, currentRate },
        correctValue,
        distractors: [
          distractor(
            noAnnuity,
            "CALCULATION_DISTRACTOR",
            "Valued a single year's rate advantage and stopped. The advantage is received at each of the three remaining settlements, so it must be multiplied by the annuity of the remaining discount factors."
          ),
          distractor(
            wrongCurve,
            "NOMINAL_RATE_ERROR",
            "Discounted the remaining settlements with the original curve. A seasoned swap must be marked to market on today's curve."
          ),
          distractor(
            againstSpot,
            "CALCULATION_DISTRACTOR",
            `Compared the contract rate with the three-year spot rate ${pct(currentSpots[2])} instead of with today's three-year par swap rate ${pct(currentRate)}.`
          ),
          distractor(
            undiscountedCount,
            "SIMPLE_INTEREST_ERROR",
            "Multiplied by the number of remaining settlements rather than by the sum of their discount factors, ignoring the time value of the future receipts."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Recover the contract rate from the original curve.**
$$P(0,t) = ${originalFactors.map((factor) => rate(factor, 4)).join(",\\; ")}$$
$$R_0 = \\frac{1 - ${rate(originalFactors[3], 4)}}{${rate(originalAnnuity, 4)}} = ${(originalRate * 100).toFixed(4)}\\%$$

**Step 2 — Build today's discount factors for the three remaining settlements.**
${currentSpots
  .map(
    (spot, index) =>
      `$$P'(0,${index + 1}) = (1 + ${spot})^{-${index + 1}} = ${rate(currentFactors[index], 4)}$$`
  )
  .join("\n")}
$$\\sum P'(0,t) = ${rate(currentAnnuity, 4)}$$

**Step 3 — Today's par rate for a three-year swap.**
$$R_1 = \\frac{1 - ${rate(currentFactors[2], 4)}}{${rate(currentAnnuity, 4)}} = ${(currentRate * 100).toFixed(4)}\\%$$

**Step 4 — Value the rate advantage to the fixed-rate receiver.**
The company receives ${pct(originalRate)} where the market now pays ${pct(currentRate)}, an advantage of ${pct(originalRate - currentRate)} on the notional at each remaining settlement:
$$MV = ${mathInt(notional)} \\times ${rate(originalRate - currentRate, 4)} \\times ${rate(currentAnnuity, 4)} = ${mathMoney(correctValue)}$$`,
        checks: [
          {
            label: "original swap rate prices the original curve to par",
            ok:
              Math.abs(originalRate * originalAnnuity - (1 - originalFactors[3])) < 1e-12,
          },
          {
            label: "rates fell, so the fixed receiver is in the money",
            ok: originalRate > currentRate && correctValue > 0,
          },
        ],
      };
    },
  },

  {
    id: "ALM_LIABILITY_ANNUITY_IMMUNIZATION",
    domain: "ALM_IMMUNIZATION",
    title: "Immunizing an Annuity Liability with Two Zero-Coupon Bonds",
    objective:
      "Value and measure the duration of a multi-payment liability, then split the asset portfolio to match both.",
    difficulty: 4,
    topics: ["IMMUNIZATION", "TIME_VALUE"],
    steps: 4,
    generate: (rng) => {
      const annualLiability = rng.int(4, 14) * 10000;
      const n = rng.int(12, 20);
      const i = rng.float(0.045, 0.08, 3);

      const annuityFactor = ActuarialMath.annuityImmediate(n, i);
      const increasingFactor = ActuarialMath.increasingAnnuityImmediate(n, i);
      const liabilityPv = annualLiability * annuityFactor;
      const liabilityDuration = increasingFactor / annuityFactor;

      const shortMaturity = Math.max(1, Math.floor(liabilityDuration) - rng.int(2, 4));
      const longMaturity = Math.ceil(liabilityDuration) + rng.int(2, 6);

      const shortPv =
        (liabilityPv * (longMaturity - liabilityDuration)) / (longMaturity - shortMaturity);
      const longPv = liabilityPv - shortPv;
      const correctValue = longPv * Math.pow(1 + i, longMaturity);

      const shortFace = shortPv * Math.pow(1 + i, shortMaturity);
      const notAccumulated = longPv;
      const simpleDurationPv =
        liabilityPv -
        (liabilityPv * (longMaturity - (n + 1) / 2)) / (longMaturity - shortMaturity);
      const simpleDuration = simpleDurationPv * Math.pow(1 + i, longMaturity);
      const equalSplit = (liabilityPv / 2) * Math.pow(1 + i, longMaturity);

      return {
        questionText: `An insurer owes ${moneyInt(annualLiability)} at the end of each year for the next ${n} years. The annual effective interest rate is ${pct(i)} at all maturities.
The insurer immunizes the liability with two zero-coupon bonds maturing at $t = ${shortMaturity}$ and $t = ${longMaturity}$, matching both the present value and the Macaulay duration of the liability.
Calculate the maturity value of the bond maturing at $t = ${longMaturity}$.`,
        variables: { annualLiability, n, i, shortMaturity, longMaturity },
        correctValue,
        distractors: [
          distractor(
            shortFace,
            "CALCULATION_DISTRACTOR",
            `Computed the maturity value of the $t = ${shortMaturity}$ bond instead of the $t = ${longMaturity}$ bond.`
          ),
          distractor(
            notAccumulated,
            "CALCULATION_DISTRACTOR",
            `Stopped at the present value of the long asset. A zero-coupon bond's maturity value is that present value accumulated ${longMaturity} years at ${pct(i)}.`
          ),
          distractor(
            simpleDuration,
            "SIMPLE_INTEREST_ERROR",
            `Used the undiscounted average payment time $\\frac{n+1}{2} = ${num((n + 1) / 2)}$ years as the liability duration instead of the present-value weighted ${num(liabilityDuration)} years.`
          ),
          distractor(
            equalSplit,
            "NOMINAL_RATE_ERROR",
            "Split the present value equally between the two bonds. The split is fixed by the duration-matching condition, not by symmetry."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Present value of the liability stream.**
$$a_{\\overline{${n}}|${i}} = ${num(annuityFactor, 4)} \\quad\\Longrightarrow\\quad PV_L = ${mathInt(annualLiability)} \\times ${num(annuityFactor, 4)} = ${mathMoney(liabilityPv)}$$

**Step 2 — Macaulay duration of the liability.**
$$D_L = \\frac{(Ia)_{\\overline{${n}}|}}{a_{\\overline{${n}}|}} = \\frac{${num(increasingFactor, 4)}}{${num(annuityFactor, 4)}} = ${num(liabilityDuration, 4)} \\text{ years}$$

**Step 3 — Split the present value so the asset duration matches.**
$$PV_A(${shortMaturity}) = PV_L \\cdot \\frac{${longMaturity} - ${num(liabilityDuration, 4)}}{${longMaturity} - ${shortMaturity}} = ${mathMoney(shortPv)}$$
$$PV_A(${longMaturity}) = ${mathNum(liabilityPv)} - ${mathNum(shortPv)} = ${mathMoney(longPv)}$$

**Step 4 — Accumulate the long asset to its maturity date.**
$$A_{${longMaturity}} = ${mathNum(longPv)} \\times (1 + ${i})^{${longMaturity}} = ${mathMoney(correctValue)}$$`,
        checks: [
          {
            label: "asset present value matches the liability",
            ok: Math.abs(shortPv + longPv - liabilityPv) < 1e-6 * liabilityPv,
          },
          {
            label: "asset duration matches the liability duration",
            ok:
              Math.abs(
                shortMaturity * shortPv + longMaturity * longPv - liabilityDuration * liabilityPv
              ) <
              1e-6 * liabilityPv * Math.max(1, liabilityDuration),
          },
          {
            label: "liability duration is straddled by the two maturities",
            ok: shortMaturity < liabilityDuration && liabilityDuration < longMaturity,
          },
        ],
      };
    },
  },

  // ==========================================================================
  // Archetypes calibrated against the SOA Exam FM sample question set:
  // determinants of interest rates, reinvestment yields, second-order price
  // approximation, and swaps on an amortizing notional.
  // ==========================================================================
  {
    id: "TVM_REAL_ACCUMULATION",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Real Value of a Savings Stream under Inflation",
    objective:
      "Accumulate deposits at the nominal rate, then restate the fund in the purchasing power of the deposit date.",
    difficulty: 3,
    topics: ["TIME_VALUE", "RATE_DETERMINANTS"],
    steps: 3,
    generate: (rng) => {
      const deposit = rng.int(15, 60) * 100;
      const n = rng.int(10, 22);
      const nominal = rng.float(0.05, 0.09, 3);
      const inflation = rng.float(0.018, 0.038, 3);

      const accumulationFactor = ActuarialMath.accumulatedAnnuityImmediate(n, nominal);
      const nominalValue = deposit * accumulationFactor;
      const deflator = Math.pow(1 + inflation, -n);
      const correctValue = nominalValue * deflator;

      const realRate = (1 + nominal) / (1 + inflation) - 1;
      const noDeflation = nominalValue;
      const realRateOnDeposits = deposit * ActuarialMath.accumulatedAnnuityImmediate(n, realRate);
      const subtractedRates =
        deposit * ActuarialMath.accumulatedAnnuityImmediate(n, nominal - inflation);
      const linearDeflator = nominalValue * (1 - inflation * n);

      return {
        questionText: `A saver deposits ${moneyInt(deposit)} at the end of each year for ${n} years into an account earning an annual effective interest rate of ${pct(nominal)}. Over the same period the annual rate of inflation is ${pct(inflation)}.
Calculate the accumulated value of the account at the end of year ${n}, expressed in the purchasing power of money at time $t = 0$.`,
        variables: { deposit, n, nominal, inflation },
        correctValue,
        distractors: [
          distractor(
            noDeflation,
            "CALCULATION_DISTRACTOR",
            `Reported the nominal fund of ${money(nominalValue)} without restating it in time-0 purchasing power.`
          ),
          distractor(
            realRateOnDeposits,
            "NOMINAL_RATE_ERROR",
            `Accumulated the deposits at the real rate ${pct(realRate)}. The deposits themselves are nominal amounts, so they must accumulate at the nominal rate and the *fund* is then deflated once.`
          ),
          distractor(
            subtractedRates,
            "SIMPLE_INTEREST_ERROR",
            `Approximated the real rate by subtraction, $i - \\pi = ${mathPct(nominal - inflation)}$, instead of the exact Fisher relation $\\frac{1+i}{1+\\pi} - 1 = ${mathPct(realRate)}$.`
          ),
          distractor(
            linearDeflator,
            "SIMPLE_INTEREST_ERROR",
            `Deflated linearly by $1 - \\pi n$ rather than compounding the price level by $(1+\\pi)^{${n}}$.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Accumulate the deposits at the nominal rate.**
$$s_{\\overline{${n}}|${nominal}} = ${num(accumulationFactor, 4)} \\quad\\Longrightarrow\\quad AV = ${mathMoney(deposit, 0)} \\times ${num(accumulationFactor, 4)} = ${mathMoney(nominalValue)}$$

**Step 2 — Build the price-level deflator.**
Prices at time ${n} stand at $(1 + ${inflation})^{${n}} = ${rate(Math.pow(1 + inflation, n), 4)}$ times their time-0 level, so
$$\\text{deflator} = (1 + ${inflation})^{-${n}} = ${rate(deflator, 4)}$$

**Step 3 — Restate the fund in time-0 purchasing power.**
$$AV_{\\text{real}} = ${mathNum(nominalValue)} \\times ${rate(deflator, 4)} = ${mathMoney(correctValue)}$$

Equivalently, the real rate is $\\frac{1 + ${nominal}}{1 + ${inflation}} - 1 = ${mathPct(realRate)}$, but note that discounting the *fund* once is not the same as accumulating the deposits at that real rate.`,
        checks: [
          {
            label: "deflating the nominal fund is not the same as accumulating at the real rate",
            ok: Math.abs(correctValue - realRateOnDeposits) > 1e-6,
          },
          { label: "real value is below the nominal value", ok: correctValue < nominalValue },
        ],
      };
    },
  },

  {
    id: "ANNUITY_REINVESTMENT_YIELD",
    domain: "ANNUITIES",
    title: "Overall Yield when Payments are Reinvested at a Different Rate",
    objective:
      "Accumulate a payment stream at the reinvestment rate, then solve the equation of value for the investor's realised yield.",
    difficulty: 3,
    topics: ["TIME_VALUE", "BONDS_AND_CURVES"],
    steps: 3,
    generate: (rng) => {
      const price = rng.int(20, 70) * 1000;
      const n = rng.int(8, 16);
      const couponRate = rng.float(0.06, 0.1, 3);
      const reinvestRate = rng.float(0.025, 0.05, 3);

      const payment = Math.round(price * couponRate);
      const accumulated =
        payment * ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate) + price;
      const correctValue = Math.pow(accumulated / price, 1 / n) - 1;

      const noReinvestment = couponRate;
      const reinvestAtOwnRate =
        Math.pow(
          (payment * ActuarialMath.accumulatedAnnuityImmediate(n, couponRate) + price) / price,
          1 / n
        ) - 1;
      const forgotRedemption =
        Math.pow((payment * ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate)) / price, 1 / n) - 1;
      const simpleAverage = (couponRate + reinvestRate) / 2;

      return {
        questionText: `An investor pays ${moneyInt(price)} for a ${n}-year investment that pays ${moneyInt(payment)} at the end of each year and returns the original ${moneyInt(price)} at the end of year ${n}.
Each annual payment is immediately reinvested in an account earning an annual effective rate of ${pct(reinvestRate)}.
Calculate the investor's annual effective yield over the ${n}-year period.`,
        variables: { price, n, couponRate, reinvestRate, payment },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            noReinvestment * 100,
            "CALCULATION_DISTRACTOR",
            `Reported the ${pct(couponRate)} paid by the investment itself. That is only the realised yield if every payment can be reinvested at ${pct(couponRate)}; here they earn ${pct(reinvestRate)}.`
          ),
          distractor(
            reinvestAtOwnRate * 100,
            "NOMINAL_RATE_ERROR",
            `Accumulated the payments at the investment's own rate ${pct(couponRate)} rather than the reinvestment rate ${pct(reinvestRate)}.`
          ),
          distractor(
            forgotRedemption * 100,
            "CALCULATION_DISTRACTOR",
            `Omitted the ${moneyInt(price)} returned at maturity from the time-${n} accumulated value.`
          ),
          distractor(
            simpleAverage * 100,
            "SIMPLE_INTEREST_ERROR",
            "Averaged the two rates. The realised yield is set by the accumulated value, in which the returned principal earns no reinvestment interest at all."
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Accumulate the reinvested payments to time ${n}.**
$$s_{\\overline{${n}}|${reinvestRate}} = ${num(ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate), 4)}$$
$$${mathInt(payment)} \\times ${num(ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate), 4)} = ${mathMoney(payment * ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate))}$$

**Step 2 — Add the principal returned at maturity.**
$$AV = ${mathNum(payment * ActuarialMath.accumulatedAnnuityImmediate(n, reinvestRate))} + ${mathInt(price)} = ${mathMoney(accumulated)}$$

**Step 3 — Solve the equation of value over the whole period.**
$$${mathInt(price)}\\,(1 + i)^{${n}} = ${mathNum(accumulated)} \\quad\\Longrightarrow\\quad i = \\left(\\frac{${mathNum(accumulated)}}{${mathInt(price)}}\\right)^{1/${n}} - 1$$
$$i = ${(correctValue * 100).toFixed(2)}\\%$$

The realised yield sits below the ${pct(couponRate)} the investment pays, because each payment can only be reinvested at ${pct(reinvestRate)}.`,
        checks: [
          {
            label: "equation of value balances at the solved yield",
            ok: Math.abs(price * Math.pow(1 + correctValue, n) - accumulated) < 1e-6 * accumulated,
          },
          {
            label: "realised yield lies between the reinvestment rate and the payment rate",
            ok: correctValue > reinvestRate && correctValue < couponRate,
          },
        ],
      };
    },
  },

  {
    id: "ALM_SECOND_ORDER_PRICE_CHANGE",
    domain: "ALM_IMMUNIZATION",
    title: "Second-Order Price Approximation with Duration and Convexity",
    objective:
      "Derive modified duration and modified convexity from a bond's cash flows, then apply the two-term Taylor approximation.",
    difficulty: 3,
    topics: ["IMMUNIZATION", "BONDS_AND_CURVES"],
    steps: 3,
    generate: (rng) => {
      const par = 1000;
      const n = rng.int(8, 18);
      const couponRate = rng.float(0.04, 0.08, 3);
      const yieldRate = rng.float(0.035, 0.075, 3);
      const basisPoints = rng.choice([75, 100, 125, 150]);
      const shift = basisPoints / 10000;

      const coupon = par * couponRate;
      const cashFlows = Array.from({ length: n }, (_, index) => ({
        t: index + 1,
        amount: index === n - 1 ? coupon + par : coupon,
      }));

      const price = cashFlows.reduce(
        (total, cf) => total + cf.amount * Math.pow(1 + yieldRate, -cf.t),
        0
      );
      const macaulay = ActuarialMath.macaulayDuration(cashFlows, yieldRate);
      const modifiedDuration = macaulay / (1 + yieldRate);
      const modifiedConvexity = ActuarialMath.modifiedConvexity(cashFlows, yieldRate);

      const firstOrderTerm = -modifiedDuration * shift;
      const secondOrderTerm = 0.5 * modifiedConvexity * shift * shift;
      const correctValue = price * (1 + firstOrderTerm + secondOrderTerm);

      const firstOrderOnly = price * (1 + firstOrderTerm);
      const convexitySignError = price * (1 + firstOrderTerm - secondOrderTerm);
      const macaulayInstead =
        price * (1 - macaulay * shift + 0.5 * modifiedConvexity * shift * shift);
      const noHalf = price * (1 + firstOrderTerm + modifiedConvexity * shift * shift);

      const exactPrice = cashFlows.reduce(
        (total, cf) => total + cf.amount * Math.pow(1 + yieldRate + shift, -cf.t),
        0
      );

      return {
        questionText: `A ${n}-year bond with par value ${moneyInt(par)} pays annual coupons at an annual rate of ${pct(couponRate)} and is redeemable at par. It is priced at an annual effective yield of ${pct(yieldRate)}.
The yield rises by ${basisPoints} basis points.
Using the second-order approximation based on modified duration and modified convexity, estimate the new price of the bond.`,
        variables: { par, n, couponRate, yieldRate, basisPoints, price },
        correctValue,
        distractors: [
          distractor(
            firstOrderOnly,
            "CALCULATION_DISTRACTOR",
            "Stopped at the first-order term. Convexity is positive for an ordinary bond, so the duration-only estimate always understates the price after a yield rise."
          ),
          distractor(
            convexitySignError,
            "CALCULATION_DISTRACTOR",
            "Subtracted the convexity term. The second-order term $\\tfrac{1}{2}C_{\\text{mod}}(\\Delta y)^2$ is positive whichever way the yield moves, because $(\\Delta y)^2 > 0$."
          ),
          distractor(
            macaulayInstead,
            "NOMINAL_RATE_ERROR",
            `Used the Macaulay duration ${num(macaulay)} in the first-order term where the modified duration ${num(modifiedDuration)} is required.`
          ),
          distractor(
            noHalf,
            "SIMPLE_INTEREST_ERROR",
            "Omitted the factor of one half on the convexity term, which comes from the second term of the Taylor expansion."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Price the bond and measure its duration.**
$$P = ${mathMoney(price)}, \\qquad D_{\\text{mac}} = ${num(macaulay, 4)} \\text{ years}$$
$$D_{\\text{mod}} = \\frac{D_{\\text{mac}}}{1 + y} = \\frac{${num(macaulay, 4)}}{${rate(1 + yieldRate, 4)}} = ${num(modifiedDuration, 4)}$$

**Step 2 — Measure modified convexity.**
$$C_{\\text{mod}} = \\frac{\\sum t(t+1) C_t v^{\\,t+2}}{P} = ${num(modifiedConvexity, 4)}$$

**Step 3 — Apply the two-term expansion at $\\Delta y = ${rate(shift, 4)}$.**
$$\\frac{\\Delta P}{P} \\approx -D_{\\text{mod}} \\Delta y + \\tfrac{1}{2} C_{\\text{mod}} (\\Delta y)^2 = ${rate(firstOrderTerm, 6)} + ${rate(secondOrderTerm, 6)}$$
$$P_{\\text{new}} \\approx ${mathNum(price)} \\times \\left(1 ${rate(firstOrderTerm + secondOrderTerm, 6)}\\right) = ${mathMoney(correctValue)}$$

Repricing exactly at ${pct(yieldRate + shift)} gives ${money(exactPrice)}; the convexity term closes most of the gap the duration-only estimate of ${money(firstOrderOnly)} leaves open.`,
        checks: [
          {
            label: "second-order estimate beats the first-order estimate",
            ok: Math.abs(correctValue - exactPrice) < Math.abs(firstOrderOnly - exactPrice),
          },
          {
            label: "convexity term is positive",
            ok: secondOrderTerm > 0,
          },
        ],
      };
    },
  },

  {
    id: "SWAP_AMORTIZING_NOTIONAL",
    domain: "ALM_IMMUNIZATION",
    title: "Swap Rate on an Amortizing Notional",
    objective:
      "Build a declining notional schedule from a loan repayment plan and weight the swap's par condition by it.",
    difficulty: 4,
    topics: ["SWAPS", "LOAN_MECHANICS"],
    steps: 4,
    generate: (rng) => {
      const principal = rng.int(2, 8) * 100000;
      const n = 4;
      const base = rng.float(0.026, 0.042, 4);
      const slope = rng.float(0.003, 0.008, 4);
      const spots = Array.from({ length: n }, (_, index) =>
        Number((base + slope * index).toFixed(6))
      );
      const factors = ActuarialMath.spotDiscountFactors(spots);

      const repayment = principal / n;
      // Notional in force during year t is the balance outstanding at its start.
      const notionals = Array.from({ length: n }, (_, index) => principal - index * repayment);

      let numerator = 0;
      let denominator = 0;
      for (let t = 1; t <= n; t += 1) {
        const previousFactor = t === 1 ? 1 : factors[t - 2];
        numerator += notionals[t - 1] * (previousFactor - factors[t - 1]);
        denominator += notionals[t - 1] * factors[t - 1];
      }
      const correctValue = numerator / denominator;

      const levelNotionalRate = ActuarialMath.swapRate(factors);

      let endOfYearNumerator = 0;
      let endOfYearDenominator = 0;
      for (let t = 1; t <= n; t += 1) {
        const balanceAfter = principal - t * repayment;
        const previousFactor = t === 1 ? 1 : factors[t - 2];
        endOfYearNumerator += balanceAfter * (previousFactor - factors[t - 1]);
        endOfYearDenominator += balanceAfter * factors[t - 1];
      }
      const endOfYearNotional =
        endOfYearDenominator === 0 ? levelNotionalRate : endOfYearNumerator / endOfYearDenominator;

      let undiscountedNumerator = 0;
      let undiscountedDenominator = 0;
      for (let t = 1; t <= n; t += 1) {
        undiscountedNumerator += notionals[t - 1] * ActuarialMath.forwardRate(spots, t - 1, t);
        undiscountedDenominator += notionals[t - 1];
      }
      const notionalWeightedAverage = undiscountedNumerator / undiscountedDenominator;

      const longestSpot = spots[n - 1];

      // A level notional must reproduce the ordinary par swap rate.
      let levelCheckNumerator = 0;
      let levelCheckDenominator = 0;
      for (let t = 1; t <= n; t += 1) {
        const previousFactor = t === 1 ? 1 : factors[t - 2];
        levelCheckNumerator += previousFactor - factors[t - 1];
        levelCheckDenominator += factors[t - 1];
      }
      const levelCheck = levelCheckNumerator / levelCheckDenominator;

      return {
        questionText: `A company borrows ${moneyInt(principal)} and repays the principal in ${n} equal instalments of ${moneyInt(repayment)} at the end of each year, paying floating interest annually on the balance outstanding at the start of each year.
To fix its interest cost the company enters an interest rate swap whose notional in each year equals that outstanding balance.
The annual effective spot rates are ${spots
          .map((spot, index) => `$s_{${index + 1}} = ${mathPct(spot)}$`)
          .join(", ")}.
Calculate the swap rate.`,
        variables: { principal, n, spots, notionals },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            levelNotionalRate * 100,
            "CALCULATION_DISTRACTOR",
            `Priced a level-notional swap, $\\frac{1 - P(0,${n})}{\\sum P(0,t)}$. An amortizing swap weights each year by the notional in force, which shifts weight onto the early years.`
          ),
          distractor(
            endOfYearNotional * 100,
            "OFF_BY_ONE_PERIOD",
            "Used the balance outstanding at the *end* of each year. Interest for year $t$ accrues on the balance carried into the year, not the one left after the repayment."
          ),
          distractor(
            notionalWeightedAverage * 100,
            "SIMPLE_INTEREST_ERROR",
            "Took a notional-weighted average of the forward rates without discounting. The par condition weights by $Q_t P(0,t)$, so later years count for less."
          ),
          distractor(
            longestSpot * 100,
            "NOMINAL_RATE_ERROR",
            `Used the ${n}-year spot rate ${pct(longestSpot)} as the swap rate.`
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Discount factors from the spot curve.**
${spots
  .map(
    (spot, index) =>
      `$$P(0,${index + 1}) = (1 + ${spot})^{-${index + 1}} = ${rate(factors[index], 4)}$$`
  )
  .join("\n")}

**Step 2 — Notional in force each year.**
The swap covers the balance carried into each year:
$$Q_1 = ${mathInt(notionals[0])},\\quad Q_2 = ${mathInt(notionals[1])},\\quad Q_3 = ${mathInt(notionals[2])},\\quad Q_4 = ${mathInt(notionals[3])}$$

**Step 3 — Value each leg.**
The floating payment in year $t$ has present value $Q_t\\left[P(0,t-1) - P(0,t)\\right]$, so with $P(0,0) = 1$:
$$\\sum_t Q_t\\left[P(0,t-1) - P(0,t)\\right] = ${mathNum(numerator, 4)}$$
$$\\sum_t Q_t P(0,t) = ${mathNum(denominator, 4)}$$

**Step 4 — Set the legs equal.**
$$R = \\frac{${mathNum(numerator, 4)}}{${mathNum(denominator, 4)}} = ${(correctValue * 100).toFixed(2)}\\%$$

With a level notional the same formula collapses to the ordinary par swap rate of ${mathPct(levelNotionalRate)}; the amortizing schedule pulls the rate towards the earlier, lower forward rates.`,
        checks: [
          {
            label: "formula reduces to the ordinary par swap rate at a level notional",
            ok: Math.abs(levelCheck - levelNotionalRate) < 1e-12,
          },
          {
            label: "amortizing rate sits below the level-notional rate on a rising curve",
            ok: correctValue < levelNotionalRate,
          },
        ],
      };
    },
  },
];
