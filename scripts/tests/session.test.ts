import { buildQuestion } from "../../lib/engine/assemble";
import { buildSession } from "../../lib/engine/session";
import { TEMPLATE_BY_ID } from "../../lib/engine/templates";
import { toPublicQuestion, type QuestionInstance } from "../../lib/engine/types";
import { classifyAttempt, containsValue, numbersIn, type AttemptRecord } from "../../lib/analysis/attempts";
import { evaluateHypotheses, masteryStatus } from "../../lib/analysis/mastery";
import { applySession, isDue, remediationTargets, type RemediationItemData } from "../../lib/analysis/remediation";
import { buildReport } from "../../lib/analysis/report";
import { skillProfile } from "../../lib/analysis/skills";
import { checkRewording } from "../../lib/llm/provider";
import { EXAM_DISTRIBUTION, distributionFor } from "../../lib/syllabus";
import { acceptElapsed, formatClock, isExpired, remainingSeconds } from "../../lib/timer";
import { expect, test } from "./harness";

test("exam simulation follows the 3/7/6/6/8 distribution with no repeated template", () => {
  for (let s = 0; s < 6; s += 1) {
    const { questions, flagged } = buildSession({ mode: "EXAM", count: 30, difficulty: 1, seed: `exam-${s}` });
    expect(questions.length === 30, `seed ${s}: ${questions.length} questions`);
    expect(flagged.length === 0, `seed ${s}: flagged templates ${flagged.join(", ")}`);
    const counts: Record<string, number> = {};
    questions.forEach((q) => (counts[q.topic] = (counts[q.topic] ?? 0) + 1));
    for (const [topic, expected] of Object.entries(EXAM_DISTRIBUTION)) {
      expect(counts[topic] === expected, `seed ${s}: ${topic} has ${counts[topic]}, expected ${expected}`);
    }
    expect(new Set(questions.map((q) => q.templateId)).size === 30, `seed ${s}: repeated template`);
    expect(questions.every((q) => q.difficulty === 1), `seed ${s}: non-standard level in a standard exam`);
    const topicsInOrder = questions.map((q) => q.topic).join();
    const sorted = [...questions].sort((a, b) => a.topic.localeCompare(b.topic)).map((q) => q.topic).join();
    expect(topicsInOrder !== sorted, `seed ${s}: questions grouped by topic`);
  }
});

test("diagnostic, challenge and mixed sessions", () => {
  expect(Object.values(distributionFor(15)).reduce((a, b) => a + b, 0) === 15, "15-question split sums to 15");
  const diag = buildSession({ mode: "DIAGNOSTIC", count: 15, difficulty: "mixed", seed: "diag" });
  expect(diag.questions.length === 15, "diagnostic has 15 questions");
  expect(new Set(diag.questions.map((q) => q.difficulty)).size >= 2, "mixed difficulty spans levels");
  const challenge = buildSession({ mode: "CHALLENGE", count: 10, difficulty: 3, seed: "chal" });
  expect(challenge.questions.length === 10, "challenge has 10 questions");
  expect(challenge.questions.filter((q) => q.difficulty === 3).length >= 7, "challenge is mostly level 3");
});

test("remediation targets set the same trap in a different template", () => {
  const { questions } = buildSession({
    mode: "REMEDIATION",
    count: 2,
    difficulty: "mixed",
    seed: "rem",
    targets: [
      { misconception: "TIMING_DUE_AS_IMMEDIATE", avoidTemplates: ["ann-level-payment"] },
      { misconception: "ALLOC_AGGREGATE_AS_EACH", avoidTemplates: [] },
    ],
  });
  expect(questions.length === 2, "two targeted questions");
  expect(questions.some((q) => q.options.some((o) => o.misconceptionTag === "TIMING_DUE_AS_IMMEDIATE") && q.templateId !== "ann-level-payment"), "annuity-due trap from a different template");
  expect(questions.some((q) => q.options.some((o) => o.misconceptionTag === "ALLOC_AGGREGATE_AS_EACH")), "aggregate trap present");
});

