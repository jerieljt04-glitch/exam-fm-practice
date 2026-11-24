import katex from "katex";

import { getConcept } from "../../lib/concepts/registry";
import { FORMULA_BY_ID, FORMULAS } from "../../lib/formulas/registry";
import { STUDY_CARDS, filterCards } from "../../lib/study/cards";
import { DRILL_ITEMS } from "../../lib/study/drill";
import { QUICK_CHECKS } from "../../lib/study/quick-checks";
import { STRATEGY_QUESTIONS } from "../../lib/study/strategy";
import { NEW_CARD, cardStage, nextSchedule } from "../../lib/study/schedule";
import { parseMarkup } from "../../lib/math/markup";
import { recordStudyAttempt, reviewCard, studyOverview } from "../../lib/server/study";
import { TOPIC_ORDER } from "../../lib/syllabus";
import { close, expect, test } from "./harness";

const typesets = (latex: string): boolean => {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: true });
    return true;
  } catch {
    return false;
  }
};

/** Every inline and display expression in a piece of markup typesets. */
const markupTypesets = (markup: string): string | null => {
  for (const node of parseMarkup(markup)) {
    if ((node.type === "inline" || node.type === "display") && !typesets(node.value)) return node.value;
  }
  return null;
};

// ---------------------------------------------------------------- scheduling

test("study schedule: intervals grow on recall, reset on a lapse, and never fall below the minimum ease", () => {
  const t0 = new Date("2026-11-01T00:00:00Z");
  const first = nextSchedule(NEW_CARD, "good", t0);
  close(first.intervalDays, 1, "first good review: one day");
  const second = nextSchedule(first, "good", t0);
  close(second.intervalDays, 3, "second good review: three days");
  const third = nextSchedule(second, "good", t0);
  expect(third.intervalDays > second.intervalDays * 2, "third good review grows by the ease factor");
  const easy = nextSchedule(NEW_CARD, "easy", t0);
  expect(easy.intervalDays > first.intervalDays && easy.ease > NEW_CARD.ease, "easy: longer interval and higher ease");
  const lapse = nextSchedule(third, "again", t0);
  expect(lapse.intervalDays === 0 && lapse.reps === 0 && lapse.lapses === 1, "again after learning: relearn and count a lapse");
  expect(lapse.dueAt.getTime() - t0.getTime() === 10 * 60_000, "a forgotten card returns after ten minutes");
  let card = { ...NEW_CARD };
  for (let k = 0; k < 20; k += 1) card = nextSchedule(card, "hard", t0);
  expect(card.ease >= 1.3 - 1e-12, "ease is floored at 1.3");
  expect(cardStage(undefined) === "new" && cardStage(first) === "young" && cardStage({ reps: 5, intervalDays: 40 }) === "mature", "card stages");
});

// ---------------------------------------------------------------- flashcards

test("flashcards: every formula has a recall and a recognise card, every concept a card, ids unique", () => {
  const ids = STUDY_CARDS.map((c) => c.id);
  expect(new Set(ids).size === ids.length, "duplicate card id");
  for (const f of FORMULAS) {
    expect(ids.includes(`f:${f.id}:recall`) && ids.includes(`f:${f.id}:recognise`), `${f.id}: missing card`);
  }
  for (const c of STUDY_CARDS) {
    if (c.deck === "formulas") expect(Boolean(FORMULA_BY_ID[c.ref]), `${c.id}: unknown formula`);
    else expect(Boolean(getConcept(c.ref)), `${c.id}: unknown concept`);
    expect(TOPIC_ORDER.includes(c.topic), `${c.id}: unknown topic ${c.topic}`);
  }
  const core = filterCards({ deck: "formulas" });
  expect(core.every((c) => c.relevance !== "unclear"), "unclear-relevance formulas are excluded by default");
  expect(filterCards({ deck: "formulas", includeUnclear: true }).length === FORMULAS.length * 2, "including unclear formulas gives every formula card");
  expect(filterCards({ deck: "formulas", area: "B", kind: "recall" }).every((c) => c.area === "B" && c.kind === "recall"), "area and kind filters");
});

// ---------------------------------------------------------------- formula drill

