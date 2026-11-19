/**
 * Rich answer model, typed-option validation, Concept Practice, the
 * calibration rubric, Challenge strictness and syllabus coverage.
 */
import { buildChoiceQuestion, buildQuestion } from "../../lib/engine/assemble";
import { contentDisplay, normalizedContent, optionContent, statementsLabel, type OptionContent } from "../../lib/engine/answers";
import { conceptMastery } from "../../lib/analysis/concepts";
import { classifyAttempt, type AttemptRecord } from "../../lib/analysis/attempts";
import { formulaMastery } from "../../lib/analysis/formulas";
import { masteryByObjective } from "../../lib/analysis/mastery";
import { applySession, remediationTargets } from "../../lib/analysis/remediation";
import { buildReport, calibrationOf } from "../../lib/analysis/report";
import { getConcept } from "../../lib/concepts/registry";
import { getMisconception } from "../../lib/engine/misconceptions";
import { createRng } from "../../lib/engine/random";
import { buildSession, matchesFocus, type ConceptFocus } from "../../lib/engine/session";
import { STYLE_MIX } from "../../lib/engine/style";
import { ALL_TEMPLATES, ANY_TEMPLATE_BY_ID, CHOICE_TEMPLATES, CONCEPT_TEMPLATES, TEMPLATES, TEMPLATE_BY_ID } from "../../lib/engine/templates";
import { conceptQuestion, math, text } from "../../lib/engine/concepts/kit";
import {
  CONCEPT_FAILURES,
  isChoiceTemplate,
  toPublicQuestion,
  type ChoiceDraft,
  type ChoiceInstance,
  type ChoiceTemplate,
  type Difficulty,
  type NumericInstance,
  type QuestionInstance,
} from "../../lib/engine/types";
import { validateChoiceDraft } from "../../lib/engine/validate-choice";
import { EXAM_DISTRIBUTION, OUTCOMES, TOPICS, TOPIC_ORDER } from "../../lib/syllabus";
import { expect, test } from "./harness";

const CHOICE_SEEDS = Number(process.env.CHOICE_SEEDS ?? 6);
const CHALLENGE_SEEDS = Number(process.env.CHALLENGE_SEEDS ?? 100);

const RECOGNITION = new Set(["definition", "interpretation", "notation"]);
const conceptTemplates = CONCEPT_TEMPLATES;

// ---------------------------------------------------------------- 1. syllabus

test("syllabus: 42 outcomes, valid topic weights, every outcome covered by the bank", () => {
  const outcomes = Object.keys(OUTCOMES);
  expect(outcomes.length === 42, `${outcomes.length} outcomes`);
  const total = Object.values(EXAM_DISTRIBUTION).reduce((a, b) => a + b, 0);
  for (const t of TOPICS) {
    const share = EXAM_DISTRIBUTION[t.id] / total;
    expect(share >= t.weight.min - 1e-9 && share <= t.weight.max + 1e-9, `${t.id} weight ${share}`);
  }
  for (const o of outcomes) expect(ALL_TEMPLATES.some((t) => t.objective === o || t.secondary.includes(o)), `${o} has no template`);
});

test("syllabus: every outcome has Concept Practice coverage — standard and higher level, recognition and application", () => {
  for (const o of Object.keys(OUTCOMES)) {
    const own = conceptTemplates.filter((t) => t.objective === o);
    expect(own.length > 0, `${o}: no concept template`);
    expect(own.some((t) => t.levels.includes(1)), `${o}: no SOA-standard concept question`);
    expect(own.some((t) => t.levels.includes(2) || t.levels.includes(3)), `${o}: no higher-difficulty concept question`);
    expect(own.some((t) => RECOGNITION.has(t.conceptFamily ?? "")), `${o}: no recognition/interpretation archetype`);
    expect(own.some((t) => !RECOGNITION.has(t.conceptFamily ?? "") || t.itemFormat === "equation-selection"), `${o}: no application/equation/error/relationship archetype`);
  }
});

