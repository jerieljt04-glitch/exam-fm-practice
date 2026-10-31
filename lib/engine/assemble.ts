import { randomUUID } from "crypto";

import { EXAM_STRUCTURE } from "../syllabus";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "./misconceptions";
import { createRng } from "./random";
import { REASONING_LABELS } from "./skills";
import { OUTCOMES } from "../syllabus";
import { integrationLevel, type ChainErrorKind, type Difficulty, type OptionDetail, type QuestionInstance, type QuestionTemplate, type ValidationRecord } from "./types";
import type { MisconceptionCategory } from "./misconceptions";
import { validateDraft } from "./validate";

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

export interface BuildResult {
  instance: QuestionInstance | null;
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
): BuildResult {
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

    return {
      rejected,
      instance: {
        instanceId: randomUUID(),
        templateId: template.id,
        family: template.family,
        topic: template.topic,
        difficulty: level,
        seed,
        stem: draft.stem,
        options,
        correctKey,
        format: draft.answer.format,
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
