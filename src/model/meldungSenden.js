// Fehlermeldung an den Server senden (DR-077, Ergänzung zu DR-044): dieselbe Meldung wie der ZIP-Download, per POST an
// chefing-issue.php. Rein (ohne DOM), damit es testbar ist. Scheitert das Senden, bleibt der ZIP-Download als Rückfall.

// Das ZIP geht als Base64 mit; der Server nimmt höchstens so viel an (chefing-issue.php: ISSUE_MAX_ZIP).
export const MAX_ZIP_BYTES = 12582912;

export function base64Von(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); // in Stücken: kein Stapelüberlauf
  return btoa(s);
}

const TEXT = {
  404: 'Der Meldeweg ist hier nicht eingerichtet.',
  413: 'Die Meldung ist zu groß zum Senden.',
  429: 'Gerade zu viele Meldungen — bitte später noch einmal.',
};

// → { ok: true, id } oder { ok: false, fehler, status? }; wirft nie
export async function sendeFehlermeldung({ titel, md, metaJson, zipBytes }, { url = './chefing-issue.php', fetchFn = globalThis.fetch } = {}) {
  if (zipBytes.length > MAX_ZIP_BYTES) return { ok: false, fehler: 'Die Meldung ist mit den Anhängen zu groß zum Senden.' };
  let antwort;
  try {
    antwort = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel, issue_md: md, meta_json: metaJson, zip_b64: base64Von(zipBytes) }),
    });
  } catch {
    return { ok: false, fehler: 'Keine Verbindung.' };
  }
  let inhalt = null;
  try { inhalt = await antwort.json(); } catch { /* keine JSON-Antwort */ }
  if (antwort.ok && inhalt?.ok) return { ok: true, id: inhalt.id ?? null };
  // 200 ohne JSON-Antwort: ein statischer Server hat die Datei ausgeliefert, statt die Meldung anzunehmen (lokal: just serve starten)
  if (antwort.ok && !inhalt) return { ok: false, fehler: 'Der Server nimmt hier keine Meldungen an (keine gültige Antwort).', status: antwort.status };
  const fehler = TEXT[antwort.status]
    ?? (antwort.status >= 500 ? 'Der Server konnte die Meldung nicht speichern.' : `Die Meldung wurde abgelehnt (${inhalt?.fehler ?? antwort.status}).`);
  return { ok: false, fehler, status: antwort.status };
}
