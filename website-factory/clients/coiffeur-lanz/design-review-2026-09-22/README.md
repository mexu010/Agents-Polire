# Coiffeur Lanz: drei Mini-Entwürfe zur Auswahl

Stand: 22. September 2026. Erste Lieferung des separaten Lanz-Auftrags. Noch keine gewählte Richtung und kein Umbau der bestehenden Kundenanwendung.

## Ansehen

Der lokale Vorschau-Server wurde für die Übergabe auf **http://127.0.0.1:4340/** gestartet. Er bleibt erreichbar, solange dieser Prozess läuft. Es ist kein öffentlicher oder dauerhafter Online-Link.

| Richtung | Vorschau | Desktop, 1440 px | Mobil, 390 px |
| --- | --- | --- | --- |
| A – persönlich und einladend | [A öffnen](http://127.0.0.1:4340/a/) | [Desktopbild](http://127.0.0.1:4340/captures/a-1440.png) | [Mobilbild](http://127.0.0.1:4340/captures/a-390.png) |
| B – redaktionell und ausdrucksstark | [B öffnen](http://127.0.0.1:4340/b/) | [Desktopbild](http://127.0.0.1:4340/captures/b-1440.png) | [Mobilbild](http://127.0.0.1:4340/captures/b-390.png) |
| C – grafisch und fotoarm | [C öffnen](http://127.0.0.1:4340/c/) | [Desktopbild](http://127.0.0.1:4340/captures/c-1440.png) | [Mobilbild](http://127.0.0.1:4340/captures/c-390.png) |

Falls der Server beendet wurde, in PowerShell starten:

```powershell
Set-Location 'C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory'
node clients/coiffeur-lanz/design-review-2026-09-22/preview.mjs
```

Strg+C beendet ihn. Optional einen freien Port mit `--port 4341` angeben. Node 24 und die vorhandenen lokalen Assets genügen zum Rendern. Keine API-Schlüssel und keine Anmeldung nötig.

Die gespeicherten Bilder liegen in `work/lanz-design-2026-09-22/previews/`. Dieser Arbeitsordner ist nicht versioniert. Auf einem anderen Rechner müssen die Bilder für die Vergleichsübersicht zuerst erzeugt werden; die drei HTML-Entwürfe funktionieren auch vorher:

```powershell
node clients/coiffeur-lanz/design-review-2026-09-22/check-browser.mjs
```

Voraussetzung für diesen Check: installierte Projektabhängigkeiten mit Playwright sowie lokal installiertes Google Chrome. Kein automatischer Browserdownload.

## Unterschiede und offene Inhalte

- **A:** persönliche Begrüssung durch Name und Ort, ruhige Textspalte und eigene Salonkarte mit Original-Logo. Mobil wird die Karte zu einer kompakten Anordnung aus Logo, Adresse und Besuchslink. Ohne Symbolfoto vollständig; ein freigegebenes Porträt wäre später optional.
- **B:** eigener Text-Bild-Aufbau mit präzisem Bildausschnitt, seitlicher Kontaktspalte und dreiteiliger Besuchsübersicht. Mobil stehen Person, Aktion und Adresse vor dem Bild. Das vorhandene KI-Stillleben ist sichtbar als Symbolbild gekennzeichnet, kein Salonfoto oder Arbeitsbeleg.
- **C:** kräftige Namensgestaltung, farbiger Ortsbezug und eine gerahmte Öffnungszeiten-/Kontakttafel. Mobil erhält der Ort eine eigene vertikale Position; die Tafel wird zum durchgehenden Informationsblock. Bewusst ohne Foto.

Alle Richtungen verwenden dieselben bestätigten Businessdaten, das unveränderte Original-Logo und die lokal vorhandene Schrift Satoshi. Eine freigegebene Leistungsliste, Preise, reale Salon-/Porträt-/Arbeitsfotos sowie die endgültige Inhaber-/Assetfreigabe fehlen weiterhin. Deshalb gibt es einen Informationsabschnitt statt erfundener Angebote. Keine fremden Referenzbilder wurden als Kundenbilder übernommen.

[RESEARCH.md](RESEARCH.md) dokumentiert den vorhandenen Funktionsumfang, vier konkrete Ausgangsprobleme, die drei tatsächlich geöffneten Referenzen, betrachtete Browserbilder und die Grenzen der Datenbasis. [PLAN.md](PLAN.md) hält Abgrenzung und Zwischenstand fest.

## Implementierung und Schutz des Bestands

Neue Dateien ausschliesslich in diesem Unterordner:

- `views.mjs`: drei eigenständige Kompositionen und Vergleichsübersicht, HTML-Escaping, vorhandenes Inhaltsschema.
- `base.css`, `a.css`, `b.css`, `c.css`, `compare.css`: lokale Fonts, gemeinsame Grundregeln, unterschiedliche responsive Gestaltung.
- `preview.mjs`: ausschliesslich lesender HTTP-Server auf Loopback, genaue Datei-Freigabeliste, CSP und noindex; keine Datenbank und keine Umgebungsdatei.
- `check-browser.mjs`: reproduzierbare Browserprüfung und aktuelle Screenshot-Erzeugung.
- `README.md`, `RESEARCH.md`, `PLAN.md`: Anleitung, Nachweise und Abgrenzung.

Die Hauptaktion springt zum Kontaktabschnitt. Kontaktdaten werden im Entwurf angezeigt; es gibt keine Formularübermittlung, Telefon- oder E-Mail-Aktion. Die vollständigen öffentlichen Seiten, der Editor und das Backend bleiben in der vorhandenen Anwendung unverändert.

Die Entwürfe lesen `initialContent` aus `../content.mjs`. Neue Starttitel entstehen ausschliesslich als Entwurfsdaten in `home.headline`; die echte Datenbank bleibt unberührt. Aktuelle Bearbeitungen in einer Kundendatenbank sind deshalb **nicht** Bestandteil dieser Vorschauen. Die spätere Umsetzung muss die gewählte Gestaltung mit den gespeicherten Editorinhalten verbinden.

Der Factory-Zwischenstand wurde vor Beginn separat gesichert. SHA256-Abgleich: **45 von 45 Dateien unverändert**. Branch `codex/factory-implementation`, Basis `fcc070ff2db1119ff36aae09af0bde11b3d3aea0`. Keine Änderungen an vorhandenen getrackten Lanz-Dateien; nur dieser neue Unterordner. Kein Commit, Push, Deployment, zusätzlicher Live-Modelllauf oder neuer kostenpflichtiger Dienst.

## Tatsächlich geprüft

- Bestehende Lanz-Tests: **19 bestanden**, keine Fehler. Separater temporärer Datenbestand.
- Bestehender Inhalts-/Seiten-/Assetcheck: bestanden; die native Anwendung benötigt keinen Build.
- Bestehender öffentlicher Browsercheck: sieben Seiten bei **375, 768 und 1440 px**, mobiles Menü, Formularfehler, zwei lokale Anfragen und persistierendes Testpostfach bestanden. Kein E-Mail-Versand.
- Bestehender Admin-Browsercheck: Login, bearbeitbare Inhalte/Rechtsangaben, Speicherung, Bild-Upload, Journal, Anfragebearbeitung, Sicherung, Logout und mobile Navigation bestanden. Ausschliesslich isolierte Testdaten.
- Neue Vorschauen: **12 Ansichten** (A/B/C bei **320, 390, 768 und 1440 px**) sowie Vergleich bei 390/1440 px. Kein horizontaler Überlauf, keine defekten Bilder oder Browser-Skriptfehler. Hauptaktion jeweils im ersten Bildschirm, mindestens 44 px hoch und Kontrast mindestens 4,5:1. Fokus und interner Kontaktlink geprüft; noindex, dynamische Daten/HTML-Escaping und lesender Server geprüft.
- Desktop-/Mobilbilder aller drei Richtungen und beide Vergleichsbilder tatsächlich geöffnet und visuell betrachtet. Nach dem ersten Durchgang wurden doppelte Kontakttexte, zusammenlaufende mobile Wörter, der Desktop-Bildausschnitt und der beim Aufnehmen stehengebliebene Hoverzustand korrigiert. Der abschliessende Browsercheck lief erneut erfolgreich.
- Syntaxprüfung der drei neuen JavaScript-Module und gezielte ESLint-Prüfung. Die Browser-Globals sind lokal im Testmodul deklariert; keine Änderung der zentralen Lint-Konfiguration.

Prüfprotokolle: `work/lanz-design-existing-tests.log`, `work/lanz-design-public-check.log`, `work/lanz-design-admin-check.log`, `work/lanz-design-preview-checks.log` und `work/lanz-design-2026-09-22/previews/checks.json`. Bestands-/Referenzbilder liegen unter `work/lanz-design-2026-09-22/evidence/`.

Visuelle Prüfung durch denselben Arbeitslauf, keine unabhängige Designabnahme. Nicht geprüft: Safari/Firefox, reale Mobilgeräte, Screenreader und endgültiger Kundeninhalt. Die automatische Prüfung ersetzt die menschliche Richtungswahl nicht.

## Nächster Schritt: Auswahl

**A, B oder C wählen**, gerne mit konkreten Änderungswünschen. Erst danach wird eine Richtung über die bestehenden öffentlichen Seiten, Zustände und editierbaren Inhalte umgesetzt. Bis dahin bleiben die drei Mini-Entwürfe isoliert. Die vollständige Integration ist bewusst noch offen.
