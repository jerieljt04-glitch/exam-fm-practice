"use client";

import { Meter, Panel } from "@/components/ui";

import { toneFor, type ReportContext } from "../shared";

export function ReasoningTab({ ctx }: { ctx: ReportContext }) {
  const { report } = ctx;
  return (
    <Panel title="Mathematical reasoning profile (this session)">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {report.reasoning.map((s) => (
          <div key={s.skill}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.status === "INSUFFICIENT" ? "insufficient evidence" : `${Math.round((s.score ?? 0) * 100)}%`}
              </span>
            </div>
            <Meter value={s.status === "INSUFFICIENT" ? null : s.score} tone={s.status === "INSUFFICIENT" ? "neutral" : toneFor(s.score)} />
            <p className="mt-1 text-xs text-muted-foreground">
              <b>Observed:</b> {s.observedText} {s.inferredText && <><b>Inferred:</b> {s.inferredText}</>}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
