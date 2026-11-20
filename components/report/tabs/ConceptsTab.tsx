"use client";

import { Panel } from "@/components/ui";

import { PositionList, type ReportContext } from "../shared";

export function ConceptsTab({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion } = ctx;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`Concept questions: ${report.concepts.correct} of ${report.concepts.total} correct`}>
        <div className="eyebrow mb-1">Where the reasoning failed</div>
        {report.concepts.byFailure.length ? (
          <ul className="space-y-1 text-sm">
            {report.concepts.byFailure.map((f) => (
              <li key={f.kind} className="flex items-center justify-between gap-2">
                <span>{f.label}</span>
                <PositionList positions={f.positions} onOpen={openQuestion} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No conceptual failures in this session.</p>
        )}
      </Panel>
      <Panel title="Concepts missed and confused">
        <div className="space-y-3 text-sm">
          <div>
            <div className="eyebrow mb-1">Concepts at the failing step</div>
            {report.concepts.missed.length ? (
              <ul className="space-y-1">
                {report.concepts.missed.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>{m.label}</span>
                    <PositionList positions={m.positions} onOpen={openQuestion} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">None.</p>
            )}
          </div>
          <div>
            <div className="eyebrow mb-1">Confused pairs</div>
            {report.concepts.confused.length ? (
              <ul className="space-y-1">
                {report.concepts.confused.map((c) => (
                  <li key={`${c.a}|${c.b}`} className="flex items-center justify-between gap-2">
                    <span>
                      {c.aLabel} ↔ {c.bLabel}
                    </span>
                    <PositionList positions={c.positions} onOpen={openQuestion} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">None.</p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
