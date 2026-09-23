# Tatsächlich geprüfter Stand dieses Kits

## Ausgeführte Prüfungen

Umgebung dieser Sitzung: Linux, Node.js `v22.16.0`, TypeScript `5.8.3`. Die kompilierten Dateien in `dist/` wurden aus den enthaltenen TypeScript-Quellen erzeugt.

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| `tsc --project tsconfig.json` | Erfolgreich; Strictness einschliesslich `noUncheckedIndexedAccess` und `exactOptionalPropertyTypes`. |
| `node --test tests/diversity.test.mjs tests/cli.test.mjs tests/current-fingerprint.test.mjs` | 44 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen in dieser Umgebung. |
| Syntaxprüfung der drei `.mjs`-Skripte | Erfolgreich. |
| Aktuelle Drei-Feld-Fingerprints, synthetische Historie | Ältere Wiederholung bei unterschiedlichem letztem Design erkannt. |
| Erweiterter synthetischer Vergleich | Warnung für ältere Wiederholung; inkompatible Historie als Lücke, nicht als Neuheit. |
| Synthetischer Vergleich unterschiedlicher Konzepte mit `--strict` | Deklarierte Regeln bestanden, Exitcode 0. Kein visueller Qualitätsnachweis. |
| Strict-Warnfall | Erwarteter Exitcode 1 im CLI-Test. |
| Ungültige Eingaben | Erwarteter Exitcode 2; Fehlerbericht ohne unbehandelte Exception. |
| Read-only-Preflight | Mit künstlich erzeugtem Quellbaum geprüft; keine ausgeführten Paket-Skripte, keine Ausgabe der Test-Secrets. |
| Symlink auf ausgeschlossene Daten | In dieser Linux-Umgebung nicht gelesen; separater Test bestanden. |

Ein leerer `evidence/typescript-output.txt` ist die tatsächliche, fehlerfreie Compiler-Ausgabe, kein fehlender Bericht. Der Testlauf steht in `evidence/offline-tests.tap`. Drei JSON-Beispielberichte dokumentieren die realen Ausgaben für die mitgelieferten Fixtures.

## Was die Tests abdecken

Strikte Einleseprüfung der deklarierten Daten, bekannte Capability-Tokens, unbekannte Felder, alte Versionen, Reihenfolgen, paarweiser Konzeptvergleich, begrenzte Historie, ältere Wiederholungen, Projekt-/Marken-Ausnahmen, Vergleichslücken, ungültige Zeitstempel, unveränderte Eingaben, Kommandozeilenfehler und die beschränkte read-only-Quellinventur.

Die gewählten Ähnlichkeitsgewichte und Unterschiedsschwellen sind transparente Studio-Heuristiken. Ein Test ihres Rechenwegs beweist weder ihren universellen gestalterischen Nutzen noch eine tatsächliche visuelle Unterscheidung. Dafür sind gerenderte Bilder und unabhängige menschliche Sichtprüfung nötig.

## Nicht ausgeführt oder nicht vorhanden

Kein Zugriff auf das vollständige POLIRE-Repository oder die dortige Datenbank. Keine Änderungen an `src/agents.ts`, `src/orchestrator.ts`, dem echten Renderer oder Lanz. Keine originalen `pnpm build`-/Lint-/Test-/Browserläufe der Factory. Keine echte Datenmigration, keine Freigabe-/Quota-Integration und keine neue Zustandsmaschine in der vorhandenen Anwendung.

Keine neuen Websuchen, Live-Referenzscreenshots, OpenAI-/Codex-Aufrufe, Brave-Aufrufe, Kontoprüfungen, Modellvergleiche, kostenpflichtigen Dienste, echten Kontaktaktionen oder Veröffentlichungen. Kein gemessener Einfluss auf Designqualität, Kundeninteresse oder Conversion.

Die Prompt-Ergänzungen wurden nicht gegen das vollständige tatsächliche AJV-Schema der Factory ausgeführt. Sie sind gegen die beschriebene Architektur formuliert und müssen vom lokalen Entwicklungsagenten mit dem realen Schema abgeglichen werden.

## Zielumgebung und Übertragbarkeit

Die Übergabe beschreibt Node 24+ und TypeScript ^5.9.0 unter Windows. Diese Kombination wurde hier nicht ausgeführt. Das Kit braucht zur Ausführung seiner fertig kompilierten Offline-Skripte keine Drittanbieterpakete. Bei erneuter Kompilierung die vorhandene TypeScript-Installation verwenden, keine Abhängigkeiten still aktualisieren.

Der Symlink-Test wird auf Systemen ohne Berechtigung zum Erstellen von Symlinks ausdrücklich als übersprungen gemeldet. Ein übersprungener Test ist kein bestandener Sicherheitsnachweis für dieses System. Die CLI-Tests nutzen künstliche temporäre Dateien und entfernen sie danach; sie sind nicht als Tests am Kundenbestand zu verstehen.
