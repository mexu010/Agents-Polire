# Design-Recherche und vielfältige Website-Demos

Stand: 21. September 2026. Umsetzung im bestehenden Factory-Projekt; die POLIRE-Website und die bisherigen 15 Entwicklungsdemos wurden nicht verändert.

## Neuer Ablauf

Nach einer gültigen Demo-Freigabe prüft die Factory standardmässig zwei Gestaltungsreferenzen. Sie speichert Quellen, Textauszüge und verfügbare Desktopbilder getrennt von Firmenfakten und freigegebenen Kundenbildern. Ohne konfigurierte Suche verwendet sie einen nach Branche ausgewählten Startkatalog; mit budgetierter Brave-Suche kann sie neue Referenzen suchen. Betreiber können konkrete Referenz-URLs vorgeben. Höchstens drei Abrufversuche sind erlaubt; fehlende Quellen und Bilder bleiben sichtbar.

Der Strategist muss Beobachtungen auf die geprüften Quellen beziehen, ein eigenes Konzept begründen und mindestens zwei andere Richtungen abwägen. Der Builder setzt die gewählte Komposition um. Vier tatsächlich unterschiedliche Seitenaufbauten stehen bereit: Atelier, Editorial, Bold und Minimal. Abschnittsfolge, Typografie, Palette, Abstände und vorhandene Kundenbilder prägen den Entwurf zusätzlich. Die gleiche Komposition mit derselben Abschnittsfolge wie beim letzten vergleichbaren Entwurf wird nicht allein durch neue Farben oder Schriften akzeptiert.

Bestehende Freigaben, Kostenreservierungen, Modell- und Reparaturlimits bleiben bindend. Recherchepakete werden wiederverwendet. Eine ausdrückliche neue Design-Recherche entwertet nachfolgende Vorschaufreigaben. Löschung während laufender Recherche kann keine gelöschten Inhalte wiederherstellen. Alte gespeicherte Briefings bleiben lesbar; beide Modelladapter verwenden einen kompatiblen strengen Ausgabevertrag.

## Geprüft

- Build und Lint erfolgreich.
- Gesamte Testsuite: **251 Tests in 27 Dateien bestanden**.
- Vier gerenderte Vergleichsseiten: **88 Browserprüfungen bestanden**, je drei Screenshots bei 375, 768 und 1440 Pixeln. Desktop- und Mobilansichten visuell geprüft.
- Unabhängige Codeprüfung für Renderer und Integration; gefundene Fehler korrigiert und nachgeprüft.
- Echte Referenzabrufe für [George Northwood](https://www.georgenorthwood.com/) und [Hershesons](https://www.hershesons.com/pages/stores) ausgeführt. Der letzte Test erfasste Texte beider Seiten und ein Desktopbild von George Northwood. Das fehlende Hershesons-Bild wurde korrekt als Einschränkung gespeichert; das Paket blieb ausdrücklich unvollständig.
- Keine kostenpflichtigen Modellaufrufe, keine Kontaktaufnahme und keine neu erzeugte Kundendemo in dieser Umsetzung.

## Vergleich und Grenzen

`pnpm designs` startet den lokalen Vergleich auf Port 4321. `pnpm designs:check` erzeugt Browserprüfungen und Screenshots ohne Modellaufrufe. Die vier Beispiele nutzen identische, ausdrücklich synthetische Salon-Inhalte; sie zeigen die Unterschiede des Renderers. Die bisherigen Vorschauen auf Port 4320 bleiben separat.

Der Referenzkatalog ist eine Startauswahl, keine Rangliste der besten Websites. Offene Websuche benötigt die konfigurierte und budgetierte Suchanbindung. Vier Kompositionen schaffen eine erste strukturelle Vielfalt, sind aber keine unbegrenzte freie Codegestaltung. Ein echter neuer Strategist-/Builder-Modelllauf und die menschliche Beurteilung seines individuellen Designs wurden hier noch nicht ausgeführt. Die automatisierten Prüfungen allein belegen keine gestalterische Spitzenqualität.

Konfiguration, Wiederaufnahme und gezielte Neurecherche sind im [README](../README.md#design-recherche-und-unterschiedliche-seitenaufbauten) dokumentiert. Lokale Recherchebilder, Testdaten, Datenbanken und Zugangsdaten bleiben von Git ausgeschlossen.
