// T49/T52: Gärmodell (Hefe × Zeit × Temperatur in °C, DR-026/DR-028) — Rechnung, Parameter gegen den Korpus, Engine-Einbindung.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { erwarteteGare, hefeFuerGare, gaerungsZeit, pruefeGaerung, fmtDauer, gaerungModell } = await import(P+'model/gaerung.js');
const { fmtTemperatur, temperaturBereich } = await import(P+'model/temperatur.js');
const { lesen, fitten } = await import(new URL('../tools/gaerung-fit.mjs', import.meta.url).href);
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const m=gaerungModell(data);

// --- Rechnung -----------------------------------------------------------------------------------------
ok(!!m && m.exponent<0 && m.exponent>-1.2 && m.temp_koeffizient>0 && m.temp_koeffizient<0.2 && Number.isFinite(m.temp_ref) && Number.isFinite(m.temp_standard) && m.warn_faktor>1 && m.rolle==='trieb' && m.trieb_typ==='biologisch','modelle.json: Parameter vorhanden und plausibel (mehr Hefe → kürzer, Wärme → kürzer, Q10 zwischen 1 und 6)');
ok(gaerungModell({})===null && gaerungModell(undefined)===null,'ohne modelle.json: kein Modell, kein Absturz');
const WARM=28, RAUM=21, KALT=5.5;
const umkehrungOk=[KALT,RAUM,WARM,null].every(t=>[0.5,1,2.4,4,8].every(h=>near(hefeFuerGare(erwarteteGare(h,t,m),t,m),h,1e-9)));
ok(umkehrungOk,'hefeFuerGare ist die Umkehrung von erwarteteGare (5 Hefemengen × 3 Temperaturen und „ohne Angabe“)');
ok(erwarteteGare(8,WARM,m)<erwarteteGare(4,WARM,m) && erwarteteGare(4,WARM,m)<erwarteteGare(1,WARM,m),'mehr Hefe → kürzere Gare');
ok(near(erwarteteGare(4,WARM-10,m)/erwarteteGare(4,WARM,m),Math.exp(10*m.temp_koeffizient),1e-9) && erwarteteGare(4,KALT,m)>erwarteteGare(4,RAUM,m) && erwarteteGare(4,RAUM,m)>erwarteteGare(4,WARM,m),'10 °C kälter verlängert genau um Q10; kalt > Raumtemperatur > warm');
ok(near(erwarteteGare(4,null,m),erwarteteGare(4,m.temp_standard,m),1e-12) && near(erwarteteGare(4,m.temp_ref,m),Math.exp(m.ln_konstante+m.exponent*Math.log(4)),1e-9),'ohne Temperatur gilt `temp_standard`; bei `temp_ref` entfällt der Temperatur-Term');
ok(erwarteteGare(4,0,m)>erwarteteGare(4,KALT,m) && !near(erwarteteGare(4,0,m),erwarteteGare(4,null,m),1e-6) && near(hefeFuerGare(erwarteteGare(4,0,m),0,m),4,1e-9),'0 °C ist eine Temperatur, keine fehlende Angabe (länger als im Kühlschrank, nicht der Standard)');
const ungefaehrKonstant=[1,2,4,8].map(h=>h*erwarteteGare(h,WARM,m)/60);
ok(Math.max(...ungefaehrKonstant)/Math.min(...ungefaehrKonstant)<2.5,`Hefe × Zeit ist nur schwach von der Hefemenge abhängig, Exponent ${m.exponent} (${ungefaehrKonstant.map(x=>x.toFixed(1)).join(', ')} %·Std. bei 1, 2, 4, 8 %)`);
ok(fmtDauer(45)==='45 Min.' && fmtDauer(90)==='1 Std. 30 Min.' && fmtDauer(720)==='12 Std.','fmtDauer');
let g=gaerungsZeit([{gaerung:true,dauer:60},{gaerung:null,dauer:10},{gaerung:true,dauer:30}]);
ok(g.summe===90 && !g.vorteig,'gaerungsZeit summiert nur Schritte mit gaerung: true');
g=gaerungsZeit([{gaerung:'vorteig',dauer:720},{gaerung:true,dauer:60}]);
ok(g.summe===null && g.vorteig,'Vorteig macht das Modell unanwendbar');
ok(gaerungsZeit([{gaerung:null,dauer:5}]).summe===null,'ohne Gärschritt keine Gärzeit');

