// Gärmodell (Hefe × Zeit × Temperatur, T49) an den Korpus-Zeiten fitten und mit modelle.json vergleichen.
//   node tools/gaerung-fit.mjs
// Modell: ln(Gare_min) = ln_konstante + exponent · ln(Hefe %) + ln(kuehl_faktor) · kalt
// Gare = Summe von Vorteig-, Gehen- und Stückgare-Zeit je Rezept (`zeiten`), Hefe = Frischhefe-Äquivalent in Bäckerprozent.
// Rezepte mit Vorteig bleiben draußen: die Hefe im Vorteig ist im Korpus nicht aufgeteilt (Poolish: eine Prise für 12 Std.).
// Die Parameter in modelle.json werden bewusst NICHT automatisch überschrieben — Abweichungen werden nur gemeldet.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (p) => JSON.parse(fs.readFileSync(new URL(p, wurzel), 'utf8'));
const { normalizeRecipe } = await import(new URL('model/corpus.js', wurzel));
const ingredients = lies('data/ingredients.json');
const arch = lies('data/archetypes.json').hefeteig;
const gespeichert = lies('data/modelle.json').gaerung;
const rollen = arch.rollen.map((r) => r.rolle);

export function lesen() {
  const zeilen = [];
  for (const v of Object.values(arch.varianten)) for (const r of lies(`data/corpus/${v.korpus}.json`)) {
    const n = normalizeRecipe(r, ingredients, { rollen });
    const z = r.zeiten || {};
    const T = (z.vorteig ?? 0) + (z.gehen ?? 0) + (z.stueckgare ?? 0);
    if (r.methode === 'hefe_vorteig' || !(z.gehen > 0) || !(n.bilanz.bp.hefe > 0) || !(T > 0)) continue;
    zeilen.push({ id: r.id, methode: r.methode, kalt: r.gehen_kuehl ? 1 : 0, hefe: n.bilanz.bp.hefe, T });
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
  const X = zeilen.map((r) => [1, Math.log(r.hefe), r.kalt]);
  const y = zeilen.map((r) => Math.log(r.T));
  const [a, b, k] = ols(X, y);
  const pred = X.map((x) => a + b * x[1] + k * x[2]);
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  const r2 = 1 - y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0) / y.reduce((s, v) => s + (v - my) ** 2, 0);
  const faktoren = y.map((v, i) => Math.exp(Math.abs(v - pred[i]))).sort((p, q) => p - q);
  const q = (p) => faktoren[Math.min(faktoren.length - 1, Math.floor(faktoren.length * p))];
  return { ln_konstante: a, exponent: b, kuehl_faktor: Math.exp(k), r2, n: zeilen.length, median: q(0.5), q80: q(0.8), q90: q(0.9), max: faktoren.at(-1) };
}

if (process.argv[1]?.endsWith('gaerung-fit.mjs')) {
  const zeilen = lesen();
  const f = fitten(zeilen);
  console.log(`Rezepte ohne Vorteig mit Zeit und Hefe: ${f.n} (kalt ${zeilen.filter((r) => r.kalt).length})`);
  console.log(`Fit:        ln_konstante ${f.ln_konstante.toFixed(3)}  exponent ${f.exponent.toFixed(3)}  kuehl_faktor ${f.kuehl_faktor.toFixed(2)}  R² ${f.r2.toFixed(2)}`);
  console.log(`Abweichung der Zeit (Faktor): Median ${f.median.toFixed(2)}, 80 % ${f.q80.toFixed(2)}, 90 % ${f.q90.toFixed(2)}, max ${f.max.toFixed(1)}`);
  console.log(`Gespeichert: ln_konstante ${gespeichert.ln_konstante}  exponent ${gespeichert.exponent}  kuehl_faktor ${gespeichert.kuehl_faktor}  warn_faktor ${gespeichert.warn_faktor}  (n = ${gespeichert.fit_n})`);
}
