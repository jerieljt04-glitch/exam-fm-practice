/**
 * Non-level annuities — arithmetic, geometric and multi-phase payment streams —
 * modelled on the SOA sample-set question types for the annuities section.
 */
import type { Rng } from "../../random";
import { distractor, type GeneratedQuestionItem, type QuestionTemplateDefinition } from "../types";
import {
  Ia,
  acc,
  adue,
  amt,
  an,
  cast,
  close,
  dec,
  drawUntil,
  eff,
  geo,
  gridAmount,
  gridRate,
  mamt,
  mn,
  mpc,
  n,
  nom,
  ord,
  pc,
  sn,
  solve,
  trySolve,
  v,
  word,
} from "./kit";

const ANN = "ANNUITIES" as const;

/** Present value of a finite list of payments at times 1..n (or 0..n-1 when due). */
function pvList(payments: readonly number[], i: number, first: number): number {
  return payments.reduce((sum, amount, k) => sum + amount * v(i, first + k), 0);
}

/** Two-phase geometric perpetuity: payments 1..K grow at g1, later payments at g2. */
function twoPhasePv(A: number, due: boolean, K: number, g1: number, g2: number, i: number): number {
  const start = due ? 0 : 1;
  const firstPhase = Array.from({ length: K }, (_, k) => A * Math.pow(1 + g1, k));
  const lastEarly = firstPhase[K - 1];
  const tail = (lastEarly * (1 + g2) * v(i, start + K)) / (1 - (1 + g2) / (1 + i));
  return pvList(firstPhase, i, start) + tail;
}

