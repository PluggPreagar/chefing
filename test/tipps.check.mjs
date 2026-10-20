// T61: Tipp-Korpus (src/data/tipps.json) — Aufbau, Verweise auf das Modell und die behaupteten „abgedeckt“-Fälle, geprüft am echten Modell.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { GROESSEN } = await import(P+'model/bilanz.js');
const { erwarteteGare, gaerungModell } = await import(P+'model/gaerung.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(x=>[x,J(x)]));
const T=J('tipps'), tipps=T.tipps;

// --- Aufbau ----------------------------------------------------------------------------------------------------------------------
const ARTEN=['temperatur','menge','prozess','ofen','zutat'], STAENDE=['abgedeckt','teilweise','luecke','ausserhalb'];
ok(tipps.length===19 && new Set(tipps.map(t=>t.id)).size===19,'19 Tipps mit eindeutiger id');
ok(tipps.every(t=>ARTEN.includes(t.art) && STAENDE.includes(t.modell.stand) && [1,2,3].includes(t.evidenz) && t.symptom && t.ursache && typeof t.zahlen==='object'),'jeder Tipp hat Art, Symptom, Ursache, Zahlen-Objekt, Evidenz 1–3 und einen Modell-Stand');
ok(tipps.every(t=>t.quellen.length>=1 && t.quellen.every(q=>q.url.startsWith('https://') && q.site)) && tipps.every(t=>t.evidenz<3 || t.quellen.length>=2),'jeder Tipp hat Quellen (https, mit Seite); Evidenz 3 braucht mindestens zwei Quellen');
ok(tipps.every(t=>[t.symptom,t.ursache,t.hinweis||''].every(x=>x.length<=420 && !/["„“]/.test(x))),'Urheberrecht: nur kurze eigene Zusammenfassungen (höchstens 420 Zeichen, keine wörtlichen Zitate in Anführungszeichen)');
ok(tipps.filter(t=>t.modell.stand==='abgedeckt').every(t=>t.modell.luecke===null && t.modell.durch.length>0) && tipps.filter(t=>t.modell.stand!=='abgedeckt').every(t=>typeof t.modell.luecke==='string' && t.modell.luecke.length>10) && tipps.filter(t=>t.modell.stand==='ausserhalb').every(t=>t.modell.durch.length===0) && tipps.filter(t=>t.modell.stand==='luecke').every(t=>/Kandidat|Kein|nicht/.test(t.modell.luecke)),'Modell-Stand passt zu den Feldern: abgedeckt ohne Lücke, sonst mit Beschreibung, ausserhalb ohne Verweise');
const zaehl=(f)=>tipps.filter(f).length;
ok(zaehl(t=>t.modell.stand==='abgedeckt')===6 && zaehl(t=>t.modell.stand==='teilweise')===9 && zaehl(t=>t.modell.stand==='luecke')===1 && zaehl(t=>t.modell.stand==='ausserhalb')===3,'Befund: 6 abgedeckt, 9 teilweise, 1 Lücke, 3 außerhalb (T63 Hefe-Flüssigkeit, T65 Triebmittel, T64 Rührzeit eingeordnet)');
ok(tipps.filter(t=>t.modell.stand==='luecke').map(t=>t.id).join()==='kuchen-ofen-und-backzeit','die verbleibende Lücke: Ofen und Backzeit (Ofen, Form und Schiene sind keine Eingaben)');

// --- Verweise ins Modell lösen sich auf ------------------------------------------------------------------------------------------
const grenzIds=new Set(Object.values(data.grenzen.archetypen).flat().map(g=>g.id));
const opKeys=new Set([...Object.keys(data.operations),...Object.values(data.methods).flatMap(m=>Array.isArray(m?.sequenz)?m.sequenz.map(e=>typeof e==='object'?e.key:e):[])]);
const eigenschaften=new Set(Object.values(data.ingredients).flatMap(v=>v&&typeof v==='object'?Object.keys(v):[]));
const loest=(d)=>{ const [art,wert]=d.split(':'); return art==='grenze'?grenzIds.has(wert):art==='operation'?opKeys.has(wert):art==='eigenschaft'?eigenschaften.has(wert):art==='toleranz'?!!GROESSEN[wert]:d==='modell:gaerung'?!!gaerungModell(data):false; };
const unaufgeloest=tipps.flatMap(t=>t.modell.durch.filter(d=>!loest(d)).map(d=>`${t.id}: ${d}`));
ok(unaufgeloest.length===0,`alle Verweise „durch“ lösen sich auf (Grenzen, Operationen, Eigenschaften, Toleranz-Größen, Gärmodell)${unaufgeloest.length?' — '+unaufgeloest.join('; '):''}`);

// --- „abgedeckt“ am echten Modell prüfen ---------------------------------------------------------------------------------------------
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const mk=(ak)=>{ const a=data.archetypes[ak], rr=a.rollen.map(r=>r.rolle); return {a, ks:Object.fromEntries(Object.entries(a.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen:rr})),rr)]))}; };
const basis=(a,vk)=>{ const v=a.varianten[vk], b={}; for (const r of a.rollen) b[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default); return b; };
{const {a,ks}=mk('ruehrteig'); const v=a.varianten.kastenkuchen, b=basis(a,'kastenkuchen');
 const rechne=(extra={})=>compute({archetyp:'ruehrteig',gefaess:v.gefaess,methode:'creme',fixiert:{rollen:{},zutaten:{}},zutaten:b,...extra},data,ks);
 const ref=rechne();
 ok(ref.status!=='invalid' && ref.regelIds.every(i=>!/wasser_|gaerung/.test(i)),'Ausgangslage: Kastenkuchen (Creme) ist gültig und ohne Wasser-Meldung');
 const kalt=rechne({zutatTemperaturen:{fett:'kuehlschrank'}});
 ok(kalt.vorbereitungen.some(v=>v.key==='temperieren' && /cremig schlagbares Fett \(ist: nein\)/.test(v.text)),'butter-zu-kalt-aufschlagen: Butter aus dem Kühlschrank → Schritt „weich werden lassen“ (T94)');
 const warm=rechne();
 ok(warm.vorbereitungen.some(v=>v.key==='temperieren') && !rechne({zutatTemperaturen:{fett:'plastisch'}}).vorbereitungen.length,'ruehrteig-gerinnt-kalte-zutaten (Butter-Teil): ohne Angabe Vorbereitung „weich werden lassen“, bei 18–22 °C keine');
 const nass=rechne({mengen:{fluessigkeit:250}});
 const t5=tipps.find(t=>t.id==='ruehrteig-zu-viel-fluessigkeit').modell.durch.map(d=>d.split(':')[1]);
 ok(t5.some(id=>nass.regelIds.includes(id)),'ruehrteig-zu-viel-fluessigkeit: 250 % Flüssigkeit löst eine der genannten Wasser-Grenzen aus');
 const trocken=rechne({mengen:{fluessigkeit:2,bindung:10}}); // Flüssigkeit allein genügt nicht: Ei und Mehl liefern schon Wasser
 const t6=tipps.find(t=>t.id==='ruehrteig-zu-viel-mehl-trocken').modell.durch.filter(d=>d.startsWith('grenze:')).map(d=>d.split(':')[1]);
 ok(t6.some(id=>trocken.regelIds.includes(id)),'ruehrteig-zu-viel-mehl-trocken: wenig Flüssigkeit und wenig Ei (2 und 10 %) lösen eine der genannten Untergrenzen aus; 5 % Flüssigkeit allein noch nicht');
 ok(!t6.some(id=>rechne({mengen:{fluessigkeit:5}}).regelIds.includes(id)),'… 5 % Flüssigkeit allein bleibt ohne Meldung (Ei und Mehl liefern genug Wasser) — Teil der Lücke des Tipps');
 const tm=tipps.find(t=>t.id==='ruehrteig-faellt-ein-triebmittel').modell.durch.filter(d=>d.startsWith('grenze:triebkraft')).map(d=>d.split(':')[1]);
 const viel=rechne({mengen:{trieb:15}});
 ok(tm.some(id=>viel.regelIds.includes(id)),'ruehrteig-faellt-ein-triebmittel: 15 % Backpulver löst die Triebkraft-Grenze aus');
 const mittel=rechne({mengen:{trieb:5}});
 ok(!tm.some(id=>mittel.regelIds.includes(id)) && mittel.toleranzHinweise.some(h=>/Triebkraft.*5,0 %.*untypisch/.test(h)),'… 5 % bleibt ohne Grenze, löst aber den Korpus-Hinweis „untypisch“ aus (Kastenkuchen Q1–Q3 2,6–4,3 %)');
 const sieben=rechne({mengen:{trieb:7}});
 ok(sieben.warnungen.some(w=>/Triebkraft.*7,0 %.*außerhalb aller/.test(w)) && !tm.some(id=>sieben.regelIds.includes(id)),'… 7 % (über dem Korpus-Maximum 6,0 %) löst die Warnung „außerhalb aller Korpus-Rezepte“ aus, die Grenze 8 % noch nicht: die Meldungen steigern sich Hinweis, Warnung, Grenze, hart');}
{const mischen=['unterheben_kurz','unterheben_abwechselnd','pc_kurz_verruehren','glatt_ruehren'];
 const ops=Object.fromEntries([...Object.entries(data.operations).map(([k,v])=>[k,v]),...Object.values(data.methods).flatMap(m=>Array.isArray(m?.sequenz)?m.sequenz.filter(e=>typeof e==='object').map(e=>[e.key,e]):[])]);
 ok(mischen.every(k=>/(lange|kräftig).*(Gluten|zäh|kompakt)|Gluten/i.test(ops[k]?.risiko||'')) && tipps.find(t=>t.id==='ruehrteig-uebermischen').modell.durch.every(d=>mischen.includes(d.split(':')[1])),'ruehrteig-uebermischen: alle vier Misch-Schritte tragen den Risiko-Text zu langes Rühren (Gluten, zäh); der Ablauf zeigt ihn an');}
{const {a,ks}=mk('hefeteig'); const v=a.varianten.weissbrot, b=basis(a,'weissbrot');
 const rechne=(extra={})=>compute({archetyp:'hefeteig',gefaess:v.gefaess,methode:'hefe_direkt',fixiert:{rollen:{},zutaten:{}},zutaten:b,...extra},data,ks);
 const t13=tipps.find(t=>t.id==='hefe-zu-trocken').modell.durch.map(d=>d.split(':')[1]);
 ok(t13.some(id=>rechne({mengen:{fluessigkeit:20}}).regelIds.includes(id)) && !t13.some(id=>rechne().regelIds.includes(id)),'hefe-zu-trocken: 20 % Flüssigkeit löst die Wasser-Untergrenze aus, die Ausgangslage nicht');
 ok(rechne({zutatTemperaturen:{fluessigkeit:50}}).status==='invalid' && rechne({zutatTemperaturen:{fluessigkeit:50}}).regelIds.includes('hefe_fluessigkeit_zu_heiss') && rechne({zutatTemperaturen:{fluessigkeit:'lauwarm'}}).status!=='invalid','hefe-fluessigkeit-zu-heiss: Flüssigkeit 50 °C macht den Hefeteig ungültig (Regel hefe_fluessigkeit_zu_heiss), lauwarm nicht');
 const m=gaerungModell(data);
 ok(erwarteteGare(1,15,m)>erwarteteGare(1,28,m) && erwarteteGare(1,5,m)>erwarteteGare(1,15,m) && erwarteteGare(1,28,m)>erwarteteGare(1,40,m),'hefe-zu-kalt-langsam: das Gärmodell verlängert die Gare bei Kälte und verkürzt sie bei Wärme (5 < 15 < 28 < 40 °C)');
 ok(!['hf_fett_max','hf_zucker_max'].some(id=>rechne({mengen:{fett:20,suesse:15}}).regelIds.includes(id)) && ['hf_fett_max','hf_zucker_max'].some(id=>rechne({mengen:{fett:50,suesse:30}}).regelIds.includes(id)),'hefe-viel-fett-zucker: 50 % Fett oder 30 % Zucker lösen die Grenzen aus, 20 und 15 % nicht');}

console.log(fail?fail+' FAIL':'ALL PASS');
