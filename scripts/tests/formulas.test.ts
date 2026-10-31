import katex from "katex";

import { formulaMastery } from "../../lib/analysis/formulas";
import { classifyAttempt, type AttemptRecord } from "../../lib/analysis/attempts";
import { buildReport } from "../../lib/analysis/report";
import { buildQuestion } from "../../lib/engine/assemble";
import { Da, Ia, Is, acc, adue, an, balanceProsp, balanceRetro, bondPrice, convexity, effToNom, effToNomDisc, geometricPV, macaulayConvexity, macaulayDuration, pvFlows, sdue, sn, v } from "../../lib/engine/finance";
import { BUCKET_LEVELS, DEFAULT_INTEGRATION_MIX, bucketCounts, buildSession, integrationLevelsOf, type IntegrationBucket } from "../../lib/engine/session";
import { TEMPLATES, TEMPLATE_BY_ID } from "../../lib/engine/templates";
import { integrationLevel, toPublicQuestion, type IntegrationLevel, type QuestionInstance } from "../../lib/engine/types";
import { NAMED_CHAINS, foundations } from "../../lib/formulas/graph";
import { FORMULAS, FORMULA_BY_ID } from "../../lib/formulas/registry";
import { OUTCOMES } from "../../lib/syllabus";
import { close, expect, test } from "./harness";

const PDF_PAGES = { TIA: 15, ACTEX: 5 } as const;

// ---------------------------------------------------------------- registry integrity

test("formula registry: unique ids, sources with pages, valid links and syllabus mapping", () => {
  const ids = FORMULAS.map((f) => f.id);
  expect(new Set(ids).size === ids.length, "duplicate formula id");
  for (const f of FORMULAS) {
    expect(f.sources.length > 0, `${f.id}: no source`);
    for (const s of f.sources) {
      if (s.doc === "DERIVED") continue;
      expect(s.page >= 1 && s.page <= PDF_PAGES[s.doc], `${f.id}: ${s.doc} page ${s.page} outside the PDF`);
      expect(s.section.length > 0 && s.notation.length > 0, `${f.id}: ${s.doc} source missing section or notation`);
    }
    if (f.area !== "M") expect(f.sources.some((s) => s.doc !== "DERIVED") || Boolean(f.relevanceNote), `${f.id}: an area A–G formula not printed on a sheet must say why it is included`);
    [...f.prerequisites, ...f.related].forEach((id) => expect(Boolean(FORMULA_BY_ID[id]), `${f.id}: links to unknown formula ${id}`));
    expect(!f.prerequisites.includes(f.id), `${f.id}: lists itself as a prerequisite`);
    f.outcomes.forEach((o) => expect(Boolean(OUTCOMES[o]), `${f.id}: unknown syllabus outcome ${o}`));
    if (f.relevance !== "unclear") expect(f.outcomes.length > 0, `${f.id}: core/supporting formula with no syllabus outcome`);
    else expect(Boolean(f.relevanceNote), `${f.id}: unclear relevance without a note`);
    expect(f.meaning.length > 10 && f.derivation.length > 5, `${f.id}: missing meaning or derivation`);
  }
});

test("formula registry: no prerequisite cycles", () => {
  for (const f of FORMULAS) expect(!foundations(f.id).includes(f.id), `${f.id} is its own foundation`);
});

test("formula registry: every expression and source notation typesets", () => {
  for (const f of FORMULAS) {
    for (const [label, tex] of [["expression", f.expression], ...f.sources.map((s) => [`${s.doc} notation`, s.notation]), ...f.alternativeNotations.map((n) => ["alternative", n])]) {
      try {
        katex.renderToString(tex, { throwOnError: true, strict: "ignore" });
      } catch (error) {
        expect(false, `${f.id} ${label}: ${(error as Error).message.slice(0, 80)}`);
      }
    }
  }
});

test("named chains reference real formulas", () => {
  for (const chain of NAMED_CHAINS) {
    chain.steps.forEach((s) => s.formula && expect(Boolean(FORMULA_BY_ID[s.formula]), `${chain.id}: unknown formula ${s.formula}`));
  }
});