// --- Plausibilitätsprüfung (Stufe 1) -----------------------------------------------------------------------
const soll=erwarteteGare(4,WARM,m);
ok(pruefeGaerung({hefeBp:4,gare:soll,temp:WARM},m)===null && pruefeGaerung({hefeBp:4,gare:soll*3,temp:WARM},m)===null && pruefeGaerung({hefeBp:4,gare:soll/3,temp:WARM},m)===null,'innerhalb des Spielraums ×3 keine Warnung');
let w=pruefeGaerung({hefeBp:4,gare:720,temp:WARM},m);
ok(w?.art==='zu_lang' && /übergärt/.test(w.text) && /4,0 % Hefe/.test(w.text) && /12 Std\./.test(w.text),`4 % Hefe bei 12 Std. warm: „${w?.text}“`);
w=pruefeGaerung({hefeBp:0.4,gare:60,temp:WARM},m);
ok(w?.art==='zu_kurz' && /nicht genug auf/.test(w.text),'0,4 % Hefe bei 1 Std.: zu kurz');
w=pruefeGaerung({hefeBp:4,gare:720,temp:KALT},m);
ok(w===null && erwarteteGare(4,KALT,m)>10*60 && erwarteteGare(4,KALT,m)<16*60,`4 % Hefe bei 12 Std. im Kühlschrank ist plausibel (Modell erwartet ${fmtDauer(erwarteteGare(4,KALT,m))}) — dieselbe Zeit warm warnt`);
w=pruefeGaerung({hefeBp:4,gare:720,temp:WARM,tempText:'26–30 °C (warm)'},m);
ok(/Gare 12 Std\. bei 26–30 °C \(warm\) mit 4,0 % Hefe/.test(w.text),`Meldung nennt die Temperatur: „${w.text.slice(0,60)}…“`);
ok(pruefeGaerung({hefeBp:0,gare:60,temp:WARM},m)===null && pruefeGaerung({hefeBp:4,gare:0,temp:WARM},m)===null,'ohne Hefe oder Zeit keine Aussage');

// --- Parameter gegen den Korpus (kein stilles Veralten) ---------------------------------------------------------
const alleZeilen=lesen(); const zeilen=alleZeilen.filter(r=>!r.pruef); const f=fitten(zeilen);
ok(zeilen.length>=m.fit_n && f.n===zeilen.length && alleZeilen.length-zeilen.length===m.validierung.ids.length,`Fit-Daten: ${zeilen.length} Rezepte ohne Vorteig mit Zeit und Hefe, ohne die ${m.validierung.ids.length} Prüf-Rezepte`);
ok(Math.abs(f.exponent-m.exponent)<0.25 && f.temp_koeffizient/m.temp_koeffizient<1.5 && f.temp_koeffizient/m.temp_koeffizient>1/1.5,`gespeicherte Parameter passen noch zum Korpus (Exponent ${m.exponent} vs. Fit ${f.exponent.toFixed(2)}, Temperatur-Koeffizient ${m.temp_koeffizient} vs. ${f.temp_koeffizient.toFixed(3)}) — sonst node tools/gaerung-fit.mjs prüfen`);
const faktoren=zeilen.map(r=>{const e=erwarteteGare(r.hefe,r.temp,m);return Math.max(r.T/e,e/r.T);}).sort((a,b)=>a-b);
const innerhalb=faktoren.filter(x=>x<=m.warn_faktor).length/faktoren.length;
ok(faktoren[Math.floor(faktoren.length/2)]<2 && innerhalb>=0.9,`mit den gespeicherten Parametern: Median-Abweichung ×${faktoren[Math.floor(faktoren.length/2)].toFixed(2)}, ${Math.round(innerhalb*100)} % der Rezepte innerhalb des Warn-Spielraums ×${m.warn_faktor}`);

