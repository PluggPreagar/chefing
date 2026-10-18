// Qualitätsnote je Korpus-Rezept vorschlagen und eintragen (T50).
//   node tools/qualitaet.mjs           Trockenlauf: zeigt Verteilung und Änderungen
//   node tools/qualitaet.mjs --write   schreibt `qualitaet` + `qualitaet_grund` in src/data/corpus/*.json
// Überschreiben: im Rezept `qualitaet_manuell` (1–5) setzen — das Skript fasst dieses Feld nie an.
// Nach jedem neuen Korpus-Rezept neu laufen lassen; test/qualitaet.check.mjs prüft, dass die Werte aktuell sind.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const lies = (pfad) => JSON.parse(fs.readFileSync(new URL(pfad, wurzel), 'utf8'));
const { normalizeRecipe, stats } = await import(new URL('model/corpus.js', wurzel));
const { qualitaetVorschlag, effektiveQualitaet } = await import(new URL('model/qualitaet.js', wurzel));

const ingredients = lies('data/ingredients.json');
const archetypes = lies('data/archetypes.json');
const schreiben = process.argv.includes('--write');

const verteilung = {};
let geaendert = 0;
let gesamt = 0;
for (const [ak, arch] of Object.entries(archetypes)) {
  if (ak.startsWith('_')) continue;
  const rollen = arch.rollen.map((r) => r.rolle);
  const referenz = arch.rollen.find((r) => r.referenz)?.rolle ?? 'struktur';
  for (const [vk, v] of Object.entries(arch.varianten)) {
    const datei = `data/corpus/${v.korpus}.json`;
    const roh = lies(datei);
    const norm = roh.map((r) => normalizeRecipe(r, ingredients, { rollen, referenz }));
    const st = stats(norm, rollen);
    const neu = roh.map((r, i) => {
      const { note, grund } = qualitaetVorschlag(norm[i], st);
      gesamt++;
      verteilung[note] = (verteilung[note] || 0) + 1;
      if (r.qualitaet !== note || r.qualitaet_grund !== grund) geaendert++;
      // Schlüsselreihenfolge stabil: neue Felder direkt hinter `notizen`
      const { qualitaet, qualitaet_grund, ...rest } = r;
      const ergebnis = {};
      for (const [k, wert] of Object.entries(rest)) {
        ergebnis[k] = wert;
        if (k === 'notizen') { ergebnis.qualitaet = note; ergebnis.qualitaet_grund = grund; }
      }
      if (!('notizen' in rest)) { ergebnis.qualitaet = note; ergebnis.qualitaet_grund = grund; }
      return ergebnis;
    });
    if (schreiben) fs.writeFileSync(new URL(datei, wurzel), JSON.stringify(neu, null, 2) + '\n');
    const mittel = neu.map((r) => effektiveQualitaet(r));
    console.log(`${vk.padEnd(13)} ${String(neu.length).padStart(3)} Rezepte, Ø Note ${(mittel.reduce((a, b) => a + b, 0) / mittel.length).toFixed(1)}`);
  }
}
console.log(`\nVerteilung der Noten: ${[5, 4, 3, 2, 1].map((n) => `${n}: ${verteilung[n] || 0}`).join('  ')}`);
console.log(`${gesamt} Rezepte, ${geaendert} mit neuer oder geänderter Note${schreiben ? ' — geschrieben' : ' (Trockenlauf, --write schreibt)'}`);
