# POLIRE · Design-Upgrade für die bestehende Factory

**Status: Integrationsauftrag, Prompt-Ergänzungen und separat getestete Offline-Helfer. Kein bereits integrierter Factory-Patch.**

Grundlage ist `TECHNISCHE-UEBERGABE-2026-09-22.md`. Der tatsächliche Factory-Quellcode, seine Datenbank, seine Traces und die individuellen Demorenderer wurden in dieser Sitzung nicht bereitgestellt. Alle Aussagen zum bestehenden System beziehen sich auf diese Übergabe. Neu vorgeschlagene Verträge und Funktionen sind ausdrücklich als solche markiert.

## Die wichtigste Entscheidung

Nicht eine zweite Agentenplattform oder eine parallele Python-Pipeline installieren. Bestehende Rollen, TypeScript-Runtime, AJV-Verträge, Evidence/ImageBinding, SQLite-Persistenz, Budgets und Freigaben weiterverwenden. Die bisherige allgemeine Agenten-Kit-Empfehlung wird für dieses Projekt durch diesen gezielten Auftrag präzisiert.

Die Factory, die 15 individuell gebauten Demos und `clients/coiffeur-lanz/` sind getrennte Ergebnisse. Eine Factory-Änderung gestaltet Lanz nicht automatisch neu.

## Was du zuerst verwendest

| Datei | Verwendung |
|---|---|
| `AUFTRAG-POLIRE.md` | Vollständiger Arbeitsauftrag an den lokalen Entwicklungsagenten. |
| `prompts/*.md` | Rollenspezifische Ergänzungen. Nicht blind bestehende gemeinsame Regeln ersetzen. |
| `docs/PIPELINE-UND-VERTRAEGE.md` | Versions- und Integrationsplan einschliesslich echter Konzeptvorschauen. |
| `docs/RECHERCHE.md` | Rechercheauswahl, echte Bilder, begrenzte Werkzeuge und unveränderte Budgets. |
| `docs/COPY-UND-ASSETS.md` | Natürlichere Texte bei weiter bestehender Faktenbindung; Gestaltung ohne freigegebene Fotos. |
| `docs/ABNAHME.md` | Noch zu implementierende Factory-Integrationstests und menschliche Gestaltungskriterien. |
| `docs/LANZ-DESIGNAUFTRAG.md` | Separater Auftrag für die tatsächlich im Screenshot sichtbare Kundenanwendung. |
| `TESTING.md` | Tatsächlich geprüfter Stand dieses Kits und seine Grenzen. |

## Drei Offline-Skripte

### 1. Quellbaum prüfen, ohne Factory-Code auszuführen

Das Paket vorzugsweise neben `website-factory/` entpacken, nicht über bestehende Dateien. Im Paketordner:

```powershell
node .\scripts\source-preflight.mjs --root "C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory"
```

Der Befehl liest nur eine feste Liste erwarteter Quelldateien, meldet Existenz und SHA-256-Hashes sowie Branch, Commit und Anzahl geänderter versionierter Einträge, soweit Git verfügbar ist. Keine Quelltextausgabe, keine `.env`, keine Kundendaten, keine Datenbanken, kein Zugriff auf Remotes, keine Modellaufrufe, keine Ausführung von Paket-Skripten. Symlinks zu anderen Zielpfaden werden nicht gelesen.

**Grenze:** Das ist eine Bestandsaufnahme, kein semantischer Kompatibilitätscheck. Unversionierte Dateien werden nicht aufgezählt. Der Entwicklungsagent muss zusätzlich den tatsächlichen Git-Status prüfen und vorhandene Änderungen erhalten.

### 2. Bereits beschriebenen Drei-Feld-Fingerprint vergleichen

```powershell
node .\scripts\check-current-fingerprints.mjs --input .\fixtures\current-fingerprints.json
```

Dieser Helfer verwendet die drei in der Übergabe tatsächlich beschriebenen Merkmale `composition`, `font_pair` und `section_order`. Er prüft die bereitgestellte Historie und erkennt damit auch eine ältere Wiederholung, wenn das letzte Design anders war. Keine neue Rendererfunktion wird dafür behauptet. Die Beispieldaten sind synthetisch; eine echte Anbindung an `src/design-policy.ts`/SQLite muss im vorhandenen Repository implementiert werden.

