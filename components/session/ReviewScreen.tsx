"use client";

import { Flag } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { CONFIDENCE_LABELS, type Confidence } from "@/lib/engine/skills";
import { cn } from "@/lib/utils";

export type ReviewFilter = "all" | "flagged" | "unanswered" | "incomplete";

export interface ReviewItem {
  index: number;
  answered: boolean;
  flagged: boolean;
  confidence: Confidence | null;
}

/**
 * The end-of-section review screen, after the Prometric exam interface: every
 * question with its status, and buttons to review all, flagged, or unanswered
 * questions before ending the exam.
 */
export function ReviewScreen({
  items,
  confidenceRequired,
  remainingLabel,
  submitting,
  onReview,
  onJump,
  onReturn,
  onEnd,
}: {
  items: ReviewItem[];
  confidenceRequired: boolean;
  remainingLabel: string | null;
  submitting: boolean;
  onReview: (filter: ReviewFilter) => void;
  onJump: (index: number) => void;
  onReturn: () => void;
  onEnd: () => void;
}) {
  const unanswered = items.filter((i) => !i.answered).length;
  const flagged = items.filter((i) => i.flagged).length;
  const incomplete = items.filter((i) => i.answered && !i.confidence).length;
  const blocked = confidenceRequired && incomplete > 0;

  return (
    <section className="panel animate-rise p-6 sm:p-8" aria-labelledby="review-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="review-title" className="font-display text-2xl font-semibold">
            Review screen
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length - unanswered} of {items.length} answered · {flagged} flagged{remainingLabel ? ` · ${remainingLabel} remaining` : ""}. Select a question to go to it, or review a group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" onClick={() => onReview("all")}>
            Review all
          </Button>
          <Button variant="tonal" onClick={() => onReview("flagged")} disabled={flagged === 0}>
            Review flagged ({flagged})
          </Button>
          <Button variant="tonal" onClick={() => onReview("unanswered")} disabled={unanswered === 0}>
            Review unanswered ({unanswered})
          </Button>
          {confidenceRequired && incomplete > 0 && (
            <Button variant="tonal" onClick={() => onReview("incomplete")}>
              Missing confidence ({incomplete})
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {items.map((item) => (
          <button
            key={item.index}
            role="listitem"
            type="button"
            onClick={() => onJump(item.index)}
            className={cn("flex items-center justify-between gap-3 rounded-field bg-elevated px-4 py-3 text-left text-sm hover:shadow-resting", !item.answered && "ring-1 ring-inset ring-warning/50")}
          >
            <span className="font-medium tabular-nums">Question {item.index + 1}</span>
            <span className="flex items-center gap-2">
              {item.flagged && <Flag aria-label="flagged" size={14} strokeWidth={1.75} className="text-warning" />}
              {item.answered ? (
                <Badge tone={confidenceRequired && !item.confidence ? "warn" : "good"}>{item.confidence ? `Answered · ${CONFIDENCE_LABELS[item.confidence]}` : "Answered"}</Badge>
              ) : (
                <Badge tone="warn">Unanswered</Badge>
              )}
            </span>
          </button>
        ))}
      </div>

      {blocked && (
        <p className="mt-4 rounded-field bg-warning-container px-4 py-3 text-sm text-warning" role="status">
          This session measures how confidence relates to accuracy: record a confidence rating for every answered question before ending it.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-5">
        <Button variant="outlined" onClick={onReturn}>
          Return to the question
        </Button>
        <Button variant="danger" onClick={onEnd} disabled={submitting || blocked}>
          {submitting ? "Submitting…" : "End exam and see the report"}
        </Button>
      </div>
    </section>
  );
}
