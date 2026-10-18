// Überraschungs-Bericht aus dem Korpus (T54, DR-027): Welche Korpus-Rezepte „sollten nicht klappen, taten es aber“?
// Reine Rechnung ohne Dateizugriff (tools/ueberraschungen.mjs lädt die Daten). Drei Blickwinkel:
//   1) Grenzen am Rand: wie weit liegt das extremste Rezept von jeder Grenze entfernt, und trägt ein EINZELNES Rezept sie?
//      (DR-020: ein Rezept genügt, um eine empfohlen-Grenze zu öffnen — dann lohnt der Blick, ob es ein Ausreißer ist.)
//   2) Gärmodell: Rezepte, deren Gärzeit um mehr als `gaerungFaktor` vom Modell abweicht, und ob ganze Gruppen systematisch
//      abweichen (Hinweis auf eine fehlende Größe).
//   3) Muster: welche Eigenschaften (Methode, Gär-Temperatur, Trieb …) bei den Gärmodell-Abweichlern häufiger vorkommen als bei
//      allen vom Gärmodell geprüften Rezepten.
// Der Korpus enthält nur Erfolge (Überlebenden-Auswahl): der Bericht zeigt Muster, nie „sollte klappen, tat es nicht“ —
// dafür sind die Rückmeldungen (T53) da.
import { normalizeRecipe } from './corpus.js';
import { messwert } from './bilanz.js';
import { erwarteteGare, mitMindestzeit, vorteigDosis } from './gaerung.js';
import { temperaturBereich, schrittTemperatur, gareOperation } from './temperatur.js';

// vorteigReife: ab so vielen Minuten gilt ein Vorteig als Reife-Vorteig (Poolish, Biga), darunter als Hefe-Ansatz (Dampfl)
export const STANDARD = { reserve: 0.2, nahe: 0.1, rand: 0.05, luecke: 0.1, gaerungFaktor: 2.5, minGruppe: 3, minMuster: 2, minLift: 1.5, vorteigReife: 240 };

const median = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// Dominante Zutat einer Rolle (meiste Menge) im rohen Rezept
function dominante(rezept, rolle) {
  const e = (rezept.zutaten || []).filter((z) => z.rolle === rolle);
  return e.length ? e.reduce((a, b) => ((b.menge || 0) > (a.menge || 0) ? b : a)).zutat : null;
}

// Grobe Stufe der Gär-Temperatur für Gruppen und Muster (Kühlschrank / Raumtemperatur / warm)
const tempStufe = (t) => (t == null ? 'warm' : t < 10 ? 'kalt' : t < 25 ? 'raum' : 'warm');

function eigenschaften(r, stufe, hefe) {
  const e = [`variante:${r.variante}`, `methode:${r.methode}`, `gare:${stufe}`];
  if (hefe > 0) e.push(`hefe:${hefe < 1.5 ? 'wenig (< 1,5 %)' : hefe > 6 ? 'viel (> 6 %)' : 'mittel'}`);
  for (const rolle of ['fett', 'fluessigkeit', 'trieb']) { const z = dominante(r, rolle); if (z) e.push(`${rolle}:${z}`); }
  if ((r.zutaten || []).some((z) => z.rolle === 'einlage')) e.push('einlage:ja');
  return e;
}

// Reife-Vorteige gegen das Gärmodell (Dosis = Reifezeit / Zeit bis zur Verdopplung); Hefe-Ansätze (< vorteigReife) getrennt,
// weil sie nur die Hefe wecken und nicht reifen.
function vorteigAuswertung(liste, s) {
  const reife = liste.filter((r) => r.art === 'reife');
  const ansatz = liste.filter((r) => r.art === 'ansatz');
  return {
    gepruefte: liste.length,
    reife: { n: reife.length, median: median(reife.map((r) => r.dosis)), rezepte: reife },
    ansatz: { n: ansatz.length, median: median(ansatz.map((r) => r.dosis)), rezepte: ansatz },
    auffaellig: reife.filter((r) => r.dosis > s.gaerungFaktor || r.dosis < 1 / s.gaerungFaktor).map((r) => r.id),
  };
}

