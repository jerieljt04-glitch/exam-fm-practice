#!/usr/bin/env python3
"""Independent validation of the question bank with SymPy and exact arithmetic.

Reads the export written by scripts/export-bank.ts and, for every question:

  1. evaluates each option's arithmetic exactly (decimal inputs become exact
     rationals; roots and logarithms are evaluated to 40 significant figures),
     or solves it with nsolve when it is an equation in x;
  2. checks the value the TypeScript engine stored for the option;
  3. checks that every displayed string is the exact value correctly rounded;
  4. solves the question's equation of value (written from explicit cash flows)
     independently and checks that exactly one option matches it;
  5. checks that all five displayed options are distinct.

Typed questions are checked the same way:

  6. composite answers (ordered pairs, allocations): every component of every
     option is re-derived and its display checked, each component's reference
     is solved independently, and exactly one option must match the reference
     in every component;
  7. truth claims (quantitative statements I/II/III and option checks) are
     re-evaluated exactly and must have the truth value the engine relied on;
  8. equation and expression options: the reference quantity is solved
     independently and exactly one option — the correct one — must define it.

Exit status is non-zero if any question fails.

    python3 scripts/validate_sympy.py [path/to/validation-export.json]
"""

from __future__ import annotations

import json
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import mpmath
import sympy as sp

X = sp.Symbol("x")
PRECISION = 40


def parse(expression: str) -> sp.Expr:
    # Decimal inputs become exact rationals; evaluate=False keeps SymPy from expanding
    # (1 + 21/400)**(-300) into enormous exact fractions before the numerical pass.
    return sp.sympify(expression, locals={"x": X, "log": sp.log, "exp": sp.exp, "sqrt": sp.sqrt}, rational=True, evaluate=False)


