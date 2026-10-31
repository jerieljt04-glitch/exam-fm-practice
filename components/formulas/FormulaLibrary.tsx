"use client";

import React, { useMemo, useState } from "react";

import { FormulaCard } from "@/components/formulas/FormulaCard";
import { FORMULAS } from "@/lib/formulas/registry";
import { AREA_LABELS, type FormulaArea } from "@/lib/formulas/types";
import { cn } from "@/lib/utils";

const AREAS = Object.keys(AREA_LABELS) as FormulaArea[];

/**
 * Searchable formula library. `highlight` lists formula ids to offer as a
 * "this question" filter (formula-supported mode); they are shown in
 * alphabetical order so the order of use is not revealed.
 */
export function FormulaLibrary({ compact = false, highlight }: { compact?: boolean; highlight?: string[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<FormulaArea | "all" | "question">(highlight?.length ? "question" : "all");
  const [flag, setFlag] = useState<"all" | "discrepancy" | "unclear">("all");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULAS.filter((f) => {
      if (area === "question") {
        if (!highlight?.includes(f.id)) return false;
      } else if (area !== "all" && f.area !== area) return false;
      if (flag === "discrepancy" && !f.discrepancy) return false;
      if (flag === "unclear" && f.relevance !== "unclear") return false;
      if (!q) return true;
      return [f.name, f.id, f.meaning, f.expression, ...f.applications, ...f.variables.map((v) => v.meaning)].some((s) => s.toLowerCase().includes(q));
    }).sort((a, b) => (area === "question" ? a.name.localeCompare(b.name) : 0));
  }, [query, area, flag, highlight]);

  const select = (id: string) => {
    setArea("all");
    setFlag("all");
    setQuery("");
    requestAnimationFrame(() => document.getElementById(`f-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search formulas, symbols, uses…"
          aria-label="Search formulas"
          className="h-9 min-w-0 flex-1 rounded-md border bg-card px-3"
        />
        <select className="h-9 rounded-md border bg-card px-2" value={area} onChange={(e) => setArea(e.target.value as typeof area)} aria-label="Area">
          {highlight?.length ? <option value="question">Formulas for this question</option> : null}
          <option value="all">All areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a === "M" ? "" : `${a}. `}
              {AREA_LABELS[a]}
            </option>
          ))}
        </select>
        {!compact && (
          <select className="h-9 rounded-md border bg-card px-2" value={flag} onChange={(e) => setFlag(e.target.value as typeof flag)} aria-label="Flags">
            <option value="all">All formulas</option>
            <option value="discrepancy">Sheets differ</option>
            <option value="unclear">Relevance unclear</option>
          </select>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {list.length} of {FORMULAS.length} formulas
        {area === "question" && " — listed alphabetically, not in the order they are used"}
      </p>
      <div className={cn("space-y-2", compact && "max-h-[60vh] overflow-y-auto pr-1 scrollbar-slim")}>
        {list.map((f) => (
          <FormulaCard key={f.id} formula={f} compact={compact} onSelect={compact ? undefined : select} />
        ))}
        {!list.length && <p className="text-sm text-muted-foreground">No formula matches.</p>}
      </div>
    </div>
  );
}
