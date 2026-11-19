import { entry, type Misconception } from "../misconception-kit";

/** Conceptual misunderstandings that cut across syllabus topics. */
export const SHARED_CONCEPT_MISCONCEPTIONS = {
  CONC_OUTSIDE_ASSUMPTIONS: entry(
    "CONCEPTUAL",
    "Formula applied outside its assumptions",
    "A formula was used although one of the conditions it is derived under (level payments, a flat yield curve, a constant rate, payments coinciding with interest conversion) does not hold.",
    ["formula_selection", "concept_recognition"],
    "Before using a closed form, list the conditions it needs and check each one against the question.",
    "A closed form is a shortcut for an equation of value under specific conditions; when a condition fails, return to the explicit cash flows."
  ),
  CONC_RELATED_TERM: entry(
    "CONCEPTUAL",
    "A related term taken for the one defined",
    "The definition chosen belongs to a neighbouring quantity with a similar name (for example, a nominal rate for an effective rate, book value for price, Macaulay for modified duration).",
    ["concept_recognition"],
    "Name the quantity precisely, including its date, its rate basis and whose perspective it takes.",
    "Each actuarial quantity is pinned down by what it measures, at which date and on which rate basis."
  ),
  CONC_NECESSARY_AS_SUFFICIENT: entry(
    "CONCEPTUAL",
    "A necessary condition treated as sufficient",
    "One condition that must hold was taken to guarantee the result on its own.",
    ["concept_recognition", "financial_intuition"],
    "Ask whether the conclusion could still fail with the condition satisfied; if yes, the condition is not sufficient.",
    "A result that needs several conditions holds only when all of them hold."
  ),
  CONC_DOUBLE_COUNTED: entry(
    "TIMING",
    "Cash flow omitted or counted twice",
    "A payment at the boundary between two pieces of a stream was left out or included in both pieces.",
    ["cashflow_modelling", "valuation_dates"],
    "List the payment dates of each piece explicitly and check that every payment appears exactly once.",
    "When a stream is split, the pieces must partition its payment dates."
  ),
  CONC_DIRECTION_REVERSED: entry(
    "CONCEPTUAL",
    "Direction of an effect reversed",
    "The quantity was judged to move in the opposite direction to the one the relationship implies.",
    ["financial_intuition", "concept_recognition"],
    "Hold everything else fixed and ask what happens to each present value when the changed quantity rises.",
    "Present values fall as the discount rate rises and as payments move later; accumulated values do the opposite."
  ),
  CONC_MOVED_WRONG_WAY: entry(
    "TIMING",
    "Cash flow moved in the wrong direction",
    "A payment was discounted when it needed to be accumulated to a later date, or accumulated when it needed to be discounted.",
    ["valuation_dates", "cashflow_modelling"],
    "Moving a value later multiplies by (1 + i) per period; moving it earlier multiplies by v.",
    "Value at T of a payment at t is CF·(1 + i)^(T − t), whatever the sign of T − t."
  ),
} as const satisfies Record<string, Misconception>;
