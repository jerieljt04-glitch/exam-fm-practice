/**
 * Elite (level 4) annuity templates: payment frequency ≠ compounding
 * frequency ≠ step frequency, continuous varying streams under constant and
 * varying forces, multi-phase career funds, pyramids every k years, P/Q
 * m-thly streams, two-stage growth, valuation at an intermediate date, drop
 * and balloon withdrawals, and unknown-rate equalities. Each template has
 * two cases with different situations and unknowns.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import { MONEY2, amt, dec, drawUntil, gridAmount, gridRate, ord, pc, step } from "./kit";
import {
  K,
  X,
  add,
  an,
  at,
  da,
  div,
  elite,
  exp,
  fromNominal,
  geoA,
  ia,
  ln,
  mul,
  nameOf,
  perK,
  pick,
  pow,
  rootOf,
  sub,
  sum,
  vt,
  type Eq,
  type Trap,
} from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const pct = (x: number) => pc(x, 3);

/** Explicit sum Σ amount(k)·v(t_k). */
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));

// ===================================================================== 1. Monthly payments, annual geometric steps, quarterly rate, then a perpetuity-due

const geoMonthlyStep: QuestionTemplate = {
  id: "el-ann-geo-mthly-step",
  family: "el-ann-geo-mthly-step",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["ANNUITIES.geometric", "ANNUITIES.perpetuities", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "formula_selection", "multistep", "valuation_dates"],
  soaConcept: "Monthly payments that step up geometrically once a year, valued at a quarterly-convertible rate, followed by a perpetuity-due under a new rate.",
  generate(rng): QuestionDraft {
    const i4 = gridRate(rng, 0.04, 0.08, 0.0025);
    const i = fromNominal(i4, 4);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => Math.abs(x - i.v) > 0.01);
    const g = pick(rng, [0.02, 0.025, 0.03, 0.035, 0.04]);
    const n = rng.int(6, 11);
    const R = gridAmount(rng, 100, 800, 25);
    const Q = gridAmount(rng, 2000, 12000, 500);
    const name = nameOf(rng);
    const kase = pick(rng, ["value", "unknown-growth"]);
    const monthlyBlock = (rate: X) => div(sub(1, vt(rate, 1)), perK(rate, 1 / 12));
    const pv = (o: { rate?: X; gg?: X | number; annual12?: boolean; firstGrown?: boolean; perpImmediate?: boolean; perpRate?: number; perpDefer?: number }) => {
      const rate = o.rate ?? i;
      const gg = o.gg ?? g;
      const block = o.annual12 ? mul(12, vt(rate, 1)) : monthlyBlock(rate);
      const growing = mul(R, o.firstGrown ? add(1, gg) : 1, block, mul(geoA(rate, gg, n), add(1, rate)));
      const pr = o.perpRate ?? j;
      const perpAtN = o.perpImmediate ? div(Q, pr) : div(mul(Q, 1 + pr), pr);
      return add(growing, mul(perpAtN, vt(rate, o.perpDefer ?? n)));
    };
    const ans = pv({});
    const model = (gg: X | number) =>
      add(
        flows(12 * n, (k) => mul(R, pow(add(1, gg), Math.floor(k / 12)), vt(i4 / 4, ((k + 1) / 12) * 4))),
        mul(div(Q, sub(1, pow(1 + j, -1))), vt(i4 / 4, 4 * n))
      );
    const stemCore = `${name}'s pension plan pays ${amt(R)} at the end of each month during the first year. The monthly amount increases by ${pc(g, 1)} at the start of each later year (it is level within each year), for ${n} years in all. Starting at the end of year ${n} — that is, at time ${n} — the plan pays ${amt(Q)} at the start of each year forever. Interest is at a nominal annual rate of ${pct(i4)} convertible quarterly through time ${n}, and at an annual effective rate of ${pct(j)} after time ${n}.`;
    const commonSteps = [
      step("A.nominal-equivalence", "Annual effective rate from the quarterly nominal rate.", ["i", i.v, "annual effective rate"], ["i^(4)"]),
      step("B.mthly-annuity", "Value at the start of a year of one year's monthly payments of 1.", ["a^{(12)}", monthlyBlock(i).v, "one year of monthly payments of 1"], ["i"]),
      step("B.geometric-annuity", `Geometric sum over the ${n} annual steps.`, ["G", mul(geoA(i, g, n), add(1, i)).v, "geometric factor over the years"], ["g", "i"]),
      step("B.perpetuity", `Perpetuity-due at ${pct(j)}, valued at time ${n}.`, ["V_n", (Q * (1 + j)) / j, `perpetuity value at time ${n}`], ["Q", "j"]),
      step("A.discount-factor", `Discount the perpetuity ${n} years at the first-regime rate.`, ["V_0", ((Q * (1 + j)) / j) * vt(i, n).v, "perpetuity at time 0"], ["V_n", "i"]),
    ];
    if (kase === "value") {
      return elite({
        stem: `${stemCore}\n\nCalculate the present value of all the plan's payments.`,
        fmt: MONEY2,
        answer: ans,
        model: model(g),
        modelDescription: "Each monthly payment discounted quarter by quarter; the perpetuity in the classical form, discounted through the quarterly regime.",
        traps: [
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: pv({ rate: K(i4) }), label: "quarterly nominal used as effective", method: `Used ${pct(i4)} as an annual effective rate.`, feedback: `$i = (1 + ${dec(i4 / 4, 5)})^4 - 1 = ${dec(i.v, 6)}$.` },
          { id: "CONC_ANN_MTHLY_PAYMENT_SIZE", value: pv({ annual12: true }), label: "monthly payments lumped at year end", method: "Treated each year's twelve payments as one payment at the year end.", feedback: "Value the monthly payments with a monthly annuity factor." },
          { id: "TIMING_DUE_AS_IMMEDIATE", value: pv({ perpImmediate: true }), label: "perpetuity-immediate", method: "Valued the perpetuity as payable at the ends of years.", feedback: `Its first payment is at time ${n}: a perpetuity-due at that date.` },
          { id: "MODEL_SINGLE_RATE", value: pv({ perpRate: i.v }), label: "one rate for the perpetuity too", method: `Valued the perpetuity at ${pct(i.v)}.`, feedback: `After time ${n} the rate is ${pct(j)}.` },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: pv({ firstGrown: true }), label: "growth applied in the first year", method: "Increased the first year's payments as well.", feedback: "The first year's payments are the base amount." },
          { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: pv({ perpDefer: n + 1 }), label: "perpetuity deferred a year too long", method: `Discounted the perpetuity ${n + 1} years.`, feedback: `A perpetuity-due valued at its first payment (time ${n}) is discounted ${n} years.` },
        ],
        steps: [...commonSteps, step("A.equation-of-value", "Add the two parts.", ["PV", ans.v, "present value"], ["parts"])],
        methods: ["decomposition", "geometric_series", "valuation_dates"],
        reasoning: "Convert the rate, value one year of monthly payments at the start of the year, sum the annual geometric steps, then add the perpetuity-due valued at its first payment and discounted under the first regime.",
        intuition: "Three different clocks — monthly payments, quarterly compounding, yearly steps — so build one year as a block first.",
        unknowns: [{ symbol: "$PV$", meaning: "present value of the plan" }],
        relationships: ["$PV = R\\,\\ddot a^{(12)}_{\\overline{1|}}$-style block $\\times \\sum_{k=0}^{n-1} (1+g)^k v^k + \\dfrac{Q(1+j)}{j} v^n$"],
        conditions: ["Payments are level within each year.", `The rate changes at time ${n}.`],
        valuationDate: "Time 0",
        modelChoice: "Blocks of one year, a geometric sum over years, and a perpetuity-due.",
        assumptions: ["Payments continue as described with certainty."],
        alternative: { name: "Monthly geometric at an equivalent rate", body: "Not available here, because growth is annual while payments are monthly — the block method is the clean route.", whenUseful: "Only when the growth matches the payment frequency." },
        principle: "When steps are annual but payments are m-thly, value one year's payments as a block, then treat the blocks as an annual geometric annuity.",
        unusual: "Three frequencies in one stream, then a regime change.",
        misread: "Treating the perpetuity as starting a year later.",
        presentation: ["frequency", "deferred", "mixed-timing", "valuation-date"],
        features: { multipleValuationDates: true },
        params: { kase, i4, j, g, n, R, Q },
        route: "convert, block, geometric, perpetuity-due, discount, add",
      });
    }
    const PV = Math.round(ans.v);
    const eqWith = (o: Parameters<typeof pv>[0]): Eq => ({ eq: (x: X) => sub(pv({ ...o, gg: x }), PV), lo: -0.05, hi: 0.12 });
    return elite({
      stem: `${stemCore.replace(`increases by ${pc(g, 1)}`, "increases by a percentage $g$")}\n\nThe present value of all the plan's payments is ${amt(PV)}. Calculate $g$.`,
      fmt: PCT3,
      answer: eqWith({}),
      model: { eq: (x: X) => sub(model(x), PV), lo: -0.05, hi: 0.12 },
      modelDescription: "Equation of value with each monthly payment written out, solved for the annual growth rate.",
      traps: [
        { id: "RATE_NOMINAL_AS_EFFECTIVE", value: eqWith({ rate: K(i4) }), label: "quarterly nominal used as effective", method: `Used ${pct(i4)} as effective.`, feedback: "Convert the quarterly nominal rate first." },
        { id: "CONC_ANN_MTHLY_PAYMENT_SIZE", value: eqWith({ annual12: true }), label: "monthly payments lumped at year end", method: "Treated each year's payments as one year-end payment.", feedback: "Use a monthly block factor." },
        { id: "TIMING_DUE_AS_IMMEDIATE", value: eqWith({ perpImmediate: true }), label: "perpetuity-immediate", method: "Valued the perpetuity as immediate.", feedback: `Its first payment is at time ${n}.` },
        { id: "MODEL_SINGLE_RATE", value: eqWith({ perpRate: i.v }), label: "one rate for the perpetuity too", method: `Valued the perpetuity at ${pct(i.v)}.`, feedback: `The rate after time ${n} is ${pct(j)}.` },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: eqWith({ firstGrown: true }), label: "growth applied in the first year", method: "Grew the first year's payments too.", feedback: "Growth starts in year 2." },
      ],
      steps: [...commonSteps, step("A.equation-of-value", "Equation of value in g.", ["PV", PV, "given present value"], ["parts"], { derived: true }), step("M.root-finding", "Solve for the growth rate.", ["g", g, "annual growth rate"], ["equation"], { rearranged: true })],
      methods: ["equation_construction", "geometric_series", "numerical_root"],
      reasoning: "Value the perpetuity (no unknown), subtract it from the price, and solve the geometric block equation for g.",
      intuition: "The perpetuity part does not depend on g: peel it off first, then only the growing part is left to solve.",
      unknowns: [{ symbol: "$g$", meaning: "annual growth rate of the monthly amount" }],
      relationships: ["$PV - \\dfrac{Q(1+j)}{j}v^n = R\\cdot(\\text{block})\\cdot\\sum (1+g)^k v^k$"],
      conditions: ["Payments level within each year."],
      valuationDate: "Time 0",
      modelChoice: "Equation of value with the unknown inside a geometric sum.",
      assumptions: ["Growth is the same every year."],
      principle: "Separate the parts that do not involve the unknown before solving.",
      unusual: "The unknown is a growth rate inside a multi-frequency stream.",
      misread: "Valuing the perpetuity at the first-regime rate.",
      presentation: ["inverse", "frequency", "deferred", "mixed-timing"],
      features: { multipleValuationDates: true },
      params: { kase, i4, j, g, n, R, Q, PV },
      route: "convert, block, perpetuity, isolate, solve growth",
    });
  },
};

