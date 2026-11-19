import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings about bonds. */
export const BOND_CONCEPT_MISCONCEPTIONS = {
  CONC_BOOK_MARKET_CONFUSION: entry(
    "VARIABLE_INTERPRETATION",
    "Price, book value, market value and redemption value confused",
    "One of the bond's values was read as another: the book value (at the purchase yield) as the market value (at the current yield), or either as the redemption value.",
    ["concept_recognition", "translation"],
    "Ask at which yield and on which date each value is computed: book value uses the yield at purchase, market value the current yield, redemption value is a contract term.",
    "Book value at time t is the PV of the remaining payments at the original yield; market value uses the yield prevailing at t."
  ),
  CONC_BOND_COUPON_ON_REDEMPTION: entry(
    "VARIABLE_INTERPRETATION",
    "Coupon computed on the redemption value",
    "Each coupon was taken as the coupon rate times the redemption value (or the price) instead of the coupon rate times the face amount.",
    ["concept_recognition", "translation"],
    "Coupons are always the coupon rate times the face (par) amount, whatever the bond is redeemed at or sells for.",
    "Coupon per period = F·r; the redemption value C only enters through the final payment."
  ),
  CONC_BOND_REDEMPTION_AS_FACE: entry(
    "VARIABLE_INTERPRETATION",
    "Face amount taken as the redemption payment",
    "The amount paid at maturity was taken as the face amount although the bond is redeemable at a different value.",
    ["concept_recognition", "translation"],
    "Read the redemption clause: ‘redeemable at C’ fixes the final payment; ‘at par’ means C = F.",
    "P = F·r·a(n) + C·vⁿ, with C the stated redemption value."
  ),
  CONC_BOND_COUPON_RATE_AS_MODIFIED: entry(
    "CONCEPTUAL",
    "Coupon rate used where the modified coupon rate belongs",
    "Premium or discount was judged by comparing the coupon rate r with the yield (or r was used for g in Makeham's formula) although the redemption value differs from the face amount.",
    ["concept_recognition", "formula_selection"],
    "When C ≠ F, compute g = Fr/C before comparing with the yield or using Makeham's formula.",
    "Premium ⇔ Fr > Cj ⇔ g > j, with g = Fr/C."
  ),
  CONC_BOND_YIELD_IS_COUPON_RATE: entry(
    "CONCEPTUAL",
    "Coupon rate taken as the yield",
    "The coupon rate was used as the rate of return or as the discount rate for the bond's payments.",
    ["concept_recognition", "financial_intuition"],
    "The coupon rate only sizes the coupons; the yield is the rate that equates price with the PV of all payments.",
    "Coupon rate = coupon / face; yield j solves P = Fr·a(n)_j + C·vⁿ_j."
  ),
  CONC_BOND_COUPON_AS_INTEREST: entry(
    "VARIABLE_INTERPRETATION",
    "Whole coupon treated as interest earned",
    "Each coupon was taken to be entirely interest income, ignoring that part of it writes down a premium (or that interest also accrues on a discount).",
    ["concept_recognition", "translation"],
    "Interest earned in a period is the yield times the book value at the start of the period; the coupon differs from it by the amortization.",
    "Coupon = j·BV(t−1) + (amount written down); total interest = total coupons + C − P."
  ),
  CONC_BOND_REALIZED_EQUALS_YIELD: entry(
    "CONCEPTUAL",
    "Realized return taken to equal the purchase yield",
    "The investor's return over the holding period was taken to be the purchase yield whatever rate the coupons are reinvested at.",
    ["financial_intuition", "concept_recognition"],
    "The purchase yield is realized only if every coupon is reinvested at that same yield; otherwise compute the accumulated value and solve.",
    "Realized annual return = (AV at maturity / P)^(1/n) − 1, with AV = F·r·s(n) at the reinvestment rate + C."
  ),
  CONC_BOND_COUPONS_NOT_REINVESTED: entry(
    "INCORRECT_MODEL",
    "Coupons accumulated without interest",
    "The coupons were simply added up (or left out) instead of being accumulated at the reinvestment rate to the valuation date.",
    ["cashflow_modelling", "concept_recognition"],
    "Ask what happens to each coupon between its payment date and the valuation date; if it is reinvested, it earns interest.",
    "Accumulated coupons = F·r·s(n) at the reinvestment rate, not n·F·r."
  ),
  CONC_BOND_CALL_IGNORED: entry(
    "INCORRECT_MODEL",
    "Call feature ignored",
    "A callable bond was valued as if it were certain to run to maturity.",
    ["concept_recognition", "financial_intuition"],
    "With a call option, the issuer chooses the redemption date; a guaranteed yield must allow for every possible date.",
    "Price that guarantees yield j = minimum over all possible redemption dates of the price to that date."
  ),
  CONC_BOND_CALL_AVERAGE: entry(
    "INCORRECT_MODEL",
    "Call dates averaged",
    "The bond was priced to the midpoint of the call window, or the prices to several dates were averaged, instead of taking the worst case.",
    ["concept_recognition", "financial_intuition"],
    "An investor who must be guaranteed a yield cannot rely on an average: price to the date that gives the lowest price.",
    "Guaranteed-yield price = min over redemption dates, not a mean."
  ),
  CONC_BOND_YIELD_AVERAGE_SPOT: entry(
    "CONCEPTUAL",
    "Yield taken as an average of spot rates",
    "The bond's yield to maturity was taken as the simple average of the spot rates (or the spot rates were averaged and used as one discount rate).",
    ["concept_recognition", "formula_selection"],
    "The yield is the single rate that reproduces the price; it is weighted towards the maturity where most of the value sits.",
    "Price = Σ CF_t (1 + s_t)^(−t) = Σ CF_t (1 + j)^(−t) defines j."
  ),
} as const satisfies Record<string, Misconception>;
