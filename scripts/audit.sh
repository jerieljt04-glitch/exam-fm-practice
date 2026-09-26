#!/bin/bash
#
# Independent audit of the question engine.
#
# The generators compute answers with closed-form actuarial factors. This audit
# re-derives every answer in Python — explicit cash-flow ledgers, year-by-year
# amortization, numerical integration, bisection — sharing no code with the
# TypeScript engine, so a wrong formula there cannot be reproduced here.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP="$(mktemp -t exam-fm-audit).json"
trap 'rm -f "$DUMP"' EXIT

command -v python3 >/dev/null 2>&1 || {
  echo "python3 is required for the independent audit" >&2
  exit 1
}

echo "Auditing the question engine"
npx ts-node --compiler-options '{"module":"CommonJS"}' "$ROOT/scripts/audit-dump.ts" "$DUMP" "${1:-8}"
python3 "$ROOT/scripts/audit-answers.py" "$DUMP"

echo
echo "Checking every question type against the SOA's published answers"
python3 "$ROOT/scripts/audit-anchors.py"
