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
| T120 | Butter-Schmelzbereich im Zustandsmodell | open | `schmelzpunkt_c` für Butter steht bei 34 °C, das Zustandsmodell nimmt darunter „fest“, darüber „flüssig“. Die gelesene offene Quelle (T115) zeigt: Milchfett erweicht über einen breiten Bereich bis etwa 40 °C. Prüfen, ob ein Bereich (beginnt zu erweichen, ganz flüssig) die Zustände „plastisch“ und „angeschmolzen“ besser trifft, und welche Rezepte und Regeln davon abhängen (`fett_nicht_zu_warm_zum_temperieren`, `temperieren`). Erst Konzept und Abstimmung, dann Umsetzung. | T62, T115 | 🟢 Zustand näher an der Physik | 🔴🔴 Eingriff ins Zustandsmodell, viele Tests | ⚠️⚠️ mittel bis hoch, Engine und Daten, über Git zurücknehmbar |
| T121 | Meldeweg prüfen | open | Ohne Rückmeldungen bleibt T116 blockiert. Auf dem Server prüfen: liegt die aktuelle `feedback.php` dort (nach jedem Deploy von Hand neu hochladen, README), liefert `feedback-data/feedback.jsonl` 403 oder 404 (DR-027), und ist „Hat es geklappt?“ im Live-Rezept sichtbar? Bei Bedarf Hinweis im Rezept oder Weitergabe des Links überlegen. | T116, DR-027 | 🟢🟢 schaltet T116 frei | 🔴 Serverzugriff nötig, nur von dir | ⚠️ gering, nur Prüfung; ein neuer Upload überschreibt `feedback.php` |
| T122 | Eischnee-Originalstudien beschaffen | blocked | Die Originalarbeiten von 1931 und 1994 zu Eischnee und Temperatur liegen nicht offen vor (T110). Wenn du Zugriff über eine Bibliothek oder ein Abonnement hast: PDFs bereitstellen, Volltext lesen, Nachweis für die Aussagen zu Zimmertemperatur und kalten Geräten prüfen. Ohne Zugriff bleiben sie Schätzungen. | T110 | 🟢 weitere Aussage kann `proven` oder `never` werden | 🔴🔴 braucht deinen Zugang zu den Papieren | ⚠️ gering, nur Daten in `aussagen.json` |
