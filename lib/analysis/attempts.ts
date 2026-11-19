import { getMisconception, MISCONCEPTION_CATEGORIES, type MisconceptionCategory } from "../engine/misconceptions";
import { CONFIDENCE_LEVELS, isConfident, isUnsure, type Confidence } from "../engine/skills";
import { getFormula } from "../formulas/registry";
import { getConcept } from "../concepts/registry";
import { CHAIN_ERROR_LABELS, CONCEPT_FAILURE_LABELS, isConceptItem, type ChainErrorKind, type ConceptFailure, type QuestionInstance } from "../engine/types";

/** One answered (or skipped) question in a submitted session, with everything analysis needs. */
export interface AttemptRecord {
  questionId: string;
  sessionId: string;
  mode: string;
  position: number;
  submittedAt: string;
  instance: QuestionInstance;
  selectedKey: string | null;
  confidence: Confidence | null;
  method: string | null;
  methodNote: string | null;
  working: string;
  timeSpentSeconds: number;
  isCorrect: boolean;
}

export type ReasoningQuality =
  | "SOUND"
  | "UNVERIFIED"
  | "POSSIBLE_GUESS"
  | "SUSPECT_METHOD"
  | "INCORRECT"
  | "UNANSWERED";

export const QUALITY_LABELS: Record<ReasoningQuality, string> = {
  SOUND: "Correct, reasoning evidenced",
  UNVERIFIED: "Correct, reasoning not shown",
  POSSIBLE_GUESS: "Correct, low confidence (possible guess)",
  SUSPECT_METHOD: "Correct number, working shows a known mistake",
  INCORRECT: "Incorrect",
  UNANSWERED: "Not answered",
};

export type ErrorCause = "FORMULA_SELECTION" | "TRANSLATION" | "ALGEBRA_ARITHMETIC" | "TIMING_INTERPRETATION" | "METHOD_RIGHT_EXECUTION_WRONG";

export const CAUSE_LABELS: Record<ErrorCause, string> = {
  FORMULA_SELECTION: "Formula or model selection",
  TRANSLATION: "Mathematical translation",
  ALGEBRA_ARITHMETIC: "Algebra or arithmetic",
  TIMING_INTERPRETATION: "Timing or financial interpretation",
  METHOD_RIGHT_EXECUTION_WRONG: "Correct method, execution slipped",
};

const CATEGORY_CAUSE: Record<MisconceptionCategory, ErrorCause> = {
  INCORRECT_FORMULA: "FORMULA_SELECTION",
  INCORRECT_MODEL: "FORMULA_SELECTION",
  SEQUENCE_SERIES: "FORMULA_SELECTION",
  TRANSLATION: "TRANSLATION",
  VARIABLE_INTERPRETATION: "TRANSLATION",
  ALLOCATION: "TRANSLATION",
  ALGEBRA: "ALGEBRA_ARITHMETIC",
  ARITHMETIC: "ALGEBRA_ARITHMETIC",
  TIMING: "TIMING_INTERPRETATION",
  RATE_CONVERSION: "TIMING_INTERPRETATION",
  CONCEPTUAL: "TIMING_INTERPRETATION",
};

export interface AttemptEvidence {
  answered: boolean;
  correct: boolean;
  workingProvided: boolean;
  /** Working contains an intermediate value of the correct method (observed). */
  workingShowsCorrectMethod: boolean;
  /** A misconception whose characteristic intermediate values appear in the working (observed). */
  workingShowsMistake: string | null;
  selectedMisconception: string | null;
  /** Step of the formula chain where the chosen option's mistake happens. */
  chainStage: number | null;
  chainError: ChainErrorKind | null;
  chainFormula: string | null;
  wrongFormula: string | null;
  /** Concept-chain step where the chosen option's reasoning fails, the kind of failure, and the concept it confuses. */
  conceptStage: number | null;
  conceptFailure: ConceptFailure | null;
  confusedWith: string | null;
  quality: ReasoningQuality;
  cause: ErrorCause | null;
  observed: string[];
  inferred: string[];
}

/** Numbers written in free-form working: `11,000`, `0.0525`, `5.25%`, `1.05^3` (yields 1.05 and 3). */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const pattern = /-?\d[\d,]*(?:\.\d+)?|-?\.\d+/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const raw = match[0].replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

