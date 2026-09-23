# Integration und Verträge · Vorschlag, nicht Ist-Zustand

## Bestehende Grenze

Laut Übergabe laufen Designrecherche → Strategist/Brief → Builder/SiteSpec → Renderer → Browserprüfungen → QA hinter einer menschlichen Demo-Entscheidung. Danach folgt die menschliche Preview-Freigabe. Textlich verworfene Designalternativen sind keine Entwurfsbilder.

Der Builder erzeugt JSON für einen begrenzten Renderer. Prompts können diesen Ausgaberaum nicht selbst erweitern. Das neue Kit ist kein direkt importierbarer Patch gegen unbekannte tatsächliche Factory-Typen. Zuerst muss der lokale Entwicklungsagent die Originalverträge lesen.

## Stufe A: Verbesserungen ohne neue Modellrolle

Bestehende Strategist-, Builder- und QA-Prompts gezielt ergänzen. Aktuellen Fingerprint über alle bereitgestellten passenden historischen Designs vergleichen, anfangs bis zu acht, statt zusätzliche Warnungen nur aus dem letzten Design abzuleiten. Die bisherige harte Wiederholungsprüfung bleibt bestehen.

`scripts/check-current-fingerprints.mjs` arbeitet offline mit genau den drei in der Übergabe beschriebenen Merkmalen: `composition`, `font_pair`, `section_order`. Es erkennt zusätzliche Wiederholungen in der übergebenen Historie. Sein JSON-Record-Rahmen mit Projekt-IDs und Zeitstempeln ist ein Kit-Eingabeformat, kein bestätigtes SQLite-Tabellenschema. Der Adapter muss die tatsächlichen gespeicherten Objekte aus der Runtime übernehmen.

Die aktuellen Enumerationen des Helfers stammen aus der Übergabe. Bei inzwischen geändertem Template zuerst an den tatsächlichen Stand angleichen und testen; nicht die Factory auf den alten Stand zurücksetzen.

## Stufe B: Mehr tatsächliche Renderfähigkeiten

Verwende eine einzige vertrauenswürdige Quelle der unterstützten Designmöglichkeiten. Ob dies eine Erweiterung des bestehenden Template-Objekts oder ein separates `RendererCapabilities`-Objekt wird, ist beim Lesen des aktuellen Codes zu entscheiden.

**Neue konzeptionelle Merkmale:** Einstiegskomposition, eigene mobile Anordnung, Abschnittsrhythmus, Typografierollen, Bildführung, Leistungsdarstellung, Dichte. Diese sind noch keine belegten SiteSpec-Felder. Ein Feld darf erst eingeführt werden, wenn Schema, Typen, Modellvertrag, semantische Prüfung, Renderer und Tests dieselbe Bedeutung verwenden.

Jede Fähigkeit benötigt:

- kanonische ID und Renderer-/Capability-Version;
- nachvollziehbare sichtbare Wirkung und erlaubte Kombinationen;
- Voraussetzungen an Inhalt und freigegebene Assets;
- Browserbilder für relevante Viewports und Tests für ungültige Kombinationen.

Nicht sämtliche Gestaltungsachsen beliebig kreuzen. Ein kontrollierter Satz zusammenpassender Strukturen ist das Ziel. Formulare, Navigation und Kontaktwege behalten ihre geprüften funktionalen Grundlagen.

`src/design-diversity.ts` im Kit beschreibt einen möglichen erweiterten Signaturvertrag. Seine Test-Capabilities sind synthetisch. Ein Produktionskatalog darf nicht aus diesem Test-JSON kopiert werden, ohne die zugehörigen Renderfähigkeiten wirklich umzusetzen.

Die Signatur wird durch Runtime-Code aus dem aufgelösten Plan erzeugt. Ein Modell darf nicht durch ein neues Label eine neue Variante behaupten. Keine automatische Umdeutung alter Signaturen: nachweisbar aus alten Briefings/Artefakten rekonstruieren oder eine sichtbare Vergleichslücke melden. Die bisherige drei-Feld-Prüfung bleibt für Altstände weiterhin nutzbar.

