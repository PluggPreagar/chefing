// DR-087 (Option B) und DR-088: Kopfzeile mit Werkzeugleiste rechts oben, Fluss Archetyp › Variante darunter, Melden als geteilter Knopf mit
// gemerkter Aktion. Die Steuerung (src/ui/meldenMenue.js) wird ohne Browser geprüft, dazu Symbole und Anbindung.
import fs from 'fs';
const P = new URL('../', import.meta.url);
const { erzeugeMeldenMenue, MELDEN_AKTIONEN, MELDEN_TEXT } = await import(new URL('src/ui/meldenMenue.js', P).href);
const { ICONS } = await import(new URL('src/ui/icons.js', P).href);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const bau = (aktuell = 'fehler') => { const ausgefuehrt = []; const gemerkt = []; const meldungen = []; const m = erzeugeMeldenMenue({ aktuell, fuehreAus: (k) => ausgefuehrt.push(k), onMerke: (k) => gemerkt.push(k), melden: (s) => meldungen.push({ ...s }) }); return { m, ausgefuehrt, gemerkt, meldungen }; };

// --- Steuerung: gemerkte Aktion ----------------------------------------------------------------------------------------------------
ok(MELDEN_AKTIONEN.join() === 'fehler,bewerten' && MELDEN_AKTIONEN.every((k) => MELDEN_TEXT[k].kurz && MELDEN_TEXT[k].lang && MELDEN_TEXT[k].titel && ICONS[MELDEN_TEXT[k].icon]), 'zwei Aktionen mit Kurztext, Langtext, Tooltip und Symbol im Symbolsatz');
ok(MELDEN_TEXT.fehler.kurz === 'Melden' && MELDEN_TEXT.bewerten.kurz === 'Bewerten' && /Fehler, Idee oder Frage/.test(MELDEN_TEXT.fehler.lang) && /Rezept bewerten/.test(MELDEN_TEXT.bewerten.lang), 'Beschriftungen: „Melden“ (Fehler, Idee oder Frage) und „Bewerten“ (Rezept)');
let b = bau();
b.m.haupt(); b.m.haupt(); b.m.haupt();
ok(b.ausgefuehrt.join() === 'fehler,fehler,fehler' && b.gemerkt.length === 0 && b.m.stand().gewaehlt === 'fehler', 'Hauptteil führt dieselbe Aktion beliebig oft aus, ohne etwas zu ändern (wiederholbar)');
b.m.oeffnen(); b.m.waehle('bewerten');
ok(b.ausgefuehrt.at(-1) === 'bewerten' && b.gemerkt.join() === 'bewerten' && b.m.stand().gewaehlt === 'bewerten' && !b.m.stand().offen, 'Wahl in der Liste: Aktion läuft sofort, wird gemerkt, Liste schließt');
b.m.haupt(); b.m.haupt();
ok(b.ausgefuehrt.slice(-2).join() === 'bewerten,bewerten', 'danach wiederholt der Hauptteil die neue Aktion');
b.m.oeffnen(); b.m.waehle('bewerten');
ok(b.ausgefuehrt.at(-1) === 'bewerten' && b.ausgefuehrt.length === 7, 'dieselbe Aktion noch einmal in der Liste gewählt: läuft erneut');
b = bau('bewerten');
ok(b.m.stand().gewaehlt === 'bewerten' && b.ausgefuehrt.length === 0, 'gemerkte Aktion beim Start gesetzt, ohne sie auszuführen');
b.m.setze('fehler');
ok(b.m.stand().gewaehlt === 'fehler' && b.ausgefuehrt.length === 0 && b.gemerkt.length === 0, 'von außen gesetzt (aus dem Speicher): weder ausgeführt noch erneut gemerkt');
ok(bau('quatsch').m.stand().gewaehlt === 'fehler', 'unbekannter gemerkter Wert fällt auf „Melden“ zurück');
b = bau();
b.m.taste('ArrowDown'); b.m.taste('ArrowDown'); b.m.taste('Enter');
ok(b.m.stand().gewaehlt === 'bewerten' && b.ausgefuehrt.join() === 'bewerten' && b.gemerkt.join() === 'bewerten', 'Tastatur: Pfeil, Pfeil, Enter wählt „Bewerten“, führt aus und merkt es');
b.m.oeffnen(); ok(b.m.taste('Escape') === true && !b.m.stand().offen && b.ausgefuehrt.length === 1, 'Esc schließt die Liste, ohne etwas auszuführen');

// --- Symbole -----------------------------------------------------------------------------------------------------------------------
const NEU = ['ansicht_strom', 'ansicht_kompakt', 'statistik', 'kandidaten', 'melden_fehler', 'melden_bewerten', 'loeffel'];
ok(NEU.every((k) => Array.isArray(ICONS[k]) && ICONS[k].length && ICONS[k].every((x) => x.tag && x.attrs)), 'alle Symbole der Werkzeugleiste stehen im Symbolsatz (icons.js)');

