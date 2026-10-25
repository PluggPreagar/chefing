// Rückmeldung „hat es geklappt?“ (T53, DR-027): 1–5 Punkte + Kommentar zu einem erzeugten Rezept.
// Jede Regel, Grenze und Modellwarnung ist eine Vorhersage (`computed.regelIds`); die Rückmeldung etikettiert sie.
// Gesendet wird per POST an chefing-feedback.php (eigener Webspace, DR-027); Meldungen, die nicht ankommen, bleiben
// lokal in der Warteschlange und werden beim nächsten Besuch erneut versucht (wie overrides.js: localStorage, still scheiternd).

export const SCHEMA_VERSION = 1;
export const MAX_KOMMENTAR = 1000;
const KEY = 'chefing_rueckmeldungen_v1';
export const MIN_BERICHT_N = 3; // ab so vielen Meldungen je Regel wird sie in der Auswertung zum Kandidaten

// 1–2 klappt nicht · 3 mit Abweichung · 4–5 klappt (die „übliche“ Fünf-Punkte-Skala, Nutzer-Vorgabe)
export const klasseVon = (bewertung) => (bewertung >= 4 ? 'klappt' : bewertung === 3 ? 'abweichung' : 'nicht');
export const BEWERTUNG_TEXT = { 1: 'misslungen', 2: 'schlecht', 3: 'geht so', 4: 'gut', 5: 'sehr gut' };

// Prozessfehler zum Ankreuzen (T66, DR-036): die häufigsten Ursachen in Backratgebern, die das Modell nicht prüfen kann (T61, tipps.json).
// Schlüssel sind Teil des Meldungs-Schemas (chefing-feedback.php kennt dieselbe Liste); Texte nur für die Anzeige.
export const PROZESS_FEHLER = {
  zu_lange_geruehrt: 'Nach dem Mehl zu lange gerührt',
  tuer_frueh_geoeffnet: 'Backofentür zu früh geöffnet',
  ofen_zu_heiss: 'Ofen war zu heiß',
  ofen_zu_kalt: 'Ofen war zu kalt',
  zutaten_zu_kalt: 'Butter oder Eier waren zu kalt',
};
const prozessSauber = (liste) => [...new Set((Array.isArray(liste) ? liste : []).filter((k) => Object.hasOwn(PROZESS_FEHLER, k)))];

const gekuerzt = (s, n) => String(s ?? '').slice(0, n);

// state/computed aus main.js bzw. engine.js; eingabe: {bewertung, kommentar, mengenWieVorgeschlagen, prozess?}
export function baueMeldung({ state, computed, eingabe, appVersion }) {
  const zutaten = {};
  for (const [rolle, liste] of Object.entries(state.zutaten || {})) {
    const eintraege = (liste || []).filter((e) => e?.zutat).map((e) => ({ zutat: e.zutat, anteil: e.anteil || 1 }));
    if (eintraege.length) zutaten[rolle] = eintraege;
  }
  const g = computed.gaerung;
  // Manuell gesetzte Mengen (T40): dann sind es nicht die vorgeschlagenen Korpus-Mengen
  const mengenManuell = Object.entries(computed.rollenBp || {}).filter(([, v]) => v.quelle === 'manuell').map(([r]) => r);
  return {
    v: SCHEMA_VERSION,
    bewertung: eingabe.bewertung,
    kommentar: gekuerzt(String(eingabe.kommentar ?? '').trim(), MAX_KOMMENTAR), // erst trimmen, dann kürzen (wie chefing-feedback.php)
    mengenWieVorgeschlagen: eingabe.mengenWieVorgeschlagen === true && mengenManuell.length === 0,
    prozess: prozessSauber(eingabe.prozess),
    app: appVersion || 'lokal',
    kontext: {
      archetyp: state.archetyp,
      variante: computed.variante,
      methode: computed.methodKey,
      gefaess: state.gefaess,
      status: computed.status,
      zutaten,
      regelIds: computed.regelIds || [],
      warnungen: (computed.warnungen || []).slice(0, 12).map((w) => gekuerzt(w, 300)),
      korpusN: computed.korpusN ?? null,
      korpusNMethode: computed.korpusNMethode ?? null,
      mengenManuell,
      rollenBp: Object.fromEntries(Object.entries(computed.rollenBp || {}).map(([r, v]) => [r, Math.round(v.bp * 100) / 100])),
      gaerung: g ? { gare: Math.round(g.gare), erwartet: Math.round(g.erwartet * 10) / 10, hefeBp: Math.round(g.hefeBp * 100) / 100, temp: Math.round(g.temp * 10) / 10, kuehl: !!g.kuehl, berechnet: !!g.berechnet } : null,
    },
  };
}

export function pruefeEingabe(eingabe) {
  if (!Number.isInteger(eingabe?.bewertung) || eingabe.bewertung < 1 || eingabe.bewertung > 5) return 'Bitte 1 bis 5 Punkte wählen.';
  if (String(eingabe.kommentar ?? '').length > MAX_KOMMENTAR) return `Der Kommentar ist auf ${MAX_KOMMENTAR} Zeichen begrenzt.`;
  if (eingabe.prozess != null && (!Array.isArray(eingabe.prozess) || eingabe.prozess.some((k) => !Object.hasOwn(PROZESS_FEHLER, k)))) return 'Unbekannte Angabe zum Ablauf.';
  return null;
}

