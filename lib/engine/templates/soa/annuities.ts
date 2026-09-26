/**
 * Annuities with level payments, deferred and block payments, perpetuities,
 * funds and continuous annuities — modelled on the SOA sample-set question
 * types for the annuities section of the syllabus.
 */
import type { Rng } from "../../random";
import { distractor, type GeneratedQuestionItem, type QuestionTemplateDefinition } from "../types";
import {
  acc,
  adue,
  amt,
  an,
  cast,
  close,
  dec,
  drawUntil,
  eff,
  gridAmount,
  gridRate,
  mamt,
  mn,
  mpc,
  n,
  nom,
  listing,
  ord,
  pc,
  sdue,
  sn,
  solve,
  trySolve,
  v,
  word,
} from "./kit";

const ANN = "ANNUITIES" as const;

/** `every six months`, `every three months`, `every month`. */
function everyMonths(months: number): string {
  return months === 1 ? "every month" : months === 12 ? "every year" : `every ${word(months)} months`;
}

export const SOA_ANNUITY_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ANN_BLOCK_DEPOSITS_RATIO",
    domain: ANN,
    title: "Deposits at the Start of Multi-Year Periods",
    objective: "Accumulate deposits made once every k years using the equivalent k-year rate, given a ratio of accumulated values.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [2],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const { D, k, half, ratio, j } = drawUntil(
        () => {
          const D = rng.choice([100, 200, 500]);
          const k = rng.choice([2, 3, 4, 5]);
          const half = rng.choice([4, 5, 6, 8]);
          const ratio = rng.choice([3, 4, 5]);
          const j = Math.pow(ratio - 1, 1 / half) - 1;
          return { D, k, half, ratio, j };
        },
        (p) => {
          const i = Math.pow(1 + p.j, 1 / p.k) - 1;
          return i > 0.02 && i < 0.14;
        },
        { D: 100, k: 4, half: 5, ratio: 5, j: Math.pow(4, 0.2) - 1 }
      );
      const N = 2 * half * k;
      const M = half * k;
      const X = (D * (1 + j) * (Math.pow(1 + j, 2 * half) - 1)) / j;
      const avHalf = (D * (1 + j) * (Math.pow(1 + j, half) - 1)) / j;
      const jWrong = Math.pow(ratio, 1 / half) - 1;
      return {
        questionText: `At the start of every ${k}-year period for ${N} years, ${saver} deposits ${n(D)} into a fund that earns an annual effective interest rate of $i$.
The fund's value at the end of ${N} years is $X$, which is ${ratio} times its value at the end of ${M} years.
Calculate $X$.`,
        variables: { D, k, N, M, ratio },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((D * (Math.pow(1 + j, 2 * half) - 1)) / j, "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each period."),
          distractor((D * (1 + jWrong) * (Math.pow(1 + jWrong, 2 * half) - 1)) / jWrong, "CALCULATION_DISTRACTOR", `Set $(1+j)^{${half}}$ equal to ${ratio}; the ratio of accumulated values is $(1+j)^{${half}} + 1$.`),
          distractor(ratio * (D * (Math.pow(1 + j, half) - 1)) / j, "ANNUITY_DUE_CONFUSION", "Scaled an annuity-immediate value by the ratio instead of accumulating the deposits."),
          distractor(2 * avHalf * Math.pow(1 + j, half), "CALCULATION_DISTRACTOR", "Doubled the first half's deposits instead of adding the second half's deposits separately."),
        ],
        solutionSteps: `**Step 1 — Work in ${k}-year periods.** Let $j = (1+i)^{${k}} - 1$ be the effective rate per ${k}-year period. The deposits form an annuity-due of ${2 * half} periods, and after $m$ periods the fund holds $${mn(D)}\\,\\ddot{s}_{\\overline{m}|j}$.

**Step 2 — Use the ratio.**
$$\\frac{\\ddot{s}_{\\overline{${2 * half}}|j}}{\\ddot{s}_{\\overline{${half}}|j}} = \\frac{(1+j)^{${2 * half}} - 1}{(1+j)^{${half}} - 1} = (1+j)^{${half}} + 1 = ${ratio} \\implies (1+j)^{${half}} = ${ratio - 1},$$
so $j = ${dec(j, 6)}$.

**Step 3 — Accumulate.**
$$X = ${mn(D)}\\,\\ddot{s}_{\\overline{${2 * half}}|j} = ${mn(D)}(1+j)\\frac{(1+j)^{${2 * half}} - 1}{j} = ${mn(D)}(${dec(1 + j, 6)})\\frac{${(ratio - 1) ** 2} - 1}{${dec(j, 6)}} = ${mn(X, 2)}.$$`,
        checks: [{ label: "ratio of accumulated values", ok: close(X / avHalf, ratio) }],
      };
    },
  },

  {
    id: "FM_ANN_PERPETUITY_SPLIT_SHARES",
    domain: ANN,
    title: "Sharing a Perpetuity among Successive Recipients",
    objective: "Split a level perpetuity's present value among recipients of consecutive blocks of payments.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [20],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const s = rng.choice([0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]);
      const vn = 1 - s;
      const askSecond = rng.next() < 0.4;
      const answer = askSecond ? s * vn : vn * vn;
      const recipient = askSecond ? second : "the charity";
      return {
        questionText: `A perpetuity-immediate pays $X$ per year. ${first} receives the first $n$ payments, ${second} receives the next $n$ payments, and a charity receives all remaining payments.
${first}'s share of the perpetuity's present value is ${pc(s)}.
Calculate the share of the present value that ${recipient} receives.`,
        variables: { s, askSecond: askSecond ? 1 : 0 },
        correctValue: answer * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((askSecond ? vn * vn : s * vn) * 100, "CALCULATION_DISTRACTOR", askSecond ? "Computed the charity's share instead." : `Computed ${second}'s share instead.`),
          distractor((1 - 2 * s) * 100, "SIMPLE_INTEREST_ERROR", "Assumed each block of $n$ payments is worth the same share."),
          distractor(s * 100, "CALCULATION_DISTRACTOR", `Assumed ${recipient} receives the same share as ${first}.`),
          distractor(vn * 100, "OFF_BY_ONE_PERIOD", "Took $v^n$ itself as the share; the later payments are deferred again."),
        ],
        solutionSteps: `**Step 1 — Shares in terms of $v^n$.** Measured as fractions of $X/i$:
$$\\text{${first}}: 1 - v^n, \\qquad \\text{${second}}: v^n(1 - v^n), \\qquad \\text{charity}: v^{2n}.$$
So $1 - v^n = ${dec(s, 2)}$ gives $v^n = ${dec(vn, 2)}$.

**Step 2 — Evaluate.** ${askSecond ? `${second}'s share is $${dec(vn, 2)}(${dec(s, 2)}) = ${dec(answer, 4)}$, or ${mpc(answer)}.` : `The charity's share is $(${dec(vn, 2)})^2 = ${dec(answer, 4)}$, or ${mpc(answer)}.`}`,
        checks: [{ label: "shares sum to one", ok: close(s + s * vn + vn * vn, 1) }],
      };
    },
  },

  {
    id: "FM_ANN_PERPETUITY_FREQUENCY_CONVERSION",
    domain: ANN,
    title: "Perpetuities Paid at Different Frequencies",
    objective: "Extract the interest rate from one perpetuity and value a perpetuity paid at a different frequency.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [24, 66, 173, 286, 428],
    generate: (rng: Rng) => {
      const k = rng.choice([2, 3, 4, 5]);
      const R = rng.choice([10, 100, 500, 1000]);
      const firstDue = rng.next() < 0.4;
      const months = rng.choice([1, 3, 4, 6]);
      const secondDue = rng.next() < 0.4;
      const target = gridRate(rng, 0.04, 0.1, 0.005);
      const growth = Math.pow(1 + target, k);
      const exactP1 = firstDue ? (R * growth) / (growth - 1) : R / (growth - 1);
      const P1 = exactP1 >= 100 ? Math.round(exactP1) : Number(exactP1.toFixed(1));
      const factor = firstDue ? P1 / (P1 - R) : 1 + R / P1;
      const i = Math.pow(factor, 1 / k) - 1;
      const S = R >= 100 ? R / 10 : 1;
      const j = Math.pow(1 + i, months / 12) - 1;
      const PV2 = secondDue ? (S * (1 + j)) / j : S / j;
      const jSimple = (i * months) / 12;
      const format = PV2 >= 1000 ? "AMOUNT_0" : "AMOUNT_1";
      return {
        questionText: `At an annual effective interest rate of $i$, the present value of a perpetuity paying ${n(R)} every ${k} years, with the first payment ${firstDue ? "made immediately" : `at the end of year ${k}`}, is ${n(P1, P1 % 1 === 0 ? 0 : 1)}.
At the same rate, a second perpetuity pays ${n(S)} ${everyMonths(months)}, with the first payment ${secondDue ? "made immediately" : `at the end of ${months === 1 ? "one month" : `${word(months)} months`}`}.
Calculate the present value of the second perpetuity.`,
        variables: { k, R, firstDue: firstDue ? 1 : 0, P1, months, secondDue: secondDue ? 1 : 0, S },
        correctValue: PV2,
        format,
        distractors: [
          distractor(secondDue ? S / j : (S * (1 + j)) / j, "ANNUITY_DUE_CONFUSION", secondDue ? "Valued the second perpetuity as payable at the end of each period." : "Valued the second perpetuity as payable at the start of each period."),
          distractor(secondDue ? (S * (1 + jSimple)) / jSimple : S / jSimple, "NOMINAL_RATE_ERROR", `Divided the annual rate by ${12 / months} instead of converting it to an equivalent ${months}-month rate.`),
          distractor(
            (() => {
              const wrongFactor = firstDue ? 1 + R / P1 : P1 / (P1 - R);
              const wi = Math.pow(wrongFactor, 1 / k) - 1;
              const wj = Math.pow(1 + wi, months / 12) - 1;
              return secondDue ? (S * (1 + wj)) / wj : S / wj;
            })(),
            "ANNUITY_DUE_CONFUSION",
            `Read the first perpetuity as ${firstDue ? "starting at the end of the first period" : "starting immediately"}.`
          ),
          distractor(secondDue ? (S * (1 + i)) / i : S / i, "NOMINAL_RATE_ERROR", "Used the annual effective rate as the rate per payment period."),
        ],
        solutionSteps: `**Step 1 — Rate from the first perpetuity.** Per ${k}-year period the effective rate is $J = (1+i)^{${k}} - 1$. ${firstDue ? `A perpetuity-due is worth $${mn(R)}(1+J)/J$, so $(1+i)^{${k}} = \\dfrac{${mamt(P1)}}{${mamt(P1)} - ${mn(R)}} = ${dec(factor, 6)}$.` : `A perpetuity-immediate is worth $${mn(R)}/J$, so $(1+i)^{${k}} = 1 + \\dfrac{${mn(R)}}{${mamt(P1)}} = ${dec(factor, 6)}$.`} Hence $i = ${dec(i, 6)}$.

**Step 2 — Value the second perpetuity.** The rate per ${months}-month period is $(1+i)^{${months}/12} - 1 = ${dec(j, 6)}$, so the present value is
$$${secondDue ? `\\frac{${mn(S)}(1 + ${dec(j, 6)})}{${dec(j, 6)}}` : `\\frac{${mn(S)}}{${dec(j, 6)}}`} = ${mn(PV2, 2)}.$$`,
        checks: [
          {
            label: "first perpetuity reproduces its price",
            ok: close(firstDue ? (R * acc(i, k)) / (acc(i, k) - 1) : R / (acc(i, k) - 1), P1),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_RETIREMENT_INCOME_FACTOR",
    domain: ANN,
    title: "Funding Retirement Income from an Annuity Purchase Rate",
    objective: "Use an annuity purchase rate to find the fund needed and the level monthly contribution that builds it.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [35],
    generate: (rng: Rng) => {
      const age = rng.choice([35, 40, 45]);
      const years = 65 - age;
      const income = gridAmount(rng, 2000, 5000, 250);
      const rate = Number((rng.int(130, 210) * 0.05).toFixed(2));
      const j = gridRate(rng, 0.05, 0.09, 0.005);
      const r = j / 12;
      const fund = (income / rate) * 1000;
      const X = fund / sdue(12 * years, r);
      return {
        questionText: `A worker turns ${age} today and wants retirement income of ${n(income)} at the beginning of each month, starting on the worker's 65th birthday.
Starting today, the worker makes monthly contributions of $X$ to a fund for ${years} years. The fund earns ${nom(j, 12)}.
On the worker's 65th birthday, each 1000 in the fund will provide ${dec(rate, 2)} of income at the beginning of each month, starting immediately and continuing for life.
Calculate $X$.`,
        variables: { age, years, income, rate, j },
        correctValue: X,
        format: "AMOUNT_2",
        distractors: [
          distractor(fund / sn(12 * years, r), "ANNUITY_DUE_CONFUSION", "Treated the contributions as made at the end of each month."),
          distractor(fund / sdue(12 * years, Math.pow(1 + j, 1 / 12) - 1), "NOMINAL_RATE_ERROR", `Treated ${pc(j)} as an annual effective rate.`),
          distractor(fund / sdue(12 * (years - 1), r), "OFF_BY_ONE_PERIOD", `Counted contributions for ${years - 1} years instead of ${years}.`),
          distractor((income * rate) / sdue(12 * years, r), "CALCULATION_DISTRACTOR", "Multiplied by the purchase rate instead of dividing by it."),
        ],
        solutionSteps: `**Step 1 — Fund needed at 65.** Each 1000 buys ${dec(rate, 2)} of monthly income, so
$$\\text{Fund} = \\frac{${mn(income)}}{${dec(rate, 2)}} \\times 1000 = ${mn(fund, 2)}.$$

**Step 2 — Accumulation factor.** Contributions are made at the start of each month for ${12 * years} months at $${dec(j, 3)}/12$ per month:
$$\\ddot{s}_{\\overline{${12 * years}}|${dec(r, 6)}} = ${dec(sdue(12 * years, r), 4)}.$$

**Step 3 — Solve for $X$.** $X = ${mn(fund, 2)}/${dec(sdue(12 * years, r), 4)} = ${mn(X, 2)}$.`,
        checks: [{ label: "contributions build the fund", ok: close(X * sdue(12 * years, r), fund) }],
      };
    },
  },

  {
    id: "FM_ANN_COLLEGE_FUNDING_BIRTHDAYS",
    domain: ANN,
    title: "Level Contributions Funding Later Withdrawals",
    objective: "Equate the present value of level contributions with a block of later withdrawals.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [36],
    generate: (rng: Rng) => {
      const last = rng.choice([15, 16, 17]);
      const W = gridAmount(rng, 20000, 60000, 5000);
      const count = 4;
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const pvW = Array.from({ length: count }, (_, k) => W * v(i, last + 1 + k)).reduce((a, b) => a + b, 0);
      const X = pvW / an(last, i);
      return {
        questionText: `At the birth of their daughter, two parents decide they will need ${n(W)} on each of her ${ord(last + 1)} through ${ord(last + count)} birthdays to pay for college.
They will contribute $X$ on each of her 1st through ${ord(last)} birthdays. The contributions earn ${eff(i)}.
Calculate $X$.`,
        variables: { last, W, count, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(pvW / adue(last, i), "ANNUITY_DUE_CONFUSION", "Valued the contributions as starting at birth."),
          distractor((count * W) / sn(last, i), "CALCULATION_DISTRACTOR", "Accumulated the contributions to the first withdrawal date but did not discount the later withdrawals."),
          distractor((count * W) / last, "SIMPLE_INTEREST_ERROR", "Ignored interest altogether."),
          distractor(Array.from({ length: count }, (_, k) => W * v(i, last + k)).reduce((a, b) => a + b, 0) / an(last, i), "OFF_BY_ONE_PERIOD", "Discounted each withdrawal one year too few."),
        ],
        solutionSteps: `**Step 1 — Present value of the withdrawals.**
$$${mn(W)}\\left(v^{${last + 1}} + \\cdots + v^{${last + count}}\\right) = ${mn(W)}\\,v^{${last}}a_{\\overline{${count}}|} = ${mn(pvW, 2)}.$$

**Step 2 — Equate with the contributions.**
$$X\\,a_{\\overline{${last}}|${mpc(i)}} = ${mn(pvW, 2)} \\implies X = \\frac{${mn(pvW, 2)}}{${dec(an(last, i), 5)}} = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "fund is exhausted by the last withdrawal",
            ok: Math.abs(
              X * sn(last, i) * acc(i, count) -
                Array.from({ length: count }, (_, k) => W * acc(i, count - 1 - k)).reduce((a, b) => a + b, 0)
            ) < 1e-6 * W,
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_FINAL_SMALLER_WITHDRAWAL",
    domain: ANN,
    title: "Smaller Final Withdrawal after a Level Annuity-Due",
    objective: "Accumulate a fund, count the full withdrawals it supports, and size the smaller final withdrawal.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [65],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const D = gridAmount(rng, 1000, 5000, 500);
          const N = rng.choice([15, 20, 25]);
          // The final withdrawal is a small remainder of a large fund, so the
          // printed rate must be exact: 3%, 4% or 5% a half-year gives 6.09%,
          // 8.16% or 10.25% a year with no rounding.
          const m = 2;
          const j = rng.choice([0.03, 0.04, 0.05]);
          const i = Math.pow(1 + j, m) - 1;
          const F = D * sdue(N, i);
          const W = Math.round((F / (rng.int(18, 36) + rng.choice([0.3, 0.4, 0.5, 0.6, 0.7])) / 100) * 1.1) * 100;
          const nStar = Math.log(1 - (F * j) / (W * (1 + j))) / -Math.log(1 + j);
          return { D, N, m, j, i, F, W, nStar };
        },
        (p) => Number.isFinite(p.nStar) && p.nStar > 12 && p.nStar < 50 && p.nStar % 1 > 0.1 && p.nStar % 1 < 0.9,
        { D: 1000, N: 20, m: 2, j: 0.04, i: 0.0816, F: 1000 * sdue(20, 0.0816), W: 3000, nStar: 26.47 }
      );
      const { D, N, m, j, i, F, W, nStar } = params;
      const full = Math.floor(nStar);
      const final = (F - W * adue(full, j)) * acc(j, full);
      const period = m === 2 ? "six months" : "three months";
      return {
        questionText: `A worker deposits ${n(D)} into a fund at the beginning of each year for ${N} years.
At the end of the ${N} years, the worker begins withdrawals of ${n(W)} at the beginning of every ${period}, with a smaller final withdrawal that exhausts the fund.
The fund earns ${eff(i)}.
Calculate the amount of the final withdrawal.`,
        variables: { D, N, m, i: Number(i.toFixed(8)), W },
        correctValue: final,
        format: "AMOUNT_0",
        distractors: [
          distractor(final * (1 + j), "OFF_BY_ONE_PERIOD", "Accumulated the remainder one period past the date of the final withdrawal."),
          distractor(F - W * adue(full, j), "CALCULATION_DISTRACTOR", "Left the remaining value at its present value instead of accumulating it to the withdrawal date."),
          distractor(W * (nStar - full), "SIMPLE_INTEREST_ERROR", "Took the fractional number of payments times the withdrawal as the final amount."),
          distractor((D * sn(N, i) - W * adue(full, j)) * acc(j, full), "ANNUITY_DUE_CONFUSION", "Accumulated the deposits as though made at the end of each year."),
        ],
        solutionSteps: `**Step 1 — Fund at the end of year ${N}.** $${mn(D)}\\,\\ddot{s}_{\\overline{${N}}|${mpc(i, 4)}} = ${mn(F, 2)}$.

**Step 2 — Count the full withdrawals.** The rate per ${period} is $(1+i)^{1/${m}} - 1 = ${mpc(j, 2)}$. Solving $${mn(W)}\\,\\ddot{a}_{\\overline{n}|${mpc(j, 2)}} = ${mn(F, 2)}$ gives $n = ${dec(nStar, 2)}$, so there are ${full} full withdrawals followed by a smaller one.

**Step 3 — Final withdrawal.** The final withdrawal is made ${full} periods after the first, so
$$X = \\left(${mn(F, 2)} - ${mn(W)}\\,\\ddot{a}_{\\overline{${full}}|}\\right)(${dec(1 + j, 4)})^{${full}} = ${mn(final, 2)}.$$`,
        checks: [
          { label: "final withdrawal is smaller than a full one", ok: final > 0 && final < W },
          {
            label: "withdrawals exhaust the fund",
            ok: close(W * adue(full, j) + final * v(j, full), F),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_TWO_RATE_ACCUMULATION_DEPOSIT",
    domain: ANN,
    title: "Level Deposits Accumulating through a Rate Change",
    objective: "Accumulate level deposits through one rate period and a later rate period to reach a target.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [68],
    generate: (rng: Rng) => {
      const F = gridAmount(rng, 5000, 50000, 1000);
      const n1 = rng.choice([8, 10, 12]);
      const n2 = rng.choice([3, 5, 8]);
      const i1 = gridRate(rng, 0.04, 0.08, 0.005);
      const i2 = gridRate(rng, 0.03, i1, 0.005);
      const X = F / (sn(n1, i1) * acc(i2, n2));
      return {
        questionText: `An investor wants ${n(F)} in a fund at the end of ${n1 + n2} years. The investor makes equal deposits of $X$ at the end of each year for the first ${n1} years.
The fund earns ${eff(i1)} during the first ${n1} years and ${eff(i2)} for the next ${n2} years.
Calculate $X$.`,
        variables: { F, n1, n2, i1, i2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(F / (sn(n1, i1) * acc(i1, n2)), "CALCULATION_DISTRACTOR", `Applied ${pc(i1)} for all ${n1 + n2} years.`),
          distractor(F / sn(n1, i1), "OFF_BY_ONE_PERIOD", `Stopped the accumulation at year ${n1}.`),
          distractor(F / (sdue(n1, i1) * acc(i2, n2)), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the start of each year."),
          distractor(F / (sn(n1, i2) * acc(i2, n2)), "CALCULATION_DISTRACTOR", `Applied ${pc(i2)} for all ${n1 + n2} years.`),
        ],
        solutionSteps: `**Step 1 — Value at the end of year ${n1}.** $X\\,s_{\\overline{${n1}}|${mpc(i1)}} = ${dec(sn(n1, i1), 5)}X$.

**Step 2 — Accumulate and solve.**
$$${dec(sn(n1, i1), 5)}X\\,(${dec(1 + i2, 3)})^{${n2}} = ${mn(F)} \\implies X = ${mn(X, 2)}.$$`,
        checks: [{ label: "target reached", ok: close(X * sn(n1, i1) * acc(i2, n2), F) }],
      };
    },
  },

  {
    id: "FM_ANN_TUITION_FUND_SHORTFALL",
    domain: ANN,
    title: "Shortfall in a College Savings Fund with Rising Tuition",
    objective: "Track a savings fund through deposits and a growing tuition payment, then find the extra amount needed.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [70],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const T0 = gridAmount(rng, 4000, 12000, 500);
          const g = gridRate(rng, 0.03, 0.06, 0.005);
          const i = gridRate(rng, g + 0.01, g + 0.04, 0.005);
          const N = rng.choice([15, 16, 17, 18]);
          const D = gridAmount(rng, 500, 2000, 50);
          const fund = D * sn(N, i);
          const paidN = T0 * acc(g, N - 1);
          const next = T0 * acc(g, N);
          const X = next - (fund - paidN) * (1 + i);
          return { T0, g, i, N, D, fund, paidN, next, X };
        },
        (p) => p.fund > p.paidN * 1.2 && p.X > 0.05 * p.next && p.X < 0.6 * p.next,
        (() => {
          const fund = 750 * sn(18, 0.07);
          const paidN = 6000 * acc(0.05, 17);
          const next = 6000 * acc(0.05, 18);
          return { T0: 6000, g: 0.05, i: 0.07, N: 18, D: 750, fund, paidN, next, X: next - (fund - paidN) * 1.07 };
        })()
      );
      const { T0, g, i, N, D, fund, paidN, next, X } = params;
      return {
        questionText: `College tuition is ${n(T0)} for the current school year, payable in full at the beginning of the year. Tuition will increase by ${pc(g)} each year.
A parent deposits ${n(D)} into a college savings fund at the beginning of each school year for ${N} years, starting with the current year. The fund earns ${eff(i)}.
Immediately after the ${ord(N)} deposit, the parent pays tuition for the ${ord(N)} school year from the fund.
Calculate the amount the parent will need, in addition to the fund balance, to pay tuition at the beginning of the ${ord(N + 1)} school year.`,
        variables: { T0, g, i, N, D },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(next - (D * sdue(N, i) - paidN) * (1 + i), "ANNUITY_DUE_CONFUSION", "Accumulated the deposits one year too far: the balance is measured just after the last deposit."),
          distractor(next - fund * (1 + i), "CALCULATION_DISTRACTOR", `Forgot to pay the ${ord(N)} year's tuition from the fund.`),
          distractor(T0 * acc(g, N + 1) - (fund - T0 * acc(g, N)) * (1 + i), "OFF_BY_ONE_PERIOD", "Grew the tuition one year too many."),
          distractor(next - (fund - paidN), "CALCULATION_DISTRACTOR", "Did not credit the remaining balance with a year's interest."),
        ],
        solutionSteps: `**Step 1 — Fund just after the ${ord(N)} deposit.** The deposits are made at times $0, 1, \\ldots, ${N - 1}$, so at time ${N - 1}:
$$${mn(D)}\\,s_{\\overline{${N}}|${mpc(i)}} = ${mn(fund, 2)}.$$

**Step 2 — Pay the ${ord(N)} year's tuition.** $${mn(T0)}(${dec(1 + g, 3)})^{${N - 1}} = ${mn(paidN, 2)}$ leaves $${mn(fund - paidN, 2)}$, which grows to $${mn((fund - paidN) * (1 + i), 2)}$ a year later.

**Step 3 — Shortfall.** The next tuition is $${mn(T0)}(${dec(1 + g, 3)})^{${N}} = ${mn(next, 2)}$, so
$$X = ${mn(next, 2)} - ${mn((fund - paidN) * (1 + i), 2)} = ${mn(X, 2)}.$$`,
        checks: [{ label: "fund ledger", ok: close(Array.from({ length: N }, (_, k) => D * acc(i, N - 1 - k)).reduce((a, b) => a + b, 0), fund) }],
      };
    },
  },

  {
    id: "FM_ANN_MAX_INTEGER_DEFERRAL",
    domain: ANN,
    title: "Latest Whole-Month Deposit Timing to Reach a Target",
    objective: "Solve a quadratic equation of value in the discount factor and round the time correctly for a minimum target.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [75],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const A = gridAmount(rng, 1000, 3000, 100);
          const c = rng.choice([2, 3]);
          const j = gridRate(rng, 0.048, 0.096, 0.012);
          const r = j / 12;
          const H = 60;
          const target = gridAmount(rng, 1000, 20000, 100);
          const disc = target * Math.pow(1 + r, -H);
          const x = (-A + Math.sqrt(A * A + 4 * c * A * disc)) / (2 * c * A);
          const nStar = -Math.log(x) / Math.log(1 + r);
          return { A, c, j, r, H, target, nStar };
        },
        (p) => p.nStar > 4 && p.nStar < 28 && p.nStar % 1 > 0.15 && p.nStar % 1 < 0.85,
        { A: 1700, c: 2, j: 0.072, r: 0.006, H: 60, target: 6500, nStar: 11.73 }
      );
      const { A, c, j, r, H, target, nStar } = params;
      const answer = Math.floor(nStar);
      const value = (m: number) => A * Math.pow(1 + r, H - m) + c * A * Math.pow(1 + r, H - 2 * m);
      return {
        questionText: `A couple saves for their child's first year of college. They will deposit ${n(A)} $n$ months from today and ${n(c * A)} $${2}n$ months from today.
The deposits earn ${nom(j, 12)}.
Calculate the largest whole number $n$ for which the deposits will have accumulated to at least ${n(target)} five years from today.`,
        variables: { A, c, j, target },
        correctValue: answer,
        format: "AMOUNT_0",
        optionStyle: "MODELLED",
        ladderStep: 1,
        distractors: [
          distractor(Math.ceil(nStar), "CALCULATION_DISTRACTOR", "Rounded the solution up; a later deposit accumulates less, so the target is then missed."),
          distractor(2 * answer, "CALCULATION_DISTRACTOR", "Reported the timing of the second deposit, $2n$."),
          distractor(2 * Math.ceil(nStar), "CALCULATION_DISTRACTOR", "Rounded up and reported the timing of the second deposit."),
          distractor(answer - 1, "OFF_BY_ONE_PERIOD", "Stopped one month short of the largest value that still reaches the target."),
        ],
        solutionSteps: `**Step 1 — Discount the target to today.** At $${dec(r, 4)}$ per month, $${mn(target)}(1.${dec(r, 4).slice(2)})^{-${H}} = ${mn(target * Math.pow(1 + r, -H), 2)}$.

**Step 2 — Quadratic in $x = (1.${dec(r, 4).slice(2)})^{-n}$.**
$$${mn(target * Math.pow(1 + r, -H), 2)} = ${mn(A)}x + ${mn(c * A)}x^2 \\implies x = \\frac{-${mn(A)} + \\sqrt{${mn(A)}^2 + 4(${mn(c * A)})(${mn(target * Math.pow(1 + r, -H), 2)})}}{2(${mn(c * A)})} = ${dec(Math.pow(1 + r, -nStar), 5)}.$$
So $n = -\\ln x / \\ln(1.${dec(r, 4).slice(2)}) = ${dec(nStar, 2)}$.

**Step 3 — Round in the right direction.** Delaying the deposits lowers their accumulated value, so $n$ must not exceed ${dec(nStar, 2)}: the largest whole number is **${answer}**. (Check: $n = ${answer}$ accumulates to ${n(value(answer), 2)}; $n = ${answer + 1}$ to ${n(value(answer + 1), 2)}.)`,
        checks: [
          { label: "answer reaches the target", ok: value(answer) >= target },
          { label: "one more month misses it", ok: value(answer + 1) < target },
        ],
      };
    },
  },

  {
    id: "FM_ANN_MONTHLY_DEPOSITS_ANNUAL_WITHDRAWALS",
    domain: ANN,
    title: "Monthly Deposits Funding Annual Withdrawals",
    objective: "Equate monthly deposits with annual withdrawals using an equivalent monthly rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [79, 114],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const r = Math.pow(1 + i, 1 / 12) - 1;
      const W = gridAmount(rng, 10000, 30000, 1000);
      const atEnd = rng.next() < 0.5;
      const years = rng.choice([18, 19, 20, 21]);
      const first = atEnd ? years - 3 : years - 4;
      const times = atEnd ? [years - 3, years - 2, years - 1, years] : [years - 4, years - 3, years - 2, years - 1];
      const depositYears = atEnd ? years : years - 1;
      const pvW = times.reduce((sum, t) => sum + W * v(i, t), 0);
      const X = pvW / adue(12 * depositYears, r);
      const wrongX = pvW / adue(12 * depositYears, i / 12);
      return {
        questionText: `${saver} deposits $X$ into a fund at the beginning of each month for ${depositYears} years.
${atEnd ? `Beginning at the end of year ${first}, ${saver} withdraws ${n(W)} at the end of each year, and the withdrawal at the end of year ${years} exhausts the fund.` : `In years ${first + 1} through ${years}, ${saver} withdraws ${n(W)} at the beginning of each year, and the final withdrawal exhausts the fund.`}
The fund earns ${eff(i)}.
Calculate $X$.`,
        variables: { i, W, atEnd: atEnd ? 1 : 0, years, depositYears, times },
        correctValue: X,
        format: "AMOUNT_2",
        distractors: [
          distractor(wrongX, "NOMINAL_RATE_ERROR", `Used ${pc(i)}/12 as the monthly rate; ${pc(i)} is an effective annual rate.`),
          distractor(pvW / an(12 * depositYears, r), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each month."),
          distractor(times.reduce((sum, t) => sum + W * v(i, t + (atEnd ? -1 : 1)), 0) / adue(12 * depositYears, r), "OFF_BY_ONE_PERIOD", atEnd ? "Discounted the withdrawals as if made at the start of each year." : "Discounted the withdrawals as if made at the end of each year."),
          distractor((4 * W) / (12 * depositYears), "SIMPLE_INTEREST_ERROR", "Ignored interest."),
        ],
        solutionSteps: `**Step 1 — Monthly rate.** $r = (1.${dec(i, 3).slice(2)})^{1/12} - 1 = ${dec(r, 6)}$.

**Step 2 — Present value of the withdrawals** (at times ${times.join(", ")}):
$$${mn(W)}\\left(${times.map((t) => `v^{${t}}`).join(" + ")}\\right) = ${mn(pvW, 2)}.$$

**Step 3 — Solve for $X$.**
$$X\\,\\ddot{a}_{\\overline{${12 * depositYears}}|r} = ${mn(pvW, 2)} \\implies X = \\frac{${mn(pvW, 2)}}{${dec(adue(12 * depositYears, r), 4)}} = ${mn(X, 2)}.$$`,
        checks: [{ label: "deposits fund the withdrawals", ok: close(X * adue(12 * depositYears, r), pvW) }],
      };
    },
  },

  {
    id: "FM_ANN_PERPETUITY_DUE_EXCHANGE_TWO_RATES",
    domain: ANN,
    title: "Exchanging a Perpetuity-Due under Two Interest Rates",
    objective: "Value a perpetuity-due and an annuity-due when the rate changes after a number of years.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [80],
    generate: (rng: Rng) => {
      const [holder] = cast(rng);
      const P = gridAmount(rng, 5000, 20000, 1000);
      const term = rng.choice([20, 25, 30]);
      const T = rng.choice([5, 10]);
      const i1 = gridRate(rng, 0.06, 0.1, 0.01);
      const i2 = gridRate(rng, 0.04, i1 - 0.01, 0.01);
      const d2 = i2 / (1 + i2);
      const early = adue(T, i1);
      const pvPerp = P * (early + v(i1, T) / d2);
      const annuityFactor = early + v(i1, T) * adue(term - T, i2);
      const X = pvPerp / annuityFactor;
      return {
        questionText: `${holder} inherits a perpetuity-due with annual payments of ${n(P)}. ${holder} immediately exchanges it for a ${term}-year annuity-due with annual payments of $X$ and the same present value.
All present values use ${eff(i1)} for the first ${T} years and ${eff(i2)} thereafter.
Calculate $X$.`,
        variables: { P, term, T, i1, i2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((P / (i1 / (1 + i1))) / adue(term, i1), "CALCULATION_DISTRACTOR", `Used ${pc(i1)} for all years.`),
          distractor((P / d2) / adue(term, i2), "CALCULATION_DISTRACTOR", `Used ${pc(i2)} for all years.`),
          distractor((P * (an(T, i1) + v(i1, T) / i2)) / (an(T, i1) + v(i1, T) * an(term - T, i2)), "ANNUITY_DUE_CONFUSION", "Valued both streams as payable at the end of each year."),
          distractor((P * (early + v(i1, T) / i2)) / annuityFactor, "ANNUITY_DUE_CONFUSION", "Valued the perpetuity's later payments as a perpetuity-immediate."),
        ],
        solutionSteps: `**Step 1 — Present value of the perpetuity-due.** The first ${T} payments use ${pc(i1)}; the rest form a perpetuity-due at ${pc(i2)} starting at time ${T}:
$$${mn(P)}\\left(\\ddot{a}_{\\overline{${T}}|${mpc(i1)}} + v_{${mpc(i1)}}^{${T}}\\,\\frac{1}{d_{${mpc(i2)}}}\\right) = ${mn(P)}(${dec(early, 5)} + ${dec(v(i1, T), 5)} \\times ${dec(1 / d2, 5)}) = ${mn(pvPerp, 2)}.$$

**Step 2 — Annuity-due factor.**
$$\\ddot{a}_{\\overline{${T}}|${mpc(i1)}} + v_{${mpc(i1)}}^{${T}}\\,\\ddot{a}_{\\overline{${term - T}}|${mpc(i2)}} = ${dec(early, 5)} + ${dec(v(i1, T), 5)} \\times ${dec(adue(term - T, i2), 5)} = ${dec(annuityFactor, 5)}.$$

**Step 3 — Solve.** $X = ${mn(pvPerp, 2)}/${dec(annuityFactor, 5)} = ${mn(X, 2)}$.`,
        checks: [{ label: "annuity payments exceed perpetuity payments", ok: X > P }],
      };
    },
  },

  {
    id: "FM_ANN_ESTATE_INTEREST_SPLIT",
    domain: ANN,
    title: "Splitting an Estate's Interest between Two Beneficiaries",
    objective: "Relate the present values of the early and late interest payments from a fund to the length of the first period.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [111],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const params = drawUntil(
        () => {
          const E = gridAmount(rng, 100000, 900000, 50000);
          const i = gridRate(rng, 0.03, 0.08, 0.005);
          const X = rng.int(5, 20);
          const ratio = Number((v(i, X) / (1 - v(i, X))).toFixed(2));
          const exact = Math.log((1 + ratio) / ratio) / Math.log(1 + i);
          return { E, i, X, ratio, exact };
        },
        (p) => Math.abs(p.exact - p.X) < 0.08 && p.ratio > 0.3 && p.ratio < 4,
        { E: 500000, i: 0.05, X: 10, ratio: 1.59, exact: Math.log(2.59 / 1.59) / Math.log(1.05) }
      );
      const { E, i, X, ratio, exact } = params;
      return {
        questionText: `A benefactor leaves an estate of ${n(E)}. The interest on the estate is paid to ${first} at the end of each year for the first $X$ years. ${second} receives the annual interest payments from the end of year $X + 1$ forever.
At ${eff(i)}, the present value of ${second}'s payments is ${dec(ratio, 2)} times the present value of ${first}'s payments.
Calculate $X$.`,
        variables: { E, i, ratio },
        correctValue: X,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 1,
        distractors: [],
        solutionSteps: `**Step 1 — The two present values.** The interest is $${mn(E)}i$ a year, so
$$\\text{${first}}: ${mn(E)}\\,i\\,a_{\\overline{X}|} = ${mn(E)}(1 - v^X), \\qquad \\text{${second}}: ${mn(E)}\\,v^X.$$

**Step 2 — Solve for $X$.**
$$\\frac{v^X}{1 - v^X} = ${dec(ratio, 2)} \\implies v^X = \\frac{${dec(ratio, 2)}}{${dec(1 + ratio, 2)}} \\implies X = \\frac{\\ln(${dec((1 + ratio) / ratio, 5)})}{\\ln(${dec(1 + i, 3)})} = ${dec(exact, 2)} \\approx ${X}.$$`,
        checks: [{ label: "whole number of years", ok: Math.abs(exact - X) < 0.08 }],
      };
    },
  },

  {
    id: "FM_ANN_CONTINUOUS_RATIO_AV",
    domain: ANN,
    title: "Continuous Annuities from a Ratio of Present Values",
    objective: "Use a ratio of continuous annuity values to find the rate, then accumulate a continuous annuity.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [115],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const term = rng.choice([5, 8, 10, 12, 15]);
          const k = rng.choice([1.4, 1.5, 1.6, 1.7, 1.8]);
          const m = rng.int(5, 12);
          const i = Math.pow(1 / (k - 1), 1 / term) - 1;
          return { term, k, m, i };
        },
        (p) => p.i > 0.02 && p.i < 0.12,
        { term: 10, k: 1.5, m: 7, i: Math.pow(2, 0.1) - 1 }
      );
      const { term, k, m, i } = params;
      const delta = Math.log(1 + i);
      const sbar = (acc(i, m) - 1) / delta;
      return {
        questionText: `For a given interest rate $i > 0$, the present value of a ${2 * term}-year continuous annuity of 1 per year is ${k} times the present value of a ${term}-year continuous annuity of 1 per year.
Calculate the accumulated value of a ${m}-year continuous annuity of 1 per year at the same rate.`,
        variables: { term, k, m },
        correctValue: sbar,
        format: "AMOUNT_2",
        distractors: [
          distractor((acc(i, m) - 1) / i, "CALCULATION_DISTRACTOR", "Divided by $i$ instead of $\\delta$, giving $s_{\\overline{" + m + "}|}$."),
          distractor((1 - v(i, m)) / delta, "CALCULATION_DISTRACTOR", "Computed the present value instead of the accumulated value."),
          distractor(((acc(i, m) - 1) / i) * (1 + i), "ANNUITY_DUE_CONFUSION", "Computed an annuity-due accumulation instead of a continuous one."),
          distractor((acc(Math.pow(k - 1, -1 / (2 * term)) - 1, m) - 1) / Math.log(Math.pow(k - 1, -1 / (2 * term))), "CALCULATION_DISTRACTOR", `Solved $v^{${2 * term}} = ${dec(k - 1, 1)}$ instead of $v^{${term}} = ${dec(k - 1, 1)}$.`),
        ],
        solutionSteps: `**Step 1 — Use the ratio.**
$$\\frac{\\bar{a}_{\\overline{${2 * term}}|}}{\\bar{a}_{\\overline{${term}}|}} = \\frac{1 - v^{${2 * term}}}{1 - v^{${term}}} = 1 + v^{${term}} = ${k} \\implies v^{${term}} = ${dec(k - 1, 1)}.$$

**Step 2 — Rate and force.** $1 + i = ${dec(k - 1, 1)}^{-1/${term}} = ${dec(1 + i, 6)}$, so $\\delta = \\ln(1+i) = ${dec(delta, 6)}$.

**Step 3 — Accumulate.**
$$\\bar{s}_{\\overline{${m}}|} = \\frac{(1+i)^{${m}} - 1}{\\delta} = \\frac{${dec(acc(i, m) - 1, 6)}}{${dec(delta, 6)}} = ${dec(sbar, 4)}.$$`,
        checks: [
          {
            label: "ratio of continuous annuities",
            ok: close((1 - v(i, 2 * term)) / (1 - v(i, term)), k),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_AV_EQUALS_PERPETUITY",
    domain: ANN,
    title: "Accumulated Annuity Equal to a Perpetuity Paid Every n Years",
    objective: "Combine an accumulated annuity and a perpetuity payable every n years to eliminate the unknown term.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [117],
    generate: (rng: Rng) => {
      const i = gridRate(rng, 0.05, 0.12, 0.001);
      const term = rng.int(10, 25);
      const P1 = Number((gridAmount(rng, 10, 60, 1) + rng.choice([0, 0.2, 0.5, 0.8])).toFixed(2));
      const growth = acc(i, term) - 1;
      const P2 = Math.round((P1 * growth * growth) / i);
      const X = Math.sqrt((P1 * P2) / i);
      return {
        questionText: `At ${eff(i)}, each of the following equals $X$:
i) the accumulated value at the end of $n$ years of an $n$-year annuity-immediate paying ${amt(P1)} per year;
ii) the present value of a perpetuity-immediate paying ${n(P2)} at the end of each $n$-year period.
Calculate $X$.`,
        variables: { i, P1, P2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(Math.sqrt(P1 * P2), "CALCULATION_DISTRACTOR", "Dropped the $i$ in $s_{\\overline{n}|} = ((1+i)^n - 1)/i$."),
          distractor(Math.sqrt((P1 * P2) / i) * (1 + i), "ANNUITY_DUE_CONFUSION", "Accumulated an annuity-due instead of an annuity-immediate."),
          distractor((P1 * P2) / (i * Math.sqrt((P1 * P2) / i)) * Math.sqrt(1 + i), "CALCULATION_DISTRACTOR", "Mixed the two expressions for $(1+i)^n - 1$."),
          distractor(Math.sqrt((P1 * P2 * (1 + i)) / i), "CALCULATION_DISTRACTOR", "Valued the perpetuity as payable at the start of each period."),
        ],
        solutionSteps: `**Step 1 — Write both values with $u = (1+i)^n - 1$.**
$$X = ${mamt(P1)}\\,\\frac{u}{${dec(i, 3)}} \\qquad\\text{and}\\qquad X = \\frac{${mn(P2)}}{u}.$$

**Step 2 — Eliminate $u$.** Multiplying the two expressions,
$$X^2 = \\frac{${mamt(P1)} \\times ${mn(P2)}}{${dec(i, 3)}}.$$

**Step 3 — Solve.** $X = \\sqrt{${mn((P1 * P2) / i, 2)}} = ${mn(X, 2)}$. (Here $u = ${dec(P2 / X, 4)}$, so $n \\approx ${dec(Math.log(1 + P2 / X) / Math.log(1 + i), 2)}$.)`,
        checks: [
          { label: "both expressions agree", ok: close((P1 * (P2 / X)) / i, X, 1e-9) },
        ],
      };
    },
  },

  {
    id: "FM_ANN_FV_PV_RATIO_RATE",
    domain: ANN,
    title: "Interest Rate from an Annuity's Present and Future Values",
    objective: "Use an annuity's present value at the first payment and accumulated value at the last payment to solve for the rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [164],
    generate: (rng: Rng) => {
      const payment = rng.choice([500, 1000, 2000]);
      const m = rng.choice([2, 4]);
      const j = gridRate(rng, m === 2 ? 0.03 : 0.015, m === 2 ? 0.09 : 0.04, 0.0025);
      const count = rng.int(10, 20);
      const F = Number((payment * sn(count, j)).toFixed(2));
      const P = Number((payment * adue(count, j)).toFixed(2));
      const u = F / P;
      const jSolved = (payment * (u - 1)) / (F - payment * u);
      const i = Math.pow(1 + jSolved, m) - 1;
      return {
        questionText: `An annuity pays ${n(payment)} every ${m === 2 ? "six" : "three"} months for a fixed period.
At an annual effective interest rate of $i$, the accumulated value of the annuity at the time of the last payment is ${n(F, 2)}, and the present value at the time of the first payment is ${n(P, 2)}.
Calculate $i$.`,
        variables: { payment, m, F, P },
        correctValue: i * 100,
        format: "PERCENT_1",
        distractors: [
          distractor(jSolved * 100, "NOMINAL_RATE_ERROR", `Reported the ${m === 2 ? "semiannual" : "quarterly"} rate instead of the annual effective rate.`),
          distractor(jSolved * m * 100, "NOMINAL_RATE_ERROR", "Reported the nominal annual rate instead of the effective rate."),
          distractor((Math.pow(u, 1 / (count - 1)) - 1) * 100, "CALCULATION_DISTRACTOR", "Solved for the per-period rate and stopped without annualising."),
          distractor((Math.pow(1 + jSolved, m + 1) - 1) * 100, "OFF_BY_ONE_PERIOD", "Compounded one period too many when annualising."),
        ],
        solutionSteps: `**Step 1 — Ratio of the two values.** The last payment is $n - 1$ periods after the first, so with $j$ the rate per period
$$\\frac{${mn(F, 2)}}{${mn(P, 2)}} = (1+j)^{n-1} = ${dec(u, 6)}.$$

**Step 2 — Solve for $j$.** Since $${mn(F, 2)} = ${mn(payment)}\\,\\dfrac{(1+j)^n - 1}{j} = ${mn(payment)}\\,\\dfrac{${dec(u, 6)}(1+j) - 1}{j}$,
$$j = \\frac{${mn(payment)}(${dec(u, 6)} - 1)}{${mn(F, 2)} - ${mn(payment)}(${dec(u, 6)})} = ${dec(jSolved, 6)}.$$

**Step 3 — Annualise.** $i = (1 + j)^{${m}} - 1 = ${mpc(i, 3)}$.`,
        checks: [{ label: "rate recovered", ok: close(jSolved, j, 1e-6) }],
      };
    },
  },

  {
    id: "FM_ANN_INTEREST_WITHDRAWN_TO_SECOND_FUND",
    domain: ANN,
    title: "Withdrawals of Interest plus Principal Reinvested in a Second Fund",
    objective: "Track withdrawals of interest plus a level amount of principal and accumulate them in another fund.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [5],
    generate: (rng: Rng) => {
      const count = rng.choice([10, 15, 20]);
      const W = gridAmount(rng, 100, 2000, 100);
      const A = W * count;
      const i1 = gridRate(rng, 0.04, 0.08, 0.005);
      const i2 = gridRate(rng, i1 + 0.01, i1 + 0.04, 0.0025);
      const withdrawals = Array.from({ length: count }, (_, k) => i1 * (A - k * W) + W);
      const X = withdrawals.reduce((sum, amount, k) => sum + amount * acc(i2, count - 1 - k), 0);
      return {
        questionText: `${n(A)} is deposited into Fund X, which earns ${eff(i1)}. At the end of each year, the interest earned plus an additional ${n(W)} is withdrawn from Fund X, so that the fund is exhausted at the end of year ${count}.
Each withdrawal is deposited into Fund Y, which earns ${eff(i2)}.
Calculate the accumulated value of Fund Y at the end of year ${count}.`,
        variables: { A, W, count, i1, i2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(withdrawals.reduce((sum, amount) => sum + amount, 0), "SIMPLE_INTEREST_ERROR", "Added the withdrawals without accumulating them in Fund Y."),
          distractor((i1 * A + W) * sn(count, i2), "CALCULATION_DISTRACTOR", "Treated every withdrawal as equal to the first."),
          distractor(withdrawals.reduce((sum, amount, k) => sum + amount * acc(i1, count - 1 - k), 0), "CALCULATION_DISTRACTOR", `Accumulated Fund Y at ${pc(i1)} instead of ${pc(i2)}.`),
          distractor(withdrawals.reduce((sum, amount, k) => sum + amount * acc(i2, count - k), 0), "ANNUITY_DUE_CONFUSION", "Accumulated each withdrawal one year too long."),
        ],
        solutionSteps: `**Step 1 — The withdrawals.** Fund X's balance falls by ${n(W)} each year, so the $k$-th withdrawal is
$$${dec(i1, 3)}\\left(${mn(A)} - ${mn(W)}(k - 1)\\right) + ${mn(W)},$$
from ${n(withdrawals[0], 2)} down to ${n(withdrawals[count - 1], 2)}.

**Step 2 — Split into level and decreasing parts.** The withdrawals are ${n(W)} plus ${dec(i1, 3)} times a decreasing sequence ${n(A)}, ${n(A - W)}, ..., ${n(W)}, i.e. $${mn(W)} + ${dec(i1 * W, 2)}(${count}, ${count - 1}, \\ldots, 1)$.

**Step 3 — Accumulate at ${pc(i2)}.**
$$${mn(W)}\\,s_{\\overline{${count}}|} + ${dec(i1 * W, 2)}\\,(Ds)_{\\overline{${count}}|} = ${mn(W)}(${dec(sn(count, i2), 5)}) + ${dec(i1 * W, 2)}\\,\\frac{${count}(1.${dec(i2, 4).slice(2)})^{${count}} - s_{\\overline{${count}}|}}{${dec(i2, 4)}} = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "closed form matches the ledger",
            ok: close(W * sn(count, i2) + i1 * W * ((count * acc(i2, count) - sn(count, i2)) / i2), X),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_REINVESTED_INTEREST",
    domain: ANN,
    title: "Deposits with Interest Reinvested at a Different Rate",
    objective: "Accumulate level deposits whose interest is paid out and reinvested at a different rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [171, 178, 209, 280, 336, 363, 392],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [saver] = cast(rng);
      const count = rng.choice([5, 10, 15, 20, 25, 30]);
      const due = rng.next() < 0.5;
      const j = gridRate(rng, 0.03, 0.07, 0.005);
      // Balance on which interest is credited at the end of year k.
      const base = (k: number) => (due ? k : k - 1);
      const avPerUnit = (i: number) =>
        count + Array.from({ length: count }, (_, k) => i * base(k + 1) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0);
      const variant = rng.choice(["AV", "DEPOSIT", "RATE"] as const);
      const timing = due ? "at the beginning of each year" : "at the end of each year";
      if (variant === "RATE") {
        const D = gridAmount(rng, 200, 5000, 100);
        const iTrue = gridRate(rng, j + 0.02, j + 0.12, 0.0025);
        const F = Math.round((D * avPerUnit(iTrue)) / 10) * 10;
        const i = solve((rate) => D * avPerUnit(rate) - F, 0, 2);
        return {
          questionText: `${saver} deposits ${n(D)} ${timing} for ${count} years into an account that earns an annual effective interest rate of $i$.
At the end of each year the interest earned is paid out and reinvested at ${eff(j)}.
Including the reinvested interest, ${saver} has ${n(F)} at the end of ${count} years.
Calculate $i$.`,
          variables: { variant: "RATE", count, due: due ? 1 : 0, j, D, F },
          correctValue: i * 100,
          format: "PERCENT_2",
          distractors: [
            distractor((Math.pow(F / (D * count), 1 / count) - 1) * 100, "CALCULATION_DISTRACTOR", "Treated all the deposits as made at the start."),
            distractor(trySolve((rate) => D * (due ? sdue(count, rate) : sn(count, rate)) - F, -0.5, 2) * 100, "CALCULATION_DISTRACTOR", "Ignored the reinvestment and solved for a single yield rate."),
            distractor(trySolve((rate) => D * (count + Array.from({ length: count }, (_, k) => rate * (due ? k : k + 1) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0)) - F, 0, 2) * 100, "ANNUITY_DUE_CONFUSION", due ? "Credited interest as if deposits were made at the end of each year." : "Credited interest as if deposits were made at the start of each year."),
          ],
          solutionSteps: `**Step 1 — Interest paid each year.** The balance on which interest is credited at the end of year $k$ is ${due ? `$${mn(D)}k$` : `$${mn(D)}(k - 1)$`}, so the interest is $i$ times that.

**Step 2 — Accumulated value.** The deposits themselves total $${count}(${mn(D)})$; the interest is an increasing stream reinvested at ${pc(j)}:
$$${mn(D)}\\left[${count} + i\\,(Is)_{\\overline{${due ? count : count - 1}}|${mpc(j)}}\\right] = ${mn(F)}.$$

**Step 3 — Solve.** $(Is)_{\\overline{${due ? count : count - 1}}|${mpc(j)}} = ${dec((avPerUnit(1) - count), 4)}$, so $i = \\dfrac{${mn(F)}/${mn(D)} - ${count}}{${dec(avPerUnit(1) - count, 4)}} = ${mpc(i, 3)}$.`,
          checks: [{ label: "linear in i", ok: close(D * avPerUnit(i), F) }],
        };
      }
      const i = gridRate(rng, j + 0.01, j + 0.05, 0.0025);
      if (variant === "DEPOSIT") {
        const F = gridAmount(rng, 10000, 100000, 1000);
        const X = F / avPerUnit(i);
        return {
          questionText: `${saver} will accumulate ${n(F)} at the end of ${count} years by making level deposits of $X$ ${timing}.
The deposits earn ${eff(i)}, but the interest is paid out at the end of each year and reinvested at ${eff(j)}.
Calculate $X$.`,
          variables: { variant: "DEPOSIT", count, due: due ? 1 : 0, j, i, F },
          correctValue: X,
          format: X >= 1000 ? "AMOUNT_0" : "AMOUNT_2",
          distractors: [
            distractor(F / (due ? sdue(count, i) : sn(count, i)), "CALCULATION_DISTRACTOR", `Assumed all interest also earns ${pc(i)}.`),
            distractor(F / (due ? sdue(count, j) : sn(count, j)), "CALCULATION_DISTRACTOR", `Assumed all interest earns ${pc(j)}.`),
            distractor(F / (count + Array.from({ length: count }, (_, k) => i * (due ? k : k + 1) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0)), "ANNUITY_DUE_CONFUSION", due ? "Credited interest as if deposits were made at the end of each year." : "Credited interest as if deposits were made at the start of each year."),
          ],
          solutionSteps: `**Step 1 — Interest paid each year per unit deposit.** At the end of year $k$ the account holds ${due ? "$k$" : "$k - 1$"} deposits, so ${pc(i)} of that is paid out and reinvested.

**Step 2 — Accumulated value per unit deposit.**
$$${count} + ${dec(i, 4)}\\,(Is)_{\\overline{${due ? count : count - 1}}|${mpc(j)}} = ${dec(avPerUnit(i), 5)}.$$

**Step 3 — Solve.** $X = ${mn(F)}/${dec(avPerUnit(i), 5)} = ${mn(X, 2)}$.`,
          checks: [{ label: "target reached", ok: close(X * avPerUnit(i), F) }],
        };
      }
      const D = gridAmount(rng, 100, 5000, 100);
      const AV = D * avPerUnit(i);
      return {
        questionText: `${saver} invests ${n(D)} ${timing} for ${count} years. The investments earn ${eff(i)}.
At the end of each year the interest is paid out and reinvested at ${eff(j)}.
Calculate the total accumulated value at the end of ${count} years.`,
        variables: { variant: "AV", count, due: due ? 1 : 0, j, i, D },
        correctValue: AV,
        format: "AMOUNT_0",
        distractors: [
          distractor(D * (due ? sdue(count, i) : sn(count, i)), "CALCULATION_DISTRACTOR", `Assumed the interest is also reinvested at ${pc(i)}.`),
          distractor(D * (due ? sdue(count, j) : sn(count, j)), "CALCULATION_DISTRACTOR", `Accumulated everything at ${pc(j)}.`),
          distractor(D * (count + Array.from({ length: count }, (_, k) => i * (due ? k : k + 1) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0)), "ANNUITY_DUE_CONFUSION", due ? "Credited interest as if deposits were made at the end of each year." : "Credited interest as if deposits were made at the start of each year."),
          distractor(D * count * (1 + i * (due ? (count + 1) / 2 : (count - 1) / 2)), "SIMPLE_INTEREST_ERROR", "Ignored the interest earned on the reinvested interest."),
        ],
        solutionSteps: `**Step 1 — Interest paid each year.** At the end of year $k$ the account holds ${due ? `$${mn(D)}k$` : `$${mn(D)}(k - 1)$`}, so the interest paid out is ${pc(i)} of that.

**Step 2 — Accumulate the interest stream at ${pc(j)}.** The interest payments form an increasing annuity:
$$${dec(i, 4)}(${mn(D)})\\,(Is)_{\\overline{${due ? count : count - 1}}|${mpc(j)}} = ${mn(AV - D * count, 2)}.$$

**Step 3 — Add the deposits.** $${count}(${mn(D)}) + ${mn(AV - D * count, 2)} = ${mn(AV, 2)}$.`,
        checks: [{ label: "reinvestment below the account rate lowers the value", ok: AV < D * (due ? sdue(count, i) : sn(count, i)) }],
      };
    },
  },

  {
    id: "FM_ANN_ANNUITY_VS_GAPPED_PERPETUITY",
    domain: ANN,
    title: "Annuity Equal in Value to a Perpetuity with a Gap",
    objective: "Equate a level annuity with a perpetuity that pauses, reducing the equation to a polynomial in the discount factor.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [175, 253],
    generate: (rng: Rng) => {
      // The equation is a quadratic in v^gap. It has exactly one root in (0, 1)
      // when the annuity payment exceeds the perpetuity payment, so only those
      // draws are used; otherwise two different rates would both be "the" answer.
      const { gap, P, L } = drawUntil(
        () => {
          const gap = rng.choice([5, 10]);
          const iTrue = gridRate(rng, 0.04, 0.12, 0.0025);
          const P = gridAmount(rng, 300, 1200, 100);
          const L = Math.round((P * (an(gap, iTrue) + v(iTrue, 2 * gap) / iTrue)) / an(2 * gap, iTrue));
          return { gap, P, L };
        },
        (p) => p.L > 1.02 * p.P,
        { gap: 5, P: 400, L: 475 }
      );
      const pvDiff = (i: number) => L * an(2 * gap, i) - P * (an(gap, i) + v(i, 2 * gap) / i);
      const i = solve(pvDiff, 0.0005, 1);
      return {
        questionText: `The following two annuities-immediate have the same present value at an annual effective interest rate of $i$, $i > 0$:
i) a ${2 * gap}-year annuity with annual payments of ${n(L)};
ii) a perpetuity with annual payments of ${n(P)} in years 1 through ${gap}, nothing in years ${gap + 1} through ${2 * gap}, and ${n(P)} in year ${2 * gap + 1} and every year thereafter.
Calculate $i$.`,
        variables: { gap, L, P },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(trySolve((r) => L * an(2 * gap, r) - P / r, 0.0005, 1) * 100, "CALCULATION_DISTRACTOR", "Ignored the gap in the perpetuity's payments."),
          distractor(trySolve((r) => L * an(2 * gap, r) - P * (an(gap, r) + v(r, 2 * gap + 1) / r), 0.0005, 1) * 100, "OFF_BY_ONE_PERIOD", `Deferred the resumed payments to year ${2 * gap + 2}.`),
          distractor(trySolve((r) => L * adue(2 * gap, r) - P * (an(gap, r) + v(r, 2 * gap) / r), 0.0005, 1) * 100, "ANNUITY_DUE_CONFUSION", "Valued the level annuity as payable at the start of each year."),
        ],
        solutionSteps: `**Step 1 — Write the perpetuity in terms of $x = v^{${gap}}$.** Its present value is
$$${mn(P)}\\left(a_{\\overline{${gap}}|} + \\frac{v^{${2 * gap}}}{i}\\right) = \\frac{${mn(P)}}{i}\\left(1 - x + x^2\\right).$$

**Step 2 — Write the annuity.** $${mn(L)}\\,a_{\\overline{${2 * gap}}|} = \\dfrac{${mn(L)}}{i}(1 - x^2)$.

**Step 3 — Equate and solve.** Cancelling $1/i$,
$$${mn(L)}(1 - x^2) = ${mn(P)}(1 - x + x^2) \\implies ${mn(L + P)}x^2 - ${mn(P)}x + ${mn(P - L)} = 0,$$
whose root in $(0, 1)$ is $x = ${dec(v(i, gap), 6)}$. Then $i = x^{-1/${gap}} - 1 = ${mpc(i, 3)}$.`,
        checks: [{ label: "present values agree", ok: Math.abs(pvDiff(i)) < 1e-6 * L }],
      };
    },
  },

  {
    id: "FM_ANN_ENDOWMENT_DEFERRED_PERPETUITY",
    domain: ANN,
    title: "Monthly Endowment Payments after an Accumulation and Waiting Period",
    objective: "Accumulate monthly deposits, let the fund grow untouched, and convert it into a monthly perpetuity-due.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [211],
    generate: (rng: Rng) => {
      const D = gridAmount(rng, 100, 1000, 50);
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const r = j / 12;
      const n1 = rng.choice([5, 10, 15]);
      const n2 = rng.choice([5, 10]);
      const fundAtEnd = D * sdue(12 * n1, r);
      const fundAtStart = fundAtEnd * acc(r, 12 * n2);
      const X = (fundAtStart * r) / (1 + r);
      return {
        questionText: `A donor starts an endowment fund that earns ${nom(j, 12)}.
Beginning today, the donor deposits ${n(D)} at the start of each month for ${n1} years. No deposits or withdrawals are made for the following ${n2} years.
Exactly ${n1 + n2} years from today, monthly payments of $X$ begin and continue forever.
Calculate $X$.`,
        variables: { D, j, n1, n2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(fundAtStart * r, "ANNUITY_DUE_CONFUSION", "Valued the payments as a perpetuity-immediate; the first payment is made at once."),
          distractor(((D * sn(12 * n1, r)) * acc(r, 12 * n2) * r) / (1 + r), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each month."),
          distractor((fundAtEnd * r) / (1 + r), "OFF_BY_ONE_PERIOD", `Forgot the ${n2} years of growth before the payments start.`),
          distractor((fundAtStart * j) / (1 + j) / 12, "NOMINAL_RATE_ERROR", "Converted the fund to a perpetuity using the annual rate."),
        ],
        solutionSteps: `**Step 1 — Fund after the deposits.** At $${dec(r, 4)}$ per month,
$$${mn(D)}\\,\\ddot{s}_{\\overline{${12 * n1}}|} = ${mn(fundAtEnd, 2)}.$$

**Step 2 — Growth while untouched.** $${mn(fundAtEnd, 2)}(${dec(1 + r, 4)})^{${12 * n2}} = ${mn(fundAtStart, 2)}$.

**Step 3 — Monthly perpetuity-due.** $X\\,\\ddot{a}_{\\overline{\\infty}|} = X\\,\\dfrac{1.${dec(r, 4).slice(2)}}{${dec(r, 4)}} = ${mn(fundAtStart, 2)}$, so $X = ${mn(X, 2)}$.`,
        checks: [{ label: "perpetuity sustained", ok: close((X * (1 + r)) / r, fundAtStart) }],
      };
    },
  },

  {
    id: "FM_ANN_TWO_RATE_DEFERRED_PERPETUITY",
    domain: ANN,
    title: "Deferred Perpetuity Valued under Two Rates",
    objective: "Value a deferred perpetuity when the discount rate changes partway through.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [242, 393],
    generate: (rng: Rng) => {
      const [winner] = cast(rng);
      const defer = rng.choice([3, 4, 5]);
      const T = rng.choice([8, 10]);
      const i1 = gridRate(rng, 0.01, 0.04, 0.005);
      const i2 = gridRate(rng, i1 + 0.01, i1 + 0.04, 0.005);
      const PV = gridAmount(rng, 50000, 500000, 10000);
      // Payments at times defer, defer+1, ...; those up to T use i1 only.
      const early = Array.from({ length: T - defer + 1 }, (_, k) => v(i1, defer + k)).reduce((a, b) => a + b, 0);
      const late = v(i1, T) / i2;
      const X = PV / (early + late);
      return {
        questionText: `${winner} wins a prize paid as an annual perpetuity of $X$, with the first payment ${defer} years from today.
The perpetuity has a present value of ${n(PV)} using ${eff(i1)} for the first ${T} years and ${eff(i2)} thereafter.
Calculate $X$.`,
        variables: { defer, T, i1, i2, PV },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(PV / (v(i1, defer - 1) / i1), "CALCULATION_DISTRACTOR", `Used ${pc(i1)} for every year.`),
          distractor(PV / (v(i2, defer - 1) / i2), "CALCULATION_DISTRACTOR", `Used ${pc(i2)} for every year.`),
          distractor(PV / (Array.from({ length: T - defer }, (_, k) => v(i1, defer + k)).reduce((a, b) => a + b, 0) + v(i1, T - 1) / i2), "OFF_BY_ONE_PERIOD", `Switched to ${pc(i2)} one payment too early.`),
          distractor(PV / (early + v(i1, T) / (i2 / (1 + i2)) - v(i1, T)), "ANNUITY_DUE_CONFUSION", `Double counted the payment at time ${T}.`),
        ],
        solutionSteps: `**Step 1 — Payments valued at ${pc(i1)}.** The payments at times ${defer} through ${T} fall in the first rate period:
$$\\sum_{t=${defer}}^{${T}} v_{${mpc(i1)}}^{t} = ${dec(early, 5)}.$$

**Step 2 — Payments after time ${T}.** They form a perpetuity-immediate at ${pc(i2)}, valued at time ${T} and then discounted at ${pc(i1)}:
$$v_{${mpc(i1)}}^{${T}} \\cdot \\frac{1}{${dec(i2, 3)}} = ${dec(late, 5)}.$$

**Step 3 — Solve.** $X(${dec(early, 5)} + ${dec(late, 5)}) = ${mn(PV)}$, so $X = ${mn(X, 2)}$.`,
        checks: [{ label: "components positive", ok: early > 0 && late > 0 }],
      };
    },
  },

  {
    id: "FM_ANN_WITHDRAWALS_RESTORE_FUND",
    domain: ANN,
    title: "Level Withdrawals that Leave a Fund Unchanged",
    objective: "Find the level withdrawal after which a fund returns to its starting value at a later date.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [261],
    generate: (rng: Rng) => {
      const F = rng.choice([500000, 1000000, 2000000]);
      const start = rng.choice([60, 62, 65]);
      const end = start + rng.int(12, 20);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const gapYears = end - start;
      const P = (F * (acc(i, gapYears) - 1)) / sn(gapYears + 1, i);
      return {
        questionText: `On an investor's ${ord(start)} birthday, the investor withdraws $P$ from a fund of ${n(F)}, and withdraws the same amount on each later birthday.
On the investor's ${ord(end)} birthday, the fund again holds ${n(F)} immediately after that year's withdrawal.
The fund earns ${eff(i)}.
Calculate $P$.`,
        variables: { F, start, end, i },
        correctValue: P,
        format: "AMOUNT_0",
        distractors: [
          distractor(F * i, "CALCULATION_DISTRACTOR", "Withdrew only the interest, which keeps the fund at its starting value at every date."),
          distractor((F * (acc(i, gapYears) - 1)) / sn(gapYears, i), "OFF_BY_ONE_PERIOD", `Counted ${gapYears} withdrawals instead of ${gapYears + 1}.`),
          distractor((F * (acc(i, gapYears) - 1)) / sdue(gapYears + 1, i), "ANNUITY_DUE_CONFUSION", "Accumulated the withdrawals one year too far."),
          distractor(F * (i / (1 + i)), "CALCULATION_DISTRACTOR", "Withdrew the interest discounted to the start of each year."),
        ],
        solutionSteps: `**Step 1 — Balance just after the ${ord(end)}-birthday withdrawal.** There are ${gapYears + 1} withdrawals, at times $0, 1, \\ldots, ${gapYears}$:
$$${mn(F)}(1+i)^{${gapYears}} - P\\,s_{\\overline{${gapYears + 1}}|}.$$

**Step 2 — Set it equal to ${n(F)}.**
$$P = \\frac{${mn(F)}\\left[(${dec(1 + i, 3)})^{${gapYears}} - 1\\right]}{s_{\\overline{${gapYears + 1}}|${mpc(i)}}} = \\frac{${mn(F * (acc(i, gapYears) - 1), 2)}}{${dec(sn(gapYears + 1, i), 5)}} = ${mn(P, 2)}.$$`,
        checks: [
          {
            label: "ledger returns to the starting value",
            ok: (() => {
              let bal = F - P;
              for (let k = 1; k <= gapYears; k += 1) bal = bal * (1 + i) - P;
              return close(bal, F);
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_MTHLY_FACTOR_EQUIVALENCE",
    domain: ANN,
    title: "Equal Present Values from Given Annuity Factors",
    objective: "Use given accumulation factors to relate an m-thly annuity and an annuity payable every two years.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [278],
    generate: (rng: Rng) => {
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const m = rng.choice([4, 12]);
      const k = rng.choice([2, 4]);
      const term = k === 4 ? rng.choice([12, 20]) : rng.choice([10, 12, 20]);
      const sm = Number((i / (m * (Math.pow(1 + i, 1 / m) - 1))).toFixed(4));
      const sk = Number(sn(k, i).toFixed(4));
      const P = sk * sm;
      return {
        questionText: `Two annuities-immediate have the following payments:
X: pays $1/${m}$ at the end of every ${m === 12 ? "month" : "quarter"} for ${term} years
Y: pays $P$ at the end of years ${Array.from({ length: term / k }, (_, idx) => k * (idx + 1)).join(", ")}
You are given:
i) the accumulated value at time 1 of $1/${m}$ paid at times $1/${m}, 2/${m}, \\ldots, 1$ is ${dec(sm, 4)};
ii) $s_{\\overline{${k}}|} = ${dec(sk, 4)}$;
iii) the present value of X equals the present value of Y.
Calculate $P$.`,
        variables: { m, term, k, sm, sk, i },
        correctValue: P,
        format: "AMOUNT_2",
        distractors: [
          distractor(sk / sm, "CALCULATION_DISTRACTOR", "Divided by the m-thly factor instead of multiplying."),
          distractor(k * sm, "CALCULATION_DISTRACTOR", `Used ${k} in place of $s_{\\overline{${k}}|}$.`),
          distractor(sk, "CALCULATION_DISTRACTOR", "Ignored the m-thly payment timing."),
          distractor(sk * sm * (1 + i), "ANNUITY_DUE_CONFUSION", "Treated Y as payable at the start of each period."),
        ],
        solutionSteps: `**Step 1 — Present value of X.** Paying $1/${m}$ each ${m === 12 ? "month" : "quarter"} is equivalent to paying ${dec(sm, 4)} at the end of each year, so $PV_X = ${dec(sm, 4)}\\,a_{\\overline{${term}}|}$.