// --- Prüf-Rezepte (nicht im Fit) --------------------------------------------------------------------------------
const korpusAlle=Object.values(data.archetypes.hefeteig.varianten).flatMap(v=>J('corpus/'+v.korpus));
const val=m && data.modelle.gaerung.validierung.ids.map(id=>korpusAlle.find(r=>r.id===id));
ok(val.every(Boolean) && val.length===2,'Prüf-Rezepte stehen im Korpus (kalte Weißbrote) und gehen nicht in den Fit ein');
{const abw=alleZeilen.filter(r=>r.pruef).map(r=>{const e=erwarteteGare(r.hefe,r.temp,m);return Math.max(r.T/e,e/r.T);});
ok(abw.length===2 && abw.every(x=>x<=m.warn_faktor),`Vorhersage der Gärzeit liegt bei beiden Prüf-Rezepten innerhalb ×${m.warn_faktor} (Abweichung ×${abw.map(x=>x.toFixed(1)).join(', ×')})`);}

// --- Engine ---------------------------------------------------------------------------------------------------------
const arch=data.archetypes.hefeteig; const rollen=arch.rollen.map(r=>r.rolle);
const ks={}; for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen})),rollen);
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const zustand=(vk,methode,over={})=>{const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);return {archetyp:'hefeteig',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:{...z,...over}};};
const ohneZelle=(vk,methode)=>({...ks,[vk]:{...ks[vk],proMethode:Object.fromEntries(Object.entries(ks[vk].proMethode).filter(([k])=>k!==methode))}});
const hefeBp=(c)=>c.rollenBp.trieb.bp;

// mit Rezepten: Medianwerte, nur Prüfung
let c=compute(zustand('weissbrot','hefe_direkt'),data,ks);
ok(c.gaerung && !c.gaerung.berechnet && c.rollenBp.trieb.quelle==='korpus' && near(hefeBp(c),ks.weissbrot.proMethode.hefe_direkt.bp.trieb.median) && c.gaerung.pruefung===null,'Methode mit Rezepten (Weißbrot direkt): Hefe aus der Zelle, Modell prüft nur');
ok(!c.anpassungen.some(a=>/Gärzeit gerechnet/.test(a)),'… keine Berechnungs-Anpassung');
c=compute(zustand('hefezopf','hefe_kalt'),data,ks);
ok(c.gaerung.kuehl===true && c.gaerung.temp<10 && /4–7 °C/.test(c.gaerung.tempText) && !c.gaerung.berechnet && c.gaerung.pruefung===null,`Zopf kalte Führung: alle Rezepte der Zelle gären im Kühlschrank → ${c.gaerung.tempText}, Modell rechnet mit ${c.gaerung.temp} °C`);
c=compute(zustand('weissbrot','hefe_vorteig'),data,ks);
ok(c.gaerung===null && !c.warnungen.some(x=>/Gärmodell/.test(x)),'Vorteig: Modell nicht anwendbar (Hefe im Vorteig nicht aufgeteilt)');

