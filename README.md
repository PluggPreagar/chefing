# Chefing

Kochen als Kombinatorik: Zutaten nach Eigenschaften wählen, Methode und Ablauf folgen aus der Physik, die Mengen aus einem Korpus echter Rezepte. Statische Web-App ohne Build und ohne Framework (ES-Module, Vanilla JS).

Aktuell drei **Archetypen** mit sieben Varianten:

| Archetyp | Varianten | Korpus |
|---|---|---|
| Rührteig | Rührkuchen (Kastenform), Muffins, Gugelhupf | 45 Rezepte |
| Pfannkuchen | Eierkuchen (dünn), Pancakes (dick) | 31 Rezepte |
| Hefeteig | Weißbrot (Kastenform), Hefezopf (Blech) | 51 Rezepte |

## Starten

```bash
npx serve .
```

Dann `http://localhost:3000` öffnen (oder den Port, den `serve` ausgibt). Es gibt nichts zu installieren oder zu bauen. Das 404 auf `version.json` in der Konsole ist normal: die Datei legt nur der Deploy auf dem Server an.

Tests (Node ≥ 18, keine Abhängigkeiten):

```bash
sh test/run.sh
```

Jede Datei `test/*.check.mjs` ist eine eigene Suite (13 Suiten, rund 280 Fälle). Sie decken Regeln und Strenge-Stufen (`regeln`), Erfahrungsregeln, Einheiten und Statistik, die Feedback-Schleife, Bilanz und Grenzen, Zeit, Ablauf-Graph sowie je Archetyp Korpus und Presets ab. Vor jedem Push müssen alle grün sein; ein Hook erzwingt das, einmalig aktivieren mit:

```bash
git config core.hooksPath .githooks
```

## So funktioniert es

- **Archetyp** → **Rollen** (Struktur, Fett, Flüssigkeit, Trieb …): was ein Gericht funktional braucht. Eine Zutat füllt eine Rolle.
- **Variante** = benanntes Preset: Gefäß, Korpus und „Best-of“-Zutaten. Die Mengen sind der **Median aus dem Korpus** in Bäckerprozent (Mehl = 100), nicht kuratiert; hat die gewählte Methode Rezepte in der Variante, zählen nur deren Rezepte (Vorteig-Brot braucht weniger Hefe als direkt geführtes); ein einzelnes geprüftes Rezept schlägt den Median fremder Methoden (DR-026).
- **Methode** = geordnete Folge von **Operationen** (als Graph, mit parallelen Strängen). Jede Operation prüft **Voraussetzungen** an den Zutat-Eigenschaften, zum Beispiel „Natron braucht eine saure Zutat“. Die Engine prüft nur generisch, die Regeln stehen in den Daten.
- **Zeit**: Operationen haben ein Fenster (min/typ/max) mit Hinweis, was außerhalb passiert; Warten ist eine eigene Operation (Gehen, Ruhen, Einlegen). Die Karte zeigt aktive Zeit, Wartezeit und Gesamtzeit.
- **Gesamtbilanz**: Wasser, Fett, Zucker, Eiweiß, Gluten, Stärke, Triebkraft, Hefe und Salz über alle Zutaten. Dagegen laufen die **Grenzen** (`hart` macht die Kombination ungültig, `empfohlen` warnt) und der Vergleich mit der Korpus-Spanne.
- **Feedback-Schleife**: harte Regeln lassen sich bewusst überschreiben, als Fehler melden und aus dem Korpus als Kandidaten ableiten. Alles lokal im Browser (`localStorage`), kein Backend; Änderungen an den Regeldateien macht der Maintainer von Hand.

Warum so, steht in [docs/DECISIONS.md](docs/DECISIONS.md) (Start: DR-001, DR-002, DR-019 bis DR-025).

## Wo liegt was

```
index.html, style.css        Seite
src/main.js                  Zustand, Archetyp-Umschalter, Zusammenbau der Panels
src/model/                   Engine ohne DOM (testbar)
  engine.js                  compute(): Zutaten → Mengen, Ablauf, Bilanz, Zeit, Meldungen
  rules.js                   Voraussetzungen, Methoden-Auswertung, Regel-Katalog
  bilanz.js                  Gesamtbilanz, Grenzen, Kaskaden-Vorschläge, Korpus-Toleranz
  zeit.js                    Zeit-Fenster und Zeitleiste
  corpus.js, units.js        Korpus laden, normalisieren, Statistik, Einheiten → Gramm
  korrelation*.js            Regel-Kandidaten aus dem Korpus
  overrides.js, errorRequests.js   Feedback-Schleife
src/ui/                      Morphologischer Kasten, Ablaufdiagramm, Rezeptkarte, Statistik, Icons
src/data/                    alle Fachdaten als JSON (siehe unten)
test/                        headless-Checks, `sh test/run.sh`
docs/                        TODO.md (+ Archiv), DECISIONS.md, QUELLEN.md
HANDOFF/                     Abgleich zwischen Planung (claude.ai) und Umsetzung (Laptop)
dev/                         Skizzen und Vorschauen, nicht Teil der App
```

