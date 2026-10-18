// T52 (DR-028): Temperatur als Bereich — eine Schreibweise für Zahl, Wert ± Spielraum, Spanne und Namen; Daten und Engine.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { temperaturBereich, fmtTemperatur, medianBereich, schrittTemperatur, gareOperation, wassertemperatur } = await import(P+'model/temperatur.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const T=J('temperaturen');

// --- Schreibweisen ---------------------------------------------------------------------------------------------------
let b=temperaturBereich(118);
ok(b.min===118 && b.max===118 && b.mitte===118 && b.name===null,'Zahl = fester Wert (Flugzucker 118 °C)');
b=temperaturBereich({wert:92,tol:5});
ok(b.min===87 && b.max===97 && b.mitte===92,'{wert, tol} = Wert mit Spielraum (Sieden 92 ± 5 → 87–97 °C)');
b=temperaturBereich({wert:92});
ok(b.min===92 && b.max===92,'{wert} ohne Spielraum = fester Wert');
b=temperaturBereich({min:18,max:22});
ok(b.min===18 && b.max===22 && b.mitte===20,'{min, max} = Spanne');
b=temperaturBereich('raum',T);
ok(b.min===18 && b.max===24 && b.mitte===21 && b.name==='raum' && b.label==='Raumtemperatur','Name → Bereich aus temperaturen.json (raum: 18–24 °C, Mitte 21)');
ok(temperaturBereich('kuehlschrank',T).mitte===5.5 && temperaturBereich('warm',T).mitte===28 && temperaturBereich('lauwarm',T).mitte===32.5 && temperaturBereich('kuehl',T).mitte===14,'die fünf vereinbarten Namen: Kühlschrank 5,5, kühl 14, Raum 21, warm 28, lauwarm 32,5 °C (Mitte)');
b=temperaturBereich(0); ok(b?.mitte===0,'0 °C ist ein gültiger Wert (nicht „keine Angabe“)');
b=temperaturBereich(-18); ok(b?.mitte===-18,'negative Temperatur (Tiefkühl) ist gültig');
for (const [spec,text] of [[undefined,'undefined'],[null,'null'],['gibtsnicht','unbekannter Name'],['_schema','Schema-Schlüssel'],[NaN,'NaN'],[Infinity,'Infinity'],['21','Zahl als Text'],[[20,25],'Liste'],[{},'leeres Objekt'],[{min:25,max:20},'min über max'],[{wert:90,tol:-5},'negativer Spielraum'],[{wert:'90'},'Wert als Text'],[{min:18},'nur min'],[true,'true']]) {
  if (temperaturBereich(spec,T)!==null) ok(false,`ungültig, aber angenommen: ${text}`);
}
ok(true,'ungültige Angaben (undefined, null, unbekannter Name, „_schema“, NaN, Infinity, Zahl als Text, Liste, {}, min > max, negativer Spielraum, Wert als Text, nur min, true) → null');
ok(temperaturBereich('raum')===null && temperaturBereich('raum',{raum:{label:'x',min:'a',max:2}})===null,'Name ohne Tabelle oder mit kaputtem Eintrag → null, kein Absturz');
ok(temperaturBereich('x',{x:{min:5,max:7}}).label==='x','Name ohne `label` zeigt den Namen');

// --- Anzeige ---------------------------------------------------------------------------------------------------------
ok(fmtTemperatur(temperaturBereich(118))==='118 °C' && fmtTemperatur(temperaturBereich({wert:92,tol:5}))==='87–97 °C' && fmtTemperatur(temperaturBereich('kuehlschrank',T))==='4–7 °C (Kühlschrank)','Anzeige: „118 °C“, „87–97 °C“, „4–7 °C (Kühlschrank)“');
ok(fmtTemperatur(temperaturBereich({min:4.5,max:7}))==='4,5–7 °C' && fmtTemperatur(temperaturBereich(37.25))==='37,3 °C' && fmtTemperatur(null)==='' && fmtTemperatur(undefined)==='','Anzeige: Dezimalkomma, eine Nachkommastelle, ohne Bereich leer');

