import { evaluateAll } from '../model/rules.js';
import { haeufigste } from '../model/corpus.js';
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
        onClick: () => onChange({ gefaess: g }),
      }))),
  );

  root.append(
    dimension('Methode', 'Auto wählt die bewährteste gültige Methode. Manuell zeigt, warum eine Kombination (nicht) geht.',
      [
        option({ label: 'Auto', sub: `→ ${data.methods[computed.methodKey].label}`, selected: state.methode == null, onClick: () => onChange({ methode: null }) }),
        ...arch.methoden.map((m) => {
          const e = computed.evals[m];
          return option({
            label: data.methods[m].label,
            sub: `${STATUS_ICON[e.status]} ${e.status === 'ok' ? 'möglich' : e.status === 'prep' ? 'mit Vorbereitung' : 'nicht möglich'}`,
            selected: state.methode === m,
            bestof: m === bestMethode,
            status: e.status,
            title: [...e.gruende, ...e.warnungen].join('\n') || data.methods[m].kurz,
            onClick: () => onChange({ methode: m }),
          });
        }),
      ]),
  );

  for (const rolle of arch.rollen) {
    const entries = state.zutaten[rolle.rolle] || [];
    const mehrfach = entries.length > 1;
    const istFixiert = !!state.fixiert?.[rolle.rolle];
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
      const addWuerdeLeeren = !!eintrag && rolle.pflicht && naechsteAdd.length === 0;
      const hyp = { ...state.zutaten, [rolle.rolle]: naechsteSelect };
      const ev = evaluateAll(hyp, state.gefaess, data, state.fixiert);
      const irgendwasGeht = Object.values(ev).some((e) => e.status !== 'invalid');
      const grund = irgendwasGeht ? null : Object.values(ev)[0]?.gruende[0];
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
      });
    });
    if (!rolle.pflicht) {
      items.unshift(option({
        label: '— keine —',
        sub: '',
        selected: entries.length === 0,
        bestof: bestof[rolle.rolle] === null,
        onClick: () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: [] } }),
      }));
    }
    const pin = {
      aktiv: istFixiert,
      onToggle: () => onChange({ fixiert: { ...state.fixiert, [rolle.rolle]: !istFixiert } }),
    };
    root.append(dimension(rolle.label, rolle.hinweis, items, pin));
  }
}

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

function dimension(title, hint, items, pin) {
  const row = el('div', 'dim');
  const head = el('div', 'dim-head');
  const titleRow = el('div', 'dim-title-row');
  titleRow.append(el('div', 'dim-title', title));
  if (pin) titleRow.append(pinButton(pin));
  head.append(titleRow);
  if (hint) head.append(el('div', 'dim-hint', hint));
  row.append(head);
  const opts = el('div', 'dim-options');
  opts.append(...items);
  row.append(opts);
  return row;
}

function option({ label, iconKey, iconTitle, sub, selected, bestof, status, title, anteil, onAnteilChange, onClick, onAdd }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'opt';
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

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
