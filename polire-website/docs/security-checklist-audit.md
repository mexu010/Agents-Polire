# Sicherheitsprüfung vom 11.09.2026

Grundlage: sichtbare Checkliste im bereitgestellten Video 18.29.32. Keine Datenbank oder Admin-Funktion beauftragt; diese sind zurückgestellt.

## Umgesetzt und geprüft

- Globale CSP beschränkt Verbindungen auf eigene Herkunft und FormSubmit, Bilder auf eigene Herkunft/Unsplash, Schriftanbieter auf Google Fonts. Objekte, fremde Einbettung und fremde native Formularziele sind gesperrt.
- X-Frame-Options DENY, nosniff, zurückhaltende Referrer-Policy und deaktivierte Kamera/Mikrofon/Standort/Zahlungsfunktionen ergänzt. FormSubmit erhält weiterhin die für die Aktivierung benötigte Herkunft.
- Bereits vorhandene serverseitige Prüfung: Herkunft, JSON-Typ, 20 KB maximale Eingabe, Feldlängen, E-Mail, HTTP(S)-Links, feste Auswahlwerte, Honeypot und feste Empfänger-/Nutzlast-Zuordnung. Keine durch Besucher konfigurierbaren Webhooks oder Empfänger.
- Keine Verwendung von dangerouslySetInnerHTML, innerHTML oder eval im geprüften App-Code gefunden. React rendert Nutzereingaben als Text. FormSubmit ist ein externer Verarbeiter; dessen interne Darstellung wurde nicht auditiert.
- Empfänger-Konfiguration bleibt serverseitig. Anonyme Formular-ID ist beim Browser-Fallback sichtbar und kein geheimer Schlüssel.
- Musterbasierte Suche in 52 lokal verfügbaren Git-Versionen: keine Treffer für geprüfte private Schlüssel-/Tokenmuster. Kein vollständiger Nachweis, dass sämtliche denkbaren Geheimnisse ausgeschlossen sind.
- pnpm audit: 0 gemeldete Schwachstellen bei 57 erfassten Abhängigkeiten. Kein blindes Versionsupdate erforderlich. Produktionsabhängigkeiten Next/React/React DOM werden verwendet, Playwright dient Tests.
- Browser: Startseite und drei Konzepte ohne CSP-Verletzungen. /.env, /.env.local, /.git/config, /package.json und /admin liefern 404.
- Produktionsbuild erfolgreich; 9 Node-Prüfungen und 17 Browserprüfungen erfolgreich. Versandantworten werden in Tests simuliert, keine zusätzliche echte E-Mail gesendet.

## Grenzen und später nötige Arbeit

- Die CSP erlaubt Inline-Skripte für statische Next.js-Seiten und Inline-Stile für das Design. Sie ist eine Basissicherung, keine strikte noncebasierte XSS-Abwehr. Produktion erlaubt kein unsafe-eval.
- Bestehendes Rate-Limit (5 gültige Anfragen pro 10 Minuten/IP) ist nur instanzlokal. Kein zentraler Firewall-Schutz eingerichtet. Direkter FormSubmit-Aufruf kann den eigenen Server umgehen; echte Ende-zu-Ende-Spamabwehr benötigt Schutz auch beim Versanddienst.
- Kein Login, keine Passwörter, keine Datenbank, keine Admin-Routen vorhanden. Authentifizierung, Rollenprüfung, Passwort-Hashing und Datenbankrechte müssen bei Einführung gesondert umgesetzt werden.
- Hosting-Kontozugang, MFA, Rechte der Anbieter und externe Dienste sind nicht durch diesen Code-Audit vollständig überprüft. Kein Penetrationstest und keine Garantie gegen Angriffe.

Referenzen: https://nextjs.org/docs/app/guides/content-security-policy und https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
