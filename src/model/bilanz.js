// Gesamtbilanz (DR-020, T33): summiert Wasser, Fett und Zucker über ALLE Zutaten der
// Teigmatrix aus den Massenanteilen in ingredients.json (wasseranteil/fettanteil/zuckeranteil) —
// unabhängig davon, in welcher Rolle eine Zutat steht. Damit zählen z. B. das Wasser im Ei und in
// der Butter oder das Fett im Schmand mit, die die Rollen-Sicht (Bäckerprozent je Rolle) übersieht.
// Die Rolle `einlage` bleibt außen vor: Stückiges (Beeren, Schokostücke) gibt seine Bestandteile
// beim Backen nur teilweise an den Teig ab — sie gehört nicht zur Teigmatrix.

export const GROESSEN = { wasser: 'wasseranteil', fett: 'fettanteil', zucker: 'zuckeranteil' };
export const GROESSEN_LABEL = { wasser: 'Gesamtwasser', fett: 'Reinfett', zucker: 'Zucker' };
const AUSSERHALB_MATRIX = new Set(['einlage']);

// posten: [{rolle, zutat, gramm}] — gleiche Form für generierte Rezepte (engine.js) und
// Korpus-Rezepte (corpus.js). referenzRolle: Rolle, auf die Bäckerprozent bezogen werden.
export function bilanz(posten, ingredients, referenzRolle = 'struktur') {
  const gramm = Object.fromEntries(Object.keys(GROESSEN).map((g) => [g, 0]));
  let refGramm = 0;
  for (const p of posten) {
    if (!(p.gramm > 0)) continue;
    if (p.rolle === referenzRolle) refGramm += p.gramm;
    if (AUSSERHALB_MATRIX.has(p.rolle)) continue;
    const ing = ingredients[p.zutat];
    if (!ing) continue;
    for (const [g, feld] of Object.entries(GROESSEN)) gramm[g] += p.gramm * (ing[feld] || 0);
  }
  const bp = Object.fromEntries(Object.entries(gramm).map(([g, v]) => [g, refGramm > 0 ? (v / refGramm) * 100 : null]));
  return { gramm, bp, refGramm };
}

// Wert einer Grenze im Maß ihres `bezug`: Prozent relativ zu einer Rolle, oder Faktor zu einer
// anderen Bilanz-Größe.
function messwert(grenze, b) {
  if (grenze.bezug?.groesse) {
    const nenner = b.gramm[grenze.bezug.groesse];
    return nenner > 0 ? b.gramm[grenze.groesse] / nenner : null;
  }
  return b.bp[grenze.groesse];
}

const fmtWert = (x, faktor) => (faktor ? x.toFixed(2).replace('.', ',') : String(Math.round(x)));

// Quantitative Grenzen (T34): prüft die Bilanz gegen grenzen.json. Rückgabe getrennt nach
// Strenge — `hart` macht die Kombination ungültig, `empfohlen` warnt nur (DR-008).
export function grenzenPruefen(b, grenzen) {
  const hart = [];
  const empfohlen = [];
  for (const g of grenzen || []) {
    const w = messwert(g, b);
    if (w == null) continue;
    const zuNiedrig = g.min != null && w < g.min;
    const zuHoch = g.max != null && w > g.max;
    if (!zuNiedrig && !zuHoch) continue;
    const faktor = !!g.bezug?.groesse;
    const grenzeText = g.min != null && g.max != null
      ? `${fmtWert(g.min, faktor)}–${fmtWert(g.max, faktor)}`
      : fmtWert(zuNiedrig ? g.min : g.max, faktor);
    const text = g.hinweis.replace('{wert}', fmtWert(w, faktor)).replace('{grenze}', grenzeText);
    (g.strenge === 'hart' ? hart : empfohlen).push({ id: g.id, text, wert: w });
  }
  return { hart, empfohlen };
}

// Korpus-Toleranz (T35): vergleicht einen Wert mit der Korpus-Verteilung (summarize() aus
// units.js). Außerhalb Q1–Q3 = untypisch (Hinweis), außerhalb min–max = vom Korpus nicht gedeckt
// (Warnung). Bei sehr kleinem Korpus bewusst tolerant: erst ab n >= 3 wird überhaupt bewertet,
// und jede Grenze bekommt eine relative Marge (Default 5 %) — bei n ≈ 7 ist Q1–Q3 so schmal, dass
// sonst schon Rundungsunterschiede (123 % vs. Q3 122 %) als „untypisch“ auffallen würden.
export function toleranz(wert, verteilung, minN = 3, marge = 0.05) {
  if (wert == null || !verteilung || verteilung.n < minN) return null;
  const unter = (grenze) => wert < grenze * (1 - marge);
  const ueber = (grenze) => wert > grenze * (1 + marge);
  if (unter(verteilung.min) || ueber(verteilung.max)) return 'ausserhalb_spanne';
  if (unter(verteilung.q1) || ueber(verteilung.q3)) return 'ausserhalb_q';
  return 'typisch';
}