test("formula drill: the correct form matches an independent computation and every near-miss differs", () => {
  const ids = DRILL_ITEMS.map((d) => d.id);
  expect(new Set(ids).size === ids.length, "duplicate drill id");
  expect(DRILL_ITEMS.length >= 110, `drill bank too small: ${DRILL_ITEMS.length}`);
  for (const d of DRILL_ITEMS) {
    expect(Boolean(FORMULA_BY_ID[d.formula]), `${d.id}: unknown formula ${d.formula}`);
    const ref = d.reference(d.sample);
    const correct = d.correct.f(d.sample);
    expect(Number.isFinite(ref) && Number.isFinite(correct), `${d.id}: non-finite value`);
    close(correct, ref, `${d.id}: correct form disagrees with the independent reference`, 1e-5);
    const values = [correct];
    for (const w of d.wrong) {
      const value = w.f(d.sample);
      expect(Number.isFinite(value), `${d.id}: near-miss ${w.latex} is not finite`);
      expect(Math.abs(value - ref) > 1e-4 * Math.max(1, Math.abs(ref)), `${d.id}: near-miss ${w.latex} equals the correct value — it is not wrong`);
      expect(values.every((other) => Math.abs(other - value) > 1e-9 * Math.max(1, Math.abs(value))), `${d.id}: two forms coincide numerically (${w.latex})`);
      values.push(value);
      expect((w.why ?? "").length > 10, `${d.id}: near-miss without an explanation`);
    }
    const latex = [d.correct.latex, ...d.wrong.map((w) => w.latex)];
    expect(new Set(latex).size === 4, `${d.id}: repeated option text`);
    latex.forEach((l) => expect(typesets(l), `${d.id}: does not typeset: ${l}`));
    for (const markup of [d.prompt, d.hook, ...d.wrong.map((w) => w.why ?? "")]) {
      const bad = markupTypesets(markup);
      expect(bad === null, `${d.id}: markup does not typeset: ${bad}`);
    }
  }
});

test("formula drill: every section of both sheets is drilled", () => {
  for (const area of ["A", "B", "C", "D", "E", "F", "G"] as const) {
    const n = DRILL_ITEMS.filter((d) => d.area === area).length;
    expect(n >= (area === "C" ? 4 : 6), `section ${area}: only ${n} drill items`);
  }
  for (const d of DRILL_ITEMS) expect(TOPIC_ORDER.includes(d.topic), `${d.id}: unknown topic ${d.topic}`);
});

// ---------------------------------------------------------------- solution strategy

test("solution strategy: right plans reach the independently computed answer, wrong plans do not, markup typesets", () => {
  const ids = STRATEGY_QUESTIONS.map((q) => q.id);
  expect(new Set(ids).size === ids.length, "duplicate strategy id");
  expect(STRATEGY_QUESTIONS.length >= 40, `strategy bank too small: ${STRATEGY_QUESTIONS.length}`);
  for (const topic of TOPIC_ORDER) expect(STRATEGY_QUESTIONS.filter((q) => q.topic === topic).length >= 6, `${topic}: fewer than 6 strategy questions`);
  for (const kind of ["plan", "first-step", "setup", "trap"] as const) expect(STRATEGY_QUESTIONS.some((q) => q.kind === kind), `no ${kind} questions`);
  expect(STRATEGY_QUESTIONS.filter((q) => q.result).length >= 35, "most strategy questions are checked numerically");
  // No give-away by length: the right plan must not usually be the longest, nor have more steps than every wrong one.
  const size = (o: { steps: string[] }) => o.steps.join(" ").length;
  const longest = STRATEGY_QUESTIONS.filter((q) => size(q.correct) > Math.max(...q.wrong.map(size))).length;
  const shortest = STRATEGY_QUESTIONS.filter((q) => size(q.correct) < Math.min(...q.wrong.map(size))).length;
  expect(longest <= 0.35 * STRATEGY_QUESTIONS.length, `the right plan is the longest option in ${longest} questions`);
  expect(shortest <= 0.35 * STRATEGY_QUESTIONS.length, `the right plan is the shortest option in ${shortest} questions`);
  for (const q of STRATEGY_QUESTIONS) expect(q.correct.steps.length <= Math.max(...q.wrong.map((w) => w.steps.length)), `${q.id}: the right plan has more steps than every wrong plan`);
  for (const q of STRATEGY_QUESTIONS) {
    expect(q.formulas.length > 0 && q.formulas.every((f) => Boolean(FORMULA_BY_ID[f])), `${q.id}: unknown formula`);
    expect(q.correct.steps.length > 0 && q.wrong.every((w) => w.steps.length > 0 && (w.why ?? "").length > 10), `${q.id}: empty plan or wrong plan without a reason`);
    const texts = [q.correct, ...q.wrong].map((o) => o.steps.join("|"));
    expect(new Set(texts).size === 4, `${q.id}: repeated option`);
    for (const markup of [q.problem, q.insight, ...q.correct.steps, ...q.wrong.flatMap((w) => [...w.steps, w.why ?? ""])]) {
      const bad = markupTypesets(markup);
      expect(bad === null, `${q.id}: markup does not typeset: ${bad}`);
    }
    if (!q.result) continue;
    const ref = q.result.reference();
    const value = q.result.value();
    expect(Number.isFinite(ref) && Number.isFinite(value), `${q.id}: non-finite answer`);
    close(value, ref, `${q.id}: the right plan disagrees with the independent computation`, 1e-6);
    for (const w of q.wrong) {
      if (!w.value) continue;
      const x = w.value();
      expect(Number.isFinite(x) && Math.abs(x - ref) > 1e-4 * Math.max(1, Math.abs(ref)), `${q.id}: a wrong plan reaches the right answer (${w.steps[0]})`);
    }
  }
});

