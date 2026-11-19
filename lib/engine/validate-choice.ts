import { getConcept } from "../concepts/registry";
import { getFormula } from "../formulas/registry";
import { OUTCOMES } from "../syllabus";
import {
  contentDisplay,
  contentLength,
  contentMarkup,
  exhibitMarkup,
  normalizedContent,
  sortStatementKeys,
  type OptionContent,
} from "./answers";
import { evaluate, isEquation, solveEquation } from "./expr";
import { displayedValue, formatAnswer } from "./format";
import { getMisconception } from "./misconceptions";
import type {
  AnswerFormat,
  ChoiceCandidate,
  ChoiceDraft,
  ChoiceTemplate,
  Difficulty,
  TruthCheck,
  ValidationCheck,
  ValidationRecord,
} from "./types";
import { CONCEPT_FAILURES } from "./types";
import { minimumGap, typesetError } from "./validate";

/**
 * The validation gate for questions whose options are typed content rather
 * than a single number: text, mathematical expressions, statement
 * combinations and composite values. Nothing the template asserts is taken on
 * trust where it can be checked:
 *
 *  - statement truth values are re-derived from each statement's quantitative
 *    check where it has one, and the correct combination must be exactly the
 *    set of true statements;
 *  - every numeric or composite component is recomputed from its own
 *    arithmetic and the correct one must agree with the independent reference;
 *  - equation and expression options are probed numerically: the correct one
 *    must define the reference quantity, no distractor may, and two options
 *    that define the same quantity are rejected as equivalent;
 *  - truth checks attached to options must hold for the correct option and
 *    fail for distractors;
 *  - all five options must be distinct after normalisation, of one content
 *    type, tied to five different misconceptions, and the correct option must
 *    not stand out by length;
 *  - every option, statement and explanation must typeset, every outcome and
 *    concept id must exist, and a concept question needs a concept chain that
 *    places each distractor at a real step with a valid failure type.
 */

export interface SelectedChoice {
  isCorrect: boolean;
  candidate: ChoiceCandidate;
  display: string;
  /** Authored position: the correct option is 0, distractors keep their order. */
  index: number;
}

export interface ChoiceValidationOutcome {
  ok: boolean;
  record: ValidationRecord;
  options: SelectedChoice[];
}

const REL = 1e-6;
/** The correct option may be at most this many times the mean distractor length. */
export const LENGTH_RATIO_LIMIT = 1.6;

const relClose = (a: number, b: number, tol = REL) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

export function evaluateCheck(check: TruthCheck): boolean {
  const lhs = evaluate(check.expr);
  const rhs = typeof check.than === "number" ? check.than : evaluate(check.than);
  if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) throw new Error(`check is not finite: ${check.expr}`);
  const tol = check.tol ?? REL;
  switch (check.op) {
    case "<":
      return lhs < rhs && !relClose(lhs, rhs, tol);
    case "<=":
      return lhs <= rhs || relClose(lhs, rhs, tol);
    case ">":
      return lhs > rhs && !relClose(lhs, rhs, tol);
    case ">=":
      return lhs >= rhs || relClose(lhs, rhs, tol);
    case "=":
      return relClose(lhs, rhs, tol);
    case "!=":
      return !relClose(lhs, rhs, tol);
  }
}

/** The quantity a math option's probe defines: its root near `near`, or its value. */
export function probeValue(probe: string, near: number): number | null {
  if (!isEquation(probe)) {
    const value = evaluate(probe);
    return Number.isFinite(value) ? value : null;
  }
  const span = Math.max(Math.abs(near) * 0.9, 1e-3);
  const roots = solveEquation(probe, [near - span, near + span]);
  if (!roots.length) return null;
  return roots.reduce((best, r) => (Math.abs(r - near) < Math.abs(best - near) ? r : best));
}

function referenceValue(entry: { label: string; expr: string; bracket?: [number, number] }): number {
  if (!isEquation(entry.expr)) return evaluate(entry.expr);
  if (!entry.bracket) throw new Error(`reference equation ${entry.label} needs a bracket`);
  const roots = solveEquation(entry.expr, entry.bracket);
  if (roots.length !== 1) throw new Error(`reference ${entry.expr.slice(0, 60)} has ${roots.length} roots on its bracket`);
  return roots[0];
}

function numericParts(content: OptionContent): { value: number; format: AnswerFormat }[] {
  if (content.type === "numeric") return [{ value: content.value, format: content.format }];
  if (content.type === "composite") return content.parts.map((p) => ({ value: p.value, format: p.format }));
  return [];
}

