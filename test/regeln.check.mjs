// T07: Regel-Fälle aus rules.js mit kleinen synthetischen Daten (unabhängig vom echten Korpus):
// Bedingungen, Strenge-Stufen, Guard `wenn`, `!rolle`, eingefügte Vorbereitung, Operations-Kaskade (T26),
// Pins (T24/T31), Blockaden mit id (T25), Methoden-Wahl.
const P=new URL('../src/', import.meta.url).href;
const { blendProps, propsOf, pruefeBedingung, checkOperation, resolveMethod, evaluateAll, bestMethod, rolleIstGesperrt, alleUeberschreibbarenRegeln } = await import(P+'model/rules.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

const ingredients={
  butter:{label:'Butter',aggregat:'fest',cremig_schlagbar:true,saeure:false},
  oel:{label:'Öl',aggregat:'fluessig',cremig_schlagbar:false,saeure:false},
  milch:{label:'Milch',aggregat:'fluessig',saeure:false},
  buttermilch:{label:'Buttermilch',aggregat:'fluessig',saeure:true},
  joghurt:{label:'Joghurt',aggregat:'fluessig',saeure:true},
  backpulver:{label:'Backpulver',trieb_typ:'chemisch_doppelt',saeure:false},
  natron:{label:'Natron',trieb_typ:'chemisch_basisch',saeure:false},
  mehl:{label:'Mehl',bildet_gluten:true,saeure:false},
  rosinen:{label:'Rosinen',quellfaehig:true,saeure:false},
};
const NATRON={ wenn:{rolle:'trieb',eigenschaft:'trieb_typ',wert:'chemisch_basisch'}, rolle:'!trieb', eigenschaft:'saeure', wert:true, strenge:'hart', hinweis:'eine saure Zutat', kaskade_ziel:'fluessigkeit', id:'natron_braucht_saeure' };
const operations={
  schmelzen:{label:'Schmelzen',typ:'vorbereitung',verb:'erhitzen',auf:['fett'],voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fest',strenge:'hart',id:'fett_fest'}],wirkt_auf_eigenschaften:{fett:{aggregat:'fluessig',cremig_schlagbar:false}},wirkung:'Fett wird flüssig.'},
  quirlen:{label:'Quirlen',typ:'mischen',verb:'mischen',auf:['fett','fluessigkeit'],voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fluessig',strenge:'hart',id:'fett_fluessig'}],vorbereitung_falls_nicht:'schmelzen',wirkung:'Emulsion.'},
  aufschlagen:{label:'Aufschlagen',typ:'mischen',verb:'mischen',auf:['fett'],voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fest',strenge:'hart',id:'a1'},{rolle:'fett',eigenschaft:'cremig_schlagbar',wert:true,strenge:'hart',id:'a2'}],wirkung:'Luft ins Fett.'},
  empf:{label:'Empfehlung',typ:'mischen',verb:'mischen',auf:[],voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fest',strenge:'empfohlen'}],wirkung:'x'},
  frei:{label:'Frei',typ:'mischen',verb:'mischen',auf:[],voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fest',strenge:'frei'}],wirkung:'x'},
  einlegen:{label:'Einlegen',typ:'warten',verb:'mischen',auf:['einlage'],voraussetzung:[],wirkung:'quellen',dauer_min:30},
  backen:{label:'Backen',typ:'erhitzen',verb:'erhitzen',auf:[],voraussetzung:[NATRON],wirkung:'Backen.'},
};
const methods={
  m_prep:{label:'Mit Quirlen',sequenz:['quirlen','backen'],geeignet_fuer:['kasten'],warum:'x'},
  m_creme:{label:'Creme',sequenz:['aufschlagen','backen'],geeignet_fuer:['kasten'],warum:'Creme braucht festes Fett.'},
  m_frei:{label:'Ohne Fett',sequenz:['backen'],geeignet_fuer:['muffin'],warum:'Nur Backen.'},
  m_opt:{label:'Mit Einlage',sequenz:['einlegen','backen'],optional:['einlegen'],nach:{einlegen:[]},geeignet_fuer:['kasten'],warum:'x'},
  m_graph:{label:'Graph',sequenz:['aufschlagen','quirlen','backen'],nach:{aufschlagen:[],quirlen:[]},geeignet_fuer:['kasten'],warum:'x'},
};
const arch={rollen:[
  {rolle:'fett',label:'Fett',optionen:['butter','oel']},
  {rolle:'fluessigkeit',label:'Flüssigkeit',optionen:['milch','buttermilch','joghurt']},
  {rolle:'trieb',label:'Trieb',optionen:['backpulver','natron']},
  {rolle:'struktur',label:'Struktur',optionen:['mehl']},
  {rolle:'einlage',label:'Einlage',optionen:['rosinen']},
],methoden:['m_prep','m_creme','m_frei','m_opt','m_graph']};
const vessels={kasten_1:{label:'Kastenform',familie:'kasten'},muffin_1:{label:'Muffinform',familie:'muffin'}};
const data={ingredients,operations,methods,vessels,archetypes:{x:arch},arch};
const E=(...z)=>z.map((k)=>({zutat:k,anteil:1}));
const Z=(over={})=>({fett:E('butter'),fluessigkeit:E('milch'),trieb:E('backpulver'),struktur:E('mehl'),...over});

// --- Bedingungen -----------------------------------------------------------------------------
const p=propsOf(Z(),ingredients);
ok(pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fest'},p).ok,'Bedingung erfüllt: Butter ist fest');
ok(!pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},p).ok && pruefeBedingung({rolle:'fett',eigenschaft:'aggregat',wert:'fluessig'},p).ist==='fest','Bedingung verletzt: ist = fest');
ok(pruefeBedingung({rolle:'einlage',eigenschaft:'quellfaehig',wert:true},p).ist==='nicht belegt','unbelegte Rolle: „nicht belegt“');
ok(pruefeBedingung({rolle:'fett',eigenschaft:'unbekannt',wert:1},p).ist==='unbekannt','unbekannte Eigenschaft: „unbekannt“');
const pS=propsOf(Z({fluessigkeit:E('buttermilch')}),ingredients);
ok(pruefeBedingung({rolle:'!trieb',eigenschaft:'saeure',wert:true},pS).ok && !pruefeBedingung({rolle:'!trieb',eigenschaft:'saeure',wert:true},p).ok,'„!rolle“: Säure irgendwo außer beim Trieb');
ok(!pruefeBedingung({rolle:'!fluessigkeit',eigenschaft:'saeure',wert:true},pS).ok,'„!rolle“ schließt die genannte Rolle aus');

// --- Zutaten-Mischung (blendProps) -------------------------------------------------------------
const mix=blendProps([{zutat:'butter',anteil:3},{zutat:'oel',anteil:1}],ingredients);
ok(mix.key==='butter' && mix.aggregat==='fest' && mix.gemischt && mix.anteile.length===2 && /75 %/.test(mix.label),'Mischung: dominante Zutat bestimmt Aggregat, Label mit Anteilen');
ok(blendProps([{zutat:'milch'},{zutat:'buttermilch'}],ingredients).saeure===true,'Mischung: Säure wird ODER-verknüpft');
ok(blendProps([{zutat:'backpulver'},{zutat:'natron'}],ingredients).trieb_typ==='chemisch_basisch','Mischung: Natron dominiert den Trieb-Typ');
ok(blendProps([],ingredients)===null && blendProps([{zutat:'gibtsnicht'}],ingredients)===null,'leere/unbekannte Zutaten → null');

// --- Strenge-Stufen -----------------------------------------------------------------------------
const mitOel=propsOf(Z({fett:E('oel')}),ingredients);
let r=checkOperation(operations.aufschlagen,mitOel,operations);
ok(!r.ok && r.fehlend.length===2 && r.fehlend.every((f)=>f.strenge==='hart'),'hart: Öl kann nicht aufgeschlagen werden (2 Voraussetzungen)');
r=checkOperation(operations.empf,mitOel,operations);
ok(r.ok && r.fehlend.length===0 && r.empfehlungen.length===1,'empfohlen: bleibt gültig, nur Empfehlung');
r=checkOperation(operations.frei,mitOel,operations);
ok(r.ok && r.empfehlungen.length===0 && r.fehlend.length===0,'frei: weder Blockade noch Hinweis');
r=checkOperation(operations.aufschlagen,p,operations);
ok(r.ok && r.fehlend.length===0 && r.vorbereitung===null,'erfüllt: ok ohne Vorbereitung');

// --- Guard `wenn` --------------------------------------------------------------------------------
ok(checkOperation(operations.backen,p,operations).ok,'Guard: ohne Natron gilt die Säure-Regel nicht');
const nat=propsOf(Z({trieb:E('natron')}),ingredients);
r=checkOperation(operations.backen,nat,operations);
ok(!r.ok && r.fehlend[0].id==='natron_braucht_saeure','Guard: Natron ohne Säure → blockiert');
ok(checkOperation(operations.backen,propsOf(Z({trieb:E('natron'),fluessigkeit:E('buttermilch')}),ingredients),operations).ok,'Guard: Natron mit Buttermilch → gültig');
ok(checkOperation(operations.backen,propsOf(Z({trieb:E('natron'),fluessigkeit:E('milch','joghurt')}),ingredients),operations).ok,'Guard: Mischung Milch + Joghurt reicht als Säure');

// --- Vorbereitung einfügen ---------------------------------------------------------------------
r=checkOperation(operations.quirlen,p,operations);
ok(r.ok && r.vorbereitung==='schmelzen' && r.fehlend.length===1,'Vorbereitung: Butter → „schmelzen“ stellt flüssiges Fett her');
r=checkOperation(operations.quirlen,propsOf(Z({fett:E('oel')}),ingredients),operations);
ok(r.ok && r.vorbereitung===null,'Vorbereitung entfällt, wenn die Voraussetzung schon erfüllt ist (Öl)');
const e1=resolveMethod('m_prep',Z(),'kasten_1',data);
ok(e1.status==='prep' && e1.schritte.map((s)=>s.key).join()==='schmelzen,quirlen,backen' && e1.schritte[0].eingefuegt && e1.schritte[0].nach.length===0,'resolveMethod: „schmelzen“ wird eingefügt, status „prep“, Startschritt');
ok(e1.schritte[1].nach.join()==='schmelzen' && e1.warnungen.some((w)=>/Zusätzlich notwendiger Schritt „Schmelzen“/.test(w)),'resolveMethod: Quirlen folgt dem eingefügten Schritt, Hinweistext');
const e2=resolveMethod('m_prep',Z({fett:E('oel')}),'kasten_1',data);
ok(e2.status==='ok' && e2.schritte.length===2,'resolveMethod: Öl → status „ok“, nichts eingefügt');

// --- Blockade, Gründe, Overrides (T25) ---------------------------------------------------------------
const e3=resolveMethod('m_creme',Z({fett:E('oel')}),'kasten_1',data);
ok(e3.status==='invalid' && e3.gruende.length===1 && /„Aufschlagen“ ist nicht möglich/.test(e3.gruende[0]),'resolveMethod: Öl + Creme → invalid mit Grund');
ok(e3.blockaden.map((b)=>b.id).join()==='a1,a2','Blockaden tragen die Regel-ids (überschreibbar, T25)');
ok(resolveMethod('m_creme',Z(),'kasten_1',data).status==='ok','Butter + Creme → ok');
const keineId={...operations,aufschlagen:{...operations.aufschlagen,voraussetzung:[{rolle:'fett',eigenschaft:'aggregat',wert:'fest',strenge:'hart'}]}};
ok(resolveMethod('m_creme',Z({fett:E('oel')}),'kasten_1',{...data,operations:keineId}).blockaden.length===0,'Bedingung ohne id kann nicht überschrieben werden');

// --- Operations-Kaskade (T26) und Pins (T24/T31) -------------------------------------------------------
const nz=Z({trieb:E('natron')});
const e4=resolveMethod('m_frei',nz,'muffin_1',data);
ok(e4.status==='invalid' && e4.kaskaden.length===1 && e4.kaskaden[0].rolle==='fluessigkeit' && e4.kaskaden[0].zutat==='buttermilch','Kaskade: erster saurer Kandidat der Zielrolle (Buttermilch vor Joghurt)');
ok(e4.kaskaden[0].ausloeser==='Backen' && e4.kaskaden[0].zutatLabel==='Buttermilch','Kaskade nennt Auslöser und Zutat');
const mitFix=resolveMethod('m_frei',nz,'muffin_1',data,{rollen:{fluessigkeit:true},zutaten:{}});
ok(mitFix.status==='invalid' && mitFix.kaskaden.length===0,'Pin auf die Zielrolle: keine Kaskade, Blockade bleibt');
ok(!/fixiert/.test(mitFix.gruende[0]),'Pin auf die Zielrolle (nicht die Ursache) taucht im Grund nicht auf');
ok(rolleIstGesperrt({rollen:{fluessigkeit:true}},'fluessigkeit') && rolleIstGesperrt({zutaten:{fluessigkeit:{milch:true}}},'fluessigkeit') && !rolleIstGesperrt({zutaten:{fluessigkeit:{milch:false}}},'fluessigkeit') && !rolleIstGesperrt({},'fluessigkeit'),'rolleIstGesperrt: Rolle, einzelne Zutat (T31), nichts');
const pinZutat=resolveMethod('m_frei',Z({trieb:E('natron'),fluessigkeit:E('milch','joghurt')}),'muffin_1',data);
ok(pinZutat.status==='ok','Joghurt in der Mischung erfüllt die Säure-Regel (kein Pin nötig)');
const pinNatron=resolveMethod('m_frei',nz,'muffin_1',data,{rollen:{},zutaten:{trieb:{natron:true}}});
ok(pinNatron.kaskaden.length===1 && /Natron/.test(pinNatron.gruende[0]) && /bewusst fixiert/.test(pinNatron.gruende[0]),'fixiertes Natron: Grund nennt die Ursache, Kaskade zielt auf die freie Flüssigkeit');
ok(resolveMethod('m_frei',nz,'muffin_1',data,{rollen:{fluessigkeit:true},zutaten:{}}).gruende[0].includes('Natron')===false,'Pin auf Flüssigkeit macht Natron nicht zur Ursache');
const nurKaskade={...operations,backen:{...operations.backen,voraussetzung:[{...NATRON,kaskade_ziel:undefined}]}};
ok(resolveMethod('m_frei',nz,'muffin_1',{...data,operations:nurKaskade}).kaskaden.length===0,'ohne `kaskade_ziel` kein Vorschlag');

// --- Optionale Schritte, Graph, Gefäß -----------------------------------------------------------------
ok(resolveMethod('m_opt',Z(),'kasten_1',data).schritte.map((s)=>s.key).join()==='backen','optionaler Schritt „einlegen“ entfällt ohne Einlage');
ok(resolveMethod('m_opt',Z({einlage:E('rosinen')}),'kasten_1',data).schritte.map((s)=>s.key).join()==='einlegen,backen','optionaler Schritt „einlegen“ mit quellfähiger Einlage');
const g=resolveMethod('m_graph',Z(),'kasten_1',data).schritte;
const nachVon=(k)=>g.find((s)=>s.key===k).nach.join();
ok(nachVon('aufschlagen')==='' && nachVon('schmelzen')==='' && nachVon('quirlen')==='schmelzen','Graph: explizite Startschritte, eingefügte Vorbereitung ist Startschritt, Quirlen folgt ihr');
ok(nachVon('backen')==='','Graph (dokumentiertes Verhalten, methods.json `nach`): ohne eigenes `nach` hängt ein Schritt nur am letzten Nicht-Startschritt — sind alle Vorgänger Startschritte, ist er selbst frei');
const lin=resolveMethod('m_graph',Z(),'kasten_1',{...data,methods:{...methods,m_graph:{...methods.m_graph,nach:{aufschlagen:[],quirlen:[],backen:['aufschlagen','quirlen']}}}}).schritte;
ok(lin.find((s)=>s.key==='backen').nach.join()==='aufschlagen,quirlen','Graph: explizites `nach` mit mehreren Vorgängern');
ok(resolveMethod('m_creme',Z(),'muffin_1',data).warnungen.some((w)=>/untypisch/.test(w) && /Creme braucht festes Fett/.test(w)),'Methode für Gefäß-Familie untypisch → Warnung mit „warum“');
ok(!resolveMethod('m_creme',Z(),'kasten_1',data).warnungen.some((w)=>/untypisch/.test(w)),'passende Gefäß-Familie → keine Warnung');
ok(resolveMethod('m_creme',Z({fett:E('butter','oel')}),'kasten_1',data).warnungen.some((w)=>/Gemischtes Fett/.test(w)),'Gemischtes Fett (fest + flüssig) → Warnung');

// --- Methoden-Wahl ---------------------------------------------------------------------------------------
let ev=evaluateAll(Z(),'kasten_1',data);
ok(Object.keys(ev).join()===arch.methoden.join(),'evaluateAll bewertet alle Methoden des Archetyps');
ok(ev.m_prep.status==='prep' && ev.m_graph.status==='prep' && ev.m_creme.status==='ok' && ev.m_opt.status==='ok','Status der Methoden: prep (Vorbereitung nötig) vs. ok');
ok(bestMethod(ev,{},'kasten_1',data)==='m_creme','bestMethod: unter gleichwertigen „ok“ + passendem Gefäß gewinnt die erste');
ok(bestMethod(ev,{m_opt:9},'kasten_1',data)==='m_opt','Korpus-Häufigkeit entscheidet unter gleichwertigen Methoden');
ok(bestMethod(ev,{m_graph:99},'kasten_1',data)==='m_creme','„prep“ rangiert hinter „ok“, auch mit hoher Häufigkeit');
ev=evaluateAll(Z({fett:E('oel')}),'kasten_1',data);
ok(ev.m_creme.status==='invalid' && bestMethod(ev,{m_creme:99},'kasten_1',data)!=='m_creme','ungültige Methode gewinnt nie, auch nicht mit hoher Häufigkeit');
ev=evaluateAll(Z(),'muffin_1',data);
ok(bestMethod(ev,{},'muffin_1',data)==='m_frei','Gefäß-Eignung zählt: Muffinform → Methode für Muffins');

// --- Katalog ---------------------------------------------------------------------------------------------------
const kat=alleUeberschreibbarenRegeln({operations,methods,grenzen:{archetypen:{x:[{id:'g_hart',groesse:'wasser',bezug:{rolle:'struktur'},max:5,strenge:'hart',hinweis:'x'},{id:'g_weich',groesse:'wasser',bezug:{rolle:'struktur'},max:5,strenge:'empfohlen',hinweis:'x'}]}},archetypes:{x:arch}});
ok(['fett_fest','fett_fluessig','a1','a2','natron_braucht_saeure','g_hart'].every((id)=>kat.some((k)=>k.id===id)) && !kat.some((k)=>k.id==='g_weich'),'Katalog: alle hart-Bedingungen mit id, keine empfohlen-Grenze');
ok(kat.filter((k)=>k.id==='natron_braucht_saeure').length===1,'Katalog zählt dieselbe id nur einmal');

console.log(fail?fail+' FAIL':'ALL PASS');
