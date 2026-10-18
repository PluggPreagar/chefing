# Sync-Prozedur: Planung (claude.ai) ⇄ Umsetzung (Claude Code / lokal)

Ziel: in claude.ai planen und bauen, auch wenn der Laptop offline ist; später in
`202609_chefing` ohne Informationsverlust übernehmen. Transport ausschließlich über
**Patch-Dateien (git mbox)** im Ordner `HANDOFF/` — kein Kopieren einzelner Dateien.

## 1. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Planungsseite** | claude.ai-Chat. Arbeitet auf einem frischen Clone von `github.com/PluggPreagar/chefing`. Kann nicht pushen. |
| **Umsetzungsseite** | Laptop, Repo `202609_chefing`, mit oder ohne Claude Code. Einzige Seite, die pusht. |
| **Basis** | Commit, auf dem ein Patch aufsetzt (7 Zeichen SHA, steht im Dateinamen). |
| **Inbox** | `HANDOFF/inbox/` — Patches Planung → Umsetzung, noch nicht angewendet. |
| **Applied** | `HANDOFF/applied/` — angewendete Patches (Archiv, committet). |
| **Outbox** | `HANDOFF/outbox/` — unveröffentlichte lokale Commits Umsetzung → Planung. |
| **Log** | `HANDOFF/LOG.md` — Protokoll, schreibt nur `sync.sh`. |

## 2. Dateinamen

`JJJJMMTT-<basis7>-<thema>.patch`, z. B. `20261018-a1b670e-bilanz-funktionen.patch`.
Eine Datei pro Planungssitzung, beliebig viele Commits darin (mbox aus `git format-patch --stdout`).

## 3. Ablauf Planung → Umsetzung (Normalfall)

**Planungsseite (claude.ai):**
1. Repo klonen; falls Nutzer eine Outbox-Datei hochlädt: zuerst `git am -3` darauf (§4).
2. `HANDOFF/LOG.md`, `docs/TODO.md`, `docs/DECISIONS.md` lesen — nächste freie T-/DR-Nummer daraus.
3. Arbeiten, je Todo ein Commit, Repo-Konventionen (DR-Eintrag, TODO → TODO_ARCHIVE, Kommentare mit T-/DR-Verweis).
4. Tests: `sh test/run.sh` muss grün sein.
5. Liefern: `git format-patch origin/main --stdout > HANDOFF/inbox/<name>.patch`, als Zip mit Ordner `HANDOFF/inbox/`. **Kein** LOG.md, **kein** sync.sh im Zip (außer beim Erst-Setup) — sonst Überschreib-Konflikte.

**Umsetzungsseite (offline möglich):**
1. Zip im Repo-Root entpacken → Patch liegt in `HANDOFF/inbox/`.
2. `sh HANDOFF/sync.sh status` — zeigt Basis vorhanden ✓/✗.
3. `sh HANDOFF/sync.sh apply` — `git am -3` je Inbox-Patch (älteste zuerst), verschiebt nach `applied/`, schreibt Log, committet, läuft Tests.
4. Bei Konflikt: lösen → `git add` → `git am --continue` → `sh HANDOFF/sync.sh done <datei>`.
5. Online: Browser-Check (`npx serve .`), dann `git push`.

## 4. Ablauf Umsetzung → Planung

Vor jeder Planungssitzung muss die Planungsseite den aktuellen Stand sehen:
- **Online:** `git push` — fertig, claude.ai klont den aktuellen Stand.
- **Offline / nicht pushen wollen:** `sh HANDOFF/sync.sh export` → `HANDOFF/outbox/<datum>-<origin7>-lokal.patch` in den Chat hochladen. Danach `sh HANDOFF/sync.sh exported <datei>`.

Faustregel: **zwischen zwei Planungssitzungen immer entweder pushen oder exportieren.** Sonst plant claude.ai auf veraltetem Stand und Konflikte werden wahrscheinlich.

## 5. Nummern-Kollisionen (T-/DR-Nummern)

Beide Seiten vergeben fortlaufend; Kollision ist möglich, wenn lokal zwischendurch Todos/DRs angelegt wurden.
Regel: **Die Umsetzungsseite gewinnt.** Beim Konflikt-Lösen die Nummern aus dem Patch auf die
nächsten freien umnummerieren und alle Verweise mitziehen (`grep -rn "T3[3-9]\|DR-02" docs src test`).
Claude Code kann das übernehmen: „Nummern-Kollision nach SYNC.md §5 auflösen“.

## 6. Befehle (`HANDOFF/sync.sh`, POSIX-sh, offline)

| Befehl | Wirkung |
|---|---|
| `init` | HANDOFF-Werkzeug einmalig committen (macht `apply` automatisch). |
| `status` | HEAD, Abstand zu `origin/main`, Inbox-Patches mit Basis-Prüfung, Outbox-Anzahl. |
| `apply [datei]` | Inbox anwenden (`git am -3`), archivieren, loggen, committen, Tests. |
| `done <datei>` | Nach manueller Konfliktlösung: archivieren, loggen, committen. |
| `export` | Unveröffentlichte Commits (ohne `HANDOFF/`) → Outbox-Patch. |
| `exported <datei>` | Übergabe protokollieren, Outbox-Datei entfernen. |
| `test` | `sh test/run.sh`. |

## 7. Regeln

- Patches nie von Hand editieren; bei Problemen in claude.ai neu erzeugen lassen.
- `HANDOFF/` wird committet (Werkzeug, Log, Archiv), aber nicht deployt (`chefing.cfg` deployt nur `*.html *.js *.css *.json`).
- Planungsseite schreibt nie `LOG.md`; Umsetzungsseite nie Patches in `inbox/`.
- Modell-Änderungen weiterhin erst als Optionen (DR-007), dann bauen.

## 8. Prompt für Claude Code (wenn online)

```
Lies HANDOFF/SYNC.md. Führe sh HANDOFF/sync.sh status und dann apply aus.
Bei Konflikten: lösen, Nummern-Kollisionen nach §5, dann sync.sh done <datei>.
Danach Browser-Check nach HANDOFF/CHECKLIST.md, Konsolenfehler beheben, push.
```
