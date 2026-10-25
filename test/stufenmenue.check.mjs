// DR-085: Erfahrungsstufe als Auswahlmenü oben auf der Seite. Die Steuerung (src/ui/stufenMenue.js) wird ohne Browser geprüft, dazu die
// Symbole im Symbolsatz und die Anbindung in index.html, main.js und style.css.
import fs from 'fs';
const P = new URL('../', import.meta.url);
const { erzeugeStufenMenue, STUFE_ICON } = await import(new URL('src/ui/stufenMenue.js', P).href);
const { STUFEN, STUFE_TEXT, SCHWELLE } = await import(new URL('src/model/aussagen.js', P).href);
const { ICONS } = await import(new URL('src/ui/icons.js', P).href);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const bau = (aktuell = 'einsteiger') => { const gewaehlt = []; const meldungen = []; const m = erzeugeStufenMenue({ stufen: STUFEN, aktuell, onWahl: (k) => gewaehlt.push(k), melden: (s) => meldungen.push({ ...s }) }); return { m, gewaehlt, meldungen }; };

// --- Steuerung ---------------------------------------------------------------------------------------------------------------------
let b = bau();
ok(JSON.stringify(b.m.stand()) === '{"offen":false,"gewaehlt":"einsteiger","fokus":"einsteiger"}', 'Start: zu, Einsteiger gewählt');
b.m.umschalten();
ok(b.m.stand().offen && b.meldungen.at(-1).offen === true, 'Knopf öffnet die Liste');
b.m.umschalten();
ok(!b.m.stand().offen, 'noch einmal: schließt');
b.m.oeffnen(); b.m.waehle('profi');
ok(b.m.stand().gewaehlt === 'profi' && !b.m.stand().offen && b.gewaehlt.join() === 'profi', 'Wahl: Stufe gesetzt, Liste zu, onWahl genau einmal');
b.m.waehle('gibt-es-nicht');
ok(b.m.stand().gewaehlt === 'profi' && b.gewaehlt.length === 1, 'unbekannte Stufe wird ignoriert');
b.m.setze('fortgeschritten');
ok(b.m.stand().gewaehlt === 'fortgeschritten' && b.gewaehlt.length === 1, 'von außen gesetzt: meldet zurück, ruft onWahl nicht');
b.m.setze('quatsch');
ok(b.m.stand().gewaehlt === 'fortgeschritten', 'von außen unbekannt: bleibt');
ok(bau('quatsch').m.stand().gewaehlt === 'einsteiger', 'unbekannter Start fällt auf Einsteiger zurück');

// Tastatur
b = bau();
ok(b.m.taste('ArrowDown') === true && b.m.stand().offen && b.m.stand().fokus === 'einsteiger', 'Pfeil runter bei geschlossener Liste öffnet sie, Fokus auf der gewählten Stufe');
b.m.taste('ArrowDown');
ok(b.m.stand().fokus === 'fortgeschritten', 'Pfeil runter: nächste Stufe');
b.m.taste('ArrowDown'); b.m.taste('ArrowDown');
ok(b.m.stand().fokus === 'profi', 'Pfeil runter am Ende bleibt am Ende (kein Umlauf)');
b.m.taste('ArrowUp'); b.m.taste('ArrowUp'); b.m.taste('ArrowUp');
ok(b.m.stand().fokus === 'einsteiger', 'Pfeil hoch am Anfang bleibt am Anfang');
b.m.taste('End'); ok(b.m.stand().fokus === 'profi', 'Ende springt zu Profi');
b.m.taste('Home'); ok(b.m.stand().fokus === 'einsteiger', 'Pos1 springt zu Einsteiger');
b.m.taste('End'); b.m.taste('Enter');
ok(b.m.stand().gewaehlt === 'profi' && !b.m.stand().offen && b.gewaehlt.join() === 'profi', 'Enter wählt die fokussierte Stufe und schließt');
ok(b.m.taste('Enter') === true && b.m.stand().offen && b.m.stand().fokus === 'profi', 'Enter bei geschlossener Liste öffnet sie');
b.m.taste(' '); ok(b.m.stand().gewaehlt === 'profi' && !b.m.stand().offen, 'Leertaste wählt wie Enter');
b.m.oeffnen(); ok(b.m.taste('Escape') === true && !b.m.stand().offen && b.m.stand().gewaehlt === 'profi', 'Esc schließt, ohne etwas zu ändern');
ok(b.m.taste('Escape') === false, 'Esc bei geschlossener Liste: nicht behandelt (andere Fenster dürfen reagieren)');
b.m.oeffnen(); ok(b.m.taste('Tab') === false && !b.m.stand().offen, 'Tab schließt und lässt den Fokus weiterwandern');
ok(b.m.taste('a') === false, 'andere Tasten: nicht behandelt');
b = bau(); b.m.oeffnen(); b.m.schliessen(); b.m.schliessen();
ok(b.meldungen.filter((s) => s.offen === false).length === 1, 'schließen meldet nur, wenn die Liste offen war');

