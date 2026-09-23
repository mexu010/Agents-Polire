# Separater Auftrag · Coiffeur Lanz visuell überarbeiten

Dieser Auftrag betrifft die eigenständige Anwendung unter `clients/coiffeur-lanz/`, nicht den Factory-Renderer. Grundlage ist die technische Übergabe vom 22.09.2026 und der vom Nutzer gezeigte Desktopausschnitt. Der lokale Anwendungscode wurde in diesem Chat nicht geöffnet.

## Bestand zuerst sichern und verstehen

Prüfe den aktuellen Quellbaum, Git-Status, `README.md`, `SOURCES.md`, die Konfiguration, `render.mjs`, Inhaltsdateien und öffentliche Styles/Assets. Prüfe welche Teile reale, freigegebene Inhalte und welche Symbolik sind. Lasse bestehende uncommittete Änderungen stehen.

Die Übergabe beschreibt Inhaltseditor, Journal, lokale Anfragen, Bild-Upload, Statistiken, Sicherungen und weitere Funktionen. Diese werden durch den Designauftrag nicht ersetzt. Kein Wechsel zu Next.js, kein neues CMS, keine pauschale Migration in den Factory-SiteSpec-Vertrag.

## Diagnose am tatsächlichen Ausschnitt prüfen

Der gezeigte Ausschnitt wirkt auf die erste gestalterische Betrachtung sehr allgemein: gross gesetzte, allgemeine Überschrift, Werkzeugstillleben und bisher wenig sichtbare Identität des konkreten Salons. Das ist ein subjektiver Ausgangsbefund, kein Beweis für Fehler im gesamten Produkt oder dessen Code.

Dunkle Flächen und grosse Schrift sind nicht pauschal falsch. Prüfe die tatsächliche Komposition, Textqualität und Bildauswahl. Aus dem teilweise angeschnittenen Browserausschnitt nicht ableiten, dass eine Aktion im ursprünglichen ersten Bildschirm grundsätzlich fehlen muss; dafür einen neuen kontrollierten Screenshot erstellen.

## Drei kleine echte Richtungen vor dem Umbau

Erstelle isolierte Vorschauen mit derselben bestätigten Informationsbasis, identischem Pflichtinhalt und vergleichbarer Ausarbeitung. Keine erfundenen Salonfotos, Teammitglieder, Leistungen oder Bewertungen. Bestehende Symbolbilder behalten ihre erkennbare Einordnung.

**Persönliches Atelier:** persönliche Identität und verständlicher Besuchs-/Kontaktweg. Ein Porträt ist nur eine Option, wenn ein echtes freigegebenes Porträt vorhanden ist. Sonst eine bewusst typografische Identitätsfläche und reale Informationen.

**Redaktionelles Haarstudio:** magazinartige Informationshierarchie und wechselnder, kontrollierter Abschnittsrhythmus. Arbeitsbilder nur aus freigegebenem Material. Ohne diesen Bestand nicht so tun, als existiere ein fotografisches Portfolio.

**Grafische Salonkarte:** typografisch prägnanter Einstieg, klare bestätigte Leistungs-/Kontaktinformationen und kompakterer Rhythmus. Besonders als fotoarme Alternative erproben, nicht einfach den dunklen Hintergrund durch Beige ersetzen.

Diese Richtungen sind Hypothesen zur Erprobung, keine begründete finale Stilwahl. Der Mensch sieht Desktop- und Mobilvorschauen und wählt eine Richtung. Erst danach den vollständigen visuellen Umbau durchführen.

## Unverändert lassen, sofern nicht ausdrücklich beauftragt

Inhaltliche Fakten, Kontakt-/Anfragelogik, Persistenz, Sicherheitsregeln, Editorfunktionen, Journal, Kennzeichnungen, Export-/Backupfunktionen und Review-/noindex-Status erhalten. Änderungen an vorhandenen Layouts dürfen die Verwaltungsoberfläche und beide vorhandenen Farbschemata nicht unbeabsichtigt beschädigen.

Der Review-Modus von Lanz speichert laut Übergabe Formularanfragen lokal; es erfolgt kein Versand an den Salon. Das ist nicht identisch mit der Factory-Demo, in der Aktionen deaktiviert sind. Tests brauchen deshalb den jeweils richtigen Modus. Keine echten Personen kontaktieren und keinen Produktivbetrieb behaupten.

## Prüfung und Abschluss

Verwende die vorhandenen Lanz-Tests und die getrennten öffentlichen/Admin-Browserprüfungen. Teste aktuelle Renderansichten, Navigation und relevante Formularzustände in einer isolierten, dafür freigegebenen Testkonfiguration. Lege keine privaten lokalen Daten oder Zugangsdaten offen.

Dokumentiere die visuelle Auswahl, tatsächlich angepasste Dateien, aktuelle Screenshots, funktionale Regressionstests und verbleibende Inhalts-/Asset-Fragen. Eine visuelle Fertigstellung ist keine Domain-, Hosting-, Datenschutz- oder Betriebsfreigabe.
