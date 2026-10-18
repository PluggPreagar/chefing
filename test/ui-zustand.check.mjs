// Oberfläche ohne Browser: Zustands-Patches (src/model/zustand.js), Mengen-Vorschlag/Zurücksetzen in der Rezeptkarte (Mini-DOM), Feedback-Flag
// bei manuellen Mengen, Zusammenfassen gleichartiger Mengen-Vorschläge.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

// --- Mini-DOM: gerade genug für renderRecipe ------------------------------------------------------------------------------------
class Knoten {
  constructor(tag){ this.tag=tag; this.className=''; this.children=[]; this._text=''; this.handler={}; this.attr={}; }
  append(...k){ this.children.push(...k); }
  replaceChildren(){ this.children=[]; }
  addEventListener(ev,fn){ (this.handler[ev]||=[]).push(fn); }
  setAttribute(k,v){ this.attr[k]=v; }
  set textContent(t){ this._text=String(t); }
  get textContent(){ return this._text+this.children.map(c=>c.textContent).join(''); }
  klick(){ for (const f of this.handler.click||[]) f({preventDefault(){}}); }
  // nur `input[name="x"]:checked` — gerade genug für das Rückmeldeformular
  querySelectorAll(sel){ const m=sel.match(/^input\[name="(\w+)"\]:checked$/); if(!m) return []; return alle(this,k=>k.tag==='input' && k.name===m[1] && k.checked===true); }
  querySelector(sel){ return this.querySelectorAll(sel)[0]||null; }
}
globalThis.document={ createElement:(t)=>new Knoten(t) };
const alle=(k,f,aus=[])=>{ if(f(k)) aus.push(k); for(const c of k.children) alle(c,f,aus); return aus; };
const knopf=(wurzel,text)=>alle(wurzel,k=>k.tag==='button' && k.textContent===text);

const Z=await import(P+'model/zustand.js');
const { renderRecipe }=await import(P+'ui/recipeCard.js');
const { compute }=await import(P+'model/engine.js');
const { normalizeRecipe, stats }=await import(P+'model/corpus.js');
const { vorschlaegeZusammenfassen }=await import(P+'model/bilanz.js');
const R=await import(P+'model/rueckmeldung.js');