// ===================================================================== 2. Discrete varying streams under a varying force of interest

const varyingForceStream: QuestionTemplate = {
  id: "el-ann-varying-force-stream",
  family: "el-ann-varying-force-stream",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.non_level",
  secondary: ["TVM.variable_force", "ANNUITIES.arithmetic", "ANNUITIES.geometric"],
  reasoning: ["formula_reconstruction", "cashflow_modelling", "multistep", "algebra"],
  soaConcept: "Annual payments valued under a varying force of interest: no annuity symbol applies, so the discount function is built from the force and the stream decomposed by hand.",
  generate(rng): QuestionDraft {
    const n = rng.int(6, 12);
    const name = nameOf(rng);
    const kase = pick(rng, ["arithmetic", "geometric"]);
    const sumK = (from: number, f: (k: number) => X) => flows(n, (t) => f(t + from));
    if (kase === "arithmetic") {
      const a = pick(rng, [8, 10, 12, 15, 20, 25]);
      const c = gridAmount(rng, 500, 3000, 100);
      const d = gridAmount(rng, 50, 400, 25);
      const H = sumK(1, (k) => div(1, a + k));
      const level = (v: (k: number) => X, shift = 0) => div(sumK(1, (k) => mul(c + d * (k - 1) + shift, v(k))), sumK(1, v));
      const ans = add(div(mul(d, n), H), c - d - d * a);
      return elite({
        stem: `${name} will receive ${amt(c)} at the end of year 1, ${amt(c + d)} at the end of year 2, and so on, increasing by ${amt(d)} each year, for ${n} years. Money is valued with the force of interest $\\delta_t = \\dfrac{1}{${a} + t}$.\n\n${name} exchanges this for a level payment $Y$ at the end of each year for ${n} years, valued with the same force of interest, with equal present value. Calculate $Y$.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(mul(x, sumK(1, (k) => div(a, a + k))), sumK(1, (k) => mul(c + d * (k - 1), div(a, a + k)))), lo: c * 0.5, hi: c + d * n * 2 },
        modelDescription: "Each payment discounted with v(t) = a/(a + t), equated to the level payments discounted the same way.",
        traps: [
          { id: "MODEL_CONSTANT_FORCE", value: level((k) => exp(-k / a)), label: "force frozen at its initial value", method: `Used a constant force of $1/${a}$.`, feedback: "The force falls over time: $v(t) = a/(a+t)$." },
          { id: "SEQ_UNDISCOUNTED_SUM", value: K(c + (d * (n - 1)) / 2), label: "simple average payment", method: "Took the average of the payments.", feedback: "Later payments are discounted more, so the equivalent level payment is below the simple average." },
          { id: "TIMING_IMMEDIATE_AS_DUE", value: level((k) => div(a, a + k - 1)), label: "payments at the start of each year", method: "Discounted each payment from the start of its year.", feedback: "Payments are at the ends of years." },
          { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: level((k) => exp(-k / (a + k))), label: "force times time", method: "Used $e^{-\\delta_t t}$ as the discount factor.", feedback: "Integrate: $\\exp(-\\int_0^t \\frac{dr}{a+r}) = \\frac{a}{a+t}$." },
          { id: "VAR_OTHER_UNKNOWN", value: mul(a, add(mul(d, n), mul(c - d - d * a, H))), label: "present value of the stream", method: "Gave the present value.", feedback: "The question asks for the level payment Y." },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: level((k) => div(a, a + k), d), label: "first payment already increased", method: `Started the payments at ${amt(c + d)}.`, feedback: `The first payment is ${amt(c)}.` },
        ],
        steps: [
          step("A.force-accumulation", "Discount function from the force.", ["v(t)", a / (a + n), `discount factor at time ${n}`], ["\\delta_t"]),
          step("A.discount-factor", "Present value of 1 at the end of each year.", ["aH", mul(a, H).v, "annuity of 1 per year under the force"], ["v(t)"]),
          step("B.increasing", "Split each payment as $d(a+k) + (c - d - da)$ so the fraction cancels.", ["PV", mul(a, add(mul(d, n), mul(c - d - d * a, H))).v, "present value of the stream"], ["c", "d", "v(t)"], { derived: true }),
          step("A.equation-of-value", "Divide by the annuity of 1.", ["Y", ans.v, "level payment"], ["PV", "aH"], { rearranged: true }),
        ],
        methods: ["decomposition", "equation_construction", "rearrangement"],
        reasoning: "Integrate the force to get v(t) = a/(a+t); split each payment so that (c + d(k−1))·a/(a+k) becomes a level part plus a multiple of a/(a+k); divide by the sum of discount factors.",
        intuition: "No annuity symbol works under this force: build v(t), then the algebra of the payments does the rest.",
        unknowns: [{ symbol: "$Y$", meaning: "equivalent level payment" }],
        relationships: [`$v(t) = \\dfrac{${a}}{${a} + t}$`, "$Y = \\dfrac{\\sum (c + d(k-1))v(k)}{\\sum v(k)}$"],
        conditions: ["Both streams are valued with the same force."],
        valuationDate: "Time 0",
        modelChoice: "Discount function from a varying force; equivalence of streams.",
        assumptions: ["The force applies to every payment."],
        principle: "Under a varying force, v(t) = exp(−∫δ); the equivalent level payment is a discount-weighted average.",
        unusual: "An arithmetic stream under a varying force.",
        misread: "Freezing the force at its initial value.",
        presentation: ["compare-streams", "hidden-structure", "rearrange-first", "mixed-timing"],
        params: { kase, n, c, d, a },
        route: "discount function, sum, decompose, divide",
      });
    }
    const Kc = pick(rng, [25, 40, 50, 64, 80, 100]);
    const g = pick(rng, [0.02, 0.03, 0.04, 0.05]);
    const P0 = gridAmount(rng, 20000, 80000, 1000);
    const v = (k: number) => div(Kc, Kc + k * k);
    const coeff = (o: { vf?: (k: number) => X; shift?: number; arith?: boolean; grown?: boolean } = {}) =>
      sumK(1, (k) => mul(o.arith ? 1 + g * (k - 1) : Math.pow(1 + g, k - 1 + (o.grown ? 1 : 0)), (o.vf ?? v)(k + (o.shift ?? 0))));
    const ans = div(P0, coeff());
    return elite({
      stem: `${name} buys, for ${amt(P0)}, a contract paying $R$ at the end of year 1 and then, at the end of each later year for a total of ${n} payments, ${pc(g, 1)} more than the previous payment. The price is set using the force of interest $\\delta_t = \\dfrac{2t}{${Kc} + t^2}$.\n\nCalculate $R$.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (x: X) => sub(sumK(1, (k) => mul(x, pow(1 + g, k - 1), exp(mul(-1, ln((Kc + k * k) / Kc))))), P0), lo: ans.v * 0.3, hi: ans.v * 3 },
      modelDescription: "Each payment discounted by exp(−∫₀ᵗ δ) written as an exponential of a logarithm, equated to the price.",
      traps: [
        { id: "CONC_TVM_FORCE_NOT_INTEGRATED", value: div(P0, coeff({ vf: (k) => exp((-2 * k * k) / (Kc + k * k)) })), label: "force times time", method: "Discounted by $e^{-\\delta_t t}$.", feedback: `Integrate: $\\exp(-\\int_0^t \\delta_r dr) = \\frac{${Kc}}{${Kc} + t^2}$.` },
          { id: "SEQ_GEOMETRIC_AS_ARITHMETIC", value: div(P0, coeff({ arith: true })), label: "growth treated as arithmetic", method: `Increased each payment by ${pc(g, 1)} of R.`, feedback: "Each payment is the previous one times $(1 + g)$." },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: div(P0, coeff({ grown: true })), label: "first payment already grown", method: "Grew the first payment.", feedback: "The first payment is R." },
        { id: "TIMING_IMMEDIATE_AS_DUE", value: div(P0, coeff({ shift: -1 })), label: "payments at the start of each year", method: "Discounted from the start of each year.", feedback: "Payments are at the ends of years." },
        { id: "SEQ_UNDISCOUNTED_SUM", value: div(P0, coeff({ vf: () => K(1) })), label: "payments not discounted", method: "Divided the price by the sum of the growth factors.", feedback: "Discount each payment with $v(t)$." },
      ],
      steps: [
        step("A.force-accumulation", "Discount function from the force.", ["v(t)", Kc / (Kc + n * n), `discount factor at time ${n}`], ["\\delta_t"]),
        step("B.geometric-annuity", "Payments as R times the growth factors.", ["(1+g)^{n-1}", Math.pow(1 + g, n - 1), "growth factor of the last payment"], ["g"]),
        step("A.discount-factor", "Present value of the stream per unit of R.", ["c", coeff().v, "value per unit of R"], ["v(t)", "g"]),
        step("A.equation-of-value", "Solve the price equation for R.", ["R", ans.v, "first payment"], ["P", "c"], { rearranged: true }),
      ],
      methods: ["equation_construction", "rearrangement", "geometric_series"],
      reasoning: "Integrate the force to get v(t) = K/(K + t²), value the growing payments per unit of R term by term, and divide the price by that value.",
      intuition: "The force does not give a constant ratio between successive discount factors, so the geometric-annuity formula cannot be used: sum term by term.",
      unknowns: [{ symbol: "$R$", meaning: "first payment" }],
      relationships: [`$v(t) = \\dfrac{${Kc}}{${Kc} + t^2}$`, "$P = R\\sum (1+g)^{k-1} v(k)$"],
      conditions: ["Payments at year ends."],
      valuationDate: "Time 0",
      modelChoice: "Term-by-term valuation under a varying force.",
      assumptions: ["The force applies to every payment."],
      principle: "Annuity formulas need a constant per-period discount; under a varying force, value each payment separately.",
      unusual: "Geometric payments where the geometric-annuity shortcut does not apply.",
      misread: "Using $e^{-\\delta_t t}$.",
      presentation: ["inverse", "hidden-structure", "rearrange-first", "compare-streams"],
      params: { kase, n, Kc, g, P0 },
      route: "discount function, growth, value per unit, solve",
    });
  },
};

// ===================================================================== 3. Career savings with a withdrawal, then a monthly retirement perpetuity

