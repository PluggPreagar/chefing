// T07: Einheiten und Statistik (units.js) — Grundlage jeder Korpus-Normalisierung.
import fs from 'fs';
const P=new URL('../src/', import.meta.url).href;
const ingredients=JSON.parse(fs.readFileSync(new URL(P+'data/ingredients.json')));
const { toGrams, fromGrams, bakersPercent, quantile, median, summarize } = await import(P+'model/units.js');
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++;};
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;

// --- toGrams ---------------------------------------------------------------------------------------
const mehl=ingredients.weizenmehl, ei=ingredients.ei, milch=ingredients.milch, oel=ingredients.pflanzenoel, bp=ingredients.backpulver;
ok(toGrams(mehl,250,'g')===250,'Gramm bleiben Gramm');
ok(toGrams(milch,200,'ml')===206 && near(toGrams(oel,100,'ml'),92),'ml über die Dichte der Zutat (Milch 1,03; Öl 0,92)');
ok(toGrams(ingredients.wasser,100,'ml')===100 && toGrams(mehl,100,'ml')===100,'ml ohne Dichte-Angabe zählen 1 : 1');
ok(toGrams(ei,3,'stk')===165,'Stück über die Zutat (Ei 55 g)');
ok(toGrams(mehl,2,'el')===20 && toGrams(mehl,1,'tl')===3,'EL und TL über die Zutat');
ok(toGrams(bp,1,'pkt')===15,'Päckchen Backpulver = 15 g');
ok(toGrams(ingredients.hefe_trocken,1,'pkt')===7 && toGrams(ingredients.hefe_frisch,1,'stk')===42,'Päckchen Trockenhefe 7 g, Würfel Frischhefe 42 g');
ok(toGrams(mehl,1,'pkt')===null && toGrams(mehl,1,'prise')===null,'Einheit ohne Umrechnung → null (nicht umrechenbar)');
ok(toGrams(mehl,null,'g')===null && toGrams(mehl,NaN,'g')===null && toGrams(mehl,Infinity,'g')===null,'ungültige Menge → null');
ok(toGrams(undefined,2,'stk')===null && toGrams(undefined,5,'g')===5,'Zutat unbekannt: nur Gramm gehen');
ok(near(toGrams(ingredients.salz,1,'prise'),1) && toGrams(ingredients.salz,1,'tl')===6,'Salz: Prise 1 g, TL 6 g');

// --- fromGrams -------------------------------------------------------------------------------------
let r=fromGrams('ei',ei,165);
ok(r.menge===3 && r.einheit==='Stk' && r.hinweis==='≈ 165 g','Ei: Stückzahl mit Gramm-Hinweis');
ok(fromGrams('ei',ei,10).menge===1,'Ei: mindestens 1 Stück');
r=fromGrams('milch',milch,206);
ok(r.einheit==='ml' && r.menge===200 && r.hinweis===null,'Flüssigkeit: ml (Dichte zurückgerechnet)');
ok(fromGrams('milch',milch,515).menge===500,'Flüssigkeit ab 50: auf 5 gerundet (515 g → 500 ml)');
ok(fromGrams('milch',milch,40).menge===39 && fromGrams('milch',milch,100).menge===95,'Flüssigkeit: unter 50 ml auf 1, ab 50 ml auf 5 gerundet (40 g → 39 ml, 100 g → 95 ml)');
r=fromGrams('backpulver',bp,15);
ok(r.einheit==='g' && r.menge===15 && r.hinweis==='≈ 1 Pck.','Backpulver: 15 g = 1 Pck.');
ok(fromGrams('backpulver',bp,22.5).hinweis==='≈ 1½ Pck.','Backpulver: 22,5 g = 1½ Pck. (auf halbe Stücke gerundet)');
ok(fromGrams('backpulver',bp,7.5).hinweis==='≈ ½ Pck.','Backpulver: 7,5 g = ½ Pck.');
ok(fromGrams('backpulver',bp,5).hinweis==='≈ 1½ TL' && fromGrams('backpulver',bp,5).menge===5,'unter 40 % eines Päckchens: Teelöffel-Hinweis (3,5 g je TL)');
r=fromGrams('salz',ingredients.salz,9);
ok(r.menge===9 && r.hinweis==='≈ 1½ TL','Salz: unter 25 g mit TL-Hinweis');
ok(fromGrams('zucker',ingredients.zucker,40).hinweis===null && fromGrams('zucker',ingredients.zucker,12).hinweis==='≈ 2½ TL','Zucker: ab 25 g kein TL-Hinweis, 12 g = 2½ TL');
r=fromGrams('weizenmehl',mehl,252);
ok(r.menge===250 && r.einheit==='g' && r.hinweis===null,'Mehl über 50 g: auf 5 g gerundet');
r=fromGrams('weizenmehl',mehl,12);
ok(r.menge===12 && r.hinweis==='≈ 4 TL','Mehl unter 25 g: TL-Hinweis (3 g je TL)');
ok(fromGrams('hefe_trocken',ingredients.hefe_trocken,7).hinweis==='≈ 1 Pck.' && fromGrams('hefe_trocken',ingredients.hefe_trocken,3.5).hinweis==='≈ ½ Pck.','Trockenhefe: Päckchen-Hinweis');
ok(fromGrams('weizenmehl',undefined,100).einheit==='g','unbekannte Zutat: Gramm');

// --- Bäckerprozent -------------------------------------------------------------------------------
ok(bakersPercent(50,200)===25 && bakersPercent(200,200)===100,'Bäckerprozent: Gramm / Referenz');
ok(bakersPercent(50,0)===null && bakersPercent(null,200)===null,'Bäckerprozent: Referenz 0 oder fehlend → null');
ok(bakersPercent(0,200)===0,'Bäckerprozent: 0 g = 0 %');

// --- Statistik ---------------------------------------------------------------------------------------
ok(quantile([],0.5)===null && quantile([null,undefined,NaN],0.5)===null,'Quantil: leer → null');
ok(quantile([5],0.25)===5 && quantile([1,2],0.5)===1.5,'Quantil: ein Wert; Interpolation zwischen zwei Werten');
ok(median([3,1,2])===2 && median([4,1,3,2])===2.5,'Median: ungerade/gerade Anzahl, unsortiert');
ok(near(quantile([1,2,3,4,5],0.25),2) && near(quantile([1,2,3,4,5],0.75),4),'Quartile (lineare Interpolation)');
ok(near(quantile([10,20,30,40],0.25),17.5) && near(quantile([10,20,30,40],0.75),32.5),'Quartile mit Interpolation (n = 4)');
const s=summarize([4,null,1,NaN,2,3,undefined]);
ok(s.n===4 && s.min===1 && s.max===4 && s.median===2.5 && s.q1===1.75 && s.q3===3.25,'summarize ignoriert null/NaN/undefined');
ok(summarize([])===null && summarize([null])===null,'summarize: leer → null');
const e=summarize([8,8,8,8]);
ok(e.min===8 && e.q1===8 && e.median===8 && e.q3===8 && e.max===8,'summarize: lauter gleiche Werte → Spanne null breit');
ok(quantile([1,2,3],0)===1 && quantile([1,2,3],1)===3,'Quantil 0 und 1 = Minimum und Maximum');

console.log(fail?fail+' FAIL':'ALL PASS');
