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

## 2026-09-20 — Rechtliche Recherche T20 (Copyright Korpus-Quellen)

Keine Korpus-Recherche, sondern rechtliche Grundlagenrecherche für DR-015. Gelistet: Seiten,
die tatsächlich gelesen (WebFetch) wurden, nicht nur als Suchtreffer erschienen sind.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-09-20 | urheberrecht.de | 1 | Urheberrechtsschutz von Rezepten allgemein | Zutatenlisten nicht geschützt, Anleitungen nur bei Schöpfungshöhe, Fotos immer geschützt |
| 2026-09-20 | e-recht24.de | 1 | Abmahnrisiko bei Rezept-/Kochbuch-Übernahme | LG Hamburg: nur 2 von 127 kopierten Rezepten schutzfähig; Tipps zur eigenen Formulierung |
| 2026-09-20 | irights.info | 1 | Urheberrecht bei Kochrezepten, Datenbank-/Sammlungsschutz | Bestätigt Fakten-Freiheit; warnt vor systematischer Entnahme „wesentlicher Teile“ einer Quelle |

**Ergebnis siehe DR-015 in `docs/DECISIONS.md`.**

<!-- Neue Recherchen unten anhängen, nicht bestehende Zeilen überschreiben. -->

## 2026-10-18 — Aufbau Pfannkuchen-Korpus (T06 Stufe 2, Varianten Eierkuchen und Pancakes)

Recherche per Subagent (WebSearch/WebFetch); die Mengen stammen aus den von WebFetch gelieferten Seitenzusammenfassungen, nicht aus dem Rohtext — bei Auffälligkeiten gegen die Quelle prüfen. Nur Zutatenmengen als Fakten erfasst, Ablauf und Notizen in eigenen Worten (DR-015).

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | lecker.de | 3 | Korpus Eierkuchen (2), Pancakes (1) | Pfannkuchen-Grundrezept, Crêpes-Grundteig, Buttermilch-Pancakes |
| 2026-10-18 | gutekueche.at | 3 | Korpus Eierkuchen (2), Pancakes (1) | Zwei Palatschinken-Grundrezepte, Buttermilch-Pancakes |
| 2026-10-18 | kuechengoetter.de | 2 | Korpus Eierkuchen (1), Pancakes (1) | Pfannkuchen-Grundrezept, American Pancakes (Bewertung ohne Durchschnitt) |
| 2026-10-18 | essen-und-trinken.de | 2 | Korpus Eierkuchen (1), Pancakes (1) | Pfannkuchen „lecker und locker“, American Pancakes |
| 2026-10-18 | oetker.de | 1 | Korpus Eierkuchen | Pfannkuchen/Eierkuchen |
| 2026-10-18 | kribbelbunt.de | 1 | Korpus Pancakes | Blog-Sammelseite, kein klassisches Rezeptportal |
| 2026-10-18 | bbcgoodfoodme.com | 1 | Korpus Pancakes | Self-raising flour, als Weizenmehl + Backpulver erfasst (Triebmittel effektiv doppelt) |
| 2026-10-18 | kochbar.de | 1 | geprüft, verworfen | Joghurt-Pancakes: Mehl:Flüssigkeit 1:2 und ein ganzes Päckchen Backpulver auf 150 g Mehl — passt nicht zur Variante |

Nicht abrufbar oder ohne brauchbare Treffer: chefkoch.de (bewusst nicht), einfachbacken.de und brigitte.de (für den Crawler gesperrt), rewe.de (403), derstandard.at, eat.de, ichkoche.at (Eierkuchen: keine Mengen; Pancakes: leere Zutatenliste), springlane.de (unplausible Mengen). Verworfene Rezepte u. a.: Eischnee-Varianten (andere Methode), Dinkelmehl, zu dünn oder zu trocken für die Variante.

## 2026-10-18 — Korpus-Erweiterung auf ≥ 15 Rezepte je Variante (T04)

5 Subagenten parallel (WebSearch/WebFetch), je Variante 8–9 neue Rezepte, je Domain höchstens 1 Rezept, neue Domains bevorzugt (DR-015: Breite statt Tiefe). Vorgaben zur Vielfalt (Öl/Margarine, saure Flüssigkeiten, Einlagen, Methoden), kein Self-raising-Mehl, Zubereitung nur in eigenen Worten. Mengen stammen aus WebFetch-Zusammenfassungen, nur selten gegengeprüft; Auffälligkeiten stehen in den `notizen` der Rezepte. Geprüft vor dem Einpflegen: Zutat-Schlüssel, Rollen, Einheiten, Dubletten (id/URL), Grenzen.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | essen-und-trinken.de | 2 | Kastenkuchen, Muffin | Double-Chocolate-Kastenkuchen, Rosinenmuffins |
| 2026-10-18 | kuechengoetter.de | 2 | Kastenkuchen, Muffin | Ruck-zuck-Kuchen (Öl, Mehl:Stärke 1:1), Saure-Sahne-Muffins |
| 2026-10-18 | kochbar.de | 3 | Kastenkuchen, Eierkuchen, Pancakes | Heidelbeerkuchen mit Schmand, Buttermilch-Pfannkuchen, Blaubeer-Pancakes |
| 2026-10-18 | eat.de | 2 | Kastenkuchen, Eierkuchen | Marmorkuchen mit Öl, Omas Pfannkuchen mit Mineralwasser (milchfrei) |
| 2026-10-18 | marions-kochbuch.de, backenmitleidenschaft.com, einfachmalene.de, the-inspiring-life.com | je 1 | Kastenkuchen | Rosinenkuchen mit Margarine, Marmorkuchen mit Buttermilch, Zitronenkuchen mit Joghurt, Rührkuchen mit Schokostückchen |
| 2026-10-18 | lecker.de, homemade-baked.de, backenmachtgluecklich.de, madamecuisine.de, heidelberg24.de, swissmilk.ch | je 1 | Muffin | Blaubeer-, Schoko-, Rosinen-, Grundrezept-Muffins |
| 2026-10-18 | thienemann.de, orf.at | je 1 (PDF) | Gugelhupf | Mengen aus den PDF-Texten, daher eindeutig |
| 2026-10-18 | infranken.de, austria.info, kochrezepte.at, kuchenwunder.de, genusskind.at, gusto.at | je 1 | Gugelhupf | Stracciatella, Marmor, Heidelbeer-Joghurt, Napfkuchen (Blog, Mengen unsicher), Buttermilch-Varianten |
| 2026-10-18 | desired.de, ddr-rezepte.net, foodtempel.de, alltagskitchen.com, familienkost.de, berliner-kurier.de | je 1 | Eierkuchen | Crêpes, DDR-Eierkuchen, Mineralwasser-Varianten, Öl im Teig |
| 2026-10-18 | zwilling.com | 2 | Eierkuchen, Pancakes | Crêpes, Buttermilk-Pancakes |
| 2026-10-18 | kuechenfibel.de, blick.ch, utopia.de, kevindundon.com, notquitenigella.com, emmikochteinfach.de, pursuedtirol.com | je 1 | Pancakes | Buttermilch-, Joghurt-, Blaubeer-Pancakes |

