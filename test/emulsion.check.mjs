// Emulsions-Modell (DR-047, T77): durchgehende Phase und Zugabe je Schritt, Warnung bei „auf einmal“ in eine luftige Basis
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { emulsionsVerlauf } = await import(P + 'model/emulsion.js');
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'orte', 'techniken', 'temperaturen', 'modelle'];
const data = Object.fromEntries(names.map((n) => [n, J(n)]));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const E = (w) => (w == null ? [] : [{ zutat: w, anteil: 1 }]);

// Daten: Felder nur mit erlaubten Werten
const alleOps = [...Object.entries(data.operations).filter(([k]) => !k.startsWith('_')).map(([, o]) => o), ...Object.values(data.methods).flatMap((m) => (Array.isArray(m.sequenz) ? m.sequenz : []).filter((e) => typeof e === 'object')), ...Object.values(data.techniken).filter((t) => t.schritte).flatMap((t) => Object.values(t.schritte))];
const falsch = alleOps.filter((o) => (o.phase && !['fett', 'wasser'].includes(o.phase)) || (o.emulsion && (!['fett', 'wasser'].includes(o.emulsion.gibt) || !['portionsweise', 'strahl', 'auf_einmal'].includes(o.emulsion.zugabe))));
ok(falsch.length === 0 && alleOps.filter((o) => o.phase || o.emulsion).length >= 8, `${alleOps.filter((o) => o.phase || o.emulsion).length} Schritte mit phase/emulsion, alle Werte gültig`);

// Kern: Basis, fremde Phase, Problem
const v = emulsionsVerlauf([
  { op: { phase: 'fett', luft: true }, label: 'Aufschlagen' },
  { op: { emulsion: { gibt: 'wasser', zugabe: 'portionsweise' } }, label: 'Eier einzeln' },
  { op: { emulsion: { gibt: 'wasser', zugabe: 'auf_einmal' } }, label: 'Milch auf einmal' },
  { op: { emulsion: { gibt: 'fett', zugabe: 'auf_einmal' } }, label: 'mehr Butter' },
  { op: {}, label: 'Füllen' },
]);
ok(v[0].text.startsWith('Fett ist die durchgehende Phase') && v[1].text === 'Wasser in Fett, portionsweise' && !v[1].problem && /gerinnt/.test(v[2].problem) && !v[3].problem && v[4] === null, 'Wasser in Fett portionsweise ok; auf einmal → Warnung „gerinnt“; gleiche Phase und Schritte ohne Feld ohne Warnung');
ok(/Schaum fällt/.test(emulsionsVerlauf([{ op: { phase: 'wasser', luft: true }, label: 'Schaum' }, { op: { emulsion: { gibt: 'fett', zugabe: 'auf_einmal' } }, label: 'Öl' }])[1].problem) && !emulsionsVerlauf([{ op: { phase: 'wasser' }, label: 'Verquirlen' }, { op: { emulsion: { gibt: 'fett', zugabe: 'auf_einmal' } }, label: 'Öl' }])[1].problem, 'Fett auf einmal in luftigen Schaum → „Schaum fällt“; ohne Luft keine Warnung');

const ksVon = {};
function rechne(ak, vk, methode, over = {}, techniken = {}) {
  const arch = data.archetypes[ak];
  const rollen = arch.rollen.map((r) => r.rolle);
  const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? rollen[0];
  ksVon[ak] ??= Object.fromEntries(Object.entries(arch.varianten).map(([k, x]) => [k, stats(J('corpus/' + x.korpus).map((r) => normalizeRecipe(r, data.ingredients, { rollen, referenz })), rollen)]));
  const x = arch.varianten[vk];
  const z = {};
  for (const r of arch.rollen) z[r.rolle] = E(x.bestof[r.rolle] !== undefined ? x.bestof[r.rolle] : r.default);
  Object.assign(z, over);
  return compute({ archetyp: ak, gefaess: x.gefaess, methode, fixiert: { rollen: {}, zutaten: {} }, zutaten: z, techniken }, { ...data, arch }, ksVon[ak]);
}
// Alle mitgelieferten Methoden sind in sich stimmig: keine Emulsions-Warnung
const warn = [];
for (const [ak, arch] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  for (const vk of Object.keys(arch.varianten)) for (const m of arch.methoden) for (const t of [{}, { eier_getrennt: true }]) {
    const c = rechne(ak, vk, m, {}, t);
    if (c.regelIds.some((r) => r.startsWith('emulsion:'))) warn.push(`${ak}/${vk}/${m}`);
  }
}
ok(warn.length === 0, 'keine Methode verteilt eine Phase auf einmal in eine luftige Basis' + (warn.length ? ': ' + warn.join(', ') : ''));

const em = (c, k) => c.ablauf.find((s) => s.key === k)?.emulsion?.text;
let c = rechne('ruehrteig', 'kastenkuchen', 'creme');
ok(em(c, 'eier_einzeln') === 'Wasser in Fett, portionsweise' && em(c, 'unterheben_abwechselnd') === 'Wasser in Fett, portionsweise' && /Fett ist die durchgehende/.test(em(c, 'aufschlagen')), 'Crememethode: Fett durchgehend, Ei und Milch portionsweise (Wasser in Fett)');
c = rechne('ruehrteig', 'kastenkuchen', 'ruehroel', { fett: E('pflanzenoel') });
ok(em(c, 'oel_einlaufen') === 'Fett in Wasser, im dünnen Strahl', 'Rühr-Öl: Öl im dünnen Strahl in den Eischaum (Fett in Wasser)');
c = rechne('ruehrteig', 'kastenkuchen', 'schaummasse');
ok(em(c, 'butter_zuletzt') === 'Fett in Wasser, portionsweise' && /Wasser ist die durchgehende Phase und hält/.test(em(c, 'ei_zucker_warm')), 'Schaummasse: Eischaum durchgehend, Butter portionsweise (Fett in Wasser)');
c = rechne('ruehrteig', 'kastenkuchen', 'creme', {}, { eier_getrennt: true });
ok(em(c, 'eier_einzeln') === 'Wasser in Fett, portionsweise', 'Eier getrennt: das Eigelb kommt weiter portionsweise in die Fettbasis');

// Eine falsch beschriebene Methode fällt auf
const kaputt = JSON.parse(JSON.stringify(data));
kaputt.methods.creme.sequenz.find((s) => s.key === 'eier_einzeln').emulsion.zugabe = 'auf_einmal';
const arch = kaputt.archetypes.ruehrteig;
const z = Object.fromEntries(arch.rollen.map((r) => [r.rolle, E(arch.varianten.kastenkuchen.bestof[r.rolle] !== undefined ? arch.varianten.kastenkuchen.bestof[r.rolle] : r.default)]));
const ck = compute({ archetyp: 'ruehrteig', gefaess: arch.varianten.kastenkuchen.gefaess, methode: 'creme', fixiert: { rollen: {}, zutaten: {} }, zutaten: z }, { ...kaputt, arch }, ksVon.ruehrteig);
ok(ck.regelIds.includes('emulsion:eier_einzeln') && ck.warnungen.some((w) => /gerinnt/.test(w)), 'Eier auf einmal in die Butter-Zucker-Creme → Warnung „gerinnt“ mit Regel-Id');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
