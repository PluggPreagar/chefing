// T62 (DR-032): Zustands-Eigenschaften aus der Temperatur — Aggregat und Form der Zutat, geordnete Skala, Garantie-Regel, Vorbereitung.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { aggregatAus, formVon, cremigAus, erfuellt, standardBereich, FORM_SKALA, FORM_LABEL } = await import(P+'model/eigenschaften.js');
const { temperaturBereich } = await import(P+'model/temperatur.js');
const { propsOf, blendProps, pruefeBedingung, checkOperation, nachVorbereitung, resolveMethod, alleUeberschreibbarenRegeln } = await import(P+'model/rules.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const ing=data.ingredients, T=data.temperaturen;
const R=(s)=>temperaturBereich(s,T);

// --- Aggregat aus Temperatur und Schmelzpunkt -------------------------------------------------------------------------------------
const std=standardBereich(T);
ok(std.min===-20 && std.max===27 && std.name==='unterstellt','Standard-Bereich: −20 bis 27 °C (benannt „unterstellt“)');
ok(standardBereich({})===null && standardBereich(undefined)===null,'ohne Daten kein Standard-Bereich');
ok(aggregatAus(std,ing.butter)==='fest' && aggregatAus(std,ing.margarine)==='fest','Butter und Margarine sind im ganzen Standard-Bereich fest (Schmelzpunkt 34 und 36 °C)');
ok(aggregatAus(R({von:{rolle:'fett',feld:'schmelzpunkt_c'},faktor:1.05}) ?? {min:35.7,max:35.7},ing.butter)==='fluessig' && aggregatAus({min:34,max:34},ing.butter)==='fluessig' && aggregatAus({min:33.9,max:33.9},ing.butter)==='fest','Grenze genau am Schmelzpunkt: ab 34 °C flüssig, knapp darunter fest');
ok(aggregatAus({min:30,max:40},ing.butter)==='unbestimmt' && aggregatAus(R('lauwarm'),ing.butter)==='unbestimmt','Bereich über dem Schmelzpunkt hinweg (30–40 °C, lauwarm 30–35 °C): unbestimmt, nicht „irgendwie fest“');
ok(aggregatAus(R('kuehlschrank'),ing.butter)==='fest' && aggregatAus({min:50,max:60},ing.butter)==='fluessig','Kühlschrank: fest; 50–60 °C: flüssig');
ok(aggregatAus(std,ing.pflanzenoel)==='fluessig' && aggregatAus(std,ing.weizenmehl)==='pulver' && aggregatAus({min:90,max:100},ing.milch)==='fluessig' && aggregatAus(null,ing.butter)==='fest','ohne Schmelzpunkt (Öl, Mehl, Milch) oder ohne Temperatur gilt das Aggregat der Zutat');

// --- Form: geordnete Skala --------------------------------------------------------------------------------------------------------
ok(FORM_SKALA.join()==='block,stueckig,broeselig,kleinteilig,fluessig' && FORM_SKALA.every(f=>FORM_LABEL[f]),'Skala von grob nach fein, jede Stufe mit Anzeigename');
ok(formVon(ing.butter,'fest')==='block' && formVon(ing.butter,'fluessig')==='fluessig' && formVon(ing.butter,'unbestimmt')==='unbestimmt','Butter: fest = Block, flüssig = flüssig, unbestimmt bleibt unbestimmt');
ok(formVon(ing.weizenmehl,'pulver')==='kleinteilig' && formVon(ing.schokolade,'stueckig')==='stueckig' && formVon(ing.hefe_frisch,'fest')==='broeselig' && formVon(ing.zitronenabrieb,'stueckig')==='kleinteilig' && formVon(ing.milch,'fluessig')==='fluessig','Form aus dem Aggregat; Frischhefe bröselig, Abrieb kleinteilig (Feld `form` der Zutat)');
ok(erfuellt({eigenschaft:'form',mindestens:'kleinteilig'},'fluessig') && erfuellt({eigenschaft:'form',mindestens:'kleinteilig'},'kleinteilig') && !erfuellt({eigenschaft:'form',mindestens:'kleinteilig'},'broeselig') && !erfuellt({eigenschaft:'form',mindestens:'kleinteilig'},'block'),'„mindestens kleinteilig“: flüssig und kleinteilig erfüllen, bröselig und Block nicht');
ok(erfuellt({eigenschaft:'form',hoechstens:'broeselig'},'block') && !erfuellt({eigenschaft:'form',hoechstens:'broeselig'},'kleinteilig') && erfuellt({eigenschaft:'form',mindestens:'stueckig',hoechstens:'kleinteilig'},'broeselig') && !erfuellt({eigenschaft:'form',mindestens:'stueckig',hoechstens:'kleinteilig'},'fluessig'),'„höchstens“ und beides zusammen (Spanne auf der Skala)');
ok(!erfuellt({eigenschaft:'form',mindestens:'block'},null) && !erfuellt({eigenschaft:'form',mindestens:'block'},undefined) && !erfuellt({eigenschaft:'form',mindestens:'block'},'gibtsnicht') && !erfuellt({eigenschaft:'farbe',mindestens:'rot'},'rot'),'Unbekannter Wert oder unbekannte Skala erfüllt nie (Garantie-Regel)');
ok(erfuellt({eigenschaft:'form',hoechstens:'broeselig'},'broeselig') && erfuellt({eigenschaft:'form',mindestens:'broeselig'},'broeselig') && formVon({form:'broeselig'},'fluessig')==='fluessig' && formVon({form:'broeselig'},'fest')==='broeselig','Grenzen der Skala gelten (mindestens/höchstens einschließlich); flüssig ist immer „flüssig“, auch bei eigenem Feld');
ok(erfuellt({wert:'fest'},'fest') && !erfuellt({wert:'fest'},'fluessig') && erfuellt({wert:true},true) && !erfuellt({wert:'fest'},undefined),'Gleichheit wie bisher');

// --- propsOf: Standard und genannte Temperatur --------------------------------------------------------------------------------------
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
let p=propsOf({fett:E('butter'),fluessigkeit:E('milch')},ing,{benannt:T});
ok(p.fett.aggregat==='fest' && p.fett.form==='block' && p.fett.temperatur.max===27 && p.fluessigkeit.aggregat==='fluessig' && p.fluessigkeit.form==='fluessig','ohne Angabe gilt der Standard: Butter fest und Block, Milch flüssig');
ok(propsOf({fett:E('butter')},ing).fett.aggregat==='fest' && propsOf({fett:E('butter')},ing).fett.temperatur===undefined,'ohne `benannt` bleibt alles wie in der Zutaten-Datei (kein Temperatur-Feld)');
p=propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:50}});
ok(p.fett.aggregat==='fluessig' && p.fett.form==='fluessig' && p.fett.temperatur.mitte===50,'Rezept nennt 50 °C für das Fett: flüssig');
p=propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'lauwarm'}});
ok(p.fett.aggregat==='unbestimmt' && p.fett.form==='unbestimmt','Rezept nennt „lauwarm“ (30–35 °C): unbestimmt — der Schmelzpunkt liegt im Bereich');
p=propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'gibtsnicht'}});
ok(p.fett.aggregat==='fest' && p.fett.temperatur.name==='unterstellt','unbekannter Temperatur-Name: es bleibt beim Standard (keine stille Zufallsangabe)');
p=propsOf({fett:E('butter'),aroma:E('zimt')},ing,{benannt:T,zutatTemp:{fett:'kuehlschrank'}});
ok(p.fett.temperatur.name==='kuehlschrank' && p.aroma.temperatur.name==='unterstellt','die Angabe gilt nur für die genannte Rolle');
const mix=blendProps([{zutat:'butter',anteil:3},{zutat:'pflanzenoel',anteil:1}],ing,std);
ok(mix.aggregat==='fest' && mix.form==='block' && mix.key==='butter','Mischung folgt wie bisher der anteilsstärksten Zutat (Butter: fest)');

