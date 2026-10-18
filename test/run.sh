#!/bin/sh
# Headless-Checks (T07): node test/run.sh oder sh test/run.sh — Node >= 22, keine Abhängigkeiten.
cd "$(dirname "$0")/.." || exit 1
rc=0
for f in test/*.check.mjs; do
  echo "== $f"
  node --experimental-default-type=module "$f" 2>&1 | grep -v ExperimentalWarning | grep -E "FAIL|ALL PASS" || rc=1
  node --experimental-default-type=module "$f" 2>&1 | grep -q FAIL && rc=1
done
exit $rc