// ---------------------------------------------------------------- equivalence of forms the sheets write differently

test("equivalent forms agree numerically before being cross-referenced", () => {
  for (const i of [0.03, 0.065, 0.12]) {
    const d = i / (1 + i);
    for (const n of [5, 12, 30]) {
      const brute = (f: (t: number) => number, from: number, to: number) => {
        let s = 0;
        for (let t = from; t <= to; t += 1) s += f(t);
        return s;
      };
      close(1 / an(n, i), 1 / sn(n, i) + i, `1/a = 1/s + i (n=${n}, i=${i})`);
      close(1 / adue(n, i), 1 / sdue(n, i) + d, `1/ä = 1/s̈ + d`);
      close((1 - v(i, n)) / d, adue(n, i), "ä = (1 − v^n)/d");
      close(1 + an(n - 1, i), adue(n, i), "ä = 1 + a_{n−1}");
      close(Ia(n, i), brute((t) => t * v(i, t), 1, n), "(Ia) closed form = sum");
      close(Da(n, i), brute((t) => (n - t + 1) * v(i, t), 1, n), "(Da) closed form = sum");
      close(Is(n, i), brute((t) => t * acc(i, n - t), 1, n), "(Is) closed form = sum");
      close(Ia(n, i) + Da(n, i), (n + 1) * an(n, i), "(Ia) + (Da) = (n+1)a");
      for (const g of [0.02, 0.05]) {
        const tia = geometricPV(n, i, g);
        const actex = v(i, 1) * brute((t) => Math.pow((1 + g) * v(i, 1), t), 0, n - 1);
        close(tia, actex, `geometric annuity TIA vs ACTEX form (g=${g})`);
        close(tia * (1 + i), brute((t) => Math.pow(1 + g, t) * v(i, t), 0, n - 1), "geometric annuity-due = (1+i) × immediate");
      }
      // Loan balance: retrospective = prospective.
      const P = 1000 / an(n, i);
      for (const k of [1, Math.floor(n / 2), n - 1]) close(balanceRetro(1000, P, i, k), balanceProsp(P, i, n, k), `retrospective = prospective balance (k=${k})`);
    }
    // Rates.
    close(i - d, i * d, "i − d = id");
    close(d, i * v(i, 1), "d = iv");
    for (const m of [2, 4, 12]) {
      const im = effToNom(i, m);
      const dm = effToNomDisc(i, m);
      close(Math.pow(1 + im / m, m), Math.pow(1 - dm / m, -m), `(1 + i^(m)/m)^m = (1 − d^(m)/m)^−m (m=${m})`);
      close(im - dm, (im * dm) / m, `i^(m) − d^(m) = i^(m)d^(m)/m`);
    }
    // Increasing perpetuity: 1/i + 1/i² = (1+i)/i² = limit of (Ia)_n.
    close(1 / i + 1 / (i * i), (1 + i) / (i * i), "(Ia)∞ forms");
    close(Ia(4000, i), (1 + i) / (i * i), "(Ia)_n → (Ia)∞", 1e-6);
    // Bonds: basic, premium/discount and Makeham give the same price.
    for (const [F, r, C, n] of [
      [1000, 0.05, 1000, 10],
      [1000, 0.08, 1100, 7],
    ] as const) {
      const basic = F * r * an(n, i) + C * v(i, n);
      const g = (F * r) / C;
      const K = C * v(i, n);
      close(bondPrice(F, r, C, i, n), basic, "bondPrice = basic formula");
      close(C + (F * r - C * i) * an(n, i), basic, "premium/discount formula");
      close(K + (g / i) * (C - K), basic, "Makeham's formula");
    }
    // Duration and convexity identities.
    const flows = [1, 2, 3, 5, 8].map((t) => ({ t, amount: 100 + 20 * t }));
    const P0 = pvFlows(flows, i);
    const h = 1e-5;
    const dP = (pvFlows(flows, i + h) - pvFlows(flows, i - h)) / (2 * h);
    const d2P = (pvFlows(flows, i + h) - 2 * P0 + pvFlows(flows, i - h)) / (h * h);
    close(-dP / P0, macaulayDuration(flows, i) / (1 + i), "modified duration = −P′/P = D/(1+i)", 1e-6);
    close(d2P / P0, convexity(flows, i), "convexity = P″/P", 1e-4);
    close(convexity(flows, i), (macaulayConvexity(flows, i) + macaulayDuration(flows, i)) / Math.pow(1 + i, 2), "C = (C_mac + D_mac)/(1+i)²", 1e-9);
    const delta = Math.log(1 + i);
    const pvDelta = (x: number) => flows.reduce((s, f) => s + f.amount * Math.exp(-x * f.t), 0);
    close(-(pvDelta(delta + h) - pvDelta(delta - h)) / (2 * h) / P0, macaulayDuration(flows, i), "Macaulay duration = −dP/dδ / P", 1e-6);
  }
  // Spot / forward chain.
  const s1 = 0.03, s2 = 0.035, s3 = 0.042;
  const f1 = Math.pow(1 + s2, 2) / (1 + s1) - 1;
  const f2 = Math.pow(1 + s3, 3) / Math.pow(1 + s2, 2) - 1;
  close((1 + s1) * (1 + f1) * (1 + f2), Math.pow(1 + s3, 3), "(1+s1)(1+f1)(1+f2) = (1+s3)^3");
});

