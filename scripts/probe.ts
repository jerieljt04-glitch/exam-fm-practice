import { buildQuestion } from "../lib/engine/assemble";
import { TEMPLATES } from "../lib/engine/templates";
const only = process.argv[2];
const seeds = Number(process.argv[3] ?? 40);
for (const template of TEMPLATES) {
  if (only && !template.id.startsWith(only)) continue;
  for (const level of template.levels) {
    let ok = 0, tries = 0;
    const reasons = new Map<string, number>();
    for (let s = 0; s < seeds; s += 1) {
      const result = buildQuestion(template, level, `probe-${s}`);
      tries += result.rejected.length + (result.instance ? 1 : 0);
      if (result.instance) ok += 1;
      for (const r of result.rejected) for (const c of r.checks.filter((c) => !c.ok)) {
        const key = `${c.name}: ${(c.detail ?? "").slice(0, 140)}`;
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
      for (const r of result.rejected) for (const c of r.rejectedCandidates) {
        const key = `  cand ${c.misconception}: ${c.reason}`;
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
    }
    console.log(`${template.id} L${level}: ${ok}/${seeds} built, ${tries} drafts`);
    [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, n]) => console.log(`    ${n}× ${k}`));
  }
}
