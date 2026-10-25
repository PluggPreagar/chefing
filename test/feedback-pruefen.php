<?php
// Hilfsskript für test/rueckmeldung.check.mjs: liest ein JSON-Array von Meldungen aus STDIN, schickt jede durch
// feedback_verarbeite() (eigener Datenordner, eigenes 15-Minuten-Fenster je Meldung) und gibt [[status, antwort], …] aus.
require __DIR__ . '/../chefing-feedback.php';

$meldungen = json_decode((string) stream_get_contents(STDIN), true);
$dir = sys_get_temp_dir() . '/chefing_fb_vertrag_' . bin2hex(random_bytes(4));
$ergebnis = [];
foreach ($meldungen as $i => $m) {
    $ergebnis[] = feedback_verarbeite('POST', 'application/json', json_encode($m, JSON_UNESCAPED_UNICODE), null, 'chefing.example', $dir, 1792300000 + $i * 900);
}
foreach (glob($dir . '/{*,.[!.]*}', GLOB_BRACE) ?: [] as $f) @unlink($f);
@rmdir($dir);
echo json_encode($ergebnis);
