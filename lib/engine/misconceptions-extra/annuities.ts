import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings specific to annuities and non-contingent cash flows (Concept Practice). */
export const ANNUITY_CONCEPT_MISCONCEPTIONS = {
  CONC_ANN_PERP_VALUE_DATE: entry(
    "TIMING",
    "Perpetuity value placed at the first payment date",
    "The value $P/i$ of a perpetuity-immediate (or $P/(i-g)$ of a growing one) was taken as its value on the date of the first payment rather than one period before it.",
    ["valuation_dates", "cashflow_modelling"],
    "Ask where the factor leaves its value: every “immediate” factor values the stream one period before the first payment.",
    "$a_{\\overline{\\infty}|} = 1/i$ values payments at times $1, 2, \\ldots$ at time 0; a stream starting at time $k$ is worth $v^{k-1}/i$."
  ),
  CONC_ANN_PERP_INFINITE: entry(
    "CONCEPTUAL",
    "Perpetuity taken to have no finite value",
    "An endless stream of level (or slowly growing) payments was judged to be worth an unlimited amount because the payments never stop.",
    ["concept_recognition", "financial_intuition"],
    "Look at the discounted payments, not the payments: if they shrink geometrically, their sum is finite.",
    "A perpetuity of $P$ is worth $P/i$: the amount whose interest each period exactly pays $P$."
  ),
  CONC_ANN_GROWTH_AT_OR_ABOVE_RATE: entry(
    "CONCEPTUAL",
    "Growing-perpetuity formula used when g ≥ i",
    "The value $P/(i-g)$ was used, or the value was taken to be finite, although the growth rate is not below the interest rate, so the discounted payments never shrink.",
    ["concept_recognition", "formula_selection"],
    "Before using $P/(i-g)$, check that $g < i$; otherwise each discounted payment is at least $P/(1+i)$.",
    "A geometric perpetuity has a finite value if and only if $g < i$."
  ),
  CONC_ANN_FINITE_GROWTH_REJECTED: entry(
    "CONCEPTUAL",
    "Finite geometric annuity judged to have no value",
    "The finite-term geometric annuity was declared undefined or infinite because $g \\ge i$, although finitely many payments always have a finite value.",
    ["concept_recognition", "formula_selection"],
    "The condition $g < i$ belongs to the perpetuity; the $n$-payment formula holds for any $g \\ne i$.",
    "$PV = P\\,[1 - ((1+g)/(1+i))^n]/(i-g)$ for $g \\ne i$, and $nP/(1+i)$ for $g = i$."
  ),
  CONC_ANN_EQUAL_RATE_UNDEFINED: entry(
    "CONCEPTUAL",
    "g = i case treated as undefined",
    "With $g = i$ the closed form reads $0/0$, and this was taken to mean the value cannot be determined.",
    ["concept_recognition", "financial_intuition"],
    "When a closed form breaks down, return to the payments: with $g = i$ every payment has the same present value.",
    "If $g = i$, each payment $P(1+i)^{t-1}$ at time $t$ is worth $P/(1+i)$, so $n$ payments are worth $nP/(1+i)$."
  ),
  CONC_ANN_FIRST_PAYMENT_GROWTH: entry(
    "SEQUENCE_SERIES",
    "Growth applied to the first payment",
    "The first payment of a geometric stream was taken as $P(1+g)$ instead of $P$, so every payment is one growth step too large.",
    ["cashflow_modelling", "concept_recognition"],
    "Write out the first two payments explicitly before choosing a factor.",
    "Payments $P, P(1+g), \\ldots$ at times $1, 2, \\ldots$: the first payment has not grown yet."
  ),
  CONC_ANN_GEOM_J_FACTOR: entry(
    "SEQUENCE_SERIES",
    "Geometric annuity converted without the 1/(1+g) factor",
    "Payments $1, (1+g), \\ldots$ were valued as a level annuity at $j = (1+i)/(1+g) - 1$ without dividing by $1+g$, which values $(1+g), (1+g)^2, \\ldots$ instead.",
    ["formula_selection", "cashflow_modelling"],
    "Check the first term: $a_{\\overline{n}|j}$ discounts the first payment by $1/(1+j) = (1+g)/(1+i)$, not by $1/(1+i)$.",
    "$\\sum_{t=1}^{n}(1+g)^{t-1}v^t = \\dfrac{1}{1+g}\\,a_{\\overline{n}|j}$ with $1+j = (1+i)/(1+g)$."
  ),
  CONC_ANN_ARITH_BASE_SPLIT: entry(
    "SEQUENCE_SERIES",
    "Arithmetic stream split with the wrong level part",
    "$P, P+Q, \\ldots, P+(n-1)Q$ was written as $P\\,a_{\\overline{n}|} + Q\\,(Ia)_{\\overline{n}|}$, which values $P+Q, P+2Q, \\ldots$; the level part must be $P - Q$.",
    ["cashflow_modelling", "formula_selection"],
    "Check the first payment of the decomposition: $(Ia)$ already pays $Q$ at time 1.",
    "$P, P+Q, \\ldots = (P-Q)\\,a_{\\overline{n}|} + Q\\,(Ia)_{\\overline{n}|}$."
  ),
  CONC_ANN_IA_PERP_ISQ: entry(
    "SEQUENCE_SERIES",
    "Increasing perpetuity taken as 1/i²",
    "The perpetuity $1, 2, 3, \\ldots$ was valued at $1/i^2$, dropping the level perpetuity $1/i$ contained in it.",
    ["formula_selection", "cashflow_modelling"],
    "Split $1, 2, 3, \\ldots$ into layers of 1 starting at times $1, 2, 3, \\ldots$: each is worth $v^{k-1}/i$.",
    "$(Ia)_{\\overline{\\infty}|} = 1/i + 1/i^2 = 1/(id)$."
  ),
  CONC_ANN_LAYER_MIX: entry(
    "ALLOCATION",
    "Layered and sequential decompositions mixed",
    "A stream that changes level was split into a block for the early payments plus only the change for the later ones (or the full later amount added on top of a block that continues), so one level is dropped or counted twice.",
    ["cashflow_modelling", "translation"],
    "Decide first whether the pieces run one after another (sequential) or on top of each other (layered), then check one payment from each period.",
    "Sequential: $X a_{\\overline{n}|} + Y v^n a_{\\overline{\\infty}|}$. Layered: $X a_{\\overline{\\infty}|} + (Y-X) v^n a_{\\overline{\\infty}|}$."
  ),
  CONC_ANN_RATE_PERIOD_MISMATCH: entry(
    "RATE_CONVERSION",
    "Rate period not matched to the payment period",
    "An annuity factor counted payments in one period length but used an interest rate for a different period length (for example the annual rate for payments every two years, or a monthly rate for annual payments).",
    ["translation", "formula_selection"],
    "Write down the length of the payment period, then convert the rate to an effective rate for exactly that period.",
    "With payments every $k$ years, use $j = (1+i)^k - 1$ and count payments, not years."
  ),
  CONC_ANN_KYEAR_DIVISOR: entry(
    "TIMING",
    "Wrong divisor for payments every k periods",
    "$a_{\\overline{n}|}/a_{\\overline{k}|}$ and $a_{\\overline{n}|}/s_{\\overline{k}|}$ were confused: dividing by $s_{\\overline{k}|}$ values payments at the end of each $k$-period block, dividing by $a_{\\overline{k}|}$ at its start.",
    ["valuation_dates", "formula_selection"],
    "Replace each payment of 1 at the end of a $k$-year block by the level annual deposits that accumulate to it: $1/s_{\\overline{k}|}$ per year.",
    "Payments of 1 at times $k, 2k, \\ldots, n$ are worth $a_{\\overline{n}|}/s_{\\overline{k}|}$; at times $0, k, \\ldots, n-k$ they are worth $a_{\\overline{n}|}/a_{\\overline{k}|}$."
  ),
  CONC_ANN_MTHLY_PAYMENT_SIZE: entry(
    "VARIABLE_INTERPRETATION",
    "Payment size of a^(m) misread",
    "$a^{(m)}_{\\overline{n}|}$ was read as payments of 1 every $1/m$ year (a total of $m$ per year) instead of $1/m$ each time (a total of 1 per year).",
    ["concept_recognition", "translation"],
    "Every standard annuity symbol pays a total of 1 per year; the superscript only splits it into $m$ instalments.",
    "$a^{(m)}_{\\overline{n}|} = \\sum_{t=1}^{mn} \\tfrac{1}{m} v^{t/m} = (1 - v^n)/i^{(m)}$."
  ),
  CONC_ANN_DOUBLING_TERM: entry(
    "CONCEPTUAL",
    "Annuity value taken as proportional to the term",
    "$a_{\\overline{2n}|}$ was taken as $2a_{\\overline{n}|}$ (or a payment for twice the term as half the payment), ignoring that later payments are discounted more.",
    ["financial_intuition", "concept_recognition"],
    "The second block of $n$ payments is deferred $n$ periods: it is worth $v^n a_{\\overline{n}|}$, not $a_{\\overline{n}|}$.",
    "$a_{\\overline{2n}|} = a_{\\overline{n}|}(1 + v^n) < 2a_{\\overline{n}|}$ for $i > 0$."
  ),
  CONC_ANN_ACCUM_LIMIT: entry(
    "CONCEPTUAL",
    "Limit of a carried over to s",
    "The limit $a_{\\overline{n}|} \\to 1/i$ was transferred to $s_{\\overline{n}|}$, which grows without bound.",
    ["concept_recognition", "financial_intuition"],
    "Present values of more and more distant payments shrink; accumulated values of more and more payments grow.",
    "$a_{\\overline{n}|} = (1 - v^n)/i \\to 1/i$, while $s_{\\overline{n}|} = ((1+i)^n - 1)/i \\to \\infty$."
  ),
  CONC_ANN_FREQUENCY_ALWAYS_BETTER: entry(
    "CONCEPTUAL",
    "More frequent payments assumed worth more",
    "A stream was judged more valuable because it pays more often, although the other stream's payments are, on average, made earlier.",
    ["financial_intuition", "valuation_dates"],
    "Compare when the money arrives on average, not how many instalments there are.",
    "With the same annual total, the stream whose payments come earlier has the larger present value."
  ),
} as const satisfies Record<string, Misconception>;