test("syllabus: every outcome and topic is represented at Level 3 (Challenge)", () => {
  for (const o of Object.keys(OUTCOMES)) {
    expect(ALL_TEMPLATES.some((t) => t.levels.includes(3) && (t.objective === o || t.secondary.includes(o))), `${o}: no Level-3 template`);
  }
  for (const topic of TOPIC_ORDER) {
    const numeric = TEMPLATES.filter((t) => t.topic === topic && t.levels.includes(3)).length;
    expect(numeric >= 5, `${topic}: only ${numeric} Level-3 numerical templates`);
  }
});

// ---------------------------------------------------------------- 2. answer types

test("answer types: every content type displays, normalises and reads old numeric records", () => {
  const contents: OptionContent[] = [
    { type: "numeric", value: 1234.5, format: { kind: "money", decimals: 2 } },
    { type: "numeric", value: 0.0525, format: { kind: "percent", decimals: 2 } },
    { type: "numeric", value: 8.4213, format: { kind: "time", decimals: 2, unit: "years" } },
    { type: "text", text: "The value at time $t$ of the remaining payments" },
    { type: "math", latex: "1000(1.05)^{t} = 1500" },
    { type: "statements", keys: ["I", "III"] },
    { type: "composite", style: "ordered-pair", parts: [{ label: "Interest", value: 412.5, format: { kind: "money", decimals: 2 } }, { label: "Principal", value: 587.5, format: { kind: "money", decimals: 2 } }] },
    { type: "composite", style: "allocation", parts: [{ label: "Bond X", value: 4000, format: { kind: "money", decimals: 0 } }, { label: "Bond Y", value: 6000, format: { kind: "money", decimals: 0 } }] },
    { type: "table", columns: ["Year", "Payment"], rows: [["1", "100"], ["2", "200"]] },
  ];
  const displays = contents.map((c) => contentDisplay(c));
  expect(displays[0] === "1,234.50" && displays[1] === "5.25%" && displays[2] === "8.42 years", `numeric displays ${displays.slice(0, 3).join(" | ")}`);
  expect(displays[5] === "I and III only", `statements display ${displays[5]}`);
  expect(displays[6] === "(412.50, 587.50)", `ordered pair ${displays[6]}`);
  expect(displays[7] === "Bond X: 4,000; Bond Y: 6,000", `allocation ${displays[7]}`);
  expect(!displays[4].includes("^") && !displays[3].includes("$"), "math and text have plain-text forms");
  expect(statementsLabel(["I", "II", "III"], 3) === "I, II, and III" && statementsLabel([], 3) === "None", "statement labels");
  expect(new Set(contents.map(normalizedContent)).size === contents.length, "distinct contents normalise distinctly");
  expect(normalizedContent(text("The Value  at time $t$.")) === normalizedContent(text("the value at time $t$")), "case/spacing/punctuation ignored");
  const legacy = { value: 99.5, display: "99.50" };
  const read = optionContent(legacy, { kind: "money", decimals: 2 });
  expect(read.type === "numeric" && read.value === 99.5, "old option without content reads as numeric");
});

