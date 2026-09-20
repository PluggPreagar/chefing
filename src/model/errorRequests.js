// Error-Request-Erfassung (DR-019 Punkt 4/Nachtrag "soften it like error-request", T29 —
// Schritt 3/3 des Feedback-Loops). Zweiter, direkter Weg zur Herabstufung neben der
// automatischen Auswertung wiederholten Override-Feedbacks (T28): der Nutzer meldet eine
// `hart`-Regel wie einen Fehlerbericht gegen das Physik-Modell — Regel + Begründung, ohne
// vorher erst mehrfach überschreiben zu müssen. Landet in derselben Kandidatenliste wie das
// gesammelte Feedback (siehe `src/ui/kandidaten.js`).
//
// Persistenz: `localStorage`, wie bei `overrides.js` — die App kann `operations.json` nicht
// selbst schreiben (statische Seite, kein Backend), die eigentliche Herabstufung bleibt
// manuelle Maintainer-Arbeit. Diese Liste ist nur die Beweislage dafür.

const KEY = 'chefing_error_requests_v1';

function laden() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function speichern(alle) {
  try {
    localStorage.setItem(KEY, JSON.stringify(alle));
  } catch {
    // Privater Modus/deaktiviertes localStorage — Komfort-Feature, kein Blocker für die App.
  }
}

// Alle eingereichten Error-Requests, gruppiert nach Regel-`id`. { [regelId]: [{zeitpunkt, begruendung}] }
export function alleErrorRequests() {
  return laden();
}

export function errorRequestEinreichen(regelId, begruendung) {
  const alle = laden();
  const liste = alle[regelId] || [];
  liste.push({ zeitpunkt: new Date().toISOString(), begruendung });
  alle[regelId] = liste;
  speichern(alle);
}

// Nimmt einen eigenen Request zurück (z. B. Tippfehler, Doppel-Einreichung) — reine
// Listen-Hygiene, kein "Ablehnen" durch einen Maintainer (das passiert außerhalb der App).
export function errorRequestEntfernen(regelId, zeitpunkt) {
  const alle = laden();
  const liste = (alle[regelId] || []).filter((r) => r.zeitpunkt !== zeitpunkt);
  if (liste.length) alle[regelId] = liste;
  else delete alle[regelId];
  speichern(alle);
}
