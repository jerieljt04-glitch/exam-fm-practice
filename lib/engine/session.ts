import { TOPIC_ORDER, distributionFor, type TopicId } from "../syllabus";
import { buildQuestion } from "./assemble";
import { createRng, type Rng } from "./random";
import type { ReasoningSkill } from "./skills";
import { TEMPLATES } from "./templates";
import { integrationLevel } from "./types";
import type { Difficulty, IntegrationLevel, QuestionInstance, QuestionTemplate, ValidationRecord } from "./types";

export type SessionMode = "DIAGNOSTIC" | "EXAM" | "CHALLENGE" | "PRACTICE" | "REMEDIATION" | "TRANSFER";

/** Formula-integration buckets: single formula, two formulas, three or more, and reconstruction (levels 4–5). */
export type IntegrationBucket = "single" | "pair" | "multi" | "reconstruct";
export type IntegrationMix = Record<IntegrationBucket, number>;

export const DEFAULT_INTEGRATION_MIX: IntegrationMix = { single: 20, pair: 40, multi: 30, reconstruct: 10 };

export const BUCKET_LEVELS: Record<IntegrationBucket, IntegrationLevel[]> = { single: [1], pair: [2], multi: [3], reconstruct: [4, 5] };

export const BUCKET_LABELS: Record<IntegrationBucket, string> = {
  single: "Single formula",
  pair: "Two related formulas",
  multi: "Three or more formulas",
  reconstruct: "Reconstruction, derivation or algebraic reasoning",
};
export type DifficultySetting = Difficulty | "mixed";

export interface Target {
  /** A misconception id to set as a trap, or an objective to re-test. */
  misconception?: string;
  objective?: string;
  /** Templates the target must not be drawn from (the presentation already seen). */
  avoidTemplates?: string[];
}

export interface SessionPlan {
  mode: SessionMode;
  count: number;
  difficulty: DifficultySetting;
  seed: string;
  /** Misconceptions to prefer as distractors (profile focus). */
  prefer?: ReadonlySet<string>;
  /** Reasoning skills with little evidence so far; diagnostic draws lean toward them. */
  probeSkills?: ReadonlySet<ReasoningSkill>;
  /** Targeted questions for remediation and transfer sessions. */
  targets?: Target[];
  /** Formula-integration practice: share of questions per integration bucket (percentages). */
  integrationMix?: IntegrationMix;
}

export interface BuiltSession {
  questions: QuestionInstance[];
  rejected: ValidationRecord[];
  /** Template ids whose every attempt failed validation (excluded from this session). */
  flagged: string[];
}

/** Mix of levels used when the difficulty is "mixed": mostly exam standard, with advanced and challenge items. */
const MIXED_LEVELS: Difficulty[] = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3];

// ---------------------------------------------------------------- misconception index

let misconceptionIndex: Map<string, Set<string>> | null = null;

/**
 * Which misconceptions each template-level can set as a trap. Built by running
 * every template on a few seeds, so it always reflects the generators' actual
 * output rather than a hand-maintained list.
 */
export function templatesTesting(misconception: string): Array<{ template: QuestionTemplate; level: Difficulty }> {
  if (!misconceptionIndex) {
    misconceptionIndex = new Map();
    for (const template of TEMPLATES) {
      for (const level of template.levels) {
        const key = `${template.id}|${level}`;
        const seen = new Set<string>();
        for (let s = 0; s < 4; s += 1) {
          try {
            const draft = template.generate(createRng(`index|${key}|${s}`), level);
            draft.distractors.forEach((d) => seen.add(d.misconception));
          } catch {
            // A rejected parameter draw contributes nothing.
          }
        }
        misconceptionIndex.set(key, seen);
      }
    }
  }
  const out: Array<{ template: QuestionTemplate; level: Difficulty }> = [];
  for (const template of TEMPLATES) {
    for (const level of template.levels) {
      if (misconceptionIndex.get(`${template.id}|${level}`)?.has(misconception)) out.push({ template, level });
    }
  }
  return out;
}

// ---------------------------------------------------------------- integration index

let integrationIndex: Map<string, Set<IntegrationLevel>> | null = null;

