import { GROESSEN_LABEL, fmtProzent } from '../model/bilanz.js';

export function renderStats(root, korpusStats, data) {
  root.replaceChildren();
  const arch = data.arch;

  for (const [variante, v] of Object.entries(arch.varianten)) {
    const st = korpusStats[variante];
    const box = el('section', 'stat-box');
    box.append(el('h3', null, `${v.label} — ${st?.n ?? 0} Rezepte`));
    if (!st || !st.n) { box.append(el('p', 'fine', 'Korpus noch leer.')); root.append(box); continue; }

    const t = el('table', 'stat-table');
    t.append(tr(['Rolle', 'Median', 'Q1–Q3', 'min–max', 'Lehrbuch „schwer“'], 'th'));
    for (const r of arch.rollen.map((x) => x.rolle)) {
      const s = st.bp[r];
      if (!s) continue;
      const lb = arch.lehrbuch.schwer[r] ?? (r === 'trieb' ? arch.lehrbuch.trieb_richtwert : null);
      t.append(tr([
        arch.rollen.find((x) => x.rolle === r)?.label ?? r,
        `${f(s.median)} %`,
        `${f(s.q1)}–${f(s.q3)} %`,
        `${f(s.min)}–${f(s.max)} %`,
        lb != null ? `${lb} %` : '—',
      ]));
    }
    // Gesamtbilanz (DR-020): Wasser/Fett/Zucker über alle Zutaten, Bäckerprozent
    for (const [g, s] of Object.entries(st.bilanz || {})) {
      if (!s || !(s.max > 0)) continue; // Größe kommt im Archetyp nicht vor
      t.append(tr([`Σ ${GROESSEN_LABEL[g]}`, `${fmtProzent(s.median)} %`, `${fmtProzent(s.q1)}–${fmtProzent(s.q3)} %`, `${fmtProzent(s.min)}–${fmtProzent(s.max)} %`, '—']));
    }
    box.append(t);

    box.append(bar('Methoden', st.methoden, (k) => data.methods[k]?.label ?? k, st.n));
    box.append(bar('Fett', st.fettZutat, (k) => data.ingredients[k]?.label ?? k, st.n));
    box.append(bar('Flüssigkeit', st.fluessigkeitZutat, (k) => data.ingredients[k]?.label ?? k, st.n));
    box.append(bar('Einlage', st.einlageZutat, (k) => data.ingredients[k]?.label ?? k, st.n));

    const b = st.backen;
    const ofen = b.tempOU?.median != null;
    box.append(el('p', 'fine',
      `${ofen ? 'Backen' : 'Garzeit'} (Median): ${ofen ? `${f(b.tempOU.median)} °C O/U · ${f(b.tempUmluft?.median)} °C Umluft · ` : ''}${f(b.minuten?.median)} Min.${ofen ? '' : ' je Seite'} (${f(b.minuten?.min)}–${f(b.minuten?.max)}) · Teigmasse ${f(st.teigmasse?.median)} g`));

    const ul = el('ul', 'quellen');
    for (const q of st.quellen) {
      const li = el('li');
      if (q.url && /^https?:\/\//.test(q.url)) {
        const a = document.createElement('a');
        a.href = q.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = q.titel || q.id;
        li.append(a);
      } else li.append(el('span', null, q.titel || q.id));
      li.append(el('span', 'q-meta', ` — ${q.site ?? ''}${q.bewertung ? ` · ${q.bewertung}★` : ''}${q.anzahl ? ` (${q.anzahl})` : ''} · ${data.methods[q.methode]?.label ?? q.methode}${q.sauer ? ' · sauer' : ''}`));
      ul.append(li);
    }
    box.append(ul);

    if (st.unbekannt.length) {
      box.append(el('p', 'fine note-warn', `Nicht umrechenbar (fehlen in ingredients.json): ${st.unbekannt.join('; ')}`));
    }
    root.append(box);
  }
}

function bar(title, counts, labelFn, n) {
  const wrap = el('div', 'bar-group');
  wrap.append(el('div', 'bar-title', title));
  for (const [k, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const row = el('div', 'bar-row');
    row.append(el('span', 'bar-label', labelFn(k)));
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill');
    fill.style.width = `${(c / n) * 100}%`;
    track.append(fill);
    row.append(track, el('span', 'bar-n', String(c)));
    wrap.append(row);
  }
  return wrap;
}

function tr(cells, tag = 'td') {
  const r = document.createElement('tr');
  for (const c of cells) r.append(el(tag, null, c));
  return r;
}
function f(x) { return x == null ? '—' : String(Math.round(x)); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
