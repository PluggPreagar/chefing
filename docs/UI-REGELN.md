# Chefing — UI-Regeln

Das kompilierte Regelwerk für Bedienung und Oberfläche. Es fasst die Entscheide aus `docs/DECISIONS.md` zusammen
(DR-037, 045, 078, 079, 083 bis 090, 094); dort steht das Warum und die Geschichte, hier steht, **was jetzt gilt**.
Stand: 2026-10-25. Eine Abweichung braucht einen eigenen DR (Beispiele: DR-085 und DR-088 weichen von DR-079 ab).
Vor jeder UI-Arbeit und vor jeder Meldung aus `issues/open/` zuerst hier nachsehen.

## 1 Welches Element für welche Wahl

| Wahl | Element | Quelle |
|---|---|---|
| an/aus, ein benannter Zustand, wirkt sofort | **Häkchen** mit fester Beschriftung, Zustands-Symbol dahinter erlaubt | DR-078, 079 |
| eine aus 2 bis 5 benannten Möglichkeiten, wirkt sofort | **Knopfgruppe** (Segment), gewählt = `aria-pressed` | DR-045, 079 |
| zwei Zustände, die beide einen Namen verdienen | **Knopfgruppe mit beiden Namen**, nie ein Häkchen „mit X“ | DR-086 |
| eine aus mehreren, mit Erklärung oder Status | **Optionskarten** (Radiogruppe) | DR-079 |
| mehrere zugleich | **Gruppe von Umschaltern** (je `aria-pressed`) | DR-079 |
| Antwort auf eine Frage | **Knopfgruppe** mit den Antworten | DR-045 |
| Aktion ohne Zustand | **Knopf mit Verb**, nie hervorgehoben | DR-079 |
| allgemeine, selten geänderte Einstellung | **Auswahlmenü** (Knopf mit gewähltem Symbol, Liste beim Öffnen) | DR-085 |
| mehr als etwa 7 Möglichkeiten | **Auswahlliste** | DR-079 |
| zwei verwandte Aktionen, die man wiederholt | **geteilter Knopf**, merkt die zuletzt gewählte Aktion | DR-088 |

- **R1** Ein Element zeigt **Zustand oder Aktion, nie beides**. Beschriftung fest und positiv; der Zustand steckt im Kästchen, in der Auswahl oder im Symbol. Wechselnde Symbole zeigen den Zustand, nie die Aktion. (DR-078, 079)
- **R2** Nicht verwenden: Schalter (Switch), Filter-Chips (vor einer Reihe von Filtern), Knöpfe mit wechselnder Beschriftung. Ausnahme **geteilter Knopf** (R9). (DR-079, 088)
- **R3** **Auto plus feste Übersteuerung**: Wahlen, die sich aus der Umgebung ableiten lassen, bekommen eine Stufe „Auto“ und behalten die festen Stufen. Eine feste Wahl gilt überall, auch im Vollbild; Auto folgt dem Bildschirm. (DR-090)

## 2 Auffälligkeit und Ort

- **R4** Die Auffälligkeit richtet sich nach **Wirkung und Häufigkeit**. Selten geänderte, allgemeine Einstellungen stehen **oben** als Auswahlmenü (Erfahrung); oft gewechselte Wahlen bleiben als Knopfgruppe **am Ort ihrer Wirkung**. (DR-085)
- **R5** **Fluss und Einstellungen trennen.** Fluss = eine Zeile direkt unter dem Titel und **vor** der Beschreibung (Brotkrumen), Hierarchie in einer Zeile: `Archetyp › Variante`. Einstellungen = **Werkzeugleiste rechts oben** (Erfahrung, Statistik, Kandidaten), **Melden** daneben. (DR-087, 095)
- **R6** Einstellungen, die **nur das Diagramm** betreffen, stehen im **Kopf des Diagramm-Blocks, oben rechts**, in gleicher Form, Größe und Lage wie der Vollbild-Knopf: Text | Symbole (nur bei Kompakt), Ausrichtung Auto | Strom | Kompakt, Vollbild. (DR-090)
- **R7** Was das **Rezept** ändert („mit Eischnee“), bleibt im Kopf des Diagramm-Blocks links und ist im Vollbild ausgeblendet; was nur die Darstellung ändert, bleibt im Vollbild bedienbar. (DR-080, 090)
- **R8** Zwei Bedienelemente für dieselbe Entscheidung gibt es nicht; ein zweites ist nur eine Abkürzung und genau dasselbe Element. (DR-079)
- **R9** **Geteilter Knopf** (Melden): Hauptteil führt die gemerkte Aktion aus, Pfeil öffnet die Liste, **Wählen führt sofort aus und merkt** (`localStorage`). Beschriftung und Symbol des Hauptteils nennen die Aktion; der Tooltip nennt sie genau. (DR-088)

## 3 Beschriftung und Symbole

- **R10** Eine Aktion in einer Werkzeugleiste ist **nur ein flaches Symbol aus dem Symbolsatz** (`src/ui/icons.js`), erklärt durch `title` und `aria-label`, ohne Text im Knopf. Text bleibt nur, wo es kein bekanntes Symbol gibt oder die Aktion ohne Wort mehrdeutig wäre. (DR-084)
- **R11** Fehlt ein Symbol, kommt es in `icons.js` dazu (24×24, Linie, runde Enden, `currentColor`), nie ein Einzelsymbol im Modul. Für Kochbegriffe bevorzugt kochtypische Symbole: Löffel = Einsteiger, Schneebesen = Fortgeschritten, Kochmütze = Profi. (DR-084, 085)
- **R12** Wörter: kurz, ein Verb, ein Begriff für eine Sache. Der Einstieg heißt **Melden** (nicht „Fehler melden“: es sind auch Ideen und Fragen), die Bewertung eines Rezepts **Bewerten**; „Rückmeldung“ meint nur die Bewertung. (DR-083, 088)

