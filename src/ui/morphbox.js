import { evaluateAll } from '../model/rules.js';
import { haeufigste } from '../model/corpus.js';
import { iconHtml } from './icons.js';

const STATUS_ICON = { ok: '✓', prep: '~', invalid: '✗' };

export function renderMorphbox(root, state, data, computed, korpusStats, onChange) {
  const arch = data.archetypes[state.archetyp];
  const variante = arch.varianten[computed.variante];
  const bestof = variante?.bestof ?? {};
  const st = korpusStats[computed.variante];
  const bestMethode = st ? haeufigste(st.methoden) : null;

  root.replaceChildren();

  root.append(
    dimension('Gefäß', 'Bestimmt Teigmasse, Temperatur, Zeit — und welcher Referenz-Korpus gilt.',
      arch.gefaesse.map((g) => option({
        label: data.vessels[g].label,
        sub: `${data.vessels[g].teigmasse_g} g Teig`,
        selected: state.gefaess === g,
        bestof: Object.values(arch.varianten).some((v) => v.gefaess === g),
        onClick: () => onChange({ gefaess: g }),
      }))),
  );

  root.append(
    dimension('Methode', 'Auto wählt die bewährteste gültige Methode. Manuell zeigt, warum eine Kombination (nicht) geht.',
      [
        option({ label: 'Auto', sub: `→ ${data.methods[computed.methodKey].label}`, selected: state.methode == null, onClick: () => onChange({ methode: null }) }),
        ...arch.methoden.map((m) => {
          const e = computed.evals[m];
          return option({
            label: data.methods[m].label,
            sub: `${STATUS_ICON[e.status]} ${e.status === 'ok' ? 'möglich' : e.status === 'prep' ? 'mit Vorbereitung' : 'nicht möglich'}`,
            selected: state.methode === m,
            bestof: m === bestMethode,
            status: e.status,
            title: [...e.gruende, ...e.warnungen].join('\n') || data.methods[m].kurz,
            onClick: () => onChange({ methode: m }),
          });
        }),
      ]),
  );

  for (const rolle of arch.rollen) {
    const opts = [...rolle.optionen];
    const items = opts.map((key) => {
      const ing = data.ingredients[key];
      const hyp = { ...state.zutaten, [rolle.rolle]: key };
      const ev = evaluateAll(hyp, state.gefaess, data);
      const irgendwasGeht = Object.values(ev).some((e) => e.status !== 'invalid');
      const grund = irgendwasGeht ? null : Object.values(ev)[0]?.gruende[0];
      return option({
        label: ing.label,
        iconKey: ing.kategorie,
        iconTitle: data.kategorien?.[ing.kategorie]?.label,
        sub: (ing.eigenschaften || [])[0] ?? '',
        selected: state.zutaten[rolle.rolle] === key,
        bestof: bestof[rolle.rolle] === key || (bestof[rolle.rolle] === undefined && rolle.default === key),
        status: irgendwasGeht ? null : 'invalid',
        title: grund ?? (ing.eigenschaften || []).join(' · '),
        onClick: () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: key } }),
      });
    });
    if (!rolle.pflicht) {
      items.unshift(option({
        label: '— keine —',
        sub: '',
        selected: !state.zutaten[rolle.rolle],
        bestof: bestof[rolle.rolle] === null,
        onClick: () => onChange({ zutaten: { ...state.zutaten, [rolle.rolle]: null } }),
      }));
    }
    root.append(dimension(rolle.label, rolle.hinweis ?? '', items));
  }
}

function dimension(title, hint, items) {
  const row = el('div', 'dim');
  const head = el('div', 'dim-head');
  head.append(el('div', 'dim-title', title));
  if (hint) head.append(el('div', 'dim-hint', hint));
  row.append(head);
  const opts = el('div', 'dim-options');
  opts.append(...items);
  row.append(opts);
  return row;
}

function option({ label, iconKey, iconTitle, sub, selected, bestof, status, title, onClick }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'opt';
  if (selected) b.classList.add('is-selected');
  if (bestof) b.classList.add('is-bestof');
  if (status === 'invalid') b.classList.add('is-invalid');
  if (status === 'prep') b.classList.add('is-prep');
  if (title) b.title = title;
  const labelEl = el('span', 'opt-label');
  if (iconKey) labelEl.insertAdjacentHTML('beforeend', iconHtml(iconKey, 15, iconTitle));
  labelEl.append(document.createTextNode(label));
  b.append(labelEl);
  if (sub) b.append(el('span', 'opt-sub', sub));
  if (bestof) b.append(el('span', 'opt-badge', 'Best of'));
  b.addEventListener('click', onClick);
  return b;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
