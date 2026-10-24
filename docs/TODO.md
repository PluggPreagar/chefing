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
| T115 | Natron-Regeltext und weitere Nachweise | open | Nach Referenzseiten setzt Natron beim Erhitzen ab etwa 80 °C auch ohne Säure CO₂ frei und hinterlässt Natriumcarbonat (seifig); die Texte sagen „ohne Säure kein CO₂“. Offenen begutachteten Beleg für Backwaren suchen (nicht für reines Pulver), dann den Regeltext in `operations.json` genauer fassen. Weitere Kandidaten für Nachweise aus offenen Quellen: Mayonnaise-Ölzugabe, Butter-Schmelzbereich, Gluten-Ruhezeit. Optional: Hinweis „Kein Eigelb ins Eiweiß“ am Schritt `ei_trennen`, 4 Sterne aus der bewiesenen Aussage. | DR-074 | 🟢🟢 korrigiert einen ungenauen Regeltext | 🔴🔴 offene Backstudien sind selten | ⚠️ gering bis mittel, Textänderung an einer harten Regel, Tests `natron` und `regeln` |
