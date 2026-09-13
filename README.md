# POLIRE Projektarchiv

Stand: 13. September 2026. Dieses Archiv enthält den Website-Quellcode, die Website Factory mit sieben Agent-Rollen, Spezifikationen, Tests, verfügbare sichtbare Projekt-Chats und Review-Ergebnisse.

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

Bei Bauert und Garage Brunner scheiterte die Browser-Erfassung; dafür wird kein Audit-Score erfunden. Kreuzgarage Lanz wird wegen Pensionierungs-/Schliessungssignalen und Stefan Kyburz AG wegen Liquidationssignalen ausgeschlossen. Zwei Ersatz-Leads sowie die beiden fehlenden Audits sind noch offen. Die Browser-/Lighthouse-Abstürze sind noch nicht behoben.

Bisheriger Zehnerlauf: 18 abgerechnete Aufrufe, USD 0.275238 laut lokalem Usage-Ledger; keine offenen Reservierungen zum Exportzeitpunkt. Autorisiertes Gesamtlimit: USD 5. Der separate frühere POLIRE-Test hat einen eigenen Budgetbereich. Keine Demos für diese Leads freigegeben.

## Lokale Daten

API-Schlüssel nur lokal in `website-factory/.env` eintragen. `.env`, Zugangsdaten, interne Überlegungen, rohe Tool-Protokolle, installierte Pakete, Build-Caches und lokale SQLite-Laufzeitdaten gehören nicht ins Git-Archiv. Der bestehende lokale Datenbestand bleibt erhalten. Ein frischer Checkout enthält keine bereits verbrauchten Budgetkonten: Live-Läufe erst mit bewusst gesetztem neuem Betreiberbudget oder wiederhergestellter lokaler Datenbank starten.

Das Archiv ist eine Momentaufnahme; es ändert weder die bisherigen Website-Remotes noch den Vercel-Deploy.
