#!/usr/bin/env python3
"""Lokaler Entwicklungsserver für Chefing (DR-082): statische Dateien wie ein normaler Webserver, dazu die Annahme von Fehlermeldungen.

"Fehler melden" -> "Absenden" schickt POST /chefing-issue.php (derselbe Weg wie live). Hier landet die Meldung entpackt in
issues/open/<Zeit>-<Titel>-<Zufall>/ : issue.md, meta.json, wireframe.png, anhang/ (Format wie im Projekt aktien-monitor).

Nur Standardbibliothek, nur 127.0.0.1. Start: `just serve` oder `python tools/dev-server.py [--port 8780] [--issues issues/open]`.
Nur für die Entwicklung: keine Limits je Zeit, keine Origin-Prüfung; Rückmeldungen ("Hat es geklappt?") nimmt der Server nicht an.
"""
import argparse
import base64
import binascii
import io
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENDPUNKT = "/chefing-issue.php"
MAX_BODY = 18 * 1024 * 1024    # wie ISSUE_MAX_BODY in chefing-issue.php
MAX_ZIP = 12 * 1024 * 1024     # wie ISSUE_MAX_ZIP
MAX_TEXT = 200 * 1024          # wie ISSUE_MAX_TEXT
MAX_TITEL = 120                # wie ISSUE_MAX_TITEL
NICHT_AUSLIEFERN = (".git", "issues", "issues-data", "feedback-data")  # liegen im Projektordner, gehören nicht in den Browser


def lokale_version():
    """Stand des Arbeitsordners für die Versionszeile (lokal gibt es keine version.json vom Deploy): Commit, Zeit, ob etwas geändert ist."""
    def git(*a):
        try:
            return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, timeout=5).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return ""
    sha = git("rev-parse", "HEAD")
    if not sha:
        return {}
    ct = git("log", "-1", "--format=%ct")
    commit = datetime.fromtimestamp(int(ct), timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if ct.isdigit() else None
    geaendert = bool(git("status", "--porcelain", "--", "src", "index.html", "style.css"))
    dateien = [p for p in (ROOT / "src").rglob("*") if p.is_file()] + [ROOT / "index.html", ROOT / "style.css"]
    jung = max((p.stat().st_mtime for p in dateien if p.exists()), default=0)
    zusatz = f"lokal, geändert {datetime.fromtimestamp(jung).strftime('%H:%M')}" if geaendert else "lokal"
    return {"sha": sha, "time": commit, "anzeige": f"{sha[:7]} ({zusatz})", "branch": git("rev-parse", "--abbrev-ref", "HEAD")}


def slug(titel: str) -> str:
    s = titel.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40] or "fehler"


def dateiname(name: str) -> str:
    """Nur der Dateiname, nur sichere Zeichen (wie dateiname() in src/model/meldung.js)."""
    n = re.split(r"[\\/]", name)[-1]
    return re.sub(r"[^A-Za-z0-9._-]+", "_", n)[:80].lstrip(".") or "anhang"


def pruefe(m):
    """Prüft die Anfrage wie is_pruefe() in chefing-issue.php. Rückgabe: (bereinigt, None) oder (None, fehlertext)."""
    if not isinstance(m, dict):
        return None, "kein json-objekt"
    titel = m.get("titel")
    titel = re.sub(r"\s+", " ", titel).strip() if isinstance(titel, str) else ""
    if not titel or len(titel) > MAX_TITEL:
        return None, "titel"
    md = m.get("issue_md")
    if not isinstance(md, str) or not md or len(md.encode("utf-8")) > MAX_TEXT:
        return None, "issue_md"
    meta = m.get("meta_json")
    if not isinstance(meta, str) or not meta or len(meta.encode("utf-8")) > MAX_TEXT:
        return None, "meta_json"
    try:
        if not isinstance(json.loads(meta), dict):
            return None, "meta_json"
    except ValueError:
        return None, "meta_json"
    b64 = m.get("zip_b64")
    if not isinstance(b64, str) or not b64:
        return None, "zip_b64"
    try:
        zip_bytes = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        return None, "zip"
    if not (22 <= len(zip_bytes) <= MAX_ZIP) or zip_bytes[:4] not in (b"PK\x03\x04", b"PK\x05\x06"):
        return None, "zip"
    return {"titel": titel, "issue_md": md, "meta_json": meta, "zip": zip_bytes}, None


def speichern(sauber, ziel: Path, jetzt: datetime) -> str:
    """Legt die Meldung als Ordner an und gibt ihre id zurück. issue.md und meta.json kommen aus dem JSON, Wireframe und Anhänge aus
    dem ZIP; sonst wird nichts entpackt (feste Namen, bereinigte Dateinamen, Größengrenze)."""
    ident = f"{jetzt.strftime('%Y%m%d-%H%M%S')}-{slug(sauber['titel'])}-{secrets.token_hex(2)}"
    ordner = ziel / ident
    ordner.mkdir(parents=True, exist_ok=False)
    (ordner / "issue.md").write_text(sauber["issue_md"], encoding="utf-8", newline="\n")
    (ordner / "meta.json").write_text(sauber["meta_json"], encoding="utf-8", newline="\n")
    try:
        with zipfile.ZipFile(io.BytesIO(sauber["zip"])) as z:
            if sum(i.file_size for i in z.infolist()) > 3 * MAX_ZIP:
                raise zipfile.BadZipFile("entpackt zu groß")
            for info in z.infolist():
                teile = info.filename.replace("\\", "/").split("/")[1:]  # erste Ebene = Ordnername im ZIP
                if info.is_dir() or not teile:
                    continue
                if teile == ["wireframe.png"]:
                    ziel_datei = ordner / "wireframe.png"
                elif len(teile) == 2 and teile[0] == "anhang":
                    (ordner / "anhang").mkdir(exist_ok=True)
                    ziel_datei = ordner / "anhang" / dateiname(teile[1])
                else:
                    continue
                ziel_datei.write_bytes(z.read(info))
    except zipfile.BadZipFile as e:
        (ordner / "FEHLER-ZIP.txt").write_text(f"Das ZIP ließ sich nicht entpacken: {e}\n", encoding="utf-8")
    return ident


