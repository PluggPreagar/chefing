// Kleines, wiederverwendbares Piktogramm-Set: einfache, einfarbige Formen
// (kein Emoji). Jeder Schlüssel entspricht einem Key aus kategorien.json
// oder verben.json. Jedes Icon ist eine Liste einfacher SVG-Grundformen
// auf einem 24×24-Raster — bewusst reduziert, damit sie auch sehr klein
// noch erkennbar bleiben.
const NS = 'http://www.w3.org/2000/svg';
export const VIEWBOX = '0 0 24 24';

const F = 'currentColor';

export const ICONS = {
  // --- Kategorien -----------------------------------------------------
  salz: [
    { tag: 'rect', attrs: { x: 7, y: 9, width: 10, height: 11, rx: 2, fill: F } },
    { tag: 'rect', attrs: { x: 9, y: 5, width: 6, height: 4, rx: 1, fill: F } },
    { tag: 'circle', attrs: { cx: 9.5, cy: 3, r: 0.8, fill: F } },
    { tag: 'circle', attrs: { cx: 12, cy: 2, r: 0.8, fill: F } },
    { tag: 'circle', attrs: { cx: 14.5, cy: 3, r: 0.8, fill: F } },
  ],
  suesse: [
    { tag: 'rect', attrs: { x: 4.5, y: 6, width: 4, height: 4, rx: 0.6, fill: F } },
    { tag: 'rect', attrs: { x: 13, y: 4.5, width: 4, height: 4, rx: 0.6, fill: F } },
    { tag: 'rect', attrs: { x: 15, y: 13, width: 4, height: 4, rx: 0.6, fill: F } },
    { tag: 'rect', attrs: { x: 7, y: 15, width: 4, height: 4, rx: 0.6, fill: F } },
  ],
  gemuese: [
    { tag: 'polygon', attrs: { points: '12,9 8.5,21 15.5,21', fill: F } },
    { tag: 'ellipse', attrs: { cx: 9.3, cy: 6.5, rx: 2.3, ry: 1.1, fill: F, transform: 'rotate(-35 9.3 6.5)' } },
    { tag: 'ellipse', attrs: { cx: 14.7, cy: 6.5, rx: 2.3, ry: 1.1, fill: F, transform: 'rotate(35 14.7 6.5)' } },
    { tag: 'ellipse', attrs: { cx: 12, cy: 4.8, rx: 1.1, ry: 2.6, fill: F } },
  ],
  obst: [
    { tag: 'circle', attrs: { cx: 12, cy: 14.5, r: 6.5, fill: F } },
    { tag: 'rect', attrs: { x: 11.2, y: 4.5, width: 1.6, height: 4.5, rx: 0.6, fill: F } },
    { tag: 'ellipse', attrs: { cx: 15.2, cy: 6, rx: 2.2, ry: 1.3, fill: F, transform: 'rotate(-25 15.2 6)' } },
  ],
  mehl: [
    { tag: 'rect', attrs: { x: 11.3, y: 4, width: 1.4, height: 17, rx: 0.7, fill: F } },
    { tag: 'ellipse', attrs: { cx: 9.3, cy: 8, rx: 2, ry: 1.1, fill: F, transform: 'rotate(-35 9.3 8)' } },
    { tag: 'ellipse', attrs: { cx: 14.7, cy: 8, rx: 2, ry: 1.1, fill: F, transform: 'rotate(35 14.7 8)' } },
    { tag: 'ellipse', attrs: { cx: 9.3, cy: 11.5, rx: 2, ry: 1.1, fill: F, transform: 'rotate(-35 9.3 11.5)' } },
    { tag: 'ellipse', attrs: { cx: 14.7, cy: 11.5, rx: 2, ry: 1.1, fill: F, transform: 'rotate(35 14.7 11.5)' } },
    { tag: 'ellipse', attrs: { cx: 9.3, cy: 15, rx: 2, ry: 1.1, fill: F, transform: 'rotate(-35 9.3 15)' } },
    { tag: 'ellipse', attrs: { cx: 14.7, cy: 15, rx: 2, ry: 1.1, fill: F, transform: 'rotate(35 14.7 15)' } },
  ],
  fett: [
    { tag: 'rect', attrs: { x: 5, y: 8, width: 14, height: 9, rx: 1.5, fill: F } },
  ],
  fluessigkeit: [
    { tag: 'path', attrs: { d: 'M12 3 C8.5 9 5.5 13 5.5 16.5 A6.5 6.5 0 0 0 18.5 16.5 C18.5 13 15.5 9 12 3 Z', fill: F } },
  ],
  pulver: [
    { tag: 'polygon', attrs: { points: '4,20 20,20 12,10', fill: F } },
    { tag: 'circle', attrs: { cx: 9, cy: 6, r: 0.9, fill: F } },
    { tag: 'circle', attrs: { cx: 13, cy: 4, r: 0.9, fill: F } },
    { tag: 'circle', attrs: { cx: 16, cy: 7, r: 0.9, fill: F } },
  ],
  kohlenhydrate: [
    { tag: 'path', attrs: { d: 'M5 19 V13 A7 6 0 0 1 19 13 V19 Z', fill: F } },
  ],
  fleisch: [
    { tag: 'ellipse', attrs: { cx: 9, cy: 9, rx: 7.5, ry: 6.3, fill: F, transform: 'rotate(-30 9 9)' } },
    { tag: 'rect', attrs: { x: 13, y: 12.3, width: 9, height: 2.6, rx: 1.3, fill: F, transform: 'rotate(45 13 12.3)' } },
    { tag: 'circle', attrs: { cx: 20, cy: 19.3, r: 2.6, fill: F } },
  ],
  ei: [
    { tag: 'ellipse', attrs: { cx: 12, cy: 13.5, rx: 6, ry: 7.8, fill: F } },
  ],

  // --- Verben -----------------------------------------------------------
  schneiden: [
    { tag: 'polygon', attrs: { points: '2,11 14,5 14,15', fill: F } },
    { tag: 'rect', attrs: { x: 14, y: 8, width: 8, height: 6, rx: 1.5, fill: F } },
  ],
  vorbereiten: [
    { tag: 'ellipse', attrs: { cx: 12, cy: 9, rx: 8, ry: 2, fill: F } },
    { tag: 'path', attrs: { d: 'M4.5 9 H19.5 L17 19 A2 2 0 0 1 15 21 H9 A2 2 0 0 1 7 19 Z', fill: F } },
  ],
  mischen: [
    { tag: 'path', attrs: { d: 'M6.5 7 A7 7 0 1 0 12.5 19', fill: 'none', stroke: F, 'stroke-width': 2.3, 'stroke-linecap': 'round' } },
    { tag: 'polygon', attrs: { points: '12.5,19 16,17.6 13.4,22.3', fill: F } },
  ],
  formen: [
    { tag: 'polygon', attrs: { points: '5,6 19,6 16,21 8,21', fill: F } },
  ],
  garen: [
    { tag: 'path', attrs: {
      d: 'M12 2 C10 5 12 7 11 9 C10 6 7 8 7 12 A5 6 0 0 0 17 12 C17 8 14 6 13 9 C12 7 14 5 12 2 Z',
      fill: F,
    } },
  ],
};

function attrsToStyleSafeEntries(attrs) {
  return Object.entries(attrs);
}

export function iconHtml(key, size = 16, title = null) {
  const shapes = ICONS[key];
  if (!shapes) return '';
  const inner = shapes
    .map(({ tag, attrs }) => `<${tag} ${attrsToStyleSafeEntries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}></${tag}>`)
    .join('');
  const svg = `<svg viewBox="${VIEWBOX}" width="${size}" height="${size}" class="icon" aria-hidden="true" focusable="false">${inner}</svg>`;
  return title ? `<span class="icon-wrap" title="${escapeAttr(title)}">${svg}</span>` : svg;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function iconGroup(key, { x = 0, y = 0, size = 16, title = null } = {}) {
  const shapes = ICONS[key];
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'icon-svg');
  if (title) {
    const t = document.createElementNS(NS, 'title');
    t.textContent = title;
    g.append(t);
  }
  if (!shapes) return g;
  const scale = size / 24;
  g.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
  for (const { tag, attrs } of shapes) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    g.append(el);
  }
  return g;
}
