# Verifikation vom 18.09.2026

- Build und Lint: erfolgreich.
- Tests: 149 bestanden, 17 Dateien.
- CLI-End-to-End-Test mit Fixture-Daten: alle sieben Agent-Stufen, echter Renderer und 22 echte Browserprüfungen; kein Versand. Lauf `325deeea-0f33-4785-af74-51c5a84283ca`, lokale Daten unter `data/completion-fixture-2026-09-18/` (nicht versioniert).
- Kostenfreier Live-Crawl von POLIRE: Desktop- und Handy-Screenshot erzeugt; fehlender Lighthouse-Wert bleibt ausdrücklich unbekannt. Lighthouse läuft in einem getrennten Prozess.
- Lokale Vorprüfung: Node und Browser vorhanden, OpenAI-Key vorhanden, Brave-Key fehlt. Schlüsselwerte wurden nicht ausgegeben.
- Zusätzliche kostenpflichtige API-Aufrufe für diese Umsetzung: keine.
- Neue Recherche-, Retry-, Cache-, Budget- und Freigabelogik durch automatisierte Regressionen geprüft. Unabhängige Codeprüfung führte zu zusätzlichen Absicherungen gegen fehlende Gesamtbudgets, veraltete Betriebsnachweise und veränderte Rechercheeingaben.

## Verbleibende Live-Voraussetzungen

Automatische Suche benötigt einen lokalen Brave-Key und einen bestätigten Suchpreis. Ein neuer bezahlter Such-/Demo-Lauf benötigt ein passendes Betreiberbudget. Modellverfügbarkeit wird mit dem budgetierten `doctor` geprüft. Die bisherigen Live-Review-Probleme wurden nicht durch neue kostenpflichtige Läufe erneut getestet; der Fixture-Erfolg ist kein Nachweis eines vollständig erfolgreichen Live-Factory-Laufs.

Die Firmenaktivität muss vor einer Live-Demo mit konkreter Quelle bestätigt werden. Website-Erreichbarkeit oder ein Modell-Confidence-Wert ersetzen diese Prüfung nicht. Der frühere manuelle Anton-Entwurf bleibt ein separates Ergebnis.
