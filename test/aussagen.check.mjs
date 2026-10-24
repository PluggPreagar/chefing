// DR-074 (T103–T108): Aussagen mit Wirkung, Gewissheit und Beleg — Schema, strenge Nachweis-Pflicht für never/proven, Marken,
// Prüf-Priorität, Konsistenz, Vorschläge aus Rückmeldungen, Anbindung an die Engine.
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
const A = await import(P + 'model/aussagen.js');
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');
const { compute } = await import(P + 'model/engine.js');
const { grenzenBuendeln, grenzenBuendelnMitIds } = await import(P + 'model/bilanz.js');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'modelle', 'temperaturen', 'orte', 'techniken', 'triebquellen', 'werkzeuge', 'zustaende'];
const data = Object.fromEntries(names.map((n) => [n, J(n)]));
const tipps = J('tipps');
const daten = J('aussagen');
const { ids, strenge } = A.regelIdsAusDaten({ ...data, tipps });

// --- Skalen ----------------------------------------------------------------------------------------------------------------------
ok(A.GEWISSHEIT.join() === 'never,unlikely,maybe,likely,surely,proven', 'Gewissheit: sechs Stufen never … proven');
ok(A.WIRKUNG.join() === 'ohne_folge,leicht,spuerbar,ausfall', 'Wirkung: ohne Folge, leicht, spürbar, Ausfall');
ok(JSON.stringify(daten.skalen) === JSON.stringify({ wirkung: A.WIRKUNG, gewissheit: A.GEWISSHEIT, beleg_art: A.BELEG_ART, ziele: A.ZIELE }), 'aussagen.json nennt dieselben Skalen wie das Modul');

// --- Echte Daten ------------------------------------------------------------------------------------------------------------------
const fehler = A.validieren(daten, { regelIds: ids });
ok(fehler.length === 0, 'aussagen.json ist gültig' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''));
const frei = Object.keys(daten.regeln).filter((k) => k.startsWith('wissen:'));
const gebunden = Object.keys(daten.regeln).filter((k) => !k.startsWith('wissen:'));
ok(ids.size === 74 && gebunden.length === 74 && [...ids].every((i) => daten.regeln[i]), 'jede der 74 Regeln (Grenzen, Voraussetzungen, Erfahrungsregeln, Tipps) hat mindestens eine Aussage');
ok(frei.length === 7, 'sieben freie Eischnee-/Buttercreme-Aussagen (T108)');
ok(Object.values(daten.regeln).flat().every((a) => a.schaetzung === true && a.begruendung), 'alle heutigen Werte sind als Schätzung mit Begründung gekennzeichnet');
const extremImBestand = Object.values(daten.regeln).flat().filter((a) => a.gewissheit === 'never' || a.gewissheit === 'proven');
ok(extremImBestand.every((a) => a.beleg.art === 'gemessen' && A.nachweisGueltig(a.beleg.nachweis)), 'jede Aussage auf never/proven im Bestand trägt einen gültigen wissenschaftlichen Nachweis');
ok(['eischnee-kalte-geraete'].every((k) => daten.regeln['wissen:' + k][0].gewissheit === 'unlikely'), 'T108: kalte Geräte für Eischnee sind unlikely, nicht never (kein Nachweis)');
ok(daten.regeln['wissen:eischnee-eiweiss-kalt-stabiler'][0].gewissheit === 'maybe' && daten.regeln['wissen:eischnee-eiweiss-kalt-stabiler'][0].beleg.art === 'geruecht', 'T108: „kalt ist stabiler“ bleibt Gerücht und maybe');
ok(daten.regeln.eier_nicht_kalt[0].beleg.art === 'konsens' && daten.regeln.eier_nicht_kalt[0].gewissheit === 'likely', 'T104: eier_nicht_kalt = Konsens, likely (Tipp mit Evidenz 3)');
const tippEv = (id) => tipps.tipps.find((t) => t.id === id).evidenz;
ok(tipps.tipps.every((t) => { const a = daten.regeln[t.id][0]; return t.evidenz === 3 ? a.beleg.art === 'konsens' && a.gewissheit === 'likely' : t.evidenz === 2 ? a.beleg.art === 'konsens' && a.gewissheit === 'maybe' : a.beleg.art === 'geruecht' && a.gewissheit === 'maybe'; }), 'T104: evidenz 3 → Konsens/likely, 2 → Konsens/maybe, 1 → Gerücht/maybe');
ok(tippEv('ruehrteig-gerinnt-kalte-zutaten') === 3, 'Bezugsdatum stimmt: der Tipp zu kalten Eiern hat Evidenz 3');

