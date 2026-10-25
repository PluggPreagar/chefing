// T145: die Melden-Auswahl greift ins Ablauf-Diagramm (Schritt, Zutat, Pfeil einzeln) — Quelltext-Prüfung der Wahl-Logik
import fs from 'fs';
const fm = fs.readFileSync(new URL('../src/ui/fehlerMelden.js', import.meta.url), 'utf8');
const kp = fs.readFileSync(new URL('../src/ui/kompakt.js', import.meta.url), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

ok(/closest\('\[data-zutat\], \[data-schritt\]'\)/.test(fm) && /sv\.contains\(teil\)/.test(fm), 'ziel(): im Diagramm zählt das nächste Element mit data-zutat oder data-schritt, nicht der ganze Block');
ok(/el instanceof SVGElement/.test(fm) && /Math\.max\(r\.height, 16\)/.test(fm), 'kasten(): dünne SVG-Teile (Pfeil) bekommen mindestens 16 Pixel');
ok(/diagrammKennung/.test(fm) && /\[data-zutat="/.test(fm) && /\[data-schritt="/.test(fm), 'selektor(): Diagramm-Teile werden über ihre Kennung benannt statt über nth-of-type');
ok(/c\.diagramm = /.test(fm) && /Pfeil zu Schritt/.test(fm), 'umfeld(): die Meldung nennt Schritt, Zutat oder Pfeil');
ok(/data-schritt/.test(kp) && /data-zutat/.test(kp) && /kompakt-pfeilgruppe/.test(kp), 'kompakt.js trägt die Kennungen (T144)');

console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exit(fail ? 1 : 0);
