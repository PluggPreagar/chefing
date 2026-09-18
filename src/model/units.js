export function toGrams(ing, menge, einheit) {
  if (menge == null || !isFinite(menge)) return null;
  if (einheit === 'g') return menge;
  const u = ing?.umrechnung || {};
  if (einheit === 'ml') return menge * (u.ml ?? 1);
  const f = u[einheit];
  return f == null ? null : menge * f;
}

export function fromGrams(zutatKey, ing, grams) {
  if (zutatKey === 'ei') {
    const stk = Math.max(1, Math.round(grams / (ing.umrechnung?.stk ?? 55)));
    return { menge: stk, einheit: 'Stk', hinweis: `≈ ${Math.round(grams)} g` };
  }
  const u = ing?.umrechnung || {};
  if (ing?.aggregat === 'fluessig' && u.ml && zutatKey !== 'ei') {
    return { menge: round5(grams / u.ml), einheit: 'ml', hinweis: null };
  }
  if (u.pkt && grams >= u.pkt * 0.4) {
    const pkt = grams / u.pkt;
    return { menge: Math.round(grams), einheit: 'g', hinweis: `≈ ${fmtFrac(pkt)} Pck.` };
  }
  if (u.tl && grams < 25) {
    return { menge: Math.round(grams), einheit: 'g', hinweis: `≈ ${fmtFrac(grams / u.tl)} TL` };
  }
  return { menge: round5(grams), einheit: 'g', hinweis: null };
}

function round5(x) { return x < 50 ? Math.round(x) : Math.round(x / 5) * 5; }

function fmtFrac(x) {
  const r = Math.round(x * 2) / 2;
  return r % 1 === 0 ? String(r) : `${Math.floor(r)}½`.replace(/^0½$/, '½');
}

export function bakersPercent(grams, refGrams) {
  return refGrams > 0 && grams != null ? (grams / refGrams) * 100 : null;
}

export function quantile(values, q) {
  const v = values.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const median = (values) => quantile(values, 0.5);

export function summarize(values) {
  const clean = values.filter((x) => x != null && isFinite(x));
  if (!clean.length) return null;
  return {
    n: clean.length,
    min: Math.min(...clean),
    q1: quantile(clean, 0.25),
    median: quantile(clean, 0.5),
    q3: quantile(clean, 0.75),
    max: Math.max(...clean),
  };
}
