<?php
// Test der Kernlogik von feedback.php (T53). Aufruf: php test/feedback-endpunkt.test.php
// Wird von test/feedback-endpunkt.check.mjs gestartet und gibt PASS/FAIL-Zeilen aus.
require __DIR__ . '/../feedback.php';

$fail = 0;
function ok(bool $c, string $m): void { global $fail; echo ($c ? 'PASS ' : 'FAIL ') . $m . "\n"; if (!$c) $fail++; }

function tmpdir(): string {
    $d = sys_get_temp_dir() . '/chefing_fb_' . bin2hex(random_bytes(4));
    return $d; // wird vom Endpunkt angelegt
}
function rmrf(string $d): void {
    if (!is_dir($d)) return;
    foreach (scandir($d) as $f) { if ($f === '.' || $f === '..') continue; $p = "$d/$f"; is_dir($p) ? rmrf($p) : @unlink($p); }
    @rmdir($d);
}
function gut(array $over = []): array {
    return array_replace_recursive([
        'v' => 1, 'bewertung' => 4, 'kommentar' => 'ging auf, Kruste etwas hell', 'mengenWieVorgeschlagen' => true, 'app' => 'a1b2c3d',
        'kontext' => [
            'archetyp' => 'hefeteig', 'variante' => 'weissbrot', 'methode' => 'hefe_kalt', 'gefaess' => 'brotform_25', 'status' => 'ok',
            'zutaten' => ['struktur' => [['zutat' => 'weizenmehl', 'anteil' => 1]], 'trieb' => [['zutat' => 'hefe_frisch', 'anteil' => 1]]],
            'regelIds' => ['gaerung_modell', 'toleranz:fett'], 'warnungen' => ['Gare 12 Std. bei 4,0 % Hefe'],
            'korpusN' => 24, 'korpusNMethode' => 2, 'rollenBp' => ['struktur' => 100, 'trieb' => 2.2],
            'gaerung' => ['gare' => 750, 'erwartet' => 900.5, 'hefeBp' => 2.2, 'kuehl' => true, 'berechnet' => false],
        ],
    ], $over);
}
function post(array|string $m, string $dir, string $typ = 'application/json', ?string $origin = null, string $host = 'chefing.example', ?int $jetzt = null): array {
    $body = is_string($m) ? $m : json_encode($m, JSON_UNESCAPED_UNICODE);
    return feedback_verarbeite('POST', $typ, $body, $origin, $host, $dir, $jetzt ?? 1792300000);
}
$zeilen = fn(string $d) => is_file("$d/feedback.jsonl") ? array_values(array_filter(explode("\n", file_get_contents("$d/feedback.jsonl")))) : [];

// Vereinbarte Grenzen (Nutzer-Vorgabe 15-Minuten-Limit, DR-027); wer sie ändert, ändert bewusst auch diesen Test.
ok(FEEDBACK_LIMIT_15MIN === 30 && FEEDBACK_TAGESLIMIT === 500 && FEEDBACK_MAX_DATEI === 5242880 && FEEDBACK_MAX_BODY === 16384 && FEEDBACK_MAX_KOMMENTAR === 1000, 'vereinbarte Grenzen: 30 je 15 Min., 500 je Tag, 5 MB Datei, 16 KB Body, 1000 Zeichen Kommentar');

