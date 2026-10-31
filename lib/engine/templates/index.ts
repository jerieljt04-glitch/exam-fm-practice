import type { TopicId } from "../../syllabus";
import { TOPIC_ORDER } from "../../syllabus";
import type { Difficulty, QuestionTemplate } from "../types";
import { ALM_TEMPLATES } from "./alm";
import { ANNUITY_TEMPLATES } from "./annuities";
import { BOND_TEMPLATES } from "./bonds";
import { INTEGRATED_TEMPLATES } from "./integrated";
import { LOAN_TEMPLATES } from "./loans";
import { TVM_TEMPLATES } from "./tvm";

/** The question bank: parameterised templates, each producing validated variations. */
export const TEMPLATES: QuestionTemplate[] = [
  ...TVM_TEMPLATES,
  ...ANNUITY_TEMPLATES,
  ...LOAN_TEMPLATES,
  ...BOND_TEMPLATES,
  ...ALM_TEMPLATES,
  ...INTEGRATED_TEMPLATES,
];

export const TEMPLATE_BY_ID: Record<string, QuestionTemplate> = Object.fromEntries(
  TEMPLATES.map((template) => [template.id, template])
);

export function templatesFor(topic: TopicId, level: Difficulty): QuestionTemplate[] {
  return TEMPLATES.filter((template) => template.topic === topic && template.levels.includes(level));
}

function assertBank(): void {
  const ids = new Set<string>();
  for (const template of TEMPLATES) {
    if (ids.has(template.id)) throw new Error(`Duplicate template id ${template.id}`);
    ids.add(template.id);
    if (!TOPIC_ORDER.includes(template.topic)) throw new Error(`${template.id} has unknown topic ${template.topic}`);
    if (!template.objective.startsWith(`${template.topic}.`)) {
      throw new Error(`${template.id}: objective ${template.objective} is outside its topic`);
    }
  }
}

assertBank();
