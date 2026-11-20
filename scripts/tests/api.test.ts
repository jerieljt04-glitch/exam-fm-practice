/**
 * API contract and history storage: request schemas reject bad input,
 * route handlers return the right statuses, analytics snapshots match a fresh
 * computation, history paginates, and a backup restores exactly.
 */
import { expect, test } from "./harness";

async function answerAndSubmit(repo: typeof import("../../lib/server/repository"), id: string, correctEvery = 2) {
  const { prisma } = await import("../../lib/server/db");
  const raw = await prisma.sessionQuestion.findMany({ where: { sessionId: id }, orderBy: { position: "asc" } });
  const answers = raw.map((row, k) => {
    const inst = JSON.parse(row.payload) as { options: Array<{ key: string; isCorrect: boolean }> };
    const option = k % correctEvery === 0 ? inst.options.find((o) => o.isCorrect)! : inst.options.find((o) => !o.isCorrect)!;
    return { instanceId: row.id, selectedKey: option.key, confidence: "MEDIUM" };
  });
  await repo.saveProgress(id, { answers });
  await repo.submitSession(id);
}

test("api: request schemas reject malformed and out-of-range input with a reason", async () => {
  const { CreateSessionBody, ProgressBody, ResetHistoryBody, StudyReviewBody } = await import("../../lib/api/schemas");
  expect(CreateSessionBody.safeParse({ mode: "EXAM", difficulty: "hard" }).success, "valid exam body accepted");
  expect(CreateSessionBody.safeParse({ mode: "EXAM", difficulty: "2" }).success, "numeric-string difficulty accepted");
  expect(!CreateSessionBody.safeParse({ mode: "HACK" }).success, "unknown mode rejected");
  expect(!CreateSessionBody.safeParse({ mode: "EXAM", count: 500 }).success, "count above 60 rejected");
  expect(!CreateSessionBody.safeParse({ mode: "EXAM", extra: 1 }).success, "unknown field rejected");
  expect(!ProgressBody.safeParse({ answers: [{ instanceId: "x", selectedKey: "Z" }] }).success, "option outside A–E rejected");
  expect(!ProgressBody.safeParse({ answers: [{ instanceId: "x", confidence: "NOT_A_LEVEL" }] }).success, "unknown confidence rejected");
  expect(!ResetHistoryBody.safeParse({}).success && ResetHistoryBody.safeParse({ confirm: "ERASE_ALL_HISTORY" }).success, "history reset needs the confirmation token");
  expect(!StudyReviewBody.safeParse({ cardId: "a", rating: "superb" }).success, "unknown rating rejected");
});

test("api: route handlers return 400, 404 and 409 rather than a blanket 404 or 500", async () => {
  const repo = await import("../../lib/server/repository");
  await repo.resetHistory();
  const post = (body: unknown) => new Request("http://local/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const sessions = await import("../../app/api/sessions/route");
  expect((await sessions.POST(post("{not json"))).status === 400, "malformed JSON is a 400");
  expect((await sessions.POST(post({ mode: "NOPE" }))).status === 400, "invalid mode is a 400");
  const created = await sessions.POST(post({ mode: "DIAGNOSTIC", count: 3 }));
  expect(created.status === 201, `session creation is a 201 (${created.status})`);
  const { id } = (await created.json()) as { id: string };

  const one = await import("../../app/api/sessions/[id]/route");
  expect((await one.GET(new Request("http://local"), { params: { id: "missing" } })).status === 404, "unknown session is a 404");
  expect((await one.PATCH(post({ answers: [{ instanceId: "q", selectedKey: "Q" }] }), { params: { id } })).status === 400, "bad progress patch is a 400");
  expect((await one.PATCH(post({ elapsedSeconds: 5 }), { params: { id: "missing" } })).status === 404, "saving to an unknown session is a 404");

  const report = await import("../../app/api/sessions/[id]/report/route");
  expect((await report.GET(new Request("http://local"), { params: { id } })).status === 409, "report of an active session is a 409");
  const history = await import("../../app/api/history/route");
  expect((await history.DELETE(new Request("http://local", { method: "DELETE" }))).status === 400, "reset without confirmation is a 400");
  expect((await (await import("../../app/api/remediation/route")).POST()).status === 409, "nothing due for remediation is a 409");
  await repo.resetHistory();
});

test("api: opening an expired timed session reports it without submitting it", async () => {
  const repo = await import("../../lib/server/repository");
  const { prisma } = await import("../../lib/server/db");
  await repo.resetHistory();
  const id = await repo.createSession({ mode: "EXAM", count: 2, difficulty: 1 });
  await prisma.session.update({ where: { id }, data: { elapsedSeconds: 99999 } });
  const view = (await repo.getSessionView(id))!;
  expect(view.expired && view.status === "ACTIVE", "expired flagged, still active after a read");
  await repo.resetHistory();
});

test("history: stored analytics match a fresh computation and refresh after a submission", async () => {
  const repo = await import("../../lib/server/repository");
  const { prisma } = await import("../../lib/server/db");
  await repo.resetHistory();
  const a = await repo.createSession({ mode: "EXAM", count: 6, difficulty: 1 });
  await answerAndSubmit(repo, a);
  const first = await repo.getAnalytics();
  const stored = await prisma.snapshot.findUnique({ where: { key: "dashboard-analytics" } });
  expect(stored !== null && stored.version === (await repo.historyVersion()), "analytics stored with the current history version");
  expect(JSON.stringify(JSON.parse(stored!.data)) === JSON.stringify(first), "stored analytics survive a JSON round trip unchanged");
  expect(first.totals.attempts === 6, `analytics count the 6 answers (${first.totals.attempts})`);
  const b = await repo.createSession({ mode: "EXAM", count: 4, difficulty: 1 });
  await answerAndSubmit(repo, b, 1);
  const second = await repo.getAnalytics();
  expect(second.totals.attempts === 10 && second.totals.correct === first.totals.correct + 4, `analytics refreshed after a new submission (${second.totals.attempts})`);
  expect(second.readiness.sample === 10 && second.readiness.estimate !== null, "readiness estimated from SOA-standard exam questions");
  await repo.resetHistory();
});

test("history: paginates submitted sessions and exports then restores everything exactly", async () => {
  const repo = await import("../../lib/server/repository");
  await repo.resetHistory();
  for (let k = 0; k < 5; k += 1) await answerAndSubmit(repo, await repo.createSession({ mode: "DIAGNOSTIC", count: 2, difficulty: "mixed" }));
  const p1 = await repo.sessionHistory(1, 2);
  const p3 = await repo.sessionHistory(3, 2);
  expect(p1.total === 5 && p1.pages === 3 && p1.rows.length === 2 && p3.rows.length === 1, `pagination (${p1.total} total, ${p1.pages} pages)`);
  expect((await repo.sessionHistory(99, 2)).page === 3, "out-of-range page clamps to the last page");
  const trend = await repo.scoreTrend();
  expect(trend.length === 5 && trend.every((t) => t.score >= 0 && t.score <= 1), "score trend has one point per submitted session");

  const backup = JSON.parse(JSON.stringify(await repo.exportHistory()));
  const before = await repo.getAnalytics();
  await repo.resetHistory();
  expect((await repo.sessionHistory(1)).total === 0, "history cleared");
  const restored = await repo.restoreHistory(backup);
  expect(restored.sessions === 5 && restored.questions === 10, `restore counts (${restored.sessions}, ${restored.questions})`);
  const after = await repo.getAnalytics();
  expect(after.totals.attempts === before.totals.attempts && after.totals.correct === before.totals.correct, "analytics identical after restore");
  await repo.resetHistory();
});
