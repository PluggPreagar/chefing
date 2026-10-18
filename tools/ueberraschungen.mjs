// Überraschungs-Bericht aus dem Korpus (T54): „sollte nicht klappen, tat es aber“ — nach jedem Korpus-Zuwachs ausführen.
//   node tools/ueberraschungen.mjs [--json] [--reserve 0.2] [--gaerung 2.5]
// 1) Grenzen am Rand (trägt ein einzelnes Rezept eine Grenze?)  2) Rezepte, die das Gärmodell verfehlen, mit Gruppen-Mustern
// 3) Eigenschaften, die bei den Überraschungen häufiger vorkommen als im Korpus. Liest nur, ändert nichts.
// Der Korpus enthält nur Erfolge — „sollte klappen, tat es nicht“ zeigen nur Rückmeldungen (T53, tools/rueckmeldungen.mjs).
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { ueberraschungenSuchen } = await import(new URL('model/ueberraschungen.js', wurzel));

const archetypes = lies('data/archetypes.json');
const korpora = {};
for (const [ak, arch] of Object.entries(archetypes)) {
  if (ak.startsWith('_')) continue;
  korpora[ak] = Object.fromEntries(Object.entries(arch.varianten).map(([vk, v]) => [vk, lies(`data/corpus/${v.korpus}.json`)]));
}
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : undefined; };
const schwellen = {};
if (arg('--reserve') != null) schwellen.reserve = arg('--reserve');
if (arg('--gaerung') != null) schwellen.gaerungFaktor = arg('--gaerung');
const b = ueberraschungenSuchen({
  archetypes, ingredients: lies('data/ingredients.json'), grenzen: lies('data/grenzen.json'), modelle: lies('data/modelle.json'), korpora,
  methods: lies('data/methods.json'), operations: lies('data/operations.json'), temperaturen: lies('data/temperaturen.json'),
}, schwellen);

if (process.argv.includes('--json')) { console.log(JSON.stringify(b, null, 2)); process.exit(0); }

const p = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');
const proz = (x) => `${p(x * 100, 0)} %`;
console.log(`${b.rezepte} Korpus-Rezepte geprüft. Schwellen: Grenzen-Reserve ≤ ${proz(b.schwellen.reserve)}, Gärmodell ×${b.schwellen.gaerungFaktor}.\n`);

console.log('1) Grenzen am Rand (kleine Reserve = ein Korpus-Rezept liegt dicht an der Grenze)');
if (!b.grenzen.length) console.log('   (keine)');
for (const g of b.grenzen) {
  const flag = [g.verletzt ? 'VERLETZT' : null, g.getragenVonEinem ? 'getragen von einem Rezept' : null, g.amKorpusGelockert ? 'am Korpus gelockert' : null].filter(Boolean).join(', ');
  console.log(`   ${g.archetyp}/${g.id} (${g.strenge}, ${g.art} ${p(g.grenze)}): ${g.extrem.id} liegt bei ${p(g.extrem.wert)} → Reserve ${proz(g.reserve)}${g.zweiter ? `, nächstes: ${p(g.zweiter.wert)}` : ''}; ${g.nahe} Rezept(e) im Randbereich${flag ? ` — ${flag}` : ''}`);
}

console.log('\n2) Gärmodell (Hefe × Zeit × Temperatur)');
if (!b.gaerung) console.log('   (kein Modell in modelle.json)');
else {
  console.log(`   ${b.gaerung.gepruefte} Rezepte geprüft, ${b.gaerung.auffaellig.length} weichen um mehr als ×${b.schwellen.gaerungFaktor} ab:`);
  for (const r of b.gaerung.auffaellig) console.log(`   ×${p(r.faktor)}  ${r.id}  (${p(r.hefe)} % Hefe, ${p(r.T / 60)} Std. bei ${p(r.temp ?? 0)} °C, ${r.methode}; Modell erwartet ${p(r.erwartet / 60)} Std.)`);
  console.log('   Gruppen:');
  for (const g of b.gaerung.gruppen) console.log(`   ${g.gruppe.padEnd(22)} n = ${String(g.n).padStart(2)}, Median ×${p(g.median)}${g.systematisch ? `  ← SYSTEMATISCH: ${g.richtung} (fehlende Größe vermuten; die Temperatur steckt schon im Modell)` : ''}`);
}

console.log(`\n3) Muster bei den Gärmodell-Abweichlern (verglichen mit allen ${b.gaerung?.gepruefte ?? 0} vom Gärmodell geprüften Rezepten, getrennt nach Richtung)`);
if (!b.gaerung) console.log('   (kein Gärmodell)');
else for (const [titel, liste, n] of [['Rezepte brauchen LÄNGER als das Modell', b.gaerung.muster.zuLang, b.gaerung.muster.nZuLang], ['Rezepte brauchen KÜRZER als das Modell', b.gaerung.muster.zuKurz, b.gaerung.muster.nZuKurz]]) {
  console.log(`   ${titel} (${n} Rezepte):`);
  if (!liste.length) console.log('     (keine Eigenschaft fällt auf)');
  for (const m of liste) console.log(`     ${m.eigenschaft.padEnd(28)} ${m.nAuffaellig} von ${n} (${proz(m.anteilAuffaellig)}) gegenüber ${proz(m.anteilVergleich)} der geprüften Rezepte — ${p(m.lift)}× häufiger`);
}
console.log('\nHinweis: Muster sind Anhaltspunkte, kein Beweis (kleine Zahlen); der Korpus enthält nur Erfolge.');
