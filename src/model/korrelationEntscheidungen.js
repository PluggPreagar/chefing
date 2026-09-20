// Bestätigen/Verwerfen für Korrelations-Kandidaten (DR-019 Punkt 5, T32) — gleiches Muster wie
// overrides.js/errorRequests.js: localStorage, rein clientseitig, kein Backend. Ein "Bestätigt"
// heißt hier NICHT, dass die Regel automatisch aktiv wird — die App kann erfahrungsregeln.json
// nicht selbst schreiben. Es markiert nur, dass ein Mensch den Kandidaten geprüft und für
// sinnvoll befunden hat; das Übertragen in die Datei bleibt manuelle Maintainer-Arbeit (wie bei
// den Error-Requests aus T29).

const KEY = 'chefing_korrelationen_v1';

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

// { [kandidatId]: 'bestaetigt' | 'verworfen' }
export function alleEntscheidungen() {
  return laden();
}

export function entscheidungSetzen(kandidatId, status) {
  const alle = laden();
  alle[kandidatId] = status;
  speichern(alle);
}

// Stabile id für einen Kandidaten, unabhängig vom Array-Index (der sich bei jeder Suche ändern
// kann, sobald sich der Korpus oder die Schwellenwerte ändern).
export function kandidatId(variante, k) {
  return `${variante}:${k.bRolle}.${k.eigenschaft}=${k.wert}->${k.zRolle}`;
}
