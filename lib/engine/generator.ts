import {
  DEFAULT_DIFFICULTIES,
  DOMAIN_ORDER,
  EXAM_TOTAL_QUESTIONS,
  MIN_ADVANCED_PER_DOMAIN,
  OPTION_KEYS,
  QUESTIONS_PER_DOMAIN,
  type DifficultyLevel,
  type OptionKey,
} from "../exam-config";
import type { ExamQuestionData, RenderedOption } from "../types/exam";
import { money, num } from "./format";
import { createRng, type Rng } from "./random";
import { QUESTION_TEMPLATES, TEMPLATES_BY_DOMAIN, getTemplateById } from "./templates";
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
}

/** Key under which each question stores the seed that produced its parameters. */
export const SEED_VARIABLE_KEY = "_seed";

/**
 * Renders a numeric answer into option text.
 * Currency is escaped (`\$`) so the markup tokenizer never reads a price as a
 * math delimiter — see `lib/math/markup.ts`.
 */
export function formatAnswer(value: number, format: AnswerFormat): string {
  if (!Number.isFinite(value)) return "Not determinable";
  switch (format) {
    case "CURRENCY":
      return money(value, 2);
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

      let value = item.value;
      let text = formatAnswer(value, generated.format);

      // Nudge a distractor that collides with an option already on the paper.
      // Five visibly distinct choices are required on every question.
      let attempt = 0;
      while ((usedTexts.has(text) || value === generated.correctValue) && attempt < 12) {
        attempt += 1;
        const factor = attempt % 2 === 0 ? 1 + 0.035 * attempt : 1 - 0.035 * attempt;
        value = item.value * factor;
        text = formatAnswer(value, generated.format);
      }
      if (usedTexts.has(text) || !isPlausibleDistractor(value, generated.correctValue)) continue;

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
      variables: { ...generated.variables, [SEED_VARIABLE_KEY]: seed },
      isCorrect: null,
      solutionSteps: generated.solutionSteps,
    };
  }

  /**
   * Builds a complete mock exam: 30 questions, six from each of the five
   * syllabus domains, with no template used twice in the same sitting.
   */
  public generateFullExam(options: GenerateExamOptions): ExamQuestionData[] {
    const {
      sessionId,
      totalQuestions = EXAM_TOTAL_QUESTIONS,
      seed = `${sessionId}-${Date.now()}`,
      difficulties = DEFAULT_DIFFICULTIES,
    } = options;

    const rng = createRng(seed);
    const perDomain = Math.floor(totalQuestions / DOMAIN_ORDER.length) || QUESTIONS_PER_DOMAIN;
    const selected: QuestionTemplateDefinition[] = [];

    for (const domain of DOMAIN_ORDER) {
      const pool = (TEMPLATES_BY_DOMAIN[domain] ?? []).filter((template) =>
        difficulties.includes(template.difficulty)
      );
      if (pool.length === 0) continue;

      // Seat the advanced quota first, then fill the remainder from whatever is
      // left, so every domain contributes multi-step synthesis questions rather
      // than only the intermediate items that happen to shuffle to the front.
      const advanced = rng.shuffle(pool.filter((template) => template.difficulty >= 3));
      const quota = Math.min(MIN_ADVANCED_PER_DOMAIN, advanced.length, perDomain);
      const chosen = advanced.slice(0, quota);

      const remainder = rng.shuffle(pool.filter((template) => !chosen.includes(template)));
      let cursor = 0;
      while (chosen.length < perDomain) {
        // The blueprint invariant guarantees enough distinct templates; the
        // modulo only guards a caller asking for more than the blueprint size.
        chosen.push(remainder[cursor % remainder.length]);
        cursor += 1;
      }

      selected.push(...chosen.slice(0, perDomain));
    }

    // Top up if totalQuestions is not divisible by the number of domains.
    while (selected.length < totalQuestions) {
      selected.push(rng.choice(this.templates));
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
