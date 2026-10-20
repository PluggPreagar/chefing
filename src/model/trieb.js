// Triebquellen (T80, DR-049): woher das Volumen kommt und wann — und ob das Gas bis zum Erhitzen hält.
// Gas-Budget (T82, DR-050): wie viel Gas je 100 g Teig bis zum Erhitzen bleibt — eine Schätzung ohne Dampf.
import { planeAblauf, fmtZeit } from './zeit.js';

const NASS = (r) => r === 'fluessigkeit' || r.startsWith('bindung'); // ab hier reagiert ein chemischer Trieb

// Welche Rollen und welche Schritte stecken in der Masse eines Schritts (eigene + alles aus den Vorgängern)?
function massen(ablauf) {
  const idx = new Map(ablauf.map((s, i) => [s.nr ?? i + 1, i]));
  const rollen = [], schritte = [];
  ablauf.forEach((s, i) => {
    const vor = (s.nach ?? (i > 0 ? [ablauf[i - 1].nr ?? i] : [])).map((n) => idx.get(n)).filter((j) => j != null && j < i);
    rollen[i] = new Set([...s.zutaten.map((z) => z.rolle), ...vor.flatMap((j) => [...rollen[j]])]);
    schritte[i] = new Set([i, ...vor.flatMap((j) => [...schritte[j]])]);
  });
  return { rollen, schritte };
}

// Quellen im Ablauf: je Quelle der Schritt, an dem ihr Gas entsteht (Zutat: sobald die Masse nass ist)
function finde(ablauf, ops, props, quellen, rollen) {
  const gefunden = [];
  const add = (key, schritt, extra = {}) => {
    if (!quellen[key] || gefunden.some((q) => q.key === key)) return;
    gefunden.push({ key, ...quellen[key], schritt, aktion: ablauf[schritt].aktion, ...extra });
  };
  ablauf.forEach((s, i) => {
    const op = ops[i] || {};
    if (op.phase && op.luft) add(op.phase === 'fett' ? 'luft_fett' : 'luft_wasser', i, op.dichte ? { dichte: op.dichte } : {});
    if (op.triebquelle) add(op.triebquelle, i);
  });
  for (const [rolle, p] of Object.entries(props)) {
    for (const a of p?.anteile ?? []) {
      if (!a.triebquelle) continue;
      const i = rollen.findIndex((m) => m.has(rolle) && [...m].some(NASS));
      if (i >= 0) add(a.triebquelle, i, { rolle, anteil: (a.anteilProzent ?? 100) / 100 });
    }
  }
  const hitze = ablauf.findIndex((s) => s.typ === 'erhitzen');
  if (hitze >= 0) add('dampf', hitze);
  return gefunden;
}

// ablauf: Einträge aus engine.js (nr, nach, typ, zutaten); ops: Operation je Schritt; props: belegte Rollen; quellen: triebquellen.json
export function triebQuellen(ablauf, ops, props, quellen) {
  if (!quellen) return { quellen: [], zeile: null, warnungen: [] };
  const plan = planeAblauf(ablauf);
  const { rollen } = massen(ablauf);
  const gefunden = finde(ablauf, ops, props, quellen, rollen);
  const hitze = ablauf.map((s, i) => (s.typ === 'erhitzen' ? i : -1)).filter((i) => i >= 0);

  const warnungen = [];
  for (const q of gefunden) {
    const h = hitze.find((x) => x > q.schritt);
    if (q.haelt_min == null || h == null) continue;
    q.bisHitze = plan.start[h] - plan.fertig[q.schritt];
    if (q.bisHitze > q.haelt_min) {
      warnungen.push({
        id: `trieb:${q.key}`,
        text: `${q.label} hält nur etwa ${fmtZeit(q.haelt_min)}: zwischen „${q.aktion}“ und „${ablauf[h].aktion}“ liegen ${fmtZeit(q.bisHitze)}${q.tipp ? ` ${q.tipp}` : ''}`,
      });
    }
  }
  // Zeile fürs Rezept: eingeschlagene Luft zuerst, dann Gas aus Zutaten, Dampf zuletzt
  const rang = (q) => (q.key === 'dampf' ? 2 : q.herkunft === 'methode' ? 0 : 1);
  const sortiert = [...gefunden].sort((a, b) => rang(a) - rang(b));
  const zeile = sortiert.length ? `Volumen aus: ${sortiert.map((q) => `${q.label} (${q.wann})`).join(' · ')}` : null;
  return { quellen: sortiert, zeile, warnungen };
}

