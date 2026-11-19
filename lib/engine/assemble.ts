import { randomUUID } from "crypto";

import { EXAM_STRUCTURE } from "../syllabus";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "./misconceptions";
import { createRng } from "./random";
import { REASONING_LABELS } from "./skills";
import { OUTCOMES } from "../syllabus";
import { contentDisplay, sortStatementKeys, STATEMENT_KEYS, type OptionContent } from "./answers";
import { calibrate } from "./calibration";
import {
  integrationLevel,
  isChoiceTemplate,
  numericItemFormat,
  type AnyTemplate,
  type ChainErrorKind,
  type ChoiceInstance,
  type ChoiceTemplate,
  type Difficulty,
  type NumericInstance,
  type OptionDetail,
  type QuestionInstance,
  type QuestionTemplate,
  type ValidationRecord,
} from "./types";
import type { MisconceptionCategory } from "./misconceptions";
import { validateDraft } from "./validate";
import { validateChoiceDraft, type SelectedChoice } from "./validate-choice";

export const MAX_ATTEMPTS = 16;

/** Where a mistake of each category usually sits in a formula chain, unless the template says otherwise. */
const DEFAULT_CHAIN_ERROR: Record<MisconceptionCategory, ChainErrorKind> = {
  INCORRECT_FORMULA: "selection",
  INCORRECT_MODEL: "selection",
  SEQUENCE_SERIES: "selection",
  CONCEPTUAL: "selection",
  TIMING: "application",
  RATE_CONVERSION: "application",
  ALGEBRA: "application",
  ARITHMETIC: "application",
  TRANSLATION: "connection",
  ALLOCATION: "connection",
  VARIABLE_INTERPRETATION: "interpretation",
};

export interface BuildResult<T extends QuestionInstance = NumericInstance> {
  instance: T | null;
  /** Validation records of drafts that were rejected on the way. */
  rejected: ValidationRecord[];
}

/**
 * Generates, validates and assembles one question. A rejected draft is never
 * returned: the template is re-run with a derived seed up to `MAX_ATTEMPTS`
 * times, and if nothing passes the result is `null` so the caller can choose a
 * different template.
 */
export function buildQuestion(
  template: QuestionTemplate,
  level: Difficulty,
  baseSeed: string,
  prefer?: ReadonlySet<string>
): BuildResult<NumericInstance> {
  const rejected: ValidationRecord[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const seed = attempt === 0 ? baseSeed : `${baseSeed}#${attempt}`;
    const rng = createRng(`${template.id}|${level}|${seed}`);
    let draft;
    try {
      draft = template.generate(rng, level);
    } catch (error) {
      rejected.push({
        templateId: template.id,
        level,
        seed,
        status: "REJECTED",
        checks: [{ name: "generator ran", ok: false, detail: (error as Error).message }],
        model: "",
        correctValue: Number.NaN,
        modelValue: null,
        options: [],
        rejectedCandidates: [],
        validatedAt: new Date().toISOString(),
      });
      continue;
    }

    const outcome = validateDraft(draft, { templateId: template.id, level, seed, prefer });
    if (!outcome.ok) {
      rejected.push(outcome.record);
      continue;
    }

    const order = rng.shuffle(outcome.options);
    const keys = EXAM_STRUCTURE.optionKeys;
    const primary = OUTCOMES[template.objective]?.label ?? template.objective;
    const options: OptionDetail[] = order.map((option, index) => {
      const key = keys[index];
      if (option.isCorrect) {
        return {
          key,
          display: option.display,
          value: option.value,
          isCorrect: true,
          misconceptionTag: "CORRECT",
          category: "Correct",
          errorDescription: "",
          incorrectMethod: "",
          calculationDerivation: draft.answer.derivation,
          calc: draft.answer.calc,
          feedbackExplanation: draft.model.description,
          targetSkill: primary,
          recognitionTip: draft.explanation.transfer.principle,
          markers: draft.markers,
          chainStage: null,
          chainError: null,
          wrongFormula: null,
        };
      }
      const candidate = option.candidate!;
      const misconception = getMisconception(candidate.misconception)!;
      const trap = draft.chain.stages[candidate.misconception];
      const lastStep = draft.chain.steps.length - 1;
      return {
        key,
        display: option.display,
        value: option.value,
        isCorrect: false,
        misconceptionTag: candidate.misconception,
        category: MISCONCEPTION_CATEGORIES[misconception.category],
        errorDescription: misconception.description,
        incorrectMethod: candidate.method,
        calculationDerivation: candidate.derivation,
        calc: candidate.calc,
        feedbackExplanation: candidate.feedback,
        targetSkill: misconception.skills.map((skill) => REASONING_LABELS[skill]).join(", "),
        recognitionTip: misconception.recognition,
        markers: candidate.markers ?? [],
        chainStage: trap?.stage ?? lastStep,
        chainError: trap?.kind ?? DEFAULT_CHAIN_ERROR[misconception.category],
        wrongFormula: trap?.wrongFormula ?? null,
      };
    });

    const correctKey = options.find((option) => option.isCorrect)!.key;
    // Keep the validation record's option log aligned with the printed keys.
    const record: ValidationRecord = {
      ...outcome.record,
      options: outcome.record.options.map((entry) => ({
        ...entry,
        key: entry.selected ? options.find((o) => o.misconceptionTag === entry.misconception)?.key : undefined,
      })),
    };
    record.options.unshift({
      key: correctKey,
      misconception: "CORRECT",
      value: draft.answer.value,
      calcValue: draft.answer.value,
      selected: true,
    });

    const itemFormat = draft.itemFormat ?? numericItemFormat(draft.presentation, draft.exhibits);
    return {
      rejected,
      instance: {
        kind: "numeric",
        instanceId: randomUUID(),
        templateId: template.id,
        family: template.family,
        topic: template.topic,
        difficulty: level,
        seed,
        stem: draft.stem,
        ...(draft.exhibits?.length ? { exhibits: draft.exhibits } : {}),
        options,
        correctKey,
        format: draft.answer.format,
        answerType: "numeric",
        itemFormat,
        practice: "calculation",
        calibration: calibrate({
          level,
          stem: draft.stem,
          exhibits: draft.exhibits,
          features: draft.features,
          presentation: draft.presentation,
          answerType: "numeric",
          chain: draft.chain,
          modelingDecisions: draft.modelingDecisions,
        }),
        objective: template.objective,
        secondary: template.secondary,
        reasoning: template.reasoning,
        presentation: draft.presentation,
        features: draft.features,
        explanation: draft.explanation,
        visuals: draft.visuals,
        markers: draft.markers,
        model: draft.model,
        chain: draft.chain,
        integration: integrationLevel(draft.chain),
        soaConcept: template.soaConcept,
        params: draft.params,
        validation: record,
      },
    };
  }
  return { instance: null, rejected };
}