/** The integration levels each template-level produces (sampled, since variants differ). */
export function integrationLevelsOf(template: QuestionTemplate, level: Difficulty): Set<IntegrationLevel> {
  if (!integrationIndex) {
    integrationIndex = new Map();
    for (const t of TEMPLATES) {
      for (const l of t.levels) {
        const seen = new Set<IntegrationLevel>();
        for (let s = 0; s < 4; s += 1) {
          try {
            seen.add(integrationLevel(t.generate(createRng(`integration|${t.id}|${l}|${s}`), l).chain));
          } catch {
            // a rejected parameter draw contributes nothing
          }
        }
        integrationIndex.set(`${t.id}|${l}`, seen);
      }
    }
  }
  return integrationIndex.get(`${template.id}|${level}`) ?? new Set();
}

/** Whole-question counts per bucket for a session, by largest remainder. */
export function bucketCounts(count: number, mix: IntegrationMix): Record<IntegrationBucket, number> {
  const buckets = Object.keys(mix) as IntegrationBucket[];
  const total = buckets.reduce((a, b) => a + Math.max(0, mix[b]), 0) || 1;
  const exact = buckets.map((b) => ({ b, x: (Math.max(0, mix[b]) * count) / total }));
  const out = Object.fromEntries(exact.map(({ b, x }) => [b, Math.floor(x)])) as Record<IntegrationBucket, number>;
  let left = count - Object.values(out).reduce((a, b) => a + b, 0);
  for (const { b } of [...exact].sort((p, q) => (q.x % 1) - (p.x % 1))) {
    if (left <= 0) break;
    out[b] += 1;
    left -= 1;
  }
  return out;
}

// ---------------------------------------------------------------- selection

function levelFor(setting: DifficultySetting, rng: Rng): Difficulty {
  return setting === "mixed" ? rng.choice(MIXED_LEVELS) : setting;
}

/** Nearest available level of a template to the one requested. */
function closestLevel(template: QuestionTemplate, wanted: Difficulty): Difficulty {
  return [...template.levels].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || b - a)[0];
}

function score(template: QuestionTemplate, plan: SessionPlan, usedFamilies: Map<string, number>, rng: Rng): number {
  let value = rng.next();
  value -= (usedFamilies.get(template.family) ?? 0) * 1.5;
  if (plan.probeSkills?.size) {
    value += template.reasoning.filter((skill) => plan.probeSkills!.has(skill)).length * 0.35;
  }
  return value;
}

/**
 * Builds the questions for a session. Topic counts follow the syllabus
 * weighting; no template appears twice; families repeat only when a topic has
 * run out of fresh ones; presentation order is shuffled; and every question
 * has passed validation (a template that cannot produce a valid question is
 * flagged and skipped).
 */
