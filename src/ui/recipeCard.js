import { overrideErfassen, overridesFuer } from '../model/overrides.js';

export function renderRecipe(root, computed, state, data, onChange) {
  root.replaceChildren();

  const status = el('div', `status status-${computed.status}`);
  status.textContent =
    computed.status === 'ok' ? `${computed.method.label} — bewährte Kombination`
    : computed.status === 'prep' ? `${computed.method.label} — geht, mit Vorbereitung`
    : `${computed.method.label} — so funktioniert das nicht`;
  root.append(status);

  const meta = el('div', 'meta');
  meta.append(
    el('span', null, `${computed.vessel.label}`),
    el('span', null, `${Math.round(computed.teigmasse)} g Teig`),
    el('span', null, `Referenz: ${computed.varianteLabel} (n = ${computed.korpusN})`),
  );
  root.append(meta);

  for (const g of computed.gruende) root.append(el('p', 'note note-bad', g));
  // Kaskaden-Vorschlag (DR-019/T27): zeigt den in T26 berechneten Ersatzkandidaten mit
  // Bestätigen-Button. Nichts ändert sich, bis der Nutzer klickt — kein stilles Umschalten.
  for (const k of computed.kaskaden || []) root.append(kaskadenVorschlag(k, state, data, onChange));
  // Override erfassen (DR-019 Punkt 4/T25): reine Beweis-Erfassung, kein Freischalten — die
  // Rezeptur ist auch ohne Override schon vollständig sichtbar (s. u.). Speichert nur, dass der
  // Nutzer diese `hart`-Regel bewusst für falsch/zu streng hält, für die Rückfrage in T28.
  for (const b of computed.blockaden || []) root.append(blockadeOverride(b, state, data, onChange));
  for (const w of computed.warnungen) root.append(el('p', 'note note-warn', w));
  for (const a of computed.anpassungen) root.append(el('p', 'note note-info', a));

  const table = el('table', 'zutaten');
  const thead = el('thead');
  thead.append(tr(['Rolle', 'Zutat', 'Menge', 'Bäcker-%', 'Korpus (Q1–Q3)'], 'th'));
  table.append(thead);
  const tbody = el('tbody');
  for (const z of computed.zutatenListe) {
    const menge = `${z.menge} ${z.einheit}${z.hinweis ? ` (${z.hinweis})` : ''}`;
    const k = z.korpus;
    const spanne = k ? `${fmt(k.q1)}–${fmt(k.q3)} %` : '—';
    const row = tr([z.rolleLabel, z.label, menge, `${fmt(z.bp)} %${z.bpQuelle === 'schätzung' ? ' *' : ''}`, spanne]);
    tbody.append(row);
  }
  table.append(tbody);
  root.append(table);
  if (computed.zutatenListe.some((z) => z.bpQuelle === 'schätzung')) {
    root.append(el('p', 'fine', '* keine Korpus-Daten für diese Rolle — Schätzwert'));
  }

  const bake = el('div', 'bake');
  bake.append(
    el('div', 'bake-main', `${computed.backen.tempOU} °C Ober-/Unterhitze · ${computed.backen.tempUmluft} °C Umluft · ${computed.backen.minuten} Min.`),
  );
  const ul = el('ul', 'bake-hints');
  for (const h of computed.backen.hinweise) ul.append(el('li', null, h));
  bake.append(ul);
  root.append(bake);

  const lb = computed.lehrbuch;
  const fett = computed.rollenBp?.fett?.bp;
  const suesse = computed.rollenBp?.suesse?.bp;
  const ei = computed.rollenBp?.bindung?.bp;
  if (lb && fett != null) {
    const klasse = fett < 70 ? 'leicht' : ei != null && ei < 90 ? 'mittel' : 'schwer';
    root.append(el('p', 'fine', `Einordnung nach Lehrbuch (Mehl = 100): Fett ${fmt(fett)} · Zucker ${fmt(suesse)} · Ei ${fmt(ei)} → „${klasse}er“ Rührteig. ${lb.kommentar}`));
  }
}

// Vorschlagen-dann-bestätigen (DR-019 Punkt 1/T27): mutiert `state.zutaten` erst nach Klick,
// nie automatisch. Ersetzt die aktuelle Auswahl der Zielrolle vollständig durch den einen
// Ersatzkandidaten aus T26 (kein Zusammenmischen mit der bisherigen, nicht passenden Wahl).
function kaskadenVorschlag(k, state, data, onChange) {
  const box = el('div', 'note note-kaskade');
  const aktuelle = (state.zutaten[k.rolle] || []).map((e) => data.ingredients[e.zutat]?.label).filter(Boolean);
  const aktuelleText = aktuelle.length ? aktuelle.join(' + ') : 'nichts';
  box.append(el('span', null, `Vorschlag: ${k.zutatLabel} statt ${aktuelleText} bei „${k.rolleLabel}“ verwenden — löst „${k.ausloeser}“.`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kaskade-btn';
  btn.textContent = 'Übernehmen';
  btn.addEventListener('click', () => onChange({ zutaten: { ...state.zutaten, [k.rolle]: [{ zutat: k.zutat, anteil: 1 }] } }));
  box.append(btn);
  return box;
}

// Kurzer Text der aktuell gewählten Zutaten — dient als "kontext" beim Override, damit der
// Nutzer bei der Rückfrage (T28) noch weiß, welche Kombination er probiert hat.
function zutatenKontext(state, data) {
  return Object.values(state.zutaten)
    .map((entries) => (entries || []).map((e) => data.ingredients[e.zutat]?.label).filter(Boolean))
    .filter((labels) => labels.length)
    .map((labels) => labels.join('+'))
    .join(', ');
}

// Override-Button für eine überschreibbare `hart`-Blockade (DR-019 Punkt 4/T25). Ist bereits
// ein offener Override für diese Regel erfasst, zeigt die Notiz das statt eines neuen Buttons —
// sonst ließe sich derselbe Versuch beliebig oft "merken".
function blockadeOverride(b, state, data, onChange) {
  const box = el('div', 'note note-override');
  const offen = overridesFuer(b.id).some((o) => o.ergebnis === 'offen');
  if (offen) {
    box.append(el('span', null, `📝 „${b.text}“ überschrieben — beim nächsten Besuch fragen wir nach, ob es funktioniert hat.`));
    return box;
  }
  box.append(el('span', null, `„${b.text}“ ist nur eine Modellannahme — du kannst sie bewusst überschreiben.`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'override-btn';
  btn.textContent = 'Trotzdem verwenden (merken)';
  btn.addEventListener('click', () => {
    overrideErfassen(b.id, zutatenKontext(state, data), b.text);
    onChange({}); // kein State ändert sich — erzwingt nur ein Re-Render, damit die Notiz umschaltet
  });
  box.append(btn);
  return box;
}

function tr(cells, tag = 'td') {
  const r = document.createElement('tr');
  for (const c of cells) r.append(el(tag, null, c));
  return r;
}

function fmt(x) { return x == null ? '—' : String(Math.round(x)); }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
