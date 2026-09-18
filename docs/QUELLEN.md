# Chefing — Quellen-Log (Web-Recherche)

Dauerhaftes, anhängendes Protokoll jeder Recherche, bei der externe Seiten für den
Rezept-Korpus (`src/data/corpus/`) gelesen wurden. Granularität: pro Domain/Basis-URL,
nicht pro Einzelseite — wurden mehrere Seiten derselben Domain gecrawlt, reicht ein
Eintrag mit Seitenzahl. Die exakten Einzel-URLs stehen ohnehin je Rezept in
`quelle.url` der jeweiligen `corpus/*.json`-Datei; hier geht es um den Überblick
„was wurde wann von wo gelesen", nicht um Duplizierung der Einzelnachweise.

Format je Zeile: `Datum | Domain | Seiten | Zweck/Artefakt | Notiz`

## 2026-09-18 — Aufbau Rührteig-Korpus (T01)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-09-18 | oetker.de | 4 | Korpus Kastenkuchen/Muffin/Gugelhupf | Grundrezept Kastenkuchen, Buttermilch-Muffins, Muffins mit Schokostückchen, Gugelhupf |
| 2026-09-18 | oetker.at | 1 | Korpus Gugelhupf | Klassischer Gugelhupf |
| 2026-09-18 | gutekueche.at | 6 | Korpus alle drei Varianten | Rührkuchen, 3× Muffin-Rezepte, Gugelhupf-Grundrezept, Marmorgugelhupf |
| 2026-09-18 | lecker.de | 2 | Korpus Kastenkuchen | Rührteig-Kastenkuchen, Zitronen-Joghurt-Kuchen |
| 2026-09-18 | familienkost.de | 2 | Korpus Kastenkuchen/Muffin | Grundrezept Rührkuchen, Blaubeermuffins mit Joghurt |
| 2026-09-18 | zimtliebe.de | 1 | Korpus Kastenkuchen | Saftiger Rührkuchen mit Öl |
| 2026-09-18 | herzelieb.de | 1 | Korpus Kastenkuchen | Omas Schmandkuchen aus der Kastenform |
| 2026-09-18 | emmikochteinfach.de | 1 | Korpus Muffin | Schokomuffins |
| 2026-09-18 | kuechengoetter.de | 1 | Korpus Gugelhupf | Gugelhupf – das einfache Grundrezept |
| 2026-09-18 | backenmitchristina.at | 1 | Korpus Gugelhupf | Marmorgugelhupf |
| 2026-09-18 | oma-kocht.de | 1 | Korpus Gugelhupf | Feiner Rum-Rosinen-Gugelhupf |

**Summe: 11 Domains, 21 Seiten** (entspricht den 21 Quellen im Stats-Panel der App).
chefkoch.de wurde bewusst nicht gecrawlt — blockiert automatisierte Abrufe (siehe
[[chefing-vision-and-decisions]] in den Projekt-Notizen).

<!-- Neue Recherchen unten anhängen, nicht bestehende Zeilen überschreiben. -->
