// T41 (Funktions-Sicht): woher kommt eine Bilanz-Größe? Rollen bleiben Slots, die Herkunft zeigt, was jede Rolle an Funktion liefert.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { beitraege } = await import(P+'model/bilanz.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { herkunftText } = await import(P+'ui/recipeCard.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const ing=J('ingredients');
const p=(rolle,zutat,gramm)=>({rolle,zutat,gramm});

// --- Funktion ---------------------------------------------------------------------------------------------------------------
let b=beitraege([p('struktur','weizenmehl',250),p('bindung','ei',110),p('fluessigkeit','milch',100)],ing,'emulgator');
ok(b.length===1 && b[0].rolle==='bindung' && near(b[0].anteil,1),'Emulgator kommt allein aus der Bindung (Ei), Mehl und Milch liefern keinen');
b=beitraege([p('fluessigkeit','milch',100),p('bindung','ei',110),p('struktur','weizenmehl',250)],ing,'eiweiss');
ok(b.map(x=>x.rolle).join()==='struktur,bindung,fluessigkeit' && b[0].anteil>b[1].anteil,'unabhängig von der Reihenfolge der Zutaten: größte Rolle zuerst');
b=beitraege([p('struktur','weizenmehl',250),p('bindung','ei',110),p('fluessigkeit','milch',100)],ing,'eiweiss');
ok(b.length===3 && near(b.reduce((s,x)=>s+x.anteil,0),1) && b[0].rolle==='struktur' && b[0].anteil>b[1].anteil && b[1].anteil>=b[2].anteil && b.map(x=>x.rolle).join()==='struktur,bindung,fluessigkeit','Eiweiß kommt aus Mehl, Ei und Milch; Anteile summieren sich auf 1, größte zuerst');
b=beitraege([p('struktur','weizenmehl',250),p('bindung','ei',110)],ing,'gluten');
ok(b.length===1 && b[0].rolle==='struktur','Klebereiweiß liefert nur das Mehl');
b=beitraege([p('struktur','weizenmehl',250),p('fluessigkeit','wasser',100),p('einlage','blaubeeren',100)],ing,'wasser');
ok(!b.some(x=>x.rolle==='einlage') && b.length===2,'Wasser der Einlage zählt nicht (außerhalb der Teigmatrix)');
b=beitraege([p('struktur','weizenmehl',250),p('trieb','natron',2),p('einlage','blaubeeren',100)],ing,'saeure');
ok(b.length===1 && b[0].rolle==='einlage' && near(b[0].anteil,1),'die Säure kommt hier allein aus der Einlage (zählt bei Säure mit, T37)');
ok(beitraege([p('struktur','weizenmehl',250)],ing,'natron').length===0 && beitraege([p('struktur','weizenmehl',250)],ing,'gibtsnicht').length===0 && beitraege([],ing,'wasser').length===0,'nichts beigetragen, unbekannte Größe, keine Zutaten: leere Liste');
b=beitraege([p('struktur','weizenmehl',250),p('fluessigkeit','gibtsnicht',100),p('bindung','ei',0),p('fett','butter',-5)],ing,'wasser');
ok(b.length===1 && b[0].rolle==='struktur','unbekannte Zutat, 0 g und negative Menge werden übergangen');
b=beitraege([p('fluessigkeit','milch',100),p('fluessigkeit','buttermilch',100),p('struktur','weizenmehl',100)],ing,'wasser');
ok(b.filter(x=>x.rolle==='fluessigkeit').length===1 && b.find(x=>x.rolle==='fluessigkeit').gramm>150,'mehrere Zeilen derselben Rolle werden zusammengezählt');

// --- Anzeigetext ------------------------------------------------------------------------------------------------------------
ok(herkunftText([{label:'Struktur',anteil:0.854},{label:'Bindung',anteil:0.126},{label:'Flüssigkeit',anteil:0.026}])==='Struktur 85 %, Bindung 13 %' && herkunftText([])==='—' && herkunftText(undefined)==='—' && herkunftText([{label:'A',anteil:0.04}])==='—' && herkunftText([{label:'A',anteil:0.05}])==='A 5 %','Anzeige: Rollen ab 5 % mit gerundetem Prozent, sonst Strich');

// --- Engine -----------------------------------------------------------------------------------------------------------------
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
for (const [ak,vk] of [['ruehrteig','kastenkuchen'],['pfannkuchen','eierkuchen'],['hefeteig','hefezopf']]) {
  const arch=data.archetypes[ak]; const rollen=arch.rollen.map(r=>r.rolle); const referenz=arch.rollen.find(r=>r.referenz)?.rolle??'struktur';
  const ks={}; for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz})),rollen);
  const v=arch.varianten[vk]; const z={}; for (const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
  const c=compute({archetyp:ak,gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z},data,ks);
  const ok1=c.bilanz.every(r=>Array.isArray(r.herkunft) && (r.gramm>0 ? (r.herkunft.length>0 && near(r.herkunft.reduce((s,h)=>s+h.anteil,0),1,1e-9)) : r.herkunft.length===0) && r.herkunft.every(h=>arch.rollen.some(x=>x.rolle===h.rolle && x.label===h.label)));
  ok(ok1,`${vk}: jede Bilanz-Zeile trägt ihre Herkunft (Anteile summieren sich auf 1, ohne Beitrag leer, Rollen-Labels aus archetypes.json)`);
  if (ak==='ruehrteig') {
    const hk=(g)=>c.bilanz.find(x=>x.groesse===g).herkunft;
    ok(hk('emulgator').length===1 && hk('emulgator')[0].rolle==='bindung','Rührkuchen: der Emulgator kommt ganz aus dem Ei (Bindung) — Ei liefert Bindung, Emulgator und Gerüst zugleich');
    ok(hk('gluten').length===1 && hk('gluten')[0].rolle==='struktur' && hk('eiweiss').some(h=>h.rolle==='bindung') && hk('eiweiss').some(h=>h.rolle==='struktur'),'Gerüst-Eiweiß: Klebereiweiß aus dem Mehl, Gesamteiweiß zusätzlich aus dem Ei');
    ok(hk('wasser').length>=3 && hk('fett').some(h=>h.rolle==='fett') && hk('zucker')[0].rolle==='suesse','Wasser aus mindestens drei Rollen, Fett vor allem aus dem Fett, Zucker aus der Süße');
  }
}

console.log(fail?fail+' FAIL':'ALL PASS');
