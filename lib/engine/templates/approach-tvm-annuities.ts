/**
 * Solution-approach bank — Time Value of Money and Annuities.
 *
 * Each template reaches its answer by a route the rest of the bank does not
 * use: the growth factor as the unit of time, a ratio of interest amounts,
 * the (Ia) + (Da) identity, the reciprocal a/s identity, and a quadratic
 * hidden in a perpetuity split.
 */
import { an, Ia, sn } from "../finance";
import type { DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { explain, round2, routeVisual } from "./approach-kit";
import { MONEY2, amt, chain, dec, distractor, features, gridAmount, gridRate, lit, mamt, mnum, ord, shown, step, sumOf } from "./kit";

const L = lit;

// ===================================================================== TVM — the growth factor as the unit

const powerUnit: QuestionTemplate = {
  id: "apx-tvm-power-unit",
  family: "apx-tvm-power-unit",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value", "ANNUITIES.perpetuities"],
  reasoning: ["translation", "algebra", "cashflow_modelling", "financial_intuition"],
  soaConcept: "Payments spaced exactly as far apart as a stated growth period, valued with that growth factor as the unit — the annual rate is never needed.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const n = level === 3 ? rng.choice([6, 8, 10, 12]) : rng.choice([5, 6, 8, 10, 12]);
    const k = rng.choice([1.5, 1.6, 1.75, 1.8, 2, 2.25, 2.5]);
    const D = gridAmount(rng, 1000, 5000, 500);
    const DK = D * k;
    const R = gridAmount(rng, 1000, 10000, 500);
    const i = Math.pow(k, 1 / n) - 1;
    const u = 1 / k;
    const kE = `(${L(DK)}/${L(D)})`;
    const iE = `(${kE}**(1/${n})-1)`;
    const half = n / 2;

    let answer: number;
    let calc: string;
    let model: string;
    let ask: string;
    const distractors: DistractorCandidate[] = [];
    const iS = (k - 1) / n;
    if (level === 1) {
      answer = R * (u + u * u + u * u * u);
      calc = `${L(R)}*(1/${kE} + 1/${kE}**2 + 1/${kE}**3)`;
      model = sumOf([1, 2, 3].map((j) => `${L(R)}*(1+${iE})**(-${j * n})`));
      ask = `Payments of ${amt(R)} are to be made at the end of years ${n}, ${2 * n} and ${3 * n}. Calculate the present value of these payments at the same rate.`;
      const vP = R / (k - 1);
      distractors.push(
        distractor("FORMULA_PERPETUITY_FOR_FINITE", vP, `${L(R)}/(${kE}-1)`, {
          derivation: `$\\dfrac{${mamt(R)}}{${dec(k, 2)} - 1} = ${shown(vP, fmt)}$`,
          method: "Valued the three payments as a perpetuity payable every n years.",
          feedback: "Only three payments are made. Sum $v^{n} + v^{2n} + v^{3n}$ — a finite geometric series — rather than the infinite one.",
        })
      );
      const aAnn = (R * (1 - Math.pow(1 + i, -3))) / i;
      distractors.push(
        distractor("RATE_ANNUAL_FOR_PERIODIC", aAnn, `${L(R)}*(1-(1+${iE})**(-3))/${iE}`, {
          derivation: `$${mamt(R)}\\,a_{\\overline{3|}\\,i},\\ i = ${dec(i, 6)}$; $= ${shown(aAnn, fmt)}$`,
          method: "Valued the payments as a three-year annuity at the annual rate, as if they were one year apart.",
          feedback: `The payments are ${n} years apart, so each one is discounted by a further $v^{${n}} = 1/${dec(k, 2)}$, not by one year's $v$.`,
        })
      );
      const vX = R * (u * u + u * u * u + u * u * u * u);
      distractors.push(
        distractor("TIMING_EXTRA_PERIOD", vX, `${L(R)}*(1/${kE}**2 + 1/${kE}**3 + 1/${kE}**4)`, {
          derivation: `$${mamt(R)}\\left(x^{2} + x^{3} + x^{4}\\right),\\ x = 1/${dec(k, 2)}$; $= ${shown(vX, fmt)}$`,
          method: `Discounted the first payment by ${2 * n} years instead of ${n}.`,
          feedback: `The first payment is at year ${n}: its discount factor is $v^{${n}} = 1/${dec(k, 2)}$.`,
        })
      );
      const vD = R * [1, 2, 3].reduce((a, j) => a + Math.pow(1 + iS, -j * n), 0);
      distractors.push(
        distractor("RATE_DIVIDED_EFFECTIVE", vD, sumOf([1, 2, 3].map((j) => `${L(R)}*(1+(${kE}-1)/${n})**(-${j * n})`)), {
          derivation: `$i \\approx (${dec(k, 2)} - 1)/${n} = ${dec(iS, 6)}$; $\\sum ${mamt(R)}(1+i)^{-${n}j} = ${shown(vD, fmt)}$`,
          method: `Spread the ${n}-year growth evenly over the years to get an annual rate.`,
          feedback: "Compound growth is not spread evenly: the annual rate is $k^{1/n} - 1$. Better still, never compute it — the payments only need $v^n = 1/k$.",
        })
      );
      const vV = 3 * R * u;
      distractors.push(
        distractor("TIMING_VALUATION_DATE", vV, `3*${L(R)}/${kE}`, {
          derivation: `$3 \\times ${mamt(R)} / ${dec(k, 2)} = ${shown(vV, fmt)}$`,
          method: `Discounted all three payments as if they were made at year ${n}.`,
          feedback: "Each payment is discounted from its own date: the later two need $v^{2n}$ and $v^{3n}$.",
        })
      );
    } else if (level === 2) {
      answer = R / (k - 1);
      calc = `${L(R)}/(${kE}-1)`;
      model = sumOf(Array.from({ length: 80 }, (_, j) => `${L(R)}*(1+${iE})**(-${(j + 1) * n})`));
      ask = `A perpetuity pays ${amt(R)} at the end of every ${n} years, the first payment at the end of year ${n}. Calculate its present value at the same rate.`;
      const vDue = (R * k) / (k - 1);
      distractors.push(
        distractor("TIMING_IMMEDIATE_AS_DUE", vDue, `${L(R)}*${kE}/(${kE}-1)`, {
          derivation: `$\\dfrac{${mamt(R)}}{1 - 1/${dec(k, 2)}} = ${shown(vDue, fmt)}$`,
          method: "Started the geometric series at time 0, as if the first payment were made today.",
          feedback: `The first payment is at year ${n}: the series is $${mamt(R)}(x + x^{2} + \\cdots) = ${mamt(R)}\\,x/(1-x)$ with $x = v^{${n}}$.`,
        })
      );
      const vA = R / i;
      distractors.push(
        distractor("RATE_ANNUAL_FOR_PERIODIC", vA, `${L(R)}/${iE}`, {
          derivation: `$${mamt(R)}/i,\\ i = ${dec(i, 6)}$; $= ${shown(vA, fmt)}$`,
          method: "Used the annual perpetuity factor 1/i for payments made every n years.",
          feedback: `$1/i$ values payments of 1 every year. For payments every ${n} years the effective rate per payment period is $(1+i)^{${n}} - 1 = ${dec(k - 1, 2)}$.`,
        })
      );
      const vX = R / (k * (k - 1));
      distractors.push(
        distractor("TIMING_EXTRA_PERIOD", vX, `${L(R)}/(${kE}*(${kE}-1))`, {
          derivation: `$\\dfrac{${mamt(R)}}{${dec(k, 2)}(${dec(k, 2)} - 1)} = ${shown(vX, fmt)}$`,
          method: `Discounted the perpetuity's value by a further ${n} years.`,
          feedback: `$R/(k-1)$ already sits at time 0 (one payment interval before the first payment). No further discount is needed.`,
        })
      );
      const vD = R / (Math.pow(1 + iS, n) - 1);
      distractors.push(
        distractor("RATE_DIVIDED_EFFECTIVE", vD, `${L(R)}/((1+(${kE}-1)/${n})**${n}-1)`, {
          derivation: `$i \\approx ${dec(iS, 6)}$; $${mamt(R)}/\\left((1+i)^{${n}} - 1\\right) = ${shown(vD, fmt)}$`,
          method: `Spread the ${n}-year growth evenly to get an annual rate, then compounded it back.`,
          feedback: `The ${n}-year growth factor is given exactly: $(1+i)^{${n}} = ${dec(k, 2)}$. Dividing the growth by ${n} and compounding again overstates it.`,
        })
      );
    } else {
      answer = (R * k * Math.sqrt(k)) / (k - 1);
      calc = `${L(R)}*${kE}/(${kE}-1)*${kE}**0.5`;
      model = sumOf(Array.from({ length: 80 }, (_, j) => `${L(R)}*(1+${iE})**(${half - j * n})`));
      ask = `A perpetuity pays ${amt(R)} every ${n} years, the first payment today. Calculate the value of all its payments at the end of year ${half}, at the same rate.`;
      const pv0 = (R * k) / (k - 1);
      distractors.push(
        distractor("TIMING_VALUATION_DATE", pv0, `${L(R)}*${kE}/(${kE}-1)`, {
          derivation: `$\\dfrac{${mamt(R)}}{1 - 1/${dec(k, 2)}} = ${shown(pv0, fmt)}$`,
          method: "Stopped at the value today.",
          feedback: `The question asks for the value at year ${half}: move the time-0 value forward by $(1+i)^{${half}} = \\sqrt{${dec(k, 2)}}$.`,
        })
      );
      const vEx = (R * Math.sqrt(k)) / (k - 1);
      distractors.push(
        distractor("CONC_TVM_PAST_PAYMENT_EXCLUDED", vEx, `${L(R)}*${kE}**0.5/(${kE}-1)`, {
          derivation: `$${mamt(R)}\\sqrt{${dec(k, 2)}}/(${dec(k, 2)} - 1) = ${shown(vEx, fmt)}$`,
          method: `Left out the payment made today because it is before year ${half}.`,
          feedback: `A value at year ${half} includes earlier payments accumulated to that date; today's payment is worth ${amt(R)}$\\sqrt{k}$ there.`,
        })
      );
      const vS = pv0 * (1 + (k - 1) / 2);
      distractors.push(
        distractor("MODEL_COMPOUND_AS_SIMPLE", vS, `${L(R)}*${kE}/(${kE}-1)*(1+(${kE}-1)/2)`, {
          derivation: `$${mnum(pv0, 2)}\\left(1 + \\tfrac{${dec(k, 2)} - 1}{2}\\right) = ${shown(vS, fmt)}$`,
          method: `Took half of the ${n}-year growth for half the period.`,
          feedback: `Compound growth for half the period is the square root of the full factor: $\\sqrt{${dec(k, 2)}} = ${dec(Math.sqrt(k), 6)}$, not $1 + (${dec(k, 2)} - 1)/2$.`,
        })
      );
      const vA = ((R * (1 + i)) / i) * Math.pow(1 + i, half);
      distractors.push(
        distractor("RATE_ANNUAL_FOR_PERIODIC", vA, `${L(R)}*(1+${iE})/${iE}*(1+${iE})**${half}`, {
          derivation: `$${mamt(R)}\\,\\ddot a_{\\overline{\\infty|}}(1+i)^{${half}},\\ i = ${dec(i, 6)}$; $= ${shown(vA, fmt)}$`,
          method: "Valued the payments as an annual perpetuity-due.",
          feedback: `Payments are ${n} years apart; the rate per payment interval is $k - 1 = ${dec(k - 1, 2)}$.`,
        })
      );
      const vR = (R * k * k) / (2 * (k - 1));
      distractors.push(
        distractor("ALG_ROOT_ERROR", vR, `${L(R)}*${kE}/(${kE}-1)*${kE}/2`, {
          derivation: `$${mnum(pv0, 2)} \\times ${dec(k, 2)}/2 = ${shown(vR, fmt)}$`,
          method: "Halved the growth factor for half the period instead of taking its square root.",
          feedback: `$(1+i)^{${half}} = \\left((1+i)^{${n}}\\right)^{1/2} = \\sqrt{${dec(k, 2)}}$.`,
        })
      );
    }

    const steps = [
      step("A.discount-factor", `The stated growth gives the ${n}-year discount factor directly: $x = v^{${n}} = 1/k$.`, ["x", u, `v^${n}`], ["deposit", "accumulated value"], { rearranged: true }),
    ];
    if (level === 3) {
      steps.push(step("B.geometric-series", "Value the perpetuity-due as a geometric series in x.", ["PV_0", (R * k) / (k - 1), "value today"], ["R", "x"]));
      steps.push(step("A.compound", `Move the value forward ${half} years: half the ${n}-year growth is $\\sqrt{k}$.`, ["V", answer, `value at year ${half}`], ["PV_0", "k"], { valuationDate: `${half}` }));
    } else {
      steps.push(step("B.geometric-series", "Sum the discounted payments as a geometric series in x.", ["PV", answer, "present value"], ["R", "x"]));
    }

    const chainSpec = chain(steps, {
      methods: ["substitution", "geometric_series"],
      reasoning: `Never compute the annual rate: payments every ${n} years only need $x = v^{${n}} = 1/k$, read straight from the stated growth.`,
      unconventional: true,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, d.misconception.startsWith("TIMING_VALUATION") || d.misconception === "CONC_TVM_PAST_PAYMENT_EXCLUDED" || d.misconception === "MODEL_COMPOUND_AS_SIMPLE" || d.misconception === "ALG_ROOT_ERROR" ? Math.min(2, steps.length - 1) : d.misconception.startsWith("RATE") ? 0 : 1])),
    });

    return {
      stem: `At a constant annual effective rate of interest, a deposit of ${amt(D)} accumulates to ${amt(DK)} at the end of ${n} years.\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$x = 1/${dec(k, 2)}$; value $= ${shown(answer, fmt)}$` },
      model: { expr: model, description: `Every payment discounted term by term at the annual rate $(${dec(k, 2)})^{1/${n}} - 1$.` },
      distractors,
      explanation: explain({
        intuition: `The payments are exactly ${n} years apart — the same span as the growth you are told about. So measure time in ${n}-year blocks: one block multiplies money by ${dec(k, 2)}, and the annual rate never has to be found.`,
        unknowns: [{ symbol: "$x$", meaning: `$v^{${n}}$, the discount factor for one ${n}-year block` }],
        relationships: [`$(1+i)^{${n}} = ${mamt(DK)}/${mamt(D)} = ${dec(k, 2)}$`, `$x = 1/${dec(k, 2)}$`],
        conditions: ["The same constant rate applies throughout."],
        valuationDate: level === 3 ? `Year ${half}` : "Time 0",
        modelChoice: "A geometric series whose ratio is the block discount factor.",
        assumptions: ["Annual effective rate constant for all periods."],
        solution: [
          { title: "Block discount factor", body: `$x = v^{${n}} = ${mamt(D)}/${mamt(DK)} = ${dec(u, 6)}$` },
          level === 1
            ? { title: "Three payments", body: `$${mamt(R)}(x + x^{2} + x^{3}) = ${shown(answer, fmt)}$` }
            : level === 2
              ? { title: "Perpetuity in blocks", body: `$${mamt(R)}\\dfrac{x}{1-x} = \\dfrac{${mamt(R)}}{${dec(k, 2)} - 1} = ${shown(answer, fmt)}$` }
              : { title: "Perpetuity-due, then half a block forward", body: `$\\dfrac{${mamt(R)}}{1-x}\\sqrt{${dec(k, 2)}} = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Through the annual rate",
          body: `$i = ${dec(k, 2)}^{1/${n}} - 1 = ${dec(i, 6)}$ and discount every payment — same answer, many more keystrokes and rounding risk.`,
          whenUseful: "Only if the payment spacing did not match the growth period.",
        },
        principle: "When payments are spaced by the period whose growth you are given, use that growth factor as the unit of time.",
        unusual: "No interest rate is stated, and none needs to be computed.",
        misread: "A rate per n-year block is not an annual rate: annual-rate annuity factors do not apply to payments n years apart.",
      }),
      visuals: [routeVisual(chainSpec, "Route: growth factor as the unit", "The annual rate is never computed.")],
      markers: [u, answer],
      presentation: level === 3 ? ["hidden-structure", "valuation-date"] : ["hidden-structure"],
      features: features({ steps: level === 3 ? 4 : 3, unfamiliar: true, multipleValuationDates: level === 3 }),
      params: { n, k, D, R, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== TVM — interest amounts in two different years

const interestRatio: QuestionTemplate = {
  id: "apx-tvm-interest-ratio",
  family: "apx-tvm-interest-ratio",
  topic: "TVM",
  levels: [1, 2, 3],
  objective: "TVM.simple_compound",
  secondary: ["TVM.present_future_value", "TVM.equation_of_value"],
  reasoning: ["translation", "algebra", "financial_intuition"],
  soaConcept: "The amounts of interest credited in two different years reveal the rate (their ratio) and then the deposit (by working back from one of them).",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const X = gridAmount(rng, 2000, 20000, 500);
    const a = level === 1 ? rng.int(3, 6) : rng.int(2, 6);
    const g = level === 1 ? 1 : rng.int(2, 5);
    const b = a + g;
    const c = b + rng.int(2, 6);
    const Ia_ = round2(X * Math.pow(1 + i, a - 1) * i);
    const Ib_ = round2(X * Math.pow(1 + i, b - 1) * i);
    const iR = Math.pow(Ib_ / Ia_, 1 / g) - 1;
    const XR = Ia_ / (iR * Math.pow(1 + iR, a - 1));
    const iE = `((${L(Ib_)}/${L(Ia_)})**(1/${g})-1)`;
    const depositOf = (r: number) => Ia_ / (r * Math.pow(1 + r, a - 1));
    const depositE = (r: string) => `${L(Ia_)}/(${r}*(1+${r})**(${a - 1}))`;
    const atC = level === 3;
    const grow = (dep: number, r: number) => (atC ? dep * Math.pow(1 + r, c) : dep);
    const growE = (dep: string, r: string) => (atC ? `(${dep})*(1+${r})**${c}` : dep);
    const answer = grow(XR, iR);
    const calc = growE(depositE(iE), iE);
    const model = growE(`${L(Ia_)}/((1+${iE})**${a} - (1+${iE})**${a - 1})`, iE);

    const distractors: DistractorCandidate[] = [];
    if (g >= 2) {
      const iW = Ib_ / Ia_ - 1;
      const vW = grow(depositOf(iW), iW);
      const iWE = `(${L(Ib_)}/${L(Ia_)}-1)`;
      distractors.push(
        distractor("ALG_ROOT_ERROR", vW, growE(depositE(iWE), iWE), {
          derivation: `$i = ${dec(Ib_ / Ia_, 6)} - 1 = ${dec(iW, 6)}$; $= ${shown(vW, fmt)}$`,
          method: `Took the ratio minus one as the annual rate, forgetting it spans ${g} years.`,
          feedback: `$I_{${b}}/I_{${a}} = (1+i)^{${g}}$: take the ${g === 2 ? "square" : `${ord(g)}`} root before subtracting one.`,
        })
      );
      const iA = (Ib_ / Ia_ - 1) / g;
      const vA = grow(depositOf(iA), iA);
      const iAE = `((${L(Ib_)}/${L(Ia_)}-1)/${g})`;
      distractors.push(
        distractor("SEQ_GEOMETRIC_AS_ARITHMETIC", vA, growE(depositE(iAE), iAE), {
          derivation: `$i = (${dec(Ib_ / Ia_, 6)} - 1)/${g} = ${dec(iA, 6)}$; $= ${shown(vA, fmt)}$`,
          method: `Divided the total growth of the interest amounts evenly over ${g} years.`,
          feedback: "Interest amounts grow geometrically (each year's balance earns on the last year's interest), so the yearly factor is a root, not an average.",
        })
      );
    }
    const vX = grow(XR / (1 + iR), iR);
    distractors.push(
      distractor("TIMING_EXTRA_PERIOD", vX, growE(`${L(Ia_)}/(${iE}*(1+${iE})**${a})`, iE), {
        derivation: `$\\dfrac{${mnum(Ia_, 2)}}{i(1+i)^{${a}}}${atC ? `(1+i)^{${c}}` : ""} = ${shown(vX, fmt)}$`,
        method: `Treated the interest of year ${a} as earned on the balance at the end of year ${a}.`,
        feedback: `Interest credited during year ${a} is earned on the balance at the start of year ${a}, which has grown for ${a - 1} years: $I_{${a}} = X(1+i)^{${a - 1}}i$.`,
      })
    );
    const vI = grow(Ia_ / iR, iR);
    distractors.push(
      distractor("TIMING_IGNORED_DEFERRAL", vI, growE(`${L(Ia_)}/${iE}`, iE), {
        derivation: `$${mnum(Ia_, 2)}/${dec(iR, 6)}${atC ? `\\,(1+i)^{${c}}` : ""} = ${shown(vI, fmt)}$`,
        method: "Divided the interest by the rate, as if it were earned on the original deposit.",
        feedback: `That gives the balance at the start of year ${a}, not the deposit: discount it by a further $(1+i)^{${a - 1}}$.`,
      })
    );
    if (!atC) {
      const vD = (XR * (1 + iR));
      distractors.push(
        distractor("RATE_DISCOUNT_AS_INTEREST", vD, `${depositE(iE)}*(1+${iE})`, {
          derivation: `$d = i/(1+i)$; $\\dfrac{${mnum(Ia_, 2)}}{d(1+i)^{${a - 1}}} = ${shown(vD, fmt)}$`,
          method: "Divided the year's interest by the discount rate instead of the interest rate.",
          feedback: "Interest earned in a year is $i$ times the opening balance (or $d$ times the closing balance). Mixing the two misplaces the deposit by one year.",
        })
      );
      const vT = XR * Math.pow(1 + iR, a);
      distractors.push(
        distractor("VAR_TOTAL_FOR_COMPONENT", vT, `${depositE(iE)}*(1+${iE})**${a}`, {
          derivation: `$X(1+i)^{${a}} = ${shown(vT, fmt)}$`,
          method: `Reported the balance at the end of year ${a} rather than the deposit.`,
          feedback: "The question asks for the amount deposited at time 0.",
        })
      );
    } else {
      const vM = XR * (1 + c * iR);
      distractors.push(
        distractor("MODEL_COMPOUND_AS_SIMPLE", vM, `${depositE(iE)}*(1+${c}*${iE})`, {
          derivation: `$X(1 + ${c}i) = ${shown(vM, fmt)}$`,
          method: `Grew the deposit to year ${c} with simple interest.`,
          feedback: "The fund credits compound interest: interest earned in one year earns interest in the next.",
        })
      );
      distractors.push(
        distractor("VAR_OTHER_UNKNOWN", XR, depositE(iE), {
          derivation: `$X = ${shown(XR, fmt)}$`,
          method: "Stopped at the deposit.",
          feedback: `The question asks for the balance at the end of year ${c}: accumulate the deposit.`,
        })
      );
    }

    const steps = [
      step("A.effective-interest", `Consecutive years' interest grows by $1+i$, so $I_{${b}}/I_{${a}} = (1+i)^{${g}}$.`, ["i", iR, "annual effective rate"], ["I_a", "I_b"], { rearranged: true }),
      step("A.compound", `Interest in year ${a} is $i$ times the opening balance $X(1+i)^{${a - 1}}$.`, ["X", XR, "deposit"], ["I_a", "i"], { rearranged: true }),
    ];
    if (atC) steps.push(step("A.compound", `Accumulate the deposit to the end of year ${c}.`, ["A", answer, `balance at year ${c}`], ["X", "i"], { valuationDate: `${c}` }));
    const chainSpec = chain(steps, {
      methods: g >= 2 ? ["elimination", "rearrangement"] : ["rearrangement"],
      reasoning: "The ratio of two interest amounts eliminates the deposit and isolates the rate; one interest amount then gives the deposit.",
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, ["ALG_ROOT_ERROR", "SEQ_GEOMETRIC_AS_ARITHMETIC"].includes(d.misconception) ? 0 : ["TIMING_MISSING_PERIOD", "VAR_OTHER_UNKNOWN"].includes(d.misconception) ? steps.length - 1 : 1])),
    });

    return {
      stem: `A single deposit is made at time 0 into a fund that credits interest at a constant annual effective rate. The amount of interest credited during year ${a} is ${amt(Ia_)}, and the amount credited during year ${b} is ${amt(Ib_)}.\n\n${atC ? `Calculate the fund balance at the end of year ${c}.` : "Calculate the amount deposited."}`,
      answer: { value: answer, calc, format: fmt, derivation: `$i = ${dec(iR, 6)}$; $= ${shown(answer, fmt)}$` },
      model: { expr: model, description: `Interest in year ${a} is the change in balance over that year: $X\\left[(1+i)^{${a}} - (1+i)^{${a - 1}}\\right]$.` },
      distractors,
      explanation: explain({
        intuition: "Each year's interest is the previous year's interest times $1+i$ — interest amounts form a geometric sequence. Two of them pin down the ratio, and the ratio is the rate. The deposit never has to be guessed.",
        unknowns: [
          { symbol: "$i$", meaning: "annual effective rate" },
          { symbol: "$X$", meaning: "deposit at time 0" },
        ],
        relationships: [`$I_t = X(1+i)^{t-1}\\,i$`, `$I_{${b}}/I_{${a}} = (1+i)^{${g}}$`],
        conditions: ["No deposits or withdrawals after time 0."],
        valuationDate: atC ? `End of year ${c}` : "Time 0",
        modelChoice: "Compound interest; interest in year t is earned on the opening balance of year t.",
        assumptions: ["The rate is the same in every year."],
        solution: [
          { title: "Rate from the ratio", body: `$(1+i)^{${g}} = ${mnum(Ib_, 2)}/${mnum(Ia_, 2)} \\Rightarrow i = ${dec(iR, 6)}$` },
          { title: "Deposit", body: `$X = \\dfrac{${mnum(Ia_, 2)}}{i(1+i)^{${a - 1}}} = ${atC ? mnum(XR, 2) : shown(answer, fmt)}$` },
          ...(atC ? [{ title: `Balance at year ${c}`, body: `$X(1+i)^{${c}} = ${shown(answer, fmt)}$` }] : []),
        ],
        alternative: {
          name: "Interest as the change in balance",
          body: `Write $I_{${a}} = A(${a}) - A(${a - 1})$ and solve for $X$ once $i$ is known — the same equation, written from the definition of interest.`,
          whenUseful: "When unsure which balance a year's interest is earned on.",
        },
        principle: "A ratio of two quantities that share an unknown factor eliminates it.",
        unusual: "Neither the rate nor the deposit is given — only two interest amounts.",
        misread: `Interest credited during year ${a} is earned on the balance at the start of that year, after ${a - 1} years of growth.`,
      }),
      visuals: [routeVisual(chainSpec, "Route: ratio, then work back", "Eliminate the deposit first.")],
      markers: [iR, XR],
      presentation: g >= 2 ? ["unknown-rate", "hidden-structure"] : ["unknown-rate", "work-backwards"],
      features: features({ steps: atC ? 4 : 3, unfamiliar: true }),
      params: { i, X, a, b, c, Ia: Ia_, Ib: Ib_, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Annuities — the (Ia) + (Da) identity

const iaDaIdentity: QuestionTemplate = {
  id: "apx-ann-ia-da",
  family: "apx-ann-ia-da",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.level_payment", "ANNUITIES.non_level"],
  reasoning: ["concept_recognition", "cashflow_modelling", "formula_reconstruction"],
  soaConcept: "A decreasing annuity valued from an increasing one and a level one at an unstated rate: the two streams add to a level stream every year.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const P = gridAmount(rng, 100, 1000, 50);
    const n = rng.int(8, 20);
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const V2 = round2(P * an(n, i));
    const V1 = round2(P * Ia(n, i));
    const q = rng.choice([2, 3, 5]);
    const Q = q * P;
    const W = (n + 1) * V2 - V1;
    const WE = `(${n + 1}*${L(V2)} - ${L(V1)})`;

    let answer: number;
    let calc: string;
    let ask: string;
    const distractors: DistractorCandidate[] = [];
    if (level === 2) {
      answer = P * (n + 1) - (P * V1) / V2;
      calc = `${L(P)}*${n + 1} - ${L(P)}*${L(V1)}/${L(V2)}`;
      ask = `At the same rate, an annuity-immediate pays ${amt(n * P)} at the end of year 1, ${amt((n - 1) * P)} at the end of year 2, and so on, decreasing by ${amt(P)} a year to ${amt(P)} at the end of year ${n}. Calculate the level annual payment of an ${n}-year annuity-immediate with the same present value.`;
      const vT = P * n - (P * V1) / V2;
      distractors.push(
        distractor("SEQ_TERM_COUNT", vT, `${L(P)}*${n} - ${L(P)}*${L(V1)}/${L(V2)}`, {
          derivation: `$${n}P - P\\,\\dfrac{${mnum(V1, 2)}}{${mnum(V2, 2)}} = ${shown(vT, fmt)}$`,
          method: `Paired the streams to a level ${n}P instead of ${n + 1}P.`,
          feedback: `In year $t$ the decreasing stream pays $(${n + 1} - t)P$ and the increasing one $tP$: together $${n + 1}P$.`,
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", (P * (n + 1)) / 2, `${L(P)}*${n + 1}/2`, {
          derivation: `$\\tfrac{${n + 1}}{2} \\times ${mamt(P)} = ${shown((P * (n + 1)) / 2, fmt)}$`,
          method: "Used the average payment, ignoring when the payments are made.",
          feedback: "The large payments come first, so the equivalent level payment is above the simple average.",
        }),
        distractor("FORMULA_DECREASING_FOR_INCREASING", (P * V1) / V2, `${L(P)}*${L(V1)}/${L(V2)}`, {
          derivation: `$P\\,\\dfrac{${mnum(V1, 2)}}{${mnum(V2, 2)}} = ${shown((P * V1) / V2, fmt)}$`,
          method: "Found the level equivalent of the increasing annuity instead.",
          feedback: "The given increasing value is only a stepping stone: the decreasing stream is the level $(n+1)P$ stream minus the increasing one.",
        }),
        distractor("VAR_OTHER_UNKNOWN", W, WE, {
          derivation: `$${n + 1}(${mnum(V2, 2)}) - ${mnum(V1, 2)} = ${shown(W, fmt)}$`,
          method: "Reported the present value of the decreasing annuity.",
          feedback: "The question asks for the level payment with that present value: divide by $a_{\\overline{n|}} = V/P$.",
        }),
        distractor("ALG_INVERTED_RATIO", P * (n + 1) - (P * V2) / V1, `${L(P)}*${n + 1} - ${L(P)}*${L(V2)}/${L(V1)}`, {
          derivation: `$${n + 1}P - P\\,\\dfrac{${mnum(V2, 2)}}{${mnum(V1, 2)}} = ${shown(P * (n + 1) - (P * V2) / V1, fmt)}$`,
          method: "Inverted the ratio of the two given values.",
          feedback: "The level equivalent of the increasing annuity is $P\\,(Ia)/a$, not $P\\,a/(Ia)$.",
        })
      );
    } else {
      const extra = level === 3 ? q * V2 : 0;
      answer = W + extra;
      calc = level === 3 ? `${WE} + ${q}*${L(V2)}` : WE;
      ask =
        level === 3
          ? `At the same rate, an annuity-immediate pays ${amt(n * P + Q)} at the end of year 1, ${amt((n - 1) * P + Q)} at the end of year 2, and so on, decreasing by ${amt(P)} a year to ${amt(P + Q)} at the end of year ${n}. Calculate its present value.`
          : `At the same rate, an annuity-immediate pays ${amt(n * P)} at the end of year 1, ${amt((n - 1) * P)} at the end of year 2, and so on, decreasing by ${amt(P)} a year to ${amt(P)} at the end of year ${n}. Calculate its present value.`;
      const plus = (v: number) => v + extra;
      const plusE = (e: string) => (level === 3 ? `${e} + ${q}*${L(V2)}` : e);
      distractors.push(
        distractor("SEQ_TERM_COUNT", plus(n * V2 - V1), plusE(`${n}*${L(V2)} - ${L(V1)}`), {
          derivation: `$${n}(${mnum(V2, 2)}) - ${mnum(V1, 2)}${level === 3 ? ` + ${q}(${mnum(V2, 2)})` : ""} = ${shown(plus(n * V2 - V1), fmt)}$`,
          method: `Paired the streams to a level ${n}P instead of ${n + 1}P.`,
          feedback: `In year $t$ the two streams pay $(${n + 1} - t)P + tP = ${n + 1}P$.`,
        }),
        distractor("FORMULA_DECREASING_FOR_INCREASING", plus(V1), plusE(L(V1)), {
          derivation: `$${mnum(V1, 2)}${level === 3 ? ` + ${q}(${mnum(V2, 2)})` : ""} = ${shown(plus(V1), fmt)}$`,
          method: "Used the increasing annuity's value for the decreasing one.",
          feedback: "The decreasing stream front-loads the payments, so it is worth more than the increasing one at any positive rate.",
        }),
        distractor("ALLOC_EVEN_SPLIT", plus(((n + 1) * V2) / 2), plusE(`${n + 1}*${L(V2)}/2`), {
          derivation: `$\\tfrac12(${n + 1})(${mnum(V2, 2)})${level === 3 ? ` + ${q}(${mnum(V2, 2)})` : ""} = ${shown(plus(((n + 1) * V2) / 2), fmt)}$`,
          method: "Split the combined level stream's value equally between the increasing and decreasing parts.",
          feedback: "The parts are not equal in value: the decreasing part pays more early, so it takes the larger share.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", plus((n + 1) * V2), plusE(`${n + 1}*${L(V2)}`), {
          derivation: `$${n + 1}(${mnum(V2, 2)})${level === 3 ? ` + ${q}(${mnum(V2, 2)})` : ""} = ${shown(plus((n + 1) * V2), fmt)}$`,
          method: "Stopped at the combined level stream without removing the increasing part.",
          feedback: "The level $(n+1)P$ stream is decreasing plus increasing: subtract the increasing annuity's value.",
        })
      );
      if (level === 3) {
        distractors.push(
          distractor("TRANS_IGNORED_CONDITION", W, WE, {
            derivation: `$${n + 1}(${mnum(V2, 2)}) - ${mnum(V1, 2)} = ${shown(W, fmt)}$`,
            method: `Left out the level ${amt(Q)} included in every payment.`,
            feedback: `Each payment is ${amt(Q)} more than the pure decreasing pattern: add $${q} \\times ${mnum(V2, 2)}$.`,
          })
        );
      } else {
        distractors.push(
          distractor("ALG_SIGN_ERROR", (n + 1) * V2 + V1, `${n + 1}*${L(V2)} + ${L(V1)}`, {
            derivation: `$${n + 1}(${mnum(V2, 2)}) + ${mnum(V1, 2)} = ${shown((n + 1) * V2 + V1, fmt)}$`,
            method: "Added the increasing annuity instead of subtracting it.",
            feedback: "Decreasing = level $(n+1)P$ − increasing.",
          })
        );
      }
    }

    const steps = [
      step("B.increasing", `Pair year by year: the decreasing and increasing payments add to $${n + 1}P$ every year.`, ["(n+1)P", (n + 1) * P, "combined level payment"], ["P", "n"], { derived: true }),
      step("B.annuity-immediate", `The combined stream is a level annuity worth $${n + 1}$ times the given level value.`, ["V_level", (n + 1) * V2, "value of the combined stream"], ["V_2"]),
      step("B.decreasing", "Subtract the increasing annuity's value.", ["V_D", W, "value of the decreasing annuity"], ["V_level", "V_1"]),
    ];
    if (level === 2) steps.push(step("B.annuity-immediate", "Divide by the level annuity factor $a_{\\overline{n|}} = V_2/P$.", ["X", answer, "equivalent level payment"], ["V_D", "V_2", "P"], { rearranged: true }));
    if (level === 3) steps.push(step("B.annuity-immediate", `Add the level ${amt(Q)} part, worth $${q}$ times the level value.`, ["V", answer, "present value"], ["V_D", "V_2"]));
    const chainSpec = chain(steps, {
      methods: ["decomposition", "substitution"],
      reasoning: "Decreasing + increasing = level: $(Da)_{\\overline{n|}} + (Ia)_{\\overline{n|}} = (n+1)a_{\\overline{n|}}$, so the rate is never needed.",
      unconventional: true,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, d.misconception === "SEQ_TERM_COUNT" ? 0 : ["VAR_OTHER_UNKNOWN", "TRANS_IGNORED_CONDITION", "ALG_INVERTED_RATIO", "SEQ_UNDISCOUNTED_SUM"].includes(d.misconception) ? steps.length - 1 : 2])),
    });

    return {
      stem: `At a certain annual effective rate of interest, the present value of an annuity-immediate paying ${amt(P)} at the end of each year for ${n} years is ${amt(V2)}, and the present value of an annuity-immediate paying ${amt(P)}, ${amt(2 * P)}, ${amt(3 * P)}, …, ${amt(n * P)} at the end of years 1, 2, 3, …, ${n} is ${amt(V1)}.\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$${n + 1}(${mnum(V2, 2)}) - ${mnum(V1, 2)}${level === 3 ? ` + ${q}(${mnum(V2, 2)})` : ""}$; $= ${shown(answer, fmt)}$` },
      model: {
        expr: level === 2 ? `(${L(V2)}*${n + 1} - ${L(V1)})*${L(P)}/${L(V2)}` : level === 3 ? `${L(V2)}*${n + 1 + q} - ${L(V1)}` : `${L(V2)}*${n + 1} - ${L(V1)}`,
        description: "Year by year the decreasing payments plus the increasing payments form a level stream.",
      },
      distractors,
      explanation: explain({
        intuition: `Stack the two streams: in year 1 they pay $${n}P + P$, in year 2 $(${n - 1})P + 2P$, … — always $${n + 1}P$. So the decreasing annuity is a level annuity minus the increasing one, and both of those values are given. The rate never appears.`,
        unknowns: [{ symbol: "$V_D$", meaning: "present value of the decreasing annuity" }],
        relationships: [`$(Da)_{\\overline{${n}|}} = ${n + 1}\\,a_{\\overline{${n}|}} - (Ia)_{\\overline{${n}|}}$`],
        conditions: ["All three annuities are valued at the same rate and are annuities-immediate."],
        valuationDate: "Time 0",
        modelChoice: "Decompose: decreasing = level − increasing.",
        assumptions: ["Same annual effective rate for every stream."],
        solution: [
          { title: "Level stream", body: `$${n + 1} \\times ${mnum(V2, 2)} = ${mnum((n + 1) * V2, 2)}$` },
          { title: "Remove the increasing part", body: `$${mnum((n + 1) * V2, 2)} - ${mnum(V1, 2)} = ${level === 1 ? shown(answer, fmt) : mnum(W, 2)}$` },
          ...(level === 2 ? [{ title: "Level equivalent", body: `$${mnum(W, 2)} \\times \\dfrac{${mamt(P)}}{${mnum(V2, 2)}} = ${shown(answer, fmt)}$` }] : []),
          ...(level === 3 ? [{ title: "Add the level part", body: `$${mnum(W, 2)} + ${q} \\times ${mnum(V2, 2)} = ${shown(answer, fmt)}$` }] : []),
        ],
        alternative: {
          name: "Find the rate first",
          body: `Solve $${mamt(P)}\\,a_{\\overline{${n}|}} = ${mnum(V2, 2)}$ for $i$ on a calculator, then value $(Da)_{\\overline{${n}|}}$ directly — much slower and it needs a root-finder.`,
          whenUseful: "Only when the identity is not available.",
        },
        principle: "Look for streams that add up to something simple before reaching for the rate.",
        unusual: "The rate is not given and is not needed.",
        misread: `The pairing gives ${n + 1}P, not ${n}P: the first decreasing payment is ${n}P and the first increasing one is P.`,
      }),
      visuals: [routeVisual(chainSpec, "Route: decreasing = level − increasing", "No interest rate is computed.")],
      markers: [(n + 1) * V2, W],
      presentation: ["hidden-structure"],
      features: features({ steps: level === 1 ? 3 : 4, unfamiliar: true }),
      params: { P, n, V1, V2, q, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Annuities — the reciprocal identity

const reciprocal: QuestionTemplate = {
  id: "apx-ann-reciprocal",
  family: "apx-ann-reciprocal",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.perpetuities", "TVM.equation_of_value"],
  reasoning: ["formula_reconstruction", "algebra", "concept_recognition"],
  soaConcept: "The present and accumulated values of one level annuity (term not stated) give the rate through 1/a − 1/s = i.",
  generate(rng, level): QuestionDraft {
    const R = gridAmount(rng, 500, 5000, 100);
    const n = rng.int(10, 25);
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const X = round2(R * an(n, i));
    const Y = round2(R * sn(n, i));
    const iR = R / X - R / Y;
    const iE = `(${L(R)}/${L(X)} - ${L(R)}/${L(Y)})`;
    const fmt = level === 3 ? ({ kind: "time", decimals: 2, unit: "years" } as const) : MONEY2;
    const distractors: DistractorCandidate[] = [];
    let answer: number;
    let calc: string;
    let model: string;
    let ask: string;
    const iS = R / X + R / Y;
    const iSE = `(${L(R)}/${L(X)} + ${L(R)}/${L(Y)})`;

    if (level === 1) {
      answer = R / iR;
      calc = `${L(R)}/${iE}`;
      model = `1/(1/${L(X)} - 1/${L(Y)})`;
      ask = `At the same rate, calculate the present value of a perpetuity-immediate paying ${amt(R)} at the end of each year.`;
      distractors.push(
        distractor("ALG_SIGN_ERROR", R / iS, `${L(R)}/${iSE}`, {
          derivation: `$i = \\tfrac{R}{X} + \\tfrac{R}{Y} = ${dec(iS, 6)}$; $R/i = ${shown(R / iS, fmt)}$`,
          method: "Added the two reciprocals instead of subtracting them.",
          feedback: "$\\frac{1}{a_{\\overline{n|}}} = \\frac{1}{s_{\\overline{n|}}} + i$, so $i$ is the difference.",
        }),
        distractor("VAR_OTHER_UNKNOWN", R / (Y / X - 1), `${L(R)}/(${L(Y)}/${L(X)}-1)`, {
          derivation: `$Y/X - 1 = ${dec(Y / X - 1, 6)}$ as $i$; $= ${shown(R / (Y / X - 1), fmt)}$`,
          method: "Took Y/X − 1 as the annual rate.",
          feedback: `$Y/X = (1+i)^{n}$ — growth over the whole (unstated) term, not one year.`,
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", R / iR + R, `${L(R)}/${iE} + ${L(R)}`, {
          derivation: `$R/i + R = ${shown(R / iR + R, fmt)}$`,
          method: "Valued a perpetuity-due.",
          feedback: "Payments at the end of each year: $R/i$ with no extra payment today.",
        }),
        distractor("FORMULA_PERPETUITY_FOR_FINITE", X, L(X), {
          derivation: `$${shown(X, fmt)}$`,
          method: "Took the finite annuity's value as the perpetuity's.",
          feedback: "A perpetuity continues after the annuity's last payment, so it is worth more.",
        })
      );
    } else if (level === 2) {
      const f = Math.pow(1 + iR, 2) - 1;
      answer = R / f;
      calc = `${L(R)}/((1+${iE})**2-1)`;
      model = sumOf(Array.from({ length: 450 }, (_, j) => `${L(R)}*(1+${iE})**(-${2 * (j + 1)})`));
      ask = `At the same rate, calculate the present value of a perpetuity paying ${amt(R)} at the end of every second year, the first payment at the end of year 2.`;
      distractors.push(
        distractor("RATE_ANNUAL_FOR_PERIODIC", R / iR, `${L(R)}/${iE}`, {
          derivation: `$R/i = ${shown(R / iR, fmt)}$`,
          method: "Used the annual perpetuity factor for payments two years apart.",
          feedback: `Use the two-year rate $(1+i)^2 - 1 = ${dec(f, 6)}$.`,
        }),
        distractor("RATE_DIVIDED_EFFECTIVE", R / (2 * iR), `${L(R)}/(2*${iE})`, {
          derivation: `$R/(2i) = ${shown(R / (2 * iR), fmt)}$`,
          method: "Doubled the annual rate to get a two-year rate.",
          feedback: "Two years of compound interest is $(1+i)^2 - 1 = 2i + i^2$.",
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", (R * (f + 1)) / f, `${L(R)}*(1+${iE})**2/((1+${iE})**2-1)`, {
          derivation: `$R(1+i)^2/\\left((1+i)^2 - 1\\right) = ${shown((R * (f + 1)) / f, fmt)}$`,
          method: "Included a payment today.",
          feedback: "The first payment is at the end of year 2.",
        }),
        distractor("ALG_SIGN_ERROR", R / (Math.pow(1 + iS, 2) - 1), `${L(R)}/((1+${iSE})**2-1)`, {
          derivation: `$i = ${dec(iS, 6)}$; $= ${shown(R / (Math.pow(1 + iS, 2) - 1), fmt)}$`,
          method: "Added the two reciprocals instead of subtracting them.",
          feedback: "$i = \\frac{1}{a_{\\overline{n|}}} - \\frac{1}{s_{\\overline{n|}}}$.",
        })
      );
    } else {
      answer = Math.log(Y / X) / Math.log(1 + iR);
      calc = `log(${L(Y)}/${L(X)})/log(1+${iE})`;
      model = `(1+${iE})**x - ${L(Y)}/${L(X)}`;
      ask = "Calculate the term of the annuity.";
      const vF = Math.log(Y / X) / iR;
      distractors.push(
        distractor("RATE_FORCE_AS_EFFECTIVE", vF, `log(${L(Y)}/${L(X)})/${iE}`, {
          derivation: `$\\ln(Y/X)/i = ${shown(vF, fmt)}$`,
          method: "Divided by i instead of by ln(1 + i).",
          feedback: "$(1+i)^n = Y/X$ gives $n = \\ln(Y/X)/\\ln(1+i)$; dividing by $i$ treats $i$ as a force of interest.",
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", (Y / X - 1) / iR, `(${L(Y)}/${L(X)}-1)/${iE}`, {
          derivation: `$(Y/X - 1)/i = ${shown((Y / X - 1) / iR, fmt)}$`,
          method: "Solved 1 + ni = Y/X, as if interest were simple.",
          feedback: "The accumulation factor over the term is $(1+i)^n$.",
        }),
        distractor("ALG_SIGN_ERROR", Math.log(Y / X) / Math.log(1 + iS), `log(${L(Y)}/${L(X)})/log(1+${iSE})`, {
          derivation: `$i = ${dec(iS, 6)}$; $n = ${shown(Math.log(Y / X) / Math.log(1 + iS), fmt)}$`,
          method: "Added the reciprocals to get the rate.",
          feedback: "$i = \\frac{1}{a_{\\overline{n|}}} - \\frac{1}{s_{\\overline{n|}}}$.",
        }),
        distractor("SEQ_TERM_COUNT", X / R, `${L(X)}/${L(R)}`, {
          derivation: `$X/R = ${shown(X / R, fmt)}$`,
          method: "Divided the present value by the payment.",
          feedback: "That is $a_{\\overline{n|}}$, which is less than $n$ at any positive rate.",
        })
      );
    }

    const steps = [step("B.reciprocal-identity", "Divide both values by R and use $1/a_{\\overline{n|}} - 1/s_{\\overline{n|}} = i$.", ["i", iR, "annual effective rate"], ["X", "Y", "R"], { rearranged: true })];
    if (level === 1) steps.push(step("B.perpetuity", "Perpetuity-immediate: payment over rate.", ["PV", answer, "perpetuity value"], ["R", "i"]));
    if (level === 2) {
      steps.push(step("A.compound", "Two-year effective rate.", ["j", Math.pow(1 + iR, 2) - 1, "two-year rate"], ["i"]));
      steps.push(step("B.perpetuity", "Perpetuity paying every two years: payment over the two-year rate.", ["PV", answer, "perpetuity value"], ["R", "j"]));
    }
    if (level === 3) {
      steps.push(step("A.compound", "$s_{\\overline{n|}}/a_{\\overline{n|}} = (1+i)^n$, so $Y/X$ is the growth over the term.", ["(1+i)^n", Y / X, "growth over the term"], ["X", "Y"], { derived: true }));
      steps.push(step("M.logarithm", "Take logarithms.", ["n", answer, "term in years"], ["(1+i)^n", "i"]));
    }
    const chainSpec = chain(steps, {
      methods: level === 3 ? ["rearrangement", "logarithms"] : ["rearrangement", "substitution"],
      reasoning: "The term is not stated, but it is not needed: $\\frac{R}{X} - \\frac{R}{Y} = i$ for any term.",
      unconventional: true,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, ["ALG_SIGN_ERROR", "VAR_OTHER_UNKNOWN"].includes(d.misconception) ? 0 : steps.length - 1])),
    });

    return {
      stem: `An annuity-immediate pays ${amt(R)} at the end of each year for a fixed number of years. At a certain annual effective rate of interest, its present value is ${amt(X)} and its accumulated value at the time of the last payment is ${amt(Y)}.\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$i = ${dec(iR, 6)}$; $= ${shown(answer, fmt)}$` },
      model: { expr: model, description: level === 3 ? "The accumulated value is the present value grown over the term." : "Payments valued from the rate implied by the two given values." },
      distractors,
      explanation: explain({
        intuition: "A loan of X repaid by R a year can be split into interest on the loan plus a level deposit that builds up to the loan: R = Xi + R·X/Y. Divide by X and the rate drops out, whatever the term.",
        unknowns: [{ symbol: "$i$", meaning: "annual effective rate" }],
        relationships: ["$\\dfrac{1}{a_{\\overline{n|}}} = \\dfrac{1}{s_{\\overline{n|}}} + i$", `$a_{\\overline{n|}} = X/R,\\ s_{\\overline{n|}} = Y/R$`],
        conditions: ["Both values are for the same annuity at the same rate."],
        valuationDate: level === 3 ? "Time 0 and the last payment date" : "Time 0",
        modelChoice: "The reciprocal identity of $a$ and $s$.",
        assumptions: ["Constant annual effective rate."],
        solution: [
          { title: "Rate", body: `$i = \\dfrac{${mamt(R)}}{${mnum(X, 2)}} - \\dfrac{${mamt(R)}}{${mnum(Y, 2)}} = ${dec(iR, 6)}$` },
          level === 1
            ? { title: "Perpetuity", body: `$${mamt(R)}/${dec(iR, 6)} = ${shown(answer, fmt)}$` }
            : level === 2
              ? { title: "Two-year perpetuity", body: `$\\dfrac{${mamt(R)}}{(1+i)^2 - 1} = ${shown(answer, fmt)}$` }
              : { title: "Term", body: `$n = \\dfrac{\\ln(${mnum(Y, 2)}/${mnum(X, 2)})}{\\ln(1+i)} = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Guess the term",
          body: "Try n = 10, 11, … and solve each for i until both values agree — slow and unnecessary.",
          whenUseful: "Never, once the identity is known.",
        },
        principle: "Two values of the same annuity give its rate without its term.",
        unusual: "The term is not stated.",
        misread: "$Y/X$ is the growth over the whole term, not $1 + i$.",
      }),
      visuals: [routeVisual(chainSpec, "Route: reciprocal identity", "The term is never needed for the rate.")],
      markers: [iR, answer],
      presentation: ["unknown-rate", "hidden-structure"],
      features: features({ steps: level === 1 ? 3 : 4, unfamiliar: true }),
      params: { R, n, X, Y, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Annuities — a perpetuity split three ways

const perpSplit: QuestionTemplate = {
  id: "apx-ann-perp-split",
  family: "apx-ann-perp-split",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.streams", "TVM.equation_of_value"],
  reasoning: ["translation", "algebra", "cashflow_modelling", "multistep"],
  soaConcept: "A perpetuity shared in consecutive blocks; a condition between two shares is a quadratic in vⁿ that reveals the rate.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const n = rng.choice([8, 10, 12, 15]);
    const k = rng.choice([1, 1.5, 2, 3]);
    const R = gridAmount(rng, 1000, 10000, 500);
    const due = level === 3;
    const xOf = (kk: number) => (-1 + Math.sqrt(1 + 4 * kk)) / (2 * kk);
    const x = xOf(k);
    const i = Math.pow(x, -1 / n) - 1;
    const fac = (r: number) => (due ? (1 + r) / r : 1 / r);
    const shareB = (r: number, xx: number) => R * fac(r) * (xx - xx * xx);
    const answer = shareB(i, x);
    const xE = `((-1+sqrt(1+4*${L(k)}))/(2*${L(k)}))`;
    const iE = `(${xE}**(-1/${n})-1)`;
    const facE = (r: string) => (due ? `(1+${r})/${r}` : `1/${r}`);
    const calc = `${L(R)}*${facE(iE)}*(${xE}-${xE}**2)`;
    const model = sumOf(Array.from({ length: n }, (_, j) => `${L(R)}*(1+${iE})**(-${n + j + (due ? 0 : 1)})`));

    const A = R * fac(i) * (1 - x);
    const C = R * fac(i) * x * x;
    const x2 = 1 / (1 + k);
    const i2 = Math.pow(x2, -1 / n) - 1;
    const x2E = `(1/(1+${L(k)}))`;
    const i2E = `(${x2E}**(-1/${n})-1)`;
    const other = due ? R * (1 / i) * (x - x * x) : R * ((1 + i) / i) * (x - x * x);
    const distractors: DistractorCandidate[] = [
      distractor("VAR_OTHER_UNKNOWN", A, `${L(R)}*${facE(iE)}*(1-${xE})`, {
        derivation: `$\\text{PV}_A = ${shown(A, fmt)}$`,
        method: "Reported A's share.",
        feedback: "The question asks for B's share — the middle block.",
      }),
      distractor("ALLOC_SWAPPED", C, `${L(R)}*${facE(iE)}*${xE}**2`, {
        derivation: `$\\text{PV}_C = ${shown(C, fmt)}$`,
        method: "Reported C's share.",
        feedback: "C receives everything after the first 2n payments; B receives payments n + 1 to 2n.",
      }),
      distractor("ALLOC_EVEN_SPLIT", (R * fac(i)) / 3, `${L(R)}*${facE(iE)}/3`, {
        derivation: `$\\tfrac13 \\times ${mnum(R * fac(i), 2)} = ${shown((R * fac(i)) / 3, fmt)}$`,
        method: "Assumed the three shares are equal.",
        feedback: `Only the stated condition links the shares; with $x = v^{${n}}$ the shares are $1-x$, $x - x^2$ and $x^2$ of the total.`,
      }),
      distractor("TIMING_IGNORED_DEFERRAL", shareB(i2, x2), `${L(R)}*${facE(i2E)}*(${x2E}-${x2E}**2)`, {
        derivation: `$1 - x = ${k === 1 ? "" : dec(k, 1)}x \\Rightarrow x = ${dec(x2, 6)}$; $= ${shown(shareB(i2, x2), fmt)}$`,
        method: `Discounted C's share by n years instead of 2n, giving a linear condition.`,
        feedback: `C's first payment is at year ${2 * n + (due ? 0 : 1)}: its share is $x^2$, so the condition is quadratic: $1 - x = ${k === 1 ? "" : dec(k, 1)}x^2$.`,
      }),
      distractor(due ? "TIMING_DUE_AS_IMMEDIATE" : "TIMING_IMMEDIATE_AS_DUE", other, `${L(R)}*${due ? `1/${iE}` : `(1+${iE})/${iE}`}*(${xE}-${xE}**2)`, {
        derivation: `$= ${shown(other, fmt)}$`,
        method: due ? "Valued the payments as if made at the end of each year." : "Valued the payments as if made at the start of each year.",
        feedback: due ? "Payments are at the start of each year: use $\\ddot a$ (multiply by $1+i$)." : "Payments are at the end of each year.",
      }),
    ];

    const steps = [
      step("B.deferred", `With $x = v^{${n}}$ the shares are $(1-x)$, $(x - x^2)$ and $x^2$ times the perpetuity; the condition gives $1 - x = ${k === 1 ? "" : dec(k, 1)}x^2$.`, ["x", x, `v^${n}`], ["k"], { derived: true }),
      step("A.discount-factor", "Recover the annual rate from $v^n = x$.", ["i", i, "annual effective rate"], ["x", "n"], { rearranged: true }),
      step("B.perpetuity", "B's share is the perpetuity's value times $x - x^2$.", ["PV_B", answer, "B's share"], ["R", "i", "x"]),
    ];
    const chainSpec = chain(steps, {
      methods: ["equation_construction", "substitution", "factorisation"],
      reasoning: "Write every share in powers of $x = v^n$; the stated condition becomes a quadratic in x.",
      unconventional: true,
      stages: { VAR_OTHER_UNKNOWN: 2, ALLOC_SWAPPED: 2, ALLOC_EVEN_SPLIT: [0, "selection"], TIMING_IGNORED_DEFERRAL: [0, "application"], TIMING_DUE_AS_IMMEDIATE: 2, TIMING_IMMEDIATE_AS_DUE: 2 },
    });
    const cond = k === 1 ? "equal to" : `${dec(k, 1).replace(/\.0$/, "")} times`;

    return {
      stem: `A perpetuity pays ${amt(R)} at the ${due ? "beginning" : "end"} of each year. Its payments are divided among three charities: A receives the first ${n} payments, B receives the next ${n} payments, and C receives all remaining payments. At the annual effective rate used, the present value of A's share is ${cond} the present value of C's share.\n\nCalculate the present value of B's share.`,
      answer: { value: answer, calc, format: fmt, derivation: `$x = ${dec(x, 6)},\\ i = ${dec(i, 6)}$; $= ${shown(answer, fmt)}$` },
      model: { expr: model, description: `B's ${n} payments discounted one by one at the implied rate.` },
      distractors,
      explanation: explain({
        intuition: `Each block of ${n} payments is the previous block shifted ${n} years later, so it is worth $x = v^{${n}}$ times as much. A gets $1-x$ of the total, B gets $x(1-x)$, C gets $x^2$. One condition between two shares is one equation in $x$.`,
        unknowns: [
          { symbol: "$x$", meaning: `$v^{${n}}$` },
          { symbol: "$i$", meaning: "annual effective rate" },
        ],
        relationships: [`$\\text{PV}_A : \\text{PV}_B : \\text{PV}_C = (1-x) : (x - x^2) : x^2$`, `$1 - x = ${k === 1 ? "" : dec(k, 1)}x^2$`],
        conditions: ["Payments are level and continue forever."],
        valuationDate: "Time 0",
        modelChoice: "Express the shares through a single power of v and solve the resulting quadratic.",
        assumptions: ["One annual effective rate values all shares."],
        solution: [
          { title: "Quadratic in x", body: `$${k === 1 ? "" : dec(k, 1)}x^2 + x - 1 = 0 \\Rightarrow x = ${dec(x, 6)}$` },
          { title: "Rate", body: `$i = x^{-1/${n}} - 1 = ${dec(i, 6)}$` },
          { title: "B's share", body: `$${mamt(R)}\\,${due ? "\\tfrac{1+i}{i}" : "\\tfrac{1}{i}"}\\,(x - x^2) = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Shares as fractions first",
          body: "B's fraction of the total is $x - x^2$, which follows from the quadratic alone; only the total needs the rate.",
          whenUseful: "When a question asks for a share as a percentage — then no rate is needed at all.",
        },
        principle: "Blocks of a level stream are scaled copies of each other: powers of $v^n$.",
        unusual: "The rate is hidden in a condition between two shares.",
        misread: `C's share starts after ${2 * n} payments, so it carries $x^2$, not $x$.`,
      }),
      visuals: [routeVisual(chainSpec, "Route: shares as powers of vⁿ", "A quadratic gives vⁿ, then the rate.")],
      markers: [x, i, answer],
      presentation: ["hidden-structure", "unknown-rate"],
      features: features({ steps: 4, unfamiliar: true, multiConcept: true }),
      params: { n, k, R, level },
      chain: chainSpec,
    };
  },
};

export const APPROACH_TVM_ANNUITY_TEMPLATES: QuestionTemplate[] = [powerUnit, interestRatio, iaDaIdentity, reciprocal, perpSplit];
