import { loadCorpus, normalizeRecipe, stats } from './model/corpus.js';
import { compute } from './model/engine.js';
import { renderMorphbox, renderTechnikSchalter } from './ui/morphbox.js';
import { renderFlow } from './ui/flow.js';
import { renderKompakt } from './ui/kompakt.js';
import { iconHtml } from './ui/icons.js';
import { renderRecipe } from './ui/recipeCard.js';
import { renderStats } from './ui/stats.js';
import { renderRueckfragen } from './ui/rueckfragen.js';
import { renderKandidaten } from './ui/kandidaten.js';
import { sendeOffene } from './model/rueckmeldung.js';
import { alsEintraege, presetPatch, archetypPatch } from './model/zustand.js';
import { initFehlerMelden, oeffneMeldung } from './ui/fehlerMelden.js';
import { initMeldenMenue } from './ui/meldenMenue.js';
import { STUFEN, STUFE_TEXT, SCHWELLE } from './model/aussagen.js';
import { initVollbild } from './ui/vollbild.js';
import { initStufenMenue } from './ui/stufenMenue.js';

async function loadJson(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const [ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln, grenzen, modelle, temperaturen, orte, techniken, triebquellen, werkzeuge, zustaende, aussagen, hinweise] = await Promise.all(
  ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'modelle', 'temperaturen', 'orte', 'techniken', 'triebquellen', 'werkzeuge', 'zustaende', 'aussagen', 'hinweise'].map((n) => loadJson(`./src/data/${n}.json`)),
);
const archetypKeys = Object.keys(archetypes).filter((k) => !k.startsWith('_'));
let arch = archetypes[archetypKeys[0]]; // aktiver Archetyp; waehleArchetyp() setzt ihn zusammen mit data.arch und state.archetyp
const data = { ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln, grenzen, modelle, temperaturen, orte, techniken, triebquellen, werkzeuge, zustaende, aussagen, hinweise, arch };

// Normalisierte Rezeptlisten bleiben erhalten (nicht nur die aggregierten `stats()`) — die
// Korrelationssuche (DR-019 Punkt 5, T32) braucht die Rezepte einzeln, um Bäckerprozent bedingt
// auf eine Zutat-Eigenschaft zu vergleichen, nicht nur den Gesamt-Median je Rolle.
// Varianten-Schlüssel sind archetypübergreifend eindeutig, darum ein gemeinsamer Topf (T06).
const korpusNormalisiert = {};
const korpusStats = {};
for (const key of archetypKeys) {
  const a = archetypes[key];
  const rollen = a.rollen.map((r) => r.rolle);
  const referenz = a.rollen.find((r) => r.referenz)?.rolle ?? rollen[0];
  for (const [variante, list] of Object.entries(await loadCorpus(a.varianten))) {
    korpusNormalisiert[variante] = list.map((r) => normalizeRecipe(r, ingredients, { rollen, referenz }));
    korpusStats[variante] = stats(korpusNormalisiert[variante], rollen);
  }
}

// Nutzerstufe (DR-075): Schwelle für Praxishinweise (Einsteiger ab 1 Stern, Fortgeschritten ab 3, Profi ab 5); Wahl je Browser, Vorgabe Einsteiger
let gemerkteStufe = 'einsteiger';
try { const s = localStorage.getItem('chefing.stufe'); if (STUFEN.includes(s)) gemerkteStufe = s; } catch { /* ohne Speicher: Einsteiger */ }

