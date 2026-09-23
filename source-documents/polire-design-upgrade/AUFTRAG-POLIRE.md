# Arbeitsauftrag · POLIRE Designqualität und Vielfalt

Du erweiterst die vorhandene POLIRE Website Factory. Du baust keine neue Multi-Agent-Plattform und keine zweite Produktarchitektur. Lies diesen Auftrag zusammen mit der technischen Übergabe vom 22.09.2026 und prüfe dann den aktuellen Quellcode. Die Übergabe ist ein datierter Ausgangspunkt, kein Ersatz für den heutigen Repository-Zustand.

## Ziel und Erfolgskriterium

Erzeuge passende, klar unterschiedliche und visuell kontrollierte Kundenentwürfe. Vielfalt muss zwischen verschiedenen Kunden sichtbar werden; innerhalb einer Website sind Konsistenz, Lesbarkeit und funktionierende Nutzerwege wichtiger als Abwechslung um ihrer selbst willen.

Der Nachweis besteht aus tatsächlichen Render-Artefakten, gebundenen Bildern, überprüfbaren Tests und menschlichen Vergleichen. Selbst vergebene Agenten-Qualitätsnoten, umbenannte Themes und eine erfolgreiche Typprüfung reichen nicht.

## 0. Arbeitsraum und Grenzen zuerst prüfen

Der in der Übergabe aktive Quellbaum liegt unter:

`C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory`

Prüfe realen Arbeitsordner, Branch, Commit und Git-Status. Bewahre uncommittete und unversionierte Arbeiten. Kein automatischer Checkout des alten Übergabe-Commits, kein Reset und keine ungeprüfte Synchronisierung mit `ChatGPT-Polire/`. Die bestehende Agenturwebsite `polire-website/` bleibt unberührt.

Das Kit-Skript `source-preflight.mjs` unterstützt die Bestandsaufnahme, ersetzt aber nicht das Lesen des Codes.

Lies in dieser Reihenfolge: README, Konfiguration, zentrale Verträge, Orchestrator, `src/fixtures.ts`, Designrecherche, Designpolicy, Copy-Policy, Rollenprompts, Renderer/Styles, Browserprüfungen und passende Tests. `buildAgentInput()` in `src/fixtures.ts` ist auch echte Live-Eingabeverdrahtung.

Unterscheide ausdrücklich:

- Factory: strukturierte Rollenoutputs, deklarative kontrollierte Vorschauen.
- 15er-Galerie: eigene individuelle Entwicklungsdemos, kein automatisch erbrachter Factory-Qualitätsnachweis.
- Lanz: eigenständige Kundenanwendung. Kein Factory-Theme-Update verändert sie automatisch.

Du darfst keine vorhandenen Modelle, Tools, Dateien oder Rendererfähigkeiten erfinden. Neue Namen und Schemas werden als neu gekennzeichnet und zusammen mit ihrer Implementierung eingeführt.

## 1. Einen konkreten Fehlerweg nachvollziehen

Verwende zuerst vorhandene geeignete, datenschutzgerecht freigegebene Traces und Artefakte oder lokale Fixtures. Starte nicht stillschweigend einen Live-Lauf.

Dokumentiere für einen Designfall:

Welche akzeptierten Fakten und freigegebenen Assets lagen vor? Welche Referenzen wurden wirklich geöffnet? Welche Bilder gingen als echte, hashgebundene Bildeingaben an den Strategist? Was stand im DesignPlan? Was konnte der Renderer davon darstellen? Was erreichte QA? Welche wesentlichen Gestaltungseigenschaften gingen zwischen Plan und Rendern verloren?

Ordne jedes Problem einem Ort zu: Input-/Asset-Lücke, Recherche, Prompt, Vertrag, Renderfähigkeit, Eingabeverdrahtung, technische Prüfung oder visuelles Urteil. Belege Diagnose und Grenzen. Eine nur vermutete Ursache bleibt als Hypothese markiert.

Liefere vor dem grösseren Umbau einen konkreten Datei- und Migrationsplan. Danach arbeite inkrementell weiter; keine endlose reine Planungsphase.

## 2. Aktuelle Rollen verbessern, nicht neue freie Tools vortäuschen

Die Factory-Rollen liefern JSON; normale Runtime-Funktionen führen Werkzeuge aus. Strategist und QA erhalten durch einen Prompt keine Websuche oder freie Browsersteuerung. Die OAuth-Werkzeuggrenzen bleiben erhalten.

