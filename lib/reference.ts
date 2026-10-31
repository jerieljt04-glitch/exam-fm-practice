/**
 * How much formula support a session gives while answering.
 *
 * closed       — no formulas, names or hints (always used for diagnostics, exams and challenges);
 * supported    — the formula library, including a list of this question's formulas, is open while working;
 * integration  — nothing is shown while working; the formula chain is revealed only after submission.
 */
export type ReferenceMode = "closed" | "supported" | "integration";

export const REFERENCE_LABELS: Record<ReferenceMode, string> = {
  closed: "Closed book",
  supported: "Formula-supported learning",
  integration: "Formula integration practice",
};
