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
| T110 | Wissenschaftliche Volltext-Belege für die wichtigsten Aussagen | open | Für Aussagen mit hoher Prüf-Priorität (`node tools/aussagen-pruefen.mjs`) begutachtete Studien mit lesbarem Volltext suchen: Eiweißtemperatur und Schaum, Natron und Säure, Hefe und Temperatur. Erst mit gültigem `nachweis` darf eine Aussage `proven` oder `never` tragen. Teilweise erledigt (2026-10-24): PDFs lassen sich ohne Poppler mit `pdfjs-dist` im Scratchpad lesen (`npm install pdfjs-dist` plus kleines Skript, kein Teil des Projekts). Gelesen sind vier Aufsätze der Czech Journal of Food Science; nur die begutachtete Übersicht von 2006 behandelt die Schlagtemperatur, die Originalstudien dahinter nur aus zweiter Hand. Offen: die Originale (St. John und Flor 1931, Stadelman und Cotterill 1994) sowie Belege zu Natron und Säure und zu Hefe und Temperatur. | DR-074 | 🟢🟢🟢 einziger Weg zu proven und never | 🔴🔴 Originale sind alt und evtl. nicht frei zugänglich | ⚠️ gering, nur Daten; ein Beleg je Commit |
