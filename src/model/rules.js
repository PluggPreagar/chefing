import { beschreibeGrenze } from './bilanz.js';
import { aggregatAus, formVon, cremigAus, erfuellt, standardBereich, FORM_LABEL } from './eigenschaften.js';
import { temperaturBereich, fmtTemperatur, grad } from './temperatur.js';
// Eine Rolle kann mehrere Zutaten mit relativen Anteilen tragen (z. B. Fett
// aus Butter + Öl gemischt). propsOf liefert pro Rolle ein geblendetes
// Eigenschafts-Objekt: Aggregatzustand/Schmelzpunkt/Label folgen der
// anteilsstärksten Zutat (Dominante), boolesche Eigenschaften, die "reicht
// wenn irgendeine Zutat sie hat" bedeuten (saeure, bildet_gluten,
// quellfaehig), werden ODER-verknüpft über alle gewählten Zutaten.
// Aktiver Archetyp: compute() setzt data.arch. Ohne (z. B. Regel-Katalog, T29) zählt der erste
// Archetyp mit Rollen; Rollen-Labels werden dann über alle Archetypen gesucht (T06).
const archVon = (data) => data.arch ?? Object.values(data.archetypes).find((a) => a?.rollen);
const alleRollen = (data) => [...(data.arch?.rollen ?? []), ...Object.values(data.archetypes).flatMap((a) => a?.rollen ?? [])];
const rollenLabelVon = (data, rolle) => alleRollen(data).find((r) => r.rolle === rolle)?.label ?? rolle;

// `temperatur` (Bereich, optional, T62): Aggregat und Form folgen ihr (eigenschaften.js); ohne sie gilt das Aggregat der Zutat.
export function blendProps(entries, ingredients, temperatur = null, benannt = null) {
  const valid = (entries || []).filter((e) => e?.zutat && ingredients[e.zutat]);
  if (!valid.length) return null;
  const sumAnteile = valid.reduce((a, e) => a + (e.anteil || 1), 0) || 1;
  const dominant = valid.reduce((a, b) => ((b.anteil || 1) > (a.anteil || 1) ? b : a));
  const domIng = ingredients[dominant.zutat];
  const anteile = valid.map((e) => ({
    zutat: e.zutat,
    anteil: e.anteil || 1,
    anteilProzent: ((e.anteil || 1) / sumAnteile) * 100,
    ...ingredients[e.zutat],
  }));
  const gemischt = valid.length > 1;
  const aggregat = aggregatAus(temperatur, domIng);
  return {
    key: dominant.zutat,
    ...domIng,
    ...(temperatur ? { aggregat, form: formVon(domIng, aggregat), cremig_schlagbar: cremigAus(temperatur, domIng, benannt), temperatur } : {}),
    label: gemischt ? anteile.map((a) => `${a.label} (${Math.round(a.anteilProzent)} %)`).join(' + ') : domIng.label,
    kurzlabel: gemischt ? anteile.map((a) => a.label).join(' + ') : domIng.label,
    gemischt,
    anteile,
    saeure: valid.some((e) => ingredients[e.zutat].saeure),
    bildet_gluten: valid.some((e) => ingredients[e.zutat].bildet_gluten === true),
    quellfaehig: valid.some((e) => ingredients[e.zutat].quellfaehig === true),
    trieb_typ: valid.some((e) => ingredients[e.zutat].trieb_typ === 'chemisch_basisch')
      ? 'chemisch_basisch'
      : valid.some((e) => ingredients[e.zutat].trieb_typ === 'chemisch_doppelt')
        ? 'chemisch_doppelt'
        : domIng.trieb_typ,
  };
}

// ctx = { benannt: temperaturen.json, zutatTemp: { rolle: Temperatur-Angabe } } (T62): ohne Angabe je Rolle gilt der unterstellte
// Bereich; ohne `benannt` bleiben die Eigenschaften wie in der Zutaten-Datei.
export function propsOf(zutaten, ingredients, ctx = {}) {
  const standard = ctx.benannt ? standardBereich(ctx.benannt) : null;
  const out = {};
  for (const [rolle, entries] of Object.entries(zutaten)) {
    const genannt = ctx.zutatTemp?.[rolle] != null ? temperaturBereich(ctx.zutatTemp[rolle], ctx.benannt) : null;
    out[rolle] = blendProps(entries, ingredients, genannt ?? standard, ctx.benannt);
  }
  return out;
}

