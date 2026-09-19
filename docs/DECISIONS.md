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

**Nachtrag (2026-09-18, nach Nutzer-Feedback „S-Twist fürs Mischen, Steak-Icon fürs Fleisch, eigenes Whisking-Icon“):**
- `mischen` ist jetzt ein doppelter Bogen („S“-Twist) statt Kreisbogen mit Pfeilspitze.
- `fleisch` ist jetzt ein Steak (runde Fläche mit drei ausgesparten Grillstreifen, per `fill-rule: evenodd` — funktioniert unabhängig vom Button-Hintergrund) statt Keule.
- Neues, sechstes Verb `schlagen` (Schneebesen-Icon: Griff + Drahtkorb) für die kräftige Schlagbewegung — bekommen `aufschlagen`, `verquirlen`, `eier_zucker_schaumig`. Das bisherige `mischen` bleibt für sanftes Unterheben/Verrühren (`eier_einzeln`, `trocken_mischen`, `unterheben_*`, `alles_verruehren`, `einlage_unterheben`). Diese Trennung spiegelt einen echten Technik-Unterschied (Schneebesen/Rührer vs. Falten) und war im ursprünglichen Nutzer-Beispiel „mix(…), whisking“ bereits angelegt.

**Nachtrag 2 (2026-09-18, „check for better trockenes mischen icon“):** Siebtes Verb `sieben` (Sieb-Ring mit Gitter + durchfallendem Pulver) speziell für `trocken_mischen` — klarer als das generische `mischen`-S für „Pulver gleichmäßig vermengen“.

## DR-010 · tech · Regression aus DR-008 behoben: Gluten-Warnung geprüfte falsches Feld
- **descr:** (2026-09-18) `rules.js` prüfte weiterhin `props.struktur.kategorie !== 'getreide'` — nach DR-008 tragen aber alle Struktur-Optionen (Weizenmehl, Speisestärke, Nussmehle) `kategorie: "mehl"`, wodurch die Bedingung immer wahr war und die Warnung selbst bei reinem Weizenmehl feuerte. Fix: neues explizites Feld `bildet_gluten` (bool) je Zutat statt der Kategorie-Zeichenkette; `rules.js` prüft jetzt `bildet_gluten === false`.
- **pro:** Korrektes Verhalten wiederhergestellt; `bildet_gluten` ist zusätzlich robuster als die zuvor zweckentfremdete Kategorie-Zeichenkette — sagt genau das, was geprüft wird.
- **cons:** Ein weiteres Zutat-Feld zu pflegen, wenn neue Struktur-Zutaten hinzukommen.
- **risk:** Gering. Verifiziert im Browser: Weizenmehl → keine Warnung, Speisestärke → Warnung mit korrektem Text.

## DR-011 · tech · Bindung vs. Körper bei Struktur-Zutaten (Nutzer-Frage) — Teilkorrektur, tiefere Modellierung offen
- **descr:** (2026-09-18) Nutzer-Beobachtung: „Struktur“ bündelt zwei Eigenschaften — Bindung/Verdickung (liefert auch reine Stärke) und Körper/Eiweißgerüst (nur Gluten-Mehl). Sofortmaßnahme: `bildet_gluten`-Feld (DR-010) plus präzisere Warnung, die diese Unterscheidung benennt und mit einem echten Korpus-Beispiel belegt (Gugelhupf: 350 g Mehl + 50 g Speisestärke — Stärke als Teilersatz, nie als alleinige Struktur).
- **pro:** Behebt die akute Ungenauigkeit ohne das Rollen-Schema anzufassen; die Meldung ist jetzt fachlich korrekt statt pauschal „kein Gluten“.
- **cons:** Der Rolle „Struktur“ bleibt technisch weiterhin EIN Feld für zwei Eigenschaften — eine reine Stärke-Auswahl wird nicht verhindert, nur (korrekt) kommentiert. Der Name „Bindung“ ist für eine zweite Rolle nicht wiederverwendbar, da er bereits für Ei vergeben ist.
- **risk:** Die eigentliche Modellfrage bleibt offen: sollte „Struktur“ in zwei Rollen (Körper/Gluten-Gerüst vs. Bindung/Stärke) aufgeteilt werden, und sollte eine Rolle mehrere Zutaten (Mischungen wie Mehl+Stärke) statt nur einer erlauben? Das berührt `archetypes.json`, `engine.js` (Bäckerprozent-Aufteilung) und die Korpus-Normalisierung — als T15 zurückgestellt statt hier überstürzt umgesetzt. **Siehe DR-012: der Nutzer hat sich für die generische Multi-Zutat-Lösung entschieden, die diese Frage praktisch löst, ohne die Rolle formal zu splitten.**

