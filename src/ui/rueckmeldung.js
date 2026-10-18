import { baueMeldung, pruefeEingabe, meldeErgebnis, BEWERTUNG_TEXT, MAX_KOMMENTAR } from '../model/rueckmeldung.js';

// Formular „Hat es geklappt?“ (T53, DR-027): 1–5 Punkte, Kommentar, Häkchen „mit den vorgeschlagenen Mengen“.
// Nichts wird ohne Klick auf „Senden“ übertragen; „Was wird gesendet?“ zeigt vorher die genaue Meldung.
export function renderRueckmeldung(state, data, computed) {
  const box = el('details', 'rueckmeldung');
  box.append(el('summary', null, 'Hat es geklappt? Ergebnis melden'));
  const form = el('form', 'rueckmeldung-form');
  form.noValidate = true;

  const punkte = el('fieldset', 'rm-punkte');
  punkte.append(el('legend', null, 'Wie ist es geworden?'));
  for (let i = 1; i <= 5; i++) {
    const label = el('label', 'rm-punkt');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'bewertung'; radio.value = String(i);
    label.append(radio, el('span', null, `${i} · ${BEWERTUNG_TEXT[i]}`));
    punkte.append(label);
  }
  form.append(punkte);

  const kommentar = document.createElement('textarea');
  kommentar.rows = 3; kommentar.maxLength = MAX_KOMMENTAR; kommentar.name = 'kommentar';
  kommentar.placeholder = 'Was ist passiert? (optional — bitte keine persönlichen Daten)';
  form.append(el('label', 'rm-kommentar', 'Kommentar'), kommentar);

  const mengenLabel = el('label', 'rm-mengen');
  const mengen = document.createElement('input');
  mengen.type = 'checkbox'; mengen.checked = true;
  mengenLabel.append(mengen, el('span', null, ' Ich habe die vorgeschlagenen Mengen verwendet'));
  form.append(mengenLabel);

  // Honeypot: für Menschen unsichtbar, nicht anklickbar, nicht im Tab-Weg
  const falle = document.createElement('input');
  falle.type = 'text'; falle.name = 'website'; falle.tabIndex = -1; falle.autocomplete = 'off'; falle.className = 'rm-falle'; falle.setAttribute('aria-hidden', 'true');
  form.append(falle);

  const aktuell = () => {
    const gewaehlt = form.querySelector('input[name="bewertung"]:checked');
    const eingabe = { bewertung: gewaehlt ? Number(gewaehlt.value) : null, kommentar: kommentar.value, mengenWieVorgeschlagen: mengen.checked };
    return { eingabe, meldung: baueMeldung({ state, computed, eingabe, appVersion: data.appVersion }) };
  };

  const vorschau = el('details', 'rm-vorschau');
  vorschau.append(el('summary', null, 'Was wird gesendet?'));
  const pre = el('pre');
  vorschau.append(pre, el('p', 'fine', 'Wertung, Kommentar und die Rezeptdaten oben (Zutaten, Methode, Hinweise). Keine IP-Adresse, keine Cookies, kein Konto. Gespeichert wird auf dem Server dieser Seite.'));
  vorschau.addEventListener('toggle', () => { if (vorschau.open) pre.textContent = JSON.stringify(aktuell().meldung, null, 2); });
  form.addEventListener('input', () => { if (vorschau.open) pre.textContent = JSON.stringify(aktuell().meldung, null, 2); });
  form.append(vorschau);

  const knopf = el('button', 'rm-senden', 'Senden');
  knopf.type = 'submit';
  const status = el('p', 'rm-status');
  status.setAttribute('role', 'status');
  form.append(knopf, status);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { eingabe, meldung } = aktuell();
    const fehler = pruefeEingabe(eingabe);
    if (fehler) { status.textContent = fehler; status.className = 'rm-status rm-fehler'; return; }
    if (falle.value) meldung.website = falle.value;
    knopf.disabled = true;
    status.className = 'rm-status';
    status.textContent = 'Sende …';
    const r = await meldeErgebnis(meldung);
    if (r.ok) {
      status.textContent = 'Danke! Deine Meldung ist angekommen.';
      status.className = 'rm-status rm-ok';
      form.querySelectorAll('input, textarea').forEach((x) => { x.disabled = true; });
    } else {
      status.textContent = r.wiederholen ? `${r.fehler} Die Meldung bleibt gespeichert und wird beim nächsten Besuch noch einmal versucht.` : r.fehler;
      status.className = 'rm-status rm-fehler';
      knopf.disabled = !!r.wiederholen;
    }
  });

  box.append(form);
  return box;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
