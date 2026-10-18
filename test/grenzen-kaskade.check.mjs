import fs from 'fs';
const P=new URL('../src/', import.meta.url).pathname;
const J=(n)=>JSON.parse(fs.readFileSync(P+'data/'+n+'.json'));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { alleUeberschreibbarenRegeln } = await import(P+'model/rules.js');
const { grenzenKaskade, beschreibeGrenze } = await import(P+'model/bilanz.js');
const { korrelationenSuchen } = await import(P+'model/korrelation.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));const arch=data.archetypes.ruehrteig;const ks={},kn={};
for (const [k,v] of Object.entries(arch.varianten)){kn[k]=J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients));ks[k]=stats(kn[k]);}
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const g=data.grenzen.archetypen.ruehrteig, G=(id)=>g.find(x=>x.id===id);
// Kaskade
const posten=[{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'fluessigkeit',zutat:'wasser',gramm:180},{rolle:'suesse',zutat:'zucker',gramm:60}];
const fl=arch.rollen.find(r=>r.rolle==='fluessigkeit').optionen;
ok(grenzenKaskade(G('wasser_band'),posten,fl,data.ingredients,g)==='saure_sahne','Wasser 194 % → erste passende Option (Saure Sahne; Milch landet bei 172 %)');
ok(grenzenKaskade(G('zucker_max_hart'),posten,fl,data.ingredients,g)===null,'Grenze ohne kaskade_ziel → kein Vorschlag');
// Katalog
const kat=alleUeberschreibbarenRegeln(data); const gk=kat.filter(k=>k.ausloeser==='Gesamtbilanz');
ok(gk.length===5 && gk.every(k=>g.find(x=>x.id===k.id).strenge==='hart'),'5 hart-Grenzen im Override-Katalog');
console.log('  ', gk.map(k=>k.text).join(' | '), '|', beschreibeGrenze(G('zucker_wasser_max')));
// Engine: forced violation via tightened grenze clone
const d2={...data, grenzen:{archetypen:{ruehrteig:[{...G('wasser_band'),max:112,strenge:'hart',id:'test_wasser'}]}}};
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v=arch.varianten.kastenkuchen;const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
let state={archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};
let c=compute(state,d2,ks);
ok(c.status==='invalid' && c.blockaden.some(b=>b.id==='test_wasser'),'hart-Grenze → invalid + Blockade');
console.log('   kaskaden:',JSON.stringify(c.kaskaden));
ok(c.kaskaden.some(k=>k.rolle==='fluessigkeit'),'Kaskaden-Vorschlag für Flüssigkeit');
state={...state,fixiert:{rollen:{fluessigkeit:true},zutaten:{}}};
c=compute(state,d2,ks); ok(!c.kaskaden.some(k=>k.rolle==='fluessigkeit'),'fixierte Zielrolle → kein Vorschlag');
// Regression: presets
state={...state,fixiert:{rollen:{},zutaten:{}}};
for (const vk of Object.keys(arch.varianten)){const vv=arch.varianten[vk];const zz={};for(const r of arch.rollen)zz[r.rolle]=E(vv.bestof[r.rolle]!==undefined?vv.bestof[r.rolle]:r.default);
 const cc=compute({...state,gefaess:vv.gefaess,zutaten:zz},data,ks); ok(cc.status!=='invalid'&&cc.blockaden.length===0,`${vk} Preset unverändert gültig`);}
// Korrelation mit Bilanz-Zielen
const kk=Object.values(kn).flatMap(r=>korrelationenSuchen(r,data.ingredients)); const kb=kk.filter(k=>k.zRolle.startsWith('bilanz:'));
ok(kb.length>0,`Korrelation findet Bilanz-Kandidaten (${kb.length} von ${kk.length})`);
console.log('   z.B.', kb.slice(0,3).map(k=>`${k.bRolle}.${k.eigenschaft}=${k.wert} → ${k.zRolle} ×${k.faktor.toFixed(2)} n=${k.nMit}/${k.nOhne}`).join(' ; '));
console.log(fail?`${fail} FAIL`:'ALL PASS');
