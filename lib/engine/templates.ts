import { TopicDomain } from "../types/exam";
import { ActuarialMath } from "./financial-math";

export interface GeneratedQuestionItem {
  questionText: string;
  variables: Record<string, any>;
  correctValue: number;
  distractors: {
    value: number;
    type:
      | "CORRECT"
      | "ANNUITY_DUE_CONFUSION"
      | "SIMPLE_INTEREST_ERROR"
      | "OFF_BY_ONE_PERIOD"
      | "NOMINAL_RATE_ERROR"
      | "CALCULATION_DISTRACTOR";
    explanation: string;
  }[];
  format: "CURRENCY" | "PERCENT" | "YEARS" | "DECIMAL_4" | "DECIMAL_2";
  solutionSteps: string;
  videoUrl: string;
}

export interface QuestionTemplateDefinition {
  id: string;
  domain: TopicDomain;
  title: string;
  generate: () => GeneratedQuestionItem;
}

// Utility random helpers
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randFloat(min: number, max: number, decimals: number = 2): number {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
}

export const QUESTION_TEMPLATES: QuestionTemplateDefinition[] = [
  // ==========================================
  // DOMAIN 1: TIME VALUE OF MONEY (TVM)
  // ==========================================
  {
    id: "TVM_FORCE_OF_INTEREST",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Accumulation under Variable Force of Interest",
    generate: () => {
      const deposit = randInt(2, 10) * 1000;
      const a = randFloat(0.02, 0.04, 3);
      const b = randFloat(0.002, 0.006, 4);
      const t = randInt(4, 8);

      const integral = a * t + 0.5 * b * t * t;
      const correctVal = deposit * Math.exp(integral);

      // Distractor 1: simple interest approximation
      const simpleInterest = deposit * (1 + integral);
      // Distractor 2: forgetting the 1/2 on t^2 (integrating b*t as b*t^2)
      const forgotHalf = deposit * Math.exp(a * t + b * t * t);
      // Distractor 3: off-by-one year (t-1)
      const tMinus1 = t - 1;
      const offByOne = deposit * Math.exp(a * tMinus1 + 0.5 * b * tMinus1 * tMinus1);
      // Distractor 4: constant force using a only
      const constForce = deposit * Math.exp(a * t);

      return {
        questionText: `An investor deposits $${deposit.toLocaleString()} into an account at time $t = 0$. The force of interest at time $t$ is given by:
$$\\delta(t) = ${a} + ${b}t$$
Calculate the accumulated value in the account at time $t = ${t}$.`,
        variables: { deposit, a, b, t },
        correctValue: correctVal,
        distractors: [
          {
            value: simpleInterest,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Used simple interest accumulation $A(t) = P(1 + \\int_0^t \\delta(s)ds)$ instead of continuous compounding $P \\cdot e^{\\int_0^t \\delta(s)ds}$.",
          },
          {
            value: forgotHalf,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Failed to divide by 2 when integrating $bt$, using $\\int bt dt = bt^2$ instead of $\\frac{1}{2}bt^2$.",
          },
          {
            value: offByOne,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Calculated accumulation at time $t = ${tMinus1}$ instead of $t = ${t}$.`,
          },
          {
            value: constForce,
            type: "NOMINAL_RATE_ERROR",
            explanation: `Ignored the time-varying component $bt$ and only compounded using constant force $a = ${a}$.`,
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Write the accumulation function under variable force of interest:**
$$A(t) = A(0) \\cdot \\exp\\left( \\int_0^t \\delta(s) \\, ds \\right)$$

**Step 2: Evaluate the integral of $\\delta(s)$ from $0$ to $t = ${t}$:**
$$\\int_0^{${t}} (${a} + ${b}s) \\, ds = \\left[ ${a}s + \\frac{1}{2}(${b})s^2 \\right]_0^{${t}}$$
$$= ${a}(${t}) + 0.5(${b})(${t})^2$$
$$= ${(a * t).toFixed(4)} + ${(0.5 * b * t * t).toFixed(4)} = ${integral.toFixed(5)}$$

**Step 3: Calculate the accumulated value:**
$$A(${t}) = ${deposit} \\cdot e^{${integral.toFixed(5)}} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "TVM_NOMINAL_DISCOUNT_TO_INTEREST",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Equivalence of Nominal Discount and Effective Interest",
    generate: () => {
      const d_p = randFloat(0.05, 0.09, 3);
      const p = randChoice([2, 4, 12]); // compounded semiannually, quarterly, monthly
      const freqName = p === 2 ? "semiannually" : p === 4 ? "quarterly" : "monthly";

      // Effective annual rate i: (1 - d^(p)/p)^(-p) - 1
      const v_ann = Math.pow(1 - d_p / p, p);
      const i_eff = 1 / v_ann - 1;

      // Distractor 1: treating d as nominal interest instead of discount: (1 + d/p)^p - 1
      const interestConfusion = Math.pow(1 + d_p / p, p) - 1;
      // Distractor 2: forgetting compounding periods: d / (1 - d)
      const simpleDiscount = d_p / (1 - d_p);
      // Distractor 3: multiplying by p instead of compounding: d_p
      const linearDist = d_p;
      // Distractor 4: using 1 - (1 - d_p/p)^p
      const directDist = 1 - Math.pow(1 - d_p / p, p);

      return {
        questionText: `An account earns interest at a nominal discount rate of ${(d_p * 100).toFixed(2)}% compounded ${freqName}. 
Calculate the equivalent annual effective rate of interest $i$.`,
        variables: { d_p, p, freqName },
        correctValue: i_eff * 100,
        distractors: [
          {
            value: interestConfusion * 100,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Confused nominal discount rate $d^{(p)}$ with nominal interest rate $i^{(p)}$ using $(1 + d/p)^p - 1$.",
          },
          {
            value: simpleDiscount * 100,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: `Applied the annual formula $i = d / (1 - d)$ without accounting for compounding frequency $p = ${p}$.`,
          },
          {
            value: linearDist * 100,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Failed to convert nominal rate to effective annual rate, assuming $i = d^{(p)}$.",
          },
          {
            value: directDist * 100,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Calculated annual effective discount rate $d$ instead of annual effective interest rate $i$.",
          },
        ],
        format: "PERCENT",
        solutionSteps: `**Step 1: Relate nominal discount $d^{(${p})}$ to annual discount factor $v$:**
$$v = \\left(1 - \\frac{d^{(${p})}}{${p}}\\right)^{${p}} = \\left(1 - \\frac{${d_p}}{${p}}\\right)^{${p}}$$
$$v = \\left(${ (1 - d_p / p).toFixed(6)} \\right)^{${p}} = ${v_ann.toFixed(6)}$$

**Step 2: Convert discount factor $v$ to annual effective interest rate $i$:**
$$1 + i = v^{-1} \\implies i = \\frac{1}{v} - 1$$
$$i = \\frac{1}{${v_ann.toFixed(6)}} - 1 = ${(i_eff * 100).toFixed(2)}\\%$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "TVM_EQUATION_OF_VALUE",
    domain: "TIME_VALUE_OF_MONEY",
    title: "Equation of Value with Deferred Payments",
    generate: () => {
      const i = randFloat(0.04, 0.08, 3);
      const c1 = randInt(2, 6) * 1000;
      const t1 = randInt(2, 4);
      const c2 = randInt(4, 9) * 1000;
      const t2 = t1 + randInt(3, 5);
      const tTarget = t2 + 2;

      // Accumulated value at tTarget
      const correctVal = c1 * Math.pow(1 + i, tTarget - t1) + c2 * Math.pow(1 + i, tTarget - t2);

      // Distractor 1: discounting instead of accumulating
      const discountedVal = c1 * Math.pow(1 + i, -(tTarget - t1)) + c2 * Math.pow(1 + i, -(tTarget - t2));
      // Distractor 2: simple interest
      const simpleVal = c1 * (1 + i * (tTarget - t1)) + c2 * (1 + i * (tTarget - t2));
      // Distractor 3: off by one period on both
      const offByOneVal = c1 * Math.pow(1 + i, tTarget - t1 - 1) + c2 * Math.pow(1 + i, tTarget - t2 - 1);
      // Distractor 4: sum with no interest
      const noInterest = c1 + c2;

      return {
        questionText: `Payments of $${c1.toLocaleString()} at time $t = ${t1}$ and $${c2.toLocaleString()} at time $t = ${t2}$ are deposited into a fund earning an annual effective interest rate of ${(i * 100).toFixed(2)}%. 
Determine the accumulated value of these payments at time $t = ${tTarget}$.`,
        variables: { i, c1, t1, c2, t2, tTarget },
        correctValue: correctVal,
        distractors: [
          {
            value: simpleVal,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Calculated future value using simple interest $C(1 + it)$ instead of compound interest $C(1+i)^t$.",
          },
          {
            value: offByOneVal,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Compounded for one fewer year ($${tTarget - t1 - 1}$ and $${tTarget - t2 - 1}$ years instead of $${tTarget - t1}$ and $${tTarget - t2}$ years).`,
          },
          {
            value: discountedVal,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Discounted payments backwards in time instead of accumulating forwards to time $t = ${tTarget}$.`,
          },
          {
            value: noInterest,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Neglected interest entirely, computing the undiscounted sum $C_1 + C_2$.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Set up the equation of value accumulated to $t = ${tTarget}$:**
$$AV_{${tTarget}} = C_1(1+i)^{${tTarget} - ${t1}} + C_2(1+i)^{${tTarget} - ${t2}}$$

**Step 2: Substitute given parameters ($i = ${i}$):**
$$AV_{${tTarget}} = ${c1}(1 + ${i})^{${tTarget - t1}} + ${c2}(1 + ${i})^{${tTarget - t2}}$$
$$= ${c1}(${Math.pow(1 + i, tTarget - t1).toFixed(4)}) + ${c2}(${Math.pow(1 + i, tTarget - t2).toFixed(4)})$$
$$= ${(c1 * Math.pow(1 + i, tTarget - t1)).toFixed(2)} + ${(c2 * Math.pow(1 + i, tTarget - t2)).toFixed(2)}$$
$$= \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  // ==========================================
  // DOMAIN 2: ANNUITIES & CASH FLOWS
  // ==========================================
  {
    id: "ANNUITY_LEVEL_IMMEDIATE_PV",
    domain: "ANNUITIES",
    title: "Present Value of Level Annuity-Immediate",
    generate: () => {
      const pmt = randInt(10, 40) * 100;
      const n = randInt(8, 20);
      const i = randFloat(0.04, 0.08, 3);

      const correctVal = pmt * ActuarialMath.annuityImmediate(n, i);

      // Distractor 1: Annuity due (confusing immediate with due, factor (1+i))
      const annuityDueVal = pmt * ActuarialMath.annuityDue(n, i);
      // Distractor 2: simple interest annuity pv
      let simpleAnnuity = 0;
      for (let k = 1; k <= n; k++) {
        simpleAnnuity += pmt / (1 + k * i);
      }
      // Distractor 3: off by one period (n - 1)
      const offByOne = pmt * ActuarialMath.annuityImmediate(n - 1, i);
      // Distractor 4: undiscounted cash flows
      const undiscounted = pmt * n;

      return {
        questionText: `An annuity pays $${pmt.toLocaleString()} at the end of each year for ${n} years. The annual effective interest rate is ${(i * 100).toFixed(2)}%. 
Calculate the present value of this annuity.`,
        variables: { pmt, n, i },
        correctValue: correctVal,
        distractors: [
          {
            value: annuityDueVal,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Used annuity-due formula $\\ddot{a}_{\\overline{n}|i} = (1+i)a_{\\overline{n}|i}$ instead of annuity-immediate $a_{\\overline{n}|i}$.",
          },
          {
            value: offByOne,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Computed present value for $n = ${n - 1}$ periods instead of $n = ${n}$.`,
          },
          {
            value: simpleAnnuity,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Discounted payments using simple interest $\\frac{1}{1 + k i}$ rather than compound interest $v^k$.",
          },
          {
            value: undiscounted,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Summed the payments without discounting for the time value of money ($n \\times P$).",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Identify annuity type and formula:**
The payments occur at the end of each year, so this is a level annuity-immediate:
$$PV = P \\cdot a_{\\overline{n}|i} = P \\cdot \\frac{1 - (1+i)^{-n}}{i}$$

**Step 2: Plug in values ($P = ${pmt}$, $n = ${n}$, $i = ${i}$):**
$$v = \\frac{1}{1 + ${i}} = ${(1 / (1 + i)).toFixed(6)}$$
$$a_{\\overline{${n}}|${i}} = \\frac{1 - (${(1 / (1 + i)).toFixed(6)})^{${n}}}{${i}} = ${ActuarialMath.annuityImmediate(n, i).toFixed(4)}$$

**Step 3: Compute Present Value:**
$$PV = ${pmt} \\cdot ${ActuarialMath.annuityImmediate(n, i).toFixed(4)} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "ANNUITY_ARITHMETIC_INCREASING",
    domain: "ANNUITIES",
    title: "Present Value of Arithmetic Increasing Annuity",
    generate: () => {
      const n = randInt(10, 20);
      const i = randFloat(0.04, 0.07, 3);
      const base = randInt(1, 5) * 100;

      const ia = ActuarialMath.increasingAnnuityImmediate(n, i);
      const correctVal = base * ia;

      // Distractor 1: using a_immediate instead of a_due in the numerator
      const v = ActuarialMath.v(i);
      const aImm = ActuarialMath.annuityImmediate(n, i);
      const dist1 = base * ((aImm - n * Math.pow(v, n)) / i);

      // Distractor 2: Annuity-due increasing: (1+i) * (Ia)
      const dist2 = correctVal * (1 + i);

      // Distractor 3: Off by one period: (Ia)_{n-1}
      const dist3 = base * ActuarialMath.increasingAnnuityImmediate(n - 1, i);

      // Distractor 4: Average payment times level annuity
      const dist4 = ((base * (n + 1)) / 2) * aImm;

      return {
        questionText: `An annuity provides payments at the end of each year for ${n} years. The payment at the end of year $t$ is $${base}t (i.e., $${base} at $t=1$, $${2 * base} at $t=2$, ..., $${n * base} at $t=${n}$). 
The annual effective interest rate is ${(i * 100).toFixed(2)}%. 
Calculate the present value of this increasing annuity.`,
        variables: { base, n, i },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Used $a_{\\overline{n}|}$ instead of $\\ddot{a}_{\\overline{n}|}$ in the numerator of $(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|} - n v^n}{i}$.",
          },
          {
            value: dist2,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Calculated increasing annuity-due $(I\\ddot{a})_{\\overline{n}|i}$ instead of increasing annuity-immediate $(Ia)_{\\overline{n}|i}$.",
          },
          {
            value: dist3,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Evaluated $(Ia)$ for $n = ${n - 1}$ periods instead of $n = ${n}$.`,
          },
          {
            value: dist4,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Approximated increasing cash flows by multiplying average payment by a level annuity factor.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Formula for arithmetic increasing annuity-immediate:**
$$PV = P \\cdot (Ia)_{\\overline{n}|i} = P \\cdot \\left[ \\frac{\\ddot{a}_{\\overline{n}|i} - n v^n}{i} \\right]$$

**Step 2: Calculate components ($n = ${n}$, $i = ${i}$):**
$$v^n = (1 + ${i})^{-${n}} = ${Math.pow(1 / (1 + i), n).toFixed(5)}$$
$$\\ddot{a}_{\\overline{${n}}|${i}} = (1 + ${i}) a_{\\overline{${n}}|${i}} = ${ActuarialMath.annuityDue(n, i).toFixed(4)}$$
$$(Ia)_{\\overline{${n}}|${i}} = \\frac{${ActuarialMath.annuityDue(n, i).toFixed(4)} - ${n}(${Math.pow(1 / (1 + i), n).toFixed(5)})}{${i}} = ${ia.toFixed(4)}$$

**Step 3: Multiply by base unit payment $P = ${base}$:**
$$PV = ${base} \\times ${ia.toFixed(4)} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "ANNUITY_PERPETUITY_GEOMETRIC",
    domain: "ANNUITIES",
    title: "Perpetuity with Geometrically Growing Payments",
    generate: () => {
      const p1 = randInt(1, 5) * 1000;
      const g = randFloat(0.02, 0.035, 3);
      const i = g + randFloat(0.02, 0.04, 3);

      const correctVal = p1 / (i - g);

      // Distractor 1: standard perpetuity (ignoring growth g)
      const dist1 = p1 / i;
      // Distractor 2: adding g instead of subtracting: p1 / (i + g)
      const dist2 = p1 / (i + g);
      // Distractor 3: due version: p1 * (1+i) / (i - g)
      const dist3 = (p1 * (1 + i)) / (i - g);
      // Distractor 4: dividing by g: p1 / g
      const dist4 = p1 / g;

      return {
        questionText: `A perpetuity pays $${p1.toLocaleString()} at the end of the first year. Each subsequent annual payment is ${(g * 100).toFixed(2)}% greater than the previous payment. 
The annual effective interest rate is ${(i * 100).toFixed(2)}%. 
Calculate the present value of this geometrically increasing perpetuity.`,
        variables: { p1, g, i },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Ignored the annual payment growth rate $g$, treating the cash flows as a level perpetuity $P_1 / i$.",
          },
          {
            value: dist3,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Calculated perpetuity-due with first payment made at $t=0$, multiplying by $(1+i)$.",
          },
          {
            value: dist2,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Added growth rate to interest rate in denominator $P_1 / (i + g)$ instead of subtracting $P_1 / (i - g)$.",
          },
          {
            value: dist4,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Divided payment by growth rate $g$ instead of net discount rate $(i - g)$.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Set up present value of growing perpetuity:**
$$PV = \\sum_{t=1}^{\\infty} P_1 (1+g)^{t-1} v^t = \\frac{P_1}{1+i} \\sum_{k=0}^{\\infty} \\left(\\frac{1+g}{1+i}\\right)^k$$

**Step 2: Apply infinite geometric series formula ($g < i$):**
$$PV = \\frac{P_1}{1+i} \\cdot \\frac{1}{1 - \\frac{1+g}{1+i}} = \\frac{P_1}{i - g}$$

**Step 3: Compute with given values ($P_1 = ${p1}$, $i = ${i}$, $g = ${g}$):**
$$PV = \\frac{${p1}}{${i} - ${g}} = \\frac{${p1}}{${(i - g).toFixed(4)}} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  // ==========================================
  // DOMAIN 3: LOANS & AMORTIZATION
  // ==========================================
  {
    id: "LOAN_AMORTIZATION_PAYMENT",
    domain: "LOANS",
    title: "Level Amortization Payment Calculation",
    generate: () => {
      const loanAmount = randInt(15, 50) * 10000;
      const nYears = randChoice([15, 20, 25, 30]);
      const iNominal = randFloat(0.04, 0.08, 3);
      const m = 12; // monthly payments
      const totalPayments = nYears * m;
      const j = iNominal / m; // monthly periodic rate

      const pmt = ActuarialMath.loanPayment(loanAmount, totalPayments, j);

      // Distractor 1: Annuity Due: payment if made at beginning of month: L / a_due
      const dist1 = loanAmount / ActuarialMath.annuityDue(totalPayments, j);
      // Distractor 2: Nominal rate mistake: using annual rate iNominal directly as periodic rate
      const dist2 = ActuarialMath.loanPayment(loanAmount, totalPayments, iNominal);
      // Distractor 3: Simple interest total divided by months: (L + L*i*n)/totalPayments
      const dist3 = (loanAmount * (1 + iNominal * nYears)) / totalPayments;
      // Distractor 4: Off by one year in term: (nYears - 1)*12
      const dist4 = ActuarialMath.loanPayment(loanAmount, (nYears - 1) * m, j);

      return {
        questionText: `A borrower takes out a $${loanAmount.toLocaleString()} loan to be repaid with equal monthly payments at the end of each month over ${nYears} years. 
The interest rate on the loan is a nominal annual rate of ${(iNominal * 100).toFixed(2)}% compounded monthly. 
Calculate the monthly loan payment.`,
        variables: { loanAmount, nYears, iNominal, m, totalPayments, j },
        correctValue: pmt,
        distractors: [
          {
            value: dist1,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Assumed payments are made at the beginning of each month (annuity-due) instead of the end of each month (annuity-immediate).",
          },
          {
            value: dist3,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Used simple interest add-on formula $\\frac{L(1 + i \\cdot n)}{N}$ instead of compounding amortization.",
          },
          {
            value: dist4,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Amortized over ${nYears - 1} years (${(nYears - 1) * m} payments) instead of ${nYears} years (${totalPayments} payments).`,
          },
          {
            value: dist2,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Used the annual nominal rate directly as the monthly periodic rate without dividing by $12$.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Determine monthly interest rate and number of periods:**
$$j = \\frac{i^{(12)}}{12} = \\frac{${iNominal}}{12} = ${(j * 100).toFixed(4)}\\%$$
$$n = ${nYears} \\times 12 = ${totalPayments} \\text{ payments}$$

**Step 2: Write the amortization equation of value:**
$$L = R \\cdot a_{\\overline{n}|j} \\implies R = \\frac{L}{a_{\\overline{n}|j}}$$

**Step 3: Calculate annuity factor $a_{\\overline{${totalPayments}}|j}$:**
$$a_{\\overline{${totalPayments}}|${j.toFixed(5)}} = \\frac{1 - (1 + ${j.toFixed(5)})^{-${totalPayments}}}{${j.toFixed(5)}} = ${ActuarialMath.annuityImmediate(totalPayments, j).toFixed(4)}$$

**Step 4: Solve for monthly payment $R$:**
$$R = \\frac{\\$${loanAmount.toLocaleString()}}{${ActuarialMath.annuityImmediate(totalPayments, j).toFixed(4)}} = \\$${pmt.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "LOAN_OUTSTANDING_BALANCE",
    domain: "LOANS",
    title: "Loan Outstanding Balance (Prospective Method)",
    generate: () => {
      const loanAmount = randInt(10, 30) * 10000;
      const n = randInt(15, 30);
      const i = randFloat(0.04, 0.08, 3);
      const t = randInt(5, n - 3);

      const pmt = ActuarialMath.loanPayment(loanAmount, n, i);
      const balance = ActuarialMath.loanProspectiveBalance(pmt, n - t, i);

      // Distractor 1: balance calculated at t-1 (off by one period)
      const dist1 = ActuarialMath.loanProspectiveBalance(pmt, n - (t - 1), i);
      // Distractor 2: linear balance reduction: L * (n - t) / n
      const dist2 = (loanAmount * (n - t)) / n;
      // Distractor 3: balance calculated using annuity due (R * a_due)
      const dist3 = pmt * ActuarialMath.annuityDue(n - t, i);
      // Distractor 4: retrospective balance forgetting interest: L - t * pmt
      const dist4 = loanAmount - t * pmt;

      return {
        questionText: `A loan of $${loanAmount.toLocaleString()} is repaid with equal annual payments at the end of each year for ${n} years at an annual effective interest rate of ${(i * 100).toFixed(2)}%. 
Calculate the outstanding loan balance immediately after the $${t}^{\\text{th}}$ payment is made.`,
        variables: { loanAmount, n, i, t, pmt },
        correctValue: balance,
        distractors: [
          {
            value: dist1,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Calculated balance immediately after payment $t=${t - 1}$ (or before payment $t=${t}$), retaining $n - t + 1 = ${n - t + 1}$ remaining payments.`,
          },
          {
            value: dist3,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Calculated prospective balance using annuity-due $R \\cdot \\ddot{a}_{\\overline{n-t}|i}$ instead of annuity-immediate.",
          },
          {
            value: dist2,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Used straight-line amortization balance $L \\cdot \\frac{n-t}{n}$, ignoring the curvature of the interest portion.",
          },
          {
            value: dist4,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Subtracted total payments made from original loan without accounting for accrued interest ($L - t \\cdot R$).",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Calculate annual level payment $R$:**
$$R = \\frac{L}{a_{\\overline{${n}}|${i}}} = \\frac{${loanAmount}}{${ActuarialMath.annuityImmediate(n, i).toFixed(4)}} = \\$${pmt.toFixed(2)}$$

**Step 2: Apply Prospective Method for Outstanding Balance $B_{${t}}$:**
Immediately after payment $t = ${t}$, there are $n - t = ${n} - ${t} = ${n - t}$ payments remaining.
$$B_{${t}} = R \\cdot a_{\\overline{n - t}|i} = R \\cdot a_{\\overline{${n - t}}|${i}}$$

**Step 3: Evaluate remaining annuity factor and balance:**
$$a_{\\overline{${n - t}}|${i}} = ${ActuarialMath.annuityImmediate(n - t, i).toFixed(4)}$$
$$B_{${t}} = ${pmt.toFixed(2)} \\times ${ActuarialMath.annuityImmediate(n - t, i).toFixed(4)} = \\$${balance.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "LOAN_INTEREST_AND_PRINCIPAL_SPLIT",
    domain: "LOANS",
    title: "Principal and Interest Breakdown of Payment",
    generate: () => {
      const loanAmount = randInt(8, 25) * 10000;
      const n = randInt(10, 20);
      const i = randFloat(0.05, 0.09, 3);
      const t = randInt(3, n - 2);

      const pmt = ActuarialMath.loanPayment(loanAmount, n, i);
      const principalPaid = ActuarialMath.loanPrincipalPaidAt(pmt, n, t, i);
      const interestPaid = pmt - principalPaid;

      // Ask for principal repaid in payment t
      const correctVal = principalPaid;

      // Distractor 1: interest paid instead of principal paid
      const dist1 = interestPaid;
      // Distractor 2: principal paid in payment t+1 (off by one)
      const dist2 = ActuarialMath.loanPrincipalPaidAt(pmt, n, t + 1, i);
      // Distractor 3: principal paid in payment t-1
      const dist3 = ActuarialMath.loanPrincipalPaidAt(pmt, n, t - 1, i);
      // Distractor 4: equal principal split L / n
      const dist4 = loanAmount / n;

      return {
        questionText: `A loan of $${loanAmount.toLocaleString()} is amortized over ${n} years with level annual payments at an annual effective interest rate of ${(i * 100).toFixed(2)}%. 
Determine the amount of principal repaid in the $${t}^{\\text{th}}$ payment.`,
        variables: { loanAmount, n, i, t, pmt },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Computed the interest component $I_{${t}}$ instead of the principal component $P_{${t}}$.`,
          },
          {
            value: dist2,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Computed principal repaid in period $t = ${t + 1}$ instead of period $t = ${t}$.`,
          },
          {
            value: dist3,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Computed principal repaid in period $t = ${t - 1}$ instead of period $t = ${t}$.`,
          },
          {
            value: dist4,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: `Assumed equal principal repayment $L / n$ rather than level total payment amortization.`,
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Calculate annual level payment $R$:**
$$R = \\frac{L}{a_{\\overline{n}|i}} = \\frac{${loanAmount}}{${ActuarialMath.annuityImmediate(n, i).toFixed(4)}} = \\$${pmt.toFixed(2)}$$

**Step 2: Principal component formula for payment $t$:**
$$P_t = R \\cdot v^{n - t + 1}$$
Here, $n = ${n}$, $t = ${t}$, so $n - t + 1 = ${n} - ${t} + 1 = ${n - t + 1}$.

**Step 3: Evaluate $P_{${t}}$:**
$$v = \\frac{1}{1 + ${i}} = ${(1 / (1 + i)).toFixed(6)}$$
$$v^{${n - t + 1}} = ${Math.pow(1 / (1 + i), n - t + 1).toFixed(6)}$$
$$P_{${t}} = ${pmt.toFixed(2)} \\times ${Math.pow(1 / (1 + i), n - t + 1).toFixed(6)} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  // ==========================================
  // DOMAIN 4: BONDS
  // ==========================================
  {
    id: "BOND_BASIC_PRICING",
    domain: "BONDS",
    title: "Pricing of Semi-Annual Coupon Bond",
    generate: () => {
      const par = randChoice([1000, 10000]);
      const nYears = randChoice([10, 15, 20]);
      const rNominal = randFloat(0.05, 0.09, 3); // coupon rate
      const yNominal = randFloat(0.04, 0.08, 3); // yield rate
      const m = 2; // semi-annual

      const nPeriods = nYears * m;
      const r = rNominal / m;
      const y = yNominal / m;
      const coupon = par * r;

      const price = ActuarialMath.bondPrice(par, r, y, par, nPeriods);

      // Distractor 1: Annual compounding mistake: using nYears instead of nPeriods
      const dist1 = ActuarialMath.bondPrice(par, rNominal, yNominal, par, nYears);
      // Distractor 2: Annuity Due on coupons
      const aDue = ActuarialMath.annuityDue(nPeriods, y);
      const dist2 = coupon * aDue + par * Math.pow(1 + y, -nPeriods);
      // Distractor 3: Off by one period: nPeriods - 1
      const dist3 = ActuarialMath.bondPrice(par, r, y, par, nPeriods - 1);
      // Distractor 4: Simple interest pricing
      const dist4 = (par + coupon * nPeriods) / (1 + yNominal * nYears);

      return {
        questionText: `A ${nYears}-year bond with a par value of $${par.toLocaleString()} pays semiannual coupons at a nominal annual rate of ${(rNominal * 100).toFixed(2)}%. 
The bond is redeemable at par and bought to yield a nominal annual rate of ${(yNominal * 100).toFixed(2)}% compounded semiannually. 
Calculate the price of the bond.`,
        variables: { par, nYears, rNominal, yNominal, nPeriods, r, y, coupon },
        correctValue: price,
        distractors: [
          {
            value: dist1,
            type: "NOMINAL_RATE_ERROR",
            explanation: `Priced the bond with annual periods $n = ${nYears}$ instead of semiannual periods $2n = ${nPeriods}$.`,
          },
          {
            value: dist2,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Treated coupons as paid at the beginning of each half-year (annuity-due) instead of the end of each half-year.",
          },
          {
            value: dist3,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Computed price for ${nPeriods - 1} periods instead of ${nPeriods} periods.`,
          },
          {
            value: dist4,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Discounted bond redemption and coupons using simple interest.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Calculate semi-annual coupon and yield rates:**
$$r = \\frac{${rNominal}}{2} = ${(r * 100).toFixed(3)}\\% \\implies Fr = \\$${par} \\times ${r} = \\$${coupon.toFixed(2)}$$
$$y = \\frac{${yNominal}}{2} = ${(y * 100).toFixed(3)}\\%$$
$$n = ${nYears} \\times 2 = ${nPeriods} \\text{ coupon periods}$$

**Step 2: Basic Bond Pricing Formula:**
$$P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n$$
Since redeemable at par, $C = F = \\$${par}$.

**Step 3: Evaluate annuity and present value factors:**
$$a_{\\overline{${nPeriods}}|${y.toFixed(5)}} = ${ActuarialMath.annuityImmediate(nPeriods, y).toFixed(4)}$$
$$v^{${nPeriods}} = (1 + ${y.toFixed(5)})^{-${nPeriods}} = ${Math.pow(1 + y, -nPeriods).toFixed(5)}$$

**Step 4: Compute total purchase price:**
$$P = (${coupon.toFixed(2)} \\times ${ActuarialMath.annuityImmediate(nPeriods, y).toFixed(4)}) + (${par} \\times ${Math.pow(1 + y, -nPeriods).toFixed(5)})$$
$$P = \\$${price.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "BOND_PREMIUM_WRITEDOWN",
    domain: "BONDS",
    title: "Bond Premium Amortization & Book Value",
    generate: () => {
      const par = 1000;
      const nYears = randInt(8, 15);
      const rNominal = randFloat(0.07, 0.1, 3);
      const yNominal = randFloat(0.04, 0.06, 3); // premium bond: r > y
      const m = 2;

      const n = nYears * m;
      const r = rNominal / m;
      const y = yNominal / m;
      const coupon = par * r;
      const t = randInt(3, n - 4);

      // Book value at period t
      const writeDown = (coupon - par * y) * Math.pow(1 + y, -(n - t + 1));
      const correctVal = writeDown;

      // Distractor 1: write-down at t+1 (off by one)
      const dist1 = (coupon - par * y) * Math.pow(1 + y, -(n - (t + 1) + 1));
      // Distractor 2: write-down at t-1
      const dist2 = (coupon - par * y) * Math.pow(1 + y, -(n - (t - 1) + 1));
      // Distractor 3: total coupon minus yield: Fr - y * par
      const dist3 = coupon - par * y;
      // Distractor 4: straight line premium amortization
      const initialPrice = ActuarialMath.bondPrice(par, r, y, par, n);
      const dist4 = (initialPrice - par) / n;

      return {
        questionText: `A ${nYears}-year bond with par value $${par} pays semiannual coupons at a nominal rate of ${(rNominal * 100).toFixed(2)}% compounded semiannually. 
The bond is purchased at premium to yield a nominal annual rate of ${(yNominal * 100).toFixed(2)}% compounded semiannually. 
Calculate the amount of premium written down in the $${t}^{\\text{th}}$ coupon payment.`,
        variables: { par, nYears, rNominal, yNominal, n, t, coupon, y },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Calculated premium write-down for period $t = ${t + 1}$ instead of $t = ${t}$.`,
          },
          {
            value: dist2,
            type: "OFF_BY_ONE_PERIOD",
            explanation: `Calculated premium write-down for period $t = ${t - 1}$ instead of $t = ${t}$.`,
          },
          {
            value: dist4,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Assumed straight-line premium amortization $(P - C) / n$ instead of compound yield amortization.",
          },
          {
            value: dist3,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Calculated $(Fr - Ci)$ directly without discounting by $v^{n-t+1}$.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Determine periodic coupon and yield:**
$$Fr = ${par} \\times \\frac{${rNominal}}{2} = \\$${coupon.toFixed(2)}$$
$$y = \\frac{${yNominal}}{2} = ${(y * 100).toFixed(3)}\\%$$
$$n = ${n} \\text{ half-years}$$

**Step 2: Premium write-down formula in coupon $t$:**
The principal adjustment (write-down of premium) in payment $t$ is:
$$p_t = (Fr - Cy) \\cdot v^{n - t + 1}$$
Here $n - t + 1 = ${n} - ${t} + 1 = ${n - t + 1}$.

**Step 3: Evaluate:**
$$Fr - Cy = ${coupon.toFixed(2)} - (${par} \\times ${y.toFixed(5)}) = ${(coupon - par * y).toFixed(4)}$$
$$v^{${n - t + 1}} = (1 + ${y.toFixed(5)})^{-${n - t + 1}} = ${Math.pow(1 + y, -(n - t + 1)).toFixed(5)}$$
$$p_{${t}} = ${(coupon - par * y).toFixed(4)} \\times ${Math.pow(1 + y, -(n - t + 1)).toFixed(5)} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "BOND_CALLABLE_WORST_CASE",
    domain: "BONDS",
    title: "Callable Bond Pricing for Minimum Yield",
    generate: () => {
      const par = 1000;
      const callYear1 = randInt(5, 8);
      const maturityYear = randInt(15, 20);
      const r = randFloat(0.07, 0.09, 3); // annual coupon
      const y = randFloat(0.04, 0.06, 3); // premium bond: r > y

      const coupon = par * r;
      const priceCall = ActuarialMath.bondPrice(par, r, y, par, callYear1);
      const priceMaturity = ActuarialMath.bondPrice(par, r, y, par, maturityYear);

      // Investor must pay lowest price to guarantee yield
      const correctVal = Math.min(priceCall, priceMaturity);

      // Distractor 1: Price assuming maturity
      const dist1 = Math.max(priceCall, priceMaturity);
      // Distractor 2: Average of the two prices
      const dist2 = (priceCall + priceMaturity) / 2;
      // Distractor 3: Annuity due on coupons
      const dist3 = correctVal * (1 + y);
      // Distractor 4: Par value
      const dist4 = par;

      return {
        questionText: `A $${par} par value bond with annual coupons at an effective annual rate of ${(r * 100).toFixed(2)}% matures at par in ${maturityYear} years. 
The bond is callable at par at the end of year ${callYear1} or at any subsequent coupon date up to maturity. 
An investor purchases the bond to guarantee an annual effective yield rate of at least ${(y * 100).toFixed(2)}%. 
Calculate the maximum purchase price the investor should pay.`,
        variables: { par, callYear1, maturityYear, r, y, coupon },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Assumed redemption at maturity ($t=${maturityYear}$), which yields lower price for discount bonds, but for a premium bond ($r > y$), earliest call ($t=${callYear1}$) produces the lowest price.`,
          },
          {
            value: dist3,
            type: "ANNUITY_DUE_CONFUSION",
            explanation: "Multiplied bond price by $(1+y)$ as if coupons are paid at the beginning of each year.",
          },
          {
            value: dist2,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Averaged the prices between the earliest call date and maturity date.",
          },
          {
            value: dist4,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Assumed the bond is purchased at par $1,000.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Analyze whether the bond is priced at premium or discount:**
Coupon rate $r = ${(r * 100).toFixed(2)}\\%$ exceeds desired yield $y = ${(y * 100).toFixed(2)}\\%$ ($r > y$). 
Therefore, this is a **premium bond**.

**Step 2: Actuarial Rule for Callable Bonds:**
- For a premium bond ($r > y$), the investor's minimum yield occurs if the bond is called at the **earliest possible date** ($n = ${callYear1}$ years).
- To guarantee a yield of at least ${(y * 100).toFixed(2)}%, the investor must pay no more than the price based on redemption at $t = ${callYear1}$.

**Step 3: Calculate price at earliest call date $n = ${callYear1}$:**
$$P = Fr \\cdot a_{\\overline{${callYear1}}|${y}} + C \\cdot v^{${callYear1}}$$
$$P = ${coupon.toFixed(2)} \\cdot ${ActuarialMath.annuityImmediate(callYear1, y).toFixed(4)} + ${par} \\cdot ${(Math.pow(1 / (1 + y), callYear1)).toFixed(5)}$$
$$P = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  // ==========================================
  // DOMAIN 5: ASSET-LIABILITY MANAGEMENT (ALM)
  // ==========================================
  {
    id: "ALM_MACAULAY_DURATION",
    domain: "ALM_IMMUNIZATION",
    title: "Macaulay Duration of a Coupon Bond",
    generate: () => {
      const par = 1000;
      const n = randChoice([3, 4, 5]);
      const r = randFloat(0.05, 0.08, 3);
      const y = randFloat(0.04, 0.07, 3);

      const dMac = ActuarialMath.bondMacaulayDuration(par, r, y, par, n);
      const correctVal = dMac;

      // Distractor 1: Modified duration instead of Macaulay: D_mac / (1 + y)
      const dist1 = dMac / (1 + y);
      // Distractor 2: Maturity n (zero coupon duration)
      const dist2 = n;
      // Distractor 3: Simple weighted average without discounting
      const coupon = par * r;
      let numNoDisc = 0;
      let denNoDisc = 0;
      for (let t = 1; t <= n; t++) {
        const amt = t === n ? coupon + par : coupon;
        numNoDisc += t * amt;
        denNoDisc += amt;
      }
      const dist3 = numNoDisc / denNoDisc;
      // Distractor 4: Off by one year
      const dist4 = dMac - 1;

      return {
        questionText: `A ${n}-year bond with par value $${par} pays annual coupons of ${(r * 100).toFixed(2)}% and is redeemed at par. 
The annual effective yield rate is ${(y * 100).toFixed(2)}%. 
Calculate the Macaulay duration of the bond (in years).`,
        variables: { par, n, r, y, dMac },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Calculated Modified duration $D_{\\text{mod}} = \\frac{D_{\\text{mac}}}{1+y}$ instead of Macaulay duration $D_{\\text{mac}}$.",
          },
          {
            value: dist2,
            type: "NOMINAL_RATE_ERROR",
            explanation: `Equated duration to bond maturity $n = ${n}$, which is only true for a zero-coupon bond.`,
          },
          {
            value: dist3,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Weighted cash flows by timing without discounting by present value factors $v^t$.",
          },
          {
            value: dist4,
            type: "OFF_BY_ONE_PERIOD",
            explanation: "Subtracted 1 period from the computed duration.",
          },
        ],
        format: "YEARS",
        solutionSteps: `**Step 1: Formula for Macaulay Duration:**
$$D_{\\text{mac}} = \\frac{\\sum_{t=1}^n t \\cdot C_t \\cdot v^t}{\\sum_{t=1}^n C_t \\cdot v^t} = \\frac{\\sum t \\cdot C_t \\cdot v^t}{P}$$

**Step 2: List cash flows and present values ($y = ${y}$, $v = ${(1 / (1 + y)).toFixed(4)}$):**
Coupons are $${(par * r).toFixed(2)} at $t=1,\\dots,${n - 1}$, and $${(par * r + par).toFixed(2)} at $t=${n}$.

**Step 3: Evaluate numerator and denominator:**
Numerator $\\sum t \\cdot C_t \\cdot v^t = ${(dMac * ActuarialMath.bondPrice(par, r, y, par, n)).toFixed(2)}$
Denominator (Price $P$) $= \\$${ActuarialMath.bondPrice(par, r, y, par, n).toFixed(2)}$

**Step 4: Compute Macaulay Duration:**
$$D_{\\text{mac}} = \\frac{${(dMac * ActuarialMath.bondPrice(par, r, y, par, n)).toFixed(2)}}{${ActuarialMath.bondPrice(par, r, y, par, n).toFixed(2)}} = ${dMac.toFixed(2)} \\text{ years}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "ALM_REDINGTON_IMMUNIZATION",
    domain: "ALM_IMMUNIZATION",
    title: "Redington Immunization Asset Allocation",
    generate: () => {
      const tL = randChoice([6, 8, 10]);
      const L = randInt(10, 30) * 10000;
      const y = randFloat(0.05, 0.08, 3);
      const t1 = randInt(1, 3);
      const t2 = randInt(tL + 2, 16);

      const vL = L * Math.pow(1 + y, -tL);
      const A1_pv = (vL * (t2 - tL)) / (t2 - t1);
      const A2_pv = vL - A1_pv;

      const A1_cf = A1_pv * Math.pow(1 + y, t1);
      const correctVal = A1_cf;

      // Distractor 1: PV of asset 1 instead of nominal cash flow
      const dist1 = A1_pv;
      // Distractor 2: Nominal cash flow of asset 2
      const dist2 = A2_pv * Math.pow(1 + y, t2);
      // Distractor 3: Undiscounted linear allocation
      const dist3 = (L * (t2 - tL)) / (t2 - t1);
      // Distractor 4: Equal cash flow split L / 2
      const dist4 = L / 2;

      return {
        questionText: `An insurer has a single liability of $${L.toLocaleString()} due at time $t = ${tL}$. 
The current annual effective interest rate is ${(y * 100).toFixed(2)}%. 
To Redington immunize this liability, the insurer purchases zero-coupon bonds maturing at time $t = ${t1}$ and time $t = ${t2}$. 
Calculate the maturity value (nominal payout) of the zero-coupon bond maturing at time $t = ${t1}$.`,
        variables: { tL, L, y, t1, t2, A1_pv, A2_pv, A1_cf },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Calculated the present value of the asset $PV(A_1)$ instead of its nominal cash flow payment at maturity $A_1 = PV(A_1)(1+y)^{${t1}}$.`,
          },
          {
            value: dist2,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Calculated the cash flow for the $t = ${t2}$ asset rather than the $t = ${t1}$ asset.`,
          },
          {
            value: dist3,
            type: "SIMPLE_INTEREST_ERROR",
            explanation: "Allocated undiscounted liability cash flows without discounting to time $t=0$.",
          },
          {
            value: dist4,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Assumed equal 50/50 allocation between the two immunization assets.",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: Redington Immunization conditions:**
1. $PV(A) = PV(L)$
2. $D_{\\text{mac}}(A) = D_{\\text{mac}}(L) = ${tL}$
3. Convexity condition $C_A > C_L$ is satisfied since $t_1 < t_L < t_2$.

**Step 2: Present value of liability:**
$$PV(L) = ${L} \\cdot (1 + ${y})^{-${tL}} = \\$${vL.toFixed(2)}$$

**Step 3: Solve simultaneous equations for present values $PV(A_1)$ and $PV(A_2)$:**
$$PV(A_1) + PV(A_2) = PV(L)$$
$$${t1} \\cdot PV(A_1) + ${t2} \\cdot PV(A_2) = ${tL} \\cdot PV(L)$$
$$PV(A_1) = PV(L) \\cdot \\frac{${t2} - ${tL}}{${t2} - ${t1}} = ${vL.toFixed(2)} \\times \\frac{${t2 - tL}}{${t2 - t1}} = \\$${A1_pv.toFixed(2)}$$

**Step 4: Compute nominal payout of zero-coupon bond at $t = ${t1}$:**
$$C_1 = PV(A_1) \\cdot (1 + ${y})^{${t1}} = ${A1_pv.toFixed(2)} \\cdot ${(Math.pow(1 + y, t1)).toFixed(4)} = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },

  {
    id: "ALM_MODIFIED_DURATION_PRICE_CHANGE",
    domain: "ALM_IMMUNIZATION",
    title: "Price Sensitivity Approximation Using Modified Duration",
    generate: () => {
      const price = randInt(90, 115) * 10;
      const dMod = randFloat(4.5, 9.5, 2);
      const deltaBps = randChoice([25, 50, 75, 100]); // basis points
      const deltaY = deltaBps / 10000;
      const direction = randChoice(["increases", "decreases"]);
      const sign = direction === "increases" ? 1 : -1;

      // Delta P ≈ - D_mod * P * Delta y
      const deltaP = -dMod * price * (sign * deltaY);
      const newPrice = price + deltaP;

      const correctVal = newPrice;

      // Distractor 1: Wrong direction
      const dist1 = price - deltaP;
      // Distractor 2: Using Macaulay duration approximation
      const dist2 = price * (1 - sign * (dMod * 1.05) * deltaY);
      // Distractor 3: Forgetting to multiply by price
      const dist3 = Math.abs(deltaP);
      // Distractor 4: Percentage error
      const dist4 = price * (1 - sign * dMod * (deltaBps / 100));

      return {
        questionText: `A portfolio of bonds currently has a market value of $${price.toFixed(2)} and a modified duration of ${dMod.toFixed(2)} years. 
If the annual yield to maturity ${direction} by ${deltaBps} basis points, estimate the new market value of the portfolio using the first-order modified duration approximation.`,
        variables: { price, dMod, deltaBps, deltaY, direction, sign },
        correctValue: correctVal,
        distractors: [
          {
            value: dist1,
            type: "CALCULATION_DISTRACTOR",
            explanation: `Applied price change with incorrect sign (bond prices move inversely to interest rates: when yield ${direction}, price must ${direction === "increases" ? "fall" : "rise"}).`,
          },
          {
            value: dist2,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Used Macaulay duration instead of Modified duration in the price sensitivity formula.",
          },
          {
            value: dist3,
            type: "CALCULATION_DISTRACTOR",
            explanation: "Reported the absolute price change $\\Delta P$ instead of the new market value $P + \\Delta P$.",
          },
          {
            value: dist4,
            type: "NOMINAL_RATE_ERROR",
            explanation: "Confused basis points with whole percentage points (1 bp = 0.0001).",
          },
        ],
        format: "CURRENCY",
        solutionSteps: `**Step 1: First-order Modified Duration approximation formula:**
$$\\frac{\\Delta P}{P} \\approx - D_{\\text{mod}} \\cdot \\Delta y$$
$$\\Delta P \\approx - D_{\\text{mod}} \\cdot P \\cdot \\Delta y$$

**Step 2: Identify parameter values:**
$$P = \\$${price.toFixed(2)}$$
$$D_{\\text{mod}} = ${dMod.toFixed(2)}$$
$$\\Delta y = ${sign > 0 ? "+" : "-"}${deltaBps} \\text{ bps} = ${sign > 0 ? "+" : "-"}${(deltaY).toFixed(4)}$$

**Step 3: Compute price change $\\Delta P$ and new price:**
$$\\Delta P \\approx - (${dMod.toFixed(2)}) \\times (${price.toFixed(2)}) \\times (${(sign * deltaY).toFixed(4)}) = ${(deltaP).toFixed(2)}$$
$$\\text{New Price} = P + \\Delta P = ${price.toFixed(2)} + (${deltaP.toFixed(2)}) = \\$${correctVal.toFixed(2)}$$`,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      };
    },
  },
];
