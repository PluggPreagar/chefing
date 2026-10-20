import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute, varianteFuerGefaess } = await import(P+'model/engine.js');
const { grenzenPruefen, grenzenFuer } = await import(P+'model/bilanz.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const arch=data.archetypes.pfannkuchen;
const rollen=arch.rollen.map(r=>r.rolle);
const norm={}, ks={};
for (const [k,v] of Object.entries(arch.varianten)) { norm[k]=J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})); ks[k]=stats(norm[k],rollen); }
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(vk, over={}){const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'pfannkuchen',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}

// Korpus: jede Quelle liegt innerhalb der eigenen Grenzen (sonst wären die Grenzen falsch kalibriert)
const grenzen=data.grenzen.archetypen.pfannkuchen;
for (const [k,list] of Object.entries(norm)) {
  const verletzt=list.map(r=>{const v=grenzenPruefen(r.bilanz,grenzenFuer(grenzen,{methode:r.methode,techniken:r.techniken||[]}));return [r.id,[...v.hart,...v.empfohlen].map(x=>x.id)];}).filter(([,ids])=>ids.length);
  ok(list.length>=6 && verletzt.length===0,`Korpus ${k}: ${list.length} Rezepte, alle innerhalb der Grenzen${verletzt.length?' — '+JSON.stringify(verletzt):''}`);
  ok(list.every(r=>r.unbekannt.length===0),`Korpus ${k}: keine unbekannten Zutaten/Einheiten`);
}

// Presets rechnen gültig, richtige Methode, Pfanne statt Ofen
for (const [vk,erwartet] of [['eierkuchen','pfannkuchen_glatt'],['pancakes','pancake_kurz']]) {
  const c=compute(st(vk),data,ks);
  ok(c.status!=='invalid' && c.methodKey===erwartet,`${vk}: gültig, Methode ${c.methodKey}`);
  ok(c.varianteLabel===arch.varianten[vk].label && c.backen.tempOU===null && c.backen.hitze && c.backen.minutenLabel==='Min. je Seite',`${vk}: Pfanne (keine Ofen-Temperatur), „${c.backen.hitze}“, ${c.backen.minuten} ${c.backen.minutenLabel}`);
  ok(c.zutatenListe.length>=4 && Math.round(c.teigmasse)===arch.gefaesse.map(g=>data.vessels[g]).find(v=>v===data.vessels[arch.varianten[vk].gefaess]).teigmasse_g,`${vk}: ${c.zutatenListe.length} Zutatenzeilen, Teigmasse ${Math.round(c.teigmasse)} g`);
  ok([...c.warnungen,...c.gruende].length===0,`${vk}: Preset ohne Meldung${[...c.warnungen,...c.gruende].length?': '+[...c.warnungen,...c.gruende].join(' | '):''}`);
  ok(c.ablauf.length>=3 && c.ablauf.at(-1).key==='ausbacken',`${vk}: Ablauf endet mit Ausbacken (${c.ablauf.map(s=>s.key).join(' → ')})`);
}
ok(varianteFuerGefaess('pfanne_24',arch,data.vessels)==='eierkuchen' && varianteFuerGefaess('pfanne_pancake',arch,data.vessels)==='pancakes','zwei Varianten mit gleicher Gefäß-Familie werden über das Gefäß unterschieden');

// Pancake-Ablauf: Trockenes ∥ Nasses, dann kurz verrühren
const pc=compute(st('pancakes'),data,ks);
const a=Object.fromEntries(pc.ablauf.map(s=>[s.key,s]));
ok(a.pc_trocken_mischen.ebene===0 && a.pc_nass_verquirlen.ebene===0 && a.pc_kurz_verruehren.ebene===1,'Pancakes: Trockenes und Nasses parallel (Ebene 0), dann Verrühren (Ebene 1)');

// Grenzen wirken: Wasser zu knapp / Zucker zu viel
let c=compute(st('eierkuchen',{fluessigkeit:E('milch'),struktur:E('weizenmehl')}),data,ks);
ok(c.bilanz.find(b=>b.groesse==='wasser').bp>200,'Eierkuchen: Wasser > 200 % (Gießteig)');
// Natron ohne Säure ist auch beim Ausbacken blockiert, mit Buttermilch-Vorschlag
c=compute(st('pancakes',{trieb:E('natron')}),data,ks);
ok(c.status==='invalid' && c.blockaden.some(b=>b.id==='natron_braucht_saeure') && c.kaskaden.some(k=>k.zutat==='buttermilch'),'Pancakes + Natron ohne Säure: blockiert, Vorschlag Buttermilch');
c=compute(st('pancakes',{trieb:E('natron'),fluessigkeit:E('buttermilch')}),data,ks);
ok(c.status!=='invalid','Pancakes + Natron + Buttermilch: gültig');
// Einlage unterheben erscheint nur mit Einlage
c=compute(st('pancakes',{einlage:E('blaubeeren')}),data,ks);
ok(c.ablauf.some(s=>s.key==='einlage_unterheben'),'Pancakes + Blaubeeren: Einlage-Schritt vorhanden');
console.log(fail?fail+' FAIL':'ALL PASS');
