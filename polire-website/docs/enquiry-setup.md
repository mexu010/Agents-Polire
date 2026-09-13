# Projektanfrage: Einrichtung und Freigabe

Stand 11. September 2026: Formular und Versandroute sind implementiert. Der Betreiber hat seine private Adresse für Tests freigegeben und die FormSubmit-Aktivierung bestätigt. Ein direkter Versandtest wurde vom Anbieter angenommen. Der Empfänger wird ausschliesslich serverseitig in Vercel für Preview konfiguriert; die private Adresse gehört nicht in dieses Repository. Die folgenden Einrichtungsschritte dokumentieren weiterhin die spätere Freigabe mit einem Geschäfts-Postfach.

## Ablauf

Der Kontaktbutton öffnet ein Dialogfenster mit Projektart, Wünschen, freiwilliger bestehender Website, bis zu fünf Beispiel-Websites, Erläuterung der Beispiele, Budget, Start, Name, Firma und E-Mail. Nur Name, E-Mail, Projektart und Wünsche sind Pflichtfelder. DE und EN werden unterstützt. Entwürfe bleiben beim Schliessen innerhalb der geöffneten Seite erhalten, aber nicht nach einem Neuladen.

`POST /api/enquiry` prüft Herkunft, Grösse, Eingaben und Honeypot. Nur festgelegte Felder gehen an den Versanddienst. Die Empfängeradresse ist nicht frei durch Besucher wählbar. Eine positive Meldung setzt eine positive Antwort des Dienstes voraus; unklare Netzwerkfehler behaupten weder Zustellung noch einen sicheren Fehlschlag.

## Noch nötig für den echten Versand

1. Ein funktionierendes Empfängerpostfach erstellen und die Adresse mitteilen. `hello@polire.ch` ist derzeit nur die bestehende Website-Kontaktangabe, kein bestätigtes Postfach.
2. Den vorgesehenen Formularversand über FormSubmit aktivieren: einmal eine klar als Einrichtungstest bezeichnete Anfrage mit der tatsächlichen Empfängeradresse an FormSubmit schicken. Der Betreiber bestätigt den Aktivierungslink in seinem Postfach. Keine fiktive Empfängeradresse verwenden.
3. Die bei der Aktivierung erhaltene zufällige Formular-ID oder die bestätigte Empfängeradresse als `CONTACT_FORM_ID` in den Vercel-Umgebungsvariablen des Projekts `polireagency` speichern. Der Wert bleibt serverseitig; keine `NEXT_PUBLIC_`-Variable verwenden. Keinen vollständigen URL eintragen.
4. `CONTACT_FORM_ACTIVE=true` zunächst nur für Preview setzen, neu deployen und mit einem gekennzeichneten Test prüfen, ob alle Felder im Postfach ankommen und Antworten an die Absenderadresse gehen. Das Aktivierungsflag erst nach erfolgreicher Postfachbestätigung setzen; ohne Flag antwortet die Route mit 503.
5. Vor öffentlicher Freigabe einen Vercel-Firewall-Rate-Limit für `/api/enquiry` einrichten, soweit der vorhandene Tarif das erlaubt. Der eingebaute Schutz begrenzt fünf Versuche pro zehn Minuten anhand der von Vercel gesetzten IP-Kopfzeile, gilt jedoch nur innerhalb einer Funktionsinstanz und ersetzt keine globale Begrenzung. Honeypot und Eingabeprüfungen ergänzen ihn.
6. Nach bestätigtem Empfang die beiden Variablen für Production setzen, Branch nach `main` übernehmen und den erfolgreichen Vercel-Deploy prüfen. Die vorhandenen Betreiber-/Adressplatzhalter auf den Legal-Seiten bleiben separat zu vervollständigen.

Die FormSubmit-Anbindung ist gegen simulierte Dienstantworten geprüft. Die Aktivierung wurde vom Betreiber bestätigt und ein direkter Versandtest vom Dienst angenommen. Der tatsächliche Eingang im Postfach muss vom Betreiber bestätigt werden. Es wurden keine neuen Konten, Abos oder kostenpflichtigen Dienste eingerichtet.

## Datenverarbeitung

Vercel-Serveranfragen wurden beim Live-Test von FormSubmit mit HTTP 403 abgewiesen, während derselbe Versand vom lokalen Rechner erfolgreich war. Bei diesem konkreten Fehler unterstützt das Formular den von FormSubmit dokumentierten direkten AJAX-Versand aus dem Browser. Die Serverprüfung bleibt vorgeschaltet. Dieser Weg wird ausschliesslich mit anonymer Formular-ID erlaubt, nie mit einer privaten Empfängeradresse. Erst die positive Antwort von FormSubmit zeigt die Erfolgsansicht. Dabei werden auch technisch notwendige Browser-Verbindungsdaten an FormSubmit übertragen.

Die Anfrage läuft über die eigene Vercel-Route zu FormSubmit und von dort zum Postfach. FormSubmit dokumentiert eine Aufbewahrung der Formulareinsendungen im Archiv für 30 Tage. Die Datenschutzerklärung nennt den Formularversand. Keine automatische Antwortmail an Besucher ist eingerichtet. Sie sehen die Bestätigung direkt auf der Website.

Quellen: https://formsubmit.co/ und https://formsubmit.co/documentation sowie https://formsubmit.co/ajax-documentation

## Prüfung

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test:server
pnpm test
```

Browser-Tests simulieren externe Versandantworten. Server-Tests prüfen Validierung, feste Nutzlast, deaktivierten Versand, Dienstfehler und Netzwerkfehler ohne echte E-Mails zu senden.

Zusätzlich behoben: überflüssiger Punkt vor `@media` in `app/transformation.css`, der bereits auf dem vorherigen `main`-Stand den Build verhinderte.