**Step 2 — Present value of Y.** A payment of $P$ every ${k} years is equivalent to $P/s_{\\overline{${k}}|}$ at the end of each year, so $PV_Y = \\dfrac{P}{${dec(sk, 4)}}\\,a_{\\overline{${term}}|}$.
Equating, $P = ${dec(sk, 4)} \\times ${dec(sm, 4)} = ${dec(P, 4)}$.`,
        checks: [{ label: "direct present values agree", ok: close((1 / m) * an(m * term, Math.pow(1 + i, 1 / m) - 1), P * Array.from({ length: term / k }, (_, idx) => v(i, k * (idx + 1))).reduce((a, b) => a + b, 0), 2e-4) }],
      };
    },
  },

  {
    id: "FM_ANN_FUND_PURCHASES_ANNUITY",
    domain: ANN,
    title: "Accumulated Fund Used to Buy an Annuity",
    objective: "Accumulate a fund and convert it to an annuity valued on a different basis.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [285, 367],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [saver] = cast(rng);
      if (rng.next() < 0.5) {
        const D = gridAmount(rng, 100, 500, 25);
        const years = rng.choice([20, 25, 30]);
        const i1 = gridRate(rng, 0.05, 0.09, 0.005);
        const i2 = gridRate(rng, 0.04, 0.08, 0.005);
        const term = rng.choice([20, 25, 30]);
        const r = Math.pow(1 + i1, 1 / 12) - 1;
        const fund = D * sdue(12 * years, r);
        const X = fund / adue(term, i2);
        return {
          questionText: `${saver} deposits ${n(D)} into a bank at the beginning of each month for ${years} years. The bank credits ${eff(i1)}.
