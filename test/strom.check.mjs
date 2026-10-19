// Ablauf als Strom + Zufluss (DR-039): Hauptstrom = Weg des Teigs, Zuflüsse = neue Zutaten, Seitenströme = Nebenplätze.
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { stromModell } = await import(P + 'ui/flow.js');
const { ICONS } = await import(P + 'ui/icons.js');
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'orte'];
const data = Object.fromEntries(names.map((n) => [n, J(n)]));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const E = (w) => (w == null ? [] : [{ zutat: w, anteil: 1 }]);
const orte = Object.keys(data.orte).filter((k) => !k.startsWith('_'));

// Daten: jede Operation und jeder Inline-Schritt nennt Arbeitsplatz und Tätigkeitswort; Icons gibt es
const schritte = [
  ...Object.entries(data.operations).filter(([k]) => !k.startsWith('_')),
  ...Object.values(data.methods).flatMap((m) => (Array.isArray(m.sequenz) ? m.sequenz : []).filter((e) => typeof e === 'object').map((e) => [e.key, e])),
];
const ohne = schritte.filter(([, o]) => !orte.includes(o.ort) || !o.aktion).map(([k]) => k);
ok(ohne.length === 0, `${schritte.length} Operationen/Inline-Schritte haben ort (aus orte.json) und aktion` + (ohne.length ? ': ' + ohne.join(', ') : ''));
const falschUeber = Object.entries(data.methods).filter(([k]) => !k.startsWith('_')).flatMap(([k, m]) => Object.values(m.orte || {}).filter((o) => !orte.includes(o)).map((o) => `${k}:${o}`));
ok(falschUeber.length === 0, 'methods.orte nennt nur Arbeitsplätze aus orte.json' + (falschUeber.length ? ': ' + falschUeber.join(', ') : ''));
const iconFehlt = orte.flatMap((k) => [data.orte[k].icon, ...Object.values(data.orte[k].icon_familie || {})]).filter((i) => !ICONS[i]);
ok(iconFehlt.length === 0, 'jedes Arbeitsplatz-Icon steht in icons.js' + (iconFehlt.length ? ': ' + iconFehlt.join(', ') : ''));
ok(['topf', 'tasse', 'schaelchen', 'schuessel_2'].every((k) => data.orte[k].neben) && ['schuessel', 'flaeche', 'gefaess', 'ofen'].every((k) => !data.orte[k].neben), 'Nebenplätze: Topf, Tasse, Schälchen, Schüssel 2; Hauptstrom: Schüssel, Fläche, Gefäß, Ofen');

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
  return { c, M: stromModell(c.ablauf, data.orte, c.vessel), z };
}

// Invarianten über alle Archetypen × Varianten × Methoden (je mit und ohne Einlage)
const probleme = [];
let n = 0;
for (const [ak, arch] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  for (const vk of Object.keys(arch.varianten)) for (const m of arch.methoden) for (const over of [{}, { einlage: E('rosinen') }]) {
    const { c, M, z } = rechne(ak, vk, m, over);
    const tag = `${ak}/${vk}/${m}${over.einlage ? '+Rosinen' : ''}`;
    n++;
    const idx = M.zeilen.map((r) => r.i);
    if (new Set(idx).size !== c.ablauf.length || idx.length !== c.ablauf.length) probleme.push(`${tag}: nicht jeder Schritt genau einmal`);
    // Ein Seitenstrom steht direkt vor dem Hauptschritt, in den er mündet, und dieser hängt (über Nebenschritte) von ihm ab
    M.zeilen.forEach((r, k) => {
      if (r.strom !== 'neben') return;
      const zielZeile = M.zeilen.slice(k).find((x) => x.strom === 'haupt');
      const haengt = (j, nr) => c.ablauf[j].nach.includes(nr) || c.ablauf[j].nach.some((v) => M.zeilen.find((x) => x.i === v - 1)?.strom === 'neben' && haengt(v - 1, nr));
      if (!zielZeile || !zielZeile.zufluss || !haengt(zielZeile.i, c.ablauf[r.i].nr)) probleme.push(`${tag}: ${c.ablauf[r.i].key} mündet nicht in den folgenden Hauptschritt`);
    });
    const haupt = M.zeilen.filter((r) => r.strom === 'haupt');
    if (!haupt[0]?.hauptStart || !haupt.at(-1)?.hauptEnde) probleme.push(`${tag}: Hauptstrom ohne Anfang/Ende`);
    if (M.zeilen.some((r) => r.modus === 'zu' && !r.neu.length)) probleme.push(`${tag}: Zufluss ohne Zutaten`);
    const belegt = Object.entries(z).filter(([, e]) => e.length).length;
    const gezeigt = M.zeilen.flatMap((r) => r.neu).length;
    if (gezeigt !== belegt) probleme.push(`${tag}: ${gezeigt} Zutaten gezeigt, ${belegt} Rollen belegt`);
    if (M.zeilen.flatMap((r) => r.neu).some((x) => !data.kategorien[x.kategorie])) probleme.push(`${tag}: Zutat ohne Kategorie-Icon`);
  }
}
ok(probleme.length === 0, `${n} Kombinationen: jeder Schritt einmal, Seitenströme münden in den nächsten Hauptschritt, jede belegte Rolle genau einmal als Zufluss` + (probleme.length ? ': ' + probleme.join('; ') : ''));

