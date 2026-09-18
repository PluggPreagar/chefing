# Chefing — Todo

States: `open` · `doing` · `blocked` · `done`

| id | title | state | descr | dependencies |
|----|-------|-------|-------|--------------|
| T01 | MVP Rührteig-Kombinator | done | Generisches Schema, Regeln in `operations.json`, Korpus (3×7 Rezepte), Morph-Kasten, Ablaufdiagramm, Rezeptkarte, Statistik. Commit `c809b84`. | – |
| T02 | Push nach GitHub | blocked | `git push -u origin main` nach github.com/PluggPreagar/chefing. Blockiert: keine Credentials im Terminal (kein `gh`, kein SSH-Key). Nutzer pusht selbst oder richtet `gh auth login` ein. | T01 |
| T03 | README | open | Kurzbeschreibung, Start (`npx serve`), Datenmodell-Übersicht, wie neue Archetypen/Korpus ergänzt werden. | T01 |
| T04 | Korpus erweitern | open | Mehr Quellrezepte je Variante (Ziel ≥ 15), damit Median/IQR belastbar werden. Quellen: gutekueche.at, oetker.de, lecker.de, kuechengoetter.de (chefkoch blockiert Fetch). | T01 |
| T05 | Varianten-Cluster in Statistik | open | Korpus nach Fett-Typ × Säure × Einlage clustern und im Stats-Panel zeigen (war im Plan, noch nicht umgesetzt). | T04 |
| T06 | Zweiter Archetyp als reine Daten | open | Z. B. „Gemüse braten“ oder „Hefeteig“ — nur JSON ergänzen, keine JS-Sonderlogik. Prüft, ob das Schema wirklich domänenneutral ist. `rules.js` referenziert noch `archetypes.ruehrteig` hart (Zeilen 104, 112) → generalisieren. | T01 |
| T07 | Tests headless | open | `check.mjs` aus dem Scratchpad ins Repo (`test/`) übernehmen und um Regel-Fälle erweitern. | T01 |
