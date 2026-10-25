// Erfahrungsstufe als Auswahlmenü oben auf der Seite (DR-085): ein Knopf mit Symbol und Name der gewählten Stufe, der eine Liste mit den
// Stufen öffnet (Löffel = Einsteiger, Schneebesen = Fortgeschritten, Kochmütze = Profi). Die Stufe ist eine allgemeine, selten geänderte
// Einstellung, darum sitzt sie ruhig oben und nicht mehr als Knopfgruppe im Ablauf (Nutzer-Meldung 20261025-074224).
// Die Steuerung kennt nur kleine Schnittstellen, damit sie ohne Browser testbar ist; initStufenMenue baut daraus die Oberfläche.
import { iconHtml } from './icons.js';

export const STUFE_ICON = { einsteiger: 'loeffel', fortgeschritten: 'besen', profi: 'kochmuetze' };

export function erzeugeStufenMenue({ stufen, aktuell, onWahl = () => {}, melden = () => {} }) {
  let offen = false;
  let gewaehlt = stufen.includes(aktuell) ? aktuell : stufen[0];
  let fokus = stufen.indexOf(gewaehlt);
  const stand = () => ({ offen, gewaehlt, fokus: stufen[fokus] });
  const melde = () => melden(stand());

  const oeffnen = () => { offen = true; fokus = stufen.indexOf(gewaehlt); melde(); return stand(); };
  const schliessen = () => { if (offen) { offen = false; melde(); } return stand(); };
  const umschalten = () => (offen ? schliessen() : oeffnen());
  function waehle(k) {
    if (!stufen.includes(k)) return stand();
    gewaehlt = k; offen = false; fokus = stufen.indexOf(k);
    onWahl(k);
    melde();
    return stand();
  }
  // von außen gesetzt (beim Start, aus dem Speicher): meldet zurück, ruft aber onWahl nicht
  function setze(k) { if (stufen.includes(k)) { gewaehlt = k; fokus = stufen.indexOf(k); melde(); } return stand(); }

  // Tastatur: Pfeile bewegen den Fokus (ohne Umlauf), Enter oder Leertaste wählt bzw. öffnet, Esc und Tab schließen.
  // Rückgabe true = behandelt (der Browser soll nichts mehr damit tun).
  function taste(key) {
    const letzte = stufen.length - 1;
    const bewege = (neu) => { if (!offen) { offen = true; fokus = stufen.indexOf(gewaehlt); } else fokus = Math.max(0, Math.min(letzte, neu)); melde(); return true; };
    switch (key) {
      case 'ArrowDown': case 'ArrowRight': return bewege(fokus + 1);
      case 'ArrowUp': case 'ArrowLeft': return bewege(fokus - 1);
      case 'Home': return bewege(0);
      case 'End': return bewege(letzte);
      case 'Enter': case ' ': if (offen) waehle(stufen[fokus]); else oeffnen(); return true;
      case 'Escape': if (!offen) return false; schliessen(); return true;
      case 'Tab': schliessen(); return false;
      default: return false;
    }
  }
  return { oeffnen, schliessen, umschalten, waehle, setze, taste, stand };
}

// Baut das Menü in `wurzel`. text: Name je Stufe, schwelle: Sterne je Stufe (für die Erklärung), beschreibung optional.
export function initStufenMenue(wurzel, { stufen, text, schwelle, aktuell, onWahl, doc = document }) {
  const erklaerung = (k) => `Hinweise ab ${schwelle[k]} ${schwelle[k] === 1 ? 'Stern' : 'Sternen'}`;
  wurzel.classList.add('stufe-menue');
  wurzel.innerHTML = `<button type="button" class="stufe-knopf" aria-haspopup="listbox" aria-expanded="false" id="stufe-knopf"></button>`
    + `<ul class="stufe-liste" role="listbox" aria-label="Erfahrung" hidden>${stufen.map((k) => `<li role="option" tabindex="-1" data-stufe="${k}" aria-selected="false" title="${text[k]}: ${erklaerung(k)}">${iconHtml(STUFE_ICON[k], 20)}<span class="stufe-text"><b>${text[k]}</b><small>${erklaerung(k)}</small></span></li>`).join('')}</ul>`;
  const knopf = wurzel.querySelector('.stufe-knopf');
  const liste = wurzel.querySelector('.stufe-liste');
  const optionen = [...liste.querySelectorAll('[data-stufe]')];

  const m = erzeugeStufenMenue({
    stufen, aktuell, onWahl,
    melden: ({ offen, gewaehlt, fokus }) => {
      knopf.innerHTML = `${iconHtml(STUFE_ICON[gewaehlt], 18)}<span class="stufe-name">${text[gewaehlt]}</span><svg class="stufe-pfeil" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
      knopf.title = `Erfahrung: ${text[gewaehlt]} (${erklaerung(gewaehlt)})`;
      knopf.setAttribute('aria-label', `Erfahrung: ${text[gewaehlt]}`);
      knopf.setAttribute('aria-expanded', String(offen));
      liste.hidden = !offen;
      optionen.forEach((o) => { o.setAttribute('aria-selected', String(o.dataset.stufe === gewaehlt)); o.classList.toggle('is-fokus', offen && o.dataset.stufe === fokus); });
      if (offen) optionen.find((o) => o.dataset.stufe === fokus)?.focus();
    },
  });
  knopf.addEventListener('click', () => { m.umschalten(); });
  wurzel.addEventListener('keydown', (e) => { if (m.taste(e.key)) { e.preventDefault(); if (e.key === 'Escape' || (e.key === 'Enter' || e.key === ' ') && !m.stand().offen) knopf.focus(); } });
  optionen.forEach((o) => o.addEventListener('click', () => { m.waehle(o.dataset.stufe); knopf.focus(); }));
  doc.addEventListener('click', (e) => { if (m.stand().offen && !wurzel.contains(e.target)) m.schliessen(); });
  m.setze(aktuell);
  return m;
}
