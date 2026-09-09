import {
  DEFAULT_DIFFICULTIES,
  DOMAIN_QUESTION_RANGES,
  DOMAIN_ORDER,
  EXAM_TOTAL_QUESTIONS,
  MAX_CONCEPTUAL_QUESTIONS,
  isCurrentSyllabusTemplate,
  OPTION_KEYS,
  type DifficultyLevel,
  type OptionKey,
} from "../exam-config";
import type { ExamQuestionData, RenderedOption, TopicDomain } from "../types/exam";
import { int, money, num } from "./format";
import { createRng, type Rng } from "./random";
import {
  QUESTION_TEMPLATES,
  TEMPLATES_BY_DOMAIN,
  getTemplateById,
  isConceptualTemplate,
} from "./templates";
import type { AnswerFormat, QuestionTemplateDefinition } from "./templates/types";

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
   * Difficulty levels eligible for this sitting. Defaults to levels 2-4;
   * level 1 is drawn only when a caller asks for it explicitly.
   */
  difficulties?: readonly DifficultyLevel[];
  /** Domains included in a custom practice set. Omitted for a full exam. */
  domains?: readonly TopicDomain[];
  /** Allows retired syllabus material such as swaps in an explicit practice set. */
  includeLegacy?: boolean;
  /** Restricts generation to prior missed templates for spaced review. */
  templateIds?: readonly string[];
  /** Uses the published syllabus ranges instead of an even custom split. */
  useSyllabusWeights?: boolean;
}

/** Key under which each question stores the seed that produced its parameters. */
export const SEED_VARIABLE_KEY = "_seed";

/**
 * Renders a numeric answer into option text, using the precision the SOA
 * sample questions use: amounts of 1,000 or more are quoted as whole numbers,
 * smaller amounts to the cent, rates as percentages to two places.
 */
export function formatAnswer(value: number, format: AnswerFormat): string {
  if (!Number.isFinite(value)) return "Not determinable";
  switch (format) {
    case "CURRENCY":
      return Math.abs(value) >= 1000 ? int(value) : money(value, 2);
    case "PERCENT":
      return `${value.toFixed(2)}%`;
    case "BASIS_POINTS":
      return `${num(value, 1)} bps`;
    case "YEARS":
      return `${num(value, 2)} years`;
    case "DECIMAL_4":
      return value.toFixed(4);
    case "DECIMAL_2":
    default:
      return value.toFixed(2);
  }
}

/**
 * Rejects a distractor that no examiner would print: a non-finite value, a
 * negative amount where the quantity must be positive (an outstanding loan
 * balance of -\$10,207 gives the answer away), or a value orders of magnitude
 * away from the correct one.
 */
function isPlausibleDistractor(value: number, correctValue: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (correctValue > 0 && value <= 0) return false;
  const reference = Math.abs(correctValue) || 1;
  const ratio = Math.abs(value) / reference;
  return ratio >= 0.02 && ratio <= 50;
}

