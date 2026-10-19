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
| T72 | Eischnee als Backpulver-Äquivalent (Option 2B) | open | Geprüft 2026-10-19 (DR-041, QUELLEN.md): keine verlässliche Zahl, nur Blog-Faustregel 2 Eiweiß ≈ 1 TL Backpulver (≈ 2 g je Eiweiß, Spanne 1–4 g, ±50 %); Überschlag Schaum 6–8-fach ≈ 0,15–0,25 l Luft je Eiweiß gegen ≈ 0,3 l Gas je TL Backpulver. Umsetzung wäre `funktionen.triebkraft` für den Teil Eiweiß (nur mit Technik, nur in eierreichen Teigen ab etwa 2 Eiern je 100 g Mehl), als Heuristik markiert, Mengen-Vorschlag „Backpulver senken“. Vorher: Korpus-Rezepte mit getrennten Eiern sammeln, um die Zahl zu prüfen. **Erweiterung C (DR-042):** Korpus-Rezepte bekommen ein Feld `techniken: ["eier_getrennt"]`; ab etwa 30 % der Rezepte einer Variante gilt die Stufe als gemessen „typisch“, sonst „möglich“, und ersetzt die gesetzte Stufe in archetypes.json; dieselben Rezepte liefern die Mengen (Backpulver mit/ohne Eischnee) für den Faktor. | T71, DR-042 | 🟢 echte Mengen-Vorschläge statt nur Hinweis | 🔴🔴 Zahl ist Folklore, ohne Korpus nicht prüfbar | ⚠️⚠️ bilanz.js und Grenzen; falsche Zahl → zu wenig Trieb; rückgängig ein Commit |
