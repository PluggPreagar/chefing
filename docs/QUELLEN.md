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

## 2026-10-18 — Nachrecherche Hefeteig-Korpus (T47)

3 Subagenten parallel (WebSearch/WebFetch), gezielt für Lücken: Weißbrot ohne Kneten und mit Vorteig, Zopf ohne Kneten/kalt und mit Vorteig, Zopf mit Schokolade oder Rosinen. Nur neue Domains, je Domain ein Rezept. Eingepflegt: 19 Rezepte. Zwei Rezepte, die in T45 zu Unrecht (Vanilleextrakt) verworfen worden waren, sind jetzt dabei (rita-ehser.de, madamedessert.de).

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | veenaazmanov.com, biggerbolderbaking.com, mamtaskitchen.com, dovesfarm.co.uk, buttermilkbysam.com | je 1 | Weißbrot ohne Kneten | englischsprachig, Mengen in Gramm bzw. Tassen-Angaben nur mit Gramm übernommen; 6–18 Std. Gare |
| 2026-10-18 | backshop.staedter.de, snapcalorie.com | je 1 | Weißbrot Vorteig | Vorteig 30 Min. kühl über Nacht bzw. Poolish 12–16 Std. |
| 2026-10-18 | rita-ehser.de, bella-cooks-and-travels.com, zimtblume.de, heimbaecker.de, zimtkringel.org | je 1 | Zopf ohne Kneten und kalte Führung | nur rita-ehser wird nicht geknetet; die anderen vier sind „kalte Führung“ |
| 2026-10-18 | madamedessert.de, olis-backegge.ch | je 1 | Zopf Vorteig | Hefevorteig 30 Min. bzw. 12 Std. kühl |
| 2026-10-18 | sallys-blog.de, katrinsbackblog.com | je 1 | Zopf mit Schokolade | Schokoladenmenge in Gramm angegeben |
| 2026-10-18 | kochp.de, familienkost.de, digilotta.de | je 1 | Zopf mit Rosinen | digilotta mit 24 Std. kühler Gare |

Nicht abrufbar oder gesperrt: edeka.de, kuchenfee.de (403). Verworfen u. a.: Rezepte mit Sauerteig/Anstellgut/Lievito Madre, Dinkel-, Vollkorn- und Roggenmehl, Backmalz, Agavendicksaft, Eierlikör, Milchpulver, Schokolade nur als Füllung oder „1 Päckchen“ ohne Gramm, Topf- und freie Brote statt Kastenform, widersprüchliche oder unvollständige Mengen.

## 2026-10-18 — Testsatz kalte Weißbrote für das Gärmodell (T49)

2 Subagenten parallel (deutsch- und englischsprachig), gezielt für kalte Führung im Kastenbrot (kneten, 6–30 Std. Kühlschrank-Stockgare, dann formen). Rund 100 Seiten gesichtet, 2 Treffer: die Kombination „ungeformter Teig kalt + Kastenform + Gramm-Angaben“ ist selten; die meisten Seiten kühlen einen Vorteig oder erst den geformten Teigling. Nur neue Domains, Mengen aus WebFetch-Zusammenfassungen.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | brotwein.net | 1 | Weißbrot kalt | Toastbrot über Nacht, 8–10 Std. Kühlschrank (Mitte 9 Std.), 2 Laibe in Kastenform; 2 Std. warme Stockgare vorher nicht erfasst |
| 2026-10-18 | seasonsandsuppers.ca | 1 | Weißbrot kalt | Overnight Sandwich Bread, mind. 12 Std. kalt, Stückgare 3,5 Std. bei 22 °C; Zucker 78 g, Öl 85 g („Öl oder Butter“) |

Nicht abrufbar (403): breadsandsweets.com, madaboutfood.co, kitchensanctuary.com, iambaker.net, justonecookbook.com (laut Suchtreffern hat breadsandsweets möglicherweise ein passendes Rezept, mit 20–24 Std. Kühlschrank — per Browser prüfbar). Verworfen u. a.: No-Knead mit nur Faltungen, Vorteig im Kühlschrank, Teigling erst nach dem Formen gekühlt (kalte Stückgare), Honig, Sauerteig, Vollkorn, Dinkel, Tangzhong, nur Cup-Angaben, Gare nur bei Raumtemperatur, freie Brote statt Kastenform.

## 2026-10-18 — Vorteig-Angaben nacherfasst (T57)

