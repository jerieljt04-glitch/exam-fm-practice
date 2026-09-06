import { examGenerator } from "../lib/engine/generator";
import { examRepository } from "../lib/db";
import { TopicDomain } from "../lib/types/exam";

async function runTests() {
  console.log("=================================================");
  console.log("1. TESTING EXAM GENERATOR ENGINE (30 QUESTIONS)");
  console.log("=================================================");

  const sessionQuestions = examGenerator.generateFullExam({
    sessionId: "test-session-actuarial",
    totalQuestions: 30,
  });

  console.log(`Total generated questions: ${sessionQuestions.length}`);

  if (sessionQuestions.length !== 30) {
    throw new Error(`Expected 30 questions, got ${sessionQuestions.length}`);
  }

  const domainCounts: Record<string, number> = {};
  for (let i = 0; i < sessionQuestions.length; i++) {
    const q = sessionQuestions[i];
    domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;

    // Verify 5 options: A, B, C, D, E
    if (q.renderedOptions.length !== 5) {
      throw new Error(`Question ${i + 1} has ${q.renderedOptions.length} options, expected 5`);
    }

    const keys = q.renderedOptions.map((o) => o.key);
    if (keys.join(",") !== "A,B,C,D,E") {
      throw new Error(`Question ${i + 1} option keys invalid: ${keys.join(",")}`);
    }

    const correct = q.renderedOptions.filter((o) => o.isCorrect);
    if (correct.length !== 1) {
      throw new Error(`Question ${i + 1} has ${correct.length} correct options, expected 1`);
    }

    // Verify options are strictly distinct (no identical values)
    const texts = new Set(q.renderedOptions.map((o) => o.text));
    if (texts.size !== 5) {
      throw new Error(`Question ${i + 1} has duplicate option choices: ${Array.from(texts)}`);
    }

    // Verify distractor types
    for (const opt of q.renderedOptions) {
      if (!opt.isCorrect && !opt.distractorType) {
        throw new Error(`Question ${i + 1} option ${opt.key} is missing distractor trap metadata`);
      }
    }
  }

  console.log("Topic Domain Breakdown across 30 questions:");
  console.log(JSON.stringify(domainCounts, null, 2));

  // Verify all 5 domains are represented
  const expectedDomains: TopicDomain[] = [
    "TIME_VALUE_OF_MONEY",
    "ANNUITIES",
    "LOANS",
    "BONDS",
    "ALM_IMMUNIZATION",
  ];
  for (const ed of expectedDomains) {
    if (!domainCounts[ed] || domainCounts[ed] === 0) {
      throw new Error(`Domain ${ed} missing from generated exam!`);
    }
  }

  console.log("✓ Exactly 30 questions verified.");
  console.log("✓ 5 unique options (A, B, C, D, E) verified on every question.");
  console.log("✓ Exactly 1 correct answer per question verified.");
  console.log("✓ Algorithmic distractor trap metadata verified.");

  console.log("\n=================================================");
  console.log("2. TESTING EXAM REPOSITORY & CBT FLOW");
  console.log("=================================================");

  // Create session
  const session = await examRepository.createExamSession("actuarial-candidate-42");
  console.log(`Created exam session: ${session.id}, status: ${session.status}, duration: ${session.durationSeconds}s`);

  if (session.durationSeconds !== 9000) {
    throw new Error(`Expected 150 minutes (9000 seconds), got ${session.durationSeconds}`);
  }

  // Test Pause / Resume tracking
  console.log("\nTesting Pause / Resume Engine...");
  const paused = await examRepository.updatePauseState(session.id, true);
  console.log(`Paused status: ${paused.status}, isPaused: ${paused.isPaused}, lastPausedAt: ${paused.lastPausedAt}`);
  if (!paused.isPaused || paused.status !== "PAUSED") {
    throw new Error("Pause state failed to update");
  }

  // Simulate 120ms pause elapsed
  await new Promise((r) => setTimeout(r, 120));

  const resumed = await examRepository.updatePauseState(session.id, false);
  console.log(`Resumed status: ${resumed.status}, isPaused: ${resumed.isPaused}, pausedTimeMs: ${resumed.pausedTimeMs}ms`);
  if (resumed.isPaused || resumed.status !== "IN_PROGRESS" || resumed.pausedTimeMs <= 0) {
    throw new Error("Resume state failed to record elapsed pause time");
  }

  // Answer some questions (simulate 22 correct answers to achieve passing score)
  console.log("\nSimulating candidate answering questions...");
  for (let i = 0; i < session.questions.length; i++) {
    const q = session.questions[i];
    const correctOption = q.renderedOptions.find((o) => o.isCorrect)!;
    const wrongOption = q.renderedOptions.find((o) => !o.isCorrect)!;

    // Answer 22 correctly, 8 incorrectly
    const selectedKey = i < 22 ? correctOption.key : wrongOption.key;
    await examRepository.updateQuestionAnswer(session.id, q.id, selectedKey, i === 3);
  }

  // Submit and grade exam
  console.log("\nSubmitting exam and generating diagnostic report...");
  const review = await examRepository.submitExam(session.id);

  console.log(`Grading Result: ${review.correctCount} / ${review.totalQuestions} (${review.scorePercent}%)`);
  console.log(`Pass Status: ${review.isPassed ? "PASSED (>= 70%)" : "FAILED"}`);

  if (review.correctCount !== 22 || !review.isPassed) {
    throw new Error(`Grading logic mismatch: expected 22/30, got ${review.correctCount}`);
  }

  console.log("\nDomain Performance Diagnostics:");
  for (const [dom, metric] of Object.entries(review.domainMetrics)) {
    console.log(`- ${metric.label}: ${metric.correct}/${metric.total} (${metric.percentage}%) [${metric.status}]`);
  }

  console.log("\nVerifying KaTeX Solutions and Video URLs on Questions:");
  for (const q of review.questions.slice(0, 3)) {
    console.log(`- [${q.domain}] Video: ${q.videoUrl} | Solution length: ${q.solutionSteps.length} chars`);
    if (!q.solutionSteps.includes("$") && !q.solutionSteps.includes("\\")) {
      throw new Error(`Question ${q.id} missing KaTeX solution formatting!`);
    }
  }

  console.log("\n=================================================");
  console.log("ALL TEST SUITES PASSED FLAWLESSLY! 🚀");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
