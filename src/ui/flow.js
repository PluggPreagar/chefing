import { iconHtml } from './icons.js';
import { fmtZeit, planeAblauf } from '../model/zeit.js';

// verb=mischen wird je nach Intensität als anderes Icon dargestellt
// (passiv=Einlegen/Ruhen, sanft=Mischen-S, kraeftig=Schlagen), statt drei
// eigene Verben zu pflegen.
const MISCHEN_ICON = { passiv: 'vorbereiten', sanft: 'mischen', kraeftig: 'schlagen' };
const verbIcon = (s) => (s.verb === 'mischen' ? (MISCHEN_ICON[s.intensitaet] ?? 'mischen') : s.verb);

// Wirkzeit (DR-024/T44, DR-043) zeigt eine Uhr der nächstliegenden Dauer-Stufe.
const DAUER_STUFEN = [5, 10, 15, 30, 45, 60];
const dauerIconKey = (min) => `dauer_${DAUER_STUFEN.reduce((a, m) => (Math.abs(m - min) < Math.abs(a - min) ? m : a), DAUER_STUFEN[0])}`;

const vorgaengerVon = (s, i, steps) => s.nach ?? (i > 0 ? [steps[i - 1].nr] : []);
const ohneKlammer = (t) => String(t).replace(/\s*\(.*?\)/g, '').trim();
const LANE = 36; // Breite einer Seitenstrom-Spur in px (CSS --lane)

// Kurze Zeitangabe für die Zeilen: −19′, 0′, 73′, 2 h 5′
export function fmtSlot(min) {
  const m = Math.round(min);
  const a = Math.abs(m);
  const t = a < 100 ? `${a}′` : `${Math.floor(a / 60)} h${a % 60 ? ` ${a % 60}′` : ''}`;
  return m < 0 ? `−${t}` : t;
}

