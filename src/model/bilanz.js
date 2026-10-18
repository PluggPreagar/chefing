// Gesamtbilanz (DR-020, T33): summiert Wasser, Fett und Zucker über ALLE Zutaten der
// Teigmatrix aus den Massenanteilen in ingredients.json (wasseranteil/fettanteil/zuckeranteil) —
// unabhängig davon, in welcher Rolle eine Zutat steht. Damit zählen z. B. das Wasser im Ei und in
// der Butter oder das Fett im Schmand mit, die die Rollen-Sicht (Bäckerprozent je Rolle) übersieht.
// Die Rolle `einlage` bleibt außen vor: Stückiges (Beeren, Schokostücke) gibt seine Bestandteile
// beim Backen nur teilweise an den Teig ab — sie gehört nicht zur Teigmatrix.

// Funktions-Bilanz (T36, Option A): zusätzlich zu Wasser/Fett/Zucker werden die Funktionen aus
// dem optionalen Funktionsvektor `funktionen` je Zutat summiert. Rollen bleiben unverändert —
// die Funktionen sind eine zweite, rollenübergreifende Sicht (z. B. Eiweiß aus Mehl + Ei + Milch).
const anteil = (feld) => (ing) => ing[feld] || 0;
const funktion = (f) => (ing) => ing.funktionen?.[f] || 0;
export const GROESSEN = {
  wasser: anteil('wasseranteil'), fett: anteil('fettanteil'), zucker: anteil('zuckeranteil'),
  eiweiss: funktion('eiweiss'), gluten: funktion('gluten'), staerke: funktion('staerke'),
  emulgator: funktion('emulgator'), triebkraft: funktion('triebkraft'),
  hefe: funktion('hefe'), salz: anteil('salzanteil'),
  // Natron-Säure-Balance (T37): freies Natron (ohne das im Backpulver, das seine Säure mitbringt) und die Säure der übrigen
  // Zutaten in g Natron-Äquivalent (`saeure_kapazitaet`)
  natron: funktion('natron'), saeure: anteil('saeure_kapazitaet'),
};
export const GROESSEN_LABEL = {
  wasser: 'Gesamtwasser', fett: 'Reinfett', zucker: 'Zucker', eiweiss: 'Eiweiß (Gerüst)',
  gluten: 'Klebereiweiß', staerke: 'Stärke', emulgator: 'Emulgator', triebkraft: 'Triebkraft (Backpulver-Äq.)',
  hefe: 'Hefe (Frischhefe-Äq.)', salz: 'Salz',
  natron: 'Natron (frei)', saeure: 'Säure (Natron-Äq.)',
};

// Kleine Werte (Triebkraft, Emulgator, Gluten) mit einer Nachkommastelle, sonst ganzzahlig.
export const fmtProzent = (x) => (x == null ? '—' : x < 10 ? x.toFixed(1).replace('.', ',') : String(Math.round(x)));
const AUSSERHALB_MATRIX = new Set(['einlage']);
// Säure aus der Einlage (Beeren, Zitrusstücke) reagiert mit dem Natron, auch wenn die Einlage nicht zur Teigmatrix zählt
const MIT_EINLAGE = new Set(['saeure']);

// posten: [{rolle, zutat, gramm}] — gleiche Form für generierte Rezepte (engine.js) und
// Korpus-Rezepte (corpus.js). referenzRolle: Rolle, auf die Bäckerprozent bezogen werden.
export function bilanz(posten, ingredients, referenzRolle = 'struktur') {
  const gramm = Object.fromEntries(Object.keys(GROESSEN).map((g) => [g, 0]));
  let refGramm = 0;
  for (const p of posten) {
    if (!(p.gramm > 0)) continue;
    if (p.rolle === referenzRolle) refGramm += p.gramm;
    const aussen = AUSSERHALB_MATRIX.has(p.rolle);
    const ing = ingredients[p.zutat];
    if (!ing) continue;
    for (const [g, wert] of Object.entries(GROESSEN)) if (!aussen || MIT_EINLAGE.has(g)) gramm[g] += p.gramm * wert(ing);
  }
  const bp = Object.fromEntries(Object.entries(gramm).map(([g, v]) => [g, refGramm > 0 ? (v / refGramm) * 100 : null]));
  return { gramm, bp, refGramm };
}

// Wert einer Grenze im Maß ihres `bezug`: Prozent relativ zu einer Rolle, oder Faktor zu einer
// anderen Bilanz-Größe.
export function messwert(grenze, b) {
  if (grenze.bezug?.groesse) {
    const nenner = b.gramm[grenze.bezug.groesse];
    return nenner > 0 ? b.gramm[grenze.groesse] / nenner : null;
  }
  return b.bp[grenze.groesse];
}

