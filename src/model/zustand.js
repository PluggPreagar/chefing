// Zustandsänderungen der Oberfläche ohne DOM (testbar): Preset, Archetyp, Gefäß. Manuell gesetzte Mengen (state.mengen, T40) gelten nur
// für die Grundlage, in der der Vorschlag entstand: ein Wechsel von Preset, Archetyp oder Gefäß (anderer Korpus) setzt sie zurück.

// Jede Rolle trägt eine Liste von {zutat, anteil}; ein einfacher Wert wird zu einem Eintrag, null/undefined zu [].
export function alsEintraege(wert) {
  if (wert == null) return [];
  if (Array.isArray(wert)) return wert;
  return [{ zutat: wert, anteil: 1 }];
}

// Patch für ein Preset (Variante) des Archetyps: Gefäß, Standard-Methode, Best-of-Zutaten; Fixierungen und Mengen werden zurückgesetzt
export function presetPatch(arch, variante) {
  const v = arch.varianten[variante];
  const zutaten = {};
  for (const r of arch.rollen) zutaten[r.rolle] = alsEintraege(v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default);
  return { gefaess: v.gefaess, methode: null, mengen: {}, fixiert: { rollen: {}, zutaten: {} }, zutaten, techniken: {} };
}

// Technik ein-/ausschalten (DR-041). Beim Ausschalten bekommt eine Pflicht-Rolle, die nur die Technik leer
// erlaubt hat (Rührteig ohne Backpulver, Trieb aus Eischnee), wieder ihre Standard-Zutat.
export function technikPatch(state, arch, technik, key, an) {
  const patch = { techniken: { ...state.techniken, [key]: an } };
  if (an) return patch;
  const zutaten = { ...state.zutaten };
  for (const r of arch.rollen) {
    if (r.pflicht && (technik?.lockert || []).includes(r.rolle) && !zutaten[r.rolle]?.length) zutaten[r.rolle] = alsEintraege(r.default);
  }
  return { ...patch, zutaten };
}

// Patch für einen Archetyp-Wechsel: Standard-Zutaten, Mengen leer (das Preset folgt danach)
export function archetypPatch(arch, key) {
  return { archetyp: key, mengen: {}, zutaten: Object.fromEntries(arch.rollen.map((r) => [r.rolle, alsEintraege(r.default)])) };
}

// Gefäß-Wechsel ändert Variante und Korpus-Grundlage: manuelle Mengen entfallen
export const gefaessPatch = (gefaess) => ({ gefaess, mengen: {} });