const careerFund: QuestionTemplate = {
  id: "el-ann-career-fund",
  family: "el-ann-career-fund",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.geometric", "ANNUITIES.perpetuities", "ANNUITIES.frequency_timing"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "translation"],
  soaConcept: "A growing savings stream with a partial withdrawal funds a monthly perpetuity-due at retirement under a different rate.",
  generate(rng): QuestionDraft {
    const n = rng.int(15, 30);
    const k = rng.int(5, n - 5);
    const i = gridRate(rng, 0.04, 0.08, 0.0025);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.06, 0.0025), (x) => Math.abs(x - i) >= 0.01);
    const g = drawUntil(() => pick(rng, [0.02, 0.025, 0.03, 0.035, 0.04]), (x) => i - x >= 0.0075);
    const R = gridAmount(rng, 2000, 8000, 250);
    const name = nameOf(rng);
    const kase = pick(rng, ["income", "deposit"]);
    const fund = (o: { r?: X | number; firstGrown?: boolean; noW?: boolean; wExtra?: number; rate?: number; W: number }) => {
      const rate = o.rate ?? i;
      const r = o.r ?? R;
      const dep = div(mul(r, o.firstGrown ? 1 + g : 1, sub(at(rate, n), pow(1 + g, n))), rate - g);
      return o.noW ? dep : sub(dep, mul(o.W, at(rate, n - k + (o.wExtra ?? 0))));
    };
    const W = Math.round((fund({ W: 0, noW: true }).v * Math.pow(1 + i, k - n) * (0.15 + rng.next() * 0.2)) / 100) * 100;
    const monthly = (F: X, o: { immediate?: boolean; divided?: boolean } = {}) => (o.divided ? div(mul(F, j / 12), 1 + j / 12) : o.immediate ? mul(F, perK(j, 1 / 12)) : mul(F, sub(1, pow(1 + j, -1 / 12))));
    const explicitFund = (r: X | number) => sub(flows(n, (t) => mul(r, pow(1 + g, t), at(i, n - t - 1))), W * Math.pow(1 + i, n - k));
    const setup = (first: string) => `${name} makes deposits into a retirement fund at the end of each year for ${n} years. The first deposit is ${first}, and each later deposit is ${pc(g, 1)} larger than the one before. At time ${k}, immediately after that year's deposit, ${name} withdraws ${amt(W)} for a home purchase. The fund earns an annual effective rate of ${pct(i)} until time ${n}. At time ${n} the whole fund buys a perpetuity paying a level amount at the beginning of each month, priced at an annual effective rate of ${pct(j)}.`;
    if (kase === "income") {
      const ans = monthly(fund({ W }));
      return elite({
        stem: `${setup(amt(R))}\n\nCalculate the monthly perpetuity payment.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(div(x, sub(1, pow(1 + j, -1 / 12))), explicitFund(R)), lo: ans.v * 0.3, hi: ans.v * 3 },
        modelDescription: "Each deposit accumulated separately to the retirement date, less the accumulated withdrawal, equated to the monthly perpetuity-due.",
        traps: [
          { id: "TIMING_DUE_AS_IMMEDIATE", value: monthly(fund({ W }), { immediate: true }), label: "monthly perpetuity-immediate", method: "Priced the perpetuity as payable at the ends of months.", feedback: "Payments are at the beginning of each month." },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: monthly(fund({ W, firstGrown: true })), label: "first deposit already grown", method: `Took the first deposit as ${amt(R)}(1 + g).`, feedback: `The first deposit is ${amt(R)}.` },
          { id: "TRANS_IGNORED_CONDITION", value: monthly(fund({ W, noW: true })), label: "withdrawal ignored", method: "Left out the withdrawal.", feedback: `The ${amt(W)} withdrawn at time ${k} loses ${n - k} years of interest.` },
          { id: "RATE_DIVIDED_EFFECTIVE", value: monthly(fund({ W }), { divided: true }), label: "monthly rate as j over 12", method: `Used ${pct(j)}/12 as the monthly rate.`, feedback: `The monthly effective rate is $(1 + j)^{1/12} - 1$.` },
          { id: "MODEL_SINGLE_RATE", value: monthly(fund({ W, rate: j })), label: "pricing rate used for accumulation", method: `Accumulated the fund at ${pct(j)}.`, feedback: `The fund earns ${pct(i)} before retirement.` },
          { id: "TIMING_EXTRA_PERIOD", value: monthly(fund({ W, wExtra: 1 })), label: "withdrawal accumulated a year too long", method: `Accumulated the withdrawal ${n - k + 1} years.`, feedback: `From time ${k} to ${n} is ${n - k} years.` },
        ],
        steps: [
          step("B.geometric-annuity", "Accumulated value of the growing deposits.", ["S", fund({ W, noW: true }).v, "deposits at retirement"], ["R", "g", "i"]),
          step("A.accumulation", "Withdrawal accumulated to retirement.", ["W_n", W * Math.pow(1 + i, n - k), "withdrawal at retirement"], ["W", "i"]),
          step("A.equation-of-value", "Fund at retirement.", ["F", fund({ W }).v, "fund at retirement"], ["S", "W_n"]),
          step("A.nominal-equivalence", "Monthly discount at the pricing rate.", ["d_{1/12}", 1 - Math.pow(1 + j, -1 / 12), "monthly effective discount"], ["j"]),
          step("B.perpetuity", "Monthly perpetuity-due payment.", ["M", ans.v, "monthly payment"], ["F", "d"], { rearranged: true }),
        ],
        methods: ["decomposition", "valuation_dates", "geometric_series"],
        reasoning: "Accumulate the geometric deposits, subtract the accumulated withdrawal, and divide by the value of a monthly perpetuity-due of 1.",
        intuition: "Everything meets at the retirement date: what the fund has there must buy the perpetuity.",
        unknowns: [{ symbol: "$M$", meaning: "monthly perpetuity payment" }],
        relationships: ["$F = R\\dfrac{(1+i)^n - (1+g)^n}{i - g} - W(1+i)^{n-k}$", "$M = F\\,(1 - (1+j)^{-1/12})$"],
        conditions: ["The withdrawal is made right after the deposit at that time."],
        valuationDate: `Time ${n}`,
        modelChoice: "Accumulated geometric annuity and a monthly perpetuity-due.",
        assumptions: ["The perpetuity is priced at the stated rate."],
        principle: "A perpetuity-due of 1 per month is worth 1/d per month, with d the monthly effective discount rate.",
        unusual: "Two rates, a withdrawal, growth and a monthly perpetuity-due.",
        misread: "Dividing the annual rate by 12.",
        presentation: ["valuation-date", "mixed-timing", "frequency", "irrelevant-info"],
        features: { multipleValuationDates: true },
        params: { kase, n, k, i, j, g, R, W },
        route: "accumulate, subtract, perpetuity-due",
      });
    }
    const M = Math.round(monthly(fund({ W })).v);
    const Fneed = M / (1 - Math.pow(1 + j, -1 / 12));
    const depositFor = (o: { immediate?: boolean; firstGrown?: boolean; noW?: boolean; divided?: boolean; rate?: number }) => {
      const need = o.immediate ? M / (Math.pow(1 + j, 1 / 12) - 1) : o.divided ? (M * (1 + j / 12)) / (j / 12) : Fneed;
      const rate = o.rate ?? i;
      const unit = div(mul(o.firstGrown ? 1 + g : 1, sub(at(rate, n), pow(1 + g, n))), rate - g);
      return div(add(need, o.noW ? 0 : mul(W, at(rate, n - k))), unit);
    };
    const ans = depositFor({});
    return elite({
      stem: `${setup("$D$")} The perpetuity pays ${amt(M)} per month.\n\nCalculate $D$.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (x: X) => sub(explicitFund(x), M / (1 - Math.pow(1 + j, -1 / 12))), lo: ans.v * 0.3, hi: ans.v * 3 },
      modelDescription: "Each deposit (a multiple of D) accumulated separately, less the withdrawal, equated to the price of the perpetuity.",
      traps: [
        { id: "TIMING_DUE_AS_IMMEDIATE", value: depositFor({ immediate: true }), label: "monthly perpetuity-immediate", method: "Priced the perpetuity as immediate.", feedback: "Payments are at the beginning of each month." },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: depositFor({ firstGrown: true }), label: "first deposit already grown", method: "Grew the first deposit.", feedback: "The first deposit is D." },
        { id: "TRANS_IGNORED_CONDITION", value: depositFor({ noW: true }), label: "withdrawal ignored", method: "Left out the withdrawal.", feedback: "The withdrawal must be replaced by extra saving." },
        { id: "RATE_DIVIDED_EFFECTIVE", value: depositFor({ divided: true }), label: "monthly rate as j over 12", method: "Used j/12 monthly.", feedback: "Use $(1+j)^{1/12} - 1$." },
        { id: "MODEL_SINGLE_RATE", value: depositFor({ rate: j }), label: "pricing rate used for accumulation", method: `Accumulated at ${pct(j)}.`, feedback: `Accumulate at ${pct(i)}.` },
      ],
      steps: [
        step("B.perpetuity", "Price of the monthly perpetuity-due at retirement.", ["F", Fneed, "fund needed at retirement"], ["M", "j"]),
        step("A.accumulation", "Withdrawal accumulated to retirement.", ["W_n", W * Math.pow(1 + i, n - k), "withdrawal at retirement"], ["W", "i"]),
        step("B.geometric-annuity", "Accumulated value of growing deposits of 1.", ["s_g", div(sub(at(i, n), pow(1 + g, n)), i - g).v, "geometric accumulation factor"], ["g", "i"]),
        step("A.equation-of-value", "Deposits must cover the price plus the withdrawal.", ["D", ans.v, "first deposit"], ["F", "W_n", "s_g"], { rearranged: true }),
      ],
      methods: ["work_backwards", "geometric_series", "valuation_dates"],
      reasoning: "Price the perpetuity at retirement, add back the accumulated withdrawal, and divide by the accumulation factor of growing deposits of 1.",
      intuition: "Work backwards from the retirement date.",
      unknowns: [{ symbol: "$D$", meaning: "first deposit" }],
      relationships: ["$D\\,\\dfrac{(1+i)^n - (1+g)^n}{i-g} - W(1+i)^{n-k} = \\dfrac{M}{1 - (1+j)^{-1/12}}$"],
      conditions: ["Growth applies from the second deposit."],
      valuationDate: `Time ${n}`,
      modelChoice: "Equation of value at retirement.",
      assumptions: ["Rates as stated."],
      principle: "Compare everything at one date — here the retirement date.",
      unusual: "The unknown is the first deposit of a growing stream.",
      misread: "Forgetting the withdrawal.",
      presentation: ["work-backwards", "valuation-date", "frequency", "mixed-timing"],
      features: { multipleValuationDates: true },
      params: { kase, n, k, i, j, g, W, M },
      route: "price perpetuity, add withdrawal, solve deposit",
    });
  },
};

// ===================================================================== 4. Pyramid every k years / deferred increasing perpetuity every k years

