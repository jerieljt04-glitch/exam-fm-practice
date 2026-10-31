/**
 * Structured formula library built from the two reference sheets in
 * reference_material/formula_sheets/:
 *
 *   TIA   — "FM Formula Sheets", The Infinite Actuary, last updated 2026-08-10 (15 pages)
 *   ACTEX — "Exam FM Formula & Review Sheet", ACTEX Learning, updated 2023-06-29 (5 pages)
 *
 * Each canonical formula keeps every source's own notation and page reference.
 * Formulas the sheets state differently are cross-referenced only after their
 * equivalence has been checked (numerically, in scripts/tests/formulas.test.ts);
 * genuine differences are recorded as discrepancies rather than merged.
 */

export type FormulaArea = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "M";

export const AREA_LABELS: Record<FormulaArea, string> = {
  A: "Basics of interest",
  B: "Annuities",
  C: "Yield rates",
  D: "Amortization",
  E: "Bonds and securities",
  F: "Term structure",
  G: "Duration, convexity and immunization",
  M: "General mathematics (not on either sheet)",
};

export type SourceDoc = "TIA" | "ACTEX" | "DERIVED";

export const SOURCE_LABELS: Record<SourceDoc, string> = {
  TIA: "TIA FM Formula Sheets (2026-08-10)",
  ACTEX: "ACTEX Exam FM Formula & Review Sheet (2023-06-29)",
  DERIVED: "Derived in this application (not printed on either sheet)",
};

export const SOURCE_FILES: Record<Exclude<SourceDoc, "DERIVED">, string> = {
  TIA: "reference_material/formula_sheets/FM_Formula_Sheets_20260810.pdf",
  ACTEX: "reference_material/formula_sheets/FM_FS (1).pdf",
};

export interface FormulaSource {
  doc: SourceDoc;
  /** Page number within the PDF file (1-based). */
  page: number;
  /** The page or sheet label printed on the page. */
  label: string;
  section: string;
  /** The formula exactly as that source writes it (KaTeX). */
  notation: string;
}

/**
 * core        — directly assessed by the current syllabus learning outcomes.
 * supporting  — a technique or identity that serves core formulas.
 * unclear     — on a sheet, but its relevance to the December 2026 syllabus is
 *               uncertain; never required by the core question bank.
 */
export type Relevance = "core" | "supporting" | "unclear";

export interface Formula {
  id: string;
  name: string;
  area: FormulaArea;
  /** Canonical statement used throughout the app (KaTeX). */
  expression: string;
  canonicalNotation: string;
  alternativeNotations: string[];
  sources: FormulaSource[];
  variables: { symbol: string; meaning: string }[];
  assumptions: string[];
  conditions: string[];
  meaning: string;
  related: string[];
  prerequisites: string[];
  misuse: string[];
  applications: string[];
  derivation: string;
  /** SOA syllabus learning outcome ids (lib/syllabus.ts). */
  outcomes: string[];
  relevance: Relevance;
  relevanceNote?: string;
  /** Genuine disagreement or notation conflict between the sheets, flagged for manual verification. */
  discrepancy?: string;
}
