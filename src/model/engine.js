import { fromGrams } from './units.js';
import { evaluateAll, bestMethod, propsOf, pruefeBedingung, rolleIstGesperrt } from './rules.js';
import { zeitFuerSchritt, zeitleiste, zeitMeldung } from './zeit.js';
import { bilanz, grenzenPruefen, grenzenBuendeln, grenzenKaskade, beschreibeGrenze, toleranz, fmtProzent, GROESSEN, GROESSEN_LABEL } from './bilanz.js';

export function varianteFuerGefaess(gefaessKey, arch, vessels) {
  const fam = vessels[gefaessKey]?.familie;
  // Erst das Preset-Gefäß selbst (zwei Varianten dürfen sich eine Familie teilen, z. B. zwei Pfannen),
  // dann die Gefäß-Familie (andere Größe derselben Form).
  return Object.entries(arch.varianten).find(([, v]) => v.gefaess === gefaessKey)?.[0]
    ?? Object.entries(arch.varianten).find(([, v]) => vessels[v.gefaess]?.familie === fam)?.[0]
    ?? Object.keys(arch.varianten)[0];
}

// Erfahrungs-Regeln aus Daten (DR-019/T23) statt hartcodierter if/else-Kette: passt den
// Bäckerprozent-Wert einer Rolle an, wenn eine Bedingung gegen die Zutat-Eigenschaften (props)
// zutrifft. Pro Rolle gewinnt nur die ERSTE passende Regel in Deklarationsreihenfolge — das
// bildet die bisherige if/else-if-Priorität nach (z. B. Natron-Drittelung statt zusätzlicher
// Säure-Reduktion, nicht beides multiplikativ übereinander). `begruendung` darf `{rolle}`-
// Platzhalter enthalten, die durch das Label der dominanten Zutat dieser Rolle ersetzt werden.
function wendeErfahrungsregelnAn(bpZiel, props, st, erfahrungsregeln) {
  const angewandtProRolle = new Set();
  const anpassungen = [];
  for (const regel of erfahrungsregeln?.regeln || []) {
    if (!bpZiel[regel.rolle] || angewandtProRolle.has(regel.rolle)) continue;
    if (regel.wenn && !pruefeBedingung(regel.wenn, props).ok) continue;
    if (regel.voraussetzung_quelle && bpZiel[regel.rolle].quelle !== regel.voraussetzung_quelle) continue;
    if (regel.wenn_korpus_fehlt) {
      const { feld, wert } = regel.wenn_korpus_fehlt;
      if (!(st.n > 0) || st[feld]?.[wert]) continue; // Korpus deckt den Fall doch ab -> Regel passt nicht
    }
    bpZiel[regel.rolle].bp *= regel.faktor;
    angewandtProRolle.add(regel.rolle);
    anpassungen.push(regel.begruendung.replace(/\{(\w+)\}/g, (_, r) => props[r]?.label ?? `{${r}}`));
  }
  return anpassungen;
}