// rolle "!x": existenziell über alle Rollen außer x ("irgendwo sonst gilt eigenschaft=wert") —
// generischer Ausdruck für Kombinations-Regeln zwischen Rollen (DR-002-Risiko, DR-019/T22).
// Exportiert, weil engine.js dieselbe Bedingungsprüfung für die Erfahrungs-Regeln braucht (T23).
export function pruefeBedingung(b, props) {
  if (b.rolle?.startsWith('!')) {
    const ausser = b.rolle.slice(1);
    const treffer = Object.entries(props).some(([r, p]) => r !== ausser && erfuellt(b, p?.[b.eigenschaft]));
    return { ok: treffer, ist: treffer ? String(b.wert ?? b.mindestens ?? b.hoechstens) : 'nirgends' };
  }
  const ing = props[b.rolle];
  if (!ing) return { ok: false, ist: 'nicht belegt' };
  if (b.eigenschaft === 'temperatur') return pruefeTemperatur(b, ing, props);
  const ist = ing[b.eigenschaft];
  return { ok: erfuellt(b, ist), ist: ist == null ? 'unbekannt' : String(ist) };
}

// Temperatur-Anforderung (T63, DR-034): `hoechstens` / `mindestens` als Zahl oder abgeleitet aus einer Eigenschaft einer anderen Rolle
// (`{von: {rolle, feld}}`, z. B. das Absterben der Hefe in `trieb`). Der Temperatur-Bereich der Rolle muss GANZ darunter bzw. darüber
// liegen; ganz daneben = nicht erfüllt, dazwischen = unbestimmt (im Zweifel Warnung). Ohne Grenze (Backpulver statt Hefe) oder ohne
// Temperatur-Daten (alter Aufruf) gilt die Anforderung als erfüllt.
function pruefeTemperatur(b, ing, props) {
  const t = ing.temperatur;
  const grenze = (spec) => (typeof spec === 'number' ? spec : spec?.von ? props[spec.von.rolle]?.[spec.von.feld] : undefined);
  const hoch = grenze(b.hoechstens);
  const tief = grenze(b.mindestens);
  if (!t || (typeof hoch !== 'number' && typeof tief !== 'number')) return { ok: true, ist: 'unbekannt' };
  const ganz = (typeof hoch !== 'number' || t.max <= hoch) && (typeof tief !== 'number' || t.min >= tief);
  const daneben = (typeof hoch === 'number' && t.min > hoch) || (typeof tief === 'number' && t.max < tief);
  const grenzText = typeof hoch === 'number' ? { hoechstens: hoch } : { mindestens: tief };
  if (ganz) return { ok: true, ist: fmtTemperatur(t), ...grenzText };
  return { ok: false, ist: daneben ? fmtTemperatur(t) : 'unbestimmt', ...grenzText };
}

// Ist eine Rolle für automatische Anpassung gesperrt? Entweder ganz fixiert (T24), oder
// mindestens eine einzelne Zutat darin fixiert (T31) — letzteres reicht schon, weil eine
// Kaskade (T26) die Rolle immer komplett ersetzt und dabei die fixierte Zutat verlieren würde.
export function rolleIstGesperrt(fixiert, rolle) {
  if (fixiert?.rollen?.[rolle]) return true;
  const zutaten = fixiert?.zutaten?.[rolle];
  return !!zutaten && Object.values(zutaten).some(Boolean);
}

