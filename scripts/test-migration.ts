/**
 * Migration check against a COPY of a real database (the original is never
 * opened for writing):
 *
 *   npm run test:migration                      # copies data/exam-fm.db
 *   npm run test:migration -- /path/to/other.db
 *
 * 1. Copies the database into a temporary folder and applies the schema with
 *    scripts/db-setup.mjs (which backs the copy up first and refuses
 *    destructive changes).
 * 2. Compares every original column of every table, row by row, before and
 *    after: nothing may be lost or rewritten.
 * 3. Opens every stored session through the app's repository — in-progress
 *    sessions as the runner sees them, submitted ones as reports — and builds
 *    the dashboard, so old payloads are proven to load under the new model.
 */
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

const source = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "data", "exam-fm.db"));
if (!existsSync(source)) {
  console.log(`No database at ${source}; nothing to migrate.`);
  process.exit(0);
}
const dir = mkdtempSync(path.join(os.tmpdir(), "exam-fm-migration-"));
const copy = path.join(dir, "copy.db");
copyFileSync(source, copy);

const sqlite = (db: string, sql: string) => {
  const r = spawnSync("sqlite3", [db, sql], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
const columns = (db: string, table: string) =>
  sqlite(db, `PRAGMA table_info(${table});`)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|")[1]);
const TABLES = ["Session", "SessionQuestion", "ValidationLog", "RemediationItem"];
const before = Object.fromEntries(TABLES.map((t) => [t, columns(copy, t)]));
const snapshot = (db: string) =>
  Object.fromEntries(TABLES.map((t) => [t, sqlite(db, `SELECT ${before[t].map((c) => `"${c}"`).join(",")} FROM ${t} ORDER BY id;`)]));
const original = snapshot(copy);

let failures = 0;
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${message}`);
  if (!ok) failures += 1;
};

process.env.EXAM_FM_DATABASE_URL = `file:${copy}`;
const setup = spawnSync(process.execPath, [path.join(__dirname, "db-setup.mjs")], { env: process.env, encoding: "utf8" });
check(setup.status === 0, `schema applied to the copy${setup.stdout.trim() ? ` (${setup.stdout.trim().split("\n")[0]})` : " (already up to date)"}`);
if (setup.status !== 0) console.log(setup.stderr);

const after = snapshot(copy);
for (const t of TABLES) {
  const rows = original[t].split("\n").filter(Boolean).length;
  check(after[t] === original[t], `${t}: ${rows} rows, every original column unchanged`);
}
const added = columns(copy, "SessionQuestion").filter((c) => !before.SessionQuestion.includes(c));
check(true, `new SessionQuestion columns: ${added.join(", ") || "none (already migrated)"}`);

async function main() {
  const repo = await import("../lib/server/repository");
  const { prisma } = await import("../lib/server/db");
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "asc" } });
  let views = 0;
  let reports = 0;
  for (const s of sessions) {
    try {
      if (s.status === "ACTIVE") {
        // Read-only: getSessionView submits a session only when its timer has expired, which would change the
        // copy, not the original. Count it either way.
        const view = await repo.getSessionView(s.id);
        if (view && view.questions.every((q) => q.options.length === 5)) views += 1;
        else check(false, `session ${s.id} (${s.mode}) did not open`);
      } else {
        const report = await repo.getReport(s.id);
        if (report && report.questions.length > 0 && report.formats && report.concepts) reports += 1;
        else check(false, `report ${s.id} (${s.mode}) did not build`);
      }
    } catch (error) {
      check(false, `session ${s.id} (${s.mode}) threw: ${(error as Error).message}`);
    }
  }
  check(views + reports === sessions.length, `${views} in-progress session(s) resume and ${reports} report(s) open under the new answer model`);
  const dash = await repo.getDashboard();
  check(dash.totals.attempts >= 0 && Array.isArray(dash.concepts.byOutcome), `dashboard builds (${dash.totals.attempts} answered questions in history)`);
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
  console.log(failures ? `\n${failures} migration check(s) failed.` : "\nMigration verified on a copy; the original database was not modified.");
  process.exitCode = failures ? 1 : 0;
}

void main();
