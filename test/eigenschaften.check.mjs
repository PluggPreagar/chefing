// T62 (DR-032): Zustands-Eigenschaften aus der Temperatur — Aggregat und Form der Zutat, geordnete Skala, Garantie-Regel, Vorbereitung.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { aggregatAus, formVon, erfuellt, standardBereich, FORM_SKALA, FORM_LABEL } = await import(P+'model/eigenschaften.js');
const { temperaturBereich } = await import(P+'model/temperatur.js');
const { propsOf, blendProps, pruefeBedingung, checkOperation, nachVorbereitung, resolveMethod } = await import(P+'model/rules.js');
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
ok(formVon(ing.butter,'fest')==='block' && formVon(ing.butter,'fluessig')==='fluessig' && formVon(ing.butter,'unbestimmt')===null,'Butter: fest = Block, flüssig = flüssig, unbestimmt = unbekannt');
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
ok(p.fett.aggregat==='unbestimmt' && p.fett.form===null,'Rezept nennt „lauwarm“ (30–35 °C): unbestimmt — der Schmelzpunkt liegt im Bereich');
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

ok(pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},lau).ist==='unbekannt' && pruefeBedingung({rolle:'fett',eigenschaft:'form',mindestens:'kleinteilig'},lau).ok===false,'Form unbestimmt (null): „unbekannt“, nicht erfüllt');

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
ok(res.status==='prep' && res.schritte.some(s=>s.key==='schmelzen' && s.eingefuegt) && res.warnungen.some(w=>/Zusätzlich notwendiger Schritt „Schmelzen“/.test(w) && /flüssiges Fett \(ist: fest\)/.test(w)),'Muffin mit Butter: Schmelzen wird eingefügt, Begründung nennt „flüssiges Fett (ist: fest)“');
res=resolveMethod('muffin',{...basis,fett:E('pflanzenoel')},v0.gefaess,data);
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen'),'Muffin mit Öl: kein Schmelzen nötig');
res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,data,{rollen:{},zutaten:{}},{fett:50});
ok(res.status==='ok' && !res.schritte.some(s=>s.key==='schmelzen'),'Rezept nennt „Butter 50 °C“ (schon flüssig): kein Schmelzen eingefügt');
res=resolveMethod('muffin',{...basis,fett:E('butter')},v0.gefaess,data,{rollen:{},zutaten:{}},{fett:'lauwarm'});
ok(res.status==='invalid' && res.gruende.some(g=>/ist: unbestimmt/.test(g)),'Butter „lauwarm“: weder fest (zum Schmelzen) noch flüssig — ungültig mit Hinweis „unbestimmt“ (bekannte Randstelle, DR-032)');
const ks={}; for (const [k,x] of Object.entries(data.archetypes.ruehrteig.varianten)) ks[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr);
const c=compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')},zutatTemperaturen:{fett:50}},data,ks);
ok(c.status!=='prep' && !c.regelIds.some(i=>/^prep:schmelzen/.test(i)),'Engine reicht die Zutaten-Temperatur durch (state.zutatTemperaturen)');
const c0=compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')}},data,ks);
ok(c0.status==='prep' && c0.regelIds.includes('prep:schmelzen'),'ohne Angabe wie bisher: Butter wird für Muffins geschmolzen');
{const regel={regeln:[{id:'t',rolle:'fett',wenn:{rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},faktor:0.5,begruendung:'Regel greift bei {fett}.',quelle:'t'}]};
 const zt=(extra)=>compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:'muffin',fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,fett:E('butter')},...extra},{...data,erfahrungsregeln:regel},ks);
 ok(zt({zutatTemperaturen:{fett:50}}).anpassungen.some(a=>/Regel greift/.test(a)) && !zt({}).anpassungen.some(a=>/Regel greift/.test(a)),'die Erfahrungsregeln der Engine sehen den Zustand „Butter 50 °C = flüssig“ (und bei fester Butter nicht)');}

// --- Daten ---------------------------------------------------------------------------------------------------------------------------
const formen=Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && v?.form);
ok(formen.map(([k])=>k).sort().join()==='hefe_frisch,orangenabrieb,zitronenabrieb' && formen.every(([,v])=>FORM_SKALA.includes(v.form)),'Zutaten mit eigener Form: Frischhefe, Zitronen- und Orangenabrieb — alle auf der Skala');
ok(!JSON.stringify(data.operations.schmelzen.wirkt_auf_eigenschaften).includes('"aggregat"') && data.operations.schmelzen.wirkt_auf_eigenschaften.fett.temperatur.faktor===1.05,'Schmelzen setzt die Temperatur, nicht mehr das Aggregat von Hand (eine Quelle der Wahrheit)');
ok(Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && typeof v?.schmelzpunkt_c==='number').every(([,v])=>v.aggregat==='fest' && v.schmelzpunkt_c>std.max),'jede Zutat mit Schmelzpunkt ist im Standard-Bereich fest (Schmelzpunkt über 27 °C, deklariertes Aggregat „fest“ passt zur Ableitung)');
ok(Object.entries(ing).filter(([k,v])=>!k.startsWith('_') && typeof v?.schmelzpunkt_c==='number').every(([,v])=>aggregatAus(std,v)===v.aggregat),'Ableitung und deklariertes Aggregat stimmen für alle Zutaten mit Schmelzpunkt überein');

console.log(fail?fail+' FAIL':'ALL PASS');
