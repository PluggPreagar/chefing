// T53: Rückmeldung „hat es geklappt?“ (DR-027) — Meldung, Warteschlange, Auswertung, Regel-ids und der Vertrag
// zwischen Client und PHP-Endpunkt (Meldungen für jedes Preset und jede Methode gegen den echten Endpunkt).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync, execFileSync } from 'child_process';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const R = await import(P+'model/rueckmeldung.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

// localStorage-Stub
const speicher={}; let gesperrt=false;
globalThis.localStorage={ getItem:(k)=>{ if(gesperrt) throw new Error('x'); return k in speicher?speicher[k]:null; }, setItem:(k,v)=>{ if(gesperrt) throw new Error('x'); speicher[k]=String(v); } };
const leeren=()=>{ for(const k of Object.keys(speicher)) delete speicher[k]; gesperrt=false; };

// --- Daten und Hilfen ---------------------------------------------------------------------------------------------
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const ks={};
for (const [ak,arch] of Object.entries(data.archetypes)) { if(ak.startsWith('_')) continue; const rollen=arch.rollen.map(r=>r.rolle); for (const [vk,v] of Object.entries(arch.varianten)) ks[vk]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen})),rollen); }
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
function zustand(ak,vk,methode=null,over={}){const arch=data.archetypes[ak];const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);return {archetyp:ak,gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:{...z,...over}};}
const rechne=(ak,vk,methode,over,k2=ks)=>{const s=zustand(ak,vk,methode,over);return {state:s,computed:compute(s,data,k2)};};
const eingabe={bewertung:4,kommentar:'ging gut auf',mengenWieVorgeschlagen:true};

// --- Meldung ---------------------------------------------------------------------------------------------------------
{const {state,computed}=rechne('hefeteig','weissbrot','hefe_kalt');
 const m=R.baueMeldung({state,computed,eingabe,appVersion:'a1b2c3d'});
 ok(m.v===1 && m.bewertung===4 && m.kommentar==='ging gut auf' && m.mengenWieVorgeschlagen===true && m.app==='a1b2c3d','Meldung: Schema-Version, Wertung, Kommentar, Mengen-Flag, App-Version');
 ok(m.kontext.archetyp==='hefeteig' && m.kontext.variante==='weissbrot' && m.kontext.methode==='hefe_kalt' && m.kontext.gefaess==='brotform_25' && ['ok','prep','invalid'].includes(m.kontext.status),'Kontext: Archetyp, Variante, Methode, Gefäß, Status');
 ok(m.kontext.zutaten.struktur[0].zutat==='weizenmehl' && m.kontext.zutaten.trieb[0].zutat==='hefe_frisch' && Object.values(m.kontext.zutaten).every(l=>l.every(e=>e.zutat&&e.anteil>0)),'Kontext: Zutaten je Rolle mit Anteil (leere Rollen fehlen)');
 ok(typeof m.kontext.rollenBp.trieb==='number' && m.kontext.rollenBp.struktur===100 && Number.isFinite(m.kontext.rollenBp.trieb) && String(m.kontext.rollenBp.trieb).length<=6,'Kontext: Rollen-Bäckerprozent, gerundet');
 ok(m.kontext.gaerung && m.kontext.gaerung.kuehl===true && m.kontext.gaerung.temp===5.5 && m.kontext.gaerung.gare>0 && typeof m.kontext.gaerung.berechnet==='boolean','Kontext: Gärmodell-Werte mit Gär-Temperatur in °C (kalte Führung: 5,5 °C, kuehl = ja)');
 ok(Array.isArray(m.kontext.regelIds) && Array.isArray(m.kontext.warnungen),'Kontext: regelIds und Warnungen als Listen');
 ok(R.baueMeldung({state,computed,eingabe,appVersion:undefined}).app==='lokal' && R.baueMeldung({state,computed,eingabe:{...eingabe,mengenWieVorgeschlagen:'ja'}}).mengenWieVorgeschlagen===false,'App-Version fehlt → „lokal“; Mengen-Flag nur bei echtem true');
 const lang=R.baueMeldung({state,computed,eingabe:{...eingabe,kommentar:'  '+'ä'.repeat(1500)+'  '}});
 ok(lang.kommentar.length===1000 && R.baueMeldung({state,computed,eingabe:{...eingabe,kommentar:'  x  '}}).kommentar==='x','Kommentar: auf 1000 Zeichen gekürzt, Ränder getrimmt');
 const vielWarn={...computed,warnungen:Array.from({length:30},(_,i)=>'W'.repeat(500)+i)};
 const mw=R.baueMeldung({state,computed:vielWarn,eingabe});
 ok(mw.kontext.warnungen.length===12 && mw.kontext.warnungen.every(w=>w.length<=300),'Warnungen: höchstens 12, je 300 Zeichen');
 const ohneGaerung=rechne('ruehrteig','kastenkuchen');
 ok(R.baueMeldung({state:ohneGaerung.state,computed:ohneGaerung.computed,eingabe}).kontext.gaerung===null,'ohne Gärmodell: gaerung = null');
}
ok(R.pruefeEingabe({bewertung:3,kommentar:''})===null && R.pruefeEingabe({bewertung:1,kommentar:'x'})===null && R.pruefeEingabe({bewertung:5})===null,'Eingabe: 1 bis 5 gültig, Kommentar optional');
ok(R.pruefeEingabe({bewertung:null})!==null && R.pruefeEingabe({bewertung:0})!==null && R.pruefeEingabe({bewertung:6})!==null && R.pruefeEingabe({bewertung:3.5})!==null && R.pruefeEingabe({bewertung:'4'})!==null && R.pruefeEingabe({})!==null,'Eingabe: keine, 0, 6, 3,5 und Text werden abgelehnt');
ok(R.pruefeEingabe({bewertung:4,kommentar:'x'.repeat(1001)})!==null,'Eingabe: Kommentar über 1000 Zeichen wird abgelehnt');
ok(R.klasseVon(1)==='nicht' && R.klasseVon(2)==='nicht' && R.klasseVon(3)==='abweichung' && R.klasseVon(4)==='klappt' && R.klasseVon(5)==='klappt','Klassen: 1–2 klappt nicht, 3 mit Abweichung, 4–5 klappt');