// --- typischer Bereich mehrerer Rezepte ---------------------------------------------------------------------------------
const kh=(n)=>temperaturBereich(n,T);
let m=medianBereich([kh('kuehlschrank'),kh('kuehlschrank'),kh({wert:10,tol:3})]);
ok(m.min===4 && m.max===7 && m.mitte===5.5 && m.name===null,'Median von drei Bereichen (zwei Kühlschrank, einer 10 ± 3): 4–7 °C, Mitte 5,5; der Name entfällt, weil nicht alle ihn nennen');
m=medianBereich([kh('raum'),kh('raum')]);
ok(m.name==='raum' && m.label==='Raumtemperatur' && m.mitte===21,'nennen alle denselben Namen, bleibt er erhalten');
m=medianBereich([kh({min:18,max:22}),kh({min:28,max:32})]);
ok(m.mitte===25 && m.min===23 && m.max===27,'gerade Anzahl: Mittelwert der beiden mittleren (18–22 und 28–32 → 23–27, Mitte 25)');
ok(medianBereich([])===null && medianBereich([null,undefined])===null && medianBereich([null,kh(8)]).mitte===8,'leere Liste → null; leere Einträge werden ignoriert');

// --- Rezept vor Operation, Gare-Operation der Methode --------------------------------------------------------------------
ok(schrittTemperatur('gehen',{temperatur:'warm'},{temperaturen:{gehen:'raum'}})==='raum' && schrittTemperatur('gehen',{temperatur:'warm'},{temperaturen:{stueckgare:'raum'}})==='warm' && schrittTemperatur('gehen',{temperatur:'warm'},null)==='warm' && schrittTemperatur('gehen',{},{})===null && schrittTemperatur('gehen',null,undefined)===null,'Rezept überschreibt die Operation (nur unter dem gleichen Schlüssel); ohne beides null');
ok(schrittTemperatur('gehen',{temperatur:'warm'},{temperaturen:{gehen:0}})===0,'eine Rezept-Temperatur von 0 °C überschreibt die Operation');
const ops=J('operations'), meths=J('methods');
ok(gareOperation('hefe_direkt',meths,ops).temperatur==='warm' && gareOperation('hefe_kalt',meths,ops).temperatur==='kuehlschrank' && gareOperation('hefe_noknead',meths,ops).temperatur==='raum' && gareOperation('hefe_vorteig',meths,ops).temperatur==='warm','Gare-Operation je Methode: direkt warm, kalte Führung Kühlschrank (inline), ohne Kneten Raumtemperatur (inline), Vorteig warm (Hauptteig)');
ok(gareOperation('unbekannt',meths,ops).temperatur==='warm' && gareOperation('x',{},{})===null && gareOperation('x',undefined,undefined)===null,'unbekannte Methode: Vorgabe der Operation „gehen“; ohne Daten null');

