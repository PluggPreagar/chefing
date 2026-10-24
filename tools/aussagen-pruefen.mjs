// Aussagen prüfen (DR-074, T106): Validator, Verteilung, Prüf-Priorität und Konsistenz zu strenge. Ändert nichts.
//   node tools/aussagen-pruefen.mjs [--top 15]
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const { validieren, regelIdsAusDaten, pruefPrioritaet, konsistenz, WIRKUNG, GEWISSHEIT, BELEG_ART, WIRKUNG_TEXT, GEWISSHEIT_TEXT } = await import(new URL('model/aussagen.js', wurzel));
const J = (n) => JSON.parse(fs.readFileSync(new URL(`data/${n}.json`, wurzel), 'utf8'));
const data = Object.fromEntries(['grenzen', 'operations', 'methods', 'erfahrungsregeln', 'archetypes', 'triebquellen', 'modelle'].map((n) => [n, J(n)]));
data.tipps = J('tipps');
const aussagen = J('aussagen');
const { ids, strenge, mitVorbereitung, logisch } = regelIdsAusDaten(data);

const topIdx = process.argv.indexOf('--top');
const top = topIdx > 0 ? Number(process.argv[topIdx + 1]) : 15;

const fehler = validieren(aussagen, { regelIds: ids });
console.log(fehler.length ? `${fehler.length} Fehler:\n${fehler.map((f) => `  ${f}`).join('\n')}\n` : 'Schema und Nachweis-Regeln: in Ordnung.\n');

const alle = Object.entries(aussagen.regeln).flatMap(([id, liste]) => liste.map((a) => ({ id, ...a })));
const zaehle = (feld, werte) => werte.map((w) => `${w} ${alle.filter((a) => feld(a) === w).length}`).join(' · ');
console.log(`${alle.length} Aussagen zu ${Object.keys(aussagen.regeln).length} Regeln (${alle.filter((a) => a.schaetzung).length} Schätzungen).`);
console.log(`  Gewissheit: ${zaehle((a) => a.gewissheit, GEWISSHEIT)}`);
console.log(`  Wirkung:    ${zaehle((a) => a.wirkung, WIRKUNG)}`);
console.log(`  Beleg:      ${zaehle((a) => a.beleg.art, BELEG_ART)}`);
const extrem = alle.filter((a) => a.gewissheit === 'never' || a.gewissheit === 'proven');
console.log(`  Mit wissenschaftlichem Nachweis (never/proven): ${extrem.length}${extrem.length ? '' : ' — keine Aussage trägt bisher einen vollständigen Nachweis (begutachtete Studie, Volltext gelesen, DOI)'}\n`);

console.log(`Prüf-Priorität (Wirkung × Unsicherheit), die ersten ${top}:`);
for (const z of pruefPrioritaet(aussagen).slice(0, top)) {
  console.log(`  ${String(z.prioritaet).padStart(2)}  ${z.id.padEnd(52)} ${WIRKUNG_TEXT[z.wirkung].padEnd(10)} ${GEWISSHEIT_TEXT[z.gewissheit].padEnd(14)} ${z.beleg}`);
}

const k = konsistenz(aussagen, strenge, ids, mitVorbereitung, logisch);
console.log(`\nKonsistenz zu strenge (nur Hinweise, die Einstufung bleibt Maintainer-Entscheidung):`);
console.log(`  hart, aber keine Aussage mit Ausfall (vielleicht eher „empfohlen“): ${k.hartWirkung.length}`);
for (const r of k.hartWirkung) console.log(`    ${r.id.padEnd(44)} Wirkung: ${r.wirkung}`);
console.log(`  hart ohne Ausfall, aber mit automatischer Vorbereitung (Pflicht mit Hilfe, in Ordnung): ${k.hartMitHilfe.length}${k.hartMitHilfe.length ? ` — ${k.hartMitHilfe.map((r) => r.id).join(', ')}` : ''}`);
console.log(`  hart ohne Ausfall, Voraussetzung eines Zustands-Schritts (sagt nur, ob der Schritt geht, in Ordnung): ${k.hartLogisch.length}${k.hartLogisch.length ? ` — ${k.hartLogisch.map((r) => r.id).join(', ')}` : ''}`);
console.log(`  hart, aber sicherste Aussage unter „wahrscheinlich“: ${k.hartGewissheit.length}`);
for (const r of k.hartGewissheit) console.log(`    ${r.id.padEnd(44)} Gewissheit: ${r.gewissheit}`);
console.log(`  Löschkandidaten (alle Aussagen ohne Folge): ${k.loeschkandidaten.length}${k.loeschkandidaten.length ? ` — ${k.loeschkandidaten.join(', ')}` : ''}`);
console.log(`  Regeln ohne Aussage: ${k.unbewertet.length}${k.unbewertet.length ? ` — ${k.unbewertet.join(', ')}` : ''}`);
process.exitCode = fehler.length ? 1 : 0;
