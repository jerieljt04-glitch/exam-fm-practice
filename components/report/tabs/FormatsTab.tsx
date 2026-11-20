"use client";

import { Meter, Panel } from "@/components/ui";
import { formatClock } from "@/lib/timer";
import { pct } from "@/lib/utils";

import { toneFor, type ReportContext } from "../shared";

export function FormatsTab({ ctx }: { ctx: ReportContext }) {
  const { report } = ctx;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Numerical versus non-numerical answers">
        <div className="space-y-3">
          {report.formats.split.map((r) => (
            <div key={r.kind}>
              <div className="flex justify-between text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {r.correct}/{r.total} · {pct(r.correct, r.total)} · avg {formatClock(r.averageSeconds)}
                </span>
              </div>
              <Meter value={r.total ? r.correct / r.total : null} tone={toneFor(r.total ? r.correct / r.total : null)} />
            </div>
          ))}
          {report.formats.practice.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {report.formats.practice.map((p) => `${p.label}: ${p.correct}/${p.total}`).join(" · ")}
            </p>
          )}
        </div>
      </Panel>
      <Panel title="Accuracy by question format">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Format</th>
              <th className="font-normal">Correct</th>
              <th className="font-normal">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {report.formats.byFormat.map((f) => (
              <tr key={f.format} className="border-t">
                <td className="py-1 pr-2">{f.label}</td>
                <td>
                  {f.correct}/{f.total}
                </td>
                <td>{formatClock(f.averageSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Time by format and difficulty">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Format</th>
              <th className="font-normal">Level</th>
              <th className="font-normal">Questions</th>
              <th className="font-normal">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {report.formats.time.map((t) => (
              <tr key={`${t.format}-${t.level}`} className="border-t">
                <td className="py-1 pr-2">{t.label}</td>
                <td>{t.level}</td>
                <td>{t.total}</td>
                <td>{formatClock(t.averageSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Reasoning depth (structural, from each question's chain)">
        <div className="space-y-3">
          {report.formats.depth.map((d) => (
            <div key={d.steps}>
              <div className="flex justify-between text-sm">
                <span>{d.steps}</span>
                <span className="tabular-nums">
                  {d.correct}/{d.total} · avg {formatClock(d.averageSeconds)}
                </span>
              </div>
              <Meter value={d.total ? d.correct / d.total : null} tone={toneFor(d.total ? d.correct / d.total : null)} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Steps are counted from each question&apos;s formula or concept chain — a structural measure of depth, not a psychometric difficulty estimate.
          </p>
        </div>
      </Panel>
    </div>
  );
}
