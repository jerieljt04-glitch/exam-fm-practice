/**
 * Test runner: `npm run test:unit`.
 *
 * Uses a temporary SQLite database so persistence tests never touch the real
 * history in data/exam-fm.db.
 */
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

const dir = mkdtempSync(path.join(os.tmpdir(), "exam-fm-test-"));
process.env.EXAM_FM_DATABASE_URL = `file:${path.join(dir, "test.db")}`;
const setup = spawnSync(process.execPath, [path.join(__dirname, "..", "db-setup.mjs")], { env: process.env, encoding: "utf8" });
if (setup.status !== 0) {
  console.error(setup.stdout, setup.stderr);
  process.exit(1);
}

async function main() {
  const { run } = await import("./harness");
  console.log("Mathematics and expression engine");
  await import("./math.test");
  await import("./bank.test");
  await import("./session.test");
  await import("./formulas.test");
  await import("./concepts.test");
  await import("./persistence.test");
  await import("./study.test");
  const failed = await run();
  const { prisma } = await import("../../lib/server/db");
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });

  console.log("\nMarkup");
  await import("../test-markup");
  if (failed) process.exitCode = 1;
}

void main();
