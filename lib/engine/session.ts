import { TOPIC_ORDER, distributionFor, type TopicId } from "../syllabus";
import { approachOf, chainSignature } from "./approach";
import { buildAny, buildChoiceQuestion } from "./assemble";
import { createRng, type Rng } from "./random";
import type { ReasoningSkill } from "./skills";
import { nonNumericCount, STYLE_MIX, type StyleMix } from "./style";
import { ALL_TEMPLATES, CONCEPT_TEMPLATES } from "./templates";
import { integrationLevel, isChoiceTemplate, type ConceptFamily, type ItemFormat } from "./types";
import type { AnyTemplate, ChoiceTemplate, Difficulty, IntegrationLevel, QuestionInstance, ValidationRecord } from "./types";

export type SessionMode = "DIAGNOSTIC" | "EXAM" | "CHALLENGE" | "PRACTICE" | "CONCEPT" | "REMEDIATION" | "TRANSFER";

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

/** Concept Practice focus filters. */
export type ConceptFocus = "mixed" | "definitions" | "equations" | "statements" | "errors";

export const CONCEPT_FOCUS_LABELS: Record<ConceptFocus, string> = {
  mixed: "Mixed concepts",
  definitions: "Definitions and interpretation",
  equations: "Equations and notation",
  statements: "Statement analysis",
  errors: "Error diagnosis",
};

const FOCUS_FAMILIES: Record<Exclude<ConceptFocus, "mixed">, ConceptFamily[]> = {
  definitions: ["definition", "interpretation"],
  equations: ["equation", "notation", "timeline"],
  statements: ["statements"],
  errors: ["error-diagnosis"],
};
const STATEMENT_FORMATS: ReadonlySet<ItemFormat> = new Set<ItemFormat>(["statement-combination", "correct-statement", "enumerated-conditions"]);

export function matchesFocus(template: ChoiceTemplate, focus: ConceptFocus): boolean {
  if (focus === "mixed") return true;
  const family = template.conceptFamily;
  if (focus === "statements") return family === "statements" || STATEMENT_FORMATS.has(template.itemFormat);
  if (focus === "equations") return (family !== undefined && FOCUS_FAMILIES.equations.includes(family)) || template.itemFormat === "equation-selection" || template.itemFormat === "expression-selection";
  return family !== undefined && FOCUS_FAMILIES[focus].includes(family);
}

export interface Target {
  /** A misconception id to set as a trap, or an objective to re-test. */
  misconception?: string;
  objective?: string;
  /** Templates the target must not be drawn from (the presentation already seen). */
  avoidTemplates?: string[];
  /** Retest a conceptual failure with a conceptually different question (another family or format). */
  conceptual?: boolean;
  avoidFamilies?: string[];
  avoidFormats?: string[];
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
  /** Concept Practice: focus and optional topic filter. */
  conceptFocus?: ConceptFocus;
  topic?: TopicId | null;
  /**
   * Share of non-numerical items. Defaults to STYLE_MIX for the mode; `null`
   * means numerical items only (formula practice, remediation, transfer).
   */
  styleMix?: StyleMix | null;
  /** Learning outcomes the history marks as weak or untested; selection leans toward them. */
  weakObjectives?: ReadonlySet<string>;
  untestedObjectives?: ReadonlySet<string>;
  /** Presentations seen recently ("templateId" and "templateId|variant"); selection avoids them. */
  recent?: ReadonlySet<string>;
  /**
   * Solution approaches (formula-chain fingerprints, lib/engine/approach.ts)
   * used in recent sessions, weighted 0–1 by recency. Selection steers away
   * from them so a new exam asks for different reasoning, not new numbers.
   */
  recentApproaches?: ReadonlyMap<string, number>;
  /** Templates used in recent sessions, weighted 0–1 by recency (overrides the flat `recent` penalty). */
  recentTemplates?: ReadonlyMap<string, number>;
}