const pyramidEveryK: QuestionTemplate = {
  id: "el-ann-pyramid-every-k",
  family: "el-ann-pyramid-every-k",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.frequency_timing", "ANNUITIES.perpetuities", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "formula_selection", "multistep", "valuation_dates"],
  soaConcept: "Arithmetic payments made every k years: convert to the k-year effective rate, then use increasing and decreasing annuity factors.",
  generate(rng): QuestionDraft {
    const k = pick(rng, [2, 3, 4]);
    const P = gridAmount(rng, 200, 1500, 50);
    const name = nameOf(rng);
    const kase = pick(rng, ["pyramid", "deferred-perpetuity"]);
    if (kase === "pyramid") {
      const i2 = gridRate(rng, 0.04, 0.08, 0.0025);
      const n = rng.int(4, 8);
      const i = fromNominal(i2, 2);
      const pyr = (o: { j?: X; daTerms?: number; defer?: number; incOnly?: boolean; shift?: number }) => {
        const j = o.j ?? perK(i, k);
        const second = o.incOnly ? ia(j, n - 1) : da(j, o.daTerms ?? n - 1);
        return mul(P, add(ia(j, n), mul(vt(j, o.defer ?? n), second)), vt(j, o.shift ?? 0));
      };
      const ans = pyr({});
      const amounts = [...Array.from({ length: n }, (_, t) => t + 1), ...Array.from({ length: n - 1 }, (_, t) => n - 1 - t)];
      return elite({
        stem: `${name} receives payments every ${k} years, the first at time ${k}. The payments are ${amt(P)}, ${amt(2 * P)}, ${amt(3 * P)}, …, rising to ${amt(n * P)} and then falling by ${amt(P)} each time until a final payment of ${amt(P)}. Interest is at a nominal annual rate of ${pct(i2)} convertible semiannually.\n\nCalculate the present value of the payments.`,
        fmt: MONEY2,
        answer: ans,
        model: sum(amounts.map((mult, t) => mul(P * mult, pow(1 + i2 / 2, -2 * k * (t + 1))))),
        modelDescription: "Each payment discounted half-year by half-year at the semiannual rate.",
        traps: [
          { id: "CONC_ANN_KYEAR_DIVISOR", value: pyr({ j: mul(k, i) }), label: "k times the annual rate", method: `Used ${k}i as the ${k}-year rate.`, feedback: `The ${k}-year effective rate is $(1+i)^{${k}} - 1$.` },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: pyr({ j: perK(i2, k) }), label: "semiannual nominal used as effective", method: `Used ${pct(i2)} as annual effective.`, feedback: `$i = (1 + ${dec(i2 / 2, 5)})^2 - 1$.` },
          { id: "SEQ_TERM_COUNT", value: pyr({ daTerms: n }), label: "decreasing part one term too long", method: `Used $(Da)_{\\overline{${n}|}}$ for the falling part.`, feedback: `After the peak there are ${n - 1} payments.` },
          { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: pyr({ defer: n + 1 }), label: "falling part deferred one period too long", method: `Deferred the falling part ${n + 1} periods.`, feedback: `The falling part starts right after the ${n}th payment: defer ${n} periods of ${k} years.` },
          { id: "FORMULA_DECREASING_FOR_INCREASING", value: pyr({ incOnly: true }), label: "increasing factor for the falling part", method: "Used an increasing factor for the falling payments.", feedback: "The second half decreases: use (Da)." },
          { id: "TIMING_IMMEDIATE_AS_DUE", value: pyr({ shift: -1 }), label: "first payment at time zero", method: "Started the payments at time 0.", feedback: `The first payment is at time ${k}.` },
        ],
        steps: [
          step("A.nominal-equivalence", "Annual effective rate.", ["i", i.v, "annual effective rate"], ["i^(2)"]),
          step("B.fission", `Effective rate per ${k}-year period.`, ["j", perK(i, k).v, `${k}-year effective rate`], ["i"]),
          step("B.increasing", "Rising part.", ["(Ia)", ia(perK(i, k), n).v, "increasing factor"], ["j"]),
          step("B.decreasing", "Falling part, deferred to the peak.", ["v^n(Da)", mul(vt(perK(i, k), n), da(perK(i, k), n - 1)).v, "deferred decreasing factor"], ["j"]),
          step("A.equation-of-value", "Add and scale.", ["PV", ans.v, "present value"], ["parts"]),
        ],
        methods: ["decomposition", "arithmetic_series", "valuation_dates"],
        reasoning: `Convert to the ${k}-year effective rate, then the pyramid is an increasing annuity followed by a deferred decreasing one.`,
        intuition: "Treat each k-year gap as one period at the k-year rate; then the shapes are standard.",
        unknowns: [{ symbol: "$PV$", meaning: "present value" }],
        relationships: ["$j = (1+i)^k - 1$", "$PV = P[(Ia)_{\\overline{n|}j} + v_j^n (Da)_{\\overline{n-1|}j}]$"],
        conditions: [`Payments every ${k} years.`],
        valuationDate: "Time 0",
        modelChoice: "Increasing and decreasing annuities at the k-year rate.",
        assumptions: ["Constant rate."],
        alternative: { name: "Pyramid identity", body: "$(Ia)_{\\overline{n|}} + v^n(Da)_{\\overline{n-1|}} = a_{\\overline{n|}}\\,\\ddot a_{\\overline{n|}}$ at the k-year rate.", whenUseful: "A one-line check." },
        principle: "Payments every k years are an ordinary annuity at the k-year effective rate.",
        unusual: "A pyramid paid every k years under a semiannual rate.",
        misread: "Using k·i as the k-year rate.",
        presentation: ["frequency", "hidden-structure", "deferred", "combined-topics"],
        params: { kase, k, P, i2, n },
        route: "convert, fission, increasing, deferred decreasing",
      });
    }
    const delta = gridRate(rng, 0.04, 0.08, 0.0025);
    const i = sub(exp(delta), 1);
    const m = rng.int(2, 5);
    const perp = (o: { j?: X; isq?: boolean; defer?: number }) => {
      const j = o.j ?? perK(i, k);
      const ip = o.isq ? div(1, mul(j, j)) : div(add(1, j), mul(j, j));
      return mul(P, ip, vt(j, o.defer ?? m));
    };
    const ans = perp({});
    const jj = perK(i, k);
    return elite({
      stem: `A fund will pay ${amt(P)} at time ${k * (m + 1)}, ${amt(2 * P)} at time ${k * (m + 2)}, ${amt(3 * P)} at time ${k * (m + 3)}, and so on, increasing by ${amt(P)} every ${k} years forever. Money is valued at a constant force of interest of ${pct(delta)}.\n\nCalculate the present value of the payments.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(P, div(exp(mul(-delta, k * (m + 1))), pow(sub(1, exp(-delta * k)), 2))),
      modelDescription: "Σ (t+1)·v^{k(m+1+t)} summed in closed form as v^{k(m+1)}/(1 − v^k)².",
      traps: [
        { id: "CONC_ANN_IA_PERP_ISQ", value: perp({ isq: true }), label: "one over j squared", method: "Used $1/j^2$ for the increasing perpetuity.", feedback: "An increasing perpetuity-immediate is $1/j + 1/j^2 = (1+j)/j^2$." },
        { id: "RATE_FORCE_AS_EFFECTIVE", value: perp({ j: perK(delta, k) }), label: "force used as effective rate", method: `Used ${pct(delta)} as annual effective.`, feedback: `$i = e^{${dec(delta, 4)}} - 1$.` },
        { id: "CONC_ANN_KYEAR_DIVISOR", value: perp({ j: mul(k, i) }), label: "k times the annual rate", method: `Used ${k}i as the ${k}-year rate.`, feedback: `Use $(1+i)^{${k}} - 1$.` },
        { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: perp({ defer: m + 1 }), label: "deferred one period too long", method: `Deferred ${m + 1} periods.`, feedback: `The perpetuity-immediate value sits one period before the first payment: time ${k * m}.` },
        { id: "MODEL_LEVEL_FOR_VARYING", value: mul(P, div(1, jj), vt(jj, m)), label: "level perpetuity", method: "Valued the payments as a level perpetuity of P.", feedback: "The payments increase by P each time: use the increasing perpetuity." },
        { id: "CONC_ANN_PERP_VALUE_DATE", value: perp({ defer: m - 1 }), label: "deferred one period too few", method: `Deferred ${m - 1} periods.`, feedback: `Defer ${m} periods of ${k} years.` },
      ],
      steps: [
        step("A.constant-force", "Annual effective rate.", ["i", i.v, "annual effective rate"], ["\\delta"]),
        step("B.fission", `Rate per ${k}-year period.`, ["j", jj.v, `${k}-year effective rate`], ["i"]),
        step("B.increasing-perpetuity", "Increasing perpetuity-immediate in k-year periods.", ["(Ia)_\\infty", div(add(1, jj), mul(jj, jj)).v, "increasing perpetuity factor"], ["j"]),
        step("B.deferred", `Defer ${m} periods.`, ["v_j^m", vt(jj, m).v, "deferral factor"], ["j"]),
        step("A.equation-of-value", "Scale and combine.", ["PV", ans.v, "present value"], ["parts"]),
      ],
      methods: ["decomposition", "valuation_dates"],
      reasoning: `Convert the force to the ${k}-year effective rate; the payments are an increasing perpetuity-immediate deferred ${m} periods.`,
      intuition: "Count in k-year periods: the first payment is at period m+1.",
      unknowns: [{ symbol: "$PV$", meaning: "present value" }],
      relationships: ["$PV = P\\,v_j^{m}\\,\\dfrac{1+j}{j^2}$"],
      conditions: ["Payments every k years forever."],
      valuationDate: "Time 0",
      modelChoice: "Deferred increasing perpetuity at the k-year rate.",
      assumptions: ["Constant force."],
      principle: "The increasing perpetuity-immediate is (1 + j)/j².",
      unusual: "Every-k-year payments valued under a force of interest.",
      misread: "Using 1/j² for the increasing perpetuity.",
      presentation: ["frequency", "deferred", "hidden-structure", "valuation-date"],
      features: { multipleValuationDates: true },
      params: { kase, k, P, delta, m },
      route: "convert, fission, increasing perpetuity, defer",
    });
  },
};

// ===================================================================== 5. P/Q payments monthly, stepping annually, deferred

const pqMonthly: QuestionTemplate = {
  id: "el-ann-pq-mthly",
  family: "el-ann-pq-mthly",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.frequency_timing", "ANNUITIES.immediate_due", "ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "formula_reconstruction", "multistep", "valuation_dates"],
  soaConcept: "Monthly payments that increase arithmetically once a year, deferred: the P and Q decomposition with the i/i^(12) adjustment.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.0025);
    const n = rng.int(6, 12);
    const m = rng.int(2, 6);
    const P = gridAmount(rng, 200, 1200, 50);
    const Q = gridAmount(rng, 20, 150, 5);
    const name = nameOf(rng);
    const kase = pick(rng, ["value", "unknown-step"]);
    const i12 = mul(12, perK(i, 1 / 12));
    const core = (q: X | number, o: { split?: boolean; no12?: boolean; ratio1?: boolean; defer?: number; geometric?: boolean }) => {
      const ratio = o.ratio1 ? K(1) : div(i, i12);
      const base = o.geometric ? mul(P, mul(geoA(i, div(q, P), n), 1)) : o.split ? add(mul(P, an(i, n)), mul(q, ia(i, n))) : add(mul(sub(P, q), an(i, n)), mul(q, ia(i, n)));
      return mul(o.no12 ? 1 : 12, ratio, base, vt(i, o.defer ?? m));
    };
    const explicit = (q: X | number) => flows(12 * n, (t) => mul(add(P, mul(q, Math.floor(t / 12))), vt(i, m + (t + 1) / 12)));
    const ans = core(Q, {});
    const stemBase = `Starting one month after time ${m}, ${name} receives monthly payments for ${n} years. Each payment during the first year is ${amt(P)}; each payment during year $k$ of the stream is larger than each payment in year $k-1$ by`;
    const commonSteps = [
      step("A.nominal-conversion", "Nominal rate convertible monthly.", ["i^{(12)}", i12.v, "nominal monthly-convertible rate"], ["i"]),
      step("B.increasing", "Annual increasing factor.", ["(Ia)", ia(i, n).v, "increasing annuity factor"], ["i"]),
      step("B.mthly-annuity", "P − Q decomposition with the i/i^(12) adjustment.", ["V_m", mul(12, div(i, i12), add(mul(P - Q, an(i, n)), mul(Q, ia(i, n)))).v, `value at time ${m}`], ["P", "Q", "a", "(Ia)"]),
      step("B.deferred", `Defer ${m} years.`, ["V_0", ans.v, "present value"], ["V_m"]),
    ];
    if (kase === "value") {
      return elite({
        stem: `${stemBase} ${amt(Q)}. The annual effective rate of interest is ${pct(i)}.\n\nCalculate the present value of the payments at time 0.`,
        fmt: MONEY2,
        answer: ans,
        model: explicit(Q),
        modelDescription: "Each monthly payment discounted individually.",
        traps: [
          { id: "CONC_ANN_ARITH_BASE_SPLIT", value: core(Q, { split: true }), label: "P a plus Q Ia", method: "Used $P a + Q(Ia)$.", feedback: "The first year's payment is P, so the split is $(P - Q)a + Q(Ia)$." },
          { id: "CONC_ANN_MTHLY_PAYMENT_SIZE", value: core(Q, { no12: true }), label: "monthly amount used as annual", method: "Left out the factor 12.", feedback: "Each year has twelve payments." },
          { id: "RATE_DIVIDED_EFFECTIVE", value: core(Q, { ratio1: true }), label: "no monthly adjustment", method: "Treated each year's twelve payments as paid at the year end.", feedback: "Monthly payments are worth more: multiply by $i/i^{(12)}$." },
          { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: core(Q, { defer: m + 1 }), label: "deferred a year too long", method: `Deferred ${m + 1} years.`, feedback: `The stream starts just after time ${m}.` },
          { id: "SEQ_ARITHMETIC_AS_GEOMETRIC", value: core(Q, { geometric: true }), label: "steps treated as geometric", method: `Grew the payments at ${pc(Q / P, 2)} per year.`, feedback: "The increase is a fixed amount, not a percentage." },
        ],
        steps: [...commonSteps],
        methods: ["decomposition", "arithmetic_series", "valuation_dates"],
        reasoning: "Write each year's monthly payments as (P − Q) + Qk, use a and (Ia) at the annual rate, adjust for monthly payment with i/i^(12), and defer.",
        intuition: "Annual steps → annual factors; monthly payment within the year → the i/i^(12) adjustment.",
        unknowns: [{ symbol: "$PV$", meaning: "present value" }],
        relationships: ["$PV = 12\\dfrac{i}{i^{(12)}}[(P-Q)a_{\\overline{n|}} + Q(Ia)_{\\overline{n|}}]\\,v^m$"],
        conditions: ["Level within each year."],
        valuationDate: "Time 0",
        modelChoice: "P−Q decomposition with an m-thly adjustment.",
        assumptions: ["Constant rate."],
        principle: "m-thly payments level within each year have value (i/i^(m)) times the annual-in-arrears value.",
        unusual: "Deferred, monthly, and stepping annually.",
        misread: "Splitting into P·a + Q·(Ia).",
        presentation: ["frequency", "deferred", "hidden-structure", "valuation-date"],
        features: { multipleValuationDates: true },
        params: { kase, i, n, m, P, Q },
        route: "nominal, increasing, decompose, defer",
      });
    }
    const PV = Math.round(ans.v);
    const solveQ = (o: Parameters<typeof core>[1]): Eq => ({ eq: (x: X) => sub(core(x, o), PV), lo: 0.01, hi: P });
    return elite({
      stem: `${stemBase} a fixed amount $Q$. The annual effective rate of interest is ${pct(i)}, and the present value of the payments at time 0 is ${amt(PV)}.\n\nCalculate $Q$.`,
      fmt: MONEY2,
      answer: solveQ({}),
      model: { eq: (x: X) => sub(explicit(x), PV), lo: 0.01, hi: P },
      modelDescription: "Each monthly payment written out with the unknown step, solved for Q.",
      traps: [
        { id: "CONC_ANN_ARITH_BASE_SPLIT", value: solveQ({ split: true }), label: "P a plus Q Ia", method: "Used $P a + Q(Ia)$.", feedback: "Use $(P-Q)a + Q(Ia)$." },
        { id: "RATE_DIVIDED_EFFECTIVE", value: solveQ({ ratio1: true }), label: "no monthly adjustment", method: "Left out $i/i^{(12)}$.", feedback: "Monthly payments need the adjustment." },
        { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: solveQ({ defer: m + 1 }), label: "deferred a year too long", method: `Deferred ${m + 1} years.`, feedback: `Defer ${m} years.` },
        { id: "TIMING_MISSING_PERIOD", value: solveQ({ defer: m - 1 }), label: "deferred a year too few", method: `Deferred ${m - 1} years.`, feedback: `The stream's value sits at time ${m}.` },
        { id: "SEQ_ARITHMETIC_AS_GEOMETRIC", value: { eq: (x: X) => sub(core(x, { geometric: true }), PV), lo: 0.01, hi: P }, label: "steps treated as geometric", method: "Solved as if the increase were a percentage of P.", feedback: "The increase is a fixed amount." },
      ],
      steps: [...commonSteps.slice(0, 2), step("B.mthly-annuity", "Value at time 0 per unit of P and per unit of Q.", ["c_Q", mul(12, div(i, i12), sub(ia(i, n), an(i, n)), vt(i, m)).v, "coefficient of Q"], ["a", "(Ia)"]), step("B.deferred", "Deferred value of the P part.", ["c_P", mul(12, div(i, i12), an(i, n), vt(i, m)).v * P, "value of the P part"], ["P"]), step("A.equation-of-value", "Solve the linear equation for Q.", ["Q", Q, "annual step"], ["c_P", "c_Q"], { rearranged: true })],
      methods: ["equation_construction", "rearrangement", "decomposition"],
      reasoning: "The present value is linear in Q: value the P part and the coefficient of Q separately, then solve.",
      intuition: "Separate what is known (the P part) from what multiplies Q.",
      unknowns: [{ symbol: "$Q$", meaning: "annual increase in each monthly payment" }],
      relationships: ["$PV = 12\\dfrac{i}{i^{(12)}}v^m[P a_{\\overline{n|}} + Q((Ia)_{\\overline{n|}} - a_{\\overline{n|}})]$"],
      conditions: ["Level within each year."],
      valuationDate: "Time 0",
      modelChoice: "Linear equation in Q.",
      assumptions: ["Constant rate."],
      principle: "A present value linear in the unknown is solved by isolating its coefficient.",
      unusual: "The unknown is the step of a monthly arithmetic stream.",
      misread: "Using P·a + Q·(Ia).",
      presentation: ["inverse", "frequency", "deferred", "valuation-date"],
      features: { multipleValuationDates: true },
      params: { kase, i, n, m, P, PV },
      route: "nominal, increasing, coefficients, solve",
    });
  },
};

