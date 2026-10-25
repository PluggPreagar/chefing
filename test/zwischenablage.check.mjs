// DR-077: nach dem Absenden liegt die Nummer der Meldung (Ordnername) in der Zwischenablage. Prüft src/ui/zwischenablage.js mit Attrappen
// und die Anbindung im Panel.
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const { inZwischenablage } = await import(P + 'ui/zwischenablage.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const nummer = '20261025-071817-lokaler-test-ablage-ea95';
const attrappe = ({ api = true, verweigert = false, exec = true, execWirft = false } = {}) => {
  const log = [];
  const felder = [];
  const nav = api ? { clipboard: { writeText: async (t) => { log.push('api ' + t); if (verweigert) throw new Error('NotAllowedError'); } } } : {};
  const doc = {
    body: { append: (f) => { felder.push(f); log.push('angehängt'); } },
    createElement: () => ({ value: '', style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, select() { log.push('select ' + this.value); }, remove() { log.push('entfernt'); } }),
    execCommand: (c) => { log.push('exec ' + c); if (execWirft) throw new Error('nein'); return exec; },
  };
  return { nav, doc, log, felder };
};

let a = attrappe();
ok(await inZwischenablage(nummer, a) === true && a.log.join('|') === 'api ' + nummer, 'Clipboard-API: die Nummer wird kopiert, kein Umweg');
a = attrappe({ verweigert: true });
ok(await inZwischenablage(nummer, a) === true && a.log.join('|') === `api ${nummer}|angehängt|select ${nummer}|exec copy|entfernt`, 'API verweigert: Rückfall über verstecktes Textfeld, danach entfernt');
ok(a.felder[0].attrs.readonly === '' && /opacity:0/.test(a.felder[0].style.cssText), 'das Textfeld ist schreibgeschützt und unsichtbar (kein Springen der Seite)');
a = attrappe({ api: false });
ok(await inZwischenablage(nummer, a) === true && a.log.includes('exec copy'), 'ohne Clipboard-API (unsicherer Kontext): Rückfall über Textfeld');
a = attrappe({ api: false, exec: false });
ok(await inZwischenablage(nummer, a) === false && a.log.at(-1) === 'entfernt', 'Rückfall scheitert: false, Textfeld trotzdem entfernt');
a = attrappe({ verweigert: true, execWirft: true });
ok(await inZwischenablage(nummer, a) === false, 'beides scheitert (execCommand wirft): false, kein Wurf');
ok(await inZwischenablage('', attrappe()) === false && await inZwischenablage(null, attrappe()) === false && await inZwischenablage(undefined, attrappe()) === false, 'leerer Text wird nicht kopiert');
ok(await inZwischenablage(nummer, { nav: undefined, doc: undefined }) === false && await inZwischenablage(nummer, { nav: {}, doc: {} }) === false, 'ohne Browser-Objekte: false, kein Wurf');
ok(await inZwischenablage(123, attrappe()) === true, 'Zahlen werden als Text kopiert');

// Anbindung im Panel
const ui = fs.readFileSync(new URL('ui/fehlerMelden.js', P), 'utf8');
ok(/import \{ inZwischenablage \} from '\.\/zwischenablage\.js'/.test(ui) && /await inZwischenablage\(r\.id\)/.test(ui), 'Panel kopiert nach dem Senden die Nummer (r.id) in die Zwischenablage');
ok(/id="fm-nr">Nummer kopieren</.test(ui) && /fm-kopiert/.test(ui) && /Kopieren nicht möglich, bitte von Hand/.test(ui) && /in die Zwischenablage kopiert/.test(ui), 'Panel zeigt, ob kopiert wurde, und bietet „Nummer kopieren“ als Knopf an');
ok(/const kopiert = r\.id \? await inZwischenablage\(r\.id\) : false/.test(ui), 'ohne id (ältere Antwort) wird nichts kopiert');
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', P), 'utf8'));
ok((Array.isArray(manifest) ? manifest : manifest.module ?? manifest.files ?? Object.keys(manifest)).some((x) => String(x).includes('ui/zwischenablage.js')), 'src/manifest.json kennt das neue Modul');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
