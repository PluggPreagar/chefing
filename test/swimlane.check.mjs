// Swimlane-Ablauf (DR-038): Arbeitsplatz je Schritt, Zeit-Slots, Zutaten dort, wo sie in den Ablauf kommen.
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { swimlaneLayout, zeilen } = await import(P + 'ui/flow.js');
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'orte'];
const data = Object.fromEntries(names.map((n) => [n, J(n)]));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const E = (w) => (w == null ? [] : [{ zutat: w, anteil: 1 }]);
const orte = Object.keys(data.orte).filter((k) => !k.startsWith('_'));

// Daten: jede Operation und jeder Inline-Schritt nennt Arbeitsplatz und Tätigkeitswort
const schritte = [
  ...Object.entries(data.operations).filter(([k]) => !k.startsWith('_')).map(([k, o]) => [k, o]),
  ...Object.values(data.methods).flatMap((m) => (Array.isArray(m.sequenz) ? m.sequenz : []).filter((e) => typeof e === 'object').map((e) => [e.key, e])),
];
const ohne = schritte.filter(([, o]) => !orte.includes(o.ort) || !o.aktion).map(([k]) => k);
ok(ohne.length === 0, `${schritte.length} Operationen/Inline-Schritte haben ort (aus orte.json) und aktion` + (ohne.length ? ': ' + ohne.join(', ') : ''));
const falschUeber = Object.entries(data.methods).filter(([k]) => !k.startsWith('_')).flatMap(([k, m]) => Object.values(m.orte || {}).filter((o) => !orte.includes(o)).map((o) => `${k}:${o}`));
ok(falschUeber.length === 0, 'methods.orte nennt nur Arbeitsplätze aus orte.json' + (falschUeber.length ? ': ' + falschUeber.join(', ') : ''));

const ksVon = {};
function rechne(archKey, vk, methode, over = {}) {
  const arch = data.archetypes[archKey];
  const rollen = arch.rollen.map((r) => r.rolle);
  const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? rollen[0];
  ksVon[archKey] ??= Object.fromEntries(Object.entries(arch.varianten).map(([k, v]) => [k, stats(J('corpus/' + v.korpus).map((r) => normalizeRecipe(r, data.ingredients, { rollen, referenz })), rollen)]));
  const v = arch.varianten[vk];
  const z = {};
  for (const r of arch.rollen) z[r.rolle] = E(v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default);
  Object.assign(z, over);
  const c = compute({ archetyp: archKey, gefaess: v.gefaess, methode, fixiert: { rollen: {}, zutaten: {} }, zutaten: z }, { ...data, arch }, ksVon[archKey]);
  return { c, L: swimlaneLayout(c.ablauf, data.orte, c.vessel), z };
}

// Invarianten über alle Archetypen × Varianten × Methoden
const probleme = [];
let n = 0;
for (const [ak, arch] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  for (const vk of Object.keys(arch.varianten)) for (const m of arch.methoden) {
    const { c, L, z } = rechne(ak, vk, m);
    const tag = `${ak}/${vk}/${m}`;
    n++;
    const zellen = c.ablauf.map((s, i) => `${L.bahn[i]}|${L.spalte[i]}`);
    if (new Set(zellen).size !== zellen.length) probleme.push(`${tag}: zwei Schritte in einer Zelle`);
    c.ablauf.forEach((s, i) => { if (s.nach.some((nr) => L.spalte[nr - 1] >= L.spalte[i])) probleme.push(`${tag}: ${s.key} nicht rechts vom Vorgänger`); });
    if (L.bahn.some((b) => b < 0)) probleme.push(`${tag}: Schritt ohne Swimlane`);
    const belegt = Object.entries(z).filter(([, e]) => e.length).length;
    const gezeigt = L.neu.flat().length;
    if (gezeigt !== belegt) probleme.push(`${tag}: ${gezeigt} Zutaten gezeigt, ${belegt} Rollen belegt`);
  }
}
ok(probleme.length === 0, `${n} Kombinationen: je Zelle ein Schritt, Pfeile nur nach rechts, jede belegte Rolle genau einmal als Zutat` + (probleme.length ? ': ' + probleme.join('; ') : ''));

// Hefeteig direkt mit Rosinen: Hefe in der Tasse, Rosinen im Schälchen, beide parallel am Start
let { c, L } = rechne('hefeteig', 'hefezopf', 'hefe_direkt', { einlage: E('rosinen') });
const at = (k) => { const i = c.ablauf.findIndex((s) => s.key === k); return { lane: L.bahnen[L.bahn[i]]?.key, col: L.spalte[i], neu: L.neu[i], i }; };
console.log('# ' + L.bahnen.map((b) => b.label).join(' | ') + ' — ' + c.ablauf.map((s, i) => `${s.key}@${L.bahnen[L.bahn[i]].key}:${L.spalte[i]}`).join(' '));
ok(at('hefe_ansetzen').lane === 'tasse' && at('einlegen').lane === 'schaelchen' && at('hefe_ansetzen').col === 0 && at('einlegen').col === 0, 'Hefezopf: Hefe lösen (Tasse) und Rosinen einlegen (Schälchen) starten parallel');
ok(at('kneten').lane === 'schuessel' && at('kneten').col === 1 && at('formen').lane === 'flaeche' && at('stueckgare').lane === 'gefaess' && at('backen').lane === 'ofen', 'Hefezopf: Kneten in der Schüssel, Formen auf der Fläche, Gare im Gefäß, Backen im Ofen');
ok(L.bahnen.find((b) => b.key === 'gefaess')?.label === 'Backblech', 'Gefäß-Zeile heißt wie das gewählte Gefäß, ohne Klammerzusatz');
ok(at('einlegen').neu.join() === 'Rosinen' && at('gehen').neu.length === 0, 'Zutaten nur beim ersten Auftreten (Rosinen beim Einlegen, beim Gehen keine)');
ok(L.bahnen.map((b) => b.key).indexOf('tasse') < L.bahnen.map((b) => b.key).indexOf('schuessel'), 'Reihenfolge der Swimlanes aus orte.json (Nebenplätze über der Schüssel)');

// Muffin: Flüssiges in der zweiten Schüssel, parallel zum Trockenen (methods.orte)
({ c, L } = rechne('ruehrteig', 'muffin', 'muffin'));
ok(at('verquirlen').lane === 'schuessel_2' && at('trocken_mischen').lane === 'schuessel' && at('verquirlen').col === at('trocken_mischen').col, 'Muffin: Verquirlen in Schüssel 2, gleicher Slot wie Trockenes mischen');
({ c, L } = rechne('ruehrteig', 'kastenkuchen', 'ruehroel'));
ok(at('verquirlen').lane === 'schuessel', 'Rühr-Öl: Verquirlen ohne Überschreibung in der Hauptschüssel');

// Kalte Führung: Gehen im Kühlschrank
({ c, L } = rechne('hefeteig', 'weissbrot', 'hefe_kalt'));
ok(at('gehen').lane === 'kuehlschrank', 'Kalte Führung: Gehen im Kühlschrank');

ok(zeilen('Weizenmehl, Zucker, Salz, Butter, Ei, Milch, Frischhefe', 24, 2).length === 2 && zeilen('Weizenmehl, Zucker, Salz, Butter, Ei, Milch, Frischhefe', 24, 2)[1].endsWith('…') && zeilen('Rosinen', 24, 2).join() === 'Rosinen', 'Zutaten-Text bricht auf zwei Zeilen um und kürzt mit …');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