Integriere die gegen den aktuellen Vertrag formulierten Ergänzungen aus:

`prompts/common.design.md`
`prompts/strategist.current-contract.md`
`prompts/builder.design.md`
`prompts/qa.design.md`

Übernimm keine neuen Ausgabefelder allein über Prompts. Prüfe die tatsächlichen Schemas und semantischen Validatoren. Erhalte die gemeinsamen Regeln, Datenhülle, Schweizer Schreibweise und bestehenden Fakten-, Quellen-, Asset- und Freigabegrenzen.

Die Phase-2-Ergänzung `prompts/strategist.exploration-proposal.md` darf erst nach Einführung ihres Vertrags und ihrer Runtime-Verarbeitung aktiviert werden.

## 3. Recherche innerhalb bestehender Grenzen ausbauen

Erweitere `src/design-research.ts` und verwende bestehenden Crawler, Recherche-Collector, Evidence/ImageBinding, Cache und Budgets weiter. Die reguläre Scout-Rechercheschleife muss nicht zu einem neuen Browseragenten werden.

Behalte standardmässig zwei und maximal drei Referenzen. Wähle nach Möglichkeit eine passende Branchenreferenz und eine begründet passende Nachbarbranchen- oder Kontrastreferenz. Nicht alle Kunden derselben Branche reflexartig mit denselben Kandidaten beliefern. Fehlende Vielfalt ehrlich dokumentieren, statt Quoten um jeden Preis zu erfüllen.

Ergänze mobile Ansichten gezielt. Mehr Ansichten dürfen die bestehenden kumulativen Request-, Byte-, Zeit-, Bildinput- und Suchbudgets nicht verdeckt vervielfachen. Wenn nur eine Desktopansicht gelingt, gib diese Einschränkung an.

Suche bleibt ohne bestätigte Konfiguration, Abfragepreis und Budget deaktiviert. Ein Katalogabruf ist keine freie Websuche. Explizite Referenz-URLs bleiben vorrangig, Netzwerkschutz/Robots/TLS bleiben aktiv. Fehlende nutzbare Quellen bleiben Lücken oder führen entsprechend dem bestehenden Ablauf zu `needs_input`.

Dokumentiere Herkunft, tatsächlichen Abruf, Branche/Passung, Bildbelege, konkrete Beobachtungen, übertragbare Prinzipien und unpassende Aspekte. Keine pauschale „beste Website“-Kennzeichnung. Referenzbilder werden niemals automatisch Kundenassets.

## 4. Renderfähigkeiten und Vertrag gemeinsam erweitern

Untersuche `src/renderer.tsx`, `src/design-styles.ts`, `src/design-policy.ts`, das live verwendete Template und den zentralen Schema-Vertrag.

Die vier bisherigen Kompositionen und die erlaubten Komponenten dürfen nicht bloss umbenannt werden. Erweitere gezielt echte Gestaltungsmöglichkeiten: unterschiedliche Hero-Anordnungen, inhaltlich verschiedene Leistungsdarstellungen, Bildausschnitte/Positionierungen, Typografierollen, Abschnittsrhythmus und eigene mobile Anordnungen.

Beginne mit wenigen nachgewiesen unterschiedlichen, gut getesteten Möglichkeiten statt einem willkürlichen kombinatorischen Baukasten. Jede neue deklarierbare Option braucht Rendering, Einschränkungen, Fixtures, Browserbilder und klaren Fallback bei ungeeigneten Assets. Inkompatible Kombinationen werden vor dem Modelloutput begrenzt oder danach zurückgewiesen.

Lege eine versionierte Capability-Quelle an oder erweitere das vorhandene Template entsprechend. Sie wird von Anwendungscode gepflegt; Modelle dürfen keine Capability-IDs erfinden. Der Builder darf nur tatsächlich unterstützte Möglichkeiten auswählen. Rendering darf unbekannte Wünsche nicht schweigend auf das alte Standardlayout zurückfallen lassen.

Nutze die vorhandenen 15 Demos als interne Anschauung für wiederverwendbare Gestaltungsprinzipien. Prüfe ihre Dateien zuerst. Kopiere weder sämtliche individuellen Renderer noch Fonts/Assets ohne passende Freigabe in die Factory.

Ein fotoarmes, typografisch eigenständiges Design ist ein expliziter Anwendungsfall, weil neue Live-Läufe laut Übergabe mit leerem `approvedAssets` beginnen können.