// ---------------------------------------------------------------- typed (non-numeric and composite) questions

/** Canonical order of statement combinations: I only, II only, III only, I and II, …, all, none last. */
function statementOrder(content: OptionContent): number {
  if (content.type !== "statements") return 0;
  const keys = sortStatementKeys(content.keys);
  if (!keys.length) return 1e6;
  return keys.length * 1000 + keys.reduce((acc, k) => acc * 5 + STATEMENT_KEYS.indexOf(k) + 1, 0);
}

function firstValue(content: OptionContent): number {
  if (content.type === "numeric") return content.value;
  if (content.type === "composite") return content.parts[0]?.value ?? 0;
  return 0;
}

/**
 * Generates, validates and assembles one typed-option question. As for
 * numerical questions, a rejected draft never reaches a session: the
 * generator is re-run with derived seeds, and `null` means the caller must
 * choose another template. `variant` selects one of the template's
 * presentations; when omitted it is drawn from the seed.
 */
export function buildChoiceQuestion(
  template: ChoiceTemplate,
  level: Difficulty,
  baseSeed: string,
  opts: { prefer?: ReadonlySet<string>; variant?: number } = {}
): BuildResult<ChoiceInstance> {
  const rejected: ValidationRecord[] = [];
  const variants = Math.max(1, template.variants);
  const variant = opts.variant !== undefined ? ((opts.variant % variants) + variants) % variants : createRng(`${template.id}|${level}|${baseSeed}|variant`).int(0, variants - 1);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const seed = attempt === 0 ? baseSeed : `${baseSeed}#${attempt}`;
    const rng = createRng(`${template.id}|${level}|${variant}|${seed}`);
    let draft;
    try {
      draft = template.generate(rng, level, variant);
    } catch (error) {
      rejected.push({
        templateId: template.id,
        level,
        seed,
        status: "REJECTED",
        checks: [{ name: "generator ran", ok: false, detail: (error as Error).message }],
        model: "",
        correctValue: Number.NaN,
        modelValue: null,
        options: [],
        rejectedCandidates: [],
        validatedAt: new Date().toISOString(),
      });
      continue;
    }
    const outcome = validateChoiceDraft(draft, template, { level, seed, prefer: opts.prefer });
    if (!outcome.ok) {
      rejected.push(outcome.record);
      continue;
    }

    const type = draft.correct.content.type;
    let order: SelectedChoice[];
    if (type === "statements") order = [...outcome.options].sort((a, b) => statementOrder(a.candidate.content) - statementOrder(b.candidate.content));
    else if (draft.canonicalOrder && (type === "numeric" || type === "composite")) order = [...outcome.options].sort((a, b) => firstValue(a.candidate.content) - firstValue(b.candidate.content));
    else order = rng.shuffle(outcome.options);

    const keys = EXAM_STRUCTURE.optionKeys;
    const primary = OUTCOMES[template.objective]?.label ?? template.objective;
    const statementCount = draft.statements?.length ?? 3;
    const options: OptionDetail[] = order.map((option, index) => {
      const key = keys[index];
      const c = option.candidate;
      const base = {
        key,
        display: contentDisplay(c.content, statementCount),
        value: firstValue(c.content),
        content: c.content,
        calc: (c.calc ?? []).join(" ; "),
        markers: c.markers ?? [],
        probe: c.probe ?? null,
        check: c.check ?? null,
      };
      if (option.isCorrect) {
        return {
          ...base,
          isCorrect: true,
          misconceptionTag: "CORRECT",
          category: "Correct",
          errorDescription: "",
          incorrectMethod: "",
          calculationDerivation: c.derivation ?? draft.reference.description,
          feedbackExplanation: c.explanation,
          targetSkill: primary,
          recognitionTip: draft.explanation.transfer.principle,
          chainStage: null,
          chainError: null,
          wrongFormula: null,
          conditionTrue: null,
          conceptStage: null,
          conceptFailure: null,
          confusedWith: null,
        } satisfies OptionDetail;
      }
      const misconception = getMisconception(c.misconception!)!;
      const trap = draft.chain?.stages[c.misconception!];
      const conceptTrap = draft.concept?.stages[c.misconception!];
      return {
        ...base,
        isCorrect: false,
        misconceptionTag: c.misconception!,
        category: MISCONCEPTION_CATEGORIES[misconception.category],
        errorDescription: misconception.description,
        incorrectMethod: c.method ?? "",
        calculationDerivation: c.derivation ?? c.method ?? "",
        feedbackExplanation: c.explanation,
        targetSkill: misconception.skills.map((skill) => REASONING_LABELS[skill]).join(", "),
        recognitionTip: misconception.recognition,
        chainStage: draft.chain ? c.chainStage ?? trap?.stage ?? draft.chain.steps.length - 1 : null,
        chainError: draft.chain ? c.chainError ?? trap?.kind ?? DEFAULT_CHAIN_ERROR[misconception.category] : null,
        wrongFormula: trap?.wrongFormula ?? null,
        conditionTrue: c.conditionTrue ?? null,
        conceptStage: draft.concept ? c.stage ?? conceptTrap?.stage ?? null : null,
        conceptFailure: draft.concept ? c.failure ?? conceptTrap?.kind ?? null : null,
        confusedWith: c.confusedWith ?? null,
      } satisfies OptionDetail;
    });

    const correctKey = options.find((o) => o.isCorrect)!.key;
    const record: ValidationRecord = {
      ...outcome.record,
      options: [
        { key: correctKey, misconception: "CORRECT", value: firstValue(draft.correct.content), calcValue: firstValue(draft.correct.content), selected: true, display: contentDisplay(draft.correct.content, statementCount) },
        ...outcome.record.options.map((entry) => ({ ...entry, key: entry.selected ? options.find((o) => o.misconceptionTag === entry.misconception)?.key : undefined })),
      ],
    };
    const conceptual = template.practice === "concept";
    return {
      rejected,
      instance: {
        kind: "choice",
        instanceId: randomUUID(),
        templateId: template.id,
        family: template.family,
        topic: template.topic,
        difficulty: level,
        seed,
        variant,
        stem: draft.stem,
        ...(draft.exhibits?.length ? { exhibits: draft.exhibits } : {}),
        ...(draft.statements?.length ? { statements: draft.statements } : {}),
        options,
        correctKey,
        answerType: type,
        itemFormat: draft.itemFormat ?? template.itemFormat,
        practice: template.practice,
        objective: template.objective,
        secondary: template.secondary,
        reasoning: template.reasoning,
        presentation: draft.presentation,
        features: draft.features,
        explanation: draft.explanation,
        visuals: draft.visuals,
        markers: draft.markers,
        soaConcept: template.soaConcept,
        params: draft.params,
        validation: record,
        model: { expr: (draft.reference.values ?? []).map((v) => v.expr).join(" ; "), description: draft.reference.description },
        ...(draft.chain ? { chain: draft.chain, integration: integrationLevel(draft.chain) } : {}),
        ...(draft.concept
          ? { concept: { ...draft.concept, family: template.conceptFamily ?? "definition", dimensions: template.dimensions ?? [], variant } }
          : {}),
        ...(type === "numeric" ? { format: (draft.correct.content as Extract<OptionContent, { type: "numeric" }>).format } : {}),
        ...(draft.relationship ? { relationship: draft.relationship } : {}),
        ...(draft.counterexample ? { counterexample: draft.counterexample } : {}),
        ...(draft.formulas?.length ? { formulas: draft.formulas } : {}),
        calibration: calibrate({
          level,
          stem: draft.stem,
          exhibits: draft.exhibits,
          features: draft.features,
          presentation: draft.presentation,
          answerType: type,
          chain: draft.chain,
          concept: draft.concept,
          modelingDecisions: draft.modelingDecisions,
          conceptual,
        }),
      },
    };
  }
  return { instance: null, rejected };
}

/** Builds a question from either kind of template. */
export function buildAny(template: AnyTemplate, level: Difficulty, seed: string, opts: { prefer?: ReadonlySet<string>; variant?: number } = {}): BuildResult<QuestionInstance> {
  return isChoiceTemplate(template) ? buildChoiceQuestion(template, level, seed, opts) : buildQuestion(template, level, seed, opts.prefer);
}
