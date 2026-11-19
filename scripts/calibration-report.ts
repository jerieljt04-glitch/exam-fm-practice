/**
 * Calibration and coverage report for the whole bank:
 *
 *   npm run report:calibration                 # print to the terminal
 *   npm run report:calibration -- docs/calibration-report.md 4
 *
 * Builds every template × level (× variant for typed templates) on a few
 * seeds and summarises the bank by topic, learning outcome, difficulty,
 * question format, answer type, reasoning steps, formula and concept counts,
 * integration level, presentation, expected time band and distractor
 * category, and checks each built question against the structural rubric
 * (docs/difficulty-rubric.md). Counts are structural measurements of the
 * items; time bands are inferred, not measured from candidates.
 */
import { writeFileSync } from "fs";

import { buildAny } from "../lib/engine/assemble";
import { getMisconception, MISCONCEPTION_CATEGORIES } from "../lib/engine/misconceptions";
import { ALL_TEMPLATES } from "../lib/engine/templates";
import { CONCEPT_FAMILY_LABELS, ITEM_FORMAT_LABELS, TIME_BAND_LABELS, isChoiceTemplate, type QuestionInstance } from "../lib/engine/types";
import { OUTCOMES, TOPIC_LABELS, TOPIC_ORDER } from "../lib/syllabus";
import { calibrationOf } from "../lib/analysis/report";

const out = process.argv[2];
const SEEDS = Number(process.argv[3] ?? 3);

type Row = { q: QuestionInstance; practice: string; family?: string };
const rows: Row[] = [];
const failures: string[] = [];
for (const t of ALL_TEMPLATES) {
  const variants = isChoiceTemplate(t) ? Math.max(1, t.variants) : 1;
  for (const level of t.levels) {
    for (let v = 0; v < variants; v += 1) {
      for (let s = 0; s < SEEDS; s += 1) {
        const { instance } = buildAny(t, level, `calibration-${s}`, { variant: v });
        if (!instance) {
          failures.push(`${t.id} L${level} v${v} seed ${s}`);
          continue;
        }
        rows.push({ q: instance, practice: isChoiceTemplate(t) ? t.practice : "calculation", family: isChoiceTemplate(t) ? t.conceptFamily : undefined });
      }
    }
  }
}

