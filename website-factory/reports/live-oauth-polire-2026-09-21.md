# POLIRE: echter Agent-Lauf vom 21.09.2026

Website: [polireagency.vercel.app](https://polireagency.vercel.app/)

Scout, Audit und Qualifier haben mit ChatGPT OAuth echte Modellantworten geliefert. Die Analyse ist gespeichert und wartet vor der Demo auf eine Betreiberentscheidung. Strategist, Builder, QA und Sales wurden in diesem Lauf nicht gestartet. Dieser Test belegt den Analyseablauf bis zum Review, keinen vollständigen Demo- oder Verkaufsablauf.

## Website-Review

| Bewertung | Ergebnis |
| --- | --- |
| Websitequalität | 74,26 / 100; höher bedeutet besser |
| Abdeckung des Qualitätsaudits | 95 % der gewichteten Dimensionen |
| Mobile Performance | 84 / 100 aus der Lighthouse-Messung dieses Abrufs |
| Mobile Darstellung | Keine wesentlichen sichtbaren Probleme im Screenshot |
| Conversion | Kleinere Hürden laut Agent-Einschätzung |
| Inhaltsklarheit | Nutzbar, mit hoher Informationsdichte |
| Vertrauen / Transparenz | Wesentlicher Mangel bei den Anbieterangaben |
| Technisches SEO | Nicht ausreichend geprüft; keine Bewertung |

**Wichtigster Befund:** Das [Impressum](https://polireagency.vercel.app/impressum) enthält Platzhalter für verantwortliche Person und vollständige Postadresse. Diese Angaben müssen mit bestätigten Informationen ergänzt werden.

**Zweiter Befund:** Auf der Startseite stehen viele Preis-, Bedingungs- und FAQ-Informationen. Der Audit empfiehlt, die entscheidenden Unterschiede der Angebote vor den Details klarer darzustellen. Die vermutete Wirkung auf Anfragen ist eine Hypothese, keine gemessene Conversion-Aussage.

Die Auswertung umfasst Startseite und Impressum, einen mobilen und einen Desktop-Screenshot sowie eine Performance-Messung. Formularversand, Interaktionen, Barrierefreiheit und technisches SEO wurden nicht vollständig getestet.

## Geschäftliche Einordnung

Es gibt keinen belastbaren Opportunity-Gesamtscore. Die Daten decken nur 40 % der Ranking-Gewichte ab. Das gespeicherte Intervall liegt bei 13,93–73,93 / 100; es ist weder eine Kaufwahrscheinlichkeit noch eine hinreichend belegte Einstufung.

Firmenwert, Budgetkapazität, Website-Wichtigkeit und ein früherer Agenturauftrag bleiben in dieser Auswertung unzureichend belegt. Der Agenturbezug ist ausdrücklich unbekannt. Das Angebot von POLIRE ist kein Nachweis für das Budget dieser Testfirma.

Aktueller Zustand: `waiting_approval` / `demo_review`. Vor einer Demo fehlen eine datierte Bestätigung des aktiven Betriebs mit Quelle und die anschliessende ausdrückliche Demo-Freigabe. Eine erreichbare Website allein wird nicht als Aktivitätsnachweis gewertet. Es wurde keine Demo erstellt und keine Nachricht versendet.

## Tatsächlich verwendete Modelle und Nutzung

| Agent | Modell | Reasoning | Aufrufe einschliesslich Fehlersuche |
| --- | --- | --- | --- |
| Scout | gpt-5.6-luna | low | 4 |
| Audit | gpt-5.6-terra | low | 2 |
| Qualifier | gpt-5.6-luna | low | 2 |

Insgesamt 8 logische Codex-Turns: 83’744 Input- und 8’130 Output-Tokens, zusammen 91’874. Die 1’180 gemeldeten Reasoning-Tokens sind bereits in den Output-Tokens enthalten. Cache-Reads: 0; Cache-Writes sind unbekannt. Alle Aufrufe verwendeten OAuth. Tatsächliche USD-Kosten sind unbekannt (`null`); API-Tokenpreise wurden nicht als Abrechnung des ChatGPT-Kontos ausgegeben.

Der erste Abruf scheiterte an der Zertifikatskette. Die damaligen drei Agentantworten enthielten deshalb keine erfundenen Bewertungen. Nach dem erfolgreichen Neuabruf wurden zwei Scout-Antworten wegen nicht passend belegter Fakten zurückgewiesen. Der dritte Versuch mit präzisierten Extraktionsregeln bestand dieselbe strenge Prüfung. Keine Modell-Upgrades, keine Erhöhung der Aufrufgrenzen und kein automatischer Wechsel zum API-Key.

## Korrekturen und Prüfung

- Die gemeinsamen Startskripte verwenden den Zertifikatsspeicher des Betriebssystems zusätzlich zu den Node-Zertifikaten; TLS-Prüfungen bleiben aktiv.
- Das konservative Eingabelimit der drei Analyse-Stufen im POLIRE-Test wurde auf 48’000 angehoben. Der vorherige Grenzwert hatte die tatsächlich gesammelten Quellen bereits vor einem weiteren Modellaufruf abgewiesen.
- Scout muss Quellenfakten als einzelne, wörtlich belegte Ausschnitte mit passender Beleg-ID extrahieren.
- Build und Lint bestanden. 78 relevante Tests für CLI, OAuth-Provider, Crawler, Agent-Verträge und Orchestrator bestanden.

Die bestehende POLIRE-Website wurde nicht verändert. Anmeldedaten, Datenbank und rohe Laufartefakte bleiben lokal.

## Gespeicherter Lauf

- Lauf-ID: `polire-oauth-review-2026-09-21`
- Revision: `20`
- Review-Hash: `50a12b4b9adff17884fd87e0623d7795794a56b6e2ad68e7d89ca5dafe9c9552`
- Lokale Daten: `data/live-test-polire/`

```powershell
pnpm review --config config/live-test.json polire-oauth-review-2026-09-21
pnpm trace --config config/live-test.json polire-oauth-review-2026-09-21
```

Diese beiden Befehle lesen gespeicherte Ergebnisse und starten keine zusätzlichen Modellaufrufe.
