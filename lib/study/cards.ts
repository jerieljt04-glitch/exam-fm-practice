/**
 * Flashcards for the study area, built from the formula library (itself read
 * from the two reference sheets) and the concept registry. Nothing here is
 * authored twice: a card is a view of a registry entry, so a correction in
 * the library flows straight into the deck.
 *
 *   f:<formula>:recall     name and purpose → write the formula
 *   f:<formula>:recognise  the formula → name it, say what it computes and when it applies
 *   c:<concept>            concept → explain it in your own words
 */
import { CONCEPTS } from "../concepts/registry";
import { FORMULAS } from "../formulas/registry";
import type { FormulaArea, Relevance } from "../formulas/types";
import type { TopicId } from "../syllabus";

export type Deck = "formulas" | "concepts";
export type CardKind = "recall" | "recognise" | "concept";

export const DECK_LABELS: Record<Deck, string> = {
  formulas: "Formula memorisation",
  concepts: "Concept review",
};

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  recall: "Recall the formula",
  recognise: "Recognise the formula",
  concept: "Explain the concept",
};

export interface StudyCardDef {
  id: string;
  deck: Deck;
  kind: CardKind;
  /** Formula area (formula cards) — used for filtering. */
  area?: FormulaArea;
  topic: TopicId;
  relevance: Relevance;
  /** Registry id of the formula or concept the card shows. */
  ref: string;
  title: string;
}

/** Formula areas to syllabus topics, for study statistics. */
export const AREA_TOPIC: Record<FormulaArea, TopicId> = {
  A: "TVM",
  B: "ANNUITIES",
  C: "ALM",
  D: "LOANS",
  E: "BONDS",
  F: "ALM",
  G: "ALM",
  M: "TVM",
};

function formulaCards(): StudyCardDef[] {
  return FORMULAS.flatMap((f) => {
    const base = { deck: "formulas" as const, area: f.area, topic: AREA_TOPIC[f.area], relevance: f.relevance, ref: f.id, title: f.name };
    return [
      { ...base, id: `f:${f.id}:recall`, kind: "recall" as const },
      { ...base, id: `f:${f.id}:recognise`, kind: "recognise" as const },
    ];
  });
}

function conceptCards(): StudyCardDef[] {
  return CONCEPTS.map((c) => ({ id: `c:${c.id}`, deck: "concepts" as const, kind: "concept" as const, topic: c.topic, relevance: "core" as const, ref: c.id, title: c.label }));
}

export const STUDY_CARDS: StudyCardDef[] = [...formulaCards(), ...conceptCards()];
export const STUDY_CARD_BY_ID: Record<string, StudyCardDef> = Object.fromEntries(STUDY_CARDS.map((c) => [c.id, c]));

export interface CardFilter {
  deck: Deck;
  area?: FormulaArea | "all";
  topic?: TopicId | "all";
  kind?: CardKind | "both";
  /** Include formulas whose syllabus relevance is unclear (continuous annuities, …). Off by default. */
  includeUnclear?: boolean;
}

export function filterCards(filter: CardFilter): StudyCardDef[] {
  return STUDY_CARDS.filter(
    (c) =>
      c.deck === filter.deck &&
      (!filter.area || filter.area === "all" || c.area === filter.area) &&
      (!filter.topic || filter.topic === "all" || c.topic === filter.topic) &&
      (!filter.kind || filter.kind === "both" || c.kind === filter.kind) &&
      (filter.includeUnclear || c.relevance !== "unclear")
  );
}
