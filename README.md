# POLIRE Projektarchiv

## Aktueller Sicherungsstand: 23. September 2026

Der Branch `codex/polire-design-hosting-2026-09-23` enthält das Factory-Designupgrade, die vollständige Lanz-Website in Richtung B, alle drei vorherigen Gestaltungsrichtungen und den Hostingplan. Er dient zur Sicherung und Zusammenarbeit; Render wurde nicht eingerichtet. Ältere Abschnitte und Berichte unten beschreiben ihren jeweiligen historischen Stand.

- [Aktueller Stand, Einrichtung und Prüfungen](website-factory/docs/GITHUB-STAND-2026-09-23.md)
- [Hostingplan mit Kosten](website-factory/docs/superpowers/plans/2026-09-23-polire-kundenhosting.md)
- [Lanz-Screenshot-Belege](website-factory/docs/evidence/README.md)
- [Zusammenfassung der letzten sichtbaren Projektentscheidungen](chats/Polire-Agents-2026-09-23-Stand.md)
- `source-documents/polire-design-upgrade.zip` und der gleichnamige entpackte Quellordner bewahren das bereitgestellte Auftragspaket. Das Paket ist eine historische Entwicklungsgrundlage, kein direkt installierbarer Factory-Patch. Generierte `dist/`-Dateien sind im Original-ZIP enthalten.

