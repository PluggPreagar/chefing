// T67 (DR-036): Vergleichsbasis — „untypisch“ nur, wenn der Korpus den Fall kennt; sonst Hinweis „keine Vergleichsbasis“ mit Grund.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { basisLuecke, MIN_BASIS } = await import(P+'model/bilanz.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

// --- Funktion (synthetische Welt) -----------------------------------------------------------------------------------------------
const ing={ mehl:{label:'Mehl',wasseranteil:0.14,funktionen:{eiweiss:0.1}}, ei:{label:'Ei',wasseranteil:0.75,funktionen:{eiweiss:0.12,emulgator:1}}, quark:{label:'Quark',wasseranteil:0.8,funktionen:{eiweiss:0.12}}, milch:{label:'Milch',wasseranteil:0.88,funktionen:{eiweiss:0.035}}, bp:{label:'Backpulver',funktionen:{triebkraft:1}} };
const rollen=[{rolle:'struktur',label:'Mehl',optionen:['mehl'],default:'mehl'},{rolle:'bindung',label:'Bindung',optionen:['ei'],default:'ei'},{rolle:'fluessigkeit',label:'Flüssigkeit',optionen:['milch','quark'],default:'milch'},{rolle:'trieb',label:'Trieb',optionen:['bp'],default:null}];
const st={ n:10, zutaten:{mehl:10,ei:10,milch:9,quark:1,bp:5}, rollenBelegt:{struktur:10,bindung:10,fluessigkeit:10,trieb:5}, bilanzBelegt:{eiweiss:10,wasser:10,emulgator:10,triebkraft:5} };
const p=(rolle,zutat,gramm)=>({rolle,zutat,gramm});
const normal=[p('struktur','mehl',100),p('bindung','ei',50),p('fluessigkeit','milch',100)];
ok(MIN_BASIS===3,'Mindestbasis: 3 Korpus-Rezepte');
ok(basisLuecke('eiweiss',{posten:normal,ingredients:ing,st,rollen})===null && basisLuecke('wasser',{posten:normal,ingredients:ing,st,rollen})===null,'gewöhnliches Rezept: Basis vorhanden (null)');
let g=basisLuecke('triebkraft',{posten:normal,ingredients:ing,st:{...st,bilanzBelegt:{...st.bilanzBelegt,triebkraft:2}},rollen});
ok(/Triebkraft.*weniger als 3 Korpus-Rezepten/.test(g),'(c) Größe kommt in weniger als 3 Korpus-Rezepten vor: Grund genannt');
ok(basisLuecke('triebkraft',{posten:normal,ingredients:ing,st:{...st,bilanzBelegt:{...st.bilanzBelegt,triebkraft:3}},rollen})===null,'(c) genau 3 Rezepte reichen (Grenze)');
const ohneEi=[p('struktur','mehl',100),p('fluessigkeit','milch',200)];
g=basisLuecke('emulgator',{posten:ohneEi,ingredients:ing,st,rollen});
ok(/Rolle „Bindung“ fehlt.*10 von 10/.test(g),'(b) Rolle fehlt, die jedes Korpus-Rezept hat und die zur Größe beiträgt (Emulgator ohne Ei)');
ok(basisLuecke('triebkraft',{posten:ohneEi,ingredients:ing,st,rollen})===null || /Trieb/.test(basisLuecke('triebkraft',{posten:ohneEi,ingredients:ing,st,rollen})||''),'(b) die fehlende Rolle zählt nur für Größen, zu denen ihre Standard-Zutat beiträgt (Ei liefert keine Triebkraft)');
ok(basisLuecke('eiweiss',{posten:ohneEi,ingredients:ing,st:{...st,rollenBelegt:{...st.rollenBelegt,bindung:8}},rollen})===null,'(b) eine Rolle, die nur 8 von 10 Rezepten haben (80 %), löst nichts aus (Schwelle 90 %)');
ok(basisLuecke('eiweiss',{posten:ohneEi,ingredients:ing,st:{...st,rollenBelegt:{...st.rollenBelegt,bindung:9}},rollen})!==null,'(b) 9 von 10 (90 %) genügt');
const mitQuark=[p('struktur','mehl',100),p('bindung','ei',50),p('fluessigkeit','quark',100)];
g=basisLuecke('eiweiss',{posten:mitQuark,ingredients:ing,st,rollen});
ok(/Quark liefert \d+ % davon, kommt aber nur in 1 von 10 Korpus-Rezepten vor/.test(g),'(a) Quark liefert viel Eiweiß, kommt im Korpus kaum vor: Grund mit Anteil und Häufigkeit');
const wenigQuark=[p('struktur','mehl',100),p('bindung','ei',50),p('fluessigkeit','milch',100),p('fluessigkeit','quark',5)];
ok(basisLuecke('eiweiss',{posten:wenigQuark,ingredients:ing,st,rollen})===null,'(a) ein kleiner Anteil (unter 20 %) zählt nicht');
const mittelQuark=[p('struktur','mehl',100),p('bindung','ei',50),p('fluessigkeit','milch',100),p('fluessigkeit','quark',25)];
ok(basisLuecke('eiweiss',{posten:mittelQuark,ingredients:ing,st,rollen})===null,'(a) Quark mit gut 10 % Anteil liegt noch unter der Schwelle von 20 %');
ok(basisLuecke('eiweiss',{posten:[...mitQuark,p('einlage','quark',500)],ingredients:ing,st,rollen})!==null && basisLuecke('eiweiss',{posten:[...normal,p('einlage','quark',500)],ingredients:ing,st,rollen})===null,'(a) Einlage zählt nicht zur Teigmatrix');
ok(basisLuecke('eiweiss',{posten:mitQuark,ingredients:ing,st:{...st,zutaten:{...st.zutaten,quark:3}},rollen})===null,'(a) Quark in 3 Korpus-Rezepten reicht (Grenze)');
ok(basisLuecke('eiweiss',{posten:mitQuark,ingredients:ing,st:{n:0},rollen})===null && basisLuecke('eiweiss',{posten:mitQuark,ingredients:ing,st:null,rollen})===null && basisLuecke('eiweiss',{posten:mitQuark,ingredients:ing,st:{n:10},rollen:[]})!==undefined,'ohne Korpus-Statistik oder mit leerem Korpus: keine Aussage (null)');

