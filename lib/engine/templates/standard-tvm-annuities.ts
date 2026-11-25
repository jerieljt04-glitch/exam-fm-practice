/**
 * SOA-standard (level 1) multi-case templates — time value of money and
 * annuities. Each template asks one of three different questions about the
 * same kind of situation (a value, a rate, a term or a payment), so when a
 * template returns in a later mock it asks for different steps.
 */
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import type { MisconceptionId } from "../misconceptions";
import { MONEY2, amt, gridAmount, gridRate, pc, step } from "./kit";
import { K, X, add, adue, an, at, div, exp, geoA, ia, da, ln, mul, nameOf, pick, pow, sn, std, sub, sum, vt, type Eq, type Trap } from "./elite-kit";

const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };
const YEARS2: AnswerFormat = { kind: "number", decimals: 2 };
const pct = (x: number) => pc(x, 3);
const freq = (m: number) => (m === 12 ? "monthly" : m === 4 ? "quarterly" : "semiannually");
const t = (id: MisconceptionId, value: X | Eq, label: string, method: string, feedback: string): Trap => ({ id, value, label, method, feedback });
const flows = (n: number, term: (k: number) => X): X => sum(Array.from({ length: n }, (_, k) => term(k)));

// ===================================================================== TVM 1: accumulation, the rate, the time

const accum: QuestionTemplate = {
  id: "std-tvm-accum",
  family: "std-tvm-accum",
  topic: "TVM",
  levels: [1],
  objective: "TVM.effective_nominal",
  secondary: ["TVM.simple_compound", "TVM.force_of_interest"],
  reasoning: ["formula_selection", "translation", "arithmetic"],
  soaConcept: "A single deposit accumulated at a nominal rate or a force of interest; the same relation solved for the amount, the rate or the time.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const P = gridAmount(rng, 1000, 20000, 500);
    const kase = pick(rng, ["value", "rate", "time"]);
    if (kase === "value") {
      const m = pick(rng, [2, 4, 12]);
      const im = gridRate(rng, 0.03, 0.09, 0.0025);
      const n = rng.int(3, 15);
      const ans = mul(P, pow(1 + im / m, m * n));
      return std({
        stem: `${name} deposits ${amt(P)} in an account crediting interest at a nominal annual rate of ${pct(im)} convertible ${freq(m)}.\n\nCalculate the amount in the account after ${n} years.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(P, exp(mul(m * n, ln(1 + im / m)))),
        modelDescription: "Accumulation written as an exponential of the number of periods times the log of one period's growth.",
        traps: [
          t("RATE_NOMINAL_AS_EFFECTIVE", mul(P, pow(1 + im, n)), "nominal rate used as effective", `Used ${pct(im)} as an annual effective rate.`, `Convert: ${pct(im)}/${m} per period for ${m * n} periods.`),
          t("MODEL_COMPOUND_AS_SIMPLE", mul(P, 1 + im * n), "simple interest", "Used simple interest.", "Interest is compounded."),
          t("COMP_PERIODS_AS_YEARS", mul(P, pow(1 + im / m, n)), "years used as periods", `Compounded ${n} times.`, `There are ${m * n} periods.`),
          t("TIMING_EXTRA_PERIOD", mul(P, pow(1 + im / m, m * (n + 1))), "one year too many", `Accumulated ${n + 1} years.`, `The term is ${n} years.`),
          t("FORMULA_AV_FOR_PV", mul(P, pow(1 + im / m, -m * n)), "discounted instead", "Discounted instead of accumulating.", "Money grows forward in time."),
        ],
        steps: [step("A.nominal-equivalence", "Rate per period.", ["i/m", im / m, "rate per period"], ["i^(m)"]), step("A.compound", "Accumulate.", ["AV", ans.v, "amount"], ["P"])],
        methods: ["substitution"],
        reasoning: "Divide the nominal rate by the conversion frequency and compound for the number of periods.",
        intuition: "A nominal rate is quoted per year but credited per period.",
        unknown: ["$AV$", "amount after the term"],
        relationships: [`$AV = P(1 + i^{(${m})}/${m})^{${m}n}$`],
        valuationDate: `Year ${n}`,
        principle: "Nominal rates compound per conversion period.",
        misread: "Using the nominal rate as an effective rate.",
        presentation: ["direct", "frequency"],
        params: { kase, P, m, im, n },
        route: "period rate, compound",
      });
    }
    if (kase === "rate") {
      const m = pick(rng, [2, 4, 12]);
      const imTrue = gridRate(rng, 0.03, 0.09, 0.0025);
      const n = rng.int(3, 15);
      const AV = Math.round(P * Math.pow(1 + imTrue / m, m * n) * 100) / 100;
      const g = AV / P;
      const ans = mul(m, sub(pow(g, 1 / (m * n)), 1));
      return std({
        stem: `${name} deposits ${amt(P)} and has ${amt(AV)} after ${n} years.\n\nCalculate the nominal annual rate of interest convertible ${freq(m)} that was credited.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(mul(P, pow(add(1, div(x, m)), m * n)), AV), lo: 0.0001, hi: 0.5 },
        modelDescription: "Equation of value with the unknown nominal rate.",
        traps: [
          t("VAR_OTHER_UNKNOWN", sub(pow(g, 1 / n), 1), "annual effective rate", "Gave the annual effective rate.", `The question asks for the rate convertible ${freq(m)}.`),
          t("MODEL_COMPOUND_AS_SIMPLE", K((g - 1) / n), "simple interest rate", "Solved with simple interest.", "Interest compounds."),
          t("RATE_ANNUAL_FOR_PERIODIC", sub(pow(g, 1 / (m * n)), 1), "rate per period", "Gave the rate per period.", `Multiply by ${m}.`),
          t("COMP_PERIODS_AS_YEARS", mul(m, sub(pow(g, 1 / n), 1)), "years used as periods", `Took ${n} periods.`, `There are ${m * n} periods.`),
        ],
        steps: [step("A.compound", "Growth factor.", ["AV/P", g, "growth factor"], ["P", "AV"]), step("M.logarithm", "Rate per period.", ["j", Math.pow(g, 1 / (m * n)) - 1, "rate per period"], ["AV/P"], { rearranged: true }), step("A.nominal-equivalence", "Nominal rate.", ["i^{(m)}", ans.v, "nominal rate"], ["j"])],
        methods: ["rearrangement"],
        reasoning: "Take the root of the growth factor over the number of periods, then multiply by the frequency.",
        intuition: "Work backwards from the growth factor.",
        unknown: [`$i^{(${m})}$`, "nominal rate"],
        relationships: [`$P(1 + i^{(${m})}/${m})^{${m * n}} = AV$`],
        valuationDate: `Year ${n}`,
        principle: "A nominal rate is m times the effective rate per period.",
        misread: "Giving the annual effective rate.",
        presentation: ["unknown-rate", "frequency"],
        params: { kase, P, AV, m, n },
        route: "growth factor, root, nominal",
      });
    }
    const delta = gridRate(rng, 0.03, 0.08, 0.0025);
    const s = pick(rng, [1, 2, 3]);
    const AV = gridAmount(rng, Math.round(P * 1.4), Math.round(P * 3), 100);
    const core = div(ln(AV / P), delta);
    const ans = add(s, core);
    return std({
      stem: `${name} will deposit ${amt(P)} ${s} year${s > 1 ? "s" : ""} from now in a fund earning a constant force of interest of ${pct(delta)}.\n\nCalculate the time, measured in years from now, at which the fund first reaches ${amt(AV)}.`,
      fmt: YEARS2,
      answer: ans,
      model: { eq: (x: X) => sub(mul(P, exp(mul(delta, sub(x, s)))), AV), lo: s, hi: s + 200 },
      modelDescription: "The deposit accumulated under the force from its deposit date, equated to the target.",
      traps: [
        t("TIMING_VALUATION_DATE", core, "measured from the deposit date", "Measured the time from the deposit.", `The deposit is made ${s} years from now.`),
        t("RATE_FORCE_AS_EFFECTIVE", add(s, div(ln(AV / P), ln(1 + delta))), "force used as effective rate", `Used ${pct(delta)} as annual effective.`, `Growth is $e^{${delta}t}$.`),
        t("MODEL_COMPOUND_AS_SIMPLE", add(s, (AV / P - 1) / delta), "simple interest", "Used simple interest.", "A constant force compounds continuously."),
        t("ALG_DIVIDE_ERROR", add(s, mul(ln(AV / P), delta * 100)), "multiplied by the rate", "Multiplied by the force (in percent) instead of dividing.", "$t = \\ln(AV/P)/\\delta$."),
      ],
      steps: [step("A.constant-force", "Growth under a constant force.", ["\\ln(AV/P)", Math.log(AV / P), "log growth needed"], ["P", "AV"]), step("M.logarithm", "Time after the deposit.", ["t'", core.v, "years after the deposit"], ["\\delta"], { rearranged: true }), step("A.equation-of-value", "Add the wait before the deposit.", ["t", ans.v, "time from now"], ["t'"])],
      methods: ["logarithms"],
      reasoning: "Solve P e^{δt'} = AV for t', then add the time until the deposit.",
      intuition: "The clock starts now, the money starts later.",
      unknown: ["$t$", "time from now"],
      relationships: ["$Pe^{\\delta(t - s)} = AV$"],
      valuationDate: "The unknown date",
      principle: "Under a constant force, accumulation is exponential in time.",
      misread: "Measuring from the deposit date.",
      presentation: ["unknown-time", "valuation-date"],
      params: { kase, P, AV, s, delta },
      route: "log growth, time, offset",
    });
  },
};

