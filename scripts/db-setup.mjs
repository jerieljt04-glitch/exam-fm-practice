// Creates or updates the local SQLite database to match prisma/schema.prisma.
// Runs before `npm run dev`, `npm start` and the tests, so no manual setup is needed.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(root, "data"), { recursive: true });
const url = process.env.EXAM_FM_DATABASE_URL ?? `file:${path.join(root, "data", "exam-fm.db")}`;
const prisma = path.join(root, "node_modules", ".bin", "prisma");
const result = spawnSync(prisma, ["db", "push", "--skip-generate"], {
  cwd: root,
  env: { ...process.env, EXAM_FM_DATABASE_URL: url },
  encoding: "utf8",
});
if (result.status !== 0) {
  process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}\n`);
  process.exit(result.status ?? 1);
}