At the end of the ${years} years, ${saver} uses the balance to buy a ${term}-year annuity-due with annual payments of $X$, priced at ${eff(i2)}.
Calculate $X$.`,
          variables: { variant: "PAYMENT", D, years, i1, i2, term },
          correctValue: X,
          format: "AMOUNT_0",
          distractors: [
            distractor((D * sdue(12 * years, i1 / 12)) / adue(term, i2), "NOMINAL_RATE_ERROR", `Used ${pc(i1)}/12 as the monthly rate.`),
            distractor(fund / an(term, i2), "ANNUITY_DUE_CONFUSION", "Priced the annuity as payable at the end of each year."),
            distractor((D * sn(12 * years, r)) / adue(term, i2), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each month."),
            distractor(fund / adue(term, i1), "CALCULATION_DISTRACTOR", `Priced the annuity at ${pc(i1)}.`),
          ],
          solutionSteps: `**Step 1 — Accumulate the deposits.** The monthly rate is $(1.${dec(i1, 3).slice(2)})^{1/12} - 1 = ${dec(r, 6)}$, so
$$${mn(D)}\\,\\ddot{s}_{\\overline{${12 * years}}|} = ${mn(fund, 2)}.$$

**Step 2 — Buy the annuity-due.** $X\\,\\ddot{a}_{\\overline{${term}}|${mpc(i2)}} = ${mn(fund, 2)}$, so $X = ${mn(fund, 2)}/${dec(adue(term, i2), 5)} = ${mn(X, 2)}$.`,
          checks: [{ label: "fund positive", ok: fund > 0 }],
        };
      }
      const params = drawUntil(
        () => {
          const D = gridAmount(rng, 1000, 3000, 250);
          const years = rng.choice([20, 25, 30]);
          const i1 = gridRate(rng, 0.07, 0.1, 0.0025);
          const j = gridRate(rng, 0.07, 0.11, 0.01);
          const r = j / 12;
          const term = rng.choice([20, 25, 30]);
          const fund = D * sdue(years, i1);
          const M = Math.floor((fund / adue(12 * term, r)) / 10) * 10;
          const left = fund - M * adue(12 * term, r);
          return { D, years, i1, j, r, term, fund, M, left };
        },
        (p) => p.left > 5 && p.left < 0.02 * p.fund,
        (() => {
          const fund = 1000 * sdue(20, 0.0925);
          return { D: 1000, years: 20, i1: 0.0925, j: 0.1, r: 0.1 / 12, term: 30, fund, M: 500, left: fund - 500 * adue(360, 0.1 / 12) };
        })()
      );
      const { D, years, i1, j, r, term, fund, M, left } = params;
      return {
        questionText: `${saver} deposits ${n(D)} at the beginning of each year for ${years} years into a fund earning ${eff(i1)}.
