# Coiffeur Lanz · Business 279 CHF

Vollständige, eigenständige Kundenwebsite mit sechs Inhaltsseitentypen (Start, Salon, Besuch, Kontakt, Journal, Beitrag), Impressum und Datenschutz. Servergerendert, mobil, lokale Schriftdateien, helle/dunkle Darstellung, geschützter Inhaltseditor, dauerhaftes Postfach, Bild-Upload, Journal, Besucherstatistik, Sicherungen und Monatsberichte. Kein zusätzlicher LLM-Aufruf und keine OpenAI-Schlüssel erforderlich.

## Lokal starten

Node.js ab 24.14.0, geprüft mit 24.19.0. Keine Installation von Laufzeitpaketen nötig. Im Ordner `clients/coiffeur-lanz`:

```powershell
node cli.mjs setup
node cli.mjs start
```

`setup` einmal ausführen. Es überschreibt keine vorhandene `.env`. Die Website läuft unter `http://127.0.0.1:4330/`, die Verwaltung unter `/verwaltung/`. Das zufällige Passwort steht ausschliesslich in `.local-access.txt`. `.env`, Zugangsdaten, Datenbank, Anfragen, Berichte und Backups sind von Git ausgeschlossen. Zugang nicht in Chats oder Commits kopieren.

Im Factory-Hauptordner alternativ `pnpm lanz`, nach der einmaligen Einrichtung. Ein Prozess pro Datenverzeichnis. Beenden mit Strg+C; bei erneutem Start bleiben Inhalte und Anfragen erhalten.

## Verwaltung

- **Inhalte:** Texte, Kontaktdaten, Öffnungszeiten, aktueller Hinweis, Titelbild und Betriebsangaben. Es gibt eine Revisionsprüfung gegen das Überschreiben gleichzeitiger Änderungen.
- **Journal:** Drei unveröffentlichte Themenentwürfe. Beiträge erst nach Kundenfreigabe veröffentlichen; keine erfundenen Nachrichten. Absatzumbrüche genügen, HTML wird als Text behandelt.
- **Anfragen:** Tatsächlicher Posteingang mit Status und Löschung. Im lokalen Testbetrieb wird keine E-Mail an den Salon gesendet. Eine Anfrage bestätigt keinen Termin.
- **Übersicht:** Gemessene Aufrufe, täglich geschätzte Besucher und Verweis-Domains. Keine erfundenen Zahlen. Do Not Track/GPC berücksichtigt, keine Tracking-Cookies. Täglich wechselnde IP-Ableitungen zählen ungefähr und werden am Folgetag entfernt; gemeinsame Internetanschlüsse zählen zusammen. Es werden keine Roh-IP-Adressen oder vollständigen Verweis-URLs in der Statistik gespeichert. Aggregierte Tagesdaten: 400 Tage.
- **Betrieb:** Sicherung auslösen, Inhalte/Monatsberichte exportieren, Startprüfungen, Fehler bei Sicherung oder E-Mail-Zustellung sehen.

## Vor dem echten Start

Der Stand ist lokal lauffähig und im Modus `review`, mit Suchmaschinen-Sperre und klarer Testmeldung im Formular. Die reale Kundendomain wurde nicht verändert, der Salon nicht kontaktiert. Vor `APP_STAGE=production` müssen folgende Schritte tatsächlich erledigt sein:

1. Texte, veröffentlichte Leistungen/Preise, Öffnungszeiten und Bilder durch Vreni Lanz freigeben. Originale Salonbilder und Preislisten wurden nicht erfunden. Das vorhandene Stillleben ist ein beschriftetes KI-Symbolbild.
2. Website auf einem Node-Host mit dauerhaftem Datenträger bereitstellen, eigene Domain und HTTPS verbinden. `PUBLIC_ORIGIN` exakt ohne abschliessenden Schrägstrich setzen. Nur einen Serverprozess pro Datenbank verwenden. Diese Anwendung ist **nicht** für flüchtigen Vercel-Function-Speicher geeignet; die bestehende Demo-Galerie bleibt unabhängig auf Vercel.
3. Betreiber-, Hosting- und Datenschutzangaben im Editor ergänzen und rechtlich prüfen. `LEGAL_APPROVED=true` und `OWNER_APPROVED=true` bestätigen die tatsächlich erfolgte Freigabe. Der Datenschutztext enthält die realen Speicherfristen und benötigt die konkreten Angaben des gewählten Hosters.
4. Optionalen Resend-Mailadapter einrichten: verifizierte eigene Absenderdomain, `RESEND_API_KEY`, `MAIL_FROM` und mit dem Salon vereinbartes `MAIL_TO` nur lokal/als Host-Secrets. Zustellung mit Zustimmung des Empfängers testen; erst danach `MAIL_DELIVERY_TESTED=true`. Im Review-Modus wird der Adapter nie aufgerufen. Für technische Details siehe [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).
5. Extern `/healthz` alle 60 Sekunden überwachen und Warnungen an den vereinbarten POLIRE-Kontakt anschliessen; erst danach `EXTERNAL_MONITOR_READY=true`. Das beiliegende `monitor.mjs` schreibt lokal Zustandswechsel, verschickt aber keine Benachrichtigungen. `node monitor.mjs --once` eignet sich für einen externen Scheduler. Prozessinterne Prüfungen können den Ausfall ihres eigenen Hosts nicht melden.
6. Das Datenverzeichnis zusätzlich verschlüsselt auf einen getrennten Datenträger/Backupdienst sichern, Fristen 7/28 Tage auch dort einstellen. Erst dann `OFFSITE_BACKUP_READY=true`. Die automatisch angelegten lokalen Backups allein schützen nicht gegen einen Host-Ausfall.
7. Sitemap `/sitemap.xml` in der Search Console des Kunden verifizieren; danach `SEARCH_CONSOLE_READY=true`. Einführung durchführen und die 30 Minuten Änderungen pro Monat organisatorisch einplanen.

