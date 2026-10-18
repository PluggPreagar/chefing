// Gärmodell an neuen, unabhängigen Rezepten prüfen (T49: „Daten statt Modell“ als Verifikation).
//   node tools/gaerung-pruefen.mjs <datei.json> [<datei2.json> …]
// Die Dateien enthalten Korpus-Rezepte im Format von src/data/corpus (noch NICHT eingepflegt), Gär-Temperatur wie im Korpus
// unter `temperaturen.gehen` (sonst Vorgabe der Methode). Für jedes Rezept:
//   1) Vorhersage der Gärzeit aus der Hefemenge (Modell) gegen die tatsächliche Gärzeit,
//   2) Vorhersage der Hefemenge aus der Gärzeit (so rechnet die Engine für Methoden ohne Rezepte) gegen die tatsächliche Hefe,
//   3) Vergleich mit der einfachen Alternative „Median der Variante“ bzw. „Median der direkten Führung“.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { normalizeRecipe, stats } = await import(new URL('model/corpus.js', wurzel));
const { erwarteteGare, hefeFuerGare, gaerungModell, hatReifenVorteig, gareMinuten } = await import(new URL('model/gaerung.js', wurzel));
const { temperaturBereich, gareOperation, schrittTemperatur } = await import(new URL('model/temperatur.js', wurzel));
const ingredients = lies('data/ingredients.json');
const arch = lies('data/archetypes.json').hefeteig;
const methods = lies('data/methods.json');
const operations = lies('data/operations.json');
const temperaturen = lies('data/temperaturen.json');
const m = gaerungModell({ modelle: lies('data/modelle.json') });
const rollen = arch.rollen.map((r) => r.rolle);

const dateien = process.argv.slice(2);
if (!dateien.length) { console.log('Aufruf: node tools/gaerung-pruefen.mjs <datei.json> …'); process.exit(1); }
const neu = dateien.flatMap((d) => JSON.parse(fs.readFileSync(d, 'utf8').replace(/^﻿/, '')));

const variantenStats = Object.fromEntries(Object.entries(arch.varianten).map(([k, v]) => [k, stats(lies(`data/corpus/${v.korpus}.json`).map((r) => normalizeRecipe(r, ingredients, { rollen })), rollen)]));
const faktor = (a, b) => Math.max(a / b, b / a);
const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');
const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const zeilen = [];
for (const r of neu) {
  const n = normalizeRecipe(r, ingredients, { rollen });
  const z = r.zeiten || {};
  const T = gareMinuten(z);
  const temp = temperaturBereich(schrittTemperatur('gehen', gareOperation(r.methode, methods, operations), r), temperaturen)?.mitte ?? null;
  const hefe = n.bilanz.bp.hefe;
  if (!(hefe > 0) || !(T > 0) || hatReifenVorteig(r)) { console.log(`übersprungen (keine Zeit/Hefe oder Vorteig): ${r.id}`); continue; }
  const st = variantenStats[r.variante];
  const direkt = st.proMethode?.hefe_direkt?.bp?.trieb?.median ?? st.bp.trieb.median;
  zeilen.push({
    id: r.id, hefe, T, temp,
    gareModell: erwarteteGare(hefe, temp, m),
    hefeModell: hefeFuerGare(T, temp, m),
    hefeVariante: st.bp.trieb.median,
    hefeDirekt: direkt,
  });
}
console.log(`\nTestsatz: ${zeilen.length} Rezepte (kalt unter 10 °C: ${zeilen.filter((r) => r.temp < 10).length})\n`);
console.log('Rezept'.padEnd(46), ' °C ', 'Hefe', 'Gare   ', 'Modell-Gare ', 'Faktor', ' Hefe(Modell)', 'Faktor', ' Hefe(Variante)', 'Faktor');
for (const r of zeilen) {
  console.log(r.id.slice(0, 45).padEnd(46), fmt(r.temp ?? m.temp_standard).padStart(4), fmt(r.hefe).padStart(4), `${fmt(r.T / 60)} Std.`.padStart(8), `${fmt(r.gareModell / 60)} Std.`.padStart(11), `×${fmt(faktor(r.T, r.gareModell), 2)}`.padStart(7), `${fmt(r.hefeModell, 2)} %`.padStart(11), `×${fmt(faktor(r.hefe, r.hefeModell), 2)}`.padStart(6), `${fmt(r.hefeVariante, 2)} %`.padStart(13), `×${fmt(faktor(r.hefe, r.hefeVariante), 2)}`.padStart(6));
}
const fZeit = zeilen.map((r) => faktor(r.T, r.gareModell));
const fHefeM = zeilen.map((r) => faktor(r.hefe, r.hefeModell));
const fHefeV = zeilen.map((r) => faktor(r.hefe, r.hefeVariante));
const fHefeD = zeilen.map((r) => faktor(r.hefe, r.hefeDirekt));
const innerhalb = zeilen.filter((r) => faktor(r.T, r.gareModell) <= m.warn_faktor).length;
console.log(`\nGärzeit aus Hefe (Modell):        Median-Abweichung ×${fmt(med(fZeit), 2)}, ${innerhalb} von ${zeilen.length} innerhalb ×${m.warn_faktor} (Fit am Korpus: Median ×1,33)`);
console.log(`Hefe aus Gärzeit (Modell):        Median-Abweichung ×${fmt(med(fHefeM), 2)}`);
console.log(`Hefe: Median der Variante:        Median-Abweichung ×${fmt(med(fHefeV), 2)}`);
console.log(`Hefe: Median der direkten Führung: Median-Abweichung ×${fmt(med(fHefeD), 2)}`);
console.log(`\nMedian der tatsächlichen Hefe im Testsatz: ${fmt(med(zeilen.map((r) => r.hefe)), 2)} %; Median der Gärzeit: ${fmt(med(zeilen.map((r) => r.T)) / 60)} Std.`);
console.log(`Engine für „Kalte Führung“ ohne Rezepte rechnet bei 12,5 Std. im Kühlschrank (${temperaturen.kuehlschrank.min}–${temperaturen.kuehlschrank.max} °C): ${fmt(hefeFuerGare(750, (temperaturen.kuehlschrank.min + temperaturen.kuehlschrank.max) / 2, m), 2)} %`);