// --- Bedingungen und Texte -----------------------------------------------------------------------------------------------------
p=propsOf({fett:E('butter'),trieb:E('hefe_frisch')},ing,{benannt:T});
ok(pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},p).ist==='fest' && pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},p).ist==='block' && !pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},p).ok,'Butter im Standard-Bereich: „mindestens kleinteilig“ nicht erfüllt, ist = block');
ok(pruefeBedingung({rolle:'trieb',eigenschaft:'form',mindestens:'broeselig'},p).ok && pruefeBedingung({rolle:'!fett',eigenschaft:'form',mindestens:'broeselig'},p).ok && !pruefeBedingung({rolle:'!trieb',eigenschaft:'form',mindestens:'broeselig'},p).ok,'Frischhefe erfüllt „mindestens bröselig“; „!rolle“ gilt auch mit Skala');
const lau=propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'lauwarm'}});
ok(pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fest'},lau).ist==='unbestimmt' && !pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},lau).ok && !pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fest'},lau).ok,'unbestimmtes Aggregat erfüllt weder „fest“ noch „flüssig“');

ok(pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},lau).ist==='unbestimmt' && pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},lau).ok===false && pruefeBedingung({rolle:'fett',eigenschaft:'gibtsnicht',wert:1},lau).ist==='unbekannt','Form unbestimmt: „unbestimmt“, nicht erfüllt; eine unbekannte Eigenschaft bleibt „unbekannt“');

