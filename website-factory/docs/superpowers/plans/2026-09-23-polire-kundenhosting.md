# POLIRE Kundenhosting – Implementation Plan

> **For agentic workers:** Bei späterer Ausführung `executing-plans` verwenden und die Aufgaben einzeln verifizieren. Dieser Auftrag erstellt ausschliesslich einen Plan. Er autorisiert keine Buchung, Veröffentlichung, Domainänderung oder Nachricht.

**Goal:** Kundenwebsites einzeln und nachvollziehbar betreiben; mit Lanz beginnen und die laufenden Kosten pro gewonnenem Kunden erweitern.

**Architecture:** Ein POLIRE-Workspace bei Render, ein eigener Web Service mit eigener Disk und eigenen Zugangsdaten je Kunde. Keine gemeinsame Kundendatenbank. Getrennte verschlüsselte Sicherungen bei einem zweiten Anbieter und externe Erreichbarkeitsprüfung.

**Tech Stack:** Vorhandene Node.js-24-Anwendung, SQLite, lokale Assets, bestehende Verwaltung und Resend-Anbindung. Render Frankfurt; als geplante Ergänzungen Backblaze B2 für Sicherungen und HetrixTools für Überwachung.

**Spec:** Nutzerentscheidung vom 23. September 2026: einzelne Kundenserver; zuerst Plan für Aufbau, Anbieter, Ablauf und Kosten. Bestehende Betriebsanforderungen: `clients/coiffeur-lanz/README.md`, `config.mjs` und `HOSTING.md`.

## Grenzen

- Kosten und Veröffentlichung benötigen weiterhin ausdrückliche Freigabe.
- Keine neue Agentenplattform, kein Frameworkwechsel, keine Modellaufrufe für das Hosting.
- Der Hobby-Workspace ist die Verwaltungsebene; jeder Kunden-Web-Service ist bezahlt.
- Ein Web Service ist eine getrennte Anwendungsinstanz, kein exklusiver physischer Server.
- Trennung begrenzt Auswirkungen von Anwendungsfehlern; ein Render- oder Regionsausfall kann mehrere Kunden betreffen. Es ist kein automatisches Ausweichsystem zu einem zweiten Anbieter enthalten.
- Quellcode, Konfiguration, Daten, Passwörter, Absender und Empfänger je Kunde trennen. Kunden erhalten ihren Website-Zugang, keinen gemeinsamen Render-Login.
- Bestehende lokale Änderungen erhalten. Factory-Checkout und getrennte GitHub-Kopie vor jeder Übertragung vergleichen.
- Vorhandene Freigaben, Faktenbindung und Produktionsprüfungen nicht umgehen. Keine realen Nachrichten ohne Erlaubnis.

## 1. Was kommt wohin?

| Bestandteil | Geplanter Ort | Verantwortung |
|---|---|---|
| Quellcode | Bestehendes GitHub-Projekt, klarer Ordner und freigegebener Versionsstand pro Kunde | POLIRE |
| Website und Verwaltung | Eigener Render Web Service je Kunde, Region Frankfurt | Render betreibt Plattform; POLIRE betreibt Anwendung |
| Inhalte, Anfragen, Bilder | Eigene dauerhafte Disk je Kunde | POLIRE; Zugriff nur für die betreffende Anwendung |
| Kundendomain | Bleibt beim bisherigen Registrar und möglichst im Eigentum des Kunden | Kunde; POLIRE richtet nur erforderliche DNS-Einträge ein |
| HTTPS | Automatisch über Render | Render |
| Sicherung ausserhalb des Webservers | Privater Backblaze-B2-Bucket in einer verfügbaren EU-Region, getrennt je Kunde | POLIRE; Schlüssel je Kunde begrenzen |
| Erreichbarkeit | HetrixTools, Prüfung alle 60 Sekunden | Benachrichtigung an vereinbarten POLIRE-Kontakt |
| Formular-E-Mails | Bestehender Resend-Adapter; verifizierte POLIRE-Absenderdomain, Empfänger je Kunde | POLIRE mit Zustimmung des Kunden |
| POLIRE-Website | Zunächst bestehendes Hosting; separat auf statische Bereitstellung und Tarif prüfen | Kein automatischer Umzug in diesem Plan |
| Factory und Agents | Bleiben in ihrer bisherigen Umgebung | Kein laufender Agent auf jedem Kundenserver nötig |

