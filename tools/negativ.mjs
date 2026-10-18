// Negativ-Korpus gegen die Regeln halten (T55, DR-029): wären die dokumentierten Misserfolge vorher aufgefallen?
//   node tools/negativ.mjs [--json]
// Zeigt je Fall, welche Grenzen, Korpus-Toleranzen und Gärmodell-Warnungen angeschlagen hätten, dann die Zusammenfassung:
// Falsch-Negative (misslungen, keine Warnung) = fehlende Regeln, Falsch-Alarme (Kontrollfall, Warnung) = zu strenge Regeln.
// Liest nur, ändert nichts. Der Korpus enthält nur Erfolge; diese Fälle sind klein und durch Selbstauswahl verzerrt.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { negativPruefen } = await import(new URL('model/negativ.js', wurzel));

const archetypes = lies('data/archetypes.json');
const korpora = {};
for (const [ak, arch] of Object.entries(archetypes)) {
  if (ak.startsWith('_')) continue;
  korpora[ak] = Object.fromEntries(Object.entries(arch.varianten).map(([vk, v]) => [vk, lies(`data/corpus/${v.korpus}.json`)]));
}
const faelle = lies('data/negativ.json').faelle;
const b = negativPruefen({
  faelle, archetypes, ingredients: lies('data/ingredients.json'), grenzen: lies('data/grenzen.json'), modelle: lies('data/modelle.json'), korpora,
  methods: lies('data/methods.json'), operations: lies('data/operations.json'), temperaturen: lies('data/temperaturen.json'),
});
if (process.argv.includes('--json')) { console.log(JSON.stringify(b, null, 2)); process.exit(0); }

const p = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');
console.log('Negativ-Korpus: dokumentierte Misserfolge gegen die Regeln\n');
for (const z of b.faelle) {
  const rolle = z.kontrolle ? 'KONTROLLE' : z.ausgenommen ? `${z.ergebnis}, nicht gezählt` : `${z.ergebnis}, Ursache ${z.ursacheArt ?? '?'}`;
  if (!z.geprueft) { console.log(`- ${z.id} [${rolle}]: nicht prüfbar (${z.grund})`); continue; }
  const teile = [
    ...z.grenzen.map((g) => `Grenze ${g.id} (${g.strenge}, ${p(g.wert)})`),
    ...z.toleranz.map((t) => `außerhalb des Korpus: ${t.groesse} ${p(t.wert)}`),
    ...(z.gaerung?.art ? [`Gärmodell: ${z.gaerung.art} (${p(z.gaerung.hefeBp)} % Hefe, ${p(z.gaerung.gare / 60)} Std. bei ${p(z.gaerung.temp ?? 0)} °C, erwartet ${p(z.gaerung.erwartet / 60)} Std.)`] : []),
  ];
  const urteil = z.kontrolle ? (z.erkannt ? 'FALSCH-ALARM' : 'ok (keine Warnung)') : (z.erkannt ? (z.ursacheGetroffen ? 'erkannt (über die genannte Ursache)' : 'erkannt (aus anderem Grund)') : 'FALSCH-NEGATIV');
  console.log(`- ${z.id} [${rolle}, Verlässlichkeit ${z.verlaesslichkeit}]: ${urteil}${teile.length ? ' — ' + teile.join('; ') : ''}${z.unbekannt.length ? ` | nicht gerechnet: ${z.unbekannt.join(', ')}` : ''}`);
}
const s = b.zusammenfassung;
const m = s.mengeUrsache;
console.log(`\n${s.gesamt} Fälle, ${s.geprueft} prüfbar. Misserfolge mit Mengenursache: ${m.erkannt} von ${m.geprueft} erkannt, davon ${m.ueberUrsache} über die Ursache, die die Quelle nennt (weitere ${m.nichtPruefbar.length} nicht prüfbar: ${m.nichtPruefbar.join(', ') || '—'}).`);
console.log(`Alle prüfbaren Misserfolge: ${s.erkannt} von ${s.misserfolge} erkannt${s.falschNegativ.length ? `; Falsch-Negative: ${s.falschNegativ.join(', ')}` : ''}. Ohne Mengenursache (Prozess oder offen): ${s.prozessOderOffen.map((x) => `${x.id} (${x.ursacheArt}, ${x.erkannt ? 'trotzdem erkannt' : 'nicht erkannt'})`).join('; ') || '—'}.`);
if (s.ausgenommen.length) console.log(`Nicht gezählt: ${s.ausgenommen.map((x) => `${x.id} (${x.erkannt ? 'Warnung' : 'keine Warnung'}) — ${x.grund}`).join('; ')}.`);
console.log(`Kontrollfälle: ${s.kontrollen}, Falsch-Alarme: ${s.falschAlarm.length}${s.falschAlarm.length ? ' (' + s.falschAlarm.join(', ') + ')' : ''}.`);
console.log(`Nicht prüfbar (keine oder zu wenige Mengen): ${s.nichtPruefbar.join(', ') || '—'}.`);
console.log('\nHinweis: Tassen und Löffel sind in Gramm umgerechnet (Schätzwerte); Prozess-Fehler (Übergare, Knetzeit, Ofen) sieht nur das Gärmodell.');
