// Ablauf als Strom + Zufluss in Slots (DR-039, DR-043): Hauptstrom = Weg des Teigs, Zuflüsse = neue Zutaten, Seitenstränge = Nebenplätze, je Slot eine Aktion.
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { stromModell, fmtSlot } = await import(P + 'ui/flow.js');
const { ICONS } = await import(P + 'ui/icons.js');
const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'orte', 'techniken', 'temperaturen', 'modelle'];
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
function rechne(archKey, vk, methode, over = {}, techniken = {}) {
  const arch = data.archetypes[archKey];
  const rollen = arch.rollen.map((r) => r.rolle);
  const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? rollen[0];
  ksVon[archKey] ??= Object.fromEntries(Object.entries(arch.varianten).map(([k, v]) => [k, stats(J('corpus/' + v.korpus).map((r) => normalizeRecipe(r, data.ingredients, { rollen, referenz })), rollen)]));
  const v = arch.varianten[vk];
  const z = {};
  for (const r of arch.rollen) z[r.rolle] = E(v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default);
  Object.assign(z, over);
  const c = compute({ archetyp: archKey, gefaess: v.gefaess, methode, fixiert: { rollen: {}, zutaten: {} }, zutaten: z, techniken }, { ...data, arch }, ksVon[archKey]);
  return { c, M: stromModell(c.ablauf, data.orte, c.vessel), z };
}

// Invarianten über alle Archetypen × Varianten × Methoden (mit/ohne Einlage, mit/ohne getrennte Eier), Regeln R1–R7 (DR-043)
const probleme = [];
let n = 0;
for (const [ak, arch] of Object.entries(data.archetypes)) {
  if (ak.startsWith('_')) continue;
  for (const vk of Object.keys(arch.varianten)) for (const m of arch.methoden) for (const over of [{}, { einlage: E('rosinen') }]) for (const tech of [{}, { eier_getrennt: true }]) {
    if (tech.eier_getrennt && !(data.methods[m].techniken || []).includes('eier_getrennt')) continue;
    const { c, M, z } = rechne(ak, vk, m, over, tech);
    const tag = `${ak}/${vk}/${m}${over.einlage ? '+Rosinen' : ''}${tech.eier_getrennt ? '+getrennt' : ''}`;
    n++;
    const P_ = M.plan;
    const aktionen = M.zeilen.filter((r) => r.art === 'aktion');
    const mitHand = c.ablauf.map((s, i) => i).filter((i) => c.ablauf[i].aktiv > 0);
    if (aktionen.length !== mitHand.length || new Set(aktionen.map((r) => r.i)).size !== aktionen.length) probleme.push(`${tag}: nicht jede Aktion genau eine Zeile`);
    // R1: je Slot höchstens eine Aktion, Aktionen überlappen nie
    for (let k = 1; k < aktionen.length; k++) if (P_.start[aktionen[k].i] < P_.aktivEnde[aktionen[k - 1].i] - 0.01) probleme.push(`${tag}: ${c.ablauf[aktionen[k].i].key} überlappt die Aktion davor`);
    // Abhängigkeiten: ein Schritt beginnt erst, wenn seine Vorgänger samt Wirkzeit fertig sind
    c.ablauf.forEach((s, i) => { if (s.nach.some((nr) => P_.fertig[nr - 1] > P_.start[i] + 0.01)) probleme.push(`${tag}: ${s.key} beginnt vor dem Ende eines Vorgängers`); });
    // R3/R5: reine Wartezeiten haben keinen Knopf, liegen aber in einer Uhr-Zeile
    c.ablauf.forEach((s, i) => { if (s.aktiv === 0 && s.wirk > 0 && !M.zeilen.some((r) => r.art === 'leer' && r.uhren.some((u) => u.i === i))) probleme.push(`${tag}: ${s.key} ohne Uhr`); });
    // Seitenstränge münden in ihren Zielschritt (Hauptstrom), der von ihnen abhängt
    for (const r of aktionen.filter((x) => x.strom === 'neben')) {
      const st = r.strang;
      const zielZeile = M.zeilen.findIndex((x) => x.art === 'aktion' && x.i === st?.ziel);
      if (!st || zielZeile <= M.zeilen.indexOf(r) || M.zeilen[zielZeile].zufluss !== st || M.zeilen[zielZeile].strom !== 'haupt') probleme.push(`${tag}: ${c.ablauf[r.i].key} mündet nicht`);
    }
    const haupt = M.zeilen.filter((r) => r.haupt);
    if (!haupt[0]?.haupt.start || !haupt.at(-1)?.haupt.ende) probleme.push(`${tag}: Hauptstrom ohne Anfang/Ende`);
    if (haupt.some((r, k) => k && r.haupt.dicke < haupt[k - 1].haupt.dicke)) probleme.push(`${tag}: Hauptstrom wird dünner`);
    if (M.zeilen.some((r) => [r.haupt, ...r.spuren].filter(Boolean).some((x) => x.dicke < 2 || x.dicke > 12))) probleme.push(`${tag}: Dicke außerhalb 2–12`);
    if (M.zeilen.some((r) => r.art === 'leer' && r.haupt?.aktiv)) probleme.push(`${tag}: leere Zeile mit durchgezogenem Hauptstrom`);
    // Keine Kreuzungen: ein Bogen kreuzt keine noch laufende innere Spur, ein Abzweig keine Spur dazwischen
    for (const r of M.zeilen) {
      for (const sp of r.spuren.filter((x) => x.mündet)) if (r.spuren.some((x) => x.spur < sp.spur && !x.mündet)) probleme.push(`${tag}: Bogen kreuzt eine laufende Spur`);
      for (const sp of r.spuren.filter((x) => x.quelle != null)) {
        const [a, b] = [Math.min(sp.quelle, sp.spur), Math.max(sp.quelle, sp.spur)];
        if (r.spuren.some((x) => x.spur > a && x.spur < b)) probleme.push(`${tag}: Abzweig kreuzt eine Spur`);
      }
    }
    if (aktionen.some((r) => r.modus === 'zu' && !r.neu.length)) probleme.push(`${tag}: Zufluss ohne Zutaten`);
    const belegt = Object.entries(z).filter(([, e]) => e.length).length;
    const chipsAlle = aktionen.flatMap((r) => r.neu);
    if (chipsAlle.filter((x) => !x.teil).length !== belegt) probleme.push(`${tag}: ${chipsAlle.filter((x) => !x.teil).length} Zutaten gezeigt, ${belegt} Rollen belegt`);
    if (chipsAlle.some((x) => !data.kategorien[x.kategorie] || !ICONS[x.icon])) probleme.push(`${tag}: Zutat ohne Kategorie-Icon`);
    if (Math.round(M.gesamt) !== c.zeit.gesamt || Math.round(M.vorlauf) !== c.zeit.vorlauf) probleme.push(`${tag}: Zeitleiste und Ablauf weichen ab`);
  }
}
ok(probleme.length === 0, `${n} Kombinationen: eine Aktion je Slot, Vorgänger fertig, Wartezeiten mit Uhr, Stränge münden, Dicke 2–12 und wachsend, jede Rolle einmal` + (probleme.length ? ': ' + probleme.join('; ') : ''));

