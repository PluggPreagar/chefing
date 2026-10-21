// T92/DR-060: Ausstattung — Schritte nennen Anforderungen, das schnellste vorhandene Werkzeug bestimmt die Handzeit
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { standardAusstattung, werkzeugWahl, vorhanden } = await import(P+'model/ausstattung.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const W=data.werkzeuge;

ok(JSON.stringify(standardAusstattung(W))===JSON.stringify({puerierstab:true,handruehrgeraet:true,kuechenmaschine:false}),'Standard = Alltags-Küche: Pürierstab und Handrührgerät ja, Küchenmaschine nein');
ok(vorhanden(W,{handruehrgeraet:false},'schneebesen') && vorhanden(W,{},'haende'),'Schneebesen und Hände sind immer da');
ok(werkzeugWahl({art:'luft_schlagen',basis:'handruehrgeraet'},W,null).key==='handruehrgeraet' && werkzeugWahl({art:'luft_schlagen',basis:'handruehrgeraet'},W,{handruehrgeraet:false}).faktor===4,'Luft schlagen: Handrührgerät; ohne Gerät Schneebesen ×4');
ok(werkzeugWahl({art:'kneten',basis:'kuechenmaschine'},W,{handruehrgeraet:false}).key==='haende' && werkzeugWahl({art:'kneten',basis:'kuechenmaschine'},W,{handruehrgeraet:false}).faktor===1.5,'Kneten ohne Gerät: von Hand ×1,5');
const alleSchritte=[...Object.values(data.operations), ...Object.values(data.methods).flatMap(m=>(Array.isArray(m.sequenz)?m.sequenz:[]).filter(e=>typeof e==='object')), ...Object.values(data.techniken).filter(t=>t.schritte).flatMap(t=>Object.values(t.schritte))].filter(s=>s?.anforderung);
ok(alleSchritte.length>=5 && alleSchritte.every(s=>W.anforderungen[s.anforderung.art] && W[s.anforderung.basis]?.kann?.[s.anforderung.art]!=null),`${alleSchritte.length} Schritte mit Anforderung, alle mit bekannter Art und Basis-Werkzeug`);

function rechne(ak,vk,{methode=null,techniken={},ausstattung=null,over={}}={}){
  const arch=data.archetypes[ak], rollen=arch.rollen.map(r=>r.rolle), ref=arch.rollen.find(r=>r.referenz)?.rolle;
  const ks=Object.fromEntries(Object.entries(arch.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:ref})),rollen)]));
  const v=arch.varianten[vk]; const z={}; for(const r of arch.rollen) z[r.rolle]=v.bestof[r.rolle]!==undefined?(v.bestof[r.rolle]==null?[]:[{zutat:v.bestof[r.rolle],anteil:1}]):(r.default?[{zutat:r.default,anteil:1}]:[]); Object.assign(z,over);
  return compute({archetyp:ak,gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken,ausstattung},{...data,arch},ks);
}
const schritt=(c,k)=>c.ablauf.find(s=>s.key===k);
let std=rechne('ruehrteig','kastenkuchen',{techniken:{eier_getrennt:true}});
let hand=rechne('ruehrteig','kastenkuchen',{techniken:{eier_getrennt:true},ausstattung:{handruehrgeraet:false}});
ok(schritt(std,'aufschlagen').dauer===4 && schritt(std,'eischnee_schlagen').dauer===4 && !std.anpassungen.some(a=>/so lange/.test(a)),'Standard-Küche: Aufschlagen und Eischnee wie bisher (4 Min.), kein Hinweis');
ok(schritt(hand,'aufschlagen').dauer===16 && schritt(hand,'eischnee_schlagen').dauer===16 && schritt(hand,'aufschlagen').werkzeugWahl.label==='Schneebesen' && hand.anpassungen.filter(a=>/Schneebesen statt Handrührgerät etwa 4× so lange/.test(a)).length===2,'ohne Handrührgerät: beide Schritte mit dem Schneebesen, je 16 Min., mit Hinweis');
ok(hand.zeit.aktiv>std.zeit.aktiv+20,`Handzeit steigt von ${std.zeit.aktiv} auf ${hand.zeit.aktiv} Min.`);
const kn=(a)=>schritt(rechne('hefeteig','weissbrot',{ausstattung:a}),'kneten').dauer;
ok(kn(null)===10 && kn({handruehrgeraet:false})===15 && kn({handruehrgeraet:false,kuechenmaschine:true})===10,'Kneten: 10 Min. mit Gerät oder Maschine, 15 Min. von Hand');
const stab=rechne('mayonnaise','mayonnaise',{methode:'mayo_stab',ausstattung:{puerierstab:false}});
ok(stab.warnungen.some(w=>/braucht einen Pürierstab/.test(w)) && stab.regelIds.includes('ausstattung:puerierstab') && !rechne('mayonnaise','mayonnaise',{methode:'mayo_stab'}).warnungen.some(w=>/Pürierstab/.test(w)),'Pürierstab-Methode ohne Pürierstab: Warnung mit Regel-Id; mit Standard-Küche keine');

// T93/DR-066: Küchenmaschine arbeitet allein (Hände frei); von Hand aufgeschlagen: Hinweis aufs Ergebnis
const km=rechne('ruehrteig','kastenkuchen',{ausstattung:{kuechenmaschine:true}});
ok(schritt(km,'aufschlagen').werkzeugWahl.key==='kuechenmaschine' && schritt(km,'aufschlagen').aktiv===0.5 && schritt(km,'aufschlagen').wirk===4 && schritt(km,'aufschlagen').handgriff==='Küchenmaschine einschalten','Küchenmaschine (gleich schnell wie Handrührgerät) wird bevorzugt: ½ Min. einschalten, 4 Min. Hände frei');
ok(km.zeit.aktiv<std.zeit.aktiv,`Handzeit sinkt mit Küchenmaschine (${std.zeit.aktiv} → ${km.zeit.aktiv} Min.)`);
ok(schritt(rechne('hefeteig','weissbrot',{ausstattung:{kuechenmaschine:true}}),'kneten').aktiv===0.5,'Kneten in der Küchenmaschine: Hände frei');
ok(hand.anpassungen.some(a=>/Butter \+ Zucker aufschlagen: Von Hand aufgeschlagen hält die Butter-Zucker-Creme meist weniger Luft/.test(a)) && !std.anpassungen.some(a=>/weniger Luft/.test(a)),'von Hand cremig aufgeschlagen: Hinweis „weniger Luft, länger schlagen“; mit Gerät kein Hinweis');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
