// Melden als geteilter Knopf (DR-088, Option B der Kopfzeile in DR-087): der Hauptteil führt die zuletzt gewählte Aktion aus, der Pfeil daneben
// öffnet die Liste und wechselt sie. Die Wahl bleibt gemerkt, damit man dieselbe Aktion mehrmals hintereinander auslösen kann (Nutzer
// 2026-10-25: „combi melden/error remembers last choice to allow repetitive runs on same action“). Wählen in der Liste führt die Aktion sofort aus.
// Die Steuerung (Liste, Fokus, Tastatur) ist die des Stufen-Menüs; hier kommen Hauptteil und Ausführung dazu.
import { iconHtml } from './icons.js';
import { erzeugeStufenMenue } from './stufenMenue.js';

export const MELDEN_AKTIONEN = ['fehler', 'bewerten'];
export const MELDEN_TEXT = {
  fehler: { icon: 'melden_fehler', kurz: 'Melden', lang: 'Fehler, Idee oder Frage melden', hilfe: 'Beschreibung, Elemente, App-Zustand', titel: 'Fehler, Idee oder Frage melden: Beschreibung, gewählte Elemente und App-Zustand absenden oder als ZIP herunterladen' },
  bewerten: { icon: 'melden_bewerten', kurz: 'Bewerten', lang: 'Rezept bewerten', hilfe: 'Hat es geklappt?', titel: 'Rezept bewerten: zur Box „Hat es geklappt?“ springen' },
};

export function erzeugeMeldenMenue({ aktuell, fuehreAus = () => {}, onMerke = () => {}, melden = () => {} }) {
  const m = erzeugeStufenMenue({
    stufen: MELDEN_AKTIONEN, aktuell,
    onWahl: (k) => { onMerke(k); fuehreAus(k); }, // Wahl in der Liste: merken und sofort ausführen
    melden,
  });
  // Hauptteil: die gewählte Aktion noch einmal ausführen, nichts ändern
  const haupt = () => { const k = m.stand().gewaehlt; fuehreAus(k); return k; };
  return { ...m, haupt };
}

const PFEIL = '<svg class="stufe-pfeil" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

export function initMeldenMenue(wurzel, { aktuell, fuehreAus, onMerke, doc = document }) {
  wurzel.classList.add('stufe-menue', 'melden-menue');
  wurzel.innerHTML = '<span class="knopfgruppe melden-gruppe" role="group" aria-label="Melden">'
    + '<button type="button" class="leiste-knopf melden-haupt" id="melden-haupt"></button>'
    + `<button type="button" class="leiste-knopf melden-pfeil" id="melden-pfeil" aria-haspopup="listbox" aria-expanded="false" aria-label="Andere Aktion wählen" title="Andere Aktion wählen">${PFEIL}</button>`
    + '</span>'
    + `<ul class="stufe-liste" role="listbox" aria-label="Melden" hidden>${MELDEN_AKTIONEN.map((k) => `<li role="option" tabindex="-1" data-aktion="${k}" aria-selected="false" title="${MELDEN_TEXT[k].titel}">${iconHtml(MELDEN_TEXT[k].icon, 20)}<span class="stufe-text"><b>${MELDEN_TEXT[k].lang}</b><small>${MELDEN_TEXT[k].hilfe}</small></span></li>`).join('')}</ul>`;
  const haupt = wurzel.querySelector('.melden-haupt');
  const pfeil = wurzel.querySelector('.melden-pfeil');
  const liste = wurzel.querySelector('.stufe-liste');
  const optionen = [...liste.querySelectorAll('[data-aktion]')];

  const m = erzeugeMeldenMenue({
    aktuell, fuehreAus, onMerke,
    melden: ({ offen, gewaehlt, fokus }) => {
      const t = MELDEN_TEXT[gewaehlt];
      haupt.innerHTML = `${iconHtml(t.icon, 18)}<span class="melden-text">${t.kurz}</span>`;
      haupt.title = t.titel;
      haupt.setAttribute('aria-label', t.lang);
      pfeil.setAttribute('aria-expanded', String(offen));
      liste.hidden = !offen;
      optionen.forEach((o) => { o.setAttribute('aria-selected', String(o.dataset.aktion === gewaehlt)); o.classList.toggle('is-fokus', offen && o.dataset.aktion === fokus); });
      if (offen) optionen.find((o) => o.dataset.aktion === fokus)?.focus();
    },
  });
  haupt.addEventListener('click', () => { m.haupt(); });
  pfeil.addEventListener('click', () => { m.umschalten(); });
  wurzel.addEventListener('keydown', (e) => { if (m.taste(e.key)) { e.preventDefault(); if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && !m.stand().offen)) pfeil.focus(); } });
  optionen.forEach((o) => o.addEventListener('click', () => { m.waehle(o.dataset.aktion); pfeil.focus(); }));
  doc.addEventListener('click', (e) => { if (m.stand().offen && !wurzel.contains(e.target)) m.schliessen(); });
  m.setze(aktuell);
  return m;
}
