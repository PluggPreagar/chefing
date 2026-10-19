import { iconHtml } from './icons.js';
import { fmtZeit } from '../model/zeit.js';

// verb=mischen wird je nach Intensität als anderes Icon dargestellt
// (passiv=Einlegen/Ruhen, sanft=Mischen-S, kraeftig=Schlagen), statt drei
// eigene Verben zu pflegen.
const MISCHEN_ICON = { passiv: 'vorbereiten', sanft: 'mischen', kraeftig: 'schlagen' };

// Warten (DR-024/T44) zeigt statt des Verb-Icons eine Uhr der nächstliegenden Dauer-Stufe.
const DAUER_STUFEN = [5, 10, 15, 30, 45, 60];
const dauerIconKey = (min) => `dauer_${DAUER_STUFEN.reduce((a, m) => (Math.abs(m - min) < Math.abs(a - min) ? m : a), DAUER_STUFEN[0])}`;
const hauptIcon = (s) => (s.typ === 'warten' && s.dauer ? dauerIconKey(s.dauer)
  : s.verb === 'mischen' ? (MISCHEN_ICON[s.intensitaet] ?? 'mischen') : s.verb);

const vorgaengerVon = (s, i, steps) => s.nach ?? (i > 0 ? [steps[i - 1].nr] : []);
const ohneKlammer = (t) => String(t).replace(/\s*\(.*?\)/g, '').trim();

// Strom + Zufluss (DR-039): der Hauptstrom ist der Weg des Teigs (Schüssel → Fläche → Gefäß → Ofen).
// Schritte mit neuen Zutaten fließen als Zufluss hinein, Schritte ohne sitzen auf dem Strom.
// Schritte an Nebenplätzen (orte.json `neben`) bilden einen kurzen Seitenstrom direkt vor dem
// Hauptschritt, in den sie (auch über weitere Nebenschritte) münden.
export function stromModell(steps, orte = {}, vessel = null) {
  const start = [], ende = [];
  steps.forEach((s, i) => {
    start[i] = Math.max(0, ...vorgaengerVon(s, i, steps).map((n) => ende[n - 1] ?? 0));
    ende[i] = start[i] + (s.dauer ?? 0);
  });
  // Zutaten erscheinen dort, wo sie in den Ablauf kommen — danach trägt der Strom sie weiter
  const gesehen = new Set();
  const neu = steps.map((s) => (s.zutaten || []).filter((z) => !gesehen.has(z.rolle) && gesehen.add(z.rolle))
    .map((z) => ({ label: ohneKlammer(z.label), kategorie: z.kategorie })));
  const nachfolger = steps.map((s, i) => steps.findIndex((t, j) => j > i && vorgaengerVon(t, j, steps).includes(s.nr)));
  const istNeben = (i) => !!orte[steps[i].ort]?.neben;
  const ziel = steps.map((_, i) => {
    let j = i;
    while (j >= 0 && istNeben(j)) j = nachfolger[j]; // nachfolger zeigt immer nach rechts: endet sicher
    return j;
  });
  const neben = (i) => istNeben(i) && ziel[i] >= 0;
  const ort = (k) => ({
    key: k,
    label: orte[k]?.label ?? (k === 'gefaess' && vessel ? ohneKlammer(vessel.label) : k),
    icon: (k === 'gefaess' && orte[k]?.icon_familie?.[vessel?.familie]) || orte[k]?.icon || null,
    farbe: orte[k]?.farbe ?? 'misch',
  });

  const zeilen = [];
  const haupt = steps.map((_, i) => i).filter((i) => !neben(i));
  let hauptOrt = null;
  haupt.forEach((m, k) => {
    const gruppe = steps.map((_, i) => i).filter((i) => neben(i) && ziel[i] === m);
    gruppe.forEach((i, g) => zeilen.push({
      i, strom: 'neben', ort: ort(steps[i].ort), hauptOrt: hauptOrt && ort(hauptOrt), modus: 'auf',
      neuerOrt: g === 0 || steps[gruppe[g - 1]].ort !== steps[i].ort, nebenStart: g === 0, start: start[i], neu: neu[i],
    }));
    const s = steps[m];
    zeilen.push({
      i: m, strom: 'haupt', ort: ort(s.ort), hauptOrt: ort(s.ort), modus: neu[m].length ? 'zu' : 'auf',
      neuerOrt: s.ort !== hauptOrt, hauptStart: k === 0, hauptEnde: k === haupt.length - 1,
      zufluss: gruppe.length ? ort(steps[gruppe[gruppe.length - 1]].ort) : null, start: start[m], neu: neu[m],
    });
    hauptOrt = s.ort;
  });
  return { zeilen, gesamt: Math.max(0, ...ende), mitNeben: zeilen.some((z) => z.strom === 'neben') };
}

