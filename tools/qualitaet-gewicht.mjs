// Wirkung der Qualitätsnote auf die Mengen (T51): wie stark verschöbe ein gewichteter Median die Rollen-Mengen?
//   node tools/qualitaet-gewicht.mjs
// Vergleicht je Variante und Methoden-Zelle den rohen mit dem nach Note gewichteten Median (corpus.js, `gewichtet`).
// Schaltet nichts um: der Standard steht in corpus.js (`QUALITAET_GEWICHTET`) und ist aus, bis die Noten aussagekräftiger sind.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { stats, normalizeRecipe, QUALITAET_GEWICHTET } = await import(new URL('model/corpus.js', wurzel));
const ing = lies('data/ingredients.json');
const archs = lies('data/archetypes.json');
const zeilen = [];
let gesamt = 0;
for (const [ak, a] of Object.entries(archs)) {
  if (ak.startsWith('_')) continue;
  const rollen = a.rollen.map((x) => x.rolle);
  const referenz = a.rollen.find((x) => x.referenz)?.rolle ?? 'struktur';
  for (const [vk, v] of Object.entries(a.varianten)) {
    const norm = lies(`data/corpus/${v.korpus}.json`).map((x) => normalizeRecipe(x, ing, { rollen, referenz }));
    const roh = stats(norm, rollen, { gewichtet: false });
    const gew = stats(norm, rollen, { gewichtet: true });
    const zellen = [[vk, roh, gew], ...Object.keys(roh.proMethode).map((m) => [`${vk}/${m}`, roh.proMethode[m], gew.proMethode[m]])];
    for (const [name, r, g] of zellen) for (const rolle of rollen) {
      const x = r.bp[rolle];
      const y = g.bp[rolle];
      if (!x || !y || !(x.median > 0)) continue;
      gesamt++;
      const rel = Math.abs(y.median - x.median) / x.median;
      if (rel > 1e-9) zeilen.push({ rel, text: `${name}/${rolle} (n = ${r.n}): ${x.median.toFixed(2)} → ${y.median.toFixed(2)}` });
    }
  }
}
zeilen.sort((a, b) => b.rel - a.rel);
const f = (x) => (x * 100).toFixed(1).replace('.', ',');
console.log(`Gewichtung nach Qualitätsnote: Standard in corpus.js ist ${QUALITAET_GEWICHTET ? 'EIN' : 'AUS'}.`);
console.log(`${gesamt} Mengen-Zellen, ${zeilen.length} würden sich verschieben${zeilen.length ? `, am stärksten um ${f(zeilen[0].rel)} %` : ''}.`);
for (const z of zeilen.slice(0, 15)) console.log(`  ${f(z.rel).padStart(5)} %  ${z.text}`);
