// DR-064: Soll-Zustände an Zutaten (Butter weich) mit Wegen dorthin; erst ein gewählter Weg wird ein Vorlauf-Schritt
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { planeAblauf } = await import(P+'model/zeit.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen','zustaende'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const arch=data.archetypes.ruehrteig, rollen=arch.rollen.map(r=>r.rolle);
const ks=Object.fromEntries(Object.entries(arch.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen)]));
const v=arch.varianten.kastenkuchen;
const z={}; for(const r of arch.rollen) z[r.rolle]=v.bestof[r.rolle]!==undefined?(v.bestof[r.rolle]==null?[]:[{zutat:v.bestof[r.rolle],anteil:1}]):[{zutat:r.default,anteil:1}];
const rechne=(extra={})=>compute({archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken:{},...extra},{...data,arch},ks);

const W=data.zustaende.weich;
ok(W.anzeige==='weich (18–22 °C)' && W.wege.length===4 && W.wege.every(w=>w.key && w.label && w.dauer_min>0 && w.aktiv_min>0 && w.schritte.length && w.quelle),'Zustand „weich“: 4 Wege mit Dauer, Handzeit, Schritten und Quelle');
ok(W.wege[0].key==='rausstellen' && W.wege.find(w=>w.key==='mikrowelle').risiko,'einfachster Weg zuerst (rausstellen); Mikrowelle mit Risiko-Hinweis');

const std=rechne();
ok(std.methodKey==='creme' && std.status==='ok' && std.zustaende.length===1 && std.zustaende[0].gewaehlt===null && !std.ablauf.some(s=>s.key==='temperieren') && !std.regelIds.length,'Standard: Crememethode bleibt Auto, „ok“, Zustand an der Butter, kein Schritt, keine Regel-Id');
ok(std.zutatenListe.find(x=>x.rolle==='fett').zustand==='weich (18–22 °C)','Zutatenliste: Butter mit Zustand „weich (18–22 °C)“');

const wuerfel=rechne({zustandWege:{fett:'wuerfel'}});
const s=wuerfel.ablauf.find(x=>x.key==='temperieren');
ok(s && s.zustandWeg==='wuerfel' && s.dauer===20 && s.aktiv===1 && s.wirk===20 && /In Würfel schneiden/.test(s.label) && wuerfel.status==='ok' && !wuerfel.regelIds.length,'Weg „Würfel“ gewählt: Schritt im Ablauf (1 Min. Hand + 20 Min. warten), Status bleibt ok, keine Regel-Id');
const p=planeAblauf(wuerfel.ablauf);
ok(p.vorlauf<0 && wuerfel.zeit.vorlauf>=20,`der Schritt läuft im Vorlauf vor dem Start (${wuerfel.zeit.vorlauf} Min.)`);
const mw=rechne({zustandWege:{fett:'mikrowelle'}}).ablauf.find(x=>x.key==='temperieren');
ok(mw && mw.typ==='vorbereitung' && mw.dauer===1 && /Mikrowelle/.test(mw.label),'Weg „Mikrowelle“: kurzer Handgriff ohne Wartezeit');
ok(!rechne({zustandWege:{fett:'gibtsnicht'}}).ablauf.some(x=>x.key==='temperieren'),'unbekannter Weg: kein Schritt');
ok(!rechne({zutatTemperaturen:{fett:'plastisch'}}).zustaende.length,'Butter schon weich angegeben: kein Zustands-Hinweis');
ok(rechne({zutatTemperaturen:{fett:'lauwarm'}}).evals.creme.status==='invalid','Butter lauwarm (zu warm): Crememethode ungültig, „weich werden lassen“ hilft nicht');
const oel=rechne({zutatTemperaturen:{},methode:'ruehroel'});
ok(!oel.zustaende.length,'Rühr-Öl: kein Zustand „weich“ (Schmelzen bleibt eine Vorbereitung)');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
