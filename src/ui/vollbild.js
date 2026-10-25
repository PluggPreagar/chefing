// Ablauf im Vollbild (T124, DR-080): der Ablauf-Kasten füllt den Bildschirm, bei Bedarf gedreht (Querformat auf dem Handy).
// Zwei Wege, damit es überall geht: die Vollbild-API des Browsers; fehlt sie oder wird sie verweigert (iPhone-Safari), füllt
// derselbe Kasten per CSS die Seite (Klasse `ablauf-voll`). Drehen: erst die Sperre der Bildschirm-Ausrichtung (nur im echten
// Vollbild und nur auf manchen Geräten), sonst wird der Kasten per CSS um 90° gedreht (Klasse `gedreht`).
// Die Steuerung kennt nur kleine Schnittstellen (panel, doc, scr), damit sie ohne Browser testbar ist.

export function erzeugeVollbild({ panel, doc, scr = {}, melden = () => {} }) {
  let offen = false;
  let echt = false;     // läuft die Vollbild-API?
  let gedreht = false;  // per CSS gedreht?

  const sperre = () => scr.orientation && typeof scr.orientation.lock === 'function';
  const stand = () => ({ offen, echt, gedreht });
  const zeige = () => {
    panel.classList.toggle('ablauf-voll', offen);
    panel.classList.toggle('gedreht', offen && gedreht);
    doc.body?.classList?.toggle('hat-vollbild', offen);
    melden(stand());
  };
  const entsperren = () => { try { scr.orientation?.unlock?.(); } catch { /* nichts gesperrt */ } };

  async function oeffnen() {
    if (offen) return stand();
    offen = true; gedreht = false; echt = false;
    if (typeof panel.requestFullscreen === 'function') {
      try { await panel.requestFullscreen({ navigationUI: 'hide' }); echt = true; } catch { /* verweigert: CSS-Vollbild */ }
    }
    if (echt && sperre()) { try { await scr.orientation.lock('landscape'); } catch { /* Gerät oder Browser erlaubt keine Sperre */ } }
    zeige();
    return stand();
  }

  function schliessen() {
    if (!offen) return stand();
    offen = false; gedreht = false;
    if (echt && doc.fullscreenElement) { try { const p = doc.exitFullscreen?.(); p?.catch?.(() => {}); } catch { /* schon draußen */ } }
    entsperren();
    echt = false;
    zeige();
    return stand();
  }

  // Ausrichtung wechseln: Sperre auf die andere Seite, sonst CSS-Drehung an/aus
  async function drehen() {
    if (!offen) return stand();
    if (echt && sperre() && !gedreht) {
      const hochformat = String(scr.orientation.type || '').startsWith('portrait');
      try { await scr.orientation.lock(hochformat ? 'landscape' : 'portrait'); zeige(); return stand(); } catch { /* weiter mit CSS */ }
    }
    gedreht = !gedreht;
    zeige();
    return stand();
  }

  // Esc im echten Vollbild: der Browser verlässt es selbst, der Kasten zieht nach
  function beiVollbildwechsel() {
    if (offen && echt && !doc.fullscreenElement) schliessen();
  }
  return { oeffnen, schliessen, drehen, beiVollbildwechsel, stand };
}

const SVG = (pfad) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="${pfad}"/></svg>`;
const ICON_VOLL = SVG('M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4');
const ICON_ZU = SVG('M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4');
const ICON_DREHEN = SVG('M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3');

// Knöpfe im Kopf des Ablaufs, nach DR-079 Aktionen mit festem Verb ohne Hervorhebung: „Vollbild“ (nur wenn zu), „Vollbild beenden“
// und „Drehen“ (nur wenn offen). Es wechselt nie eine Beschriftung, nur welche Aktion sichtbar ist.
// Fehlen sie (ältere index.html aus dem Cache, DR-037), werden sie angelegt.
export function initVollbild(panel, kopf, doc = document, scr = globalThis.screen) {
  const knopf = (id, icon, text, titel) => {
    let b = doc.getElementById(id);
    if (!b) {
      b = doc.createElement('button');
      b.id = id; b.type = 'button'; b.className = 'ablauf-voll-knopf ghost';
      kopf.append(b);
    }
    b.innerHTML = `${icon} ${text}`;
    b.title = titel;
    return b;
  };
  const voll = knopf('ablauf-voll', ICON_VOLL, 'Vollbild', 'Ablauf im Vollbild öffnen');
  const zu = knopf('ablauf-voll-zu', ICON_ZU, 'Vollbild beenden', 'Vollbild verlassen (Esc)');
  const dreh = knopf('ablauf-drehen', ICON_DREHEN, 'Drehen', 'Ablauf drehen (Quer- oder Hochformat)');
  const zeigeAktionen = (offen) => { voll.hidden = offen; zu.hidden = !offen; dreh.hidden = !offen; };
  zeigeAktionen(false);
  const v = erzeugeVollbild({ panel, doc, scr, melden: ({ offen }) => zeigeAktionen(offen) });
  voll.addEventListener('click', () => v.oeffnen());
  zu.addEventListener('click', () => v.schliessen());
  dreh.addEventListener('click', () => v.drehen());
  doc.addEventListener('fullscreenchange', v.beiVollbildwechsel);
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && v.stand().offen && !v.stand().echt) v.schliessen(); }); // im echten Vollbild übernimmt der Browser Esc
  return v;
}