// --- Strenge Nachweis-Pflicht (Nutzer-Vorgabe: never/proven nur mit wissenschaftlichem Beweis) ----------------------------------
const stud = { art: 'studie', peer_reviewed: true, volltext_gelesen: true, doi: '10.1000/test.2020.001', zitat: 'Mustermann, 2020, Foam stability of egg white, Test Journal', deckt_aussage: 'misst Schaumstabilität bei 4 und 20 Grad direkt' };
const mk = (gewissheit, beleg, extra = {}) => ({ regeln: { 'wissen:t': [{ ziel: 'stabilitaet', richtung: 'plus', wirkung: 'leicht', gewissheit, text: 'Testaussage über Eischnee', beleg: { art: 'gemessen', quellen: [{ site: 'x.org', stand: 'gelesen' }], ...beleg }, schaetzung: false, ...extra }] } });
const fehlerVon = (d) => A.validieren(d, { regelIds: ids });
ok(fehlerVon(mk('proven', { nachweis: stud })).length === 0, 'proven mit gültiger begutachteter Studie (DOI, Volltext gelesen) ist erlaubt');
ok(fehlerVon(mk('never', { nachweis: stud })).length === 0, 'never mit gültiger begutachteter Studie ist erlaubt');
ok(fehlerVon(mk('proven', {})).some((f) => /Nachweis/.test(f)), 'proven ohne Nachweis wird abgelehnt');
ok(fehlerVon(mk('never', {})).some((f) => /Nachweis/.test(f)), 'never ohne Nachweis wird abgelehnt');
ok(fehlerVon(mk('proven', { art: 'mechanismus', nachweis: stud })).length > 0, 'proven mit Belegart „mechanismus“ wird abgelehnt (verlangt „gemessen“)');
ok(fehlerVon(mk('proven', { art: 'konsens', quellen: [{ site: 'x.org', stand: 'gelesen' }] })).length > 0, 'proven auf Konsens vieler Ratgeber wird abgelehnt');
ok(fehlerVon(mk('proven', { nachweis: { ...stud, art: 'eigener_versuch' } })).some((f) => /studie/.test(f)), 'eigener Versuch ist kein wissenschaftlicher Beleg');
ok(fehlerVon(mk('proven', { nachweis: { ...stud, peer_reviewed: false } })).some((f) => /peer_reviewed/.test(f)), 'ohne Begutachtung (Preprint, Blog) wird abgelehnt');
ok(fehlerVon(mk('proven', { nachweis: { ...stud, volltext_gelesen: false } })).some((f) => /volltext/.test(f)), 'ohne gelesenen Volltext (nur Abstract oder Such-Zusammenfassung) wird abgelehnt');
ok(fehlerVon(mk('proven', { nachweis: { ...stud, doi: 'https://beispiel.de/studie' } })).some((f) => /doi/i.test(f)), 'ohne gültigen DOI wird abgelehnt');
ok(fehlerVon(mk('proven', { nachweis: { ...stud, deckt_aussage: '' } })).some((f) => /deckt_aussage/.test(f)), 'ohne Begründung, warum die Studie genau diese Aussage trägt, wird abgelehnt');
ok(fehlerVon(mk('proven', { rueckmeldungen: { n: 50, klappt: 49, nicht: 1 } })).length > 0, 'viele Rückmeldungen allein machen nichts „bewiesen“');
ok(fehlerVon(mk('never', { rueckmeldungen: { n: 50, klappt: 0, nicht: 50 } })).length > 0, 'viele Rückmeldungen allein machen nichts „nie“');
ok(fehlerVon(mk('surely', { nachweis: { ...stud, doi: 'kaputt' } })).length > 0, 'ein halb ausgefüllter Nachweis wird auch unterhalb von proven abgelehnt');

