# Design-Recherche und vielfältige Demos

**Ziel:** Vor einem freigegebenen Demo-Entwurf echte Gestaltungsreferenzen prüfen, eine eigenständige Designrichtung begründen und diese sichtbar umsetzen. Bestehende Firmenfakten, Rechte, Freigaben, Budgets und Preview-Sicherheit bleiben bindend.

**Architektur:** Ein begrenzter, persistierter Recherche-Schritt zwischen Demo-Freigabe und Strategist. Keine zusätzliche LLM-Rolle. Primär vorhandene Suchanbindung, wenn explizit konfiguriert und budgetiert; sonst ehrlich benannter, nach Branche ausgewählter Referenzkatalog oder lokale Betreiber-URLs. Referenzen werden mit dem vorhandenen geschützten Crawler gelesen und fotografiert. Die Inhalte sind Inspiration, keine Quelle für Kundenbehauptungen oder freigegebene Bilddateien.

**Designvertrag:** `Theme.composition` ist ein optionales, rückwärtskompatibles Enum: `atelier`, `editorial`, `bold`, `minimal`. Neue Recherche-Briefings benötigen dieses Feld und einen `design_plan`. Der Plan nennt Konzept, verwendete Referenz-IDs, konkrete Beobachtungen/Anwendung, zwei andere Kompositionen mit Ablehnungsgrund und bewusst vermiedene Muster. Farben und Schriftwechsel allein gelten nicht als Vielfalt. `SiteSpec` trägt die ausgewählte Komposition in `theme`; Builder muss sie erhalten. Frühere Briefings bleiben lesbar.

**Gestaltungsrichtungen:** Atelier = asymmetrische Bild-/Textkomposition, ruhige Serifentitel; Editorial = redaktioneller Auftakt und nummerierte Kapitel/Leistungszeilen; Bold = plakative Typografie, kräftige Flächen und volle Bildbreite; Minimal = kompakter Einstieg, schmale Inhalte und sachliche Leistungslisten. Die Firma bestimmt die Richtung; keine zufällige Rotation. Ohne freigegebene Bilder entstehen absichtlich typografische Lösungen.

## Task 1: Renderer

Dateien: `src/renderer.tsx`, `tests/renderer.test.ts`, optional neue `src/design-styles.ts`.

- [x] Unterschiedliche DOM-Strukturen für vier Kompositionen; alte SiteSpecs behalten ihren bisherigen Pfad.
- [x] Responsive 375/768/1440, sinnvolle h1-Hierarchie, keine Überläufe; echte `subtle` Bewegung nur CSS und reduzierte Bewegung respektieren.
- [x] Beliebige validierte Akzentfarbe über generierte lokale CSS-Datei mit lesbarer Textfarbe. Keine Inline-Skripte, Hotlinks, externen Fonts oder Formulare.
- [x] ApprovedAsset-Hashprüfung, CSP, Vorschauhinweise, Manifest und Integrität erhalten. Renderer-Version erhöhen.
- [x] Tests für strukturelle Unterschiede, fehlende Bilder, Brand-Akzent und Sicherheit.

## Task 2: Recherche, Daten und Agenten

Dateien: `src/design-research.ts` neu, `src/design-policy.ts` neu, `src/config.ts`, `spec/contracts.schema.json`, `src/fixtures.ts`, `src/agents.ts`, `prompts/{strategist,builder,qa}.ts`, passende Tests.

- [x] Höchstens drei Referenzen mit bestehenden Crawl-Grenzen prüfen; Desktop-Bild je Referenz und Textauszüge als getrenntes Inspirationspaket. Fehlende Quellen/Bilder klar ausweisen, keine behauptete visuelle Prüfung ohne Bild.
- [x] Branchenabhängige Referenzauswahl, optionale Suche nur mit bestehender Budgetreservierung, unbekannte Branchen klar als allgemeine Inspiration markieren.
- [x] Strenge Referenzbindung, zwei echte Alternativen, Schutz vor direkter Wiederholung des letzten vergleichbaren Entwurfs, keine fremden Firmenfakten/Assets übernehmen.
- [x] Gespeicherte Ergebnisse bei Wiederaufnahme nutzen; Fixtures ohne Netzwerk/Modellaufrufe.

## Task 3: Integration und Prüfung

Dateien: `src/orchestrator.ts`, `src/workflow.ts`, `README.md`, `scripts/design-showcase.ts` neu, passende Tests.

- [x] Recherche erst nach Freigabe, unter bestehenden Leases/Fencing/Staging; Löschung und Revision berücksichtigen.
- [x] Renderer-Version im Cache-Schlüssel. Keine zusätzlichen Modellschleifen, unveränderte Limits.
- [x] Bericht mit klickbaren Inspirationsquellen und gewählter Richtung. Reproduzierbarer lokaler Vergleich aller vier Kompositionen mit identischen synthetischen Firmenfakten.
- [x] Build, Lint, gesamte Testsuite, mobile/desktop Browserprüfung und unabhängige Codeprüfung; erst danach Commit und bestehende private GitHub-Sicherung aktualisieren.

## Abgrenzung

Die bisherigen 15 handgebauten Demos werden nicht heimlich neu erzeugt. Der neue Ablauf gilt für neu erstellte Briefings. Keine Behauptung eines erfolgreichen Live-Modelltests ohne tatsächlich ausgeführten Aufruf. Referenzkatalog ist eine Startauswahl, keine Rangliste der besten Websites.
