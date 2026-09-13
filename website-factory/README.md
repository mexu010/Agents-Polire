# POLIRE Website Factory

Lokale TypeScript-Anwendung mit sieben Agent-Stufen, SQLite, einem deklarativen React-Renderer und echten Browserprüfungen. Das Projekt ist von der bestehenden POLIRE-Website getrennt. Es enthält keinen E-Mail-Versand.

## Schnellstart ohne API-Key

Voraussetzungen: Node.js 24 oder neuer, pnpm und Chrome oder Playwright Chromium.

Alle folgenden Befehle im Projektordner `website-factory` ausführen.

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
pnpm lint
pnpm test
pnpm demo
```

Vorhandenes Chrome wird ebenfalls unterstützt. Die SQLite-Datenbank wird beim ersten Start automatisch unter `data/` angelegt. Es ist kein Datenbankserver erforderlich.

`demo` führt alle sieben Stufen mit eindeutig gekennzeichneten Beispieldaten aus. Rendering, Screenshots und Browserprüfungen laufen tatsächlich. Modellantworten und Betreiberfreigaben sind in diesem Modus simuliert. Der Export ist ein nicht versendeter Testentwurf und keine echte Kampagne.

Einzelne Stufen und Freigaben selbst prüfen:

```powershell
pnpm factory --data-dir data/my-fixture run --domain https://fixture.alpina-service.example/ --mode fixture --experimental
pnpm factory --data-dir data/my-fixture show RUN_ID
pnpm factory --data-dir data/my-fixture preview open RUN_ID
```

Der letzte Befehl zeigt eine geschützte lokale URL und läuft bis Strg+C weiter. `show` enthält Quellen, Bewertungen, Grenzen, aktuelle Versionen und Artefakt-Hashes. Platzhalter wie `RUN_ID` und `HASH` durch die tatsächlichen Werte ersetzen.

## Echter POLIRE-Test mit maximal 2 USD

Der API-Key erlaubt den fertigen Agents, Modelle über die OpenAI-API aufzurufen. Diese Nutzung wird separat vom ChatGPT-Abo abgerechnet. Einen Key ausschliesslich lokal in `.env` speichern:

```dotenv
OPENAI_API_KEY=
```

`.env` ist von Git ausgeschlossen. `.env.example` enthält nur einen leeren Platzhalter. Keine Schlüssel in JSON-Konfigurationen, Prompts, Chats oder Commits schreiben.

Die vorbereitete `config/live-test.json` setzt für den vom Betreiber genehmigten Einzeltest ein dauerhaftes Gesamtbudget von 2'000'000 Mikro-USD = 2 USD. Die Startprüfung und der Lead-Lauf teilen denselben Budgetbereich.

```powershell
pnpm factory --config config/live-test.json doctor --mode live
pnpm factory --config config/live-test.json run --domain https://polireagency.vercel.app --mode live
```

Die Variante ohne `www` wurde verwendet, weil die angegebene `www`-Variante beim Abruf einen TLS-Fehler lieferte. TLS-Prüfungen bleiben aktiviert.

`doctor` prüft die konfigurierten Modellfähigkeiten mit kleinen, tatsächlich kostenpflichtigen Aufrufen. Erfolgreiche Ergebnisse werden zeitlich begrenzt wiederverwendet. Fehlender Key, fehlende Modellberechtigung oder ununterstützte Fähigkeiten stoppen den Lauf. Es gibt keinen stillen Modellwechsel.

Der echte Lauf bewertet die vorhandenen Belege und legt nach der Analyse immer ein Review mit Firmen-URL vor. Erst eine ausdrückliche, an dieses Review gebundene Betreiberentscheidung erlaubt die Demo-Erstellung. Ein hoher Score, autoGenerate oder --experimental ersetzen im Live-Modus diese Entscheidung nicht. Fehlende Fakten werden nicht erfunden.

Das bestätigte POLIRE-Angebot ist in `config/live-test.json` hinterlegt: Verbesserung bestehender Websites oder komplette Neuerstellung, für alle Schweizer Branchen, ab 1’000 CHF abhängig vom Projektumfang und ohne feste Preisobergrenze. Eine leere Branchenliste bedeutet keine Branchenbeschränkung. Dieser Angebotspreis ist kein Nachweis für das Budget einer gefundenen Firma. Eine bestätigte Absenderidentität muss vor einem Verkaufsentwurf zusätzlich hinterlegt werden.

### Budgetverhalten

- Vor jedem kostenpflichtigen Request wird der maximale zulässige Betrag atomar reserviert, auch bei parallelen Prozessen.
- Input inklusive Prompt, Schema und Bildern muss innerhalb der budgetierten Grenze liegen. Zu grosse Eingaben stoppen vor dem Modellaufruf.
- Echte Usage einschliesslich Cache-Reads, Cache-Writes und Reasoning wird gespeichert. Reasoning-Tokens sind bereits in Output-Tokens enthalten und werden nicht doppelt addiert.
- Timeout oder unklare Usage halten die Reservation offen. Ein Neustart gibt diesen Betrag nicht frei.
- Ein dauerhafter `spendScopeId` begrenzt den gesamten Test zusätzlich zu Tages-, Lauf- und Leadbudget. Dieselbe Datenbank und denselben Scope für Fortsetzungen beibehalten.
- `--budget-usd` darf ein konfiguriertes Budget nur weiter begrenzen. Der Betreiber darf die Testdatenbank oder den Budgetbereich nicht wechseln, um denselben genehmigten Test erneut zu finanzieren.

Geldlimits verhindern weitere Requests; sie sind keine vom Provider garantierte Kontosperre. Die Preis- und Bildtokenannahmen sind in `src/config.ts` und `src/provider.ts` versioniert. Der Adapter erzwingt den dokumentierten Standardtarif. Unbekannte Abrechnung bleibt sichtbar und wird nicht als kostenlos behandelt.

## Deine Entscheidung vor jeder Demo

Nach der Analyse zeigt das Review die Original-Website, Audit-Befunde, Scores, Unsicherheiten und etwaige offene Voraussetzungen. Es wird kein LLM benötigt, um dieses Review aus den gespeicherten Ergebnissen zu erzeugen.

```powershell
pnpm factory --config config/live-test.json review RUN_ID
pnpm factory --config config/live-test.json demo-decision RUN_ID approve --revision REVISION --review-hash HASH
pnpm factory --config config/live-test.json demo-decision RUN_ID reject --revision REVISION --review-hash HASH
```

Die erste Zeile zeigt den aktuellen Review-Hash und die Revision. Die beiden Entscheidungsbefehle sind Alternativen: approve erlaubt den nächsten Schritt, reject überspringt die Demo. Die Zustimmung kann die Rankingempfehlung übersteuern; sie erfindet keine fehlenden Fakten und hebt keine fachlichen oder technischen Ausschlüsse auf. Ändern sich die zugrunde liegenden Eingaben, ist eine neue Entscheidung nötig. Diese Entscheidung ist getrennt von der späteren Preview- und Outreach-Freigabe.

In der Zusammenarbeit im Chat wird jede geprüfte Firma mit Website-Link und kurzem Review vorgelegt. Die lokale CLI selbst verschickt keine Chatnachrichten und führt ohne gestarteten Lauf keine Hintergrundsuche aus.

## Ablauf und Modelle

`Scout → Audit → Qualifier → Strategist → Builder → Renderer → Browserprüfungen → QA → Preview-Freigabe → Sales → Outreach-Freigabe → manueller Export`

Renderer und Orchestrator sind normaler Anwendungscode. Laufzeitmodelle sind zentral konfiguriert:

| Stufe | Modell | Reasoning |
|---|---|---|
| Scout | gpt-5.6-luna | low |
| Audit | gpt-5.6-terra | low |
| Qualifier | gpt-5.6-luna | low |
| Strategist | gpt-5.6-terra | medium |
| Builder | gpt-5.6-luna | low |
| QA | gpt-5.6-terra | medium |
| Sales | gpt-5.6-luna | low |

Die standardmässig deaktivierte Eskalation darf nur die erlaubten höheren Modelle benutzen. Pro Schritt gelten insgesamt höchstens drei Dispatches, eine Ausgabe-Reparatur und ein Modell-Upgrade. Refusals, fehlende Quellen oder Bilder und Berechtigungsfehler lösen kein Upgrade aus. Astra wird nicht automatisch aufgerufen. Anthropic ist ohne bestätigtes Modell- und Preisprofil deaktiviert.

Belegte, an der SiteSpec behebbare QA-Probleme können höchstens zwei Reparaturrunden auslösen. Jede Runde speichert den Ausgangsstand, begrenzt die erlaubten Änderungen und führt Builder, Renderer, Browserprüfungen und QA erneut aus. Die Grenze bleibt nach einem Neustart bestehen. Infrastrukturfehler und fehlende Eingaben werden nicht durch eine Website-Reparatur verdeckt.

Die Runtime berechnet das Ranking: 25% Redesign-Bedarf, 20% Firmenwert, 15% Budgetkapazität, 15% belegter früherer Website-Agenturauftrag, 10% Website-Relevanz, 10% Conversion-Verbesserung und 5% Kontaktierbarkeit. Unbekannte Werte bleiben unbekannt; der Datensatz enthält Abdeckung und Scoreintervall. Grenzen werden ohne vorheriges Runden angewendet: unter 60 skip, 60–74 database, 75–84 research, ab 85 demo candidate. Fit-Grenzen gelten unabhängig davon.

## Textprüfung und Fehlerdiagnose

Prompt und Inhaltsprüfung verwenden dieselbe zentrale Copy-Policy. Redaktionelle Texte wählen aus ausdrücklich erlaubten neutralen Formulierungen. Firmenaussagen benötigen weiterhin passende Belege und die wörtliche Übernahme der referenzierten Fakten. Eine neutrale Formulierung erlaubt keine angehängten Zahlen, Zertifikate, Leistungen oder Garantieversprechen.

Modellantworten werden vor der semantischen Prüfung lokal mit dem zugehörigen Schritt und Prüfergebnis gespeichert. Nach einer Korrektur der Prüfung kann die vorhandene Antwort ohne weiteren Modellaufruf erneut geprüft werden. Diese Daten sind nicht veröffentlichte Entwürfe; sie werden beim Löschen des Leads mit entfernt. Fehlermeldungen behalten die eigentliche Ursache auch dann, wenn kein Reparaturversuch mehr verfügbar ist.

Prompt- oder Modelländerungen setzen die Versuchszähler desselben logischen Schritts nicht zurück. Historische Antworten, die vor dieser Änderung nicht gespeichert wurden, können nicht nachträglich rekonstruiert werden. Ein aufgebrauchtes Versuchslimit bleibt wirksam.

## Fortsetzung, Freigaben und Export

```powershell
pnpm factory --config config/live-test.json show RUN_ID
pnpm factory --config config/live-test.json resume RUN_ID --revision REVISION
pnpm factory --config config/live-test.json pause RUN_ID
pnpm factory --config config/live-test.json cancel RUN_ID
pnpm factory --config config/live-test.json preview approve RUN_ID --hash HASH --revision REVISION
```

Ein Ergebnis wird nur wiederverwendet, wenn seine relevanten Inputs und Versionen passen. Freigaben beziehen sich auf den konkreten geprüften Stand. Die Vorschau prüft auch die tatsächlichen Dateiinhalte und enthält noindex, Zugriffsschutz und deaktivierte Kontaktaktionen.

Bestätigte Eingaben lassen sich mit `revise RUN_ID --revision REVISION --file changes.json` ändern. Zulässig sind nur `campaign`, `offer`, `agency` und `recrawl`. Beispielsweise fordert `{"recrawl":true}` einen neuen Abruf an. Eine Angebotsänderung invalidiert Qualifier und nachfolgende Stufen; betroffene Freigaben werden entzogen. Anschliessend `resume RUN_ID` ausführen. Eine alte Revisionsnummer wird zurückgewiesen.

Für den kontrollierten Fixture-Test stehen die weiteren Schritte einzeln bereit:

```powershell
pnpm factory --data-dir data/my-fixture preview attach RUN_ID --url https://customer-preview.fixture.test/ --hash HASH --fixture-simulated
pnpm factory --data-dir data/my-fixture contact set RUN_ID --status approved --reason "Simulierte Testfreigabe"
pnpm factory --data-dir data/my-fixture sales draft RUN_ID
pnpm factory --data-dir data/my-fixture outreach approve RUN_ID --hash DRAFT_HASH --revision REVISION
pnpm factory --data-dir data/my-fixture export RUN_ID --kind internal
```

Sales benötigt zusätzlich eine konfigurierte Absenderidentität. `demo` liefert dafür ausdrücklich künstliche Testdaten. Live-Veröffentlichung und das Anhängen einer beliebigen externen URL als angeblich geprüft sind gesperrt. Ein lokaler Preview-Link allein genügt nicht für einen kundenfertigen Live-Export. Es wird weder automatisch gehostet noch versendet.

Leads aus einer CSV mit der Spalte `website` importieren und gespeicherte Lead-Daten löschen:

```powershell
pnpm factory lead import leads.csv
pnpm factory delete LEAD_ID
```

## Evaluation

Der Vergleich günstiger Modelle mit der nächsthöheren Stufe ist vorbereitet, aber nicht als menschlich bestanden ausgewiesen. Für den vollständigen Vergleich nach Spezifikation empfiehlt sich pro Agent eine eigene 20-Fälle-Suite mit eingefrorenen, menschlich geprüften Stufeninputs derselben repräsentativen Unternehmensfälle. Die API erlaubt auch gemischte Suites; diese ersetzen keinen vollständigen Vergleich jedes Agenten an 20 Fällen. Die vorgesehenen Kategorien sind einfache Schweizer Servicefirmen, widersprüchliche Daten, Agenturbelege, mobile Probleme, ungeeignete Integrationen und kontrollierte Injection-Fälle.

```powershell
pnpm factory eval init --suite scout-20
pnpm factory eval import --suite scout-20 case.json
pnpm factory eval run --suite scout-20
pnpm factory eval review RESULT_ID review.json
pnpm factory eval report --suite scout-20
```

Fallimport: `slot_number`, `agent`, `source_provenance`, `usage_permission_description`, strikt validiertes `input`, dessen kanonischer `input_hash`, `human_reference` und gegebenenfalls `image_attachments`. Das genaue Format und ausführbare Beispiele stehen in `tests/evaluation.test.ts`. Bild- und Quelldateien werden mit ihren Hashes eingefroren. Die Ergebnisse werden für den menschlichen Vergleich verblindet.

Live-Evaluation verlangt ein gesondertes ausdrücklich konfiguriertes `evaluationScopeId` und `evaluationMicroUsd`. Auch die vorangestellten, gecachten Fähigkeitsprüfungen der verglichenen Modelle belasten dieses Evaluationsbudget. Sie darf nicht das Budget des genehmigten POLIRE-Einzeltests benutzen. Leere Fallplätze werden nicht durch erfundene Firmen oder automatische menschliche Bewertungen ergänzt. Kosten pro akzeptiertem Ergebnis bleiben bei null akzeptierten Ergebnissen oder unbekannter Usage undefiniert.

## Daten und Grenzen

- Quellartefakte, Screenshots, Lighthouse-Berichte, Laufstände und Exporte liegen unter dem konfigurierten `dataDir`; Secrets stehen getrennt in `.env`.
- Crawler respektiert robots.txt und begrenzt Redirects, öffentliche Zieladressen, Datenmenge, Requests und Zeit. Browserzugriffe laufen durch einen kontrollierten Proxy. Teilfehler bleiben im Lead-Ergebnis sichtbar.
- Lighthouse liefert echte Messdaten oder `null` mit Fehlergrund. Ein Screenshot allein ist kein bestandener visueller KI-Audit.
- Der Renderer unterstützt die deklarativen Komponenten des Templates, keine frei generierten Skripte, Shops oder beliebigen Integrationen.
- Konkrete Firmenaussagen dürfen nur aus den zugeordneten Fakten, bestätigten Verbesserungen oder erlaubten Betreiberangaben zusammengesetzt werden. Die erste Version lässt dafür wörtliche Werte mit neutralen Verknüpfungen zu; freie faktische Paraphrasen werden konservativ zurückgewiesen. Auch redaktionelle Texte sind begrenzt, damit dieses Label keine unbelegten Firmenbehauptungen freigibt.
- Bei einer Leadlöschung bleiben die minimalen Attempt- und Budgetbelege für bereits verursachte oder unklare Kosten erhalten. Gelöschte Inhalte dürfen durch verspätete Workerantworten nicht erneut veröffentlicht werden.
- Modellqualität und kommerzieller Nutzen müssen mit menschlichen Referenzurteilen geprüft werden. Der Fixture-Lauf belegt die Verkabelung, nicht die Qualität echter Modellantworten.

Die vollständigen fachlichen Verträge stehen in `spec/factory.md` und `spec/contracts.schema.json`.
