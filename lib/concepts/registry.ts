import { OUTCOMES } from "../syllabus";
import { ALM_CONCEPTS } from "./alm";
import { ANNUITY_CONCEPTS } from "./annuities";
import { BOND_CONCEPTS } from "./bonds";
import { LOAN_CONCEPTS } from "./loans";
import { TVM_CONCEPTS } from "./tvm";
import type { Concept } from "./types";

export type { Concept } from "./types";

/** Every concept Concept Practice tests, across the five syllabus topics. */
export const CONCEPTS: Concept[] = [...TVM_CONCEPTS, ...ANNUITY_CONCEPTS, ...LOAN_CONCEPTS, ...BOND_CONCEPTS, ...ALM_CONCEPTS];

export const CONCEPT_BY_ID: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));

export const getConcept = (id: string): Concept | undefined => CONCEPT_BY_ID[id];

function assertConcepts(): void {
  const seen = new Set<string>();
  for (const c of CONCEPTS) {
    if (seen.has(c.id)) throw new Error(`Concept ${c.id} is defined twice.`);
    seen.add(c.id);
    if (!c.outcomes.length) throw new Error(`Concept ${c.id} has no syllabus outcome.`);
    for (const o of c.outcomes) if (!OUTCOMES[o]) throw new Error(`Concept ${c.id} names unknown outcome ${o}.`);
  }
  for (const c of CONCEPTS) for (const other of c.confusable ?? []) if (!seen.has(other)) throw new Error(`Concept ${c.id} lists unknown confusable ${other}.`);
}

assertConcepts();
