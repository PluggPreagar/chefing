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

// --- Portionen (DR-123) ----------------------------------------------------------------------------------------------------------
const kasten = data.vessels.kastenform_25;
ok(S.portionGramm(kasten) === 150 && S.portionGramm(kasten, 'wenig') === 112.5 && S.portionGramm(kasten, 'viel') === 187.5 && S.portionGramm(kasten, 'quatsch') === 150 && S.portionGramm(data.vessels.brotform_25) === null && S.portionGramm(data.vessels.glas_250) === null, 'Portion: 150 g Teig beim Kuchen, Wenig 0,75 und Viel 1,25 davon, ungültige Größe zählt als Normal; Brotlaib und Mayonnaise haben keine');
ok(S.skalaFuerPortionen(kasten, 4, 'normal') === 0.6 && S.skalaFuerPortionen(kasten, 4, 'viel') === 0.75 && S.skalaFuerPortionen(kasten, 0, 'normal') === null && S.skalaFuerPortionen(kasten, 1000, 'normal') === null && S.skalaFuerPortionen(data.vessels.brotform_25, 4, 'normal') === null, 'n Portionen ergeben den Faktor (4 × 150 g von 1000 g = 0,6); 0, zu viele oder ohne Portion: keiner');
ok(Math.abs(S.skalaFuerPortionen(kasten, 1000 / 150, 'normal') - 1) < 1e-9, 'die Kastenform ergibt etwa 6,7 Portionen');
ok(S.wirksameSkala({ skala: 1, portionen: 4 }, kasten).quelle === 'portionen' && S.wirksameSkala({ skala: 1 }, kasten).quelle === 'gefaess' && S.wirksameSkala({ skala: 1.5, portionen: 4 }, kasten).quelle === 'zutat' && S.wirksameSkala({ skala: 1.5, portionen: 4 }, kasten).skala === 1.5 && S.wirksameSkala({ skala: 1, portionen: 4 }, data.vessels.brotform_25).quelle === 'gefaess', 'eine festgelegte Zutat geht vor, sonst die Portionen, sonst das Gefäß; ohne Portionsgröße des Gefäßes bleibt es beim Gefäß');
const pi = S.portionInfo(data.vessels.muffinform_12, 'normal', 800, 'gefaess');
ok(pi.gramm === 130 && Math.abs(pi.n - 800 / 130) < 1e-9 && pi.stueck === 2 && pi.aktiv === false && S.portionInfo(kasten, 'normal', 1000, 'portionen').stueck === null && S.portionInfo(kasten, 'normal', 1000, 'portionen').aktiv === true && S.portionInfo(data.vessels.glas_250, 'normal', 250, 'gefaess') === null, 'Portionsangaben: Gramm, Zahl, Stück nur bei Gefäßen mit mehreren Stück (Muffin etwa 2), aktiv bei gemerkten Portionen, keine ohne Portionsgröße');
const vier = compute({ ...zustand(), portionen: 4 }, data, ks);
ok(vier.skalaQuelle === 'portionen' && Math.abs(vier.teigmasse - 600) < 1e-6 && vier.skala === 0.6 && vier.portion.aktiv && Math.abs(vier.portion.n - 4) < 1e-9, '4 Portionen: 600 g statt 1000 g, Faktor 0,6, die Rechnung nennt die Zahl zurück');
const vierViel = compute({ ...zustand(), portionen: 4, portionsgroesse: 'viel' }, data, ks);
ok(Math.abs(vierViel.teigmasse - 750) < 1e-6 && vierViel.zutatenListe.every((z, i) => z.bp === eins.zutatenListe[i].bp), 'Vielesser: 4 Portionen = 750 g, Bäcker-% gleich');
const fest = compute({ ...zustand(2), portionen: 4 }, data, ks);
ok(fest.skalaQuelle === 'zutat' && Math.abs(fest.teigmasse - 2 * eins.teigmasse) < 1e-6 && fest.portion.aktiv === false, 'festgelegte Zutat geht vor die gemerkten Portionen; Zurück (Faktor 1) bringt sie wieder');
ok(compute({ ...zustand(1), portionen: 4 }, data, ks).skalaQuelle === 'portionen', 'Faktor 1 lässt die gemerkten Portionen wirken');
ok(eins.skalaQuelle === 'gefaess' && /Portionen/.test(String(eins.portion.n)) === false && Math.abs(eins.portion.n - 1000 / 150) < 1e-9, 'ohne Wahl: Basis Gefäß, die Form ergibt etwa 6,7 Portionen');
ok(Z.presetPatch(ruehr, 'muffin').portionen === undefined && Z.archetypPatch(ruehr, 'ruehrteig').portionen === undefined && Z.gefaessPatch('x').portionen === undefined, 'Preset-, Archetyp- und Gefäß-Wechsel lassen die gemerkten Portionen unangetastet');
const klein = compute({ ...zustand(), portionen: 1 }, data, ks);
ok(klein.rundungsHinweise.length === 1 && /nur ganz teilbar/.test(klein.rundungsHinweise[0]) && eins.rundungsHinweise.length === 0 && S.rundungsHinweise(1, eins.zutatenListe, data.ingredients).length === 0, 'Eier sind nur ganz teilbar: bei 1 Portion der Hinweis (rechnerisch 0,6 Stück, gezeigt 1), ohne Skalierung keiner');
ok(/größere Form/.test(compute({ ...zustand(), portionen: 8 }, data, ks).skalaHinweis) && compute({ ...zustand(), portionen: 7 }, data, ks).skalaHinweis === null && /kleinere Form/.test(compute({ ...zustand(), portionen: 3 }, data, ks).skalaHinweis), 'Form-Hinweis bei Portionen: 7 passen noch in die Kastenform, 8 nicht, 3 füllen sie zu wenig');

