// T91/DR-061: Springform und quadratische Form — Backzeit nur aus Rezepten derselben Gefäß-Familie, sonst Gefäß-Referenz
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const arch=data.archetypes.ruehrteig, rollen=arch.rollen.map(r=>r.rolle);
const ks=Object.fromEntries(Object.entries(arch.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen)]));
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v=arch.varianten.kastenkuchen;
const rechne=(gefaess,methode=null)=>{const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default); return compute({archetyp:'ruehrteig',gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken:{}},{...data,arch},ks);};

const kasten=rechne('kastenform_25'), spring=rechne('springform_26'), quadrat=rechne('quadratform_20');
ok(kasten.backen.minuten===55 && /Median aus \d+ Rezepten/.test(kasten.backen.hinweise.join(' ')),'Kastenform: Backzeit weiter aus dem Korpus (55 Min.)');
ok(spring.variante==='kastenkuchen' && spring.backen.minuten===50 && spring.backen.tempOU===175 && !/Median aus/.test(spring.backen.hinweise.join(' ')),'Springform 26: Rührkuchen-Mengen, aber eigene Backzeit 50 Min. bei 175 °C (zu wenig Springform-Rezepte im Korpus)');
ok(quadrat.backen.minuten===35 && quadrat.status!=='invalid','quadratische Form 20 × 20: 35 Min., gültig');
ok(Math.round(spring.teigmasse)===950 && Math.round(quadrat.teigmasse)===900,'Teigmasse je Form (950 g bzw. 900 g)');
ok(['creme','ruehroel','schaummasse'].every(m=>data.methods[m].geeignet_fuer.includes('springform') && data.methods[m].geeignet_fuer.includes('quadratform')) && !rechne('springform_26','creme').warnungen.some(w=>/untypisch/.test(w)),'Creme, Rühr-Öl und Schaummasse passen zu Springform und quadratischer Form');
const kastenBack=ks.kastenkuchen.backenListe.filter(b=>/^kastenform/.test(b.gefaess)).map(b=>b.minuten).filter(x=>x!=null).sort((a,b)=>a-b);
ok(ks.kastenkuchen.backenListe.some(b=>b.gefaess==='springform_26') && kasten.backen.minuten===Math.round(kastenBack.length%2?kastenBack[(kastenBack.length-1)/2]:(kastenBack[kastenBack.length/2-1]+kastenBack[kastenBack.length/2])/2),'Springform- und Quadrat-Rezepte im Korpus zählen nicht für die Kasten-Backzeit (nur Kastenform-Rezepte)');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
