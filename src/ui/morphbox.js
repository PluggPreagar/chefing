import { evaluateAll, technikStufe, wirksameTechniken } from '../model/rules.js';
import { haeufigste } from '../model/corpus.js';
import { gefaessPatch, technikPatch } from '../model/zustand.js';
import { standardAusstattung, waehlbareWerkzeuge } from '../model/ausstattung.js';
import { iconHtml } from './icons.js';

const STATUS_ICON = { ok: '✓', prep: '~', invalid: '✗' };

export function renderMorphbox(root, state, data, computed, korpusStats, onChange) {
  const arch = data.archetypes[state.archetyp];
  const variante = arch.varianten[computed.variante];
  const bestof = variante?.bestof ?? {};
  const st = korpusStats[computed.variante];
  const bestMethode = st ? haeufigste(st.methoden) : null;

  root.replaceChildren();

  root.append(
    dimension('Gefäß', 'Bestimmt Teigmasse, Temperatur, Zeit — und welcher Referenz-Korpus gilt.',
      arch.gefaesse.map((g) => option({
        label: data.vessels[g].label,
        sub: `${data.vessels[g].teigmasse_g} g Teig`,
        selected: state.gefaess === g,
        bestof: Object.values(arch.varianten).some((v) => v.gefaess === g),
        onClick: () => onChange(gefaessPatch(g)),
      }))),
  );

  root.append(
    dimension(arch.methode_label ?? 'Methode', arch.methode_hinweis ?? 'Auto wählt die bewährteste gültige Methode. Manuell zeigt, warum eine Kombination (nicht) geht.',
      [
        // „Auto → …“ nennt immer die Auto-Wahl, auch wenn von Hand eine andere Methode gewählt ist (T81)
        option({ label: 'Auto', sub: `→ ${data.methods[computed.autoMethodKey ?? computed.methodKey].label}`, selected: state.methode == null, onClick: () => onChange({ methode: null }) }),
        ...arch.methoden.map((m) => {
          const e = computed.evals[m];
          return option({
            label: data.methods[m].label,
            sub: `${STATUS_ICON[e.status]} ${e.status === 'ok' ? 'möglich' : e.status === 'prep' ? 'mit Vorbereitung' : 'nicht möglich'}`,
            selected: state.methode === m,
            bestof: m === bestMethode,
            status: e.status,
            title: ([...e.gruende, ...e.warnungen, ...(e.zustaende || []).map((z) => `${z.fuer} braucht die Zutat in einem bestimmten Zustand (siehe Rezept).`)].join('\n') || data.methods[m].kurz) + (state.methode === m ? '\nNochmal klicken: zurück zu Auto' : ''),
            onClick: () => onChange({ methode: state.methode === m ? null : m }), // Klick auf die gewählte Methode wählt sie ab (T81)
          });
        }),
      ]),
  );

  // Ausstattung (T92, DR-060): einmal wählen, was die Küche hat; Schneebesen und Hände gehen immer (nur länger)
  if (data.werkzeuge) {
    const aus = { ...standardAusstattung(data.werkzeuge), ...(state.ausstattung || {}) };
    root.append(dimension('Ausstattung', 'Was deine Küche hat. Schneebesen und Hände gehen immer — von Hand dauert es nur länger.',
      waehlbareWerkzeuge(data.werkzeuge).map(([k, w]) => option({
        label: w.label, sub: aus[k] ? 'vorhanden' : 'nicht vorhanden', selected: !!aus[k], mischbar: true,
        onClick: () => onChange({ ausstattung: { ...aus, [k]: !aus[k] } }),
      })), null, null, true));
  }

  // Optionale Techniken (DR-041): Schalter, wenn mindestens eine Methode des Archetyps sie kennt
  const technikKeys = technikKeysVon(arch, data);
  const gelockert = new Set();
  for (const k of technikKeys) {
    const t = data.techniken[k];
    const stufe = computed.technikStufen?.[k] ?? technikStufe(arch, computed.variante, k); // gemessen am Korpus (T83)
    if (stufe === 'aus') continue; // Variante sieht die Technik nicht vor (Muffins): kein Schalter
    const an = !!state.techniken?.[k];
    const passend = arch.methoden.filter((m) => (data.methods[m].techniken || []).includes(k));
    const passt = passend.includes(computed.methodKey);
    if (an && passt) (t.lockert || []).forEach((r) => gelockert.add(r));
    root.append(dimension(t.label, t.hinweis, [
      option({ label: 'Nein', sub: 'Eier ganz', iconKey: t.schalter?.ohne.icon, iconTitle: t.schalter?.ohne.titel, selected: !an, bestof: stufe !== 'typisch', onClick: () => onChange(technikPatch(state, arch, t, k, false)) }),
      option({
        label: 'Ja', sub: passt ? 'Eischnee als Trieb' : `nicht bei ${data.methods[computed.methodKey].label}`, iconKey: t.schalter?.mit.icon, iconTitle: t.schalter?.mit.titel,
        selected: an, status: passt ? null : 'invalid', bestof: stufe === 'typisch',
        title: `Passt zu: ${passend.map((m) => data.methods[m].label).join(', ')}`,
        onClick: () => onChange(technikPatch(state, arch, t, k, true)),
      }),
    ], null, null, true));
  }

  for (const r of data.methods[computed.methodKey]?.lockert || []) gelockert.add(r); // Schaummasse: Trieb aus dem Eischaum (DR-046)
  for (const rolle of arch.rollen) {
    const pflicht = rolle.pflicht && !gelockert.has(rolle.rolle);
    const entries = state.zutaten[rolle.rolle] || [];
    const mehrfach = entries.length > 1;
    const istFixiert = !!state.fixiert?.rollen?.[rolle.rolle];
    const opts = [...rolle.optionen];
    const items = opts.map((key) => {
      const ing = data.ingredients[key];
      const eintrag = entries.find((e) => e.zutat === key);
      // Klick wechselt die Auswahl (ersetzt sie) — das ist die Standard-Interaktion (T30) und
      // kann eine Pflicht-Rolle nie leeren, weil immer genau eine Zutat übrig bleibt. Nur der
      // Zusatz-Weg (Shift-Klick/Long-Press) fügt zur bisherigen Auswahl hinzu und kann daher
      // — wie schon vorher — blockiert sein, wenn er die letzte Zutat einer Pflicht-Rolle entfernen würde.
      const naechsteSelect = [{ zutat: key, anteil: 1 }];
      const naechsteAdd = toggleEntries(entries, key);
      const addWuerdeLeeren = !!eintrag && pflicht && naechsteAdd.length === 0;
      const hyp = { ...state.zutaten, [rolle.rolle]: naechsteSelect };
      const ev = evaluateAll(hyp, state.gefaess, data, state.fixiert, null, wirksameTechniken(state.techniken, arch, computed.variante));
      const irgendwasGeht = Object.values(ev).some((e) => e.status !== 'invalid');
      const grund = irgendwasGeht ? null : Object.values(ev)[0]?.gruende[0];
      // Pin je Zutat (T31), Alternative zum Rollen-Pin (T24): nur sinnvoll bei einer bereits
      // gemischten Rolle (sonst deckt sich das exakt mit dem Rollen-Pin) und nur für eine
      // tatsächlich gewählte Zutat. Erscheint nur bei Hover, um die Optionsliste nicht zu
      // überladen (siehe .opt-pin in style.css).
      const zutatFixiert = !!state.fixiert?.zutaten?.[rolle.rolle]?.[key];
      const zutatPin = mehrfach && eintrag ? {
        aktiv: zutatFixiert,
        titel: zutatFixiert ? 'Zutat fixiert — wird nicht automatisch angepasst. Klicken zum Lösen.' : 'Nur diese Zutat fixieren — verhindert künftig automatische Anpassung nur für sie.',
        onToggle: () => onChange({
          fixiert: {
            ...state.fixiert,
            zutaten: { ...state.fixiert.zutaten, [rolle.rolle]: { ...state.fixiert.zutaten?.[rolle.rolle], [key]: !zutatFixiert } },
          },
        }),
      } : null;
      return option({
        label: ing.label,
        iconKey: ing.kategorie,
        iconTitle: data.kategorien?.[ing.kategorie]?.label,
        sub: (ing.eigenschaften || [])[0] ?? '',
        selected: !!eintrag,
        bestof: bestof[rolle.rolle] === key || (bestof[rolle.rolle] === undefined && rolle.default === key),
        status: !eintrag && !irgendwasGeht ? 'invalid' : null,
        title: !eintrag && grund ? grund : (ing.eigenschaften || []).join(' · '),
        anteil: mehrfach && eintrag ? eintrag.anteil : null,
        onAnteilChange: (val) => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: setAnteil(entries, key, val) } }),
        onClick: () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: naechsteSelect } }),
        onAdd: addWuerdeLeeren ? null : () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: naechsteAdd } }),
        pin: zutatPin,
        mischbar: true,
      });
    });
    if (!pflicht) {
      items.unshift(option({
        label: '— keine —',
        sub: '',
        selected: entries.length === 0,
        mischbar: true,
        bestof: bestof[rolle.rolle] === null,
        onClick: () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: [] } }),
      }));
    }
    const pin = {
      aktiv: istFixiert,
      onToggle: () => onChange({ fixiert: { ...state.fixiert, rollen: { ...state.fixiert.rollen, [rolle.rolle]: !istFixiert } } }),
    };
    root.append(dimension(rolle.label, rolle.hinweis, items, pin, rolle.substitution));
  }
}

