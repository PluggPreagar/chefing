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
| T07 | Tests headless | open | Teilweise erledigt (2026-10-18): `test/*.check.mjs` + `test/run.sh` (Node ≥ 22, keine Abhängigkeiten) decken Bilanz, Grenzen, Toleranz, Grenzen-Kaskade, Override-Katalog, Ablauf-Graph und Funktions-Bilanz ab (T33–T39). Offen: Regel-Fälle (u. a. `strenge` in operations.json, Kaskaden T26, Pins T31), Aufruf vor Deploy. | T01, T08 |
| T10 | Strenge auf Zutat-Ebene (Rollen) | open | Substitutionsfreiheit auch für Zutat-Wahl markieren (z. B. Einlage-Frucht frei austauschbar, Struktur-Mehl strikt), nicht nur für Operationen. | T08 |
| T21 | Icon für Gewürze | open | Gewürze teilen sich aktuell Kategorie und Icon mit Pulver/Backtriebmittel/Kakao (`pulver`: Kegel + Streupunkte) — eigenes, unterscheidbares Icon (ggf. eigene Unterkategorie) für Gewürze ergänzen. | T08 |
| T37 | Fertighelfer zerlegen | open | `backpulver`, `vanillezucker` (später Puddingpulver) als Zusammensetzung aus Basis-Komponenten (Backpulver = Natron + Säureträger + Stärke). Baut auf der Funktions-Bilanz (T36) auf: `triebkraft` existiert, fehlt noch `saeure_kapazitaet` (Säure-Äquivalent je g, z. B. Buttermilch, Joghurt, Zitronensaft) und `natron_bedarf`. Dann folgt die Säure-Natron-Balance als Grenze aus der Bilanz statt aus `natron_drittel`/`saeure_reduziert_backpulver` (erfahrungsregeln.json) und der hart-Voraussetzung an `backen` (operations.json). | T36 |
| T40 | Mengen-Kaskade für Grenzen | open | Grenzen-Kaskade (T39) tauscht nur die Zutat der Zielrolle bei gleicher Grammzahl. Ergänzen: Menge der Zielrolle so weit verschieben, bis die Grenze hält (z. B. „Flüssigkeit −30 g“), innerhalb der Korpus-Spanne dieser Rolle. Braucht einen gespeicherten Mengen-Override je Rolle — heute sind Mengen stateless (DR-005, DR-019-Nachtrag). | T39 |
| T41 | Rolle = Funktion (Option B aus DR-022) | open | Zurückgestellt zugunsten Option A. Rollen nicht mehr als Slots, sondern als Funktions-Schwellen; jede Zutat mit passendem Funktionsvektor darf eine Rolle (mit-)füllen, Ei liefert Bindung + Emulgator + Gerüst gleichzeitig. Ersetzt Dominanz-/ODER-Blendregeln (DR-012) durch Summen, berührt Morphologischen Kasten und Kaskade. Erst angehen, wenn die Funktions-Bilanz (T36) sich am größeren Korpus (T04) bewährt hat. | T36, T04 |