test("the public view of a question reveals nothing about the answer", () => {
  const q = buildQuestion(TEMPLATE_BY_ID["bond-price"], 1, "public").instance!;
  const view = toPublicQuestion(q);
  expect(JSON.stringify(Object.keys(view)) === JSON.stringify(["instanceId", "stem", "options"]), "unexpected keys in public view");
  expect(view.options.every((o) => Object.keys(o).join() === "key,display"), "options carry more than key and display");
});

// ---------------------------------------------------------------- scoring and evidence

function attempt(instance: QuestionInstance, key: string | null, extra: Partial<AttemptRecord> = {}, position = 0): AttemptRecord {
  return {
    questionId: `${instance.instanceId}-${position}`,
    sessionId: "s",
    mode: "DIAGNOSTIC",
    position,
    submittedAt: new Date().toISOString(),
    instance,
    selectedKey: key,
    confidence: "MEDIUM",
    method: null,
    methodNote: null,
    working: "",
    timeSpentSeconds: 120,
    isCorrect: Boolean(instance.options.find((o) => o.key === key)?.isCorrect),
    ...extra,
  };
}

test("working is read for numbers and percentages", () => {
  expect(JSON.stringify(numbersIn("B = 11,000 − 2,000 at 5.25% and 0.0525")) === JSON.stringify([11000, 2000, 5.25, 0.0525]), "numbers parsed");
  expect(containsValue([11000], 11000.4) && containsValue([5.25], 0.0525) && !containsValue([11000], 11500), "marker matching");
});

test("reasoning quality distinguishes sound, guessed, unverified and suspect answers", () => {
  const q = buildQuestion(TEMPLATE_BY_ID["loan-running-balance"], 1, "evidence").instance!;
  const right = q.correctKey;
  const B1 = q.markers[0];
  expect(classifyAttempt(attempt(q, right, { working: `B1 = ${B1.toFixed(2)}`, confidence: "HIGH" })).quality === "SOUND", "sound");
  expect(classifyAttempt(attempt(q, right, { confidence: "VERY_LOW" })).quality === "POSSIBLE_GUESS", "guess");
  expect(classifyAttempt(attempt(q, right, { confidence: "HIGH" })).quality === "UNVERIFIED", "unverified");
  const trapOption = q.options.find((o) => o.misconceptionTag === "MODEL_INTEREST_ON_PAYMENT" && o.markers.length);
  if (trapOption) {
    const e = classifyAttempt(attempt(q, right, { confidence: "HIGH", working: `interest ${trapOption.markers[0].toFixed(2)}` }));
    expect(e.quality === "SUSPECT_METHOD", `suspect method, got ${e.quality}`);
  }
  const wrong = q.options.find((o) => !o.isCorrect)!;
  const e = classifyAttempt(attempt(q, wrong.key, { confidence: "VERY_HIGH" }));
  expect(e.quality === "INCORRECT" && e.selectedMisconception === wrong.misconceptionTag, "incorrect answer tagged with its misconception");
  expect(e.observed.length > 0 && e.inferred.length > 0, "observed and inferred statements separated");
  const slip = classifyAttempt(attempt(q, wrong.key, { working: `B1 = ${B1.toFixed(2)}` }));
  expect(slip.cause === "METHOD_RIGHT_EXECUTION_WRONG", `correct setup then a slip, got ${slip.cause}`);
});

