/**
 * A small arithmetic expression evaluator.
 *
 * Every answer choice carries a `calc` string — the exact arithmetic that
 * produces it, written from the question's parameters — and every question
 * carries a `model`, its equation of value written out from first principles.
 * Both are evaluated here, independently of the template code that computed
 * the option, and again by the SymPy validator (`scripts/validate_sympy.py`).
 *
 * The grammar is deliberately the common subset of TypeScript-free arithmetic
 * and SymPy syntax:
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := '-' unary | power
 *   power   := atom ('**' unary)?
 *   atom    := number | 'x' | func '(' expr ')' | '(' expr ')'
 *   func    := 'exp' | 'log' | 'sqrt'          (log is natural)
 *
 * An expression that mentions `x` is an equation f(x) = 0; the quantity it
 * defines is the root.
 */

type Node =
  | { kind: "num"; value: number }
  | { kind: "x" }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "**"; left: Node; right: Node }
  | { kind: "fn"; name: "exp" | "log" | "sqrt"; arg: Node };

const FUNCTIONS = new Set(["exp", "log", "sqrt"]);

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === "*" && source[i + 1] === "*") {
      tokens.push("**");
      i += 2;
    } else if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i += 1;
    } else if (/[0-9.]/.test(ch)) {
      const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(source.slice(i));
      if (!match) throw new Error(`Bad number at ${i} in "${source}"`);
      tokens.push(match[0]);
      i += match[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const match = /^[a-z]+/i.exec(source.slice(i))!;
      tokens.push(match[0]);
      i += match[0].length;
    } else {
      throw new Error(`Unexpected "${ch}" in "${source}"`);
    }
  }
  return tokens;
}

export function parseExpr(source: string): Node {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const take = (expected?: string) => {
    const token = tokens[position];
    if (expected !== undefined && token !== expected) {
      throw new Error(`Expected "${expected}" but found "${token ?? "end"}" in "${source}"`);
    }
    position += 1;
    return token;
  };

  function expr(): Node {
    let node = term();
    while (peek() === "+" || peek() === "-") {
      const op = take() as "+" | "-";
      node = { kind: "bin", op, left: node, right: term() };
    }
    return node;
  }
  function term(): Node {
    let node = unary();
    while (peek() === "*" || peek() === "/") {
      const op = take() as "*" | "/";
      node = { kind: "bin", op, left: node, right: unary() };
    }
    return node;
  }
  function unary(): Node {
    if (peek() === "-") {
      take();
      return { kind: "neg", arg: unary() };
    }
    if (peek() === "+") {
      take();
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek() === "**") {
      take();
      return { kind: "bin", op: "**", left: base, right: unary() };
    }
    return base;
  }
  function atom(): Node {
    const token = take();
    if (token === undefined) throw new Error(`Unexpected end of "${source}"`);
    if (token === "(") {
      const inner = expr();
      take(")");
      return inner;
    }
    if (token === "x") return { kind: "x" };
    if (FUNCTIONS.has(token)) {
      take("(");
      const arg = expr();
      take(")");
      return { kind: "fn", name: token as "exp" | "log" | "sqrt", arg };
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error(`Unexpected "${token}" in "${source}"`);
    return { kind: "num", value };
  }

  const tree = expr();
  if (position !== tokens.length) throw new Error(`Trailing input "${tokens.slice(position).join(" ")}" in "${source}"`);
  return tree;
}

function evaluateNode(node: Node, x: number): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "x":
      return x;
    case "neg":
      return -evaluateNode(node.arg, x);
    case "fn": {
      const arg = evaluateNode(node.arg, x);
      return node.name === "exp" ? Math.exp(arg) : node.name === "log" ? Math.log(arg) : Math.sqrt(arg);
    }
    case "bin": {
      const left = evaluateNode(node.left, x);
      const right = evaluateNode(node.right, x);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        default:
          return Math.pow(left, right);
      }
    }
  }
}

function mentionsX(node: Node): boolean {
  switch (node.kind) {
    case "x":
      return true;
    case "num":
      return false;
    case "neg":
    case "fn":
      return mentionsX(node.arg);
    case "bin":
      return mentionsX(node.left) || mentionsX(node.right);
  }
}

export function isEquation(source: string): boolean {
  return mentionsX(parseExpr(source));
}

export function evaluate(source: string, x = Number.NaN): number {
  return evaluateNode(parseExpr(source), x);
}

/**
 * True when f(x) = 0 has a root within `relTol` of `claimed`: f changes sign
 * across the tolerance band, or vanishes at the claimed value.
 */
export function rootNear(source: string, claimed: number, relTol = 1e-6): boolean {
  const tree = parseExpr(source);
  const f = (x: number) => evaluateNode(tree, x);
  const h = Math.abs(claimed) * relTol + 1e-12;
  const at = f(claimed);
  if (at === 0) return true;
  const lo = f(claimed - h);
  const hi = f(claimed + h);
  return Number.isFinite(lo) && Number.isFinite(hi) && lo * hi <= 0;
}

/**
 * Solves f(x) = 0 independently of any claimed answer: scans `bracket` on a
 * grid for sign changes and bisects each one. Returns every root found, so a
 * caller can confirm the root is unique on the bracket.
 */
export function solveEquation(source: string, bracket: [number, number], gridSteps = 400): number[] {
  const tree = parseExpr(source);
  const f = (x: number) => evaluateNode(tree, x);
  const [lo, hi] = bracket;
  const roots: number[] = [];
  let previousX = lo;
  let previousF = f(lo);
  for (let step = 1; step <= gridSteps; step += 1) {
    const x = lo + ((hi - lo) * step) / gridSteps;
    const fx = f(x);
    if (Number.isFinite(previousF) && Number.isFinite(fx)) {
      if (previousF === 0) {
        roots.push(previousX);
      } else if (previousF * fx < 0) {
        let a = previousX;
        let b = x;
        let fa = previousF;
        for (let iteration = 0; iteration < 200; iteration += 1) {
          const mid = (a + b) / 2;
          const fm = f(mid);
          if (fa * fm <= 0) {
            b = mid;
          } else {
            a = mid;
            fa = fm;
          }
        }
        roots.push((a + b) / 2);
      }
    }
    previousX = x;
    previousF = fx;
  }
  return roots;
}

/** A number written for a calc string: full precision, no exponent notation for ordinary sizes. */
export function lit(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot write ${value} into an expression.`);
  const rounded = Number(value.toPrecision(15));
  const text = String(rounded);
  if (/e/i.test(text)) return rounded.toFixed(18).replace(/0+$/, "").replace(/\.$/, "");
  return rounded < 0 ? `(${text})` : text;
}

/** `(1+0.05)` — the accumulation factor for rate `i`, as an expression. */
export const onePlus = (i: number | string): string => `(1+${typeof i === "number" ? lit(i) : i})`;

/** Explicit sum of terms, written out term by term. */
export const sumOf = (terms: readonly string[]): string => (terms.length ? `(${terms.join(" + ")})` : "0");