const zeigeP = (st, onChange) => { const c = compute(st, data, ks); const w2 = new Knoten('div'); renderRecipe(w2, c, st, { ...data, appVersion: 't' }, onChange); return { c, w: w2 }; };
const taste = (w2, text) => alle(w2, (k) => k.tag === 'button' && k.textContent === text);
let pr = zeigeP(zustand(), () => {});
ok(alle(pr.w, (k) => k.className === 'portionen').length === 1 && taste(pr.w, 'Gefäß').length === 1 && taste(pr.w, 'Portionen').length === 1 && taste(pr.w, 'Normal').length === 0 && /Diese Form ergibt etwa 6,7 Portionen zu je 150 g Teig \(Schätzung\)/.test(pr.w.textContent), 'Basis Gefäß: Zeile mit Gefäß | Portionen, kein Zähler, die Form nennt ihre Portionen als Schätzung');
const ap = [];
pr = zeigeP(zustand(), (p) => ap.push(p));
taste(pr.w, 'Portionen')[0].klick();
ok(ap.length === 1 && ap[0].portionen === 7 && ap[0].skala === 1, 'Portionen wählen: beginnt mit der Zahl der Form (7), Faktor 1');
pr = zeigeP({ ...zustand(), portionen: 4 }, (p) => ap.push(p));
ok(taste(pr.w, 'Wenig').length === 1 && taste(pr.w, 'Normal').length === 1 && taste(pr.w, 'Viel').length === 1 && taste(pr.w, '−').length === 1 && taste(pr.w, '+').length === 1 && /je Portion 150 g Teig \(Schätzung\)/.test(pr.w.textContent) && !/Menge festgelegt/.test(pr.w.textContent), 'Basis Portionen: Zähler (− n +), Größe Wenig | Normal | Viel, je Portion in Gramm als Schätzung');
const gedrueckt = alle(pr.w, (k) => k.attr && k.attr['aria-pressed'] === 'true').map((k) => k.textContent);
ok(gedrueckt.join() === 'Portionen,Normal', 'gewählt sind Portionen und Normal');
taste(pr.w, '+')[0].klick(); taste(pr.w, '−')[0].klick(); taste(pr.w, 'Viel')[0].klick(); taste(pr.w, 'Gefäß')[0].klick();
ok(JSON.stringify(ap.slice(1)) === JSON.stringify([{ portionen: 5, skala: 1 }, { portionen: 3, skala: 1 }, { portionsgroesse: 'viel' }, { portionen: null }]), '+ und − ändern um eine Portion (und nehmen eine festgelegte Zutat zurück), Größe, Gefäß: Zahl vergessen');
pr = zeigeP(zustand(), () => {});
ok(alle(pr.w, (k) => k.className === 'portionen').length === 1, 'bleibt eine Zeile');
const brot = compute({ ...zustand(), portionen: 4, gefaess: 'brotform_25' }, data, ks);
ok(brot.portion === null && brot.skalaQuelle === 'gefaess', 'Brotlaib: keine Portionen, die Form ist die Basis');

// --- Anbindung (Quelltext) -------------------------------------------------------------------------------------------------------
const karte = fs.readFileSync(new URL('../src/ui/recipeCard.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
ok(/skalaFuerMenge\(computed\.skala, z\.gramm, eingabeInGramm\(ing, Number\(feld\.value\), z\.einheit\)\)/.test(karte) && /onChange\(\{ skala \}\)/.test(karte) && /e\.key === 'Enter'\) ende\(true\)/.test(karte) && /e\.key === 'Escape'\) ende\(false\)/.test(karte) && /addEventListener\('blur'/.test(karte), 'Eingabe in der Zelle: Enter und Verlassen übernehmen, Esc verwirft, gerechnet aus den ungerundeten Gramm der Zutat');
ok(/^\s+skala: 1,$/m.test(main) && !/localStorage[^;]*skala/.test(main), 'main.js: Startzustand skala 1, nicht gemerkt');
ok(/localStorage\.getItem\('chefing\.portionen'\)/.test(main) && /localStorage\.setItem\('chefing\.portionen', String\(patch\.portionen\)\)/.test(main) && /localStorage\.removeItem\('chefing\.portionen'\)/.test(main) && /localStorage\.setItem\('chefing\.portionsgroesse', patch\.portionsgroesse\)/.test(main) && /portionen: gemerktePortionen\(\),\s+portionsgroesse: gemerktePortionsgroesse\(\)/.test(main) && /Object\.assign\(state, patch\);\s+merkePortionen\(patch\);/.test(main), 'main.js: Portionenzahl und Größe pro Browser gemerkt (chefing.portionen, chefing.portionsgroesse), beim Start gelesen, bei jeder Änderung geschrieben, Gefäß vergisst die Zahl');
ok(/\.portionen \{/.test(css) && /\.portionen-feld \{/.test(css) && /\.portionen-schritt \{/.test(css), 'CSS: Zeile Basis mit Zähler und Größe');
ok(/\.menge-wert \{/.test(css) && /\.menge-feld \{/.test(css), 'CSS: Knopf und Feld zum Festlegen');
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
