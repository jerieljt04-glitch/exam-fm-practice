/**
 * End-to-end check against a running server: `npx ts-node scripts/e2e.ts http://127.0.0.1:4199`.
 * Drives the HTTP API exactly as the browser does — start, answer, autosave,
 * resume, submit, report, remediation, transfer — and asserts on the results.
 * Run it against a server using a throwaway database (EXAM_FM_DATABASE_URL).
 */
const base = process.argv[2] ?? "http://127.0.0.1:4199";
let failures = 0;
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${message}`);
  if (!ok) failures += 1;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // HTML page
  }
  return { status: res.status, body, text };
}

const FORBIDDEN_KEYS = [
  "isCorrect", "misconceptionTag", "explanation", "correctKey", "topic", "difficulty", "objective", "validation", "calc", "feedbackExplanation",
  "statements", "truth", "justification", "concept", "conceptStage", "conceptFailure", "conditionTrue", "probe", "check", "chain",
];

function leaks(view: any): string[] {
  const found = new Set<string>();
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (FORBIDDEN_KEYS.includes(k)) found.add(k);
        walk(v);
      }
    }
  };
  walk(view.questions);
  return [...found];
}

async function answerAll(id: string, view: any, fraction = 1) {
  const answers = view.questions.slice(0, Math.round(view.questions.length * fraction)).map((q: any, idx: number) => ({
    instanceId: q.instanceId,
    selectedKey: "ABCDE"[idx % 5],
    confidence: ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"][idx % 5],
    method: idx % 2 ? "equation_of_value" : null,
    working: idx % 3 === 0 ? "B = 10000(1.05) - 2000 = 8500" : "",
    flagged: idx % 7 === 0,
    addSeconds: 3,
  }));
  return api(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ elapsedSeconds: 2, currentIndex: 3, answers }) });
}

async function main() {
  console.log(`E2E against ${base}`);

  const before = (await api("/api/history")).body.sessions.filter((s: any) => s.status === "SUBMITTED").length;
  const home = await api("/");
  check(home.status === 200 && home.text.includes("Exam FM Practice") && home.text.includes("Start exam simulation"), "dashboard renders");
  const lab = await api("/lab");
  check(lab.status === 200 && lab.text.includes("Visual lab"), "visual lab renders");

  // ---------------------------------------------------------------- exam simulation
  const created = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "EXAM" }) });
  check(created.status === 200 && typeof created.body.id === "string", "exam simulation created");
  const examId = created.body.id;
  const view = (await api(`/api/sessions/${examId}`)).body;
  check(view.questions.length === 30, `exam has 30 questions (${view.questions.length})`);
  check(view.timed && view.durationSeconds === 9000, "exam is timed at 150 minutes");
  check(view.questions.every((q: any) => q.options.length === 5), "every question has five options");
  check(leaks(view).length === 0, `active session leaks no answer data (${leaks(view).join(", ") || "none"})`);
  check(!/Time Value of Money|Asset-Liability|General Cash Flows/.test(JSON.stringify(view)), "no topic labels in the payload");
  const reportEarly = await api(`/api/sessions/${examId}/report`);
  check(reportEarly.status === 404, "no report while the session is active");

  const saved = await answerAll(examId, view, 0.7);
  check(saved.status === 200 && saved.body.ok, "autosave accepted");
  const resumed = (await api(`/api/sessions/${examId}`)).body;
  const answered = resumed.questions.filter((q: any) => q.response.selectedKey).length;
  check(answered === 21, `progress restored after reload (${answered} answered)`);
  check(resumed.currentIndex === 3, "current question restored");
  check(resumed.elapsedSeconds >= 2 && resumed.elapsedSeconds <= 10, `elapsed time stored (${resumed.elapsedSeconds}s)`);
  const tooFar = await api(`/api/sessions/${examId}`, { method: "PATCH", body: JSON.stringify({ elapsedSeconds: 99999 }) });
  check(tooFar.body.elapsedSeconds < 60, "server refuses to jump the clock beyond wall time");
  const page = await api(`/session/${examId}`);
  const pageText = page.text.replace(/<!-- -->/g, "");
  check(page.status === 200 && pageText.includes("Question 4 of 30") && pageText.includes("Confidence"), "exam page renders at the saved question");

  const submitted = await api(`/api/sessions/${examId}/submit`, { method: "POST", body: JSON.stringify({}) });
  check(submitted.status === 200, "exam submitted");
  const report = (await api(`/api/sessions/${examId}/report`)).body;
  check(report.overall.total === 30 && report.overall.unanswered === 9, `report totals (${report.overall.correct} correct, ${report.overall.unanswered} unanswered)`);
  const topics = Object.fromEntries(report.byTopic.map((t: any) => [t.topic, t.total]));
  check(topics.TVM === 3 && topics.ANNUITIES === 7 && topics.LOANS === 6 && topics.BONDS === 6 && topics.ALM === 8, `topic split 3/7/6/6/8 (${JSON.stringify(topics)})`);
  check(report.byDifficulty.find((d: any) => d.level === 1).total === 30, "exam at SOA standard is all level 1");
  check(report.questions.every((q: any) => q.instance.validation.status === "PASSED"), "every question carries a passed validation record");
  check(report.reasoning.length === 14, "reasoning profile covers 14 skills");
  check(new Set(report.questions.map((q: any) => q.instance.templateId)).size === 30, "no template repeated");
  const reportPage = await api(`/session/${examId}/report`);
  check(reportPage.status === 200 && reportPage.text.includes("Diagnostic report"), "report page renders");
  const resubmit = await api(`/api/sessions/${examId}`, { method: "PATCH", body: JSON.stringify({ answers: [{ instanceId: view.questions[25].instanceId, selectedKey: "A" }] }) });
  check(resubmit.body.ok === false, "answers are locked after submission");

  // ---------------------------------------------------------------- diagnostic and challenge
  const diag = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "DIAGNOSTIC" }) });
  const diagView = (await api(`/api/sessions/${diag.body.id}`)).body;
  check(diagView.questions.length === 15 && !diagView.timed && diagView.durationSeconds === null, "diagnostic defaults to 15 untimed questions");
  await answerAll(diag.body.id, diagView);
  await api(`/api/sessions/${diag.body.id}/submit`, { method: "POST", body: "{}" });

  const challenge = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "CHALLENGE", count: 15, difficulty: 3 }) });
  const chView = (await api(`/api/sessions/${challenge.body.id}`)).body;
  check(chView.questions.length === 15 && chView.notice === null, "15-question challenge session created without a shortfall");
  check(leaks(chView).length === 0, "challenge view reveals nothing about the answers");
  await answerAll(challenge.body.id, chView);
  await api(`/api/sessions/${challenge.body.id}/submit`, { method: "POST", body: "{}" });
  const chReport = (await api(`/api/sessions/${challenge.body.id}/report`)).body;
  const level3 = chReport.byDifficulty.find((d: any) => d.level === 3).total;
  check(level3 === 15, `challenge is entirely level 3 (${level3} of 15)`);

  // ---------------------------------------------------------------- concept practice
  check(home.text.includes("Concept practice") && home.text.includes("Start concept practice"), "dashboard offers concept practice");
  const concept = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "CONCEPT", count: 10, difficulty: "mixed", focus: "mixed" }) });
  check(concept.status === 200, "concept session generated");
  const coView = (await api(`/api/sessions/${concept.body.id}`)).body;
  check(coView.questions.length === 10 && coView.reference === "closed" && coView.modeLabel === "Concept practice", "concept session: 10 closed-book questions");
  check(leaks(coView).length === 0, `concept view reveals nothing about the answers (${leaks(coView).join(", ") || "clean"})`);
  const typedKinds = new Set(coView.questions.flatMap((q: any) => q.options.map((o: any) => o.content?.type)).filter(Boolean));
  check(typedKinds.size >= 2, `concept options are typed content (${[...typedKinds].join(", ")})`);
  await answerAll(concept.body.id, coView, 0.6);
  const coResumed = (await api(`/api/sessions/${concept.body.id}`)).body;
  check(coResumed.questions.filter((q: any) => q.response.selectedKey).length === 6, "concept answers autosaved and resumed");
  await api(`/api/sessions/${concept.body.id}/submit`, { method: "POST", body: "{}" });
  await api(`/api/sessions/${concept.body.id}/submit`, { method: "POST", body: "{}" });
  const coReport = (await api(`/api/sessions/${concept.body.id}/report`)).body;
  check(coReport.concepts.total === 10 && coReport.overall.total === 10, "concept report built (double submit harmless)");
  check(coReport.questions.every((q: any) => q.instance.concept?.steps.length > 0), "concept chains revealed after submission");
  const focused = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "CONCEPT", count: 5, difficulty: 1, focus: "statements", topic: "ALM" }) });
  const fView = (await api(`/api/sessions/${focused.body.id}`)).body;
  check(focused.status === 200 && fView.focusLabel === "Statement analysis" && fView.questions.length >= 1, `focused concept session (${fView.questions.length} questions${fView.notice ? `, notice: ${fView.notice}` : ""})`);
  const conceptPage = await api(`/session/${concept.body.id}/report`);
  check(conceptPage.status === 200, "concept report page renders");

  // ---------------------------------------------------------------- formula practice and study conditions
  const formulasPage = await api("/formulas");
  check(formulasPage.status === 200 && formulasPage.text.includes("Formula library") && formulasPage.text.includes("Refinancing chain"), "formula library renders with the named chains");
  check(home.text.includes("Start formula practice"), "dashboard offers formula practice");

  const practice = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "PRACTICE", count: 10, reference: "integration", integrationMix: { single: 20, pair: 40, multi: 30, reconstruct: 10 } }) });
  check(practice.status === 200, "formula practice created");
  const prView = (await api(`/api/sessions/${practice.body.id}`)).body;
  check(prView.questions.length === 10 && prView.reference === "integration", `practice has 10 questions in integration mode (${prView.reference})`);
  check(!JSON.stringify(prView).includes('"chain"') && prView.questions.every((q: any) => q.formulas === undefined), "formula chain hidden until submission");
  await answerAll(practice.body.id, prView);
  await api(`/api/sessions/${practice.body.id}/submit`, { method: "POST", body: "{}" });
  const prReport = (await api(`/api/sessions/${practice.body.id}/report`)).body;
  const levels = prReport.chains.byLevel.reduce((acc: Record<number, number>, r: any) => ({ ...acc, [r.level]: r.total }), {});
  check((levels[1] ?? 0) === 2 && (levels[2] ?? 0) === 4 && (levels[3] ?? 0) === 3 && (levels[4] ?? 0) + (levels[5] ?? 0) === 1, `integration mix 2/4/3/1 (${JSON.stringify(levels)})`);
  check(prReport.questions.every((q: any) => q.instance.chain.steps.length > 0), "chains revealed after submission");
  const wrongCount = prReport.overall.incorrect;
  check(prReport.chains.breaks.length === wrongCount, `every wrong answer located in its chain (${prReport.chains.breaks.length}/${wrongCount})`);
  const prPage = await api(`/session/${practice.body.id}/report?tab=chains`);
  check(prPage.status === 200 && prPage.text.includes("Formula chains"), "report page has the formula-chain tab");

  const sup = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "PRACTICE", count: 5, reference: "supported" }) });
  const supView = (await api(`/api/sessions/${sup.body.id}`)).body;
  check(supView.reference === "supported" && supView.questions.every((q: any) => q.formulas?.length > 0), "formula-supported practice lists each question's formulas");
  const supPage = await api(`/session/${sup.body.id}`);
  check(supPage.status === 200 && supPage.text.includes("Formula library"), "runner shows the formula library tab in supported mode");
  const closedExam = await api("/api/sessions", { method: "POST", body: JSON.stringify({ mode: "EXAM", reference: "supported" }) });
  const ceView = (await api(`/api/sessions/${closedExam.body.id}`)).body;
  check(ceView.reference === "closed" && ceView.questions.every((q: any) => q.formulas === undefined), "exam simulation stays closed book even when support is requested");

  // ---------------------------------------------------------------- remediation and transfer
  const dash = (await api("/api/history")).body;
  check(dash.sessions.filter((s: any) => s.status === "SUBMITTED").length === before + 5, "history persists the five new submitted sessions");
  check(dash.concepts.totals.attempts >= 10, "dashboard reports concept mastery");
  check(dash.remediation.due > 0, `remediation items opened (${dash.remediation.due} due)`);
  check(dash.misconceptions.length > 0, "most common misconceptions listed");
  check(dash.hypotheses.length === 12, "initial profile hypotheses evaluated");
  const rem = await api("/api/remediation", { method: "POST" });
  check(rem.status === 200, "remediation session generated");
  const remView = (await api(`/api/sessions/${rem.body.id}`)).body;
  check(remView.questions.length > 0 && remView.questions.length <= 12, `remediation set has ${remView.questions.length} questions`);
  await answerAll(rem.body.id, remView);
  await api(`/api/sessions/${rem.body.id}/submit`, { method: "POST", body: "{}" });
  const remReport = (await api(`/api/sessions/${rem.body.id}/report`)).body;
  const targeted = remReport.questions.filter((q: any) => q.instance.options.some((o: any) => dash.misconceptions.some((m: any) => m.id === o.misconceptionTag)));
  check(targeted.length > 0, `remediation questions set the same traps (${targeted.length}/${remReport.questions.length})`);

  const transfer = await api("/api/transfer", { method: "POST", body: JSON.stringify({ questionId: report.questions[0].instance.instanceId }) });
  const trView = (await api(`/api/sessions/${transfer.body.id}`)).body;
  check(transfer.status === 200 && trView.questions.length >= 1, `transfer check created (${trView.questions.length} questions)`);

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll end-to-end checks passed.");
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
