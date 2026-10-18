// T50: Qualitätsnote 1–5 je Korpus-Rezept (DR-026) — Regeln, Aktualität im Korpus, Überschreiben, nur Anzeige.
import fs from 'fs';
import { execSync } from 'child_process';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { qualitaetVorschlag, effektiveQualitaet, istManuell, BASIS } = await import(P+'model/qualitaet.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b)=>Math.abs(a-b)<1e-9;

// --- Regeln mit synthetischen Rezepten --------------------------------------------------------
const rez=(over={})=>({quelle:{bewertung:null,anzahlBewertungen:null},backen:{minuten:30},notizen:'',bilanz:{bp:{wasser:105,fett:50,zucker:60,triebkraft:3,hefe:0}},...over});
const dist=(q1,q3,median,n=10)=>({n,min:q1-5,q1,median,q3,max:q3+5});
const st={bilanz:{wasser:dist(100,110,105),fett:dist(45,55,50),zucker:dist(55,65,60),triebkraft:dist(2.5,3.5,3),hefe:dist(0,0,0)}};
let q=qualitaetVorschlag(rez(),st);
ok(BASIS===4 && q.note===4 && near(q.punkte,4) && /keine Seitenwertung/.test(q.grund),'Basis: geprüftes Rezept ohne Auffälligkeit = 4, „keine Seitenwertung“ neutral');
q=qualitaetVorschlag(rez({quelle:{bewertung:5,anzahlBewertungen:124}}),st);
ok(q.note===5 && near(q.punkte,4.5) && /Seite 5★ \(124 Stimmen\) \+0,5/.test(q.grund),'starke Seitenwertung (5★, 124 Stimmen) → 5');
q=qualitaetVorschlag(rez({quelle:{bewertung:5,anzahlBewertungen:3}}),st);
ok(q.note===4 && near(q.punkte,4) && /±0/.test(q.grund),'5★ mit nur 3 Stimmen wird zum Mittel geglättet (kein Bonus)');
q=qualitaetVorschlag(rez({quelle:{bewertung:3.7,anzahlBewertungen:500}}),st);
ok(near(q.punkte,3.5) && /−0,5/.test(q.grund),'schwache Seitenwertung (3,7★, 500 Stimmen) kostet 0,5');
q=qualitaetVorschlag(rez({quelle:{bewertung:3.7,anzahlBewertungen:3}}),st);
ok(near(q.punkte,4),'3,7★ mit 3 Stimmen: geglättet über 4,0 → kein Abzug');
q=qualitaetVorschlag(rez({backen:{minuten:null}}),st);
ok(near(q.punkte,3.5) && /Backzeit fehlt/.test(q.grund),'Backzeit fehlt −0,5');
q=qualitaetVorschlag(rez({notizen:'Mengen angenommen (Päckchen 7 g).'}),st);
ok(near(q.punkte,3.5) && /Mengen angenommen\/unsicher/.test(q.grund),'Notiz „angenommen“ −0,5');
q=qualitaetVorschlag(rez({notizen:'Blog; Betriebsart nicht angegeben'}),st);
ok(near(q.punkte,3.25) && /Blog-Quelle/.test(q.grund) && /Angabe fehlt/.test(q.grund),'Blog −0,5 und „nicht angegeben“ −0,25 summieren sich');
q=qualitaetVorschlag(rez({notizen:'Eigelb zum Bestreichen nicht erfasst, Prise Salz, Zucker umgerechnet'}),st);
ok(near(q.punkte,4),'harmlose Vermerke („nicht erfasst“, „Prise“, „umgerechnet“) kosten nichts');
q=qualitaetVorschlag(rez({notizen:'Mengen unsicher, geschätzt, angenommen; Blog; nicht angegeben',backen:{minuten:null},quelle:{bewertung:3.5,anzahlBewertungen:900}}),st);
ok(q.note===2 && near(q.punkte,4-1.25-0.5-0.5),`Abzüge summieren sich: Notizen höchstens −1,25 (0,5 + 0,5 + 0,25), dazu Backzeit und Seitenwertung (Punkte ${q.punkte})`);
q=qualitaetVorschlag(rez({bilanz:{bp:{wasser:200,fett:50,zucker:60,triebkraft:3,hefe:0}}}),st);
ok(near(q.punkte,3.5) && /Ausreißer bei Gesamtwasser/.test(q.grund),'echter Ausreißer (Wasser 200 bei Q1–Q3 100–110) −0,5');
q=qualitaetVorschlag(rez({bilanz:{bp:{wasser:128,fett:50,zucker:60,triebkraft:3,hefe:0}}}),st);
ok(near(q.punkte,4),'Wert knapp außerhalb von Q1–Q3 (128) ist kein Ausreißer — die Hälfte der Rezepte liegt per Definition außerhalb');
q=qualitaetVorschlag(rez({bilanz:{bp:{wasser:300,fett:200,zucker:300,triebkraft:30,hefe:0}}}),st);
ok(near(q.punkte,3),'Ausreißer-Abzug ist bei −1,0 gedeckelt');
q=qualitaetVorschlag(rez({bilanz:{bp:{wasser:200,fett:50,zucker:60,triebkraft:3,hefe:0}}}),{bilanz:{wasser:dist(100,110,105,3)}});
ok(near(q.punkte,4),'Variante mit weniger als 5 Rezepten: kein Ausreißer-Urteil');
q=qualitaetVorschlag(rez({bilanz:{bp:{wasser:105,fett:50,zucker:60,triebkraft:3,hefe:0,eiweiss:999,emulgator:999,gluten:999}}}),{bilanz:{...st.bilanz,eiweiss:dist(10,12,11),emulgator:dist(1,2,1.5),gluten:dist(8,8,8)}});
ok(near(q.punkte,4),'abgeleitete Größen (Eiweiß, Emulgator, Klebereiweiß) zählen nicht als Ausreißer');
q=qualitaetVorschlag(rez({notizen:'Blog angenommen nicht angegeben',backen:{minuten:null},quelle:{bewertung:3,anzahlBewertungen:9999},bilanz:{bp:{wasser:900,fett:900,zucker:900,triebkraft:90,hefe:0}}}),st);
ok(q.punkte<=2.0 && q.note>=1 && q.note<=2,`schlechtester denkbarer Fall: Note ${q.note} (Punkte ${q.punkte}) — nach unten nie unter 1`);
ok(Number.isInteger(q.note) && qualitaetVorschlag(rez({quelle:{bewertung:5,anzahlBewertungen:99999}}),st).note===5,'bestmöglicher Fall bleibt bei 5');
ok(qualitaetVorschlag(rez({notizen:'angenommen'}),st).note>=1 && qualitaetVorschlag(rez({backen:{minuten:null},notizen:'Blog angenommen nicht angegeben',quelle:{bewertung:3,anzahlBewertungen:9999},bilanz:{bp:{wasser:900,fett:900,zucker:900,triebkraft:90,hefe:90}}}),st).note===Math.max(1,Math.round(4-0.5-1.25-0.5-1)),'Rundung und Untergrenze 1 sind konsistent');

// --- Überschreiben ----------------------------------------------------------------------------------
ok(effektiveQualitaet({qualitaet:3})===3 && effektiveQualitaet({qualitaet:3,qualitaet_manuell:5})===5 && effektiveQualitaet({})===null && effektiveQualitaet(null)===null,'qualitaet_manuell schlägt den Vorschlag; ohne Note → null');
ok(istManuell({qualitaet_manuell:2}) && !istManuell({qualitaet:2}) && !istManuell({}),'istManuell erkennt nur das Überschreibfeld');

// --- Korpus: Werte vorhanden und aktuell --------------------------------------------------------------
const ingredients=J('ingredients'); const archetypes=J('archetypes');
let gesamt=0; const veraltet=[]; const alleNoten=[];
for (const [ak,arch] of Object.entries(archetypes)) {
  if (ak.startsWith('_')) continue;
  const rollen=arch.rollen.map(r=>r.rolle); const referenz=arch.rollen.find(r=>r.referenz)?.rolle??'struktur';
  for (const v of Object.values(arch.varianten)) {
    const roh=J('corpus/'+v.korpus); const norm=roh.map(r=>normalizeRecipe(r,ingredients,{rollen,referenz})); const s=stats(norm,rollen);
    roh.forEach((r,i)=>{
      gesamt++;
      const e=qualitaetVorschlag(norm[i],s);
      if (r.qualitaet!==e.note || r.qualitaet_grund!==e.grund) veraltet.push(r.id);
      alleNoten.push(effektiveQualitaet(r));
    });
  }
}
ok(gesamt>=127 && alleNoten.every(n=>Number.isInteger(n) && n>=1 && n<=5),`alle ${gesamt} Korpus-Rezepte tragen eine ganze Note 1–5`);
ok(veraltet.length===0,`gespeicherte Noten sind aktuell${veraltet.length?' — veraltet: '+veraltet.slice(0,5).join(', ')+' … → node tools/qualitaet.mjs --write':''}`);
ok(new Set(alleNoten).size>=3,`Noten streuen (${[...new Set(alleNoten)].sort().join(', ')}) — nicht alle gleich`);
ok(alleNoten.reduce((a,b)=>a+b,0)/alleNoten.length>3.5 && alleNoten.reduce((a,b)=>a+b,0)/alleNoten.length<4.5,'Ø Note im plausiblen Bereich (geprüfte Rezepte: gut, nicht perfekt)');
const lauf=execSync('node tools/qualitaet.mjs',{encoding:'utf8',cwd:new URL('..',import.meta.url)});
ok(/0 mit neuer oder geänderter Note/.test(lauf),'Skript tools/qualitaet.mjs im Trockenlauf: nichts zu ändern (idempotent)');

// --- Nur Anzeige: Noten verändern keine Menge ------------------------------------------------------------
const arch=archetypes.hefeteig; const rollen=arch.rollen.map(r=>r.rolle);
const aufNote=(n)=>Object.fromEntries(Object.entries(arch.varianten).map(([k,v])=>[k,stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe({...r,qualitaet:n,qualitaet_manuell:undefined},ingredients,{rollen})),rollen)]));
const ksEins=aufNote(1), ksFuenf=aufNote(5);
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const zustand=(vk)=>{const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);return {archetyp:'hefeteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};};
const gleich=Object.keys(arch.varianten).every(vk=>JSON.stringify(compute(zustand(vk),data,ksEins).zutatenListe)===JSON.stringify(compute(zustand(vk),data,ksFuenf).zutatenListe));
ok(gleich,'Mengen der Presets sind unabhängig von den Noten (alle Rezepte Note 1 vs. alle Note 5)');
ok(JSON.stringify(ksEins.weissbrot.bp)===JSON.stringify(ksFuenf.weissbrot.bp) && JSON.stringify(ksEins.weissbrot.proMethode.hefe_direkt.bp)===JSON.stringify(ksFuenf.weissbrot.proMethode.hefe_direkt.bp),'Mediane der Variante und der Methoden-Zellen ändern sich nicht');
ok(ksEins.weissbrot.qualitaet.median===1 && ksFuenf.weissbrot.qualitaet.median===5,'nur die Anzeige-Kennzahl (Ø Qualität) folgt den Noten');

// --- stats(): Anzeige-Felder ----------------------------------------------------------------------------------
const roh=J('corpus/'+arch.varianten.weissbrot.korpus).slice(0,3).map((r,i)=>i===0?{...r,qualitaet:4,qualitaet_grund:'Vorschlag',qualitaet_manuell:2}:r);
const s3=stats(roh.map(r=>normalizeRecipe(r,ingredients,{rollen})),rollen);
ok(s3.quellen[0].qualitaet===2 && /^manuell gesetzt \(Vorschlag 4: Vorschlag\)/.test(s3.quellen[0].qualitaetGrund),'Quellenliste: manuelle Note gewinnt, Begründung nennt den Vorschlag');
ok(s3.quellen[1].qualitaet===roh[1].qualitaet && s3.quellen[1].qualitaetGrund===roh[1].qualitaet_grund,'Quellenliste: Vorschlag samt Begründung für nicht überschriebene Rezepte');
ok(s3.qualitaet.n===3 && s3.qualitaet.min===Math.min(2,roh[1].qualitaet,roh[2].qualitaet),'Kennzahl Ø Qualität zählt die effektive (überschriebene) Note');

console.log(fail?fail+' FAIL':'ALL PASS');
