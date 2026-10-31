import { buildQuestion } from "../../lib/engine/assemble";
import { evaluate, isEquation, solveEquation } from "../../lib/engine/expr";
import { formatAnswer } from "../../lib/engine/format";
import { getMisconception } from "../../lib/engine/misconceptions";
import { createRng } from "../../lib/engine/random";
import { TEMPLATES, TEMPLATE_BY_ID } from "../../lib/engine/templates";
import type { Difficulty, QuestionDraft, QuestionTemplate } from "../../lib/engine/types";
import { validateDraft } from "../../lib/engine/validate";
import { an, sn } from "../../lib/engine/finance";
import { close, expect, test } from "./harness";

const SEEDS = Number(process.env.BANK_SEEDS ?? 25);

test(`every template and level builds a validated question (${SEEDS} seeds each)`, () => {
  for (const template of TEMPLATES) {
    for (const level of template.levels) {
      for (let s = 0; s < SEEDS; s += 1) {
        const { instance } = buildQuestion(template, level, `bank-${s}`);
        expect(Boolean(instance), `${template.id} L${level} seed ${s} produced no valid question`);
        if (!instance) continue;
        const correct = instance.options.filter((o) => o.isCorrect);
        expect(instance.options.length === 5, `${template.id}: ${instance.options.length} options`);
        expect(correct.length === 1, `${template.id}: ${correct.length} correct options`);
        expect(instance.options.map((o) => o.key).join("") === "ABCDE", `${template.id}: keys`);
        expect(new Set(instance.options.map((o) => o.display)).size === 5, `${template.id}: duplicate displays`);
        expect(new Set(instance.options.map((o) => o.misconceptionTag)).size === 5, `${template.id}: repeated misconception`);
        expect(instance.validation.status === "PASSED" && instance.validation.checks.every((c) => c.ok), `${template.id}: validation record`);
        for (const option of instance.options.filter((o) => !o.isCorrect)) {
          const fields = [option.misconceptionTag, option.errorDescription, option.incorrectMethod, option.calculationDerivation, option.feedbackExplanation, option.targetSkill, option.recognitionTip];
          expect(fields.every((f) => typeof f === "string" && f.trim().length > 0), `${template.id}: incomplete metadata on ${option.misconceptionTag}`);
          expect(Boolean(getMisconception(option.misconceptionTag)), `${template.id}: unknown misconception ${option.misconceptionTag}`);
        }
        expect(!/Time Value of Money|Asset-Liability|Annuities and|Loans:|Bonds:/i.test(instance.stem), `${template.id}: topic label in stem`);
      }
    }
  }
});

test("exactly one option satisfies each question's independent equation of value", () => {
  for (const template of TEMPLATES) {
    for (const level of template.levels) {
      const { instance } = buildQuestion(template, level, "unique-check");
      if (!instance) continue;
      const truth = isEquation(instance.model.expr)
        ? solveEquation(instance.model.expr, instance.model.bracket ?? [instance.options.find((o) => o.isCorrect)!.value * 0.4, instance.options.find((o) => o.isCorrect)!.value * 1.6])[0]
        : evaluate(instance.model.expr);
      const matching = instance.options.filter((o) => formatAnswer(o.value, instance.format) === formatAnswer(truth, instance.format));
      expect(matching.length === 1 && matching[0].isCorrect, `${template.id} L${level}: ${matching.length} options match the model value ${truth}`);
    }
  }
});

test("each option's arithmetic recomputes to the value shown", () => {
  for (const template of TEMPLATES) {
    for (const level of template.levels) {
      const { instance } = buildQuestion(template, level, "calc-check");
      if (!instance) continue;
      for (const o of instance.options) {
        if (isEquation(o.calc)) continue;
        close(evaluate(o.calc), o.value, `${template.id} L${level} ${o.misconceptionTag}`, 1e-7);
      }
    }
  }
});

test("generation is deterministic for a given seed", () => {
  for (const template of TEMPLATES.slice(0, 12)) {
    const a = buildQuestion(template, template.levels[0], "same").instance!;
    const b = buildQuestion(template, template.levels[0], "same").instance!;
    expect(a.stem === b.stem && a.options.map((o) => o.display).join() === b.options.map((o) => o.display).join(), `${template.id} not deterministic`);
  }
});

