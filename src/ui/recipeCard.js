import { fmtProzent } from '../model/bilanz.js';
import { overrideErfassen, overridesFuer } from '../model/overrides.js';
import { fmtZeit } from '../model/zeit.js';
import { renderRueckmeldung } from './rueckmeldung.js';

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
    el('span', null, `${Math.round(computed.teigmasse)} g ${computed.bezugLabel && computed.bezugLabel !== 'Mehl' ? 'gesamt' : 'Teig'}`),
    el('span', null, `Referenz: ${computed.varianteLabel} (n = ${computed.korpusN}${computed.korpusNMethode ? `; Mengen aus ${computed.korpusNMethode === 1 ? '1 Rezept' : `${computed.korpusNMethode} Rezepten`} mit „${computed.method.label}“` : ''})`),
  );
  const zt = computed.zeit; // Zeitleiste aus dem Ablauf-Graph (DR-024/T44)
  if (zt?.gesamt) {
    meta.append(el('span', null, `Zeit ca. ${fmtZeit(zt.gesamt)} (aktiv ${fmtZeit(zt.aktiv)}${zt.warten ? `, warten ${fmtZeit(zt.warten)}` : ''})${zt.vorlauf ? `, davor ${fmtZeit(zt.vorlauf)} Vorlauf` : ''}`));
  }
  root.append(meta);
  if (computed.trieb?.zeile) root.append(el('p', 'trieb-zeile', computed.trieb.zeile)); // Triebquellen (T80, DR-049)
  if (computed.gas?.zeile) root.append(el('p', 'trieb-zeile', computed.gas.zeile)); // Gas-Budget (T82, DR-050)

  for (const g of computed.gruende) root.append(el('p', 'note note-bad', g));
  // Kaskaden-Vorschlag (DR-019/T27): zeigt den in T26 berechneten Ersatzkandidaten mit
  // Bestätigen-Button. Nichts ändert sich, bis der Nutzer klickt — kein stilles Umschalten.
  for (const k of computed.kaskaden || []) root.append(kaskadenVorschlag(k, state, data, onChange));
  // Mengen-Vorschlag (T40): wenn kein Tausch reicht, die Menge der Rolle verschieben — ebenfalls erst nach Klick
  for (const m of computed.mengenVorschlaege || []) root.append(mengenVorschlag(m, state, onChange));
  if (Object.keys(state.mengen || {}).length) root.append(mengenManuell(computed, state, onChange));
  // Override erfassen (DR-019 Punkt 4/T25): reine Beweis-Erfassung, kein Freischalten — die
  // Rezeptur ist auch ohne Override schon vollständig sichtbar (s. u.). Speichert nur, dass der
  // Nutzer diese `hart`-Regel bewusst für falsch/zu streng hält, für die Rückfrage in T28.
  for (const b of computed.blockaden || []) root.append(blockadeOverride(b, state, data, onChange));
  for (const z of computed.zustaende || []) root.append(vorbereitenZeile(z)); // DR-064: was vorher in welchen Zustand muss
  for (const w of computed.warnungen) root.append(el('p', 'note note-warn', w));
  for (const a of computed.anpassungen) root.append(el('p', 'note note-info', a));
  for (const h of computed.toleranzHinweise || []) root.append(el('p', 'note note-info', h));

  const table = el('table', 'zutaten');
  const thead = el('thead');
  const bezug = computed.bezugLabel ?? 'Mehl';
  thead.append(tr(['Rolle', 'Zutat', 'Menge', bezug === 'Mehl' ? 'Bäcker-%' : `% vom ${bezug}`, 'Korpus (Q1–Q3)'], 'th'));
  table.append(thead);
  const tbody = el('tbody');
  for (const z of computed.zutatenListe) {
    const menge = `${z.menge} ${z.einheit}${z.hinweis ? ` (${z.hinweis})` : ''}`;
    const k = z.korpus;
    const spanne = k ? `${fmt(k.q1)}–${fmt(k.q3)} %` : '—';
    const marker = z.bpQuelle === 'schätzung' ? ' *' : z.bpQuelle === 'berechnet' ? ' †' : z.bpQuelle === 'manuell' ? ' ✎' : '';
    const row = tr([z.rolleLabel, z.label, menge, `${fmt(z.bp)} %${marker}`, z.bpQuelle === 'berechnet' ? '—' : spanne]);
    const zst = z.zustand && (computed.zustaende || []).find((x) => x.rolle === z.rolle);
    if (zst) row.children[1].append(zustandKlappe(zst, state, onChange)); // DR-064: Soll-Zustand + Wege dorthin
    tbody.append(row);
  }
  table.append(tbody);
  root.append(seitlich(table));
  if (computed.zutatenListe.some((z) => z.bpQuelle === 'schätzung')) {
    root.append(el('p', 'fine', '* keine Korpus-Daten für diese Rolle — Schätzwert'));
  }
  if (computed.zutatenListe.some((z) => z.bpQuelle === 'manuell')) {
    root.append(el('p', 'fine', '✎ manuell gesetzt (Mengen-Vorschlag übernommen) — kein Korpus-Median'));
  }
  if (computed.zutatenListe.some((z) => z.bpQuelle === 'berechnet')) {
    root.append(el('p', 'fine', '† berechnet aus der Gärzeit (Gärmodell, Richtwert) — kein Rezept dieser Methode im Korpus'));
  }
  const g = computed.gaerung;
  if (g) {
    const std = (m) => (m >= 90 ? `${(m / 60).toFixed(1).replace('.', ',')} Std.` : `${Math.round(m)} Min.`);
    const erwartet = g.fenster ? `${std(g.erwartet)} (${std(g.fenster[0])}–${std(g.fenster[1])} je nach Temperatur)` : std(g.erwartet);
    const mindest = g.mindestGilt ? ` Es gilt die Mindestzeit der Gare (${std(g.mindest)}), das Modell allein sagt ${std(g.modell)}.` : '';
    root.append(el('p', 'fine', `Gärmodell (Richtwert): ${g.hefeBp.toFixed(1).replace('.', ',')} % Hefe, Gare ${std(g.gare)}${g.tempText ? ` bei ${g.tempText}` : ''} — das Modell erwartet ${erwartet} (Spielraum etwa ×${String(g.warnFaktor).replace('.', ',')}; mehr Hefe oder Wärme verkürzt, Kälte verlängert).${mindest}`));
    if (g.hinweis) root.append(el('p', 'fine', g.hinweis));
  }

  // Gesamtbilanz (DR-020/T33): Wasser/Fett/Zucker über alle Zutaten, mit Korpus-Spanne (T35).
  if (computed.bilanz?.length) {
    const bt = el('table', 'zutaten bilanz');
    const bh = el('thead');
    bh.append(tr(['Bilanz', 'Gramm', `% vom ${bezug}`, 'Korpus (Q1–Q3)', 'Herkunft (Rolle)'], 'th'));
    bt.append(bh);
    const bb = el('tbody');
    const markierung = { ausserhalb_q: ' ◦', ausserhalb_spanne: ' ⚠', keine_basis: ' ?' };
    for (const z of computed.bilanz) {
      const k = z.korpus;
      if (!(z.gramm > 0) && !(k?.max > 0)) continue; // Größe kommt im Archetyp nicht vor (z. B. Hefe im Rührteig)
      if (!(z.gramm > 0) && (z.groesse === 'natron' || z.groesse === 'saeure')) continue; // Natron-Balance nur zeigen, wenn Natron oder Säure im Rezept steckt
      bb.append(tr([z.label, `${fmtProzent(z.gramm)} g`, `${fmtProzent(z.bp)} %${markierung[z.toleranz] ?? ''}`, k ? `${fmtProzent(k.q1)}–${fmtProzent(k.q3)} %` : '—', herkunftText(z.herkunft)]));
    }
    bt.append(bb);
    root.append(seitlich(bt));
    root.append(el('p', 'fine', 'Bilanz = Summe über alle Zutaten ohne Einlage (z. B. Wasser aus Ei/Butter/Milch, Eiweiß aus Mehl/Ei/Milch). Herkunft: welche Rolle wie viel liefert (ab 5 %). ◦ außerhalb Q1–Q3 · ⚠ außerhalb Korpus-Spanne · ? keine Vergleichsbasis im Korpus'));
  }

  const bake = el('div', 'bake');
  const b = computed.backen;
  if (!b.ohneHitze) bake.append( // ohne Hitze (Mayonnaise, T78): nur die Hinweise
    el('div', 'bake-main', b.tempOU != null
      ? `${b.tempOU} °C Ober-/Unterhitze · ${b.tempUmluft} °C Umluft · ${b.minuten} ${b.minutenLabel}`
      : `${b.hitze} · ${b.minuten} ${b.minutenLabel}`),
  );
  const ul = el('ul', 'bake-hints');
  for (const h of computed.backen.hinweise) ul.append(el('li', null, h));
  bake.append(ul);
  root.append(bake);

  const lb = computed.lehrbuch;
  const fett = computed.rollenBp?.fett?.bp;
  const suesse = computed.rollenBp?.suesse?.bp;
  const ei = computed.rollenBp?.bindung?.bp;
  if (lb?.leicht && fett != null) { // Eischwer-Einordnung gibt es nur für Archetypen mit Lehrbuch-Klassen
    const klasse = fett < 70 ? 'leicht' : ei != null && ei < 90 ? 'mittel' : 'schwer';
    root.append(el('p', 'fine', `Einordnung nach Lehrbuch (Mehl = 100): Fett ${fmt(fett)} · Zucker ${fmt(suesse)} · Ei ${fmt(ei)} → „${klasse}er“ ${computed.archetypLabel}. ${lb.kommentar}`));
  }
  root.append(renderRueckmeldung(state, data, computed)); // „Hat es geklappt?“ (T53)
}

