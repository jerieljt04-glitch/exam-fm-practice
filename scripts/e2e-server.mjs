// Starts the app for browser tests: a fresh temporary database, the .next-e2e
// build (built first if missing), on 127.0.0.1:4199.
import { spawn, spawnSync } from "child_process";
import { existsSync, mkdtempSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(os.tmpdir(), "exam-fm-e2e-"));
const env = { ...process.env, EXAM_FM_DATABASE_URL: `file:${path.join(dir, "e2e.db")}`, NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(process.execPath, [path.join(root, "scripts", "db-setup.mjs")]);
if (!existsSync(path.join(root, ".next-e2e", "BUILD_ID")) || process.env.E2E_REBUILD) run("npx", ["next", "build"]);
const server = spawn("npx", ["next", "start", "-p", "4199", "-H", "127.0.0.1"], { cwd: root, env, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
server.on("exit", (code) => process.exit(code ?? 0));