// --- Obergrenze der Gewissheit je Beleg ------------------------------------------------------------------------------------------
const mkArt = (art, gewissheit, extra = {}) => ({ regeln: { 'wissen:t': [{ ziel: 'gelingen', richtung: 'minus', wirkung: 'spuerbar', gewissheit, text: 'Testaussage über Butter', beleg: { art, quellen: [{ site: 'x.org', stand: 'gelesen' }], ...extra }, schaetzung: false }] } });
ok(fehlerVon(mkArt('geruecht', 'maybe')).length === 0 && fehlerVon(mkArt('geruecht', 'likely')).length > 0, 'Gerücht trägt höchstens maybe');
ok(fehlerVon(mkArt('konsens', 'likely')).length === 0 && fehlerVon(mkArt('konsens', 'surely')).length > 0, 'Konsens ohne Messung trägt höchstens likely');
ok(fehlerVon(mkArt('mechanismus', 'surely')).length === 0, 'Mechanismus darf surely sein');
ok(fehlerVon(mkArt('geruecht', 'unlikely')).length === 0, 'unlikely geht mit jedem Beleg (ein Gerücht darf als eher falsch eingestuft sein)');
ok(fehlerVon(mkArt('geruecht', 'surely', { rueckmeldungen: { n: 3, klappt: 0, nicht: 3 } })).length === 0, 'drei Rückmeldungen dürfen die Obergrenze bis surely heben');
ok(fehlerVon(mkArt('geruecht', 'surely', { rueckmeldungen: { n: 2, klappt: 0, nicht: 2 } })).length > 0, 'zwei Rückmeldungen reichen dafür nicht (MIN_BERICHT_N)');

// --- Weitere Schema-Fehler ---------------------------------------------------------------------------------------------------------
ok(A.validieren({ regeln: { gibt_es_nicht: [{ ziel: 'gelingen', richtung: 'minus', wirkung: 'leicht', gewissheit: 'maybe', beleg: { art: 'geruecht' } }] } }, { regelIds: ids }).some((f) => /keine Regel/.test(f)), 'unbekannte Regel-id wird gefunden');
ok(fehlerVon({ regeln: { 'wissen:t': [{ ...mkArt('geruecht', 'maybe').regeln['wissen:t'][0], ziel: 'gelingen' }, { ...mkArt('geruecht', 'maybe').regeln['wissen:t'][0], ziel: 'gelingen' }] } }).some((f) => /doppelt/.test(f)), 'doppelte Zielgröße in einer Regel wird gefunden');
ok(fehlerVon(mkArt('geruecht', 'sicherlich')).some((f) => /gewissheit/.test(f)), 'unbekannte Gewissheit wird gefunden');
ok(fehlerVon({ regeln: { 'wissen:t': [{ ...mkArt('geruecht', 'maybe').regeln['wissen:t'][0], beleg: { art: 'geruecht' } }] } }).some((f) => /quellen/.test(f)), 'freie Aussage ohne Quellen wird gefunden');
ok(fehlerVon({ regeln: { 'wissen:t': [{ ...mkArt('geruecht', 'maybe').regeln['wissen:t'][0], schaetzung: true }] } }).some((f) => /begruendung/.test(f)), 'Schätzung ohne Begründung wird gefunden');