// --- zustand.js -----------------------------------------------------------------------------------------------------------------
ok(JSON.stringify(Z.alsEintraege(null))==='[]' && JSON.stringify(Z.alsEintraege(undefined))==='[]' && JSON.stringify(Z.alsEintraege('butter'))==='[{"zutat":"butter","anteil":1}]','alsEintraege: leer, einfacher Wert, Liste');
const liste=[{zutat:'a',anteil:0.5},{zutat:'b',anteil:0.5}];
ok(Z.alsEintraege(liste)===liste,'alsEintraege: eine Liste bleibt unverändert');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle); const ks={};
for (const [k,x] of Object.entries(ruehr.varianten)) ks[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr);
const pp=Z.presetPatch(ruehr,'muffin');
ok(pp.gefaess===ruehr.varianten.muffin.gefaess && pp.methode===null && Object.keys(pp.mengen).length===0 && JSON.stringify(pp.fixiert)==='{"rollen":{},"zutaten":{}}' && Object.keys(pp.zutaten).length===rr.length,'Preset-Wechsel: Gefäß, Standard-Methode, alle Rollen belegt; mengen und Fixierungen leer');
const ap=Z.archetypPatch(ruehr,'ruehrteig');
ok(ap.archetyp==='ruehrteig' && Object.keys(ap.mengen).length===0 && Object.keys(ap.zutaten).length===rr.length,'Archetyp-Wechsel: Standard-Zutaten, mengen leer');
ok(JSON.stringify(Z.gefaessPatch('muffinform'))==='{"gefaess":"muffinform","mengen":{}}','Gefäß-Wechsel: neues Gefäß, mengen leer (andere Korpus-Grundlage)');
const alt={mengen:{fluessigkeit:30}};
ok(Object.keys({...alt,...pp}.mengen).length===0 && Object.keys({...alt,...ap}.mengen).length===0 && Object.keys({...alt,...Z.gefaessPatch('x')}.mengen).length===0,'angewendet über den alten Zustand: manuelle Mengen sind in allen drei Fällen weg');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8'), morph=fs.readFileSync(new URL('../src/ui/morphbox.js',import.meta.url),'utf8');
ok(/presetPatch\(/.test(main) && /archetypPatch\(/.test(main) && /gefaessPatch\(/.test(morph) && /mengen: \{\},/.test(main),'main.js und morphbox.js benutzen die Patches (Startzustand: mengen leer)');

// --- Rezeptkarte -----------------------------------------------------------------------------------------------------------------
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v0=ruehr.varianten.kastenkuchen; const basis={}; for (const r of ruehr.rollen) basis[r.rolle]=E(v0.bestof[r.rolle]!==undefined?v0.bestof[r.rolle]:r.default);
const zustand=(mengen)=>({archetyp:'ruehrteig',variante:'kastenkuchen',gefaess:v0.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...basis},mengen});
const rechne=(state)=>compute(state,data,ks);
const zeige=(state,onChange)=>{ const c=rechne(state); const w=new Knoten('div'); renderRecipe(w,c,state,{...data,appVersion:'t'},onChange); return {c,w}; };

let st=zustand({}); let r=zeige(st,()=>{});
ok(knopf(r.w,'Zurücksetzen').length===0 && !/✎/.test(r.w.textContent),'ohne manuelle Menge: kein Zurücksetzen-Hinweis, keine Markierung ✎');
st=zustand({fluessigkeit:2,bindung:10}); let aufrufe=[]; r=zeige(st,(p)=>aufrufe.push(p));
const vs=r.c.mengenVorschlaege.find(x=>x.rolle==='fluessigkeit');
const text=r.w.textContent;
ok(vs && new RegExp(`${r.c.zutatenListe.find(z=>z.rolle==='fluessigkeit').rolleLabel} von 2 % auf ${String(vs.nach).replace('.',',')} % vom Mehl erhöhen`).test(text),'Vorschlag-Text: Rolle, „von“ gerundet, „auf“ Zielwert, Richtung „erhöhen“');
ok(/Korpus-Spanne \d+–\d+ %/.test(text),'Vorschlag nennt die Korpus-Spanne');
const uebernehmen=knopf(r.w,'Übernehmen');
ok(uebernehmen.length>=1,'„Übernehmen“-Knopf vorhanden');
alle(r.w,k=>k.tag==='div' && /note-kaskade/.test(k.className) && /Flüssigkeit/.test(k.textContent) && /Übernehmen/.test(k.textContent)).forEach(d=>knopf(d,'Übernehmen').forEach(b=>b.klick()));
ok(aufrufe.length>=1 && aufrufe[0].mengen && aufrufe[0].mengen.fluessigkeit===vs.nach && aufrufe[0].mengen.bindung===10,'Klick auf „Übernehmen“: onChange mit den bisherigen Mengen plus dem Vorschlagswert (nichts passiert vorher)');
ok(aufrufe.length===1,'genau ein Aufruf (kein stilles Übernehmen beim Rendern)');
ok(/✎ Manuell gesetzte Menge: Bindung 10 %, Flüssigkeit 2 % —/.test(text),'Hinweis zählt die Rollen mit manueller Menge auf (Rollenmenge, nicht Zeilenanteile)');
ok(/✎ manuell gesetzt/.test(text) && alle(r.w,k=>k.tag==='tr').some(t=>/✎/.test(t.textContent)),'Tabelle: ✎ am Bäcker-% der manuellen Zeilen, Fußnote erklärt es');
aufrufe=[]; const zr=knopf(r.w,'Zurücksetzen'); zr.forEach(b=>b.klick());
ok(zr.length===1 && aufrufe.length===1 && Object.keys(aufrufe[0].mengen).length===0,'„Zurücksetzen“: onChange({mengen: {}})');
// manuelle Menge für eine Rolle, die in der Zutatenliste nicht belegt ist, wirkt nicht und erscheint nicht als manuell
st=zustand({einlage:30}); r=zeige(st,()=>{});
ok(r.c.zutatenListe.every(z=>z.bpQuelle!=='manuell') && !/✎ manuell gesetzt/.test(r.w.textContent) && /keine wirksam/.test(r.w.textContent),'manuelle Menge für eine leere Rolle: nichts wirksam, Hinweis sagt es ehrlich („keine wirksam“)');

// --- Feedback: manuelle Mengen ----------------------------------------------------------------------------------------------------
const checkbox=(w)=>alle(w,k=>k.tag==='input' && k.type==='checkbox' && k.name!=='prozess')[0];
st=zustand({}); r=zeige(st,()=>{});
ok(checkbox(r.w).checked===true,'Rückmeldung ohne manuelle Menge: „vorgeschlagene Mengen verwendet“ ist vorangekreuzt');
st=zustand({fluessigkeit:2,bindung:10}); r=zeige(st,()=>{});
ok(checkbox(r.w).checked===false,'Rückmeldung mit manueller Menge: Häkchen standardmäßig aus');
const meldung=R.baueMeldung({state:st,computed:r.c,eingabe:{bewertung:3,kommentar:'',mengenWieVorgeschlagen:true},appVersion:'t'});
ok(meldung.mengenWieVorgeschlagen===false && JSON.stringify([...meldung.kontext.mengenManuell].sort())==='["bindung","fluessigkeit"]','Meldung: bei manuellen Mengen gilt „wie vorgeschlagen“ nie, kontext.mengenManuell nennt die Rollen');
const m0=R.baueMeldung({state:zustand({}),computed:rechne(zustand({})),eingabe:{bewertung:3,kommentar:'',mengenWieVorgeschlagen:true},appVersion:'t'});
ok(m0.mengenWieVorgeschlagen===true && m0.kontext.mengenManuell.length===0,'Meldung ohne manuelle Menge: Flag bleibt, Liste leer');
ok(fs.readFileSync(new URL('../feedback.php',import.meta.url),'utf8').includes("'mengenManuell'") ,'feedback.php kennt kontext.mengenManuell');
// Prozessfehler zum Ankreuzen (T66)
{const boxen=alle(r.w,k=>k.tag==='input' && k.name==='prozess');
 ok(boxen.length===Object.keys(R.PROZESS_FEHLER).length && boxen.every(b=>b.type==='checkbox' && b.checked!==true) && boxen.map(b=>b.value).join()===Object.keys(R.PROZESS_FEHLER).join(),'Formular: ein Ankreuzfeld je Prozessfehler (fünf), alle zunächst nicht angekreuzt, Schlüssel wie im Modell');
 ok(alle(r.w,k=>k.tag==='legend' && /Was lief anders als geplant\? \(optional\)/.test(k.textContent)).length===1 && alle(r.w,k=>k.tag==='span' && /Nach dem Mehl zu lange gerührt/.test(k.textContent)).length===1,'Überschrift „optional“ und Beschriftung in eigenen Worten');
 // Vorschau „Was wird gesendet?“ zeigt die angekreuzten Angaben
 boxen[0].checked=true; boxen[3].checked=true;
 const vorschau=alle(r.w,k=>k.tag==='details' && /rm-vorschau/.test(k.className))[0], pre=alle(vorschau,k=>k.tag==='pre')[0];
 vorschau.open=true; for (const f of vorschau.handler.toggle||[]) f();
 const gesendet=JSON.parse(pre.textContent);
 ok(JSON.stringify(gesendet.prozess)==='["zu_lange_geruehrt","ofen_zu_kalt"]' && /angekreuzte Ablauf-Angaben/.test(vorschau.textContent),'Vorschau zeigt die angekreuzten Angaben (zu lange gerührt, Ofen zu kalt) im Feld prozess; der Hinweistext nennt sie');}

// --- Zusammenfassen -------------------------------------------------------------------------------------------------------------
const ing={ mehl:{label:'Mehl',wasseranteil:0.14}, wasser:{label:'Wasser',wasseranteil:1} };
const posten=[{rolle:'struktur',zutat:'mehl',gramm:100},{rolle:'fluessigkeit',zutat:'wasser',gramm:20}];
const g=(id,extra)=>({id,groesse:'wasser',bezug:{rolle:'struktur'},strenge:'empfohlen',kaskade_ziel:'fluessigkeit',hinweis:'x',quelle:'t',...extra});
const gr=[g('w_min',{min:60}),g('w_max',{max:100})];
const vor=(nach,ids,aus='A')=>({rolle:'fluessigkeit',von:20,nach,ausloeser:aus,weitere:[],grenzIds:ids});
let z=vorschlaegeZusammenfassen([vor(46,['w_min'],'A'),vor(50,['w_min'],'B')],posten,ing,gr,'struktur');
ok(z.length===1 && z[0].nach===50 && z[0].weitere.includes('A') && !z[0].weitere.includes('B'),'zwei Vorschläge in dieselbe Richtung: einer mit dem weitestgehenden Wert, der andere Auslöser wird genannt');
z=vorschlaegeZusammenfassen([vor(46,['w_min']),vor(10,['w_max'])],posten,ing,gr,'struktur');
ok(z.length===2 && z[0].nach===46 && z[1].nach===10,'gegenläufige Vorschläge bleiben getrennt und in Reihenfolge');
z=vorschlaegeZusammenfassen([vor(46,['w_min']),{...vor(5,['x']),rolle:'fett',von:10}],posten,ing,gr,'struktur');
ok(z.length===2 && z[0].rolle==='fluessigkeit' && z[1].rolle==='fett','Vorschläge verschiedener Rollen bleiben unberührt');
const hart=[...gr,g('w_hart',{max:50,strenge:'hart',kaskade_ziel:undefined})];
z=vorschlaegeZusammenfassen([vor(46,['w_min']),vor(50,['w_min'])],posten,ing,hart,'struktur');
ok(z.length===2,'der zusammengefasste Wert würde eine neue harte Grenze verletzen (Wasser 64 % > 50 %): nicht zusammenfassen');
z=vorschlaegeZusammenfassen([vor(46,['w_min']),vor(50,['w_min'])],posten,ing,hart,'struktur',new Set(['w_hart']));
ok(z.length===1,'war die harte Grenze schon vorher verletzt, blockiert sie das Zusammenfassen nicht');
z=vorschlaegeZusammenfassen([vor(46,['w_min']),vor(50,['w_min'])],posten,ing,[g('w_min',{min:80})],'struktur');
ok(z.length===2,'der weitestgehende Wert hält die Grenze selbst nicht (64 % < 80 %): nicht zusammenfassen');
ok(vorschlaegeZusammenfassen([],posten,ing,gr).length===0 && vorschlaegeZusammenfassen([vor(46,['w_min'])],posten,ing,gr).length===1,'leere Liste und ein einzelner Vorschlag bleiben unverändert');

console.log(fail?fail+' FAIL':'ALL PASS');
