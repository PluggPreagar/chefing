// DR-090: Ausrichtung des Diagramms (Auto | Strom | Kompakt) mit Symbolen im Diagramm-Kopf. Die Entscheidung (src/model/ausrichtung.js) wird ohne
// Browser geprüft, dazu Symbole, Anbindung und die flachen Knöpfe.
import fs from 'fs';
const P = new URL('../', import.meta.url);
const { AUSRICHTUNGEN, wirksameAnsicht, ausrichtungAusSpeicher, ansichtFuerAusrichtung, ANSICHTEN, ansichtWert, ausAnsichtWert } = await import(new URL('src/model/ausrichtung.js', P).href);
const { ICONS } = await import(new URL('src/ui/icons.js', P).href);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// --- Entscheidung ---------------------------------------------------------------------------------------------------------------------
ok(AUSRICHTUNGEN.join() === 'auto,strom,kompakt', 'drei Stufen: Auto, Strom, Kompakt');
ok(wirksameAnsicht({ ausrichtung: 'auto', hoch: false }) === 'strom' && wirksameAnsicht({ ausrichtung: 'auto', hoch: true }) === 'kompakt', 'Auto folgt dem Bildschirm: quer = Strom, hochkant = Kompakt (auch ohne Vollbild)');
ok(wirksameAnsicht({ ausrichtung: 'auto', vollbildAnsicht: 'kompakt', hoch: false }) === 'kompakt' && wirksameAnsicht({ ausrichtung: 'auto', vollbildAnsicht: 'strom', hoch: true }) === 'strom', 'Auto im Vollbild: die gemeldete Ausrichtung (samt Drehen) geht vor dem Bildschirm');
ok(wirksameAnsicht({ ausrichtung: 'strom', hoch: true }) === 'strom' && wirksameAnsicht({ ausrichtung: 'kompakt', hoch: false }) === 'kompakt', 'feste Wahl gilt unabhängig vom Bildschirm (manuelle Übersteuerung)');
ok(wirksameAnsicht({ ausrichtung: 'strom', vollbildAnsicht: 'kompakt', hoch: false }) === 'strom' && wirksameAnsicht({ ausrichtung: 'kompakt', vollbildAnsicht: 'strom', hoch: false }) === 'kompakt', 'feste Wahl gilt auch im Vollbild');
ok(wirksameAnsicht({ ausrichtung: 'quatsch', hoch: false }) === 'strom' && wirksameAnsicht({ ausrichtung: undefined, hoch: true }) === 'kompakt', 'unbekannte Wahl wird wie Auto behandelt');
ok(ansichtFuerAusrichtung(true) === 'strom' && ansichtFuerAusrichtung(false) === 'kompakt', 'quer = Strom, hochkant = Kompakt');

// --- Übernahme der früheren Ansicht -----------------------------------------------------------------------------------------------------
ok(ausrichtungAusSpeicher({}) === 'auto' && ausrichtungAusSpeicher() === 'auto', 'nichts gespeichert: Auto');
ok(ausrichtungAusSpeicher({ alt: 'kompakt' }) === 'kompakt' && ausrichtungAusSpeicher({ alt: 'strom' }) === 'strom', 'die frühere Wahl Strom oder Kompakt (chefing.ablauf) bleibt als feste Wahl erhalten');
ok(ausrichtungAusSpeicher({ neu: 'auto', alt: 'kompakt' }) === 'auto' && ausrichtungAusSpeicher({ neu: 'strom', alt: 'kompakt' }) === 'strom', 'die neue Wahl (chefing.ausrichtung) geht der früheren vor');
ok(ausrichtungAusSpeicher({ neu: 'quatsch', alt: 'egal' }) === 'auto' && ausrichtungAusSpeicher({ neu: null, alt: null }) === 'auto', 'ungültige Werte fallen auf Auto zurück');