// ohne Rezepte (simuliert und echt): Hefe aus der Gärzeit
const gerechnet=(vk,methode,k2)=>{const cc=compute(zustand(vk,methode),data,k2);const ablaufGare=cc.ablauf.filter(s=>['gehen','stueckgare'].includes(s.key)).reduce((a,s)=>a+s.dauer,0);return {cc,ablaufGare};};
for (const [vk,methode,kuehl] of [['weissbrot','hefe_direkt',WARM],['weissbrot','hefe_noknead',RAUM],['hefezopf','hefe_direkt',WARM]]) {
  const {cc,ablaufGare}=gerechnet(vk,methode,ohneZelle(vk,methode));
  ok(cc.gaerung.berechnet && cc.rollenBp.trieb.quelle==='berechnet' && near(hefeBp(cc),hefeFuerGare(ablaufGare,kuehl,m),1e-9),`${vk}/${methode} ohne Rezepte: Hefe ${hefeBp(cc).toFixed(2)} % aus ${fmtDauer(ablaufGare)} bei ${kuehl} °C gerechnet`);
}
const kalt=compute(zustand('weissbrot','hefe_kalt'),data,ks);
const gareKalt=kalt.ablauf.filter(s=>['gehen','stueckgare'].includes(s.key)).reduce((a,s)=>a+s.dauer,0);
ok(!ks.weissbrot.proMethode.hefe_kalt===(kalt.gaerung.berechnet) && near(hefeBp(kalt),kalt.gaerung.berechnet?hefeFuerGare(gareKalt,KALT,m):ks.weissbrot.proMethode.hefe_kalt.bp.trieb.median,1e-9),'Weißbrot kalt: gerechnet, solange der Korpus keine kalten Weißbrote enthält, sonst aus der Zelle');
{const {cc}=gerechnet('weissbrot','hefe_noknead',ohneZelle('weissbrot','hefe_noknead')); ok(hefeBp(cc)<1 && cc.gaerung.erwartet>600,`lange Führung ohne Rezepte: sehr wenig Hefe (${hefeBp(cc).toFixed(2)} %) statt der 2,4 % des Variantenmedians`);}
c=compute(zustand('weissbrot','hefe_kalt'),data,ohneZelle('weissbrot','hefe_kalt'));
ok(c.anpassungen.some(a=>/Keine Rezepte mit „Kalte Führung“/.test(a) && /Gärzeit gerechnet/.test(a) && /bei 4–7 °C \(Kühlschrank\)/.test(a) && /Richtwert/.test(a)),'Anpassungstext nennt Methode, Gärzeit, Temperatur und „Richtwert“');
ok(c.zutatenListe.find(z=>z.rolle==='trieb').bpQuelle==='berechnet','Zutatenliste markiert die Hefe als „berechnet“');
ok(c.gaerung.pruefung===null && near(c.gaerung.gare/c.gaerung.erwartet,1,1e-9),'berechnete Hefe ist zur Gärzeit konsistent (Faktor 1)');

// Warnung bei Widerspruch (Stufe 1): Zelle mit unsinniger Hefemenge
const zelle=(vk,methode,hefe)=>({...ks,[vk]:{...ks[vk],proMethode:{...ks[vk].proMethode,[methode]:{...ks[vk].proMethode[methode],bp:{...ks[vk].proMethode[methode].bp,trieb:{...ks[vk].proMethode[methode].bp.trieb,median:hefe}}}}}});
c=compute(zustand('weissbrot','hefe_noknead'),data,zelle('weissbrot','hefe_noknead',12));
ok(c.warnungen.some(x=>/übergärt/.test(x) && /12,0 % Hefe/.test(x)) && c.gaerung.pruefung.art==='zu_lang','12 % Hefe bei 12 Std. Gare ohne Kneten: Warnung „übergärt“');
c=compute(zustand('weissbrot','hefe_direkt'),data,zelle('weissbrot','hefe_direkt',0.3));
ok(c.warnungen.some(x=>/nicht genug auf/.test(x)) && c.gaerung.pruefung.art==='zu_kurz','0,3 % Hefe bei 1,5 Std. Gare direkt: Warnung „zu kurz“');
ok(c.status!=='invalid','die Gärmodell-Warnung macht ein Rezept nicht ungültig (empfohlen, kein hart)');

// Trockenhefe ändert nichts (Frischhefe-Äquivalent)
const frisch=compute(zustand('weissbrot','hefe_direkt'),data,ks); const trocken=compute(zustand('weissbrot','hefe_direkt',{trieb:E('hefe_trocken')}),data,ks);
ok(near(frisch.gaerung.hefeBp,trocken.gaerung.hefeBp) && near(frisch.gaerung.erwartet,trocken.gaerung.erwartet),'Trockenhefe statt Frischhefe: gleiches Modellergebnis');

