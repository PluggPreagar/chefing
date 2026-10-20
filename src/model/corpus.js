import { toGrams, bakersPercent, summarize, quantile } from './units.js';
import { bilanz, GROESSEN } from './bilanz.js';
import { effektiveQualitaet, istManuell } from './qualitaet.js';

export const ROLLEN = ['struktur', 'fett', 'suesse', 'bindung', 'fluessigkeit', 'trieb', 'aroma', 'einlage'];

export async function loadCorpus(varianten, base = './src/data/corpus/') {
  const entries = await Promise.all(
    Object.entries(varianten).map(async ([key, v]) => {
      try {
        const res = await fetch(`${base}${v.korpus}.json`, { cache: 'no-cache' });
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

// rollen/referenz kommen aus dem Archetyp (archetypes.json, T06); Default = Rührteig für Tests.
export function normalizeRecipe(recipe, ingredients, { rollen = ROLLEN, referenz = 'struktur' } = {}) {
  const rollenGramm = Object.fromEntries(rollen.map((r) => [r, 0]));
  const unbekannt = [];
  let fettTyp = null;
  let sauer = false;
  const posten = []; // je Zutat-Zeile in Gramm — Grundlage der Gesamtbilanz (DR-020/T33)

  for (const z of recipe.zutaten || []) {
    const ing = ingredients[z.zutat];
    let g = ing ? toGrams(ing, z.menge, z.einheit) : null;
    if (g == null) {
      if (z.einheit === 'g' || z.einheit === 'ml') g = z.menge;
      else { unbekannt.push(z); continue; }
    }
    if (!ing) unbekannt.push(z);
    if (rollenGramm[z.rolle] == null) rollenGramm[z.rolle] = 0;
    rollenGramm[z.rolle] += g * (ing?.aequivalent_faktor ?? 1);
    posten.push({ rolle: z.rolle, zutat: z.zutat, gramm: g });
    if (z.rolle === 'fett' && ing) fettTyp = ing.aggregat === 'fluessig' ? 'fluessig' : 'fest';
    if (ing?.saeure && z.rolle !== 'aroma' && z.rolle !== 'einlage') sauer = true;
  }

  const ref = rollenGramm[referenz] || 0;
  const bp = Object.fromEntries(rollen.map((r) => [r, bakersPercent(rollenGramm[r], ref)]));
  const teigmasse = Object.values(rollenGramm).reduce((a, b) => a + b, 0);

  return {
    ...recipe,
    rollenGramm,
    bp,
    teigmasse,
    bilanz: bilanz(posten, ingredients, referenz),
    posten,
    fettTyp,
    sauer,
    hatEinlage: rollenGramm.einlage > 0,
    unbekannt,
  };
}

// Ab so vielen Rezepten einer Methode rechnet die Engine deren eigene Mediane statt des Variantenmedians (T48).
// 1: ein geprüftes Rezept der Methode schlägt jeden Median fremder Methoden (Nutzer-Vorgabe 2026-10-18); die
// Streuung fängt das Toleranzband in bilanz.js ab.
export const MIN_N_METHODE = 1;

// Qualitätsnote in die Mengen (T51, DR-026: „ein geprüftes Rezept vertrauen“): Gewicht je Rezept aus der Note 1–5. Ohne
// Note zählt 2 (wie Note 4), Note 2 und darunter zählt nicht. Mit höchstens 2 Rezepten je Zelle gilt das beste Rezept
// (bei gleicher Note der Median dieser Rezepte). Nur die Rollen-Mengen (`bp`) werden gewichtet — Toleranzbänder, Backen und
// Statistik-Anzeige rechnen mit dem ungewichteten Median (`medianRoh` bleibt in jeder Zelle erhalten).
export const QUALITAET_GEWICHT = (note) => (note == null ? 2 : Math.max(0, note - 2));

export function gewichteterMedian(werte, gewichte) {
  const p = werte.map((w, i) => ({ w, g: gewichte[i] })).filter((x) => x.w != null && Number.isFinite(x.w) && x.g > 0).sort((a, b) => a.w - b.w);
  if (!p.length) return null;
  const summe = p.reduce((s, x) => s + x.g, 0);
  let lauf = 0;
  for (let i = 0; i < p.length; i++) {
    lauf += p[i].g;
    if (lauf > summe / 2) return p[i].w;
    if (lauf === summe / 2) return (p[i].w + p[i + 1].w) / 2; // genau die Hälfte: Mitte zwischen den beiden Nachbarn
  }
  return p.at(-1).w;
}

// Zusammenfassung einer Größe über Rezepte; bei `gewichtet` ersetzt der Qualitäts-Median den Median (der rohe bleibt in `medianRoh`).
function summarizeQ(liste, fn, gewichtet) {
  const werte = liste.map(fn);
  const s = summarize(werte);
  if (!s || !gewichtet) return s;
  const noten = liste.map((r) => effektiveQualitaet(r));
  const mit = werte.map((w, i) => ({ w, note: noten[i] })).filter((x) => x.w != null && Number.isFinite(x.w));
  let median;
  if (mit.length <= 2) {
    const note = (x) => x.note ?? 4; // ohne Note wie Note 4 (QUALITAET_GEWICHT)
    const beste = Math.max(...mit.map(note));
    median = quantile(mit.filter((x) => note(x) === beste).map((x) => x.w), 0.5);
  } else {
    median = gewichteterMedian(werte, noten.map(QUALITAET_GEWICHT)) ?? s.median;
  }
  return { ...s, median, medianRoh: s.median };
}

// `gewichtet`: Standard aus QUALITAET_GEWICHTET (ein Schalter für alle Aufrufer). AUS, weil die Messung am Korpus (T51) zeigt:
// 32 von 171 Mengen-Zellen würden sich verschieben, in einzelnen um 10–58 % — ein Median springt zum Nachbarwert, sobald ein
// oder zwei abgeleitete Noten (Seitenwertung, Notiz-Stichwörter) die Waage kippen. Erst einschalten, wenn die Noten mehr
// Aussagekraft haben (Handnoten `qualitaet_manuell`); Test und Werkzeug rechnen mit `{ gewichtet: true }`.
export const QUALITAET_GEWICHTET = false;

export function stats(normalized, rollen = ROLLEN, { proMethode = true, gewichtet = QUALITAET_GEWICHTET } = {}) {
  const n = normalized.length;
  // Die Methode verschiebt Mengen (Vorteig-Brot braucht weniger Hefe, Creme mehr Fett als Rühr-Öl); der Median
  // über alle Methoden mischt das. Zellen mit zu wenig Rezepten fehlen hier und fallen auf die Variante zurück.
  const nachMethode = {};
  if (proMethode) for (const r of normalized) (nachMethode[r.methode] ??= []).push(r);
  const count = (fn) =>
    normalized.reduce((acc, r) => {
      const k = fn(r);
      if (k != null) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

  const count1 = (fn) => normalized.reduce((acc, r) => { for (const k of fn(r)) acc[k] = (acc[k] || 0) + 1; return acc; }, {}); // je Rezept mehrere Schlüssel
  // Gezielt gesuchte Rezepte (`auswahl: gezielt`, T83: „mit getrennten Eiern“) zählen für Mengen, nicht für Häufigkeiten
  const ungezielt = normalized.filter((r) => r.auswahl !== 'gezielt');
  const technikKeys = [...new Set(normalized.flatMap((r) => r.techniken || []))];
  return {
    n,
    bp: Object.fromEntries(rollen.map((r) => [r, summarizeQ(normalized, (x) => x.bp[r], gewichtet)])),
    methoden: ungezielt.reduce((acc, r) => ((acc[r.methode] = (acc[r.methode] || 0) + 1), acc), {}),
    // Menge je Zutat (T78): Median der Rolle unter den Rezepten, deren größter Posten dieser Rolle die Zutat ist (Eigelb vs. ganzes Ei)
    bpJeZutat: Object.fromEntries(rollen.map((ro) => {
      const nach = {};
      for (const r of normalized) {
        const top = (r.posten || []).filter((p) => p.rolle === ro).sort((a, b) => b.gramm - a.gramm)[0]?.zutat;
        if (top) (nach[top] ??= []).push(r.bp[ro]);
      }
      return [ro, Object.fromEntries(Object.entries(nach).map(([z, w]) => [z, summarize(w) ?? { n: 0, median: null }]))]; // n, min, q1, median, q3, max (T87)
    })),
    // Technik-Stufe gemessen (T83): Anteil der nicht gezielt gesuchten Rezepte mit der Technik; Trieb mit/ohne Technik aus allen
    techniken: Object.fromEntries(technikKeys.map((k) => {
      const mit = normalized.filter((r) => (r.techniken || []).includes(k));
      const ohne = normalized.filter((r) => !(r.techniken || []).includes(k));
      return [k, {
        n: ungezielt.length,
        anteil: ungezielt.length ? ungezielt.filter((r) => (r.techniken || []).includes(k)).length / ungezielt.length : null,
        trieb: { mit: { n: mit.length, ...summarize(mit.map((r) => r.bp.trieb ?? 0)) }, ohne: { n: ohne.length, ...summarize(ohne.map((r) => r.bp.trieb ?? 0)) } },
      }];
    })),
    fettTyp: count((r) => r.fettTyp),
    fettZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'fett')?.zutat),
    fluessigkeitZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'fluessigkeit')?.zutat ?? '—'),
    einlageZutat: count((r) => (r.zutaten || []).find((z) => z.rolle === 'einlage')?.zutat ?? '—'),
    sauer: normalized.filter((r) => r.sauer).length,
    // Vergleichsbasis (T67): in wie vielen Rezepten kommt eine Zutat, eine Rolle, eine Bilanz-Größe überhaupt vor?
    zutaten: count1((r) => [...new Set((r.zutaten || []).map((z) => z.zutat))]),
    rollenBelegt: Object.fromEntries(rollen.map((ro) => [ro, normalized.filter((r) => r.rollenGramm?.[ro] > 0).length])),
    bilanzBelegt: Object.fromEntries(Object.keys(GROESSEN).map((g) => [g, normalized.filter((r) => r.bilanz?.bp[g] > 0).length])),
    cluster: clusterBilden(normalized),
    // Gär-Temperaturen, die Rezepte ausdrücklich nennen (T52, rohe Angaben — die Engine löst sie mit temperaturen.json auf):
    // nennt über die Hälfte eine, gilt deren Median statt der Vorgabe der Operation.
    gareTemperaturen: normalized.map((r) => r.temperaturen?.gehen).filter((t) => t != null),
    einlage: normalized.filter((r) => r.hatEinlage).length,
    teigmasse: summarize(normalized.map((r) => r.teigmasse)),
    // Verteilung der Gesamtbilanz (Bäckerprozent) — Erfahrungs-Toleranz für T35
    bilanz: Object.fromEntries(Object.keys(GROESSEN).map((g) => [g, summarize(normalized.map((r) => r.bilanz?.bp[g]))])),
    // je Rezept Gefäß + Backwerte (T91): die Engine nimmt nur Rezepte derselben Gefäß-Familie (Springform backt kürzer als Kasten)
    backenListe: normalized.map((r) => ({ gefaess: r.gefaess, tempOU: r.backen?.tempOU ?? null, tempUmluft: r.backen?.tempUmluft ?? null, minuten: r.backen?.minuten ?? null })),
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
      qualitaet: effektiveQualitaet(r),
      qualitaetGrund: istManuell(r) ? `manuell gesetzt${r.qualitaet_grund ? ` (Vorschlag ${r.qualitaet}: ${r.qualitaet_grund})` : ''}` : r.qualitaet_grund ?? null,
    })),
    // Nur zur Anzeige (T50): geht in keine Mengenberechnung ein.
    qualitaet: summarize(normalized.map((r) => effektiveQualitaet(r))),
    unbekannt: normalized.flatMap((r) => r.unbekannt.map((z) => `${r.id}: ${z.zutat} (${z.menge} ${z.einheit})`)),
    proMethode: Object.fromEntries(
      Object.entries(nachMethode).filter(([, liste]) => liste.length >= MIN_N_METHODE).map(([m, liste]) => [m, stats(liste, rollen, { proMethode: false, gewichtet })]),
    ),
  };
}

// Varianten-Cluster (T05): Korpus nach Fett-Typ × Säure × Einlage gruppiert — zeigt, welche Gruppen es gibt und wie sie
// sich in Fett, Wasser und Zucker unterscheiden. Nur Gruppen mit mindestens einem Rezept, größte zuerst.
export function clusterBilden(normalized) {
  const gruppen = new Map();
  for (const r of normalized) {
    const fettTyp = r.fettTyp ?? 'kein';
    const key = `${fettTyp}|${r.sauer ? 'sauer' : 'neutral'}|${r.hatEinlage ? 'einlage' : 'ohne'}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, fettTyp, sauer: !!r.sauer, einlage: !!r.hatEinlage, rezepte: [] });
    gruppen.get(key).rezepte.push(r);
  }
  const n = normalized.length;
  return [...gruppen.values()].map(({ rezepte, ...g }) => ({
    ...g,
    n: rezepte.length,
    anteil: rezepte.length / n,
    ids: rezepte.map((r) => r.id),
    bilanz: Object.fromEntries(['fett', 'wasser', 'zucker'].map((k) => [k, summarize(rezepte.map((r) => r.bilanz?.bp[k]))])),
  })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export function haeufigste(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
