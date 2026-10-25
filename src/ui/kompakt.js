import { iconGroup } from './icons.js';
import { fmtZeit } from '../model/zeit.js';
import { stromModell, verbIcon, dauerIconKey } from './flow.js';
import { vorbereitenZeile } from './zustandLink.js';

// Kompakt-Ansicht des Ablaufs (DR-073, Skizze des Nutzers 2026-10-24): nur Icons, Zeit läuft nach unten.
// Je Zeile ein Knoten (Werkzeug/Tätigkeit, am Ende Uhr oder Ofen); Zutaten rechts mit Pfeil hinein;
// Seitenstränge (Eischnee) als Spalten links, die in ihren Zielschritt münden. Namen und Mengen erst beim Antippen.
// Dazu die Variante „mit Namen“ (DR-081, Nutzer 2026-10-25: auf dem Handy schwer lesbar): neben jedem Knoten steht der Schritt mit Zeit
// und Temperatur, darunter die zufließenden Zutaten als Liste mit Symbol, Name und Menge, in der Breite des Bildschirms umgebrochen.
const NS = 'http://www.w3.org/2000/svg';
const ROW = 44, LANE = 30, R = 15, ICON = 20, ZUT = 22, ZUT_ABST = 28, PAD = 6;

export function kompaktModell(M, steps) {
  const knoten = [];
  const kanten = [];
  let zeile = 0;
  for (const z of M.zeilen) {
    if (z.art === 'aktion') {
      const s = steps[z.i];
      const neben = z.strom === 'neben';
      knoten.push({ art: 'aktion', i: z.i, zeile, spalte: neben ? z.strang.spur : 0, icon: verbIcon(s), neu: z.neu, strang: neben ? z.strang : null, farbe: (neben ? z.strang.ort : z.haupt?.ort ?? z.ort).farbe });
      zeile++;
    } else if (z.art === 'leer' && z.uhren.length) {
      for (const u of z.uhren) {
        const s = steps[u.i];
        const spalte = u.spur ?? 0;
        // Wartezeit gehört zum Strang, dessen letzter Knoten in derselben Spalte liegt
        const strang = spalte ? [...knoten].reverse().find((k) => k.spalte === spalte)?.strang ?? null : null;
        knoten.push({ art: 'warten', i: u.i, zeile, spalte, icon: s.ort === 'ofen' ? 'ort_ofen' : dauerIconKey(s.wirk ?? s.dauer ?? 0), neu: [], strang, farbe: strang?.ort.farbe ?? M.ort(s.ort).farbe });
      }
      zeile++;
    }
  }
  // Kette je Strang (Hauptstrom = null), dann Mündung des Strangs in seinen Zielschritt und Abzweig von der Quelle
  const ketten = new Map();
  for (const k of knoten) {
    const vorher = ketten.get(k.strang);
    if (vorher) kanten.push({ art: 'kette', von: vorher, zu: k });
    ketten.set(k.strang, k);
  }
  for (const [st, letzter] of ketten) {
    if (!st) continue;
    const ziel = knoten.find((k) => k.art === 'aktion' && k.i === st.ziel);
    if (ziel) kanten.push({ art: 'muendung', von: letzter, zu: ziel });
    const quelle = st.quelle != null && knoten.find((k) => k.art === 'aktion' && k.i === st.quelle);
    const erster = knoten.find((k) => k.strang === st);
    if (quelle && erster) kanten.push({ art: 'quelle', von: quelle, zu: erster });
  }
  return { knoten, kanten, zeilen: zeile, spalten: M.spuren };
}

// Maße der Namen-Variante (Pixel bei 13 px Schrift)
export const NAMEN = { ZEICHEN: 6.9, LINIE: 17, ZUT_MIN: 24, OBEN: 20, ROW: 44, ICON: 18, ICON_PLATZ: 26 };

// Text auf Zeilen von höchstens `max` Zeichen umbrechen (an Leerzeichen; ein zu langes Wort wird hart geteilt)
export function umbrechen(text, max) {
  const zeilen = [];
  let zeile = '';
  const schiebe = () => { if (zeile) zeilen.push(zeile); zeile = ''; };
  for (let wort of String(text ?? '').split(/\s+/).filter(Boolean)) {
    while (wort.length > max) { schiebe(); zeilen.push(wort.slice(0, max)); wort = wort.slice(max); }
    if (!zeile) zeile = wort;
    else if ((zeile + ' ' + wort).length <= max) zeile += ' ' + wort;
    else { schiebe(); zeile = wort; }
  }
  schiebe();
  return zeilen.length ? zeilen : [''];
}

