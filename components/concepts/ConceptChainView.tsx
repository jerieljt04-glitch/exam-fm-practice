"use client";

import React from "react";

import { OptionContentView } from "@/components/answers/OptionContentView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import { getConcept } from "@/lib/concepts/registry";
import { getMisconception } from "@/lib/engine/misconceptions";
import {
  CONCEPT_DIMENSION_LABELS,
  CONCEPT_FAILURE_LABELS,
  CONCEPT_FAMILY_LABELS,
  type ConceptChain,
  type ConceptDimension,
  type ConceptFailure,
  type ConceptFamily,
  type OptionDetail,
} from "@/lib/engine/types";
import { cn } from "@/lib/utils";

export interface ConceptChainViewProps {
  /** The question's concept chain (a ChoiceInstance's `concept`, which also carries family and dimensions). */
  concept: ConceptChain & { family?: ConceptFamily; dimensions?: ConceptDimension[] };
  options: OptionDetail[];
  selectedKey: string | null;
  /** Number of statements, for statement-combination option labels. */
  statementCount?: number;
}

interface Break {
  option: OptionDetail;
  stage: number;
  failure: ConceptFailure | null;
}

/** Where each wrong option's reasoning leaves the chain: the option's own stage, else the chain's record for its misconception. */
export function conceptBreaks(concept: ConceptChain, options: OptionDetail[]): Break[] {
  return options.flatMap((option) => {
    if (option.isCorrect) return [];
    const recorded = option.misconceptionTag !== "CORRECT" ? concept.stages[option.misconceptionTag] : undefined;
    const stage = option.conceptStage ?? recorded?.stage;
    if (stage === null || stage === undefined) return [];
    return [{ option, stage, failure: option.conceptFailure ?? recorded?.kind ?? null }];
  });
}

/**
 * The reasoning behind a conceptual question: the concepts it needs, the
 * steps in order, the conditions they rely on — and the step at which each
 * wrong option's reasoning breaks, with the kind of failure. The analogue of
 * the formula-chain view for numerical questions.
 */
export function ConceptChainView({ concept, options, selectedKey, statementCount }: ConceptChainViewProps) {
  const breaks = conceptBreaks(concept, options);
  const yourBreak = breaks.find((b) => b.option.key === selectedKey);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {concept.family && <Badge tone="info">{CONCEPT_FAMILY_LABELS[concept.family]}</Badge>}
        {concept.dimensions?.map((d) => (
          <Badge key={d}>{CONCEPT_DIMENSION_LABELS[d]}</Badge>
        ))}
        <span className="text-muted-foreground">
          {concept.steps.length} reasoning step{concept.steps.length === 1 ? "" : "s"}
        </span>
      </div>

      {concept.concepts.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Concepts this question needs</div>
          <ul className="space-y-1">
            {concept.concepts.map((id) => {
              const c = getConcept(id);
              return (
                <li key={id} className="rounded-md border px-3 py-1.5">
                  <span className="font-medium">{c?.label ?? id}</span>
                  {c?.summary && <MathRenderer content={c.summary} className="text-xs text-muted-foreground" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {yourBreak && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm">
          Your answer ({yourBreak.option.key}) leaves the reasoning at step {yourBreak.stage + 1}
          {yourBreak.failure ? `: ${CONCEPT_FAILURE_LABELS[yourBreak.failure].toLowerCase()}` : ""}.
        </p>
      )}

      <ol className="space-y-0">
        {concept.steps.map((step, idx) => {
          const c = getConcept(step.concept);
          const stepBreaks = breaks.filter((b) => b.stage === idx);
          const yours = stepBreaks.some((b) => b.option.key === selectedKey);
          return (
            <li key={idx} className="relative pl-8">
              <span
                className={cn("absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", yours ? "bg-destructive text-white" : "bg-primary-container text-primary-on-container")}
                aria-hidden
              >
                {idx + 1}
              </span>
              {idx < concept.steps.length - 1 && <span className="absolute left-[11px] top-9 h-[calc(100%-1.5rem)] w-0.5 bg-border" aria-hidden />}
              <div className={cn("mb-2 rounded-lg border p-3", yours && "border-destructive")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sr-only">Step {idx + 1}:</span>
                  <span className="font-semibold">{c?.label ?? step.concept}</span>
                  {yours && <Badge tone="bad">your answer breaks here</Badge>}
                </div>
                <MathRenderer content={step.reasoning} className="mt-1 text-sm" />
                {stepBreaks.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-t pt-2 text-xs">
                    {stepBreaks.map(({ option: o, failure }) => {
                      const mine = o.key === selectedKey;
                      const confused = o.confusedWith ? getConcept(o.confusedWith)?.label ?? o.confusedWith : null;
                      return (
                        <li key={o.key} className={cn("flex flex-wrap items-start gap-x-2 gap-y-1", mine && "font-semibold text-destructive")}>
                          <span className="shrink-0">Option {o.key}</span>
                          <OptionContentView content={o.content} display={o.display} statementCount={statementCount} className="max-w-full text-xs [&_*]:text-xs" />
                          <span>
                            fails here
                            {failure ? ` — ${CONCEPT_FAILURE_LABELS[failure].toLowerCase()}` : ""}
                            {o.misconceptionTag !== "CORRECT" && getMisconception(o.misconceptionTag) ? `: ${getMisconception(o.misconceptionTag)!.label.toLowerCase()}` : ""}
                            {confused ? ` (confuses it with ${confused.toLowerCase()})` : ""}
                            {mine ? " — your answer" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {concept.conditions.length > 0 && (
        <div className="rounded-md bg-primary/5 p-3 text-sm">
          <div className="eyebrow mb-1">Conditions the reasoning relies on</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {concept.conditions.map((condition, idx) => (
              <li key={idx}>
                <MathRenderer content={condition} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
