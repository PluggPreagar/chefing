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
| T61 | Negativ-Korpus erweitern und mit Rückmeldungen abgleichen | open | Aus T55 (2026-10-18): Lücken bei Rührteig mit viel Fett oder Zucker, Gugelhupf, Kastenkuchen und Hefezopf mit Gramm-Angaben sowie Pfannkuchen mit klarem Mengenfehler; zwei Mengenfälle sind nicht prüfbar (kein Salz-Minimum nötig, aber `ingredients.json` kennt kein selbsttreibendes Mehl; Fälle ohne Mengen). Vorgehen: neue Fälle in `src/data/negativ.json` ergänzen (deutschsprachige Quellen per Browser, wenn Seiten gesperrt sind), sobald Nutzer-Rückmeldungen (T53) ankommen, deren „klappt nicht“-Meldungen mit Mengen als Fälle übernehmen und `node tools/negativ.mjs` laufen lassen. Erst Optionen (DR-007). | T55 | 🟢 Macht die Falsch-Negativ-Quote belastbarer als n = 9. | 🔴🔴 Quellen mit Gramm-Angaben und klarer Ursache sind selten; Auswahlverzerrung bleibt. | ⚠️ Gering. Rückgängig: Daten.
