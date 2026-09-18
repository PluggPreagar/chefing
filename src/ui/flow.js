const NS = 'http://www.w3.org/2000/svg';
const W = 168, H = 64, GAP = 44, PAD = 16;

export function renderFlow(svg, details, computed) {
  const steps = computed.ablauf;
  const total = PAD * 2 + steps.length * W + (steps.length - 1) * GAP;
  svg.setAttribute('viewBox', `0 0 ${total} ${H + PAD * 2 + 24}`);
  svg.setAttribute('width', total);
  svg.replaceChildren();

  const defs = node('defs');
  const marker = node('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(node('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'flow-arrow' }));
  defs.append(marker);
  svg.append(defs);

  steps.forEach((s, i) => {
    const x = PAD + i * (W + GAP);
    const y = PAD;
    const g = node('g', { class: `flow-node typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`, 'data-step': i });
    g.append(node('rect', { x, y, width: W, height: H, rx: 10 }));
    const label = node('text', { x: x + W / 2, y: y + H / 2, class: 'flow-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    wrap(label, `${s.nr}. ${s.label}`, 24, x + W / 2);
    g.append(label);
    const typ = node('text', { x: x + W / 2, y: y + H + 16, class: 'flow-typ', 'text-anchor': 'middle' });
    typ.textContent = s.eingefuegt ? 'eingefügte Vorbereitung' : s.typ;
    g.append(typ);
    const t = node('title');
    t.textContent = s.wirkung;
    g.append(t);
    svg.append(g);
    if (i < steps.length - 1) {
      svg.append(node('line', { x1: x + W, y1: y + H / 2, x2: x + W + GAP - 2, y2: y + H / 2, class: 'flow-edge', 'marker-end': 'url(#arrow)' }));
    }
  });

  details.replaceChildren();
  for (const s of steps) {
    const li = document.createElement('li');
    li.className = `step typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`;
    const h = document.createElement('div');
    h.className = 'step-title';
    h.textContent = `${s.nr}. ${s.label}${s.dauer ? ` · ~${s.dauer} Min.` : ''}${s.eingefuegt ? ' · automatisch eingefügt' : ''}`;
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
