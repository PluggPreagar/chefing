import { toGrams, bakersPercent, summarize } from './units.js';

export const ROLLEN = ['struktur', 'fett', 'suesse', 'bindung', 'fluessigkeit', 'trieb', 'aroma', 'einlage'];

export async function loadCorpus(varianten, base = './src/data/corpus/') {
  const entries = await Promise.all(
    Object.entries(varianten).map(async ([key, v]) => {
      try {
        const res = await fetch(`${base}${v.korpus}.json`);
        if (!res.ok) throw new Error(`${res.status}`);
        return [key, await res.json()];
      } catch (e) {
        console.warn(`Korpus ${v.korpus} nicht ladbar:`, e.message);
        return [key, []];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function normalizeRecipe(recipe, ingredients) {
  const rollenGramm = Object.fromEntries(ROLLEN.map((r) => [r, 0]));
  const unbekannt = [];
  let fettTyp = null;
  let sauer = false;

  for (const z of recipe.zutaten || []) {
    const ing = ingredients[z.zutat];
    let g = ing ? toGrams(ing, z.menge, z.einheit) : null;
    if (g == null) {
      if (z.einheit === 'g' || z.einheit === 'ml') g = z.menge;
      else { unbekannt.push(z); continue; }
    }
    if (!ing) unbekannt.push(z);
    if (rollenGramm[z.rolle] == null) rollenGramm[z.rolle] = 0;
    rollenGramm[z.rolle] += g;
    if (z.rolle === 'fett' && ing) fettTyp = ing.aggregat === 'fluessig' ? 'fluessig' : 'fest';
    if (ing?.saeure && z.rolle !== 'aroma' && z.rolle !== 'einlage') sauer = true;
  }

  const ref = rollenGramm.struktur || 0;
  const bp = Object.fromEntries(ROLLEN.map((r) => [r, bakersPercent(rollenGramm[r], ref)]));
  const teigmasse = Object.values(rollenGramm).reduce((a, b) => a + b, 0);

  return {
    ...recipe,
    rollenGramm,
    bp,
    teigmasse,
    fettTyp,
    sauer,
    hatEinlage: rollenGramm.einlage > 0,
    unbekannt,
  };
}

export function stats(normalized) {
  const n = normalized.length;
  const count = (fn) =>
    normalized.reduce((acc, r) => {
      const k = fn(r);
      if (k != null) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

  return {
    n,
    bp: Object.fromEntries(ROLLEN.map((r) => [r, summarize(normalized.map((x) => x.bp[r]))])),
    methoden: count((r) => r.methode),
    fettTyp: count((r) => r.fettTyp),
    fettZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'fett')?.zutat),
    fluessigkeitZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'fluessigkeit')?.zutat ?? '—'),
    einlageZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'einlage')?.zutat ?? '—'),
    sauer: normalized.filter((r) => r.sauer).length,
    einlage: normalized.filter((r) => r.hatEinlage).length,
    teigmasse: summarize(normalized.map((r) => r.teigmasse)),
    backen: {
      tempOU: summarize(normalized.map((r) => r.backen?.tempOU)),
      tempUmluft: summarize(normalized.map((r) => r.backen?.tempUmluft)),
      minuten: summarize(normalized.map((r) => r.backen?.minuten)),
    },
    quellen: normalized.map((r) => ({
      id: r.id,
      titel: r.titel,
      url: r.quelle?.url,
      site: r.quelle?.site,
      bewertung: r.quelle?.bewertung,
      anzahl: r.quelle?.anzahlBewertungen,
      methode: r.methode,
      fettTyp: r.fettTyp,
      sauer: r.sauer,
    })),
    unbekannt: normalized.flatMap((r) => r.unbekannt.map((z) => `${r.id}: ${z.zutat} (${z.menge} ${z.einheit})`)),
  };
}

export function haeufigste(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
