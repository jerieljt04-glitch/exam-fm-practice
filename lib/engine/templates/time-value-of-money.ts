import { mathInt, mathMoney, mathNum, moneyInt, rate } from "../format";
import { cast, effectiveRate, nominalRate } from "../style";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Domain 1 — Time Value of Money.
 * Interest measurement, rate equivalence, force of interest and equations of value.
 */
export const TIME_VALUE_OF_MONEY_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "TVM_FORCE_OF_INTEREST",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Accumulation under a Variable Force of Interest",
    objective: "Integrate a time-varying force of interest to accumulate a single deposit.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const [saver] = cast(rng);
      const deposit = rng.int(2, 10) * 1000;
      const a = rng.float(0.02, 0.04, 3);
      const b = rng.float(0.002, 0.006, 4);
      const t = rng.int(4, 8);

      const integral = a * t + 0.5 * b * t * t;
      const correctValue = deposit * Math.exp(integral);

      const simpleInterest = deposit * (1 + integral);
      const forgotHalf = deposit * Math.exp(a * t + b * t * t);
      const tMinusOne = t - 1;
      const offByOne = deposit * Math.exp(a * tMinusOne + 0.5 * b * tMinusOne * tMinusOne);
      const constantForce = deposit * Math.exp(a * t);

      return {
        questionText: `${saver} deposits ${moneyInt(deposit)} into a fund at time $t = 0$.
The fund credits interest at a force of interest
$$\\delta(t) = ${a} + ${b}t, \\qquad t \\ge 0$$
Calculate the accumulated value of ${saver}'s fund at time $t = ${t}$.`,
        variables: { deposit, a, b, t },
        correctValue,
        distractors: [
          distractor(
            simpleInterest,
            "SIMPLE_INTEREST_ERROR",
            "Accumulated with the simple-interest form $A(t) = A(0)\\left(1 + \\int_0^t \\delta(s)\\,ds\\right)$ instead of $A(0)\\,e^{\\int_0^t \\delta(s)\\,ds}$."
          ),
          distractor(
            forgotHalf,
            "CALCULATION_DISTRACTOR",
            "Integrated $bt$ as $bt^2$ rather than $\\tfrac{1}{2}bt^2$, doubling the variable component of the integral."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Accumulated to time $t = ${tMinusOne}$ instead of $t = ${t}$.`
          ),
          distractor(
            constantForce,
            "NOMINAL_RATE_ERROR",
            `Treated the force as the constant $\\delta = ${a}$ and ignored the time-varying term $${b}t$.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Accumulation function under a variable force of interest.**
$$A(t) = A(0) \\cdot \\exp\\!\\left( \\int_0^{t} \\delta(s) \\, ds \\right)$$

**Step 2 — Integrate the force from $0$ to $t = ${t}$.**
$$\\int_0^{${t}} \\left(${a} + ${b}s\\right) ds = \\left[ ${a}s + \\tfrac{1}{2}(${b})s^2 \\right]_0^{${t}}$$
$$= ${a}(${t}) + 0.5(${b})(${t})^2 = ${rate(a * t, 5)} + ${rate(0.5 * b * t * t, 5)} = ${rate(integral, 5)}$$

**Step 3 — Accumulate the deposit.**
$$A(${t}) = ${mathMoney(deposit, 0)} \\cdot e^{${rate(integral, 5)}} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "TVM_NOMINAL_DISCOUNT_TO_INTEREST",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Equivalence of Nominal Discount and Effective Interest",
    objective: "Convert a nominal discount rate compounded p times a year into an annual effective interest rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const [saver] = cast(rng);
      const dNominal = rng.float(0.05, 0.09, 3);
      const p = rng.choice([2, 4, 12]);
      const frequency = p === 2 ? "semiannually" : p === 4 ? "quarterly" : "monthly";

      const annualDiscountFactor = Math.pow(1 - dNominal / p, p);
      const iEffective = 1 / annualDiscountFactor - 1;

      const interestConfusion = Math.pow(1 + dNominal / p, p) - 1;
      const simpleDiscount = dNominal / (1 - dNominal);
      const noConversion = dNominal;
      const effectiveDiscount = 1 - annualDiscountFactor;

      return {
        questionText: `${saver} invests in a fund that credits interest at ${nominalRate(dNominal, p, "discount")}.
${saver} wishes to compare this fund with one quoting an annual effective interest rate.
Calculate the annual effective interest rate $i$ equivalent to the fund's rate.`,
        variables: { dNominal, p, frequency },
        correctValue: iEffective * 100,
        distractors: [
          distractor(
            interestConfusion * 100,
            "NOMINAL_RATE_ERROR",
            `Treated the nominal discount rate $d^{(${p})}$ as a nominal interest rate, evaluating $\\left(1 + \\tfrac{d}{${p}}\\right)^{${p}} - 1$.`
          ),
          distractor(
            simpleDiscount * 100,
            "SIMPLE_INTEREST_ERROR",
            `Applied the annual identity $i = \\tfrac{d}{1-d}$ without first converting from $p = ${p}$ compounding periods per year.`
          ),
          distractor(
            noConversion * 100,
            "NOMINAL_RATE_ERROR",
            "Reported the nominal rate unchanged, assuming $i = d^{(p)}$."
          ),
          distractor(
            effectiveDiscount * 100,
            "CALCULATION_DISTRACTOR",
            "Computed the annual effective rate of *discount* $d = 1 - v$ rather than the annual effective rate of *interest* $i$."
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Relate the nominal discount rate to the annual discount factor.**
$$v = \\left(1 - \\frac{d^{(${p})}}{${p}}\\right)^{${p}} = \\left(1 - \\frac{${dNominal}}{${p}}\\right)^{${p}} = ${rate(annualDiscountFactor)}$$

**Step 2 — Invert the discount factor to obtain the annual effective interest rate.**
$$1 + i = v^{-1} \\quad\\Longrightarrow\\quad i = \\frac{1}{v} - 1$$
$$i = \\frac{1}{${rate(annualDiscountFactor)}} - 1 = ${(iEffective * 100).toFixed(2)}\\%$$`,
      };
    },
  },

  {
    id: "TVM_EQUATION_OF_VALUE",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Equation of Value with Deferred Deposits",
    objective: "Accumulate multiple deposits made at different times to a common valuation date.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const [saver] = cast(rng);
      const i = rng.float(0.04, 0.08, 3);
      const c1 = rng.int(2, 6) * 1000;
      const t1 = rng.int(2, 4);
      const c2 = rng.int(4, 9) * 1000;
      const t2 = t1 + rng.int(3, 5);
      const valuationTime = t2 + 2;

      const factor1 = Math.pow(1 + i, valuationTime - t1);
      const factor2 = Math.pow(1 + i, valuationTime - t2);
      const correctValue = c1 * factor1 + c2 * factor2;

      const discounted = c1 / factor1 + c2 / factor2;
      const simple = c1 * (1 + i * (valuationTime - t1)) + c2 * (1 + i * (valuationTime - t2));
      const offByOne =
        c1 * Math.pow(1 + i, valuationTime - t1 - 1) + c2 * Math.pow(1 + i, valuationTime - t2 - 1);
      const noInterest = c1 + c2;

      return {
        questionText: `${saver} deposits ${moneyInt(c1)} into a fund at time $t = ${t1}$.
${saver} deposits a further ${moneyInt(c2)} into the same fund at time $t = ${t2}$.
The fund earns ${effectiveRate(i)}.
Calculate the accumulated value of the fund at time $t = ${valuationTime}$.`,
        variables: { i, c1, t1, c2, t2, valuationTime },
        correctValue,
        distractors: [
          distractor(
            simple,
            "SIMPLE_INTEREST_ERROR",
            "Accumulated each deposit with simple interest $C(1 + it)$ instead of compound interest $C(1+i)^t$."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Accumulated for ${valuationTime - t1 - 1} and ${valuationTime - t2 - 1} years instead of ${valuationTime - t1} and ${valuationTime - t2} years.`
          ),
          distractor(
            discounted,
            "CALCULATION_DISTRACTOR",
            `Discounted the deposits backwards instead of accumulating them forward to $t = ${valuationTime}$.`
          ),
          distractor(
            noInterest,
            "NOMINAL_RATE_ERROR",
            "Added the deposits without crediting any interest."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Write the equation of value at $t = ${valuationTime}$.**
$$AV_{${valuationTime}} = C_1 (1+i)^{${valuationTime} - ${t1}} + C_2 (1+i)^{${valuationTime} - ${t2}}$$

**Step 2 — Substitute the given parameters with $i = ${i}$.**
$$AV_{${valuationTime}} = ${mathInt(c1)}\\,(1 + ${i})^{${valuationTime - t1}} + ${mathInt(c2)}\\,(1 + ${i})^{${valuationTime - t2}}$$
$$= ${mathInt(c1)}(${rate(factor1, 4)}) + ${mathInt(c2)}(${rate(factor2, 4)})$$

**Step 3 — Total the accumulated deposits.**
$$AV_{${valuationTime}} = ${mathNum(c1 * factor1)} + ${mathNum(c2 * factor2)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "TVM_NOMINAL_RATE_EQUIVALENCE",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Converting a Nominal Interest Rate to a Nominal Discount Rate",
    objective: "Move between nominal interest and nominal discount rates with different compounding frequencies.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const [saver] = cast(rng);
      const m = rng.choice([2, 4]);
      const p = rng.choice([4, 12]);
      const iNominal = rng.float(0.05, 0.09, 3);

      const iEffective = Math.pow(1 + iNominal / m, m) - 1;
      const correctValue = p * (1 - Math.pow(1 + iEffective, -1 / p));

      const asInterest = p * (Math.pow(1 + iEffective, 1 / p) - 1);
      const annualEffectiveDiscount = iEffective / (1 + iEffective);
      const unconverted = iNominal;
      const simpleConversion = iNominal / (1 + iNominal);

      const pName = p === 4 ? "quarterly" : "monthly";

      return {
        questionText: `${saver} deposits money into an account earning ${nominalRate(iNominal, m)}.
A second account quotes its terms as a nominal annual discount rate convertible ${pName}.
Calculate the rate $d^{(${p})}$ the second account must quote for the two accounts to be equivalent.`,
        variables: { m, p, iNominal, iEffective },
        correctValue: correctValue * 100,
        distractors: [
          distractor(
            asInterest * 100,
            "NOMINAL_RATE_ERROR",
            `Computed the equivalent nominal *interest* rate $i^{(${p})} = ${p}\\left[(1+i)^{1/${p}} - 1\\right]$ instead of the nominal *discount* rate.`
          ),
          distractor(
            annualEffectiveDiscount * 100,
            "CALCULATION_DISTRACTOR",
            `Stopped at the annual effective discount rate $d = \\tfrac{i}{1+i}$ without converting to ${p} compounding periods per year.`
          ),
          distractor(
            unconverted * 100,
            "NOMINAL_RATE_ERROR",
            `Reported the given nominal interest rate unchanged, assuming $d^{(${p})} = i^{(${m})}$.`
          ),
          distractor(
            simpleConversion * 100,
            "SIMPLE_INTEREST_ERROR",
            "Applied $d = \\tfrac{i}{1+i}$ directly to the nominal rate, skipping both frequency conversions."
          ),
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1 — Convert the nominal interest rate to an annual effective rate.**
$$1 + i = \\left(1 + \\frac{i^{(${m})}}{${m}}\\right)^{${m}} = \\left(1 + \\frac{${iNominal}}{${m}}\\right)^{${m}} = ${rate(1 + iEffective)}$$
$$i = ${(iEffective * 100).toFixed(4)}\\%$$

**Step 2 — Apply the standard rate-equivalence identity.**
$$\\left(1 - \\frac{d^{(${p})}}{${p}}\\right)^{-${p}} = 1 + i \\quad\\Longrightarrow\\quad d^{(${p})} = ${p}\\left[1 - (1+i)^{-1/${p}}\\right]$$

**Step 3 — Evaluate.**
$$(1+i)^{-1/${p}} = ${rate(Math.pow(1 + iEffective, -1 / p))}$$
$$d^{(${p})} = ${p}\\left[1 - ${rate(Math.pow(1 + iEffective, -1 / p))}\\right] = ${(correctValue * 100).toFixed(2)}\\%$$`,
      };
    },
  },

  {
    id: "TVM_GROWTH_HORIZON",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Time Required for a Fund to Reach a Target",
    objective: "Solve an equation of value for the unknown time using logarithms.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    generate: (rng) => {
      const [saver] = cast(rng);
      const principal = rng.int(3, 12) * 1000;
      const multiple = rng.choice([2, 2.5, 3]);
      const target = principal * multiple;
      const i = rng.float(0.03, 0.09, 3);

      const correctValue = Math.log(multiple) / Math.log(1 + i);

      const simpleInterest = (multiple - 1) / i;
      const forceConfusion = Math.log(multiple) / i;
      const linearNumerator = (multiple - 1) / Math.log(1 + i);
      const offByOne = correctValue - 1;

      return {
        questionText: `${saver} invests ${moneyInt(principal)} in a fund earning ${effectiveRate(i)}.
${saver} will withdraw the money once the fund reaches ${moneyInt(target)}.
Calculate the number of years ${saver} must wait.`,
        variables: { principal, target, multiple, i },
        correctValue,
        distractors: [
          distractor(
            simpleInterest,
            "SIMPLE_INTEREST_ERROR",
            `Solved $1 + it = ${multiple}$ under simple interest instead of $(1+i)^t = ${multiple}$ under compound interest.`
          ),
          distractor(
            forceConfusion,
            "NOMINAL_RATE_ERROR",
            "Used $\\delta = i$ in the denominator instead of the force of interest $\\delta = \\ln(1+i)$."
          ),
          distractor(
            linearNumerator,
            "CALCULATION_DISTRACTOR",
            `Linearised the numerator as $${multiple} - 1$ rather than taking $\\ln(${multiple})$.`
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            "Reported one year fewer than the solution of the equation of value."
          ),
        ],
        format: "YEARS",
        solutionSteps: `**Step 1 — Write the equation of value.**
$$${mathInt(principal)}\\,(1 + i)^{t} = ${mathInt(target)} \\quad\\Longrightarrow\\quad (1 + ${i})^{t} = ${multiple}$$

**Step 2 — Take logarithms of both sides.**
$$t \\ln(1 + ${i}) = \\ln(${multiple}) \\quad\\Longrightarrow\\quad t = \\frac{\\ln(${multiple})}{\\ln(1 + ${i})}$$

**Step 3 — Evaluate.**
$$t = \\frac{${rate(Math.log(multiple))}}{${rate(Math.log(1 + i))}} = ${correctValue.toFixed(2)} \\text{ years}$$`,
      };
    },
  },

  {
    id: "TVM_CONTINUOUS_DISCOUNTING",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Present Value under a Constant Force of Interest",
    objective: "Discount a single future payment continuously at a constant force of interest.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 1,
    generate: (rng) => {
      const [saver] = cast(rng);
      const futureValue = rng.int(15, 60) * 1000;
      const delta = rng.float(0.03, 0.08, 3);
      const t = rng.int(5, 12);

      const correctValue = futureValue * Math.exp(-delta * t);

      const treatedAsEffective = futureValue * Math.pow(1 + delta, -t);
      const simpleDiscount = futureValue * (1 - delta * t);
      const accumulated = futureValue * Math.exp(delta * t);
      const offByOne = futureValue * Math.exp(-delta * (t - 1));

      return {
        questionText: `${saver} must pay ${moneyInt(futureValue)} at the end of ${t} years.
${saver} sets money aside today in a fund credited at an annual force of interest of ${delta}.
Calculate the amount ${saver} must invest today to exactly meet the payment.`,
        variables: { futureValue, delta, t },
        correctValue,
        distractors: [
          distractor(
            treatedAsEffective,
            "NOMINAL_RATE_ERROR",
            `Treated $\\delta = ${delta}$ as an annual effective rate, discounting by $(1+\\delta)^{-t}$ instead of $e^{-\\delta t}$.`
          ),
          distractor(
            simpleDiscount,
            "SIMPLE_INTEREST_ERROR",
            "Used the simple-discount approximation $F(1 - \\delta t)$, which is only a first-order approximation of $e^{-\\delta t}$."
          ),
          distractor(
            accumulated,
            "CALCULATION_DISTRACTOR",
            "Accumulated forward with $e^{+\\delta t}$ rather than discounting back with $e^{-\\delta t}$."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Discounted over ${t - 1} years instead of ${t} years.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Present value under a constant force of interest.**
$$PV = F \\cdot e^{-\\delta t}$$

**Step 2 — Substitute $F = ${mathMoney(futureValue, 0)}$, $\\delta = ${delta}$, $t = ${t}$.**
$$e^{-(${delta})(${t})} = e^{-${rate(delta * t, 4)}} = ${rate(Math.exp(-delta * t))}$$

**Step 3 — Compute the required deposit.**
$$PV = ${mathMoney(futureValue, 0)} \\times ${rate(Math.exp(-delta * t))} = ${mathMoney(correctValue)}$$`,
      };
    },
  },
];
