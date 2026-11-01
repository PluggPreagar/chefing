// Rezeptmenge skalieren (DR-122, T154 Phase 2): `state.skala` ist ein Faktor auf die Gefäß-Menge. Bäcker-% bleibt gleich, nur Gramm ändern sich;
// Backzeit und Temperatur bleiben die der Form (Gefäß-Regel aus DR-120), darum der Hinweis unten.
import { toGrams } from './units.js';

export const SKALA_MIN = 0.1;
export const SKALA_MAX = 10;

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

// Hinweis zur Form: mehr als eine Form heißt „n Ansätze“, unter etwa 70 % Füllung „kleinere Form“. Ohne Hitze (Mayonnaise) gibt es keine
// Backzeit, die Untergrenzen je Verfahren sind T153.
export function skalaHinweis(skala, vessel) {
  if (!vessel?.basis || Math.abs(skala - 1) < 0.05) return null;
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
