// Fehler melden (DR-044): Issue-Reporter nach dem Vorbild aus aktien-monitor (issue.js) — Panel mit Titel, Beschreibung,
// automatischen Feldern (Seite, Version, App-Zustand, JS-Fehler, letzte Aktionen), Element-Auswahl, Wireframe-Skizze
// und Anhängen. Die Meldung wird im Browser zu einer ZIP-Datei (issue.md, meta.json, wireframe.png, anhang/); „Absenden“
// schickt sie an chefing-issue.php (DR-077), „ZIP herunterladen“ speichert sie zum Verschicken per Mail (DR-044).
// Gesendet wird nur auf Klick.
import { zipErstellen } from '../model/zip.js';
import { meldungDateien } from '../model/meldung.js';
import { sendeFehlermeldung } from '../model/meldungSenden.js';
import { inZwischenablage } from './zwischenablage.js';

const SK = 'chefing-aktionen';
const MAX = 30;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const txt = (el) => (el && (el.innerText || el.textContent) || '').trim().replace(/\s+/g, ' ');

// ---- Aktionen und JS-Fehler mitschreiben (Ringpuffer im Tab) ----
let aktionen = (() => { try { return JSON.parse(sessionStorage.getItem(SK) || '[]'); } catch { return []; } })();
const fehler = [];
const imPanel = (el) => el?.closest?.('#fm-panel, #fm-pickbar, .fm-ov');
function merke(art, detail) {
  aktionen.push({ t: new Date().toLocaleTimeString('de-DE'), a: art, d: String(detail).slice(0, 140) });
  aktionen = aktionen.slice(-MAX);
  try { sessionStorage.setItem(SK, JSON.stringify(aktionen)); } catch { /* privater Modus: nur im Speicher */ }
}
function beschreibe(el) {
  if (!el?.tagName) return '';
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id; else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
  const t = (el.getAttribute?.('aria-label') || txt(el) || el.value || '').slice(0, 40);
  return s + (t ? ` "${t}"` : '');
}
document.addEventListener('click', (e) => {
  if (!imPanel(e.target) && !waehlen) merke('Klick', beschreibe(e.target.closest('a,button,label,input,select,summary,[data-preset]') || e.target));
}, true);
document.addEventListener('change', (e) => {
  if (imPanel(e.target)) return;
  const el = e.target;
  merke('Eingabe', `${el.id || el.name || el.tagName} = ${el.type === 'checkbox' ? el.checked : el.value}`);
}, true);
addEventListener('error', (e) => { fehler.push(`${e.message || ''} @${(e.filename || '').split('/').pop()}:${e.lineno}`); merke('JS-Fehler', e.message); });
addEventListener('unhandledrejection', (e) => { fehler.push(`Promise: ${e.reason?.message || e.reason}`); merke('JS-Fehler', e.reason); });
merke('Seite', document.title);

let markiert = '';
document.addEventListener('selectionchange', () => {
  const t = String(getSelection() || '').trim();
  if (t && !document.activeElement?.closest?.('#fm-panel')) markiert = t.slice(0, 2000); // markierter Text vor dem Klick auf „Fehler melden“
});

// ---- Element-Auswahl ----
let waehlen = false;
let picks = [];
let anhaenge = [];
let schwebe = null;
let kontext = () => ({});

