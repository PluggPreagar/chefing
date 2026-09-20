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

export function checkOperation(op, props, operations, fixiert = {}) {
  const fehlend = [];
  const empfehlungen = [];
  for (const b of op.voraussetzung || []) {
    // "wenn": Voraussetzung gilt nur, sofern diese Guard-Bedingung erfüllt ist (sonst nicht anwendbar).
    if (b.wenn && !pruefeBedingung(b.wenn, props).ok) continue;
    const r = pruefeBedingung(b, props);
    if (r.ok) continue;
    const strenge = b.strenge || 'hart';
    if (strenge === 'frei') continue; // legitime Variante — kein Hinweis
    // Konflikt-Kennzeichnung (DR-019 Punkt 3, T24): eine `gesetzt-fix`-Rolle wird nie
    // automatisch angepasst (die eigentliche Ersatzsuche kommt erst in T26) — hier wird nur
    // sichtbar gemacht, WELCHE fixierte Wahl die Kollision verursacht: entweder die Rolle der
    // Bedingung selbst, oder — bei "wenn"-Bedingungen — die Rolle, deren fixierte Wahl die
    // Voraussetzung überhaupt erst ausgelöst hat (z. B. Trieb=Natron fix).
    const fixRolle = !b.rolle?.startsWith('!') && fixiert[b.rolle] ? b.rolle : b.wenn && fixiert[b.wenn.rolle] ? b.wenn.rolle : null;
    const eintrag = { ...b, ist: r.ist, strenge, fixiert: fixRolle };
    if (strenge === 'empfohlen') empfehlungen.push(eintrag);
    else fehlend.push(eintrag);
  }
  if (!fehlend.length) return { ok: true, fehlend: [], empfehlungen, vorbereitung: null };

  const prepKey = op.vorbereitung_falls_nicht;
  if (prepKey && operations[prepKey]) {
    const prep = checkOperation(operations[prepKey], props, operations, fixiert);
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

export function resolveMethod(methodKey, zutaten, gefaessKey, data, fixiert = {}) {
  const method = data.methods[methodKey];
  const vessel = data.vessels[gefaessKey];
  let props = propsOf(zutaten, data.ingredients);
  const schritte = [];
  const gruende = [];
  const warnungen = [];
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
    const check = checkOperation(op, props, data.operations, fixiert);
    if (check.ok && check.vorbereitung) {
      schritte.push({ key: check.vorbereitung, op: data.operations[check.vorbereitung], eingefuegt: true });
      props = nachVorbereitung(check.vorbereitung, props, data.operations);
      if (status === 'ok') status = 'prep';
      warnungen.push(`${data.operations[check.vorbereitung].label} wurde eingefügt: ${op.label} braucht ${beschreibeBedingungen(check.fehlend, data)}.`);
    } else if (!check.ok) {
      status = 'invalid';
      gruende.push(`„${op.label}“ ist nicht möglich: braucht ${beschreibeBedingungen(check.fehlend, data)}. ${op.wirkung}`);
    } else if (check.empfehlungen?.length) {
      warnungen.push(`${op.label}: ${beschreibeBedingungen(check.empfehlungen, data)} empfohlen, aber nicht zwingend — Ergebnis kann etwas abweichen.`);
    }
    schritte.push({ key, op, eingefuegt: false });
  }

  if (vessel && !(method.geeignet_fuer || []).includes(vessel.familie)) {
    warnungen.push(`${method.label} ist für ${vessel.label} untypisch — ${method.warum}`);
  }

  return { methodKey, status, schritte, gruende, warnungen };
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
      // Konflikt-Kennzeichnung (DR-019 Punkt 3, T24): macht sichtbar, dass hier keine
      // automatische Anpassung versucht wurde, weil die verantwortliche Rolle fixiert ist.
      if (f.fixiert) text += ` — „${rollenLabel(f.fixiert)}“ ist bewusst fixiert 📌 und wird deshalb nicht automatisch geändert`;
      return text;
    })
    .join(', ');
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
