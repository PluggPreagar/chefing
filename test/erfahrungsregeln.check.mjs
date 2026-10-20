// T07: Erfahrungsregeln (erfahrungsregeln.json, DR-019/T23) und Methoden-Faktor (T46) an echten Daten.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const arch=data.archetypes.ruehrteig;
const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(variante, over={}){const v=arch.varianten[variante];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
// T48: Mengen kommen aus der Zelle der gewaehlten Methode, wenn es genug Rezepte gibt, sonst aus der Variante
const median=(r,cc,v='kastenkuchen')=>(ks[v].proMethode[cc.methodKey]??ks[v]).bp[r].median;
const hat=(c,re)=>c.anpassungen.some((a)=>re.test(a));
const approx=(a,b)=>Math.abs(a-b)<1e-9;

// Regeln stehen in der Reihenfolge, auf die sich die Prioritäts-Tests verlassen
const ids=data.erfahrungsregeln.regeln.map((r)=>r.id);
ok(ids.indexOf('natron_drittel')<ids.indexOf('saeure_reduziert_backpulver'),'Reihenfolge: Natron-Drittel vor Säure-Reduktion');

// Grundzustand: Korpus-Median, keine Anpassung
let c=compute(st('kastenkuchen'),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)) && approx(c.rollenBp.fett.bp,median('fett',c)) && c.anpassungen.length===0,'Basis (Backpulver, Milch, Butter): Korpus-Median, keine Anpassung');

// T48 im Rührteig: Crememethode (n ≥ 5) hat mehr Fett als der Variantenmedian über Creme und Rühr-Öl; Rühr-Öl (n = 4) fällt zurück
ok(c.methodKey==='creme' && ks.kastenkuchen.proMethode.creme.n===11 && ks.kastenkuchen.proMethode.ruehroel.n===4,'Kastenkuchen: Zellen „creme“ (n = 11) und „ruehroel“ (n = 4) — schon wenige Rezepte bilden eine Zelle (T48)');
ok(approx(c.rollenBp.fett.bp,ks.kastenkuchen.proMethode.creme.bp.fett.median) && ks.kastenkuchen.proMethode.creme.bp.fett.median!==ks.kastenkuchen.bp.fett.median && c.korpusNMethode===ks.kastenkuchen.proMethode.creme.n,`Creme-Fett ${median('fett',c).toFixed(0)} % statt Variantenmedian ${ks.kastenkuchen.bp.fett.median.toFixed(0)} % — die Karte nennt n der Methode`);
const roel=compute({...st('kastenkuchen'),methode:'ruehroel'},data,ks);
ok(roel.korpusNMethode===4 && approx(roel.rollenBp.fett.bp,ks.kastenkuchen.proMethode.ruehroel.bp.fett.median) && roel.rollenBp.fett.bp<0.85*ks.kastenkuchen.bp.fett.median,'Rühr-Öl (n = 4): eigene Rezepte statt Variantenmedian — weniger Fett als Creme (Öl hat 100 % Fettgehalt)');

// natron_drittel: Natron ist ~3× so stark → Menge gedrittelt
c=compute(st('kastenkuchen',{trieb:E('natron'),fluessigkeit:E('buttermilch')}),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)/3) && hat(c,/Natron ist ~3× so stark/),'Natron (mit Buttermilch): Trieb = Median / 3, Begründung sichtbar');
ok(!hat(c,/zusätzliches CO₂/),'Natron + saure Flüssigkeit: nur die erste passende Regel je Rolle (nicht zusätzlich ×0,85)');
ok(c.status!=='invalid','Natron mit Buttermilch bleibt gültig');

// saeure_reduziert_backpulver: saure Flüssigkeit liefert CO₂ → Backpulver −15 %
c=compute(st('kastenkuchen',{fluessigkeit:E('buttermilch')}),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)*0.85) && hat(c,/Buttermilch ist sauer und liefert zusätzliches CO₂/),'Backpulver + Buttermilch: −15 %, {fluessigkeit} durch das Label ersetzt');
c=compute(st('kastenkuchen',{fluessigkeit:E('joghurt')}),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)*0.85),'Backpulver + Joghurt: ebenfalls −15 %');
c=compute(st('kastenkuchen',{fluessigkeit:[{zutat:'milch',anteil:1},{zutat:'buttermilch',anteil:1}]}),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)*0.85),'Mischung Milch + Buttermilch zählt als sauer (ODER-verknüpft)');
c=compute(st('kastenkuchen',{fluessigkeit:E('wasser')}),data,ks);
ok(approx(c.rollenBp.trieb.bp,median('trieb',c)) && c.anpassungen.length===0,'neutrale Flüssigkeit (Wasser): keine Anpassung');