// Strom + Zufluss in Slots (DR-039, DR-043, Regeln R1–R7):
// R1 je Zeile genau eine Aktion des Kochs (Knopf) oder keine (leer: nur Wirkzeit, Uhr).
// R2 Schritt = Handzeit + Wirkzeit, R3 Knopf nur bei Handzeit, R4 gestrichelt = die Masse wird gerade nicht bearbeitet,
// R5 leere Zeilen für Wartezeiten, R6 Reihenfolge und Vorlauf aus dem Planer (zeit.js), R7 Farbe = Behälter, Dicke = Menge.
// Hauptstrom = Weg des Teigs; Schritte an Nebenplätzen (orte.json `neben`) bilden Seitenstränge, die in ihren Zielschritt
// münden; ein zweiter Abfluss (Ei trennen → Eiweiß) beginnt den späteren Strang schon an seiner Quelle.
export function stromModell(steps, orte = {}, vessel = null) {
  const plan = planeAblauf(steps);
  const gesehen = new Set();
  const neu = steps.map((s) => (s.zutaten || []).filter((z) => !gesehen.has(z.rolle) && gesehen.add(z.rolle))
    .map((z) => ({ label: ohneKlammer(z.label), kategorie: z.kategorie, icon: z.icon ?? z.kategorie, teil: !!z.teil, gramm: z.gramm ?? 0, geteilt: !!z.geteilt })));
  const alleNachfolger = steps.map((s, i) => steps.map((t, j) => j).filter((j) => j > i && vorgaengerVon(steps[j], j, steps).includes(s.nr)));
  const istNeben = (i) => !!orte[steps[i].ort]?.neben;
  const ziel = steps.map((_, i) => {
    let j = i;
    while (j >= 0 && istNeben(j)) j = alleNachfolger[j][0] ?? -1; // Nachfolger liegen immer weiter hinten: endet sicher
    return j;
  });
  const neben = (i) => istNeben(i) && ziel[i] >= 0;
  const ort = (k) => ({
    key: k,
    label: orte[k]?.label ?? (k === 'gefaess' && vessel ? ohneKlammer(vessel.label) : k),
    icon: (k === 'gefaess' && orte[k]?.icon_familie?.[vessel?.familie]) || orte[k]?.icon || null,
    farbe: orte[k]?.farbe ?? 'misch',
  });

  // Zeilen in Zeitfolge: Aktionen (Handzeit > 0) und leere Slots dazwischen; Vorlauf vor der Startlinie
  const A = steps.map((s) => s.aktiv ?? (s.typ === 'warten' ? 0 : s.dauer ?? 0));
  const aktionen = steps.map((_, i) => i).filter((i) => A[i] > 0).sort((a, b) => plan.start[a] - plan.start[b] || a - b);
  const zeilen = [];
  let t = 0;
  const leerBis = (bis) => {
    if (bis - t < 0.5) return;
    const warten = steps.map((_, i) => i).filter((i) => plan.fertig[i] > t + 0.01 && plan.aktivEnde[i] < bis - 0.01 && plan.fertig[i] > plan.aktivEnde[i]);
    const grund = warten.filter((i) => Math.abs(plan.fertig[i] - bis) < 0.5);
    zeilen.push({ art: 'leer', t0: t, t1: bis, warten, grund: grund.length ? grund : warten.slice(-1) });
  };
  let startGesetzt = false;
  for (const i of aktionen) {
    if (plan.start[i] >= 0 && !startGesetzt) { if (zeilen.length) zeilen.push({ art: 'start', t0: 0 }); startGesetzt = true; t = Math.max(t, 0); }
    if (plan.start[i] >= 0) leerBis(plan.start[i]);
    zeilen.push({ art: 'aktion', i, t0: plan.start[i] });
    t = Math.max(t, plan.aktivEnde[i]);
  }
  if (!startGesetzt && zeilen.length) zeilen.push({ art: 'start', t0: 0 });
  leerBis(plan.gesamt);
  // Eine reine Wartezeit, die nie einen leeren Slot füllt (der Koch arbeitet nebenher), bekommt eine eigene Uhr-Zeile
  for (const i of steps.map((_, k) => k).filter((k) => A[k] === 0 && plan.fertig[k] > plan.start[k])) {
    if (zeilen.some((z) => z.art === 'leer' && z.warten.includes(i))) continue;
    const pos = zeilen.findIndex((z) => z.art !== 'start' && z.t0 > plan.start[i]);
    const z = { art: 'leer', t0: plan.start[i], t1: plan.fertig[i], warten: [i], grund: [i], nebenher: true };
    if (pos < 0) zeilen.push(z); else zeilen.splice(pos, 0, z);
  }
  const zeileVonAktion = (i) => zeilen.findIndex((z) => z.art === 'aktion' && z.i === i);
  // Reine Wartezeiten liegen in ihrer Uhr-Zeile
  const zeileVon = (i) => (A[i] > 0 ? zeileVonAktion(i) : zeilen.findIndex((z) => z.art === 'leer' && z.warten.includes(i)));

  // Seitenstränge: Nebenschritte mit demselben Ziel; Quelle = Nebenschritt eines anderen Strangs mit zweitem Abfluss hierher
  const straenge = [];
  for (const i of steps.map((_, k) => k).filter(neben)) {
    let st = straenge.find((x) => x.ziel === ziel[i]);
    if (!st) straenge.push(st = { ziel: ziel[i], schritte: [], quelle: null });
    st.schritte.push(i);
  }
  for (const st of straenge) {
    for (const q of steps.map((_, k) => k).filter(neben)) {
      if (st.schritte.includes(q)) continue;
      if (alleNachfolger[q].slice(1).some((j) => st.schritte.includes(j))) st.quelle = q;
    }
    st.von = Math.min(...st.schritte.map(zeileVon), ...(st.quelle != null ? [zeileVon(st.quelle)] : []));
    st.bis = zeileVonAktion(st.ziel);
    st.ort = ort(steps[st.schritte[0]].ort);
    st.masse = st.schritte.reduce((a, i) => a + neu[i].reduce((b, n) => b + n.gramm, 0), 0);
    st.einfluss = st.schritte.reduce((a, i) => a + neu[i].filter((n) => !n.geteilt).reduce((b, n) => b + n.gramm, 0), 0);
  }
  // Spuren vergeben (Intervalle über Zeilen, erste freie Spur)
  const belegt = [];
  for (const st of [...straenge].sort((a, b) => a.von - b.von)) {
    let k = 0;
    while ((belegt[k] || []).some(([v, b]) => !(st.bis < v || st.von > b))) k++;
    (belegt[k] ||= []).push([st.von, st.bis]);
    st.spur = k + 1;
  }
  const spuren = Math.max(0, ...straenge.map((s) => s.spur));

  // Hauptstrom: Behälter, Bearbeitung und Masse je Zeile
  const hauptAktion = (z) => z.art === 'aktion' && !neben(z.i);
  const ersteHaupt = zeilen.findIndex(hauptAktion);
  let hauptOrt = null;
  let masse = 0;
  const strangNachZiel = new Map(straenge.map((s) => [s.ziel, s]));
  zeilen.forEach((z, k) => {
    if (z.art === 'aktion') {
      if (!neben(z.i)) {
        hauptOrt = steps[z.i].ort;
        masse += neu[z.i].filter((n) => !n.geteilt).reduce((b, n) => b + n.gramm, 0) + (strangNachZiel.get(z.i)?.einfluss ?? 0);
      }
      z.strom = neben(z.i) ? 'neben' : 'haupt';
      z.ort = ort(steps[z.i].ort);
      z.neu = neu[z.i];
      z.modus = z.strom === 'haupt' && neu[z.i].length ? 'zu' : 'auf';
      z.strang = z.strom === 'neben' ? straenge.find((s) => s.schritte.includes(z.i)) : null;
      z.zufluss = strangNachZiel.get(z.i) ?? null;
    } else if (z.art === 'leer') {
      const g = z.grund.find((i) => !neben(i));
      if (g != null) hauptOrt = steps[g].ort; // Wartezeit im neuen Behälter (Gare auf dem Blech, Ofen)
    }
    z.haupt = ersteHaupt >= 0 && k >= ersteHaupt && hauptOrt ? { ort: ort(hauptOrt), aktiv: hauptAktion(z), start: k === ersteHaupt, masse } : null;
    z.spuren = straenge.filter((s) => k >= s.von && k <= s.bis).map((s) => ({
      spur: s.spur, ort: s.ort, masse: s.masse, start: k === s.von, mündet: k === s.bis,
      aktiv: z.art === 'aktion' && s.schritte.includes(z.i),
      quelle: s.quelle != null && k === s.von && zeileVon(s.quelle) === k ? straenge.find((x) => x.schritte.includes(s.quelle))?.spur ?? null : null,
    }));
    z.uhren = z.art === 'leer' ? z.warten.map((i) => ({ i, spur: neben(i) ? straenge.find((s) => s.schritte.includes(i))?.spur ?? null : 0 })) : [];
  });
  const letzteHaupt = zeilen.map((z, k) => (z.haupt ? k : -1)).filter((k) => k >= 0).pop();
  if (letzteHaupt != null) zeilen[letzteHaupt].haupt.ende = true;
  const maxMasse = Math.max(1, masse, ...straenge.map((s) => s.masse));
  const dicke = (m) => Math.round(Math.max(2, Math.min(12, 2 + (10 * m) / maxMasse)) * 2) / 2;
  for (const z of zeilen) {
    if (z.haupt) z.haupt.dicke = dicke(z.haupt.masse);
    for (const sp of z.spuren) sp.dicke = dicke(sp.masse);
  }
  zeilen.forEach((z, k) => { z.id = z.art === 'aktion' ? `a:${steps[z.i].key}` : `${z.art}:${k}`; });
  return { zeilen, spuren, gesamt: plan.gesamt, vorlauf: -plan.vorlauf, aktiv: A.reduce((a, b) => a + b, 0), plan, ort };
}