const state = {
  archetyp: archetypKeys[0],
  stufe: gemerkteStufe,
  gefaess: null,
  methode: null,
  // fixiert.rollen[rolle] = true: ganze Rolle bewusst fixiert (DR-019 Wert-Zustand "gesetzt-fix",
  // T24). fixiert.zutaten[rolle][zutat] = true: nur eine einzelne Zutat innerhalb einer
  // gemischten Rolle fixiert (T31, z. B. nur die Butter in einem Butter+Öl-Mix). Eine künftige
  // automatische Kaskade (T26/T27) darf beides nicht anfassen. Fehlt ein Eintrag, gilt die
  // Rolle/Zutat als flexibel (heutiges Verhalten).
  fixiert: { rollen: {}, zutaten: {} },
  // mengen[rolle] = Bäckerprozent, vom Nutzer aus einem Mengen-Vorschlag übernommen (T40); gilt bis Preset-/Archetyp-Wechsel
  mengen: {},
  zutaten: {},
  // techniken[key] = true: optionale Technik eingeschaltet (DR-041, z. B. Eier getrennt); Preset-Wechsel setzt zurück
  techniken: {},
  // ausstattung[werkzeug] = true/false (T92): was die Küche hat; null = Standard (Alltags-Küche); bleibt bei Preset-Wechsel
  ausstattung: null,
  // zustandWege[rolle] = Weg-Schlüssel (DR-064): gewählter Weg zu einem Soll-Zustand (Butter weich) → Vorlauf-Schritt; null = nur Hinweis an der Zutat
  zustandWege: {},
};

const $ = (id) => document.getElementById(id);

// Ansicht des Ablaufs (DR-073): Strom oder Kompakt (nur Icons); Wahl je Browser.
// Fehlen Knopfgruppe oder Ziel (ältere index.html aus dem Cache, DR-037), werden sie angelegt.
let ansicht = 'strom';
try { if (localStorage.getItem('chefing.ablauf') === 'kompakt') ansicht = 'kompakt'; } catch { /* ohne Speicher: Strom */ }
function ablaufAnsicht() {
  if (!$('kompakt')) $('flow').after(Object.assign(document.createElement('div'), { id: 'kompakt', className: 'kompakt', hidden: true }));
  let g = $('ablauf-ansicht');
  if (!g) {
    g = Object.assign(document.createElement('span'), { id: 'ablauf-ansicht', className: 'knopfgruppe' });
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', 'Ansicht des Ablaufs');
    for (const k of ['strom', 'kompakt']) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'leiste-knopf ghost' });
      b.dataset.ansicht = k;
      g.append(b);
    }
    ($('stufe-menue') ?? document.querySelector('.ablauf-kopf'))?.after(g);
  }
  // nur Symbol (DR-084), Erklärung per Tooltip und aria-label; auch für eine ältere index.html aus dem Cache (DR-037)
  const ANSICHT = { strom: ['ansicht_strom', 'Strom', 'Strom: Zutaten fließen von oben auf die Zeitleiste'], kompakt: ['ansicht_kompakt', 'Kompakt', 'Kompakt: ganzer Ablauf auf einen Blick'] };
  for (const b of g.querySelectorAll('[data-ansicht]')) {
    const [icon, name, titel] = ANSICHT[b.dataset.ansicht];
    b.classList.add('leiste-knopf');
    b.innerHTML = iconHtml(icon, 18);
    b.title = titel;
    b.setAttribute('aria-label', name);
    b.addEventListener('click', () => {
      ansicht = b.dataset.ansicht;
      try { localStorage.setItem('chefing.ablauf', ansicht); } catch { /* nur für diese Sitzung */ }
      render();
    });
  }
}
ablaufAnsicht();

// Beschriftung der Kompakt-Ansicht (DR-081, DR-086): Text neben den Symbolen oder nur Symbole. Zwei benannte Möglichkeiten, die sofort wirken,
// also eine Knopfgruppe „Text | Symbole“ (DR-079); nur in der Kompakt-Ansicht sichtbar, Vorgabe Text, Wahl je Browser.
let kompaktNamen = true;
try { if (localStorage.getItem('chefing.kompaktNamen') === 'aus') kompaktNamen = false; } catch { /* ohne Speicher: Text */ }
function kompaktBeschriftung() {
  const g = Object.assign(document.createElement('span'), { id: 'kompakt-namen', className: 'knopfgruppe ablauf-ansicht' });
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', 'Beschriftung der Kompakt-Ansicht');
  for (const [wahl, text, titel] of [[true, 'Text', 'Schritte und Zutaten mit Name und Menge neben den Symbolen'], [false, 'Symbole', 'Nur Symbole, Name und Menge erst beim Antippen']]) {
    const knopf = Object.assign(document.createElement('button'), { type: 'button', className: 'ghost', textContent: text, title: titel });
    knopf.dataset.namen = String(wahl);
    knopf.addEventListener('click', () => {
      kompaktNamen = wahl;
      try { localStorage.setItem('chefing.kompaktNamen', wahl ? 'an' : 'aus'); } catch { /* nur für diese Sitzung */ }
      render();
    });
    g.append(knopf);
  }
  ($('ablauf-techniken') ?? document.querySelector('.ablauf-kopf')).after(g);
}
kompaktBeschriftung();

