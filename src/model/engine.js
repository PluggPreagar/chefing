import { fromGrams, summarize } from './units.js';
import { evaluateAll, bestMethod, propsOf, pruefeBedingung, rolleIstGesperrt, wirksameTechniken, technikStufe } from './rules.js';
import { zeitFuerSchritt, zeitleiste, zeitMeldung, fmtZeit } from './zeit.js';
import { emulsionsVerlauf } from './emulsion.js';
import { triebQuellen, gasBudget } from './trieb.js';
import { werkzeugWahl, vorhanden } from './ausstattung.js';
import { gaerungModell, gaerungsZeit, hefeFuerGare, gaerungErgebnis, pruefeGaerung, fmtDauer } from './gaerung.js';
import { temperaturBereich, medianBereich, fmtTemperatur, wassertemperatur, grad } from './temperatur.js';
import { bilanz, grenzenPruefen, grenzenFuer, grenzenBuendeln, grenzenKaskade, grenzenMengenKaskade, vorschlaegeZusammenfassen, beitraege, beschreibeGrenze, toleranz, basisLuecke, fmtProzent, GROESSEN, GROESSEN_LABEL } from './bilanz.js';

// Größen, die aus geschätzten Kapazitäten folgen (Natron-Säure-Balance, T37): ihre Grenze trägt die Aussage, kein Vergleich mit den Korpus-Quartilen
const OHNE_TOLERANZ = new Set(['natron', 'saeure']);

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

  const techniken = wirksameTechniken(state.techniken, arch, variante);
  const bezugLabel = arch.bezug_label ?? 'Mehl';
  const evals = evaluateAll(state.zutaten, state.gefaess, data, state.fixiert, state.zutatTemperaturen, techniken, state.zustandWege);
  const autoMethodKey = bestMethod(evals, st.methoden, state.gefaess, data); // was „Auto“ wählen würde, auch bei manueller Wahl (T81)
  const methodKey = state.methode && evals[state.methode] ? state.methode : autoMethodKey;
  const res = evals[methodKey];
  const method = data.methods[methodKey];
  // Eingeschaltete Techniken (DR-041): passt eine nicht zur Methode, wird sie übergangen und gemeldet;
  // lockert sie eine Rolle (Eischnee → Trieb), sagt die Engine, was das für den Trieb heißt (2A: ohne Faktor)
  const technikWarnungen = [];
  const technikHinweise = [];
  const technikIds = []; // Rückmeldungen (T53) sollen wissen, dass mit getrennten Eiern gebacken wurde
  for (const [k, an] of Object.entries(state.techniken || {})) {
    const t = data.techniken?.[k];
    if (!an || !t) continue;
    if (!techniken[k]) { technikWarnungen.push(`${t.label} ist bei ${arch.varianten[variante]?.label ?? 'dieser Variante'} nicht vorgesehen — hier ohne getrennte Eier gerechnet.`); continue; }
    if (!(method.techniken || []).includes(k)) { technikWarnungen.push(`${t.label} passt nicht zur Methode „${method.label}“ — hier ohne getrennte Eier gerechnet.`); continue; }
    technikIds.push(`technik:${k}`);
    const leer = (t.lockert || []).filter((r) => !state.zutaten[r]?.length);
    // Belege (T83): Trieb mit/ohne Technik im Korpus der Variante; sonst die Rezept-Recherche (QUELLEN.md 2026-10-20)
    const tr = st.techniken?.[k]?.trieb;
    const beleg = tr?.mit?.n >= 3 && tr?.ohne?.n >= 3
      ? `${arch.varianten[variante]?.label ?? variante} im Korpus: mit Eischnee ${fmtProzent(tr.mit.median)} g, ohne ${fmtProzent(tr.ohne.median)} g je 100 g Mehl, n = ${tr.mit.n} / ${tr.ohne.n}; über alle Rezepte mit getrennten Eiern 2,7 statt 3,0 g`
      : 'Rezepte mit getrennten Eiern: 2,7 statt 3,0 g je 100 g Mehl';
    technikHinweise.push(leer.length
      ? `${t.label}: der Trieb kommt allein aus dem Eischnee — kräftig steif schlagen, vorsichtig unterheben und sofort backen. Das trägt nur eierreiche Teige (etwa 2 Eier und mehr auf 100 g Mehl).`
      : `${t.label}: der Eischnee lockert zusätzlich zum ${data.ingredients[state.zutaten[t.lockert[0]][0].zutat]?.label ?? 'Trieb'} und ersetzt es nicht — Backpulver bleibt in Rezepten mit Eischnee ähnlich (${beleg}). Der Schnee bringt mehr Luftbläschen, in die das CO₂ beim Backen wandert.`);
  }
  // Mengen aus den Rezepten dieser Methode, wenn es welche gibt (T48); Backzeit, Toleranz-Vergleich und
  // Öl-Deckung bleiben auf der ganzen Variante (Gefäß bzw. „was der Korpus überhaupt kennt“).
  const stM = st.proMethode?.[methodKey] ?? null;
  const stRolle = stM ?? st;
  const props = propsOf(state.zutaten, data.ingredients, { benannt: data.temperaturen, zutatTemp: state.zutatTemperaturen });
  // Zeit-Fenster (DR-024/T44): Dauer je Schritt aus `zeit` (Methode/Erfahrungsregel können sie festlegen
  // bzw. verschieben), sonst `dauer_min`. Früh berechnet: das Gärmodell (T49) braucht die Gärzeit für die Hefemenge.
  const zeiten = res.schritte.map((s) => zeitFuerSchritt(s.key, s.op, method, props, data.erfahrungsregeln));

  const bpZiel = {};
  const anpassungen = [];
  for (const r of rollenKeys) {
    if (!state.zutaten[r]?.length) continue;
    let bp = stRolle.bp?.[r]?.median;
    let quelle = 'korpus';
    // Die Methoden-Zelle kennt die Rolle nicht (Median 0, z. B. Fett im Brot ohne Kneten): erst der Median der Variante, dann der Schätzwert
    if ((bp == null || bp === 0) && stRolle !== st && st.bp?.[r]?.median > 0) bp = st.bp[r].median;
    if (bp == null || bp === 0) { bp = arch.rollen.find((x) => x.rolle === r).fallback_bp; quelle = 'schätzung'; }
    // Rolle mit `menge_je_zutat` (T78, Mayonnaise: Eigelb vs. ganzes Ei): Median der Rezepte mit derselben Zutat, ab 3 Rezepten
    const jeZutat = arch.rollen.find((x) => x.rolle === r).menge_je_zutat && st.bpJeZutat?.[r]?.[state.zutaten[r][0].zutat];
    const zelle = jeZutat?.n >= 3 && jeZutat.median > 0 ? jeZutat : null; // Menge und Spanne aus derselben Zelle (T87)
    if (zelle) { bp = zelle.median; quelle = 'korpus'; }
    bpZiel[r] = { bp, quelle, korpus: zelle };
  }

  // Natron-Drittelung, Säure-Reduktion und Öl-Korpus-Fallback sind keine hartcodierten
  // if/else-Zweige mehr, sondern Daten-Regeln in erfahrungsregeln.json (DR-019/T23).
  anpassungen.push(...wendeErfahrungsregelnAn(bpZiel, props, st, data.erfahrungsregeln));

  // Gärmodell (T49, DR-026): Hefe × Zeit × Temperatur. Gilt für Hefe-Trieb und Methoden ohne Vorteig. Hat die Methode
  // keine Korpus-Rezepte, wird die Hefe aus ihrer Gärzeit gerechnet statt dem Median fremder Methoden zu folgen
  // („start low on yeast is compensated by soak time“); sonst prüft das Modell nur die Plausibilität (unten).
  const modell = gaerungModell(data);
  const gare = gaerungsZeit(res.schritte.map((s, i) => ({ gaerung: s.op.gaerung, dauer: zeiten[i].dauer })));
  const modellGilt = !!modell && bpZiel[modell.rolle]?.bp > 0 && props[modell.rolle]?.trieb_typ === modell.trieb_typ && gare.summe != null;
  // Temperatur der Gare (T52): Vorgabe der Operation; nennt über die Hälfte der Rezepte dieser Methode eine eigene, gilt deren Median.
  const gareSchritt = res.schritte.find((s) => s.op.gaerung === true);
  const genannt = (stM?.gareTemperaturen ?? []).map((t) => temperaturBereich(t, data.temperaturen)).filter(Boolean);
  const gareTemp = stM && genannt.length / stM.n > 0.5 ? medianBereich(genannt) : temperaturBereich(gareSchritt?.op.temperatur, data.temperaturen);
  const gareTempText = fmtTemperatur(gareTemp);
  const gareMindest = zeiten[res.schritte.indexOf(gareSchritt)]?.fenster?.min ?? null; // Mindestzeit der Gare-Operation (T58)
  if (modellGilt && !stM) {
    const hefe = hefeFuerGare(gare.summe, gareTemp?.mitte, modell);
    bpZiel[modell.rolle] = { bp: hefe, quelle: 'berechnet' };
    anpassungen.push(`Keine Rezepte mit „${method.label}“ in dieser Variante: Hefe aus der Gärzeit gerechnet (${fmtDauer(gare.summe)}${gareTempText ? ` bei ${gareTempText}` : ''} → ${hefe.toFixed(1).replace('.', ',')} % Hefe). Richtwert aus dem Gärmodell, Spielraum etwa ×${String(modell.warn_faktor).replace('.', ',')}${modell.exponent_hinweis ? '; der Einfluss der Hefemenge ist nur grob belegt' : ''}.`);
  }

  // Manuell gesetzte Mengen (T40, Bäckerprozent je Rolle, aus „Übernehmen“ bei einem Mengen-Vorschlag): gelten zuletzt
  for (const [r, bp] of Object.entries(state.mengen || {})) {
    if (bpZiel[r] && Number.isFinite(bp) && bp >= 0) bpZiel[r] = { bp, quelle: 'manuell', korpus: bpZiel[r].korpus };
  }
  const gaerungAktiv = modellGilt && bpZiel[modell.rolle].bp > 0; // manuell 0 % Hefe: kein Modell (ln 0)

  if (bpZiel.struktur && props.struktur && props.struktur.unterkategorie === 'nuss') {
    anpassungen.push('Nüsse als alleinige Struktur: Kuchen wird sehr feucht und bindet schwach.');
  }

  const summeBp = Object.values(bpZiel).reduce((a, b) => a + b.bp, 0);
  const teigmasse = vessel.teigmasse_g;
  // Eine Rolle kann mehrere Zutaten tragen (z. B. Fett aus Butter + Öl) — die
  // Rollen-Bäckerprozent wird proportional zu den Anteilen auf mehrere Zeilen verteilt.
  const korpusDerRolle = (r) => bpZiel[r]?.korpus ?? stRolle.bp?.[r] ?? null; // Korpus-Spanne der Rolle, bei `menge_je_zutat` die Zelle der Zutat
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
        korpus: korpusDerRolle(r),
        zustand: (res.zustaende || []).some((z) => z.rolle === r) ? (data.zustaende?.[(res.zustaende || []).find((z) => z.rolle === r).zustand]?.anzeige ?? null) : null, // DR-064
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
  const bpPosten = zutatenListe.map((z) => ({ rolle: z.rolle, zutat: z.zutat, gramm: z.bp }));
  // Grenzen mit Ausnahmen (T85): mit Eischnee oder Schaummasse gelten manche nicht (Ei-Schaum trägt das Gerüst, Zucker im Baiser)
  const grenzen = grenzenFuer(data.grenzen?.archetypen?.[state.archetyp], { methode: methodKey, techniken: technikIds.map((t) => t.replace('technik:', '')) });
  const verletzt = grenzenPruefen(bil, grenzen);
  const groessenMitGrenze = new Set(
    [...verletzt.hart, ...verletzt.empfohlen].map((v) => grenzen.find((g) => g.id === v.id)?.groesse),
  );
  const toleranzHinweise = [];
  const toleranzWarnungen = [];
  const toleranzIds = []; // welche Größen dem Nutzer als „untypisch/ungetestet“ gezeigt wurden (Rückmeldungen, T53)
  // Eine Grenzverletzung erklärt die Korpus-Abweichung meist schon (Stärke allein → Eiweiß-Grenzen);
  // die Bilanz-Tabelle markiert sie weiter, nur der Zusatztext entfällt (T42).
  const hatGrenzverletzung = verletzt.hart.length + verletzt.empfohlen.length > 0;
  const bilanzZeilen = Object.keys(GROESSEN).map((g) => {
    // Toleranz gegen die ganze Variante: die Preset-Zutaten (bestof) gelten je Variante, nicht je Methode —
    // gegen eine kleine Methoden-Zelle meldete schon das Standard-Preset „untypisch“.
    const korpus = st.bilanz?.[g] ?? null;
    let t = toleranz(bil.bp[g], korpus);
    // Fehlt dem Korpus die Vergleichsbasis (T67), ist „untypisch“ keine Aussage: statt Warnung ein Hinweis mit dem Grund
    const luecke = (t === 'ausserhalb_q' || t === 'ausserhalb_spanne') ? basisLuecke(g, { posten: bpPosten, ingredients: data.ingredients, st, rollen: arch.rollen }) : null;
    if (luecke) {
      if (!hatGrenzverletzung && !groessenMitGrenze.has(g) && !OHNE_TOLERANZ.has(g)) {
        toleranzHinweise.push(`${GROESSEN_LABEL[g]} ${fmtProzent(bil.bp[g])} % vom ${bezugLabel}: keine Vergleichsbasis im Korpus (${luecke}) — die Abweichung sagt hier wenig.`);
        toleranzIds.push(`basis:${g}`);
      }
      t = 'keine_basis';
    }
    if (!hatGrenzverletzung && !groessenMitGrenze.has(g) && !OHNE_TOLERANZ.has(g) && (t === 'ausserhalb_q' || t === 'ausserhalb_spanne')) {
      const wert = fmtProzent(bil.bp[g]);
      const text = t === 'ausserhalb_spanne'
        ? `${GROESSEN_LABEL[g]} ${wert} % vom ${bezugLabel} liegt außerhalb aller ${korpus.n} Korpus-Rezepte (${fmtProzent(korpus.min)}–${fmtProzent(korpus.max)} %) — ungetestete Kombination.`
        : `${GROESSEN_LABEL[g]} ${wert} % vom ${bezugLabel} ist untypisch (Korpus Q1–Q3: ${fmtProzent(korpus.q1)}–${fmtProzent(korpus.q3)} %).`;
      (t === 'ausserhalb_spanne' ? toleranzWarnungen : toleranzHinweise).push(text);
      toleranzIds.push(`toleranz:${g}`);
    }
    // Herkunft nach Rollen (T41): welche Rolle liefert wie viel dieser Größe
    const herkunft = beitraege(zutatenListe, data.ingredients, g).map((b) => ({ rolle: b.rolle, label: arch.rollen.find((r) => r.rolle === b.rolle)?.label ?? b.rolle, anteil: b.anteil }));
    return { groesse: g, label: GROESSEN_LABEL[g], gramm: bil.gramm[g], bp: bil.bp[g], korpus, toleranz: t, herkunft };
  });
  const gebuendelt = grenzenBuendeln(verletzt);
  const status = verletzt.hart.length ? 'invalid' : res.status;

  // T39: hart-Grenzen werden überschreibbar (Override-Feedback, DR-019 Punkt 4) und jede
  // verletzte Grenze mit `kaskade_ziel` bekommt einen simulierten Ersatz-Vorschlag — gleiche
  // Datenform wie die Operations-Kaskaden/-Blockaden, damit recipeCard.js sie unverändert zeigt.
  const blockaden = [...(res.blockaden || [])];
  const kaskaden = [...(res.kaskaden || [])];
  const mengenVorschlaege = [];
  for (const v of [...verletzt.hart, ...verletzt.empfohlen]) {
    const g = grenzen.find((x) => x.id === v.id);
    if (!g) continue;
    if (g.strenge === 'hart' && !blockaden.some((b) => b.id === g.id)) {
      blockaden.push({ id: g.id, ausloeser: 'Gesamtbilanz', text: beschreibeGrenze(g) });
    }
    if (!g.kaskade_ziel || rolleIstGesperrt(state.fixiert, g.kaskade_ziel)) continue;
    const rolle = arch.rollen.find((r) => r.rolle === g.kaskade_ziel);
    const kandidat = grenzenKaskade(g, zutatenListe, rolle?.optionen || [], data.ingredients, grenzen, referenzRolle);
    if (!kandidat) {
      // Kein Tausch reicht (T40): Menge der Zielrolle innerhalb der Korpus-Spanne verschieben
      const sp = korpusDerRolle(g.kaskade_ziel);
      const m = grenzenMengenKaskade(g, bpPosten, sp ? { min: sp.min, max: sp.max } : null, data.ingredients, grenzen, referenzRolle);
      if (m) {
        const text = beschreibeGrenze(g);
        const vorh = mengenVorschlaege.find((x) => x.rolle === m.rolle && x.nach === m.nach);
        if (vorh) { if (!vorh.weitere.includes(text) && vorh.ausloeser !== text) vorh.weitere.push(text); vorh.grenzIds.push(g.id); }
        else mengenVorschlaege.push({ ausloeser: text, weitere: [], grenzIds: [g.id], rolle: m.rolle, rolleLabel: rolle?.label ?? m.rolle, von: m.von, nach: m.nach, spanne: sp ? { min: sp.min, max: sp.max } : null });
      }
      continue;
    }
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

  // Mehrere Vorschläge für dieselbe Rolle in dieselbe Richtung zu einem zusammenfassen (T40, bilanz.js)
  const vorschlaegeFertig = vorschlaegeZusammenfassen(mengenVorschlaege, bpPosten, data.ingredients, grenzen, referenzRolle, new Set(verletzt.hart.map((v) => v.id)));

  const round5 = (x) => Math.round(x / 5) * 5;
  // Backwerte aus Rezepten derselben Gefäß-Familie (T91, DR-061): eine Springform erbt nicht die Zeit der Kastenform
  const familienIds = new Set(Object.values(data.vessels).filter((x) => x?.familie && x.familie === vessel.familie).flatMap((x) => x.korpus_ids || []));
  const backListe = st.backenListe ? st.backenListe.filter((b) => familienIds.has(b.gefaess)) : null;
  const kb = backListe ? { tempOU: summarize(backListe.map((b) => b.tempOU)), tempUmluft: summarize(backListe.map((b) => b.tempUmluft)), minuten: summarize(backListe.map((b) => b.minuten)) } : st.backen || {};
  const nBacken = kb.minuten?.n ?? st.n;
  const ausKorpus = nBacken >= 3 && kb.minuten?.median != null;
  // Gefäße ohne Ofen (Pfanne, T06) haben keine Temperaturen, nur `hitze` (Text) und Minuten je Einheit.
  // Gefäße ohne Hitze (Glas für Mayonnaise, T78): `basis: null` — kein Backen, nur die Hinweise des Gefäßs
  const basis = vessel.basis ?? {};
  const ofen = basis.tempOU != null;
  const minutenLabel = basis.minuten_label ?? 'Min.';
  const tempOU = !ofen ? null : ausKorpus && kb.tempOU?.median != null ? round5(kb.tempOU.median) : basis.tempOU;
  const tempUmluft = !ofen ? null : ausKorpus && kb.tempUmluft?.median != null ? round5(kb.tempUmluft.median) : ausKorpus ? tempOU - 20 : basis.tempUmluft;
  let minuten = ausKorpus ? Math.round(kb.minuten.median) : basis.minuten;
  const backHinweise = [...(vessel.hinweise || [])];
  if (ausKorpus) {
    const referenz = ofen ? `${basis.tempOU} °C / ${basis.minuten} Min.` : `${basis.minuten} ${minutenLabel}`;
    backHinweise.unshift(`Median aus ${nBacken} Rezepten (Spanne ${Math.round(kb.minuten.min)}–${Math.round(kb.minuten.max)} ${minutenLabel}); Gefäß-Referenz wäre ${referenz}.`);
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
  // Backen nimmt die berechnete Backzeit; Fenster-Verstöße (zeiten, oben berechnet) werden hier gemeldet.
  const zeitGruende = [];
  const zeitWarnungen = [];
  zeiten.forEach((z, i) => {
    if (z.anpassung && !anpassungen.includes(z.anpassung)) anpassungen.push(z.anpassung);
    if (z.hinweis) (z.hinweis.strenge === 'hart' ? zeitGruende : zeitWarnungen).push(zeitMeldung(res.schritte[i].op, z));
  });
  // Plausibilität (Stufe 1): passen Gärzeit und Hefemenge zusammen? (nach der Berechnung oben trivial erfüllt)
  const gaerPruefung = gaerungAktiv ? pruefeGaerung({ hefeBp: bpZiel[modell.rolle].bp, gare: gare.summe, temp: gareTemp?.mitte, tempText: gareTempText, mindest: gareMindest }, modell) : null;
  if (gaerPruefung) zeitWarnungen.push(gaerPruefung.text);
  const grammVon = (r) => zutatenListe.filter((z) => z.rolle === r).reduce((a, z) => a + (z.gramm || 0), 0); // Linienstärke im Ablauf (DR-043)
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
    // Swimlane-Ansicht (DR-038): Arbeitsplatz, kurzes Tätigkeitswort, gewählte Zutaten je Rolle
    ort: method.orte?.[s.key] ?? s.op.ort ?? 'schuessel',
    aktion: s.op.aktion ?? s.op.label,
    // `teil` (DR-040): nur ein Teil der Zutat (Eigelb) — eigene Rolle `bindung:eigelb`, damit er als eigener Zufluss erscheint
    zutaten: (s.op.auf || []).filter((r) => props[r]).map((r) => {
      const t = s.op.teil && props[r].teile?.[s.op.teil];
      const g = grammVon(r);
      return t ? { rolle: `${r}:${s.op.teil}`, label: t.label, kategorie: props[r].kategorie, icon: t.icon, teil: true, gramm: g * (t.anteil ?? 0.5) }
        : { rolle: r, label: props[r].kurzlabel, kategorie: props[r].kategorie, gramm: g, geteilt: !!s.op.teilt };
    }),
    // Hand- und Wirkzeit (DR-043): passiv = Hände frei während der Dauer (Warten, Backen); Handgriff davor aus aktiv_min
    passiv: s.op.typ === 'warten' || s.op.koch === 'passiv',
    aktivMin: s.op.aktiv_min ?? 0,
    handgriff: s.op.handgriff ?? s.op.aktion ?? s.op.label,
    eingefuegt: s.eingefuegt,
    wirkung: s.op.wirkung,
    risiko: s.op.risiko ?? null,
    skizze: s.op.skizze ?? null, // Erklär-Skizze (DR-055, ui/skizzen.js)
    zustandWeg: s.op.zustandWeg ?? null, // DR-064: gewählter Weg zu einem Soll-Zustand (Vorlauf-Schritt)
    dauer: s.key === 'backen' ? minuten : zeiten[i].dauer,
    zeit: zeiten[i].fenster,
    // Temperatur der Aktion (T52): die Gare zeigt die Temperatur, mit der das Gärmodell rechnet
    temperatur: (s === gareSchritt ? gareTempText : schrittTemperaturText(s.op, data, props)) || null,
  }));
  // Ausstattung (T92, DR-060): Schritt mit Anforderung → schnellstes vorhandenes Werkzeug, Dauer im Verhältnis zum Basis-Werkzeug;
  // ein Schritt, der ein bestimmtes Werkzeug verlangt (Pürierstab-Methode), meldet, wenn es fehlt
  const werkzeugHinweise = [];
  // typische Hilfszutat fehlt (T89): Hinweise aus dem Archetyp, z. B. Mayonnaise ohne Senf
  const archetypHinweise = (arch.hinweise || []).filter((h) => h.wenn_fehlt && !(state.zutaten[h.wenn_fehlt.rolle] || []).some((e) => e.zutat === h.wenn_fehlt.zutat));
  const werkzeugWarnungen = [];
  ablauf.forEach((s, i) => {
    const op = res.schritte[i].op;
    if (op.anforderung && data.werkzeuge) {
      const wahl = werkzeugWahl(op.anforderung, data.werkzeuge, state.ausstattung);
      if (wahl) {
        s.werkzeugWahl = wahl;
        if (wahl.faktor !== 1 && s.dauer != null) {
          s.dauer = Math.round(s.dauer * wahl.faktor * 2) / 2;
          if (wahl.faktor > 1) werkzeugHinweise.push(`${s.label}: mit ${wahl.label} statt ${wahl.basisLabel} etwa ${String(wahl.faktor).replace('.', ',')}× so lange (≈ ${fmtZeit(s.dauer)}).`);
        }
      }
    }
    if (op.werkzeug && data.werkzeuge?.[op.werkzeug] && !vorhanden(data.werkzeuge, state.ausstattung, op.werkzeug)) {
      werkzeugWarnungen.push({ id: `ausstattung:${op.werkzeug}`, text: `${s.label} braucht einen ${data.werkzeuge[op.werkzeug].label}, der nicht in der Ausstattung ist — eine andere Methode wählen.` });
    }
  });
  for (const s of ablauf) {
    s.aktiv = s.passiv ? s.aktivMin : s.dauer ?? 0;
    s.wirk = s.passiv ? s.dauer ?? 0 : 0;
  }
  // Emulsion (DR-047): Basis und Zugabe je Schritt; falsche Zugabe in eine luftige Basis wird gemeldet
  const emulsion = emulsionsVerlauf(res.schritte.map((s, i) => ({ op: s.op, label: ablauf[i].label, ort: ablauf[i].ort })), { werkzeuge: data.werkzeuge, orte: data.orte });
  const emulsionsWarnungen = [];
  const emulsionsHinweise = emulsion.filter((e) => e?.hinweis).map((e) => e.hinweis); // Werkzeug ohne passendes Gefäß (T84)
  // Werkzeug × Zutat (T88): z. B. Pürierstab + natives Olivenöl → kann bitter werden
  const werkzeugIds = [];
  for (const wk of new Set(res.schritte.map((s) => s.op.werkzeug).filter(Boolean))) {
    for (const h of data.werkzeuge?.[wk]?.zutat_hinweise || []) {
      const drin = (props[h.rolle]?.anteile || []).some((a) => a.zutat === h.zutat);
      if (drin) { emulsionsHinweise.push(h.text); werkzeugIds.push(`werkzeug:${wk}:${h.id}`); }
    }
  }
  emulsion.forEach((e, i) => {
    ablauf[i].emulsion = e;
    if (e?.problem) emulsionsWarnungen.push({ id: `emulsion:${ablauf[i].key}`, text: e.problem });
  });
  // Rollen, die keine Operation nennt (Backpulver, Salz, Aroma), kommen mit dem Mehl in den Teig (DR-038)
  const imAblauf = new Set(ablauf.flatMap((s) => s.zutaten.map((z) => z.rolle)));
  const mitMehl = ablauf.find((s) => s.zutaten.some((z) => z.rolle === 'struktur'));
  for (const r of Object.keys(props)) if (props[r] && !imAblauf.has(r)) mitMehl?.zutaten.push({ rolle: r, label: props[r].kurzlabel, kategorie: props[r].kategorie, gramm: grammVon(r) });
  // Triebquellen (T80, DR-049): Zeile „Volumen aus …“ und Warnung, wenn ein Gas bis zum Erhitzen nicht hält
  const trieb = triebQuellen(ablauf, res.schritte.map((s) => s.op), props, data.triebquellen);
  // Gas-Budget (T82, DR-050): Gas je 100 g Teig je Schritt bis zum Erhitzen, Schätzung ohne Dampf
  const gas = gasBudget(ablauf, res.schritte.map((s) => s.op), props, data.triebquellen, { gramm: grammVon, teigmasse });
  gas?.proSchritt.forEach((g, i) => { ablauf[i].gas = g; });
  // T72 (A): wenig oder kein Backpulver haben nur eierreiche Teige ohne Milch (Sandkuchen, Soufflé-Pancakes, Kaiserschmarrn)
  const mehl = grammVon('struktur');
  const eierJe100 = mehl && props.bindung?.umrechnung?.stk ? (grammVon('bindung') / props.bindung.umrechnung.stk / mehl) * 100 : 0;
  if (technikIds.includes('technik:eier_getrennt') && eierJe100 >= 2.5 && grammVon('fluessigkeit') < 0.2 * mehl && state.zutaten.trieb?.length) {
    technikHinweise.push(`Eierreicher Teig ohne viel Milch (${fmtProzent(eierJe100)} Eier je 100 g Mehl) mit Eischnee: solche Rezepte kommen mit wenig oder ganz ohne Backpulver aus (Sandkuchen, Soufflé-Pancakes, Kaiserschmarrn).`);
  }

  // Alle Regeln, die dem Nutzer etwas gesagt haben (Grenzen, Voraussetzungen, Zeit-Fenster, Gärmodell, eingefügte
  // Vorbereitung, Korpus-Toleranz) — jede ist eine Vorhersage; Rückmeldungen („hat es geklappt?“, T53) etikettieren sie.
  const regelIds = [...new Set([
    ...verletzt.hart.map((v) => v.id),
    ...verletzt.empfohlen.map((v) => v.id),
    ...blockaden.map((b) => b.id),
    ...toleranzIds,
    ...res.schritte.filter((s) => s.eingefuegt && !s.op.zustand).map((s) => `prep:${s.key}`), // Soll-Zustand (DR-064) ist keine Regel-Aussage
    ...zeiten.flatMap((z, i) => (z.hinweis ? [`zeit:${res.schritte[i].key}`] : [])),
    ...(gaerPruefung ? ['gaerung_modell'] : []),
    ...technikIds,
    ...emulsionsWarnungen.map((w) => w.id),
    ...trieb.warnungen.map((w) => w.id),
    ...werkzeugIds,
    ...werkzeugWarnungen.map((w) => w.id),
    ...archetypHinweise.map((h) => `archetyp:${h.id}`),
    ...(modellGilt && !stM ? ['gaerung_berechnet'] : []),
  ])];

  return {
    regelIds,
    variante,
    varianteLabel: arch.varianten[variante]?.label,
    korpusN: st.n,
    korpusNMethode: stM?.n ?? null,
    methodKey,
    autoMethodKey,
    method,
    status: zeitGruende.length ? 'invalid' : status,
    gruende: [...res.gruende, ...gebuendelt.hart, ...zeitGruende],
    warnungen: [...res.warnungen, ...technikWarnungen, ...emulsionsWarnungen.map((w) => w.text), ...trieb.warnungen.map((w) => w.text), ...werkzeugWarnungen.map((w) => w.text), ...gebuendelt.empfohlen, ...toleranzWarnungen, ...zeitWarnungen],
    zeit: zeitleiste(ablauf),
    trieb: { zeile: trieb.zeile, quellen: trieb.quellen },
    // Soll-Zustände der Zutaten mit Wegen dorthin (DR-064): an der Zutat statt als Schritt; gewählt = Weg, der als Vorlauf-Schritt im Ablauf steht
    zustaende: (res.zustaende || []).map((z) => { const d = data.zustaende?.[z.zustand] || {}; const wege = (d.wege || []).map((w) => ({ ...w, gesamt_min: w.dauer_min > w.aktiv_min ? w.dauer_min + (w.aktiv_min >= 1 ? w.aktiv_min : 0) : w.dauer_min })); const wahl = state.zustandWege?.[z.rolle]; return { ...z, label: d.label ?? z.zustand, anzeige: d.anzeige ?? z.zustand, pruefen: d.pruefen ?? null, wege, gewaehlt: wege.some((w) => w.key === wahl) ? wahl : null, zutat: props[z.rolle]?.plural ?? props[z.rolle]?.kurzlabel?.replace(/\s*\(.*?\)/, '') ?? z.rolle }; }),
    // Technik-Stufe je Technik, gemessen am Korpus der Variante, wenn er genug Rezepte hat (T83, DR-051)
    technikStufen: Object.fromEntries(Object.keys(data.techniken || {}).filter((k) => !k.startsWith('_')).map((k) => [k, technikStufe(arch, variante, k, st.techniken?.[k] ?? { n: st.n, anteil: 0 })])),
    gas: gas?.zeile ? { gesamt: gas.gesamt, anteile: gas.anteile, zeile: gas.zeile } : null,
    gaerung: gaerungAktiv ? gaerungErgebnis({ gare: gare.summe, hefeBp: bpZiel[modell.rolle].bp, gareTemp, gareTempText, mindest: gareMindest, berechnet: !stM, pruefung: gaerPruefung }, modell) : null,
    toleranzHinweise,
    bilanz: bilanzZeilen,
    // Kaskaden-Vorschläge (DR-019/T26): Ersatzkandidaten für Rollen, die eine harte
    // Kollision auflösen könnten, wenn sie nicht `gesetzt-fix` sind. Reine Daten, noch
    // keine Übernahme — die UI dazu (Vorschlagen-dann-bestätigen) kommt in T27.
    kaskaden,
    // Mengen-Vorschläge (T40): Menge der Zielrolle verschieben, wenn kein Zutaten-Tausch die Grenze löst; Übernehmen setzt `state.mengen`
    mengenVorschlaege: vorschlaegeFertig,
    // Override-fähige Blockaden (DR-019 Punkt 4, T25): welche hart-Bedingungen der Nutzer
    // bewusst überschreiben kann. Die Erfassung selbst passiert in der UI (`recipeCard.js`).
    blockaden,
    anpassungen: [...technikHinweise, ...emulsionsHinweise, ...werkzeugHinweise, ...archetypHinweise.map((h) => h.text), ...anpassungen],
    evals,
    zutatenListe,
    rollenBp: bpZiel,
    teigmasse,
    backen: { tempOU, tempUmluft, minuten, minutenLabel, hitze: basis.hitze ?? null, ohneHitze: !vessel.basis, hinweise: backHinweise },
    // Bezugsgröße der Prozente (T78): Mehl beim Backen, Öl bei der Mayonnaise
    bezugLabel,
    archetypLabel: arch.label,
    ablauf,
    vessel,
    lehrbuch: arch.lehrbuch,
  };
}