// Aufgeklappte Zeile und ihr Schritt: bleibt über Neuberechnungen erhalten, solange es sie gibt.
// undefined = noch nichts gewählt (erste Aktion offen), null = bewusst zugeklappt (reiner Ablauf).
let offen;
let letzte = null;
const QUER = '(min-width: 601px)';
const farbe = (o) => (o ? `var(--ort-${o.farbe})` : 'transparent');

// Hochkant (Handy, A3): Zeit läuft nach unten, Details klappen unter der Zeile auf.
// Quer (ab 601 px, A2): Zeit läuft nach rechts, Details stehen unter dem Strom.
export function renderFlow(root, computed, data = {}) {
  letzte = [root, computed, data];
  const mq = globalThis.matchMedia?.(QUER);
  if (mq && !root.dataset.mq) { root.dataset.mq = '1'; mq.addEventListener('change', () => renderFlow(...letzte)); }
  const quer = mq ? mq.matches : true;
  const steps = computed.ablauf;
  const M = stromModell(steps, data.orte, computed.vessel);
  const mitKnopf = (z) => z.art === 'aktion' || (z.art === 'leer' && z.uhren.length);
  // Schlüssel statt Index: nach einer Neuberechnung (z. B. Einlage dazu) verschieben sich die Indizes
  if (offen && (!steps.some((s) => s.key === offen.key) || !M.zeilen.some((z) => z.id === offen.zeile))) offen = undefined;
  if (offen === undefined) {
    const z = M.zeilen.find(mitKnopf);
    offen = z ? { zeile: z.id, key: steps[z.art === 'aktion' ? z.i : z.uhren[0].i].key } : null;
  }
  const setze = (o) => { offen = o; renderFlow(...letzte); };
  const istOffen = (z, i) => offen?.zeile === z.id && offen?.key === steps[i]?.key;
  const ctx = {
    computed, quer, M, steps, spuren: M.spuren,
    namen: { ...(data.kategorien || {}), ...(data.verben || {}) },
    istOffen,
    // Klick auf das Offene klappt zu; Hover wechselt nur, wenn schon etwas offen ist (öffnet nie von selbst wieder)
    klick: (z, i) => setze(istOffen(z, i) ? null : { zeile: z.id, key: steps[i].key }),
    hover: (z, i) => { if (offen != null && !istOffen(z, i)) setze({ zeile: z.id, key: steps[i].key }); },
  };

  root.className = `strom ${quer ? 'ist-quer' : 'ist-hoch'}`;
  const n = M.spuren;
  root.style.setProperty('--neben-b', `${n * LANE}px`);
  root.style.setProperty('--raster', quer ? `minmax(120px, auto) ${'36px '.repeat(n)}52px 60px` : `52px 48px ${'36px '.repeat(n)}minmax(0, 1fr)`);
  const band = el('div', 'strom-band');
  M.zeilen.forEach((z) => {
    band.append(zeile(z, ctx));
    if (!quer && offen?.zeile === z.id) band.append(detailZeile(z, steps.find((s) => s.key === offen.key), ctx));
  });
  const vorlaufText = M.vorlauf > 0 ? ` · Vorlauf ${fmtZeit(M.vorlauf)} (${M.zeilen.filter((z) => z.art === 'aktion' && z.t0 < 0).map((z) => steps[z.i].handgriff ?? steps[z.i].aktion).join(', ')})` : '';
  const fuss = el('div', 'strom-fuss', `Zeit ${quer ? '→' : '↓'} · fertig nach ${fmtZeit(M.gesamt)} ab Start · Hände ${fmtZeit(M.aktiv)}${vorlaufText} · Schritt oder Uhr antippen für Wirkung und Risiko, nochmal antippen blendet sie aus`);
  root.replaceChildren(band, fuss);
  if (quer && offen) {
    const z = M.zeilen.find((x) => x.id === offen.zeile);
    if (z) root.append(karte(z, steps.find((s) => s.key === offen.key), ctx));
  }
}

