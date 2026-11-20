"use client";

import type { DiagnosticReport } from "@/lib/analysis/report";

/** What every report tab receives. */
export interface ReportContext {
  report: DiagnosticReport;
  openQuestion: (position: number) => void;
  remediationDue: number;
  starting: boolean;
  startRemediation: () => Promise<void>;
}

export const toneFor = (score: number | null) => (score === null ? "neutral" : score >= 0.75 ? "good" : score >= 0.5 ? "warn" : "bad");

export function PositionList({ positions, onOpen }: { positions: number[]; onOpen: (p: number) => void }) {
  if (!positions.length) return <span className="text-muted-foreground">none</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {positions.map((p) => (
        <button key={p} onClick={() => onOpen(p)} className="rounded-pill border px-2 text-xs tabular-nums hover:bg-primary/[0.08]">
          Q{p}
        </button>
      ))}
    </span>
  );
}
