import { fromGrams } from './units.js';
import { ROLLEN } from './corpus.js';
import { evaluateAll, bestMethod, propsOf } from './rules.js';

const FALLBACK_BP = { struktur: 100, fett: 90, suesse: 90, bindung: 80, fluessigkeit: 20, trieb: 3, aroma: 3, einlage: 40 };

export function varianteFuerGefaess(gefaessKey, arch, vessels) {
  const fam = vessels[gefaessKey]?.familie;
  return Object.entries(arch.varianten).find(([, v]) => vessels[v.gefaess]?.familie === fam)?.[0] ?? Object.keys(arch.varianten)[0];
}

export function compute(state, data, korpusStats) {
  const arch = data.archetypes[state.archetyp];
  const vessel = data.vessels[state.gefaess];
  const variante = varianteFuerGefaess(state.gefaess, arch, data.vessels);
  const st = korpusStats[variante] || { n: 0, bp: {}, methoden: {}, backen: {} };

  const evals = evaluateAll(state.zutaten, state.gefaess, data, state.fixiert);
  const methodKey = state.methode && evals[state.methode] ? state.methode : bestMethod(evals, st.methoden, state.gefaess, data);
  const res = evals[methodKey];
  const method = data.methods[methodKey];
  const props = propsOf(state.zutaten, data.ingredients);

  const bpZiel = {};
  const anpassungen = [];
  for (const r of ROLLEN) {
    if (!state.zutaten[r]?.length) continue;
    let bp = st.bp?.[r]?.median;
    let quelle = 'korpus';
    if (bp == null || bp === 0) { bp = FALLBACK_BP[r]; quelle = 'schätzung'; }
    bpZiel[r] = { bp, quelle };
  }

  if (bpZiel.trieb && props.trieb?.trieb_typ === 'chemisch_basisch') {
    bpZiel.trieb.bp = bpZiel.trieb.bp / 3;
    anpassungen.push('Natron ist ~3× so stark wie Backpulver → Menge gedrittelt.');
  } else if (bpZiel.trieb && props.fluessigkeit?.saeure) {
    bpZiel.trieb.bp *= 0.85;
    anpassungen.push(`${props.fluessigkeit.label} ist sauer und liefert zusätzliches CO₂ → Backpulver um 15 % reduziert.`);
  }
  if (bpZiel.struktur && props.struktur && props.struktur.unterkategorie === 'nuss') {
    anpassungen.push('Nüsse als alleinige Struktur: Kuchen wird sehr feucht und bindet schwach.');
  }
  if (props.fett?.aggregat === 'fluessig' && bpZiel.fett?.quelle === 'korpus' && st.n > 0 && !st.fettTyp?.fluessig) {
    anpassungen.push('Im Referenz-Korpus gibt es kein Öl-Rezept — der Fettanteil stammt von Butter-Rezepten. Öl ist 100 % Fett (Butter 82 %) → 10 % weniger nehmen.');
    bpZiel.fett.bp *= 0.9;
  }

  const summeBp = Object.values(bpZiel).reduce((a, b) => a + b.bp, 0);
  const teigmasse = vessel.teigmasse_g;
  // Eine Rolle kann mehrere Zutaten tragen (z. B. Fett aus Butter + Öl) — die
  // Rollen-Bäckerprozent wird proportional zu den Anteilen auf mehrere Zeilen verteilt.
  const zutatenListe = ROLLEN.filter((r) => bpZiel[r]).flatMap((r) => {
    const entries = (state.zutaten[r] || []).filter((e) => e?.zutat && data.ingredients[e.zutat]);
    const sumAnteile = entries.reduce((a, e) => a + (e.anteil || 1), 0) || 1;
    const grams = (bpZiel[r].bp / summeBp) * teigmasse;
    const rolle = arch.rollen.find((x) => x.rolle === r);
    return entries.map((e) => {
      const ing = data.ingredients[e.zutat];
      const anteilAnteil = (e.anteil || 1) / sumAnteile;
      const gramsIng = grams * anteilAnteil;
      const anzeige = fromGrams(e.zutat, ing, gramsIng);
      return {
        rolle: r,
        rolleLabel: rolle?.label ?? r,
        zutat: e.zutat,
        label: ing?.label ?? e.zutat,
        gramm: gramsIng,
        bp: bpZiel[r].bp * anteilAnteil,
        bpQuelle: bpZiel[r].quelle,
        anteilProzent: entries.length > 1 ? Math.round(anteilAnteil * 100) : null,
        korpus: st.bp?.[r] ?? null,
        ...anzeige,
      };
    });
  });

  const round5 = (x) => Math.round(x / 5) * 5;
  const kb = st.backen || {};
  const ausKorpus = st.n >= 3 && kb.minuten?.median != null;
  const tempOU = ausKorpus && kb.tempOU?.median != null ? round5(kb.tempOU.median) : vessel.basis.tempOU;
  const tempUmluft = ausKorpus && kb.tempUmluft?.median != null ? round5(kb.tempUmluft.median) : ausKorpus ? tempOU - 20 : vessel.basis.tempUmluft;
  let minuten = ausKorpus ? Math.round(kb.minuten.median) : vessel.basis.minuten;
  const backHinweise = [...(vessel.hinweise || [])];
  if (ausKorpus) {
    backHinweise.unshift(`Median aus ${st.n} Rezepten (Spanne ${Math.round(kb.minuten.min)}–${Math.round(kb.minuten.max)} Min.); Gefäß-Referenz wäre ${vessel.basis.tempOU} °C / ${vessel.basis.minuten} Min.`);
  }
  if (props.fett?.aggregat === 'fluessig' || res.schritte.some((s) => s.key === 'schmelzen')) {
    minuten = Math.round(minuten * 0.95);
    backHinweise.unshift('Öl-/Schmelzfett-Teige sind oft 5 % schneller gar → Zeit um 5 % gekürzt.');
  }

  const ablauf = res.schritte.map((s, i) => ({
    nr: i + 1,
    key: s.key,
    label: konkretisiere(s.op.label, props),
    typ: s.op.typ,
    verb: s.op.verb,
    intensitaet: s.op.intensitaet ?? null,
    verteilung: s.op.verteilung ?? null,
    zusatzVerben: s.op.zusatzverben || [],
    variante: s.op.variante,
    // Ein Schritt ist Zutat + Behandlung: welche belegten Rollen wirkt diese Operation auf?
    zutatKategorien: [...new Set((s.op.auf || []).map((r) => props[r]?.kategorie).filter(Boolean))],
    eingefuegt: s.eingefuegt,
    wirkung: s.op.wirkung,
    risiko: s.op.risiko ?? null,
    dauer: s.op.dauer_min ?? null,
  }));

  return {
    variante,
    varianteLabel: arch.varianten[variante]?.label,
    korpusN: st.n,
    methodKey,
    method,
    status: res.status,
    gruende: res.gruende,
    warnungen: res.warnungen,
    // Kaskaden-Vorschläge (DR-019/T26): Ersatzkandidaten für Rollen, die eine harte
    // Kollision auflösen könnten, wenn sie nicht `gesetzt-fix` sind. Reine Daten, noch
    // keine Übernahme — die UI dazu (Vorschlagen-dann-bestätigen) kommt in T27.
    kaskaden: res.kaskaden,
    // Override-fähige Blockaden (DR-019 Punkt 4, T25): welche hart-Bedingungen der Nutzer
    // bewusst überschreiben kann. Die Erfassung selbst passiert in der UI (`recipeCard.js`).
    blockaden: res.blockaden,
    anpassungen,
    evals,
    zutatenListe,
    rollenBp: bpZiel,
    teigmasse,
    backen: { tempOU, tempUmluft, minuten, hinweise: backHinweise },
    ablauf,
    vessel,
    lehrbuch: arch.lehrbuch,
  };
}

function konkretisiere(label, props) {
  const n = (r) => props[r]?.kurzlabel?.replace(/\s*\(.*?\)/, '') ?? null;
  return label
    .replace('Fett + Zucker', `${n('fett') ?? 'Fett'} + ${n('suesse') ?? 'Zucker'}`)
    .replace('Eier + Zucker', `Eier + ${n('suesse') ?? 'Zucker'}`)
    .replace('Trockenes abwechselnd mit Flüssigkeit', `Mehl abwechselnd mit ${n('fluessigkeit') ?? 'Flüssigkeit'}`)
    .replace('Einlage', n('einlage') ?? 'Einlage')
    .replace('Einlegen', props.einlage ? `${n('einlage')} in ${n('aroma') === 'Rum' ? 'Rum' : 'Flüssigkeit'} einlegen` : 'Einlegen')
    .replace(/^Schmelzen$/, `${n('fett') ?? 'Fett'} schmelzen`);
}
