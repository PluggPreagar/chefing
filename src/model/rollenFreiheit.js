// Substitutions-Freiheit je Rolle (T10, DR-030): wie viel passiert, wenn man in einer Rolle die Zutat wechselt?
//   frei      — kein Wechsel erzeugt eine neue Meldung (z. B. Aroma, Einlage)
//   empfohlen — mindestens ein Wechsel erzeugt eine Warnung oder einen Hinweis, aber keiner macht das Rezept ungültig
//   strikt    — mindestens ein Wechsel macht das Rezept ungültig (harte Regel oder harte Grenze)
//   null      — die Rolle bietet keine Wahl: eine Pflicht-Rolle mit nur einer Option (Feld `substitution` fehlt dann); bei optionalen
//               Rollen zählt „keine“ als Wahl
// Gemessen, nicht geschätzt: für jede Variante wird jede Option der Rolle gegen das Best-of-Preset gerechnet (Meldungen, die
// nur mit der Option entstehen). `archetypes.json` trägt das Ergebnis als `substitution`; der Test hält beides zusammen.
import { compute } from './engine.js';

const E = (w) => (w == null ? [] : Array.isArray(w) ? w : [{ zutat: w, anteil: 1 }]);
const RANG = { frei: 0, empfohlen: 1, strikt: 2 };
// Wahlmöglichkeiten einer Rolle: ihre Optionen, bei optionalen Rollen zusätzlich „keine“ (null)
const wahl = (rolle) => [...rolle.optionen, ...(rolle.pflicht ? [] : [null])];

export function rollenFreiheit(archetypKey, data, korpusStats) {
  const arch = data.archetypes[archetypKey];
  const ergebnis = Object.fromEntries(arch.rollen.map((r) => [r.rolle, { stufe: wahl(r).length < 2 ? null : 'frei', belege: [] }]));
  for (const [vk, v] of Object.entries(arch.varianten)) {
    const basis = {};
    for (const r of arch.rollen) basis[r.rolle] = E(v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default);
    const rechne = (z) => compute({ archetyp: archetypKey, gefaess: v.gefaess, methode: null, fixiert: { rollen: {}, zutaten: {} }, zutaten: z }, data, korpusStats);
    const grund = rechne(basis);
    const bekannt = new Set([...grund.warnungen, ...grund.toleranzHinweise, ...grund.gruende]);
    for (const rolle of arch.rollen) {
      if (ergebnis[rolle.rolle].stufe == null) continue;
      for (const opt of wahl(rolle)) {
        if ((basis[rolle.rolle][0]?.zutat ?? null) === opt) continue;
        const c = rechne({ ...basis, [rolle.rolle]: E(opt) });
        const neu = [...c.warnungen, ...c.toleranzHinweise, ...c.gruende].filter((m) => !bekannt.has(m));
        const stufe = c.status === 'invalid' && grund.status !== 'invalid' ? 'strikt' : neu.length ? 'empfohlen' : 'frei';
        if (RANG[stufe] > RANG[ergebnis[rolle.rolle].stufe]) ergebnis[rolle.rolle].stufe = stufe;
        if (stufe !== 'frei' && ergebnis[rolle.rolle].belege.length < 3) ergebnis[rolle.rolle].belege.push(`${vk}: ${opt ?? 'keine'} → ${stufe}`);
      }
    }
  }
  return ergebnis;
}
