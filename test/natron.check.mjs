// T37: Fertighelfer zerlegen — Säure-Kapazität der Zutaten, Backpulver als Zusammensetzung, Natron-Säure-Balance als Grenze aus der Bilanz.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { bilanz, grenzenPruefen, GROESSEN, GROESSEN_LABEL } = await import(P+'model/bilanz.js');
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
const ing=J('ingredients'), grenzen=J('grenzen');
const zutaten=Object.entries(ing).filter(([k])=>!k.startsWith('_'));

// --- Daten ---------------------------------------------------------------------------------------------------------------------
const saure=zutaten.filter(([,z])=>z.saeure===true).map(([k])=>k).sort();
const mitKap=zutaten.filter(([,z])=>z.saeure_kapazitaet!=null).map(([k])=>k).sort();
ok(saure.join()===mitKap.join() && saure.length===10,`saeure ist genau dann wahr, wenn saeure_kapazitaet gesetzt ist (${saure.length} Zutaten: ${saure.join(', ')})`);
ok(mitKap.every(k=>ing[k].saeure_kapazitaet>0 && ing[k].saeure_kapazitaet<=0.1),'Säure-Kapazität in g Natron je g Zutat: zwischen 0 und 0,1 (Zitronensaft ist mit 0,08 die stärkste)');
ok(ing.zitronensaft.saeure_kapazitaet>ing.joghurt.saeure_kapazitaet*5 && ing.buttermilch.saeure_kapazitaet>=ing.schmand.saeure_kapazitaet && ing.joghurt.saeure_kapazitaet>ing.brauner_zucker.saeure_kapazitaet,'Reihenfolge plausibel: Zitronensaft ≫ Milchprodukte ≫ brauner Zucker');
ok(near(ing.buttermilch.saeure_kapazitaet*240*1.03/2.5,1,0.15),'Eichpunkt aus der Backregel: ½ TL Natron (2,5 g) neutralisiert etwa 240 ml Buttermilch');
const bp=ing.backpulver, na=ing.natron, zus=bp.zusammensetzung;
ok(zus && near(zus.natron+zus.saeuretraeger+zus.staerke,1,1e-9) && near(zus.staerke,bp.funktionen.staerke) && Math.abs(na.funktionen.triebkraft/bp.funktionen.triebkraft*zus.natron-1)<0.15,'Backpulver = 30 % Natron + 40 % Säureträger + 30 % Stärke; Stärke-Anteil = funktionen.staerke; Triebkraft Natron / Backpulver ≈ 1 / Natron-Anteil (3 gegen 3,3)');
ok(near(ing.vanillezucker.zusammensetzung.zucker,ing.vanillezucker.zuckeranteil) && Object.values(ing.vanillezucker.zusammensetzung).reduce((a,b)=>a+b,0)<=1+1e-9,'Vanillezucker = 95 % Zucker + 5 % Vanille, passt zu zuckeranteil');
ok(zutaten.filter(([,z])=>z.zusammensetzung).map(([k])=>k).join()==='backpulver,vanillezucker' && na.funktionen.natron===1 && !bp.funktionen.natron,'nur Backpulver und Vanillezucker sind zerlegt; freies Natron zählt nur das Natron-Pulver (das im Backpulver bringt seine Säure mit)');
ok(/Natron-Äquivalent/.test(ing._schema.saeure_kapazitaet) && /SCHÄTZWERTE/.test(ing._schema.saeure_kapazitaet) && /Backpulver = Natron \+ Säureträger \+ Stärke/.test(ing._schema.zusammensetzung),'Schema nennt die Kapazität ausdrücklich Schätzwerte und erklärt die Zusammensetzung');
ok(GROESSEN_LABEL.natron==='Natron (frei)' && GROESSEN_LABEL.saeure==='Säure (Natron-Äq.)' && Object.keys(GROESSEN).includes('natron') && Object.keys(GROESSEN).includes('saeure'),'Bilanz-Größen natron und saeure mit Anzeigenamen');

