import { alleOverrides, overrideAntwort } from '../model/overrides.js';

// Rückfrage-UI (DR-019 Punkt 4, T28 — Schritt 2/3 des Feedback-Loops). Zeigt alle Overrides,
// die VOR diesem Seitenaufruf erfasst wurden und noch offen sind — "hat's trotzdem
// funktioniert?" wird also erst beim NÄCHSTEN Besuch gefragt, nie in der Sitzung, in der der
// Override selbst gesetzt wurde (da wurde ja noch nicht gebacken). `sessionStart` markiert
// diese Grenze; unabhängig von der aktuellen Zutatenauswahl, damit eine offene Rückfrage nicht
// verloren geht, nur weil der Nutzer inzwischen ein anderes Rezept zusammenklickt.
export function renderRueckfragen(root, sessionStart, onAnswered) {
  const offene = [];
  for (const [regelId, liste] of Object.entries(alleOverrides())) {
    for (const eintrag of liste) {
      if (eintrag.ergebnis === 'offen' && eintrag.zeitpunkt < sessionStart) offene.push({ regelId, ...eintrag });
    }
  }

  root.replaceChildren();
  root.hidden = offene.length === 0;
  if (!offene.length) return;

  root.append(el('h2', null, 'Offene Rückfragen'));
  for (const o of offene) root.append(frage(o, onAnswered));
}

function frage(o, onAnswered) {
  const box = el('div', 'rueckfrage');
  const kontext = o.kontext ? ` (${o.kontext})` : '';
  box.append(el('p', 'rueckfrage-text', `Du hattest überschrieben: „${o.text || o.regelId}“${kontext}. Hat es funktioniert?`));
  const row = el('div', 'rueckfrage-buttons');
  row.append(
    knopf('Ja, hat funktioniert', () => antworten('ja')),
    knopf('Nein, war doch nötig', () => antworten('nein')),
  );
  box.append(row);
  function antworten(ergebnis) {
    overrideAntwort(o.regelId, o.zeitpunkt, ergebnis);
    onAnswered();
  }
  return box;
}

function knopf(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'rueckfrage-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