test("answer types: every typed template builds valid five-option questions on every level and variant", () => {
  const typesSeen = new Set<string>();
  for (const template of CHOICE_TEMPLATES) {
    for (const level of template.levels) {
      for (let variant = 0; variant < template.variants; variant += 1) {
        for (let s = 0; s < CHOICE_SEEDS; s += 1) {
          const { instance } = buildChoiceQuestion(template, level, `bank-${s}`, { variant });
          expect(Boolean(instance), `${template.id} L${level} v${variant} seed ${s}: no valid question`);
          if (!instance) continue;
          typesSeen.add(instance.answerType);
          const tag = `${template.id} L${level} v${variant}`;
          expect(instance.options.length === 5 && instance.options.map((o) => o.key).join("") === "ABCDE", `${tag}: options`);
          expect(instance.options.filter((o) => o.isCorrect).length === 1, `${tag}: correct count`);
          expect(new Set(instance.options.map((o) => o.misconceptionTag)).size === 5, `${tag}: repeated misconception`);
          expect(new Set(instance.options.map((o) => normalizedContent(o.content!))).size === 5, `${tag}: duplicate options`);
          expect(instance.options.every((o) => o.content?.type === instance.answerType), `${tag}: mixed content types`);
          expect(instance.validation.status === "PASSED", `${tag}: validation record`);
          for (const o of instance.options.filter((x) => !x.isCorrect)) {
            expect(Boolean(getMisconception(o.misconceptionTag)) && o.feedbackExplanation.trim().length > 0 && o.recognitionTip.trim().length > 0, `${tag}: incomplete distractor ${o.misconceptionTag}`);
            if (instance.concept) {
              expect(o.conceptStage !== null && o.conceptStage! >= 0 && o.conceptStage! < instance.concept.steps.length, `${tag}: stage of ${o.misconceptionTag}`);
              expect(CONCEPT_FAILURES.includes(o.conceptFailure!), `${tag}: failure kind of ${o.misconceptionTag}`);
            }
          }
          if (template.practice === "concept") {
            expect(Boolean(instance.concept && instance.concept.steps.length && instance.concept.conditions.length), `${tag}: concept chain`);
            instance.concept?.concepts.forEach((c) => expect(Boolean(getConcept(c)), `${tag}: unknown concept ${c}`));
          }
        }
      }
    }
  }
  for (const type of ["text", "math", "statements"]) expect(typesSeen.has(type), `no typed template produces ${type} options`);
});

test("answer types: typed generation is deterministic for a seed and variants change the presentation", () => {
  for (const template of CHOICE_TEMPLATES) {
    const level = template.levels[0];
    const a = buildChoiceQuestion(template, level, "det", { variant: 0 }).instance!;
    const b = buildChoiceQuestion(template, level, "det", { variant: 0 }).instance!;
    expect(a.stem === b.stem && a.options.map((o) => o.display).join() === b.options.map((o) => o.display).join(), `${template.id}: not deterministic`);
    if (template.variants > 1 && template.practice === "concept") {
      const stems = new Set<string>();
      const structures = new Set<string>();
      for (let v = 0; v < template.variants; v += 1) {
        for (const l of template.levels) {
          const q = buildChoiceQuestion(template, l, "det", { variant: v }).instance;
          if (!q) continue;
          stems.add(q.stem.replace(/[\d.,]+/g, "#"));
          structures.add(q.options.map((o) => o.display.replace(/[\d.,]+/g, "#")).sort().join("|"));
        }
      }
      expect(stems.size > 1 || structures.size > 1, `${template.id}: variants differ only in numbers`);
    }
  }
});

test("answer types: correct answers are not concentrated in one option position", () => {
  const positions = [0, 0, 0, 0, 0];
  for (const template of ALL_TEMPLATES) {
    for (const level of template.levels) {
      for (let s = 0; s < 3; s += 1) {
        const q = isChoiceTemplate(template) ? buildChoiceQuestion(template, level, `pos-${s}`).instance : buildQuestion(template, level, `pos-${s}`).instance;
        if (q) positions["ABCDE".indexOf(q.correctKey)] += 1;
      }
    }
  }
  const total = positions.reduce((a, b) => a + b, 0);
  positions.forEach((n, k) => expect(n / total >= 0.1 && n / total <= 0.32, `position ${"ABCDE"[k]} holds ${((100 * n) / total).toFixed(1)}% of correct answers`));
});

// ---------------------------------------------------------------- 3. validation

const probeTemplate = ANY_TEMPLATE_BY_ID["con-tvm-equation-select"] as ChoiceTemplate;
const statementTemplate = ANY_TEMPLATE_BY_ID["con-alm-duration-statements"] as ChoiceTemplate;
const checkTemplate = ANY_TEMPLATE_BY_ID["con-ann-due-diagnosis"] as ChoiceTemplate;
const ctx = { level: 1 as Difficulty, seed: "v" };
const failed = (draft: ChoiceDraft, template: ChoiceTemplate) => validateChoiceDraft(draft, template, ctx);

test("validation: exactly one correct answer — a distractor whose claim also holds is rejected", () => {
  const d = checkTemplate.generate(createRng("one"), 1, 0);
  d.distractors.forEach((x) => (x.check = d.correct.check));
  expect(!failed(d, checkTemplate).ok, "draft with several true diagnoses accepted");
});