// Temperatur-Text einer Aktion (T56): Bereich der Operation, auch abgeleitet aus der gewählten Zutat; beim Kneten zusätzlich
// die Wassertemperatur nach der Faustformel (Mehl und Raum als Raumtemperatur angenommen, Reibung aus `reibung_k`).
function schrittTemperaturText(op, data, props) {
  const b = temperaturBereich(op.temperatur, data.temperaturen, props);
  if (!b) return '';
  const raum = temperaturBereich('raum', data.temperaturen)?.mitte;
  const wasser = op.reibung_k != null && raum != null ? wassertemperatur({ ziel: b.mitte, mehl: raum, raum, reibung: op.reibung_k }) : null;
  return fmtTemperatur(b) + (wasser != null ? ' · Wasser etwa ' + grad(Math.round(wasser)) + ' °C' : '');
}

function konkretisiere(label, props) {
  const n = (r) => props[r]?.kurzlabel?.replace(/\s*\(.*?\)/, '') ?? null;
  return label
    .replace('Fett + Zucker', `${n('fett') ?? 'Fett'} + ${n('suesse') ?? 'Zucker'}`)
    .replace(/^Fett weich/, `${n('fett') ?? 'Fett'} weich`)
    .replace('Eier + Zucker', `Eier + ${n('suesse') ?? 'Zucker'}`)
    .replace('Trockenes abwechselnd mit Flüssigkeit', `Mehl abwechselnd mit ${n('fluessigkeit') ?? 'Flüssigkeit'}`)
    .replace('Einlage', n('einlage') ?? 'Einlage')
    .replace('Einlegen', props.einlage ? `${n('einlage')} in ${n('aroma') === 'Rum' ? 'Rum' : 'Flüssigkeit'} einlegen` : 'Einlegen')
    .replace(/^Schmelzen$/, `${n('fett') ?? 'Fett'} schmelzen`);
}
