/**
 * Exports a sample of generated questions for the independent SymPy validator
 * (scripts/validate_sympy.py): every option's arithmetic, the equation of value,
 * the values the TypeScript engine computed and the strings it displays.
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { buildQuestion } from "../lib/engine/assemble";
import { TEMPLATES } from "../lib/engine/templates";

const SEEDS = Number(process.env.SYMPY_SEEDS ?? 3);
const out = process.argv[2] ?? path.join(__dirname, "..", "data", "validation-export.json");

const questions = [];
for (const template of TEMPLATES) {
  for (const level of template.levels) {
    for (let s = 0; s < SEEDS; s += 1) {
      const { instance } = buildQuestion(template, level, `sympy-${s}`);
      if (!instance) throw new Error(`${template.id} L${level} seed ${s} failed to build`);
      questions.push({
        id: `${template.id}|L${level}|${s}`,
        format: instance.format,
        model: instance.model.expr,
        options: instance.options.map((o) => ({ key: o.key, isCorrect: o.isCorrect, value: o.value, calc: o.calc, display: o.display, misconception: o.misconceptionTag })),
      });
    }
  }
}
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(questions));
console.log(`Exported ${questions.length} questions to ${out}`);
