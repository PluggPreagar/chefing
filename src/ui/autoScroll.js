// Autoscroll beim Aufklappen eines Schritts (DR-112): zeigt ein Detail, ohne dass man danach suchen muss.
// 1) Der Schritt davor steht oben im Bild, so kommt man leicht zurück. 2) Bleibt dabei der folgende Schritt unten unsichtbar, steht stattdessen der aufgeklappte
// Schritt selbst oben: der Platz für den aufgeklappten Inhalt geht der Rückwärts-Navigation vor.

// Reine Rechnung in Inhaltskoordinaten (Pixel vom Anfang des scrollbaren Inhalts): vorOben = Oberkante des Schritts davor (oder null), jetztOben = Oberkante
// des aufgeklappten Schritts, danachUnten = Unterkante des folgenden Schritts (beim letzten: Ende des Details), sicht = Höhe des sichtbaren Bereichs.
// Rückgabe: die neue Scrollposition.
export function scrollZiel({ vorOben = null, jetztOben, danachUnten = null, sicht, rand = 8 }) {
  const jetzt = Math.max(0, jetztOben - rand);
  if (vorOben == null) return jetzt;
  const vor = Math.max(0, vorOben - rand);
  if (danachUnten == null) return vor;
  return danachUnten - vor <= sicht ? vor : jetzt;
}

// nächster Vorfahr, der senkrecht scrollt (Vollbild-Kasten, Bildbereich), sonst die Seite
export function scrollBehaelter(el, fenster = globalThis) {
  for (let e = el?.parentElement; e && e !== fenster.document?.body; e = e.parentElement) {
    const oy = fenster.getComputedStyle(e).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

// vor, jetzt, danach: Elemente (oder null); danach darf das Ende des Details sein, wenn es keinen folgenden Schritt gibt
export function scrolleNachAufklappen({ vor = null, jetzt, danach = null }, fenster = globalThis) {
  if (!jetzt) return null;
  const c = scrollBehaelter(jetzt, fenster);
  const nullpunkt = c ? c.getBoundingClientRect().top - c.scrollTop : -fenster.scrollY;
  const sicht = c ? c.clientHeight : fenster.innerHeight;
  const oben = (e) => e.getBoundingClientRect().top - nullpunkt;
  const unten = (e) => e.getBoundingClientRect().bottom - nullpunkt;
  const ziel = scrollZiel({ vorOben: vor ? oben(vor) : null, jetztOben: oben(jetzt), danachUnten: danach ? unten(danach) : null, sicht });
  const ruhig = fenster.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  (c ?? fenster).scrollTo({ top: ziel, behavior: ruhig ? 'auto' : 'smooth' });
  return ziel;
}