// gramm(rolle): Gramm der Rolle im Rezept; teigmasse: Gramm Teig gesamt. Ergebnis je Schritt in ml je 100 g Teig.
export function gasBudget(ablauf, ops, props, quellen, { gramm, teigmasse }) {
  const m = quellen?._modell;
  if (!m || !teigmasse) return null;
  const plan = planeAblauf(ablauf);
  const { rollen, schritte } = massen(ablauf);
  const gefunden = finde(ablauf, ops, props, quellen, rollen).filter((q) => q.key !== 'dampf');
  const hitze = ablauf.findIndex((s) => s.typ === 'erhitzen');
  const ende = hitze >= 0 ? hitze : ablauf.length - 1;
  const zuletztGemischt = (j) => { // eingeschlagene Luft zerfällt erst, wenn der Teig fertig gemischt ist (die Dichte gilt für den fertigen Teig)
    let k = j;
    for (let i = j + 1; i < ende; i++) if (schritte[i].has(j) && ablauf[i].typ === 'mischen') k = i;
    return plan.fertig[k];
  };
  const gareMin = (rolle, i) => ablauf.reduce((a, s, j) => a + (s.typ === 'warten' && schritte[i].has(j) && rollen[j].has(rolle) ? s.wirk ?? s.dauer ?? 0 : 0), 0);

  // je Quelle: Gas in ml (ganzes Rezept) zu einem Zeitpunkt t im Schritt i; beimErhitzen = der Anteil, der erst in der Hitze frei wird
  const gas = (q, i, t, beimErhitzen) => {
    if (!schritte[i].has(q.schritt)) return 0;
    const halb = (t0) => (q.haelt_min ? 0.5 ** (Math.max(0, t - t0) / q.haelt_min) : 1);
    if (q.key === 'hefe') { const g = gareMin(q.rolle, ende); return g ? (q.ml_je_100g_teig * teigmasse / 100) * (gareMin(q.rolle, i) / g) : 0; }
    if (q.dichte) return teigmasse * (1 / q.dichte - 1 / m.dichte_ohne_luft) * halb(zuletztGemischt(q.schritt));
    if (q.aufschlag) {
      const eiweiss = gramm('bindung') * (props.bindung?.teile?.eiweiss?.anteil ?? 0.65); // Eiweiß ≈ 1 g/ml
      return eiweiss * (q.aufschlag - 1) * (1 - (q.verlust_unterheben ?? 0)) * halb(zuletztGemischt(q.schritt));
    }
    if (q.co2_g_je_g) {
      const ml = gramm(q.rolle) * (q.anteil ?? 1) * q.co2_g_je_g * m.ml_je_g_co2 * (q.rest_nach_ruehren ?? 1);
      return ml * (q.anteil_mischen ?? 1) * halb(plan.fertig[q.schritt]) + (beimErhitzen ? ml * (1 - (q.anteil_mischen ?? 1)) : 0);
    }
    return 0;
  };
  const je100 = (ml) => Math.round(((ml / teigmasse) * 100) / 5) * 5;
  const stand = (i) => {
    const heiss = i === hitze;
    const t = heiss ? plan.start[i] : plan.fertig[i];
    return gefunden.map((q) => ({ q, ml: gas(q, i, t, heiss) * (heiss ? m.ausdehnung_erhitzen : 1) }));
  };
  const proSchritt = ablauf.map((_, i) => (i > ende ? null : je100(stand(i).reduce((a, x) => a + x.ml, 0))));
  const zumErhitzen = stand(ende).filter((x) => x.ml > 0);
  const gesamt = je100(zumErhitzen.reduce((a, x) => a + x.ml, 0));
  const anteile = zumErhitzen.map((x) => ({ key: x.q.key, kurz: x.q.kurz ?? x.q.label, ml: je100(x.ml) }));
  const zeile = gesamt ? `Gas beim Erhitzen ≈ ${gesamt} ml je 100 g Teig (Schätzung, ohne Dampf): ${anteile.map((a) => `${a.kurz} ${a.ml}`).join(' · ')}` : null;
  return { proSchritt, gesamt, anteile, zeile };
}