const zeig = (c, M) => console.log('# ' + M.zeilen.map((r) => (r.art === 'aktion' ? `${fmtSlot(r.t0)} ${c.ablauf[r.i].key}[${r.strom === 'neben' ? `neben${r.strang.spur}:` : ''}${r.ort.key}${r.modus === 'zu' ? ',zu' : ''}${r.zufluss ? `,←${r.zufluss.spur}` : ''}]` : r.art === 'leer' ? `${fmtSlot(r.t0)} leer(${r.grund.map((i) => c.ablauf[i].key)})` : '|Start|')).join(' '));
let { c, M } = rechne('hefeteig', 'hefezopf', 'hefe_direkt', { einlage: E('rosinen') });
zeig(c, M);
const akt = (k) => M.zeilen.find((r) => r.art === 'aktion' && c.ablauf[r.i].key === k);
const leer = (k) => M.zeilen.find((r) => r.art === 'leer' && r.grund.some((i) => c.ablauf[i].key === k));
const iVon = (k) => c.ablauf.findIndex((s) => s.key === k);
ok(akt('einlegen').t0 < 0 && Math.abs(M.plan.fertig[iVon('einlegen')] - M.plan.start[iVon('einlage_unterheben')]) < 0.01 && M.vorlauf > 0 && M.zeilen.findIndex((r) => r.art === 'start') === 1, 'Hefezopf: Einlegen im Vorlauf, die Rosinen sind genau zum Unterheben gequollen (R6, Vorlauf B)');
ok(akt('hefe_ansetzen').t0 === 0 && akt('hefe_ansetzen').strom === 'neben' && akt('kneten').zufluss?.ort.key === 'tasse' && akt('kneten').modus === 'zu', 'Hefe lösen (Tasse) mündet ins Kneten, Kneten ist Zufluss');
ok(M.spuren === 2 && akt('einlegen').strang.spur !== akt('hefe_ansetzen').strang.spur && akt('kneten').spuren.some((s) => s.ort.key === 'schaelchen' && !s.aktiv), 'Zwei Seitenstränge gleichzeitig (Schälchen, Tasse) in eigenen Spuren; beim Kneten warten die Rosinen gestrichelt');
ok(!akt('gehen') && leer('gehen') && leer('stueckgare') && leer('backen') && akt('backen') && c.ablauf[iVon('backen')].handgriff === 'Einschieben', 'Gehen, Gare, Backen als leere Slots mit Uhr; Backen hat den Handgriff „Einschieben“');
ok(leer('stueckgare').haupt.ort.label === 'Backblech' && leer('backen').haupt.ort.key === 'ofen' && leer('gehen').haupt.ort.key === 'schuessel' && !leer('gehen').haupt.aktiv, 'Wartezeit im Behälter: Gehen in der Schüssel, Gare auf dem Blech, Backen im Ofen, gestrichelt');
ok(akt('einlage_unterheben').haupt.dicke > akt('kneten').haupt.dicke && akt('hefe_ansetzen').spuren.find((s) => s.ort.key === 'tasse').dicke < akt('kneten').haupt.dicke, 'Dicke = Menge: mit Rosinen dicker, Hefe-Milch dünner als der Teig');
ok(c.zeit.aktiv === Math.round(M.aktiv) && c.zeit.aktiv < 30 && c.zeit.vorlauf === Math.round(M.vorlauf), `Hände ${c.zeit.aktiv} Min., Vorlauf ${c.zeit.vorlauf} Min., gesamt ${c.zeit.gesamt} Min. ab Start`);

