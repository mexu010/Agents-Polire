# Prüfung vom 11. September 2026

## Aktuelle Ergänzung: Durchsatz vom 21. September 2026

Build und ESLint erfolgreich; 213 Tests in 22 Dateien bestanden (Gesamtlauf 17:44:47 Uhr, 30.11 Sekunden). Die folgenden älteren Abschnitte dokumentieren frühere Stände, nicht den aktuellen Umfang.

Der neue persistente Prospecting-Ablauf wurde zusätzlich live mit 100 unterschiedlichen URLs geprüft: 100 HTML-Vorprüfungen, vier abgeschlossene Scout/Audit/Qualifier-Reviews, 14 OAuth-Aufrufe, keine fehlgeschlagenen Reviews. HTML-Erfassung 39.547 Sekunden; summierte aktive Laufzeit inklusive Vollreviews 278.806 Sekunden. 401.738 Sekunden zwischen erstem Start und Abschluss enthalten eine Korrekturpause. Keine Behauptung von 100 vollständigen visuellen Reviews. Alle vier Runs enden bei der gesperrten Demo-Entscheidung.

Bei der ersten Live-Auswertung wurde ein Fehler im Crawl-Feldvertrag erkannt: `outcome` statt `status`. Er wurde durch Tests mit dem echten Collector-Format behoben. Die erneute Auswertung verwendete gespeicherte Quellen; keine erneuten 100 Abrufe, keine Quoten- oder Run-ID-Resets. Das Code-Review wurde nach den Korrekturen wiederholt. Ergebnisse und methodische Grenzen: [Bericht](reports/prospecting-100-2026-09-21/README.md).

Die Modellgrenzen blieben unverändert; Tagesstand nach Abschluss 90 von 100 lokalen OAuth-Aufrufen. Keine kostenpflichtigen API-Aufrufe in diesem Batch, kein Preis für OAuth-Aufrufe erfunden. Die POLIRE-Website wurde nicht verändert. Keine Demo, Veröffentlichung oder Kontaktaufnahme.

## Historischer Stand vom 11. September 2026

Umgebung: Windows, Node.js 24.19.0, pnpm 11.19.0.

## Gemeinsamer finaler Stand

Nach einheitlicher Formatierung vom Hauptprozess ausgeführt:

| Befehl | Ergebnis |
|---|---|
| `pnpm build` | Exit 0, TypeScript erfolgreich |
| `pnpm lint` | Exit 0, ESLint erfolgreich |
| `pnpm test` | Exit 0, 102 Tests in 11 Dateien bestanden |
| `pnpm factory --data-dir data/final-fixture-verified demo` | Exit 0, alle sieben Agent-Stufen, 22 echte Browserprüfungen, Testexport |
| `git diff --check` | Keine Diff-Fehler; nur Hinweise auf Windows-Zeilenenden |
| `git check-ignore .env` / `git ls-files -- .env` | `.env` ausgeschlossen und nicht versioniert |

Finaler Fixture-Lauf: `a12f0d21-648f-410e-9e4f-e7c1713bd86f`.

Die Modellantworten und Betreiberfreigaben dieses Laufs waren ausdrücklich simuliert. Rendering, Screenshots und Browserprüfungen wurden tatsächlich ausgeführt; die erzeugte Desktopaufnahme wurde zusätzlich angesehen. Es wurde keine Nachricht gesendet.

Die Tests umfassen insbesondere persistente Budgetreservierung und unklare Usage, Modell-/Tarif-/Bildhashbindung, zu grosse Inputs, fehlende Belege, unbelegte Copy, SSRF-Grenzen, Vorschauablauf und Dateiänderungen, getrennte Freigaben, Versionskonflikte, verzögerte Provider-/Crawl-/Render-/Browserantworten nach Löschung, Staging-Recovery sowie maximal zwei Site-Reparaturrunden.

## Echter Abruf ohne KI-Kosten