## Stufe C: Echte Auswahl zwischen drei Vorschauen

**Der gesamte folgende Ablauf ist eine neue, opt-in Erweiterung.** Der bisherige Modus bleibt für bestehende Jobs erhalten; alte abgeschlossene Briefings werden nicht automatisch neu gebaut.

```text
bestehende menschliche Demo-Entscheidung
  → bestehende Designrecherche mit gezielten Verbesserungen
  → NEU: design_exploration auf der vorhandenen Strategist-Rolle
  → NEU: Runtime rendert drei vergleichbare Mini-Vorschauen
  → NEU: concept_review mit menschlicher Auswahl
  → vorhandener Strategist erzeugt finales Brief für diese Richtung
  → vorhandener Builder erzeugt eine SiteSpec
  → vorhandener Renderer / Browser / QA / begrenzte Reparaturen
  → bestehende menschliche Preview-Freigabe
```

### Vertragsentwurf

`ConceptSet`, `ConceptDraft`, `ConceptPreviewManifest`, `DesignSelection` und `concept_review` sind hier **vorgeschlagene neue Namen**, keine Aussagen über existierende Definitionen.

Ein `ConceptSet` enthält drei kompakte Konzepte und Bezüge zur identischen validierten Informations-/Asset-Grundlage. Ein Konzept beschreibt Leitidee, begründete Referenzprinzipien, unterstützte Strukturentscheidungen, Trade-offs und offene Voraussetzungen. Die endgültigen JSON-Feldnamen erst gegen die realen Verträge festlegen.

Für die Mini-Vorschau: dieselbe kanonische Auswahl bestätigter Texte, zum Beispiel Einstieg plus Leistungsinformation, mit demselben Asset-Pool in allen drei Richtungen. Eine deterministische Runtime-Funktion überführt diese Auswahl und die Konzeptoptionen in einen eingeschränkten Renderauftrag. Kein beliebiges Modell-HTML, keine drei vollständigen Builder-Aufrufe. Alle Ansichten enthalten dieselben Pflichtinformationen; notwendige typografische Kürzungen bleiben semantisch gleichwertig.

Renderbarkeit der Mini-Vorschau muss bereits vor einem zusätzlichen kostenpflichtigen Schritt sichergestellt sein. Ein Konzept ohne unterstützten Renderpfad ist keine sichtbare Alternative.

Ein weiteres Strategist-Teilresultat ist kein achtes Runtime-Modell. Für Exploration wird ein eigener validierter Aufgaben-/Outputvertrag auf derselben Rolle angeschlossen. `promptFor()` allein ist keine Verdrahtung: Provideranfrage, `src/model-contracts.ts`, `src/agents.ts`, `src/fixtures.ts`, Orchestrierung, Persistenz und Ausgabe-Reparatur müssen den Aufgabenmodus kennen.

### Aufrufe, Reservierungen, Resume

Gegenüber dem bisherigen Designpfad ist in diesem Entwurf regulär ein zusätzlicher logischer Strategist-Aufruf geplant. Fehlversuche, Retries und erlaubte Reparaturen zählen weiterhin nach den vorhandenen Regeln. Kein pauschales Versprechen, dass jeder Lauf damit unter einem festen Aufrufbetrag bleibt.

Der zusätzliche Aufruf benötigt vor Dispatch das vorhandene Kontingent bzw. die bestehende Budgetreservierung. Neue Aufgaben-IDs werden innerhalb desselben Jobs/Scopes geführt, nicht als neue, ungezählte Laufwelt. Keine Erhöhung von `maxCallsPerRun`, Tages-/Gesamtgrenzen, Input-/Outputlimits oder USD-Budgets nur wegen dieses Features.

Warten auf Auswahl braucht keine wiederholten Modellaufrufe. Resume muss den gespeicherten ConceptSet-/Vorschau-Stand wiederverwenden, solange seine Abhängigkeiten stimmen. Nicht ausgewählte Konzeptvorschauen bleiben Vorschauen; sie erzeugen keine automatischen Vollwebsites.