// ---------------------------------------------------------------- formula chains in the bank

test("every template-level carries a formula chain that ends at the answer, with traps placed in the chain", () => {
  for (const t of TEMPLATES) {
    for (const level of t.levels) {
      for (let s = 0; s < 4; s += 1) {
        const q = buildQuestion(t, level, `chain-${s}`).instance;
        if (!q) {
          expect(false, `${t.id}@${level} seed ${s}: no question`);
          continue;
        }
        const steps = q.chain.steps;
        expect(steps.length > 0, `${t.id}@${level}: empty chain`);
        steps.forEach((st) => expect(Boolean(FORMULA_BY_ID[st.formula]) && FORMULA_BY_ID[st.formula].relevance !== "unclear", `${t.id}@${level}: formula ${st.formula} missing or of unclear relevance`));
        const correct = q.options.find((o) => o.isCorrect)!;
        const last = steps[steps.length - 1].output.value;
        expect(Math.abs(last - correct.value) <= 1e-6 * Math.max(1, Math.abs(correct.value)), `${t.id}@${level}: chain ends at ${last}, answer ${correct.value}`);
        for (const o of q.options.filter((x) => !x.isCorrect)) {
          expect(o.chainStage !== null && o.chainStage! >= 0 && o.chainStage! < steps.length, `${t.id}@${level}: option ${o.misconceptionTag} stage ${o.chainStage}`);
          expect(!o.wrongFormula || Boolean(FORMULA_BY_ID[o.wrongFormula]), `${t.id}@${level}: unknown wrong formula ${o.wrongFormula}`);
        }
        expect(q.integration === integrationLevel(q.chain), `${t.id}@${level}: stored integration level differs from the chain`);
      }
    }
  }
});

test("the bank covers every integration level and the formulas of every named chain", () => {
  const levels = new Map<IntegrationLevel, number>();
  const used = new Set<string>();
  for (const t of TEMPLATES) {
    for (const level of t.levels) {
      integrationLevelsOf(t, level).forEach((l) => levels.set(l, (levels.get(l) ?? 0) + 1));
      const q = buildQuestion(t, level, "coverage").instance;
      q?.chain.steps.forEach((s) => used.add(s.formula));
      q?.options.forEach((o) => o.wrongFormula && used.add(o.wrongFormula));
    }
  }
  ([1, 2, 3, 4, 5] as IntegrationLevel[]).forEach((l) => expect((levels.get(l) ?? 0) >= 3, `integration level ${l}: only ${levels.get(l) ?? 0} template-levels`));
  for (const chain of NAMED_CHAINS) {
    const missing = chain.steps.filter((s) => s.formula && !used.has(s.formula)).map((s) => s.formula);
    expect(missing.length <= 1, `${chain.id} chain: formulas never used by the bank — ${missing.join(", ")}`);
  }
});