## 5. Texte freier gestalten, Faktenbindung beibehalten

Die feste Auswahl neutraler Formulierungen darf nicht einfach entfernt werden. Erweitere `src/copy-policy.ts`, die verwendeten Verträge und die Prompts gemeinsam.

Ziel: redaktionelle Formulierung und konkrete Unternehmensbehauptung getrennt bewerten. Konkrete Aussagen benötigen eng passende akzeptierte Fakten. Ein Satz über Erfahrung, Leistungen, Personen oder besondere Qualität bleibt eine Aussage, auch wenn er in einer Überschrift steht.

Ein im neuen Vertrag als redaktionell markierter Text ist nicht automatisch faktfrei. Prüfe implizite Zusagen und unbelegte Superlative mit. IDs allein beweisen keine inhaltliche Unterstützung. Bei unsicherer Bindung bleibt die Behauptung offen oder wird gestrichen, nicht sprachlich kaschiert.

Ergänze Negativtests für frei erfundene Bewertungen, Preise, Erfahrung, Services, Zertifikate und eine falsche Zuordnung echter Fact-IDs. Erhalte Asset-Freigaben und die Kennzeichnung vorhandener Symbolbilder.

## 6. Vielfalt über die bereitgestellte Historie prüfen

Erweitere den vorhandenen Fingerprint kontrolliert und versioniert. Nutze nicht nur den letzten, sondern die tatsächlich bereitgestellten jüngeren vergleichbaren Entwürfe, zunächst bis zu acht. Gleiche Kundenprojekte und Reparaturstände dürfen sich nicht versehentlich selbst zur Neuerfindung zwingen.

Das Kit-Modul `src/design-diversity.ts` kann als getesteter Ausgangspunkt dienen. Schreibe den Adapter gegen die tatsächlichen Factory-Typen. Leite Merkmale aus dem aufgelösten Rendererplan ab, nicht aus frei erfundenen Labels des Strategists.

Behalte die bisherige harte Wiederholungsprüfung zunächst bei. Zusätzliche portfolioübergreifende Ähnlichkeit ist eine begründete Warnung, keine objektive Qualitätsnote. Weitergehende harte Regeln nur bewusst einführen und auf sinnvolle Markenfamilien-Ausnahmen prüfen.

Alte Signaturen werden nur aus vorhandenem, validierbarem Stand migriert. Fehlende Felder sind keine Neuheit. Berichte Anzahl vergleichbarer Fälle und Lücken. Wiederholungswarnungen dürfen keine unbegrenzten Reparaturen auslösen oder automatisch Stilwechsel in bereits freigegebenen Projekten erzwingen.

## 7. Echte Konzeptvorschauen als opt-in Erweiterung

Die bisherigen zwei verworfenen Alternativen im DesignPlan sind textlich. Stelle sie nicht als gerenderte Entwürfe dar.

Implementiere den neuen Modus aus `docs/PIPELINE-UND-VERTRAEGE.md` erst nach den grundlegenden Capability-/Contract-Änderungen: ein kompakter zusätzlicher Strategist-Schritt erzeugt drei unterstützte Konzepte; Runtime-Code rendert vergleichbare Mini-Vorschauen; der Mensch wählt; erst danach folgen das finale Brief und der normale Builder.

Kein achtes Runtime-Modell, kein neuer Auth-Mechanismus, keine drei ungebremsten Vollbuilds. Der zusätzliche Schritt bleibt auf dem bestehenden Strategist-Modell und zählt vollständig gegen vorhandene Versuchs- und Kontingentgrenzen. Ohne verfügbares Kontingent wird nicht gestartet.

Drei Konzepte sollen sich als Studio-Startregel in mindestens vier Merkmalen unterscheiden, darunter mindestens zwei strukturelle. Reine Farbwechsel zählen nicht. Erweist sich der Rendererraum dafür als zu klein, dokumentiere eine Fähigkeitslücke statt Unterschiede zu erfinden.

Die gemeinsame Vorschaugrundlage enthält dieselben belegten Informationen und freigegebenen Assets. Inhaltliche Kürzung darf keine Richtung künstlich besser aussehen lassen. Wähle eine vergleichbare Detailtiefe. Noch nicht implementierte Interaktionen sind klar als ungetestet markiert.