1 Subagent las die 11 Vorteig-Rezepte des Hefe-Korpus und kochp-hefezopf-rosinen erneut (Zahlen: Mehl, Flüssigkeit, Hefe im Vorteig, Dauer, Temperatur). Alle Domains stehen schon im Korpus, es sind Wiederholungsbesuche; gespeichert sind nur Zahlen. Quer-Prüfung: Hefe im Vorteig plus Hauptteig ergibt bei allen 12 Rezepten genau die Gesamthefe im Korpus. Beim Abruf von kidsrezepte.de meldete das Abruf-Modell einen eingebetteten Hinweis auf der Seite; er wurde nicht befolgt, die Zahlen stammen aus dem Seitentext.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | hellwegradio.de | 1 | Vorteig-Zahlen | PDF, mit pdftotext gelesen; 100 g Mehl, 1 g Frischhefe, 12 Std. Raumtemperatur |
| 2026-10-18 | backhausgeflüster.de | 1 | Vorteig-Zahlen | 270 g Mehl, 0,3 g Hefe, 12–15 Std. bei 21–22 °C |
| 2026-10-18 | herzelieb.de | 1 | Vorteig-Zahlen | 90 Min. Raum, dann ca. 22 Std. Kühlschrank |
| 2026-10-18 | backshop.staedter.de | 1 | Vorteig-Zahlen | 30 Min. warm, dann über Nacht Kühlschrank (ohne Stundenzahl, nicht erfasst) |
| 2026-10-18 | snapcalorie.com | 1 | Vorteig-Zahlen | Prise = 0,1 g Instant laut Seite |
| 2026-10-18 | dioezese-linz.at, kidsrezepte.de, diamant-zucker.de, weightwatchers.com, madamedessert.de, kochp.de | je 1 | Hefe-Ansatz | Hefe in Mehlmulde/Milch, 15–30 Min.; Mehl im Ansatz meist nicht genannt |
| 2026-10-18 | olis-backegge.ch | 1 | Vorteig-Zahlen | Variante mit 60–90 Min. Raum plus 12–24 Std. Kühlschrank erfasst |

## 2026-10-18 — Negativ-Korpus: dokumentierte Misserfolge (T55)

1 Subagent suchte Fehlschläge mit Mengen (Hefeteig, Rührteig, Pfannkuchen): 14 Fälle, nur Fakten und eigene Kurzfassungen, Mengen aus WebFetch-Zusammenfassungen (Tassen und Löffel unverändert gespeichert, Umrechnung im Code). Starke Selbstauswahl: fast alle Hefeteig-Fälle aus einem Forum, englischsprachig, US-Maße. Weitere Seiten gelesen, aber ohne verwertbaren Fall: 177milkstreet.com, kingarthurbaking.com, oldcountrykitchenware.com, bine-backt.de, wassollichheutekochen.de, bakedbyclo.com, recipetineats.com, inspiredtaste.net.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | thefreshloaf.com | 7 | Negativ-Korpus Hefeteig | 7 Fälle (zu viel Hefe, Übergare, Brioche mit viel Fett, Braunzucker, Backautomat); Mengen meist in Tassen |
| 2026-10-18 | thefreshloaf.com | 1 | Negativ-Korpus Rührteig | Karotten-Cupcakes mit 2 TL Backpulver und 1 TL Natron, flach und ausgelaufen (Kommentar-Thread, Ursache offen) |
| 2026-10-18 | smittenkitchen.com | 1 | Negativ-Korpus Rührteig | 2 Fälle aus Kommentaren (Backpulver bitter, selbsttreibendes Mehl plus Backpulver), kaum Mengen |
| 2026-10-18 | bakeschool.com | 1 | Negativ-Korpus Rührteig | Teilmengen (2 TL Backpulver auf 2 Tassen Mehl), Ursache nur Vermutung |
| 2026-10-18 | nigella.com | 2 | Negativ-Korpus Rührteig | 1 Fall ohne Mengen (Kokoskuchen fällt zusammen); zweite Seite ohne Mengen |
| 2026-10-18 | breadexperience.com | 1 | Negativ-Korpus Hefeteig | Salz vergessen, keine Mengen |
| 2026-10-18 | pickuplimes.com | 1 | Negativ-Korpus Pfannkuchen | vegane Crêpes reißen, Basisrezept der Seite |

Nicht abrufbar: gutefrage.net (403), food52.com (403/429), cakecentral.com (521), hummingbirdhigh.com (403), forums.egullet.org (Anubis-Sperre), reddit.com und api.stackexchange.com (vom Tool gesperrt); eine Suche auf cooking.stackexchange.com ergab keine Treffer. Gerade diese Foren hätten deutschsprachige und gramm-genaue Fälle enthalten können (per Browser prüfbar, T61).

## 2026-10-18 — Rezepte mit wenig Hefe und genannter Temperatur (T59)