// Zellen eines Slots per Raster platzieren: hochkant als Spalten, quer als Zeilen (Spur 1 am Hauptstrom)
function platz(zelle, art, spur, ctx) {
  const n = ctx.spuren;
  if (ctx.quer) {
    zelle.style.gridColumn = '1';
    zelle.style.gridRow = String({ inhalt: 1, spur: n - spur + 2, haupt: n + 2, ort: n + 3 }[art]);
  } else {
    zelle.style.gridRow = '1';
    zelle.style.gridColumn = String({ ort: 1, haupt: 2, spur: 2 + spur, inhalt: 3 + n }[art]);
  }
  return zelle;
}

function zeile(z, ctx) {
  const { steps } = ctx;
  if (z.art === 'start') {
    const r = el('div', 'strom-start');
    r.append(el('span', null, 'Start'));
    return r;
  }
  const s = z.art === 'aktion' ? steps[z.i] : null;
  const row = el('div', `strom-zeile ist-${z.art}${z.strom ? ` ist-${z.strom}` : ''}${z.modus ? ` modus-${z.modus}` : ''}${z.t0 < 0 ? ' ist-vorlauf' : ''}`);
  row.style.setProperty('--farbe', farbe(z.ort ?? z.haupt?.ort));

  const ortZelle = platz(el('div', 'z-ort'), 'ort', 0, ctx);
  ortZelle.append(el('span', 'z-zeit', fmtSlot(z.t0)));
  const wechsel = z.art === 'aktion' && z.strom === 'haupt' && z.haupt && (z.haupt.start || ortWechsel(z, ctx));
  if (wechsel) ortZelle.append(ortMarke(z.ort));
  if (z.art === 'leer' && z.haupt && ortWechsel(z, ctx)) ortZelle.append(ortMarke(z.haupt.ort));

  const hauptZelle = platz(el('div', 'z-haupt'), 'haupt', 0, ctx);
  if (z.haupt) hauptZelle.style.setProperty('--farbe', farbe(z.haupt.ort));
  if (z.haupt) hauptZelle.append(balken(z.haupt, `${z.haupt.aktiv ? '' : ' ist-wartend'}${z.haupt.start ? ' bar-start' : ''}${z.haupt.ende && z.art === 'aktion' && z.modus === 'auf' ? ' bar-ende' : ''}`));
  if (z.art === 'aktion' && z.strom === 'haupt' && z.modus === 'auf') hauptZelle.append(knopf(z, s, ctx));
  for (const u of z.uhren.filter((x) => x.spur === 0)) hauptZelle.append(uhr(z, u.i, ctx));
  const zellen = [ortZelle, hauptZelle];

  for (let k = 1; k <= ctx.spuren; k++) {
    const zelle = platz(el('div', 'z-spur'), 'spur', k, ctx);
    const sp = z.spuren.find((x) => x.spur === k);
    if (sp) {
      zelle.style.setProperty('--farbe', farbe(sp.ort));
      zelle.append(balken(sp, ` bar-neben${sp.aktiv ? '' : ' ist-wartend'}${sp.start ? ' bar-start' : ''}${sp.mündet ? ' bar-ende' : ''}`));
      if (sp.mündet) zelle.append(bogen(sp, k, ctx));
      if (z.art === 'aktion' && z.strang?.spur === k) zelle.append(knopf(z, s, ctx, 'klein'));
      for (const u of z.uhren.filter((x) => x.spur === k)) zelle.append(uhr(z, u.i, ctx, 'klein'));
    }
    // zweiter Abfluss: Verbindung von der Quell-Spur in diesen Strang
    for (const ziel of z.spuren.filter((x) => x.quelle === k)) zelle.append(abzweig(k, ziel.spur, ziel, ctx));
    zellen.push(zelle);
  }

  const inhalt = platz(el('div', 'z-inhalt'), 'inhalt', 0, ctx);
  const label = el('div', 'z-label');
  if (z.art === 'aktion') {
    label.append(el('b', null, s.passiv ? s.handgriff ?? s.aktion : s.aktion ?? s.label));
    const m = meta(s, ctx.computed);
    if (m) label.append(el('br'), document.createTextNode(m));
    if (z.strom === 'neben' && z.strang?.schritte[0] === z.i) inhalt.append(ortMarke(z.ort));
    if (z.modus === 'zu') {
      const zu = el('div', 'zufluss');
      const rechts = el('div', 'zu-rechts');
      rechts.append(chips(z.neu), label);
      zu.append(el('span', 'pfeil'), knopf(z, s, ctx), el('span', 'linie'), rechts);
      inhalt.append(zu);
    } else {
      if (z.neu.length) inhalt.append(chips(z.neu));
      inhalt.append(label);
    }
  } else {
    label.append(el('b', null, z.nebenher ? 'nebenher' : `leer · ${fmtZeit(z.t1 - z.t0)} warten`));
    const namen = z.grund.map((i) => [steps[i].aktion, warteMeta(steps[i], ctx.computed)].filter(Boolean).join(' · '));
    label.append(el('br'), document.createTextNode(namen.join(', ')));
    inhalt.append(label);
  }
  zellen.push(inhalt);
  row.append(...zellen);
  return row;
}