// Erfahrungsstufe (DR-075, DR-085): wie viele Praxishinweise erscheinen; Warnungen bleiben immer sichtbar. Eine allgemeine, selten geänderte
// Einstellung, darum ein Auswahlmenü oben auf der Seite statt einer Knopfgruppe im Ablauf. Fehlt der Platz in der index.html (ältere Fassung
// aus dem Cache, DR-037), wird er neben dem Titel angelegt; eine alte Knopfgruppe im Ablauf-Kopf wird entfernt.
$('ablauf-stufe')?.remove();
if (!$('stufe-menue')) document.querySelector('header.top h1')?.after(Object.assign(document.createElement('div'), { id: 'stufe-menue' }));
const stufenMenue = initStufenMenue($('stufe-menue'), {
  stufen: STUFEN, text: STUFE_TEXT, schwelle: SCHWELLE, aktuell: state.stufe,
  onWahl: (k) => {
    state.stufe = k;
    try { localStorage.setItem('chefing.stufe', k); } catch { /* nur für diese Sitzung */ }
    render();
  },
});

// Ablauf im Vollbild, bei Bedarf gedreht (T124, DR-080)
// Im Vollbild wählt die Ausrichtung die Ansicht (DR-089): Querformat = Strom (links nach rechts), Hochformat = Kompakt mit Text (oben nach unten).
// Beim Beenden springt die Ansicht auf die eigene Wahl zurück; die Wahl in der Werkzeugleiste (`ansicht`) bleibt dabei unberührt.
let vollbildAnsicht = null;
initVollbild(document.querySelector('.panel.ablauf'), document.querySelector('.ablauf-kopf'), document, globalThis.screen, {
  beiWechsel: (s) => {
    const neu = s.offen ? (s.ausrichtung === 'quer' ? 'strom' : 'kompakt') : null;
    if (neu !== vollbildAnsicht) { vollbildAnsicht = neu; render(); }
  },
});

// Knopfgruppe der Varianten (DR-045); fehlt sie (ältere index.html aus dem Browser-Cache, DR-037), wird sie angelegt
function presetGruppe() {
  let g = $('preset-gruppe');
  if (!g) {
    g = document.createElement('span');
    g.id = 'preset-gruppe';
    g.className = 'knopfgruppe';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', 'Varianten');
    document.querySelector('nav.fluss, nav.presets')?.append(g);
  }
  return g;
}

// Archetyp wechseln (T06): aktiver Archetyp lebt an drei Stellen (arch, data.arch, state.archetyp) —
// hier immer gemeinsam setzen. Preset-Buttons kommen aus den Varianten des Archetyps.
function waehleArchetyp(key) {
  arch = archetypes[key];
  data.arch = arch;
  Object.assign(state, archetypPatch(arch, key));
  document.querySelectorAll('[data-preset]').forEach((b) => b.remove());
  const gruppe = presetGruppe();
  for (const [vKey, v] of Object.entries(arch.varianten)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.preset = vKey;
    b.textContent = v.kurz ?? v.label;
    b.addEventListener('click', () => { applyPreset(vKey); render(); });
    gruppe.append(b);
  }
  $('tagline').textContent = `${arch.label} als Kombinatorik: Zutaten nach Eigenschaften wählen, Methode folgt aus der Physik, Mengen aus dem Rezept-Korpus.`;
  document.title = `Chefing — ${arch.label}-Kombinator`;
  applyPreset(Object.keys(arch.varianten)[0]);
}

