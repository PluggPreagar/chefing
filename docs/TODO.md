# Chefing — Todo

States: `open` · `doing` · `blocked` · `done`

Abgeschlossene Einträge werden nach `docs/TODO_ARCHIVE.md` verschoben (neueste oben),
sobald sie auf `done` gesetzt werden — diese Liste zeigt nur aktive Arbeit.

| id | title | state | descr | dependencies |
|----|-------|-------|-------|--------------|
| T03 | README | open | Kurzbeschreibung, Start (`npx serve`), Datenmodell-Übersicht, wie neue Archetypen/Korpus ergänzt werden. | T01 |
| T04 | Korpus erweitern | open | Mehr Quellrezepte je Variante (Ziel ≥ 15), damit Median/IQR belastbar werden. Quellen: gutekueche.at, oetker.de, lecker.de, kuechengoetter.de (chefkoch blockiert Fetch). Achtung (DR-015): auf Breite statt Tiefe pro Domain achten, keinen „wesentlichen Teil“ einer einzelnen Quelle entnehmen (Datenbankschutz § 87a UrhG). | T01 |
| T05 | Varianten-Cluster in Statistik | open | Korpus nach Fett-Typ × Säure × Einlage clustern und im Stats-Panel zeigen (war im Plan, noch nicht umgesetzt). | T04 |
| T06 | Zweiter Archetyp als reine Daten | open | Z. B. „Gemüse braten“ oder „Hefeteig“ — nur JSON ergänzen, keine JS-Sonderlogik. `rules.js` referenziert noch `archetypes.ruehrteig` hart (u. a. `evaluateAll`, `ermittleFixierung`, Kaskaden-Labels), ebenso `main.js` (`const arch = archetypes.ruehrteig`) → generalisieren. `grenzen.json` ist bereits je Archetyp geschlüsselt (DR-020). Baut auf T08 (Kategorien) auf. | T08 |
| T07 | Tests headless | open | `check.mjs` aus dem Scratchpad ins Repo (`test/`) übernehmen und um Regel-Fälle (u. a. `strenge`) erweitern. | T01, T08 |
| T10 | Strenge auf Zutat-Ebene (Rollen) | open | Substitutionsfreiheit auch für Zutat-Wahl markieren (z. B. Einlage-Frucht frei austauschbar, Struktur-Mehl strikt), nicht nur für Operationen. | T08 |
| T21 | Icon für Gewürze | open | Gewürze teilen sich aktuell Kategorie und Icon mit Pulver/Backtriebmittel/Kakao (`pulver`: Kegel + Streupunkte) — eigenes, unterscheidbares Icon (ggf. eigene Unterkategorie) für Gewürze ergänzen. | T08 |
| T36 | Funktionsvektor je Zutat | open | Rolle = Slot → Rolle = Summe einer Funktion ≥ Schwelle. Jede Zutat bekommt einen Funktionsvektor (Struktur, Bindung, Emulgieren, Trieb-Potenzial, Feuchte, Süße, Säure, Aroma), teils ableitbar aus bestehenden Feldern (`wasseranteil`, `fettanteil`, `zuckeranteil`, `bildet_gluten`, `saeure`, `trieb_typ`). Ermöglicht generische Substitution (z. B. Joghurt/Aquafaba für Ei), Ei darf mehrere Funktionen liefern. Ersetzt die ODER-/Dominanz-Blendregeln aus DR-012 durch Summen. | T33 |
| T37 | Fertighelfer zerlegen | open | `backpulver`, `vanillezucker` (später Puddingpulver) als Zusammensetzung aus Basis-Komponenten modellieren (Backpulver = Natron + Säureträger + Stärke). Säure-Natron-Balance folgt dann aus der Bilanz statt aus `natron_drittel`/`saeure_reduziert_backpulver` in `erfahrungsregeln.json`; Rolle `trieb` wird Funktion „CO₂-Potenzial“. | T33, T36 |
| T38 | Ablauf als Abhängigkeitsgraph | open | `sequenz` in `methods.json` um `nach: [op]` ergänzen; nur physikalisch erzwungene Kanten (z. B. Fett+Zucker cremig vor Mehl). Schritte ohne Kante = freie Reihenfolge, im Ablaufdiagramm als parallel/gleichrangig darstellen (löst DR-004-Risiko „Diagramm nur linear“). | — |
| T39 | Grenzen überschreibbar + Kaskade | open | `grenzen.json`-Verletzungen (`hart`, T34) in `blockaden`/Override-Feedback (DR-019 Punkt 4, T25) und Kaskaden-Vorschlag (T26) einhängen — z. B. „Wasser zu hoch → Flüssigkeit reduzieren“. Zusätzlich Bilanz-Größen in Korrelationssuche (`korrelation.js`) und Stats-Panel aufnehmen. | T34 |
