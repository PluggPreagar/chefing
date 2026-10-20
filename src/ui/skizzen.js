// Erklär-Skizzen für besondere Handgriffe (DR-055): ein Schritt nennt `skizze: <key>`, die Details im Ablauf zeigen sie.
// Reine SVG-Strings ohne DOM, Farben aus style.css (--skz-*), damit Hell/Dunkel stimmt.

const becher = (x, inhalt, unter) => `
  <g transform="translate(${x},8)">
    ${inhalt}
    <rect x="0" y="0" width="44" height="96" rx="5" fill="none" stroke="var(--ink)" stroke-width="1.6"/>
    <text x="22" y="114" text-anchor="middle" class="skz-t">${unter}</text>
  </g>`;
const schicht = (y, h, farbe) => `<rect x="1.5" y="${y}" width="41" height="${h}" fill="var(${farbe})"/>`;
const stab = (bis) => `<rect x="19" y="-10" width="6" height="${bis + 10}" fill="var(--muted)"/><rect x="13" y="${bis}" width="18" height="5" rx="1" fill="var(--muted)"/>`;
const pfeilHoch = (x, y1, y2) => `<path d="M${x} ${y1} L${x} ${y2} M${x - 4} ${y2 + 6} L${x} ${y2} L${x + 4} ${y2 + 6}" stroke="var(--ink)" stroke-width="1.6" fill="none"/>`;
const svg = (breite, inhalt, label) => `<svg viewBox="0 0 ${breite} 128" role="img" aria-label="${label}" class="skz">${inhalt}</svg>`;

export const SKIZZEN = {
  // Mayonnaise mit dem Pürierstab: Schichten → am Boden halten, bis es weiß wird → langsam hochziehen → fertig
  puerierstab: {
    titel: 'Pürierstab im Mixbecher',
    legende: 'gelb = Öl · blau = Wasserphase (Eigelb, Säure, Senf) · hell = Emulsion (Öl in Wasser)',
    svg: () => svg(232, [
      becher(4, schicht(28, 50, '--skz-oel') + schicht(78, 16.5, '--skz-wasser'), '1 Schichten'),
      becher(62, schicht(28, 44, '--skz-oel') + schicht(72, 22.5, '--skz-emul') + stab(84), '2 unten'),
      becher(120, schicht(28, 16, '--skz-oel') + schicht(44, 50.5, '--skz-emul') + stab(40) + pfeilHoch(36, 86, 54), '3 hoch'),
      becher(178, schicht(34, 60.5, '--skz-emul'), '4 fertig'),
    ].join(''), 'Pürierstab: Schichten, unten halten, hochziehen, fertig'),
  },
  // Mayonnaise von Hand: erst Tropfen, bis die Masse bindet, dann der Rest im dünnen Strahl
  tropfenweise: {
    titel: 'Öl erst tropfenweise, dann im Strahl',
    legende: 'Die Emulsion wächst: erst wenn sie bindet (dicklich, glänzend), trägt sie mehr Öl auf einmal.',
    svg: () => {
      const schale = (x, inhalt, unter) => `<g transform="translate(${x},8)">${inhalt}<path d="M0 50 Q22 96 44 50" fill="none" stroke="var(--ink)" stroke-width="1.6"/><text x="22" y="114" text-anchor="middle" class="skz-t">${unter}</text></g>`;
      // Füllung bis zur Höhe `h` über dem Schalenboden: Punkte auf der Schalenkurve y = 50 + 92·t(1−t), x = 44·t
      const masse = (h, farbe) => {
        const k = (73 - h - 50) / 92;
        const t1 = (1 - Math.sqrt(1 - 4 * k)) / 2;
        const pkt = Array.from({ length: 13 }, (_, i) => { const t = t1 + ((1 - 2 * t1) * i) / 12; return `${(44 * t).toFixed(1)} ${(50 + 92 * t * (1 - t)).toFixed(1)}`; });
        return `<path d="M${pkt.join(' L')} Z" fill="var(${farbe})"/>`;
      };
      const tropfen = (x, y) => `<path d="M${x} ${y} q3 6 0 8 q-3 -2 0 -8" fill="var(--skz-oel)"/>`;
      return svg(232, [
        schale(4, masse(4, '--skz-wasser') + tropfen(22, 20) + tropfen(22, 36), '1 Tropfen'),
        schale(62, masse(8, '--skz-emul') + tropfen(22, 26), '2 bindet'),
        schale(120, masse(13, '--skz-emul') + '<rect x="21" y="6" width="2.5" height="48" fill="var(--skz-oel)"/>', '3 Strahl'),
        schale(178, masse(18, '--skz-emul'), '4 fest'),
      ].join(''), 'Von Hand: Tropfen, bindet, Strahl, fest');
    },
  },
  // Eischnee unterheben: ein Drittel lockert den Teig, der Rest wird mit dem Spatel von unten nach oben gezogen
  unterheben: {
    titel: 'Eischnee unterheben',
    legende: 'Erst ein Drittel unterrühren (lockert den Teig), den Rest mit dem Spatel von unten nach oben heben — nicht rühren.',
    svg: () => {
      const schale = (x, inhalt, unter) => `<g transform="translate(${x},8)">${inhalt}<path d="M0 40 Q30 104 60 40" fill="none" stroke="var(--ink)" stroke-width="1.6"/><text x="30" y="114" text-anchor="middle" class="skz-t">${unter}</text></g>`;
      const teig = '<path d="M6 54 Q30 92 54 54 Z" fill="var(--skz-teig)"/>';
      const schnee = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--skz-emul)" stroke="var(--muted)" stroke-width=".8"/>`;
      const bogen = '<path d="M15 60 Q30 74 44 54" fill="none" stroke="var(--ink)" stroke-width="1.6"/><path d="M39 53 L44 54 L44 59" fill="none" stroke="var(--ink)" stroke-width="1.6"/>';
      return svg(232, [
        schale(2, teig + schnee(30, 46, 8), '1 ⅓ unterrühren'),
        schale(84, teig.replace('var(--skz-teig)', 'var(--skz-teig-hell)') + schnee(22, 44, 9) + schnee(38, 42, 9), '2 Rest darauf'),
        schale(166, teig.replace('var(--skz-teig)', 'var(--skz-teig-hell)') + schnee(24, 58, 4) + bogen, '3 heben'),
      ].join(''), 'Eischnee unterheben: ein Drittel, Rest darauf, von unten heben');
    },
  },
};

export const skizzeHtml = (key) => {
  const s = SKIZZEN[key];
  return s ? `<figure class="k-skizze"><figcaption>${s.titel}</figcaption>${s.svg()}<p class="skz-legende">${s.legende}</p></figure>` : '';
};
