# 15 Website-Demos

Die ausdrückliche Demo-Freigabe im Chat vom 21. September 2026 wurde für 15 heute vorgestellte Firmen mit konkreten Website-Schwächen umgesetzt. Es sind individuell gestaltete Startseiten, keine vollständigen produktiven Firmenwebsites.

**Alle 15 Entwürfe wurden auf Wunsch des Nutzers nochmals neu gestaltet.** Jede Firma hat einen eigenen Aufbau und eine begründete Gestaltungsrichtung. Die Übersicht zeigt die neuen Vorschaubilder und beschreibt das jeweilige Konzept. Die ursprünglichen Qualitätswerte und Review-Befunde bleiben erhalten; sie beziehen sich weiterhin auf die bisherigen Firmenwebsites.

Die geprüften Inspirationsquellen und konkreten Designentscheidungen stehen in [Holz und Schreinerei](design-notes/wood.md), [Salons und Restaurants](design-notes/salon-dining.md) sowie [Garten, Garage und Fachhandwerk](design-notes/places.md). Referenzbilder wurden nicht in die Kundendemos übernommen. Lokale Schriftdateien samt Lizenzhinweisen liegen unter [fonts](fonts/README.md).

## Anschauen

Im Projektordner `website-factory`:

```powershell
pnpm demos:build
pnpm demos
```

