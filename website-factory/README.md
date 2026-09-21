# POLIRE Website Factory

**Neue lokale Designvorschauen:** [15 Demos vom 21. September 2026](demos/2026-09-21/README.md). Mit `pnpm demos` die fertige Übersicht lokal öffnen; `pnpm demos:build` erstellt sie erneut. Diese Entwicklungsentwürfe sind getrennt von den gespeicherten automatischen Factory-Läufen.

Lokale TypeScript-Anwendung mit sieben Agent-Stufen, SQLite, einem deklarativen React-Renderer und echten Browserprüfungen. Das Projekt ist von der bestehenden POLIRE-Website getrennt. Es enthält keinen E-Mail-Versand.

## Schnellstart mit ChatGPT-Anmeldung

Für Live-Agenten nutzt die Factory die Anmeldung der lokalen Codex CLI. Ein OpenAI-API-Key ist dafür nicht nötig. Installiere die Codex CLI, melde dich im Browser bei ChatGPT an und prüfe den Status:

```powershell
./scripts/setup.ps1
pnpm login
pnpm login:status
pnpm preflight
pnpm factory --config config/live-test.json doctor --mode live
```

`pnpm login` startet den offiziellen `codex login`-Ablauf; Codex verwaltet und erneuert die Anmeldung selbst. Die Factory liest, kopiert und speichert keine OAuth-Tokens. `doctor` prüft bei `authentication: "chatgpt_oauth"` nur die lokale Codex-Anmeldung und Konfiguration, ohne Modellaufruf. Eine Anmeldung per API-Key in der Codex CLI ist für diesen Modus nicht geeignet. [Codex-Authentifizierung](https://learn.chatgpt.com/docs/auth) und [App Server](https://learn.chatgpt.com/docs/app-server) beschreiben die zugrunde liegenden Abläufe.

### Ausführbare Werkzeuge und Recherche

Die Factory enthält eine begrenzte Scout-Werkzeugschleife: Das Modell entscheidet zwischen Suche, Quellenabruf, Abschluss und Stopp. Entscheidungen, Werkzeugergebnisse, Fehler und Nutzung werden in SQLite gespeichert. Die übrigen Agent-Stufen verwenden ihre bestehenden validierten Verträge; Renderer und Orchestrator bleiben normaler Anwendungscode.

```powershell
./scripts/check.ps1
pnpm discover --mode fixture --run-id research-test --objective "Schweizer Dienstleister" --analyse
pnpm runs
pnpm trace research-test
pnpm demo
```

`preflight` prüft lokal und kostenlos. `discover --mode fixture` simuliert Suche und Modellantworten ausdrücklich. `--analyse` führt die gefundenen Kandidaten bis zum Review aus und wartet auf deine Demo-Entscheidung. `demo` prüft zusätzlich den Renderer und Browser tatsächlich mit Testdaten. Diese Tests belegen keinen erfolgreichen Live-Modelllauf.

Für bekannte URLs und CSV-Stapel:

```powershell
pnpm analyse --config config/live-test.json --mode live --run-id mein-lead --domain https://polireagency.vercel.app/
pnpm batch --config config/live-test.json --mode live --batch-id mein-stapel --file leads.csv
pnpm review --config config/live-test.json RUN_ID
pnpm report --config config/live-test.json RUN_ID
pnpm trace --config config/live-test.json RUN_ID
```

CSV benötigt die Spalte `website`. Stapel sind auf 50 Einträge begrenzt, dedupliziert und sequenziell. Derselbe Stapelname behält seine URLs und Lauf-IDs; erfolgreiche Einträge werden nicht nochmals ausgeführt. Nur `--retry-failed` nimmt fehlgeschlagene Einträge erneut auf. `report` schreibt eine Datei mit Original-Link, Befunden und offenen Voraussetzungen, auch bei unvollständigen Läufen.

### Interessenten prüfen und selbst anrufen

Der neue Schnelllauf verarbeitet bis zu **100 unterschiedliche Firmen**. Sechs parallele HTML-Prüfungen lesen je höchstens zwei Seiten ohne Modellaufruf. Nur die stärksten statischen Hinweise kommen in eine begrenzte Warteschlange für Scout, visuellen Audit und Qualifier; davon laufen höchstens zwei Firmen gleichzeitig. Die Sortierpriorität der Vorprüfung ist **kein Qualitäts- oder Opportunity-Score**. Fehlende Tags und alte Frames liefern Hinweise, keine fertige Designbewertung. Unklare/gesperrte Seiten bleiben in der Warteschlange; «kein Signal» bedeutet nicht «gute Website».

```powershell
pnpm prospect --config config/prospecting-fast.json --mode live --batch-id mein-100er-lauf --file leads.csv --max-reviews 6
```

CSV: eine Spalte `website`. Gleiche Firma mit `www`, ohne `www`, HTTP/HTTPS oder mehreren Pfaden zählt einmal; die erste angegebene Adresse bleibt das Abrufziel. `--max-reviews 0` führt nur die Vorprüfung aus. `--screen-concurrency` erlaubt 1–8 HTML-Arbeiter. Wiederaufnahme mit exakt demselben Befehl verwendet die gespeicherten Ergebnisse und dieselben Lauf-IDs. URLs, Auswahlgrenze und Modus sind an den Stapel gebunden. Fehlgeschlagene Reviews werden nicht automatisch erneut bezahlt. Vollständige, höchstens sieben Tage alte Reviews derselben Installation können wiederverwendet werden.

Die Ergebnisse erscheinen unter `data/live-test-polire/prospecting/`: Markdown-Auswahl mit Original-Links und Einzelreviews sowie JSON mit allen Einträgen, offenen Fällen, Laufzeit und Nutzung. Die Auswahl sucht vorhandene Reviews mit Qualität bis 65/100 und konkreten Befunden; sie ersetzt weder das unveränderte Opportunity-Ranking noch die Betriebsprüfung. Für einen Anruf bleibt eine aktuelle Aktivitätsquelle nötig.

Nach einer Korrektur der Vorprüfungslogik kann derselbe Befehl mit `--recheck-screening` die bereits gespeicherten HTML-Quellen lokal neu auswerten. Diese Vorprüfung verwendet nur gespeicherte Dateien und wiederholt keine abgeschlossenen Agent-Reviews. Neu erkannte Kandidaten können danach noch freie Plätze innerhalb des ursprünglichen `--max-reviews` belegen, inklusive neuer Browser- und Modellaufrufe; dabei gelten weiterhin alle Grenzen. Der Zeitpunkt des ursprünglichen Quellenabrufs bleibt erhalten.

`config/prospecting-fast.json` nutzt die bestehende Datenbank und OAuth-Grenzen. Es spart im Vollreview den Lighthouse-Test aus, erstellt aber weiterhin mobile und Desktop-Aufnahmen. Performance bleibt deshalb unbekannt; es wird kein Messwert erfunden. Die 100 HTML-Vorprüfungen benötigen keine Modellaufrufe. 100 vollständige Reviews mit drei Agents würden mindestens 300 Aufrufe vor Reparaturen erfordern. Dieses Profil erhöht keine Grenze und verschickt nichts.

Der Schnelllauf verarbeitet eine bereitgestellte URL-Liste. Die vollautomatische Suche benötigt weiterhin die separat konfigurierte Suchschnittstelle; für den dokumentierten Test wurde die Liste hier im Chat recherchiert.

Der erste echte Such- und Review-Stapel vom 21. September 2026 liegt unter [reports/prospecting-2026-09-21](reports/prospecting-2026-09-21/README.md). Die Firmen wurden im Chat recherchiert, anschliessend mit Scout, Audit und Qualifier über OAuth geprüft. Die Liste unterscheidet aktuelle Aktivitätssignale von unbekanntem Betriebsstatus. Ein auffindbarer Kontakt ist keine Bestätigung von Interesse oder Budget.

Der [zweite Durchlauf mit zehn weiteren Firmen](reports/prospecting-2026-09-21-round2/README.md) enthält zusätzliche Reviews, Quellen und Hinweise zu aktuellen Betriebsferien. Die früheren Ergebnisse bleiben separat erhalten.

`config/prospecting.json` prüft bekannte URLs ohne kostenpflichtige Such-API. Die Konfiguration nutzt absichtlich dieselbe Datenbank wie `live-test.json`, damit bestehende OAuth-Zähler erhalten bleiben. Sie erlaubt bis zu drei HTML-Seiten je Firma und höhere Eingabelimits für die Quellen und Screenshots (Scout/Qualifier 64’000, Audit 80’000 Tokens). Die Grenzen für Aufrufe, Wiederholungen und Freigaben bleiben unverändert.

```powershell
pnpm batch --config config/prospecting.json --mode live --batch-id prospects-2026-09-21-a --file reports/prospecting-2026-09-21/leads-a.csv
pnpm batch --config config/prospecting.json --mode live --batch-id prospects-2026-09-21-b --file reports/prospecting-2026-09-21/leads-b.csv
```

Nach dem Review ruft der Betreiber selbst an und hält das Ergebnis fest. Erst wenn der Kunde eine Demo möchte, wird sie ausdrücklich freigegeben. Die Review-Stapel erzeugen keine Demo und führen keine Kontaktaufnahme aus. Eine erneute Ausführung auf derselben Installation verwendet die gespeicherten Läufe; auf einer neuen Installation sind diese Befehle echte neue OAuth-Läufe.

Automatische Live-Suche benötigt zusätzlich `BRAVE_SEARCH_API_KEY` ausschliesslich in `.env` sowie `research.enabled: true`, einen positiven `research.queryCostMicroUsd` und USD-Budgets in der JSON-Konfiguration. Dieser Wert muss den maximalen Preis einer Suchanfrage deines aktuellen Tarifs abdecken (1 USD = 1’000’000 Mikro-USD). Suchkosten werden anhand dieses konfigurierten Tarifs verbucht; sie sind keine vom Suchanbieter zurückgemeldete Rechnungsposition. Ohne Preis, Schlüssel und Gesamtbudget wird die Suche blockiert. Direkte Website-URLs benötigen keinen Suchschlüssel.

Die konfigurierbaren Recherchegrenzen sind `maxSteps` (höchstens 6), `maxQueries` (5), `maxResults` (10 pro Suche) und `maxPages` (5). Dieselbe Lauf-ID und dasselbe Ziel verwenden, um gespeicherte Ergebnisse weiterzuverwenden. `discover --retry-stopped` erlaubt eine ausdrückliche Fortsetzung nach geeigneten Modell- oder Werkzeugfehlern; offene Kostenreservierungen, Refusals und ausgeschöpfte Grenzen bleiben gesperrt. Eine Fortsetzung setzt keine Zähler zurück.

### Betrieb einer Firma vor einer Live-Demo bestätigen

Eine erreichbare Website beweist keinen aktiven Betrieb. Vor einer Live-Demo ist deshalb eine datierte Quellenprüfung erforderlich. Lege lokal eine JSON-Datei mit `status` (`operating`, `uncertain` oder `closed`), `reason`, `sourceUrl`, `excerpt`, `activityDate` und `checkedAt` an. Die Angaben müssen eine tatsächlich geprüfte Quelle wiedergeben; unbekannte Aktivität bleibt `uncertain`.

```powershell
pnpm business-review --config config/live-test.json RUN_ID --revision REVISION --file business-review.json
pnpm review --config config/live-test.json RUN_ID
pnpm demo-decision --config config/live-test.json RUN_ID approve --revision NEUE_REVISION --review-hash NEUER_HASH
pnpm preview --config config/live-test.json RUN_ID
```

Eine Prüfung darf höchstens 30 Tage alt sein, die belegte Aktivität höchstens 366 Tage. Änderungen erzeugen einen neuen Review-Hash. Die Prüfung ist eine nachvollziehbare Betreiberbestätigung, keine automatische Garantie über den Firmenstatus. Das alte Budget von 5 USD galt ausschliesslich den zehn Reviews und ist keine Freigabe für neue Such- oder Demo-Läufe.

Voraussetzungen: Node.js 24 oder neuer, pnpm und Chrome oder Playwright Chromium.

Die Startskripte verwenden zusätzlich den Zertifikatsspeicher des Betriebssystems (`--use-system-ca`). So können beispielsweise unter Windows bereits vertrauenswürdige Netzwerkzertifikate genutzt werden. TLS-Zertifikatsprüfungen bleiben aktiv. Die POLIRE-Testkonfiguration erlaubt pro Analyse-Stufe ein konservatives Eingabelimit von 48’000 Tokens für Quellen, Schema und Screenshots; die Aufrufgrenzen bleiben unverändert.

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

## Echter POLIRE-Test mit Codex OAuth

Die vorbereitete `config/live-test.json` wählt ausdrücklich `authentication: "chatgpt_oauth"`. Die Agenten nutzen damit das Codex-Kontingent des angemeldeten ChatGPT-Kontos. Es gelten die Codex-Nutzungsgrenzen des Kontos; die Factory kann daraus weder einen USD-Preis noch eine API-Rechnung ableiten. Die gespeicherten historischen USD-Budgets betreffen frühere API-Läufe und bleiben für deren Nachvollziehbarkeit erhalten. Für neue direkte URL-Läufe mit OAuth sind sie kein Modellkostenlimit.

```powershell
pnpm factory --config config/live-test.json doctor --mode live
pnpm factory --config config/live-test.json run --domain https://polireagency.vercel.app --mode live
```

Die Variante ohne `www` wurde verwendet, weil die angegebene `www`-Variante beim Abruf einen TLS-Fehler lieferte. TLS-Prüfungen bleiben aktiviert.

`doctor` prüft die OAuth-Anmeldung und den von Codex angebotenen Modellkatalog inklusive Reasoning und Bildeingabe, ohne Inferenz. Ob ein konkreter Modellaufruf gelingt, zeigt erst der Lauf; es gibt keinen stillen Modellwechsel und keinen automatischen Rückfall auf einen API-Key.

Der echte Lauf bewertet die vorhandenen Belege und legt nach der Analyse immer ein Review mit Firmen-URL vor. Erst eine ausdrückliche, an dieses Review gebundene Betreiberentscheidung erlaubt die Demo-Erstellung. Ein hoher Score, autoGenerate oder --experimental ersetzen im Live-Modus diese Entscheidung nicht. Fehlende Fakten werden nicht erfunden.

Das bestätigte POLIRE-Angebot ist in `config/live-test.json` hinterlegt: Verbesserung bestehender Websites oder komplette Neuerstellung, für alle Schweizer Branchen, ab 1’000 CHF abhängig vom Projektumfang und ohne feste Preisobergrenze. Eine leere Branchenliste bedeutet keine Branchenbeschränkung. Dieser Angebotspreis ist kein Nachweis für das Budget einer gefundenen Firma. Eine bestätigte Absenderidentität muss vor einem Verkaufsentwurf zusätzlich hinterlegt werden.

### Grenzen und Abrechnung

- OAuth-Aufrufe haben lokale Zähler für Versuche pro Lauf, Tag und insgesamt. Diese begrenzen die Zahl der gestarteten Modellaufrufe, nicht das Kontingent oder die Abrechnung des ChatGPT-Kontos.
- Die zentrale Konfiguration enthält `oauth.maxCallsPerRun` (24), `maxCallsPerDay` (100), `maxCallsTotal` (300) und einen dauerhaften `scopeId`. Die gespeicherten Grenzen lassen sich durch einen Neustart nur senken. Die Zähler erfassen logische Codex-Turns, keine garantierte Anzahl interner Modellrequests.
- Der konfigurierte Modell-Timeout begrenzt die Wartezeit. `max_output_tokens` wird bei der OAuth-Transportantwort lokal geprüft; es ist keine garantierte serverseitige Ausgabesperre.
- `max_input_tokens` prüft die von der Factory übergebene Nutzlast. Codex ergänzt eigenen Kontext; das Feld ist deshalb keine harte Obergrenze für sämtliche tatsächlich verwendeten Eingabetokens.
- Usage und mögliche Fehler bleiben in `trace` sichtbar. Bei OAuth gibt es keinen erfundenen USD-Betrag pro Modellaufruf.
- `--budget-usd` senkt nur konfigurierte Geldbudgets für den ausdrücklichen API-Key-Modus oder die optionale Brave-Suche. Es setzt kein OAuth-Modelllimit.
- Bei `authentication: "api_key"` gelten weiterhin die konfigurierten USD-Reservationen für OpenAI-API-Aufrufe. Dieser Modus muss ausdrücklich gewählt werden und ist kein automatischer Rückfall.

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

Die OAuth-Evaluation verwendet denselben dauerhaften Codex-Aufrufbereich wie die Factory. API-Dollar-Kosten bleiben dabei unbekannt (`null`); ein Preisvergleich aus API-Tokenpreisen wäre keine tatsächliche Abrechnung. Im ausdrücklich gewählten API-Modus verlangt die Evaluation weiterhin ein gesondertes `evaluationScopeId` und `evaluationMicroUsd`. Leere Fallplätze werden nicht durch erfundene Firmen oder automatische menschliche Bewertungen ergänzt. Kosten pro akzeptiertem Ergebnis bleiben bei null akzeptierten Ergebnissen oder unbekannter Usage undefiniert.

Ein vollständiger Modellvergleich mit 20 Fällen benötigt mindestens 40 logische Aufrufe. Dafür vor dem ersten Lauf einen entsprechend freigegebenen OAuth-Limitbereich konfigurieren; das Standardlimit von 24 pro Lauf stoppt vorher. Bestehende begrenzte Läufe werden nicht automatisch erweitert.

## Daten und Grenzen

- Quellartefakte, Screenshots, Lighthouse-Berichte, Laufstände und Exporte liegen unter dem konfigurierten `dataDir`; die ChatGPT-Anmeldung verwaltet Codex. Nur der optionale Brave-Schlüssel steht in `.env`.
- Crawler respektiert robots.txt und begrenzt Redirects, öffentliche Zieladressen, Datenmenge, Requests und Zeit. Browserzugriffe laufen durch einen kontrollierten Proxy. Teilfehler bleiben im Lead-Ergebnis sichtbar.
- Lighthouse liefert echte Messdaten oder `null` mit Fehlergrund. Ein Screenshot allein ist kein bestandener visueller KI-Audit.
- Der Renderer unterstützt die deklarativen Komponenten des Templates, keine frei generierten Skripte, Shops oder beliebigen Integrationen.
- Konkrete Firmenaussagen dürfen nur aus den zugeordneten Fakten, bestätigten Verbesserungen oder erlaubten Betreiberangaben zusammengesetzt werden. Die erste Version lässt dafür wörtliche Werte mit neutralen Verknüpfungen zu; freie faktische Paraphrasen werden konservativ zurückgewiesen. Auch redaktionelle Texte sind begrenzt, damit dieses Label keine unbelegten Firmenbehauptungen freigibt.
- Bei einer Leadlöschung bleiben die minimalen Attempt- und Budgetbelege für bereits verursachte oder unklare Kosten erhalten. Gelöschte Inhalte dürfen durch verspätete Workerantworten nicht erneut veröffentlicht werden.
- Modellqualität und kommerzieller Nutzen müssen mit menschlichen Referenzurteilen geprüft werden. Der Fixture-Lauf belegt die Verkabelung, nicht die Qualität echter Modellantworten.

Die vollständigen fachlichen Verträge stehen in `spec/factory.md` und `spec/contracts.schema.json`.
