/**
 * Elite (level 4) time-value-of-money templates: variable and piecewise
 * forces of interest set against nominal discount rates, real-rate chains
 * through two inflation regimes, and quadratic equations of value with
 * penalties — each with several cases (situation, unknown and route).
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import { MONEY2, dec, gridAmount, gridRate, mnum, pc, step, drawUntil, amt } from "./kit";
import { K, X, add, at, div, elite, exp, fromNominal, fromNominalDiscount, ln, mul, pick, pow, nameOf, sub, twoNames, type Eq, type Trap } from "./elite-kit";

const YEARS2: AnswerFormat = { kind: "number", decimals: 2 };
const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const pct = (x: number) => pc(x, 3);

// ===================================================================== 1. Linear force against a nominal discount rate

const forceSwitch: QuestionTemplate = {
  id: "el-tvm-force-switch",
  family: "el-tvm-force-switch",
  topic: "TVM",
  levels: [4],
  objective: "TVM.variable_force",
  secondary: ["TVM.discount_rates", "TVM.force_of_interest", "TVM.equation_of_value"],
  reasoning: ["formula_selection", "algebra", "multistep", "translation"],
  soaConcept: "Two funds, one under a varying force of interest and one under a nominal discount rate, compared through their accumulation functions.",
  generate(rng): QuestionDraft {
    const m = pick(rng, [2, 4, 12]);
    const d = gridRate(rng, 0.03, 0.07, 0.0025);
    const a = gridRate(rng, 0.01, 0.025, 0.0025);
    const b = pick(rng, [0.002, 0.0025, 0.003, 0.004, 0.005]);
    const dB = -m * Math.log(1 - d / m);
    const iB = Math.pow(1 - d / m, -m) - 1;
    const kase = pick(rng, ["catch-up", "relay"]);
    const [A, B] = twoNames(rng);

    if (kase === "catch-up") {
      const s = pick(rng, [1, 2, 3]);
      const PA = gridAmount(rng, 1000, 5000, 100);
      const { PB, T } = drawUntil(
        () => {
          const PB = Math.round((PA * Math.exp(dB * s) * (1.05 + rng.next() * 0.25)) / 10) * 10;
          const c = Math.log(PA / PB) + dB * s;
          const T = (-(a - dB) + Math.sqrt((a - dB) ** 2 - 2 * b * c)) / b;
          return { PB, T, c };
        },
        (r) => r.c < 0 && r.T > s + 2 && r.T < 40 && Math.log(PA) + a * s + (b * s * s) / 2 < Math.log(r.PB)
      );
      // log-difference of the two funds as a function of the time x, for a given force of fund B and an integration rule
      const eqWith = (dBx: number, integrate: boolean, startAt: number, extra = 0): Eq => ({
        eq: (x: X) =>
          add(ln(PA), mul(a, x), mul(integrate ? b / 2 : b, x, x), mul(-1, add(ln(PB), mul(dBx, sub(x, startAt)))), extra),
        lo: 0.05,
        hi: 80,
      });
      const correct = eqWith(dB, true, s);
      const traps: Trap[] = [
        { id: "RATE_DISCOUNT_AS_INTEREST", value: eqWith(m * Math.log(1 + d / m), true, s), label: "nominal discount used as nominal interest", method: `Took ${pct(d)} as a nominal interest rate convertible ${m} times a year.`, feedback: `It is a nominal discount rate: $1 + i = (1 - d^{(${m})}/${m})^{-${m}}$.` },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: eqWith(-Math.log(1 - d), true, s), label: "nominal discount used as annual effective discount", method: `Used ${pct(d)} as the annual effective discount rate.`, feedback: `Convert the nominal rate per ${m === 12 ? "month" : m === 4 ? "quarter" : "half-year"} first.` },
        { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: eqWith(dB, false, s), label: "force multiplied by time instead of integrated", method: `Accumulated ${A}'s fund by $e^{\\delta_T T}$.`, feedback: "A varying force must be integrated: $\\int_0^T (a + bt)\\,dt = aT + bT^2/2$." },
        { id: "TIMING_VALUATION_DATE", value: eqWith(dB, true, 0), label: "second fund accumulated from time zero", method: `Accumulated ${B}'s deposit from time 0.`, feedback: `${B}'s deposit is made at time ${s} and earns interest only from then.` },
        { id: "VAR_OTHER_UNKNOWN", value: { eq: (x: X) => correct.eq(add(x, s)), lo: 0.05, hi: 80 }, label: "time measured from the second deposit", method: `Measured the time from ${B}'s deposit.`, feedback: "The question asks for the time measured from the first deposit (time 0)." },
      ];
      const T_closed = div(add(mul(-1, sub(a, dB)), pow(sub(pow(sub(a, dB), 2), mul(2, b, add(ln(PA / PB), mul(dB, s)))), 0.5)), b);
      return elite({
        stem: `${A} deposits ${amt(PA)} into Fund X at time $t = 0$. Fund X credits interest at the force of interest $\\delta_t = ${dec(a, 4)} + ${dec(b, 4)}t$ for all $t \\ge 0$.\n\n${B} deposits ${amt(PB)} into Fund Y at time $t = ${s}$. Fund Y credits interest at a nominal annual rate of discount of ${pct(d)} convertible ${m === 12 ? "monthly" : m === 4 ? "quarterly" : "semiannually"}.\n\nCalculate the time $t$, in years, at which the two funds first have equal value.`,
        fmt: YEARS2,
        answer: T_closed,
        model: { eq: (x: X) => sub(mul(PA, exp(add(mul(a, x), mul(b / 2, x, x)))), mul(PB, pow(sub(1, d / m), mul(-m, sub(x, s))))), lo: s + 0.01, hi: 80 },
        modelDescription: "Value of Fund X (exponential of the integrated force) minus value of Fund Y (discount factors per conversion period), solved for the time.",
        traps,
        steps: [
          step("A.nominal-equivalence", `Annual effective rate of Fund Y from the nominal discount rate.`, ["i_Y", iB, "Fund Y annual effective rate"], ["d^(m)"]),
          step("A.constant-force", "Fund Y's constant force of interest.", ["\\delta_Y", dB, "Fund Y force of interest"], ["i_Y"]),
          step("A.force-accumulation", "Integrate Fund X's force from 0 to t.", ["\\int\\delta", a * T + (b * T * T) / 2, "integrated force of Fund X at the answer"], ["a", "b"]),
          step("A.equation-of-value", "Equate the logarithms of the two fund values: a quadratic in t.", ["c", Math.log(PA / PB) + dB * s, "constant term of the quadratic"], ["P_X", "P_Y", "\\delta_Y"], { derived: true }),
          step("M.root-finding", "Take the root later than Fund Y's deposit.", ["t", T, "time of equal value"], ["quadratic"], { rearranged: true }),
        ],
        methods: ["equation_construction", "logarithms", "factorisation"],
        reasoning: "Write both accumulation functions, take logarithms so the exponents become a quadratic in t, and keep the root after the second deposit.",
        intuition: `Fund Y starts larger but later; Fund X's force grows linearly, so it eventually catches up. Logarithms turn "equal values" into "equal integrated forces plus log-deposits".`,
        unknowns: [{ symbol: "$t$", meaning: "time at which the funds are equal" }],
        relationships: [`$\\ln ${mnum(PA, 0)} + ${dec(a, 4)}t + ${dec(b / 2, 5)}t^2 = \\ln ${mnum(PB, 0)} + \\delta_Y (t - ${s})$`, `$\\delta_Y = -${m}\\ln(1 - d^{(${m})}/${m})$`],
        conditions: [`Fund Y earns interest only from time ${s}.`, "Both funds are left untouched."],
        valuationDate: "The unknown time t",
        modelChoice: "Two accumulation functions equated; logarithms give a quadratic.",
        assumptions: ["Interest is credited continuously in the sense of the stated force and conversion frequency."],
        alternative: { name: "Graph the log-difference", body: "Tabulate the difference of the logarithms of the two fund values at a few integer t and interpolate.", whenUseful: "As a check on which root of the quadratic is meaningful." },
        principle: "Under a varying force the accumulation factor is the exponential of the integrated force; a nominal discount rate converts to a constant force.",
        unusual: "The rate of Fund Y is given as a nominal discount rate, and Fund Y starts later.",
        misread: "Multiplying the force at t by t instead of integrating it.",
        presentation: ["unknown-time", "mixed-timing", "frequency", "rearrange-first"],
        features: { multipleValuationDates: true },
        params: { kase, PA, PB, s, a, b, d, m },
        route: "convert, integrate, equate logs, solve quadratic",
      });
    }

    // relay: forward accumulation through a force regime, a withdrawal and a discount-rate regime
    const P = gridAmount(rng, 2000, 9000, 100);
    const T1 = rng.int(4, 8);
    const N = T1 + rng.int(4, 9);
    const u = T1 + rng.int(1, N - T1 - 1);
    const aT = Math.exp(a * T1 + (b * T1 * T1) / 2);
    const W = Math.round((P * aT * (0.15 + rng.next() * 0.25)) / 10) * 10;
    const Q = gridAmount(rng, 500, 4000, 100);
    const name = nameOf(rng);
    const valueWith = (opts: { dRate?: number; integrate?: boolean; withdraw?: boolean; single?: boolean; qFrom?: number }) => {
      const dm = opts.dRate ?? dB;
      const phase1 = opts.integrate === false ? exp(mul(add(a, mul(b, T1)), T1)) : exp(add(mul(a, T1), mul(b / 2, T1 * T1)));
      if (opts.single) {
        const fx = (t: number) => exp(add(mul(a, t), mul(b / 2, t * t)));
        return add(mul(sub(mul(P, phase1), W), div(fx(N), fx(T1))), mul(Q, div(fx(N), fx(opts.qFrom ?? u))));
      }
      return add(mul(sub(mul(P, phase1), opts.withdraw === false ? 0 : W), exp(mul(dm, N - T1))), mul(Q, exp(mul(dm, N - (opts.qFrom ?? u)))));
    };
    const ans = valueWith({});
    const iY = fromNominalDiscount(d, m);
    return elite({
      stem: `${name} deposits ${amt(P)} into an account at time $t = 0$. For $0 \\le t \\le ${T1}$ the account credits interest at the force of interest $\\delta_t = ${dec(a, 4)} + ${dec(b, 4)}t$. From time ${T1} onward it credits interest at a nominal annual rate of discount of ${pct(d)} convertible ${m === 12 ? "monthly" : m === 4 ? "quarterly" : "semiannually"}.\n\nAt time ${T1}, immediately after the rate basis changes, ${name} withdraws ${amt(W)}. At time ${u}, ${name} deposits ${amt(Q)}.\n\nCalculate the value of the account at time ${N}.`,
      fmt: MONEY2,
      answer: ans,
      model: add(mul(P, exp(add(mul(a, T1), mul(b / 2, T1 * T1))), pow(sub(1, d / m), -m * (N - T1))), mul(-W, pow(sub(1, d / m), -m * (N - T1))), mul(Q, pow(sub(1, d / m), -m * (N - u)))),
      modelDescription: "Each cash flow carried to time N: the deposit through both regimes, the withdrawal and the later deposit through the discount-rate regime only.",
      traps: [
        { id: "RATE_DISCOUNT_AS_INTEREST", value: valueWith({ dRate: m * Math.log(1 + d / m) }), label: "discount rate used as interest rate", method: `Accumulated at a nominal interest rate of ${pct(d)}.`, feedback: `The second regime is a nominal discount rate: $(1 - ${dec(d / m, 6)})^{-${m}}$ per year.` },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: valueWith({ dRate: -Math.log(1 - d) }), label: "nominal discount used as effective", method: `Used ${pct(d)} as an annual effective discount rate.`, feedback: `Convert per conversion period: $1 + i = (1 - d^{(${m})}/${m})^{-${m}} = ${dec(iB, 6)}$.` },
        { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: valueWith({ integrate: false }), label: "force times time", method: `Used $e^{\\delta_{${T1}} \\cdot ${T1}}$ for the first regime.`, feedback: "Integrate the force over the first regime." },
        { id: "TRANS_IGNORED_CONDITION", value: valueWith({ withdraw: false }), label: "withdrawal ignored", method: "Left out the withdrawal.", feedback: `The withdrawal of ${amt(W)} at time ${T1} stops earning interest.` },
        { id: "MODEL_SINGLE_RATE", value: valueWith({ single: true }), label: "first force kept to the end", method: "Kept the linear force after the switch.", feedback: `From time ${T1} the account uses the discount-rate basis.` },
        { id: "TIMING_VALUATION_DATE", value: valueWith({ qFrom: T1 }), label: "later deposit dated at the switch", method: `Accumulated the ${amt(Q)} deposit from time ${T1}.`, feedback: `That deposit is made at time ${u}.` },
      ],
      steps: [
        step("A.force-accumulation", `Accumulation factor over the first ${T1} years.`, ["a(T_1)", aT, `accumulation to time ${T1}`], ["a", "b"]),
        step("A.nominal-equivalence", "Annual effective rate of the second regime.", ["i", iY.v, "annual effective rate after the switch"], ["d^(m)"]),
        step("A.accumulation", `Fund just after the withdrawal, carried to time ${N}.`, ["F_1", (P * aT - W) * at(iY, N - T1).v, "deposit net of withdrawal at the end"], ["P", "W", "i"]),
        step("A.accumulation", `The deposit at time ${u}, carried to time ${N}.`, ["F_2", Q * at(iY, N - u).v, "later deposit at the end"], ["Q", "i"]),
        step("A.equation-of-value", "Add the pieces.", ["F", ans.v, `account value at time ${N}`], ["F_1", "F_2"]),
      ],
      methods: ["decomposition", "valuation_dates"],
      reasoning: `Cut the timeline at the change of basis (time ${T1}); integrate the force before it, convert the discount rate after it, and carry each cash flow only over the time it is actually invested.`,
      intuition: "Each regime moves money only across its own stretch of time; every cash flow travels from its own date.",
      unknowns: [{ symbol: `$F_{${N}}$`, meaning: `account value at time ${N}` }],
      relationships: [`$a(${T1}) = e^{${dec(a, 4)}\\cdot ${T1} + ${dec(b / 2, 5)}\\cdot ${T1 * T1}}$`, `$(1+i) = (1 - ${dec(d / m, 6)})^{-${m}}$`],
      conditions: [`Withdrawal at time ${T1}, deposit at time ${u}.`],
      valuationDate: `Time ${N}`,
      modelChoice: "Piecewise accumulation function.",
      assumptions: ["No other transactions."],
      principle: "Accumulation through consecutive regimes multiplies the factor of each regime.",
      unusual: "A force of interest followed by a nominal discount basis.",
      misread: "Applying the second regime's rate to the deposit from time 0.",
      presentation: ["mixed-timing", "valuation-date", "frequency", "deferred"],
      features: { multipleValuationDates: true },
      params: { kase, P, T1, N, u, W, Q, a, b, d, m },
      route: "integrate, convert, carry flows, add",
    });
  },
};

// ===================================================================== 2. Real return through two inflation regimes

const realChain: QuestionTemplate = {
  id: "el-tvm-real-chain",
  family: "el-tvm-real-chain",
  topic: "TVM",
  levels: [4],
  objective: "TVM.inflation_real",
  secondary: ["TVM.effective_nominal", "TVM.force_of_interest", "TVM.equation_of_value"],
  reasoning: ["translation", "formula_selection", "multistep", "financial_intuition"],
  soaConcept: "Real rate of return when the nominal rate basis and the inflation rate both change during the investment period.",
  generate(rng): QuestionDraft {
    const i12 = gridRate(rng, 0.04, 0.09, 0.0025);
    const delta = gridRate(rng, 0.03, 0.08, 0.0025);
    const r1 = gridRate(rng, 0.015, 0.04, 0.0025);
    const r2 = drawUntil(() => gridRate(rng, 0.02, 0.06, 0.0025), (x) => Math.abs(x - r1) >= 0.0125);
    const n1 = rng.int(3, 7);
    const n2 = rng.int(3, 8);
    const N = n1 + n2;
    const name = nameOf(rng);
    const kase = pick(rng, ["real-yield", "nominal-needed"]);
    const growth = (j12: X | number, dl: X | number, eff1 = false, forceEff = false) =>
      mul(eff1 ? at(j12, n1) : pow(add(1, div(j12, 12)), 12 * n1), forceEff ? at(dl, n2) : exp(mul(dl, n2)));
    const index = (twice = false, single = false) => {
      const base = single ? at(r1, N) : mul(at(r1, n1), at(r2, n2));
      return twice ? mul(base, base) : base;
    };
    const basis = `Interest is credited at a nominal annual rate of ${pct(i12)} convertible monthly for the first ${n1} years and at a constant force of interest of ${pct(delta)} for the following ${n2} years. Inflation is ${pct(r1)} per year for the first ${n1} years and ${pct(r2)} per year thereafter.`;

    if (kase === "real-yield") {
      const P = gridAmount(rng, 1000, 20000, 500);
      const realOf = (g: X, idx: X) => sub(pow(div(g, idx), 1 / N), 1);
      const ans = realOf(growth(i12, delta), index());
      const nominalYield = sub(pow(growth(i12, delta), 1 / N), 1);
      const inflAvg = sub(pow(index(), 1 / N), 1);
      return elite({
        stem: `${name} invests ${amt(P)} for ${N} years. ${basis}\n\nCalculate the annual effective real rate of return ${name} earns over the ${N} years.`,
        fmt: PCT3,
        answer: ans,
        model: sub(exp(div(add(mul(12 * n1, ln(1 + i12 / 12)), delta * n2, mul(-n1, ln(1 + r1)), mul(-n2, ln(1 + r2))), N)), 1),
        modelDescription: "Logarithm of the real growth factor (nominal log-growth minus log-inflation over each regime) averaged over the term.",
        traps: [
          { id: "FORMULA_APPROX_REAL", value: sub(nominalYield, inflAvg), label: "nominal yield minus inflation", method: "Subtracted the average inflation rate from the average nominal yield.", feedback: "Real growth divides by inflation: $1 + r = (1 + i)/(1 + \\text{inflation})$." },
          { id: "VAR_OTHER_UNKNOWN", value: nominalYield, label: "nominal yield", method: "Gave the nominal annual yield.", feedback: "The question asks for the real rate: remove inflation." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: realOf(growth(i12, delta, true), index()), label: "monthly nominal rate used as effective", method: `Used ${pct(i12)} as an annual effective rate.`, feedback: `Convert: $(1 + ${dec(i12 / 12, 6)})^{12} - 1$.` },
          { id: "RATE_FORCE_AS_EFFECTIVE", value: realOf(growth(i12, delta, false, true), index()), label: "force used as effective rate", method: `Used ${pct(delta)} as an annual effective rate.`, feedback: `A force of ${pct(delta)} accumulates by $e^{${dec(delta, 4)}}$ per year.` },
          { id: "CONC_TVM_INFLATION_TWICE", value: realOf(growth(i12, delta), index(true)), label: "inflation removed twice", method: "Deflated by the price index twice.", feedback: "Divide the nominal growth by the price index once." },
          { id: "MODEL_SINGLE_RATE", value: realOf(growth(i12, delta), index(false, true)), label: "first inflation rate throughout", method: `Used ${pct(r1)} inflation for all ${N} years.`, feedback: `Inflation is ${pct(r2)} after year ${n1}.` },
        ],
        steps: [
          step("A.nominal-equivalence", "Annual effective rate of the first regime.", ["i_1", Math.pow(1 + i12 / 12, 12) - 1, "annual effective rate, first regime"], ["i^(12)"]),
          step("A.constant-force", "Growth over the second regime.", ["e^{\\delta n_2}", Math.exp(delta * n2), "growth factor, second regime"], ["\\delta"]),
          step("A.accumulation", "Nominal growth factor over the whole term.", ["G", growth(i12, delta).v, "nominal growth factor"], ["i_1", "\\delta"]),
          step("F.real-rate", "Divide by the price index over both inflation regimes.", ["G/I", growth(i12, delta).v / index().v, "real growth factor"], ["G", "r_1", "r_2"]),
          step("A.effective-interest", `Annualise over ${N} years.`, ["r", ans.v, "annual real rate"], ["G/I"], { rearranged: true }),
        ],
        methods: ["decomposition", "rearrangement"],
        reasoning: "Build the nominal growth factor regime by regime, divide by the price index built the same way, then take the N-th root.",
        intuition: "Real growth = nominal growth ÷ price growth, over the whole period; average only at the end.",
        unknowns: [{ symbol: "$r$", meaning: "annual effective real rate" }],
        relationships: ["$(1+r)^N = \\dfrac{(1 + i^{(12)}/12)^{12 n_1} e^{\\delta n_2}}{(1+r_1)^{n_1}(1+r_2)^{n_2}}$"],
        conditions: ["Rates and inflation change at the same date."],
        valuationDate: `Time ${N}`,
        modelChoice: "Ratio of growth factors.",
        assumptions: ["Inflation compounds annually at the stated rates."],
        principle: "Real and nominal rates are linked multiplicatively, not additively.",
        unusual: "Three different rate conventions in one question.",
        misread: "Subtracting inflation from the nominal rate.",
        presentation: ["frequency", "mixed-timing", "combined-topics", "multi-equation"],
        params: { kase, P, i12, delta, r1, r2, n1, n2 },
        route: "convert, grow, deflate, annualise",
      });
    }

    // nominal-needed: inverse for the monthly nominal rate
    const P = gridAmount(rng, 1000, 20000, 500);
    const truth = growth(i12, delta).v / index().v;
    const target = Math.round(P * truth);
    const ratio = target / P;
    const eqFor = (opts: { deflate?: boolean; eff?: boolean; forceEff?: boolean; twice?: boolean; single?: boolean }): Eq => ({
      eq: (x: X) => sub(div(growth(x, delta, opts.eff, opts.forceEff), opts.deflate === false ? K(1) : index(opts.twice, opts.single)), ratio),
      lo: 0.0001,
      hi: 0.5,
    });
    const closed = mul(12, sub(pow(div(mul(ratio, index()), exp(mul(delta, n2))), 1 / (12 * n1)), 1));
    return elite({
      stem: `${name} invests ${amt(P)} for ${N} years and wants the investment to be worth ${amt(target)} in time-0 purchasing power at the end. For the first ${n1} years the account credits interest at a nominal annual rate $j$ convertible monthly; for the following ${n2} years it credits interest at a constant force of interest of ${pct(delta)}. Inflation is ${pct(r1)} per year for the first ${n1} years and ${pct(r2)} per year thereafter.\n\nCalculate $j$.`,
      fmt: PCT3,
      answer: closed,
      model: eqFor({}),
      modelDescription: "Equation of value in real terms: nominal growth over both regimes divided by the price index equals the target ratio.",
      traps: [
        { id: "CONC_TVM_REAL_AS_MONEY_GROWTH", value: eqFor({ deflate: false }), label: "target treated as a nominal amount", method: "Required a nominal value equal to the purchasing-power target.", feedback: "The target is in time-0 purchasing power: multiply it by the price index." },
        { id: "VAR_OTHER_UNKNOWN", value: fromNominal(closed, 12), label: "annual effective rate", method: "Gave the annual effective rate.", feedback: "The question asks for the nominal rate convertible monthly." },
        { id: "RATE_FORCE_AS_EFFECTIVE", value: eqFor({ forceEff: true }), label: "force used as effective rate", method: `Grew the second regime at ${pct(delta)} effective.`, feedback: `A force of ${pct(delta)} gives $e^{${dec(delta, 4)}}$ per year.` },
        { id: "CONC_TVM_INFLATION_TWICE", value: eqFor({ twice: true }), label: "inflation applied twice", method: "Applied the price index twice.", feedback: "Apply the price index once." },
        { id: "MODEL_SINGLE_RATE", value: eqFor({ single: true }), label: "first inflation rate throughout", method: `Used ${pct(r1)} inflation for all ${N} years.`, feedback: `Inflation changes to ${pct(r2)} after year ${n1}.` },
      ],
      steps: [
        step("F.real-rate", "Nominal value needed: target × price index.", ["V", target * index().v, "nominal value needed"], ["target", "r_1", "r_2"]),
        step("A.constant-force", "Growth supplied by the second regime.", ["e^{\\delta n_2}", Math.exp(delta * n2), "second-regime growth"], ["\\delta"]),
        step("A.accumulation", "Growth the first regime must supply.", ["G_1", (ratio * index().v) / Math.exp(delta * n2), "first-regime growth factor"], ["V", "P"], { rearranged: true }),
        step("A.effective-interest", "Monthly effective rate.", ["j/12", Math.pow((ratio * index().v) / Math.exp(delta * n2), 1 / (12 * n1)) - 1, "monthly rate"], ["G_1"], { rearranged: true }),
        step("A.nominal-equivalence", "Nominal annual rate convertible monthly.", ["j", closed.v, "nominal rate"], ["j/12"]),
      ],
      methods: ["work_backwards", "rearrangement"],
      reasoning: "Turn the real target into a nominal one, strip off the second regime, then solve the first regime's growth for its monthly rate.",
      intuition: "Work backwards from the end: what nominal amount buys the target, and how much of it must the first regime earn?",
      unknowns: [{ symbol: "$j$", meaning: "nominal annual rate convertible monthly" }],
      relationships: [`$P (1 + j/12)^{${12 * n1}} e^{${dec(delta, 4)}\\cdot${n2}} = ${mnum(target, 0)}\\,(1+r_1)^{${n1}}(1+r_2)^{${n2}}$`],
      conditions: ["Inflation changes when the rate basis changes."],
      valuationDate: `Time ${N}`,
      modelChoice: "Equation of value in real terms, solved backwards.",
      assumptions: ["Inflation compounds annually."],
      principle: "A purchasing-power target is a nominal target multiplied by the price index.",
      unusual: "The unknown is a nominal rate inside only part of the term.",
      misread: "Treating the real target as a nominal amount.",
      presentation: ["unknown-rate", "work-backwards", "frequency", "mixed-timing"],
      features: { multipleValuationDates: true },
      params: { kase, P, target, i12, delta, r1, r2, n1, n2 },
      route: "inflate target, strip regime, solve rate",
    });
  },
};

// ===================================================================== 3. Quadratic equation of value with a penalty

const eqvQuadratic: QuestionTemplate = {
  id: "el-tvm-eqv-quadratic",
  family: "el-tvm-eqv-quadratic",
  topic: "TVM",
  levels: [4],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.discount_rates", "TVM.force_of_interest", "TVM.effective_nominal"],
  reasoning: ["algebra", "translation", "multistep", "cashflow_modelling"],
  soaConcept: "Deposits at 0 and n accumulating to a known amount at 2n give a quadratic in (1+i)^n; an early-withdrawal penalty changes the net flow at n.",
  generate(rng): QuestionDraft {
    const A0 = gridAmount(rng, 1000, 6000, 100);
    const B0 = gridAmount(rng, 1500, 8000, 100);
    const W = gridAmount(rng, 200, Math.min(1200, B0 - 300), 50);
    const p = pick(rng, [0.02, 0.03, 0.04, 0.05]);
    const net = B0 - W * (1 + p);
    const name = nameOf(rng);
    const kase = pick(rng, ["rate", "time"]);
    const quad = (a: number, b: number, c: number, divideBy = 2) => (-b + Math.sqrt(b * b + 4 * a * c)) / (divideBy * a);
    const uX = (netFlow: number, C: number, divideBy = 2) => div(add(-netFlow, pow(add(netFlow * netFlow, 4 * A0 * C), 0.5)), divideBy * A0);

    if (kase === "rate") {
      const n = rng.int(4, 10);
      const i = gridRate(rng, 0.04, 0.09, 0.0025);
      const u = Math.pow(1 + i, n);
      const C = Math.round(A0 * u * u + net * u);
      const d2Of = (uu: X) => mul(2, sub(1, pow(uu, -1 / (2 * n))));
      const ans = d2Of(uX(net, C));
      const iOf = (uu: X) => sub(pow(uu, 1 / n), 1);
      return elite({
        stem: `${name} deposits ${amt(A0)} into a fund at time 0 and ${amt(B0)} at time ${n}. Immediately after the second deposit, ${name} withdraws ${amt(W)}; because the withdrawal is early, the fund also deducts a penalty equal to ${pc(p, 1)} of the amount withdrawn. The fund is worth ${amt(C)} at time ${2 * n}.\n\nCalculate the nominal annual rate of discount convertible semiannually credited by the fund.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(add(mul(A0, pow(sub(1, div(x, 2)), -4 * n)), mul(net, pow(sub(1, div(x, 2)), -2 * n))), C), lo: 0.001, hi: 0.4 },
        modelDescription: "Equation of value at time 2n with semiannual discount factors, solved for the nominal discount rate.",
        traps: [
          { id: "TRANS_IGNORED_CONDITION", value: d2Of(uX(B0 - W, C)), label: "penalty ignored", method: "Left out the penalty.", feedback: `The fund loses ${amt(W * (1 + p))} at time ${n}, not ${amt(W)}.` },
          { id: "ALG_SIGN_ERROR", value: d2Of(uX(B0 + W * (1 + p), C)), label: "withdrawal added", method: "Added the withdrawal and penalty.", feedback: "A withdrawal reduces the fund." },
          { id: "VAR_OTHER_UNKNOWN", value: iOf(uX(net, C)), label: "annual effective interest rate", method: "Stopped at the annual effective interest rate.", feedback: "Convert to a nominal discount rate convertible semiannually." },
          { id: "RATE_DISCOUNT_AS_INTEREST", value: mul(2, sub(pow(uX(net, C), 1 / (2 * n)), 1)), label: "nominal interest instead of discount", method: "Gave the nominal interest rate convertible semiannually.", feedback: "Discount per half-year is $1 - v^{1/2}$, not $(1+i)^{1/2} - 1$." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: sub(1, pow(uX(net, C), -1 / n)), label: "annual effective discount", method: "Gave the annual effective discount rate.", feedback: "Convert to the nominal rate convertible semiannually." },
          { id: "ALG_DIVIDE_ERROR", value: d2Of(uX(net, C, 1)), label: "quadratic formula without the 2", method: "Divided by $a$ instead of $2a$ in the quadratic formula.", feedback: "$u = \\dfrac{-b + \\sqrt{b^2 + 4ac}}{2a}$." },
        ],
        steps: [
          step("A.equation-of-value", `Net flow at time ${n} and equation of value at time ${2 * n}: a quadratic in $u = (1+i)^{${n}}$.`, ["B_{net}", net, `net flow at time ${n}`], ["deposits", "W", "penalty"], { derived: true }),
          step("M.root-finding", "Positive root of the quadratic.", ["u", quad(A0, net, C), `accumulation factor over ${n} years`], ["quadratic"], { rearranged: true }),
          step("M.logarithm", "Annual effective rate.", ["i", iOf(uX(net, C)).v, "annual effective rate"], ["u"]),
          step("A.nominal-equivalence", "Nominal discount rate convertible semiannually.", ["d^{(2)}", ans.v, "nominal discount rate"], ["i"]),
        ],
        methods: ["equation_construction", "factorisation", "substitution"],
        reasoning: `Write the equation of value at time ${2 * n}, substitute $u = (1+i)^{${n}}$, solve the quadratic and convert the rate.`,
        intuition: "Two deposits n years apart give powers u² and u: the equation of value is a quadratic in u.",
        unknowns: [{ symbol: "$d^{(2)}$", meaning: "nominal discount rate convertible semiannually" }],
        relationships: [`$${mnum(A0, 0)}u^2 + ${mnum(net, 2)}u = ${mnum(C, 0)}$`, "$d^{(2)} = 2(1 - (1+i)^{-1/2})$"],
        conditions: ["The penalty is taken from the fund at the time of the withdrawal."],
        valuationDate: `Time ${2 * n}`,
        modelChoice: "Equation of value in a substituted variable.",
        assumptions: ["A constant rate throughout."],
        principle: "Equally spaced cash flows make an equation of value polynomial in the accumulation factor.",
        unusual: "A penalty changes the net cash flow, and the answer is a nominal discount rate.",
        misread: "Forgetting the penalty or giving the effective interest rate.",
        presentation: ["unknown-rate", "hidden-structure", "frequency", "irrelevant-info"],
        features: { multipleValuationDates: true },
        params: { kase, A0, B0, W, p, n, C },
        route: "net flow, quadratic, rate, convert",
      });
    }

    // time: unknown n, rate given as a force of interest
    const delta = gridRate(rng, 0.03, 0.08, 0.0025);
    const nTrue = rng.int(5, 12) + pick(rng, [0, 0.5]);
    const u = Math.exp(delta * nTrue);
    const C = Math.round(A0 * u * u + net * u);
    const nOf = (uu: X) => div(ln(uu), delta);
    const ans = nOf(uX(net, C));
    return elite({
      stem: `${name} deposits ${amt(A0)} into a fund at time 0 and ${amt(B0)} at time $n$. Immediately after the second deposit, ${name} withdraws ${amt(W)} and the fund deducts an early-withdrawal penalty of ${pc(p, 1)} of the amount withdrawn. The fund credits interest at a constant force of interest of ${pct(delta)} and is worth ${amt(C)} at time $2n$.\n\nCalculate $n$.`,
      fmt: YEARS2,
      answer: ans,
      model: { eq: (x: X) => sub(add(mul(A0, exp(mul(2 * delta, x))), mul(net, exp(mul(delta, x)))), C), lo: 0.5, hi: 60 },
      modelDescription: "Equation of value at time 2n under the constant force, solved for n.",
      traps: [
        { id: "TRANS_IGNORED_CONDITION", value: nOf(uX(B0 - W, C)), label: "penalty ignored", method: "Left out the penalty.", feedback: `The net flow at time n is ${amt(net)}.` },
        { id: "ALG_SIGN_ERROR", value: nOf(uX(B0 + W * (1 + p), C)), label: "withdrawal added", method: "Added the withdrawal and penalty.", feedback: "A withdrawal reduces the fund." },
        { id: "VAR_OTHER_UNKNOWN", value: mul(2, nOf(uX(net, C))), label: "total time", method: "Gave $2n$.", feedback: "The question asks for $n$." },
        { id: "RATE_FORCE_AS_EFFECTIVE", value: div(ln(uX(net, C)), ln(1 + delta)), label: "force used as effective rate", method: `Used ${pct(delta)} as an annual effective rate.`, feedback: `$u = e^{${dec(delta, 4)} n}$.` },
        { id: "ALG_DIVIDE_ERROR", value: nOf(uX(net, C, 1)), label: "quadratic formula without the 2", method: "Divided by $a$ instead of $2a$.", feedback: "Use $2a$ in the denominator." },
      ],
      steps: [
        step("A.equation-of-value", "Net flow at time n and equation of value at 2n: a quadratic in $u = e^{\\delta n}$.", ["B_{net}", net, "net flow at time n"], ["deposits", "W", "penalty"], { derived: true }),
        step("M.root-finding", "Positive root.", ["u", quad(A0, net, C), "accumulation factor over n years"], ["quadratic"], { rearranged: true }),
        step("A.constant-force", "Accumulation under a constant force.", ["\\delta n", Math.log(quad(A0, net, C)), "integrated force"], ["u"]),
        step("M.logarithm", "Solve for n.", ["n", ans.v, "time n"], ["\\delta"], { rearranged: true }),
      ],
      methods: ["equation_construction", "factorisation", "logarithms"],
      reasoning: "Equation of value at 2n, substitute u = e^{δn}, solve the quadratic, take logarithms.",
      intuition: "The unknown time sits in the exponent twice (n and 2n): substitute to get a quadratic.",
      unknowns: [{ symbol: "$n$", meaning: "time of the second deposit" }],
      relationships: [`$${mnum(A0, 0)}u^2 + ${mnum(net, 2)}u = ${mnum(C, 0)}, \\quad u = e^{${dec(delta, 4)}n}$`],
      conditions: ["Penalty deducted at the time of withdrawal."],
      valuationDate: "Time 2n",
      modelChoice: "Equation of value in a substituted variable.",
      assumptions: ["Constant force throughout."],
      principle: "Equally spaced cash flows give a polynomial in the accumulation factor.",
      unusual: "The unknown is a time, and the rate is a force.",
      misread: "Giving 2n.",
      presentation: ["unknown-time", "hidden-structure", "irrelevant-info", "rearrange-first"],
      features: { multipleValuationDates: true },
      params: { kase, A0, B0, W, p, delta, C },
      route: "net flow, quadratic, logarithm",
    });
  },
};

// ===================================================================== 4. Piecewise force, then an effective rate, with a bonus

const piecewiseForce: QuestionTemplate = {
  id: "el-tvm-piecewise-force",
  family: "el-tvm-piecewise-force",
  topic: "TVM",
  levels: [4],
  objective: "TVM.variable_force",
  secondary: ["TVM.accumulation_discount", "TVM.equation_of_value", "TVM.discount_rates"],
  reasoning: ["formula_selection", "valuation_dates", "multistep", "algebra"],
  soaConcept: "A force of interest of the form 2t/(K + t²), followed by a constant rate; values found by integrating each piece.",
  generate(rng): QuestionDraft {
    const Kc = pick(rng, [20, 25, 40, 50, 80, 100]);
    const T1 = rng.int(3, 6);
    const N = T1 + rng.int(3, 7);
    const s = rng.int(1, T1 - 1);
    const name = nameOf(rng);
    const kase = pick(rng, ["yield-with-bonus", "present-value"]);
    const acc = (t: number) => (Kc + t * t) / Kc;
    const accX = (from: number, to: number) => div(Kc + to * to, Kc + from * from);
    const notIntegrated = (from: number, to: number) => exp(mul((2 * to) / (Kc + to * to), to - from));

    if (kase === "yield-with-bonus") {
      const i = gridRate(rng, 0.03, 0.07, 0.0025);
      const b = pick(rng, [0.01, 0.015, 0.02, 0.025]);
      const P = gridAmount(rng, 1000, 5000, 100);
      const Q = gridAmount(rng, 1000, 5000, 100);
      const fund = (opts: { bonus?: boolean; qFrom?: number; integrate?: boolean; single?: boolean }) => {
        const f1 = opts.integrate === false ? notIntegrated : accX;
        const phase1 = opts.single ? add(mul(P, at(i, T1)), mul(Q, at(i, T1 - (opts.qFrom ?? s)))) : add(mul(P, f1(0, T1)), mul(Q, f1(opts.qFrom ?? s, T1)));
        return mul(phase1, at(i, N - T1), opts.bonus === false ? 1 : 1 + b);
      };
      const F = fund({});
      const yieldEq = (FF: X, qAt = s): Eq => ({ eq: (x: X) => sub(add(mul(P, at(x, N)), mul(Q, at(x, N - qAt))), FF), lo: -0.2, hi: 0.5 });
      return elite({
        stem: `${name} deposits ${amt(P)} into a fund at time 0 and ${amt(Q)} at time ${s}. The fund credits interest at the force of interest $\\delta_t = \\dfrac{2t}{${Kc} + t^2}$ for $0 \\le t \\le ${T1}$ and at an annual effective rate of ${pct(i)} after time ${T1}. At time ${N} the fund adds a loyalty bonus of ${pc(b, 1)} of its value, and ${name} closes the account.\n\nCalculate ${name}'s annual effective yield rate on the two deposits.`,
        fmt: PCT3,
        answer: yieldEq(F),
        model: { eq: (x: X) => sub(add(mul(P, at(x, N)), mul(Q, at(x, N - s))), mul(add(mul(P, (Kc + T1 * T1) / Kc), mul(Q, (Kc + T1 * T1) / (Kc + s * s))), pow(1 + i, N - T1), 1 + b)), lo: -0.2, hi: 0.5 },
        modelDescription: "Yield equation: both deposits accumulated at the unknown yield equal the closing value (piecewise accumulation, then the bonus).",
        traps: [
          { id: "TRANS_IGNORED_CONDITION", value: yieldEq(fund({ bonus: false })), label: "bonus ignored", method: "Left out the loyalty bonus.", feedback: `The closing value includes the ${pc(b, 1)} bonus.` },
          { id: "TIMING_VALUATION_DATE", value: yieldEq(F, 0), label: "second deposit dated at time zero", method: `Treated the ${amt(Q)} deposit as made at time 0 in the yield equation.`, feedback: `It is made at time ${s}, so it is invested for ${N - s} years.` },
          { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: yieldEq(fund({ integrate: false })), label: "force times time", method: "Accumulated by the force at the end of the regime times its length.", feedback: `Integrate: $\\exp\\int_s^t \\frac{2r}{${Kc}+r^2}dr = \\frac{${Kc}+t^2}{${Kc}+s^2}$.` },
          { id: "MODEL_SINGLE_RATE", value: yieldEq(fund({ single: true })), label: "effective rate throughout", method: `Accumulated at ${pct(i)} from time 0.`, feedback: `The force applies until time ${T1}.` },
          { id: "TIMING_EXTRA_PERIOD", value: yieldEq(mul(fund({}), 1 + i)), label: "one extra year at the second rate", method: `Accumulated ${N - T1 + 1} years at ${pct(i)}.`, feedback: `From time ${T1} to time ${N} is ${N - T1} years.` },
        ],
        steps: [
          step("A.force-accumulation", `Accumulation of the first deposit to time ${T1}.`, ["a(0,T_1)", acc(T1), `factor 0 to ${T1}`], ["\\delta_t"]),
          step("A.force-accumulation", `Accumulation of the second deposit from ${s} to ${T1}.`, ["a(s,T_1)", acc(T1) / acc(s), `factor ${s} to ${T1}`], ["\\delta_t"]),
          step("A.compound", `Carry to time ${N} and add the bonus.`, ["F", F.v, "closing value"], ["i", "b"]),
          step("C.yield-rate", "Yield equation: the deposits, at the unknown yield, accumulate to the closing value.", ["P+Q", P + Q, "total deposited"], ["P", "Q", "F"], { derived: true }),
          step("M.root-finding", "Solve for the yield.", ["j", 0, "annual effective yield"], ["f(j)"], { rearranged: true }),
        ],
        methods: ["equation_construction", "numerical_root", "valuation_dates"],
        reasoning: "Integrate the force to get exact accumulation factors, carry the fund to the closing date at the effective rate, add the bonus, then solve the yield equation on the actual deposit dates.",
        intuition: "Two separate questions: what the fund pays out (fund's own rates) and what single rate would produce that from the deposits (yield).",
        unknowns: [{ symbol: "$j$", meaning: "annual effective yield rate" }],
        relationships: [`$\\exp\\int_s^t \\delta_r\\,dr = \\dfrac{${Kc} + t^2}{${Kc} + s^2}$`, `$${mnum(P, 0)}(1+j)^{${N}} + ${mnum(Q, 0)}(1+j)^{${N - s}} = F$`],
        conditions: ["The bonus is paid only at closing."],
        valuationDate: `Time ${N}`,
        modelChoice: "Accumulation through a piecewise force, then a yield equation.",
        assumptions: ["No other transactions."],
        principle: "The yield rate is the single rate that equates the investor's outlays and receipts.",
        unusual: "The force has a closed-form integral that is a ratio of quadratics.",
        misread: "Measuring the second deposit from time 0 in the yield equation.",
        presentation: ["unknown-rate", "mixed-timing", "valuation-date", "irrelevant-info"],
        features: { multipleValuationDates: true },
        params: { kase, Kc, T1, N, s, i, b, P, Q },
        route: "integrate, carry, bonus, solve yield",
      });
    }

    // present-value: payments in both regimes, second regime given as nominal discount
    const m = pick(rng, [4, 12]);
    const dm = gridRate(rng, 0.03, 0.07, 0.0025);
    const i = fromNominalDiscount(dm, m);
    const u = T1 + rng.int(1, N - T1 - 1);
    const Xs = gridAmount(rng, 1000, 5000, 100);
    const Yu = gridAmount(rng, 1000, 5000, 100);
    const ZN = gridAmount(rng, 2000, 9000, 100);
    const pv = (opts: { rate?: X; integrate?: boolean; single?: boolean; stopAtT1?: boolean }) => {
      const rate = opts.rate ?? i;
      const f1 = opts.integrate === false ? notIntegrated : accX;
      const dT1 = opts.stopAtT1 ? K(1) : div(1, f1(0, T1));
      if (opts.single) return add(mul(Xs, vt0(rate, s)), mul(Yu, vt0(rate, u)), mul(ZN, vt0(rate, N)));
      return add(mul(Xs, div(1, f1(0, s))), mul(add(mul(Yu, vt0(rate, u - T1)), mul(ZN, vt0(rate, N - T1))), dT1));
    };
    const ans = pv({});
    return elite({
      stem: `An investment returns ${amt(Xs)} at time ${s}, ${amt(Yu)} at time ${u} and ${amt(ZN)} at time ${N}. Money is valued using the force of interest $\\delta_t = \\dfrac{2t}{${Kc} + t^2}$ for $0 \\le t \\le ${T1}$, and a nominal annual rate of discount of ${pct(dm)} convertible ${m === 12 ? "monthly" : "quarterly"} after time ${T1}.\n\nCalculate the present value of the investment's returns at time 0.`,
      fmt: MONEY2,
      answer: ans,
      model: add(mul(Xs, Kc / (Kc + s * s)), mul(Yu, pow(sub(1, dm / m), m * (u - T1)), Kc / (Kc + T1 * T1)), mul(ZN, pow(sub(1, dm / m), m * (N - T1)), Kc / (Kc + T1 * T1))),
      modelDescription: "Each return discounted per conversion period back to the switch date, then through the integrated force to time 0.",
      traps: [
        { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: pv({ integrate: false }), label: "force times time", method: "Discounted by the force at the end of a period times its length.", feedback: "Integrate the force." },
        { id: "RATE_DISCOUNT_AS_INTEREST", value: pv({ rate: fromNominal(dm, m) }), label: "discount used as interest", method: `Used ${pct(dm)} as a nominal interest rate.`, feedback: `It is a nominal discount rate: $v = (1 - ${dec(dm / m, 6)})^{${m}}$ per year.` },
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: pv({ rate: div(dm, sub(1, dm)) }), label: "nominal discount used as effective", method: `Used ${pct(dm)} as the annual effective discount rate.`, feedback: `Convert per ${m === 12 ? "month" : "quarter"}.` },
        { id: "MODEL_SINGLE_RATE", value: pv({ single: true }), label: "second rate used throughout", method: "Discounted everything at the second-regime rate.", feedback: `The force applies up to time ${T1}.` },
        { id: "TIMING_IGNORED_DEFERRAL", value: pv({ stopAtT1: true }), label: "later returns valued only at the switch", method: `Stopped the later returns at time ${T1}.`, feedback: `Discount them further from time ${T1} to 0 through the force.` },
        { id: "CHAL_RATE_BY_PAYMENT_DATE", value: add(mul(Xs, Kc / (Kc + s * s)), mul(Yu, vt0(i, u)), mul(ZN, vt0(i, N))), label: "each return at the rule of its own date", method: `Discounted the returns after time ${T1} all the way to 0 at the second-regime rate.`, feedback: `Money crosses the years before ${T1} under the force, whatever its payment date.` },
        { id: "TIMING_EXTRA_PERIOD", value: add(mul(Xs, Kc / (Kc + s * s)), mul(add(mul(Yu, vt0(i, u - T1 + 1)), mul(ZN, vt0(i, N - T1 + 1))), Kc / (Kc + T1 * T1))), label: "one extra year in the second regime", method: "Discounted the later returns one year too many.", feedback: `From time ${u} back to ${T1} is ${u - T1} years.` },
      ],
      steps: [
        step("A.nominal-equivalence", "Annual effective rate after the switch.", ["i", i.v, "annual effective rate after the switch"], ["d^(m)"]),
        step("A.discount-factor", `Value at time ${T1} of the returns after the switch.`, ["V_{T_1}", add(mul(Yu, vt0(i, u - T1)), mul(ZN, vt0(i, N - T1))).v, `later returns at time ${T1}`], ["i"]),
        step("A.force-accumulation", `Discount factor from ${T1} to 0 through the force.`, ["1/a(T_1)", Kc / (Kc + T1 * T1), "discount factor through the force"], ["\\delta_t"]),
        step("A.force-accumulation", `Discount factor from ${s} to 0.`, ["1/a(s)", Kc / (Kc + s * s), "discount factor for the first return"], ["\\delta_t"]),
        step("A.equation-of-value", "Add the pieces.", ["PV", ans.v, "present value"], ["pieces"]),
      ],
      methods: ["decomposition", "valuation_dates"],
      reasoning: `Value the later returns at the switch date ${T1} with the discount-rate basis, then discount everything to 0 through the integrated force.`,
      intuition: "Two regimes, so cut the timeline at the switch: each piece crosses each regime under that regime's rule.",
      unknowns: [{ symbol: "$PV$", meaning: "present value at time 0" }],
      relationships: [`$v(t) = \\dfrac{${Kc}}{${Kc} + t^2}$ for $t \\le ${T1}$`, `$v(t) = \\dfrac{${Kc}}{${Kc} + ${T1 * T1}}(1 - d^{(${m})}/${m})^{${m}(t - ${T1})}$ for $t > ${T1}$`],
      conditions: ["Rates switch at a fixed date."],
      valuationDate: "Time 0",
      modelChoice: "Piecewise discount function.",
      assumptions: ["No default risk."],
      principle: "A discount function across regimes is a product of the regimes' factors.",
      unusual: "A rational force of interest followed by a nominal discount rate.",
      misread: "Discounting the later returns only to the switch date.",
      presentation: ["mixed-timing", "valuation-date", "frequency", "deferred"],
      features: { multipleValuationDates: true },
      params: { kase, Kc, T1, N, s, u, dm, m, Xs, Yu, ZN },
      route: "convert, value at switch, integrate force, add",
    });
  },
};

/** (1+i)^−t written with a plain number of years. */
function vt0(i: X, t: number): X {
  return pow(add(1, i), -t);
}

export const ELITE_TVM_TEMPLATES: QuestionTemplate[] = [forceSwitch, realChain, eqvQuadratic, piecewiseForce];
