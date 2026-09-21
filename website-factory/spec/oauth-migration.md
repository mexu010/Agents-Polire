# OAuth-Umstellung vom 21.09.2026

Auftrag: Die POLIRE-Agents sollen ChatGPT OAuth statt eines OpenAI-API-Keys verwenden.

## Umsetzung

- `chatgpt_oauth` ist der Standard und in beiden Live-Konfigurationen ausdrücklich gesetzt. Der frühere API-Adapter bleibt nur über `authentication: "api_key"` ausdrücklich anwählbar. Kein automatischer Rückfall.
- Der offizielle lokale Codex App Server übernimmt Anmeldung, Tokenverwaltung und Erneuerung. Die Factory liest keine Token-Datei. `pnpm login` und `pnpm login:status` verwenden die Codex CLI.
- Der Adapter verlangt ChatGPT-Anmeldung, OpenAI-Modellanbieter und passende Modellfähigkeiten. Die bisherige Modell- und Reasoning-Aufteilung bleibt bestehen.
- Die vorhandenen JSON-Verträge, Bildbindungen, Quellenprüfungen, Freigaben und Reparaturgrenzen werden weiterverwendet. Der App Server liefert strukturierte Antworten und gemeldete Token-Nutzung.
- SQLite reserviert logische Codex-Turns atomar pro Lauf, UTC-Tag und Gesamtbereich. Abgebrochene oder unklare Aufrufe bleiben gezählt. Neustarts erweitern Limits nicht. Unklare Ergebnisse blockieren automatische Wiederholung des betroffenen Schritts.
- OAuth-USD-Kosten sind unbekannt (`null`). Cache-Reads und Reasoning werden gespeichert; unbekannte Cache-Writes bleiben unbekannt. Reasoning wird nicht nochmals zu Output-Tokens addiert. Die Evaluation trennt API- und OAuth-Ergebnisse durch ihren Cache-Schlüssel.
- Das Ausgabetokenlimit wird nach dem Turn geprüft. Das Eingabelimit betrifft die Factory-Nutzlast; Codex ergänzt eigenen Kontext. Lokale Zähler begrenzen logische Turns, keine garantierte Anzahl interner Requests oder tatsächliche Kontogebühren.
- Die optionale Brave-Websuche bleibt ein eigenständiger Dienst mit eigenem Schlüssel und eigener Geldbudgetkontrolle.

## Verifikation

Build und Lint erfolgreich; 174 Tests in 20 Dateien bestanden. Die unabhängige Nachprüfung bestätigte die Korrekturen für Anbieterbindung, geerbte Hooks und Cache-Trennung.

Der rein lesende Doctor hat die bestehende ChatGPT-Anmeldung und die konfigurierten Modelle erkannt. Ein einziger auf einen Aufruf begrenzter OAuth-Verbindungstest mit Luna hat die gültige Rechercheentscheidung `stop` zurückgegeben: 4’856 Input-, 36 Output-, 0 Reasoning- und insgesamt 4’892 Tokens. Keine Firmendaten, Suche, Demo oder Nachricht waren Teil dieses Tests. Lokales Ergebnis: `data/oauth-verification-2026-09-21/` (nicht versioniert).

Automatisierte Tests decken unter anderem fehlende/falsche Anmeldung, Anbieter- und Modellabweichung, Werkzeuge/Hooks, Nachrichtenphasen, Übertragungsgrenzen, unklare Usage, Reparaturen, Kontingente und Cache-Trennung ab. Ein kompletter Firmenlauf mit allen sieben Modellen über OAuth ist damit noch nicht belegt.

Offizielle Referenzen: [Authentifizierung](https://learn.chatgpt.com/docs/auth), [App Server](https://learn.chatgpt.com/docs/app-server). Implementiert gegen die lokal vorhandene Codex CLI `0.154.0-alpha.6.2`; bei inkompatiblen Protokolländerungen stoppt der Adapter.