1 Subagent suchte Brot- und Zopf-Rezepte mit höchstens etwa 1 % Frischhefe-Äquivalent, langer Gare und ausdrücklicher Gär-Temperatur (deutsch und englisch): 16 Rezepte erfasst (nur Fakten, eigene Kurzfassungen, Mengen und Zeiten aus WebFetch-Zusammenfassungen, PDFs mit pdftotext gelesen), davon 12 im Korpus; vier Laibe/Stangen (Plötzblog) passen nicht zur Kastenform-Variante und stehen nicht im Korpus. Beim Abruf von cakescookiesandmore.ch endete die Seite mit einem Block, der ein bestimmtes Ausgabeformat verlangte; er wurde als Seiteninhalt behandelt und nicht befolgt.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | ploetzblog.de | 4 | wenig Hefe, Poolish | PDFs von Lutz Geißler; Weißbrotwurzel, Ciabatta, Baguettes, Weizenlaib — nicht im Korpus (Form) |
| 2026-10-18 | linalsbackhimmel.de, regionalundhandgemacht.de | je 1 | Hefezopf über Nacht kalt | 0,8 % und 0,6 % Hefe, 11 und 13 Std. Kühlschrank |
| 2026-10-18 | volkermampft.de, justbread.de, hermannsblog.de, demmler.de, cookieundco.de | je 1 | Poolish-Toastbrot | Vorteig 7–14 Std., Hefe im Vorteig getrennt erfasst; volkermampft nennt die Hefeart nicht (Frischhefe gelesen) |
| 2026-10-18 | cakescookiesandmore.ch, bakeandnourish.com | je 1 | Zopf mit Vorteig / kalt | Bewertungen im Quelle-Feld (5/4, 5/1) |
| 2026-10-18 | brotwein.net | 1 | Brioche-Zopf kalt | Domain schon im Korpus; „mindestens 6 Std.“ als 360 Min. |
| 2026-10-18 | diepta.de, herdgefluester.de | je 1 | Zopf, Ofen-Gare 40–50 °C | Vorheiz-Temperatur des Ofens, die Teigtemperatur liegt darunter (Anlass für den Temperatur-Deckel) |

Gelesen, aber nicht aufgenommen (Zeit oder Temperatur fehlten oder Hefe zu hoch): kuechengoetter.de, rezepte-silkeswelt.de, essmoment.com, foodwithlove.de, heartscontentfarmhouse.com, bluejeanchef.com, hungrylankan.com, servedfromscratch.com, manusmenu.com, thekiwicountrygirl.com, bakedbyanintrovert.com, practicallyhomemade.com, butfirstwebrunch.com, thepracticalkitchen.com, stellabakery.com, topagrar.com, oekotest.de, neff-home.com, lecker.de, globus.de, vier weitere Plötzblog-PDFs. Nicht abrufbar: budgetbytes.com, rewe.de, kuchenfee.de, schmeck-den-sueden.de (403), aeg.co.uk (Timeout), katrinrembold.de (Zertifikat abgelaufen).

## 2026-10-18 — Tipp-Korpus: Backratgeber, Ursache-Wirkung (T61)

Zweck: `src/data/tipps.json` (19 Tipps „wenn X passiert, war es Y“, nur Fakten und eigene Kurzfassung). Vollständig gelesen: lecker.de (2 Seiten), lidl.de, pastrychefonline.com, bakingbites.com; die übrigen nur als Such-Zusammenfassung (Seite nicht geöffnet) oder bei Zeitüberschreitung nicht abrufbar (kuechenfibel.de/faq/was-tun-wenn-die-butter-flockt).

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | lecker.de | 2 | Pannenhilfe, 5 Hefeteig-Fehler | Hefe-Temperatur 30 °C, Küche mindestens 22 °C, Rührkuchen klitschig bei zu viel Milch |
| 2026-10-18 | lidl.de | 1 | Rührkuchen fällt ein | keine Zahlen; Übermischen, kalte Eier, Form und Schiene |
| 2026-10-18 | pastrychefonline.com, bakingbites.com | je 1 | Troubleshooting, Tunnel in Muffins | Muffin 205–220 °C, Kekse 30 Min. kühlen, Übermischen |
| 2026-10-18 | kuechenfibel.de | 2 (Suche) | Butter flockt, Backpulver je 500 g Mehl | 16–17 g Backpulver, Natron etwa 5 g; Butter etwa 18 °C |
| 2026-10-18 | kingarthurbaking.com, chowhound.com, bakeclub.com.au, tastingtable.com | je 1 (Suche) | Rührteig gerinnt | kalte Eier lassen die Butter fest werden; Butter 65–68 °F |
| 2026-10-18 | wunderweib.de, heidelberg24.de, leinetal24.de, utopia.de | je 1 (Suche) | Hefeteig, Rührkuchen, Übermischen | Flüssigkeit über 40–45 °C tötet die Hefe; Salz nicht auf die Hefe |
| 2026-10-18 | antwort.net, ichkoche.at, baketotheroots.de | je 1 (Suche) | Mürbeteig, zu warme Butter | Teig vor dem Ausrollen etwa 1 Std. kühlen |
| 2026-10-18 | rewe.de, wikibooks.org, berliner-kurier.de | je 1 (Suche) | Pfannkuchen | Ruhezeit 15–20 Min.; Ursache beim Reißen nur Schlussfolgerung |

