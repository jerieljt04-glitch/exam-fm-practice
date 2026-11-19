import { plainText, type AnswerType, type Exhibit } from "./answers";
import type { AlgebraMethod, AnswerClass, Calibration, CalculatorBurden, ConceptChain, Difficulty, FormulaChain, Presentation, QuestionFeatures, TimeBand } from "./types";

/**
 * Structural difficulty calibration.
 *
 * Every question is described by counts taken from the item itself — stem
 * length, reasoning steps (from its formula or concept chain), connected
 * formulas and concepts, inverse structure, valuation dates — and checked
 * against the rubric in docs/difficulty-rubric.md, which was written from the
 * structure of the SOA's published Exam FM sample questions (no content was
 * copied). The rubric is structural, not psychometric: calculator burden and
 * the expected-time band are inferred from those counts, not measured from
 * candidates, and `basis` says which is which.
 */

const DECISION_TAGS: ReadonlySet<Presentation> = new Set<Presentation>([
  "deferred",
  "mixed-timing",
  "valuation-date",
  "frequency",
  "hidden-structure",
  "multi-equation",
  "compare-streams",
  "combined-topics",
  "rearrange-first",
  "work-backwards",
  "irrelevant-info",
]);
const INVERSE_TAGS: ReadonlySet<Presentation> = new Set<Presentation>(["inverse", "work-backwards", "unknown-rate", "unknown-time", "rearrange-first"]);
const RECONSTRUCT_METHODS: ReadonlySet<AlgebraMethod> = new Set<AlgebraMethod>(["work_backwards", "equation_construction", "simultaneous", "elimination"]);
const HEAVY_METHODS: ReadonlySet<AlgebraMethod> = new Set<AlgebraMethod>(["numerical_root", "simultaneous", "geometric_series"]);

/** Structural targets per level. */
export const RUBRIC = {
  1: { steps: [1, 3] as const, summary: "One to three reasoning steps, usually one or two formulas or concepts, familiar presentation, normal calculator burden." },
  2: { steps: [2, 4] as const, summary: "Two to four reasoning steps with at least one inverse, unfamiliar, multi-date or connected-concept feature." },
  3: {
    steps: [3, 6] as const,
    summary: "Three to six reasoning steps, usually two or more connected formulas or concepts, and at least one non-obvious modelling or interpretation decision — all inside the syllabus.",
  },
} satisfies Record<Difficulty, { steps: readonly [number, number]; summary: string }>;

export interface CalibrationInput {
  level: Difficulty;
  stem: string;
  exhibits?: Exhibit[];
  features: QuestionFeatures;
  presentation: Presentation[];
  answerType: AnswerType;
  chain?: FormulaChain;
  concept?: ConceptChain;
  modelingDecisions?: number;
  /** Concept items whose options can be judged without arithmetic. */
  conceptual?: boolean;
}

export function answerClassOf(type: AnswerType): AnswerClass {
  if (type === "numeric") return "numerical";
  if (type === "math") return "symbolic";
  if (type === "composite" || type === "table") return "composite";
  return "conceptual";
}

export function calibrate(input: CalibrationInput): Calibration {
  const { features, presentation, chain, concept } = input;
  const tags = new Set(presentation);
  const stemText = [input.stem, ...(input.exhibits ?? []).flatMap((e) => (e.type === "table" ? e.rows.flat() : e.items.map((i) => i.text)))].join(" ");
  const stemWords = plainText(stemText).split(/\s+/).filter(Boolean).length;
  const formulas = chain ? new Set(chain.steps.map((s) => s.formula)).size : 0;
  const concepts = concept ? new Set(concept.concepts).size : 0;
  const chainSteps = chain?.steps.length ?? 0;
  const conceptSteps = concept?.steps.length ?? 0;
  const reasoningSteps = Math.max(features.steps, chainSteps, conceptSteps, 1);
  const inverse = presentation.some((p) => INVERSE_TAGS.has(p));
  const multipleValuationDates = features.multipleValuationDates || tags.has("valuation-date") || tags.has("mixed-timing");
  const unfamiliar = features.unfamiliar || tags.has("hidden-structure") || tags.has("indirect-wording");
  const multiConcept = features.multiConcept || tags.has("combined-topics") || concepts >= 3;
  const reconstruction =
    Boolean(chain?.steps.some((s) => s.derived)) || Boolean(chain?.methods.some((m) => RECONSTRUCT_METHODS.has(m))) || tags.has("hidden-structure") || tags.has("multi-equation");
  const irrelevantInfo = tags.has("irrelevant-info");
  const modelingDecisions = input.modelingDecisions ?? Math.min(4, presentation.filter((p) => DECISION_TAGS.has(p)).length + (inverse ? 1 : 0));
  const answerClass = answerClassOf(input.answerType);

  let calculatorBurden: CalculatorBurden;
  if (input.conceptual && formulas === 0) calculatorBurden = "none";
  else if (formulas === 0 || (input.conceptual && formulas <= 1)) calculatorBurden = "light";
  else if (chain?.methods.some((m) => HEAVY_METHODS.has(m)) || chainSteps >= 5) calculatorBurden = "heavy";
  else calculatorBurden = "standard";

  const load = reasoningSteps + modelingDecisions + { none: -1, light: 0, standard: 1, heavy: 2 }[calculatorBurden] + (stemWords > 120 ? 1 : 0);
  const timeBand: TimeBand = load <= 3 ? "under-3" : load <= 6 ? "3-6" : load <= 9 ? "6-9" : "over-9";

  const rubric = rubricCheck(input.level, { reasoningSteps, formulas, concepts, inverse, unfamiliar, multiConcept, multipleValuationDates, reconstruction, modelingDecisions });

  return {
    stemWords,
    modelingDecisions,
    reasoningSteps,
    formulas,
    concepts,
    inverse,
    multipleValuationDates,
    unfamiliar,
    multiConcept,
    reconstruction,
    irrelevantInfo,
    answerType: input.answerType,
    answerClass,
    calculatorBurden,
    timeBand,
    rubric,
    basis: {
      measured: ["stem length", "reasoning steps (largest of the template's step count and its formula or concept chain)", "connected formulas and concepts", "presentation features", "answer type"],
      inferred: ["modelling decisions (from presentation tags unless the template states them)", "calculator burden", "expected solution-time band"],
    },
  };
}

export function rubricCheck(
  level: Difficulty,
  m: { reasoningSteps: number; formulas: number; concepts: number; inverse: boolean; unfamiliar: boolean; multiConcept: boolean; multipleValuationDates: boolean; reconstruction: boolean; modelingDecisions: number }
): Calibration["rubric"] {
  const reasons: string[] = [];
  const [lo, hi] = RUBRIC[level].steps;
  if (m.reasoningSteps < lo) reasons.push(`${m.reasoningSteps} reasoning steps, below ${lo}`);
  if (m.reasoningSteps > hi + (level === 3 ? 0 : 1)) reasons.push(`${m.reasoningSteps} reasoning steps, above ${hi}`);
  const feature = m.inverse || m.unfamiliar || m.multiConcept || m.multipleValuationDates || m.reconstruction || m.formulas + m.concepts >= 3;
  if (level === 2 && !feature) reasons.push("no inverse, unfamiliar, multi-date or connected-concept feature");
  if (level === 3) {
    if (m.formulas + m.concepts < 2) reasons.push("fewer than two connected formulas or concepts");
    if (!(m.modelingDecisions >= 1 || m.reconstruction || m.unfamiliar || m.inverse)) reasons.push("no non-obvious modelling or interpretation decision");
  }
  return { level, meets: reasons.length === 0, reasons };
}
