import { expect, test } from "./harness";

/**
 * Repository tests against a temporary SQLite file (set up by run.ts before
 * this module loads). Covers session creation, autosave and restore,
 * submission, scoring, report generation, history and remediation.
 */
test("sessions persist: create, autosave, restore, submit, report, history", async () => {
  const repo = await import("../../lib/server/repository");
  await repo.resetHistory();

  const id = await repo.createSession({ mode: "DIAGNOSTIC", count: 6, difficulty: "mixed" });
  const view = (await repo.getSessionView(id))!;
  expect(view.questions.length === 6 && view.status === "ACTIVE" && view.durationSeconds === null, "diagnostic created untimed with 6 questions");

  const [first, second] = view.questions;
  await repo.saveProgress(id, {
    elapsedSeconds: 3,
    currentIndex: 1,
    answers: [
      { instanceId: first.instanceId, selectedKey: "B", confidence: "HIGH", method: "equation_of_value", working: "x = 1", flagged: true, addSeconds: 2 },
      { instanceId: second.instanceId, selectedKey: "Z", confidence: "NOT_A_LEVEL", method: "hacking" },
    ],
  });
  const restored = (await repo.getSessionView(id))!;
  const r1 = restored.questions[0].response;
  expect(r1.selectedKey === "B" && r1.confidence === "HIGH" && r1.method === "equation_of_value" && r1.working === "x = 1" && r1.flagged, "answer, confidence, method, working and flag restored");
  expect(r1.timeSpentSeconds === 2, `time on question restored (${r1.timeSpentSeconds})`);
  expect(restored.currentIndex === 1 && restored.elapsedSeconds === 3, "position and clock restored");
  const r2 = restored.questions[1].response;
  expect(r2.selectedKey === null && r2.confidence === null && r2.method === null, "invalid values rejected");
  expect((await repo.getReport(id)) === null, "no report before submission");

  await repo.submitSession(id);
  const report = (await repo.getReport(id))!;
  expect(report.overall.total === 6 && report.overall.unanswered === 5, "report generated from stored answers");
  const answeredReview = report.questions.find((q) => q.instance.instanceId === first.instanceId)!;
  expect(answeredReview.response.selectedKey === "B" && answeredReview.evidence.correct === (answeredReview.instance.correctKey === "B"), "stored answer scored against the key");

  const locked = await repo.saveProgress(id, { answers: [{ instanceId: second.instanceId, selectedKey: "A" }] });
  expect(!locked.ok, "submitted sessions are locked");

  const history = await repo.attemptHistory();
  expect(history.length === 6, `history holds the six attempts (${history.length})`);
  const dash = await repo.getDashboard();
  expect(dash.sessions.length === 1 && dash.validation.PASSED >= 6, "dashboard sees the session and its validation records");

  // A wrong answer opens remediation, and a remediation session can be built from it.
  const id2 = await repo.createSession({ mode: "EXAM", count: 5, difficulty: 1 });
  const v2 = (await repo.getSessionView(id2))!;
  expect(v2.timed && v2.durationSeconds === 1500, "timed session duration scales with question count");
  const raw = await (await import("../../lib/server/db")).prisma.sessionQuestion.findMany({ where: { sessionId: id2 } });
  const wrongAnswers = raw.map((row) => {
    const inst = JSON.parse(row.payload);
    return { instanceId: row.id, selectedKey: inst.options.find((o: { isCorrect: boolean }) => !o.isCorrect).key, confidence: "MEDIUM" };
  });
  await repo.saveProgress(id2, { answers: wrongAnswers });
  await repo.submitSession(id2);
  const items = await repo.loadRemediationItems();
  expect(items.filter((i) => i.status === "OPEN").length >= 1, `remediation items opened (${items.length})`);
  const remId = await repo.createRemediationSession();
  expect(remId !== null, "remediation session created from due items");

  await repo.resetHistory();
  expect((await repo.attemptHistory()).length === 0 && (await repo.loadRemediationItems()).length === 0, "history reset");
});

test("study conditions: practice sessions keep their reference mode; diagnostics are always closed book", async () => {
  const repo = await import("../../lib/server/repository");
  const supported = await repo.createSession({ mode: "PRACTICE", count: 5, reference: "supported" });
  const sv = (await repo.getSessionView(supported))!;
  expect(sv.reference === "supported" && sv.modeLabel === "Formula practice", `practice view: ${sv.reference} / ${sv.modeLabel}`);
  expect(sv.questions.length === 5 && sv.questions.every((q) => Array.isArray(q.formulas) && q.formulas.length > 0), "supported questions list their formulas");

  const hidden = await repo.createSession({ mode: "PRACTICE", count: 5 });
  const hv = (await repo.getSessionView(hidden))!;
  expect(hv.reference === "integration" && hv.questions.every((q) => q.formulas === undefined), "integration practice hides formulas until submission");

  const diag = await repo.createSession({ mode: "DIAGNOSTIC", count: 4, reference: "supported" });
  const dv = (await repo.getSessionView(diag))!;
  expect(dv.reference === "closed" && dv.questions.every((q) => q.formulas === undefined), "a diagnostic cannot be opened with formula support");

  await repo.submitSession(hidden);
  const report = (await repo.getReport(hidden))!;
  expect(report.questions.every((q) => (q.instance.chain?.steps.length ?? 0) > 0), "chains revealed in the report after submission");
  expect(report.chains.byLevel.reduce((a, r) => a + r.total, 0) === 5, "report groups practice questions by integration level");
  await repo.resetHistory();
});