function selektor(el) {
  const teile = [];
  while (el && el.nodeType === 1 && el !== document.body && teile.length < 8) { // tief genug bis zum nächsten Element mit id (#flow, #morphbox)
    let s = el.tagName.toLowerCase();
    if (el.id) { teile.unshift(`${s}#${CSS.escape(el.id)}`); break; }
    const geschw = [...el.parentNode.children].filter((x) => x.tagName === el.tagName);
    if (geschw.length > 1) s += `:nth-of-type(${geschw.indexOf(el) + 1})`;
    teile.unshift(s);
    el = el.parentNode;
  }
  return teile.join(' > ');
}
// SVG-Teil → ganzes Icon, unsichtbar kleine Elemente → Elternteil
function ziel(el) {
  const sv = el.closest?.('svg');
  if (sv) el = sv.parentElement;
  while (el?.parentElement && (el.getBoundingClientRect().width < 4 || el.getBoundingClientRect().height < 4)) el = el.parentElement;
  return el;
}
const kasten = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
// Wo in Chefing liegt das Element? Panel, Zeile im Kasten, Schritt im Ablauf, Rezept-Tabelle → ohne Screenshot nachvollziehbar
function umfeld(el) {
  const c = {};
  const panel = el.closest('.panel');
  const h = panel?.querySelector('h2');
  if (h) c.panel = txt(h);
  const dim = el.closest('.dim');
  if (dim) c.kasten_zeile = txt(dim.querySelector('.dim-title'));
  const zeile = el.closest('.strom-zeile');
  if (zeile) c.ablauf_zeile = txt(zeile.querySelector('.z-label')).slice(0, 80) || txt(zeile).slice(0, 80);
  const knopf = el.closest('button');
  if (knopf?.getAttribute('aria-label')) c.knopf = knopf.getAttribute('aria-label');
  const tr = el.closest('tr');
  if (tr) c.tabellen_zeile = [...tr.cells].map((x) => txt(x)).filter(Boolean).join(' · ').slice(0, 160);
  if (el.dataset && Object.keys(el.dataset).length) c.data = { ...el.dataset };
  c.html = el.outerHTML.slice(0, 1500);
  return c;
}
function pickStart() {
  waehlen = true;
  $('#fm-panel').style.display = 'none';
  const b = document.createElement('div');
  b.id = 'fm-pickbar';
  b.innerHTML = 'Element anklicken (mehrfach) · Esc = fertig <button type="button">Übernehmen</button>';
  document.body.append(b);
  b.querySelector('button').onclick = (e) => { e.stopPropagation(); pickEnde(); };
  schwebe = document.createElement('div');
  schwebe.className = 'fm-ov';
  document.body.append(schwebe);
}
function pickEnde() {
  if (!waehlen) return;
  waehlen = false;
  $('#fm-pickbar')?.remove();
  schwebe?.remove();
  schwebe = null;
  const p = $('#fm-panel');
  if (p) { p.style.display = ''; zeigePicks(); }
}
document.addEventListener('mousemove', (e) => {
  if (!waehlen || !schwebe || e.target.closest('#fm-pickbar')) return;
  const k = kasten(ziel(e.target));
  Object.assign(schwebe.style, { left: k.x + 'px', top: k.y + 'px', width: k.w + 'px', height: k.h + 'px' });
}, true);
document.addEventListener('click', (e) => {
  if (!waehlen || e.target.closest('#fm-pickbar')) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const el = ziel(e.target);
  picks.push({ selector: selektor(el), text: (txt(el) || el.value || '').slice(0, 200), bbox: kasten(el), tag: el.tagName.toLowerCase(), ctx: umfeld(el) });
  markiere();
}, true);
['mousedown', 'mouseup', 'pointerdown', 'input', 'change', 'submit'].forEach((t) => document.addEventListener(t, (e) => {
  if (waehlen && !e.target.closest('#fm-pickbar')) { e.preventDefault(); e.stopPropagation(); }
}, true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (waehlen) pickEnde(); else if ($('#fm-panel')) schliessen(); } });
function markiere() {
  document.querySelectorAll('.fm-ov.sel').forEach((x) => x.remove());
  picks.forEach((k, i) => {
    const d = document.createElement('div');
    d.className = 'fm-ov sel';
    Object.assign(d.style, { left: k.bbox.x + 'px', top: k.bbox.y + 'px', width: k.bbox.w + 'px', height: k.bbox.h + 'px' });
    d.innerHTML = `<span>${i + 1}</span>`;
    document.body.append(d);
  });
}