// --- Daten ---------------------------------------------------------------------------------------------------------------------
const namen=Object.keys(T).filter(k=>!k.startsWith('_'));
ok(namen.join()==='kuehlschrank,kuehl,raum,warm,lauwarm,plastisch,teig,unterstellt' && namen.every(k=>T[k].label && T[k].min<T[k].max),'temperaturen.json: acht benannte Bereiche mit label und min < max (Gare: kühlschrank bis lauwarm; plastisch für Fett, teig für die Teigtemperatur, unterstellt für alles ohne Angabe)');
ok(T.unterstellt.min===-20 && T.unterstellt.max===27 && /ganze Bereich/.test(T._schema.unterstellt),'unterstellt: −20 bis 27 °C, Schema erklärt die Garantie-Regel');
const reihe=['kuehlschrank','kuehl','raum','warm','lauwarm'].map(k=>T[k]); // plastisch (18–22) und teig (24–26) liegen bewusst in raum und warm
ok(reihe.every((x,i)=>i===0||(x.min>=reihe[i-1].max-0.0001 || x===T.lauwarm)),'die Bereiche überlappen sich nicht (außer warm/lauwarm bei 30 °C)');
const specs=[]; // {wo, spec}
const abgeleitet=[];
for (const [k,o] of Object.entries(ops)) if(!k.startsWith('_') && o.temperatur!=null) (o.temperatur.von?abgeleitet:specs).push({wo:`operations/${k}`,spec:o.temperatur});
for (const [k,mt] of Object.entries(meths)) if(!k.startsWith('_')) for (const s of mt.sequenz||[]) if(typeof s==='object' && s.temperatur!=null) (s.temperatur.von?abgeleitet:specs).push({wo:`methods/${k}/${s.key}`,spec:s.temperatur});
ok(specs.length>=5 && specs.every(x=>temperaturBereich(x.spec,T)),`alle ${specs.length} festen Temperatur-Angaben an Operationen und Methoden lassen sich auflösen (${specs.map(x=>x.wo.split('/').pop()).join(', ')})`);
const kontextAlle={fett:{schmelzpunkt_c:34,aufschlag_temp:'plastisch'}};
ok(abgeleitet.length===2 && abgeleitet.every(x=>temperaturBereich(x.spec,T,kontextAlle)),`die ${abgeleitet.length} abgeleiteten Angaben (${abgeleitet.map(x=>x.wo.split('/').pop()).join(', ')}) lösen sich mit den Eigenschaften der Zutat auf`);
ok(!ops._schema.temperatur===false && /temperaturen/.test(ops._schema.temperatur) && !('kuehl' in meths._schema) && !Object.values(meths).some(x=>x&&x.kuehl!==undefined),'Schema dokumentiert `temperatur`; das alte Methoden-Flag `kuehl` ist weg');
const korpusDateien=fs.readdirSync(new URL(P+'data/corpus/')).filter(f=>f.endsWith('.json'));
let nRez=0, nTemp=0; const schlecht=[]; const alteFlags=[]; const schluessel=new Set();
for (const f of korpusDateien) for (const r of J('corpus/'+f.replace('.json',''))) {
  nRez++; if('gehen_kuehl' in r) alteFlags.push(r.id);
  for (const [k,v] of Object.entries(r.temperaturen||{})) { nTemp++; schluessel.add(k); if(!temperaturBereich(v,T)) schlecht.push(`${r.id}/${k}`); }
}
ok(alteFlags.length===0 && schlecht.length===0 && [...schluessel].every(k=>['gehen','vorteig','stueckgare'].includes(k)) && nTemp>=16,`Korpus: ${nTemp} Temperatur-Angaben in ${nRez} Rezepten, alle auflösbar, nur die Schlüssel gehen/vorteig/stueckgare, kein altes \`gehen_kuehl\`${schlecht.length?' — '+schlecht.join(', '):''}`);
const zopfZimt=J('corpus/hefezopf').find(r=>r.id==='zimtblume-hefeteig-kuehlschrank-uebernachtgare');
ok(temperaturBereich(zopfZimt.temperaturen.gehen,T).mitte===10 && /10 Grad/.test((zopfZimt.ablauf||[]).join(' ')),'Zahl aus dem Rezepttext („ca. 10 Grad im Kühlschrank“) steht als 10 ± 3 °C im Korpus');
const alleTexte=['src/main.js','src/model/corpus.js','src/model/engine.js','src/model/gaerung.js','src/model/ueberraschungen.js','src/ui/recipeCard.js','tools/gaerung-fit.mjs','tools/gaerung-pruefen.mjs','tools/ueberraschungen.mjs'].map(f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n');
ok(!/gehen_kuehl|kuehlAnteil|kuehl_faktor/.test(alleTexte),'kein Code liest mehr `gehen_kuehl`, `kuehlAnteil` oder `kuehl_faktor`');

// --- abgeleitete Temperatur (T56) --------------------------------------------------------------------------------------------------
const butter={fett:{schmelzpunkt_c:34,aufschlag_temp:'plastisch'}};
b=temperaturBereich({von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:1.05},T,butter);
ok(near(b.mitte,35.7) && near(b.min,35.7) && near(b.max,35.7) && b.name===null,'Schmelzen = Schmelzpunkt × 1,05: Butter 34 °C → 35,7 °C (Nutzer-Vorgabe „Schmelzpunkt plus etwa 5 %“)');
b=temperaturBereich({von:{rolle:'fett',feld:'aufschlag_temp'}},T,butter);
ok(b.min===18 && b.max===22 && b.mitte===20,'abgeleitet ohne Faktor aus einem Namen der Zutat: Aufschlagen bei 18–22 °C (plastisch)');
b=temperaturBereich({von:{rolle:'fett',feld:'aufschlag_temp'}},T,{fett:{aufschlag_temp:{min:15,max:24}}});
ok(b.min===15 && b.max===24,'das Zutaten-Feld darf auch eine Spanne sein (Margarine 15–24 °C)');
b=temperaturBereich({von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:1,tol:2},T,butter);
ok(b.min===32 && b.max===36 && b.mitte===34,'Spielraum tol verbreitert den abgeleiteten Bereich (34 ± 2 °C)');
for (const [spec,kontext,text] of [[{von:{rolle:'fett',feld:'schmelzpunkt_c'}},{fett:{}},'Feld fehlt (Öl hat keinen Schmelzpunkt)'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'}},null,'kein Kontext'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'}},{},'Rolle nicht belegt'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:0},butter,'Faktor 0'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:-1},butter,'negativer Faktor'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:'x'},butter,'Faktor als Text'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'},tol:-1},butter,'negativer Spielraum'],[{von:{rolle:'fett',feld:'schmelzpunkt_c'}},{fett:{schmelzpunkt_c:'heiß'}},'Feld unbekannter Name'],[{von:{rolle:'fett'}},butter,'Feld nicht benannt']]) {
  if (temperaturBereich(spec,T,kontext)!==null) ok(false,'abgeleitet, aber angenommen: '+text);
}
ok(true,'abgeleitet ungültig → null: Feld fehlt, kein Kontext, Rolle nicht belegt, Faktor 0 / negativ / Text, negativer Spielraum, Feld mit unbekanntem Namen, Feld nicht benannt');
{const pl=temperaturBereich({von:{rolle:'fett',feld:'aufschlag_temp'}},T,butter), sk=temperaturBereich({von:{rolle:'fett',feld:'aufschlag_temp'},faktor:1.1},T,butter), tl=temperaturBereich({von:{rolle:'fett',feld:'aufschlag_temp'},tol:1},T,butter);
 ok(pl.name==='plastisch' && pl.label==='plastisch' && fmtTemperatur(pl)==='18–22 °C (plastisch)' && sk.name===null && tl.name===null && near(sk.min,19.8) && near(tl.max,23),'unverändert (Faktor 1, kein Spielraum) behält der abgeleitete Bereich den Namen des Zutaten-Feldes; skaliert oder verbreitert nicht');}
