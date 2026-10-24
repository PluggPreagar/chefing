// Aussagen bewerten (DR-074, T103–T108): jede Regel macht eine oder mehrere Aussagen; bewertet werden
//   Wirkung    – wie stark die Aussage wirkt (je Zielgröße, mit Vorzeichen, bezogen auf „Regel gebrochen“)
//   Gewissheit – wie sicher die Aussage gilt (never … proven)
//   Beleg      – woher das Wissen kommt (setzt die Startgewissheit, begrenzt sie nach oben)
// Die Daten liegen in data/aussagen.json, nach Regel-id (oder `wissen:<name>` für freie Aussagen ohne Regel).
// Rein, ohne DOM: Validator, Marken für die Anzeige, Prüf-Priorität, Konsistenz, Vorschläge aus Rückmeldungen.
import { MIN_BERICHT_N } from './rueckmeldung.js';
import { GROESSEN } from './bilanz.js';

export const WIRKUNG = ['ohne_folge', 'leicht', 'spuerbar', 'ausfall'];
export const GEWISSHEIT = ['never', 'unlikely', 'maybe', 'likely', 'surely', 'proven'];
export const BELEG_ART = ['geruecht', 'konsens', 'mechanismus', 'gemessen'];
export const ZIELE = ['gelingen', 'volumen', 'stabilitaet', 'tempo', 'geschmack'];
export const RICHTUNG = ['plus', 'minus'];
export const QUELLEN_STAND = ['gelesen', 'suchtreffer'];

