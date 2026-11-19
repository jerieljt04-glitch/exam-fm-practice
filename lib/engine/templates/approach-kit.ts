/**
 * Shared helpers for the solution-approach bank (approach-*.ts).
 *
 * Every template in that bank exists to give the exam a different *route* to
 * an answer on a familiar syllabus topic — an identity instead of a
 * computation, a ratio instead of a rate, a quadratic hidden in a timing
 * condition, two partial facts combined into a system — so that successive
 * exams do not repeat the same steps with new numbers.
 */
import type { Explanation, FormulaChain, VisualSpec } from "../types";
import { explanation } from "./kit";

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