Die aktuelle Agenturwebsite wird separat entwickelt: [Agency_Polire_Website, Branch feat/project-enquiry](https://github.com/mexu010/Agency_Polire_Website/tree/feat/project-enquiry). Der dortige Commit `4d9936ad3ae0cb31f6f624b0057f4b3fe4385a11` war am 23.09.2026 bereits auf GitHub vorhanden. Der Ordner `polire-website/` in diesem Sammelarchiv bleibt ein älterer Archivstand; er wurde nicht ungeprüft synchronisiert.

Stand: 21. September 2026. Dieses Archiv enthält den Website-Quellcode, die Website Factory mit sieben Agent-Rollen, Spezifikationen, Tests, verfügbare sichtbare Projekt-Chats und Review-Ergebnisse.

## Verzeichnisse

- `polire-website/`: bestehende POLIRE-Website; Setup dort im README.
- `website-factory/`: Factory, Prompts, Modelle, Provider, Budgetkontrolle, Orchestrierung und Tests. Setup/API-Schlüssel/Run-Befehle im README dieses Ordners.
- `website-factory/reports/reviews-10/`: sechs abgeschlossene Agent-Audits und Betriebsstatusprüfung aller zehn ursprünglich gefundenen Firmen.
- `chats/`: verfügbare sichtbare Nachrichten aus Polire-Agents und Polire-Website. Kein vollständiger ChatGPT-Export: „Geschäftsidee verbessern“ war über die App nicht abrufbar. Nachrichten können gekürzt sein. Historische Erfolgsmeldungen müssen gegen den aktuellen Code geprüft werden.
- `source-documents/`: vom Nutzer bereitgestellte ursprüngliche Anforderungen.
- `baseline-review-b0b5019/` und `video-review/`: vorhandene ältere Website-Referenzen.

## Aktueller Stand und Grenzen

Die Factory implementiert Scout, Audit, Qualifier, Strategist, Builder, QA und Sales mit menschlichen Freigaben. Es wird keine Cold-Mail automatisch versendet. Angebote: Website-Verbesserung und Neubau, alle Branchen, ab CHF 1'000 ohne obere Grenze.

Am 13.09.2026 bestanden Factory-Build, Lint und 115 Tests in 12 Dateien. Das ist kein Nachweis eines erfolgreichen vollständigen Live-Demo-Laufs: Der frühere POLIRE-Test stoppte an der Strategist-Validierung. Der Zehnerlauf ergab bislang sechs validierte Audit-Ergebnisse; mehrere Scout-Ausgaben konnten nicht vollständig belegt werden. Deshalb sind diese Audits keine vollständigen Business-Value-Qualifizierungen.

Bei Bauert und Garage Brunner scheiterte die Browser-Erfassung; dafür wird kein Audit-Score erfunden. Kreuzgarage Lanz wird wegen Pensionierungs-/Schliessungssignalen und Stefan Kyburz AG wegen Liquidationssignalen ausgeschlossen. Zwei Ersatz-Leads sowie die beiden fehlenden Audits sind noch offen. Die Browser-Erfassung toleriert jetzt dauernde Hintergrundanfragen; Lighthouse-Abstürze sind vom Hauptprozess isoliert. Die fehlenden Firmen-Audits wurden noch nicht kostenpflichtig erneut ausgeführt.

Bisheriger Zehnerlauf: 18 abgerechnete Aufrufe, USD 0.275238 laut lokalem Usage-Ledger; keine offenen Reservierungen zum Exportzeitpunkt. Autorisiertes Gesamtlimit: USD 5. Der separate frühere POLIRE-Test hat einen eigenen Budgetbereich. Beim ersten Review-Export war noch keine Demo freigegeben; danach wurde Anton Helscher AG ausdrücklich für die unten verlinkte lokale Demo ausgewählt.

## Lokale Daten

Die Factory nutzt standardmässig die lokale ChatGPT-Anmeldung über Codex OAuth. Ori meldet sich auf seinem Rechner mit `pnpm login` an; Anmeldedaten werden nicht übertragen. Der optionale Brave-Suchschlüssel gehört nur lokal in `website-factory/.env`. `.env`, Zugangsdaten, interne Überlegungen, rohe Tool-Protokolle, installierte Pakete, Build-Caches und lokale SQLite-Laufzeitdaten gehören nicht ins Git-Archiv. Der bestehende lokale Datenbestand bleibt erhalten. Ein frischer Checkout enthält keine bereits verbrauchten Budgetkonten: Live-Läufe erst mit bewusst gesetztem neuem Betreiberbudget oder wiederhergestellter lokaler Datenbank starten.

Das Archiv ist eine Momentaufnahme; es ändert weder die bisherigen Website-Remotes noch den Vercel-Deploy.

## Erste echte Firmen-Demo

[Anton Helscher AG](demos/anton-helscher/README.md): lokale responsive Design-Demo auf Basis realer Firmenquellen und des gespeicherten Audits. Direkt im Entwicklungs-Chat erstellt; kein vollständiger autonomer Factory-Lauf. Keine zusätzlichen API-Kosten. Die Adresskritik des ursprünglichen Reviews wurde nach erweitertem Quellenabgleich zurückgenommen.

## Ergänzung vom 18.09.2026

Ausführbare Setup-, Prüf- und Workflow-Skripte, eine begrenzte Recherche-Werkzeugschleife, persistente Stapelläufe, Review-Berichte und Fortsetzungen sind implementiert. Betriebsnachweise werden vor einer Live-Demo verlangt und bei Ablauf erneut geprüft. Build, Lint und 149 Tests bestehen. Ein kompletter Fixture-Lauf durchlief alle sieben Agent-Stufen und 22 echte Browserprüfungen. Keine neuen API-Kosten; automatisierte Live-Suche braucht noch einen lokalen Brave-Key und einen bestätigten Tarif. Details unter website-factory/spec/completion-validation.md.

## OAuth-Umstellung vom 21.09.2026

Alle Modellstufen verwenden jetzt standardmässig die verwaltete ChatGPT-Anmeldung über Codex. Kein automatischer Rückfall auf API-Schlüssel. Persistente Aufrufgrenzen und die Demo-Freigabe bleiben erhalten; OAuth-Kosten werden nicht als API-Dollarbeträge erfunden. Build, Lint und 174 Tests bestehen. Ein kleiner echter OAuth-Verbindungstest mit Luna war erfolgreich; ein vollständiger Firmenlauf über OAuth steht noch aus. Einrichtung und Grenzen: website-factory/README.md; Verifikation: website-factory/spec/oauth-migration.md.
