/**
 * Time value of money, modelled on the SOA sample-set question types:
 * rate equivalence, forces of interest, equations of value and yields on
 * simple cash-flow patterns.
 */
import type { Rng } from "../../random";
import {
  distractor,
  type GeneratedChoiceQuestionItem,
  type GeneratedQuestionItem,
  type QuestionTemplateDefinition,
} from "../types";
import {
  acc,
  cast,
  close,
  dec,
  drawUntil,
  eff,
  frequency,
  gridAmount,
  gridRate,
  mn,
  mpc,
  n,
  nom,
  nomDisc,
  nomToEff,
  pc,
  solve,
  v,
  word,
  amt,
  mamt,
  fraction,
} from "./kit";

const TVM = "TIME_VALUE_OF_MONEY" as const;

/** `\frac{t^2}{c}` or `\frac{t}{c}`. */
function powerForce(power: number, divisor: number): string {
  return `\\frac{t${power === 1 ? "" : `^{${power}}`}}{${divisor}}`;
}

/** One of the three rate quotations used in multi-regime accumulation items. */
type Regime =
  | { kind: "NOMINAL"; rate: number; m: number; years: number }
  | { kind: "FORCE"; rate: number; years: number }
  | { kind: "DISCOUNT"; rate: number; m: number; years: number };

function regimeFactor(regime: Regime): number {
  switch (regime.kind) {
    case "NOMINAL":
      return Math.pow(1 + regime.rate / regime.m, regime.m * regime.years);
    case "FORCE":
      return Math.exp(regime.rate * regime.years);
    case "DISCOUNT":
      return Math.pow(1 - regime.rate / regime.m, -regime.m * regime.years);
  }
}

function regimeProse(regime: Regime): string {
  switch (regime.kind) {
    case "NOMINAL":
      return nom(regime.rate, regime.m);
    case "FORCE":
      return `a constant annual force of interest of ${pc(regime.rate)}`;
    case "DISCOUNT":
      return nomDisc(regime.rate, regime.m);
  }
}

function regimeMath(regime: Regime): string {
  switch (regime.kind) {
    case "NOMINAL":
      return `\\left(1 + \\frac{${dec(regime.rate, 4)}}{${regime.m}}\\right)^{${regime.m * regime.years}}`;
    case "FORCE":
      return `e^{${dec(regime.rate, 4)}(${regime.years})}`;
    case "DISCOUNT":
      return `\\left(1 - \\frac{${dec(regime.rate, 4)}}{${regime.m}}\\right)^{-${regime.m * regime.years}}`;
  }
}

/** The growth factor a candidate gets by reading every quote as an annual effective rate. */
function regimeFactorAsEffective(regime: Regime): number {
  return Math.pow(1 + regime.rate, regime.years);
}

