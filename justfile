# Chefing: Aufgaben für die Entwicklung (https://github.com/casey/just). `just` zeigt die Liste.
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

# Lokalen Server starten: Seite auf http://127.0.0.1:PORT/, "Fehler melden" speichert in issues/open/
serve port="8780":
    python tools/dev-server.py --port {{port}}

# Alle Headless-Prüfungen (Node >= 18, die PHP-Tests brauchen PHP ab 8.1)
test:
    sh test/run.sh

# Gespeicherte Fehlermeldungen auflisten (neueste zuletzt)
issues:
    python -c "import pathlib; print('\n'.join(p.name for p in sorted(pathlib.Path('issues/open').glob('*')) if p.is_dir()))"

# src/manifest.json neu schreiben (nach neuen oder umbenannten Modulen)
manifest:
    node tools/manifest.mjs
