# Abnahme · noch zu implementierende Factory-Prüfungen

**Diese Matrix ist ein Entwicklungsauftrag. Die folgenden Integrationsfälle wurden in diesem Kit nicht an der echten Factory ausgeführt.** Die tatsächlich gelaufenen separaten Tests stehen in `TESTING.md`.

## Technische und vertragliche Fälle

| Fall | Erwartetes Verhalten | Prüfart |
|---|---|---|
| Unbekannte Rendereroption im Modelloutput | Validierungsfehler/konkrete Lücke; kein stiller Standardfallback. | Contract / Semantik |
| Neue Option im Schema | Mindestens ein zugehöriger tatsächlicher Renderpfad, Browserbild und Negativfall. | Renderer / Browser |
| Drei Konzepte unterscheiden nur Farben | Erfüllen die neue deklarierte Unterschiedsregel nicht; Bilder unabhängig prüfen. | Policy / Mensch |
| Letztes Projekt anders, älteres Projekt gleich | Zusätzliche Historienwarnung sichtbar. | Policy |
| Alte Signatur enthält nur bisherige Felder | Bisherige Prüfung bleibt möglich; neue Felder nicht erfinden. | Migration |
| Kein vergleichbarer historischer Stand | Keine Behauptung bewiesener Originalität. | Policy |
| Reparatur desselben Kundenprojekts | Keine erzwungene Stiländerung wegen Vergleich mit sich selbst. | Orchestrator |
| Gleiche Markenfamilie | Nur ausdrücklich konfigurierte Ausnahme; keine Modellvermutung über Zugehörigkeit. | Policy / Berechtigung |
| Keine freigegebenen Fotos | Bewusst fotoarmes Konzept oder konkrete Asset-Lücke. | Semantik / Mensch |
| Referenzbild als SiteSpec-Asset angegeben | Ohne separate tatsächliche Freigabe zurückweisen. | Asset-Prüfung |
| Alle Referenzen unbrauchbar | Bestehenden needs_input-/Gap-Pfad auslösen; keine Recherche erfinden. | Collector / Orchestrator |
| Suchfunktion aus | Kein externer Suchaufruf; Katalogmodus korrekt ausweisen. | Collector / Budget |
| Mobile Zusatzansicht lädt weitere Ressourcen | Gesamtgrenzen zählen weiter, kein Reset je Bild. | Crawler / Budget |
| QA hat nur einen Bildpfad | Bildabhängiger Check nicht als geprüft ausgeben. | Input / QA |
| Referenzbilder fehlen bei QA | Kein behaupteter eigener visueller Vergleich. | Input / QA |
| Screenshot stammt aus altem Build | Binding-/Versionskonflikt; keine neue Freigabe daraus ableiten. | Artefakt / QA |
| Factory-Kontaktaktion ist absichtlich deaktiviert | Preview-Schutz respektieren, kein reales Absenden. | Browser / QA |
| Unbelegte Behauptung als „redaktionell“ markiert | Semantisch prüfen und gegebenenfalls zurückweisen. | Copy-Policy |
| Echte Fact-ID trägt die konkrete Aussage nicht | Claim ablehnen oder offen lassen. | Semantik |
| Zusätzliches Strategist-Kontingent fehlt | Nicht dispatchen; keine neue Scope-ID oder API-Fallback. | Quota / Orchestrator |
| Resume während concept_review | Keine neue Inferenz nur durch Wiederaufnahme; vorhandene Vorschauen weiterverwenden. | Persistenz |
| Konzept-/Asset-/Rendererstand nach Auswahl verändert | Abhängige Auswahl/Build-/QA-/Preview-Freigaben nicht weiterverwenden. | Approval / Revision |
| Builder versucht Freigabeobjekt zu erzeugen | Keine Berechtigung; Runtime-Pfad erforderlich. | Contract / Berechtigung |
| Nach zwei Reparaturrunden ungelöste Gestaltung | Begrenzung respektieren, offene Entscheidung ausweisen. | Orchestrator |

## Sichtprüfung pro Mini-Vorschau und finalem Build

Die bereits vorhandenen Browsergrössen zuerst weiterverwenden: 375×812, 768×1024 und 1440×1000 laut Übergabe. Eine zusätzliche schmale 320-Pixel-Ansicht ist eine mögliche explizite Prüferweiterung, keine angeblich heute bereits laufende Prüfung.

Für die Sichtprüfung die tatsächlich ausgegebenen Bilddateien öffnen. Prüfe verständliche Hauptinformation, aktionsgerechte Hierarchie, Textumbrüche, Bildbeschnitt, Seitenrhythmus und Mobile-Anordnung. Nicht anhand des Codes behaupten, dass alle Ansichten gut aussehen.

Unterscheide technische Pass/Fail-Befunde, nicht geprüfte Zustände und gestalterische Urteile. Ein Kritikbeispiel lautet: „Im aktuellen mobilen Screenshot trennt der Umbruch einen Namen an einer ungünstigen Stelle; passe den dafür vorgesehenen Text-/Typografieparameter an; Abnahme durch neuen Screenshot.“ Nicht: „zu wenig Premium, bitte 9/10 erreichen“.

## Menschlicher Vergleich ohne Qualitätsfiktion

Verwende die vorhandene Evaluation statt ein zweites Benchmarksystem einzuführen. Beginne mit eingefrorenen, freigegebenen oder synthetischen Inputs. Ein kleiner geplanter Fallmix kann beispielsweise umfassen: persönliche Dienstleistung ohne Fotos, Salon mit bestätigtem Asset-Pool, handwerklicher Betrieb mit echten Projektbildern, beratungsorientierte Dienstleistung, informationsdichte Angebotsseite und mobile-first Terminaufgabe. Das ist ein vorgeschlagener Testmix, keine Aussage über vorhandene Factory-Fähigkeiten oder echte Kunden.

Vergleiche Alt und Neu mit denselben Fakten/Assets und verschleierter Herkunft. Halte fest, welche konkrete Darstellung zur Aufgabe passt, wo Entwürfe sich sichtbar unterscheiden, wie viele wesentliche Nacharbeiten nötig sind und wie viel tatsächlicher Aufwand anfällt. Berichte Stichprobengrösse, Materialgrenzen und Uneinigkeit.

Ein bestandener Fixture-Lauf zeigt Verdrahtung, nicht Qualität echter Modellentscheidungen. Die 15 individuellen Demos ersetzen keine Serie autonom erzeugter Factory-Ergebnisse. Nicht aus wenigen selbst ausgewählten Beispielen „beste Agents“ oder bessere Conversion ableiten.

Live-Läufe sind gesondert zu planen: Fallanzahl × betroffene Rollen/zusätzliche Aufgaben plus mögliche Retries. Bestehende Quoten und Budgets vor jedem Dispatch berücksichtigen; keine historischen Freigaben als neue Ausgabenberechtigung ansehen.
