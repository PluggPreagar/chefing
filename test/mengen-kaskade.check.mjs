// T40: Mengen-Kaskade — wenn kein Zutaten-Tausch die Grenze löst, die Menge der Zielrolle innerhalb der Korpus-Spanne verschieben.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { grenzenMengenKaskade, grenzenPruefen, bilanz } = await import(P+'model/bilanz.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;

// --- Funktion (synthetische Welt) -----------------------------------------------------------------------------------------------
const ing={ mehl:{label:'Mehl',wasseranteil:0.14}, wasser:{label:'Wasser',wasseranteil:1}, zucker:{label:'Zucker',zuckeranteil:1}, oel:{label:'Öl',fettanteil:1} };
const p=(rolle,zutat,gramm)=>({rolle,zutat,gramm});
const G=(extra)=>[{id:'w_min',groesse:'wasser',bezug:{rolle:'struktur'},min:60,strenge:'empfohlen',kaskade_ziel:'fluessigkeit',hinweis:'x',quelle:'t'},{id:'w_max',groesse:'wasser',bezug:{rolle:'struktur'},max:100,strenge:'empfohlen',kaskade_ziel:'fluessigkeit',hinweis:'x',quelle:'t'},...(extra||[])];
const gMin=G()[0], gMax=G()[1];
// Wasser-Bilanz = 14 (Mehl) + Wasser: bei 20 Wasser nur 34 %, Grenze min 60 → 46 Wasser nötig
let m=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:10,max:120},ing,G());
ok(m && m.rolle==='fluessigkeit' && m.von===20 && m.nach===46 && near(m.faktor,2.3,0.011),'Wasser 34 % (Grenze ≥ 60): Flüssigkeit von 20 auf 46 erhöhen — die kleinste Änderung, die die Grenze hält');
m=grenzenMengenKaskade(gMax,[p('struktur','mehl',100),p('fluessigkeit','wasser',120)],{min:10,max:200},ing,G());
ok(m && m.von===120 && m.nach<=86 && m.nach>85,'Wasser 134 % (Grenze ≤ 100): Flüssigkeit von 120 auf höchstens 86 verringern (1-%-Schritte: 85,2)');
ok(grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:10,max:40},ing,G())===null,'Korpus-Spanne reicht nicht (höchstens 40, nötig 46): kein Vorschlag — nie außerhalb der Spanne');
m=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:10,max:46.4},ing,G());
ok(m && m.nach===46,'Obergrenze der Spanne genau erreichbar (46,4 ≥ 46): Vorschlag bleibt innerhalb');
m=grenzenMengenKaskade(gMax,[p('struktur','mehl',100),p('fluessigkeit','wasser',120)],{min:95,max:200},ing,G());
ok(m===null,'Untergrenze der Spanne verhindert die nötige Verringerung (95 ≥ 86): kein Vorschlag');
ok(grenzenMengenKaskade({...gMax,kaskade_ziel:'struktur'},[p('struktur','mehl',100),p('fluessigkeit','wasser',120)],{min:50,max:300},ing,G())===null,'Die Referenzrolle (Mehl) wird nie verschoben');
ok(grenzenMengenKaskade({...gMin,kaskade_ziel:undefined},[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:10,max:120},ing,G())===null,'ohne kaskade_ziel kein Vorschlag');
ok(grenzenMengenKaskade(gMin,[p('struktur','mehl',100)],{min:10,max:120},ing,G())===null,'Zielrolle nicht belegt (0 g): kein Vorschlag');
ok(grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],null,ing,G())===null && grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:50,max:10},ing,G())===null,'ohne oder mit kaputter Korpus-Spanne kein Vorschlag');
// neue hart-Grenze darf nicht entstehen: Zucker-Grenze hart über dem Wasser-Vorschlag? Wasser steigt, hier sinkt das Verhältnis Zucker/Wasser nicht → Gegenbeispiel mit hart-Grenze auf Wasser max
const mitHart=G([{id:'w_hart',groesse:'wasser',bezug:{rolle:'struktur'},max:50,strenge:'hart',hinweis:'x',quelle:'t'}]);
ok(grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20)],{min:10,max:120},ing,mitHart)===null,'Der Vorschlag würde eine neue harte Grenze verletzen (Wasser 60 % > hart 50 %): kein Vorschlag');
const schonHart=[...G(),{id:'z_hart',groesse:'zucker',bezug:{rolle:'struktur'},max:5,strenge:'hart',hinweis:'x',quelle:'t'}];
m=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',20),p('suesse','zucker',50)],{min:10,max:120},ing,schonHart);
ok(m && m.nach===46,'Eine schon verletzte harte Grenze (Zucker 50 % > 5 %) blockiert den Vorschlag für eine andere Grenze nicht');
m=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',12),p('fluessigkeit','mehl',0)],{min:0,max:120},ing,G());
ok(m && m.nach>=34 && near(m.nach,m.von*m.faktor,0.06),'mehrere Zeilen derselben Rolle werden gemeinsam skaliert');
{const kandidat=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',30)],{min:0,max:200},ing,G());
 const verletzt=(f)=>grenzenPruefen(bilanz([p('struktur','mehl',100),p('fluessigkeit','wasser',30*f)],ing),G()).empfohlen.some(x=>x.id==='w_min');
 ok(kandidat && !verletzt(kandidat.faktor) && verletzt(kandidat.faktor-0.01),'kleinste Änderung: eine Stufe (1 %) weniger würde die Grenze nicht mehr halten');}