// --- Vorbereitung: Schmelzen setzt die Temperatur, Aggregat und Form folgen --------------------------------------------------------
const nach=nachVorbereitung('schmelzen',propsOf({fett:E('butter')},ing,{benannt:T}),data.operations,data);
ok(near(nach.fett.temperatur.mitte,34*1.05) && nach.fett.aggregat==='fluessig' && nach.fett.form==='fluessig' && nach.fett.cremig_schlagbar===false && nach.fett.geschmolzen===true,'Schmelzen: Butter auf 35,7 °C (Schmelzpunkt × 1,05) → flüssig und „fluessig“; nicht mehr cremig schlagbar');
const nachM=nachVorbereitung('schmelzen',propsOf({fett:E('margarine')},ing,{benannt:T}),data.operations,data);
ok(near(nachM.fett.temperatur.mitte,36*1.05) && nachM.fett.aggregat==='fluessig','Margarine: 37,8 °C → flüssig (der Schmelzpunkt der Zutat bestimmt die Temperatur)');
ok(nachVorbereitung('schmelzen',propsOf({fett:E('butter')},ing),data.operations).fett.aggregat==='fest' && nachVorbereitung('schmelzen',propsOf({fett:E('butter')},ing),data.operations).fett.geschmolzen===true,'ohne `data` (alter Aufruf) bricht nichts: die Temperatur entfällt, die übrigen Felder gelten');
ok(nachVorbereitung('gibtsnicht',p,data.operations)===p && nachVorbereitung('schmelzen',{},data.operations,data).fett===undefined,'unbekannte Operation oder fehlende Rolle: unverändert');
const mitO=propsOf({fett:E('pflanzenoel')},ing,{benannt:T});
ok(nachVorbereitung('schmelzen',mitO,data.operations,data).fett.aggregat==='fluessig','Öl bleibt flüssig (kein Schmelzpunkt: Temperatur ändert nichts)');
// Ende-zu-Ende: Verquirlen braucht flüssiges Fett, Butter wird vorher geschmolzen
const rr=data.archetypes.ruehrteig.rollen.map(r=>r.rolle); const v0=data.archetypes.ruehrteig.varianten.muffin;
const basis={}; for (const r of data.archetypes.ruehrteig.rollen) basis[r.rolle]=E(v0.bestof[r.rolle]!==undefined?v0.bestof[r.rolle]:r.default);
let res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,data);
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen') && res.zustaende.some(z=>z.rolle==='fett' && z.zustand==='geschmolzen' && /flüssiges Fett \(ist: fest\)/.test(z.grund)),'Muffin mit Butter: „geschmolzen“ als Zustand an der Butter, Begründung nennt „flüssiges Fett (ist: fest)“, kein Schritt (DR-064)');
res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,{...data,zustaende:J('zustaende')},{rollen:{},zutaten:{}},null,{},{fett:'topf'});
ok(res.schritte.some(s=>s.key==='schmelzen' && s.eingefuegt && s.op.ort==='topf' && s.op.zustandWeg==='topf') && res.status==='ok','Weg „Im Topf“ gewählt: Schmelzen-Schritt im Topf, Status bleibt ok');
res=resolveMethod('muffin',{...basis,fett:E('pflanzenoel')},v0.gefaess,data);
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen'),'Muffin mit Öl: kein Schmelzen nötig');
res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,data,{rollen:{},zutaten:{}},{fett:50});
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen'),'Rezept nennt „Butter 50 °C“ (schon flüssig): kein Schmelzen eingefügt');
res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,data,{rollen:{},zutaten:{}},{fett:'lauwarm'});
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen') && res.zustaende.some(z=>z.zustand==='geschmolzen' && /unbestimmt/.test(z.grund)) && !res.warnungen.some(w=>/nicht sicher gegeben/.test(w)),'Butter „lauwarm“ (30–35 °C): im Zweifel Zustand „geschmolzen“ an der Zutat statt Warnung (DR-064)');
const ks={}; for (const [k,x] of Object.entries(data.archetypes.ruehrteig.varianten)) ks[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr);
const c=compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')},zutatTemperaturen:{fett:50}},data,ks);
ok(c.status!=='prep' && !c.regelIds.some(i=>/^prep:schmelzen/.test(i)),'Engine reicht die Zutaten-Temperatur durch (state.zutatTemperaturen)');
const c0=compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')}},data,ks);
ok(c0.status==='ok' && !c0.regelIds.some(i=>/^prep:/.test(i)) && c0.zustaende.some(z=>z.zustand==='geschmolzen'),'ohne Angabe: Butter für Muffins als Zustand „geschmolzen“ an der Zutat, kein Schritt (DR-064)');
{const regel={regeln:[{id:'t',rolle:'fett',wenn:{rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},faktor:0.5,begruendung:'Regel greift bei {fett}.',quelle:'t'}]};
 const zt=(extra)=>compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')},...extra},{...data,erfahrungsregeln:regel},ks);
 ok(zt({zutatTemperaturen:{fett:50}}).anpassungen.some(a=>/Regel greift/.test(a)) && !zt({}).anpassungen.some(a=>/Regel greift/.test(a)),'die Erfahrungsregeln der Engine sehen den Zustand „Butter 50 °C = flüssig“ (und bei fester Butter nicht)');}


