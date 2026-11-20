"use client";

import Link from "next/link";

import { Meter, Panel } from "@/components/ui";
import { pct } from "@/lib/utils";

import { PositionList, toneFor, type ReportContext } from "../shared";

export function ChainsTab({ ctx }: { ctx: ReportContext }) {
  const { report, openQuestion } = ctx;
  return (
    <div className="space-y-4">
      <Panel title="Accuracy by formula-integration level">
        <div className="space-y-2">
          {report.chains.byLevel.map((row) => (
            <div key={row.level} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span>
                Level {row.level}: {row.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {row.correct} / {row.total} · {pct(row.correct, row.total)}
              </span>
              <Meter value={row.total ? row.correct / row.total : 0} tone={toneFor(row.total ? row.correct / row.total : null)} className="col-span-2" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Where the wrong answers left the formula chain">
        {report.chains.breaks.length ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {report.chains.byKind.map((k) => (
                <div key={k.kind} className="rounded-md border p-3">
                  <div className="text-2xl font-semibold tabular-nums">{k.count}</div>
                  <div className="font-medium">{k.label}</div>
                  <div className="mt-1">
                    <PositionList positions={k.positions} onOpen={openQuestion} />
                  </div>
                </div>
              ))}
            </div>
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Question</th>
                  <th>Step</th>
                  <th>Formula at that step</th>
                  <th>Kind of error</th>
                </tr>
              </thead>
              <tbody>
                {report.chains.breaks.map((b) => (
                  <tr key={b.position} className="border-t">
                    <td className="py-1.5">
                      <PositionList positions={[b.position]} onOpen={openQuestion} />
                    </td>
                    <td className="tabular-nums">
                      {b.stage + 1} of {b.steps}
                    </td>
                    <td>{b.formulaName}</td>
                    <td>{b.kind === "selection" && b.wrongFormula ? "Selecting the right formula (substituted another)" : report.chains.byKind.find((k) => k.kind === b.kind)?.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.chains.formulas.some((f) => f.count > 1) && (
              <p>
                <b>Recurring:</b>{" "}
                {report.chains.formulas
                  .filter((f) => f.count > 1)
                  .map((f) => `${f.name} (${f.count}×)`)
                  .join(", ")}
                . Check this formula’s conditions and common misuse in the{" "}
                <Link href="/formulas" className="text-primary hover:underline">
                  formula library
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No wrong answer in this session, so no chain break to locate.</p>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">
        Each wrong option was generated from a specific mistake at a specific step of the solution, so the step is known exactly from the option chosen. Whether the mistake was in choosing the formula, applying it, linking it to the next step or reading the result is the
        kind recorded for that option; your working, when it contains intermediate values, is used to confirm it in the question review.
      </p>
    </div>
  );
}
