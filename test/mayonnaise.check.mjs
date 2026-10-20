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

ok(norm.length>=12 && ks.mayonnaise.methoden.mayo_hand>=4 && ks.mayonnaise.methoden.mayo_stab>=4 && ks.mayonnaise.methoden.mayo_stab_einlaufen===3,`Korpus: ${norm.length} Rezepte, von Hand ${ks.mayonnaise.methoden.mayo_hand}, Pürierstab ${ks.mayonnaise.methoden.mayo_stab}, Öl einlaufen ${ks.mayonnaise.methoden.mayo_stab_einlaufen}`);
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
// T86: Pürierstab mit Öl im Strahl — Öl kommt erst beim Pürieren dazu
const ein=rechne('mayo_stab_einlaufen');
ok(ein.ablauf.map(s=>s.key).join()==='mayo_becher,puerieren_einlaufen,abfuellen' && em(ein,'puerieren_einlaufen').text==='Fett in Wasser, im dünnen Strahl' && !ein.ablauf[0].zutaten.some(z=>z.rolle==='fett') && !ein.regelIds.some(r=>r.startsWith('emulsion:')),'Öl einlaufen: Wasserphase einfüllen → pürieren mit Öl im Strahl → abfüllen, keine Warnung');

c=rechne(null,{fluessigkeit:[]},{bindung:4});
ok(c.status==='invalid' && c.gruende.some(g=>/Lecithin zu verteilen/.test(g)),'zu wenig Wasser (ohne Säure, wenig Eigelb) → bricht: harte Grenze');
c=rechne(null,{bindung:E('ei')},{bindung:60});
ok(c.status!=='invalid','ganzes Ei mit wenig Öl (Pürierstab-Rezepte) bleibt gültig');

// Menge je Zutat: Pürierstab-Rezepte nehmen oft ganzes Ei — mit Eigelb gewählt zählt der Median der Eigelb-Rezepte
const stk=(c)=>c.zutatenListe.find(z=>z.rolle==='bindung').menge;
const stabGelb=rechne('mayo_stab'), stabEi=rechne('mayo_stab',{bindung:E('ei')});
ok(stk(stabGelb)<=2 && stk(stabEi)<=2,`Pürierstab: ${stk(stabGelb)} Eigelb bzw. ${stk(stabEi)} Ei je Glas (nicht 3 Eigelb aus den Vollei-Rezepten)`);
// T87: die Korpus-Spanne der Zeile kommt aus derselben Zelle wie die Menge — der Wert liegt in Q1–Q3
const zeile=(c)=>c.zutatenListe.find(z=>z.rolle==='bindung');
const inSpanne=(z)=>z.korpus && z.bp>=z.korpus.q1-0.01 && z.bp<=z.korpus.q3+0.01;
ok(inSpanne(zeile(stabGelb)) && inSpanne(zeile(stabEi)) && zeile(stabGelb).korpus.q3<zeile(stabEi).korpus.q1,`Emulgator-Spanne je Zutat: Eigelb ${zeile(stabGelb).korpus.q1.toFixed(0)}–${zeile(stabGelb).korpus.q3.toFixed(0)} %, Ei ${zeile(stabEi).korpus.q1.toFixed(0)}–${zeile(stabEi).korpus.q3.toFixed(0)} % (Menge liegt jeweils darin)`);
const fett=(c)=>c.zutatenListe.find(z=>z.rolle==='fluessigkeit').korpus;
ok(JSON.stringify(fett(stabGelb))===JSON.stringify(fett(stabEi)),'Rollen ohne menge_je_zutat: Spanne unverändert aus der Methoden-Zelle');

// T89/DR-062: Senf ist Hilfsemulgator — ohne ihn ein Hinweis, die Bilanz zählt ihn mit
const ohneSenf=rechne(null,{aroma:E('salz')});
ok(ohneSenf.anpassungen.some(a=>/Hilfsemulgator/.test(a)) && ohneSenf.regelIds.includes('archetyp:senf_fehlt'),'ohne Senf: Hinweis „Hilfsemulgator fehlt“ mit Regel-Id');
ok(!rechne(null).anpassungen.some(a=>/Hilfsemulgator/.test(a)) && !rechne(null,{aroma:[{zutat:'senf',anteil:1},{zutat:'salz',anteil:1}]}).anpassungen.some(a=>/Hilfsemulgator/.test(a)),'mit Senf (auch gemischt mit Salz): kein Hinweis');
const emul=(c)=>c.bilanz.find(z=>z.groesse==='emulgator')?.gramm;
ok(emul(rechne(null))>emul(ohneSenf),'Bilanz Emulgator zählt den Senf mit (klein gegen das Eigelb)');
// T88/DR-058: natives Olivenöl kann mit dem Pürierstab bitter werden — Hinweis (keine Warnung), nur bei Werkzeug + Zutat
const bitter=(c)=>c.anpassungen.some(a=>/bitter/.test(a));
const oliv=rechne('mayo_stab',{fett:E('olivenoel')});
ok(bitter(oliv) && oliv.regelIds.includes('werkzeug:puerierstab:olivenoel_bitter') && !oliv.warnungen.some(w=>/bitter/.test(w)),'Pürierstab + Olivenöl: Hinweis „kann bitter werden“ mit Regel-Id, keine Warnung');
ok(bitter(rechne('mayo_stab_einlaufen',{fett:E('olivenoel')})),'auch beim Öl-Einlaufen mit dem Stab');
ok(!bitter(rechne('mayo_hand',{fett:E('olivenoel')})) && !bitter(rechne('mayo_stab')),'von Hand mit Olivenöl oder Pürierstab mit neutralem Öl: kein Hinweis');
ok(bitter(rechne('mayo_stab',{fett:[{zutat:'pflanzenoel',anteil:2},{zutat:'olivenoel',anteil:1}]})),'Mischung mit Olivenöl: Hinweis bleibt');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
