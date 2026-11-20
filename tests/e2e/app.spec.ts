import { existsSync } from "fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * Runs serially against a fresh database (scripts/e2e-server.mjs): the visual
 * snapshots come first, while the pages hold no history and are deterministic.
 */
test.describe.configure({ mode: "serial" });

const STATIC_PAGES = ["/", "/progress", "/study"] as const;

/**
 * Every visible text element must meet WCAG AA against its effective
 * background (4.5:1, or 3:1 for large text). Disabled controls and the
 * gradient headline are exempt, as WCAG allows.
 */
async function contrastViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type RGBA = { r: number; g: number; b: number; a: number };
    const parse = (c: string): RGBA | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (top: RGBA, under: RGBA): RGBA => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const background = (el: Element): RGBA => {
      const layers: RGBA[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) {
          layers.push(bg);
          if (bg.a >= 1) break;
        }
      }
      let colour: RGBA = { r: 255, g: 255, b: 255, a: 1 };
      if (!layers.length || layers[layers.length - 1].a < 1) colour = parse(getComputedStyle(document.body).backgroundColor) ?? colour;
      for (const layer of layers.reverse()) colour = layer.a >= 1 ? layer : over(layer, colour);
      return colour;
    };
    const lum = (c: RGBA) => {
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0);
      if (!own) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || rect.width === 0 || rect.height === 0) continue;
      if (el.closest("[disabled], [aria-disabled='true'], .text-gradient, [aria-hidden='true'], .sr-only, svg, .katex")) continue;
      let faded = false;
      for (let node: Element | null = el; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 1) faded = true;
      if (faded) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      const bg = background(el);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const r = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
      if (r < need - 0.01) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${r.toFixed(2)}:1 (needs ${need})`);
    }
    return out.slice(0, 12);
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`visual: main pages look as recorded (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const path of STATIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const name = `${scheme}${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`;
      // In CI, a platform without recorded baselines attaches the screenshot instead of failing;
      // the "Update visual baselines" workflow records and commits them.
      if (process.env.CI && test.info().config.updateSnapshots !== "all" && !existsSync(test.info().snapshotPath(name))) {
        await test.info().attach(`new baseline ${name}`, { body: await page.screenshot(), contentType: "image/png" });
        continue;
      }
      await expect(page).toHaveScreenshot(name);
    }
  });
}

test("contrast: every visible text element meets WCAG AA in both themes", async ({ page, request }) => {
  const created = await request.post("/api/sessions", { data: { mode: "DIAGNOSTIC", count: 3 } });
  const { id } = (await created.json()) as { id: string };
  const done = await request.post("/api/sessions", { data: { mode: "DIAGNOSTIC", count: 3 } });
  const { id: doneId } = (await done.json()) as { id: string };
  await request.post(`/api/sessions/${doneId}/submit`, { data: {} });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const path of [...STATIC_PAGES, "/progress?tab=history", "/formulas", `/session/${id}`, `/session/${doneId}/report`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await contrastViolations(page), `${scheme} ${path}`).toEqual([]);
    }
  }
});

test("theme toggle: cycles system → light → dark and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("exam: shortcuts, calculator, review screen and the report", async ({ page, request }) => {
  const res = await request.post("/api/sessions", { data: { mode: "EXAM", count: 3, difficulty: 1 } });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/session/${id}`);
  await expect(page.getByText("Question 1 of 3")).toBeVisible();

  await page.keyboard.press("b");
  await expect(page.getByRole("radio", { name: /^Option B/ })).toBeChecked();
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: /Flagged for review/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("(optional)").first()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Question 2 of 3")).toBeVisible();

  await page.getByRole("tab", { name: "Calculator" }).click();
  for (const key of ["2", "+", "3", "×", "4", "="]) await page.getByRole("button", { name: key, exact: true }).click();
  await expect(page.getByLabel("Display")).toHaveText("20.00");
  // Keys pressed while the calculator has focus go to the calculator, not to the exam shortcuts.
  await page.getByLabel("Display").click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("c");
  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Option C/ })).not.toBeChecked();

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "Review screen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review flagged \(1\)/ })).toBeEnabled();
  await page.getByRole("button", { name: "End exam and see the report" }).click();
  await page.waitForURL(/\/report/);
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
});

test("api: invalid requests get a 400 with a reason, missing sessions a 404", async ({ request }) => {
  const bad = await request.post("/api/sessions", { data: { mode: "NOPE" } });
  expect(bad.status()).toBe(400);
  expect(((await bad.json()) as { error: string }).error).toMatch(/mode/);
  expect((await request.get("/api/sessions/does-not-exist")).status()).toBe(404);
  expect((await request.delete("/api/history")).status()).toBe(400);
  const backup = await request.get("/api/backup");
  expect(backup.status()).toBe(200);
  expect(backup.headers()["content-disposition"]).toContain("exam-fm-backup-");
});