// --- Bilanz --------------------------------------------------------------------------------------------------------------------
const p=(rolle,zutat,gramm)=>({rolle,zutat,gramm});
let b=bilanz([p('struktur','weizenmehl',250),p('trieb','natron',5),p('fluessigkeit','buttermilch',200)],ing);
ok(near(b.gramm.natron,5) && near(b.gramm.saeure,2) && near(b.bp.natron,2) && near(b.bp.saeure,0.8),'5 g Natron und 200 g Buttermilch: freies Natron 5 g, Säure 2,0 g Natron-Äquivalent');
b=bilanz([p('struktur','weizenmehl',250),p('trieb','backpulver',10),p('fluessigkeit','buttermilch',200)],ing);
ok(b.gramm.natron===0 && near(b.gramm.triebkraft,10) && b.gramm.saeure>0,'Backpulver zählt als Triebkraft, aber nicht als freies Natron');
b=bilanz([p('struktur','weizenmehl',250),p('trieb','natron',2),p('einlage','blaubeeren',100)],ing);
ok(near(b.gramm.saeure,1.2) && b.gramm.wasser<40 && b.gramm.wasser===250*ing.weizenmehl.wasseranteil,'Säure der Einlage (Blaubeeren) zählt mit, ihr Wasser weiterhin nicht (Einlage bleibt außerhalb der Teigmatrix)');
ok(near(bilanz([p('struktur','weizenmehl',250),p('fluessigkeit','milch',100)],ing).gramm.saeure,0),'ohne saure Zutat keine Säure');
const m=(posten)=>{const bb=bilanz(posten,ing); return grenzenPruefen(bb,grenzen.archetypen.ruehrteig);};
let v=m([p('struktur','weizenmehl',250),p('trieb','natron',5),p('fluessigkeit','wasser',200),p('fluessigkeit','buttermilch',50)]);
ok(v.empfohlen.some(x=>x.id==='natron_saeure_max' && x.wert>9) && !v.hart.length,'5 g Natron, 200 g Wasser und nur 50 g Buttermilch (Verhältnis 10): empfohlen-Warnung natron_saeure_max, nicht hart');
v=m([p('struktur','weizenmehl',250),p('trieb','natron',2.5),p('fluessigkeit','buttermilch',250)]);
ok(!v.empfohlen.some(x=>x.id==='natron_saeure_max'),'2,5 g Natron auf 250 g Buttermilch (Verhältnis 1): keine Warnung');
v=m([p('struktur','weizenmehl',250),p('trieb','backpulver',10),p('fluessigkeit','milch',100)]);
ok(!v.empfohlen.some(x=>x.id==='natron_saeure_max'),'ohne freies Natron (nur Backpulver): keine Warnung, auch ohne Säure');
v=m([p('struktur','weizenmehl',250),p('trieb','natron',2.5),p('fluessigkeit','milch',100)]);
ok(!v.empfohlen.some(x=>x.id==='natron_saeure_max'),'Natron ganz ohne Säure: die Verhältnis-Grenze schweigt (Nenner 0), das übernimmt die harte Regel „Natron braucht Säure“');

// --- Grenzen und Korpus -------------------------------------------------------------------------------------------------------------
const gr=(ak,id)=>grenzen.archetypen[ak].find(x=>x.id===id);
const g1=gr('ruehrteig','natron_saeure_max'), g2=gr('pfannkuchen','pk_natron_saeure_max');
ok(g1 && g2 && g1.max===2.2 && g2.max===2.2 && g1.strenge==='empfohlen' && g2.strenge==='empfohlen' && g1.groesse==='natron' && g1.bezug.groesse==='saeure' && g1.kaskade_ziel==='fluessigkeit' && /Natron\/Säure = \{wert\}/.test(g1.hinweis) && !grenzen.archetypen.hefeteig.some(x=>x.groesse==='natron'),'Grenze natron_saeure_max (Rührteig) und pk_natron_saeure_max (Pfannkuchen): ≤ 2,2, empfohlen, Kaskade über die Flüssigkeit; Hefeteig hat keine');
const archs=J('archetypes'); let n=0, nNatron=0, hoechst=0, tiefst=9, verletzt=[];
for (const [ak,a] of Object.entries(archs)) { if (ak.startsWith('_')) continue; const rollen=a.rollen.map(x=>x.rolle), referenz=a.rollen.find(x=>x.referenz)?.rolle??'struktur';
  for (const v0 of Object.values(a.varianten)) for (const r of J('corpus/'+v0.korpus)) { n++; const nr=normalizeRecipe(r,ing,{rollen,referenz}); const verh=nr.bilanz.gramm.saeure>0?nr.bilanz.gramm.natron/nr.bilanz.gramm.saeure:null;
    if (nr.bilanz.gramm.natron>0) { nNatron++; if (verh!=null) { hoechst=Math.max(hoechst,verh); tiefst=Math.min(tiefst,verh); } }
    const vz=grenzenPruefen(nr.bilanz,grenzen.archetypen[ak]||[]); if ([...vz.hart,...vz.empfohlen].some(x=>/natron_saeure/.test(x.id))) verletzt.push(r.id); } }