// --- Cremig schlagbar und Aufschlag-Temperatur (T62): im Zweifel Warnung ----------------------------------------------------------
const pl=R('plastisch'); // 18–22 °C
ok(cremigAus(R({min:19,max:21}),ing.butter,T)===true && cremigAus(pl,ing.butter,T)===true && cremigAus(R({wert:20}),ing.butter,T)===true,'ganz im Bereich zum Aufschlagen (Butter 18–22 °C): ja');
ok(cremigAus(R('kuehlschrank'),ing.butter,T)===false && cremigAus({min:50,max:50},ing.butter,T)===false && cremigAus({min:22.1,max:30},ing.butter,T)===false && cremigAus({min:10,max:17.9},ing.butter,T)===false,'ganz daneben (Kühlschrank, 50 °C, knapp über 22, knapp unter 18): nein');
ok(cremigAus(std,ing.butter,T)==='unbestimmt' && cremigAus({min:18,max:25},ing.butter,T)==='unbestimmt' && cremigAus({min:22,max:30},ing.butter,T)==='unbestimmt' && cremigAus({min:17,max:20},ing.butter,T)==='unbestimmt','Überlappt der Bereich nur teilweise (Standard −20 bis 27, auch bei Berührung am Rand 22): unbestimmt');
ok(cremigAus(std,ing.margarine,T)==='unbestimmt' && cremigAus({min:16,max:23},ing.margarine,T)===true,'Margarine (15–24 °C) hat ihren eigenen Bereich');
ok(cremigAus(std,ing.pflanzenoel,T)===false && cremigAus(std,ing.weizenmehl,T)===undefined && cremigAus(null,ing.butter,T)===true && cremigAus(std,{aufschlag_temp:'gibtsnicht',cremig_schlagbar:true},T)===true,'ohne Aufschlag-Temperatur oder ohne Temperatur gilt das Feld der Zutat; unbekannter Name: Feld der Zutat');
p=propsOf({fett:E('butter')},ing,{benannt:T});
ok(p.fett.cremig_schlagbar==='unbestimmt' && propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'plastisch'}}).fett.cremig_schlagbar===true && propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'kuehlschrank'}}).fett.cremig_schlagbar===false,'propsOf: Standard unbestimmt, „plastisch“ ja, Kühlschrank nein');
ok(propsOf({fett:E('butter')},ing).fett.cremig_schlagbar===true,'ohne Temperatur-Daten bleibt das Feld der Zutat (alter Aufruf)');
ok(nachVorbereitung('schmelzen',propsOf({fett:E('butter')},ing,{benannt:T}),data.operations,data).fett.cremig_schlagbar===false && !('cremig_schlagbar' in data.operations.schmelzen.wirkt_auf_eigenschaften.fett),'Schmelzen: geschmolzene Butter ist nicht cremig schlagbar — aus der Temperatur abgeleitet, nicht von Hand gesetzt');
// Checks an der Operation: unbestimmt → Hinweis (empfehlungen mit unsicher), nie ein Grund oder eine eingefügte Vorbereitung
const aufschl={label:'Aufschlagen',voraussetzung:[{rolle:'fett',eigenschaft:'cremig_schlagbar',wert:true,strenge:'hart',id:'x'}]};
let ck=checkOperation(aufschl,propsOf({fett:E('butter')},ing,{benannt:T}),data.operations);
ok(ck.ok && ck.fehlend.length===0 && ck.vorbereitung===null && ck.empfehlungen.length===1 && ck.empfehlungen[0].unsicher===true && ck.empfehlungen[0].strenge==='empfohlen' && ck.empfehlungen[0].temperatur.name==='unterstellt','hart-Anforderung, Wert unbestimmt: ok mit Hinweis (unsicher, Temperatur), keine Vorbereitung');
ck=checkOperation(aufschl,propsOf({fett:E('butter')},ing,{benannt:T,zutatTemp:{fett:'kuehlschrank'}}),data.operations);
ok(!ck.ok && ck.fehlend.length===1 && ck.fehlend[0].ist==='false' && ck.empfehlungen.length===0,'sicher nicht erfüllt (Butter aus dem Kühlschrank): hart, ungültig');
ck=checkOperation({...aufschl,voraussetzung:[{...aufschl.voraussetzung[0],strenge:'frei'}]},propsOf({fett:E('butter')},ing,{benannt:T}),data.operations);
ok(ck.ok && ck.empfehlungen.length===0,'Strenge „frei“ bleibt ohne Hinweis, auch bei unbestimmt');
ck=checkOperation({...aufschl,voraussetzung:[{...aufschl.voraussetzung[0],strenge:'empfohlen'}]},propsOf({fett:E('butter')},ing,{benannt:T}),data.operations);
ok(ck.ok && ck.empfehlungen.length===1 && ck.empfehlungen[0].unsicher===true,'Strenge „empfohlen“ und unbestimmt: ebenfalls Hinweis mit Temperatur');
// Ende-zu-Ende: Crememethode
{const a=data.archetypes.ruehrteig; const vk=a.varianten.kastenkuchen; const b2={}; for (const r of a.rollen) b2[r.rolle]=E(vk.bestof[r.rolle]!==undefined?vk.bestof[r.rolle]:r.default);
 const ev=(zt)=>compute({archetyp:'ruehrteig',gefaess:vk.gefaess,methode:'creme',fixiert:{rollen:{},zutaten:{}},zutaten:b2,zutatTemperaturen:zt},data,ks);
 const w=(c)=>c.warnungen.filter(x=>/nicht sicher gegeben/.test(x));
 ok(ev().status==='ok' && w(ev()).length===0 && ev().zustaende.some(z=>z.rolle==='fett' && z.zustand==='weich') && ev().zustaende.some(z=>z.rolle==='bindung' && z.zustand==='zimmerwarm') && !ev().ablauf.some(s=>s.key==='temperieren'),'Kastenkuchen (Creme) mit Butter ohne Temperaturangabe: Butter „weich“ und Eier „zimmerwarm“ als Zustand an der Zutat, kein Schritt, keine Warnung (DR-064)');
 ok(ev({fett:'plastisch'}).status==='ok' && w(ev({fett:'plastisch'})).length===0 && ev({fett:20}).warnungen.every(x=>!/nicht sicher/.test(x)),'Rezept nennt „Butter zimmerwarm (18–22 °C)“: kein Hinweis');
 ok(ev({fett:'kuehlschrank'}).status==='ok' && ev({fett:'kuehlschrank'}).zustaende.some(z=>/ist: nein/.test(z.grund)) && !ev({fett:'kuehlschrank'}).gruende.length,'Rezept nennt „Butter aus dem Kühlschrank“: Zustand „weich“ an der Zutat (DR-064, vorher ungültig)');
 ok(ev({fett:'lauwarm'}).evals.creme.status==='invalid','Butter lauwarm (zu warm): weich werden lassen hilft nicht, Creme bleibt ungültig');
 // gemischt: eine normale Empfehlung und ein Zweifel an derselben Operation ergeben zwei getrennte Meldungen, jede nur mit ihrem Teil
 const creme=data.methods.creme;
 const d2={...data,methods:{...data.methods,creme:{...creme,sequenz:creme.sequenz.map(e=>typeof e==='object' && e.key==='aufschlagen' ? {...e,voraussetzung:[...e.voraussetzung,{rolle:'fett',eigenschaft:'aggregat',wert:'fluessig',strenge:'empfohlen'}]} : e)}}};
 const cg=compute({archetyp:'ruehrteig',gefaess:vk.gefaess,methode:'creme',fixiert:{rollen:{},zutaten:{}},zutaten:b2},d2,ks);
 const wn=cg.warnungen.filter(x=>/empfohlen, aber nicht zwingend/.test(x)), wu=cg.warnungen.filter(x=>/nicht sicher gegeben/.test(x));
 ok(wn.length===1 && !/cremig/.test(wn[0]) && /flüssiges Fett/.test(wn[0]) && wu.length===0 && cg.zustaende.filter(z=>z.rolle==='fett').length===1 && /cremig schlagbares/.test(cg.zustaende.find(z=>z.rolle==='fett').grund) && !/flüssiges/.test(cg.zustaende.find(z=>z.rolle==='fett').grund),'normale Empfehlung und Zweifel an einer Operation: Empfehlung als Meldung, der Zweifel als Zustand an der Zutat — jede nur mit ihrem Teil');
 // Aufschlag-Temperatur als einzelne Zahl: „plastisch bei 20 °C“
 // ohne wegklickbare Vorbereitung (T94) bleibt der Zweifel eine Warnung — dort steht die Aufschlag-Temperatur
 const d3={...data,ingredients:{...data.ingredients,butter:{...data.ingredients.butter,aufschlag_temp:20}},methods:{...data.methods,creme:{...creme,sequenz:creme.sequenz.map(e=>typeof e==='object' && e.key==='aufschlagen' ? (({vorbereitung_falls_nicht,...rest})=>rest)(e) : e)}}};
 const c3=compute({archetyp:'ruehrteig',gefaess:vk.gefaess,methode:'creme',fixiert:{rollen:{},zutaten:{}},zutaten:b2},d3,ks);
 ok(c3.warnungen.some(x=>/\(plastisch bei 20 °C\)/.test(x)),'Aufschlag-Temperatur als einzelne Zahl: „plastisch bei 20 °C“ (keine Spanne)');
 ok(ev({fett:'lauwarm'}).status==='invalid' && ev({fett:'lauwarm'}).gruende.some(g=>/cremig schlagbares Fett \(ist: nein\)/.test(g)),'Butter „lauwarm“ (30–35 °C) liegt ganz über 22 °C: sicher nicht plastisch, Creme ungültig (der Zweifel beim Schmelzpunkt allein hebt das nicht auf)');
}

