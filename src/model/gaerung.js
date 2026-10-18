// Gärmodell (T49, DR-026, T52): die Physik bleibt über die Methoden gleich — wenig Hefe wird durch lange Gare ausgeglichen.
// Parameter stehen als Daten in modelle.json (mit Quelle), hier nur die Rechnung.
// ln(Gare in Min.) = ln_konstante + exponent · ln(Hefe %) − temp_koeffizient · (Temperatur °C − temp_ref)

export const gaerungModell = (data) => data?.modelle?.gaerung ?? null;

const ln = Math.log;
const mitTemp = (m, tempC) => tempC ?? m.temp_standard;

export function erwarteteGare(hefeBp, tempC, m) {
  return Math.exp(m.ln_konstante + m.exponent * ln(hefeBp) - m.temp_koeffizient * (mitTemp(m, tempC) - m.temp_ref));
}

// Umkehrung: welche Hefemenge (Bäckerprozent, Frischhefe-Äq.) passt zu einer Gärzeit bei dieser Temperatur?
export function hefeFuerGare(minuten, tempC, m) {
  return Math.exp((ln(minuten) - m.ln_konstante + m.temp_koeffizient * (mitTemp(m, tempC) - m.temp_ref)) / m.exponent);
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

// Ergebnis für Engine und Anzeige: erwartete Gärzeit bei der Mitte des Temperatur-Bereichs, `fenster` über dessen Breite
// (wärmer = kürzer). `kuehl` bleibt als Kurzform für die Rückmeldung (Kühlschrank-Gare).
export function gaerungErgebnis({ gare, hefeBp, gareTemp, gareTempText, berechnet, pruefung }, m) {
  const temp = gareTemp?.mitte ?? m.temp_standard;
  const breit = gareTemp && gareTemp.min !== gareTemp.max;
  return {
    gare, hefeBp, temp, tempText: gareTempText || null, kuehl: temp <= 10,
    erwartet: erwarteteGare(hefeBp, temp, m),
    fenster: breit ? [erwarteteGare(hefeBp, gareTemp.max, m), erwarteteGare(hefeBp, gareTemp.min, m)] : null,
    berechnet, warnFaktor: m.warn_faktor, pruefung,
  };
}

// Plausibilitätsprüfung (Stufe 1): meldet, wenn Gärzeit und Hefemenge um mehr als `warn_faktor` vom Modell abweichen.
// `tempText` (z. B. "4–7 °C (Kühlschrank)") steht nur in der Meldung; gerechnet wird mit `temp` (Mitte des Bereichs).
export function pruefeGaerung({ hefeBp, gare, temp, tempText }, m) {
  if (!(hefeBp > 0) || !(gare > 0)) return null;
  const erwartet = erwarteteGare(hefeBp, temp, m);
  const faktor = gare / erwartet;
  const hefe = `${hefeBp.toFixed(1).replace('.', ',')} % Hefe`;
  const bei = tempText ? ` bei ${tempText}` : '';
  const richtwert = `Richtwert aus dem Gärmodell, Spielraum etwa ×${String(m.warn_faktor).replace('.', ',')}`;
  if (faktor > m.warn_faktor) {
    return { art: 'zu_lang', erwartet, faktor, text: `Gare ${fmtDauer(gare)}${bei} mit ${hefe}: das Modell erwartet etwa ${fmtDauer(erwartet)} — der Teig übergärt (${richtwert}).` };
  }
  if (faktor < 1 / m.warn_faktor) {
    return { art: 'zu_kurz', erwartet, faktor, text: `Gare ${fmtDauer(gare)}${bei} mit ${hefe}: das Modell erwartet etwa ${fmtDauer(erwartet)} — der Teig geht nicht genug auf (${richtwert}).` };
  }
  return null;
}
