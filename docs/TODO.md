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
| T109 | Marken und Aussagen für die übrigen Meldungen | open | Aussagen und Marke auch für Meldungen aus Voraussetzungen, Techniken, Zeit-Fenstern, Trieb, Werkzeug, Emulsion, Gärmodell und Archetyp-Hinweisen. Diese Meldungen tragen im Ergebnis noch keine Regel-ids je Text; zuerst `computed.marken` auf alle Quellen ausdehnen, dann die Aussagen schreiben. | DR-074 | 🟢🟢 Marke überall statt nur an Grenzen | 🔴🔴 viele Quellen, Texte ohne ids | ⚠️⚠️ mittel, berührt `engine.js` an vielen Stellen; ein Commit je Quelle |
| T110 | Wissenschaftliche Volltext-Belege für die wichtigsten Aussagen | open | Für Aussagen mit hoher Prüf-Priorität (`node tools/aussagen-pruefen.mjs`) begutachtete Studien mit lesbarem Volltext suchen: Eiweißtemperatur und Schaum, Natron und Säure, Hefe und Temperatur. Erst mit gültigem `nachweis` darf eine Aussage `proven` oder `never` tragen. Die PDFs der Czech Journal of Food Science liegen lokal vor, ich kann sie aber nicht lesen: dem Lese-Werkzeug fehlt `pdftoppm` (Poppler) auf diesem Rechner. Aufgabe für dich: Poppler installieren, danach lese ich Volltexte selbst. | DR-074 | 🟢🟢🟢 einziger Weg zu proven und never | 🔴🔴 Zugang zu Volltexten, viel Leseaufwand | ⚠️ gering, nur Daten; ein Beleg je Commit |
| T112 | Eischnee-Hinweis „Eier kalt trennen, Eiweiß zimmerwarm schlagen“ im Schritt | open | Entschieden (2026-10-24): Hinweis im Schritt `eischnee_schlagen`, Aussage `wissen:eischnee-eiweiss-zimmerwarm-tempo`, 3 Sterne berechnet (spürbar mal likely). Als erster Eintrag in `hinweise.json`, mit Anzeige im Ablauf. Die fettfreie Schüssel wird ein eigener Hinweis, die kalten Geräte bleiben unter Verdacht und werden nicht gezeigt. | T113, DR-075 | 🟢🟢 nützlicher Alltagstipp, erster Test der Sterne | 🔴 Quellenlage ohne Messung | ⚠️ gering, ein Text und seine Anzeige, ein Commit |
| T113 | Hinweis-Schema und Sternformel | open | `src/data/hinweise.json` (id, Ort, Text, `aussage`, optional `sterne_manuell` und `sterne_grund`); `hinweisSterne` in `aussagen.js`: Wirkungspunkte (ohne Folge 0, leicht 2, spürbar 4, Ausfall 5) mal Gewissheitsfaktor (never 0, unlikely 0,4, maybe 0,6, likely 0,8, surely und proven 1), gerundet, höchstens 5; Override gewinnt und braucht einen Grund. Prüfung in `test/aussagen.check.mjs`: Aussage existiert, Sterne 0 bis 5, Override mit Grund. | DR-075 | 🟢🟢 Grundlage für Stufen und Hinweise | 🔴 Formelwerte sind Schätzungen | ⚠️ gering, neue Datei und Funktion, ein Commit |
| T114 | Nutzerstufe: Einsteiger, Fortgeschritten, Profi filtert Hinweise | open | Schalter als Knopfgruppe (je Browser gemerkt), Schwelle je Stufe, Vorgabe für neue Nutzer; Hinweise unter der Schwelle erscheinen nicht, Warnungen bleiben immer. Schwellen entschieden (2026-10-24): Einsteiger ab 1 Stern, Fortgeschritten ab 3, Profi ab 5; Vorgabe Einsteiger. Ort des Schalters ist noch offen. | T113, DR-075 | 🟢🟢 weniger Rauschen für Fortgeschrittene, mehr Hilfe für Einsteiger | 🔴 noch ein Schalter im Kopf | ⚠️ gering bis mittel, `main.js`, `index.html`, Anzeige; ein Commit |