Erweitere Freigaben über den bestehenden vertrauenswürdigen Runtime-Pfad. Modelle vergeben weder Revieweridentität noch Approval-IDs. Auswahl ist an relevante Revisionen, Konzepte, Render-/Capability-Versionen, Referenzen, freigegebene Inhalte/Assets und Vorschauartefakte gebunden. Wartezustände verbrauchen keine weiteren Modellaufrufe. Veränderte Grundlagen entziehen abhängige Freigaben.

## 8. QA muss das sichtbare Ergebnis prüfen

Erweitere `src/browser-tests.ts`, QAInput, `src/fixtures.ts`, Provider-Bildeingabe und `prompts/qa.ts` gemeinsam, soweit betroffen. Ein Dateipfad ist keine Bildeingabe. Bilder brauchen eindeutige Herkunft und Binding; entfernte oder fehlende Bilder dürfen nicht als angesehen gelten.

Die bestehende QA bekommt laut Übergabe keine externen Referenzbilder. Für einen Vergleich müssen ausgewählte, budgetierte Referenzbilder tatsächlich zusätzlich angeliefert werden. Andernfalls prüft QA nur Briefing und Artefakt. Vergleichsziel ist die Umsetzung ausgewählter Gestaltungsprinzipien, nicht Pixelkopie eines fremden Designs.

Prüfe technische Fehler getrennt von visuellen Entscheidungen: Textumbrüche, Bildbeschnitt, Informationshierarchie, Abschnittsrhythmus, Mobile-Komposition, Lesbarkeit, Hauptaktion, fehlende Inhalte, tote Links, Fokus und Layoutüberlauf. Bewegungsqualität nicht aus einem Standbild behaupten.

Eine deaktivierte Kontaktaktion kann in der geschützten Factory-Vorschau genau richtig sein. Beachte den deklarierten Modus. Keine echten Anfragen/Buchungen oder Mailaktionen aus Tests auslösen. Die separat laufende Lanz-Anwendung hat andere Kontakt-/Formularzustände.

Jeder Gestaltungsbefund braucht betroffenen Viewport und Ort, tatsächliche Bild-/Artefaktreferenz, Beobachtung, priorisierten Änderungsvorschlag und prüfbares Abnahmekriterium. Wahrnehmungsurteile sind solche; Conversion-Wirkungen bleiben Hypothesen ohne Messdaten.

Erhalte maximal zwei Reparaturrunden und erlaubte SiteSpec-Pfade. Rendererbugs gehen an die Implementierung, fehlende Inhalte an die Eingabeklärung. Keine endlosen Rebuilds mit anderen Modellnamen.

## 9. Nachweise und Auslieferung

Arbeite in nachvollziehbaren Änderungen und ergänze passende Unit-, Contract-, Orchestrator- und Browsertests. Teste insbesondere Capability-Grenzen, leere Assets, historische Signaturen, Freigabeentzug, Resume, Quoten und fehlende Bilder.

Führe die vorhandenen lokalen Prüfungen aus, soweit tatsächlich verfügbar: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm demo`, `pnpm designs:check`. Prüfe die Skripte vor Ausführung auf ihren heutigen Umfang. `pnpm build` ist laut Übergabe eine Typprüfung, kein Produktivdeploy.

Live-Qualitätsvergleiche erst separat planen und ausdrücklich im passenden Budget-/Kontingentbereich durchführen. Vorhandene Tests dieses Kits sind keine Factory-Integrationstests. Der vorhandene Evaluationsmechanismus soll für verblindete menschliche Vergleiche wiederverwendet werden.

Liefere am Ende: tatsächlich geänderte Dateien, implementierte statt nur geplante Fähigkeiten, gelaufene Befehle, konkrete Belege, verbleibende Grenzen, Migrationshinweise und die nächste klar abgegrenzte Freigabeentscheidung. Keine Aussage „vollständig fertig“, solange der notwendige Nachweis fehlt.

## Unverhandelbare Bestandsschutzregeln

Keine automatischen Veröffentlichungen oder Cold-Emails. Keine stillen API-Fallbacks, Budgeterhöhungen, neuen Scope-IDs oder Datenverzeichnisse zur Umgehung vorhandener Zähler. Keine Secrets im Chat. Keine gelockerten Netzwerk-, Robots-, TLS-, Fakten-, Asset- oder Preview-Schutzregeln. Keine automatisch eingeführte neue Agentenplattform, kein Frameworkwechsel und kein Umbau der POLIRE-Agenturwebsite.
