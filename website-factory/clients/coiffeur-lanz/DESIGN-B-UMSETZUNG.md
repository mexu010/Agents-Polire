# Lanz: gewählte Richtung B umgesetzt

Auf Grundlage der ausdrücklichen Auswahl **B** nach den drei Mini-Entwürfen. Lokaler Stand: 22. September 2026. Keine Veröffentlichung oder Kontaktaufnahme. Die bestehende native Node-/SQLite-Anwendung und ihre URLs bleiben erhalten.

## Ansehen

[Vollständige lokale Website](http://127.0.0.1:4332/), [Salon](http://127.0.0.1:4332/salon/), [Besuch](http://127.0.0.1:4332/besuch/), [Kontakt](http://127.0.0.1:4332/kontakt/), [Journal](http://127.0.0.1:4332/journal/).

Der Server läuft mit einer frischen isolierten Review-Datenbank. Er greift weder auf die Kunden-Datenbank noch auf `.env` zu. Zum erneuten Start:

```powershell
Set-Location 'C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory'
node clients/coiffeur-lanz/preview-review.mjs
```

Der Verwaltungszugang liegt ausschliesslich in der lokalen Datei, deren Pfad der Prozess ausgibt. Jeder Start erzeugt ein separates Testverzeichnis. Diese Variante ist zum Ansehen und Testen gedacht; der normale persistente Start über `cli.mjs start` bleibt bestehen. Bereits laufende normale Anwendungsprozesse müssen für geändertes Server-Rendering neu gestartet werden; vorhandene Inhalte bleiben erhalten. Browser gegebenenfalls vollständig neu laden, da lokale Assets bis zu einer Stunde gecacht werden.

## Tatsächlich geändert

| Datei | Änderung |
| --- | --- |
| `render.mjs` | Redaktionelle Startseite mit Titel über Bild-/Kontaktspalte, mobil Kontakt vor Bild; kompakte Besuchsinformationen. Salonseite mit umgekehrter Bildführung. Orts-/Personenangaben aus dem vorhandenen Inhaltsschema statt fest eingebauter Duplikate. Escaping, Routen, Metadaten, Formulartokens und Review-Schutz erhalten. |
| `public/assets/site.css` | Richtung B über Start, Salon, Besuch, Kontakt, Journal, Beitrag, Rechtliches und 404; Schriftmassstäbe, Linien, Bildformate, mobile Anordnung, Fokus, Formularzustände und dunkle Darstellung. Hochgeladene Bilder werden vollständig gezeigt; nur das vorhandene Symbolbild erhält den gewählten Ausschnitt. |
| `content.mjs` | Neuer Starttitel für neue Datenbestände. Kein Überschreiben bestehender Datenbankinhalte. |
| `admin.mjs` | Haupttitel als mehrzeiliges Eingabefeld, damit bewusst gesetzte Zeilenumbrüche beim Bearbeiten erhalten bleiben. |
| `public/assets/site.js` | Escape gibt den Fokus aus dem mobilen Menü an die Menüschaltfläche zurück. 404-Seiten senden keine ungültigen Statistik-Anfragen mehr. Normale Statistik- und Datenschutzregeln bleiben erhalten. |
| `tests/public.test.mjs` | Regressionen für bearbeitbare Identität/Texte, sichere Titelumbrüche, lokale Bilder, Textdarstellung ohne Bild und Statuskennzeichnung. |
| `check-admin.mjs` | Zusätzlich Speicherung und öffentliche Darstellung eines mehrzeiligen Titels geprüft. |
| `check-design-b.mjs` | Browserprüfung bei 320/390/768/1440 px, Screenshots, Fokus/Menü, Kontraste, Formularzustände, Journal, dunkle Darstellung und Betrieb ohne JavaScript. |
| `preview-review.mjs` | Start der echten Anwendung mit isolierten Testdaten und zufälligem lokalem Verwaltungszugang; keine neue Architektur. |
| `README.md`, diese Datei | Startanleitung, Abgrenzung und Nachweise. |

Die drei alten Mini-Entwürfe sind als Entscheidungsstand erhalten. Die vollständige Umsetzung verwendet echte Laufzeitinhalte aus dem bestehenden Store. Die bisherige Haupttitel-Bearbeitung bleibt deshalb wirksam. Bilder und Inhalte wurden weder nachgeneriert noch aus Referenzseiten übernommen.

## Vorher und nachher

Vergleichbarer Einstieg: Desktop **1440 × 1000**, Mobil **390 × 844**. Vorher-Aufnahmen aus der vorangehenden tatsächlichen Bestandsprüfung; Nachher-Aufnahmen vom aktuellen Renderer. Beide mit dem jeweils versionierten Inhaltsstand und isolierten Daten, ohne möglicherweise abweichende gespeicherte Kundenbearbeitungen.

| Ansicht | Vorher | Nachher |
| --- | --- | --- |
| Desktop-Einstieg | [Bild](../../work/lanz-design-2026-09-22/evidence/before/desktop-entry.png) | [Bild](../../work/lanz-direction-b/after/home-1440-entry.png) |
| Mobil-Einstieg | [Bild](../../work/lanz-design-2026-09-22/evidence/before/mobile-entry.png) | [Bild](../../work/lanz-direction-b/after/home-390-entry.png) |

Weitere aktuelle vollständige Seiten:

| Seite | Desktop | Mobil |
| --- | --- | --- |
| Start | [Bild](../../work/lanz-direction-b/after/home-1440.png) | [Bild](../../work/lanz-direction-b/after/home-390.png) |
| Salon | [Bild](../../work/lanz-direction-b/after/salon-1440.png) | [Bild](../../work/lanz-direction-b/after/salon-390.png) |
| Besuch | [Bild](../../work/lanz-direction-b/after/visit-1440.png) | [Bild](../../work/lanz-direction-b/after/visit-390.png) |
| Kontakt | [Bild](../../work/lanz-direction-b/after/contact-1440.png) | [Bild](../../work/lanz-direction-b/after/contact-390.png) |
| Journal ohne Beiträge | [Bild](../../work/lanz-direction-b/after/journal-empty-1440.png) | [Bild](../../work/lanz-direction-b/after/journal-empty-390.png) |
| Beitrag, ausschliesslich Testdaten | [Bild](../../work/lanz-direction-b/after/article-1440.png) | [Bild](../../work/lanz-direction-b/after/article-390.png) |
| Datenschutz | [Bild](../../work/lanz-direction-b/after/privacy-1440.png) | [Bild](../../work/lanz-direction-b/after/privacy-390.png) |

Zusätzlich aufgenommen und betrachtet: mobiles Menü, Formularfehler, Verbindungsfehler, erfolgreiche lokale Formularspeicherung, 404, Impressum, dunkle Darstellung, Navigation und Kontakthinweis ohne JavaScript. Die Bilder liegen im ignorierten Arbeitsordner, nicht im Kundendatenbestand. Die Journal-Testartikel und der Testhinweis werden nur in einer nach dem Test entfernten Testdatenbank angelegt; sie erscheinen nicht im gestarteten Kunden-Preview.

## Tatsächlich ausgeführte Prüfungen

- `node --test clients/coiffeur-lanz/tests/*.test.mjs`: **21 bestanden**, keine Fehler. Die zwei zusätzlichen Renderer-Regressionen wurden zuerst im alten Stand scheitern gesehen und bestehen mit der Umsetzung.
- `node clients/coiffeur-lanz/cli.mjs check`: Inhalte, Seiten und lokale Assets bestanden. Diese Anwendung benötigt keinen Build-Schritt.
- `node clients/coiffeur-lanz/check-browser.mjs`: sieben öffentliche Seiten bei **375/768/1440 px**, Menü, Skripte, Bilder, Formularvalidierung, zwei lokale Anfragen und persistierendes Testpostfach bestanden.
- `node clients/coiffeur-lanz/check-admin.mjs`: Login, mehrzeilige Titel-/Rechtsangaben, Speicherung, Upload, Journal, lokale Anfragebearbeitung, Sicherung, Logout und mobile Navigation bestanden.
- `node clients/coiffeur-lanz/check-design-b.mjs`: **32 Kombinationen aus Seite und Breite** bei **320/390/768/1440 px** bestanden. Keine horizontalen Überläufe oder defekten Bilder. Hauptaktion im ersten Bildschirm; CTA- und Fliesstextkontrast mindestens 4,5:1, auch in dunkler Darstellung. Skip-Link, Menüzustände, Tastaturfokus, Formularfehler/Verbindungsfehler/Erfolg, Journalzustände, noindex und Betrieb ohne JavaScript geprüft.
- Gezieltes ESLint für die geänderten JavaScript-Dateien: bestanden.
- Browserbilder tatsächlich geöffnet und visuell ausgewertet. Abschliessend Überschriftenumbrüche und Fussbereich kurzer Seiten korrigiert und bestätigt. Die Einstiegsscreenshots wurden mit expliziter Scrollposition 0 erneut aufgenommen, damit der Vorher-/Nachher-Vergleich zuverlässig ist.

Protokolle: `work/lanz-direction-b-tests.log`, `work/lanz-direction-b-browser.log`, `work/lanz-direction-b-public.log`, `work/lanz-direction-b-admin.log`, `work/lanz-direction-b/after/checks.json`.

Der statische Design-Detektor meldet zwei seitliche Akzentlinien. Sie bleiben bewusst ausschliesslich an tatsächlichen Mitteilungen, Review- und Rechtshinweisen erhalten, nicht als dekorative Kartenabfolge. Der Detektor ist keine visuelle Designabnahme.

## Gesicherter Stand und Grenzen

Vor den Änderungen wurde der betroffene Lanz-Quellstand separat nach `C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\_checkpoints\lanz-before-direction-b-20260922` kopiert und mit SHA256-Manifest gesichert. Der vorherige Factory-Zwischenstand ist weiterhin separat gesichert; **45 von 45 Factory-Dateien** stimmen unverändert mit dessen Manifest überein. Branch bleibt `codex/factory-implementation`. Kein Commit, Push oder Deployment.

Backend, Store, Authentifizierung, Mailadapter, Upload-Verarbeitung, Statistik-Endpunkt, Betriebsfunktionen und Freigaben wurden nicht verändert. Alle Tests mit Schreibzugriff nutzten eigene temporäre Datenbanken. Keine bestehenden Kundendaten oder Zugangsdaten wurden gelesen, überschrieben oder in die Dokumentation übernommen.

Offen bleiben freigegebene Salon-/Porträt-/Arbeitsfotos, bestätigte Leistungen/Preise und die bisherigen Voraussetzungen für den öffentlichen Betrieb gemäss README. Das vorhandene Bild bleibt ausdrücklich ein KI-Symbolbild. Kein Test auf realen Mobilgeräten, Safari/Firefox oder mit einem Screenreader; keine unabhängige Design- oder Kundenabnahme. Die eigentliche POLIRE-Agenturwebsite und die Factory wurden in diesem Auftrag nicht bearbeitet.
