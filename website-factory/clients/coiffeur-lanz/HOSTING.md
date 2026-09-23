# Lanz: vollständige Anwendung auf Render bereitstellen

Stand 23. September 2026: lokal vorbereitet, **noch nicht hochgeladen**. Es fehlen die Freigabe der laufenden Kosten und ein angemeldeter Render-Zugang. Keine neue kostenpflichtige Ressource wurde erstellt.

## Vorbereitete Konfiguration

`render.yaml` betreibt die vorhandene Node-/SQLite-Anwendung unverändert: ein Prozess in Frankfurt, 512 MB RAM, 1 GB dauerhafter Speicher für Inhalte, Anfragen, Uploads und lokale Sicherungen. Keine Factory-Abhängigkeiten, keine Modellaufrufe. Manuelle Deployments; weder die Agenturwebsite noch die Demo-Galerie werden geändert.

Aktuelle Grundkosten: 7 USD Server + 0,25 USD Speicher = **7,25 USD/Monat** im Hobby-Workspace. Steuern, Mehrverbrauch, Domain, externer Backupdienst und gegebenenfalls Maildienst sind nicht enthalten. Kein automatischer Tarifwechsel oder zusätzlicher Dienst ist freigegeben. Preise vor Buchung nochmals bestätigen: https://render.com/pricing

## Nach Kostenfreigabe

1. Im Render-Konto anmelden. Neue Vertragsannahmen, Zahlungsdaten und gegebenenfalls neue GitHub-Zugriffsrechte vom Betreiber bestätigen lassen.
2. Ausschliesslich den geprüften Lanz-Stand auf einen eigenen Deployment-Branch im bestehenden `mexu010/ChatGPT_Polire` übertragen. Vorher Branch, Arbeitsstatus und Datei-Differenzen prüfen. Das aktuelle Factory-Checkout hat selbst keinen Remote. Die getrennte GitHub-Kopie nicht pauschal überschreiben, keinen automatischen Vercel-Deploy über `main` auslösen.
3. In Render einen Blueprint aus diesem Branch wählen. Blueprint-Pfad: `website-factory/clients/coiffeur-lanz/render.yaml`. Der darin enthaltene `rootDir` ist relativ zum GitHub-Sammelrepo; beim direkten Factory-Repo wäre er `clients/coiffeur-lanz`.
4. Einen frischen Verwaltungszugang in einem separaten, ignorierten lokalen Arbeitsverzeichnis mit der vorhandenen Einrichtung `node cli.mjs setup` erzeugen. Nur `ADMIN_PASSWORD_HASH` als Render-Secret übertragen. Das Klartextpasswort bleibt in der dortigen `.local-access.txt`. `SESSION_SECRET` wird von Render erzeugt. Keine bestehenden Testzugänge übernehmen, keine `.env`, Datenbank oder Kundendaten committen/hochladen.
5. Vor dem kostenpflichtigen Start Plan, Region und Disk prüfen. `PUBLIC_ORIGIN` übernimmt beim Start die tatsächliche Render-HTTPS-Adresse. Für eine spätere eigene Domain den exakten HTTPS-Origin ohne abschliessenden Schrägstrich als Umgebungsvariable setzen.
6. Nach dem Deployment Startseite, `/verwaltung/` und `/healthz` prüfen. Mit einem gekennzeichneten Testinhalt speichern, neu starten und Fortbestand kontrollieren. Formularzustellung im internen Postfach prüfen. Erst nach diesen Online-Prüfungen gilt der Upload als verifiziert.

Das vorliegende Exportpaket startet mit den belegten Standardinhalten. Es enthält keine lokale Datenbank, keine Testanfragen und keine Zugangsdaten. Bestehende gespeicherte Inhalte werden nicht automatisch migriert.

## Vollständige Anwendung und Kundenfreigabe

Die erste Bereitstellung verwendet weiterhin `APP_STAGE=review`: Verwaltung, Datenbank, Uploads und Postfach sind funktionsfähig und dauerhaft. Öffentliche Seiten tragen `noindex`; im Formular steht die Testkennzeichnung, es wird keine E-Mail versendet. `noindex` ist kein Passwortschutz der öffentlichen Seiten. Die Verwaltung bleibt durch Anmeldung geschützt.

Dies ist noch keine Freigabe für echten Kundenverkehr. Vor `production` sind die bereits vorhandenen Prüfungen in der README tatsächlich zu erfüllen: Kunden-/Inhalts- und Rechtsfreigabe, konkrete Hosting-/Datenschutzangaben, freigegebene Mailzustellung, externe Überwachung, getrennte Sicherung und Search Console. Keine Prüfmarkierung wird automatisch gesetzt. Anschliessend `APP_STAGE` im Blueprint und die entsprechenden Secrets/Bestätigungen konsistent aktualisieren.

## Betrieb

Nur eine Instanz pro SQLite-Datenverzeichnis. Die Disk ist für den laufenden Server verfügbar, nicht beim Build. Keine Datenbankinitialisierung als Build- oder Predeploy-Schritt. Deployments mit Disk verursachen eine kurze Unterbrechung. Lokale Backups auf derselben Disk ersetzen keine getrennte Sicherung. Details: https://render.com/docs/disks

`TRUST_PROXY` bleibt aus, bis der konkrete Proxyvertrag geprüft ist. Dadurch können öffentliche Rate-Limits vorläufig mehrere Besucher gemeinsam erfassen. Keine ungesicherte Übernahme fremder Forwarding-Header.

Bei einer Meldung über eine bereits verwendete Datenbank nach einem harten Abbruch zuerst im Hoster prüfen, dass kein alter Prozess mehr läuft. Die bestehende PID-Sperre ist kein verteilter Lock; eine Sperrdatei niemals während eines laufenden Servers entfernen.

Technische Referenzen: https://render.com/docs/blueprint-spec und https://render.com/docs/environment-variables
