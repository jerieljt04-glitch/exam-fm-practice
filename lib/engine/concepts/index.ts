import type { ChoiceTemplate } from "../types";
import { ALM_CONCEPT_TEMPLATES } from "./alm";
import { ANNUITY_CONCEPT_TEMPLATES } from "./annuities";
import { BOND_CONCEPT_TEMPLATES } from "./bonds";
import { LOAN_CONCEPT_TEMPLATES } from "./loans";
import { TVM_CONCEPT_TEMPLATES } from "./tvm";

/** The Concept Practice bank: one file per syllabus topic. */
export const CONCEPT_TEMPLATES: ChoiceTemplate[] = [
  ...TVM_CONCEPT_TEMPLATES,
  ...ANNUITY_CONCEPT_TEMPLATES,
  ...LOAN_CONCEPT_TEMPLATES,
  ...BOND_CONCEPT_TEMPLATES,
  ...ALM_CONCEPT_TEMPLATES,
];