class Server(ThreadingHTTPServer):
    # Unter Windows kann ein zweiter Server denselben Port belegen (SO_REUSEADDR, und ein Bind an 127.0.0.1 gelingt auch neben einem
    # Server auf 0.0.0.0): Anfragen landen dann beim falschen. Dort exklusiv binden, sonst scheitert der Start mit klarer Meldung.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def antwortet_schon(port: int) -> bool:
    """Lauscht auf dem Port schon etwas? Unter Windows reicht der Bind-Fehler nicht: neben einem Server auf 0.0.0.0 gelingt ein
    Bind an 127.0.0.1 trotzdem, und der neue Server würde die Anfragen stillschweigend an sich ziehen."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def handler_fuer(issues: Path):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(ROOT), **k)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")  # beim Entwickeln nie veraltete Dateien
            super().end_headers()

        def log_message(self, fmt, *args):
            if args and str(args[0]).startswith(("GET", "HEAD")) and str(args[1]).startswith("2"):
                return  # erfolgreiche Dateiabrufe nicht protokollieren
            super().log_message(fmt, *args)

        def antwort(self, status, inhalt, extra=None):
            body = json.dumps(inhalt, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def gesperrt(self):
            erste = self.path.split("?")[0].lstrip("/").split("/")[0]
            return erste in NICHT_AUSLIEFERN

        def do_GET(self):
            if self.path.split("?")[0] == ENDPUNKT:
                return self.antwort(405, {"ok": False, "fehler": "nur POST"}, {"Allow": "POST"})
            if self.path.split("?")[0] == "/version.lokal.json":
                return self.antwort(200, lokale_version())
            if self.gesperrt():
                return self.send_error(404)
            return super().do_GET()

        def do_HEAD(self):
            if self.gesperrt():
                return self.send_error(404)
            return super().do_HEAD()

        def do_POST(self):
            if self.path.split("?")[0] != ENDPUNKT:
                return self.antwort(404, {"ok": False, "fehler": "nur /chefing-issue.php wird angenommen"})
            if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
                return self.antwort(415, {"ok": False, "fehler": "nur application/json"})
            laenge = int(self.headers.get("Content-Length") or 0)
            if laenge > MAX_BODY:
                return self.antwort(413, {"ok": False, "fehler": "zu gross"})
            try:
                m = json.loads(self.rfile.read(laenge))
            except ValueError:
                return self.antwort(400, {"ok": False, "fehler": "kein json-objekt"})
            if isinstance(m, dict) and str(m.get("website") or "").strip():
                return self.antwort(200, {"ok": True})  # Honeypot wie live
            sauber, fehler = pruefe(m)
            if sauber is None:
                return self.antwort(400, {"ok": False, "fehler": fehler})
            try:
                ident = speichern(sauber, issues, datetime.now(timezone.utc))
            except OSError as e:
                print(f"! Speichern fehlgeschlagen: {e}", file=sys.stderr)
                return self.antwort(500, {"ok": False, "fehler": "speicher"})
            try:
                zeig = (issues / ident).relative_to(ROOT).as_posix()
            except ValueError:
                zeig = str(issues / ident)
            print(f"Fehlermeldung gespeichert: {zeig}/ ({sauber['titel']})", flush=True)
            return self.antwort(200, {"ok": True, "id": ident})

    return Handler


def main(argv=None):
    p = argparse.ArgumentParser(description="Lokaler Entwicklungsserver für Chefing mit Ablage für Fehlermeldungen")
    p.add_argument("--port", type=int, default=8780, help="Port (0 = freier Port), Vorgabe 8780 (8765 nutzt die Vorschau mit npx serve)")
    p.add_argument("--issues", default=str(ROOT / "issues" / "open"), help="Ordner für Fehlermeldungen, Vorgabe issues/open")
    a = p.parse_args(argv)
    issues = Path(a.issues).resolve()
    issues.mkdir(parents=True, exist_ok=True)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        if a.port and antwortet_schon(a.port):
            raise OSError(None, "dort antwortet schon ein Server")
        httpd = Server(("127.0.0.1", a.port), handler_fuer(issues))
    except OSError as e:
        print(f"Port {a.port} ist belegt oder nicht erreichbar ({e.strerror or e}).", file=sys.stderr)
        print("Anderen Port wählen (just serve 8781) oder den Server beenden, der ihn belegt. Auf Windows: netstat -ano | findstr :" + str(a.port), file=sys.stderr)
        sys.exit(1)
    port = httpd.server_address[1]
    print(f"Chefing läuft auf http://127.0.0.1:{port}/  (Strg+C beendet)", flush=True)
    print(f"Fehlermeldungen landen in {issues}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBeendet.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
