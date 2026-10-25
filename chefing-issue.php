<?php
/**
 * chefing-issue.php — Endpunkt für „Fehler melden“ (DR-077, Ergänzung zu DR-044): legt jede Meldung als Ordner unter
 * issues-data/open/<Zeit>-<slug>-<zufall>/ ab: issue.md, meta.json und meldung.zip (dasselbe ZIP, das der Knopf „ZIP herunterladen“
 * erzeugt, mit Wireframe und Anhängen). Das ZIP wird nur abgelegt, nie entpackt; ausgeführt oder ausgeliefert wird nichts.
 *
 * POST application/json {titel, issue_md, meta_json, zip_b64, website?} → { ok, id }. Kein Lesen über HTTP, keine IP, keine Cookies.
 * Missbrauchsschutz ohne Personenbezug: Größenlimits, feste Struktur, Honeypot, Limit je 15 Minuten und je Tag (über alle Besucher
 * zusammen), Gesamtgröße des Ordners, Origin-Prüfung.
 *
 * Wird NICHT von deploy.php verteilt (Muster *.html *.js *.css *.json) — einmalig von Hand neben index.html legen.
 * issues-data/ bekommt beim ersten Schreiben eine eigene .htaccess (Zugriff verboten, nie im Repo); auf Nicht-Apache-Servern
 * oder wenn das Verzeichnis anders liegen soll: ISSUE_DATEN_DIR anpassen (am besten außerhalb des Web-Roots).
 */

const ISSUE_MAX_BODY     = 18874368;  // Byte, gesamte Anfrage (ZIP bis 12 MB wird als Base64 etwa 16 MB, dazu zwei Texte bis 200 KB)
const ISSUE_MAX_ZIP      = 12582912;  // Byte, entpacktes ZIP
const ISSUE_MAX_TEXT     = 204800;    // Byte je issue.md / meta.json
const ISSUE_MAX_TITEL    = 120;       // Zeichen
const ISSUE_LIMIT_15MIN  = 10;        // Meldungen je 15-Minuten-Fenster insgesamt
const ISSUE_TAGESLIMIT   = 50;        // Meldungen pro Tag insgesamt
const ISSUE_MAX_GESAMT   = 209715200; // 200 MB für alle Meldungen zusammen
const ISSUE_DATEN_DIR    = __DIR__ . '/issues-data';

function is_text($v, int $max): ?string {
    if (!is_string($v) || $v === '' || strlen($v) > $max || !mb_check_encoding($v, 'UTF-8')) return null;
    return $v;
}

function is_slug(string $titel): string {
    $s = mb_strtolower($titel);
    $s = strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    $s = trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    return substr($s, 0, 40) ?: 'fehler';
}

/** Prüft die Anfrage gegen die feste Struktur. Rückgabe: [bereinigt|null, fehlertext|null]. */
function is_pruefe(array $m): array {
    $titel = is_text(is_string($m['titel'] ?? null) ? trim(preg_replace('/\s+/', ' ', $m['titel'])) : null, ISSUE_MAX_TITEL * 4);
    if ($titel === null || mb_strlen($titel) > ISSUE_MAX_TITEL) return [null, 'titel'];
    $md = is_text($m['issue_md'] ?? null, ISSUE_MAX_TEXT);
    if ($md === null) return [null, 'issue_md'];
    $meta = is_text($m['meta_json'] ?? null, ISSUE_MAX_TEXT);
    if ($meta === null || !is_array(json_decode($meta, true, 32))) return [null, 'meta_json'];
    $b64 = $m['zip_b64'] ?? null;
    if (!is_string($b64) || $b64 === '') return [null, 'zip_b64'];
    $zip = base64_decode($b64, true);
    if ($zip === false || strlen($zip) < 22 || strlen($zip) > ISSUE_MAX_ZIP) return [null, 'zip'];
    if (strncmp($zip, "PK\x03\x04", 4) !== 0 && strncmp($zip, "PK\x05\x06", 4) !== 0) return [null, 'zip'];
    return [['titel' => $titel, 'issue_md' => $md, 'meta_json' => $meta, 'zip' => $zip], null];
}

function is_datenordner(string $dir): bool {
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) return false;
    $ht = $dir . '/.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht, "# erzeugt von chefing-issue.php — Fehlermeldungen nie öffentlich ausliefern\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n");
    }
    if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
    return is_writable($dir) && (is_dir($dir . '/open') || @mkdir($dir . '/open', 0750)) ;
}

/** Zählt in einer Datei (nur eine Zahl, kein Personenbezug) hoch und lehnt ab dem Limit ab. */
function is_zaehle(string $datei, int $limit): bool {
    $f = @fopen($datei, 'c+');
    if (!$f) return false;
    flock($f, LOCK_EX);
    $n = (int) trim((string) stream_get_contents($f));
    $ok = $n < $limit;
    if ($ok) { ftruncate($f, 0); rewind($f); fwrite($f, (string) ($n + 1)); }
    flock($f, LOCK_UN);
    fclose($f);
    return $ok;
}