## DR-012 · tech · Multi-Zutat pro Rolle mit Anteilen, für alle Rollen (Option B)
- **descr:** (2026-09-18) Nutzer mischt Fett gewohnheitsmäßig aus Butter und Öl — Bestätigung, dass Mehrfachauswahl kein Sonderfall von „Struktur“ ist, sondern generisch gebraucht wird. Statt zwei Rollen (Körper/Bindung, siehe DR-011) oder Mehrfachauswahl nur für ausgewählte Rollen (Option C, verworfen): **jede** Rolle akzeptiert jetzt 1..n Zutaten mit relativen Anteilen (`state.zutaten[rolle] = [{zutat, anteil}]`, Default 1 Zutat = ein Eintrag mit `anteil: 1`). `propsOf` blendet die Eigenschaften für Regeln/Engine (dominante Zutat nach Anteil bestimmt Aggregatzustand/Schmelzpunkt/Label; `saeure`, `bildet_gluten`, `quellfaehig`, `trieb_typ` werden ODER-verknüpft über alle gewählten Zutaten). `engine.js` verteilt die Rollen-Bäckerprozent proportional zu den Anteilen auf mehrere Zeilen der Zutatenliste. Die Korpus-Schicht brauchte keine Änderung — `corpus.js` summierte mehrere Zutaten pro Rolle bereits vorher korrekt (siehe DR-011).
- **pro:** Bildet die Kochrealität ab (Mischfette, Mehl+Stärke, mehrere Trieb- oder Einlage-Zutaten); ein einziges Konzept für alle Rollen statt Sonderfall-Code; löst DR-011s offene Frage pragmatisch, ohne das Rollen-Schema aufzuspalten.
- **cons:** Größter Einzeleingriff bisher — State-Form, `morphbox.js`-Interaktion (Klick = Umschalten statt Ersetzen, plus Anteil-Eingabe), `rules.js`/`engine.js` mussten für Arrays statt Einzelwerte umgebaut werden. Blend-Regeln (dominant vs. oder-verknüpft) sind pragmatische Entscheidungen, keine physikalisch exakte Mischungsrechnung — z. B. wird bei gemischtem Fett nur ein Hinweis ausgegeben, keine exakte Vorhersage der Cremigkeit.
- **risk:** Höheres Regressionsrisiko, da praktisch jede Modell-Datei berührt ist. Mitigation: Verifikation aller drei Presets (weiterhin je 1 Zutat/Rolle, muss identisch wie vorher funktionieren) plus gezielter Mischfett-Test (Butter+Öl) nach der Umsetzung.

## DR-013 · tech · Deploy per Pull-Script (`deploy.php`), statt GitHub Pages oder FTP
- **descr:** (2026-09-19) Nutzer will auf eigenes Webhosting statt GitHub Pages deployen. Übernommen aus Schwesterprojekt `202506_InfoPedia/infopedia_php`: `deploy.php` liegt auf dem Webspace, lädt per Token-geschütztem GET die aktuelle ZIP vom `main`-Branch via `codeload.github.com`, entpackt nur Dateien, die auf `files`-Pattern aus `chefing.cfg` passen (`*.html *.js *.css *.json`), und überschreibt sie im Zielverzeichnis. `chefing.cfg` (Token-Platzhalter `change-me`, wird nie von `deploy.php` selbst überschrieben, da `.cfg` nicht im Pattern ist) muss der Nutzer selbst einmalig zusammen mit `deploy.php` auf den Webspace laden (FTP/Hosting-Panel — Zugangsdaten bleiben bei ihm) und den echten Token danach direkt auf dem Server setzen.
- **pro:** Kein FTP-Zugang für Claude nötig, kein GitHub-Actions/Pages-Setup; Update danach ist ein einziger Seitenaufruf (`deploy.php?token=…`); Muster ist im Zweitprojekt bereits bewährt.
- **cons:** Erfordert PHP + `ZipArchive`-Extension auf dem Zielhosting; Token liegt als Klartext in `chefing.cfg` auf dem Server (kein HTTPS-Zwang erzwungen); kein automatischer Trigger — Nutzer muss die URL nach jedem Push manuell aufrufen (oder selbst einen Cronjob/Webhook einrichten).
- **risk:** Falls das Hosting kein PHP/ZipArchive unterstützt, funktioniert der Mechanismus nicht — dann bliebe nur klassisches FTP oder GitHub Pages. Mitigation: vor Erstnutzung einmal `deploy.php?token=…` aufrufen und Fehlerausgabe prüfen.

