import { alleOverrides } from '../model/overrides.js';
import { alleErrorRequests, errorRequestEinreichen, errorRequestEntfernen } from '../model/errorRequests.js';
import { alleUeberschreibbarenRegeln } from '../model/rules.js';
import { korrelationenSuchen } from '../model/korrelation.js';
import { alleEntscheidungen, entscheidungSetzen, kandidatId } from '../model/korrelationEntscheidungen.js';

// Kandidatenliste + Error-Request (DR-019 Punkt 4, T29 — Schritt 3/3 des Feedback-Loops).
// Zwei Evidenzquellen für dieselbe Entscheidung (hart → empfohlen): (a) wiederholtes "hat
// funktioniert"-Feedback aus T28, (b) ein direkter Error-Request. Die App kann
// `operations.json` nicht selbst schreiben (statische Seite, kein Backend) — das hier ist nur
// die sichtbare Beweislage, die eigentliche Herabstufung bleibt manuelle Maintainer-Arbeit,
// wie schon die Korpus-Pflege (DR-003).
const SCHWELLE_JA = 2;

export function renderKandidaten(root, data, korpusNormalisiert, onChange) {
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

  // Korpus-Korrelationssuche (DR-019 Punkt 5, T32) — eine ANDERE Evidenzquelle als die beiden
  // oberen Abschnitte: kein Downgrade einer bestehenden hart-Regel, sondern ein Vorschlag für
  // eine ganz NEUE Erfahrungs-Regel (siehe erfahrungsregeln.json, T23), automatisch aus dem
  // Korpus abgeleitet. Nutzer-Vorgabe: Mechanik jetzt schon zeigen, auch mit wenig Korpus-Daten
  // ("try the mechanics with that few, we will stress it later") — deshalb bewusst tolerant:
  // Kandidaten mit kleiner Stichprobe werden angezeigt, aber deutlich als "vorläufig" markiert.
  root.append(el('h3', null, 'Aus Korpus-Korrelation (neue Erfahrungs-Regeln)'));
  root.append(el('p', 'legend', 'Automatisch im Rezept-Korpus gefunden, bedingter Zusammenhang zwischen zwei Rollen. Vorschlag, keine aktive Regel — erst nach „Bestätigen“ formuliert ein Mensch daraus einen Eintrag in erfahrungsregeln.json (T23).'));
  root.append(korrelationsKandidaten(data, korpusNormalisiert, onChange));
}

function korrelationsKandidaten(data, korpusNormalisiert, onChange) {
  const box = el('div', null);
  const entscheidungen = alleEntscheidungen();
  const rollenLabel = (r) => data.archetypes.ruehrteig.rollen.find((x) => x.rolle === r)?.label ?? r;

  const varianten = Object.keys(data.archetypes.ruehrteig.varianten);
  const alleKandidaten = varianten.flatMap((variante) => {
    const rezepte = korpusNormalisiert?.[variante] || [];
    return korrelationenSuchen(rezepte, data.ingredients).map((k) => ({ ...k, variante, id: kandidatId(variante, k) }));
  });
  const offen = alleKandidaten.filter((k) => !entscheidungen[k.id]);

  if (!offen.length) {
    box.append(el('p', 'fine', 'Keine auffälligen Zusammenhänge gefunden (oder alle bereits bestätigt/verworfen).'));
    return box;
  }

  for (const k of offen) {
    const zeile = el('div', 'note ' + (k.belastbar ? 'note-kaskade' : 'note-warn'));
    const richtung = k.medianMit > k.medianOhne ? 'höher' : 'niedriger';
    const text = `${data.archetypes.ruehrteig.varianten[k.variante]?.label ?? k.variante}: wenn „${rollenLabel(k.bRolle)}“ ${k.eigenschaft}=${k.wert}, ist der Bäckerprozent-Median von „${rollenLabel(k.zRolle)}“ ${richtung} (${k.medianOhne.toFixed(0)} % → ${k.medianMit.toFixed(0)} %, Faktor ${k.faktor.toFixed(2)}, n=${k.nMit}/${k.nOhne})`;
    zeile.append(el('span', null, text + (k.belastbar ? '' : ' — vorläufig, kleine Stichprobe')));
    const knoepfe = el('span', 'note-buttons');
    knoepfe.append(
      knopf('Bestätigen', () => { entscheidungSetzen(k.id, 'bestaetigt'); onChange(); }),
      knopf('Verwerfen', () => { entscheidungSetzen(k.id, 'verworfen'); onChange(); }),
    );
    zeile.append(knoepfe);
    box.append(zeile);
  }
  return box;
}

function knopf(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'override-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
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