test("different seeds give different presentations, not just different numbers in one position", () => {
  for (const template of TEMPLATES) {
    const stems = new Set<string>();
    for (let s = 0; s < 6; s += 1) stems.add(buildQuestion(template, template.levels[0], `variety-${s}`).instance?.stem ?? "");
    expect(stems.size >= 4, `${template.id} produced only ${stems.size} distinct stems from 6 seeds`);
  }
});

// ---------------------------------------------------------------- validator rejects bad questions

function fakeTemplate(mutate: (draft: QuestionDraft) => QuestionDraft): QuestionTemplate {
  const base = TEMPLATE_BY_ID["loan-running-balance"];
  return { ...base, id: "fake", generate: (rng, level) => mutate(base.generate(rng, level)) };
}

test("validator rejects a wrong answer key", () => {
  const bad = fakeTemplate((d) => ({ ...d, answer: { ...d.answer, value: d.answer.value * 1.03 } }));
  const result = buildQuestion(bad, 1, "x");
  expect(result.instance === null, "a question whose answer disagrees with its arithmetic was accepted");
  expect(result.rejected.length > 0 && result.rejected[0].checks.some((c) => !c.ok && c.name.includes("calc")), "rejection names the failed check");
});

test("validator rejects an answer that does not satisfy the equation of value", () => {
  const bad = fakeTemplate((d) => ({ ...d, model: { ...d.model, expr: `${d.model.expr} + 5` } }));
  expect(buildQuestion(bad, 1, "x").instance === null, "model disagreement accepted");
});

test("validator rejects a distractor equal to the answer (two correct options)", () => {
  const bad = fakeTemplate((d) => ({
    ...d,
    distractors: d.distractors.map((c, idx) => (idx < 2 ? { ...c, value: d.answer.value, calc: d.answer.calc } : c)),
  }));
  const draft = bad.generate(createRng("dup"), 1);
  const outcome = validateDraft(draft, { templateId: "fake", level: 1, seed: "dup" });
  expect(outcome.record.rejectedCandidates.filter((r) => r.reason.includes("correct answer")).length === 2, "duplicate-answer distractors not rejected");
  expect(!outcome.ok, "question with too few distinct distractors accepted");
});

test("validator rejects a distractor whose arithmetic does not match its value", () => {
  const bad = fakeTemplate((d) => ({ ...d, distractors: d.distractors.map((c) => ({ ...c, value: c.value + 50 })) }));
  expect(buildQuestion(bad, 1, "x").instance === null, "mismatched distractors accepted");
});

test("validator rejects markup that does not typeset", () => {
  const bad = fakeTemplate((d) => ({ ...d, explanation: { ...d.explanation, intuition: "Broken $\\frac{1}{$ maths" } }));
  expect(buildQuestion(bad, 1, "x").instance === null, "untypesettable markup accepted");
});

// ---------------------------------------------------------------- explicit mathematical traps

function draftsOf(id: string, level: Difficulty, count = 30) {
  const template = TEMPLATE_BY_ID[id];
  const out: QuestionDraft[] = [];
  for (let s = 0; s < count; s += 1) {
    try {
      out.push(template.generate(createRng(`trap|${id}|${s}`), level));
    } catch {
      // rejected parameter draw
    }
  }
  return out;
}

const trap = (d: QuestionDraft, id: string) => d.distractors.find((c) => c.misconception === id)!;
const p = (d: QuestionDraft, key: string) => Number(d.params[key]);

test("trap 1: interest applied to the payment instead of the outstanding balance", () => {
  // The spec's example: 10,000 at 10%, 2,000 paid at year end → 9,000.
  close(10000 * 1.1 - 2000, 9000, "correct balance");
  expect(Math.abs((10000 - 2000) * 1.1 - 9000) > 1, "deducting the payment first gives a different balance");
  for (const d of draftsOf("loan-running-balance", 1)) {
    const total = p(d, "p1") + p(d, "p2") + p(d, "p3");
    const t = trap(d, "MODEL_INTEREST_ON_PAYMENT");
    close(t.value, p(d, "L") - total * (1 - p(d, "i")), "interest-on-payment value");
    expect(Math.abs(t.value - d.answer.value) > 1, "trap equals the answer");
  }
});

