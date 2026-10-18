import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { alleUeberschreibbarenRegeln } = await import(P+'model/rules.js');
const { korrelationenSuchen } = await import(P+'model/korrelation.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));const arch=data.archetypes.ruehrteig;const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
const v=arch.varianten.kastenkuchen;
const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
const st=(archetyp)=>({archetyp,gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z});

// T06: nichts hängt am Schlüssel „ruehrteig“ — dieselben Daten unter anderem Namen rechnen gleich
const kopie={...data,archetypes:{...data.archetypes,kopie:arch},grenzen:{...data.grenzen,archetypen:{...data.grenzen.archetypen,kopie:data.grenzen.archetypen.ruehrteig}}};
const a=compute(st('ruehrteig'),data,ks), b=compute(st('kopie'),kopie,ks);
ok(JSON.stringify(a)===JSON.stringify(b),'Archetyp unter anderem Schlüssel → identisches Ergebnis');
ok(a.zutatenListe.length>0 && a.bilanz.length===8,'Ergebnis nicht leer (Zutaten, 8 Bilanz-Größen)');

// Rollenliste und Referenzrolle kommen vom Aufrufer
const rez={id:'x',methode:'creme',zutaten:[{zutat:'weizenmehl',menge:200,einheit:'g',rolle:'geruest'},{zutat:'wasser',menge:100,einheit:'ml',rolle:'nass'}]};
const n=normalizeRecipe(rez,data.ingredients,{rollen:['geruest','nass'],referenz:'geruest'});
ok(Object.keys(n.bp).join()==='geruest,nass' && Math.round(n.bp.nass)===50,'normalizeRecipe: eigene Rollen + Referenz → Bäckerprozent 50 %');
ok(Object.keys(stats([n],['geruest','nass']).bp).join()==='geruest,nass','stats: eigene Rollenliste');
ok(Array.isArray(korrelationenSuchen([n],data.ingredients,{rollen:['geruest','nass']})),'korrelationenSuchen: eigene Rollen ohne Absturz');

// Regel-Katalog funktioniert ohne aktiven Archetyp (data.arch fehlt) und kennt die Rollen-Labels
const k=alleUeberschreibbarenRegeln(data);
ok(k.length>=9 && k.every(x=>x.text && !/undefined/.test(x.text)),`Katalog ohne data.arch: ${k.length} Regeln mit Text`);
console.log(fail?fail+' FAIL':'ALL PASS');
