<?php
// Test der Kernlogik von chefing-issue.php (DR-077). Aufruf: php test/issue-endpunkt.test.php [Body-Datei]
// Wird von test/issue-endpunkt.check.mjs gestartet und gibt PASS/FAIL-Zeilen aus. Mit Body-Datei: Interop-Test gegen eine
// Anfrage, die der echte Client (src/model/meldungSenden.js) gebaut hat.
require __DIR__ . '/../chefing-issue.php';

$fail = 0;
function ok(bool $c, string $m): void { global $fail; echo ($c ? 'PASS ' : 'FAIL ') . $m . "\n"; if (!$c) $fail++; }
function tmpdir(): string { return sys_get_temp_dir() . '/chefing_is_' . bin2hex(random_bytes(4)); }
function rmrf(string $d): void {
    if (!is_dir($d)) return;
    foreach (scandir($d) as $f) { if ($f === '.' || $f === '..') continue; $p = "$d/$f"; is_dir($p) ? rmrf($p) : @unlink($p); }
    @rmdir($d);
}
function gut(array $over = []): array {
    return array_replace([
        'titel' => 'Hinweis fehlt beim Aufschlagen',
        'issue_md' => "# Hinweis fehlt beim Aufschlagen\n\nErwartet: Tipp. Tatsächlich: keiner.\n",
        'meta_json' => json_encode(['title' => 'Hinweis fehlt beim Aufschlagen', 'status' => 'open', 'auto' => ['seite' => '/chefing/']]),
        'zip_b64' => base64_encode("PK\x03\x04" . str_repeat("\0", 40) . "Inhalt"),
    ], $over);
}
function post(array|string $m, string $dir, string $typ = 'application/json', ?string $origin = null, string $host = 'chefing.example', ?int $jetzt = null): array {
    $body = is_string($m) ? $m : json_encode($m, JSON_UNESCAPED_UNICODE);
    return issue_verarbeite('POST', $typ, $body, $origin, $host, $dir, $jetzt ?? 1792300000);
}
$meldungen = fn(string $d) => array_values(array_filter(glob("$d/open/*") ?: [], 'is_dir'));

// Vereinbarte Grenzen (DR-077); wer sie ändert, ändert bewusst auch diesen Test.
ok(ISSUE_LIMIT_15MIN === 10 && ISSUE_TAGESLIMIT === 50 && ISSUE_MAX_GESAMT === 209715200 && ISSUE_MAX_ZIP === 12582912 && ISSUE_MAX_BODY === 18874368 && ISSUE_MAX_TEXT === 204800 && ISSUE_MAX_TITEL === 120, 'vereinbarte Grenzen: 10 je 15 Min., 50 je Tag, 200 MB gesamt, ZIP 12 MB, Body 18 MB, Texte 200 KB, Titel 120 Zeichen');

$d = tmpdir();
[$s, $a] = post(gut(), $d);
ok($s === 200 && $a['ok'] === true && preg_match('/^\d{8}-\d{6}-hinweis-fehlt-beim-aufschlagen-[0-9a-f]{4}$/', $a['id']) === 1, 'gültige Meldung: 200 und eine id aus Zeit, Titel-Slug und Zufall');
$o = $meldungen($d);
ok(count($o) === 1 && basename($o[0]) === $a['id'] && is_file("$o[0]/issue.md") && is_file("$o[0]/meta.json") && is_file("$o[0]/meldung.zip"), 'ein Ordner open/<id> mit issue.md, meta.json und meldung.zip');
ok(strncmp(file_get_contents("$o[0]/meldung.zip"), "PK\x03\x04", 4) === 0 && strpos(file_get_contents("$o[0]/issue.md"), 'Tatsächlich') !== false && json_decode(file_get_contents("$o[0]/meta.json"), true)['status'] === 'open', 'Inhalte wie gesendet (ZIP-Bytes, Text mit Umlauten, Meta als JSON)');
ok(count(glob("$o[0]/*")) === 3 && !glob("$o[0]/*.php") , 'im Ordner liegen genau drei Dateien, nichts wird entpackt oder ausführbar abgelegt');
ok(is_file("$d/.htaccess") && strpos(file_get_contents("$d/.htaccess"), 'Require all denied') !== false && strpos(file_get_contents("$d/.htaccess"), 'Deny from all') !== false && is_file("$d/index.html"), 'issues-data/ bekommt .htaccess (Zugriff verboten) und leere index.html');
ok(strpos(json_encode($a), 'REMOTE') === false && !array_key_exists('ip', $a), 'keine IP in der Antwort');

