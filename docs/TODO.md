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
| T96 | Mayonnaise: Anforderung „emulgieren“ mit Zeit je Werkzeug | open | Rest aus T93 (DR-066): von Hand mit dem Schneebesen dauert die Mayonnaise „mit Abstand am längsten“ (utopia.de), das Handrührgerät ist eine Alternative (lecker.de) — aber keine Quelle nennt Minuten. Erst Belege suchen (Zeit von Hand gegen Handrührgerät), dann `anforderung: {art: emulgieren, basis: schneebesen}` an „Öl tropfenweise“ und „Öl im Strahl“, Faktoren in werkzeuge.json. | T93, DR-060, DR-066 | 🟢 ehrliche Zeit für die Mayonnaise von Hand | 🔴 Zahlen fehlen | ⚠️ gering; werkzeuge.json, methods.json, rückgängig ein Commit |
