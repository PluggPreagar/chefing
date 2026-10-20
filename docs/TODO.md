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
