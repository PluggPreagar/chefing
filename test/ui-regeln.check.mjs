// docs/UI-REGELN.md: das kompilierte UI-Regelwerk. Prüft, dass es vollständig und nachprüfbar bleibt: jeder genannte DR existiert, die Regeln sind
// lückenlos nummeriert, die Kernregeln stehen im Dokument und im Code (nicht nur auf dem Papier).
import fs from 'fs';
const P = new URL('../', import.meta.url);
const lies = (p) => fs.readFileSync(new URL(p, P), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const regeln = lies('docs/UI-REGELN.md');
const drs = lies('docs/DECISIONS.md');

// --- Dokument ----------------------------------------------------------------------------------------------------------------------
const genannt = [...new Set([...regeln.matchAll(/DR-(\d{3})/g)].map((m) => m[1]))];
const fehlen = genannt.filter((n) => !new RegExp(`^## DR-${n} `, 'm').test(drs));
ok(genannt.length >= 10 && fehlen.length === 0, `jeder genannte DR existiert in DECISIONS.md (${genannt.length} geprüft)${fehlen.length ? ': fehlt DR-' + fehlen.join(', DR-') : ''}`);
const nummern = [...regeln.matchAll(/^- \*\*R(\d+)\*\*/gm)].map((m) => +m[1]);
ok(nummern.length >= 20 && nummern.every((n, i) => n === i + 1), `die Regeln R1 bis R${nummern.at(-1)} sind lückenlos nummeriert (${nummern.length} Regeln)`);
ok(/^## Dokumentierte Ausnahmen/m.test(regeln) && /DR-085/.test(regeln.split('## Dokumentierte Ausnahmen')[1]) && /DR-088/.test(regeln.split('## Dokumentierte Ausnahmen')[1]), 'die bekannten Ausnahmen (DR-085, DR-088) sind aufgeführt');
const verweise = [...regeln.matchAll(/`([\w./-]+\.(?:js|json|md|html|css))`/g)].map((m) => m[1]).filter((p) => /^(src|docs|test|tools)\//.test(p));
const fehlendeDateien = [...new Set(verweise)].filter((p) => !fs.existsSync(new URL(p, P)));
ok(fehlendeDateien.length === 0, `genannte Dateien gibt es${fehlendeDateien.length ? ': ' + fehlendeDateien.join(', ') : ''}`);

// --- Kernregeln im Code -----------------------------------------------------------------------------------------------------------
const html = lies('index.html'); const css = lies('style.css'); const main = lies('src/main.js'); const icons = lies('src/ui/icons.js');
ok(/<nav class="presets fluss"[^>]*>\s*<select id="archetyp-wahl"[\s\S]*?class="fluss-pfeil"/.test(html) && /class="top-leiste" role="toolbar"/.test(html), 'R5: Fluss in einer Zeile (Archetyp › Variante) und Werkzeugleiste rechts oben');
ok(/\.ablauf-kopf \.flach \{ border-color: transparent; background: transparent; \}/.test(css) && /\.ablauf-kopf \.flach:hover \{ border-color/.test(css), 'R13: flache Knöpfe, Rahmen nur beim Darüberfahren');
ok(!/class="[^"]*leiste-knopf[^"]*"[^>]*>[^<]+<\/button>/.test(html), 'R10: Knöpfe der Leiste haben keinen Text im Knopf');
ok(/ausrichtungAusSpeicher\(\{ neu: localStorage\.getItem\('chefing\.ausrichtung'\), alt: localStorage\.getItem\('chefing\.ablauf'\) \}\)/.test(main), 'R24: die frühere Wahl wird übernommen');
ok(/\$\('ablauf-ansicht'\)\?\.remove\(\)/.test(main) && /\$\('fehler-melden'\)\?\.remove\(\)/.test(main), 'R22: Rückfall für zwischengespeichertes Markup');
ok(['loeffel', 'besen', 'kochmuetze', 'vollbild', 'drehen', 'statistik', 'kandidaten'].every((k) => new RegExp(`\\b${k}: \\[`).test(icons)), 'R11: die Symbole liegen in icons.js');
ok(/\.knopfgruppe\[hidden\] \{ display: none; \}/.test(css) && /nav\.fluss \{ flex-direction: column/.test(css), 'R19: hidden bei Knopfgruppen und spezifischere Regel für den schmalen Fluss');
ok(/aria-haspopup="listbox"/.test(lies('src/ui/stufenMenue.js')) && /aria-haspopup="listbox"/.test(lies('src/ui/meldenMenue.js')), 'R20: beide Menüs haben die ARIA-Rollen für Listenauswahl');

// --- Verweise auf das Regelwerk ---------------------------------------------------------------------------------------------------
ok(/docs\/UI-REGELN\.md/.test(lies('README.md')), 'README verweist auf das Regelwerk');
// DR-117: ein verstecktes Diagramm bleibt versteckt, auch wenn eine Regel für .strom.ist-quer `display` setzt (R19)
{
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const setztDisplay = /\.strom\.ist-quer[^{]*\{[^}]*display:\s*(grid|block)/.test(css);
  ok(setztDisplay && /#flow\[hidden\], #kompakt\[hidden\] \{ display: none; \}/.test(css), 'R19: Regeln mit display für .strom.ist-quer (Spalten, Vollbild) gibt es, darum steht #flow[hidden], #kompakt[hidden] { display: none } dagegen (DR-117)');
}

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
