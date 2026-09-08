import { ActuarialMath } from "../financial-math";
import { mathInt, mathMoney, mathNum, moneyInt, ordinal, pct, rate } from "../format";
import { cast, effectiveRate, nominalRate as nominalRatePhrase } from "../style";
import { distractor, type QuestionTemplateDefinition } from "./types";

/**
 * Domain 3 — Loans & Amortization.
 * Level amortization, outstanding balances, payment components and sinking funds.
 */
export const LOAN_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "LOAN_AMORTIZATION_PAYMENT",
    domain: "LOANS",
    title: "Level Monthly Amortization Payment",
    objective: "Convert a nominal annual rate to a periodic rate and solve for the level payment.",
    difficulty: 2,
    topics: ["TIME_VALUE", "LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(15, 50) * 10000;
      const years = rng.choice([15, 20, 25, 30]);
      const nominalRate = rng.float(0.04, 0.08, 3);
      const m = 12;
      const totalPayments = years * m;
      const j = nominalRate / m;

      const annuityFactor = ActuarialMath.annuityImmediate(totalPayments, j);
      const correctValue = loanAmount / annuityFactor;

      const dueVersion = loanAmount / ActuarialMath.annuityDue(totalPayments, j);
      const annualRateAsPeriodic = ActuarialMath.loanPayment(loanAmount, totalPayments, nominalRate);
      const addOnInterest = (loanAmount * (1 + nominalRate * years)) / totalPayments;
      const shortTerm = ActuarialMath.loanPayment(loanAmount, (years - 1) * m, j);

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} for ${years} years.
The loan charges ${nominalRatePhrase(nominalRate, m)}.
${borrower} repays the loan with equal payments at the end of each month.
Calculate ${borrower}'s monthly payment.`,
        variables: { loanAmount, years, nominalRate, m, totalPayments, j },
        correctValue,
        distractors: [
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Assumed payments are made at the beginning of each month (annuity-due) rather than at the end (annuity-immediate)."
          ),
          distractor(
            addOnInterest,
            "SIMPLE_INTEREST_ERROR",
            "Used the add-on interest formula $\\frac{L(1 + i \\cdot n)}{N}$, which charges simple interest on the original balance for the whole term."
          ),
          distractor(
            shortTerm,
            "OFF_BY_ONE_PERIOD",
            `Amortized over ${years - 1} years (${(years - 1) * m} payments) instead of ${years} years (${totalPayments} payments).`
          ),
          distractor(
            annualRateAsPeriodic,
            "NOMINAL_RATE_ERROR",
            "Applied the nominal annual rate directly as the monthly rate without dividing by $12$."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Convert to the monthly rate and payment count.**
$$j = \\frac{i^{(12)}}{12} = \\frac{${nominalRate}}{12} = ${rate(j)}$$
$$n = ${years} \\times 12 = ${totalPayments} \\text{ payments}$$

**Step 2 — Write the amortization equation of value.**
$$L = R \\cdot a_{\\overline{n}|j} \\quad\\Longrightarrow\\quad R = \\frac{L}{a_{\\overline{n}|j}}$$

**Step 3 — Evaluate the annuity factor.**
$$a_{\\overline{${totalPayments}}|} = \\frac{1 - (1 + ${rate(j)})^{-${totalPayments}}}{${rate(j)}} = ${annuityFactor.toFixed(4)}$$

**Step 4 — Solve for the monthly payment.**
$$R = \\frac{${mathMoney(loanAmount, 0)}}{${annuityFactor.toFixed(4)}} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "LOAN_OUTSTANDING_BALANCE",
    domain: "LOANS",
    title: "Outstanding Loan Balance (Prospective Method)",
    objective: "Value the remaining payments of an amortized loan immediately after a payment.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(10, 30) * 10000;
      const n = rng.int(15, 30);
      const i = rng.float(0.04, 0.08, 3);
      const t = rng.int(5, n - 3);

      const payment = ActuarialMath.loanPayment(loanAmount, n, i);
      const remainingFactor = ActuarialMath.annuityImmediate(n - t, i);
      const correctValue = payment * remainingFactor;

      const beforePayment = payment * ActuarialMath.annuityImmediate(n - t + 1, i);
      const straightLine = (loanAmount * (n - t)) / n;
      const dueVersion = payment * ActuarialMath.annuityDue(n - t, i);
      // Accumulates the loan but forgets to accumulate the repayments. Always
      // positive, unlike the naive `L - tR`, which can imply a negative balance.
      const unaccumulatedPayments = loanAmount * Math.pow(1 + i, t) - payment * t;

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} at ${effectiveRate(i)}.
${borrower} repays the loan with equal payments at the end of each year for ${n} years.
Calculate the loan balance outstanding immediately after ${borrower} makes the $${ordinal(t)}$ payment.`,
        variables: { loanAmount, n, i, t, payment },
        correctValue,
        distractors: [
          distractor(
            beforePayment,
            "OFF_BY_ONE_PERIOD",
            `Valued ${n - t + 1} remaining payments, which is the balance *immediately before* payment ${t} rather than immediately after it.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Valued the remaining payments with $\\ddot{a}_{\\overline{n-t}|i}$, adding a period of interest that the borrower has already paid."
          ),
          distractor(
            straightLine,
            "SIMPLE_INTEREST_ERROR",
            "Assumed straight-line amortization $L \\cdot \\frac{n-t}{n}$; in a level-payment loan the early payments are mostly interest, so the balance falls far more slowly than linearly."
          ),
          distractor(
            unaccumulatedPayments,
            "CALCULATION_DISTRACTOR",
            "Accumulated the original principal to time $t$ but subtracted the payments without accumulating them, using $L(1+i)^t - tR$ in place of the retrospective balance $L(1+i)^t - R\\,s_{\\overline{t}|i}$."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Calculate the level annual payment.**
$$R = \\frac{L}{a_{\\overline{${n}}|}} = \\frac{${mathMoney(loanAmount, 0)}}{${ActuarialMath.annuityImmediate(n, i).toFixed(4)}} = ${mathMoney(payment)}$$

**Step 2 — Apply the prospective method.**
Immediately after payment ${t}, exactly $n - t = ${n} - ${t} = ${n - t}$ payments remain:
$$B_{${t}} = R \\cdot a_{\\overline{n-t}|i} = R \\cdot a_{\\overline{${n - t}}|}$$

**Step 3 — Evaluate the remaining annuity factor.**
$$a_{\\overline{${n - t}}|} = ${remainingFactor.toFixed(4)}$$
$$B_{${t}} = ${mathNum(payment)} \\times ${remainingFactor.toFixed(4)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "LOAN_PRINCIPAL_COMPONENT",
    domain: "LOANS",
    title: "Principal Component of an Amortization Payment",
    objective: "Split a level loan payment into its principal repayment component.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(8, 25) * 10000;
      const n = rng.int(10, 20);
      const i = rng.float(0.05, 0.09, 3);
      const t = rng.int(3, n - 2);

      const payment = ActuarialMath.loanPayment(loanAmount, n, i);
      const correctValue = ActuarialMath.loanPrincipalPaidAt(payment, n, t, i);
      const interestComponent = payment - correctValue;

      const nextPeriod = ActuarialMath.loanPrincipalPaidAt(payment, n, t + 1, i);
      const previousPeriod = ActuarialMath.loanPrincipalPaidAt(payment, n, t - 1, i);
      const equalSplit = loanAmount / n;

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} at ${effectiveRate(i)}.
The loan is amortized with level payments at the end of each year for ${n} years.
Calculate the amount of principal repaid in ${borrower}'s $${ordinal(t)}$ payment.`,
        variables: { loanAmount, n, i, t, payment },
        correctValue,
        distractors: [
          distractor(
            interestComponent,
            "CALCULATION_DISTRACTOR",
            `Reported the interest component $I_{${t}} = R\\left(1 - v^{n-t+1}\\right)$ instead of the principal component $P_{${t}}$.`
          ),
          distractor(
            nextPeriod,
            "OFF_BY_ONE_PERIOD",
            `Evaluated the principal repaid in payment ${t + 1}, using the exponent $n - t = ${n - t}$ rather than $n - t + 1 = ${n - t + 1}$.`
          ),
          distractor(
            previousPeriod,
            "OFF_BY_ONE_PERIOD",
            `Evaluated the principal repaid in payment ${t - 1}, using the exponent $n - t + 2 = ${n - t + 2}$.`
          ),
          distractor(
            equalSplit,
            "SIMPLE_INTEREST_ERROR",
            "Assumed each payment repays an equal share of principal, $L / n$, which describes a sinking-fund style repayment rather than level-payment amortization."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Calculate the level annual payment.**
$$R = \\frac{L}{a_{\\overline{${n}}|}} = \\frac{${mathMoney(loanAmount, 0)}}{${ActuarialMath.annuityImmediate(n, i).toFixed(4)}} = ${mathMoney(payment)}$$

**Step 2 — Apply the principal-component formula.**
$$P_t = R \\cdot v^{\\,n - t + 1}, \\qquad n - t + 1 = ${n} - ${t} + 1 = ${n - t + 1}$$

**Step 3 — Evaluate.**
$$v = \\frac{1}{1 + ${i}} = ${rate(ActuarialMath.v(i))}$$
$$v^{${n - t + 1}} = ${rate(Math.pow(ActuarialMath.v(i), n - t + 1))}$$
$$P_{${t}} = ${mathNum(payment)} \\times ${rate(Math.pow(ActuarialMath.v(i), n - t + 1))} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "LOAN_INTEREST_COMPONENT",
    domain: "LOANS",
    title: "Interest Component of an Amortization Schedule",
    objective: "Compute the interest contained in a specified line of an amortization schedule.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(6, 20) * 10000;
      const n = rng.int(12, 25);
      const i = rng.float(0.04, 0.08, 3);
      const t = rng.int(4, n - 3);

      const payment = ActuarialMath.loanPayment(loanAmount, n, i);
      const correctValue = ActuarialMath.loanInterestPaidAt(payment, n, t, i);
      const principalComponent = payment - correctValue;

      const nextPeriod = ActuarialMath.loanInterestPaidAt(payment, n, t + 1, i);
      const interestOnOriginal = loanAmount * i;
      const duePayment = loanAmount / ActuarialMath.annuityDue(n, i);
      const dueVersion = duePayment * (1 - Math.pow(ActuarialMath.v(i), n - t + 1));

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} at ${effectiveRate(i)}.
The loan is repaid with ${n} level payments at the end of each year.
Calculate the amount of interest contained in ${borrower}'s $${ordinal(t)}$ payment.`,
        variables: { loanAmount, n, i, t, payment },
        correctValue,
        distractors: [
          distractor(
            principalComponent,
            "CALCULATION_DISTRACTOR",
            `Reported the principal component $P_{${t}} = R\\,v^{\\,n-t+1}$ instead of the interest component $I_{${t}}$.`
          ),
          distractor(
            nextPeriod,
            "OFF_BY_ONE_PERIOD",
            `Evaluated the interest in payment ${t + 1}. The interest in payment $t$ is charged on the balance $B_{t-1}$, giving the exponent $n - t + 1 = ${n - t + 1}$.`
          ),
          distractor(
            interestOnOriginal,
            "SIMPLE_INTEREST_ERROR",
            `Charged interest on the original principal, $i \\cdot L$; by payment ${t} the outstanding balance has already been reduced.`
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Derived the level payment from an annuity-due factor, understating $R$ and therefore the interest split."
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Calculate the level annual payment.**
$$R = \\frac{L}{a_{\\overline{${n}}|}} = \\frac{${mathMoney(loanAmount, 0)}}{${ActuarialMath.annuityImmediate(n, i).toFixed(4)}} = ${mathMoney(payment)}$$

**Step 2 — Interest is charged on the balance outstanding one period earlier.**
$$I_t = i \\cdot B_{t-1} = R\\left(1 - v^{\\,n-t+1}\\right), \\qquad n - t + 1 = ${n - t + 1}$$

**Step 3 — Evaluate.**
$$v^{${n - t + 1}} = ${rate(Math.pow(ActuarialMath.v(i), n - t + 1))}$$
$$I_{${t}} = ${mathNum(payment)} \\left(1 - ${rate(Math.pow(ActuarialMath.v(i), n - t + 1))}\\right) = ${mathMoney(correctValue)}$$

**Check —** the principal component is $R - I_{${t}} = ${mathMoney(principalComponent)}$, and the two sum to the level payment ${mathMoney(payment)}.`,
      };
    },
  },

  {
    id: "LOAN_SINKING_FUND",
    domain: "LOANS",
    title: "Total Annual Outlay under a Sinking Fund",
    objective: "Combine loan service interest with a sinking-fund deposit accumulated at a different rate.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(10, 40) * 10000;
      const n = rng.int(8, 18);
      const loanRate = rng.float(0.06, 0.10, 3);
      const fundRate = rng.float(0.03, 0.05, 3);

      const interestService = loanAmount * loanRate;
      const sinkingFactor = ActuarialMath.accumulatedAnnuityImmediate(n, fundRate);
      const sinkingDeposit = loanAmount / sinkingFactor;
      const correctValue = interestService + sinkingDeposit;

      const sameRate =
        interestService + loanAmount / ActuarialMath.accumulatedAnnuityImmediate(n, loanRate);
      const amortization = ActuarialMath.loanPayment(loanAmount, n, loanRate);
      const noFundInterest = interestService + loanAmount / n;
      const offByOne =
        interestService + loanAmount / ActuarialMath.accumulatedAnnuityImmediate(n - 1, fundRate);

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} and pays interest on the loan annually at ${effectiveRate(loanRate)}.
The principal is repaid in a single payment at the end of ${n} years.
To fund that repayment ${borrower} makes level deposits at the end of each year into a sinking fund earning ${effectiveRate(fundRate)}.
Calculate ${borrower}'s total annual outlay.`,
        variables: { loanAmount, n, loanRate, fundRate },
        correctValue,
        distractors: [
          distractor(
            sameRate,
            "NOMINAL_RATE_ERROR",
            `Accumulated the sinking fund at the loan rate ${pct(loanRate)} instead of the fund rate ${pct(fundRate)}.`
          ),
          distractor(
            amortization,
            "CALCULATION_DISTRACTOR",
            "Computed the level amortization payment $L / a_{\\overline{n}|i}$, which applies when principal is repaid gradually rather than through a sinking fund."
          ),
          distractor(
            noFundInterest,
            "SIMPLE_INTEREST_ERROR",
            "Divided the principal evenly over the term, $L/n$, crediting the sinking fund with no interest."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            `Accumulated ${n - 1} sinking-fund deposits instead of ${n}.`
          ),
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1 — Annual interest service on the loan.**
$$I = L \\cdot i = ${mathMoney(loanAmount, 0)} \\times ${loanRate} = ${mathMoney(interestService)}$$

**Step 2 — Sinking-fund deposit that accumulates to the principal.**
$$D \\cdot s_{\\overline{${n}}|j} = L \\quad\\Longrightarrow\\quad D = \\frac{L}{s_{\\overline{${n}}|j}}$$
$$s_{\\overline{${n}}|${fundRate}} = \\frac{(1 + ${fundRate})^{${n}} - 1}{${fundRate}} = ${sinkingFactor.toFixed(4)}$$
$$D = \\frac{${mathMoney(loanAmount, 0)}}{${sinkingFactor.toFixed(4)}} = ${mathMoney(sinkingDeposit)}$$

**Step 3 — Total annual outlay.**
$$I + D = ${mathNum(interestService)} + ${mathNum(sinkingDeposit)} = ${mathMoney(correctValue)}$$`,
      };
    },
  },

  {
    id: "LOAN_TERM_SOLVE_N",
    domain: "LOANS",
    title: "Solving for the Term of a Loan",
    objective: "Invert the annuity-immediate factor to find the unknown number of payments.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    generate: (rng) => {
      const [borrower] = cast(rng);
      const loanAmount = rng.int(10, 35) * 5000;
      const i = rng.float(0.05, 0.09, 3);
      const targetTerm = rng.int(12, 25);
      const basePayment = ActuarialMath.loanPayment(loanAmount, targetTerm, i);
      // Quote a whole-dollar payment so the candidate's equation of value uses
      // exactly the figure printed in the question.
      const payment = Math.round(basePayment * rng.float(1.06, 1.2, 3));

      const correctValue = -Math.log(1 - (loanAmount * i) / payment) / Math.log(1 + i);

      const ignoredInterest = loanAmount / payment;
      const d = ActuarialMath.discountRate(i);
      const dueVersion = -Math.log(1 - (loanAmount * d) / payment) / Math.log(1 + i);
      const signError = Math.log(1 + (loanAmount * i) / payment) / Math.log(1 + i);
      const offByOne = correctValue + 1;

      return {
        questionText: `${borrower} borrows ${moneyInt(loanAmount)} at ${effectiveRate(i)}.
${borrower} repays the loan with payments of ${moneyInt(payment)} at the end of each year.
Calculate the number of years required to repay the loan.`,
        variables: { loanAmount, payment, i },
        correctValue,
        distractors: [
          distractor(
            ignoredInterest,
            "SIMPLE_INTEREST_ERROR",
            "Divided the loan by the payment, $L / R$, which credits the loan with no interest at all."
          ),
          distractor(
            dueVersion,
            "ANNUITY_DUE_CONFUSION",
            "Solved $L = R\\,\\ddot{a}_{\\overline{n}|i}$, placing the payments at the beginning of each year."
          ),
          distractor(
            signError,
            "CALCULATION_DISTRACTOR",
            "Rearranged $1 - v^{n} = \\tfrac{Li}{R}$ with the wrong sign, solving $v^{-n} = 1 + \\tfrac{Li}{R}$."
          ),
          distractor(
            offByOne,
            "OFF_BY_ONE_PERIOD",
            "Added an extra payment period to the solution of the equation of value."
          ),
        ],
        format: "YEARS",
        solutionSteps: `**Step 1 — Write the equation of value.**
$$L = R \\cdot a_{\\overline{n}|i} = R \\cdot \\frac{1 - v^{n}}{i}$$

**Step 2 — Isolate the discount factor.**
$$v^{n} = 1 - \\frac{L \\cdot i}{R} = 1 - \\frac{(${mathInt(loanAmount)})(${i})}{${mathInt(payment)}} = ${rate(1 - (loanAmount * i) / payment)}$$

**Step 3 — Take logarithms.**
$$n = \\frac{-\\ln\\!\\left(${rate(1 - (loanAmount * i) / payment)}\\right)}{\\ln(1 + ${i})} = ${correctValue.toFixed(2)} \\text{ years}$$

In practice the borrower makes ${Math.floor(correctValue)} full payments followed by a smaller balloon payment.`,
      };
    },
  },
];
