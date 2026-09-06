"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";

import { MathRenderer } from "./MathRenderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

interface FormulaSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormulaEntry {
  /** May contain inline math, e.g. the payment index $t$. */
  name: string;
  latex: string;
}

interface FormulaSection {
  title: string;
  formulas: FormulaEntry[];
}

const FORMULA_SECTIONS: FormulaSection[] = [
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
        name: "Geometric growing annuity",
        latex: "$PV = P \\left[ \\frac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i - g} \\right]$",
      },
    ],
  },
  {
    title: "3. Loans and amortization",
    formulas: [
      { name: "Level payment", latex: "$R = \\frac{L}{a_{\\overline{n}|i}}$" },
      { name: "Prospective balance", latex: "$B_t = R \\cdot a_{\\overline{n-t}|i}$" },
      { name: "Retrospective balance", latex: "$B_t = L(1+i)^t - R \\cdot s_{\\overline{t}|i}$" },
      { name: "Principal in payment $t$", latex: "$P_t = R \\cdot v^{\\,n-t+1}$" },
      {
        name: "Interest in payment $t$",
        latex: "$I_t = R\\left(1 - v^{\\,n-t+1}\\right) = i \\cdot B_{t-1}$",
      },
      {
        name: "Sinking fund outlay",
        latex: "$\\text{Outlay} = L \\cdot i + \\frac{L}{s_{\\overline{n}|j}}$",
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
      { name: "Book value after coupon $t$", latex: "$B_t = Fr \\cdot a_{\\overline{n-t}|y} + C \\cdot v^{\\,n-t}$" },
      { name: "Premium written down in coupon $t$", latex: "$p_t = (Fr - Cy)\\,v^{\\,n-t+1}$" },
      { name: "Interest earned in coupon $t$", latex: "$I_t = y \\cdot B_{t-1}$" },
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
      { name: "Price sensitivity", latex: "$\\frac{\\Delta P}{P} \\approx -D_{\\text{mod}} \\cdot \\Delta y$" },
      {
        name: "Convexity",
        latex:
          "$C_{\\text{mac}} = \\frac{\\sum t^2 C_t v^t}{P}, \\quad C_{\\text{mod}} = \\frac{C_{\\text{mac}} + D_{\\text{mac}}}{(1+y)^2}$",
      },
      {
        name: "Redington immunization",
        latex: "$P_A = P_L, \\quad D_A = D_L, \\quad C_A > C_L$",
      },
    ],
  },
];

export const FormulaSheetModal: React.FC<FormulaSheetModalProps> = ({ open, onOpenChange }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSections = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return FORMULA_SECTIONS;

    return FORMULA_SECTIONS.map((section) => ({
      ...section,
      formulas: section.formulas.filter(
        (formula) =>
          formula.name.toLowerCase().includes(query) || section.title.toLowerCase().includes(query)
      ),
    })).filter((section) => section.formulas.length > 0);
  }, [searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/50 px-6 py-4 text-left sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Formula reference sheet</DialogTitle>
              <DialogDescription>
                Standard Exam FM financial mathematics results, for study use during practice.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b bg-muted/30 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search formulas — try duration, perpetuity, or amortization"
              className="pl-9"
              aria-label="Search formulas"
            />
          </div>
        </div>

        <div className="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {filteredSections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="border-b pb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.formulas.map((formula) => (
                  <div
                    key={formula.name}
                    className="rounded-lg border bg-muted/40 p-3 transition-colors hover:border-primary/40"
                  >
                    <MathRenderer
                      content={formula.name}
                      className="mb-1 text-xs font-medium text-muted-foreground"
                    />
                    <MathRenderer
                      content={formula.latex}
                      className="scrollbar-slim overflow-x-auto text-sm text-foreground"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {filteredSections.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No formulas match “{searchTerm}”.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormulaSheetModal;
