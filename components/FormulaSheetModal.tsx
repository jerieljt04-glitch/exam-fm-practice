"use client";

import React, { useState } from "react";
import { X, BookOpen, Search } from "lucide-react";
import { MathRenderer } from "./MathRenderer";

interface FormulaSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FORMULA_SECTIONS = [
  {
    title: "1. Time Value of Money",
    formulas: [
      { name: "Accumulation Function", latex: "$a(t) = (1+i)^t = (1-d)^{-t} = e^{\\delta t}$" },
      { name: "Nominal vs Effective Rates", latex: "$1 + i = \\left(1 + \\frac{i^{(m)}}{m}\\right)^m = \\left(1 - \\frac{d^{(p)}}{p}\\right)^{-p}$" },
      { name: "Discount Rate & Factor", latex: "$d = \\frac{i}{1+i} = 1 - v, \\quad v = \\frac{1}{1+i}$" },
      { name: "Variable Force of Interest", latex: "$a(t) = \\exp\\left( \\int_0^t \\delta(s) \\, ds \\right), \\quad \\delta(t) = \\frac{a'(t)}{a(t)}$" },
    ],
  },
  {
    title: "2. Annuities & Cash Flows",
    formulas: [
      { name: "Annuity-Immediate Present Value", latex: "$a_{\\overline{n}|i} = \\frac{1 - v^n}{i}$" },
      { name: "Annuity-Due Present Value", latex: "$\\ddot{a}_{\\overline{n}|i} = (1+i) a_{\\overline{n}|i} = \\frac{1 - v^n}{d}$" },
      { name: "Accumulated Values", latex: "$s_{\\overline{n}|i} = \\frac{(1+i)^n - 1}{i}, \\quad \\ddot{s}_{\\overline{n}|i} = (1+i) s_{\\overline{n}|i}$" },
      { name: "Perpetuities", latex: "$a_{\\overline{\\infty}|i} = \\frac{1}{i}, \\quad \\ddot{a}_{\\overline{\\infty}|i} = \\frac{1}{d}$" },
      { name: "Arithmetic Increasing Annuity", latex: "$(Ia)_{\\overline{n}|i} = \\frac{\\ddot{a}_{\\overline{n}|i} - n v^n}{i}$" },
      { name: "Geometric Growing Annuity", latex: "$PV = P \\left[ \\frac{1 - \\left(\\frac{1+g}{1+i}\\right)^n}{i - g} \\right]$" },
    ],
  },
  {
    title: "3. Loans & Amortization",
    formulas: [
      { name: "Level Payment Amortization", latex: "$R = \\frac{L}{a_{\\overline{n}|i}}$" },
      { name: "Prospective Outstanding Balance", latex: "$B_t = R \\cdot a_{\\overline{n-t}|i}$" },
      { name: "Retrospective Outstanding Balance", latex: "$B_t = L(1+i)^t - R \\cdot s_{\\overline{t}|i}$" },
      { name: "Principal Component in Payment $t$", latex: "$P_t = R \\cdot v^{n-t+1}$" },
      { name: "Interest Component in Payment $t$", latex: "$I_t = R(1 - v^{n-t+1}) = i \\cdot B_{t-1}$" },
    ],
  },
  {
    title: "4. Bonds",
    formulas: [
      { name: "Basic Bond Pricing", latex: "$P = Fr \\cdot a_{\\overline{n}|y} + C \\cdot v^n$" },
      { name: "Premium / Discount Formula", latex: "$P = C + (Fr - Cy) a_{\\overline{n}|y}$" },
      { name: "Makeham's Formula", latex: "$P = K + \\frac{g}{y}(C - K), \\quad K = C v^n, \\; g = \\frac{Fr}{C}$" },
      { name: "Book Value at Coupon $t$", latex: "$B_t = Fr \\cdot a_{\\overline{n-t}|y} + C \\cdot v^{n-t}$" },
      { name: "Write-Down of Premium", latex: "$p_t = (Fr - Cy) v^{n-t+1}$" },
    ],
  },
  {
    title: "5. Asset-Liability Management & Immunization",
    formulas: [
      { name: "Macaulay Duration", latex: "$D_{\\text{mac}} = \\frac{\\sum t \\cdot C_t \\cdot v^t}{\\sum C_t \\cdot v^t} = \\frac{\\sum t \\cdot C_t \\cdot v^t}{P}$" },
      { name: "Modified Duration", latex: "$D_{\\text{mod}} = v \\cdot D_{\\text{mac}} = \\frac{D_{\\text{mac}}}{1 + y}$" },
      { name: "Duration Price Sensitivity", latex: "$\\frac{\\Delta P}{P} \\approx - D_{\\text{mod}} \\cdot \\Delta y$" },
      { name: "Macaulay & Modified Convexity", latex: "$C_{\\text{mac}} = \\frac{\\sum t^2 C_t v^t}{P}, \\quad C_{\\text{mod}} = \\frac{C_{\\text{mac}} + D_{\\text{mac}}}{(1+y)^2}$" },
      { name: "Redington Immunization Conditions", latex: "$P_A = P_L, \\quad D_A = D_L, \\quad C_A > C_L$" },
    ],
  },
];

export const FormulaSheetModal: React.FC<FormulaSheetModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredSections = FORMULA_SECTIONS.map((section) => ({
    ...section,
    formulas: section.formulas.filter(
      (f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        section.title.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((s) => s.formulas.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">SOA Exam FM Reference Sheet</h2>
              <p className="text-xs text-slate-500">Official Financial Mathematics Formula Bank</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search formulas (e.g., duration, perpetuity, amortization)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Formulas list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {filteredSections.map((sec, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                {sec.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sec.formulas.map((f, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="text-xs font-medium text-slate-500 mb-1">{f.name}</div>
                    <div className="text-slate-900 text-sm overflow-x-auto">
                      <MathRenderer content={f.latex} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredSections.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No formulas matching "{searchTerm}" found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
};