// Beschreibt, WAS für eine Rolle fixiert ist (für die Konflikt-Kennzeichnung unten): die ganze
// Rolle (T24) oder einzelne Zutaten darin (T31, z. B. nur die Butter in einem Butter+Öl-Mix).
// Bei einer Zutat-Fixierung zählt nur eine Zutat, die für DIESE Bedingung tatsächlich
// verantwortlich ist — sonst würde z. B. das Fixieren von Backpulver fälschlich als Grund für
// die Natron-Säure-Kollision erscheinen, obwohl Backpulver damit gar nichts zu tun hat.
function ermittleFixierung(fixiert, b, props, data) {
  const istGuard = b.rolle?.startsWith('!');
  const rolle = istGuard ? b.wenn?.rolle : b.rolle;
  if (!rolle) return null;
  const rolleLabel = rollenLabelVon(data, rolle);
  if (fixiert?.rollen?.[rolle]) return { rolleLabel, zutatLabel: null };

  const gepinnt = fixiert?.zutaten?.[rolle] || {};
  if (!Object.values(gepinnt).some(Boolean)) return null;

  // Verantwortlich: bei "wenn" die Zutat(en), die die Guard-Bedingung selbst auslösen (z. B.
  // Natron für trieb_typ=chemisch_basisch); sonst die dominante Zutat, die den geblendeten Wert
  // bestimmt (blendProps übernimmt aggregat/cremig_schlagbar/… 1:1 von ihr, nicht ODER-verknüpft).
  const anteile = props[rolle]?.anteile ?? (props[rolle] ? [{ zutat: props[rolle].key }] : []);
  const verantwortlich = istGuard
    ? anteile.filter((e) => data.ingredients[e.zutat]?.[b.wenn.eigenschaft] === b.wenn.wert).map((e) => e.zutat)
    : props[rolle]?.key ? [props[rolle].key] : [];
  const relevantGepinnt = verantwortlich.filter((z) => gepinnt[z]);
  if (!relevantGepinnt.length) return null;
  return { rolleLabel, zutatLabel: relevantGepinnt.map((z) => data.ingredients[z]?.label ?? z).join(' + ') };
}

export function checkOperation(op, props, operations, fixiert = {}, data = null) {
  const fehlend = [];
  const empfehlungen = [];
  for (const b of op.voraussetzung || []) {
    // "wenn": Voraussetzung gilt nur, sofern diese Guard-Bedingung erfüllt ist (sonst nicht anwendbar).
    if (b.wenn && !pruefeBedingung(b.wenn, props).ok) continue;
    const r = pruefeBedingung(b, props);
    if (r.ok) continue;
    if ((b.strenge || 'hart') === 'frei') continue; // legitime Variante — kein Hinweis
    // Im Zweifel Warnung (T62): ist die Eigenschaft aus der Temperatur nicht sicher gegeben (`unbestimmt`), wird nichts verboten und
    // keine Vorbereitung eingefügt — es bleibt ein Hinweis mit der Temperatur.
    if (r.ist === 'unbestimmt') {
      empfehlungen.push({ ...b, ist: r.ist, strenge: 'empfohlen', unsicher: true, temperatur: props[b.rolle]?.temperatur ?? null, ...(r.hoechstens !== undefined ? { hoechstens: r.hoechstens } : {}), ...(r.mindestens !== undefined ? { mindestens: r.mindestens } : {}) });
      continue;
    }
    const strenge = b.strenge || 'hart';
    // Konflikt-Kennzeichnung (DR-019 Punkt 3/T24, Zutat-Ebene T31): eine gesperrte Rolle (oder
    // eine verantwortliche Zutat darin) wird nie automatisch angepasst (die eigentliche
    // Ersatzsuche kommt erst in T26) — hier wird nur sichtbar gemacht, WAS die Kollision
    // verursacht: die Rolle der Bedingung selbst, oder — bei "wenn"-Bedingungen — die Rolle,
    // deren fixierte Wahl die Voraussetzung überhaupt erst ausgelöst hat (z. B. Trieb=Natron fix).
    const fixInfo = data ? ermittleFixierung(fixiert, b, props, data) : null;
    const eintrag = { ...b, ist: r.ist, strenge, fixiert: fixInfo, ...(r.hoechstens !== undefined ? { hoechstens: r.hoechstens } : {}), ...(r.mindestens !== undefined ? { mindestens: r.mindestens } : {}) };
    if (strenge === 'empfohlen') empfehlungen.push(eintrag);
    else fehlend.push(eintrag);
  }
  if (!fehlend.length) return { ok: true, fehlend: [], empfehlungen, vorbereitung: null };

  const prepKey = op.vorbereitung_falls_nicht;
  if (prepKey && operations[prepKey]) {
    const prep = checkOperation(operations[prepKey], props, operations, fixiert, data);
    if (prep.ok) return { ok: true, fehlend, empfehlungen, vorbereitung: prepKey };
  }
  return { ok: false, fehlend, empfehlungen, vorbereitung: null };
}

