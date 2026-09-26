#!/usr/bin/env python3
"""
Independent audit of the Exam FM question engine.

Nothing here imports or mirrors the TypeScript engine. Every answer is
re-derived from first principles in `scripts/audit_checks/`: explicit cash-flow
ledgers, period-by-period amortization, numerical integration and bisection.
Where a generator uses a closed-form actuarial factor, the checks deliberately
do not, so a wrong formula in the engine cannot be reproduced by the checker.

Audited for every generated instance:

  1. the answer itself, recomputed from first principles;
  2. every rate printed in the question is exactly the rate the answer used, so
     the figures a candidate reads are the figures the key was built from;
  3. the option flagged correct carries that answer, and no distractor
     coincides with it;
  4. the worked solution actually states the answer.

Qualitative items (true/false statements, equations of value) are checked for
structure, and — where a re-derivation is registered — for the key itself.

Run with: npm run audit
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audit_checks.common import CHECKS  # noqa: E402
from audit_checks import tvm, annuities, loans, bonds, alm  # noqa: E402,F401

NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
PCT = re.compile(r"(\d+(?:\.\d+)?)\s*\\?%")


def numbers_in(vars_):
    out = []
    for key, val in vars_.items():
        if key == "_seed":
            continue
        if isinstance(val, bool):
            continue
        if isinstance(val, (int, float)):
            out.append(val)
        elif isinstance(val, list):
            out += [x for x in val if isinstance(x, (int, float)) and not isinstance(x, bool)]
    return out


def printed_decimals(fmt):
    try:
        return int(fmt.split("_")[1])
    except (IndexError, ValueError):
        return 2


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "audit.json"
    everything = json.load(open(path))
    rows = [r for r in everything if r.get("kind") != "CHOICE"]
    choices = [r for r in everything if r.get("kind") == "CHOICE"]
    fail = collections.defaultdict(list)

    for r in choices:
        opts = r["options"]
        where = f'{r["id"]} draw {r["draw"]}'
        if len(opts) != 5:
            fail["E: a choice item does not offer five choices"].append(f"{where}: {len(opts)} choices")
        correct = [o for o in opts if o["correct"]]
        if len(correct) != 1:
            fail["E: a choice item has not exactly one correct choice"].append(f"{where}: {len(correct)} marked correct")
        if len({o["text"].strip() for o in opts}) != len(opts):
            fail["E: a choice item repeats a choice"].append(where)
        if any(not o["text"].strip() for o in opts):
            fail["E: a choice item has an empty choice"].append(where)
        if any(not o["why"].strip() for o in opts if not o["correct"]):
            fail["E: a wrong choice has no explanation"].append(where)
        if not r["solution"].strip():
            fail["E: a choice item has no solution"].append(where)
        fn = CHECKS.get(r["id"])
        if fn and len(correct) == 1:
            try:
                expected, _ = fn(r["vars"])
            except Exception as exc:  # a check that cannot re-derive the key is a failure, not a crash
                fail["F: the re-derivation failed"].append(f"{where}: {exc}")
                continue
            if expected is not None and expected not in correct[0]["text"]:
                fail["F: the keyed choice disagrees with the re-derivation"].append(
                    f'{where}: keyed {correct[0]["text"]!r}, expected to contain {expected!r}')

    for r in rows:
        vals = numbers_in(r["vars"])

        # (A) every rate printed in the stem must be a rate that was used (as a
        #     decimal rate or already scaled to percent). The match must be
        #     exact, not merely equal after rounding: a key
        #     computed from 8.2432% while the stem prints 8.24% is wrong by the
        #     rounding, which matters whenever the answer is a small remainder.
        for shown in PCT.findall(r["question"]):
            shown_num = float(shown)
            # A decrease of 2% is stored as a growth rate of -0.02.
            matched = any(abs(abs(cand) - shown_num) < 1e-7 for x in vals for cand in (x * 100.0, x))
            if not matched:
                fail["A: printed rate differs from the rate used"].append(
                    f'{r["id"]} draw {r["draw"]}: stem shows {shown}%')

        # (G) likewise every decimal figure printed in the stem (a price of
        #     66.4, a factor of 1.0204, a force of 0.055, a growth factor 1.03)
        #     must be a value the key was computed from, exactly.
        stem = re.sub(r"\\[a-zA-Z]+", " ", r["question"]).replace("{,}", ",")
        for shown in re.findall(r"(?<![\d.])(\d[\d,]*\.\d+)(?![\d.])(?!\s*\\?%)", stem):
            shown_num = float(shown.replace(",", ""))
            if not any(
                abs(x - shown_num) < 1e-7 or abs(x * 100 - shown_num) < 1e-7 or abs(1 + x - shown_num) < 1e-7
                for x in vals
            ):
                fail["G: printed figure differs from the value used"].append(
                    f'{r["id"]} draw {r["draw"]}: stem shows {shown}')

        # (B) the option flagged correct must carry the formatted correct answer
        correct = [o for o in r["options"] if o["correct"]]
        if len(correct) != 1:
            fail["B: not exactly one correct option"].append(f'{r["id"]} draw {r["draw"]}')
        elif correct[0]["text"] != r["correctLabel"]:
            fail["B: correct option carries the wrong value"].append(
                f'{r["id"]} draw {r["draw"]}: {correct[0]["text"]!r} vs {r["correctLabel"]!r}')

        # (C) no distractor may coincide with the correct answer
        if any(abs(d - r["correct"]) < 1e-9 for d in r["distractors"]):
            fail["C: a distractor equals the correct answer"].append(f'{r["id"]} draw {r["draw"]}')

        # (D) the worked solution must state the answer. Options are quoted
        #     rounded, solutions to more places, so compare against the unrounded
        #     value with an allowance for the printed precision.
        numeric = NUM.findall(r["solution"].replace("{,}", ",").replace("–", "-"))
        want = r["correct"]
        tol = max(0.51 * 10 ** (-printed_decimals(r["format"])), abs(want) * 1e-4)
        found = False
        for n in numeric:
            try:
                if abs(abs(float(n.replace(",", ""))) - abs(want)) <= tol:
                    found = True
                    break
            except ValueError:
                pass
        if not found:
            fail["D: solution never states the answer"].append(f'{r["id"]} draw {r["draw"]}: answer {want!r}')

    missing = sorted({r["id"] for r in rows} - set(CHECKS))
    disagree = []
    for r in rows:
        fn = CHECKS.get(r["id"])
        if not fn:
            continue
        try:
            expected, tol = fn(r["vars"])
        except Exception as exc:  # e.g. no root to bracket: report it against the instance
            disagree.append((r["id"], r["draw"], r["correct"], f"check failed: {exc}", float("inf")))
            continue
        # A check may return several equally valid re-derivations (for example when
        # the stem randomly asks for one of two complementary figures).
        cands = expected if isinstance(expected, (list, tuple)) else [expected]
        rel = min(abs(r["correct"] - c) / max(1.0, abs(c)) for c in cands)
        if rel > tol:
            disagree.append((r["id"], r["draw"], r["correct"], expected, rel))

    templates = len({r["id"] for r in everything})
    print(f"  {len(everything)} instances across {templates} templates")
    print(f"  {len(rows)} numeric, {len(choices)} choice")
    print(f"  answers recomputed independently: {len(rows) - len(disagree)} agree, {len(disagree)} disagree")
    if missing:
        print(f"  NO INDEPENDENT CHECK FOR: {missing}")
    for tid, draw, got, exp, rel in disagree[:40]:
        print(f"    x {tid} draw {draw}: engine={got!r} independent={exp!r} rel={rel:.3g}")

    problems = sum(len(items) for items in fail.values())
    print(f"  question / option / solution consistency: {problems} problems")
    for kind, items in sorted(fail.items()):
        print(f"    x {kind} ({len(items)})")
        for line in items[:8]:
            print(f"        {line}")

    if disagree or problems or missing:
        print()
        print("  AUDIT FAILED")
        return 1
    print()
    print("  audit passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