// Nicht anwendbar: Backpulver-Archetypen, fehlendes Modell, Trieb ohne Hefe
const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle);
const ksR=Object.fromEntries(Object.entries(ruehr.varianten).map(([k,v])=>[k,stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr)]));
const zR={}; for (const r of ruehr.rollen) zR[r.rolle]=E(ruehr.varianten.kastenkuchen.bestof[r.rolle]!==undefined?ruehr.varianten.kastenkuchen.bestof[r.rolle]:r.default);
c=compute({archetyp:'ruehrteig',gefaess:ruehr.varianten.kastenkuchen.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:zR},data,ksR);
ok(c.gaerung===null,'Rührteig (Backpulver, keine Gärschritte): Modell nicht anwendbar');
c=compute(zustand('weissbrot','hefe_kalt',{trieb:E('backpulver')}),data,ohneZelle('weissbrot','hefe_kalt'));
ok(c.gaerung===null && c.rollenBp.trieb.quelle!=='berechnet' && !c.anpassungen.some(a=>/Gärzeit gerechnet/.test(a)),'Backpulver statt Hefe im Hefeteig: Gärmodell nicht anwendbar (nur für biologischen Trieb)');
const {modelle,...ohneModell}=data;
c=compute(zustand('weissbrot','hefe_kalt'),ohneModell,ohneZelle('weissbrot','hefe_kalt'));
ok(c.gaerung===null && c.rollenBp.trieb.quelle==='korpus' && near(hefeBp(c),ks.weissbrot.bp.trieb.median) && !c.warnungen.some(x=>/Gärmodell/.test(x)),'ohne modelle.json und ohne Rezepte: Verhalten wie vor T49 (Variantenmedian, keine Meldung)');

// Presets und alle Methoden mit Rezepten: keine Gärmodell-Warnung
const meldungen=[];
for (const vk of Object.keys(arch.varianten)) for (const meth of [null,...arch.methoden]) { const cc=compute(zustand(vk,meth),data,ks); for (const wt of cc.warnungen) if (/Gärmodell|Gare .* Hefe/.test(wt)) meldungen.push(`${vk}/${meth}: ${wt}`); }
ok(meldungen.length===0,`kein Preset und keine Methode mit Rezepten löst die Gärmodell-Warnung aus${meldungen.length?' — '+meldungen.join(' | '):''}`);
const nk=compute(zustand('weissbrot','hefe_noknead'),data,ks).gaerung;
ok(nk.temp===RAUM && nk.gare/nk.erwartet<m.warn_faktor,`Weißbrot ohne Kneten rechnet mit ${nk.tempText} und liegt bei ×${(nk.gare/nk.erwartet).toFixed(2)} (bleibt bekannte Grenze: die Gare dauert länger als die Hefedosis erwarten lässt), unter ×${m.warn_faktor}`);

