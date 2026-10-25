// DR-082: lokaler Entwicklungsserver (tools/dev-server.py): statische Dateien und Annahme von Fehlermeldungen in issues/open/.
// Startet den Server auf einem freien Port mit einem Temp-Ordner als Ablage und schickt ihm eine Anfrage, die der echte Client gebaut hat.
// Ohne Python 3 wird er mit einer SKIP-Zeile übersprungen; PYTHON_BIN kann den Pfad vorgeben.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

const P = new URL('../src/', import.meta.url).href;
const { sendeFehlermeldung } = await import(P + 'model/meldungSenden.js');
const { meldungDateien } = await import(P + 'model/meldung.js');
const { zipErstellen } = await import(P + 'model/zip.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const kandidaten = [process.env.PYTHON_BIN, 'python3', 'python', 'py'].filter(Boolean);
let py = null;
for (const k of kandidaten) {
  const t = spawnSync(k, ['--version'], { encoding: 'utf8' });
  if (t.status === 0 && /Python 3\.(9|1\d)/.test(t.stdout + t.stderr)) { py = k; break; }
}
const wurzel = new URL('../', import.meta.url);
const ok0 = fs.readFileSync(new URL('justfile', wurzel), 'utf8');
ok(/^serve port="8780":\n    python tools\/dev-server\.py --port \{\{port\}\}/m.test(ok0) && /^test:/m.test(ok0) && /^issues:/m.test(ok0), 'justfile: serve (Port 8780), test und issues');

if (!py) {
  console.log('SKIP Python 3.9+ nicht gefunden — Server-Test übersprungen (PYTHON_BIN setzen)');
  console.log(fail ? `${fail} FAIL` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chefing_dev_'));
const ablage = path.join(tmp, 'open');
const skript = new URL('tools/dev-server.py', wurzel).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const proc = spawn(py, [skript, '--port', '0', '--issues', ablage], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
let ausgabe = ''; let fehlerAus = '';
proc.stdout.on('data', (d) => { ausgabe += d; });
proc.stderr.on('data', (d) => { fehlerAus += d; });
const port = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Server startet nicht: ' + fehlerAus)), 15000);
  const warte = setInterval(() => { const m = /127\.0\.0\.1:(\d+)\//.exec(ausgabe); if (m) { clearInterval(warte); clearTimeout(t); resolve(+m[1]); } }, 50);
});
const B = `http://127.0.0.1:${port}`;
// derselbe Port ein zweites Mal: der Start muss mit klarer Meldung scheitern, nicht stillschweigend mitlaufen (Windows: exklusiv binden)
{
  const zweiter = spawnSync(py, [skript, '--port', String(port), '--issues', path.join(tmp, 'zweit')], { encoding: 'utf8', timeout: 15000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  ok(zweiter.status === 1 && /belegt/.test(zweiter.stderr) && /Anderen Port/.test(zweiter.stderr) && !/Traceback/.test(zweiter.stderr), 'zweiter Server auf demselben Port: Exit 1 mit Meldung „Port belegt“, ohne Traceback');
}
ok(/default=8780/.test(fs.readFileSync(skript, 'utf8')), 'Vorgabe-Port 8780 (8765 gehört der Vorschau mit npx serve)');
// der Fall des Nutzers: auf dem Port lauscht schon ein anderer Server auf allen Adressen (npx serve auf 0.0.0.0)
{
  const { createServer } = await import('net');
  const fremd = createServer((s) => s.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n'));
  await new Promise((r) => fremd.listen(0, '0.0.0.0', r));
  const fremdPort = fremd.address().port;
  const dritter = spawnSync(py, [skript, '--port', String(fremdPort), '--issues', path.join(tmp, 'dritt')], { encoding: 'utf8', timeout: 15000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  fremd.close();
  ok(dritter.status === 1 && /belegt/.test(dritter.stderr) && !/Traceback/.test(dritter.stderr), 'Port schon von einem anderen Server auf 0.0.0.0 belegt (wie npx serve): Start scheitert mit Meldung, statt Anfragen still an sich zu ziehen');
}
const post = (p, body, typ = 'application/json') => fetch(B + p, { method: 'POST', headers: { 'Content-Type': typ }, body });

try {
  // statische Dateien
  let r = await fetch(B + '/');
  const html = await r.text();
  ok(r.status === 200 && /Chefing/.test(html) && r.headers.get('cache-control') === 'no-store', 'GET / liefert index.html, ohne Zwischenspeicher');
  r = await fetch(B + '/src/model/engine.js');
  ok(r.status === 200 && /javascript/.test(r.headers.get('content-type')), 'GET /src/model/engine.js als JavaScript');
  r = await fetch(B + '/gibt-es-nicht.js'); ok(r.status === 404, 'unbekannte Datei → 404');
  // lokal gibt es keine version.json vom Deploy: der Server liefert den Stand aus git für die Versionszeile (DR-110)
  r = await fetch(B + '/version.lokal.json');
  const lv = await r.json();
  ok(r.status === 200 && /^[0-9a-f]{40}$/.test(lv.sha) && /^[0-9a-f]{7} \(lokal(, geändert \d\d:\d\d)?\)$/.test(lv.anzeige) && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC$/.test(lv.time), 'GET /version.lokal.json: Commit, Zeit und Anzeige aus git, „lokal“ oder „lokal, geändert HH:MM“');
  r = await fetch(B + '/version.json'); ok(r.status === 404, '/version.json gibt es lokal nicht (nur der Deploy schreibt sie), die Seite lädt weiter ohne Versionierung');
  const gesperrt = [];
  for (const p of ['/issues/open/', '/.git/config', '/issues-data/', '/feedback-data/feedback.jsonl']) gesperrt.push((await fetch(B + p)).status);
  ok(gesperrt.every((s) => s === 404), 'issues, .git, issues-data und feedback-data werden nicht ausgeliefert');
  r = await fetch(B + '/chefing-issue.php');
  ok(r.status === 405 && r.headers.get('allow') === 'POST' && (await r.json()).fehler === 'nur POST', 'GET /chefing-issue.php → 405 „nur POST“ wie live');

  // eine Meldung, wie der echte Client sie baut
  const png = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
  const foto = Uint8Array.from({ length: 5000 }, (_, i) => (i * 13) % 256);
  const { dateien, md, metaJson } = meldungDateien({
    titel: 'Übung: Hinweis fehlt!', beschreibung: 'Erwartet: Tipp. Tatsächlich: keiner.',
    auto: { seite: '/', version: 'lokal', viewport: '1x1', browser: 'Test', app: {}, js_fehler: [], letzte_aktionen: [] },
    picks: [], wireframePng: png, anhaenge: [{ name: '../böse name.jpg', daten: foto }, { name: 'notiz.txt', daten: new TextEncoder().encode('Hallo') }],
  }, new Date(2026, 9, 25, 10, 11, 12));
  const zipBytes = zipErstellen(dateien);
  const meldung = { titel: 'Übung: Hinweis fehlt!', md, metaJson, zipBytes };
  const e = await sendeFehlermeldung(meldung, { url: B + '/chefing-issue.php' });
  ok(e.ok && /^\d{8}-\d{6}-uebung-hinweis-fehlt-[0-9a-f]{4}$/.test(e.id), 'Client sendet an den Server: ok und id aus Zeit, Titel-Slug und Zufall');
  const ordner = path.join(ablage, e.id || 'x');
  ok(fs.existsSync(ordner) && fs.readFileSync(path.join(ordner, 'issue.md'), 'utf8') === md && fs.readFileSync(path.join(ordner, 'meta.json'), 'utf8') === metaJson, 'Ordner issues/open/<id>/ mit issue.md und meta.json, Umlaute unverändert');
  ok(fs.readFileSync(path.join(ordner, 'wireframe.png')).equals(Buffer.from(png)), 'wireframe.png entpackt, Bytes gleich');
  const anh = fs.existsSync(path.join(ordner, 'anhang')) ? fs.readdirSync(path.join(ordner, 'anhang')).sort() : [];
  ok(anh.length === 2 && anh.includes('notiz.txt') && anh.every((n) => /^[A-Za-z0-9._-]+$/.test(n)) && fs.readFileSync(path.join(ordner, 'anhang', anh.find((n) => n.endsWith('.jpg')))).equals(Buffer.from(foto)), 'Anhänge entpackt mit bereinigten Dateinamen, Bytes gleich');
  ok(fs.readdirSync(ordner).sort().join() === 'anhang,issue.md,meta.json,wireframe.png', 'im Ordner liegt genau: anhang, issue.md, meta.json, wireframe.png');
  ok(/Fehlermeldung gespeichert: .*uebung-hinweis-fehlt/.test(ausgabe) || ausgabe.includes('Fehlermeldung gespeichert'), 'der Server meldet die Ablage auf der Konsole');
  ok(md.includes('![Wireframe](wireframe.png)') && md.includes('(anhang/'), 'issue.md verweist relativ auf Wireframe und Anhänge, die Links passen zur Ablage');

  // Ablehnungen wie live
  const gut = { titel: 'Test', issue_md: '# Test', meta_json: '{"status":"open"}', zip_b64: Buffer.from(zipBytes).toString('base64') };
  const code = async (over) => (await post('/chefing-issue.php', JSON.stringify({ ...gut, ...over }))).status;
  ok(await code({}) === 200, 'gültige Minimal-Meldung → 200');
  ok(await code({ titel: '' }) === 400 && await code({ titel: 'x'.repeat(121) }) === 400 && await code({ issue_md: '' }) === 400 && await code({ meta_json: 'kein json' }) === 400 && await code({ meta_json: '42' }) === 400, 'Titel, issue_md, meta_json fehlerhaft → 400');
  ok(await code({ zip_b64: '' }) === 400 && await code({ zip_b64: '!!!' }) === 400 && await code({ zip_b64: Buffer.from('kein zip, nur Text, lang genug für 22').toString('base64') }) === 400, 'ZIP leer, kein Base64 oder ohne ZIP-Kennung → 400');
  ok((await post('/chefing-issue.php', '{kaputt')).status === 400 && (await post('/chefing-issue.php', '[1]')).status === 400, 'kaputtes JSON oder Liste → 400');
  ok((await post('/chefing-issue.php', '{}', 'text/plain')).status === 415, 'anderer Inhaltstyp → 415');
  ok((await post('/anderes.php', JSON.stringify(gut))).status === 404, 'POST an eine andere Adresse → 404');
  const vorher = fs.readdirSync(ablage).length;
  const spam = await post('/chefing-issue.php', JSON.stringify({ ...gut, website: 'http://spam.example' }));
  ok(spam.status === 200 && (await spam.json()).ok === true && fs.readdirSync(ablage).length === vorher, 'Honeypot: „ok“, aber nichts gespeichert');
  // ein ZIP, das sich nicht entpacken lässt, wird trotzdem als Meldung abgelegt (Text bleibt erhalten) und markiert
  const kaputtZip = Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(40, 1)]).toString('base64');
  const rk = await post('/chefing-issue.php', JSON.stringify({ ...gut, titel: 'Kaputtes ZIP', zip_b64: kaputtZip }));
  const ik = (await rk.json()).id;
  ok(rk.status === 200 && fs.existsSync(path.join(ablage, ik, 'FEHLER-ZIP.txt')) && fs.existsSync(path.join(ablage, ik, 'issue.md')), 'ZIP nicht entpackbar: Meldung bleibt (issue.md, meta.json) und FEHLER-ZIP.txt erklärt es');
  const ids = fs.readdirSync(ablage);
  ok(new Set(ids).size === ids.length && ids.every((n) => fs.statSync(path.join(ablage, n)).isDirectory()), 'jede Meldung hat einen eigenen Ordner');
} finally {
  proc.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
