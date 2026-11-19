import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings specific to the time value of money (Concept Practice). */
export const TVM_CONCEPT_MISCONCEPTIONS = {
  CONC_TVM_SIMPLE_CONSTANT_RATE: entry(
    "CONCEPTUAL",
    "Simple interest taken to earn a constant effective rate",
    "Under simple interest the effective rate earned in each year was taken to equal the simple rate, although the same interest is spread over a growing balance.",
    ["concept_recognition", "financial_intuition"],
    "Under simple interest the amount of interest per year is constant, so the rate per unit of balance must fall.",
    "Simple interest at rate i: i_k = i / (1 + i(k − 1)), which decreases with k."
  ),
  CONC_TVM_COMPOUND_ALWAYS_LARGER: entry(
    "CONCEPTUAL",
    "Compound interest assumed larger at every term",
    "Compound interest at a rate was taken to accumulate more than simple interest at the same rate for every term, including terms shorter than one period.",
    ["concept_recognition", "financial_intuition"],
    "Compare 1 + it with (1 + i)^t on both sides of t = 1.",
    "For 0 < t < 1, 1 + it > (1 + i)^t; they agree at t = 1; compound is larger for t > 1."
  ),
  CONC_TVM_CLOCK_RESTART: entry(
    "TIMING",
    "Time-dependent accumulation restarted at the valuation date",
    "An accumulation function that depends on calendar time (simple interest measured from time 0, or a varying force) was applied as if it began afresh at the start of the interval.",
    ["valuation_dates", "concept_recognition"],
    "If a(t) or δ_t depends on t itself, the factor from t₁ to t₂ is a(t₂)/a(t₁) or exp(∫ δ over [t₁, t₂]), not a function of t₂ − t₁ alone.",
    "a(t₁, t₂) = a(t₂)/a(t₁) = exp(∫_{t₁}^{t₂} δ_s ds); it equals a(t₂ − t₁) only for compound interest at a constant rate."
  ),
  CONC_TVM_AMOUNT_FOR_ACCUM: entry(
    "VARIABLE_INTERPRETATION",
    "Amount function taken for the accumulation function",
    "A function with a(0) ≠ 1 was accepted as an accumulation function, or an amount function was used where the accumulation of a single unit was needed.",
    ["concept_recognition", "translation"],
    "An accumulation function always starts at a(0) = 1; an amount function is A(t) = A(0)·a(t).",
    "a(0) = 1, a(t) non-decreasing when interest is non-negative; A(t) = k·a(t)."
  ),
  CONC_TVM_ONLY_EXPONENTIAL: entry(
    "CONCEPTUAL",
    "Only (1 + i)^t accepted as an accumulation function",
    "A valid accumulation function was rejected because it is not of the compound form (1 + i)^t.",
    ["concept_recognition"],
    "Check the defining properties (a(0) = 1, increasing) rather than the algebraic form.",
    "Any function with a(0) = 1 that never decreases can describe an investment that never loses value."
  ),
  CONC_TVM_WRONG_INTERVAL: entry(
    "VARIABLE_INTERPRETATION",
    "Rate measured over the wrong interval",
    "A rate over a cumulative interval (from time 0) was taken for the rate of a single period, or the reverse.",
    ["translation", "concept_recognition"],
    "Name the interval a rate refers to: “during year n” means from n − 1 to n.",
    "i_n = A(n)/A(n − 1) − 1 refers to year n only; A(n)/A(0) − 1 is the cumulative rate."
  ),
  CONC_TVM_AVERAGE_RATE: entry(
    "CONCEPTUAL",
    "Average rate used in place of the period's rate",
    "An average over several periods (or an arithmetic average of changing rates) was used where the rate of one particular period, or the exact product of factors, was needed.",
    ["concept_recognition", "financial_intuition"],
    "When rates change over time, multiply the factors period by period; an average reproduces only the total, and only if weighted correctly.",
    "Accumulation across periods = product of the period factors; a period's rate comes from that period alone."
  ),
  CONC_TVM_PAST_PAYMENT_EXCLUDED: entry(
    "TIMING",
    "Current value taken to exclude past payments",
    "The value at an intermediate date was taken to include only the payments still to come, leaving out those already made.",
    ["valuation_dates", "cashflow_modelling"],
    "The value at time t of a set of payments includes every payment: earlier ones accumulated to t, later ones discounted to t.",
    "Value at t = Σ CF_s (1 + i)^(t − s) over all s."
  ),
  CONC_TVM_EQUIV_DATE_DEPENDS: entry(
    "CONCEPTUAL",
    "Equivalence thought to depend on the comparison date",
    "Under compound interest at a fixed rate, two sets of payments with equal values at one date were thought to have different values at another date.",
    ["valuation_dates", "concept_recognition"],
    "Moving both sides from one date to another multiplies them by the same factor (1 + i)^k.",
    "At a fixed compound rate, equal values at one date imply equal values at every date."
  ),
  CONC_TVM_EQUIV_RATE_FREE: entry(
    "CONCEPTUAL",
    "Equivalence at one rate taken to hold at every rate",
    "Two sets of payments equivalent at one interest rate were taken to be equivalent at every rate.",
    ["concept_recognition", "financial_intuition"],
    "Change the rate and ask which set's payments are later: later payments lose more value as the rate rises.",
    "Equivalence is a statement about one rate; different timing makes the comparison change with the rate."
  ),
  CONC_TVM_LINEAR_IN_RATE: entry(
    "CONCEPTUAL",
    "Present value taken as proportional to the rate",
    "The present value was assumed to scale in proportion (or inverse proportion) to the interest rate.",
    ["financial_intuition"],
    "Present value depends on the rate through (1 + i)^(−t), which is not proportional to 1/i.",
    "PV = CF·(1 + i)^(−t); doubling i does not halve the PV."
  ),
  CONC_TVM_PERIODIC_AS_NOMINAL: entry(
    "RATE_CONVERSION",
    "Periodic rate confused with the nominal annual rate",
    "The rate per m-th of a year was reported as the nominal annual rate, or the nominal annual rate was applied per m-th of a year without dividing by m.",
    ["formula_retrieval", "concept_recognition"],
    "A nominal annual rate convertible m-thly is m times the effective rate per m-th of a year.",
    "i^(m) = m·j, where j is the effective rate per 1/m year; likewise d^(m) = m·(discount per 1/m year)."
  ),
  CONC_TVM_FREQUENCY_MISMATCH: entry(
    "RATE_CONVERSION",
    "Conversion frequency not matched to the period required",
    "A rate was converted for one frequency and then used for a different payment or conversion frequency.",
    ["formula_retrieval", "cashflow_modelling"],
    "Write down the length of the period you need, then find the effective rate for exactly that period from the annual effective rate.",
    "Effective rate per period of length h years: (1 + i)^h − 1."
  ),
  CONC_TVM_DISCOUNT_FREQUENCY_DIRECTION: entry(
    "CONCEPTUAL",
    "Nominal discount rate thought to fall as conversion frequency rises",
    "d^(m) was taken to decrease with m, by analogy with i^(m), although it increases toward δ.",
    ["concept_recognition", "financial_intuition"],
    "Both i^(m) and d^(m) move toward δ as m grows; d^(m) starts below δ, so it rises.",
    "d < d^(m) < δ < i^(m) < i, with d^(m) increasing and i^(m) decreasing in m."
  ),
  CONC_TVM_DERIVATIVE_AS_FORCE: entry(
    "VARIABLE_INTERPRETATION",
    "Rate of change of the fund taken as the force of interest",
    "The derivative A′(t), an amount per year, was read as the force of interest, which is that derivative per unit of the fund.",
    ["concept_recognition", "translation"],
    "A force of interest is a rate: it is dimensionless per year, so it must be divided by the fund size.",
    "δ_t = A′(t)/A(t) = d/dt ln A(t)."
  ),
  CONC_TVM_FORCE_AS_DISCOUNT: entry(
    "RATE_CONVERSION",
    "Force of interest used as a discount rate",
    "A force of interest δ was used as if it were an effective rate of discount, discounting with (1 − δ)^t.",
    ["formula_retrieval", "concept_recognition"],
    "Under a constant force, the discount factor is e^(−δt); 1 − d = e^(−δ), so d = 1 − e^(−δ) < δ.",
    "v^t = e^(−δt)."
  ),
  CONC_TVM_REAL_AS_MONEY_GROWTH: entry(
    "CONCEPTUAL",
    "Real rate read as growth in money terms",
    "The real rate was interpreted as the growth of the investment's money amount rather than of its purchasing power.",
    ["concept_recognition", "financial_intuition"],
    "Money amounts grow at the nominal rate; the real rate measures what those amounts buy.",
    "Money value grows by (1 + i); purchasing power by (1 + i)/(1 + r)."
  ),
  CONC_TVM_INFLATION_TWICE: entry(
    "CONCEPTUAL",
    "Inflation allowed for twice",
    "An adjustment for inflation was applied to amounts and again through the discount rate, so inflation was counted twice.",
    ["concept_recognition", "cashflow_modelling"],
    "Use either inflated (money) amounts with the nominal rate, or today's-money amounts with the real rate — never both adjustments together.",
    "PV of an indexed payment X (today's money) at n: X(1 + r)^n (1 + i)^(−n) = X(1 + j)^(−n)."
  ),
  CONC_TVM_INDEXATION_ASSUMED: entry(
    "CONCEPTUAL",
    "Fixed payment treated as inflation-indexed",
    "A payment fixed in money terms was increased with inflation before it was discounted.",
    ["concept_recognition", "translation"],
    "Only payments described as rising with prices are inflated; a stated money amount is paid as stated.",
    "Fixed money payment: PV = X(1 + i)^(−n)."
  ),
  CONC_TVM_RATE_CHANGE_RETRO: entry(
    "TIMING",
    "Rate change applied retroactively",
    "A rate that applies only from a given date was applied to the whole period, including the time before the change.",
    ["valuation_dates", "cashflow_modelling"],
    "Split the timeline at the date the rate changes and use each rate only on its own interval.",
    "Accumulation across a rate change: (1 + i₁)^k (1 + i₂)^(t − k)."
  ),
  CONC_TVM_FORCE_NOT_INTEGRATED: entry(
    "INCORRECT_FORMULA",
    "Force at one time used in place of its integral",
    "The value of the force at a single time was put in the exponent as if it were the integral of the force over the interval.",
    ["formula_selection", "formula_reconstruction"],
    "The exponent of an accumulation factor is an area under δ_t, which grows with the length of the interval.",
    "a(t₁, t₂) = exp(∫_{t₁}^{t₂} δ_s ds)."
  ),
  CONC_TVM_RATE_LOCKED_AT_DEPOSIT: entry(
    "INCORRECT_MODEL",
    "Rate locked in at the date of deposit",
    "Each deposit was assumed to keep earning the rate in force when it was made, although the fund credits one rate to every balance at each time.",
    ["concept_recognition", "cashflow_modelling"],
    "Read whether the rate is a property of the fund over time (all money earns it) or of each deposit.",
    "When a fund credits i₁ before time k and i₂ after, every amount on deposit after k earns i₂."
  ),
} as const satisfies Record<string, Misconception>;
