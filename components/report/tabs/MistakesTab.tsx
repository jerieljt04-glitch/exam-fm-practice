"use client";

import { Badge, Button, Panel } from "@/components/ui";

import { PositionList, type ReportContext } from "../shared";

export function MistakesTab({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion, remediationDue, starting, startRemediation } = ctx;
  return (
    <div className="space-y-4">
      <Panel title="Mistakes your chosen answers correspond to">
        {report.misconceptions.length ? (
          <div className="space-y-3">
            {report.misconceptions.map((m) => (
              <div key={m.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.label}</span>
                  <Badge tone="bad">{m.category}</Badge>
                  <span className="text-muted-foreground">
                    ×{m.count} — <PositionList positions={m.positions} onOpen={openQuestion} />
                  </span>
                </div>
                <p className="mt-1">
                  <b>Correct relationship:</b> {m.principle}
                </p>
                <p className="mt-1 text-muted-foreground">
                  <b>Recognise it:</b> {m.recognition}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No distractor was chosen in this session.</p>
        )}
      </Panel>
      {report.categories.length > 0 && (
        <Panel title="By category">
          <div className="flex flex-wrap gap-2">
            {report.categories.map((c) => (
              <Badge key={c.category}>
                {c.label}: {c.count}
              </Badge>
            ))}
          </div>
        </Panel>
      )}
      {report.remediation.length > 0 && (
        <Panel title="Remediation" action={remediationDue > 0 ? <Button size="sm" onClick={() => void startRemediation()} disabled={starting}>Start remediation set</Button> : undefined}>
          <p className="text-sm">
            Each mistake above opens a remediation item. The next remediation set gives two new problems on the same principle from different templates; when both are answered correctly the item is retested after 24 hours before it counts as corrected.
          </p>
        </Panel>
      )}
    </div>
  );
}