// --- Senden und Warteschlange --------------------------------------------------------------------------------------------
// --- Prozessfehler (T66) ---------------------------------------------------------------------------------------------------------
{const KEYS=Object.keys(R.PROZESS_FEHLER); const {state,computed}=rechne('ruehrteig','kastenkuchen',null);
 ok(KEYS.join()==='zu_lange_geruehrt,tuer_frueh_geoeffnet,ofen_zu_heiss,ofen_zu_kalt,zutaten_zu_kalt' && Object.values(R.PROZESS_FEHLER).every(t=>t.length>10 && !/["„“]/.test(t)),'Prozessfehler: fünf Schlüssel mit Anzeigetext in eigenen Worten');
 const ein={bewertung:2,kommentar:'',mengenWieVorgeschlagen:true};
 ok(Array.isArray(R.baueMeldung({state,computed,eingabe:ein,appVersion:'a'}).prozess) && R.baueMeldung({state,computed,eingabe:ein,appVersion:'a'}).prozess.length===0,'ohne Angabe: leere Liste (Feld immer vorhanden)');
 ok(JSON.stringify(R.baueMeldung({state,computed,eingabe:{...ein,prozess:['ofen_zu_heiss','zu_lange_geruehrt','ofen_zu_heiss','gibtsnicht']},appVersion:'a'}).prozess)==='["ofen_zu_heiss","zu_lange_geruehrt"]','unbekannte Schlüssel fallen heraus, doppelte zählen einmal, Reihenfolge bleibt');
 ok(R.baueMeldung({state,computed,eingabe:{...ein,prozess:'ofen_zu_heiss'},appVersion:'a'}).prozess.length===0 && R.baueMeldung({state,computed,eingabe:{...ein,prozess:null},appVersion:'a'}).prozess.length===0,'kein Array (Text, null): leere Liste');
 ok(R.pruefeEingabe({...ein,prozess:['ofen_zu_heiss']})===null && R.pruefeEingabe({...ein,prozess:[]})===null && R.pruefeEingabe(ein)===null && /Ablauf/.test(R.pruefeEingabe({...ein,prozess:['x']})) && /Ablauf/.test(R.pruefeEingabe({...ein,prozess:'ofen_zu_heiss'})),'pruefeEingabe: bekannte Schlüssel, leer und fehlend sind ok; unbekannt oder kein Array wird abgelehnt');
 const mk2=(bew,prozess,extra={})=>({v:1,bewertung:bew,kommentar:'',mengenWieVorgeschlagen:true,prozess,app:'x',kontext:{archetyp:'a',variante:'v',methode:'m',gefaess:'g',status:'ok',zutaten:{},regelIds:[],warnungen:[],korpusN:1,korpusNMethode:null,rollenBp:{},gaerung:null},...extra});
 const a=R.auswerten([mk2(1,['zu_lange_geruehrt']),mk2(2,['zu_lange_geruehrt','ofen_zu_heiss']),mk2(1,['zu_lange_geruehrt']),mk2(5,['ofen_zu_heiss']),mk2(4,[],{}),mk2(1,['zu_lange_geruehrt'],{mengenWieVorgeschlagen:false}),mk2(3,undefined)]);
 const t=Object.fromEntries(a.prozessFehler.map(x=>[x.schluessel,x]));
 ok(t.zu_lange_geruehrt.n===4 && t.zu_lange_geruehrt.nicht===4 && t.zu_lange_geruehrt.urteil==='Kandidat' && t.ofen_zu_heiss.n===2 && t.ofen_zu_heiss.klappt===1 && t.ofen_zu_heiss.nicht===1 && t.ofen_zu_heiss.urteil==='zu wenige','Auswertung: Prozessfehler je Schlüssel gezählt (auch bei eigenen Mengen), ab 3 Meldungen und mindestens der Hälfte Misserfolge ein Kandidat');
 const drittel=R.auswerten([mk2(1,['ofen_zu_kalt']),mk2(5,['ofen_zu_kalt']),mk2(4,['ofen_zu_kalt'])]).prozessFehler[0], haelfte=R.auswerten([mk2(1,['ofen_zu_kalt']),mk2(2,['ofen_zu_kalt']),mk2(5,['ofen_zu_kalt']),mk2(4,['ofen_zu_kalt'])]).prozessFehler[0];
 ok(drittel.n===3 && drittel.nicht===1 && drittel.urteil==='unklar' && haelfte.n===4 && haelfte.nicht===2 && haelfte.urteil==='Kandidat','Schwelle: 1 von 3 Misserfolgen (ein Drittel) bleibt „unklar“, 2 von 4 (die Hälfte) ist Kandidat');
 ok(a.prozessFehler[0].schluessel==='zu_lange_geruehrt' && R.auswerten([]).prozessFehler.length===0 && R.auswerten([mk2(1,['ofen_zu_kalt','ofen_zu_kalt','ofen_zu_kalt'])]).prozessFehler[0].n===1,'sortiert nach Anzahl; leere Eingabe: leer; doppelte Schlüssel in einer Meldung zählen einmal');
}
const meldung=(over={})=>({v:1,bewertung:4,kommentar:'',mengenWieVorgeschlagen:true,app:'x',kontext:{archetyp:'a',variante:'v',methode:'m',gefaess:'g',status:'ok',zutaten:{},regelIds:[],warnungen:[],korpusN:1,korpusNMethode:null,rollenBp:{},gaerung:null},...over});
const antwort=(status,body)=>async()=>({ok:status>=200&&status<300,status,json:async()=>{ if(body===undefined) throw new Error('kein json'); return body; }});
let aufgerufen=[];
const fetchMit=(...folge)=>{let i=0;aufgerufen=[];return async(url,opt)=>{aufgerufen.push({url,opt});const f=folge[Math.min(i++,folge.length-1)];return f();};};
let r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(200,{ok:true,id:'abc123abc123'}))});
ok(r.ok && r.id==='abc123abc123' && aufgerufen[0].url==='./chefing-feedback.php' && aufgerufen[0].opt.method==='POST' && aufgerufen[0].opt.headers['Content-Type']==='application/json' && JSON.parse(aufgerufen[0].opt.body).bewertung===4,'sende: POST mit JSON an ./chefing-feedback.php');
r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(429,{ok:false,fehler:'zu schnell'}))});
ok(!r.ok && r.wiederholen && /zu viele/.test(r.fehler),'429 → später wiederholen (Limit)');
r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(404))});
ok(!r.ok && r.wiederholen && /nicht eingerichtet/.test(r.fehler),'404 (lokale Entwicklung, Endpunkt fehlt) → wiederholen, verständlicher Text');
r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(500,{ok:false}))});
ok(!r.ok && r.wiederholen,'500 → wiederholen');
r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(400,{ok:false,fehler:'bewertung'}))});
ok(!r.ok && !r.wiederholen && /abgelehnt \(bewertung\)/.test(r.fehler),'400 → verwerfen, Grund wird genannt');
r=await R.sende(meldung(),{fetchFn:fetchMit(async()=>{throw new Error('offline');})});
ok(!r.ok && r.wiederholen && /Keine Verbindung/.test(r.fehler),'Netzfehler → wiederholen');
r=await R.sende(meldung(),{fetchFn:fetchMit(antwort(200))});
ok(!r.ok && !r.wiederholen,'200 ohne JSON-Antwort gilt nicht als gesendet');

