# Chefing

Kochen als Kombinatorik: Zutaten nach Eigenschaften wählen, Methode und Ablauf folgen aus der Physik, die Mengen aus einem Korpus echter Rezepte. Statische Web-App ohne Build und ohne Framework (ES-Module, Vanilla JS).

Aktuell vier **Archetypen** mit neun Varianten:

| Archetyp | Varianten | Korpus |
|---|---|---|
| Rührteig | Rührkuchen (Kastenform), Muffins, Gugelhupf | 57 Rezepte |
| Pfannkuchen | Eierkuchen (dünn), Pancakes (dick), Kaiserschmarrn | 47 Rezepte |
| Hefeteig | Weißbrot (Kastenform), Hefezopf (Blech) | 65 Rezepte |
| Mayonnaise | Mayonnaise (von Hand oder Pürierstab, Emulsion ohne Hitze) | 16 Rezepte |

## Starten

```bash
npx serve .
```

Dann `http://localhost:3000` öffnen (oder den Port, den `serve` ausgibt). Es gibt nichts zu installieren oder zu bauen. Das 404 auf `version.json` in der Konsole ist normal: die Datei legt nur der Deploy auf dem Server an. Mit ihr hängt der Lade-Stub in `index.html` die Commit-Version an jedes Modul (`?v=…`, Liste in `src/manifest.json`; nach neuen Modulen `node tools/manifest.mjs`), damit Browser nach einem Deploy nie alte Dateien zeigen; der Footer nennt Version, Commit-Zeit und Deploy-Zeit.

Tests (Node ≥ 18, keine Abhängigkeiten):

```bash
sh test/run.sh
```

Jede Datei `test/*.check.mjs` ist eine eigene Suite (41 Suiten, rund 1040 Fälle; die PHP-Tests brauchen PHP ab 8.1, `PHP_BIN` kann den Pfad vorgeben, sonst werden sie übersprungen). Sie decken Regeln und Strenge-Stufen (`regeln`), Erfahrungsregeln, Einheiten und Statistik, die Feedback-Schleife, Bilanz und Grenzen, Zeit, Ablauf-Graph, Ablauf-Strom sowie je Archetyp Korpus und Presets ab. Vor jedem Push müssen alle grün sein; ein Hook erzwingt das, einmalig aktivieren mit:

```bash
git config core.hooksPath .githooks
```

## So funktioniert es

- **Archetyp** → **Rollen** (Struktur, Fett, Flüssigkeit, Trieb …): was ein Gericht funktional braucht. Eine Zutat füllt eine Rolle.
- **Variante** = benanntes Preset: Gefäß, Korpus und „Best-of“-Zutaten. Die Mengen sind der **Median aus dem Korpus** in Bäckerprozent (Mehl = 100), nicht kuratiert; hat die gewählte Methode Rezepte in der Variante, zählen nur deren Rezepte (Vorteig-Brot braucht weniger Hefe als direkt geführtes); ein einzelnes geprüftes Rezept schlägt den Median fremder Methoden (DR-026).
- **Methode** = geordnete Folge von **Operationen** (als Graph, mit parallelen Strängen). Jede Operation prüft **Voraussetzungen** an den Zutat-Eigenschaften, zum Beispiel „Natron braucht eine saure Zutat“. Die Engine prüft nur generisch, die Regeln stehen in den Daten.
- **Zeit**: Operationen haben ein Fenster (min/typ/max) mit Hinweis, was außerhalb passiert; Warten ist eine eigene Operation (Gehen, Ruhen, Einlegen). Die Karte zeigt aktive Zeit, Wartezeit und Gesamtzeit.
- **Fehler melden** (⚑ in der Kopfzeile): Titel, Beschreibung, gezeigte Elemente, Wireframe-Skizze, Anhänge und der App-Zustand werden im Browser zu einer ZIP-Datei (`issue.md`, `meta.json`, `wireframe.png`, `anhang/`, Format wie im Projekt aktien-monitor) und heruntergeladen, zum Verschicken per Mail; gesendet wird nichts (DR-044).
- **Rückmeldung** („Hat es geklappt?“ unter jedem Rezept): 1–5 Punkte, Kommentar und optional angekreuzte Ablauf-Fehler (zu lange gerührt, Ofen zu heiß …) gehen an `feedback.php` (nach einem Deploy von Hand neu auf den Server legen). Jede Regel, Grenze und Modellwarnung ist eine Vorhersage; die Meldungen zeigen je Regel, ob sie zu streng ist oder fehlt (`node tools/rueckmeldungen.mjs feedback.jsonl`). Nichts wird ohne Klick gesendet, es werden weder IP noch Cookies gespeichert (DR-027).
- **Gärmodell** (Hefeteig): Gärzeit hängt von Hefe und Temperatur ab (mehr Hefe, mehr Wärme = kürzer; Temperatur als Bereich, oberhalb 35 °C gedeckelt). Es warnt bei Widersprüchen (4 % Hefe, 12 Std. warm) und rechnet die Hefe für Methoden ohne Korpus-Rezepte aus der Gärzeit. Nach unten gilt die Mindestzeit der Gare-Operation. Ein Richtwert mit Spielraum ×3,5, der Hefe-Einfluss ist nur grob belegt; Rezepte gehen immer vor (DR-026, DR-028).
- **Gesamtbilanz**: Wasser, Fett, Zucker, Eiweiß, Gluten, Stärke, Triebkraft, Hefe, Salz sowie freies Natron und Säure (Natron-Balance) über alle Zutaten, mit der Herkunft je Rolle. Dagegen laufen die **Grenzen** (`hart` macht die Kombination ungültig, `empfohlen` warnt) und der Vergleich mit der Korpus-Spanne.
- **Feedback-Schleife**: harte Regeln lassen sich bewusst überschreiben, als Fehler melden und aus dem Korpus als Kandidaten ableiten. Alles lokal im Browser (`localStorage`), kein Backend; Änderungen an den Regeldateien macht der Maintainer von Hand.

