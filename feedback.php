<?php
/**
 * feedback.php — minimaler Endpunkt für Rückmeldungen „hat es geklappt?“ (T53, DR-027).
 *
 * POST application/json (Aufbau siehe src/model/rueckmeldung.js, baueMeldung) → genau eine JSON-Zeile in
 * feedback-data/feedback.jsonl. Kein Lesen über HTTP (Auswertung: tools/rueckmeldungen.mjs auf der Datei), keine IP,
 * kein User-Agent, keine Cookies. Missbrauchsschutz ohne Personenbezug: Größenlimit, feste Struktur, Honeypot,
 * Limit je 15 Minuten und je Tag (jeweils über alle Besucher zusammen), Dateigrößen-Limit, Origin-Prüfung.
 *
 * Wird NICHT von deploy.php verteilt (Muster *.html *.js *.css *.json) — einmalig von Hand neben index.html legen.
 * Der Ordner feedback-data/ bekommt beim ersten Schreiben eine eigene .htaccess (Zugriff verboten, nie im Repo);
 * auf Nicht-Apache-Servern oder wenn das Verzeichnis anders liegen soll: FEEDBACK_DATEN_DIR anpassen.
 */

const FEEDBACK_MAX_BODY       = 16384;   // Byte
const FEEDBACK_MAX_KOMMENTAR  = 1000;    // Zeichen
const FEEDBACK_LIMIT_15MIN    = 30;      // Meldungen je 15-Minuten-Fenster insgesamt
const FEEDBACK_TAGESLIMIT     = 500;     // Meldungen pro Tag insgesamt
const FEEDBACK_MAX_DATEI      = 5242880; // 5 MB
const FEEDBACK_DATEN_DIR      = __DIR__ . '/feedback-data';

function fb_text($v, int $max): ?string {
    if (!is_string($v) || !mb_check_encoding($v, 'UTF-8')) return null;
    $v = preg_replace('/[^\P{C}\n]/u', '', $v); // Steuer- und Formatzeichen raus, Zeilenumbruch bleibt
    return mb_substr(trim((string) $v), 0, $max);
}

function fb_schluessel($v, int $max = 64): ?string {
    return (is_string($v) && preg_match('/^[A-Za-z0-9_:.\-]{1,' . $max . '}$/', $v)) ? $v : null;
}

function fb_zahl($v): ?float {
    return ((is_int($v) || is_float($v)) && is_finite((float) $v)) ? round((float) $v, 4) : null;
}

