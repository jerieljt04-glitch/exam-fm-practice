import { chainPairs } from "../formulas/graph";
import { FORMULAS, FORMULA_BY_ID } from "../formulas/registry";
import { AREA_LABELS, type FormulaArea } from "../formulas/types";
import { classifyAttempt, type AttemptEvidence, type AttemptRecord } from "./attempts";

/**
 * Formula mastery, measured separately from question accuracy.
 *
 * Each attempt is read against its formula chain. A correct, non-guessed
 * answer counts as every step passing. A wrong answer whose option is tied to
 * step k counts steps before k as passing (inferred), step k as failing in the
 * way that option's mistake describes, and says nothing about later steps.
 */

export const FORMULA_DIMENSIONS = ["recognise", "retrieve", "apply", "rearrange", "derive", "combine", "unfamiliar", "notApplicable"] as const;
export type FormulaDimension = (typeof FORMULA_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<FormulaDimension, string> = {
  recognise: "Recognises when it applies",
  retrieve: "Retrieves the right formula",
  apply: "Applies it correctly",
  rearrange: "Rearranges it",
  derive: "Derives it from a simpler relationship",
  combine: "Combines it with another formula",
  unfamiliar: "Uses it in an unfamiliar presentation",
  notApplicable: "Recognises when it does not apply",
};

export type FormulaStatus = "NOT_TESTED" | "WEAK" | "DEVELOPING" | "SECURE" | "MASTERED";

export interface FormulaMastery {
  formula: string;
  name: string;
  area: FormulaArea;
  areaLabel: string;
  uses: number;
  passes: number;
  fails: number;
  templates: number;
  dimensions: Record<FormulaDimension, { success: number; fail: number }>;
  status: FormulaStatus;
  reason: string;
}

export interface CombinationMastery {
  from: string;
  to: string;
  label: string;
  attempts: number;
  success: number;
}

type StepOutcome = "pass" | "fail" | "unknown";

function stepOutcomes(attempt: AttemptRecord, e: AttemptEvidence): StepOutcome[] {
  const n = attempt.instance.chain.steps.length;
  if (!e.answered || (e.correct && e.quality === "POSSIBLE_GUESS")) return Array(n).fill("unknown");
  if (e.correct) return Array(n).fill("pass");
  const k = e.chainStage ?? n - 1;
  return Array.from({ length: n }, (_, idx) => (idx < k ? "pass" : idx === k ? "fail" : "unknown"));
}

function emptyDimensions(): FormulaMastery["dimensions"] {
  return Object.fromEntries(FORMULA_DIMENSIONS.map((d) => [d, { success: 0, fail: 0 }])) as FormulaMastery["dimensions"];
}

export function formulaMastery(history: readonly AttemptRecord[]): { formulas: FormulaMastery[]; combinations: CombinationMastery[] } {
  const acc = new Map<string, { passes: number; fails: number; uses: number; templates: Set<string>; recent: StepOutcome[]; dims: FormulaMastery["dimensions"] }>();
  const combos = new Map<string, CombinationMastery>();
  const get = (id: string) => {
    let entry = acc.get(id);
    if (!entry) {
      entry = { passes: 0, fails: 0, uses: 0, templates: new Set(), recent: [], dims: emptyDimensions() };
      acc.set(id, entry);
    }
    return entry;
  };

  const ordered = [...history].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.position - b.position);
  for (const attempt of ordered) {
    const e = classifyAttempt(attempt);
    const steps = attempt.instance.chain.steps;
    const outcomes = stepOutcomes(attempt, e);
    const distinct = new Set(steps.map((s) => s.formula)).size;
    steps.forEach((step, idx) => {
      const entry = get(step.formula);
      const outcome = outcomes[idx];
      entry.uses += 1;
      entry.templates.add(attempt.instance.templateId);
      if (outcome === "unknown") return;
      entry.recent.push(outcome);
      const ok = outcome === "pass";
      if (ok) entry.passes += 1;
      else entry.fails += 1;
      const d = entry.dims;
      const kind = e.chainError;
      const bump = (dim: FormulaDimension, success: boolean) => (success ? (d[dim].success += 1) : (d[dim].fail += 1));
      if (ok) {
        bump("recognise", true);
        bump("retrieve", true);
        bump("apply", true);
      } else if (kind === "selection") {
        bump(e.wrongFormula ? "retrieve" : "recognise", false);
      } else if (kind === "application") {
        bump("apply", false);
      }
      if (step.rearranged) bump("rearrange", ok);
      if (step.derived) bump("derive", ok);
      if (distinct >= 2) {
        if (ok) bump("combine", true);
        else if (kind === "connection") bump("combine", false);
      }
      if (attempt.instance.features.unfamiliar) bump("unfamiliar", ok);
    });
    // Recognising when a formula does NOT apply: options built on substituting it.
    if (e.answered) {
      for (const option of attempt.instance.options) {
        if (!option.wrongFormula) continue;
        const entry = get(option.wrongFormula);
        if (option.key === attempt.selectedKey) entry.dims.notApplicable.fail += 1;
        else entry.dims.notApplicable.success += 1;
      }
    }
    // Formula combinations: consecutive formulas in the chain.
    const ids = steps.map((s) => s.formula);
    chainPairs(ids).forEach(([from, to]) => {
      const key = `${from}→${to}`;
      const entry = combos.get(key) ?? { from, to, label: `${FORMULA_BY_ID[from]?.name ?? from} → ${FORMULA_BY_ID[to]?.name ?? to}`, attempts: 0, success: 0 };
      const toIndex = ids.lastIndexOf(to);
      if (outcomes[toIndex] !== "unknown") {
        entry.attempts += 1;
        if (outcomes[toIndex] === "pass") entry.success += 1;
      }
      combos.set(key, entry);
    });
  }

  const formulas = FORMULAS.map((formula): FormulaMastery => {
    const entry = acc.get(formula.id);
    const dims = entry?.dims ?? emptyDimensions();
    const passes = entry?.passes ?? 0;
    const fails = entry?.fails ?? 0;
    const templates = entry?.templates.size ?? 0;
    const recent = entry?.recent.slice(-3) ?? [];
    let status: FormulaStatus;
    let reason: string;
    if (!entry || passes + fails === 0) {
      status = "NOT_TESTED";
      reason = "No evidence yet.";
    } else if (passes + fails >= 2 && fails >= passes) {
      status = "WEAK";
      reason = `${fails} failed use${fails === 1 ? "" : "s"} against ${passes} successful.`;
    } else if (passes >= 3 && templates >= 3 && dims.combine.success >= 1 && dims.unfamiliar.success >= 1 && recent.every((r) => r === "pass")) {
      status = "MASTERED";
      reason = `Used successfully in ${templates} presentations, combined with other formulas and in an unfamiliar setting.`;
    } else if (passes >= 2 && templates >= 2 && passes / (passes + fails) >= 0.75) {
      const missing = [
        templates < 3 ? "a third presentation" : null,
        dims.combine.success < 1 ? "a combination with another formula" : null,
        dims.unfamiliar.success < 1 ? "an unfamiliar presentation" : null,
      ].filter(Boolean);
      status = "SECURE";
      reason = missing.length ? `Needs ${missing.join(", ")} to count as mastered.` : "Needs three successful uses in a row.";
    } else {
      status = "DEVELOPING";
      reason = `${passes} of ${passes + fails} uses successful.`;
    }
    return { formula: formula.id, name: formula.name, area: formula.area, areaLabel: AREA_LABELS[formula.area], uses: entry?.uses ?? 0, passes, fails, templates, dimensions: dims, status, reason };
  });

  return { formulas, combinations: [...combos.values()].sort((a, b) => b.attempts - a.attempts) };
}