## 2026-10-18 — Negativ-Korpus erweitert: Misserfolge mit Mengen (T61)

Drei parallele Recherche-Durchläufe (Rührteig, Hefeteig deutsch, Pfannkuchen); 19 Fälle aufgenommen (`src/data/negativ.json`, nur Fakten und eigene Kurzfassung). Einzel-URLs je Fall im Feld `quelle.url`.

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-18 | baking-forums.com, kochkino.de, zuckerzimtundliebe.de, sweetsandlifestyle.com, wer-weiss-was.de | 1–2 | Rührteig-Fälle | Napfkuchen zu viel Flüssigkeit, Backpulver verdreifacht, Gugelhupf-Kontrollfälle, Muffins mit Eierlikör |
| 2026-10-18 | veggies.de, chocolatesandchai.com, ruhrschmecker.de, emmikochteinfach.de, food.com | je 1–2 | Pfannkuchen-Fälle | vegan mit Natron, Pancakes zu wässrig oder verdoppelt, Backpulver zu stark |
| 2026-10-18 | michis-backforum.de, foodundco.de, rezeptwelt.de, heimbaecker.de, grillsportverein.de, mariaesschmecktmir.com | je 1 | Hefeteig-Fälle (deutsch) | Nusszopf zu wenig Milch, Pizzateig Hydration und tote Hefe, Hefezopf und Brioche nach Rezept |
| 2026-10-18 | emmikochteinfach.de, urbia.de, lecker.de, kingarthurbaking.com, mumsnet.com, cookpad.com, recipetineats.com u. a. | je 1 | geprüft, ohne verwertbaren Fall | kein Misserfolg mit Mengen und Ursache oder Kommentare nicht sichtbar |

Nicht abrufbar (403, 429, 404, gesperrt oder Zertifikat): chefkoch.de, gutefrage.net, cakecentral.com (521), rund-ums-baby.de, wunderkessel.de, frag-mutti.de, beautyjunkies.de, discusscooking.com, mannbackt.de, food52.com, reddit.com, seriouseats.com, allrecipes.com, simplyrecipes.com, bbcgoodfood.com, sallysbakingaddiction.com, brotbackforum.iphpbb3.com.

## 2026-10-19 — Eischnee als Trieb (T72, Option 2B, DR-041)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-19 | silverspoon.co.uk, thetakeout.com, gypsyplate.com | je 1 | Faustregel Eischnee ↔ Backpulver | 2 Eiweiß ≈ 1 TL Backpulver (bzw. 1:1), ohne Beleg, Blog-Faustregel |
| 2026-10-19 | utopia.de, oekotest.de | je 1 | Backpulver-Ersatz | Eischnee ersetzt Backpulver nur in eihaltigen Teigen; umgekehrt 1 Ei ≈ 1 TL Backpulver; keine Messung |
| 2026-10-19 | exploratorium.edu, preparedfoods.com, khymos.org | je 1 | Schaumvolumen | Eiweiß 6–8-faches Volumen; Verlust beim Unterheben/Backen nirgends beziffert |
| 2026-10-19 | innograin.uva.es, libretexts.org | je 1 | Schaumfehler | Fett und Überrühren kosten Luft, qualitativ |
| 2026-10-19 | backtraum, backenmitchristina.at, lecker.de, smittenkitchen.com | je 1 | Rezeptmuster | Biskuit ohne Backpulver ≈ 3–4 Eier je 100 g Mehl; Sandkuchen/Pound Cake ohne chemischen Trieb |
| 2026-10-19 | rewe.de, cftri.res.in, laws-lois.justice.gc.ca | je 1 | Backpulver-Gasausbeute | 1 Pck. je 500 g Mehl ≈ 3 %; mindestens 12 % (US) bzw. 10 % (CA) CO₂ nach Gewicht |