const lines: string[] = [];
const say = (s = "") => lines.push(s);
const count = <K extends string | number>(list: Row[], key: (r: Row) => K | K[]) => {
  const map = new Map<K, number>();
  list.forEach((r) => {
    const k = key(r);
    (Array.isArray(k) ? k : [k]).forEach((x) => map.set(x, (map.get(x) ?? 0) + 1));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
const table = (title: string, entries: Array<[string | number, number]>, label: (k: string | number) => string = String) => {
  say(`### ${title}`);
  say("");
  say("| | Questions built |");
  say("| --- | ---: |");
  entries.forEach(([k, n]) => say(`| ${label(k)} | ${n} |`));
  say("");
};

// Template-level coverage (independent of seeds).
const templateLevels = ALL_TEMPLATES.flatMap((t) => t.levels.map((level) => ({ t, level })));
const conceptTemplates = ALL_TEMPLATES.filter((t) => isChoiceTemplate(t) && t.practice === "concept");

say(`# Bank calibration report`);
say("");
say(`Generated ${new Date().toISOString()} from ${ALL_TEMPLATES.length} templates (${templateLevels.length} template-levels), ${SEEDS} seed(s) per template × level × variant: ${rows.length} questions built, ${failures.length} failed to build.`);
say("");
say("Structural classification against docs/difficulty-rubric.md. These are counts taken from each item, not psychometric difficulty; expected time bands are inferred from those counts.");
say("");

say("## Coverage by learning outcome");
say("");
say("| Outcome | Templates (primary) | Concept templates | Concept L1 | Concept L2–3 | Level-3 (primary or secondary) | Level-3 primary |");
say("| --- | ---: | ---: | :---: | :---: | :---: | :---: |");
let missingConcept = 0;
let missingL3 = 0;
for (const o of Object.values(OUTCOMES)) {
  const primary = ALL_TEMPLATES.filter((t) => t.objective === o.id);
  const concept = conceptTemplates.filter((t) => t.objective === o.id);
  const cL1 = concept.some((t) => t.levels.includes(1));
  const cHi = concept.some((t) => t.levels.includes(2) || t.levels.includes(3));
  const l3 = ALL_TEMPLATES.some((t) => t.levels.includes(3) && (t.objective === o.id || t.secondary.includes(o.id)));
  const l3p = ALL_TEMPLATES.some((t) => t.levels.includes(3) && t.objective === o.id);
  if (!cL1 || !cHi) missingConcept += 1;
  if (!l3) missingL3 += 1;
  say(`| ${o.id} — ${o.label} | ${primary.length} | ${concept.length} | ${cL1 ? "✓" : "✗"} | ${cHi ? "✓" : "✗"} | ${l3 ? "✓" : "✗"} | ${l3p ? "✓" : "—"} |`);
}
say("");
say(`Outcomes lacking standard and higher-level concept coverage: ${missingConcept}. Outcomes lacking Level-3 coverage: ${missingL3}.`);
say("");

say("## Template counts");
say("");
say("| Topic | Templates | Numerical | Typed calculation | Concept | Level-3 templates |");
say("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const topic of TOPIC_ORDER) {
  const ts = ALL_TEMPLATES.filter((t) => t.topic === topic);
  say(
    `| ${TOPIC_LABELS[topic]} | ${ts.length} | ${ts.filter((t) => !isChoiceTemplate(t)).length} | ${ts.filter((t) => isChoiceTemplate(t) && t.practice === "calculation").length} | ${ts.filter((t) => isChoiceTemplate(t) && t.practice === "concept").length} | ${ts.filter((t) => t.levels.includes(3)).length} |`
  );
}
say("");

say("## Built questions");
say("");
table("By topic", count(rows, (r) => r.q.topic), (k) => TOPIC_LABELS[k as keyof typeof TOPIC_LABELS]);
table("By difficulty", count(rows, (r) => r.q.difficulty), (k) => ({ 1: "1 SOA standard", 2: "2 Advanced", 3: "3 Challenge" })[k as 1 | 2 | 3]);
table("By question format", count(rows, (r) => r.q.itemFormat ?? "direct-calculation"), (k) => ITEM_FORMAT_LABELS[k as keyof typeof ITEM_FORMAT_LABELS] ?? String(k));
table("By answer type", count(rows, (r) => r.q.answerType ?? "numeric"));
table("By practice kind", count(rows, (r) => r.practice));
table("By concept family (concept items)", count(rows.filter((r) => r.family), (r) => r.family!), (k) => CONCEPT_FAMILY_LABELS[k as keyof typeof CONCEPT_FAMILY_LABELS] ?? String(k));
table("By reasoning steps", count(rows, (r) => calibrationOf(r.q).reasoningSteps));
table("By connected formulas", count(rows, (r) => calibrationOf(r.q).formulas));
table("By connected concepts", count(rows, (r) => calibrationOf(r.q).concepts));
table("By integration level (calculation items with a formula chain)", count(rows.filter((r) => r.q.integration), (r) => r.q.integration!));
table("By presentation", count(rows, (r) => r.q.presentation));
table("By expected time band (inferred)", count(rows, (r) => calibrationOf(r.q).timeBand), (k) => TIME_BAND_LABELS[k as keyof typeof TIME_BAND_LABELS]);
table("By calculator burden (inferred)", count(rows, (r) => calibrationOf(r.q).calculatorBurden));
table(
  "By distractor category",
  count(rows, (r) => r.q.options.filter((o) => !o.isCorrect).map((o) => { const m = getMisconception(o.misconceptionTag); return m ? MISCONCEPTION_CATEGORIES[m.category] : "unknown"; }))
);

say("## Rubric check");
say("");
for (const level of [1, 2, 3] as const) {
  const atLevel = rows.filter((r) => r.q.difficulty === level);
  const failing = atLevel.filter((r) => !calibrationOf(r.q).rubric.meets);
  say(`- Level ${level}: ${atLevel.length - failing.length} of ${atLevel.length} built questions meet the structural rubric.`);
  const ids = [...new Set(failing.map((r) => `${r.q.templateId} (${calibrationOf(r.q).rubric.reasons.join("; ")})`))];
  ids.slice(0, 20).forEach((id) => say(`  - ${id}`));
}
say("");
if (failures.length) {
  say("## Build failures");
  failures.forEach((f) => say(`- ${f}`));
}

const text = lines.join("\n");
if (out) {
  writeFileSync(out, `${text}\n`);
  console.log(`Wrote ${out}: ${rows.length} questions, ${failures.length} build failures, ${missingConcept} outcomes without full concept coverage, ${missingL3} without Level-3 coverage.`);
} else {
  console.log(text);
}
if (failures.length) process.exitCode = 1;
