// Gärmodell (T49, DR-026): die Physik bleibt über die Methoden gleich — wenig Hefe wird durch lange Gare ausgeglichen.
// Parameter stehen als Daten in modelle.json (mit Quelle), hier nur die Rechnung.
// ln(Gare in Min.) = ln_konstante + exponent · ln(Hefe %) + ln(kuehl_faktor) · kalt

export const gaerungModell = (data) => data?.modelle?.gaerung ?? null;

const ln = Math.log;

export function erwarteteGare(hefeBp, kuehl, m) {
  return Math.exp(m.ln_konstante + m.exponent * ln(hefeBp) + (kuehl ? ln(m.kuehl_faktor) : 0));
}

// Umkehrung: welche Hefemenge (Bäckerprozent, Frischhefe-Äq.) passt zu einer Gärzeit?
export function hefeFuerGare(minuten, kuehl, m) {
  return Math.exp((ln(minuten) - m.ln_konstante - (kuehl ? ln(m.kuehl_faktor) : 0)) / m.exponent);
}

// Summe der Gärzeit aus den Schritten mit `gaerung: true`; Vorteig (`gaerung: 'vorteig'`) macht das Modell unanwendbar.
export function gaerungsZeit(schritte) {
  let summe = 0;
  for (const s of schritte) {
    if (s.gaerung === 'vorteig') return { summe: null, vorteig: true };
    if (s.gaerung === true) summe += s.dauer ?? 0;
  }
  return { summe: summe > 0 ? summe : null, vorteig: false };
}

export function fmtDauer(min) {
  const m = Math.round(min);
  if (m < 90) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

// Plausibilitätsprüfung (Stufe 1): meldet, wenn Gärzeit und Hefemenge um mehr als `warn_faktor` vom Modell abweichen.
export function pruefeGaerung({ hefeBp, gare, kuehl }, m) {
  if (!(hefeBp > 0) || !(gare > 0)) return null;
  const erwartet = erwarteteGare(hefeBp, kuehl, m);
  const faktor = gare / erwartet;
  const hefe = `${hefeBp.toFixed(1).replace('.', ',')} % Hefe`;
  const temp = kuehl ? ' im Kühlschrank' : '';
  const richtwert = `Richtwert aus dem Gärmodell, Spielraum etwa ×${String(m.warn_faktor).replace('.', ',')}`;
  if (faktor > m.warn_faktor) {
    return { art: 'zu_lang', erwartet, faktor, text: `Gare ${fmtDauer(gare)}${temp} bei ${hefe}: das Modell erwartet etwa ${fmtDauer(erwartet)} — der Teig übergärt (${richtwert}).` };
  }
  if (faktor < 1 / m.warn_faktor) {
    return { art: 'zu_kurz', erwartet, faktor, text: `Gare ${fmtDauer(gare)}${temp} bei ${hefe}: das Modell erwartet etwa ${fmtDauer(erwartet)} — der Teig geht nicht genug auf (${richtwert}).` };
  }
  return null;
}
