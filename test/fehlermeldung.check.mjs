// Fehler melden (DR-044): ZIP-Schreiber und Meldungsformat (wie aktien-monitor issues/open/<Zeit>-<slug>/)
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const P = new URL('../src/', import.meta.url).href;
const { crc32, zipErstellen } = await import(P + 'model/zip.js');
const { meldungDateien, slugVon } = await import(P + 'model/meldung.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);

ok(crc32(enc('hello')) === 0x3610a686 && crc32(enc('')) === 0 && crc32(enc('123456789')) === 0xcbf43926, 'CRC32 stimmt mit den Referenzwerten überein');

// Eigenes Auslesen der ZIP-Struktur: lokale Köpfe, Zentralverzeichnis, Ende-Satz
function lies(zip) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const ende = zip.length - 22;
  if (v.getUint32(ende, true) !== 0x06054b50) return null;
  const n = v.getUint16(ende + 10, true);
  let p = v.getUint32(ende + 16, true);
  const dateien = [];
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) return null;
    const crc = v.getUint32(p + 16, true); const groesse = v.getUint32(p + 20, true); const nl = v.getUint16(p + 28, true); const off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nl));
    if (v.getUint32(off, true) !== 0x04034b50) return null;
    const ln = v.getUint16(off + 26, true); const le = v.getUint16(off + 28, true);
    const daten = zip.subarray(off + 30 + ln + le, off + 30 + ln + le + groesse);
    dateien.push({ name, daten, crcOk: crc32(daten) === crc });
    p += 46 + nl;
  }
  return dateien;
}
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]);
const zip = zipErstellen([{ name: 'a/issue.md', inhalt: '# Größe Ä' }, { name: 'a/bild.png', inhalt: png }]);
const gelesen = lies(zip);
ok(gelesen?.length === 2 && gelesen.every((d) => d.crcOk) && new TextDecoder().decode(gelesen[0].daten) === '# Größe Ä' && gelesen[1].daten.join() === png.join(), 'ZIP: zwei Dateien, Inhalt und CRC stimmen, Umlaute in UTF-8');

// Gegenprobe mit einem echten Entpacker (PowerShell auf Windows, sonst unzip), wenn vorhanden
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chefing-zip-'));
const zipPfad = path.join(tmp, 't.zip');
fs.writeFileSync(zipPfad, zip);
let entpackt = null;
try {
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPfad}' -DestinationPath '${path.join(tmp, 'x')}'`], { stdio: 'ignore' });
  else execFileSync('unzip', ['-q', zipPfad, '-d', path.join(tmp, 'x')], { stdio: 'ignore' });
  entpackt = fs.readFileSync(path.join(tmp, 'x', 'a', 'issue.md'), 'utf8');
} catch { entpackt = undefined; }
if (entpackt === undefined) console.log('SKIP kein Entpacker verfügbar');
else ok(entpackt === '# Größe Ä', 'echter Entpacker liest die Datei');
fs.rmSync(tmp, { recursive: true, force: true });

// Meldungsformat
ok(slugVon('Ofen zu heiß – Ränder!') === 'ofen-zu-heiss-raender' && slugVon('???') === 'fehler', 'Slug wie aktien-monitor: Umlaute ausgeschrieben, sonst Bindestriche');
const auto = { seite: '/chefing/', version: { sha: 'abc1234' }, viewport: '375×812', browser: 'Test', js_fehler: [], letzte_aktionen: ['10:00 Klick: button'], app: { archetyp: 'hefeteig' }, markiert: 'Gehen 60′' };
const m = meldungDateien({ titel: 'Ofen zu heiß', beschreibung: 'Erwartet 180 °C', auto, picks: [{ selector: 'div#flow', text: 'Backen', bbox: { x: 1, y: 2, w: 3, h: 4 }, ctx: { panel: 'Ablauf', ablauf_zeile: 'Backen' } }], wireframePng: png, anhaenge: [{ name: 'foto.jpg', daten: png }, { name: 'C:\\x\\foto.jpg', daten: png }] }, new Date(2026, 9, 20, 9, 5, 7));
const namen = m.dateien.map((d) => d.name);
ok(m.zipName === 'chefing-fehler-20261020-090507-ofen-zu-heiss.zip' && namen.join() === '20261020-090507-ofen-zu-heiss/issue.md,20261020-090507-ofen-zu-heiss/meta.json,20261020-090507-ofen-zu-heiss/wireframe.png,20261020-090507-ofen-zu-heiss/anhang/foto.jpg,20261020-090507-ofen-zu-heiss/anhang/1_foto.jpg', 'Ordner <Zeit>-<slug> mit issue.md, meta.json, wireframe.png, anhang/ (doppelte Namen nummeriert)');
const md = m.dateien[0].inhalt;
ok(md.startsWith('# Ofen zu heiß') && md.includes('## Beschreibung\n\nErwartet 180 °C') && md.includes('**Ablauf** – `div#flow`') && md.includes('   - Ablauf: Backen') && md.includes('> Gehen 60′') && md.includes('![Wireframe](wireframe.png)') && md.includes('"archetyp": "hefeteig"') && md.includes('- 10:00 Klick: button'), 'issue.md: Beschreibung, markierter Text, Elemente mit Umfeld, Wireframe, App-Zustand, letzte Aktionen');
const meta = JSON.parse(m.dateien[1].inhalt);
ok(meta.title === 'Ofen zu heiß' && meta.status === 'open' && meta.attachments.join() === 'foto.jpg,1_foto.jpg' && meta.auto.version.sha === 'abc1234', 'meta.json wie aktien-monitor (title, created, status, auto, picks, attachments)');
ok(lies(zipErstellen(m.dateien))?.length === 5, 'die ganze Meldung lässt sich zippen und wieder lesen');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
