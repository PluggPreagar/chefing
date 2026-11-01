import { fmtProzent } from '../model/bilanz.js';
import { WIRKUNG_TEXT, GEWISSHEIT_TEXT, ZIEL_TEXT } from '../model/aussagen.js';
import { overrideErfassen, overridesFuer } from '../model/overrides.js';
import { fmtZeit } from '../model/zeit.js';
import { renderRueckmeldung } from './rueckmeldung.js';
import { vorbereitenZeile } from './zustandLink.js';
import { iconHtml } from './icons.js';
import { eingabeInGramm, skalaFuerMenge, GROESSEN } from '../model/skala.js';

export function renderRecipe(root, computed, state, data, onChange) {
  root.replaceChildren();
  const fokus = fokusReferenz; // das Feld der Referenz nimmt den Fokus nur einmal
  fokusReferenz = false;

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

  for (const g of computed.gruende) root.append(mitMarke(el('p', 'note note-bad', g), computed.marken?.[g]));
  // Kaskaden-Vorschlag (DR-019/T27): zeigt den in T26 berechneten Ersatzkandidaten mit
  // Bestätigen-Button. Nichts ändert sich, bis der Nutzer klickt — kein stilles Umschalten.
  for (const k of computed.kaskaden || []) root.append(kaskadenVorschlag(k, state, data, onChange));
  // Mengen-Vorschlag (T40): wenn kein Tausch reicht, die Menge der Rolle verschieben — ebenfalls erst nach Klick
  for (const m of computed.mengenVorschlaege || []) root.append(mengenVorschlag(m, state, onChange));
  if (Object.keys(state.mengen || {}).length) root.append(mengenManuell(computed, state, onChange));
  if (computed.skalaQuelle === 'zutat' && computed.skala !== 1) root.append(skalaNotiz(computed)); // DR-122
  if (computed.skalaHinweis) root.append(el('p', 'note note-warn', computed.skalaHinweis));
  for (const h of computed.rundungsHinweise || []) root.append(el('p', 'note note-info', h));
  // Override erfassen (DR-019 Punkt 4/T25): reine Beweis-Erfassung, kein Freischalten — die
  // Rezeptur ist auch ohne Override schon vollständig sichtbar (s. u.). Speichert nur, dass der
  // Nutzer diese `hart`-Regel bewusst für falsch/zu streng hält, für die Rückfrage in T28.
  for (const b of computed.blockaden || []) root.append(blockadeOverride(b, state, data, onChange));
  if (computed.zustaende?.length) root.append(vorbereitenZeile(computed.zustaende, 'note note-info vorbereiten', true)); // DR-064/DR-068: kurz, Teile verlinken auf die Klappe an der Zutat
  for (const w of computed.warnungen) root.append(mitMarke(el('p', 'note note-warn', w), computed.marken?.[w]));
  for (const a of computed.anpassungen) root.append(mitMarke(el('p', 'note note-info', a), computed.marken?.[a]));
  for (const h of computed.toleranzHinweise || []) root.append(mitMarke(el('p', 'note note-info', h), computed.marken?.[h]));

  root.append(basisZeile(computed, state, onChange)); // DR-123, DR-124
  const table = el('table', 'zutaten');
  const thead = el('thead');
  const bezug = computed.bezugLabel ?? 'Mehl';
  // der Kopf der ersten sichtbaren Wertspalte (Menge, bei Bäcker-% die Prozent-Spalte) ist das Auswahlmenü für die Anzeige; main.js hängt es ein (DR-122)
  thead.append(tr(['Rolle', 'Zutat', 'Menge', bezug === 'Mehl' ? 'Bäcker-%' : `% vom ${bezug}`, 'Korpus (Q1–Q3)'], 'th', SPALTEN_REZEPT));
  table.append(thead);
  const tbody = el('tbody');
  for (const z of computed.zutatenListe) {
    const menge = `${z.menge} ${z.einheit}${z.hinweis ? ` (${z.hinweis})` : ''}`;
    const k = z.korpus;
    const spanne = k ? `${fmt(k.q1)}–${fmt(k.q3)} %` : '—';
    const marker = z.bpQuelle === 'schätzung' ? ' *' : z.bpQuelle === 'berechnet' ? ' †' : z.bpQuelle === 'manuell' ? ' ✎' : '';
    const row = tr([z.rolleLabel, z.label, menge, `${fmt(z.bp)} %${marker}`, z.bpQuelle === 'berechnet' ? '—' : spanne], 'td', SPALTEN_REZEPT);
    mengeZelle(row.children[2], menge, z, computed, data, onChange, fokus);
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
    bh.append(tr(['Bilanz', 'Gramm', `% vom ${bezug}`, 'Korpus (Q1–Q3)', 'Herkunft (Rolle)'], 'th', SPALTEN_BILANZ));
    bt.append(bh);
    const bb = el('tbody');
    const markierung = { ausserhalb_q: ' ◦', ausserhalb_spanne: ' ⚠', keine_basis: ' ?' };
    for (const z of computed.bilanz) {
      const k = z.korpus;
      if (!(z.gramm > 0) && !(k?.max > 0)) continue; // Größe kommt im Archetyp nicht vor (z. B. Hefe im Rührteig)
      if (!(z.gramm > 0) && (z.groesse === 'natron' || z.groesse === 'saeure')) continue; // Natron-Balance nur zeigen, wenn Natron oder Säure im Rezept steckt
      bb.append(tr([z.label, `${fmtProzent(z.gramm)} g`, `${fmtProzent(z.bp)} %${markierung[z.toleranz] ?? ''}`, k ? `${fmtProzent(k.q1)}–${fmtProzent(k.q3)} %` : '—', herkunftText(z.herkunft)], 'td', SPALTEN_BILANZ));
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

function tr(cells, tag = 'td', klassen = []) {
  const r = document.createElement('tr');
  cells.forEach((c, i) => {
    const zelle = el(tag, klassen[i] ?? null, typeof c === 'string' ? c : c.text);
    if (typeof c !== 'string' && c.knopf) zelle.append(c.knopf);
    r.append(zelle);
  });
  return r;
}

function fmt(x) { return x == null ? '—' : String(Math.round(x)); }

// Tabellen scrollen auf schmalen Bildschirmen seitlich statt die Seite zu verbreitern (wie stats.js)
// Klassen je Spalte, damit die Anzeige der Mengen (Menge | Bäcker-% | Beides) Spalten per CSS ausblenden kann (DR-120)
const SPALTEN_REZEPT = [null, null, 'col-menge', 'col-prozent', 'col-korpus'];
const SPALTEN_BILANZ = [null, 'col-menge', 'col-prozent', 'col-korpus', 'col-herkunft'];
// Menge in der Rezeptur (DR-122, DR-124). Bei der Basis „Zutat“ ist die Menge der Referenzzutat (vorgabe: die oberste) ein Eingabefeld direkt in der
// Tabelle: Enter oder Verlassen übernimmt, Esc verwirft, die anderen Zutaten folgen über `state.skala`. Die Menge jeder anderen Zutat ist ein Knopf: Antippen
// macht sie zur Referenz. Die Eingabe wird in Gramm umgerechnet (g, ml, Stk), so rundet kein Stück (Eier) den Faktor.
function mengeZelle(zelle, menge, z, computed, data, onChange, fokus) {
  zelle.textContent = '';
  if (computed.skalaQuelle === 'zutat' && computed.skalaZutat === z.zutat) {
    const ing = data.ingredients?.[z.zutat];
    const feld = el('input', 'menge-feld');
    feld.type = 'number';
    feld.step = 'any';
    feld.min = '0';
    feld.value = String(z.menge);
    feld.setAttribute('inputmode', 'decimal');
    feld.setAttribute('aria-label', `Referenz: Menge ${z.label} in ${z.einheit}`);
    const uebernehmen = () => {
      if (feld.value === String(z.menge)) return;
      const skala = skalaFuerMenge(computed.skala, z.gramm, eingabeInGramm(ing, Number(feld.value), z.einheit));
      if (skala != null) onChange({ skala, basis: 'zutat', skalaZutat: z.zutat }); else feld.value = String(z.menge);
    };
    feld.addEventListener('change', uebernehmen); // Verlassen des Feldes
    feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') uebernehmen(); else if (e.key === 'Escape') feld.value = String(z.menge); }); // Enter feuert nicht überall ein change
    zelle.className += ' menge-referenz'; // die Spaltenklasse (col-menge) bleibt
    zelle.append(feld, el('span', 'menge-einheit', ` ${z.einheit}${z.hinweis ? ` (${z.hinweis})` : ''}`));
    if (fokus) setTimeout(() => { feld.focus?.(); feld.select?.(); }, 0); // erst nach dem Einhängen der Tabelle
    return;
  }
  const knopf = el('button', 'menge-wert', menge);
  knopf.type = 'button';
  knopf.title = 'Diese Zutat als Referenz wählen und ihre Menge festlegen, die anderen folgen';
  knopf.addEventListener('click', () => { fokusReferenz = true; onChange({ basis: 'zutat', skalaZutat: z.zutat, skala: computed.skala }); });
  zelle.append(knopf);
}
let fokusReferenz = false; // nach Basis „Zutat“ oder Antippen einer Menge: das Feld der Referenz bekommt den Fokus
// Hinweis auf die festgelegte Menge (DR-122); der Weg zurück ist die Basis (Gefäß | Portionen)
function skalaNotiz(computed) {
  const faktor = String(Math.round(computed.skala * 100) / 100).replace('.', ',');
  return el('p', 'note note-info', `Menge festgelegt: ×${faktor} der Gefäß-Menge, ${Math.round(computed.teigmasse)} g statt ${Math.round(computed.vessel.teigmasse_g)} g. Bäcker-% bleibt gleich.`);
}
// Basis der Menge (DR-123, DR-124): Gefäß | Portionen | Zutat. Gefäß zeigt, wie viele Portionen die Form ergibt; Portionen zeigt Zahl (− n +) und Größe
// (Wenig | Normal | Viel); Zutat legt die Menge einer Zutat in der Rezeptur fest. Eine Portion ist, was eine Person isst, je Gefäß eine Schätzung
// (`portion_g`); Brotlaib und Mayonnaise haben keine. Die Zahl wird gemerkt (main.js), die Referenzzutat nicht.
const rundeN = (n) => Math.round(n * 10) / 10;
const zahlText = (n) => String(rundeN(n)).replace('.', ',');
function gruppe(name, optionen, gewaehlt, onWahl) {
  const g = el('div', 'knopfgruppe');
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', name);
  for (const [wert, text] of optionen) {
    const b = el('button', 'flach', text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(wert === gewaehlt));
    b.addEventListener('click', () => onWahl(wert));
    g.append(b);
  }
  return g;
}
function basisZeile(computed, state, onChange) {
  const p = computed.portion;
  const basis = computed.skalaQuelle;
  const zeile = el('div', 'portionen');
  const sicher = (n) => Math.min(p.max, Math.max(1, n));
  const optionen = [['gefaess', 'Gefäß'], ...(p ? [['portionen', 'Portionen']] : []), ['zutat', 'Zutat']];
  zeile.append(el('span', 'portionen-name', 'Basis'));
  zeile.append(gruppe('Basis der Menge', optionen, basis, (w) => {
    if (w === 'gefaess') onChange({ basis: null, skala: 1, portionen: null });
    else if (w === 'portionen') onChange({ basis: null, skala: 1, portionen: state.portionen > 0 ? state.portionen : sicher(Math.round(p.n)) });
    else { fokusReferenz = true; onChange({ basis: 'zutat', skala: computed.skala }); }
  }));
  if (basis === 'portionen') {
    const n = Math.round(p.n * 10) / 10;
    const weniger = el('button', 'flach portionen-schritt', '−');
    const mehr = el('button', 'flach portionen-schritt', '+');
    const feld = el('input', 'portionen-feld');
    weniger.type = mehr.type = 'button';
    weniger.setAttribute('aria-label', 'Eine Portion weniger');
    mehr.setAttribute('aria-label', 'Eine Portion mehr');
    weniger.addEventListener('click', () => onChange({ portionen: sicher(Math.ceil(n) - 1), skala: 1 }));
    mehr.addEventListener('click', () => onChange({ portionen: sicher(Math.floor(n) + 1), skala: 1 }));
    feld.type = 'number';
    feld.min = '1';
    feld.max = String(p.max);
    feld.step = 'any';
    feld.value = String(n);
    feld.setAttribute('inputmode', 'decimal');
    feld.setAttribute('aria-label', 'Anzahl der Portionen');
    feld.addEventListener('change', () => { const v = Number(feld.value); if (Number.isFinite(v) && v > 0) onChange({ portionen: sicher(v), skala: 1 }); });
    const zaehler = el('div', 'portionen-zaehler'); // eine Gruppe, damit „+“ nicht von der Zahl abbricht
    zaehler.append(weniger, feld, mehr);
    zeile.append(zaehler);
    zeile.append(gruppe('Portionsgröße', Object.entries(GROESSEN).map(([k, g]) => [k, g.label]), p.groesse, (w) => onChange({ portionsgroesse: w })));
  }
  const stueck = p?.stueck ? ` ≈ ${zahlText(p.stueck)} Stück` : '';
  const text = basis === 'zutat'
    ? 'Menge der Zutat im Feld festlegen, die anderen folgen. Auf die Menge einer anderen Zutat tippen, um sie als Referenz zu wählen.'
    : basis === 'portionen' ? `je Portion ${Math.round(p.gramm)} g Teig${stueck} (Schätzung)`
    : p ? `Diese Form ergibt etwa ${zahlText(p.n)} Portionen zu je ${Math.round(p.gramm)} g Teig${stueck} (Schätzung)` : '';
  if (text) zeile.append(el('span', 'fine', text));
  return zeile;
}
function seitlich(table) {
  const d = el('div', 'tab-scroll');
  d.append(table);
  return d;
}

// Klappe an der Zutat: woran man den Zustand erkennt und die Wege dorthin; „in den Ablauf“ macht den Weg zum Vorlauf-Schritt (C)
function zustandKlappe(z, state, onChange) {
  const d = el('details', 'zustand');
  d.id = `zustand-${z.rolle}`; // Ziel der Links „Vorbereiten: …“ (DR-068)
  d.append(el('summary', null, `${z.anzeige} — so geht's`));
  if (z.pruefen) d.append(el('p', 'fine', `Erkennen: ${z.pruefen}.`));
  const ul = el('ul', 'zustand-wege');
  for (const w of z.wege) {
    const li = el('li', null);
    li.append(el('b', null, `${w.label} `), el('span', 'fine', `(${fmtZeit(w.gesamt_min)})`), el('span', null, ` ${w.schritte.join(' · ')}`));
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
// Marke an einer Meldung (DR-074): Wirkung und Gewissheit der dahinterliegenden Aussagen; unter „wahrscheinlich“ als Verdacht
function mitMarke(p, m) {
  if (!m) return p;
  const s = el('span', `marke${m.verdacht ? ' marke-verdacht' : ''}`);
  s.title = m.titel;
  s.append(
    el('span', 'marke-teil', `Wirkung ${WIRKUNG_TEXT[m.wirkung]}${m.ziel && m.ziel !== 'gelingen' ? ` auf ${ZIEL_TEXT[m.ziel]}` : ''}`),
    el('span', 'marke-teil', m.verdacht ? `Verdacht: ${GEWISSHEIT_TEXT[m.gewissheit]}` : `Gewissheit ${GEWISSHEIT_TEXT[m.gewissheit]}`),
  );
  p.append(s);
  return p;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
