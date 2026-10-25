// T124 (DR-080): Ablauf im Vollbild und gedreht. Die Steuerung wird mit kleinen Attrappen für Kasten, Dokument und Bildschirm geprüft,
// dazu die Anbindung in index.html, main.js und style.css.
import fs from 'fs';
const P = new URL('../', import.meta.url);
const { erzeugeVollbild } = await import(new URL('src/ui/vollbild.js', P).href);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const klassen = () => { const s = new Set(); return { s, add: (k) => s.add(k), remove: (k) => s.delete(k), toggle: (k, an) => (an ? s.add(k) : s.delete(k)), contains: (k) => s.has(k) }; };
function bau({ api = true, apiVerweigert = false, sperre = true, sperreVerweigert = false, typ = 'portrait-primary' } = {}) {
  const log = [];
  const panel = { classList: klassen() };
  const doc = { body: { classList: klassen() }, fullscreenElement: null, exitFullscreen: async () => { log.push('exit'); doc.fullscreenElement = null; } };
  if (api) panel.requestFullscreen = async (opt) => { log.push('voll ' + JSON.stringify(opt)); if (apiVerweigert) throw new Error('nein'); doc.fullscreenElement = panel; };
  const scr = sperre ? { orientation: { type: typ, lock: async (a) => { log.push('lock ' + a); if (sperreVerweigert) throw new Error('nein'); scr.orientation.type = a + '-primary'; }, unlock: () => log.push('unlock') } } : {}; // wie im Browser: nach der Sperre ändert sich type
  const meldungen = [];
  const v = erzeugeVollbild({ panel, doc, scr, melden: (s) => meldungen.push({ ...s }) });
  return { v, panel, doc, scr, log, meldungen };
}
const k = (b) => [...b.panel.classList.s].sort().join();

// --- echtes Vollbild mit Sperre --------------------------------------------------------------------------------------------------
let b = bau();
let s = await b.v.oeffnen();
ok(s.offen && s.echt && !s.gedreht && b.log[0].startsWith('voll') && b.log[1] === 'lock landscape', 'öffnen: Vollbild-API, dann Querformat gesperrt');
ok(k(b) === 'ablauf-voll' && b.doc.body.classList.contains('hat-vollbild'), 'der Kasten trägt ablauf-voll, die Seite hat-vollbild (kein Scrollen dahinter)');
ok(b.log[0].includes('hide'), 'Vollbild ohne Browser-Leisten angefordert');
s = await b.v.oeffnen();
ok(s.offen && b.log.length === 2, 'zweites Öffnen tut nichts');
s = await b.v.drehen();
ok(s.offen && !s.gedreht && b.log[2] === 'lock portrait' && k(b) === 'ablauf-voll', 'drehen aus Hochformat-Gerät: Sperre wechselt auf die andere Seite, keine CSS-Drehung');
s = b.v.schliessen();
ok(!s.offen && b.log.includes('exit') && b.log.includes('unlock') && k(b) === '' && !b.doc.body.classList.contains('hat-vollbild'), 'schließen: Vollbild verlassen, Sperre gelöst, Klassen weg');
ok(b.v.schliessen().offen === false && b.log.filter((x) => x === 'exit').length === 1, 'zweites Schließen tut nichts');

// Esc: der Browser verlässt das Vollbild selbst
b = bau(); await b.v.oeffnen(); b.doc.fullscreenElement = null; b.v.beiVollbildwechsel();
ok(!b.v.stand().offen && k(b) === '' && b.log.includes('unlock') && !b.log.includes('exit'), 'Esc im Vollbild: der Kasten zieht nach, ohne erneut zu beenden');
b = bau(); await b.v.oeffnen(); b.v.beiVollbildwechsel();
ok(b.v.stand().offen, 'Vollbildwechsel bei weiter laufendem Vollbild ändert nichts');

// --- Sperre verweigert oder nicht vorhanden ------------------------------------------------------------------------------------
b = bau({ sperreVerweigert: true });
s = await b.v.oeffnen();
ok(s.offen && s.echt && k(b) === 'ablauf-voll', 'Sperre beim Öffnen verweigert: Vollbild bleibt trotzdem');
s = await b.v.drehen();
ok(s.gedreht && k(b) === 'ablauf-voll,gedreht', 'drehen ohne erlaubte Sperre: CSS-Drehung');
s = await b.v.drehen();
ok(!s.gedreht && k(b) === 'ablauf-voll', 'noch einmal drehen: zurück');
b = bau({ sperre: false });
await b.v.oeffnen(); s = await b.v.drehen();
ok(s.echt && s.gedreht && !b.log.some((x) => x.startsWith('lock')), 'Gerät ohne Orientierungs-API: nie eine Sperre, nur CSS-Drehung');
s = b.v.schliessen();
ok(!s.gedreht && k(b) === '', 'schließen setzt die Drehung zurück');