// ===================================================================== TVM 2: equations of value

const eqValue: QuestionTemplate = {
  id: "std-tvm-equation-value",
  family: "std-tvm-equation-value",
  topic: "TVM",
  levels: [1],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value", "TVM.simple_compound"],
  reasoning: ["valuation_dates", "cashflow_modelling", "arithmetic"],
  soaConcept: "Payments at different dates replaced by an equivalent payment, or a missing payment found from an equation of value.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const X1 = gridAmount(rng, 1000, 8000, 100);
    const Y = gridAmount(rng, 1000, 8000, 100);
    const t1 = rng.int(1, 4);
    const t2 = t1 + rng.int(2, 6);
    const kase = pick(rng, ["single", "equated-time", "missing"]);
    const pv = add(mul(X1, vt(i, t1)), mul(Y, vt(i, t2)));
    if (kase === "single") {
      const T = rng.int(t2 + 1, t2 + 6);
      const val = (rate: number, TT = T) => add(mul(X1, at(rate, TT - t1)), mul(Y, at(rate, TT - t2)));
      const ans = val(i);
      return std({
        stem: `${name} is owed ${amt(X1)} at time ${t1} and ${amt(Y)} at time ${t2}. The debtor offers a single payment at time ${T} instead. At an annual effective rate of ${pct(i)}, calculate the single payment that is equivalent.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(pv, pow(1 + i, T)),
        modelDescription: "Present value of both payments accumulated to the payment date.",
        traps: [
          t("SEQ_UNDISCOUNTED_SUM", K(X1 + Y), "payments added", "Added the two payments.", "Each payment earns interest until the new date."),
          t("TIMING_VALUATION_DATE", pv, "value at time 0", "Gave the present value.", `Value at time ${T}.`),
          t("TIMING_EXTRA_PERIOD", val(i, T + 1), "one year too many", `Accumulated to time ${T + 1}.`, `The payment is at time ${T}.`),
          t("MODEL_COMPOUND_AS_SIMPLE", add(mul(X1, 1 + i * (T - t1)), mul(Y, 1 + i * (T - t2))), "simple interest", "Used simple interest.", "Interest compounds."),
        ],
        steps: [step("A.accumulation", "Accumulate each payment to the new date.", ["V_1", X1 * Math.pow(1 + i, T - t1), "first payment at the new date"], ["X", "i"]), step("A.equation-of-value", "Add.", ["Z", ans.v, "equivalent payment"], ["V_1", "V_2"])],
        methods: ["valuation_dates"],
        reasoning: "Move each payment to the new date and add.",
        intuition: "Equivalent means equal value at any one date.",
        unknown: ["$Z$", "equivalent payment"],
        relationships: [`$Z = X(1+i)^{${T - t1}} + Y(1+i)^{${T - t2}}$`],
        valuationDate: `Time ${T}`,
        principle: "Compare cash flows at a single date.",
        misread: "Adding the payments without interest.",
        presentation: ["valuation-date", "direct"],
        params: { kase, X1, Y, t1, t2, T, i },
        route: "accumulate, add",
      });
    }
    if (kase === "equated-time") {
      const T = div(ln(div(X1 + Y, pv)), ln(1 + i));
      return std({
        stem: `Payments of ${amt(X1)} at time ${t1} and ${amt(Y)} at time ${t2} are to be replaced by a single payment of ${amt(X1 + Y)}. At an annual effective rate of ${pct(i)}, calculate the time at which the single payment must be made.`,
        fmt: YEARS2,
        answer: T,
        model: { eq: (x: X) => sub(mul(X1 + Y, vt(i, x)), pv), lo: 0, hi: 60 },
        modelDescription: "Present value of the single payment equated to the present value of the two payments.",
        traps: [
          t("MODEL_UNDISCOUNTED_WEIGHTS", K((X1 * t1 + Y * t2) / (X1 + Y) + 0.0), "amount-weighted average time", "Used the method of equated time.", "That approximation ignores interest; solve the equation of value."),
          t("RATE_FORCE_AS_EFFECTIVE", div(ln(div(X1 + Y, pv)), i), "rate used as the force", "Divided by i instead of ln(1 + i).", "$v^t = (1+i)^{-t}$."),
          t("VAR_OTHER_UNKNOWN", sub(T, t1), "time after the first payment", `Measured from time ${t1}.`, "Measure from time 0."),
          t("TIMING_VALUATION_DATE", K((t1 + t2) / 2), "midpoint of the dates", "Took the midpoint of the two dates.", "Weight by value, through the equation of value."),
          t("TIMING_EXTRA_PERIOD", add(T, 1), "one year too late", "Added a year.", "Solve the equation of value exactly."),
        ],
        steps: [step("A.discount-factor", "Present value of the two payments.", ["PV", pv.v, "present value"], ["X", "Y", "i"]), step("A.equation-of-value", "Equate to the single payment discounted.", ["v^t", pv.v / (X1 + Y), "discount factor needed"], ["PV"], { derived: true }), step("M.logarithm", "Solve for t.", ["t", T.v, "equated time"], ["v^t"], { rearranged: true })],
        methods: ["logarithms", "valuation_dates"],
        reasoning: "Equate present values and solve for the exponent.",
        intuition: "The single payment sits a little before the amount-weighted average date.",
        unknown: ["$t$", "time of the single payment"],
        relationships: ["$(X+Y)v^t = Xv^{t_1} + Yv^{t_2}$"],
        valuationDate: "Time 0",
        principle: "Exact equated time comes from the equation of value.",
        misread: "Using the amount-weighted average date.",
        presentation: ["unknown-time", "valuation-date"],
        params: { kase, X1, Y, t1, t2, i },
        route: "present value, equate, logarithm",
      });
    }
    const Z = Math.round((pv.v * (1.1 + rng.next() * 0.4)) / 100) * 100;
    const W = mul(sub(Z, mul(X1, vt(i, t1))), at(i, t2));
    return std({
      stem: `${name} borrows ${amt(Z)} today and repays it with ${amt(X1)} at time ${t1} and a second payment at time ${t2}. At an annual effective rate of ${pct(i)}, calculate the second payment.`,
      fmt: MONEY2,
      answer: W,
      model: { eq: (x: X) => sub(add(mul(X1, pow(1 + i, -t1)), mul(x, pow(1 + i, -t2))), Z), lo: 1, hi: Z * 10 },
      modelDescription: "Present value of the repayments equated to the loan.",
      traps: [
        t("TIMING_IGNORED_DEFERRAL", sub(Z, mul(X1, vt(i, t1))), "balance not accumulated", "Stopped at the present value of what is left.", `Accumulate it to time ${t2}.`),
        t("SEQ_UNDISCOUNTED_SUM", mul(Z - X1, at(i, t2)), "first payment not discounted", "Subtracted the first payment at face value.", "Discount it to time 0 first."),
        t("TIMING_EXTRA_PERIOD", mul(W, 1 + i), "one year too many", `Accumulated to time ${t2 + 1}.`, `The second payment is at time ${t2}.`),
        t("MODEL_COMPOUND_AS_SIMPLE", mul(sub(Z, X1 / (1 + i * t1)), 1 + i * t2), "simple interest", "Used simple interest.", "Interest compounds."),
      ],
      steps: [step("A.discount-factor", "Present value of the first repayment.", ["X v^{t_1}", X1 * Math.pow(1 + i, -t1), "present value of the first repayment"], ["X", "i"]), step("A.equation-of-value", "Remaining value, accumulated to the second date.", ["W", W.v, "second payment"], ["Z"], { rearranged: true })],
      methods: ["valuation_dates", "rearrangement"],
      reasoning: "Subtract the present value of the known repayment and accumulate the rest.",
      intuition: "What the first repayment does not cover must be paid later, with interest.",
      unknown: ["$W$", "second payment"],
      relationships: ["$Z = Xv^{t_1} + Wv^{t_2}$"],
      valuationDate: "Time 0",
      principle: "Equations of value can be solved for any one unknown payment.",
      misread: "Forgetting to accumulate the remaining balance.",
      presentation: ["inverse", "valuation-date"],
      params: { kase, Z, X1, t1, t2, i },
      route: "present value, remainder, accumulate",
    });
  },
};

// ===================================================================== TVM 3: discount rates

const discount: QuestionTemplate = {
  id: "std-tvm-discount",
  family: "std-tvm-discount",
  topic: "TVM",
  levels: [1],
  objective: "TVM.discount_rates",
  secondary: ["TVM.effective_nominal", "TVM.present_future_value"],
  reasoning: ["formula_selection", "translation", "arithmetic"],
  soaConcept: "Rates of discount: converting to rates of interest, pricing a discounted amount, and recovering the rate from a price.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const kase = pick(rng, ["convert", "price", "solve"]);
    if (kase === "convert") {
      const m1 = pick(rng, [2, 4, 12]);
      const m2 = pick(rng, [2, 4, 12].filter((x) => x !== m1));
      const d = gridRate(rng, 0.05, 0.12, 0.0025);
      const i = sub(pow(1 - d / m1, -m1), 1);
      const conv = (ie: X | number) => mul(m2, sub(pow(add(1, ie), 1 / m2), 1));
      const ans = conv(i);
      return std({
        stem: `A bank quotes a nominal annual rate of discount of ${pct(d)} convertible ${freq(m1)}.\n\nCalculate the equivalent nominal annual rate of interest convertible ${freq(m2)}.`,
        fmt: PCT3,
        answer: ans,
        model: { eq: (x: X) => sub(pow(add(1, div(x, m2)), m2), pow(1 - d / m1, -m1)), lo: 0.0001, hi: 0.5 },
        modelDescription: "One year's growth under both conventions equated.",
        traps: [
          t("RATE_DISCOUNT_AS_INTEREST", conv(pow(1 + d / m1, m1).v - 1), "discount used as interest", "Treated the quote as a rate of interest.", "Discount: $(1 - d/m)^{-m}$ per year."),
          t("VAR_OTHER_UNKNOWN", i, "annual effective rate", "Gave the annual effective rate.", `Convert to the rate convertible ${freq(m2)}.`),
          t("RATE_NOMINAL_AS_EFFECTIVE", conv(d / (1 - d)), "nominal discount used as effective", `Used ${pct(d)} as annual effective discount.`, `Convert per ${m1 === 12 ? "month" : m1 === 4 ? "quarter" : "half-year"}.`),
          t("RATE_DIVIDED_EFFECTIVE", K(d), "rate unchanged", "Assumed the two quotes are the same number.", "Interest and discount rates differ."),
          t("RATE_ANNUAL_FOR_PERIODIC", sub(pow(add(1, i), 1 / m2), 1), "rate per period", "Gave the effective rate per period.", `Multiply by ${m2} for the nominal rate.`),
        ],
        steps: [step("A.nominal-equivalence", "Annual effective rate from the discount quote.", ["i", i.v, "annual effective rate"], ["d^(m)"]), step("A.nominal-conversion", "Requested nominal rate.", ["i^{(n)}", ans.v, "nominal interest rate"], ["i"])],
        methods: ["substitution"],
        reasoning: "Go through the annual effective rate: d^(m) → i → i^(n).",
        intuition: "Every convention is a statement about one year's growth.",
        unknown: ["$i^{(n)}$", "nominal interest rate"],
        relationships: [`$(1 - d^{(${m1})}/${m1})^{-${m1}} = (1 + i^{(${m2})}/${m2})^{${m2}}$`],
        valuationDate: "One year",
        principle: "Equivalent rates give the same growth over a year.",
        misread: "Treating the discount quote as interest.",
        presentation: ["frequency", "direct"],
        params: { kase, d, m1, m2 },
        route: "effective, nominal",
      });
    }
    const F = gridAmount(rng, 10000, 100000, 1000);
    const months = pick(rng, kase === "price" ? [18, 30, 42, 54, 66] : [3, 6, 9, 13, 18, 26]);
    if (kase === "price") {
      const d = gridRate(rng, 0.04, 0.1, 0.0025);
      const ans = mul(F, pow(1 - d, months / 12));
      return std({
        stem: `A note pays ${amt(F)} in ${months} months. ${name} buys it at a price based on an annual effective rate of discount of ${pct(d)}.\n\nCalculate the price.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(F, exp(mul(months / 12, ln(1 - d)))),
        modelDescription: "Discount factor (1 − d)^t written through logarithms.",
        traps: [
          t("MODEL_COMPOUND_AS_SIMPLE", mul(F, 1 - (d * months) / 12), "simple discount", "Used simple discount.", "An effective rate of discount compounds."),
          t("RATE_DISCOUNT_AS_INTEREST", mul(F, pow(1 + d, -months / 12)), "discount used as interest", "Discounted at the rate as if it were interest.", "Use $(1 - d)^t$."),
          t("COMP_PERIODS_AS_YEARS", mul(F, pow(1 - d, months)), "months used as years", "Used the months as years.", `${months} months = ${months / 12} years.`),
          t("VAR_FACE_FOR_PRICE", K(F), "face amount", "Gave the face amount.", "The price is the discounted amount."),
          t("TIMING_EXTRA_PERIOD", mul(F, pow(1 - d, months / 12 + 1)), "one year too many", "Discounted one extra year.", `The term is ${months} months.`),
        ],
        steps: [step("A.effective-discount", "Discount factor for the term.", ["(1-d)^t", Math.pow(1 - d, months / 12), "discount factor"], ["d"]), step("A.discount-factor", "Price.", ["P", ans.v, "price"], ["F"])],
        methods: ["substitution"],
        reasoning: "Multiply the face amount by (1 − d) raised to the term in years.",
        intuition: "A rate of discount is applied to the end value.",
        unknown: ["$P$", "price"],
        relationships: ["$P = F(1-d)^t$"],
        valuationDate: "Time 0",
        principle: "$v = 1 - d$.",
        misread: "Using simple discount.",
        presentation: ["direct"],
        params: { kase, F, months, d },
        route: "discount factor, price",
      });
    }
    const dTrue = gridRate(rng, 0.02, 0.08, 0.0025);
    const P = Math.round(F * Math.pow(1 - dTrue, months / 12) * 100) / 100;
    const ans = sub(1, pow(P / F, 12 / months));
    return std({
      stem: `A note paying ${amt(F)} in ${months} months is bought for ${amt(P)}.\n\nCalculate the annual effective rate of discount.`,
      fmt: PCT3,
      answer: ans,
      model: { eq: (x: X) => sub(mul(F, pow(sub(1, x), months / 12)), P), lo: 0.0001, hi: 0.5 },
      modelDescription: "Price equation with the unknown rate of discount.",
      traps: [
        t("MODEL_COMPOUND_AS_SIMPLE", K(((1 - P / F) * 12) / months), "simple discount", "Used simple discount.", "Effective discount compounds."),
        t("VAR_OTHER_UNKNOWN", sub(pow(F / P, 12 / months), 1), "rate of interest", "Gave the annual effective rate of interest.", "The question asks for discount."),
        t("RATE_ANNUAL_FOR_PERIODIC", mul(12, sub(1, pow(P / F, 1 / months))), "nominal monthly discount", "Gave the nominal rate of discount convertible monthly.", "Give the annual effective rate."),
        t("COMP_PERIODS_AS_YEARS", sub(1, pow(P / F, 1 / months)), "months used as years", "Used the months as years.", `The term is ${months / 12} years.`),
      ],
      steps: [step("A.discount-factor", "Discount factor over the term.", ["P/F", P / F, "discount factor"], ["P", "F"]), step("A.effective-discount", "Annual discount rate.", ["d", ans.v, "annual effective discount"], ["P/F"], { rearranged: true })],
      methods: ["rearrangement"],
      reasoning: "Raise the price ratio to 12/months and subtract from 1.",
      intuition: "Annualise the discount factor, then read off d = 1 − v.",
      unknown: ["$d$", "annual effective discount"],
      relationships: ["$(1-d)^{t} = P/F$"],
      valuationDate: "Time 0",
      principle: "$d = 1 - v$.",
      misread: "Giving the interest rate.",
      presentation: ["unknown-rate"],
      params: { kase, F, P, months },
      route: "ratio, annualise",
    });
  },
};

