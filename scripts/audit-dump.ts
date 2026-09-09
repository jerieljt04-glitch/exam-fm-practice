/**
 * Dumps generated question instances for the independent audit.
 *
 * Pairs with `scripts/audit-answers.py`, which re-derives every numeric answer
 * in Python without touching this codebase, and structurally checks the
 * qualitative items. See `scripts/audit.sh`.
 */
import * as fs from "fs";

import { examGenerator, formatAnswer } from "../lib/engine/generator";
import { createRng } from "../lib/engine/random";
import { QUESTION_TEMPLATES } from "../lib/engine/templates";

const target = process.argv[2];
if (!target) {
  console.error("usage: audit-dump.ts <output.json>");
  process.exit(1);
}
const draws = Number(process.argv[3] ?? 8);

const instances = QUESTION_TEMPLATES.flatMap((template) =>
  Array.from({ length: draws }, (_, draw) => {
    const seed = `audit-${template.id}-${draw}`;
    const item = template.generate(createRng(seed)) as any;
    const question = examGenerator.generateQuestion(template, {
      examSessionId: "audit",
      questionNumber: 1,
      seed,
    });

    const base = {
      id: template.id,
      draw,
      kind: item.kind === "CHOICE" ? "CHOICE" : "NUMERIC",
      question: item.questionText,
      solution: item.solutionSteps,
      options: question.renderedOptions.map((o) => ({
        k: o.key,
        text: o.text,
        correct: o.isCorrect,
        why: o.distractorExplanation ?? "",
      })),
    };

    if (base.kind === "CHOICE") return base;

    return {
      ...base,
      format: item.format,
      vars: item.variables,
      correct: item.correctValue,
      correctLabel: formatAnswer(item.correctValue, item.format),
      distractors: item.distractors.map((d: any) => d.value),
    };
  })
);

fs.writeFileSync(target, JSON.stringify(instances));
const choice = instances.filter((i) => i.kind === "CHOICE").length;
console.log(
  `  dumped ${instances.length} instances from ${QUESTION_TEMPLATES.length} templates ` +
    `(${instances.length - choice} numeric, ${choice} qualitative)`
);