// Vorschlagen-dann-bestätigen (DR-019 Punkt 1/T27): mutiert `state.zutaten` erst nach Klick,
// nie automatisch. Ersetzt die aktuelle Auswahl der Zielrolle vollständig durch den einen
// Ersatzkandidaten aus T26 (kein Zusammenmischen mit der bisherigen, nicht passenden Wahl).
function kaskadenVorschlag(k, state, data, onChange) {
  const box = el('div', 'note note-kaskade');
  const aktuelle = (state.zutaten[k.rolle] || []).map((e) => data.ingredients[e.zutat]?.label).filter(Boolean);
  const aktuelleText = aktuelle.length ? aktuelle.join(' + ') : 'nichts';
  const loest = [k.ausloeser, ...(k.weitere || [])].map((a) => `„${a}“`).join(' und ');
  box.append(el('span', null, `Vorschlag: ${k.zutatLabel} statt ${aktuelleText} bei „${k.rolleLabel}“ verwenden — löst ${loest}.`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kaskade-btn';
  btn.textContent = 'Übernehmen';
  btn.addEventListener('click', () => onChange({ zutaten: { ...state.zutaten, [k.rolle]: [{ zutat: k.zutat, anteil: 1 }] } }));
  box.append(btn);
  return box;
}

// Mengen-Vorschlag (T40): kein Zutaten-Tausch löst die Grenze, also die Menge der Rolle ändern. Nichts passiert ohne Klick.
function mengenVorschlag(m, state, onChange) {
  const box = el('div', 'note note-kaskade');
  const loest = [m.ausloeser, ...(m.weitere || [])].map((a) => `„${a}“`).join(' und ');
  const richtung = m.nach < m.von ? 'verringern' : 'erhöhen';
  const spanne = m.spanne ? ` (Korpus-Spanne ${fmt(m.spanne.min)}–${fmt(m.spanne.max)} %)` : '';
  box.append(el('span', null, `Vorschlag: ${m.rolleLabel} von ${String(Math.round(m.von * 10) / 10).replace('.', ',')} % auf ${String(m.nach).replace('.', ',')} % vom Mehl ${richtung}${spanne} — löst ${loest}.`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kaskade-btn';
  btn.textContent = 'Übernehmen';
  btn.addEventListener('click', () => onChange({ mengen: { ...state.mengen, [m.rolle]: m.nach } }));
  box.append(btn);
  return box;
}

// Hinweis auf manuell gesetzte Mengen (✎ in der Tabelle) mit Rückweg zu den Korpus-Mengen
function mengenManuell(computed, state, onChange) {
  const box = el('div', 'note note-info');
  const einzeln = Object.entries(computed.rollenBp || {}).filter(([, v]) => v.quelle === 'manuell').map(([rolle, v]) => `${computed.zutatenListe.find((z) => z.rolle === rolle)?.rolleLabel ?? rolle} ${fmt(v.bp)} %`);
  box.append(el('span', null, `✎ Manuell gesetzte Menge: ${einzeln.join(', ') || 'keine wirksam'} — statt der Korpus-Menge.`));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kaskade-btn';
  btn.textContent = 'Zurücksetzen';
  btn.addEventListener('click', () => onChange({ mengen: {} }));
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

// Herkunft einer Bilanz-Größe (T41): Rollen mit mindestens 5 % Anteil, größte zuerst
export function herkunftText(herkunft) {
  const teile = (herkunft || []).filter((h) => h.anteil >= 0.05).map((h) => `${h.label} ${Math.round(h.anteil * 100)} %`);
  return teile.length ? teile.join(', ') : '—';
}

function tr(cells, tag = 'td') {
  const r = document.createElement('tr');
  for (const c of cells) r.append(el(tag, null, c));
  return r;
}

function fmt(x) { return x == null ? '—' : String(Math.round(x)); }

// Tabellen scrollen auf schmalen Bildschirmen seitlich statt die Seite zu verbreitern (wie stats.js)
function seitlich(table) {
  const d = el('div', 'tab-scroll');
  d.append(table);
  return d;
}

// Soll-Zustand einer Zutat (DR-064): Zeile „Vorbereiten“ mit dem einfachsten Weg bzw. dem gewählten
function vorbereitenZeile(z) {
  const weg = z.wege.find((w) => w.key === z.gewaehlt) ?? z.wege[0];
  const p = el('p', 'note note-info vorbereiten');
  p.append(el('b', null, 'Vorbereiten: '), el('span', null, `${z.zutat} ${z.anzeige}${weg ? (z.gewaehlt ? ` — im Ablauf: ${weg.label} (${fmtZeit(weg.dauer_min)})` : ` — am einfachsten: ${weg.schritte[0]}`) : ''}. Andere Wege an der Zutat.`));
  return p;
}
// Klappe an der Zutat: woran man den Zustand erkennt und die Wege dorthin; „in den Ablauf“ macht den Weg zum Vorlauf-Schritt (C)
function zustandKlappe(z, state, onChange) {
  const d = el('details', 'zustand');
  d.append(el('summary', null, `${z.anzeige} — so geht's`));
  if (z.pruefen) d.append(el('p', 'fine', `Erkennen: ${z.pruefen}.`));
  const ul = el('ul', 'zustand-wege');
  for (const w of z.wege) {
    const li = el('li', null);
    li.append(el('b', null, `${w.label} `), el('span', 'fine', `(${fmtZeit(w.dauer_min)})`), el('span', null, ` ${w.schritte.join(' · ')}`));
    if (w.risiko) li.append(el('span', 'fine', ` ⚠ ${w.risiko}`));
    const gewaehlt = z.gewaehlt === w.key;
    const b = el('button', 'kaskade-btn', gewaehlt ? 'im Ablauf ✓ — entfernen' : 'in den Ablauf');
    b.type = 'button';
    b.addEventListener('click', () => onChange({ zustandWege: { ...(state.zustandWege || {}), [z.rolle]: gewaehlt ? null : w.key } }));
    li.append(b);
    ul.append(li);
  }
  d.append(ul);
  return d;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
