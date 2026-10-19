import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { zeitleiste, fmtZeit } = await import(P+'model/zeit.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const ks={};
for (const a of ['ruehrteig','pfannkuchen']) { const arch=data.archetypes[a]; const rollen=arch.rollen.map(r=>r.rolle);
  for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen); }
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(archetyp,vk,over={}){const arch=data.archetypes[archetyp];const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp,gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
const klon=(f)=>{const d=structuredClone(data);f(d);return d;};
const schritt=(c,key)=>c.ablauf.find(s=>s.key===key);

// Warten als Operation mit Fenster
let c=compute(st('pfannkuchen','eierkuchen'),data,ks);
const ruhen=schritt(c,'ruhen');
ok(ruhen.typ==='warten' && ruhen.dauer===30 && ruhen.zeit.min===15 && ruhen.zeit.max===120 && ruhen.zeit.ziel==='gluten_entspannt','Eierkuchen: „Teig ruhen lassen“ ist Warten, Wert 30, Fenster 15–120 (Ziel gluten_entspannt)');
ok(c.zeit.warten===30 && c.zeit.aktiv===14 && c.zeit.gesamt===44,`Zeitleiste Eierkuchen: gesamt ${c.zeit.gesamt}, aktiv ${c.zeit.aktiv}, warten ${c.zeit.warten} (2 + 30 + 12)`);
ok([...c.warnungen,...c.gruende].length===0,'Standardwert liegt im Fenster → keine Meldung');

// Parallele Schritte zählen nicht doppelt, Backen geht mit der berechneten Backzeit ein
c=compute(st('ruehrteig','gugelhupf'),data,ks);
const summe=c.ablauf.reduce((a,s)=>a+(s.dauer??0),0);
// DR-043: Einlegen ist 1′ Handgriff + 30′ Wirkzeit und rückt in den Vorlauf; Backen ist 1′ Einschieben + Wirkzeit im Ofen
ok(c.zeit.gesamt<summe && c.zeit.gesamt>=schritt(c,'backen').dauer && c.zeit.gesamt+c.zeit.vorlauf>=schritt(c,'backen').dauer+30,`Gugelhupf: gesamt ${c.zeit.gesamt} ab Start + Vorlauf ${c.zeit.vorlauf} < Summe ${Math.round(summe)} (Einlegen im Vorlauf), Backen ${schritt(c,'backen').dauer} Min. enthalten`);
ok(schritt(c,'einlegen').typ==='warten' && schritt(c,'einlegen').aktiv===1 && schritt(c,'einlegen').wirk===30 && c.zeit.warten===30+schritt(c,'backen').dauer && schritt(c,'backen').aktiv===1,'Einlegen = 1′ Handgriff + 30′ Wirkzeit, Backen = 1′ Einschieben + Ofenzeit (beides Wartezeit)');
ok(zeitleiste([{typ:'mischen',dauer:5,nach:[]},{typ:'warten',dauer:60,nach:[1]},{typ:'mischen',dauer:3,nach:[]},{typ:'erhitzen',dauer:20,nach:[2,3]}]).gesamt===85,'zeitleiste: längster Pfad 5 + 60 + 20 = 85, der parallele Zweig (3) zählt nicht');
ok(zeitleiste([{typ:'mischen',dauer:5,nach:[]},{typ:'mischen',dauer:5,nach:[]},{typ:'erhitzen',dauer:10,nach:[1,2]}]).gesamt===20,'zeitleiste: parallele aktive Schritte macht eine Person nacheinander → Gesamtzeit nie unter der aktiven Zeit (20, nicht 15)');
c=compute(st('pfannkuchen','pancakes'),data,ks);
ok(c.zeit.gesamt>=c.zeit.aktiv && c.zeit.warten===0,`Pancakes: Gesamtzeit ${c.zeit.gesamt} ≥ aktiv ${c.zeit.aktiv}, keine Wartezeit`);
ok(fmtZeit(45)==='45 Min.' && fmtZeit(90)==='1 Std. 30 Min.' && fmtZeit(720)==='12 Std.','fmtZeit: Minuten, Std. + Min., volle Stunden');

// Methode legt den Wert fest; außerhalb des Fensters kommt der Text der Operation
const mitZeit=(wert)=>klon(d=>{d.methods.pfannkuchen_glatt.zeiten={ruhen:wert};});
c=compute(st('pfannkuchen','eierkuchen'),mitZeit(5),ks);
ok(schritt(c,'ruhen').dauer===5 && c.warnungen.some(w=>/Teig ruhen lassen: 5 Min\. liegen unter dem Fenster 15 Min\.–2 Std\. — Mehl noch nicht durchgequollen/.test(w)) && c.status!=='invalid','Methode setzt 5 Min. → Warnung unter dem Fenster mit Text, Status bleibt gültig');
c=compute(st('pfannkuchen','eierkuchen'),mitZeit(240),ks);
ok(c.warnungen.some(w=>/240|4 Std\. liegen über dem Fenster/.test(w)&&/umrühren/.test(w)),'Methode setzt 4 Std. → Warnung über dem Fenster');
c=compute(st('pfannkuchen','eierkuchen'),mitZeit(60),ks);
ok(schritt(c,'ruhen').dauer===60 && c.zeit.gesamt===74 && c.warnungen.length===0,'Methode setzt 60 Min. → im Fenster, Gesamtzeit 74');

// hart: ungültig mit Grund
const hart=klon(d=>{d.operations.ruhen.zeit.strenge='hart';d.methods.pfannkuchen_glatt.zeiten={ruhen:5};});
c=compute(st('pfannkuchen','eierkuchen'),hart,ks);
ok(c.status==='invalid' && c.gruende.some(g=>/liegen unter dem Fenster/.test(g)),'strenge hart: Wert unter dem Fenster → ungültig mit Grund');

// Erfahrungsregel verschiebt das Fenster (z. B. mehr Hefe → kürzer), ein fester Wert wird nicht mitskaliert
const regel={id:'test_zeit',zeit_op:'ruhen',wenn:{rolle:'fluessigkeit',eigenschaft:'aggregat',wert:'fluessig'},faktor:0.5,begruendung:'Dünnflüssiger Teig quillt schneller: Ruhezeit halbiert.'};
const skaliert=klon(d=>{d.erfahrungsregeln.regeln.push(regel);});
c=compute(st('pfannkuchen','eierkuchen'),skaliert,ks);
const r2=schritt(c,'ruhen');
ok(r2.dauer===15 && r2.zeit.min===7.5 && r2.zeit.max===60 && c.anpassungen.includes(regel.begruendung),'Regel zeit_op: Fenster 7,5–60, Standardwert 15, Begründung unter den Anpassungen');
const skaliertFix=klon(d=>{d.erfahrungsregeln.regeln.push({...regel,faktor:2});d.methods.pfannkuchen_glatt.zeiten={ruhen:20};});
c=compute(st('pfannkuchen','eierkuchen'),skaliertFix,ks);
ok(schritt(c,'ruhen').dauer===20 && c.warnungen.some(w=>/liegen unter dem Fenster 30 Min\./.test(w)),'fester Wert 20 bleibt 20, das Fenster wird mit Faktor 2 zu 30–240 → Warnung');
const nichtErfuellt=klon(d=>{d.erfahrungsregeln.regeln.push({...regel,wenn:{rolle:'fluessigkeit',eigenschaft:'aggregat',wert:'fest'}});});
c=compute(st('pfannkuchen','eierkuchen'),nichtErfuellt,ks);
ok(schritt(c,'ruhen').dauer===30 && !c.anpassungen.includes(regel.begruendung),'Regel mit unerfüllter Bedingung ändert nichts');
ok(!compute(st('ruehrteig','kastenkuchen'),skaliert,ks).anpassungen.includes(regel.begruendung),'Regel zeit_op ohne passende Operation im Ablauf bleibt wirkungslos');

// Operationen ohne Fenster behalten dauer_min
c=compute(st('ruehrteig','kastenkuchen'),data,ks);
ok(schritt(c,'aufschlagen').dauer===4 && schritt(c,'aufschlagen').zeit===null,'ohne zeit-Fenster gilt dauer_min (Aufschlagen 4 Min.)');
console.log(fail?fail+' FAIL':'ALL PASS');