## 2026-10-20 — Reihenfolge beim Schaumigschlagen, Emulsionen bis Mayonnaise (Recherche, kein Korpus)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | bakeinfo.co.nz, kingarthurbaking.com, sallysbakingaddiction.com | je 1 | Crememethode | Luftzellen im plastischen Fett, ~21 °C ideal (16–22 °C je Quelle), Wasser-in-Fett-Emulsion, Gerinnen durch kalte Eier/zu schnell/zu viel Flüssigkeit, Rettung mit 1–2 EL Mehl |
| 2026-10-20 | nicoletcollege.pressbooks.pub | 1 (Snippet) | Lecithin | Eigelb-Lecithin als Emulgator |
| 2026-10-20 | yumda.com, fsh-landeck.tsn.at, kuechengoetter.de, joyofbaking.com, foodnetwork.com, drivemehungry.com | je 1 | Ei+Zucker zuerst | Luft aus dem Eischaum, warm aufschlagen ~40–45 °C (Zucker löst sich), Butter zuletzt geschmolzen und nicht heiß, vorher mit etwas Masse temperieren, Zwei-Kessel-Methode bei fettreicher Sandmasse |
| 2026-10-20 | rewe.de, lecker.de | je 1 | Rühr-Öl | Öl nach dem Schaum langsam einlaufen lassen (ohne Begründung) |
| 2026-10-20 | oetker.ch, utopia.de | je 1 | Wasser im Eigelb-Schaum | heißes Wasser zum Eigelb, je schaumiger desto luftiger (ohne Begründung) |
| 2026-10-20 | en.wikibooks.org, en.wikipedia.org, app.ckbk.com, finekettleoffish.substack.com, marxfood.com | je 1 | Mayonnaise | Öl-in-Wasser, Lecithin + Proteine um die Tröpfchen, ≥ 70–80 % Öl, Teil des Wassers zurückhalten, erst tropfenweise dann im Strahl, bricht bei zu wenig Wasser/zu schnell, Rettung mit Wasser oder neuem Eigelb; Öl je Eigelb strittig (240 ml bis viele Liter, Wasser:Öl 1:3–1:19 begrenzt) |

seriouseats.com war für den Abruf gesperrt.

## 2026-10-20 — Korpus Kastenkuchen: Sandkuchen als Schaummasse (DR-046)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | lecker.de, rezeptschachtel.de, orf.at (PDF), unsereheimat.de | je 1 | Korpus Kastenkuchen, Methode schaummasse | Sandkuchen: Eier + Zucker (warm) aufgeschlagen, Mehl + Stärke, flüssige Butter zuletzt |
| 2026-10-20 | ichkoche.de | 1 | geprüft, nicht aufgenommen | Methode passt, aber keine Mengen |
| 2026-10-20 | backenmitchristina.at, rezepte.lidl.de, oetker.de, gutekueche.at, kuechengoetter.de, essen-und-trinken.de u. a. | je 1 | geprüft, nicht aufgenommen | nur Eiweiß, Butter vor dem Mehl oder Butter mit Zucker schaumig (Crememethode) |

chefkoch.de (blockiert) und edeka.de (403) nicht abrufbar.

## 2026-10-20 — Haltezeit der Triebquellen (T80, DR-049)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | kingarthurbaking.com | 1 | Haltezeit Backpulver | Test: Kuchenteig ruht bis zu einigen Stunden ohne Qualitätsverlust; 10 Std. gekühlt merklich flacher |
| 2026-10-20 | tastingtable.com | 2 | Haltezeit Natron/Backpulver | Natron-Teig sofort backen; doppelt wirkendes Backpulver verträgt Warten (2. Stoß im Ofen) |
| 2026-10-20 | foodrepublic.com | 1 | Haltezeit Teig | Kuchenteig im Kühlschrank aufbewahren, Grenzen |
| 2026-10-20 | bakinglikeachef.com | 1 | Haltezeit Teig | Teig mit Eischnee nicht stehen lassen |
| 2026-10-20 | williams-sonoma.com | 3 | Eischnee-Teige | Rezepte: nach dem Unterheben sofort backen (keine Minutenangabe) |
| 2026-10-20 | berliner-kurier.de | 1 | Mineralwasser im Pfannkuchenteig | mind. 20 Min. ruhen; Mineralwasser weglassen, wenn Backpulver drin ist |
| 2026-10-20 | utopia.de | 1 | Mineralwasser im Pfannkuchenteig | Mineralwasser erst nach dem Ruhen unterrühren |
| 2026-10-20 | lecker.de | 1 | Mineralwasser im Pfannkuchenteig | Mineralwasser zuletzt, kurz vor dem Ausbacken |
| 2026-10-20 | leinetal24.de | 1 | Mineralwasser im Pfannkuchenteig | sofort ausbacken möglich; Kohlensäure lockert |

