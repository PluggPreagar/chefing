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
| T78 | Mayonnaise als eigener Grundteig (Option D) | open | Archetyp „Emulsion“ mit Rollen Eigelb (bzw. Ei), Wasser/Säure (Zitrone, Essig), Öl, Salz/Senf; Methode „Eigelb + Wasser/Säure, Öl erst tropfenweise, dann im Strahl“, Rettung „neues Eigelb, gebrochene Masse langsam einrühren“; Grenzen Wasser:Öl, Öl je Eigelb (Quellen strittig: 240 ml bis mehrere Liter); eigener Korpus. Zeigt die Kombinatorik außerhalb des Backens. | T77 | 🟢 neues Feld, testet das generische Schema | 🔴🔴🔴 eigener Kasten, Korpus und Ablauf | ⚠️ gering für den Bestand, Aufwand groß |
| T83 | Korpus: Rezepte mit getrennten Eiern aufnehmen (T72/T82 Option C) | open | Die 21 Rezepte der Recherche 2026-10-20 (QUELLEN.md: 13 Rührkuchen/Marmor/Sandkuchen, 8 Pfannkuchen/Pancakes/Kaiserschmarrn mit Eischnee) als Fakten (Mengen, Methode, `techniken: eier_getrennt`) in die Korpus-Dateien; dann misst der Korpus die Technik-Stufe je Variante (typisch/möglich, Erweiterung C aus T72) und die Backpulver-Mediane mit/ohne Eischnee. Prüft das Gas-Budget (DR-050) gegen echte Rezepte: haben Rezepte mit mehr eingeschlagener Luft weniger chemischen Trieb? | T72, T82, DR-042, DR-050 | 🟢🟢 echte Daten statt gesetzter Stufen | 🔴 Korpus-Statistik ändert sich, Tests anpassen | ⚠️⚠️ mittel; Korpus-Arbeit, rückgängig ein Commit |
