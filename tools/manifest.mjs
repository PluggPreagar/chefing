// Schreibt src/manifest.json: alle JS-Module unter src/ — index.html versioniert damit jeden Import (Cache-Busting).
// Aufruf: node tools/manifest.mjs   (nach jedem neuen/umbenannten Modul; test/manifest.check.mjs prüft den Stand)
import fs from 'fs';
import { fileURLToPath } from 'url';

const SRC = new URL('../src/', import.meta.url);

export function moduleListe() {
  const out = [];
  const gehe = (dir) => {
    for (const e of fs.readdirSync(new URL(dir, SRC), { withFileTypes: true })) {
      const rel = dir + e.name;
      if (e.isDirectory()) gehe(rel + '/');
      else if (e.name.endsWith('.js')) out.push('src/' + rel);
    }
  };
  gehe('');
  return out.sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file:///' + process.argv[1].replace(/\\/g, '/')))) {
  fs.writeFileSync(new URL('manifest.json', SRC), JSON.stringify(moduleListe(), null, 1) + '\n');
  console.log(moduleListe().length + ' Module geschrieben');
}