export interface Shortfall {
  requested: number;
  built: number;
  reason: string;
}

export interface BuiltSession {
  questions: QuestionInstance[];
  rejected: ValidationRecord[];
  /** Template ids whose every attempt failed validation (excluded from this session). */
  flagged: string[];
  /** Set when fewer questions than requested could be built without breaking a rule (never filled with another level). */
  shortfall: Shortfall | null;
}

/** Mix of levels used when the difficulty is "mixed": mostly exam standard, with advanced and challenge items. */
const MIXED_LEVELS: Difficulty[] = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3];
const MIXED_CONCEPT_LEVELS: Difficulty[] = [1, 1, 2, 2, 3];

/** Calculation items answer with one number; everything else counts toward the non-numerical share. */
const isNumericTemplate = (t: AnyTemplate) => !isChoiceTemplate(t);

// ---------------------------------------------------------------- indexes (sampled from the generators)

interface TemplateProfile {
  misconceptions: Set<string>;
  integration: Set<IntegrationLevel>;
  concepts: Set<string>;
  /** Solution-approach fingerprints the template-level produces. */
  approaches: Set<string>;
}

let profileIndex: Map<string, TemplateProfile> | null = null;

/**
 * What each template-level actually produces — misconceptions set as traps,
 * integration levels and concepts tested — sampled by running the generator
 * on a few seeds, so it always reflects real output rather than a
 * hand-maintained list.
 */
function profileOf(template: AnyTemplate, level: Difficulty): TemplateProfile {
  if (!profileIndex) profileIndex = new Map();
  const key = `${template.id}|${level}`;
  let profile = profileIndex.get(key);
  if (profile) return profile;
  profile = { misconceptions: new Set(), integration: new Set(), concepts: new Set(), approaches: new Set() };
  const variants = isChoiceTemplate(template) ? Math.max(1, template.variants) : 1;
  for (let s = 0; s < 4; s += 1) {
    try {
      const rng = createRng(`index|${key}|${s}`);
      if (isChoiceTemplate(template)) {
        const draft = template.generate(rng, level, s % variants);
        draft.distractors.forEach((d) => d.misconception && profile!.misconceptions.add(d.misconception));
        draft.statements?.forEach((st) => profile!.misconceptions.add(st.misconception));
        draft.concept?.concepts.forEach((c) => profile!.concepts.add(c));
        if (draft.chain) profile.integration.add(integrationLevel(draft.chain));
        profile.approaches.add(draft.chain?.steps.length ? chainSignature(draft.chain) : `template:${template.id}|${s % variants}`);
      } else {
        const draft = template.generate(rng, level);
        draft.distractors.forEach((d) => profile!.misconceptions.add(d.misconception));
        profile.integration.add(integrationLevel(draft.chain));
        profile.approaches.add(chainSignature(draft.chain));
      }
    } catch {
      // A rejected parameter draw contributes nothing.
    }
  }
  profileIndex.set(key, profile);
  return profile;
}

export function templatesTesting(misconception: string, pool: readonly AnyTemplate[] = ALL_TEMPLATES): Array<{ template: AnyTemplate; level: Difficulty }> {
  const out: Array<{ template: AnyTemplate; level: Difficulty }> = [];
  for (const template of pool) {
    for (const level of template.levels) if (profileOf(template, level).misconceptions.has(misconception)) out.push({ template, level });
  }
  return out;
}

/** The integration levels each template-level produces (sampled, since variants differ). Concept items have none. */
export function integrationLevelsOf(template: AnyTemplate, level: Difficulty): Set<IntegrationLevel> {
  return profileOf(template, level).integration;
}

/** Solution approaches a template-level produces (sampled). */
export function approachesOf(template: AnyTemplate, level: Difficulty): Set<string> {
  return profileOf(template, level).approaches;
}

