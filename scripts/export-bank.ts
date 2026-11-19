/**
 * Exports a sample of generated questions for the independent SymPy validator
 * (scripts/validate_sympy.py):
 *
 *  - numeric questions: every option's arithmetic, the equation of value, the
 *    values the TypeScript engine computed and the strings it displays;
 *  - composite questions (ordered pairs, allocations): the same, component by
 *    component, with one independent reference per component;
 *  - truth claims: every quantitative statement check and option check, with
 *    the truth value the engine relied on;
 *  - equation/expression options: each option's probe and the reference
 *    quantity, so exactly one option can be confirmed to define it.
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { buildChoiceQuestion, buildQuestion } from "../lib/engine/assemble";
import { formatAnswer } from "../lib/engine/format";
import { CHOICE_TEMPLATES, TEMPLATES } from "../lib/engine/templates";

const SEEDS = Number(process.env.SYMPY_SEEDS ?? 3);
const out = process.argv[2] ?? path.join(__dirname, "..", "data", "validation-export.json");

const questions: unknown[] = [];
for (const template of TEMPLATES) {
  for (const level of template.levels) {
    for (let s = 0; s < SEEDS; s += 1) {
      const { instance } = buildQuestion(template, level, `sympy-${s}`);
      if (!instance) throw new Error(`${template.id} L${level} seed ${s} failed to build`);
      questions.push({
        kind: "numeric",
        id: `${template.id}|L${level}|${s}`,
        format: instance.format,
        model: instance.model.expr,
        options: instance.options.map((o) => ({ key: o.key, isCorrect: o.isCorrect, value: o.value, calc: o.calc, display: o.display, misconception: o.misconceptionTag })),
      });
    }
  }
}

for (const template of CHOICE_TEMPLATES) {
  for (const level of template.levels) {
    for (let variant = 0; variant < Math.max(1, template.variants); variant += 1) {
      for (let s = 0; s < SEEDS; s += 1) {
        const { instance } = buildChoiceQuestion(template, level, `sympy-${s}`, { variant });
        if (!instance) throw new Error(`${template.id} L${level} v${variant} seed ${s} failed to build`);
        const id = `${template.id}|L${level}|v${variant}|${s}`;
        const refs = instance.model?.expr ? instance.model.expr.split(" ; ") : [];
        const draftRefs = instance.validation.model.split("\n").slice(1);
        if (instance.answerType === "composite" || instance.answerType === "numeric") {
          const parts = (o: (typeof instance.options)[number]) =>
            o.content?.type === "composite" ? o.content.parts : o.content?.type === "numeric" ? [{ label: "", value: o.content.value, format: o.content.format }] : [];
          const first = parts(instance.options[0]);
          questions.push({
            kind: "composite",
            id,
            components: first.map((p, k) => ({ format: p.format, model: refs[k], near: parts(instance.options.find((o) => o.isCorrect)!)[k].value })),
            options: instance.options.map((o) => {
              const calcs = o.calc.split(" ; ");
              return { key: o.key, isCorrect: o.isCorrect, parts: parts(o).map((p, k) => ({ value: p.value, calc: calcs[k], display: formatAnswer(p.value, p.format) })) };
            }),
          });
        }
        const claims = [
          ...(instance.statements ?? []).filter((st) => st.check).map((st) => ({ source: `statement ${st.key}`, ...st.check!, expected: st.truth })),
          ...instance.options.filter((o) => o.check).map((o) => ({ source: `option ${o.key}`, ...o.check!, expected: o.isCorrect })),
        ];
        if (claims.length) questions.push({ kind: "claims", id, claims });
        const probes = instance.options.filter((o) => o.probe);
        if (probes.length && refs.length === 1 && draftRefs.length === 1) {
          questions.push({
            kind: "probes",
            id,
            reference: refs[0],
            near: instance.validation.modelValue,
            options: probes.map((o) => ({ key: o.key, isCorrect: o.isCorrect, probe: o.probe })),
          });
        }
      }
    }
  }
}

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(questions));
const kinds = questions.reduce<Record<string, number>>((acc, q) => ({ ...acc, [(q as { kind: string }).kind]: (acc[(q as { kind: string }).kind] ?? 0) + 1 }), {});
console.log(`Exported ${questions.length} records to ${out} (${Object.entries(kinds).map(([k, n]) => `${k}: ${n}`).join(", ")})`);