/** Prüft und bereinigt eine Meldung gegen die feste Struktur. Rückgabe: [bereinigt|null, fehlertext|null]. */
function fb_pruefe(array $m): array {
    if (($m['v'] ?? null) !== 1) return [null, 'version'];
    $b = $m['bewertung'] ?? null;
    if (!is_int($b) || $b < 1 || $b > 5) return [null, 'bewertung'];
    $kommentar = fb_text($m['kommentar'] ?? '', FEEDBACK_MAX_KOMMENTAR);
    if ($kommentar === null) return [null, 'kommentar'];
    if (!is_bool($m['mengenWieVorgeschlagen'] ?? null)) return [null, 'mengen'];
    $app = fb_text($m['app'] ?? 'lokal', 40);
    $k = $m['kontext'] ?? null;
    if ($app === null || !is_array($k)) return [null, 'kontext'];

    $kontext = [];
    foreach (['archetyp', 'variante', 'methode', 'gefaess'] as $f) {
        $s = fb_schluessel($k[$f] ?? null, 40);
        if ($s === null) return [null, "kontext.$f"];
        $kontext[$f] = $s;
    }
    if (!in_array($k['status'] ?? null, ['ok', 'prep', 'invalid'], true)) return [null, 'kontext.status'];
    $kontext['status'] = $k['status'];

    $zutaten = [];
    if (!is_array($k['zutaten'] ?? null) || count($k['zutaten']) > 20) return [null, 'kontext.zutaten'];
    foreach ($k['zutaten'] as $rolle => $liste) {
        $r = fb_schluessel((string) $rolle, 40);
        if ($r === null || !is_array($liste) || count($liste) > 6) return [null, 'kontext.zutaten'];
        foreach ($liste as $e) {
            $z = is_array($e) ? fb_schluessel($e['zutat'] ?? null, 40) : null;
            $a = is_array($e) ? fb_zahl($e['anteil'] ?? 1) : null;
            if ($z === null || $a === null) return [null, 'kontext.zutaten'];
            $zutaten[$r][] = ['zutat' => $z, 'anteil' => $a];
        }
    }
    $kontext['zutaten'] = $zutaten;

    $ids = $k['regelIds'] ?? [];
    if (!is_array($ids) || count($ids) > 40) return [null, 'kontext.regelIds'];
    $kontext['regelIds'] = [];
    foreach ($ids as $id) {
        $s = fb_schluessel($id);
        if ($s === null) return [null, 'kontext.regelIds'];
        $kontext['regelIds'][] = $s;
    }

    $warn = $k['warnungen'] ?? [];
    if (!is_array($warn) || count($warn) > 12) return [null, 'kontext.warnungen'];
    $kontext['warnungen'] = [];
    foreach ($warn as $w) {
        $t = fb_text($w, 300);
        if ($t === null) return [null, 'kontext.warnungen'];
        $kontext['warnungen'][] = $t;
    }

    foreach (['korpusN', 'korpusNMethode'] as $f) {
        $v = $k[$f] ?? null;
        $kontext[$f] = ($v === null) ? null : fb_zahl($v);
        if ($v !== null && $kontext[$f] === null) return [null, "kontext.$f"];
    }

    // Rollen, deren Menge der Nutzer manuell gesetzt hat (T40); ältere Clients senden das Feld nicht
    $manuell = $k['mengenManuell'] ?? [];
    if (!is_array($manuell) || count($manuell) > 20) return [null, 'kontext.mengenManuell'];
    $kontext['mengenManuell'] = [];
    foreach ($manuell as $rolle) {
        $r = fb_schluessel($rolle, 40);
        if ($r === null) return [null, 'kontext.mengenManuell'];
        $kontext['mengenManuell'][] = $r;
    }

    $bp = $k['rollenBp'] ?? [];
    if (!is_array($bp) || count($bp) > 20) return [null, 'kontext.rollenBp'];
    $kontext['rollenBp'] = [];
    foreach ($bp as $rolle => $wert) {
        $r = fb_schluessel((string) $rolle, 40);
        $w = fb_zahl($wert);
        if ($r === null || $w === null) return [null, 'kontext.rollenBp'];
        $kontext['rollenBp'][$r] = $w;
    }

    $g = $k['gaerung'] ?? null;
    if ($g === null) {
        $kontext['gaerung'] = null;
    } else {
        if (!is_array($g) || !is_bool($g['kuehl'] ?? null) || !is_bool($g['berechnet'] ?? null)) return [null, 'kontext.gaerung'];
        $kontext['gaerung'] = ['kuehl' => $g['kuehl'], 'berechnet' => $g['berechnet']];
        foreach (['gare', 'erwartet', 'hefeBp'] as $f) {
            $kontext['gaerung'][$f] = fb_zahl($g[$f] ?? null);
            if ($kontext['gaerung'][$f] === null) return [null, 'kontext.gaerung'];
        }
        // Gär-Temperatur in °C (T52); ältere Clients senden sie nicht
        if (($g['temp'] ?? null) !== null) {
            $t = fb_zahl($g['temp']);
            if ($t === null || $t < -30 || $t > 120) return [null, 'kontext.gaerung'];
            $kontext['gaerung']['temp'] = $t;
        }
    }

    return [[
        'v' => 1,
        'bewertung' => $b,
        'kommentar' => $kommentar,
        'mengenWieVorgeschlagen' => $m['mengenWieVorgeschlagen'],
        'app' => $app,
        'kontext' => $kontext,
    ], null];
}

function fb_datenordner(string $dir): bool {
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) return false;
    $ht = $dir . '/.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht, "# erzeugt von feedback.php — Rückmeldungen nie öffentlich ausliefern\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n");
    }
    if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
    return is_writable($dir);
}