// ===================================================================== 6. Two-stage growth then perpetual growth

const twoStageGrowth: QuestionTemplate = {
  id: "el-ann-two-stage-growth",
  family: "el-ann-two-stage-growth",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.perpetuities", "TVM.effective_nominal", "ANNUITIES.streams"],
  reasoning: ["cashflow_modelling", "formula_selection", "multistep", "algebra"],
  soaConcept: "A stream that grows at one rate for n years and at a lower rate forever after: a growing annuity plus a deferred growing perpetuity.",
  generate(rng): QuestionDraft {
    const g1 = pick(rng, [0.04, 0.05, 0.06, 0.07, 0.08]);
    const g2 = pick(rng, [0.01, 0.015, 0.02, 0.025]);
    const n = rng.int(5, 10);
    const R = gridAmount(rng, 1000, 6000, 250);
    const name = nameOf(rng);
    const kase = pick(rng, ["value", "yield"]);
    const pv = (rate: X | number, o: { tailExtra?: boolean; defer?: number; jfactor?: boolean; growForever?: boolean } = {}) => {
      if (o.growForever) return div(R, sub(rate, g1));
      const head = mul(R, geoA(rate, g1, n));
      const first = R * Math.pow(1 + g1, o.tailExtra ? n : n - 1) * (1 + g2);
      const tail = o.jfactor ? div(first, div(sub(rate, g2), 1 + g2)) : div(first, sub(rate, g2));
      return add(head, mul(tail, vt(rate, o.defer ?? n)));
    };
    const explicit = (rate: X | number) => add(flows(n, (t) => mul(R * Math.pow(1 + g1, t), vt(rate, t + 1))), mul(div(R * Math.pow(1 + g1, n - 1) * (1 + g2), sub(rate, g2)), vt(rate, n)));
    const story = `${name} values a business whose annual profit is ${amt(R)} at the end of the first year, growing by ${pc(g1, 1)} per year for the next ${n - 1} years (so the ${ord(n)} payment is ${amt(R * Math.pow(1 + g1, n - 1))}). From the ${ord(n + 1)} payment onward the profit grows by ${pc(g2, 1)} per year forever.`;
    if (kase === "value") {
      const i2 = gridRate(rng, 0.06, 0.11, 0.0025);
      const i = fromNominal(i2, 2);
      const ans = pv(i);
      return elite({
        stem: `${story} Money is valued at a nominal annual rate of ${pct(i2)} convertible semiannually.\n\nCalculate the value of the profits at time 0.`,
        fmt: MONEY2,
        answer: ans,
        model: explicit(i),
        modelDescription: "The first n profits discounted one by one; the tail as a growing perpetuity at time n.",
        traps: [
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: pv(i, { tailExtra: true }), label: "first tail payment grown once more", method: "Grew the first tail payment at both rates for an extra year.", feedback: `The ${ord(n + 1)} profit is the ${ord(n)} times $(1 + ${g2})$.` },
          { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: pv(i, { defer: n + 1 }), label: "tail deferred one year too long", method: `Discounted the tail ${n + 1} years.`, feedback: `A growing perpetuity-immediate is valued one year before its first payment: time ${n}.` },
          { id: "CONC_ANN_GEOM_J_FACTOR", value: pv(i, { jfactor: true }), label: "j factor in the perpetuity", method: "Divided by $(i - g)/(1+g)$.", feedback: "A growing perpetuity-immediate is $P_1/(i - g)$." },
          { id: "RATE_NOMINAL_AS_EFFECTIVE", value: pv(i2), label: "semiannual nominal used as effective", method: `Used ${pct(i2)} as effective.`, feedback: `$i = (1 + ${dec(i2 / 2, 5)})^2 - 1$.` },
          { id: "TRANS_IGNORED_CONDITION", value: pv(i, { growForever: true }), label: "first growth rate forever", method: `Used ${pc(g1, 1)} growth forever.`, feedback: `Growth drops to ${pc(g2, 1)} after year ${n}.` },
        ],
        steps: [
          step("A.nominal-equivalence", "Annual effective rate.", ["i", i.v, "annual effective rate"], ["i^(2)"]),
          step("B.geometric-annuity", `First ${n} profits.`, ["V_1", mul(R, geoA(i, g1, n)).v, "growing annuity value"], ["R", "g_1", "i"]),
          step("B.geometric-perpetuity", `Tail valued at time ${n}.`, ["V_n", (R * Math.pow(1 + g1, n - 1) * (1 + g2)) / (i.v - g2), `tail at time ${n}`], ["g_2", "i"]),
          step("A.discount-factor", "Discount the tail.", ["V_2", ans.v - mul(R, geoA(i, g1, n)).v, "tail at time 0"], ["V_n"]),
          step("A.equation-of-value", "Add.", ["PV", ans.v, "value at time 0"], ["V_1", "V_2"]),
        ],
        methods: ["decomposition", "geometric_series", "valuation_dates"],
        reasoning: "Value the first n profits as a geometric annuity, the rest as a growing perpetuity valued at time n, and discount it.",
        intuition: "Cut where the growth rate changes.",
        unknowns: [{ symbol: "$PV$", meaning: "value at time 0" }],
        relationships: ["$PV = R\\dfrac{1 - ((1+g_1)/(1+i))^n}{i - g_1} + \\dfrac{R(1+g_1)^{n-1}(1+g_2)}{i - g_2}v^n$"],
        conditions: [`Growth changes after the ${ord(n)} payment.`],
        valuationDate: "Time 0",
        modelChoice: "Growing annuity plus deferred growing perpetuity.",
        assumptions: ["Growth rates continue as stated."],
        principle: "A growing perpetuity-immediate valued one period before its first payment is P₁/(i − g).",
        unusual: "Two growth rates and a semiannual rate.",
        misread: "Growing the first tail payment twice.",
        presentation: ["mixed-timing", "deferred", "frequency", "valuation-date"],
        features: { multipleValuationDates: true },
        params: { kase, g1, g2, n, R, i2 },
        route: "convert, growing annuity, growing perpetuity, defer, add",
      });
    }
    const iTrue = gridRate(rng, 0.07, 0.12, 0.0025);
    const price = Math.round(pv(iTrue).v);
    const yEq = (o: Parameters<typeof pv>[1]): Eq => ({ eq: (x: X) => sub(pv(x, o), price), lo: g2 + 0.003, hi: 0.6 });
    const ans: Eq = yEq({});
    return elite({
      stem: `${story} ${name} pays ${amt(price)} for the business.\n\nCalculate the annual effective yield rate implied by the price.`,
      fmt: PCT3,
      answer: ans,
      model: { eq: (x: X) => sub(explicit(x), price), lo: g2 + 0.003, hi: 0.6 },
      modelDescription: "Price equals the explicitly discounted first n profits plus the tail perpetuity, solved for the yield.",
      traps: [
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: yEq({ tailExtra: true }), label: "first tail payment grown once more", method: "Grew the first tail payment an extra year.", feedback: `The ${ord(n + 1)} profit is the ${ord(n)} times $(1 + g_2)$.` },
        { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: yEq({ defer: n + 1 }), label: "tail deferred one year too long", method: `Discounted the tail ${n + 1} years.`, feedback: `Discount it ${n} years.` },
        { id: "CONC_ANN_GEOM_J_FACTOR", value: yEq({ jfactor: true }), label: "j factor in the perpetuity", method: "Divided by $(i-g)/(1+g)$.", feedback: "Use $P_1/(i - g)$." },
        { id: "TRANS_IGNORED_CONDITION", value: { eq: (x: X) => sub(pv(x, { growForever: true }), price), lo: g1 + 0.003, hi: 0.8 }, label: "first growth rate forever", method: `Used ${pc(g1, 1)} growth forever.`, feedback: `Growth drops after year ${n}.` },
        { id: "FORMULA_PERPETUITY_FOR_FINITE", value: { eq: (x: X) => sub(div(R, sub(x, g2)), price), lo: g2 + 0.0005, hi: 0.8 }, label: "single growing perpetuity at the long-run rate", method: `Valued everything as a perpetuity growing at ${pc(g2, 1)}.`, feedback: "The first n profits grow faster." },
      ],
      steps: [
        step("B.geometric-annuity", "First-stage profits as a function of the yield.", ["V_1(i)", mul(R, geoA(iTrue, g1, n)).v, "growing annuity at the answer"], ["R", "g_1"]),
        step("B.geometric-perpetuity", `Tail valued at time ${n}.`, ["V_n(i)", (R * Math.pow(1 + g1, n - 1) * (1 + g2)) / (iTrue - g2), "tail at the answer"], ["g_2"]),
        step("A.discount-factor", "Discount the tail.", ["V_2(i)", pv(iTrue).v - mul(R, geoA(iTrue, g1, n)).v, "tail at time 0"], ["V_n"]),
        step("C.yield-rate", "Price equals value.", ["P", price, "price"], ["V_1", "V_2"], { derived: true }),
        step("M.root-finding", "Solve for the yield.", ["i", iTrue, "yield rate"], ["equation"], { rearranged: true }),
      ],
      methods: ["equation_construction", "numerical_root", "geometric_series"],
      reasoning: "Write the value as a function of the yield (growing annuity plus deferred growing perpetuity) and solve price = value numerically.",
      intuition: "Value falls as the yield rises, so there is exactly one yield matching the price.",
      unknowns: [{ symbol: "$i$", meaning: "annual effective yield" }],
      relationships: ["$P = R\\dfrac{1 - ((1+g_1)/(1+i))^n}{i - g_1} + \\dfrac{R(1+g_1)^{n-1}(1+g_2)}{i - g_2}v^n$"],
      conditions: [`The yield must exceed ${pc(g2, 1)}.`],
      valuationDate: "Time 0",
      modelChoice: "Yield equation with two growth stages.",
      assumptions: ["Profits as projected."],
      principle: "A yield is the rate equating price and the value of the cash flows.",
      unusual: "Unknown rate inside both a growing annuity and a growing perpetuity.",
      misread: "Using one growth rate throughout.",
      presentation: ["unknown-rate", "mixed-timing", "deferred", "valuation-date"],
      features: { multipleValuationDates: true },
      params: { kase, g1, g2, n, R, price },
      route: "value as a function of i, equate, solve",
    });
  },
};

