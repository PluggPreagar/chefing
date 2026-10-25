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
| T122 | Eischnee-Originalstudien beschaffen | blocked | Die Originalarbeiten von 1931 und 1994 zu Eischnee und Temperatur liegen nicht offen vor (T110). Wenn du Zugriff über eine Bibliothek oder ein Abonnement hast: PDFs bereitstellen, Volltext lesen, Nachweis für die Aussagen zu Zimmertemperatur und kalten Geräten prüfen. Ohne Zugriff bleiben sie Schätzungen. | T110 | 🟢 weitere Aussage kann `proven` oder `never` werden | 🔴🔴 braucht deinen Zugang zu den Papieren | ⚠️ gering, nur Daten in `aussagen.json` |
| T123 | Live-Seite aktualisieren und eine Meldung selbst senden | open | Nur du: Stand auf `origin/main` prüfen, `deploy.php` aufrufen (die Live-Seite steht auf dem Stand vom 2026-10-22), dann im Rezept „Hat es geklappt?“ einmal selbst senden. Danach prüfen, dass `https://hamsch.net/chefing/feedback-data/feedback.jsonl` 403 oder 404 liefert (die `.htaccess` entsteht bei der ersten Meldung, DR-027) und die Zeile mit `tools/rueckmeldungen.mjs` lesbar ist. Meine Seite: ich kann `deploy.php` nur nach deiner ausdrücklichen Bestätigung aufrufen. Meldungen aus dem Selbsttest bitte aus der Datei löschen, damit sie T116 nicht verfälschen. | T116, T121, DR-013, DR-027 | 🟢🟢 bringt Hinweise, Aussagen und den Meldeweg live | 🔴 Deploy überschreibt die Live-Dateien sofort, kein Rückweg | ⚠️⚠️ mittel, Live-Seite; Kommentar in der Meldung kann Personenbezug haben, nur Testtext senden |