At the end of the ${years} years, ${saver} uses the fund to buy a ${term}-year annuity-due with monthly payments of ${n(M)}, priced at ${nom(j, 12)}.
Calculate the balance left in the fund after paying for the annuity.`,
        variables: { variant: "BALANCE", D, years, i1, j, term, M },
        correctValue: left,
        format: "AMOUNT_0",
        distractors: [
          distractor(fund - M * an(12 * term, r), "ANNUITY_DUE_CONFUSION", "Priced the annuity as payable at the end of each month."),
          distractor(D * sn(years, i1) - M * adue(12 * term, r), "ANNUITY_DUE_CONFUSION", "Accumulated the deposits as though made at the end of each year."),
        ],
        solutionSteps: `**Step 1 — Fund after ${years} years.** $${mn(D)}\\,\\ddot{s}_{\\overline{${years}}|${mpc(i1)}} = ${mn(fund, 2)}$.

**Step 2 — Price of the annuity.** At $${dec(j, 2)}/12$ per month, $${mn(M)}\\,\\ddot{a}_{\\overline{${12 * term}}|} = ${mn(M * adue(12 * term, r), 2)}$.
The balance left is $${mn(fund, 2)} - ${mn(M * adue(12 * term, r), 2)} = ${mn(left, 2)}$.`,
        checks: [{ label: "fund covers the annuity", ok: left > 0 }],
      };
    },
  },

  {
    id: "FM_ANN_REPEATING_PATTERN_PERPETUITY",
    domain: ANN,
    title: "Perpetuity with a Repeating Three-Year Pattern",
    objective: "Value a perpetuity whose payments repeat in a fixed cycle by treating each cycle as one payment.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [310],
    generate: (rng: Rng) => {
      const A = gridAmount(rng, 100, 500, 50);
      const i = gridRate(rng, 0.06, 0.13, 0.0025);
      const XTrue = gridAmount(rng, 1000, 5000, 100);
      const cycle = (x: number) => (A + x * v(i, 1) + A * v(i, 2)) / (1 - v(i, 3));
      const price = Math.round(cycle(XTrue) / 50) * 50;
      const X = ((price * (1 - v(i, 3)) - A - A * v(i, 2)) / v(i, 1));
      return {
        questionText: `An insurer buys a perpetuity-due for ${n(price)} at ${eff(i)}.
