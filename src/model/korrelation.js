import { ROLLEN } from './corpus.js';
import { summarize } from './units.js';

// Generische Korpus-Korrelationssuche (DR-019 Punkt 5, T32): durchsucht den Korpus nach
// bedingten Abhängigkeiten — "wenn Rolle B die Eigenschaft E=W hat, unterscheidet sich der
// Bäckerprozent-Median von Rolle Z auffällig" — als automatischer Vorschlags-Schritt, bevor ein
// Mensch daraus eine Regel in `erfahrungsregeln.json` formuliert (T23 ist die Vorstufe: das
// Daten-Format für bereits bekannte Regeln; hier kommen NEUE Kandidaten automatisch dazu).
//
// Bewusst tolerant bei wenig Daten (Nutzer-Vorgabe „try the mechanics with that few, we will
// stress it later"): blockiert nicht hart ab einer Mindestgröße, sondern markiert Kandidaten mit
// zu kleiner Stichprobe nur als `belastbar: false` — sichtbar, aber erkennbar unsicher. Das
// eigentliche Verlässlichkeits-Problem (DR-003: „Ausreißer verzerren IQR stark" bei ~7 Rezepten)
// bleibt bestehen und wird hier nicht weggerechnet, nur ehrlich ausgewiesen.

const EIGENSCHAFTEN = ['saeure', 'aggregat', 'unterkategorie', 'trieb_typ', 'bildet_gluten', 'cremig_schlagbar', 'quellfaehig'];

// Dominante Zutat einer Rolle in einem Korpus-Rezept — bei mehreren Einträgen derselben Rolle
// gewinnt die mit den meisten Gramm (gleiche Logik wie blendProps in rules.js, nur auf rohe
// Korpus-Zutatenlisten statt state.zutaten angewendet).
function dominanteZutat(rezept, rolle, ingredients) {
  const eintraege = (rezept.zutaten || []).filter((z) => z.rolle === rolle && ingredients[z.zutat]);
  if (!eintraege.length) return null;
  return eintraege.reduce((a, b) => ((b.menge || 0) > (a.menge || 0) ? b : a)).zutat;
}

// Sucht alle (Bedingungsrolle, Eigenschaft, Wert, Zielrolle)-Kombinationen mit einem auffälligen
// Median-Unterschied. `normalizedRecipes`: Ergebnis von corpus.js#normalizeRecipe je Rezept.
export function korrelationenSuchen(normalizedRecipes, ingredients, opts = {}) {
  const minN = opts.minN ?? 2; // absolute Untergrenze, um überhaupt einen Median zu bilden
  const belastbarN = opts.belastbarN ?? 5; // ab hier gilt der Vergleich als einigermaßen tragfähig
  const minUnterschied = opts.minUnterschied ?? 0.15; // relative Differenz, ab der ein Unterschied auffällt

  const kandidaten = [];
  for (const bRolle of ROLLEN) {
    for (const eigenschaft of EIGENSCHAFTEN) {
      const werte = new Set();
      for (const rezept of normalizedRecipes) {
        const z = dominanteZutat(rezept, bRolle, ingredients);
        const wert = z ? ingredients[z]?.[eigenschaft] : undefined;
        if (wert !== undefined && wert !== null) werte.add(wert);
      }
      if (werte.size < 2) continue; // keine Varianz im Korpus -> keine Korrelation prüfbar

      for (const wert of werte) {
        // Bei einer echten Booleschen Eigenschaft sind "wert=true" und "wert=false" nur
        // Spiegelbilder derselben Zweiteilung (dieselben zwei Gruppen, vertauscht) — nur eine
        // Richtung anzeigen, sonst doppelte Kandidaten mit invertiertem Faktor.
        if (wert === false && werte.has(true)) continue;
        const passt = [];
        const rest = [];
        for (const rezept of normalizedRecipes) {
          const z = dominanteZutat(rezept, bRolle, ingredients);
          (z && ingredients[z]?.[eigenschaft] === wert ? passt : rest).push(rezept);
        }
        if (passt.length < minN || rest.length < minN) continue;

        for (const zRolle of ROLLEN) {
          if (zRolle === bRolle) continue;
          const mit = summarize(passt.map((r) => r.bp[zRolle]));
          const ohne = summarize(rest.map((r) => r.bp[zRolle]));
          if (!mit || !ohne || mit.n < minN || ohne.n < minN || ohne.median === 0) continue;
          const unterschied = Math.abs(mit.median - ohne.median) / ohne.median;
          if (unterschied < minUnterschied) continue;
          kandidaten.push({
            bRolle, eigenschaft, wert, zRolle,
            medianMit: mit.median, medianOhne: ohne.median,
            nMit: mit.n, nOhne: ohne.n,
            faktor: mit.median / ohne.median,
            unterschied,
            belastbar: mit.n >= belastbarN && ohne.n >= belastbarN,
          });
        }
      }
    }
  }
  return kandidaten.sort((a, b) => (b.belastbar - a.belastbar) || b.unterschied - a.unterschied);
}
