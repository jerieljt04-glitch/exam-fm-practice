/**
 * Qualitative annuity items: choosing the equation of value or the annuity
 * expression that fits a described payment pattern, as the sample set asks in
 * its "Determine which of the following ..." questions.
 *
 * Every choice carries a numerical evaluation, and the self-check requires
 * exactly one choice to reproduce the true value — so an expression that
 * happens to be algebraically equivalent to the key can never slip in as a
 * second correct answer.
 */
import type { Rng } from "../../random";
import type { AuthoredChoice, GeneratedChoiceQuestionItem, QuestionTemplateDefinition } from "../types";
import { Ia, acc, adue, an, close, dec, gridRate, mn, mpc, n, ord, pc, sn, v } from "./kit";

const ANN = "ANNUITIES" as const;

interface Candidate {
  latex: string;
  value: number;
  why: string;
}

/** Five choices from a key and wrong candidates, keeping only wrong ones that differ in value. */
function formulaChoices(rng: Rng, truth: number, key: Candidate, wrong: Candidate[]): {
  choices: AuthoredChoice[];
  matching: number;
} {
  const distinct = wrong.filter((item) => !close(item.value, truth, 1e-7));
  const picked = rng.shuffle(distinct).slice(0, 4);
  const choices: AuthoredChoice[] = [
    { text: `$${key.latex}$`, isCorrect: true, explanation: key.why },
    ...picked.map((item) => ({
      text: `$${item.latex}$`,
      isCorrect: false,
      type: "OFF_BY_ONE_PERIOD" as const,
      explanation: item.why,
    })),
  ];
  const matching = [key, ...picked].filter((item) => close(item.value, truth, 1e-7)).length;
  return { choices, matching };
}

const aSym = (term: string, rate = "") => `a_{\\overline{${term}}|${rate}}`;
const sSym = (term: string, rate = "") => `s_{\\overline{${term}}|${rate}}`;
const aDueSym = (term: string, rate = "") => `\\ddot{a}_{\\overline{${term}}|${rate}}`;

