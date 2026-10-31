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


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "validation-export.json"
    questions = json.loads(path.read_text())
    failed = 0
    for q in questions:
        problems = check_question(q)
        if problems:
            failed += 1
            print(f"  ✗ {q['id']}")
            for problem in problems[:5]:
                print(f"      {problem}")
    checked_options = sum(len(q["options"]) for q in questions)
    print(f"SymPy validation: {len(questions) - failed} of {len(questions)} questions passed ({checked_options} options re-derived exactly).")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
