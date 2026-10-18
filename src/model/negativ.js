// Negativ-Korpus (T55, DR-029): dokumentierte Misserfolge gegen die Mengen-Regeln halten. Reine Rechnung ohne Dateizugriff
// (tools/negativ.mjs lädt die Daten). Für jeden Fall: schlägt eine Grenze (grenzen.json), die Korpus-Toleranz oder das
// Gärmodell an? „Erkannt“ = die App hätte gewarnt. Misslungene Fälle ohne Warnung sind Falsch-Negative (fehlende Regel),
// gelungene Kontrollfälle mit Warnung sind Falsch-Alarme. Der Korpus enthält nur Erfolge — das hier ist die einzige Gegenprobe
// vor den Nutzer-Rückmeldungen (T53); n ist klein und die Auswahl verzerrt (Selbstauswahl der Fragenden).
import { normalizeRecipe, stats } from './corpus.js';
import { grenzenPruefen, toleranz, GROESSEN } from './bilanz.js';
import { erwarteteGare, pruefeGaerung } from './gaerung.js';
import { temperaturBereich } from './temperatur.js';
import { toGrams } from './units.js';

// US-Maße der Quellen → Gramm. Schätzwerte (Mehl gelöffelt 120 g, gehäuft/geschöpft wären 140–150 g): die Streuung wird im Bericht genannt.
export const TASSE_G = { weizenmehl: 120, wasser: 240, milch: 245, buttermilch: 245, butter: 227, zucker: 200, brauner_zucker: 213, pflanzenoel: 218, orangensaft: 240, karotten: 110, schokolade: 170 };
const EINHEIT = { tsp: 'tl', tbsp: 'el' };
// Zutaten, die ingredients.json nicht kennt, aber für die Bilanz gut genug auf eine bekannte abbilden: [Schlüssel, Mengenfaktor].
// Näherungen: Instanthefe aus dem Päckchen; Schmalz = reines Fett wie Öl; Honig ≈ Zucker; Eigelb wiegt etwa ein Drittel eines Eis;
// Pflanzendrink ≈ Milch, vegane Butter ≈ Margarine, nicht genannte Fettart ≈ Butter.
export const ABBILDUNG = {
  hefe_unbekannt: ['hefe_trocken', 1], schmalz: ['pflanzenoel', 1], honig: ['zucker', 1], eigelb: ['ei', 18 / 55],
  sojamilch: ['milch', 1], vegane_butter: ['margarine', 1], unbekannt: ['butter', 1], // "unbekannt" = Fettart nicht genannt
};
// Einlage und Aroma ohne Wirkung auf die Bilanz (die Rolle `einlage` zählt nicht zur Teigmatrix): unbekannte Zutaten dort stören nicht
const OHNE_WIRKUNG = new Set(['einlage', 'aroma']);

// Zutatenzeilen eines Falls in Korpus-Form (Gramm); `unbekannt` nennt, was nicht gerechnet werden konnte.
export function negativNormalisieren(fall, ingredients) {
  const zutaten = [];
  const unbekannt = [];
  const ignoriert = [];
  for (const z of fall.zutaten || []) {
    const [key, faktor] = ABBILDUNG[z.zutat] ?? [z.zutat, 1];
    const ing = ingredients[key];
    if (!ing && OHNE_WIRKUNG.has(z.rolle)) { ignoriert.push(z.zutat); continue; }
    if (z.menge == null) { unbekannt.push(`${z.zutat} (Menge fehlt)`); continue; }
    let menge = z.menge * faktor;
    let einheit = EINHEIT[z.einheit] ?? z.einheit;
    if (einheit === 'cup') {
      if (TASSE_G[key] == null) { unbekannt.push(`${z.zutat} (Tasse nicht umrechenbar)`); continue; }
      menge = z.menge * faktor * TASSE_G[key];
      einheit = 'g';
    }
    if (!ing) { unbekannt.push(`${z.zutat} (nicht in ingredients.json)`); continue; }
    if (toGrams(ing, menge, einheit) == null) { unbekannt.push(`${z.zutat} (Einheit ${z.einheit} nicht umrechenbar)`); continue; }
    zutaten.push({ rolle: z.rolle, zutat: key, menge, einheit });
  }
  return { zutaten, unbekannt, ignoriert };
}

