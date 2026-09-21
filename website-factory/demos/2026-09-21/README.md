# 15 lokale Website-Demos

Die ausdrückliche Demo-Freigabe im Chat vom 21. September 2026 wurde für 15 heute vorgestellte Firmen mit konkreten Website-Schwächen umgesetzt. Es sind individuell gestaltete Startseiten, keine vollständigen produktiven Firmenwebsites.

## Anschauen

Im Projektordner `website-factory`:

```powershell
pnpm demos:build
pnpm demos
```

Anschliessend [Demo-Übersicht öffnen](http://127.0.0.1:4320/). Der Server bindet ausschliesslich an den lokalen Rechner. Bei Bedarf kann `POLIRE_DEMO_PORT` einen anderen Port festlegen. Zum Beenden im Terminal Strg+C. Die Übersicht bietet Vorschaubilder, Branchenfilter, Original-Websites und die gespeicherten Review-Befunde.

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
- Bilder stammen aus den Firmenwebsites, dokumentiert in [asset-sources.json](asset-sources.json). Das ist keine Einräumung von Bildrechten für eine öffentliche Veröffentlichung. Die Demos bleiben interne Designentwürfe.
- Für Wismer, Sopra und Wacker liess der Bildhost den geprüften Abruf nicht zu. Es wurde kein alternativer Zugangsweg benutzt. Diese Seiten verwenden eine typografische bzw. grafische Gestaltung.
- Der Betriebsstatus von Wismer, Martin Graf und Lantii bleibt offen. Ferienhinweise bei Seiler, Wacker, Hairstudio F und Holiday sind mit den recherchierten Daten sichtbar.
- Kontaktknöpfe zeigen ausschliesslich einen lokalen Dialog. Keine Anrufe, E-Mails, Buchungen oder Formularübertragungen. Keine öffentliche Veröffentlichung.

## Aufbau und Prüfung

`inputs/` enthält die Quellenbasis je Firma. Drei Renderer erzeugen die Seiten; `build.mjs` ergänzt die Demo-Hülle und Übersicht. `public/` enthält die fertigen statischen Dateien und Vorschaubilder. Der Server liefert ausschliesslich Dateien aus diesem Ordner; Datenbank, `.env` und Input-Dateien sind darüber nicht erreichbar.

Bei laufendem Server prüft `pnpm demos:check` alle 15 Demos in Chrome bei 375, 768 und 1440 Pixeln, dunkles Farbschema, reduzierte Bewegung, Bilder, Anker, mobile Navigation, Kontakt-Dialoge und Seitenfehler. `POLIRE_DEMO_BASE` kann die lokale Testadresse überschreiben. Der Prüflauf erneuert die Vorschaubilder; danach bindet `pnpm demos:build` sie in die Übersicht ein.

[browser-checks.json](browser-checks.json) enthält die Browser-Ergebnisse; [accessibility-checks.json](accessibility-checks.json) dokumentiert ergänzende gezielte Prüfungen und deren Grenzen. Eine Auswahlprüfung ersetzt keine vollständige Barrierefreiheits-Zertifizierung.

Die POLIRE-Website bleibt unverändert. Bilder, Texte, Geschäftszeiten und gewünschte Funktionen werden vor einem echten Kundenprojekt mit der Firma abgestimmt.