### Freigabe und Invalidierung

Verwende den bestehenden vertrauenswürdigen Approval-Pfad. Ein Modell liefert Konzepte, keine Approval-Objekte oder Revieweridentitäten. Die Auswahl braucht mindestens eindeutige Bezüge auf Job/Revision, ConceptSet und Auswahl, Vorschau-Artefakte, Fakten-/Asset-Stand, Referenzstand und Renderer-/Capability-Version.

Eine Hashbindung allein ersetzt keine Zugriffskontrolle. Die Zustandsänderung kommt über dieselbe berechtigte Betreiberoberfläche wie bestehende Freigaben. Nicht durch eine vom Builder editierbare JSON-Datei ersetzen.

Invalidierungsregeln sollten mindestens abdecken:

| Änderung | Erwartete Wirkung |
|---|---|
| Referenzen erneuert | Konzept-/Brief-/Build-/QA-/Preview-Abhängigkeiten erneuern; bestehende Demo-Entscheidung nur entsprechend ihren tatsächlichen Grundlagen behandeln. |
| Konzeptauswahl verändert | Finales Brief, Build, QA und Preview-Freigabe sind nicht mehr aktuell. |
| Fakten/Assets der Vorschau verändert | Konzeptvergleich und Auswahl dürfen nicht unbemerkt für andere Inhalte weitergelten. |
| Capability-/Renderer-Version verändert | Betroffene Vorschau- und Buildbelege neu erzeugen; keine alte Bildfreigabe für neues Rendering. |
| Rein erlaubte SiteSpec-Reparatur | Bestehende Reparaturregeln anwenden; kein erzwungener neuer Stil, sofern die ausgewählte Richtung erhalten bleibt. |

Die genaue Reichweite gegen den bestehenden Dependency-/Revision-Mechanismus testen. Keine getrennte, widersprüchliche zweite State Machine einführen.

## Dateiverantwortung

| Vorhandene Datei | Zu prüfende Integration |
|---|---|
| `spec/contracts.schema.json` | Versionierte Definitionen, Strictness, neue Aufgabeninputs/-outputs, QA-Bildbezüge. |
| `src/contracts.ts`, `src/model-contracts.ts` | AJV, kanonische Hashes, Providerverträge, keine stillen Fremdfelder. |
| `src/agents.ts` | Prompt-/Aufgabenrouting, Fakt-/Referenz-/Capability-Validierung, Outputverarbeitung. |
| `src/fixtures.ts` | Echte Live-Eingabeverdrahtung und getrennte synthetische Fixtures. |
| `src/design-research.ts` | Auswahl und zusätzliche echte Bildbelege innerhalb bestehender Grenzen. |
| `src/design-policy.ts` | Mehrprojektprüfung, Versionierung und Adapter für Signaturen. |
| `src/copy-policy.ts` | Natürlichere Texte mit weiterhin überprüfbaren konkreten Claims. |
| `src/renderer.tsx`, `src/design-styles.ts` | Tatsächlich unterschiedliche Darstellungen und Mini-Vorschauen. |
| `src/browser-tests.ts` | Aktuelle Artefakt-/Viewportbelege und deklarierter Preview-Modus. |
| `src/orchestrator.ts`, `src/store.ts` | Persistenz, neue Teilaufgabe, Auswahl, Quoten, Resume, Invalidierung und Fencing. |
| `src/evaluation.ts` und zugehörige Tests | Vergleichsprotokoll und menschliche Auswertung, keine neue Benchmark-Plattform. |

## Keine neue Veröffentlichungskette

Das Feature produziert weiterhin kontrollierte Vorschauen. CMS, Hosting, Domain, tatsächliche Kundenfreigabe und Betrieb werden dadurch nicht automatisch implementiert. Der separate Lanz-Auftrag steht in einer eigenen Datei.
