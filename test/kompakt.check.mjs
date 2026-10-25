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

// --- Variante „mit Namen“ (DR-081) --------------------------------------------------------------------------------------------------
const { umbrechen, knotenTexte, namenLayout, NAMEN } = await import(P + 'ui/kompakt.js');
ok(umbrechen('eins zwei drei', 20).join('|') === 'eins zwei drei' && umbrechen('eins zwei drei', 8).join('|') === 'eins|zwei|drei' && umbrechen('eins zwei drei', 9).join('|') === 'eins zwei|drei', 'umbrechen: an Leerzeichen, so viele Wörter wie passen');
ok(umbrechen('Supercalifragilistic', 8).join('|') === 'Supercal|ifragili|stic' && umbrechen('', 8).join('|') === '' && umbrechen('  ', 8).length === 1 && umbrechen(null, 8)[0] === '', 'umbrechen: zu langes Wort wird hart geteilt, leerer Text gibt eine leere Zeile');
ok(umbrechen('a b c d e f g h i j', 5).every((z) => z.length <= 5), 'umbrechen: keine Zeile länger als das Maximum');
for (const [label, techn] of [['ohne Eischnee', {}], ['mit Eischnee', { eier_getrennt: true }]]) {
  const { c: cc, K: KK } = rechne('ruehrteig', 'kastenkuchen', null, techn);
  const max = 34;
  const texte = knotenTexte(KK, cc.ablauf, cc, max);
  const alle = [...texte.values()].flatMap((t) => [...t.titel, ...t.zutaten.flatMap((z) => z.zeilen)]);
  ok(texte.size === KK.knoten.length && alle.every((z) => z.length <= max), `Namen (${label}): Text für jeden Knoten, keine Zeile länger als ${max} Zeichen`);
  const aufschl = KK.knoten.find((x) => cc.ablauf[x.i].key === 'aufschlagen' && x.art === 'aktion');
  const ta = texte.get(aufschl);
  ok(ta.titel.join(' ').startsWith('1. ') && /Butter/.test(ta.zutaten[0].zeilen.join(' ')) && /\d+ g/.test(ta.zutaten[0].zeilen.join(' ')) && ta.zutaten.length === 2, `Namen (${label}): Aufschlagen nennt Schritt mit Nummer, Butter und Zucker mit Menge`);
  const lay = namenLayout(KK, texte);
  let vorher = 6; let sauber = true; const reihenfolge = [];
  for (let z = 0; z < KK.zeilen; z++) for (const x of KK.knoten.filter((n) => n.zeile === z)) reihenfolge.push(x);
  for (const x of reihenfolge) {
    const g = lay.geo.get(x);
    if (g.von !== vorher || !(g.cy > g.von) || !(g.bis >= g.von + NAMEN.ROW) || g.titelY.at(-1) >= g.bis || g.zutaten.some((zz) => zz.top < g.titelY.at(-1) || zz.top + zz.h > g.bis)) sauber = false;
    vorher = g.bis;
  }
  ok(sauber && lay.hoehe === vorher + 6 && lay.geo.size === KK.knoten.length, `Namen (${label}): Blöcke liegen lückenlos untereinander, Text und Zutaten bleiben im Block`);
  ok(KK.kanten.every((e) => lay.geo.get(e.zu).cy > lay.geo.get(e.von).cy || e.art === 'quelle'), `Namen (${label}): Kanten laufen weiter nach unten`);
}
const kompaktMain = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const kompaktCss = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
ok(/id: 'kompakt-namen'/.test(kompaktMain) && /chefing\.kompaktNamen/.test(kompaktMain) && /renderKompakt\(\$\('kompakt'\), computed, data, \{ namen: kompaktNamen \}\)/.test(kompaktMain) && /\$\('kompakt-namen'\)\.hidden = !kompakt/.test(kompaktMain), 'main.js: Beschriftung der Kompakt-Ansicht nur in der Kompakt-Ansicht sichtbar (auch bei Auto), Wahl je Browser, Vorgabe Text');
// Nutzer-Meldung 20261025-074508: die Beschriftung nennt die beiden Zustände (Text | Symbole), nicht „mit Namen“; zwei Möglichkeiten = Knopfgruppe (DR-079)
ok(/wert: 'true', icon: 'beschriftung_text', name: 'Text'/.test(kompaktMain) && /wert: 'false', icon: 'beschriftung_symbole', name: 'Symbole'/.test(kompaktMain) && /attr: 'namen'/.test(kompaktMain) && !/mit Namen'/.test(kompaktMain) && !/type: 'checkbox', checked: kompaktNamen/.test(kompaktMain), 'Gruppe „Text | Symbole“ als flache Symbole (DR-090) statt des Häkchens „mit Namen“');
ok(/name: 'Beschriftung der Kompakt-Ansicht'/.test(kompaktMain) && /setAttribute\('aria-pressed', String\(an\)\)/.test(kompaktMain) && /setAttribute\('aria-label', k\.name\)/.test(kompaktMain), 'Gruppe hat einen Namen für Vorlesegeräte, jeder Knopf ein aria-label, der gewählte aria-pressed');
ok(/\.kompakt-svg\.mit-namen \{[^}]*width: 100%/.test(kompaktCss) && /\.kompakt-titel \{[^}]*font-size: 13px/.test(kompaktCss) && /\.kompakt-zutatentext/.test(kompaktCss), 'style.css: Namen-Variante füllt die Breite, Schrift 13 px');

// --- T144: Details unter dem Schritt in der Symbole-Ansicht ------------------------------------------------------------------------
const kompaktSrc = fs.readFileSync(new URL('../src/ui/kompakt.js', import.meta.url), 'utf8');
ok(/data-schritt': k\.i/.test(kompaktSrc) && /'data-zutat'/.test(kompaktSrc) && /kompakt-pfeilgruppe/.test(kompaktSrc) && /kompakt-treffer/.test(kompaktSrc), 'Kennungen: data-schritt an Knoten, Pfeil und Detail, data-zutat an Zutaten (Grundlage für T145)');
ok(/knopf\(g, k, \(\) => umschalten\(k\)\)/.test(kompaktSrc) && /knopf\(pfeil, k, \(\) => umschalten\(k\)\)/.test(kompaktSrc) && /knopf\(z, k, \(\) => umschalten\(k\)\)/.test(kompaktSrc) && /aria-expanded/.test(kompaktSrc), 'Symbole: Schritt, Zutat und Pfeil klappen denselben Schritt auf und zu, aria-expanded');
ok(/\.kompakt-treffer \{[^}]*stroke: transparent/.test(kompaktCss) && /\.kompakt-detail \{/.test(kompaktCss), 'style.css: unsichtbare Trefferfläche für den Pfeil, Rahmen für das Detail');
{
  // Die Text-Fassung unter dem Schritt ist dieselbe wie in der Namen-Variante und liegt im Block unterhalb der Knotenzeile
  const { c: cc, K: KK } = rechne('ruehrteig', 'kastenkuchen', null, {});
  const t = knotenTexte(KK, cc.ablauf, cc, 30);
  const aufschl = KK.knoten.find((x) => cc.ablauf[x.i].key === 'aufschlagen' && x.art === 'aktion');
  ok(t.get(aufschl).titel.join(' ').startsWith('1. ') && t.get(aufschl).zutaten.length === 2, 'Detail: Schritt mit Nummer, dazu Butter und Zucker mit Menge');
}

console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exit(fail ? 1 : 0);