`node cli.mjs launch-check` zeigt die Prüfungen. Der Produktivstart wird bei offenen Freigaben verweigert. Eine Markierung ersetzt keine tatsächlich erledigte Aufgabe. Keine externen Konten wurden dafür automatisch eingerichtet.

Bei vorgeschaltetem Reverse Proxy darf `TRUST_PROXY=true` ausschliesslich dann verwendet werden, wenn dieser den `X-Forwarded-For`-Header durch die echte Client-IP ersetzt und der Node-Port nicht direkt öffentlich erreichbar ist. Ansonsten bleibt der Schalter aus.

## Betrieb und Wiederherstellung

Der laufende Prozess prüft jede Stunde die Wartungsaufgaben: mindestens alle 24 Stunden ein konsistentes SQLite-Backup samt hochgeladenen Bildern (7 Tage), alle 7 Tage Quellcode-/Inhaltsstand (28 Tage). Backups liegen in `data/backups/`. Abgeschlossene Anfragen werden nach 90 Tagen automatisch gelöscht; offene bleiben bis zur Bearbeitung erhalten. Monatsberichte werden nach Monatswechsel archiviert und nutzen tatsächliche Daten; die erste aussagekräftige Ausgabe entsteht nach dem ersten vollen Betriebsmonat. Leistungs-Felddaten sind ausdrücklich als nicht verfügbar ausgewiesen.

```powershell
node cli.mjs backup
node cli.mjs report 2026-09
# Vor Wiederherstellung Server stoppen. Vorheriger Stand wird gesichert.
node cli.mjs restore lanz-<timestamp>-<id>.sqlite --confirm
```

Die Wiederherstellung prüft SQLite-Integrität und Inhaltsschema; vorhandene Sitzungen werden ungültig. Die separate `.env` bleibt erhalten. Zur Wiederherstellung nach vollständigem Serververlust zusätzlich Quellcode, Medien, `.env` aus dem eigenen Secret-Backup und Node bereitstellen. Quellcode-Sicherungen enthalten bewusst keine Zugangsdaten.

Bilddateien aus dem gewählten Backup werden ergänzt. Bereits vorhandene, inzwischen unbenutzte Uploads werden dabei nicht automatisch gelöscht; POLIRE prüft solche Dateien bei der Wiederherstellung. Der unmittelbar vorherige Datenstand liegt als reguläres Backup innerhalb der siebentägigen Frist vor.

Anfragen werden vor einem Zustellversuch in der Datenbank gespeichert. Bei fehlgeschlagener E-Mail bleibt `delivery=inbox`; die Verwaltung warnt und `/healthz` liefert 503, bis POLIRE die Anfrage im Postfach bearbeitet/als erledigt markiert. Es gibt keinen stillen unbeschränkten Mail-Retry.

Der Dockerfile stellt einen Startpunkt für den Node-Host bereit (in dieser Windows-Sitzung kein Docker-Daemon vorhanden/geprüft):

```powershell
docker build -t lanz-business .
docker run --env-file .env -e HOST=0.0.0.0 -p 127.0.0.1:4330:4330 -v lanz-data:/app/data --restart unless-stopped lanz-business
```

TLS-Reverse-Proxy, externer Monitor und getrennte Backup-Kopie gehören zum gewählten Hostingbetrieb. Sie sind nicht durch einen Docker-Healthcheck ersetzt.

## Prüfung

```powershell
node cli.mjs check
node --test tests/*.test.mjs
# Im Factory-Checkout mit den bestehenden Playwright-Abhängigkeiten:
node check-browser.mjs
node check-admin.mjs
```

Die API-Tests prüfen unter anderem Zugriffsschutz, CSRF, persistente Änderungen, Revisionskonflikte, Spam-/Formularschutz, Wiederholungen, Zustellfehler, Statistik-Privatsphäre und Backups. Browsertests verwenden ein getrenntes Testdatenverzeichnis, keine realen Anfragen oder E-Mails.

Belegte Geschäftsdaten und Bildherkunft: [SOURCES.md](SOURCES.md). Technische Grundlage: [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
