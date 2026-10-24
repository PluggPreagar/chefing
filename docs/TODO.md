# Chefing — Todo

States: `open` · `doing` · `blocked` · `done`

Abgeschlossene Einträge werden nach `docs/TODO_ARCHIVE.md` verschoben (neueste oben),
sobald sie auf `done` gesetzt werden — diese Liste zeigt nur aktive Arbeit. Beim Archivieren
entfallen `pro`/`contra`/`risk` (Entscheidungshilfe, nach der Umsetzung nicht mehr nötig).

Jedes offene Todo trägt `pro`/`contra`/`risk` im KISS-Format: 🟢 Pro, 🔴 Contra, ⚠️ Risk
(1–3× = schwach/klar/extrem). `risk` nennt Wirkungsbereich und Rückgängig-Aufwand.
Neue Todos bekommen die drei Felder von Anfang an.

| id | title | state | descr | dependencies | pro | contra | risk |
|----|-------|-------|-------|--------------|-----|--------|------|
| T116 | Gewissheit aus Rückmeldungen anheben | blocked | Wartet auf genug Meldungen (mindestens 3 je Regel). Die echten Meldungen liegen nur auf dem Server in `feedback-data/feedback.jsonl` (nicht per HTTP lesbar, nicht im Repo). Sobald genug da sind: Datei per FTP holen, `node tools/rueckmeldungen.mjs <datei>` ausführen, die Vorschläge je Aussage prüfen und die Gewissheit in `src/data/aussagen.json` nach Freigabe von Hand anheben (nie auf `never` oder `proven`). | T107, DR-074 | 🟢🟢 Gewissheit stützt sich auf echte Nutzung | 🔴🔴 hängt von der Zahl der Meldungen ab | ⚠️ gering, nur Daten in `aussagen.json`, ein Commit zurücknehmbar |