Warum so, steht in [docs/DECISIONS.md](docs/DECISIONS.md) (Start: DR-001, DR-002, DR-019 bis DR-031).

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
  rueckmeldung.js            Rückmeldung bauen, senden, Warteschlange, Auswertung je Regel
  ueberraschungen.js         Korpus-Rezepte, denen die Regeln widersprechen („sollte nicht klappen, tat es“)
  qualitaet.js               Qualitätsnote je Korpus-Rezept (Vorschlag, Überschreiben)
  gaerung.js                 Gärmodell: erwartete Gärzeit, Hefe aus Gärzeit, Plausibilitätswarnung, Vorteig-Dosis
  temperatur.js              Temperatur als Bereich (Zahl, Wert ± Spielraum, Spanne, Name, aus der Zutat abgeleitet)
  negativ.js                 Negativ-Korpus: dokumentierte Misserfolge gegen Grenzen, Toleranz und Gärmodell
  rollenFreiheit.js          gemessene Substitutions-Freiheit je Rolle (frei / empfohlen / strikt)
  korrelation*.js            Regel-Kandidaten aus dem Korpus
  overrides.js, errorRequests.js   Feedback-Schleife
src/ui/                      Morphologischer Kasten, Ablaufdiagramm, Rezeptkarte, Statistik, Icons
src/data/                    alle Fachdaten als JSON (siehe unten)
tools/                       Pflege-Skripte (Qualitätsnote und -gewicht, Gärmodell, Überraschungs-Bericht, Negativ-Korpus, Rollen-Freiheit, Auswertung der Rückmeldungen, Entwürfe für den Negativ-Korpus aus Rückmeldungen)
feedback.php                 Endpunkt für Rückmeldungen (nur auf dem Server, siehe Deploy)
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
| `aussagen.json` | Bewertung der Aussagen, die Regeln machen: Wirkung, Gewissheit (never … proven) und Beleg je Aussage (DR-074); `never` und `proven` nur mit begutachteter Studie |
| `hinweise.json` | Praxishinweise im Ablauf mit Sternen von 0 bis 5 (aus Wirkung und Gewissheit der Aussage berechnet, von Hand überschreibbar, DR-075); die optionalen Felder `archetyp` und `methode` beschränken einen Hinweis auf einen Archetyp bzw. eine Methode; die Stufe Einsteiger, Fortgeschritten oder Profi im Kopf des Ablaufs blendet sie ab 1, 3 oder 5 Sternen ein |
| `negativ.json` | dokumentierte Misserfolge mit Mengen (Negativ-Korpus, T55) für `node tools/negativ.mjs` |
| `tipps.json` | Ursache-Wirkungs-Tipps aus Backratgebern (T61): Symptom, Ursache, Zahlen, Quellen und ob das Modell die Ursache kennt (Test `tipps`) |
| `orte.json` | Arbeitsplätze (Tasse, Schüssel, Form, Ofen …) mit Icon und Farbe; Hauptstrom = Weg des Teigs, `neben` = Seitenstrom (Tasse, Topf, Schälchen, Schüssel 2); jede Operation nennt ihren `ort` (DR-038, DR-039) |
| `techniken.json` | optionale Techniken, die eine Methode ergänzen (Eier getrennt: Trennen, Eischnee, Unterheben; lockert den Trieb); Schalter im Kasten (DR-041) |
| `triebquellen.json` | woher das Volumen kommt (Luft aus Butter-Creme/Ei-Schaum/Eischnee, CO₂ aus Backpulver/Natron/Hefe, Mineralwasser, Dampf), wann, und wie lange es hält; Zeile „Volumen aus …“ und Haltezeit-Warnung (DR-049); Zahlen fürs Gas-Budget je 100 g Teig (Schätzung ohne Dampf, DR-050) |
| `werkzeuge.json` | Werkzeuge und Anforderungen (Luft schlagen, cremig aufschlagen, kneten): was jedes Werkzeug kann und wie viel länger es von Hand dauert; Ausstattung im Kasten, Standard = Alltags-Küche (DR-060); Pürierstab-Regeln der Emulsion (DR-053, DR-058) |
| `zustaende.json` | Soll-Zustände von Zutaten mit Wegen dorthin: Butter weich (rausstellen, Würfel, Glas, Mikrowelle), Eier zimmerwarm (rausstellen, Wasserbad), Butter geschmolzen (Topf, Mikrowelle); Klappe an der Zutat, ein gewählter Weg wird Vorlauf-Schritt (DR-064, DR-065) |
| `modelle.json` | Rechenmodelle mit Parametern, Quelle und Validierung (Gärmodell: Hefe × Zeit × Temperatur) |
| `temperaturen.json` | benannte Temperatur-Bereiche (Kühlschrank, kühl, Raum, warm, lauwarm, plastisch für Fett, Teig für die Teigtemperatur); Temperaturen stehen überall als Zahl, Wert ± Spielraum, Spanne oder Name (`temperatur` an Operationen, `temperaturen` im Rezept) |
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
- Vor dem Einpflegen prüfen: Zutat-Schlüssel, Rollen, Einheiten, Dubletten (id und URL), Grenzen.
- Nach jedem Korpus-Zuwachs `node tools/ueberraschungen.mjs` laufen lassen: zeigt Grenzen, die ein einzelnes Rezept trägt, und Rezepte, die das Gärmodell verfehlen — mit Mustern (zum Beispiel fehlt die Raumtemperatur). Der Korpus enthält nur Erfolge; Misserfolge kommen aus den Rückmeldungen und aus dem kleinen Negativ-Korpus (`src/data/negativ.json`, `node tools/negativ.mjs`).
- **Aussagen bewerten** (DR-074): jede Regel macht Aussagen, die in `src/data/aussagen.json` Wirkung, Gewissheit und Beleg tragen. `node tools/aussagen-pruefen.mjs` zeigt Verteilung, Prüf-Priorität (Wirkung × Unsicherheit) und Befunde zu `strenge`; `test/aussagen.check.mjs` erzwingt, dass `never` und `proven` einen begutachteten Studien-Nachweis mit DOI tragen. Neue Regeln brauchen eine Aussage (der Test meldet fehlende), alle Startwerte sind Schätzungen mit Begründung, bis Rückmeldungen oder ein Nachweis sie bestätigen.
- Nach Änderungen an Regeln, Grenzen oder Korpus außerdem: `node tools/gaerung-fit.mjs` (Gärmodell gegen den Korpus, mit Leave-one-out-Spanne und Prüf-Rezepten), `node tools/negativ.mjs` (dokumentierte Misserfolge gegen die Regeln), `node tools/rollen-freiheit.mjs` (Substitutions-Freiheit je Rolle; `archetypes.json` muss übereinstimmen, der Test prüft es) und `node tools/qualitaet-gewicht.mjs` (wie stark ein Qualitäts-Gewicht die Mengen verschöbe; der Schalter steht in `corpus.js` und ist aus).
- **Qualitätsnote 1–5** je Rezept (`qualitaet`, mit Begründung in `qualitaet_grund`): nach neuen Rezepten `node tools/qualitaet.mjs --write` ausführen. Eigene Note: `qualitaet_manuell` im Rezept setzen, das Skript fasst sie nie an. Die Note wird nur angezeigt, Mengen rechnen unabhängig davon (DR-026). Rezepte, die nicht ins Raster passen (Sauerteig, Honig, andere Mehlsorten), lieber weglassen als erfinden.