Die Website `https://polireagency.vercel.app` wurde tatsächlich abgerufen. Mobile und Desktop-Screenshots sowie ein Lighthouse-Bericht wurden gespeichert. Der letzte Crawler-Policy-Test ergab eine mobile Lighthouse-Performance von 88; ein früherer Lauf ergab 89. Das sind einzelne Labormessungen, keine unveränderliche Bewertung der Website.

## Noch nicht ausgeführt

- Kein kostenpflichtiger OpenAI-Aufruf und kein echter KI-End-to-End-Lauf: Der lokale API-Key wurde noch nicht bereitgestellt.
- Keine menschliche 20-Fälle-Modellbewertung: Die Import-, Vergleichs-, Review- und Auswertungsfunktionen sind implementiert und getestet; echte Referenzfälle und menschliche Urteile sind nicht erfunden worden.
- Keine Live-Veröffentlichung und kein E-Mail-Versand. Der Live-Anschluss einer ungeprüften externen Preview ist gesperrt.

Die vorbereitete `config/live-test.json` begrenzt den genehmigten Einzeltest inklusive kostenpflichtiger Startprüfungen auf denselben dauerhaften Budgetbereich mit 2 USD. Anleitung und Grenzen stehen in `README.md`.

## Echter API-Test vom 13. September 2026

Run: `b413742d-2019-4a37-a849-7338f88720a5`, URL: `https://polireagency.vercel.app/`.

- Vier kostenpflichtige Modell-/Fähigkeitsprüfungen erfolgreich.
- Echter Scout, Audit und Qualifier erfolgreich; Scout benötigte eine begrenzte Output-Reparatur.
- Audit-Qualität: 82.79/100, mobile Lighthouse-Performance: 87/100 (einzelne Labormessung).
- Abschlussstatus: `manual_review`. Angebot und wirtschaftliche Belege sind unvollständig; kein belastbarer einzelner Opportunity-Score. Berechnetes Intervall: 9.30 bis 69.30 bei 40 Prozent Abdeckung.
- Frühere Agenturbeziehung: unbekannt, keine Evidenz erfunden.
- Kosten aus dem lokalen Usage-Ledger: 54'614 Mikro-USD = 0.054614 USD inklusive Zugangsprüfung. Alle Reservationen abgerechnet, keine offenen oder unklaren Kosten. Gesamtlimit weiterhin 2 USD im ursprünglichen Scope.
- Kein Live-Builder-/QA-/Sales-Durchlauf, keine Veröffentlichung und kein Versand.

Beim Live-Test wurde ein Fehler im Browser-Proxy-Abschluss reproduziert und behoben: offene TCP-Verbindungen werden beim Schliessen beendet. Ein gezielter Regressionstest sowie der echte Crawl bestehen. Build, ESLint und alle 103 Tests bestehen. Die Eingabelimits von Scout und Qualifier sind für diesen Test auf 32'000 erhöht; Modelle und Geldlimits bleiben unverändert. Bereits gespeicherte Schritte wurden wiederverwendet.

## Betreiberentscheidung vom 13. September 2026

POLIRE-Angebot aktualisiert: bestehende Website verbessern oder komplett neu erstellen; alle Schweizer Branchen; ab 1’000 CHF, abhängig vom Umfang, ohne Preisobergrenze.

Der Live-Ablauf legt nach jeder abgeschlossenen Analyse einen Review mit Website-Link vor und wartet auf eine explizite, revisions- und hashgebundene Demo-Entscheidung. Ein hoher Score oder automatische Flags genügen nicht. Zustimmung kann weiche Rankingempfehlungen übersteuern; fehlende Fakten und harte Ausschlüsse bleiben wirksam. Ablehnung erstellt keine Demo. Quellenaktualität wird bei der Entscheidung erneut geprüft.

