// Zahl und Einheit zusammenhalten (DR-115): „2 Min.“, „180 °C“, „235 g“ brechen nie zwischen Zahl und Einheit um. Dazu steht zwischen beiden ein
// geschütztes Leerzeichen (U+00A0). Für Text, den wir selbst umbrechen (SVG: umbrechen in kompakt.js), und für fertig gezeichnetes HTML.
const NBSP = ' ';
const EINHEIT = '(?:Min|Std|Sek|Stk|Prise|Pck|Pkt|EL|TL|kg|mg|ml|cl|dl|cm|mm|min|g|h|l|°C|°F|°|%)';
const ZAHL_EINHEIT = new RegExp(`(\\d) (?=${EINHEIT}(?![\\wäöüÄÖÜß]))`, 'g');

export const fest = (text) => String(text ?? '').replace(ZAHL_EINHEIT, `$1${NBSP}`);

// Textknoten unterhalb von root durchgehen (Skript, Stil und Eingabefelder bleiben unberührt)
export function schuetzeEinheiten(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('script, style, textarea, input') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const knoten = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) knoten.push(n);
  for (const n of knoten) { const neu = fest(n.nodeValue); if (neu !== n.nodeValue) n.nodeValue = neu; }
}