test("validation: duplicate semantic options are rejected", () => {
  const d = checkTemplate.generate(createRng("dup"), 1, 0);
  d.distractors = [{ ...d.distractors[0], content: text((d.correct.content as { text: string }).text.toUpperCase()) }, ...d.distractors.slice(1)];
  const r = failed(d, checkTemplate);
  expect(r.record.rejectedCandidates.some((c) => /normalisation/.test(c.reason)), "upper-cased copy of the correct option not rejected");
});

test("validation: equivalent equations are recognised", () => {
  const d = probeTemplate.generate(createRng("eq"), 1, 0);
  // The same equation of value written at time 0 instead of time t: same root, different appearance.
  const p = d.params as { X: number; Y: number; n: number; Z: number; i: number };
  d.distractors[0] = { ...d.distractors[0], content: math(`${p.X} + ${p.Y}v^{${p.n}} = ${p.Z}v^{t}`), probe: `(${p.X} + ${p.Y}*(1+${p.i})**(-${p.n}) - ${p.Z}*(1+${p.i})**(-x))` };
  const r = failed(d, probeTemplate);
  expect(r.record.rejectedCandidates.some((c) => /equivalent to the correct/.test(c.reason)), "an equivalent equation was accepted as a distractor");
});

test("validation: invalid markup is rejected", () => {
  const d = probeTemplate.generate(createRng("mk"), 1, 0);
  d.stem = `${d.stem} $\\frac{1}{$`;
  const r = failed(d, probeTemplate);
  expect(!r.ok && r.record.checks.some((c) => c.name === "all markup typesets" && !c.ok), "broken LaTeX accepted");
});

test("validation: contradictory statement truth metadata is rejected", () => {
  const d = statementTemplate.generate(createRng("st"), 2, 1);
  const checked = d.statements!.find((s) => s.check)!;
  checked.truth = !checked.truth;
  const r = failed(d, statementTemplate);
  expect(!r.ok && r.record.checks.some((c) => /agrees with its independent check/.test(c.name) && !c.ok), "a statement contradicting its check was accepted");
  const d2 = statementTemplate.generate(createRng("st2"), 1, 0);
  d2.correct = { ...d2.correct, content: { type: "statements", keys: ["II"] } };
  expect(!failed(d2, statementTemplate).ok, "a correct combination that is not the set of true statements was accepted");
});

test("validation: incorrect composite answers are rejected component by component", () => {
  const fmt = { kind: "money" as const, decimals: 2 as const };
  const pair = (a: number, b: number): OptionContent => ({ type: "composite", style: "ordered-pair", parts: [{ label: "Interest", value: a, format: fmt }, { label: "Principal", value: b, format: fmt }] });
  const draft: ChoiceDraft = {
    ...conceptQuestion({
      stem: "A loan of 10000 at 5% is repaid by a payment of 1500 at the end of year 1. Calculate the interest and principal in that payment.",
      correct: { content: pair(500, 1000), why: "Interest 0.05 × 10000; the rest is principal.", calc: ["0.05*10000", "1500-0.05*10000"] },
      distractors: [
        { content: pair(575, 925), misconception: "MODEL_INTEREST_ON_PAYMENT", why: "x", calc: ["0.05*1500+500", "1500-575"], stage: 0, failure: "selection" },
        { content: pair(1000, 500), misconception: "ALLOC_SWAPPED", why: "x", calc: ["1500-0.05*10000", "0.05*10000"], stage: 0, failure: "connection" },
        { content: pair(750, 750), misconception: "ALLOC_EVEN_SPLIT", why: "x", calc: ["1500/2", "1500/2"], stage: 0, failure: "application" },
        { content: pair((10000 * 0.05) / 1.05, 1500 - (10000 * 0.05) / 1.05), misconception: "RATE_DISCOUNT_AS_INTEREST", why: "x", calc: ["10000*0.05/1.05", "1500-10000*0.05/1.05"], stage: 0, failure: "application" },
      ],
      steps: [{ concept: "loan.interest-principal-split", reasoning: "Interest first, then principal." }],
      conditions: ["Annual effective 5%."],
      relationship: "$I_1 = iL$",
      transfer: { principle: "p", unusual: "u", misread: "m" },
      reference: { values: [{ label: "interest", expr: "10000*1.05-10000" }, { label: "principal", expr: "1500-(10000*1.05-10000)" }], description: "Explicit balance roll-forward." },
    }),
    itemFormat: "ordered-pair",
  };
  const t = { ...checkTemplate, id: "composite-test", objective: "LOANS.payment_components", topic: "LOANS" as const, secondary: [], practice: "calculation" as const };
  const ok = validateChoiceDraft(draft, t, ctx);
  expect(ok.ok, `valid composite rejected: ${ok.record.checks.filter((c) => !c.ok).map((c) => `${c.name} ${c.detail ?? ""}`).join("; ")}`);
  const wrongRef = { ...draft, correct: { ...draft.correct, content: pair(500, 1001), calc: ["0.05*10000", "1501-0.05*10000"] } };
  expect(!validateChoiceDraft(wrongRef, t, ctx).ok, "a correct option disagreeing with the reference in one component was accepted");
  const wrongCalc = { ...draft, distractors: [{ ...draft.distractors[0], calc: ["0.05*1500+500", "1500-500"] }, ...draft.distractors.slice(1)] };
  expect(validateChoiceDraft(wrongCalc, t, ctx).record.rejectedCandidates.some((c) => /component 2/.test(c.reason)), "a distractor whose second component does not match its arithmetic was accepted");
});