def value_of(expression: str, near: float) -> sp.Float:
    """Value of an arithmetic expression to 40 digits, or the root of f(x) = 0 nearest `near`."""
    expr = parse(expression)
    if expr.has(X):
        mpmath.mp.dps = PRECISION
        # Exact rationals become 40-digit floats so lambdify hands mpmath plain numbers.
        numeric = expr.xreplace({r: sp.Float(r, PRECISION) for r in expr.atoms(sp.Rational)})
        f = sp.lambdify(X, numeric, "mpmath")
        # Bracket the root around the engine's value so equations with several
        # roots (such as (1 + x)^n = c) resolve to the one in question.
        width = abs(near) * 0.5 + 1e-9
        a, b = mpmath.mpf(near) - width, mpmath.mpf(near) + width
        if mpmath.sign(f(a)) != mpmath.sign(f(b)):
            for _ in range(160):  # bisection: certain to stay inside the bracket
                mid = (a + b) / 2
                if mpmath.sign(f(mid)) == mpmath.sign(f(a)):
                    a = mid
                else:
                    b = mid
            root = (a + b) / 2
        else:
            root = mpmath.findroot(f, mpmath.mpf(near), verify=False)
        if abs(f(root)) > mpmath.mpf(10) ** (-(PRECISION // 2)) * max(1, abs(f(a)), abs(f(b))):
            raise ValueError(f"no root found near {near}")
        return sp.Float(root, PRECISION)
    return sp.Float(expr.evalf(PRECISION), PRECISION)


def rounded(value: sp.Float, fmt: dict) -> Decimal:
    decimals = fmt["decimals"] + (2 if fmt["kind"] == "percent" else 0)
    quantum = Decimal(1).scaleb(-decimals)
    return Decimal(str(sp.N(value, PRECISION))).quantize(quantum, rounding=ROUND_HALF_UP)


def displayed(display: str, fmt: dict) -> Decimal:
    text = display.replace(",", "").replace("%", "").replace("−", "-").split(" ")[0]
    number = Decimal(text)
    return number / 100 if fmt["kind"] == "percent" else number


def near_boundary(value: sp.Float, fmt: dict) -> bool:
    decimals = fmt["decimals"] + (2 if fmt["kind"] == "percent" else 0)
    scaled = Decimal(str(sp.N(value, PRECISION))).scaleb(decimals)
    fraction = abs(scaled - scaled.to_integral_value(rounding="ROUND_FLOOR"))
    return abs(fraction - Decimal("0.5")) < Decimal("1e-6")


def check_question(q: dict) -> list[str]:
    problems: list[str] = []
    fmt = q["format"]
    correct = next(o for o in q["options"] if o["isCorrect"])
    exact: dict[str, sp.Float] = {}

    for option in q["options"]:
        try:
            v = value_of(option["calc"], option["value"])
        except Exception as error:  # noqa: BLE001 - report any SymPy failure as a validation failure
            problems.append(f"{option['key']} ({option['misconception']}): cannot evaluate calc: {error}")
            continue
        exact[option["key"]] = v
        reference = abs(option["value"]) or 1.0
        if abs(float(v) - option["value"]) > 1e-9 * max(1.0, reference):
            problems.append(f"{option['key']} ({option['misconception']}): engine value {option['value']} but exact value {v}")
        if not near_boundary(v, fmt) and rounded(v, fmt) != displayed(option["display"], fmt):
            problems.append(f"{option['key']}: displays {option['display']} but the exact value rounds to {rounded(v, fmt)}")

    try:
        model_value = value_of(q["model"], correct["value"])
    except Exception as error:  # noqa: BLE001
        return problems + [f"model cannot be solved: {error}"]

    matches = [key for key, v in exact.items() if rounded(v, fmt) == rounded(model_value, fmt)]
    if matches != [correct["key"]]:
        problems.append(f"options matching the equation of value: {matches}, expected only {correct['key']} (model value {sp.N(model_value, 12)})")

    if len({displayed(o["display"], fmt) for o in q["options"]}) != len(q["options"]):
        problems.append("two options display the same value")
    return problems


def close(a, b, tol=1e-6) -> bool:
    return abs(a - b) <= tol * max(1, abs(a), abs(b))


def check_composite(q: dict) -> list[str]:
    problems: list[str] = []
    refs = []
    for k, comp in enumerate(q["components"]):
        try:
            refs.append(value_of(comp["model"], comp["near"]))
        except Exception as error:  # noqa: BLE001
            return [f"component {k + 1} reference cannot be solved: {error}"]
    matching = []
    tuples = set()
    for option in q["options"]:
        all_match = True
        shown = []
        for k, part in enumerate(option["parts"]):
            fmt = q["components"][k]["format"]
            try:
                v = value_of(part["calc"], part["value"])
            except Exception as error:  # noqa: BLE001
                problems.append(f"{option['key']} component {k + 1}: cannot evaluate calc: {error}")
                all_match = False
                continue
            if abs(float(v) - part["value"]) > 1e-9 * max(1.0, abs(part["value"])):
                problems.append(f"{option['key']} component {k + 1}: engine value {part['value']} but exact value {v}")
            if not near_boundary(v, fmt) and rounded(v, fmt) != displayed(part["display"], fmt):
                problems.append(f"{option['key']} component {k + 1}: displays {part['display']} but rounds to {rounded(v, fmt)}")
            if rounded(v, fmt) != rounded(refs[k], fmt):
                all_match = False
            shown.append(part["display"])
        tuples.add(tuple(shown))
        if all_match:
            matching.append(option["key"])
    correct = [o["key"] for o in q["options"] if o["isCorrect"]]
    if matching != correct:
        problems.append(f"options matching every reference component: {matching}, expected only {correct}")
    if len(tuples) != len(q["options"]):
        problems.append("two options display the same values")
    return problems


def numeric(expression) -> sp.Float:
    if isinstance(expression, (int, float)):
        return sp.Float(expression, PRECISION)
    return sp.Float(parse(expression).evalf(PRECISION), PRECISION)


def check_claims(q: dict) -> list[str]:
    problems: list[str] = []
    for claim in q["claims"]:
        try:
            lhs = numeric(claim["expr"])
            rhs = numeric(claim["than"])
        except Exception as error:  # noqa: BLE001
            problems.append(f"{claim['source']}: cannot evaluate: {error}")
            continue
        tol = claim.get("tol") or 1e-6
        eq = abs(lhs - rhs) <= tol * max(1, abs(lhs), abs(rhs))
        op = claim["op"]
        holds = {
            "<": lhs < rhs and not eq,
            "<=": lhs <= rhs or eq,
            ">": lhs > rhs and not eq,
            ">=": lhs >= rhs or eq,
            "=": eq,
            "!=": not eq,
        }[op]
        if bool(holds) != claim["expected"]:
            problems.append(f"{claim['source']}: claim {op} evaluates to {bool(holds)} exactly, engine relied on {claim['expected']}")
    return problems


def check_probes(q: dict) -> list[str]:
    try:
        ref = value_of(q["reference"], q["near"])
    except Exception as error:  # noqa: BLE001
        return [f"reference cannot be solved: {error}"]
    matching = []
    for option in q["options"]:
        try:
            v = value_of(option["probe"], float(ref))
        except Exception:  # noqa: BLE001 - no root near the reference: the option does not define it
            continue
        if close(float(v), float(ref)):
            matching.append(option["key"])
    correct = [o["key"] for o in q["options"] if o["isCorrect"]]
    return [] if matching == correct else [f"options defining the reference quantity {sp.N(ref, 10)}: {matching}, expected only {correct}"]


CHECKS = {"numeric": check_question, "composite": check_composite, "claims": check_claims, "probes": check_probes}


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "validation-export.json"
    questions = json.loads(path.read_text())
    failed = 0
    for q in questions:
        problems = CHECKS[q.get("kind", "numeric")](q)
        if problems:
            failed += 1
            print(f"  ✗ {q['id']}")
            for problem in problems[:5]:
                print(f"      {problem}")
    kinds = {}
    for q in questions:
        kinds[q.get("kind", "numeric")] = kinds.get(q.get("kind", "numeric"), 0) + 1
    checked_options = sum(len(q.get("options", [])) for q in questions if q.get("kind", "numeric") in ("numeric", "composite"))
    claims = sum(len(q["claims"]) for q in questions if q.get("kind") == "claims")
    print(
        f"SymPy validation: {len(questions) - failed} of {len(questions)} records passed "
        f"({', '.join(f'{k}: {n}' for k, n in kinds.items())}; {checked_options} numeric/composite options re-derived exactly, {claims} truth claims re-evaluated)."
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
