// Rezeptmenge skalieren (DR-122, T154 Phase 2): `state.skala` ist ein Faktor auf die Gefäß-Menge. Bäcker-% bleibt gleich, nur Gramm ändern sich;
// Backzeit und Temperatur bleiben die der Form (Gefäß-Regel aus DR-120), darum der Hinweis unten.
// Portionen (DR-123): eine Portion ist, was eine Person isst (`portion_g` je Gefäß, Schätzung); n Portionen ergeben den Faktor. Eine festgelegte
// Zutat (Basis „Zutat“, DR-124) geht vor, bis man die Basis wechselt; danach gilt wieder die gemerkte Portionenzahl.
import { toGrams } from './units.js';

export const SKALA_MIN = 0.1;
export const SKALA_MAX = 10;

// Portionsgröße je Esser als Faktor (Wenig-, Normal-, Vielesser; Büfett-Mengen 600 | 800 | 1000 g, Verbraucherzentrale)
export const GROESSEN = { wenig: { faktor: 0.75, label: 'Wenig' }, normal: { faktor: 1, label: 'Normal' }, viel: { faktor: 1.25, label: 'Viel' } };
export const gueltigeGroesse = (g) => (GROESSEN[g] ? g : 'normal');

// Gramm einer Zutat aus der Eingabe in der angezeigten Einheit (g, ml, Stk); null bei ungültiger Eingabe
export function eingabeInGramm(ing, menge, einheit) {
  if (!Number.isFinite(menge) || menge <= 0) return null;
  if (einheit === 'Stk') return menge * (ing?.umrechnung?.stk ?? 55); // wie fromGrams: Eier zählen in Stück
  return toGrams(ing, menge, einheit);
}

// Neuer Faktor, wenn eine Zutat von `istGramm` (gilt beim jetzigen Faktor `skala`) auf `zielGramm` gesetzt wird; null, wenn die Eingabe
// ungültig ist oder der Faktor außerhalb von SKALA_MIN bis SKALA_MAX läge
export function skalaFuerMenge(skala, istGramm, zielGramm) {
  if (!(istGramm > 0) || !(zielGramm > 0)) return null;
  const neu = skala * (zielGramm / istGramm);
  return neu >= SKALA_MIN && neu <= SKALA_MAX ? neu : null;
}

export const gueltigeSkala = (s) => (Number.isFinite(s) && s >= SKALA_MIN && s <= SKALA_MAX ? s : 1);

// Gramm Teig je Portion (Schätzung je Gefäß mal Portionsgröße); null, wenn das Gefäß keine Portion kennt (Brotlaib, Mayonnaise: T153)
export const portionGramm = (vessel, groesse) => (vessel?.portion_g > 0 ? vessel.portion_g * GROESSEN[gueltigeGroesse(groesse)].faktor : null);

// Faktor für n Portionen; null bei ungültiger Zahl, ohne Portionsgröße oder außerhalb von SKALA_MIN bis SKALA_MAX
export function skalaFuerPortionen(vessel, n, groesse) {
  const pg = portionGramm(vessel, groesse);
  if (!pg || !(n > 0)) return null;
  const s = (n * pg) / vessel.teigmasse_g;
  return s >= SKALA_MIN && s <= SKALA_MAX ? s : null;
}

// Die Referenzzutat der Basis „Zutat“ (DR-124): die gewählte, sonst die oberste der Rezeptur (Mehl); null bei anderer Basis
export function referenzZutat(state, zutatenListe) {
  if (state.basis !== 'zutat') return null;
  return zutatenListe.some((z) => z.zutat === state.skalaZutat) ? state.skalaZutat : (zutatenListe[0]?.zutat ?? null);
}

// Welcher Faktor gilt und woher er kommt: 'zutat' (Basis Zutat oder festgelegt), 'portionen' (gemerkte Zahl) oder 'gefaess' (Menge der Form)
export function wirksameSkala(state, vessel) {
  const manuell = gueltigeSkala(state.skala);
  if (state.basis === 'zutat' || manuell !== 1) return { skala: manuell, quelle: 'zutat' }; // Basis Zutat gilt auch beim Faktor 1, sonst sprängen die Zahlen
  const p = skalaFuerPortionen(vessel, state.portionen, state.portionsgroesse);
  return p != null ? { skala: p, quelle: 'portionen' } : { skala: 1, quelle: 'gefaess' };
}

// Angaben zur Portion für die Oberfläche: Gramm je Portion, die Zahl bei der gezeigten Menge, höchste wählbare Zahl, Stück je Portion (nur abgeleitet,
// bei Gefäßen mit mehreren Stück wie Muffin oder Pfannkuchen)
export function portionInfo(vessel, groesse, teigmasse, quelle) {
  const pg = portionGramm(vessel, groesse);
  if (!pg) return null;
  const jeStueck = vessel.stueck > 1 ? vessel.teigmasse_g / vessel.stueck : null;
  return {
    gramm: pg, groesse: gueltigeGroesse(groesse), aktiv: quelle === 'portionen',
    n: teigmasse / pg, max: Math.floor((SKALA_MAX * vessel.teigmasse_g) / pg),
    stueck: jeStueck ? Math.round((pg / jeStueck) * 2) / 2 : null, // auf halbe Stück, ein Muffin ist nicht genauer zu zählen
  };
}

// Hinweis zur Form: mehr als eine Form heißt „n Ansätze“, unter etwa 70 % Füllung „kleinere Form“. Ohne Hitze (Mayonnaise) gibt es keine
// Backzeit, die Untergrenzen je Verfahren sind T153.
export function skalaHinweis(skala, vessel) {
  if (!vessel?.basis || Math.abs(skala - 1) < 0.1) return null;
  const basis = vessel.teigmasse_g;
  const gesamt = Math.round(basis * skala);
  if (skala >= 1.5) {
    const n = Math.round(skala);
    return `${n} Ansätze zu je etwa ${Math.round(basis * skala / n)} g in „${vessel.label}“: Backzeit und Temperatur gelten je Ansatz.`;
  }
  if (skala > 1) return `${gesamt} g sind mehr, als „${vessel.label}“ fasst (${basis} g): größere Form wählen. Backzeit und Temperatur gelten nur für ${basis} g.`;
  if (skala < 0.7) return `${gesamt} g füllen „${vessel.label}“ nur zu etwa ${Math.round(skala * 100)} %: kleinere Form wählen, die Backzeit wird kürzer als angegeben.`;
  return null;
}

// Stückzutaten (Eier) sind nur ganz teilbar: weicht die gezeigte Zahl um mehr als 15 % vom Rechenwert ab, steht ein Hinweis (nur bei skalierter Menge)
export function rundungsHinweise(skala, zutatenListe, ingredients) {
  if (Math.abs(skala - 1) < 0.01) return [];
  return zutatenListe.filter((z) => z.einheit === 'Stk').flatMap((z) => {
    const exakt = z.gramm / (ingredients[z.zutat]?.umrechnung?.stk ?? 55);
    if (!(exakt > 0) || Math.abs(z.menge - exakt) / exakt <= 0.15) return [];
    return [`${z.label}: rechnerisch ${String(Math.round(exakt * 10) / 10).replace('.', ',')} Stück, gezeigt ${z.menge}; ${z.label} ist nur ganz teilbar, die übrigen Mengen bleiben beim Rechenwert.`];
  });
}
