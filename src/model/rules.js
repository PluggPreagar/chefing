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

function pruefeBedingung(b, props) {
  const ing = props[b.rolle];
  if (!ing) return { ok: false, ist: 'nicht belegt' };
  const ist = ing[b.eigenschaft];
  return { ok: ist === b.wert, ist: ist === undefined ? 'unbekannt' : String(ist) };
}

export function checkOperation(op, props, operations) {
  const fehlend = [];
  const empfehlungen = [];
  for (const b of op.voraussetzung || []) {
    const r = pruefeBedingung(b, props);
    if (r.ok) continue;
    const strenge = b.strenge || 'hart';
    if (strenge === 'frei') continue; // legitime Variante — kein Hinweis
    const eintrag = { ...b, ist: r.ist, strenge };
    if (strenge === 'empfohlen') empfehlungen.push(eintrag);
    else fehlend.push(eintrag);
  }
  if (!fehlend.length) return { ok: true, fehlend: [], empfehlungen, vorbereitung: null };

  const prepKey = op.vorbereitung_falls_nicht;
  if (prepKey && operations[prepKey]) {
    const prep = checkOperation(operations[prepKey], props, operations);
    if (prep.ok) return { ok: true, fehlend, empfehlungen, vorbereitung: prepKey };
  }
  return { ok: false, fehlend, empfehlungen, vorbereitung: null };
}

function nachVorbereitung(prepKey, props) {
  if (prepKey === 'schmelzen' && props.fett) {
    return { ...props, fett: { ...props.fett, aggregat: 'fluessig', cremig_schlagbar: false, geschmolzen: true } };
  }
  return props;
}

function rollenBelegt(op, props) {
  const rollen = op.auf || [];
  if (!rollen.length) return true;
  return rollen.some((r) => props[r]);
}

function brauchtEinlegen(props) {
  return props.einlage?.quellfaehig === true;
}

export function resolveMethod(methodKey, zutaten, gefaessKey, data) {
  const method = data.methods[methodKey];
  const vessel = data.vessels[gefaessKey];
  let props = propsOf(zutaten, data.ingredients);
  const schritte = [];
  const gruende = [];
  const warnungen = [];
  let status = 'ok';

  if (props.trieb?.trieb_typ === 'chemisch_basisch') {
    const sauer = Object.entries(props).some(([r, p]) => p?.saeure && r !== 'trieb');
    if (!sauer) {
      status = 'invalid';
      gruende.push('Natron ist nur Base — ohne saure Zutat (Buttermilch, Joghurt, Kakao, brauner Zucker) entsteht kein CO₂ und der Teig schmeckt seifig.');
    }
  }

  if (props.struktur && props.struktur.bildet_gluten === false) {
    warnungen.push(`${props.struktur.label} bindet/verdickt (Stärke), liefert aber kein Eiweißgerüst — allein trägt es den Kuchen nicht („Bindung“ ohne „Körper“). In der Praxis bleibt Stärke/Nussmehl ein Teilersatz neben echtem Mehl (z. B. 350 g Mehl + 50 g Speisestärke im Korpus), nicht der alleinige Struktur-Geber.`);
  }

  if (props.fett?.gemischt && new Set(props.fett.anteile.map((a) => a.aggregat)).size > 1) {
    warnungen.push(`Gemischtes Fett (${props.fett.kurzlabel}): der flüssige Anteil schlägt beim Aufschlagen weniger Luft ein als reines festes Fett — Ergebnis liegt zwischen Creme- und Rühr-Öl-Methode.`);
  }

  for (const key of method.sequenz) {
    const op = data.operations[key];
    if (!op) continue;
    const optional = (method.optional || []).includes(key);
    if (optional) {
      if (!rollenBelegt(op, props)) continue;
      if (key === 'einlegen' && !brauchtEinlegen(props)) continue;
    }
    const check = checkOperation(op, props, data.operations);
    if (check.ok && check.vorbereitung) {
      schritte.push({ key: check.vorbereitung, op: data.operations[check.vorbereitung], eingefuegt: true });
      props = nachVorbereitung(check.vorbereitung, props);
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
  return fehlend
    .map((f) => {
      const rolle = data.archetypes.ruehrteig.rollen.find((r) => r.rolle === f.rolle)?.label ?? f.rolle;
      const soll = f.eigenschaft === 'cremig_schlagbar' ? 'cremig schlagbares' : f.eigenschaft === 'aggregat' ? AGGREGAT[f.wert] ?? f.wert : `${f.eigenschaft} = ${f.wert}`;
      return `${soll} ${rolle} (ist: ${IST[f.ist] ?? f.ist})`;
    })
    .join(', ');
}

export function evaluateAll(zutaten, gefaessKey, data) {
  const arch = data.archetypes.ruehrteig;
  return Object.fromEntries(arch.methoden.map((m) => [m, resolveMethod(m, zutaten, gefaessKey, data)]));
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
