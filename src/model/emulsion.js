// Emulsions-Modell (DR-047, T77): welche Phase ist durchgehend, welche wird hineinverteilt und wie?
// Ein Schritt mit `phase` legt die Basis an (Butter + Zucker aufgeschlagen = Fett, Eischaum = Wasser; `luft`: die Basis
// hält eingeschlagene Luft). Ein Schritt mit `emulsion: {gibt, zugabe}` gibt die andere (oder dieselbe) Phase dazu.
// Regel: Kommt die andere Phase in eine luftige Basis, dann nur portionsweise oder im Strahl — auf einmal bricht die
// Emulsion (Crememethode: gerinnt) bzw. fällt der Schaum (Rühr-Öl, Schaummasse). Quellen: QUELLEN.md 2026-10-20.
// Werkzeug (T84, DR-053): mit dem Pürierstab im schmalen, hohen Gefäß ist „auf einmal“ richtig — er zerschlägt aber Schaum.

export const PHASE = { fett: 'Fett', wasser: 'Wasser' };
export const ZUGABE = { portionsweise: 'portionsweise', strahl: 'im dünnen Strahl', auf_einmal: 'auf einmal' };

// schritte: [{ op, label, ort }] in Ablauf-Reihenfolge; werkzeuge/orte: werkzeuge.json, orte.json
// → je Schritt { phase, luft, gibt, zugabe, text, problem, hinweis } oder null
export function emulsionsVerlauf(schritte, { werkzeuge = {}, orte = {} } = {}) {
  let basis = null; // { phase, luft, label }
  return schritte.map(({ op, label, ort }) => {
    const w = op.werkzeug ? werkzeuge[op.werkzeug] : null;
    if (op.phase) {
      basis = { phase: op.phase, luft: !!op.luft, label };
      return { phase: op.phase, luft: !!op.luft, text: `${PHASE[op.phase]} ist die durchgehende Phase${op.luft ? ' und hält die eingeschlagene Luft' : ''}` };
    }
    const e = op.emulsion;
    if (!e) return null;
    if (!basis) return { gibt: e.gibt, zugabe: e.zugabe, text: `${PHASE[e.gibt]} ${ZUGABE[e.zugabe]}` };
    const fremd = e.gibt !== basis.phase;
    const amMesser = e.zugabe === 'auf_einmal' && w?.auf_einmal;
    const zugabe = amMesser ? `${ZUGABE.auf_einmal}, ${w.text}` : ZUGABE[e.zugabe];
    const text = fremd ? `${PHASE[e.gibt]} in ${PHASE[basis.phase]}, ${zugabe}` : `mehr ${PHASE[e.gibt]}, ${zugabe}`;
    let problem = null;
    let hinweis = null;
    if (w?.zerstoert_luft && basis.luft) problem = `${label}: ${w.label} in der luftigen ${PHASE[basis.phase]}-Basis (${basis.label}) — ${w.hinweis_luft}`;
    else if (fremd && basis.luft && e.zugabe === 'auf_einmal' && !amMesser) {
      problem = `${label}: ${PHASE[e.gibt]} auf einmal in die luftige ${PHASE[basis.phase]}-Basis (${basis.label}) — ${basis.phase === 'fett' ? 'die Emulsion bricht, die Masse gerinnt' : 'der Schaum fällt zusammen'}. Portionsweise oder im dünnen Strahl zugeben.`;
    }
    if (w?.gefaess_form && orte[ort]?.form !== w.gefaess_form) hinweis = `${label}: ${w.hinweis_gefaess}`;
    return { phase: basis.phase, luft: basis.luft, gibt: e.gibt, zugabe: e.zugabe, werkzeug: op.werkzeug ?? null, text, problem, hinweis };
  });
}
