import { iconGroup } from './icons.js';
import { fmtZeit } from '../model/zeit.js';
import { stromModell, verbIcon, dauerIconKey } from './flow.js';
import { vorbereitenZeile } from './zustandLink.js';

// Kompakt-Ansicht des Ablaufs (DR-073, Skizze des Nutzers 2026-10-24): nur Icons, Zeit läuft nach unten.
// Je Zeile ein Knoten (Werkzeug/Tätigkeit, am Ende Uhr oder Ofen); Zutaten rechts mit Pfeil hinein;
// Seitenstränge (Eischnee) als Spalten links, die in ihren Zielschritt münden. Namen und Mengen erst beim Antippen.
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

export function renderKompakt(root, computed, data = {}) {
  const steps = computed.ablauf;
  const M = stromModell(steps, data.orte, computed.vessel);
  const K = kompaktModell(M, steps);
  const x0 = PAD + K.spalten * LANE + R;
  const xVon = (k) => x0 - k.spalte * LANE;
  const yVon = (k) => PAD + k.zeile * ROW + ROW / 2;
  const maxZut = Math.max(0, ...K.knoten.map((k) => k.neu.length));
  const breite = x0 + R + 24 + maxZut * ZUT_ABST + PAD;
  const hoehe = PAD * 2 + K.zeilen * ROW;
  const svg = svgEl('svg', { viewBox: `0 0 ${breite} ${hoehe}`, width: breite, height: hoehe, class: 'kompakt-svg', role: 'img', 'aria-label': 'Ablauf kompakt: Symbole antippen für Name und Menge' });
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'kompakt-pfeil', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' });
  marker.append(svgEl('path', { d: 'M0 0L8 4L0 8Z', class: 'kompakt-spitze' }));
  defs.append(marker);
  svg.append(defs);

  const info = el('div', 'kompakt-info', 'Symbol antippen: Name und Menge');
  const zeige = (text) => { info.textContent = text; };

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
    const g = svgEl('g', { class: `kompakt-knoten ist-${k.art}`, tabindex: 0, role: 'button', style: `--c: var(--ort-${k.farbe})` });
    g.append(svgEl('circle', { cx: x, cy: y, r: R }));
    g.append(iconGroup(k.icon, { x: x - ICON / 2, y: y - ICON / 2, size: ICON, title: s.label }));
    klickbar(g, () => zeige(schrittText(s, k, computed)));
    svg.append(g);
    if (!k.neu.length) continue;
    const xz = x0 + R + 24;
    svg.append(svgEl('path', { d: `M${xz - 4} ${y}H${x + R + 3}`, class: 'kompakt-zufluss', 'marker-end': 'url(#kompakt-pfeil)' }));
    k.neu.forEach((n, j) => {
      const z = iconGroup(n.icon, { x: xz + j * ZUT_ABST, y: y - ZUT / 2, size: ZUT, title: n.label });
      z.classList.add('kompakt-zutat');
      z.setAttribute('tabindex', '0');
      z.setAttribute('role', 'button');
      klickbar(z, () => zeige(zutatText(n, computed)));
      svg.append(z);
    });
  }

  const zustaende = (computed.zustaende || []).filter((z) => !z.gewaehlt);
  const fuss = el('div', 'strom-fuss kompakt-fuss', `Zeit ↓ · fertig nach ${fmtZeit(M.gesamt)} ab Start · Hände ${fmtZeit(M.aktiv)}`);
  root.className = 'kompakt';
  root.replaceChildren(...(zustaende.length ? [vorbereitenZeile(zustaende, 'strom-vorbereiten')] : []), el('div', 'kompakt-bild', null), info, fuss);
  root.querySelector('.kompakt-bild').append(svg);
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