const fmtWert = (x, faktor) => (faktor ? x.toFixed(2).replace('.', ',') : fmtProzent(x));

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
    const vorzeichen = g.min != null && g.max == null ? '≥ ' : g.max != null && g.min == null ? '≤ ' : '';
    const kurz = `${GROESSEN_LABEL[g.groesse]} ${fmtWert(w, faktor)}${faktor ? '' : ' %'} (Grenze ${vorzeichen}${grenzeText})`;
    (g.strenge === 'hart' ? hart : empfohlen).push({ id: g.id, groesse: g.groesse, ziel: g.kaskade_ziel, text, kurz, wert: w });
  }
  return { hart, empfohlen };
}

// Meldungen entdoppeln (T42): (1) dieselbe Größe mit hart- und empfohlen-Grenze (z. B. Fett
// 160 % → fett_max + fett_max_hart) meldet nur die harte; (2) Grenzen mit gleicher Kaskade-Zielrolle
// haben dieselbe Ursache (Struktur → Klebereiweiß + Gesamteiweiß) und werden zu einer Meldung mit
// Kurzform der übrigen. Nur die Anzeigetexte — Blockaden/Kaskaden rechnen weiter mit allen Grenzen.
export function grenzenBuendeln(verletzt) {
  const hartGroessen = new Set(verletzt.hart.map((v) => v.groesse));
  const buendeln = (liste) => {
    const gruppen = new Map();
    for (const v of liste) {
      const schluessel = v.ziel ?? v.id;
      if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
      gruppen.get(schluessel).push(v);
    }
    return [...gruppen.values()].map(([erste, ...rest]) => (
      rest.length ? `${erste.text.replace(/\.$/, '')}. Gleiche Ursache: ${rest.map((r) => r.kurz).join('; ')}.` : erste.text
    ));
  };
  return {
    hart: buendeln(verletzt.hart),
    empfohlen: buendeln(verletzt.empfohlen.filter((v) => !hartGroessen.has(v.groesse))),
  };
}

// Korpus-Toleranz (T35): vergleicht einen Wert mit der Korpus-Verteilung (summarize() aus
// units.js). Außerhalb Q1–Q3 = untypisch (Hinweis), außerhalb min–max = vom Korpus nicht gedeckt
// (Warnung). Bei sehr kleinem Korpus bewusst tolerant: erst ab n >= 3 wird überhaupt bewertet,
// und jede Grenze bekommt eine relative Marge (Default 5 %) — bei n ≈ 7 ist Q1–Q3 so schmal, dass
// sonst schon Rundungsunterschiede (123 % vs. Q3 122 %) als „untypisch“ auffallen würden.
// Mindestbreite (T43): haben fast alle Rezepte denselben Wert (Klebereiweiß 8,0 %), wäre die Spanne
// null breit und jede Abweichung „ungetestet“. Darum reicht der Toleranzbereich mindestens ±10 %
// (Hinweis) bzw. ±20 % (Warnung) um den Median — ±5 % (`marge`) sind sicher, ±10 % üblich (Nutzer-Vorgabe
// für geprüfte Einzelrezepte, T48) — und nie enger als 0,5 Prozentpunkte um die Grenze (Fett im Mehl
// 0,9 % statt 1,0 % ist kein Befund).
export function toleranz(wert, verteilung, minN = 3, marge = 0.05, minBreite = { q: 0.10, spanne: 0.20, abs: 0.5 }) {
  if (wert == null || !verteilung || verteilung.n < minN) return null;
  const mitte = verteilung.median ?? (verteilung.q1 + verteilung.q3) / 2;
  const unter = (grenze, breite) => wert < Math.min(grenze * (1 - marge), grenze - minBreite.abs, mitte - Math.abs(mitte) * breite);
  const ueber = (grenze, breite) => wert > Math.max(grenze * (1 + marge), grenze + minBreite.abs, mitte + Math.abs(mitte) * breite);
  if (unter(verteilung.min, minBreite.spanne) || ueber(verteilung.max, minBreite.spanne)) return 'ausserhalb_spanne';
  if (unter(verteilung.q1, minBreite.q) || ueber(verteilung.q3, minBreite.q)) return 'ausserhalb_q';
  return 'typisch';
}

// Statische Beschreibung einer Grenze ohne konkreten Messwert — für den Regel-Katalog
// (alleUeberschreibbarenRegeln, DR-019/T29), unabhängig vom aktuellen Rezept.
export function beschreibeGrenze(g) {
  const faktor = !!g.bezug?.groesse;
  const masz = faktor ? ` / ${GROESSEN_LABEL[g.bezug.groesse]}` : ' % vom Mehl';
  const teile = [];
  if (g.min != null) teile.push(`≥ ${fmtWert(g.min, faktor)}`);
  if (g.max != null) teile.push(`≤ ${fmtWert(g.max, faktor)}`);
  return `${GROESSEN_LABEL[g.groesse]}${faktor ? masz : ''} ${teile.join(' und ')}${faktor ? '' : masz}`;
}

