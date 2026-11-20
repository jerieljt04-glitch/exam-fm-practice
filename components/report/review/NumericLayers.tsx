"use client";

import { OptionContentView } from "@/components/answers/OptionContentView";
import { ChainView } from "@/components/formulas/ChainView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import { getConcept } from "@/lib/concepts/registry";
import { getMisconception } from "@/lib/engine/misconceptions";
import { CONCEPT_FAILURE_LABELS, type NumericInstance, type OptionDetail } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { Layer, TransferContent, VisualContent, TranslationContent, AlternativesContent, SolutionSteps } from "./layers";

export function NumericLayers({ instance, selectedKey }: { instance: NumericInstance; selectedKey: string | null }) {
  const wrongOptions = instance.options.filter((o) => !o.isCorrect);
  return (
    <>
      <Layer n={1} title="Visual intuition: what is actually happening">
        <VisualContent instance={instance} />
      </Layer>

      <Layer n={2} title="Mathematical translation: from words to relationships">
        <TranslationContent instance={instance} />
      </Layer>

      <Layer n={3} title="Main solution">
        <SolutionSteps instance={instance} />
        <div className="rounded-md bg-success/10 p-2">
          Answer: <b>{instance.correctKey}</b> — <span className="font-mono">{instance.options.find((o) => o.isCorrect)?.display}</span>
        </div>
      </Layer>

      {instance.chain && instance.integration && (
        <Layer n={4} title="Formula chain: which formulas, in what order, and why">
          <ChainView chain={instance.chain} integration={instance.integration} options={instance.options} selectedKey={selectedKey} />
        </Layer>
      )}

      <Layer n={5} title="Alternative solutions">
        <AlternativesContent instance={instance} />
      </Layer>

      <Layer n={6} title="Why the other answers are wrong">
        {wrongOptions.map((o) => {
          const m = getMisconception(o.misconceptionTag);
          return (
            <div key={o.key} className={cn("rounded-md border p-3", o.key === selectedKey && "border-destructive")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {o.key}. <span className="font-mono">{o.display}</span>
                </span>
                <Badge tone="bad">{o.category}</Badge>
                <span className="text-sm font-medium">{m?.label}</span>
                {o.key === selectedKey && <Badge tone="warn">your answer</Badge>}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <div className="eyebrow">The mistake</div>
                  <MathRenderer content={o.incorrectMethod} />
                  <div className="eyebrow mt-2">How it produces {o.display}</div>
                  <MathRenderer content={o.calculationDerivation} />
                </div>
                <div>
                  <div className="eyebrow">The correct interpretation</div>
                  <MathRenderer content={o.feedbackExplanation} />
                  <div className="eyebrow mt-2">How to recognise it next time</div>
                  <p>{o.recognitionTip}</p>
                </div>
              </div>
            </div>
          );
        })}
      </Layer>

      <Layer n={7} title="Transfer principle">
        <TransferContent instance={instance} />
      </Layer>
    </>
  );
}

// ---------------------------------------------------------------- typed-option and concept questions

export function WrongOptionCard({ option: o, selectedKey, statementCount, step }: { option: OptionDetail; selectedKey: string | null; statementCount?: number; step: number | null }) {
  const m = getMisconception(o.misconceptionTag);
  const mine = o.key === selectedKey;
  const confused = o.confusedWith ? getConcept(o.confusedWith)?.label ?? o.confusedWith : null;
  const showDerivation = o.calculationDerivation && o.calculationDerivation !== o.incorrectMethod;
  return (
    <div className={cn("rounded-md border p-3", mine && "border-destructive")}>
      <div className="flex items-start gap-2">
        <span className="pt-0.5 font-semibold">{o.key}.</span>
        <OptionContentView content={o.content} display={o.display} statementCount={statementCount} className="flex-1" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="bad">{o.category}</Badge>
        {m && <span className="text-sm font-medium">{m.label}</span>}
        {o.conceptFailure && (
          <Badge tone="info">
            Fails at {step !== null ? `step ${step + 1}: ` : ""}
            {CONCEPT_FAILURE_LABELS[o.conceptFailure].toLowerCase()}
          </Badge>
        )}
        {mine && <Badge tone="warn">your answer</Badge>}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="min-w-0">
          <div className="eyebrow">The mistake</div>
          <MathRenderer content={o.incorrectMethod || "—"} />
          {showDerivation && (
            <>
              <div className="eyebrow mt-2">How a candidate arrives at it</div>
              <MathRenderer content={o.calculationDerivation} />
            </>
          )}
          {confused && <p className="mt-2 text-xs text-muted-foreground">Confuses the idea with: {confused}</p>}
        </div>
        <div className="min-w-0">
          <div className="eyebrow">Why it is wrong here</div>
          <MathRenderer content={o.feedbackExplanation} />
          <div className="eyebrow mt-2">How to recognise it next time</div>
          <MathRenderer content={o.recognitionTip} />
        </div>
      </div>
      {o.conditionTrue && (
        <div className="mt-2 rounded-md bg-warning/10 p-2">
          <div className="eyebrow">When this would be true</div>
          <MathRenderer content={o.conditionTrue} />
        </div>
      )}
    </div>
  );
}
