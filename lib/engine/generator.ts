import {
  EXAM_ADVANCED_COUNTS,
  EXAM_CONCEPTUAL_QUESTIONS,
  EXAM_DIFFICULTIES,
  DOMAIN_QUESTION_RANGES,
  PREFERRED_DOMAIN_COUNTS,
  DOMAIN_ORDER,
  EXAM_TOTAL_QUESTIONS,
  MAX_CONCEPTUAL_QUESTIONS,
  OPTION_KEYS,
  type DifficultyLevel,
  type OptionKey,
} from "../exam-config";
import type { ExamQuestionData, RenderedOption, TopicDomain } from "../types/exam";
import { soaNumber } from "./format";
import { createRng, type Rng } from "./random";
import { sampleExamQuestion } from "./style";
import {
  QUESTION_TEMPLATES,
  TEMPLATES_BY_DOMAIN,
  getTemplateById,
  isConceptualTemplate,
} from "./templates";
import { matchesPracticeDomains } from "./templates/classification";
import type { AnswerFormat, QuestionTemplateDefinition } from "./templates/types";

/**
 * The derivation shape a template drills.
 *
 * Falls back to the template id, which is unique by construction, so a template
 * only declares a fingerprint when several of its ids drill one manoeuvre.
 */
function fingerprintOf(template: QuestionTemplateDefinition): string {
  return template.methodFingerprint ?? template.id;
}

/**
 * Selects `count` templates from `pool`, never taking two that drill the same
 * method, so a sitting cannot be built from variations on one derivation.
 *
 * The pool is walked in the supplied (already shuffled) order: the first
 * template for a method is kept and later ones are skipped. If the pool is too
 * narrow to reach `count` distinct methods the shortfall is filled from the
 * unused templates, because a full blueprint matters more than perfect variety —
 * `assertBlueprintCoverage` and the engine test suite are what guarantee the
 * pools are wide enough for that case never to arise in a standard mock.
 */
function pickDistinctMethods(
  pool: QuestionTemplateDefinition[],
  count: number
): QuestionTemplateDefinition[] {
  const chosen: QuestionTemplateDefinition[] = [];
  const seen = new Set<string>();
  for (const template of pool) {
    if (chosen.length >= count) break;
    const fingerprint = fingerprintOf(template);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    chosen.push(template);
  }
  if (chosen.length < count) {
    const used = new Set(chosen);
    for (const template of pool) {
      if (chosen.length >= count) break;
      if (!used.has(template)) chosen.push(template);
    }
  }
  return chosen;
}

export interface GenerateExamOptions {
  sessionId: string;
  totalQuestions?: number;
  /**
   * Root seed for the exam. Supplying one makes the whole exam reproducible;
   * omitting it draws a fresh random seed, which is returned on each question
   * so the exam can be regenerated later from persisted state.
   */
  seed?: string;
  /**
   * Difficulty levels eligible for this sitting. A standard mock exam defaults
   * to levels 3-4, whose numerical items require three or more linked stages.
   */
  difficulties?: readonly DifficultyLevel[];
  /** Domains included in a custom practice set. Omitted for a full exam. */
  domains?: readonly TopicDomain[];
  /**
   * Restricts generation to prior missed templates for spaced review. Ids that
   * no longer exist (a template retired from the bank) are skipped; if none
   * remain, the set is drawn from `domains` instead, so a review built from an
   * old history still produces questions on the same topics.
   */
  templateIds?: readonly string[];
  /** Uses the published syllabus ranges instead of an even custom split. */
  useSyllabusWeights?: boolean;
}

/** Key under which each question stores the seed that produced its parameters. */
export const SEED_VARIABLE_KEY = "_seed";

/** Decimal places a format prints: `AMOUNT_2` -> 2. */
function decimalsOf(format: AnswerFormat): number {
  return Number(format.split("_")[1] ?? 0);
}

/**
 * Renders a numeric answer into option text the way the SOA sample set prints
 * it: bare numbers with commas only from 10,000 up (`4695`, `20,689`),
 * percentages to the stated places (`9.46%`), negatives led by an en dash.
 */
export function formatAnswer(value: number, format: AnswerFormat): string {
  if (!Number.isFinite(value)) return "Not determinable";
  const text = soaNumber(value, decimalsOf(format));
  return format.startsWith("PERCENT") ? `${text}%` : text;
}