// ---- Wireframe (Canvas, ohne Fremd-Bibliothek): Flächen und Textbalken statt Screenshot ----
function wireframe() {
  const DW = document.documentElement.scrollWidth;
  const DH = Math.min(document.documentElement.scrollHeight, 12000);
  const S = Math.min(1, 1200 / DW);
  const c = document.createElement('canvas');
  c.width = Math.round(DW * S); c.height = Math.round(DH * S);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const R = (k, f, s) => { if (f) { g.fillStyle = f; g.fillRect(k.x * S, k.y * S, k.w * S, k.h * S); } if (s) { g.strokeStyle = s; g.lineWidth = 1; g.strokeRect(k.x * S + 0.5, k.y * S + 0.5, k.w * S, k.h * S); } };
  const sichtbar = (el) => {
    if (imPanel(el)) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  document.querySelectorAll('header').forEach((el) => sichtbar(el) && R(kasten(el), '#f1f3f5', '#ced4da'));
  document.querySelectorAll('.panel, details').forEach((el) => sichtbar(el) && R(kasten(el), '#fafbfc', '#ced4da'));
  document.querySelectorAll('table').forEach((el) => { if (sichtbar(el)) R(kasten(el), null, '#adb5bd'); });
  document.querySelectorAll('.bar, .bogen').forEach((el) => sichtbar(el) && R(kasten(el), '#e3d3b0', null)); // Ablauf-Linien
  document.querySelectorAll('input, select, textarea, button').forEach((el) => sichtbar(el) && R(kasten(el), el.tagName === 'BUTTON' ? '#e7ecf7' : '#fff', el.tagName === 'BUTTON' ? '#91a7d0' : '#adb5bd'));
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rg = document.createRange();
  let n; let anzahl = 0;
  while ((n = w.nextNode()) && anzahl < 6000) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || !sichtbar(el) || el.closest('svg, script, style')) continue;
    rg.selectNodeContents(n);
    const gross = /^H[1-3]$/.test(el.tagName) || el.closest('h1, h2, h3, b, strong, th');
    for (const r of rg.getClientRects()) {
      if (!r.width) continue;
      anzahl++;
      g.fillStyle = gross ? '#868e96' : '#ced4da';
      const h = Math.max(2, r.height * (gross ? 0.55 : 0.4));
      g.fillRect((r.left + scrollX) * S, (r.top + scrollY + (r.height - h) / 2) * S, r.width * S, h * S);
    }
  }
  picks.forEach((k, i) => {
    g.lineWidth = 2.5; g.strokeStyle = '#e5484d'; g.fillStyle = 'rgba(229,72,77,.12)';
    g.fillRect(k.bbox.x * S, k.bbox.y * S, k.bbox.w * S, k.bbox.h * S);
    g.strokeRect(k.bbox.x * S, k.bbox.y * S, k.bbox.w * S, k.bbox.h * S);
    const lx = Math.max(0, k.bbox.x * S - 9); const ly = Math.max(0, k.bbox.y * S - 9);
    g.fillStyle = '#e5484d'; g.beginPath(); g.arc(lx + 9, ly + 9, 9, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), lx + 9, ly + 13);
  });
  return c.toDataURL('image/png');
}

// ---- Panel ----
function automatisch() {
  const v = globalThis.CHEFING_VERSION;
  return {
    seite: location.pathname + location.search + location.hash,
    zeit: new Date().toLocaleString('de-DE'),
    version: v ? { sha: String(v.sha).slice(0, 7), commit: v.time, deployed: v.deployed } : 'lokal (ohne version.json)',
    markiert: markiert || undefined,
    viewport: `${innerWidth}×${innerHeight}`,
    browser: navigator.userAgent,
    app: (() => { try { return kontext(); } catch (e) { return { fehler: String(e) }; } })(),
    js_fehler: fehler,
    letzte_aktionen: aktionen.map((x) => `${x.t} ${x.a}: ${x.d}`),
  };
}