The perpetuity pays annually in the repeating pattern ${n(A)}, $X$, ${n(A)}, ${n(A)}, $X$, ${n(A)}, ${n(A)}, $X$, ${n(A)}, ...
Calculate $X$.`,
        variables: { A, i, price },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(((price * (1 - v(i, 3)) - A - A * v(i, 2)) / v(i, 2)), "OFF_BY_ONE_PERIOD", "Placed $X$ third in each cycle."),
          distractor(price * i - 2 * A, "SIMPLE_INTEREST_ERROR", "Treated the cycle's total as a level annual payment."),
          distractor(((price * (1 - v(i, 3)) * v(i, 1) - A - A * v(i, 2)) / v(i, 1)), "ANNUITY_DUE_CONFUSION", "Valued the perpetuity as payable at the end of each year."),
          distractor(((price * (1 - v(i, 1)) - 2 * A) * 1), "CALCULATION_DISTRACTOR", "Used an annual cycle instead of a three-year cycle."),
        ],
        solutionSteps: `**Step 1 — Value one cycle at its start.** A cycle pays ${n(A)} now, $X$ in one year and ${n(A)} in two years: $${mn(A)} + Xv + ${mn(A)}v^2$.

**Step 2 — Repeat every three years.** The cycles form a perpetuity-due with three-year spacing:
$$\\frac{${mn(A)} + Xv + ${mn(A)}v^2}{1 - v^3} = ${mn(price)} \\implies X = \\frac{${mn(price)}(1 - v^3) - ${mn(A)} - ${mn(A)}v^2}{v} = ${mn(X, 2)}.$$`,
        checks: [{ label: "price reproduced", ok: close(cycle(X), price) }],
      };
    },
  },

  {
    id: "FM_ANN_CONTRIBUTIONS_DEFERRED_PERPETUITY",
    domain: ANN,
    title: "Monthly Contributions Buying an Annual Perpetuity",
    objective: "Equate monthly contributions with a deferred annual perpetuity using consistent rates.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [361],
    generate: (rng: Rng) => {
      const P = gridAmount(rng, 2000, 20000, 500);
      const years = rng.choice([4, 5, 6, 8]);
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const r = j / 12;
      const i = Math.pow(1 + r, 12) - 1;
      const valueAtStart = (P * (1 + i)) / i;
      const X = valueAtStart / sn(12 * years, r);
      return {
        questionText: `Level monthly contributions of $X$ buy an annual perpetuity of ${n(P)} that begins ${years} years from today.