ok(temperaturBereich(35,T,butter).mitte===35 &&temperaturBereich('raum',T,butter).mitte===21,'feste Angaben ignorieren den Kontext');
ok(wassertemperatur({ziel:25,mehl:21,raum:21,reibung:8})===25 && wassertemperatur({ziel:25,mehl:21,raum:21})===33 && wassertemperatur({ziel:25,mehl:null,raum:21,reibung:8})===null && wassertemperatur({ziel:NaN,mehl:1,raum:1})===null,'Faustformel Wassertemperatur = 3 × Ziel − Mehl − Raum − Reibung (25 °C Ziel, 21 °C Mehl und Raum, 8 K Reibung → 25 °C; ohne Reibung 33 °C; fehlende Zahlen → null)');
const ing2=J('ingredients');
const eintr=Object.entries(ing2).filter(([k])=>!k.startsWith('_'));
const schl=eintr.filter(([,z])=>z.cremig_schlagbar===true).map(([k])=>k).sort();
const mitTemp=eintr.filter(([,z])=>z.aufschlag_temp!=null).map(([k])=>k).sort();
ok(schl.join()===mitTemp.join() && schl.join()==='butter,margarine' && eintr.filter(([,z])=>z.aufschlag_temp!=null).every(([,z])=>temperaturBereich(z.aufschlag_temp,T)),'cremig_schlagbar gilt genau für Zutaten mit aufschlag_temp (Butter, Margarine), und der Bereich löst sich auf');
ok(eintr.filter(([,z])=>z.schmelzpunkt_c!=null).map(([k])=>k).sort().join()==='butter,margarine' && eintr.filter(([,z])=>z.schmelzpunkt_c!=null).every(([,z])=>z.aufschlag_temp!=null && temperaturBereich(z.aufschlag_temp,T).max<z.schmelzpunkt_c),'der Aufschlag-Bereich liegt bei jedem festen Fett unter dem Schmelzpunkt (sonst wäre es flüssig)');

