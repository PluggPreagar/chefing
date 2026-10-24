// DR-073: Kompakt-Ansicht — je Zeile ein Icon-Knoten, Zutaten rechts, Seitenstränge münden in ihren Zielschritt, Uhr/Ofen am Ende
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { stromModell } = await import(P + 'ui/flow.js');
const { kompaktModell } = await import(P + 'ui/kompakt.js');
const { ICONS } = await import(P + 'ui/icons.js');
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'orte', 'techniken', 'temperaturen', 'modelle', 'triebquellen', 'werkzeuge', 'zustaende'];
const data = Object.fromEntries(names.map((n) => [n, J(n)]));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const E = (w) => (w == null ? [] : [{ zutat: w, anteil: 1 }]);

function rechne(ak, vk, methode = null, techniken = {}) {
  const arch = data.archetypes[ak];
  const rollen = arch.rollen.map((r) => r.rolle);
  const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? rollen[0];
  const ks = Object.fromEntries(Object.entries(arch.varianten).map(([k, v]) => [k, stats(J('corpus/' + v.korpus).map((r) => normalizeRecipe(r, data.ingredients, { rollen, referenz })), rollen)]));
  const v = arch.varianten[vk];
  const z = {};
  for (const r of arch.rollen) z[r.rolle] = E(v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default);
  const c = compute({ archetyp: ak, gefaess: v.gefaess, methode, fixiert: { rollen: {}, zutaten: {} }, zutaten: z, techniken }, { ...data, arch }, ks);
  return { c, K: kompaktModell(stromModell(c.ablauf, data.orte, c.vessel), c.ablauf) };
}

// Invarianten über alle Archetypen × Varianten × Methoden, mit und ohne Eischnee
const probleme = [];
for (const [ak, arch] of Object.entries(data.archetypes).filter(([k]) => !k.startsWith('_'))) {
  for (const vk of Object.keys(arch.varianten)) {
    for (const m of arch.methoden) {
      for (const t of [{}, { eier_getrennt: true }]) {
        const { c, K } = rechne(ak, vk, m, t);
        const id = `${ak}/${vk}/${m}${t.eier_getrennt ? '+Eischnee' : ''}`;
        if (K.knoten.some((k) => !ICONS[k.icon])) probleme.push(`${id}: Knoten ohne Icon`);
        if (K.knoten.flatMap((k) => k.neu).some((n) => !ICONS[n.icon])) probleme.push(`${id}: Zutat ohne Icon`);
        const gezeigt = new Set(K.knoten.map((k) => k.i));
        const fehlt = c.ablauf.filter((s, i) => !gezeigt.has(i)).map((s) => s.key);
        if (fehlt.length) probleme.push(`${id}: Schritt fehlt ${fehlt.join(',')}`);
        if (K.kanten.some((e) => e.zu.zeile <= e.von.zeile && e.art !== 'quelle')) probleme.push(`${id}: Kante läuft nach oben`);
      }
    }
  }
}
ok(!probleme.length, 'jeder Schritt hat einen Knoten mit Icon, jede Zutat ein Icon, Kanten laufen nach unten' + (probleme.length ? ': ' + probleme.slice(0, 5).join('; ') : ''));

const { c, K } = rechne('ruehrteig', 'kastenkuchen', null, { eier_getrennt: true });
const k = (key) => K.knoten.find((x) => c.ablauf[x.i].key === key && x.art === 'aktion');
const schnee = k('eischnee_schlagen');
ok(schnee.spalte > 0 && k('aufschlagen').spalte === 0, 'Eischnee in einer Seitenspalte, Aufschlagen im Hauptstrom');
ok(K.kanten.some((e) => e.art === 'muendung' && e.von.strang === schnee.strang && c.ablauf[e.zu.i].key === 'eischnee_unterheben'), 'der Eischnee-Strang mündet ins Unterheben');
const letzter = K.knoten.at(-1);
ok(letzter.art === 'warten' && letzter.icon === 'ort_ofen', 'am Ende: Ofen');
ok(k('aufschlagen').neu.map((n) => n.rolle).join() === 'fett,suesse', 'Aufschlagen: Butter und Zucker fließen zu (mit Rolle für die Menge beim Antippen)');
ok(K.zeilen < c.ablauf.length + 3, `kompakt: ${K.zeilen} Zeilen für ${c.ablauf.length} Schritte`);

console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exit(fail ? 1 : 0);
