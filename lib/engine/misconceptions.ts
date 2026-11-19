import { ALM_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/alm";
import { ANNUITY_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/annuities";
import { BOND_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/bonds";
import { CHALLENGE_MISCONCEPTIONS } from "./misconceptions-extra/challenge";
import { COMPOSITE_MISCONCEPTIONS } from "./misconceptions-extra/composite";
import { LOAN_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/loans";
import { SHARED_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/shared";
import { TVM_CONCEPT_MISCONCEPTIONS } from "./misconceptions-extra/tvm";
import { entry, type Misconception } from "./misconception-kit";

export { MISCONCEPTION_CATEGORIES, entry, type Misconception, type MisconceptionCategory } from "./misconception-kit";

/**
 * Catalogue of the mistakes distractors are built from.
 *
 * The core entries below come from the numerical bank. Conceptual
 * misunderstandings used by Concept Practice and the non-numerical SOA-style
 * items live in misconceptions-extra/, one file per syllabus topic, and are
 * merged in here; every id must be unique across all files (checked on load).
 */
const CORE_MISCONCEPTIONS = {
  // ------------------------------------------------------------ timing
  TIMING_DUE_AS_IMMEDIATE: entry(
    "TIMING",
    "Annuity-due valued as annuity-immediate",
    "Payments made at the start of each period were valued as if they were made at the end, losing one period of interest on every payment.",
    ["cashflow_modelling", "valuation_dates", "formula_selection"],
    "Look for “at the beginning of each”, “starting today”, or “immediately”. Draw the first payment on the timeline before choosing a factor.",
    "A payment stream that starts one period earlier is worth (1 + i) times as much at any fixed date: ä = (1 + i)·a and s̈ = (1 + i)·s."
  ),
  TIMING_IMMEDIATE_AS_DUE: entry(
    "TIMING",
    "Annuity-immediate valued as annuity-due",
    "End-of-period payments were valued as if they were made at the start, giving every payment one period of interest too many.",
    ["cashflow_modelling", "valuation_dates", "formula_selection"],
    "“At the end of each year” and “first payment one year from now” both mean annuity-immediate. Mark the first payment's date before applying a factor.",
    "a(n) values payments at times 1..n at time 0; ä(n) values payments at times 0..n−1 at time 0."
  ),
  TIMING_EXTRA_PERIOD: entry(
    "TIMING",
    "One extra period of interest",
    "A cash flow was accumulated or discounted over one period more than it actually travels.",
    ["valuation_dates", "cashflow_modelling"],
    "Count the gap between the payment date and the valuation date explicitly: (valuation time) − (payment time).",
    "A cash flow at time t is worth CF·(1 + i)^(T − t) at time T: the exponent is the distance travelled, nothing more."
  ),
  TIMING_MISSING_PERIOD: entry(
    "TIMING",
    "Missing accumulation or discount period",
    "A cash flow was moved to the valuation date with one period too few.",
    ["valuation_dates", "cashflow_modelling"],
    "After using an annuity factor, ask where its value sits on the timeline (one period before the first payment for a, at the last payment for s) and move it from there.",
    "Annuity factors leave their value at a specific date; every further move is an explicit power of (1 + i)."
  ),
  TIMING_DEFERRAL_OFF_BY_ONE: entry(
    "TIMING",
    "Deferral period miscounted",
    "A deferred stream was discounted by the time of the first payment instead of by one period before it (or vice versa).",
    ["valuation_dates", "cashflow_modelling"],
    "If the first payment is at time k + 1, the annuity-immediate value sits at time k, so discount by k periods.",
    "Deferred annuity-immediate with first payment at k + 1: PV = v^k · a(n)."
  ),
  TIMING_IGNORED_DEFERRAL: entry(
    "TIMING",
    "Deferral ignored",
    "A stream that starts in the future was valued as if it started now.",
    ["valuation_dates", "concept_recognition"],
    "Whenever the first payment is not one period away, the stream is deferred. Write the first payment's date on the timeline.",
    "A stream's value has to be moved from where its factor leaves it to the valuation date."
  ),
  TIMING_VALUATION_DATE: entry(
    "TIMING",
    "Mixed valuation dates",
    "Cash flows were compared or added at different dates, so the equation of value does not balance at any single point in time.",
    ["valuation_dates", "cashflow_modelling", "translation"],
    "Choose one valuation date before writing anything, and move every cash flow — both sides — to that date.",
    "An equation of value holds at every date only if every term is valued at the same date."
  ),
  TIMING_REFINANCE_PERIODS: entry(
    "TIMING",
    "Wrong number of remaining payments at refinancing",
    "The refinancing was modelled with one payment too many or too few remaining.",
    ["valuation_dates", "cashflow_modelling"],
    "Just after the k-th of n payments, n − k payments remain. Decide whether the refinancing date is just before or just after a payment.",
    "The balance just after payment k is the PV of the n − k payments still owed."
  ),
  TIMING_BALANCE_INDEX: entry(
    "TIMING",
    "Balance taken at the wrong payment",
    "The outstanding balance was computed just after the wrong payment (one too early or one too late).",
    ["valuation_dates", "cashflow_modelling"],
    "“Immediately after the k-th payment” means k payments made and n − k remaining. Write both numbers down.",
    "Retrospective: B_k = L(1+i)^k − P·s(k). Prospective: B_k = P·a(n − k)."
  ),
  TIMING_PAYMENT_BEFORE_INTEREST: entry(
    "TIMING",
    "Payment deducted before interest accrued",
    "The payment was subtracted at the start of the period, so interest accrued on the reduced balance instead of the full balance.",
    ["cashflow_modelling", "financial_intuition"],
    "Interest for a period accrues on the balance at the start of that period; an end-of-period payment arrives after the interest.",
    "Balance after an end-of-period payment = (opening balance)(1 + i) − payment."
  ),

  // ------------------------------------------------------------ model
  MODEL_INTEREST_ON_PAYMENT: entry(
    "INCORRECT_MODEL",
    "Interest applied to the payment",
    "Interest was charged on the payment amount rather than on the outstanding balance.",
    ["cashflow_modelling", "concept_recognition", "financial_intuition"],
    "Ask “what amount is borrowed during this period?” — that, and only that, earns interest.",
    "Interest for a period = rate × balance outstanding during that period."
  ),
  MODEL_INTEREST_ON_ORIGINAL: entry(
    "INCORRECT_MODEL",
    "Interest on the original principal",
    "Interest was computed on the original loan amount rather than on the balance outstanding at the start of that period.",
    ["cashflow_modelling", "concept_recognition"],
    "If the loan has been partly repaid, the interest base has changed. Find the balance first.",
    "Interest in payment t = i × B_(t−1), the balance just after the previous payment."
  ),
  MODEL_BALANCE_AT_NEW_RATE: entry(
    "INCORRECT_MODEL",
    "Outstanding balance valued at the new rate",
    "The balance owed under the old loan was recomputed at the refinancing rate, as if the old payments had always been discounted at the new rate.",
    ["cashflow_modelling", "concept_recognition", "valuation_dates"],
    "The amount owed at the refinancing date is fixed by the original loan's terms. Find it at the old rate first, then re-amortize it at the new rate.",
    "Refinancing: B_k at the old rate, then new payment = B_k / a(remaining term) at the new rate."
  ),
  MODEL_SIMPLE_AS_COMPOUND: entry(
    "INCORRECT_MODEL",
    "Simple interest treated as compound",
    "An account crediting simple interest was accumulated with compound interest.",
    ["concept_recognition", "formula_selection"],
    "“Simple interest” means interest is earned on the original deposit only: a(t) = 1 + it.",
    "Simple: a(t) = 1 + it. Compound: a(t) = (1 + i)^t."
  ),
  MODEL_COMPOUND_AS_SIMPLE: entry(
    "INCORRECT_MODEL",
    "Compound interest treated as simple",
    "A compound-interest account was accumulated with simple interest.",
    ["concept_recognition", "formula_selection"],
    "Effective and nominal rates always compound; only an explicit “simple interest” does not.",
    "Compound: a(t) = (1 + i)^t."
  ),
  MODEL_UNDISCOUNTED_WEIGHTS: entry(
    "INCORRECT_MODEL",
    "Undiscounted weights",
    "Cash flows were weighted by their face amounts instead of their present values.",
    ["concept_recognition", "formula_selection", "financial_intuition"],
    "Duration, portfolio weights and equations of value all use present values. Face amounts at different dates are not comparable.",
    "Weights in a duration or portfolio average are PV_t / total PV."
  ),
  MODEL_SINGLE_RATE: entry(
    "INCORRECT_MODEL",
    "One spot rate used for every cash flow",
    "Every cash flow was discounted at one rate even though each maturity has its own spot rate.",
    ["concept_recognition", "formula_selection"],
    "When a table gives a rate per maturity, each cash flow at time t uses (1 + s_t)^(−t).",
    "PV = Σ CF_t (1 + s_t)^(−t)."
  ),
  MODEL_REINVEST_AT_YIELD: entry(
    "INCORRECT_MODEL",
    "Coupons reinvested at the purchase yield",
    "Coupons were accumulated at the bond's yield rate instead of the stated reinvestment rate.",
    ["concept_recognition", "cashflow_modelling"],
    "If the question states a separate reinvestment rate, coupon accumulation uses that rate, not the yield.",
    "AV at maturity = Fr·s(n) at the reinvestment rate + C."
  ),
  MODEL_WRONG_CALL_DATE: entry(
    "INCORRECT_MODEL",
    "Wrong call date assumed",
    "The price was computed assuming the bond is called on a date that is not the worst case for the investor.",
    ["concept_recognition", "financial_intuition"],
    "Premium bond (coupon > yield): assume the earliest call. Discount bond: assume the latest redemption.",
    "To guarantee a yield, price at the minimum over all possible redemption dates."
  ),
  MODEL_STRAIGHT_LINE: entry(
    "INCORRECT_MODEL",
    "Straight-line amortization",
    "The premium or discount was spread evenly over the coupons instead of by the scientific (yield) method.",
    ["concept_recognition", "formula_retrieval"],
    "Write-downs follow the interest at the yield rate on the book value; they grow geometrically, not linearly.",
    "Amortization in coupon t = (Fr − Cj)·v^(n − t + 1)."
  ),
  MODEL_CONSTANT_FORCE: entry(
    "INCORRECT_MODEL",
    "Varying force of interest treated as constant",
    "A time-varying force of interest was treated as constant at one of its values.",
    ["concept_recognition", "formula_selection"],
    "When δ depends on t, the accumulation factor is exp(∫ δ_t dt) over the actual interval.",
    "a(t₁, t₂) = exp(∫_{t₁}^{t₂} δ_s ds)."
  ),
  MODEL_LEVEL_FOR_VARYING: entry(
    "INCORRECT_MODEL",
    "Varying payments treated as level",
    "A non-level payment stream was valued as if every payment were the same size.",
    ["concept_recognition", "formula_selection"],
    "Check whether the payments change; if they do, the level annuity factor alone cannot be used.",
    "A changing stream needs a varying-annuity factor or a decomposition into level pieces."
  ),
  MODEL_IGNORED_COUPON: entry(
    "INCORRECT_MODEL",
    "Coupon of the longer bond ignored",
    "A coupon paid before maturity by a longer bond was left out of the earlier cash-flow position.",
    ["cashflow_modelling", "concept_recognition"],
    "List every asset's cash flow at every date in a table before matching anything.",
    "Cash-flow matching works backwards: the longest asset's interim coupons reduce what shorter assets must supply."
  ),

  // ------------------------------------------------------------ formula
  FORMULA_AV_FOR_PV: entry(
    "INCORRECT_FORMULA",
    "Accumulated-value factor used for a present value",
    "s(n) was used where a(n) was needed (or vice versa).",
    ["formula_selection", "formula_retrieval"],
    "Identify the valuation date first: a values one period before the first payment, s values at the last payment.",
    "s(n) = (1 + i)^n · a(n)."
  ),
  FORMULA_MODIFIED_FOR_MACAULAY: entry(
    "INCORRECT_FORMULA",
    "Modified and Macaulay duration confused",
    "Macaulay duration was used where modified duration was required, or vice versa.",
    ["formula_selection", "formula_retrieval"],
    "Price-change approximations ΔP ≈ −P·D_mod·Δi use modified duration; immunization matching uses Macaulay.",
    "D_mod = D_mac / (1 + i)."
  ),
  FORMULA_CURRENT_YIELD: entry(
    "INCORRECT_FORMULA",
    "Current yield used as the yield rate",
    "Coupon ÷ price was taken as the yield, ignoring the gain or loss at redemption.",
    ["formula_selection", "concept_recognition"],
    "A yield rate must make the price equal to the PV of every future cash flow, redemption included.",
    "Yield j solves P = Fr·a(n)_j + C·v_j^n."
  ),
  FORMULA_APPROX_REAL: entry(
    "INCORRECT_FORMULA",
    "Real rate approximated as i − r",
    "The real rate was taken as the difference between the nominal rate and inflation.",
    ["formula_selection", "formula_reconstruction"],
    "Purchasing power grows by (1 + i)/(1 + r) each year; i − r is only a first-order approximation.",
    "1 + i_real = (1 + i)/(1 + r)."
  ),
  FORMULA_ARITHMETIC_FORWARD: entry(
    "INCORRECT_FORMULA",
    "Forward rate as a difference of spot rates",
    "The forward rate was taken as a linear combination of spot rates instead of a ratio of accumulation factors.",
    ["formula_selection", "formula_reconstruction"],
    "Forward rates come from no-arbitrage: investing to t₂ directly must equal investing to t₁ and rolling forward.",
    "(1 + s₂)^t₂ = (1 + s₁)^t₁ (1 + f)^(t₂ − t₁)."
  ),
  FORMULA_MACAULAY_CONVEXITY: entry(
    "INCORRECT_FORMULA",
    "Macaulay convexity used for convexity",
    "Σ t²·w_t was computed instead of P''/P = Σ t(t+1) v^(t+2) CF / P.",
    ["formula_selection", "formula_retrieval"],
    "Check which convexity is defined: the derivative-based P''/P carries t(t+1) and an extra v².",
    "C = P''(i)/P(i) = Σ t(t+1) CF_t v^(t+2) / P."
  ),
  FORMULA_PERPETUITY_FOR_FINITE: entry(
    "INCORRECT_FORMULA",
    "Perpetuity formula used for a finite stream",
    "A finite annuity was treated as a perpetuity (or the reverse).",
    ["formula_selection", "concept_recognition"],
    "Check whether the payments stop. A finite stream is a perpetuity minus a deferred perpetuity.",
    "a(n) = (1 − v^n)/i, which tends to 1/i only as n → ∞."
  ),
  FORMULA_DECREASING_FOR_INCREASING: entry(
    "INCORRECT_FORMULA",
    "Decreasing-annuity formula used for an increasing stream (or vice versa)",
    "The wrong varying-annuity factor was applied.",
    ["formula_selection", "formula_reconstruction"],
    "Write the first two payments down. Rising payments: (Ia). Falling payments: (Da).",
    "(Ia)(n) = (ä(n) − n v^n)/i;  (Da)(n) = (n − a(n))/i."
  ),

  // ------------------------------------------------------------ variable interpretation
  VAR_INTEREST_FOR_PRINCIPAL: entry(
    "VARIABLE_INTERPRETATION",
    "Interest and principal components swapped",
    "The interest portion was reported where the principal portion was asked for (or vice versa).",
    ["translation", "concept_recognition"],
    "Underline which component the question asks for before calculating.",
    "Payment = interest (i × previous balance) + principal repaid."
  ),
  VAR_OTHER_UNKNOWN: entry(
    "VARIABLE_INTERPRETATION",
    "Solved for the other unknown",
    "The equation was solved correctly but the answer reported is a different quantity from the one asked for.",
    ["translation"],
    "Define the unknown in words (“x = amount deposited in fund A”) and re-read the question before answering.",
    "The final step must answer the question asked, not the variable that was convenient to solve for."
  ),
  VAR_TOTAL_FOR_COMPONENT: entry(
    "VARIABLE_INTERPRETATION",
    "Total reported instead of a component",
    "An accumulated value, total payment or total amount was reported where only part of it (interest, principal, gain) was asked for.",
    ["translation"],
    "“Interest earned” is accumulated value minus deposits; “amount of principal” excludes interest.",
    "Quantity asked = total − the parts that are not asked for."
  ),
  VAR_ORIGINAL_FOR_OUTSTANDING: entry(
    "VARIABLE_INTERPRETATION",
    "Original amount used instead of the outstanding balance",
    "The original principal was used where the balance outstanding at that date was required.",
    ["translation", "cashflow_modelling"],
    "At any later date, the amount still owed is the balance, not the original loan.",
    "Refinance, payoff and interest calculations all start from the current balance."
  ),
  VAR_FACE_FOR_PRICE: entry(
    "VARIABLE_INTERPRETATION",
    "Face amount used instead of price",
    "A bond's face or redemption amount was used where its price (cost) was needed.",
    ["translation", "concept_recognition"],
    "Face sets the coupons and redemption; the amount invested is the price.",
    "Amount invested = price; coupon = face × coupon rate."
  ),

  // ------------------------------------------------------------ allocation
  ALLOC_AGGREGATE_AS_EACH: entry(
    "ALLOCATION",
    "Combined amount treated as each component's amount",
    "A total that belongs to several accounts together was applied to a single account.",
    ["translation", "financial_intuition"],
    "When a figure is “combined” or “total”, write it as a sum of unknown parts: I_A + I_B = total.",
    "An aggregate constrains the sum of the parts, not each part."
  ),
  ALLOC_EVEN_SPLIT: entry(
    "ALLOCATION",
    "Aggregate split evenly",
    "A total was divided equally among components that earn at different rates.",
    ["translation", "financial_intuition"],
    "Components with different rates or times do not share a total equally; let the equation decide the split.",
    "Split = solution of the equation of value, not total / number of parts."
  ),
  ALLOC_SWAPPED: entry(
    "ALLOCATION",
    "Components assigned to the wrong rate",
    "The two components were attached to each other's rates or maturities.",
    ["translation"],
    "Label each unknown with its rate or maturity as you define it.",
    "Each unknown carries its own rate and timing through the whole equation."
  ),

  // ------------------------------------------------------------ translation
  TRANS_INVERTED_RELATION: entry(
    "TRANSLATION",
    "Relationship written the wrong way round",
    "A comparative statement (“X is k times Y”, “X exceeds Y by d”) was translated in reverse.",
    ["translation"],
    "Substitute a simple test value into your equation and check it reads the same as the sentence.",
    "“A is k times B” → A = kB."
  ),
  TRANS_IGNORED_CONDITION: entry(
    "TRANSLATION",
    "One condition left out",
    "One of the stated conditions was never written into the equations.",
    ["translation", "simultaneous_equations", "multistep"],
    "Number every condition in the question and tick each one off as it enters an equation.",
    "Each independent condition is one equation; n unknowns need n conditions."
  ),
  TRANS_IRRELEVANT_INFO: entry(
    "TRANSLATION",
    "Irrelevant information used",
    "A figure that does not affect the quantity asked for was built into the calculation.",
    ["translation", "concept_recognition"],
    "Before using a number, say what cash flow or condition it describes and whether that flow affects the answer.",
    "Only cash flows that affect the quantity asked for belong in its equation of value."
  ),

  // ------------------------------------------------------------ algebra
  ALG_SIGN_ERROR: entry(
    "ALGEBRA",
    "Sign error",
    "A term changed sign during rearrangement.",
    ["algebra"],
    "After rearranging, substitute your answer back into the original equation.",
    "Moving a term across the equals sign changes its sign; nothing else does."
  ),
  ALG_INVERTED_RATIO: entry(
    "ALGEBRA",
    "Ratio inverted",
    "A ratio was inverted while solving (for example v^n read as (1 + i)^n).",
    ["algebra"],
    "Check the direction: discounting makes values smaller, accumulating makes them larger.",
    "v = 1/(1 + i); dividing by v multiplies by (1 + i)."
  ),
  ALG_ROOT_ERROR: entry(
    "ALGEBRA",
    "Wrong root or power when solving for a rate",
    "The rate was extracted with the wrong root (for example the n-th root where the k-th was needed).",
    ["algebra"],
    "Write the exponent that sits on (1 + i) and take exactly that root.",
    "If (1 + i)^k = R, then i = R^(1/k) − 1."
  ),
  ALG_DIVIDE_ERROR: entry(
    "ALGEBRA",
    "Divided instead of multiplied",
    "A factor was applied in the wrong direction while isolating the unknown.",
    ["algebra"],
    "Isolate the unknown one operation at a time and check the units of the result.",
    "If X·a = PV then X = PV / a."
  ),

  // ------------------------------------------------------------ arithmetic
  ARITH_ROUNDED_RATE: entry(
    "ARITHMETIC",
    "Rate rounded too early",
    "An intermediate rate was rounded before compounding over many periods.",
    ["arithmetic"],
    "Keep at least six significant figures in any rate that is raised to a power.",
    "Rounding errors in a rate grow with the exponent."
  ),
  ARITH_ORDER_OF_OPERATIONS: entry(
    "ARITHMETIC",
    "Order of operations",
    "The right formula was set up but evaluated in the wrong order (for example 1 − v^n/i instead of (1 − v^n)/i).",
    ["arithmetic"],
    "Evaluate the numerator in full before dividing; use calculator memory or brackets.",
    "a(n) = (1 − v^n) / i: the subtraction comes first."
  ),

  // ------------------------------------------------------------ sequence and series
  SEQ_GEOMETRIC_AS_ARITHMETIC: entry(
    "SEQUENCE_SERIES",
    "Geometric growth treated as arithmetic",
    "Payments growing by a percentage were modelled as growing by a fixed amount.",
    ["concept_recognition", "formula_reconstruction"],
    "“Increase by 3% per year” multiplies; “increase by 300 per year” adds.",
    "Geometric: P(1 + g)^(t−1). Arithmetic: P + (t − 1)Q."
  ),
  SEQ_ARITHMETIC_AS_GEOMETRIC: entry(
    "SEQUENCE_SERIES",
    "Arithmetic growth treated as geometric",
    "Payments increasing by a fixed amount were modelled as growing by a percentage.",
    ["concept_recognition", "formula_reconstruction"],
    "A fixed increment adds; only a percentage change multiplies.",
    "Arithmetic: P + (t − 1)Q; split into a level stream plus Q·(Ia)."
  ),
  SEQ_TERM_COUNT: entry(
    "SEQUENCE_SERIES",
    "Wrong number of terms",
    "The series was summed over one term too many or too few.",
    ["formula_reconstruction", "arithmetic"],
    "Count terms as (last index − first index) + 1, or list the first and last payment dates.",
    "Payments at times a, a+1, ..., b number b − a + 1."
  ),
  SEQ_GROWTH_RATE_DIFFERENCE: entry(
    "SEQUENCE_SERIES",
    "Growing stream discounted at i − g",
    "A geometrically growing stream was valued as a level stream at the rate i − g.",
    ["formula_reconstruction", "formula_selection"],
    "Divide each payment's growth out of the discount factor: (1 + g)/(1 + i) per period, so the equivalent rate is (1 + i)/(1 + g) − 1, not i − g.",
    "PV of 1, (1+g), ..., (1+g)^(n−1) at times 1..n = [1 − ((1+g)/(1+i))^n]/(i − g)."
  ),
  SEQ_UNDISCOUNTED_SUM: entry(
    "SEQUENCE_SERIES",
    "Payments summed without discounting",
    "The payments were added at face value, ignoring when each is paid.",
    ["concept_recognition", "financial_intuition"],
    "Amounts at different dates cannot be added until they are moved to one date.",
    "Value = Σ CF_t v^t, not Σ CF_t."
  ),

  // ------------------------------------------------------------ rate conversion
  RATE_NOMINAL_AS_EFFECTIVE: entry(
    "RATE_CONVERSION",
    "Nominal rate used as an effective rate",
    "A nominal annual rate convertible m times a year was used directly as an annual effective rate.",
    ["formula_retrieval", "cashflow_modelling"],
    "“Convertible monthly” means the rate per month is i^(12)/12; the annual effective rate is (1 + i^(12)/12)^12 − 1.",
    "1 + i = (1 + i^(m)/m)^m."
  ),
  RATE_DIVIDED_EFFECTIVE: entry(
    "RATE_CONVERSION",
    "Effective annual rate divided by m",
    "An annual effective rate was divided by the number of payments per year to get a periodic rate.",
    ["formula_retrieval", "cashflow_modelling"],
    "Only nominal rates divide by m. An effective annual rate converts by a root: (1 + i)^(1/m) − 1.",
    "Periodic rate equivalent to annual effective i: (1 + i)^(1/m) − 1."
  ),
  RATE_DISCOUNT_AS_INTEREST: entry(
    "RATE_CONVERSION",
    "Discount rate used as an interest rate",
    "A rate of discount was used as if it were a rate of interest.",
    ["formula_retrieval", "concept_recognition"],
    "A discount rate is applied to the end-of-period value: v = 1 − d, so i = d/(1 − d).",
    "i = d/(1 − d);  d = i/(1 + i)."
  ),
  RATE_ANNUAL_FOR_PERIODIC: entry(
    "RATE_CONVERSION",
    "Annual rate applied per period",
    "An annual rate was applied to each shorter period (for example a full annual coupon rate per half-year).",
    ["formula_retrieval", "cashflow_modelling"],
    "Match every rate to the period of the cash flows before using it.",
    "Semiannual coupon = face × (annual coupon rate)/2; semiannual yield = i^(2)/2."
  ),
  RATE_PAYMENT_FREQUENCY: entry(
    "RATE_CONVERSION",
    "Annual payment divided by the payment frequency",
    "An annual payment was converted to a monthly (or quarterly) payment by dividing by m, ignoring interest earned within the year.",
    ["formula_retrieval", "cashflow_modelling"],
    "When payments are monthly, work in months: a monthly rate and a monthly payment count.",
    "Monthly payment = PV / a(12n) at the monthly rate, not (annual payment)/12."
  ),
  RATE_FORCE_AS_EFFECTIVE: entry(
    "RATE_CONVERSION",
    "Force of interest used as an effective rate",
    "A force of interest δ was used as if it were an effective rate i.",
    ["formula_retrieval", "concept_recognition"],
    "Force of interest accumulates as e^(δt), not (1 + δ)^t.",
    "1 + i = e^δ."
  ),

  // ------------------------------------------------------------ conceptual
  CONC_PAR_ASSUMPTION: entry(
    "CONCEPTUAL",
    "Bond assumed to trade at par",
    "The price was taken as the face amount, which is only true when the coupon rate equals the yield.",
    ["concept_recognition", "financial_intuition"],
    "Compare coupon rate with yield: higher coupon → premium; lower coupon → discount.",
    "P = C + (Fr − Cj)·a(n): price equals redemption only if Fr = Cj."
  ),
  CONC_IGNORED_REDEMPTION: entry(
    "CONCEPTUAL",
    "Redemption payment ignored",
    "Only the coupons were valued; the redemption amount at maturity was left out.",
    ["concept_recognition", "cashflow_modelling"],
    "A bond is a level annuity of coupons plus a single payment at maturity. Value both.",
    "P = Fr·a(n) + C·v^n."
  ),
  CONC_PRICE_YIELD_DIRECTION: entry(
    "CONCEPTUAL",
    "Price moves the same way as yield",
    "The direction of the price change was reversed: prices fall when yields rise.",
    ["financial_intuition", "concept_recognition"],
    "Higher discount rates shrink present values. Check the sign of your ΔP against Δi.",
    "ΔP ≈ −P · D_mod · Δi."
  ),
  CONC_REAL_NOMINAL_MIX: entry(
    "CONCEPTUAL",
    "Real and nominal amounts mixed",
    "A real (inflation-adjusted) rate was applied to amounts fixed in nominal terms, or the reverse.",
    ["concept_recognition", "financial_intuition"],
    "Ask whether each amount is fixed in today's money (real) or in future money (nominal), and use the matching rate.",
    "Discount nominal amounts at the nominal rate; discount real (indexed) amounts at the real rate."
  ),
  CONC_RETURN_ON_WRONG_BASE: entry(
    "CONCEPTUAL",
    "Return measured on the wrong base",
    "A rate of return was calculated against an amount that was not the capital actually invested over the period.",
    ["concept_recognition", "financial_intuition"],
    "A rate of return compares what you got back with what you put in, at the same dates.",
    "The yield of an investment equates PV of outlays with PV of receipts."
  ),
} as const satisfies Record<string, Misconception>;

export const MISCONCEPTIONS = {
  ...CORE_MISCONCEPTIONS,
  ...SHARED_CONCEPT_MISCONCEPTIONS,
  ...TVM_CONCEPT_MISCONCEPTIONS,
  ...ANNUITY_CONCEPT_MISCONCEPTIONS,
  ...LOAN_CONCEPT_MISCONCEPTIONS,
  ...BOND_CONCEPT_MISCONCEPTIONS,
  ...ALM_CONCEPT_MISCONCEPTIONS,
  ...COMPOSITE_MISCONCEPTIONS,
  ...CHALLENGE_MISCONCEPTIONS,
} as const satisfies Record<string, Misconception>;

export type MisconceptionId = keyof typeof MISCONCEPTIONS;

function assertUniqueIds(): void {
  const groups = [CORE_MISCONCEPTIONS, SHARED_CONCEPT_MISCONCEPTIONS, TVM_CONCEPT_MISCONCEPTIONS, ANNUITY_CONCEPT_MISCONCEPTIONS, LOAN_CONCEPT_MISCONCEPTIONS, BOND_CONCEPT_MISCONCEPTIONS, ALM_CONCEPT_MISCONCEPTIONS, COMPOSITE_MISCONCEPTIONS, CHALLENGE_MISCONCEPTIONS];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const id of Object.keys(group)) {
      if (seen.has(id)) throw new Error(`Misconception id ${id} is defined twice.`);
      seen.add(id);
    }
  }
}

assertUniqueIds();

export function getMisconception(id: string): Misconception | undefined {
  return (MISCONCEPTIONS as Record<string, Misconception>)[id];
}
