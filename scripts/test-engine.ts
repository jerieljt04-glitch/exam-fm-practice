/**
 * Engine test suite.
 *
 * Run with `npm run test:engine`. Verifies the exam blueprint, the option
 * construction rules, generator determinism, and — most importantly — that
 * every piece of authored markup survives the KaTeX pipeline. The markup checks
 * are the regression guard for question text such as
 * `the $12^{\text{th}} payment`, which previously rendered as raw LaTeX because
 * an unescaped currency amount swallowed the opening math delimiter.
 */

import katex from "katex";

import { DOMAIN_ORDER, EXAM_TOTAL_QUESTIONS, OPTION_KEYS, QUESTIONS_PER_DOMAIN } from "../lib/exam-config";
import { examGenerator } from "../lib/engine/generator";
import { QUESTION_TEMPLATES, TEMPLATES_BY_DOMAIN } from "../lib/engine/templates";
import { examRepository } from "../lib/db";
import { parseMarkup } from "../lib/math/markup";
import type { ExamQuestionData } from "../lib/types/exam";

let failures = 0;

function check(condition: boolean, message: string): void {
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
}

/** Markup that must never survive into rendered prose. */
const LEAKED_MARKUP = [
  /\\text\{/,
  /\\frac/,
  /\\overline/,
  /\\cdot/,
  /\\delta/,
  /\\ddot/,
  /\^\{/,
  /_\{/,
  /\\\\/,
  /\*\*/,
];

/**
 * Asserts that a markup string tokenizes into text that reads as prose and math
 * that KaTeX can typeset.
 */
function checkMarkup(label: string, markup: string): void {
  const segments = parseMarkup(markup);

  for (const segment of segments) {
    if (segment.type === "break") continue;

    if (segment.type === "text") {
      for (const pattern of LEAKED_MARKUP) {
        if (pattern.test(segment.value)) {
          check(
            false,
            `${label}: markup leaked into rendered prose (${pattern}) — "${segment.value.trim().slice(0, 90)}"`
          );
          break;
        }
      }
      continue;
    }

    try {
      katex.renderToString(segment.value, {
        displayMode: segment.type === "display",
        throwOnError: true,
        strict: false,
      });
    } catch (error) {
      check(false, `${label}: KaTeX cannot typeset "${segment.value.slice(0, 90)}" — ${String(error)}`);
    }
  }
}

function checkQuestion(question: ExamQuestionData, index: number): void {
  const label = `Q${index + 1} [${question.templateId}]`;

  check(
    question.renderedOptions.length === OPTION_KEYS.length,
    `${label}: has ${question.renderedOptions.length} options, expected ${OPTION_KEYS.length}`
  );
  check(
    question.renderedOptions.map((option) => option.key).join(",") === OPTION_KEYS.join(","),
    `${label}: option keys are not A–E in order`
  );
  check(
    question.renderedOptions.filter((option) => option.isCorrect).length === 1,
    `${label}: must have exactly one correct option`
  );
  check(
    new Set(question.renderedOptions.map((option) => option.text)).size === OPTION_KEYS.length,
    `${label}: option labels are not all distinct`
  );
  check(
    question.renderedOptions.every((option) => option.isCorrect || Boolean(option.distractorType)),
    `${label}: every distractor must carry an error model`
  );
  check(
    question.renderedOptions.every((option) => option.isCorrect || Boolean(option.distractorExplanation)),
    `${label}: every distractor must explain the misconception`
  );
  check(question.solutionSteps.trim().length > 0, `${label}: missing worked solution`);
  check(question.objective.trim().length > 0, `${label}: missing learning objective`);

  checkMarkup(`${label} question`, question.renderedQuestion);
  checkMarkup(`${label} solution`, question.solutionSteps);
  question.renderedOptions.forEach((option) => {
    checkMarkup(`${label} option ${option.key}`, option.text);
    if (option.distractorExplanation) {
      checkMarkup(`${label} option ${option.key} rationale`, option.distractorExplanation);
    }
  });
}

async function run(): Promise<void> {
  section("1. Template library");
  console.log(`  Templates: ${QUESTION_TEMPLATES.length}`);
  for (const domain of DOMAIN_ORDER) {
    const count = TEMPLATES_BY_DOMAIN[domain].length;
    console.log(`  ${domain}: ${count}`);
    check(
      count >= QUESTIONS_PER_DOMAIN,
      `${domain} has ${count} templates but the blueprint draws ${QUESTIONS_PER_DOMAIN}`
    );
  }

  section("2. Generated exams (markup, options, blueprint)");
  const EXAM_COUNT = 25;
  for (let attempt = 0; attempt < EXAM_COUNT; attempt += 1) {
    const questions = examGenerator.generateFullExam({
      sessionId: `test-session-${attempt}`,
      totalQuestions: EXAM_TOTAL_QUESTIONS,
      seed: `suite-seed-${attempt}`,
    });

    check(
      questions.length === EXAM_TOTAL_QUESTIONS,
      `Exam ${attempt}: produced ${questions.length} questions, expected ${EXAM_TOTAL_QUESTIONS}`
    );

    const templateIds = questions.map((question) => question.templateId);
    check(
      new Set(templateIds).size === templateIds.length,
      `Exam ${attempt}: the same template appears more than once in a single sitting`
    );

    const domainCounts = new Map<string, number>();
    for (const question of questions) {
      domainCounts.set(question.domain, (domainCounts.get(question.domain) ?? 0) + 1);
    }
    for (const domain of DOMAIN_ORDER) {
      check(
        domainCounts.get(domain) === QUESTIONS_PER_DOMAIN,
        `Exam ${attempt}: ${domain} contributed ${domainCounts.get(domain) ?? 0} questions, expected ${QUESTIONS_PER_DOMAIN}`
      );
    }

    questions.forEach(checkQuestion);
  }
  console.log(`  Checked ${EXAM_COUNT * EXAM_TOTAL_QUESTIONS} generated questions.`);

  section("3. Determinism and regeneration");
  const seeded = () =>
    examGenerator.generateFullExam({ sessionId: "determinism", totalQuestions: 30, seed: "fixed" });
  check(
    JSON.stringify(seeded()) === JSON.stringify(seeded()),
    "The same seed must reproduce an identical exam"
  );

  const sample = seeded()[0];
  const seed = String((sample.variables as Record<string, unknown>)._seed);
  const replayed = examGenerator.regenerate(sample.templateId, seed, {
    examSessionId: sample.examSessionId,
    questionNumber: 1,
  });
  check(
    replayed?.renderedQuestion === sample.renderedQuestion,
    "Replaying a stored seed must reproduce the same question text"
  );
  check(
    replayed?.solutionSteps === sample.solutionSteps,
    "Replaying a stored seed must reproduce the same worked solution"
  );

  section("4. Repository flow: pause, answer, grade");
  const session = await examRepository.createExamSession("test-candidate");
  check(session.questions.length === EXAM_TOTAL_QUESTIONS, "A new session must hold 30 questions");
  check(session.durationSeconds === 9000, "A new session must run for 9000 seconds (150 minutes)");

  const paused = await examRepository.updatePauseState(session.id, true);
  check(paused.isPaused && paused.status === "PAUSED", "Pausing must set isPaused and status");

  await new Promise((resolve) => setTimeout(resolve, 120));

  const resumed = await examRepository.updatePauseState(session.id, false);
  check(
    !resumed.isPaused && resumed.status === "IN_PROGRESS" && resumed.pausedTimeMs >= 100,
    `Resuming must record the paused interval (recorded ${resumed.pausedTimeMs}ms)`
  );

  const CORRECT_ANSWERS = 22;
  for (let index = 0; index < session.questions.length; index += 1) {
    const question = session.questions[index];
    const correct = question.renderedOptions.find((option) => option.isCorrect)!;
    const wrong = question.renderedOptions.find((option) => !option.isCorrect)!;
    if (index < CORRECT_ANSWERS) {
      await examRepository.updateQuestionAnswer(session.id, question.id, correct.key);
    } else if (index < CORRECT_ANSWERS + 5) {
      await examRepository.updateQuestionAnswer(session.id, question.id, wrong.key);
    }
    // The remaining questions are deliberately left unanswered.
  }
  await examRepository.updateQuestionAnswer(session.id, session.questions[3].id, undefined, true);

  const review = await examRepository.submitExam(session.id);
  check(
    review.correctCount === CORRECT_ANSWERS,
    `Grading mismatch: expected ${CORRECT_ANSWERS} correct, got ${review.correctCount}`
  );
  check(review.unansweredCount === 3, `Expected 3 unanswered questions, got ${review.unansweredCount}`);
  check(review.isPassed, "22/30 must clear the 21/30 benchmark");
  check(
    Object.values(review.domainMetrics).every((metric) => metric.total === QUESTIONS_PER_DOMAIN),
    "Every domain must contribute exactly 6 graded questions"
  );

  const endTime = review.endTime;
  await new Promise((resolve) => setTimeout(resolve, 40));
  const revisited = await examRepository.getReviewData(session.id);
  check(
    revisited?.endTime === endTime,
    "Revisiting the review must not re-close the exam or move the end time"
  );

  section("Result");
  if (failures === 0) {
    console.log("  All engine checks passed.");
  } else {
    console.error(`  ${failures} check(s) failed.`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Test suite crashed:", error);
  process.exitCode = 1;
});