$d = tmpdir();
[$s, $a] = post(gut(), $d);
ok($s === 200 && $a['ok'] === true && preg_match('/^[0-9a-f]{12}$/', $a['id']) === 1, 'gültige Meldung: 200 und eine id');
$z = $zeilen($d);
$e = json_decode($z[0] ?? 'null', true);
ok(count($z) === 1 && $e['id'] === $a['id'] && $e['v'] === 1 && $e['bewertung'] === 4 && $e['kontext']['methode'] === 'hefe_kalt' && $e['kontext']['gaerung']['kuehl'] === true, 'genau eine JSON-Zeile mit den bereinigten Feldern und der Schema-Version');
ok(preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/', $e['empfangen']) === 1, 'Empfangszeit als UTC-Zeitstempel');
ok(!array_key_exists('ip', $e) && strpos($z[0], 'REMOTE') === false && !array_key_exists('ua', $e), 'keine IP, kein User-Agent in der Zeile');
ok(is_file("$d/.htaccess") && strpos(file_get_contents("$d/.htaccess"), 'Require all denied') !== false && strpos(file_get_contents("$d/.htaccess"), 'Deny from all') !== false && is_file("$d/index.html"), 'Datenordner bekommt .htaccess (Zugriff verboten) und index.html');

// Methode, Inhaltstyp, Origin
ok(feedback_verarbeite('GET', 'application/json', '', null, 'x', $d, 1)[0] === 405 && feedback_verarbeite('PUT', 'application/json', '{}', null, 'x', $d, 1)[0] === 405, 'nur POST (GET/PUT → 405)');
ok(post(gut(), $d, 'text/plain')[0] === 415 && post(gut(), $d, 'application/x-www-form-urlencoded')[0] === 415 && post(gut(), $d, '')[0] === 415, 'nur application/json (sonst 415)');
ok(post(gut(), $d, 'application/json; charset=utf-8')[0] === 200, 'Inhaltstyp mit charset ist erlaubt');
ok(post(gut(), $d, 'application/json', 'https://boese.example')[0] === 403, 'fremde Origin → 403');
ok(post(gut(), $d, 'application/json', 'null')[0] === 403, 'Origin „null“ (z. B. Sandbox-iframe) → 403');
ok(post(gut(), $d, 'application/json', 'https://chefing.example')[0] === 200 && post(gut(), $d, 'application/json', 'http://chefing.example:8765', 'chefing.example:8765')[0] === 200 && post(gut(), $d, 'application/json', 'HTTPS://CHEFING.EXAMPLE')[0] === 200, 'gleiche Origin (mit Port, Groß-/Kleinschreibung) → 200');
ok(post(gut(), $d, 'application/json', 'https://chefing.example.boese.net')[0] === 403, 'Origin mit angehängter Fremd-Domain → 403');

// Größe und JSON
ok(post(str_repeat('x', FEEDBACK_MAX_BODY + 1), $d)[0] === 413, 'Body über 16 KB → 413');
ok(post('{kaputt', $d)[0] === 400 && post('[1,2]', $d)[0] === 400 && post('"text"', $d)[0] === 400 && post('42', $d)[0] === 400 && post('', $d)[0] === 400 && post('null', $d)[0] === 400, 'ungültiges JSON, Liste, Skalar, leer → 400');
$tief = '{"a":' . str_repeat('[', 20) . str_repeat(']', 20) . '}';
ok(post($tief, $d)[0] === 400, 'zu tief verschachteltes JSON → 400');
$tiefGueltig = gut(); $tiefGueltig['kontext']['extra'] = json_decode(str_repeat('[', 12) . str_repeat(']', 12), true);
ok(post($tiefGueltig, $d)[0] === 400, 'sonst gültige Meldung mit tief verschachteltem Zusatzfeld → 400 (Tiefenlimit des Parsers)');
rmrf($d);

// Felder
foreach ([0, 6, -1, '4', 4.5, null, true] as $b) {
    [$s] = post(gut(['bewertung' => $b]), $d);
    if ($s !== 400) { ok(false, 'Bewertung ' . var_export($b, true) . ' wird abgelehnt'); }
}
ok(true, 'Bewertung muss eine ganze Zahl 1–5 sein (0, 6, −1, „4“, 4,5, null, true → 400)');
foreach ([1, 2, 3, 4, 5] as $b) { if (post(gut(['bewertung' => $b]), $d)[0] !== 200) ok(false, "Bewertung $b akzeptiert"); }
ok(true, 'Bewertungen 1 bis 5 werden angenommen');
ok(post(gut(['v' => 2]), $d)[0] === 400 && post(array_diff_key(gut(), ['v' => 1]), $d)[0] === 400, 'falsche oder fehlende Schema-Version → 400');
ok(post(gut(['mengenWieVorgeschlagen' => 'ja']), $d)[0] === 400 && post(gut(['mengenWieVorgeschlagen' => 1]), $d)[0] === 400, '„Mengen wie vorgeschlagen“ muss ein Boolean sein');
ok(post(gut(['kontext' => ['status' => 'kaputt']]), $d)[0] === 400, 'unbekannter Status → 400');
ok(post(gut(['kontext' => ['methode' => 'a b']]), $d)[0] === 400 && post(gut(['kontext' => ['archetyp' => '../etc']]), $d)[0] === 400 && post(gut(['kontext' => ['variante' => '']]), $d)[0] === 400, 'Schlüsselfelder: nur A–Z a–z 0–9 _ : . − (kein Leerzeichen, kein „../“, nicht leer)');
ok(post(gut(['kontext' => ['regelIds' => ['gut', 'bö se']]]), $d)[0] === 400 && post(gut(['kontext' => ['regelIds' => array_fill(0, 41, 'x')]]), $d)[0] === 400, 'regelIds: ungültiges Zeichen oder mehr als 40 → 400');
$viele = []; for ($i = 0; $i < 21; $i++) $viele["r$i"] = [['zutat' => 'mehl', 'anteil' => 1]];
ok(post(gut(['kontext' => ['zutaten' => $viele]]), $d)[0] === 400, 'mehr als 20 Rollen → 400');
$u = gut(); $u['kontext']['zutaten'] = ['struktur' => [['zutat' => 'a', 'anteil' => 1], ['zutat' => 'b', 'anteil' => 1], ['zutat' => 'c', 'anteil' => 1], ['zutat' => 'd', 'anteil' => 1], ['zutat' => 'e', 'anteil' => 1], ['zutat' => 'f', 'anteil' => 1], ['zutat' => 'g', 'anteil' => 1]]];
ok(post($u, $d)[0] === 400, 'mehr als 6 Zutaten je Rolle → 400');
$u = gut(); $u['kontext']['zutaten'] = ['struktur' => [['zutat' => 'mehl', 'anteil' => 'viel']]];
ok(post($u, $d)[0] === 400, 'Anteil muss eine Zahl sein');
$u = gut(); $u['kontext']['warnungen'] = array_fill(0, 13, 'w');
ok(post($u, $d)[0] === 400, 'mehr als 12 Warnungen → 400');
$u = gut(); $u['kontext']['gaerung'] = ['gare' => 'lang', 'erwartet' => 1, 'hefeBp' => 1, 'kuehl' => true, 'berechnet' => false];
ok(post($u, $d)[0] === 400, 'Gärmodell-Werte müssen Zahlen sein');
$u = gut(); $u['kontext']['gaerung'] = null; $u['kontext']['korpusNMethode'] = null;
ok(post($u, $d)[0] === 200, 'Gärmodell und korpusNMethode dürfen null sein');
$u = gut(); $u['kontext']['rollenBp'] = ['struktur' => 'hundert'];
ok(post($u, $d)[0] === 400, 'rollenBp: Werte müssen Zahlen sein');

// Bereinigung und Kommentar
rmrf($d);
[$s] = post(gut(['kommentar' => str_repeat('ä', 1500)]), $d);
$e = json_decode($zeilen($d)[0], true);
ok($s === 200 && mb_strlen($e['kommentar']) === FEEDBACK_MAX_KOMMENTAR, 'Kommentar wird auf 1000 Zeichen gekürzt (Umlaute zählen als ein Zeichen)');
rmrf($d);
post(gut(['kommentar' => "a\x00b\x07c\x1bd\nneue Zeile\r\n  "]), $d);
$e = json_decode($zeilen($d)[0], true);
ok($e['kommentar'] === "abcd\nneue Zeile", 'Steuerzeichen entfernt, Zeilenumbruch bleibt, Ränder getrimmt');
rmrf($d);
post(gut(['kommentar' => '<script>alert(1)</script> & "x"']), $d);
$e = json_decode($zeilen($d)[0], true);
ok($e['kommentar'] === '<script>alert(1)</script> & "x"', 'HTML wird als Text gespeichert (keine Ausgabe im Endpunkt, Auswertung gibt Klartext aus)');
rmrf($d);
$m = gut(); $m['ip'] = '1.2.3.4'; $m['kontext']['boese'] = 'x'; $m['kontext']['zutaten']['struktur'][0]['extra'] = 'y';
post($m, $d);
$roh = $zeilen($d)[0];
ok(strpos($roh, '1.2.3.4') === false && strpos($roh, 'boese') === false && strpos($roh, 'extra') === false, 'unbekannte Felder werden verworfen, nicht gespeichert');
rmrf($d);
post(gut(['kommentar' => '']), $d);
ok(json_decode($zeilen($d)[0], true)['kommentar'] === '', 'leerer Kommentar ist erlaubt');
rmrf($d);
[$s] = post(array_diff_key(gut(), ['kommentar' => 1]), $d);
ok($s === 200, 'fehlender Kommentar ist erlaubt (leer)');
rmrf($d);
$m = gut(); unset($m['app']);
[$s] = post($m, $d);
ok($s === 200 && json_decode($zeilen($d)[0], true)['app'] === 'lokal', 'fehlende App-Version → „lokal“');
rmrf($d);

// Honeypot
[$s, $a] = post(gut(['website' => 'http://spam.example']), $d);
ok($s === 200 && $a === ['ok' => true] && count($zeilen($d)) === 0, 'Honeypot gefüllt: Antwort „ok“, aber nichts gespeichert');
[$s] = post(gut(['website' => '']), $d);
ok($s === 200 && count($zeilen($d)) === 1, 'Honeypot leer: normal gespeichert');
rmrf($d);

// Tageslimit (pro Tag, insgesamt), alte Zähler werden gelöscht
$t = 1792300000; $heute = gmdate('Ymd', $t);
@mkdir($d, 0750, true);
file_put_contents("$d/limit-$heute.txt", (string) (FEEDBACK_TAGESLIMIT - 1));
file_put_contents("$d/limit-20000101.txt", '5');
[$s1] = post(gut(), $d, 'application/json', null, 'chefing.example', $t);
[$s2, $a2] = post(gut(), $d, 'application/json', null, 'chefing.example', $t);
ok($s1 === 200 && $s2 === 429 && $a2['fehler'] === 'tageslimit', 'Tageslimit: die letzte erlaubte Meldung geht durch, die nächste → 429');
ok(!file_exists("$d/limit-20000101.txt"), 'alte Tageszähler werden gelöscht');
[$s3] = post(gut(), $d, 'application/json', null, 'chefing.example', $t + 86400);
ok($s3 === 200, 'am nächsten Tag gilt ein neuer Zähler');
ok(count($zeilen($d)) === 2, 'abgelehnte Meldungen werden nicht gespeichert');
ok(strpos(file_get_contents("$d/limit-$heute.txt"), (string) FEEDBACK_TAGESLIMIT) === 0, 'Zähler enthält nur eine Zahl (kein Personenbezug)');
rmrf($d);

// 15-Minuten-Limit (über alle Besucher zusammen), unabhängig vom Tageslimit
$t = 1792300000; $fenster = intdiv($t, 900); $heute = gmdate('Ymd', $t);
@mkdir($d, 0750, true);
file_put_contents("$d/limit15-$fenster.txt", (string) (FEEDBACK_LIMIT_15MIN - 1));
file_put_contents("$d/limit15-1.txt", '3');
[$s1] = post(gut(), $d, 'application/json', null, 'chefing.example', $t);
[$s2, $a2] = post(gut(), $d, 'application/json', null, 'chefing.example', $t + 60);
ok($s1 === 200 && $s2 === 429 && $a2['fehler'] === 'zu schnell', '15-Minuten-Limit: die letzte erlaubte Meldung geht durch, die nächste im selben Fenster → 429 „zu schnell“');
ok(!file_exists("$d/limit15-1.txt"), 'alte 15-Minuten-Zähler werden gelöscht');
ok((int) file_get_contents("$d/limit-$heute.txt") === 1, 'eine am 15-Minuten-Limit abgelehnte Meldung verbraucht kein Tageskontingent');
[$s3] = post(gut(), $d, 'application/json', null, 'chefing.example', $t + 900);
ok($s3 === 200, 'im nächsten 15-Minuten-Fenster geht es wieder');
ok(count($zeilen($d)) === 2, 'am 15-Minuten-Limit abgelehnte Meldungen werden nicht gespeichert');
ok(ctype_digit(trim(file_get_contents("$d/limit15-$fenster.txt"))), '15-Minuten-Zähler enthält nur eine Zahl (kein Personenbezug)');
rmrf($d);
@mkdir($d, 0750, true);
for ($i = 0; $i < FEEDBACK_LIMIT_15MIN; $i++) { if (post(gut(), $d, 'application/json', null, 'chefing.example', $t)[0] !== 200) { ok(false, "Meldung $i vor dem Limit abgelehnt"); break; } }
[$sx, $ax] = post(gut(), $d, 'application/json', null, 'chefing.example', $t + 10);
ok($sx === 429 && $ax['fehler'] === 'zu schnell' && count($zeilen($d)) === FEEDBACK_LIMIT_15MIN, 'genau ' . FEEDBACK_LIMIT_15MIN . ' Meldungen je 15 Minuten, die nächste wird abgelehnt');
rmrf($d);

// Dateigrößen-Limit
@mkdir($d, 0750, true);
file_put_contents("$d/feedback.jsonl", str_repeat('x', FEEDBACK_MAX_DATEI));
[$s, $a] = post(gut(), $d);
ok($s === 429 && $a['fehler'] === 'voll', 'Datei ab 5 MB ist voll → 429');
rmrf($d);

// Speicher nicht anlegbar: Pfad ist eine Datei
$datei = sys_get_temp_dir() . '/chefing_fb_datei_' . bin2hex(random_bytes(3));
file_put_contents($datei, 'x');
[$s, $a] = post(gut(), $datei);
ok($s === 500 && $a['fehler'] === 'speicher', 'Speicherordner nicht anlegbar → 500');
@unlink($datei);

// Antworten enthalten nie Eingaben
[$s, $a] = post(gut(['kommentar' => 'GEHEIM123']), $d);
ok(strpos(json_encode($a), 'GEHEIM') === false, 'Antwort spiegelt keine Eingaben zurück');
rmrf($d);

echo $fail ? "$fail FAIL\n" : "ALL PASS\n";
exit($fail ? 1 : 0);