// ===================================================================== 7. Value at the switch date: accumulated monthly annuity-due plus a decreasing annuity

const switchDateValue: QuestionTemplate = {
  id: "el-ann-switch-date",
  family: "el-ann-switch-date",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.arithmetic", "ANNUITIES.frequency_timing", "TVM.equation_of_value"],
  reasoning: ["valuation_dates", "cashflow_modelling", "multistep", "formula_selection"],
  soaConcept: "Valuing a two-phase stream at the date the phases (and rates) change: past payments accumulated, future payments discounted.",
  generate(rng): QuestionDraft {
    const n = rng.int(5, 12);
    const mTerms = rng.int(5, 12);
    const i = gridRate(rng, 0.03, 0.07, 0.0025);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.0025), (x) => Math.abs(x - i) >= 0.01);
    const D = gridAmount(rng, 200, 1500, 50);
    const name = nameOf(rng);
    const kase = pick(rng, ["value", "balance-payment"]);
    const accDue = (rate: X | number, o: { immediate?: boolean; pv?: boolean } = {}) => {
      const d12 = o.immediate ? mul(12, perK(rate, 1 / 12)) : mul(12, sub(1, pow(add(1, rate), -1 / 12)));
      return o.pv ? div(sub(1, vt(rate, n)), d12) : div(sub(at(rate, n), 1), d12);
    };
    const dec_ = (rate: X | number, o: { inc?: boolean } = {}) => mul(D, o.inc ? ia(rate, mTerms) : da(rate, mTerms));
    const explicitAcc = (xm: X | number) => flows(12 * n, (t) => mul(xm, at(i, n - t / 12)));
    const explicitDec = flows(mTerms, (t) => mul(D * (mTerms - t), vt(j, t + 1)));
    if (kase === "value") {
      const Xm = gridAmount(rng, 100, 600, 10);
      const val = (o: { immediate?: boolean; pv?: boolean; rate1?: number; rate2?: number; inc?: boolean; atZero?: boolean }) => {
        const v = add(mul(12, Xm, accDue(o.rate1 ?? i, o)), dec_(o.rate2 ?? j, o));
        return o.atZero ? mul(v, vt(i, n)) : v;
      };
      const ans = val({});
      return elite({
        stem: `${name} has made payments of ${amt(Xm)} at the beginning of each month for the last ${n} years into an account crediting an annual effective rate of ${pct(i)}. The account will now pay out ${amt(mTerms * D)} one year from now, ${amt((mTerms - 1) * D)} two years from now, and so on, decreasing by ${amt(D)} each year until a final payment of ${amt(D)}; future payments are valued at an annual effective rate of ${pct(j)}.\n\nCalculate the sum of the accumulated value of the past payments and the present value of the future payments, both measured today.`,
        fmt: MONEY2,
        answer: ans,
        model: add(explicitAcc(Xm), explicitDec),
        modelDescription: "Each past monthly payment accumulated to today and each future payment discounted to today.",
        traps: [
          { id: "TIMING_DUE_AS_IMMEDIATE", value: val({ immediate: true }), label: "monthly payments at month ends", method: "Accumulated as an annuity-immediate.", feedback: "The past payments were at the beginning of each month." },
          { id: "FORMULA_AV_FOR_PV", value: val({ pv: true }), label: "present value instead of accumulated value", method: "Valued the past payments at their start date.", feedback: "Past payments must be accumulated to today." },
          { id: "MODEL_SINGLE_RATE", value: val({ rate2: i }), label: "one rate for both phases", method: `Valued the future payments at ${pct(i)}.`, feedback: `Future payments are valued at ${pct(j)}.` },
          { id: "FORMULA_DECREASING_FOR_INCREASING", value: val({ inc: true }), label: "increasing factor for decreasing payments", method: "Used (Ia) for the future payments.", feedback: "The payments decrease: use (Da)." },
          { id: "TIMING_VALUATION_DATE", value: val({ atZero: true }), label: "valued at the start of the savings", method: `Moved everything back ${n} years.`, feedback: "Both parts are measured today." },
        ],
        steps: [
          step("A.nominal-equivalence", "Monthly discount rate on the annual basis.", ["d^{(12)}", mul(12, sub(1, pow(1 + i, -1 / 12))).v, "nominal monthly discount rate"], ["i"]),
          step("B.annuity-due-av", "Accumulated value of the monthly annuity-due.", ["S", mul(12, Xm, accDue(i)).v, "past payments today"], ["X", "i"]),
          step("B.decreasing", "Present value of the decreasing payments.", ["V", dec_(j).v, "future payments today"], ["D", "j"]),
          step("A.equation-of-value", "Add the two values at today's date.", ["T", ans.v, "total value today"], ["S", "V"]),
        ],
        methods: ["decomposition", "valuation_dates"],
        reasoning: "Measure both parts at today's date: accumulate the past monthly annuity-due, discount the future decreasing annuity at its own rate.",
        intuition: "One date, two directions: the past moves forward, the future moves back.",
        unknowns: [{ symbol: "$T$", meaning: "total value today" }],
        relationships: ["$T = 12X\\,\\ddot s^{(12)}_{\\overline{n|}i} + D\\,(Da)_{\\overline{m|}j}$"],
        conditions: ["Each phase has its own rate."],
        valuationDate: "Today (the switch date)",
        modelChoice: "Accumulated annuity-due plus decreasing annuity.",
        assumptions: ["Rates as stated."],
        principle: "At an intermediate date, past cash flows are accumulated and future ones discounted.",
        unusual: "Two phases valued at the date between them, at different rates.",
        misread: "Using the present value of the past payments.",
        presentation: ["valuation-date", "mixed-timing", "frequency", "compare-streams"],
        features: { multipleValuationDates: true },
        params: { kase, n, mTerms, i, j, D, Xm },
        route: "monthly discount, accumulate, decreasing, add",
      });
    }
    const solveX = (o: { immediate?: boolean; pv?: boolean; rate2?: number; inc?: boolean }) => div(dec_(o.rate2 ?? j, o), mul(12, accDue(i, o)));
    const ans = solveX({});
    return elite({
      stem: `${name} makes level deposits at the beginning of each month for ${n} years into an account crediting an annual effective rate of ${pct(i)}. Immediately after the last month, the account must exactly fund payments of ${amt(mTerms * D)} one year later, ${amt((mTerms - 1) * D)} two years later, and so on, decreasing by ${amt(D)} each year to a final payment of ${amt(D)}. During the payout the account credits an annual effective rate of ${pct(j)}.\n\nCalculate the monthly deposit.`,
      fmt: MONEY2,
      answer: ans,
      model: { eq: (x: X) => sub(explicitAcc(x), explicitDec), lo: ans.v * 0.3, hi: ans.v * 3 },
      modelDescription: "Each deposit accumulated to the switch date equals each payout discounted to it.",
      traps: [
        { id: "TIMING_DUE_AS_IMMEDIATE", value: solveX({ immediate: true }), label: "deposits at month ends", method: "Accumulated as an annuity-immediate.", feedback: "Deposits are at the beginning of each month." },
        { id: "FORMULA_AV_FOR_PV", value: solveX({ pv: true }), label: "present value of deposits", method: "Equated the present value of deposits to the payout value at the switch date.", feedback: "Compare at one date: accumulate the deposits." },
        { id: "MODEL_SINGLE_RATE", value: solveX({ rate2: i }), label: "one rate for both phases", method: `Valued the payout at ${pct(i)}.`, feedback: `The payout phase earns ${pct(j)}.` },
        { id: "FORMULA_DECREASING_FOR_INCREASING", value: solveX({ inc: true }), label: "increasing factor", method: "Used (Ia).", feedback: "Payouts decrease." },
        { id: "CONC_ANN_MTHLY_PAYMENT_SIZE", value: mul(12, solveX({})), label: "annual deposit", method: "Gave the yearly total.", feedback: "Divide by 12 for the monthly deposit." },
      ],
      steps: [
        step("B.decreasing", "Value of the payouts at the switch date.", ["V", dec_(j).v, "payouts at the switch date"], ["D", "j"]),
        step("A.nominal-equivalence", "Monthly discount rate.", ["d^{(12)}", mul(12, sub(1, pow(1 + i, -1 / 12))).v, "nominal monthly discount rate"], ["i"]),
        step("B.annuity-due-av", "Accumulated value of 1 per month in advance.", ["12\\ddot s^{(12)}", mul(12, accDue(i)).v, "accumulation factor"], ["i"]),
        step("A.equation-of-value", "Solve for the deposit.", ["X", ans.v, "monthly deposit"], ["V"], { rearranged: true }),
      ],
      methods: ["work_backwards", "valuation_dates", "decomposition"],
      reasoning: "Value the payouts at the switch date at the payout rate, then divide by the accumulated value of a monthly annuity-due of 1.",
      intuition: "The switch date is the natural comparison date.",
      unknowns: [{ symbol: "$X$", meaning: "monthly deposit" }],
      relationships: ["$12X\\,\\ddot s^{(12)}_{\\overline{n|}i} = D\\,(Da)_{\\overline{m|}j}$"],
      conditions: ["Rates differ by phase."],
      valuationDate: "The switch date",
      modelChoice: "Equation of value at the switch date.",
      assumptions: ["Rates as stated."],
      principle: "Choose the comparison date where the regime changes.",
      unusual: "Two phases, two rates, two payment patterns.",
      misread: "Equating a present value to a value at a later date.",
      presentation: ["valuation-date", "work-backwards", "frequency", "mixed-timing"],
      features: { multipleValuationDates: true },
      params: { kase, n, mTerms, i, j, D },
      route: "payout value, monthly discount, accumulate, solve",
    });
  },
};

