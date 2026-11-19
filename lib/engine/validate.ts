import katex from "katex";

import { tokenizeMath } from "../math/markup";
import { exhibitMarkup } from "./answers";
import { evaluate, isEquation, rootNear, solveEquation } from "./expr";
import { displayedValue, formatAnswer } from "./format";
import { getFormula } from "../formulas/registry";
import { getMisconception } from "./misconceptions";
import type {
  AnswerFormat,
  DistractorCandidate,
  Explanation,
  QuestionDraft,
  ValidationCheck,
  ValidationRecord,
  Difficulty,
} from "./types";

/**
 * The validation gate every generated question passes before it can enter a
 * session. The template's own arithmetic is never trusted on its own:
 *
 *  1. The answer is recomputed from its `calc` expression by a separate parser.
 *  2. The equation of value (`model`, written from explicit cash flows rather
 *     than closed forms) is solved independently and must agree.
 *  3. Every distractor is recomputed from its own `calc` expression.
 *  4. Exactly one option satisfies the equation of value.
 *  5. All five options are numerically distinct after display rounding, and
 *     no two distractors represent the same misconception.
 *  6. Every explanation and derivation states the value it claims to produce,
 *     and every piece of mathematical markup typesets.
 *
 * Any failure rejects the draft; the caller regenerates with a new seed.
 */

const AGREEMENT = 1e-7;

export interface SelectedOption {
  isCorrect: boolean;
  value: number;
  display: string;
  candidate?: DistractorCandidate;
}

export interface ValidationOutcome {
  ok: boolean;
  record: ValidationRecord;
  options: SelectedOption[];
}

function relClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Smallest gap allowed between two options: 0.75% or 1.5 display units. */
export function minimumGap(a: number, b: number, format: AnswerFormat): number {
  const unit =
    format.kind === "percent" ? Math.pow(10, -(format.decimals + 2)) : Math.pow(10, -format.decimals);
  return Math.max(0.0075 * Math.max(Math.abs(a), Math.abs(b)), 1.5 * unit);
}

function distinct(a: number, b: number, format: AnswerFormat): boolean {
  if (formatAnswer(a, format) === formatAnswer(b, format)) return false;
  return Math.abs(displayedValue(a, format) - displayedValue(b, format)) >= minimumGap(a, b, format);
}

/** Digits of a displayed value, for finding it inside markup. */
function digitsOf(display: string): string {
  return display.replace(/[^0-9.]/g, "").replace(/^0+(?=\d)/, "");
}

function normaliseForSearch(markup: string): string {
  return markup.replace(/\{,\}/g, "").replace(/,/g, "").replace(/\\[,;!]/g, "").replace(/\s+/g, "");
}

export function statesValue(markup: string, display: string): boolean {
  return normaliseForSearch(markup).includes(digitsOf(display));
}

/** Every math segment in a piece of markup must typeset. Returns the first failure. */
export function typesetError(markup: string): string | null {
  for (const segment of tokenizeMath(markup)) {
    if (segment.type === "text") continue;
    try {
      katex.renderToString(segment.value, { throwOnError: true, displayMode: segment.type === "display" });
    } catch (error) {
      return `${segment.value.slice(0, 80)} — ${(error as Error).message.slice(0, 120)}`;
    }
  }
  return null;
}

function explanationMarkup(explanation: Explanation): string[] {
  return [
    explanation.intuition,
    ...explanation.translation.unknowns.map((u) => `${u.symbol} ${u.meaning}`),
    ...explanation.translation.relationships,
    ...explanation.translation.conditions,
    explanation.translation.valuationDate,
    explanation.translation.modelChoice,
    ...explanation.translation.assumptions,
    ...explanation.solution.flatMap((step) => [step.title, step.body]),
    ...explanation.alternatives.flatMap((alt) => [alt.name, alt.body, alt.whenUseful]),
    explanation.transfer.principle,
    explanation.transfer.unusual,
    explanation.transfer.misread,
  ];
}