// korpora: {archetypKey: {variante: [rohe Rezepte]}}; archetypes/ingredients/grenzen/modelle/methods/operations/temperaturen:
// die JSON-Daten (die letzten drei liefern die Gär-Temperatur; ohne sie rechnet das Modell mit `temp_standard`)
export function ueberraschungenSuchen({ archetypes, ingredients, grenzen, modelle, korpora, methods, operations, temperaturen }, schwellen = {}) {
  const s = { ...STANDARD, ...schwellen };
  const grenzZeilen = [];
  const gaerRezepte = [];
  const vorteigRezepte = [];
  const alle = []; // {id, eigenschaften[]}
  const randIds = new Set(); // Rezepte nahe an einer Grenze
  const model = modelle?.gaerung ?? null;

  for (const [ak, arch] of Object.entries(archetypes)) {
    if (ak.startsWith('_') || !korpora?.[ak]) continue;
    const rollen = arch.rollen.map((r) => r.rolle);
    const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? 'struktur';
    const rezepte = Object.values(korpora[ak]).flat().map((roh) => ({ roh, n: normalizeRecipe(roh, ingredients, { rollen, referenz }) }));

    // 1) Grenzen am Rand
    for (const g of grenzen?.archetypen?.[ak] || []) {
      for (const art of ['min', 'max']) {
        const bound = g[art];
        if (bound == null || bound === 0) continue;
        const werte = rezepte
          .map(({ roh, n }) => ({ id: roh.id, wert: messwert(g, n.bilanz) }))
          .filter((x) => x.wert != null && Number.isFinite(x.wert))
          .map((x) => ({ ...x, reserve: art === 'max' ? (bound - x.wert) / Math.abs(bound) : (x.wert - bound) / Math.abs(bound) }))
          .sort((a, b) => a.reserve - b.reserve);
        if (!werte.length) continue;
        const [e, z] = werte;
        const nahe = werte.filter((x) => x.reserve <= s.nahe).length;
        const verletzt = e.reserve < 0;
        if (!verletzt && e.reserve > s.reserve) continue;
        grenzZeilen.push({
          archetyp: ak, id: g.id, strenge: g.strenge, art, grenze: bound,
          extrem: { id: e.id, wert: e.wert }, zweiter: z ? { id: z.id, wert: z.wert } : null,
          reserve: e.reserve, nahe, verletzt,
          getragenVonEinem: !verletzt && nahe === 1 && !!z && z.reserve - e.reserve > s.luecke,
          amKorpusGelockert: /Korpus|angehoben|gesenkt|kalibriert/.test(g.quelle || ''),
        });
        for (const x of werte) if (x.reserve <= s.rand) randIds.add(x.id);
      }
    }

    // 2) Gärmodell
    for (const { roh, n } of rezepte) {
      const z = roh.zeiten || {};
      const T = (z.vorteig ?? 0) + (z.gehen ?? 0) + (z.stueckgare ?? 0);
      const hefe = n.bilanz.bp.hefe;
      if (model && roh.methode !== 'hefe_vorteig' && z.gehen > 0 && hefe > 0 && T > 0) {
        const gareOp = gareOperation(roh.methode, methods, operations);
        const temp = temperaturBereich(schrittTemperatur('gehen', gareOp, roh), temperaturen)?.mitte ?? null;
        const erwartet = mitMindestzeit(erwarteteGare(hefe, temp, model), gareOp?.zeit?.min); // wie die Engine (T58)
        gaerRezepte.push({ id: roh.id, roh, variante: roh.variante, methode: roh.methode, temp, stufe: tempStufe(temp), hefe, T, erwartet, faktor: T / erwartet });
      }
      // Vorteig-Angaben (T57), gleich welche Methode (Hefe-Ansätze laufen seit T60 als direkte Führung): echte Vorteig-Rezepte
      // stehen nicht im Gärmodell-Fit, der Bericht prüft sie unabhängig
      if (model && roh.vorteig?.mehl_g > 0 && roh.vorteig.hefe_g_frisch > 0 && z.vorteig > 0) {
        const temp = temperaturBereich(roh.temperaturen?.vorteig ?? operations?.vorteig_reifen?.temperatur, temperaturen)?.mitte ?? null;
        const dosis = vorteigDosis({ hefeG: roh.vorteig.hefe_g_frisch, mehlG: roh.vorteig.mehl_g, dauer: z.vorteig, temp }, model);
        vorteigRezepte.push({ id: roh.id, dauer: z.vorteig, temp, hefeBp: (roh.vorteig.hefe_g_frisch / roh.vorteig.mehl_g) * 100, dosis, art: z.vorteig >= s.vorteigReife ? 'reife' : 'ansatz' });
      }
      alle.push(roh.id);
    }
  }

  const auffaellig = gaerRezepte.filter((r) => r.faktor > s.gaerungFaktor || r.faktor < 1 / s.gaerungFaktor).sort((a, b) => Math.abs(Math.log(b.faktor)) - Math.abs(Math.log(a.faktor)));
  const gruppen = {};
  for (const r of gaerRezepte) (gruppen[`${r.methode}/${r.stufe}`] ??= []).push(r);
  const gaerGruppen = Object.entries(gruppen).map(([gruppe, l]) => {
    const zuLang = l.filter((r) => r.faktor > s.gaerungFaktor).length;
    const zuKurz = l.filter((r) => r.faktor < 1 / s.gaerungFaktor).length;
    const mehrheitLang = zuLang / l.length >= 0.5, mehrheitKurz = zuKurz / l.length >= 0.5;
    return {
      gruppe, n: l.length, median: median(l.map((r) => r.faktor)), zuLang, zuKurz,
      systematisch: l.length >= s.minGruppe && (mehrheitLang || mehrheitKurz),
      richtung: mehrheitLang ? 'Rezepte brauchen länger als das Modell sagt' : mehrheitKurz ? 'Rezepte brauchen kürzer als das Modell sagt' : null,
    };
  }).sort((a, b) => b.n - a.n);

  // 3) Muster: Eigenschaften der auffälligen Rezepte gegenüber den Rezepten, die das Gärmodell tatsächlich prüft
  // (nicht gegenüber dem ganzen Korpus — sonst wirkt alles am Hefeteig „überrepräsentiert“), getrennt nach Richtung
  // (Rezepte brauchen länger bzw. kürzer als das Modell sagt), weil beide Richtungen verschiedene Ursachen haben.
  const zaehle = (liste) => { const c = {}; for (const r of liste) for (const p of eigenschaften(r.roh, r.stufe, r.hefe)) c[p] = (c[p] || 0) + 1; return c; };
  const imVergleich = zaehle(gaerRezepte);
  const musterFuer = (richtung, liste) => {
    const beiUe = zaehle(liste);
    return liste.length === 0 ? [] : Object.entries(beiUe)
      .map(([p, c]) => ({ richtung, eigenschaft: p, nAuffaellig: c, nVergleich: imVergleich[p], anteilAuffaellig: c / liste.length, anteilVergleich: imVergleich[p] / gaerRezepte.length, lift: (c / liste.length) / (imVergleich[p] / gaerRezepte.length) }))
      .filter((m) => m.nAuffaellig >= s.minMuster && m.lift >= s.minLift)
      .sort((a, b) => b.lift - a.lift || b.nAuffaellig - a.nAuffaellig);
  };
  const zuLang = auffaellig.filter((r) => r.faktor > 1);
  const zuKurz = auffaellig.filter((r) => r.faktor < 1);
  const muster = { zuLang: musterFuer('länger als das Modell', zuLang), zuKurz: musterFuer('kürzer als das Modell', zuKurz), nZuLang: zuLang.length, nZuKurz: zuKurz.length };

  grenzZeilen.sort((a, b) => a.reserve - b.reserve);
  return {
    schwellen: s,
    rezepte: alle.length,
    grenzen: grenzZeilen,
    randRezepte: randIds.size,
    gaerung: model ? { gepruefte: gaerRezepte.length, auffaellig: auffaellig.map(({ roh, ...rest }) => rest), gruppen: gaerGruppen, muster } : null,
    vorteig: model ? vorteigAuswertung(vorteigRezepte, s) : null,
  };
}
