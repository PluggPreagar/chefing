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
| T67 | Falsch-Alarme der Korpus-Toleranz bei Quark und veganen Rezepten prüfen | open | Aus T61 (2026-10-18): von 9 Kontrollfällen lösen 2 eine Warnung aus. (1) Topfen-Gugelhupf mit 250 g Quark und 5 Eiern: Eiweiß 32 % vom Mehl liegt über der Korpus-Spanne, weil Quark Eiweiß liefert, im Korpus aber kaum Quark-Rezepte stehen. (2) Veganer Pfannkuchen ohne Ei mit Natron: Emulgator 0, Natron 1,3 %, Salz 3 % liegen außerhalb der Eier-Pfannkuchen. Zu klären: Eiweiß-Toleranz für Quark/Topfen-Teige lockern oder Quark als Flüssigkeit mit eigener Spanne führen; vegane Rezepte als eigene Variante oder Hinweis „ohne Ei, Bindung fehlt“ statt Warnung. Die Falsch-Alarm-Quote (2 von 9) hängt an zwei Einzelfällen. Erst Optionen (DR-007). | T61, T55 | 🟢 Weniger Warnungen bei Rezepten, die funktionieren. | 🔴🔴 Zwei Fälle sind eine dünne Basis; eine gelockerte Toleranz kann echte Fehler verdecken. | ⚠️ Gering bis mittel: Toleranz in `bilanz.js`/`corpus.js`, Tests. Rückgängig: Daten oder ein Commit.
| T68 | Rückmeldungen („klappt nicht“ mit Mengen) in den Negativ-Korpus übernehmen | blocked | Aus T61: sobald Nutzer-Rückmeldungen (T53) mit der Wertung „misslungen“ und Mengen eintreffen, als Fälle in `negativ.json` übernehmen (Quelle: Rückmeldung, ohne Kommentartext wörtlich; Zutaten, Mengen und Kontext aus der Meldung) und `node tools/negativ.mjs` laufen lassen; `tools/` hat die Auswertung der Rückmeldungen schon. Blockiert, weil noch keine Rückmeldungen vorliegen. Erst Optionen (DR-007). | T53, T61 | 🟢🟢 Erste echte Gegenprobe ohne Auswahl durch Suchmaschine. | 🔴 Wenige Meldungen, Datenschutz: nur Zutaten und Mengen, kein Freitext. | ⚠️ Gering. Rückgängig: Daten.
| T66 | Rückmeldung: Prozessangaben (Rührzeit, Ofen) optional erfassen | open | Aus T64 (2026-10-18): Prozessfehler (zu lange gerührt, Ofentür zu früh geöffnet, Ofen zu heiß) sind die häufigsten Ursachen in Ratgebern, das Modell kann sie nicht prüfen, weil keine Angabe vorliegt. Vorschlag: das Formular „Hat es geklappt?“ (T53) fragt optional nach Rührzeit nach dem Mehl, Ofentemperatur und Backzeit; die Angaben gehen mit der Meldung mit (Schema-Version, `feedback.php` prüft Länge und Werte) und füllen später den Negativ-Korpus und ein Zeit-Fenster für Misch-Schritte. Erst Optionen (DR-007). | T53, T64, T61 | 🟢🟢 Macht Prozessursachen messbar, ohne dass jemand sie raten muss; speist T61. | 🔴🔴 Mehr Felder im Formular senken die Antwortquote; Datenschutz-Text und PHP-Prüfung müssen wachsen. | ⚠️⚠️ Mittel: berührt `rueckmeldung.js`, `ui/rueckmeldung.js`, `feedback.php`, Tests. Rückgängig: Felder optional, ein Commit.
