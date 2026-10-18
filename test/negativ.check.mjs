// T55: Negativ-Korpus gegen die Regeln — Umrechnung, Erkennung, Quoten (synthetisch), dann die echten Fälle und das Werkzeug.
import fs from 'fs';
import { execFileSync } from 'child_process';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { negativNormalisieren, negativPruefen, TASSE_G, ABBILDUNG } = await import(P+'model/negativ.js');
const { temperaturBereich } = await import(P+'model/temperatur.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;

// --- Umrechnung ---------------------------------------------------------------------------------------------------------
const ing=J('ingredients');
const z=(rolle,zutat,menge,einheit)=>({rolle,zutat,menge,einheit});
let r=negativNormalisieren({zutaten:[z('struktur','weizenmehl',2,'cup'),z('fluessigkeit','wasser',1.5,'cup'),z('salz','salz',1,'tsp'),z('fett','butter',2,'tbsp'),z('trieb','hefe_trocken',7,'g')]},ing);
const g=(k)=>r.zutaten.find(x=>x.zutat===k);
ok(g('weizenmehl').menge===2*TASSE_G.weizenmehl && g('weizenmehl').einheit==='g' && g('wasser').menge===1.5*TASSE_G.wasser,'Tassen werden mit der Tabelle in Gramm umgerechnet (Mehl 120 g, Wasser 240 g je Tasse)');
ok(g('salz').einheit==='tl' && g('salz').menge===1 && g('butter').einheit==='el' && g('butter').menge===2 && g('hefe_trocken').einheit==='g','tsp → tl, tbsp → el (die Umrechnung in Gramm macht ingredients.json), Gramm bleiben');
r=negativNormalisieren({zutaten:[z('struktur','weizenmehl',null,'cup'),z('fett','schmalz',2,'cup'),z('suesse','honig',1,'tbsp'),z('bindung','eigelb',3,'stk'),z('trieb','hefe_unbekannt',1,'tsp'),z('fluessigkeit','sojamilch',100,'ml'),z('fett','unbekannt',3,'tbsp')]},ing);
ok(r.unbekannt.length===1 && /weizenmehl \(Menge fehlt\)/.test(r.unbekannt[0]),'fehlende Menge: nicht gerechnet und benannt');
const geg=(k)=>r.zutaten.find(x=>x.zutat===k);
ok(geg('pflanzenoel')?.menge===2*TASSE_G.pflanzenoel && geg('zucker')?.einheit==='el' && near(geg('ei').menge,3*18/55) && geg('ei').einheit==='stk' && geg('hefe_trocken') && geg('milch').menge===100 && geg('butter'),'Abbildungen: Schmalz → Öl, Honig → Zucker, Eigelb = 18/55 Ei, Instanthefe → Trockenhefe, Pflanzendrink → Milch, nicht genanntes Fett → Butter');
ok(ABBILDUNG.eigelb[1]===18/55 && Object.keys(ABBILDUNG).length===7,'Abbildungstabelle ist die vereinbarte (7 Einträge)');
r=negativNormalisieren({zutaten:[z('einlage','karotten',2,'cup'),z('aroma','ingwer',1,'tsp'),z('struktur','dinkelmehl',100,'g'),z('struktur','weizenmehl',1,'tasse_x')]},ing);
ok(r.ignoriert.join()==='karotten,ingwer' && r.unbekannt.length===2 && /dinkelmehl \(nicht in ingredients/.test(r.unbekannt[0]) && /weizenmehl \(Einheit tasse_x nicht umrechenbar\)/.test(r.unbekannt[1]) && r.zutaten.length===0,'unbekannte Einlage/Aroma stören nicht (ignoriert), andere unbekannte Zutaten und nicht umrechenbare Einheiten werden benannt statt still ausgelassen');
ok(negativNormalisieren({zutaten:[z('struktur','weizenmehl',1,'cup')]},ing).zutaten[0].menge===120 && negativNormalisieren({},ing).zutaten.length===0,'Tasse Mehl = 120 g; Fall ohne Zutaten bleibt leer');
ok(negativNormalisieren({zutaten:[z('fett','pflanzenoel',1,'cup'),z('fett','natron',1,'cup')]},ing).unbekannt.join()==='natron (Tasse nicht umrechenbar)','Tasse einer Zutat ohne Tassen-Gewicht (Natron): benannt, nicht geschätzt');

// --- Erkennung und Quoten (synthetische Welt) --------------------------------------------------------------------------------
const ingS={ mehl:{label:'Mehl',wasseranteil:0.14}, wasser:{label:'Wasser',wasseranteil:1}, zucker:{label:'Zucker',zuckeranteil:1}, hefe_frisch:{label:'Hefe',wasseranteil:0,funktionen:{hefe:1}} };
const archS={ x:{ rollen:[{rolle:'struktur',referenz:true},{rolle:'fluessigkeit'},{rolle:'suesse'},{rolle:'trieb'}], varianten:{v:{korpus:'k'},w:{korpus:'k2'}} } };
const rez=(id,wasser,zucker,hefe)=>({id,zutaten:[z('struktur','mehl',100,'g'),z('fluessigkeit','wasser',wasser,'g'),z('suesse','zucker',zucker,'g'),z('trieb','hefe_frisch',hefe,'g')]});
const korpusV=[rez('a',70,5,4),rez('b',72,6,4),rez('c',68,5,4.5),rez('d',70,4,4)];
const korpusW=[rez('e',60,30,4),rez('f',62,32,4),rez('g',58,28,4.2),rez('h',60,30,4)];
const grenzenS={archetypen:{x:[{id:'zucker_max',groesse:'zucker',bezug:{rolle:'struktur'},max:50,strenge:'empfohlen',hinweis:'Zucker {wert} % (Grenze {grenze})',quelle:'t'}]}};
const modelleS={gaerung:{ln_konstante:6,exponent:-1,temp_koeffizient:0.1,temp_ref:20,temp_standard:28,warn_faktor:3.5}};
const temps={warm:{label:'warm',min:26,max:30}};
const fall=(id,zutaten,over={})=>({id,archetyp:'x',variante:'v',ergebnis:'misslungen',verlaesslichkeit:2,mengen_vorhanden:true,ursache_art:'menge',zutaten,...over});
const lauf=(faelle,over={})=>negativPruefen({faelle,archetypes:archS,ingredients:ingS,grenzen:grenzenS,modelle:'modelle' in over?over.modelle:modelleS,korpora:{x:{v:korpusV,w:korpusW}},temperaturen:temps});
const normal=[z('struktur','mehl',100,'g'),z('fluessigkeit','wasser',70,'g'),z('suesse','zucker',5,'g'),z('trieb','hefe_frisch',4,'g')];
const zuckerig=[z('struktur','mehl',100,'g'),z('fluessigkeit','wasser',70,'g'),z('suesse','zucker',60,'g'),z('trieb','hefe_frisch',4,'g')];
let b=lauf([fall('normal',normal),fall('zuckrig',zuckerig)]);
const zl=Object.fromEntries(b.faelle.map(x=>[x.id,x]));
ok(!zl.normal.erkannt && zl.normal.grenzen.length===0 && zl.normal.toleranz.length===0,'Mengen im Korpus-Normalbereich: keine Warnung (Falsch-Negativ bei einem Misserfolg)');
ok(zl.zuckrig.erkannt && zl.zuckrig.grenzen.map(x=>x.id).join()==='zucker_max' && zl.zuckrig.grenzen[0].strenge==='empfohlen' && near(zl.zuckrig.grenzen[0].wert,60),'60 % Zucker: Grenze zucker_max schlägt an (empfohlen, Wert 60)');
ok(b.zusammenfassung.erkannt===1 && b.zusammenfassung.misserfolge===2 && b.zusammenfassung.falschNegativ.join()==='normal' && b.zusammenfassung.mengeUrsache.geprueft===2 && b.zusammenfassung.mengeUrsache.erkannt===1,'Zusammenfassung: 1 von 2 erkannt, Falsch-Negativ benannt, Quote der Mengenursachen 1 von 2');
{const bu=lauf([fall('treffer',zuckerig,{ursache_regeln:['grenze:zucker_max']}),fall('anders',zuckerig,{ursache_regeln:['gaerung']}),fall('ohne',zuckerig),fall('tol',zuckerig,{ursache_regeln:['toleranz:zucker']})]);
 const u=Object.fromEntries(bu.faelle.map(x=>[x.id,x.ursacheGetroffen]));
 ok(u.treffer===true && u.anders===false && u.ohne===false && bu.faelle.every(x=>x.erkannt) && bu.zusammenfassung.mengeUrsache.erkannt===4 && bu.zusammenfassung.mengeUrsache.ueberUrsache===1+Number(u.tol),'ursache_regeln: „erkannt über die Ursache“ nur, wenn die kuratierte Regel (grenze:<id>, toleranz:<größe>, gaerung) wirklich angeschlagen hat; alle vier sind erkannt, ohne Eintrag zählt nicht');}
// Toleranz: gegen die Variante des Falls; ohne Variante nur außerhalb ALLER Varianten
const suess=[z('struktur','mehl',100,'g'),z('fluessigkeit','wasser',60,'g'),z('suesse','zucker',30,'g'),z('trieb','hefe_frisch',4,'g')];
b=lauf([fall('v-suess',suess,{variante:'v'}),fall('w-suess',suess,{variante:'w'}),fall('ohne-variante',suess,{variante:null})]);
const zt=Object.fromEntries(b.faelle.map(x=>[x.id,x]));
ok(zt['v-suess'].toleranz.some(t=>t.groesse==='zucker') && !zt['w-suess'].toleranz.some(t=>t.groesse==='zucker'),'Korpus-Toleranz: 30 % Zucker ist gegen die Variante v untypisch, gegen die süße Variante w nicht');
ok(zt['v-suess'].erkannt===true && zt['v-suess'].grenzen.length===0 && zt['v-suess'].gaerung===null && zt['w-suess'].erkannt===false,'allein die Korpus-Toleranz genügt als Erkennung (keine Grenze, kein Gärmodell); in der süßen Variante w bleibt derselbe Fall still');
ok(!zt['ohne-variante'].toleranz.some(t=>t.groesse==='zucker') && JSON.stringify(zt['ohne-variante'].referenzVarianten)==='["v","w"]','ohne Variante zählt nur, was außerhalb jeder Variante liegt (konservativ): hier liegt 30 % Zucker in w');
ok(!lauf([fall('x',suess,{variante:'gibtsnicht'})]).faelle[0].toleranz.some(t=>t.groesse==='zucker'),'unbekannte Variante: Vergleich mit allen Varianten statt Absturz');
// Gärmodell: kuratierte Gare-Daten
const hefereich=normal; // 4 % Hefe wie im Korpus: Korpus-Toleranz und Grenzen bleiben still
const erwartet=Math.exp(6-Math.log(4)-0.1*(28-20));
b=lauf([fall('lang',hefereich,{pruefung:{gare_min:Math.round(erwartet*5),gare_temp:'warm'}}),fall('passt',hefereich,{pruefung:{gare_min:Math.round(erwartet),gare_temp:28}}),fall('ohnepruefung',hefereich)]);
const zg=Object.fromEntries(b.faelle.map(x=>[x.id,x]));
ok(zg.lang.gaerung?.art==='zu_lang' && zg.lang.erkannt && zg.passt.gaerung?.art===null && !zg.passt.erkannt && zg.ohnepruefung.gaerung===null,'Gärmodell mit Gare-Zeit und -Temperatur (Name oder Zahl): ×5 über dem Modell → „zu_lang“ erkannt, passende Zeit → keine Warnung, ohne Gare-Daten keine Prüfung');
ok(near(zg.passt.gaerung.erwartet,erwartet,0.5) && zg.passt.gaerung.temp===28 && near(zg.lang.gaerung.temp,28),'Gärmodell-Zeile trägt Hefe, Temperatur (Mitte des Bereichs) und erwartete Zeit');
b=lauf([fall('lang',hefereich,{pruefung:{gare_min:Math.round(erwartet*5),gare_temp:'warm'}})],{modelle:undefined});
ok(b.faelle[0].gaerung===null && !b.faelle[0].erkannt,'ohne Gärmodell: Gare-Prüfung entfällt');
// nicht prüfbar
b=lauf([fall('ohnemehl',[z('fluessigkeit','wasser',70,'g'),z('suesse','zucker',5,'g'),z('trieb','hefe_frisch',4,'g')]),fall('keine',[],{mengen_vorhanden:false}),fall('wenige',[z('struktur','mehl',100,'g'),z('suesse','zucker',60,'g')]),fall('fremd',[...normal,z('fett','schmalz',20,'g')])]);
const zn=Object.fromEntries(b.faelle.map(x=>[x.id,x]));
ok(['ohnemehl','keine','wenige','fremd'].every(k=>zn[k].geprueft===false && !zn[k].erkannt) && zn.keine.grund==='keine Mengen' && /zu wenige/.test(zn.wenige.grund) && /wesentliche Zutat nicht rechenbar \(schmalz/.test(zn.fremd.grund),'nicht prüfbar: ohne Mehl, ohne Mengen, nur zwei Zutaten, wesentliche Zutat unbekannt — jeweils mit Grund, ohne scheinbare Erkennung');
ok(b.zusammenfassung.geprueft===0 && b.zusammenfassung.misserfolge===0 && b.zusammenfassung.nichtPruefbar.length===4 && b.zusammenfassung.mengeUrsache.nichtPruefbar.length===4,'nicht prüfbare Fälle zählen in keiner Quote, stehen aber in der Liste');
// Kontrollfälle, Ausnahmen, Ursache-Arten
b=lauf([fall('kontrolle',normal,{kontrollfall:true,ursache_art:undefined}),fall('alarm',zuckerig,{kontrollfall:true,ursache_art:undefined}),fall('ausnahme',zuckerig,{ausgenommen:'unklar',ursache_art:undefined}),fall('prozess',zuckerig,{ursache_art:'prozess'}),fall('offen',normal,{ursache_art:'offen'}),fall('menge',zuckerig)]);
const s=b.zusammenfassung;
ok(s.kontrollen===2 && s.falschAlarm.join()==='alarm','Kontrollfälle: Warnung = Falsch-Alarm, keine Warnung = ok');
ok(s.misserfolge===3 && s.erkannt===2 && s.falschNegativ.join()==='offen' && s.ausgenommen.length===1 && s.ausgenommen[0].id==='ausnahme' && s.ausgenommen[0].erkannt===true,'ausgenommene Fälle zählen in keiner Quote, werden aber mit Ergebnis ausgewiesen');
ok(s.mengeUrsache.geprueft===1 && s.mengeUrsache.erkannt===1 && s.prozessOderOffen.map(x=>x.id+':'+x.ursacheArt).join()==='prozess:prozess,offen:offen','Quote für Mengenursachen getrennt von Prozess und offen (Mengen-Regeln können nur Mengenursachen finden)');
ok(b.faelle.every(x=>'ursacheArt' in x && 'ausgenommen' in x && Array.isArray(x.unbekannt) && Array.isArray(x.ignoriert)),'jede Zeile trägt Ursache-Art, Ausnahme, unbekannte und ignorierte Zutaten');
ok(lauf([{id:'u',archetyp:'gibtsnicht',ergebnis:'misslungen',zutaten:[]}]).faelle[0].grund==='Archetyp unbekannt','unbekannter Archetyp: benannt, kein Absturz');

// --- Echte Fälle --------------------------------------------------------------------------------------------------------------
const archReal=J('archetypes');
const korpora={}; for (const [ak,a] of Object.entries(archReal)) { if(ak.startsWith('_')) continue; korpora[ak]=Object.fromEntries(Object.entries(a.varianten).map(([vk,v])=>[vk,J('corpus/'+v.korpus)])); }
const daten=J('negativ');
const alle=daten.faelle;
const echt=negativPruefen({faelle:alle,archetypes:archReal,ingredients:ing,grenzen:J('grenzen'),modelle:J('modelle'),korpora,methods:J('methods'),operations:J('operations'),temperaturen:J('temperaturen')});
const es=echt.zusammenfassung;
ok(alle.length===33 && new Set(alle.map(f=>f.id)).size===33 && alle.every(f=>f.quelle?.url?.startsWith('https://') && f.quelle.site && ['misslungen','teilweise'].includes(f.ergebnis) && [1,2,3].includes(f.verlaesslichkeit) && f.symptom && f.ursache_laut_quelle),'Daten: 33 Fälle (14 aus T55, 19 aus T61) mit eindeutiger id, Quelle (https), Ergebnis, Verlässlichkeit 1–3, Symptom und Ursache');
ok(alle.every(f=>[f.symptom,f.ursache_laut_quelle].every(t=>typeof t==='string' && t.length<=420) && f.notiz.length<=600) && alle.every(f=>!/["„“]/.test(f.symptom+f.ursache_laut_quelle)),'Urheberrecht: nur kurze eigene Zusammenfassungen (Symptom und Ursache höchstens 420 Zeichen, Notiz 600, keine wörtlichen Zitate in Anführungszeichen)');
ok(alle.filter(f=>!f.kontrollfall && !f.ausgenommen).every(f=>['menge','prozess','offen'].includes(f.ursache_art)) && alle.filter(f=>f.kontrollfall).length===9 && alle.filter(f=>f.ausgenommen).length===2,'jeder gezählte Fall hat eine Ursache-Art; neun Kontrollfälle, zwei ausgenommene Fälle');
ok(alle.filter(f=>f.pruefung).every(f=>f.pruefung.gare_min>0 && temperaturBereich(f.pruefung.gare_temp,J('temperaturen'))),'kuratierte Gare-Daten: Zeit und Temperatur lösen sich auf');
ok(es.gesamt===33 && es.geprueft===28 && es.nichtPruefbar.length===5,`prüfbar sind ${es.geprueft} von ${es.gesamt} Fällen (ohne Mengen oder mit unbekannter Zutat: ${es.nichtPruefbar.join(', ')})`);
ok(es.mengeUrsache.geprueft===8 && es.mengeUrsache.erkannt===8 && es.mengeUrsache.nichtPruefbar.length===2,'Befund: alle 8 prüfbaren Misserfolge mit Mengenursache werden erkannt (Hefe, Salz, Fett, Backpulver, Natron, zu wenig Milch, zu viel Flüssigkeit/Zucker); 2 weitere Mengenfälle sind nicht prüfbar (Salz vergessen, selbsttreibendes Mehl)');
ok(es.falschNegativ.length===5 && es.falschNegativ.includes('freshloaf-nutella-sternbrot-dicht') && es.falschNegativ.includes('freshloaf-brotbackautomat-honig-hoehe-einbruch') && es.falschNegativ.every(id=>['prozess','offen'].includes(es.prozessOderOffen.find(x=>x.id===id).ursacheArt)) && es.prozessOderOffen.find(x=>x.id==='freshloaf-nutella-sternbrot-dicht').ursacheArt==='prozess','Befund: fünf Falsch-Negative, alle ohne Mengenursache (zu kurz geknetet; Ursache offen: wässriger Teig, Hydration, Hefe) — Mengen-Regeln können sie nicht sehen');
ok(es.kontrollen===9 && es.falschAlarm.length===2 && es.falschAlarm.includes('sweetsandlifestyle-topfengugelhupf-mitte-eingesunken') && es.falschAlarm.includes('veggies-vegane-pfannkuchen-klebt-ohne-quellzeit'),'Befund: von 9 Kontrollfällen (normale Mengen, Prozessfehler) lösen 2 einen Falsch-Alarm aus — Topfen-Gugelhupf (Eiweiß über der Korpus-Spanne durch Quark) und der vegane Pfannkuchen ohne Ei (Emulgator, Natron, Salz)');
const mengenFaelle=echt.faelle.filter(x=>x.ursacheArt==='menge' && x.geprueft && !x.ausgenommen);
const ueber=Object.fromEntries(mengenFaelle.map(x=>[x.id,x.ursacheGetroffen]));
ok(mengenFaelle.length===8 && es.mengeUrsache.ueberUrsache===Object.values(ueber).filter(Boolean).length && es.mengeUrsache.ueberUrsache===4 && mengenFaelle.every(x=>Array.isArray(alle.find(f=>f.id===x.id).ursache_regeln)) && echt.faelle.filter(x=>x.ursacheGetroffen).every(x=>x.erkannt),`Ehrliche Quote: alle 8 Mengenfälle werden erkannt, aber nur ${es.mengeUrsache.ueberUrsache} über die Ursache, die die Quelle nennt (kuratiert in ursache_regeln) — die anderen aus anderem Grund`);
ok(ueber['freshloaf-vollkorn-2-25tl-hefe-lange-stockgare-dicht']===true && ueber['freshloaf-vollkorn-5-laibe-35g-hefe-kollaps']===false,'Befund: 2,25 TL Hefe erkannt über das Gärmodell (die Ursache); 5 Laibe nur über das Salz, nicht über die genannte Übergare');
ok(ueber['kochkino-gugelhupf-2el-statt-2tl-backpulver']===true && ueber['foodundco-nusszopf-130ml-milch-steif']===true && ueber['veggies-vegane-pfannkuchen-natron-1tl-statt-halb']===true && ueber['bakingforums-bundt-buttermilch-natron-kollaps']===false && ueber['foodcom-quick-easy-pancakes-zu-duenn-schwedisch']===false,'Befund T61: Backpulver verdreifacht, zu wenig Milch im Nusszopf und zu viel Natron über die Ursache erkannt; der Napfkuchen mit zu viel Flüssigkeit nur über den Zucker (200 % vom Mehl), die zu dünnen Pancakes nur über Wasser/Zucker außerhalb des Korpus');
const lf=echt.faelle.find(x=>x.id==='freshloaf-vollkorn-5-laibe-35g-hefe-kollaps');
ok(lf.grenzen.some(x=>x.id==='hf_salz_max') && lf.gaerung.gare===120 && lf.gaerung.temp===41 && lf.gaerung.art===null && lf.erkannt,'Fall 5 Laibe: erkannt über das Salz (hf_salz_max); das Gärmodell sieht die Übergare seit dem Temperatur-Deckel (41 °C zählt wie 35 °C, ×2,6 über dem Modell) nicht mehr als „zu_lang“ (Schwelle ×3,5)');
const l2=echt.faelle.find(x=>x.id==='freshloaf-vollkorn-2-25tl-hefe-lange-stockgare-dicht');
ok(l2.gaerung.art==='zu_lang' && l2.gaerung.hefeBp>5 && l2.gaerung.gare===900,'Fall 2,25 TL Hefe bei 12–18 Std. Raumtemperatur: Gärmodell „zu_lang“ (Hefe 5,6 %, Mitte 15 Std.)');

// --- Werkzeug ---------------------------------------------------------------------------------------------------------------------------
const tool=new URL('../tools/negativ.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const text=execFileSync(process.execPath,[tool],{encoding:'utf8'});
ok(new RegExp(`Misserfolge mit Mengenursache: 8 von 8 erkannt, davon ${es.mengeUrsache.ueberUrsache} über die Ursache`).test(text) && /erkannt \(über die genannte Ursache\)/.test(text) && /erkannt \(aus anderem Grund\)/.test(text) && /FALSCH-NEGATIV/.test(text) && /nicht prüfbar/.test(text) && /Nicht gezählt: pickuplimes/.test(text) && /Falsch-Alarme: 2/.test(text),'Werkzeug: Quote der Mengenursachen, Falsch-Negative, nicht prüfbare und nicht gezählte Fälle');
const json=JSON.parse(execFileSync(process.execPath,[tool,'--json'],{encoding:'utf8'}));
ok(json.zusammenfassung.geprueft===es.geprueft && json.faelle.length===33,'Werkzeug --json liefert dasselbe wie das Modul');

console.log(fail?fail+' FAIL':'ALL PASS');