// --- Stufen und Symbole ------------------------------------------------------------------------------------------------------------
ok(STUFEN.join() === 'einsteiger,fortgeschritten,profi' && STUFEN.every((k) => STUFE_TEXT[k] && SCHWELLE[k] >= 1), 'drei Stufen mit Name und Schwelle');
ok(STUFE_ICON.einsteiger === 'loeffel' && STUFE_ICON.fortgeschritten === 'besen' && STUFE_ICON.profi === 'kochmuetze', 'Symbole nach der Meldung: Löffel, Schneebesen, Kochmütze');
ok(STUFEN.every((k) => Array.isArray(ICONS[STUFE_ICON[k]]) && ICONS[STUFE_ICON[k]].length && ICONS[STUFE_ICON[k]].every((x) => x.tag && x.attrs)), 'alle drei Symbole stehen im Symbolsatz (icons.js)');

// --- Anbindung ---------------------------------------------------------------------------------------------------------------------
const html = fs.readFileSync(new URL('index.html', P), 'utf8');
const main = fs.readFileSync(new URL('src/main.js', P), 'utf8');
const css = fs.readFileSync(new URL('style.css', P), 'utf8');
const modul = fs.readFileSync(new URL('src/ui/stufenMenue.js', P), 'utf8');
ok(/<div class="top-zeile">\s*<h1>Chefing<\/h1>\s*<div class="top-leiste"[^>]*>\s*<div id="stufe-menue"><\/div>/.test(html), 'index.html: das Menü sitzt oben, als erstes Element der Werkzeugleiste neben dem Titel (DR-087)');
ok(!/ablauf-stufe/.test(html) && !/data-stufe/.test(html) && !/ablauf-stufe/.test(css), 'die Knopfgruppe im Ablauf-Kopf ist weg (HTML und CSS)');
ok(/initStufenMenue\(\$\('stufe-menue'\)/.test(main) && /\$\('ablauf-stufe'\)\?\.remove\(\)/.test(main) && /stufenMenue\.setze\(state\.stufe\)/.test(main) && /localStorage\.setItem\('chefing\.stufe', k\)/.test(main) && !/data-stufe/.test(main), 'main.js: Menü angelegt, alte Gruppe aus dem Cache entfernt, Wahl in localStorage, Anzeige folgt dem Zustand');
ok(/aria-haspopup="listbox"/.test(modul) && /role="listbox"/.test(modul) && /role="option"/.test(modul) && /aria-selected/.test(modul) && /aria-expanded/.test(modul), 'Menü hat die ARIA-Rollen für Listenauswahl (Knopf mit Popup, Liste, Optionen, Auswahl)');
ok(/\.stufe-liste \{[^}]*position: absolute/.test(css) && /\.stufe-liste\[hidden\] \{ display: none; \}/.test(css) && /\.stufe-knopf \{/.test(css), 'style.css: Liste schwebt unter dem Knopf, hidden wird beachtet');
console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