interface CandidateOption {
  text: string;
  value: number;
  isCorrect: boolean;
  distractorType: RenderedOption["distractorType"];
  explanation: string;
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
      const renderedOptions: RenderedOption[] = rng.shuffle(generated.choices).map((choice, index) => ({
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
        renderedQuestion: generated.questionText,
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

    const candidates: CandidateOption[] = [
      {
        text: formatAnswer(generated.correctValue, generated.format),
        value: generated.correctValue,
        isCorrect: true,
        distractorType: "CORRECT",
        explanation: "Derived directly from the governing equation of value.",
      },
    ];

    const usedTexts = new Set<string>([candidates[0].text]);

    for (const item of generated.distractors) {
      if (candidates.length >= OPTION_KEYS.length) break;
      if (!isPlausibleDistractor(item.value, generated.correctValue)) continue;

      const value = item.value;
      const text = formatAnswer(value, generated.format);

      // A distractor is dropped rather than nudged when it collides. Some
      // parameter draws are degenerate — a bond priced at par, a symmetric
      // immunizing straddle, a growth rate exactly half the interest rate —
      // and there the modelled mistake genuinely produces the right answer.
      // Shifting the number would leave an option whose value no longer
      // matches the misconception its explanation describes, so the slot is
      // surrendered to the generic backstop below instead.
      if (Math.abs(value - generated.correctValue) < 1e-9) continue;
      if (usedTexts.has(text)) continue;

      usedTexts.add(text);
      candidates.push({
        text,
        value,
        isCorrect: false,
        distractorType: item.type,
        explanation: item.explanation,
      });
    }

    // Backstop so a template that yields degenerate distractors still produces
    // a complete five-option question.
    let spread = 1;
    while (candidates.length < OPTION_KEYS.length) {
      const factor = spread % 2 === 0 ? 1 + 0.06 * spread : 1 - 0.06 * spread;
      const value = generated.correctValue * factor;
      const text = formatAnswer(value, generated.format);
      spread += 1;
      if (usedTexts.has(text) || !Number.isFinite(value)) continue;
      usedTexts.add(text);
      candidates.push({
        text,
        value,
        isCorrect: false,
        distractorType: "CALCULATION_DISTRACTOR",
        explanation:
          "Plausible magnitude produced by an arithmetic slip in the final evaluation step.",
      });
    }

    // SOA answer choices are listed in ascending numeric order rather than
    // shuffled, which also removes any positional bias in the correct answer.
    const ordered = [...candidates].sort((a, b) => a.value - b.value);

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
      renderedQuestion: generated.questionText,
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
      difficulties = DEFAULT_DIFFICULTIES,
      domains = DOMAIN_ORDER,
      includeLegacy = false,
      templateIds,
      useSyllabusWeights = totalQuestions === EXAM_TOTAL_QUESTIONS && !templateIds,
    } = options;

    const rng = createRng(seed);
    const selected: QuestionTemplateDefinition[] = [];

    if (templateIds?.length) {
      const requested = rng.shuffle(
        templateIds
          .map((id) => getTemplateById(id))
          .filter((template): template is QuestionTemplateDefinition => Boolean(template))
          .filter((template) => includeLegacy || isCurrentSyllabusTemplate(template.topics))
          .filter((template) => difficulties.includes(template.difficulty))
      );
      if (requested.length === 0) {
        throw new Error("No eligible mistake-review templates were supplied.");
      }
      while (selected.length < totalQuestions) {
        selected.push(requested[selected.length % requested.length]);
      }
    } else {
      const activeDomains = domains.filter((domain) => DOMAIN_ORDER.includes(domain));
      if (activeDomains.length === 0) throw new Error("At least one syllabus domain is required.");

      const counts = new Map<TopicDomain, number>();
      if (useSyllabusWeights && totalQuestions === EXAM_TOTAL_QUESTIONS && activeDomains.length === DOMAIN_ORDER.length) {
        for (const domain of DOMAIN_ORDER) counts.set(domain, DOMAIN_QUESTION_RANGES[domain].min);
        let remaining = totalQuestions - Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
        while (remaining > 0) {
          const eligible = activeDomains.filter(
            (domain) => (counts.get(domain) ?? 0) < DOMAIN_QUESTION_RANGES[domain].max
          );
          const domain = rng.choice(eligible);
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
          remaining -= 1;
        }
      } else {
        const shuffledDomains = rng.shuffle(activeDomains);
        for (const domain of activeDomains) counts.set(domain, Math.floor(totalQuestions / activeDomains.length));
        for (let index = 0; index < totalQuestions % activeDomains.length; index += 1) {
          const domain = shuffledDomains[index];
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }
      }

      // Spread the small qualitative allowance across domains with enough
      // questions to carry one; everything else is drawn from the numerical
      // pool, so the paper stays overwhelmingly computational.
      const conceptualQuota = new Map<TopicDomain, number>();
      let conceptualBudget = Math.min(MAX_CONCEPTUAL_QUESTIONS, totalQuestions);
      for (const domain of rng.shuffle(activeDomains)) {
        if (conceptualBudget <= 0) break;
        if ((counts.get(domain) ?? 0) < 3) continue;
        conceptualQuota.set(domain, 1);
        conceptualBudget -= 1;
      }

      for (const domain of activeDomains) {
        const target = counts.get(domain) ?? 0;
        const pool = (TEMPLATES_BY_DOMAIN[domain] ?? [])
          .filter((template) => difficulties.includes(template.difficulty))
          .filter((template) => includeLegacy || isCurrentSyllabusTemplate(template.topics));
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

        if (useSyllabusWeights) {
          const advanced = rng.shuffle(fillPool.filter((template) => template.difficulty >= 3));
          if (advanced.length > 0 && target >= 4) chosen.push(advanced[0]);
          if (advanced.length > 1 && target >= 8) chosen.push(advanced[1]);
        }

        const remainder = rng.shuffle(fillPool.filter((template) => !chosen.includes(template)));
        let cursor = 0;
        while (chosen.length < target) {
          chosen.push(remainder[cursor % remainder.length] ?? rng.choice(fillPool));
          cursor += 1;
        }
        selected.push(...chosen.slice(0, target));
      }
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
