import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { grenzenBuendeln } = await import(P+'model/bilanz.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));const arch=data.archetypes.ruehrteig;const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(vk, over={}){const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
const alle=(c)=>[...c.gruende,...c.warnungen,...c.toleranzHinweise];

// Stärke allein: vorher 4 Meldungen + 1 Vorschlag, jetzt 1 Warnung (gebündelt) + 1 Vorschlag
let c=compute(st('kastenkuchen',{struktur:E('speisestaerke')}),data,ks);
ok(c.warnungen.length===1 && /Gleiche Ursache/.test(c.warnungen[0]),'Stärke allein: eine gebündelte Warnung statt zwei Grenzmeldungen');
ok(c.toleranzHinweise.length===0 && !c.warnungen.some(w=>/Korpus-Rezepte/.test(w)),'Stärke allein: Korpus-Hinweis „ungetestet“ entfällt (Grenzverletzung erklärt es)');
const k=c.kaskaden.filter(x=>x.rolle==='struktur'&&x.zutat==='weizenmehl');
ok(k.length===1 && (k[0].weitere||[]).length===1,'ein Vorschlag Weizenmehl, zweiter Auslöser unter `weitere`');
ok(c.bilanz.some(b=>b.toleranz==='ausserhalb_spanne'),'Bilanz-Tabelle markiert die Abweichung weiter');

// hart + empfohlen derselben Größe (Reinfett 160 %): nur die harte Meldung
const Z=(groesse,wert,strenge,id,ziel)=>({id,groesse,ziel,text:`${id} ${wert}.`,kurz:`${groesse} ${wert}`,wert});
const v={hart:[Z('fett',160,'hart','fett_max_hart','fett')],empfohlen:[Z('fett',160,'empfohlen','fett_max','fett'),Z('wasser',60,'empfohlen','wasser_band','fluessigkeit')]};
const b=grenzenBuendeln(v);
ok(b.hart.length===1 && b.empfohlen.length===1 && /wasser_band/.test(b.empfohlen[0]),'hart+empfohlen gleiche Größe: empfohlene entfällt, andere Größe bleibt');
const v2={hart:[],empfohlen:[Z('gluten',4,'e','gluten_min','struktur'),Z('eiweiss',10,'e','eiweiss_min','struktur'),Z('triebkraft',9,'e','triebkraft_max','trieb')]};
const b2=grenzenBuendeln(v2);
ok(b2.empfohlen.length===2 && /Gleiche Ursache: eiweiss 10\./.test(b2.empfohlen[0]) && !/Gleiche Ursache/.test(b2.empfohlen[1]),'gleiche Zielrolle gebündelt, andere Zielrolle getrennt');
ok(grenzenBuendeln({hart:[],empfohlen:[]}).hart.length===0,'keine Verletzung → keine Meldung');

// Presets bleiben still, 1:1-Mischung zeigt weiterhin genau die Warnung + den Vorschlag
for (const vk of Object.keys(arch.varianten)){c=compute(st(vk),data,ks); ok(alle(c).length===0 || c.status!=='invalid',`${vk}: Preset gültig`);}
c=compute(st('kastenkuchen',{struktur:[{zutat:'weizenmehl',anteil:1},{zutat:'speisestaerke',anteil:3}]}),data,ks);
ok(c.warnungen.filter(w=>/Klebereiweiß nur/.test(w)).length===1,'Mehl+Stärke 1:3: Klebereiweiß-Warnung genau einmal');
console.log(fail?fail+' FAIL':'ALL PASS');
