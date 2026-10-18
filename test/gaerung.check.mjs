// T49: Gärmodell (Hefe × Zeit × Temperatur, DR-026) — Rechnung, Parameter gegen den Korpus, Engine-Einbindung.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { erwarteteGare, hefeFuerGare, gaerungsZeit, pruefeGaerung, fmtDauer, gaerungModell } = await import(P+'model/gaerung.js');
const { lesen, fitten } = await import(new URL('../tools/gaerung-fit.mjs', import.meta.url).href);
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const m=gaerungModell(data);

// --- Rechnung -----------------------------------------------------------------------------------------
ok(!!m && m.exponent<0 && m.kuehl_faktor>1 && m.warn_faktor>1 && m.rolle==='trieb' && m.trieb_typ==='biologisch','modelle.json: Parameter vorhanden und plausibel (mehr Hefe → kürzer, Kälte → länger)');
ok(gaerungModell({})===null && gaerungModell(undefined)===null,'ohne modelle.json: kein Modell, kein Absturz');
const umkehrungOk=[false,true].every(k=>[0.5,1,2.4,4,8].every(h=>near(hefeFuerGare(erwarteteGare(h,k,m),k,m),h,1e-9)));
ok(umkehrungOk,'hefeFuerGare ist die Umkehrung von erwarteteGare (5 Hefemengen × warm/kalt)');
ok(erwarteteGare(8,false,m)<erwarteteGare(4,false,m) && erwarteteGare(4,false,m)<erwarteteGare(1,false,m),'mehr Hefe → kürzere Gare');
ok(near(erwarteteGare(4,true,m)/erwarteteGare(4,false,m),m.kuehl_faktor,1e-9),'Kälte verlängert um genau den Kältefaktor');
const ungefaehrKonstant=[1,2,4,8].map(h=>h*erwarteteGare(h,false,m)/60);
ok(Math.max(...ungefaehrKonstant)/Math.min(...ungefaehrKonstant)<1.6,`Hefe × Zeit ist ungefähr konstant über 1–8 % (${ungefaehrKonstant.map(x=>x.toFixed(1)).join(', ')} %·Std.)`);
ok(fmtDauer(45)==='45 Min.' && fmtDauer(90)==='1 Std. 30 Min.' && fmtDauer(720)==='12 Std.','fmtDauer');
let g=gaerungsZeit([{gaerung:true,dauer:60},{gaerung:null,dauer:10},{gaerung:true,dauer:30}]);
ok(g.summe===90 && !g.vorteig,'gaerungsZeit summiert nur Schritte mit gaerung: true');
g=gaerungsZeit([{gaerung:'vorteig',dauer:720},{gaerung:true,dauer:60}]);
ok(g.summe===null && g.vorteig,'Vorteig macht das Modell unanwendbar');
ok(gaerungsZeit([{gaerung:null,dauer:5}]).summe===null,'ohne Gärschritt keine Gärzeit');

// --- Plausibilitätsprüfung (Stufe 1) -----------------------------------------------------------------------
const soll=erwarteteGare(4,false,m);
ok(pruefeGaerung({hefeBp:4,gare:soll,kuehl:false},m)===null && pruefeGaerung({hefeBp:4,gare:soll*3,kuehl:false},m)===null && pruefeGaerung({hefeBp:4,gare:soll/3,kuehl:false},m)===null,'innerhalb des Spielraums ×3 keine Warnung');
let w=pruefeGaerung({hefeBp:4,gare:720,kuehl:false},m);
ok(w?.art==='zu_lang' && /übergärt/.test(w.text) && /4,0 % Hefe/.test(w.text) && /12 Std\./.test(w.text),`4 % Hefe bei 12 Std. warm: „${w?.text}“`);
w=pruefeGaerung({hefeBp:0.4,gare:60,kuehl:false},m);
ok(w?.art==='zu_kurz' && /nicht genug auf/.test(w.text),'0,4 % Hefe bei 1 Std.: zu kurz');
w=pruefeGaerung({hefeBp:4,gare:720,kuehl:true},m);
ok(w===null && erwarteteGare(4,true,m)>7*60 && erwarteteGare(4,true,m)<11*60,`4 % Hefe bei 12 Std. KALT ist plausibel (Modell erwartet ${fmtDauer(erwarteteGare(4,true,m))}) — dieselbe Zeit warm warnt`);
ok(pruefeGaerung({hefeBp:0,gare:60,kuehl:false},m)===null && pruefeGaerung({hefeBp:4,gare:0,kuehl:false},m)===null,'ohne Hefe oder Zeit keine Aussage');

// --- Parameter gegen den Korpus (kein stilles Veralten) ---------------------------------------------------------
const zeilen=lesen(); const f=fitten(zeilen);
ok(zeilen.length>=38 && f.n===zeilen.length,`Fit-Daten: ${zeilen.length} Rezepte ohne Vorteig mit Zeit und Hefe`);
ok(Math.abs(f.exponent-m.exponent)<0.25 && f.kuehl_faktor/m.kuehl_faktor<1.5 && f.kuehl_faktor/m.kuehl_faktor>1/1.5,`gespeicherte Parameter passen noch zum Korpus (Exponent ${m.exponent} vs. Fit ${f.exponent.toFixed(2)}, Kältefaktor ${m.kuehl_faktor} vs. ${f.kuehl_faktor.toFixed(1)}) — sonst node tools/gaerung-fit.mjs prüfen`);
const faktoren=zeilen.map(r=>{const e=erwarteteGare(r.hefe,!!r.kalt,m);return Math.max(r.T/e,e/r.T);}).sort((a,b)=>a-b);
const innerhalb=faktoren.filter(x=>x<=m.warn_faktor).length/faktoren.length;
ok(faktoren[Math.floor(faktoren.length/2)]<2 && innerhalb>=0.9,`mit den gespeicherten Parametern: Median-Abweichung ×${faktoren[Math.floor(faktoren.length/2)].toFixed(2)}, ${Math.round(innerhalb*100)} % der Rezepte innerhalb des Warn-Spielraums ×${m.warn_faktor}`);