const technikKeysVon = (arch, data) => [...new Set(arch.methoden.flatMap((m) => data.methods[m].techniken || []))].filter((k) => data.techniken?.[k]);

// Derselbe Technik-Schalter als Kurzform im Kopf des Ablaufs (Nutzer: Schalter lag weit weg vom Ablauf, den er ändert)
export function renderTechnikSchalter(root, state, data, computed, onChange) {
  const arch = data.archetypes[state.archetyp];
  root.replaceChildren();
  root.classList.remove('knopfgruppe'); // Häkchen statt Knopfgruppe; ältere index.html aus dem Cache hat die Klasse noch (DR-037)
  for (const k of technikKeysVon(arch, data)) {
    if (technikStufe(arch, computed.variante, k) === 'aus') continue;
    const t = data.techniken[k];
    const an = !!state.techniken?.[k];
    const methode = data.methods[computed.methodKey];
    const passt = (methode.techniken || []).includes(k);
    // Häkchen mit fester Beschriftung, das Icon dahinter zeigt den Zustand (ganzes Ei / getrennt) (DR-078)
    const label = el('label', `technik-schalter${an ? ' is-an' : ''}${passt ? '' : ' passt-nicht'}`);
    const box = el('input');
    box.type = 'checkbox';
    box.checked = an;
    box.addEventListener('change', () => onChange(technikPatch(state, arch, t, k, box.checked)));
    const s = t.schalter?.[an ? 'mit' : 'ohne'];
    label.append(box, t.schalter?.mit.text ?? `mit ${t.kurz ?? t.label}`);
    if (s?.icon) label.insertAdjacentHTML('beforeend', iconHtml(s.icon, 16, s.titel));
    label.title = passt ? t.hinweis : `${t.label} passt nicht zur ${methode.label}`;
    root.append(label);
  }
  root.hidden = !root.children.length;
}

