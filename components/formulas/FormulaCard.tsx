"use client";

import React from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { AREA_LABELS, SOURCE_LABELS, type Formula } from "@/lib/formulas/types";
import { OUTCOMES } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

const nameOf = (id: string) => FORMULA_BY_ID[id]?.name ?? id;

export function FormulaRef({ id, onSelect }: { id: string; onSelect?: (id: string) => void }) {
  return onSelect ? (
    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => onSelect(id)}>
      {nameOf(id)}
    </button>
  ) : (
    <span>{nameOf(id)}</span>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="eyebrow mb-0.5">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((item) => (
          <li key={item}>
            <MathRenderer content={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One formula from the library, in full or compact form. */
export function FormulaCard({ formula, compact = false, onSelect, className }: { formula: Formula; compact?: boolean; onSelect?: (id: string) => void; className?: string }) {
  return (
    <article id={`f-${formula.id}`} className={cn("rounded-lg border p-3 text-sm", className)}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{formula.name}</h3>
        <span className="font-mono text-xs text-muted-foreground">{formula.id}</span>
        {!compact && <Badge>{AREA_LABELS[formula.area]}</Badge>}
        {formula.relevance === "supporting" && <Badge tone="info">supporting</Badge>}
        {formula.relevance === "unclear" && <Badge tone="warn">relevance unclear</Badge>}
        {formula.discrepancy && <Badge tone="bad">sheets differ</Badge>}
      </header>
      <div className="my-2 overflow-x-auto scrollbar-slim">
        <MathRenderer content={`$$${formula.expression}$$`} />
      </div>
      <MathRenderer content={formula.meaning} className="text-muted-foreground" />
      {compact ? (
        formula.variables.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formula.variables.map((v, idx) => (
              <React.Fragment key={v.symbol}>
                {idx > 0 && " · "}
                <MathRenderer content={`$${v.symbol}$: ${v.meaning}`} className="inline" />
              </React.Fragment>
            ))}
          </p>
        )
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            {formula.variables.length > 0 && (
              <div>
                <div className="eyebrow mb-0.5">Variables</div>
                <ul className="space-y-0.5">
                  {formula.variables.map((v) => (
                    <li key={v.symbol}>
                      <MathRenderer content={`$${v.symbol}$ — ${v.meaning}`} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <List title="Assumptions" items={formula.assumptions} />
            <List title="Conditions" items={formula.conditions} />
            <List title="Common misuse" items={formula.misuse} />
            <List title="Typical applications" items={formula.applications} />
            <div>
              <div className="eyebrow mb-0.5">Derivation</div>
              <MathRenderer content={formula.derivation} />
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="eyebrow mb-0.5">As printed on the sheets</div>
              <ul className="space-y-1.5">
                {formula.sources.map((s, idx) => (
                  <li key={idx} className="rounded-md bg-muted/60 p-2">
                    <div className="text-xs text-muted-foreground">
                      {s.doc === "DERIVED" ? SOURCE_LABELS.DERIVED : `${s.doc} · PDF page ${s.page} (${s.label}) · ${s.section}`}
                    </div>
                    <div className="overflow-x-auto scrollbar-slim">
                      <MathRenderer content={`$${s.notation}$`} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {formula.alternativeNotations.length > 0 && <List title="Alternative notation" items={formula.alternativeNotations.map((n) => `$${n}$`)} />}
            {formula.prerequisites.length > 0 && (
              <div>
                <div className="eyebrow mb-0.5">Built from</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {formula.prerequisites.map((id) => (
                    <FormulaRef key={id} id={id} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}
            {formula.related.length > 0 && (
              <div>
                <div className="eyebrow mb-0.5">Related</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {formula.related.map((id) => (
                    <FormulaRef key={id} id={id} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}
            {formula.outcomes.length > 0 && (
              <div>
                <div className="eyebrow mb-0.5">Syllabus outcomes</div>
                <ul className="list-disc pl-5 text-xs">
                  {formula.outcomes.map((o) => (
                    <li key={o}>{OUTCOMES[o]?.label ?? o}</li>
                  ))}
                </ul>
              </div>
            )}
            {formula.relevanceNote && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                <b>Relevance:</b> <MathRenderer content={formula.relevanceNote} className="inline" />
              </div>
            )}
            {formula.discrepancy && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                <b>Flagged for manual verification:</b> <MathRenderer content={formula.discrepancy} className="inline" />
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