Die eigene harte Prüfung des letzten vergleichbaren Designs bleibt erhalten. Zusätzliche Treffer sind begründete Warnungen, keine Aussagen über visuelle Qualität.

### 3. Erweiterte Konzeptunterschiede und Wiederholungen prüfen

```powershell
node .\scripts\evaluate-designs.mjs --input .\fixtures\synthetic-comparison.json
```

Das Beispiel enthält bewusst eine ältere Wiederholung und einen inkompatiblen historischen Datensatz. Daher zeigt es `review_required`. Die dritte Konzeptvariante ist nicht automatisch ein besseres Design.

```powershell
node .\scripts\evaluate-designs.mjs --input .\fixtures\synthetic-distinct.json --strict
```

Das zweite, ebenfalls synthetische Beispiel besteht die deklarierten Unterschiedsregeln. `--strict` liefert Exitcode 1 bei Warnungen oder Vergleichslücken, Exitcode 2 bei ungültiger Eingabe. Ohne `--strict` kann ein erfolgreich erstellter Warnbericht Exitcode 0 haben.

Die Skripte drucken JSON auf stdout. Sie schreiben keine Factory-Daten und ersetzen weder deren Orchestrator noch deren bestehende harte Wiederholungsprüfung.

## TypeScript-Baustein

`src/design-diversity.ts` enthält kontrolliertes Einlesen von Capability-Katalog und Signaturen, paarweisen Konzeptvergleich und Vergleich über standardmässig acht vom Aufrufer ausgewählte jüngere Designs. Die `dist/`-Dateien sind daraus kompiliert; zum Ausführen der Skripte ist keine Paketinstallation nötig.

Die Merkmale `hero_structure`, `mobile_structure`, `section_rhythm`, `image_strategy`, `service_layout` und `density` sind **Vorschläge für eine Erweiterung**, keine Behauptung bereits vorhandener SiteSpec-Felder. Die Capability-Werte in den Fixtures sind reine Testwerte. Ein Produktionskatalog darf nur Fähigkeiten enthalten, die der tatsächliche Renderer implementiert und sichtbar geprüft hat.

Der echte Adapter muss in der Factory entstehen: Die Runtime leitet die Signatur aus dem aufgelösten, unterstützten Designplan ab. Freie Eigenbeschreibungen des Modells reichen nicht. Projekt-/Markenschlüssel, Zeitstempel und vergleichbare Historie kommen aus vertrauenswürdigem Anwendungscode; nur anonymisierte Gestaltungseigenschaften gehören in kundenübergreifende Modellinputs.

## Lokale Tests dieses Pakets

Im Paketordner:

```powershell
node --test tests/diversity.test.mjs tests/cli.test.mjs tests/current-fingerprint.test.mjs
```

Neu kompilieren mit dem bereits vorhandenen TypeScript des Factory-Projekts; bei der empfohlenen Nachbarordner-Struktur im Factory-Ordner:

```powershell
pnpm exec tsc --project ..\polire-design-upgrade\tsconfig.json
```

Kein `npx` mit nachgeladenen Paketen erforderlich. Keine Abhängigkeiten auf `latest` ändern. In dieser Sitzung getestet: Node 22.16.0, TypeScript 5.8.3, Linux. Die Ziel-Factory verwendet laut Übergabe Node 24+ und TypeScript ^5.9.0; Windows-/Node-24-Integration wurde hier nicht geprüft.

## Keine versteckten Freigaben

Dieses Paket erteilt keine Genehmigung für neue Live-Modellläufe, bezahlte Suche, kostenpflichtige APIs, erhöhte Quoten, Veröffentlichung oder Kontaktaufnahme. Bestehende historische Testbudgets werden nicht wiederverwendet. Runtime-Agents erhalten durch diese Dateien keine Shell-, Browser- oder Suchwerkzeuge.

## Quellen und Nachweise

`QUELLEN.md` ordnet die Bestandsaussagen den Abschnitten der hochgeladenen Übergabe zu. Die vorgeschlagenen Erweiterungen sind eigene Entwicklungsentwürfe. Verbesserte Designqualität muss erst an echten, ausdrücklich freigegebenen Factory-Läufen und durch menschliche Beurteilung nachgewiesen werden.
