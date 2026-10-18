// Substitutions-Freiheit je Rolle messen (T10, DR-030): welche Rollen lassen sich ohne Meldung tauschen?
//   node tools/rollen-freiheit.mjs
// Rechnet jede Option jeder Rolle gegen das Best-of-Preset (src/model/rollenFreiheit.js) und vergleicht mit dem Feld
// `substitution` in archetypes.json. Weicht es ab, dort nachtragen — der Test prüft dasselbe.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { stats, normalizeRecipe } = await import(new URL('model/corpus.js', wurzel));
const { rollenFreiheit } = await import(new URL('model/rollenFreiheit.js', wurzel));
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'modelle', 'temperaturen'];
const data = Object.fromEntries(names.map((n) => [n, lies(`data/${n}.json`)]));
const ks = {};
for (const [ak, a] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  const rollen = a.rollen.map((x) => x.rolle);
  const referenz = a.rollen.find((x) => x.referenz)?.rolle ?? 'struktur';
  for (const [vk, v] of Object.entries(a.varianten)) ks[vk] = stats(lies(`data/corpus/${v.korpus}.json`).map((x) => normalizeRecipe(x, data.ingredients, { rollen, referenz })), rollen);
}
let abweichungen = 0;
for (const [ak, a] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  console.log(`\n${a.label}`);
  const m = rollenFreiheit(ak, data, ks);
  for (const r of a.rollen) {
    const gemessen = m[r.rolle].stufe;
    const marke = (r.substitution ?? null) === gemessen ? '' : `  ← archetypes.json sagt „${r.substitution ?? 'fehlt'}“`;
    if (marke) abweichungen++;
    console.log(`  ${r.rolle.padEnd(13)} ${(gemessen ?? 'keine Wahl').padEnd(10)}${m[r.rolle].belege.length ? ' (' + m[r.rolle].belege.join('; ') + ')' : ''}${marke}`);
  }
}
console.log(abweichungen ? `\n${abweichungen} Abweichung(en) zwischen Messung und archetypes.json.` : '\nMessung und archetypes.json stimmen überein.');
process.exit(abweichungen ? 1 : 0);