leeren();
r=await R.meldeErgebnis(meldung(),{fetchFn:fetchMit(antwort(200,{ok:true,id:'i1'}))});
ok(r.ok && R.gesendeteMeldungen().length===1 && R.gesendeteMeldungen()[0].id==='i1' && R.offeneMeldungen().length===0 && R.gesendeteMeldungen()[0].bewertung===4,'gesendet → Eintrag in der Liste „gesendet“, Warteschlange leer');
r=await R.meldeErgebnis(meldung({bewertung:2}),{fetchFn:fetchMit(antwort(429,{ok:false,fehler:'zu schnell'}))});
ok(!r.ok && R.offeneMeldungen().length===1 && R.offeneMeldungen()[0].bewertung===2,'429 → Meldung bleibt in der Warteschlange');
r=await R.meldeErgebnis(meldung({bewertung:1}),{fetchFn:fetchMit(antwort(400,{ok:false,fehler:'kontext'}))});
ok(!r.ok && R.offeneMeldungen().length===1,'400 → nicht in die Warteschlange (würde nie ankommen)');
leeren();
R.merkeOffen(meldung({bewertung:5})); R.merkeOffen(meldung({bewertung:3})); R.merkeOffen(meldung({bewertung:1}));
let n=0; const folge=async()=>{ n++; return n===1?{ok:true,status:200,json:async()=>({ok:true,id:'x1'})}:n===2?{ok:false,status:429,json:async()=>({ok:false,fehler:'zu schnell'})}:{ok:false,status:400,json:async()=>({ok:false,fehler:'bewertung'})}; };
const flush=await R.sendeOffene({fetchFn:folge});
ok(flush.gesendet===1 && flush.uebrig===1 && R.offeneMeldungen().length===1 && R.offeneMeldungen()[0].bewertung===3 && R.gesendeteMeldungen().length===1,'sendeOffene: eine kommt an, eine bleibt (429), eine ungültige fällt weg (400)');
ok((await R.sendeOffene({fetchFn:async()=>{throw new Error('x');}})).uebrig===1,'sendeOffene ohne Verbindung: Meldung bleibt');
leeren(); ok((await R.sendeOffene({fetchFn:async()=>{throw new Error('nie');}})).gesendet===0,'leere Warteschlange: kein Netzzugriff');
leeren(); for (let i=0;i<30;i++) R.merkeOffen(meldung({bewertung:(i%5)+1}));
ok(R.offeneMeldungen().length===20 && R.offeneMeldungen().at(-1).bewertung===((29%5)+1),'Warteschlange hält höchstens 20 Meldungen (die neuesten)');
leeren(); for (let i=0;i<60;i++) R.merkeGesendet(meldung(),'id'+i);
ok(R.gesendeteMeldungen().length===50,'Liste „gesendet“ hält höchstens 50 Einträge');
speicher['chefing_rueckmeldungen_v1']='{kaputt';
ok(R.offeneMeldungen().length===0 && R.gesendeteMeldungen().length===0,'kaputtes JSON im Speicher → leer statt Absturz');
leeren(); gesperrt=true;
let geworfen=false; try { R.merkeOffen(meldung()); R.merkeGesendet(meldung(),'x'); R.offeneMeldungen(); await R.sendeOffene({fetchFn:async()=>{throw new Error('x');}}); } catch { geworfen=true; }
ok(!geworfen,'gesperrter Speicher (privater Modus): kein Fehler'); leeren();