// Generisch: eine Vorbereitungs-Operation kann in operations.json deklarieren, welche
// Eigenschaften sie an welchen Rollen ändert (`wirkt_auf_eigenschaften`), statt den
// Effekt hier an ihrem Schlüssel festzumachen (DR-002-Risiko, DR-019/T22).
// `temperatur` im Patch (T62): neue Temperatur der Rolle (Angabe wie überall, auch abgeleitet aus einer Zutat-Eigenschaft); Aggregat und
// Form werden daraus neu bestimmt, danach gelten die übrigen Felder des Patches. Ohne `data` (alter Aufruf) entfällt die Temperatur.
export function nachVorbereitung(prepKey, props, operations, data = null) {
  const patch = operations[prepKey]?.wirkt_auf_eigenschaften;
  if (!patch) return props;
  const next = { ...props };
  for (const [rolle, changes] of Object.entries(patch)) {
    if (!next[rolle]) continue;
    const { temperatur: spec, ...rest } = changes;
    let neu = next[rolle];
    const bereich = spec != null && data ? temperaturBereich(spec, data.temperaturen, next) : null;
    if (bereich) {
      const ing = data.ingredients[neu.key];
      const aggregat = aggregatAus(bereich, ing);
      neu = { ...neu, temperatur: bereich, aggregat, form: formVon(ing, aggregat), cremig_schlagbar: cremigAus(bereich, ing, data.temperaturen) };
    }
    next[rolle] = { ...neu, ...rest };
  }
  return next;
}

function rollenBelegt(op, props) {
  const rollen = op.auf || [];
  if (!rollen.length) return true;
  return rollen.some((r) => props[r]);
}

function brauchtEinlegen(props) {
  return props.einlage?.quellfaehig === true;
}

// Ersatzkandidat für eine Kaskade (DR-019/T26): erste Option der Zielrolle (in der
// deklarierten Reihenfolge aus archetypes.json), die die geforderte Eigenschaft erfüllt.
// Reine Berechnung — keine State-Mutation, das Ergebnis ist nur ein Vorschlag (siehe T27).
function findKaskadeKandidat(zielRolleKey, eigenschaft, wert, data) {
  const rolle = archVon(data).rollen.find((r) => r.rolle === zielRolleKey);
  if (!rolle) return null;
  const key = rolle.optionen.find((k) => data.ingredients[k]?.[eigenschaft] === wert);
  if (!key) return null;
  return { rolle: zielRolleKey, rolleLabel: rolle.label, zutat: key, zutatLabel: data.ingredients[key].label };
}

// Optionale Techniken (DR-041, techniken.json): eine eingeschaltete Technik, die zur Methode passt, baut deren
// Schritte um. Eier getrennt: die Schritte der Rolle bekommen nur noch den Rest-Teil (Eigelb), Trennen kommt als
// Startschritt davor, Schlagen + Unterheben vor den ersten `vor`-Schritt; Vorgänger-Kanten werden mitgezogen.
// Stufe einer Technik je Variante (DR-042): typisch | moeglich (Standard) | aus
export const technikStufe = (arch, variante, key) => arch?.varianten?.[variante]?.techniken?.[key] ?? 'moeglich';

// Nur eingeschaltete Techniken, die in dieser Variante nicht „aus“ sind
export function wirksameTechniken(techniken, arch, variante) {
  return Object.fromEntries(Object.entries(techniken || {}).filter(([k, an]) => an && technikStufe(arch, variante, k) !== 'aus'));
}

export function mitTechniken(method, techniken = {}, data = {}) {
  let m = method;
  for (const key of method.techniken || []) {
    const t = data.techniken?.[key];
    if (techniken?.[key] && t) m = technikAnwenden(m, t, data.operations || {});
  }
  return m;
}

