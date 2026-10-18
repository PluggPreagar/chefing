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

console.log(fail?fail+' FAIL':'ALL PASS');