// --- Unabhängiger Testsatz (Parameter vor der Recherche eingefroren) ---------------------------------------------
const korpusAlle=Object.values(data.archetypes.hefeteig.varianten).flatMap(v=>J('corpus/'+v.korpus));
const val=m && data.modelle.gaerung.validierung.ids.map(id=>korpusAlle.find(r=>r.id===id));
ok(val.every(Boolean) && val.length===2,'Validierungs-Rezepte stehen im Korpus (kalte Weißbrote, nach dem Einfrieren der Parameter recherchiert)');
{const abw=val.map(r=>{const n=normalizeRecipe(r,data.ingredients,{rollen:data.archetypes.hefeteig.rollen.map(x=>x.rolle)});const z=r.zeiten;const T=(z.vorteig??0)+(z.gehen??0)+(z.stueckgare??0);const e=erwarteteGare(n.bilanz.bp.hefe,r.gehen_kuehl===true,m);return Math.max(T/e,e/T);});
ok(abw.every(x=>x<=m.warn_faktor),`Vorhersage der Gärzeit liegt bei beiden Test-Rezepten innerhalb ×${m.warn_faktor} (Abweichung ×${abw.map(x=>x.toFixed(1)).join(', ×')})`);}

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
ok(c.gaerung.kuehl===true && !c.gaerung.berechnet && c.gaerung.pruefung===null,'Zopf kalte Führung: Zelle ist zu 100 % kalt → Kältefaktor gilt');
c=compute(zustand('weissbrot','hefe_vorteig'),data,ks);
ok(c.gaerung===null && !c.warnungen.some(x=>/Gärmodell/.test(x)),'Vorteig: Modell nicht anwendbar (Hefe im Vorteig nicht aufgeteilt)');

// ohne Rezepte (simuliert und echt): Hefe aus der Gärzeit
const gerechnet=(vk,methode,k2)=>{const cc=compute(zustand(vk,methode),data,k2);const ablaufGare=cc.ablauf.filter(s=>['gehen','stueckgare'].includes(s.key)).reduce((a,s)=>a+s.dauer,0);return {cc,ablaufGare};};
for (const [vk,methode,kuehl] of [['weissbrot','hefe_direkt',false],['weissbrot','hefe_noknead',false],['hefezopf','hefe_direkt',false]]) {
  const {cc,ablaufGare}=gerechnet(vk,methode,ohneZelle(vk,methode));
  ok(cc.gaerung.berechnet && cc.rollenBp.trieb.quelle==='berechnet' && near(hefeBp(cc),hefeFuerGare(ablaufGare,kuehl,m),1e-9),`${vk}/${methode} ohne Rezepte: Hefe ${hefeBp(cc).toFixed(2)} % aus ${fmtDauer(ablaufGare)} gerechnet`);
}
const kalt=compute(zustand('weissbrot','hefe_kalt'),data,ks);
const gareKalt=kalt.ablauf.filter(s=>['gehen','stueckgare'].includes(s.key)).reduce((a,s)=>a+s.dauer,0);
ok(!ks.weissbrot.proMethode.hefe_kalt===(kalt.gaerung.berechnet) && near(hefeBp(kalt),kalt.gaerung.berechnet?hefeFuerGare(gareKalt,true,m):ks.weissbrot.proMethode.hefe_kalt.bp.trieb.median,1e-9),'Weißbrot kalt: gerechnet, solange der Korpus keine kalten Weißbrote enthält, sonst aus der Zelle');
{const {cc}=gerechnet('weissbrot','hefe_noknead',ohneZelle('weissbrot','hefe_noknead')); ok(hefeBp(cc)<1 && cc.gaerung.erwartet>600,`lange Führung ohne Rezepte: sehr wenig Hefe (${hefeBp(cc).toFixed(2)} %) statt der 2,4 % des Variantenmedians`);}
c=compute(zustand('weissbrot','hefe_kalt'),data,ohneZelle('weissbrot','hefe_kalt'));
ok(c.anpassungen.some(a=>/Keine Rezepte mit „Kalte Führung“/.test(a) && /Gärzeit gerechnet/.test(a) && /kalt/.test(a) && /Richtwert/.test(a)),'Anpassungstext nennt Methode, Gärzeit, kalt und „Richtwert“');
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
ok(nk.gare/nk.erwartet<m.warn_faktor,`bekannte Grenze: Weißbrot ohne Kneten liegt bei ×${(nk.gare/nk.erwartet).toFixed(2)} (Raumtemperatur ~20 °C ist langsamer als das „warm“ des Modells), noch unter ×${m.warn_faktor}`);

console.log(fail?fail+' FAIL':'ALL PASS');