The contributions are made at the end of each month for ${12 * years} months, so the last contribution is made at the same time as the first perpetuity payment.
The annual nominal interest rate is ${pc(j)} compounded monthly.
Calculate $X$.`,
        variables: { P, years, j },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(P / i / sn(12 * years, r), "ANNUITY_DUE_CONFUSION", "Valued the perpetuity as starting one year after the last contribution."),
          distractor(((P * (1 + j)) / j) / sn(12 * years, r), "NOMINAL_RATE_ERROR", `Used ${pc(j)} as the annual effective rate for the perpetuity.`),
          distractor(valueAtStart / sdue(12 * years, r), "ANNUITY_DUE_CONFUSION", "Treated the contributions as made at the start of each month."),
          distractor(valueAtStart / (12 * years), "SIMPLE_INTEREST_ERROR", "Ignored interest on the contributions."),
        ],
        solutionSteps: `**Step 1 — Annual effective rate.** $i = (1 + ${dec(r, 4)})^{12} - 1 = ${mpc(i, 4)}$.

**Step 2 — Value of the perpetuity when it begins.** The first payment is at time ${years}, so it is a perpetuity-due there:
$$${mn(P)}\\,\\frac{1+i}{i} = ${mn(valueAtStart, 2)}.$$

**Step 3 — Accumulated contributions at time ${years}.** $X\\,s_{\\overline{${12 * years}}|${dec(r, 4)}} = ${mn(valueAtStart, 2)}$, so $X = ${mn(X, 2)}$.`,
        checks: [{ label: "values match at the start date", ok: close(X * sn(12 * years, r), valueAtStart) }],
      };
    },
  },

  {
    id: "FM_ANN_PERPETUITY_DUE_FREQUENCY_RATE",
    domain: ANN,
    title: "Interest Rate from Two Perpetuities-Due with Different Frequencies",
    objective: "Solve for the interest rate that makes the same payment amount affordable monthly and every two months.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [441],
    generate: (rng: Rng) => {
      const total = gridAmount(rng, 100000, 400000, 1000);
      const vMonth = gridRate(rng, 0.97, 0.995, 0.005);
      const B = Math.round(total / (2 + vMonth));
      const A = total - B;
      const ratio = A / B;
      const vm = ratio - 1;
      const i = Math.pow(vm, -12) - 1;
      return {
        questionText: `An estate of ${n(total)} is divided between two charities.