// Wechselt der Behälter des Hauptstroms in dieser Zeile?
function ortWechsel(z, ctx) {
  const k = ctx.M.zeilen.indexOf(z);
  const vorher = ctx.M.zeilen.slice(0, k).reverse().find((x) => x.haupt);
  return !vorher || vorher.haupt.ort.key !== z.haupt.ort.key;
}

// Hochkant: eigene Zeile unter der Zeile; Haupt- und Seitenströme laufen neben den Details weiter
function detailZeile(z, s, ctx) {
  const row = el('div', 'strom-zeile ist-details');
  row.style.setProperty('--farbe', farbe(z.ort ?? z.haupt?.ort));
  const zellen = [platz(el('div', 'z-ort'), 'ort', 0, ctx)];
  const hauptZelle = platz(el('div', 'z-haupt'), 'haupt', 0, ctx);
  if (z.haupt && !z.haupt.ende) hauptZelle.append(balken(z.haupt, z.haupt.aktiv ? '' : ' ist-wartend'));
  zellen.push(hauptZelle);
  for (let k = 1; k <= ctx.spuren; k++) {
    const zelle = platz(el('div', 'z-spur'), 'spur', k, ctx);
    const sp = z.spuren.find((x) => x.spur === k && !x.mündet);
    if (sp) { zelle.style.setProperty('--farbe', farbe(sp.ort)); zelle.append(balken(sp, ` bar-neben${sp.aktiv ? '' : ' ist-wartend'}`)); }
    zellen.push(zelle);
  }
  const inhalt = platz(el('div', 'z-inhalt'), 'inhalt', 0, ctx);
  inhalt.append(karte(z, s, ctx));
  zellen.push(inhalt);
  row.append(...zellen);
  return row;
}

