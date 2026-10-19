import { iconGroup, iconHtml } from './icons.js';
import { fmtZeit } from '../model/zeit.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 150, H = 74, GAP = 30, PAD = 8, ICON = 14, LABEL_W = 96, LANE_H = 88, TOP = 24;

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

const vorgaengerVon = (s, i, steps) => s.nach ?? (i > 0 ? [steps[i - 1].nr] : []);
const ohneKlammer = (t) => String(t).replace(/\s*\(.*?\)/g, '').trim();

// Swimlanes (DR-038): Zeile = Arbeitsplatz (`ort`, Reihenfolge aus orte.json), Spalte = Zeit-Slot
// gleicher Breite. Spalte = frühester Slot nach allen Vorgängern, der im eigenen Arbeitsplatz frei ist.
export function swimlaneLayout(steps, orte = {}, vessel = null) {
  const reihenfolge = Object.keys(orte).filter((k) => !k.startsWith('_'));
  const genutzt = [...new Set(steps.map((s) => s.ort ?? 'schuessel'))];
  const bahnen = [...reihenfolge.filter((k) => genutzt.includes(k)), ...genutzt.filter((k) => !reihenfolge.includes(k))]
    .map((key) => ({ key, label: orte[key]?.label ?? (key === 'gefaess' && vessel ? ohneKlammer(vessel.label) : key) }));
  const bahn = steps.map((s) => bahnen.findIndex((b) => b.key === (s.ort ?? 'schuessel')));
  const spalte = [], start = [], ende = [];
  const belegt = new Set();
  steps.forEach((s, i) => {
    const vor = vorgaengerVon(s, i, steps);
    let c = Math.max(-1, ...vor.map((n) => spalte[n - 1] ?? -1)) + 1;
    while (belegt.has(`${bahn[i]}|${c}`)) c++;
    belegt.add(`${bahn[i]}|${c}`);
    spalte[i] = c;
    start[i] = Math.max(0, ...vor.map((n) => ende[n - 1] ?? 0));
    ende[i] = start[i] + (s.dauer ?? 0);
  });
  // Zutaten erscheinen dort, wo sie in den Ablauf kommen — danach tragen die Pfeile sie weiter
  const gesehen = new Set();
  const neu = steps.map((s) => (s.zutaten || []).filter((z) => !gesehen.has(z.rolle) && gesehen.add(z.rolle)).map((z) => ohneKlammer(z.label)));
  return { bahnen, bahn, spalte, start, neu, spalten: Math.max(0, ...spalte) + 1 };
}

