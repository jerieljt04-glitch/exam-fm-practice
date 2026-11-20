import type { scoreTrend } from "@/lib/server/repository";

type Point = Awaited<ReturnType<typeof scoreTrend>>[number];

const W = 640;
const H = 220;
const PAD = { left: 40, right: 16, top: 16, bottom: 28 };

/**
 * Score per submitted session (overall and SOA-standard questions only),
 * oldest to newest, against the pass mark. Plain SVG, no client code.
 */
export function ScoreTrendChart({ points, passMark, compact = false }: { points: Point[]; passMark: number; compact?: boolean }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">The trend appears after two submitted sessions. Each new session adds a point.</p>;
  }
  const h = compact ? 160 : H;
  const plotW = W - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const x = (k: number) => PAD.left + (points.length === 1 ? plotW / 2 : (k * plotW) / (points.length - 1));
  const y = (v: number) => PAD.top + (1 - v) * plotH;
  const line = (values: Array<number | null>) =>
    values
      .map((v, k) => (v === null ? null : `${x(k).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  const standard = points.map((p) => p.standard);
  const hasStandard = standard.filter((v) => v !== null).length >= 2;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${h}`} className="h-auto w-full" role="img" aria-label={`Score trend over ${points.length} sessions; latest ${Math.round(points[points.length - 1].score * 100)}%`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="hsl(var(--viz-grid))" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(g) + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(passMark)} y2={y(passMark)} stroke="hsl(var(--success))" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={W - PAD.right} y={y(passMark) - 6} textAnchor="end" fontSize={11} fontWeight={500} fill="hsl(var(--success-ink))">
          pass mark ≈ {Math.round(passMark * 100)}%
        </text>
        {hasStandard && <polyline points={line(standard)} fill="none" stroke="hsl(var(--viz-balance))" strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" />}
        <polyline points={line(points.map((p) => p.score))} fill="none" stroke="hsl(var(--viz-out))" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, k) => (
          <circle key={p.id} cx={x(k)} cy={y(p.score)} r={4} fill="hsl(var(--viz-out))" stroke="hsl(var(--card))" strokeWidth={2}>
            <title>{`${p.modeLabel} · ${p.at.slice(0, 10)} · ${Math.round(p.score * 100)}% of ${p.total}${p.standard !== null ? ` · SOA-standard ${Math.round(p.standard * 100)}%` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-[hsl(var(--viz-out))]" /> Session score
        </span>
        {hasStandard && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-[hsl(var(--viz-balance))]" /> SOA-standard questions only
          </span>
        )}
        <span>Oldest on the left; hover a point for details.</span>
      </figcaption>
    </figure>
  );
}
