/**
 * Shared helpers for the solution-approach bank (approach-*.ts).
 *
 * Every template in that bank exists to give the exam a different *route* to
 * an answer on a familiar syllabus topic — an identity instead of a
 * computation, a ratio instead of a rate, a quadratic hidden in a timing
 * condition, two partial facts combined into a system — so that successive
 * exams do not repeat the same steps with new numbers.
 */
import type { AlgebraMethod, AnswerFormat, ChainStep, DistractorCandidate, Explanation, FormulaChain, Presentation, QuestionDraft, QuestionFeatures, VisualSpec } from "../types";
import { chain, explanation, features as feat, mnum as mn, shown as sh } from "./kit";

/** Bisection root of a continuous function that changes sign on [lo, hi]. */
export function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) throw new Error("No sign change on the bracket.");
  for (let k = 0; k < 200; k += 1) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0 || b - a < 1e-14 * Math.max(1, Math.abs(m))) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

export const round2 = (x: number): number => Math.round(x * 100) / 100;

/** A flowchart of the solution route: the givens, each step of the chain, the answer. */
export function routeVisual(chain: FormulaChain, title: string, caption: string): VisualSpec {
  const nodes: Extract<VisualSpec, { kind: "flowchart" }>["nodes"] = [{ id: "given", label: "What is given", tone: "input" }];
  const edges: Extract<VisualSpec, { kind: "flowchart" }>["edges"] = [];
  let previous = "given";
  chain.steps.forEach((s, k) => {
    const id = `s${k}`;
    nodes.push({ id, label: s.output.meaning, detail: s.purpose, tone: k === chain.steps.length - 1 ? "result" : "step" });
    edges.push({ from: previous, to: id });
    previous = id;
  });
  return { kind: "flowchart", title, nodes, edges, caption };
}

interface ExplainSpec {
  intuition: string;
  unknowns: { symbol: string; meaning: string }[];
  relationships: string[];
  conditions: string[];
  valuationDate: string;
  modelChoice: string;
  assumptions: string[];
  solution: { title: string; body: string }[];
  alternative?: { name: string; body: string; whenUseful: string };
  principle: string;
  unusual: string;
  misread: string;
}

export function explain(s: ExplainSpec): Explanation {
  return explanation({
    intuition: s.intuition,
    translation: {
      unknowns: s.unknowns,
      relationships: s.relationships,
      conditions: s.conditions,
      valuationDate: s.valuationDate,
      modelChoice: s.modelChoice,
      assumptions: s.assumptions,
    },
    solution: s.solution,
    alternatives: s.alternative ? [s.alternative] : [],
    transfer: { principle: s.principle, unusual: s.unusual, misread: s.misread },
  });
}

// ---------------------------------------------------------------- compact draft builder


export interface ComposeSpec {
  stem: string;
  fmt: AnswerFormat;
  value: number;
  calc: string;
  model: { expr: string; bracket?: [number, number]; description: string };
  distractors: DistractorCandidate[];
  steps: ChainStep[];
  methods: AlgebraMethod[];
  reasoning: string;
  unconventional?: boolean;
  intuition: string;
  unknowns: { symbol: string; meaning: string }[];
  relationships: string[];
  conditions: string[];
  valuationDate: string;
  modelChoice: string;
  assumptions: string[];
  alternative?: { name: string; body: string; whenUseful: string };
  principle: string;
  unusual: string;
  misread: string;
  presentation: Presentation[];
  features: Partial<QuestionFeatures>;
  params: Record<string, number | string | boolean>;
  route: string;
}

const stepBody = (value: number) => `$${Math.abs(value) < 1 && value !== 0 ? value.toFixed(6) : mn(value, 2)}$`;

/** Builds a numerical draft: solution steps come from the chain, every trap is placed at the step before the last unless stated. */
export function compose(s: ComposeSpec): QuestionDraft {
  const stages = Object.fromEntries(s.distractors.map((d) => [d.misconception, Math.max(0, s.steps.length - 2)]));
  const chainSpec = chain(s.steps, { methods: s.methods, reasoning: s.reasoning, unconventional: s.unconventional, stages });
  return {
    stem: s.stem,
    answer: { value: s.value, calc: s.calc, format: s.fmt, derivation: `$= ${sh(s.value, s.fmt)}$` },
    model: s.model,
    distractors: s.distractors,
    explanation: explain({
      intuition: s.intuition,
      unknowns: s.unknowns,
      relationships: s.relationships,
      conditions: s.conditions,
      valuationDate: s.valuationDate,
      modelChoice: s.modelChoice,
      assumptions: s.assumptions,
      solution: [
        ...s.steps.slice(0, -1).map((st) => ({ title: st.output.meaning.replace(/^./, (c) => c.toUpperCase()), body: `${st.purpose} ${stepBody(st.output.value)}` })),
        { title: s.steps[s.steps.length - 1].output.meaning.replace(/^./, (c) => c.toUpperCase()), body: `$${sh(s.value, s.fmt)}$` },
      ],
      alternative: s.alternative,
      principle: s.principle,
      unusual: s.unusual,
      misread: s.misread,
    }),
    visuals: [routeVisual(chainSpec, `Route: ${s.route}`, "The steps in order.")],
    markers: s.steps.map((st) => st.output.value).filter((x) => Number.isFinite(x) && x !== 0),
    presentation: s.presentation,
    features: feat({ steps: s.steps.length, ...s.features }),
    params: s.params,
    chain: chainSpec,
  };
}