Domain-Mailkonten werden durch eine Website-Veröffentlichung nicht ersetzt; bestehende MX-Einträge bleiben bei einer DNS-Umstellung erhalten. Render-Domainanbindung ist keine Domainregistrierung. [Domains und HTTPS](https://render.com/docs/custom-domains)

## 2. Startgrösse und Render-Kosten

Pro kleiner Kundenwebsite wie Lanz: `0.5c-512mb`, eine Instanz, zunächst 1 GB Disk. Speicher und Arbeitsspeicher nach dem ersten realen Betrieb messen; die Grösse ist keine Zusicherung für Shops oder komplexe Buchungssysteme.

| Position | Pro Monat |
|---|---:|
| Web Service | 7,00 USD je Kunde |
| 1 GB dauerhafte Disk | 0,25 USD je Kunde |
| Hobby-Workspace, ein Hosting-Verwalter | 0,00 USD |
| Optionaler Pro-Workspace für mehrere Hosting-Verwalter | 25,00 USD für den gesamten Workspace |

| Kundenwebsites | Webserver + Disks, Hobby-Workspace | Mit Pro-Workspace |
|---:|---:|---:|
| 1 | 7,25 USD | 32,25 USD |
| 3 | 21,75 USD | 46,75 USD |
| 5 | 36,25 USD | 61,25 USD |
| 10 | 72,50 USD | 97,50 USD |

Listenpreise geprüft am 23. September 2026. Dies sind **Grundkosten**, keine Gesamtpreisgarantie oder technisch erzwungene Kostengrenze. [Render-Preise](https://render.com/pricing)

Hobby unterstützt einen Workspace-Nutzer und 25 Dienste. Pro wird nötig, wenn Orlando oder David eigene Hostingzugänge bekommen sollen; ihre Nutzung der jeweiligen Website-Verwaltung erfordert dagegen keinen Render-Zugang. [Workspace-Funktionen](https://render.com/docs/platform-features-by-plan)

## 3. Weitere Kosten transparent einplanen

- **Eigene Domains:** Hobby enthält 2 Render-Domainanbindungen, Pro 15; zusätzliche werden mit 0,25 USD pro Monat berechnet. Die tatsächlich gezählten Einträge einschliesslich Weiterleitungen im Dashboard vor Buchung prüfen. Die Jahresrechnung des Domainregistrars kommt separat. [Domainpreise](https://render.com/docs/custom-domains)
- **Datenverkehr:** Hobby enthält 5 GB, Pro 25 GB pro Monat für den gesamten Workspace; darüber 0,15 USD/GB. Beispiel: 50 GB Gesamtverkehr ergeben bei Hobby 6,75 USD Mehrkosten. Auch ausgehende Backup-Uploads können dieses Kontingent beanspruchen. [Preisübersicht](https://render.com/pricing), [Bandbreite](https://render.com/docs/outbound-bandwidth)
- **Builds:** Monatliche Freimengen sind begrenzt. Manuelle geprüfte Veröffentlichungen und der kleine native Node-Build halten den Verbrauch gering; weitere Builds sind keine unbegrenzte kostenlose Ressource. [Render-Preise](https://render.com/pricing)
- **Externe Sicherungen:** Backblaze B2 nennt 10 GB kostenlosen Speicher und danach 6,95 USD/TB/Monat. Beispielrechnung für durchschnittlich 100 GB gespeicherte Daten: ungefähr 0,63 USD für den Speicher über der Freimenge. Abrufe, Transaktionen und Render-Ausgangsverkehr separat berücksichtigen; EU-Tarif bei Einrichtung nochmals bestätigen. Für kleine Datenbestände zunächst 1–3 USD monatliche Backup-Reserve für alle Kunden zusammen einplanen, ausdrücklich als Schätzung. [B2-Preise](https://www.backblaze.com/cloud-storage/pricing)
- **Überwachung:** HetrixTools Free: 15 Monitore im Minutentakt. Zehn Kunden-Endpunkte und die POLIRE-Website benötigen 11 Monitore. Ein Login spätestens alle 90 Tage ist erforderlich; monatliche Betriebsprüfung vorsehen. E-Mail-Alarme verwenden; kostenpflichtige SMS nicht voraussetzen. [HetrixTools](https://hetrixtools.com/pricing/uptime-monitor/)
- **Formularversand:** Resend Free: insgesamt 3.000 E-Mails/Monat, höchstens 100/Tag, bis zu 3 Absenderdomains. Eine gemeinsame verifizierte POLIRE-Absenderdomain kann die Kundenbenachrichtigungen abdecken; der Kunde muss diese Absenderwahl kennen. Begrenzungen gelten gemeinsam, nicht pro Kundenserver. Bei höherem Bedarf wäre Resend Pro mit 20 USD/Monat separat freizugeben. Nicht mit persönlichem Mailpostfach oder Cold Outreach verwechseln. [Resend](https://resend.com/pricing)
- **POLIRE-Website:** Falls nach Prüfung statisch exportierbar, ist ein Render Static Site ohne eigene Servergrundgebühr möglich. Domain- und Verkehrsverbrauch zählen weiter. Falls ein eigener Anwendungsserver benötigt wird, erhöht sich die Rechnung entsprechend. Vorhandenes Vercel-Projekt nicht ungeprüft umziehen. [Statische Websites](https://render.com/docs/static-sites)
- **Nicht enthalten:** Steuern, Wechselkurs/Kartengebühren, Domainverlängerungen, Arbeitszeit, laufende Kundenbetreuung, Modellkosten der Factory sowie spätere grössere Server.

**Rechenbeispiel, keine Zusicherung:** Bei zehn Kunden im Hobby-Workspace, 11 berechneten eigenen Domainanbindungen einschliesslich POLIRE, 50 GB Gesamtverkehr inklusive Backups, kostenlosen Mail-/Monitoringkontingenten und 1–3 USD Backup-Reserve: 72,50 + 2,25 + 6,75 + 1–3 = **82,50–84,50 USD/Monat**, vor Steuern und ohne Domainregistrierung. Falls Render mehr Domain-Einträge zählt oder Datenverkehr/Backups höher liegen, steigt die Rechnung. Mit Pro unter denselben Verkehrsannahmen: 97,50 + 3,75 + 1–3 = **102,25–104,25 USD/Monat**. Der Pro-Aufpreis sollte durch Teamzugriff oder Betriebsfunktionen begründet sein.

## 4. Vorhanden und noch umzusetzen

**Vorhanden, lokal geprüft:** Lanz Richtung B; Verwaltung, persistente SQLite-Inhalte, Postfach, Uploads, lokale Sicherungen, Wiederherstellung, Resend-Adapter und `/healthz`. Das Exportpaket unter `work/lanz-hosting-20260923.zip` wurde mit Seitenprüfung und 21 Tests geprüft. Dies ist keine Online-Abnahme.

**Vorbereitet, noch nicht eingesetzt:** `clients/coiffeur-lanz/render.yaml` und `HOSTING.md`, Node 24.19.0, Frankfurt, manuelle Deployments, Review-Modus, eigener Datenträger. Render-Zugang noch nicht angemeldet; kein bezahlter Dienst gebucht.

**Noch erforderlich:** Externer verschlüsselter Backup-Transfer mit Fehleranzeige, Wiederherstellungsprobe aus dieser externen Kopie, externe Überwachung und Alarmtest, Resend-/Domainkonfiguration, tatsächliche Kundeneinwilligungen und Betriebsangaben. Der bisherige prozessinterne Monitor versendet keine externen Alarme. Geheimnisse nur als Host-Secrets beziehungsweise im Passwortmanager speichern.

## 5. Reihenfolge der späteren Umsetzung

### Aufgabe A: Lanz online im Review-Modus

Betroffene Dateien: vorhandene `clients/coiffeur-lanz/render.yaml`, `HOSTING.md`, `config.mjs`; keine Designänderung erforderlich.

- [ ] Kostenfreigabe und Hostinganmeldung erhalten, Kontoinhaber und monatliche Rechnungsempfänger festlegen.
- [ ] Aktuellen Branch und Git-Status beider Checkouts prüfen; ausschliesslich den freigegebenen Lanz-Stand auf einen eigenen Deployment-Branch übertragen.
- [ ] Eigenen Render-Dienst mit Disk und frischem Verwaltungszugang einrichten. Keine lokale Testdatenbank und keine `.env` hochladen.
- [ ] Review-Modus beibehalten. Startseite, Verwaltung, Upload und Testanfrage online prüfen. Dienst neu starten und gespeicherte Inhalte erneut prüfen.

Abnahme: teilbare HTTPS-Adresse, funktionierende Anmeldung und nachgewiesene Datenbeständigkeit nach Neustart; keine ungewollte E-Mail.

### Aufgabe B: Externe Sicherung und Wiederherstellung

Betroffene Basis: `clients/coiffeur-lanz/store.mjs`, `operations.mjs`, `server.mjs`, `config.mjs`, bestehende Tests in `clients/coiffeur-lanz/tests/`. Neue Sicherungsanbindung als eigenes Modul neben `operations.mjs`, keine Einbettung in den Renderer.

- [ ] Konsistente SQLite-Sicherung über die vorhandene Backup-Funktion verwenden, inklusive zugehöriger Uploads. Keine laufende Datenbankdatei blind kopieren.
- [ ] Verschlüsselten, deduplizierenden Transfer in den kundeneigenen privaten B2-Bucket ergänzen; Wiederholungen begrenzen und Fehler in der Betriebsübersicht anzeigen. Schlüssel nur für diesen Kunden, Entschlüsselungsschlüssel zusätzlich sicher ausserhalb des Servers hinterlegen.
- [ ] Tägliche Sicherungen 7 Tage und wöchentliche Stände 28 Tage halten. Vor Änderungen eine zusätzliche Sicherung erstellen. Unveränderte Bilder nicht täglich vollständig erneut übertragen.
- [ ] Aus einer heruntergeladenen externen Sicherung in einem isolierten lokalen Datenverzeichnis wiederherstellen und Inhalte, Bilder, Anfragen sowie ungültige alte Sitzungen prüfen.
- [ ] Übertragungsfehler, fehlende Schlüssel und defekte Archive testen; vorhandene Sicherungen dürfen dadurch nicht verschwinden. Erst nach erfolgreicher Probe `OFFSITE_BACKUP_READY` setzen.

Abnahme: Wiederherstellung ohne Zugriff auf den ursprünglichen Webserver funktioniert. Bei täglichen Sicherungen können bis zu 24 Stunden neue Daten fehlen; dies ist kein Echtzeit-Failover. Tatsächliche Wiederherstellungsdauer messen, keine ungeprüfte Verfügbarkeitsgarantie verkaufen.

### Aufgabe C: Überwachung und Formularversand

Betroffene Basis: bestehender `/healthz`-Endpunkt und Resend-Adapter in `server.mjs`; `config.mjs` und `README.md` für tatsächliche Betriebsangaben.

- [ ] HetrixTools-Prüfung alle 60 Sekunden auf `/healthz` einrichten; Alarmempfänger POLIRE festlegen und einen abgesprochenen Testalarm verifizieren.
- [ ] Backup-Aktualität in die Betriebsprüfung aufnehmen, damit eine erreichbare Website keine ausgefallenen Sicherungen verdeckt.
- [ ] Resend-Absenderdomain verifizieren, `MAIL_FROM` und kundeneigenes `MAIL_TO` setzen; Zustelltest nur an einen ausdrücklich freigegebenen Empfänger.
- [ ] Vorhandene Produktionssperre bis zur echten Abnahme beibehalten. Erst nach erfolgreichen Prüfungen die zugehörigen Flags setzen.

Abnahme: POLIRE erhält einen Ausfallalarm und eine freigegebene Formularnachricht kommt an; die Anfrage bleibt unabhängig davon im Kundenpostfach gespeichert.

### Aufgabe D: Kundendomain und echte Freigabe

- [ ] Betreiberangaben, Inhalte/Bilder, Hosting Frankfurt und tatsächlich verwendete Dienstleister mit dem Kunden klären und dokumentieren.
- [ ] Kundendomain mit HTTPS verbinden, `PUBLIC_ORIGIN` auf die endgültige Adresse setzen; bestehende Mail-DNS-Einträge erhalten.
- [ ] Bestehende Startprüfungen einschliesslich Search Console erfüllen. Danach erst Produktion aktivieren.
- [ ] Mobil/Desktop, Anmeldung, Anfrage, Wiederherstellung und Domainweiterleitungen prüfen; Zugänge separat übergeben.

Abnahme: funktionierender Kundenbetrieb mit freigegebenen Inhalten und dokumentierter Wiederherstellung. Kurze Unterbrechungen bei Veröffentlichungen mit Render-Disk sind möglich. [Disk-Einschränkungen](https://render.com/docs/disks)

### Aufgabe E: Weitere Kunden und monatlicher Betrieb

- [ ] Für jeden neuen Kunden einen eigenen Dienst, Disk, Zugang, Backup-Bucket und Empfänger aus dem geprüften Verfahren anlegen. Kundenspezifische Texte und Daten nicht aus Lanz ungeprüft übernehmen.
- [ ] Monatlich Rechnungen, Datenvolumen, Diskbelegung, Mailkontingent, Backup-Erfolg und Alarmempfänger prüfen. HetrixTools-Login dabei erledigen.
- [ ] Vor Updates Änderungen prüfen und gezielt nur diesen Kunden veröffentlichen; Quellcode-Rollback ersetzt keine Datenwiederherstellung.
- [ ] Einen Kunden nur bei gemessenem Bedarf vergrössern. Kein pauschales Upgrade aller Kunden.
- [ ] Pro-Workspace erst aktivieren, wenn mehrere Personen direkten Hostingzugriff benötigen. Keine gemeinsam genutzten persönlichen Passwörter.

## Nächster freizugebender Schritt

Nur Lanz auf dem kleinen bezahlten Render-Dienst beginnen. 7,25 USD sind dessen Server-/Disk-Grundkosten; Zusatzverbrauch und weitere Anbieter getrennt berücksichtigen. Eine Zahlungserlaubnis oder Live-Freigabe wurde mit dem vorliegenden Plan nicht erteilt.
