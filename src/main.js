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

const state = {
  archetyp: 'ruehrteig',
  gefaess: arch.varianten.kastenkuchen.gefaess,
  methode: null,
  zutaten: Object.fromEntries(arch.rollen.map((r) => [r.rolle, r.default])),
};
applyPreset('kastenkuchen');

const $ = (id) => document.getElementById(id);

function applyPreset(variante) {
  const v = arch.varianten[variante];
  state.gefaess = v.gefaess;
  state.methode = null;
  for (const r of arch.rollen) {
    state.zutaten[r.rolle] = v.bestof[r.rolle] !== undefined ? v.bestof[r.rolle] : r.default;
  }
}

function update(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  const computed = compute(state, data, korpusStats);
  renderMorphbox($('morphbox'), state, data, computed, korpusStats, update);
  renderFlow($('flow'), $('flow-details'), computed, data.verben);
  renderRecipe($('recipe'), computed);
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-active', b.dataset.preset === computed.variante));
}

document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { applyPreset(b.dataset.preset); render(); }));
$('toggle-stats').addEventListener('click', () => {
  const s = $('stats');
  s.hidden = !s.hidden;
  if (!s.hidden) renderStats(s, korpusStats, data);
});

render();