export const SOA_ANNUITY_CONCEPT_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_ANN_CONCEPT_EQUATION_OF_VALUE",
    domain: ANN,
    title: "Choosing the Equation of Value for Contributions and Withdrawals",
    objective: "Match a stream of contributions and withdrawals to a correctly timed equation of value.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    qualitative: true,
    soaSamples: [36, 233],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const last = rng.choice([15, 16, 17]);
      const W = rng.choice([20000, 25000, 40000, 50000]);
      const i = gridRate(rng, 0.03, 0.07, 0.01);
      const growth = dec(1 + i, 2);
      const Wm = mn(W);
      // X from the true equation; each candidate is evaluated at that X.
      const pvW = [1, 2, 3, 4].reduce((sum, k) => sum + W * v(i, last + k), 0);
      const X = pvW / an(last, i);
      const atZero = rng.next() < 0.5;
      const key: Candidate = atZero
        ? {
            latex: `X\\sum_{k=1}^{${last}} v^k = ${Wm}\\left[v^{${last + 1}} + v^{${last + 2}} + v^{${last + 3}} + v^{${last + 4}}\\right]`,
            value: X * an(last, i) - pvW,
            why: "Both sides are present values at birth: contributions at times 1 to " + last + " and withdrawals at times " + (last + 1) + " to " + (last + 4) + ".",
          }
        : {
            latex: `X\\sum_{k=0}^{${last - 1}} (${growth})^k = ${Wm}\\left[v + v^2 + v^3 + v^4\\right]`,
            value: X * sn(last, i) - W * an(4, i),
            why: `Both sides are valued at the ${ord(last)} birthday: the contributions accumulate to $X s_{\\overline{${last}}|}$ and the withdrawals are discounted from the following four birthdays.`,
          };
      const wrong: Candidate[] = [
        {
          latex: `X\\sum_{k=0}^{${last}} v^k = ${Wm}\\left[v^{${last + 1}} + v^{${last + 2}} + v^{${last + 3}} + v^{${last + 4}}\\right]`,
          value: X * adue(last + 1, i) - pvW,
          why: "Counts a contribution at birth, which the parents do not make.",
        },
        {
          latex: `X\\sum_{k=1}^{${last}} v^k = ${Wm}\\left[v^{${last}} + v^{${last + 1}} + v^{${last + 2}} + v^{${last + 3}}\\right]`,
          value: X * an(last, i) - W * [0, 1, 2, 3].reduce((sum, k) => sum + v(i, last + k), 0),
          why: "Discounts each withdrawal one year too little.",
        },
        {
          latex: `X\\sum_{k=1}^{${last}} (${growth})^k = ${Wm}\\left[1 + v + v^2 + v^3\\right]`,
          value: X * sn(last, i) * (1 + i) - W * adue(4, i),
          why: `Accumulates each contribution one year too long, then values the withdrawals at the ${ord(last + 1)} birthday instead of the ${ord(last)}.`,
        },
        {
          latex: `X\\sum_{k=1}^{${last}} (${growth})^k = ${Wm}\\left[v + v^2 + v^3 + v^4\\right]`,
          value: X * sn(last, i) * (1 + i) - W * an(4, i),
          why: "Accumulates each contribution one year past the valuation date.",
        },
        {
          latex: `X\\sum_{k=0}^{${last - 1}} (${growth})^k = ${Wm}\\left[1 + v + v^2 + v^3\\right]`,
          value: X * sn(last, i) - W * adue(4, i),
          why: `Treats the first withdrawal as made on the ${ord(last)} birthday.`,
        },
        {
          latex: `X\\sum_{k=1}^{${last - 1}} v^k = ${Wm}\\left[v^{${last + 1}} + v^{${last + 2}} + v^{${last + 3}} + v^{${last + 4}}\\right]`,
          value: X * an(last - 1, i) - pvW,
          why: "Leaves out the last contribution.",
        },
      ];
      const { choices, matching } = formulaChoices(rng, 0, key, wrong);
      return {
        kind: "CHOICE",
        questionText: `At the birth of their daughter, two parents decide they will need ${n(W)} on each of her ${ord(last + 1)}, ${ord(last + 2)}, ${ord(last + 3)} and ${ord(last + 4)} birthdays to fund her college education.
They plan to contribute $X$ on each of her 1st through ${ord(last)} birthdays, and they expect to earn a constant ${pc(i)} annual effective interest rate. Let $v = 1/${growth}$.
Determine which of the following equations of value can be used to calculate $X$.`,
        variables: { last, W, i },
        choices,
        solutionSteps: `**Step 1 — Place the cash flows.** Contributions of $X$ fall at times $1, 2, \\ldots, ${last}$; withdrawals of ${n(W)} at times $${last + 1}$ through $${last + 4}$.

**Step 2 — Value both sides at one date.** ${key.why} The matching equation is
$$${key.latex}.$$`,
        checks: [{ label: "exactly one equation holds", ok: matching === 1 && close(key.value, 0, 1e-7) }],
      };
    },
  },

  {
    id: "FM_ANN_CONCEPT_ANNUITY_EXPRESSION",
    domain: ANN,
    title: "Choosing an Annuity Expression for a Payment Pattern",
    objective: "Express the present value of an irregular payment pattern with standard annuity symbols.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    qualitative: true,
    soaSamples: [113, 116, 262, 397],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const i = gridRate(rng, 0.03, 0.09, 0.01);
      const kind = rng.choice(["BLOCK", "DEFERRED_INCREASING", "STEPPED", "QUARTERLY_INCREASING"] as const);

      if (kind === "BLOCK") {
        const first = rng.int(2, 5);
        const gap = rng.int(first + 1, 9);
        const count = 12;
        const truth = Array.from({ length: count }, (_, k) => v(i, first + gap * k)).reduce((a, b) => a + b, 0);
        const top = `${gap}n+${first}`;
        const val = (upper: number, lower: number, denom: number) => (an(upper, i) - an(lower, i)) / denom;
        const key: Candidate = {
          latex: `\\frac{${aSym(top)} - ${aSym(String(first))}}{${aSym(String(gap))}}`,
          value: val(gap * count + first, first, an(gap, i)),
          why: `The payments are a level annuity of 1 every ${gap} years deferred ${first} years: $v^{${first}}\\dfrac{1 - v^{${gap}n}}{1 - v^{${gap}}} = \\dfrac{${aSym(top)} - ${aSym(String(first))}}{${aSym(String(gap))}}$.`,
        };
        const wrong: Candidate[] = [
          { latex: `\\frac{${aSym(top)} - ${aSym(String(first))}}{${sSym(String(gap))}}`, value: val(gap * count + first, first, sn(gap, i)), why: `Dividing by $s_{\\overline{${gap}}|}$ spreads each payment as though it were made at the start of its ${gap}-year period.` },
          { latex: `\\frac{${aSym(top)} - ${aSym(String(first))}}{${sSym(String(first))}}`, value: val(gap * count + first, first, sn(first, i)), why: `The divisor must reflect the ${gap}-year spacing, not the ${first}-year deferral.` },
          { latex: `\\frac{${aSym(top)} - ${aSym(String(gap))}}{${aSym(String(first))}}`, value: val(gap * count + first, gap, an(first, i)), why: "Swaps the roles of the deferral and the spacing." },
          { latex: `\\frac{${aSym(top)} - ${aSym(String(gap))}}{${sSym(String(gap))}}`, value: val(gap * count + first, gap, sn(gap, i)), why: `Removes ${gap} years instead of the ${first}-year deferral.` },
          { latex: `\\frac{${aSym(`${gap}n`)}}{${sSym(String(gap))}}`, value: an(gap * count, i) / sn(gap, i), why: `This values payments at times ${gap}, ${2 * gap}, ..., not ${first}, ${first + gap}, ....` },
        ];
        const { choices, matching } = formulaChoices(rng, truth, key, wrong);
        return {
          kind: "CHOICE",
          questionText: `An annuity makes $n$ payments of 1. The first payment is made at the end of ${first} years, and the remaining payments are made at ${gap}-year intervals thereafter. Its present value is $X$.
Determine $X$.`,
          variables: { kind, first, gap, i },
          choices,
          solutionSteps: `**Step 1 — Sum the discounted payments.** $X = v^{${first}} + v^{${first + gap}} + \\cdots + v^{${first}+${gap}(n-1)} = v^{${first}}\\,\\dfrac{1 - v^{${gap}n}}{1 - v^{${gap}}}$.

**Step 2 — Rewrite with annuity symbols.** Multiply numerator and denominator by $1/i$: ${key.why}`,
          checks: [{ label: "exactly one expression matches", ok: matching === 1 && close(key.value, truth, 1e-7) }],
        };
      }

      if (kind === "DEFERRED_INCREASING") {
        const shiftLater = rng.next() < 0.5;
        const truthFirst = shiftLater ? 1 : 0;
        const nYears = 6;
        const truth = Array.from({ length: 6000 }, (_, k) => (k + 1) * v(i, nYears + truthFirst + k)).reduce((a, b) => a + b, 0);
        const d = i / (1 + i);
        const candidates: Candidate[] = [
          { latex: "\\frac{v^n}{d^2}", value: v(i, nYears) / (d * d), why: "Payments $1, 2, 3, \\ldots$ starting at time $n$ are worth $v^n(I\\ddot{a})_{\\overline{\\infty}|} = v^n/d^2$." },
          { latex: "\\frac{v^n}{di}", value: v(i, nYears) / (d * i), why: "Payments $1, 2, 3, \\ldots$ starting at time $n + 1$ are worth $v^n(Ia)_{\\overline{\\infty}|} = v^n/(id)$." },
          { latex: "\\frac{v^n}{d}", value: v(i, nYears) / d, why: "That values a level perpetuity-due, not an increasing one." },
          { latex: "\\frac{v^n}{i^2}", value: v(i, nYears) / (i * i), why: "That values payments $1, 2, 3, \\ldots$ starting at time $n + 2$." },
          { latex: `\\frac{${aSym("n")} - nv^n}{i}`, value: (an(nYears, i) - nYears * v(i, nYears)) / i, why: "That is a finite decreasing-type expression, not a deferred increasing perpetuity." },
          { latex: "\\frac{v^{n-1}}{d^2}", value: v(i, nYears - 1) / (d * d), why: "Starts the payments one year too early." },
        ];
        const keyIndex = shiftLater ? 1 : 0;
        const key = candidates[keyIndex];
        const { choices, matching } = formulaChoices(rng, truth, key, candidates.filter((_, idx) => idx !== keyIndex));
        return {
          kind: "CHOICE",
          questionText: `Determine which of the following is an expression for the present value of a perpetuity with annual payments of 1, 2, 3, ..., where the first payment is made at the ${shiftLater ? "end of $n + 1$ years" : "end of $n$ years"}, using an annual effective interest rate of $i$.`,
          variables: { kind, shiftLater: shiftLater ? 1 : 0, i },
          choices,
          solutionSteps: `**Step 1 — Undeferred value.** An increasing perpetuity with payments $1, 2, 3, \\ldots$ at times $0, 1, 2, \\ldots$ is worth $(I\\ddot{a})_{\\overline{\\infty}|} = 1/d^2$; at times $1, 2, 3, \\ldots$ it is worth $1/(id)$.

**Step 2 — Defer.** ${key.why} The answer is ${`$${key.latex}$`}.`,
          checks: [{ label: "exactly one expression matches", ok: matching === 1 && close(key.value, truth, 1e-7) }],
        };
      }

      if (kind === "STEPPED") {
        const start = rng.int(3, 8);
        const count = 5;
        const first = rng.choice([1000, 2000]);
        const inc = rng.choice([500, 1000]);
        const truth = Array.from({ length: count }, (_, k) => (first + inc * k) * v(i, start + k)).reduce((a, b) => a + b, 0);
        const base = first - inc;
        const combo = (lvl: number, incr: number, defer: number, due: boolean) =>
          v(i, defer) * (lvl * (due ? adue(count, i) : an(count, i)) + incr * (due ? Ia(count, i) * (1 + i) : Ia(count, i)));
        const Isym = (due: boolean) => (due ? `(I\\ddot{a})_{\\overline{${count}}|}` : `(Ia)_{\\overline{${count}}|}`);
        const key: Candidate = {
          latex: `v^{${start - 1}}\\left[${mn(base)}\\,${aSym(String(count))} + ${mn(inc)}\\,${Isym(false)}\\right]`,
          value: combo(base, inc, start - 1, false),
          why: `Payment $k$ is $${mn(base)} + ${mn(inc)}k$, made at time ${start - 1} + $k$: a level annuity-immediate plus an increasing annuity-immediate, deferred ${start - 1} years.`,
        };
        const wrong: Candidate[] = [
          { latex: `v^{${start}}\\left[${mn(base)}\\,${aSym(String(count))} + ${mn(inc)}\\,${Isym(false)}\\right]`, value: combo(base, inc, start, false), why: "Defers the payments one year too long." },
          { latex: `v^{${start - 1}}\\left[${mn(first)}\\,${aSym(String(count))} + ${mn(inc)}\\,${Isym(false)}\\right]`, value: combo(first, inc, start - 1, false), why: `The level part should be ${n(base)}, because the increasing part already adds ${n(inc)} to the first payment.` },
          { latex: `v^{${start}}\\left[${mn(first)}\\,${aDueSym(String(count))} + ${mn(inc)}\\,${Isym(true)}\\right]`, value: combo(first, inc, start, true), why: "Uses the full first payment in the level part." },
          { latex: `v^{${start - 1}}\\left[${mn(base)}\\,${aDueSym(String(count))} + ${mn(inc)}\\,${Isym(true)}\\right]`, value: combo(base, inc, start - 1, true), why: "Treats the payments as due one year earlier." },
          { latex: `v^{${start}}\\left[${mn(base)}\\,${aSym(String(count))} + ${mn(inc)}\\,${Isym(true)}\\right]`, value: combo(base, 0, start, false) + v(i, start) * inc * Ia(count, i) * (1 + i), why: "Mixes an annuity-immediate with an increasing annuity-due." },
        ];
        const { choices, matching } = formulaChoices(rng, truth, key, wrong);
        return {
          kind: "CHOICE",
          questionText: `The first payment of a ${word5()} annuity is due in ${start} years and is ${n(first)}. Each of the following four annual payments is ${n(inc)} larger than the one before. The annual effective interest rate is $i$.
Determine which of the following gives the present value of the annuity.`,
          variables: { kind, start, first, inc, i },
          choices,
          solutionSteps: `**Step 1 — Split each payment.** ${key.why}

**Step 2 — Write the present value.** $$${key.latex}.$$`,
          checks: [{ label: "exactly one expression matches", ok: matching === 1 && close(key.value, truth, 1e-7) }],
        };
      }

      const j = gridRate(rng, 0.02, 0.04, 0.005);
      const P = rng.choice([100, 200, 500]);
      const years = rng.choice([5, 10, 15]);
      const effective = acc(j, 4) - 1;
      const quarterly = Ia(4, j);
      const truth = Array.from({ length: 4 * years }, (_, k) => P * ((k % 4) + 1) * v(j, k + 1)).reduce((a, b) => a + b, 0);
      const quarterLabel = mpc(j, 2);
      const effLabel = mpc(effective, 4);
      const nomLabel = mpc(4 * j, 2);
      const Isym = `(Ia)_{\\overline{4}|${quarterLabel}}`;
      const key: Candidate = {
        latex: `${P}\\,${Isym}\\,${aDueSym(String(years), effLabel)}`,
        value: P * quarterly * adue(years, effective),
        why: `Each year's four payments are worth $${P}(Ia)_{\\overline{4}|}$ at the start of that year at ${pc(j, 2)} a quarter. Those yearly values fall at times $0, 1, \\ldots, ${years - 1}$, so they form an annuity-due at the effective annual rate $(1.${dec(j, 3).slice(2)})^4 - 1 = ${mpc(effective, 4)}$.`,
      };
      const wrong: Candidate[] = [
        { latex: `${P}\\,${Isym}\\,${aSym(String(years), effLabel)}`, value: P * quarterly * an(years, effective), why: "Discounts every year's block one year too far: the first block is valued at time 0." },
        { latex: `${P}\\,${Isym}\\,${aDueSym(String(years), nomLabel)}`, value: P * quarterly * adue(years, 4 * j), why: "Discounts between years at the nominal rate instead of the effective annual rate." },
        { latex: `${P}\\,${Isym}\\,${aSym(String(years), nomLabel)}`, value: P * quarterly * an(years, 4 * j), why: "Uses the nominal rate and defers every block one year too long." },
        { latex: `${P}\\,(I\\ddot{a})_{\\overline{4}|${quarterLabel}}\\,${aDueSym(String(years), effLabel)}`, value: P * quarterly * (1 + j) * adue(years, effective), why: "Treats the quarterly payments as due at the start of each quarter." },
      ];
      const { choices, matching } = formulaChoices(rng, truth, key, wrong);
      return {
        kind: "CHOICE",
        questionText: `An annuity-immediate pays ${P}, ${2 * P}, ${3 * P} and ${4 * P} at the ends of the four quarters of each year, for ${years} years.
At an annual nominal interest rate of ${pc(4 * j, 2)} convertible quarterly, the present value of the annuity is $P$.
Determine the equation of value.`,
        variables: { kind, j, P, years },
        choices,
        solutionSteps: `**Step 1 — Value one year's payments.** At ${pc(j, 2)} per quarter, the four payments of a year are worth $${P}(Ia)_{\\overline{4}|} = ${dec(P * quarterly, 4)}$ at the start of that year.

**Step 2 — Value the years.** ${key.why} So
$$P = ${key.latex}.$$`,
        checks: [{ label: "exactly one expression matches", ok: matching === 1 && close(key.value, truth, 1e-7) }],
      };
    },
  },
];

function word5(): string {
  return "five-year";
}
