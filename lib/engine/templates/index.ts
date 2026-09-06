import type { TopicDomain } from "../../types/exam";
import { DOMAIN_ORDER, QUESTIONS_PER_DOMAIN } from "../../exam-config";
import { ALM_TEMPLATES } from "./alm-immunization";
import { ANNUITY_TEMPLATES } from "./annuities";
import { BOND_TEMPLATES } from "./bonds";
import { LOAN_TEMPLATES } from "./loans";
import { TIME_VALUE_OF_MONEY_TEMPLATES } from "./time-value-of-money";
import type { QuestionTemplateDefinition } from "./types";

export * from "./types";

/**
 * The full template library. Every template parameterizes its own numbers, so
 * two candidates sitting the same template receive different figures, different
 * correct answers and different distractors.
 */
export const QUESTION_TEMPLATES: QuestionTemplateDefinition[] = [
  ...TIME_VALUE_OF_MONEY_TEMPLATES,
  ...ANNUITY_TEMPLATES,
  ...LOAN_TEMPLATES,
  ...BOND_TEMPLATES,
  ...ALM_TEMPLATES,
];

export const TEMPLATES_BY_DOMAIN: Record<TopicDomain, QuestionTemplateDefinition[]> =
  DOMAIN_ORDER.reduce(
    (acc, domain) => {
      acc[domain] = QUESTION_TEMPLATES.filter((template) => template.domain === domain);
      return acc;
    },
    {} as Record<TopicDomain, QuestionTemplateDefinition[]>
  );

export function getTemplateById(id: string): QuestionTemplateDefinition | undefined {
  return QUESTION_TEMPLATES.find((template) => template.id === id);
}

/**
 * Blueprint invariant: each domain must supply at least as many distinct
 * templates as the exam draws from it, so a single 30-question exam never
 * repeats the same question structure. Violations are a build-time authoring
 * error, so fail loudly at module load rather than mid-exam.
 */
function assertBlueprintCoverage(): void {
  const ids = new Set<string>();
  for (const template of QUESTION_TEMPLATES) {
    if (ids.has(template.id)) {
      throw new Error(`Duplicate question template id: ${template.id}`);
    }
    ids.add(template.id);
  }

  for (const domain of DOMAIN_ORDER) {
    const available = TEMPLATES_BY_DOMAIN[domain]?.length ?? 0;
    if (available < QUESTIONS_PER_DOMAIN) {
      throw new Error(
        `Domain ${domain} has ${available} templates but the exam blueprint draws ${QUESTIONS_PER_DOMAIN}.`
      );
    }
  }
}

assertBlueprintCoverage();
