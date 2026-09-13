# Anton Helscher AG — POLIRE Design-Demo

Vom Betreiber am 13.09.2026 im Chat freigegeben: eine schwache Website eines weiterhin tätigen Betriebs auswählen und eine Demo erstellen.

## Öffnen

Node.js 24 oder neuer, keine Installation und kein API-Key erforderlich:

```powershell
node serve.mjs
```

Danach http://127.0.0.1:4318 öffnen. Alternativ lässt sich `index.html` direkt im Browser öffnen. Der Server bindet ausschliesslich an localhost.

## Umfang

Responsive Startseite, eigens gezeichnete SVG-Hausillustration, Leistungsbereiche, Unternehmen, eindeutig bezeichnete Standorte, mobiles Menü und lokal testbares Anfrageformular. Das Formular versendet und persistiert keine Daten; es gibt keine externen Schriftarten, Tracking- oder Bildanfragen. Illustrationen und Wortmarke sind Designvorschläge, keine übernommenen offiziellen Markenassets oder Referenzprojekte.

Diese Demo wurde direkt im Entwicklungs-Chat auf Grundlage des gespeicherten Audit-Agent-Ergebnisses und erneut geprüfter Quellen umgesetzt. Sie ist kein erfolgreicher autonomer Factory-End-to-End-Lauf und keine Fixture, die als Live-Ergebnis ausgegeben wird. Keine zusätzlichen kostenpflichtigen Modellaufrufe. Der Produktions-Factory-Lauf bleibt unverändert.

## Quellen und Korrektur

- [Originalwebsite und Leistungen](https://www.antonhelscherag.ch/)
- [Unternehmen](https://www.antonhelscherag.ch/de/firma/index.html)
- [Kontakt und Standorte](https://www.antonhelscherag.ch/de/beratung/index.html)
- [Baupublikation Januar 2026](https://azeiger.ch/wp-content/uploads/2026/01/Azeiger_02_2026.pdf): Anton Helscher AG als Projektverantwortlicher, Einsprachefrist 28.01.2026. Ein konkreter jüngerer Tätigkeitsbeleg, keine Garantie künftiger Auftragsannahme.

Der frühere Agent-Audit beanstandete unterschiedliche Adressen. Beim erweiterten Quellenabgleich zeigte sich: Friedhofstrasse 34 ist als Firmensitz ausgewiesen, Heinibühlstrasse 33 als Werkstatt/Administration. Der Widerspruchsvorwurf wird zurückgenommen. Der historische Score 54.63/100 wird daher nicht als korrigierter Gesamtwert verwendet. Die beobachtete nicht responsive mobile Darstellung begründet weiterhin die Auswahl.

## Prüfung

`verify.mjs` nutzt Playwright aus einer installierten Factory:

```powershell
$env:FACTORY_DIR='PFAD_ZUR_INSTALLIERTEN_WEBSITE_FACTORY'
node verify.mjs
```

Bestanden: 375, 768 und 1440 Pixel Breite ohne horizontalen Überlauf; Kontaktfenster, Formularvalidierung und Demo-Rückmeldung; Escape schliesst den Dialog; mobiles Menü öffnet und schliesst; keine JavaScript-Laufzeitfehler. Desktop- und Handy-Screenshots wurden visuell geprüft.

Die originale POLIRE-Website und die echte Firmenwebsite wurden nicht verändert. Die Demo ist nicht öffentlich gehostet; Veröffentlichung oder Versand sind nicht Teil dieser Freigabe.