// --- Engine ----------------------------------------------------------------------------------------------------------------------
const data={...Object.fromEntries(['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'].map(n=>[n,J(n)]))};
const arch=data.archetypes.hefeteig; const rollen=arch.rollen.map(r=>r.rolle);
const ks={}; for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen})),rollen);
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const zustand=(vk,methode)=>{const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);return {archetyp:'hefeteig',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z};};
const schritt=(c,key)=>c.ablauf.find(s=>s.key===key);
let c=compute(zustand('weissbrot','hefe_direkt'),data,ks);
ok(schritt(c,'gehen').temperatur==='26–30 °C (warm)' && schritt(c,'stueckgare').temperatur==='26–30 °C (warm)' && schritt(c,'hefe_ansetzen').temperatur==='30–35 °C (lauwarm)','Ablauf zeigt die Temperatur der Aktion: Gehen warm, Stückgare warm, Hefe lösen lauwarm');
ok(schritt(c,'formen').temperatur===null && schritt(c,'backen').temperatur===null && c.ablauf.filter(s=>s.temperatur).length===4,'Schritte ohne Temperatur-Angabe zeigen keine (Formen, Backen: Ofen-Zahlen stehen in `backen`); Temperatur zeigen Hefe lösen, Kneten (Teig), Gehen, Stückgare');
c=compute(zustand('weissbrot','hefe_kalt'),data,ks);
ok(/4–7 °C/.test(schritt(c,'gehen').temperatur) && /warm/.test(schritt(c,'stueckgare').temperatur),'Kalte Führung: Gehen im Kühlschrank, Stückgare danach warm');
ok(c.gaerung.temp===5.5 && c.gaerung.fenster && c.gaerung.fenster[0]<c.gaerung.erwartet && c.gaerung.erwartet<c.gaerung.fenster[1],`Gärmodell: Erwartung bei der Mitte (5,5 °C) und ein Fenster aus der Breite des Bereichs (${Math.round(c.gaerung.fenster[0])}–${Math.round(c.gaerung.fenster[1])} Min. um ${Math.round(c.gaerung.erwartet)} Min.): wärmer = kürzer`);
{const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle); const v=ruehr.varianten.kastenkuchen;
 const ksR=Object.fromEntries(Object.entries(ruehr.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr)]));
 const z={}; for (const r of ruehr.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
 const cr=compute({archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z},data,ksR);
 ok(cr.ablauf.filter(s=>s.temperatur).map(s=>s.key).join()==='aufschlagen' && cr.gaerung===null,'Rührteig (Crememethode): nur „Aufschlagen“ nennt eine Temperatur (aus der Butter abgeleitet), kein Gärmodell');}

c=compute(zustand('weissbrot','hefe_direkt'),data,ks);
ok(schritt(c,'kneten').temperatur==='24–26 °C (Teig) · Wasser etwa 25 °C','Kneten: Teig 24–26 °C, Wasser etwa 25 °C (Faustformel mit 21 °C Mehl und Raum, 8 K Reibung)');
ok(ops.kneten.reibung_k===8 && ops.kneten.temperatur==='teig','Daten: Kneten trägt Teigtemperatur und Reibung in operations.json');
{const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle);
 const ksR=Object.fromEntries(Object.entries(ruehr.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr)]));
 const v=ruehr.varianten.kastenkuchen; const base={}; for (const r of ruehr.rollen) base[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
 const rechne=(over,methode=null)=>compute({archetyp:'ruehrteig',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:{...base,...over}},data,ksR);
 let cr=rechne({});
 ok(cr.ablauf.find(s=>s.key==='aufschlagen').temperatur==='18–22 °C (plastisch)','Crememethode mit Butter: Aufschlagen bei 18–22 °C (plastisch), aus der Zutat abgeleitet');
 cr=rechne({fett:E('margarine')});
 ok(cr.ablauf.find(s=>s.key==='aufschlagen').temperatur==='15–24 °C','mit Margarine: Aufschlagen bei 15–24 °C (breiterer plastischer Bereich)');
 cr=rechne({fett:E('butter')},'ruehroel');
 const sch=cr.ablauf.find(s=>s.key==='schmelzen');
 ok(sch && sch.temperatur==='35,7 °C','Rühr-Öl-Methode mit Butter: eingefügtes „Schmelzen“ bei 35,7 °C (Schmelzpunkt 34 °C × 1,05)');
 cr=rechne({fett:E('margarine')},'ruehroel');
 ok(cr.ablauf.find(s=>s.key==='schmelzen').temperatur==='37,8 °C','mit Margarine (Schmelzpunkt 36 °C): 37,8 °C');
 cr=rechne({fett:E('pflanzenoel')},'ruehroel');
 ok(!cr.ablauf.some(s=>s.key==='schmelzen') && cr.ablauf.every(s=>s.temperatur===null),'mit Öl: kein Schmelzen und keine abgeleitete Temperatur (Öl hat weder Schmelzpunkt noch Aufschlag-Bereich)');}

