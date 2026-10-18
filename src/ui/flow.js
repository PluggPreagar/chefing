import { iconGroup, iconHtml } from './icons.js';
import { fmtZeit } from '../model/zeit.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 168, H = 76, GAP = 44, PAD = 16, ICON = 15, ICON_GAP = 3, ROW_GAP = 46;

// verb=mischen wird je nach Intensität als anderes Icon dargestellt
// (passiv=Einlegen/Ruhen, sanft=Mischen-S, kraeftig=Schlagen), statt drei
// eigene Verben zu pflegen. verteilung (einzeln/abwechselnd) zeigt
// zusätzlich automatisch das Wiederholen-Icon.
const MISCHEN_ICON = { passiv: 'vorbereiten', sanft: 'mischen', kraeftig: 'schlagen' };

// Warten (DR-024/T44) zeigt statt des Verb-Icons eine Uhr der nächstliegenden Dauer-Stufe.
const DAUER_STUFEN = [5, 10, 15, 30, 45, 60];
const dauerIconKey = (min) => `dauer_${DAUER_STUFEN.reduce((a, m) => (Math.abs(m - min) < Math.abs(a - min) ? m : a), DAUER_STUFEN[0])}`;

function iconKeysFor(s) {
  const hauptIcon = s.typ === 'warten' && s.dauer ? dauerIconKey(s.dauer)
    : s.verb === 'mischen' ? (MISCHEN_ICON[s.intensitaet] ?? 'mischen') : s.verb;
  const zusatz = [...(s.zusatzVerben || [])];
  if (s.verteilung) zusatz.push('wiederholen');
  return [...s.zutatKategorien, hauptIcon, ...zusatz].filter(Boolean);
}

export function renderFlow(svg, details, computed, data = {}) {
  const namen = { ...(data.kategorien || {}), ...(data.verben || {}) };
  const steps = computed.ablauf;
  // Ablauf als Graph (T38): Spalte = `ebene` (längster Pfad vom Start), Schritte gleicher Ebene
  // untereinander — sie sind voneinander unabhängig (Reihenfolge frei). Ein rein linearer Ablauf
  // ergibt eine Zeile, identisch zur bisherigen Darstellung.
  const ebeneVon = (s, i) => s.ebene ?? i;
  const zeile = [];
  const proEbene = {};
  steps.forEach((s, i) => { const e = ebeneVon(s, i); zeile[i] = proEbene[e] = (proEbene[e] ?? -1) + 1; });
  const spalten = Math.max(...steps.map(ebeneVon)) + 1;
  const zeilen = Math.max(...Object.values(proEbene)) + 1;
  const pos = steps.map((s, i) => ({ x: PAD + ebeneVon(s, i) * (W + GAP), y: PAD + zeile[i] * (H + ROW_GAP) }));
  const total = PAD * 2 + spalten * W + (spalten - 1) * GAP;
  const hoehe = PAD * 2 + zeilen * H + (zeilen - 1) * ROW_GAP + 24;
  svg.setAttribute('viewBox', `0 0 ${total} ${hoehe}`);
  svg.setAttribute('width', total);
  svg.setAttribute('height', hoehe);
  svg.replaceChildren();

  const defs = node('defs');
  const marker = node('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(node('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'flow-arrow' }));
  defs.append(marker);
  svg.append(defs);

  steps.forEach((s, i) => {
    const { x, y } = pos[i];
    const g = node('g', { class: `flow-node typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`, 'data-step': i });
    g.append(node('rect', { x, y, width: W, height: H, rx: 10 }));
    // Ein Schritt = Kombination aus Zutat-Icon(s) + Verb-Icon, als Reihe zentriert
    const iconKeys = iconKeysFor(s);
    const rowW = iconKeys.length * ICON + Math.max(0, iconKeys.length - 1) * ICON_GAP;
    let ix = x + W / 2 - rowW / 2;
    for (const key of iconKeys) {
      g.append(iconGroup(key, { x: ix, y: y + 8, size: ICON, title: namen[key]?.label }));
      ix += ICON + ICON_GAP;
    }
    const label = node('text', { x: x + W / 2, y: y + H / 2 + 10, class: 'flow-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    wrap(label, `${s.nr}. ${s.label}`, 24, x + W / 2);
    g.append(label);
    const typ = node('text', { x: x + W / 2, y: y + H + 16, class: 'flow-typ', 'text-anchor': 'middle' });
    typ.textContent = s.eingefuegt ? 'eingefügte Vorbereitung' : s.typ;
    g.append(typ);
    const t = node('title');
    t.textContent = s.wirkung;
    g.append(t);
    svg.append(g);
    // Kanten von jedem Vorgänger (T38); ohne `nach`-Daten linear zum vorigen Schritt.
    const vorgaenger = s.nach ?? (i > 0 ? [steps[i - 1].nr] : []);
    for (const nr of vorgaenger) {
      const v = pos[nr - 1];
      if (!v) continue;
      const x1 = v.x + W, y1 = v.y + H / 2, x2 = x - 2, y2 = y + H / 2;
      const mx = (x1 + x2) / 2;
      svg.append(y1 === y2
        ? node('line', { x1, y1, x2, y2, class: 'flow-edge', 'marker-end': 'url(#arrow)' })
        : node('path', { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, fill: 'none', class: 'flow-edge', 'marker-end': 'url(#arrow)' }));
    }
  });

  details.replaceChildren();
  for (const s of steps) {
    const li = document.createElement('li');
    li.className = `step typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`;
    const h = document.createElement('div');
    h.className = 'step-title';
    const iconKeys = iconKeysFor(s);
    h.insertAdjacentHTML('beforeend', iconKeys.map((k) => iconHtml(k, 14, namen[k]?.label)).join(''));
    h.append(document.createTextNode(
      ` ${s.nr}. ${s.label}${dauerText(s)}${s.eingefuegt ? ' · automatisch eingefügt' : ''}${parallelText(s, steps)}`,
    ));
    const w = document.createElement('div');
    w.className = 'step-why';
    w.textContent = s.wirkung;
    li.append(h, w);
    if (s.risiko) {
      const r = document.createElement('div');
      r.className = 'step-risk';
      r.textContent = `Risiko: ${s.risiko}`;
      li.append(r);
    }
    details.append(li);
  }
}

// Warten zeigt Wert und Fenster (DR-024/T44), alle anderen Schritte nur die ungefähre Dauer.
function dauerText(s) {
  if (!s.dauer) return '';
  if (s.typ !== 'warten') return ` · ~${fmtZeit(s.dauer)}`;
  const f = s.zeit;
  return ` · ${fmtZeit(s.dauer)} warten${f ? ` (Fenster ${fmtZeit(f.min)}–${fmtZeit(f.max)})` : ''}`;
}

// Schritte derselben Ebene hängen nicht voneinander ab (T38) — Reihenfolge frei.
function parallelText(s, steps) {
  if (s.ebene == null) return '';
  const andere = steps.filter((x) => x !== s && x.ebene === s.ebene).map((x) => `${x.nr}.`);
  return andere.length ? ` · Reihenfolge frei (parallel zu ${andere.join(', ')})` : '';
}

function wrap(textEl, str, maxChars, cx) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = shown[2].replace(/\s*\S*$/, '…');
  const lh = 14;
  const startDy = -((shown.length - 1) * lh) / 2;
  shown.forEach((line, i) => {
    const t = node('tspan', { x: cx, dy: i === 0 ? startDy : lh });
    t.textContent = line;
    textEl.append(t);
  });
}

function node(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
