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
| T22 | Physik-Regeln aus Code in Daten migrieren | open | Natron-Säure-Check (`rules.js:101-107`) und `nachVorbereitung`-Fallunterscheidung (`rules.js:75-80`) als reguläre `hart`-Voraussetzungen in `operations.json` abbilden statt hartcodiert — Voraussetzung für DR-019 (T24/T25 brauchen Physik-Regeln generisch aus Daten lesbar). | — |
| T23 | Erfahrungs-Regeln aus `engine.js` in Daten überführen | open | Die drei hartcodierten `anpassungen` (Natron ⅓, Säure → Backpulver −15 %, Öl-Korpus-Fallback −10 %, `engine.js:34-47`) als Daten-Regeln mit Begründung/Quelle formulieren — Vorstufe zur generischen, semi-automatischen Korpus-Korrelationssuche aus DR-019. | T04 |
| T24 | Wert-Zustand + Kaskaden-Propagation | open | `state.zutaten`-Einträge um `zustand: berechnet/gesetzt-flexibel/gesetzt-fix` erweitern; bei Änderung eines Werts abhängige Werte über `hart`/`empfohlen`-Regeln automatisch nachziehen (außer bei `gesetzt-fix`, siehe Konfliktregel DR-019). Größter Einzeleingriff (state-Form, `rules.js`, `engine.js`, `morphbox.js`). | T22 |
| T25 | Override-Modus + Regel-Feedback | open | UI-Weg, eine `hart`-Blockade bewusst zu überschreiben; Rückfrage-Mechanismus + Speicherung des Ergebnisses; Kandidatenliste für `hart`→`empfohlen`-Herabstufung, gespeist aus zwei Quellen: (a) wiederholtes „hat funktioniert"-Feedback, (b) expliziter Error-Request des Nutzers gegen eine Regel (Regel + Begründung + Vorschlag); bestätigen → Regel in `operations.json` herabstufen mit `begruendung`, ablehnen → archivieren (DR-019 Punkt 4). | T22, T24 |
