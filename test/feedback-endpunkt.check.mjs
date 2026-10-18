// T53: startet den PHP-Test der Endpunkt-Logik (test/feedback-endpunkt.test.php), damit `sh test/run.sh` ihn mitnimmt.
// Ohne PHP (ab 8.1) wird er mit einer SKIP-Zeile übersprungen; PHP_BIN kann den Pfad vorgeben.
import { spawnSync } from 'child_process';

const kandidaten = [process.env.PHP_BIN, 'php', 'D:/_progs/xampp/php/php.exe', 'C:/xampp/php/php.exe', '/usr/bin/php', '/usr/local/bin/php'].filter(Boolean);
let php = null;
for (const k of kandidaten) {
  const t = spawnSync(k, ['-v'], { encoding: 'utf8' });
  if (t.status === 0 && /PHP (8\.[1-9]|9)/.test(t.stdout)) { php = k; break; }
}
if (!php) {
  console.log('SKIP PHP ab 8.1 nicht gefunden — Endpunkt-Test übersprungen (PHP_BIN setzen)');
  console.log('ALL PASS');
} else {
  const r = spawnSync(php, [new URL('./feedback-endpunkt.test.php', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8' });
  process.stdout.write(r.stdout);
  if (r.stderr.trim()) process.stdout.write(`FAIL PHP-Ausgabe auf stderr: ${r.stderr.trim().split('\n')[0]}\n`);
  if (r.status !== 0) { console.log('FAIL PHP-Test mit Exit-Code ' + r.status); }
}