// Umschalter nur anzeigen, wenn es mehr als einen Archetyp gibt.
const archetypWahl = $('archetyp-wahl');
if (archetypKeys.length > 1) {
  for (const k of archetypKeys) archetypWahl.add(new Option(archetypes[k].label, k));
  archetypWahl.hidden = false;
  archetypWahl.addEventListener('change', () => {
    waehleArchetyp(archetypWahl.value);
    render();
    if (!$('stats').hidden) renderStats($('stats'), korpusStats, data);
    if (!$('kandidaten').hidden) refreshKandidaten();
  });
}
waehleArchetyp(archetypKeys[0]);

// Grenze für die Rückfrage-UI (DR-019/T28): nur Overrides fragen, die VOR diesem Seitenaufruf
// erfasst wurden — sonst würde ein gerade eben gesetzter Override sofort wieder abgefragt,
// bevor überhaupt gebacken wurde. "Später" heißt hier: beim nächsten Laden der Seite.
const sessionStart = new Date().toISOString();

function applyPreset(variante) {
  Object.assign(state, presetPatch(arch, variante)); // neue Grundlage: alte Fixierungen und manuelle Mengen entfallen
}

function update(patch) {
  Object.assign(state, patch);
  render();
}

let letztes = null; // zuletzt berechnetes Rezept, für die Fehlermeldung
function render() {
  const computed = compute(state, data, korpusStats);
  letztes = computed;
  renderRueckfragen($('rueckfragen'), sessionStart, render);
  renderMorphbox($('morphbox'), state, data, computed, korpusStats, update);
  renderTechnikSchalter($('ablauf-techniken'), state, data, computed, update);
  const kompakt = (vollbildAnsicht ?? ansicht) === 'kompakt'; // im Vollbild gilt die Ansicht der Ausrichtung (DR-089)
  $('flow').hidden = kompakt;
  $('kompakt').hidden = !kompakt;
  $('kompakt-namen').hidden = ansicht !== 'kompakt'; // gehört zur eigenen Wahl, nicht zur Ansicht im Vollbild
  $('kompakt-namen').querySelectorAll('[data-namen]').forEach((k) => { const an = (k.dataset.namen === 'true') === kompaktNamen; k.classList.toggle('is-active', an); k.setAttribute('aria-pressed', String(an)); });
  if (kompakt) renderKompakt($('kompakt'), computed, data, { namen: vollbildAnsicht === 'kompakt' ? true : kompaktNamen }); else renderFlow($('flow'), computed, data);
  document.querySelectorAll('[data-ansicht]').forEach((b) => { b.classList.toggle('is-active', b.dataset.ansicht === ansicht); b.setAttribute('aria-pressed', String(b.dataset.ansicht === ansicht)); });
  stufenMenue.setze(state.stufe);
  renderRecipe($('recipe'), computed, state, data, update);
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-active', b.dataset.preset === computed.variante));
}

