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

import {
  DOMAIN_QUESTION_RANGES,
  DOMAIN_ORDER,
  EXAM_ADVANCED_COUNTS,
  EXAM_CONCEPTUAL_QUESTIONS,
  EXAM_TOTAL_QUESTIONS,
  EXAM_DIFFICULTIES,
  MIN_ADVANCED_STEPS,
  OPTION_KEYS,
} from "../lib/exam-config";
import { examGenerator } from "../lib/engine/generator";
import { createRng } from "../lib/engine/random";
import {
  QUESTION_TEMPLATES,
  TEMPLATES_BY_DOMAIN,
  getTemplateById,
  isConceptualTemplate,
} from "../lib/engine/templates";
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

    // Inside math mode `%` opens a LaTeX comment, silently swallowing the rest
    // of the expression. Percentages in math must be written `\\%`.
    if (/(^|[^\\])%/.test(segment.value)) {
      check(
        false,
        `${label}: unescaped % inside math silently comments out the rest of "${segment.value.slice(0, 90)}"`
      );
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

  // No examiner prints a negative outstanding balance next to four positive
  // ones; an implausible option gives the answer away.
  const correctOption = question.renderedOptions.find((option) => option.isCorrect);
  if (correctOption && !correctOption.text.trimStart().startsWith("-")) {
    check(
      question.renderedOptions.every((option) => !option.text.trimStart().startsWith("-")),
      `${label}: a negative option appears alongside a positive correct answer`
    );
  }

  checkMarkup(`${label} question`, question.renderedQuestion);
  checkMarkup(`${label} solution`, question.solutionSteps);
  question.renderedOptions.forEach((option) => {
    checkMarkup(`${label} option ${option.key}`, option.text);
    if (option.distractorExplanation) {
      checkMarkup(`${label} option ${option.key} rationale`, option.distractorExplanation);
    }
  });
}

/**
 * Options print the way the SOA sample set prints them: bare numbers with no
 * currency symbol, grouping commas only from 10,000 upward, percentages with a
 * trailing % sign, and numeric options in ascending order.
 */
function checkSampleStyleOptions(question: ExamQuestionData, index: number): void {
  const label = `Q${index + 1} [${question.templateId}]`;
  const texts = question.renderedOptions.map((option) => option.text);
  // `$` delimits math in option markup, so only the prose outside it is checked.
  check(
    texts.every((text) => !/[$£€]/.test(text.replace(/\$[^$]*\$/g, ""))),
    `${label}: an option carries a currency symbol`
  );
  const numeric = texts.every((text) => /^[–-]?[\d,]+(\.\d+)?%?$/.test(text));
  if (!numeric) return;
  for (const text of texts) {
    const digits = text.replace(/[–\-%]/g, "").split(".")[0];
    const whole = Number(digits.replace(/,/g, ""));
    check(
      whole >= 10000 ? /^\d{1,3}(,\d{3})+$/.test(digits) : !digits.includes(","),
      `${label}: option "${text}" does not follow the sample set's comma convention`
    );
  }
  const values = texts.map((text) => Number(text.replace(/,/g, "").replace("–", "-").replace("%", "")));
  check(
    values.every((value, k) => k === 0 || value > values[k - 1]),
    `${label}: numeric options are not in ascending order (${texts.join(" | ")})`
  );
}

