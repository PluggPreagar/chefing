// DR-077: Fehler melden an den Server. Prüft den Client (src/model/meldungSenden.js) mit einem Fake-fetch und startet den PHP-Test
// der Endpunkt-Logik (test/issue-endpunkt.test.php), jeweils mit einer Anfrage, die der echte Client gebaut hat (Interop).
// Ohne PHP (ab 8.1) wird der PHP-Teil mit einer SKIP-Zeile übersprungen; PHP_BIN kann den Pfad vorgeben.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const P = new URL('../src/', import.meta.url).href;
const { sendeFehlermeldung, base64Von, MAX_ZIP_BYTES } = await import(P + 'model/meldungSenden.js');
const { meldungDateien } = await import(P + 'model/meldung.js');
const { zipErstellen } = await import(P + 'model/zip.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// --- Base64 ---------------------------------------------------------------------------------------------------------------------
ok(base64Von(new Uint8Array([72, 105])) === btoa('Hi') && base64Von(new Uint8Array(0)) === '', 'base64Von: kurze und leere Daten');
const gross = Uint8Array.from({ length: 200000 }, (_, i) => i % 251);
ok(Buffer.from(base64Von(gross), 'base64').equals(Buffer.from(gross)), 'base64Von: 200 KB (mehrere Stücke) kommen unverändert zurück');

// --- Meldung wie die Oberfläche sie baut ---------------------------------------------------------------------------------------
const jetzt = new Date(2026, 9, 25, 10, 11, 12);
const png = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
const foto = Uint8Array.from({ length: 5000 }, (_, i) => (i * 13) % 256);
const { zipName, dateien, md, metaJson } = meldungDateien({
  titel: 'Hinweis fehlt beim Aufschlagen', beschreibung: 'Erwartet: Tipp. Tatsächlich: keiner. Größe: 5 mm.',
  auto: { seite: '/chefing/', version: { sha: '0ad6f66' }, viewport: '1200×800', browser: 'Test', app: { archetyp: 'ruehrteig' }, js_fehler: [], letzte_aktionen: ['Klick: Muffins'] },
  picks: [{ selector: 'div#flow', text: 'Aufschlagen', bbox: { x: 1, y: 2, w: 3, h: 4 }, ctx: { panel: 'Ablauf' } }], wireframePng: png, anhaenge: [{ name: 'foto.jpg', daten: foto }],
}, jetzt);
const zipBytes = zipErstellen(dateien);
const meldung = { titel: 'Hinweis fehlt beim Aufschlagen', md, metaJson, zipBytes };
ok(zipName.startsWith('chefing-fehler-') && md.startsWith('# Hinweis fehlt') && JSON.parse(metaJson).status === 'open', 'meldungDateien liefert zusätzlich md und metaJson');

// --- sendeFehlermeldung mit Fake-fetch ----------------------------------------------------------------------------------------
const antwort = (status, inhalt) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => { if (inhalt === undefined) throw new Error('kein json'); return inhalt; } });
let aufruf = null;
const fangen = (status, inhalt) => async (url, opt) => { aufruf = { url, opt }; return antwort(status, inhalt)(); };
let r = await sendeFehlermeldung(meldung, { fetchFn: fangen(200, { ok: true, id: '20261025-101112-x-ab12' }) });
ok(r.ok && r.id === '20261025-101112-x-ab12', 'Erfolg: ok und id');
const gesendet = JSON.parse(aufruf.opt.body);
ok(aufruf.url === './chefing-issue.php' && aufruf.opt.method === 'POST' && aufruf.opt.headers['Content-Type'] === 'application/json', 'POST als application/json an ./chefing-issue.php');
ok(Object.keys(gesendet).sort().join() === 'issue_md,meta_json,titel,zip_b64' && gesendet.titel === meldung.titel && gesendet.issue_md === md && gesendet.meta_json === metaJson && Buffer.from(gesendet.zip_b64, 'base64').equals(Buffer.from(zipBytes)), 'Körper: titel, issue_md, meta_json und das ZIP als Base64, nichts sonst');
ok((await sendeFehlermeldung(meldung, { fetchFn: fangen(200, { ok: true }), url: '/x.php' })).ok && aufruf.url === '/x.php', 'die URL lässt sich überschreiben');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(404, undefined) });
ok(!r.ok && r.status === 404 && /nicht eingerichtet/.test(r.fehler), '404 ohne JSON: „Meldeweg nicht eingerichtet“');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(429, { ok: false, fehler: 'zu schnell' }) });
ok(!r.ok && /zu viele/.test(r.fehler), '429: „zu viele Meldungen“');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(413, { ok: false, fehler: 'zu gross' }) });
ok(!r.ok && /zu groß/.test(r.fehler), '413: zu groß');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(500, { ok: false, fehler: 'speicher' }) });
ok(!r.ok && /nicht speichern/.test(r.fehler), '500: Server konnte nicht speichern');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(400, { ok: false, fehler: 'titel' }) });
ok(!r.ok && /abgelehnt \(titel\)/.test(r.fehler), '400: abgelehnt mit dem Grund aus der Antwort');
r = await sendeFehlermeldung(meldung, { fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
ok(!r.ok && /Keine Verbindung/.test(r.fehler), 'Netzfehler: „Keine Verbindung“, kein Wurf');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(200, { ok: false }) });
ok(!r.ok, '200 mit ok:false gilt nicht als gesendet');
r = await sendeFehlermeldung(meldung, { fetchFn: fangen(200, undefined) });
ok(!r.ok && r.status === 200 && /nimmt hier keine Meldungen an/.test(r.fehler) && !/abgelehnt/.test(r.fehler), '200 ohne JSON (statischer Server): „Server nimmt hier keine Meldungen an“ statt „abgelehnt (200)“');
let gerufen = false;
r = await sendeFehlermeldung({ ...meldung, zipBytes: new Uint8Array(MAX_ZIP_BYTES + 1) }, { fetchFn: async () => { gerufen = true; return antwort(200, { ok: true })(); } });
ok(!r.ok && !gerufen && /zu groß/.test(r.fehler), 'ZIP über 12 MB: wird gar nicht erst gesendet');
ok(MAX_ZIP_BYTES === 12582912, 'Grenze 12 MB wie ISSUE_MAX_ZIP im PHP');