// Substitutions-Freiheit einer Rolle (T10): was passiert beim Wechsel der Zutat — gemessen gegen das Best-of-Preset
export const SUBSTITUTION = {
  frei: { text: 'frei austauschbar', titel: 'Kein Wechsel der Zutat in dieser Rolle erzeugt eine neue Meldung.' },
  empfohlen: { text: 'Wechsel gibt Hinweise', titel: 'Mindestens ein Wechsel erzeugt eine Warnung oder einen Hinweis, macht das Rezept aber nicht ungültig.' },
  strikt: { text: 'Wechsel kann ungültig machen', titel: 'Mindestens ein Wechsel macht das Rezept ungültig (harte Regel oder harte Grenze).' },
};

function toggleEntries(entries, key) {
  const exists = entries.some((e) => e.zutat === key);
  if (exists) return entries.filter((e) => e.zutat !== key);
  // Eine neu hinzugefügte Zutat startet als Minderanteil (~25 % der Rolle),
  // nicht gleichauf mit dem Bestehenden — das entspricht der üblichen
  // Substitutions-Praxis (z. B. Speisestärke als Teilersatz fürs Mehl) und
  // lässt sich über "Teile" danach frei anpassen.
  if (!entries.length) return [{ zutat: key, anteil: 1 }];
  const sumBestehend = entries.reduce((a, e) => a + (e.anteil || 1), 0);
  const neuerAnteil = Math.round((sumBestehend / 3) * 10) / 10;
  return [...entries, { zutat: key, anteil: neuerAnteil }];
}