/**
 * Rejects a distractor that no examiner would print: a non-finite value, a
 * negative amount where the quantity must be positive (an outstanding loan
 * balance of -10,207 gives the answer away), or a value so far from the correct
 * one (a fifth of it, or five times it) that it could be ruled out on sight.
 */
function isPlausibleDistractor(value: number, correctValue: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (correctValue > 0 && value <= 0) return false;
  const reference = Math.abs(correctValue) || 1;
  const ratio = Math.abs(value) / reference;
  return ratio >= 0.2 && ratio <= 5;
}

interface CandidateOption {
  text: string;
  value: number;
  isCorrect: boolean;
  distractorType: RenderedOption["distractorType"];
  explanation: string;
}

const NICE_MULTIPLIERS: readonly number[] = [1, 2, 2.5, 5];

/**
 * Spacing for an evenly spaced option ladder: a round figure roughly 2%-8% of
 * the answer, the spacing the sample set uses (4.33%, 4.43%, 4.53% ... or
 * 4695, 5070, 5445 ...), and never finer than two printed units, so
 * neighbouring options stay distinct after rounding.
 */
function ladderStepFor(correctValue: number, decimals: number, rng: Rng): number {
  const unit = Math.pow(10, -decimals);
  const target =
    Math.max(Math.abs(correctValue), unit) * rng.choice([0.02, 0.03, 0.04, 0.05, 0.06, 0.08]);
  const exponent = Math.floor(Math.log10(target));
  let best = unit;
  let bestGap = Infinity;
  for (const power of [exponent - 1, exponent, exponent + 1]) {
    for (const multiplier of NICE_MULTIPLIERS) {
      const candidate = multiplier * Math.pow(10, power);
      const gap = Math.abs(Math.log(candidate / target));
      if (gap < bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
  }
  return Math.max(Math.round(best / unit) * unit, 2 * unit);
}

function rungExplanation(steps: number): string {
  const count = Math.abs(steps);
  return (
    `One of the evenly spaced options, ${count} step${count === 1 ? "" : "s"} ` +
    `${steps < 0 ? "below" : "above"} the correct value. It does not model one ` +
    "specific mistake, so rework the solution stage by stage to find where the " +
    "calculation drifted."
  );
}

export class QuestionGenerator {
  private readonly templates: QuestionTemplateDefinition[];

  constructor(templates: QuestionTemplateDefinition[] = QUESTION_TEMPLATES) {
    this.templates = templates;
  }

  /**
   * Builds one concrete question from a template and a seed.
   *
   * The seed is stored on the question, so calling this again with the same
   * template and seed reproduces byte-identical text, options and solution —
   * which is how a persisted question recovers its worked solution.
   */
  public generateQuestion(
    template: QuestionTemplateDefinition,
    options: { examSessionId: string; questionNumber: number; seed: string }
  ): ExamQuestionData {
    const { examSessionId, questionNumber, seed } = options;
    const rng: Rng = createRng(seed);
    const generated = template.generate(rng);

    if (generated.kind === "CHOICE") {
      if (generated.choices.length !== OPTION_KEYS.length) {
        throw new Error(`${template.id} authored ${generated.choices.length} choices; five are required.`);
      }
      // Roman-numeral schemes, paired amounts and dates are printed in the
      // order the template authored them; statement lists are shuffled.
      const listed = generated.fixedOrder ? generated.choices : rng.shuffle(generated.choices);
      const renderedOptions: RenderedOption[] = listed.map((choice, index) => ({
        key: OPTION_KEYS[index] as OptionKey,
        text: choice.text,
        isCorrect: choice.isCorrect,
        distractorType: choice.isCorrect ? "CORRECT" : (choice.type ?? "CALCULATION_DISTRACTOR"),
        distractorExplanation: choice.explanation,
      }));

      return {
        id: `q_${examSessionId}_${questionNumber}`,
        examSessionId,
        templateId: template.id,
        templateTitle: template.title,
        objective: template.objective,
        difficulty: template.difficulty,
        topics: template.topics,
        steps: template.steps,
        domain: template.domain,
        renderedQuestion: sampleExamQuestion(generated.questionText),
        renderedOptions,
        selectedOption: null,
        isFlagged: false,
        confidence: null,
        timeSpentSeconds: 0,
        calculatorUsed: false,
        variables: { ...generated.variables, [SEED_VARIABLE_KEY]: seed },
        isCorrect: null,
        solutionSteps: generated.solutionSteps,
      };
    }

    const correctValue = generated.correctValue;
    const decimals = decimalsOf(generated.format);
    const unit = Math.pow(10, -decimals);
    const correct: CandidateOption = {
      text: formatAnswer(correctValue, generated.format),
      value: correctValue,
      isCorrect: true,
      distractorType: "CORRECT",
      explanation: "Derived directly from the governing equation of value.",
    };
    const usedTexts = new Set<string>([correct.text]);

    // Where the correct answer should land, 1-indexed.
    //
    // SOA options are printed in ascending numeric order, so the position of
    // the key is decided by how many options fall below the correct value.
    // Left to chance that clusters badly: a template whose distractors are
    // symmetric (two above, two below) puts the answer in the same slot on
    // every single draw, and a whole practice set can come back all-C. Drawing
    // the target position first and then choosing options to realise it
    // spreads the key evenly across A-E.
    const targetPosition = rng.int(1, OPTION_KEYS.length);
    const wantedBelow = targetPosition - 1;
    const wantedAbove = OPTION_KEYS.length - 1 - wantedBelow;

    // The ladder is anchored on the printed key, so every rung prints as a
    // round step away from it: 4.33%, 4.43%, [4.53%], 4.63%, 4.73%.
    const anchor = Number(correctValue.toFixed(decimals));
    let step = generated.ladderStep ?? ladderStepFor(correctValue, decimals, rng);
    // A positive quantity is never offered as zero or less, so a ladder that
    // would run below zero is tightened rather than printed.
    if (correctValue > 0 && wantedBelow > 0 && anchor - wantedBelow * step <= 0) {
      step = Math.max(unit, Math.floor((anchor - unit) / wantedBelow / unit) * unit);
    }
    const rung = (steps: number): number => Number((anchor + steps * step).toFixed(decimals + 6));

    const plausible = generated.distractors.filter((item) => {
      if (!isPlausibleDistractor(item.value, correctValue)) return false;
      if (Math.abs(item.value - correctValue) < 1e-9) return false;
      return formatAnswer(item.value, generated.format) !== correct.text;
    });
    const style = generated.optionStyle ?? "MIXED";
    const useLadder =
      style === "LADDER" ||
      (style === "MIXED" && (plausible.length < 2 || rng.next() < 0.4));

    const below: CandidateOption[] = [];
    const above: CandidateOption[] = [];

    // Options closer than this could be confused by a candidate whose own
    // rounding differs slightly from the key's: 5769 beside a correct 5770 is
    // not a fair choice. A count of payments still admits neighbours one apart.
    const minimumGap = Math.max(unit, 0.004 * Math.abs(correctValue));
    const crowds = (value: number): boolean =>
      [correct, ...below, ...above].some((option) => Math.abs(option.value - value) < minimumGap - 1e-12);

    const place = (
      value: number,
      distractorType: CandidateOption["distractorType"],
      explanation: string
    ): boolean => {
      if (!Number.isFinite(value)) return false;
      if (!isPlausibleDistractor(value, correctValue)) return false;
      if (Math.abs(value - correctValue) < 1e-9) return false;

      const text = formatAnswer(value, generated.format);
      if (usedTexts.has(text) || crowds(value)) return false;

      // The side is decided by comparing values, never by the sign of an
      // offset: for a negative key (a price change, a net present value) a
      // negative offset moves the option the other way.
      const isBelow = value < correctValue;
      const side = isBelow ? below : above;
      if (side.length >= (isBelow ? wantedBelow : wantedAbove)) return false;

      usedTexts.add(text);
      side.push({ text, value, isCorrect: false, distractorType, explanation });
      return true;
    };

    if (!useLadder) {
      // A modelled distractor is dropped rather than nudged when it collides.
      // Some parameter draws are degenerate — a bond priced at par, a growth
      // rate equal to the interest rate — and there the modelled mistake
      // genuinely produces the right answer. Shifting the number would leave an
      // option whose value no longer matches the misconception its explanation
      // describes, so the slot is surrendered to a ladder rung instead.
      for (const item of plausible) {
        if (below.length >= wantedBelow && above.length >= wantedAbove) break;
        place(item.value, item.type, item.explanation);
      }
    }

    // Ladder rungs fill every slot on a ladder item and any slot a modelled
    // item could not fill, nearest rungs first.
    for (let distance = 1; distance <= 12; distance += 1) {
      if (below.length >= wantedBelow && above.length >= wantedAbove) break;
      place(rung(-distance), "CALCULATION_DISTRACTOR", rungExplanation(-distance));
      place(rung(distance), "CALCULATION_DISTRACTOR", rungExplanation(distance));
    }

    // Last-resort backstop for a draw whose rungs on one side are all
    // implausible (a tiny positive answer, say). Position balance yields to
    // having five usable options.
    for (let distance = 1; below.length + above.length < OPTION_KEYS.length - 1; distance += 1) {
      if (distance > 400) break;
      for (const candidate of [rung(distance), rung(-distance)]) {
        if (below.length + above.length >= OPTION_KEYS.length - 1) break;
        if (!Number.isFinite(candidate) || !isPlausibleDistractor(candidate, correctValue)) continue;
        const text = formatAnswer(candidate, generated.format);
        if (usedTexts.has(text) || crowds(candidate)) continue;
        usedTexts.add(text);
        (candidate < correctValue ? below : above).push({
          text,
          value: candidate,
          isCorrect: false,
          distractorType: "CALCULATION_DISTRACTOR",
          explanation: rungExplanation(Math.round((candidate - anchor) / step)),
        });
      }
    }

    // Every option below the key sorts before it and every option above sorts
    // after, so this reproduces the ascending listing the SOA uses while
    // placing the correct answer at the drawn position.
    const ordered = [...below, correct, ...above].sort((a, b) => a.value - b.value);

    const renderedOptions: RenderedOption[] = ordered.map((option, index) => ({
      key: OPTION_KEYS[index] as OptionKey,
      text: option.text,
      isCorrect: option.isCorrect,
      distractorType: option.distractorType,
      distractorExplanation: option.explanation,
    }));

    return {
      id: `q_${examSessionId}_${questionNumber}`,
      examSessionId,
      templateId: template.id,
      templateTitle: template.title,
      objective: template.objective,
      difficulty: template.difficulty,
      topics: template.topics,
      steps: template.steps,
      domain: template.domain,
      renderedQuestion: sampleExamQuestion(generated.questionText),
      renderedOptions,
      selectedOption: null,
      isFlagged: false,
      confidence: null,
      timeSpentSeconds: 0,
      calculatorUsed: false,
      variables: { ...generated.variables, [SEED_VARIABLE_KEY]: seed },
      isCorrect: null,
      solutionSteps: generated.solutionSteps,
    };
  }

  /**
   * Builds a complete mock exam using the current published syllabus weights,
   * or a balanced custom practice set when domains/template ids are supplied.
   */
  public generateFullExam(options: GenerateExamOptions): ExamQuestionData[] {
    const {
      sessionId,
      totalQuestions = EXAM_TOTAL_QUESTIONS,
      seed = `${sessionId}-${Date.now()}`,
      difficulties = EXAM_DIFFICULTIES,
      domains = DOMAIN_ORDER,
      templateIds,
      // Syllabus weighting describes a whole sitting, so it only applies when
      // every domain is in play; a targeted subject set is never "weighted".
      useSyllabusWeights = totalQuestions === EXAM_TOTAL_QUESTIONS &&
        !templateIds &&
        (options.domains?.length ?? DOMAIN_ORDER.length) === DOMAIN_ORDER.length,
    } = options;

    const rng = createRng(seed);
    const selected: QuestionTemplateDefinition[] = [];

    const requested = rng.shuffle(
      (templateIds ?? [])
        .map((id) => getTemplateById(id))
        .filter((template): template is QuestionTemplateDefinition => Boolean(template))
        .filter((template) => difficulties.includes(template.difficulty))
    );

    if (requested.length > 0) {
      while (selected.length < totalQuestions) {
        selected.push(requested[selected.length % requested.length]);
      }
    } else {
      const activeDomains = domains.filter((domain) => DOMAIN_ORDER.includes(domain));
      if (activeDomains.length === 0) throw new Error("At least one syllabus domain is required.");

      const counts = new Map<TopicDomain, number>();
      if (useSyllabusWeights && totalQuestions === EXAM_TOTAL_QUESTIONS && activeDomains.length === DOMAIN_ORDER.length) {
        // Aim at the published blueprint rather than at the low end of the
        // ranges. The preferred split places each topic near its band midpoint,
        // which is what makes a generated form look like a real sitting; the
        // ranges below still bound any adjustment made to reach the exact
        // question count.
        for (const domain of DOMAIN_ORDER) {
          counts.set(domain, PREFERRED_DOMAIN_COUNTS[domain] ?? DOMAIN_QUESTION_RANGES[domain].min);
        }
        let remaining = totalQuestions - Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
        while (remaining > 0) {
          const eligible = activeDomains.filter(
            (domain) => (counts.get(domain) ?? 0) < DOMAIN_QUESTION_RANGES[domain].max
          );
          const domain = rng.choice(eligible);
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
          remaining -= 1;
        }
        // If the preferred split were to overrun a band (it does not for the
        // published weights, but the constants are editable), trim back to the
        // range maximum before giving the surplus away.
        for (const domain of DOMAIN_ORDER) {
          const cap = DOMAIN_QUESTION_RANGES[domain].max;
          const held = counts.get(domain) ?? 0;
          if (held <= cap) continue;
          const give = activeDomains.filter(
            (candidate) => candidate !== domain && (counts.get(candidate) ?? 0) < DOMAIN_QUESTION_RANGES[candidate].max
          );
          let surplus = held - cap;
          counts.set(domain, cap);
          while (surplus > 0 && give.length > 0) {
            const recipient = rng.choice(give);
            counts.set(recipient, (counts.get(recipient) ?? 0) + 1);
            surplus -= 1;
          }
        }
      } else {
        const shuffledDomains = rng.shuffle(activeDomains);
        for (const domain of activeDomains) counts.set(domain, Math.floor(totalQuestions / activeDomains.length));
        for (let index = 0; index < totalQuestions % activeDomains.length; index += 1) {
          const domain = shuffledDomains[index];
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }
      }

      // A mock carries the couple of qualitative items the sample questions
      // show; custom practice may draw a larger qualitative allowance.
      const conceptualQuota = new Map<TopicDomain, number>();
      let conceptualBudget = useSyllabusWeights
        ? Math.min(EXAM_CONCEPTUAL_QUESTIONS, totalQuestions)
        : Math.min(MAX_CONCEPTUAL_QUESTIONS, totalQuestions);
      for (const domain of rng.shuffle(activeDomains)) {
        if (conceptualBudget <= 0) break;
        if ((counts.get(domain) ?? 0) < 3) continue;
        conceptualQuota.set(domain, 1);
        conceptualBudget -= 1;
      }

      for (const domain of activeDomains) {
        const target = counts.get(domain) ?? 0;
        // A template is eligible only when *every* domain it assesses was
        // selected, so a single-subject set cannot smuggle in an item whose
        // second half tests a subject the candidate did not ask for.
        const pool = (TEMPLATES_BY_DOMAIN[domain] ?? [])
          .filter((template) => matchesPracticeDomains(template, activeDomains))
          .filter((template) => difficulties.includes(template.difficulty));
        if (target > 0 && pool.length === 0) {
          throw new Error(`No eligible templates are available for ${domain}.`);
        }

        const numericPool = pool.filter((template) => !isConceptualTemplate(template));
        const conceptualPool = rng.shuffle(pool.filter((template) => isConceptualTemplate(template)));
        const fillPool = numericPool.length > 0 ? numericPool : pool;

        const chosen: QuestionTemplateDefinition[] = conceptualPool.slice(
          0,
          Math.min(conceptualQuota.get(domain) ?? 0, Math.max(0, target - 1))
        );

        // Every remaining slot is filled so that no two items in this domain
        // drill the same method. Selection goes through the shuffled pool, so
        // which of a method's templates appears still varies from sitting to
        // sitting.
        const remainder = rng.shuffle(
          fillPool.filter((template) => !chosen.includes(template))
        );
        const wanted = target - chosen.length;
        const distinct = pickDistinctMethods(remainder, wanted);
        if (useSyllabusWeights && distinct.length < wanted) {
          throw new Error(
            `Not enough distinct question methods for ${domain}: need ${wanted}, have ${remainder.length}.`
          );
        }
        /** Adds up to `limit` templates, never repeating a derivation shape. */
        const pushUpTo = (candidates: QuestionTemplateDefinition[], limit: number): void => {
          let added = 0;
          for (const template of candidates) {
            if (added >= limit || chosen.length >= target) break;
            if (chosen.includes(template)) continue;
            if (chosen.some((item) => fingerprintOf(item) === fingerprintOf(template))) continue;
            chosen.push(template);
            added += 1;
          }
        };

        // A real sitting mixes direct evaluations with multi-stage synthesis
        // work instead of running at one difficulty throughout. Each domain
        // therefore draws its quota of level 3+ items first and fills the
        // remaining slots from the basic and intermediate pool.
        if (useSyllabusWeights) {
          const advancedTarget = Math.min(
            EXAM_ADVANCED_COUNTS[domain] ?? 0,
            Math.max(0, target - chosen.length)
          );
          const advancedPool = rng.shuffle(fillPool.filter((template) => template.difficulty >= 3));
          pushUpTo(pickDistinctMethods(advancedPool, advancedTarget), advancedTarget);

          const directPool = rng.shuffle(fillPool.filter((template) => template.difficulty < 3));
          const directWanted = target - chosen.length;
          pushUpTo(pickDistinctMethods(directPool, directWanted), directWanted);
        }
        pushUpTo(distinct, target - chosen.length);
        // Backstop: only reachable when a pool offers fewer distinct methods
        // than the blueprint asks for, which assertBlueprintCoverage rejects at
        // module load for a standard mock. Even here the method guard is kept,
        // because a repeated derivation is worse for the candidate than a domain
        // that runs one question short.
        if (chosen.length < target) {
          const usedMethods = new Set(chosen.map((template) => fingerprintOf(template)));
          for (const candidate of remainder) {
            if (chosen.length >= target) break;
            if (chosen.includes(candidate)) continue;
            const fingerprint = fingerprintOf(candidate);
            if (usedMethods.has(fingerprint)) continue;
            usedMethods.add(fingerprint);
            chosen.push(candidate);
          }
        }
        selected.push(...chosen.slice(0, target));
      }

      // A method may span domains, so the guard is applied once across the whole
      // sitting rather than domain by domain. Walking the shuffled selection and
      // dropping later duplicates keeps one item per derivation shape; the
      // freed slots are then refilled from the pools of the same domains, again
      // one per method, so the exam still reaches its full length and its
      // per-domain ranges.
      const kept: QuestionTemplateDefinition[] = [];
      const methods = new Set<string>();
      for (const template of selected) {
        const fingerprint = fingerprintOf(template);
        if (methods.has(fingerprint)) continue;
        methods.add(fingerprint);
        kept.push(template);
      }
      if (kept.length < totalQuestions) {
        const chosenIds = new Set(kept.map((template) => template.id));
        const spare: QuestionTemplateDefinition[] = [];
        for (const domain of rng.shuffle(activeDomains)) {
          const pool = (TEMPLATES_BY_DOMAIN[domain] ?? [])
            .filter((template) => matchesPracticeDomains(template, activeDomains))
            .filter((template) => difficulties.includes(template.difficulty));
          for (const template of rng.shuffle(pool)) {
            if (chosenIds.has(template.id)) continue;
            const fingerprint = fingerprintOf(template);
            if (methods.has(fingerprint)) continue;
            methods.add(fingerprint);
            chosenIds.add(template.id);
            spare.push(template);
            if (kept.length + spare.length >= totalQuestions) break;
          }
          if (kept.length + spare.length >= totalQuestions) break;
        }
        kept.push(...spare);
      }

      // A single narrow subject cannot offer 30 distinct methods, and returning
      // a short set would silently ignore the requested length. The eligible
      // pool is cycled instead: every draw re-randomises its own parameters, so
      // a repeated template still sets a different question with different
      // numbers, a different answer and different distractors.
      if (kept.length < totalQuestions && !useSyllabusWeights) {
        const cycle = rng.shuffle(
          activeDomains.flatMap((domain) =>
            (TEMPLATES_BY_DOMAIN[domain] ?? [])
              .filter((template) => matchesPracticeDomains(template, activeDomains))
              .filter((template) => difficulties.includes(template.difficulty))
              .filter((template) => !isConceptualTemplate(template))
          )
        );
        for (let index = 0; cycle.length > 0 && kept.length < totalQuestions; index += 1) {
          kept.push(cycle[index % cycle.length]);
        }
      }
      selected.length = 0;
      selected.push(...kept);
    }

    return rng
      .shuffle(selected.slice(0, totalQuestions))
      .map((template, index) =>
        this.generateQuestion(template, {
          examSessionId: sessionId,
          questionNumber: index + 1,
          seed: `${seed}:${index + 1}:${template.id}`,
        })
      );
  }

  /**
   * Rebuilds a persisted question from its template id and stored seed.
   * Returns null when the template no longer exists.
   */
  public regenerate(
    templateId: string,
    seed: string,
    context: { examSessionId: string; questionNumber: number }
  ): ExamQuestionData | null {
    const template = getTemplateById(templateId);
    if (!template) return null;
    return this.generateQuestion(template, { ...context, seed });
  }
}

export const examGenerator = new QuestionGenerator();
