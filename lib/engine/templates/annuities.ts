import { ActuarialMath } from "../financial-math";
import { mathInt, mathMoney, moneyInt, pct, rate } from "../format";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Domain 2 — Annuities & Cash Flows.
 * Level, deferred, increasing, continuous and perpetual payment streams.
 */
export const ANNUITY_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "ANNUITY_LEVEL_IMMEDIATE_PV",
    domain: "ANNUITIES",
    title: "Present Value of a Level Annuity-Immediate",
    objective: "Value a level end-of-period payment stream with the annuity-immediate factor.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 1,
    generate: (rng) => {
      const payment = rng.int(10, 40) * 100;
      const n = rng.int(8, 20);
      const i = rng.float(0.04, 0.08, 3);

      const annuityFactor = ActuarialMath.annuityImmediate(n, i);
      const correctValue = payment * annuityFactor;

      const dueValue = payment * ActuarialMath.annuityDue(n, i);
      let simpleAnnuity = 0;
      for (let k = 1; k <= n; k += 1) simpleAnnuity += payment / (1 + k * i);
      const offByOne = payment * ActuarialMath.annuityImmediate(n - 1, i);
      const undiscounted = payment * n;

      return {
        questionText: `An annuity pays ${moneyInt(payment)} at the end of each year for ${n} years. The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity.`,
        variables: { payment, n, i },
        correctValue,
        distractors: [
          distractor(
            dueValue,
            "ANNUITY_DUE_CONFUSION",
            "Used the annuity-due factor $\\ddot{a}_{\\overline{n}|i} = (1+i)\\,a_{\\overline{n}|i}$, which values payments made at the *beginning* of each year."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Valued ${n - 1} payments instead of ${n}.`
          ),
          distractor(
            simpleAnnuity,
            "SIMPLE_INTEREST_ERROR",
            "Discounted each payment with simple interest $\\tfrac{1}{1+ki}$ rather than the compound factor $v^k$."
          ),
          distractor(
            undiscounted,
            "CALCULATION_DISTRACTOR",
            "Added the payments without discounting, reporting $n \\times P$."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Identify the annuity type.**
Payments fall at the *end* of each year, so this is a level annuity-immediate:
$$PV = P \\cdot a_{\\overline{n}|i} = P \\cdot \\frac{1 - (1+i)^{-n}}{i}$$

**Step 2 — Evaluate the annuity factor with $n = ${n}$ and $i = ${i}$.**
$$v = \\frac{1}{1 + ${i}} = ${rate(ActuarialMath.v(i))}$$
$$a_{\\overline{${n}}|} = \\frac{1 - ${rate(Math.pow(ActuarialMath.v(i), n))}}{${i}} = ${annuityFactor.toFixed(4)}$$

**Step 3 — Multiply by the level payment.**
$$PV = ${mathMoney(payment, 0)} \\times ${annuityFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ANNUITY_ARITHMETIC_INCREASING",
    domain: "ANNUITIES",
    title: "Present Value of an Arithmetically Increasing Annuity",
    objective: "Apply the increasing annuity factor to a payment stream growing by a constant amount.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const n = rng.int(10, 20);
      const i = rng.float(0.04, 0.07, 3);
      const base = rng.int(1, 5) * 100;

      const increasingFactor = ActuarialMath.increasingAnnuityImmediate(n, i);
      const correctValue = base * increasingFactor;

      const v = ActuarialMath.v(i);
      const immediateFactor = ActuarialMath.annuityImmediate(n, i);
      const wrongNumerator = base * ((immediateFactor - n * Math.pow(v, n)) / i);
      const dueVersion = correctValue * (1 + i);
      const offByOne = base * ActuarialMath.increasingAnnuityImmediate(n - 1, i);
      const averagePayment = ((base * (n + 1)) / 2) * immediateFactor;

      return {
        questionText: `An annuity-immediate makes ${n} annual payments. The payment at the end of year $t$ is $${base}t$ — that is, ${moneyInt(base)} at $t = 1$, ${moneyInt(2 * base)} at $t = 2$, increasing by ${moneyInt(base)} each year up to ${moneyInt(n * base)} at $t = ${n}$.
The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity.`,
        variables: { base, n, i },
        correctValue,
        distractors: [
          distractor(
            wrongNumerator,
            "CALCULATION_DISTRACTOR",
            "Used $a_{\\overline{n}|}$ where the numerator of $(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|} - n v^n}{i}$ requires $\\ddot{a}_{\\overline{n}|}$."
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued the increasing annuity-due $(I\\ddot{a})_{\\overline{n}|i} = (1+i)(Ia)_{\\overline{n}|i}$ instead of the annuity-immediate."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Evaluated $(Ia)_{\\overline{${n - 1}}|}$ instead of $(Ia)_{\\overline{${n}}|}$.`
          ),
          distractor(
            averagePayment,
            "SIMPLE_INTEREST_ERROR",
            "Replaced the growing stream with its arithmetic mean payment and valued it as a level annuity, which ignores that later, larger payments are discounted more heavily."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Increasing annuity-immediate factor.**
$$PV = P \\cdot (Ia)_{\\overline{n}|i} = P \\cdot \\frac{\\ddot{a}_{\\overline{n}|i} - n v^n}{i}$$

**Step 2 — Evaluate the components with $n = ${n}$ and $i = ${i}$.**
$$v^{${n}} = (1 + ${i})^{-${n}} = ${rate(Math.pow(v, n), 5)}$$
$$\\ddot{a}_{\\overline{${n}}|} = (1 + ${i})\\,a_{\\overline{${n}}|} = ${ActuarialMath.annuityDue(n, i).toFixed(4)}$$
$$(Ia)_{\\overline{${n}}|} = \\frac{${ActuarialMath.annuityDue(n, i).toFixed(4)} - ${n}(${rate(Math.pow(v, n), 5)})}{${i}} = ${increasingFactor.toFixed(4)}$$

**Step 3 — Scale by the base payment $P = ${mathMoney(base, 0)}$.**
$$PV = ${mathInt(base)} \\times ${increasingFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ANNUITY_PERPETUITY_GEOMETRIC",
    domain: "ANNUITIES",
    title: "Perpetuity with Geometrically Growing Payments",
    objective: "Value an infinite payment stream growing at a constant rate below the interest rate.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 1,
    generate: (rng) => {
      const firstPayment = rng.int(1, 5) * 1000;
      const g = rng.float(0.02, 0.035, 3);
      const i = Number((g + rng.float(0.02, 0.04, 3)).toFixed(4));

      const correctValue = firstPayment / (i - g);

      const ignoredGrowth = firstPayment / i;
      const addedGrowth = firstPayment / (i + g);
      const dueVersion = (firstPayment * (1 + i)) / (i - g);
      const dividedByGrowth = firstPayment / g;

      return {
        questionText: `A perpetuity pays ${moneyInt(firstPayment)} at the end of the first year. Every subsequent annual payment is ${pct(g)} larger than the previous payment.
The annual effective interest rate is ${pct(i)}.
Calculate the present value of the perpetuity.`,
        variables: { firstPayment, g, i },
        correctValue,
        distractors: [
          distractor(
            ignoredGrowth,
            "CALCULATION_DISTRACTOR",
            "Ignored the growth rate $g$ and valued a level perpetuity $P_1 / i$."
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued a perpetuity-due, as if the first payment were made immediately at $t = 0$."
          ),
          distractor(
            addedGrowth,
            "NOMINAL_RATE_ERROR",
            "Added the growth rate in the denominator, $\\tfrac{P_1}{i+g}$, instead of subtracting it."
          ),
          distractor(
            dividedByGrowth,
            "SIMPLE_INTEREST_ERROR",
            "Divided by the growth rate $g$ rather than the net discount rate $i - g$."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Write the present value as a geometric series.**
$$PV = \\sum_{t=1}^{\\infty} P_1 (1+g)^{t-1} v^{t} = \\frac{P_1}{1+i} \\sum_{k=0}^{\\infty} \\left( \\frac{1+g}{1+i} \\right)^{k}$$

**Step 2 — Sum the series, valid because $g < i$.**
$$PV = \\frac{P_1}{1+i} \\cdot \\frac{1}{1 - \\frac{1+g}{1+i}} = \\frac{P_1}{i - g}$$

**Step 3 — Substitute $P_1 = ${mathMoney(firstPayment, 0)}$, $i = ${i}$, $g = ${g}$.**
$$PV = \\frac{${mathInt(firstPayment)}}{${i} - ${g}} = \\frac{${mathInt(firstPayment)}}{${rate(i - g, 4)}} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ANNUITY_DUE_ACCUMULATED_VALUE",
    domain: "ANNUITIES",
    title: "Accumulated Value of an Annuity-Due",
    objective: "Accumulate beginning-of-period deposits to the end of the final period.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 1,
    generate: (rng) => {
      const deposit = rng.int(15, 60) * 100;
      const n = rng.int(10, 25);
      const i = rng.float(0.03, 0.07, 3);

      const dueFactor = ActuarialMath.accumulatedAnnuityDue(n, i);
      const correctValue = deposit * dueFactor;

      const immediateFactor = ActuarialMath.accumulatedAnnuityImmediate(n, i);
      const treatedAsImmediate = deposit * immediateFactor;
      const presentValue = deposit * ActuarialMath.annuityDue(n, i);
      const undiscounted = deposit * n;
      const offByOne = deposit * ActuarialMath.accumulatedAnnuityDue(n - 1, i);

      return {
        questionText: `A saver deposits ${moneyInt(deposit)} at the **beginning** of each year for ${n} years into an account earning an annual effective interest rate of ${pct(i)}.
Calculate the accumulated value of the account at the end of year ${n}.`,
        variables: { deposit, n, i },
        correctValue,
        distractors: [
          distractor(
            treatedAsImmediate,
            "ANNUITY_DUE_CONFUSION",
            "Accumulated with $s_{\\overline{n}|i}$, which assumes deposits at the *end* of each year; beginning-of-year deposits earn one extra year of interest, giving $\\ddot{s}_{\\overline{n}|i} = (1+i)\\,s_{\\overline{n}|i}$."
          ),
          distractor(
            presentValue,
            "CALCULATION_DISTRACTOR",
            "Reported the present value $\\ddot{a}_{\\overline{n}|i}$ at time $0$ instead of the accumulated value at time $n$."
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            "Totalled the deposits without crediting any interest."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Accumulated ${n - 1} deposits instead of ${n}.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Identify the accumulation factor.**
Deposits are made at the beginning of each year, so the accumulated value at time $n$ uses the annuity-due factor:
$$AV = P \\cdot \\ddot{s}_{\\overline{n}|i} = P (1+i) \\cdot \\frac{(1+i)^n - 1}{i}$$

**Step 2 — Evaluate with $n = ${n}$ and $i = ${i}$.**
$$s_{\\overline{${n}}|} = \\frac{(1 + ${i})^{${n}} - 1}{${i}} = ${immediateFactor.toFixed(4)}$$
$$\\ddot{s}_{\\overline{${n}}|} = (1 + ${i}) \\times ${immediateFactor.toFixed(4)} = ${dueFactor.toFixed(4)}$$

**Step 3 — Multiply by the level deposit.**
$$AV = ${mathMoney(deposit, 0)} \\times ${dueFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ANNUITY_DEFERRED_IMMEDIATE",
    domain: "ANNUITIES",
    title: "Present Value of a Deferred Annuity-Immediate",
    objective: "Discount a level annuity whose first payment is delayed by a whole number of years.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const payment = rng.int(20, 60) * 100;
      const n = rng.int(8, 15);
      const deferral = rng.int(3, 7);
      const i = rng.float(0.04, 0.08, 3);

      const v = ActuarialMath.v(i);
      const annuityFactor = ActuarialMath.annuityImmediate(n, i);
      const correctValue = payment * Math.pow(v, deferral) * annuityFactor;

      const ignoredDeferral = payment * annuityFactor;
      const offByOne = payment * Math.pow(v, deferral + 1) * annuityFactor;
      const dueVersion = payment * Math.pow(v, deferral) * ActuarialMath.annuityDue(n, i);
      const missingSubtraction = payment * ActuarialMath.annuityImmediate(n + deferral, i);

      return {
        questionText: `An annuity pays ${moneyInt(payment)} at the end of each year for ${n} years. The first payment is made at the end of year ${deferral + 1}.
The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity at time $t = 0$.`,
        variables: { payment, n, deferral, i },
        correctValue,
        distractors: [
          distractor(
            ignoredDeferral,
            "CALCULATION_DISTRACTOR",
            `Valued the annuity as if the first payment were made at the end of year $1$, omitting the ${deferral}-year deferral factor $v^{${deferral}}$.`
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Discounted by $v^{${deferral + 1}}$ instead of $v^{${deferral}}$. With the first payment at the end of year ${deferral + 1}, the annuity-immediate factor is already valued at time ${deferral}.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Combined the deferral factor with an annuity-due factor, double-counting one period of interest."
          ),
          distractor(
            missingSubtraction,
            "CALCULATION_DISTRACTOR",
            `Evaluated $a_{\\overline{${n + deferral}}|}$ without subtracting $a_{\\overline{${deferral}}|}$, so the deferral period is valued as if it also received payments.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Locate the annuity on the timeline.**
The first of ${n} payments arrives at the end of year ${deferral + 1}, so the annuity-immediate factor is valued at time $t = ${deferral}$ and must then be discounted:
$$PV = P \\cdot v^{${deferral}} \\cdot a_{\\overline{${n}}|i} = P\\left( a_{\\overline{${n + deferral}}|i} - a_{\\overline{${deferral}}|i} \\right)$$

**Step 2 — Evaluate each factor with $i = ${i}$.**
$$v^{${deferral}} = ${rate(Math.pow(v, deferral))}$$
$$a_{\\overline{${n}}|} = ${annuityFactor.toFixed(4)}$$

**Step 3 — Combine.**
$$PV = ${mathMoney(payment, 0)} \\times ${rate(Math.pow(v, deferral))} \\times ${annuityFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "ANNUITY_CONTINUOUS",
    domain: "ANNUITIES",
    title: "Present Value of a Continuously Payable Annuity",
    objective: "Value a continuous payment stream using the force of interest.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const annualRate = rng.int(20, 80) * 100;
      const n = rng.int(6, 18);
      const i = rng.float(0.04, 0.09, 3);

      const delta = ActuarialMath.delta(i);
      const continuousFactor = ActuarialMath.continuousAnnuity(n, i);
      const correctValue = annualRate * continuousFactor;

      const usedInterestRate = annualRate * ActuarialMath.annuityImmediate(n, i);
      const dueVersion = annualRate * ActuarialMath.annuityDue(n, i);
      const undiscounted = annualRate * n;
      const offByOne = annualRate * ActuarialMath.continuousAnnuity(n - 1, i);

      return {
        questionText: `An annuity pays continuously at an annual rate of ${moneyInt(annualRate)} per year for ${n} years. The annual effective interest rate is ${pct(i)}.
Calculate the present value of the annuity.`,
        variables: { annualRate, n, i, delta },
        correctValue,
        distractors: [
          distractor(
            usedInterestRate,
            "NOMINAL_RATE_ERROR",
            "Divided by $i$ instead of the force of interest $\\delta = \\ln(1+i)$, which values discrete end-of-year payments rather than a continuous stream."
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued discrete beginning-of-year payments with $\\ddot{a}_{\\overline{n}|i}$; the continuous factor $\\bar{a}_{\\overline{n}|}$ lies strictly between $a_{\\overline{n}|}$ and $\\ddot{a}_{\\overline{n}|}$."
          ),
          distractor(
            undiscounted,
            "SIMPLE_INTEREST_ERROR",
            "Multiplied the annual payment rate by the term without discounting."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Valued a ${n - 1}-year stream instead of a ${n}-year stream.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Continuous annuity factor.**
$$\\bar{a}_{\\overline{n}|} = \\int_0^{n} v^{t} \\, dt = \\frac{1 - v^{n}}{\\delta}, \\qquad \\delta = \\ln(1+i)$$

**Step 2 — Evaluate the force of interest and discount factor.**
$$\\delta = \\ln(1 + ${i}) = ${rate(delta)}$$
$$v^{${n}} = (1 + ${i})^{-${n}} = ${rate(Math.pow(ActuarialMath.v(i), n))}$$
$$\\bar{a}_{\\overline{${n}}|} = \\frac{1 - ${rate(Math.pow(ActuarialMath.v(i), n))}}{${rate(delta)}} = ${continuousFactor.toFixed(4)}$$

**Step 3 — Scale by the annual payment rate.**
$$PV = ${mathMoney(annualRate, 0)} \\times ${continuousFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },
];
