// T82/DR-050: Gas-Budget je 100 g Teig bis zum Erhitzen; T72 (A): Eischnee lockert zusätzlich, ersetzt das Backpulver nicht
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { gasBudget } = await import(P+'model/trieb.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function rechne(ak, vk, over={}, techniken={}, mengen={}){
  const arch=data.archetypes[ak], v=arch.varianten[vk], rollen=arch.rollen.map(r=>r.rolle);
  const ks={}; for (const [k,x] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen);
  const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default); Object.assign(z,over);
  return compute({archetyp:ak,gefaess:v.gefaess,methode:null,techniken,mengen,fixiert:{rollen:{},zutaten:{}},zutaten:z},data,ks);
}
const anteil=(c,k)=>c.gas?.anteile.find(a=>a.key===k)?.ml ?? 0;

const kk=rechne('ruehrteig','kastenkuchen');
ok(kk.gas.gesamt>100 && kk.gas.gesamt<300,`Kastenkuchen: ${kk.gas.gesamt} ml Gas je 100 g Teig beim Erhitzen (Größenordnung 100–300)`);
ok(anteil(kk,'luft_fett')>0 && anteil(kk,'backpulver')>0,'Kastenkuchen: Luft aus der Creme + CO₂ aus Backpulver');
ok(/Schätzung, ohne Dampf/.test(kk.gas.zeile),'Zeile ist als Schätzung ohne Dampf gekennzeichnet');
const ks=rechne('ruehrteig','kastenkuchen',{},{eier_getrennt:true});
ok(ks.gas.gesamt>kk.gas.gesamt && anteil(ks,'eischnee')>0,`Eischnee extra: mehr Gas (${ks.gas.gesamt} > ${kk.gas.gesamt})`);
ok(anteil(ks,'backpulver')===anteil(kk,'backpulver'),'Eischnee extra: Backpulver-Anteil bleibt gleich');
ok(ks.anpassungen.some(a=>/zusätzlich zum Backpulver und ersetzt es nicht/.test(a)),'Hinweis: Eischnee ersetzt das Backpulver nicht (T72 A)');
ok(!ks.anpassungen.some(a=>/Eierreicher Teig/.test(a)),'normaler Rührkuchen: kein Hinweis „eierreich“');
const reich=rechne('ruehrteig','kastenkuchen',{fluessigkeit:[]},{eier_getrennt:true},{bindung:160});
ok(reich.anpassungen.some(a=>/Eierreicher Teig/.test(a)),'viele Eier, keine Milch, Eischnee: Hinweis „wenig oder ohne Backpulver“');

const hz=rechne('hefeteig','hefezopf');
ok(anteil(hz,'hefe')>=240 && anteil(hz,'hefe')<=260,`Hefezopf: CO₂ aus Hefe ≈ 200 ml × 1,27 (${anteil(hz,'hefe')})`);
ok(rechne('pfannkuchen','eierkuchen').gas.zeile===null,'Eierkuchen ohne Trieb und Eischnee: keine Gas-Zeile');
const mw=rechne('pfannkuchen','eierkuchen',{fluessigkeit:E('mineralwasser')});
ok(anteil(mw,'mineralwasser')>0 && mw.ablauf.some(s=>s.gas>0),'Eierkuchen mit Mineralwasser: Gas je Schritt im Ablauf');

// Zerfall: Natron nass, 30 Min. Warten bei Halbwertszeit 15 Min. → ein Viertel bleibt
const props={trieb:{anteile:[{triebquelle:'natron',anteilProzent:100}]}};
const schritt=(nr,typ,rollen,nach,aktiv,wirk)=>({nr,typ,aktion:'S'+nr,zutaten:rollen.map(r=>({rolle:r})),nach,aktiv,wirk});
const lauf=(warten)=>gasBudget([schritt(1,'mischen',['trieb','fluessigkeit'],[],1,0),schritt(2,'warten',[],[1],0,warten),schritt(3,'erhitzen',[],[2],1,10)],[],props,data.triebquellen,{gramm:()=>2,teigmasse:200});
const sofort=lauf(0).gesamt, spaet=lauf(30).gesamt;
ok(Math.abs(spaet/sofort-0.25)<0.05,`Natron: nach 30 Min. Warten bleibt ein Viertel (${spaet} von ${sofort})`);
ok(gasBudget([],[],{},{},{gramm:()=>0,teigmasse:100})===null,'ohne _modell: kein Budget');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