// Negativ-Korpus: nur wenn ALLE verglichenen Varianten keine Basis haben, ist es kein Befund
{const { negativPruefen } = await import(P+'model/negativ.js');
 const ingN={ mehl:{label:'Mehl',wasseranteil:0.14,funktionen:{eiweiss:0.1}}, ei:{label:'Ei',wasseranteil:0.75,funktionen:{eiweiss:0.12}}, quark:{label:'Quark',wasseranteil:0.8,funktionen:{eiweiss:0.12}}, milch:{label:'Milch',wasseranteil:0.88,funktionen:{eiweiss:0.035}} };
 const archN={ x:{ rollen:[{rolle:'struktur',label:'Mehl',referenz:true,optionen:['mehl'],default:'mehl'},{rolle:'bindung',label:'Bindung',optionen:['ei'],default:'ei'},{rolle:'fluessigkeit',label:'Flüssigkeit',optionen:['milch','quark'],default:'milch'}], varianten:{ v:{korpus:'k'}, w:{korpus:'k2'} } } };
 const z=(rolle,zutat,menge)=>({rolle,zutat,menge,einheit:'g',original:''});
 const r=(id,ei,milch,quark)=>({id,methode:'x',zutaten:[z('struktur','mehl',100),...(ei?[z('bindung','ei',ei)]:[]),z('fluessigkeit','milch',milch),...(quark?[z('fluessigkeit','quark',quark)]:[])]});
 const korpusV=[r('a',50,100),r('b',55,95),r('c',45,105),r('d',50,100)];
 const korpusW=[r('e',0,60,40),r('f',0,55,45),r('g',0,65,35),r('h',0,60,40)]; // Quark in 4 Rezepten, aber ohne Ei
 const fall=(id,variante)=>({id,archetyp:'x',...(variante?{variante}:{}),ergebnis:'misslungen',verlaesslichkeit:2,mengen_vorhanden:true,ursache_art:'menge',zutaten:[z('struktur','mehl',100),z('bindung','ei',50),z('fluessigkeit','quark',300)]});
 const lauf=(faelle)=>negativPruefen({faelle,archetypes:archN,ingredients:ingN,grenzen:{archetypen:{}},modelle:null,korpora:{x:{v:korpusV,w:korpusW}}});
 const e=Object.fromEntries(lauf([fall('nur-v','v'),fall('beide')]).faelle.map(x=>[x.id,x]));
 ok(e['nur-v'].keineBasis.some(x=>x.groesse==='eiweiss' && /Quark/.test(x.grund)) && !e['nur-v'].toleranz.some(x=>x.groesse==='eiweiss') && !e['nur-v'].erkannt,'Fall gegen eine Variante ohne Quark im Korpus: Eiweiß trägt „keine Basis“, kein Befund, nicht erkannt');
 ok(e.beide.toleranz.some(x=>x.groesse==='eiweiss') && !e.beide.keineBasis.some(x=>x.groesse==='eiweiss') && e.beide.erkannt,'ohne Variante gegen beide: eine Variante kennt Quark (4 Rezepte) — dann bleibt es ein Befund, nur wenn alle Varianten die Basis vermissen, gilt „keine Basis“');}

