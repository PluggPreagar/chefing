import { alleOverrides } from '../model/overrides.js';
import { alleErrorRequests, errorRequestEinreichen, errorRequestEntfernen } from '../model/errorRequests.js';
import { alleUeberschreibbarenRegeln } from '../model/rules.js';

// Kandidatenliste + Error-Request (DR-019 Punkt 4, T29 — Schritt 3/3 des Feedback-Loops).
// Zwei Evidenzquellen für dieselbe Entscheidung (hart → empfohlen): (a) wiederholtes "hat
// funktioniert"-Feedback aus T28, (b) ein direkter Error-Request. Die App kann
// `operations.json` nicht selbst schreiben (statische Seite, kein Backend) — das hier ist nur
// die sichtbare Beweislage, die eigentliche Herabstufung bleibt manuelle Maintainer-Arbeit,
// wie schon die Korpus-Pflege (DR-003).
const SCHWELLE_JA = 2;

export function renderKandidaten(root, data, onChange) {
  root.replaceChildren();
  const katalog = alleUeberschreibbarenRegeln(data);
  const overrides = alleOverrides();
  const requests = alleErrorRequests();

  root.append(el('h2', null, 'Kandidaten für Regel-Lockerung'));
  root.append(el('p', 'legend', `Diese Liste ist nur Beweislage — Regeln liegen in operations.json und werden von Hand geändert, wie beim Erweitern des Rezept-Korpus. Kandidat ab ${SCHWELLE_JA}+ „hat funktioniert“-Antworten oder einem eingereichten Error-Request.`));

  const bewertet = katalog.map((k) => {
    const liste = overrides[k.id] || [];
    const ja = liste.filter((o) => o.ergebnis === 'ja').length;
    const nein = liste.filter((o) => o.ergebnis === 'nein').length;
    return { ...k, ja, nein };
  });
  const kandidaten = bewertet.filter((k) => k.ja >= SCHWELLE_JA);

  root.append(el('h3', null, 'Aus Feedback'));
  if (kandidaten.length) {
    for (const k of kandidaten) {
      root.append(el('p', 'note note-kaskade', `„${k.text}“ (${k.ausloeser}): ${k.ja} von ${k.ja + k.nein} Overrides haben funktioniert.`));
    }
  } else {
    root.append(el('p', 'fine', `Noch keine Regel mit ${SCHWELLE_JA}+ „hat funktioniert“-Antworten.`));
  }

  const offeneRequests = Object.entries(requests).flatMap(([regelId, liste]) =>
    liste.map((r) => ({ regelId, ...r, text: katalog.find((k) => k.id === regelId)?.text ?? regelId })),
  );
  root.append(el('h3', null, 'Eingereichte Error-Requests'));
  if (offeneRequests.length) {
    for (const r of offeneRequests) root.append(requestZeile(r, onChange));
  } else {
    root.append(el('p', 'fine', 'Noch keine Error-Requests eingereicht.'));
  }

  root.append(el('h3', null, 'Neuen Error-Request einreichen'));
  root.append(requestFormular(katalog, onChange));
}

function requestZeile(r, onChange) {
  const box = el('div', 'note note-override');
  box.append(el('span', null, `„${r.text}“ — ${r.begruendung}`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'override-btn';
  btn.textContent = 'Entfernen';
  btn.addEventListener('click', () => {
    errorRequestEntfernen(r.regelId, r.zeitpunkt);
    onChange();
  });
  box.append(btn);
  return box;
}

function requestFormular(katalog, onChange) {
  const form = document.createElement('form');
  form.className = 'request-form';

  const select = document.createElement('select');
  select.className = 'request-select';
  for (const k of katalog) {
    const opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = `${k.ausloeser}: ${k.text}`;
    select.append(opt);
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'request-textarea';
  textarea.placeholder = 'Begründung — z. B. „hat in dieser Kombination nachweislich funktioniert, weil …“';
  textarea.required = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'override-btn';
  submit.textContent = 'Einreichen';

  form.append(select, textarea, submit);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const begruendung = textarea.value.trim();
    if (!begruendung) return;
    errorRequestEinreichen(select.value, begruendung);
    onChange();
  });
  return form;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
