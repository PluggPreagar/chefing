// Korpus-Statistik (corpus.js): Varianten-Cluster (T05), später gewichteter Median nach Qualitätsnote (T51).
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { clusterBilden, stats, normalizeRecipe } = await import(P+'model/corpus.js');
const { clusterLabel } = await import(P+'ui/stats.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;

// --- Varianten-Cluster (T05) ------------------------------------------------------------------------------------------------
const r=(id,fettTyp,sauer,hatEinlage,fett,wasser=50,zucker=30)=>({id,fettTyp,sauer,hatEinlage,bilanz:{bp:{fett,wasser,zucker}}});
const liste=[r('a','fest',false,false,60),r('b','fest',false,false,70),r('c','fest',false,false,80),r('d','fluessig',false,true,40),r('e','fluessig',true,false,30),r('f',null,false,false,0)];
let c=clusterBilden(liste);
const nach=Object.fromEntries(c.map(x=>[x.key,x]));
ok(c.length===4 && c[0].key==='fest|neutral|ohne' && c[0].n===3,'6 Rezepte → 4 Gruppen, die größte (festes Fett, neutral, ohne Einlage) zuerst');
ok(near(c.reduce((s,x)=>s+x.anteil,0),1) && c.reduce((s,x)=>s+x.n,0)===6 && near(nach['fest|neutral|ohne'].anteil,0.5),'Anteile summieren sich auf 1, Anzahlen auf alle Rezepte');
ok(nach['fest|neutral|ohne'].bilanz.fett.median===70 && nach['fest|neutral|ohne'].bilanz.fett.min===60 && nach['fest|neutral|ohne'].bilanz.fett.max===80,'Median, Minimum und Maximum der Fett-Bilanz je Gruppe');
ok(nach['fluessig|neutral|einlage'].einlage===true && nach['fluessig|sauer|ohne'].sauer===true && nach['kein|neutral|ohne'].fettTyp==='kein','Merkmale je Gruppe: Einlage, sauer, Rezept ohne Fett heißt „kein“');
ok(nach['fest|neutral|ohne'].ids.join()==='a,b,c','Rezept-ids je Gruppe in Reihenfolge des Korpus');
c=clusterBilden([r('x','fest',false,false,10),r('y','fluessig',false,false,10),r('z','kein',false,false,0)]);
ok(c.map(x=>x.key).join()==='fest|neutral|ohne,fluessig|neutral|ohne,kein|neutral|ohne'.split(',').sort((a,b)=>a.localeCompare(b)).join() && c.every(x=>x.n===1),'gleich große Gruppen: stabil nach Schlüssel sortiert');
ok(clusterBilden([]).length===0 && clusterBilden([r('a','fest',false,false,1)]).length===1,'leerer Korpus: keine Gruppen; ein Rezept: eine Gruppe');
ok(clusterBilden([{id:'o',fettTyp:'fest',sauer:false,hatEinlage:false}])[0].bilanz.fett===null,'Rezept ohne Bilanz: Median-Felder leer statt Absturz');
ok(clusterLabel({fettTyp:'fest',sauer:false,einlage:true})==='festes Fett · neutral · mit Einlage' && clusterLabel({fettTyp:'fluessig',sauer:true,einlage:false})==='flüssiges Fett · sauer · ohne Einlage' && clusterLabel({fettTyp:'kein',sauer:false,einlage:false})==='kein Fett · neutral · ohne Einlage','Anzeigename der Gruppe');

// --- echter Korpus ------------------------------------------------------------------------------------------------------------
const ing=J('ingredients'), archs=J('archetypes');
let alleOk=true, gruppen=0, summen=[];
for (const [ak,a] of Object.entries(archs)) {
  if (ak.startsWith('_')) continue;
  const rollen=a.rollen.map(x=>x.rolle), referenz=a.rollen.find(x=>x.referenz)?.rolle??'struktur';
  for (const [vk,v] of Object.entries(a.varianten)) {
    const st=stats(J('corpus/'+v.korpus).map(x=>normalizeRecipe(x,ing,{rollen,referenz})),rollen);
    const n=st.cluster.reduce((s,x)=>s+x.n,0);
    if (n!==st.n || new Set(st.cluster.map(x=>x.key)).size!==st.cluster.length) alleOk=false;
    for (const m of Object.values(st.proMethode)) if (m.cluster.reduce((s,x)=>s+x.n,0)!==m.n) alleOk=false;
    gruppen+=st.cluster.length; summen.push(`${vk} ${st.cluster.length}`);
  }
}
ok(alleOk,`Varianten-Cluster im echten Korpus: je Variante und je Methode zählen die Gruppen genau alle Rezepte, Schlüssel eindeutig (${summen.join(', ')})`);
const kk=stats(J('corpus/kastenkuchen').map(x=>normalizeRecipe(x,ing)));
ok(kk.cluster.length>=2 && kk.cluster.some(x=>x.fettTyp==='fest') && kk.cluster.some(x=>x.fettTyp==='fluessig'),'Kastenkuchen: mindestens festes und flüssiges Fett als Gruppen');

// --- Qualitätsnote in den Mengen (T51), standardmäßig aus ------------------------------------------------------------------------
const { QUALITAET_GEWICHT, QUALITAET_GEWICHTET, gewichteterMedian } = await import(P+'model/corpus.js');
ok([5,4,3,2,1].map(QUALITAET_GEWICHT).join()==='3,2,1,0,0' && QUALITAET_GEWICHT(null)===2 && QUALITAET_GEWICHT(undefined)===QUALITAET_GEWICHT(4),'Gewicht aus der Note: 5 → 3, 4 → 2, 3 → 1, 2 und 1 → 0, ohne Note wie Note 4');
ok(gewichteterMedian([1,2,3],[1,1,1])===2 && gewichteterMedian([1,2,3],[1,1,3])===3 && gewichteterMedian([1,2,3],[3,1,1])===1 && gewichteterMedian([1,2],[1,1])===1.5 && gewichteterMedian([3,1,2],[1,1,3])===2,'gewichteter Median: gleiche Gewichte = Median, schwere Rezepte ziehen, genau die Hälfte → Mitte der Nachbarn, unsortierte Eingabe');
ok(gewichteterMedian([],[])===null && gewichteterMedian([5,6],[0,0])===null && gewichteterMedian([null,4,NaN],[2,2,2])===4 && gewichteterMedian([10,20],[0,2])===20,'leer, nur Gewicht 0, leere Werte: kein Absturz, Gewicht 0 zählt nicht');
const qr=(id,note,bpTrieb,extra={})=>({id,qualitaet:note,bp:{struktur:100,trieb:bpTrieb},bilanz:{bp:{wasser:bpTrieb}},fettTyp:'fest',sauer:false,hatEinlage:false,methode:'m',unbekannt:[],...extra});
const noten=[3,4,4,5,5]; const q5=[10,20,30,40,50].map((v,i)=>qr('r'+i,noten[i],v));
let sQ=stats(q5,['struktur','trieb'],{gewichtet:true}), sR=stats(q5,['struktur','trieb'],{gewichtet:false});
ok(sR.bp.trieb.median===30 && sQ.bp.trieb.median===40 && sQ.bp.trieb.medianRoh===30 && sQ.bp.trieb.q1===sR.bp.trieb.q1 && sQ.bp.trieb.min===10 && sQ.bp.trieb.max===50,'Gewichtet: Median 40 statt 30 (Noten 3, 4, 4, 5, 5), roher Median bleibt in `medianRoh`, Quartile und Spanne unverändert');
ok(sQ.bilanz.wasser.median===sR.bilanz.wasser.median && !('medianRoh' in (sR.bp.trieb)),'Bilanz-Verteilung (Toleranzbänder) bleibt ungewichtet; ohne Gewichtung gibt es kein `medianRoh`');
ok(sQ.proMethode.m.bp.trieb.median===40,'auch die Methoden-Zelle rechnet gewichtet');
ok(stats([qr('a',3,10),qr('b',5,90)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===90 && stats([qr('a',4,10),qr('b',4,90)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===50 && stats([qr('a',4,10)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===10,'höchstens 2 Rezepte je Zelle: das beste Rezept gilt; bei gleicher Note der Median beider; ein Rezept bleibt es selbst');
ok(stats([qr('a',2,10),qr('b',1,90)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===10,'zwei Rezepte mit Noten ≤ 2 (Gewicht 0): trotzdem gilt das bessere, nicht die Mitte');
ok(stats([qr('a',null,10),qr('b',5,90)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===90,'ohne Note zählt ein Rezept wie Note 4, das mit Note 5 ist besser');
ok(stats([qr('a',2,10),qr('b',2,20),qr('c',2,30)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===20,'nur Noten ≤ 2 (Gewicht 0): Rückfall auf den ungewichteten Median');
ok(stats([qr('a',4,10),qr('b',4,20),qr('c',4,30)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===20 && stats([qr('a',4,10),qr('b',4,20),qr('c',4,30),qr('d',4,40)],['struktur','trieb'],{gewichtet:true}).bp.trieb.median===25,'gleiche Noten: gewichteter Median = Median (auch bei gerader Anzahl)');
ok(stats([qr('a',3,10),qr('b',4,20),qr('c',4,30),qr('d',5,40),qr('e',5,50)].map(x=>({...x,qualitaet_manuell:4})),['struktur','trieb'],{gewichtet:true}).bp.trieb.median===30,'Handnote (`qualitaet_manuell`) vor der abgeleiteten Note');
// Standard: aus; Schalter zeigt auf `stats`
ok(QUALITAET_GEWICHTET===false && stats(q5,['struktur','trieb']).bp.trieb.median===30,'Standard: AUS (die Messung am Korpus zeigt Sprünge in 32 von 171 Zellen) — `stats()` ohne Option rechnet ungewichtet');
// echter Korpus, eingeschaltet: Median bleibt ein Wert der Zelle (oder Mitte zweier Nachbarn), nie außerhalb der Spanne
let innerhalb=true, abweichend=0, zellen=0;
for (const [ak,a] of Object.entries(archs)) { if (ak.startsWith('_')) continue; const rollen=a.rollen.map(x=>x.rolle), referenz=a.rollen.find(x=>x.referenz)?.rolle??'struktur';
  for (const v of Object.values(a.varianten)) { const norm=J('corpus/'+v.korpus).map(x=>normalizeRecipe(x,ing,{rollen,referenz})); const roh=stats(norm,rollen,{gewichtet:false}), gew=stats(norm,rollen,{gewichtet:true});
    for (const [r0,g0] of [[roh,gew],...Object.keys(roh.proMethode).map(m=>[roh.proMethode[m],gew.proMethode[m]])]) for (const rolle of rollen) { const x=r0.bp[rolle], y=g0.bp[rolle]; if (!x||!y) continue; zellen++;
      if (y.median<x.min-1e-9 || y.median>x.max+1e-9 || Math.abs(y.medianRoh-x.median)>1e-9) innerhalb=false; if (Math.abs(y.median-x.median)>1e-9) abweichend++; } } }
ok(innerhalb && zellen>150 && abweichend>0,`echter Korpus gewichtet: ${zellen} Mengen-Zellen, ${abweichend} verschieben sich, alle bleiben innerhalb der Spanne und tragen den rohen Median in \`medianRoh\``);

console.log(fail?fail+' FAIL':'ALL PASS');
