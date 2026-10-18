// T07: Feedback-Schleife (overrides.js, errorRequests.js, korrelationEntscheidungen.js — alle nur localStorage)
// und die Korpus-Korrelationssuche (korrelation.js, DR-019 Punkt 4/5).
const P=new URL('../src/', import.meta.url).href;
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

// localStorage-Stub: normale Funktion, kaputtes JSON, werfender Speicher (privater Modus)
const speicher={};
let modus='normal';
globalThis.localStorage={
  getItem:(k)=>{ if(modus==='gesperrt') throw new Error('gesperrt'); return k in speicher ? speicher[k] : null; },
  setItem:(k,v)=>{ if(modus==='gesperrt') throw new Error('Quota'); speicher[k]=String(v); },
};
const leeren=()=>{ for(const k of Object.keys(speicher)) delete speicher[k]; modus='normal'; };

const ov=await import(P+'model/overrides.js');
const er=await import(P+'model/errorRequests.js');
const ent=await import(P+'model/korrelationEntscheidungen.js');
const { korrelationenSuchen } = await import(P+'model/korrelation.js');

// --- Overrides -------------------------------------------------------------------------------------
leeren();
ok(JSON.stringify(ov.alleOverrides())==='{}' && ov.overridesFuer('x').length===0,'Overrides: zunächst leer');
ov.overrideErfassen('natron_braucht_saeure','Natron, Milch','braucht eine saure Zutat');
let liste=ov.overridesFuer('natron_braucht_saeure');
ok(liste.length===1 && liste[0].ergebnis==='offen' && liste[0].kontext==='Natron, Milch' && /^\d{4}-\d\d-\d\dT/.test(liste[0].zeitpunkt),'Override erfassen: offen, Kontext, ISO-Zeitstempel');
ov.overrideErfassen('natron_braucht_saeure','zweiter Versuch','x');
ov.overrideErfassen('fett_max_hart','Fett 160 %','y');
ok(ov.overridesFuer('natron_braucht_saeure').length===2 && ov.overridesFuer('fett_max_hart').length===1 && Object.keys(ov.alleOverrides()).length===2,'mehrere Versuche je Regel, Regeln getrennt');
const zp=ov.overridesFuer('fett_max_hart')[0].zeitpunkt;
ov.overrideAntwort('fett_max_hart',zp,'ja');
ok(ov.overridesFuer('fett_max_hart')[0].ergebnis==='ja' && ov.overridesFuer('natron_braucht_saeure').every((o)=>o.ergebnis==='offen'),'Antwort ändert nur den angesprochenen Eintrag');
ov.overrideAntwort('fett_max_hart','1999-01-01T00:00:00.000Z','nein');
ov.overrideAntwort('gibtsnicht',zp,'nein');
ok(ov.overridesFuer('fett_max_hart')[0].ergebnis==='ja' && !('gibtsnicht' in ov.alleOverrides()),'Antwort auf unbekannten Eintrag/Regel: nichts passiert');
speicher['chefing_overrides_v1']='{kaputt';
ok(JSON.stringify(ov.alleOverrides())==='{}','kaputtes JSON im Speicher → leer statt Absturz');
leeren(); modus='gesperrt';
let geworfen=false; try { ov.overrideErfassen('a','b','c'); ov.overrideAntwort('a','z','ja'); ov.alleOverrides(); } catch { geworfen=true; }
ok(!geworfen && JSON.stringify(ov.alleOverrides())==='{}','gesperrter Speicher (privater Modus): kein Fehler, kein Gedächtnis');

