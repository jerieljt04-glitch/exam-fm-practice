"use client";

import { Panel } from "@/components/ui";
import { formatClock } from "@/lib/timer";
import { cn, pct } from "@/lib/utils";

import { PositionList, type ReportContext } from "../shared";

export function CalibrationTab({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion } = ctx;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Confidence against outcome">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Confidence</th>
                <th>Answers</th>
                <th>Correct</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {report.confidence.table.map((row) => (
                <tr key={row.level} className="border-t">
                  <td className="py-1">{row.label}</td>
                  <td>{row.total}</td>
                  <td>{row.correct}</td>
                  <td>{pct(row.correct, row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Questions to look at">
          <dl className="space-y-2 text-sm">
            {(
              [
                ["High confidence, incorrect (overconfidence)", report.confidence.highConfidenceWrong],
                ["Low confidence, correct", report.confidence.lowConfidenceCorrect],
                ["Correct, but reasoning not evidenced", report.confidence.weakReasoningCorrect],
                ["Correct method in working, wrong result", report.confidence.methodRightExecutionWrong],
              ] as Array<[string, number[]]>
            ).map(([label, positions]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-2">
                <dt>{label}</dt>
                <dd>
                  <PositionList positions={positions} onOpen={openQuestion} />
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <Panel title="Where errors cluster (time pressure analysis)">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Question feature</th>
              <th>Error rate with it</th>
              <th>Error rate without it</th>
            </tr>
          </thead>
          <tbody>
            {report.timing.comparisons.map((c) => (
              <tr key={c.label} className="border-t">
                <td className="py-1">{c.label}</td>
                <td className={cn(c.withCount && c.withoutCount && c.withErrors / c.withCount > c.withoutErrors / c.withoutCount + 0.15 && "font-semibold text-destructive")}>
                  {c.withCount ? `${c.withErrors}/${c.withCount} (${pct(c.withErrors, c.withCount)})` : "—"}
                </td>
                <td>{c.withoutCount ? `${c.withoutErrors}/${c.withoutCount} (${pct(c.withoutErrors, c.withoutCount)})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          “Unusually long” means more than {formatClock(report.timing.thresholdSeconds)}. These are observed counts; with few questions in a group, a difference may be chance.
        </p>
      </Panel>
    </div>
  );
}