export function compute(state, data, korpusStats) {
  const arch = data.archetypes[state.archetyp];
  data = { ...data, arch }; // rules.js liest den aktiven Archetyp aus data.arch (T06)
  const rollenKeys = arch.rollen.map((r) => r.rolle);
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
  for (const r of rollenKeys) {
    if (!state.zutaten[r]?.length) continue;
    let bp = st.bp?.[r]?.median;
    let quelle = 'korpus';
    if (bp == null || bp === 0) { bp = arch.rollen.find((x) => x.rolle === r).fallback_bp; quelle = 'schätzung'; }
    bpZiel[r] = { bp, quelle };
  }

  // Natron-Drittelung, Säure-Reduktion und Öl-Korpus-Fallback sind keine hartcodierten
  // if/else-Zweige mehr, sondern Daten-Regeln in erfahrungsregeln.json (DR-019/T23).
  anpassungen.push(...wendeErfahrungsregelnAn(bpZiel, props, st, data.erfahrungsregeln));

  if (bpZiel.struktur && props.struktur && props.struktur.unterkategorie === 'nuss') {
    anpassungen.push('Nüsse als alleinige Struktur: Kuchen wird sehr feucht und bindet schwach.');
  }

  const summeBp = Object.values(bpZiel).reduce((a, b) => a + b.bp, 0);
  const teigmasse = vessel.teigmasse_g;
  // Eine Rolle kann mehrere Zutaten tragen (z. B. Fett aus Butter + Öl) — die
  // Rollen-Bäckerprozent wird proportional zu den Anteilen auf mehrere Zeilen verteilt.
  const zutatenListe = rollenKeys.filter((r) => bpZiel[r]).flatMap((r) => {
    const entries = (state.zutaten[r] || []).filter((e) => e?.zutat && data.ingredients[e.zutat]);
    const sumAnteile = entries.reduce((a, e) => a + (e.anteil || 1), 0) || 1;
    const grams = (bpZiel[r].bp / summeBp) * teigmasse;
    const rolle = arch.rollen.find((x) => x.rolle === r);
    return entries.map((e) => {
      const ing = data.ingredients[e.zutat];
      const anteilAnteil = (e.anteil || 1) / sumAnteile;
      const gramsIng = (grams * anteilAnteil) / (ing.aequivalent_faktor ?? 1);
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

  // Gesamtbilanz (DR-020/T33) über alle Zutaten-Zeilen, quantitative Grenzen (T34) und
  // Korpus-Toleranz (T35). Die Rollen-Bäckerprozent sind per Konstruktion der Korpus-Median —
  // Abweichungen entstehen erst über die Zutatenwahl (z. B. Schmand statt Milch, Öl statt
  // Butter), und genau die sieht nur die Bilanz. Darum wird die Toleranz auf der Bilanz geprüft.
  const referenzRolle = arch.rollen.find((r) => r.referenz)?.rolle ?? 'struktur';
  const bil = bilanz(zutatenListe, data.ingredients, referenzRolle);
  const grenzen = data.grenzen?.archetypen?.[state.archetyp] || [];
  const verletzt = grenzenPruefen(bil, grenzen);
  const groessenMitGrenze = new Set(
    [...verletzt.hart, ...verletzt.empfohlen].map((v) => grenzen.find((g) => g.id === v.id)?.groesse),
  );
  const toleranzHinweise = [];
  const toleranzWarnungen = [];
  // Eine Grenzverletzung erklärt die Korpus-Abweichung meist schon (Stärke allein → Eiweiß-Grenzen);
  // die Bilanz-Tabelle markiert sie weiter, nur der Zusatztext entfällt (T42).
  const hatGrenzverletzung = verletzt.hart.length + verletzt.empfohlen.length > 0;
  const bilanzZeilen = Object.keys(GROESSEN).map((g) => {
    const korpus = st.bilanz?.[g] ?? null;
    const t = toleranz(bil.bp[g], korpus);
    if (!hatGrenzverletzung && !groessenMitGrenze.has(g) && (t === 'ausserhalb_q' || t === 'ausserhalb_spanne')) {
      const wert = fmtProzent(bil.bp[g]);
      const text = t === 'ausserhalb_spanne'
        ? `${GROESSEN_LABEL[g]} ${wert} % vom Mehl liegt außerhalb aller ${korpus.n} Korpus-Rezepte (${fmtProzent(korpus.min)}–${fmtProzent(korpus.max)} %) — ungetestete Kombination.`
        : `${GROESSEN_LABEL[g]} ${wert} % vom Mehl ist untypisch (Korpus Q1–Q3: ${fmtProzent(korpus.q1)}–${fmtProzent(korpus.q3)} %).`;
      (t === 'ausserhalb_spanne' ? toleranzWarnungen : toleranzHinweise).push(text);
    }
    return { groesse: g, label: GROESSEN_LABEL[g], gramm: bil.gramm[g], bp: bil.bp[g], korpus, toleranz: t };
  });
  const gebuendelt = grenzenBuendeln(verletzt);
  const status = verletzt.hart.length ? 'invalid' : res.status;

  // T39: hart-Grenzen werden überschreibbar (Override-Feedback, DR-019 Punkt 4) und jede
  // verletzte Grenze mit `kaskade_ziel` bekommt einen simulierten Ersatz-Vorschlag — gleiche
  // Datenform wie die Operations-Kaskaden/-Blockaden, damit recipeCard.js sie unverändert zeigt.
  const blockaden = [...(res.blockaden || [])];
  const kaskaden = [...(res.kaskaden || [])];
  for (const v of [...verletzt.hart, ...verletzt.empfohlen]) {
    const g = grenzen.find((x) => x.id === v.id);
    if (!g) continue;
    if (g.strenge === 'hart' && !blockaden.some((b) => b.id === g.id)) {
      blockaden.push({ id: g.id, ausloeser: 'Gesamtbilanz', text: beschreibeGrenze(g) });
    }
    if (!g.kaskade_ziel || rolleIstGesperrt(state.fixiert, g.kaskade_ziel)) continue;
    const rolle = arch.rollen.find((r) => r.rolle === g.kaskade_ziel);
    const kandidat = grenzenKaskade(g, zutatenListe, rolle?.optionen || [], data.ingredients, grenzen, referenzRolle);
    if (!kandidat) continue;
    // Gleicher Ersatz löst mehrere Grenzen: ein Vorschlag, alle Auslöser genannt (T42).
    const vorhanden = kaskaden.find((k) => k.rolle === g.kaskade_ziel && k.zutat === kandidat);
    if (vorhanden) {
      const text = beschreibeGrenze(g);
      vorhanden.weitere ??= [];
      if (vorhanden.ausloeser !== text && !vorhanden.weitere.includes(text)) vorhanden.weitere.push(text);
      continue;
    }
    kaskaden.push({
      ausloeser: beschreibeGrenze(g), rolle: g.kaskade_ziel, rolleLabel: rolle?.label ?? g.kaskade_ziel,
      zutat: kandidat, zutatLabel: data.ingredients[kandidat]?.label ?? kandidat,
    });
  }

  const round5 = (x) => Math.round(x / 5) * 5;
  const kb = st.backen || {};
  const ausKorpus = st.n >= 3 && kb.minuten?.median != null;
  // Gefäße ohne Ofen (Pfanne, T06) haben keine Temperaturen, nur `hitze` (Text) und Minuten je Einheit.
  const ofen = vessel.basis.tempOU != null;
  const minutenLabel = vessel.basis.minuten_label ?? 'Min.';
  const tempOU = !ofen ? null : ausKorpus && kb.tempOU?.median != null ? round5(kb.tempOU.median) : vessel.basis.tempOU;
  const tempUmluft = !ofen ? null : ausKorpus && kb.tempUmluft?.median != null ? round5(kb.tempUmluft.median) : ausKorpus ? tempOU - 20 : vessel.basis.tempUmluft;
  let minuten = ausKorpus ? Math.round(kb.minuten.median) : vessel.basis.minuten;
  const backHinweise = [...(vessel.hinweise || [])];
  if (ausKorpus) {
    const referenz = ofen ? `${vessel.basis.tempOU} °C / ${vessel.basis.minuten} Min.` : `${vessel.basis.minuten} ${minutenLabel}`;
    backHinweise.unshift(`Median aus ${st.n} Rezepten (Spanne ${Math.round(kb.minuten.min)}–${Math.round(kb.minuten.max)} ${minutenLabel}); Gefäß-Referenz wäre ${referenz}.`);
  }
  if (ofen && (props.fett?.aggregat === 'fluessig' || res.schritte.some((s) => s.key === 'schmelzen'))) {
    minuten = Math.round(minuten * 0.95);
    backHinweise.unshift('Öl-/Schmelzfett-Teige sind oft 5 % schneller gar → Zeit um 5 % gekürzt.');
  }

  // Ablauf-Graph (T38): Vorgänger als Schritt-Nummern, `ebene` = längster Pfad vom Start —
  // Schritte gleicher Ebene haben keine Abhängigkeit untereinander (Reihenfolge frei).
  const nrVon = Object.fromEntries(res.schritte.map((s, i) => [s.key, i + 1]));
  const ebenen = [];
  res.schritte.forEach((s, i) => {
    const vor = (s.nach || []).map((k) => nrVon[k]).filter(Boolean);
    ebenen[i] = vor.length ? Math.max(...vor.map((n) => ebenen[n - 1])) + 1 : 0;
  });
  // Zeit-Fenster (DR-024/T44): Dauer je Schritt aus `zeit` (Methode/Erfahrungsregel können sie festlegen
  // bzw. verschieben), sonst `dauer_min`. Backen nimmt die berechnete Backzeit.
  const zeiten = res.schritte.map((s) => zeitFuerSchritt(s.key, s.op, method, props, data.erfahrungsregeln));
  const zeitGruende = [];
  const zeitWarnungen = [];
  zeiten.forEach((z, i) => {
    if (z.anpassung && !anpassungen.includes(z.anpassung)) anpassungen.push(z.anpassung);
    if (z.hinweis) (z.hinweis.strenge === 'hart' ? zeitGruende : zeitWarnungen).push(zeitMeldung(res.schritte[i].op, z));
  });
  const ablauf = res.schritte.map((s, i) => ({
    nr: i + 1,
    nach: (s.nach || []).map((k) => nrVon[k]).filter(Boolean),
    ebene: ebenen[i],
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
    dauer: s.key === 'backen' ? minuten : zeiten[i].dauer,
    zeit: zeiten[i].fenster,
  }));

  return {
    variante,
    varianteLabel: arch.varianten[variante]?.label,
    korpusN: st.n,
    methodKey,
    method,
    status: zeitGruende.length ? 'invalid' : status,
    gruende: [...res.gruende, ...gebuendelt.hart, ...zeitGruende],
    warnungen: [...res.warnungen, ...gebuendelt.empfohlen, ...toleranzWarnungen, ...zeitWarnungen],
    zeit: zeitleiste(ablauf),
    toleranzHinweise,
    bilanz: bilanzZeilen,
    // Kaskaden-Vorschläge (DR-019/T26): Ersatzkandidaten für Rollen, die eine harte
    // Kollision auflösen könnten, wenn sie nicht `gesetzt-fix` sind. Reine Daten, noch
    // keine Übernahme — die UI dazu (Vorschlagen-dann-bestätigen) kommt in T27.
    kaskaden,
    // Override-fähige Blockaden (DR-019 Punkt 4, T25): welche hart-Bedingungen der Nutzer
    // bewusst überschreiben kann. Die Erfassung selbst passiert in der UI (`recipeCard.js`).
    blockaden,
    anpassungen,
    evals,
    zutatenListe,
    rollenBp: bpZiel,
    teigmasse,
    backen: { tempOU, tempUmluft, minuten, minutenLabel, hitze: vessel.basis.hitze ?? null, hinweise: backHinweise },
    archetypLabel: arch.label,
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