test("report scoring, misconception tallies, confidence calibration and time analysis", () => {
  const ids = ["loan-running-balance", "tvm-two-funds", "ann-due-accumulation", "bond-price", "alm-duration", "loan-refinance"];
  const attempts = ids.map((id, idx) => {
    const q = buildQuestion(TEMPLATE_BY_ID[id], TEMPLATE_BY_ID[id].levels[0], `report-${idx}`).instance!;
    const wrong = q.options.find((o) => !o.isCorrect)!;
    const key = idx % 2 === 0 ? q.correctKey : idx === 5 ? null : wrong.key;
    return attempt(q, key, { confidence: idx === 1 ? "VERY_HIGH" : "MEDIUM", timeSpentSeconds: idx === 3 ? 1500 : 120 }, idx);
  });
  const report = buildReport(
    { id: "r", mode: "DIAGNOSTIC", difficulty: "mixed", timed: false, durationSeconds: null, elapsedSeconds: 2000, createdAt: "", submittedAt: new Date().toISOString() },
    attempts
  );
  expect(report.overall.total === 6 && report.overall.correct === 3 && report.overall.unanswered === 1 && report.overall.incorrect === 2, `totals ${JSON.stringify(report.overall)}`);
  expect(report.misconceptions.reduce((a, m) => a + m.count, 0) === 2, "two misconceptions tallied");
  expect(report.confidence.highConfidenceWrong.includes(2), "high-confidence wrong answer listed (Q2)");
  expect(report.overall.longQuestions.some((q) => q.position === 4), "long question flagged (Q4)");
  expect(report.reasoning.length === 14, "fourteen reasoning dimensions");
  expect(report.byTopic.reduce((a, t) => a + t.total, 0) === 6, "topic totals");
  const profile = skillProfile(attempts);
  expect(profile.every((s) => s.observations === 0 || s.score !== null), "profile scores");
});

test("timer rules", () => {
  expect(remainingSeconds(9000, 8999) === 1 && remainingSeconds(9000, 9500) === 0 && remainingSeconds(null, 50) === null, "remaining");
  expect(isExpired(9000, 9000) && !isExpired(9000, 8999) && !isExpired(null, 1e9), "expiry");
  expect(acceptElapsed(100, 50, 10, 9000) === 100, "clock never runs backwards");
  expect(acceptElapsed(100, 5000, 10, 9000) === 115, "clock cannot jump past wall time");
  expect(acceptElapsed(8990, 9100, 200, 9000) === 9000, "clock capped at the duration");
  expect(formatClock(9000) === "2:30:00" && formatClock(65) === "1:05", "formatting");
});

// ---------------------------------------------------------------- mastery and remediation

test("mastery needs several secure answers on different presentations over time", () => {
  const q = (id: string) => buildQuestion(TEMPLATE_BY_ID[id], TEMPLATE_BY_ID[id].levels[0], "m").instance!;
  const a = q("loan-level-balance");
  const b = q("loan-running-balance");
  const c = { ...q("loan-level-balance"), templateId: "loan-third-presentation" };
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  const one = [attempt(a, a.correctKey, { submittedAt: at(1) })];
  expect(masteryStatus(one).status !== "MASTERED", "one correct answer is not mastery");
  const sameDay = [a, b, c].map((inst, idx) => attempt(inst, inst.correctKey, { submittedAt: at(3 - idx) }, idx));
  expect(masteryStatus(sameDay).status === "SECURE", `three in one sitting is secure, not mastered (${masteryStatus(sameDay).status})`);
  const spread = [a, b, c].map((inst, idx) => attempt(inst, inst.correctKey, { submittedAt: at(48 - idx * 24) }, idx));
  expect(masteryStatus(spread).status === "MASTERED", `three over two days is mastered (${masteryStatus(spread).status})`);
  const weak = [a, b].map((inst, idx) => attempt(inst, inst.options.find((o) => !o.isCorrect)!.key, {}, idx));
  expect(masteryStatus(weak).status === "WEAK", "two wrong is weak");
});