function karte(z, s, ctx) {
  const { steps, M } = ctx;
  const i = steps.indexOf(s);
  const ortInfo = M.ort(s.ort);
  const k = el('div', 'strom-karte');
  k.style.setProperty('--farbe', farbe(ortInfo));
  const titel = el('div', 'k-titel');
  const icon = z.art === 'aktion' && z.i === i ? verbIcon(s) : dauerIconKey(s.wirk ?? s.dauer ?? 0);
  titel.insertAdjacentHTML('beforeend', iconHtml(icon, 20, ctx.namen[icon]?.label));
  const start = M.plan.start[i];
  titel.append(el('b', null, s.aktion ?? s.label), el('span', 'k-meta', [meta(s, ctx.computed), ortInfo.label, start < 0 ? `${fmtZeit(-start)} vor dem Start` : start ? `ab ${fmtZeit(start)}` : 'zum Start'].filter(Boolean).join(' · ')));
  k.append(titel);
  const n = z.art === 'aktion' ? z.neu : [];
  if (n.length) k.append(el('div', 'k-zutaten', n.map((x) => x.label).join(', ')));
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

function knopf(z, s, ctx, groesse = 'gross') {
  const i = ctx.steps.indexOf(s);
  const b = el('button', `strom-knopf ${groesse}${s.eingefuegt ? ' is-inserted' : ''}`);
  b.type = 'button';
  b.setAttribute('aria-label', `${s.passiv ? s.handgriff ?? s.aktion : s.aktion ?? s.label}, Details`);
  b.setAttribute('aria-expanded', String(ctx.istOffen(z, i)));
  b.title = s.label;
  b.insertAdjacentHTML('beforeend', iconHtml(verbIcon(s), groesse === 'klein' ? 22 : 28));
  b.addEventListener('click', () => ctx.klick(z, i));
  if (ctx.quer) b.addEventListener('mouseenter', () => ctx.hover(z, i));
  return b;
}

// Uhr auf einer gestrichelten Wirkzeit (R4/R5): antippbar wie ein Knopf, zeigt die Details des wartenden Schritts
function uhr(z, i, ctx, groesse = '') {
  const s = ctx.steps[i];
  const b = el('button', `strom-uhr ${groesse}`);
  b.type = 'button';
  b.setAttribute('aria-label', `${s.aktion ?? s.label} (${fmtZeit(s.wirk ?? s.dauer ?? 0)}), Details`);
  b.setAttribute('aria-expanded', String(ctx.istOffen(z, i)));
  b.title = s.label;
  b.insertAdjacentHTML('beforeend', iconHtml(dauerIconKey(s.wirk ?? s.dauer ?? 0), groesse === 'klein' ? 18 : 22));
  b.addEventListener('click', () => ctx.klick(z, i));
  if (ctx.quer) b.addEventListener('mouseenter', () => ctx.hover(z, i));
  return b;
}

function balken(x, cls) {
  const b = el('span', `bar${cls}`);
  b.style.setProperty('--dicke', `${x.dicke ?? 8}px`);
  b.style.setProperty('--c', farbe(x.ort));
  return b;
}

// Strang mündet: von der Spur in den Hauptstrom (hochkant nach links, quer nach unten), über die Spuren dazwischen
function bogen(sp, k, ctx) {
  const b = el('span', 'bogen');
  b.style.setProperty('--weg', `${(k - 1) * LANE}px`);
  b.style.setProperty('--dicke', `${sp.dicke}px`);
  b.style.setProperty('--c', farbe(sp.ort));
  return b;
}

// Zweiter Abfluss: Querverbindung von Spur `von` zur Spur `zu` in der Zeile der Quelle
function abzweig(von, zu, sp, ctx) {
  const a = el('span', `abzweig${zu > von ? '' : ' nach-innen'}`);
  a.style.setProperty('--weg', `${Math.abs(zu - von) * LANE}px`);
  a.style.setProperty('--dicke', `${sp.dicke}px`);
  a.style.setProperty('--ziel', farbe(sp.ort));
  return a;
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
    if (n.icon) c.insertAdjacentHTML('beforeend', iconHtml(n.icon, 26));
    c.append(el('span', null, n.label));
    d.append(c);
  }
  return d;
}

const tempVon = (s, computed) => (s.key === 'backen' && computed.backen?.tempOU ? `${computed.backen.tempOU} °C O/U` : s.temperatur && ohneKlammer(s.temperatur));

// Kurzangabe an der Aktion: Handzeit (bei passiven Schritten: Handgriff, dann Wirkzeit) und Temperatur
function meta(s, computed) {
  if (s.passiv) return [s.aktiv ? fmtZeit(s.aktiv) : null, s.wirk ? `dann ${fmtZeit(s.wirk)} ${s.key === 'backen' ? 'im Ofen' : 'warten'}` : null, tempVon(s, computed)].filter(Boolean).join(' · ');
  return [s.dauer ? fmtZeit(s.dauer) : null, tempVon(s, computed)].filter(Boolean).join(' · ');
}
const warteMeta = (s, computed) => tempVon(s, computed) || null;

// Warten zeigt das Fenster (DR-024/T44)
function dauerText(s) {
  const f = s.zeit;
  return s.passiv && s.wirk && f ? ` · Fenster ${fmtZeit(f.min)}–${fmtZeit(f.max)}` : '';
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