({ c, M } = rechne('ruehrteig', 'muffin', 'muffin', { fett: E('butter') }));
zeig(c, M);
ok(akt('trocken_mischen').strom === 'haupt' && akt('schmelzen').strom === 'neben' && akt('schmelzen').strang === akt('verquirlen').strang && akt('unterheben_kurz').zufluss === akt('verquirlen').strang, 'Muffin mit Butter: Topf → Schüssel 2 als ein Strang, mündet ins Unterheben');
ok(akt('fuellen').ort.icon === 'ort_muffinform', 'Muffinform bekommt ihr eigenes Icon');
({ c, M } = rechne('hefeteig', 'weissbrot', 'hefe_kalt'));
ok(leer('gehen').haupt.ort.key === 'kuehlschrank', 'Kalte Führung: der Teig wartet im Kühlschrank');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'creme'));
ok(M.spuren === 0 && akt('aufschlagen').modus === 'zu' && akt('fuellen').ort.key === 'gefaess', 'Crememethode ohne Einlage: ein Strom ohne Seitenstrang');
({ c, M } = rechne('pfannkuchen', 'eierkuchen', 'pfannkuchen_glatt'));
ok(akt('ausbacken').ort.icon === 'ort_pfanne' && akt('ausbacken').haupt.aktiv && !M.zeilen.some((r) => r.haupt?.ort.key === 'ofen') && leer('ruhen'), 'Eierkuchen: Ruhen als leerer Slot, Ausbacken aktiv in der Pfanne, kein Ofen');

