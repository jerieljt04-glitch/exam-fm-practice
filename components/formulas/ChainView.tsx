"use client";

import React from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { ALGEBRA_METHOD_LABELS, CHAIN_ERROR_LABELS, INTEGRATION_LABELS, type FormulaChain, type IntegrationLevel, type OptionDetail } from "@/lib/engine/types";
import { getMisconception } from "@/lib/engine/misconceptions";
import { cn } from "@/lib/utils";

export function chainValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1) return value.toFixed(6);
  if (Math.abs(value) < 100) return value.toFixed(4);
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The formula chain behind a question: which formulas, in which order, why,
 * what each produces and where it goes next — and where each wrong option
 * leaves the chain.
 */
export function ChainView({ chain, integration, options, selectedKey }: { chain: FormulaChain; integration: IntegrationLevel; options: OptionDetail[]; selectedKey: string | null }) {
  const traps = options.filter((o) => !o.isCorrect && o.chainStage !== null && o.chainStage !== undefined);
  const consumers = (symbol: string, from: number) => chain.steps.findIndex((s, idx) => idx > from && s.inputs.includes(symbol));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="info">
          Level {integration}: {INTEGRATION_LABELS[integration]}
        </Badge>
        <span className="text-muted-foreground">{new Set(chain.steps.map((s) => s.formula)).size} distinct formulas</span>
        {chain.methods.map((m) => (
          <Badge key={m}>{ALGEBRA_METHOD_LABELS[m]}</Badge>
        ))}
      </div>

      <ol className="space-y-0">
        {chain.steps.map((step, idx) => {
          const formula = FORMULA_BY_ID[step.formula];
          const stepTraps = traps.filter((o) => o.chainStage === idx);
          const yours = stepTraps.find((o) => o.key === selectedKey);
          const next = consumers(step.output.symbol, idx);
          return (
            <li key={idx} className="relative pl-8">
              <span className={cn("absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", yours ? "bg-destructive text-white" : "bg-primary/10 text-primary")}>{idx + 1}</span>
              {idx < chain.steps.length - 1 && <span className="absolute left-[11px] top-9 h-[calc(100%-1.5rem)] w-0.5 bg-border" aria-hidden />}
              <div className={cn("mb-2 rounded-lg border p-3", yours && "border-destructive")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{formula?.name ?? step.formula}</span>
                  {step.rearranged && <Badge tone="info">rearranged</Badge>}
                  {step.derived && <Badge tone="info">derived</Badge>}
                  {step.valuationDate && <span className="text-xs text-muted-foreground">valued at t = {step.valuationDate}</span>}
                </div>
                {formula && (
                  <div className="my-1 overflow-x-auto scrollbar-slim">
                    <MathRenderer content={`$${formula.expression}$`} />
                  </div>
                )}
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <div className="eyebrow">Why here</div>
                    <MathRenderer content={step.purpose} />
                    {step.inputs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Uses: {step.inputs.join(", ")}</p>}
                  </div>
                  <div>
                    <div className="eyebrow">Produces</div>
                    <p>
                      <span className="font-mono">{step.output.symbol}</span> = <span className="font-mono tabular-nums">{chainValue(step.output.value)}</span> — {step.output.meaning}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{idx === chain.steps.length - 1 ? "This is the answer." : next >= 0 ? `Feeds step ${next + 1}.` : `Carried into step ${idx + 2}.`}</p>
                  </div>
                </div>
                {formula && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Meaning, derivation and alternatives</summary>
                    <div className="mt-1 space-y-1">
                      <MathRenderer content={formula.meaning} />
                      <MathRenderer content={`Derivation: ${formula.derivation}`} />
                      {formula.related.length > 0 && <p>Related formulas: {formula.related.map((id) => FORMULA_BY_ID[id]?.name ?? id).join(", ")}</p>}
                      {formula.sources
                        .filter((s) => s.doc !== "DERIVED")
                        .map((s, k) => (
                          <p key={k} className="text-muted-foreground">
                            {s.doc}, PDF page {s.page} ({s.section})
                          </p>
                        ))}
                    </div>
                  </details>
                )}
                {stepTraps.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2 text-xs">
                    {stepTraps.map((o) => (
                      <p key={o.key} className={cn(o.key === selectedKey && "font-semibold text-destructive")}>
                        Option {o.key} ({o.display}) leaves the chain here — {CHAIN_ERROR_LABELS[o.chainError ?? "application"].toLowerCase()}: {getMisconception(o.misconceptionTag)?.label.toLowerCase()}
                        {o.wrongFormula ? ` (uses ${FORMULA_BY_ID[o.wrongFormula]?.name ?? o.wrongFormula} instead)` : ""}
                        {o.key === selectedKey ? " — your answer" : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-md bg-primary/5 p-3 text-sm">
        <div className="eyebrow mb-1">Without memorised formulas: the reasoning route</div>
        <MathRenderer content={chain.reasoning} />
      </div>
    </div>
  );
}
