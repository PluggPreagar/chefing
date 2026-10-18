import { loadCorpus, normalizeRecipe, stats } from './model/corpus.js';
import { compute } from './model/engine.js';
import { renderMorphbox } from './ui/morphbox.js';
import { renderFlow } from './ui/flow.js';
import { renderRecipe } from './ui/recipeCard.js';
import { renderStats } from './ui/stats.js';
import { renderRueckfragen } from './ui/rueckfragen.js';
import { renderKandidaten } from './ui/kandidaten.js';
import { sendeOffene } from './model/rueckmeldung.js';

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const [ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln, grenzen, modelle, temperaturen] = await Promise.all(
  ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'modelle', 'temperaturen'].map((n) => loadJson(`./src/data/${n}.json`)),
);
const archetypKeys = Object.keys(archetypes).filter((k) => !k.startsWith('_'));
let arch = archetypes[archetypKeys[0]]; // aktiver Archetyp; waehleArchetyp() setzt ihn zusammen mit data.arch und state.archetyp
const data = { ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln, grenzen, modelle, temperaturen, arch };

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

// Jede Rolle trägt eine Liste von {zutat, anteil} statt einer einzelnen Zutat —
// so lassen sich Zutaten mischen (z. B. Fett aus Butter + Öl). Ein einfacher
// Wert (String) wird zu einem Ein-Eintrag-Array, null/undefined zu [].
function alsEintraege(wert) {
  if (wert == null) return [];
  if (Array.isArray(wert)) return wert;
  return [{ zutat: wert, anteil: 1 }];
}

const state = {
  archetyp: archetypKeys[0],
  gefaess: null,
  methode: null,
  // fixiert.rollen[rolle] = true: ganze Rolle bewusst fixiert (DR-019 Wert-Zustand "gesetzt-fix",
  // T24). fixiert.zutaten[rolle][zutat] = true: nur eine einzelne Zutat innerhalb einer
  // gemischten Rolle fixiert (T31, z. B. nur die Butter in einem Butter+Öl-Mix). Eine künftige
  // automatische Kaskade (T26/T27) darf beides nicht anfassen. Fehlt ein Eintrag, gilt die
  // Rolle/Zutat als flexibel (heutiges Verhalten).
  fixiert: { rollen: {}, zutaten: {} },
  zutaten: {},
};

const $ = (id) => document.getElementById(id);

// Archetyp wechseln (T06): aktiver Archetyp lebt an drei Stellen (arch, data.arch, state.archetyp) —
// hier immer gemeinsam setzen. Preset-Buttons kommen aus den Varianten des Archetyps.
function waehleArchetyp(key) {
  arch = archetypes[key];
  data.arch = arch;
  state.archetyp = key;
  state.zutaten = Object.fromEntries(arch.rollen.map((r) => [r.rolle, alsEintraege(r.default)]));
  document.querySelectorAll('[data-preset]').forEach((b) => b.remove());
  for (const [vKey, v] of Object.entries(arch.varianten)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.preset = vKey;
    b.textContent = v.kurz ?? v.label;
    b.addEventListener('click', () => { applyPreset(vKey); render(); });
    $('toggle-stats').before(b);
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
  const v = arch.varianten[variante];
  state.gefaess = v.gefaess;
  state.methode = null;
  state.fixiert = { rollen: {}, zutaten: {} }; // neue Zutaten-Grundlage — alte Fixierungen würden sonst sofort kollidieren
  for (const r of arch.rollen) {
    const wert = v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default;
    state.zutaten[r.rolle] = alsEintraege(wert);
  }
}

function update(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  const computed = compute(state, data, korpusStats);
  renderRueckfragen($('rueckfragen'), sessionStart, render);
  renderMorphbox($('morphbox'), state, data, computed, korpusStats, update);
  renderFlow($('flow'), $('flow-details'), computed, data);
  renderRecipe($('recipe'), computed, state, data, update);
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-active', b.dataset.preset === computed.variante));
}

$('toggle-stats').addEventListener('click', () => {
  const s = $('stats');
  s.hidden = !s.hidden;
  if (!s.hidden) renderStats(s, korpusStats, data);
});
$('toggle-kandidaten').addEventListener('click', () => {
  const k = $('kandidaten');
  k.hidden = !k.hidden;
  if (!k.hidden) refreshKandidaten();
});

function refreshKandidaten() {
  renderKandidaten($('kandidaten'), data, korpusNormalisiert, refreshKandidaten);
}

// Versionsanzeige im Footer (Nutzer-Vorgabe): `deploy.php` schreibt bei jedem Live-Deploy ein
// version.json mit Commit-SHA + Zeit neben die App (siehe deploy.php, Zeile ~107). Lokal in der
// Entwicklung existiert die Datei nicht — dann bleibt die Zeile unsichtbar (`hidden`), statt eine
// Fehlermeldung/Platzhalter zu zeigen, das ist kein Fehlerfall.
loadJson('./version.json').then((v) => {
  const el = $('version-info');
  if (!el || !v?.sha) return;
  const kurzSha = String(v.sha).slice(0, 7);
  data.appVersion = kurzSha; // Rückmeldungen nennen die App-Version (welche Regeln galten, T53)
  el.textContent = `Version ${kurzSha}${v.time ? ` · deployed ${v.time}` : ''}`;
  el.hidden = false;
}).catch(() => {}); // kein version.json (lokale Entwicklung) — kein Fehler, Zeile bleibt versteckt

// Rückmeldungen, die beim letzten Mal nicht ankamen (Netz, Limit), noch einmal still versuchen (T53)
sendeOffene().catch(() => {});

render();
