# Chefing — Decision Records

Felder: `type` [tech, biz, client, …] · `title` · `descr` · `pro` · `cons` · `risk`

---

## DR-001 · tech · Generisches, domänenneutrales Schema statt kuchenspezifischem Modell
- **descr:** Zutat→Eigenschaften, Operation→Voraussetzungen, Methode→Sequenz, Archetyp→Rollen, Gefäß. Rollen und Regeln sind Daten, kein Code. (2026-09-18)
- **pro:** Neue Domänen („Gemüse braten“) sind nur JSON; Vision „Kochen als Kombinatorik“ wird direkt abgebildet.
- **cons:** Abstrakter, mehr Indirektion; erste Domäne dauert länger als ein Spezialmodell.
- **risk:** Schema passt nur für Rührteig und muss beim zweiten Archetyp umgebaut werden. Mitigation: T06 früh angehen.

## DR-002 · tech · Regeln in `operations.json`, nicht im JavaScript
- **descr:** Jede Operation trägt `voraussetzung` (Rolle, Eigenschaft, Wert) und optional `vorbereitung_falls_nicht`. Die Engine prüft nur generisch.
- **pro:** Regeln lesbar und erweiterbar ohne Programmierung; Begründungen („warum nicht“) kommen aus derselben Quelle.
- **cons:** Komplexe Regeln (Mengenabhängigkeiten, Kombinationen mehrerer Rollen) sind im flachen Format schwer auszudrücken.
- **risk:** Sonderfälle wandern doch in den Code (aktuell: Natron-Säure-Check und `nachVorbereitung` in `rules.js`). Beobachten, ggf. Regelformat erweitern.

## DR-003 · tech · Best-of wird aus einem Rezept-Korpus berechnet, nicht kuratiert
- **descr:** Normalisierte Quellrezepte in `src/data/corpus/`; Bäckerprozent (Mehl = 100) je Rolle, Median/Q1/Q3 zur Laufzeit; Backtemperatur/-zeit aus Korpus-Median ab n ≥ 3.
- **pro:** Nachprüfbar, mit Quellenlinks; Lehrbuch vs. Praxis wird sichtbar (z. B. Fett bei Muffins ~55 % statt 100 %).
- **cons:** Mit 7 Rezepten je Variante statistisch dünn; Normalisierung (Stück, TL, Pck.) ist fehleranfällig.
- **risk:** Ausreißer verzerren den Median wenig, aber IQR stark. Mitigation: T04.

## DR-004 · tech · UI als morphologischer Kasten + Ablaufdiagramm
- **descr:** Dimensionen (Rollen, Gefäß, Methode) × Optionen mit Zuständen gewählt/best-of/ungültig; die gewählte Kombination wird als SVG-Ablauf gerendert.
- **pro:** Zeigt Kombinatorik direkt; ungültige Pfade sind sichtbar und begründet.
- **cons:** Skaliert schlecht bei vielen Optionen pro Dimension; Diagramm ist nur linear.
- **risk:** Bei zweitem Archetyp mit Verzweigungen reicht lineares SVG nicht. Dann Graph-Layout nötig.

## DR-005 · tech · Statisch, kein Framework, kein Build-Tool
- **descr:** HTML/CSS/ES-Module, JSON per `fetch`, `npx serve` zum Testen.
- **pro:** Null Setup, sofort lauffähig, gut für schnelle Iteration.
- **cons:** Kein Typing, keine Komponenten-Abstraktion, manuelles DOM-Rendering.
- **risk:** Bei wachsender UI wird Rendering unübersichtlich. Umstieg später möglich, da Modell-Schicht (`src/model`) framework-frei ist.

## DR-006 · biz · Projektname „Chefing“, Repo github.com/PluggPreagar/chefing
- **descr:** Name vom Nutzer gesetzt (statt der vorgeschlagenen Alternativen); Remote `origin` eingerichtet.
- **pro:** Kurz, merkbar, Repo existiert bereits.
- **cons:** –
- **risk:** –

## DR-007 · client · Arbeitsweise: Todo-Liste, Decision Records, KISS-Optionen
- **descr:** Todos in `docs/TODO.md` (id, title, state, descr, dependencies); Entscheidungen hier; Vorschläge immer als Optionen mit Titel, Keywords, Descr, Pro, Cons, Risk+Effort.
- **pro:** Überblick ohne Textwände; Entscheidungen bleiben nachvollziehbar.
- **cons:** Etwas Pflegeaufwand pro Schritt.
- **risk:** Dateien veralten, wenn nicht bei jedem Schritt nachgezogen. Mitigation: Konvention auch als Memory hinterlegt.

