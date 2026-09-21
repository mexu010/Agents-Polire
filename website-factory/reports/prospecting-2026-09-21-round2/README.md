# POLIRE – zweite Anruf- und Prüfliste

Stand: 21. September 2026. **Zehn neue Firmen; 8 abgeschlossene Agent-Analysen, 7 berechenbare Qualitätsbewertungen, 2 gestoppte Läufe.**

Die Firmen wurden im Chat recherchiert und gegen die bisherigen Factory-Läufe abgeglichen. Scout, Audit und Qualifier liefen tatsächlich über ChatGPT OAuth. Die automatische Brave-Suche bleibt mangels Suchschlüssel ausgeschaltet.

| Firma / Website                                                    | Ort                   | Telefon       | Qualität¹       | Einordnung                  | Review                             |
| ------------------------------------------------------------------ | --------------------- | ------------- | --------------- | --------------------------- | ---------------------------------- |
| [Fredy Bieri AG](https://www.schreinerei-bieri.ch/)                | Schötz LU             | 041 980 13 81 | 45              | Zuerst ansehen              | [Review](reviews/bieri.md)         |
| [Hairstudio F](https://www.hairstudiof.ch/)                        | Fehraltorf ZH         | 044 955 12 12 | 40              | Zuerst ansehen              | [Review](reviews/hairstudio-f.md)  |
| [Schreiner2 AG](https://www.schreinerzwei.ch/)                     | Gampelen BE           | 032 338 16 84 | 62.9            | Interessant, Bedarf klären  | [Review](reviews/schreinerzwei.md) |
| [E. Seiler AG](https://seilerburgdorf.ch/)                         | Burgdorf BE           | 034 420 13 00 | 64.7            | Nach Betriebsferien prüfen  | [Review](reviews/seiler.md)        |
| [Restaurant Wacker](https://www.restaurant-wacker.ch/)             | Reinach BL            | 061 711 53 20 | 70.6            | Nach Betriebsferien prüfen  | [Review](reviews/wacker.md)        |
| [Coiffeur Holiday](https://www.coiffeurholiday.ch/)                | Wangen an der Aare BE | 032 631 10 40 | 60.6            | Gezielte Korrekturen prüfen | [Review](reviews/holiday.md)       |
| [Macchi AG](https://www.macchi-baeckerei.ch/)                      | Buchrain / Luzern LU  | 041 445 70 80 | 79.5            | Niedrige Priorität          | [Review](reviews/macchi.md)        |
| [Garage Cacarola](https://www.garagecacarola.ch/)                  | Jenins GR             | 079 604 04 10 | nicht bewertbar | Visuelle Prüfung fehlt      | [Review](reviews/cacarola.md)      |
| [Brockicenter Bern Sugiez](https://www.brockicenter.ch/index.html) | Sugiez FR             | 079 823 64 60 | nicht bewertbar | Agent-Review unvollständig  | [Review](reviews/brockicenter.md)  |
| [Coiffeur Carmen Rohner](https://www.coiffeur-rohner.ch/)          | Niederweningen ZH     | 056 241 05 52 | nicht bewertbar | Agent-Review unvollständig  | [Review](reviews/rohner.md)        |

¹ Qualität 0–100: höher = besser. Kein Kaufwahrscheinlichkeits- oder Opportunity-Score. Die Reihenfolge ist eine redaktionelle Einschätzung anhand konkreter Schwächen und Aktivitätssignale.

## Vor dem Anruf beachten

- E. Seiler AG nennt Betriebsferien bis 5. Oktober; Kontakt ab 6. Oktober prüfen.
- Restaurant Wacker nennt Betriebsferien bis 12. Oktober; Hinweis vor Kontakt nochmals prüfen.
- Hairstudio F nennt eine Pause vom 24.–26. September. Keine WhatsApp-Anrufe; die Festnetznummer steht in der Liste.
- Coiffeur Holiday nennt in der frischen Factory-Aufnahme Ferien vom 24. September bis 12. Oktober; der Suchindex zeigte noch ältere Angaben.

Du führst die Anrufe selbst. Erst nach einem Demo-Wunsch des Kunden und deiner ausdrücklichen Freigabe wird eine Demo gebaut. Angebot ab 1’000 CHF nach Projektumfang. Keine Kontaktaufnahme und keine Demo wurden in diesem Durchlauf ausgelöst.

## Bewertung und Nutzung

Die Ranking-Gewichte und Schwellen bleiben unverändert. Fehlendes Budget, unklarer Agenturbezug und andere unbekannte Faktoren bleiben offen. Deshalb kann statt eines Gesamtscores nur ein Intervall vorliegen. Ein Copyright, CMS-Logo oder Domainlink beweist keinen früheren Agenturauftrag.

Die Reviews basieren auf begrenzten Seitenabrufen, Screenshots und verfügbaren Performance-Messungen. Formulare und Interaktionen wurden nicht umfassend getestet. Ein Abruffehler beweist weder eine schlechte Website noch einen geschlossenen Betrieb.

Für diesen Durchlauf wurden 29 OAuth-Aufrufe erfasst: 387'781 Input- und 42'490 Output-Tokens, zusammen 430'271. Reasoning-Tokens (6'875) sind bereits im Output enthalten. Cache-Reads: 62'208. Cache-Writes und tatsächliche USD-Kosten sind unbekannt.

Modelle: Scout/Qualifier gpt-5.6-luna, Audit gpt-5.6-terra, jeweils low. Gleiche Datenbank und unveränderte Grenzen: 24 Aufrufe je Lauf, 100 je Tag, 300 insgesamt; höchstens drei Dispatches je Agent-Schritt. Keine Upgrades und kein automatischer Wechsel zum API-Key.

- [Quellen und Aktivitätshinweise](sources.json)
- [Gespeicherte Bewertungen und Nutzung](results.json)
- [Stapel A](leads-a.csv) · [Stapel B](leads-b.csv)
- [Erste Liste](../prospecting-2026-09-21/README.md)

Rohdaten, Screenshots und Anmeldedaten bleiben lokal.