// --- Lebende Kulturen: Temperatur-Obergrenze (T63, DR-034) ---------------------------------------------------------------------------
{const hy={rolle:'fluessigkeit',eigenschaft:'temperatur',hoechstens:{von:{rolle:'trieb',feld:'kultur_max_c'}}};
 const mitT=(t,trieb='hefe_frisch')=>propsOf({fluessigkeit:E('milch'),trieb:E(trieb)},ing,{benannt:T,zutatTemp:t?{fluessigkeit:t}:undefined});
 ok(ing.hefe_frisch.kultur_max_c===42 && ing.hefe_trocken.kultur_max_c===42 && ing.joghurt.kultur_max_c===50 && Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && v?.kultur_max_c!==undefined).length===3,'Daten: Hefe 42 °C, Joghurt-Kulturen 50 °C — nur diese drei Zutaten tragen eine Kultur-Grenze');
 ok(pruefeBedingung(hy,mitT()).ok && pruefeBedingung(hy,mitT('lauwarm')).ok && pruefeBedingung(hy,mitT('kuehlschrank')).ok,'Standard-Bereich (−20 bis 27 °C), lauwarm und Kühlschrank liegen ganz unter 42 °C: erfüllt, kein Hinweis');
 ok(pruefeBedingung(hy,mitT(42)).ok && !pruefeBedingung(hy,mitT(42.1)).ok && pruefeBedingung(hy,mitT({min:38,max:42})).ok,'Grenze genau bei 42 °C: erfüllt (höchstens schließt ein), 42,1 °C nicht');
 let r2=pruefeBedingung(hy,mitT(50));
 ok(!r2.ok && r2.ist==='50 °C' && r2.hoechstens===42,'50 °C Flüssigkeit: nicht erfüllt, ganz über der Grenze (ist: 50 °C, Grenze 42)');
 r2=pruefeBedingung(hy,mitT({min:40,max:50}));
 ok(!r2.ok && r2.ist==='unbestimmt' && r2.hoechstens===42,'Bereich 40–50 °C überdeckt die Grenze: unbestimmt (im Zweifel Warnung)');
 ok(pruefeBedingung(hy,mitT({min:42,max:50})).ist==='unbestimmt' && pruefeBedingung(hy,mitT({min:42.1,max:50})).ist==='42,1–50 °C' && pruefeBedingung({rolle:'fluessigkeit',eigenschaft:'temperatur',mindestens:20},mitT({min:15,max:20})).ist==='unbestimmt' && pruefeBedingung({rolle:'fluessigkeit',eigenschaft:'temperatur',mindestens:20},mitT({min:15,max:19.9})).ist==='15–19,9 °C','Berührung am Rand der Grenze (genau 42 bzw. 20 °C) ist unbestimmt, knapp daneben sicher nicht erfüllt');
 ok(pruefeBedingung(hy,mitT(60,'backpulver')).ist==='unbekannt','ohne Kultur-Grenze bleibt „ist“ unbekannt (keine Scheinangabe)');
 ok(pruefeBedingung(hy,mitT(60,'backpulver')).ok && pruefeBedingung(hy,mitT(60,'natron')).ok,'ohne Kultur in der Rolle „Trieb“ (Backpulver, Natron) gibt es keine Grenze: erfüllt');
 ok(pruefeBedingung(hy,propsOf({fluessigkeit:E('milch'),trieb:E('hefe_frisch')},ing)).ok && pruefeBedingung(hy,propsOf({fluessigkeit:E('milch')},ing,{benannt:T})).ok,'ohne Temperatur-Daten (alter Aufruf) oder ohne Trieb-Rolle: erfüllt');
 ok(!pruefeBedingung(hy,propsOf({trieb:E('hefe_frisch')},ing,{benannt:T})).ok && pruefeBedingung(hy,propsOf({trieb:E('hefe_frisch')},ing,{benannt:T})).ist==='nicht belegt','Rolle ohne Zutat: „nicht belegt“ wie bei jeder Bedingung');
 const hm={rolle:'fluessigkeit',eigenschaft:'temperatur',mindestens:20};
 ok(pruefeBedingung(hm,mitT({min:21,max:25})).ok && pruefeBedingung(hm,mitT(20)).ok && !pruefeBedingung(hm,mitT(10)).ok && pruefeBedingung(hm,mitT({min:15,max:25})).ist==='unbestimmt','„mindestens“ als Zahl: ganz darüber erfüllt (20 °C genau), ganz darunter nicht, dazwischen unbestimmt');
 ok(pruefeBedingung({rolle:'fluessigkeit',eigenschaft:'temperatur',hoechstens:30},mitT({min:25,max:29})).ok && !pruefeBedingung({rolle:'fluessigkeit',eigenschaft:'temperatur',hoechstens:30},mitT(31)).ok,'„höchstens“ als feste Zahl funktioniert ebenso');
 // Operation: Entry mit Grenze, Texte
 const op={label:'Hefe lösen',voraussetzung:[{...hy,strenge:'hart',id:'x'}]};
 let ck=checkOperation(op,mitT(50),data.operations);
 ok(!ck.ok && ck.fehlend[0].hoechstens===42 && ck.fehlend[0].ist==='50 °C','checkOperation: harter Verstoß trägt die Grenze und den Ist-Wert');
 ck=checkOperation(op,mitT({min:40,max:50}),data.operations);
 ok(ck.ok && ck.empfehlungen[0].unsicher===true && ck.empfehlungen[0].hoechstens===42 && ck.empfehlungen[0].temperatur.max===50,'checkOperation: Zweifel wird Hinweis mit Grenze und Temperatur');
 const ops=['hefe_ansetzen','vorteig_ansetzen'].map(k=>data.operations[k].voraussetzung);
 ok(ops.every(v=>v.length===1 && v[0].id==='hefe_fluessigkeit_zu_heiss' && v[0].strenge==='hart' && v[0].hoechstens.von.feld==='kultur_max_c') && /42 °C/.test(data.operations.hefe_ansetzen.risiko),'Daten: „Hefe ansetzen“ und „Vorteig ansetzen“ tragen dieselbe harte Regel hefe_fluessigkeit_zu_heiss; das Risiko nennt 42 °C');
 ok(alleUeberschreibbarenRegeln(data).filter(k=>k.id==='hefe_fluessigkeit_zu_heiss').length===1 && /nicht heißer, als die Kultur in „Trieb“ verträgt/.test(alleUeberschreibbarenRegeln(data).find(k=>k.id==='hefe_fluessigkeit_zu_heiss').text),'Regel-Katalog führt die Regel einmal (überschreibbar), die Anforderung als Text');
 // Ende-zu-Ende: Weißbrot (direkte Führung)
 const ah=data.archetypes.hefeteig, vw=ah.varianten.weissbrot, bw={}; for (const r of ah.rollen) bw[r.rolle]=E(vw.bestof[r.rolle]!==undefined?vw.bestof[r.rolle]:r.default);
 const rh=ah.rollen.map(q=>q.rolle), ksh=Object.fromEntries(Object.entries(ah.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(q=>normalizeRecipe(q,data.ingredients,{rollen:rh})),rh)]));
 const ev=(zt,methode='hefe_direkt')=>compute({archetyp:'hefeteig',gefaess:vw.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:bw,zutatTemperaturen:zt},data,ksh);
 ok(ev().status!=='invalid' && !ev().warnungen.some(w=>/nicht sicher gegeben/.test(w)) && ev({fluessigkeit:'lauwarm'}).status!=='invalid','Weißbrot ohne Angabe oder mit lauwarmer Flüssigkeit: gültig, ohne Hinweis');
 ok(ev({fluessigkeit:50}).status==='invalid' && ev({fluessigkeit:50}).gruende.some(g=>/Temperatur höchstens 42 °C für Flüssigkeit \(ist: 50 °C\)/.test(g) && /Hefe wird in 30–35 °C/.test(g)) && ev({fluessigkeit:50}).blockaden.some(b=>b.id==='hefe_fluessigkeit_zu_heiss'),'Flüssigkeit 50 °C: Hefeteig ungültig, Grund nennt Grenze, Ist und die Wirkung der Operation; als Regel überschreibbar');
 ok(ev({fluessigkeit:{min:40,max:50}}).status!=='invalid' && ev({fluessigkeit:{min:40,max:50}}).warnungen.some(w=>/Temperatur höchstens 42 °C für Flüssigkeit nicht sicher gegeben — Temperatur 40–50 °C/.test(w)),'Flüssigkeit 40–50 °C: im Zweifel Warnung, Rezept bleibt gültig');
 ok(ev({fluessigkeit:50},'hefe_kalt').status==='invalid' && ev({fluessigkeit:50},'hefe_vorteig').status==='invalid','auch Kalte Führung und Vorteig lösen die Hefe in der Flüssigkeit: dieselbe Regel');
 ok(ev({fluessigkeit:50},'hefe_noknead').status!=='invalid','ohne Hefe-Ansetzen (ohne Kneten: Hefe wird direkt untergemischt) gilt die Regel nicht');
}