const GROESSEN_KEYS = Object.keys(GROESSEN);

// faelle: Negativ-Korpus; archetypes/ingredients/grenzen/modelle: JSON-Daten; korpora: {archetypKey: {variante: [rohe Rezepte]}};
// methods/operations/temperaturen: für die Gär-Temperatur (optional)
export function negativPruefen({ faelle, archetypes, ingredients, grenzen, modelle, korpora, methods, operations, temperaturen }) {
  const statsCache = {};
  const statsFuer = (ak, vk) => {
    const key = `${ak}/${vk}`;
    if (statsCache[key]) return statsCache[key];
    const arch = archetypes[ak];
    const rollen = arch.rollen.map((r) => r.rolle);
    const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? 'struktur';
    statsCache[key] = stats((korpora?.[ak]?.[vk] || []).map((r) => normalizeRecipe(r, ingredients, { rollen, referenz })), rollen, { proMethode: false });
    return statsCache[key];
  };
  const model = modelle?.gaerung ?? null;
  const zeilen = [];
  for (const f of faelle) {
    const arch = archetypes[f.archetyp];
    if (!arch) { zeilen.push({ id: f.id, geprueft: false, grund: 'Archetyp unbekannt' }); continue; }
    const rollen = arch.rollen.map((r) => r.rolle);
    const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? 'struktur';
    const { zutaten, unbekannt, ignoriert } = negativNormalisieren(f, ingredients);
    const hatMehl = zutaten.some((z) => z.rolle === referenz);
    const kontrolle = f.ergebnis === 'gelungen' || f.kontrollfall === true;
    const ausgenommen = f.ausgenommen ?? null; // Fall ohne klare Aussage (weder Misserfolg noch Kontrolle): zählt in keiner Quote
    const zeile = { id: f.id, archetyp: f.archetyp, ergebnis: f.ergebnis, kontrolle, ausgenommen, ursacheArt: f.ursache_art ?? null, verlaesslichkeit: f.verlaesslichkeit ?? null, unbekannt, ignoriert, geprueft: false, grenzen: [], toleranz: [], gaerung: null, erkannt: false };
    if (!hatMehl || zutaten.length < 3) {
      zeilen.push({ ...zeile, grund: f.mengen_vorhanden === false ? 'keine Mengen' : 'zu wenige Mengen für die Bilanz' });
      continue;
    }
    // Fehlt eine wesentliche Zutat (Menge unbekannt, nicht abbildbar), wären Prozente und Grenzen ein Artefakt
    if (unbekannt.length) {
      zeilen.push({ ...zeile, grund: `wesentliche Zutat nicht rechenbar (${unbekannt.join(', ')})` });
      continue;
    }
    const n = normalizeRecipe({ zutaten }, ingredients, { rollen, referenz });
    const verletzt = grenzenPruefen(n.bilanz, grenzen?.archetypen?.[f.archetyp] || []);
    zeile.grenzen = [...verletzt.hart.map((v) => ({ id: v.id, strenge: 'hart', wert: v.wert })), ...verletzt.empfohlen.map((v) => ({ id: v.id, strenge: 'empfohlen', wert: v.wert }))];
    // Korpus-Toleranz: gegen die Variante des Falls, ohne Variante gegen alle — ein Befund zählt nur, wenn er außerhalb jeder
    // verglichenen Variante liegt (ein süßer Hefeteig ist gegen das Weißbrot immer „untypisch“, gegen den Zopf nicht)
    const varianten = f.variante && arch.varianten[f.variante] ? [f.variante] : Object.keys(arch.varianten);
    zeile.referenzVarianten = varianten;
    for (const g of GROESSEN_KEYS) {
      const w = n.bilanz.bp[g];
      if (w == null) continue;
      const aussen = varianten.every((vk) => toleranz(w, statsFuer(f.archetyp, vk).bilanz?.[g]) === 'ausserhalb_spanne');
      if (aussen) zeile.toleranz.push({ groesse: g, wert: w });
    }
    // Gärmodell, wenn Gare-Zeit und -Temperatur kuratiert sind (pruefung.gare_min, pruefung.gare_temp_c / gare_temp)
    const p = f.pruefung;
    if (model && p?.gare_min > 0 && n.bilanz.bp.hefe > 0) {
      const tb = temperaturBereich(p.gare_temp ?? p.gare_temp_c, temperaturen);
      const w = pruefeGaerung({ hefeBp: n.bilanz.bp.hefe, gare: p.gare_min, temp: tb?.mitte }, model);
      zeile.gaerung = { hefeBp: n.bilanz.bp.hefe, gare: p.gare_min, temp: tb?.mitte ?? null, erwartet: erwarteteGare(n.bilanz.bp.hefe, tb?.mitte, model), art: w?.art ?? null };
    }
    zeile.geprueft = true;
    zeile.erkannt = zeile.grenzen.length > 0 || zeile.toleranz.length > 0 || !!zeile.gaerung?.art;
    // Erkannt ÜBER DIE URSACHE, die die Quelle nennt (kuratiert in `ursache_regeln`: 'gaerung', 'grenze:<id>', 'toleranz:<größe>')? Eine Warnung
    // aus anderem Grund (z. B. Eiweiß außerhalb des Korpus bei zu viel Fett) zählt als erkannt, aber nicht als Treffer der Ursache.
    const treffer = [...(zeile.gaerung?.art ? ['gaerung'] : []), ...zeile.grenzen.map((g) => `grenze:${g.id}`), ...zeile.toleranz.map((t) => `toleranz:${t.groesse}`)];
    zeile.ursacheGetroffen = (f.ursache_regeln || []).some((r) => treffer.includes(r));
    zeilen.push(zeile);
  }
  const geprueft = zeilen.filter((z) => z.geprueft);
  const gezaehlt = geprueft.filter((z) => !z.ausgenommen);
  const fehl = gezaehlt.filter((z) => !z.kontrolle);
  const kontrollen = gezaehlt.filter((z) => z.kontrolle);
  // Mengen-Regeln können nur Mengenursachen erkennen: Prozessfehler (zu kurz geknetet) und offene Ursachen zählen getrennt
  const menge = fehl.filter((z) => z.ursacheArt === 'menge');
  return {
    faelle: zeilen,
    zusammenfassung: {
      gesamt: zeilen.length,
      geprueft: geprueft.length,
      misserfolge: fehl.length,
      erkannt: fehl.filter((z) => z.erkannt).length,
      falschNegativ: fehl.filter((z) => !z.erkannt).map((z) => z.id),
      mengeUrsache: { geprueft: menge.length, erkannt: menge.filter((z) => z.erkannt).length, ueberUrsache: menge.filter((z) => z.ursacheGetroffen).length, nichtPruefbar: zeilen.filter((z) => !z.geprueft && z.ursacheArt === 'menge').map((z) => z.id) },
      prozessOderOffen: fehl.filter((z) => z.ursacheArt !== 'menge').map((z) => ({ id: z.id, ursacheArt: z.ursacheArt, erkannt: z.erkannt })),
      ausgenommen: geprueft.filter((z) => z.ausgenommen).map((z) => ({ id: z.id, grund: z.ausgenommen, erkannt: z.erkannt })),
      kontrollen: kontrollen.length,
      falschAlarm: kontrollen.filter((z) => z.erkannt).map((z) => z.id),
      nichtPruefbar: zeilen.filter((z) => !z.geprueft).map((z) => z.id),
    },
  };
}
