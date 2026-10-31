"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { ChainView } from "@/components/formulas/ChainView";
import { MathRenderer } from "@/components/MathRenderer";
import { Badge, Button } from "@/components/ui";
import { VisualRenderer } from "@/components/visuals/VisualRenderer";
import type { QuestionReview as Review } from "@/lib/analysis/report";
import { getMisconception } from "@/lib/engine/misconceptions";
import { CONFIDENCE_LABELS, METHOD_LABELS } from "@/lib/engine/skills";
import { DIFFICULTY_LABELS, INTEGRATION_LABELS } from "@/lib/engine/types";
import { OUTCOMES, TOPIC_LABELS } from "@/lib/syllabus";
import { formatClock } from "@/lib/timer";
import { cn } from "@/lib/utils";

function Layer({ n, title, children, defaultOpen = true }: { n: number; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{n}</span>
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">show</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

export function QuestionReview({ review }: { review: Review }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const { instance, response, evidence } = review;
  const e = instance.explanation;
  const selected = instance.options.find((o) => o.key === response.selectedKey);
  const wrongOptions = instance.options.filter((o) => !o.isCorrect);

  const startTransfer = async () => {
    setStarting(true);
    const res = await fetch("/api/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: instance.instanceId }) });
    const data = await res.json();
    if (res.ok) router.push(`/session/${data.id}`);
    else setStarting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{TOPIC_LABELS[instance.topic]}</Badge>
        <Badge tone={instance.difficulty === 1 ? "neutral" : instance.difficulty === 2 ? "info" : "warn"}>{DIFFICULTY_LABELS[instance.difficulty]}</Badge>
        {instance.chain && <Badge tone="info">Integration level {instance.integration}: {INTEGRATION_LABELS[instance.integration]}</Badge>}
        <span className="text-muted-foreground">Objective: {OUTCOMES[instance.objective]?.label}</span>
        {instance.reworded && <Badge tone="info">wording varied by the language model (mathematics unchanged)</Badge>}
      </div>

      <div className="rounded-lg border p-4">
        <MathRenderer content={instance.stem} className="text-[15px]" />
        <div className="mt-3 grid gap-1.5">
          {instance.options.map((o) => (
            <div
              key={o.key}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm",
                o.isCorrect && "border-success bg-success/10",
                !o.isCorrect && o.key === response.selectedKey && "border-destructive bg-destructive/10"
              )}
            >
              <span className="w-5 font-semibold">{o.key}</span>
              <span className="w-28 font-mono tabular-nums">{o.display}</span>
              <span className="text-xs text-muted-foreground">
                {o.isCorrect ? "correct answer" : getMisconception(o.misconceptionTag)?.label}
                {o.key === response.selectedKey ? " — your answer" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-4 text-sm">
          <div className="eyebrow mb-2">Your response</div>
          <div className="space-y-1">
            <div>
              Answer: <b>{response.selectedKey ?? "none"}</b>
              {selected && ` (${selected.display})`} · {review.qualityLabel}
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

      <Layer n={1} title="Visual intuition: what is actually happening">
        <MathRenderer content={e.intuition} />
        <div className="space-y-3">
          {instance.visuals.map((spec, idx) => (
            <VisualRenderer key={idx} spec={spec} />
          ))}
        </div>
      </Layer>

      <Layer n={2} title="Mathematical translation: from words to relationships">
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
      </Layer>

      <Layer n={3} title="Main solution">
        <ol className="space-y-3">
          {e.solution.map((step, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="mt-0.5 text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
              <div>
                <div className="font-medium">{step.title}</div>
                <MathRenderer content={step.body} />
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-md bg-success/10 p-2">
          Answer: <b>{instance.correctKey}</b> — <span className="font-mono">{instance.options.find((o) => o.isCorrect)?.display}</span>
        </div>
      </Layer>

      {instance.chain && (
        <Layer n={4} title="Formula chain: which formulas, in what order, and why">
          <ChainView chain={instance.chain} integration={instance.integration} options={instance.options} selectedKey={response.selectedKey} />
        </Layer>
      )}

      <Layer n={5} title="Alternative solutions">
        {e.alternatives.map((alt) => (
          <div key={alt.name} className="rounded-md border p-3">
            <div className="font-medium">{alt.name}</div>
            <MathRenderer content={alt.body} />
            <MathRenderer content={`When it helps: ${alt.whenUseful}`} className="mt-1 text-xs text-muted-foreground" />
          </div>
        ))}
      </Layer>

      <Layer n={6} title="Why the other answers are wrong">
        {wrongOptions.map((o) => {
          const m = getMisconception(o.misconceptionTag);
          return (
            <div key={o.key} className={cn("rounded-md border p-3", o.key === response.selectedKey && "border-destructive")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {o.key}. <span className="font-mono">{o.display}</span>
                </span>
                <Badge tone="bad">{o.category}</Badge>
                <span className="text-sm font-medium">{m?.label}</span>
                {o.key === response.selectedKey && <Badge tone="warn">your answer</Badge>}
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
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void startTransfer()} disabled={starting}>
            {starting ? "Generating…" : "Test this principle in a different context"}
          </Button>
          <span className="text-xs text-muted-foreground">Two new questions on the same principle, from different templates.</span>
        </div>
      </Layer>

      <details className="rounded-lg border text-xs">
        <summary className="cursor-pointer px-4 py-2 font-semibold text-muted-foreground">Validation record</summary>
        <div className="space-y-2 border-t px-4 py-3">
          <p>
            Seed {instance.validation.seed} · validated {new Date(instance.validation.validatedAt).toLocaleString()} · status {instance.validation.status}
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
            <p className="mt-1 text-muted-foreground">{instance.model.description}</p>
          </div>
          <table className="w-full tabular-nums">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th>option</th>
                <th>misconception</th>
                <th>template value</th>
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
                    <td>{o.value.toPrecision(10)}</td>
                    <td>{o.calcValue === null ? "—" : o.calcValue.toPrecision(10)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