// --- Daten ---------------------------------------------------------------------------------------------------------------------------
const formen=Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && v?.form);
ok(formen.map(([k])=>k).sort().join()==='hefe_frisch,orangenabrieb,zitronenabrieb' && formen.every(([,v])=>FORM_SKALA.includes(v.form)),'Zutaten mit eigener Form: Frischhefe, Zitronen- und Orangenabrieb — alle auf der Skala');
ok(!JSON.stringify(data.operations.schmelzen.wirkt_auf_eigenschaften).includes('"aggregat"') && data.operations.schmelzen.wirkt_auf_eigenschaften.fett.temperatur.faktor===1.05,'Schmelzen setzt die Temperatur, nicht mehr das Aggregat von Hand (eine Quelle der Wahrheit)');
ok(Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && typeof v?.schmelzpunkt_c==='number').every(([,v])=>v.aggregat==='fest' && v.schmelzpunkt_c>std.max),'jede Zutat mit Schmelzpunkt ist im Standard-Bereich fest (Schmelzpunkt über 27 °C, deklariertes Aggregat „fest“ passt zur Ableitung)');
ok(Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && typeof v?.schmelzpunkt_c==='number').every(([,v])=>aggregatAus(std,v)===v.aggregat),'Ableitung und deklariertes Aggregat stimmen für alle Zutaten mit Schmelzpunkt überein');