// --- Marken, Priorität, Konsistenz ---------------------------------------------------------------------------------------------------
const m1 = A.markeFuer(['zucker_max_hart'], daten);
ok(m1 && m1.wirkung === 'ausfall' && m1.gewissheit && m1.schaetzung === true && /Beleg/.test(m1.titel), 'markeFuer: Wirkung, Gewissheit, Schätzung und Titel für eine Regel');
const mm = A.markeFuer(['zucker_max', 'eiweiss_min'], daten);
ok(mm && mm.wirkung === 'spuerbar', 'markeFuer: bei gebündelten Regeln zählt die höchste Wirkung');
ok(A.markeFuer(['gibt_es_nicht'], daten) === null && A.markeFuer([], daten) === null, 'markeFuer: ohne Aussage keine Marke');
const fake = { regeln: { a: [{ ziel: 'gelingen', richtung: 'minus', wirkung: 'spuerbar', gewissheit: 'maybe', beleg: { art: 'geruecht' } }], b: [{ ziel: 'gelingen', richtung: 'minus', wirkung: 'leicht', gewissheit: 'surely', beleg: { art: 'mechanismus' } }] } };
ok(A.markeFuer(['a'], fake).verdacht === true && A.markeFuer(['b'], fake).verdacht === false, 'unter „wahrscheinlich“ ist es ein Verdacht, ab „wahrscheinlich“ nicht');
const bund = A.markeFuer(['a', 'b'], fake);
ok(bund.gewissheit === 'maybe' && bund.wirkung === 'spuerbar', 'gebündelt zählt die niedrigste Gewissheit');
const prio = A.pruefPrioritaet({ regeln: { x: [{ ziel: 'gelingen', wirkung: 'ausfall', gewissheit: 'maybe', beleg: { art: 'geruecht' } }], y: [{ ziel: 'gelingen', wirkung: 'ausfall', gewissheit: 'proven', beleg: { art: 'gemessen' } }], z: [{ ziel: 'gelingen', wirkung: 'leicht', gewissheit: 'maybe', beleg: { art: 'geruecht' } }], w: [{ ziel: 'gelingen', wirkung: 'ohne_folge', gewissheit: 'maybe', beleg: { art: 'geruecht' } }] } });
ok(prio.map((p) => p.id).join() === 'x:gelingen,z:gelingen,w:gelingen,y:gelingen', 'Prüf-Priorität: viel Wirkung bei großer Unsicherheit zuerst');
ok(prio.find((p) => p.id === 'y:gelingen').prioritaet === 0 && prio.find((p) => p.id === 'w:gelingen').prioritaet === 0, 'Priorität 0 bei bewiesen und bei ohne Folge');
const kons = A.konsistenz({ regeln: { h1: [{ ziel: 'gelingen', wirkung: 'spuerbar', gewissheit: 'likely' }], h2: [{ ziel: 'gelingen', wirkung: 'ausfall', gewissheit: 'maybe' }], e1: [{ ziel: 'gelingen', wirkung: 'ohne_folge', gewissheit: 'likely' }] } }, new Map([['h1', 'hart'], ['h2', 'hart'], ['e1', 'empfohlen']]), new Set(['h1', 'h2', 'e1', 'offen']));
ok(kons.hartWirkung.map((x) => x.id).join() === 'h1' && kons.hartGewissheit.map((x) => x.id).join() === 'h2', 'Konsistenz: hart ohne Ausfall und hart unter likely werden gemeldet');
ok(kons.loeschkandidaten.join() === 'e1' && kons.unbewertet.join() === 'offen', 'Konsistenz: Löschkandidat und unbewertete Regel werden gemeldet');
const echt = A.konsistenz(daten, strenge, ids);
ok(echt.unbewertet.length === 0, 'echte Daten: keine Regel ohne Aussage');