## 4 Stil

- **R13** **Flach**: Rahmen nur beim Darüberfahren, ausgewählt = getönter Grund ohne Rahmen, Höhe und Breite 2,4 rem für Symbol-Knöpfe, sichtbarer Fokusring. Gilt für alles im Diagramm-Kopf. (DR-090)
- **R14** Diagramme stehen **mittig** und sind in der Breite begrenzt (Kompakt höchstens 640 Pixel); Text und Zeilen darum zentriert. **Im Vollbild** wird das Diagramm stattdessen auf Breite und Höhe eingepasst. Das gilt für Kompakt und Strom; in Kompakt (Symbole) springt der Strom nicht, wenn ein Detail auf- oder zugeht. In der Strom-Ansicht (quer) stehen ab 1100 px Zeitleiste und Karte in zwei Spalten, die Karte in fester Breite. (DR-090, 096, 097, 098)
- **R15** Gleichartige Knöpfe stehen als **Knopfgruppe** (Ränder verbunden, gewählter hervorgehoben), verschiedene Gruppen mit sichtbarem Abstand getrennt; keine losen Reihen einzelner Pillen. (DR-045)

## 5 Schmale Bildschirme (bis 640 Pixel)

- **R16** Titel, Einstellungen und **Melden nur als Symbol** in **einer** Zeile; reicht der Platz nicht (etwa 320 px), rutscht Melden rechtsbündig in die nächste Zeile. Archetyp und Varianten **untereinander und linksbündig**, der Pfeil entfällt. Nichts bricht mitten in einer Gruppe um, kein Trenner steht allein am Zeilenende. (DR-087, 094)
- **R17** Im Diagramm-Kopf bleibt das Vollbild in der **ersten** Zeile rechts, Text | Symbole und Ausrichtung rutschen in die zweite. (DR-090)
- **R18** **Kein Abstand mit `margin-left: auto` auf zwei Geschwistern**: sie teilen sich den freien Platz und landen in der Mitte. Stattdessen ein Platzhalter (`::after` mit `flex: 1 1 0`) und `order`. (DR-087)
- **R19** CSS-Reihenfolge: eine Regel in einer Medienabfrage verliert gegen eine **spätere** Regel gleicher Spezifität; Medienabfragen stehen nach den allgemeinen Regeln oder werden spezifischer (`nav.fluss`). Ein `display` in einer Regel überschreibt das Attribut `hidden`, dann braucht `[hidden]` eine eigene Regel. (DR-087)

## 6 Barrierefreiheit und Bedienung

- **R20** Gruppen haben `role="group"` und `aria-label`, Menüs `aria-haspopup="listbox"`, `aria-expanded`, Optionen `role="option"` mit `aria-selected`, Umschalter `aria-pressed`. (DR-079, 085, 088)
- **R21** Tastatur für Menüs: Pfeile bewegen den Fokus (ohne Umlauf), Pos1 und Ende springen, Enter und Leertaste wählen oder öffnen, Esc schließt, Tab schließt und lässt den Fokus weiterwandern. Ein Klick außerhalb schließt. (DR-085, 088)

## 7 Robust ändern und prüfen

- **R22** Neues Markup braucht einen **Rückfall für eine zwischengespeicherte `index.html`**: Alte Elemente beim Start entfernen, fehlende Plätze anlegen. (DR-037)
- **R23** Jede UI-Änderung bekommt einen **Test für Struktur und Reihenfolge** und wird **im Browser bei 375 Pixel und am Desktop gemessen** (Überlauf, Zeilen, Lage), nicht nur angesehen.
- **R24** Gespeicherte Wahlen behalten ihren Schlüssel oder werden übernommen (`chefing.ablauf` → `chefing.ausrichtung`), damit keine Wahl des Nutzers verloren geht. (DR-090)
- **R25** Jede Meldung aus `issues/open/` wird zuerst gegen diese Regeln geprüft; was ihnen widerspricht, geht als Entscheidung mit Optionen an den Nutzer, nicht direkt in den Code. Erledigte Meldungen kommen nach `issues/closed/`.

## Dokumentierte Ausnahmen

| Regel | Ausnahme | Grund | DR |
|---|---|---|---|
| Tabelle „eine aus 2 bis 5 → Knopfgruppe“ | Erfahrungsstufe als Auswahlmenü | selten geänderte, allgemeine Einstellung (R4) | DR-085 |
| R1, R2 (feste Beschriftung) | Melden / Bewerten wechselt am geteilten Knopf | der Hauptteil ist die Aktion selbst (R9) | DR-088 |
| R10 (nur Symbol) | „Melden“ mit Symbol und Text, nur breit (über 640 px) | Einstieg in ein Menü, Text trägt die Bedeutung; schmal nur Symbol (DR-094); Panel-Knöpfe („Absenden“, „ZIP herunterladen“) mit Text | DR-088, 094, 084 |
| R6 (Einstellungen im Diagramm-Block) | Erfahrung, Statistik, Kandidaten in der Werkzeugleiste | betreffen die ganze Seite, nicht das Diagramm | DR-087 |