function oeffnen() {
  if ($('#fm-panel')) return;
  const p = document.createElement('div');
  p.id = 'fm-panel';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Fehler melden');
  p.innerHTML = `
<div class="fm-kopf"><b>Fehler melden</b><button type="button" class="fm-x" id="fm-x" aria-label="Schließen (Esc)">✕</button></div>
<div class="fm-inhalt">
 <label for="fm-t">Titel</label><input type="text" id="fm-t" maxlength="120" placeholder="Kurz: was ist falsch?">
 <label for="fm-d">Beschreibung</label><textarea id="fm-d" rows="5" placeholder="Erwartet / tatsächlich / Schritte"></textarea>
 <div class="fm-reihe"><button type="button" id="fm-pick">Elemente zeigen</button><span class="fm-leise" id="fm-pn">keine gewählt</span></div>
 <div class="fm-picks" id="fm-picks"></div>
 <div class="fm-leise">Wireframe (gewählte Elemente rot markiert)</div><img class="fm-wf" id="fm-wf" alt="Wireframe der Seite">
 <label class="fm-drop" id="fm-drop">Anhänge (z. B. Foto vom Gebäck): Dateien hierher ziehen oder <u>auswählen</u><input type="file" id="fm-f" multiple hidden></label>
 <div class="fm-leise" id="fm-fl"></div>
 <details><summary class="fm-leise">Automatisch erfasst (editierbar)</summary><textarea class="fm-auto" id="fm-a" aria-label="Automatisch erfasste Angaben"></textarea></details>
 <p class="fm-leise">Gesendet wird erst mit „Absenden“: Titel, Beschreibung, gewählte Elemente, Wireframe, Anhänge und die automatisch erfassten Angaben (auch die Browser-Kennung) gehen an den Server dieser Seite, ohne IP-Adresse und Cookies. „ZIP herunterladen“ speichert dieselbe Meldung als Datei zum Verschicken per Mail.</p>
</div>
<div class="fm-fuss"><button type="button" class="fm-haupt" id="fm-send">Absenden</button><button type="button" id="fm-zip">ZIP herunterladen</button><button type="button" id="fm-c">Abbrechen</button><span class="fm-leise" id="fm-m"></span></div>`;
  document.body.append(p);
  $('#fm-x').onclick = schliessen;
  $('#fm-c').onclick = schliessen;
  $('#fm-pick').onclick = pickStart;
  $('#fm-zip').onclick = herunterladen;
  $('#fm-send').onclick = abschicken;
  const fi = $('#fm-f'); const dz = $('#fm-drop');
  fi.onchange = () => anhaengen(fi.files);
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('ist-ueber'); };
  dz.ondragleave = () => dz.classList.remove('ist-ueber');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('ist-ueber'); anhaengen(e.dataTransfer.files); };
  $('#fm-a').value = JSON.stringify(automatisch(), null, 1);
  zeigePicks();
  $('#fm-t').focus();
}
function schliessen() {
  pickEnde();
  $('#fm-panel')?.remove();
  document.querySelectorAll('.fm-ov').forEach((x) => x.remove());
}
function zeigePicks() {
  const pl = $('#fm-picks');
  if (!pl) return;
  $('#fm-pn').textContent = picks.length ? `${picks.length} gewählt` : 'keine gewählt';
  pl.innerHTML = picks.map((k, i) => `<div><b class="fm-nr">${i + 1}</b> ${k.ctx.panel ? `<b>${esc(k.ctx.panel)}</b> · ` : ''}<code>${esc(k.selector)}</code> <span class="fm-leise">${esc(k.text.slice(0, 50))}</span> <button type="button" class="fm-weg" data-rp="${i}" aria-label="Element ${i + 1} entfernen">×</button></div>`).join('');
  pl.querySelectorAll('[data-rp]').forEach((b) => { b.onclick = () => { picks.splice(+b.dataset.rp, 1); zeigePicks(); }; });
  markiere();
  $('#fm-wf').src = wireframe();
}
function anhaengen(liste) {
  for (const f of liste) {
    if (f.size > 15e6) { $('#fm-m').textContent = `${f.name}: größer als 15 MB`; continue; }
    f.arrayBuffer().then((buf) => { anhaenge.push({ name: f.name, daten: new Uint8Array(buf) }); zeigeAnhaenge(); });
  }
}
function zeigeAnhaenge() {
  $('#fm-fl').innerHTML = anhaenge.map((x, i) => `${esc(x.name)} <button type="button" class="fm-weg" data-ra="${i}" aria-label="${esc(x.name)} entfernen">×</button>`).join(' · ');
  document.querySelectorAll('[data-ra]').forEach((b) => { b.onclick = () => { anhaenge.splice(+b.dataset.ra, 1); zeigeAnhaenge(); }; });
}

