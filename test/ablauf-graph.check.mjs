import fs from 'fs';
const P=new URL('../src/', import.meta.url).href; const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js'); const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));const arch=data.archetypes.ruehrteig;const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
function st(vk, methode=null, over={}){const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
const show=(n,c)=>console.log(`# ${n} [${c.methodKey}] `+c.ablauf.map(s=>`${s.nr}.${s.key}(e${s.ebene}←${s.nach.join(',')||'-'})`).join(' '));
let c=compute(st('muffin','muffin'),data,ks); show('Muffin',c);
const by=k=>c.ablauf.find(s=>s.key===k);
ok(by('trocken_mischen').ebene===by('verquirlen').ebene,'Muffin: Trockenes ∥ Nasses');
ok(by('unterheben_kurz').nach.length===2,'Muffin: Zusammenführen hat 2 Vorgänger');
c=compute(st('muffin','muffin',{fett:E('butter')}),data,ks); show('Muffin+Butter',c);
ok(c.ablauf.find(s=>s.key==='schmelzen')?.ebene===0 && c.ablauf.find(s=>s.key==='verquirlen').nach.includes(c.ablauf.find(s=>s.key==='schmelzen').nr),'Schmelzen = Startschritt, Vorgänger von Verquirlen');
c=compute(st('kastenkuchen'),data,ks); show('Kasten',c);
ok(c.ablauf.every((s,i)=>s.ebene===i),'Crememethode ohne Einlage: linear wie bisher');
c=compute(st('gugelhupf'),data,ks); show('Gugelhupf (Rosinen)',c);
for (const m of arch.methoden){ const cc=compute(st('gugelhupf',m),data,ks); ok(cc.ablauf.every(s=>s.nach.every(n=>n<s.nr)),`${m}: Kanten nur rückwärts (azyklisch)`); }
console.log(fail?`${fail} FAIL`:'ALL PASS');
