# Lokale Demo-Auswahl vom 21. September 2026

Der Betreiber hat Demos für die heute gefundenen und gezeigten schwachen Websites ausdrücklich beauftragt. Umfang: 15 Firmen mit konkretem Verbesserungsbedarf aus den drei heutigen Auswahlen. Die drei niedrig priorisierten und sechs unvollständig bzw. nicht visuell bewerteten Firmen werden nicht als schlechte Websites umgedeutet.

Dies sind lokale Designentwürfe im Projekt, erstellt durch Entwicklungsagents aus den gespeicherten Review-Quellen. Sie sind kein behaupteter erfolgreicher Strategist/Builder/QA-Lauf der Factory. Die Factory-Datenbank, Modellquoten und Freigaben werden nicht verändert. Kein API-Key-Aufruf, keine Veröffentlichung, keine Kontaktaufnahme. Unklarer Betriebsstatus bleibt in der Übersicht sichtbar.

## Design

Redesign bestehender Firmenauftritte für lokale Kunden: gut lesbare mobile Ansichten, sichtbarer Kontakt, kurze Orientierung nach belegten Leistungen. Firmenname und belegte Inhalte bleiben erhalten. Individuelle fotografische bzw. typografische Gestaltung nach Branche; keine erfundenen Preise, Bewertungen, Teammitglieder, Garantien oder Projekte. Bilder nur aus vorhandenen Firmenquellen für diesen internen Entwurf, mit Quellenverzeichnis; fehlen geeignete Bilder, wird mit Typografie gearbeitet. Design-Varianz 6, Bewegung 3, Dichte 3. Native HTML/CSS, systemabhängiges helles/dunkles Farbschema, keine neue UI-Bibliothek.

## Dateien und Aufgaben

1. Root: `demos/2026-09-21/inputs/*.json` aus vorhandenen Quellen, `manifest.json`, gemeinsame HTML-Hülle und Übersicht, lokaler Server, Prüflauf.
2. Wood-Agent: `renderers/wood.mjs`, fünf Holz-/Schreinereiauftritte.
3. Places-Agent: `renderers/places.mjs`, fünf Garten-/Werkstatt-/Handwerksauftritte.
4. Salon-Dining-Agent: `renderers/salon-dining.mjs`, drei Salons und zwei Restaurants.

Jeder Renderer exportiert `render(lead) -> { html: string, css: string }`. `lead` stammt aus der zugehörigen Input-Datei. Hülle, Demo-Kennzeichnung, Navigation zur Übersicht und Kontakt-Demodialog liegen zentral. Renderers erzeugen Hauptnavigation und Seiteninhalt, keine document/head/body-Tags. Bilder verwenden `lead.assets` mit relativen lokalen Pfaden `assets/...`; innerhalb einer Site auf `../../assets/...` verweisen. Die Root-Funktion `escapeHtml` aus `../lib.mjs` steht bereit. Keine gemeinsamen Dateien durch Unteragents verändern.

Alle Kontakt-CTAs öffnen nur den lokalen Demo-Dialog (`button data-demo-contact`), kein tel/mailto/form-action. Inhaltsnavigation mit echten lokalen Ankern. Belegte Kontaktdaten sind lesbar. Original-Website nur als expliziter externer Quellenlink. Jede Seite hat genau ein h1, mehrere inhaltlich sinnvolle Abschnitte, responsive Navigation und bedienbare Schaltflächen.

## Prüfung

Alle 15 Demos bei 375, 768 und 1440 Pixeln: keine Überbreite, keine fehlenden lokalen Bilder, keine Konsolenfehler, funktionierende Anker und Demo-Dialoge. Dunkles Farbschema und reduzierte Bewegung ebenfalls prüfen. Screenshotprüfung je Gestaltungstyp, zusätzliche Bilder aller Demos. Keine Änderungen an der POLIRE-Website.

## Ausführung

Der vorhandene Entwicklungsbranch wird weiterverwendet. Die ausdrückliche Demo-Anweisung deckt die Umsetzung; keine weitere Designfreigabe wird verlangt. Parallelentwicklung nach dem Subagent-driven-Development-Skill mit getrennten Renderer-Dateien. Belege und Prüfergebnisse werden mitgeliefert und anschliessend wie bisher ins private Projekt-Repo synchronisiert.

## Abschluss

Alle vier Arbeitspakete umgesetzt: 15 individuelle Demos, gemeinsame Übersicht, geschützter lokaler Server und reproduzierbare Browserprüfung. Build und Lint bestehen, 214 Tests sind grün. Alle 45 Grössenprüfungen sowie 30 gezielte Accessibility-Prüfungen bestehen. Gefundene Ferien-, Überbreiten- und Kontrastprobleme wurden korrigiert. Quellen und methodische Grenzen sind in der Demo-Anleitung dokumentiert.
