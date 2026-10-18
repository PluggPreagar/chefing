// Gärmodell (Hefe × Zeit × Temperatur, T49/T52) an den Korpus-Zeiten fitten und mit modelle.json vergleichen.
//   node tools/gaerung-fit.mjs
// Modell: ln(Gare_min) = ln_konstante + exponent · ln(Hefe %) − temp_koeffizient · (Temperatur °C − temp_ref)
// Gare = Summe von Vorteig-, Gehen- und Stückgare-Zeit je Rezept (`zeiten`), Hefe = Frischhefe-Äquivalent in Bäckerprozent,
// Temperatur = Mitte des Bereichs der Gare (Rezept `temperaturen.gehen`, sonst Vorgabe der Methode/Operation).
// Rezepte mit Vorteig bleiben draußen: die Hefe im Vorteig ist im Korpus nicht aufgeteilt (Poolish: eine Prise für 12 Std.).
// Die Parameter in modelle.json werden bewusst NICHT automatisch überschrieben — Abweichungen werden nur gemeldet.
// Prüfung der Temperatur-Abhängigkeit: Fit OHNE die Rezepte bei Raumtemperatur, Vorhersage dieser Rezepte (Interpolation).
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { normalizeRecipe } = await import(new URL('model/corpus.js', wurzel));
const { temperaturBereich, gareOperation, schrittTemperatur } = await import(new URL('model/temperatur.js', wurzel));
const { erwarteteGare } = await import(new URL('model/gaerung.js', wurzel));
const ingredients = lies('data/ingredients.json');
const arch = lies('data/archetypes.json').hefeteig;
const methods = lies('data/methods.json');
const operations = lies('data/operations.json');
const temperaturen = lies('data/temperaturen.json');
const gespeichert = lies('data/modelle.json').gaerung;
const rollen = arch.rollen.map((r) => r.rolle);
// Die Prüf-Rezepte (modelle.json `validierung.ids`) bleiben aus dem Fit heraus, damit die Vorhersage unabhängig bleibt.
const pruefIds = new Set(gespeichert.validierung?.ids ?? []);

export const TEMP_REF = 20;
export const istRaum = (tempC) => tempC >= temperaturen.raum.min && tempC <= temperaturen.raum.max;

export function lesen() {
  const zeilen = [];
  for (const v of Object.values(arch.varianten)) for (const r of lies(`data/corpus/${v.korpus}.json`)) {
    const n = normalizeRecipe(r, ingredients, { rollen });
    const z = r.zeiten || {};
    const T = (z.vorteig ?? 0) + (z.gehen ?? 0) + (z.stueckgare ?? 0);
    if (r.methode === 'hefe_vorteig' || !(z.gehen > 0) || !(n.bilanz.bp.hefe > 0) || !(T > 0)) continue;
    const b = temperaturBereich(schrittTemperatur('gehen', gareOperation(r.methode, methods, operations), r), temperaturen);
    if (!b) continue;
    zeilen.push({ id: r.id, methode: r.methode, explizit: r.temperaturen?.gehen != null, temp: b.mitte, hefe: n.bilanz.bp.hefe, T, pruef: pruefIds.has(r.id) });
  }
  return zeilen;
}

function ols(X, y) {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  X.forEach((x, i) => { for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += x[a] * x[b]; A[a][k] += x[a] * y[i]; } });
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; }
  }
  return A.map((row, i) => row[k] / row[i]);
}

export function fitten(zeilen) {
  const X = zeilen.map((r) => [1, Math.log(r.hefe), r.temp - TEMP_REF]);
  const y = zeilen.map((r) => Math.log(r.T));
  const [a, b, c] = ols(X, y);
  const pred = X.map((x) => a + b * x[1] + c * x[2]);
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  const r2 = 1 - y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0) / y.reduce((s, v) => s + (v - my) ** 2, 0);
  const faktoren = y.map((v, i) => Math.exp(Math.abs(v - pred[i]))).sort((p, q) => p - q);
  const q = (p) => faktoren[Math.min(faktoren.length - 1, Math.floor(faktoren.length * p))];
  return { ln_konstante: a, exponent: b, temp_koeffizient: -c, q10: Math.exp(-c * 10), r2, n: zeilen.length, median: q(0.5), q80: q(0.8), q90: q(0.9), max: faktoren.at(-1) };
}

// Abweichung (Faktor, >= 1) der Vorhersage von der tatsächlichen Gärzeit je Rezept
export function abweichungen(zeilen, modell) {
  return zeilen.map((r) => { const e = erwarteteGare(r.hefe, r.temp, modell); return { id: r.id, faktor: Math.max(r.T / e, e / r.T), lang: r.T > e }; });
}

if (process.argv[1]?.endsWith('gaerung-fit.mjs')) {
  const alle = lesen();
  const zeilen = alle.filter((r) => !r.pruef);
  const f = fitten(zeilen);
  const raum = zeilen.filter((r) => istRaum(r.temp));
  const kalt = zeilen.filter((r) => r.temp < 10);
  const fmt = (x, d = 2) => x.toFixed(d).replace('.', ',');
  console.log(`Rezepte im Fit (ohne Vorteig, mit Zeit und Hefe, ohne Prüf-Rezepte): ${f.n} (kalt ${kalt.length}, Raumtemperatur ${raum.length}, warm ${f.n - kalt.length - raum.length}; Temperatur ausdrücklich im Rezept: ${zeilen.filter((r) => r.explizit).length})`);
  console.log(`Fit:        ln_konstante ${fmt(f.ln_konstante, 3)}  exponent ${fmt(f.exponent, 3)}  temp_koeffizient ${fmt(f.temp_koeffizient, 4)} je °C (Q10 ${fmt(f.q10)})  R² ${fmt(f.r2)}`);
  console.log(`Abweichung der Zeit (Faktor): Median ${fmt(f.median)}, 80 % ${fmt(f.q80)}, 90 % ${fmt(f.q90)}, max ${fmt(f.max, 1)}`);
  const ohneRaum = zeilen.filter((r) => !istRaum(r.temp));
  if (raum.length && ohneRaum.length > 3) {
    const g = fitten(ohneRaum);
    const abw = abweichungen(raum, { ...g, temp_ref: TEMP_REF, temp_standard: 28 }).sort((p, q) => p.faktor - q.faktor);
    const med = abw[Math.floor(abw.length / 2)].faktor;
    console.log(`Prüfung Raumtemperatur (Fit ohne diese ${raum.length}: Q10 ${fmt(g.q10)}): Vorhersage der Gärzeit im Median ×${fmt(med)} daneben, ${abw.filter((a) => a.lang).length} von ${abw.length} länger als vorhergesagt`);
    for (const a of abw) console.log(`   ${a.id.slice(0, 50).padEnd(51)} ×${fmt(a.faktor)} ${a.lang ? 'länger' : 'kürzer'}`);
  }
  const pruef = alle.filter((r) => r.pruef);
  if (pruef.length) {
    const abw = abweichungen(pruef, { ...f, temp_ref: TEMP_REF, temp_standard: 28 });
    console.log(`Prüf-Rezepte (nicht im Fit, n = ${pruef.length}): ${abw.map((a) => `×${fmt(a.faktor)} ${a.lang ? 'länger' : 'kürzer'}`).join(', ')}`);
  }
  console.log(`Gespeichert: ln_konstante ${gespeichert.ln_konstante}  exponent ${gespeichert.exponent}  temp_koeffizient ${gespeichert.temp_koeffizient}  warn_faktor ${gespeichert.warn_faktor}  (n = ${gespeichert.fit_n})`);
}
