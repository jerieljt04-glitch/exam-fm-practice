"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";

import { MathRenderer } from "./MathRenderer";
import { FORMULA_SECTIONS } from "@/lib/math/reference-formulas";
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
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden border border-white/15 bg-slate-950/85 p-0 shadow-2xl shadow-black/80">
        <DialogHeader className="border-b border-white/10 bg-slate-900/60 px-6 py-4 text-left sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">Formula Reference Sheet</DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Standard Exam FM financial mathematics formulas for study and reference.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b border-white/10 bg-slate-900/40 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search formulas — try duration, perpetuity, or amortization..."
              className="pl-10 border-white/10 bg-slate-950/50"
              aria-label="Search formulas"
            />
          </div>
        </div>

        <div className="scrollbar-slim flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {filteredSections.map((section) => (
            <section key={section.title} className="space-y-2.5">
              <h3 className="border-b border-white/10 pb-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {section.formulas.map((formula) => (
                  <div
                    key={formula.name}
                    className="group rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 hover:border-blue-400/35 hover:bg-slate-800/60"
                  >
                    <MathRenderer
                      content={formula.name}
                      className="mb-1.5 text-xs font-semibold text-slate-300"
                    />
                    <MathRenderer
                      content={formula.latex}
                      className="scrollbar-slim overflow-x-auto text-base text-white"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {filteredSections.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">
              No formulas match “{searchTerm}”.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormulaSheetModal;
