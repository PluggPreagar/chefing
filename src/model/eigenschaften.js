// Zustands-Eigenschaften einer Zutat aus ihrer Temperatur (T62, DR-032): Aggregat und Form folgen dem Temperatur-Bereich der Zutat.
// Ohne Angabe gilt der unterstellte Bereich (temperaturen.json `unterstellt`, −20 bis 27 °C: Kühlschrank bis warmer Raum).
// Eine Anforderung gilt nur, wenn der GANZE Bereich sie erfüllt — sonst ist sie nicht garantiert und braucht eine Vorbereitung.
import { temperaturBereich } from './temperatur.js';

export const STANDARD_TEMPERATUR = 'unterstellt';

// Form: geordnete Skala von grob nach fein. Eine Anforderung heißt „mindestens kleinteilig“ (flüssig erfüllt sie mit).
export const FORM_SKALA = ['block', 'stueckig', 'broeselig', 'kleinteilig', 'fluessig'];
export const FORM_LABEL = { block: 'blockförmig', stueckig: 'stückig', broeselig: 'bröselig', kleinteilig: 'kleinteilig', fluessig: 'flüssig' };
const SKALEN = { form: FORM_SKALA };
const FORM_AUS_AGGREGAT = { fest: 'block', stueckig: 'stueckig', pulver: 'kleinteilig', fluessig: 'fluessig' };

export const standardBereich = (benannt) => temperaturBereich(STANDARD_TEMPERATUR, benannt);

// Aggregat aus Temperatur und Schmelzpunkt: ganz darunter fest, ganz darüber flüssig, dazwischen unbestimmt.
// Ohne Schmelzpunkt (Öl, Mehl, Milch) oder ohne Temperatur gilt das Aggregat der Zutat.
export function aggregatAus(bereich, ing) {
  const schmelz = ing?.schmelzpunkt_c;
  if (!bereich || typeof schmelz !== 'number') return ing?.aggregat;
  if (bereich.max < schmelz) return 'fest';
  if (bereich.min >= schmelz) return 'fluessig';
  return 'unbestimmt';
}

// Form: flüssig, wenn flüssig; sonst das Feld `form` der Zutat, sonst aus dem Aggregat; unbestimmt bleibt unbestimmt.
export function formVon(ing, aggregat) {
  if (aggregat === 'fluessig') return 'fluessig';
  if (aggregat === 'unbestimmt') return 'unbestimmt';
  return ing?.form ?? FORM_AUS_AGGREGAT[aggregat] ?? null;
}

// Cremig schlagbar (T62): hat die Zutat `aufschlag_temp`, entscheidet der Bereich — ganz darin ja, ganz daneben nein, sonst unbestimmt.
// Ohne `aufschlag_temp` oder ohne Temperatur gilt das Feld der Zutat.
export function cremigAus(bereich, ing, benannt) {
  if (!bereich || ing?.aufschlag_temp == null) return ing?.cremig_schlagbar;
  const soll = temperaturBereich(ing.aufschlag_temp, benannt);
  if (!soll) return ing.cremig_schlagbar;
  if (bereich.min >= soll.min && bereich.max <= soll.max) return true;
  if (bereich.max < soll.min || bereich.min > soll.max) return false;
  return 'unbestimmt';
}

// Gilt die Bedingung `b` für den Ist-Wert? `wert` = gleich; `mindestens` / `hoechstens` = auf der Skala der Eigenschaft (Form).
export function erfuellt(b, ist) {
  if (b.mindestens === undefined && b.hoechstens === undefined) return ist === b.wert;
  const skala = SKALEN[b.eigenschaft];
  const rang = skala ? skala.indexOf(ist) : -1;
  if (rang < 0) return false;
  return (b.mindestens === undefined || rang >= skala.indexOf(b.mindestens)) && (b.hoechstens === undefined || rang <= skala.indexOf(b.hoechstens));
}