/** Concepts a template-level tests (sampled). */
export function conceptsOf(template: AnyTemplate, level: Difficulty): Set<string> {
  return profileOf(template, level).concepts;
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

/** Splits `total` across topics in proportion to `weights` (largest remainder), never exceeding a topic's weight. */
function proportional(total: number, weights: Record<TopicId, number>, order: TopicId[]): Record<TopicId, number> {
  const sum = order.reduce((a, t) => a + weights[t], 0) || 1;
  const exact = order.map((t) => ({ t, x: (weights[t] * total) / sum }));
  const out = Object.fromEntries(exact.map(({ t, x }) => [t, Math.min(weights[t], Math.floor(x))])) as Record<TopicId, number>;
  let left = total - order.reduce((a, t) => a + out[t], 0);
  for (const { t } of [...exact].sort((a, b) => (b.x % 1) - (a.x % 1))) {
    if (left <= 0) break;
    if (out[t] < weights[t]) {
      out[t] += 1;
      left -= 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- selection

function levelFor(setting: DifficultySetting, rng: Rng, mixed: Difficulty[] = MIXED_LEVELS): Difficulty {
  return setting === "mixed" ? rng.choice(mixed) : setting;
}

/** Nearest available level of a template to the one requested. */
function closestLevel(template: AnyTemplate, wanted: Difficulty): Difficulty {
  return [...template.levels].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || b - a)[0];
}

interface Usage {
  templates: Set<string>;
  variants: Set<string>;
  families: Map<string, number>;
  objectives: Map<string, number>;
  formats: Map<string, number>;
  concepts: Map<string, number>;
  approaches: Map<string, number>;
}

const formatOf = (t: AnyTemplate): string => (isChoiceTemplate(t) ? t.itemFormat : "numeric");

function score(template: AnyTemplate, level: Difficulty, plan: SessionPlan, use: Usage, rng: Rng): number {
  let value = rng.next();
  value -= (use.families.get(template.family) ?? 0) * 1.5;
  value -= (use.objectives.get(template.objective) ?? 0) * 0.8;
  value -= (use.formats.get(formatOf(template)) ?? 0) * 0.3;
  if (plan.probeSkills?.size) value += template.reasoning.filter((skill) => plan.probeSkills!.has(skill)).length * 0.35;
  if (plan.weakObjectives?.has(template.objective)) value += 0.6;
  if (plan.untestedObjectives?.has(template.objective)) value += 0.5;
  if (plan.recentTemplates) value -= (plan.recentTemplates.get(template.id) ?? 0) * 1.2;
  else if (plan.recent?.has(template.id)) value -= 0.7;
  // Solution approaches: never repeat one inside a session while others exist, and lean
  // away from those the last few sessions used, so each exam asks for different reasoning.
  const approaches = [...approachesOf(template, level)];
  if (approaches.length) {
    const inSession = approaches.filter((a) => use.approaches.has(a)).length / approaches.length;
    value -= inSession * 3;
    if (plan.recentApproaches?.size) {
      const seen = approaches.reduce((a, k) => a + (plan.recentApproaches!.get(k) ?? 0), 0) / approaches.length;
      value -= seen * 1.6;
    }
  }
  if (isChoiceTemplate(template) && template.practice === "concept") {
    const overlap = [...conceptsOf(template, level)].reduce((a, c) => a + (use.concepts.get(c) ?? 0), 0);
    value -= overlap * 0.9;
  }
  return value;
}

/**
 * Builds the questions for a session.
 *
 * - Topic counts follow the syllabus weighting (or the topic filter).
 * - A fixed difficulty is strict: a slot is never filled from another level.
 *   If a topic runs out at that level another topic's template at the same
 *   level is used; if the whole bank runs out the session is shorter and
 *   `shortfall` says so — it is never silently downgraded.
 * - Exams, diagnostics and challenges mix numerical and non-numerical items
 *   by STYLE_MIX, spread over topics in proportion to their counts.
 * - No template appears twice while alternatives exist; families, outcomes,
 *   formats and concepts are spread; weak, untested and not-recently-seen
 *   material is preferred.
 * - Every question has passed validation; a template that cannot produce a
 *   valid question is flagged and skipped.
 */
export function buildSession(plan: SessionPlan): BuiltSession {
  const rng = createRng(`session|${plan.seed}`);
  const rejected: ValidationRecord[] = [];
  const flagged: string[] = [];
  const questions: QuestionInstance[] = [];
  const use: Usage = { templates: new Set(), variants: new Set(), families: new Map(), objectives: new Map(), formats: new Map(), concepts: new Map(), approaches: new Map() };
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  let shortfallReason: string | null = null;

  const record = (template: AnyTemplate, instance: QuestionInstance) => {
    questions.push(instance);
    use.templates.add(template.id);
    if (instance.kind === "choice") use.variants.add(`${template.id}|${instance.variant}`);
    bump(use.families, template.family);
    bump(use.objectives, template.objective);
    bump(use.formats, formatOf(template));
    bump(use.approaches, approachOf(instance));
    if (instance.kind === "choice") instance.concept?.concepts.forEach((c) => bump(use.concepts, c));
  };

  /** Variant of a choice template not yet used here, preferring one not seen recently. */
  const pickVariant = (template: ChoiceTemplate): number | null => {
    const all = Array.from({ length: Math.max(1, template.variants) }, (_, k) => k);
    const unused = all.filter((k) => !use.variants.has(`${template.id}|${k}`));
    if (!unused.length) return null;
    const fresh = unused.filter((k) => !plan.recent?.has(`${template.id}|${k}`));
    return rng.choice(fresh.length ? fresh : unused);
  };

  const take = (template: AnyTemplate, level: Difficulty, opts: { prefer?: ReadonlySet<string>; mustInclude?: string; allowRepeat?: boolean } = {}): boolean => {
    if (!opts.allowRepeat && use.templates.has(template.id)) return false;
    let variant: number | undefined;
    if (isChoiceTemplate(template)) {
      const v = pickVariant(template);
      if (v === null) return false;
      variant = v;
    }
    // A template can produce several solution approaches; when the draw lands on one already
    // used in this session or in the last session, try another draw before settling for it.
    let fallback: QuestionInstance | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = buildAny(template, level, `${plan.seed}|${questions.length}|${attempt}`, { prefer: opts.prefer, variant });
      rejected.push(...result.rejected);
      if (!result.instance) {
        if (fallback) break;
        flagged.push(`${template.id}@${level}`);
        return false;
      }
      if (opts.mustInclude && !result.instance.options.some((o) => o.misconceptionTag === opts.mustInclude)) continue;
      const approach = approachOf(result.instance);
      const stale = use.approaches.has(approach) || (plan.recentApproaches?.get(approach) ?? 0) >= 1;
      if (!stale) {
        record(template, result.instance);
        return true;
      }
      fallback ??= result.instance;
    }
    if (fallback) {
      record(template, fallback);
      return true;
    }
    return false;
  };

  // ------------------------------------------------ targeted questions (remediation and transfer)
  for (const target of plan.targets ?? []) {
    if (questions.length >= plan.count) break;
    const avoid = new Set(target.avoidTemplates ?? []);
    const avoidFamilies = new Set(target.avoidFamilies ?? []);
    const avoidFormats = new Set(target.avoidFormats ?? []);
    const pool = target.conceptual ? (CONCEPT_TEMPLATES as AnyTemplate[]) : ALL_TEMPLATES.filter((t) => !isChoiceTemplate(t) || t.practice === "calculation");
    const eligible = (t: AnyTemplate) => !avoid.has(t.id) && !use.templates.has(t.id);
    let candidates: Array<{ template: AnyTemplate; level: Difficulty }> = [];
    if (target.misconception) candidates = templatesTesting(target.misconception, pool).filter((c) => eligible(c.template));
    if (!candidates.length && target.objective) {
      candidates = pool
        .filter((t) => (t.objective === target.objective || t.secondary.includes(target.objective!)) && eligible(t))
        .map((template) => ({ template, level: closestLevel(template, plan.difficulty === "mixed" ? 2 : plan.difficulty) }));
    }
    // A conceptual retest must differ in kind, not just in numbers: prefer another concept family and item format.
    const different = (t: AnyTemplate) =>
      (isChoiceTemplate(t) && t.conceptFamily && avoidFamilies.has(t.conceptFamily) ? 1 : 0) + (avoidFormats.has(formatOf(t)) ? 1 : 0);
    const ordered = rng
      .shuffle(candidates)
      .sort((a, b) => different(a.template) - different(b.template) || (use.families.get(a.template.family) ?? 0) - (use.families.get(b.template.family) ?? 0));
    for (const candidate of ordered) {
      const prefer = target.misconception ? new Set([target.misconception, ...(plan.prefer ?? [])]) : plan.prefer;
      if (take(candidate.template, candidate.level, { prefer, mustInclude: target.misconception })) break;
    }
  }

  // ------------------------------------------------ formula-integration practice: fill by integration bucket
  if (plan.integrationMix && questions.length < plan.count) {
    const counts = bucketCounts(plan.count - questions.length, plan.integrationMix);
    const topicUse = new Map<string, number>();
    const all = ALL_TEMPLATES.filter((t) => !isChoiceTemplate(t) || t.practice === "calculation").flatMap((t) => t.levels.map((level) => ({ template: t, level })));
    const poolFor = (levels: IntegrationLevel[]) =>
      rng
        .shuffle(all)
        .filter(({ template, level }) => !use.templates.has(template.id) && [...integrationLevelsOf(template, level)].some((x) => levels.includes(x)))
        .sort((a, b) => (topicUse.get(a.template.topic) ?? 0) - (topicUse.get(b.template.topic) ?? 0) || (use.families.get(a.template.family) ?? 0) - (use.families.get(b.template.family) ?? 0));
    // Scarcest bucket first, so templates that are the only source of a level are not used up elsewhere.
    const buckets = (Object.keys(counts) as IntegrationBucket[]).sort((a, b) => poolFor(BUCKET_LEVELS[a]).length - poolFor(BUCKET_LEVELS[b]).length);
    for (const bucket of buckets) {
      for (let k = 0; k < counts[bucket]; k += 1) {
        // If a bucket has run dry, the nearest integration level stands in for it (integration level, not difficulty).
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
            const result = buildAny(template, level, `${plan.seed}|int|${questions.length}|${attempt}`, { prefer: plan.prefer });
            rejected.push(...result.rejected);
            if (result.instance?.integration !== undefined && levels.includes(result.instance.integration)) {
              record(template, result.instance);
              topicUse.set(template.topic, (topicUse.get(template.topic) ?? 0) + 1);
              placed = true;
            }
          }
          if (placed) break;
        }
      }
    }
  }

  // ------------------------------------------------ Concept Practice
  if (plan.mode === "CONCEPT" && questions.length < plan.count) {
    const focus = plan.conceptFocus ?? "mixed";
    const pool = CONCEPT_TEMPLATES.filter((t) => matchesFocus(t, focus) && (!plan.topic || t.topic === plan.topic));
    const remaining = plan.count - questions.length;
    const topics = plan.topic ? ({ [plan.topic]: remaining } as Partial<Record<TopicId, number>>) : distributionFor(remaining, rng.shuffle(TOPIC_ORDER));
    const slots: Array<{ topic: TopicId; level: Difficulty }> = [];
    for (const topic of TOPIC_ORDER) for (let k = 0; k < (topics[topic] ?? 0); k += 1) slots.push({ topic, level: levelFor(plan.difficulty, rng, MIXED_CONCEPT_LEVELS) });

    const fillConcept = (slot: { topic: TopicId; level: Difficulty }, anyTopic: boolean, repeat: boolean): boolean => {
      const candidates = pool
        .filter((t) => (anyTopic || t.topic === slot.topic) && t.levels.includes(slot.level) && (repeat || !use.templates.has(t.id)))
        .map((t) => ({ t, s: score(t, slot.level, plan, use, rng) - (anyTopic && t.topic !== slot.topic ? 0.5 : 0) }))
        .sort((a, b) => b.s - a.s);
      for (const { t } of candidates) if (take(t, slot.level, { prefer: plan.prefer, allowRepeat: repeat })) return true;
      return false;
    };
    for (const slot of slots) {
      // Same topic first; then any topic; then — only when the bank has nothing new at this level — another
      // presentation (variant) of a template already used, never the same wording twice.
      if (fillConcept(slot, false, false) || fillConcept(slot, true, false) || fillConcept(slot, false, true) || fillConcept(slot, true, true)) continue;
      shortfallReason = `The concept bank has too few distinct ${plan.difficulty === "mixed" ? "" : `level-${plan.difficulty} `}questions for this focus${plan.topic ? " and topic" : ""}.`;
    }
  }

  // ------------------------------------------------ fill the rest by topic weighting and style mix
  const remaining = plan.count - questions.length;
  if (remaining > 0 && plan.mode !== "CONCEPT") {
    const strict = plan.difficulty !== "mixed";
    const mix = plan.styleMix === undefined ? STYLE_MIX[plan.mode] ?? null : plan.styleMix;
    const order = rng.shuffle(TOPIC_ORDER);
    const counts = distributionFor(remaining, order);
    const typedTotal = mix ? nonNumericCount(remaining, mix) : 0;
    const typedByTopic = proportional(typedTotal, counts, order);
    const typedPool = ALL_TEMPLATES.filter(isChoiceTemplate);
    const numericPool = ALL_TEMPLATES.filter(isNumericTemplate);

    const fillOne = (topic: TopicId | null, wanted: Difficulty, typed: boolean): boolean => {
      const base = typed ? typedPool : numericPool;
      const candidates = base
        .filter((t) => (topic === null || t.topic === topic) && !use.templates.has(t.id) && t.levels.includes(wanted))
        .map((t) => ({ t, s: score(t, wanted, plan, use, rng) }))
        .sort((a, b) => b.s - a.s);
      for (const { t } of candidates) if (take(t, wanted, { prefer: plan.prefer })) return true;
      return false;
    };
    const fillAnyLevel = (topic: TopicId, wanted: Difficulty): boolean => {
      const candidates = numericPool
        .filter((t) => t.topic === topic && !use.templates.has(t.id))
        .map((t) => ({ t, s: score(t, wanted, plan, use, rng) }))
        .sort((a, b) => b.s - a.s);
      for (const { t } of candidates) if (take(t, closestLevel(t, wanted), { prefer: plan.prefer })) return true;
      return false;
    };

    for (const topic of order) {
      for (let k = 0; k < counts[topic]; k += 1) {
        const wanted = levelFor(plan.difficulty, rng);
        const typed = k < typedByTopic[topic];
        if (fillOne(topic, wanted, typed) || fillOne(topic, wanted, !typed)) continue;
        if (!strict && fillAnyLevel(topic, wanted)) continue;
        // Strict: keep the level, borrow a template from another topic before giving up.
        if (fillOne(null, wanted, typed) || fillOne(null, wanted, !typed)) continue;
        shortfallReason = `The bank has too few distinct level-${wanted} questions for a ${plan.count}-question session.`;
      }
    }
  }

  const shortfall = questions.length < plan.count ? { requested: plan.count, built: questions.length, reason: shortfallReason ?? "Not enough validated questions could be generated." } : null;
  return { questions: rng.shuffle(questions), rejected, flagged, shortfall };
}

/** Re-exported for callers that build a single typed question outside a session. */
export { buildChoiceQuestion };
