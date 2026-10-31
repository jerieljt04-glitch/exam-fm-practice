import { FORMULAS, FORMULA_BY_ID } from "./registry";

/**
 * The formula relationship graph.
 *
 * Edges come from two places: each formula's prerequisites ("this formula is
 * built from that one"), and the formula chains of generated questions ("the
 * output of this formula was an input to that one"). The named chains below
 * are the reference examples; the bank discovers further combinations.
 */

export interface FormulaEdge {
  from: string;
  to: string;
  kind: "prerequisite" | "feeds";
}

export interface NamedChain {
  id: string;
  name: string;
  steps: { label: string; formula?: string }[];
}

export const NAMED_CHAINS: NamedChain[] = [
  {
    id: "amortization",
    name: "Amortization chain",
    steps: [
      { label: "Loan principal" },
      { label: "Annuity present value", formula: "B.annuity-immediate" },
      { label: "Periodic loan payment", formula: "D.loan-payment" },
      { label: "Interest component", formula: "D.interest-component" },
      { label: "Principal repayment", formula: "D.principal-component" },
      { label: "Outstanding balance", formula: "D.balance-recursion" },
      { label: "Prospective or retrospective valuation", formula: "D.prospective" },
    ],
  },
  {
    id: "refinancing",
    name: "Refinancing chain",
    steps: [
      { label: "Original loan", formula: "D.loan-payment" },
      { label: "Outstanding balance at the refinancing date", formula: "D.prospective" },
      { label: "New loan principal" },
      { label: "New annuity payment", formula: "B.annuity-immediate" },
      { label: "New repayment schedule", formula: "D.balance-recursion" },
      { label: "Difference in payments or present value", formula: "A.equation-of-value" },
    ],
  },
  {
    id: "bond",
    name: "Bond chain",
    steps: [
      { label: "Coupon payment" },
      { label: "Annuity present value", formula: "B.annuity-immediate" },
      { label: "Redemption value discounting", formula: "A.discount-factor" },
      { label: "Bond price", formula: "E.price" },
      { label: "Premium or discount", formula: "E.premium-discount" },
      { label: "Book value", formula: "E.book-value" },
      { label: "Bond amortization", formula: "E.bond-amortization" },
    ],
  },
  {
    id: "rates",
    name: "Interest-rate chain",
    steps: [
      { label: "Accumulation function", formula: "A.accumulation" },
      { label: "Spot rate", formula: "F.spot" },
      { label: "Forward rate", formula: "F.forward" },
      { label: "Future accumulation factor", formula: "F.forward-chain" },
      { label: "Present value of cash flows", formula: "F.spot-pricing" },
    ],
  },
  {
    id: "duration",
    name: "Duration and immunization chain",
    steps: [
      { label: "Cash-flow present values", formula: "G.price-function" },
      { label: "Macaulay duration", formula: "G.macaulay" },
      { label: "Modified duration", formula: "G.modified" },
      { label: "Convexity", formula: "G.convexity" },
      { label: "Price-change approximation", formula: "G.approx-modified" },
      { label: "Asset-liability matching", formula: "G.redington" },
      { label: "Immunization conditions", formula: "G.full-immunization" },
    ],
  },
  {
    id: "cashflow",
    name: "General cash-flow chain",
    steps: [
      { label: "Individual cash flows" },
      { label: "Equation of value", formula: "A.equation-of-value" },
      { label: "Accumulated inflows", formula: "C.reinvestment" },
      { label: "Reinvestment rate and required yield", formula: "C.yield-rate" },
      { label: "Internal rate of return or NPV", formula: "C.irr" },
    ],
  },
];

export const PREREQUISITE_EDGES: FormulaEdge[] = FORMULAS.flatMap((formula) =>
  formula.prerequisites.map((pre) => ({ from: pre, to: formula.id, kind: "prerequisite" as const }))
);

/** Every formula reachable from `id` by following prerequisite edges backwards. */
export function foundations(id: string, seen = new Set<string>()): string[] {
  for (const pre of FORMULA_BY_ID[id]?.prerequisites ?? []) {
    if (!seen.has(pre)) {
      seen.add(pre);
      foundations(pre, seen);
    }
  }
  return [...seen];
}

/** Formulas built on `id`. */
export function dependents(id: string): string[] {
  return FORMULAS.filter((formula) => formula.prerequisites.includes(id)).map((formula) => formula.id);
}

/** Consecutive pairs in a chain of formula ids: the combinations a question exercises. */
export function chainPairs(formulaIds: readonly string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let k = 1; k < formulaIds.length; k += 1) {
    if (formulaIds[k] !== formulaIds[k - 1]) pairs.push([formulaIds[k - 1], formulaIds[k]]);
  }
  return pairs;
}