test("validation: concept chains are required and every distractor is placed at a real step", () => {
  const d = statementTemplate.generate(createRng("cc"), 1, 0);
  const noChain = { ...d, concept: undefined };
  expect(!failed(noChain, statementTemplate).ok, "concept question without a concept chain accepted");
  const badConcept = { ...d, concept: { ...d.concept!, concepts: ["no.such.concept"] } };
  expect(!failed(badConcept, statementTemplate).ok, "unknown concept accepted");
  const offChain = { ...d, distractors: d.distractors.map((x) => ({ ...x, stage: 99 })) };
  expect(!failed(offChain, statementTemplate).ok, "distractor stages outside the chain accepted");
});

test("validation: the public payload never leaks the answer, misconception, explanation or chains", () => {
  const instances: QuestionInstance[] = [buildQuestion(TEMPLATE_BY_ID["bond-price"], 1, "leak").instance!];
  for (const t of CHOICE_TEMPLATES) {
    const q = buildChoiceQuestion(t, t.levels[0], "leak").instance;
    if (q) instances.push(q);
  }
  const forbidden = ["isCorrect", "misconception", "correctKey", "explanation", "chain", "concept", "statements", "truth", "justification", "feedback", "probe", "check", "calc", "conditionTrue", "validation"];
  for (const q of instances) {
    const view = toPublicQuestion(q);
    const json = JSON.stringify(view);
    const keys = new Set<string>();
    JSON.parse(json, (k, v) => (k && keys.add(k), v));
    const leaked = forbidden.filter((f) => keys.has(f));
    expect(leaked.length === 0, `${q.templateId}: public payload has ${leaked.join(", ")}`);
    expect(view.options.length === 5, `${q.templateId}: options missing`);
    if (q.kind === "choice" && q.statements) {
      const truths = q.statements.map((s) => s.justification);
      expect(truths.every((j) => !json.includes(j)), `${q.templateId}: statement justification leaked`);
    }
  }
});

// ---------------------------------------------------------------- 4. sessions

