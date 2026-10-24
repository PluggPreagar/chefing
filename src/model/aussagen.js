// Aussagen bewerten (DR-074, T103–T108): jede Regel macht eine oder mehrere Aussagen; bewertet werden
//   Wirkung    – wie stark die Aussage wirkt (je Zielgröße, mit Vorzeichen, bezogen auf „Regel gebrochen“)
//   Gewissheit – wie sicher die Aussage gilt (never … proven)
//   Beleg      – woher das Wissen kommt (setzt die Startgewissheit, begrenzt sie nach oben)
// Die Daten liegen in data/aussagen.json, nach Regel-id (oder `wissen:<name>` für freie Aussagen ohne Regel).
// Rein, ohne DOM: Validator, Marken für die Anzeige, Prüf-Priorität, Konsistenz, Vorschläge aus Rückmeldungen.
import { MIN_BERICHT_N } from './rueckmeldung.js';

export const WIRKUNG = ['ohne_folge', 'leicht', 'spuerbar', 'ausfall'];
export const GEWISSHEIT = ['never', 'unlikely', 'maybe', 'likely', 'surely', 'proven'];
export const BELEG_ART = ['geruecht', 'konsens', 'mechanismus', 'gemessen'];
export const ZIELE = ['gelingen', 'volumen', 'stabilitaet', 'tempo', 'geschmack'];
export const RICHTUNG = ['plus', 'minus'];
export const QUELLEN_STAND = ['gelesen', 'suchtreffer'];

export const WIRKUNG_TEXT = { ohne_folge: 'ohne Folge', leicht: 'leicht', spuerbar: 'spürbar', ausfall: 'Ausfall' };
export const GEWISSHEIT_TEXT = { never: 'nie', unlikely: 'eher nein', maybe: 'vielleicht', likely: 'wahrscheinlich', surely: 'sicher', proven: 'bewiesen' };
export const BELEG_TEXT = { geruecht: 'Gerücht', konsens: 'Konsens', mechanismus: 'Mechanismus', gemessen: 'gemessen' };

const rang = (liste, wert) => liste.indexOf(wert);
const gRang = (g) => rang(GEWISSHEIT, g);

// Höchste Gewissheit, die ein Beleg allein trägt. Gerücht kann nie mehr als „vielleicht“ sein, Konsens ohne Messung nie mehr als
// „wahrscheinlich“; ohne wissenschaftlichen Nachweis ist bei „sicher“ Schluss.
export const OBERGRENZE = { geruecht: 'maybe', konsens: 'likely', mechanismus: 'surely', gemessen: 'surely' };

// Unsicherheit je Gewissheit für die Prüf-Priorität: am größten bei „vielleicht“, null bei entschieden (never/proven).
const UNSICHERHEIT = { never: 0, unlikely: 2, maybe: 3, likely: 2, surely: 1, proven: 0 };
const WIRKUNG_WERT = { ohne_folge: 0, leicht: 1, spuerbar: 2, ausfall: 3 };

// --- Wissenschaftlicher Nachweis ----------------------------------------------------------------------------------------
// `never` und `proven` sind nur mit einer begutachteten Studie erlaubt, deren Volltext gelesen wurde und die genau diese Aussage trägt.
// Eigene Versuche, Rückmeldungen, Ratgeberseiten, Foren und Such-Zusammenfassungen reichen dafür nie.
export function nachweisFehler(n) {
  if (!n || typeof n !== 'object') return ['nachweis fehlt'];
  const f = [];
  if (n.art !== 'studie') f.push('nachweis.art muss „studie“ sein — eigene Versuche und Rückmeldungen sind kein wissenschaftlicher Beleg');
  if (n.peer_reviewed !== true) f.push('nachweis.peer_reviewed muss true sein (begutachtete Veröffentlichung)');
  if (n.volltext_gelesen !== true) f.push('nachweis.volltext_gelesen muss true sein — Titel, Abstract oder Such-Zusammenfassung reichen nicht');
  if (!/^10\.\d{4,9}\/\S+$/.test(String(n.doi ?? ''))) f.push('nachweis.doi fehlt oder ist kein DOI');
  if (String(n.zitat ?? '').trim().length < 20) f.push('nachweis.zitat fehlt (Autoren, Jahr, Titel, Zeitschrift)');
  if (String(n.deckt_aussage ?? '').trim().length < 20) f.push('nachweis.deckt_aussage fehlt: warum trägt diese Studie genau diese Aussage?');
  return f;
}
export const nachweisGueltig = (n) => nachweisFehler(n).length === 0;

