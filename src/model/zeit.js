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

// Zeitleiste über den Ablauf-Graph (DR-021): Gesamtzeit = längster Pfad (Wartezeiten laufen neben
// aktiven Schritten), aber nie weniger als die aktive Zeit — eine Person erledigt auch „parallele“
// aktive Schritte nacheinander. aktiv/warten = Summe der Dauern je Schritt-Typ.
export function zeitleiste(ablauf) {
  const ende = [];
  let aktiv = 0;
  let warten = 0;
  ablauf.forEach((s, i) => {
    const d = s.dauer ?? 0;
    if (s.typ === 'warten') warten += d; else aktiv += d;
    ende[i] = Math.max(0, ...(s.nach || []).map((n) => ende[n - 1] ?? 0)) + d;
  });
  return { gesamt: Math.round(Math.max(aktiv, ...ende)), aktiv: Math.round(aktiv), warten: Math.round(warten) };
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
