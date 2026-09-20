// Eine Rolle kann mehrere Zutaten mit relativen Anteilen tragen (z. B. Fett
// aus Butter + Öl gemischt). propsOf liefert pro Rolle ein geblendetes
// Eigenschafts-Objekt: Aggregatzustand/Schmelzpunkt/Label folgen der
// anteilsstärksten Zutat (Dominante), boolesche Eigenschaften, die "reicht
// wenn irgendeine Zutat sie hat" bedeuten (saeure, bildet_gluten,
// quellfaehig), werden ODER-verknüpft über alle gewählten Zutaten.
export function blendProps(entries, ingredients) {
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
  return {
    key: dominant.zutat,
    ...domIng,
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

export function propsOf(zutaten, ingredients) {
  const out = {};
  for (const [rolle, entries] of Object.entries(zutaten)) {
    out[rolle] = blendProps(entries, ingredients);
  }
  return out;
}

// rolle "!x": existenziell über alle Rollen außer x ("irgendwo sonst gilt eigenschaft=wert") —
// generischer Ausdruck für Kombinations-Regeln zwischen Rollen (DR-002-Risiko, DR-019/T22).
function pruefeBedingung(b, props) {
  if (b.rolle?.startsWith('!')) {
    const ausser = b.rolle.slice(1);
    const treffer = Object.entries(props).some(([r, p]) => r !== ausser && p?.[b.eigenschaft] === b.wert);
    return { ok: treffer, ist: treffer ? String(b.wert) : 'nirgends' };
  }
  const ing = props[b.rolle];
  if (!ing) return { ok: false, ist: 'nicht belegt' };
  const ist = ing[b.eigenschaft];
  return { ok: ist === b.wert, ist: ist === undefined ? 'unbekannt' : String(ist) };
}

// Ist eine Rolle für automatische Anpassung gesperrt? Entweder ganz fixiert (T24), oder
// mindestens eine einzelne Zutat darin fixiert (T31) — letzteres reicht schon, weil eine
// Kaskade (T26) die Rolle immer komplett ersetzt und dabei die fixierte Zutat verlieren würde.
function rolleIstGesperrt(fixiert, rolle) {
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
  const rolleLabel = data.archetypes.ruehrteig.rollen.find((r) => r.rolle === rolle)?.label ?? rolle;
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
    const strenge = b.strenge || 'hart';
    if (strenge === 'frei') continue; // legitime Variante — kein Hinweis
    // Konflikt-Kennzeichnung (DR-019 Punkt 3/T24, Zutat-Ebene T31): eine gesperrte Rolle (oder
    // eine verantwortliche Zutat darin) wird nie automatisch angepasst (die eigentliche
    // Ersatzsuche kommt erst in T26) — hier wird nur sichtbar gemacht, WAS die Kollision
    // verursacht: die Rolle der Bedingung selbst, oder — bei "wenn"-Bedingungen — die Rolle,
    // deren fixierte Wahl die Voraussetzung überhaupt erst ausgelöst hat (z. B. Trieb=Natron fix).
    const fixInfo = data ? ermittleFixierung(fixiert, b, props, data) : null;
    const eintrag = { ...b, ist: r.ist, strenge, fixiert: fixInfo };
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
function nachVorbereitung(prepKey, props, operations) {
  const patch = operations[prepKey]?.wirkt_auf_eigenschaften;
  if (!patch) return props;
  const next = { ...props };
  for (const [rolle, changes] of Object.entries(patch)) {
    if (next[rolle]) next[rolle] = { ...next[rolle], ...changes };
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
  const rolle = data.archetypes.ruehrteig.rollen.find((r) => r.rolle === zielRolleKey);
  if (!rolle) return null;
  const key = rolle.optionen.find((k) => data.ingredients[k]?.[eigenschaft] === wert);
  if (!key) return null;
  return { rolle: zielRolleKey, rolleLabel: rolle.label, zutat: key, zutatLabel: data.ingredients[key].label };
}

export function resolveMethod(methodKey, zutaten, gefaessKey, data, fixiert = {}) {
  const method = data.methods[methodKey];
  const vessel = data.vessels[gefaessKey];
  let props = propsOf(zutaten, data.ingredients);
  const schritte = [];
  const gruende = [];
  const warnungen = [];
  const kaskaden = [];
  const blockaden = [];
  let status = 'ok';

  // Natron-Säure-Check ist keine Sonderfall-Prüfung mehr hier, sondern eine reguläre
  // `hart`-Voraussetzung an der Operation "backen" in operations.json (DR-019/T22) —
  // wird unten in der Sequenzschleife wie jede andere Voraussetzung geprüft.

  if (props.struktur && props.struktur.bildet_gluten === false) {
    warnungen.push(`${props.struktur.label} bindet/verdickt (Stärke), liefert aber kein Eiweißgerüst — allein trägt es den Kuchen nicht („Bindung“ ohne „Körper“). In der Praxis bleibt Stärke/Nussmehl höchstens ~25 % der Struktur-Rolle, als Teilersatz neben echtem Mehl (z. B. 350 g Mehl + 50 g Speisestärke im Korpus), nicht als alleiniger Struktur-Geber.`);
  }

  if (props.fett?.gemischt && new Set(props.fett.anteile.map((a) => a.aggregat)).size > 1) {
    warnungen.push(`Gemischtes Fett (${props.fett.kurzlabel}): der flüssige Anteil schlägt beim Aufschlagen weniger Luft ein als reines festes Fett — Ergebnis liegt zwischen Creme- und Rühr-Öl-Methode.`);
  }

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
    if (check.ok && check.vorbereitung) {
      schritte.push({ key: check.vorbereitung, op: data.operations[check.vorbereitung], eingefuegt: true });
      props = nachVorbereitung(check.vorbereitung, props, data.operations);
      if (status === 'ok') status = 'prep';
      warnungen.push(`${data.operations[check.vorbereitung].label} wurde eingefügt: ${op.label} braucht ${beschreibeBedingungen(check.fehlend, data)}.`);
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
      warnungen.push(`${op.label}: ${beschreibeBedingungen(check.empfehlungen, data)} empfohlen, aber nicht zwingend — Ergebnis kann etwas abweichen.`);
    }
    schritte.push({ key, op, eingefuegt: false });
  }

  if (vessel && !(method.geeignet_fuer || []).includes(vessel.familie)) {
    warnungen.push(`${method.label} ist für ${vessel.label} untypisch — ${method.warum}`);
  }

  return { methodKey, status, schritte, gruende, warnungen, kaskaden, blockaden };
}

const AGGREGAT = { fest: 'festes', fluessig: 'flüssiges', pulver: 'pulvriges', stueckig: 'stückiges' };
const IST = { fest: 'fest', fluessig: 'flüssig', pulver: 'pulvrig', stueckig: 'stückig', true: 'ja', false: 'nein' };

function beschreibeBedingungen(fehlend, data) {
  const rollenLabel = (key) => data.archetypes.ruehrteig.rollen.find((r) => r.rolle === key)?.label ?? key;
  return fehlend
    .map((f) => {
      // "hinweis": optionaler, in der Regel selbst hinterlegter Erklärtext — für Fälle,
      // in denen die generische Formel (Eigenschaft + Rolle) zu unspezifisch wäre.
      let text;
      if (f.hinweis) {
        text = f.hinweis;
      } else {
        const soll =
          f.eigenschaft === 'cremig_schlagbar' ? 'cremig schlagbares'
          : f.eigenschaft === 'aggregat' ? AGGREGAT[f.wert] ?? f.wert
          : f.eigenschaft === 'saeure' ? 'saures'
          : `${f.eigenschaft} = ${f.wert}`;
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
  const rollenLabel = data.archetypes.ruehrteig.rollen.find((r) => r.rolle === b.rolle)?.label ?? b.rolle;
  const soll =
    b.eigenschaft === 'cremig_schlagbar' ? 'cremig schlagbares'
    : b.eigenschaft === 'aggregat' ? AGGREGAT[b.wert] ?? b.wert
    : b.eigenschaft === 'saeure' ? 'saures'
    : `${b.eigenschaft} = ${b.wert}`;
  return `${soll} ${rollenLabel}`;
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
  return katalog;
}

export function evaluateAll(zutaten, gefaessKey, data, fixiert = {}) {
  const arch = data.archetypes.ruehrteig;
  return Object.fromEntries(arch.methoden.map((m) => [m, resolveMethod(m, zutaten, gefaessKey, data, fixiert)]));
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