export const WIRKUNG_TEXT = { ohne_folge: 'ohne Folge', leicht: 'leicht', spuerbar: 'spürbar', ausfall: 'Ausfall' };
export const GEWISSHEIT_TEXT = { never: 'nie', unlikely: 'eher nein', maybe: 'vielleicht', likely: 'wahrscheinlich', surely: 'sicher', proven: 'bewiesen' };
export const BELEG_TEXT = { geruecht: 'Gerücht', konsens: 'Konsens', mechanismus: 'Mechanismus', gemessen: 'gemessen' };
export const ZIEL_TEXT = { gelingen: 'Gelingen', volumen: 'Volumen', stabilitaet: 'Stabilität', tempo: 'Tempo', geschmack: 'Geschmack' };

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
// Rückgabe: { ids: Set, strenge: Map(id → 'hart'|'empfohlen'), mitVorbereitung: Set } — Erfahrungsregeln und Tipps haben keine strenge;
// mitVorbereitung = Voraussetzungen, deren Schritt eine Vorbereitung ergänzt (`vorbereitung_falls_nicht`): „hart“ heißt dort Pflicht mit Hilfe.
export function regelIdsAusDaten(data) {
  const ids = new Set();
  const strenge = new Map();
  const mitVorbereitung = new Set();
  const logisch = new Set();
  const merke = (id, s) => { if (!id) return; ids.add(id); if (s && !strenge.has(id)) strenge.set(id, s); };
  for (const liste of Object.values(data.grenzen?.archetypen || {})) for (const g of liste) merke(g.id, g.strenge);
  const ausVoraussetzung = (op) => {
    for (const b of op?.voraussetzung || []) {
      merke(b.id, b.strenge || 'hart');
      if (b.id && op.vorbereitung_falls_nicht) mitVorbereitung.add(b.id);
      if (b.id && op.zustand) logisch.add(b.id); // Schritt stellt einen Soll-Zustand her (DR-064): die Voraussetzung sagt nur, ob das geht
    }
  };
  for (const op of Object.values(data.operations || {})) if (op && typeof op === 'object') ausVoraussetzung(op);
  for (const m of Object.values(data.methods || {})) for (const e of Array.isArray(m?.sequenz) ? m.sequenz : []) if (e && typeof e === 'object') ausVoraussetzung(e);
  for (const r of data.erfahrungsregeln?.regeln || []) merke(r.id);
  for (const t of data.tipps?.tipps || []) merke(t.id);
  // Meldungsquellen der Engine mit eigenen ids (T109): Korpus-Toleranz je Bilanz-Größe, haltbare Triebquellen, Zeit-Fenster der
  // Operationen, Emulsions-Schritte, Gärmodell, Archetyp-Hinweise. Nicht erfasst (keine Vorhersage): technik:, prep:, basis:, ausstattung:.
  for (const g of Object.keys(GROESSEN)) merke(`toleranz:${g}`);
  for (const [k, q] of Object.entries(data.triebquellen || {})) if (!k.startsWith('_') && typeof q?.haelt_min === 'number') merke(`trieb:${k}`);
  for (const [k, op] of Object.entries(data.operations || {})) if (!k.startsWith('_') && op?.zeit) merke(`zeit:${k}`);
  for (const [k, op] of Object.entries(data.operations || {})) if (!k.startsWith('_') && op?.emulsion) merke(`emulsion:${k}`);
  for (const m of Object.values(data.methods || {})) for (const e of Array.isArray(m?.sequenz) ? m.sequenz : []) if (e && typeof e === 'object' && e.emulsion && e.key) merke(`emulsion:${e.key}`);
  if (data.modelle?.gaerung) merke('gaerung_modell');
  for (const a of Object.values(data.archetypes || {})) for (const h of a?.hinweise || []) if (h?.id && typeof a === 'object') merke(`archetyp:${h.id}`);
  return { ids, strenge, mitVorbereitung, logisch };
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
// Berücksichtigt die Aussagen, die einen Schaden beschreiben (Richtung minus), das ist der Inhalt einer Warnung; hat keine Regel
// eine solche Aussage, gibt es keine Marke. `ziel` nennt die Zielgröße der stärksten Aussage (Gelingen, Volumen, Tempo …).
export function markeFuer(regelIds, daten) {
  const alle = (regelIds || []).flatMap((id) => aussagenFuer(id, daten).filter((a) => a.richtung === 'minus').map((a) => ({ id, ...a })));
  if (!alle.length) return null;
  const staerkste = alle.reduce((m, a) => (rang(WIRKUNG, a.wirkung) > rang(WIRKUNG, m.wirkung) ? a : m), alle[0]);
  const wirkung = staerkste.wirkung;
  const niedrigste = alle.reduce((m, a) => (gRang(a.gewissheit) < gRang(m.gewissheit) ? a : m), alle[0]);
  const schaetzung = alle.some((a) => a.schaetzung === true);
  const arten = [...new Set(alle.map((a) => BELEG_TEXT[a.beleg.art]))];
  return {
    ziel: staerkste.ziel,
    wirkung,
    gewissheit: niedrigste.gewissheit,
    verdacht: gRang(niedrigste.gewissheit) < gRang('likely'),
    schaetzung,
    titel: `Wirkung ${WIRKUNG_TEXT[wirkung]}${staerkste.ziel !== 'gelingen' ? ` auf ${ZIEL_TEXT[staerkste.ziel]}` : ''}, Gewissheit ${GEWISSHEIT_TEXT[niedrigste.gewissheit]}. Beleg: ${arten.join(', ')}${schaetzung ? ' (Schätzung, noch nicht durch Rückmeldungen geprüft)' : ''}.${niedrigste.begruendung ? ` ${niedrigste.begruendung}` : ''}`,
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

// strengen, mitVorbereitung: aus regelIdsAusDaten. Befunde (keine Fehler, nur Hinweise für den Maintainer):
//   hartWirkung   – `hart`, aber keine Aussage mit Wirkung „Ausfall“ (vielleicht eher `empfohlen`); ausgenommen Regeln, deren Schritt
//                   eine Vorbereitung ergänzt (`hartMitHilfe`): dort blockiert `hart` nicht, die App schiebt den Schritt ein; und
//                   Voraussetzungen von Schritten, die einen Soll-Zustand herstellen (`hartLogisch`): sie sagen nur, ob der Schritt geht
//   hartGewissheit – `hart`, aber die sicherste Aussage liegt unter „wahrscheinlich“
//   loeschkandidaten – alle Aussagen der Regel ohne Folge
//   unbewertet    – Regel ohne jede Aussage
export function konsistenz(daten, strengen, alleIds = null, mitVorbereitung = new Set(), logisch = new Set()) {
  const regeln = daten?.regeln || {};
  const hartWirkung = [], hartMitHilfe = [], hartLogisch = [], hartGewissheit = [], loeschkandidaten = [];
  for (const [id, liste] of Object.entries(regeln)) {
    if (strengen?.get(id) === 'hart') {
      if (!liste.some((a) => a.wirkung === 'ausfall')) (mitVorbereitung.has(id) ? hartMitHilfe : logisch.has(id) ? hartLogisch : hartWirkung).push({ id, wirkung: liste.map((a) => a.wirkung).join(', ') });
      const hoechste = Math.max(...liste.map((a) => gRang(a.gewissheit)));
      if (hoechste < gRang('likely')) hartGewissheit.push({ id, gewissheit: GEWISSHEIT[hoechste] });
    }
    if (liste.every((a) => a.wirkung === 'ohne_folge')) loeschkandidaten.push(id);
  }
  const unbewertet = alleIds ? [...alleIds].filter((id) => !regeln[id]).sort() : [];
  return { hartWirkung, hartMitHilfe, hartLogisch, hartGewissheit, loeschkandidaten, unbewertet };
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

// --- Hinweise mit Sternen und Nutzerstufe (DR-075, T112–T114) ----------------------------------------------------------------
// Ein Hinweis (Praxistipp im Ablauf, keine Warnung) gehört zu genau einer Aussage; die Sterne sind seine Wichtigkeit für Einsteiger.
// Startwert = Wirkungspunkte × Gewissheitsfaktor, gerundet, höchstens 5; `sterne_manuell` (mit `sterne_grund`) überschreibt ihn,
// wo Vorwissen den Wert ändert. Die Nutzerstufe ist nur die Schwelle, ab der ein Hinweis erscheint.
export const STUFEN = ['einsteiger', 'fortgeschritten', 'profi'];
export const STUFE_TEXT = { einsteiger: 'Einsteiger', fortgeschritten: 'Fortgeschritten', profi: 'Profi' };
export const SCHWELLE = { einsteiger: 1, fortgeschritten: 3, profi: 5 };
const WIRKUNG_PUNKTE = { ohne_folge: 0, leicht: 2, spuerbar: 4, ausfall: 5 };
const GEWISSHEIT_FAKTOR = { never: 0, unlikely: 0.4, maybe: 0.6, likely: 0.8, surely: 1, proven: 1 };

// Aussage-id = <regel-id>:<ziel>; die Regel-id kann selbst Doppelpunkte tragen (wissen:name), das Ziel steht nach dem letzten
export function aussageVon(aussageId, daten) {
  const i = String(aussageId).lastIndexOf(':');
  if (i < 0) return null;
  return aussagenFuer(aussageId.slice(0, i), daten).find((a) => a.ziel === aussageId.slice(i + 1)) ?? null;
}

export const sterneBerechnet = (a) => Math.min(5, Math.max(0, Math.round(WIRKUNG_PUNKTE[a.wirkung] * GEWISSHEIT_FAKTOR[a.gewissheit])));

// → { sterne, berechnet, manuell, grund, aussage } oder null, wenn die Aussage fehlt
export function hinweisSterne(h, daten) {
  const aussage = aussageVon(h?.aussage, daten);
  if (!aussage) return null;
  const berechnet = sterneBerechnet(aussage);
  const manuell = Number.isInteger(h.sterne_manuell);
  return { sterne: manuell ? h.sterne_manuell : berechnet, berechnet, manuell, grund: manuell ? h.sterne_grund : null, aussage };
}

// Hinweise eines Schritts, die für die Stufe erscheinen (ab Schwelle), wichtigste zuerst
export function hinweiseFuerSchritt(schrittKey, hinweiseDaten, daten, stufe = 'einsteiger') {
  const schwelle = SCHWELLE[stufe] ?? SCHWELLE.einsteiger;
  const liste = [];
  for (const h of hinweiseDaten?.hinweise || []) {
    if (h.schritt !== schrittKey) continue;
    const s = hinweisSterne(h, daten);
    if (!s || s.sterne < schwelle) continue;
    liste.push({
      id: h.id, text: h.text, sterne: s.sterne, berechnet: s.berechnet, manuell: s.manuell,
      titel: `Wichtigkeit für Einsteiger: ${s.sterne} von 5 Sternen. Wirkung ${WIRKUNG_TEXT[s.aussage.wirkung]}, Gewissheit ${GEWISSHEIT_TEXT[s.aussage.gewissheit]}${s.manuell ? `; von Hand angepasst (berechnet ${s.berechnet}): ${s.grund}` : ''}.`,
    });
  }
  return liste.sort((a, b) => b.sterne - a.sterne || a.id.localeCompare(b.id));
}

// Alle Schritt-Schlüssel, an die ein Hinweis andocken kann: Technik-Schritte, Operationen und Schritte der Methoden
export function schrittKeysAusDaten(data) {
  const keys = new Set();
  for (const t of Object.values(data.techniken || {})) if (t && typeof t === 'object') for (const s of Object.values(t.schritte || {})) if (s?.key) keys.add(s.key);
  for (const k of Object.keys(data.operations || {})) if (!k.startsWith('_')) keys.add(k);
  for (const m of Object.values(data.methods || {})) for (const e of Array.isArray(m?.sequenz) ? m.sequenz : []) keys.add(typeof e === 'string' ? e : e?.key);
  keys.delete(undefined);
  return keys;
}

export function hinweiseValidieren(hinweiseDaten, aussagenDaten, schrittKeys = null) {
  const fehler = [];
  const liste = hinweiseDaten?.hinweise;
  if (!Array.isArray(liste)) return ['hinweise.json: Feld „hinweise“ fehlt'];
  const ids = new Set();
  for (const h of liste) {
    const id = h?.id ?? '(ohne id)';
    const fe = (m) => fehler.push(`${id}: ${m}`);
    if (!h?.id || ids.has(h.id)) fe('id fehlt oder doppelt');
    ids.add(h?.id);
    if (String(h?.text ?? '').trim().length < 10) fe('text fehlt');
    if (schrittKeys && !schrittKeys.has(h?.schritt)) fe(`schritt „${h?.schritt}“ ist kein Schritt der Daten`);
    if (!aussageVon(h?.aussage, aussagenDaten)) fe(`aussage „${h?.aussage}“ gibt es nicht (Regel-id:Ziel)`);
    if (h?.sterne_manuell != null && !(Number.isInteger(h.sterne_manuell) && h.sterne_manuell >= 0 && h.sterne_manuell <= 5)) fe('sterne_manuell muss eine ganze Zahl von 0 bis 5 sein');
    if (h?.sterne_manuell != null && String(h.sterne_grund ?? '').trim().length < 10) fe('sterne_manuell braucht einen sterne_grund');
    if (h?.sterne_manuell == null && h?.sterne_grund != null) fe('sterne_grund ohne sterne_manuell');
  }
  return fehler;
}
