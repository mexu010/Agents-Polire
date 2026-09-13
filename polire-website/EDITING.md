# POLIRE bearbeiten

Alle Texte liegen zentral in `app/content.js`, einschliesslich Navigation, Projekte, Leistungen, Prozess, Kontakt und Legal-Seiten. DE und EN haben dieselbe Struktur.

- `ACTIVE_HERO`: Auswahl der Hero-Variante.
- `heroVariants`: Headline, Beschreibung und Links in beiden Sprachen.
- `content.de` / `content.en`: Inhalte der Hauptseite.
- `projects`: Pro Konzept Nummer, Kategorie, Titel, Beschreibung, Tags und Artwork-Texte. `tone: "blue"` verwendet die technische Skulptur; `tone: "ink"` die redaktionelle Gestaltung. Die Studien sind als Konzepte gekennzeichnet. Erst echte Kundenarbeit als solche benennen.
- `services` / `process`: Einträge aus stabiler Nummer, Titel und Beschreibung. Nummern beim Übersetzen beibehalten.
- `site.email`: Zentrale Kontaktadresse.
- `app/enquiry-copy.js`: DE/EN-Texte des Anfrageformulars. Einrichtung und noch ausstehende Versandaktivierung: `docs/enquiry-setup.md`.
- `legalIdentity`: Echten Betreiber und vollständige Postadresse ergänzen. Beide Werte sind bewusst `null`. Keine fiktiven Daten eintragen.
- `legalContent`: Bestehende Rechtstexte und ihre englischen Übersetzungen. Die technische Überarbeitung ersetzt keine Prüfung der tatsächlichen Betreiber- und Datenschutzangaben.

## Gestaltung und Verhalten

`app/globals.css` ist die einzige CSS-Quelle. Historische CSS-Kopien und globale Reparaturskripte wurden entfernt. Farben und Navigationsabstand stehen oben als CSS-Variablen.

`app/navigation.js` steuert den aktiven Menüpunkt. Native Ankerlinks und Scroll-Spy verwenden denselben Abstand. Sections bleiben in der Reihenfolge Startseite → Projekte → Leistungen → Prozess → Kontakt. Keine zweite Scroll-Steuerung ergänzen.

`app/mark.js` enthält das gemeinsame SVG-Zeichen. `app/legal-page.js` stellt beide rechtlichen Seiten dar. Alle Animationen berücksichtigen reduzierte Bewegung. Die Inhalte sind ohne Reveal-Observer sichtbar.

## Lokal prüfen

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Alternativ lässt sich das Build-Skript mit `npm run build` ausführen, sobald Abhängigkeiten installiert sind. Das Repo enthält einen pnpm-Lockfile für reproduzierbare Installation.

Die Browser-Tests verwenden installiertes Chrome. Alternativ Chromium installieren (`pnpm exec playwright install chromium`) und den gewünschten Browser in `playwright.config.js` konfigurieren. Für eine bereits gestartete oder veröffentlichte Website `POLIRE_TEST_URL` setzen. Tests prüfen 1440, 1280, 1024, 768, 390 und 375 Pixel, Navigation, DE/EN, History, Tastatur, Legal-Links, reduzierte Bewegung und sichtbaren Inhalt ohne JavaScript.

## Veröffentlichen

Änderungen prüfen und auf `main` pushen. Vercel erstellt über die bestehende GitHub-Verbindung das Deployment. Erst den erfolgreichen Status des jeweiligen Commits prüfen, dann die Live-Seite. Ein GitHub-Commit allein bestätigt noch keinen erfolgreichen Deploy.
