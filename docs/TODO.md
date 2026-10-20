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
| T93 | Ausstattung Stufe 2: Ergebnis und „Hände frei“ | open | Stufe 1 (DR-060) ändert nur die Zeit. Offen: (1) von Hand cremig aufgeschlagene Butter hält weniger Luft (kitchenaid.com: „not the same light and airy texture“) → Teig-Dichte bzw. Gas-Budget (DR-050) je Werkzeug; (2) die Küchenmaschine arbeitet allein → Handzeit nur fürs Einschalten, Rest Wirkzeit (Hände frei, DR-043); (3) Emulsion von Hand vs. Rührgerät bei der Mayonnaise als Anforderung `emulgieren`. Jeweils erst Belege (QUELLEN.md). | T92, DR-060, DR-050, DR-043 | 🟢🟢 Ergebnis statt nur Zeit; ehrlicher Ablauf mit Maschine | 🔴🔴 Zahlen kaum belegt | ⚠️⚠️ mittel; werkzeuge.json, trieb.js, engine.js, rückgängig ein Commit |
| T94 | Standard-Rührkuchen warnt immer: Butter-Temperatur „-20 bis 27 °C (unterstellt)“ | open | Gefunden 2026-10-20 (T91): ohne Temperatur-Angabe unterstellt die Engine für eine Zutat den Bereich `unterstellt` aus temperaturen.json (-20 bis 27 °C, Gefrierfach bis warme Küche, T62). Der überlappt den plastischen Bereich der Butter (18–22 °C) nur teilweise → „cremig schlagbares Fett nicht sicher gegeben“ erscheint schon beim Standard-Rezept (Kastenkuchen, Crememethode) als Warnung und macht Warnungen allgemein weniger ernst. Optionen: A Standard für Fett in Schritten mit `aufschlag_temp` = „weich/Raumtemperatur“ (Rezepte schreiben „weiche Butter“) und die Warnung nur bei ausdrücklich kalter Angabe · B Meldung als Hinweis statt Warnung („Butter vorher weich werden lassen, 18–22 °C“) · C unterstellten Bereich enger fassen (Kühlschrank bis Raum, 4–24 °C) — ändert alle Zutaten. Danach prüfen, welche Tests und Rückmeldungs-Regeln (Regel-Ids) betroffen sind. | T62, DR-019 | 🟢🟢 Standard-Rezept ohne Schein-Warnung; Warnungen bleiben ernst | 🔴 Temperatur-Logik berührt mehrere Rollen | ⚠️ gering bis mittel; temperaturen.json oder engine/rules, rückgängig ein Commit |