test("remediation cycle: open → two variations → delayed retest → resolved; a miss resets it", () => {
  const source = buildQuestion(TEMPLATE_BY_ID["ann-level-payment"], 1, "src").instance!;
  const trapKey = source.options.find((o) => o.misconceptionTag === "TIMING_DUE_AS_IMMEDIATE" || o.misconceptionTag === "TIMING_IMMEDIATE_AS_DUE" || !o.isCorrect)!;
  const t0 = new Date("2026-10-01T09:00:00Z");
  let items: RemediationItemData[] = applySession([], [attempt(source, trapKey.key)], t0) as RemediationItemData[];
  expect(items.length === 1 && items[0].status === "OPEN" && items[0].stage === 1, "mistake opens an item");
  items = items.map((i, k) => ({ ...i, id: `item-${k}`, createdAt: t0.toISOString() }));
  const targets = remediationTargets(items, t0);
  expect(targets.length === 2 && targets.every((t) => t.misconception === trapKey.misconceptionTag && t.avoidTemplates?.includes("ann-level-payment")), "two variations requested, avoiding the source template");

  const { questions } = buildSession({ mode: "REMEDIATION", count: 2, difficulty: "mixed", seed: "cycle", targets });
  const step = (list: RemediationItemData[], qs: QuestionInstance[], correct: boolean, when: Date) => {
    const changed = applySession(list, qs.map((q, idx) => attempt(q, correct ? q.correctKey : q.options.find((o) => !o.isCorrect)!.key, {}, idx)), when);
    return list.map((i) => changed.find((c) => c.id === i.id) ?? i);
  };
  let next = step(items, questions, true, t0);
  expect(next[0].stage === 3 && next[0].status === "SCHEDULED", `two correct variations schedule a retest (stage ${next[0].stage}, ${next[0].status})`);
  expect(!isDue(next[0], t0) && isDue(next[0], new Date(t0.getTime() + 25 * 3_600_000)), "retest is due after 24 hours");
  const later = new Date(t0.getTime() + 25 * 3_600_000);
  const retest = buildSession({ mode: "REMEDIATION", count: 1, difficulty: "mixed", seed: "retest", targets: remediationTargets(next, later) }).questions;
  const resolved = step(next, retest, true, later);
  expect(resolved[0].status === "RESOLVED", `correct retest resolves the item (${resolved[0].status})`);
  next = step(next, retest, false, later);
  expect(next[0].stage === 1 && next[0].status === "OPEN", "a wrong retest resets the item");
});

test("initial profile hypotheses start untested and respond to evidence", () => {
  expect(evaluateHypotheses([]).every((h) => h.status === "UNTESTED"), "no evidence → untested");
  const q = buildQuestion(TEMPLATE_BY_ID["tvm-two-funds"], 1, "h").instance!;
  const aggregate = q.options.find((o) => o.misconceptionTag === "ALLOC_AGGREGATE_AS_EACH");
  if (aggregate) {
    const attempts = [0, 1, 2].map((k) => attempt(q, aggregate.key, {}, k));
    const timing = evaluateHypotheses(attempts).find((h) => h.hypothesis.id === "W-timing")!;
    expect(timing.status === "SUPPORTED", `repeated allocation errors support weakness F (${timing.status})`);
  }
});

test("language-model rewording is rejected unless numbers and maths are preserved", () => {
  const original = "A loan of 10,000 is repaid at $i = 5\\%$. Calculate the balance after 3 years.";
  expect(checkRewording(original, "A business borrows 10,000, charged $i = 5\\%$. What is owed after 3 years?") === null, "faithful rewording accepted");
  expect(checkRewording(original, "A business borrows 12,000, charged $i = 5\\%$. What is owed after 3 years?") === "numbers changed", "changed number rejected");
  expect(checkRewording(original, "A business borrows 10,000, charged $i = 6\\%$. What is owed after 3 years?") === "mathematical expressions changed", "changed maths rejected");
  expect(checkRewording(original, "Use the annuity-immediate formula: 10,000 at $i = 5\\%$, owed after 3 years?") === "method or topic revealed", "hint rejected");
});