// --- Korpus-Statistik ----------------------------------------------------------------------------------------------------------------
const rez=(id,zutaten)=>({id,methode:'x',zutaten});
const r1=normalizeRecipe(rez('a',[{rolle:'struktur',zutat:'mehl',menge:100,einheit:'g'},{rolle:'bindung',zutat:'ei',menge:50,einheit:'g'}]),ing,{rollen:['struktur','bindung','trieb']});
const r2=normalizeRecipe(rez('b',[{rolle:'struktur',zutat:'mehl',menge:100,einheit:'g'},{rolle:'trieb',zutat:'bp',menge:3,einheit:'g'},{rolle:'trieb',zutat:'bp',menge:1,einheit:'g'}]),ing,{rollen:['struktur','bindung','trieb']});
const s2=stats([r1,r2],['struktur','bindung','trieb']);
ok(s2.zutaten.mehl===2 && s2.zutaten.ei===1 && s2.zutaten.bp===1,'stats.zutaten: Rezepte je Zutat (eine Zutat zweimal im Rezept zählt einmal)');
ok(s2.rollenBelegt.struktur===2 && s2.rollenBelegt.bindung===1 && s2.rollenBelegt.trieb===1,'stats.rollenBelegt: Rezepte je Rolle mit Menge');
ok(s2.bilanzBelegt.triebkraft===1 && s2.bilanzBelegt.eiweiss===2 && s2.bilanzBelegt.emulgator===1,'stats.bilanzBelegt: Rezepte je Bilanz-Größe größer 0');
ok(Array.isArray(r1.posten) && r1.posten.length===2 && r1.posten[0].gramm===100,'normalizeRecipe liefert die Posten (Rolle, Zutat, Gramm)');