function technikAnwenden(m, t, operations) {
  const keyVon = (e) => (typeof e === 'object' ? e.key : e);
  const opVon = (e) => (typeof e === 'object' ? e : operations[e] && { ...operations[e], key: e });
  // Ein Technik-Schritt weicht aus, wenn die Methode seinen Arbeitsplatz schon belegt (Pancakes: Schüssel 2 → Schüssel 3)
  const belegt = new Set(m.sequenz.map((e) => m.orte?.[keyVon(e)] ?? opVon(e)?.ort).filter(Boolean));
  const ausweichen = (s) => (s.ort_ausweich && belegt.has(s.ort) ? { ...s, ort: s.ort_ausweich } : s);
  const [trennen, schlagen, unterheben] = [t.schritte.trennen, t.schritte.schlagen, t.schritte.unterheben].map(ausweichen);
  const nach = { ...(m.nach || {}) };
  const istStart = (k) => Array.isArray(nach[k]) && nach[k].length === 0;
  const seq = m.sequenz.map((e) => {
    const op = opVon(e);
    if (!op?.auf?.includes(t.rolle)) return e;
    return { ...op, teil: t.rest, label: op.teil_label?.[t.rest] ?? op.label };
  });
  const erster = seq.findIndex((e) => typeof e === 'object' && e.teil === t.rest);
  const vorIdx = seq.findIndex((e) => t.vor.includes(keyVon(e)));
  if (erster < 0 || vorIdx < 0 || vorIdx <= erster) return m;
  const vorher = seq.slice(0, erster).map(keyVon).filter((k) => !istStart(k)).pop();
  const ersterKey = keyVon(seq[erster]);
  nach[trennen.key] = [];
  nach[ersterKey] = [...(nach[ersterKey]?.length ? nach[ersterKey] : vorher ? [vorher] : []), trennen.key];
  const davor = keyVon(seq[vorIdx - 1]);
  for (const [k, v] of Object.entries(nach)) if (v.includes(davor)) nach[k] = v.map((x) => (x === davor ? unterheben.key : x));
  nach[schlagen.key] = [trennen.key, davor];
  nach[unterheben.key] = [davor, schlagen.key];
  const sequenz = [...seq.slice(0, erster), trennen, ...seq.slice(erster, vorIdx), schlagen, unterheben, ...seq.slice(vorIdx)];
  return { ...m, sequenz, nach };
}

