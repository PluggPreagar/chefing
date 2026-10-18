// Qualitätsnote 1–5 je Korpus-Rezept (T50, DR-026). Eine Note schlägt ein Skript aus nachvollziehbaren
// Signalen vor (`tools/qualitaet.mjs`); der Maintainer überschreibt sie mit `qualitaet_manuell`.
// Die Note wird nur ANGEZEIGT — Mengen und Mediane rechnen unverändert (Nutzer-Entscheidung 2026-10-18).
// Alle Rezepte sind bereits geprüft (Grenzen, Einheiten), daher startet die Note bei 4 („gut“); 5 braucht eine
// starke Seitenwertung, 3 und weniger entstehen aus Unsicherheiten.
import { GROESSEN_LABEL } from './bilanz.js';

export const BASIS = 4;
// Seitenwertung zählt erst nach Glättung zum Mittel 4,3: wenige Stimmen ziehen kaum (k = 20 fiktive Stimmen).
const GLAETTUNG_MITTEL = 4.3;
const GLAETTUNG_K = 20;
// Eindeutige Unsicherheits-Signale in `notizen` (Freitext ist uneinheitlich: „nicht erfasst“ steht 40-mal und
// meint meist harmlose Dinge wie Eigelb zum Bestreichen — deshalb nur diese Stichwörter).
const NOTIZ_SIGNALE = [
  { re: /angenommen|geschätzt|unsicher|zweifelhaft|widersprüch/i, abzug: 0.5, text: 'Mengen angenommen/unsicher' },
  { re: /\bblog\b/i, abzug: 0.5, text: 'Blog-Quelle' },
  { re: /nicht angegeben/i, abzug: 0.25, text: 'Angabe fehlt im Original' },
];
const ABWEICHUNG_MAX = 1.0;
// Salz fehlt bewusst: ½ TL mehr oder weniger entscheidet nicht über das Gelingen (nur die Hefe-Grenze braucht es).
const AUSREISSER_GROESSEN = ['wasser', 'fett', 'zucker', 'triebkraft', 'hefe'];

export const effektiveQualitaet = (rez) => rez?.qualitaet_manuell ?? rez?.qualitaet ?? null;
export const istManuell = (rez) => rez?.qualitaet_manuell != null;

const fmt = (x) => String(Math.round(x * 100) / 100).replace('.', ',');

// rez: normalisiertes Rezept (corpus.js#normalizeRecipe), stats: Statistik der Variante (corpus.js#stats).
export function qualitaetVorschlag(rez, stats) {
  let punkte = BASIS;
  const grund = [];

  const b = rez.quelle?.bewertung;
  const a = rez.quelle?.anzahlBewertungen;
  if (b != null && a > 0) {
    const geglaettet = (b * a + GLAETTUNG_MITTEL * GLAETTUNG_K) / (a + GLAETTUNG_K);
    const text = `Seite ${fmt(b)}★ (${a} Stimmen)`;
    if (geglaettet >= 4.6) { punkte += 0.5; grund.push(`${text} +0,5`); }
    else if (geglaettet < 4.0) { punkte -= 0.5; grund.push(`${text} −0,5`); }
    else grund.push(`${text} ±0`);
  } else {
    grund.push('keine Seitenwertung');
  }

  if (rez.backen?.minuten == null) { punkte -= 0.5; grund.push('Backzeit fehlt −0,5'); }

  for (const s of NOTIZ_SIGNALE) if (s.re.test(rez.notizen || '')) { punkte -= s.abzug; grund.push(`${s.text} −${fmt(s.abzug)}`); }

  // Ausreißer in der Variante: weit außerhalb von Q1–Q3 (1,5 × Quartilsabstand, mindestens 25 % des Medians bzw. 0,5
  // Punkte). Q1–Q3 allein ließe per Definition die Hälfte der Rezepte „untypisch“ wirken, und ein geprüftes Rezept
  // darf vom Üblichen abweichen — nur echte Ausreißer kosten Punkte. Abgeleitete Größen (Eiweiß, Emulgator,
  // Klebereiweiß) zählen nicht, sie folgen aus Mehl und Ei und würden dieselbe Ursache mehrfach bestrafen.
  const ausreisser = [];
  for (const g of AUSREISSER_GROESSEN) {
    const d = stats?.bilanz?.[g];
    const wert = rez.bilanz?.bp?.[g];
    if (!d || wert == null || d.n < 5) continue;
    const luft = Math.max(1.5 * (d.q3 - d.q1), 0.25 * Math.abs(d.median), 0.5);
    if (wert < d.q1 - luft || wert > d.q3 + luft) ausreisser.push(GROESSEN_LABEL[g]);
  }
  if (ausreisser.length) {
    const abzug = Math.min(0.5 * ausreisser.length, ABWEICHUNG_MAX);
    punkte -= abzug;
    grund.push(`Ausreißer bei ${ausreisser.join(', ')} −${fmt(abzug)}`);
  }

  return { note: Math.max(1, Math.min(5, Math.round(punkte))), punkte, grund: grund.join(' · ') };
}
