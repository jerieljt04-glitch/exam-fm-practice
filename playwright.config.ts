import { defineConfig } from "@playwright/test";

/**
 * Browser tests: visual snapshots of the main pages in light and dark mode,
 * a WCAG contrast sweep over every visible control, and the exam flow
 * (keyboard shortcuts, calculator, review screen, report).
 *
 * Locally they drive the installed Google Chrome; CI installs Chromium.
 * Snapshots are stored per platform, so macOS and the Linux CI each keep their own.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // A missing baseline is written (and reported) rather than failing the first run on a new platform.
  updateSnapshots: "missing",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: "http://127.0.0.1:4199",
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1360, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:4199",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