test("sessions: exam simulation is 30 SOA-standard questions on the 3/7/6/6/8 blueprint with a 20–30% non-numerical share", () => {
  const band = STYLE_MIX.EXAM!;
  for (let s = 0; s < 8; s += 1) {
    const { questions, shortfall } = buildSession({ mode: "EXAM", count: 30, difficulty: 1, seed: `exam-style-${s}` });
    expect(questions.length === 30 && shortfall === null, `seed ${s}: ${questions.length} questions`);
    const counts: Record<string, number> = {};
    questions.forEach((q) => (counts[q.topic] = (counts[q.topic] ?? 0) + 1));
    for (const [topic, n] of Object.entries(EXAM_DISTRIBUTION)) expect(counts[topic] === n, `seed ${s}: ${topic} ${counts[topic]} ≠ ${n}`);
    expect(questions.every((q) => q.difficulty === 1), `seed ${s}: non-standard level`);
    expect(new Set(questions.map((q) => q.templateId)).size === 30, `seed ${s}: repeated template`);
    const typed = questions.filter((q) => q.kind === "choice").length / 30;
    expect(typed >= band.min - 1e-9 && typed <= band.max + 1e-9, `seed ${s}: non-numerical share ${typed}`);
    expect(new Set(questions.map((q) => q.itemFormat)).size >= 4, `seed ${s}: only ${new Set(questions.map((q) => q.itemFormat)).size} formats`);
  }
});

test(`sessions: challenge sessions of 5, 8, 10, 12 and 15 are entirely Level 3 (${CHALLENGE_SEEDS} seeds for 15)`, () => {
  let downgraded = 0;
  let short = 0;
  for (const size of [5, 8, 10, 12, 15]) {
    const seeds = size === 15 ? CHALLENGE_SEEDS : Math.max(10, Math.round(CHALLENGE_SEEDS / 4));
    for (let s = 0; s < seeds; s += 1) {
      const { questions, shortfall } = buildSession({ mode: "CHALLENGE", count: size, difficulty: 3, seed: `challenge-${size}-${s}` });
      if (questions.some((q) => q.difficulty !== 3)) downgraded += 1;
      if (questions.length !== size || shortfall) short += 1;
      if (new Set(questions.map((q) => q.templateId)).size !== questions.length) expect(false, `size ${size} seed ${s}: repeated template`);
      if (size === 15 && s < 10) {
        const topics = new Set(questions.map((q) => q.topic));
        expect(topics.size === 5, `size 15 seed ${s}: only ${topics.size} topics`);
      }
    }
  }
  expect(downgraded === 0, `${downgraded} challenge sessions contained a non-Level-3 question`);
  expect(short === 0, `${short} challenge sessions were short`);
});

test("sessions: a difficulty shortage produces a disclosed shorter session, never a downgrade", () => {
  // 60 Level-3 calculation questions is more than the bank holds distinct templates for in one topic mix.
  const { questions, shortfall } = buildSession({ mode: "CHALLENGE", count: 200, difficulty: 3, seed: "too-many" });
  expect(questions.every((q) => q.difficulty === 3), "a Level-2 or Level-1 question filled a shortage");
  expect(shortfall !== null && shortfall.built === questions.length && shortfall.requested === 200, "the shortage is not disclosed");
});

test("sessions: concept sessions build at 5, 10, 15 and 20 questions with every focus and topic filter", () => {
  for (const count of [5, 10, 15, 20]) {
    const { questions, shortfall } = buildSession({ mode: "CONCEPT", count, difficulty: "mixed", seed: `concept-${count}`, conceptFocus: "mixed" });
    expect(questions.length === count && shortfall === null, `${count}: built ${questions.length}`);
    expect(questions.every((q) => q.kind === "choice" && q.practice === "concept"), `${count}: non-concept question`);
    expect(new Set(questions.map((q) => q.templateId)).size === count, `${count}: repeated template`);
    if (count >= 10) expect(new Set(questions.map((q) => q.topic)).size === 5, `${count}: topics not spread`);
  }
  for (const focus of ["definitions", "equations", "statements", "errors"] as ConceptFocus[]) {
    const { questions } = buildSession({ mode: "CONCEPT", count: 10, difficulty: "mixed", seed: `focus-${focus}`, conceptFocus: focus });
    expect(questions.length === 10, `${focus}: ${questions.length} questions`);
    expect(questions.every((q) => matchesFocus(ANY_TEMPLATE_BY_ID[q.templateId] as ChoiceTemplate, focus)), `${focus}: question outside the focus`);
    const keys = questions.map((q) => `${q.templateId}|${(q as ChoiceInstance).variant}`);
    expect(new Set(keys).size === keys.length, `${focus}: the same presentation twice`);
  }
  for (const topic of TOPIC_ORDER) {
    const { questions } = buildSession({ mode: "CONCEPT", count: 10, difficulty: "mixed", seed: `topic-${topic}`, topic });
    expect(questions.length === 10 && questions.every((q) => q.topic === topic), `${topic}: topic filter`);
  }
  for (const level of [1, 2, 3] as Difficulty[]) {
    const { questions, shortfall } = buildSession({ mode: "CONCEPT", count: 10, difficulty: level, seed: `concept-level-${level}` });
    expect(questions.every((q) => q.difficulty === level), `concept level ${level}: other level present`);
    expect(questions.length === 10 || shortfall !== null, `concept level ${level}: short without disclosure`);
  }
});