// ===================================================================== 8. Growing withdrawals until the fund runs out: drop or balloon

const growingDrop: QuestionTemplate = {
  id: "el-ann-growing-drop",
  family: "el-ann-growing-drop",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.geometric",
  secondary: ["ANNUITIES.immediate_due", "ANNUITIES.non_level", "LOANS.final_payments"],
  reasoning: ["cashflow_modelling", "algebra", "multistep", "valuation_dates"],
  soaConcept: "A fund supports geometrically increasing withdrawals in advance; the term is found with logarithms and the last, irregular withdrawal from the remaining balance.",
  generate(rng): QuestionDraft {
    const i = gridRate(rng, 0.04, 0.08, 0.0025);
    const g = pick(rng, [0.02, 0.025, 0.03, 0.035]);
    const W = gridAmount(rng, 2000, 8000, 250);
    const q0 = (1 + g) / (1 + i);
    const F = Math.round((W * (1 - Math.pow(q0, 8 + rng.int(0, 22) + rng.next())) / (1 - q0)) / 1000) * 1000;
    const name = nameOf(rng);
    const kase = pick(rng, ["drop", "balloon"]);
    const q = (1 + g) / (1 + i);
    // full withdrawals: largest n with W·ä_geo(n) ≤ F
    const fullCount = (W0: number, qq: number, adv: boolean) => {
      const factor = adv ? 1 : 1 / (1 + i);
      let n = 0;
      let pv = 0;
      while (pv + W0 * Math.pow(qq, n) * factor <= F && n < 400) {
        pv += W0 * Math.pow(qq, n) * factor;
        n += 1;
      }
      return n;
    };
    const n = fullCount(W, q, true);
    const pvFull = (W0: number, cnt: number, adv = true) => mul(W0, div(sub(1, pow(q, cnt)), 1 - q), adv ? 1 : 1 / (1 + i));
    const dropAt = (W0: number, cnt: number, adv = true, extra = 0) => mul(sub(F, pvFull(W0, cnt, adv)), at(i, cnt - (adv ? 0 : -1) + extra));
    if (n < 8 || n > 60) throw new Error("Term outside range.");
    const drop = dropAt(W, n);
    if (drop.v < 0.15 * W) throw new Error("Final withdrawal too small.");
    const explicit = (x: X) => sub(add(flows(n, (t) => mul(W * Math.pow(1 + g, t), vt(i, t))), mul(x, vt(i, n))), F);
    const nStar = Math.log(1 - (F * (1 - q)) / W) / Math.log(q);
    const n2 = fullCount(W * (1 + g), q, true);
    const nImm = fullCount(W, q, false);
    const common = `A fund of ${amt(F)} earns an annual effective rate of ${pct(i)}. ${name} withdraws ${amt(W)} immediately and then, at the start of each later year, an amount ${pc(g, 1)} larger than the previous withdrawal, for as long as the fund allows.`;
    const steps = [
      step("B.geometric-annuity-due", "Present value of n growing withdrawals in advance.", ["\\ddot a_g", pvFull(1, n).v, "geometric annuity-due factor at the answer's n"], ["g", "i"]),
      step("M.logarithm", "Largest n with total present value not above the fund.", ["n^*", nStar, "exact (fractional) term"], ["F", "W"], { rearranged: true }),
      step("B.counting", "Number of full withdrawals.", ["n", n, "full withdrawals"], ["n^*"]),
      step("D.retrospective", `Fund remaining at time ${n}, after the ${n}th withdrawal's year of interest.`, ["B", drop.v, `fund at time ${n}`], ["F", "n"]),
    ];
    if (kase === "drop") {
      return elite({
        stem: `${common} When the fund can no longer support a full withdrawal, a smaller final withdrawal one year after the last full one exhausts it.\n\nCalculate the final withdrawal.`,
        fmt: MONEY2,
        answer: drop,
        model: { eq: explicit, lo: 0.01, hi: W * 4 },
        modelDescription: "Fund = each full withdrawal discounted plus the final one discounted, solved for the final withdrawal.",
        traps: [
          { id: "CHAL_BALLOON_FOR_DROP", value: add(mul(W, Math.pow(1 + g, n - 1)), mul(drop, vt(i, 1))), label: "balloon instead of drop", method: "Added the remainder to the last full withdrawal.", feedback: "A drop payment is a separate, smaller payment one year after the last full one." },
          { id: "TIMING_EXTRA_PERIOD", value: mul(drop, 1 + i), label: "final withdrawal a year late", method: "Accumulated the balance one more year.", feedback: `The final withdrawal is at time ${n}.` },
          { id: "TIMING_DUE_AS_IMMEDIATE", value: dropAt(W, nImm, false), label: "withdrawals at year ends", method: "Treated the withdrawals as end-of-year.", feedback: "The first withdrawal is immediate." },
          { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: dropAt(W * (1 + g), n2), label: "first withdrawal already grown", method: `Took the first withdrawal as ${amt(W)}(1 + g).`, feedback: `The first withdrawal is ${amt(W)}.` },
          { id: "CHAL_FRACTIONAL_PAYMENT", value: mul(nStar - n, W * Math.pow(1 + g, n)), label: "fraction of the next withdrawal", method: "Took the fractional part of n times the next withdrawal.", feedback: "The final withdrawal is the accumulated remaining balance, not a proportion." },
        ],
        steps: [...steps, step("D.drop-balloon", "The final (drop) withdrawal equals the remaining fund.", ["X", drop.v, "final withdrawal"], ["B"])],
        methods: ["logarithms", "geometric_series", "valuation_dates"],
        reasoning: "Find the number of full withdrawals from the geometric annuity-due, then accumulate what is left to the date of the final withdrawal.",
        intuition: "Full withdrawals until the next one would overdraw; whatever remains, with interest, is paid one year later.",
        unknowns: [{ symbol: "$X$", meaning: "final withdrawal" }],
        relationships: ["$F = W\\dfrac{1 - q^n}{1 - q} + X v^n, \\quad q = \\dfrac{1+g}{1+i}$"],
        conditions: ["Full withdrawals continue while the fund allows."],
        valuationDate: `Time ${n}`,
        modelChoice: "Geometric annuity-due, logarithm for the term, retrospective balance.",
        assumptions: ["No other transactions."],
        principle: "The term of a geometric annuity-due follows from logarithms; the remainder sets the irregular payment.",
        unusual: "Growing withdrawals with an unknown term.",
        misread: "Treating the drop as a balloon.",
        presentation: ["unknown-time", "work-backwards", "valuation-date", "hidden-structure"],
        features: { multipleValuationDates: true },
        params: { kase, i, g, W, F, n },
        route: "geometric due, logarithm, count, balance, drop",
      });
    }
    const balloon = add(mul(W, Math.pow(1 + g, n - 1)), mul(drop, vt(i, 1)));
    return elite({
      stem: `${common} The last full withdrawal is increased so that it exhausts the fund (a balloon withdrawal).\n\nCalculate the balloon withdrawal.`,
      fmt: MONEY2,
      answer: balloon,
      model: { eq: (x: X) => sub(add(flows(n - 1, (t) => mul(W * Math.pow(1 + g, t), vt(i, t))), mul(x, vt(i, n - 1))), F), lo: W, hi: W * 10 },
      modelDescription: "Fund = the first n − 1 withdrawals discounted plus the balloon discounted, solved for the balloon.",
      traps: [
        { id: "CONC_LOAN_DROP_BALLOON_CONFUSED", value: drop, label: "drop instead of balloon", method: "Paid the remainder one year after the last full withdrawal.", feedback: "A balloon adds the remainder to the last full withdrawal." },
        { id: "TIMING_EXTRA_PERIOD", value: add(mul(W, Math.pow(1 + g, n - 1)), drop), label: "remainder not discounted back", method: "Added the remainder without discounting it a year.", feedback: `The remainder is valued at time ${n}; the balloon is at time ${n - 1}.` },
        { id: "CONC_ANN_FIRST_PAYMENT_GROWTH", value: add(mul(W * (1 + g), Math.pow(1 + g, n2 - 1)), mul(dropAt(W * (1 + g), n2), vt(i, 1))), label: "first withdrawal already grown", method: "Grew the first withdrawal.", feedback: `The first withdrawal is ${amt(W)}.` },
        { id: "CHAL_FRACTIONAL_PAYMENT", value: mul(W * Math.pow(1 + g, n - 1), 1 + nStar - n), label: "fractional part added", method: "Added the fractional part of n times the last withdrawal.", feedback: "The balloon adds the discounted remaining balance." },
        { id: "VAR_OTHER_UNKNOWN", value: mul(W, Math.pow(1 + g, n - 1)), label: "last regular withdrawal", method: "Gave the last regular withdrawal.", feedback: "Add the remaining balance discounted one year." },
      ],
      steps: [...steps, step("D.drop-balloon", "Balloon = last full withdrawal + remainder discounted one year.", ["X", balloon.v, "balloon withdrawal"], ["B"])],
      methods: ["logarithms", "geometric_series", "valuation_dates"],
      reasoning: "Find the number of full withdrawals; the remaining balance, discounted one year, is added to the last full withdrawal.",
      intuition: "A balloon pays the leftover early, so it is the leftover discounted one year.",
      unknowns: [{ symbol: "$X$", meaning: "balloon withdrawal" }],
      relationships: ["$X = W(1+g)^{n-1} + B v$"],
      conditions: ["The balloon replaces the last full withdrawal."],
      valuationDate: `Time ${n - 1}`,
      modelChoice: "Geometric annuity-due, logarithm, balance.",
      assumptions: ["No other transactions."],
      principle: "Drop and balloon differ only in timing: the balloon is the drop discounted one period plus the regular payment.",
      unusual: "A balloon on growing withdrawals.",
      misread: "Paying a drop instead.",
      presentation: ["unknown-time", "work-backwards", "valuation-date", "hidden-structure"],
      features: { multipleValuationDates: true },
      params: { kase, i, g, W, F, n },
      route: "geometric due, logarithm, count, balance, balloon",
    });
  },
};

