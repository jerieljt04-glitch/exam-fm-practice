import type { TopicDomain } from "../../types/exam";
import {
  DEFAULT_DIFFICULTIES,
  EXAM_ADVANCED_COUNTS,
  EXAM_DIFFICULTIES,
  DOMAIN_ORDER,
  MIN_ADVANCED_STEPS,
  DOMAIN_QUESTION_RANGES,
} from "../../exam-config";
import { classifyTemplate } from "./classification";
import { SOA_ALM_DURATION_TEMPLATES } from "./soa/alm-duration";
import { SOA_ALM_IMMUNIZATION_TEMPLATES } from "./soa/alm-immunization";
import { SOA_ALM_RATE_TEMPLATES } from "./soa/alm-rates";
import { SOA_ANNUITY_TEMPLATES } from "./soa/annuities";
import { SOA_ANNUITY_CONCEPT_TEMPLATES } from "./soa/annuities-concepts";
import { SOA_VARYING_ANNUITY_TEMPLATES } from "./soa/annuities-varying";
import { SOA_ADVANCED_BOND_TEMPLATES } from "./soa/bonds-advanced";
import { SOA_BOND_TEMPLATES } from "./soa/bonds";
import { SOA_ADVANCED_LOAN_TEMPLATES } from "./soa/loans-advanced";
import { SOA_LOAN_TEMPLATES } from "./soa/loans";
import { SOA_TVM_TEMPLATES } from "./soa/tvm";
import type { QuestionTemplateDefinition } from "./types";

export * from "./types";

/**
 * The question bank. Every template is modelled on question types from the
 * SOA's Exam FM sample set and parameterizes its own figures, so two candidates
 * sitting the same template receive different numbers, a different correct
 * answer and different distractors.
 */
export const QUESTION_TEMPLATES: QuestionTemplateDefinition[] = [
  ...SOA_TVM_TEMPLATES,
  ...SOA_ANNUITY_TEMPLATES,
  ...SOA_VARYING_ANNUITY_TEMPLATES,
  ...SOA_ANNUITY_CONCEPT_TEMPLATES,
  ...SOA_LOAN_TEMPLATES,
  ...SOA_ADVANCED_LOAN_TEMPLATES,
  ...SOA_BOND_TEMPLATES,
  ...SOA_ADVANCED_BOND_TEMPLATES,
  ...SOA_ALM_RATE_TEMPLATES,
  ...SOA_ALM_DURATION_TEMPLATES,
  ...SOA_ALM_IMMUNIZATION_TEMPLATES,
].map(classifyTemplate);

const QUALITATIVE_IDS: ReadonlySet<string> = new Set(
  QUESTION_TEMPLATES.filter((template) => template.qualitative).map((template) => template.id)
);

/**
 * Qualitative items — true/false statements, choosing an equation of value,
 * naming a technique — rather than calculations. The exam caps how many of
 * these a sitting may draw. Accepts a template or a generated question.
 */
export function isConceptualTemplate(item: { id?: string; templateId?: string; qualitative?: boolean }): boolean {
  if (item.qualitative !== undefined) return item.qualitative;
  const id = item.templateId ?? item.id;
  return id !== undefined && QUALITATIVE_IDS.has(id);
}

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
 * - a level 3+ item chains at least `MIN_ADVANCED_STEPS` sub-problems;
 * - each domain offers at least as many distinct numerical templates as the
 *   blueprint draws from it, so no structure repeats inside one sitting;
 * - each domain offers enough level 3+ items to meet the advanced quota.
 */
function assertBlueprintCoverage(): void {
  const ids = new Set<string>();
  for (const template of QUESTION_TEMPLATES) {
    if (ids.has(template.id)) {
      throw new Error(`Duplicate question template id: ${template.id}`);
    }
    ids.add(template.id);

    if (template.difficulty >= 3 && template.steps < MIN_ADVANCED_STEPS) {
      throw new Error(
        `${template.id} is level ${template.difficulty} but chains only ${template.steps} steps; ${MIN_ADVANCED_STEPS} are required.`
      );
    }
  }

  for (const domain of DOMAIN_ORDER) {
    const pool = (TEMPLATES_BY_DOMAIN[domain] ?? []).filter((template) =>
      DEFAULT_DIFFICULTIES.includes(template.difficulty)
    );
    const examNumerical = pool.filter(
      (template) => EXAM_DIFFICULTIES.includes(template.difficulty) && !isConceptualTemplate(template)
    );
    if (examNumerical.length < DOMAIN_QUESTION_RANGES[domain].max) {
      throw new Error(
        `Domain ${domain} offers ${examNumerical.length} distinct numerical templates but a test may draw ${DOMAIN_QUESTION_RANGES[domain].max}.`
      );
    }
    const advanced = examNumerical.filter((template) => template.difficulty >= 3);
    if (advanced.length < EXAM_ADVANCED_COUNTS[domain]) {
      throw new Error(
        `Domain ${domain} offers ${advanced.length} level 3+ numerical templates but a mock draws ${EXAM_ADVANCED_COUNTS[domain]}.`
      );
    }
  }
}

assertBlueprintCoverage();