### Daten (`src/data/`)

| Datei | Inhalt |
|---|---|
| `archetypes.json` | Rollen mit Optionen, Fallback-Werten, Varianten (Preset) je Archetyp |
| `ingredients.json` | Zutaten mit Eigenschaften, Massenanteilen, Funktionsvektor, Umrechnung (Stück, TL, Päckchen) |
| `operations.json` | Operationen mit Voraussetzungen und Zeit-Fenstern; jede Datei erklärt ihre Felder im `_schema` |
| `methods.json` | Methoden als Operationsfolge mit Abhängigkeiten |
| `vessels.json` | Gefäße mit Teigmasse, Backwerten, Hinweisen |
| `grenzen.json` | quantitative Grenzen je Archetyp, mit Herkunft im Feld `quelle` |
| `erfahrungsregeln.json` | Praxis-Regeln, die Mengen oder Zeit-Fenster anpassen |
| `kategorien.json`, `verben.json` | Icon-Kategorien und Verben |
| `corpus/*.json` | Quellrezepte je Variante: Zutatenmengen als Fakten, Link zur Quelle |

## Neuen Archetyp ergänzen

Ein dritter Archetyp (Hefeteig) kam fast ohne Codeänderung dazu. Reihenfolge:

1. **Zutaten** in `ingredients.json` ergänzen (Eigenschaften, Massenanteile, `umrechnung`).
2. **Gefäße** in `vessels.json` (ohne Ofen: `hitze` statt `tempOU`).
3. **Operationen** in `operations.json`, **Methoden** in `methods.json`. Warten und Zeit als `typ: warten` mit `zeit`-Fenster.
4. **Archetyp** in `archetypes.json`: Rollen, `methoden`, `gefaesse`, `varianten` mit `korpus`-Dateiname.
5. **Korpus** `src/data/corpus/<variante>.json`: mindestens 15 Rezepte je Variante, möglichst viele Domains, je Domain höchstens ein Rezept.
6. **Grenzen** in `grenzen.json` unter dem Archetyp-Schlüssel, am Korpus kalibriert (Begründung ins Feld `quelle`).
7. **Test** `test/<archetyp>.check.mjs` nach dem Muster der bestehenden: Korpus innerhalb der Grenzen, Presets ohne Meldung, Besonderheiten des Archetyps.
8. In `docs/DECISIONS.md` festhalten, was nicht reine Daten war.

Der Archetyp-Umschalter erscheint automatisch, sobald es mehr als einen Archetyp gibt.

## Korpus-Regeln

- Nur **Fakten** speichern: Zutaten und Mengen, Titel, URL. Den Ablauf in **eigenen Worten**, kurz; nie den Originaltext, keine Fotos (Begründung: DR-015).
- **Breite vor Tiefe**: viele Domains, je Domain höchstens ein Rezept.
- Jede Web-Recherche wird in [docs/QUELLEN.md](docs/QUELLEN.md) protokolliert, pro Domain.
- Mengen aus Seiten-Zusammenfassungen sind nicht gegengeprüft; Auffälligkeiten stehen in `notizen` je Rezept.
- Vor dem Einpflegen prüfen: Zutat-Schlüssel, Rollen, Einheiten, Dubletten (id und URL), Grenzen. Rezepte, die nicht ins Raster passen (Sauerteig, Honig, andere Mehlsorten), lieber weglassen als erfinden.

## Arbeitsweise

- Offene Arbeit steht in [docs/TODO.md](docs/TODO.md) (mit Pro, Contra, Risiko), Erledigtes im [Archiv](docs/TODO_ARCHIVE.md).
- Entscheidungen mit Optionen stehen in `docs/DECISIONS.md`; vor größeren Änderungen erst Optionen vorlegen.
- Planung offline (claude.ai) und Umsetzung (Claude Code, Laptop) gleichen sich über Patch-Dateien in `HANDOFF/` ab, siehe [HANDOFF/SYNC.md](HANDOFF/SYNC.md). Nur die Umsetzungsseite pusht.

## Deploy

Der Webspace holt `main` von GitHub per `deploy.php` (Aufruf mit Zugriffstoken, steht nur auf dem Server, nie im Repo). Welche Dateien übernommen werden, steht in `chefing.cfg`. Die Server-Datei `.htaccess` gehört nicht ins Repo. Hintergrund: DR-013.