// Eier getrennt als Technik (DR-040, DR-041): Trennen in der Tasse mit zwei Abflüssen — Eigelb in den Hauptstrom, Eiweiß in Schüssel 2
const G = { eier_getrennt: true };
({ c, M } = rechne('pfannkuchen', 'eierkuchen', 'pfannkuchen_glatt', {}, G));
zeig(c, M);
const schnee = akt('eischnee_schlagen').strang;
ok(c.zeit.gesamt === 52 && c.zeit.aktiv === 22 && akt('ei_trennen').t0 === 0 && akt('glatt_ruehren').t0 === 2 && leer('ruhen').t0 === 4 && akt('eischnee_schlagen').t0 === 34 && akt('ausbacken').t0 === 40, 'Eierkuchen + Eier getrennt wie in der Skizze: 0′ Trennen, 2′ Glatt rühren, 4′ leer (Ruhen), 34′ Schnee, 40′ Ausbacken, fertig 52′, Hände 22′');
ok(schnee.quelle === iVon('ei_trennen') && schnee.von === M.zeilen.indexOf(akt('ei_trennen')) && akt('ei_trennen').spuren.some((s) => s.quelle != null) && akt('glatt_ruehren').spuren.some((s) => s.ort.key === 'schuessel_2' && !s.aktiv), 'Zweiter Abfluss: das Eiweiß-Strang beginnt beim Trennen und wartet gestrichelt bis zum Schlagen');
ok(akt('glatt_ruehren').zufluss?.ort.key === 'tasse' && akt('eischnee_unterheben').zufluss === schnee && !akt('eischnee_schlagen').haupt.aktiv, 'Eigelb mündet ins Glatt rühren, Eischnee ins Unterheben; beim Schlagen wartet der Teig gestrichelt');
ok(akt('glatt_ruehren').neu.some((x) => x.label === 'Eigelb' && x.icon === 'eigelb') && akt('eischnee_schlagen').neu.map((x) => `${x.label}/${x.icon}`).join() === 'Eiweiß/eiweiss', 'Teile als eigene Zuflüsse: Eigelb (Schale + Punkt), Eiweiß (Ei ohne Punkt)');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'creme', {}, G));
ok(c.status !== 'invalid' && c.ablauf.find((s) => s.key === 'eier_einzeln').label === 'Eigelb einzeln einrühren' && akt('eier_einzeln').zufluss?.ort.key === 'tasse', 'Crememethode + Eier getrennt: Trennen mündet ins Einrühren („Eigelb einzeln einrühren“)');
ok(M.plan.start[iVon('eischnee_schlagen')] >= M.plan.aktivEnde[iVon('unterheben_abwechselnd')] - 0.01 && M.plan.start[iVon('eischnee_unterheben')] < M.plan.start[iVon('fuellen')], 'Eischnee erst nach dem Unterrühren (frisch), vor dem Einfüllen');
ok(c.regelIds.includes('technik:eier_getrennt') && c.anpassungen.some((a) => /lockert zusätzlich zum Trieb/.test(a)), 'Mit Backpulver: Hinweis „lockert zusätzlich“, Regel-Id für Rückmeldungen');
({ c, M } = rechne('ruehrteig', 'gugelhupf', 'creme', { einlage: E('rosinen') }, G));
ok(c.ablauf.find((s) => s.key === 'einlage_unterheben').nach.includes(c.ablauf.find((s) => s.key === 'eischnee_unterheben').nr) && M.plan.start[iVon('einlage_unterheben')] >= M.plan.aktivEnde[iVon('eischnee_unterheben')] - 0.01, 'Einlage kommt nach dem Eischnee (Kante mitgezogen)');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'creme', { trieb: [] }, G));
ok(c.status !== 'invalid' && c.anpassungen.some((a) => /allein aus dem Eischnee/.test(a)), 'Ohne Backpulver: Trieb allein aus Eischnee, mit Hinweis auf eierreiche Teige (2A, kein Faktor)');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'ruehroel', { fett: E('pflanzenoel') }, G));
ok(c.ablauf.find((s) => s.key === 'eier_zucker_schaumig')?.label === 'Eigelb + Zucker schaumig schlagen' && c.ablauf.some((s) => s.key === 'eischnee_unterheben'), 'Rühr-Öl + Eier getrennt: Eigelb + Zucker schaumig, Eischnee zuletzt');
({ c, M } = rechne('pfannkuchen', 'pancakes', 'pancake_kurz', {}, G));
ok(akt('pc_nass_verquirlen').neu.some((x) => x.label === 'Eigelb') && M.plan.start[iVon('eischnee_unterheben')] < M.plan.start[iVon('ausbacken')], 'Pancakes + Eier getrennt: Eigelb ins Nasse, Eischnee zuletzt');
ok(akt('pc_nass_verquirlen').neuerOrt && akt('ei_trennen').neuerOrt && akt('eischnee_schlagen').neuerOrt, 'Behälterwechsel im Strang zeigt den neuen Behälter (Tasse → Schüssel 2)');
ok(akt('pc_nass_verquirlen').ort.key === 'schuessel_2' && akt('eischnee_schlagen').ort.label === 'Schüssel 3' && rechne('pfannkuchen', 'eierkuchen', 'pfannkuchen_glatt', {}, G).c.ablauf.find((s) => s.key === 'eischnee_schlagen').ort === 'schuessel_2', 'Eischnee weicht in Schüssel 3 aus, wenn Schüssel 2 schon das Nasse hat (Pancakes); beim Eierkuchen bleibt er in Schüssel 2');
({ c, M } = rechne('ruehrteig', 'kastenkuchen', 'muffin', {}, G));
ok(!c.ablauf.some((s) => s.key === 'ei_trennen') && c.warnungen.some((w) => /passt nicht zur Methode „Muffin-Methode“/.test(w)), 'Muffin-Methode: Technik passt nicht, wird übergangen und gemeldet');

