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
    // Drei lose Kristalle (Quadrate, je anders gedreht) statt runder Körner — wirkt
    // kantiger/kristalliner, wie Salz statt Zucker/Streugut. Position/Fläche je Punkt
    // unverändert zur vorherigen Kreis-Version (Seitenlänge = r·√π, flächengleich).
    // keepFill: bleiben auch in "holo" voll gefüllt statt hohler Umrisse (Körner/Streugut).
    { tag: 'rect', attrs: { x: 6.82, y: 8.82, width: 3.37, height: 3.37, rx: 0.4, fill: F, transform: 'rotate(20 8.5 10.5)' }, keepFill: true },
    { tag: 'rect', attrs: { x: 14.17, y: 6.67, width: 2.66, height: 2.66, rx: 0.4, fill: F, transform: 'rotate(50 15.5 8)' }, keepFill: true },
    { tag: 'rect', attrs: { x: 10.55, y: 14.05, width: 3.9, height: 3.9, rx: 0.4, fill: F, transform: 'rotate(-15 12.5 16)' }, keepFill: true },
  ],
  suesse: [
    // Gestapelte Zuckerwürfel (2 unten + 1 oben) statt vier schwebender Quadrate
    { tag: 'rect', attrs: { x: 5, y: 13, width: 6, height: 6, rx: 0.8, fill: F } },
    { tag: 'rect', attrs: { x: 12.5, y: 13, width: 6, height: 6, rx: 0.8, fill: F } },
    { tag: 'rect', attrs: { x: 8.75, y: 6, width: 6, height: 6, rx: 0.8, fill: F } },
  ],
  gemuese: [
    { tag: 'polygon', attrs: { points: '12,9 8.5,21 15.5,21', fill: F } },
    { tag: 'ellipse', attrs: { cx: 9.3, cy: 6.5, rx: 2.3, ry: 1.1, fill: F, transform: 'rotate(-35 9.3 6.5)' } },
    { tag: 'ellipse', attrs: { cx: 14.7, cy: 6.5, rx: 2.3, ry: 1.1, fill: F, transform: 'rotate(35 14.7 6.5)' } },
    { tag: 'ellipse', attrs: { cx: 12, cy: 4.8, rx: 1.1, ry: 2.6, fill: F } },
  ],
  frucht: [
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
    // keepFill: Streugut-Punkte bleiben auch in "holo" gefüllt statt zu Ringen zu werden.
    { tag: 'circle', attrs: { cx: 9, cy: 6, r: 0.9, fill: F }, keepFill: true },
    { tag: 'circle', attrs: { cx: 13, cy: 4, r: 0.9, fill: F }, keepFill: true },
    { tag: 'circle', attrs: { cx: 16, cy: 7, r: 0.9, fill: F }, keepFill: true },
  ],
  kohlenhydrate: [
    { tag: 'path', attrs: { d: 'M5 19 V13 A7 6 0 0 1 19 13 V19 Z', fill: F } },
  ],
  fleisch: [
    // Steak: rundliche Fläche mit drei ausgesparten Grillstreifen (fill-rule evenodd,
    // funktioniert unabhängig vom Hintergrund, da es echte Löcher im Pfad sind)
    { tag: 'path', attrs: {
      d: 'M12 5 C17 5 20 8.5 20 12.5 C20 16.5 16.5 20 11 20 C6 20 3.5 16.5 3.5 12 C3.5 8 6.5 5 12 5 Z'
        + ' M6.5 8 L8.5 8 L17 18 L15 18 Z'
        + ' M10 6 L12 6 L19.5 15.5 L17.5 15.5 Z'
        + ' M4 11 L6 11 L13 19.5 L11 19.5 Z',
      fill: F, 'fill-rule': 'evenodd',
    } },
  ],
  ei: [
    { tag: 'ellipse', attrs: { cx: 12, cy: 13.5, rx: 6, ry: 7.8, fill: F } },
  ],

  // --- Verben -----------------------------------------------------------
  schneiden: [
    // Koordinaten direkt in der Endlage (kein `transform` mehr): Klinge + Griff liegen auf
    // derselben 45°-Diagonale durch den Mittelpunkt (12,12) — Spitze Richtung obere rechte
    // Ecke, Griffende Richtung untere linke Ecke, jeweils so weit wie möglich ohne die
    // 24×24-viewBox zu verlassen (Eckenabstand vom Zentrum ≈ 16,97, Klingenlänge 16,5 davon
    // genutzt). Klingenlänge damit von 9 auf 16,5 fast verdoppelt (+83 %; echte Verdopplung
    // auf 18 würde die Spitze ~0,7 Einheiten über die viewBox hinausschieben → abgeschnitten).
    // Ober- und Griffkante bleiben durchgehend, da beide auf derselben Diagonalen liegen.
    { tag: 'path', attrs: { d: 'M12 12 L23.67 0.33 Q22.43 10.77 15.54 15.54 Z', fill: F } },
    { tag: 'path', attrs: { d: 'M12 12 L6.34 17.66 L9.17 20.49 L14.83 14.83 Z', fill: F } },
  ],
  vorbereiten: [
    { tag: 'ellipse', attrs: { cx: 12, cy: 9, rx: 8, ry: 2, fill: F } },
    { tag: 'path', attrs: { d: 'M4.5 9 H19.5 L17 19 A2 2 0 0 1 15 21 H9 A2 2 0 0 1 7 19 Z', fill: F } },
  ],
  mischen: [
    // 360°-Rotation als zwei ~160°-Bögen auf einer flach gedrückten Ellipse, mit
    // Lücken oben/unten (Bögen links/rechts) — Rühr-/Wirbelbewegung von oben gesehen.
    // Pfeilspitzen exakt tangential zur Ellipse berechnet (Ableitung der Parametrisierung
    // an der jeweiligen Endposition) statt geschätzt — zeigen dadurch präzise in
    // Rotationsrichtung, also Richtung Mitte/Lücke, nicht nach außen. Vergrößert (Faktor
    // ~1.6 auf Vor-/Rücksprung und Basisbreite) gegenüber der ersten tangentialen Version.
    // `holoD`: in "holo" endet die Linie 28° vor der Pfeilspitze (mehr Abstand als die
    // vorherigen 15°, da die größere Pfeilspitze sonst wieder zu nah an die Linie reicht),
    // damit sie nicht in die dort nur noch als Umriss gezeichnete Pfeilspitze hineinläuft.
    { tag: 'path', attrs: { d: 'M12 17.5 A8 5.5 0 0 1 9.26 6.83', fill: 'none', stroke: F, 'stroke-width': 2, 'stroke-linecap': 'round' }, holoD: 'M12 17.5 A8 5.5 0 0 1 6.06 8.32' },
    { tag: 'polygon', attrs: { points: '13.63,6.62 7.64,10.21 6.24,4.62', fill: F } },
    { tag: 'path', attrs: { d: 'M12 6.5 A8 5.5 0 0 1 14.74 17.17', fill: 'none', stroke: F, 'stroke-width': 2, 'stroke-linecap': 'round' }, holoD: 'M12 6.5 A8 5.5 0 0 1 17.95 15.68' },
    { tag: 'polygon', attrs: { points: '10.37,17.38 16.37,13.79 17.76,19.38', fill: F } },
  ],

  schlagen: [
    // Schneebesen mit betontem Kapsel-Griff (vormals Option "schlagen_b", jetzt aktiv) —
    // Griff-Länge 12,6 statt 8 Einheiten, kein Aufhängeloch mehr (Nutzer-Vorgabe „remove
    // holes"). Alte, kleinere Version bleibt als Backup unter `schlagen_a` erhalten.
    { tag: 'path', attrs: { d: 'M9.7 3.3 A2.3 2.3 0 0 1 12 1 A2.3 2.3 0 0 1 14.3 3.3 V11.3 A2.3 2.3 0 0 1 12 13.6 A2.3 2.3 0 0 1 9.7 11.3 Z', fill: F } },
    { tag: 'path', attrs: { d: 'M9.5 13.6 C6 15.5 6 19 12 22', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
    { tag: 'path', attrs: { d: 'M14.5 13.6 C18 15.5 18 19 12 22', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
    { tag: 'path', attrs: { d: 'M12 13.6 V22', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
  ],

  // --- Backup "schlagen_a" (ursprüngliche Version, kleiner Griff) ---
  // Nicht produktiv verdrahtet, nur zur Referenz/als Rückfalloption.
  schlagen_a: [
    { tag: 'rect', attrs: { x: 10.3, y: 2, width: 3.4, height: 5, rx: 1.2, fill: F } },
    { tag: 'path', attrs: { d: 'M9.5 6.5 C4.5 9.5 4.5 16.5 12 21', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
    { tag: 'path', attrs: { d: 'M14.5 6.5 C19.5 9.5 19.5 16.5 12 21', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
    { tag: 'path', attrs: { d: 'M12 6.5 V21', fill: 'none', stroke: F, 'stroke-width': 1.7, 'stroke-linecap': 'round' } },
  ],
  formen: [
    { tag: 'polygon', attrs: { points: '5,6 19,6 16,21 8,21', fill: F } },
  ],
  sieben: [
    // Sieb-Ring mit Gitter + durchfallendes Pulver — eigenes Symbol fürs trockene Mischen/Sieben
    { tag: 'circle', attrs: { cx: 12, cy: 9, r: 7, fill: 'none', stroke: F, 'stroke-width': 2 } },
    { tag: 'line', attrs: { x1: 5.2, y1: 9, x2: 18.8, y2: 9, stroke: F, 'stroke-width': 1 } },
    { tag: 'line', attrs: { x1: 9, y1: 3, x2: 9, y2: 15, stroke: F, 'stroke-width': 1 } },
    { tag: 'line', attrs: { x1: 15, y1: 3, x2: 15, y2: 15, stroke: F, 'stroke-width': 1 } },
    // keepFill: durchfallendes Pulver bleibt auch in "holo" gefüllt statt zu Ringen zu werden.
    { tag: 'circle', attrs: { cx: 9, cy: 19.5, r: 1, fill: F }, keepFill: true },
    { tag: 'circle', attrs: { cx: 12.5, cy: 21.5, r: 1, fill: F }, keepFill: true },
    { tag: 'circle', attrs: { cx: 15.5, cy: 19, r: 1, fill: F }, keepFill: true },
  ],
  erhitzen: [
    // Flamme mit Flicker-Kerbe — allgemeines Hitze-Verb (garen = erhitzen, intensitaet mittel)
    { tag: 'path', attrs: {
      d: 'M12 2 C9 6 7 8.5 7 12.5 C7 17 9.2 20.5 12 20.5 C14.8 20.5 17 17 17 12.5 C17 10.3 16.1 8.6 15 7.5 C15.3 9.8 13.9 10.6 13.1 9.3 C12.4 8.1 13.2 5.3 12 2 Z',
      fill: F,
    } },
  ],

  wiederholen: [
    // Kreisförmiger Pfeil (Loop) — Pseudo-Schritt "wiederholen ab ..."
    { tag: 'path', attrs: {
      d: 'M17 8 A7 7 0 1 1 7.5 15.8',
      fill: 'none', stroke: F, 'stroke-width': 2, 'stroke-linecap': 'round',
    } },
    { tag: 'polygon', attrs: { points: '4,14 9,15 6,19', fill: F } },
  ],
};

function attrsToStyleSafeEntries(attrs) {
  return Object.entries(attrs);
}

const HOLO_STROKE_WIDTH = 1.3;

// "holo": zeichnet nur den Umriss (kein Vollflächen-Fill) — z. B. für Dark-Mode
// oder sekundäre/inaktive Kontexte. Bereits stroke-basierte Formen (mischen,
// schlagen, sieben, wiederholen) bleiben unverändert, da sie schon
// Umriss-Charakter haben. Formen mit `keepFill: true` (kleine Körner-/Streugut-
// Punkte bei salz, pulver, sieben) bleiben ebenfalls immer gefüllt — als hohle
// Ringe wären sie kaum noch als Körner erkennbar. Formen mit `holoD` nutzen in
// „holo" einen alternativen `d`-Pfad (z. B. kürzere Linie vor einer nur noch als
// Umriss gezeichneten Pfeilspitze, siehe `mischen`).
function holoAttrs(attrs) {
  if (attrs.fill === 'none' && attrs.stroke) return attrs;
  const { fill, ...rest } = attrs;
  return { ...rest, fill: 'none', stroke: F, 'stroke-width': attrs['stroke-width'] ?? HOLO_STROKE_WIDTH, 'stroke-linejoin': 'round' };
}

function resolveShapes(key, variant) {
  const shapes = ICONS[key];
  if (!shapes) return null;
  if (variant !== 'holo') return shapes;
  return shapes.map((shape) => {
    if (shape.keepFill) return shape;
    const attrs = shape.holoD ? { ...shape.attrs, d: shape.holoD } : shape.attrs;
    return { tag: shape.tag, attrs: holoAttrs(attrs) };
  });
}

export function iconHtml(key, size = 16, title = null, variant = 'solid') {
  const shapes = resolveShapes(key, variant);
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

export function iconGroup(key, { x = 0, y = 0, size = 16, title = null, variant = 'solid' } = {}) {
  const shapes = resolveShapes(key, variant);
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