// ---------------------------------------------------------------- formula-integration practice

test("integration mix: largest-remainder counts and practice sessions that follow them", () => {
  const c10 = bucketCounts(10, DEFAULT_INTEGRATION_MIX);
  expect(c10.single === 2 && c10.pair === 4 && c10.multi === 3 && c10.reconstruct === 1, `10 → ${JSON.stringify(c10)}`);
  const c7 = bucketCounts(7, DEFAULT_INTEGRATION_MIX);
  expect(Object.values(c7).reduce((a, b) => a + b, 0) === 7, "7 questions sum to 7");
  const custom = bucketCounts(10, { single: 0, pair: 0, multi: 50, reconstruct: 50 });
  expect(custom.multi === 5 && custom.reconstruct === 5 && custom.single === 0, `custom → ${JSON.stringify(custom)}`);
  for (const [count, seed] of [
    [10, "p1"],
    [10, "p2"],
    [20, "p3"],
  ] as const) {
    const { questions } = buildSession({ mode: "PRACTICE", count, difficulty: "mixed", seed, integrationMix: DEFAULT_INTEGRATION_MIX });
    expect(questions.length === count, `${seed}: ${questions.length} questions`);
    expect(new Set(questions.map((q) => q.templateId)).size === count, `${seed}: repeated template`);
    const expected = bucketCounts(count, DEFAULT_INTEGRATION_MIX);
    for (const bucket of Object.keys(expected) as IntegrationBucket[]) {
      const got = questions.filter((q) => BUCKET_LEVELS[bucket].includes(q.integration)).length;
      expect(got === expected[bucket], `${seed}: ${bucket} has ${got}, expected ${expected[bucket]}`);
    }
    expect(new Set(questions.map((q) => q.topic)).size >= 4, `${seed}: practice set should span topics`);
  }
});

test("reference modes: closed book reveals nothing, supported lists formulas unordered", () => {
  const q = buildQuestion(TEMPLATE_BY_ID["int-refi-rate"], 2, "ref").instance!;
  const closed = toPublicQuestion(q);
  expect(!("formulas" in closed), "closed-book question exposes formulas");
  const text = JSON.stringify(closed);
  expect(!text.includes("chain") && !text.includes("D.loan-payment"), "closed-book payload leaks the chain");
  const supported = toPublicQuestion(q, { revealFormulas: true });
  const sorted = [...(supported.formulas ?? [])].sort();
  expect(JSON.stringify(sorted) === JSON.stringify(supported.formulas), "formula list is sorted, not in chain order");
  expect(new Set(supported.formulas).size === new Set(q.chain.steps.map((s) => s.formula)).size, "formula list complete");
});

// ---------------------------------------------------------------- chain diagnosis and formula mastery

