// Triebquellen (T80, DR-049): woher das Volumen kommt und wann — und ob das Gas bis zum Erhitzen hält.
import { planeAblauf, fmtZeit } from './zeit.js';

const NASS = (r) => r === 'fluessigkeit' || r.startsWith('bindung'); // ab hier reagiert ein chemischer Trieb

// ablauf: Einträge aus engine.js (nr, nach, typ, zutaten); ops: Operation je Schritt; props: belegte Rollen; quellen: triebquellen.json
export function triebQuellen(ablauf, ops, props, quellen) {
  if (!quellen) return { quellen: [], zeile: null, warnungen: [] };
  const plan = planeAblauf(ablauf);
  const idx = new Map(ablauf.map((s, i) => [s.nr ?? i + 1, i]));
  // Welche Rollen stecken in der Masse eines Schritts (eigene Zutaten + alles aus den Vorgängern)?
  const drin = [];
  ablauf.forEach((s, i) => {
    const vor = (s.nach ?? (i > 0 ? [ablauf[i - 1].nr ?? i] : [])).map((n) => drin[idx.get(n)] ?? new Set());
    drin[i] = new Set([...s.zutaten.map((z) => z.rolle), ...vor.flatMap((m) => [...m])]);
  });
  const hitze = ablauf.map((s, i) => (s.typ === 'erhitzen' ? i : -1)).filter((i) => i >= 0);
  const erhitzenNach = (i) => hitze.find((h) => h > i);

  const gefunden = [];
  const add = (key, schritt, aktion) => {
    if (!quellen[key] || gefunden.some((q) => q.key === key)) return;
    gefunden.push({ key, ...quellen[key], schritt, aktion });
  };
  ablauf.forEach((s, i) => {
    const op = ops[i] || {};
    if (op.phase && op.luft) add(op.phase === 'fett' ? 'luft_fett' : 'luft_wasser', i, s.aktion);
    if (op.triebquelle) add(op.triebquelle, i, s.aktion);
  });
  for (const [rolle, p] of Object.entries(props)) {
    for (const a of p?.anteile ?? []) {
      if (!a.triebquelle) continue;
      // Gas entsteht, sobald die Zutat nass wird: erster Schritt, dessen Masse sie und eine nasse Rolle enthält
      const i = drin.findIndex((m) => m.has(rolle) && [...m].some(NASS));
      if (i >= 0) add(a.triebquelle, i, ablauf[i].aktion);
    }
  }
  if (hitze.length) add('dampf', hitze[0], ablauf[hitze[0]].aktion);

  const warnungen = [];
  for (const q of gefunden) {
    const h = erhitzenNach(q.schritt);
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