// Mehrheit der Rezepte nennt eine eigene Temperatur → deren Median; sonst die Vorgabe der Operation
const zelle=(vk,methode,liste)=>({...ks,[vk]:{...ks[vk],proMethode:{...ks[vk].proMethode,[methode]:{...ks[vk].proMethode[methode],gareTemperaturen:liste}}}});
const nZelle=ks.weissbrot.proMethode.hefe_direkt.n;
const tempMit=(liste)=>compute(zustand('weissbrot','hefe_direkt'),data,zelle('weissbrot','hefe_direkt',liste)).gaerung.temp;
ok(near(tempMit(Array(nZelle).fill('raum')),21) && near(tempMit(Array(nZelle).fill(8)),8),`alle ${nZelle} Rezepte der Zelle nennen „raum“ bzw. 8 °C → das Modell rechnet damit`);
ok(near(tempMit([]),28) && near(tempMit(Array(Math.floor(nZelle/2)).fill('raum')),28),'keine oder genau die Hälfte der Rezepte nennt eine Temperatur → Vorgabe der Operation (warm, 28 °C); es braucht mehr als die Hälfte');
ok(near(tempMit(Array(Math.floor(nZelle/2)+1).fill('raum')),21),'mehr als die Hälfte → deren Temperatur gilt');
ok(near(tempMit([...Array(nZelle).fill('gibtsnicht')]),28) && near(tempMit([...Array(nZelle-1).fill('raum'),'gibtsnicht']),21),'ungültige Angaben zählen nicht mit (nur gültige Namen), kein Absturz');
c=compute(zustand('weissbrot','hefe_direkt'),{...data,temperaturen:undefined},ks);
ok(c.gaerung.temp===data.modelle.gaerung.temp_standard && c.gaerung.tempText===null && c.gaerung.kuehl===false && schritt(c,'gehen').temperatur===null,'ohne temperaturen.json: Modell rechnet mit `temp_standard`, keine Temperatur-Anzeige, kein Absturz');
// Korpus-Zellen: die Angaben der Rezepte kommen in den Statistiken an
const kz=ks.weissbrot.proMethode;
ok(kz.hefe_noknead.gareTemperaturen.filter(t=>t==='raum').length>=4 && kz.hefe_kalt.gareTemperaturen.length===kz.hefe_kalt.n && ks.hefezopf.proMethode.hefe_kalt.gareTemperaturen.length===ks.hefezopf.proMethode.hefe_kalt.n,'Statistik je Methode führt die genannten Gär-Temperaturen: ohne Kneten mehrfach Raumtemperatur, alle kalten Führungen nennen eine');
ok(kz.hefe_direkt.gareTemperaturen.length===0 && ks.hefezopf.proMethode.hefe_direkt.gareTemperaturen.length===3,'Statistik führt nur ausdrücklich genannte Temperaturen: Weißbrot direkt keine, Hefezopf direkt drei (Zimmertemperatur, zwei Ofen-Gaeren)');
c=compute(zustand('weissbrot','hefe_noknead'),data,ks);
ok(c.gaerung.temp===21 && /18–24 °C/.test(c.gaerung.tempText),`Weißbrot ohne Kneten: die Rezepte nennen überwiegend Raumtemperatur → ${c.gaerung.tempText}`);

console.log(fail?fail+' FAIL':'ALL PASS');
