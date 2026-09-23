# Bestand und Recherche

Stand: 22. September 2026. Browserbilder tatsächlich mit Chrome/Playwright aufgenommen und geöffnet. Bildpfade unter `work/lanz-design-2026-09-22/evidence/` beziehen sich auf den Factory-Arbeitsordner. Externe Bilder werden weder heruntergeladen noch als Kundenassets verwendet; die gespeicherten Screenshots dienen ausschliesslich der Recherche.

## Bestätigte Basis und offene Angaben

`../content.mjs` und `../SOURCES.md`: Coiffeur Lanz, Vreni Lanz, Eichi 20, 3368 Bleienbach, Telefon/Mobil/E-Mail sowie sechs dokumentierte Wochentage. Keine ergänzten Sonntagszeiten. Keine bestätigte detaillierte Leistungsliste, Preise, Berufserfahrung, Qualifikationen, Produkte, Bewertungen oder Mitarbeitendenzahl. Die Originalmarke enthält die Worte Damen/Herren; daraus werden keine einzelnen Leistungen abgeleitet.

Vorhanden: unverändertes Original-Logo, Satoshi 400/500/700 und ein gekennzeichnetes KI-Stillleben mit Schere/Kamm. Kein freigegebenes Porträt, Raumbild oder Arbeitsfoto. Rechte-/Inhaberfreigabe für einen echten Kundeneinsatz bleibt gemäss SOURCES offen. In A und C wird auf das Symbolbild bewusst verzichtet; B verwendet dieselbe vorhandene Datei mit CSS-Bildausschnitt und sichtbarer Kennzeichnung. Alle drei erhalten denselben Assetbestand, keine fremden Referenzbilder.

Der bestehende Editor verwaltet Business-/Kontaktangaben, Start-/Salon-/Besuchs-/Kontakttexte, Öffnungszeiten, Hinweis, Hero-Bild/Alttext, Rechtsangaben und Journal. Öffentliche Routen: `/`, `/salon/`, `/besuch/`, `/kontakt/`, `/journal/`, `/journal/:slug/`, `/impressum/`, `/datenschutz/`; dazu 404, responsive Menü-, Formular-, Fehler-/Erfolgs- und Journal-Leerzustände. Backend umfasst Postfach, Uploads, Statistik, Revisionen, Sicherung und Betriebsfreigaben. Diese Vorschauen greifen nicht in diese Funktionen ein.

Der frühere lokale Server auf 4330 lief nicht. Für die Bestandsaufnahme wurde die **unveränderte echte Anwendung** mit `initialContent` und einer separaten temporären Datenbank gestartet; keine vorhandene Kundendatenbank geöffnet. Die Bilder belegen den aktuellen Renderer mit dem versionierten Inhaltsstand, nicht mögliche spätere Bearbeitungen im gespeicherten Kundenbestand. Der im Auftrag erwähnte zusätzliche Screenshot lag hier nicht als eigene Bilddatei vor; die aktuellen Browseransichten waren die Grundlage.

## Vier konkrete Ausgangsprobleme

1. Bei 1440 px beansprucht die allgemeine Überschrift «Für Ihren nächsten Schnitt.» drei grosse Zeilen. Vreni Lanz erscheint erst im kleineren Lauftext; das Original-Logo ist nur etwa 53 px breit. (`before/desktop-entry.png`)
2. Das dekorative Stillleben besetzt knapp die rechte Hälfte des Einstiegs, obwohl es weder Salon noch Arbeit zeigt. Der Bildnachweis muss deshalb erst klein darunter erklären, was es nicht zeigt. (`before/desktop-entry.png`)
3. Adresse und Öffnungszeiten folgen nach einem weiteren Abschnitt, der Vreni und Kontakt erneut erklärt. Auf Mobil sind mehrere Bildschirmhöhen nötig, bevor die Besuchsdaten sichtbar werden. (`before/mobile-entry.png`, `before/mobile-section.png`)
4. Bei 390 px endet das mobil ausgerückte Bild rechts vor der äusseren Kante. Seine Geometrie passt dadurch weder zur Textspalte noch zu einer bildschirmbreiten Fläche. (`before/mobile-entry.png`)

