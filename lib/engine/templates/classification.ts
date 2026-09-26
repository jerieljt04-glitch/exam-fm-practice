import type { TopicDomain } from "../../types/exam";
import type { QuestionTemplateDefinition } from "./types";

/**
 * Normalises a template's classification. Each template is filed under the
 * domain whose method it assesses, not the instrument in its story; shared
 * discounting and annuity algebra is a prerequisite, not an extra domain.
 * A template that genuinely assesses two domains lists both in
 * `practiceDomains`, and is then offered in a custom practice set only when
 * both are selected.
 */
export function classifyTemplate(template: QuestionTemplateDefinition): QuestionTemplateDefinition {
  return {
    ...template,
    practiceDomains: template.practiceDomains ?? [template.domain],
  };
}

export function matchesPracticeDomains(
  template: QuestionTemplateDefinition,
  domains: readonly TopicDomain[]
): boolean {
  return domains.includes(template.domain) &&
    (template.practiceDomains ?? [template.domain]).every((domain) => domains.includes(domain));
}
