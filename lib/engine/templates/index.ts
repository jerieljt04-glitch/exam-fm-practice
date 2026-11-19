import type { TopicId } from "../../syllabus";
import { TOPIC_ORDER } from "../../syllabus";
import { CONCEPT_TEMPLATES } from "../concepts";
import type { AnyTemplate, ChoiceTemplate, Difficulty, QuestionTemplate } from "../types";
import { COMPOSITE_TEMPLATES } from "./composite";
import { ALM_TEMPLATES } from "./alm";
import { APPROACH_ALM_TEMPLATES } from "./approach-alm";
import { APPROACH_LOAN_BOND_TEMPLATES } from "./approach-loans-bonds";
import { APPROACH_TVM_ANNUITY_TEMPLATES } from "./approach-tvm-annuities";
import { MIXED_PV_TEMPLATES } from "./approach-mixed";
import { CURVE_INFLATION_TEMPLATES } from "./approach-curve-inflation";
import { AMORTIZATION_TEMPLATES } from "./approach-amortization";
import { ANNUITY_TEMPLATES } from "./annuities";
import { BOND_TEMPLATES } from "./bonds";
import { CHALLENGE_TEMPLATES } from "./challenge";
import { INTEGRATED_TEMPLATES } from "./integrated";
import { SINGLE_TEMPLATES } from "./single";
import { LOAN_TEMPLATES } from "./loans";
import { TVM_TEMPLATES } from "./tvm";

/** The numerical question bank: parameterised templates, each producing validated variations. */
export const TEMPLATES: QuestionTemplate[] = [
  ...TVM_TEMPLATES,
  ...ANNUITY_TEMPLATES,
  ...LOAN_TEMPLATES,
  ...BOND_TEMPLATES,
  ...ALM_TEMPLATES,
  ...INTEGRATED_TEMPLATES,
  ...SINGLE_TEMPLATES,
  ...CHALLENGE_TEMPLATES,
  // Solution-approach bank: same syllabus topics, different routes to the answer.
  ...APPROACH_TVM_ANNUITY_TEMPLATES,
  ...APPROACH_LOAN_BOND_TEMPLATES,
  ...APPROACH_ALM_TEMPLATES,
  // Mixed present values: annuities, perpetuities, rate regimes, forward curves.
  ...MIXED_PV_TEMPLATES,
  // Spot-rate and inflation families.
  ...CURVE_INFLATION_TEMPLATES,
  // Bond amortization families.
  ...AMORTIZATION_TEMPLATES,
];

/** Typed-option templates: Concept Practice items and composite calculation items. */
export const CHOICE_TEMPLATES: ChoiceTemplate[] = [...COMPOSITE_TEMPLATES, ...CONCEPT_TEMPLATES];

export { CONCEPT_TEMPLATES, COMPOSITE_TEMPLATES };

/** Every template in the bank, numerical and typed. */
export const ALL_TEMPLATES: AnyTemplate[] = [...TEMPLATES, ...CHOICE_TEMPLATES];

export const TEMPLATE_BY_ID: Record<string, QuestionTemplate> = Object.fromEntries(
  TEMPLATES.map((template) => [template.id, template])
);

export const ANY_TEMPLATE_BY_ID: Record<string, AnyTemplate> = Object.fromEntries(ALL_TEMPLATES.map((template) => [template.id, template]));

export function templatesFor(topic: TopicId, level: Difficulty): QuestionTemplate[] {
  return TEMPLATES.filter((template) => template.topic === topic && template.levels.includes(level));
}

function assertBank(): void {
  const ids = new Set<string>();
  for (const template of ALL_TEMPLATES) {
    if (ids.has(template.id)) throw new Error(`Duplicate template id ${template.id}`);
    ids.add(template.id);
    if (!TOPIC_ORDER.includes(template.topic)) throw new Error(`${template.id} has unknown topic ${template.topic}`);
    if (!template.objective.startsWith(`${template.topic}.`)) {
      throw new Error(`${template.id}: objective ${template.objective} is outside its topic`);
    }
    if (template.kind === "choice" && template.practice === "concept" && !template.conceptFamily) {
      throw new Error(`${template.id}: a concept template needs a concept family`);
    }
  }
}

assertBank();
