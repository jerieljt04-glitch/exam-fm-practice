import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings in general cash flows, portfolios and asset-liability management. */
export const ALM_CONCEPT_MISCONCEPTIONS = {
  CONC_FORWARD_REVERSED: entry(
    "CONCEPTUAL",
    "Forward-rate relationship reversed",
    "The forward rate was taken as the ratio of the shorter accumulation to the longer one, or the spot and forward roles were swapped.",
    ["concept_recognition", "translation"],
    "Write (1 + s_t)^t (1 + f_{t,t+k})^k = (1 + s_{t+k})^{t+k} and solve for the forward factor.",
    "The forward rate is the rate that makes investing short then rolling forward equal to investing long."
  ),
  CONC_PV_MATCH_IMMUNIZES: entry(
    "CONCEPTUAL",
    "Equal present values taken as immunization",
    "Matching the present value of assets to that of liabilities was taken to protect the surplus against rate changes.",
    ["concept_recognition", "financial_intuition"],
    "Immunization also needs the first derivatives to match (equal durations) and the asset curvature to be at least the liabilities'.",
    "Redington: PV_A = PV_L, PV_A′ = PV_L′ and PV_A″ > PV_L″ at the current rate."
  ),
  CONC_IGNORED_CONVEXITY: entry(
    "CONCEPTUAL",
    "Convexity ignored",
    "The price change was judged from duration alone, as if the price–yield curve were a straight line.",
    ["concept_recognition", "financial_intuition"],
    "For a larger rate change, or when comparing portfolios with equal duration, ask which one bends more.",
    "ΔP/P ≈ −D_mod·Δi + ½·C·(Δi)²: convexity always adds to the value of a non-callable bond for a change in either direction."
  ),
  CONC_ALM_DWR_TWR_SWAPPED: entry(
    "CONCEPTUAL",
    "Dollar-weighted and time-weighted returns confused",
    "A property of one return measure was attributed to the other: the time-weighted return was made to depend on the size or timing of contributions, or the dollar-weighted return was taken to measure only the fund's investment performance.",
    ["concept_recognition"],
    "Ask whether the measure needs the dates of the contributions (dollar-weighted) or the fund values at those dates (time-weighted).",
    "The time-weighted return compounds subperiod growth factors; the dollar-weighted return is the yield rate of the investor's own cash flows."
  ),
  CONC_ALM_CONTRIBUTION_AS_GAIN: entry(
    "CONCEPTUAL",
    "Contribution counted as investment gain",
    "A deposit was treated as growth of the fund (or a withdrawal as a loss), so the closing balance was compared directly with the opening balance.",
    ["cashflow_modelling", "concept_recognition"],
    "Separate new money from investment growth before forming any ratio of fund values.",
    "Investment gain is the closing balance minus the opening balance minus net contributions."
  ),
  CONC_ALM_TWR_SUBPERIOD: entry(
    "CONCEPTUAL",
    "Subperiod not restarted at a cash flow",
    "A time-weighted subperiod did not end just before the cash flow, or the next one did not start from the balance just after it.",
    ["cashflow_modelling", "valuation_dates"],
    "Each subperiod ratio is (value just before the next cash flow) / (value just after the previous one).",
    "1 + j_TW = Π (B_k / (B_{k-1} + C_{k-1}))."
  ),
  CONC_ALM_DWR_WEIGHT_TIMING: entry(
    "CONCEPTUAL",
    "Contribution weighted by elapsed time",
    "In the simple-interest dollar-weighted return, a contribution at time t was weighted by t instead of by the time 1 − t it remains invested.",
    ["valuation_dates", "translation"],
    "A contribution earns interest from its date to the end of the period.",
    "j ≈ I / (A + Σ C_t (1 − t))."
  ),
  CONC_ALM_RETURNS_COINCIDE: entry(
    "CONCEPTUAL",
    "Dollar- and time-weighted returns assumed equal",
    "The two returns were assumed to agree although there were intermediate cash flows and the subperiod returns differed.",
    ["concept_recognition", "financial_intuition"],
    "The two measures agree only without intermediate cash flows or when every subperiod earns the same rate.",
    "The dollar-weighted return leans toward the return of the subperiods in which more money was invested."
  ),
  CONC_ALM_RETURNS_AVERAGED: entry(
    "CONCEPTUAL",
    "Rates averaged instead of compounded",
    "Rates for successive periods were combined by an arithmetic average instead of multiplying the growth factors.",
    ["concept_recognition", "algebra"],
    "Rates for consecutive periods combine through 1 + j = Π(1 + r_k), then a root for an annual rate.",
    "Growth over consecutive periods is multiplicative; the arithmetic mean overstates the compound rate."
  ),
  CONC_ALM_SPOT_AS_YTM: entry(
    "CONCEPTUAL",
    "Yield to maturity taken as the spot rate",
    "The yield to maturity of a coupon bond was treated as the spot rate for its maturity (or the reverse).",
    ["concept_recognition"],
    "Ask whether the instrument has a single payment; only then is its yield a spot rate.",
    "A coupon bond's yield is a PV-weighted blend of the spot rates for its payment dates."
  ),
  CONC_ALM_CURVE_SLOPE_REVERSED: entry(
    "CONCEPTUAL",
    "Forward rates placed on the wrong side of the spot curve",
    "Forward rates were taken to lie below the spot rates on a rising curve (or above them on a falling one).",
    ["financial_intuition", "concept_recognition"],
    "A longer spot rate is an average of the forwards before it; for it to rise, the next forward must exceed it.",
    "(1 + s_{t+1})^{t+1} = (1 + s_t)^t (1 + f_{t,t+1}): s_{t+1} > s_t implies f_{t,t+1} > s_{t+1}."
  ),
  CONC_ALM_FORWARD_NOT_ANNUALIZED: entry(
    "CONCEPTUAL",
    "Multi-year forward rate not annualized",
    "The k-year forward accumulation factor minus 1 was reported as an annual effective rate.",
    ["translation", "concept_recognition"],
    "Check the length of the forward period; take the k-th root for an annual rate.",
    "(1 + f)^k = (1 + s_b)^b / (1 + s_a)^a with k = b − a."
  ),
  CONC_ALM_FORWARD_AS_SPOT: entry(
    "CONCEPTUAL",
    "Forward rate used as a spot rate",
    "A payment at time t was discounted at the one-year forward rate for year t raised to the power t, instead of through the product of the forward factors.",
    ["formula_selection", "valuation_dates"],
    "A forward rate applies to one period only; chain the factors for the years the payment travels.",
    "(1 + s_t)^t = (1 + f_{0,1})(1 + f_{1,2})…(1 + f_{t−1,t})."
  ),
  CONC_ALM_FORWARD_KNOWN_FUTURE: entry(
    "CONCEPTUAL",
    "Forward rate taken as the future spot rate",
    "The forward rate was read as the one-year rate that will actually prevail in the future, known today.",
    ["concept_recognition"],
    "A forward rate is a rate that can be locked in today from current prices; the future spot rate is unknown.",
    "Forward rates are implied by today's spot rates; they are not forecasts known with certainty."
  ),
  CONC_ALM_SPOT_NOT_COMPOUNDED: entry(
    "CONCEPTUAL",
    "Spot rate not compounded over its term",
    "A t-year spot rate was used as a one-period factor 1 + s_t instead of (1 + s_t)^t.",
    ["formula_selection", "algebra"],
    "A spot rate is an annual effective rate; a t-year investment accumulates by (1 + s_t)^t.",
    "Value at 0 of 1 due at t: (1 + s_t)^{−t}."
  ),
  CONC_ALM_DURATION_NOT_NORMALIZED: entry(
    "CONCEPTUAL",
    "Weighted time sum not divided by the present value",
    "The sum of t·CF_t·v^t (or −P'(i)) was reported as a duration without dividing by the price.",
    ["formula_selection"],
    "Duration is a weighted mean: divide by the total weight, the present value.",
    "D_mac = Σ t CF_t v^t / Σ CF_t v^t; D_mod = −P'(i)/P(i)."
  ),
  CONC_ALM_BULLET_MORE_CONVEX: entry(
    "CONCEPTUAL",
    "Concentrated cash flows judged more convex",
    "Of two positions with the same present value and duration, the one with cash flows concentrated near the duration was judged to have the greater convexity.",
    ["financial_intuition"],
    "At fixed duration, convexity grows with the spread of the cash flows about the duration.",
    "Σ w_t t(t+1) = D² + D + Σ w_t (t − D)²: dispersion adds convexity."
  ),
  CONC_ALM_CONVEXITY_SIGN: entry(
    "CONCEPTUAL",
    "Convexity correction given the wrong sign",
    "The second-order term was subtracted, or positive convexity was taken to lower the value when rates move.",
    ["financial_intuition", "algebra"],
    "For a non-callable bond the price–yield curve bends upward; the correction ½C(Δi)² is never negative.",
    "P(i) ≈ P(i_0)[1 − D_mod Δi + ½ C (Δi)²]."
  ),
  CONC_ALM_APPROX_EXACT: entry(
    "CONCEPTUAL",
    "Duration approximation treated as exact",
    "A first-order or Macaulay estimate was treated as the exact new value, or as exact whenever the change is small.",
    ["concept_recognition"],
    "An approximation is exact only in special cases, such as the Macaulay estimate for a single payment.",
    "Approximation error shrinks with the size of the change but is not zero in general."
  ),
  CONC_ALM_APPROX_ORDER_CONFUSED: entry(
    "CONCEPTUAL",
    "First-order and Macaulay approximations confused",
    "The linear (modified-duration) estimate and the Macaulay estimate were taken for each other, or convexity was thought to enter a first-order estimate.",
    ["formula_selection"],
    "Name the estimate: linear in Δi with D_mod, or a power of (1 + i_0)/(1 + i) with D_mac.",
    "Linear ≤ Macaulay ≤ true price for positive cash flows."
  ),
  CONC_ALM_MATCHING_REBALANCE: entry(
    "CONCEPTUAL",
    "Exactly matched portfolio thought to need rebalancing",
    "A portfolio whose cash flows equal the liabilities date by date was thought to be exposed to rate changes or to need rebalancing.",
    ["concept_recognition"],
    "If every liability payment is met by an asset payment on the same date, interest rates never enter.",
    "Exact matching removes reinvestment and price risk entirely (absent default)."
  ),
  CONC_ALM_MATCHING_AS_IMMUNIZATION: entry(
    "CONCEPTUAL",
    "Cash-flow matching confused with immunization",
    "Exact matching was described with immunization conditions (durations, convexity, parallel shifts), or immunization was taken to match cash flows date by date.",
    ["concept_recognition"],
    "Matching equates cash flows; immunization equates present values and their derivatives at one rate.",
    "Matching works for any rate change; immunization only for parallel shifts (full) or small parallel shifts (Redington)."
  ),
  CONC_ALM_REDINGTON_ALL_SHIFTS: entry(
    "CONCEPTUAL",
    "Immunization taken to protect against any rate change",
    "Redington or full immunization was taken to protect against large or non-parallel changes in the yield curve.",
    ["concept_recognition"],
    "Check the size and shape of the shift: Redington covers small parallel shifts, full immunization any parallel shift.",
    "Immunization conditions are derivatives at one flat rate; they say nothing about twists of the curve."
  ),
  CONC_ALM_FULL_SAME_SIDE: entry(
    "CONCEPTUAL",
    "Full immunization without bracketing",
    "Asset flows on one side of the liability date were accepted for full immunization.",
    ["concept_recognition", "valuation_dates"],
    "For full immunization one asset flow must be due before the liability and one after it.",
    "The PV-weighted mean of times all after n exceeds n, so durations cannot match."
  ),
  CONC_ALM_FULL_SMALL_SHIFTS: entry(
    "CONCEPTUAL",
    "Full immunization limited to small shifts",
    "The protection of full immunization was understated as holding only for small parallel shifts.",
    ["concept_recognition"],
    "Full immunization of a single liability holds for parallel shifts of any size.",
    "With bracketing flows and matched PV and duration, S(i) ≥ 0 for every flat rate i."
  ),
  CONC_ALM_LIABILITY_CONVEXITY: entry(
    "CONCEPTUAL",
    "Convexity condition reversed",
    "The liabilities' convexity was required to exceed (or equal) the assets'.",
    ["concept_recognition"],
    "The surplus must curve upward: S''(i_0) = PV_A'' − PV_L'' > 0.",
    "Redington: PV_A'' > PV_L'' at i_0."
  ),
  CONC_ALM_DURATIONS_ADDED: entry(
    "CONCEPTUAL",
    "Durations added rather than averaged",
    "The durations of the components of a portfolio were summed.",
    ["formula_selection"],
    "A portfolio's duration lies between its components' durations.",
    "D_P = Σ (P_k / P) D_k."
  ),
} as const satisfies Record<string, Misconception>;
