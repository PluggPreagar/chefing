// Temperatur als Bereich (T52, DR-028): eine Schreibweise für feste Werte, Spannen und benannte Bereiche.
// Zahl = fester Wert · {wert, tol} = Wert mit Spielraum · {min, max} = Spanne · Text = Name aus temperaturen.json ·
// {von: {rolle, feld}, faktor?, tol?} = abgeleitet aus einer Eigenschaft der gewählten Zutat (T56): z. B. Schmelzen bei
// Schmelzpunkt × 1,05; das Feld der Zutat darf selbst Zahl, Spanne oder Name sein. `kontext` = Eigenschaften je Rolle (rules.js propsOf).
// Intern immer {min, max, mitte, name, label}; das Modell rechnet mit `mitte`, die Breite zeigt die Unsicherheit.

const zahl = (x) => typeof x === 'number' && Number.isFinite(x);

export function temperaturBereich(spec, benannt = {}, kontext = null) {
  if (spec == null) return null;
  if (typeof spec === 'object' && spec.von) {
    const b = temperaturBereich(kontext?.[spec.von.rolle]?.[spec.von.feld], benannt);
    const faktor = spec.faktor ?? 1;
    const tol = spec.tol ?? 0;
    if (!b || !zahl(faktor) || faktor <= 0 || !zahl(tol) || tol < 0) return null;
    const min = b.min * faktor - tol;
    const max = b.max * faktor + tol;
    const unveraendert = faktor === 1 && tol === 0; // dann bleibt der Name des Zutaten-Feldes erhalten
    return { min, max, mitte: (min + max) / 2, name: unveraendert ? b.name : null, label: unveraendert ? b.label : null };
  }
  let min;
  let max;
  let name = null;
  let label = null;
  if (typeof spec === 'string') {
    const b = spec.startsWith('_') ? null : benannt?.[spec];
    if (!b || !zahl(b.min) || !zahl(b.max)) return null;
    ({ min, max } = b);
    name = spec;
    label = b.label ?? spec;
  } else if (zahl(spec)) {
    min = max = spec;
  } else if (typeof spec === 'object' && zahl(spec.wert) && (spec.tol == null || (zahl(spec.tol) && spec.tol >= 0))) {
    min = spec.wert - (spec.tol ?? 0);
    max = spec.wert + (spec.tol ?? 0);
  } else if (typeof spec === 'object' && zahl(spec.min) && zahl(spec.max)) {
    ({ min, max } = spec);
  } else {
    return null;
  }
  if (min > max) return null;
  return { min, max, mitte: (min + max) / 2, name, label };
}

// Faustformel Teigtemperatur (T56): Wassertemperatur, mit der der Teig die Zieltemperatur erreicht
// = 3 × Ziel − Mehl − Raum − Reibungswärme (alles in °C bzw. Kelvin); null bei fehlenden Zahlen.
export const wassertemperatur = ({ ziel, mehl, raum, reibung = 0 }) => ([ziel, mehl, raum, reibung].every(zahl) ? 3 * ziel - mehl - raum - reibung : null);

export const grad = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

// "118 °C", "87–97 °C", "4–7 °C (Kühlschrank)"
export function fmtTemperatur(b) {
  if (!b) return '';
  const wert = b.min === b.max ? `${grad(b.min)} °C` : `${grad(b.min)}–${grad(b.max)} °C`;
  return b.name ? `${wert} (${b.label})` : wert;
}

const median = (l) => {
  const s = [...l].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

// Typischer Bereich mehrerer Bereiche (Median von min, max und Mitte); null bei leerer Liste.
export function medianBereich(liste) {
  const l = liste.filter(Boolean);
  if (!l.length) return null;
  const gleich = l.every((b) => b.name && b.name === l[0].name); // alle nennen denselben Namen → Name bleibt erhalten
  return { min: median(l.map((b) => b.min)), max: median(l.map((b) => b.max)), mitte: median(l.map((b) => b.mitte)), name: gleich ? l[0].name : null, label: gleich ? l[0].label : null };
}

// Temperatur-Angabe einer Operation: Rezept (unter dem Zeit-Schlüssel) vor Vorgabe der Operation.
export const schrittTemperatur = (key, op, rezept) => rezept?.temperaturen?.[key] ?? op?.temperatur ?? null;

// Die Gare-Operation einer Methode (erster Schritt mit `gaerung: true`, in der Regel `gehen`); die Methode darf sie inline
// definieren (Kalte Führung: Kühlschrank), sonst gilt die Operation aus operations.json.
export function gareOperation(methode, methods, operations) {
  const inline = (methods?.[methode]?.sequenz || []).find((s) => typeof s === 'object' && s.gaerung === true);
  if (inline) return inline;
  const key = (methods?.[methode]?.sequenz || []).find((s) => typeof s === 'string' && operations?.[s]?.gaerung === true);
  return key ? operations[key] : operations?.gehen ?? null;
}