// Aufgeklappter Schritt (ein Schlüssel): bleibt über Neuberechnungen erhalten, solange es ihn gibt.
// undefined = noch nichts gewählt (erster Schritt offen), null = bewusst zugeklappt (reiner Ablauf).
let offen;
let letzte = null;
const QUER = '(min-width: 601px)';
const farbe = (o) => (o ? `var(--ort-${o.farbe})` : 'transparent');

// Hochkant (Handy, A3): Zeit läuft nach unten, Details klappen unter dem Schritt auf.
// Quer (ab 601 px, A2): Zeit läuft nach rechts, Details stehen unter dem ganzen Strom.
export function renderFlow(root, computed, data = {}) {
  letzte = [root, computed, data];
  const mq = globalThis.matchMedia?.(QUER);
  if (mq && !root.dataset.mq) { root.dataset.mq = '1'; mq.addEventListener('change', () => renderFlow(...letzte)); }
  const quer = mq ? mq.matches : true;
  const steps = computed.ablauf;
  const M = stromModell(steps, data.orte, computed.vessel);
  if (offen !== null && !steps.some((s) => s.key === offen)) offen = steps[0]?.key ?? null;
  const setze = (key) => { offen = key; renderFlow(...letzte); };
  const ctx = {
    computed, quer,
    namen: { ...(data.kategorien || {}), ...(data.verben || {}) },
    // Klick auf den offenen Schritt klappt zu; Hover wechselt nur, wenn schon etwas offen ist (öffnet nie von selbst wieder)
    klick: (key) => setze(key === offen ? null : key),
    hover: (key) => { if (offen != null && key !== offen) setze(key); },
  };

  root.className = `strom ${quer ? 'ist-quer' : 'ist-hoch'}${M.mitNeben ? ' mit-neben' : ''}`;
  const band = el('div', 'strom-band');
  for (const z of M.zeilen) {
    band.append(zeile(z, steps[z.i], ctx));
    if (!quer && steps[z.i].key === offen) band.append(detailZeile(z, steps[z.i], steps, ctx));
  }
  const fuss = el('div', 'strom-fuss', `Zeit ${quer ? '→' : '↓'} · gesamt ${fmtZeit(computed.zeit?.gesamt ?? M.gesamt)} · Schritt antippen für Wirkung und Risiko, nochmal antippen blendet sie aus`);
  root.replaceChildren(band, fuss);
  if (quer) {
    const z = M.zeilen.find((x) => steps[x.i].key === offen);
    if (z) root.append(karte(z, steps[z.i], steps, ctx));
  }
}

function zeile(z, s, ctx) {
  const row = el('div', `strom-zeile ist-${z.strom} modus-${z.modus}${z.zufluss ? ' ist-zufluss' : ''}`);
  row.style.setProperty('--farbe', farbe(z.ort));
  row.style.setProperty('--haupt', farbe(z.hauptOrt));
  if (z.zufluss) row.style.setProperty('--neben', farbe(z.zufluss));

  const ortZelle = el('div', 'z-ort');
  if (z.strom === 'haupt' && z.neuerOrt) ortZelle.append(ortMarke(z.ort));

  const hauptZelle = el('div', 'z-haupt');
  if (z.hauptOrt) hauptZelle.append(el('span', `bar${z.strom === 'haupt' && z.hauptStart ? ' bar-start' : ''}${z.strom === 'haupt' && z.hauptEnde ? ' bar-ende' : ''}`));
  if (z.strom === 'haupt' && z.modus === 'auf') hauptZelle.append(knopf(s, ctx));

  const nebenZelle = el('div', 'z-neben');
  if (z.strom === 'neben') nebenZelle.append(el('span', `bar bar-neben${z.nebenStart ? ' bar-start' : ''}`), knopf(s, ctx, 'klein'));
  if (z.zufluss) nebenZelle.append(el('span', 'bogen'));

  const inhalt = el('div', 'z-inhalt');
  if (z.strom === 'neben' && z.neuerOrt) inhalt.append(ortMarke(z.ort));
  const label = el('div', 'z-label');
  label.append(el('b', null, s.aktion ?? s.label));
  const m = meta(s, ctx.computed);
  if (m) label.append(el('br'), document.createTextNode(m));
  // Zufluss: Knopf steht mittig neben Zutaten + Beschriftung, damit der Pfeil auf Höhe der Strom-Mitte bleibt
  if (z.modus === 'zu') {
    const zu = el('div', 'zufluss');
    const rechts = el('div', 'zu-rechts');
    rechts.append(chips(z.neu), label);
    zu.append(el('span', 'pfeil'), knopf(s, ctx), el('span', 'linie'), rechts);
    inhalt.append(zu);
  } else {
    if (z.neu.length) inhalt.append(chips(z.neu));
    inhalt.append(label);
  }

  row.append(ortZelle, hauptZelle, nebenZelle, inhalt);
  return row;
}