// --- Fehlermeldungen ------------------------------------------------------------------------------------
leeren();
ok(JSON.stringify(er.alleErrorRequests())==='{}','Fehlermeldungen: zunächst leer');
er.errorRequestEinreichen('wasser_max_hart','Funktioniert bei Pfannkuchen');
er.errorRequestEinreichen('wasser_max_hart','Noch ein Beleg');
let q=er.alleErrorRequests();
ok(q.wasser_max_hart.length===2 && q.wasser_max_hart[0].begruendung==='Funktioniert bei Pfannkuchen' && !!q.wasser_max_hart[0].zeitpunkt,'Fehlermeldung: Begründung und Zeitstempel, mehrere je Regel');
// zwei Requests mit demselben Zeitstempel (selbe Millisekunde) + ein dritter: Entfernen nimmt genau einen
speicher['chefing_error_requests_v1']=JSON.stringify({wasser_max_hart:[
  {zeitpunkt:'2026-10-18T10:00:00.000Z',begruendung:'A'},
  {zeitpunkt:'2026-10-18T10:00:00.000Z',begruendung:'B'},
  {zeitpunkt:'2026-10-18T10:05:00.000Z',begruendung:'C'},
]});
er.errorRequestEntfernen('wasser_max_hart','2026-10-18T10:00:00.000Z');
q=er.alleErrorRequests();
ok(q.wasser_max_hart.map((r)=>r.begruendung).join()==='B,C','Entfernen nimmt genau einen Eintrag, auch bei gleichem Zeitstempel');
er.errorRequestEntfernen('wasser_max_hart','2026-10-18T10:00:00.000Z');
er.errorRequestEntfernen('wasser_max_hart','2026-10-18T10:05:00.000Z');
ok(!('wasser_max_hart' in er.alleErrorRequests()),'letzten Eintrag entfernt → Regel verschwindet aus der Liste');
er.errorRequestEntfernen('gibtsnicht','x');
ok(JSON.stringify(er.alleErrorRequests())==='{}','Entfernen unbekannter Regel: kein Eintrag, kein Fehler');
speicher['chefing_error_requests_v1']='nicht json';
ok(JSON.stringify(er.alleErrorRequests())==='{}','Fehlermeldungen: kaputtes JSON → leer');
leeren(); modus='gesperrt';
geworfen=false; try { er.errorRequestEinreichen('a','b'); er.errorRequestEntfernen('a','z'); } catch { geworfen=true; }
ok(!geworfen,'Fehlermeldungen: gesperrter Speicher → kein Fehler');

// --- Korrelations-Entscheidungen -------------------------------------------------------------------------
leeren();
const k={bRolle:'fluessigkeit',eigenschaft:'saeure',wert:true,zRolle:'trieb'};
const id=ent.kandidatId('kastenkuchen',k);
ok(id==='kastenkuchen:fluessigkeit.saeure=true->trieb' && id===ent.kandidatId('kastenkuchen',{...k}) && id!==ent.kandidatId('muffin',k),'kandidatId ist stabil und enthält Variante, Bedingung und Ziel');
ent.entscheidungSetzen(id,'bestaetigt');
ok(ent.alleEntscheidungen()[id]==='bestaetigt','Entscheidung: bestätigt');
ent.entscheidungSetzen(id,'verworfen');
ok(ent.alleEntscheidungen()[id]==='verworfen' && Object.keys(ent.alleEntscheidungen()).length===1,'Entscheidung überschreibbar, nicht doppelt');
speicher['chefing_korrelationen_v1']='[[';
ok(JSON.stringify(ent.alleEntscheidungen())==='{}','Entscheidungen: kaputtes JSON → leer');
leeren(); modus='gesperrt';
geworfen=false; try { ent.entscheidungSetzen('a','bestaetigt'); ent.alleEntscheidungen(); } catch { geworfen=true; }
ok(!geworfen,'Entscheidungen: gesperrter Speicher → kein Fehler');
leeren();

// --- Korrelationssuche -------------------------------------------------------------------------------------
const ingredients={
  milch:{label:'Milch',saeure:false,aggregat:'fluessig'},
  buttermilch:{label:'Buttermilch',saeure:true,aggregat:'fluessig'},
  butter:{label:'Butter',saeure:false,aggregat:'fest'},
  oel:{label:'Öl',saeure:false,aggregat:'fluessig'},
  mehl:{label:'Mehl',saeure:false,aggregat:'pulver'},
};
const rez=(fl,fett,bpTrieb,wasser,id)=>({
  id,
  zutaten:[{rolle:'fluessigkeit',zutat:fl,menge:100},{rolle:'fett',zutat:fett,menge:100},{rolle:'struktur',zutat:'mehl',menge:200}],
  bp:{struktur:100,fluessigkeit:50,fett:50,trieb:bpTrieb},
  bilanz:{bp:{wasser}},
});
const rollen=['struktur','fluessigkeit','fett','trieb'];
// 6 saure Rezepte mit weniger Trieb (2) und mehr Wasser (120), 6 neutrale mit mehr Trieb (4) und wenig Wasser (80)
const korpus=[
  ...[1,2,3,4,5,6].map((i)=>rez('buttermilch','butter',2,120,'s'+i)),
  ...[1,2,3,4,5,6].map((i)=>rez('milch','butter',4,80,'n'+i)),
];
let kand=korrelationenSuchen(korpus,ingredients,{rollen});
const trieb=kand.find((c)=>c.bRolle==='fluessigkeit' && c.eigenschaft==='saeure' && c.zRolle==='trieb');
ok(!!trieb && trieb.wert===true && trieb.medianMit===2 && trieb.medianOhne===4 && trieb.nMit===6 && trieb.nOhne===6,'Kandidat gefunden: saure Flüssigkeit → Trieb (Median 2 vs. 4, n 6 : 6)');
ok(trieb.faktor===0.5 && near(trieb.unterschied,0.5) && trieb.belastbar===true,'Faktor 0,5, Unterschied 50 %, belastbar (n ≥ 5 je Gruppe)');
const wasser=kand.find((c)=>c.zRolle==='bilanz:wasser' && c.eigenschaft==='saeure');
ok(!!wasser && wasser.medianMit===120 && wasser.medianOhne===80,'Bilanz-Größen sind Ziele (Präfix „bilanz:“): saure Flüssigkeit → Gesamtwasser');
ok(!kand.some((c)=>c.eigenschaft==='saeure' && c.wert===false),'Boolesche Eigenschaft: Spiegel-Richtung (wert = false) wird nicht doppelt gemeldet');
ok(!kand.some((c)=>c.zRolle===c.bRolle),'Ziel ist nie die Bedingungsrolle selbst');
ok(!kand.some((c)=>c.bRolle==='struktur' || c.bRolle==='fett'),'ohne Varianz (alle Butter, alle Mehl) keine Kandidaten');
function near(a,b){return Math.abs(a-b)<1e-9;}

