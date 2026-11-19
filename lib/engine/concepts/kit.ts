/**
 * Authoring kit for typed-option questions: Concept Practice items and the
 * non-numerical SOA-style formats (equation selection, statement
 * combinations, classification, error diagnosis…).
 *
 * A concept question is written as a reasoning sequence (`steps`, each tied
 * to a concept id in lib/concepts), the conditions it relies on, one correct
 * option and four or more misconception distractors. Each distractor names
 * the step where its reasoning fails and how (recognition, interpretation,
 * selection, application, connection, conclusion), and — where useful — the
 * condition under which it would become true. The kit turns that into a
 * `ChoiceDraft`; the validator (validate-choice.ts) then checks it.
 */
import { getConcept } from "../../concepts/registry";
import type { ReasoningSkill } from "../skills";
import { getMisconception, type MisconceptionId } from "../misconceptions";
import { STATEMENT_KEYS, statementsLabel, type Exhibit, type OptionContent, type StatementKey } from "../answers";
import type {
  ChoiceCandidate,
  ChoiceDraft,
  ChoiceReference,
  ChoiceTemplate,
  ConceptFailure,
  ConceptStep,
  FormulaChain,
  ItemFormat,
  Presentation,
  QuestionFeatures,
  StatementSpec,
  TruthCheck,
  VisualSpec,
} from "../types";

export { statementsLabel };

/** Text content (markup: prose with inline `$…$`). */
export const text = (markup: string): OptionContent => ({ type: "text", text: markup });
/** Mathematical content (LaTeX, typeset as display mathematics). */
export const math = (latex: string): OptionContent => ({ type: "math", latex });
/** A combination of statements. */
export const keys = (...k: StatementKey[]): OptionContent => ({ type: "statements", keys: k });

export interface ConceptOption {
  /** A string is read as text content. */
  content: OptionContent | string;
  misconception?: MisconceptionId;
  /** Why the option is correct, or why it is wrong here. */
  why: string;
  /** Distractors: the faulty reasoning in words (defaults to the misconception's description). */
  method?: string;
  /** When this option would become correct. */
  conditionTrue?: string;
  /** Concept-chain step (0-based) where the reasoning fails, and how. */
  stage?: number;
  failure?: ConceptFailure;
  /** Concept id the option confuses the correct idea with. */
  confusedWith?: string;
  probe?: string;
  check?: TruthCheck;
  calc?: string[];
  derivation?: string;
}

export interface ConceptSpec {
  stem: string;
  exhibits?: Exhibit[];
  statements?: StatementSpec[];
  correct: ConceptOption;
  distractors: ConceptOption[];
  /** The reasoning sequence. */
  steps: ConceptStep[];
  /** Concept ids required; defaults to the concepts of the steps. */
  concepts?: string[];
  /** Conditions and assumptions the reasoning relies on. */
  conditions: string[];
  /** The applicable formula or relationship (markup). */
  relationship: string;
  counterexample?: string;
  /** Plain-language picture of the idea (defaults to the relationship). */
  intuition?: string;
  transfer: { principle: string; unusual: string; misread: string };
  /** Independent reference; required when options are equations or values. */
  reference?: ChoiceReference;
  formulas?: string[];
  chain?: FormulaChain;
  itemFormat?: ItemFormat;
  presentation?: Presentation[];
  features?: Partial<QuestionFeatures>;
  params?: Record<string, number | string | boolean>;
  visuals?: VisualSpec[];
  canonicalOrder?: boolean;
  modelingDecisions?: number;
}

/**
 * Removes binary floating-point noise from displayed numbers
 * (`0.039999999999999994` → `0.04`, `0.05500000000000001` → `0.055`). Applied
 * to every displayed string of a concept question; arithmetic used for
 * validation (`calc`, `probe`, `check`) is left untouched.
 */
export function cleanFloats(markup: string): string {
  return markup.replace(/\d+\.\d*?(?:0{6,}|9{6,})\d+/g, (m) => String(Number(Number(m).toPrecision(12))));
}

function cleanContent(c: OptionContent): OptionContent {
  switch (c.type) {
    case "text":
      return { type: "text", text: cleanFloats(c.text) };
    case "math":
      return { type: "math", latex: cleanFloats(c.latex) };
    case "table":
      return { type: "table", columns: c.columns.map(cleanFloats), rows: c.rows.map((r) => r.map(cleanFloats)) };
    default:
      return c;
  }
}

