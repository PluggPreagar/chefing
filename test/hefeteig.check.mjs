import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { grenzenPruefen } = await import(P+'model/bilanz.js');
const { fromGrams } = await import(P+'model/units.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const arch=data.archetypes.hefeteig;
const rollen=arch.rollen.map(r=>r.rolle);
const norm={}, ks={};
for (const [k,v] of Object.entries(arch.varianten)) { norm[k]=J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})); ks[k]=stats(norm[k],rollen); }
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(vk, over={}){const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'hefeteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}

// Korpus: ≥ 15 je Variante, alle innerhalb der eigenen Grenzen, alle Zeiten im Fenster der Operation
const grenzen=data.grenzen.archetypen.hefeteig;
const fenster={kneten:data.operations.kneten.zeit, vorteig:data.operations.vorteig_reifen.zeit, gehen:data.operations.gehen.zeit, stueckgare:data.operations.stueckgare.zeit};
const langeGare=data.methods.hefe_noknead.sequenz.find(s=>s.key==='gehen').zeit;
for (const [k,list] of Object.entries(norm)) {
  const verletzt=list.map(r=>{const v=grenzenPruefen(r.bilanz,grenzen);return [r.id,[...v.hart,...v.empfohlen].map(x=>x.id)];}).filter(([,ids])=>ids.length);
  ok(list.length>=15 && verletzt.length===0,`Korpus ${k}: ${list.length} Rezepte, alle innerhalb der Grenzen${verletzt.length?' — '+JSON.stringify(verletzt):''}`);
  ok(list.every(r=>r.unbekannt.length===0),`Korpus ${k}: keine unbekannten Zutaten/Einheiten`);
  const ausserhalb=[];
  for (const r of list) for (const [op,min] of Object.entries(r.zeiten||{})) {
    const f=op==='gehen'&&['hefe_noknead','hefe_kalt'].includes(r.methode)?langeGare:fenster[op];
    if (!f) ausserhalb.push(`${r.id}: unbekannte Zeit ${op}`); else if (min<f.min||min>f.max) ausserhalb.push(`${r.id}: ${op} ${min}`);
  }
  ok(ausserhalb.length===0,`Korpus ${k}: alle Zeiten im Fenster der Operation${ausserhalb.length?' — '+ausserhalb.join('; '):''}`);
  ok(Object.keys(ks[k].methoden).every(m=>arch.methoden.includes(m)),`Korpus ${k}: Methoden ${JSON.stringify(ks[k].methoden)}`);
}

// Trockenhefe zählt wie 3 g Frischhefe: gleiche Rollen-Prozent, echte Gramm bleiben
const frisch=normalizeRecipe({zutaten:[{rolle:'struktur',zutat:'weizenmehl',menge:500,einheit:'g'},{rolle:'trieb',zutat:'hefe_frisch',menge:21,einheit:'g'}]},data.ingredients,{rollen,referenz:'struktur'});
const trocken=normalizeRecipe({zutaten:[{rolle:'struktur',zutat:'weizenmehl',menge:500,einheit:'g'},{rolle:'trieb',zutat:'hefe_trocken',menge:1,einheit:'pkt'}]},data.ingredients,{rollen,referenz:'struktur'});
ok(Math.abs(frisch.bp.trieb-trocken.bp.trieb)<1e-9 && Math.abs(frisch.bilanz.bp.hefe-trocken.bilanz.bp.hefe)<1e-9,`1 Päckchen Trockenhefe = ½ Würfel Frischhefe (${frisch.bp.trieb.toFixed(1)} % beide), Bilanz-Hefe gleich`);

// Presets rechnen gültig, Methode, Backofen-Werte, Zeitleiste
for (const [vk,erwartet] of [['weissbrot','hefe_direkt'],['hefezopf','hefe_direkt']]) {
  const c=compute(st(vk),data,ks);
  ok(c.status!=='invalid' && c.methodKey===erwartet,`${vk}: gültig, Methode ${c.methodKey}`);
  ok(c.varianteLabel===arch.varianten[vk].label && c.backen.tempOU>0 && c.backen.minuten>0,`${vk}: ${c.backen.tempOU} °C O/U · ${c.backen.minuten} Min.`);
  ok([...c.warnungen,...c.gruende,...c.toleranzHinweise].length===0,`${vk}: Preset ohne Meldung${[...c.warnungen,...c.gruende,...c.toleranzHinweise].length?': '+[...c.warnungen,...c.gruende,...c.toleranzHinweise].join(' | '):''}`);
  ok(c.ablauf.at(-1).key==='backen' && c.ablauf.some(s=>s.key==='gehen'&&s.typ==='warten') && c.ablauf.some(s=>s.key==='kneten'),`${vk}: Ablauf ${c.ablauf.map(s=>s.key).join(' → ')}`);
  ok(c.zeit.warten>=60 && c.zeit.gesamt>=c.zeit.aktiv,`${vk}: Zeit gesamt ${c.zeit.gesamt} Min. (aktiv ${c.zeit.aktiv}, warten ${c.zeit.warten})`);
  const hefe=c.zutatenListe.find(z=>z.rolle==='trieb');
  ok(hefe && hefe.gramm>0 && c.bilanz.find(b=>b.groesse==='hefe').bp>0.5,`${vk}: Hefe ${Math.round(hefe.gramm*10)/10} g, Bilanz-Hefe ${c.bilanz.find(b=>b.groesse==='hefe').bp.toFixed(1)} %`);
}

// Methoden: Vorteig (reift vor dem Kneten) und lange Führung (Zeit statt Kneten)
let c=compute({...st('weissbrot'),methode:'hefe_vorteig'},data,ks);
ok(c.ablauf.map(s=>s.key).join()==='vorteig_ansetzen,vorteig_reifen,kneten,gehen,formen,stueckgare,backen','Vorteig-Methode: Vorteig reift vor dem Kneten ('+c.ablauf.map(s=>s.key).join(' → ')+')');
c=compute({...st('weissbrot'),methode:'hefe_noknead'},data,ks);
const lang=c.ablauf.find(s=>s.key==='gehen');
ok(!c.ablauf.some(s=>s.key==='kneten') && lang.dauer===720 && lang.zeit.max===1800 && c.status!=='invalid','Lange Führung: kein Kneten, Gare 12 Std. (Fenster 6 Std.–30 Std.)');
ok(c.zeit.gesamt>=720+45,`Lange Führung: Gesamtzeit ${c.zeit.gesamt} Min. enthält die lange Gare`);
// T48: Mengen aus den Rezepten der gewählten Methode, sobald es mindestens MIN_N_METHODE gibt (T46 ersetzt)
const { MIN_N_METHODE } = await import(P+'model/corpus.js');
const zelle=(v,m)=>ks[v].proMethode[m];
const hefeM=(v,m)=>zelle(v,m).bp.trieb.median;
const hefe=(cc)=>cc.rollenBp.trieb.bp;
const direkt=compute({...st('weissbrot'),methode:'hefe_direkt'},data,ks);
const vor=compute({...st('weissbrot'),methode:'hefe_vorteig'},data,ks);
ok(MIN_N_METHODE===1 && Object.keys(ks.weissbrot.proMethode).sort().join()==='hefe_direkt,hefe_kalt,hefe_noknead,hefe_vorteig' && Object.keys(ks.hefezopf.proMethode).sort().join()==='hefe_direkt,hefe_kalt,hefe_noknead,hefe_vorteig' && Object.values(ks.weissbrot.proMethode).every(s=>Object.keys(s.proMethode).length===0),'stats(): jede Methode mit mindestens einem Rezept bildet eine Zelle (Weißbrot kalt seit T49 mit 2 Rezepten), Zellen ohne Verschachtelung');
ok(hefeM('weissbrot','hefe_direkt')>1.5*ks.weissbrot.bp.trieb.median,`Voraussetzung: im Weißbrot weicht die Hefe der direkten Führung (${hefeM('weissbrot','hefe_direkt').toFixed(1)} %) deutlich vom Variantenmedian (${ks.weissbrot.bp.trieb.median.toFixed(1)} %) ab`);
ok(Math.abs(hefe(direkt)-hefeM('weissbrot','hefe_direkt'))<1e-9 && Math.abs(hefe(vor)-hefeM('weissbrot','hefe_vorteig'))<1e-9 && Math.abs(hefe(c)-hefeM('weissbrot','hefe_noknead'))<1e-9,`Weißbrot: Hefe je Methode aus deren Rezepten (direkt ${hefe(direkt).toFixed(1)} %, Vorteig ${hefe(vor).toFixed(1)} %, ohne Kneten ${hefe(c).toFixed(1)} %)`);
ok(hefe(c)<0.6*hefe(direkt),'Weißbrot ohne Kneten braucht deutlich weniger Hefe als direkte Führung');
ok(direkt.korpusNMethode===ks.weissbrot.proMethode.hefe_direkt.n && vor.korpusNMethode===ks.weissbrot.proMethode.hefe_vorteig.n && c.korpusNMethode===ks.weissbrot.proMethode.hefe_noknead.n && direkt.korpusN===ks.weissbrot.n && direkt.korpusN>=29,`Ergebnis nennt Variante (n = ${direkt.korpusN}) und Methoden-Rezepte (${direkt.korpusNMethode} / ${vor.korpusNMethode} / ${c.korpusNMethode})`);
const kaltW=compute({...st('weissbrot'),methode:'hefe_kalt'},data,ks);
ok(kaltW.korpusNMethode===ks.weissbrot.proMethode.hefe_kalt.n && kaltW.korpusNMethode>=2 && Math.abs(hefe(kaltW)-hefeM('weissbrot','hefe_kalt'))<1e-9,`Weißbrot kalt (n = ${kaltW.korpusNMethode}): die Rezepte der Methode zählen (T49: „Daten statt Modell“)`);
const ksOhneKalt={...ks,weissbrot:{...ks.weissbrot,proMethode:Object.fromEntries(Object.entries(ks.weissbrot.proMethode).filter(([k])=>k!=='hefe_kalt'))}};
const kaltLeer=compute({...st('weissbrot'),methode:'hefe_kalt'},{...data,modelle:undefined},ksOhneKalt);
ok(kaltLeer.korpusNMethode===null && Math.abs(hefe(kaltLeer)-ks.weissbrot.bp.trieb.median)<1e-9,'Methode ohne Rezepte und ohne Gärmodell: Rückfall auf den Variantenmedian');
const zopfNK=compute({...st('hefezopf'),methode:'hefe_noknead'},data,ks);
ok(zopfNK.korpusNMethode===2 && Math.abs(hefe(zopfNK)-hefeM('hefezopf','hefe_noknead'))<1e-9 && hefe(zopfNK)>4,`Zopf ohne Kneten (n = 2): die zwei Rezepte zählen (${hefe(zopfNK).toFixed(1)} % Hefe, kalt über Nacht), kein geratener Faktor`);
ok(c.anpassungen.length===0 && !c.toleranzHinweise.some(h=>/Hefe/.test(h)),'ohne Kneten: keine Anpassungstexte, kein „untypisch“-Hinweis zur Hefe');
const gr=data.grenzen.archetypen.hefeteig.find(g=>g.id==='hf_hefe_band');
ok(hefe(c)>=gr.min && !c.warnungen.some(w=>w.includes('Hefe')),`ohne Kneten: Hefe ${hefe(c).toFixed(1)} % liegt im Band ${gr.min}–${gr.max} %, keine Warnung`);
ok(Math.abs(c.zutatenListe.find(z=>z.rolle==='trieb').gramm/c.zutatenListe.find(z=>z.rolle==='struktur').gramm*100-hefe(c))<1e-6,'ohne Kneten: Hefe-Gramm folgen der Methoden-Statistik in der Zutatenliste');
ok(c.zutatenListe.find(z=>z.rolle==='trieb').korpus===zelle('weissbrot','hefe_noknead').bp.trieb,'Korpus-Spanne je Rolle in der Karte stammt ebenfalls aus der Methoden-Zelle');
ok(Math.abs(direkt.backen.minuten-compute({...st('weissbrot'),methode:'hefe_noknead'},data,ks).backen.minuten)<=1,'Backzeit bleibt auf der ganzen Variante (Methode ändert sie nicht)');

// T47: kalte Führung = normal kneten, dann lange kühle Gare (anders als die Führung ohne Kneten)
c=compute({...st('hefezopf'),methode:'hefe_kalt'},data,ks);
const kalt=c.ablauf.find(s=>s.key==='gehen');
ok(c.ablauf.map(s=>s.key).join()==='hefe_ansetzen,kneten,gehen,formen,stueckgare,backen' && kalt.dauer===720 && kalt.zeit.min===360 && c.status!=='invalid','Kalte Führung: Kneten bleibt, Gare 12 Std. (Fenster 6–30 Std.)');
ok(c.zeit.gesamt>=720+30 && c.zeit.aktiv<90,`Kalte Führung: Gesamtzeit ${c.zeit.gesamt} Min. bei nur ${c.zeit.aktiv} Min. aktiver Zeit`);
ok(Object.keys(ks.weissbrot.methoden).length===4 && Object.keys(ks.hefezopf.methoden).length===4 && ks.weissbrot.n>=20 && ks.hefezopf.n>=25,`Korpus nach T47: Weißbrot ${ks.weissbrot.n} (${JSON.stringify(ks.weissbrot.methoden)}), Zopf ${ks.hefezopf.n} (${JSON.stringify(ks.hefezopf.methoden)})`);
ok(norm.hefezopf.filter(r=>r.hatEinlage).length>=6 && norm.hefezopf.some(r=>r.zutaten.some(z=>z.zutat==='schokolade')) && norm.hefezopf.some(r=>r.zutaten.some(z=>z.zutat==='rosinen')),'Hefezopf-Korpus enthält Einlagen: Schokolade und Rosinen');

// Hefeteig ohne Gluten (Stärke statt Mehl) geht nicht auf — harte Regel, überschreibbar
c=compute(st('weissbrot',{struktur:E('speisestaerke')}),data,ks);
ok(c.status==='invalid' && c.blockaden.some(b=>b.id==='hefe_braucht_gluten'),'Hefeteig mit Stärke statt Mehl: blockiert (hefe_braucht_gluten)');

// Grenzen wirken: zu viel Zucker bremst die Hefe, zu viel Salz
c=compute(st('weissbrot',{suesse:E('zucker')}),data,{...ks,weissbrot:{...ks.weissbrot,proMethode:{},bp:{...ks.weissbrot.bp,suesse:{median:60,q1:60,q3:60,min:60,max:60}}}});
ok(c.bilanz.find(b=>b.groesse==='zucker').bp>45 && c.status==='invalid','Weißbrot mit 60 % Zucker: Hefe wird lahmgelegt (hart)');
c=compute(st('hefezopf',{trieb:E('hefe_trocken')}),data,ks);
const g=c.zutatenListe.find(z=>z.rolle==='trieb');
ok(g.zutat==='hefe_trocken' && g.gramm< c.zutatenListe.find(z=>z.rolle==='struktur').gramm*0.05/2,`Trockenhefe: ${Math.round(g.gramm*10)/10} g statt Frischhefe-Gramm (Äquivalenz 3)`);
ok(Math.abs(c.bilanz.find(b=>b.groesse==='hefe').bp-compute(st('hefezopf'),data,ks).bilanz.find(b=>b.groesse==='hefe').bp)<1e-6,'Trockenhefe statt Frischhefe: Bilanz-Hefe unverändert');
console.log(fail?fail+' FAIL':'ALL PASS');