// Sortierung: belastbare zuerst, dann nach Unterschied — Daten so gewählt, dass ein unbelastbarer Kandidat
// (2 Öl-Rezepte mit Trieb 12) den größten Unterschied hat; sonst prüft der Test die Reihenfolge nicht.
const gemischt=[...korpus,...[1,2].map((i)=>rez('milch','oel',12,80,'o'+i))];
kand=korrelationenSuchen(gemischt,ingredients,{rollen});
const erstesUnbelastbar=kand.findIndex((c)=>!c.belastbar);
const groesster=[...kand].sort((a,b)=>b.unterschied-a.unterschied)[0];
ok(!groesster.belastbar && erstesUnbelastbar>0,'Voraussetzung: der Kandidat mit dem größten Unterschied ist unbelastbar (Fett fest/flüssig bei 2 Öl-Rezepten)');
ok(kand.slice(0,erstesUnbelastbar).every((c)=>c.belastbar) && kand.slice(erstesUnbelastbar).every((c)=>!c.belastbar),'Sortierung: alle belastbaren Kandidaten vor allen unbelastbaren, trotz kleinerem Unterschied');
ok(kand.some((c)=>c.bRolle==='fett' && c.eigenschaft==='aggregat' && !c.belastbar),'unbelastbare Kandidaten bleiben sichtbar (nicht ausgeblendet)');
let absteigend=true; for (let i=1;i<kand.length;i++) if(kand[i-1].belastbar===kand[i].belastbar && kand[i-1].unterschied<kand[i].unterschied) absteigend=false;
ok(absteigend,'Sortierung innerhalb der Gruppen absteigend nach Unterschied');

// Schwellen
ok(korrelationenSuchen(korpus,ingredients,{rollen,minUnterschied:0.9}).length===0,'minUnterschied 0,9: kein Kandidat');
const klein=korpus.slice(3,10); // 3 saure + 4 neutrale
const kk=korrelationenSuchen(klein,ingredients,{rollen});
ok(kk.some((c)=>c.eigenschaft==='saeure' && c.zRolle==='trieb'),'kleiner Korpus (3 : 4): Kandidat bleibt sichtbar');
ok(kk.length>0 && kk.every((c)=>!c.belastbar),'kleiner Korpus: nichts als belastbar ausgewiesen');
ok(korrelationenSuchen(korpus.slice(0,7),ingredients,{rollen}).length===0,'nur ein Rezept in einer Gruppe (< minN): kein Kandidat');
ok(korrelationenSuchen(korpus,ingredients,{rollen,minN:7}).length===0,'minN höher als jede Gruppe: kein Kandidat');
const gleich=[...korpus].map((r)=>({...r,bp:{...r.bp,trieb:3},bilanz:{bp:{wasser:100}}}));
ok(korrelationenSuchen(gleich,ingredients,{rollen}).filter((c)=>c.zRolle==='trieb' || c.zRolle==='bilanz:wasser').length===0,'kein Unterschied zwischen den Gruppen → kein Kandidat');
ok(korrelationenSuchen([],ingredients,{rollen}).length===0,'leerer Korpus: keine Kandidaten, kein Fehler');

console.log(fail?fail+' FAIL':'ALL PASS');
