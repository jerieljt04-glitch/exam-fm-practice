/**
 * Mixed present-value families: streams that combine annuities and
 * perpetuities (level, growing, monthly, every-k-year) valued under rates
 * that differ by period, by investor or by forward-rate curve.
 *
 * Every template draws one of several twists per level, each a different
 * route through the problem, so the approach memory can always serve a
 * route not seen recently.
 */
import type { AnswerFormat, ChainStep, DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { bisect, explain, routeVisual } from "./approach-kit";
import { modelOf, shifted, valueOf, type Regime, type Seg, type Valued } from "./flows-kit";
import { MONEY2, amt, chain, dec, distractor, features, gridAmount, gridRate, lit, mnum, pc, shown, step } from "./kit";

const L = lit;
const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };

/** A distractor built from a variant valuation. */
function dv(id: Parameters<typeof distractor>[0], v: Valued, fmt: AnswerFormat, label: string, method: string, feedback: string): DistractorCandidate {
  return distractor(id, v.value, v.expr, { derivation: `$\\text{${label}} = ${shown(v.value, fmt)}$`, method, feedback });
}

const pct = (x: number) => pc(x, 3);

// ===================================================================== Annuity, then perpetuity, under a rate that changes

const regimePerpetuity: QuestionTemplate = {
  id: "mix-regime-perpetuity",
  family: "mix-regime-perpetuity",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.streams",
  secondary: ["ANNUITIES.perpetuities", "TVM.equation_of_value", "ANNUITIES.geometric"],
  reasoning: ["cashflow_modelling", "valuation_dates", "multistep", "translation"],
  soaConcept: "A level annuity followed by a perpetuity, valued when the interest rate changes at a date that need not coincide with the change in payments.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const R = gridAmount(rng, 500, 5000, 100);
    const Q = gridAmount(rng, 500, 8000, 100);
    const n = rng.int(5, 15);
    const i0 = gridRate(rng, 0.04, 0.09, 0.0025);
    const j = Math.max(0.025, i0 + rng.choice([-0.02, -0.015, -0.01, 0.01, 0.015, 0.02]));
    const twist = level === 1 ? rng.choice(["A", "B"]) : level === 2 ? rng.choice(["B", "C"]) : rng.choice(["A", "B"]);
    const m = twist === "A" ? n : twist === "B" ? n - rng.int(2, Math.max(2, n - 2)) : n + rng.int(2, 6);
    const grows = level === 3;
    const g = grows ? rng.choice([0.01, 0.015, 0.02]) : 0;
    const i4 = level === 3 ? gridRate(rng, 0.04, 0.09, 0.0025) : 0;
    const i = level === 3 ? Math.pow(1 + i4 / 4, 4) - 1 : i0;
    const annuity: Seg = { from: 1, to: n, amount: R };
    const tail: Seg = { from: n + 1, to: null, amount: Q, growth: g };
    const segs = [annuity, tail];
    const regimes: Regime[] = [
      { until: m, rate: i },
      { until: null, rate: j },
    ];
    const ans = valueOf(segs, regimes);
    const partA = valueOf([annuity], regimes);
    const partT = valueOf([tail], regimes);

    const distractors: DistractorCandidate[] = [
      dv("CHAL_RATE_BY_PAYMENT_DATE", valueOf(segs, regimes, { byPaymentDate: true }), fmt, "each payment at its own date's rate", "Discounted every payment all the way to time 0 at the rate in force on its payment date.", `The rate ${pct(j)} applies only after year ${m}; money is moved across the first ${m} years at ${pct(i)}.`),
      dv("MODEL_SINGLE_RATE", valueOf(segs, [{ until: null, rate: i }]), fmt, "one rate throughout", `Valued everything at ${pct(i)}.`, `The rate changes to ${pct(j)} after year ${m}.`),
      dv("TIMING_IGNORED_DEFERRAL", valueOf(segs, regimes, { tailUndeferred: true }), fmt, "perpetuity left undiscounted", "Added the perpetuity's value without moving it back to time 0.", `The perpetuity formula gives its value one year before its first payment (time ${n}); discount it to time 0.`),
      dv("TIMING_DEFERRAL_OFF_BY_ONE", valueOf([annuity, shifted([tail], 1)[0]], regimes), fmt, "perpetuity deferred one year too long", `Placed the first perpetuity payment at year ${n + 2}.`, `The perpetuity's first payment is at the end of year ${n + 1}, so its value sits at time ${n}.`),
      dv("TIMING_IMMEDIATE_AS_DUE", valueOf(shifted(segs, -1), regimes), fmt, "payments at the start of each year", "Treated every payment as made at the beginning of the year.", "All payments are at the ends of years."),
    ];
    if (grows) {
      distractors.unshift(
        dv("RATE_NOMINAL_AS_EFFECTIVE", valueOf(segs, [{ until: m, rate: i4 }, { until: null, rate: j }]), fmt, "nominal rate used as effective", `Used ${pct(i4)} as an annual effective rate.`, `Convert first: $(1 + ${dec(i4 / 4, 5)})^4 - 1 = ${dec(i, 6)}$.`),
        dv("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf([annuity, { ...tail, amount: Q * (1 + g) }], regimes), fmt, "first growing payment already increased", `Took the first growing payment as ${amt(Q)}(1 + g).`, `The first perpetuity payment is ${amt(Q)}; growth applies from the second.`)
      );
    }

    const steps: ChainStep[] = [];
    if (level === 3) steps.push(step("A.nominal-equivalence", "Convert the quarterly nominal rate to annual effective.", ["i", i, "annual effective rate, first regime"], ["i^(4)"]));
    if (twist === "A") {
      steps.push(step("B.annuity-immediate", `Annuity for ${n} years at ${pct(i)}.`, ["V_A", partA.value, "annuity value"], ["R", "i"]));
      steps.push(step(grows ? "B.geometric-perpetuity" : "B.perpetuity", `Perpetuity valued at time ${n} at ${pct(j)}${grows ? ", growing" : ""}.`, ["V_n", partT.value * Math.pow(1 + i, n), `perpetuity value at time ${n}`], ["Q", "j"]));
      steps.push(step("A.discount-factor", `Move it to time 0 at ${pct(i)}.`, ["V_T", partT.value, "perpetuity value at 0"], ["V_n", "i"]));
    } else if (twist === "B") {
      const first = valueOf([{ from: 1, to: m, amount: R }], regimes);
      steps.push(step("B.annuity-immediate", `First ${m} annuity payments at ${pct(i)}.`, ["V_1", first.value, "first block"], ["R", "i"]));
      steps.push(step("B.deferred", `Remaining ${n - m} annuity payments at ${pct(j)}, deferred ${m} years at ${pct(i)}.`, ["V_2", partA.value - first.value, "second block"], ["R", "i", "j"]));
      steps.push(step(grows ? "B.geometric-perpetuity" : "B.perpetuity", `Perpetuity at ${pct(j)}, discounted ${n - m} years at ${pct(j)} and ${m} at ${pct(i)}.`, ["V_T", partT.value, "perpetuity value at 0"], ["Q", "i", "j"]));
    } else {
      const mid = valueOf([{ from: n + 1, to: m, amount: Q }], regimes);
      steps.push(step("B.annuity-immediate", `Annuity for ${n} years at ${pct(i)}.`, ["V_A", partA.value, "annuity value"], ["R", "i"]));
      steps.push(step("B.deferred", `Perpetuity payments in years ${n + 1}–${m} are still at ${pct(i)}: a deferred annuity.`, ["V_2", mid.value, "early perpetuity payments"], ["Q", "i"]));
      steps.push(step("B.perpetuity", `Payments after year ${m} at ${pct(j)}, discounted ${m} years at ${pct(i)}.`, ["V_3", partT.value - mid.value, "later perpetuity payments"], ["Q", "i", "j"]));
    }
    steps.push(step("A.equation-of-value", "Add the pieces at time 0.", ["PV", ans.value, "present value"], ["pieces"]));

    const chainSpec = chain(steps, {
      methods: ["decomposition", "valuation_dates"],
      reasoning: `Split the stream where the payments change (year ${n}) and where the rate changes (year ${m}); move each piece to time 0 through the rates actually in force.`,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, Math.min(steps.length - 1, d.misconception === "RATE_NOMINAL_AS_EFFECTIVE" ? 0 : steps.length - 2)])),
    });

    const rateText =
      level === 3
        ? `Interest is at a nominal rate of ${pct(i4)} convertible quarterly for the first ${m} years and at an annual effective rate of ${pct(j)} thereafter.`
        : `The annual effective rate of interest is ${pct(i)} for the first ${m} years and ${pct(j)} thereafter.`;
    return {
      stem: `A stream of payments consists of ${amt(R)} at the end of each year for ${n} years, followed by payments at the end of each year forever, the first of ${amt(Q)} at the end of year ${n + 1}${grows ? ` and each later payment ${pct(g)} larger than the one before` : " and each later one equal to it"}. ${rateText}\n\nCalculate the present value of the stream.`,
      answer: { value: ans.value, calc: ans.expr, format: fmt, derivation: `$\\text{PV} = ${shown(ans.value, fmt)}$` },
      model: { expr: modelOf(segs, regimes), description: "Each annuity payment discounted year by year through the rates in force; the perpetuity in the form Q/(j − g) at its starting date." },
      distractors,
      explanation: explain({
        intuition: `Two things change: the payments (at year ${n}) and the rate (at year ${m}). Cut the timeline at both dates. Money travels across each stretch of time at the rate in force *during that stretch*, regardless of when it was paid.`,
        unknowns: [{ symbol: "$PV$", meaning: "present value of the whole stream" }],
        relationships: [`$v(t) = (1+i)^{-\\min(t, ${m})}(1+j)^{-\\max(0, t - ${m})}$`, grows ? "$\\text{growing perpetuity at its start} = \\dfrac{Q}{j - g}$" : "$\\text{perpetuity at its start} = \\dfrac{Q}{j}$"],
        conditions: ["End-of-year payments.", `Rate ${pct(i)} up to year ${m}, ${pct(j)} afterwards.`],
        valuationDate: "Time 0",
        modelChoice: "Decomposition into annuity and perpetuity pieces with a two-regime discount function.",
        assumptions: ["Rates apply to all money in the period, whenever it was paid."],
        solution: [...steps.map((s) => ({ title: s.output.meaning.replace(/^./, (c) => c.toUpperCase()), body: `$${mnum(s.output.value, s.output.symbol === "i" ? 6 : 2)}$` })).slice(0, -1), { title: "Present value", body: `$${shown(ans.value, fmt)}$` }],
        alternative: {
          name: "Value at the switch date",
          body: `Value everything at time ${m} — payments before it accumulated at ${pct(i)}, payments after it discounted at ${pct(j)} — then discount the total ${m} years at ${pct(i)}.`,
          whenUseful: "Fewer separate discount factors when the switch falls inside the annuity.",
        },
        principle: "A discount factor through several rate regimes is a product of one factor per regime.",
        unusual: twist === "B" ? "The rate changes in the middle of the annuity." : twist === "C" ? "The rate changes after the perpetuity has started." : "The rate changes exactly when the perpetuity starts.",
        misread: "A later payment is not discounted at the later rate for its whole distance to time 0.",
      }),
      visuals: [routeVisual(chainSpec, "Route: cut at both change dates", "Each piece crosses each regime at that regime's rate.")],
      markers: [partA.value, partT.value],
      presentation: level === 1 ? ["valuation-date", "mixed-timing"] : ["valuation-date", "mixed-timing", "hidden-structure"],
      features: features({ steps: steps.length, multipleValuationDates: true, multiConcept: true, unfamiliar: level > 1 }),
      params: { R, Q, n, m, i, j, g, twist, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Bought at one yield, sold at another

const perpResale: QuestionTemplate = {
  id: "mix-perp-resale",
  family: "mix-perp-resale",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.rates_of_return",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.arithmetic", "TVM.equation_of_value"],
  reasoning: ["cashflow_modelling", "financial_intuition", "algebra", "multistep"],
  soaConcept: "A perpetuity bought at one yield and resold at another: the holding-period yield mixes an annuity (payments received) with a perpetuity (the sale price).",
  generate(rng, level): QuestionDraft {
    const R = gridAmount(rng, 100, 2000, 50);
    const i = gridRate(rng, 0.04, 0.08, 0.0025);
    const j = level === 3 ? Math.max(0.03, i - rng.choice([0.005, 0.01, 0.015])) : Math.max(0.03, i + rng.choice([-0.015, -0.01, -0.005, 0.005, 0.01, 0.015]));
    const n = rng.int(level === 3 ? 5 : 3, 12);
    const twist = level === 3 ? "A" : rng.choice(["A", "B"]);
    const Qi = level === 3 ? gridAmount(rng, 10, 100, 5) : 0;
    const price = R / i + Qi / (i * i);
    const priceE = `(${L(R)}/${L(i)} + ${L(Qi)}/${L(i)}**2)`;
    const saleOf = (rate: number) => (R + n * Qi) / rate + Qi / (rate * rate);
    const saleE = (rate: string) => `((${L(R)} + ${n}*${L(Qi)})/${rate} + ${L(Qi)}/${rate}**2)`;
    const received = (y: number) => {
      let s = 0;
      for (let t = 1; t <= n; t += 1) s += (R + (t - 1) * Qi) * Math.pow(1 + y, -t);
      return s;
    };
    const receivedE = (y: string) => Array.from({ length: n }, (_, k) => `${L(R + k * Qi)}*(1+${y})**(-${k + 1})`).join(" + ");
    const distractors: DistractorCandidate[] = [];
    let fmt: AnswerFormat;
    let answer: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    let steps: ChainStep[];
    const sale = saleOf(j);
    const yieldRoot = (target: number, sv: number, at = n) => bisect((y) => received(y) + sv * Math.pow(1 + y, -at) - target, -0.5, 1);

    if (level === 1 && twist === "A") {
      fmt = MONEY2;
      answer = received(i) + sale * Math.pow(1 + i, -n);
      calc = `${L(R)}*(1-(1+${L(i)})**(-${n}))/${L(i)} + ${L(R)}/${L(j)}*(1+${L(i)})**(-${n})`;
      model = { expr: `${receivedE(L(i))} + ${saleE(L(j))}*(1+${L(i)})**(-${n})`, description: "Each payment received and the sale price discounted at the purchase yield." };
      ask = `Calculate the present value, at the investor's purchase yield, of everything the investor receives.`;
      distractors.push(
        distractor("MODEL_SINGLE_RATE", price, priceE, { derivation: `$R/i = ${shown(price, fmt)}$`, method: "Assumed the perpetuity is sold at the purchase yield.", feedback: `The buyer prices it at ${pct(j)}, so the sale price is ${amt(sale)}, not ${amt(price)}.` }),
        distractor("CHAL_RATE_BY_PAYMENT_DATE", received(i) + sale * Math.pow(1 + j, -n), `${receivedE(L(i))} + ${saleE(L(j))}*(1+${L(j)})**(-${n})`, { derivation: `$= ${shown(received(i) + sale * Math.pow(1 + j, -n), fmt)}$`, method: "Discounted the sale price at the buyer's yield.", feedback: "The buyer's yield sets the sale price; the investor discounts what they receive at their own rate." }),
        distractor("TIMING_IGNORED_DEFERRAL", received(i) + sale, `${receivedE(L(i))} + ${saleE(L(j))}`, { derivation: `$= ${shown(received(i) + sale, fmt)}$`, method: "Added the sale price without discounting it.", feedback: `The sale happens at time ${n}.` }),
        distractor("TIMING_EXTRA_PERIOD", received(i) + sale * Math.pow(1 + i, -n - 1), `${receivedE(L(i))} + ${saleE(L(j))}*(1+${L(i)})**(-${n + 1})`, { derivation: `$= ${shown(received(i) + sale * Math.pow(1 + i, -n - 1), fmt)}$`, method: `Discounted the sale price ${n + 1} years.`, feedback: `The sale is immediately after the ${n}th payment, at time ${n}.` }),
        distractor("VAR_OTHER_UNKNOWN", sale, saleE(L(j)), { derivation: `$R/j = ${shown(sale, fmt)}$`, method: "Gave the sale price.", feedback: "The question asks for the present value of all receipts." })
      );
      steps = [
        step("B.perpetuity", `Sale price: the remaining perpetuity at the buyer's yield ${pct(j)}.`, ["S", sale, "sale price"], ["R", "j"]),
        step("B.annuity-immediate", `The ${n} payments received, at ${pct(i)}.`, ["V_1", received(i), "payments received"], ["R", "i"]),
        step("A.equation-of-value", `Add the sale price discounted ${n} years at ${pct(i)}.`, ["PV", answer, "present value of receipts"], ["S", "V_1", "i"]),
      ];
    } else if (level === 1 || (level === 2 && twist === "B")) {
      // Inverse: the sale price (L1) or the buyer's yield (L2) that delivers a target holding yield.
      const y = Math.max(0.02, i + rng.choice([-0.02, -0.01, 0.01, 0.02]));
      const S = (price - received(y)) * Math.pow(1 + y, n);
      const SE = `((${priceE} - (${L(R)}*(1-(1+${L(y)})**(-${n}))/${L(y)}))*(1+${L(y)})**${n})`;
      fmt = level === 1 ? MONEY2 : PCT3;
      answer = level === 1 ? S : R / S;
      calc = level === 1 ? SE : `${L(R)}/${SE}`;
      model = level === 1 ? { expr: `${receivedE(L(y))} + x*(1+${L(y)})**(-${n}) - ${priceE}`, description: "Equation of value at the target yield, solved for the sale price." } : { expr: `${receivedE(L(y))} + ${L(R)}/x*(1+${L(y)})**(-${n}) - ${priceE}`, bracket: [answer * 0.5, answer * 1.6], description: "Equation of value at the target yield, with the sale price written as R/j." };
      ask = level === 1 ? `Calculate the sale price at which the investor's annual effective yield over the ${n} years is exactly ${pct(y)}.` : `The investor's annual effective yield over the ${n} years turns out to be ${pct(y)}. Calculate the buyer's annual effective yield.`;
      const Sm = S / (1 + y);
      const Sp = (price + received(y)) * Math.pow(1 + y, n);
      const Sw = (price - received(y)) * Math.pow(1 + y, -n);
      const conv = (s: number) => (level === 1 ? s : R / s);
      const convE = (e: string) => (level === 1 ? e : `${L(R)}/(${e})`);
      distractors.push(
        distractor("TIMING_MISSING_PERIOD", conv(Sm), convE(`${SE}/(1+${L(y)})`), { derivation: `$= ${shown(conv(Sm), fmt)}$`, method: `Accumulated the shortfall ${n - 1} years.`, feedback: `The sale is at time ${n}.` }),
        distractor("ALG_SIGN_ERROR", conv(Sp), convE(`(${priceE} + (${L(R)}*(1-(1+${L(y)})**(-${n}))/${L(y)}))*(1+${L(y)})**${n}`), { derivation: `$= ${shown(conv(Sp), fmt)}$`, method: "Added the value of the payments received to the price instead of subtracting it.", feedback: "Sale price = what is still owed to the investor after the payments already received." }),
        distractor("CONC_MOVED_WRONG_WAY", conv(Sw), convE(`(${priceE} - (${L(R)}*(1-(1+${L(y)})**(-${n}))/${L(y)}))*(1+${L(y)})**(-${n})`), { derivation: `$= ${shown(conv(Sw), fmt)}$`, method: "Discounted the shortfall instead of accumulating it to the sale date.", feedback: `The shortfall is a time-0 amount; at time ${n} it is worth $(1+y)^{${n}}$ times as much.` }),
        level === 1
          ? distractor("MODEL_SINGLE_RATE", price, priceE, { derivation: `$R/i = ${shown(price, fmt)}$`, method: "Assumed the sale price equals the purchase price.", feedback: `Selling at the purchase price earns exactly the purchase yield ${pct(i)}, not ${pct(y)}.` })
          : distractor("CONC_BOND_REALIZED_EQUALS_YIELD", y, L(y), { derivation: `$${shown(y, fmt)}$`, method: "Took the buyer's yield equal to the investor's.", feedback: "The buyer's yield is whatever makes R/j equal the sale price." })
      );
      steps = [
        step("B.perpetuity", `Purchase price at ${pct(i)}.`, ["P", price, "purchase price"], ["R", "i"]),
        step("B.annuity-immediate", `Value at ${pct(y)} of the ${n} payments received.`, ["V", received(y), "payments received"], ["R", "y"]),
        step("A.compound", `Accumulate the shortfall to time ${n}: that is the sale price.`, ["S", S, "required sale price"], ["P", "V", "y"], { rearranged: true }),
      ];
      if (level === 2) steps.push(step("B.perpetuity", "The buyer's yield from the sale price: j = R/S.", ["j", answer, "buyer's yield"], ["R", "S"], { rearranged: true }));
    } else {
      fmt = PCT3;
      const y = yieldRoot(price, sale);
      if (y < 0.005 || y > 0.4) throw new Error("Holding yield outside a sensible range.");
      answer = y;
      calc = `${receivedE("x")} + ${saleE(L(j))}*(1+x)**(-${n}) - ${priceE}`;
      model = { expr: `${receivedE("x")} + ${saleE(L(j))}*(1+x)**(-${n}) - ${priceE}`, bracket: [-0.2, 0.8], description: "Purchase price equals payments received plus sale price, all at the holding yield." };
      ask = `Calculate the investor's annual effective yield over the ${n} years.`;
      const simple = (n * R + (n * (n - 1) * Qi) / 2 + sale - price) / (n * price);
      const late = yieldRoot(price, sale, n + 1);
      distractors.push(
        distractor("CONC_BOND_REALIZED_EQUALS_YIELD", i, L(i), { derivation: `$${shown(i, fmt)}$`, method: "Took the purchase yield.", feedback: `The sale at ${pct(j)} adds a ${sale > price ? "gain" : "loss"} that changes the yield.` }),
        distractor("VAR_OTHER_UNKNOWN", j, L(j), { derivation: `$${shown(j, fmt)}$`, method: "Took the buyer's yield.", feedback: "The buyer's yield only sets the sale price." }),
        distractor("ALLOC_EVEN_SPLIT", (i + j) / 2, `(${L(i)}+${L(j)})/2`, { derivation: `$${shown((i + j) / 2, fmt)}$`, method: "Averaged the two yields.", feedback: `The yield depends on how long the perpetuity is held: the price change is spread over ${n} years.` }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `(${n}*${L(R)} + ${(n * (n - 1)) / 2}*${L(Qi)} + ${saleE(L(j))} - ${priceE})/(${n}*${priceE})`, { derivation: `$\\dfrac{\\text{total received} - P}{${n}P} = ${shown(simple, fmt)}$`, method: "Spread the total gain evenly over the years (simple interest).", feedback: "The holding yield solves an equation of value with compound discounting." }),
        distractor("TIMING_EXTRA_PERIOD", late, `${receivedE("x")} + ${saleE(L(j))}*(1+x)**(-${n + 1}) - ${priceE}`, { derivation: `$${shown(late, fmt)}$`, method: `Discounted the sale price ${n + 1} years.`, feedback: `The sale is immediately after payment ${n}, at time ${n}.` })
      );
      steps = [
        step(Qi ? "B.increasing-perpetuity" : "B.perpetuity", `Purchase price at ${pct(i)}.`, ["P", price, "purchase price"], ["R", "i"]),
        step(Qi ? "B.increasing-perpetuity" : "B.perpetuity", `Sale price: the remaining stream at ${pct(j)}.`, ["S", sale, "sale price"], ["R", "j"]),
        step("C.yield-rate", "Equation of value for the holding period.", ["eq", price, "price = receipts at the holding yield"], ["P", "S"]),
        step("M.root-finding", "Solve for the holding yield.", ["y", y, "holding-period yield"], ["eq"], { rearranged: true }),
      ];
    }

    const chainSpec = chain(steps, {
      methods: fmt === PCT3 && !(level === 2 && twist === "B") ? ["equation_construction", "numerical_root"] : ["equation_construction", "work_backwards"],
      reasoning: "The investor's return mixes two streams: a finite annuity of payments actually received and one lump sum — the perpetuity's price at the sale date, set by the buyer's yield.",
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, steps.length - 1])),
    });
    const stream = Qi ? `a perpetuity-immediate paying ${amt(R)} at the end of the first year, increasing by ${amt(Qi)} each year,` : `a perpetuity-immediate paying ${amt(R)} at the end of each year`;
    return {
      stem: `An investor buys ${stream} at a price that gives an annual effective yield of ${pct(i)}. Immediately after receiving the ${n === 1 ? "first" : `${n}th`} payment, the investor sells the remaining payments to a buyer at a price that gives the buyer an annual effective yield of ${level === 2 && twist === "B" ? "$j$" : pct(j)}.\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$= ${shown(answer, fmt)}$` },
      model,
      distractors,
      explanation: explain({
        intuition: "An investor who sells early earns a mixture: the payments actually received (an annuity) and a sale price (a perpetuity valued by someone else, at someone else's yield). If the buyer accepts a lower yield, the investor sells high and earns more than the purchase yield.",
        unknowns: [{ symbol: fmt === PCT3 ? "$y$ or $j$" : "$V$", meaning: "the quantity asked for" }],
        relationships: [`$P = ${Qi ? "\\tfrac{R}{i} + \\tfrac{Q}{i^2}" : "R/i"}$`, `$S = ${Qi ? "\\tfrac{R + nQ}{j} + \\tfrac{Q}{j^2}" : "R/j"}$`, "$P = \\sum_{t \\le n} CF_t (1+y)^{-t} + S(1+y)^{-n}$"],
        conditions: ["Sale immediately after a payment."],
        valuationDate: `Time 0 and time ${n}`,
        modelChoice: "Holding-period equation of value.",
        assumptions: ["Annual effective rates; no costs."],
        solution: [
          ...steps.slice(0, -1).map((s) => ({ title: s.output.meaning.replace(/^./, (c) => c.toUpperCase()), body: `$${s.output.symbol.length === 1 && s.output.value < 1 ? dec(s.output.value, 6) : mnum(s.output.value, 2)}$` })),
          { title: "Answer", body: `$${shown(answer, fmt)}$` },
        ],
        alternative: { name: "Calculator worksheet", body: `N = ${n}, PV = −price, PMT = payment, FV = sale price; compute I/Y.`, whenUseful: "For level payments, the holding yield in one step." },
        principle: "Separate the price you pay, the cash you receive and the price you sell at; each may be set by a different rate.",
        unusual: "Two yields — the investor's and the buyer's — appear in one problem.",
        misread: "The buyer's yield is not the investor's yield, and neither is the holding yield.",
      }),
      visuals: [routeVisual(chainSpec, "Route: annuity received + perpetuity sold", "Two different yields price the two ends.")],
      markers: [price, sale],
      presentation: ["valuation-date", "compare-streams", ...(fmt === PCT3 ? (["unknown-rate"] as const) : (["direct"] as const))],
      features: features({ steps: steps.length, multipleValuationDates: true, multiConcept: true, unfamiliar: level > 1 }),
      params: { R, i, j, n, Qi, twist, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Monthly annuity, then an annual perpetuity

const monthlyPerp: QuestionTemplate = {
  id: "mix-monthly-perp",
  family: "mix-monthly-perp",
  topic: "ANNUITIES",
  levels: [1, 2, 3],
  objective: "ANNUITIES.frequency_timing",
  secondary: ["ANNUITIES.perpetuities", "ANNUITIES.streams", "TVM.effective_nominal"],
  reasoning: ["cashflow_modelling", "valuation_dates", "translation", "multistep"],
  soaConcept: "Monthly payments for a term followed by an annual perpetuity (possibly deferred, growing, or under a changed rate): two payment frequencies, one annual effective rate.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const R = gridAmount(rng, 100, 1000, 25);
    const n = rng.int(3, 10);
    const Q = Math.max(1000, Math.round((12 * R * rng.float(0.6, 1.5, 2)) / 250) * 250);
    const twist = rng.choice(["A", "B"]);
    const d = level >= 2 && (twist === "A" || level === 3) ? rng.int(2, 5) : 0;
    const due = level === 1 && twist === "B";
    const switchRate = (level === 2 && twist === "B") || level === 3;
    const j = switchRate ? Math.max(0.025, i + rng.choice([-0.02, -0.01, 0.01, 0.02])) : i;
    const g = level === 3 ? rng.choice([0.01, 0.02, 0.025]) : 0;
    const mr = (x: number) => Math.pow(1 + x, 1 / 12) - 1;
    const start = 12 * d + (due ? 0 : 1);
    const monthly: Seg = { from: start, to: start + 12 * n - 1, amount: R };
    const tailStart = 12 * (d + n + 1);
    const tail: Seg = { from: tailStart, to: null, amount: Q, every: 12, growth: g };
    const segs = [monthly, tail];
    const regimes: Regime[] = switchRate ? [{ until: 12 * (d + n), rate: mr(i) }, { until: null, rate: mr(j) }] : [{ until: null, rate: mr(i) }];
    const ans = valueOf(segs, regimes);
    const pM = valueOf([monthly], regimes);
    const pT = valueOf([tail], regimes);
    const naive = (x: number) => x / 12;
    const regimesNaive: Regime[] = switchRate ? [{ until: 12 * (d + n), rate: naive(i) }, { until: null, rate: naive(j) }] : [{ until: null, rate: naive(i) }];

    const distractors: DistractorCandidate[] = [
      dv("RATE_DIVIDED_EFFECTIVE", valueOf(segs, regimesNaive), fmt, "monthly rate i/12", `Used ${pct(i)}/12 as the monthly rate.`, `An annual effective ${pct(i)} is $(1+i)^{1/12} - 1 = ${dec(mr(i), 6)}$ per month.`),
      dv("RATE_PAYMENT_FREQUENCY", valueOf([{ from: 12 * (d + 1), to: 12 * (d + n), amount: 12 * R, every: 12 }, tail], regimes), fmt, "monthly payments lumped yearly", `Replaced the monthly payments by ${amt(12 * R)} at each year end.`, "Monthly payments arrive earlier than a year-end lump sum, so they are worth more: use $12R\\,a^{(12)}_{\\overline{n|}}$."),
      dv("RATE_ANNUAL_FOR_PERIODIC", { value: valueOf([monthly], regimes.map((r) => ({ until: r.until, rate: Math.pow(1 + r.rate, 12) - 1 }))).value + pT.value, expr: `${valueOf([monthly], regimes.map((r) => ({ until: r.until, rate: Math.pow(1 + r.rate, 12) - 1 }))).expr} + ${pT.expr}` }, fmt, "annual rate per month", "Discounted the monthly payments at the annual rate for each month.", "Each monthly step needs the monthly equivalent rate $(1+i)^{1/12} - 1$."),
      dv("TIMING_IMMEDIATE_AS_DUE", valueOf([monthly, { ...tail, from: tailStart - 12 }], regimes), fmt, "first annual payment a year early", `Placed the first annual payment at the end of year ${d + n}.`, `The annual payments start at the end of year ${d + n + 1}.`),
      dv("TIMING_IGNORED_DEFERRAL", valueOf(segs, regimes, { tailUndeferred: true }), fmt, "perpetuity not discounted", "Added the perpetuity's value without discounting it to time 0.", `Its value sits at year ${d + n}; discount it ${d + n} years.`),
      dv("TIMING_DEFERRAL_OFF_BY_ONE", valueOf([monthly, { ...tail, from: tailStart + 12 }], regimes), fmt, "perpetuity one year late", `Placed the first annual payment at year ${d + n + 2}.`, `The first annual payment is at the end of year ${d + n + 1}.`),
    ];
    if (due) distractors.push(dv("TIMING_DUE_AS_IMMEDIATE", valueOf([{ ...monthly, from: 1, to: 12 * n }, tail], regimes), fmt, "monthly payments at month ends", "Valued the monthly payments as if made at the end of each month.", "They are made at the start of each month: one month earlier each."));
    if (switchRate) distractors.push(dv("MODEL_SINGLE_RATE", valueOf(segs, [{ until: null, rate: mr(i) }]), fmt, "one rate throughout", `Valued everything at ${pct(i)}.`, `The rate is ${pct(j)} after year ${d + n}.`));
    if (g) distractors.push(dv("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf([monthly, { ...tail, amount: Q * (1 + g) }], regimes), fmt, "first annual payment already grown", "Grew the first annual payment.", `The first annual payment is ${amt(Q)}.`));

    const steps: ChainStep[] = [
      step("B.mthly-annuity", `Monthly payments: $12R\\,${due ? "\\ddot a" : "a"}^{(12)}_{\\overline{${n}|}}$ at the annual rate${d ? `, deferred ${d} years` : ""}.`, ["V_M", pM.value, "value of the monthly payments"], ["R", "i"]),
      step(g ? "B.geometric-perpetuity" : "B.perpetuity", `Annual perpetuity valued at year ${d + n}${switchRate ? ` at ${pct(j)}` : ""}.`, ["V_n", pT.value / (switchRate ? Math.pow(1 + i, -(d + n)) : Math.pow(1 + i, -(d + n))), `perpetuity value at year ${d + n}`], ["Q", "j"]),
      step("A.discount-factor", `Discount it ${d + n} years at ${pct(i)}.`, ["V_T", pT.value, "perpetuity value at 0"], ["V_n", "i"]),
      step("A.equation-of-value", "Add the two parts.", ["PV", ans.value, "present value"], ["V_M", "V_T"]),
    ];
    if (d && level === 3) steps.splice(1, 0, step("B.deferred", `The monthly block starts after ${d} years.`, ["d", d, "deferral in years"], ["d"]));
    const chainSpec = chain(steps, {
      methods: ["decomposition", "valuation_dates"],
      reasoning: "Two frequencies, one annual effective rate: value the monthly block with the monthly factor, the annual block with the annual rate, and meet at time 0.",
      stages: Object.fromEntries(distractors.map((x) => [x.misconception, x.misconception.startsWith("RATE") || x.misconception === "TIMING_DUE_AS_IMMEDIATE" ? 0 : steps.length - 2])),
    });

    const rateText = switchRate ? `The annual effective rate of interest is ${pct(i)} for the first ${d + n} years and ${pct(j)} thereafter.` : `The annual effective rate of interest is ${pct(i)}.`;
    return {
      stem: `Payments of ${amt(R)} are made at the ${due ? "beginning" : "end"} of each month for ${n} years${d ? `, the first ${due ? "at the start" : "at the end"} of the first month of year ${d + 1}` : ""}. Then, starting at the end of year ${d + n + 1}, annual payments ${g ? `begin at ${amt(Q)} and increase by ${pct(g)} each year` : `of ${amt(Q)} are made`} forever. ${rateText}\n\nCalculate the present value of all the payments.`,
      answer: { value: ans.value, calc: ans.expr, format: fmt, derivation: `$\\text{PV} = ${shown(ans.value, fmt)}$` },
      model: { expr: modelOf(segs, regimes), description: "Every monthly payment discounted at the monthly equivalent rate; the annual perpetuity in closed form at its starting date." },
      distractors,
      explanation: explain({
        intuition: "Two clocks run here — months for the first block and years for the perpetuity — but there is only one rate. Convert the annual effective rate to a monthly one for the monthly block, keep it annual for the perpetuity, and bring both to time 0.",
        unknowns: [{ symbol: "$PV$", meaning: "present value of all payments" }],
        relationships: ["$j_{12} = (1+i)^{1/12} - 1$", "$12R\\,a^{(12)}_{\\overline{n|}} = R\\,a_{\\overline{12n|}\\,j_{12}}$", g ? "$\\dfrac{Q}{i - g}$" : "$\\dfrac{Q}{i}$"],
        conditions: [due ? "Monthly payments at the start of each month." : "Monthly payments at the end of each month.", "Annual payments at year ends."],
        valuationDate: "Time 0",
        modelChoice: "Monthly annuity plus a deferred annual perpetuity.",
        assumptions: ["Annual effective rates, converted for monthly payments."],
        solution: [
          { title: "Monthly block", body: `$${mnum(pM.value, 2)}$` },
          { title: "Perpetuity at 0", body: `$${mnum(pT.value, 2)}$` },
          { title: "Present value", body: `$${shown(ans.value, fmt)}$` },
        ],
        alternative: { name: "Everything in months", body: "Treat the perpetuity as payments every 12 months at the monthly rate: its value one interval before the first payment is $Q/\\left((1+j_{12})^{12} - 1\\right) = Q/i$.", whenUseful: "Confirms that the annual perpetuity needs only the annual rate." },
        principle: "Match each block's payment interval to a rate for that interval.",
        unusual: "Two payment frequencies in one stream.",
        misread: "A monthly rate is not the annual effective rate divided by 12.",
      }),
      visuals: [routeVisual(chainSpec, "Route: two frequencies, one rate", "Each block uses the rate for its own interval.")],
      markers: [pM.value, pT.value],
      presentation: ["frequency", "valuation-date", ...(level > 1 ? (["hidden-structure"] as const) : [])],
      features: features({ steps: steps.length, multipleValuationDates: true, multiConcept: true, unfamiliar: level > 1 }),
      params: { R, Q, n, d, i, j, g, twist, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Forward-rate curve with a perpetual tail

const forwardPerp: QuestionTemplate = {
  id: "fwd-perp-tail",
  family: "fwd-perp-tail",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.spot_forward",
  secondary: ["ALM.yield_curves", "ANNUITIES.perpetuities"],
  reasoning: ["cashflow_modelling", "concept_recognition", "valuation_dates", "multistep"],
  soaConcept: "Cash flows valued from a term structure given as one-year forward rates (or spot rates) for the first years and a flat forward rate thereafter — annuity and perpetuity pieces on a curve.",
  generate(rng, level): QuestionDraft {
    const fwd = [gridRate(rng, 0.02, 0.05, 0.0025)];
    for (let k = 1; k < 3; k += 1) fwd.push(fwd[k - 1] + rng.choice([0.0025, 0.005, 0.0075, 0.01]));
    if (level === 3) {
      // Quoted as spot rates: draw round spot rates and derive the one-year forwards from them.
      const sp = [fwd[0]];
      for (let k = 1; k < 3; k += 1) sp.push(sp[k - 1] + rng.choice([0.0025, 0.005, 0.0075]));
      fwd[1] = Math.pow(1 + sp[1], 2) / (1 + sp[0]) - 1;
      fwd[2] = Math.pow(1 + sp[2], 3) / Math.pow(1 + sp[1], 2) - 1;
    }
    const f = Math.round((fwd[2] + rng.choice([0, 0.005, 0.01])) * 400) / 400;
    const R = gridAmount(rng, 500, 5000, 100);
    const twist = rng.choice(["A", "B"]);
    const regimes: Regime[] = [
      { until: 1, rate: fwd[0] },
      { until: 2, rate: fwd[1] },
      { until: 3, rate: fwd[2] },
      { until: null, rate: f },
    ];
    const spots = [1, 2, 3].map((t) => Math.pow(fwd.slice(0, t).reduce((a, x) => a * (1 + x), 1), 1 / t) - 1);
    const useSpots = level === 3;
    const Q = gridAmount(rng, 500, 5000, 100);
    const g = level === 3 ? rng.choice([0.005, 0.01, 0.015]) : 0;
    let fmt: AnswerFormat = MONEY2;
    let segs: Seg[];
    let ask: string;
    if (level === 1) {
      segs = [{ from: 1, to: 3, amount: R }];
      ask = twist === "A" ? `Calculate the price of an annuity paying ${amt(R)} at the end of each of the next 3 years.` : "Calculate the 3-year spot rate.";
      if (twist === "B") fmt = { kind: "percent", decimals: 3 };
    } else if (level === 2) {
      segs = twist === "A" ? [{ from: 1, to: null, amount: R }] : [{ from: 4, to: null, amount: R }];
      ask = twist === "A" ? `Calculate the price of a perpetuity paying ${amt(R)} at the end of each year.` : `Calculate the price of a perpetuity paying ${amt(R)} at the end of each year, the first payment at the end of year 4.`;
    } else {
      segs = [
        { from: 1, to: 3, amount: R },
        { from: 4, to: null, amount: Q, growth: g },
      ];
      ask = `Calculate the price of a stream paying ${amt(R)} at the end of each of years 1–3, then ${amt(Q)} at the end of year 4 increasing by ${pc(g, 3)} each year thereafter forever.`;
    }
    const spot3 = twist === "B" && level === 1;
    const ans: Valued = spot3 ? { value: spots[2], expr: `((1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])}))**(1/3)-1` } : valueOf(segs, regimes);
    const model = spot3 ? `(1+x)**3 - (1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])})` : modelOf(segs, regimes);

    const D3 = (1 + fwd[0]) * (1 + fwd[1]) * (1 + fwd[2]);
    const distractors: DistractorCandidate[] = [];
    if (spot3) {
      const avg = (fwd[0] + fwd[1] + fwd[2]) / 3;
      distractors.push(
        distractor("RATE_FORCE_AS_EFFECTIVE", Math.log(D3) / 3, `log((1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])}))/3`, { derivation: `$\\tfrac13\\ln(${dec(D3, 6)}) = ${shown(Math.log(D3) / 3, fmt)}$`, method: "Averaged the logarithms — a force of interest, not an effective rate.", feedback: "The 3-year spot rate is annual effective: $(\\text{factor})^{1/3} - 1$." }),
        distractor("SEQ_TERM_COUNT", Math.sqrt(D3) - 1, `((1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])}))**(1/2)-1`, { derivation: `$${shown(Math.sqrt(D3) - 1, fmt)}$`, method: "Annualised the 3-year factor over 2 years.", feedback: "Three one-year rates span 3 years: take the cube root." }),
        distractor("ALLOC_EVEN_SPLIT", avg, `(${L(fwd[0])}+${L(fwd[1])}+${L(fwd[2])})/3`, { derivation: `$${shown(avg, fmt)}$`, method: "Averaged the forward rates.", feedback: "The 3-year spot rate is a geometric average: $(1+s_3)^3 = \\prod(1+f_t)$." }),
        distractor("COMP_FORWARD_AS_SPOT", fwd[2], L(fwd[2]), { derivation: `$${shown(fwd[2], fmt)}$`, method: "Took the third forward rate as the 3-year spot rate.", feedback: "The spot rate averages all three years." }),
        distractor("CONC_ALM_FORWARD_NOT_ANNUALIZED", (1 + fwd[0]) * (1 + fwd[1]) * (1 + fwd[2]) - 1, `(1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])})-1`, { derivation: `$${shown((1 + fwd[0]) * (1 + fwd[1]) * (1 + fwd[2]) - 1, fmt)}$`, method: "Gave the 3-year growth without annualising.", feedback: "Take the cube root." }),
        distractor("ALG_ROOT_ERROR", (D3 - 1) / 3, `((1+${L(fwd[0])})*(1+${L(fwd[1])})*(1+${L(fwd[2])})-1)/3`, { derivation: `$${shown((D3 - 1) / 3, fmt)}$`, method: "Divided the 3-year growth by 3 instead of taking the cube root.", feedback: "$(1+s_3)^3$ is the 3-year factor: $s_3 = (\\text{factor})^{1/3} - 1$." })
      );
    } else {
      let fs = 0;
      const fsE: string[] = [];
      for (const sg of segs) {
        // Forward (or spot) rates misread: payment at t discounted over its whole term at that year's own rate.
        const v = valueOf([sg], regimes, { byPaymentDate: true });
        fs += v.value;
        fsE.push(v.expr);
      }
      const hasTail = segs.some((x) => x.to === null);
      distractors.push(
        distractor(useSpots ? "COMP_SPOT_AS_FORWARD" : "COMP_FORWARD_AS_SPOT", fs, fsE.join(" + "), { derivation: `$= ${shown(fs, fmt)}$`, method: useSpots ? "Treated the spot rates as one-year forward rates." : "Discounted each payment at its year's forward rate over its whole term, as if it were a spot rate.", feedback: useSpots ? "A spot rate $s_t$ discounts over t years in one step: $v_t = (1+s_t)^{-t}$." : "A payment at time t is discounted by $\\prod_{k \\le t}(1+f_k)^{-1}$." }),
        dv("MODEL_SINGLE_RATE", valueOf(segs, [{ until: null, rate: f }]), fmt, "flat at the long forward rate", `Discounted everything at ${pct(f)}.`, "The first three years have their own rates."),
        dv("COMP_YIELD_AS_LONGEST_SPOT", valueOf(segs, [{ until: null, rate: spots[2] }]), fmt, "flat at the 3-year spot rate", `Discounted everything at the 3-year spot rate ${pct(spots[2])}.`, hasTail ? `After year 3 the forward rate is ${pct(f)}; before it, each year has its own rate.` : "Each payment needs the discount factor for its own date."),
        dv("TIMING_IMMEDIATE_AS_DUE", valueOf(shifted(segs, -1), regimes), fmt, "payments at the start of each year", "Treated the payments as made at the start of each year.", "Payments are at year ends.")
      );
      if (hasTail) {
        const tailSeg = segs[segs.length - 1];
        const lateTail = valueOf([tailSeg], regimes).value / (1 + f);
        const head = segs.length > 1 ? valueOf([segs[0]], regimes) : { value: 0, expr: "0" };
        distractors.push(
          dv("TIMING_IGNORED_DEFERRAL", valueOf(segs, regimes, { tailUndeferred: true }), fmt, "tail not discounted", "Left the perpetual part at its starting date.", "Discount it back through the first years' rates."),
          distractor("TIMING_DEFERRAL_OFF_BY_ONE", head.value + lateTail, `${head.expr} + (${valueOf([tailSeg], regimes).expr})/(1+${L(f)})`, { derivation: `$= ${shown(head.value + lateTail, fmt)}$`, method: "Discounted the perpetual part one year too many.", feedback: "The perpetuity formula already gives its value one year before its first payment." })
        );
      } else {
        const av = R * ((1 + fwd[1]) * (1 + fwd[2]) + (1 + fwd[2]) + 1);
        distractors.push(
          dv("TIMING_EXTRA_PERIOD", valueOf(shifted(segs, 1), regimes), fmt, "payments one year later", "Discounted each payment one year too many.", "Payments are at the ends of years 1, 2 and 3."),
          distractor("FORMULA_AV_FOR_PV", av, `${L(R)}*((1+${L(fwd[1])})*(1+${L(fwd[2])}) + (1+${L(fwd[2])}) + 1)`, { derivation: `$= ${shown(av, fmt)}$`, method: "Accumulated the payments to year 3 instead of discounting them to today.", feedback: "The price is a present value: discount each payment to time 0." })
        );
      }
      if (g) distractors.push(dv("CONC_ANN_FIRST_PAYMENT_GROWTH", valueOf([segs[0], { ...segs[1], amount: Q * (1 + g) }], regimes), fmt, "first growing payment grown", "Grew the first tail payment.", `The year-4 payment is ${amt(Q)}.`));
    }

    const steps: ChainStep[] = [];
    if (useSpots) steps.push(step("F.spot", "Discount factors straight from the spot rates.", ["v_3", 1 / D3, "3-year discount factor"], ["s_1", "s_2", "s_3"]));
    else steps.push(step("F.forward-chain", "Chain the forward rates into discount factors.", ["v_3", 1 / D3, "3-year discount factor"], ["f_1", "f_2", "f_3"]));
    if (spot3) steps.push(step("F.spot", "Annualise the 3-year factor.", ["s_3", ans.value, "3-year spot rate"], ["v_3"], { rearranged: true }));
    else {
      if (level !== 2 || twist === "A") steps.push(step("F.spot-pricing", "Value the payments in years 1–3 with their discount factors.", ["V_1", valueOf([{ from: 1, to: 3, amount: R }], regimes).value, "first three payments"], ["v_t"]));
      if (level >= 2) {
        steps.push(step(g ? "B.geometric-perpetuity" : "B.perpetuity", `Perpetual part valued at year 3 at the flat ${pct(f)}.`, ["V_3", valueOf([segs[segs.length - 1]], regimes).value * D3, "tail value at year 3"], ["f"]));
        steps.push(step("A.discount-factor", "Discount the tail with the 3-year factor.", ["V_T", valueOf([segs[segs.length - 1]], regimes).value, "tail value at 0"], ["v_3"]));
      }
      steps.push(step("A.equation-of-value", "Add the pieces.", ["P", ans.value, "price"], ["pieces"]));
    }
    const chainSpec = chain(steps, {
      methods: ["decomposition", "valuation_dates"],
      reasoning: "A curve is a discount function: chain the one-year rates for the early years, then treat the flat part as a perpetuity valued where the flat part begins.",
      stages: Object.fromEntries(distractors.map((x) => [x.misconception, Math.min(steps.length - 1, x.misconception.startsWith("COMP") || x.misconception === "ALLOC_EVEN_SPLIT" ? 0 : steps.length - 2)])),
    });

    const curveText = useSpots
      ? `The 1-, 2- and 3-year spot rates are ${pct(spots[0])}, ${pct(spots[1])} and ${pct(spots[2])}. Every one-year forward rate beyond year 3 is ${pct(f)}.`
      : `The one-year forward rates for years 1, 2 and 3 are ${pct(fwd[0])}, ${pct(fwd[1])} and ${pct(fwd[2])}${level >= 2 ? `, and every one-year forward rate after year 3 is ${pct(f)}` : ""}.`;
    return {
      stem: `${curveText} All rates are annual effective.\n\n${ask}`,
      answer: { value: ans.value, calc: ans.expr, format: fmt, derivation: `$= ${shown(ans.value, fmt)}$` },
      model: { expr: model, description: "Each payment discounted through the year-by-year rates of the curve; the flat part in closed form." },
      distractors,
      explanation: explain({
        intuition: "A term structure is just a discount factor for every date. Build it by chaining one-year rates (or read it from spot rates). Where the curve goes flat, the remaining payments form an ordinary perpetuity at that flat rate — valued at the date the flat part begins, then discounted through the curve.",
        unknowns: [{ symbol: spot3 ? "$s_3$" : "$P$", meaning: spot3 ? "3-year spot rate" : "price" }],
        relationships: ["$v_t = \\prod_{k=1}^{t}(1+f_k)^{-1} = (1+s_t)^{-t}$", "$\\text{flat tail at year 3} = \\dfrac{Q}{f - g}$"],
        conditions: ["Annual effective rates; end-of-year payments."],
        valuationDate: "Time 0",
        modelChoice: "Discount function from the curve; perpetuity for the flat section.",
        assumptions: ["No arbitrage: prices are the curve's discounted values."],
        solution: [
          { title: "3-year discount factor", body: `$v_3 = ${dec(1 / D3, 6)}$` },
          { title: spot3 ? "Spot rate" : "Price", body: `$${shown(ans.value, fmt)}$` },
        ],
        alternative: { name: "Spot-rate route", body: "Convert the forward rates to spot rates and discount each payment by $(1+s_t)^{-t}$ — same discount factors.", whenUseful: "When the question gives spot rates directly." },
        principle: "Any curve, however quoted, reduces to discount factors.",
        unusual: level >= 2 ? "A perpetuity priced on a non-flat curve." : "The curve is given as forward rates.",
        misread: "A forward rate applies to one year only; it is not the rate for discounting over t years.",
      }),
      visuals: [{ kind: "curve", title: "The curve", points: [1, 2, 3].map((t) => ({ t, spot: spots[t - 1], forward: fwd[t - 1] })) }, routeVisual(chainSpec, "Route: discount factors, then a perpetuity", "The flat part is a perpetuity at year 3.")],
      markers: [1 / D3, ans.value],
      presentation: level === 1 ? ["direct"] : ["hidden-structure", "valuation-date"],
      features: features({ steps: steps.length, multipleValuationDates: level > 1, multiConcept: level > 1, unfamiliar: level > 1 }),
      params: { f1: fwd[0], f2: fwd[1], f3: fwd[2], f, R, Q, g, twist, level },
      chain: chainSpec,
    };
  },
};

export const MIXED_PV_TEMPLATES: QuestionTemplate[] = [regimePerpetuity, perpResale, monthlyPerp, forwardPerp];
