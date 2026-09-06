import { examGenerator } from "./lib/engine/generator.js";

console.log("=========================================");
console.log("SOA EXAM FM GENERATOR VERIFICATION");
console.log("=========================================");

const session = "mock-exam-session-verify";
const questions = examGenerator.generateFullExam({ sessionId: session, totalQuestions: 30 });

console.log(`Generated Questions Count: ${questions.length} / 30`);

const domainCounts = {};
let all5Options = true;
let all1Correct = true;
let allOptionsUnique = true;
let validDistractorTypes = true;

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;

  if (q.renderedOptions.length !== 5) {
    console.error(`Question ${i + 1} does not have 5 options:`, q.renderedOptions.length);
    all5Options = false;
  }

  const correct = q.renderedOptions.filter((o) => o.isCorrect);
  if (correct.length !== 1) {
    console.error(`Question ${i + 1} does not have exactly 1 correct option:`, correct.length);
    all1Correct = false;
  }

  const optionTexts = new Set(q.renderedOptions.map((o) => o.text));
  if (optionTexts.size !== 5) {
    console.error(`Question ${i + 1} has duplicate option texts:`, q.renderedOptions.map((o) => o.text));
    allOptionsUnique = false;
  }

  for (const opt of q.renderedOptions) {
    if (!opt.isCorrect && !opt.distractorType) {
      validDistractorTypes = false;
    }
  }
}

console.log("Domain Breakdown across 30 questions:");
console.table(domainCounts);

console.log("\nQuality Checks:");
console.log(`- Exactly 5 options per question (A, B, C, D, E): ${all5Options ? "PASS" : "FAIL"}`);
console.log(`- Exactly 1 correct answer per question: ${all1Correct ? "PASS" : "FAIL"}`);
console.log(`- All 5 options strictly distinct (no duplicate choices): ${allOptionsUnique ? "PASS" : "FAIL"}`);
console.log(`- Error-driven distractor metadata present: ${validDistractorTypes ? "PASS" : "FAIL"}`);

console.log("\n--- Sample Question 1 ---");
console.log("Domain:", questions[0].domain);
console.log("Stem:\n", questions[0].renderedQuestion);
console.log("Options:");
questions[0].renderedOptions.forEach((o) => {
  console.log(`  [${o.key}] ${o.text} (isCorrect: ${o.isCorrect}, Trap: ${o.distractorType})`);
});
console.log("Solution Steps Preview:\n", questions[0].solutionSteps.split("\n").slice(0, 5).join("\n"));
