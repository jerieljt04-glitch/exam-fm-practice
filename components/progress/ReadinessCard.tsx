import type { Analytics } from "@/lib/server/repository";
import { cn } from "@/lib/utils";

const VERDICT: Record<Analytics["readiness"]["verdict"], { text: string; tone: string }> = {
  insufficient: { text: "Not enough exam-style answers yet for an estimate", tone: "text-muted-foreground" },
  ready: { text: "On track: comfortably above the pass mark", tone: "text-success" },
  borderline: { text: "Borderline: the pass mark is inside the likely range", tone: "text-warning" },
  "not-yet": { text: "Not yet: below the pass mark", tone: "text-destructive" },
};

/**
 * Exam readiness: SOA-standard accuracy over the latest exam-style questions,
 * with a 90% range, against the pass mark. An estimate from practice, not an
 * official prediction.
 */
export function ReadinessCard({ readiness, className }: { readiness: Analytics["readiness"]; className?: string }) {
  const { estimate, low, high, passMark, sample, verdict } = readiness;
  const v = VERDICT[verdict];
  return (
    <section className={cn("panel p-6", className)} aria-labelledby="readiness-title">
      <h2 id="readiness-title" className="text-base font-medium">
        Exam readiness
      </h2>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-[40px] font-semibold leading-none tabular-nums">{estimate === null ? "—" : `${Math.round(estimate * 100)}%`}</span>
        {low !== null && high !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            likely {Math.round(low * 100)}–{Math.round(high * 100)}%
          </span>
        )}
      </div>
      <p className={cn("mt-1 text-sm font-medium", v.tone)}>{v.text}</p>
      <div className="relative mt-4 h-3 w-full rounded-pill bg-secondary" role="img" aria-label={estimate === null ? "No estimate yet" : `Estimate ${Math.round(estimate * 100)}%, pass mark ${Math.round(passMark * 100)}%`}>
        {low !== null && high !== null && <div className="absolute inset-y-0 rounded-pill bg-primary/30" style={{ left: `${low * 100}%`, width: `${Math.max(1, (high - low) * 100)}%` }} />}
        {estimate !== null && <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-resting" style={{ left: `${estimate * 100}%` }} />}
        <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-success" style={{ left: `${passMark * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>0%</span>
        <span className="text-success">pass ≈ {Math.round(passMark * 100)}%</span>
        <span>100%</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        From your latest {sample} SOA-standard answers in exams, diagnostics and concept sessions (Challenge and formula practice excluded). The SOA sets the pass mark per sitting; about 70% is the usual guide.
      </p>
    </section>
  );
}