// --- Warteschlange (lokal) ----------------------------------------------------------------------------------------
function laden() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : { offen: [], gesendet: [] }; } catch { return { offen: [], gesendet: [] }; }
}
function speichern(daten) {
  try { localStorage.setItem(KEY, JSON.stringify(daten)); } catch { /* privater Modus o. ä. — kein Blocker */ }
}
export const offeneMeldungen = () => laden().offen || [];
export const gesendeteMeldungen = () => laden().gesendet || [];
export function merkeOffen(meldung) { const d = laden(); d.offen = [...(d.offen || []), meldung].slice(-20); speichern(d); }
export function merkeGesendet(meldung, id) {
  const d = laden();
  d.gesendet = [...(d.gesendet || []), { id, zeitpunkt: new Date().toISOString(), bewertung: meldung.bewertung, variante: meldung.kontext.variante, methode: meldung.kontext.methode }].slice(-50);
  speichern(d);
}

// Antwortcodes: 200 ok · 4xx Meldung wird verworfen (kaputt oder abgelehnt) · 429/5xx/Netz: später erneut versuchen
export async function sende(meldung, { url = './chefing-feedback.php', fetchFn = globalThis.fetch } = {}) {
  let antwort;
  try {
    antwort = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meldung) });
  } catch {
    return { ok: false, wiederholen: true, fehler: 'Keine Verbindung.' };
  }
  let inhalt = null;
  try { inhalt = await antwort.json(); } catch { /* keine JSON-Antwort */ }
  if (antwort.ok && inhalt?.ok) return { ok: true, id: inhalt.id ?? null };
  const wiederholen = antwort.status === 429 || antwort.status >= 500 || antwort.status === 404;
  const text = antwort.status === 429 ? 'Gerade zu viele Meldungen — bitte später noch einmal.'
    : antwort.status === 404 ? 'Der Meldeweg ist hier nicht eingerichtet.'
    : antwort.status >= 500 ? 'Der Server konnte die Meldung nicht speichern.'
    : `Die Meldung wurde abgelehnt (${inhalt?.fehler ?? antwort.status}).`;
  return { ok: false, wiederholen, status: antwort.status, fehler: text };
}

// Eine Meldung senden; scheitert es vorübergehend, bleibt sie in der Warteschlange.
export async function meldeErgebnis(meldung, optionen) {
  const r = await sende(meldung, optionen);
  if (r.ok) merkeGesendet(meldung, r.id);
  else if (r.wiederholen) merkeOffen(meldung);
  return r;
}

// Beim Seitenstart: offene Meldungen noch einmal versuchen (je Aufruf höchstens eine Runde, still).
export async function sendeOffene(optionen) {
  const offen = offeneMeldungen();
  if (!offen.length) return { gesendet: 0, uebrig: 0 };
  const uebrig = [];
  let gesendet = 0;
  for (const m of offen) {
    const r = await sende(m, optionen);
    if (r.ok) { gesendet++; merkeGesendet(m, r.id); } else if (r.wiederholen) uebrig.push(m);
  }
  const d = laden(); d.offen = uebrig; speichern(d);
  return { gesendet, uebrig: uebrig.length };
}

// --- Von der Rückmeldung zum Negativ-Korpus (T68, DR-036) ---------------------------------------------------------------------------
// Entwurf eines Falls für negativ.json aus einer gespeicherten Meldung (feedback.jsonl). Nur Zutaten und Mengen aus der Meldung —
// der Kommentar des Nutzers wird nicht übernommen (Datenschutz, DR-027). Gramm je Zutat aus dem Bäckerprozent der Rolle (Mehl = 100 g),
// geteilt nach Anteil und durch den Äquivalent-Faktor der Zutat (Natron zählt als Backpulver-Äquivalent). Ein Mensch kuratiert den Entwurf:
// Symptom, Ursache, `ursache_regeln`; `entwurf: true` bleibt, bis das geschehen ist (ein Test hält Entwürfe aus negativ.json heraus).
export function meldungZuFall(m, { ingredients = {} } = {}) {
  const k = m?.kontext;
  if (!k || !Number.isInteger(m.bewertung)) return null;
  const zutaten = [];
  for (const [rolle, liste] of Object.entries(k.zutaten || {})) {
    const bp = k.rollenBp?.[rolle];
    if (!(bp > 0) || !Array.isArray(liste) || !liste.length) continue;
    const summe = liste.reduce((a, e) => a + (e.anteil || 1), 0) || 1;
    for (const e of liste) {
      const faktor = ingredients[e.zutat]?.aequivalent_faktor ?? 1;
      zutaten.push({ rolle, zutat: e.zutat, menge: Math.round(((bp * (e.anteil || 1)) / summe / faktor) * 100) / 100, einheit: 'g', original: `aus der Rückmeldung: ${Math.round(bp * 10) / 10} % vom Mehl in der Rolle ${rolle}` });
    }
  }
  const prozess = prozessSauber(m.prozess);
  const nurProzess = m.mengenWieVorgeschlagen === true && prozess.length > 0;
  return {
    id: `rueckmeldung-${m.id ?? 'ohne-id'}`,
    entwurf: true,
    archetyp: k.archetyp,
    variante: k.variante,
    ergebnis: m.bewertung <= 2 ? 'misslungen' : 'teilweise',
    verlaesslichkeit: 2,
    mengen_vorhanden: zutaten.length > 0,
    symptom: `Rückmeldung ${m.bewertung} von 5 (${BEWERTUNG_TEXT[m.bewertung]}); Symptom noch zu ergänzen`,
    ursache_laut_quelle: prozess.length ? `Angekreuzt: ${prozess.map((p) => PROZESS_FEHLER[p]).join('; ')}. Weitere Ursache noch zu ergänzen` : 'Ursache noch zu ergänzen',
    zutaten,
    methode: k.methode,
    ursache_art: nurProzess ? 'prozess' : 'offen',
    ...(nurProzess ? { kontrollfall: true } : {}),
    mengen_wie_vorgeschlagen: m.mengenWieVorgeschlagen === true,
    quelle: { url: 'https://hamsch.net/chefing/', site: 'chefing-rueckmeldung' },
    notiz: `Entwurf aus einer Rückmeldung (${m.empfangen ?? 'ohne Datum'}, App ${m.app ?? '?'}); ${k.regelIds?.length ? `gezeigte Regeln: ${k.regelIds.join(', ')}` : 'keine Regel hat gewarnt'}. Vor dem Einpflegen kuratieren.`,
  };
}