export function resolveMethod(methodKey, zutaten, gefaessKey, data, fixiert = {}, zutatTemp = null, techniken = {}) {
  const method = mitTechniken(data.methods[methodKey], techniken, data);
  const vessel = data.vessels[gefaessKey];
  let props = propsOf(zutaten, data.ingredients, { benannt: data.temperaturen, zutatTemp });
  const schritte = [];
  const gruende = [];
  const warnungen = [];
  const kaskaden = [];
  const blockaden = [];
  let status = 'ok';

  // Natron-Säure-Check ist keine Sonderfall-Prüfung mehr hier, sondern eine reguläre
  // `hart`-Voraussetzung an der Operation "backen" in operations.json (DR-019/T22) —
  // wird unten in der Sequenzschleife wie jede andere Voraussetzung geprüft.

  // Gluten-Warnung (früher hier hartcodiert, nur dominante Zutat) ist jetzt die quantitative
  // Grenze `gluten_min` in grenzen.json (T36) — wirkt auch auf Mischungen wie Mehl + Stärke.

  if (props.fett?.gemischt && new Set(props.fett.anteile.map((a) => a.aggregat)).size > 1) {
    warnungen.push(`Gemischtes Fett (${props.fett.kurzlabel}): der flüssige Anteil schlägt beim Aufschlagen weniger Luft ein als reines festes Fett — Ergebnis liegt zwischen Creme- und Rühr-Öl-Methode.`);
  }

  // Ablauf als Graph (T38): jeder Schritt bekommt `nach` (Vorgänger-keys). Explizit aus
  // method.nach, sonst linear: letzter vorhandener Schritt, der nicht selbst Startschritt ist.
  const startKeys = new Set();
  const vorgaenger = (key) => {
    const vorhanden = schritte.map((s) => s.key);
    const explizit = method.nach?.[key];
    if (explizit) {
      if (!explizit.length) { startKeys.add(key); return []; }
      const da = explizit.filter((k) => vorhanden.includes(k));
      if (da.length) return da;
    }
    const letzter = [...vorhanden].reverse().find((k) => !startKeys.has(k));
    return letzter ? [letzter] : [];
  };

  for (const entry of method.sequenz) {
    const inline = typeof entry === 'object';
    const key = inline ? entry.key : entry;
    const op = inline ? entry : data.operations[key];
    if (!op) continue;
    const optional = (method.optional || []).includes(key);
    if (optional) {
      if (!rollenBelegt(op, props)) continue;
      if (key === 'einlegen' && !brauchtEinlegen(props)) continue;
    }
    const check = checkOperation(op, props, data.operations, fixiert, data);
    let vorbereitungKey = null;
    if (check.ok && check.vorbereitung) {
      // Eingefügte Vorbereitung ist ein Startschritt (z. B. Fett schmelzen geht jederzeit vorher).
      startKeys.add(check.vorbereitung);
      vorbereitungKey = check.vorbereitung;
      schritte.push({ key: check.vorbereitung, op: data.operations[check.vorbereitung], eingefuegt: true, nach: [] });
      props = nachVorbereitung(check.vorbereitung, props, data.operations, data);
      if (status === 'ok') status = 'prep';
      // Nutzer-Vorgabe (2026-09-21, „Purpose not clear"): Zweck zuerst nennen (ein zusätzlicher
      // Schritt wurde eingefügt), Begründung auf eigener Zeile statt hinter einem Doppelpunkt
      // im selben Satz — Titel-Tooltips (siehe morphbox.js) stellen \n als Zeilenumbruch dar.
      warnungen.push(`Zusätzlich notwendiger Schritt „${data.operations[check.vorbereitung].label}“ wurde eingefügt.\n${op.label} braucht ${beschreibeBedingungen(check.fehlend, data)}.`);
    } else if (!check.ok) {
      status = 'invalid';
      gruende.push(`„${op.label}“ ist nicht möglich: braucht ${beschreibeBedingungen(check.fehlend, data)}. ${op.wirkung}`);
      // Kaskaden-Vorschlag (DR-019/T26): nur für hart-Bedingungen mit `kaskade_ziel`, und nur
      // wenn die Zielrolle nicht selbst `gesetzt-fix` ist (T24-Konfliktregel). Reine Berechnung,
      // wird in `computed.kaskaden` bereitgestellt — die Übernahme passiert erst in T27.
      for (const f of check.fehlend) {
        if (!f.kaskade_ziel || rolleIstGesperrt(fixiert, f.kaskade_ziel)) continue;
        const kandidat = findKaskadeKandidat(f.kaskade_ziel, f.eigenschaft, f.wert, data);
        if (!kandidat) continue;
        if (kaskaden.some((k) => k.rolle === kandidat.rolle && k.zutat === kandidat.zutat)) continue;
        kaskaden.push({ ausloeser: op.label, ...kandidat });
      }
      // Override-fähige Blockaden (DR-019 Punkt 4, T25): nur Bedingungen mit `id` können bewusst
      // überschrieben werden — reine Datenstruktur, die Erfassung passiert erst beim Klick in
      // der UI (`recipeCard.js`), hier wird nichts in `localStorage` geschrieben.
      for (const f of check.fehlend) {
        if (!f.id || blockaden.some((b) => b.id === f.id)) continue;
        blockaden.push({ id: f.id, ausloeser: op.label, text: beschreibeBedingungen([f], data) });
      }
    } else if (check.empfehlungen?.length) {
      const normal = check.empfehlungen.filter((e) => !e.unsicher);
      const unsicher = check.empfehlungen.filter((e) => e.unsicher);
      if (normal.length) warnungen.push(`${op.label}: ${beschreibeBedingungen(normal, data)} empfohlen, aber nicht zwingend — Ergebnis kann etwas abweichen.`);
      if (unsicher.length) warnungen.push(`${op.label}: ${unsicherText(unsicher, props, data)}`);
    }
    const nach = vorgaenger(key).filter((k) => k !== vorbereitungKey);
    schritte.push({ key, op, eingefuegt: false, nach: vorbereitungKey ? [...nach, vorbereitungKey] : nach });
  }

  if (vessel && !(method.geeignet_fuer || []).includes(vessel.familie)) {
    warnungen.push(`${method.label} ist für ${vessel.label} untypisch — ${method.warum}`);
  }

  return { methodKey, status, schritte, gruende, warnungen, kaskaden, blockaden };
}

