#!/usr/bin/env python3
"""Runs every independent check on the SOA sample question its template is
modelled on and compares with the SOA's published answer. See
scripts/audit_checks/anchors.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audit_checks.common import CHECKS  # noqa: E402
from audit_checks import tvm, annuities, loans, bonds, alm  # noqa: E402,F401
from audit_checks.anchors import ANCHORS  # noqa: E402


def main() -> int:
    bad = 0
    for tid, sample, params, published, allowance in ANCHORS:
        fn = CHECKS.get(tid)
        if fn is None:
            print(f"  x {tid}: no independent check registered")
            bad += 1
            continue
        got, _ = fn(params)
        values = got if isinstance(got, (list, tuple)) else [got]
        if isinstance(published, str):
            ok = published in str(got)
        else:
            ok = any(abs(value - published) <= allowance + 1e-9 for value in values)
        if not ok:
            print(f"  x {tid} (SOA #{sample}): recomputed {got!r}, published {published}")
            bad += 1
    print(f"  {len(ANCHORS) - bad} of {len(ANCHORS)} question types reproduce the SOA's published answer")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