// Meldung aus dem Panel bauen: ZIP und die Texte, die beim Senden einzeln mitgehen; null ohne Titel
function baue() {
  const titel = $('#fm-t').value.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!titel) { $('#fm-m').textContent = 'Bitte einen Titel eingeben.'; $('#fm-t').focus(); return null; }
  let auto;
  try { auto = JSON.parse($('#fm-a').value); } catch { auto = { text: $('#fm-a').value }; }
  const png = Uint8Array.from(atob(wireframe().split(',')[1]), (ch) => ch.charCodeAt(0));
  const { zipName, dateien, md, metaJson } = meldungDateien({ titel, beschreibung: $('#fm-d').value, auto, picks, wireframePng: png, anhaenge });
  return { titel, zipName, md, metaJson, zipBytes: zipErstellen(dateien) };
}
function zipSpeichern(m) {
  const url = URL.createObjectURL(new Blob([m.zipBytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = m.zipName;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function fertig(html, schliessText = 'Schließen') {
  picks = []; anhaenge = [];
  $('#fm-panel .fm-inhalt').innerHTML = html;
  $('#fm-zip')?.remove();
  $('#fm-send')?.remove();
  $('#fm-c').textContent = schliessText;
  document.querySelectorAll('.fm-ov').forEach((x) => x.remove());
}

function herunterladen() {
  const m = baue();
  if (!m) return;
  zipSpeichern(m);
  merke('Fehler gemeldet (ZIP)', m.zipName);
  fertig(`<p>Gespeichert: <code>${esc(m.zipName)}</code></p><p>Die Datei liegt in deinem Download-Ordner. Schick sie per Mail an die Person, die Chefing betreut.</p>`);
}

let sendet = false;
async function abschicken() {
  if (sendet) return;
  const m = baue();
  if (!m) return;
  sendet = true;
  const knopf = $('#fm-send');
  knopf.disabled = true;
  $('#fm-m').textContent = 'Sende …';
  const r = await sendeFehlermeldung(m);
  sendet = false;
  if (r.ok) {
    merke('Fehler gemeldet (gesendet)', r.id ?? m.zipName);
    // Die Nummer (= Ordnername der Meldung) liegt gleich in der Zwischenablage, zum Weitergeben; klappt das nicht, bleibt der Knopf
    const kopiert = r.id ? await inZwischenablage(r.id) : false;
    fertig(`<p>Gesendet, danke.${r.id ? ` Nummer: <code>${esc(r.id)}</code> <span class="fm-leise" id="fm-kopiert">${kopiert ? '· in die Zwischenablage kopiert' : '· Kopieren nicht möglich, bitte von Hand'}</span>` : ''}</p>`
      + `<p>${r.id ? '<button type="button" id="fm-nr">Nummer kopieren</button> ' : ''}<button type="button" id="fm-zip2">ZIP herunterladen</button></p>`);
    $('#fm-zip2').onclick = () => zipSpeichern(m);
    if (r.id) $('#fm-nr').onclick = async () => { $('#fm-kopiert').textContent = (await inZwischenablage(r.id)) ? '· in die Zwischenablage kopiert' : '· Kopieren nicht möglich, bitte von Hand'; };
    return;
  }
  // Rückfall: Panel bleibt offen, nichts geht verloren
  knopf.disabled = false;
  $('#fm-m').textContent = `${r.fehler} Lade stattdessen das ZIP herunter und schick es per Mail.`;
  $('#fm-zip').classList.add('fm-haupt');
}

// knopf: Element, das das Panel öffnet; holeKontext: liefert den App-Zustand für die Meldung
// Fehlt der Knopf (ältere index.html aus dem Browser-Cache, DR-037), legt das Modul ihn selbst in die Kopfzeile.
export function initFehlerMelden(knopf, holeKontext) {
  kontext = holeKontext;
  if (!knopf) {
    knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.id = 'fehler-melden';
    knopf.className = 'ghost';
    knopf.title = 'Fehler melden: Beschreibung, gewählte Elemente und App-Zustand absenden oder als ZIP herunterladen';
    knopf.textContent = '⚑ Fehler melden';
    document.querySelector('nav.presets')?.append(knopf);
  }
  knopf.addEventListener('click', oeffnen);
}
