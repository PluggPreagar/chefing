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
| T87 | Mayonnaise: Korpus-Spanne des Emulgators je Zutat | open | Seit DR-054 kommt die Menge des Emulgators aus den Rezepten mit derselben Zutat (`menge_je_zutat`), die Korpus-Spalte (Q1–Q3) im Rezept zeigt aber weiter die Spanne über Eigelb und ganzes Ei (z. B. 24–60 % bei 17 % Eigelb). Spanne und Toleranz-Prüfung aus derselben Zelle wie die Menge nehmen (`bpJeZutat` um q1/q3 erweitern). | T78, DR-054 | 🟢 Zeile ist in sich stimmig, keine scheinbare Abweichung | 🔴 Toleranz-Logik bekommt einen zweiten Weg | ⚠️ gering; corpus.js, engine.js, rückgängig ein Commit |
| T88 | Mayonnaise: Olivenöl mit dem Pürierstab wird bitter? | open | Häufige Angabe: natives Olivenöl wird bei sehr hoher Scherung (Pürierstab, Mixer) bitter, deshalb oft mit neutralem Öl gemischt oder von Hand untergerührt. Noch ohne Quelle im Projekt. Erst belegen (QUELLEN.md), dann als Hinweis-Regel: Methode mit `werkzeug: puerierstab` + Öl = olivenoel → Hinweis „mit neutralem Öl mischen oder das Olivenöl zuletzt von Hand unterrühren“. | T78, DR-053 | 🟢 verhindert ein häufiges Misslingen | 🔴 Recherche nötig | ⚠️ gering; eine Regel in Daten, rückgängig ein Commit |
| T89 | Mayonnaise: Senf als Emulgator in der Bilanz | open | Senf hat `funktionen.emulgator` 0,02 (Schätzwert), zählt aber nur als Aroma; Rezepte nennen ihn als Hilfe beim Emulgieren (Schleimstoffe der Senfsaat). Prüfen und belegen: trägt Senf messbar zur Stabilität bei, und soll die Bilanz „Emulgator“ ihn zeigen oder eine Grenze (z. B. Ei-freie Notlösung) darauf aufbauen? | T78, DR-054 | 🟢 Physik vollständiger | 🔴 Zahl kaum belegt | ⚠️ gering; ingredients.json, ggf. grenzen.json, rückgängig ein Commit |