/** Two numeric/composite contents differ visibly in at least one component. */
function numericallyDistinct(a: OptionContent, b: OptionContent): boolean {
  const pa = numericParts(a);
  const pb = numericParts(b);
  if (pa.length !== pb.length) return true;
  return pa.some((p, k) => {
    const q = pb[k];
    if (formatAnswer(p.value, p.format) === formatAnswer(q.value, q.format)) return false;
    return Math.abs(displayedValue(p.value, p.format) - displayedValue(q.value, q.format)) >= minimumGap(p.value, q.value, p.format);
  });
}

export function validateChoiceDraft(
  draft: ChoiceDraft,
  template: Pick<ChoiceTemplate, "id" | "objective" | "secondary" | "practice" | "topic">,
  context: { level: Difficulty; seed: string; prefer?: ReadonlySet<string> }
): ChoiceValidationOutcome {
  const checks: ValidationCheck[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, ...(detail ? { detail: detail.slice(0, 300) } : {}) });
    return ok;
  };
  const rejectedCandidates: ValidationRecord["rejectedCandidates"] = [];
  const optionLog: ValidationRecord["options"] = [];
  const correct = draft.correct;
  const type = correct.content.type;
  const statementCount = draft.statements?.length ?? 3;

  // ---------------------------------------------------------- syllabus
  const outcomes = [template.objective, ...template.secondary];
  const unknownOutcomes = outcomes.filter((o) => !OUTCOMES[o]);
  check("every outcome is in the syllabus", unknownOutcomes.length === 0, unknownOutcomes.join(", "));
  check("primary outcome belongs to the template's topic", template.objective.startsWith(`${template.topic}.`), template.objective);

  // ---------------------------------------------------------- statements
  let trueKeys: string | null = null;
  if (draft.statements?.length) {
    const statements = draft.statements;
    const keys = statements.map((s) => s.key);
    check("statement keys are I, II, III… in order", keys.join(",") === ["I", "II", "III", "IV"].slice(0, keys.length).join(","), keys.join(","));
    check("at least two statements", statements.length >= 2);
    for (const s of statements) {
      check(`statement ${s.key} justified`, s.justification.trim().length > 0);
      check(`statement ${s.key} misconception known`, Boolean(getMisconception(s.misconception)), s.misconception);
      if (s.check) {
        try {
          const holds = evaluateCheck(s.check);
          check(`statement ${s.key} truth agrees with its independent check`, holds === s.truth, `declared ${s.truth}, check gives ${holds}`);
        } catch (error) {
          check(`statement ${s.key} check evaluates`, false, (error as Error).message);
        }
      }
    }
    trueKeys = sortStatementKeys(statements.filter((s) => s.truth).map((s) => s.key)).join("+");
    if (type === "statements") {
      const correctKeys = sortStatementKeys((correct.content as Extract<OptionContent, { type: "statements" }>).keys).join("+");
      check("correct combination is exactly the true statements", correctKeys === trueKeys, `correct ${correctKeys || "none"}, true ${trueKeys || "none"}`);
    }
  } else {
    check("statement combinations need statements", type !== "statements");
  }

  // ---------------------------------------------------------- reference
  let referenceValues: number[] = [];
  try {
    referenceValues = (draft.reference.values ?? []).map(referenceValue);
    check("reference values finite", referenceValues.every(Number.isFinite), referenceValues.join(", "));
  } catch (error) {
    check("reference evaluates", false, (error as Error).message);
  }
  check("reference described", draft.reference.description.trim().length > 0);

  // Numeric / composite: the correct option's components agree with the reference.
  const verifyComponents = (candidate: ChoiceCandidate): string | null => {
    const parts = numericParts(candidate.content);
    if (!parts.length) return null;
    if (!candidate.calc || candidate.calc.length !== parts.length) return "one calc expression per component is required";
    for (let k = 0; k < parts.length; k += 1) {
      if (!Number.isFinite(parts[k].value)) return `component ${k + 1} not finite`;
      try {
        const expr = candidate.calc[k];
        const recomputed = isEquation(expr) ? probeValue(expr, parts[k].value) : evaluate(expr);
        if (recomputed === null || !relClose(recomputed, parts[k].value, 1e-7)) return `component ${k + 1}: calc gives ${recomputed}, option states ${parts[k].value}`;
      } catch (error) {
        return `component ${k + 1} calc does not parse: ${(error as Error).message}`;
      }
    }
    return null;
  };

  if (type === "numeric" || type === "composite") {
    const parts = numericParts(correct.content);
    const problem = verifyComponents(correct);
    check("correct components recompute from their arithmetic", problem === null, problem ?? undefined);
    check("reference gives one value per component", referenceValues.length === parts.length, `${referenceValues.length} reference values for ${parts.length} components`);
    if (referenceValues.length === parts.length) {
      const mismatch = parts.findIndex((p, k) => !relClose(p.value, referenceValues[k], 1e-6));
      check("correct components agree with the independent reference", mismatch < 0, mismatch >= 0 ? `component ${mismatch + 1}: ${parts[mismatch].value} vs ${referenceValues[mismatch]}` : undefined);
    }
    if (type === "composite") {
      const formats = parts.map((p) => JSON.stringify(p.format));
      check("composite labels present", (correct.content as Extract<OptionContent, { type: "composite" }>).parts.every((p) => p.label.trim().length > 0));
      check("composite components formatted", formats.length >= 2);
    }
  }

  let correctProbe: number | null = null;
  if (type === "math") {
    check("math options carry a reference quantity or an explicit truth check", referenceValues.length === 1 || Boolean(correct.check), `${referenceValues.length} reference values`);
    if (correct.probe && referenceValues.length === 1) {
      try {
        correctProbe = probeValue(correct.probe, referenceValues[0]);
        check("correct expression defines the reference quantity", correctProbe !== null && relClose(correctProbe, referenceValues[0], 1e-6), `${correctProbe} vs ${referenceValues[0]}`);
      } catch (error) {
        check("correct probe evaluates", false, (error as Error).message);
      }
    } else {
      check("correct expression carries a probe or a check", Boolean(correct.probe) || Boolean(correct.check));
    }
  }

  if (correct.check) {
    try {
      check("correct option's claim holds", evaluateCheck(correct.check), correct.check.expr.slice(0, 80));
    } catch (error) {
      check("correct option's check evaluates", false, (error as Error).message);
    }
  }
  check("correct option explained", correct.explanation.trim().length > 0);
  check("correct option has no misconception", correct.misconception === undefined);

  // ---------------------------------------------------------- distractors
  const ordered = draft.distractors
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const pa = a.candidate.misconception && context.prefer?.has(a.candidate.misconception) ? 0 : 1;
      const pb = b.candidate.misconception && context.prefer?.has(b.candidate.misconception) ? 0 : 1;
      return pa - pb || a.index - b.index;
    });
  const chosen: { candidate: ChoiceCandidate; index: number }[] = [];
  const probes = new Map<ChoiceCandidate, number | null>();
  const conceptSteps = draft.concept?.steps.length ?? 0;

  for (const { candidate, index } of ordered) {
    const reject = (reason: string) => {
      rejectedCandidates.push({ misconception: candidate.misconception ?? "(none)", reason });
      optionLog.push({ misconception: candidate.misconception ?? "(none)", value: 0, calcValue: null, selected: false, display: contentDisplay(candidate.content, statementCount) });
    };
    const id = candidate.misconception;
    if (!id || !getMisconception(id)) {
      reject("unknown or missing misconception id");
      continue;
    }
    if (candidate.content.type !== type) {
      reject(`content type ${candidate.content.type} differs from the correct option's ${type}`);
      continue;
    }
    if (!candidate.explanation.trim() || !(candidate.method ?? "").trim()) {
      reject("explanation or method missing");
      continue;
    }
    if (normalizedContent(candidate.content) === normalizedContent(correct.content)) {
      reject("same as the correct option after normalisation");
      continue;
    }
    if ((type === "numeric" || type === "composite") && !numericallyDistinct(candidate.content, correct.content)) {
      reject("indistinguishable from the correct option");
      continue;
    }
    const componentProblem = verifyComponents(candidate);
    if (componentProblem) {
      reject(componentProblem);
      continue;
    }
    if (type === "statements" && trueKeys !== null) {
      const keys = sortStatementKeys((candidate.content as Extract<OptionContent, { type: "statements" }>).keys).join("+");
      if (keys === trueKeys) {
        reject("combination equals the set of true statements (a second correct option)");
        continue;
      }
      if ((candidate.content as Extract<OptionContent, { type: "statements" }>).keys.some((k) => !draft.statements!.some((s) => s.key === k))) {
        reject("names a statement that does not exist");
        continue;
      }
    }
    if (type === "math") {
      if (referenceValues.length === 1 && candidate.probe) {
        let value: number | null = null;
        try {
          value = probeValue(candidate.probe, referenceValues[0]);
        } catch (error) {
          reject(`probe does not evaluate: ${(error as Error).message}`);
          continue;
        }
        if (value !== null && relClose(value, referenceValues[0], 1e-6)) {
          reject("equivalent to the correct expression (defines the same quantity)");
          continue;
        }
        if (value !== null && [...probes.values()].some((other) => other !== null && relClose(other, value!, 1e-9))) {
          reject("equivalent to another distractor (defines the same quantity)");
          continue;
        }
        probes.set(candidate, value);
      } else if (!candidate.check && !candidate.probe && referenceValues.length === 1) {
        reject("math distractor needs a probe or a check so its falsity can be confirmed");
        continue;
      }
    }
    if (candidate.check) {
      try {
        if (evaluateCheck(candidate.check)) {
          reject("its claim holds, so it would also be correct");
          continue;
        }
      } catch (error) {
        reject(`check does not evaluate: ${(error as Error).message}`);
        continue;
      }
    }
    if (chosen.some((other) => other.candidate.misconception === id)) {
      reject("misconception already represented");
      continue;
    }
    if (chosen.some((other) => normalizedContent(other.candidate.content) === normalizedContent(candidate.content))) {
      reject("same as another distractor after normalisation");
      continue;
    }
    if ((type === "numeric" || type === "composite") && chosen.some((other) => !numericallyDistinct(other.candidate.content, candidate.content))) {
      reject("indistinguishable from another distractor");
      continue;
    }
    if (draft.concept) {
      const stage = candidate.stage ?? draft.concept.stages[id]?.stage;
      const kind = candidate.failure ?? draft.concept.stages[id]?.kind;
      if (stage === undefined || stage < 0 || stage >= conceptSteps || !kind || !(CONCEPT_FAILURES as readonly string[]).includes(kind)) {
        reject(`concept-chain stage missing or invalid (${stage}, ${kind})`);
        continue;
      }
    }
    if (candidate.confusedWith && !getConcept(candidate.confusedWith)) {
      reject(`confused concept ${candidate.confusedWith} is not in the concept registry`);
      continue;
    }
    if (chosen.length >= 4) {
      optionLog.push({ misconception: id, value: numericParts(candidate.content)[0]?.value ?? 0, calcValue: null, selected: false, display: contentDisplay(candidate.content, statementCount) });
      continue;
    }
    chosen.push({ candidate, index });
    optionLog.push({ misconception: id, value: numericParts(candidate.content)[0]?.value ?? 0, calcValue: numericParts(candidate.content)[0]?.value ?? null, selected: true, display: contentDisplay(candidate.content, statementCount) });
  }
  check("four distinct misconception distractors", chosen.length === 4, `${chosen.length} usable`);

  const all = [correct, ...chosen.map((c) => c.candidate)];
  const displays = all.map((c) => contentDisplay(c.content, statementCount));
  check("five options", all.length === 5, String(all.length));
  check("exactly one correct option", all.filter((c) => c === correct).length === 1 && chosen.every((c) => c.candidate.misconception));
  check("option displays unique", new Set(displays).size === all.length, displays.join(" | "));
  check("options share one content type", all.every((c) => c.content.type === type), all.map((c) => c.content.type).join(","));
  if (type === "text" || type === "math") {
    const lengths = chosen.map((c) => contentLength(c.candidate.content));
    const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 1;
    const ratio = contentLength(correct.content) / Math.max(mean, 1);
    check("correct option is not conspicuously longer than the others", ratio <= LENGTH_RATIO_LIMIT, `ratio ${ratio.toFixed(2)}`);
  }
  if (type === "numeric" || type === "composite") {
    const formats = all.map((c) => JSON.stringify(numericParts(c.content).map((p) => p.format)));
    check("options use one numerical format", new Set(formats).size === 1, [...new Set(formats)].join(" vs "));
  }

  // ---------------------------------------------------------- chains
  if (template.practice === "concept" || draft.concept) {
    const cc = draft.concept;
    check("concept chain present", Boolean(cc && cc.steps.length > 0 && cc.concepts.length > 0));
    if (cc) {
      const unknown = [...cc.concepts, ...cc.steps.map((s) => s.concept)].filter((id) => !getConcept(id));
      check("chain concepts exist in the registry", unknown.length === 0, [...new Set(unknown)].join(", "));
      check("chain steps reason", cc.steps.every((s) => s.reasoning.trim().length > 0));
      check("chain conditions stated", cc.conditions.length > 0);
      const foreign = cc.concepts.filter((id) => {
        const c = getConcept(id);
        return c && !c.outcomes.some((o) => OUTCOMES[o]);
      });
      check("chain concepts map to syllabus outcomes", foreign.length === 0, foreign.join(", "));
      const badStages = Object.entries(cc.stages).filter(([, s]) => !s || s.stage < 0 || s.stage >= cc.steps.length || !(CONCEPT_FAILURES as readonly string[]).includes(s.kind));
      check("concept trap stages valid", badStages.length === 0, badStages.map(([id]) => id).join(", "));
    }
  }
  if (draft.chain) {
    const steps = draft.chain.steps;
    const unknownFormulas = steps.filter((s) => !getFormula(s.formula)).map((s) => s.formula);
    check("chain formulas exist in the library", unknownFormulas.length === 0, unknownFormulas.join(", "));
    const unmapped = steps.filter((s) => {
      const formula = getFormula(s.formula);
      return formula && (formula.relevance === "unclear" || formula.outcomes.length === 0);
    });
    check("chain formulas are syllabus-mapped", unmapped.length === 0, unmapped.map((s) => s.formula).join(", "));
    check("chain values finite", steps.every((s) => Number.isFinite(s.output.value)));
    if (type === "numeric" || type === "composite") {
      const finalValues = steps.map((s) => s.output.value);
      const parts = numericParts(correct.content);
      const reached = parts.every((p) => finalValues.some((v) => relClose(v, p.value, 1e-6)));
      check("formula chain reaches every answer component", reached);
    }
    const badStages = Object.entries(draft.chain.stages).filter(([, trap]) => !trap || trap.stage < 0 || trap.stage >= steps.length);
    check("chain trap stages valid", badStages.length === 0, badStages.map(([id]) => id).join(", "));
  }
  for (const f of draft.formulas ?? []) check(`formula ${f} exists`, Boolean(getFormula(f)));

  // ---------------------------------------------------------- markup
  const e = draft.explanation;
  const markup = [
    draft.stem,
    ...(draft.exhibits ?? []).flatMap(exhibitMarkup),
    ...(draft.statements ?? []).flatMap((s) => [s.text, s.justification, s.conditionTrue ?? ""]),
    ...all.flatMap((c) => [...contentMarkup(c.content), c.explanation, c.method ?? "", c.derivation ?? "", c.conditionTrue ?? ""]),
    draft.relationship ?? "",
    draft.counterexample ?? "",
    e.intuition,
    ...e.solution.flatMap((s) => [s.title, s.body]),
    ...e.alternatives.flatMap((a) => [a.name, a.body, a.whenUseful]),
    e.transfer.principle,
    e.transfer.unusual,
    e.transfer.misread,
    ...(draft.concept?.steps.map((s) => s.reasoning) ?? []),
    ...(draft.concept?.conditions ?? []),
  ];
  const failures = markup.filter(Boolean).map(typesetError).filter((x): x is string => x !== null);
  check("all markup typesets", failures.length === 0, failures[0]);
  check("stem has no hint or topic label", !/\bhint\b|Time Value of Money|Asset-Liability|Annuities and Non-Contingent/i.test(draft.stem));
  check("transfer principle stated", e.transfer.principle.trim().length > 0);

  const ok = checks.every((c) => c.ok);
  const options: SelectedChoice[] = [
    { isCorrect: true, candidate: correct, display: displays[0], index: -1 },
    ...chosen.map((c, k) => ({ isCorrect: false, candidate: c.candidate, display: displays[k + 1], index: c.index })),
  ];
  const firstValue = numericParts(correct.content)[0]?.value ?? referenceValues[0] ?? 0;
  return {
    ok,
    options,
    record: {
      templateId: template.id,
      level: context.level,
      seed: context.seed,
      status: ok ? "PASSED" : "REJECTED",
      checks,
      model: [draft.reference.description, ...(draft.reference.values ?? []).map((v) => `${v.label}: ${v.expr}`)].join("\n").slice(0, 4000),
      correctValue: firstValue,
      modelValue: referenceValues[0] ?? correctProbe ?? null,
      options: optionLog,
      rejectedCandidates,
      validatedAt: new Date().toISOString(),
    },
  };
}