// --- Rückmeldungen schärfen die Gewissheit (T107) -------------------------------------------------------------------------------------
const rd = { regeln: { r1: [{ ziel: 'gelingen', richtung: 'minus', gewissheit: 'maybe' }], r2: [{ ziel: 'gelingen', richtung: 'minus', gewissheit: 'surely' }], r3: [{ ziel: 'gelingen', richtung: 'minus', gewissheit: 'unlikely' }], r4: [{ ziel: 'gelingen', richtung: 'minus', gewissheit: 'proven' }], r5: [{ ziel: 'tempo', richtung: 'plus', gewissheit: 'maybe' }], r6: [{ ziel: 'gelingen', richtung: 'minus', gewissheit: 'never' }] } };
const v = A.gewissheitVorschlaege([{ id: 'r1', urteil: 'bestaetigt', n: 4 }, { id: 'r2', urteil: 'bestaetigt', n: 5 }, { id: 'r3', urteil: 'zu streng?', n: 3 }, { id: 'r4', urteil: 'zu streng?', n: 9 }, { id: 'r5', urteil: 'bestaetigt', n: 6 }, { id: 'r6', urteil: 'bestaetigt', n: 7 }, { id: 'r1', urteil: 'unklar', n: 8 }], rd);
ok(v.length === 1 && v[0].aussage === 'r1:gelingen' && v[0].von === 'maybe' && v[0].nach === 'likely', 'bestätigt hebt maybe auf likely');
ok(!v.some((x) => x.aussage === 'r2:gelingen'), 'surely wird durch Rückmeldungen nicht weiter angehoben (nie auf proven)');
ok(!v.some((x) => x.aussage === 'r3:gelingen'), 'unlikely wird durch Rückmeldungen nicht weiter abgesenkt (nie auf never)');
ok(!v.some((x) => ['r4:gelingen', 'r6:gelingen'].includes(x.aussage)), 'proven und never bleiben unangetastet');
ok(!v.some((x) => x.aussage.startsWith('r5')), 'Rückmeldungen betreffen nur das Gelingen, nicht Tempo, Volumen und Co.');
const v2 = A.gewissheitVorschlaege([{ id: 'r2', urteil: 'zu streng?', n: 4 }], rd);
ok(v2.length === 1 && v2[0].von === 'surely' && v2[0].nach === 'likely', '„zu streng?“ senkt surely auf likely');

// --- Engine: Marken je Grenz-Meldung (T105) -------------------------------------------------------------------------------------------
const arch = data.archetypes.ruehrteig;
const ks = {};
for (const [k, vv] of Object.entries(arch.varianten)) ks[k] = stats(J('corpus/' + vv.korpus).map((r) => normalizeRecipe(r, data.ingredients)));
const E = (w) => (w == null ? [] : [{ zutat: w, anteil: 1 }]);
const st = (variante, over = {}) => { const vv = arch.varianten[variante]; const z = {}; for (const r of arch.rollen) z[r.rolle] = E(vv.bestof[r.rolle] !== undefined ? vv.bestof[r.rolle] : r.default); Object.assign(z, over); return { archetyp: 'ruehrteig', gefaess: vv.gefaess, methode: null, fixiert: { rollen: {}, zutaten: {} }, zutaten: z }; };
const mix = (a, b) => [{ zutat: 'weizenmehl', anteil: a }, { zutat: 'speisestaerke', anteil: b }];
const mitAussagen = { ...data, aussagen: daten };
const c0 = compute(st('kastenkuchen', { struktur: mix(1, 4) }), data, ks);
ok(c0.marken && Object.keys(c0.marken).length === 0, 'ohne data.aussagen: keine Marken, aber kein Fehler');
const c1 = compute(st('kastenkuchen', { struktur: mix(1, 4) }), mitAussagen, ks);
const texte = [...c1.gruende, ...c1.warnungen];
const gemarkt = texte.filter((t) => c1.marken[t]);
ok(gemarkt.length > 0, 'Grenz-Meldungen tragen eine Marke (1 : 4 Mehl : Stärke)');
ok(gemarkt.every((t) => c1.marken[t].wirkung && c1.marken[t].gewissheit && c1.marken[t].titel), 'jede Marke nennt Wirkung, Gewissheit und Titel');
const c2 = compute(st('kastenkuchen'), mitAussagen, ks);
ok(Object.keys(c2.marken).length === 0 && c2.status !== 'invalid', 'Preset ohne Meldungen: keine Marken');
ok(c1.status === c0.status && JSON.stringify(c1.warnungen) === JSON.stringify(c0.warnungen) && JSON.stringify(c1.gruende) === JSON.stringify(c0.gruende), 'Marken ändern weder Status noch Meldungstexte');
const v1 = { hart: [{ id: 'a', groesse: 'wasser', ziel: 'fluessigkeit', text: 'A.', kurz: 'a' }, { id: 'b', groesse: 'eiweiss', ziel: 'fluessigkeit', text: 'B.', kurz: 'b' }], empfohlen: [] };
ok(grenzenBuendelnMitIds(v1).hart[0].ids.join() === 'a,b' && grenzenBuendeln(v1).hart[0] === grenzenBuendelnMitIds(v1).hart[0].text, 'grenzenBuendelnMitIds behält die ids; grenzenBuendeln liefert denselben Text');

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