function setAnteil(entries, key, anteil) {
  const wert = Math.max(0.1, Number(anteil) || 1);
  return entries.map((e) => (e.zutat === key ? { ...e, anteil: wert } : e));
}

// gruppe: Optionen als Knopfgruppe (DR-045), z. B. Ja/Nein einer Technik
function dimension(title, hint, items, pin, substitution, gruppe = false) {
  const row = el('div', 'dim');
  const head = el('div', 'dim-head');
  const titleRow = el('div', 'dim-title-row');
  titleRow.append(el('div', 'dim-title', title));
  if (SUBSTITUTION[substitution]) {
    const s = el('span', `dim-subst is-${substitution}`, SUBSTITUTION[substitution].text);
    s.title = SUBSTITUTION[substitution].titel;
    titleRow.append(s);
  }
  if (pin) titleRow.append(pinButton(pin));
  head.append(titleRow);
  if (hint) head.append(el('div', 'dim-hint', hint));
  row.append(head);
  const opts = el('div', `dim-options${gruppe ? ' knopfgruppe' : ''}`);
  // Einfach-Auswahl (Gefäß, Methode, Ja/Nein) als Radiogruppe, mischbare Zutaten als Gruppe von Umschaltern (T81)
  opts.setAttribute('role', items.every((i) => i.getAttribute('role') === 'radio') ? 'radiogroup' : 'group');
  opts.setAttribute('aria-label', title);
  opts.append(...items);
  row.append(opts);
  return row;
}

// mischbar: Zutat einer Rolle, die mit Shift-Klick/Long-Press mehrfach gewählt werden kann (Häkchen statt Radiopunkt, T81)
function option({ label, iconKey, iconTitle, sub, selected, bestof, status, title, anteil, onAnteilChange, onClick, onAdd, pin, mischbar = false }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = mischbar ? 'opt ist-mischbar' : 'opt';
  if (mischbar) b.setAttribute('aria-pressed', String(!!selected));
  else { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(!!selected)); }
  if (selected) b.classList.add('is-selected');
  if (bestof) b.classList.add('is-bestof');
  if (status === 'invalid') b.classList.add('is-invalid');
  if (status === 'prep') b.classList.add('is-prep');
  if (!onClick) b.disabled = true;
  if (title) b.title = title;
  const labelEl = el('span', 'opt-label');
  if (iconKey) labelEl.insertAdjacentHTML('beforeend', iconHtml(iconKey, 15, iconTitle));
  labelEl.append(document.createTextNode(label));
  b.append(labelEl);
  if (sub) b.append(el('span', 'opt-sub', sub));
  if (bestof) b.append(el('span', 'opt-badge', 'Best of'));
  if (pin) b.append(optionPin(pin));
  if (anteil != null) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'opt-anteil';
    input.min = '0.1';
    input.step = '0.5';
    input.value = String(anteil);
    input.title = 'Anteil relativ zu den anderen gewählten Zutaten dieser Rolle';
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', (e) => { e.stopPropagation(); onAnteilChange(e.target.value); });
    b.append(el('span', 'opt-anteil-label', 'Teile'), input);
  }
  // Klick wechselt standardmäßig die Auswahl (onClick); Shift-Klick (Desktop) oder Long-Press
  // (Touch) fügt stattdessen zur bisherigen Auswahl hinzu (onAdd), um mehrere Zutaten zu mischen
  // (T30 — kehrt das frühere Standardverhalten um, das jetzt der Ausnahmefall ist).
  if (onAdd) wireAddGeste(b, onAdd);
  if (onClick) {
    b.addEventListener('click', (e) => {
      if (klickNachLongPressUnterdruecken()) return; // Long-Press hat diesen Tap schon behandelt
      if (onAdd && e.shiftKey) onAdd();
      else onClick();
    });
  }
  return b;
}