## DR-008 · tech · Zutat-Kategorien (generisch, iconisiert) + Operationen auf wenige Verben verdichtet + Strenge-Grade für Regeln
- **descr:** (2026-09-18, nach Nutzer-Vorgabe „B, leg den DR an, and allow variances … indicate strictness“)
  1. Neue Datei `kategorien.json`: 10 domänenneutrale Zutat-Kategorien (salz, suesse, gemuese, mehl, fett, fluessigkeit, pulver, kohlenhydrate, fleisch, ei), je mit Icon (Emoji) und Label. Jede Zutat in `ingredients.json` bekommt ein neues `kategorie`-Feld aus dieser Liste; das bisherige, feinere Feld (getreide/nuss/milchprodukt/…) heißt jetzt `unterkategorie` und bleibt für bestehende Prüfungen (z. B. „Nuss als Struktur“ in `engine.js`) erhalten.
  2. Neue Datei `verben.json`: 5 essentielle Operations-Verben (schneiden 🔪, vorbereiten 🥣, mischen 🌀, formen 🧁, garen 🔥). Jede Operation in `operations.json` bekommt `verb` + `variante` (Klartext-Technik, z. B. `mischen` + „kräftig aufschlagen“). Die 13 bestehenden Operationen bleiben als eigene Einträge (Sequenzen/Engine unverändert) — `verb` ist eine zusätzliche, additive Klassifikation für Icons/UI, kein Ersatz der bestehenden Mechanik.
  3. Jede `voraussetzung` einer Operation bekommt `strenge`: `hart` (blockiert wie bisher, ggf. mit Vorbereitung), `empfohlen` (Hinweis/Warnung, Status bleibt gültig), `frei` (legitime Variante, kein Hinweis). Default ohne Angabe = `hart` (abwärtskompatibel). Erstes Beispiel: `alles_verruehren` verlangt Fett fest nur noch als `empfohlen`, nicht `hart`.
  4. Icons erscheinen im morphologischen Kasten (Zutat-Kategorie) und im Ablaufdiagramm (Verb je Schritt).
- **pro:** Direkter visueller Anker fürs Merken (kleines Icon-Set statt Fließtext); Regelwerk kann jetzt echte Kochpraxis abbilden, wo Abweichungen normal und nicht „falsch“ sind; additiver Ansatz — keine Regression am laufenden Rührteig-Fall.
- **cons:** Zuordnung einiger Zutaten zu einer der 10 Kategorien ist unscharf (z. B. Gewürze/Aromen und Schokolade/Rosinen landen pragmatisch bei „pulver“ bzw. „gemuese“, nicht exakt). Operationen sind noch nicht wirklich auf 5 Einträge verdichtet — `verb` ist vorerst nur eine Zusatz-Klassifikation, keine Strukturreduktion.
- **risk:** Echte Verdichtung der Operationen (z. B. `aufschlagen`/`verquirlen`/`alles_verruehren` zu einer parametrisierten `mischen`-Operation) berührt `methods.json`-Sequenzen, `rules.js` und `engine.js` und ist bewusst auf einen späteren Schritt verschoben (siehe Todo), um das Risiko in dieser Iteration klein zu halten.

## DR-009 · tech · Piktogramme statt Emoji, Gemüse/Obst getrennt, Ablaufschritt = Zutat-Icon(s) + Verb-Icon
- **descr:** (2026-09-18, Verfeinerung von DR-008 nach Nutzer-Vorgabe „use very simple/recognizable icons, just black path // separate vegi from obst // a step is a combination of ingredients and treatment“)
  1. Neue Datei `src/ui/icons.js`: handgezeichnete, einfarbige Piktogramme (einfache SVG-Grundformen: Rechteck, Kreis, Ellipse, Polygon, teils Pfad) statt Emoji. Ein Renderer für HTML (`iconHtml`, per `innerHTML`) und einer für SVG-DOM (`iconGroup`, für das Ablaufdiagramm) teilen sich dieselbe Geometrie-Quelle. Farbe folgt `currentColor` (passt sich Hell/Dunkel-Theme an).
  2. `kategorien.json` bekommt `gemuese` UND `obst` als getrennte Kategorien (vorher eine gemeinsame „Gemüse/Frucht“). Rosinen/Blaubeeren → `obst`; Schokolade hat keinen sauberen Platz in Gemüse/Obst und wurde pragmatisch zu `suesse` umgezogen.
  3. Jeder Ablauf-Schritt zeigt jetzt die Kombination aus den Zutat-Kategorie-Icons der Rollen, auf die die Operation wirkt (`op.auf`, tatsächlich belegte Rollen), plus dem Verb-Icon — im Diagramm als Icon-Reihe über dem Textlabel, in der Schrittliste als Icon-Präfix.
- **pro:** Icons sind bei sehr kleiner Größe klarer unterscheidbar als Emoji (die je nach Betriebssystem/Schriftart unterschiedlich aussehen); ein Schritt liest sich jetzt direkt als „diese Zutat(en) + diese Handlung“, näher an der Nutzer-Vision der Kombinatorik.
- **cons:** Handgezeichnete Pfade sind pflegeaufwändiger als Emoji (jede neue Kategorie/jedes neue Verb braucht eigene Geometrie); bei sehr generischen Formen (z. B. „Süße“ als vier Quadrate, „Pulver“ als Haufen) ist die Erkennbarkeit ohne Textlabel begrenzt — Icons ergänzen das Label, ersetzen es nicht.
- **risk:** Fleisch-Icon (Keule) ist bei 15 px noch nicht ideal erkennbar; da die Kategorie im Rührteig-Archetyp ungenutzt ist, unkritisch — bei Einführung eines fleischbasierten Archetyps (T06) erneut prüfen.
