import type { Target } from "../engine/session";
import { ANY_TEMPLATE_BY_ID } from "../engine/templates";
import { isConceptItem } from "../engine/types";
import { classifyAttempt, type AttemptRecord } from "./attempts";

/**
 * The remediation cycle.
 *
 *   detect a mistake → explain the principle (the report) → a different problem
 *   on the same principle (stage 1) → another variation (stage 2) → a retest
 *   after a delay (stage 3) → resolved.
 *
 * A wrong answer at any stage sends the item back to stage 1. A correct answer
 * given with low confidence does not advance it.
 *
 * A conceptual failure (a wrong Concept Practice answer) opens a CONCEPT item.
 * Its retests are drawn from the concept bank and must be conceptually
 * different — another concept family or item format testing the same
 * misconception or outcome — not the same question with new numbers.
 */

export const REMEDIATION_DELAY_HOURS = 24;
export const REMEDIATION_SET_LIMIT = 12;

export interface RemediationItemData {
  id?: string;
  target: string;
  kind: "MISCONCEPTION" | "WEAK_REASONING" | "CONCEPT";
  objective: string;
  sourceQuestionId: string;
  sourceTemplateId: string;
  stage: number;
  status: "OPEN" | "SCHEDULED" | "RESOLVED";
  dueAt: string;
  attempts: { questionId: string; templateId: string; correct: boolean; at: string }[];
  createdAt?: string;
}

const active = (item: RemediationItemData) => item.status !== "RESOLVED";

export function isDue(item: RemediationItemData, now: Date): boolean {
  return item.status === "OPEN" || (item.status === "SCHEDULED" && Date.parse(item.dueAt) <= now.getTime());
}

function tests(item: RemediationItemData, attempt: AttemptRecord): boolean {
  if (attempt.questionId === item.sourceQuestionId) return false;
  if (item.kind === "MISCONCEPTION") return attempt.instance.options.some((o) => o.misconceptionTag === item.target);
  if (item.kind === "CONCEPT") {
    return isConceptItem(attempt.instance) && (attempt.instance.options.some((o) => o.misconceptionTag === item.target) || attempt.instance.objective === item.objective);
  }
  return attempt.instance.objective === item.objective;
}

/**
 * Applies a submitted session's attempts to the remediation items and opens new
 * items for fresh mistakes. Returns every item that changed or was created.
 */
export function applySession(existing: readonly RemediationItemData[], attempts: readonly AttemptRecord[], now: Date): RemediationItemData[] {
  const items = existing.map((item) => ({ ...item, attempts: [...item.attempts] }));
  const changed = new Set<RemediationItemData>();
  const ordered = [...attempts].sort((a, b) => a.position - b.position);
  const at = now.toISOString();
  const later = new Date(now.getTime() + REMEDIATION_DELAY_HOURS * 3_600_000).toISOString();

  for (const attempt of ordered) {
    const evidence = classifyAttempt(attempt);
    for (const item of items) {
      if (!active(item) || !tests(item, attempt)) continue;
      item.attempts.push({ questionId: attempt.questionId, templateId: attempt.instance.templateId, correct: evidence.correct, at });
      changed.add(item);
      if (!evidence.correct) {
        item.stage = 1;
        item.status = "OPEN";
        item.dueAt = at;
        continue;
      }
      if (evidence.quality === "POSSIBLE_GUESS") continue;
      if (item.stage === 1) {
        item.stage = 2;
      } else if (item.stage === 2) {
        item.stage = 3;
        item.status = "SCHEDULED";
        item.dueAt = later;
      } else if (item.stage >= 3 && isDue(item, now)) {
        item.status = "RESOLVED";
      }
    }

    // New mistakes open new items: conceptual failures as CONCEPT items, calculation mistakes as MISCONCEPTION items.
    const kind: RemediationItemData["kind"] = isConceptItem(attempt.instance) ? "CONCEPT" : "MISCONCEPTION";
    if (evidence.selectedMisconception && !items.some((i) => active(i) && i.kind === kind && i.target === evidence.selectedMisconception)) {
      const item: RemediationItemData = {
        target: evidence.selectedMisconception,
        kind,
        objective: attempt.instance.objective,
        sourceQuestionId: attempt.questionId,
        sourceTemplateId: attempt.instance.templateId,
        stage: 1,
        status: "OPEN",
        dueAt: at,
        attempts: [],
      };
      items.push(item);
      changed.add(item);
    }
    if (
      evidence.correct &&
      (evidence.quality === "POSSIBLE_GUESS" || evidence.quality === "SUSPECT_METHOD") &&
      !items.some((i) => active(i) && i.kind === "WEAK_REASONING" && i.objective === attempt.instance.objective)
    ) {
      const item: RemediationItemData = {
        target: attempt.instance.objective,
        kind: "WEAK_REASONING",
        objective: attempt.instance.objective,
        sourceQuestionId: attempt.questionId,
        sourceTemplateId: attempt.instance.templateId,
        stage: 1,
        status: "OPEN",
        dueAt: at,
        attempts: [],
      };
      items.push(item);
      changed.add(item);
    }
  }
  return [...changed];
}

/** The targets for the next remediation set: two variations for new items, one for items further along. */
export function remediationTargets(items: readonly RemediationItemData[], now: Date): Target[] {
  const due = items.filter((item) => isDue(item, now)).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const targets: Target[] = [];
  for (const item of due) {
    const avoidTemplates = [item.sourceTemplateId, ...item.attempts.map((a) => a.templateId)];
    let target: Target;
    if (item.kind === "CONCEPT") {
      const source = ANY_TEMPLATE_BY_ID[item.sourceTemplateId];
      const family = source && source.kind === "choice" ? source.conceptFamily : undefined;
      const format = source && source.kind === "choice" ? source.itemFormat : undefined;
      target = {
        misconception: item.target,
        objective: item.objective,
        avoidTemplates,
        conceptual: true,
        avoidFamilies: family ? [family] : [],
        avoidFormats: format ? [format] : [],
      };
    } else if (item.kind === "MISCONCEPTION") {
      target = { misconception: item.target, objective: item.objective, avoidTemplates };
    } else {
      target = { objective: item.objective, avoidTemplates };
    }
    const copies = item.stage === 1 ? 2 : 1;
    for (let k = 0; k < copies && targets.length < REMEDIATION_SET_LIMIT; k += 1) targets.push(target);
  }
  return targets;
}
