import { TopicDomain, RenderedOption, ExamQuestionData } from "../types/exam";
import { QUESTION_TEMPLATES, QuestionTemplateDefinition } from "./templates";

export interface GenerateExamOptions {
  sessionId: string;
  totalQuestions?: number; // default 30
}

function formatValue(value: number, format: string): string {
  if (isNaN(value) || !isFinite(value)) return "0.00";
  switch (format) {
    case "CURRENCY":
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "PERCENT":
      return `${value.toFixed(2)}%`;
    case "YEARS":
      return `${value.toFixed(2)} years`;
    case "DECIMAL_4":
      return value.toFixed(4);
    case "DECIMAL_2":
    default:
      return value.toFixed(2);
  }
}

// Shuffles array in-place
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class QuestionGenerator {
  private templates: QuestionTemplateDefinition[];

  constructor(templates: QuestionTemplateDefinition[] = QUESTION_TEMPLATES) {
    this.templates = templates;
  }

  /**
   * Generates a single concrete question from a template definition
   */
  public generateSingleQuestion(
    template: QuestionTemplateDefinition,
    examSessionId: string,
    index: number
  ): ExamQuestionData {
    const generated = template.generate();

    // Prepare raw candidate options: 1 correct + 4 distractors
    const rawOptions: {
      text: string;
      rawVal: number;
      isCorrect: boolean;
      distractorType: any;
      explanation: string;
    }[] = [
      {
        text: formatValue(generated.correctValue, generated.format),
        rawVal: generated.correctValue,
        isCorrect: true,
        distractorType: "CORRECT",
        explanation: "Correct answer mathematically derived from first actuarial principles.",
      },
    ];

    const usedTexts = new Set<string>([rawOptions[0].text]);

    // Add distractors ensuring uniqueness
    for (const d of generated.distractors) {
      let candidateVal = d.value;
      let text = formatValue(candidateVal, generated.format);

      // Perturb if collision occurs
      let attempts = 0;
      while ((usedTexts.has(text) || Math.abs(candidateVal - generated.correctValue) < 1e-4) && attempts < 10) {
        attempts++;
        const factor = attempts % 2 === 0 ? 1 + 0.03 * attempts : 1 - 0.03 * attempts;
        candidateVal = d.value * factor;
        text = formatValue(candidateVal, generated.format);
      }

      usedTexts.add(text);
      rawOptions.push({
        text,
        rawVal: candidateVal,
        isCorrect: false,
        distractorType: d.type,
        explanation: d.explanation,
      });
    }

    // Ensure we have exactly 5 options
    while (rawOptions.length < 5) {
      const fallbackVal = generated.correctValue * (1 + (rawOptions.length % 2 === 0 ? 0.05 : -0.05) * rawOptions.length);
      const text = formatValue(fallbackVal, generated.format);
      if (!usedTexts.has(text)) {
        usedTexts.add(text);
        rawOptions.push({
          text,
          rawVal: fallbackVal,
          isCorrect: false,
          distractorType: "CALCULATION_DISTRACTOR",
          explanation: "Distractor based on an intermediate calculation error.",
        });
      }
    }

    // Shuffle options and assign A, B, C, D, E keys
    const shuffled = shuffle(rawOptions.slice(0, 5));
    const optionKeys: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];

    const renderedOptions: RenderedOption[] = shuffled.map((opt, idx) => ({
      key: optionKeys[idx],
      text: opt.text,
      isCorrect: opt.isCorrect,
      distractorType: opt.distractorType,
      distractorExplanation: opt.explanation,
    }));

    return {
      id: `q_${examSessionId}_${index + 1}`,
      examSessionId,
      templateId: template.id,
      domain: template.domain,
      renderedQuestion: generated.questionText,
      renderedOptions,
      selectedOption: null,
      isFlagged: false,
      variables: generated.variables,
      isCorrect: null,
      solutionSteps: generated.solutionSteps,
      videoUrl: generated.videoUrl,
    };
  }

  /**
   * Generates exactly 30 questions distributed across the 5 SOA Exam FM domains:
   * 1. TIME_VALUE_OF_MONEY (6 questions)
   * 2. ANNUITIES (6 questions)
   * 3. LOANS (6 questions)
   * 4. BONDS (6 questions)
   * 5. ALM_IMMUNIZATION (6 questions)
   */
  public generateFullExam(options: GenerateExamOptions): ExamQuestionData[] {
    const { sessionId, totalQuestions = 30 } = options;

    const domains: TopicDomain[] = [
      "TIME_VALUE_OF_MONEY",
      "ANNUITIES",
      "LOANS",
      "BONDS",
      "ALM_IMMUNIZATION",
    ];

    const questionsPerDomain = Math.floor(totalQuestions / domains.length); // 6 each
    const questions: ExamQuestionData[] = [];
    let qCounter = 0;

    for (const domain of domains) {
      const domainTemplates = this.templates.filter((t) => t.domain === domain);
      if (domainTemplates.length === 0) continue;

      for (let i = 0; i < questionsPerDomain; i++) {
        // Cycle or pick random template within the domain
        const template = domainTemplates[i % domainTemplates.length];
        const q = this.generateSingleQuestion(template, sessionId, qCounter++);
        questions.push(q);
      }
    }

    // If remaining questions to reach totalQuestions (e.g. if total wasn't divisible by 5)
    while (questions.length < totalQuestions) {
      const template = this.templates[questions.length % this.templates.length];
      questions.push(this.generateSingleQuestion(template, sessionId, qCounter++));
    }

    // Shuffle order of questions across the 30-question exam so domains are interspersed naturally
    return shuffle(questions).map((q, idx) => ({
      ...q,
      // Retain consistent question index 1-30 in the session
      id: `q_${sessionId}_${idx + 1}`,
    }));
  }
}

export const examGenerator = new QuestionGenerator();