export const SOA_TVM_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_TVM_NOMINAL_EQUALS_FORCE",
    domain: TVM,
    title: "Force of Interest Equivalent to a Nominal Rate",
    objective: "Convert a nominal interest rate convertible m-thly to the equivalent force of interest.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [1],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const m = rng.choice([2, 4]);
      const j = gridRate(rng, 0.04, 0.1, 0.005);
      const years = rng.choice([4.5, 5.25, 6.75, 7.25, 8.5, 9.75]);
      const deposit = rng.choice([100, 500, 1000]);
      const delta = m * Math.log(1 + j / m);
      const effective = nomToEff(j, m);
      return {
        questionText: `${first} deposits ${n(deposit)} into an account that credits interest at ${nom(j, m)}.
On the same day, ${second} deposits ${n(deposit)} into a different account, which credits interest at an annual force of interest of $\\delta$.
After ${years} years the two accounts hold the same amount.
Calculate $\\delta$.`,
        variables: { deposit, nominal: j, m, years },
        correctValue: delta,
        format: "AMOUNT_4",
        distractors: [
          distractor(j, "NOMINAL_RATE_ERROR", "Took the nominal rate itself as the force of interest."),
          distractor(effective, "NOMINAL_RATE_ERROR", "Took the equivalent annual effective rate as the force of interest. The force is $\\delta = \\ln(1+i)$, not $i$."),
          distractor(Math.log(1 + j), "NOMINAL_RATE_ERROR", `Treated ${pc(j)} as an annual effective rate, ignoring conversion ${frequency(m)}.`),
          distractor(-m * Math.log(1 - j / m), "CALCULATION_DISTRACTOR", "Treated the nominal interest rate as a nominal discount rate."),
        ],
        solutionSteps: `**Step 1 — Accumulate the nominal-rate account.** Interest is credited at $${dec(j, 4)}/${m}$ per period, so after $t$ years the balance is
$$${mn(deposit)}\\left(1 + \\frac{${dec(j, 4)}}{${m}}\\right)^{${m}t}.$$

**Step 2 — Equate it with the force-of-interest account.** The balance $${mn(deposit)}e^{\\delta t}$ matches when
$$e^{\\delta} = \\left(1 + \\frac{${dec(j, 4)}}{${m}}\\right)^{${m}} = ${dec(1 + effective)} \\implies \\delta = ${m}\\ln\\left(1 + \\frac{${dec(j, 4)}}{${m}}\\right) = ${dec(delta, 5)}.$$
The ${years}-year horizon does not affect the answer: equal growth factors agree at every date.`,
        checks: [
          {
            label: "balances agree at the stated date",
            ok: close(deposit * Math.pow(1 + j / m, m * years), deposit * Math.exp(delta * years)),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_COMPOUND_SIMPLE_SAME_INTEREST",
    domain: TVM,
    title: "Compound and Simple Interest Earned in the Same Sub-Period",
    objective: "Equate interest credited in one sub-period under nominal compound interest and under simple interest.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [3],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const { m, p1, q, year, i } = drawUntil(
        () => {
          const m = rng.choice([2, 4]);
          const p1 = rng.choice([100, 200, 500, 1000]);
          const q = rng.choice([1.5, 2, 2.5, 3]);
          const year = rng.int(5, 12);
          return { m, p1, q, year, i: m * (Math.pow(q, 1 / (m * year - 1)) - 1) };
        },
        (x) => x.i >= 0.04 && x.i <= 0.16,
        { m: 2, p1: 100, q: 2, year: 8, i: 2 * (Math.pow(2, 1 / 15) - 1) }
      );
      const p2 = p1 * q;
      const periods = m * year - 1;
      const window = m === 2 ? "six months" : "three months";
      const compoundInterest = p1 * Math.pow(1 + i / m, periods) * (i / m);
      const simpleInterest = (p2 * i) / m;
      return {
        questionText: `${first} opens a savings account with ${n(p1)} at time 0. The account credits interest at an annual nominal rate of $i$, compounded ${frequency(m)}.
${second} opens a different savings account with ${n(p2)} at time 0. That account credits simple interest at an annual rate of $i$.
The two accounts are credited the same amount of interest over the final ${window} of year ${year}.
Calculate $i$.`,
        variables: { p1, p2, m, year },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(m * (Math.pow(q, 1 / (m * year)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Compounded for ${m * year} periods; only ${periods} periods have passed when the final ${window} begin.`),
          distractor(m * (Math.pow(q, 1 / (m * year - 2)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Compounded for ${m * year - 2} periods, one period short of the start of the final ${window}.`),
          distractor((i / m) * 100, "NOMINAL_RATE_ERROR", "Reported the rate per compounding period instead of the annual nominal rate."),
          distractor(nomToEff(i, m) * 100, "NOMINAL_RATE_ERROR", "Reported the equivalent annual effective rate instead of the nominal rate $i$."),
        ],
        solutionSteps: `**Step 1 — Interest on the compound account.** The final ${window} of year ${year} begin after $${m}(${year}) - 1 = ${periods}$ periods, so the interest credited is
$$${mn(p1)}\\left(1 + \\frac{i}{${m}}\\right)^{${periods}} \\cdot \\frac{i}{${m}}.$$

**Step 2 — Interest on the simple-interest account.** Simple interest credits the same amount in every ${window}:
$$${mn(p2)} \\cdot \\frac{i}{${m}}.$$

**Step 3 — Equate and solve.** Cancelling $i/${m}$,
$$\\left(1 + \\frac{i}{${m}}\\right)^{${periods}} = \\frac{${mn(p2)}}{${mn(p1)}} = ${q} \\implies i = ${m}\\left(${q}^{1/${periods}} - 1\\right) = ${mpc(i, 4)}.$$`,
        checks: [{ label: "interest credited is equal", ok: close(compoundInterest, simpleInterest) }],
      };
    },
  },

  {
    id: "FM_TVM_INTEREST_IN_YEAR_EQUAL",
    domain: TVM,
    title: "Equal Interest Earned in Different Years",
    objective: "Find a rate from equal interest amounts earned in different years, then evaluate that interest.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [22],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const { deposit, ratio, early, gap, i } = drawUntil(
        () => {
          const deposit = rng.choice([100, 200, 500, 1000]);
          const ratio = rng.choice([2, 2.5, 4]);
          const gap = rng.int(5, 14);
          const early = rng.int(6, 13);
          return { deposit, ratio, early, gap, i: Math.pow(ratio, 1 / gap) - 1 };
        },
        (x) => x.i >= 0.045 && x.i <= 0.13,
        { deposit: 100, ratio: 2, early: 11, gap: 6, i: Math.pow(2, 1 / 6) - 1 }
      );
      const smaller = deposit / ratio;
      const late = early + gap;
      const X = deposit * Math.pow(1 + i, early - 1) * i;
      return {
        questionText: `${first} and ${second} each open a bank account at time 0. ${first} deposits ${n(deposit)} and ${second} deposits ${n(smaller, smaller % 1 === 0 ? 0 : 2)}. Both accounts earn the same annual effective interest rate.
The interest credited to ${first}'s account during year ${early} is $X$.
The interest credited to ${second}'s account during year ${late} is also $X$.
Calculate $X$.`,
        variables: { deposit, smaller, early, late },
        correctValue: X,
        format: "AMOUNT_2",
        distractors: [
          distractor(deposit * Math.pow(1 + i, early) * i, "OFF_BY_ONE_PERIOD", `Accumulated for ${early} years; interest for year ${early} is earned on the balance at time ${early - 1}.`),
          distractor(deposit * Math.pow(1 + i, early - 2) * i, "OFF_BY_ONE_PERIOD", `Accumulated for only ${early - 2} years before applying the year-${early} interest.`),
          distractor(deposit * i, "SIMPLE_INTEREST_ERROR", "Applied the rate to the original deposit, as simple interest would."),
          distractor(
            deposit * Math.pow(1 + (Math.pow(ratio, 1 / (gap + 1)) - 1), early - 1) * (Math.pow(ratio, 1 / (gap + 1)) - 1),
            "OFF_BY_ONE_PERIOD",
            `Solved $(1+i)^{${gap + 1}} = ${ratio}$; the two years are ${gap} years apart.`
          ),
        ],
        solutionSteps: `**Step 1 — Interest credited in a given year.** A deposit $D$ earns $D(1+i)^{k-1}\\,i$ during year $k$.

**Step 2 — Equate the two accounts.**
$$${mn(deposit)}(1+i)^{${early - 1}} i = ${mn(smaller, smaller % 1 === 0 ? 0 : 2)}(1+i)^{${late - 1}} i \\implies (1+i)^{${gap}} = ${ratio} \\implies i = ${mpc(i, 4)}.$$

**Step 3 — Evaluate $X$.**
$$X = ${mn(deposit)}(${dec(1 + i)})^{${early - 1}}(${dec(i)}) = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "second account earns X in the later year",
            ok: close(smaller * Math.pow(1 + i, late - 1) * i, X),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_POWER_FORCE_INTEREST_EQUATION",
    domain: TVM,
    title: "Interest Earned under a Power Force of Interest",
    objective: "Accumulate deposits under a time-varying force of interest and solve an interest equation.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [10, 303],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const params = drawUntil(
        () => {
          const power = rng.choice([1, 2]);
          const divisor =
            power === 2
              ? rng.choice([50, 100, 150, 200, 250, 300, 400, 500])
              : rng.choice([20, 25, 40, 50, 60, 75, 100]);
          const T = rng.int(2, 5);
          const H = 2 * T;
          const k = rng.choice([1, 2]);
          const deposit = rng.choice([100, 200, 500, 1000]);
          const a = (t: number) => Math.exp(Math.pow(t, power + 1) / ((power + 1) * divisor));
          const R = a(H) / a(T);
          const X = (deposit * a(T) * (R - 1)) / (k - (R - 1));
          return { power, divisor, T, H, k, deposit, R, X, aT: a(T), aH: a(H) };
        },
        (x) => x.R - 1 > 0.25 && x.R - 1 < x.k - 0.08 && x.X / x.deposit > 0.3 && x.X / x.deposit < 15,
        (() => {
          const a = (t: number) => Math.exp(Math.pow(t, 3) / 300);
          const R = a(6) / a(3);
          return { power: 2, divisor: 100, T: 3, H: 6, k: 1, deposit: 100, R, X: (100 * a(3) * (R - 1)) / (2 - R), aT: a(3), aH: a(6) };
        })()
      );
      const { power, divisor, T, H, k, deposit, R, X, aT, aH } = params;
      const exponentDivisor = (power + 1) * divisor;
      const deltaT = Math.pow(T, power) / divisor;
      const constantForceR = Math.exp(deltaT * (H - T));
      const early = Math.exp(Math.pow(H - T, power + 1) / exponentDivisor);
      const multiple = k === 1 ? "$X$" : "$2X$";
      const interestCheck = (deposit * aT + X) * R - (deposit * aT + X);
      return {
        questionText: `A fund credits interest at a force of interest $\\delta_t = ${powerForce(power, divisor)}$, where $t \\ge 0$ is measured in years.
${saver} deposits ${n(deposit)} into the fund at time 0 and $X$ at time ${T}.
The interest credited to the fund from time ${T} to time ${H} is ${multiple}.
Calculate $X$.`,
        variables: { power, divisor, T, H, k, deposit },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((deposit * aT * (R - 1)) / k, "CALCULATION_DISTRACTOR", "Left out the interest that the deposit $X$ itself earns between the two dates."),
          distractor((deposit * (R - 1)) / (k - (R - 1)), "CALCULATION_DISTRACTOR", `Used the original ${n(deposit)} as the balance at time ${T}, forgetting its growth from time 0.`),
          distractor((deposit * aT * (constantForceR - 1)) / (k - (constantForceR - 1)), "SIMPLE_INTEREST_ERROR", `Held the force at its time-${T} value $\\delta_{${T}}$ for the whole interval instead of integrating it.`),
          distractor((deposit * aT * (early - 1)) / (k - (early - 1)), "OFF_BY_ONE_PERIOD", `Integrated the force from 0 to ${H - T} rather than from ${T} to ${H}.`),
        ],
        solutionSteps: `**Step 1 — Accumulation function.**
$$a(t) = \\exp\\left(\\int_0^t ${powerForce(power, divisor)}\\,ds\\right) = \\exp\\left(\\frac{t^{${power + 1}}}{${exponentDivisor}}\\right).$$
So $a(${T}) = ${dec(aT, 5)}$ and the growth from time ${T} to time ${H} is $a(${H})/a(${T}) = ${dec(aH, 5)}/${dec(aT, 5)} = ${dec(R, 5)}$.

**Step 2 — Balance at time ${T}.** Just after the second deposit the fund holds $${mn(deposit)}(${dec(aT, 5)}) + X = ${mn(deposit * aT, 2)} + X$.

**Step 3 — Interest from time ${T} to time ${H}.**
$$(${mn(deposit * aT, 2)} + X)(${dec(R - 1, 5)}) = ${k === 1 ? "X" : "2X"} \\implies X = \\frac{${mn(deposit * aT, 2)}(${dec(R - 1, 5)})}{${k} - ${dec(R - 1, 5)}} = ${mn(X, 2)}.$$`,
        checks: [{ label: "interest over the interval is kX", ok: close(interestCheck, k * X) }],
      };
    },
  },

  {
    id: "FM_TVM_RATIONAL_FORCE_TIME_TO_TARGET",
    domain: TVM,
    title: "Time to Reach a Target under a Rational Force of Interest",
    objective: "Integrate a rational force of interest and solve the accumulation equation for time.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [46],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const choice = drawUntil(
        () => {
          const [A, C] = rng.choice([
            [100, 150],
            [200, 300],
            [50, 150],
            [100, 300],
            [100, 600],
          ] as const);
          const B = rng.int(2, 5);
          const deposit = rng.choice([200, 500, 1000]);
          const ratio = rng.choice([2, 3, 4, 5]);
          const exponent = C / (3 * A);
          const base = B * C;
          const t = Math.cbrt(base * (Math.pow(ratio, 1 / exponent) - 1));
          return { A, B, C, deposit, ratio, exponent, base, t };
        },
        (x) => x.t >= 3 && x.t <= 45,
        { A: 100, B: 3, C: 150, deposit: 500, ratio: 4, exponent: 0.5, base: 450, t: Math.cbrt(450 * 15) }
      );
      const { A, B, C, deposit, ratio, exponent, base, t } = choice;
      const target = deposit * ratio;
      const cube = base * (Math.pow(ratio, 1 / exponent) - 1);
      return {
        questionText: `The annual force of interest credited to a savings account is
$$\\delta_t = \\frac{t^2/${A}}{${B} + t^3/${C}},$$
where $t$ is measured in years. ${saver} deposits ${n(deposit)} into the account at time 0.
Calculate the number of years it takes for the account to grow to ${n(target)}.`,
        variables: { A, B, C, deposit, target },
        correctValue: t,
        format: "AMOUNT_1",
        distractors: [
          distractor(Math.cbrt(base * (ratio - 1)), "CALCULATION_DISTRACTOR", `Dropped the exponent ${exponent} in $a(t)$ and solved $1 + t^3/${base} = ${ratio}$.`),
          distractor(Math.cbrt(base * (Math.pow(ratio, exponent) - 1)), "CALCULATION_DISTRACTOR", `Raised ${ratio} to the power ${exponent} instead of ${dec(1 / exponent, 2).replace(/\.?0+$/, "")}.`),
          distractor(Math.cbrt(C * (Math.pow(ratio, 1 / exponent) - 1)), "CALCULATION_DISTRACTOR", `Lost the factor ${B} when rewriting the denominator as $(${base} + t^3)/${C}$.`),
          distractor(Math.sqrt(cube), "CALCULATION_DISTRACTOR", "Took a square root at the last step instead of a cube root."),
        ],
        solutionSteps: `**Step 1 — Integrate the force.** Rewrite $\\delta_t = \\dfrac{(${C}/${A})\\,t^2}{${base} + t^3}$. With $u = ${base} + t^3$,
$$\\int_0^t \\delta_s\\,ds = \\frac{${C}}{3(${A})}\\ln\\frac{${base} + t^3}{${base}} \\implies a(t) = \\left(1 + \\frac{t^3}{${base}}\\right)^{${exponent}}.$$

**Step 2 — Equation of value.** $${mn(deposit)}\\,a(t) = ${mn(target)}$ gives $\\left(1 + t^3/${base}\\right)^{${exponent}} = ${ratio}$.

**Step 3 — Solve for $t$.**
$$t^3 = ${base}\\left(${ratio}^{${dec(1 / exponent, 4).replace(/\.?0+$/, "")}} - 1\\right) = ${mn(cube, 2)} \\implies t = ${dec(t, 3)} \\text{ years}.$$`,
        checks: [
          {
            label: "deposit reaches the target",
            ok: close(deposit * Math.pow(1 + Math.pow(t, 3) / base, exponent), target, 1e-7),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_DISCOUNT_THEN_NOMINAL_SOLVE",
    domain: TVM,
    title: "Solving for a Discount Rate across Two Rate Regimes",
    objective: "Write an equation of value across a nominal discount regime and a nominal interest regime, then solve for the discount rate.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [9],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const d1 = rng.choice([100, 500, 1000]);
      const d2 = d1 * rng.choice([1, 1.5, 2]);
      const T1 = rng.choice([6, 8, 10]);
      const s = T1 + rng.choice([2, 4, 5]);
      const H = s + rng.choice([8, 10, 15]);
      const m1 = rng.choice([2, 4, 12]);
      const m2 = rng.choice([2, 4, 12]);
      const j = gridRate(rng, 0.04, 0.08, 0.005);
      const dTrue = gridRate(rng, 0.03, 0.08, 0.0025);
      const g1 = Math.pow(1 + j / m2, m2 * (H - T1));
      const g2 = Math.pow(1 + j / m2, m2 * (H - s));
      const exact = d1 * Math.pow(1 - dTrue / m1, -m1 * T1) * g1 + d2 * g2;
      const balance = Math.round(exact / (exact > 10000 ? 100 : 10)) * (exact > 10000 ? 100 : 10);
      const solveD = (ratio: number) => m1 * (1 - Math.pow(ratio, -1 / (m1 * T1)));
      const ratio = (balance - d2 * g2) / (d1 * g1);
      const d = solveD(ratio);
      const g2Early = Math.pow(1 + j / m2, m2 * (H - T1));
      return {
        questionText: `${saver} deposits ${n(d1)} into a fund today and ${n(d2)} at the end of year ${s}.
For the first ${T1} years the fund credits interest at an annual nominal discount rate of $d$, convertible ${frequency(m1)}. After that it credits interest at ${nom(j, m2)}.
The fund holds ${n(balance)} at the end of year ${H}.
Calculate $d$.`,
        variables: { d1, d2, T1, s, H, m1, m2, j, balance },
        correctValue: d * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(m1 * (Math.pow(ratio, 1 / (m1 * T1)) - 1) * 100, "NOMINAL_RATE_ERROR", "Solved for a nominal interest rate: the first regime quotes a rate of discount."),
          distractor(solveD(balance / (d1 * g1)) * 100, "CALCULATION_DISTRACTOR", `Credited all ${n(balance)} to the first deposit, leaving out the accumulated second deposit.`),
          distractor(solveD((balance - d2 * g2Early) / (d1 * g1)) * 100, "OFF_BY_ONE_PERIOD", `Accumulated the second deposit from time ${T1} instead of from time ${s}.`),
          distractor((1 - Math.pow(ratio, -1 / T1)) * 100, "NOMINAL_RATE_ERROR", "Reported the equivalent annual effective discount rate, not the nominal rate convertible " + frequency(m1) + "."),
        ],
        solutionSteps: `**Step 1 — Accumulate the second deposit.** It earns only the second regime, for ${H - s} years:
$$${mn(d2)}\\left(1 + \\frac{${dec(j, 4)}}{${m2}}\\right)^{${m2 * (H - s)}} = ${mn(d2 * g2, 2)}.$$

**Step 2 — Isolate the first deposit's growth.** The first deposit is worth $${mn(balance)} - ${mn(d2 * g2, 2)} = ${mn(balance - d2 * g2, 2)}$ at time ${H}. Removing the ${H - T1} years of the second regime,
$$${mn(d1)}\\left(1 - \\frac{d}{${m1}}\\right)^{-${m1 * T1}} = \\frac{${mn(balance - d2 * g2, 2)}}{${dec(g1, 5)}} \\implies \\left(1 - \\frac{d}{${m1}}\\right)^{-${m1 * T1}} = ${dec(ratio, 5)}.$$

**Step 3 — Solve for $d$.**
$$d = ${m1}\\left(1 - ${dec(ratio, 5)}^{-1/${m1 * T1}}\\right) = ${mpc(d, 4)}.$$`,
        checks: [
          {
            label: "balance reproduced",
            ok: close(d1 * Math.pow(1 - d / m1, -m1 * T1) * g1 + d2 * g2, balance),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_PIECEWISE_FORCE_LOAN",
    domain: TVM,
    title: "Two Advances Repaid under an Effective Rate then a Varying Force",
    objective: "Accumulate advances through an effective-rate period and a varying-force period and solve for an unknown advance.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [86],
    generate: (rng: Rng) => {
      const L0 = rng.choice([5000, 10000, 20000]);
      const i = gridRate(rng, 0.04, 0.08, 0.005);
      const T = rng.choice([4, 5, 6]);
      const s = rng.choice([2, 3]);
      const H = T + rng.choice([4, 5, 6]);
      const c = rng.choice([1, 2, 4]);
      const growth2 = (c + H) / (c + T);
      const xTrue = L0 * rng.choice([1.5, 2, 2.5, 3]);
      const exact = (L0 * acc(i, T) + xTrue * acc(i, T - s)) * growth2;
      const repayment = Math.round(exact / 500) * 500;
      const X = (repayment / growth2 - L0 * acc(i, T)) / acc(i, T - s);
      const forceText = `\\frac{1}{${c} + t}`;
      const constantGrowth = Math.exp((H - T) / (c + T));
      return {
        questionText: `A bank lends ${n(L0)} today and a further $X$ at the end of year ${s}. In exchange, it receives a single repayment of ${n(repayment)} at the end of year ${H}.
The bank charges ${eff(i)} for the first ${T} years and a force of interest $\\delta_t = ${forceText}$ for $t \\ge ${T}$, where $t$ is measured in years.
Calculate $X$.`,
        variables: { L0, i, T, s, H, c, repayment },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((repayment / constantGrowth - L0 * acc(i, T)) / acc(i, T - s), "SIMPLE_INTEREST_ERROR", `Held the force at $\\delta_{${T}} = 1/${c + T}$ over the whole second period instead of integrating it.`),
          distractor((repayment / growth2 - L0 * acc(i, T)) / acc(i, T), "OFF_BY_ONE_PERIOD", `Accumulated the second advance from time 0 instead of from time ${s}.`),
          distractor((repayment / acc(i, H - T) - L0 * acc(i, T)) / acc(i, T - s), "CALCULATION_DISTRACTOR", `Applied the ${pc(i)} effective rate for all ${H} years.`),
          distractor((repayment / growth2 - L0 * acc(i, T)) * acc(i, T - s), "CALCULATION_DISTRACTOR", "Multiplied by the accumulation factor for the second advance instead of dividing by it."),
        ],
        solutionSteps: `**Step 1 — Growth under the varying force.**
$$\\exp\\left(\\int_{${T}}^{${H}} \\frac{dt}{${c} + t}\\right) = \\frac{${c} + ${H}}{${c} + ${T}} = ${dec(growth2, 5)}.$$

**Step 2 — Equation of value at time ${T}.** The repayment is worth $${mn(repayment)}/${dec(growth2, 5)} = ${mn(repayment / growth2, 2)}$ at time ${T}, which must equal the accumulated advances:
$$${mn(L0)}(${dec(1 + i, 3)})^{${T}} + X(${dec(1 + i, 3)})^{${T - s}} = ${mn(repayment / growth2, 2)}.$$

**Step 3 — Solve for $X$.**
$$X = \\frac{${mn(repayment / growth2, 2)} - ${mn(L0 * acc(i, T), 2)}}{${dec(acc(i, T - s), 5)}} = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "advances accumulate to the repayment",
            ok: close((L0 * acc(i, T) + X * acc(i, T - s)) * growth2, repayment),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_INTEREST_AND_DISCOUNT_FUNDS",
    domain: TVM,
    title: "Funds at Equal Nominal Interest and Discount Rates",
    objective: "Combine a nominal interest rate and an equal nominal discount rate to solve for the common rate and the accumulated value.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [172],
    generate: (rng: Rng) => {
      const kTrue = gridRate(rng, 0.08, 0.2, 0.01);
      const m = rng.choice([2, 4]);
      const T = rng.choice([4, 5, 6, 8]);
      const periods = m * T;
      const depositY = Number((1000 * Math.pow(1 - (kTrue / m) ** 2, periods)).toFixed(2));
      const k = m * Math.sqrt(1 - Math.pow(depositY / 1000, 1 / periods));
      const P = 1000 * Math.pow(1 + k / m, periods);
      const kWrongSquare = Math.sqrt(m * (1 - Math.pow(depositY / 1000, 1 / periods)));
      return {
        questionText: `Fund X receives a deposit of 1000 at time 0 and accumulates at an annual nominal interest rate of $k$, compounded ${frequency(m)}.
Fund Y receives a deposit of ${n(depositY, 2)} at time 0 and accumulates at an annual nominal discount rate of $k$, also compounded ${frequency(m)}.
At the end of ${T} years, each fund is worth $P$.
Calculate $P$.`,
        variables: { m, T, depositY },
        correctValue: P,
        format: "AMOUNT_0",
        distractors: [
          distractor(1000 * Math.pow(1 + kWrongSquare / m, periods), "CALCULATION_DISTRACTOR", `Expanded $(1 + k/${m})(1 - k/${m})$ as $1 - k^2/${m}$ instead of $1 - k^2/${m * m}$.`),
          distractor(1000 * Math.pow(1 + k, T), "NOMINAL_RATE_ERROR", "Used $k$ as an annual effective rate for Fund X."),
          distractor(1000 * Math.exp(k * T), "NOMINAL_RATE_ERROR", "Used $k$ as a force of interest for Fund X."),
          distractor(depositY * Math.pow(1 + k / m, periods), "CALCULATION_DISTRACTOR", "Accumulated Fund Y's deposit at the interest rate rather than the discount rate."),
        ],
        solutionSteps: `**Step 1 — Write both accumulations.**
$$1000\\left(1 + \\frac{k}{${m}}\\right)^{${periods}} = ${mn(depositY, 2)}\\left(1 - \\frac{k}{${m}}\\right)^{-${periods}}.$$

**Step 2 — Solve for $k$.** Multiplying through by $(1 - k/${m})^{${periods}}$,
$$\\left(1 - \\frac{k^2}{${m * m}}\\right)^{${periods}} = ${dec(depositY / 1000, 5)} \\implies k = ${m}\\sqrt{1 - ${dec(depositY / 1000, 5)}^{1/${periods}}} = ${mpc(k, 4)}.$$

**Step 3 — Evaluate $P$.**
$$P = 1000\\left(1 + \\frac{${dec(k, 5)}}{${m}}\\right)^{${periods}} = ${mn(P, 2)}.$$`,
        checks: [
          {
            label: "Fund Y reaches the same value",
            ok: close(depositY * Math.pow(1 - k / m, -periods), P),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_FORCE_YEAR_EFFECTIVE_RATE",
    domain: TVM,
    title: "Effective Rate for One Year under a Varying Force",
    objective: "Convert a time-varying force of interest to the annual effective rate earned over a given year.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [324, 394, 442],
    generate: (rng: Rng) => {
      const reciprocal = rng.next() < 0.6;
      const k = reciprocal ? rng.int(3, 10) : rng.int(2, 6);
      const c = reciprocal ? rng.int(5, 25) : rng.choice([20, 25, 40, 50, 100]);
      const dated = rng.next() < 0.4;
      const startYear = rng.int(2018, 2024);
      const growth = (t: number) => (reciprocal ? c + t : c + t * t);
      const rateInYear = (year: number) => growth(year) / growth(year - 1) - 1;
      const answer = rateInYear(k);
      const force = (t: number) => (reciprocal ? 1 / (c + t) : (2 * t) / (c + t * t));
      const forceText = reciprocal ? `\\frac{1}{${c} + t}` : `\\frac{2t}{${c} + t^2}`;
      const timing = dated
        ? `where $t$ is the time in years since January 1, ${startYear}.\nCalculate the annual effective interest rate earned during calendar year ${startYear + k - 1}.`
        : `where $t$ is measured in years.\nCalculate the annual effective interest rate earned during year ${k}.`;
      return {
        questionText: `An account earns interest at a force of interest $\\delta_t = ${forceText}$, ${timing}`,
        variables: { c, k, reciprocal: reciprocal ? 1 : 0 },
        correctValue: answer * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(force(k) * 100, "CALCULATION_DISTRACTOR", `Reported the force of interest at time ${k} instead of the growth over the year.`),
          distractor((Math.exp(force(k)) - 1) * 100, "CALCULATION_DISTRACTOR", `Converted $\\delta_{${k}}$ as if the force were constant over the year.`),
          distractor(rateInYear(k + 1) * 100, "OFF_BY_ONE_PERIOD", `Measured the year from time ${k} to ${k + 1}; year ${k} runs from time ${k - 1} to ${k}.`),
          distractor(rateInYear(k - 1) * 100, "OFF_BY_ONE_PERIOD", `Measured the year from time ${k - 2} to ${k - 1}.`),
          distractor((growth(k) / growth(0) - 1) * 100, "CALCULATION_DISTRACTOR", "Reported the cumulative growth from time 0 instead of the growth within the year."),
        ],
        solutionSteps: `**Step 1 — Accumulation function.** Integrating the force,
$$a(t) = \\exp\\left(\\int_0^t \\delta_s\\,ds\\right) = \\frac{${reciprocal ? `${c} + t` : `${c} + t^2`}}{${c}}.$$

**Step 2 — Growth over the year.** The year runs from $t = ${k - 1}$ to $t = ${k}$:
$$1 + i = \\frac{a(${k})}{a(${k - 1})} = \\frac{${growth(k)}}{${growth(k - 1)}} \\implies i = ${mpc(answer, 4)}.$$`,
        checks: [
          {
            label: "matches numerical integration of the force",
            ok: close(
              Math.exp(
                Array.from({ length: 2000 }, (_, s) => force(k - 1 + (s + 0.5) / 2000) / 2000).reduce((a, b) => a + b, 0)
              ) - 1,
              answer,
              1e-6
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_REAL_RATE",
    domain: TVM,
    title: "Real and Nominal Rates of Interest",
    objective: "Relate the nominal rate of interest, the real rate and the inflation rate exactly.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [406, 402],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [saver] = cast(rng);
      const variant = rng.choice(["REAL", "NOMINAL", "PURCHASING"] as const);
      const inflation = gridRate(rng, 0.015, 0.06, 0.005);
      if (variant === "REAL") {
        const nominalRate = gridRate(rng, inflation + 0.02, inflation + 0.07, 0.005);
        const real = (nominalRate - inflation) / (1 + inflation);
        return {
          questionText: `${saver} buys a bond that earns interest at ${eff(nominalRate)}. The annual rate of inflation is ${pc(inflation)}.
Calculate the annual effective real rate of interest ${saver} earns.`,
          variables: { nominalRate, inflation },
          correctValue: real * 100,
          format: "PERCENT_2",
          distractors: [
            distractor((nominalRate - inflation) * 100, "SIMPLE_INTEREST_ERROR", "Subtracted inflation from the nominal rate; that is only an approximation."),
            distractor(((nominalRate - inflation) / (1 + nominalRate)) * 100, "CALCULATION_DISTRACTOR", "Divided by $1 + i$ instead of $1 + r$."),
            distractor(((1 + nominalRate) * (1 + inflation) - 1) * 100, "CALCULATION_DISTRACTOR", "Compounded inflation onto the nominal rate instead of removing it."),
            distractor((nominalRate / (1 + inflation)) * 100, "CALCULATION_DISTRACTOR", "Deflated the rate itself instead of the growth factor."),
          ],
          solutionSteps: `**Step 1 — Real growth factor.** One unit grows to $1 + i$ in money terms while prices grow by $1 + r$, so its purchasing power grows by $\\frac{1+i}{1+r}$.

**Step 2 — Real rate.**
$$i' = \\frac{1 + ${dec(nominalRate, 3)}}{1 + ${dec(inflation, 3)}} - 1 = \\frac{i - r}{1 + r} = ${mpc(real, 4)}.$$`,
          checks: [{ label: "real rate reproduces the nominal rate", ok: close((1 + real) * (1 + inflation), 1 + nominalRate) }],
        };
      }
      if (variant === "NOMINAL") {
        const real = gridRate(rng, 0.01, 0.05, 0.005);
        const nominalRate = (1 + real) * (1 + inflation) - 1;
        return {
          questionText: `A lender requires an annual effective real rate of interest of ${pc(real)} on a new loan. The annual rate of inflation is expected to be ${pc(inflation)}.
Calculate the annual effective interest rate the lender should charge.`,
          variables: { real, inflation },
          correctValue: nominalRate * 100,
          format: "PERCENT_2",
          distractors: [
            distractor((real + inflation) * 100, "SIMPLE_INTEREST_ERROR", "Added the two rates, dropping the cross term $i'r$."),
            distractor((real + inflation - real * inflation) * 100, "CALCULATION_DISTRACTOR", "Subtracted the cross term instead of adding it."),
            distractor(((1 + real) / (1 + inflation) - 1) * 100, "CALCULATION_DISTRACTOR", "Divided by the inflation factor instead of multiplying by it."),
            distractor((real * (1 + inflation)) * 100, "CALCULATION_DISTRACTOR", "Inflated only the real rate and forgot to add inflation itself."),
          ],
          solutionSteps: `**Step 1 — Money growth must cover inflation and real growth.**
$$1 + i = (1 + i')(1 + r) = (${dec(1 + real, 3)})(${dec(1 + inflation, 3)}).$$

**Step 2 — Nominal rate.**
$$i = i' + r + i'r = ${mpc(nominalRate, 4)}.$$`,
          checks: [{ label: "real rate recovered", ok: close((nominalRate - inflation) / (1 + inflation), real) }],
        };
      }
      const nominalRate = gridRate(rng, inflation + 0.01, inflation + 0.06, 0.005);
      const deposit = gridAmount(rng, 5000, 50000, 1000);
      const years = rng.int(5, 20);
      const realValue = deposit * Math.pow((1 + nominalRate) / (1 + inflation), years);
      return {
        questionText: `${saver} invests ${n(deposit)} today at ${eff(nominalRate)}. Prices are expected to rise at ${pc(inflation)} per year.
Calculate the value of ${saver}'s investment after ${years} years, measured in today's purchasing power.`,
        variables: { deposit, nominalRate, inflation, years },
        correctValue: realValue,
        format: "AMOUNT_0",
        distractors: [
          distractor(deposit * Math.pow(1 + nominalRate - inflation, years), "SIMPLE_INTEREST_ERROR", "Used $i - r$ as the real rate."),
          distractor(deposit * Math.pow(1 + nominalRate, years), "CALCULATION_DISTRACTOR", "Did not remove inflation."),
          distractor(deposit * Math.pow(1 + nominalRate, years) * (1 - inflation * years), "SIMPLE_INTEREST_ERROR", "Deflated with simple rather than compound inflation."),
          distractor(deposit * Math.pow(1 + nominalRate, years - 1) / Math.pow(1 + inflation, years), "OFF_BY_ONE_PERIOD", `Accumulated for ${years - 1} years.`),
        ],
        solutionSteps: `**Step 1 — Money value.** $${mn(deposit)}(${dec(1 + nominalRate, 3)})^{${years}} = ${mn(deposit * acc(nominalRate, years), 2)}$.

**Step 2 — Remove inflation.** Dividing by the price level $(${dec(1 + inflation, 3)})^{${years}}$,
$$\\frac{${mn(deposit * acc(nominalRate, years), 2)}}{${dec(acc(inflation, years), 5)}} = ${mn(realValue, 2)}.$$`,
        checks: [{ label: "real accumulation", ok: close(realValue * acc(inflation, years), deposit * acc(nominalRate, years)) }],
      };
    },
  },

  {
    id: "FM_TVM_RATE_REGIMES_ACCUMULATION",
    domain: TVM,
    title: "Accumulation across Several Rate Quotations",
    objective: "Accumulate a deposit through periods quoted as nominal interest, force of interest and nominal discount.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [321],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const deposit = rng.choice([1000, 2000, 5000, 10000]);
      const regimes: Regime[] = rng.shuffle([
        { kind: "NOMINAL" as const, rate: gridRate(rng, 0.03, 0.08, 0.005), m: rng.choice([2, 4, 12]), years: rng.int(2, 4) },
        { kind: "FORCE" as const, rate: gridRate(rng, 0.03, 0.07, 0.005), years: rng.int(2, 4) },
        { kind: "DISCOUNT" as const, rate: gridRate(rng, 0.03, 0.08, 0.005), m: rng.choice([2, 4, 12]), years: rng.int(2, 4) },
      ]);
      const total = regimes.reduce((sum, regime) => sum + regime.years, 0);
      const factors = regimes.map(regimeFactor);
      const value = deposit * factors.reduce((a, b) => a * b, 1);
      const describe = regimes
        .map((regime, k) => {
          const span = k === 0 ? `for the first ${word(regime.years)} years` : k === 1 ? `for the next ${word(regime.years)} years` : "thereafter";
          return `${["i", "ii", "iii"][k]}) ${regimeProse(regime)} ${span}${k === 0 ? ";" : k === 1 ? "; and" : "."}`;
        })
        .join("\n");
      const discountIndex = regimes.findIndex((regime) => regime.kind === "DISCOUNT");
      const discount = regimes[discountIndex] as Extract<Regime, { kind: "DISCOUNT" }>;
      const asInterest = factors.map((factor, k) =>
        k === discountIndex ? Math.pow(1 + discount.rate / discount.m, discount.m * discount.years) : factor
      );
      const forceIndex = regimes.findIndex((regime) => regime.kind === "FORCE");
      const forceAsEffective = factors.map((factor, k) =>
        k === forceIndex ? regimeFactorAsEffective(regimes[k]) : factor
      );
      return {
        questionText: `${saver} deposits ${n(deposit)} into a fund. The fund earns:
${describe}
Calculate the amount in the fund at the end of ${total} years.`,
        variables: {
          deposit,
          rates: regimes.map((regime) => regime.rate),
          years: regimes.map((regime) => regime.years),
          kinds: regimes.map((regime) => regime.kind),
          m: regimes.map((regime) => ("m" in regime ? regime.m : 0)),
        },
        correctValue: value,
        format: "AMOUNT_0",
        distractors: [
          distractor(deposit * asInterest.reduce((a, b) => a * b, 1), "NOMINAL_RATE_ERROR", "Treated the nominal discount rate as a nominal interest rate."),
          distractor(deposit * regimes.map(regimeFactorAsEffective).reduce((a, b) => a * b, 1), "NOMINAL_RATE_ERROR", "Treated every quoted rate as an annual effective interest rate."),
          distractor(deposit * forceAsEffective.reduce((a, b) => a * b, 1), "NOMINAL_RATE_ERROR", "Treated the force of interest as an annual effective rate."),
          distractor(deposit * (1 + regimes.reduce((sum, regime) => sum + regime.rate * regime.years, 0)), "SIMPLE_INTEREST_ERROR", "Applied the quoted rates as simple interest."),
        ],
        solutionSteps: `**Step 1 — Growth factor for each period.**
${regimes.map((regime, k) => `$$${regimeMath(regime)} = ${dec(factors[k], 6)}$$`).join("\n")}

**Step 2 — Chain the factors.**
$$${mn(deposit)} \\times ${factors.map((factor) => dec(factor, 6)).join(" \\times ")} = ${mn(value, 2)}.$$`,
        checks: [{ label: "at least three regimes", ok: regimes.length === 3 }],
      };
    },
  },

  {
    id: "FM_TVM_INTEREST_RATIO_TWO_YEARS",
    domain: TVM,
    title: "Ratio of Interest Credited in Two Years",
    objective: "Use the ratio of interest credited in two different years to solve for a nominal rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [166],
    generate: (rng: Rng) => {
      const [saver] = cast(rng);
      const { m, early, gap, k, i } = drawUntil(
        () => {
          const m = rng.choice([2, 4, 12]);
          const early = rng.int(2, 8);
          const gap = rng.int(5, 12);
          const k = rng.choice([1.5, 2, 2.5, 3]);
          return { m, early, gap, k, i: m * (Math.pow(k, 1 / (m * gap)) - 1) };
        },
        (x) => x.i >= 0.04 && x.i <= 0.15,
        { m: 2, early: 5, gap: 7, k: 2, i: 2 * (Math.pow(2, 1 / 14) - 1) }
      );
      const late = early + gap;
      const deposit = rng.choice([100, 500, 1000]);
      const interest = (year: number) =>
        deposit * Math.pow(1 + i / m, m * (year - 1)) * (Math.pow(1 + i / m, m) - 1);
      return {
        questionText: `${saver} deposits ${n(deposit)} into a bank account at time 0. The bank credits interest at an annual nominal rate of $i$, compounded ${frequency(m)}.
The total interest credited in year ${late} is ${k} times the total interest credited in year ${early}.
Calculate $i$.`,
        variables: { deposit, m, early, late, k },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((Math.pow(k, 1 / gap) - 1) * 100, "NOMINAL_RATE_ERROR", "Reported the annual effective rate instead of the nominal rate."),
          distractor(m * (Math.pow(k, 1 / (m * (gap + 1))) - 1) * 100, "OFF_BY_ONE_PERIOD", `Counted ${gap + 1} years between the two years instead of ${gap}.`),
          distractor(m * (Math.pow(k, 1 / (m * (gap - 1))) - 1) * 100, "OFF_BY_ONE_PERIOD", `Counted ${gap - 1} years between the two years instead of ${gap}.`),
          distractor((Math.pow(k, 1 / (m * gap)) - 1) * 100, "NOMINAL_RATE_ERROR", "Reported the rate per compounding period."),
        ],
        solutionSteps: `**Step 1 — Interest in year $t$.** The balance at the start of year $t$ is $${mn(deposit)}(1 + i/${m})^{${m}(t-1)}$, and a year's interest is that balance times $(1 + i/${m})^{${m}} - 1$.

**Step 2 — Take the ratio.** The common factor cancels, leaving
$$\\left(1 + \\frac{i}{${m}}\\right)^{${m}(${late} - ${early})} = ${k} \\implies i = ${m}\\left(${k}^{1/${m * gap}} - 1\\right) = ${mpc(i, 4)}.$$`,
        checks: [{ label: "interest ratio reproduced", ok: close(interest(late) / interest(early), k) }],
      };
    },
  },

  {
    id: "FM_TVM_SIMPLE_VS_COMPOUND_YEAR_INTEREST",
    domain: TVM,
    title: "Interest Credited in One Year: Simple versus Compound",
    objective: "Compare the interest credited in a single year under changing simple interest and under nominal compound interest.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [207],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const r1 = gridRate(rng, 0.06, 0.1, 0.01);
          const r2 = gridRate(rng, 0.04, 0.08, 0.01);
          const j = gridRate(rng, 0.04, 0.07, 0.005);
          const m = rng.choice([2, 4, 12]);
          const T = rng.choice([3, 4, 5]);
          const year = T + rng.int(2, 6);
          const simple = 1000 * r2;
          const compound = 1000 * Math.pow(1 + j / m, m * (year - 1)) * (Math.pow(1 + j / m, m) - 1);
          return { r1, r2, j, m, T, year, simple, compound, N: compound - simple };
        },
        (x) => Math.abs(x.N) > 0.5 && Math.abs(x.N) < 40,
        (() => {
          const compound = 1000 * Math.pow(1.0125, 28) * (Math.pow(1.0125, 4) - 1);
          return { r1: 0.1, r2: 0.07, j: 0.05, m: 4, T: 5, year: 8, simple: 70, compound, N: compound - 70 };
        })()
      );
      const { r1, r2, j, m, T, year, simple, compound, N } = params;
      const wrongExponent = 1000 * Math.pow(1 + j / m, m * year) * (Math.pow(1 + j / m, m) - 1);
      return {
        questionText: `An investor deposits 1000 in each of Bank X and Bank Y.
Bank X credits simple interest at an annual rate of ${pc(r1)} for the first ${T} years and ${pc(r2)} after that.
Bank Y credits interest at ${nom(j, m)}.
The interest Bank Y credits in year ${year} exceeds the interest Bank X credits in year ${year} by $N$.
Calculate $|N|$.`,
        variables: { r1, r2, j, m, T, year },
        correctValue: Math.abs(N),
        format: "AMOUNT_2",
        distractors: [
          distractor(Math.abs(compound - 1000 * r1), "OFF_BY_ONE_PERIOD", `Applied Bank X's first-period rate of ${pc(r1)} in year ${year}.`),
          distractor(Math.abs(wrongExponent - simple), "OFF_BY_ONE_PERIOD", `Accumulated Bank Y's balance for ${year} years before the year's interest; the year begins at time ${year - 1}.`),
          distractor(Math.abs(1000 * nomToEff(j, m) - simple), "SIMPLE_INTEREST_ERROR", "Took Bank Y's interest on the original 1000 only."),
          distractor(Math.abs(1000 * Math.pow(1 + j / m, m * (year - 1)) * j - simple), "NOMINAL_RATE_ERROR", "Applied the nominal rate for one year without compounding within the year."),
        ],
        solutionSteps: `**Step 1 — Bank X.** Simple interest credits a fixed ${pc(r2)} of the deposit each year after year ${T}: $1000(${dec(r2, 2)}) = ${mn(simple, 2)}$.

**Step 2 — Bank Y.** The balance at the start of year ${year} grows for one more year:
$$1000\\left(1 + \\frac{${dec(j, 4)}}{${m}}\\right)^{${m * (year - 1)}}\\left[\\left(1 + \\frac{${dec(j, 4)}}{${m}}\\right)^{${m}} - 1\\right] = ${mn(compound, 2)}.$$
So $|N| = |${mn(compound, 2)} - ${mn(simple, 2)}| = ${mn(Math.abs(N), 2)}$.`,
        checks: [
          {
            label: "Bank Y interest as difference of balances",
            ok: close(
              1000 * Math.pow(1 + j / m, m * year) - 1000 * Math.pow(1 + j / m, m * (year - 1)),
              compound
            ),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_TIME_TO_EQUAL_BALANCES",
    domain: TVM,
    title: "Time until a Discount-Rate Fund Catches Up",
    objective: "Convert a nominal discount rate and a force of interest to common growth and solve for the time the balances match.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [214],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const params = drawUntil(
        () => {
          const m = rng.choice([2, 4, 12]);
          const d = gridRate(rng, 0.06, 0.14, 0.01);
          const delta = gridRate(rng, 0.03, 0.09, 0.005);
          const small = rng.choice([100, 500, 1000]);
          const ratio = rng.choice([1.5, 2, 2.5]);
          const forceX = -m * Math.log(1 - d / m);
          const t = Math.log(ratio) / (forceX - delta);
          return { m, d, delta, small, ratio, forceX, t };
        },
        (x) => x.forceX - x.delta > 0.015 && x.t >= 5 && x.t <= 45,
        { m: 4, d: 0.12, delta: 0.08, small: 100, ratio: 2, forceX: -4 * Math.log(0.97), t: Math.log(2) / (-4 * Math.log(0.97) - 0.08) }
      );
      const { m, d, delta, small, ratio, forceX, t } = params;
      const big = small * ratio;
      const asInterest = m * Math.log(1 + d / m);
      return {
        questionText: `${first} deposits ${n(small)} into Fund X, which earns ${nomDisc(d, m)}.
At the same time, ${second} deposits ${n(big)} into Fund Y, which earns a constant annual force of interest of ${dec(delta, 3).replace(/0+$/, "")}.
After $n$ years, the two funds have equal balances.
Calculate $n$.`,
        variables: { m, d, delta, small, big },
        correctValue: t,
        format: "AMOUNT_1",
        distractors: [
          distractor(Math.log(ratio) / (asInterest - delta), "NOMINAL_RATE_ERROR", "Treated Fund X's rate as a nominal interest rate."),
          distractor(Math.log(ratio) / (d - delta), "NOMINAL_RATE_ERROR", "Used the nominal discount rate itself as Fund X's force of interest."),
          distractor(Math.log(ratio) / (-Math.log(1 - d) - delta), "NOMINAL_RATE_ERROR", `Treated ${pc(d)} as an annual effective discount rate.`),
          distractor(Math.log(1 / ratio + 1) / (forceX - delta), "CALCULATION_DISTRACTOR", "Set up the ratio of the deposits incorrectly."),
        ],
        solutionSteps: `**Step 1 — Force of interest equivalent to Fund X's rate.**
$$\\left(1 - \\frac{${dec(d, 2)}}{${m}}\\right)^{-${m}} = e^{\\delta_X} \\implies \\delta_X = -${m}\\ln\\left(1 - \\frac{${dec(d, 2)}}{${m}}\\right) = ${dec(forceX, 5)}.$$

**Step 2 — Equate the balances.**
$$${mn(small)}e^{${dec(forceX, 5)}n} = ${mn(big)}e^{${dec(delta, 3)}n} \\implies n = \\frac{\\ln ${ratio}}{${dec(forceX, 5)} - ${dec(delta, 3)}} = ${dec(t, 3)}.$$`,
        checks: [
          {
            label: "balances match at n",
            ok: close(small * Math.pow(1 - d / m, -m * t), big * Math.exp(delta * t)),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_MONTHS_UNTIL_DOUBLE",
    domain: TVM,
    title: "Months until One Balance Doubles Another",
    objective: "Solve a growth comparison when interest is credited only at the end of each conversion period.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [62],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const params = drawUntil(
        () => {
          const j1 = gridRate(rng, 0.05, 0.09, 0.005);
          const j2 = gridRate(rng, 0.02, 0.05, 0.005);
          const deposit = rng.choice([1000, 2000, 5000]);
          const years =
            Math.log(2) / (2 * Math.log(1 + j1 / 2) - 12 * Math.log(1 + j2 / 12));
          return { j1, j2, deposit, years };
        },
        (x) => x.j1 - x.j2 >= 0.02 && x.years > 8 && x.years < 40,
        { j1: 0.06, j2: 0.03, deposit: 1000, years: Math.log(2) / (2 * Math.log(1.03) - 12 * Math.log(1.0025)) }
      );
      const { j1, j2, deposit, years } = params;
      let month = 1;
      while (
        deposit * Math.pow(1 + j1 / 2, Math.floor(month / 6)) <
        2 * deposit * Math.pow(1 + j2 / 12, month)
      ) {
        month += 1;
      }
      const continuousMonths = years * 12;
      return {
        questionText: `${first} opens a bank account with ${n(deposit)}. It earns ${nom(j1, 2)}.
${second} opens a bank account with ${n(deposit)} at the same time. It earns ${nom(j2, 12)}.
Each account is credited interest only at the end of each interest conversion period.
Calculate the number of months until ${first}'s balance is first at least double ${second}'s balance.`,
        variables: { j1, j2, deposit },
        correctValue: month,
        format: "AMOUNT_0",
        optionStyle: "MODELLED",
        ladderStep: 6,
        distractors: [
          distractor(Math.round(continuousMonths), "CALCULATION_DISTRACTOR", "Solved the growth equation as if interest were credited continuously and rounded the result."),
          distractor(Math.ceil(continuousMonths), "CALCULATION_DISTRACTOR", "Rounded the continuous solution up to a whole month, but interest to the first account is only credited every six months."),
          distractor(month - 6, "OFF_BY_ONE_PERIOD", "Stopped at the last semiannual crediting date before the balance actually reaches double."),
          distractor(Math.floor(continuousMonths), "CALCULATION_DISTRACTOR", "Rounded the continuous solution down."),
          distractor(month + 6, "OFF_BY_ONE_PERIOD", "Waited one crediting period too long."),
        ],
        solutionSteps: `**Step 1 — Solve as if interest were credited smoothly.**
$$${mn(deposit)}(${dec(1 + j1 / 2, 4)})^{2n} = 2(${mn(deposit)})(1 + ${dec(j2, 3)}/12)^{12n} \\implies n = \\frac{\\ln 2}{2\\ln(${dec(1 + j1 / 2, 4)}) - 12\\ln(${dec(1 + j2 / 12, 6)})} = ${dec(years, 3)} \\text{ years},$$
which is ${dec(continuousMonths, 1)} months.

**Step 2 — Account for when interest is credited.** ${first}'s balance only increases at multiples of 6 months, while ${second}'s increases every month, so the condition first holds at the next semiannual crediting date.

**Step 3 — Confirm.** At month ${month}, $${mn(deposit)}(${dec(1 + j1 / 2, 4)})^{${Math.floor(month / 6)}} = ${mn(deposit * Math.pow(1 + j1 / 2, Math.floor(month / 6)), 2)}$ and twice ${second}'s balance is $${mn(2 * deposit * Math.pow(1 + j2 / 12, month), 2)}$. The answer is **${month} months**.`,
        checks: [
          { label: "answer is a crediting date", ok: month % 6 === 0 },
          {
            label: "condition fails six months earlier",
            ok:
              deposit * Math.pow(1 + j1 / 2, month / 6 - 1) <
              2 * deposit * Math.pow(1 + j2 / 12, month - 6),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_STREAMS_GIVEN_VN",
    domain: TVM,
    title: "Equal Present Values Given a Discount Factor",
    objective: "Use a given discount factor to reduce an equation of value to one unknown rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [16],
    generate: (rng: Rng) => {
      const [holder] = cast(rng);
      const params = drawUntil(
        () => {
          const a = rng.choice([100, 200, 300]);
          const b = a + rng.choice([100, 200]);
          const c = b + rng.choice([100, 200]);
          const x = gridRate(rng, 0.6, 0.88, 0.01);
          const T = rng.choice([8, 10, 12, 15]);
          const target = gridRate(rng, 0.025, 0.07, 0.005);
          const pvStream = a + b * x + c * x * x;
          const S = Math.round((pvStream * acc(target, T)) / 10) * 10;
          const i = Math.pow(S / pvStream, 1 / T) - 1;
          return { a, b, c, x, T, S, i, pvStream };
        },
        (p) => p.i > 0.015 && p.i < 0.09,
        { a: 100, b: 200, c: 300, x: 0.76, T: 10, S: 600, i: Math.pow(600 / 425.28, 0.1) - 1, pvStream: 425.28 }
      );
      const { a, b, c, x, T, S, i, pvStream } = params;
      return {
        questionText: `${holder} may choose either of two payment streams:
(i) ${n(a)} at time 0, ${n(b)} at time $n$, and ${n(c)} at time $2n$ years
(ii) ${n(S)} at time ${T} years
At an annual effective interest rate of $i$, the two streams have equal present values. You are given $v^n = ${dec(x, 2)}$.
Calculate $i$.`,
        variables: { a, b, c, x, T, S },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((Math.pow(S / (a + b * x + c * x), 1 / T) - 1) * 100, "CALCULATION_DISTRACTOR", "Discounted the time-$2n$ payment by $v^n$ instead of $v^{2n}$."),
          distractor((Math.pow(S / pvStream, 1 / (T - 1)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Discounted the lump sum for ${T - 1} years.`),
          distractor((S / pvStream - 1) * (100 / T), "SIMPLE_INTEREST_ERROR", "Solved $1 + Ti = S/PV$ as if interest were simple."),
          distractor((Math.pow(S / (a + b + c), 1 / T) - 1) * 100, "CALCULATION_DISTRACTOR", "Ignored the discounting within stream (i)."),
        ],
        solutionSteps: `**Step 1 — Present value of stream (i).**
$$${a} + ${b}v^n + ${c}v^{2n} = ${a} + ${b}(${dec(x, 2)}) + ${c}(${dec(x, 2)})^2 = ${dec(pvStream, 4)}.$$

**Step 2 — Equate with stream (ii) and solve.**
$$${mn(S)}v^{${T}} = ${dec(pvStream, 4)} \\implies (1+i)^{${T}} = ${dec(S / pvStream, 5)} \\implies i = ${mpc(i, 4)}.$$`,
        checks: [{ label: "present values agree", ok: close(S * v(i, T), pvStream) }],
      };
    },
  },

  {
    id: "FM_TVM_NPV_EQUAL_PROJECTS",
    domain: TVM,
    title: "Equal Net Present Values of Two Projects",
    objective: "Equate net present values of two projects with differently timed outlays and returns.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [19],
    generate: (rng: Rng) => {
      const A = gridAmount(rng, 3000, 6000, 500);
      const B = gridAmount(rng, 1000, 3000, 500);
      const C = gridAmount(rng, 3000, 5000, 500);
      const D = gridAmount(rng, 1000, 3000, 500);
      const E = gridAmount(rng, 3000, 5000, 500);
      const i = gridRate(rng, 0.05, 0.12, 0.01);
      const npvP = -A + B * v(i, 1) + C * v(i, 2);
      const X = (D + E * v(i, 1) - npvP) * acc(i, 2);
      return {
        questionText: `Project P requires an investment of ${n(A)} today. It returns ${n(B)} one year from today and ${n(C)} two years from today.
Project Q requires an investment of $X$ two years from today. It returns ${n(D)} today and ${n(E)} one year from today.
At ${eff(i)}, the two projects have equal net present values.
Calculate $X$.`,
        variables: { A, B, C, D, E, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((D + E * v(i, 1) - npvP) * acc(i, 1), "OFF_BY_ONE_PERIOD", "Accumulated Project Q's surplus for one year instead of two."),
          distractor((D + E * v(i, 1) + npvP) * acc(i, 2), "CALCULATION_DISTRACTOR", "Added Project P's net present value instead of subtracting it."),
          distractor(D + E - (-A + B + C), "SIMPLE_INTEREST_ERROR", "Ignored discounting altogether."),
          distractor((D + E * v(i, 1) - npvP) * v(i, 2) * acc(i, 4), "CALCULATION_DISTRACTOR", "Discounted the outlay twice before solving."),
        ],
        solutionSteps: `**Step 1 — Project P.**
$$NPV_P = -${mn(A)} + ${mn(B)}v + ${mn(C)}v^2 = ${mn(npvP, 2)}.$$

**Step 2 — Project Q and solve.**
$$${mn(D)} + ${mn(E)}v - Xv^2 = ${mn(npvP, 2)} \\implies X = (${dec(1 + i, 2)})^2\\left(${mn(D + E * v(i, 1), 2)} - (${mn(npvP, 2)})\\right) = ${mn(X, 2)}.$$`,
        checks: [{ label: "NPVs equal", ok: close(D + E * v(i, 1) - X * v(i, 2), npvP) }],
      };
    },
  },

  {
    id: "FM_TVM_TWO_RATES_SAME_PV",
    domain: TVM,
    title: "Two Interest Rates Giving Equal Present Values",
    objective: "Recognise an equation of value as a quadratic in the accumulation factor and find both roots.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [257],
    generate: (rng: Rng) => {
      const A = rng.choice([10000, 20000, 50000]);
      const x = gridRate(rng, 0.02, 0.07, 0.01);
      const y = gridRate(rng, x + 0.01, x + 0.06, 0.01);
      const B = Math.round(A * (2 + x + y));
      const C = Math.round(A * (1 + x) * (1 + y));
      const gap = Math.sqrt(B * B - 4 * A * C) / A;
      return {
        questionText: `The total present value of ${n(A)} now and ${n(C)} two years from now equals the present value of ${n(B)} one year from now at either of two different annual effective interest rates, $x$ and $y$.
Calculate $|x - y|$.`,
        variables: { A, B, C },
        correctValue: gap * 100,
        format: "PERCENT_1",
        distractors: [
          distractor(gap * 50, "CALCULATION_DISTRACTOR", "Halved the difference: the roots differ by $\\sqrt{\\Delta}/A$, not $\\sqrt{\\Delta}/2A$."),
          distractor((x + y) * 100, "CALCULATION_DISTRACTOR", "Reported the sum of the two rates."),
          distractor(gap * 200, "CALCULATION_DISTRACTOR", "Doubled the gap between the roots."),
          distractor((Math.sqrt(B * B - 4 * A * C) / B) * 100, "CALCULATION_DISTRACTOR", "Divided the discriminant's root by the wrong coefficient."),
        ],
        solutionSteps: `**Step 1 — Write the equation of value.** With $u = 1 + r$ (multiplying through by $u^2$):
$$${mn(A)}u^2 - ${mn(B)}u + ${mn(C)} = 0.$$

**Step 2 — Difference between the roots.**
$$|u_1 - u_2| = \\frac{\\sqrt{${mn(B)}^2 - 4(${mn(A)})(${mn(C)})}}{${mn(A)}} = \\frac{${mn(Math.sqrt(B * B - 4 * A * C), 2)}}{${mn(A)}} = ${dec(gap, 4)}.$$
Since $u = 1 + r$, $|x - y| = ${mpc(gap, 2)}$ (the rates are ${pc(x)} and ${pc(y)}).`,
        checks: [
          { label: "x solves the equation", ok: close(A + C * v(x, 2), B * v(x, 1)) },
          { label: "y solves the equation", ok: close(A + C * v(y, 2), B * v(y, 1)) },
        ],
      };
    },
  },

  {
    id: "FM_TVM_BONUS_CD_EQUIVALENT",
    domain: TVM,
    title: "Equivalent Rate for a Certificate with a Bonus",
    objective: "Convert a fixed-rate certificate with a terminal bonus to an equivalent level annual effective rate.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [159],
    generate: (rng: Rng) => {
      const years = rng.int(2, 6);
      const i = gridRate(rng, 0.02, 0.06, 0.0025);
      const bonus = gridRate(rng, 0.01, 0.05, 0.005);
      const j = Math.pow(acc(i, years) + bonus, 1 / years) - 1;
      return {
        questionText: `Bank P offers a ${years}-year certificate of deposit that earns ${eff(i)}. In addition, a bonus of ${pc(bonus)} of the initial deposit is paid at the end of the ${years}-year term.
Bank Q offers a ${years}-year certificate of deposit with no bonus.
Calculate the annual effective interest rate Bank Q must offer to give the same annual yield as Bank P's certificate.`,
        variables: { years, i, bonus },
        correctValue: j * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((i + bonus / years) * 100, "SIMPLE_INTEREST_ERROR", "Spread the bonus evenly across the years as simple interest."),
          distractor((i + bonus) * 100, "CALCULATION_DISTRACTOR", "Added the whole bonus to the annual rate."),
          distractor(((1 + i) * Math.pow(1 + bonus, 1 / years) - 1) * 100, "CALCULATION_DISTRACTOR", "Treated the bonus as a proportion of the accumulated value rather than of the deposit."),
          distractor((Math.pow(acc(i, years) + bonus, 1 / (years + 1)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Spread the growth over ${years + 1} years.`),
        ],
        solutionSteps: `**Step 1 — Value of 1 at maturity with Bank P.**
$$(${dec(1 + i, 4)})^{${years}} + ${dec(bonus, 3)} = ${dec(acc(i, years) + bonus, 6)}.$$

**Step 2 — Equivalent level rate.**
$$(1 + j)^{${years}} = ${dec(acc(i, years) + bonus, 6)} \\implies j = ${mpc(j, 4)}.$$`,
        checks: [{ label: "equal maturity values", ok: close(acc(j, years), acc(i, years) + bonus) }],
      };
    },
  },

  {
    id: "FM_TVM_EARLY_WITHDRAWAL_PENALTY",
    domain: TVM,
    title: "Equivalent Early-Withdrawal Penalties",
    objective: "Equate a forfeited-interest penalty with a reduced-rate penalty.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [284],
    generate: (rng: Rng) => {
      const term = rng.choice([5, 7, 10]);
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const forfeit = rng.choice([3, 6, 9, 12]);
      const years = rng.int(2, Math.min(5, term - 1));
      const j = Math.pow(1 + i, (years - forfeit / 12) / years) - 1;
      return {
        questionText: `A ${term}-year certificate of deposit earns ${eff(i)}. If the balance is withdrawn before the end of ${term} years, the purchaser may choose either of two penalties:
(i) forfeit the last ${forfeit} months' interest, or
(ii) have the annual effective interest rate reduced to $j$.
For a withdrawal after ${years} years, the two penalties are equivalent.
Calculate $j$.`,
        variables: { term, i, forfeit, years },
        correctValue: j * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((i * (years - forfeit / 12)) / years * 100, "SIMPLE_INTEREST_ERROR", "Prorated the rate as though interest were simple."),
          distractor((Math.pow(1 + i, (years - forfeit / 12) / (years - 1)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Spread the growth over ${years - 1} years.`),
          distractor((Math.pow(acc(i, years) - (i * forfeit) / 12, 1 / years) - 1) * 100, "SIMPLE_INTEREST_ERROR", "Valued the forfeited interest as simple interest on the original deposit."),
        ],
        solutionSteps: `**Step 1 — Value under penalty (i).** Losing the last ${forfeit} months' interest leaves growth for $${years} - ${dec(forfeit / 12, 2)} = ${dec(years - forfeit / 12, 2)}$ years: $(${dec(1 + i, 3)})^{${dec(years - forfeit / 12, 2)}}$.

**Step 2 — Equate with penalty (ii).**
$$(1 + j)^{${years}} = (${dec(1 + i, 3)})^{${dec(years - forfeit / 12, 2)}} \\implies j = ${mpc(j, 4)}.$$`,
        checks: [{ label: "penalties agree", ok: close(acc(j, years), Math.pow(1 + i, years - forfeit / 12)) }],
      };
    },
  },

  {
    id: "FM_TVM_EARLY_PAYMENT_DISCOUNT",
    domain: TVM,
    title: "Implied Yield of an Early-Payment Discount",
    objective: "Find the annual effective rate implied by a discount for early payment, or the price implied by a given rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [358, 438],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const discount = rng.choice([0.01, 0.015, 0.02, 0.025, 0.03]);
        const early = rng.choice([10, 15]);
        const late = rng.choice([30, 45, 60]);
        const days = late - early;
        const i = Math.pow(1 / (1 - discount), 365 / days) - 1;
        return {
          questionText: `A supplier offers two payment plans:
(i) a ${pc(discount)} discount if the invoice is paid ${early} days after purchase, or
(ii) the full amount paid ${late} days after purchase.
Assume a 365-day year.
Calculate the annual effective interest rate the buyer is implicitly charged for paying on day ${late} rather than day ${early}.`,
          variables: { discount, early, late },
          correctValue: i * 100,
          format: "PERCENT_1",
          distractors: [
            distractor((Math.pow(1 / (1 - discount), 365 / late) - 1) * 100, "OFF_BY_ONE_PERIOD", `Measured the delay as ${late} days; it is the ${days} days between the two payment dates.`),
            distractor(((discount / (1 - discount)) * 365) / days * 100, "SIMPLE_INTEREST_ERROR", "Annualised the discount with simple interest."),
            distractor((Math.pow(1 + discount, 365 / days) - 1) * 100, "CALCULATION_DISTRACTOR", `Used a rate of ${pc(discount)} for the period instead of $1/(1 - ${dec(discount, 3)}) - 1$.`),
            distractor(((discount * 365) / days) * 100, "SIMPLE_INTEREST_ERROR", "Scaled the discount rate linearly to a year."),
          ],
          solutionSteps: `**Step 1 — Rate for the ${days}-day delay.** Paying 1 on day ${late} instead of $${dec(1 - discount, 3)}$ on day ${early} means
$$(1 + i)^{${days}/365} = \\frac{1}{${dec(1 - discount, 3)}}.$$

**Step 2 — Annualise.**
$$i = \\left(\\frac{1}{${dec(1 - discount, 3)}}\\right)^{365/${days}} - 1 = ${mpc(i, 3)}.$$`,
          checks: [{ label: "growth over the delay", ok: close(Math.pow(1 + i, days / 365) * (1 - discount), 1) }],
        };
      }
      // The price is drawn first and the implied yield solved from it, so the
      // yield is always one a patient could face (roughly 8%-60%) and the
      // equation never divides by a near-zero difference.
      const { discount, early, late, deposit, i, t, factor, X } = drawUntil(
        () => {
          const discount = rng.choice([0.02, 0.025, 0.03]);
          const early = 15;
          const late = rng.choice([45, 60, 75]);
          const deposit = rng.choice([200, 250, 400, 500]);
          const price = gridAmount(rng, 1500, 6000, 100);
          const t = (late - early) / 365;
          const implied = Math.pow(((1 - discount) * price - deposit) / (price - deposit), -1 / t) - 1;
          const i = Number(implied.toFixed(3));
          const factor = v(i, t);
          const X = (deposit * (1 - factor)) / (1 - discount - factor);
          return { discount, early, late, deposit, i, t, factor, X };
        },
        (x) => x.i >= 0.08 && x.i <= 0.6 && x.X > 500,
        (() => {
          const t = 45 / 365;
          const factor = v(0.242, t);
          return { discount: 0.025, early: 15, late: 60, deposit: 250, i: 0.242, t, factor, X: (250 * (1 - factor)) / (0.975 - factor) };
        })()
      );
      return {
        questionText: `The full price of a treatment plan is $X$. A patient chooses between two payment options:
(i) pay the full price less a ${pc(discount)} discount on day ${early}, or
(ii) pay ${n(deposit)} on day ${early} and the rest of the full price, without interest, on day ${late}.
Assume a 365-day year. The annual effective yield rate implied by delaying payment under option (ii) is ${pc(i, 1)}.
Calculate $X$.`,
        variables: { discount, early, late, deposit, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((deposit * (1 - v(i, late / 365))) / (1 - discount - v(i, late / 365)), "OFF_BY_ONE_PERIOD", `Discounted over ${late} days instead of the ${late - early} days of delay.`),
          distractor(deposit / discount, "CALCULATION_DISTRACTOR", "Ignored the timing and set the discount equal to the deposit."),
          distractor((deposit * (1 - (1 - i * t))) / (1 - discount - (1 - i * t)), "SIMPLE_INTEREST_ERROR", "Discounted with simple interest."),
          distractor((deposit * factor) / (1 - discount - factor), "CALCULATION_DISTRACTOR", "Discounted the deposit as well as the later payment."),
        ],
        solutionSteps: `**Step 1 — Equation of value on day ${early}.** The two options must be equal in value:
$$${dec(1 - discount, 3)}X = ${mn(deposit)} + (X - ${mn(deposit)})\\,v^{${late - early}/365}, \\qquad v^{${late - early}/365} = (${dec(1 + i, 3)})^{-${late - early}/365} = ${dec(factor, 6)}.$$

**Step 2 — Solve for $X$.**
$$X = \\frac{${mn(deposit)}(1 - ${dec(factor, 6)})}{${dec(1 - discount, 3)} - ${dec(factor, 6)}} = ${mn(X, 2)}.$$`,
        checks: [
          {
            label: "options equal",
            ok: close((1 - discount) * X, deposit + (X - deposit) * factor),
          },
        ],
      };
    },
  },

  {
    id: "FM_TVM_CURRENT_VALUE_TRANSACTIONS",
    domain: TVM,
    title: "Current Value of Purchases and Sales under a Constant Force",
    objective: "Move cash flows forward and backward to a common date under a constant force of interest.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [347],
    generate: (rng: Rng) => {
      const delta = gridRate(rng, 0.04, 0.12, 0.01);
      const price = rng.choice([1200, 1500, 1800, 2400]);
      const ago = rng.choice([1, 2, 3]);
      const later1 = rng.choice([5, 6, 8]);
      const later2 = rng.choice([2, 3, 4]);
      const X = Math.round((price * Math.exp((-delta * later2) / 12) * rng.choice([0.8, 0.82, 0.85])) / 10) * 10;
      const cv2 = -X + price * Math.exp((-delta * later2) / 12);
      const cv1 = -X * Math.exp((delta * ago) / 12) + price * Math.exp((-delta * later1) / 12);
      return {
        questionText: `A store bought a sofa for $X$ ${word(ago)} month${ago === 1 ? "" : "s"} ago and plans to sell it for ${n(price)} ${word(later1)} months from today.
The store buys a second sofa for $X$ today and plans to sell it for ${n(price)} ${word(later2)} months from today.
The annual force of interest is a constant ${pc(delta)}.
The current value of the store's cash flows from the second sofa is ${n(cv2, 2)}.
Calculate the current value of the store's cash flows from the first sofa.`,
        variables: { delta, price, ago, later1, later2, cv2: Number(cv2.toFixed(2)) },
        correctValue: cv1,
        format: "AMOUNT_0",
        distractors: [
          distractor(-X * Math.exp((-delta * ago) / 12) + price * Math.exp((-delta * later1) / 12), "CALCULATION_DISTRACTOR", "Discounted the past purchase instead of accumulating it to today."),
          distractor(-X + price * Math.exp((-delta * later1) / 12), "OFF_BY_ONE_PERIOD", "Left the past purchase at its face amount."),
          distractor(cv2, "CALCULATION_DISTRACTOR", "Assumed the two sofas have the same current value."),
          distractor(-X * (1 + (delta * ago) / 12) + price * (1 - (delta * later1) / 12), "SIMPLE_INTEREST_ERROR", "Moved the cash flows with simple interest."),
        ],
        solutionSteps: `**Step 1 — Recover $X$ from the second sofa.**
$$-X + ${mn(price)}e^{-${dec(delta, 2)}(${later2}/12)} = ${mn(cv2, 2)} \\implies X = ${mn(X, 2)}.$$

**Step 2 — Current value of the first sofa.** The purchase ${ago} month${ago === 1 ? "" : "s"} ago accumulates to today; the sale is discounted back:
$$-${mn(X, 2)}e^{${dec(delta, 2)}(${ago}/12)} + ${mn(price)}e^{-${dec(delta, 2)}(${later1}/12)} = ${mn(cv1, 2)}.$$`,
        checks: [{ label: "X recovered from the second sofa", ok: close(price * Math.exp((-delta * later2) / 12) - cv2, X) }],
      };
    },
  },

  {
    id: "FM_TVM_EQUIVALENT_DISCOUNT_OVER_TERM",
    domain: TVM,
    title: "Equivalent Effective Discount Rate over a Term",
    objective: "Accumulate through an effective-rate period and a varying-force period, then express the result as an equivalent level rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [365],
    generate: (rng: Rng) => {
      const i = gridRate(rng, 0.03, 0.07, 0.01);
      const T1 = rng.choice([1, 2, 3]);
      const H = T1 + rng.choice([2, 3, 4]);
      const c = rng.choice([1, 2, 3]);
      const growth = acc(i, T1) * ((c + H) / (c + T1));
      const askDiscount = rng.next() < 0.6;
      const d = 1 - Math.pow(growth, -1 / H);
      const effective = Math.pow(growth, 1 / H) - 1;
      const answer = askDiscount ? d : effective;
      return {
        questionText: `A loan of 100 is repaid with a single payment of principal and accrued interest at the end of ${H} years.
Interest accrues at ${eff(i)} for the first ${T1} year${T1 === 1 ? "" : "s"}, and at a force of interest $\\delta_t = \\frac{1}{${c} + t}$ for $t > ${T1}$, where $t$ is measured in years.
Calculate the equivalent annual effective rate of ${askDiscount ? "discount" : "interest"} for the ${H}-year period.`,
        variables: { i, T1, H, c, askDiscount: askDiscount ? 1 : 0 },
        correctValue: answer * 100,
        format: "PERCENT_1",
        distractors: [
          distractor((askDiscount ? effective : d) * 100, "CALCULATION_DISTRACTOR", askDiscount ? "Reported the equivalent rate of interest instead of the rate of discount." : "Reported the equivalent rate of discount instead of the rate of interest."),
          distractor(((growth - 1) / H) * 100, "SIMPLE_INTEREST_ERROR", "Averaged the total growth as simple interest."),
          distractor((askDiscount ? 1 - Math.pow(acc(i, T1) * ((c + H) / c), -1 / H) : Math.pow(acc(i, T1) * ((c + H) / c), 1 / H) - 1) * 100, "CALCULATION_DISTRACTOR", `Integrated the force from 0 to ${H} instead of from ${T1} to ${H}.`),
          distractor((askDiscount ? 1 - Math.pow(growth, -1 / (H - 1)) : Math.pow(growth, 1 / (H - 1)) - 1) * 100, "OFF_BY_ONE_PERIOD", `Spread the growth over ${H - 1} years.`),
        ],
        solutionSteps: `**Step 1 — Growth in the effective-rate period.** $(${dec(1 + i, 2)})^{${T1}} = ${dec(acc(i, T1), 6)}$.

**Step 2 — Growth under the force.**
$$\\exp\\left(\\int_{${T1}}^{${H}} \\frac{dt}{${c} + t}\\right) = \\frac{${c + H}}{${c + T1}} = ${dec((c + H) / (c + T1), 6)}.$$
The total accumulation factor is $${dec(growth, 6)}$.

**Step 3 — Equivalent level rate.**
${askDiscount ? `$$(1 - d)^{-${H}} = ${dec(growth, 6)} \\implies d = 1 - ${dec(growth, 6)}^{-1/${H}} = ${mpc(d, 3)}.$$` : `$$(1 + i)^{${H}} = ${dec(growth, 6)} \\implies i = ${dec(growth, 6)}^{1/${H}} - 1 = ${mpc(effective, 3)}.$$`}`,
        checks: [{ label: "discount and interest rates consistent", ok: close(d, effective / (1 + effective)) }],
      };
    },
  },

  {
    id: "FM_TVM_LINEAR_FORCE_DEPOSITS",
    domain: TVM,
    title: "Deposits under a Linear Force of Interest",
    objective: "Accumulate deposits made at different times under a linearly increasing force of interest.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [312],
    generate: (rng: Rng) => {
      const a = gridRate(rng, 0.02, 0.05, 0.005);
      const b = gridRate(rng, 0.002, 0.01, 0.001);
      const deposit = rng.choice([100, 500, 1000]);
      const count = rng.choice([2, 3]);
      const H = count;
      const integral = (s: number, t: number) => a * (t - s) + (b * (t * t - s * s)) / 2;
      const value = Array.from({ length: count }, (_, k) => deposit * Math.exp(integral(k, H))).reduce((x, y) => x + y, 0);
      return {
        questionText: `Deposits of ${n(deposit)} are made to an account today${count === 2 ? " and one year from today" : ", one year from today and two years from today"}.
The annual force of interest at time $t$, in years, is $\\delta_t = ${dec(a, 3).replace(/0+$/, "")} + ${dec(b, 3).replace(/0+$/, "")}t$ for $0 \\le t \\le ${H + 1}$.
Calculate the account balance ${word(H)} years from today.`,
        variables: { a, b, deposit, count },
        correctValue: value,
        format: "AMOUNT_2",
        distractors: [
          distractor(Array.from({ length: count }, (_, k) => deposit * Math.exp(integral(0, H - k))).reduce((x, y) => x + y, 0), "CALCULATION_DISTRACTOR", "Integrated each deposit's force from time 0 rather than from its own deposit date."),
          distractor(Array.from({ length: count }, (_, k) => deposit * Math.exp((a + b * H) * (H - k))).reduce((x, y) => x + y, 0), "SIMPLE_INTEREST_ERROR", `Held the force at its time-${H} value.`),
          distractor(Array.from({ length: count }, (_, k) => deposit * (1 + integral(k, H))).reduce((x, y) => x + y, 0), "SIMPLE_INTEREST_ERROR", "Used $1 + \\int\\delta$ instead of $e^{\\int\\delta}$."),
          distractor(Array.from({ length: count }, (_, k) => deposit * Math.exp(a * (H - k))).reduce((x, y) => x + y, 0), "CALCULATION_DISTRACTOR", "Dropped the $t$ term of the force."),
        ],
        solutionSteps: `**Step 1 — Growth of each deposit.** A deposit at time $s$ grows to time ${H} by $\\exp\\left(\\int_s^{${H}}\\delta_t\\,dt\\right) = \\exp\\left(${dec(a, 3)}(${H} - s) + ${dec(b / 2, 4)}(${H * H} - s^2)\\right)$.
${Array.from({ length: count }, (_, k) => `$$s = ${k}: \\quad e^{${dec(integral(k, H), 5)}} = ${dec(Math.exp(integral(k, H)), 6)}$$`).join("\n")}

**Step 2 — Add the deposits.**
$$${mn(deposit)}\\left(${Array.from({ length: count }, (_, k) => dec(Math.exp(integral(k, H)), 6)).join(" + ")}\\right) = ${mn(value, 2)}.$$`,
        checks: [{ label: "positive growth", ok: value > deposit * count }],
      };
    },
  },

  {
    id: "FM_TVM_FORCE_THEN_DISCOUNT_EQUIVALENT",
    domain: TVM,
    title: "Matching an Accumulation under a Nominal Discount Rate",
    objective: "Accumulate under a varying force of interest, then find the deposit that reaches the same amount at a nominal discount rate.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    soaSamples: [356],
    generate: (rng: Rng) => {
      const p = rng.choice([0.5, 1, 2]);
      const q = rng.choice([4, 5, 8, 10]);
      const t1 = rng.int(1, 3);
      const t2 = t1 + rng.int(3, 5);
      const amount = rng.choice([1000, 2000, 5000]);
      const d = gridRate(rng, 0.04, 0.1, 0.01);
      const m = rng.choice([2, 4, 12]);
      const years = rng.int(2, 4);
      const X = amount * ((q + p * t2) / (q + p * t1));
      const Y = X * Math.pow(1 - d / m, m * years);
      return {
        questionText: `At a force of interest $\\delta_t = \\frac{${p}}{${q} + ${p === 1 ? "" : p}t}$, $t \\ge 0$, an investment of ${n(amount)} at time ${t1} accumulates to $X$ at time ${t2}.
At ${nomDisc(d, m)}, an investment of $Y$ accumulates to $X$ at the end of ${years} years.
Calculate $Y$.`,
        variables: { p, q, t1, t2, amount, d, m, years },
        correctValue: Y,
        format: "AMOUNT_0",
        distractors: [
          distractor(X * Math.pow(1 + d / m, -m * years), "NOMINAL_RATE_ERROR", "Treated the nominal discount rate as a nominal interest rate."),
          distractor(amount * ((q + p * t2) / q) * Math.pow(1 - d / m, m * years), "CALCULATION_DISTRACTOR", `Integrated the force from time 0 instead of time ${t1}.`),
          distractor(X * Math.pow(1 - d, years), "NOMINAL_RATE_ERROR", "Treated the nominal discount rate as an annual effective discount rate."),
          distractor(X * (1 - d * years), "SIMPLE_INTEREST_ERROR", "Discounted with simple discount."),
        ],
        solutionSteps: `**Step 1 — Accumulate under the force.**
$$\\exp\\left(\\int_{${t1}}^{${t2}} \\frac{${p}}{${q} + ${p === 1 ? "" : p}t}\\,dt\\right) = \\frac{${q} + ${p}(${t2})}{${q} + ${p}(${t1})} \\implies X = ${mn(amount)}\\cdot\\frac{${q + p * t2}}{${q + p * t1}} = ${mn(X, 2)}.$$

**Step 2 — Discount at the nominal discount rate.**
$$Y = ${mn(X, 2)}\\left(1 - \\frac{${dec(d, 2)}}{${m}}\\right)^{${m * years}} = ${mn(Y, 2)}.$$`,
        checks: [{ label: "Y accumulates to X", ok: close(Y * Math.pow(1 - d / m, -m * years), X) }],
      };
    },
  },

  {
    id: "FM_TVM_YIELD_TWO_RATE_DEPOSITS",
    domain: TVM,
    title: "Yield Rate on Deposits under Two Rates",
    objective: "Accumulate a deposit pattern through a rate change and find the level yield rate that produces the same result.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [78],
    generate: (rng: Rng) => {
      const deposit = rng.choice([100, 500, 1000]);
      const gap = rng.choice([1, 2]);
      const count = rng.choice([4, 5, 6]);
      const horizon = (count - 1) * gap + rng.choice([2, 3, 4]);
      // The rate must change inside the horizon, or the yield is just i1.
      const T1 = rng.int(2, horizon - 2);
      const i1 = gridRate(rng, 0.03, 0.06, 0.005);
      const i2 = gridRate(rng, i1 + 0.01, i1 + 0.03, 0.005);
      const factor = (s: number, t: number) => {
        const early = Math.max(0, Math.min(t, T1) - s);
        const late = t - Math.max(s, T1);
        return Math.pow(1 + i1, early) * Math.pow(1 + i2, Math.max(0, late));
      };
      const times = Array.from({ length: count }, (_, k) => k * gap);
      const AV = times.reduce((sum, t) => sum + deposit * factor(t, horizon), 0);
      const y = solve((rate) => times.reduce((sum, t) => sum + deposit * acc(rate, horizon - t), 0) - AV, -0.5, 1);
      return {
        questionText: `${word(count)[0].toUpperCase()}${word(count).slice(1)} deposits of ${n(deposit)} are made into a fund at ${gap === 1 ? "one-year" : "two-year"} intervals, with the first deposit at the beginning of the first year.
The fund earns ${eff(i1)} during the first ${T1} years and ${eff(i2)} thereafter.
Calculate the annual effective yield rate earned over the investment period ending at the end of year ${horizon}.`,
        variables: { deposit, gap, count, T1, horizon, i1, i2 },
        correctValue: y * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(((i1 * T1 + i2 * (horizon - T1)) / horizon) * 100, "SIMPLE_INTEREST_ERROR", "Took a time-weighted average of the two rates, ignoring when the deposits were made."),
          distractor(((i1 + i2) / 2) * 100, "CALCULATION_DISTRACTOR", "Averaged the two rates."),
          distractor((Math.pow(AV / (count * deposit), 1 / horizon) - 1) * 100, "CALCULATION_DISTRACTOR", "Treated all deposits as though they were made at time 0."),
          distractor((Math.pow(AV / (count * deposit), 1 / (horizon - ((count - 1) * gap) / 2)) - 1) * 100, "CALCULATION_DISTRACTOR", "Approximated the deposits by one deposit at their average date."),
        ],
        solutionSteps: `**Step 1 — Accumulate each deposit through the rate change.**
${times.map((t) => `$$\\text{deposit at } ${t}: \\quad ${mn(deposit)} \\times ${dec(factor(t, horizon), 6)} = ${mn(deposit * factor(t, horizon), 2)}$$`).join("\n")}
The fund holds $${mn(AV, 2)}$ at time ${horizon}.

**Step 2 — Equation for the yield rate.**
$$${times.map((t) => `${mn(deposit)}(1+y)^{${horizon - t}}`).join(" + ")} = ${mn(AV, 2)}.$$

**Step 3 — Solve numerically** (a calculator's IRR function on these flows): $y = ${mpc(y, 4)}$, which lies between ${pc(i1)} and ${pc(i2)} as it must.`,
        checks: [{ label: "yield lies between the two rates", ok: y > i1 && y < i2 }],
      };
    },
  },

  {
    id: "FM_TVM_COMBINED_YIELD_DIFFERENCE",
    domain: TVM,
    title: "Yields of Two Investors from a Combined Yield",
    objective: "Use a combined yield to recover an unknown payment, then compare the two investors' separate yields.",
    difficulty: 3,
    topics: ["TIME_VALUE"],
    steps: 3,
    soaSamples: [283],
    generate: (rng: Rng) => {
      const [first, second] = cast(rng, 2);
      const params = drawUntil(
        () => {
          const A = rng.choice([400, 500, 600, 800]);
          const B = Math.round(A * rng.choice([1.15, 1.2, 1.25, 1.3]));
          const C = rng.choice([100, 150, 200]);
          const r = gridRate(rng, 0.08, 0.14, 0.01);
          const Z = (A + C) * acc(r, 2) + C * acc(r, 1) - B;
          const X = Math.sqrt(B / A) - 1;
          const disc = C * C + 4 * C * Z;
          const Y = (-C + Math.sqrt(disc)) / (2 * C) - 1;
          return { A, B, C, r, Z, X, Y };
        },
        (p) => p.Z > 2 * p.C && p.Y > 0.03 && p.Y < 0.2 && Math.abs(p.Y - p.X) > 0.004,
        { A: 500, B: 600, C: 100, r: 0.1, Z: 236, X: Math.sqrt(1.2) - 1, Y: 0.115549 }
      );
      const { A, B, C, r, Z, X, Y } = params;
      const year = rng.int(2005, 2020);
      return {
        questionText: `${first} invests ${n(A)} on January 1, ${year} and receives ${n(B)} on January 1, ${year + 2}, an annual effective yield of $X$.
${second} invests ${n(C)} on January 1, ${year}, another ${n(C)} on January 1, ${year + 1}, and receives $Z$ on January 1, ${year + 2}, an annual effective yield of $Y$.
Taken together, the two investors' cash flows produce an annual effective yield of ${pc(r)}.
Calculate $Y - X$.`,
        variables: { A, B, C, r },
        correctValue: (Y - X) * 100,
        format: "PERCENT_2",
        distractors: [
          distractor((r - X) * 100, "CALCULATION_DISTRACTOR", `Took ${second}'s yield to be the combined ${pc(r)}.`),
          distractor(((Math.sqrt(Z / (2 * C)) - 1) - X) * 100, "CALCULATION_DISTRACTOR", `Treated both of ${second}'s deposits as made at the start.`),
          distractor(((Z / (2 * C) - 1) / 1.5 - X) * 100, "SIMPLE_INTEREST_ERROR", `Estimated ${second}'s yield with simple interest.`),
          distractor((Y - (B / A - 1) / 2) * 100, "SIMPLE_INTEREST_ERROR", `Estimated ${first}'s yield with simple interest.`),
        ],
        solutionSteps: `**Step 1 — ${first}'s yield.** $${mn(A)}(1 + X)^2 = ${mn(B)} \\implies X = ${mpc(X, 4)}$.

**Step 2 — Recover $Z$ from the combined yield.** At ${pc(r)}, the combined flows balance:
$$(${mn(A)} + ${mn(C)})(${dec(1 + r, 2)})^2 + ${mn(C)}(${dec(1 + r, 2)}) = ${mn(B)} + Z \\implies Z = ${mn(Z, 2)}.$$

**Step 3 — ${second}'s yield.** $${mn(C)}(1+Y)^2 + ${mn(C)}(1+Y) = ${mn(Z, 2)}$ is a quadratic in $u = 1 + Y$:
$$u = \\frac{-1 + \\sqrt{1 + 4(${dec(Z / C, 4)})}}{2} = ${dec(1 + Y, 6)} \\implies Y = ${mpc(Y, 4)}.$$
So $Y - X = ${mpc(Y - X, 3)}$.`,
        checks: [{ label: "second investor's yield solves the equation", ok: close(C * acc(Y, 2) + C * acc(Y, 1), Z) }],
      };
    },
  },

  {
    id: "FM_TVM_CONCEPT_NAME_THE_MEASURE",
    domain: TVM,
    title: "Identifying a Measure of Interest",
    objective: "Recognise which measure of interest or discount a described quantity is.",
    difficulty: 1,
    topics: ["TIME_VALUE"],
    steps: 1,
    qualitative: true,
    soaSamples: [410, 414],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const [saver] = cast(rng);
      const kind = rng.choice(["EFF_I", "EFF_D", "NOM_I", "FORCE", "V"] as const);
      const m = rng.choice([4, 12]);
      const x = gridRate(rng, 0.03, 0.08, 0.005);
      // Every other measure is derived from the effective rate the story implies.
      const i =
        kind === "EFF_I" ? x
        : kind === "EFF_D" ? x / (1 - x)
        : kind === "NOM_I" ? nomToEff(x, m)
        : kind === "FORCE" ? Math.exp(x) - 1
        : 1 / (1 - x) - 1;
      const measures = {
        EFF_I: { label: "Annual effective interest rate", value: i },
        EFF_D: { label: "Annual effective discount rate", value: i / (1 + i) },
        NOM_I: { label: `Annual nominal interest rate convertible ${frequency(m)}`, value: m * (Math.pow(1 + i, 1 / m) - 1) },
        NOM_D: { label: `Annual nominal discount rate convertible ${frequency(m)}`, value: m * (1 - Math.pow(1 + i, -1 / m)) },
        FORCE: { label: "Force of interest", value: Math.log(1 + i) },
        V: { label: "Discount factor", value: 1 / (1 + i) },
      } as const;
      const start = gridAmount(rng, 2000, 20000, 500);
      const story =
        kind === "EFF_I"
          ? `At the beginning of a year, ${saver} deposits ${n(start)} into a savings account that credits interest ${frequency(m)}. The balance at the end of the year is ${amt(start * (1 + x))}.`
          : kind === "EFF_D"
            ? `At the beginning of a year, ${saver} deposits money into a savings account. By the end of the year the account has been credited ${amt(start * x)} of interest and holds ${n(start)}.`
            : kind === "NOM_I"
              ? `${saver}'s savings account credits interest equal to ${pc(x / m, 4)} of the balance at the end of every ${m === 4 ? "quarter" : "month"}.`
              : kind === "FORCE"
                ? `The balance of ${saver}'s account $t$ years after it is opened is $${mn(start)}e^{${dec(x, 3).replace(/0+$/, "")}t}$.`
                : `A payment of ${n(start)} due one year from now has a present value today of ${amt(start * (1 - x))}.`;
      const shown = kind === "V" ? dec(1 - x, 3).replace(/0+$/, "") : pc(x);
      const keyLabel = measures[kind].label;
      const others = rng
        .shuffle(Object.keys(measures).filter((key) => key !== kind) as (keyof typeof measures)[])
        .slice(0, 4);
      const describe = (key: keyof typeof measures) =>
        key === "V" ? dec(measures[key].value, 4) : pc(measures[key].value, 3);
      return {
        kind: "CHOICE",
        questionText: `${story}\nDetermine which annual quantity exactly equals ${shown}.`,
        variables: { x, m, kind },
        choices: [
          { text: keyLabel, isCorrect: true, explanation: "Matches the definition." },
          ...others.map((key) => ({
            text: measures[key].label,
            isCorrect: false,
            type: "NOMINAL_RATE_ERROR" as const,
            explanation: `Here the ${measures[key].label.toLowerCase()} is ${describe(key)}, not ${shown}.`,
          })),
        ],
        solutionSteps: `**Step 1 — Read the quantity from the definition.** ${
          kind === "EFF_I"
            ? `Interest over the year divided by the balance at the start is $${mamt(start * x)}/${mn(start)} = ${mpc(x)}$: the annual effective interest rate, however often interest is credited within the year.`
            : kind === "EFF_D"
              ? `Interest over the year divided by the balance at the end is $${mamt(start * x)}/${mn(start)} = ${mpc(x)}$: the annual effective discount rate $d = I/A(1)$.`
              : kind === "NOM_I"
                ? `Crediting ${pc(x / m, 4)} each ${m === 4 ? "quarter" : "month"} is a nominal rate of $${m} \\times ${mpc(x / m, 4)} = ${mpc(x)}$ convertible ${frequency(m)}.`
                : kind === "FORCE"
                  ? `A balance of the form $Ce^{\\delta t}$ grows at the constant force of interest $\\delta = ${dec(x, 3)}$.`
                  : `The present value of 1 due in one year is $v = ${dec(1 - x, 3)}$: the discount factor.`
        }\n\n**Step 2 — Compare with the other measures.** The equivalent effective interest rate is ${pc(i, 3)}; the other measures differ from ${shown}.`,
      };
    },
  },

  {
    id: "FM_TVM_CONCEPT_PRESENT_VALUE_ORDERING",
    domain: TVM,
    title: "Ordering Present Values under Simple and Compound Interest and Discount",
    objective: "Compare amounts invested under simple and compound interest and simple and compound discount.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 2,
    qualitative: true,
    soaSamples: [247],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const short = rng.next() < 0.3;
      const t = short ? 0.5 : rng.int(2, 5);
      const rate = gridRate(rng, 0.02, 0.09, 0.01);
      const Q = 1 / (1 + rate * t);
      const R = Math.pow(1 + rate, -t);
      const S = 1 - rate * t;
      const T = Math.pow(1 - rate, t);
      const values = { Q, R, S, T };
      const order = (Object.keys(values) as (keyof typeof values)[])
        .sort((a, b) => values[a] - values[b])
        .join(" < ");
      const pool = [
        "Q < R < S < T",
        "R < Q < S < T",
        "S < T < R < Q",
        "T < S < Q < R",
        "T < S < R < Q",
        "S < T < Q < R",
        "R < Q < T < S",
        "Q < R < T < S",
      ].filter((item) => item !== order);
      const span = short ? "six months" : `${word(t)} years`;
      return {
        kind: "CHOICE",
        questionText: `Let $0\\% < i < 10\\%$. The amount that must be invested to accumulate to $Y$ at the end of ${span} at an annual rate of:
i) simple interest of $i$ is $Q$
ii) compound interest of $i$ is $R$
iii) simple discount of $i$ is $S$
iv) compound discount of $i$ is $T$
Determine which of the following is true.`,
        variables: { t, rate },
        choices: [
          { text: order, isCorrect: true, explanation: "Matches the four present values." },
          ...rng.shuffle(pool).slice(0, 4).map((text) => ({
            text,
            isCorrect: false,
            type: "SIMPLE_INTEREST_ERROR" as const,
            explanation: `Not the order of the present values, which is ${order}.`,
          })),
        ],
        solutionSteps: `**Step 1 — Write each amount for $Y = 1$.** Over $t = ${short ? "0.5" : t}$ years:
$$Q = \\frac{1}{1 + ${short ? "0.5" : t}i}, \\quad R = (1+i)^{-${short ? "0.5" : t}}, \\quad S = 1 - ${short ? "0.5" : t}i, \\quad T = (1-i)^{${short ? "0.5" : t}}.$$

**Step 2 — Compare.** ${
          short
            ? "For a term shorter than a year, simple interest accumulates faster than compound interest, so $Q < R$; simple discount removes less than compound discount, so $T < S$."
            : "For a term longer than a year, compound interest accumulates faster than simple interest, so $R < Q$; compound discount removes less than simple discount, so $S < T$."
        } Any compound-discount present value is below the matching compound-interest one because $1 - i < (1+i)^{-1}$. At $i = ${mpc(rate)}$: $Q = ${dec(Q, 4)}$, $R = ${dec(R, 4)}$, $S = ${dec(S, 4)}$, $T = ${dec(T, 4)}$, so **${order}**.`,
        checks: [
          { label: "long terms order as S < T < R < Q", ok: short || order === "S < T < R < Q" },
          { label: "short terms order as T < S < Q < R", ok: !short || order === "T < S < Q < R" },
        ],
      };
    },
  },

  {
    id: "FM_TVM_CONCEPT_RATE_EXPRESSION",
    domain: TVM,
    title: "Choosing an Equivalent-Rate Expression",
    objective: "Select the expression that converts between measures of interest, discount and inflation.",
    difficulty: 2,
    topics: ["TIME_VALUE"],
    steps: 1,
    qualitative: true,
    soaSamples: [186, 402],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const j = gridRate(rng, 0.04, 0.12, 0.01);
      const [payments, conversions] = rng.choice([
        [12, 4],
        [4, 12],
        [2, 4],
        [12, 2],
        [4, 2],
      ] as const);
      const periodRate = `\\left(1 + \\frac{${dec(j, 2)}}{${conversions}}\\right)^{${fraction(conversions, payments)}} - 1`;
      const items = [
        {
          stem: `You are given an annual effective interest rate $i$, an annual effective real rate of interest $i'$ and an annual rate of inflation $r$.\nDetermine $i$ in terms of $i'$ and $r$.`,
          correct: "$i' + r + i'r$",
          wrong: ["$i' + r$", "$i' + r - i'r$", "$\\frac{i' - r}{1 + r}$", "$(1 + i')(1 - r) - 1$"],
          why: "Money growth must cover both real growth and inflation: $1 + i = (1 + i')(1 + r)$.",
        },
        {
          stem: `A company makes a payment at the end of each ${payments === 12 ? "month" : payments === 4 ? "quarter" : "six months"} into a savings account that credits ${nom(j, conversions)}.\nDetermine the equivalent effective rate of interest per payment period.`,
          correct: `$${periodRate}$`,
          wrong: [
            `$\\frac{${dec(j, 2)}}{${payments}}$`,
            `$\\left(1 + \\frac{${dec(j, 2)}}{${conversions}}\\right)^{${fraction(payments, conversions)}} - 1$`,
            `$\\left(1 + \\frac{${dec(j, 2)}}{${conversions}}\\right)^{${conversions}} - 1$`,
            `$\\left(1 + \\frac{${dec(j, 2)}}{${payments}}\\right)^{${payments}} - 1$`,
            `$\\frac{${dec(j, 2)}}{${conversions}}$`,
          ],
          why: `One payment period is $${conversions}/${payments}$ of a conversion period's worth of compounding: $(1 + j/${conversions})^{${conversions}/${payments}}$ per payment period.`,
        },
        {
          stem: "Determine the annual effective discount rate $d$ in terms of the annual effective interest rate $i$.",
          correct: "$\\frac{i}{1+i}$",
          wrong: ["$\\frac{i}{1-i}$", "$1 - i$", "$\\frac{1}{1+i}$", "$i(1+i)$"],
          why: "Discount is interest measured against the end-of-year amount: $d = i/(1+i) = iv$.",
        },
        {
          stem: "Determine the force of interest $\\delta$ in terms of the annual effective discount rate $d$.",
          correct: "$-\\ln(1 - d)$",
          wrong: ["$\\ln(1 + d)$", "$\\ln(1 - d)$", "$\\frac{d}{1 - d}$", "$-\\ln d$"],
          why: "Since $v = 1 - d$ and $v = e^{-\\delta}$, $\\delta = -\\ln(1 - d)$.",
        },
        {
          stem: "Determine the annual nominal interest rate convertible $m$ times per year, $i^{(m)}$, in terms of the force of interest $\\delta$.",
          correct: "$m\\left(e^{\\delta/m} - 1\\right)$",
          wrong: ["$m\\left(e^{m\\delta} - 1\\right)$", "$e^{\\delta} - 1$", "$\\frac{\\delta}{m}$", "$e^{\\delta/m} - 1$"],
          why: "$\\left(1 + i^{(m)}/m\\right)^m = e^{\\delta}$, so $i^{(m)}/m = e^{\\delta/m} - 1$.",
        },
        {
          stem: "Determine the annual effective interest rate $i$ in terms of the annual nominal discount rate convertible $m$ times per year, $d^{(m)}$.",
          correct: "$\\left(1 - \\frac{d^{(m)}}{m}\\right)^{-m} - 1$",
          wrong: [
            "$\\left(1 + \\frac{d^{(m)}}{m}\\right)^{m} - 1$",
            "$1 - \\left(1 - \\frac{d^{(m)}}{m}\\right)^{m}$",
            "$\\left(1 - \\frac{d^{(m)}}{m}\\right)^{-1/m} - 1$",
            "$\\frac{d^{(m)}}{1 - d^{(m)}}$",
          ],
          why: "A nominal discount rate grows 1 by $(1 - d^{(m)}/m)^{-1}$ each $m$-th of a year.",
        },
      ];
      const item = rng.choice(items);
      // Some frequency pairs make two wrong forms coincide (4 payments against
      // semiannual conversion gives (1 + j/2)^2 twice), so keep distinct ones.
      const wrong = item.wrong.filter((text, k) => text !== item.correct && item.wrong.indexOf(text) === k).slice(0, 4);
      return {
        kind: "CHOICE",
        questionText: item.stem,
        variables: { j, payments, conversions },
        choices: [
          { text: item.correct, isCorrect: true, explanation: item.why },
          ...wrong.map((text) => ({
            text,
            isCorrect: false,
            type: "NOMINAL_RATE_ERROR" as const,
            explanation: `Does not follow from the definitions. ${item.why}`,
          })),
        ],
        solutionSteps: `**Step 1 — Start from the defining relationship.** ${item.why}\n\n**Step 2 — Rearrange.** The matching expression is ${item.correct}.`,
      };
    },
  },
];