Nicht abrufbar oder für den Crawler gesperrt (T04): rewe.de, edeka.de (403), einfachbacken.de, brigitte.de, swr.de, daskochrezept.de, backen.de (leitet auf oetker.de um), kuechlein.at (Verbindung verweigert), mehrere englischsprachige Backseiten (403/404/Timeout). Verworfen aus inhaltlichen Gründen u. a.: Hefeteig-Gugelhupf, Eischnee-Teige, Dinkelmehl, selbsttreibendes Mehl, Mengen nur in „Becher“, nicht abbildbare Zutaten (Apfelmus, Erdnussbutter, Beerenpüree), Mehl:Flüssigkeit außerhalb der Variante.

## 2026-10-18 — Aufbau Hefeteig-Korpus (T45, Varianten Weißbrot und Hefezopf)

4 Subagenten parallel (WebSearch/WebFetch): Weißbrot direkt, Weißbrot Vorteig/No-Knead, Zopf direkt, Zopf Vorteig/No-Knead. Je Rezept strukturierte Zeiten (Kneten, Vorteig, Gehen, Stückgare). Vorgaben: nur Weizenmehl, kein Sauerteig/Vollkorn/Roggen/Dinkel, keine nicht abbildbaren Zutaten (Honig, Sirup, Malz, Vanilleextrakt …), je Domain ein Rezept. Mengen stammen aus WebFetch-Zusammenfassungen; Päckchengröße teils mit 7 g, „1 Würfel“ mit 42 g angenommen (steht in den `notizen`). Eingepflegt: Weißbrot 15, Hefezopf 17 (ein zweites aldi-sued-Rezept und ein Duplikat derselben heimwerker-Seite wurden nicht übernommen).

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | lecker.de | 3 | Weißbrot (1), Zopf (2) | Toastbrot, Hefezopf wie von Oma, Hoppelhasen-Zopf über Nacht (einziges süßes No-Knead, daher zweite Zopf-Quelle der Domain) |
| 2026-10-18 | utopia.de, eat.de | je 2 | Weißbrot, Zopf | Weißbrot-Klassiker, Hefezopf mit Rosinen; Toastbrot, Osterzopf mit Trockenhefe |
| 2026-10-18 | kochbar.de, gutekueche.de, oekotest.de, brot-backen.de, martin-thoma.com, kuechenlatein.com, einfachekochrezepte.com | je 1 | Weißbrot direkt | Toast-, Kasten-, Milchbrot; gutekueche: 1 EL Salz (3,6 %) und 1 Würfel Hefe, trotzdem aufgenommen |
| 2026-10-18 | hellwegradio.de, backhausgeflüster.de, herzelieb.de | je 1 | Weißbrot Vorteig | Poolish/Vorteig über Nacht, hellwegradio aus einem PDF |
| 2026-10-18 | brotaberlecker.de, culineli.de | je 1 | Weißbrot No-Knead | 12–15 Std. Gare, 0,25–1 TL Trockenhefe |
| 2026-10-18 | aldi-sued.de, fuersie.de, madamecuisine.de, meinbezirk.at, stuttgarter-zeitung.de, infranken.de, kuechengoetter.de, wunder-kueche.de, heimwerker.de | je 1 | Zopf direkt | Zopf, Kranz, Striezel, Osterzopf; Mengen für Hefe 20–50 g, Fett Butter/Margarine/Öl |
| 2026-10-18 | dioezese-linz.at, kidsrezepte.de, diamant-zucker.de, weightwatchers.com | je 1 | Zopf Vorteig | Dampfl bzw. Hefevorteig 15–30 Min.; teils mit dem gesamten Mehl im Vorteig |

Nicht abrufbar oder gesperrt: rewe.de, brooot.de, ines-kocht.de (403/410), derstandard.at (Consent-Wand), nutella.com (404), mehrere PDFs. Verworfen aus inhaltlichen Gründen u. a.: Sauerteig/Anstellgut/Lievito Madre, Vollkorn-, Roggen-, Dinkel- und Emmermehl, Honig/Rübensirup/Malz/Vanilleextrakt im Teig, Rahm/Schmand/Eigelb-Grundrezepte, freie Brote auf Blech oder im Topf statt Kastenform, Vorteig unter 30 Minuten bei „Vorteig“-Methode, widersprüchliche Mengen.