test("sessions: no template repeats while alternatives exist; diagnostics mix formats", () => {
  for (let s = 0; s < 6; s += 1) {
    const { questions } = buildSession({ mode: "DIAGNOSTIC", count: 15, difficulty: "mixed", seed: `diag-${s}` });
    expect(new Set(questions.map((q) => q.templateId)).size === 15, `diag ${s}: repeated template`);
    expect(questions.some((q) => q.kind === "choice") && questions.some((q) => q.kind !== "choice"), `diag ${s}: no format mix`);
  }
});

// ---------------------------------------------------------------- 5. calibration

test("calibration: every Level-3 question meets the Challenge rubric and every Level-1 question the standard rubric", () => {
  for (const template of ALL_TEMPLATES) {
    for (const level of template.levels.filter((l) => l !== 2)) {
      const variants = isChoiceTemplate(template) ? template.variants : 1;
      for (let v = 0; v < variants; v += 1) {
        for (let s = 0; s < 2; s += 1) {
          const q = isChoiceTemplate(template) ? buildChoiceQuestion(template, level, `rubric-${s}`, { variant: v }).instance : buildQuestion(template, level, `rubric-${s}`).instance;
          if (!q) continue;
          const c = q.calibration!;
          expect(c.rubric.meets, `${template.id} L${level} v${v}: ${c.rubric.reasons.join("; ")}`);
          expect(c.basis.measured.length > 0 && c.basis.inferred.length > 0, `${template.id}: basis not recorded`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------- 6. analysis and reports

function attempt(instance: QuestionInstance, key: string | null, extra: Partial<AttemptRecord> = {}, position = 0): AttemptRecord {
  return {
    questionId: `${instance.instanceId}-${position}`,
    sessionId: extra.sessionId ?? "s",
    mode: "CONCEPT",
    position,
    submittedAt: new Date().toISOString(),
    instance,
    selectedKey: key,
    confidence: "MEDIUM",
    method: null,
    methodNote: null,
    working: "",
    timeSpentSeconds: 90,
    isCorrect: Boolean(instance.options.find((o) => o.key === key)?.isCorrect),
    ...extra,
  };
}

/** A numeric question as stored before the rich answer model: no kind, answer type, format tags, calibration or content. */
function legacy(instance: NumericInstance): QuestionInstance {
  const copy = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;
  for (const key of ["kind", "answerType", "itemFormat", "practice", "calibration", "exhibits"]) delete copy[key];
  (copy.options as Array<Record<string, unknown>>).forEach((o) => {
    delete o.content;
    delete o.conditionTrue;
    delete o.conceptStage;
    delete o.conceptFailure;
    delete o.confusedWith;
    delete o.probe;
    delete o.check;
  });
  return copy as unknown as QuestionInstance;
}

test("reports: old numeric records render; concept findings, formats and calibration appear for new ones", () => {
  const old = legacy(buildQuestion(TEMPLATE_BY_ID["ann-level-payment"], 1, "legacy").instance!);
  const concept = buildChoiceQuestion(statementTemplate, 1, "r").instance!;
  const wrong = concept.options.find((o) => !o.isCorrect)!;
  const meta = { id: "r", mode: "DIAGNOSTIC", difficulty: "mixed", timed: false, durationSeconds: null, elapsedSeconds: 300, createdAt: new Date().toISOString(), submittedAt: new Date().toISOString() };
  const report = buildReport(meta, [attempt(old, old.correctKey, {}, 0), attempt(concept, wrong.key, {}, 1)]);
  expect(report.overall.total === 2 && report.overall.correct === 1, "scoring");
  const numericFormats = ["direct-calculation", "inverse-calculation", "unknown-rate-term"];
  expect(
    report.formats.split.find((r) => r.kind === "numerical")?.total === 1 && report.formats.byFormat.some((f) => numericFormats.includes(f.format)),
    "old question classified as a numerical calculation"
  );
  expect(report.concepts.total === 1 && report.concepts.byFailure.length === 1, "concept failure located");
  expect(report.questions[0].instance.calibration === undefined && calibrationOf(report.questions[0].instance).reasoningSteps >= 1, "old question calibrated on read");
  expect(report.confidence.table.reduce((a, r) => a + r.total, 0) === 2, "confidence calibration includes the concept question");
  const e = classifyAttempt(attempt(concept, wrong.key));
  expect(e.conceptStage === wrong.conceptStage && e.conceptFailure === wrong.conceptFailure, "evidence carries the concept failure");
});

test("reports: formula mastery and concept mastery are separate", () => {
  const concept = buildChoiceQuestion(probeTemplate, 1, "sep").instance!;
  const calc = buildQuestion(TEMPLATE_BY_ID["bond-price"], 1, "sep").instance!;
  const conceptOnly = [attempt(concept, concept.correctKey, {}, 0), attempt(concept, concept.correctKey, {}, 1)];
  const fm = formulaMastery(conceptOnly);
  expect(fm.formulas.every((f) => f.uses === 0), "a concept answer counted as formula use");
  expect(masteryByObjective(conceptOnly).every((m) => m.attempts === 0), "a concept answer counted as calculation mastery");
  const cm = conceptMastery([attempt(calc, calc.correctKey, { mode: "EXAM" }), ...conceptOnly]);
  expect(cm.totals.attempts === 2, `concept mastery counted ${cm.totals.attempts} attempts (calculation leaked in)`);
  expect(cm.byDimension.some((d) => d.success > 0), "concept dimensions credited");
  expect(cm.versus.find((v) => v.topic === "BONDS")!.calculation.attempts === 1, "concept-versus-calculation split");
  const wrong = concept.options.find((o) => !o.isCorrect && o.confusedWith) ?? concept.options.find((o) => !o.isCorrect)!;
  const cm2 = conceptMastery([attempt(concept, wrong.key)]);
  expect(cm2.misconceptions[0]?.id === wrong.misconceptionTag && cm2.byFailure.length === 1, "conceptual misconception and failure tallied");
});

test("remediation: a conceptual failure is retested with a conceptually different question", () => {
  const source = buildChoiceQuestion(checkTemplate, 1, "rem").instance!;
  const wrong = source.options.find((o) => !o.isCorrect)!;
  const items = applySession([], [attempt(source, wrong.key)], new Date());
  const item = items.find((i) => i.kind === "CONCEPT");
  expect(Boolean(item) && item!.target === wrong.misconceptionTag, "no CONCEPT remediation item opened");
  const targets = remediationTargets(items, new Date());
  expect(targets.length === 2 && targets.every((t) => t.conceptual && t.avoidTemplates?.includes(source.templateId)), "conceptual targets");
  const { questions } = buildSession({ mode: "REMEDIATION", count: targets.length, difficulty: "mixed", seed: "rem", targets });
  expect(questions.length >= 1 && questions.every((q) => q.templateId !== source.templateId && q.kind === "choice" && q.practice === "concept"), "retest drawn from a different concept template");
  const sourceFamily = (ANY_TEMPLATE_BY_ID[source.templateId] as ChoiceTemplate).conceptFamily;
  expect(
    questions.some((q) => (ANY_TEMPLATE_BY_ID[q.templateId] as ChoiceTemplate).conceptFamily !== sourceFamily || q.itemFormat !== source.itemFormat),
    "retest is the same kind of question with new numbers"
  );
});