function attempt(instance: QuestionInstance, key: string | null, position = 0, extra: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    questionId: `${instance.instanceId}-${position}`,
    sessionId: "s",
    mode: "PRACTICE",
    position,
    submittedAt: new Date(Date.UTC(2026, 9, 1, 0, position)).toISOString(),
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

test("a wrong answer is located at its step of the formula chain", () => {
  const q = buildQuestion(TEMPLATE_BY_ID["int-refi-rate"], 2, "diag").instance!;
  const wrong = q.options.find((o) => o.misconceptionTag === "TIMING_BALANCE_INDEX") ?? q.options.find((o) => !o.isCorrect)!;
  const e = classifyAttempt(attempt(q, wrong.key));
  expect(e.chainStage === wrong.chainStage && e.chainError === wrong.chainError, "stage and kind copied from the option");
  expect(e.chainFormula === q.chain.steps[wrong.chainStage!].formula, "formula at the failing step");
  expect(e.observed.some((line) => line.includes(`step ${wrong.chainStage! + 1} of ${q.chain.steps.length}`)), "observed evidence names the step");
  const right = classifyAttempt(attempt(q, q.correctKey));
  expect(right.chainStage === null && right.chainError === null, "a correct answer has no chain break");
  const report = buildReport(
    { id: "r", mode: "PRACTICE", difficulty: "mixed", timed: false, durationSeconds: null, elapsedSeconds: 100, createdAt: "", submittedAt: new Date().toISOString() },
    [attempt(q, wrong.key, 0), attempt(q, q.correctKey, 1)]
  );
  expect(report.chains.breaks.length === 1 && report.chains.breaks[0].stage === wrong.chainStage, "report lists the break");
  expect(report.chains.byKind.length === 1 && report.chains.byKind[0].count === 1, "report tallies the kind");
  expect(report.chains.byLevel.reduce((a, r) => a + r.total, 0) === 2, "report groups by integration level");
});

test("formula mastery: earlier steps pass, the failing step fails, later steps are unknown", () => {
  const q = buildQuestion(TEMPLATE_BY_ID["int-price-change"], 2, "mastery").instance!;
  const steps = q.chain.steps.map((s) => s.formula);
  const wrong = q.options.find((o) => !o.isCorrect && o.chainStage === 1) ?? q.options.find((o) => !o.isCorrect && (o.chainStage ?? 0) > 0)!;
  const k = wrong.chainStage!;
  const { formulas } = formulaMastery([attempt(q, wrong.key)]);
  const by = (id: string) => formulas.find((f) => f.formula === id)!;
  steps.slice(0, k).forEach((id) => expect(by(id).passes === 1 && by(id).fails === 0, `${id} before the break should pass`));
  expect(by(steps[k]).fails === 1, `${steps[k]} at the break should fail`);
  steps.slice(k + 1).forEach((id) => expect(by(id).passes + by(id).fails === 0, `${id} after the break should be unknown`));
});

test("formula mastery: reproduction alone is not mastery", () => {
  const base = buildQuestion(TEMPLATE_BY_ID["int-payoff-between"], 2, "repro").instance!;
  const single = (n: number): QuestionInstance => ({
    ...base,
    instanceId: `single-${n}`,
    templateId: `single-template-${n}`,
    features: { ...base.features, unfamiliar: false },
    chain: { ...base.chain, steps: [{ ...base.chain.steps[0], formula: "B.annuity-immediate", output: { ...base.chain.steps[0].output, value: base.options.find((o) => o.isCorrect)!.value } }], methods: [], unconventional: false },
  });
  const history = [0, 1, 2, 3].map((n) => attempt(single(n), base.correctKey, n));
  const status = formulaMastery(history).formulas.find((f) => f.formula === "B.annuity-immediate")!;
  expect(status.passes === 4 && status.status !== "MASTERED", `four plain reproductions gave ${status.status}`);
  expect(status.reason.includes("combination") && status.reason.includes("unfamiliar"), `reason should name what is missing: ${status.reason}`);
  const combined: QuestionInstance = {
    ...base,
    instanceId: "combined",
    templateId: "combined-template",
    features: { ...base.features, unfamiliar: true },
    chain: { ...base.chain, steps: [{ ...base.chain.steps[0], formula: "B.annuity-immediate" }, ...base.chain.steps.slice(1)] },
  };
  const after = formulaMastery([...history, attempt(combined, base.correctKey, 9)]).formulas.find((f) => f.formula === "B.annuity-immediate")!;
  expect(after.status === "MASTERED", `with a combined, unfamiliar use: ${after.status} (${after.reason})`);
});

test("formula mastery: choosing a substituted formula counts against recognising when it does not apply", () => {
  for (const t of TEMPLATES) {
    for (const level of t.levels) {
      const q = buildQuestion(t, level, "na").instance;
      const option = q?.options.find((o) => o.wrongFormula);
      if (!q || !option) continue;
      const { formulas } = formulaMastery([attempt(q, option.key)]);
      expect(formulas.find((f) => f.formula === option.wrongFormula)!.dimensions.notApplicable.fail === 1, "not-applicable failure recorded");
      return;
    }
  }
  expect(false, "no option in the bank substitutes a formula");
});