// oel_korpus_fallback: nur wenn der Korpus der Variante kein Öl-Rezept enthält und der Wert aus dem Korpus stammt
const ohneOel={...ks,kastenkuchen:{...ks.kastenkuchen,fettTyp:{fest:ks.kastenkuchen.n}}};
c=compute(st('kastenkuchen',{fett:E('pflanzenoel')}),data,ohneOel);
ok(approx(c.rollenBp.fett.bp,median('fett',c)*0.9) && hat(c,/kein Öl-Rezept/),'Öl ohne Öl-Rezept im Korpus: Fett −10 % (82 % → 100 % Fettgehalt)');
c=compute(st('kastenkuchen',{fett:E('butter')}),data,ohneOel);
ok(approx(c.rollenBp.fett.bp,median('fett',c)) && !hat(c,/kein Öl-Rezept/),'Butter: Regel gilt nicht');
ok((ks.kastenkuchen.fettTyp.fluessig||0)>0,'Voraussetzung des nächsten Falls: der echte Kastenkuchen-Korpus enthält Öl-Rezepte');
c=compute(st('kastenkuchen',{fett:E('pflanzenoel')}),data,ks);
ok(approx(c.rollenBp.fett.bp,median('fett',c)) && !hat(c,/kein Öl-Rezept/),'Öl mit Öl-Rezepten im Korpus: keine Pauschal-Korrektur');
const leer={...ks,kastenkuchen:{n:0,bp:{},methoden:{},backen:{},fettTyp:{}}};
c=compute(st('kastenkuchen',{fett:E('pflanzenoel')}),data,leer);
ok(c.rollenBp.fett.quelle==='schätzung' && approx(c.rollenBp.fett.bp,arch.rollen.find((r)=>r.rolle==='fett').fallback_bp) && !hat(c,/kein Öl-Rezept/),'ohne Korpus: Schätzwert (fallback_bp), `voraussetzung_quelle: korpus` verhindert die Regel');

// Regeln wirken auf die Zutatenliste (Gramm) und die Bilanz, nicht nur auf die Anzeige
const basis=compute(st('kastenkuchen'),data,ks);
const natron=compute(st('kastenkuchen',{trieb:E('natron'),fluessigkeit:E('buttermilch')}),data,ks);
const g=(cc)=>cc.zutatenListe.find((z)=>z.rolle==='trieb').gramm;
ok(g(natron)<g(basis)*0.6,`Natron-Rezept hat deutlich weniger Triebmittel-Gramm (${g(natron).toFixed(1)} g statt ${g(basis).toFixed(1)} g)`);
const tk=(cc)=>cc.bilanz.find((b)=>b.groesse==='triebkraft').bp;
ok(Math.abs(tk(natron)/tk(basis)-1)<0.6,`Triebkraft-Bilanz bleibt in derselben Größenordnung (${tk(natron).toFixed(1)} % vs. ${tk(basis).toFixed(1)} %) — die Regel ist physikalisch konsistent`);

// Methoden-Faktor (T46) und Archetyp-Fremdheit: Regeln greifen nur, wenn die Rolle belegt ist
c=compute({...st('kastenkuchen'),zutaten:{...st('kastenkuchen').zutaten,trieb:[]}},data,ks);
ok(c.rollenBp.trieb===undefined && !hat(c,/Natron|zusätzliches CO₂/),'Rolle ohne Zutat: keine Regel, kein Absturz');
const pf=J('archetypes').pfannkuchen; const ksP={};
for (const [k,v] of Object.entries(pf.varianten)) ksP[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:pf.rollen.map(x=>x.rolle)})),pf.rollen.map(x=>x.rolle));
const zP={}; for (const r of pf.rollen) zP[r.rolle]=E(pf.varianten.pancakes.bestof[r.rolle]!==undefined?pf.varianten.pancakes.bestof[r.rolle]:r.default);
c=compute({archetyp:'pfannkuchen',gefaess:'pfanne_pancake',methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...zP,fluessigkeit:E('buttermilch')}},data,ksP);
ok(approx(c.rollenBp.trieb.bp,ksP.pancakes.bp.trieb.median*0.85),'Regeln gelten archetyp-übergreifend: Pancakes + Buttermilch → Backpulver −15 %');
c=compute({archetyp:'hefeteig',gefaess:'brotform_25',methode:'hefe_direkt',fixiert:{rollen:{},zutaten:{}},zutaten:{struktur:E('weizenmehl'),fluessigkeit:E('wasser'),trieb:E('hefe_frisch'),salz:E('salz')}},data,{weissbrot:{n:0,bp:{},methoden:{},backen:{}}});
ok(c.anpassungen.length===0,'Hefeteig: keine Backpulver-/Natron-Regel greift');

console.log(fail?fail+' FAIL':'ALL PASS');
