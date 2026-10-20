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
| T93 | Ausstattung Stufe 2: Ergebnis und „Hände frei“ | open | Stufe 1 (DR-060) ändert nur die Zeit. Offen: (1) von Hand cremig aufgeschlagene Butter hält weniger Luft (kitchenaid.com: „not the same light and airy texture“) → Teig-Dichte bzw. Gas-Budget (DR-050) je Werkzeug; (2) die Küchenmaschine arbeitet allein → Handzeit nur fürs Einschalten, Rest Wirkzeit (Hände frei, DR-043); (3) Emulsion von Hand vs. Rührgerät bei der Mayonnaise als Anforderung `emulgieren`. Jeweils erst Belege (QUELLEN.md). | T92, DR-060, DR-050, DR-043 | 🟢🟢 Ergebnis statt nur Zeit; ehrlicher Ablauf mit Maschine | 🔴🔴 Zahlen kaum belegt | ⚠️⚠️ mittel; werkzeuge.json, trieb.js, engine.js, rückgängig ein Commit |