/** Zählt in einer Datei (nur eine Zahl, kein Personenbezug) hoch und lehnt ab dem Limit ab. */
function fb_zaehle(string $datei, int $limit): bool {
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

/**
 * Zwei Limits über alle Besucher zusammen, ohne Personenbezug: je 15-Minuten-Fenster und je Tag.
 * Alte Zählerdateien werden gelöscht (Tage nach 3 Tagen, Fenster nach 2 Stunden).
 * Rückgabe: null = erlaubt, sonst 'zu schnell' bzw. 'tageslimit'.
 */
function fb_limits(string $dir, int $jetzt): ?string {
    $heute = gmdate('Ymd', $jetzt);
    $fenster = intdiv($jetzt, 900);
    foreach (glob($dir . '/limit-*.txt') ?: [] as $alt) {
        if (preg_match('/limit-(\d{8})\.txt$/', $alt, $t) && $t[1] < gmdate('Ymd', $jetzt - 3 * 86400)) @unlink($alt);
    }
    foreach (glob($dir . '/limit15-*.txt') ?: [] as $alt) {
        if (preg_match('/limit15-(\d+)\.txt$/', $alt, $t) && (int) $t[1] < $fenster - 8) @unlink($alt);
    }
    if (!fb_zaehle($dir . "/limit15-$fenster.txt", FEEDBACK_LIMIT_15MIN)) return 'zu schnell';
    if (!fb_zaehle($dir . "/limit-$heute.txt", FEEDBACK_TAGESLIMIT)) return 'tageslimit';
    return null;
}

/**
 * Kernlogik, ohne Zugriff auf Superglobals — damit testbar (test/feedback-endpunkt.test.php).
 * Rückgabe: [HTTP-Status, Antwort-Array].
 */
function feedback_verarbeite(string $methode, string $inhaltstyp, string $body, ?string $origin, string $host, string $dir, int $jetzt): array {
    if ($methode !== 'POST') return [405, ['ok' => false, 'fehler' => 'nur POST']];
    if (stripos($inhaltstyp, 'application/json') !== 0) return [415, ['ok' => false, 'fehler' => 'nur application/json']];
    if ($origin !== null && $origin !== '') {
        $oh = parse_url($origin, PHP_URL_HOST);
        $hh = parse_url('http://' . $host, PHP_URL_HOST);
        if (!$oh || !$hh || strcasecmp($oh, $hh) !== 0) return [403, ['ok' => false, 'fehler' => 'origin']];
    }
    if (strlen($body) > FEEDBACK_MAX_BODY) return [413, ['ok' => false, 'fehler' => 'zu gross']];
    $m = json_decode($body, true, 8);
    if (!is_array($m) || array_is_list($m)) return [400, ['ok' => false, 'fehler' => 'kein json-objekt']];
    if (trim((string) ($m['website'] ?? '')) !== '') return [200, ['ok' => true]]; // Honeypot: Bots bekommen „ok“ und nichts wird gespeichert
    [$sauber, $fehler] = fb_pruefe($m);
    if ($sauber === null) return [400, ['ok' => false, 'fehler' => $fehler]];
    if (!fb_datenordner($dir)) return [500, ['ok' => false, 'fehler' => 'speicher']];
    $datei = $dir . '/feedback.jsonl';
    if (file_exists($datei) && filesize($datei) >= FEEDBACK_MAX_DATEI) return [429, ['ok' => false, 'fehler' => 'voll']];
    $limit = fb_limits($dir, $jetzt);
    if ($limit !== null) return [429, ['ok' => false, 'fehler' => $limit]];
    $id = bin2hex(random_bytes(6));
    $zeile = json_encode(['id' => $id, 'empfangen' => gmdate('c', $jetzt)] + $sauber, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($zeile === false || @file_put_contents($datei, $zeile . "\n", FILE_APPEND | LOCK_EX) === false) return [500, ['ok' => false, 'fehler' => 'speicher']];
    return [200, ['ok' => true, 'id' => $id]];
}

if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $body = (string) file_get_contents('php://input', false, null, 0, FEEDBACK_MAX_BODY + 1);
    [$status, $antwort] = feedback_verarbeite(
        $_SERVER['REQUEST_METHOD'] ?? '', $_SERVER['CONTENT_TYPE'] ?? '', $body,
        $_SERVER['HTTP_ORIGIN'] ?? null, $_SERVER['HTTP_HOST'] ?? '', FEEDBACK_DATEN_DIR, time()
    );
    if ($status === 405) header('Allow: POST');
    if ($status === 429 && ($antwort['fehler'] ?? '') === 'zu schnell') header('Retry-After: 900');
    http_response_code($status);
    echo json_encode($antwort);
}