const asContent = (c: OptionContent | string): OptionContent => cleanContent(typeof c === "string" ? text(c) : c);

function candidate(option: ConceptOption, isCorrect: boolean): ChoiceCandidate {
  const misconception = option.misconception ? getMisconception(option.misconception) : undefined;
  return {
    content: asContent(option.content),
    ...(isCorrect ? {} : { misconception: option.misconception }),
    explanation: cleanFloats(option.why),
    method: isCorrect ? undefined : cleanFloats(option.method ?? misconception?.description ?? ""),
    ...(option.derivation ? { derivation: cleanFloats(option.derivation) } : {}),
    ...(option.conditionTrue ? { conditionTrue: cleanFloats(option.conditionTrue) } : {}),
    ...(option.stage !== undefined ? { stage: option.stage } : {}),
    ...(option.failure ? { failure: option.failure } : {}),
    ...(option.confusedWith ? { confusedWith: option.confusedWith } : {}),
    ...(option.probe ? { probe: option.probe } : {}),
    ...(option.check ? { check: option.check } : {}),
    ...(option.calc ? { calc: option.calc } : {}),
  };
}

/** Builds a concept question draft from a reasoning sequence and its options. */
export function conceptQuestion(raw: ConceptSpec): ChoiceDraft {
  const c = cleanFloats;
  const spec: ConceptSpec = {
    ...raw,
    stem: c(raw.stem),
    exhibits: raw.exhibits?.map((e) => (e.type === "table" ? { ...e, caption: e.caption && c(e.caption), columns: e.columns.map(c), rows: e.rows.map((r) => r.map(c)) } : { ...e, items: e.items.map((i) => ({ ...i, text: c(i.text) })) })),
    statements: raw.statements?.map((st) => ({ ...st, text: c(st.text), justification: c(st.justification), ...(st.conditionTrue ? { conditionTrue: c(st.conditionTrue) } : {}) })),
    steps: raw.steps.map((st) => ({ ...st, reasoning: c(st.reasoning) })),
    conditions: raw.conditions.map(c),
    relationship: c(raw.relationship),
    ...(raw.counterexample ? { counterexample: c(raw.counterexample) } : {}),
    ...(raw.intuition ? { intuition: c(raw.intuition) } : {}),
    transfer: { principle: c(raw.transfer.principle), unusual: c(raw.transfer.unusual), misread: c(raw.transfer.misread) },
  };
  const concepts = spec.concepts ?? [...new Set(spec.steps.map((s) => s.concept))];
  const correct = candidate(spec.correct, true);
  const distractors = spec.distractors.map((d) => candidate(d, false));
  const stages: NonNullable<ChoiceDraft["concept"]>["stages"] = {};
  for (const d of spec.distractors) {
    if (d.misconception && d.stage !== undefined && d.failure) stages[d.misconception] = { stage: d.stage, kind: d.failure };
  }
  const label = (id: string) => getConcept(id)?.label ?? id;
  return {
    kind: "choice",
    stem: spec.stem,
    ...(spec.exhibits ? { exhibits: spec.exhibits } : {}),
    ...(spec.statements ? { statements: spec.statements } : {}),
    correct,
    distractors,
    ...(spec.canonicalOrder ? { canonicalOrder: true } : {}),
    reference: spec.reference ? { ...spec.reference, description: cleanFloats(spec.reference.description) } : { description: spec.relationship },
    explanation: {
      intuition: spec.intuition ?? spec.relationship,
      translation: {
        unknowns: [],
        relationships: [spec.relationship],
        conditions: spec.conditions,
        valuationDate: "As fixed by the question.",
        modelChoice: spec.steps[0]?.reasoning ?? spec.relationship,
        assumptions: spec.conditions,
      },
      solution: [
        ...spec.steps.map((s) => ({ title: label(s.concept), body: s.reasoning })),
        { title: "Conclusion", body: cleanFloats(spec.correct.why) },
      ],
      alternatives: spec.counterexample ? [{ name: "Boundary case", body: spec.counterexample, whenUseful: "To test whether a statement holds in general rather than in this example." }] : [],
      transfer: spec.transfer,
    },
    concept: { concepts, steps: spec.steps, conditions: spec.conditions, stages },
    ...(spec.chain ? { chain: spec.chain } : {}),
    relationship: spec.relationship,
    ...(spec.counterexample ? { counterexample: spec.counterexample } : {}),
    ...(spec.formulas ? { formulas: spec.formulas } : {}),
    visuals: spec.visuals ?? [],
    markers: [],
    presentation: spec.presentation ?? ["direct"],
    features: {
      multiConcept: concepts.length >= 2,
      formulaRetrieval: false,
      multipleValuationDates: false,
      unfamiliar: false,
      steps: spec.steps.length,
      ...spec.features,
    },
    params: spec.params ?? {},
    itemFormat: spec.itemFormat ?? "definition",
    ...(spec.modelingDecisions !== undefined ? { modelingDecisions: spec.modelingDecisions } : {}),
  };
}