export function buildSession(plan: SessionPlan): BuiltSession {
  const rng = createRng(`session|${plan.seed}`);
  const rejected: ValidationRecord[] = [];
  const flagged: string[] = [];
  const questions: QuestionInstance[] = [];
  const usedTemplates = new Set<string>();
  const usedFamilies = new Map<string, number>();

  const take = (template: QuestionTemplate, level: Difficulty, prefer?: ReadonlySet<string>, mustInclude?: string): boolean => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = buildQuestion(template, level, `${plan.seed}|${questions.length}|${attempt}`, prefer);
      rejected.push(...result.rejected);
      if (!result.instance) {
        flagged.push(`${template.id}@${level}`);
        return false;
      }
      if (mustInclude && !result.instance.options.some((o) => o.misconceptionTag === mustInclude)) continue;
      questions.push(result.instance);
      usedTemplates.add(template.id);
      usedFamilies.set(template.family, (usedFamilies.get(template.family) ?? 0) + 1);
      return true;
    }
    return false;
  };

  // Targeted questions first (remediation and transfer).
  for (const target of plan.targets ?? []) {
    if (questions.length >= plan.count) break;
    const avoid = new Set(target.avoidTemplates ?? []);
    let candidates: Array<{ template: QuestionTemplate; level: Difficulty }> = [];
    if (target.misconception) {
      candidates = templatesTesting(target.misconception).filter((c) => !avoid.has(c.template.id) && !usedTemplates.has(c.template.id));
    }
    if (!candidates.length && target.objective) {
      candidates = TEMPLATES.filter((t) => (t.objective === target.objective || t.secondary.includes(target.objective!)) && !avoid.has(t.id) && !usedTemplates.has(t.id)).map(
        (template) => ({ template, level: closestLevel(template, plan.difficulty === "mixed" ? 2 : plan.difficulty) })
      );
    }
    const ordered = rng.shuffle(candidates).sort((a, b) => (usedFamilies.get(a.template.family) ?? 0) - (usedFamilies.get(b.template.family) ?? 0));
    for (const candidate of ordered) {
      const prefer = target.misconception ? new Set([target.misconception, ...(plan.prefer ?? [])]) : plan.prefer;
      if (take(candidate.template, candidate.level, prefer, target.misconception)) break;
    }
  }

  // Formula-integration practice: fill by integration bucket, spreading topics.
  if (plan.integrationMix && questions.length < plan.count) {
    const counts = bucketCounts(plan.count - questions.length, plan.integrationMix);
    const topicUse = new Map<string, number>();
    const all = TEMPLATES.flatMap((t) => t.levels.map((level) => ({ template: t, level })));
    const poolFor = (levels: IntegrationLevel[]) =>
      rng
        .shuffle(all)
        .filter(({ template, level }) => !usedTemplates.has(template.id) && [...integrationLevelsOf(template, level)].some((x) => levels.includes(x)))
        .sort((a, b) => (topicUse.get(a.template.topic) ?? 0) - (topicUse.get(b.template.topic) ?? 0) || (usedFamilies.get(a.template.family) ?? 0) - (usedFamilies.get(b.template.family) ?? 0));
    // Scarcest bucket first, so templates that are the only source of a level are not used up elsewhere.
    const buckets = (Object.keys(counts) as IntegrationBucket[]).sort((a, b) => poolFor(BUCKET_LEVELS[a]).length - poolFor(BUCKET_LEVELS[b]).length);
    for (const bucket of buckets) {
      for (let k = 0; k < counts[bucket]; k += 1) {
        // If a bucket has run dry, the nearest integration level stands in for it.
        let levels = BUCKET_LEVELS[bucket];
        let pool = poolFor(levels);
        for (let widen = 1; !pool.length && widen <= 4; widen += 1) {
          const lo = Math.min(...levels) - widen;
          const hi = Math.max(...levels) + widen;
          levels = ([1, 2, 3, 4, 5] as IntegrationLevel[]).filter((x) => x >= lo && x <= hi);
          pool = poolFor(levels);
        }
        let placed = false;
        for (const { template, level } of pool) {
          for (let attempt = 0; attempt < 4 && !placed; attempt += 1) {
            const result = buildQuestion(template, level, `${plan.seed}|int|${questions.length}|${attempt}`, plan.prefer);
            rejected.push(...result.rejected);
            if (result.instance && levels.includes(result.instance.integration)) {
              questions.push(result.instance);
              usedTemplates.add(template.id);
              usedFamilies.set(template.family, (usedFamilies.get(template.family) ?? 0) + 1);
              topicUse.set(template.topic, (topicUse.get(template.topic) ?? 0) + 1);
              placed = true;
            }
          }
          if (placed) break;
        }
      }
    }
  }

  // Fill the rest by topic weighting.
  const remaining = plan.count - questions.length;
  if (remaining > 0) {
    const counts = distributionFor(remaining, rng.shuffle(TOPIC_ORDER));
    for (const topic of TOPIC_ORDER) {
      for (let k = 0; k < counts[topic]; k += 1) {
        const wanted = levelFor(plan.difficulty, rng);
        if (!fillOne(topic, wanted)) {
          // The topic pool is exhausted at this level: allow the nearest level instead.
          fillOne(topic, wanted, true);
        }
      }
    }
  }

  function fillOne(topic: TopicId, wanted: Difficulty, anyLevel = false): boolean {
    const pool = TEMPLATES.filter(
      (t) => t.topic === topic && !usedTemplates.has(t.id) && (anyLevel || t.levels.includes(wanted))
    ).sort((a, b) => score(b, plan, usedFamilies, rng) - score(a, plan, usedFamilies, rng));
    for (const template of pool) {
      if (take(template, anyLevel ? closestLevel(template, wanted) : wanted, plan.prefer)) return true;
    }
    return false;
  }

  return { questions: rng.shuffle(questions), rejected, flagged };
}
