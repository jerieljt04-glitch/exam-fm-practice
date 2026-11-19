/**
 * Stress-builds typed-option templates: `npm run validate:choice -- [id-prefix] [seeds]`.
 * Prints, per template, level and variant, how many seeds built and the most
 * common rejection reasons.
 */
import { buildChoiceQuestion } from "../lib/engine/assemble";
import { CHOICE_TEMPLATES } from "../lib/engine/templates";

const only = process.argv[2] ?? "";
const seeds = Number(process.argv[3] ?? 30);
let failures = 0;
for (const template of CHOICE_TEMPLATES) {
  if (only && !template.id.startsWith(only)) continue;
  for (const level of template.levels) {
    for (let variant = 0; variant < template.variants; variant += 1) {
      let ok = 0;
      const reasons = new Map<string, number>();
      for (let s = 0; s < seeds; s += 1) {
        const result = buildChoiceQuestion(template, level, `probe-${s}`, { variant });
        if (result.instance) ok += 1;
        for (const r of result.rejected) {
          for (const c of r.checks.filter((c) => !c.ok)) reasons.set(`${c.name}: ${(c.detail ?? "").slice(0, 160)}`, (reasons.get(`${c.name}: ${(c.detail ?? "").slice(0, 160)}`) ?? 0) + 1);
          for (const c of r.rejectedCandidates) reasons.set(`  cand ${c.misconception}: ${c.reason}`, (reasons.get(`  cand ${c.misconception}: ${c.reason}`) ?? 0) + 1);
        }
      }
      if (ok < seeds) failures += 1;
      console.log(`${ok === seeds ? "✓" : "✗"} ${template.id} L${level} v${variant}: ${ok}/${seeds} built`);
      if (ok < seeds || process.env.VERBOSE) [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, n]) => console.log(`    ${n}× ${k}`));
    }
  }
}
if (failures) process.exitCode = 1;