Anschliessend [Demo-Übersicht öffnen](http://127.0.0.1:4320/). Der Server bindet ausschliesslich an den lokalen Rechner. Bei Bedarf kann `POLIRE_DEMO_PORT` einen anderen Port festlegen. Zum Beenden im Terminal Strg+C. Die Übersicht bietet Vorschaubilder, Branchenfilter, Original-Websites und die gespeicherten Review-Befunde.

### Dauerhafte Team-Vorschau

Die vom Nutzer gewünschte Vorschau für Orlando und David ist unter **[polire-demo-gallery.vercel.app](https://polire-demo-gallery.vercel.app/)** erreichbar. Der Link benötigt keine Anmeldung und bleibt auch bei ausgeschaltetem Entwicklungsrechner verfügbar. Das separate Vercel-Projekt heisst `polire-demo-gallery` im Konto `maksimcanic-6695's projects`.

Im Repository `mexu010/ChatGPT_Polire` zeigt dessen **Root Directory** auf `website-factory/demos/2026-09-21/public`. Framework: **Other**. Die dort mitgelieferte `vercel.json` überspringt Installation und Build; Vercel liefert die bereits geprüften statischen Dateien aus. Es werden keine API-Keys oder Factory-Prozesse benötigt. Künftige Designänderungen zuerst lokal mit `pnpm demos:build` erzeugen und die aktualisierten Dateien committen. Vercel aktualisiert die Vorschau aus `main`.

Das POLIRE-Hauptprojekt wurde dafür nicht umgestellt. Die Vorschau ist öffentlich erreichbar; `noindex` und `robots.txt` verhindern keinen direkten Zugriff. Geprüft wurden alle 15 Demo-Routen und insgesamt 116 ausgelieferte Dateien einschliesslich Bildern und Schriften gegen den lokalen Stand. `.env`, Factory-Inputs, Konfiguration und Quellcode ausserhalb des Demo-Ausgabeordners werden nicht ausgeliefert. [Vercel-Konfiguration](https://vercel.com/docs/project-configuration/vercel-json).

Jede Karte zeigt ausserdem die gerundete Qualität der **bisherigen Website**: 0 = sehr schwach, 100 = sehr gut. Das ist keine Bewertung der neuen Demo und keine Kaufwahrscheinlichkeit. Der konkrete Befund und der nächste Schritt stehen direkt daneben; unbekannte Werte bleiben unbekannt.

| Demo | Original |
|---|---|
| [BERNHOF-Vetsch](http://127.0.0.1:4320/sites/bernhof/) | [bernhof.ch](https://www.bernhof.ch/) |
| [Fuhrer Schreinerei](http://127.0.0.1:4320/sites/fuhrer/) | [fuhrerschreinerei.ch](https://www.fuhrerschreinerei.ch/) |
| [Garage Grossfeld](http://127.0.0.1:4320/sites/grossfeld/) | [garage-grossfeld.ch](https://www.garage-grossfeld.ch/) |
| [Blumengärtnerei Wismer](http://127.0.0.1:4320/sites/wismer/) | [blumenwismer.ch](https://www.blumenwismer.ch/) |
| [Restaurant Sopra](http://127.0.0.1:4320/sites/sopra/) | [restaurantsopra.ch](https://www.restaurantsopra.ch/) |
| [Fredy Bieri](http://127.0.0.1:4320/sites/bieri/) | [schreinerei-bieri.ch](https://www.schreinerei-bieri.ch/) |
| [Hairstudio F](http://127.0.0.1:4320/sites/hairstudio-f/) | [hairstudiof.ch](https://www.hairstudiof.ch/) |
| [Schreiner2](http://127.0.0.1:4320/sites/schreinerzwei/) | [schreinerzwei.ch](https://www.schreinerzwei.ch/) |
| [Coiffeur Holiday](http://127.0.0.1:4320/sites/holiday/) | [coiffeurholiday.ch](https://www.coiffeurholiday.ch/) |
| [E. Seiler](http://127.0.0.1:4320/sites/seiler/) | [seilerburgdorf.ch](https://seilerburgdorf.ch/) |
| [Restaurant Wacker](http://127.0.0.1:4320/sites/wacker/) | [restaurant-wacker.ch](https://www.restaurant-wacker.ch/) |
| [Coiffeur Lanz](http://127.0.0.1:4320/sites/coiffeur-lanz/) | [coiffeurlanz.ch](https://www.coiffeurlanz.ch/) |
| [Fritschi + Griesemer](http://127.0.0.1:4320/sites/fritschi-griesemer/) | [fritschi-griesemer.ch](https://www.fritschi-griesemer.ch/) |
| [Martin Graf Gartenbau](http://127.0.0.1:4320/sites/martin-graf-gartenbau/) | [grafgartenbaugmbh.ch](https://grafgartenbaugmbh.ch/) |
| [Lantii](http://127.0.0.1:4320/sites/lantii/) | [lantii.ch](https://www.lantii.ch/) |

Coiffure Bettina, SIGRON und Macchi wurden in den Reviews niedrig priorisiert und nicht pauschal als schlecht eingestuft. Bei Durrer, La Dolce Vita, Widenbad, Cacarola, Brockicenter und Rohner fehlt ein abgeschlossener visueller Agent-Review. Diese neun Treffer sind nicht in diesem Demo-Stapel.

## Herkunft und Status

Die Entwürfe wurden durch drei Entwicklungsagents innerhalb der Codex-Sitzung gebaut, auf Basis der gespeicherten Firmenquellen und Reviews. Das ist **kein abgeschlossener Lauf der automatischen Strategist/Builder/QA-Pipeline**. Die Factory-Datenbank, Run-IDs, Freigaben und OAuth-Quoten wurden nicht geändert. Es gab für diese Entwürfe keine zusätzlichen Factory-Modellaufrufe und keinen Rückfall auf einen API-Key.

- Firmenangaben stammen aus den Input-Fakten und Originalquellen. Keine erfundenen Preise, Kundenbewertungen, Mitarbeiter oder Referenzprojekte.
- Bilder stammen aus den Firmenwebsites, dokumentiert in [asset-sources.json](asset-sources.json). Dieser Herkunftsnachweis ist keine Einräumung von Bildrechten. Die Demos sind als inoffizielle Designentwürfe gekennzeichnet.
- Für Wismer, Sopra und Wacker liess der Bildhost den geprüften Abruf nicht zu. Es wurde kein alternativer Zugangsweg benutzt. Diese Seiten verwenden eine typografische bzw. grafische Gestaltung.
- Der Betriebsstatus von Wismer, Martin Graf und Lantii bleibt offen. Ferienhinweise bei Seiler, Wacker, Hairstudio F und Holiday sind mit den recherchierten Daten sichtbar.
- Kontaktknöpfe zeigen ausschliesslich einen Dialog im Browser. Keine Anrufe, E-Mails, Buchungen oder Formularübertragungen.

## Aufbau und Prüfung

`inputs/` enthält die Quellenbasis je Firma. Drei Renderer erzeugen die Seiten; `build.mjs` ergänzt die Demo-Hülle und Übersicht. `public/` enthält die fertigen statischen Dateien und Vorschaubilder. Der Server liefert ausschliesslich Dateien aus diesem Ordner; Datenbank, `.env` und Input-Dateien sind darüber nicht erreichbar.

Bei laufendem Server prüft `pnpm demos:check` alle 15 Demos in Chrome bei 375, 768 und 1440 Pixeln, dunkles Farbschema, reduzierte Bewegung, Bilder, Anker, mobile Navigation, Kontakt-Dialoge und Seitenfehler. `POLIRE_DEMO_BASE` kann die lokale Testadresse überschreiben. Der Prüflauf erneuert die Vorschaubilder; danach bindet `pnpm demos:build` sie in die Übersicht ein.

Zusätzlich prüft der Lauf abgeschnittene Überschriften sowie Galerie-Filter, Konzepttexte und die unveränderten Originalscores. `pnpm demos:a11y` prüft mit der bereits vorhandenen axe-core-Version sieben gezielte Regeln für alle Demos und die Galerie, jeweils mobil und auf Desktop in hellem und dunklem Farbschema. Auch dieser Prüflauf braucht einen laufenden Demo-Server. Konkrete aktuelle Resultate stehen in den beiden Prüfdateien; keine Prüfung ersetzt eine vollständige manuelle Abnahme.

[browser-checks.json](browser-checks.json) enthält die Browser-Ergebnisse; [accessibility-checks.json](accessibility-checks.json) dokumentiert ergänzende gezielte Prüfungen und deren Grenzen. Eine Auswahlprüfung ersetzt keine vollständige Barrierefreiheits-Zertifizierung.

Prüfstand der Überarbeitung vom 21. September 2026: alle 15 Demos und die Galerie bestehen die Browserprüfungen in den drei Grössen. Die 64 gezielten Axe-Prüfungen melden keine Verstösse gegen die ausgewählten Regeln. Desktop- und Mobilaufnahmen aller Entwürfe wurden zusätzlich visuell gesichtet und gefundene Layoutfehler korrigiert. Factory-Lint, TypeScript-Build und alle 251 bestehenden Tests bestehen ebenfalls.

Die POLIRE-Website bleibt unverändert. Bilder, Texte, Geschäftszeiten und gewünschte Funktionen werden vor einem echten Kundenprojekt mit der Firma abgestimmt.
