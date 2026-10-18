// T54: Überraschungs-Bericht aus dem Korpus — synthetische Fälle für jede Regel, dann die echten Befunde und das Werkzeug.
import fs from 'fs';
import { execFileSync } from 'child_process';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { ueberraschungenSuchen, STANDARD } = await import(P+'model/ueberraschungen.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;

// --- synthetische Welt ---------------------------------------------------------------------------------------------
const ingredients={ mehl:{label:'Mehl',wasseranteil:0.14}, wasser:{label:'Wasser',wasseranteil:1}, hefe_frisch:{label:'Hefe',wasseranteil:0,funktionen:{hefe:1}} };
const archetypes={ x:{ rollen:[{rolle:'struktur',referenz:true},{rolle:'fluessigkeit'},{rolle:'trieb'}], methoden:['m'], varianten:{v:{korpus:'k'}} } };
const rez=(id,wasser,hefe,methode='hefe_direkt',zeiten=null,temp=null)=>({ id, variante:'v', methode, temperaturen:temp==null?undefined:{gehen:temp}, zeiten,
  zutaten:[{rolle:'struktur',zutat:'mehl',menge:100,einheit:'g'},{rolle:'fluessigkeit',zutat:'wasser',menge:wasser,einheit:'g'},{rolle:'trieb',zutat:'hefe_frisch',menge:hefe,einheit:'g'}] });
const grenzen=(extra=[])=>({archetypen:{x:[
  {id:'w_max',groesse:'wasser',bezug:{rolle:'struktur'},max:100,strenge:'empfohlen',quelle:'Faustwert, am Korpus angehoben'},
  {id:'w_min',groesse:'wasser',bezug:{rolle:'struktur'},min:60,strenge:'empfohlen',quelle:'Faustwert'},
  ...extra]}});
const modelle={gaerung:{ln_konstante:6,exponent:-1,temp_koeffizient:0.1,temp_ref:20,temp_standard:28,warn_faktor:3.5}};
const erwartet=(h,T)=>Math.exp(6-Math.log(h)-0.1*(T-20)); // Minuten
const temperaturen={warm:{label:'warm',min:26,max:30},raum:{label:'Raumtemperatur',min:18,max:24},kuehlschrank:{label:'Kühlschrank',min:4,max:7}};
const operations={gehen:{gaerung:true,temperatur:'warm'}};
const methods=Object.fromEntries(['hefe_direkt','hefe_noknead','hefe_kalt','hefe_vorteig'].map(k=>[k,{sequenz:['gehen']}]));
const suche=(rezepte,over={})=>ueberraschungenSuchen({archetypes,ingredients,grenzen:over.grenzen??grenzen(),modelle:'modelle' in over?over.modelle:modelle,korpora:{x:{v:rezepte}},methods:'methods' in over?over.methods:methods,operations:'operations' in over?over.operations:operations,temperaturen:'temperaturen' in over?over.temperaturen:temperaturen},over.schwellen);

// --- 1) Grenzen am Rand -------------------------------------------------------------------------------------------------
// Wasser-Bilanz = 14 (Mehl) + Wasser; A liegt dicht an max 100, die anderen weit weg
const basis=[rez('A',80,4),rez('B',60,4),rez('C',62,4),rez('D',63,4),rez('E',64,4)];
let b=suche(basis);
const zmax=b.grenzen.find(g=>g.id==='w_max');
ok(!!zmax && zmax.art==='max' && zmax.extrem.id==='A' && near(zmax.extrem.wert,94) && near(zmax.reserve,0.06) && zmax.zweiter.id==='E' && near(zmax.zweiter.wert,78),'Grenze max 100: extremstes Rezept A bei 94 → Reserve 6 %, nächstes E bei 78');
ok(zmax.nahe===1 && zmax.getragenVonEinem===true,'ein einzelnes Rezept im Randbereich (10 %) und große Lücke zum nächsten → „getragen von einem Rezept“');
ok(zmax.amKorpusGelockert===true && zmax.strenge==='empfohlen' && !zmax.verletzt,'Hinweis „am Korpus gelockert“ aus dem quelle-Feld, nicht verletzt');
ok(!b.grenzen.some(g=>g.id==='w_min'),'Grenze min 60: Reserve (74−60)/60 = 23 % liegt über der Schwelle 20 % → nicht gelistet');
b=suche(basis,{schwellen:{reserve:0.3}});
const zmin=b.grenzen.find(g=>g.id==='w_min');
ok(!!zmin && zmin.art==='min' && zmin.extrem.id==='B' && near(zmin.extrem.wert,74) && near(zmin.reserve,(74-60)/60) && zmin.amKorpusGelockert===false,'mit Schwelle 30 %: Grenze min 60 erscheint, Reserve (74−60)/60, nicht „am Korpus gelockert“');
ok(b.grenzen[0].reserve<=b.grenzen[1].reserve,'Zeilen nach Reserve sortiert (knappste zuerst)');
b=suche([...basis,rez('A2',78,4),rez('A3',79,4)]);
const z3=b.grenzen.find(g=>g.id==='w_max');
ok(z3.nahe===3 && z3.getragenVonEinem===false,'drei Rezepte im Randbereich → die Grenze wird nicht von einem einzelnen getragen');
b=suche([...basis,rez('LANG',99,4)]);
const zv=b.grenzen.find(g=>g.id==='w_max');
ok(zv.verletzt===true && zv.reserve<0 && zv.extrem.id==='LANG' && zv.getragenVonEinem===false,'Rezept über der Grenze: „verletzt“ (Korpus und Grenzen passen nicht mehr zusammen)');
{const dicht=suche([rez('A',80,4),rez('N',73,4),rez('B',60,4)]).grenzen.find(g=>g.id==='w_max');
 ok(dicht.nahe===1 && near(dicht.reserve,0.06) && near(dicht.zweiter.wert,87) && dicht.getragenVonEinem===false,'ein Rezept im Randbereich, aber das nächste liegt dicht dahinter (Lücke 7 % < 10 %) → nicht „getragen von einem Rezept“');}
{const g2=suche(basis,{grenzen:{archetypen:{x:[{id:'w_min50',groesse:'wasser',bezug:{rolle:'struktur'},min:50,strenge:'empfohlen',quelle:''},{id:'w_max',groesse:'wasser',bezug:{rolle:'struktur'},max:100,strenge:'empfohlen',quelle:''}]}},schwellen:{reserve:0.5}}).grenzen;
 ok(g2.length===2 && g2[0].id==='w_max' && g2[1].id==='w_min50' && g2[0].reserve<g2[1].reserve,'Sortierung unabhängig von der Reihenfolge in grenzen.json (knappste Reserve zuerst)');}
ok(suche(basis).randRezepte===0 && suche([...basis,rez('R',85,4)]).randRezepte===1,'Randrezepte: nur Rezepte innerhalb von 5 % einer Grenze werden gezählt');
b=suche(basis,{grenzen:grenzen([{id:'null',groesse:'wasser',bezug:{rolle:'struktur'},max:0,strenge:'hart',quelle:''}])});
ok(!b.grenzen.some(g=>g.id==='null'),'Grenze mit Wert 0 wird übersprungen (keine relative Reserve)');
b=suche(basis,{grenzen:{archetypen:{}}});
ok(b.grenzen.length===0,'Archetyp ohne Grenzen: keine Zeilen');

// --- 2) Gärmodell --------------------------------------------------------------------------------------------------------
const gz=(min)=>({gehen:min});
const g4=erwartet(4,28), g4k=erwartet(4,5.5);
const rezepte=[
  ...[1,2,3,4].map(i=>rez('direkt'+i,70,4,'hefe_direkt',gz(Math.round(g4)))),                 // passt
  ...[1,2,3].map(i=>rez('nk'+i,70,4,'hefe_noknead',gz(Math.round(g4*10)))),                   // ×10 zu lang, warm
  ...[1,2].map(i=>rez('kalt'+i,70,4,'hefe_kalt',gz(Math.round(g4k)),'kuehlschrank')),         // passt, Kühlschrank
  rez('vorteig',70,4,'hefe_vorteig',{vorteig:720,gehen:60}),                                  // ausgenommen
  rez('ohnehefe',70,0,'hefe_direkt',gz(60)),                                                  // ausgenommen
  rez('ohnezeit',70,4,'hefe_direkt',null),                                                    // ausgenommen
];
b=suche(rezepte);
ok(b.gaerung.gepruefte===9,'geprüft werden 9 Rezepte (ohne Vorteig, ohne Hefe, ohne Zeitangabe)');
ok(suche([...rezepte,rez('nurstueck',70,4,'hefe_direkt',{stueckgare:30})]).gaerung.gepruefte===9,'Rezept nur mit Stückgare, ohne Gehzeit, wird nicht geprüft (das Modell gilt für die Gehzeit)');
ok(b.gaerung.auffaellig.length===3 && b.gaerung.auffaellig.every(r=>/^nk/.test(r.id) && r.faktor>9 && r.faktor<10.5),'drei Rezepte ohne Kneten weichen um etwa ×10 ab (zu lang)');
ok(near(b.gaerung.auffaellig[0].erwartet,g4,1e-6) && b.gaerung.auffaellig[0].temp===28 && b.gaerung.auffaellig[0].stufe==='warm' && b.gaerung.auffaellig[0].methode==='hefe_noknead','Abweichler tragen erwartete Zeit (bei der Vorgabe der Operation, 28 °C), Temperatur-Stufe und Methode');
const grp=Object.fromEntries(b.gaerung.gruppen.map(x=>[x.gruppe,x]));
ok(grp['hefe_noknead/warm'].systematisch===true && /länger/.test(grp['hefe_noknead/warm'].richtung) && grp['hefe_noknead/warm'].zuLang===3,'Gruppe „ohne Kneten, warm“: systematisch, Rezepte brauchen länger');
ok(grp['hefe_direkt/warm'].systematisch===false && grp['hefe_direkt/warm'].n===4 && near(grp['hefe_direkt/warm'].median,1,0.01) && grp['hefe_kalt/kalt'].systematisch===false,'passende Gruppen sind nicht systematisch (Median ×1)');
// Temperatur: Rezept überschreibt Operation, Zahl und Name gelten gleich, Stufen kalt / raum / warm
{const t=suche([rez('r1',70,4,'hefe_direkt',gz(Math.round(erwartet(4,21))),'raum'),rez('r2',70,4,'hefe_direkt',gz(Math.round(erwartet(4,21))),21),rez('r3',70,4,'hefe_direkt',gz(Math.round(erwartet(4,28)))),rez('r4',70,4,'hefe_direkt',gz(Math.round(erwartet(4,8))),8)]);
 const gr=Object.fromEntries(t.gaerung.gruppen.map(x=>[x.gruppe,x]));
 ok(t.gaerung.auffaellig.length===0 && gr['hefe_direkt/raum'].n===2 && gr['hefe_direkt/warm'].n===1 && gr['hefe_direkt/kalt'].n===1,'Gär-Temperatur aus dem Rezept: Name (raum) und Zahl (21, 8) gelten gleich; ohne Angabe die Vorgabe der Operation; Stufen kalt (< 10 °C), raum (< 25 °C), warm');}
{const t=suche([rez('ohne',70,4,'hefe_direkt',gz(Math.round(g4)))],{methods:undefined,operations:undefined,temperaturen:undefined});
 ok(t.gaerung.gepruefte===1 && t.gaerung.auffaellig.length===0 && t.gaerung.gruppen[0].gruppe==='hefe_direkt/warm','ohne Methoden-/Operations-/Temperatur-Daten rechnet der Bericht mit `temp_standard` (28 °C) und stuft als warm ein');}
ok(suche([rez('x',70,4,'hefe_direkt',gz(Math.round(g4)),'gibtsnicht')]).gaerung.auffaellig.length===0,'unbekannter Temperatur-Name im Rezept: Modell fällt auf `temp_standard` zurück, kein Absturz');
const klein=suche([rez('a',70,4,'hefe_noknead',gz(1000)),rez('b',70,4,'hefe_noknead',gz(1000)),rez('c',70,4,'hefe_direkt',gz(Math.round(g4)))]);
ok(Object.fromEntries(klein.gaerung.gruppen.map(x=>[x.gruppe,x]))['hefe_noknead/warm'].systematisch===false,'Gruppe mit nur 2 Rezepten wird nie „systematisch“ (Mindestgröße 3)');
const gemischt=suche([rez('l1',70,4,'hefe_noknead',gz(1000)),rez('k1',70,4,'hefe_noknead',gz(10)),rez('k2',70,4,'hefe_noknead',gz(10)),rez('ok',70,4,'hefe_noknead',gz(Math.round(g4)))]);
ok(Object.fromEntries(gemischt.gaerung.gruppen.map(x=>[x.gruppe,x]))['hefe_noknead/warm'].systematisch===true && /kürzer/.test(Object.fromEntries(gemischt.gaerung.gruppen.map(x=>[x.gruppe,x]))['hefe_noknead/warm'].richtung),'Mehrheit zu kurz → Richtung „kürzer“');
const zuKurz=suche([...rezepte,rez('kurz',70,4,'hefe_direkt',gz(Math.round(g4/5)))]);
ok(zuKurz.gaerung.auffaellig.some(r=>r.id==='kurz' && r.faktor<0.4),'Rezept mit viel zu kurzer Zeit wird ebenfalls gefunden (×0,2)');
ok(suche(rezepte,{schwellen:{gaerungFaktor:20}}).gaerung.auffaellig.length===0,'Schwelle ×20: nichts fällt auf');
ok(suche(rezepte,{modelle:undefined}).gaerung===null,'ohne Gärmodell: Abschnitt entfällt');
ok(suche(rezepte,{modelle:{}}).gaerung===null,'modelle ohne gaerung: Abschnitt entfällt');

// Mindestzeit der Gare-Operation (T58): wie in der Engine nie kürzer als `zeit.min`; nach oben zählt nur das Modell
{const opsMin={gehen:{gaerung:true,temperatur:'warm',zeit:{min:360}}};
 const mit=suche([rez('lang',70,4,'hefe_direkt',gz(300)),rez('ok',70,4,'hefe_direkt',gz(Math.round(g4)))],{operations:opsMin});
 const ohne=suche([rez('lang',70,4,'hefe_direkt',gz(300)),rez('ok',70,4,'hefe_direkt',gz(Math.round(g4)))]);
 ok(ohne.gaerung.auffaellig.some(r=>r.id==='lang' && r.faktor>6) && !mit.gaerung.auffaellig.some(r=>r.id==='lang'),'Mindestzeit 6 Std.: 5 Std. Gare bei 4 % Hefe sind ×6,7 über dem Modell, mit Mindestzeit ×0,8 — kein Abweichler mehr');
 const kurz=suche([rez('kurz',70,4,'hefe_direkt',gz(60))],{operations:opsMin});
 ok(kurz.gaerung.auffaellig.some(r=>r.id==='kurz' && near(r.erwartet,360,1e-6) && r.faktor<0.2),'unter der Mindestzeit liegt weiter auf: erwartet wird die Mindestzeit (360 Min.), 60 Min. sind ×0,17');}

// Vorteig (T57): Reife-Vorteige und Hefe-Ansätze getrennt, Dosis = Reifezeit / Zeit bis zur Verdopplung; nicht im Gärmodell-Fit
{const rv=(id,mehl,hefe,dauer,temp,methode='hefe_vorteig')=>({...rez(id,70,4,methode,{vorteig:dauer,gehen:60}),vorteig:{mehl_g:mehl,hefe_g_frisch:hefe},temperaturen:temp?{vorteig:temp}:undefined});
 const e1=Math.round(erwartet(1,5.5)); // 1 % Hefe im Kühlschrank
 const v=suche([rv('a',100,1,e1,'kuehlschrank'),rv('b',100,1,Math.round(e1/10),'kuehlschrank'),rv('c',100,1,e1*4,'kuehlschrank'),rv('ohnemehl',null,1,e1,'kuehlschrank'),rv('direkt',100,1,e1*2,'kuehlschrank','hefe_direkt'),rv('warm',100,1,Math.round(erwartet(1,28)*0.5),'warm')]);
 const R=v.vorteig;
 ok(R.gepruefte===5 && R.reife.n===3 && R.ansatz.n===2,'Vorteig: geprüft wird jedes Rezept mit Vorteig-Mehl, -Hefe und -Dauer, gleich welche Methode (5 von 6; ohne Mehl nicht); ab 240 Min. „Reife-Vorteig“, darunter „Hefe-Ansatz“');
 const a=R.reife.rezepte.find(r=>r.id==='a'), c=R.reife.rezepte.find(r=>r.id==='c');
 ok(near(a.dosis,1,0.01) && near(c.dosis,4,0.02) && near(a.hefeBp,1) && a.temp===5.5 && near(R.reife.median,2,0.02),'Dosis 1 bei Reifezeit = Zeit bis zur Verdopplung (1 % Hefe im Vorteig, 5,5 °C), ×4 bei vierfacher Zeit; Median der drei Reife-Vorteige (1, 2, 4) = 2, nicht der aller fünf');
 ok(R.auffaellig.length===1 && R.auffaellig[0]==='c','nur der überreife Vorteig (Dosis ×4 > Schwelle ×2,5) fällt auf; die Ansätze zählen nicht mit');
 const jung=suche([rv('jung',100,1,300,'kuehlschrank')]).vorteig;
 ok(jung.reife.n===1 && jung.auffaellig.join()==='jung' && jung.reife.rezepte[0].dosis<0.4,'zu junger Reife-Vorteig (5 Std. statt 29 Std. bei 1 % Hefe im Kühlschrank, Dosis 0,17) fällt ebenfalls auf, nicht nur zu alter');
 const mehl2=suche([rv('m2',200,2,e1,'kuehlschrank')]).vorteig.reife.rezepte[0];
 ok(near(mehl2.hefeBp,1) && near(mehl2.dosis,1,0.01),'Hefe wird auf das Mehl des Vorteigs bezogen (2 g auf 200 g = 1 %, Dosis 1)');
 const b=R.ansatz.rezepte.find(r=>r.id==='b');
 ok(near(b.dosis,0.1,0.01) && R.ansatz.rezepte.some(r=>r.id==='warm' && r.temp===28 && near(r.dosis,0.5,0.02)),'Hefe-Ansatz: Dosis 0,1 bzw. 0,5 (Temperatur „warm“ = 28 °C)');
 ok(v.gaerung.gepruefte===0 && suche([rv('a',100,1,e1,'kuehlschrank')],{modelle:undefined}).vorteig===null,'Rezepte mit reifendem Vorteig bleiben außerhalb des Gärmodell-Berichts, auch wenn die Methode „direkt“ heißt; ohne Modell entfällt auch der Vorteig-Abschnitt');
 const ansatz=suche([rv('ansatz',100,1,15,'warm','hefe_direkt')]);
 ok(ansatz.gaerung.gepruefte===1 && ansatz.vorteig.ansatz.n===1,'ein Hefe-Ansatz (15 Min.) in der direkten Führung zählt dagegen im Gärmodell-Bericht und im Vorteig-Abschnitt als Ansatz');
 ok(suche([rv('a',100,1,e1,'kuehlschrank')],{schwellen:{vorteigReife:2000}}).vorteig.ansatz.n===1,'Schwelle vorteigReife ist einstellbar (2000 Min.: derselbe Vorteig wird zum Ansatz)');}

// --- 3) Muster ------------------------------------------------------------------------------------------------------------
ok(b.gaerung.muster.nZuLang===3 && b.gaerung.muster.nZuKurz===0 && b.gaerung.muster.zuKurz.length===0,'Muster: 3 Abweichler „länger“, keine „kürzer“');
const mn=b.gaerung.muster.zuLang.find(m=>m.eigenschaft==='methode:hefe_noknead');
ok(!!mn && mn.nAuffaellig===3 && mn.nVergleich===3 && near(mn.anteilAuffaellig,1) && near(mn.anteilVergleich,3/9) && near(mn.lift,3),'Muster „ohne Kneten“: 3 von 3 Abweichlern gegenüber 3 von 9 geprüften Rezepten → 3× häufiger');
ok(!b.gaerung.muster.zuLang.some(m=>m.eigenschaft==='methode:hefe_direkt'),'Eigenschaften, die nicht häufiger vorkommen, erscheinen nicht');
ok(b.gaerung.muster.zuLang.every(m=>m.lift>=STANDARD.minLift && m.nAuffaellig>=STANDARD.minMuster),'jedes Muster erfüllt Mindestanzahl und Mindest-Lift');
const kurz2=suche([...rezepte,rez('k1',70,4,'hefe_direkt',gz(Math.round(g4/5))),rez('k2',70,4,'hefe_direkt',gz(Math.round(g4/5)))]);
ok(kurz2.gaerung.muster.nZuKurz===2 && kurz2.gaerung.muster.zuKurz.some(m=>m.eigenschaft==='methode:hefe_direkt'),'Richtungen werden getrennt ausgewertet (zwei „kürzer“-Rezepte bilden ein eigenes Muster)');
ok(kurz2.gaerung.muster.nZuLang===3 && !kurz2.gaerung.muster.zuLang.some(m=>m.eigenschaft==='methode:hefe_direkt') && kurz2.gaerung.muster.zuLang.some(m=>m.eigenschaft==='methode:hefe_noknead'),'… und die „länger“-Liste enthält die „kürzer“-Rezepte nicht (kein Vermischen der Richtungen)');
ok(zuKurz.gaerung.muster.nZuKurz===1 && zuKurz.gaerung.muster.zuKurz.length===0,'ein einzelner „kürzer“-Abweichler bildet kein Muster (Mindestanzahl 2)');
const niedrig=suche([...rezepte,rez('h1',70,1,'hefe_kalt',gz(60),'kuehlschrank'),rez('h2',70,1,'hefe_kalt',gz(60),'kuehlschrank')]);
ok(niedrig.gaerung.muster.zuKurz.some(m=>m.eigenschaft==='hefe:wenig (< 1,5 %)'),'Hefemenge ist eine Eigenschaft (wenig Hefe bei den „kürzer“-Rezepten)');

// --- Echte Daten: die Befunde vom 2026-10-18 ------------------------------------------------------------------------------------
const archReal=J('archetypes');
const korpora={}; for (const [ak,a] of Object.entries(archReal)) { if(ak.startsWith('_')) continue; korpora[ak]=Object.fromEntries(Object.entries(a.varianten).map(([vk,v])=>[vk,J('corpus/'+v.korpus)])); }
const echt=ueberraschungenSuchen({archetypes:archReal,ingredients:J('ingredients'),grenzen:J('grenzen'),modelle:J('modelle'),korpora,methods:J('methods'),operations:J('operations'),temperaturen:J('temperaturen')});
ok(echt.rezepte>=129 && echt.gaerung.gepruefte>=40,`Echter Korpus: ${echt.rezepte} Rezepte, ${echt.gaerung.gepruefte} vom Gärmodell geprüft`);
ok(!echt.grenzen.some(g=>g.verletzt),'Kein Korpus-Rezept verletzt eine Grenze (Grenzen und Korpus passen zusammen)');
ok(echt.grenzen.some(g=>g.getragenVonEinem && g.amKorpusGelockert),'Befund: mindestens eine am Korpus gelockerte Grenze wird von einem einzelnen Rezept getragen');
const eg=Object.fromEntries(echt.gaerung.gruppen.map(x=>[x.gruppe,x]));
ok(!eg['hefe_noknead/raum'].systematisch && eg['hefe_noknead/raum'].median>1.4 && eg['hefe_noknead/raum'].median<2.5,`Befund: ohne Kneten bei Raumtemperatur liegt mit der Mindestzeit (T58) nicht mehr systematisch daneben, bleibt aber über dem Modell (Median ×${eg['hefe_noknead/raum'].median.toFixed(1)})`);
ok(!echt.gaerung.muster.zuLang.some(m=>m.eigenschaft==='methode:hefe_noknead'),'Befund: bei „länger“ sticht die Methode ohne Kneten nicht mehr heraus (Mindestzeit)');
ok(echt.gaerung.gruppen.every(g=>!g.systematisch) && echt.gaerung.auffaellig.length<=4 && echt.gaerung.gepruefte>=48,`Befund nach T59 (49 Rezepte im Fit, Temperatur-Deckel, Neu-Fit): keine Gruppe weicht systematisch ab, nur ${echt.gaerung.auffaellig.length} von ${echt.gaerung.gepruefte} Rezepten liegen über ×2,5 daneben (vorher kalte Gare bei wenig Hefe und Ofen-Gare auffällig)`);
ok(echt.vorteig.reife.n>=12 && echt.vorteig.ansatz.n>=2 && echt.vorteig.reife.median>0.7 && echt.vorteig.reife.median<1.4 && echt.vorteig.auffaellig.length<=2 && echt.vorteig.reife.rezepte.every(r=>r.dosis>0.4 && r.dosis<2.2),`Befund (T57, T59): ${echt.vorteig.reife.n} Reife-Vorteige liegen im Median bei ${echt.vorteig.reife.median.toFixed(2)} der Zeit bis zur Verdopplung (unabhängig vom Fit; ${echt.vorteig.auffaellig.length} außerhalb ×2,5), Hefe-Ansätze bei ${echt.vorteig.ansatz.median.toFixed(2)} — sie reifen nicht`);
ok(echt.gaerung.auffaellig.length>=3 && echt.gaerung.auffaellig.every(r=>!('roh' in r)),'Abweichler ohne Rohdaten im Ergebnis (ausgabefähig)');

// --- Werkzeug ----------------------------------------------------------------------------------------------------------------------
const tool=new URL('../tools/ueberraschungen.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const text=execFileSync(process.execPath,[tool],{encoding:'utf8'});
ok(/1\) Grenzen am Rand/.test(text) && /2\) Gärmodell/.test(text) && /3\) Muster/.test(text) && /nur Erfolge/.test(text) && / °C, hefe_/.test(text) && /2b\) Vorteig/.test(text) && /Hefe-Ansätze/.test(text),'Werkzeug: alle drei Abschnitte, Temperatur je Abweichler und Erfolgs-Auswahl');
const streng=execFileSync(process.execPath,[tool,'--gaerung','1.2'],{encoding:'utf8'});
ok(/SYSTEMATISCH/.test(streng) && /fehlende Größe/.test(streng),'Werkzeug: bei enger Schwelle werden systematische Gruppen mit Hinweis auf eine fehlende Größe markiert');
const json=JSON.parse(execFileSync(process.execPath,[tool,'--json'],{encoding:'utf8'}));
ok(json.rezepte===echt.rezepte && json.gaerung.auffaellig.length===echt.gaerung.auffaellig.length && json.grenzen.length===echt.grenzen.length,'Werkzeug --json liefert dasselbe wie das Modul');
const eng=JSON.parse(execFileSync(process.execPath,[tool,'--json','--gaerung','100'],{encoding:'utf8'}));
ok(eng.gaerung.auffaellig.length===0 && eng.schwellen.gaerungFaktor===100,'Werkzeug: --gaerung stellt die Schwelle ein');
const reserve=JSON.parse(execFileSync(process.execPath,[tool,'--json','--reserve','0.05'],{encoding:'utf8'}));
ok(reserve.grenzen.length<json.grenzen.length && reserve.grenzen.every(g=>g.verletzt||g.reserve<=0.05+1e-9),'Werkzeug: --reserve stellt die Grenzen-Schwelle ein');

console.log(fail?fail+' FAIL':'ALL PASS');