/** Zwei Limits über alle Besucher zusammen: je 15-Minuten-Fenster und je Tag. Rückgabe: null = erlaubt, sonst 'zu schnell' bzw. 'tageslimit'. */
function is_limits(string $dir, int $jetzt): ?string {
    $heute = gmdate('Ymd', $jetzt);
    $fenster = intdiv($jetzt, 900);
    foreach (glob($dir . '/limit-*.txt') ?: [] as $alt) {
        if (preg_match('/limit-(\d{8})\.txt$/', $alt, $t) && $t[1] < gmdate('Ymd', $jetzt - 3 * 86400)) @unlink($alt);
    }
    foreach (glob($dir . '/limit15-*.txt') ?: [] as $alt) {
        if (preg_match('/limit15-(\d+)\.txt$/', $alt, $t) && (int) $t[1] < $fenster - 8) @unlink($alt);
    }
    if (!is_zaehle($dir . "/limit15-$fenster.txt", ISSUE_LIMIT_15MIN)) return 'zu schnell';
    if (!is_zaehle($dir . "/limit-$heute.txt", ISSUE_TAGESLIMIT)) return 'tageslimit';
    return null;
}

function is_gesamtgroesse(string $dir): int {
    $summe = 0;
    foreach (glob($dir . '/open/*/*') ?: [] as $d) $summe += (int) @filesize($d);
    return $summe;
}

/**
 * Kernlogik, ohne Zugriff auf Superglobals — damit testbar (test/issue-endpunkt.test.php).
 * Rückgabe: [HTTP-Status, Antwort-Array].
 */
function issue_verarbeite(string $methode, string $inhaltstyp, string $body, ?string $origin, string $host, string $dir, int $jetzt): array {
    if ($methode !== 'POST') return [405, ['ok' => false, 'fehler' => 'nur POST']];
    if (stripos($inhaltstyp, 'application/json') !== 0) return [415, ['ok' => false, 'fehler' => 'nur application/json']];
    if ($origin !== null && $origin !== '') {
        $oh = parse_url($origin, PHP_URL_HOST);
        $hh = parse_url('http://' . $host, PHP_URL_HOST);
        if (!$oh || !$hh || strcasecmp($oh, $hh) !== 0) return [403, ['ok' => false, 'fehler' => 'origin']];
    }
    if (strlen($body) > ISSUE_MAX_BODY) return [413, ['ok' => false, 'fehler' => 'zu gross']];
    $m = json_decode($body, true, 8);
    if (!is_array($m) || array_is_list($m)) return [400, ['ok' => false, 'fehler' => 'kein json-objekt']];
    if (trim((string) ($m['website'] ?? '')) !== '') return [200, ['ok' => true]]; // Honeypot: Bots bekommen „ok“ und nichts wird gespeichert
    [$sauber, $fehler] = is_pruefe($m);
    if ($sauber === null) return [400, ['ok' => false, 'fehler' => $fehler]];
    if (!is_datenordner($dir)) return [500, ['ok' => false, 'fehler' => 'speicher']];
    if (is_gesamtgroesse($dir) + strlen($sauber['zip']) >= ISSUE_MAX_GESAMT) return [429, ['ok' => false, 'fehler' => 'voll']];
    $limit = is_limits($dir, $jetzt);
    if ($limit !== null) return [429, ['ok' => false, 'fehler' => $limit]];
    $id = gmdate('Ymd-His', $jetzt) . '-' . is_slug($sauber['titel']) . '-' . bin2hex(random_bytes(2));
    $ziel = $dir . '/open/' . $id;
    if (!@mkdir($ziel, 0750)) return [500, ['ok' => false, 'fehler' => 'speicher']];
    foreach (['issue.md' => $sauber['issue_md'], 'meta.json' => $sauber['meta_json'], 'meldung.zip' => $sauber['zip']] as $name => $inhalt) {
        if (@file_put_contents($ziel . '/' . $name, $inhalt, LOCK_EX) === false) return [500, ['ok' => false, 'fehler' => 'speicher']];
    }
    return [200, ['ok' => true, 'id' => $id]];
}

if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $body = (string) file_get_contents('php://input', false, null, 0, ISSUE_MAX_BODY + 1);
    [$status, $antwort] = issue_verarbeite(
        $_SERVER['REQUEST_METHOD'] ?? '', $_SERVER['CONTENT_TYPE'] ?? '', $body,
        $_SERVER['HTTP_ORIGIN'] ?? null, $_SERVER['HTTP_HOST'] ?? '', ISSUE_DATEN_DIR, time()
    );
    if ($status === 405) header('Allow: POST');
    if ($status === 429 && ($antwort['fehler'] ?? '') === 'zu schnell') header('Retry-After: 900');
    http_response_code($status);
    echo json_encode($antwort);
}
