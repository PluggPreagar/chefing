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
| T115 | Weitere Nachweise aus offenen Quellen | open | Regeltext zu Natron ist korrigiert (ab etwa 80 °C, nur halbes CO₂, seifig; Gewissheit bleibt `surely`, kein offener Backbeleg gefunden). Offen: Kandidaten für Nachweise aus offenen Quellen: Mayonnaise-Ölzugabe, Butter-Schmelzbereich, Gluten-Ruhezeit. | DR-074 | 🟢 jeder Nachweis macht eine Aussage belastbar | 🔴🔴 offene Backstudien zu Küchenfragen sind selten | ⚠️ gering, nur Daten und Tests in `aussagen.json` |
