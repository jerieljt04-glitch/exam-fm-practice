"use client";

import { Exhibits } from "@/components/answers/Exhibits";
import { OptionContentView, statementCountOf } from "@/components/answers/OptionContentView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui";
import type { QuestionReview as Review } from "@/lib/analysis/report";
import { getMisconception } from "@/lib/engine/misconceptions";
import { CONFIDENCE_LABELS, METHOD_LABELS } from "@/lib/engine/skills";
import { DIFFICULTY_LABELS, INTEGRATION_LABELS, ITEM_FORMAT_LABELS, isChoiceInstance, type NumericInstance } from "@/lib/engine/types";
import { OUTCOMES, TOPIC_LABELS } from "@/lib/syllabus";
import { formatClock } from "@/lib/timer";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";
import { NumericLayers } from "./review/NumericLayers";
import { ChoiceLayers } from "./review/ChoiceLayers";

export { ChoiceLayers };

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
