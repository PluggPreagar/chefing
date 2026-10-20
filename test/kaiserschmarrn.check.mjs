// T90/DR-059: Kaiserschmarrn als Variante der Pfannkuchen — Korpus, Eischnee typisch (gemessen), Ablauf, Salz-Rolle, Wasser-Ausnahme
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { normalizeRecipe, stats } = await import(P+'model/corpus.js');
const { compute } = await import(P+'model/engine.js');
const { technikStufe } = await import(P+'model/rules.js');
const { grenzenFuer } = await import(P+'model/bilanz.js');
const names=['ingredients','operations','methods','archetypes','vessels','kategorien','verben','erfahrungsregeln','grenzen','techniken','orte','triebquellen','werkzeuge','modelle','temperaturen'];
const data=Object.fromEntries(names.map(n=>[n,J(n)]));
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const arch=data.archetypes.pfannkuchen, rollen=arch.rollen.map(r=>r.rolle);
const ks=Object.fromEntries(Object.entries(arch.varianten).map(([k,x])=>[k,stats(J('corpus/'+x.korpus).map(r=>normalizeRecipe(r,data.ingredients,{rollen,referenz:'struktur'})),rollen)]));
const E=(w)=>w==null?[]:[{zutat:w,anteil:1}];
const v=arch.varianten.kaiserschmarrn;
const st=(over={},techniken={})=>{const z={}; for(const r of arch.rollen) z[r.rolle]=E(v.bestof[r.rolle]!==undefined?v.bestof[r.rolle]:r.default); Object.assign(z,over); return {archetyp:'pfannkuchen',gefaess:v.gefaess,methode:null,fixiert:{rollen:{},zutaten:{}},zutaten:z,techniken};};
const rechne=(...a)=>compute(st(...a),{...data,arch},ks);

const k=ks.kaiserschmarrn;
ok(k.n>=10 && k.methoden.schmarrn===k.n,`Korpus: ${k.n} Rezepte, alle Methode Schmarrn`);
ok(k.techniken.eier_getrennt.anteil>=0.8 && technikStufe(arch,'kaiserschmarrn','eier_getrennt',k.techniken.eier_getrennt)==='typisch',`Eischnee gemessen typisch (${Math.round(k.techniken.eier_getrennt.anteil*100)} % der Rezepte, breit gesucht)`);

let c=rechne();
ok(c.variante==='kaiserschmarrn' && c.methodKey==='schmarrn' && c.status==='ok' && !c.warnungen.length,`Standard: ${c.varianteLabel}, ${c.method.label}, ohne Warnung`);
ok(c.ablauf.map(s=>s.key).join()==='einlegen,kschm_teig,einlage_unterheben,anbacken,zerreissen,karamellisieren','Ablauf: Rosinen einlegen → Teig → Rosinen unterheben → anbacken → zerreißen → karamellisieren');
const g=(rolle)=>c.zutatenListe.find(z=>z.rolle===rolle);
ok(g('salz') && g('salz').bp<=2 && g('aroma').zutat==='vanillezucker','eigene Salz-Rolle: Salz höchstens 2 % vom Mehl, Aroma = Vanillezucker');
ok(g('bindung').bp>=100,`eierreich: ${Math.round(g('bindung').bp)} % Ei vom Mehl`);

c=rechne({},{eier_getrennt:true});
const i=(key)=>c.ablauf.findIndex(s=>s.key===key);
ok(i('eischnee_unterheben')>=0 && i('eischnee_unterheben')<i('anbacken') && c.ablauf.find(s=>s.key==='eischnee_unterheben').skizze==='unterheben','mit Eischnee: Unterheben vor dem Anbacken, mit Skizze');
ok(c.gas?.anteile.some(a=>a.key==='eischnee'),'Gas-Budget zählt den Eischnee');

const G=data.grenzen.archetypen.pfannkuchen;
ok(!grenzenFuer(G,{methode:'schmarrn',techniken:[]}).some(x=>x.id==='pk_wasser_band') && grenzenFuer(G,{methode:'pfannkuchen_glatt',techniken:[]}).some(x=>x.id==='pk_wasser_band') && grenzenFuer(G,{methode:'schmarrn',techniken:[]}).some(x=>x.id==='pk_wasser_max_hart'),'Wasser-Band gilt nicht beim Schmarrn (wird zerrissen, Ei stockt), die harte Grenze schon');

console.log(fail?`${fail} FAILED`:'ALL PASS');
process.exit(fail?1:0);