// T120 (DR-076): Butter schmilzt in Wirklichkeit über 32 bis 36 °C, das Modell nimmt einen Punkt (34 °C). Das ist nur dann gleichwertig,
// wenn kein Daten-Bereich knapp unter 34 °C liegt; diese Prüfung hält fest, welche Bereiche heute in das Fenster 32 bis 36 °C fallen.
{
  const T=J('temperaturen'), ops=J('operations'), butterK={fett:{schmelzpunkt_c:34,aufschlag_temp:'plastisch'}};
  const alle=new Map();
  for (const [k,v] of Object.entries(T)) if(!k.startsWith('_') && typeof v==='object') alle.set('benannt:'+k,{min:v.min,max:v.max});
  for (const [k,o] of Object.entries(ops)) if(!k.startsWith('_')) {
    if (o.temperatur!=null) { const b=temperaturBereich(o.temperatur,T,butterK); if(b) alle.set('operation:'+k,b); }
    const w=o.wirkt_auf_eigenschaften?.fett?.temperatur; if (w!=null) { const b=temperaturBereich(w,T,butterK); if(b) alle.set('wirkt:'+k,b); }
  }
  const imFenster=[...alle].filter(([,b])=>b.max>=32 && b.min<36).map(([k])=>k).sort();
  ok(imFenster.join()==='benannt:lauwarm,operation:hefe_ansetzen,operation:schmelzen,wirkt:schmelzen','T120: nur „lauwarm“, das Hefe-Lösen und das Schmelzen berühren das Fenster 32–36 °C; ein neuer Bereich dort ist ein Anlass, den Schmelzpunkt-Punkt zu überdenken (DR-076)');
  ok(aggregatAus({min:30,max:35},ing.butter)==='unbestimmt' && aggregatAus({min:35.7,max:35.7},ing.butter)==='fluessig' && aggregatAus({min:24,max:26},ing.butter)==='fest','T120: lauwarm (30–35 °C) ist bei Butter unbestimmt, das Schmelzziel 35,7 °C flüssig, Raumwärme fest');
}

console.log(fail?fail+' FAIL':'ALL PASS');