// `bahnenSvg` (optional): eigene, nicht scrollende Spalte für die Zeilen-Titel — am Handy scrollt nur die Zeitachse
export function renderFlow(svg, details, computed, data = {}, bahnenSvg = null) {
  const namen = { ...(data.kategorien || {}), ...(data.verben || {}) };
  const steps = computed.ablauf;
  const L = swimlaneLayout(steps, data.orte, computed.vessel);
  const links = bahnenSvg ? GAP / 2 : LABEL_W;
  const boxX = (c) => links + c * (W + GAP);
  const boxY = (b) => TOP + b * LANE_H + (LANE_H - H) / 2;
  const total = links + L.spalten * (W + GAP);
  const hoehe = TOP + L.bahnen.length * LANE_H + PAD;
  const leeren = (el, breite) => {
    el.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    el.setAttribute('width', breite);
    el.setAttribute('height', hoehe);
    el.replaceChildren();
  };
  leeren(svg, total);
  if (bahnenSvg) leeren(bahnenSvg, LABEL_W);

  const defs = node('defs');
  const marker = node('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(node('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'flow-arrow' }));
  defs.append(marker);
  svg.append(defs);

  L.bahnen.forEach((b, i) => {
    const y = TOP + i * LANE_H;
    if (i % 2) svg.append(node('rect', { x: 0, y, width: total, height: LANE_H, class: 'flow-lane' }));
    if (i % 2 && bahnenSvg) bahnenSvg.append(node('rect', { x: 0, y, width: LABEL_W, height: LANE_H, class: 'flow-lane' }));
    const z = zeilen(b.label, 12, 2);
    z.forEach((t, k) => (bahnenSvg ?? svg).append(text(t, { x: PAD, y: y + LANE_H / 2 + (k - (z.length - 1) / 2) * 15, class: 'flow-lane-label', 'dominant-baseline': 'middle' })));
  });
  // Zeit-Slots: Startzeit des frühesten Schritts der Spalte
  for (let c = 0; c < L.spalten; c++) {
    const t = Math.min(...steps.map((s, i) => (L.spalte[i] === c ? L.start[i] : Infinity)));
    svg.append(text(t ? `ab ${fmtZeit(t)}` : 'Start', { x: boxX(c), y: TOP - 8, class: 'flow-typ' }));
  }

  // Kanten zuerst, damit die Kästen darüber liegen; Wechsel des Arbeitsplatzes = Übergabe, geknickt in der Lücke vor dem Ziel
  steps.forEach((s, i) => {
    const x2 = boxX(L.spalte[i]) - 2, y2 = boxY(L.bahn[i]) + H / 2;
    for (const nr of vorgaengerVon(s, i, steps)) {
      const v = nr - 1;
      if (L.spalte[v] == null) continue;
      const x1 = boxX(L.spalte[v]) + W, y1 = boxY(L.bahn[v]) + H / 2;
      const xm = x2 - GAP / 2 + 2;
      svg.append(y1 === y2
        ? node('line', { x1, y1, x2, y2, class: 'flow-edge', 'marker-end': 'url(#arrow)' })
        : node('path', { d: `M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`, fill: 'none', class: 'flow-edge is-transfer', 'marker-end': 'url(#arrow)' }));
    }
  });

  steps.forEach((s, i) => {
    const x = boxX(L.spalte[i]), y = boxY(L.bahn[i]);
    const g = node('g', { class: `flow-node typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`, 'data-step': i });
    g.append(node('rect', { x, y, width: W, height: H, rx: 8 }));
    const haupt = iconKeysFor(s).filter((k) => !(s.zutatKategorien || []).includes(k))[0];
    if (haupt) g.append(iconGroup(haupt, { x: x + 7, y: y + 7, size: ICON, title: namen[haupt]?.label }));
    g.append(text(s.aktion ?? s.label, { x: x + ICON + 12, y: y + 15, class: 'flow-aktion', 'dominant-baseline': 'middle' }));
    zeilen(L.neu[i].join(', '), 24, 2).forEach((z, k) => g.append(text(z, { x: x + 7, y: y + 33 + k * 14, class: 'flow-zutat', 'dominant-baseline': 'middle' })));
    const temp = s.key === 'backen' && computed.backen?.tempOU ? `${computed.backen.tempOU} °C O/U` : s.temperatur && ohneKlammer(s.temperatur);
    const meta = [s.dauer ? fmtZeit(s.dauer) : null, temp].filter(Boolean).join(' · ');
    if (meta) g.append(text(zeilen(meta, 26, 1)[0], { x: x + 7, y: y + H - 9, class: 'flow-typ', 'dominant-baseline': 'middle' }));
    const t = node('title');
    t.textContent = `${s.nr}. ${s.label}${s.eingefuegt ? ' (eingefügte Vorbereitung)' : ''}\n${s.wirkung}`;
    g.append(t);
    svg.append(g);
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
  const temp = s.temperatur ? ` · bei ${s.temperatur}` : '';
  if (!s.dauer) return temp;
  if (s.typ !== 'warten') return ` · ~${fmtZeit(s.dauer)}${temp}`;
  const f = s.zeit;
  return ` · ${fmtZeit(s.dauer)} warten${f ? ` (Fenster ${fmtZeit(f.min)}–${fmtZeit(f.max)})` : ''}${temp}`;
}

// Schritte derselben Ebene hängen nicht voneinander ab (T38) — Reihenfolge frei.
function parallelText(s, steps) {
  if (s.ebene == null) return '';
  const andere = steps.filter((x) => x !== s && x.ebene === s.ebene).map((x) => `${x.nr}.`);
  return andere.length ? ` · Reihenfolge frei (parallel zu ${andere.join(', ')})` : '';
}

// Wortweise auf höchstens `max` Zeilen umbrechen; was nicht passt, endet mit „…“ (voller Text im Tooltip)
export function zeilen(str, maxChars, max) {
  const lines = [];
  let cur = '';
  for (const w of String(str).split(' ').filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, max);
  const l = shown[max - 1];
  if (lines.length > max) shown[max - 1] = (l.includes(' ') ? l.replace(/\s+\S*$/, '') : l) + ' …';
  return shown;
}

function text(str, attrs) {
  const t = node('text', attrs);
  t.textContent = str;
  return t;
}

function node(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
