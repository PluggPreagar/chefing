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
ok(s.offen && s.echt && !s.gedreht && b.log[0].startsWith('voll') && !b.log.some((x) => x.startsWith('lock')), 'öffnen: Vollbild-API, keine Sperre der Ausrichtung (das Handy bleibt, wie es gehalten wird, DR-101)');
ok(k(b) === 'ablauf-voll' && b.doc.body.classList.contains('hat-vollbild'), 'der Kasten trägt ablauf-voll, die Seite hat-vollbild (kein Scrollen dahinter)');
ok(b.log[0].includes('hide'), 'Vollbild ohne Browser-Leisten angefordert');
s = await b.v.oeffnen();
ok(s.offen && b.log.length === 1, 'zweites Öffnen tut nichts');
s = await b.v.drehen();
ok(s.offen && !s.gedreht && b.log[1] === 'lock landscape' && k(b) === 'ablauf-voll', 'drehen aus Hochformat-Gerät: erst jetzt wird gesperrt, auf die andere Seite, keine CSS-Drehung');
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
ok(s.offen && s.echt && k(b) === 'ablauf-voll', 'Vollbild ohne Sperre beim Öffnen');
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
ok(/import \{ initVollbild \} from '\.\/ui\/vollbild\.js'/.test(main) && /initVollbild\(document\.querySelector\('\.panel\.ablauf'\), document\.querySelector\('\.ablauf-kopf'\), document, globalThis\.screen, \{/.test(main), 'main.js bindet das Vollbild an den Ablauf-Kasten');
ok(/\.ablauf\.ablauf-voll \{[^}]*position: fixed[^}]*inset: 0/.test(css) && /\.ablauf\.ablauf-voll\.gedreht \{[^}]*rotate\(90deg\)[^}]*\}/.test(css) && /body\.hat-vollbild/.test(css), 'style.css: Kasten füllt die Seite, gedreht um 90°, Seite ohne Scrollen');
// Meldung 20261025-075952: im Vollbild keine Einstellungen; Diagramm, Schritt-Karten und die Vollbild-Knöpfe bleiben
const aus = css.match(/\.ablauf\.ablauf-voll #ablauf-techniken, \.ablauf\.ablauf-voll #ablauf-ansicht, \.ablauf\.ablauf-voll #kompakt-namen \{ display: none; \}/);
ok(/\.ablauf\.ablauf-voll #ablauf-techniken \{ display: none; \}/.test(css) && !/\.ablauf\.ablauf-voll #ablauf-ansicht/.test(css) && !/\.ablauf\.ablauf-voll #kompakt-namen/.test(css) && !/\.ablauf\.ablauf-voll #ablauf-ausrichtung/.test(css), 'style.css: im Vollbild ist nur der Technik-Schalter ausgeblendet (er ändert das Rezept); Text | Symbole und Ausrichtung bleiben bedienbar (DR-090)');
ok(/id="ablauf-techniken"/.test(html) && /id: 'kompakt-namen'/.test(main) && /id: 'ablauf-ausrichtung'/.test(main), 'die Gruppen des Diagramm-Kopfs gibt es: Technik in index.html, Beschriftung und Ausrichtung werden in main.js angelegt');
ok(!/ablauf-voll[^{]*#ablauf-voll-zu[^{]*\{ display: none/.test(css) && !/ablauf-voll[^{]*#ablauf-drehen[^{]*\{ display: none/.test(css) && !/ablauf-voll[^{]*\.strom/.test(css.split('\n').filter((l) => /display: none/.test(l)).join('\n')), 'Vollbild beenden, Drehen und das Diagramm bleiben sichtbar');
ok(/width: 100vh; height: 100vw/.test(css), 'gedreht: Breite und Höhe getauscht (100vh × 100vw)');
ok(/document\.addEventListener\('fullscreenchange'/.test(modul) || /doc\.addEventListener\('fullscreenchange'/.test(modul), 'Vollbild-Wechsel durch den Browser (Esc) wird abgefangen');

// --- Ausrichtung (T139, DR-089) ---------------------------------------------------------------------------------------------------------
// Querformat = Zeitleiste links nach rechts (Strom), Hochformat = oben nach unten (Kompakt); die CSS-Drehung vertauscht Breite und Höhe
{
  const bauQ = (quer, opt = {}) => {
    const zustand = { quer };
    const panel = { classList: klassen(), requestFullscreen: opt.api === false ? undefined : async () => { doc.fullscreenElement = panel; } };
    const doc = { body: { classList: klassen() }, fullscreenElement: null, exitFullscreen: async () => { doc.fullscreenElement = null; } };
    const scr = opt.sperre ? { orientation: { type: quer ? 'landscape-primary' : 'portrait-primary', lock: async (a) => { zustand.quer = a === 'landscape'; scr.orientation.type = a + '-primary'; }, unlock: () => {} } } : {};
    const meldungen = [];
    const v = erzeugeVollbild({ panel, doc, scr, viewportQuer: () => zustand.quer, melden: (s) => meldungen.push({ ...s }) });
    return { v, zustand, meldungen, panel };
  };
  let x = bauQ(true, { api: false });
  ok(x.v.stand().ausrichtung === 'quer', 'Querformat-Bildschirm: Ausrichtung quer');
  let s = await x.v.oeffnen();
  ok(s.ausrichtung === 'quer' && x.meldungen.at(-1).ausrichtung === 'quer', 'Öffnen im Querformat meldet quer (Ansicht Strom)');
  s = await x.v.drehen();
  ok(s.gedreht && s.ausrichtung === 'hoch' && x.meldungen.at(-1).ausrichtung === 'hoch', 'CSS-Drehung auf dem Querformat-Bildschirm: wirksam Hochformat, gemeldet');
  s = await x.v.drehen();
  ok(!s.gedreht && s.ausrichtung === 'quer', 'noch einmal drehen: wieder quer');
  x = bauQ(false, { api: false });
  s = await x.v.oeffnen();
  ok(s.ausrichtung === 'hoch', 'Hochformat-Bildschirm (Handy): Öffnen meldet hoch (Ansicht Kompakt)');
  s = await x.v.drehen();
  ok(s.gedreht && s.ausrichtung === 'quer', 'CSS-Drehung auf dem Hochformat-Bildschirm: wirksam Querformat');
  // Gerät gedreht: Größe ändert sich, die Steuerung meldet neu
  x = bauQ(false, { api: false });
  await x.v.oeffnen();
  const anzahl = x.meldungen.length;
  x.zustand.quer = true; x.v.beiGroesse();
  ok(x.meldungen.length === anzahl + 1 && x.meldungen.at(-1).ausrichtung === 'quer', 'Gerät ins Querformat gedreht: Größenänderung meldet quer');
  x.v.schliessen(); const nachZu = x.meldungen.length; x.v.beiGroesse();
  ok(x.meldungen.length === nachZu, 'bei geschlossenem Vollbild meldet eine Größenänderung nichts');
  // echtes Vollbild im Hochformat-Gerät: es bleibt hoch (Kompakt bleibt Kompakt), erst „Drehen“ sperrt auf Querformat
  x = bauQ(false, { sperre: true });
  s = await x.v.oeffnen();
  ok(s.echt && x.zustand.quer === false && s.ausrichtung === 'hoch', 'echtes Vollbild mit Sperre-Schnittstelle: Gerät bleibt im Hochformat, wirksam hoch (DR-101)');
  s = await x.v.drehen();
  ok(!s.gedreht && x.zustand.quer === true && s.ausrichtung === 'quer', 'Drehen mit Sperre wechselt auf Querformat, wirksam quer, ohne CSS-Drehung');
  s = x.v.schliessen();
  ok(!s.offen && x.meldungen.at(-1).offen === false, 'Schließen meldet offen: false (die Oberfläche springt auf die eigene Ansicht zurück)');
}

// Anbindung: die Ausrichtung wählt die Ansicht, beim Beenden springt sie zurück, die Wahl in der Leiste bleibt unberührt
ok(/let vollbildAnsicht = null;/.test(main) && /const neu = s\.offen \? \(s\.ausrichtung === 'quer' \? 'strom' : 'kompakt'\) : null;/.test(main) && /if \(neu !== vollbildAnsicht\) \{ vollbildAnsicht = neu; render\(\); \}/.test(main), 'main.js: quer = Strom, hoch = Kompakt, geschlossen = keine erzwungene Ansicht (springt zurück)');
ok(/const wirksameAnsicht = \(\) => ermittleAnsicht\(\{ ausrichtung, vollbildAnsicht, hoch: viewportHoch\(\) \}\);/.test(main) && /const ansichtJetzt = wirksameAnsicht\(\);/.test(main) && !/ausrichtung = vollbildAnsicht/.test(main), 'render() nimmt die wirksame Ansicht (feste Wahl, sonst Vollbild-Ausrichtung, sonst Bildschirm) und schreibt die eigene Wahl nie um');
ok(/renderKompakt\(\$\('kompakt'\), computed, data, \{ namen: kompaktNamen \}\)/.test(main) && !/vollbildAnsicht === 'kompakt' \? true/.test(main), 'Text | Symbole gilt auch im Vollbild: kein erzwungener Text mehr, die Einstellung bleibt dort bedienbar (DR-090)');
ok(/fenster\.addEventListener\?\.\('resize', v\.beiGroesse\)/.test(modul) && /fenster\.addEventListener\?\.\('orientationchange', v\.beiGroesse\)/.test(modul), 'Größenänderung und Gerätedrehung werden abgefangen');

{
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  ok(/\.ablauf\.ablauf-voll \{ display: flex; flex-direction: column; \}/.test(css) && /\.ablauf\.ablauf-voll #kompakt:not\(\[hidden\]\) \{ flex: 1 1 0; min-height: 0;/.test(css) && /\.ablauf\.ablauf-voll \.kompakt-svg, \.ablauf\.ablauf-voll \.kompakt-svg\.mit-namen \{ width: 100%; height: 100%; max-width: none; \}/.test(css), 'Vollbild: das Kompakt-Diagramm füllt den Rest der Höhe und wird eingepasst (DR-096)');
}

{
  const mainSrc = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  ok(/function passeStromEin\(\)/.test(mainSrc) && /f\.style\.zoom = ''/.test(mainSrc) && /Math\.min\(3, innen\.b \/ breit, innen\.h \/ f\.offsetHeight\)/.test(mainSrc) && /passeStromEin\(\);\s*document\.querySelectorAll\('\[data-ausrichtung\]'\)/.test(mainSrc), 'Strom im Vollbild: per zoom auf Breite und Höhe eingepasst (nie kleiner als 1, höchstens 3), nach jedem Zeichnen (DR-103)');
  ok(/spaeterZeichnen = \(\) => \{ clearTimeout\(spaeterTimer\);/.test(mainSrc) && /if \(s\.offen\) spaeterZeichnen\(\);/.test(mainSrc), 'Vollbild offen: nach Größenänderung wird verzögert noch einmal gezeichnet, auch bei gleicher Ansicht (DR-103)');
}

console.log(fail ?`${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