// Ansichts-Schalter zeigen, ob ihr Panel offen ist (aktiv in der Knopfgruppe, DR-045)
// nur Symbol (DR-084); Name und Erklärung stehen im Tooltip und im aria-label
$('toggle-stats').innerHTML = iconHtml('statistik', 18);
$('toggle-kandidaten').innerHTML = iconHtml('kandidaten', 18);
const gedrueckt = (b, an) => { b.classList.toggle('is-active', an); b.setAttribute('aria-pressed', String(an)); };
$('toggle-stats').addEventListener('click', () => {
  const s = $('stats');
  s.hidden = !s.hidden;
  gedrueckt($('toggle-stats'), !s.hidden);
  if (!s.hidden) renderStats(s, korpusStats, data);
});
// Melden (DR-044, DR-083, DR-088): ein geteilter Knopf mit zwei Aktionen. Die gewählte bleibt gemerkt (localStorage chefing.melden), damit man
// dieselbe Aktion mehrmals hintereinander auslösen kann. Eine ältere index.html aus dem Cache (DR-037) bringt noch die zwei einzelnen Knöpfe mit:
// sie werden entfernt und der Platz neu angelegt.
if (!$('melden-menue')) {
  $('fehler-melden')?.remove();
  $('ergebnis-melden')?.remove();
  (document.querySelector('.top-leiste') ?? document.querySelector('nav.presets') ?? document.querySelector('header.top'))?.append(Object.assign(document.createElement('div'), { id: 'melden-menue' }));
}
// Sprung zur Box „Hat es geklappt?“ (DR-067)
function springeZurBewertung() {
  const b = $('rueckmeldung');
  if (!b) return;
  b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  b.classList.add('hervorheben');
  setTimeout(() => b.classList.remove('hervorheben'), 1600);
  b.querySelector('input[name="bewertung"]')?.focus({ preventScroll: true });
}
// Fehler melden: die Meldung nennt, was gerade eingestellt und berechnet war
initFehlerMelden(() => ({
  archetyp: state.archetyp, variante: letztes?.variante, gefaess: state.gefaess, methode: letztes?.methodKey, methode_gewaehlt: state.methode,
  zutaten: state.zutaten, mengen: state.mengen, techniken: state.techniken, ausstattung: state.ausstattung, fixiert: state.fixiert,
  status: letztes?.status, regeln: letztes?.regelIds, zeit: letztes?.zeit,
  ablauf: letztes?.ablauf.map((s) => `${s.nr}. ${s.key} (${s.aktiv}+${s.wirk} Min.)`),
}));
let gemerktesMelden = 'fehler';
try { const m = localStorage.getItem('chefing.melden'); if (m === 'fehler' || m === 'bewerten') gemerktesMelden = m; } catch { /* ohne Speicher: Melden */ }
initMeldenMenue($('melden-menue'), {
  aktuell: gemerktesMelden,
  fuehreAus: (k) => (k === 'bewerten' ? springeZurBewertung() : oeffneMeldung()),
  onMerke: (k) => { try { localStorage.setItem('chefing.melden', k); } catch { /* nur für diese Sitzung */ } },
});
$('toggle-kandidaten').addEventListener('click', () => {
  const k = $('kandidaten');
  k.hidden = !k.hidden;
  gedrueckt($('toggle-kandidaten'), !k.hidden);
  if (!k.hidden) refreshKandidaten();
});

function refreshKandidaten() {
  renderKandidaten($('kandidaten'), data, korpusNormalisiert, refreshKandidaten);
}

// Versionsanzeige im Footer (Nutzer-Vorgabe): `deploy.php` schreibt bei jedem Live-Deploy ein
// version.json mit Commit-SHA + Zeit neben die App (siehe deploy.php, Zeile ~107). Lokal in der
// Entwicklung existiert die Datei nicht — dann bleibt die Zeile unsichtbar (`hidden`), statt eine
// Fehlermeldung/Platzhalter zu zeigen, das ist kein Fehlerfall.
const utc = (s) => { const d = new Date(s); return !(d.getFullYear() > 2000) ? null : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`; };
const appVersion = globalThis.CHEFING_VERSION; // setzt der Lade-Stub in index.html (nur mit Deploy-version.json)
if ($('version-info') && appVersion?.sha) {
  const kurzSha = String(appVersion.sha).slice(0, 7);
  data.appVersion = kurzSha; // Rückmeldungen nennen die App-Version (welche Regeln galten, T53)
  const teile = [`Version ${kurzSha}`, appVersion.time && `Commit ${appVersion.time.replace(/:\d\d UTC$/, ' UTC')}`, utc(appVersion.deployed) && `deployed ${utc(appVersion.deployed)}`];
  $('version-info').textContent = teile.filter(Boolean).join(' · ');
  $('version-info').hidden = false;
} // sonst lokale Entwicklung — kein Fehler, Zeile bleibt versteckt

// Rückmeldungen, die beim letzten Mal nicht ankamen (Netz, Limit), noch einmal still versuchen (T53)
sendeOffene().catch(() => {});

render();
