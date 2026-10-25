// Auswahlmenü für eine Wahl aus wenigen Möglichkeiten (DR-108): ein flacher Knopf mit dem Symbol der gewählten Möglichkeit und einem Pfeil, der
// eine Liste mit Symbol und Name je Möglichkeit öffnet. Auf schmalen Bildschirmen ersetzt es die Knopfgruppe (Text | Symbole, Auto | Strom |
// Kompakt), damit der Kopf des Ablaufs in einer Zeile bleibt. Die Steuerung (Fokus, Tastatur, Auswahl) ist die des Erfahrungs-Menüs.
import { iconHtml } from './icons.js';
import { erzeugeStufenMenue } from './stufenMenue.js';

const PFEIL = '<svg class="stufe-pfeil" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

// optionen: [{ wert, icon, name, titel }]; aktuell: Wert; onWahl(wert) wird nur bei einer Wahl des Nutzers gerufen
export function initWahlMenue(wurzel, { name, optionen, aktuell, onWahl, doc = document }) {
  const werte = optionen.map((o) => o.wert);
  const von = (w) => optionen.find((o) => o.wert === w);
  wurzel.classList.add('stufe-menue', 'wahl-menue');
  wurzel.innerHTML = '<button type="button" class="stufe-knopf leiste-knopf flach ghost" aria-haspopup="listbox" aria-expanded="false"></button>'
    + `<ul class="stufe-liste" role="listbox" aria-label="${name}" hidden>${optionen.map((o) => `<li role="option" tabindex="-1" data-wert="${o.wert}" aria-selected="false" title="${o.titel}">${iconHtml(o.icon, 20)}<span class="stufe-text"><b>${o.name}</b></span></li>`).join('')}</ul>`;
  const knopf = wurzel.querySelector('.stufe-knopf');
  const liste = wurzel.querySelector('.stufe-liste');
  const eintraege = [...liste.querySelectorAll('[data-wert]')];

  const m = erzeugeStufenMenue({
    stufen: werte, aktuell, onWahl,
    melden: ({ offen, gewaehlt, fokus }) => {
      const o = von(gewaehlt);
      knopf.innerHTML = `${iconHtml(o.icon, 18)}${PFEIL}`;
      knopf.title = `${name}: ${o.name}`;
      knopf.setAttribute('aria-label', `${name}: ${o.name}`);
      knopf.setAttribute('aria-expanded', String(offen));
      liste.hidden = !offen;
      eintraege.forEach((e) => { e.setAttribute('aria-selected', String(e.dataset.wert === gewaehlt)); e.classList.toggle('is-fokus', offen && e.dataset.wert === fokus); });
      if (offen) eintraege.find((e) => e.dataset.wert === fokus)?.focus();
    },
  });
  knopf.addEventListener('click', () => { m.umschalten(); });
  wurzel.addEventListener('keydown', (e) => { if (m.taste(e.key)) { e.preventDefault(); if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && !m.stand().offen)) knopf.focus(); } });
  eintraege.forEach((e) => e.addEventListener('click', () => { m.waehle(e.dataset.wert); knopf.focus(); }));
  doc.addEventListener('click', (e) => { if (m.stand().offen && !wurzel.contains(e.target)) m.schliessen(); });
  m.setze(aktuell);
  return m;
}