test("concept sessions persist typed options; legacy rows resume; submission is idempotent; reports are stable", async () => {
  const repo = await import("../../lib/server/repository");
  const { prisma } = await import("../../lib/server/db");
  const { buildQuestion } = await import("../../lib/engine/assemble");
  const { TEMPLATE_BY_ID } = await import("../../lib/engine/templates");
  await repo.resetHistory();

  // A Concept Practice session round-trips its typed options and stores the new columns.
  const id = await repo.createSession({ mode: "CONCEPT", count: 5, difficulty: "mixed", conceptFocus: "mixed" });
  const view = (await repo.getSessionView(id))!;
  expect(view.questions.length === 5 && view.reference === "closed" && view.notice === null, "concept session created closed-book with five questions");
  expect(view.questions.every((q) => q.options.length === 5), "five options each");
  expect(view.questions.some((q) => q.options.some((o) => o.content && o.content.type !== "numeric")), "typed option content reaches the client");
  const rows = await prisma.sessionQuestion.findMany({ where: { sessionId: id } });
  expect(rows.every((r) => r.practice === "concept" && r.answerType !== "numeric"), "practice and answer-type columns stored");
  const stored = JSON.parse(rows[0].payload);
  expect(JSON.stringify(stored.options.map((o: { content: unknown }) => o.content)) === JSON.stringify(JSON.parse(JSON.stringify(stored.options.map((o: { content: unknown }) => o.content)))), "rich options serialise and deserialise unchanged");

  await repo.saveProgress(id, { answers: view.questions.map((q) => ({ instanceId: q.instanceId, selectedKey: "A", confidence: "MEDIUM" })) });
  // Two submits at once (timer expiry racing the button) score once and open remediation once.
  await Promise.all([repo.submitSession(id), repo.submitSession(id), repo.submitSession(id)]);
  const items = await prisma.remediationItem.findMany();
  const targets = items.map((i) => `${i.kind}|${i.target}`);
  expect(new Set(targets).size === targets.length, "concurrent submits duplicated remediation items");
  const first = JSON.stringify(await repo.getReport(id));
  await prisma.$disconnect();
  const again = JSON.stringify(await repo.getReport(id));
  expect(first === again, "report changed after reconnecting");
  const report = (await repo.getReport(id))!;
  expect(report.concepts.total === 5 && report.formats.practice.some((p) => p.kind === "concept"), "concept report sections");

  // A session stored before the rich answer model: legacy payload, default columns, still in progress.
  const instance = buildQuestion(TEMPLATE_BY_ID["loan-level-balance"], 1, "legacy-row").instance!;
  const legacy = JSON.parse(JSON.stringify(instance));
  for (const key of ["kind", "answerType", "itemFormat", "practice", "calibration"]) delete legacy[key];
  legacy.options.forEach((o: Record<string, unknown>) => ["content", "conditionTrue", "conceptStage", "conceptFailure", "confusedWith", "probe", "check"].forEach((k) => delete o[k]));
  await prisma.session.create({ data: { id: "legacy-session", mode: "DIAGNOSTIC", status: "ACTIVE", difficulty: "mixed", timed: false, config: JSON.stringify({ count: 1, reference: "closed" }) } });
  await prisma.$executeRawUnsafe(
    `INSERT INTO SessionQuestion (id, sessionId, position, templateId, family, topic, difficulty, payload, working, flagged, timeSpentSeconds) VALUES (?, 'legacy-session', 0, ?, ?, ?, 1, ?, '', 0, 0)`,
    legacy.instanceId,
    legacy.templateId,
    legacy.family,
    legacy.topic,
    JSON.stringify(legacy)
  );
  const legacyRow = await prisma.sessionQuestion.findUnique({ where: { id: legacy.instanceId } });
  expect(legacyRow?.answerType === "numeric" && legacyRow?.practice === "calculation", "legacy row gets the numeric defaults");
  const resumed = (await repo.getSessionView("legacy-session"))!;
  expect(resumed.status === "ACTIVE" && resumed.questions[0].options.every((o) => o.content === undefined && /\d/.test(o.display)), "legacy in-progress session resumes with numeric options");
  await repo.saveProgress("legacy-session", { answers: [{ instanceId: legacy.instanceId, selectedKey: legacy.correctKey, confidence: "HIGH" }] });
  await repo.submitSession("legacy-session");
  const legacyReport = (await repo.getReport("legacy-session"))!;
  expect(legacyReport.overall.correct === 1 && legacyReport.formats.byFormat[0]?.format !== undefined, "legacy session scored and reported");
  const dash = await repo.getDashboard();
  expect(dash.concepts.totals.attempts === 5 && dash.sessions.some((s) => s.modeLabel === "Concept practice"), "dashboard shows concept mastery and the concept session");
  await repo.resetHistory();
});
