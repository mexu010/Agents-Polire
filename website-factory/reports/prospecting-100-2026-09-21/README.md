# 100 Websites: Vorprüfung und ausgewählte Agent-Reviews

Stand: 21. September 2026. **100 unterschiedliche Websites vorgeprüft, vier anschliessend mit Scout, Audit und Qualifier bewertet.** Zwei dieser vier haben zusätzliche datierte Aktivitätshinweise. Kein Kontaktversand und keine Demo.

## Interessante Treffer mit Aktivitätshinweisen

Die Reihenfolge ist eine redaktionelle Auswahl nach Belegen und beobachtetem Verbesserungsbedarf. Sie ersetzt keinen vollständigen wirtschaftlichen Opportunity-Score. Die Qualitätswerte bewerten die Website: Je niedriger, desto mehr beobachtete Probleme.

| Firma / Website | Konkreter Ansatz | Qualitätswert | Geschäftstätigkeit | Telefon und Review |
|---|---|---:|---|---|
| [Fritschi + Griesemer AG](https://www.fritschi-griesemer.ch/) · Güttingen / Kreuzlingen | Sehr kleiner mobiler Einleitungstext; direkter Kontaktzugang könnte klarer sein | 56.7/100 | Gemeinde dokumentiert einen Auftrag vom 28.04.2026; Mitteilung vom 12.05.2026 | 071 695 16 43 · [Review](reviews/fritschi-griesemer.md) |
| [Coiffeur Lanz, Vreni Lanz](https://www.coiffeurlanz.ch/) · Bleienbach | Breites Desktop-Layout auf dem Handy; Angebot und direkter Kontakt fehlen im Einstieg | 28.3/100 | Suchindex enthält Ferienhinweis bis 05.08.2026; Gemeinde bestätigt passende Kontaktdaten. Direkter Öffnungszeitenabruf war zugriffsgeschützt | 062 922 31 82 · [Review](reviews/coiffeur-lanz.md) |

Der amtliche [Auftragsnachweis für Fritschi + Griesemer](https://www.guettingen.ch/politik/aus-dem-gemeinderat.html/203/news/1905) belegt Geschäftstätigkeit im April 2026, kein Website-Budget. Beim Coiffeur ist die Grundlage schwächer: [Öffnungszeiten-Seite](https://www.coiffeurlanz.ch/html/offnungszeiten.html) im Suchindex sowie [Gewerbeverzeichnis der Gemeinde](https://www.bleienbach.ch/leben/gewerbe). Telefonische Erreichbarkeit wurde bei keiner Firma getestet.

## Zurückgestellt: Betriebsstatus noch offen

| Firma / Website | Beobachtung | Qualitätswert | Kontakt und Review |
|---|---|---:|---|
| [Martin Graf Gartenbau GmbH](https://grafgartenbaugmbh.ch/) · Lindau | Desktop-Anordnung auf dem Handy, sehr kleine Inhalte | 53.3/100 | 052 345 12 50 · [Review](reviews/martin-graf-gartenbau.md) |
| [Lantii GmbH](https://www.lantii.ch/) · Villigen | Gedrängte mobile Navigation; im geprüften Über-uns-Auszug fehlen Firmeninformationen | 45.0/100 | 056 245 79 39 · [Review](reviews/lantii.md) |

Eine erreichbare Website, ein Verzeichniseintrag oder ein aktiver Registereintrag reicht nicht als Nachweis laufender Geschäftstätigkeit. Für diese beiden Firmen wurde kein belastbarer datierter Betriebsnachweis gefunden.

## Tatsächlich gemessener Durchlauf

| Messung | Ergebnis |
|---|---:|
| Unterschiedliche Websites | 100 |
| HTML-Vorprüfung ohne Modell | 100 in 39.547 Sekunden |
| Statisch auffällige Kandidaten | 4 |
| Ohne ausgewähltes statisches Signal | 88 |
| Unklar / unvollständige Quellen | 8 |
| Abgeschlossene Scout/Audit/Qualifier-Reviews | 4 |
| Modellaufrufe einschliesslich begrenzter Reparaturen | 14 |
| Summierte aktive Pipeline-Laufzeit | 4 Minuten 38.806 Sekunden |
| Zeit zwischen erstem Start und letztem Abschluss | 6 Minuten 41.738 Sekunden |

Die erste Ausführung sammelte alle 100 Quellen, stufte sie wegen einer falschen Feldzuordnung jedoch als unklar ein. Nach Korrektur wurden dieselben gespeicherten HTML-Daten erneut ausgewertet; die 100 Abrufe wurden nicht wiederholt. Danach liefen die vier ausgewählten Reviews. Die Differenz zwischen aktiver Laufzeit und Start-bis-Abschluss enthält die Korrekturpause. Recherche, Entwicklung und die zusätzliche Quellenprüfung zur Geschäftstätigkeit sind nicht in dieser Laufzeit enthalten. Das ist eine Messung dieses Laufs, keine Garantie für andere Firmen.

**88 Websites ohne statisches Signal sind nicht als gut bewertet.** Der schnelle Filter erkennt ausgewählte HTML-Probleme wie ein fehlendes Viewport-Tag oder veraltete Frames. Er kann visuell schlechte Websites übersehen. Acht unklare Fälle bleiben sichtbar in [allen 100 Ergebnissen](results.json). Es wurden nicht 100 vollständige visuelle Reviews durchgeführt.

Die vollständigen Reviews nutzten echte mobile und Desktop-Screenshots sowie bis zu drei HTML-Seiten. Lighthouse war in diesem schnellen Profil aus; Performance bleibt ungemessen. Die Qualitätsabdeckung beträgt jeweils 75 Prozent. Bei allen vier Firmen fehlen wirtschaftliche Belege: Der Opportunity-Score bleibt unbekannt, ebenso eine frühere Agenturbeziehung. Es wurden keine Budgets oder Agenturaufträge erfunden.

## Nutzung und Grenzen

- Sechs parallele HTML-Prüfungen, maximal zwei vollständige Reviews gleichzeitig; Ergebnisse werden nach jedem Abschluss gespeichert.
- Derselbe Batch lässt sich wieder aufrufen, ohne abgeschlossene Reviews erneut zu bezahlen bzw. zu verbrauchen. Fehlgeschlagene Schritte starten nicht automatisch neu.
- In diesem Lauf waren maximal sechs Vollreviews zugelassen; nur vier Websites erfüllten den statischen Filter.
- OAuth-Modellgrenzen unverändert: 24 Aufrufe je Run, 100 am Tag und 300 im dauerhaften Scope. Am Abschluss dieses Laufs waren heute 90 Aufrufe erfasst, davon 14 für diesen Batch.
- Tatsächliche Usage: 195’477 Input-, 20’649 Output-Tokens; darin 3’868 Reasoning-Tokens. 24’320 Cache-Read-Tokens sind Teil der Input-Tokens. Cache-Writes und USD-Kosten meldete der Provider nicht. Kein API-Fallback.
- Die 100 URLs wurden in dieser Sitzung recherchiert und als [Eingabeliste](seeds.csv) mit [Suchquellen](sources.json) gespeichert. Eigenständige neue Suche im CLI benötigt den separat konfigurierten Suchanbieter; dieser Lauf verbrauchte dafür keinen Suchanbieter-API-Key.
- Die ergänzenden [Aktivitätsquellen](activity-sources.json) sind Recherchebelege. Sie setzen keine Demo-Freigabe. Der Ablauf wartet weiterhin auf die ausdrückliche Betreiberentscheidung.

## Wiederaufruf

Im Ordner `website-factory` nach lokalem OAuth-Login:

```powershell
pnpm prospect --config config/prospecting-fast.json --mode live --batch-id fast100-2026-09-21 --file reports/prospecting-100-2026-09-21/seeds.csv --max-reviews 6
```

Auf diesem Rechner verwendet derselbe Befehl die gespeicherten Resultate. Auf einem anderen Rechner ohne die lokale Datenbank startet er einen neuen Live-Lauf innerhalb der dort verfügbaren Grenzen. Für eine neue Liste eine neue Batch-ID verwenden. `--max-reviews 0` führt nur die HTML-Vorprüfung aus.

Die Projektanleitung beschreibt `--recheck-screening`: Es wertet gespeichertes HTML lokal erneut aus, kann danach aber neu ausgewählte Kandidaten in noch freie Live-Review-Plätze übernehmen. Es ist deshalb kein generell aufrufloser Trockenlauf.

## Verifikation

Build und ESLint erfolgreich; 213 Tests in 22 Dateien bestanden. Der Fixture-Test verarbeitet 100 Eingaben und überprüft die Wiederaufnahme. Zusätzliche Tests decken Parallelitätsgrenzen, persistente Batch-Lease, gleichartige Domains, Crawl-Vertragsfelder, fehlende/manipulierte Quellen, OAuth-Limits, unterbrochene Reviews und die Demo-Sperre ab. Der echte Lauf endete mit vier gespeicherten Reviews und ohne fehlgeschlagenen Modellreview.