const zeig = (c, M) => console.log('# ' + M.zeilen.map((r) => `${c.ablauf[r.i].key}[${r.strom === 'neben' ? 'neben:' : ''}${r.ort.key}${r.modus === 'zu' ? ',zu' : ''}${r.zufluss ? ',←' + r.zufluss.key : ''}]`).join(' '));
let { c, M } = rechne('hefeteig', 'hefezopf', 'hefe_direkt', { einlage: E('rosinen') });
zeig(c, M);
const at = (k) => M.zeilen.find((r) => c.ablauf[r.i].key === k);
const reihe = M.zeilen.map((r) => c.ablauf[r.i].key);
ok(reihe.indexOf('hefe_ansetzen') === reihe.indexOf('kneten') - 1 && at('hefe_ansetzen').strom === 'neben' && at('kneten').zufluss?.key === 'tasse', 'Hefezopf: Hefe lösen (Tasse) als Seitenstrom direkt vor Kneten, mündet dort');
ok(at('einlegen').strom === 'neben' && reihe.indexOf('einlegen') === reihe.indexOf('einlage_unterheben') - 1 && at('einlegen').neu.map((x) => x.label).join() === 'Rosinen', 'Hefezopf: Rosinen im Schälchen münden ins Unterheben');
ok(at('kneten').modus === 'zu' && at('gehen').modus === 'auf' && at('gehen').neu.length === 0, 'Kneten ist Zufluss (Mehl, Salz …), Gehen sitzt auf dem Strom');
ok(at('formen').neuerOrt && at('formen').ort.key === 'flaeche' && at('stueckgare').ort.label === 'Backblech' && at('stueckgare').ort.icon === 'ort_blech' && at('backen').ort.key === 'ofen' && at('backen').hauptEnde, 'Strom wechselt Schüssel → Arbeitsfläche → Backblech (Blech-Icon) → Ofen');
ok(at('hefe_ansetzen').hauptOrt === null && at('einlegen').hauptOrt?.key === 'schuessel', 'Seitenstrom vor dem ersten Hauptschritt: noch kein Hauptstrom daneben; danach läuft die Schüssel daneben weiter');

({ c, M } = rechne('ruehrteig', 'muffin', 'muffin', { fett: E('butter') }));
zeig(c, M);
ok(at('trocken_mischen').strom === 'haupt' && at('schmelzen').strom === 'neben' && at('schmelzen').ort.key === 'topf' && at('verquirlen').strom === 'neben' && at('verquirlen').neuerOrt && at('unterheben_kurz').zufluss?.key === 'schuessel_2', 'Muffin mit Butter: Topf → Schüssel 2 als ein Seitenstrom, mündet ins Unterheben');
ok(M.zeilen.find((r) => c.ablauf[r.i].key === 'fuellen').ort.icon === 'ort_muffinform', 'Muffinform bekommt ihr eigenes Icon');

({ c, M } = rechne('hefeteig', 'weissbrot', 'hefe_kalt'));
ok(at('gehen').ort.key === 'kuehlschrank' && at('gehen').strom === 'haupt' && at('gehen').neuerOrt, 'Kalte Führung: der Strom geht durch den Kühlschrank');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'creme'));
ok(!M.mitNeben && M.zeilen.every((r) => r.strom === 'haupt') && at('aufschlagen').modus === 'zu' && at('fuellen').ort.key === 'gefaess', 'Crememethode ohne Einlage: ein Strom ohne Seitenstrom');
({ c, M } = rechne('pfannkuchen', 'eierkuchen', 'pfannkuchen_glatt'));
ok(M.zeilen.at(-1).ort.icon === 'ort_pfanne' && !M.zeilen.some((r) => r.ort.key === 'ofen'), 'Pfannkuchen enden in der Pfanne, ohne Ofen');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
