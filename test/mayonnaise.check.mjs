// T78/DR-054: Mayonnaise als eigener Archetyp — Emulsion ohne Hitze, Bezug Öl, zwei Methoden, Wasser-Grenzen
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { grenzenPruefen } = await import(P+'model/bilanz.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const arch=data.archetypes.mayonnaise, rollen=arch.rollen.map(r=>r.rolle);
const norm=J('corpus/mayonnaise').map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'fett'}));
const ks={mayonnaise:stats(norm,rollen)};
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v=arch.varianten.mayonnaise;
const st=(methode,over={},mengen={})=>{const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]??r.default); Object.assign(z,over); return {archetyp:'mayonnaise',gefaess:v.gefaess,methode,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken:{},mengen};};
const rechne=(...a)=>compute(st(...a),{...data,arch},ks);

ok(norm.length>=12 && ks.mayonnaise.methoden.mayo_hand>=4 && ks.mayonnaise.methoden.mayo_stab>=4,`Korpus: ${norm.length} Rezepte, von Hand ${ks.mayonnaise.methoden.mayo_hand}, Pürierstab ${ks.mayonnaise.methoden.mayo_stab}`);
const verletzt=norm.filter(r=>{const x=grenzenPruefen(r.bilanz,data.grenzen.archetypen.mayonnaise);return x.hart.length+x.empfohlen.length;}).map(r=>r.id);
ok(!verletzt.length,'jedes Korpus-Rezept liegt in den Wasser-Grenzen'+(verletzt.length?': '+verletzt.join(', '):''));

let c=rechne(null);
ok(c.status==='ok' && c.bezugLabel==='Öl' && c.backen.ohneHitze && c.gas===null && c.trieb.zeile===null,`Standard: ${c.method.label}, gültig, Prozente vom Öl, ohne Hitze, kein Gas`);
ok(c.zutatenListe.find(z=>z.rolle==='bindung').einheit==='Stk','Eigelb in Stück');
const hand=rechne('mayo_hand');
const em=(c,k)=>c.ablauf.find(s=>s.key===k)?.emulsion;
ok(em(hand,'oel_tropfen').text==='Fett in Wasser, portionsweise' && em(hand,'oel_strahl_mayo').text==='Fett in Wasser, im dünnen Strahl','Von Hand: Öl in Wasser, erst portionsweise, dann im Strahl');
const stab=rechne('mayo_stab');
ok(/am Messer portionsweise/.test(em(stab,'puerieren').text) && !stab.regelIds.some(r=>r.startsWith('emulsion:')) && !stab.anpassungen.some(a=>/schmales, hohes/.test(a)),'Pürierstab im Mixbecher: auf einmal, am Messer portionsweise, keine Warnung (DR-053)');
ok(stab.ablauf.at(-1).ort==='gefaess' && hand.ablauf.at(-1).key==='abfuellen','beide Methoden enden im Glas');

c=rechne(null,{fluessigkeit:[]},{bindung:4});
ok(c.status==='invalid' && c.gruende.some(g=>/Lecithin zu verteilen/.test(g)),'zu wenig Wasser (ohne Säure, wenig Eigelb) → bricht: harte Grenze');
c=rechne(null,{bindung:E('ei')},{bindung:60});
ok(c.status!=='invalid','ganzes Ei mit wenig Öl (Pürierstab-Rezepte) bleibt gültig');

// Menge je Zutat: Pürierstab-Rezepte nehmen oft ganzes Ei — mit Eigelb gewählt zählt der Median der Eigelb-Rezepte
const stk=(c)=>c.zutatenListe.find(z=>z.rolle==='bindung').menge;
const stabGelb=rechne('mayo_stab'), stabEi=rechne('mayo_stab',{bindung:E('ei')});
ok(stk(stabGelb)<=2 && stk(stabEi)<=2,`Pürierstab: ${stk(stabGelb)} Eigelb bzw. ${stk(stabEi)} Ei je Glas (nicht 3 Eigelb aus den Vollei-Rezepten)`);

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
