"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Exhibits } from "@/components/answers/Exhibits";
import { OptionContentView, statementCountOf } from "@/components/answers/OptionContentView";
import { ConceptChainView, conceptBreaks } from "@/components/concepts/ConceptChainView";
import { ChainView } from "@/components/formulas/ChainView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button } from "@/components/ui";
import { VisualRenderer } from "@/components/visuals/VisualRenderer";
import type { QuestionReview as Review } from "@/lib/analysis/report";
import { getConcept } from "@/lib/concepts/registry";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "@/lib/engine/misconceptions";
import { CONFIDENCE_LABELS, METHOD_LABELS } from "@/lib/engine/skills";
import {
  CONCEPT_FAILURE_LABELS,
  DIFFICULTY_LABELS,
  INTEGRATION_LABELS,
  ITEM_FORMAT_LABELS,
  isChoiceInstance,
  type ChoiceInstance,
  type NumericInstance,
  type OptionDetail,
  type QuestionInstance,
} from "@/lib/engine/types";
import { getFormula } from "@/lib/formulas/registry";
import { OUTCOMES, TOPIC_LABELS } from "@/lib/syllabus";
import { formatClock } from "@/lib/timer";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";

function Layer({ n, title, children, defaultOpen = true }: { n: number; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{n}</span>
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">show</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

/** The only part of the review that navigates; kept separate so the rest renders without a router. */
function TransferButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const startTransfer = async () => {
    setStarting(true);
    const res = await fetch("/api/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId }) });
    const data = await res.json();
    if (res.ok) router.push(`/session/${data.id}`);
    else setStarting(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => void startTransfer()} disabled={starting}>
        {starting ? "Generating…" : "Test this principle in a different context"}
      </Button>
      <span className="text-xs text-muted-foreground">Two new questions on the same principle, from different templates.</span>
    </div>
  );
}

function TransferContent({ instance, showTransfer = true }: { instance: QuestionInstance; showTransfer?: boolean }) {
  const e = instance.explanation;
  return (
    <>
      <div className="rounded-md bg-primary/5 p-3">
        <div className="eyebrow mb-1">General principle</div>
        <MathRenderer content={e.transfer.principle} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-1">What was unusual here</div>
          <MathRenderer content={e.transfer.unusual} />
        </div>
        <div>
          <div className="eyebrow mb-1">Why it was easy to misread</div>
          <MathRenderer content={e.transfer.misread} />
        </div>
      </div>
      {showTransfer && <TransferButton questionId={instance.instanceId} />}
    </>
  );
}

function VisualContent({ instance }: { instance: QuestionInstance }) {
  return (
    <>
      <MathRenderer content={instance.explanation.intuition} />
      <div className="space-y-3">
        {instance.visuals.map((spec, idx) => (
          <VisualRenderer key={idx} spec={spec} />
        ))}
      </div>
    </>
  );
}

function TranslationContent({ instance }: { instance: QuestionInstance }) {
  const e = instance.explanation;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <div className="eyebrow mb-1">Unknowns</div>
        <ul className="space-y-1">
          {e.translation.unknowns.map((u) => (
            <li key={u.symbol}>
              <MathRenderer content={`${u.symbol} — ${u.meaning}`} />
            </li>
          ))}
        </ul>
        <div className="eyebrow mb-1 mt-3">Relationships</div>
        <ul className="space-y-1">
          {e.translation.relationships.map((r) => (
            <li key={r}>
              <MathRenderer content={r} />
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <div>
          <div className="eyebrow mb-1">Conditions that must hold</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {e.translation.conditions.map((c) => (
              <li key={c}>
                <MathRenderer content={c} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-1">Valuation date</div>
          <MathRenderer content={e.translation.valuationDate} />
        </div>
        <div>
          <div className="eyebrow mb-1">Why this model</div>
          <MathRenderer content={e.translation.modelChoice} />
        </div>
        <div>
          <div className="eyebrow mb-1">Assumptions</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {e.translation.assumptions.map((a) => (
              <li key={a}>
                <MathRenderer content={a} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AlternativesContent({ instance }: { instance: QuestionInstance }) {
  return (
    <>
      {instance.explanation.alternatives.map((alt) => (
        <div key={alt.name} className="rounded-md border p-3">
          <div className="font-medium">{alt.name}</div>
          <MathRenderer content={alt.body} />
          <MathRenderer content={`When it helps: ${alt.whenUseful}`} className="mt-1 text-xs text-muted-foreground" />
        </div>
      ))}
    </>
  );
}

function SolutionSteps({ instance }: { instance: QuestionInstance }) {
  return (
    <ol className="space-y-3">
      {instance.explanation.solution.map((step, idx) => (
        <li key={idx} className="flex gap-3">
          <span className="mt-0.5 text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
          <div className="min-w-0">
            <div className="font-medium">{step.title}</div>
            <MathRenderer content={step.body} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- numerical questions (unchanged layers)

function NumericLayers({ instance, selectedKey }: { instance: NumericInstance; selectedKey: string | null }) {
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

function WrongOptionCard({ option: o, selectedKey, statementCount, step }: { option: OptionDetail; selectedKey: string | null; statementCount?: number; step: number | null }) {
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

function StatementTable({ instance }: { instance: ChoiceInstance }) {
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

function YourChoice({ instance, selectedKey, statementCount }: { instance: ChoiceInstance; selectedKey: string | null; statementCount?: number }) {
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

function hasTranslation(instance: QuestionInstance): boolean {
  const t = instance.explanation.translation;
  return t.unknowns.length + t.relationships.length + t.conditions.length + t.assumptions.length > 0 || Boolean(t.modelChoice || t.valuationDate);
}

/** `showTransfer: false` hides the transfer-session button, which needs a question stored in a session (study mode has none). */
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

export function QuestionReview({ review }: { review: Review }) {
  const { instance, response, evidence } = review;
  const choice = isChoiceInstance(instance) ? instance : null;
  const statementCount = choice?.statements?.length || statementCountOf(instance.exhibits);
  const selected = instance.options.find((o) => o.key === response.selectedKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{TOPIC_LABELS[instance.topic]}</Badge>
        <Badge tone={instance.difficulty === 1 ? "neutral" : instance.difficulty === 2 ? "info" : "warn"}>{DIFFICULTY_LABELS[instance.difficulty]}</Badge>
        {choice && <Badge>{ITEM_FORMAT_LABELS[choice.itemFormat]}</Badge>}
        {choice?.practice === "concept" && <Badge tone="info">Concept Practice</Badge>}
        {instance.chain && instance.integration && <Badge tone="info">Integration level {instance.integration}: {INTEGRATION_LABELS[instance.integration]}</Badge>}
        <span className="text-muted-foreground">Objective: {OUTCOMES[instance.objective]?.label}</span>
        {instance.reworded && <Badge tone="info">wording varied by the language model (mathematics unchanged)</Badge>}
      </div>

      <div className="rounded-lg border p-4">
        <MathRenderer content={instance.stem} className="text-[15px]" />
        <Exhibits exhibits={instance.exhibits} className="mt-3" />
        <ul className="mt-3 grid gap-1.5" aria-label="Answer choices">
          {instance.options.map((o) => {
            const rich = o.content !== undefined && o.content.type !== "numeric";
            return (
              <li
                key={o.key}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-1.5 text-sm",
                  o.isCorrect && "border-success bg-success/10",
                  !o.isCorrect && o.key === response.selectedKey && "border-destructive bg-destructive/10"
                )}
              >
                <span className="w-5 shrink-0 pt-0.5 font-semibold">{o.key}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <OptionContentView content={o.content} display={o.display} statementCount={statementCount} className={rich ? "w-full" : "min-w-[7rem]"} />
                  <span className="text-xs text-muted-foreground">
                    {o.isCorrect ? "correct answer" : getMisconception(o.misconceptionTag)?.label}
                    {o.key === response.selectedKey ? " — your answer" : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-4 text-sm">
          <div className="eyebrow mb-2">Your response</div>
          <div className="space-y-1">
            <div>
              Answer: <b>{response.selectedKey ?? "none"}</b>
              {/* Equations are shown typeset under "Your choice"; their plain display is a spoken form. */}
              {selected && selected.content?.type !== "math" && ` (${selected.display})`} · {review.qualityLabel}
            </div>
            <div>
              Confidence: {response.confidence ? CONFIDENCE_LABELS[response.confidence] : "not recorded"} · Method: {response.method ? METHOD_LABELS[response.method] : "not recorded"}
              {response.methodNote ? ` — ${response.methodNote}` : ""}
            </div>
            <div>Time: {formatClock(response.timeSpentSeconds)}</div>
            {review.causeLabel && <div>Likely cause: {review.causeLabel}</div>}
          </div>
          {response.working.trim() && (
            <div className="mt-3 rounded-md bg-muted p-2">
              <div className="eyebrow mb-1">Working</div>
              <MathRenderer content={response.working} className="whitespace-pre-wrap font-mono text-xs" />
            </div>
          )}
        </div>
        <div className="rounded-lg border p-4 text-sm">
          <div className="eyebrow mb-2">Evidence</div>
          <div className="text-xs font-semibold text-muted-foreground">Observed</div>
          <ul className="mb-2 list-disc space-y-0.5 pl-5">
            {evidence.observed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {evidence.inferred.length > 0 && (
            <>
              <div className="text-xs font-semibold text-muted-foreground">Inferred (not certain)</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {evidence.inferred.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {choice ? (
        <ChoiceLayers instance={choice} selectedKey={response.selectedKey} statementCount={statementCount} />
      ) : (
        <NumericLayers instance={instance as NumericInstance} selectedKey={response.selectedKey} />
      )}

      <details className="rounded-lg border text-xs">
        <summary className="cursor-pointer px-4 py-2 font-semibold text-muted-foreground">Validation record</summary>
        <div className="space-y-2 border-t px-4 py-3">
          <p>
            Seed {instance.validation.seed} · validated <LocalTime iso={instance.validation.validatedAt} /> · status {instance.validation.status}
          </p>
          <ul className="grid gap-0.5 md:grid-cols-2">
            {instance.validation.checks.map((c, idx) => (
              <li key={idx}>
                {c.ok ? "✓" : "✗"} {c.name}
                {c.detail && <span className="text-muted-foreground"> — {c.detail.slice(0, 90)}</span>}
              </li>
            ))}
          </ul>
          <div>
            <div className="font-semibold">Independent equation of value</div>
            <code className="block max-h-24 overflow-auto break-all rounded bg-muted p-2 scrollbar-slim">{instance.validation.model}</code>
            <p className="mt-1 text-muted-foreground">{instance.model?.description}</p>
          </div>
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full tabular-nums">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th>option</th>
                  <th>misconception</th>
                  <th>{choice && choice.answerType !== "numeric" ? "content" : "template value"}</th>
                  <th>recomputed</th>
                </tr>
              </thead>
              <tbody>
                {instance.validation.options
                  .filter((o) => o.selected)
                  .map((o) => (
                    <tr key={o.misconception} className="border-t">
                      <td>{o.key}</td>
                      <td>{o.misconception}</td>
                      <td>{choice && choice.answerType !== "numeric" && o.display ? o.display : o.value.toPrecision(10)}</td>
                      <td>{o.calcValue === null ? "—" : o.calcValue.toPrecision(10)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