Charity A receives ${n(A)} and uses it to buy a perpetuity-due that pays $X$ every month.
Charity B receives ${n(B)} and uses it to buy a perpetuity-due that pays $X$ every two months.
Both perpetuities are priced at the same annual effective interest rate $i$.
Calculate $i$.`,
        variables: { total, A, B },
        correctValue: i * 100,
        format: "PERCENT_1",
        distractors: [
          distractor((Math.pow(vm, -6) - 1) * 100, "OFF_BY_ONE_PERIOD", "Treated the monthly discount factor as a two-month factor."),
          distractor(((1 / vm - 1) * 12) * 100, "NOMINAL_RATE_ERROR", "Reported a nominal monthly-convertible rate instead of the effective rate."),
          distractor((Math.pow(1 / (ratio / 2), 12) - 1) * 100, "CALCULATION_DISTRACTOR", "Set the discount factor equal to half the ratio of the prices."),
          distractor((Math.pow(ratio - 1, -24) - 1) * 100, "CALCULATION_DISTRACTOR", "Raised the monthly factor to the 24th power."),
        ],
        solutionSteps: `**Step 1 — Ratio of the two prices.** With $w = v^{1/12}$ the monthly discount factor,
$$\\frac{X/(1 - w)}{X/(1 - w^2)} = \\frac{1 - w^2}{1 - w} = 1 + w = \\frac{${mn(A)}}{${mn(B)}} = ${dec(ratio, 6)}.$$

**Step 2 — Annual rate.** $w = ${dec(vm, 6)}$, so $1 + i = w^{-12} = ${dec(1 + i, 6)}$ and $i = ${mpc(i, 3)}$.`,
        checks: [
          {
            label: "both prices support the same payment",
            ok: close(A * (1 - vm), B * (1 - vm * vm)),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_QUARTERLY_VS_ODD_YEAR_PAYMENTS",
    domain: ANN,
    title: "Quarterly Annuity-Due Equivalent to Payments in Odd Years",
    objective: "Value a quarterly annuity-due with an annual effective rate and equate it with irregularly spaced payments.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [357],
    generate: (rng: Rng) => {
      const Q = gridAmount(rng, 500, 3000, 100);
      const years = rng.choice([4, 6, 8]);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const q = Math.pow(1 + i, 0.25) - 1;
      const pv = Q * adue(4 * years, q);
      const times = Array.from({ length: years / 2 }, (_, k) => 2 * k + 1);
      const X = pv / times.reduce((sum, t) => sum + v(i, t), 0);
      return {
        questionText: `An annuity pays ${n(Q)} at the beginning of every three months for ${years} years. Another annuity pays $X$ at the end of years ${listing(times)}.