export function validateDraft(
  draft: QuestionDraft,
  context: { templateId: string; level: Difficulty; seed: string; prefer?: ReadonlySet<string> }
): ValidationOutcome {
  const checks: ValidationCheck[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, ...(detail ? { detail } : {}) });
    return ok;
  };
  const format = draft.answer.format;
  const correct = draft.answer.value;
  const rejectedCandidates: ValidationRecord["rejectedCandidates"] = [];

  // 1. Assumptions and model are stated.
  check("assumptions stated", draft.explanation.translation.assumptions.length > 0);
  check("answer finite", Number.isFinite(correct), String(correct));

  // 2. The answer's own arithmetic.
  let calcValue: number | null = null;
  try {
    if (isEquation(draft.answer.calc)) {
      check("answer calc root", rootNear(draft.answer.calc, correct), draft.answer.calc);
      calcValue = correct;
    } else {
      calcValue = evaluate(draft.answer.calc);
      check("answer calc agrees", relClose(calcValue, correct, AGREEMENT), `${calcValue} vs ${correct}`);
    }
  } catch (error) {
    check("answer calc parses", false, (error as Error).message);
  }

  // 3. Independent equation of value.
  let modelValue: number | null = null;
  try {
    if (isEquation(draft.model.expr)) {
      const bracket = draft.model.bracket ?? [correct - Math.abs(correct) * 0.6 - 1e-6, correct + Math.abs(correct) * 0.6 + 1e-6];
      const roots = solveEquation(draft.model.expr, bracket);
      check("model has a unique root on its bracket", roots.length === 1, `roots: ${roots.join(", ")}`);
      modelValue = roots.length ? roots[0] : null;
    } else {
      modelValue = evaluate(draft.model.expr);
    }
    check(
      "model agrees with answer",
      modelValue !== null && relClose(modelValue, correct, 1e-6),
      `model ${modelValue} vs answer ${correct}`
    );
  } catch (error) {
    check("model parses", false, (error as Error).message);
  }

  const truth = modelValue ?? correct;

  // 4. Distractors: recompute each, then choose four distinct misconceptions.
  const ordered = [...draft.distractors].sort((a, b) => {
    const pa = context.prefer?.has(a.misconception) ? 0 : 1;
    const pb = context.prefer?.has(b.misconception) ? 0 : 1;
    return pa - pb;
  });
  const chosen: DistractorCandidate[] = [];
  const optionLog: ValidationRecord["options"] = [];
  for (const candidate of ordered) {
    const reject = (reason: string) => {
      rejectedCandidates.push({ misconception: candidate.misconception, reason });
      optionLog.push({ misconception: candidate.misconception, value: candidate.value, calcValue: null, selected: false });
    };
    if (!getMisconception(candidate.misconception)) {
      reject("unknown misconception id");
      continue;
    }
    if (!Number.isFinite(candidate.value)) {
      reject("value not finite");
      continue;
    }
    if (Math.sign(candidate.value) !== Math.sign(correct) && correct !== 0) {
      reject("sign differs from the answer");
      continue;
    }
    if (!candidate.method.trim() || !candidate.feedback.trim() || !candidate.derivation.trim()) {
      reject("metadata incomplete");
      continue;
    }
    let recomputed: number;
    try {
      if (isEquation(candidate.calc)) {
        if (!rootNear(candidate.calc, candidate.value)) {
          reject(`calc root does not match ${candidate.value}`);
          continue;
        }
        recomputed = candidate.value;
      } else {
        recomputed = evaluate(candidate.calc);
        if (!relClose(recomputed, candidate.value, AGREEMENT)) {
          reject(`calc gives ${recomputed}, template gave ${candidate.value}`);
          continue;
        }
      }
    } catch (error) {
      reject(`calc does not parse: ${(error as Error).message}`);
      continue;
    }
    if (!distinct(candidate.value, truth, format)) {
      reject("indistinguishable from the correct answer");
      continue;
    }
    if (chosen.some((other) => other.misconception === candidate.misconception)) {
      reject("misconception already represented");
      continue;
    }
    if (chosen.some((other) => !distinct(other.value, candidate.value, format))) {
      reject("indistinguishable from another distractor");
      continue;
    }
    if (chosen.length >= 4) {
      optionLog.push({ misconception: candidate.misconception, value: candidate.value, calcValue: recomputed, selected: false });
      continue;
    }
    chosen.push(candidate);
    optionLog.push({ misconception: candidate.misconception, value: candidate.value, calcValue: recomputed, selected: true });
  }
  check("four distinct misconception distractors", chosen.length === 4, `${chosen.length} usable`);

  // 5. Exactly one option satisfies the equation of value.
  const values = [correct, ...chosen.map((c) => c.value)];
  const satisfying = values.filter((value) => !distinct(value, truth, format)).length;
  check("exactly one option satisfies the model", satisfying === 1, `${satisfying} options match`);
  const displays = values.map((value) => formatAnswer(value, format));
  check("option displays unique", new Set(displays).size === values.length, displays.join(" | "));

  // 6. Explanations state their values and typeset.
  const correctDisplay = formatAnswer(correct, format);
  const finalStep = draft.explanation.solution[draft.explanation.solution.length - 1];
  check("solution ends at the answer", Boolean(finalStep) && statesValue(finalStep.body, correctDisplay), correctDisplay);
  for (const candidate of chosen) {
    const display = formatAnswer(candidate.value, format);
    check(`derivation states ${candidate.misconception}`, statesValue(candidate.derivation, display), display);
  }
  const markup = [
    draft.stem,
    ...(draft.exhibits ?? []).flatMap(exhibitMarkup),
    draft.answer.derivation,
    ...explanationMarkup(draft.explanation),
    ...chosen.flatMap((c) => [c.derivation, c.feedback, c.method]),
  ];
  const typesetFailures = markup.map(typesetError).filter((error): error is string => error !== null);
  check("all markup typesets", typesetFailures.length === 0, typesetFailures[0]);
  check("stem has no hint markers", !/\b(hint|formula|topic)\b/i.test(draft.stem));

  // 7. The formula chain: every formula exists, is mapped to the syllabus and is
  //    not of unclear relevance; every step's value is finite; the last step
  //    produces the answer; every trap points at a real step.
  const steps = draft.chain?.steps ?? [];
  check("formula chain present", steps.length > 0 && draft.chain.reasoning.trim().length > 0);
  const unknownFormulas = steps.filter((s) => !getFormula(s.formula)).map((s) => s.formula);
  check("chain formulas exist in the library", unknownFormulas.length === 0, unknownFormulas.join(", "));
  const unmapped = steps.filter((s) => {
    const formula = getFormula(s.formula);
    return formula && (formula.relevance === "unclear" || formula.outcomes.length === 0);
  });
  check("chain formulas are syllabus-mapped", unmapped.length === 0, unmapped.map((s) => s.formula).join(", "));
  check("chain values finite", steps.every((s) => Number.isFinite(s.output.value)));
  const final = steps[steps.length - 1];
  check("chain ends at the answer", Boolean(final) && relClose(final.output.value, correct, 1e-6), final ? `${final.output.value} vs ${correct}` : "no steps");
  const badStages = Object.entries(draft.chain?.stages ?? {}).filter(
    ([, trap]) => !trap || trap.stage < 0 || trap.stage >= steps.length || (trap.wrongFormula !== undefined && !getFormula(trap.wrongFormula))
  );
  check("chain trap stages valid", badStages.length === 0, badStages.map(([id]) => id).join(", "));

  const ok = checks.every((c) => c.ok);
  const options: SelectedOption[] = [
    { isCorrect: true, value: correct, display: correctDisplay },
    ...chosen.map((candidate) => ({
      isCorrect: false,
      value: candidate.value,
      display: formatAnswer(candidate.value, format),
      candidate,
    })),
  ];

  return {
    ok,
    options,
    record: {
      templateId: context.templateId,
      level: context.level,
      seed: context.seed,
      status: ok ? "PASSED" : "REJECTED",
      checks,
      model: draft.model.expr.length > 4000 ? `${draft.model.expr.slice(0, 4000)}…` : draft.model.expr,
      correctValue: correct,
      modelValue,
      options: optionLog,
      rejectedCandidates,
      validatedAt: new Date().toISOString(),
    },
  };
}
