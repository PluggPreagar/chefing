# Browser-Checkliste zu 20261018-a1b670e-bilanz-funktionen.patch

In claude.ai nicht prüfbar (kein Browser; nur Node + jsdom). Nach `apply` mit `npx serve .` prüfen:

- [ ] Alle 3 Presets: Status ok, Bilanz-Tabelle mit 8 Zeilen, keine Grenzen-Meldung.
- [ ] Struktur = Speisestärke: Warnung „Klebereiweiß nur 0,0 %“ + Kaskaden-Vorschlag Weizenmehl; „Übernehmen“ wirkt.
- [ ] Struktur Mehl + Stärke 1:1 (Shift-Klick, Teile): Warnung; 7:1: keine.
- [ ] Muffin-Methode: „Trockenes mischen“ und „Flüssiges verquirlen“ untereinander, Kurven zu „Nass zu Trocken“.
- [ ] Muffin-Methode + Butter: „Butter schmelzen“ als Startschritt (gestrichelt).
- [ ] Gugelhupf (Rosinen): Einlegen parallel zu Aufschlagen.
- [ ] Ablauf-SVG: Höhe passt (früher fix 124 px), horizontales Scrollen am Handy.
- [ ] Kandidaten-Panel: Bilanz-Korrelationen („Gesamtwasser“ …), 5 Gesamtbilanz-Regeln im Override-Dropdown.
- [ ] Stats-Panel: Σ-Zeilen je Bilanz-Größe.
- [ ] Dark Mode: Bilanz-Tabelle lesbar.

## Danach (Plan)

| # | Todo | Kern | Aufwand |
|---|---|---|---|
| 1 | T37 Fertighelfer zerlegen | Säure als Funktion oder boolesch + Regeln? → erst Optionen (DR-007) | M |
| 2 | T40 Mengen-Kaskade | Mengen-Override je Rolle, Verschiebung innerhalb Korpus-Spanne | M |
| 3 | T06 Archetyp generalisieren | `archetypes.ruehrteig` → `state.archetyp` | M |
| 4 | T07 Tests vervollständigen | Regel-Fälle, Aufruf vor Deploy | S |
| später | T41 Rolle = Funktion | nach größerem Korpus (T04) | L |