ok(nNatron===9 && verletzt.length===0 && hoechst>1.8 && hoechst<2.2 && tiefst>0.25,`Korpus: ${nNatron} Rezepte mit Natron (von ${n}), Verhältnis ${tiefst.toFixed(2)}–${hoechst.toFixed(2)}, keines verletzt die Grenze${verletzt.length?' — '+verletzt.join(', '):''}`);

// --- Engine ---------------------------------------------------------------------------------------------------------------------------
const names=['ingredients','operations','methods','archetypen','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'].filter(x=>x!=='archetypen');
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const ruehr=data.archetypes.ruehrteig; const rr=ruehr.rollen.map(r=>r.rolle); const ksR={};
for (const [k,x] of Object.entries(ruehr.varianten)) ksR[k]=stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr);
const E=(w,anteil=1)=>w==null?[]:[{zutat:w,anteil}];
const v0=ruehr.varianten.muffin; const basis={}; for (const r of ruehr.rollen) basis[r.rolle]=E(v0.bestof[r.rolle]!==undefined?v0.bestof[r.rolle]:r.default);
const rechne=(over)=>compute({archetyp:'ruehrteig',gefaess:v0.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:{...basis,...over}},data,ksR);
let c=rechne({trieb:E('natron'),fluessigkeit:E('buttermilch')});
ok(!c.warnungen.some(w=>/Natron\/Säure/.test(w)) && c.status!=='invalid' && c.bilanz.find(z=>z.groesse==='saeure').gramm>0,'Muffins mit Natron und Buttermilch: Balance in Ordnung, Säure in der Bilanz');
c=rechne({trieb:E('natron'),fluessigkeit:[{zutat:'milch',anteil:5},{zutat:'schmand',anteil:1}]});
ok(c.warnungen.some(w=>/Natron\/Säure = \d/.test(w)) && c.status!=='invalid' && c.kaskaden.some(k=>k.rolle==='fluessigkeit'),'Natron mit Milch und nur einem Sechstel Schmand: Warnung zu wenig Säure (nicht ungültig), Vorschlag: andere Flüssigkeit');
ok(c.regelIds.includes('natron_saeure_max'),'die Grenze zählt als Vorhersage (regelIds) für die Rückmeldungen');
c=rechne({trieb:E('natron'),fluessigkeit:E('milch')});
ok(c.status==='invalid' && c.gruende.some(g=>/Natron|saures/.test(g)),'Natron ganz ohne Säure bleibt ungültig (harte Regel an „Backen“ bleibt bestehen)');
c=rechne({});
ok(!c.bilanz.some(z=>['natron','saeure'].includes(z.groesse) && z.toleranz && z.toleranz!=='typisch'),'Standard-Preset: Natron und Säure sind gegen den Korpus typisch (keine neue Meldung)');

// --- Bestehende Natron-Regeln bleiben (bewusst) -----------------------------------------------------------------------------------------
const eg=J('erfahrungsregeln').regeln.map(r=>r.id);
ok(eg.includes('natron_drittel') && eg.includes('saeure_reduziert_backpulver') && J('operations').backen.voraussetzung.some(x=>x.id==='natron_braucht_saeure'),'Entscheidung: Erfahrungsregeln (Natron-Drittelung, Säure senkt Backpulver) und die harte Regel bleiben neben der Grenze bestehen — Ersatz erst mit mehr Natron-Rezepten (n = 9)');

console.log(fail?fail+' FAIL':'ALL PASS');
