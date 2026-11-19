import { entry, type Misconception } from "../misconception-kit";

/** Misconceptions added for the composite calculation templates (ordered pairs, allocations, table-driven items). */
export const COMPOSITE_MISCONCEPTIONS = {
  COMP_PRINCIPAL_FROM_START: entry(
    "TIMING",
    "Principal portion discounted from the start of the loan",
    "The principal portion of payment k was taken as X·v^k, discounting from the loan date, instead of X·v^(n−k+1), discounting from the end of the term.",
    ["valuation_dates", "formula_retrieval"],
    "Principal portions grow by (1 + i) each period, so the last payment has the largest one: count the exponent back from the final payment.",
    "Principal in payment k of a level-payment loan: X·v^(n−k+1)."
  ),
  COMP_FORWARD_RATIO_NO_POWERS: entry(
    "INCORRECT_FORMULA",
    "Forward rate as a ratio of one-year factors",
    "The forward rate was taken as (1 + s_long)/(1 + s_short) − 1, dividing the rates' one-year factors instead of the accumulation factors over each term.",
    ["formula_retrieval", "translation"],
    "Raise each spot factor to its own term before dividing: (1 + s_2)² / (1 + s_1).",
    "(1 + s_t)^t (1 + f_{t,u})^(u−t) = (1 + s_u)^u."
  ),
  COMP_PAIR_REVERSED: entry(
    "VARIABLE_INTERPRETATION",
    "Ordered pair given in the wrong order",
    "Both quantities were computed correctly but reported in the reverse of the order the question asks for.",
    ["translation", "validation"],
    "Before choosing an option, match each component of the pair to the quantity named in that position of the stem.",
    "An ordered pair (A, B) is read in the order the question defines it."
  ),
  COMP_PERIODS_AS_YEARS: entry(
    "TIMING",
    "Years counted as coupon periods",
    "A time stated in years was used as the number of coupon periods elapsed, although coupons are paid more than once a year.",
    ["valuation_dates", "cashflow_modelling"],
    "Convert every date into coupon periods first: t years of semiannual coupons is 2t periods.",
    "With m coupons a year, the book value at the end of year t uses n·m − t·m remaining periods."
  ),
  COMP_SPOT_AS_FORWARD: entry(
    "INCORRECT_MODEL",
    "Spot rates used as one-year forward rates",
    "The discount factor for time t was built as the product of (1 + s_u)^(−1) for u ≤ t, treating each spot rate as the rate for a single year.",
    ["concept_recognition", "formula_selection"],
    "A t-year spot rate applies over the whole t years: v(t) = (1 + s_t)^(−t).",
    "Spot rates discount from time 0; one-year forward rates chain year by year."
  ),
  COMP_FORWARD_AS_SPOT: entry(
    "INCORRECT_MODEL",
    "One-year forward rates used as spot rates",
    "Each one-year forward rate was used as if it were the spot rate for its maturity, (1 + f_t)^(−t), instead of chaining the forward factors.",
    ["concept_recognition", "formula_selection"],
    "A one-year forward rate applies only to its own year: multiply the factors (1 + f_1)(1 + f_2)…(1 + f_t).",
    "(1 + s_t)^t = (1 + f_1)(1 + f_2)…(1 + f_t)."
  ),
  COMP_YIELD_AS_LONGEST_SPOT: entry(
    "INCORRECT_MODEL",
    "Yield to maturity taken as the longest spot rate",
    "The yield of a coupon bond was taken to be the spot rate for its maturity, ignoring that its coupons are discounted at shorter, different spot rates.",
    ["concept_recognition", "financial_intuition"],
    "A coupon bond's yield is a weighted blend of the spot rates of all its payment dates, so it lies between the shortest and longest relevant spot rate.",
    "The yield is the single rate j with Σ CF_t (1 + j)^(−t) = price."
  ),
  COMP_DWR_METHOD_CONFUSED: entry(
    "INCORRECT_MODEL",
    "Simple-interest and exact dollar-weighted returns interchanged",
    "The simple-interest approximation to the dollar-weighted return was given where the exact compound-interest rate was asked for, or the reverse.",
    ["formula_selection", "translation"],
    "Read which definition the question specifies: the simple approximation divides the gain by time-weighted capital; the exact rate solves a compound equation of value.",
    "Exact: Σ C_t (1 + j)^(1−t) + A = B. Approximation: j ≈ I / (A + Σ C_t (1 − t))."
  ),
  COMP_TWR_FLOW_IN_WRONG_SUBPERIOD: entry(
    "TIMING",
    "Deposit placed in the wrong sub-period for the time-weighted return",
    "A deposit or withdrawal was added to the fund value at the end of the earlier sub-period instead of at the start of the next one, so the sub-period returns include the flow itself.",
    ["cashflow_modelling", "valuation_dates"],
    "Each sub-period starts just after a transaction and ends just before the next: growth = (value before next flow)/(value just after this flow).",
    "1 + TWR = Π (value just before flow k+1)/(value just after flow k)."
  ),
  COMP_DEPOSIT_TIME_WEIGHT: entry(
    "TIMING",
    "Deposit weighted by elapsed time instead of remaining time",
    "In the dollar-weighted equation a deposit made at time t was given interest for t instead of for the 1 − t that it is actually invested.",
    ["valuation_dates", "cashflow_modelling"],
    "A deposit made at time t earns interest from t to the end of the year: weight 1 − t.",
    "A·(1 + j) + Σ C_t (1 + j)^(1−t) = B."
  ),
  COMP_SYMMETRIC_DATES: entry(
    "CONCEPTUAL",
    "Immunizing assets assumed symmetric about the liability",
    "The second asset was placed as far after the liability as the first is before it, as if duration matching always required symmetric dates.",
    ["concept_recognition", "financial_intuition"],
    "Symmetric dates only work when the two present values are equal; otherwise the duration condition fixes the distance from the PV weights.",
    "Full immunization of one liability at T: PV_A·a = PV_B·b for assets at T − a and T + b."
  ),
  COMP_COUPON_BOND_AS_ZERO: entry(
    "CONCEPTUAL",
    "Coupon bond's duration taken as its term",
    "The Macaulay duration of a coupon bond was taken to equal its maturity, as for a zero-coupon bond.",
    ["concept_recognition", "formula_selection"],
    "Only a zero-coupon bond has duration equal to its term; coupons pull a coupon bond's duration below its maturity.",
    "D = Σ t·CF_t v^t / Σ CF_t v^t < n for any bond paying coupons before n."
  ),
  COMP_RATE_FROM_CLOSING_BALANCE: entry(
    "VARIABLE_INTERPRETATION",
    "Rate inferred from the balance after the payment",
    "The interest rate was taken as the interest portion divided by the balance after that payment, instead of the balance before it.",
    ["translation", "cashflow_modelling"],
    "Interest for period k accrues on the balance at the start of the period: B_{k−1} = B_k + principal portion of payment k.",
    "I_k = i·B_{k−1}, so i = I_k / (B_k + P_k)."
  ),
} as const satisfies Record<string, Misconception>;
