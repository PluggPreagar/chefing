// Rückmeldungen auswerten (T53, DR-027): Vierfeldertafel je Regel-id aus feedback-data/feedback.jsonl.
//   node tools/rueckmeldungen.mjs <feedback.jsonl> [--min 3]
// Jede Regel/Warnung ist eine Vorhersage; die Meldungen (1–5 Punkte) etikettieren sie:
//   Warnung gegeben + „klappt“ in ≥ 75 % → Regel zu streng?     Warnung gegeben + „klappt nicht“ in ≥ 50 % → bestätigt
//   keine Warnung + „klappt nicht“ in ≥ 30 % einer Variante/Methode → fehlende Regel?
// Meldungen mit eigenen Mengen zählen nicht für die Vorhersage, sie sind Kandidaten für neue Korpus-Rezepte.
// Ändert nichts automatisch: Grenzen, Regeln und Korpus bleiben Maintainer-Arbeit (wie bei Overrides und Fehlermeldungen).
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const { auswerten, klasseVon, MIN_BERICHT_N } = await import(new URL('model/rueckmeldung.js', wurzel));

const datei = process.argv[2];
if (!datei) { console.log('Aufruf: node tools/rueckmeldungen.mjs <feedback.jsonl> [--min N]'); process.exit(1); }
const minIdx = process.argv.indexOf('--min');
const minN = minIdx > 0 ? Number(process.argv[minIdx + 1]) : MIN_BERICHT_N;

const meldungen = [];
let kaputt = 0;
for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
  if (!zeile.trim()) continue;
  try { meldungen.push(JSON.parse(zeile)); } catch { kaputt++; }
}
const a = auswerten(meldungen, { minN });
const prozent = (t, k) => (t.n ? `${Math.round((t[k] / t.n) * 100)} %` : '—');

console.log(`${a.gesamt} Meldungen${kaputt ? ` (${kaputt} unlesbare Zeilen übersprungen)` : ''}, davon ${a.gueltig} mit den vorgeschlagenen Mengen, ${a.eigeneRezepte.length} mit eigenen Mengen.`);
console.log(`Schwelle für ein Urteil: mindestens ${minN} Meldungen je Regel.\n`);

console.log('Regeln, die dem Nutzer etwas gesagt haben (Warnung/Hinweis/Blockade/Modell):');
console.log('  id'.padEnd(36), 'n'.padStart(3), 'klappt'.padStart(8), 'geht so'.padStart(8), 'nicht'.padStart(8), '  Urteil');
for (const r of a.regeln) console.log(`  ${r.id}`.padEnd(36), String(r.n).padStart(3), prozent(r, 'klappt').padStart(8), prozent(r, 'abweichung').padStart(8), prozent(r, 'nicht').padStart(8), ' ', r.urteil);
if (!a.regeln.length) console.log('  (noch keine)');

console.log('\nRezepte ohne jede Meldung (hier zeigen sich fehlende Regeln):');
console.log('  Variante/Methode'.padEnd(36), 'n'.padStart(3), 'klappt'.padStart(8), 'geht so'.padStart(8), 'nicht'.padStart(8), '  Urteil');
for (const g of a.ohneWarnung) console.log(`  ${g.gruppe}`.padEnd(36), String(g.n).padStart(3), prozent(g, 'klappt').padStart(8), prozent(g, 'abweichung').padStart(8), prozent(g, 'nicht').padStart(8), ' ', g.urteil);
if (!a.ohneWarnung.length) console.log('  (noch keine)');

const zeige = (m) => `  ${m.bewertung}★ ${m.kontext?.variante}/${m.kontext?.methode} [${m.app}] ${JSON.stringify(m.kontext?.rollenBp)}${m.kommentar ? `\n     „${m.kommentar.replace(/\s+/g, ' ').slice(0, 200)}“` : ''}`;
if (a.fehlendeRegel.length) { console.log(`\nMisslungen ohne Warnung (${a.fehlendeRegel.length}) — Kandidaten für neue Regeln:`); a.fehlendeRegel.forEach((m) => console.log(zeige(m))); }
if (a.eigeneRezepte.length) { console.log(`\nMit eigenen Mengen (${a.eigeneRezepte.length}) — Kandidaten für neue Korpus-Rezepte:`); a.eigeneRezepte.forEach((m) => console.log(`${zeige(m)} → ${klasseVon(m.bewertung)}`)); }
