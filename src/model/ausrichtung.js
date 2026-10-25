// Ausrichtung des Diagramms (DR-090): Auto, Strom oder Kompakt. Strom läuft links nach rechts (quer), Kompakt oben nach unten (hochkant).
// Auto folgt dem Bildschirm: hochkant = Kompakt, quer = Strom; im Vollbild der wirksamen Ausrichtung samt Drehen (DR-089). Strom und Kompakt
// sind die feste Wahl, sie gilt überall, auch im Vollbild. Rein, ohne DOM.
export const AUSRICHTUNGEN = ['auto', 'strom', 'kompakt'];

export const ansichtFuerAusrichtung = (quer) => (quer ? 'strom' : 'kompakt');

// vollbildAnsicht: im Vollbild von der Steuerung gemeldet (null außerhalb); hoch: Bildschirm ist höher als breit
export function wirksameAnsicht({ ausrichtung, vollbildAnsicht = null, hoch }) {
  if (ausrichtung === 'strom' || ausrichtung === 'kompakt') return ausrichtung;
  return vollbildAnsicht ?? (hoch ? 'kompakt' : 'strom');
}

// Start: die neue Wahl (chefing.ausrichtung) gilt; sonst die frühere Ansicht (chefing.ablauf, Strom oder Kompakt) als feste Wahl; sonst Auto
export function ausrichtungAusSpeicher({ neu, alt } = {}) {
  if (AUSRICHTUNGEN.includes(neu)) return neu;
  if (alt === 'strom' || alt === 'kompakt') return alt;
  return 'auto';
}

// Eine Wahl mit vier Ansichten (DR-109): Auto | Zeitleiste | Liste | Symbole. Sie ersetzt die zwei getrennten Schalter Ausrichtung und Text | Symbole
// und wird auf dieselben zwei Werte abgebildet (Ausrichtung auto|strom|kompakt, Namen ja|nein), damit gespeicherte Wahlen und Zeichner gleich bleiben.
// Zeitleiste = Strom (quer, links nach rechts), Liste = Kompakt mit Namen und Mengen, Symbole = Kompakt nur mit Symbolen. Auto zeigt hochkant die Liste.
export const ANSICHTEN = ['auto', 'zeitleiste', 'liste', 'symbole'];
export const ansichtWert = ({ ausrichtung, namen }) => (ausrichtung === 'strom' ? 'zeitleiste' : ausrichtung === 'kompakt' ? (namen ? 'liste' : 'symbole') : 'auto');
export const ausAnsichtWert = (w) => ({ zeitleiste: { ausrichtung: 'strom', namen: true }, liste: { ausrichtung: 'kompakt', namen: true }, symbole: { ausrichtung: 'kompakt', namen: false } }[w] ?? { ausrichtung: 'auto', namen: true });