// --- Regel-ids aus den Daten ----------------------------------------------------------------------------------------------
// Alle Regeln, die Aussagen tragen können: Grenzen, Voraussetzungen (Operationen und Methoden), Erfahrungsregeln, Tipps.
// Rückgabe: { ids: Set, strenge: Map(id → 'hart'|'empfohlen') } — Erfahrungsregeln und Tipps haben keine strenge.
export function regelIdsAusDaten(data) {
  const ids = new Set();
  const strenge = new Map();
  const merke = (id, s) => { if (!id) return; ids.add(id); if (s && !strenge.has(id)) strenge.set(id, s); };
  for (const liste of Object.values(data.grenzen?.archetypen || {})) for (const g of liste) merke(g.id, g.strenge);
  const ausVoraussetzung = (op) => { for (const b of op?.voraussetzung || []) merke(b.id, b.strenge || 'hart'); };
  for (const op of Object.values(data.operations || {})) if (op && typeof op === 'object') ausVoraussetzung(op);
  for (const m of Object.values(data.methods || {})) for (const e of Array.isArray(m?.sequenz) ? m.sequenz : []) if (e && typeof e === 'object') ausVoraussetzung(e);
  for (const r of data.erfahrungsregeln?.regeln || []) merke(r.id);
  for (const t of data.tipps?.tipps || []) merke(t.id);
  return { ids, strenge };
}

// --- Validator ------------------------------------------------------------------------------------------------------------
export function validieren(daten, { regelIds = null } = {}) {
  const fehler = [];
  const fe = (id, msg) => fehler.push(`${id}: ${msg}`);
  const regeln = daten?.regeln;
  if (!regeln || typeof regeln !== 'object') return ['aussagen.json: Feld „regeln“ fehlt'];
  for (const [id, liste] of Object.entries(regeln)) {
    const frei = id.startsWith('wissen:');
    if (!frei && regelIds && !regelIds.has(id)) fe(id, 'keine Regel mit dieser id (weder Grenze, Voraussetzung, Erfahrungsregel noch Tipp)');
    if (!Array.isArray(liste) || !liste.length) { fe(id, 'braucht mindestens eine Aussage'); continue; }
    const gesehen = new Set();
    for (const a of liste) {
      const aid = `${id}:${a?.ziel}`;
      if (!ZIELE.includes(a?.ziel)) { fe(id, `ziel „${a?.ziel}“ unbekannt`); continue; }
      if (gesehen.has(a.ziel)) fe(aid, 'Zielgröße doppelt in dieser Regel');
      gesehen.add(a.ziel);
      if (!RICHTUNG.includes(a.richtung)) fe(aid, `richtung „${a.richtung}“ unbekannt`);
      if (!WIRKUNG.includes(a.wirkung)) fe(aid, `wirkung „${a.wirkung}“ unbekannt`);
      if (!GEWISSHEIT.includes(a.gewissheit)) fe(aid, `gewissheit „${a.gewissheit}“ unbekannt`);
      const b = a.beleg;
      if (!b || !BELEG_ART.includes(b.art)) { fe(aid, `beleg.art „${b?.art}“ unbekannt`); continue; }
      if (b.quellen != null) {
        if (!Array.isArray(b.quellen) || b.quellen.some((q) => !q || !(q.site || q.ref))) fe(aid, 'beleg.quellen: jeder Eintrag braucht site oder ref');
        for (const q of b.quellen || []) if (q?.stand != null && !QUELLEN_STAND.includes(q.stand)) fe(aid, `quelle ${q.site}: stand „${q.stand}“ unbekannt`);
      }
      if (a.schaetzung === true && String(a.begruendung ?? '').trim().length < 10) fe(aid, 'Schätzung braucht eine begruendung');
      if (frei) {
        if (String(a.text ?? '').trim().length < 10) fe(aid, 'freie Aussage braucht einen text');
        if (!Array.isArray(b.quellen) || !b.quellen.length || b.quellen.some((q) => !q.site || !QUELLEN_STAND.includes(q.stand))) fe(aid, 'freie Aussage braucht beleg.quellen mit site und stand (gelesen | suchtreffer)');
      }
      for (const s of a.siehe || []) if (!(regeln[s] || (regelIds && regelIds.has(s)))) fe(aid, `siehe „${s}“ ist keine bekannte Regel`);
      // Nachweis: nie halb ausgefüllt, nie bei den äußersten Stufen ohne volle Prüfung
      const extrem = a.gewissheit === 'never' || a.gewissheit === 'proven';
      const nachweisOk = b.nachweis != null && nachweisGueltig(b.nachweis);
      if (b.nachweis != null && !nachweisOk) for (const m of nachweisFehler(b.nachweis)) fe(aid, m);
      if (extrem) {
        if (b.art !== 'gemessen') fe(aid, `${a.gewissheit} verlangt beleg.art „gemessen“ (wissenschaftlicher Nachweis), nicht „${b.art}“`);
        if (b.nachweis == null) fe(aid, `${a.gewissheit} verlangt einen wissenschaftlichen Nachweis (beleg.nachweis: begutachtete Studie mit DOI, Volltext gelesen)`);
      }
      if (nachweisOk && b.art !== 'gemessen') fe(aid, 'ein Nachweis gehört zu beleg.art „gemessen“');
      // Obergrenze: der Beleg trägt nur so viel Gewissheit. Mit gültigem Nachweis entfällt sie; Rückmeldungen heben höchstens auf „surely“.
      const rueck = b.rueckmeldungen && b.rueckmeldungen.n >= MIN_BERICHT_N ? 'surely' : null;
      const cap = nachweisOk ? 'proven' : (rueck && gRang(rueck) > gRang(OBERGRENZE[b.art]) ? rueck : OBERGRENZE[b.art]);
      if (gRang(a.gewissheit) > gRang(cap)) fe(aid, `gewissheit ${a.gewissheit} liegt über der Obergrenze ${cap} für beleg.art „${b.art}“`);
    }
  }
  return fehler;
}