const LONGPRESS_MS = 500;
const LONGPRESS_TOLERANZ_PX = 10;
const LONGPRESS_SICHERHEITSNETZ_MS = 700; // etwas länger als LONGPRESS_MS, s. u.

// Modul-weites Flag statt eines Attributs auf dem Button: `onAdd` löst bei Bedarf ein Re-Render
// aus (z. B. wenn die Auswahl sich ändert), das `renderMorphbox` per `root.replaceChildren()`
// erledigt — der ursprünglich gedrückte Button existiert dann nicht mehr, ein Flag darauf wäre
// beim nachfolgenden synthetischen Klick (nach touchend) schon verloren. Das Sicherheitsnetz
// räumt das Flag auch auf, falls der erwartete Klick ausbleibt (z. B. Finger woanders abgehoben).
let unterdrueckeNaechstenKlick = false;
function klickNachLongPressUnterdruecken() {
  if (!unterdrueckeNaechstenKlick) return false;
  unterdrueckeNaechstenKlick = false;
  return true;
}

// Long-Press-Erkennung für Touch/Pen (T30) — löst `onAdd` aus, wenn der Finger lang genug ruhig
// gehalten wird, statt auf den nachfolgenden Klick zu warten. Maus bleibt außen vor: dort ist
// Shift-Klick der Zusatz-Weg (in `option()`), Long-Press mit der Maus wäre unüblich/verwirrend.
function wireAddGeste(b, onAdd) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  const abbrechen = () => { if (timer) { clearTimeout(timer); timer = null; } };
  b.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      unterdrueckeNaechstenKlick = true;
      setTimeout(() => { unterdrueckeNaechstenKlick = false; }, LONGPRESS_SICHERHEITSNETZ_MS);
      onAdd();
    }, LONGPRESS_MS);
  });
  b.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > LONGPRESS_TOLERANZ_PX) abbrechen();
  });
  b.addEventListener('pointerup', abbrechen);
  b.addEventListener('pointercancel', abbrechen);
  b.addEventListener('contextmenu', (e) => e.preventDefault()); // sonst öffnet Long-Press auf Touch das Kontextmenü
}

// Pin-Toggle für "gesetzt-fix" (DR-019 Wert-Zustand, T24): eine fixierte Rolle wird von
// einer künftigen automatischen Kaskade (T26/T27) nie angetastet — reine Nutzer-Markierung,
// noch ohne automatische Wirkung außer der Konflikt-Kennzeichnung in rules.js.
function pinButton({ aktiv, onToggle }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pin-btn';
  if (aktiv) b.classList.add('is-active');
  b.title = aktiv ? 'Fixiert — wird nicht automatisch angepasst. Klicken zum Lösen.' : 'Fixieren — verhindert künftig automatische Anpassung dieser Rolle.';
  b.textContent = '📌';
  b.addEventListener('click', onToggle);
  return b;
}

// Pin je Zutat (T31) — sitzt innerhalb einer Options-Schaltfläche (`.opt`), die selbst schon ein
// <button> ist; ein zweites, echtes <button>-Element darin wäre in mehreren Browsern nicht
// zuverlässig klickbar. Deshalb ein <span> mit role="button" + eigenem Klick-/Tastatur-Handler,
// der per stopPropagation verhindert, dass der Klick zusätzlich die Options-Auswahl auslöst
// (gleiches Muster wie schon beim Anteil-Eingabefeld). CSS blendet es außer bei :hover/:focus
// oder wenn aktiv aus (siehe .opt-pin in style.css), um die Liste nicht zu überladen.
function optionPin({ aktiv, titel, onToggle }) {
  const s = document.createElement('span');
  s.className = 'opt-pin';
  if (aktiv) s.classList.add('is-active');
  s.setAttribute('role', 'button');
  s.setAttribute('tabindex', '0');
  s.title = titel;
  s.textContent = '📌';
  const auslösen = (e) => { e.stopPropagation(); onToggle(); };
  s.addEventListener('click', auslösen);
  s.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); auslösen(e); }
  });
  return s;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
