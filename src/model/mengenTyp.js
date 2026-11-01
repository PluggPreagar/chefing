// Anzeige der Mengen im Rezept (DR-120): Menge (g, ml, Stück), Bäcker-% oder beides. Reine Entscheidung und Erklärtext, ohne DOM.
export const MENGEN_TYPEN = ['menge', 'prozent', 'beides'];

// Gespeicherte Wahl (pro Browser); ohne Wahl: schmal nur die Menge (die Tabelle passt sonst nicht), breit beides wie bisher
export const wirksamerTyp = ({ gespeichert, schmal }) => (MENGEN_TYPEN.includes(gespeichert) ? gespeichert : schmal ? 'menge' : 'beides');

// Erklärung „Was ist Bäcker-%?“ mit einem Beispiel aus dem aktuellen Rezept (Zutat in g gegen die Bezugszutat in g)
export function baeckerText(computed) {
  const bezug = computed?.bezugLabel ?? 'Mehl';
  const liste = computed?.zutatenListe ?? [];
  const inGramm = (z) => z.einheit === 'g' && Number(z.menge) > 0 && Number(z.bp) > 0;
  const basis = liste.find((z) => inGramm(z) && Math.round(z.bp) === 100);
  const beispiel = liste.find((z) => z !== basis && inGramm(z) && Math.round(z.bp) !== 100);
  const regel = `Bäcker-% sind alle Mengen als Prozent vom Gewicht ${bezug === 'Mehl' ? 'des Mehls' : `von ${bezug}`}: ${bezug} = 100 %. So lassen sich Rezepte jeder Größe vergleichen, und die Spanne aus dem Korpus (Q1–Q3) zeigt, was üblich ist.`;
  if (!basis || !beispiel) return regel;
  return `${regel} Hier: ${beispiel.label} ${beispiel.menge} g bei ${basis.menge} g ${bezug} = ${Math.round(beispiel.bp)} %.`;
}
