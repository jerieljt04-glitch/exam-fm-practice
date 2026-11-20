"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { MathRenderer } from "@/components/MathRenderer";
import { Button } from "@/components/ui";
import { VisualRenderer } from "@/components/visuals/VisualRenderer";
import { type QuestionInstance } from "@/lib/engine/types";

export function Layer({ n, title, children, defaultOpen = true }: { n: number; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs text-primary-on-container">{n}</span>
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">show</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

/** The only part of the review that navigates; kept separate so the rest renders without a router. */
export function TransferButton({ questionId }: { questionId: string }) {
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
      <Button variant="outlined" onClick={() => void startTransfer()} disabled={starting}>
        {starting ? "Generating…" : "Test this principle in a different context"}
      </Button>
      <span className="text-xs text-muted-foreground">Two new questions on the same principle, from different templates.</span>
    </div>
  );
}

export function TransferContent({ instance, showTransfer = true }: { instance: QuestionInstance; showTransfer?: boolean }) {
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

export function VisualContent({ instance }: { instance: QuestionInstance }) {
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

export function TranslationContent({ instance }: { instance: QuestionInstance }) {
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

export function AlternativesContent({ instance }: { instance: QuestionInstance }) {
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

export function SolutionSteps({ instance }: { instance: QuestionInstance }) {
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

export function hasTranslation(instance: QuestionInstance): boolean {
  const t = instance.explanation.translation;
  return t.unknowns.length + t.relationships.length + t.conditions.length + t.assumptions.length > 0 || Boolean(t.modelChoice || t.valuationDate);
}

/** `showTransfer: false` hides the transfer-session button, which needs a question stored in a session (study mode has none). */