## DR-014 · tech · `zusatzverben` (Icon-Merge) + Pseudo-Operation `wiederholen` (KISS-Variante)
- **descr:** (2026-09-19) Ausgangspunkt: Ablaufdiagramm sollte für „Mehl sieben“ + „Mehl abwechselnd unterheben“ nicht zwei fast identische Boxen zeigen, und die Wiederholung („abwechselnd“ = portionsweise, mehrfach) war bisher nur Fließtext ohne eigenes Icon. Umgesetzt als zwei kleine, unabhängige Erweiterungen statt eines großen Sequenz-Umbaus (verworfen: Haupt-/Attribut-Objekte in `sequenz`, siehe Chat-Diskussion): **(1)** `operations.json` erlaubt jetzt optional `zusatzverben: [verbKeys]` — reine Anzeige, keine eigene Voraussetzungsprüfung; `unterheben_abwechselnd` trägt `zusatzverben: ["sieben"]`. **(2)** Neue Pseudo-Operation `wiederholen_abwechselnd` (verb `wiederholen`, neues Icon: Kreispfeil in `icons.js`/`verben.json`) mit `auf: []`, `voraussetzung: []` und optionalem `bezieht_sich_auf`-Feld (nur Doku/zukünftige Verwendung, keine Engine-Logik) — steht als eigener Schritt direkt nach `unterheben_abwechselnd` in `sequenz` von `creme` und `ruehroel`. `trocken_mischen` wurde dort aus der `sequenz` entfernt (Sieb-Icon läuft jetzt über `zusatzverben` mit), bleibt aber für `muffin` unverändert ein eigener Schritt (dort nicht benachbart zu `unterheben_kurz`, keine Wiederholungs-Semantik). `engine.js` reicht `zusatzverben` 1:1 als `zusatzVerben` durch; `flow.js` hängt sie einfach an die bestehende Icon-Reihe an.
- **pro:** Minimaler Diff (1 neues Feld + 1 neue Operation + 2 Zeilen `flow.js`/`engine.js`), keine Änderung an `sequenz`-Schema (bleibt flache String-Liste), kein neuer `typ`, keine Sonderfall-Voraussetzungsprüfung für Attribut-Operationen. Im Browser verifiziert: Crememethode zeigt Schritt 3 mit 4 Icons (Mehl, Flüssigkeit, Mischen, Sieben) + eigenen Schritt 4 „Wiederholen“ mit Kreispfeil-Icon; Muffin-Methode unverändert (Trockenes-Mischen bleibt eigener Schritt).
- **cons:** `wiederholen_abwechselnd` ist ein Pseudo-Schritt ohne Wirkung auf Zutaten/Statistik — zählt in der Ablauf-Nummerierung/Dauer wie ein echter Schritt, obwohl er nur Text+Icon liefert. `bezieht_sich_auf` wird aktuell von keinem Code gelesen (nur Doku-Feld) — falls später ein Rücksprung-Pfeil im Diagramm gewünscht wird (siehe D2-Klammer-Idee aus dem Dummy-Vergleich), muss `flow.js` das erst auswerten.
- **risk:** Gering — betrifft nur `creme`/`ruehroel`, `muffin`/`allinone` unverändert. Falls weitere Methoden `unterheben_abwechselnd` wiederverwenden, erben sie automatisch `zusatzverben`; das ist beabsichtigt, aber im Hinterkopf behalten.
