"use client";

import React from "react";

import { OptionContentView } from "@/components/answers/OptionContentView";
import { ConceptChainView, conceptBreaks } from "@/components/concepts/ConceptChainView";
import { ChainView } from "@/components/formulas/ChainView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "@/lib/engine/misconceptions";
import { CONCEPT_FAILURE_LABELS, type ChoiceInstance } from "@/lib/engine/types";
import { getFormula } from "@/lib/formulas/registry";
import { OUTCOMES } from "@/lib/syllabus";
import { Layer, TransferContent, VisualContent, TranslationContent, AlternativesContent, SolutionSteps, hasTranslation } from "./layers";
import { WrongOptionCard } from "./NumericLayers";

export function StatementTable({ instance }: { instance: ChoiceInstance }) {
  const statements = instance.statements ?? [];
  return (
    <div className="max-w-full overflow-x-auto rounded-md border outline-none scrollbar-slim focus-visible:ring-2 focus-visible:ring-ring" role="region" aria-label="Statement analysis" tabIndex={0}>
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">Each statement, whether it is true, why, and the condition that would change the verdict</caption>
        <thead className="bg-muted/60 text-left">
          <tr>
            <th scope="col" className="px-3 py-1.5 font-semibold">Statement</th>
            <th scope="col" className="px-3 py-1.5 font-semibold">Verdict</th>
            <th scope="col" className="px-3 py-1.5 font-semibold">Why</th>
            <th scope="col" className="px-3 py-1.5 font-semibold">What would change the verdict</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => {
            const m = getMisconception(s.misconception);
            return (
              <tr key={s.key} className="border-t align-top">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="font-semibold">{s.key}.</span> <MathRenderer content={s.text} className="inline-block" />
                </th>
                <td className="px-3 py-2">
                  <Badge tone={s.truth ? "good" : "bad"}>{s.truth ? "True" : "False"}</Badge>
                </td>
                <td className="px-3 py-2">
                  <MathRenderer content={s.justification} />
                  {m && <p className="mt-1 text-xs text-muted-foreground">Trap: {m.label}</p>}
                </td>
                <td className="px-3 py-2">
                  {s.conditionTrue ? (
                    <>
                      <span className="text-xs text-muted-foreground">{s.truth ? "It would be false if: " : "It would be true if: "}</span>
                      <MathRenderer content={s.conditionTrue} />
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function YourChoice({ instance, selectedKey, statementCount }: { instance: ChoiceInstance; selectedKey: string | null; statementCount?: number }) {
  const selected = instance.options.find((o) => o.key === selectedKey);
  if (!selected) return <p>No answer was recorded for this question.</p>;
  if (selected.isCorrect) return <p className="rounded-md bg-success/10 p-2">Your answer, {selected.key}, is correct.</p>;
  const m = getMisconception(selected.misconceptionTag);
  const step = instance.concept ? conceptBreaks(instance.concept, [selected])[0]?.stage ?? null : null;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="pt-0.5 font-semibold">{selected.key}.</span>
        <OptionContentView content={selected.content} display={selected.display} statementCount={statementCount} className="flex-1" />
      </div>
      <dl className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
        <dt className="eyebrow sm:pt-0.5">Misconception</dt>
        <dd>
          <span className="font-medium">{m?.label ?? selected.misconceptionTag}</span>
          {m && <span className="text-muted-foreground"> — {MISCONCEPTION_CATEGORIES[m.category]}</span>}
          {m && <MathRenderer content={m.description} className="text-muted-foreground" />}
        </dd>
        <dt className="eyebrow sm:pt-0.5">Failure type</dt>
        <dd>
          {selected.conceptFailure ? CONCEPT_FAILURE_LABELS[selected.conceptFailure] : "Not classified for this question"}
          {step !== null && <span className="text-muted-foreground"> (reasoning step {step + 1})</span>}
        </dd>
        {m?.principle && (
          <>
            <dt className="eyebrow sm:pt-0.5">Correct principle</dt>
            <dd>
              <MathRenderer content={m.principle} />
            </dd>
          </>
        )}
        {selected.conditionTrue && (
          <>
            <dt className="eyebrow sm:pt-0.5">When your answer would be right</dt>
            <dd>
              <MathRenderer content={selected.conditionTrue} />
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function ChoiceLayers({ instance, selectedKey, statementCount, showTransfer = true }: { instance: ChoiceInstance; selectedKey: string | null; statementCount?: number; showTransfer?: boolean }) {
  const e = instance.explanation;
  const correct = instance.options.find((o) => o.isCorrect);
  const wrongOptions = instance.options.filter((o) => !o.isCorrect);
  const breaks = instance.concept ? conceptBreaks(instance.concept, instance.options) : [];
  const formulas = (instance.formulas ?? []).map((id) => ({ id, formula: getFormula(id) }));

  const layers: { title: string; node: React.ReactNode; defaultOpen?: boolean }[] = [];

  layers.push({
    title: `Why ${instance.correctKey} is correct`,
    node: (
      <>
        {correct && (
          <div className="rounded-md border border-success bg-success/10 p-3">
            <div className="flex items-start gap-2">
              <span className="pt-0.5 font-semibold">{correct.key}.</span>
              <OptionContentView content={correct.content} display={correct.display} statementCount={statementCount} className="flex-1" />
            </div>
            <MathRenderer content={correct.feedbackExplanation} className="mt-2" />
          </div>
        )}
        {e.solution.length > 0 && (
          <div>
            <div className="eyebrow mb-1">The reasoning, step by step</div>
            <SolutionSteps instance={instance} />
          </div>
        )}
      </>
    ),
  });

  layers.push({ title: "Your choice", node: <YourChoice instance={instance} selectedKey={selectedKey} statementCount={statementCount} /> });

  if (e.intuition || instance.visuals.length) {
    layers.push({ title: "The idea: what is actually happening", node: <VisualContent instance={instance} /> });
  }

  if (instance.statements?.length) {
    layers.push({ title: "Statement by statement", node: <StatementTable instance={instance} /> });
  }

  layers.push({
    title: "Why the other answers are wrong",
    node: (
      <>
        {wrongOptions.map((o) => (
          <WrongOptionCard key={o.key} option={o} selectedKey={selectedKey} statementCount={statementCount} step={breaks.find((b) => b.option.key === o.key)?.stage ?? null} />
        ))}
      </>
    ),
  });

  if (instance.concept) {
    layers.push({
      title: "Concept chain: the reasoning, and where each wrong answer breaks",
      node: <ConceptChainView concept={instance.concept} options={instance.options} selectedKey={selectedKey} statementCount={statementCount} />,
    });
  }

  if (instance.chain && instance.integration) {
    layers.push({
      title: "Formula chain: which formulas, in what order, and why",
      node: <ChainView chain={instance.chain} integration={instance.integration} options={instance.options} selectedKey={selectedKey} />,
    });
  }

  if (instance.relationship || formulas.length) {
    layers.push({
      title: "The applicable formula or relationship",
      node: (
        <>
          {instance.relationship && (
            <div className="rounded-md bg-primary/5 p-3">
              <MathRenderer content={instance.relationship} />
            </div>
          )}
          {formulas.length > 0 && (
            <ul className="space-y-2">
              {formulas.map(({ id, formula }) => (
                <li key={id} className="rounded-md border p-2">
                  <div className="font-medium">{formula?.name ?? id}</div>
                  {formula && (
                    <div className="overflow-x-auto scrollbar-slim">
                      <MathRenderer content={`$${formula.expression}$`} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    });
  }

  if (instance.counterexample) {
    layers.push({ title: "Counterexample or boundary case", node: <MathRenderer content={instance.counterexample} /> });
  }

  if (hasTranslation(instance)) {
    layers.push({ title: "Mathematical translation: from words to relationships", node: <TranslationContent instance={instance} />, defaultOpen: false });
  }

  if (e.alternatives.length) {
    layers.push({ title: "Alternative approaches", node: <AlternativesContent instance={instance} />, defaultOpen: false });
  }

  layers.push({
    title: "Learning outcomes",
    node: (
      <dl className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
        <dt className="eyebrow sm:pt-0.5">Primary</dt>
        <dd>{OUTCOMES[instance.objective]?.label ?? instance.objective}</dd>
        {instance.secondary.length > 0 && (
          <>
            <dt className="eyebrow sm:pt-0.5">Also exercises</dt>
            <dd>
              <ul className="list-disc space-y-0.5 pl-5">
                {instance.secondary.map((id) => (
                  <li key={id}>{OUTCOMES[id]?.label ?? id}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    ),
  });

  layers.push({ title: "Transfer principle", node: <TransferContent instance={instance} showTransfer={showTransfer} /> });

  return (
    <>
      {layers.map((layer, idx) => (
        <Layer key={layer.title} n={idx + 1} title={layer.title} defaultOpen={layer.defaultOpen}>
          {layer.node}
        </Layer>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- the review