export const aussagenFuer = (regelId, daten) => daten?.regeln?.[regelId] || [];

// --- Marke für die Anzeige --------------------------------------------------------------------------------------------------
// Fasst die Aussagen mehrerer Regel-ids (eine gebündelte Meldung) zusammen: höchste Wirkung, niedrigste Gewissheit.
// Berücksichtigt nur das Gelingen (Zielgröße der Warnung); hat keine Regel eine Aussage dazu, gibt es keine Marke.
export function markeFuer(regelIds, daten) {
  const alle = (regelIds || []).flatMap((id) => aussagenFuer(id, daten).filter((a) => a.ziel === 'gelingen' && a.richtung === 'minus').map((a) => ({ id, ...a })));
  if (!alle.length) return null;
  const wirkung = alle.reduce((m, a) => (rang(WIRKUNG, a.wirkung) > rang(WIRKUNG, m) ? a.wirkung : m), alle[0].wirkung);
  const niedrigste = alle.reduce((m, a) => (gRang(a.gewissheit) < gRang(m.gewissheit) ? a : m), alle[0]);
  const schaetzung = alle.some((a) => a.schaetzung === true);
  const arten = [...new Set(alle.map((a) => BELEG_TEXT[a.beleg.art]))];
  return {
    wirkung,
    gewissheit: niedrigste.gewissheit,
    verdacht: gRang(niedrigste.gewissheit) < gRang('likely'),
    schaetzung,
    titel: `Wirkung ${WIRKUNG_TEXT[wirkung]}, Gewissheit ${GEWISSHEIT_TEXT[niedrigste.gewissheit]}. Beleg: ${arten.join(', ')}${schaetzung ? ' (Schätzung, noch nicht durch Rückmeldungen geprüft)' : ''}.${niedrigste.begruendung ? ` ${niedrigste.begruendung}` : ''}`,
    ids: alle.map((a) => `${a.id}:${a.ziel}`),
  };
}