// Texte je Knoten: Schritt (umbrochen) und zufließende Zutaten mit Symbol, Name und Menge
export function knotenTexte(K, steps, computed, maxZeichen) {
  const texte = new Map();
  for (const k of K.knoten) {
    const s = steps[k.i];
    const zutatZeichen = Math.max(8, maxZeichen - Math.ceil(NAMEN.ICON_PLATZ / NAMEN.ZEICHEN));
    texte.set(k, {
      titel: umbrechen(schrittText(s, k, computed), maxZeichen),
      zutaten: k.neu.map((n) => ({ icon: n.icon, label: n.label, zeilen: umbrechen(zutatText(n, computed), zutatZeichen) })),
    });
  }
  return texte;
}

// Zeilen eines Textblocks (Schritt, darunter die Zutaten) ab der Knotenmitte cy
function blockLayout(t, cy) {
  const L = NAMEN;
  const titelY = t.titel.map((_, i) => cy + 5 + i * L.LINIE);
  let zy = titelY.at(-1) + 10;
  const zutaten = t.zutaten.map((x) => {
    const h = Math.max(L.ZUT_MIN, x.zeilen.length * L.LINIE + 6);
    const g = { top: zy, h, iconY: zy + h / 2, textY: x.zeilen.map((_, i) => zy + 16 + i * L.LINIE) };
    zy += h;
    return g;
  });
  return { titelY, zutaten, unten: zutaten.length ? zy : titelY.at(-1) };
}

// Textblock zeichnen: Schritt fett, Zutaten mit Symbol, Name und Menge
function zeichneBlock(svg, t, geo, textX, kennung) {
  t.titel.forEach((zeile, i) => { const x = svgEl('text', { x: textX, y: geo.titelY[i], class: 'kompakt-titel' }); if (kennung != null) x.setAttribute('data-schritt', kennung); x.textContent = zeile; svg.append(x); });
  t.zutaten.forEach((zt, j) => {
    const gz = geo.zutaten[j];
    const ic = iconGroup(zt.icon, { x: textX, y: gz.iconY - NAMEN.ICON / 2, size: NAMEN.ICON, title: zt.label });
    ic.classList.add('kompakt-zutat');
    if (kennung != null) ic.setAttribute('data-zutat', `${kennung}:${j}`);
    svg.append(ic);
    zt.zeilen.forEach((zeile, i) => { const x = svgEl('text', { x: textX + NAMEN.ICON_PLATZ, y: gz.textY[i], class: 'kompakt-zutatentext' }); x.textContent = zeile; svg.append(x); });
  });
}

// Senkrechte Lage in der Namen-Variante: je Zeile des Modells ein Block je Knoten, übereinander; die Höhe richtet sich nach dem Text.
// Rückgabe: geo (Knoten → cy, titelY[], zutaten[{top, h, iconY, textY[]}]) und die Gesamthöhe.
export function namenLayout(K, texte, pad = 6) {
  const L = NAMEN;
  const geo = new Map();
  let top = pad;
  for (let z = 0; z < K.zeilen; z++) {
    for (const k of K.knoten.filter((x) => x.zeile === z)) {
      const cy = top + L.OBEN;
      const { titelY, zutaten, unten } = blockLayout(texte.get(k), cy);
      geo.set(k, { cy, titelY, zutaten, von: top, bis: Math.max(top + L.ROW, unten + 10) });
      top = geo.get(k).bis;
    }
  }
  return { geo, hoehe: top + pad };
}

