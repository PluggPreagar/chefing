// T81: „Auto → …“ nennt immer die Auto-Wahl, auch wenn eine Methode von Hand gewählt ist
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const arch=data.archetypes.ruehrteig;
const rollen=arch.rollen.map(r=>r.rolle);
const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen);
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(methode){const v=arch.varianten.kastenkuchen;const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z};}

const auto=compute(st(null),data,ks);
ok(auto.autoMethodKey===auto.methodKey,`Auto: autoMethodKey = methodKey (${auto.methodKey})`);
const andere=Object.keys(auto.evals).find(m=>m!==auto.methodKey && auto.evals[m].status!=='invalid');
const hand=compute(st(andere),data,ks);
ok(hand.methodKey===andere,`Hand: gewählte Methode ${andere} wird verwendet`);
ok(hand.autoMethodKey===auto.methodKey,`Hand: autoMethodKey bleibt ${auto.methodKey}`);

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