// Hochkant: eigene Zeile unter dem Schritt; Haupt- und Seitenstrom laufen neben den Details weiter
function detailZeile(z, s, steps, ctx) {
  const row = el('div', 'strom-zeile ist-details');
  row.style.setProperty('--farbe', farbe(z.ort));
  row.style.setProperty('--haupt', farbe(z.hauptOrt));
  const hauptZelle = el('div', 'z-haupt');
  if (z.hauptOrt && !(z.strom === 'haupt' && z.hauptEnde)) hauptZelle.append(el('span', 'bar'));
  const nebenZelle = el('div', 'z-neben');
  if (z.strom === 'neben') nebenZelle.append(el('span', 'bar bar-neben'));
  const inhalt = el('div', 'z-inhalt');
  inhalt.append(karte(z, s, steps, ctx));
  row.append(el('div', 'z-ort'), hauptZelle, nebenZelle, inhalt);
  return row;
}

function karte(z, s, steps, ctx) {
  const k = el('div', 'strom-karte');
  k.style.setProperty('--farbe', farbe(z.ort));
  const titel = el('div', 'k-titel');
  titel.insertAdjacentHTML('beforeend', iconHtml(hauptIcon(s), 20, ctx.namen[hauptIcon(s)]?.label));
  titel.append(el('b', null, s.aktion ?? s.label), el('span', 'k-meta', [meta(s, ctx.computed), z.ort.label, z.start ? `ab ${fmtZeit(z.start)}` : 'zum Start'].filter(Boolean).join(' · ')));
  k.append(titel);
  if (z.neu.length) k.append(el('div', 'k-zutaten', z.neu.map((n) => n.label).join(', ')));
  k.append(el('div', 'k-schritt', `${s.nr}. ${s.label}${dauerText(s)}${s.eingefuegt ? ' · automatisch eingefügt' : ''}${parallelText(s, steps)}`));
  const w = el('div', 'k-wirkung');
  w.append(el('span', 'k-was', 'Wirkung '), document.createTextNode(s.wirkung ?? ''));
  k.append(w);
  if (s.risiko) {
    const r = el('div', 'k-risiko');
    r.append(el('span', 'k-was', 'Risiko '), document.createTextNode(s.risiko));
    k.append(r);
  }
  return k;
}

function knopf(s, ctx, groesse = 'gross') {
  const b = el('button', `strom-knopf ${groesse} typ-${s.typ}${s.eingefuegt ? ' is-inserted' : ''}`);
  b.type = 'button';
  b.setAttribute('aria-label', `${s.aktion ?? s.label}, Details`);
  b.setAttribute('aria-expanded', String(s.key === offen));
  b.title = s.label;
  b.insertAdjacentHTML('beforeend', iconHtml(hauptIcon(s), groesse === 'klein' ? 22 : 28));
  b.addEventListener('click', () => ctx.klick(s.key));
  if (ctx.quer) b.addEventListener('mouseenter', () => ctx.hover(s.key));
  return b;
}

function ortMarke(o) {
  const d = el('div', 'ort-marke');
  d.style.setProperty('--farbe', farbe(o));
  if (o.icon) d.insertAdjacentHTML('beforeend', iconHtml(o.icon, 26));
  d.append(el('span', null, o.label));
  return d;
}

function chips(neu) {
  const d = el('div', 'chips');
  for (const n of neu) {
    const c = el('div', 'chip');
    if (n.kategorie) c.insertAdjacentHTML('beforeend', iconHtml(n.kategorie, 26));
    c.append(el('span', null, n.label));
    d.append(c);
  }
  return d;
}

// Kurzangabe am Schritt: Dauer und Temperatur; Backen nimmt die Ofen-Temperatur aus `backen`
function meta(s, computed) {
  const temp = s.key === 'backen' && computed.backen?.tempOU ? `${computed.backen.tempOU} °C O/U` : s.temperatur && ohneKlammer(s.temperatur);
  return [s.dauer ? fmtZeit(s.dauer) : null, temp].filter(Boolean).join(' · ');
}

// Warten zeigt das Fenster (DR-024/T44), alle anderen Schritte nichts zusätzlich (Dauer steht schon in der Kopfzeile).
function dauerText(s) {
  const f = s.zeit;
  return s.typ === 'warten' && s.dauer && f ? ` · Fenster ${fmtZeit(f.min)}–${fmtZeit(f.max)}` : '';
}

// Schritte derselben Ebene hängen nicht voneinander ab (T38) — Reihenfolge frei.
function parallelText(s, steps) {
  if (s.ebene == null) return '';
  const andere = steps.filter((x) => x !== s && x.ebene === s.ebene).map((x) => `${x.nr}.`);
  return andere.length ? ` · Reihenfolge frei (parallel zu ${andere.join(', ')})` : '';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
