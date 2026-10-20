// Minimaler ZIP-Schreiber (DR-044, Fehler melden): Dateien unkomprimiert („stored“), ohne fremde Bibliothek.
// Reicht für Text, JSON und PNG/JPG; jedes Entpackprogramm (Windows, macOS, unzip) liest das Format.

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const alsBytes = (inhalt) => (typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt);

// Datum/Zeit im DOS-Format der ZIP-Köpfe (2-Sekunden-Raster)
function dosZeit(d) {
  return {
    zeit: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// dateien: [{ name, inhalt: string | Uint8Array }] → Uint8Array (ZIP)
export function zipErstellen(dateien, jetzt = new Date()) {
  const { zeit, datum } = dosZeit(jetzt);
  const teile = [];
  const verzeichnis = [];
  let pos = 0;
  for (const d of dateien) {
    const name = new TextEncoder().encode(d.name);
    const daten = alsBytes(d.inhalt);
    const crc = crc32(daten);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true);
    kopf.setUint16(4, 20, true);
    kopf.setUint16(6, 0x0800, true); // Bit 11: Dateinamen in UTF-8 (Umlaute)
    kopf.setUint16(10, zeit, true);
    kopf.setUint16(12, datum, true);
    kopf.setUint32(14, crc, true);
    kopf.setUint32(18, daten.length, true);
    kopf.setUint32(22, daten.length, true);
    kopf.setUint16(26, name.length, true);
    teile.push(new Uint8Array(kopf.buffer), name, daten);
    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true);
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(8, 0x0800, true);
    z.setUint16(12, zeit, true);
    z.setUint16(14, datum, true);
    z.setUint32(16, crc, true);
    z.setUint32(20, daten.length, true);
    z.setUint32(24, daten.length, true);
    z.setUint16(28, name.length, true);
    z.setUint32(42, pos, true);
    verzeichnis.push(new Uint8Array(z.buffer), name);
    pos += 30 + name.length + daten.length;
  }
  const vzLaenge = verzeichnis.reduce((a, b) => a + b.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, dateien.length, true);
  ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, vzLaenge, true);
  ende.setUint32(16, pos, true);
  const alle = [...teile, ...verzeichnis, new Uint8Array(ende.buffer)];
  const out = new Uint8Array(alle.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const t of alle) { out.set(t, o); o += t.length; }
  return out;
}