// ===================================================================== 9. Equal present values at an unknown rate

const equalValueRate: QuestionTemplate = {
  id: "el-ann-equal-value-rate",
  family: "el-ann-equal-value-rate",
  topic: "ANNUITIES",
  levels: [4],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.arithmetic", "ANNUITIES.perpetuities", "TVM.discount_rates"],
  reasoning: ["algebra", "cashflow_modelling", "multistep", "validation"],
  soaConcept: "Two contracts of different shapes with equal present values: the rate solves the equality, then is restated in another convention.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const kase = pick(rng, ["perp-vs-decreasing", "deferred-vs-decreasing"]);
    const n = rng.int(8, 15);
    const iTrue = gridRate(rng, 0.03, 0.08, 0.0025);
    const ask = pick(rng, ["d12", "i4"]);
    const conv = (i: X) => (ask === "d12" ? mul(12, sub(1, pow(add(1, i), -1 / 12))) : mul(4, sub(pow(add(1, i), 0.25), 1)));
    /** The annual effective rate as a function of the requested nominal rate, and of the other convention (for the swap trap). */
    const iOf = (j: X) => (ask === "d12" ? sub(pow(sub(1, div(j, 12)), -12), 1) : sub(pow(add(1, div(j, 4)), 4), 1));
    const iOfSwapped = (j: X) => (ask === "d12" ? sub(pow(add(1, div(j, 12)), 12), 1) : sub(pow(sub(1, div(j, 4)), -4), 1));
    const inJ = (f: (i: X) => X, swapped = false): Eq => ({ eq: (x: X) => f(swapped ? iOfSwapped(x) : iOf(x)), lo: 0.0005, hi: 0.45 });
    const askText = ask === "d12" ? "the nominal annual rate of discount convertible monthly" : "the nominal annual rate of interest convertible quarterly";
    if (kase === "perp-vs-decreasing") {
      const D = gridAmount(rng, 50, 300, 10);
      const L = Math.round(D * da(iTrue, n).v * iTrue * 100) / 100;
      const diff = (i: X, o: { due?: boolean; sign?: boolean; inc?: boolean } = {}) =>
        sub(o.due ? div(mul(L, add(1, i)), i) : div(L, i), mul(D, o.inc ? ia(i, n) : o.sign ? div(add(n, an(i, n)), i) : da(i, n)));
      const iSol = rootOf({ eq: (x: X) => diff(x), lo: 0.002, hi: 0.4 });
      const solve = (o: Parameters<typeof diff>[1]) => inJ((i) => diff(i, o));
      const ansV = conv(K(iSol)).v;
      const ans = inJ((i) => diff(i));
      const traps: Trap[] = [
        { id: "VAR_OTHER_UNKNOWN", value: K(iSol), label: "annual effective rate", method: "Stopped at the annual effective rate.", feedback: `Convert to ${askText}.` },
        { id: "TIMING_IMMEDIATE_AS_DUE", value: solve({ due: true }), label: "perpetuity-due", method: "Valued contract A as a perpetuity-due.", feedback: "Contract A pays at the ends of years." },
        { id: "ALG_SIGN_ERROR", value: solve({ sign: true }), label: "sign slip in Da", method: "Used $(n + a_{\\overline{n|}})/i$ for $(Da)$.", feedback: "$(Da)_{\\overline{n|}} = (n - a_{\\overline{n|}})/i$." },
        { id: "RATE_DISCOUNT_AS_INTEREST", value: inJ((i) => diff(i), true), label: "interest and discount swapped", method: "Converted to the other kind of nominal rate.", feedback: `The question asks for ${askText}.` },
        { id: "FORMULA_DECREASING_FOR_INCREASING", value: solve({ inc: true }), label: "increasing factor", method: "Used (Ia) for contract B.", feedback: "Contract B decreases." },
      ];
      traps.push({ id: "MODEL_LEVEL_FOR_VARYING", value: inJ((i) => sub(div(L, i), mul((D * (n + 1)) / 2, an(i, n)))), label: "average payment for contract B", method: "Replaced contract B's payments by their average.", feedback: "The early, larger payments of B are discounted less: value them separately." });
      if (ask === "d12") traps.push({ id: "RATE_DIVIDED_EFFECTIVE", value: K(iSol / (1 + iSol)), label: "annual effective discount", method: "Gave $d = i/(1+i)$.", feedback: "Convert to the monthly nominal discount rate." });
      return elite({
        stem: `Contract A pays ${name} ${amt(L)} at the end of each year forever. Contract B pays ${amt(n * D)} at the end of year 1, ${amt((n - 1) * D)} at the end of year 2, and so on, decreasing by ${amt(D)} each year to a final payment of ${amt(D)} at the end of year ${n}. At the annual effective rate $i$ the two contracts have equal present values.\n\nCalculate ${askText} equivalent to $i$.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(div(L, iOf(x)), flows(n, (t) => mul(D * (n - t), vt(iOf(x), t + 1)))), lo: 0.0005, hi: 0.45 },
        modelDescription: "The annual rate equating the perpetuity and the explicitly discounted decreasing payments (converted afterwards).",
        traps,
        steps: [
          step("B.perpetuity", "Contract A as a function of i.", ["V_A", L / iSol, "contract A at the answer"], ["L"]),
          step("B.decreasing", "Contract B as a function of i.", ["V_B", D * da(iSol, n).v, "contract B at the answer"], ["D"]),
          step("A.equation-of-value", "Equate the two values.", ["V_A - V_B", 0, "difference of values"], ["V_A", "V_B"], { derived: true }),
          step("M.root-finding", "Solve for the annual rate.", ["i", iSol, "annual effective rate"], ["f"], { rearranged: true }),
          step("A.nominal-equivalence", "Convert.", ["j", ansV, "requested nominal rate"], ["i"]),
        ],
        methods: ["equation_construction", "numerical_root", "substitution"],
        reasoning: "Write both present values in terms of i, solve the equality numerically, then convert the rate.",
        intuition: "The perpetuity is back-loaded relative to the decreasing annuity, so its value falls faster as the rate rises: exactly one rate balances them.",
        unknowns: [{ symbol: "$i$", meaning: "annual effective rate" }],
        relationships: ["$L/i = D(Da)_{\\overline{n|}}$"],
        conditions: ["Both contracts pay at year ends."],
        valuationDate: "Time 0",
        modelChoice: "Equality of present values.",
        assumptions: ["One rate for both contracts."],
        principle: "Equal present values at one rate do not imply equal values at another.",
        unusual: "The answer is a different rate convention.",
        misread: "Reporting the effective rate.",
        presentation: ["unknown-rate", "compare-streams", "frequency", "multi-equation"],
        params: { kase, D, L, n, ask },
        route: "value A, value B, equate, solve, convert",
      });
    }
    const D = gridAmount(rng, 100, 500, 10);
    const k = rng.int(3, 8);
    const L = Math.round(((D * da(iTrue, n).v) / (an(iTrue, n).v * Math.pow(1 + iTrue, -k))) * 100) / 100;
    const diff = (i: X, o: { defer?: number; inc?: boolean } = {}) => sub(mul(L, an(i, n), vt(i, o.defer ?? k)), mul(D, o.inc ? ia(i, n) : da(i, n)));
    const iEq = { eq: (x: X) => diff(x), lo: 0.002, hi: 0.4 };
    const iSol = rootOf(iEq);
    const ansV = conv(K(iSol)).v;
      const ans = inJ((i) => diff(i));
    const solve = (o: Parameters<typeof diff>[1]) => inJ((i) => diff(i, o));
    return elite({
      stem: `Contract A pays ${name} ${amt(L)} at the end of each year for ${n} years, the first payment at the end of year ${k + 1}. Contract B pays ${amt(n * D)} at the end of year 1, ${amt((n - 1) * D)} at the end of year 2, and so on, decreasing by ${amt(D)} each year to ${amt(D)} at the end of year ${n}. At the annual effective rate $i$ the two contracts have equal present values.\n\nCalculate ${askText} equivalent to $i$.`,
      fmt: PCT3,
      answer: ans,
      model: { eq: (x: X) => sub(flows(n, (t) => mul(L, vt(iOf(x), k + t + 1))), flows(n, (t) => mul(D * (n - t), vt(iOf(x), t + 1)))), lo: 0.0005, hi: 0.45 },
      modelDescription: "The annual rate equating the explicitly discounted payments of the two contracts (converted afterwards).",
      traps: [
        { id: "VAR_OTHER_UNKNOWN", value: K(iSol), label: "annual effective rate", method: "Stopped at the annual effective rate.", feedback: `Convert to ${askText}.` },
        { id: "TIMING_DEFERRAL_OFF_BY_ONE", value: solve({ defer: k + 1 }), label: "deferred one year too long", method: `Deferred contract A ${k + 1} years.`, feedback: `Its first payment is at year ${k + 1}, so the annuity-immediate value sits at time ${k}.` },
        { id: "TIMING_MISSING_PERIOD", value: solve({ defer: k - 1 }), label: "deferred one year too few", method: `Deferred contract A ${k - 1} years.`, feedback: `Defer ${k} years.` },
        { id: "RATE_DISCOUNT_AS_INTEREST", value: inJ((i) => diff(i), true), label: "interest and discount swapped", method: "Converted to the other kind of nominal rate.", feedback: `The question asks for ${askText}.` },
        { id: "FORMULA_DECREASING_FOR_INCREASING", value: solve({ inc: true }), label: "increasing factor", method: "Used (Ia) for contract B.", feedback: "Contract B decreases." },
      ],
      steps: [
        step("B.deferred", "Contract A as a function of i.", ["V_A", L * an(iSol, n).v * Math.pow(1 + iSol, -k), "contract A at the answer"], ["L"]),
        step("B.decreasing", "Contract B as a function of i.", ["V_B", D * da(iSol, n).v, "contract B at the answer"], ["D"]),
        step("A.equation-of-value", "Equate the two values.", ["f(i)", 0, "difference of values"], ["V_A", "V_B"], { derived: true }),
        step("M.root-finding", "Solve for the annual rate.", ["i", iSol, "annual effective rate"], ["f"], { rearranged: true }),
        step("A.nominal-equivalence", "Convert.", ["j", ansV, "requested nominal rate"], ["i"]),
      ],
      methods: ["equation_construction", "numerical_root", "valuation_dates"],
      reasoning: "Write both present values in terms of i, solve numerically, then convert.",
      intuition: "B pays most early, A pays later: higher rates favour B, so exactly one rate balances them.",
      unknowns: [{ symbol: "$i$", meaning: "annual effective rate" }],
      relationships: ["$L\\,v^k a_{\\overline{n|}} = D(Da)_{\\overline{n|}}$"],
      conditions: ["Both contracts pay at year ends."],
      valuationDate: "Time 0",
      modelChoice: "Equality of present values.",
      assumptions: ["One rate for both contracts."],
      principle: "A deferred level stream and a front-loaded decreasing one cross at a single rate.",
      unusual: "Deferral and decreasing payments in one equation.",
      misread: "Deferring by the time of the first payment.",
      presentation: ["unknown-rate", "compare-streams", "deferred", "frequency"],
      params: { kase, D, L, n, k, ask },
      route: "value A, value B, equate, solve, convert",
    });
  },
};

export const ELITE_ANNUITY_TEMPLATES: QuestionTemplate[] = [geoMonthlyStep, varyingForceStream, careerFund, pyramidEveryK, pqMonthly, twoStageGrowth, switchDateValue, growingDrop, equalValueRate];