// --- Oberfläche: Knöpfe und Hinweistext --------------------------------------------------------------------------------------
const ui = fs.readFileSync(new URL('../src/ui/fehlerMelden.js', import.meta.url), 'utf8');
ok(/id="fm-send"[^>]*>Absenden/.test(ui) && /id="fm-zip"[^>]*>ZIP herunterladen/.test(ui) && /sendeFehlermeldung/.test(ui) && /Gesendet wird erst mit „Absenden“/.test(ui), 'Panel hat „Absenden“ und „ZIP herunterladen“ und sagt, was gesendet wird');
ok(!/Es wird nichts gesendet/.test(ui) && !/Es wird nichts gesendet/.test(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')), 'der alte Hinweis „Es wird nichts gesendet“ ist weg');

// --- PHP-Teil mit einer vom Client gebauten Anfrage ---------------------------------------------------------------------------
const kandidaten = [process.env.PHP_BIN, 'php', 'D:/_progs/xampp/php/php.exe', 'C:/xampp/php/php.exe', '/usr/bin/php', '/usr/local/bin/php'].filter(Boolean);
let php = null;
for (const k of kandidaten) {
  const t = spawnSync(k, ['-v'], { encoding: 'utf8' });
  if (t.status === 0 && /PHP (8\.[1-9]|9)/.test(t.stdout)) { php = k; break; }
}
if (!php) {
  console.log('SKIP PHP ab 8.1 nicht gefunden — Endpunkt-Test übersprungen (PHP_BIN setzen)');
} else {
  const bodyDatei = path.join(os.tmpdir(), `chefing_issue_body_${process.pid}.json`);
  fs.writeFileSync(bodyDatei, aufruf.opt.body);
  const skript = new URL('./issue-endpunkt.test.php', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const pr = spawnSync(php, [skript, bodyDatei], { encoding: 'utf8' });
  fs.rmSync(bodyDatei, { force: true });
  process.stdout.write(pr.stdout);
  if (pr.stderr.trim()) { console.log(`FAIL PHP-Ausgabe auf stderr: ${pr.stderr.trim().split('\n')[0]}`); fail++; }
  if (pr.status !== 0) { console.log('FAIL PHP-Test mit Exit-Code ' + pr.status); fail++; }
}
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
