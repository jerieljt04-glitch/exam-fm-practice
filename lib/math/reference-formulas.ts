import type { TopicDomain } from "../types/exam";

export interface FormulaEntry {
  /** May contain inline math, e.g. the payment index $t$. */
  name: string;
  latex: string;
}

export interface FormulaSection {
  title: string;
  formulas: FormulaEntry[];
}

export const FORMULA_SECTIONS: FormulaSection[] = [
  {
    title: "1. Time value of money",
    formulas: [
      {
        name: "Accumulation function",
        latex: "$a(t) = (1+i)^t = (1-d)^{-t} = e^{\\delta t}$",
      },
      {
        name: "Nominal and effective rates",
        latex:
          "$1 + i = \\left(1 + \\frac{i^{(m)}}{m}\\right)^m = \\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p}$",
      },
      {
        name: "Discount rate and discount factor",
        latex: "$d = \\frac{i}{1+i} = 1 - v, \\quad v = \\frac{1}{1+i}$",
      },
      {
        name: "Variable force of interest",
        latex: "$a(t) = \\exp\\left( \\int_0^t \\delta(s) \\, ds \\right), \\quad \\delta(t) = \\frac{a'(t)}{a(t)}$",
      },
      {
        name: "Simple interest and simple discount",
        latex: "$a(t) = 1 + it, \\quad a(t) = (1 - dt)^{-1}$",
      },
      {
        name: "Real rate of interest",
        latex: "$1 + i = (1 + i')(1 + r), \\quad i' = \\frac{i - r}{1 + r}$",
      },
    ],
  },
  {
    title: "2. Annuities and cash flows",
    formulas: [
      { name: "Annuity-immediate", latex: "$a_{\\overline{n}|i} = \\frac{1 - v^n}{i}$" },
      {
        name: "Annuity-due",
        latex: "$\\ddot{a}_{\\overline{n}|i} = (1+i)\\,a_{\\overline{n}|i} = \\frac{1 - v^n}{d}$",
      },
      {
        name: "Accumulated values",
        latex:
          "$s_{\\overline{n}|i} = \\frac{(1+i)^n - 1}{i}, \\quad \\ddot{s}_{\\overline{n}|i} = (1+i)\\,s_{\\overline{n}|i}$",
      },
      {
        name: "Continuous annuity",
        latex: "$\\bar{a}_{\\overline{n}|} = \\frac{1 - v^n}{\\delta}, \\quad \\delta = \\ln(1+i)$",
      },
      {
        name: "Perpetuities",
        latex: "$a_{\\overline{\\infty}|i} = \\frac{1}{i}, \\quad \\ddot{a}_{\\overline{\\infty}|i} = \\frac{1}{d}$",
      },
      {
        name: "Arithmetic increasing annuity",
        latex: "$(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|i} - n v^n}{i}$",
      },
      {
        name: "Arithmetic decreasing annuity",
        latex: "$(Da)_{\\overline{n}|i} = \\frac{n - a_{\\overline{n}|i}}{i}$",
      },
      {
        name: "Increasing perpetuity",
        latex: "$(Ia)_{\\overline{\\infty}|i} = \\frac{1}{i} + \\frac{1}{i^2}, \\quad (I\\ddot{a})_{\\overline{\\infty}|i} = \\frac{1}{d^2}$",
      },
      {
        name: "Geometric growing annuity",
        latex: "$PV = P \\left[ \\frac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i - g} \\right], \\quad \\text{perpetuity: } \\frac{P}{i - g}$",
      },
    ],
  },
  {
    title: "3. Loans and amortization",
    formulas: [
      { name: "Level payment", latex: "$R = \\frac{L}{a_{\\overline{n}|i}}$" },
      { name: "Prospective balance", latex: "$B_t = R \\cdot a_{\\overline{n-t}|i}$" },
      { name: "Retrospective balance", latex: "$B_t = L(1+i)^t - R \\cdot s_{\\overline{t}|i}$" },
      { name: "Principal in payment $t$", latex: "$P_t = R \\cdot v^{n-t+1}$" },
      {
        name: "Interest in payment $t$",
        latex: "$I_t = R\\left(1 - v^{n-t+1}\\right) = i \\cdot B_{t-1}$",
      },
      { name: "Total interest paid", latex: "$\\sum I_t = nR - L$" },
      {
        name: "Refinancing",
        latex: "$R' = \\frac{B_t}{a_{\\overline{n'}|i'}}$",
      },
    ],
  },
  {
    title: "4. Bonds",
    formulas: [
      { name: "Basic pricing", latex: "$P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n$" },
      { name: "Premium / discount form", latex: "$P = C + (Fr - Cy)\\,a_{\\overline{n}|y}$" },
      {
        name: "Makeham's formula",
        latex: "$P = K + \\frac{g}{y}(C - K), \\quad K = C v^n, \\quad g = \\frac{Fr}{C}$",
      },
      { name: "Book value after coupon $t$", latex: "$B_t = Fr \\cdot a_{\\overline{n-t}|y} + C \\cdot v^{n-t}$" },
      { name: "Premium written down in coupon $t$", latex: "$p_t = (Fr - Cy)\\,v^{n-t+1}$" },
      { name: "Interest earned in coupon $t$", latex: "$I_t = y \\cdot B_{t-1}$" },
      { name: "Book value recursion", latex: "$B_t = B_{t-1}(1 + y) - Fr$" },
      {
        name: "Callable bond",
        latex: "$P = \\min_{t}\\left(Fr\\,a_{\\overline{t}|y} + C_t v^t\\right) \\text{ over redemption dates } t$",
      },
    ],
  },
  {
    title: "5. Asset-liability management",
    formulas: [
      {
        name: "Macaulay duration",
        latex: "$D_{\\text{mac}} = \\frac{\\sum t \\cdot C_t \\cdot v^t}{\\sum C_t \\cdot v^t}$",
      },
      {
        name: "Modified duration",
        latex: "$D_{\\text{mod}} = v \\cdot D_{\\text{mac}} = \\frac{D_{\\text{mac}}}{1 + y}$",
      },
      {
        name: "Spot and forward rates",
        latex: "$PV = \\sum \\frac{C_t}{(1 + s_t)^t}, \\quad (1 + s_{t+1})^{t+1} = (1 + s_t)^t (1 + f_{t,t+1})$",
      },
      {
        name: "First-order modified approximation",
        latex: "$P(i) \\approx P(i_0)\\left[1 - (i - i_0)\\,D_{\\text{mod}}(i_0)\\right]$",
      },
      {
        name: "First-order Macaulay approximation",
        latex: "$P(i) \\approx P(i_0)\\left(\\frac{1 + i_0}{1 + i}\\right)^{D_{\\text{mac}}(i_0)}$",
      },
      {
        name: "Convexity",
        latex:
          "$C_{\\text{mac}} = \\frac{\\sum t^2 C_t v^t}{P}, \\quad C_{\\text{mod}} = \\frac{C_{\\text{mac}} + D_{\\text{mac}}}{(1+y)^2}$",
      },
      {
        name: "Redington immunization",
        latex: "$P_A = P_L, \\quad D_A = D_L, \\quad C_A > C_L$",
      },
      {
        name: "Full immunization (single liability at $T$)",
        latex: "$P_A = P_L, \\quad D_A = T, \\quad \\text{asset flows before and after } T$",
      },
    ],
  },
];

export const DOMAIN_FORMULAS: Record<TopicDomain, string> = {
  TIME_VALUE_OF_MONEY: "a(t) = \\exp\\left(\\int_0^t \\delta(s)\\,ds\\right)",
  ANNUITIES: "(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|i} - n v^n}{i}",
  LOANS: "P_t = R \\cdot v^{n-t+1}",
  BONDS: "P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n",
  ALM_IMMUNIZATION: "D_{\\text{mac}} = \\frac{\\sum t\\,C_t v^t}{P}",
};
