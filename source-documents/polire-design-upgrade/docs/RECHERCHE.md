# Recherche · echte Beobachtungen statt Inspiration als Schlagwort

Grundlage: Übergabe, Abschnitte 7 und 8. Dort beschrieben: standardmässig zwei, maximal drei Designreferenzen; derzeit meist eine Desktopansicht; optional budgetierte Brave-Suche; Suche in vorhandenen Live-Profilen deaktiviert. Keine erneute externe Prüfung dieser Konfiguration in dieser Sitzung.

## Ausgangspunkt: Kundenaufgabe und Material

Der Collector bekommt den aus akzeptierten Fakten abgeleiteten Branchen-/Leistungsbezug, die Hauptaktion und die verfügbaren freigegebenen Asset-Arten. Fehlende Bilder beeinflussen die Referenzauswahl: ein Projekt ohne freigegebene Fotografie braucht mindestens eine praktisch übertragbare fotoarme Idee, nicht ausschliesslich bildlastige Modeseiten.

Nicht sämtliche Kundeninformationen in Suchanfragen übertragen. Öffentliche Branchentypen, Region soweit nötig und Gestaltungsfragestellungen genügen. Keine privaten Kundenanfragen, Zugangsdaten oder internen Analyseurteile an Suchanbieter senden.

## Auswahl bei zwei Referenzen

Referenz A: direkte Branche, nachvollziehbare Nutzeraufgabe, erkennbare Informationsstruktur. Für einen Salon beispielsweise Leistungsauswahl und Terminweg.

Referenz B: begründet passende Nachbarbranche oder gestalterischer Kontrast. Beispielsweise eine andere Dienstleistung mit persönlicher Identität oder eine gut strukturierte, fotoarme Informationsseite. „Andere Branche“ allein ist keine Begründung.

Dritte Referenz nur innerhalb der tatsächlich freigegebenen Grenzen, zum Beispiel wenn ein wesentlicher Aspekt sonst unbelegt bleibt. Kein Anspruch, dass jede Kombination einen vollständigen Marktvergleich liefert.

Vorhandene explizite Referenz-URLs bleiben vorrangig. Katalogkandidaten sind Startpunkte; aktuelle Erreichbarkeit und passende Belege müssen trotzdem geprüft werden. Wenn nur ähnlich gestaltete Referenzen verfügbar sind, dokumentiere die Einschränkung.

## Suche und Herkunft nicht verwechseln

Die konkreten Config-Felder und Reservierungswege im Quellcode lesen, bevor etwas aktiviert wird. Der vorhandene Schlüsselname ist laut Übergabe `BRAVE_SEARCH_API_KEY`, nicht der Name aus dem früheren allgemeinen Python-Kit.

Ohne aktive Recherchekonfiguration, bestätigten Abfragepreis und freigegebenes Budget keine kostenpflichtige Suche. Kein Umgehen durch einen neuen Provider, Datenordner oder Scope. Ein reiner Katalogabruf muss als solcher dokumentiert werden. Ein Suchtreffer gilt nicht als betrachtete Website.

Mögliche Suchanfragen werden aus dem Fall abgeleitet, nicht starr allen Branchen zugewiesen. Für ein synthetisches Salonbeispiel wären Varianten wie „independent hair salon services booking website“ oder „Coiffeur Salon Leistungen Termin Schweiz“ denkbar. Diese Beispiele wurden durch das Kit nicht live ausgeführt und garantieren keine geeigneten Treffer.

## Beleganforderungen

Bewahre die bestehenden DesignReference-/Evidence-/ImageBinding-Verträge und erweitere sie nur zusammen mit der Runtime. Dokumentiere, soweit der tatsächliche Vertrag dies erlaubt oder entsprechend erweitert wurde:

| Aspekt | Erforderlicher Nachweis |
|---|---|
| Herkunft | Explizite URL, Katalog oder tatsächlich ausgeführte Suche; Quelle und Abrufzeit. |
| Passung | Branche, relevante Nutzeraufgabe, Asset-Voraussetzungen und begründete Übertragbarkeit. |
| Betrachtete Ansicht | Tatsächlich aufgenommener Viewport, Bildbindung, Seiten-/Artefaktbezug. |
| Beobachtung | Konkrete Struktur, Typografiehierarchie, Bildbeschnitt, Leistungsdarstellung oder Abschnittsfolge. |
| Anwendung | Eigenständige Übertragung in unterstützte Rendererfähigkeiten. |
| Grenze | Fehlender Zugriff, nur Textbeleg, nicht betrachtete Interaktion oder für den Kunden ungeeigneter Ansatz. |

Textauszüge tragen `basis: text`. Ein visueller Befund braucht die echte Bildeingabe. Eine Animation wird nicht aus einem stillen Bild beurteilt. Referenzbilder dürfen an Strategist und optional QA gehen, werden aber nicht zu `ApprovedAsset`.

## Mobile Ansichten ohne versteckte Budgetvervielfachung

Zuerst eine mobile Zusatzansicht für die relevanteste Referenz vorsehen. Dafür dieselbe Seitenbeschaffung möglichst weiterverwenden; eventuelle neue Browserrequests durch die Ansichtsänderung zählen weiterhin. Der zuständige Collector muss über die gesamte Referenzbeschaffung hinweg zählen, nicht das Request-/Bytebudget pro Screenshot zurücksetzen.

Die laut Übergabe bestehenden Zeit-, Request- und Bytegrenzen gelten weiter. Wenn Desktop und Mobile darin nicht gelingen, speichere vorhandene brauchbare Belege und die Lücke. Unvollständigkeit nicht als bestandenen Mobile-Vergleich umschreiben.

Cachewiederverwendung bleibt an Quelle, Ansicht, relevante Render-/Capture-Einstellungen und Frische gebunden. Ein Cachepfad ohne verifizierte Bildbindung ist keine neue Betrachtung.

## Kein neuer freier Browseragent

Die Runtime beschafft und übermittelt Belege. Ein Strategist-Prompt „geh ins Internet“ ohne bereitgestellten Toolpfad ist wirkungslos. Die gesperrten Runtime-Werkzeuge, Crawler-Netzgrenzen, Robots-, Redirect- und TLS-Prüfungen werden für diesen Ausbau nicht gelockert.

Wenn keine nutzbare Referenz vorliegt, bleibt das im bestehenden Fehler-/Gap-Pfad sichtbar. Kein erfundener Suchverlauf, kein unbelegtes Qualitätssiegel und keine automatische Eskalation an ein anderes Modell, um fehlende Daten zu kaschieren.