// --- Prüf-Priorität und Konsistenz (T106) -------------------------------------------------------------------------------------
// Priorität = Wirkung × Unsicherheit: Was viel bewirkt und unsicher ist, braucht zuerst Rückmeldungen oder einen Beleg.
export function pruefPrioritaet(daten) {
  const zeilen = [];
  for (const [id, liste] of Object.entries(daten?.regeln || {})) {
    for (const a of liste) {
      zeilen.push({ id: `${id}:${a.ziel}`, wirkung: a.wirkung, gewissheit: a.gewissheit, beleg: a.beleg?.art, prioritaet: WIRKUNG_WERT[a.wirkung] * UNSICHERHEIT[a.gewissheit] });
    }
  }
  return zeilen.sort((x, y) => y.prioritaet - x.prioritaet || x.id.localeCompare(y.id));
}

// strengen: Map(regel-id → 'hart'|'empfohlen') aus regelIdsAusDaten. Befunde (keine Fehler, nur Hinweise für den Maintainer):
//   hartWirkung   – `hart`, aber keine Aussage mit Wirkung „Ausfall“ (vielleicht eher `empfohlen`)
//   hartGewissheit – `hart`, aber die sicherste Aussage liegt unter „wahrscheinlich“
//   loeschkandidaten – alle Aussagen der Regel ohne Folge
//   unbewertet    – Regel ohne jede Aussage
export function konsistenz(daten, strengen, alleIds = null) {
  const regeln = daten?.regeln || {};
  const hartWirkung = [], hartGewissheit = [], loeschkandidaten = [];
  for (const [id, liste] of Object.entries(regeln)) {
    if (strengen?.get(id) === 'hart') {
      if (!liste.some((a) => a.wirkung === 'ausfall')) hartWirkung.push({ id, wirkung: liste.map((a) => a.wirkung).join(', ') });
      const hoechste = Math.max(...liste.map((a) => gRang(a.gewissheit)));
      if (hoechste < gRang('likely')) hartGewissheit.push({ id, gewissheit: GEWISSHEIT[hoechste] });
    }
    if (liste.every((a) => a.wirkung === 'ohne_folge')) loeschkandidaten.push(id);
  }
  const unbewertet = alleIds ? [...alleIds].filter((id) => !regeln[id]).sort() : [];
  return { hartWirkung, hartGewissheit, loeschkandidaten, unbewertet };
}

// --- Rückmeldungen schärfen die Gewissheit (T107) -------------------------------------------------------------------------------
// `regelUrteile` = auswerten(...).regeln aus rueckmeldung.js. Eine Rückmeldung bewertet das Gelingen, also betrifft sie nur Aussagen
// mit Ziel „gelingen“ und Vorzeichen minus (die Warnung sagt: so misslingt es). Bestätigt → eine Stufe rauf, „zu streng?“ → eine
// Stufe runter. Rückmeldungen sind kein wissenschaftlicher Beleg: das Ergebnis bleibt zwischen „unlikely“ und „surely“, und
// Aussagen auf never/proven bleiben, wie sie sind. Nur ein Vorschlag — der Maintainer gibt frei.
export function gewissheitVorschlaege(regelUrteile, daten) {
  const vorschlaege = [];
  for (const r of regelUrteile || []) {
    const schritt = r.urteil === 'bestaetigt' ? 1 : r.urteil === 'zu streng?' ? -1 : 0;
    if (!schritt) continue;
    for (const a of aussagenFuer(r.id, daten)) {
      if (a.ziel !== 'gelingen' || a.richtung !== 'minus') continue;
      const von = gRang(a.gewissheit);
      if (von <= 0 || von >= GEWISSHEIT.length - 1) continue; // never/proven bleiben
      const nach = Math.min(gRang('surely'), Math.max(gRang('unlikely'), von + schritt));
      if (nach === von) continue;
      vorschlaege.push({
        aussage: `${r.id}:${a.ziel}`, von: a.gewissheit, nach: GEWISSHEIT[nach], n: r.n,
        grund: schritt > 0 ? `${r.n} Meldungen, die Warnung hat sich bestätigt` : `${r.n} Meldungen, es klappte trotz Warnung`,
      });
    }
  }
  return vorschlaege;
}