/** A numbered statement for an I / II / III question. */
export function statement(
  key: StatementKey,
  textMarkup: string,
  truth: boolean,
  justification: string,
  misconception: MisconceptionId,
  extra: { conditionTrue?: string; check?: TruthCheck; stage?: number; failure?: ConceptFailure; confusedWith?: string } = {}
): StatementSpec {
  return { key, text: textMarkup, truth, justification, misconception, ...extra };
}

export interface StatementQuestionSpec extends Omit<ConceptSpec, "correct" | "distractors" | "statements" | "exhibits"> {
  /** The stem before the statements, e.g. "Determine which of the following statements are true." */
  statements: StatementSpec[];
  /** Why the correct combination is right (defaults to the statements' justifications). */
  correctWhy?: string;
  /**
   * Extra combinations beyond the single-flip distractors the kit builds
   * automatically, each with its own misconception (at least one is needed
   * with three statements, since only three single flips exist).
   */
  extra: Array<Omit<ConceptOption, "content"> & { keys: StatementKey[] }>;
  exhibitsBefore?: Exhibit[];
}

/**
 * An I / II / III question. The correct option is the set of true
 * statements; each single-statement misjudgement becomes a distractor tied to
 * that statement's misconception, step and condition; `extra` adds further
 * combinations. Options are shown in the SOA's canonical order.
 */
export function statementQuestion(spec: StatementQuestionSpec): ChoiceDraft {
  const all = spec.statements;
  const truthSet = all.filter((s) => s.truth).map((s) => s.key);
  const n = all.length;
  const flips: ConceptOption[] = all.map((s) => {
    const flipped = s.truth ? truthSet.filter((k) => k !== s.key) : [...truthSet, s.key];
    const sorted = STATEMENT_KEYS.filter((k) => flipped.includes(k));
    return {
      content: keys(...sorted),
      misconception: s.misconception,
      why: `Statement ${s.key} is ${s.truth ? "true" : "false"}: ${s.justification}`,
      method: s.truth ? `Rejected statement ${s.key}, which is true.` : `Accepted statement ${s.key}, which is false.`,
      ...(s.conditionTrue ? { conditionTrue: s.conditionTrue } : {}),
      ...(s.stage !== undefined ? { stage: s.stage } : {}),
      ...(s.failure ? { failure: s.failure } : {}),
      ...(s.confusedWith ? { confusedWith: s.confusedWith } : {}),
    };
  });
  const extras: ConceptOption[] = spec.extra.map((e) => ({ ...e, content: keys(...STATEMENT_KEYS.filter((k) => e.keys.includes(k))) }));
  const correctWhy =
    spec.correctWhy ?? all.map((s) => `${s.key} is ${s.truth ? "true" : "false"}: ${s.justification}`).join(" ");
  const label = statementsLabel(truthSet, n);
  return conceptQuestion({
    ...spec,
    exhibits: [...(spec.exhibitsBefore ?? []), { type: "statements", items: all.map((s) => ({ key: s.key, text: s.text })) }],
    statements: all,
    correct: { content: keys(...truthSet), why: `${label}. ${correctWhy}` },
    distractors: [...flips, ...extras],
    itemFormat: spec.itemFormat ?? "statement-combination",
    canonicalOrder: true,
  });
}

type ConceptTemplateSpec = Omit<ChoiceTemplate, "kind" | "practice" | "reasoning" | "secondary"> & {
  secondary?: string[];
  reasoning?: ReasoningSkill[];
};

/** A Concept Practice template. */
export function conceptTemplate(t: ConceptTemplateSpec): ChoiceTemplate {
  return { kind: "choice", practice: "concept", secondary: [], reasoning: ["concept_recognition", "financial_intuition"], ...t };
}

/** A calculation template with typed options (ordered pairs, allocations, table-driven answers). */
export function compositeTemplate(t: Omit<ChoiceTemplate, "kind" | "practice">): ChoiceTemplate {
  return { kind: "choice", practice: "calculation", ...t };
}
