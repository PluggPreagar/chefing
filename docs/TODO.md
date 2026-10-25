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
| T123 | Eine Meldung selbst senden und prüfen | open | Stand 2026-10-25: Upload und Deploy sind erledigt. Auf dem Server liegen `chefing-feedback.php` und `chefing-issue.php` (GET antwortet 405, wie gebaut), die alte `feedback.php` ist weg, live ist `7daaf14`. Der Vollbild-Commit (`a7aed0b`, T124) war beim Deploy noch nicht auf GitHub. Offen, nur du: (1) im Rezept „Hat es geklappt?“ einmal mit Testtext senden und über „Fehler melden“ → „Absenden“ eine Testmeldung schicken; (2) prüfen, dass `https://hamsch.net/chefing/feedback-data/feedback.jsonl` und `…/issues-data/` 403 oder 404 liefern (die `.htaccess` entsteht erst bei der ersten Meldung, DR-027, DR-077); (3) die Testzeile aus `feedback.jsonl` und den Test-Ordner aus `issues-data/open/` löschen, damit sie T116 nicht verfälschen; (4) `tools/rueckmeldungen.mjs` einmal auf der heruntergeladenen Datei laufen lassen. Kommentare können Personenbezug haben, nur Testtext senden. | T116, T121, DR-013, DR-027, DR-077 | 🟢🟢 bestätigt den Meldeweg Ende zu Ende | 🔴 Schreibzugriff auf die Live-Seite, nur du | ⚠️ gering, Testdaten löschen |