// --- Anbindung ---------------------------------------------------------------------------------------------------------------------
const html = fs.readFileSync(new URL('index.html', P), 'utf8');
const main = fs.readFileSync(new URL('src/main.js', P), 'utf8');
const css = fs.readFileSync(new URL('style.css', P), 'utf8');
const fm = fs.readFileSync(new URL('src/ui/fehlerMelden.js', P), 'utf8');
const kopf = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'));
ok(/class="top-leiste" role="toolbar"/.test(kopf) && kopf.indexOf('id="stufe-menue"') < kopf.indexOf('id="ablauf-ansicht"') && kopf.indexOf('id="ablauf-ansicht"') < kopf.indexOf('id="toggle-stats"') && kopf.indexOf('id="toggle-stats"') < kopf.indexOf('id="toggle-kandidaten"') && kopf.indexOf('id="toggle-kandidaten"') < kopf.indexOf('id="melden-menue"'), 'Kopfzeile: Werkzeugleiste in der Reihenfolge Erfahrung, Ansicht, Statistik, Kandidaten, Melden');
ok(/<nav class="presets fluss" aria-label="Rezeptart">\s*<select id="archetyp-wahl"[^>]*><\/select>\s*<span class="fluss-pfeil"[^>]*>›<\/span>\s*<span id="preset-gruppe"/.test(kopf), 'Fluss in einer Zeile unter dem Titel: Archetyp › Variante');
ok((html.match(/id="ablauf-ansicht"/g) || []).length === 1 && !/id="ergebnis-melden"/.test(html) && !/id="fehler-melden"/.test(html), 'die Ansicht gibt es nur einmal (in der Kopfzeile), die zwei alten Melden-Knöpfe sind weg');
const knoepfe = [...kopf.matchAll(/<button[^>]*class="leiste-knopf[^"]*"[^>]*>([^<]*)<\/button>/g)];
ok(knoepfe.length === 4 && knoepfe.every((m) => m[1] === '' && /aria-label="[^"]+"/.test(m[0]) && /title="[^"]{6,}"/.test(m[0])), 'Symbol-Knöpfe der Leiste haben keinen Text, aber aria-label und Tooltip (DR-084)');
ok(/initMeldenMenue\(\$\('melden-menue'\)/.test(main) && /localStorage\.getItem\('chefing\.melden'\)/.test(main) && /localStorage\.setItem\('chefing\.melden', k\)/.test(main) && /k === 'bewerten' \? springeZurBewertung\(\) : oeffneMeldung\(\)/.test(main), 'main.js: geteilter Knopf, Wahl in localStorage (chefing.melden), Bewerten springt zur Box, Melden öffnet das Panel');
ok(/\$\('fehler-melden'\)\?\.remove\(\)/.test(main) && /\$\('ergebnis-melden'\)\?\.remove\(\)/.test(main) && /\$\('toggle-stats'\)\.innerHTML = iconHtml\('statistik'/.test(main) && /strom: \['ansicht_strom', 'Strom'/.test(main), 'main.js: alte Knöpfe aus einer zwischengespeicherten index.html werden entfernt, Symbole für Statistik und Strom gesetzt');
ok(/export function initFehlerMelden\(holeKontext\)/.test(fm) && /export const oeffneMeldung/.test(fm) && !/knopf\.addEventListener/.test(fm), 'fehlerMelden.js: kein eigener Knopf mehr, oeffneMeldung() für den geteilten Knopf');
ok(/\.top-leiste \{[^}]*margin-left: auto/.test(css) && /\.leiste-knopf \{/.test(css) && /\.melden-menue \.stufe-liste \{[^}]*right: 0/.test(css) && /\.fluss \{/.test(css) && /@media \(max-width: 640px\) \{ \.fluss-pfeil \{ display: none; \}/.test(css), 'style.css: Leiste rechts oben, Symbol-Knöpfe, Liste von Melden rechtsbündig, Fluss, Pfeil auf schmalen Bildschirmen aus');
// Umbruch auf schmalen Bildschirmen (Handy-Screenshot 2026-10-25 „Awkward wraps of buttons“)
ok(/#melden-menue \{ order: 2; padding-left: \.9rem; border-left: 1px solid var\(--line\); \}/.test(css) && /@media \(max-width: 640px\) \{\s*#melden-menue \{ order: 1; margin-left: auto;[^}]*\}\s*\.top-leiste \{ order: 2; flex-basis: 100%; margin-left: 0; \}/.test(css), 'style.css: breit steht Melden rechts hinter einem Trenner, schmal in der Titelzeile und die Einstellungen als eigene Zeile darunter');
ok(/@media \(max-width: 640px\) \{[^@]*nav\.fluss \{ flex-direction: column; align-items: flex-start;/.test(css), 'schmal stehen Archetyp und Varianten untereinander, linksbündig (nav.fluss schlägt die spätere Regel .fluss)');
ok(/\.ablauf-kopf::after \{ content: ""; order: 1; flex: 1 1 0;/.test(css) && /\.ablauf-kopf > #kompakt-namen, \.ablauf-kopf > \.ablauf-voll-knopf \{ order: 2; margin-left: 0; \}/.test(css) && /\.ablauf-kopf > \.ablauf-voll-knopf \{ order: 2; margin-left: 0; \}\s*@media \(max-width: 640px\) \{ \.ablauf-kopf > #kompakt-namen \{ order: 3; \} \}/.test(css) && !/#ablauf-voll, #ablauf-voll-zu \{ margin-left: auto; \}/.test(css), 'Ablauf-Kopf: ein Platzhalter schiebt Beschriftung und Vollbild nach rechts (kein doppelter Auto-Abstand), schmal rutscht die Beschriftung in die zweite Zeile');
ok(/<div class="top-zeile">[\s\S]*?<div class="top-leiste" role="toolbar" aria-label="Einstellungen">[\s\S]*?<\/div>\s*<div id="melden-menue"><\/div>\s*<\/div>/.test(html), 'index.html: Melden steht neben der Werkzeugleiste in der Titelzeile, nicht mehr in ihr');
console.log(fail ?`${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