// Stufe je Variante (DR-042): typisch | moeglich | aus
const { technikStufe, wirksameTechniken } = await import(P + 'model/rules.js');
const stufe = (a, v) => technikStufe(data.archetypes[a], v, 'eier_getrennt');
ok(stufe('ruehrteig', 'gugelhupf') === 'typisch' && stufe('ruehrteig', 'kastenkuchen') === 'moeglich' && stufe('ruehrteig', 'muffin') === 'aus' && stufe('pfannkuchen', 'pancakes') === 'typisch' && stufe('pfannkuchen', 'eierkuchen') === 'moeglich' && stufe('hefeteig', 'hefezopf') === 'moeglich', 'Stufen: Gugelhupf und Pancakes typisch, Kastenkuchen und Eierkuchen möglich, Muffins aus; ohne Angabe möglich');
ok(JSON.stringify(wirksameTechniken(G, data.archetypes.ruehrteig, 'muffin')) === '{}' && wirksameTechniken(G, data.archetypes.ruehrteig, 'gugelhupf').eier_getrennt === true && JSON.stringify(wirksameTechniken({ eier_getrennt: false }, data.archetypes.ruehrteig, 'gugelhupf')) === '{}', 'wirksam: nur eingeschaltet und nicht „aus“');
({ c, M } = rechne('ruehrteig', 'muffin', 'creme', { fett: E('butter') }, G));
ok(!c.ablauf.some((s) => s.key === 'ei_trennen') && c.warnungen.some((w) => /bei Muffins nicht vorgesehen/.test(w)), 'Muffins (Stufe aus): Technik wird auch mit Crememethode nicht angewendet, mit Hinweis');
const schalterJeArchetyp = Object.entries(data.archetypes).filter(([k]) => !k.startsWith('_')).map(([k, a]) => [k, a.methoden.some((m) => (data.methods[m].techniken || []).includes('eier_getrennt'))]);
ok(JSON.stringify(schalterJeArchetyp) === '[["ruehrteig",true],["pfannkuchen",true],["hefeteig",false]]', 'Hefeteig kennt keine Methode mit getrennten Eiern: dort gibt es keinen Schalter');
ok(rechne('ruehrteig', 'kastenkuchen', null).c.methodKey === 'creme' && !rechne('ruehrteig', 'kastenkuchen', null).c.ablauf.some((s) => s.key === 'ei_trennen'), 'Ohne Schalter: unveränderte Crememethode');

// Zustand: Ausschalten gibt einer Pflicht-Rolle, die nur die Technik leer erlaubte, ihre Standard-Zutat zurück
const { technikPatch, presetPatch } = await import(P + 'model/zustand.js');
const ra = data.archetypes.ruehrteig;
const aus = technikPatch({ techniken: G, zutaten: { trieb: [], fett: E('butter') } }, ra, data.techniken.eier_getrennt, 'eier_getrennt', false);
ok(aus.techniken.eier_getrennt === false && aus.zutaten.trieb[0]?.zutat === 'backpulver' && aus.zutaten.fett[0].zutat === 'butter' && technikPatch({ techniken: {} }, ra, data.techniken.eier_getrennt, 'eier_getrennt', true).zutaten === undefined, 'Ausschalten: Backpulver kommt zurück; Einschalten ändert keine Zutat');
ok(JSON.stringify(presetPatch(ra, 'kastenkuchen').techniken) === '{}', 'Preset-Wechsel schaltet Techniken aus');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