Ergebnis: keine Messwerte in Minuten für Eischnee und Mineralwasser, nur „sofort“/„kurz vor dem Ausbacken“ → Richtwerte 10 Min. (Eischnee, Ei-Schaum, Mineralwasser), 15 Min. (Natron + Säure), 180 Min. (Backpulver) als Heuristik in `triebquellen.json`.

## 2026-10-20 — Rezepte mit getrennten Eiern: Backpulver mit/ohne Eischnee (T72 + T82, Recherche, kein Korpus)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | gutekueche.de | 2 | Rührkuchen getrennt | Marmorkuchen (6 g BP/100 g Mehl), Rührteig-Grundrezept (3,0) |
| 2026-10-20 | gutekueche.at | 1 | Gugelhupf | ausgeschlossen: ohne Fett (Biskuit) |
| 2026-10-20 | lieblingszwei.de, makeitsweet.de, einfach-lecker.com, fackelmann.de | je 1 | Marmorkuchen getrennt | 6,0 / 2,7 / 3,2 / 2,7 g BP je 100 g Mehl |
| 2026-10-20 | f-pieper.de | 1 | Rührteig ganz vs. getrennt, Teekuchen | gleiche Backpulvermenge (3,0) in beiden Varianten |
| 2026-10-20 | diamant-zucker.de, essen-und-trinken.de, backen-mit-spass.de | je 1 | Feiner Rührkuchen, Sandkuchen getrennt | 0,8 / 0,4 / 0 g BP je 100 g Mehl+Stärke, ohne Milch |
| 2026-10-20 | smittenkitchen.com, bakeomaniac.com | je 1 | Pound Cake / Butter Cake getrennt (EN) | 1,5 / 1,6 |
| 2026-10-20 | einfachkochen.de, sheepysbakery.de, kuechengoetter.de | 1 / 2 / 1 | Vergleich ganze Eier, Pancakes | 3,0 / 5,0 / 1,6; Pancakes getrennt 5,0 |
| 2026-10-20 | eat.de | 2 | Pfannkuchen ganz, Kaiserschmarrn getrennt | 3,1 / 2,3 |
| 2026-10-20 | topfgartenwelt.com, bakedbybabsi.at, thefoodiebunch.com, bakerbettie.com | je 1 | Pfannkuchen/Pancakes mit Eischnee | 2,5 (30 Min. Ruhe nach dem Unterheben) / 2,0 / 4,3 / 0 (Soufflé) |
| 2026-10-20 | crumbs-crust.de, glatzkoch.de | je 1 | Kaiserschmarrn mit Eischnee | 0 („klassisch ohne Backpulver“) / 10,0 |
| 2026-10-20 | ichkoche.at, tirol.at | 2 / 1 | Kaiserschmarrn, Marmorgugelhupf | ohne verwertbare Mengen, nicht genutzt |
| 2026-10-20 | allrecipes.com | 1 | US-Pancakes ganze Eier | Abruf fehlgeschlagen |

Ergebnis (22 Rezepte, Umrechnung 1 Pck. = 15 g, 1 TL = 4 g): Rührkuchen mit getrennten Eiern Median **2,7 g** Backpulver je 100 g Mehl (0–6,0, n = 13) gegen **3,0 g** mit ganzen Eiern — Trennen allein senkt das Backpulver kaum. Wenig oder kein Backpulver haben eierreiche Teige ohne Milch (Sandkuchen, Pound Cake, 1:1:1) sowie Soufflé-Pancakes und klassischer Kaiserschmarrn (ab etwa 2,5 Eiern je 100 g Mehl). Eischnee kommt in 18 von 21 Rezepten zuletzt. Muster: Backpulver sinkt mit **Eiern je Mehl** und fehlender Milch, nicht mit dem Trennen.

