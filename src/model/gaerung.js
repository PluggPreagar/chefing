// Gärmodell (T49, DR-026, T52): die Physik bleibt über die Methoden gleich — wenig Hefe wird durch lange Gare ausgeglichen.
// Parameter stehen als Daten in modelle.json (mit Quelle), hier nur die Rechnung.
// ln(Gare in Min.) = ln_konstante + exponent · ln(Hefe %) − temp_koeffizient · (Temperatur °C − temp_ref)
// Mindestzeit (T58): nach unten gilt zusätzlich die Mindestzeit der Gare-Operation (z. B. ohne Kneten braucht das Gluten
// Stunden, egal wie viel Hefe), nach oben (Übergärung) allein das Modell.

export const gaerungModell = (data) => data?.modelle?.gaerung ?? null;

const ln = Math.log;
const mitTemp = (m, tempC) => tempC ?? m.temp_standard;

export function erwarteteGare(hefeBp, tempC, m) {
  return Math.exp(m.ln_konstante + m.exponent * ln(hefeBp) - m.temp_koeffizient * (mitTemp(m, tempC) - m.temp_ref));
}

// Erwartung nach unten: nie kürzer als die Mindestzeit (Minuten; null = keine)
export const mitMindestzeit = (erwartet, mindest) => Math.max(erwartet, mindest ?? 0);

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

// Ergebnis für Engine und Anzeige: erwartete Gärzeit bei der Mitte des Temperatur-Bereichs (mit Mindestzeit), `fenster` über
// die Breite des Bereichs (wärmer = kürzer). `kuehl` bleibt als Kurzform für die Rückmeldung (Kühlschrank-Gare).
export function gaerungErgebnis({ gare, hefeBp, gareTemp, gareTempText, mindest, berechnet, pruefung }, m) {
  const temp = gareTemp?.mitte ?? m.temp_standard;
  const breit = gareTemp && gareTemp.min !== gareTemp.max;
  const modell = erwarteteGare(hefeBp, temp, m);
  const erwartet = mitMindestzeit(modell, mindest);
  return {
    gare, hefeBp, temp, tempText: gareTempText || null, kuehl: temp <= 10,
    modell, mindest: mindest ?? null, mindestGilt: erwartet > modell, erwartet,
    fenster: breit ? [mitMindestzeit(erwarteteGare(hefeBp, gareTemp.max, m), mindest), mitMindestzeit(erwarteteGare(hefeBp, gareTemp.min, m), mindest)] : null,
    berechnet, warnFaktor: m.warn_faktor, pruefung,
    hinweis: m.exponent_hinweis ?? null,
  };
}

// Plausibilitätsprüfung (Stufe 1): meldet, wenn Gärzeit und Hefemenge um mehr als `warn_faktor` vom Modell abweichen.
// `tempText` (z. B. "4–7 °C (Kühlschrank)") steht nur in der Meldung; gerechnet wird mit `temp` (Mitte des Bereichs).
// Zu lang: gegen das Modell allein. Zu kurz: gegen das Modell, aber nie unter die Mindestzeit.
export function pruefeGaerung({ hefeBp, gare, temp, tempText, mindest }, m) {
  if (!(hefeBp > 0) || !(gare > 0)) return null;
  const modell = erwarteteGare(hefeBp, temp, m);
  const erwartet = mitMindestzeit(modell, mindest);
  const hefe = `${hefeBp.toFixed(1).replace('.', ',')} % Hefe`;
  const bei = tempText ? ` bei ${tempText}` : '';
  const richtwert = `Richtwert aus dem Gärmodell, Spielraum etwa ×${String(m.warn_faktor).replace('.', ',')}`;
  if (gare / modell > m.warn_faktor) {
    return { art: 'zu_lang', erwartet: modell, faktor: gare / modell, text: `Gare ${fmtDauer(gare)}${bei} mit ${hefe}: das Modell erwartet etwa ${fmtDauer(modell)} — der Teig übergärt (${richtwert}).` };
  }
  if (gare / erwartet < 1 / m.warn_faktor) {
    const grund = erwartet > modell ? `mindestens ${fmtDauer(erwartet)} (Mindestzeit der Gare, das Modell allein sagt ${fmtDauer(modell)})` : `etwa ${fmtDauer(erwartet)}`;
    return { art: 'zu_kurz', erwartet, faktor: gare / erwartet, text: `Gare ${fmtDauer(gare)}${bei} mit ${hefe}: das Modell erwartet ${grund} — der Teig geht nicht genug auf (${richtwert}).` };
  }
  return null;
}
