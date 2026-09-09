import type { TopicDomain } from "../../types/exam";
import {
  DEFAULT_DIFFICULTIES,
  DOMAIN_ORDER,
  MIN_ADVANCED_STEPS,
  DOMAIN_QUESTION_RANGES,
  isCurrentSyllabusTemplate,
} from "../../exam-config";
import { ALM_TEMPLATES } from "./alm-immunization";
import { ANNUITY_TEMPLATES } from "./annuities";
import { BOND_TEMPLATES } from "./bonds";
import { LOAN_TEMPLATES } from "./loans";
import { MULTI_STEP_TEMPLATES } from "./multi-step";
import { TIME_VALUE_OF_MONEY_TEMPLATES } from "./time-value-of-money";
import { CONCEPTUAL_TEMPLATES } from "./conceptual";
import { EXPANDED_CONCEPTUAL_TEMPLATES } from "./conceptual-expanded";
import type { QuestionTemplateDefinition } from "./types";

export * from "./types";

/**
 * Qualitative items authored with fixed choices rather than a computed answer.
 * The exam caps how many of these a sitting may draw.
 */
const CONCEPTUAL_TEMPLATE_IDS: ReadonlySet<string> = new Set(
  [...CONCEPTUAL_TEMPLATES, ...EXPANDED_CONCEPTUAL_TEMPLATES].map((template) => template.id)
);

export function isConceptualTemplate(template: { id: string }): boolean {
  return CONCEPTUAL_TEMPLATE_IDS.has(template.id);
}

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
  ...MULTI_STEP_TEMPLATES,
  ...CONCEPTUAL_TEMPLATES,
  ...EXPANDED_CONCEPTUAL_TEMPLATES,
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
 * Authoring invariants, enforced at module load so a bad template fails the
 * build rather than an exam.
 *
 * - template ids are unique;
 * - a level 3+ item chains at least `MIN_ADVANCED_STEPS` sub-problems and
 *   combines at least two syllabus areas;
 * - each domain offers at least as many eligible templates as the blueprint
 *   draws from it, so no structure repeats inside one sitting;
 * - each domain offers enough level 3+ items to meet the advanced quota.
 */
function assertBlueprintCoverage(): void {
  const ids = new Set<string>();
  for (const template of QUESTION_TEMPLATES) {
    if (ids.has(template.id)) {
      throw new Error(`Duplicate question template id: ${template.id}`);
    }
    ids.add(template.id);

    if (template.difficulty >= 3) {
      if (template.steps < MIN_ADVANCED_STEPS) {
        throw new Error(
          `${template.id} is level ${template.difficulty} but chains only ${template.steps} steps; ${MIN_ADVANCED_STEPS} are required.`
        );
      }
      if (template.topics.length < 2) {
        throw new Error(
          `${template.id} is level ${template.difficulty} but draws on a single syllabus area; level 3+ items must combine at least two.`
        );
      }
    }
  }

  for (const domain of DOMAIN_ORDER) {
    const pool = TEMPLATES_BY_DOMAIN[domain] ?? [];
    const eligible = pool.filter((template) =>
      DEFAULT_DIFFICULTIES.includes(template.difficulty)
    );
    const current = eligible.filter((template) => isCurrentSyllabusTemplate(template.topics));
    if (current.length < DOMAIN_QUESTION_RANGES[domain].max) {
      throw new Error(
        `Domain ${domain} offers ${current.length} current-syllabus templates but the blueprint may draw ${DOMAIN_QUESTION_RANGES[domain].max}.`
      );
    }
  }
}

assertBlueprintCoverage();
