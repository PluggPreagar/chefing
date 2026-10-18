// T10: Substitutions-Freiheit je Rolle — gemessen (rollenFreiheit.js), in archetypes.json eingetragen, im Morphologischen Kasten gezeigt.
import fs from 'fs';
import { execFileSync } from 'child_process';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { stats, normalizeRecipe } = await import(P+'model/corpus.js');
const { rollenFreiheit } = await import(P+'model/rollenFreiheit.js');
const { SUBSTITUTION } = await import(P+'ui/morphbox.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
const ks={};
for (const [ak,a] of Object.entries(data.archetypes)) { if (ak.startsWith('_')) continue; const rollen=a.rollen.map(x=>x.rolle), referenz=a.rollen.find(x=>x.referenz)?.rolle??'struktur';
  for (const [vk,v] of Object.entries(a.varianten)) ks[vk]=stats(J('corpus/'+v.korpus).map(x=>normalizeRecipe(x,data.ingredients,{rollen,referenz})),rollen); }
const mess={}; for (const ak of Object.keys(data.archetypes).filter(k=>!k.startsWith('_'))) mess[ak]=rollenFreiheit(ak,data,ks);

// --- Daten und Messung stimmen überein ------------------------------------------------------------------------------------------
const abw=[]; let nRollen=0, nMarkiert=0;
for (const [ak,a] of Object.entries(data.archetypes)) { if (ak.startsWith('_')) continue;
  for (const r of a.rollen) { nRollen++; const g=mess[ak][r.rolle].stufe; if ((r.substitution??null)!==g) abw.push(`${ak}/${r.rolle}: Daten ${r.substitution??'—'}, Messung ${g??'—'}`); if (r.substitution) nMarkiert++; } }
ok(abw.length===0,`archetypes.json trägt für alle ${nRollen} Rollen genau die gemessene Substitutions-Freiheit${abw.length?' — '+abw.join('; '):''} (node tools/rollen-freiheit.mjs, dann archetypes.json nachtragen)`);
ok(Object.values(data.archetypes).filter(a=>Array.isArray(a?.rollen)).every(a=>a.rollen.every(r=>r.substitution===undefined||['frei','empfohlen','strikt'].includes(r.substitution))) && nMarkiert===21,'nur die Werte frei / empfohlen / strikt; 21 von 25 Rollen tragen eine Markierung');
ok(/GEMESSEN/.test(data.archetypes._schema.substitution) && /tools\/rollen-freiheit\.mjs/.test(data.archetypes._schema.substitution),'Schema erklärt das Feld und nennt das Werkzeug');

// --- gemessene Befunde --------------------------------------------------------------------------------------------------------------
ok(mess.ruehrteig.trieb.stufe==='strikt' && mess.pfannkuchen.trieb.stufe==='strikt' && mess.ruehrteig.trieb.belege.some(b=>/natron → strikt/.test(b)),'Trieb ist strikt: Natron ohne saure Zutat macht das Rezept ungültig (harte Regel an „backen“)');
ok(['ruehrteig','pfannkuchen','hefeteig'].every(ak=>mess[ak].einlage.stufe==='frei') && ['ruehrteig','pfannkuchen'].every(ak=>mess[ak].aroma.stufe==='frei'),'Einlage ist in allen drei Archetypen frei austauschbar, Aroma in Rührteig und Pfannkuchen (kein Wechsel erzeugt eine Meldung)');
ok(mess.hefeteig.aroma.stufe==='empfohlen' && mess.hefeteig.aroma.belege.every(b=>/vanillezucker/.test(b)),'Aroma im Hefeteig: nur Vanillezucker löst einen Hinweis aus (er zählt als Zucker und schiebt den Zopf über die Korpus-Spanne) — die anderen Aromen sind frei');
ok(mess.ruehrteig.struktur.stufe==='empfohlen' && mess.ruehrteig.struktur.belege.some(b=>/haselnuss_gemahlen/.test(b)),'Struktur im Rührteig: „empfohlen“, nicht „strikt“ — Nüsse und Stärke lösen die Gluten-Grenze aus, die empfohlen ist (nicht hart)');
ok(['ruehrteig','pfannkuchen','hefeteig'].every(ak=>mess[ak].fluessigkeit.stufe==='empfohlen') && mess.pfannkuchen.fett.stufe==='empfohlen' && mess.ruehrteig.fett.stufe==='empfohlen','Flüssigkeit und Fett: empfohlen (anderer Wechsel erzeugt Hinweise)');
ok(mess.hefeteig.trieb.stufe==='frei' && mess.hefeteig.fett.stufe==='empfohlen' && mess.hefeteig.fett.belege.some(b=>/hefezopf: keine/.test(b)),'Hefeteig: Frisch- und Trockenhefe sind austauschbar (frei); Fett weglassen im Zopf gibt Hinweise');
ok(['bindung'].every(r=>mess.ruehrteig[r].stufe===null && mess.pfannkuchen[r].stufe===null) && mess.hefeteig.struktur.stufe===null && mess.hefeteig.salz.stufe===null,'Rollen mit nur einer Option (Ei, Weizenmehl im Hefeteig, Salz) bieten keine Wahl: keine Markierung');
ok(mess.pfannkuchen.einlage.stufe==='frei' && data.archetypes.pfannkuchen.rollen.find(r=>r.rolle==='einlage').optionen.length===1,'optionale Rolle mit einer Option zählt „keine“ als Wahl (Pfannkuchen-Einlage: Blaubeeren oder keine)');
ok(Object.values(mess).every(m=>Object.values(m).every(x=>x.belege.length<=3 && (x.stufe==='frei'||x.stufe===null)===(x.belege.length===0))),'Belege: höchstens 3 je Rolle, nur wenn die Rolle nicht frei ist');

// --- Anzeige ------------------------------------------------------------------------------------------------------------------------------
ok(Object.keys(SUBSTITUTION).join()==='frei,empfohlen,strikt' && new Set(Object.values(SUBSTITUTION).map(x=>x.text)).size===3 && Object.values(SUBSTITUTION).every(x=>x.titel.length>30),'Anzeige: drei verschiedene Texte mit Erklärung für die Tooltips');
const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
ok(['frei','empfohlen','strikt'].every(k=>css.includes(`.dim-subst.is-${k}`)),'style.css hat eine Farbe je Stufe');

// --- Werkzeug --------------------------------------------------------------------------------------------------------------------------------
const tool=new URL('../tools/rollen-freiheit.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const out=execFileSync(process.execPath,[tool],{encoding:'utf8'});
ok(/Messung und archetypes\.json stimmen überein/.test(out) && /natron → strikt/.test(out) && /keine Wahl/.test(out),'Werkzeug: Ausgabe mit Belegen, „keine Wahl“ und Übereinstimmung (Exit-Code 0)');

console.log(fail?fail+' FAIL':'ALL PASS');
