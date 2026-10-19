// Zeit-Fenster an Operationen und Warten als Operation (DR-024, T44).
// Eine Operation darf `zeit: {min, typ, max, einheit, ziel, unter_min, ueber_max, strenge}` tragen:
// das Fenster, in dem ihr Effekt (`ziel`, z. B. gluten_entspannt) eintritt. Methoden dürfen den Wert
// per `zeiten: {opKey: minuten}` festlegen, Erfahrungsregeln das Fenster per `zeit_op` + `faktor`
// verschieben (z. B. mehr Hefe → kürzere Gehzeit). Ohne `zeit` gilt `dauer_min` wie bisher.
import { pruefeBedingung } from './rules.js';

export function zeitFuerSchritt(key, op, method, props, erfahrungsregeln) {
  const z = op.zeit;
  if (!z) return { dauer: op.dauer_min ?? null, fenster: null, hinweis: null, anpassung: null };

  // pro Operation gewinnt die erste passende Regel (wie bei den Rollen-Regeln, DR-019/T23)
  const regel = (erfahrungsregeln?.regeln || []).find((r) => r.zeit_op === key && (!r.wenn || pruefeBedingung(r.wenn, props).ok));
  const faktor = regel?.faktor ?? 1;
  const anpassung = regel ? regel.begruendung.replace(/\{(\w+)\}/g, (_, r) => props[r]?.label ?? `{${r}}`) : null;

  const fenster = { min: z.min * faktor, typ: z.typ * faktor, max: z.max * faktor, ziel: z.ziel ?? null };
  // Ein von der Methode festgelegter Wert wird nicht mitskaliert — nur sein Fenster verschiebt sich.
  const dauer = method?.zeiten?.[key] ?? fenster.typ;
  const strenge = z.strenge ?? 'empfohlen';
  const hinweis = dauer < fenster.min ? { text: z.unter_min ?? null, strenge, seite: 'unter' }
    : dauer > fenster.max ? { text: z.ueber_max ?? null, strenge, seite: 'ueber' }
    : null;
  return { dauer, fenster, hinweis, anpassung };
}

// Handzeit und Wirkzeit eines Schritts (DR-043): ohne Angabe ist Warten ganz Wirkzeit, alles andere ganz Handzeit
export const handzeit = (s) => s.aktiv ?? (s.typ === 'warten' ? 0 : s.dauer ?? 0);
export const wirkzeit = (s) => s.wirk ?? (s.typ === 'warten' ? s.dauer ?? 0 : 0);

// Planer (DR-043, R1–R6): ein Koch, je Zeit-Slot genau eine Aktion. Bereit ist ein Schritt, wenn seine Vorgänger samt
// Wirkzeit fertig sind; reine Wartezeiten (Handzeit 0) laufen ohne Koch los. Sind mehrere bereit, kommt der mit dem
// längsten Restweg zuerst (kritischer Pfad: Rosinen vor der Hefe). Startschritte mit Hand- und Wirkzeit (Einlegen) rücken
// in den Vorlauf vor 0′, wenn ihre Wirkzeit sonst den Ablauf aufhielte: sie enden genau, wenn der Nachfolger sie braucht.
export function planeAblauf(ablauf) {
  const A = ablauf.map(handzeit);
  const W = ablauf.map(wirkzeit);
  const nr = (i) => ablauf[i].nr ?? i + 1; // Testdaten ohne nr: Position zählt
  const vor = ablauf.map((s, i) => s.nach ?? (i > 0 ? [nr(i - 1)] : []));
  const idx = (n) => ablauf.findIndex((_, i) => nr(i) === n);
  const nachf = ablauf.map((_, i) => ablauf.map((_, j) => j).filter((j) => vor[j].includes(nr(i))));
  const rest = [];
  for (let i = ablauf.length - 1; i >= 0; i--) rest[i] = A[i] + W[i] + Math.max(0, ...nachf[i].map((j) => rest[j] ?? 0));

  const lauf = (fest) => {
    const start = [], fertig = [];
    for (const [i, f] of fest) { start[i] = f.start; fertig[i] = f.start + A[i] + W[i]; }
    let t = 0;
    const offen = new Set(ablauf.map((_, i) => i).filter((i) => !fest.has(i)));
    const frueh = (i) => Math.max(0, ...vor[i].map((n) => fertig[idx(n)] ?? Infinity));
    while (offen.size) {
      const bereit = [...offen].filter((i) => vor[i].every((n) => fertig[idx(n)] != null));
      for (const i of bereit.filter((i) => A[i] === 0)) { start[i] = frueh(i); fertig[i] = start[i] + W[i]; offen.delete(i); }
      const kandidaten = bereit.filter((i) => offen.has(i));
      if (!kandidaten.length) { if (bereit.length) continue; break; } // Zyklus/fehlender Vorgänger: nicht hängen bleiben
      const jetzt = kandidaten.filter((i) => frueh(i) <= t);
      if (!jetzt.length) { t = Math.min(...kandidaten.map(frueh)); continue; }
      const i = jetzt.sort((a, b) => rest[b] - rest[a] || a - b)[0];
      start[i] = t; t += A[i]; fertig[i] = t + W[i]; offen.delete(i);
    }
    return { start, fertig };
  };

  const kandidaten = ablauf.map((_, i) => i).filter((i) => !vor[i].length && A[i] > 0 && W[i] > 0);
  const erster = lauf(new Map(kandidaten.map((i) => [i, { start: -Infinity }])));
  const fest = new Map();
  let grenze = 0;
  const gewuenscht = kandidaten.map((i) => [i, Math.min(...nachf[i].map((j) => erster.start[j] ?? Infinity)) - W[i] - A[i]])
    .filter(([, g]) => g < 0 && Number.isFinite(g)).sort((a, b) => b[1] - a[1]);
  for (const [i, g] of gewuenscht) { const s = Math.min(g, grenze - A[i]); fest.set(i, { start: s }); grenze = s; } // Vorlauf-Handgriffe nacheinander
  const { start, fertig } = lauf(fest);
  return {
    start, fertig,
    aktivEnde: start.map((s, i) => s + A[i]),
    vorlauf: Math.min(0, ...start.filter(Number.isFinite)),
    gesamt: Math.max(0, ...fertig.filter(Number.isFinite)),
  };
}

// Zeitleiste (DR-043): Gesamtzeit ab Start laut Planer, Vorlauf (negativ) getrennt; aktiv = Summe der Handzeiten, warten = Summe der Wirkzeiten.
export function zeitleiste(ablauf) {
  const p = planeAblauf(ablauf);
  return {
    gesamt: Math.round(p.gesamt), aktiv: Math.round(ablauf.reduce((a, s) => a + handzeit(s), 0)),
    warten: Math.round(ablauf.reduce((a, s) => a + wirkzeit(s), 0)), vorlauf: Math.round(-p.vorlauf),
  };
}

export function fmtZeit(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

export function zeitMeldung(op, z) {
  const f = z.fenster;
  const lage = z.hinweis.seite === 'unter' ? 'unter' : 'über';
  return `${op.label}: ${fmtZeit(z.dauer)} liegen ${lage} dem Fenster ${fmtZeit(f.min)}–${fmtZeit(f.max)}${z.hinweis.text ? ` — ${z.hinweis.text}` : '.'}`;
}
