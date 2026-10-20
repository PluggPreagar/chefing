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
| T89 | Mayonnaise: Senf als Emulgator in der Bilanz | open | Senf hat `funktionen.emulgator` 0,02 (Schätzwert), zählt aber nur als Aroma; Rezepte nennen ihn als Hilfe beim Emulgieren (Schleimstoffe der Senfsaat). Prüfen und belegen: trägt Senf messbar zur Stabilität bei, und soll die Bilanz „Emulgator“ ihn zeigen oder eine Grenze (z. B. Ei-freie Notlösung) darauf aufbauen? | T78, DR-054 | 🟢 Physik vollständiger | 🔴 Zahl kaum belegt | ⚠️ gering; ingredients.json, ggf. grenzen.json, rückgängig ein Commit |
| T91 | Gefäße Springform und quadratische Form | open | Zwei Rührkuchen mit getrennten Eiern wurden in T83 übersprungen (f-pieper.de Springform 26 cm, bakeomaniac.com 8×8 Zoll), weil kein Gefäß passt. Gefäße `springform_26` und `quadratform_20` (Volumen, Füllgrad, Teigmasse, Geometrie: flacher, breiter → kürzere Backzeit) und eine Variante oder Zuordnung zu einer bestehenden Variante; Backzeit und Temperatur aus Quellen bzw. Korpus. | T83 | 🟢 mehr Rührkuchen abbildbar, kleiner Daten-Schritt | 🔴 Backzeiten je Form brauchen Belege | ⚠️ gering; vessels.json, ggf. archetypes.json, rückgängig ein Commit |
| T92 | Werkzeuge als Angebot: Schritte nennen Anforderungen, Werkzeuge erfüllen sie | open | Nutzer 2026-10-20: „wir formulieren Anforderungen und bieten Werkzeuge an (man kann es von Hand machen, dauert aber länger)“. Ein Schritt nennt, was er braucht (`anforderung`: z. B. Luft einschlagen bis steif, Creme aufschlagen, emulgieren mit hoher Scherung, kneten bis Gluten entwickelt); `werkzeuge.json` sagt je Werkzeug, welche Anforderung es erfüllt und mit welchem Zeit-Faktor auf die Handzeit (Schneebesen von Hand länger, Handrührgerät Standard, Küchenmaschine schneller und Hände frei, Pürierstab nur emulgieren, zerstört Schaum). Auswahl als **Ausstattung** (was ich habe), nicht je Schritt; ohne passendes Werkzeug ein Hinweis. Wo das Werkzeug die **Reihenfolge** ändert (Pürierstab-Mayonnaise), bleibt es eine eigene Methode (DR-055/056). Stufe 1 nur Zeit; Stufe 2 auch Ergebnis (von Hand aufgeschlagene Butter hält weniger Luft → Gas-Budget). Zeit-Faktoren brauchen Quellen. **Entscheidung 2026-10-20: Option A** (Ausstattung als Kasten-Dimension, einmal wählen); Standard = Alltags-Küche: Schneebesen, Handrührgerät und Pürierstab vorhanden, Küchenmaschine optional. Stufe 1 nur Zeit. | T84, DR-053, DR-043, DR-050 | 🟢🟢 eine Regel für alle Werkzeuge, ehrliche Zeiten, Ausstattung als neue Kasten-Dimension | 🔴🔴 Zeit-Faktoren kaum belegt; viele Schritte bekommen ein Feld | ⚠️⚠️ mittel; operations/methods/werkzeuge.json, zeit.js, Kasten; rückgängig ein Commit |