// --- Auswertung (Vierfeldertafel je Regel-id) ---------------------------------------------------------------------------
// meldungen: Meldungen wie sie chefing-feedback.php speichert. Nur Meldungen mit den vorgeschlagenen Mengen zählen für die
// Vorhersage; wer eigene Mengen nahm, hat ein eigenes Rezept ausprobiert (→ `eigeneRezepte`).
export function auswerten(meldungen, { minN = MIN_BERICHT_N } = {}) {
  const leer = () => ({ klappt: 0, abweichung: 0, nicht: 0, n: 0 });
  const zaehle = (t, klasse) => { t[klasse]++; t.n++; };
  const proRegel = {};
  const ohneWarnung = {};
  const fehlend = [];
  const eigene = [];
  const prozess = {}; // Prozessfehler (T66) je Schlüssel, über alle gültigen Meldungen — unabhängig von den Mengen
  let gueltig = 0;

  for (const m of meldungen) {
    if (m?.v !== SCHEMA_VERSION || !Number.isInteger(m.bewertung)) continue;
    const klasse = klasseVon(m.bewertung);
    for (const k of prozessSauber(m.prozess)) zaehle(prozess[k] ??= leer(), klasse);
    if (m.mengenWieVorgeschlagen !== true) { eigene.push(m); continue; }
    gueltig++;
    const ids = m.kontext?.regelIds || [];
    const gruppe = `${m.kontext?.variante}/${m.kontext?.methode}`;
    if (ids.length) for (const id of ids) zaehle(proRegel[id] ??= leer(), klasse);
    else {
      zaehle(ohneWarnung[gruppe] ??= leer(), klasse);
      if (klasse === 'nicht') fehlend.push(m);
    }
  }
  const anteil = (t, k) => (t.n ? t[k] / t.n : 0);
  const regeln = Object.entries(proRegel).map(([id, t]) => ({
    id, ...t,
    // Warnung gegeben, aber es klappte: Regel zu streng?  Warnung gegeben und es klappte nicht: bestätigt.
    urteil: t.n < minN ? 'zu wenige' : anteil(t, 'klappt') >= 0.75 ? 'zu streng?' : anteil(t, 'nicht') >= 0.5 ? 'bestaetigt' : 'unklar',
  })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const gruppen = Object.entries(ohneWarnung).map(([gruppe, t]) => ({
    gruppe, ...t,
    // Keine Warnung, aber es klappte nicht: fehlt eine Regel?
    urteil: t.n < minN ? 'zu wenige' : anteil(t, 'nicht') >= 0.3 ? 'fehlende Regel?' : 'ok', // ab etwa einem Drittel Misserfolgen ohne jede Warnung
  })).sort((a, b) => b.n - a.n || a.gruppe.localeCompare(b.gruppe));
  // Anteil „klappt nicht“ je Prozessfehler: ab MIN_BERICHT_N Meldungen und mindestens der Hälfte Misserfolge ein Kandidat für eine Prozess-Regel
  const prozessFehler = Object.entries(prozess).map(([schluessel, t]) => ({
    schluessel, ...t,
    urteil: t.n < minN ? 'zu wenige' : anteil(t, 'nicht') >= 0.5 ? 'Kandidat' : 'unklar',
  })).sort((a, b) => b.n - a.n || a.schluessel.localeCompare(b.schluessel));
  return { gesamt: meldungen.length, gueltig, regeln, ohneWarnung: gruppen, fehlendeRegel: fehlend, eigeneRezepte: eigene, prozessFehler };
}