## 2026-10-20 — Zahlen für den Teig-Zustand: Gas, Luft, Verlust, Ofen (T72 + T82, Recherche, kein Korpus)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | lebensmittelverband.de | 2 (PDF) | Richtlinie Backtriebmittel | Backpulver je 500 g Mehl frisch 2,35–3,0 g wirksames CO₂, zum MHD mind. 2,0 g |
| 2026-10-20 | en.wikipedia.org | 2 | Baking powder, Sodium bicarbonate | MCP ~2/3 Gas in 2 Min., Rest über 60 °C; Neutralisationswerte; NaHCO₃ zerfällt ab ~50 °C, ohne Säure nur halbe Menge CO₂ |
| 2026-10-20 | pmc.ncbi.nlm.nih.gov | 1 | Studie Pound Cake, SAPP-Sorten | SAPP-Nummer ≈ % CO₂ beim Mischen (10/28/40); Luftzellen sind Keime, CO₂ wandert hinein; bestes Volumen bei 2,75 % Backpulver vom Mehl |
| 2026-10-20 | bakerpedia.com | 2 | SALP, Teig-Dichte | SALP ab 40–43 °C, 60–70 % im Ofen; Dichte Pound 0,80, Rührkuchen 0,70, Biskuit 0,50, Angel Food 0,30 |
| 2026-10-20 | asbe.org | 1 | Biskuit warm/kalt | warm (43 °C) Dichte 0,4–0,6, kalt 0,6–0,9; Krume am Ende 95 °C |
| 2026-10-20 | ahperformance.com | 1 (PDF) | Reaktionsrate Säureträger | MCP 60–70 % beim Mischen |
| 2026-10-20 | kingarthurbaking.com, craftybaking.com, joyofbaking.com | je 1 | Vollei-Schaum | Eier + Zucker bis zur Bandprobe ≈ 3-faches Volumen; warm 43–49 °C |
| 2026-10-20 | mro.massey.ac.nz, mspace.lib.umanitoba.ca | je 1 | Eiweiß-Schaum (Thesen) | keine verwertbaren Zahlen (bzw. Scan unlesbar) |
| 2026-10-20 | bakingbusiness.com, bakersjournal.com, ingredion.com, localfood.ces.ncsu.edu | je 1–2 | Reaktionsraten, Biskuit-Dichte | Abruf gesperrt/fehlgeschlagen; Werte nur aus Suchtreffer-Auszügen (SAPP 21–43 % beim Mischen; Dichte steigt beim Unterheben 0,4–0,5 → 0,5–0,65) |

Nur aus Suchtreffer-Auszügen, nicht geöffnet (vor Nutzung prüfen): lirias.kuleuven.be, image-ppubs.uspto.gov (3 Patente: Creme-Dichte 0,94 → 0,77 in 15 Min., Eischnee bis Dichte 0,1, Stückgare ≈ 200 ml CO₂ je 100 g Teig), thefreshloaf.com, slaw.ca (Eiweiß stockt 61–65 / 80–84 °C, Eigelb 65–70 °C), selters.de und test.de (Mineralwasser 7–8 g/l CO₂ klassisch, 4–5,5 medium), annex.exploratorium.edu, americastestkitchen.com, kvcv.be, britannica.com, app.ckbk.com, thecakeblog.com, thetakeout.com, koreascience.kr, scribd.com.

Ergebnis: belegt sind Gasmengen (Backpulver, Natron, Mineralwasser), Luft je Methode als Teig-Dichte und die Stock-Temperaturen. **Nicht gefunden:** Zerfallszeiten von Eischnee und Ei-Schaum, CO₂-Verlust im ruhenden Teig, Verlust beim Unterheben in % (nur indirekt 20–30 % über die Dichte), Anteil von Dampf am Kuchenvolumen, ein gemessener Vergleich Eischnee ↔ Backpulver. Die Temperatur „2. Stoß ab etwa 60 °C“ gilt für MCP; SAPP (übliches deutsches Backpulver) wirkt „überwiegend bei Backtemperatur“, SALP ab 40–43 °C.

## 2026-10-20 — Korpus: Rezepte mit getrennten Eiern (T83, DR-051)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | backen-mit-spass.de | 1 | Korpus Kastenkuchen | Sandkuchen, getrennte Eier, ohne Backpulver |
| 2026-10-20 | smittenkitchen.com | 1 | Korpus Kastenkuchen | Lighter airy pound cake (Grammangaben der Seite) |
| 2026-10-20 | gutekueche.de | 2 | Korpus Gugelhupf | Saftiger Marmorkuchen (Kranzform); Rührteig-Grundrezept ohne Kastenform → nicht aufgenommen |
| 2026-10-20 | lieblingszwei.de, fackelmann.de | je 1 | Korpus Gugelhupf | Marmorkuchen getrennt |
| 2026-10-20 | sheepysbakery.de, bakedbybabsi.at, thefoodiebunch.com | 1 / 1 / 2 | Korpus Pancakes | fluffige Pancakes mit Eischnee |
| 2026-10-20 | topfgartenwelt.com | 1 | Korpus Eierkuchen | Pfannkuchen mit Eischnee, 30 Min. Ruhe nach dem Unterheben |
| 2026-10-20 | essen-und-trinken.de, diamant-zucker.de, einfach-lecker.com, bakerbettie.com | 1 / 4 / 2 / 1 | Korpus Kastenkuchen/Pancakes | erst zurückgehalten (Grenzen), mit Ausnahmen aus DR-052 aufgenommen (T85) |