// ---------------------------------------------------------------- quick checks

test("quick checks: verdicts agree with their numerical checks, sources are on real pages, markup typesets", () => {
  const ids = QUICK_CHECKS.map((q) => q.id);
  expect(new Set(ids).size === ids.length, "duplicate quick-check id");
  expect(QUICK_CHECKS.length >= 100, `quick-check bank too small: ${QUICK_CHECKS.length}`);
  const falses = QUICK_CHECKS.filter((q) => !q.truth).length;
  expect(falses >= 20 && falses <= QUICK_CHECKS.length - 40, `unbalanced verdicts: ${falses} false`);
  for (const q of QUICK_CHECKS) {
    if (q.check) expect(q.check() === q.truth, `${q.id}: numerical check gives ${q.check()}, statement says ${q.truth}`);
    if (q.formula) expect(Boolean(FORMULA_BY_ID[q.formula]), `${q.id}: unknown formula ${q.formula}`);
    for (const s of q.sources ?? []) expect(s.doc === "TIA" ? s.page >= 2 && s.page <= 15 : s.page >= 2 && s.page <= 5, `${q.id}: ${s.doc} page ${s.page} outside the sheet`);
    expect(TOPIC_ORDER.includes(q.topic), `${q.id}: unknown topic`);
    for (const markup of [q.text, q.why]) {
      const bad = markupTypesets(markup);
      expect(bad === null, `${q.id}: markup does not typeset: ${bad}`);
    }
  }
  for (const topic of TOPIC_ORDER) expect(QUICK_CHECKS.filter((q) => q.topic === topic).length >= 8, `${topic}: fewer than 8 quick checks`);
  expect(QUICK_CHECKS.filter((q) => q.check).length >= 40, "at least 40 statements are verified numerically");
});

// ---------------------------------------------------------------- persistence

test("study persistence: reviews schedule cards and attempts feed the overview", async () => {
  const now = new Date();
  const card = STUDY_CARDS.find((c) => c.deck === "formulas")!;
  const first = await reviewCard(card.id, "good", now);
  expect(first.reps === 1 && first.intervalDays === 1, "first review stored");
  const again = await reviewCard(card.id, "again", now);
  expect(again.reps === 0 && again.lapses === 1, "lapse stored");
  await recordStudyAttempt({ kind: "QUICK_CHECK", itemId: QUICK_CHECKS[0].id, topic: QUICK_CHECKS[0].topic, correct: false });
  await recordStudyAttempt({ kind: "DRILL", itemId: DRILL_ITEMS[0].id, topic: DRILL_ITEMS[0].topic, correct: true });
  await recordStudyAttempt({ kind: "STRATEGY", itemId: STRATEGY_QUESTIONS[0].id, topic: STRATEGY_QUESTIONS[0].topic, correct: false, detail: "mock:unanswered" });
  const overview = await studyOverview(now);
  expect(overview.decks.formulas.reviewed === 1, "one formula card reviewed");
  expect(overview.decks.formulas.due >= 1, "a forgotten card counts as due (inside the learn-ahead window)");
  expect(overview.quickChecks.attempts === 1 && overview.quickChecks.correct === 0, "quick-check attempt counted");
  expect(overview.quickChecks.missed.includes(QUICK_CHECKS[0].id), "missed quick check listed for review");
  expect(overview.drill.attempts === 1 && overview.drill.correct === 1, "drill attempt counted");
  expect(overview.strategy.attempts === 1 && overview.strategy.correct === 0, "strategy attempt counted");
  expect(overview.strategy.missed.includes(STRATEGY_QUESTIONS[0].id), "missed strategy question listed for review");
  expect(overview.strategy.byTopic[STRATEGY_QUESTIONS[0].topic].attempts === 1, "strategy attempt counted under its topic");
  let threw = false;
  try {
    await reviewCard("f:not-a-formula:recall", "good", now);
  } catch {
    threw = true;
  }
  expect(threw, "reviewing an unknown card is refused");
});