// --- Vollbild-API fehlt oder verweigert: CSS-Vollbild (iPhone-Safari) ------------------------------------------------------------
b = bau({ api: false });
s = await b.v.oeffnen();
ok(s.offen && !s.echt && k(b) === 'ablauf-voll' && !b.log.some((x) => x.startsWith('lock')), 'ohne Vollbild-API: CSS-Vollbild, keine Sperre');
s = await b.v.drehen();
ok(s.gedreht && k(b) === 'ablauf-voll,gedreht', 'CSS-Vollbild: Drehen per CSS');
s = b.v.schliessen();
ok(!s.offen && !b.log.includes('exit') && k(b) === '', 'CSS-Vollbild schließen: kein exitFullscreen');
b = bau({ apiVerweigert: true });
s = await b.v.oeffnen();
ok(s.offen && !s.echt && k(b) === 'ablauf-voll' && !b.log.some((x) => x.startsWith('lock')), 'Vollbild-API verweigert: CSS-Vollbild statt Fehler');
b.v.beiVollbildwechsel();
ok(b.v.stand().offen, 'CSS-Vollbild bleibt bei fullscreenchange offen (kein Vollbild-Element nötig)');
b = bau(); ok((await b.v.drehen()).offen === false && b.log.length === 0, 'drehen ohne offenes Vollbild tut nichts');

// --- Meldungen an die Oberfläche -----------------------------------------------------------------------------------------------
b = bau(); await b.v.oeffnen(); await b.v.drehen(); b.v.schliessen();
ok(b.meldungen.length >= 3 && b.meldungen[0].offen === true && b.meldungen.at(-1).offen === false && b.meldungen.at(-1).gedreht === false, 'melden: Zustand nach jedem Wechsel (offen, gedreht)');

// --- Anbindung ------------------------------------------------------------------------------------------------------------------
const html = fs.readFileSync(new URL('index.html', P), 'utf8');
const css = fs.readFileSync(new URL('style.css', P), 'utf8');
const main = fs.readFileSync(new URL('src/main.js', P), 'utf8');
const modul = fs.readFileSync(new URL('src/ui/vollbild.js', P), 'utf8');
const knopfHtml = (id) => html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([^<]*)</button>`));
ok(knopfHtml('ablauf-voll') && /aria-label="Vollbild"/.test(knopfHtml('ablauf-voll')[0]) && /id="ablauf-voll-zu"[^>]*hidden/.test(html) && /id="ablauf-drehen"[^>]*hidden/.test(html), 'index.html: „Vollbild“ im Kopf des Ablaufs, „Vollbild beenden“ und „Drehen“ zunächst versteckt');
// DR-084: nur Symbol aus dem Symbolsatz, Erklärung per Tooltip und aria-label; kein Text im Knopf
const { ICONS } = await import(new URL('src/ui/icons.js', P).href);
ok(['ablauf-voll', 'ablauf-voll-zu', 'ablauf-drehen'].every((id) => { const m = knopfHtml(id); return m && m[1] === '' && /title="[^"]{8,}"/.test(m[0]) && /aria-label="[^"]+"/.test(m[0]) && /nur-symbol/.test(m[0]); }), 'DR-084: die drei Knöpfe haben keinen Text, aber Tooltip, aria-label und die Klasse nur-symbol');
ok(['vollbild', 'vollbild_zu', 'drehen'].every((k) => Array.isArray(ICONS[k]) && ICONS[k].length && ICONS[k].every((x) => x.tag && x.attrs)) && /iconHtml\('vollbild'/.test(modul) === false && /knopf\('ablauf-voll', 'vollbild'/.test(modul) && /knopf\('ablauf-voll-zu', 'vollbild_zu'/.test(modul) && /knopf\('ablauf-drehen', 'drehen'/.test(modul), 'die Symbole vollbild, vollbild_zu und drehen stehen im Symbolsatz (icons.js) und werden von den Knöpfen benutzt');
ok(/\.ablauf-voll-knopf\.nur-symbol \{[^}]*width: 2\.4rem[^}]*height: 2\.4rem/.test(css), 'style.css: Symbol-Knöpfe rund und gleich groß');
// DR-079: Aktionen ohne Zustand = Knopf mit festem Verb, nie hervorgehoben; keine wechselnde Beschriftung, kein aria-pressed
ok(!/aria-pressed/.test(modul) && !/is-active/.test(modul) && !/textContent|innerHTML = \`\${offen/.test(modul), 'DR-079: die Vollbild-Knöpfe haben keine wechselnde Beschriftung, kein aria-pressed und keine Hervorhebung');
ok(/'Vollbild beenden'/.test(modul) && /'Drehen'/.test(modul) && /hidden = offen; zu\.hidden = !offen; dreh\.hidden = !offen/.test(modul), 'nur die sichtbare Aktion wechselt: Vollbild (zu) · Vollbild beenden und Drehen (offen)');
ok(/import \{ initVollbild \} from '\.\/ui\/vollbild\.js'/.test(main) && /initVollbild\(document\.querySelector\('\.panel\.ablauf'\), document\.querySelector\('\.ablauf-kopf'\)\)/.test(main), 'main.js bindet das Vollbild an den Ablauf-Kasten');
ok(/\.ablauf\.ablauf-voll \{[^}]*position: fixed[^}]*inset: 0/.test(css) && /\.ablauf\.ablauf-voll\.gedreht \{[^}]*rotate\(90deg\)[^}]*\}/.test(css) && /body\.hat-vollbild/.test(css), 'style.css: Kasten füllt die Seite, gedreht um 90°, Seite ohne Scrollen');
ok(/width: 100vh; height: 100vw/.test(css), 'gedreht: Breite und Höhe getauscht (100vh × 100vw)');
ok(/document\.addEventListener\('fullscreenchange'/.test(modul) || /doc\.addEventListener\('fullscreenchange'/.test(modul), 'Vollbild-Wechsel durch den Browser (Esc) wird abgefangen');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
