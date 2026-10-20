// T83/DR-051: Technik-Stufe gemessen am Korpus; gezielt gesuchte Rezepte zählen für Mengen, nicht für Häufigkeiten
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { technikStufe, TECHNIK_MIN_N } = await import(P+'model/rules.js');
const data={ingredients:J('ingredients'),archetypes:J('archetypes')};
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const ks={};
for (const ak of ['ruehrteig','pfannkuchen']) {
  const arch=data.archetypes[ak], rollen=arch.rollen.map(r=>r.rolle);
  for (const [vk,v] of Object.entries(arch.varianten)) ks[vk]={arch,st:stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen)};
}
const stufe=(vk)=>technikStufe(ks[vk].arch,vk,'eier_getrennt',ks[vk].st.techniken.eier_getrennt ?? {n:ks[vk].st.n,anteil:0});
const anteil=(vk)=>ks[vk].st.techniken.eier_getrennt?.anteil ?? 0;

ok(stufe('gugelhupf')==='typisch',`Gugelhupf: gemessen typisch (Anteil ${Math.round(anteil('gugelhupf')*100)} %)`);
ok(stufe('kastenkuchen')==='moeglich',`Kastenkuchen: gemessen möglich (Anteil ${Math.round(anteil('kastenkuchen')*100)} %)`);
ok(stufe('pancakes')==='moeglich','Pancakes: im ungezielten Korpus ohne Eischnee → möglich (gesetzt war typisch)');
ok(stufe('muffin')==='aus','Muffins: „aus“ aus den Daten bleibt aus');
ok(technikStufe(ks.gugelhupf.arch,'gugelhupf','eier_getrennt',{n:TECHNIK_MIN_N-1,anteil:0})==='typisch','zu wenig Rezepte: gesetzte Stufe gilt');

// gezielt gesuchte Rezepte verschieben weder Anteil noch Methoden-Zählung, aber Mengen
const basis={zutaten:[{rolle:'struktur',zutat:'weizenmehl',menge:100,einheit:'g'},{rolle:'trieb',zutat:'backpulver',menge:3,einheit:'g'}]};
const r=(i,extra)=>normalizeRecipe({id:'r'+i,methode:'creme',...basis,...extra},data.ingredients);
const liste=[...Array(10)].map((_,i)=>r(i,{}));
const gez=[...Array(5)].map((_,i)=>r(100+i,{methode:'schaummasse',techniken:['eier_getrennt'],auswahl:'gezielt',zutaten:[basis.zutaten[0],{rolle:'trieb',zutat:'backpulver',menge:1,einheit:'g'}]}));
const s=stats([...liste,...gez],['struktur','trieb']);
ok(s.techniken.eier_getrennt.anteil===0 && s.techniken.eier_getrennt.n===10,'gezielte Rezepte zählen nicht für den Anteil');
ok(s.methoden.creme===10 && !s.methoden.schaummasse,'gezielte Rezepte zählen nicht für die Methoden-Wahl');
ok(s.techniken.eier_getrennt.trieb.mit.median===1 && s.techniken.eier_getrennt.trieb.ohne.median===3,'Trieb mit/ohne Technik aus allen Rezepten (1 g gegen 3 g)');
ok(s.n===15,'n zählt alle Rezepte');

// T85/DR-052: Grenzen mit Ausnahmen — mit Eischnee oder Schaummasse gelten Gerüst- und Zucker-Grenzen nicht
const { grenzenFuer } = await import(P+'model/bilanz.js');
const G=J('grenzen').archetypen;
const ids=(liste)=>liste.map(g=>g.id);
const ohne=ids(grenzenFuer(G.ruehrteig,{methode:'creme',techniken:[]}));
const mit=ids(grenzenFuer(G.ruehrteig,{methode:'creme',techniken:['eier_getrennt']}));
const schaum=ids(grenzenFuer(G.ruehrteig,{methode:'schaummasse',techniken:[]}));
ok(['gluten_min','eiweiss_min','zucker_wasser_max'].every(id=>ohne.includes(id)),'ohne Eischnee: Gerüst- und Zucker-Grenzen gelten');
ok(!mit.includes('gluten_min') && !mit.includes('eiweiss_min') && !mit.includes('zucker_wasser_max'),'mit Eischnee: gluten_min, eiweiss_min, zucker_wasser_max gelten nicht');
ok(!schaum.includes('gluten_min') && schaum.includes('zucker_wasser_max'),'Schaummasse: Gerüst-Grenze gilt nicht, Zucker/Wasser schon');
ok(mit.includes('wasser_min_hart'),'harte Grenzen ohne Ausnahme gelten weiter');
ok(!ids(grenzenFuer(G.pfannkuchen,{methode:'pancake_kurz',techniken:['eier_getrennt']})).includes('pk_zucker_max'),'Soufflé-Pancakes: pk_zucker_max gilt mit Eischnee nicht');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
