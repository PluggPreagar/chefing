#!/bin/sh
# Sync zwischen Planung (claude.ai) und Umsetzung (Claude Code / lokal) — siehe HANDOFF/SYNC.md.
# Läuft offline. Aufruf aus dem Repo-Root oder von überall: sh HANDOFF/sync.sh <befehl>
set -u
cd "$(dirname "$0")/.." || exit 1
H=HANDOFF
LOG=$H/LOG.md
heute() { date +%Y-%m-%d; }
kurz() { git rev-parse --short=7 "$1" 2>/dev/null; }
sauber() { [ -z "$(git status --porcelain -- . ":(exclude)$H/inbox" ":(exclude)$H/outbox")" ] || { echo "✗ Arbeitsverzeichnis nicht sauber — erst committen/stashen."; exit 1; }; }
basis_von() { basename "$1" | cut -d- -f2; }   # JJJJMMTT-<basis7>-<thema>.patch
log() { printf '| %s | %s | %s | %s |\n' "$(heute)" "$1" "$2" "$3" >> "$LOG"; }
commit_handoff() { git add "$H" && git commit -q -m "$1" && echo "✓ $1"; }

cmd_init() {
  [ -f "$LOG" ] || printf '# HANDOFF-Log\n\nWird nur von `sync.sh` geschrieben (nicht von Hand, nicht von claude.ai).\n\n| datum | aktion | datei | ergebnis |\n|-------|--------|-------|----------|\n' > "$LOG"
  git add "$H/SYNC.md" "$H/sync.sh" "$H/CHECKLIST.md" "$LOG" "$H/applied/.gitkeep" "$H/outbox/.gitkeep" "$H/inbox/.gitkeep" 2>/dev/null
  git diff --cached --quiet && { echo "✓ HANDOFF-Werkzeug bereits committet."; return; }
  git commit -q -m "sync: HANDOFF-Werkzeug (SYNC.md, sync.sh, LOG.md)" && echo "✓ HANDOFF-Werkzeug committet."
}

cmd_status() {
  echo "HEAD:        $(kurz HEAD)  ($(git rev-parse --abbrev-ref HEAD))"
  if git rev-parse -q --verify origin/main >/dev/null; then
    set -- $(git rev-list --left-right --count origin/main...HEAD)
    echo "origin/main: $(kurz origin/main)  — lokal $2 voraus, $1 zurück (Stand letzter fetch)"
  fi
  [ -n "$(git status --porcelain)" ] && echo "Arbeitsverzeichnis: ungesichert (git status)"
  echo "Inbox (claude.ai → hier):"
  found=0
  for p in "$H"/inbox/*.patch; do
    [ -e "$p" ] || continue; found=1
    b=$(basis_von "$p")
    if git merge-base --is-ancestor "$b" HEAD 2>/dev/null; then z="Basis $b vorhanden ✓"; else z="Basis $b FEHLT/nicht Vorfahre ✗ (git am -3 versucht trotzdem)"; fi
    echo "  - $(basename "$p")  [$(grep -c '^From [0-9a-f]\{40\}' "$p") Commits, $z]"
  done
  [ $found = 1 ] || echo "  (leer)"
  echo "Outbox (hier → claude.ai): $(ls "$H"/outbox/*.patch 2>/dev/null | wc -l | tr -d ' ') Datei(en)"
}

cmd_apply() {
  [ -f "$LOG" ] && git ls-files --error-unmatch "$LOG" >/dev/null 2>&1 || cmd_init
  sauber
  liste=${1:-$(ls "$H"/inbox/*.patch 2>/dev/null | sort)}
  [ -n "$liste" ] || { echo "Inbox leer."; return; }
  for p in $liste; do
    echo "→ $(basename "$p")"
    if git am -3 "$p"; then
      cmd_done "$p" quiet
    else
      echo "✗ Konflikt. Lösen: Dateien bearbeiten, git add <datei>, git am --continue"
      echo "  danach:  sh $H/sync.sh done $p     — oder abbrechen: git am --abort"
      echo "  T-/DR-Nummern kollidiert? Regel in $H/SYNC.md §5."
      exit 1
    fi
  done
  cmd_test
}

cmd_done() {
  p=$1; [ -f "$p" ] || p=$H/inbox/$(basename "$1")
  [ -f "$p" ] || { echo "✗ $1 nicht in inbox."; exit 1; }
  [ -d .git/rebase-apply ] && { echo "✗ git am läuft noch — erst git am --continue."; exit 1; }
  ziel=$H/applied/$(basename "$p")
  mv "$p" "$ziel" && git add -A "$H/inbox" "$ziel"
  log "applied" "$(basename "$p")" "HEAD $(kurz HEAD)"
  commit_handoff "sync: $(basename "$p") angewendet"
}

cmd_export() {
  git rev-parse -q --verify origin/main >/dev/null || { echo "✗ origin/main unbekannt."; exit 1; }
  # sync:-Commits (nur HANDOFF-Verwaltung) gehören nicht in den Export
  n=$(git rev-list --count --invert-grep --grep='^sync:' origin/main..HEAD)
  [ "$n" -gt 0 ] || { echo "Nichts unveröffentlicht — für claude.ai reicht ein push (oder ist schon aktuell)."; return; }
  f=$H/outbox/$(date +%Y%m%d)-$(kurz origin/main)-lokal.patch
  git format-patch --stdout --invert-grep --grep='^sync:' origin/main..HEAD -- . ":(exclude)$H" > "$f"
  echo "✓ $f ($n Commits). In claude.ai hochladen — oder einfach pushen."
  echo "  Nach dem Hochladen/Pushen: sh $H/sync.sh exported $f"
}

cmd_exported() {
  [ -f "$1" ] || { echo "✗ $1 fehlt."; exit 1; }
  log "exported" "$(basename "$1")" "an claude.ai übergeben"
  rm -f "$1"; git add -A "$H" && git commit -q -m "sync: $(basename "$1") an claude.ai übergeben" && echo "✓ protokolliert."
}

cmd_test() { if [ -f test/run.sh ]; then sh test/run.sh || { echo "✗ Tests fehlgeschlagen."; return 1; }; else echo "(keine test/run.sh)"; fi; }

case "${1:-status}" in
  init) cmd_init ;;
  status) cmd_status ;;
  apply) shift; cmd_apply "${1:-}" ;;
  done) cmd_done "${2:?Datei angeben}" ;;
  export) cmd_export ;;
  exported) cmd_exported "${2:?Datei angeben}" ;;
  test) cmd_test ;;
  *) echo "Befehle: init | status | apply [datei] | done <datei> | export | exported <datei> | test"; exit 2 ;;
esac
