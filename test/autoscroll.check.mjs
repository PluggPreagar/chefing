// DR-112: Autoscroll beim Aufklappen eines Schritts. Die Rechnung (src/ui/autoScroll.js) wird ohne Browser geprüft, dazu die Anbindung.
import fs from 'fs';
const { scrollZiel, scrollBehaelter } = await import(new URL('../src/ui/autoScroll.js', import.meta.url).href);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// Inhaltskoordinaten; Bildhöhe 600, Rand 8
ok(scrollZiel({ vorOben: 300, jetztOben: 344, danachUnten: 640, sicht: 600 }) === 292, '1) der Schritt davor steht oben (Oberkante minus Rand), wenn der folgende Schritt dann noch sichtbar ist');
ok(scrollZiel({ vorOben: 300, jetztOben: 344, danachUnten: 920, sicht: 600 }) === 336, '2) bleibt der folgende Schritt unten unsichtbar, steht der aufgeklappte Schritt selbst oben');
ok(scrollZiel({ vorOben: 300, jetztOben: 344, danachUnten: 892, sicht: 600 }) === 292 && scrollZiel({ vorOben: 300, jetztOben: 344, danachUnten: 893, sicht: 600 }) === 336, 'Grenze: der folgende Schritt muss mit seiner Unterkante noch ins Bild passen');
ok(scrollZiel({ vorOben: null, jetztOben: 5, danachUnten: 100, sicht: 600 }) === 0 && scrollZiel({ jetztOben: 120, sicht: 600 }) === 112, 'erster Schritt (kein Schritt davor): der Schritt selbst oben; nie negativ');
ok(scrollZiel({ vorOben: 4, jetztOben: 50, danachUnten: 200, sicht: 600 }) === 0, 'ganz oben: nie unter null scrollen');
ok(scrollZiel({ vorOben: 300, jetztOben: 344, danachUnten: null, sicht: 600 }) === 292, 'ohne folgenden Schritt: der Schritt davor oben');

// Behälter: nächster Vorfahr, der senkrecht scrollt
const baum = (oy, scrollbar) => { const fest = { parentElement: null }; const mitte = { parentElement: fest, _oy: oy, scrollHeight: scrollbar ? 900 : 100, clientHeight: 100 }; const kind = { parentElement: mitte }; return { kind, mitte }; };
const fenster = { document: { body: null }, getComputedStyle: (e) => ({ overflowY: e._oy ?? 'visible' }) };
{ const b = baum('auto', true); ok(scrollBehaelter(b.kind, fenster) === b.mitte, 'Vorfahr mit overflow-y auto und Überhang ist der Behälter'); }
{ const b = baum('auto', false); ok(scrollBehaelter(b.kind, fenster) === null, 'overflow auto ohne Überhang scrollt nicht: dann die Seite'); }
{ const b = baum('hidden', true); ok(scrollBehaelter(b.kind, fenster) === null, 'overflow hidden zählt nicht'); }

// Anbindung
const kompakt = fs.readFileSync(new URL('../src/ui/kompakt.js', import.meta.url), 'utf8');
const flow = fs.readFileSync(new URL('../src/ui/flow.js', import.meta.url), 'utf8');
const man = fs.readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8');
ok(/import \{ scrolleNachAufklappen \} from '\.\/autoScroll\.js'/.test(kompakt) && /if \(!war && aktuell\)/.test(kompakt) && /scrolleNachAufklappen\(\{ vor: knoten\(K\.knoten\[i - 1\]\), jetzt: aktuell, danach: knoten\(K\.knoten\[i \+ 1\]\) \?\? root\.querySelector\('\.kompakt-svg'\) \}\)/.test(kompakt), 'Kompakt (Symbole): nur beim Aufklappen, Schritt davor, Schritt selbst, folgender Schritt (oder das Ende der Zeichnung)');
ok(/focus\(\{ preventScroll: true \}\)/.test(kompakt) && /altScroll/.test(kompakt) && /\.scrollTop = altScroll/.test(kompakt), 'Kompakt: der Fokus springt nicht selbst, die Scrollposition des Bildbereichs übersteht das Neuzeichnen');
ok(/import \{ scrolleNachAufklappen \} from '\.\/autoScroll\.js'/.test(flow) && /if \(neu && !quer\)/.test(flow) && /querySelector\('\.ist-details'\)/.test(flow) && /hover: \(z, i\) =>/.test(flow), 'Zeitleiste hochkant: nur beim Klick und nur beim Aufklappen, das Überfahren löst nichts aus');
ok(/src\/ui\/autoScroll\.js/.test(man), 'im Manifest');
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
