// DR-122: Menge einer Zutat festlegen, der Rest folgt (state.skala): Rechnung, Hinweis zur Form, Rückweg, Anbindung in der Rezeptkarte (Mini-DOM).
import fs from 'fs';
const P = new URL('../src/', import.meta.url).href;
const J = (n) => JSON.parse(fs.readFileSync(new URL(P + 'data/' + n + '.json')));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

class Knoten {
  constructor(tag) { this.tag = tag; this.className = ''; this.children = []; this._text = ''; this.handler = {}; this.attr = {}; }
  append(...k) { this.children.push(...k); }
  replaceChildren() { this.children = []; }
  addEventListener(ev, fn) { (this.handler[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attr[k] = v; }
  set textContent(t) { this._text = String(t); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  klick() { for (const f of this.handler.click || []) f({ preventDefault() {} }); }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}
globalThis.document = { createElement: (t) => new Knoten(t) };
const alle = (k, f, aus = []) => { if (f(k)) aus.push(k); for (const c of k.children) alle(c, f, aus); return aus; };

const S = await import(P + 'model/skala.js');
const Z = await import(P + 'model/zustand.js');
const { renderRecipe } = await import(P + 'ui/recipeCard.js');
const { compute } = await import(P + 'model/engine.js');
const { normalizeRecipe, stats } = await import(P + 'model/corpus.js');

const names = ['ingredients', 'operations', 'methods', 'archetypes', 'vessels', 'kategorien', 'verben', 'erfahrungsregeln', 'grenzen', 'modelle', 'temperaturen'];
const data = Object.fromEntries(names.map((x) => [x, J(x)]));
const ruehr = data.archetypes.ruehrteig; const rr = ruehr.rollen.map((r) => r.rolle); const ks = {};
for (const [k, x] of Object.entries(ruehr.varianten)) ks[k] = stats(J('corpus/' + x.korpus).map((r) => normalizeRecipe(r, data.ingredients, { rollen: rr })), rr);
const v0 = ruehr.varianten.kastenkuchen; const basis = {};
for (const r of ruehr.rollen) basis[r.rolle] = Z.alsEintraege(v0.bestof[r.rolle] !== undefined ? v0.bestof[r.rolle] : r.default);
const zustand = (skala) => ({ archetyp: 'ruehrteig', variante: 'kastenkuchen', gefaess: v0.gefaess, methode: null, fixiert: { rollen: {}, zutaten: {} }, zutaten: { ...basis }, mengen: {}, ...(skala === undefined ? {} : { skala }) });
const rechne = (skala) => compute(zustand(skala), data, ks);

// --- Rechnung --------------------------------------------------------------------------------------------------------------------
ok(Math.abs(S.eingabeInGramm({}, 200, 'g') - 200) < 1e-9 && Math.abs(S.eingabeInGramm({ umrechnung: { ml: 0.92 } }, 100, 'ml') - 92) < 1e-9 && S.eingabeInGramm({ umrechnung: { stk: 60 } }, 3, 'Stk') === 180 && S.eingabeInGramm({}, 2, 'Stk') === 110, 'Eingabe in Gramm: g, ml mit Dichte, Stück mit Stückgewicht (Vorgabe 55 g wie bei der Anzeige)');
ok(S.eingabeInGramm({}, 0, 'g') === null && S.eingabeInGramm({}, -5, 'g') === null && S.eingabeInGramm({}, NaN, 'g') === null, 'Eingabe 0, negativ oder keine Zahl gilt nicht');
ok(S.skalaFuerMenge(1, 100, 150) === 1.5 && S.skalaFuerMenge(2, 200, 100) === 1 && S.skalaFuerMenge(1, 100, 1) === null && S.skalaFuerMenge(1, 100, 5000) === null && S.skalaFuerMenge(1, 0, 10) === null, 'Faktor: bezieht sich auf den jetzigen Faktor; unter 0,1 oder über 10 und ungültige Werte gelten nicht');
ok(S.gueltigeSkala(undefined) === 1 && S.gueltigeSkala('x') === 1 && S.gueltigeSkala(0) === 1 && S.gueltigeSkala(1.5) === 1.5, 'fehlender oder ungültiger Faktor zählt als 1');

const eins = rechne(); const zwei = rechne(2);
ok(eins.skala === 1 && eins.skalaHinweis === null && rechne(1).teigmasse === eins.teigmasse, 'ohne Faktor: Menge des Gefäßes, kein Hinweis');
ok(Math.abs(zwei.teigmasse - 2 * eins.teigmasse) < 1e-6 && zwei.zutatenListe.every((z, i) => Math.abs(z.gramm - 2 * eins.zutatenListe[i].gramm) < 1e-6), 'Faktor 2: Teigmasse und jede Zutat doppelt');
ok(zwei.zutatenListe.every((z, i) => z.bp === eins.zutatenListe[i].bp) && JSON.stringify(zwei.bilanz.map((b) => b.bp)) === JSON.stringify(eins.bilanz.map((b) => b.bp)), 'Bäcker-% und Bilanz in Prozent bleiben gleich');
ok(JSON.stringify(zwei.backen) === JSON.stringify(eins.backen) && zwei.status === eins.status, 'Backzeit, Temperatur und Status bleiben die der Form');
const butter = eins.zutatenListe.find((z) => z.zutat === 'butter');
const skalaButter = S.skalaFuerMenge(1, butter.gramm, 300);
const mitButter = rechne(skalaButter);
ok(butter && Math.abs(mitButter.zutatenListe.find((z) => z.zutat === 'butter').gramm - 300) < 1e-6, 'Butter auf 300 g festlegen: die Butter hat genau 300 g (ungerundet), die anderen Zutaten skalieren mit');
const ei = eins.zutatenListe.find((z) => z.zutat === 'ei');
const eier3 = S.skalaFuerMenge(1, ei.gramm, S.eingabeInGramm(data.ingredients.ei, 3, 'Stk'));
ok(ei && rechne(eier3).zutatenListe.find((z) => z.zutat === 'ei').menge === 3, '3 Eier festlegen: die Eier zeigen 3 Stück');

// --- Hinweis zur Form ------------------------------------------------------------------------------------------------------------
const form = { label: 'Kastenform 25 cm', teigmasse_g: 1000, basis: {} };
ok(S.skalaHinweis(1, form) === null && S.skalaHinweis(0.8, form) === null && S.skalaHinweis(1.02, form) === null, 'um 1 und bis etwa 70 % Füllung: kein Hinweis');
ok(/2 Ansätze zu je etwa 1000 g/.test(S.skalaHinweis(2, form)) && /je Ansatz/.test(S.skalaHinweis(2, form)) && /3 Ansätze zu je etwa 1000 g/.test(S.skalaHinweis(3, form)), 'ab 1,5: n Ansätze, Backzeit gilt je Ansatz');
ok(/größere Form/.test(S.skalaHinweis(1.2, form)) && /nur für 1000 g/.test(S.skalaHinweis(1.2, form)), 'zwischen 1 und 1,5: größere Form, Backzeit gilt nur für die Form');
ok(/kleinere Form/.test(S.skalaHinweis(0.5, form)) && /50 %/.test(S.skalaHinweis(0.5, form)), 'unter etwa 70 %: kleinere Form');
ok(S.skalaHinweis(2, { label: 'Schüssel', teigmasse_g: 500 }) === null, 'ohne Hitze (Mayonnaise): kein Hinweis zur Backzeit (Untergrenzen sind T153)');
ok(typeof zwei.skalaHinweis === 'string' && /Ansätze/.test(zwei.skalaHinweis), 'die Rechnung liefert den Hinweis mit');

// --- Rückweg ---------------------------------------------------------------------------------------------------------------------
ok(Z.presetPatch(ruehr, 'muffin').skala === 1 && Z.archetypPatch(ruehr, 'ruehrteig').skala === 1 && Z.gefaessPatch('x').skala === 1, 'Preset-, Archetyp- und Gefäß-Wechsel setzen den Faktor zurück (gehört zum Rezept, nicht gemerkt)');

// --- Rezeptkarte -----------------------------------------------------------------------------------------------------------------
const zeige = (skala, onChange) => { const c = rechne(skala); const w = new Knoten('div'); renderRecipe(w, c, zustand(skala), { ...data, appVersion: 't' }, onChange); return w; };
let w = zeige(1, () => {});
ok(!/Menge festgelegt/.test(w.textContent) && alle(w, (k) => k.tag === 'button' && k.className === 'kaskade-btn' && k.textContent === 'Zurück').length === 0, 'ohne Faktor: kein Hinweis, kein Zurück');
const aufrufe = [];
w = zeige(2, (p) => aufrufe.push(p));
const zurueck = alle(w, (k) => k.tag === 'button' && k.textContent === 'Zurück');
ok(/Menge festgelegt: ×2 der Gefäß-Menge/.test(w.textContent) && /Bäcker-% bleibt gleich/.test(w.textContent) && zurueck.length === 1, 'mit Faktor: Hinweis „×2 der Gefäß-Menge“ und ein Zurück');
zurueck[0].klick();
ok(aufrufe.length === 1 && aufrufe[0].skala === 1, 'Zurück setzt den Faktor auf 1');
ok(/Ansätze/.test(w.textContent), 'der Hinweis zur Form steht in der Karte');
const zahlen = alle(w, (k) => k.tag === 'button' && k.className === 'menge-wert');
ok(zahlen.length === zwei.zutatenListe.length && zahlen[0].textContent === `${zwei.zutatenListe[0].menge} ${zwei.zutatenListe[0].einheit}${zwei.zutatenListe[0].hinweis ? ` (${zwei.zutatenListe[0].hinweis})` : ''}`, 'jede Zutat hat ihre Menge als Knopf zum Festlegen');

// --- Anbindung (Quelltext) -------------------------------------------------------------------------------------------------------
const karte = fs.readFileSync(new URL('../src/ui/recipeCard.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
ok(/skalaFuerMenge\(computed\.skala, z\.gramm, eingabeInGramm\(ing, Number\(feld\.value\), z\.einheit\)\)/.test(karte) && /onChange\(\{ skala \}\)/.test(karte) && /e\.key === 'Enter'\) ende\(true\)/.test(karte) && /e\.key === 'Escape'\) ende\(false\)/.test(karte) && /addEventListener\('blur'/.test(karte), 'Eingabe in der Zelle: Enter und Verlassen übernehmen, Esc verwirft, gerechnet aus den ungerundeten Gramm der Zutat');
ok(/^\s+skala: 1,$/m.test(main) && !/localStorage[^;]*skala/.test(main), 'main.js: Startzustand skala 1, nicht gemerkt');
ok(/\.menge-wert \{/.test(css) && /\.menge-feld \{/.test(css), 'CSS: Knopf und Feld zum Festlegen');
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