const naechster=grenzenMengenKaskade(gMin,[p('struktur','mehl',100),p('fluessigkeit','wasser',44)],{min:0,max:200},ing,G());
ok(naechster && naechster.nach<=47 && naechster.nach>=46,'schon nahe an der Grenze: kleiner Schritt (44 → 46 bis 47), kein Sprung ans Ende der Spanne');

// --- Engine ---------------------------------------------------------------------------------------------------------------------------
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle); const ksR={};
for (const [k,x] of Object.entries(ruehr.varianten)) ksR[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr);
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v0=ruehr.varianten.kastenkuchen; const basis={}; for (const r of ruehr.rollen) basis[r.rolle]=E(v0.bestof[r.rolle]!==undefined?v0.bestof[r.rolle]:r.default);
const rechne=(extra={},fixiert={rollen:{},zutaten:{}})=>compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:null,fixiert,zutaten:{...basis},...extra},data,ksR);
let c=rechne();
ok(c.mengenVorschlaege.length===0 && c.zutatenListe.every(z=>z.bpQuelle!=='manuell'),'Standard-Preset: kein Mengen-Vorschlag, nichts manuell');
c=rechne({mengen:{fluessigkeit:2,bindung:10}});
ok(c.zutatenListe.find(z=>z.rolle==='fluessigkeit').bpQuelle==='manuell' && near(c.zutatenListe.find(z=>z.rolle==='fluessigkeit').bp,2) && c.status==='invalid','manuell gesetzte Mengen gelten: Flüssigkeit 2 %, Bindung 10 % vom Mehl, Quelle „manuell“ — zu trocken (hart ungültig)');
const vs=c.mengenVorschlaege.find(x=>x.rolle==='fluessigkeit' && /Gesamtwasser/.test(x.ausloeser));
ok(!!vs && vs.von===2 && vs.nach>vs.von && vs.nach<=vs.spanne.max && vs.nach>=vs.spanne.min && /Gesamtwasser/.test(vs.ausloeser),`zu wenig Flüssigkeit (2 %): kein Zutaten-Tausch hilft, Vorschlag ${vs?.von} → ${vs?.nach} % innerhalb der Korpus-Spanne ${vs && Math.round(vs.spanne.min)}–${vs && Math.round(vs.spanne.max)} %`);
ok(c.kaskaden.every(k=>k.rolle!=='fluessigkeit'),'es gibt dazu keinen Zutaten-Tausch (sonst käme der Mengen-Vorschlag nicht)');
const alleFl=c.mengenVorschlaege.filter(x=>x.rolle==='fluessigkeit');
ok(alleFl.length===1 && alleFl[0].weitere.length>=2 && alleFl[0].grenzIds.length>=3 && alleFl[0].nach>40,`mehrere Wasser-Grenzen (≥ 40 %, Band, Zucker/Wasser) ergeben EINEN Vorschlag mit dem weitestgehenden Wert (${alleFl[0]?.nach} %) und nennen die anderen Auslöser`);
const cm=rechne({mengen:{fluessigkeit:alleFl[0].nach,bindung:10}});
ok(!['wasser_min_hart','wasser_band','zucker_wasser_max'].some(id=>cm.regelIds.includes(id)) && cm.status!=='invalid' && !cm.mengenVorschlaege.some(x=>x.rolle==='fluessigkeit'),'der zusammengefasste Wert löst alle drei Grenzen zugleich, danach kein weiterer Vorschlag für die Flüssigkeit');
const c2=rechne({mengen:{fluessigkeit:vs.nach,bindung:10}});
ok(c2.status!=='invalid' && !c2.gruende.some(g=>/Gesamtwasser/.test(g)),'Vorschlag übernommen: die harte Wasser-Grenze ist erfüllt, das Rezept nicht mehr ungültig');
c=rechne({mengen:{fluessigkeit:2,bindung:10}},{rollen:{fluessigkeit:true},zutaten:{}});
ok(c.mengenVorschlaege.length===0,'gesperrte (fixierte) Zielrolle: kein Mengen-Vorschlag');
c=rechne({mengen:{gibtsnicht:50,trieb:-3,aroma:'viel'}});
ok(c.zutatenListe.every(z=>z.bpQuelle!=='manuell'),'ungültige Mengen (unbekannte Rolle, negativ, Text) werden ignoriert');
c=rechne({mengen:{fluessigkeit:0}});
ok(c.zutatenListe.every(z=>z.rolle!=='fluessigkeit' || z.bp===0) ,'Menge 0 ist gültig (Flüssigkeit weglassen)');
c=rechne({mengen:{struktur:50}});
ok(c.zutatenListe.find(z=>z.rolle==='struktur').bpQuelle==='manuell',"auch die Referenzrolle kann man manuell setzen (die Engine vertraut dem Nutzer; nur Vorschläge fassen sie nicht an)");
// --- Natron und Säure: Vorschläge bleiben sinnvoll (Gegenlesen) ------------------------------------------------------------------
{const szen=[['Natron + Milch',{trieb:E('natron'),fluessigkeit:E('milch')},{}],['Natron + Schmand',{trieb:E('natron'),fluessigkeit:E('schmand')},{}],['Natron + Schmand, 6 % Natron',{trieb:E('natron'),fluessigkeit:E('schmand')},{mengen:{trieb:6}}],['Natron + Milch, Flüssigkeit 0',{trieb:E('natron'),fluessigkeit:E('milch')},{mengen:{fluessigkeit:0}}]];
 const cs=szen.map(([n,z,x])=>[n,rechne({zutaten:{...basis,...z},...x})]);
 ok(cs.every(([,c])=>c.regelIds.some(i=>/^natron_/.test(i))),'Szenarien lösen jeweils eine Natron-Regel aus (braucht Säure bzw. Säure-Verhältnis)');
 ok(cs.every(([,c])=>!c.kaskaden.some(k=>k.rolle==='fluessigkeit' && ['milch','wasser'].includes(k.zutat))),'kein Vorschlag, die Säure wegzunehmen (Schmand → Milch, Buttermilch → Wasser verschärft die Natron-Grenze)');
 ok(cs.every(([,c])=>!c.mengenVorschlaege.some(m=>m.rolle==='fluessigkeit' && m.nach===0)),'kein Mengen-Vorschlag, die Flüssigkeit auf 0 zu setzen (Säure ginge mit)');
 ok(cs.every(([,c])=>!c.toleranzHinweise.some(h=>/Natron|Säure/i.test(h)) && !c.regelIds.some(i=>/toleranz:(natron|saeure)/.test(i))),'Natron und Säure: nur die Grenze meldet, kein zusätzlicher Korpus-Toleranz-Hinweis (die Größen haben keine Korpus-Spanne)');
}
// --- Eigenschaft: ein übernommener Vorschlag hält seine Grenzen (Rundung, Mehrfachvorschläge) ----------------------------------------
{let n=0, schlecht=[];
 for (const fl of [0,2,5,8,12,25,60,90,120,200]) for (const bd of [null,10,40,100]) {
   const mengen={fluessigkeit:fl,...(bd==null?{}:{bindung:bd})}; const c0=rechne({mengen});
   for (const v of c0.mengenVorschlaege) { n++; const c1=rechne({mengen:{...mengen,[v.rolle]:v.nach}}); const noch=v.grenzIds.filter(id=>c1.regelIds.includes(id)); if (noch.length) schlecht.push(`${JSON.stringify(mengen)} → ${v.rolle} ${v.nach}: ${noch.join(',')}`); }
 }
 ok(n>=8 && schlecht.length===0,`${n} Vorschläge über 40 Ausgangsmengen: jeder übernommene Wert löst alle seine Auslöser-Grenzen${schlecht.length?' — '+schlecht.slice(0,3).join('; '):''}`);}
// Anzeige, Zustand und Rückmeldung: test/ui-zustand.check.mjs

console.log(fail?fail+' FAIL':'ALL PASS');