export const SOA_VARYING_ANNUITY_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ANN_ARITHMETIC_THEN_LEVEL_PERPETUITY_N",
    domain: ANN,
    title: "Increasing then Level Perpetuity: Solve for the Term",
    objective: "Recognise an increasing-then-level perpetuity as a sum of deferred level perpetuities and solve for the term.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [4],
    generate: (rng: Rng) => {
      const { unit, i, term, price } = drawUntil(
        () => {
          const unit = rng.choice([1, 10, 100]);
          const i = gridRate(rng, 0.06, 0.12, 0.005);
          const term = rng.int(10, 25);
          const exact = (unit * an(term, i)) / i;
          const price = unit === 1 ? Number(exact.toFixed(1)) : Math.round(exact);
          return { unit, i, term, price };
        },
        (p) => {
          const neighbours = [p.term - 1, p.term + 1].map((t) => (p.unit * an(t, p.i)) / p.i);
          return neighbours.every((value) => Math.abs(value - p.price) > (p.unit === 1 ? 0.3 : 3));
        },
        { unit: 1, i: 0.105, term: 19, price: 77.1 }
      );
      return {
        questionText: `A perpetuity costs ${n(price, unit === 1 ? 1 : 0)} and makes payments at the end of each year. It pays ${n(unit)} at the end of year 2, ${n(2 * unit)} at the end of year 3, and so on, increasing by ${n(unit)} each year until it pays ${unit === 1 ? "$n$" : `$${unit}n$`} at the end of year $n + 1$. After that the payments remain at ${unit === 1 ? "$n$" : `$${unit}n$`}.
The annual effective interest rate is ${pc(i)}.
Calculate $n$.`,
        variables: { unit, i, price },
        correctValue: term,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 1,
        distractors: [],
        solutionSteps: `**Step 1 — Decompose the payments.** The stream is the sum of $n$ level perpetuities of ${n(unit)}, the first starting at the end of year 2, the next at the end of year 3, and so on.

**Step 2 — Value the sum.** A perpetuity of ${n(unit)} whose first payment is at time $k + 1$ is worth $${unit}v^k/i$, so
$$\\frac{${unit}}{i}\\left(v + v^2 + \\cdots + v^n\\right) = \\frac{${unit}\\,a_{\\overline{n}|}}{i} = ${mn(price, unit === 1 ? 1 : 0)}.$$

**Step 3 — Solve.** $a_{\\overline{n}|${mpc(i)}} = ${mn(price, unit === 1 ? 1 : 0)} \\times ${dec(i, 3)}/${unit} = ${dec((price * i) / unit, 4)}$, which gives $n = ${term}$ (for comparison, $a_{\\overline{${term}}|} = ${dec(an(term, i), 4)}$).`,
        checks: [{ label: "term reproduces the price", ok: Math.abs((unit * an(term, i)) / i - price) < (unit === 1 ? 0.05 : 0.5) }],
      };
    },
  },

  {
    id: "FM_ANN_EXCHANGE_FOR_GEOMETRIC",
    domain: ANN,
    title: "Exchanging a Level Stream for a Geometric One",
    objective: "Value the remaining payments of a level annuity or perpetuity and exchange them for a geometrically increasing stream of equal value.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [8, 309],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [holder] = cast(rng);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const P = rng.choice([100, 500, 1000, 2400]);
      const perpetual = rng.next() < 0.5;
      const sourceTerm = perpetual ? 0 : rng.choice([20, 25, 30]);
      const after = perpetual ? rng.choice([5, 10]) : rng.int(5, sourceTerm - 8);
      const value = perpetual ? P / i : P * an(sourceTerm - after, i);
      const semi = rng.next() < 0.4;
      if (semi) {
        const g = rng.choice([0.005, 0.01, 0.015]);
        const j = Math.pow(1 + i, 0.5) - 1;
        const K = value * (j - g);
        return {
          questionText: `${holder} owns ${perpetual ? `a perpetuity-immediate paying ${n(P)} per year` : `an annuity-immediate paying ${n(P)} at the end of each year for ${sourceTerm} years`}.
Immediately after the ${ord(after)} payment, ${holder} exchanges it for a perpetuity-immediate of equal value with semiannual payments. The first semiannual payment is $K$, and each later payment is ${pc(g, 1)} larger than the one before.
Present values are based on ${eff(i)}.
Calculate $K$.`,
          variables: { P, i, perpetual: perpetual ? 1 : 0, sourceTerm, after, semi: 1, g },
          correctValue: K,
          format: K >= 100 ? "AMOUNT_0" : "AMOUNT_2",
          distractors: [
            distractor(value * (i / 2 - g), "NOMINAL_RATE_ERROR", "Used half the annual rate as the semiannual rate."),
            distractor(value * (j - g) / (1 + j), "ANNUITY_DUE_CONFUSION", "Valued the new perpetuity as payable in advance."),
            distractor(value * j, "CALCULATION_DISTRACTOR", "Ignored the growth of the semiannual payments."),
            distractor((perpetual ? P / i : P * an(sourceTerm - after + 1, i)) * (j - g), "OFF_BY_ONE_PERIOD", "Counted one payment too many as remaining."),
          ],
          solutionSteps: `**Step 1 — Value of what is given up.** ${perpetual ? `A perpetuity of ${n(P)} is worth $${mn(P)}/${dec(i, 3)} = ${mn(value, 2)}$ at any payment date.` : `${sourceTerm - after} payments remain: $${mn(P)}\\,a_{\\overline{${sourceTerm - after}}|${mpc(i)}} = ${mn(value, 2)}$.`}

**Step 2 — Semiannual growing perpetuity.** With $j = (1.${dec(i, 3).slice(2)})^{1/2} - 1 = ${dec(j, 6)}$,
$$\\frac{K}{j - ${dec(g, 3)}} = ${mn(value, 2)} \\implies K = ${mn(value, 2)}(${dec(j - g, 6)}) = ${mn(K, 4)}.$$`,
          checks: [{ label: "growth below the semiannual rate", ok: g < j }],
        };
      }
      const term = rng.choice([15, 20, 25, 30]);
      const g = rng.choice([i, Number((i - 0.02).toFixed(4)), 0.02, 0.03]);
      const X = value / geo(term, i, g);
      return {
        questionText: `${holder} owns ${perpetual ? `a perpetuity-immediate paying ${n(P)} per year` : `an annuity-immediate paying ${n(P)} at the end of each year for ${sourceTerm} years`}.
Immediately after the ${ord(after)} payment, it is exchanged for a ${term}-year annuity-immediate that pays $X$ at the end of the first year, with each later annual payment ${pc(g)} greater than the one before.
The annual effective interest rate is ${pc(i)}.
Calculate $X$.`,
        variables: { P, i, perpetual: perpetual ? 1 : 0, sourceTerm, after, semi: 0, term, g },
        correctValue: X,
        format: X >= 100 ? "AMOUNT_0" : "AMOUNT_2",
        distractors: [
          distractor(value / an(term, i), "CALCULATION_DISTRACTOR", "Ignored the growth and used a level annuity."),
          distractor(value / (geo(term, i, g) * (1 + i)), "ANNUITY_DUE_CONFUSION", "Valued the new annuity as an annuity-due."),
          distractor((perpetual ? P / i + P : P * an(sourceTerm - after + 1, i)) / geo(term, i, g), "OFF_BY_ONE_PERIOD", "Included the payment just made in the value exchanged."),
          distractor(value / (term / (1 + i)), "CALCULATION_DISTRACTOR", "Used the equal-rates shortcut $n/(1+i)$ when the growth rate differs from the interest rate."),
        ],
        solutionSteps: `**Step 1 — Value exchanged.** ${perpetual ? `The perpetuity is worth $${mn(P)}/${dec(i, 3)} = ${mn(value, 2)}$ just after a payment.` : `${sourceTerm - after} payments remain, worth $${mn(P)}\\,a_{\\overline{${sourceTerm - after}}|${mpc(i)}} = ${mn(value, 2)}$.`}

**Step 2 — Growing annuity factor.** ${Math.abs(g - i) < 1e-12 ? `Since $g = i$, each discounted payment equals $X/(1+i)$, so the factor is $${term}/${dec(1 + i, 3)} = ${dec(geo(term, i, g), 5)}$.` : `$$\\frac{1 - \\left(\\frac{1 + ${dec(g, 4)}}{1 + ${dec(i, 3)}}\\right)^{${term}}}{${dec(i, 3)} - ${dec(g, 4)}} = ${dec(geo(term, i, g), 5)}.$$`}
So $X = ${mn(value, 2)}/${dec(geo(term, i, g), 5)} = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "direct sum of the growing annuity",
            ok: close(pvList(Array.from({ length: term }, (_, k) => X * Math.pow(1 + g, k)), i, 1), value),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_LEVEL_THEN_GROWTH_SOLVE_RATE",
    domain: ANN,
    title: "Level Payments followed by Geometric Growth: Solve for the Growth Rate",
    objective: "Value a perpetuity whose payments become geometrically increasing after a level period and solve for the growth rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [11, 201],
    generate: (rng: Rng) => {
      const [buyer] = cast(rng);
      const params = drawUntil(
        () => {
          const L = rng.choice([10, 100, 1000, 2500]);
          const N = rng.int(4, 15);
          const first = rng.choice([1, 1, 2, 3]);
          const i = gridRate(rng, 0.035, 0.1, 0.001);
          const kTrue = gridRate(rng, 0.01, i - 0.015, 0.001);
          const exact = L * v(i, first - 1) * an(N, i) + (L * v(i, first + N - 1) * (1 + kTrue)) / (i - kTrue);
          const PV = Number(exact.toFixed(exact < 1000 ? 2 : 0));
          const pvOf = (k: number) => L * v(i, first - 1) * an(N, i) + (L * v(i, first + N - 1) * (1 + k)) / (i - k);
          const K = solve((k) => pvOf(k) - PV, -0.5, i - 1e-9);
          return { L, N, first, i, PV, K };
        },
        (p) => p.K > 0.005 && p.K < p.i - 0.01,
        { L: 10, N: 5, first: 1, i: 0.092, PV: 167.5, K: 0.04 }
      );
      const { L, N, first, i, PV, K } = params;
      const levelPart = L * v(i, first - 1) * an(N, i);
      const wrongFirst = solve((k) => levelPart + (L * v(i, first + N - 1)) / (i - k) - PV, -0.5, i - 1e-9);
      return {
        questionText: `${buyer} buys a perpetuity with annual payments. The first ${N} payments are each ${n(L)}, with the first payment ${first === 1 ? "one year from now" : `${word(first)} years from now`}.
Beginning with the ${ord(N + 1)} payment, each payment is $K\\%$ larger than the payment before it, where $K$ is less than ${rateFigureOf(i)}.
At ${eff(i)}, the perpetuity has a present value of ${amt(PV)}.
Calculate $K$.`,
        variables: { L, N, first, i, PV },
        correctValue: K * 100,
        format: "AMOUNT_2",
        distractors: [
          distractor(wrongFirst * 100, "OFF_BY_ONE_PERIOD", `Took the ${ord(N + 1)} payment to be ${n(L)} rather than ${n(L)}$(1 + K)$.`),
          distractor(trySolve((k) => levelPart + (L * v(i, first + N) * (1 + k)) / (i - k) - PV, -0.5, i - 1e-9) * 100, "OFF_BY_ONE_PERIOD", "Discounted the growing payments one year too far."),
          distractor(trySolve((k) => levelPart + (L * v(i, first + N - 2) * (1 + k)) / (i - k) - PV, -0.5, i - 1e-9) * 100, "OFF_BY_ONE_PERIOD", "Discounted the growing payments one year too little."),
          distractor(trySolve((k) => L * v(i, first - 1) * adue(N, i) + (L * v(i, first + N - 1) * (1 + k) * (1 + i)) / (i - k) - PV, -0.5, i - 1e-9) * 100, "ANNUITY_DUE_CONFUSION", "Valued the payments as though each were one year earlier."),
        ],
        solutionSteps: `**Step 1 — Level payments.** They are made at times ${first} through ${first + N - 1}:
$$${mn(L)}\\,v^{${first - 1}}\\,a_{\\overline{${N}}|${mpc(i)}} = ${mn(levelPart, 4)}.$$

**Step 2 — Growing payments.** The ${ord(N + 1)} payment, ${n(L)}$(1+K)$, is made at time ${first + N}; valued one year before it, the growing perpetuity is worth $${mn(L)}(1+K)/(i - K)$:
$$v^{${first + N - 1}}\\,\\frac{${mn(L)}(1+K)}{${dec(i, 3)} - K} = ${mamt(PV)} - ${mn(levelPart, 4)} = ${mn(PV - levelPart, 4)}.$$

**Step 3 — Solve for $K$.** With $c = ${mn(PV - levelPart, 4)}(1.${dec(i, 3).slice(2)})^{${first + N - 1}}/${mn(L)} = ${dec(((PV - levelPart) * acc(i, first + N - 1)) / L, 5)}$,
$$\\frac{1 + K}{${dec(i, 3)} - K} = c \\implies K = \\frac{${dec(i, 3)}c - 1}{c + 1} = ${dec(K, 5)},$$
so $K = ${dec(K * 100, 3)}$.`,
        checks: [
          {
            label: "present value reproduced",
            ok: close(levelPart + (L * v(i, first + N - 1) * (1 + K)) / (i - K), PV, 1e-9),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_DEPOSITS_GIVEN_POWER",
    domain: ANN,
    title: "Accumulating Deposits Given (1 + i)^n",
    objective: "Use a given accumulation factor to reduce an equation of value to one linear in i.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [14],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const A = gridAmount(rng, 50, 500, 1);
          const c = rng.choice([2, 3]);
          const u = rng.choice([1.5, 2, 2.5]);
          const target = gridRate(rng, 0.05, 0.15, 0.0025);
          const K = (u - 1) * u * u + c * (u * u - 1);
          const F = Math.round((A * K) / target / 100) * 100;
          const i = (A * K) / F;
          return { A, c, u, K, F, i };
        },
        (p) => p.i > 0.04 && p.i < 0.16,
        { A: 98, c: 2, u: 2, K: 10, F: 8000, i: 0.1225 }
      );
      const { A, c, u, K, F, i } = params;
      return {
        questionText: `To accumulate ${n(F)} at the end of $3n$ years, deposits of ${n(A)} are made at the end of each of the first $n$ years and ${n(c * A)} at the end of each of the next $2n$ years.
The annual effective interest rate is $i$. You are given $(1 + i)^n = ${u}$.
Calculate $i$.`,
        variables: { A, c, u, F },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(((A * ((u - 1) * u + c * (u * u - 1))) / F) * 100, "OFF_BY_ONE_PERIOD", "Accumulated the first deposits for only $n$ more years instead of $2n$."),
          distractor(((A * ((u - 1) * u * u + c * (u - 1))) / F) * 100, "CALCULATION_DISTRACTOR", "Used $s_{\\overline{n}|}$ for the later deposits instead of $s_{\\overline{2n}|}$."),
          distractor(((A * ((u - 1) * u * u + c * (u * u - 1)) * u) / F) * 100, "ANNUITY_DUE_CONFUSION", "Accumulated every deposit for an extra $n$ years."),
          distractor(((A * (1 + c) * (u * u * u - 1)) / F) * 100, "CALCULATION_DISTRACTOR", "Treated all deposits as spanning the full $3n$ years."),
        ],
        solutionSteps: `**Step 1 — Express the annuity factors.** With $(1+i)^n = ${u}$: $s_{\\overline{n}|} = \\dfrac{${u} - 1}{i}$ and $s_{\\overline{2n}|} = \\dfrac{${u}^2 - 1}{i}$.

**Step 2 — Equation of value at time $3n$.**
$$${mn(A)}\\,s_{\\overline{n}|}(1+i)^{2n} + ${mn(c * A)}\\,s_{\\overline{2n}|} = \\frac{${mn(A)}\\left[(${u} - 1)(${u})^2 + ${c}(${u}^2 - 1)\\right]}{i} = \\frac{${mn(A * K, 2)}}{i}.$$

**Step 3 — Solve.** $\\dfrac{${mn(A * K, 2)}}{i} = ${mn(F)}$, so $i = ${mpc(i, 4)}$.`,
        checks: [{ label: "linear solution", ok: close((A * K) / i, F) }],
      };
    },
  },

  {
    id: "FM_ANN_MONTHLY_INCREASING_ANNUITY",
    domain: ANN,
    title: "Monthly Arithmetically Increasing Annuity",
    objective: "Value a monthly increasing annuity using the rate per payment period implied by a nominal rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [15, 118],
    generate: (rng: Rng) => {
      const [buyer] = cast(rng);
      const P = rng.choice([2, 5, 10, 20]);
      const years = rng.choice([3, 4, 5]);
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const m = rng.choice([4, 12, 2]);
      const r = Math.pow(1 + j / m, m / 12) - 1;
      const X = P * Ia(12 * years, r);
      return {
        questionText: `${buyer} buys a ${years}-year increasing annuity for $X$. ${buyer} will receive ${n(P)} at the end of the first month, ${n(2 * P)} at the end of the second month, and each later monthly payment increases by ${n(P)}.
The annual nominal interest rate is ${pc(j)} convertible ${m === 12 ? "monthly" : m === 4 ? "quarterly" : "semiannually"}.
Calculate $X$.`,
        variables: { P, years, j, m },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(P * Ia(12 * years, j / 12), "NOMINAL_RATE_ERROR", `Used ${pc(j)}/12 as the monthly rate.`),
          distractor(P * Ia(12 * years, r) * (1 + r), "ANNUITY_DUE_CONFUSION", "Valued the payments as made at the start of each month."),
          distractor(((P * (12 * years + 1)) / 2) * an(12 * years, r), "CALCULATION_DISTRACTOR", "Replaced the increasing payments by their average."),
          distractor(P * Ia(12 * years - 1, r), "OFF_BY_ONE_PERIOD", "Counted one payment too few."),
        ],
        solutionSteps: `**Step 1 — Monthly rate.** $r = \\left(1 + \\frac{${dec(j, 2)}}{${m}}\\right)^{${m}/12} - 1 = ${dec(r, 6)}$.

**Step 2 — Increasing annuity.** With $n = ${12 * years}$ payments,
$$X = ${n(P)}(Ia)_{\\overline{${12 * years}}|r} = ${n(P)}\\cdot\\frac{\\ddot{a}_{\\overline{${12 * years}}|} - ${12 * years}v^{${12 * years}}}{r} = ${n(P)}\\cdot\\frac{${dec(adue(12 * years, r), 4)} - ${dec(12 * years * v(r, 12 * years), 4)}}{${dec(r, 6)}} = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: 12 * years }, (_, k) => P * (k + 1)), r, 1), X),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_INFLATION_INDEXED_CLAIMS",
    domain: ANN,
    title: "Claim Payments Indexed to Inflation",
    objective: "Value geometrically increasing payments when the first payment already includes a year of inflation.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [26],
    generate: (rng: Rng) => {
      const C = gridAmount(rng, 2000, 10000, 500);
      const r = gridRate(rng, 0.02, 0.08, 0.005);
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const count = rng.choice([10, 15, 20, 25]);
      const PV = C * (1 + r) * geo(count, i, r);
      return {
        questionText: `An insurer must pay a claimant's annual medical costs. Annual costs today are ${n(C)}, and medical inflation is expected to be ${pc(r)} per year.
The claimant will receive ${count} annual payments, the first one year from today.
Calculate the present value of the obligation at ${eff(i)}.`,
        variables: { C, r, i, count },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(C * geo(count, i, r), "OFF_BY_ONE_PERIOD", "Did not inflate the first payment, which is made a year from now."),
          distractor(C * an(count, i), "CALCULATION_DISTRACTOR", "Ignored inflation."),
          distractor(C * (1 + r) * geo(count, i, r) * (1 + i), "ANNUITY_DUE_CONFUSION", "Treated the payments as made at the start of each year."),
          distractor(C * (1 + r) * an(count, (i - r) / (1 + r)), "CALCULATION_DISTRACTOR", "Discounted the inflated first payment at the real rate for every payment, applying one extra year of inflation."),
        ],
        solutionSteps: `**Step 1 — First payment.** A year from now the annual cost is $${mn(C)}(${dec(1 + r, 3)}) = ${mn(C * (1 + r), 2)}$, and each later payment is ${pc(r)} larger.

**Step 2 — Geometric annuity.**
$$${mn(C * (1 + r), 2)}\\cdot\\frac{1 - \\left(\\frac{${dec(1 + r, 3)}}{${dec(1 + i, 3)}}\\right)^{${count}}}{${dec(i, 3)} - ${dec(r, 3)}} = ${mn(PV, 2)}.$$`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: count }, (_, k) => C * Math.pow(1 + r, k + 1)), i, 1), PV),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_STEPPED_MONTHLY_RETIREMENT",
    domain: ANN,
    title: "Monthly Payments Increasing Once a Year",
    objective: "Value monthly payments that are level within each year and increase geometrically from year to year.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [74],
    generate: (rng: Rng) => {
      const [retiree] = cast(rng);
      const M = gridAmount(rng, 1000, 4000, 250);
      const g = gridRate(rng, 0.01, 0.04, 0.005);
      const years = rng.choice([15, 20, 25, 30]);
      const j = gridRate(rng, 0.04, 0.08, 0.005);
      const r = j / 12;
      const yearFactor = an(12, r);
      const ratio = (1 + g) / Math.pow(1 + r, 12);
      const P = M * yearFactor * ((1 - Math.pow(ratio, years)) / (1 - ratio));
      return {
        questionText: `${retiree} is offered monthly payments for ${years} years, starting one month after retirement.
In the first year each monthly payment is ${n(M)}. In each later year the monthly payments are ${pc(g)} larger than in the previous year.
Using ${nom(j, 12)}, the present value of the payments at retirement is $P$.
Calculate $P$.`,
        variables: { M, g, years, j },
        correctValue: P,
        format: "AMOUNT_0",
        distractors: [
          distractor(M * an(12 * years, r), "CALCULATION_DISTRACTOR", "Ignored the annual increases."),
          distractor(12 * M * geo(years, Math.pow(1 + r, 12) - 1, g), "CALCULATION_DISTRACTOR", "Paid each year's twelve payments at the end of the year."),
          distractor(M * yearFactor * geo(years, Math.pow(1 + r, 12) - 1, g), "OFF_BY_ONE_PERIOD", "Discounted each year's block one extra year."),
          distractor(M * an(12, r) * ((1 - Math.pow((1 + g) / (1 + j), years)) / (1 - (1 + g) / (1 + j))), "NOMINAL_RATE_ERROR", `Used ${pc(j)} as the annual effective rate between years.`),
        ],
        solutionSteps: `**Step 1 — Value of one year's payments at the start of that year.** At $r = ${dec(r, 5)}$ per month, a year of payments of 1 is worth $a_{\\overline{12}|r} = ${dec(yearFactor, 5)}$.

**Step 2 — Link the years.** Year $k$'s payments are $${mn(M)}(${dec(1 + g, 3)})^{k-1}$ each and start $12(k-1)$ months after retirement, so successive years are related by the factor
$$\\frac{1 + ${dec(g, 3)}}{(1 + r)^{12}} = ${dec(ratio, 6)}.$$

**Step 3 — Sum the geometric series.**
$$P = ${mn(M)}(${dec(yearFactor, 5)})\\cdot\\frac{1 - ${dec(ratio, 6)}^{${years}}}{1 - ${dec(ratio, 6)}} = ${mn(P, 2)}.$$`,
        checks: [
          {
            label: "direct monthly sum",
            ok: close(
              pvList(Array.from({ length: 12 * years }, (_, k) => M * Math.pow(1 + g, Math.floor(k / 12))), r, 1),
              P
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_DEFERRED_ARITHMETIC_LOAN",
    domain: ANN,
    title: "Deferred Arithmetically Increasing Annuity",
    objective: "Value a deferred annuity whose payments increase by a fixed amount each year.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [82, 262],
    generate: (rng: Rng) => {
      const first = rng.choice([5, 8, 10, 12]);
      const count = rng.choice([10, 15, 20, 25, 30]);
      const P = gridAmount(rng, 500, 5000, 500);
      const Q = gridAmount(rng, 100, 1000, 100);
      const i = gridRate(rng, 0.04, 0.08, 0.005);
      const loan = v(i, first - 1) * ((P - Q) * an(count, i) + Q * Ia(count, i));
      return {
        questionText: `A ${count}-year annuity-immediate is arranged to repay a loan taken out today at ${eff(i)}.
The first payment of the annuity is due in ${first} years and is ${n(P)}. Each subsequent payment is ${n(Q)} more than the previous one.
Calculate the amount of the loan.`,
        variables: { first, count, P, Q, i },
        correctValue: loan,
        format: "AMOUNT_0",
        distractors: [
          distractor(v(i, first) * ((P - Q) * an(count, i) + Q * Ia(count, i)), "OFF_BY_ONE_PERIOD", `Deferred the annuity ${first} years; the first payment at time ${first} means ${first - 1} years of deferral before an annuity-immediate.`),
          distractor(v(i, first - 1) * (P * an(count, i) + Q * Ia(count, i)), "CALCULATION_DISTRACTOR", `Added ${n(Q)} to the first payment as well.`),
          distractor(v(i, first - 1) * (P * an(count, i) + Q * (Ia(count - 1, i) * v(i, 1))), "CALCULATION_DISTRACTOR", "Valued the increases with the wrong increasing-annuity factor."),
          distractor(v(i, first - 2) * ((P - Q) * an(count, i) + Q * Ia(count, i)), "OFF_BY_ONE_PERIOD", "Deferred the annuity one year too few."),
        ],
        solutionSteps: `**Step 1 — Split the payments.** The payments are ${n(P - Q)} plus ${n(Q)}$k$ in the $k$-th year of the annuity, so one year before the first payment they are worth
$$${mn(P - Q)}\\,a_{\\overline{${count}}|} + ${mn(Q)}(Ia)_{\\overline{${count}}|} = ${mn((P - Q) * an(count, i) + Q * Ia(count, i), 2)}.$$

**Step 2 — Discount to today.** That valuation date is time ${first - 1}:
$$v^{${first - 1}}(${mn((P - Q) * an(count, i) + Q * Ia(count, i), 2)}) = ${mn(loan, 2)}.$$`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: count }, (_, k) => P + k * Q), i, first), loan),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_GROWING_DEPOSITS_AND_WITHDRAWALS",
    domain: ANN,
    title: "Growing Career Deposits Funding Growing Withdrawals",
    objective: "Find the rate at which growing deposits exactly fund growing withdrawals, then the balance at retirement.",
    difficulty: 4,
    topics: ["TIME_VALUE"],
    steps: 4,
    soaSamples: [83],
    generate: (rng: Rng) => {
      const [worker] = cast(rng);
      const build = (D: number, g: number, count: number, wcount: number, W: number) => {
        const deposits = (rate: number) =>
          Array.from({ length: count }, (_, k) => D * Math.pow(1 + g, k) * acc(rate, count - 1 - k)).reduce((a, b) => a + b, 0);
        const withdrawals = (rate: number) =>
          Array.from({ length: wcount }, (_, k) => W * Math.pow(1 + g, k) * v(rate, k)).reduce((a, b) => a + b, 0);
        const i = trySolve((rate) => deposits(rate) - withdrawals(rate), 0.001, 0.3);
        return { D, g, count, wcount, W, i, balance: Number.isFinite(i) ? deposits(i) : Number.NaN };
      };
      const params = drawUntil(
        () =>
          build(
            gridAmount(rng, 3000, 10000, 500),
            gridRate(rng, 0.02, 0.04, 0.005),
            rng.choice([25, 30, 35]),
            rng.choice([20, 25, 30]),
            gridAmount(rng, 30000, 80000, 5000)
          ),
        (p) => Number.isFinite(p.i) && p.i > 0.02 && p.i < 0.12,
        build(5000, 0.03, 30, 30, 50000)
      );
      const { D, g, count, wcount, W, i, balance } = params;
      const levelDeposits = D * sn(count, i);
      return {
        questionText: `${worker} works for ${count} years before retiring. At the end of the first year of work ${worker} deposits ${n(D)} into a retirement account, and each later year-end deposit is ${pc(g)} larger than the previous one, for a total of ${count} deposits.
${worker} will withdraw ${n(W)} at the beginning of the first year of retirement, and each later annual withdrawal will be ${pc(g)} larger than the previous one, for a total of ${wcount} withdrawals. The final withdrawal exhausts the account.
The account earns a constant annual effective interest rate.
Calculate the account balance just after the final deposit and before the first withdrawal.`,
        variables: { D, g, count, wcount, W },
        correctValue: balance,
        format: "AMOUNT_0",
        distractors: [
          distractor(levelDeposits, "CALCULATION_DISTRACTOR", "Ignored the growth in the deposits when accumulating them."),
          distractor((W * geo(wcount, i, g)), "ANNUITY_DUE_CONFUSION", "Valued the withdrawals as made at the end of each year."),
          distractor(balance * (1 + i), "OFF_BY_ONE_PERIOD", "Accumulated the balance one year past the last deposit."),
          distractor(W * wcount, "SIMPLE_INTEREST_ERROR", "Ignored both interest and growth in the withdrawals."),
        ],
        solutionSteps: `**Step 1 — Deposits at retirement.** The ${count} growing deposits accumulate to
$$${mn(D)}\\sum_{k=1}^{${count}} (${dec(1 + g, 3)})^{k-1}(1+i)^{${count}-k} = ${mn(D)}\\cdot\\frac{(1+i)^{${count}} - (${dec(1 + g, 3)})^{${count}}}{i - ${dec(g, 3)}}.$$

**Step 2 — Withdrawals at retirement.** The first withdrawal is at retirement, so they form a growing annuity-due:
$$${mn(W)}\\sum_{k=0}^{${wcount - 1}} (${dec(1 + g, 3)})^{k}v^{k}.$$

**Step 3 — Solve for the rate.** Equating the two and solving numerically gives $i = ${dec(i, 6)}$.

**Step 4 — Balance at retirement.** Either side at that rate gives the balance: ${n(balance, 2)}.`,
        checks: [
          {
            label: "deposits equal withdrawals at the solved rate",
            ok: close(
              balance,
              Array.from({ length: wcount }, (_, k) => W * Math.pow(1 + g, k) * v(i, k)).reduce((a, b) => a + b, 0),
              1e-7
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_GEOMETRIC_PERPETUITY_DUE_RATE",
    domain: ANN,
    title: "Rate from a Quarterly Geometric Perpetuity-Due",
    objective: "Infer the growth rate from two consecutive payments and solve for the annual effective rate from the price.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [84],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const P1 = gridAmount(rng, 1000, 5000, 500);
          const P2 = P1 + rng.choice([5, 10, 15, 20, 25]);
          const price = gridAmount(rng, 50000, 200000, 10000);
          const g = P2 / P1 - 1;
          const quarterly = (1 + g) / (1 - P1 / price) - 1;
          const i = Math.pow(1 + quarterly, 4) - 1;
          return { P1, P2, price, g, quarterly, i };
        },
        (p) => p.i > 0.04 && p.i < 0.15,
        { P1: 2000, P2: 2010, price: 100000, g: 0.005, quarterly: 1.005 / 0.98 - 1, i: Math.pow(1.005 / 0.98, 4) - 1 }
      );
      const { P1, P2, price, g, quarterly, i } = params;
      return {
        questionText: `An insurance company buys a perpetuity-due for ${n(price)}. The perpetuity makes quarterly payments that form a geometric series. The first two payments are ${n(P1)} and ${n(P2)}.
The price is based on an annual effective interest rate of $i$.
Calculate $i$.`,
        variables: { P1, P2, price },
        correctValue: i * 100,
        format: "PERCENT_1",
        distractors: [
          distractor(quarterly * 400, "NOMINAL_RATE_ERROR", "Reported four times the quarterly rate instead of the effective annual rate."),
          distractor((Math.pow(1 + ((1 + g) * (1 + P1 / price) - 1), 4) - 1) * 100, "ANNUITY_DUE_CONFUSION", "Priced the perpetuity as payable in arrears."),
          distractor((Math.pow(1 + P1 / price + g, 4) - 1) * 100, "CALCULATION_DISTRACTOR", "Added the growth rate to the payment-to-price ratio."),
          distractor((Math.pow(1 + P1 / price, 4) - 1) * 100, "CALCULATION_DISTRACTOR", "Ignored the growth in the payments."),
        ],
        solutionSteps: `**Step 1 — Growth per quarter.** $1 + g = ${n(P2)}/${n(P1)} = ${dec(1 + g, 6)}$.

**Step 2 — Price of the perpetuity-due.** With $j$ the quarterly rate, $${mn(price)} = \\dfrac{${mn(P1)}}{1 - (1+g)/(1+j)}$, so
$$\\frac{1+g}{1+j} = 1 - \\frac{${mn(P1)}}{${mn(price)}} = ${dec(1 - P1 / price, 6)} \\implies 1 + j = ${dec(1 + quarterly, 6)}.$$
Then $i = (1+j)^4 - 1 = ${mpc(i, 3)}$.`,
        checks: [
          {
            label: "price reproduced",
            ok: close(P1 / (1 - (1 + g) / (1 + quarterly)), price),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_SEMIANNUAL_INCREASING_PERPETUITY_RATE",
    domain: ANN,
    title: "Rate from an Increasing Semiannual Perpetuity-Due",
    objective: "Value a perpetuity-due with level then arithmetically increasing payments and solve for the rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [119],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 200, 1000, 50);
      const Q = gridAmount(rng, 100, 400, 50);
      const iTrue = gridRate(rng, 0.03, 0.07, 0.001);
      const jTrue = Math.pow(1 + iTrue, 0.5) - 1;
      const PV = Math.round((L * (1 + jTrue)) / jTrue + Q / (jTrue * jTrue));
      const j = solve((rate) => (L * (1 + rate)) / rate + Q / (rate * rate) - PV, 0.001, 0.5);
      const i = Math.pow(1 + j, 2) - 1;
      return {
        questionText: `A perpetuity-due with semiannual payments consists of two level payments of ${n(L)}, followed by increasing payments. Beginning with the third payment, each payment is ${n(Q)} larger than the payment before it.
At an annual effective interest rate of $i$, the present value of the perpetuity is ${n(PV)}.
Calculate $i$.`,
        variables: { L, Q, PV },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(j * 200, "NOMINAL_RATE_ERROR", "Reported twice the semiannual rate instead of the effective annual rate."),
          distractor((Math.pow(1 + trySolve((rate) => (L * (1 + rate)) / rate + (Q * (1 + rate)) / (rate * rate) - PV, 0.001, 0.5), 2) - 1) * 100, "OFF_BY_ONE_PERIOD", "Started the increases with the second payment."),
          distractor((Math.pow(1 + trySolve((rate) => L / rate + Q / (rate * rate) - PV, 0.001, 0.5), 2) - 1) * 100, "ANNUITY_DUE_CONFUSION", "Valued the level part as a perpetuity-immediate."),
          distractor(j * 100, "NOMINAL_RATE_ERROR", "Reported the semiannual rate."),
        ],
        solutionSteps: `**Step 1 — Split the payments.** Every payment includes ${n(L)}; payments three onward also include ${n(Q)}, ${n(2 * Q)}, ${n(3 * Q)}, ... With $j$ the semiannual rate:
$$\\text{level part: } ${mn(L)}\\,\\frac{1+j}{j}, \\qquad \\text{increases: } ${mn(Q)}\\sum_{k=2}^{\\infty}(k-1)v^k = \\frac{${mn(Q)}}{j^2}.$$

**Step 2 — Solve for $j$.**
$$${mn(L)}\\,\\frac{1+j}{j} + \\frac{${mn(Q)}}{j^2} = ${mn(PV)} \\implies j = ${dec(j, 6)}$$
(numerically; multiply through by $j^2$ to get a quadratic).

**Step 3 — Annualise.** $i = (1+j)^2 - 1 = ${mpc(i, 3)}$.`,
        checks: [
          {
            label: "direct sum of the perpetuity",
            ok: close(pvList(Array.from({ length: 6000 }, (_, k) => L + Q * Math.max(0, k - 1)), j, 0), PV, 1e-6),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_ARITHMETIC_PERPETUITY",
    domain: ANN,
    title: "Arithmetically Increasing Perpetuity",
    objective: "Use the increasing-perpetuity formula to find a present value, a first payment or an interest rate.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [120, 174, 254, 395],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["PV", "FIRST", "RATE", "DUE"] as const);
      if (variant === "RATE") {
        const P = gridAmount(rng, 100, 500, 10);
        const Q = gridAmount(rng, 5, 30, 5);
        const iTrue = gridRate(rng, 0.04, 0.09, 0.001);
        const PV = Math.round((P / iTrue + Q / (iTrue * iTrue)) / 100) * 100;
        const i = (P + Math.sqrt(P * P + 4 * PV * Q)) / (2 * PV);
        return {
          questionText: `A perpetuity-immediate is bought for ${n(PV)} at an annual effective interest rate of $i$, $i > 0$. It pays ${n(P)} in the first year and increases by ${n(Q)} each year thereafter.
Calculate $i$.`,
          variables: { variant, P, Q, PV },
          correctValue: i * 100,
          format: "PERCENT_1",
          distractors: [
            distractor((P / PV) * 100, "CALCULATION_DISTRACTOR", "Ignored the increases."),
            distractor(((P + Q) / PV) * 100, "CALCULATION_DISTRACTOR", "Treated the perpetuity as level at the second payment."),
            distractor(((P + Math.sqrt(P * P + 4 * PV * Q * 2)) / (2 * PV)) * 100, "CALCULATION_DISTRACTOR", "Doubled the increment term in the quadratic."),
            distractor(Math.sqrt(Q / PV) * 100, "CALCULATION_DISTRACTOR", "Kept only the increasing part."),
          ],
          solutionSteps: `**Step 1 — Present value.** Payments of ${n(P)}, ${n(P + Q)}, ${n(P + 2 * Q)}, ... are worth $\\dfrac{${n(P)}}{i} + \\dfrac{${n(Q)}}{i^2}$.

**Step 2 — Solve the quadratic.** $${mn(PV)}i^2 - ${mn(P)}i - ${mn(Q)} = 0$ gives
$$i = \\frac{${mn(P)} + \\sqrt{${mn(P)}^2 + 4(${mn(PV)})(${mn(Q)})}}{2(${mn(PV)})} = ${mpc(i, 3)}.$$`,
          checks: [{ label: "price reproduced", ok: close(P / i + Q / (i * i), PV) }],
        };
      }
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      if (variant === "FIRST") {
        const Q = gridAmount(rng, 2, 20, 1);
        const PTrue = gridAmount(rng, 2, 50, 1);
        const PV = Math.round(PTrue / i + Q / (i * i));
        const P = (PV - Q / (i * i)) * i;
        return {
          questionText: `A perpetuity-immediate has a first payment of $P$ and increases by ${n(Q)} each year. At ${eff(i)}, its present value is ${n(PV)}.
Calculate $P$.`,
          variables: { variant, Q, PV, i },
          correctValue: P,
          format: "AMOUNT_2",
          distractors: [
            distractor(PV * i, "CALCULATION_DISTRACTOR", "Ignored the increases."),
            distractor((PV - Q / (i * i)) * i - Q, "OFF_BY_ONE_PERIOD", "Subtracted one increment too many."),
            distractor((PV - (Q * (1 + i)) / (i * i)) * i, "ANNUITY_DUE_CONFUSION", "Valued the increases as a perpetuity-due."),
            distractor((PV - Q / i) * i, "CALCULATION_DISTRACTOR", "Valued the increases as $Q/i$ instead of $Q/i^2$."),
          ],
          solutionSteps: `**Step 1 — Present value formula.** $\\dfrac{P}{i} + \\dfrac{${n(Q)}}{i^2} = ${mn(PV)}$.

**Step 2 — Solve.** $\\dfrac{${n(Q)}}{${dec(i, 3)}^2} = ${mn(Q / (i * i), 2)}$, so $P = ${dec(i, 3)}(${mn(PV)} - ${mn(Q / (i * i), 2)}) = ${mn(P, 2)}$.`,
          checks: [{ label: "present value reproduced", ok: close(P / i + Q / (i * i), PV) }],
        };
      }
      const P = gridAmount(rng, 1, 20, 1);
      const Q = variant === "DUE" ? P : gridAmount(rng, 1, 10, 1);
      const due = variant === "DUE";
      const PV = due ? (P * (1 + i)) / i + (Q * (1 + i)) / (i * i) : P / i + Q / (i * i);
      return {
        questionText: due
          ? `At ${eff(i)}, the present value of an increasing perpetuity-due with annual payments of ${n(P)}, ${n(2 * P)}, ${n(3 * P)}, ... is $X$.\nCalculate $X$.`
          : `At ${eff(i)}, the present value of a perpetuity-immediate with successive annual payments of ${n(P)}, ${n(P + Q)}, ${n(P + 2 * Q)}, ${n(P + 3 * Q)}, ... is $X$.\nCalculate $X$.`,
        variables: { variant, P, Q, i },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(due ? P / i + Q / (i * i) : (P * (1 + i)) / i + (Q * (1 + i)) / (i * i), "ANNUITY_DUE_CONFUSION", due ? "Valued the payments as made at the end of each year." : "Valued the payments as made at the start of each year."),
          distractor(P / i + Q / i, "CALCULATION_DISTRACTOR", "Valued the increases as $Q/i$ instead of $Q/i^2$."),
          distractor(P / (i * i), "CALCULATION_DISTRACTOR", "Used $1/i^2$ for the whole stream."),
          distractor((P - Q) / i + Q / (i * i) + (due ? 0 : Q / i), "CALCULATION_DISTRACTOR", "Misaligned the level and increasing parts."),
        ],
        solutionSteps: due
          ? `**Step 1 — Increasing perpetuity-due.** $(I\\ddot{a})_{\\overline{\\infty}|} = \\dfrac{1}{d^2}$ with $d = i/(1+i) = ${dec(i / (1 + i), 6)}$.\n\n**Step 2 — Scale.** $X = ${n(P)} \\times \\dfrac{1}{${dec(i / (1 + i), 6)}^2} = ${mn(PV, 2)}$.`
          : `**Step 1 — Split the payments.** ${n(P)}, ${n(P + Q)}, ... is a level perpetuity of ${n(P - Q)} plus an increasing perpetuity of ${n(Q)}, ${n(2 * Q)}, ...\n\n**Step 2 — Value.** $\\dfrac{${n(P - Q)}}{${dec(i, 3)}} + \\dfrac{${n(Q)}}{${dec(i, 3)}}\\cdot\\dfrac{1}{d} = \\dfrac{${n(P)}}{i} + \\dfrac{${n(Q)}}{i^2} = ${mn(PV, 2)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: 6000 }, (_, k) => P + k * Q), i, due ? 0 : 1), PV, 1e-6),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_PROJECT_GROWING_OUTLAYS",
    domain: ANN,
    title: "Project with Growing Outlays and Perpetual Income",
    objective: "Balance geometrically increasing outlays against a perpetuity of income to find the initial outlay.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [121],
    generate: (rng: Rng) => {
      const income = gridAmount(rng, 50, 500, 10);
      const k = rng.choice([3, 4, 5, 6]);
      const g = gridRate(rng, 0.02, 0.06, 0.01);
      const i = gridRate(rng, 0.06, 0.12, 0.0025);
      const outlays = Array.from({ length: k + 1 }, (_, t) => Math.pow(1 + g, t) * v(i, t)).reduce((a, b) => a + b, 0);
      const X = income / i / outlays;
      return {
        questionText: `A company is considering a project that requires an investment of $X$ today. Further investments are required at the beginning of each of the next ${word(k)} years, each ${pc(g)} greater than the previous year's investment.
The project is expected to produce income of ${n(income)} at the end of each year forever, starting at the end of the first year.
At ${eff(i)}, the project has a net present value of zero.
Calculate $X$.`,
        variables: { income, k, g, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(income / i / Array.from({ length: k }, (_, t) => Math.pow(1 + g, t) * v(i, t)).reduce((a, b) => a + b, 0), "OFF_BY_ONE_PERIOD", `Counted ${k} investments in total instead of ${k + 1}.`),
          distractor(income / (i / (1 + i)) / outlays, "ANNUITY_DUE_CONFUSION", "Valued the income as a perpetuity-due."),
          distractor(income / i / (k + 1), "SIMPLE_INTEREST_ERROR", "Ignored the growth and discounting of the investments."),
          distractor(income / i / an(k + 1, i) / (1 + i), "CALCULATION_DISTRACTOR", "Ignored the growth in the investments."),
        ],
        solutionSteps: `**Step 1 — Income.** A perpetuity-immediate of ${n(income)}: $${mn(income)}/${dec(i, 4)} = ${mn(income / i, 2)}$.

**Step 2 — Investments and solve.** The ${k + 1} investments are $X(${dec(1 + g, 2)})^t$ at $t = 0, 1, \\ldots, ${k}$:
$$X\\sum_{t=0}^{${k}}\\left(\\frac{${dec(1 + g, 2)}}{${dec(1 + i, 4)}}\\right)^t = ${dec(outlays, 5)}X = ${mn(income / i, 2)} \\implies X = ${mn(X, 2)}.$$`,
        checks: [{ label: "net present value zero", ok: close(X * outlays, income / i) }],
      };
    },
  },

  {
    id: "FM_ANN_LEVEL_THEN_GEOMETRIC_DUE_X",
    domain: ANN,
    title: "Perpetuity-Due: Level then Geometric",
    objective: "Value a perpetuity-due with level payments followed by geometric growth and solve for the level payment.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [122],
    generate: (rng: Rng) => {
      const N = rng.choice([5, 8, 10, 12]);
      const i = gridRate(rng, 0.04, 0.08, 0.005);
      const g = gridRate(rng, 0.005, i - 0.01, 0.005);
      const PV = gridAmount(rng, 20000, 100000, 5000);
      const level = adue(N, i);
      const growing = (Math.pow(1 + g, 1) * v(i, N)) / (1 - (1 + g) / (1 + i));
      const X = PV / (level + growing);
      return {
        questionText: `A perpetuity-due with annual payments consists of ${word(N)} level payments of $X$ followed by increasing payments. Beginning with the ${ord(N + 1)} payment, each payment is ${pc(g)} larger than the payment before it.
Using ${eff(i)}, the present value of the perpetuity is ${n(PV)}.
Calculate $X$.`,
        variables: { N, i, g, PV },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(PV / (level + v(i, N) / (1 - (1 + g) / (1 + i))), "OFF_BY_ONE_PERIOD", `Took the ${ord(N + 1)} payment to be $X$ rather than $X(${dec(1 + g, 3)})$.`),
          distractor(PV / (an(N, i) + (1 + g) * v(i, N + 1) / (1 - (1 + g) / (1 + i))), "ANNUITY_DUE_CONFUSION", "Valued the payments as made at the end of each year."),
          distractor(PV / ((1 + i) / (i - g)), "CALCULATION_DISTRACTOR", "Treated the whole perpetuity as growing from the first payment."),
          distractor(PV / (level + (1 + g) * v(i, N) / (i - g)), "CALCULATION_DISTRACTOR", "Valued the growing part as though it were payable in arrears."),
        ],
        solutionSteps: `**Step 1 — Level payments.** $X\\,\\ddot{a}_{\\overline{${N}}|${mpc(i)}} = ${dec(level, 5)}X$.

**Step 2 — Growing payments.** They start at time ${N} with $X(${dec(1 + g, 3)})$:
$$X(${dec(1 + g, 3)})v^{${N}}\\cdot\\frac{1}{1 - \\frac{${dec(1 + g, 3)}}{${dec(1 + i, 3)}}} = ${dec(growing, 5)}X.$$

**Step 3 — Solve.** $(${dec(level, 5)} + ${dec(growing, 5)})X = ${mn(PV)}$, so $X = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: 8000 }, (_, k) => X * Math.pow(1 + g, Math.max(0, k - N + 1))), i, 0), PV, 1e-6),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_DECREASING_GEOMETRIC_PERPETUITY",
    domain: ANN,
    title: "Geometrically Decreasing Perpetuity",
    objective: "Price a geometrically decreasing perpetuity, or recover its first payment or decrease rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [123, 237, 424],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["FIRST", "RATE", "CORRECTION"] as const);
      if (variant === "FIRST") {
        const r = gridRate(rng, 0.002, 0.02, 0.001);
        const delta = gridRate(rng, 0.04, 0.08, 0.005);
        const price = gridAmount(rng, 10000, 50000, 1000);
        const i = Math.exp(delta) - 1;
        const P1 = price * (i + r);
        return {
          questionText: `A family buys a perpetuity-immediate whose annual payments decrease by ${pc(r, 1)} each year. The price is ${n(price)} at an annual force of interest of ${dec(delta, 3).replace(/0+$/, "")}.
Calculate the amount of the first payment.`,
          variables: { variant, r, delta, price },
          correctValue: P1,
          format: "AMOUNT_0",
          distractors: [
            distractor(price * (delta + r), "NOMINAL_RATE_ERROR", "Used the force of interest as the effective rate."),
            distractor(price * (i - r), "CALCULATION_DISTRACTOR", "Treated the payments as increasing."),
            distractor((price * (i + r)) / (1 + i), "ANNUITY_DUE_CONFUSION", "Priced the perpetuity as payable in advance."),
            distractor(price * i, "CALCULATION_DISTRACTOR", "Ignored the decrease."),
          ],
          solutionSteps: `**Step 1 — Effective rate.** $i = e^{${dec(delta, 3)}} - 1 = ${dec(i, 6)}$.

**Step 2 — Decreasing perpetuity.** Payments $P, P(1 - ${dec(r, 3)}), \\ldots$ are worth $\\dfrac{P}{i + ${dec(r, 3)}}$, so
$$P = ${mn(price)}(${dec(i, 6)} + ${dec(r, 3)}) = ${mn(P1, 2)}.$$`,
          checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: 4000 }, (_, k) => P1 * Math.pow(1 - r, k)), i, 1), price, 1e-6) }],
        };
      }
      if (variant === "RATE") {
        const i = gridRate(rng, 0.04, 0.08, 0.001);
        const first = gridAmount(rng, 500, 2000, 100);
        const rTrue = gridRate(rng, 0.002, 0.02, 0.0005);
        const price = Math.round(first / (i + rTrue) / 100) * 100;
        const r = first / price - i;
        return {
          questionText: `An annuity writer sells an annual perpetuity-immediate for ${n(price)}. The first payment is ${n(first)}, and the payments decrease by $r\\%$ each year.
The annual effective yield rate is ${pc(i, 1)}.
Calculate $r$.`,
          variables: { variant, i, first, price },
          correctValue: r * 100,
          format: "AMOUNT_2",
          distractors: [
            distractor((i - first / price) * 100, "CALCULATION_DISTRACTOR", "Reversed the sign: that is the rate of increase needed for the price."),
            distractor((first / price) * 100, "CALCULATION_DISTRACTOR", "Reported the payment-to-price ratio."),
            distractor(((first / price) * (1 + i) - i) * 100, "ANNUITY_DUE_CONFUSION", "Treated the perpetuity as payable in advance."),
            distractor((first / price - i) * 100 * (1 + i), "CALCULATION_DISTRACTOR", "Scaled the answer by $1 + i$."),
          ],
          solutionSteps: `**Step 1 — Decreasing perpetuity.** $\\dfrac{${mn(first)}}{i + r} = ${mn(price)}$.

**Step 2 — Solve.** $i + r = ${mn(first)}/${mn(price)} = ${dec(first / price, 6)}$, so $r = ${dec(first / price, 6)} - ${dec(i, 3)} = ${dec(r, 6)}$, i.e. $r = ${dec(r * 100, 3)}$.`,
          checks: [{ label: "price reproduced", ok: close(first / (i + r), price) }],
        };
      }
      const r = gridRate(rng, 0.01, 0.03, 0.005);
      const i = gridRate(rng, 0.05, 0.09, 0.001);
      const wrong = Number((i + rng.choice([0.004, 0.006, 0.008, 0.009])).toFixed(3));
      const wrongPayment = gridAmount(rng, 1000, 3000, 100);
      const price = wrongPayment / (wrong + r);
      const correct = price * (i + r);
      return {
        questionText: `An insurer plans to sell an annual perpetuity-immediate in which each payment after the first is ${pc(r, 1)} less than the previous payment. It has chosen a price and needs the amount of the first payment.
The annual effective yield rate is ${pc(i, 1)}, but the insurer mistakenly uses ${pc(wrong, 1)} and calculates a first payment of ${n(wrongPayment)}.
Calculate the correct first payment.`,
        variables: { variant, r, i, wrong, wrongPayment },
        correctValue: correct,
        format: "AMOUNT_0",
        distractors: [
          distractor(wrongPayment * (i / wrong), "CALCULATION_DISTRACTOR", "Scaled by the ratio of the rates, ignoring the decrease."),
          distractor(wrongPayment * ((i - r) / (wrong - r)), "CALCULATION_DISTRACTOR", "Treated the payments as increasing."),
          distractor(wrongPayment * ((wrong + r) / (i + r)), "CALCULATION_DISTRACTOR", "Inverted the correction factor."),
          distractor(wrongPayment - (wrong - i) * price, "SIMPLE_INTEREST_ERROR", "Subtracted the rate difference times the price, ignoring that the correction is multiplicative."),
        ],
        solutionSteps: `**Step 1 — Recover the price.** At the mistaken rate, $\\dfrac{${mn(wrongPayment)}}{${dec(wrong, 3)} + ${dec(r, 3)}} = ${mn(price, 2)}$.

**Step 2 — Correct payment.** $${mn(price, 2)}(${dec(i, 3)} + ${dec(r, 3)}) = ${mn(correct, 2)}$.`,
        checks: [{ label: "same price at the correct rate", ok: close(correct / (i + r), price) }],
      };
    },
  },

  {
    id: "FM_ANN_ARITHMETIC_DUE_TERM_CHANGE",
    domain: ANN,
    title: "Increasing Annuities-Due of Two Terms",
    objective: "Relate prices of increasing annuities-due of different terms at a continuously compounded rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [160],
    generate: (rng: Rng) => {
      const n1 = rng.choice([15, 20, 25]);
      const n2 = n1 + rng.choice([5, 10]);
      const delta = gridRate(rng, 0.04, 0.08, 0.005);
      const price1 = gridAmount(rng, 200000, 900000, 50000);
      const i = Math.exp(delta) - 1;
      const Iadue = (count: number) => Ia(count, i) * (1 + i);
      const X = price1 / Iadue(n1);
      const price2 = X * Iadue(n2);
      return {
        questionText: `A ${n1}-year arithmetically increasing annuity-due sells for ${n(price1)} and provides annual payments. The first payment is $X$, and each payment thereafter is $X$ more than the previous one.
A ${n2}-year arithmetically increasing annuity-due has the same payment pattern.
Both prices use a continuously compounded annual interest rate of ${pc(delta, 1)}.
Calculate the price of the ${n2}-year annuity.`,
        variables: { n1, n2, delta, price1 },
        correctValue: price2,
        format: "AMOUNT_0",
        distractors: [
          distractor(price1 * (Ia(n2, delta) / Ia(n1, delta)), "NOMINAL_RATE_ERROR", `Used ${pc(delta, 1)} as the annual effective rate.`),
          distractor(price1 * (n2 / n1), "SIMPLE_INTEREST_ERROR", "Scaled the price in proportion to the term."),
          distractor(price1 * (an(n2, i) / an(n1, i)), "CALCULATION_DISTRACTOR", "Scaled by level-annuity factors."),
          distractor(price1 * ((n2 * (n2 + 1)) / (n1 * (n1 + 1))), "SIMPLE_INTEREST_ERROR", "Scaled by the undiscounted totals of the payments."),
        ],
        solutionSteps: `**Step 1 — Rate.** $i = e^{${dec(delta, 3)}} - 1 = ${dec(i, 6)}$. An increasing annuity-due factor is $(I\\ddot{a})_{\\overline{n}|} = \\dfrac{\\ddot{a}_{\\overline{n}|} - nv^n}{d}$.

**Step 2 — Ratio of prices.** $(I\\ddot{a})_{\\overline{${n1}}|} = ${dec(Iadue(n1), 4)}$ and $(I\\ddot{a})_{\\overline{${n2}}|} = ${dec(Iadue(n2), 4)}$, so
$$${mn(price1)} \\times \\frac{${dec(Iadue(n2), 4)}}{${dec(Iadue(n1), 4)}} = ${mn(price2, 2)}.$$`,
        checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: n2 }, (_, k) => X * (k + 1)), i, 0), price2) }],
      };
    },
  },

  {
    id: "FM_ANN_MONTHLY_ARITHMETIC_ACCUMULATION",
    domain: ANN,
    title: "Accumulating Monthly Payments that Increase Arithmetically",
    objective: "Accumulate an arithmetically increasing monthly stream at an annual effective rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [169],
    generate: (rng: Rng) => {
      const first = gridAmount(rng, 500, 2000, 1);
      const step = rng.choice([2, 5, 10]);
      const years = rng.choice([5, 10, 15]);
      const i = gridRate(rng, 0.04, 0.08, 0.0025);
      const r = Math.pow(1 + i, 1 / 12) - 1;
      const count = 12 * years;
      const AV = acc(r, count) * pvList(Array.from({ length: count }, (_, k) => first + k * step), r, 1);
      return {
        questionText: `A borrower repays a loan over 20 years. The first payment is ${n(first)} at the end of the first month, and each later monthly payment is ${n(step)} more than the previous month's payment.
Calculate the accumulated value of the payments made during the first ${years} years, at the end of ${years} years, using ${eff(i)}.`,
        variables: { first, step, years, i },
        correctValue: AV,
        format: "AMOUNT_0",
        distractors: [
          distractor(acc(i / 12, count) * pvList(Array.from({ length: count }, (_, k) => first + k * step), i / 12, 1), "NOMINAL_RATE_ERROR", `Used ${pc(i)}/12 as the monthly rate.`),
          distractor(AV * (1 + r), "ANNUITY_DUE_CONFUSION", "Accumulated each payment one month too long."),
          distractor(first * sn(count, r), "CALCULATION_DISTRACTOR", "Ignored the increases."),
          distractor(first * sn(count, r) + step * ((sn(count, r) * (1 + r) - count) / r), "OFF_BY_ONE_PERIOD", `Added ${n(step)} to the first payment as well.`),
        ],
        solutionSteps: `**Step 1 — Monthly rate.** $r = (${dec(1 + i, 4)})^{1/12} - 1 = ${dec(r, 6)}$.

**Step 2 — Level plus increasing parts.** The payments are ${n(first - step)} plus ${n(step)}$k$ in month $k$, so
$$${mn(first - step)}\\,s_{\\overline{${count}}|r} + ${mn(step)}(Is)_{\\overline{${count}}|r} = ${mn(first - step)}(${dec(sn(count, r), 4)}) + ${mn(step)}\\cdot\\frac{\\ddot{s}_{\\overline{${count}}|} - ${count}}{r} = ${mn(AV, 2)}.$$`,
        checks: [
          {
            label: "closed form",
            ok: close((first - step) * sn(count, r) + step * ((sn(count, r) * (1 + r) - count) / r), AV),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_ARITHMETIC_DECREASING_PAYMENTS",
    domain: ANN,
    title: "Payments Decreasing by a Fixed Amount",
    objective: "Find the first payment of an annuity whose payments decrease by a fixed amount each year.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [179],
    generate: (rng: Rng) => {
      const invest = gridAmount(rng, 5000, 30000, 1000);
      const count = rng.choice([10, 15, 20, 25, 30]);
      const step = rng.choice([5, 10, 20, 25]);
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const X = (invest + step * (Ia(count, i) - an(count, i))) / an(count, i);
      return {
        questionText: `An investment of ${n(invest)} produces ${count} annual payments. The first payment, $X$, is made one year after the investment, and each later payment is ${n(step)} less than the one before.
At ${eff(i)}, calculate $X$.`,
        variables: { invest, count, step, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(invest / an(count, i), "CALCULATION_DISTRACTOR", "Ignored the decreases."),
          distractor((invest - step * (Ia(count, i) - an(count, i))) / an(count, i), "CALCULATION_DISTRACTOR", "Treated the payments as increasing."),
          distractor((invest + step * Ia(count, i)) / an(count, i), "OFF_BY_ONE_PERIOD", "Subtracted a decrease from the first payment too."),
          distractor((invest + step * (Ia(count, i) - an(count, i))) / adue(count, i), "ANNUITY_DUE_CONFUSION", "Valued the payments as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Write the payments.** The $k$-th payment is $X - ${n(step)}(k - 1)$, so the present value is $X a_{\\overline{${count}}|} - ${n(step)}\\left[(Ia)_{\\overline{${count}}|} - a_{\\overline{${count}}|}\\right]$.

**Step 2 — Solve.** With $a_{\\overline{${count}}|} = ${dec(an(count, i), 5)}$ and $(Ia)_{\\overline{${count}}|} = ${dec(Ia(count, i), 5)}$:
$$X = \\frac{${mn(invest)} + ${n(step)}(${dec(Ia(count, i) - an(count, i), 5)})}{${dec(an(count, i), 5)}} = ${mn(X, 2)}.$$`,
        checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: count }, (_, k) => X - step * k), i, 1), invest) }],
      };
    },
  },

  {
    id: "FM_ANN_SCHOLARSHIP_SEMIANNUAL_STEPS",
    domain: ANN,
    title: "Semiannual Scholarship Payments Increasing Each Year",
    objective: "Value a perpetuity of semiannual payments that increase arithmetically once a year.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [208],
    generate: (rng: Rng) => {
      const P = gridAmount(rng, 300, 2000, 100);
      const Q = rng.choice([10, 20, 25, 50]);
      const i = gridRate(rng, 0.05, 0.09, 0.0025);
      const PV = (1 + Math.pow(1 + i, 0.5)) * (P / i + Q / (i * i));
      return {
        questionText: `A college scholarship fund pays a sum twice a year. It pays ${n(P)} at the end of six months and another ${n(P)} at the end of one year. Every year thereafter, both semiannual payments increase by ${n(Q)}; for example, in year 2 both payments are ${n(P + Q)}.
The fund earns ${eff(i)}.
Calculate the fund balance needed today to provide the scholarship indefinitely.`,
        variables: { P, Q, i },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(2 * (P / i + Q / (i * i)), "CALCULATION_DISTRACTOR", "Treated both of each year's payments as made at the end of the year."),
          distractor((1 + Math.pow(1 + i, 0.5)) * (P / i + Q / i), "CALCULATION_DISTRACTOR", "Valued the increases as $Q/i$ instead of $Q/i^2$."),
          distractor((1 + (1 + i / 2)) * (P / i + Q / (i * i)), "NOMINAL_RATE_ERROR", "Used half the annual rate for the six-month shift."),
          distractor((2 * P) / i + (2 * Q) / (i * i) * (1 + i), "ANNUITY_DUE_CONFUSION", "Valued the increases as a perpetuity-due."),
        ],
        solutionSteps: `**Step 1 — Group each year's payments.** In year $k$ the fund pays $${mn(P)} + ${mn(Q)}(k - 1)$ at times $k - \\tfrac12$ and $k$. Moving the mid-year payment to the year end multiplies it by $(1+i)^{1/2}$, so each year is worth $\\left(1 + (1+i)^{1/2}\\right)\\left[${mn(P)} + ${mn(Q)}(k-1)\\right]$ at time $k$.

**Step 2 — Value the increasing perpetuity.** $\\displaystyle\\sum_{k\\ge1}\\left[${mn(P)} + ${mn(Q)}(k-1)\\right]v^k = \\frac{${mn(P)}}{i} + \\frac{${mn(Q)}}{i^2} = ${mn(P / i + Q / (i * i), 2)}$.

**Step 3 — Combine.** $(1 + ${dec(Math.pow(1 + i, 0.5), 6)})(${mn(P / i + Q / (i * i), 2)}) = ${mn(PV, 2)}$.`,
        checks: [
          {
            label: "direct semiannual sum",
            ok: close(
              Array.from({ length: 6000 }, (_, k) => {
                const year = Math.floor(k / 2) + 1;
                return (P + Q * (year - 1)) * Math.pow(1 + i, -(k + 1) / 2);
              }).reduce((a, b) => a + b, 0),
              PV,
              1e-6
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_GEOMETRIC_DEPOSITS_TARGET",
    domain: ANN,
    title: "Geometrically Increasing Deposits to Reach a Target",
    objective: "Accumulate geometrically increasing deposits and solve for the first deposit.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [215, 277],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const F = gridAmount(rng, 2000, 50000, 500);
      const count = rng.choice([10, 15, 20]);
      const g = gridRate(rng, 0.02, 0.1, 0.002);
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const factor = Math.abs(i - g) < 1e-12 ? count * acc(i, count - 1) : (acc(i, count) - Math.pow(1 + g, count)) / (i - g);
      const X = F / factor;
      return {
        questionText: `${saver} makes a deposit at the end of each year for ${count} years into a fund earning ${eff(i)}. The first deposit is $X$, and each later deposit is ${pc(g, 1)} greater than the previous one.
The fund holds ${n(F)} immediately after the ${ord(count)} deposit.
Calculate $X$.`,
        variables: { F, count, g, i },
        correctValue: X,
        format: X >= 1000 ? "AMOUNT_0" : "AMOUNT_2",
        distractors: [
          distractor(F / sn(count, i), "CALCULATION_DISTRACTOR", "Ignored the growth in the deposits."),
          distractor(F / (factor * (1 + i)), "ANNUITY_DUE_CONFUSION", "Accumulated the deposits one year too long."),
          distractor(F / ((acc(i, count) - Math.pow(1 + g, count)) / (i - g) * Math.pow(1 + g, 1)), "OFF_BY_ONE_PERIOD", "Grew the first deposit as well."),
          distractor(F / (count * Math.pow(1 + (i + g) / 2, count - 1)), "SIMPLE_INTEREST_ERROR", "Approximated with the average of the two rates."),
        ],
        solutionSteps: `**Step 1 — Accumulation factor.** The $k$-th deposit is $X(${dec(1 + g, 3)})^{k-1}$ and earns interest for $${count} - k$ years:
$$\\sum_{k=1}^{${count}} (${dec(1 + g, 3)})^{k-1}(${dec(1 + i, 3)})^{${count}-k} = \\frac{(${dec(1 + i, 3)})^{${count}} - (${dec(1 + g, 3)})^{${count}}}{${dec(i, 3)} - ${dec(g, 3)}} = ${dec(factor, 5)}.$$

**Step 2 — Solve.** $X = ${mn(F)}/${dec(factor, 5)} = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "direct ledger",
            ok: close(Array.from({ length: count }, (_, k) => X * Math.pow(1 + g, k) * acc(i, count - 1 - k)).reduce((a, b) => a + b, 0), F),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_ACCUMULATE_THEN_PERPETUITY_RATE",
    domain: ANN,
    title: "Accumulated Deposits Buying a Perpetuity: Solve for the Rate",
    objective: "Equate accumulated deposits with the price of a perpetuity to solve for an unknown rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [217, 322],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const count = rng.choice([8, 10, 12, 15]);
        const P = rng.choice([count, 2 * count]);
        const accumulated = (i: number) => Array.from({ length: count }, (_, k) => (k + 1) * acc(i, count - 1 - k)).reduce((a, b) => a + b, 0);
        const i = solve((rate) => accumulated(rate) - P / rate, 0.001, 1);
        const price = P / i;
        return {
          questionText: `An investor makes deposits at the end of each year for ${count} years. The deposit in year one is 1, in year two is 2, and so on up to a final deposit of ${count} in year ${count}. The account earns an annual effective interest rate of $i$.
Immediately after the final deposit, the investor uses the whole balance to buy a perpetuity-immediate, also priced at rate $i$, that makes annual payments of ${P}.
Calculate the price of the perpetuity.`,
          variables: { variant: "INCREASING", count, P },
          correctValue: price,
          format: "AMOUNT_1",
          distractors: [
            distractor(P / trySolve((rate) => accumulated(rate) * (1 + rate) - P / rate, 0.001, 1), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the start of each year."),
            distractor((count * (count + 1)) / 2, "SIMPLE_INTEREST_ERROR", "Ignored interest on the deposits."),
            distractor(P / trySolve((rate) => accumulated(rate) - (P * (1 + rate)) / rate, 0.001, 1), "ANNUITY_DUE_CONFUSION", "Priced the perpetuity as payable in advance."),
          ],
          solutionSteps: `**Step 1 — Accumulated deposits.** $(Is)_{\\overline{${count}}|} = \\dfrac{\\ddot{s}_{\\overline{${count}}|} - ${count}}{i}$.

**Step 2 — Price of the perpetuity.** $${P}/i$. Setting them equal, $\\ddot{s}_{\\overline{${count}}|} = ${count} + ${P}$, which solves to $i = ${dec(i, 6)}$.

**Step 3 — Price.** $${P}/${dec(i, 6)} = ${dec(price, 3)}$.`,
          checks: [{ label: "balance buys the perpetuity", ok: close(accumulated(i), price) }],
        };
      }
      const count = rng.choice([30, 35, 40, 45]);
      const D = rng.choice([5, 7, 10, 20]);
      const mult = rng.choice([1.2, 1.25, 1.5]);
      const iTrue = gridRate(rng, 0.03, 0.06, 0.0025);
      const P = Number(((D * sn(count, iTrue)) * mult * iTrue).toFixed(2));
      const i = solve((rate) => D * sn(count, rate) - P / (mult * rate), 0.001, 0.5);
      const X = D * sn(count, i);
      return {
        questionText: `A deposit of ${n(D)} is made at the end of each year for ${count} years into an account earning an annual effective interest rate of $i$.
Immediately after the ${ord(count)} deposit, the balance $X$ is used to buy a perpetuity-immediate. At an annual effective interest rate of ${mult}$i$, the perpetuity makes annual payments of ${amt(P)}.
Calculate $X$.`,
        variables: { variant: "LEVEL", count, D, mult, P },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(D * sn(count, i) * (1 + i), "ANNUITY_DUE_CONFUSION", "Accumulated the deposits one year too long."),
          distractor(D * sn(count, trySolve((rate) => D * sn(count, rate) - P / rate, 0.001, 0.5)), "CALCULATION_DISTRACTOR", `Priced the perpetuity at $i$ instead of ${mult}$i$.`),
          distractor(D * count, "SIMPLE_INTEREST_ERROR", "Ignored interest."),
        ],
        solutionSteps: `**Step 1 — Two expressions for $X$.** $X = ${n(D)}\\,s_{\\overline{${count}}|i}$ and $X = \\dfrac{${amt(P)}}{${mult}i}$.

**Step 2 — Solve for $i$.** Equating them, $i = ${dec(i, 6)}$ (numerically).

**Step 3 — Evaluate.** $X = ${amt(P)}/(${mult} \\times ${dec(i, 6)}) = ${mn(X, 2)}$.`,
        checks: [{ label: "both expressions agree", ok: close(X, P / (mult * i)) }],
      };
    },
  },

  {
    id: "FM_ANN_ARITHMETIC_SOLVE_INCREMENT",
    domain: ANN,
    title: "Increasing Annuity: Solve for the Increment",
    objective: "Solve for the constant increment of an arithmetically increasing annuity from its price.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [244],
    generate: (rng: Rng) => {
      const [buyer] = cast(rng);
      const count = rng.choice([10, 15, 20, 25]);
      const first = gridAmount(rng, 50, 500, 10);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const XTrue = gridAmount(rng, 5, 50, 1);
      const price = Math.round((first * an(count, i) + XTrue * (Ia(count, i) - an(count, i))) / 10) * 10;
      const X = (price - first * an(count, i)) / (Ia(count, i) - an(count, i));
      return {
        questionText: `${buyer} buys a ${count}-year increasing annuity-immediate with annual payments. The first payment is ${n(first)}, and each later payment equals the previous payment plus $X$.
The annuity is priced at ${n(price)} at ${eff(i)}.
Calculate $X$.`,
        variables: { count, first, i, price },
        correctValue: X,
        format: "AMOUNT_2",
        distractors: [
          distractor((price - first * an(count, i)) / Ia(count, i), "OFF_BY_ONE_PERIOD", "Added the increment to the first payment as well."),
          distractor((price - first * an(count, i)) / (Ia(count, i) - an(count, i)) / (1 + i), "ANNUITY_DUE_CONFUSION", "Treated the payments as an annuity-due."),
          distractor((price - first * count) / ((count * (count - 1)) / 2), "SIMPLE_INTEREST_ERROR", "Ignored discounting."),
          distractor((price - first * an(count, i)) / (Ia(count - 1, i)), "CALCULATION_DISTRACTOR", "Valued the increments with an undeferred increasing annuity."),
        ],
        solutionSteps: `**Step 1 — Split the payments.** Payment $k$ is ${n(first)} $+ X(k - 1)$, so the price is ${n(first)}$a_{\\overline{${count}}|} + X\\left[(Ia)_{\\overline{${count}}|} - a_{\\overline{${count}}|}\\right]$.

**Step 2 — Solve.**
$$X = \\frac{${mn(price)} - ${n(first)}(${dec(an(count, i), 5)})}{${dec(Ia(count, i), 5)} - ${dec(an(count, i), 5)}} = ${mn(X, 4)}.$$`,
        checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: count }, (_, k) => first + X * k), i, 1), price) }],
      };
    },
  },

  {
    id: "FM_ANN_GEOMETRIC_ANNUITY",
    domain: ANN,
    title: "Geometrically Increasing Annuity",
    objective: "Value a geometrically increasing annuity, or find its final payment from its present value.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [245, 202],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const count = rng.choice([10, 15, 20, 25]);
      if (rng.next() < 0.5) {
        const first = gridAmount(rng, 100, 1000, 50);
        const g = gridRate(rng, 0.02, 0.15, 0.01);
        const PV = first * geo(count, i, g);
        return {
          questionText: `At ${eff(i)}, a ${count}-year annuity-immediate has a first annual payment of ${n(first)}. Each later payment is ${pc(g)} greater than the previous year's payment. Its present value is $X$.
Calculate $X$.`,
          variables: { variant: "PV", first, g, i, count },
          correctValue: PV,
          format: "AMOUNT_0",
          distractors: [
            distractor(first * geo(count, i, g) * (1 + i), "ANNUITY_DUE_CONFUSION", "Valued it as an annuity-due."),
            distractor(first * (1 + g) * geo(count, i, g), "OFF_BY_ONE_PERIOD", "Grew the first payment as well."),
            distractor(first * an(count, (i - g) / (1 + g)), "CALCULATION_DISTRACTOR", "Used $a_{\\overline{n}|j}$ with $j = (i - g)/(1 + g)$ without dividing by $1 + g$."),
            distractor(first * an(count, i), "CALCULATION_DISTRACTOR", "Ignored the growth."),
          ],
          solutionSteps: `**Step 1 — Growing annuity factor.**
$$\\frac{1 - \\left(\\frac{${dec(1 + g, 2)}}{${dec(1 + i, 3)}}\\right)^{${count}}}{${dec(i, 3)} - ${dec(g, 2)}} = ${dec(geo(count, i, g), 5)}.$$

**Step 2 — Scale.** $X = ${mn(first)}(${dec(geo(count, i, g), 5)}) = ${mn(PV, 2)}$.`,
          checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: count }, (_, k) => first * Math.pow(1 + g, k)), i, 1), PV) }],
        };
      }
      const g = gridRate(rng, 0.01, i - 0.005, 0.005);
      const PV = gridAmount(rng, 100000, 500000, 10000);
      const first = PV / geo(count, i, g);
      const last = first * Math.pow(1 + g, count - 1);
      return {
        questionText: `An insurer sells an annuity that makes ${count} annual payments, the first one year from today. Each later payment is ${pc(g)} greater than the previous one.
Using ${eff(i)}, the present value of the annuity is ${n(PV)}.
Calculate the amount of the final payment.`,
        variables: { variant: "LAST", g, i, count, PV },
        correctValue: last,
        format: "AMOUNT_0",
        distractors: [
          distractor(first, "CALCULATION_DISTRACTOR", "Reported the first payment."),
          distractor(first * Math.pow(1 + g, count), "OFF_BY_ONE_PERIOD", `Grew the first payment ${count} times instead of ${count - 1}.`),
          distractor((PV / an(count, i)) * Math.pow(1 + g, count - 1), "CALCULATION_DISTRACTOR", "Found the first payment from a level annuity."),
          distractor((PV / (geo(count, i, g) * (1 + i))) * Math.pow(1 + g, count - 1), "ANNUITY_DUE_CONFUSION", "Valued the annuity as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — First payment.** $P = ${mn(PV)}/${dec(geo(count, i, g), 5)} = ${mn(first, 2)}$.

**Step 2 — Final payment.** $P(${dec(1 + g, 3)})^{${count - 1}} = ${mn(last, 2)}$.`,
        checks: [{ label: "direct sum", ok: close(pvList(Array.from({ length: count }, (_, k) => first * Math.pow(1 + g, k)), i, 1), PV) }],
      };
    },
  },

  {
    id: "FM_ANN_TWO_PHASE_GEOMETRIC_PERPETUITY",
    domain: ANN,
    title: "Perpetuity with Two Phases of Geometric Growth",
    objective: "Value a perpetuity whose growth rate changes after a number of payments.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [236, 298, 313, 420],
    generate: (rng: Rng) => {
      const due = rng.next() < 0.5;
      const A = rng.choice([1, 350, 1000, 5000, 14000]);
      const K = rng.choice([5, 6, 10, 20, 30]);
      const i = gridRate(rng, 0.06, 0.12, 0.01);
      const g1 = gridRate(rng, 0.02, 0.05, 0.01);
      const g2 = rng.choice([0, 0.01, 0.02, Number((i - 0.04).toFixed(2))]);
      const PV = twoPhasePv(A, due, K, g1, g2, i);
      const later =
        g2 === 0
          ? `Starting with the ${ord(K + 1)} payment, each payment equals the ${ord(K)} payment.`
          : `The ${ord(K + 1)} payment and each later payment is ${pc(g2)} larger than the previous payment.`;
      return {
        questionText: `A perpetuity-${due ? "due" : "immediate"} with annual payments is priced at ${eff(i)}. The first payment is ${n(A)}.
Each payment from the second through the ${ord(K)} is ${pc(g1)} larger than the previous payment. ${later}
Calculate the price of the perpetuity.`,
        variables: { A, due: due ? 1 : 0, K, g1, g2, i },
        correctValue: PV,
        format: A === 1 ? "AMOUNT_2" : "AMOUNT_0",
        distractors: [
          distractor(twoPhasePv(A, due, K - 1, g1, g2, i), "OFF_BY_ONE_PERIOD", `Let the first growth rate run through the ${ord(K - 1)} payment only.`),
          distractor(twoPhasePv(A, due, K + 1, g1, g2, i), "OFF_BY_ONE_PERIOD", `Let the first growth rate run through the ${ord(K + 1)} payment.`),
          distractor(twoPhasePv(A, !due, K, g1, g2, i), "ANNUITY_DUE_CONFUSION", due ? "Valued the payments as made at the end of each year." : "Valued the payments as made at the start of each year."),
          distractor(A * (due ? 1 + i : 1) / (i - g2), "CALCULATION_DISTRACTOR", "Ignored the first growth phase."),
        ],
        solutionSteps: `**Step 1 — First phase.** Payments $${mn(A)}(${dec(1 + g1, 2)})^{k-1}$ for $k = 1, \\ldots, ${K}$, made at times ${due ? `$0, \\ldots, ${K - 1}$` : `$1, \\ldots, ${K}$`}:
$$${mn(A)}${due ? "(1+i)" : ""}\\cdot\\frac{1 - \\left(\\frac{${dec(1 + g1, 2)}}{${dec(1 + i, 2)}}\\right)^{${K}}}{${dec(i, 2)} - ${dec(g1, 2)}} = ${mn(pvList(Array.from({ length: K }, (_, k) => A * Math.pow(1 + g1, k)), i, due ? 0 : 1), 4)}.$$

**Step 2 — Second phase.** The ${ord(K)} payment is $${mn(A)}(${dec(1 + g1, 2)})^{${K - 1}} = ${mn(A * Math.pow(1 + g1, K - 1), 4)}$; later payments grow at ${pc(g2)}, forming a growing perpetuity valued at the time of the ${ord(K)} payment:
$$\\frac{${mn(A * Math.pow(1 + g1, K - 1), 4)}(${dec(1 + g2, 2)})}{${dec(i, 2)} - ${dec(g2, 2)}} = ${mn((A * Math.pow(1 + g1, K - 1) * (1 + g2)) / (i - g2), 4)}.$$

**Step 3 — Discount and add.** Discounting the second phase from time ${due ? K - 1 : K}: total $= ${mn(PV, 4)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(
              pvList(
                Array.from({ length: 4000 }, (_, k) =>
                  k < K ? A * Math.pow(1 + g1, k) : A * Math.pow(1 + g1, K - 1) * Math.pow(1 + g2, k - K + 1)
                ),
                i,
                due ? 0 : 1
              ),
              PV,
              1e-6
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_ARITHMETIC_PHASES_PERPETUITY",
    domain: ANN,
    title: "Perpetuity that Rises, Falls and Levels Off",
    objective: "Value a perpetuity built from arithmetic phases by combining level, increasing and decreasing pieces.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [276, 398],
    generate: (rng: Rng) => {
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const shape = rng.choice(["UP_DOWN", "LEVEL_DOWN"] as const);
      const payments: number[] = [];
      let description: string;
      let tail: number;
      if (shape === "UP_DOWN") {
        const peak = rng.int(6, 12);
        const floor = rng.int(2, peak - 3);
        for (let x = 1; x <= peak; x += 1) payments.push(x);
        for (let x = peak - 1; x >= floor; x -= 1) payments.push(x);
        tail = floor;
        description = `annual payments starting at 1 and increasing by 1 each year until the payment reaches ${peak}, then decreasing by 1 each year until the payment reaches ${floor}, and remaining at ${floor} thereafter`;
      } else {
        const L = rng.int(12, 25);
        const levelYears = rng.int(5, 12);
        const floor = rng.int(1, 3);
        for (let k = 0; k < levelYears; k += 1) payments.push(L);
        for (let x = L - 1; x >= floor; x -= 1) payments.push(x);
        tail = floor;
        description = `annual payments of ${L} for ${levelYears} years, then payments decreasing by 1 per year until the payment reaches ${floor}, and ${floor} per year thereafter`;
      }
      const finite = pvList(payments, i, 1);
      const PV = finite + (tail * v(i, payments.length)) / i;
      const flatPart = (tail * 1) / i;
      return {
        questionText: `A perpetuity-immediate makes ${description}.
At ${eff(i)}, the present value of the perpetuity is $X$.
Calculate $X$.`,
        variables: { shape, payments, tail, i },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(finite, "CALCULATION_DISTRACTOR", "Left out the level payments that continue forever."),
          distractor(finite + (tail * v(i, payments.length + 1)) / i, "OFF_BY_ONE_PERIOD", "Deferred the level tail one year too long."),
          distractor(PV * (1 + i), "ANNUITY_DUE_CONFUSION", "Valued the payments as made at the start of each year."),
          distractor(finite + flatPart, "OFF_BY_ONE_PERIOD", "Did not defer the level tail at all."),
        ],
        solutionSteps: `**Step 1 — Finite part.** The first ${payments.length} payments (${payments.slice(0, 6).join(", ")}, ...) are worth ${n(finite, 4)} at ${pc(i)}.

**Step 2 — Level tail.** From year ${payments.length + 1} the payment stays at ${tail}: a perpetuity-immediate deferred ${payments.length} years,
$$\\frac{${tail}\\,v^{${payments.length}}}{${dec(i, 2)}} = ${mn((tail * v(i, payments.length)) / i, 4)}.$$

**Step 3 — Total.** $X = ${mn(finite, 4)} + ${mn((tail * v(i, payments.length)) / i, 4)} = ${mn(PV, 4)}$.`,
        checks: [{ label: "tail positive", ok: tail > 0 }],
      };
    },
  },

  {
    id: "FM_ANN_LEVEL_THEN_ARITHMETIC_PERPETUITY_K",
    domain: ANN,
    title: "Level Payments followed by Arithmetic Increases: Solve for the Level Payment",
    objective: "Value a perpetuity with level payments followed by arithmetic increases and solve for the level payment.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [316],
    generate: (rng: Rng) => {
      const N = rng.choice([5, 8, 10, 12]);
      const Q = gridAmount(rng, 50, 300, 50);
      const i = gridRate(rng, 0.04, 0.07, 0.001);
      const kTrue = gridAmount(rng, 50, 500, 1);
      const PV = Math.round((kTrue / i + (Q * v(i, N) * (1 + i)) / (i * i)) / 1000) * 1000;
      const k = (PV - (Q * v(i, N) * (1 + i)) / (i * i)) * i;
      return {
        questionText: `A perpetuity-immediate with annual payments consists of ${word(N)} level payments of $k$, followed by increasing payments. Beginning with the ${ord(N + 1)} payment, each payment is ${n(Q)} larger than the payment before it.
Using ${eff(i)}, the present value of the perpetuity is ${n(PV)}.
Calculate $k$.`,
        variables: { N, Q, i, PV },
        correctValue: k,
        format: "AMOUNT_0",
        distractors: [
          distractor((PV - (Q * v(i, N)) / (i * i)) * i, "OFF_BY_ONE_PERIOD", `Started the increases one payment later, with the ${ord(N + 2)} payment.`),
          distractor((PV - (Q * v(i, N) * (1 + i) * (1 + i)) / (i * i)) * i, "OFF_BY_ONE_PERIOD", "Started the increases one payment earlier."),
          distractor(PV * i, "CALCULATION_DISTRACTOR", "Ignored the increases."),
          distractor((PV - (Q * (1 + i)) / (i * i)) * i, "CALCULATION_DISTRACTOR", "Did not defer the increases."),
        ],
        solutionSteps: `**Step 1 — Decompose.** Every payment includes $k$; from the ${ord(N + 1)} payment on, increments of ${n(Q)}, ${n(2 * Q)}, ... are added.

**Step 2 — Value the increments.** They form an increasing perpetuity-immediate starting at time ${N + 1}, deferred ${N} years:
$$${mn(Q)}\\,v^{${N}}\\,(Ia)_{\\overline{\\infty}|} = ${mn(Q)}\\,v^{${N}}\\,\\frac{1+i}{i^2} = ${mn((Q * v(i, N) * (1 + i)) / (i * i), 2)}.$$

**Step 3 — Solve for $k$.** $\\dfrac{k}{${dec(i, 3)}} = ${mn(PV)} - ${mn((Q * v(i, N) * (1 + i)) / (i * i), 2)}$, so $k = ${mn(k, 2)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: 8000 }, (_, t) => k + Q * Math.max(0, t + 1 - N)), i, 1), PV, 1e-6),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_MONTHLY_ANNUAL_STEP_PERPETUITY",
    domain: ANN,
    title: "Monthly Perpetuity Stepping Up Once a Year",
    objective: "Value a monthly perpetuity whose payments increase geometrically every twelve payments.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [360],
    generate: (rng: Rng) => {
      const M = gridAmount(rng, 200, 2000, 100);
      const i = gridRate(rng, 0.06, 0.1, 0.005);
      const g = gridRate(rng, 0.01, i - 0.015, 0.005);
      const r = Math.pow(1 + i, 1 / 12) - 1;
      const year = M * an(12, r);
      const PV = (year * (1 + i)) / (i - g);
      return {
        questionText: `A perpetuity-immediate has monthly payments that increase by ${pc(g)} every 12 payments. The first 12 payments are each ${n(M)}.
Using ${eff(i)}, the present value of the perpetuity is $X$.
Calculate $X$.`,
        variables: { M, i, g },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor((12 * M) / (i - g), "CALCULATION_DISTRACTOR", "Treated each year's payments as one payment at the end of the year."),
          distractor((M * an(12, i / 12) * (1 + i)) / (i - g), "NOMINAL_RATE_ERROR", `Used ${pc(i)}/12 as the monthly rate.`),
          distractor(year / (i - g), "OFF_BY_ONE_PERIOD", "Discounted every year's block one year too far."),
          distractor(M / r, "CALCULATION_DISTRACTOR", "Ignored the annual increases."),
        ],
        solutionSteps: `**Step 1 — One year of payments.** At $r = (${dec(1 + i, 3)})^{1/12} - 1 = ${dec(r, 6)}$, twelve payments of ${n(M)} are worth $${mn(M)}\\,a_{\\overline{12}|r} = ${mn(year, 2)}$ at the start of their year.

**Step 2 — Link the years.** Year $k$'s block is ${pc(g)} larger and a year later: a growing perpetuity-due of blocks,
$$${mn(year, 2)}\\sum_{k\\ge0}\\left(\\frac{${dec(1 + g, 3)}}{${dec(1 + i, 3)}}\\right)^k = ${mn(year, 2)}\\cdot\\frac{${dec(1 + i, 3)}}{${dec(i, 3)} - ${dec(g, 3)}}.$$

**Step 3 — Evaluate.** $X = ${mn(PV, 2)}$.`,
        checks: [
          {
            label: "direct monthly sum",
            ok: close(pvList(Array.from({ length: 12 * 900 }, (_, k) => M * Math.pow(1 + g, Math.floor(k / 12))), r, 1), PV, 1e-5),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_ANNUAL_STEP_MONTHLY_DEPOSITS",
    domain: ANN,
    title: "Monthly Deposits Increasing Each Year",
    objective: "Accumulate monthly deposits that are level within a year and grow from year to year, then solve for a later year's deposit.",
    difficulty: 4,
    topics: ["TIME_VALUE"],
    steps: 4,
    soaSamples: [443],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const g = rng.choice([0.05, 0.08, 0.1]);
      const j = gridRate(rng, 0.024, 0.06, 0.012);
      const years = rng.choice([8, 10, 12]);
      const askYear = rng.int(3, years - 2);
      const r = j / 12;
      const yearly = Math.pow(1 + r, 12) - 1;
      const blockAtEnd = sn(12, r) * (1 + r);
      const accFactor = blockAtEnd * ((acc(yearly, years) - Math.pow(1 + g, years)) / (yearly - g));
      const firstTrue = gridAmount(rng, 50, 300, 1);
      const AV = Number((firstTrue * accFactor).toFixed(2));
      const first = AV / accFactor;
      const K = first * Math.pow(1 + g, askYear - 1);
      return {
        questionText: `${saver} opens a savings account and makes a deposit at the beginning of each month, starting today. You are given:
i) within each year, the monthly deposits are all equal;
ii) each year's monthly deposit is ${pc(g)} greater than the previous year's;
iii) the account earns ${nom(j, 12)};
iv) the account holds ${n(AV, 2)} at the end of year ${years};
v) the monthly deposit in year ${askYear} is $K$.
Calculate $K$.`,
        variables: { g, j, years, askYear, AV },
        correctValue: K,
        format: "AMOUNT_2",
        distractors: [
          distractor(first, "CALCULATION_DISTRACTOR", "Reported the first year's deposit."),
          distractor(first * Math.pow(1 + g, askYear), "OFF_BY_ONE_PERIOD", `Grew the deposit ${askYear} times instead of ${askYear - 1}.`),
          distractor((AV / (sn(12, r) * ((acc(yearly, years) - Math.pow(1 + g, years)) / (yearly - g)))) * Math.pow(1 + g, askYear - 1), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each month."),
          distractor((AV / (12 * ((acc(j, years) - Math.pow(1 + g, years)) / (j - g)))) * Math.pow(1 + g, askYear - 1), "NOMINAL_RATE_ERROR", "Treated each year's deposits as one deposit at the end of the year at the nominal rate."),
        ],
        solutionSteps: `**Step 1 — One year of deposits.** At $r = ${dec(r, 4)}$ per month, twelve deposits of 1 made at the start of each month are worth $\\ddot{s}_{\\overline{12}|r} = ${dec(blockAtEnd, 6)}$ at the end of the year.

**Step 2 — Annual growth and interest.** The effective annual rate is $(1+r)^{12} - 1 = ${dec(yearly, 6)}$, and each year's block is ${pc(g)} larger.

**Step 3 — Accumulate the blocks.** With $X$ the first year's deposit,
$$${mn(AV, 2)} = X(${dec(blockAtEnd, 6)})\\cdot\\frac{(${dec(1 + yearly, 6)})^{${years}} - (${dec(1 + g, 2)})^{${years}}}{${dec(yearly, 6)} - ${dec(g, 2)}} \\implies X = ${mn(first, 4)}.$$

**Step 4 — Year ${askYear}.** $K = X(${dec(1 + g, 2)})^{${askYear - 1}} = ${mn(K, 4)}$.`,
        checks: [
          {
            label: "direct monthly ledger",
            ok: close(
              Array.from({ length: 12 * years }, (_, m) => first * Math.pow(1 + g, Math.floor(m / 12)) * acc(r, 12 * years - m)).reduce((a, b) => a + b, 0),
              AV,
              1e-7
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_PAIRED_ARITHMETIC_DUE",
    domain: ANN,
    title: "Arithmetic Annuity-Due Increasing Every Second Payment",
    objective: "Value a monthly annuity-due whose payments step up every second payment.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [446],
    generate: (rng: Rng) => {
      const first = gridAmount(rng, 50, 500, 50);
      const step = rng.choice([5, 10, 20]);
      const pairs = rng.choice([30, 36, 42, 48]);
      const count = 2 * pairs;
      const j = gridRate(rng, 0.024, 0.072, 0.012);
      const r = j / 12;
      const payments = Array.from({ length: count }, (_, k) => first + step * Math.floor(k / 2));
      const PV = pvList(payments, r, 0);
      const last = payments[count - 1];
      return {
        questionText: `A special arithmetically increasing annuity-due makes ${count} monthly payments. It pays ${n(first)} today, ${n(first)} one month from now, ${n(first + step)} two months from now, ${n(first + step)} three months from now, and so on, until the final two payments of ${n(last)} each.
Using ${nom(j, 12)}, the present value of the annuity is $P$.
Calculate $P$.`,
        variables: { first, step, count, j },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(pvList(payments, r, 1), "ANNUITY_DUE_CONFUSION", "Valued the payments as made at the end of each month."),
          distractor(pvList(Array.from({ length: count }, (_, k) => first + (step / 2) * k), r, 0), "CALCULATION_DISTRACTOR", "Spread the increases evenly over every payment."),
          distractor(pvList(Array.from({ length: count }, (_, k) => first + step * Math.ceil(k / 2)), r, 0), "OFF_BY_ONE_PERIOD", "Increased the second payment instead of the third."),
          distractor(((first + last) / 2) * adue(count, r), "CALCULATION_DISTRACTOR", "Replaced the payments by their average."),
        ],
        solutionSteps: `**Step 1 — Group the payments in pairs.** Pair $k$ ($k = 0, \\ldots, ${pairs - 1}$) pays ${n(first)} $+ ${step}k$ at months $2k$ and $2k + 1$; a pair of 1s is worth $1 + v$ at its first date.

**Step 2 — Two-month increasing annuity-due.** With $w = v^2$ the two-month discount factor,
$$P = (1 + v)\\sum_{k=0}^{${pairs - 1}} (${first} + ${step}k)\\,w^k.$$

**Step 3 — Evaluate** at $v = 1/${dec(1 + r, 4)}$: $P = ${mn(PV, 2)}$.`,
        checks: [
          {
            label: "pair decomposition",
            ok: close(
              (1 + v(r, 1)) * Array.from({ length: pairs }, (_, k) => (first + step * k) * v(r, 2 * k)).reduce((a, b) => a + b, 0),
              PV
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_DEFERRED_GEOMETRIC_MONTHLY",
    domain: ANN,
    title: "Deferred Monthly Geometric Annuity",
    objective: "Count the payments of a deferred monthly geometric annuity and value it.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [386],
    generate: (rng: Rng) => {
      const P = gridAmount(rng, 250, 1000, 50);
      const defer = rng.choice([3, 5, 8]);
      const g = rng.choice([0.0025, 0.005, 0.01]);
      const span = rng.choice([10, 15]);
      const j = gridRate(rng, 0.048, 0.096, 0.012);
      const r = j / 12;
      const count = 12 * span + 1;
      const PV = P * v(r, 12 * defer) * geo(count, r, g) * (1 + r);
      return {
        questionText: `An annuity's first monthly payment of ${n(P)} is made in ${defer} years. Each payment after that is ${pc(g, 2)} greater than the preceding payment. The final payment is made exactly ${span} years after the first payment.
The present value of the annuity is $P$, using ${nom(j, 12)}.
Calculate $P$.`,
        variables: { P, defer, g, span, j },
        correctValue: PV,
        format: "AMOUNT_0",
        distractors: [
          distractor(P * v(r, 12 * defer) * geo(count - 1, r, g) * (1 + r), "OFF_BY_ONE_PERIOD", `Counted ${count - 1} payments instead of ${count}.`),
          distractor(P * v(r, 12 * defer) * geo(count, r, g), "OFF_BY_ONE_PERIOD", "Discounted the first payment one month too far."),
          distractor(P * v(r, 12 * defer) * adue(count, r), "CALCULATION_DISTRACTOR", "Ignored the growth."),
          distractor(P * v(Math.pow(1 + j, 1 / 12) - 1, 12 * defer) * geo(count, Math.pow(1 + j, 1 / 12) - 1, g) * Math.pow(1 + j, 1 / 12), "NOMINAL_RATE_ERROR", `Treated ${pc(j)} as an annual effective rate.`),
        ],
        solutionSteps: `**Step 1 — Count the payments.** Payments run monthly from month ${12 * defer} to month ${12 * (defer + span)}, which is ${count} payments.

**Step 2 — Value at the first payment.** At $r = ${dec(r, 4)}$, a growing annuity-due of ${count} payments:
$$${mn(P)}\\cdot\\frac{1 - \\left(\\frac{1 + ${dec(g, 4)}}{1 + ${dec(r, 4)}}\\right)^{${count}}}{1 - \\frac{1 + ${dec(g, 4)}}{1 + ${dec(r, 4)}}} = ${mn(P * geo(count, r, g) * (1 + r), 2)}.$$

**Step 3 — Discount to today.** $v^{${12 * defer}} = ${dec(v(r, 12 * defer), 6)}$, so $P = ${mn(PV, 2)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: count }, (_, k) => P * Math.pow(1 + g, k)), r, 12 * defer), PV),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_LUMP_SUMS_TO_INCREASING_PERPETUITY",
    domain: ANN,
    title: "Converting Lump Sums to an Increasing Perpetuity-Due",
    objective: "Equate lump sums with an arithmetically increasing perpetuity-due and solve for its first payment.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [355],
    generate: (rng: Rng) => {
      const A = rng.choice([500000, 1000000, 2000000]);
      const t2 = rng.choice([3, 5, 10]);
      const Q = rng.choice([500, 1000, 2000]);
      const i = gridRate(rng, 0.03, 0.07, 0.005);
      const pvLumps = A + A * v(i, t2);
      const X = (pvLumps - (Q * (1 + i)) / (i * i)) * (i / (1 + i));
      return {
        questionText: `An individual is to receive ${n(A)} today and ${n(A)} ${word(t2)} years from today. These payments are converted to an increasing annual perpetuity, with the first payment $X$ made today and each later payment ${n(Q)} more than the previous one.
At ${eff(i)}, the present value of the two payments equals the present value of the perpetuity.
Calculate $X$.`,
        variables: { A, t2, Q, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((pvLumps - Q / (i * i)) * i, "ANNUITY_DUE_CONFUSION", "Valued the perpetuity as payable in arrears."),
          distractor((pvLumps - (Q * (1 + i)) / i) * (i / (1 + i)), "CALCULATION_DISTRACTOR", "Valued the increases as $Q/d$ instead of $Q(1+i)/i^2$."),
          distractor(2 * A * (i / (1 + i)) - Q / i, "CALCULATION_DISTRACTOR", `Did not discount the payment due in ${t2} years.`),
          distractor(pvLumps * (i / (1 + i)), "CALCULATION_DISTRACTOR", "Ignored the increases."),
        ],
        solutionSteps: `**Step 1 — Value of the lump sums.** $${mn(A)} + ${mn(A)}v^{${t2}} = ${mn(pvLumps, 2)}$.

**Step 2 — Increasing perpetuity-due.** Payments $X + ${n(Q)}k$ at times $k = 0, 1, 2, \\ldots$ are worth
$$\\frac{X(1+i)}{i} + \\frac{${mn(Q)}(1+i)}{i^2}.$$
Setting this equal to ${n(pvLumps, 2)}: $X = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "direct sum",
            ok: close(pvList(Array.from({ length: 8000 }, (_, k) => X + Q * k), i, 0), pvLumps, 1e-6),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_EVERY_K_YEARS_ARITHMETIC_PERPETUITY",
    domain: ANN,
    title: "Increasing Perpetuity Paid Every k Years",
    objective: "Value an arithmetically increasing perpetuity paid once every k years using the k-year effective rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [359, 238],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const k = rng.choice([2, 3, 4, 5]);
      const i = gridRate(rng, 0.04, 0.1, 0.01);
      const J = acc(i, k) - 1;
      if (rng.next() < 0.5) {
        const XTrue = gridAmount(rng, 5, 50, 1);
        const PV = Number((XTrue * (1 + J) / (J * J)).toFixed(2));
        const X = (PV * J * J) / (1 + J);
        return {
          questionText: `A perpetuity pays $X$ at the end of year ${k}, $2X$ at the end of year ${2 * k}, $3X$ at the end of year ${3 * k}, and so on.
At ${eff(i)}, the present value of the perpetuity is ${n(PV, 2)}.
Calculate $X$.`,
          variables: { variant: "X", k, i, PV },
          correctValue: X,
          format: "AMOUNT_2",
          distractors: [
            distractor(PV * i * i / (1 + i), "CALCULATION_DISTRACTOR", `Used the annual rate instead of the ${k}-year rate.`),
            distractor(PV * J * J, "ANNUITY_DUE_CONFUSION", "Valued the perpetuity as if the first payment were made one period earlier."),
            distractor(PV * (k * i) * (k * i) / (1 + k * i), "SIMPLE_INTEREST_ERROR", `Used $${k}i$ as the ${k}-year rate.`),
            distractor(PV * J, "CALCULATION_DISTRACTOR", "Treated the payments as level."),
          ],
          solutionSteps: `**Step 1 — Rate per ${k}-year period.** $J = (${dec(1 + i, 2)})^{${k}} - 1 = ${dec(J, 6)}$.

**Step 2 — Increasing perpetuity-immediate.** $X\\,(Ia)_{\\overline{\\infty}|J} = X\\cdot\\dfrac{1 + J}{J^2} = ${mn(PV, 2)}$, so $X = ${mn(X, 4)}$.`,
          checks: [{ label: "direct sum", ok: close(Array.from({ length: 3000 }, (_, m) => X * (m + 1) * v(i, k * (m + 1))).reduce((a, b) => a + b, 0), PV, 1e-6) }],
        };
      }
      const first = gridAmount(rng, 2, 20, 1);
      const inc = gridAmount(rng, 5, 20, 5);
      const PV = first / J + inc / (J * J);
      return {
        questionText: `A perpetuity makes a payment every ${k} years, with the first payment of ${n(first)} made ${k} years from now. Each later payment is ${n(inc)} more than the previous payment.
Using ${eff(i)}, calculate the present value of the perpetuity.`,
        variables: { variant: "PV", k, i, first, inc },
        correctValue: PV,
        format: "AMOUNT_2",
        distractors: [
          distractor(first / i + inc / (i * i), "CALCULATION_DISTRACTOR", `Used the annual rate instead of the ${k}-year rate.`),
          distractor(first / J + (inc * (1 + J)) / (J * J), "OFF_BY_ONE_PERIOD", "Added the first increment to the first payment."),
          distractor(first / J + inc / J, "CALCULATION_DISTRACTOR", "Valued the increases as $Q/J$ instead of $Q/J^2$."),
          distractor((first / J + inc / (J * J)) * (1 + J), "ANNUITY_DUE_CONFUSION", "Valued the perpetuity as a perpetuity-due."),
        ],
        solutionSteps: `**Step 1 — Rate per ${k}-year period.** $J = (${dec(1 + i, 2)})^{${k}} - 1 = ${dec(J, 6)}$.

**Step 2 — Increasing perpetuity.** Payments ${n(first)}, ${n(first + inc)}, ${n(first + 2 * inc)}, ... at the end of each period are worth
$$\\frac{${n(first)}}{J} + \\frac{${n(inc)}}{J^2} = ${mn(PV, 4)}.$$`,
        checks: [{ label: "direct sum", ok: close(Array.from({ length: 3000 }, (_, m) => (first + inc * m) * v(i, k * (m + 1))).reduce((a, b) => a + b, 0), PV, 1e-6) }],
      };
    },
  },

  {
    id: "FM_ANN_LOTTERY_PERPETUITY_LATER_VALUE",
    domain: ANN,
    title: "Later Value of an Increasing Perpetuity-Due",
    objective: "Recover the first payment of an increasing perpetuity-due from its value, then revalue the remaining payments at a later date.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [436],
    generate: (rng: Rng) => {
      const [winner] = cast(rng);
      const PV = rng.choice([500000, 1000000, 2000000]);
      const Q = rng.choice([500, 1000, 2000]);
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const years = rng.choice([10, 15, 20]);
      const startYear = rng.int(1995, 2005);
      const P = (PV / (1 + i) - Q / (i * i)) * i;
      const nextPayment = P + (years + 1) * Q;
      const later = nextPayment / i + Q / (i * i);
      return {
        questionText: `${winner} receives lottery winnings as a perpetuity. Payments are annual and began on January 1, ${startYear}. Each payment after the first is ${n(Q)} larger than the previous one.
The present value of the winnings on January 1, ${startYear}, immediately before the first payment, was ${n(PV)} at ${eff(i)}.
Calculate the present value of the winnings on January 1, ${startYear + years}, immediately after the payment made that day, at the same rate.`,
        variables: { PV, Q, i, years },
        correctValue: later,
        format: "AMOUNT_0",
        distractors: [
          distractor((P + years * Q) / i + Q / (i * i), "OFF_BY_ONE_PERIOD", `Started the remaining payments at the ${ord(years + 1)} payment's amount.`),
          distractor(later + P + years * Q, "ANNUITY_DUE_CONFUSION", "Included the payment just made."),
          distractor((P + (years + 1) * Q) / i, "CALCULATION_DISTRACTOR", "Ignored the continuing increases."),
          distractor(PV * acc(i, years), "CALCULATION_DISTRACTOR", "Accumulated the original value without removing the payments already made."),
        ],
        solutionSteps: `**Step 1 — First payment.** A perpetuity-due of $P, P + Q, P + 2Q, \\ldots$ is worth $(1+i)\\left(\\dfrac{P}{i} + \\dfrac{Q}{i^2}\\right)$:
$$\\frac{P}{${dec(i, 2)}} + \\frac{${mn(Q)}}{${dec(i, 2)}^2} = \\frac{${mn(PV)}}{${dec(1 + i, 2)}} \\implies P = ${mn(P, 2)}.$$

**Step 2 — The next payment after January 1, ${startYear + years}.** It is the payment numbered ${years + 2}, of $P + ${years + 1}(${mn(Q)}) = ${mn(nextPayment, 2)}$.

**Step 3 — Value the remaining perpetuity-immediate.** $\\dfrac{${mn(nextPayment, 2)}}{${dec(i, 2)}} + \\dfrac{${mn(Q)}}{${dec(i, 2)}^2} = ${mn(later, 2)}$.`,
        checks: [
          {
            label: "retrospective check",
            ok: close(PV * acc(i, years) - Array.from({ length: years + 1 }, (_, k) => (P + k * Q) * acc(i, years - k)).reduce((a, b) => a + b, 0), later, 1e-7),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_QUARTERLY_LEVEL_THEN_GROWING_AV",
    domain: ANN,
    title: "Quarterly Deposits: Level, then Growing",
    objective: "Accumulate quarterly deposits that are level for a period and then grow geometrically.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [451],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const D = gridAmount(rng, 500, 2000, 100);
      const levelYears = rng.choice([3, 5, 8]);
      const total = levelYears + rng.choice([10, 15]);
      const g = rng.choice([0.01, 0.015, 0.02]);
      const j = gridRate(rng, 0.04, 0.08, 0.01);
      const q = j / 4;
      const levelCount = 4 * levelYears;
      const growCount = 4 * (total - levelYears);
      const deposits = [
        ...Array.from({ length: levelCount }, () => D),
        ...Array.from({ length: growCount }, (_, k) => D * Math.pow(1 + g, k + 1)),
      ];
      const AV = deposits.reduce((sum, amount, k) => sum + amount * acc(q, 4 * total - k), 0);
      return {
        questionText: `${saver} deposits ${n(D)} into a fund at the beginning of each quarter for ${levelYears} years, with the first deposit at $t = 0$, where $t$ is in years.
Starting at $t = ${levelYears}$, each quarterly deposit is ${pc(g, 1)} greater than the preceding deposit. The last deposit is made at $t = ${total - 0.25}$.
Calculate the accumulated value of the deposits at $t = ${total}$, based on ${nom(j, 4)}.`,
        variables: { D, levelYears, total, lastDeposit: total - 0.25, g, j },
        correctValue: AV,
        format: "AMOUNT_0",
        distractors: [
          distractor(deposits.reduce((sum, amount, k) => sum + amount * acc(q, 4 * total - k - 1), 0), "ANNUITY_DUE_CONFUSION", "Treated the deposits as made at the end of each quarter."),
          distractor([...Array.from({ length: levelCount }, () => D), ...Array.from({ length: growCount }, (_, k) => D * Math.pow(1 + g, k))].reduce((sum, amount, k) => sum + amount * acc(q, 4 * total - k), 0), "OFF_BY_ONE_PERIOD", `Took the deposit at $t = ${levelYears}$ to equal the level deposits.`),
          distractor(D * sn(4 * total, q) * (1 + q), "CALCULATION_DISTRACTOR", "Ignored the growth."),
          distractor(deposits.reduce((sum, amount, k) => sum + amount * acc(Math.pow(1 + j, 0.25) - 1, 4 * total - k), 0), "NOMINAL_RATE_ERROR", `Treated ${pc(j)} as an annual effective rate.`),
        ],
        solutionSteps: `**Step 1 — Level deposits.** At $${dec(q, 4)}$ per quarter, ${levelCount} deposits of ${n(D)} made at the start of each quarter are worth $${mn(D)}\\,\\ddot{s}_{\\overline{${levelCount}}|}(${dec(1 + q, 4)})^{${growCount}}$ at $t = ${total}$.

**Step 2 — Growing deposits.** The deposits from $t = ${levelYears}$ are ${n(D)}$(${dec(1 + g, 3)})^k$, $k = 1, \\ldots, ${growCount}$, a growing annuity-due.

**Step 3 — Add.** In total the fund holds ${n(AV, 2)} at $t = ${total}$.`,
        checks: [{ label: "growing part exceeds the level equivalent", ok: AV > D * sn(4 * total, q) * (1 + q) }],
      };
    },
  },

  {
    id: "FM_ANN_GROWING_ANNUITIES_EQUAL_VALUE",
    domain: ANN,
    title: "Equal Present Values of Two Geometric Annuities",
    objective: "Equate a geometric annuity-immediate and a geometric annuity-due with different growth rates and terms.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [348],
    generate: (rng: Rng) => {
      const A = gridAmount(rng, 1000, 5000, 500);
      const nA = rng.choice([15, 20, 25]);
      const nB = nA + rng.choice([5, 10]);
      const i = gridRate(rng, 0.03, 0.06, 0.01);
      const gA = gridRate(rng, 0.02, 0.06, 0.01);
      const gB = rng.choice([i, Number((i - 0.01).toFixed(2))]);
      const pvA = A * geo(nA, i, gA);
      const unitB = geo(nB, i, gB) * (1 + i);
      const k = pvA / unitB;
      return {
        questionText: `You are given the following two annuities with annual payments:
i) Annuity X is a ${nA}-payment annuity-immediate with a first payment of ${n(A)}; each later payment is ${pc(gA)} larger than the one before.
ii) Annuity Y is a ${nB}-payment annuity-due with a first payment of $k$; each later payment is ${pc(gB)} larger than the one before.
At ${eff(i)}, the two annuities have the same present value.
Calculate $k$.`,
        variables: { A, nA, nB, i, gA, gB },
        correctValue: k,
        format: "AMOUNT_0",
        distractors: [
          distractor(pvA / geo(nB, i, gB), "ANNUITY_DUE_CONFUSION", "Valued Annuity Y as an annuity-immediate."),
          distractor((A * geo(nA, i, gA) * (1 + i)) / unitB, "ANNUITY_DUE_CONFUSION", "Valued Annuity X as an annuity-due."),
          distractor(pvA / (nB / (1 + i)), "ANNUITY_DUE_CONFUSION", "Used the annuity-immediate shortcut $n/(1+i)$ for Y's factor."),
          distractor((A * an(nA, i)) / adue(nB, i), "CALCULATION_DISTRACTOR", "Ignored both growth rates."),
        ],
        solutionSteps: `**Step 1 — Annuity X.**
$$${mn(A)}\\cdot\\frac{1 - \\left(\\frac{${dec(1 + gA, 2)}}{${dec(1 + i, 2)}}\\right)^{${nA}}}{${dec(i, 2)} - ${dec(gA, 2)}} = ${mn(pvA, 2)}.$$

**Step 2 — Annuity Y and solve.** ${Math.abs(gB - i) < 1e-12 ? `With growth equal to the interest rate, every payment of the annuity-due is worth $k$ today, so its value is ${nB}$k$.` : `Its factor is $(1+i)\\,\\dfrac{1 - \\left(\\frac{${dec(1 + gB, 2)}}{${dec(1 + i, 2)}}\\right)^{${nB}}}{${dec(i, 2)} - ${dec(gB, 2)}} = ${dec(unitB, 5)}$.`}
So $k = ${mn(pvA, 2)}/${dec(unitB, 5)} = ${mn(k, 2)}$.`,
        checks: [
          {
            label: "direct sums agree",
            ok: close(pvList(Array.from({ length: nB }, (_, t) => k * Math.pow(1 + gB, t)), i, 0), pvList(Array.from({ length: nA }, (_, t) => A * Math.pow(1 + gA, t)), i, 1)),
          },
        ],
      };
    },
  },

  {
    id: "FM_ANN_DECLINING_PAYMENTS_REINVESTED",
    domain: ANN,
    title: "Declining Annuity Payments Reinvested",
    objective: "Accumulate geometrically declining payments at a reinvestment rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [302],
    generate: (rng: Rng) => {
      const [holder] = cast(rng);
      const A = gridAmount(rng, 100, 1000, 50);
      const count = rng.choice([10, 15, 20]);
      const ratio = rng.choice([0.85, 0.9, 0.95]);
      const j = gridRate(rng, 0.02, 0.06, 0.005);
      const AV = Array.from({ length: count }, (_, k) => A * Math.pow(ratio, k) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0);
      return {
        questionText: `${holder} receives annual payments from a ${count}-year annuity-immediate. The payment in year 1 is ${n(A)}, and each later payment is ${Math.round(ratio * 100)}% of the previous year's payment.
Upon receipt, ${holder} deposits each payment into a savings account earning ${eff(j)}.
Calculate the balance in the savings account immediately after the last annuity payment is deposited.`,
        variables: { A, count, ratio, j },
        correctValue: AV,
        format: "AMOUNT_0",
        distractors: [
          distractor(A * sn(count, j), "CALCULATION_DISTRACTOR", "Ignored the decline in the payments."),
          distractor(AV * (1 + j), "ANNUITY_DUE_CONFUSION", "Accumulated each payment one year too long."),
          distractor((A * (1 - Math.pow(ratio, count))) / (1 - ratio), "SIMPLE_INTEREST_ERROR", "Ignored the interest earned in the savings account."),
          distractor(Array.from({ length: count }, (_, k) => A * Math.pow(ratio, k + 1) * acc(j, count - 1 - k)).reduce((a, b) => a + b, 0), "OFF_BY_ONE_PERIOD", "Reduced the first payment as well."),
        ],
        solutionSteps: `**Step 1 — Write the accumulated value.** Payment $k$ is ${n(A)}$(${ratio})^{k-1}$ and earns interest for $${count} - k$ years:
$$\\sum_{k=1}^{${count}} ${mn(A)}(${ratio})^{k-1}(${dec(1 + j, 3)})^{${count}-k} = ${mn(A)}\\cdot\\frac{(${dec(1 + j, 3)})^{${count}} - (${ratio})^{${count}}}{${dec(1 + j, 3)} - ${ratio}}.$$

**Step 2 — Evaluate.** The balance is ${n(AV, 2)}.`,
        checks: [
          {
            label: "closed form",
            ok: close((A * (acc(j, count) - Math.pow(ratio, count))) / (1 + j - ratio), AV),
          },
        ],
      };
    },
  },
];

/** `9.2` for a rate of 0.092 — the figure a question quotes when it says "K < 9.2". */
function rateFigureOf(rate: number): string {
  return (rate * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
