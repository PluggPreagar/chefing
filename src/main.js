import { loadCorpus, normalizeRecipe, stats } from './model/corpus.js';
import { compute } from './model/engine.js';
import { renderMorphbox } from './ui/morphbox.js';
import { renderFlow } from './ui/flow.js';
import { renderRecipe } from './ui/recipeCard.js';
import { renderStats } from './ui/stats.js';

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const [ingredients, operations, methods, archetypes, vessels, kategorien, verben] = await Promise.all(
  ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben'].map((n) => loadJson(`./src/data/${n}.json`)),
);
const data = { ingredients, operations, methods, archetypes, vessels, kategorien, verben };
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
  // fixiert[rolle] = true: Nutzer hat diese Rolle bewusst fixiert (DR-019 Wert-Zustand
  // "gesetzt-fix", T24) — eine künftige automatische Kaskade (T26/T27) darf sie nicht
  // anfassen. Fehlt der Eintrag, gilt die Rolle als flexibel (heutiges Verhalten).
  fixiert: {},
  zutaten: Object.fromEntries(arch.rollen.map((r) => [r.rolle, alsEintraege(r.default)])),
};
applyPreset('kastenkuchen');

const $ = (id) => document.getElementById(id);

function applyPreset(variante) {
  const v = arch.varianten[variante];
  state.gefaess = v.gefaess;
  state.methode = null;
  state.fixiert = {}; // neue Zutaten-Grundlage — alte Fixierungen würden sonst sofort kollidieren
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

render();
