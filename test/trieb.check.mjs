// T80/DR-049: Triebquellen — Zeile „Volumen aus …“ und Haltezeit bis zum Erhitzen
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { triebQuellen } = await import(P+'model/trieb.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function rechne(ak, vk, over={}, techniken={}){
  const arch=data.archetypes[ak], v=arch.varianten[vk], rollen=arch.rollen.map(r=>r.rolle);
  const ks={}; for (const [k,x] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen);
  const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default); Object.assign(z,over);
  return compute({archetyp:ak,gefaess:v.gefaess,methode:null,techniken,fixiert:{rollen:{},zutaten:{}},zutaten:z},data,ks);
}
const haelt=(c)=>c.warnungen.filter(w=>/hält nur/.test(w));

let c=rechne('ruehrteig','kastenkuchen');
ok(/Butter-Creme/.test(c.trieb.zeile) && /Backpulver/.test(c.trieb.zeile) && /Dampf/.test(c.trieb.zeile),'Kastenkuchen: Luft in der Butter-Creme + Backpulver + Dampf');
ok(c.trieb.zeile.indexOf('Butter-Creme')<c.trieb.zeile.indexOf('Backpulver'),'Reihenfolge: eingeschlagene Luft vor Gas aus Zutaten');
ok(!haelt(c).length,'Kastenkuchen: keine Haltezeit-Warnung');
c=rechne('ruehrteig','kastenkuchen',{},{eier_getrennt:true});
ok(/Eischnee/.test(c.trieb.zeile) && !haelt(c).length,'Kastenkuchen + Eischnee: Eischnee genannt, direkt vor dem Backen → keine Warnung');

c=rechne('pfannkuchen','eierkuchen');
ok(c.trieb.zeile==='Volumen aus: Dampf (beim Erhitzen; dehnt alle Bläschen aus)','Eierkuchen ohne Trieb: nur Dampf');
c=rechne('pfannkuchen','eierkuchen',{fluessigkeit:E('mineralwasser')});
ok(/Mineralwasser/.test(c.trieb.zeile),'Eierkuchen mit Mineralwasser: Kohlensäure genannt');
ok(haelt(c).length===1 && /30 Min/.test(haelt(c)[0]) && /nach dem Ruhen/.test(haelt(c)[0]),'Eierkuchen mit Mineralwasser: 30 Min. Ruhen → Warnung mit Tipp');
ok(c.regelIds.includes('trieb:mineralwasser'),'Regel-Id trieb:mineralwasser');

c=rechne('pfannkuchen','pancakes',{trieb:E('natron'),fluessigkeit:E('buttermilch')});
ok(/Natron/.test(c.trieb.zeile) && !haelt(c).length,'Pancakes mit Natron + Buttermilch: sofort ausbacken → keine Warnung');

c=rechne('hefeteig','hefezopf');
ok(/Hefe/.test(c.trieb.zeile) && !haelt(c).length,'Hefezopf: Hefe ohne Haltezeit (die Gare ist gewollt)');

// Gas entsteht erst, wenn die Zutat nass wird: trockenes Natron wartet ohne Warnung
const q=data.triebquellen;
const props={trieb:{anteile:[{triebquelle:'natron'}]}};
const schritt=(nr,typ,rollen,nach,aktiv,wirk)=>({nr,typ,aktion:'S'+nr,zutaten:rollen.map(r=>({rolle:r})),nach,aktiv,wirk});
let t=triebQuellen([schritt(1,'mischen',['trieb'],[],1,0),schritt(2,'warten',[],[1],0,30),schritt(3,'mischen',['fluessigkeit'],[2],1,0),schritt(4,'erhitzen',[],[3],1,10)],[],props,q);
ok(!t.warnungen.length,'trocken gemischtes Natron, 30 Min. Pause vor dem Nassen → keine Warnung');
t=triebQuellen([schritt(1,'mischen',['trieb','fluessigkeit'],[],1,0),schritt(2,'warten',[],[1],0,30),schritt(3,'erhitzen',[],[2],1,10)],[],props,q);
ok(t.warnungen.length===1 && t.warnungen[0].id==='trieb:natron','nasses Natron, 30 Min. Pause → Warnung');
ok(triebQuellen([],[],{},undefined).zeile===null,'ohne triebquellen.json: keine Zeile');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