test("trap 2: a combined interest amount treated as one account's interest", () => {
  for (const d of draftsOf("tvm-two-funds", 1)) {
    const t = trap(d, "ALLOC_AGGREGATE_AS_EACH");
    close(t.value, p(d, "I") / (p(d, "s") * p(d, "t")), "aggregate-as-each value");
    const combined = (x: number) => x * p(d, "s") * p(d, "t") + (p(d, "D") - x) * (Math.pow(1 + p(d, "j"), p(d, "t")) - 1);
    close(combined(d.answer.value), p(d, "I"), "correct deposit reproduces the combined interest", 1e-9);
    expect(Math.abs(combined(t.value) - p(d, "I")) > 1, "trap reproduces the combined interest");
  }
});

test("trap 3: forgetting the extra accumulation period of an annuity-due", () => {
  for (const d of draftsOf("ann-due-accumulation", 1)) {
    const t = trap(d, "TIMING_DUE_AS_IMMEDIATE");
    close(d.answer.value / t.value, 1 + p(d, "i"), "annuity-due is exactly (1 + i) times the immediate value");
  }
});

test("trap 4: a payment moved across the valuation date incorrectly", () => {
  for (const d of draftsOf("loan-running-balance", 2)) {
    const t = trap(d, "TIMING_VALUATION_DATE");
    expect(Math.abs(t.value - d.answer.value) / d.answer.value > 0.0075, "valuation-date trap too close to the answer");
    const residual = evaluate(d.model.expr, t.value);
    expect(Math.abs(residual) > 1, "valuation-date trap satisfies the equation of value");
  }
});

test("trap 5: an arithmetic sequence confused with a geometric one (both directions)", () => {
  for (const d of draftsOf("ann-arithmetic", 1)) {
    const t = trap(d, "SEQ_ARITHMETIC_AS_GEOMETRIC");
    expect(t.value > d.answer.value, "geometric growth with the same first step must exceed arithmetic");
  }
  for (const d of draftsOf("ann-geometric", 1)) {
    const t = trap(d, "SEQ_GEOMETRIC_AS_ARITHMETIC");
    expect(t.value < d.answer.value, "arithmetic growth with the same first step must fall short of geometric");
  }
});

test("trap 6: the right formula with a variable substituted wrongly", () => {
  for (const d of draftsOf("loan-level-balance", 1)) {
    const t = trap(d, "TIMING_BALANCE_INDEX");
    const n = p(d, "n");
    const k = p(d, "k");
    const P = p(d, "L") / an(n, p(d, "i"));
    close(t.value, P * an(n - k + 1, p(d, "i")), "n − k + 1 substituted for n − k", 1e-9);
  }
});

test("trap 7: the right equation with an algebra or arithmetic slip", () => {
  for (const d of draftsOf("tvm-two-funds", 1)) {
    const t = trap(d, "ALG_SIGN_ERROR");
    const c = Math.pow(1 + p(d, "j"), p(d, "t")) - 1;
    close(t.value, (p(d, "I") - p(d, "D") * c) / (p(d, "s") * p(d, "t") + c), "sign error in the x coefficient", 1e-9);
  }
  for (const d of draftsOf("alm-convexity", 1, 10)) {
    const t = trap(d, "ARITH_ORDER_OF_OPERATIONS");
    close(t.value / d.answer.value, Math.pow(1 + p(d, "i"), 2), "dropping v² multiplies convexity by (1 + i)²", 1e-9);
  }
});

test("trap 8: refinancing with the wrong number of remaining payments", () => {
  for (const d of draftsOf("loan-refinance", 2)) {
    const n = p(d, "n");
    const k = p(d, "k");
    const i = p(d, "i");
    const j = p(d, "j");
    const B = (p(d, "L") / an(n, i)) * an(n - k, i);
    close(d.answer.value, B / an(n - k, j), "correct refinanced payment", 1e-9);
    close(trap(d, "TIMING_REFINANCE_PERIODS").value, B / an(n - k + 1, j), "one extra remaining payment", 1e-9);
    close(trap(d, "MODEL_BALANCE_AT_NEW_RATE").value, (p(d, "L") * Math.pow(1 + j, k) - (p(d, "L") / an(n, i)) * sn(k, j)) / an(n - k, j), "balance at the new rate", 1e-9);
  }
});