Alle neuen Einträge mit `auswahl: "gezielt"` (zählen nicht für Häufigkeiten).

## 2026-10-20 — Korpus Mayonnaise (T78, DR-054)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | lecker.de | 2 | Korpus Mayonnaise | klassisch von Hand; zweite Seite = gleiches Rezept, nicht doppelt aufgenommen |
| 2026-10-20 | essen-und-trinken.de | 3 | Korpus Mayonnaise | Handrührer, Schneebesen, Blitz-Mayonnaise mit Pürierstab |
| 2026-10-20 | gutekueche.at, gutekueche.de | 2 / 1 | Korpus Mayonnaise | von Hand und Pürierstab, Olivenöl |
| 2026-10-20 | utopia.de, oekotest.de, kochbar.de | 1 / 1 / 2 | Korpus Mayonnaise | Pürierstab, teils ganzes Ei, teils Öl während des Pürierens |
| 2026-10-20 | de.wikibooks.org, fuersie.de, jamieoliver.com | je 1 | Korpus Mayonnaise | von Hand |
| 2026-10-20 | inspiredtaste.net, downshiftology.com | je 1 | Korpus Mayonnaise | Pürierstab mit ganzem Ei, alles auf einmal |
| 2026-10-20 | kuechengoetter.de | 1 | Mayonnaise | Video ohne Mengen, nicht aufgenommen |
| 2026-10-20 | rewe.de, thekitchn.com, deliciousmagazine.co.uk, rezepte.lidl.de, blick.ch, srf.ch, simplyscience.ch, foodnetwork.co.uk | je 1 | Mayonnaise | gesperrt (403), nicht gefunden (404), unlesbar oder falsche Weiterleitung |

Ergebnis: 16 Rezepte (8 von Hand, 8 Pürierstab). Wasser je Öl 10–62 % (Median 27 %); Pürierstab-Rezepte nehmen oft ganzes Ei und weniger Öl.

## 2026-10-20 — Handgriffe Pürierstab und Unterheben (DR-055, Recherche, kein Korpus)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | zwilling.com | 1 | Pürierstab-Mayonnaise | Stab auf Eigelb und Senf, dann Öl; am Boden mixen, bis es cremig wird, dann langsam hochziehen |
| 2026-10-20 | utopia.de, lecker.de | je 1 | Pürierstab-Mayonnaise | erst hochziehen, wenn unten eine homogene Masse ist; sehr langsam von unten nach oben, hoher schmaler Becher |
| 2026-10-20 | manuall.de | 2 | Bosch-Bedienungsanleitungen | Mixer langsam anheben und senken |
| 2026-10-20 | maritimegardening.substack.com, thehealthyfoodie.com, amara.org (Food Lab, Transkript) | je 1 (Suchtreffer) | Öl absetzen lassen | 1–2 Min. warten, bis das Öl oben schwimmt; am Boden halten, bis eine weiße Wolke entsteht, dann kippen/hochziehen |
| 2026-10-20 | rewe.de, lecker.de | 2 / 2 (Suchtreffer) | Eischnee unterheben | ein Drittel lockert, Rest mit dem Spatel von unten nach oben; nur kurz |

Ergebnis: „am Boden halten bis cremig, dann hochziehen“ mehrfach belegt; „Öl absetzen lassen“ nur in englischen Quellen.

## 2026-10-20 — Olivenöl bitter mit Pürierstab (T88, DR-058, Recherche, kein Korpus)

| Datum | Domain | Seiten | Zweck | Notiz |
|-------|--------|--------|-------|-------|
| 2026-10-20 | americastestkitchen.com, cooksillustrated.com | 1 (Suchtreffer) | Test Olivenöl bitter | Küchenmaschine deutlich bitter, von Hand geschlagen nicht; feinere Tröpfchen → mehr Bitterkeit |
| 2026-10-20 | nigella.com | 1 (Suchtreffer) | Pürierstab vs. Mixer | Stab kleiner und milder, Bitterkeit seltener; Ursache nicht ganz geklärt |
| 2026-10-20 | tastingtable.com, chowhound.com | 1 / 2 (Suchtreffer) | Erklärung, Abhilfe | Polyphenole von Fettsäuren umhüllt, bei der Emulsion frei; neutrales oder raffiniertes Öl |
| 2026-10-20 | researchsquare.com | 1 (nur Titel) | Gegenhinweis | Preprint: Eiweiß dämpft Bitterkeit und Schärfe von nativem Olivenöl |

Ergebnis: Hinweis „kann bitter werden“ beim Pürierstab, keine Warnung; keine deutsche Quelle gefunden.