## Arbeitsweise

- Offene Arbeit steht in [docs/TODO.md](docs/TODO.md) (mit Pro, Contra, Risiko), Erledigtes im [Archiv](docs/TODO_ARCHIVE.md).
- Entscheidungen mit Optionen stehen in `docs/DECISIONS.md`; vor größeren Änderungen erst Optionen vorlegen.
- Planung offline (claude.ai) und Umsetzung (Claude Code, Laptop) gleichen sich über Patch-Dateien in `HANDOFF/` ab, siehe [HANDOFF/SYNC.md](HANDOFF/SYNC.md). Nur die Umsetzungsseite pusht.

## Deploy

Der Webspace holt `main` von GitHub per `deploy.php` (Aufruf mit Zugriffstoken, steht nur auf dem Server, nie im Repo). Welche Dateien übernommen werden, steht in `chefing.cfg`. Die Server-Datei `.htaccess` gehört nicht ins Repo. Hintergrund: DR-013.

### Rückmeldungen einrichten (einmalig)

`feedback.php` verteilt `deploy.php` bewusst nicht (das Muster in `chefing.cfg` kennt nur `*.html *.js *.css *.json`). Datei einmal von Hand neben `index.html` auf den Webspace legen (PHP ab 8.1). Beim ersten Schreiben entsteht `feedback-data/` mit eigener `.htaccess`; danach prüfen, dass `…/feedback-data/feedback.jsonl` mit 403 oder 404 antwortet. Auswerten: `feedback-data/feedback.jsonl` herunterladen und `node tools/rueckmeldungen.mjs feedback.jsonl` ausführen. Grenzen und Löschung stehen in `feedback.php` (30 Meldungen je 15 Minuten, 500 je Tag, 5 MB). Die Datenschutzerklärung der Seite sollte die Kommentare erwähnen.
