// Creates or updates the local SQLite database to match prisma/schema.prisma.
// Runs before `npm run dev`, `npm start` and the tests, so no manual setup is needed.
//
// Safety: when an existing database needs a schema change, a timestamped copy
// is written to <database folder>/backups/ first, and the change is applied
// with `prisma db push` WITHOUT --accept-data-loss, so Prisma refuses any change
// that would drop a column, table or row. Schema changes in this project are
// additive (new columns with defaults); history is never reset.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(root, "data"), { recursive: true });
const url = process.env.EXAM_FM_DATABASE_URL ?? `file:${path.join(root, "data", "exam-fm.db")}`;
const prisma = path.join(root, "node_modules", ".bin", "prisma");
const env = { ...process.env, EXAM_FM_DATABASE_URL: url };

const filePath = url.startsWith("file:") ? url.slice("file:".length) : null;
const dbFile = filePath ? (path.isAbsolute(filePath) ? filePath : path.resolve(root, "prisma", filePath)) : null;

if (dbFile && existsSync(dbFile) && statSync(dbFile).size > 0) {
  // Exit code 2 means the database differs from the schema.
  const diff = spawnSync(prisma, ["migrate", "diff", "--from-url", url, "--to-schema-datamodel", path.join(root, "prisma", "schema.prisma"), "--exit-code"], { cwd: root, env, encoding: "utf8" });
  if (diff.status === 2) {
    const backups = path.join(path.dirname(dbFile), "backups");
    mkdirSync(backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const copy = path.join(backups, `${path.basename(dbFile, ".db")}-before-schema-${stamp}.db`);
    copyFileSync(dbFile, copy);
    process.stdout.write(`Schema change pending: backed up the database to ${copy}\n${diff.stdout}`);
  } else if (diff.status !== 0) {
    process.stderr.write(`Could not compare the database with the schema:\n${diff.stdout ?? ""}${diff.stderr ?? ""}\n`);
    process.exit(diff.status ?? 1);
  }
}

const result = spawnSync(prisma, ["db", "push", "--skip-generate"], { cwd: root, env, encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}\n`);
  process.exit(result.status ?? 1);
}
