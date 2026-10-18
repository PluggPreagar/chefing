// Cache-Busting: Modul-Liste aktuell, Lade-Stub in index.html baut die Import-Map aus version.json.
import fs from 'fs';
import vm from 'vm';
import { moduleListe } from '../tools/manifest.mjs';

let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const lies = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const liste = moduleListe();
ok(JSON.stringify(JSON.parse(lies('src/manifest.json'))) === JSON.stringify(liste), `src/manifest.json nennt alle ${liste.length} Module (sonst: node tools/manifest.mjs)`);

// Jeder relative Import zeigt auf ein Modul der Liste (sonst würde er ohne ?v= aus dem Cache kommen)
let fehlt = [];
for (const f of liste) {
  for (const m of lies(f).matchAll(/from\s+'(\.[^']+)'/g)) {
    const ziel = new URL(m[1], 'http://x/' + f).pathname.slice(1);
    if (!liste.includes(ziel)) fehlt.push(`${f} → ${m[1]}`);
  }
}
ok(fehlt.length === 0, 'alle relativen Imports liegen in der Modul-Liste' + (fehlt.length ? ': ' + fehlt.join(', ') : ''));

const html = lies('index.html');
const stub = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
ok(!!stub && /id="css"/.test(html) && !/<script type="module"/.test(html), 'index.html lädt main.js nur über den Lade-Stub; Stylesheet hat id="css"');

// Stub gegen künstliche Umgebung laufen lassen
async function lauf(antworten) {
  const eingefuegt = []; const css = { href: './style.css' }; let geladen = null; const win = {};
  const ctx = {
    window: win, location: { href: 'https://h.net/chefing/' }, URL,
    fetch: async (u) => { const a = antworten[u]; if (!a) return { ok: false }; return { ok: true, json: async () => a.body, headers: { get: () => a.lm ?? null } }; },
    document: { head: { append: (e) => eingefuegt.push(e) }, createElement: () => ({}), getElementById: () => css },
    __import: (p) => { geladen = p; },
  };
  vm.runInNewContext(stub.replace("import('./src/main.js')", "__import('./src/main.js')"), ctx);
  await new Promise((r) => setTimeout(r, 20));
  return { eingefuegt, css, geladen, version: win.CHEFING_VERSION };
}

const r1 = await lauf({ './version.json': { body: { sha: 'abcdef0123456789', time: '2026-10-18 10:41:28 UTC' }, lm: 'Sun, 18 Oct 2026 20:03:41 GMT' }, './src/manifest.json': { body: ['src/main.js', 'src/model/a.js'] } });
const map = r1.eingefuegt[0] && JSON.parse(r1.eingefuegt[0].textContent);
ok(r1.eingefuegt[0]?.type === 'importmap' && map.imports['https://h.net/chefing/src/main.js'] === 'https://h.net/chefing/src/main.js?v=abcdef012345' && map.imports['https://h.net/chefing/src/model/a.js'].endsWith('a.js?v=abcdef012345'), 'mit version.json: Import-Map hängt ?v=<Version> an jedes Modul');
ok(r1.css.href === './style.css?v=abcdef012345', 'Stylesheet bekommt dieselbe Version');
ok(r1.geladen === './src/main.js' && r1.version.sha === 'abcdef0123456789' && r1.version.deployed === 'Sun, 18 Oct 2026 20:03:41 GMT', 'main.js wird nach der Map geladen; Version samt Deploy-Zeit (Last-Modified) steht in window.CHEFING_VERSION');

const r2 = await lauf({});
ok(r2.eingefuegt.length === 0 && r2.css.href === './style.css' && r2.geladen === './src/main.js' && r2.version === null, 'ohne version.json (lokal): keine Map, main.js lädt trotzdem');

const r3 = await lauf({ './version.json': { body: { sha: 'abc' } } });
ok(r3.eingefuegt.length === 0 && r3.geladen === './src/main.js', 'version.json da, aber manifest.json fehlt: keine halbe Map, App startet');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
