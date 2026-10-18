#!/bin/sh
# Headless-Checks (T07): sh test/run.sh — Node >= 18, keine Abhängigkeiten, Linux/Mac/Windows.
cd "$(dirname "$0")/.." || exit 1
rc=0
for f in test/*.check.mjs; do
  echo "== $f"
  out=$(node "$f" 2>&1)
  echo "$out" | grep -E "FAIL|ALL PASS|Error"
  echo "$out" | grep -q "ALL PASS" || rc=1
  echo "$out" | grep -qE "FAIL|Error" && rc=1
done
exit $rc