const AGGREGAT = { fest: 'festes', fluessig: 'flüssiges', pulver: 'pulvriges', stueckig: 'stückiges' };
const IST = { fest: 'fest', fluessig: 'flüssig', pulver: 'pulvrig', stueckig: 'stückig', unbestimmt: 'unbestimmt',...FORM_LABEL, true: 'ja', false: 'nein' };

// Anforderung als Text: „flüssiges“, „mindestens kleinteiliges“ (Form), sonst „eigenschaft = wert“
function sollVon(f) {
  if (f.eigenschaft === 'cremig_schlagbar') return 'cremig schlagbares';
  if (f.eigenschaft === 'aggregat') return AGGREGAT[f.wert] ?? f.wert;
  if (f.eigenschaft === 'saeure') return 'saures';
  if (f.eigenschaft === 'temperatur' && typeof f.hoechstens === 'number') return `Temperatur höchstens ${grad(f.hoechstens)} °C für`;
  if (f.eigenschaft === 'temperatur' && typeof f.mindestens === 'number') return `Temperatur mindestens ${grad(f.mindestens)} °C für`;
  if (f.eigenschaft === 'form' && f.mindestens) return `mindestens ${FORM_LABEL[f.mindestens] ?? f.mindestens}es`;
  if (f.eigenschaft === 'form' && f.hoechstens) return `höchstens ${FORM_LABEL[f.hoechstens] ?? f.hoechstens}es`;
  return `${f.eigenschaft} = ${f.wert}`;
}

// Warnung für Anforderungen, die die Temperatur nicht sicher erfüllt (T62): was gebraucht wird, bei welcher Temperatur die Zutat steht und
// wo der Umschlagpunkt liegt (Schmelzpunkt bzw. Bereich zum Aufschlagen).
function unsicherText(liste, props, data) {
  const teile = liste.map((f) => {
    const ing = props[f.rolle];
    let grund = '';
    if (f.eigenschaft === 'aggregat' && typeof ing?.schmelzpunkt_c === 'number') grund = ` (Schmelzpunkt ${grad(ing.schmelzpunkt_c)} °C)`;
    if (f.eigenschaft === 'cremig_schlagbar' && ing?.aufschlag_temp != null) {
      const b = temperaturBereich(ing.aufschlag_temp, data.temperaturen);
      if (b) grund = ` (plastisch bei ${b.min === b.max ? grad(b.min) : `${grad(b.min)}–${grad(b.max)}`} °C)`;
    }
    return `${sollVon(f)} ${rollenLabelVon(data, f.rolle)} nicht sicher gegeben — Temperatur ${fmtTemperatur(f.temperatur) || 'unbekannt'}${grund}`;
  });
  return `${teile.join(', ')}. Im Zweifel vorher herstellen, sonst kann das Ergebnis abweichen.`;
}

function beschreibeBedingungen(fehlend, data) {
  const rollenLabel = (key) => rollenLabelVon(data, key);
  return fehlend
    .map((f) => {
      // "hinweis": optionaler, in der Regel selbst hinterlegter Erklärtext — für Fälle,
      // in denen die generische Formel (Eigenschaft + Rolle) zu unspezifisch wäre.
      let text;
      if (f.hinweis) {
        text = f.hinweis;
      } else {
        const soll = sollVon(f);
        text = f.rolle?.startsWith('!')
          ? `${soll} irgendwo außer bei ${rollenLabel(f.rolle.slice(1))} (ist: ${IST[f.ist] ?? f.ist})`
          : `${soll} ${rollenLabel(f.rolle)} (ist: ${IST[f.ist] ?? f.ist})`;
      }
      // Konflikt-Kennzeichnung (DR-019 Punkt 3/T24, Zutat-Ebene T31): macht sichtbar, dass hier
      // keine automatische Anpassung versucht wurde, weil die Rolle (oder eine Zutat darin)
      // bewusst fixiert ist.
      if (f.fixiert?.zutatLabel) text += ` — „${f.fixiert.zutatLabel}“ (in „${f.fixiert.rolleLabel}“) ist bewusst fixiert 📌 und wird deshalb nicht automatisch geändert`;
      else if (f.fixiert) text += ` — „${f.fixiert.rolleLabel}“ ist bewusst fixiert 📌 und wird deshalb nicht automatisch geändert`;
      return text;
    })
    .join(', ');
}

