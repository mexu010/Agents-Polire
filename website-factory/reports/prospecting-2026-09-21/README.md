# POLIRE – Anrufliste und Website-Reviews

Stand: 21. September 2026. Zehn Schweizer Firmen aus unterschiedlichen Branchen wurden recherchiert und für echte Agent-Reviews ausgewählt.

**Ergebnis:** 8/10 Analysen bis zum Review abgeschlossen; 7/10 mit einer berechenbaren Websitequalität. La Dolce Vita und Widenbad stoppten nach jeweils drei Scout-Versuchen an der Faktenprüfung. Durrer hat wegen fehlender Screenshots keinen Qualitätsscore.

Scout, Audit und Qualifier liefen über ChatGPT OAuth. Die Firmensuche erfolgte im Chat, weil noch kein Brave-Suchschlüssel eingerichtet ist. Es wurde keine Demo erstellt und keine Kontaktaufnahme ausgeführt.

## Anruf- und Prüfliste

| Reihenfolge | Firma / Website                                                          | Ort             | Telefon       | Qualität¹ | Einordnung                   | Review                          |
| ----------- | ------------------------------------------------------------------------ | --------------- | ------------- | --------- | ---------------------------- | ------------------------------- |
| 1           | [Garage Grossfeld AG](https://www.garage-grossfeld.ch/)                  | Trimbach SO     | 062 293 09 09 | 54.6      | Zuerst ansehen und anrufen   | [Review](reviews/grossfeld.md)  |
| 2           | [Restaurant Sopra](https://www.restaurantsopra.ch/)                      | Attelwil AG     | 062 726 11 44 | 64.1      | Zuerst ansehen und anrufen   | [Review](reviews/sopra.md)      |
| 3           | [Fuhrer Schreinerei AG](https://www.fuhrerschreinerei.ch/)               | Kehrsatz BE     | 031 961 35 55 | 58.3      | Interessant, Bedarf klären   | [Review](reviews/fuhrer.md)     |
| 4           | [BERNHOF-Vetsch AG](https://www.bernhof.ch/)                             | Frümsen SG      | 081 757 12 73 | 53.3      | Interessant, Bedarf klären   | [Review](reviews/bernhof.md)    |
| 5           | [Blumengärtnerei Wismer AG](https://www.blumenwismer.ch/)                | Zug ZG          | 041 711 06 25 | 65.4      | Zuerst Betriebsstatus klären | [Review](reviews/wismer.md)     |
| 6           | [Coiffure Bettina](https://coiffeur-bettina.ch/content/coiffure-bettina) | Muri AG         | 056 664 13 92 | 74.4      | Niedrige Priorität           | [Review](reviews/bettina.md)    |
| 7           | [SIGRON Transporte & Garage](https://sigron-ag.ch/garage/index.html)     | Lain/Obervaz GR | 081 384 15 81 | 74        | Niedrige Priorität           | [Review](reviews/sigron.md)     |
| 8           | [Schreinerei Durrer GmbH](https://www.schreinereidurrer.ch/)             | Stalden OW      | 041 660 89 75 | unbekannt | Visuelle Prüfung fehlt       | [Review](reviews/durrer.md)     |
| 9           | [Restaurant La Dolce Vita](https://www.ladolce-vita.ch/)                 | Augst BL        | 061 811 26 42 | unbekannt | Agent-Review unvollständig   | [Review](reviews/dolce-vita.md) |
| 10          | [Restaurant Widenbad](https://widenbad.ch/)                              | Männedorf ZH    | 044 920 08 28 | unbekannt | Agent-Review unvollständig   | [Review](reviews/widenbad.md)   |

¹ Websitequalität auf 0–100, höher = besser. Das ist kein Lead- oder Kaufwahrscheinlichkeitsscore. Die Reihenfolge berücksichtigt überprüfbare Schwächen und Aktivitätssignale; sie ist eine redaktionelle Empfehlung.

## Ablauf

1. Website und Review öffnen.
2. Du rufst selbst an und bestätigst den aktuellen Betrieb, Bedarf und Interesse.
3. Gesprächsergebnis und einen allfälligen Demo-Wunsch festhalten.
4. Erst bei Interesse die Demo ausdrücklich freigeben. Angebot: ab 1’000 CHF, nach Projektumfang, ohne feste Preisobergrenze.

Aktuelle Menüs, Personalnachrichten oder angekündigte Veranstaltungen sind Aktivitätssignale. Sie beweisen weder die heutige Erreichbarkeit noch eine Kaufabsicht. Wismer bleibt mangels belastbarer aktueller Datierung besonders unsicher. Eine erreichbare Website allein genügt nicht.

## Bewertung und Grenzen

Das Opportunity-Ranking verwendet unverändert 25 % Redesign-Bedarf, 20 % Company Value, 15 % Budgetkapazität, 15 % früheren Agenturauftrag, 10 % Website-Wichtigkeit, 10 % Conversion-Verbesserung und 5 % Kontaktierbarkeit. Schwellen: unter 60 skip, 60–74 database, 75–84 research, ab 85 demo candidate. Unbekannte Werte werden nicht mit erfundenen Annahmen gefüllt; deshalb ist oft nur ein Intervall möglich.

Ein automatischer niedriger Grenzwert bei fehlenden Faktoren ist kein vollständiges Ranking. Die Einzelreviews benennen Abdeckung, Intervall und fehlende Informationen. Technisches SEO, Interaktionen und Formulare wurden nicht umfassend getestet. Die Performancewerte sind einzelne Labormessungen und können schwanken.

## Nutzung und Nachvollziehbarkeit

39 OAuth-Aufrufe einschliesslich zurückgewiesener Antworten und begrenzter Korrekturversuche. Input: 527'230 Tokens; Output: 61'608; gesamt: 588'838. Reasoning: 9'492, bereits im Output enthalten. Cache-Reads: 51'968. Cache-Writes und tatsächliche USD-Kosten sind unbekannt, nicht null Kosten.

Modelle: Scout und Qualifier gpt-5.6-luna, Audit gpt-5.6-terra; jeweils low. Keine automatischen Upgrades, kein Rückfall auf den API-Key. Die bestehenden Aufrufgrenzen und derselbe OAuth-Zählerbereich bleiben erhalten.

Während des Laufs wurden drei Datenverarbeitungsfehler behoben: HTML-Zeichen wurden korrekt dekodiert, ausdrückliche CH-Postadressen als Länderbeleg erkannt und tatsächlich abgerufene Kontaktseiten anhand ihrer Quellen-URL geprüft. Gespeicherte Antworten wurden erneut validiert. Unbelegte Fakten und mehrdeutige Agentur-Credits bleiben zurückgewiesen.

- [Quellen und Aktivitätssignale](sources.json)
- [Gespeicherte Bewertungen, Lauf-IDs und Nutzung](results.json)
- [CSV Stapel A](leads-a.csv) · [CSV Stapel B](leads-b.csv)

Build, Lint und 178 Tests bestanden. Rohdaten, Screenshots, Datenbank und Anmeldedaten bleiben lokal; dieser Bericht enthält die nachvollziehbaren Ergebnisse.
