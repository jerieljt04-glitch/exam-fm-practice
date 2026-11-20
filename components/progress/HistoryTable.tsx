import Link from "next/link";

import { LocalTime } from "@/components/LocalTime";
import type { SessionSummary } from "@/lib/server/repository";
import { pct } from "@/lib/utils";

/** Submitted sessions, newest first, one page at a time. */
export function HistoryTable({ rows, page, pages, total, base }: { rows: SessionSummary[]; page: number; pages: number; total: number; base: string }) {
  if (!total) return <p className="text-sm text-muted-foreground">No completed sessions yet. A 15-question diagnostic is a good first step.</p>;
  const link = (p: number) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Submitted</th>
              <th className="font-medium">Mode</th>
              <th className="font-medium">Score</th>
              <th className="font-medium">SOA-standard</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2">{s.submittedAt ? <LocalTime iso={s.submittedAt} /> : "—"}</td>
                <td>{s.modeLabel}</td>
                <td>
                  {s.correct}/{s.total} ({pct(s.correct, s.total)})
                </td>
                <td>{s.standardTotal ? `${s.standardCorrect}/${s.standardTotal}` : "—"}</td>
                <td className="text-right">
                  <Link href={`/session/${s.id}/report`} className="font-medium text-primary hover:underline">
                    Report
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="History pages">
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} sessions
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Link href={link(page - 1)} className="rounded-pill border px-4 py-1.5 font-medium text-primary hover:bg-primary/[0.08]">
                Newer
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={link(page + 1)} className="rounded-pill border px-4 py-1.5 font-medium text-primary hover:bg-primary/[0.08]">
                Older
              </Link>
            ) : null}
          </span>
        </nav>
      )}
    </div>
  );
}