// Statische Beschreibung einer Voraussetzung, unabhängig von einer konkreten Auswertung — es
// gibt kein "ist" (keine aktuelle Zutatenauswahl), nur die Anforderung selbst. Für den Regel-
// Katalog (DR-019/T29), der unabhängig vom aktuell zusammengeklickten Rezept sein muss.
function beschreibeAnforderung(b, data) {
  if (b.hinweis) return b.hinweis;
  const rollenLabel = rollenLabelVon(data, b.rolle);
  // abgeleitete Temperatur-Grenze: ohne konkrete Zutat nur die Beziehung nennen
  if (b.eigenschaft === 'temperatur' && (b.hoechstens?.von || b.mindestens?.von)) {
    const spec = b.hoechstens?.von ?? b.mindestens.von;
    return `${rollenLabel} nicht ${b.hoechstens?.von ? 'heißer' : 'kühler'}, als die Kultur in „${rollenLabelVon(data, spec.rolle)}“ verträgt`;
  }
  return `${sollVon(b)} ${rollenLabel}`;
}

// Katalog aller überschreibbaren `hart`-Regeln im Datensatz (DR-019/T29): durchsucht
// `operations.json` und die methodenspezifisch inline definierten Operationen aus
// `methods.json`, unabhängig von einer konkreten Zutatenauswahl. Grundlage für die
// Kandidatenliste und die Error-Request-Auswahl — reine Lesefunktion, ändert nichts.
export function alleUeberschreibbarenRegeln(data) {
  const ops = [
    ...Object.values(data.operations).filter((o) => Array.isArray(o?.voraussetzung)),
    ...Object.values(data.methods).flatMap((m) => (Array.isArray(m.sequenz) ? m.sequenz : []).filter((e) => typeof e === 'object')),
  ];
  const katalog = [];
  for (const op of ops) {
    for (const b of op.voraussetzung || []) {
      if (!b.id || (b.strenge && b.strenge !== 'hart')) continue;
      if (katalog.some((k) => k.id === b.id)) continue;
      katalog.push({ id: b.id, ausloeser: op.label, text: beschreibeAnforderung(b, data) });
    }
  }
  // Quantitative Grenzen (grenzen.json, T34/T39): jede hart-Grenze mit `id` ist genauso
  // überschreibbar wie eine hart-Voraussetzung einer Operation.
  for (const liste of Object.values(data.grenzen?.archetypen || {})) {
    for (const g of liste) {
      if (!g.id || g.strenge !== 'hart' || katalog.some((k) => k.id === g.id)) continue;
      katalog.push({ id: g.id, ausloeser: 'Gesamtbilanz', text: beschreibeGrenze(g) });
    }
  }
  return katalog;
}

export function evaluateAll(zutaten, gefaessKey, data, fixiert = {}, zutatTemp = null, techniken = {}) {
  const arch = archVon(data);
  return Object.fromEntries(arch.methoden.map((m) => [m, resolveMethod(m, zutaten, gefaessKey, data, fixiert, zutatTemp, techniken)]));
}

export function bestMethod(evals, methodenHaeufigkeit = {}, gefaessKey, data) {
  const vessel = data.vessels[gefaessKey];
  const rank = (k) => {
    const e = evals[k];
    const geeignet = (data.methods[k].geeignet_fuer || []).includes(vessel?.familie) ? 1 : 0;
    const statusScore = e.status === 'ok' ? 2 : e.status === 'prep' ? 1 : -10;
    return statusScore * 100 + geeignet * 10 + (methodenHaeufigkeit[k] || 0);
  };
  return Object.keys(evals).sort((a, b) => rank(b) - rank(a))[0];
}