// --- Mindestzeit (T58) und Hinweis zum Exponenten -------------------------------------------------------------------------------------
{const {mitMindestzeit}=await import(P+'model/gaerung.js');
 ok(mitMindestzeit(100,360)===360 && mitMindestzeit(500,360)===500 && mitMindestzeit(100,null)===100 && mitMindestzeit(100,undefined)===100 && mitMindestzeit(100,0)===100,'mitMindestzeit: nie kürzer als die Mindestzeit, ohne Mindestzeit unverändert');
 const ohne=pruefeGaerung({hefeBp:8,gare:60,temp:WARM},m);
 const mit=pruefeGaerung({hefeBp:8,gare:30,temp:WARM,mindest:360},m);
 ok(ohne===null && mit?.art==='zu_kurz' && /mindestens 6 Std\./.test(mit.text) && /Mindestzeit der Gare/.test(mit.text),`8 % Hefe, 30 Min. Gare: mit Mindestzeit 6 Std. „zu kurz“ („${mit?.text.slice(0,90)}…“), ohne nicht`);
 ok(pruefeGaerung({hefeBp:8,gare:120,temp:WARM,mindest:360},m)===null,'2 Std. bei Mindestzeit 6 Std. und 8 % Hefe: noch innerhalb des Spielraums (×0,33 > 1/3,5)');
 const lang=pruefeGaerung({hefeBp:4,gare:720,temp:WARM,mindest:360},m);
 ok(lang?.art==='zu_lang' && near(lang.erwartet,erwarteteGare(4,WARM,m),1e-9),'nach oben gilt das Modell allein: 12 Std. bei 4 % Hefe sind „übergärt“, auch mit Mindestzeit (die Mindestzeit hebt die Obergrenze nicht an)');
 const gErg=compute(zustand('weissbrot','hefe_noknead'),data,ks).gaerung;
 ok(gErg.mindest===360 && gErg.modell>0 && gErg.erwartet===Math.max(gErg.modell,360) && gErg.mindestGilt===(gErg.modell<360),`ohne Kneten: Mindestzeit 6 Std. aus dem Operations-Fenster, erwartet ${Math.round(gErg.erwartet)} Min. (Modell ${Math.round(gErg.modell)} Min.)`);
 ok(gErg.fenster && gErg.fenster[0]===360 && gErg.fenster[1]>=gErg.erwartet,`das Zeitfenster aus der Temperatur-Breite unterschreitet die Mindestzeit nicht (${Math.round(gErg.fenster[0])}–${Math.round(gErg.fenster[1])} Min.)`);
 const viel=compute(zustand('weissbrot','hefe_noknead'),data,zelle('weissbrot','hefe_noknead',12)).gaerung;
 ok(viel.mindestGilt===true && viel.erwartet===360 && viel.modell<360 && viel.pruefung?.art==='zu_lang','12 % Hefe ohne Kneten: Modell allein sagt unter 6 Std., es gilt die Mindestzeit, die Warnung „übergärt“ bleibt');
 const direkt=compute(zustand('weissbrot','hefe_direkt'),data,ks).gaerung;
 ok(direkt.mindest===15 && direkt.mindestGilt===false,'direkte Führung: Mindestzeit 15 Min. (Fenster der Operation) bleibt ohne Wirkung');
 ok(typeof m.exponent_hinweis==='string' && /grob belegt/.test(m.exponent_hinweis) && gErg.hinweis===m.exponent_hinweis && compute(zustand('weissbrot','hefe_noknead'),{...data,modelle:{gaerung:{...m,exponent_hinweis:undefined}}},ks).gaerung.hinweis===null,'Hinweis zum Hefe-Exponenten steht in modelle.json und kommt mit dem Gärmodell-Ergebnis (ohne Text: null)');
 const nk=compute(zustand('weissbrot','hefe_noknead'),data,ohneZelle('weissbrot','hefe_noknead'));
 ok(nk.anpassungen.some(a=>/nur grob belegt/.test(a)),'Anpassungstext bei berechneter Hefe nennt die Unsicherheit des Hefe-Einflusses');
 const alt=m.exponent_alternativen; const ohneNk=fitten(zeilen.filter(r=>!(r.methode==='hefe_noknead' && r.temp>=18 && r.temp<=24)));
 ok(Math.abs(alt.ohne_noknead_raum-ohneNk.exponent)<0.1 && alt.erstes_modell_ohne_temperatur<-0.8 && ohneNk.exponent>m.exponent,`Zahlen im Hinweis stimmen noch (ohne Rezepte ohne Kneten bei Raumtemperatur: Fit ${ohneNk.exponent.toFixed(2)}, gespeichert ${alt.ohne_noknead_raum}) — sonst node tools/gaerung-fit.mjs prüfen`);}