// Methode, Inhaltstyp, Origin
ok(issue_verarbeite('GET', 'application/json', '', null, 'x', $d, 1)[0] === 405 && issue_verarbeite('PUT', 'application/json', '{}', null, 'x', $d, 1)[0] === 405, 'nur POST (GET/PUT → 405)');
ok(post(gut(), $d, 'text/plain')[0] === 415 && post(gut(), $d, 'application/zip')[0] === 415 && post(gut(), $d, '')[0] === 415, 'nur application/json (sonst 415)');
ok(post(gut(), $d, 'application/json; charset=utf-8')[0] === 200, 'Inhaltstyp mit charset ist erlaubt');
ok(post(gut(), $d, 'application/json', 'https://boese.example')[0] === 403 && post(gut(), $d, 'application/json', 'null')[0] === 403 && post(gut(), $d, 'application/json', 'https://chefing.example.boese.net')[0] === 403, 'fremde Origin, „null“ und angehängte Fremd-Domain → 403');
ok(post(gut(), $d, 'application/json', 'https://chefing.example')[0] === 200 && post(gut(), $d, 'application/json', 'http://chefing.example:8765', 'chefing.example:8765')[0] === 200, 'eigene Origin (mit und ohne Port) → 200');

// Größe und JSON
ok(post(str_repeat('x', ISSUE_MAX_BODY + 1), $d)[0] === 413, 'Body über 18 MB → 413');
ok(post('{kaputt', $d)[0] === 400 && post('[1,2]', $d)[0] === 400 && post('42', $d)[0] === 400 && post('', $d)[0] === 400 && post('null', $d)[0] === 400, 'ungültiges JSON, Liste, Zahl, leer oder null → 400');
$fehler = fn(array $over) => post(gut($over), $d);
ok($fehler(['titel' => ''])[1]['fehler'] === 'titel' && $fehler(['titel' => '   '])[1]['fehler'] === 'titel' && $fehler(['titel' => str_repeat('a', ISSUE_MAX_TITEL + 1)])[1]['fehler'] === 'titel' && $fehler(['titel' => 5])[1]['fehler'] === 'titel', 'Titel fehlt, nur Leerzeichen, zu lang oder falscher Typ → 400 titel');
ok($fehler(['issue_md' => ''])[1]['fehler'] === 'issue_md' && $fehler(['issue_md' => str_repeat('x', ISSUE_MAX_TEXT + 1)])[1]['fehler'] === 'issue_md' && $fehler(['issue_md' => ["a"]])[1]['fehler'] === 'issue_md', 'issue_md leer, zu groß oder falscher Typ → 400');
ok($fehler(['meta_json' => 'kein json'])[1]['fehler'] === 'meta_json' && $fehler(['meta_json' => '42'])[1]['fehler'] === 'meta_json' && $fehler(['meta_json' => ''])[1]['fehler'] === 'meta_json', 'meta_json kein Objekt oder keine Liste von Feldern → 400');
ok($fehler(['zip_b64' => ''])[1]['fehler'] === 'zip_b64' && $fehler(['zip_b64' => '!!!kein base64!!!'])[1]['fehler'] === 'zip' && $fehler(['zip_b64' => base64_encode('kein zip, nur Text hier drin ... '.str_repeat('x', 30))])[1]['fehler'] === 'zip' && $fehler(['zip_b64' => base64_encode("PK\x03\x04")])[1]['fehler'] === 'zip', 'ZIP fehlt, ist kein Base64, hat keine ZIP-Kennung oder ist zu klein → 400');
ok($fehler(['zip_b64' => base64_encode("PK\x03\x04" . str_repeat('x', ISSUE_MAX_ZIP))])[1]['fehler'] === 'zip', 'ZIP über 12 MB → 400');
ok(post(gut(['zip_b64' => base64_encode("PK\x05\x06" . str_repeat("\0", 18))]), $d)[0] === 200, 'leeres ZIP (nur Endkennung) ist erlaubt');
$vorher = count($meldungen($d));
post(gut(), $d, 'application/json', 'https://boese.example'); post('{kaputt', $d); $fehler(['titel' => '']);
ok(count($meldungen($d)) === $vorher, 'abgelehnte Anfragen legen nichts ab');

