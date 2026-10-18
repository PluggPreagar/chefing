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
for (const [k,s] of Object.entries(ks)) console.log('KORPUS',k, Object.entries(s.bilanz).map(([g,d])=>`${g} ${Math.round(d.min)}/${Math.round(d.q1)}/${Math.round(d.median)}/${Math.round(d.q3)}/${Math.round(d.max)}`).join(' | '));
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(variante, over={}){const v=arch.varianten[variante];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const show=(name,c)=>{console.log(`\n# ${name}: status=${c.status}`);for(const b of c.bilanz)console.log(`  ${b.label} ${Math.round(b.gramm)} g ${Math.round(b.bp)} % [${b.toleranz}]`);for(const g of c.gruende)console.log('  GRUND',g);for(const w of c.warnungen)console.log('  WARN',w);for(const h of c.toleranzHinweise)console.log('  HINW',h);};
for (const v of Object.keys(arch.varianten)) { const c=compute(st(v),data,ks); show(v,c); ok(c.status!=='invalid' && c.bilanz.length===8, `${v}: Preset gültig, Bilanz vorhanden`); }
let c=compute(st('kastenkuchen',{fluessigkeit:E('schmand')}),data,ks); show('Schmand statt Milch',c);
ok(c.bilanz.find(b=>b.groesse==='fett').bp > compute(st('kastenkuchen'),data,ks).bilanz.find(b=>b.groesse==='fett').bp, 'Schmand erhöht Reinfett (Fett aus Flüssigkeit zählt mit)');
c=compute(st('kastenkuchen',{fett:E('pflanzenoel')}),data,ks); show('Öl statt Butter',c);
c=compute(st('muffin',{struktur:E('speisestaerke')}),data,ks); show('Muffin Stärke',c);
// Synthetic Grenzen-Test
const { grenzenPruefen, bilanz, toleranz } = await import(P+'model/bilanz.js');
const g=data.grenzen.archetypen.ruehrteig;
let b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'suesse',zutat:'zucker',gramm:170},{rolle:'fluessigkeit',zutat:'wasser',gramm:100}],data.ingredients);
let r=grenzenPruefen(b,g); ok(r.hart.some(x=>x.id==='zucker_max_hart'),'Zucker 170 % → hart'); ok(r.empfohlen.some(x=>x.id==='zucker_wasser_max'),'Zucker/Wasser >1 → empfohlen');
b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'fluessigkeit',zutat:'wasser',gramm:20}],data.ingredients);
r=grenzenPruefen(b,g); ok(r.hart.some(x=>x.id==='wasser_min_hart'),'Wasser 34 % → hart');
b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'einlage',zutat:'blaubeeren',gramm:300},{rolle:'fluessigkeit',zutat:'wasser',gramm:80}],data.ingredients);
ok(Math.round(b.bp.wasser)===94,'Einlage nicht in Bilanz, Mehlwasser zählt (94 %)');
ok(toleranz(5,{n:2,min:1,q1:2,q3:3,max:4})===null,'Toleranz n<3 → null');
ok(toleranz(5,{n:5,min:1,q1:2,q3:3,max:4})==='ausserhalb_spanne' && toleranz(3.5,{n:5,min:1,q1:2,q3:3,max:4})==='ausserhalb_q','Toleranz-Stufen');
console.log(fail? `\n${fail} FAIL`:'\nALL PASS');
{const all=Object.values(arch.varianten).flatMap(v=>J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
const zw=all.map(r=>r.bilanz.gramm.zucker/r.bilanz.gramm.wasser);console.log('Z/W korpus min/max',Math.min(...zw).toFixed(2),Math.max(...zw).toFixed(2));
const st2=compute(st('muffin'),data,ks); ok(st2.toleranzHinweise.length===0,'Muffin-Preset ohne Rundungs-Rauschen');}
console.log(fail? `${fail} FAIL`:'ALL PASS 2');
