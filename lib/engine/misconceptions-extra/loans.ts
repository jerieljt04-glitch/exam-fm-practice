import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings specific to this syllabus topic (extended by the concept bank). */
export const LOAN_CONCEPT_MISCONCEPTIONS = {
  CONC_LOAN_INTEREST_ON_CLOSING: entry(
    "TIMING",
    "Interest charged on the closing balance",
    "The interest in a payment was computed on the balance just after that payment instead of the balance at the start of the period.",
    ["cashflow_modelling", "valuation_dates"],
    "Interest for period t accrues on the balance outstanding during period t, which is the balance just after payment t − 1.",
    "I_t = i · B_{t−1}; the payment at the end of the period cannot reduce the balance on which that period's interest accrued."
  ),
  CONC_LOAN_PRINCIPAL_LEVEL: entry(
    "CONCEPTUAL",
    "Principal portions assumed equal",
    "A level-payment loan was treated as repaying the same amount of principal every period (L/n, or the first principal portion each time).",
    ["concept_recognition", "financial_intuition"],
    "Level payments mean level totals, not level principal: as the balance falls, less of each payment goes to interest and more to principal.",
    "With level payments the principal portions grow by the factor 1 + i each period: R_t = R_1 (1 + i)^{t−1}."
  ),
  CONC_LOAN_SCHEDULE_REVERSED: entry(
    "TIMING",
    "Amortization pattern read in reverse",
    "The principal pattern was reversed in time, as if the early payments repaid the most principal (for example Pv^t instead of Pv^{n−t+1}).",
    ["cashflow_modelling", "concept_recognition"],
    "Check the last payment: it repays almost all principal (Pv), and the first payment repays the least (Pv^n).",
    "The principal portion of payment t is R_t = P v^{n−t+1}, so it is smallest at the start of the term and largest at the end."
  ),
  CONC_LOAN_BALANCE_AS_PRINCIPAL_PAID: entry(
    "VARIABLE_INTERPRETATION",
    "Outstanding balance confused with principal repaid",
    "The balance still owed was read as the principal already repaid, or the reverse.",
    ["concept_recognition", "translation"],
    "The two add up to the original loan: principal repaid to date = L − B_k.",
    "B_k is what remains owed just after payment k; the principal repaid so far is L − B_k."
  ),
  CONC_LOAN_RETRO_WITHOUT_INTEREST: entry(
    "INCORRECT_MODEL",
    "Balance as loan minus payments, without interest",
    "The outstanding balance was taken as the loan amount less the payments made, ignoring the interest that accrued on the loan and the payments.",
    ["cashflow_modelling", "financial_intuition"],
    "A retrospective balance needs both sides moved to the same date with interest: L(1 + i)^k − P s_k.",
    "Retrospective balance: the loan accumulated to time k less the payments accumulated to time k."
  ),
  CONC_LOAN_BEFORE_AFTER_PAYMENT: entry(
    "TIMING",
    "Balance just before and just after a payment confused",
    "The balance just after a payment was used where the balance just before the next payment (one period's interest later) was needed, or the reverse.",
    ["valuation_dates", "cashflow_modelling"],
    "Ask whether the payment due at that date has been made: just before payment k + 1 the balance is B_k(1 + i).",
    "Just before a payment the balance includes that payment; just after, it does not: B_k(1 + i) − P = B_{k+1}."
  ),
  CONC_LOAN_IRREGULAR_FINAL_IGNORED: entry(
    "INCORRECT_MODEL",
    "Irregular payment ignored in the prospective balance",
    "The prospective balance was computed as if every remaining payment were the regular amount, although one of them (a drop or balloon payment) differs.",
    ["formula_selection", "cashflow_modelling"],
    "Before writing P a_{n−k}, check that every remaining payment really is P.",
    "The prospective balance is the present value of the actual remaining payments, including any irregular final payment."
  ),
  CONC_LOAN_DROP_BALLOON_CONFUSED: entry(
    "CONCEPTUAL",
    "Drop and balloon payments confused",
    "A final payment smaller than the regular payment (drop) was treated as one added to the last regular payment (balloon), or the reverse.",
    ["concept_recognition"],
    "A drop payment comes one period after the last regular payment and is smaller; a balloon payment replaces the last regular payment and is larger.",
    "Whatever its name, a final payment equals the balance just before it is paid."
  ),
  CONC_LOAN_PRORATED_FINAL: entry(
    "INCORRECT_MODEL",
    "Final payment prorated from the fractional term",
    "The final payment was taken as the fractional part of the unrounded term times the regular payment.",
    ["cashflow_modelling", "financial_intuition"],
    "The fractional part of an annuity term has no direct meaning as a payment; find the balance and accumulate it to the final payment date.",
    "The final payment equals the balance just after the last regular payment, accumulated to the date of the final payment."
  ),
  CONC_LOAN_BALANCE_INTEREST_CONFUSED: entry(
    "INCORRECT_MODEL",
    "Change in balance taken as change in interest",
    "The fall in the interest portion from one payment to the next was taken as the whole principal repaid, instead of interest on that principal.",
    ["translation", "concept_recognition"],
    "Interest is i times the balance, so a fall of R in the balance lowers the next interest by iR, not by R.",
    "I_{t+1} = i B_t = i(B_{t−1} − R_t) = I_t − i R_t."
  ),
  CONC_LOAN_INTEREST_GEOMETRIC: entry(
    "SEQUENCE_SERIES",
    "Interest portions assumed to fall geometrically",
    "Because the principal portions grow by the factor 1 + i, the interest portions were assumed to fall by the factor v.",
    ["concept_recognition", "algebra"],
    "Only the principal portions form a geometric sequence; the interest portions are P minus those, so they fall by different amounts.",
    "With level payments I_t = P − R_t, so I_{t+1} = I_t − iR_t."
  ),
  CONC_LOAN_PRICE_IS_BALANCE: entry(
    "VARIABLE_INTERPRETATION",
    "Sale price of the remaining payments taken as the balance",
    "A buyer's price for the remaining loan payments was taken as the outstanding balance, although the buyer discounts at a different yield.",
    ["concept_recognition", "valuation_dates"],
    "Ask at which rate the remaining payments are being valued: the borrower's balance uses the loan rate, the buyer's price uses the buyer's yield.",
    "Price = PV of the remaining payments at the buyer's yield; it equals the balance only when that yield equals the loan rate."
  ),
  CONC_LOAN_REFI_OLD_RATE: entry(
    "INCORRECT_MODEL",
    "New loan amortized at the old rate",
    "The refinanced balance was spread over the new term at the original loan rate instead of the new rate.",
    ["formula_selection", "translation"],
    "The old rate values the balance being replaced; the new rate amortizes the new loan.",
    "New payment = (balance at the old rate) / a_{m} at the new rate."
  ),
  CONC_LOAN_TOTAL_INTEREST_FIXED: entry(
    "CONCEPTUAL",
    "Total interest judged from the rate alone",
    "The total interest paid was judged from the interest rate alone, ignoring how quickly the principal is repaid.",
    ["financial_intuition", "concept_recognition"],
    "Total interest depends on how long each unit of principal stays outstanding, so it changes with the term and the payment pattern.",
    "Total interest = total payments − principal; a lower rate over a longer term can still cost more interest in total."
  ),
  CONC_LOAN_DEPENDENT_EQUATIONS: entry(
    "TRANSLATION",
    "Dependent facts counted as independent equations",
    "Two pieces of information that follow from each other were counted as two independent equations for two unknowns.",
    ["translation", "algebra"],
    "Before counting equations, ask whether one fact can be derived from the other and what is already known.",
    "Each unknown needs one independent equation; a fact implied by the others adds nothing."
  ),
  CONC_LOAN_RETRO_PROSP_DIFFER: entry(
    "CONCEPTUAL",
    "Retrospective and prospective balances thought to differ",
    "The retrospective and prospective forms of the balance were thought to give different values, so a condition was imposed for them to agree.",
    ["concept_recognition"],
    "Both forms come from the same equation of value for the loan, valued at time k instead of time 0.",
    "At the loan rate, with the actual payments, retrospective and prospective balances are always equal."
  ),
} as const satisfies Record<string, Misconception>;