// Honeypot
$vorher = count($meldungen($d));
[$s, $a] = post(gut(['website' => 'http://spam.example']), $d);
ok($s === 200 && $a === ['ok' => true] && count($meldungen($d)) === $vorher, 'Honeypot ausgefüllt: „ok“, aber nichts gespeichert');

// Limits: 15 Minuten, Tag, Gesamtgröße
$d2 = tmpdir(); $t0 = 1792300000;
$codes = []; for ($i = 0; $i < ISSUE_LIMIT_15MIN + 2; $i++) $codes[] = post(gut(), $d2, 'application/json', null, 'x', $t0)[0];
ok(array_slice($codes, 0, ISSUE_LIMIT_15MIN) === array_fill(0, ISSUE_LIMIT_15MIN, 200) && $codes[ISSUE_LIMIT_15MIN] === 429 && $codes[ISSUE_LIMIT_15MIN + 1] === 429, 'ab der 11. Meldung im 15-Minuten-Fenster → 429');
ok(post(gut(), $d2, 'application/json', null, 'x', $t0)[1]['fehler'] === 'zu schnell' && post(gut(), $d2, 'application/json', null, 'x', $t0 + 900)[0] === 200, 'Fehlertext „zu schnell“; im nächsten Fenster geht es wieder');
$d3 = tmpdir(); $n = 0; $tag = gmmktime(0, 0, 0, 3, 3, 2027);
for ($f = 0; $f < 6; $f++) for ($i = 0; $i < ISSUE_LIMIT_15MIN; $i++) { $r = post(gut(), $d3, 'application/json', null, 'x', $tag + $f * 900); if ($r[0] === 200) $n++; }
ok($n === ISSUE_TAGESLIMIT && post(gut(), $d3, 'application/json', null, 'x', $tag + 6 * 900)[1]['fehler'] === 'tageslimit', 'Tageslimit 50 über alle Fenster, dann „tageslimit“');
ok(post(gut(), $d3, 'application/json', null, 'x', $tag + 86400 + 7 * 900)[0] === 200, 'am nächsten Tag geht es wieder');
$d4 = tmpdir(); is_datenordner($d4); mkdir("$d4/open/alt"); file_put_contents("$d4/open/alt/meldung.zip", str_repeat('x', ISSUE_MAX_GESAMT - 10));
[$s, $a] = post(gut(), $d4);
ok($s === 429 && $a['fehler'] === 'voll', 'Gesamtgröße der Ablage erreicht → 429 „voll“');

// Zähler enthalten nur Zahlen
$zaehler = array_merge(glob("$d3/limit*.txt") ?: []);
ok($zaehler && array_reduce($zaehler, fn($ok, $p) => $ok && preg_match('/^\d+$/', trim(file_get_contents($p))) === 1, true), 'Zähler-Dateien enthalten nur eine Zahl');

// Interop mit dem echten Client
if (isset($argv[1]) && is_file($argv[1])) {
    $d5 = tmpdir();
    $body = file_get_contents($argv[1]);
    [$s, $a] = issue_verarbeite('POST', 'application/json', $body, null, 'chefing.example', $d5, 1792300000);
    $o = $meldungen($d5);
    $zip = $o ? file_get_contents("$o[0]/meldung.zip") : '';
    ok($s === 200 && count($o) === 1 && strncmp($zip, "PK\x03\x04", 4) === 0 && strpos(file_get_contents("$o[0]/issue.md"), '# ') === 0 && is_array(json_decode(file_get_contents("$o[0]/meta.json"), true)), 'Interop: eine vom Client gebaute Anfrage wird angenommen und abgelegt');
    ok(strlen($zip) > 100 && strpos($zip, 'wireframe.png') !== false && strpos($zip, 'foto.jpg') !== false, 'Interop: das abgelegte ZIP enthält Wireframe und Anhang des Clients');
    rmrf($d5);
}

foreach ([$d, $d2, $d3, $d4] as $x) rmrf($x);
echo $fail ? "$fail FAIL\n" : "ALL PASS\n";
exit($fail ? 1 : 0);