// ===================================================================== ANN 1: level annuity — value, payment, term

const level: QuestionTemplate = {
  id: "std-ann-level",
  family: "std-ann-level",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.level_payment",
  secondary: ["ANNUITIES.immediate_due"],
  reasoning: ["formula_selection", "cashflow_modelling", "arithmetic"],
  soaConcept: "A level annuity: its present value, the payment for a given value, or the term.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const n = rng.int(5, 25);
    const kase = pick(rng, ["value", "payment", "term"]);
    if (kase === "value") {
      const R = gridAmount(rng, 500, 8000, 100);
      const ans = mul(R, an(i, n));
      return std({
        stem: `${name} will receive ${amt(R)} at the end of each year for ${n} years. At an annual effective rate of ${pct(i)}, calculate the present value of these payments.`,
        fmt: MONEY2,
        answer: ans,
        model: flows(n, (k) => mul(R, vt(i, k + 1))),
        modelDescription: "Each payment discounted.",
        traps: [
          t("TIMING_IMMEDIATE_AS_DUE", mul(R, adue(i, n)), "annuity-due", "Valued as an annuity-due.", "Payments are at the ends of years."),
          t("FORMULA_AV_FOR_PV", mul(R, sn(i, n)), "accumulated value", "Used the accumulated value.", "Present value is at time 0."),
          t("SEQ_UNDISCOUNTED_SUM", K(R * n), "payments added", "Added the payments.", "Discount each payment."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K(R / i), "perpetuity", "Used the perpetuity formula.", `There are ${n} payments.`),
          t("SEQ_TERM_COUNT", mul(R, an(i, n - 1)), "one payment short", `Used ${n - 1} payments.`, `There are ${n} payments.`),
        ],
        steps: [step("B.annuity-immediate", "Annuity factor.", ["a_n", an(i, n).v, "annuity factor"], ["i", "n"]), step("A.equation-of-value", "Present value.", ["PV", ans.v, "present value"], ["R"])],
        methods: ["substitution"],
        reasoning: "Multiply the payment by the annuity-immediate factor.",
        intuition: "End-of-year payments: annuity-immediate.",
        unknown: ["$PV$", "present value"],
        relationships: ["$PV = R\\,a_{\\overline{n|}}$"],
        valuationDate: "Time 0",
        principle: "$a_{\\overline{n|}} = (1 - v^n)/i$.",
        misread: "Using an annuity-due.",
        presentation: ["direct"],
        params: { kase, i, n, R },
        route: "annuity factor, value",
      });
    }
    if (kase === "payment") {
      const PV = gridAmount(rng, 10000, 200000, 1000);
      const ans = div(PV, adue(i, n));
      return std({
        stem: `${name} buys an annuity for ${amt(PV)} that pays a level amount at the beginning of each year for ${n} years, the first payment today. At an annual effective rate of ${pct(i)}, calculate the annual payment.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(flows(n, (k) => mul(x, vt(i, k))), PV), lo: 1, hi: PV },
        modelDescription: "Each payment discounted from its date, equated to the price.",
        traps: [
          t("TIMING_DUE_AS_IMMEDIATE", div(PV, an(i, n)), "annuity-immediate", "Used an annuity-immediate.", "The first payment is today."),
          t("SEQ_UNDISCOUNTED_SUM", K(PV / n), "price divided by the term", `Divided by ${n}.`, "Payments are discounted."),
          t("FORMULA_AV_FOR_PV", div(PV, mul(sn(i, n), 1 + i)), "accumulated factor", "Divided by the accumulated factor.", "Use the present-value factor."),
          t("FORMULA_PERPETUITY_FOR_FINITE", K((PV * i) / (1 + i)), "perpetuity-due", "Used a perpetuity-due.", `Payments stop after ${n} years.`),
        ],
        steps: [step("B.annuity-due", "Annuity-due factor.", ["\\ddot a_n", adue(i, n).v, "annuity-due factor"], ["i", "n"]), step("A.equation-of-value", "Payment.", ["R", ans.v, "annual payment"], ["PV"], { rearranged: true })],
        methods: ["rearrangement"],
        reasoning: "Divide the price by the annuity-due factor.",
        intuition: "Payments start today: annuity-due.",
        unknown: ["$R$", "annual payment"],
        relationships: ["$PV = R\\,\\ddot a_{\\overline{n|}}$"],
        valuationDate: "Time 0",
        principle: "$\\ddot a = (1+i)a$.",
        misread: "Using an annuity-immediate.",
        presentation: ["inverse"],
        params: { kase, i, n, PV },
        route: "due factor, payment",
      });
    }
    const R = gridAmount(rng, 1000, 8000, 100);
    const PV = Math.round(R * an(i, n).v * (0.97 + rng.next() * 0.02) * 100) / 100;
    const term = (o: { due?: boolean; force?: boolean; sign?: number } = {}) => {
      const x = o.due ? PV / (R * (1 + i)) : PV / R;
      return div(mul(-1, ln(1 + (o.sign ?? -1) * x * i)), o.force ? i : ln(1 + i));
    };
    const ans = term();
    return std({
      stem: `A fund of ${amt(PV)} earning an annual effective rate of ${pct(i)} pays ${amt(R)} at the end of each year. Ignoring any final partial payment, calculate the exact (fractional) number of years $n$ for which $R\\,a_{\\overline{n|}}$ equals the fund.`,
      fmt: YEARS2,
      answer: ans,
      model: { eq: (x: X) => sub(mul(R, div(sub(1, pow(1 + i, mul(-1, x))), i)), PV), lo: 0.5, hi: 200 },
      modelDescription: "The annuity factor as a function of n equated to fund/payment.",
      traps: [
        t("TIMING_IMMEDIATE_AS_DUE", term({ due: true }), "annuity-due", "Solved with an annuity-due.", "Payments are at the ends of years."),
        t("SEQ_UNDISCOUNTED_SUM", K(PV / R), "fund divided by payment", "Divided the fund by the payment.", "Interest makes the fund last longer."),
        t("RATE_FORCE_AS_EFFECTIVE", term({ force: true }), "divided by i", "Divided by i instead of ln(1 + i).", "Solve $v^n = 1 - PV\\,i/R$ with logarithms."),
        t("ALG_SIGN_ERROR", div(ln(1 + (PV * i) / R), ln(1 + i)), "sign slip", "Used $\\ln(1 + PV\\,i/R)$.", "$v^n = 1 - PV\\,i/R$."),
      ],
      steps: [step("B.annuity-immediate", "Annuity factor needed.", ["a_n", PV / R, "annuity factor needed"], ["PV", "R"], { rearranged: true }), step("M.logarithm", "Solve for n.", ["n", ans.v, "term"], ["a_n"], { rearranged: true })],
      methods: ["logarithms", "rearrangement"],
      reasoning: "Set a(n) = PV/R, so v^n = 1 − i·PV/R, and take logarithms.",
      intuition: "The term is in the exponent: logarithms.",
      unknown: ["$n$", "term"],
      relationships: ["$v^n = 1 - i\\,PV/R$"],
      valuationDate: "Time 0",
      principle: "An unknown term is found with logarithms.",
      misread: "Dividing the fund by the payment.",
      presentation: ["unknown-time"],
      params: { kase, i, R, PV },
      route: "factor, logarithm",
    });
  },
};

// ===================================================================== ANN 2: perpetuities

const perp: QuestionTemplate = {
  id: "std-ann-perpetuity",
  family: "std-ann-perpetuity",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.perpetuities",
  secondary: ["ANNUITIES.geometric", "ANNUITIES.frequency_timing"],
  reasoning: ["formula_selection", "valuation_dates", "arithmetic"],
  soaConcept: "Perpetuities: deferred, growing, and payable every k years.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.04, 0.09, 0.0025);
    const R = gridAmount(rng, 500, 5000, 100);
    const kase = pick(rng, ["deferred", "growing", "every-k"]);
    if (kase === "deferred") {
      const k = rng.int(2, 10);
      const ans = mul(div(R, i), vt(i, k));
      return std({
        stem: `A scholarship fund will pay ${amt(R)} at the end of each year forever, the first payment at the end of year ${k + 1}. At an annual effective rate of ${pct(i)}, calculate the amount ${name} must donate today to fund it.`,
        fmt: MONEY2,
        answer: ans,
        model: mul(R, div(pow(1 + i, -(k + 1)), sub(1, pow(1 + i, -1)))),
        modelDescription: "Geometric series of discounted payments starting at year k + 1.",
        traps: [
          t("TIMING_DEFERRAL_OFF_BY_ONE", mul(div(R, i), vt(i, k + 1)), "deferred a year too long", `Deferred ${k + 1} years.`, `The perpetuity value sits at time ${k}.`),
          t("CONC_ANN_PERP_VALUE_DATE", mul(div(R, i), vt(i, k - 1)), "deferred a year too few", `Deferred ${k - 1} years.`, `Defer ${k} years.`),
          t("TIMING_IGNORED_DEFERRAL", K(R / i), "not deferred", "Did not defer.", `Payments start at year ${k + 1}.`),
          t("FORMULA_AV_FOR_PV", mul(div(R, i), at(i, k)), "accumulated instead of discounted", `Multiplied by $(1+i)^{${k}}$.`, "Move the value back to today: discount."),
        ],
        steps: [step("B.perpetuity", `Perpetuity valued at time ${k}.`, ["R/i", R / i, `value at time ${k}`], ["R", "i"]), step("B.deferred", "Discount to today.", ["PV", ans.v, "donation"], ["i"])],
        methods: ["valuation_dates"],
        reasoning: `R/i is the value one year before the first payment (time ${k}); discount ${k} years.`,
        intuition: "A perpetuity-immediate formula lands one period before the first payment.",
        unknown: ["$PV$", "donation"],
        relationships: [`$PV = \\dfrac{R}{i}v^{${k}}$`],
        valuationDate: "Time 0",
        principle: "Deferred perpetuity = perpetuity value × deferral factor.",
        misread: "Deferring by the time of the first payment.",
        presentation: ["deferred", "valuation-date"],
        params: { kase, i, R, k },
        route: "perpetuity, defer",
      });
    }
    if (kase === "growing") {
      const g = pick(rng, [0.01, 0.015, 0.02, 0.025, 0.03]);
      const ans = div(R, i - g);
      return std({
        stem: `A stock is expected to pay a dividend of ${amt(R)} one year from now, with later dividends growing at ${pc(g, 1)} per year forever. ${name} values it at an annual effective rate of ${pct(i)}. Calculate the value.`,
        fmt: MONEY2,
        answer: ans,
        model: div(R, sub(1 + i, 1 + g)),
        modelDescription: "Geometric series R Σ (1+g)^k v^{k+1}.",
        traps: [
          t("CONC_ANN_FIRST_PAYMENT_GROWTH", div(R * (1 + g), i - g), "first dividend grown", "Grew the first dividend.", `The first dividend is ${amt(R)}.`),
          t("MODEL_LEVEL_FOR_VARYING", K(R / i), "level perpetuity", "Ignored growth.", "Dividends grow."),
          t("SEQ_GROWTH_RATE_DIFFERENCE", div(R, i + g), "growth added to the rate", "Divided by i + g.", "Growth reduces the effective discount: divide by i − g."),
          t("TIMING_IMMEDIATE_AS_DUE", div(R * (1 + i), i - g), "first dividend today", "Treated the first dividend as paid today.", "It is paid in one year."),
        ],
        steps: [step("B.geometric-perpetuity", "Growing perpetuity.", ["PV", ans.v, "value"], ["R", "g", "i"])],
        methods: ["geometric_series"],
        reasoning: "Value = first payment / (i − g).",
        intuition: "Growth offsets part of the discounting.",
        unknown: ["$PV$", "value"],
        relationships: ["$PV = \\dfrac{R}{i - g}$"],
        valuationDate: "Time 0",
        principle: "A growing perpetuity-immediate is $R/(i-g)$.",
        misread: "Growing the first payment.",
        presentation: ["direct"],
        params: { kase, i, R, g },
        route: "growing perpetuity",
      });
    }
    const k = pick(rng, [2, 3, 4, 5]);
    const j = sub(pow(1 + i, k), 1);
    const ans = div(R, j);
    return std({
      stem: `A perpetuity pays ${amt(R)} every ${k} years, the first payment ${k} years from now. At an annual effective rate of ${pct(i)}, calculate its present value.`,
      fmt: MONEY2,
      answer: ans,
      model: div(mul(R, pow(1 + i, -k)), sub(1, pow(1 + i, -k))),
      modelDescription: "Geometric series of payments every k years.",
      traps: [
        t("CONC_ANN_KYEAR_DIVISOR", K(R / (k * i)), "k times the annual rate", `Used ${k}i as the ${k}-year rate.`, `Use $(1+i)^{${k}} - 1$.`),
        t("MODEL_LEVEL_FOR_VARYING", K(R / i), "annual perpetuity", "Valued as an annual perpetuity.", `Payments are every ${k} years.`),
        t("TIMING_IMMEDIATE_AS_DUE", div(mul(R, pow(1 + i, k)), j), "first payment today", "Started the payments today.", `The first payment is at time ${k}.`),
        t("TIMING_DEFERRAL_OFF_BY_ONE", div(mul(R, pow(1 + i, k - 1)), j), "first payment at year 1", "Placed the first payment at year 1.", `The first payment is at time ${k}.`),
      ],
      steps: [step("B.fission", `Rate per ${k}-year period.`, ["j", j.v, `${k}-year rate`], ["i"]), step("B.perpetuity", "Perpetuity at that rate.", ["PV", ans.v, "present value"], ["R", "j"])],
      methods: ["substitution"],
      reasoning: `Convert to the ${k}-year rate and use R/j.`,
      intuition: "Count in k-year periods.",
      unknown: ["$PV$", "present value"],
      relationships: ["$PV = R/((1+i)^k - 1)$"],
      valuationDate: "Time 0",
      principle: "Payments every k years: use the k-year effective rate.",
      misread: "Using k·i as the k-year rate.",
      presentation: ["frequency"],
      params: { kase, i, R, k },
      route: "k-year rate, perpetuity",
    });
  },
};

// ===================================================================== ANN 3: accumulation

const accumulate: QuestionTemplate = {
  id: "std-ann-accumulate",
  family: "std-ann-accumulate",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.immediate_due",
  secondary: ["ANNUITIES.level_payment", "ANNUITIES.frequency_timing"],
  reasoning: ["formula_selection", "valuation_dates", "arithmetic"],
  soaConcept: "Accumulated values of level deposits: annual in advance, the deposit for a target, and monthly deposits at a nominal rate.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const n = rng.int(5, 25);
    const kase = pick(rng, ["due", "deposit", "monthly"]);
    if (kase === "due") {
      const i = gridRate(rng, 0.03, 0.09, 0.0025);
      const R = gridAmount(rng, 500, 8000, 100);
      const ans = mul(R, sn(i, n), 1 + i);
      return std({
        stem: `${name} deposits ${amt(R)} at the beginning of each year for ${n} years into a fund earning an annual effective rate of ${pct(i)}. Calculate the fund value at the end of year ${n}.`,
        fmt: MONEY2,
        answer: ans,
        model: flows(n, (k) => mul(R, at(i, n - k))),
        modelDescription: "Each deposit accumulated to year n.",
        traps: [
          t("TIMING_DUE_AS_IMMEDIATE", mul(R, sn(i, n)), "deposits at year ends", "Used an annuity-immediate.", "Deposits are at the beginning of each year."),
          t("FORMULA_AV_FOR_PV", mul(R, adue(i, n)), "present value", "Gave the present value.", `Value at year ${n}.`),
          t("SEQ_UNDISCOUNTED_SUM", K(R * n), "deposits added", "Added the deposits.", "Deposits earn interest."),
          t("TIMING_EXTRA_PERIOD", mul(R, sn(i, n), (1 + i) ** 2), "one year too many", "Accumulated one extra year.", `Value at the end of year ${n}.`),
        ],
        steps: [step("B.annuity-due-av", "Accumulated annuity-due factor.", ["\\ddot s_n", sn(i, n).v * (1 + i), "accumulation factor"], ["i"]), step("A.equation-of-value", "Fund value.", ["AV", ans.v, "fund value"], ["R"])],
        methods: ["substitution"],
        reasoning: "Multiply the deposit by the accumulated annuity-due factor.",
        intuition: "Each deposit gets one more year of interest than in an annuity-immediate.",
        unknown: ["$AV$", "fund value"],
        relationships: ["$AV = R\\,\\ddot s_{\\overline{n|}}$"],
        valuationDate: `Year ${n}`,
        principle: "$\\ddot s = (1+i)s$.",
        misread: "Using an annuity-immediate.",
        presentation: ["valuation-date"],
        params: { kase, i, R, n },
        route: "due accumulation, value",
      });
    }
    if (kase === "deposit") {
      const i = gridRate(rng, 0.03, 0.09, 0.0025);
      const T = gridAmount(rng, 20000, 300000, 1000);
      const ans = div(T, sn(i, n));
      return std({
        stem: `${name} wants ${amt(T)} at the end of ${n} years and will make equal deposits at the end of each year into an account earning an annual effective rate of ${pct(i)}. Calculate the deposit.`,
        fmt: MONEY2,
        answer: ans,
        model: { eq: (x: X) => sub(flows(n, (k) => mul(x, at(i, n - k - 1))), T), lo: 1, hi: T },
        modelDescription: "Deposits accumulated one by one, equated to the target.",
        traps: [
          t("TIMING_IMMEDIATE_AS_DUE", div(T, mul(sn(i, n), 1 + i)), "deposits at year starts", "Used an annuity-due.", "Deposits are at the ends of years."),
          t("SEQ_UNDISCOUNTED_SUM", K(T / n), "target divided by term", `Divided by ${n}.`, "Deposits earn interest."),
          t("FORMULA_AV_FOR_PV", div(T, an(i, n)), "present-value factor", "Divided by $a_{\\overline{n|}}$.", "Use $s_{\\overline{n|}}$."),
          t("SEQ_TERM_COUNT", div(T, sn(i, n - 1)), "one deposit short", `Used ${n - 1} deposits.`, `There are ${n} deposits.`),
        ],
        steps: [step("B.annuity-immediate-av", "Accumulation factor.", ["s_n", sn(i, n).v, "accumulation factor"], ["i"]), step("A.equation-of-value", "Deposit.", ["R", ans.v, "deposit"], ["T"], { rearranged: true })],
        methods: ["rearrangement"],
        reasoning: "Divide the target by s(n).",
        intuition: "Work backwards from the target.",
        unknown: ["$R$", "deposit"],
        relationships: ["$R\\,s_{\\overline{n|}} = T$"],
        valuationDate: `Year ${n}`,
        principle: "Accumulated values solve for the payment like present values do.",
        misread: "Using an annuity-due.",
        presentation: ["inverse"],
        params: { kase, i, T, n },
        route: "accumulation factor, deposit",
      });
    }
    const i12 = gridRate(rng, 0.04, 0.1, 0.0025);
    const M = gridAmount(rng, 100, 1500, 25);
    const r = i12 / 12;
    const ans = mul(M, sn(r, 12 * n));
    return std({
      stem: `${name} deposits ${amt(M)} at the end of each month for ${n} years into an account crediting a nominal annual rate of ${pct(i12)} convertible monthly. Calculate the account value at the end of ${n} years.`,
      fmt: MONEY2,
      answer: ans,
      model: mul(M, div(sub(exp(mul(12 * n, ln(1 + r))), 1), r)),
      modelDescription: "Monthly accumulation written through logarithms.",
      traps: [
        t("RATE_NOMINAL_AS_EFFECTIVE", mul(M, sn(sub(pow(1 + i12, 1 / 12), 1), 12 * n)), "nominal rate used as effective", `Used ${pct(i12)} as annual effective.`, `The monthly rate is ${pct(i12)}/12.`),
        t("COMP_PERIODS_AS_YEARS", mul(M, sn(r, n)), "years used as months", `Used ${n} periods.`, `There are ${12 * n} months.`),
        t("CONC_ANN_MTHLY_PAYMENT_SIZE", mul(12 * M, sn(Math.pow(1 + r, 12) - 1, n)), "year's deposits lumped at year end", "Treated each year's deposits as one year-end deposit.", "Deposits earn interest during the year."),
        t("SEQ_UNDISCOUNTED_SUM", K(12 * n * M), "deposits added", "Added the deposits.", "Deposits earn interest."),
        t("FORMULA_AV_FOR_PV", mul(M, an(r, 12 * n)), "present value", "Gave the present value.", `Value at the end of ${n} years.`),
      ],
      steps: [step("A.nominal-equivalence", "Monthly rate.", ["i/12", r, "monthly rate"], ["i^(12)"]), step("B.annuity-immediate-av", "Accumulate monthly deposits.", ["AV", ans.v, "account value"], ["M", "i/12"])],
      methods: ["substitution"],
      reasoning: "Work in months: rate i^(12)/12 for 12n deposits.",
      intuition: "Match the payment period and the rate period.",
      unknown: ["$AV$", "account value"],
      relationships: ["$AV = M\\,s_{\\overline{12n|}\\,i^{(12)}/12}$"],
      valuationDate: `Year ${n}`,
      principle: "Use the rate per payment period.",
      misread: "Using the nominal rate as effective.",
      presentation: ["frequency"],
      params: { kase, i12, M, n },
      route: "monthly rate, accumulate",
    });
  },
};

// ===================================================================== ANN 4: varying annuities

const varying: QuestionTemplate = {
  id: "std-ann-varying",
  family: "std-ann-varying",
  topic: "ANNUITIES",
  levels: [1],
  objective: "ANNUITIES.arithmetic",
  secondary: ["ANNUITIES.geometric"],
  reasoning: ["formula_selection", "cashflow_modelling", "arithmetic"],
  soaConcept: "Increasing, decreasing and geometric annuities-immediate.",
  generate(rng): QuestionDraft {
    const name = nameOf(rng);
    const i = gridRate(rng, 0.03, 0.09, 0.0025);
    const n = rng.int(5, 20);
    const P = gridAmount(rng, 100, 2000, 50);
    const kase = pick(rng, ["increasing", "decreasing", "geometric"]);
    if (kase === "increasing") {
      const ans = mul(P, ia(i, n));
      return std({
        stem: `${name} will receive ${amt(P)} at the end of year 1, ${amt(2 * P)} at the end of year 2, and so on, increasing by ${amt(P)} each year to ${amt(n * P)} at the end of year ${n}. At an annual effective rate of ${pct(i)}, calculate the present value.`,
        fmt: MONEY2,
        answer: ans,
        model: flows(n, (k) => mul(P * (k + 1), vt(i, k + 1))),
        modelDescription: "Each payment discounted.",
        traps: [
          t("FORMULA_DECREASING_FOR_INCREASING", mul(P, da(i, n)), "decreasing factor", "Used (Da).", "Payments increase."),
          t("MODEL_LEVEL_FOR_VARYING", mul(P * ((n + 1) / 2), an(i, n)), "average payment", "Used the average payment.", "Larger payments come later."),
          t("ALG_SIGN_ERROR", mul(P, div(add(adue(i, n), mul(n, vt(i, n))), i)), "sign slip", "Added $nv^n$.", "$(Ia) = (\\ddot a - nv^n)/i$."),
          t("TIMING_IMMEDIATE_AS_DUE", mul(P, ia(i, n), 1 + i), "annuity-due", "Valued as payments at year starts.", "Payments are at year ends."),
          t("SEQ_UNDISCOUNTED_SUM", K((P * n * (n + 1)) / 2), "payments added", "Added the payments.", "Discount them."),
        ],
        steps: [step("B.annuity-due", "Annuity-due factor.", ["\\ddot a_n", adue(i, n).v, "annuity-due factor"], ["i"]), step("B.increasing", "Increasing annuity.", ["PV", ans.v, "present value"], ["P"])],
        methods: ["arithmetic_series"],
        reasoning: "PV = P(Ia), with (Ia) = (ä − nv^n)/i.",
        intuition: "Increasing payments: the (Ia) factor.",
        unknown: ["$PV$", "present value"],
        relationships: ["$(Ia)_{\\overline{n|}} = \\dfrac{\\ddot a_{\\overline{n|}} - nv^n}{i}$"],
        valuationDate: "Time 0",
        principle: "Arithmetic payments use (Ia) and (Da).",
        misread: "Using (Da).",
        presentation: ["direct"],
        params: { kase, i, n, P },
        route: "due factor, increasing",
      });
    }
    if (kase === "decreasing") {
      const ans = mul(P, da(i, n));
      return std({
        stem: `${name} will receive ${amt(n * P)} at the end of year 1, ${amt((n - 1) * P)} at the end of year 2, and so on, decreasing by ${amt(P)} each year to ${amt(P)} at the end of year ${n}. At an annual effective rate of ${pct(i)}, calculate the present value.`,
        fmt: MONEY2,
        answer: ans,
        model: flows(n, (k) => mul(P * (n - k), vt(i, k + 1))),
        modelDescription: "Each payment discounted.",
        traps: [
          t("FORMULA_DECREASING_FOR_INCREASING", mul(P, ia(i, n)), "increasing factor", "Used (Ia).", "Payments decrease."),
          t("MODEL_LEVEL_FOR_VARYING", mul(P * ((n + 1) / 2), an(i, n)), "average payment", "Used the average payment.", "Larger payments come first."),
          t("ALG_SIGN_ERROR", mul(P, div(add(n, an(i, n)), i)), "sign slip", "Used (n + a)/i.", "$(Da) = (n - a)/i$."),
          t("TIMING_IMMEDIATE_AS_DUE", mul(P, da(i, n), 1 + i), "annuity-due", "Valued as payments at year starts.", "Payments are at year ends."),
        ],
        steps: [step("B.annuity-immediate", "Annuity factor.", ["a_n", an(i, n).v, "annuity factor"], ["i"]), step("B.decreasing", "Decreasing annuity.", ["PV", ans.v, "present value"], ["P"])],
        methods: ["arithmetic_series"],
        reasoning: "PV = P(Da), with (Da) = (n − a)/i.",
        intuition: "Decreasing payments: the (Da) factor.",
        unknown: ["$PV$", "present value"],
        relationships: ["$(Da)_{\\overline{n|}} = \\dfrac{n - a_{\\overline{n|}}}{i}$"],
        valuationDate: "Time 0",
        principle: "$(Ia) + (Da) = (n+1)a$.",
        misread: "Using (Ia).",
        presentation: ["direct"],
        params: { kase, i, n, P },
        route: "annuity factor, decreasing",
      });
    }
    const g = pick(rng, [0.02, 0.03, 0.04, 0.05].filter((x) => Math.abs(x - i) > 0.004));
    const ans = mul(P, geoA(i, g, n));
    return std({
      stem: `${name} will receive ${amt(P)} at the end of year 1, with each later payment ${pc(g, 0)} larger than the one before, for ${n} payments in all. At an annual effective rate of ${pct(i)}, calculate the present value.`,
      fmt: MONEY2,
      answer: ans,
      model: flows(n, (k) => mul(P * Math.pow(1 + g, k), vt(i, k + 1))),
      modelDescription: "Each payment discounted.",
      traps: [
        t("SEQ_GEOMETRIC_AS_ARITHMETIC", flows(n, (k) => mul(P * (1 + g * k), vt(i, k + 1))), "growth treated as arithmetic", `Increased by ${pc(g, 0)} of the first payment each year.`, "Each payment is the previous one times (1 + g)."),
        t("CONC_ANN_FIRST_PAYMENT_GROWTH", mul(P * (1 + g), geoA(i, g, n)), "first payment grown", "Grew the first payment.", `The first payment is ${amt(P)}.`),
        t("MODEL_LEVEL_FOR_VARYING", mul(P, an(i, n)), "level payments", "Ignored growth.", "Payments grow."),
        t("TIMING_IMMEDIATE_AS_DUE", mul(P, geoA(i, g, n), 1 + i), "annuity-due", "Valued as payments at year starts.", "Payments are at year ends."),
        t("FORMULA_AV_FOR_PV", mul(P, geoA(i, g, n), at(i, n)), "accumulated value", "Gave the accumulated value.", "Present value is at time 0."),
      ],
      steps: [step("B.geometric-annuity", "Geometric annuity.", ["PV", ans.v, "present value"], ["P", "g", "i"])],
      methods: ["geometric_series"],
      reasoning: "PV = P(1 − ((1+g)/(1+i))^n)/(i − g).",
      intuition: "Growth at g, discounting at i: the ratio (1+g)/(1+i) drives the sum.",
      unknown: ["$PV$", "present value"],
      relationships: ["$PV = P\\dfrac{1 - ((1+g)/(1+i))^n}{i - g}$"],
      valuationDate: "Time 0",
      principle: "Geometric annuities sum a geometric series.",
      misread: "Treating the growth as arithmetic.",
      presentation: ["direct"],
      params: { kase, i, n, P, g },
      route: "geometric annuity",
    });
  },
};

export const STANDARD_TVM_ANNUITY_TEMPLATES: QuestionTemplate[] = [accum, eqValue, discount, level, perp, accumulate, varying];
