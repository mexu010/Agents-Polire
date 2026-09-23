# POLIRE: GitHub-Sicherung vom 23. September 2026

## Inhalt

- Factory-Designrecherche, beleggebundene visuelle QA, Vergleich früherer Projekte, drei zusätzliche Rendererprofile und optionale gerenderte Konzeptauswahl.
- Coiffeur Lanz: vollständige Anwendung mit Verwaltung in der gewählten Richtung B, gespeicherte Mini-Entwürfe A/B/C, Vorschau- und Prüfscripte.
- Technische Übergabe, Designberichte, Entwicklungspläne und Hostingplan.
- Im Sammelrepo zusätzlich: bereitgestelltes Design-Upgrade-Paket, öffentliche Lanz-Testbilder und eine Zusammenfassung der letzten Projektentscheidungen.

Die bestehenden Rollen, OAuth-/API-Wege, Budgets, Quoten, Faktenbindung und menschlichen Freigaben bleiben erhalten. Kein bezahlter Hostingdienst wurde gebucht, kein neuer Live-Modelllauf gestartet und keine Nachricht an Kunden versendet.

## Frisch ausgeführte Prüfungen

Im aktiven Factory-Checkout, vor Erstellung der GitHub-Sicherung:

| Prüfung | Ergebnis |
|---|---|
| `pnpm build` | Bestanden |
| `pnpm lint` | Bestanden |
| `pnpm exec vitest run --maxWorkers=1 --no-file-parallelism` | 35 Dateien, 308 Tests bestanden; 139,98 Sekunden |
| `node --test clients/coiffeur-lanz/tests/*.test.mjs` | 21 Tests bestanden |
| `node clients/coiffeur-lanz/cli.mjs check` | Seiten, Inhalte und Assets bestanden |

Beim ersten Standard-Testlauf liefen Build, Lint und Testdateien gleichzeitig. Drei Tests überschritten ihre Zeitlimits, 305 bestanden. Beim vollständigen Lauf mit einem Worker bestanden alle 308 Tests unverändert. Diese Zeitabhängigkeit ist eine verbleibende Einschränkung des stark parallelen lokalen Testlaufs; Testzeitlimits oder Produktcode wurden dafür nicht verändert.

Die Screenshot-Belege stammen aus den dokumentierten Browserprüfungen vom 22.09.2026. Sie sind keine neu ausgeführte visuelle Abnahme am 23.09.2026. Die heutigen Factory-Tests enthielten tatsächliche Browserprüfungen; Lanz wurde heute zusätzlich mit API-/Renderer-Tests geprüft.

## Auf einem anderen Rechner starten

Im Sammelrepo ist `website-factory/` das Arbeitsverzeichnis. Node.js 24.19.0 oder eine kompatible aktuelle Version von Node 24 und pnpm verwenden.

```powershell
git fetch origin
git switch --track origin/codex/polire-design-hosting-2026-09-23
cd website-factory
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm exec vitest run --maxWorkers=1 --no-file-parallelism
node clients/coiffeur-lanz/preview-review.mjs
```

Existiert der lokale Branch bereits, genügt `git switch codex/polire-design-hosting-2026-09-23`. Eigene Änderungen vorher sichern und keinen erzwungenen Reset verwenden. Die isolierte Lanz-Vorschau steht anschliessend unter `http://127.0.0.1:4332/`; jeder Start erzeugt frische Testdaten. Dauerhafter lokaler Betrieb und separate Einrichtung stehen in `clients/coiffeur-lanz/README.md`.

Factory-Anmeldung erfolgt auf jedem Rechner separat gemäss README. Laufzeitdaten, Zugangsdaten und verbrauchte Budgetkonten werden nicht übertragen. Ein neuer Checkout ist keine Erlaubnis für neue kostenpflichtige Modellläufe.

## Abgrenzung

Ausgeschlossen: `.env`, OAuth-Tokens, `.local-access.txt`, private Schlüssel, Datenbanken, Kundeneingänge, installierte Pakete und rohe Laufzeitprotokolle. Die kopierten Änderungen wurden gegen bekannte lokale Geheimnisse und verbreitete Tokenmuster geprüft; das ersetzt keine unabhängige Sicherheitsprüfung.

Die Original-Arbeitsordner wurden nicht durch das Sammelrepo ersetzt. Vor der Übertragung stimmten alle 422 versionierten Factory-Basisdateien mit dem bisherigen GitHub-Archivstand überein; 19 nur im Archiv vorhandene Review-Dateien blieben erhalten. Nur die geprüften Änderungen und neuen Dokumente/Belege wurden ergänzt.

Die aktuelle POLIRE-Agenturwebsite liegt bereits im separaten Repo `mexu010/Agency_Polire_Website`, Branch `feat/project-enquiry`, Commit `4d9936ad3ae0cb31f6f624b0057f4b3fe4385a11`. Ihr historischer Ordner im Sammelrepo und ihre Veröffentlichungen wurden nicht verändert.
