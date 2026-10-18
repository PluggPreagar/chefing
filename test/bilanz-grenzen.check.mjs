import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const arch=data.archetypes.ruehrteig;
const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
for (const [k,s] of Object.entries(ks)) console.log('KORPUS',k, Object.entries(s.bilanz).map(([g,d])=>`${g} ${Math.round(d.min)}/${Math.round(d.q1)}/${Math.round(d.median)}/${Math.round(d.q3)}/${Math.round(d.max)}`).join(' | '));
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(variante, over={}){const v=arch.varianten[variante];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const show=(name,c)=>{console.log(`\n# ${name}: status=${c.status}`);for(const b of c.bilanz)console.log(`  ${b.label} ${Math.round(b.gramm)} g ${Math.round(b.bp)} % [${b.toleranz}]`);for(const g of c.gruende)console.log('  GRUND',g);for(const w of c.warnungen)console.log('  WARN',w);for(const h of c.toleranzHinweise)console.log('  HINW',h);};
for (const v of Object.keys(arch.varianten)) { const c=compute(st(v),data,ks); show(v,c); ok(c.status!=='invalid' && c.bilanz.length>=8, `${v}: Preset gültig, Bilanz vorhanden`); }
let c=compute(st('kastenkuchen',{fluessigkeit:E('schmand')}),data,ks); show('Schmand statt Milch',c);
ok(c.bilanz.find(b=>b.groesse==='fett').bp > compute(st('kastenkuchen'),data,ks).bilanz.find(b=>b.groesse==='fett').bp, 'Schmand erhöht Reinfett (Fett aus Flüssigkeit zählt mit)');
c=compute(st('kastenkuchen',{fett:E('pflanzenoel')}),data,ks); show('Öl statt Butter',c);
c=compute(st('muffin',{struktur:E('speisestaerke')}),data,ks); show('Muffin Stärke',c);
// T43 integriert: wenig Stärke im Mehl (15 : 1, 7 : 1) erzeugt keine Korpus-Meldung mehr, 1 : 1 weiterhin
const mix=(a,b)=>[{zutat:'weizenmehl',anteil:a},{zutat:'speisestaerke',anteil:b}];
const korpusMeldung=(cc)=>[...cc.toleranzHinweise,...cc.warnungen.filter(w=>/Korpus-Rezepte/.test(w))];
ok(korpusMeldung(compute(st('kastenkuchen',{struktur:mix(15,1)}),data,ks)).filter(t=>/Klebereiweiß|Stärke/.test(t)).length===0,'T43: Kastenkuchen mit 15 : 1 Mehl : Stärke (Klebereiweiß −6 %) ohne Klebereiweiß-/Stärke-Meldung');
{const m=korpusMeldung(compute(st('kastenkuchen',{struktur:mix(7,1)}),data,ks)); ok(m.some(t=>/Klebereiweiß/.test(t)) && !m.some(t=>/außerhalb aller/.test(t)),'T48: 7 : 1 (Klebereiweiß −12 %) → nur ein Hinweis „untypisch“, keine Warnung „ungetestet“');}
ok(korpusMeldung(compute(st('muffin',{struktur:mix(1,1)}),data,ks)).some(t=>/Klebereiweiß/.test(t)),'T43: Muffin mit 1 : 1 Mehl : Stärke meldet Klebereiweiß weiterhin');
// Synthetic Grenzen-Test
const { grenzenPruefen, bilanz, toleranz } = await import(P+'model/bilanz.js');
const g=data.grenzen.archetypen.ruehrteig;
let b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'suesse',zutat:'zucker',gramm:170},{rolle:'fluessigkeit',zutat:'wasser',gramm:100}],data.ingredients);
let r=grenzenPruefen(b,g); ok(r.hart.some(x=>x.id==='zucker_max_hart'),'Zucker 170 % → hart'); ok(r.empfohlen.some(x=>x.id==='zucker_wasser_max'),'Zucker/Wasser >1 → empfohlen');
b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'fluessigkeit',zutat:'wasser',gramm:20}],data.ingredients);
r=grenzenPruefen(b,g); ok(r.hart.some(x=>x.id==='wasser_min_hart'),'Wasser 34 % → hart');
b=bilanz([{rolle:'struktur',zutat:'weizenmehl',gramm:100},{rolle:'einlage',zutat:'blaubeeren',gramm:300},{rolle:'fluessigkeit',zutat:'wasser',gramm:80}],data.ingredients);
ok(Math.round(b.bp.wasser)===94,'Einlage nicht in Bilanz, Mehlwasser zählt (94 %)');
ok(toleranz(5,{n:2,min:1,q1:2,q3:3,max:4})===null,'Toleranz n<3 → null');
ok(toleranz(50,{n:5,min:10,q1:20,q3:30,max:40})==='ausserhalb_spanne' && toleranz(35,{n:5,min:10,q1:20,q3:30,max:40})==='ausserhalb_q' && toleranz(25,{n:5,min:10,q1:20,q3:30,max:40})==='typisch','Toleranz-Stufen');
// T43: Mindestbreite — alle Rezepte gleich (Klebereiweiß 8,0 %) macht jede Abweichung nicht „ungetestet“
const eng={n:15,min:8,q1:8,median:8,q3:8,max:8};
ok(toleranz(7.5,eng)==='typisch' && toleranz(7.7,eng)==='typisch','T43/T48: 7,5 % (−6 %) und 7,7 % bei Korpus 8,0–8,0 → typisch (±5 % sicher, bis ±10 % üblich)');
ok(toleranz(7.3,eng)==='typisch' && toleranz(7.0,eng)==='ausserhalb_q','T43/T48: −9 % noch üblich, 7,0 % (−12,5 %) → Hinweis');
ok(toleranz(6.0,eng)==='ausserhalb_spanne' && toleranz(4.0,eng)==='ausserhalb_spanne' && toleranz(6.5,eng)==='ausserhalb_q','T43/T48: −25 % und −50 % → ungetestet, −19 % → nur Hinweis');
ok(toleranz(7.0,{n:1,min:8,q1:8,median:8,q3:8,max:8},1)==='ausserhalb_q' && toleranz(7.5,{n:1,min:8,q1:8,median:8,q3:8,max:8},1)==='typisch' && toleranz(7.0,{n:1,min:8,q1:8,median:8,q3:8,max:8})===null,'T48: ein einzelnes Rezept (n = 1) ist Referenz, wenn minN = 1 gesetzt ist; mit Standard-minN bleibt es unbewertet');
ok(toleranz(0.9,{n:15,min:1,q1:1.1,median:4.7,q3:10.9,max:16})==='typisch','T43: absolute Untergrenze 0,5 Punkte (Fett 0,9 % statt min. 1,0 %)');
ok(toleranz(5,{n:5,min:1,q1:2,q3:3,max:4})==='ausserhalb_spanne','T43: ohne median im Eingang (alte Aufrufer) wird die Mitte aus Q1/Q3 genommen');
console.log(fail? `\n${fail} FAIL`:'\nALL PASS');
{const all=Object.values(arch.varianten).flatMap(v=>J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
const zw=all.map(r=>r.bilanz.gramm.zucker/r.bilanz.gramm.wasser);console.log('Z/W korpus min/max',Math.min(...zw).toFixed(2),Math.max(...zw).toFixed(2));
const st2=compute(st('muffin'),data,ks); ok(st2.toleranzHinweise.length===0,'Muffin-Preset ohne Rundungs-Rauschen');}
console.log(fail? `${fail} FAIL`:'ALL PASS 2');
