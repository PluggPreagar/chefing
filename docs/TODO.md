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
| T110 | Wissenschaftliche Volltext-Belege für die wichtigsten Aussagen | open | Für Aussagen mit hoher Prüf-Priorität (`node tools/aussagen-pruefen.mjs`) begutachtete Studien mit lesbarem Volltext suchen: Eiweißtemperatur und Schaum, Natron und Säure, Hefe und Temperatur. Erst mit gültigem `nachweis` darf eine Aussage `proven` oder `never` tragen. Die PDFs der Czech Journal of Food Science waren per Abruf nicht lesbar, Volltext braucht evtl. deinen Zugang. | DR-074 | 🟢🟢🟢 einziger Weg zu proven und never | 🔴🔴 Zugang zu Volltexten, viel Leseaufwand | ⚠️ gering, nur Daten; ein Beleg je Commit |
| T111 | Befunde der Konsistenzprüfung entscheiden | open | Neun harte Regeln ohne Aussage mit Ausfall (Fett und Eier vor allem: `eier_nicht_kalt`, `fett_muss_fest_fuer_aufschlagen` …) prüfen, ob `empfohlen` passender ist. Drei harte Grenzen nur `maybe` (`pk_wasser_max_hart`, `pk_fett_max_hart`, `pk_zucker_max_hart`) mit Korpus oder Quelle absichern oder entschärfen. | DR-074 | 🟢🟢 weniger Warnungen, die zu streng blockieren | 🔴 Einstufung bleibt Ermessen | ⚠️⚠️ mittel, ändert `strenge` und damit Blockaden; ein Commit je Regelgruppe, Tests `regeln`, `grenzen-kaskade` |
| T112 | Praxishinweis „kalt trennen, zimmerwarm schlagen“ im Eischnee-Schritt | open | Entscheidung offen: ein Hinweis im Schritt `eischnee_schlagen` in `techniken.json`, gestützt auf die Aussagen `wissen:eischnee-eiweiss-zimmerwarm-tempo` (likely) und `wissen:eischnee-kalte-geraete` (unlikely). Nur als Hinweis, nie als Regel. | T108 | 🟢 nützlicher Alltagstipp | 🔴 Quellenlage ohne Messung | ⚠️ gering, ein Text, ein Commit |