// Kaskaden-Vorschlag für eine verletzte Grenze (T39): ersetzt die Zutat(en) der Zielrolle
// probeweise durch jede Option dieser Rolle (gleiche Rollen-Gramm), rechnet die Bilanz neu und
// liefert die erste Option, die diese Grenze erfüllt und keine hart-Grenze neu verletzt.
// Reine Simulation — gleiche Regel wie die Operations-Kaskade (T26): Vorschlag, keine Mutation.
export function grenzenKaskade(grenze, posten, optionen, ingredients, grenzen, referenzRolle = 'struktur') {
  const ziel = grenze.kaskade_ziel;
  if (!ziel) return null;
  const rollenGramm = posten.filter((p) => p.rolle === ziel).reduce((a, p) => a + p.gramm, 0);
  if (!(rollenGramm > 0)) return null;
  const aktuell = new Set(posten.filter((p) => p.rolle === ziel).map((p) => p.zutat));
  for (const kandidat of optionen) {
    if (aktuell.has(kandidat) || !ingredients[kandidat]) continue;
    const probe = [...posten.filter((p) => p.rolle !== ziel), { rolle: ziel, zutat: kandidat, gramm: rollenGramm }];
    const v = grenzenPruefen(bilanz(probe, ingredients, referenzRolle), grenzen);
    if (v.hart.length || v.empfohlen.some((x) => x.id === grenze.id)) continue;
    return kandidat;
  }
  return null;
}

// Mengen-Kaskade (T40): reicht kein Tausch der Zutat, wird die MENGE der Zielrolle verschoben, bis die Grenze hält — in 1-%-Schritten
// um die aktuelle Menge, innerhalb der Korpus-Spanne dieser Rolle (spanne = {min, max} in Bäckerprozent), der kleinste Eingriff
// gewinnt. Rechnet in Bäckerprozent (Mehl = 100, posten[].gramm = Bäckerprozent der Zeile); die Teigmasse skaliert danach alles
// gleich mit, die Verhältnisse bleiben. Die Referenzrolle (Mehl) wird nie verschoben; keine neue hart-Grenze darf entstehen.
// Reine Simulation — Vorschlag, keine Mutation (wie grenzenKaskade).
export function grenzenMengenKaskade(grenze, posten, spanne, ingredients, grenzen, referenzRolle = 'struktur') {
  const ziel = grenze.kaskade_ziel;
  if (!ziel || ziel === referenzRolle || !spanne || !(spanne.max >= spanne.min)) return null;
  const aktuell = posten.filter((p) => p.rolle === ziel).reduce((a, p) => a + p.gramm, 0);
  if (!(aktuell > 0)) return null;
  const hartVorher = new Set(grenzenPruefen(bilanz(posten, ingredients, referenzRolle), grenzen).hart.map((v) => v.id));
  const faktoren = [];
  const kMin = Math.ceil((Math.max(0, spanne.min / aktuell) - 1) * 100 - 1e-9);
  const kMax = Math.floor((spanne.max / aktuell - 1) * 100 + 1e-9);
  for (let k = kMin; k <= kMax; k++) if (k !== 0) faktoren.push(1 + k / 100); // Schritte von 1 % der aktuellen Menge, ganzzahlig gezählt (keine Rundungsfehler)
  faktoren.sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1));
  for (const f of faktoren) {
    const probe = posten.map((p) => (p.rolle === ziel ? { ...p, gramm: p.gramm * f } : p));
    const v = grenzenPruefen(bilanz(probe, ingredients, referenzRolle), grenzen);
    if ([...v.hart, ...v.empfohlen].some((x) => x.id === grenze.id)) continue;
    if (v.hart.some((x) => !hartVorher.has(x.id))) continue;
    return { rolle: ziel, von: aktuell, nach: Math.round(aktuell * f * 10) / 10, faktor: f };
  }
  return null;
}

// Herkunft einer Bilanz-Größe nach Rollen (T41, Funktions-Sicht): welche Rollen liefern wie viel davon? Das Ei liefert Bindung,
// Emulgator und Eiweiß zugleich, das Mehl Gerüst und Stärke — die Rollen bleiben Slots, aber die Funktion zeigt, woher sie kommt.
// Rückgabe: Rollen mit Anteil an der Summe der Größe (0..1), größte zuerst; leer, wenn nichts zur Größe beiträgt.
export function beitraege(posten, ingredients, groesse) {
  const wert = GROESSEN[groesse];
  if (!wert) return [];
  const je = new Map();
  for (const p of posten) {
    if (!(p.gramm > 0)) continue;
    if (AUSSERHALB_MATRIX.has(p.rolle) && !MIT_EINLAGE.has(groesse)) continue;
    const ing = ingredients[p.zutat];
    if (!ing) continue;
    const g = p.gramm * wert(ing);
    if (g > 0) je.set(p.rolle, (je.get(p.rolle) || 0) + g);
  }
  const summe = [...je.values()].reduce((a, b) => a + b, 0);
  return summe > 0 ? [...je].map(([rolle, gramm]) => ({ rolle, gramm, anteil: gramm / summe })).sort((a, b) => b.anteil - a.anteil) : [];
}