// --- Auswertung (Vierfeldertafel je Regel) -----------------------------------------------------------------------------------
const mk=(bewertung,regelIds,over={})=>meldung({bewertung,kontext:{...meldung().kontext,variante:'weissbrot',methode:'hefe_kalt',regelIds},...over});
const set=[
  ...[5,4,4,5].map(b=>mk(b,['gaerung_modell'])),               // gewarnt, klappte → zu streng?
  ...[1,2,1].map(b=>mk(b,['hf_hefe_band'])),                    // gewarnt, klappte nicht → bestätigt
  ...[4,2].map(b=>mk(b,['zeit:gehen'])),                        // zu wenige
  ...[5,4,1,1].map(b=>mk(b,[],{kontext:{...meldung().kontext,variante:'hefezopf',methode:'hefe_direkt',regelIds:[]}})), // ohne Warnung, 2 von 4 misslungen
  ...[5,5,4].map(b=>mk(b,[])),                                  // ohne Warnung, alles gut
  mk(1,['gaerung_modell'],{mengenWieVorgeschlagen:false}),     // eigene Mengen: zählt nicht
  {...mk(1,['gaerung_modell']),v:2}, {...mk(1,['gaerung_modell']),bewertung:'1'}, null,
];
const A=R.auswerten(set);
const reg=Object.fromEntries(A.regeln.map(x=>[x.id,x]));
ok(A.gesamt===set.length && A.gueltig===4+3+2+4+3 && A.eigeneRezepte.length===1,`Zählung: ${A.gueltig} gültige Meldungen mit vorgeschlagenen Mengen, 1 mit eigenen Mengen, falsche Version/Wertung/null ignoriert`);
ok(reg.gaerung_modell.n===4 && reg.gaerung_modell.klappt===4 && reg.gaerung_modell.urteil==='zu streng?','Warnung gegeben, in 4 von 4 Fällen klappte es → „zu streng?“');
ok(reg.hf_hefe_band.n===3 && reg.hf_hefe_band.nicht===3 && reg.hf_hefe_band.urteil==='bestaetigt','Warnung gegeben, in 3 von 3 Fällen klappte es nicht → „bestätigt“');
ok(reg['zeit:gehen'].n===2 && reg['zeit:gehen'].urteil==='zu wenige','2 Meldungen sind unter der Schwelle (3) → „zu wenige“');
ok(R.auswerten(set,{minN:2}).regeln.find(x=>x.id==='zeit:gehen').urteil!=='zu wenige','Schwelle ist einstellbar (minN)');
ok(A.regeln[0].n>=A.regeln.at(-1).n,'Regeln nach Häufigkeit sortiert');
const gr=Object.fromEntries(A.ohneWarnung.map(x=>[x.gruppe,x]));
ok(gr['hefezopf/hefe_direkt'].n===4 && gr['hefezopf/hefe_direkt'].nicht===2 && gr['hefezopf/hefe_direkt'].urteil==='fehlende Regel?','Rezepte ohne Warnung: 2 von 4 misslungen → „fehlende Regel?“');
ok(gr['weissbrot/hefe_kalt'].urteil==='ok' && A.fehlendeRegel.length===2 && A.fehlendeRegel.every(m=>m.bewertung<=2),'Rezepte ohne Warnung und ohne Misslingen → „ok“; die zwei Misserfolge stehen einzeln da');
const wahl=R.auswerten([mk(3,['x']),mk(3,['x']),mk(3,['x'])]).regeln[0];
ok(wahl.abweichung===3 && wahl.urteil==='unklar','3 Punkte zählen als „mit Abweichung“ (weder klappt noch klappt nicht) → „unklar“');
ok(R.auswerten([]).gesamt===0 && R.auswerten([]).regeln.length===0,'leere Eingabe: leere Auswertung');
// Schwellen genau an den Rändern (4 Meldungen je Regel)
const urteil=(punkte)=>R.auswerten(punkte.map(b=>mk(b,['r']))).regeln[0].urteil;
ok(urteil([5,4,4,1])==='zu streng?' && urteil([5,4,1,3])==='unklar' && urteil([5,4,1,1])==='bestaetigt' && urteil([1,5,4,3])==='unklar',
  'Schwellen: 3 von 4 klappt (75 %) → zu streng?; 2 von 4 klappt → unklar; 2 von 4 klappt nicht (50 %) → bestätigt; 1 von 4 klappt nicht → unklar');
const gruppe=(punkte)=>R.auswerten(punkte.map(b=>mk(b,[]))).ohneWarnung[0].urteil;
ok(gruppe([5,5,1])==='fehlende Regel?' && gruppe([5,5,4,1])==='ok' && gruppe([5,5,1,1])==='fehlende Regel?' && gruppe([5,4,3,1,1,5])==='fehlende Regel?' && gruppe([5,4,3,2,5,5,5,5])==='ok',
  'ohne Warnung: ab 30 % Misserfolge → „fehlende Regel?“ (1 von 3 = ein Drittel zählt, 1 von 4 = 25 % und 1 von 8 nicht)');

