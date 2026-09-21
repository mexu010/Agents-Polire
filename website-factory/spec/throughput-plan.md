# Durchsatz für 100 Firmen

Ziel: 100 unterschiedliche Firmen zügig vorprüfen und die aussichtsreichsten mit den bestehenden Agents prüfen. Vorprüfung ist ausdrücklich kein visueller Audit und kein Nachweis des Betriebsstatus. Bestehende Evidence-, Budget-, OAuth-, Demo- und Kontaktgrenzen bleiben bestehen. Keine zusätzlichen Dienste.

Die autorisierte Umsetzung verändert den vorhandenen Analyseablauf. Der bestehende Entwicklungsbranch wird weiterbenutzt; die POLIRE-Website bleibt unberührt. Ein weiterer kostenpflichtiger Lauf oder erhöhte Modellgrenzen wird nicht aus einer Laufzeitmessung abgeleitet.

## 1. Quellengebundene Vorprüfung

Neue Datei src/screening.ts und tests/screening.test.ts. collect(browser:false, maxPages:2, maxDurationMs:20000, timeoutMs:5000) sammelt Homepage plus Kontaktseite ohne Modell. Statische HTML-Signale mit URL und Text/Markup-Beleg: fehlendes viewport, Frames, fehlender Titel/Description, Kontaktmöglichkeit. Ein Signal bedeutet Prüfbedarf, keine behauptete schlechte Gestaltung. Fehler/Robots/Javascript-Seiten sind unklar, nicht schlechte oder geschlossene Firmen. Kein formaler Qualitäts- oder Opportunity-Score. Gleichartige Domains deduplizieren, mindestens www/http/https/Fragmente. Dokumente als nicht vertrauenswürdige Daten behandeln.

Schnittstelle: screenWebsite(website, {outputDir,...}) -> ScreeningResult; screenCollected(website,crawl) für Replay; ScreeningResult enthält website, checkedAt, status(candidate|no_signal|uncertain), priority(number, nur Sortierung), signals[{code,observation,sourceUrl,excerpt}], contacts[{kind,value,sourceUrl,excerpt}], limitations:string[], crawl:JsonObject. Tests für grounded signals, no inference from domain/HTTP/date, blocked crawls, encoded text.

## 2. Bounded Scheduler und Berichte

Neue src/prospecting.ts und Tests: 1–100 eindeutige Websites, HTML-Worker standardmässig 6 (max 8), echte Audit-Worker maximal vorhandene crawler.parallelLeads (2). Ein persistentes Manifest bindet URLs und Auswahlparameter. Lease verhindert doppelte parallele Läufe. Jeder fertige Eintrag wird sofort gespeichert. Wiederaufnahme überspringt fertige Schritte; keine neuen Run-IDs für Fehler. Alle Fehler bleiben erhalten. Kandidaten nach statischen Signalen sortieren, maxReviews standardmässig 6; 0 erlaubt reinen Vorlauf. Vollreviews verwenden Factory.runLead(requireDemoDecision:true), damit dieselben Grenzen gelten. Keine automatische Demo.

Bericht listet nur abgeschlossene relevante Reviews mit Link auf Einzelreview in einer Auswahl; ungeprüfte Aktivität ausdrücklich kennzeichnen, separate Warteschlange für Kandidaten/Unklarheiten. Alle 100 Resultate zusätzlich JSON. Erfassung von Wandzeit, Zahl gescreenter Firmen, vollständiger Audits und Modellaufrufe, keine erfundene Geschwindigkeit. Vollständig erneut ausgeführter Befehl verwendet persistierte Resultate.

## 3. Integration und Messung

CLI prospect --file CSV --batch-id ID --mode live|fixture --max-reviews 6, Konfiguration weiterhin explizit. Profil config/prospecting-fast.json: existing dataDir/quota, autoGenerate:false, Lighthouse aus, unveränderte Modellzuordnung. Kein API-Fallback. README mit konkretem Aufruf und Grenzen der Vorprüfung.

Tests vor Implementierung: 100 Eingaben, begrenzte Parallelität, Fehlerisolierung, Wiederaufnahme, unveränderliche Auswahl, Lease, Demo-Sperre, gleiche Domain, echte Quotenreservierung unter Parallelität. Regression Build/Lint/Tests. Benchmark mit klar bezeichneten gespeicherten echten Quellen plus frischen Live-HTML-Abfragen; künstliche Verzögerungen nicht als Live-Durchsatz ausgeben.

## Arbeitsstand

- [x] Vorprüfung und Tests
- [x] Scheduler, CLI und Berichte
- [x] Begrenzte Crawl-Option, Messung und Regression

Entscheidung: Vollständige visuelle Reviews für alle 100 würden mindestens 300 Modellaufrufe benötigen. Bis zur expliziten Freigabe werden nur vorhandene Grenzen genutzt; die Vorprüfung benötigt keine Modellaufrufe.

## Gemessen am 21. September 2026

100 echte Websites in 39.547 Sekunden per HTML vorgeprüft. Vier Kandidaten erhielten vollständige Scout/Audit/Qualifier-Reviews mit Screenshots; 14 OAuth-Aufrufe, aktive Gesamtlaufzeit 278.806 Sekunden. Acht unklare Fälle und 88 Websites ohne statisches Signal bleiben getrennt; sie sind nicht als gute Websites bewertet. Die Recherche und die manuelle Aktivitätsprüfung sind nicht in der Laufzeit enthalten.

Die erste Live-Auswertung deckte eine falsche Zuordnung von `crawl_pages[].outcome` auf. Feldvertrag und Regressionstests korrigiert; erneute lokale Auswertung der gespeicherten, hashgeprüften Rohquellen ohne neue HTML-Abfragen. Verdeckte Tags in Kommentaren/Skripten sowie fehlende Quellen ebenfalls getestet. Fehlgeschlagene Vollreviews werden bewusst nicht automatisch wiederholt.

Build, Lint und alle 213 Tests bestanden. Ein unabhängiges Code-Review prüfte Scheduler, Vorprüfung, Wiederaufnahme und Quoten. Messwerte, Einzelreviews, alle 100 Ergebnisse und zusätzliche Aktivitätsquellen liegen unter `reports/prospecting-100-2026-09-21/`.
