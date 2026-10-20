// Fehlermeldung als Dateien (DR-044): gleiches Format wie aktien-monitor issues/open/<Zeit>-<slug>/ — issue.md, meta.json,
// wireframe.png, anhang/. Rein (ohne DOM), damit es testbar ist; ui/fehlerMelden.js packt das Ergebnis als ZIP.
const zweistellig = (n) => String(n).padStart(2, '0');
export function slugVon(titel) {
  return titel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fehler';
}
const dateiname = (n) => n.split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'anhang';

export function meldungDateien({ titel, beschreibung, auto, picks: gewaehlt, wireframePng, anhaenge: anh }, jetzt = new Date()) {
  const stempel = `${jetzt.getFullYear()}${zweistellig(jetzt.getMonth() + 1)}${zweistellig(jetzt.getDate())}-${zweistellig(jetzt.getHours())}${zweistellig(jetzt.getMinutes())}${zweistellig(jetzt.getSeconds())}`;
  const ordner = `${stempel}-${slugVon(titel)}`;
  const namen = [];
  const anhangDateien = anh.map((a) => {
    let n = dateiname(a.name);
    for (let k = 1; namen.includes(n); k++) n = `${k}_${dateiname(a.name)}`;
    namen.push(n);
    return { name: `${ordner}/anhang/${n}`, inhalt: a.daten };
  });
  const meta = { title: titel, created: jetzt.toISOString().slice(0, 19), status: 'open', auto, picks: gewaehlt, attachments: namen };
  const pickMd = (p, i) => {
    const c = p.ctx || {};
    const zeilen = [`${i + 1}. ${c.panel ? `**${c.panel}** – ` : ''}\`${p.selector}\` – ${(p.text || '').slice(0, 80)} (BBox ${JSON.stringify(p.bbox)})`];
    for (const [k, v] of Object.entries({ Kasten: c.kasten_zeile, Ablauf: c.ablauf_zeile, Knopf: c.knopf, Tabelle: c.tabellen_zeile })) if (v) zeilen.push(`   - ${k}: ${v}`);
    if (c.html) zeilen.push(`   <details><summary>HTML</summary>\n\n   \`\`\`html\n   ${c.html.replace(/\n/g, ' ').slice(0, 1500)}\n   \`\`\`\n   </details>`);
    return zeilen.join('\n');
  };
  const md = [
    `# ${titel}`, '', `Erstellt ${meta.created} · Seite \`${auto.seite ?? ''}\` · Version ${JSON.stringify(auto.version)} · Status open`, '',
    '## Beschreibung', '', beschreibung || '–', '',
    ...(auto.markiert ? ['## Markierter Text', '', `> ${String(auto.markiert).replace(/\n/g, '\n> ')}`, ''] : []),
    '## Gewählte Elemente', '', gewaehlt.map(pickMd).join('\n') || '–', '',
    ...(wireframePng ? ['![Wireframe](wireframe.png)', ''] : []),
    '## Anhänge', '', namen.map((a) => `- [${a}](anhang/${a})`).join('\n') || '–', '',
    '## App-Zustand', '', '```json', JSON.stringify(auto.app ?? {}, null, 1), '```', '',
    '## Umgebung', '', `- Viewport ${auto.viewport} · ${auto.browser}`, `- JS-Fehler: ${(auto.js_fehler || []).join('; ') || '–'}`, '',
    '## Letzte Aktionen', '', (auto.letzte_aktionen || []).map((a) => `- ${a}`).join('\n') || '–', '',
  ].join('\n');
  return {
    zipName: `chefing-fehler-${ordner}.zip`,
    dateien: [
      { name: `${ordner}/issue.md`, inhalt: md },
      { name: `${ordner}/meta.json`, inhalt: JSON.stringify(meta, null, 1) },
      ...(wireframePng ? [{ name: `${ordner}/wireframe.png`, inhalt: wireframePng }] : []),
      ...anhangDateien,
    ],
  };
}
