import { loadCorpus, normalizeRecipe, stats } from './model/corpus.js';
import { compute } from './model/engine.js';
import { renderMorphbox } from './ui/morphbox.js';
import { renderFlow } from './ui/flow.js';
import { renderRecipe } from './ui/recipeCard.js';
import { renderStats } from './ui/stats.js';
import { renderRueckfragen } from './ui/rueckfragen.js';
import { renderKandidaten } from './ui/kandidaten.js';

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const [ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln] = await Promise.all(
  ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln'].map((n) => loadJson(`./src/data/${n}.json`)),
);
const data = { ingredients, operations, methods, archetypes, vessels, kategorien, verben, erfahrungsregeln };
const arch = archetypes.ruehrteig;

const raw = await loadCorpus(arch.varianten);
const korpusStats = Object.fromEntries(
  Object.entries(raw).map(([k, list]) => [k, stats(list.map((r) => normalizeRecipe(r, ingredients)))]),
);

// Jede Rolle trägt eine Liste von {zutat, anteil} statt einer einzelnen Zutat —
// so lassen sich Zutaten mischen (z. B. Fett aus Butter + Öl). Ein einfacher
// Wert (String) wird zu einem Ein-Eintrag-Array, null/undefined zu [].
function alsEintraege(wert) {
  if (wert == null) return [];
  if (Array.isArray(wert)) return wert;
  return [{ zutat: wert, anteil: 1 }];
}

const state = {
  archetyp: 'ruehrteig',
  gefaess: arch.varianten.kastenkuchen.gefaess,
  methode: null,
  // fixiert.rollen[rolle] = true: ganze Rolle bewusst fixiert (DR-019 Wert-Zustand "gesetzt-fix",
  // T24). fixiert.zutaten[rolle][zutat] = true: nur eine einzelne Zutat innerhalb einer
  // gemischten Rolle fixiert (T31, z. B. nur die Butter in einem Butter+Öl-Mix). Eine künftige
  // automatische Kaskade (T26/T27) darf beides nicht anfassen. Fehlt ein Eintrag, gilt die
  // Rolle/Zutat als flexibel (heutiges Verhalten).
  fixiert: { rollen: {}, zutaten: {} },
  zutaten: Object.fromEntries(arch.rollen.map((r) => [r.rolle, alsEintraege(r.default)])),
};
applyPreset('kastenkuchen');

const $ = (id) => document.getElementById(id);

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

document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { applyPreset(b.dataset.preset); render(); }));
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
  renderKandidaten($('kandidaten'), data, refreshKandidaten);
}

render();