## Tatsächlich untersuchte Hauptreferenzen

### Salon5

URL: [coiffeursalon5.ch](https://coiffeursalon5.ch/). Bilder: `salon5/desktop-entry.png`, `desktop-section.png`, `mobile-entry.png`, `mobile-section.png`.

Der Einstieg koppelt einen realen Raumblick mit einer klaren Buchungsaktion. Darunter machen benannte Porträts konkrete Personen sichtbar. Mobil steht die Aktion im Bild vor dem längeren Vorstellungstext. Für Lanz ist die **erkennbare Person und der direkte nächste Schritt** passend. Raum-/Personenbilder werden nur mit eigenen freigegebenen Bildern möglich. Nicht übernehmen: das stark abgedunkelte Vollbild, überlagerte Markenrahmen, die langen kursiven Absätze und die unruhige Hintergrundfotografie unter den Porträts. Keine Onlinebuchung behaupten, da Lanz aktuell eine Anfrage verarbeitet.

### Studio7

URL: [studio7.ch](https://www.studio7.ch/). Bilder: `studio7/desktop-entry.png`, `desktop-section.png`, `mobile-entry.png`, `mobile-section.png`.

Ein bewusst gesetzter Anschnitt führt über Haar und Profil zur zweizeiligen Typografie. Die mobile Version verschiebt den Bildfokus und hält die Aktionen im ersten Bildschirm. Danach wechseln Bildfläche, ruhige Erklärung und Raumaufnahmen. Für B übernehmen wir **präzise Bildkanten, unterschiedliche Textmassstäbe und den Rhythmus zwischen Bild und konkreter Information**. Nicht passend für Lanz: fremde Modellbilder, Salonhistorie, Produkt-/Leistungsbehauptungen, Serif-/Beigewelt oder das riesige Bild als alleiniger Identitätsbeleg. Das vorhandene Lanz-Symbolbild bleibt kleiner und ausdrücklich als Symbolbild bezeichnet.

### The Florist

URL: [theflorist.ch/de](https://theflorist.ch/de/). Bilder: `the-florist/desktop-entry.png`, `desktop-section.png`, `mobile-entry.png`, `mobile-section.png`.

Die Seite unterscheidet konkrete Angebote und erklärt danach Bestellen, Zusammenstellen und Liefern. Bilder und verständliche Texte zeigen unterschiedliche Aufgaben. Für Lanz ist die **Aufbereitung der tatsächlich verfügbaren Informationen entlang eines Besuchs** brauchbar: Kontakt, Zeiten und Ort. Nicht übernehmen: Shop, Warenkorb, Cookie-Banner, das grosse leere Feld vor dem Angebot, generische Dreierkarten oder auf Mobil sehr schmale Textflächen über Fotos. Die Cookie-Hinweise waren in den Aufnahmen sichtbar; keine Zustimmung oder Bestellung wurde ausgelöst.

Weitere Sichtungen: Haargenau und Flörlike wurden geöffnet, aber nicht als Hauptreferenz gewählt. Die Flörlike-Einstiegsaufnahme zeigte einen Lader und ist kein Beleg für einen fertig geladenen Einstieg. Aus solchen Bildern werden keine Gestaltungsbehauptungen abgeleitet.

## Vergleichbarkeit und spätere Integration

Alle Mini-Seiten erhalten dasselbe `initialContent`-Objekt; Business-/Kontakt-/Stundenwerte werden escaped aus dem vorhandenen Schema gerendert. Die vorgeschlagenen Starttitel werden als reine Entwurfsdaten über `home.headline` geführt. Kein Text wird in der echten Datenbank ersetzt. Die Gestaltung zeigt Besuchsinformationen, weil eine freigegebene Leistungsliste fehlt. Nach Auswahl muss die gewählte Darstellung mit dem bestehenden Editor- und Laufzeitinhalt verbunden werden; erst dann werden alle öffentlichen Seiten und Funktionszustände umgebaut und erneut geprüft.