// --- Symbole und Anbindung ----------------------------------------------------------------------------------------------------------
const NEU = ['ausrichtung_auto', 'beschriftung_text', 'beschriftung_symbole', 'ansicht_strom', 'ansicht_kompakt'];
ok(NEU.every((k) => Array.isArray(ICONS[k]) && ICONS[k].length && ICONS[k].every((x) => x.tag && x.attrs)), 'alle Symbole des Diagramm-Kopfs stehen im Symbolsatz (icons.js)');
const main = fs.readFileSync(new URL('src/main.js', P), 'utf8');
const css = fs.readFileSync(new URL('style.css', P), 'utf8');
const html = fs.readFileSync(new URL('index.html', P), 'utf8');
ok(/ausrichtungAusSpeicher\(\{ neu: localStorage\.getItem\('chefing\.ausrichtung'\), alt: localStorage\.getItem\('chefing\.ablauf'\) \}\)/.test(main) && /localStorage\.setItem\('chefing\.ausrichtung', ausrichtung\)/.test(main), 'main.js: Wahl aus dem Speicher mit Übernahme der früheren Ansicht, Wahl wird gespeichert');
ok(/id: 'ablauf-darstellung'/.test(main) && /wert: 'auto', icon: 'ausrichtung_auto'/.test(main) && /wert: 'zeitleiste', icon: 'ansicht_strom'/.test(main) && /wert: 'liste', icon: 'beschriftung_text'/.test(main) && /wert: 'symbole', icon: 'beschriftung_symbole'/.test(main) && /attr: 'ansicht'/.test(main), 'eine Gruppe mit vier Ansichten im Diagramm-Kopf: Auto, Zeitleiste, Liste, Symbole (DR-109)');
ok(/addEventListener\('resize', \(\) => \{ if \(ausrichtung === 'auto' && wirksameAnsicht\(\) !== gezeigteAnsicht\) render\(\); \}\)/.test(main), 'bei Auto zeichnet eine Größenänderung nur neu, wenn sich die Ansicht ändert');
ok(!/id="ablauf-ansicht"/.test(html) && /\$\('ablauf-ansicht'\)\?\.remove\(\)/.test(main), 'die alte Ansicht aus der Werkzeugleiste ist weg (HTML), eine zwischengespeicherte wird entfernt');
ok(/b\.setAttribute\('aria-label', k\.name\)/.test(main) && /className: 'leiste-knopf flach ghost'/.test(main), 'alle Knöpfe der Gruppen sind flach, mit aria-label und Tooltip');
ok(/\.ablauf-kopf \.flach \{ border-color: transparent; background: transparent; \}/.test(css) && /\.ablauf-kopf \.flach:hover \{ border-color: var\(--muted\)/.test(css) && /\.ablauf-kopf \.flach\.is-active, \.ablauf-kopf \.flach\[aria-pressed="true"\] \{ border-color: transparent; background: var\(--best-bg\)/.test(css), 'flach: Rahmen nur beim Darüberfahren, ausgewählt = getönter Grund ohne Rahmen');
ok(/class="ablauf-voll-knopf nur-symbol flach ghost"/.test(html) && /nur-symbol flach ghost/.test(fs.readFileSync(new URL('src/ui/vollbild.js', P), 'utf8')), 'die Vollbild-Knöpfe sind genauso flach wie die Gruppen (gleiche Form, Größe und Lage)');
ok(/\.kompakt-svg \{ display: block; margin: 0 auto;/.test(css) && /#kompakt\.kompakt \{ text-align: center; \}/.test(css) && /Math\.min\(640,/.test(fs.readFileSync(new URL('src/ui/kompakt.js', P), 'utf8')), 'Kompakt-Diagramm ist zentriert und höchstens 640 Pixel breit');
// --- Eine Wahl mit vier Ansichten (DR-109) ---------------------------------------------------------------------------------------------
ok(ANSICHTEN.join() === 'auto,zeitleiste,liste,symbole', 'vier Ansichten: Auto, Zeitleiste, Liste, Symbole');
ok(ANSICHTEN.every((w) => ansichtWert(ausAnsichtWert(w)) === w), 'Hin und zurück: jede Ansicht bleibt dieselbe (Abbildung auf Ausrichtung und Namen)');
ok(ausAnsichtWert('zeitleiste').ausrichtung === 'strom' && ausAnsichtWert('liste').ausrichtung === 'kompakt' && ausAnsichtWert('liste').namen === true && ausAnsichtWert('symbole').ausrichtung === 'kompakt' && ausAnsichtWert('symbole').namen === false && ausAnsichtWert('auto').ausrichtung === 'auto' && ausAnsichtWert('auto').namen === true, 'Zeitleiste = Strom, Liste = Kompakt mit Namen, Symbole = Kompakt ohne Namen, Auto zeigt hochkant die Liste');
ok(ansichtWert({ ausrichtung: 'kompakt', namen: false }) === 'symbole' && ansichtWert({ ausrichtung: 'kompakt', namen: true }) === 'liste' && ansichtWert({ ausrichtung: 'strom', namen: false }) === 'zeitleiste' && ansichtWert({ ausrichtung: 'auto', namen: false }) === 'auto', 'gespeicherte Wahl (Ausrichtung plus Namen) ergibt die Ansicht; die Namen-Wahl bei Strom und Auto ist ohne Wirkung');
ok(ausAnsichtWert('quatsch').ausrichtung === 'auto' && ausAnsichtWert(undefined).ausrichtung === 'auto', 'unbekannte Ansicht wird wie Auto behandelt');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