/** True when the working contains the marker value (or the marker as a percentage). */
export function containsValue(numbers: readonly number[], marker: number): boolean {
  if (!Number.isFinite(marker) || marker === 0) return false;
  const targets = Math.abs(marker) < 1 ? [marker, marker * 100] : [marker];
  return numbers.some((n) =>
    targets.some((t) => {
      const tolerance = Math.max(Math.abs(t) * 0.0025, Math.abs(t) >= 50 ? 0.51 : 0.0006);
      return Math.abs(Math.abs(n) - Math.abs(t)) <= tolerance;
    })
  );
}

/** Markers that are too generic to be evidence (a rate the question itself states, small integers). */
function meaningfulMarkers(markers: readonly number[], stem: string): number[] {
  const stated = numbersIn(stem);
  return markers.filter((m) => Number.isFinite(m) && Math.abs(m) > 1e-9 && !(Number.isInteger(m) && Math.abs(m) < 40) && !containsValue(stated, m));
}

export function classifyAttempt(attempt: AttemptRecord): AttemptEvidence {
  const { instance } = attempt;
  const answered = attempt.selectedKey !== null;
  const selected = instance.options.find((o) => o.key === attempt.selectedKey);
  const correct = Boolean(selected?.isCorrect);
  const working = attempt.working.trim();
  const workingProvided = working.length >= 3;
  const numbers = numbersIn(working);
  const correctMarkers = meaningfulMarkers(instance.markers, instance.stem);
  const workingShowsCorrectMethod = correctMarkers.some((m) => containsValue(numbers, m));
  let workingShowsMistake: string | null = null;
  for (const option of instance.options) {
    if (option.isCorrect) continue;
    const markers = meaningfulMarkers(option.markers, instance.stem);
    if (markers.length && markers.some((m) => containsValue(numbers, m))) {
      workingShowsMistake = option.misconceptionTag;
      break;
    }
  }
  const selectedMisconception = selected && !selected.isCorrect ? selected.misconceptionTag : null;
  const observed: string[] = [];
  const inferred: string[] = [];

  let quality: ReasoningQuality;
  let cause: ErrorCause | null = null;

  if (!answered) {
    quality = "UNANSWERED";
    observed.push("No answer was selected.");
  } else if (correct) {
    observed.push(`Selected ${attempt.selectedKey}, the correct answer.`);
    if (isConceptItem(instance)) {
      // Concept items are judged by understanding; numerical working is not expected.
      if (isUnsure(attempt.confidence)) {
        quality = "POSSIBLE_GUESS";
        observed.push(`Confidence was recorded as ${attempt.confidence?.toLowerCase().replace("_", " ")}.`);
        inferred.push("A correct concept answer at low confidence may have been an elimination; it is not counted as secure understanding.");
      } else {
        quality = "SOUND";
        observed.push("Concept question answered correctly with at least medium confidence.");
      }
    } else if (workingShowsMistake && !workingShowsCorrectMethod) {
      quality = "SUSPECT_METHOD";
      observed.push("The working contains an intermediate value produced by a known mistake.");
      inferred.push(`The final number is right, but the working suggests “${getMisconception(workingShowsMistake)?.label}” — the method may not be valid in general.`);
    } else if (isUnsure(attempt.confidence)) {
      quality = "POSSIBLE_GUESS";
      observed.push(`Confidence was recorded as ${attempt.confidence?.toLowerCase().replace("_", " ")}.`);
      inferred.push("A correct answer at low confidence may have been a guess or an elimination; it is not counted as secure understanding.");
    } else if (workingShowsCorrectMethod || (workingProvided && attempt.method)) {
      quality = "SOUND";
      if (workingShowsCorrectMethod) observed.push("The working contains intermediate values of the correct method.");
      else observed.push("Working and a method were recorded.");
    } else {
      quality = "UNVERIFIED";
      observed.push(workingProvided ? "Working was recorded but contains none of the method's intermediate values." : "No working was recorded.");
      inferred.push("The reasoning cannot be confirmed from what was written.");
    }
  } else {
    quality = "INCORRECT";
    const misconception = selectedMisconception ? getMisconception(selectedMisconception) : undefined;
    observed.push(`Selected ${attempt.selectedKey} (${selected?.display}); the correct answer was ${instance.correctKey}.`);
    if (misconception) {
      observed.push(`Option ${attempt.selectedKey} is exactly the value produced by: ${misconception.label.toLowerCase()}.`);
      if (instance.chain && selected?.chainStage !== null && selected?.chainStage !== undefined) {
        const stepAt = instance.chain.steps[selected.chainStage];
        const formulaName = stepAt ? getFormula(stepAt.formula)?.name ?? stepAt.formula : "";
        observed.push(
          `That value arises at step ${selected.chainStage + 1} of ${instance.chain.steps.length} in the formula chain (${formulaName}) — an error in ${CHAIN_ERROR_LABELS[selected.chainError ?? "application"].toLowerCase()}${selected.wrongFormula ? `, using ${getFormula(selected.wrongFormula)?.name ?? selected.wrongFormula} instead` : ""}.`
        );
      }
      if (instance.kind === "choice" && instance.concept && selected?.conceptStage !== null && selected?.conceptStage !== undefined) {
        const stepAt = instance.concept.steps[selected.conceptStage];
        observed.push(
          `That option's reasoning fails at step ${selected.conceptStage + 1} of ${instance.concept.steps.length} (${getConcept(stepAt?.concept ?? "")?.label ?? stepAt?.concept ?? "concept"}) — a failure of ${CONCEPT_FAILURE_LABELS[selected.conceptFailure ?? "application"].toLowerCase()}${selected.confusedWith ? `, confusing it with ${getConcept(selected.confusedWith)?.label.toLowerCase() ?? selected.confusedWith}` : ""}.`
        );
      }
      cause = CATEGORY_CAUSE[misconception.category];
      if (workingShowsCorrectMethod && !workingShowsMistake) {
        cause = "METHOD_RIGHT_EXECUTION_WRONG";
        observed.push("The working contains intermediate values of the correct method.");
        inferred.push("The setup looks right; the error probably happened in a later step or in arithmetic.");
      } else if (workingShowsMistake === selectedMisconception) {
        observed.push("The working contains an intermediate value characteristic of that mistake.");
        inferred.push(`The working supports the diagnosis: ${misconception.description}`);
      } else if (!workingProvided) {
        inferred.push(`Likely cause (from the option chosen, not from working): ${misconception.description}`);
      } else {
        inferred.push(`The option chosen matches this mistake, but the working does not show it clearly: ${misconception.description}`);
      }
    }
  }

  if (attempt.confidence && isConfident(attempt.confidence) && answered && !correct) {
    observed.push(`Confidence was ${attempt.confidence.toLowerCase().replace("_", " ")}.`);
    inferred.push("High confidence on a wrong answer suggests the result was not independently checked.");
  }

  const chainStage = selected && !selected.isCorrect ? selected.chainStage ?? null : null;
  return {
    answered,
    correct,
    workingProvided,
    workingShowsCorrectMethod,
    workingShowsMistake,
    selectedMisconception,
    chainStage,
    chainError: selected && !selected.isCorrect ? selected.chainError ?? null : null,
    chainFormula: chainStage !== null ? instance.chain?.steps[chainStage]?.formula ?? null : null,
    wrongFormula: selected && !selected.isCorrect ? selected.wrongFormula ?? null : null,
    conceptStage: selected && !selected.isCorrect ? selected.conceptStage ?? null : null,
    conceptFailure: selected && !selected.isCorrect ? selected.conceptFailure ?? null : null,
    confusedWith: selected && !selected.isCorrect ? selected.confusedWith ?? null : null,
    quality,
    cause,
    observed,
    inferred,
  };
}

export const categoryOf = (misconception: string | null): MisconceptionCategory | null =>
  misconception ? getMisconception(misconception)?.category ?? null : null;

export const categoryLabel = (category: MisconceptionCategory): string => MISCONCEPTION_CATEGORIES[category];

export const confidenceRank = (confidence: Confidence | null): number => (confidence ? CONFIDENCE_LEVELS.indexOf(confidence) : -1);
