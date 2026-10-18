import fs from 'fs';
const P=new URL('../src/', import.meta.url).pathname; const J=(n)=>JSON.parse(fs.readFileSync(P+'data/'+n+'.json'));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js'); const { compute } = await import(P+'model/engine.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));const arch=data.archetypes.ruehrteig;const ks={};
for (const [k,v] of Object.entries(arch.varianten)) ks[k]=stats(J('corpus/'+v.korpus).map(r=>normalizeRecipe(r,data.ingredients)));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const E=(w)=>w==null?[]:Array.isArray(w)?w:[{zutat:w,anteil:1}];
function st(vk, over={}){const v=arch.varianten[vk];const z={};for(const r of arch.rollen)z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default);Object.assign(z,over);return {archetyp:'ruehrteig',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z};}
const B=(c,g)=>c.bilanz.find(b=>b.groesse===g);
const has=(c,re)=>[...c.warnungen,...c.gruende,...c.toleranzHinweise].some(t=>re.test(t));
for (const vk of Object.keys(arch.varianten)){const c=compute(st(vk),data,ks); ok(c.status!=='invalid' && !has(c,/Klebereiweiß nur|Gesamteiweiß .* Grenze|Triebkraft .* Grenze/),`${vk}: Preset ohne Funktions-Grenzen-Meldung`); console.log('   ',c.bilanz.map(b=>`${b.groesse} ${b.bp.toFixed(1)} [${b.toleranz}]`).join(' | '));}
let c=compute(st('kastenkuchen',{struktur:E('speisestaerke')}),data,ks);
ok(has(c,/Klebereiweiß nur 0,0/) && c.kaskaden.some(k=>k.rolle==='struktur'&&k.zutat==='weizenmehl'),'Stärke allein → gluten_min + Vorschlag Weizenmehl');
ok(has(c,/Gesamteiweiß/),'Stärke allein → auch eiweiss_min');
c=compute(st('kastenkuchen',{struktur:[{zutat:'weizenmehl',anteil:7},{zutat:'speisestaerke',anteil:1}]}),data,ks);
ok(!has(c,/Klebereiweiß nur/),`Mehl 7 : Stärke 1 → ok (Gluten ${B(c,'gluten').bp.toFixed(1)} %)`);
c=compute(st('kastenkuchen',{struktur:[{zutat:'weizenmehl',anteil:1},{zutat:'speisestaerke',anteil:1}]}),data,ks);
ok(has(c,/Klebereiweiß nur/),`Mehl 1 : Stärke 1 → Warnung (alte Regel sah nur Dominante; Gluten ${B(c,'gluten').bp.toFixed(1)} %)`);
c=compute(st('kastenkuchen',{struktur:E('mandeln_gemahlen')}),data,ks);
ok(has(c,/Klebereiweiß nur/) && !has(c,/Gesamteiweiß .*Grenze/),`Mandeln: kein Gluten, aber Eiweiß ${B(c,'eiweiss').bp.toFixed(1)} % reicht`);
const cb=compute(st('kastenkuchen',{fluessigkeit:E('buttermilch')}),data,ks), cn=compute(st('kastenkuchen',{fluessigkeit:E('buttermilch'),trieb:E('natron')}),data,ks);
console.log('   Triebkraft Backpulver+Buttermilch',B(cb,'triebkraft').bp.toFixed(2),'| Natron+Buttermilch',B(cn,'triebkraft').bp.toFixed(2), cn.anpassungen);
ok(Math.abs(B(cn,'triebkraft').bp/B(cb,'triebkraft').bp-1)<0.35,'Natron-Drittelregel ≈ gleiche Triebkraft wie Backpulver (Konsistenz Erfahrungsregel ↔ Funktionsvektor)');
console.log(fail?`${fail} FAIL`:'ALL PASS');
