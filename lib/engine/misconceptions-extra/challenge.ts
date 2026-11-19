import { entry, type Misconception } from "../misconception-kit";

/** Misconceptions added for the challenge calculation templates (extended by that workstream). */
export const CHALLENGE_MISCONCEPTIONS = {
  CHAL_RATE_BY_PAYMENT_DATE: entry(
    "TIMING",
    "Rate chosen by the payment date",
    "Each payment was moved to the valuation date at the rate in force on its own payment date, instead of at the rate in force during each period it was moved across.",
    ["valuation_dates", "cashflow_modelling"],
    "When the rate changes at a known date, split every move that crosses that date into two pieces and use each period's own rate.",
    "The value at T of a payment at t is CF·a(T)/a(t), where a(·) is built period by period from the rates actually in force."
  ),
  CHAL_BALLOON_FOR_DROP: entry(
    "INCORRECT_MODEL",
    "Balloon payment given for a drop payment",
    "The final balance was added to the last regular payment (a balloon) when the question placed a smaller payment one period after the last regular payment (a drop).",
    ["cashflow_modelling", "concept_recognition"],
    "Read when the final payment is made: with the last regular payment (balloon) or one period later (drop).",
    "Drop payment = B_N(1 + j), paid at N + 1; balloon payment = P + B_N, paid at N."
  ),
  CHAL_FRACTIONAL_PAYMENT: entry(
    "INCORRECT_MODEL",
    "Final payment taken as a fraction of a regular payment",
    "The final payment was taken as the fractional part of the solved number of payments times the regular payment, ignoring interest on the remaining balance.",
    ["formula_selection", "cashflow_modelling"],
    "A non-integer solution for the number of payments only says how many full payments fit; the final payment comes from the balance just after the last full payment.",
    "Final payment = (balance after the last full payment) × (1 + j), not P × (fractional part of n)."
  ),
  CHAL_CONVEXITY_AT_DURATION: entry(
    "CONCEPTUAL",
    "Portfolio treated as one zero-coupon bond at its duration",
    "The convexity of a portfolio was computed as if all its value were paid at its duration, ignoring the dispersion of its cash flows around that date.",
    ["concept_recognition", "financial_intuition"],
    "Two portfolios with the same duration can have different convexities; convexity grows with the spread of cash flows around the duration.",
    "Convexity of a portfolio is the PV-weighted average of the components' convexities, which exceeds D(D + 1)v² whenever cash flows are spread out."
  ),
  CHAL_WRONG_APPROXIMATION: entry(
    "INCORRECT_FORMULA",
    "The other first-order approximation used",
    "The first-order modified approximation was used where the first-order Macaulay approximation was required, or the reverse.",
    ["formula_selection"],
    "Check which approximation the question names: the modified one is linear in Δi, the Macaulay one is a power of (1 + i₀)/(1 + i₁).",
    "Modified: P(i₁) ≈ P(i₀)(1 − D_mod·Δi). Macaulay: P(i₁) ≈ P(i₀)[(1 + i₀)/(1 + i₁)]^D."
  ),
  CHAL_YTM_AS_SPOT: entry(
    "CONCEPTUAL",
    "Bond yields used as spot rates",
    "Each bond's yield to maturity was used as if it were the spot rate for its maturity date, discounting a single cash flow at that date.",
    ["concept_recognition", "formula_selection"],
    "A coupon bond's yield averages the rates for all of its payment dates; it equals the spot rate only for a zero-coupon bond.",
    "Spot rates come from zero-coupon prices or by bootstrapping coupon-bond prices; a yield to maturity is one rate for a whole set of cash flows."
  ),
} as const satisfies Record<string, Misconception>;