// --- Auswertungswerkzeug (tools/rueckmeldungen.mjs) --------------------------------------------------------------------------
{const tmpDatei=path.join(os.tmpdir(),`chefing_fb_${Date.now()}.jsonl`);
 fs.writeFileSync(tmpDatei,[...set.filter(Boolean).map(m=>JSON.stringify({id:'x',empfangen:'2026-10-18T10:00:00+00:00',...m})),'{kaputte zeile','',JSON.stringify({id:'y',...mk(2,[]),kommentar:'Hefeteig blieb dicht\nnach 12 Std.'})].join('\n')+'\n');
 const aus=execFileSync(process.execPath,[new URL('../tools/rueckmeldungen.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),tmpDatei],{encoding:'utf8'});
 fs.rmSync(tmpDatei);
 ok(/1 unlesbare Zeilen übersprungen/.test(aus) && /mit eigenen Mengen/.test(aus),'Werkzeug: unlesbare Zeile wird übersprungen und gemeldet');
 ok(/gaerung_modell\s+4\s+100 %.*zu streng\?/.test(aus) && /hf_hefe_band\s+3\s+0 %.*100 %.*bestaetigt/.test(aus),'Werkzeug: Tabelle je Regel mit Prozenten und Urteil');
 ok(/hefezopf\/hefe_direkt.*fehlende Regel\?/.test(aus) && /Misslungen ohne Warnung \(3\)/.test(aus) && /Hefeteig blieb dicht nach 12 Std\./.test(aus),'Werkzeug: Misserfolge ohne Warnung einzeln mit Kommentar (Zeilenumbruch geglättet)');
 ok(/Kandidaten für neue Korpus-Rezepte/.test(aus),'Werkzeug: Meldungen mit eigenen Mengen als Korpus-Kandidaten');}

// --- Auswertungswerkzeug: Prozessfehler (T66) ---------------------------------------------------------------------------------------
{const tmp=path.join(os.tmpdir(),`chefing_fb_pf_${Date.now()}.jsonl`);
 const mp=(b,prozess)=>JSON.stringify({id:'p',empfangen:'2026-10-18T10:00:00+00:00',...(set.filter(Boolean)[0]),bewertung:b,prozess});
 fs.writeFileSync(tmp,[mp(1,['zu_lange_geruehrt']),mp(2,['zu_lange_geruehrt']),mp(1,['zu_lange_geruehrt']),mp(5,['ofen_zu_heiss'])].join('\n')+'\n');
 const aus=execFileSync(process.execPath,[new URL('../tools/rueckmeldungen.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),tmp],{encoding:'utf8'});
 fs.rmSync(tmp);
 ok(/Angekreuzte Prozessfehler/.test(aus) && /Nach dem Mehl zu lange gerührt\s+3\s+0 %.*100 %\s+Kandidat/.test(aus) && /Ofen war zu heiß\s+1\s+100 %.*zu wenige/.test(aus),'Werkzeug: Abschnitt Prozessfehler mit Anzahl, Prozenten und Urteil (Kandidat ab 3 Meldungen und der Hälfte Misserfolge)');}

// --- Von der Rückmeldung zum Negativ-Korpus (T68) ------------------------------------------------------------------------------------
{const { meldungZuFall } = R;
 const ingr=JSON.parse(fs.readFileSync(new URL('../src/data/ingredients.json',import.meta.url)));
 const bau=(ak,vk,methode,over,eingabe,extra={})=>{const {state,computed}=rechne(ak,vk,methode,over);return {id:'abc123',empfangen:'2026-10-18T10:00:00+00:00',...R.baueMeldung({state,computed,eingabe:{mengenWieVorgeschlagen:true,kommentar:'GEHEIMER KOMMENTAR 0151',...eingabe},appVersion:'t'}),...extra};};
 const m=bau('ruehrteig','kastenkuchen',null,{trieb:E('natron'),fluessigkeit:E('buttermilch')},{bewertung:1,prozess:['zu_lange_geruehrt']});
 const f=meldungZuFall(m,{ingredients:ingr});
 ok(f.id==='rueckmeldung-abc123' && f.entwurf===true && f.archetyp==='ruehrteig' && f.variante===m.kontext.variante && f.ergebnis==='misslungen' && f.verlaesslichkeit===2 && f.mengen_vorhanden===true && f.methode===m.kontext.methode,'Entwurf: id aus der Meldung, entwurf: true, Archetyp, Variante, Methode, misslungen bei 1 Punkt');
 const mehl=f.zutaten.find(z=>z.rolle==='struktur'), natron=f.zutaten.find(z=>z.zutat==='natron');
 ok(mehl.menge===100 && mehl.einheit==='g' && /% vom Mehl in der Rolle struktur/.test(mehl.original) && Math.abs(natron.menge-m.kontext.rollenBp.trieb/(ingr.natron.aequivalent_faktor??1))<0.01 && f.zutaten.some(z=>z.zutat==='buttermilch'),'Gramm aus dem Bäckerprozent: Mehl 100 g, Buttermilch aus ihrer Rolle, Natron zurückgerechnet');
 const mh=meldungZuFall(bau('hefeteig','weissbrot',null,{trieb:E('hefe_trocken')},{bewertung:2}),{ingredients:ingr}), th=mh.zutaten.find(z=>z.zutat==='hefe_trocken'), bph=bau('hefeteig','weissbrot',null,{trieb:E('hefe_trocken')},{bewertung:2}).kontext.rollenBp.trieb;
 ok(ingr.hefe_trocken.aequivalent_faktor!==undefined && ingr.hefe_trocken.aequivalent_faktor!==1 && Math.abs(th.menge-bph/ingr.hefe_trocken.aequivalent_faktor)<0.01 && th.menge!==Math.round(bph*100)/100,'Trockenhefe: Gramm = Bäckerprozent geteilt durch den Äquivalent-Faktor (das Frischhefe-Äquivalent wird zurückgerechnet)');
 ok(f.ursache_art==='prozess' && f.kontrollfall===true && /Nach dem Mehl zu lange gerührt/.test(f.ursache_laut_quelle) && f.mengen_wie_vorgeschlagen===true,'angekreuzter Prozessfehler bei vorgeschlagenen Mengen: Ursache-Art prozess, Kontrollfall, Ursache nennt den Text');
 ok(!JSON.stringify(f).includes('GEHEIMER KOMMENTAR') && !JSON.stringify(f).includes('0151'),'der Kommentar des Nutzers wird nicht übernommen (Datenschutz)');
 const o=meldungZuFall(bau('ruehrteig','kastenkuchen',null,{},{bewertung:3}),{ingredients:ingr});
 ok(o.ergebnis==='teilweise' && o.ursache_art==='offen' && o.kontrollfall===undefined && /noch zu ergänzen/.test(o.ursache_laut_quelle) && /keine Regel hat gewarnt/.test(o.notiz),'3 Punkte ohne Prozessfehler: teilweise, Ursache offen, kein Kontrollfall, Notiz nennt fehlende Warnung');
 const eigen=meldungZuFall(bau('ruehrteig','kastenkuchen',null,{},{bewertung:2,prozess:['ofen_zu_heiss'],mengenWieVorgeschlagen:false}),{ingredients:ingr});
 ok(eigen.ursache_art==='offen' && eigen.kontrollfall===undefined && eigen.mengen_wie_vorgeschlagen===false,'eigene Mengen mit Prozessfehler: kein Kontrollfall (die Mengen sind nicht die vorgeschlagenen)');
 const mitWarnung=meldungZuFall({...bau('ruehrteig','kastenkuchen',null,{trieb:E('natron')},{bewertung:1}),id:undefined},{ingredients:ingr});
 ok(mitWarnung.id==='rueckmeldung-ohne-id' && /gezeigte Regeln: .*natron_braucht_saeure/.test(mitWarnung.notiz),'ohne id: „ohne-id“; die gezeigten Regeln stehen in der Notiz');
 ok(meldungZuFall(null)===null && meldungZuFall({})===null && meldungZuFall({kontext:{},bewertung:'x'})===null && meldungZuFall({kontext:{zutaten:{},rollenBp:{}},bewertung:1}).zutaten.length===0 && meldungZuFall({kontext:{zutaten:{},rollenBp:{}},bewertung:1}).mengen_vorhanden===false,'keine Meldung, keine Bewertung: null; ohne Zutaten: leere Liste und mengen_vorhanden false');
 const roh=bau('ruehrteig','kastenkuchen',null,{},{bewertung:1}); roh.kontext.rollenBp.aroma=0; roh.kontext.zutaten.einlage=[{zutat:'gibtsnicht',anteil:1}]; roh.kontext.rollenBp.einlage=10;
 const fz=meldungZuFall(roh,{ingredients:ingr});
 ok(!fz.zutaten.some(z=>z.rolle==='aroma') && fz.zutaten.some(z=>z.zutat==='gibtsnicht' && z.menge===10),'Rollen mit 0 % entfallen; eine unbekannte Zutat bleibt (die Prüfung meldet sie als nicht prüfbar)');
 const mix=bau('ruehrteig','kastenkuchen',null,{fett:[{zutat:'butter',anteil:3},{zutat:'pflanzenoel',anteil:1}]},{bewertung:1});
 const fm=meldungZuFall(mix,{ingredients:ingr}), fb=fm.zutaten.find(z=>z.zutat==='butter'), fo=fm.zutaten.find(z=>z.zutat==='pflanzenoel');
 ok(Math.abs(fb.menge/fo.menge-3)<0.05 && Math.abs(fb.menge+fo.menge-mix.kontext.rollenBp.fett)<0.05,'Rolle mit zwei Zutaten: Bäckerprozent nach Anteil geteilt (3 : 1)');
 // der Entwurf lässt sich mit dem Negativ-Korpus rechnen
 const {negativPruefen}=await import(P+'model/negativ.js');
 const korpora={}; for (const [ak,a] of Object.entries(data.archetypes)) { if(ak.startsWith('_')) continue; korpora[ak]={}; for (const [vk,x] of Object.entries(a.varianten)) korpora[ak][vk]=JSON.parse(fs.readFileSync(new URL('../src/data/corpus/'+x.korpus+'.json',import.meta.url))); }
 const lauf=negativPruefen({faelle:[f,{...o,id:'rueckmeldung-offen'}],archetypes:data.archetypes,ingredients:data.ingredients,grenzen:data.grenzen,modelle:data.modelle,korpora,methods:data.methods,operations:data.operations,temperaturen:data.temperaturen});
 ok(lauf.faelle.length===2 && lauf.faelle.every(x=>x.geprueft===true && x.unbekannt.length===0),'Entwürfe laufen durch negativPruefen (geprüft, keine unbekannten Zutaten)');
 ok(lauf.faelle.find(x=>x.id===f.id).kontrolle===true && lauf.faelle.find(x=>x.id==='rueckmeldung-offen').kontrolle===false,'der Prozess-Entwurf zählt als Kontrollfall, der offene als Misserfolg');
 // Werkzeug
 const tmp=path.join(os.tmpdir(),`chefing_fb_zf_${Date.now()}.jsonl`);
 fs.writeFileSync(tmp,[JSON.stringify(m),JSON.stringify(bau('ruehrteig','kastenkuchen',null,{},{bewertung:5})),JSON.stringify(bau('ruehrteig','kastenkuchen',null,{},{bewertung:3})),'{kaputt','',JSON.stringify({v:2,bewertung:1})].join('\n')+'\n');
 const tool=new URL('../tools/rueckmeldungen-zu-faellen.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const t1=spawnSync(process.execPath,[tool,tmp],{encoding:'utf8'}), t2=spawnSync(process.execPath,[tool,tmp,'--alle'],{encoding:'utf8'}), t3=spawnSync(process.execPath,[tool,tmp,'--max-bewertung','5'],{encoding:'utf8'});
 fs.rmSync(tmp);
 const j1=JSON.parse(t1.stdout), j2=JSON.parse(t2.stdout), j3=JSON.parse(t3.stdout);
 ok(t1.status===0 && j1.length===1 && j1[0].id==='rueckmeldung-abc123' && /1 Entwürfe \(bis 2 Punkte\), 3 Meldungen übersprungen, 1 unlesbare Zeilen/.test(t1.stderr),'Werkzeug: Standard nimmt nur Meldungen bis 2 Punkte; 5 Punkte, falsche Version und unlesbare Zeilen werden übersprungen und gemeldet');
 ok(j2.length===2 && j3.length===3,'--alle nimmt 3 Punkte mit, --max-bewertung 5 alle gültigen Meldungen');
 ok(spawnSync(process.execPath,[tool],{encoding:'utf8'}).status===1,'ohne Datei: Aufruf-Hinweis und Fehlercode 1');
}

// --- Regel-ids der Engine --------------------------------------------------------------------------------------------------
const ids=(c)=>c.regelIds;
ok(ids(rechne('hefeteig','weissbrot',null).computed).length===0 && ids(rechne('ruehrteig','kastenkuchen',null).computed).length===0 && ids(rechne('pfannkuchen','eierkuchen',null).computed).length===0,'saubere Presets: keine Regel hat etwas gesagt (regelIds leer)');
ok(ids(rechne('ruehrteig','kastenkuchen',null,{trieb:E('natron')}).computed).includes('natron_braucht_saeure'),'Natron ohne Säure: regelIds nennt natron_braucht_saeure');
ok(ids(rechne('ruehrteig','kastenkuchen',null,{fett:E('butter'),suesse:E('zucker'),struktur:E('speisestaerke')}).computed).some(x=>/gluten|eiweiss/.test(x)),'Stärke statt Mehl: eine Gluten-/Eiweiß-Grenze steht in regelIds');
ok(ids(rechne('ruehrteig','kastenkuchen','creme',{fett:E('pflanzenoel')}).computed).includes('fett_muss_fest_fuer_aufschlagen'),'Öl mit Crememethode: Blockade-id steht in regelIds');
ok(!ids(rechne('ruehrteig','kastenkuchen','ruehroel').computed).some(i=>/^prep:/.test(i)),'Schmelzen ist ein Zustand an der Zutat (DR-064): keine prep-Regel-Id');
ok(ids(rechne('ruehrteig','muffin','muffin').computed).includes('toleranz:zucker'),'Korpus-Hinweis „untypisch“: toleranz:zucker');
{const k2={...ks,weissbrot:{...ks.weissbrot,proMethode:{...ks.weissbrot.proMethode,hefe_noknead:{...ks.weissbrot.proMethode.hefe_noknead,bp:{...ks.weissbrot.proMethode.hefe_noknead.bp,trieb:{...ks.weissbrot.proMethode.hefe_noknead.bp.trieb,median:12}}}}}};
 const c=rechne('hefeteig','weissbrot','hefe_noknead',{},k2).computed;
 ok(ids(c).includes('gaerung_modell') && ids(c).length===new Set(ids(c)).size,'12 % Hefe bei langer Gare: gaerung_modell, ohne Doppelte');}
{const k2={...ks,weissbrot:{...ks.weissbrot,proMethode:Object.fromEntries(Object.entries(ks.weissbrot.proMethode).filter(([k])=>k!=='hefe_kalt'))}};
 ok(ids(rechne('hefeteig','weissbrot','hefe_kalt',{},k2).computed).includes('gaerung_berechnet'),'Hefe aus der Gärzeit gerechnet: gaerung_berechnet');}
{const s=zustand('hefeteig','weissbrot','hefe_direkt'); const d2={...data,methods:{...data.methods,hefe_direkt:{...data.methods.hefe_direkt,zeiten:{gehen:600}}}};
 const c=compute(s,d2,ks);
 ok(ids(c).includes('zeit:gehen') && c.warnungen.some(w=>/Fenster/.test(w)),'Wert außerhalb des Zeit-Fensters (Gehen 10 Std. direkt): zeit:gehen steht in regelIds');}

// --- Vertrag Client ↔ PHP --------------------------------------------------------------------------------------------------
function findePhp(){ for (const k of [process.env.PHP_BIN,'php','D:/_progs/xampp/php/php.exe','C:/xampp/php/php.exe','/usr/bin/php','/usr/local/bin/php']) { if(!k) continue; const t=spawnSync(k,['-v'],{encoding:'utf8'}); if(t.status===0 && /PHP 8\.[1-9]|PHP [9]/.test(t.stdout)) return k; } return null; }
const php=findePhp();
if (!php) console.log('SKIP PHP ab 8.1 nicht gefunden — Vertrags- und HTTP-Test übersprungen (PHP_BIN setzen)');
else {
  const alle=[];
  for (const [ak,arch] of Object.entries(data.archetypes)) { if(ak.startsWith('_')) continue; for (const vk of Object.keys(arch.varianten)) for (const meth of [null,...arch.methoden]) { const {state,computed}=rechne(ak,vk,meth); alle.push({id:`${vk}/${meth}`,m:R.baueMeldung({state,computed,eingabe:{bewertung:1+alle.length%5,kommentar:'Test ä ö ü ß — „Zitat“',mengenWieVorgeschlagen:alle.length%2===0},appVersion:'a1b2c3d'})}); } }
  // schwierige Fälle: Warnungen, Blockaden, Backpulver im Hefeteig, Gärmodell berechnet
  const {state:sb,computed:cb}=rechne('ruehrteig','kastenkuchen','creme',{fett:E('pflanzenoel'),trieb:E('natron')});
  alle.push({id:'blockiert',m:R.baueMeldung({state:sb,computed:cb,eingabe,appVersion:undefined})});
  const sbp=rechne('hefeteig','weissbrot','hefe_kalt',{trieb:E('backpulver')});
  alle.push({id:'backpulver im Hefeteig',m:R.baueMeldung({state:sbp.state,computed:sbp.computed,eingabe})});
  const antwortenPhp=JSON.parse(execFileSync(php,[path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'feedback-pruefen.php')],{input:JSON.stringify(alle.map(x=>x.m)),encoding:'utf8'}));
  const abgelehnt=alle.map((x,i)=>[x.id,antwortenPhp[i]]).filter(([,a])=>a[0]!==200).map(([id,a])=>`${id}: ${a[0]} ${a[1].fehler}`);
  const erwarteteAnzahl=Object.entries(data.archetypes).filter(([k])=>!k.startsWith('_')).reduce((s,[,a])=>s+Object.keys(a.varianten).length*(a.methoden.length+1),0)+2;
  ok(alle.length===erwarteteAnzahl && erwarteteAnzahl>=33 && abgelehnt.length===0,`Vertrag: der echte Endpunkt nimmt alle ${alle.length} vom Client gebauten Meldungen an (jedes Preset × jede Methode, dazu Blockade und Backpulver)${abgelehnt.length?' — abgelehnt: '+abgelehnt.join(' | '):''}`);

  // echter HTTP-Test mit dem PHP-Entwicklungsserver
  const doc=fs.mkdtempSync(path.join(os.tmpdir(),'chefing_http_'));
  fs.copyFileSync(new URL('../chefing-feedback.php',import.meta.url),path.join(doc,'chefing-feedback.php'));
  // Zufälliger Port und Startzeit schwanken (belegter Port, ausgelastete Maschine): bis zu drei Versuche mit neuem Port, je bis zu 8 s warten
  let port, server, basis, bereit=false;
  for (let versuch=0; versuch<3 && !bereit; versuch++) {
    port=24000+Math.floor(Math.random()*5000);
    server=spawn(php,['-S',`127.0.0.1:${port}`,'-t',doc],{stdio:'ignore'});
    basis=`http://127.0.0.1:${port}/chefing-feedback.php`;
    for (let i=0;i<80 && !bereit;i++) { try { await fetch(basis,{method:'GET'}); bereit=true; } catch { await new Promise(r=>setTimeout(r,100)); } }
    if (!bereit) server.kill();
  }
  try {
    ok(bereit,'PHP-Entwicklungsserver läuft');
    const post=(body,header={})=>fetch(basis,{method:'POST',headers:{'Content-Type':'application/json',...header},body:typeof body==='string'?body:JSON.stringify(body)});
    let a=await post(alle[0].m);
    const j=await a.json();
    ok(a.status===200 && j.ok===true && /^[0-9a-f]{12}$/.test(j.id) && /application\/json/.test(a.headers.get('content-type')) && a.headers.get('cache-control')==='no-store' && a.headers.get('x-content-type-options')==='nosniff','HTTP: 200, JSON-Antwort mit id, Cache-Control: no-store, nosniff');
    const zeilen=fs.readFileSync(path.join(doc,'feedback-data','feedback.jsonl'),'utf8').trim().split('\n');
    ok(zeilen.length===1 && JSON.parse(zeilen[0]).id===j.id,'HTTP: Meldung steht als eine Zeile in feedback-data/feedback.jsonl');
    ok(fs.existsSync(path.join(doc,'feedback-data','.htaccess')),'HTTP: feedback-data/.htaccess wurde angelegt');
    a=await fetch(basis,{method:'GET'}); ok(a.status===405 && a.headers.get('allow')==='POST','HTTP: GET → 405 mit Allow: POST');
    a=await post('{kaputt'); ok(a.status===400,'HTTP: kaputtes JSON → 400');
    a=await fetch(basis,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(alle[0].m)}); ok(a.status===415,'HTTP: Content-Type text/plain → 415');
    a=await post(alle[0].m,{Origin:'https://boese.example'}); ok(a.status===403,'HTTP: fremde Origin → 403');
    a=await post(alle[0].m,{Origin:`http://127.0.0.1:${port}`}); ok(a.status===200,'HTTP: eigene Origin → 200');
    a=await post('x'.repeat(20000)); ok(a.status===413,'HTTP: über 16 KB → 413');
    // bis zum 15-Minuten-Limit (30): bisher 2 angenommen
    let angenommen=2, ersterFehler=null;
    for (let i=0;i<40;i++) { const x=await post(alle[1].m); if(x.status===200) angenommen++; else { ersterFehler=x; break; } }
    ok(angenommen===30 && ersterFehler?.status===429 && ersterFehler.headers.get('retry-after')==='900' && (await ersterFehler.json()).fehler==='zu schnell',`HTTP: nach ${angenommen} Meldungen 429 „zu schnell“ mit Retry-After: 900`);
    ok(fs.readFileSync(path.join(doc,'feedback-data','feedback.jsonl'),'utf8').trim().split('\n').length===30,'HTTP: abgelehnte Meldungen wurden nicht gespeichert');
  } finally { server.kill(); fs.rmSync(doc,{recursive:true,force:true}); }
}

console.log(fail?fail+' FAIL':'ALL PASS');