Beim bestehenden POLIRE-Test wurde nur der Qualifier mit dem bestätigten Angebot erneut aufgerufen; Scout und Audit blieben gespeichert. Run b413742d-2019-4a37-a849-7338f88720a5 wartet bei Revision 19 auf die Demo-Entscheidung. Die technischen/fachlichen Voraussetzungen erlauben eine Entscheidung; der Opportunity-Score bleibt wegen fehlender wirtschaftlicher Belege unsicher. Keine Demo wurde freigegeben oder erstellt.

Gesamtkosten des Test-Leads inklusive sämtlicher Zugangsprüfungen und Angebotsaktualisierung: 0.057842 USD; alle Reservationen abgerechnet, ursprüngliches Gesamtbudget weiterhin 2 USD.

Abschlussprüfung dieser Erweiterung: Build und ESLint erfolgreich; 106 Tests in 11 Dateien bestanden. Der vollständige Fixture-Demolauf mit ausdrücklich simulierter Demo-Entscheidung endet mit Exit 0.

## Freigegebener Live-Demoversuch

Der Betreiber hat die POLIRE-Demo freigegeben. Die Entscheidung wurde gegen Review c64eb05afc5a92c039778677d2d30ecf9f74dae95b0de34886a983170903738e bei Revision 19 gespeichert.

Der Strategist lieferte keine semantisch akzeptierte Ausgabe innerhalb der drei erlaubten Dispatches. Die einmalige Output-Reparatur ist aufgebraucht. Es wurde keine Demo erzeugt. Die enge redaktionelle Textprüfung lehnte zunächst eine neutrale Formulierung ab; hierfür wurde ein exaktes neutrales Template samt Regression gegen angehängte erfundene Zertifizierung ergänzt. Der dritte Versuch scheiterte erneut an der semantischen Prüfung und konnte nicht nochmals repariert werden. Prompt, Step-ID, Versuchslimits und Geldbudget wurden nicht zurückgesetzt.

Gesamtkosten des Leads einschliesslich dieser Versuche: 0.178741 USD. Die Runtime-Antworten bestanden das JSON-Schema, aber nicht die anschliessende Inhaltsprüfung; der Providerstatus succeeded bedeutet deshalb nicht, dass der Strategist-Schritt erfolgreich war.

## Grundlegende Korrektur der Textprüfung

Prompt und Runtime verwenden jetzt dieselbe zentrale Copy-Policy mit vollständigen neutralen Editorial-Vorlagen, belegten Faktenprojektionen und begrenzten Sales-Betreffrahmen. Tests prüfen jede zugelassene Vorlage sowie angehängte erfundene Firmenbehauptungen. Die bisherige unkommunizierte Wort-Whitelist wurde ersetzt.

Der Orchestrator speichert schema-valide Rohantworten samt semantischem Status und ursprünglichem Fehler. Vorhandene Antworten können nach einer Prüferkorrektur ohne neuen Provideraufruf revalidiert werden. Logische Step-IDs binden Run, Agent und tatsächliche Eingaben; Prompt- oder Modelländerungen setzen Dispatch-/Repair-Limits nicht zurück. Eindeutige historische Step-IDs werden übernommen, mehrdeutige Altdaten stoppen ohne Dispatch. Alle neuen Rohantwort-/Diagnose-Datensätze unterliegen Fence-/Löschprüfungen.

Verifikation: Build und ESLint bestanden; 113 Tests in 12 Dateien bestanden. Vollständiger Fixture-Demolauf mit echten Browserprüfungen Exit 0. Der historische POLIRE-Run wurde zusätzlich mit einem strikt gesperrten Mock-Provider fortgesetzt: 0 Provideraufrufe, erwarteter Stop am ausgeschöpften Strategist-Limit, Kosten unverändert 0.178741 USD.

Kein neuer bezahlter Live-Demoversuch. Die alten nicht gespeicherten Rohantworten fehlen weiterhin; eine echte Demo ist noch nicht erzeugt. Die Änderungen lösen den nachgewiesenen Prompt-/Prüferkonflikt und die Diagnose-/Zählerprobleme, garantieren aber nicht jede künftige Modellantwort.
