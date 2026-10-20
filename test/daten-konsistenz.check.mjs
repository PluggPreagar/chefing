// Querprüfungen der Daten: jede Zutat-Kategorie hat Anzeigename und Icon (T21), Verweise zwischen den Dateien lösen sich auf.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const J=(n)=>JSON.parse(fs.readFileSync(new URL(P+'data/'+n+'.json')));
const { ICONS } = await import(P+'ui/icons.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const ing=J('ingredients'), kat=J('kategorien');
const zutaten=Object.entries(ing).filter(([k])=>!k.startsWith('_'));
const katKeys=Object.keys(kat).filter(k=>!k.startsWith('_'));

// --- Kategorien und Icons ----------------------------------------------------------------------------------------
const ohneKat=zutaten.filter(([,z])=>!kat[z.kategorie]).map(([k])=>k);
ok(ohneKat.length===0,`jede der ${zutaten.length} Zutaten hat eine Kategorie aus kategorien.json${ohneKat.length?' — fehlt: '+ohneKat.join(', '):''}`);
const ohneIcon=katKeys.filter(k=>!Array.isArray(ICONS[k]) || !ICONS[k].length);
ok(ohneIcon.length===0,`jede Kategorie hat ein Icon in icons.js (${katKeys.length} Kategorien)${ohneIcon.length?' — fehlt: '+ohneIcon.join(', '):''}`);
const gewuerze=zutaten.filter(([,z])=>z.kategorie==='gewuerz').map(([k])=>k).sort();
ok(gewuerze.join()==='orangenabrieb,senf,vanillearoma,vanilleextrakt,vanillezucker,zimt,zitronenabrieb','Gewürze haben ihre eigene Kategorie (T21): Zimt, Vanille in vier Formen, Zitrus-Abrieb, Senf (T78)');
ok(zutaten.filter(([,z])=>z.kategorie==='pulver').every(([k])=>['backpulver','natron','hefe_frisch','hefe_trocken','kakao','rum'].includes(k)),'„Pulver“ bleibt für Triebmittel, Hefe, Kakao und Rum');
const form=(k)=>JSON.stringify(ICONS[k]);
ok(form('gewuerz')!==form('pulver') && ICONS.gewuerz.length===1 && ICONS.gewuerz[0].tag==='polygon' && ICONS.gewuerz[0].attrs.points.split(' ').length===16 && !ICONS.gewuerz[0].attrs.points.includes('NaN'),'Gewürz-Icon: achtzackiger Stern (16 Punkte), nicht das Pulver-Icon');
const pts=ICONS.gewuerz[0].attrs.points.split(' ').map(p=>p.split(',').map(Number));
ok(pts.every(([x,y])=>x>=0 && x<=24 && y>=0 && y<=24) && pts.some(([x,y])=>Math.abs(x-12)<0.01 && y<3),'Stern liegt in der 24×24-Fläche und zeigt eine Spitze nach oben');
const andere=katKeys.filter(k=>k!=='gewuerz').map(form);
ok(new Set([...andere,form('gewuerz')]).size===katKeys.length,'alle Kategorie-Icons sind voneinander verschieden');

console.log(fail?fail+' FAIL':'ALL PASS');
