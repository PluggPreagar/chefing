# Chefing — Todo

States: `open` · `doing` · `blocked` · `done`

Abgeschlossene Einträge werden nach `docs/TODO_ARCHIVE.md` verschoben (neueste oben),
sobald sie auf `done` gesetzt werden — diese Liste zeigt nur aktive Arbeit.

| id | title | state | descr | dependencies |
|----|-------|-------|-------|--------------|
| T03 | README | open | Kurzbeschreibung, Start (`npx serve`), Datenmodell-Übersicht, wie neue Archetypen/Korpus ergänzt werden. | T01 |
| T04 | Korpus erweitern | open | Mehr Quellrezepte je Variante (Ziel ≥ 15), damit Median/IQR belastbar werden. Quellen: gutekueche.at, oetker.de, lecker.de, kuechengoetter.de (chefkoch blockiert Fetch). Achtung (DR-015): auf Breite statt Tiefe pro Domain achten, keinen „wesentlichen Teil“ einer einzelnen Quelle entnehmen (Datenbankschutz § 87a UrhG). | T01 |
| T05 | Varianten-Cluster in Statistik | open | Korpus nach Fett-Typ × Säure × Einlage clustern und im Stats-Panel zeigen (war im Plan, noch nicht umgesetzt). | T04 |
| T06 | Zweiter Archetyp als reine Daten | open | Z. B. „Gemüse braten“ oder „Hefeteig“ — nur JSON ergänzen, keine JS-Sonderlogik. `rules.js` referenziert noch `archetypes.ruehrteig` hart (Zeilen 104, 112) → generalisieren. Baut auf T08 (Kategorien) auf. | T08 |
| T07 | Tests headless | open | `check.mjs` aus dem Scratchpad ins Repo (`test/`) übernehmen und um Regel-Fälle (u. a. `strenge`) erweitern. | T01, T08 |
| T10 | Strenge auf Zutat-Ebene (Rollen) | open | Substitutionsfreiheit auch für Zutat-Wahl markieren (z. B. Einlage-Frucht frei austauschbar, Struktur-Mehl strikt), nicht nur für Operationen. | T08 |
| T21 | Icon für Gewürze | open | Gewürze teilen sich aktuell Kategorie und Icon mit Pulver/Backtriebmittel/Kakao (`pulver`: Kegel + Streupunkte) — eigenes, unterscheidbares Icon (ggf. eigene Unterkategorie) für Gewürze ergänzen. | T08 |
| T23 | Erfahrungs-Regeln aus `engine.js` in Daten überführen | open | Die drei hartcodierten `anpassungen` (Natron ⅓, Säure → Backpulver −15 %, Öl-Korpus-Fallback −10 %, `engine.js:34-47`) als Daten-Regeln mit Begründung/Quelle formulieren — Vorstufe zur generischen, semi-automatischen Korpus-Korrelationssuche aus DR-019. | T04 |
