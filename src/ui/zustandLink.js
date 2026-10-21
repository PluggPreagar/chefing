// Kurzer Verweis auf einen Soll-Zustand (Fehlermeldung 20261021-074058 „Vorbereiten zu lang“, DR-068): „Butter weich“ als Link;
// ein Klick öffnet die Klappe an der Zutat im Rezept (Wege dorthin) und hebt sie kurz hervor — kein Hover, geht auch auf dem Handy.
export function zustandLink(z) {
  const a = document.createElement('a');
  a.className = 'zustand-link';
  a.href = `#zustand-${z.rolle}`;
  a.textContent = `${z.zutat} ${z.label}`;
  a.title = `${z.anzeige} — Wege anzeigen`;
  a.addEventListener('click', (e) => {
    const d = document.getElementById(`zustand-${z.rolle}`);
    if (!d) return;
    e.preventDefault();
    d.open = true;
    d.scrollIntoView({ behavior: 'smooth', block: 'center' });
    d.classList.add('hervorheben');
    setTimeout(() => d.classList.remove('hervorheben'), 1600);
  });
  return a;
}

// „Vorbereiten: Butter weich · Eier zimmerwarm“ — eine Zeile, die Teile sind Links
export function vorbereitenZeile(zustaende, cls, mitGewaehlt = false) {
  const p = document.createElement('div');
  p.className = cls;
  const b = document.createElement('b');
  b.textContent = 'Vorbereiten: ';
  p.append(b);
  zustaende.forEach((z, i) => {
    if (i) p.append(text(' · '));
    p.append(zustandLink(z));
    if (mitGewaehlt && z.gewaehlt) p.append(text(' ✓ im Ablauf'));
  });
  return p;
}

const text = (t) => { const s = document.createElement('span'); s.textContent = t; return s; };
