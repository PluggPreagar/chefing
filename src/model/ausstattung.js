// Ausstattung (T92, DR-060): Schritte nennen eine Anforderung, Werkzeuge erfüllen sie mit einem Zeit-Faktor.
// Die Küche wählt man einmal; ohne Wahl gilt die Standard-Ausstattung aus werkzeuge.json (Alltags-Küche).

const werkzeugEintraege = (werkzeuge) => Object.entries(werkzeuge || {}).filter(([k, w]) => !k.startsWith('_') && k !== 'anforderungen' && w && typeof w === 'object' && 'label' in w);

// wählbare Werkzeuge (nicht `immer`) → an/aus nach `standard`
export const standardAusstattung = (werkzeuge) => Object.fromEntries(werkzeugEintraege(werkzeuge).filter(([, w]) => !w.immer).map(([k, w]) => [k, !!w.standard]));
export const waehlbareWerkzeuge = (werkzeuge) => werkzeugEintraege(werkzeuge).filter(([, w]) => !w.immer);

export function vorhanden(werkzeuge, ausstattung, key) {
  const w = werkzeuge?.[key];
  if (!w) return false;
  return !!w.immer || !!{ ...standardAusstattung(werkzeuge), ...(ausstattung || {}) }[key];
}

// schnellstes vorhandenes Werkzeug für die Anforderung; faktor relativ zum Basis-Werkzeug des Schritts
export function werkzeugWahl(anforderung, werkzeuge, ausstattung) {
  const kandidaten = werkzeugEintraege(werkzeuge).filter(([k, w]) => w.kann?.[anforderung.art] != null && vorhanden(werkzeuge, ausstattung, k));
  if (!kandidaten.length) return null;
  // schnellstes zuerst; bei gleichem Faktor das, das allein arbeitet (Küchenmaschine, T93)
  const [key, w] = kandidaten.sort((a, b) => a[1].kann[anforderung.art] - b[1].kann[anforderung.art] || (b[1].haende_frei ? 1 : 0) - (a[1].haende_frei ? 1 : 0))[0];
  const basis = werkzeuge[anforderung.basis];
  const basisFaktor = basis?.kann?.[anforderung.art] ?? 1;
  return { key, label: w.label, faktor: w.kann[anforderung.art] / basisFaktor, basisLabel: basis?.label ?? anforderung.basis, haendeFrei: !!w.haende_frei, handgriff: w.handgriff ?? null, ergebnisHinweis: w.ergebnis_hinweise?.[anforderung.art] ?? null };
}
