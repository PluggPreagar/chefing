// Rückmeldungen in Entwürfe für den Negativ-Korpus verwandeln (T68, DR-036).
//   node tools/rueckmeldungen-zu-faellen.mjs <feedback.jsonl> [--max-bewertung 2] [--alle]
// Schreibt ein JSON-Array mit Entwürfen nach stdout (Zusammenfassung nach stderr). Ändert nichts: ein Mensch kuratiert jeden Entwurf
// (Symptom, Ursache, `ursache_regeln`), entfernt `entwurf` und fügt ihn in src/data/negativ.json ein. Kommentare der Nutzer werden nicht
// übernommen. Standard: nur Meldungen mit höchstens 2 Punkten (misslungen oder schlecht); --alle nimmt auch 3 Punkte (geht so) mit.
import fs from 'fs';

const wurzel = new URL('../src/', import.meta.url);
const { meldungZuFall } = await import(new URL('model/rueckmeldung.js', wurzel));
const ingredients = JSON.parse(fs.readFileSync(new URL('data/ingredients.json', wurzel), 'utf8'));

const datei = process.argv[2];
if (!datei) { console.error('Aufruf: node tools/rueckmeldungen-zu-faellen.mjs <feedback.jsonl> [--max-bewertung N] [--alle]'); process.exit(1); }
const i = process.argv.indexOf('--max-bewertung');
const max = process.argv.includes('--alle') ? 3 : i > 0 ? Number(process.argv[i + 1]) : 2;

const entwuerfe = [];
let kaputt = 0, uebersprungen = 0, ohneMengen = 0;
for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
  if (!zeile.trim()) continue;
  let m;
  try { m = JSON.parse(zeile); } catch { kaputt++; continue; }
  if (m?.v !== 1 || !Number.isInteger(m.bewertung) || m.bewertung > max) { uebersprungen++; continue; }
  const fall = meldungZuFall(m, { ingredients });
  if (!fall) { uebersprungen++; continue; }
  if (!fall.zutaten.length) ohneMengen++;
  entwuerfe.push(fall);
}
console.log(JSON.stringify(entwuerfe, null, 2));
console.error(`${entwuerfe.length} Entwürfe (bis ${max} Punkte), ${uebersprungen} Meldungen übersprungen${kaputt ? `, ${kaputt} unlesbare Zeilen` : ''}${ohneMengen ? `, ${ohneMengen} ohne Mengen` : ''}. Vor dem Einpflegen kuratieren (entwurf: true entfernen).`);
