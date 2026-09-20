// Override-Erfassung (DR-019 Punkt 4, T25 — Schritt 1/3 des Feedback-Loops).
//
// Eine `hart`-Voraussetzung ist eine Modellannahme, keine unumstößliche Wahrheit — der Nutzer
// kann bewusst sagen "ich probiere es trotzdem" und das System merkt sich das, um später zu
// fragen, ob es funktioniert hat (T28) und daraus eine Kandidatenliste für eine Herabstufung
// hart → empfohlen aufzubauen (T29). "Override" schaltet hier nichts frei — eine `invalid`-
// Rezeptur ist schon heute vollständig sichtbar und nutzbar (siehe `recipeCard.js`) — es ist
// reine Beweis-Erfassung.
//
// Persistenz: `localStorage`, rein clientseitig im Browser des Nutzers. Das ist die einzig
// realistische Option ohne Backend (DR-005, statische Seite) — nichts wird übertragen, nichts
// verlässt das Gerät. `operations.json` selbst kann die Laufzeit-App nicht schreiben (statische
// JSON-Datei im Repo); die eigentliche Herabstufung einer Regel bleibt manuelle Maintainer-
// Arbeit, wie schon die Korpus-Pflege (DR-003).

const KEY = 'chefing_overrides_v1';

function laden() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    // Privater Modus, deaktiviertes localStorage, kaputtes JSON — Override-Erfassung ist ein
    // Komfort-Feature, kein Kernpfad. Die App funktioniert unverändert weiter, nur ohne Gedächtnis.
    return {};
  }
}

function speichern(alle) {
  try {
    localStorage.setItem(KEY, JSON.stringify(alle));
  } catch {
    // s. o. — stilles Scheitern, kein Blocker für die App.
  }
}

// Alle erfassten Overrides, gruppiert nach Regel-`id`. { [regelId]: [{zeitpunkt, kontext, ergebnis}] }
export function alleOverrides() {
  return laden();
}

// Erfasst einen neuen Override-Versuch für eine Regel. `kontext` ist ein kurzer Text (z. B. die
// aktuell gewählten Zutaten), damit der Nutzer bei der Rückfrage (T28) noch weiß, was er probiert hat.
export function overrideErfassen(regelId, kontext) {
  const alle = laden();
  const liste = alle[regelId] || [];
  liste.push({ zeitpunkt: new Date().toISOString(), kontext, ergebnis: 'offen' });
  alle[regelId] = liste;
  speichern(alle);
}

// Gibt die Liste der Overrides für eine Regel zurück (leer, falls keine erfasst wurden).
export function overridesFuer(regelId) {
  return laden()[regelId] || [];
}