async function run(): Promise<void> {
  section("1. Template library");
  console.log(`  Templates: ${QUESTION_TEMPLATES.length}`);
  check(
    QUESTION_TEMPLATES.length >= 180,
    `The bank must contain at least 180 templates (found ${QUESTION_TEMPLATES.length})`
  );
  for (const domain of DOMAIN_ORDER) {
    const count = TEMPLATES_BY_DOMAIN[domain].length;
    console.log(`  ${domain}: ${count}`);
    check(count >= 25, `${domain} has only ${count} templates; each topic needs at least 25 for variety`);
  }
  // Every question type is traceable to the SOA sample questions it is modelled on.
  for (const template of QUESTION_TEMPLATES) {
    check(template.id.startsWith("FM_"), `${template.id}: template ids use the FM_ prefix`);
    check(
      (template.soaSamples?.length ?? 0) > 0,
      `${template.id}: must name the SOA sample questions its type is modelled on`
    );
  }

  section("2. Generated exams (markup, options, blueprint)");
  const EXAM_COUNT = 100;
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
    check(
      new Set(questions.map((question) => question.templateId)).size === questions.length,
      `Exam ${attempt}: repeated a question-solving template within the same test`
    );

    // Distinct template ids are not enough. Two templates can share a method,
    // which is the derivation a candidate actually performs, so an exam built
    // from both would read as repetitive even though the wording and the
    // numbers differ. The generator refuses such a pairing, and this is the
    // assertion that keeps it that way.
    const methodCounts = new Map<string, number>();
    for (const question of questions) {
      const definition = getTemplateById(question.templateId);
      const fingerprint = definition?.methodFingerprint ?? question.templateId;
      methodCounts.set(fingerprint, (methodCounts.get(fingerprint) ?? 0) + 1);
    }
    const repeatedMethods: string[] = [];
    methodCounts.forEach((count, fingerprint) => {
      if (count > 1) repeatedMethods.push(`${fingerprint} (${count}x)`);
    });
    check(
      repeatedMethods.length === 0,
      `Exam ${attempt}: repeated a solving method within the same test: ${repeatedMethods.join(", ")}`
    );
    const conceptualCount = questions.filter((question) => isConceptualTemplate(question)).length;
    check(
      conceptualCount <= EXAM_CONCEPTUAL_QUESTIONS,
      `Exam ${attempt}: drew ${conceptualCount} qualitative items, at most ${EXAM_CONCEPTUAL_QUESTIONS} are allowed`
    );

    const domainCounts = new Map<string, number>();
    for (const question of questions) {
      domainCounts.set(question.domain, (domainCounts.get(question.domain) ?? 0) + 1);
    }
    for (const domain of DOMAIN_ORDER) {
      const actual = domainCounts.get(domain) ?? 0;
      const range = DOMAIN_QUESTION_RANGES[domain];
      check(
        actual >= range.min && actual <= range.max,
        `Exam ${attempt}: ${domain} contributed ${actual} questions, expected ${range.min}-${range.max}`
      );
    }

    check(
      questions.every((question) =>
        /(?:^|\n\n)(?:Calculate|Determine|Which|[A-Z][^\n]*?,\s(?:calculate|determine))\b/.test(question.renderedQuestion)
      ),
      `Exam ${attempt}: a prompt does not place its instruction on a separate sample-style line`
    );
    // A sitting must span difficulties rather than running at one level: every
    // domain meets its level 3+ quota, and the paper still keeps direct items.
    for (const domain of DOMAIN_ORDER) {
      const inDomain = questions.filter((question) => question.domain === domain);
      check(
        inDomain.every((question) => EXAM_DIFFICULTIES.includes(question.difficulty)),
        `Exam ${attempt}: ${domain} drew a question outside the eligible difficulty range`
      );
      const advanced = inDomain.filter((question) => question.difficulty >= 3);
      check(
        advanced.length >= Math.min(EXAM_ADVANCED_COUNTS[domain], inDomain.length),
        `Exam ${attempt}: ${domain} drew ${advanced.length} level 3+ items, expected ${EXAM_ADVANCED_COUNTS[domain]}`
      );
      check(
        advanced.every((question) => question.steps >= MIN_ADVANCED_STEPS),
        `Exam ${attempt}: ${domain} included a level 3+ item with fewer than ${MIN_ADVANCED_STEPS} linked stages`
      );
    }
    const advancedTotal = questions.filter((question) => question.difficulty >= 3).length;
    check(
      advancedTotal >= 10 && advancedTotal <= EXAM_TOTAL_QUESTIONS - 8,
      `Exam ${attempt}: ${advancedTotal} of ${EXAM_TOTAL_QUESTIONS} items are level 3+, which is not a mixed paper`
    );

    questions.forEach(checkQuestion);
    questions.forEach(checkSampleStyleOptions);
  }
  console.log(`  Checked ${EXAM_COUNT * EXAM_TOTAL_QUESTIONS} generated questions.`);

  section("2a. Answer position is not predictable");
  // Options are printed in ascending numeric order, so the position of the key
  // is decided by how many distractors fall below the correct value. A template
  // with symmetric distractors used to put the answer in the same slot on every
  // draw, which produced practice sets where every correct answer was C.
  const positionCounts: Record<string, number> = {};
  for (const key of OPTION_KEYS) positionCounts[key] = 0;
  const positionByTemplate = new Map<string, Record<string, number>>();
  let positioned = 0;

  // More sittings than the markup pass: per-template position counts need
  // enough draws that a 60% cap is a real signal rather than sampling noise.
  const POSITION_EXAMS = 400;
  for (let attempt = 0; attempt < POSITION_EXAMS; attempt += 1) {
    const questions = examGenerator.generateFullExam({
      sessionId: `position-${attempt}`,
      seed: `position-${attempt}`,
    });
    for (const question of questions) {
      const index = question.renderedOptions.findIndex((option) => option.isCorrect);
      const key = OPTION_KEYS[index];
      positionCounts[key] += 1;
      positioned += 1;

      if (!positionByTemplate.has(question.templateId)) {
        const fresh: Record<string, number> = {};
        for (const optionKey of OPTION_KEYS) fresh[optionKey] = 0;
        positionByTemplate.set(question.templateId, fresh);
      }
      positionByTemplate.get(question.templateId)![key] += 1;
    }
  }

  // Every letter must be reachable, and none may dominate the paper.
  for (const key of OPTION_KEYS) {
    const share = positionCounts[key] / positioned;
    check(
      share >= 0.12 && share <= 0.28,
      `Answer position ${key} holds ${(share * 100).toFixed(1)}% of correct answers, expected 12-28%`
    );
  }

  // A single template must not pin its answer to one letter either; that is the
  // failure mode that made a whole Loans practice set come back all-C.
  for (const [templateId, counts] of Array.from(positionByTemplate.entries())) {
    const draws = OPTION_KEYS.reduce((sum, key) => sum + counts[key], 0);
    if (draws < 25) continue;
    const highest = Math.max(...OPTION_KEYS.map((key) => counts[key]));
    check(
      highest / draws <= 0.6,
      `Template ${templateId} put ${((highest / draws) * 100).toFixed(0)}% of its correct answers in one slot`
    );
  }
  console.log(
    `  ${positioned} answers spread across ${OPTION_KEYS.map(
      (key) => `${key}:${((positionCounts[key] / positioned) * 100).toFixed(1)}%`
    ).join(" ")}`
  );

  section("2b. Template self-verification");
  let assertionCount = 0;
  for (const template of QUESTION_TEMPLATES) {
    for (let draw = 0; draw < 40; draw += 1) {
      const item = template.generate(createRng(`verify-${template.id}-${draw}`));

      if (template.difficulty >= 3) {
        check(
          template.steps >= MIN_ADVANCED_STEPS,
          `${template.id}: level ${template.difficulty} items must chain ${MIN_ADVANCED_STEPS}+ steps`
        );
        const stageHeadings = item.solutionSteps.match(/\*\*Step \d+/g) ?? [];
        check(
          stageHeadings.length >= MIN_ADVANCED_STEPS,
          `${template.id}: solution shows ${stageHeadings.length} stages, expected at least ${MIN_ADVANCED_STEPS}`
        );
      }

      for (const assertion of item.checks ?? []) {
        assertionCount += 1;
        check(assertion.ok, `${template.id}: failed self-check "${assertion.label}"`);
      }

      // Markup coverage per template, rather than relying on which templates
      // happen to be drawn into the sampled exams above.
      checkMarkup(`${template.id} draw ${draw} question`, item.questionText);
      checkMarkup(`${template.id} draw ${draw} solution`, item.solutionSteps);
      const rationales = item.kind === "CHOICE" ? item.choices : item.distractors;
      for (const item_distractor of rationales) {
        checkMarkup(`${template.id} draw ${draw} rationale`, item_distractor.explanation);
      }
    }
  }
  console.log(`  Ran ${assertionCount} generator self-checks across ${QUESTION_TEMPLATES.length} templates.`);

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
  check(session.mode === "EXAM" && session.isTimed, "A default session must be strict timed Exam Mode");

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
  await examRepository.updateQuestionMeta(session.id, session.questions[0].id, {
    confidence: "SURE",
    timeSpentSeconds: 73,
    calculatorUsed: true,
  });
  await examRepository.updateQuestionMeta(session.id, session.questions[1].id, {
    calculatorUsed: false,
  });

  const review = await examRepository.submitExam(session.id);
  check(
    review.correctCount === CORRECT_ANSWERS,
    `Grading mismatch: expected ${CORRECT_ANSWERS} correct, got ${review.correctCount}`
  );
  check(review.unansweredCount === 3, `Expected 3 unanswered questions, got ${review.unansweredCount}`);
  check(review.isPassed, "22/30 must clear the 21/30 benchmark");
  check(
    review.questions[0].confidence === "SURE" &&
      review.questions[0].timeSpentSeconds === 73 &&
      review.questions[0].calculatorUsed === true,
    "Confidence, timing, and calculator-use metadata must survive grading"
  );
  check(
    Object.values(review.domainMetrics).reduce((sum, metric) => sum + metric.total, 0) === EXAM_TOTAL_QUESTIONS,
    "Domain diagnostic totals must add to 30"
  );

  const practice = await examRepository.createExamSession("practice-candidate", {
    mode: "PRACTICE",
    totalQuestions: 5,
    domains: ["ANNUITIES"],
    difficulties: [1, 2],
    isTimed: false,
  });
  check(practice.questions.length === 5, "A custom practice set must honor its question count");
  check(practice.questions.every((question) => question.domain === "ANNUITIES"), "A custom set must honor its domain filter");

  // A targeted study set must contain the chosen subject and nothing else. The
  // guard runs over every domain, at several set sizes and across the full
  // difficulty range, because the leak this replaced only appeared once a set
  // was large enough to exhaust the obvious templates for a subject.
  const DOMAIN_TOPIC_TAGS: Record<string, string[]> = {
    TIME_VALUE_OF_MONEY: ["TIME_VALUE"],
    ANNUITIES: ["TIME_VALUE"],
    LOANS: ["LOAN_MECHANICS"],
    BONDS: ["BONDS_AND_CURVES"],
    ALM_IMMUNIZATION: ["GENERAL_CASH_FLOWS", "IMMUNIZATION"],
  };
  for (const domain of DOMAIN_ORDER) {
    for (const size of [5, 10, 15, 30]) {
      const set = examGenerator.generateFullExam({
        sessionId: `targeted-${domain}-${size}`,
        totalQuestions: size,
        domains: [domain],
        difficulties: [1, 2, 3, 4],
        seed: `targeted-${domain}-${size}`,
      });
      const strays = set.filter((question) => question.domain !== domain);
      check(
        strays.length === 0,
        `A ${size}-question ${domain} set drew ${strays.length} question(s) from ${Array.from(
          new Set(strays.map((question) => question.domain))
        ).join(", ")}`
      );
      const offTopic = set.filter(
        (question) => !question.topics.some((topic) => DOMAIN_TOPIC_TAGS[domain].includes(topic))
      );
      check(
        offTopic.length === 0,
        `A ${size}-question ${domain} set drew ${offTopic.length} item(s) not tagged with its own syllabus area`
      );
    }
  }

  // Selecting two subjects must admit both and still exclude the other three.
  const pair = examGenerator.generateFullExam({
    sessionId: "targeted-pair",
    totalQuestions: 20,
    domains: ["LOANS", "BONDS"],
    difficulties: [1, 2, 3, 4],
    seed: "targeted-pair",
  });
  check(
    pair.every((question) => question.domain === "LOANS" || question.domain === "BONDS"),
    "A two-subject set must draw only from the two selected subjects"
  );
  check(
    new Set(pair.map((question) => question.domain)).size === 2,
    "A two-subject set must draw from both selected subjects, not just one"
  );
  check(practice.immediateFeedback && practice.formulaSheetEnabled && !practice.isTimed, "Practice Mode must enable teaching aids and allow untimed work");

  const endTime = review.endTime;
  await new Promise((resolve) => setTimeout(resolve, 40));
  const revisited = await examRepository.getReviewData(session.id);
  check(
    revisited?.endTime === endTime,
    "Revisiting the review must not re-close the exam or move the end time"
  );

  section("4a. Review of retired templates");
  // A study history can name templates that have since been retired from the
  // bank. Reviewing it must still produce a set, drawn from the same topics.
  const fallback = examGenerator.generateFullExam({
    sessionId: "retired-review",
    totalQuestions: 6,
    templateIds: ["ANNUITY_RETIRED_EXAMPLE", "BOND_RETIRED_EXAMPLE"],
    domains: ["ANNUITIES", "BONDS"],
    seed: "retired-review",
  });
  check(fallback.length === 6, `A review of retired templates must still produce its set (got ${fallback.length})`);
  check(
    fallback.every((question) => question.domain === "ANNUITIES" || question.domain === "BONDS"),
    "A review of retired templates must stay on the reviewed topics"
  );
  const mixed = examGenerator.generateFullExam({
    sessionId: "mixed-review",
    totalQuestions: 4,
    templateIds: ["FM_LOAN_BALANCE_AFTER_K", "LOAN_RETIRED_EXAMPLE"],
    domains: ["LOANS"],
    seed: "mixed-review",
  });
  check(
    mixed.every((question) => question.templateId === "FM_LOAN_BALANCE_AFTER_K"),
    "A review keeps the templates that still exist and skips retired ones"
  );

  section("5. Answers always register");

  // The exam once expired a sitting whose browser went quiet, after which every
  // answer was silently dropped while submission still graded the paper. An
  // answer must register regardless of how long the candidate spent thinking.
  const quiet = await examRepository.createExamSession("answers-register");
  const first = quiet.questions[0];
  const later = quiet.questions[1];

  await examRepository.updateQuestionAnswer(quiet.id, first.id, "A");
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await examRepository.updateQuestionAnswer(quiet.id, later.id, "B");

  const reread = await examRepository.getExamSession(quiet.id);
  check(reread?.status === "IN_PROGRESS", `A quiet sitting must stay open (got ${reread?.status})`);
  check(
    reread?.questions[0].selectedOption === "A" && reread?.questions[1].selectedOption === "B",
    "Both answers must be stored, whatever the gap between them"
  );

  const graded = await examRepository.submitExam(quiet.id);
  check(
    graded.unansweredCount === graded.totalQuestions - 2,
    `Only the untouched questions may count as unanswered (got ${graded.unansweredCount})`
  );

  // Starting a new exam still retires the previous sitting, which is what keeps
  // a stale paper from being resumed — without any timer that can kill a live one.
  const older = await examRepository.createExamSession("one-at-a-time-2");
  await examRepository.createExamSession("one-at-a-time-2");
  const olderAgain = await examRepository.getExamSession(older.id);
  check(
    olderAgain?.status === "ABANDONED",
    `Starting a new exam must retire the previous sitting (got ${olderAgain?.status})`
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
