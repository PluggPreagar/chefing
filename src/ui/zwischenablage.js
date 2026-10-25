// Text in die Zwischenablage legen (DR-077: nach dem Absenden die Nummer der Meldung, damit man sie weitergeben kann).
// Erst die Clipboard-API (nur in sicheren Kontexten: https, localhost, 127.0.0.1), sonst der alte Weg über ein verstecktes Textfeld.
// Gibt true zurück, wenn kopiert wurde; wirft nie. nav und doc sind austauschbar, damit es ohne Browser testbar ist.
export async function inZwischenablage(text, { nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const t = String(text ?? '');
  if (!t) return false;
  try {
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(t); return true; }
  } catch { /* verweigert (keine Berechtigung, keine Nutzeraktion): weiter mit dem alten Weg */ }
  try {
    if (!doc?.body || typeof doc.execCommand !== 'function') return false;
    const feld = doc.createElement('textarea');
    feld.value = t;
    feld.setAttribute('readonly', '');
    feld.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    doc.body.append(feld);
    feld.select();
    const ok = doc.execCommand('copy');
    feld.remove();
    return ok === true;
  } catch {
    return false;
  }
}