At ${eff(i)}, the two annuities have equal present values.
Calculate $X$.`,
        variables: { Q, years, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((Q * adue(4 * years, i / 4)) / times.reduce((sum, t) => sum + v(i, t), 0), "NOMINAL_RATE_ERROR", "Used $i/4$ as the quarterly rate."),
          distractor((Q * an(4 * years, q)) / times.reduce((sum, t) => sum + v(i, t), 0), "ANNUITY_DUE_CONFUSION", "Valued the quarterly payments at the end of each quarter."),
          distractor(pv / times.reduce((sum, t) => sum + v(i, t + 1), 0), "OFF_BY_ONE_PERIOD", "Discounted the second annuity's payments one year too far."),
          distractor((4 * years * Q) / times.length, "SIMPLE_INTEREST_ERROR", "Ignored interest."),
        ],
        solutionSteps: `**Step 1 — Quarterly annuity-due.** The quarterly rate is $(1.${dec(i, 3).slice(2)})^{1/4} - 1 = ${dec(q, 6)}$:
$$${mn(Q)}\\,\\ddot{a}_{\\overline{${4 * years}}|} = ${mn(pv, 2)}.$$

**Step 2 — Equate with the second annuity.**
$$X\\left(${times.map((t) => `v^{${t}}`).join(" + ")}\\right) = ${mn(pv, 2)} \\implies X = \\frac{${mn(pv, 2)}}{${dec(times.reduce((sum, t) => sum + v(i, t), 0), 5)}} = ${mn(X, 2)}.$$`,
        checks: [{ label: "present values agree", ok: close(X * times.reduce((sum, t) => sum + v(i, t), 0), pv) }],
      };
    },
  },

  {
    id: "FM_ANN_CONTINUOUS_VARYING_FORCE_RATE",
    domain: ANN,
    title: "Continuous Payments under a Varying Force of Interest",
    objective: "Accumulate a continuously paid stream under a time-varying force of interest and solve for its scale.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [17],
    generate: (rng: Rng) => {
      const a = rng.choice([5, 8, 10, 12]);
      const T = rng.choice([5, 8, 10]);
      const AV = gridAmount(rng, 10000, 50000, 1000);
      const k = AV / (T * (a + T));
      return {
        questionText: `Payments are made to an account at a continuous rate of $(${a}k + tk)$ per year, for $0 \\le t \\le ${T}$.
Interest is credited at a force of interest $\\delta_t = \\frac{1}{${a} + t}$.
At time ${T}, the account is worth ${n(AV)}.
Calculate $k$.`,
        variables: { a, T, AV },
        correctValue: k,
        format: "AMOUNT_0",
        distractors: [
          distractor(AV / (T * (a + T / 2)), "CALCULATION_DISTRACTOR", "Ignored the interest and integrated the payments alone."),
          distractor(AV / ((a + T) * Math.log((a + T) / a) * T), "CALCULATION_DISTRACTOR", "Integrated the accumulation factor instead of multiplying it by the payment rate."),
          distractor((AV * a) / ((a + T) * (a * T + (T * T) / 2)), "CALCULATION_DISTRACTOR", `Accumulated every payment by $a(${T}) = (${a} + ${T})/${a}$, as though all were made at time 0.`),
          distractor((3 * AV * (a + T)) / (Math.pow(a + T, 3) - Math.pow(a, 3)), "CALCULATION_DISTRACTOR", "Inverted the accumulation factor, discounting each payment instead of accumulating it."),
        ],
        solutionSteps: `**Step 1 — Accumulation from $t$ to ${T}.**
$$\\exp\\left(\\int_t^{${T}} \\frac{ds}{${a} + s}\\right) = \\frac{${a} + ${T}}{${a} + t}.$$

**Step 2 — Value at time ${T}.** The payment rate $k(${a} + t)$ cancels the denominator:
$$\\int_0^{${T}} k(${a} + t)\\,\\frac{${a + T}}{${a} + t}\\,dt = ${a + T}k \\times ${T} = ${(a + T) * T}k.$$

**Step 3 — Solve.** $${(a + T) * T}k = ${mn(AV)}$, so $k = ${mn(k, 2)}$.`,
        checks: [
          {
            label: "numerical integration agrees",
            ok: close(
              Array.from({ length: 4000 }, (_, s) => {
                const t = ((s + 0.5) * T) / 4000;
                return (k * (a + t) * (a + T)) / (a + t) * (T / 4000);
              }).reduce((x, y) => x + y, 0),
              AV,
              1e-6
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_CONTINUOUS_PIECEWISE_PERPETUITY",
    domain: ANN,
    title: "Continuous Perpetuity: Level, then Growing",
    objective: "Value a continuous payment stream that is level for a period and then grows geometrically forever.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [85],
    generate: (rng: Rng) => {
      const T = rng.choice([5, 8, 10, 15]);
      const i = gridRate(rng, 0.05, 0.09, 0.005);
      const g = gridRate(rng, 0.01, i - 0.015, 0.005);
      const R = rng.choice([1, 100, 1000]);
      const delta = Math.log(1 + i);
      const lg = Math.log(1 + g);
      const level = (R * (1 - v(i, T))) / delta;
      const growing = (R * v(i, T)) / (delta - lg);
      const X = level + growing;
      return {
        questionText: `A perpetuity makes continuous payments. The annual rate of payment at time $t$ is
$$\\begin{cases} ${R}, & 0 \\le t < ${T} \\\\ ${R}(${dec(1 + g, 3).replace(/0+$/, "")})^{t - ${T}}, & t \\ge ${T}. \\end{cases}$$
At ${eff(i)}, the present value of the perpetuity at time 0 is $X$.
Calculate $X$.`,
        variables: { T, i, g, R },
        correctValue: X,
        format: R === 1 ? "AMOUNT_2" : "AMOUNT_0",
        distractors: [
          distractor(level + (R * v(i, T)) / (i - g), "CALCULATION_DISTRACTOR", "Used $i - g$ instead of $\\delta - \\ln(1+g)$ for the growing part."),
          distractor((R * (1 - v(i, T))) / i + (R * v(i, T)) / (delta - lg), "CALCULATION_DISTRACTOR", "Valued the level part with $i$ instead of $\\delta$."),
          distractor(level + R / (delta - lg), "OFF_BY_ONE_PERIOD", `Forgot to discount the growing part from time ${T}.`),
          distractor(R / (delta - lg), "CALCULATION_DISTRACTOR", "Treated the whole stream as growing from time 0."),
        ],
        solutionSteps: `**Step 1 — Level part.** With $\\delta = \\ln(${dec(1 + i, 3)}) = ${dec(delta, 6)}$,
$$${R}\\,\\bar{a}_{\\overline{${T}}|} = ${R}\\,\\frac{1 - v^{${T}}}{\\delta} = ${mn(level, 4)}.$$

**Step 2 — Growing part, valued at time ${T}.**
$$\\int_0^{\\infty} ${R}(${dec(1 + g, 3)})^{s} e^{-\\delta s}\\,ds = \\frac{${R}}{\\delta - \\ln(${dec(1 + g, 3)})} = ${mn(R / (delta - lg), 4)}.$$

**Step 3 — Discount and add.** $X = ${mn(level, 4)} + v^{${T}}(${mn(R / (delta - lg), 4)}) = ${mn(X, 4)}$.`,
        checks: [{ label: "growth below the force", ok: lg < delta }],
      };
    },
  },

  {
    id: "FM_ANN_DEPOSIT_SCHEDULE_TO_PERPETUITY",
    domain: ANN,
    title: "Irregular Deposits Used to Buy a Semiannual Perpetuity",
    objective: "Accumulate a schedule of deposits and convert the fund to a perpetuity on a different basis.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [366],
    generate: (rng: Rng) => {
      const low = gridAmount(rng, 100, 500, 50);
      const high = low + gridAmount(rng, 50, 300, 50);
      const deposits = [low, low, high, high, high];
      const i1 = gridRate(rng, 0.06, 0.14, 0.01);
      const i2 = gridRate(rng, 0.05, 0.12, 0.01);
      const H = rng.choice([8, 10, 12]);
      const fund = deposits.reduce((sum, amount, k) => sum + amount * acc(i1, H - k), 0);
      const j = Math.pow(1 + i2, 0.5) - 1;
      const X = fund * j;
      return {
        questionText: `The following deposits are made into a fund at the beginning of each year:
${deposits.map((amount, k) => `Year ${k + 1}: ${n(amount)}`).join("\n")}
The fund earns ${eff(i1)}.
At the end of year ${H}, the fund is used to buy a perpetuity-immediate with semiannual payments of $X$, priced at ${eff(i2)}.
Calculate $X$.`,
        variables: { deposits, i1, i2, H },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(fund * (i2 / 2), "NOMINAL_RATE_ERROR", `Used ${pc(i2)}/2 as the semiannual rate.`),
          distractor(fund * i2, "NOMINAL_RATE_ERROR", "Bought an annual perpetuity instead of a semiannual one."),
          distractor(deposits.reduce((sum, amount, k) => sum + amount * acc(i1, H - k - 1), 0) * j, "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each year."),
          distractor(fund * (j / (1 + j)), "ANNUITY_DUE_CONFUSION", "Priced the perpetuity as payable in advance."),
        ],
        solutionSteps: `**Step 1 — Fund at the end of year ${H}.** A deposit at the start of year $k$ earns interest for $${H} - k + 1$ years:
$$${deposits.map((amount, k) => `${mn(amount)}(${dec(1 + i1, 2)})^{${H - k}}`).join(" + ")} = ${mn(fund, 2)}.$$

**Step 2 — Semiannual rate.** $j = (1.${dec(i2, 2).slice(2)})^{1/2} - 1 = ${dec(j, 6)}$.

**Step 3 — Perpetuity payment.** $X/j = ${mn(fund, 2)}$, so $X = ${mn(X, 2)}$.`,
        checks: [{ label: "perpetuity priced at the fund", ok: close(X / j, fund) }],
      };
    },
  },

  {
    id: "FM_ANN_CONTINUOUS_EXPONENTIAL_PAYMENTS",
    domain: ANN,
    title: "Continuous Payments at an Exponential Rate",
    objective: "Accumulate a continuous stream whose payment rate grows exponentially under a constant force.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [200],
    generate: (rng: Rng) => {
      const A = rng.choice([50, 100, 200]);
      const c = rng.choice([0.2, 0.3, 0.5]);
      const t1 = rng.int(0, 2);
      const t2 = t1 + rng.int(2, 3);
      const t3 = t2 + rng.int(1, 2);
      const delta = gridRate(rng, 0.04, 0.1, 0.01);
      const value =
        ((A * Math.exp(delta * t3)) / (c - delta)) * (Math.exp((c - delta) * t2) - Math.exp((c - delta) * t1));
      return {
        questionText: `Payments are made to an account at a continuous rate of $${A}e^{${c}t}$ from time $t = ${t1}$ to time $t = ${t2}$.
The force of interest for the account is $\\delta = ${mpc(delta)}$.
Calculate the value of the account at time $t = ${t3}$.`,
        variables: { A, c, t1, t2, t3, delta },
        correctValue: value,
        format: "AMOUNT_0",
        distractors: [
          distractor(value * Math.exp(-delta * (t3 - t2)), "OFF_BY_ONE_PERIOD", `Valued the account at time ${t2} instead of ${t3}.`),
          distractor((A / c) * (Math.exp(c * t2) - Math.exp(c * t1)), "CALCULATION_DISTRACTOR", "Ignored interest."),
          distractor(value * Math.exp(-delta * t3), "CALCULATION_DISTRACTOR", "Valued the account at time 0 instead."),
          distractor(((A * Math.exp(delta * t3)) / (c - delta)) * (Math.exp((c - delta) * t2) - Math.exp((c - delta) * t1)) * Math.exp(delta), "OFF_BY_ONE_PERIOD", "Accumulated one year too far."),
        ],
        solutionSteps: `**Step 1 — Set up the integral.** A payment at time $t$ accumulates by $e^{${dec(delta, 2)}(${t3} - t)}$:
$$\\int_{${t1}}^{${t2}} ${A}e^{${c}t}\\,e^{${dec(delta, 2)}(${t3} - t)}\\,dt = ${A}e^{${dec(delta * t3, 2)}}\\int_{${t1}}^{${t2}} e^{${dec(c - delta, 2)}t}\\,dt.$$

**Step 2 — Evaluate.**
$$${A}e^{${dec(delta * t3, 2)}}\\cdot\\frac{e^{${dec((c - delta) * t2, 2)}} - e^{${dec((c - delta) * t1, 2)}}}{${dec(c - delta, 2)}} = ${mn(value, 2)}.$$`,
        checks: [{ label: "payment rate exceeds the force", ok: c > delta }],
      };
    },
  },
];
