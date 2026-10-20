// DR-055: Erklär-Skizzen an Schritten — jeder Schlüssel in den Daten hat eine Skizze, die Details zeigen sie
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { SKIZZEN, skizzeHtml } = await import(P+'ui/skizzen.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};

const schritte=[...Object.entries(data.operations).filter(([k])=>!k.startsWith('_')).map(([,o])=>o), ...Object.values(data.methods).flatMap(m=>(Array.isArray(m.sequenz)?m.sequenz:[]).filter(e=>typeof e==='object')), ...Object.values(data.techniken).filter(t=>t.schritte).flatMap(t=>Object.values(t.schritte))];
const genutzt=[...new Set(schritte.map(s=>s.skizze).filter(Boolean))];
ok(genutzt.length>=3 && genutzt.every(k=>SKIZZEN[k]),`${genutzt.length} Skizzen in den Daten, alle vorhanden: ${genutzt.join(', ')}`);
ok(Object.keys(SKIZZEN).every(k=>{const h=skizzeHtml(k); return h.startsWith('<figure') && /<svg viewBox=/.test(h) && /aria-label=/.test(h) && SKIZZEN[k].titel && SKIZZEN[k].legende;}),'jede Skizze rendert als Figur mit SVG, Titel, Legende und aria-label');
ok(skizzeHtml('gibtsnicht')==='','unbekannter Schlüssel: nichts');
ok(Object.values(SKIZZEN).every(s=>!/#[0-9a-f]{3,6}\b/i.test(s.svg())),'Skizzen nutzen nur Farb-Variablen (Hell/Dunkel)');

const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
function rechne(ak,vk,methode,techniken={}){
  const arch=data.archetypes[ak], rollen=arch.rollen.map(r=>r.rolle), ref=arch.rollen.find(r=>r.referenz)?.rolle;
  const ks=Object.fromEntries(Object.entries(arch.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:ref})),rollen)]));
  const v=arch.varianten[vk]; const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);
  return compute({archetyp:ak,gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken},{...data,arch},ks);
}
const stab=rechne('mayonnaise','mayonnaise','mayo_stab');
ok(stab.ablauf.map(s=>s.key).join()==='mayo_becher,oel_einfuellen,puerieren,abfuellen','Pürierstab: Wasserphase einfüllen → Öl einfüllen → pürieren → abfüllen');
const oel=stab.ablauf.find(s=>s.key==='oel_einfuellen');
ok(!oel.emulsion && oel.aktiv===0.5 && oel.wirk===1 && oel.zutaten.map(z=>z.rolle).join()==='fett' && !stab.ablauf[0].zutaten.some(z=>z.rolle==='fett'),'Öl einfüllen: nur schichten (keine Emulsion), ½ Min. Handgriff + 1 Min. absetzen; Öl nicht im ersten Schritt');
ok(stab.ablauf.find(s=>s.key==='puerieren').skizze==='puerierstab' && !stab.regelIds.some(r=>r.startsWith('emulsion:')),'Pürieren trägt die Skizze, keine Emulsions-Warnung');
ok(rechne('mayonnaise','mayonnaise','mayo_hand').ablauf.find(s=>s.key==='oel_tropfen').skizze==='tropfenweise','Von Hand: Skizze „tropfenweise“');
ok(rechne('ruehrteig','kastenkuchen','creme',{eier_getrennt:true}).ablauf.find(s=>s.key==='eischnee_unterheben')?.skizze==='unterheben','Eischnee unterheben (Technik-Schritt): Skizze „unterheben“');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