// opt.namen: Namen-Variante; opt.breite: verfügbare Breite in Pixeln (sonst die des Behälters, sonst 340)
export function renderKompakt(root, computed, data = {}, opt = {}) {
  const steps = computed.ablauf;
  const M = stromModell(steps, data.orte, computed.vessel);
  const K = kompaktModell(M, steps);
  const namen = opt.namen === true;
  const gesamt = Math.max(240, Math.min(640, Math.round(opt.breite || root.clientWidth || 340))); // höchstens 640: auf breiten Bildschirmen bleibt der Text lesbar und das Diagramm lässt sich zentrieren
  // Symbole: aufgeklappte Schritte (T144), gemerkt am Behälter, verworfen wenn sich der Ablauf ändert
  const sig = steps.map((s) => s.key).join();
  if (root._offen?.sig !== sig) root._offen = { sig, set: new Set() };
  const offen = namen ? new Set() : root._offen.set;
  const maxZut = Math.max(0, ...K.knoten.map((k) => k.neu.length));
  // Symbole: die Breite hängt nie vom aufgeklappten Detail ab, und der Strom bleibt in der Mitte der Zeichnung (links so viel Rand wie rechts Platz für den Text),
  // damit nichts springt, wenn ein Detail auf- oder zugeht (Meldung 20261025-094730)
  const x0Basis = PAD + K.spalten * LANE + R;
  const breiteSym = x0Basis + R + 24 + maxZut * ZUT_ABST + PAD;
  const textBreite = x0Basis + R + 12 + PAD + 230; // Platz für das Detail rechts vom Strom
  // Vollbild auf schmalem Bildschirm (Handy hochkant): keine Reserve für das Detail, die Zeichnung ist so schmal wie der Strom und wird dadurch um so größer eingepasst (DR-100); das Detail bricht enger um
  const eng = !namen && gesamt < 520 && !!root.closest?.('.ablauf-voll');
  const breite = namen ? gesamt : eng ? breiteSym : Math.max(breiteSym, Math.min(gesamt, 2 * textBreite - breiteSym));
  const rand = namen ? 0 : (breite - breiteSym) / 2;
  const x0 = x0Basis + rand;
  const xVon = (k) => x0 - k.spalte * LANE;
  const textX = x0 + R + 12;
  // Namen: Text rechts vom Strom; Symbole: das Detail unterbricht die Linien und nutzt die volle Breite unter dem Schritt (Meldung des Nutzers 2026-10-25)
  const maxZeichen = Math.max(12, Math.floor((breite - (namen ? textX + PAD : PAD * 3)) / NAMEN.ZEICHEN));
  const texte = namen || offen.size ? knotenTexte(K, steps, computed, maxZeichen) : null;
  const lay = namen ? namenLayout(K, texte) : null;
  // Symbole: unter einer Zeile mit aufgeklapptem Schritt wächst der Abstand um die Höhe des Textes
  const extra = Array(K.zeilen).fill(0);
  for (const k of K.knoten) if (offen.has(k.i)) extra[k.zeile] = Math.max(extra[k.zeile], blockLayout(texte.get(k), 8).unten + 6);
  // Vollbild hochkant (opt.ziel = Pixelmaß des Bildbereichs): ist die Zeichnung auf die Breite begrenzt und bleibt darunter Platz, rücken die Zeilen auseinander (höchstens 2,5-fach)
  const natuerlich = PAD * 2 + K.zeilen * ROW + extra.reduce((a, b) => a + b, 0);
  const zielHoehe = opt.ziel && !namen ? (opt.ziel.h * breite) / opt.ziel.w : 0;
  const zeilenHoehe = zielHoehe > natuerlich ? ROW + Math.min((zielHoehe - natuerlich) / K.zeilen, ROW * 1.5) : ROW;
  const zeilenTop = [];
  let summe = PAD;
  extra.forEach((e, z) => { zeilenTop[z] = summe; summe += zeilenHoehe + e; });
  const yVon = (k) => (lay ? lay.geo.get(k).cy : zeilenTop[k.zeile] + zeilenHoehe / 2);
  const hoehe = namen ? lay.hoehe : summe + PAD;
  const svg = svgEl('svg', { viewBox: `0 0 ${breite} ${hoehe}`, width: breite, height: hoehe, class: `kompakt-svg${namen ? ' mit-namen' : ''}${eng ? ' eng' : ''}`, role: 'img', 'aria-label': namen ? 'Ablauf kompakt mit Namen und Mengen' : 'Ablauf kompakt: Schritt, Zutat oder Pfeil antippen für Name und Menge' });
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'kompakt-pfeil', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' });
  marker.append(svgEl('path', { d: 'M0 0L8 4L0 8Z', class: 'kompakt-spitze' }));
  defs.append(marker);
  svg.append(defs);

  const info = el('div', 'kompakt-info', namen ? '' : 'Schritt, Zutat oder Pfeil antippen: Name und Menge');
  const zeige = (text) => { info.textContent = text; };
  const umschalten = (k) => {
    const war = offen.has(k.i);
    offen.clear(); // höchstens ein Detail offen: ein Klick auf einen anderen Schritt schließt das alte
    if (!war) offen.add(k.i);
    renderKompakt(root, computed, data, opt);
    root.querySelector(`g[data-schritt="${k.i}"]`)?.focus();
  };
  const knopf = (e, k, f) => {
    e.setAttribute('tabindex', '0');
    e.setAttribute('role', 'button');
    e.setAttribute('aria-expanded', String(offen.has(k.i)));
    klickbar(e, f);
  };

  for (const kante of K.kanten) {
    const [a, b] = [kante.von, kante.zu];
    const [xa, ya, xb, yb] = [xVon(a), yVon(a), xVon(b), yVon(b)];
    const d = kante.art === 'kette' ? `M${xa} ${ya + R}V${yb - R}`
      // Mündung: in der eigenen Spalte bis kurz vor die Zielzeile, dann im Bogen hinüber in den Zielknoten
      : kante.art === 'muendung' ? `M${xa} ${ya + R}V${yb - 12}Q${xa} ${yb} ${xa + 12} ${yb}H${xb - R}`
      : `M${xa - R} ${ya}H${xb + 12}Q${xb} ${ya} ${xb} ${ya + 12}V${yb - R}`;
    svg.append(svgEl('path', { d, class: `kompakt-linie ist-${kante.art}`, style: `--c: var(--ort-${a.farbe})` }));
  }

  for (const k of K.knoten) {
    const s = steps[k.i];
    const [x, y] = [xVon(k), yVon(k)];
    const g = svgEl('g', { class: `kompakt-knoten ist-${k.art}`, 'data-schritt': k.i, style: `--c: var(--ort-${k.farbe})` });
    g.append(svgEl('circle', { cx: x, cy: y, r: R }));
    g.append(iconGroup(k.icon, { x: x - ICON / 2, y: y - ICON / 2, size: ICON, title: s.label }));
    if (namen) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); klickbar(g, () => zeige(schrittText(s, k, computed))); } else knopf(g, k, () => umschalten(k));
    svg.append(g);
    if (namen) {
      zeichneBlock(svg, texte.get(k), lay.geo.get(k), textX, k.i);
      continue;
    }
    if (offen.has(k.i)) {
      const oben = zeilenTop[k.zeile] + zeilenHoehe;
      svg.append(svgEl('rect', { x: 0, y: oben - 2, width: breite, height: extra[k.zeile], class: 'kompakt-detailgrund' })); // verdeckt die Linien im Bereich des Details
      zeichneBlock(svg, texte.get(k), blockLayout(texte.get(k), oben + 8), PAD + 2, k.i);
    }
    if (!k.neu.length) continue;
    const xz = x0 + R + 24;
    const pfeil = svgEl('g', { class: 'kompakt-pfeilgruppe', 'data-schritt': k.i });
    pfeil.append(svgEl('path', { d: `M${xz - 4} ${y}H${x + R + 3}`, class: 'kompakt-zufluss', 'marker-end': 'url(#kompakt-pfeil)' }));
    pfeil.append(svgEl('path', { d: `M${xz - 4} ${y}H${x + R + 3}`, class: 'kompakt-treffer' }));
    knopf(pfeil, k, () => umschalten(k));
    svg.append(pfeil);
    k.neu.forEach((n, j) => {
      const z = iconGroup(n.icon, { x: xz + j * ZUT_ABST, y: y - ZUT / 2, size: ZUT, title: n.label });
      z.classList.add('kompakt-zutat');
      z.setAttribute('data-zutat', `${k.i}:${j}`);
      knopf(z, k, () => umschalten(k));
      svg.append(z);
    });
  }

  const zustaende = (computed.zustaende || []).filter((z) => !z.gewaehlt);
  const fuss = el('div', 'strom-fuss kompakt-fuss', `Zeit ↓ · fertig nach ${fmtZeit(M.gesamt)} ab Start · Hände ${fmtZeit(M.aktiv)}`);
  root.className = 'kompakt';
  root.replaceChildren(...(zustaende.length ? [vorbereitenZeile(zustaende, 'strom-vorbereiten')] : []), el('div', 'kompakt-bild', null), info, fuss);
  root.querySelector('.kompakt-bild').append(svg);
  // im Vollbild den Bildbereich messen und, wenn unten Platz bleibt, einmal mit dem Maß neu zeichnen
  if (!namen && !opt.ziel && root.closest?.('.ablauf-voll')) {
    const bild = root.querySelector('.kompakt-bild');
    const [w, h] = [bild.clientWidth, bild.clientHeight];
    if (w > 0 && h > 0 && (h * breite) / w > hoehe + 1) renderKompakt(root, computed, data, { ...opt, ziel: { w, h } });
  }
}

// Name und Menge: aus der Zutatenliste (Stück bleiben Stück); ein Teil (Eiweiß) nennt die ganze Zutat dazu
function zutatText(n, computed) {
  const rolle = n.rolle.split(':')[0];
  const menge = (computed.zutatenListe || []).filter((z) => z.rolle === rolle).map((z) => `${z.label} ${z.menge} ${z.einheit}`).join(' + ');
  return n.teil ? `${n.label} (von ${menge})` : menge || n.label;
}

function schrittText(s, k, computed) {
  const temp = s.key === 'backen' && computed.backen?.tempOU ? `${computed.backen.tempOU} °C O/U` : s.temperatur;
  const dauer = k.art === 'warten' ? s.wirk ?? s.dauer : s.passiv ? s.aktiv : s.dauer;
  const titel = k.art === 'warten' ? s.aktion ?? s.label : s.passiv ? s.handgriff ?? s.aktion : s.label;
  return [`${s.nr}. ${titel}`, dauer ? fmtZeit(dauer) : null, temp].filter(Boolean).join(' · ');
}

function klickbar(g, f) {
  g.addEventListener('click', f);
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } });
}

function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