// --- Vorteig (T57) ----------------------------------------------------------------------------------------------------------------------
{const {vorteigDosis}=await import(P+'model/gaerung.js');
 ok(near(vorteigDosis({hefeG:1,mehlG:100,dauer:erwarteteGare(1,RAUM,m),temp:RAUM},m),1,1e-9) && near(vorteigDosis({hefeG:1,mehlG:100,dauer:erwarteteGare(1,RAUM,m)/2,temp:RAUM},m),0.5,1e-9),'vorteigDosis: 1 bei der Zeit bis zur Verdopplung, halbe Zeit = 0,5');
 ok(vorteigDosis({hefeG:0,mehlG:100,dauer:60},m)===null && vorteigDosis({hefeG:1,mehlG:null,dauer:60},m)===null && vorteigDosis({hefeG:1,mehlG:100,dauer:0},m)===null && vorteigDosis({hefeG:1,mehlG:0,dauer:60},m)===null,'ohne Hefe, Mehl oder Dauer keine Dosis');
 ok(vorteigDosis({hefeG:1,mehlG:100,dauer:300,temp:KALT},m)<vorteigDosis({hefeG:1,mehlG:100,dauer:300,temp:WARM},m) && vorteigDosis({hefeG:2,mehlG:100,dauer:300,temp:WARM},m)>vorteigDosis({hefeG:1,mehlG:100,dauer:300,temp:WARM},m),'kälter reift langsamer (kleinere Dosis), mehr Hefe reift schneller (größere Dosis)');
 // Korpus: Vorteig-Angaben passen zur Gesamt-Hefe und -Mehl des Rezepts (Quer-Prüfung der Nacherfassung)
 const mitV=korpusAlle.filter(r=>r.vorteig);
 const fehler=[]; for (const r of mitV) { const n=normalizeRecipe(r,data.ingredients,{rollen:data.archetypes.hefeteig.rollen.map(x=>x.rolle)}); if (!(r.vorteig.hefe_g_frisch>0 && r.vorteig.hefe_g_frisch<=n.rollenGramm.trieb+1e-6)) fehler.push(r.id+': Hefe im Vorteig '+r.vorteig.hefe_g_frisch+' g > Gesamt '+n.rollenGramm.trieb.toFixed(1)); if (r.vorteig.mehl_g!=null && !(r.vorteig.mehl_g>0 && r.vorteig.mehl_g<=n.rollenGramm.struktur+1e-6)) fehler.push(r.id+': Mehl im Vorteig > Gesamt'); if (r.vorteig.fluessigkeit_g!=null && !(r.vorteig.fluessigkeit_g>0)) fehler.push(r.id+': Flüssigkeit'); if (!(r.zeiten?.vorteig>0)) fehler.push(r.id+': Vorteig ohne Zeit'); }
 ok(mitV.length>=12 && fehler.length===0 && mitV.every(r=>['hefe_vorteig','hefe_direkt'].includes(r.methode)),`Korpus: ${mitV.length} Rezepte mit Vorteig-Angaben, Hefe und Mehl im Vorteig nie über dem Gesamtwert, jeweils mit Vorteig-Zeit${fehler.length?' — '+fehler.join('; '):''}`);
 const reife=mitV.filter(r=>r.vorteig.mehl_g && r.zeiten.vorteig>=240).map(r=>{const T=temperaturBereich(r.temperaturen?.vorteig,data.temperaturen)?.mitte??null; return vorteigDosis({hefeG:r.vorteig.hefe_g_frisch,mehlG:r.vorteig.mehl_g,dauer:r.zeiten.vorteig,temp:T},m);});
 ok(reife.length===5 && reife.every(d=>d>1/m.warn_faktor && d<m.warn_faktor),`alle ${reife.length} Reife-Vorteige liegen innerhalb ×${m.warn_faktor} um die Verdopplung (Dosis ${reife.map(d=>d.toFixed(2)).join(', ')}) — Modell gilt ohne Fit auch für sie`);}

console.log(fail?fail+' FAIL':'ALL PASS');