// --- Engine und Negativ-Korpus am echten Modell ---------------------------------------------------------------------------------------
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const mk=(ak)=>{ const a=data.archetypen?.[ak]??data.archetypes[ak], rr=a.rollen.map(r=>r.rolle); return {a, ks:Object.fromEntries(Object.entries(a.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr)]))}; };
{const {a,ks}=mk('ruehrteig'); const v=a.varianten.gugelhupf, b={}; for (const r of a.rollen) b[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
 const rechne=(z,extra={})=>compute({archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...b,...z},...extra},data,ks);
 ok(ks.gugelhupf.zutaten.quark===undefined || ks.gugelhupf.zutaten.quark<3,'Ausgangslage: Quark kommt im Gugelhupf-Korpus in weniger als 3 Rezepten vor');
 const q=rechne({fluessigkeit:E('quark')},{mengen:{fluessigkeit:100}});
 const zeile=q.bilanz.find(x=>x.groesse==='eiweiss');
 ok(zeile.toleranz==='keine_basis' && q.toleranzHinweise.some(h=>/Eiweiß.*keine Vergleichsbasis im Korpus \(Quark.* liefert \d+ % davon/.test(h)) && q.regelIds.includes('basis:eiweiss') && !q.regelIds.includes('toleranz:eiweiss'),'Gugelhupf mit 100 % Quark: Bilanz-Zeile „keine_basis“, Hinweis mit Grund, Regel-Id basis:eiweiss statt toleranz:eiweiss');
 ok(!q.warnungen.some(w=>/Eiweiß.*außerhalb aller|untypisch/.test(w)) && !q.toleranzHinweise.some(h=>/Eiweiß.*untypisch/.test(h)),'… und weder Warnung „außerhalb aller Korpus-Rezepte“ noch Hinweis „untypisch“ für Eiweiß');
 const normalFall=rechne({}); ok(normalFall.bilanz.every(x=>x.toleranz!=='keine_basis') && !normalFall.regelIds.some(i=>/^basis:/.test(i)),'Standard-Preset: keine Zeile ohne Vergleichsbasis');
 // echte Abweichung bleibt Warnung: sehr viel Zucker bei normalen Zutaten
 const zuck=rechne({},{mengen:{suesse:140}});
 ok(zuck.bilanz.find(x=>x.groesse==='zucker').toleranz!=='keine_basis',`sehr viel Zucker (Zutat im Korpus üblich): bleibt „${zuck.bilanz.find(x=>x.groesse==='zucker').toleranz}“, keine Vergleichslücke`);}
{const {a,ks}=mk('pfannkuchen'); const v=a.varianten.eierkuchen, b={}; for (const r of a.rollen) b[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
 const c=compute({archetyp:'pfannkuchen',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...b,trieb:E('backpulver')},mengen:{trieb:3}},data,ks);
 const z=c.bilanz.find(x=>x.groesse==='triebkraft');
 ok(ks.eierkuchen.bilanzBelegt.triebkraft<3 && z.toleranz==='keine_basis' && c.toleranzHinweise.some(h=>/Triebkraft.*keine Vergleichsbasis.*weniger als 3 Korpus-Rezepten/.test(h)),'Eierkuchen mit Backpulver: der Korpus kennt dort keine Triebmittel — Hinweis „keine Vergleichsbasis“ statt „ungetestet“');
 const ohneEi=compute({archetyp:'pfannkuchen',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...b,bindung:[]}},data,ks);
 ok(ohneEi.bilanz.some(x=>x.toleranz==='keine_basis' && x.herkunft.length>=0) && ohneEi.toleranzHinweise.some(h=>/Rolle „Bindung“ fehlt/.test(h)),'Eierkuchen ohne Ei: Größen, zu denen das Ei beiträgt, tragen „keine Vergleichsbasis“ (Rolle Bindung fehlt)');}
const ui=fs.readFileSync(new URL('../src/ui/recipeCard.js',import.meta.url),'utf8');
ok(/keine_basis: ' \?'/.test(ui) && /\? keine Vergleichsbasis im Korpus/.test(ui),'Anzeige: Markierung ? und Legende „keine Vergleichsbasis im Korpus“');

console.log(fail?fail+' FAIL':'ALL PASS');
