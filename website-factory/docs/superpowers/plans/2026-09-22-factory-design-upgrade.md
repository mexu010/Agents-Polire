# Factory Design Upgrade · Umsetzungsplan und Fortschritt

Ziel: bestehende Recherche, gestalterische Möglichkeiten, Faktenbindung und visuelle QA ausbauen; optional drei echte Konzeptvorschauen mit menschlicher Auswahl vor dem Vollbuild.

Grundlage: aktueller Quellstand fcc070f; Nutzerauftrag vom 22.09.2026; separat entpacktes Paket unter `../polire-design-upgrade-input-2026-09-22/polire-design-upgrade/`. Paket ist Anforderung/Hilfe, kein integrierter Patch. Bestehende Übergabe bleibt erhalten.

Grenzen: keine Live-Inferenz, kostenpflichtige Suche, Veröffentlichungen, Kontaktaufnahme, geänderte Auth-/Budgetgrenzen oder Änderungen an Lanz/Agenturwebsite. Änderungen im ausdrücklich benannten aktiven Nicht-main-Branch; keine Synchronisierung oder neue Repository-Kopie. Keine neuen Abhängigkeiten erforderlich.

## Diagnose vor Änderungen

- Vorher-Browserlauf: `work/design-showcase/2026-09-22T17-00-54.797Z/`, vier Kompositionen bei 375/768/1440 px, technische Prüfungen bestanden.
- Desktop Atelier und Mobile Minimal geöffnet: grosse Leerflächen, Wiederholung derselben Leistung als Titel/Text, doppelte Firmenbezeichnung in Header/Navigation. Bilderloser synthetischer Test, keine angeschauten externen Referenzen.
- Inputweg: `fixtureInput` → `buildAgentInput` → `processAgentOutput` → Brief/SiteSpec. Leere freigegebene Assets; Showcase verändert anschliessend Themes deterministisch. Kein echter Strategist-Qualitätsnachweis.
- Recherche: bisher dieselben zwei Branchenkandidaten, meist nur Desktop; Strategist erhält gebundene Bilder, QA nur aktuelle Renderbilder. QA-Pass prüft bisher Bildbreite, nicht ausreichend Route/aktuellen Renderbezug. Separate vollständige Fixture-Ausführung wird unter `work/design-upgrade-baseline/` gespeichert.

## Gemeinsame Schnittstellen

- Neues optionales `Theme.design_profile`: `editorial-spread`, `service-index`, `type-poster`. Quelle `src/design-capabilities.ts`, feste Profile mit tatsächlich implementierten Hero-, Mobil-, Rhythmus-, Typografie-, Bild- und Leistungsdarstellungen. Profile erhalten zulässige Komposition/Schrift; Legacy ohne Feld bleibt darstellbar.
- `DESIGN_CAPABILITIES_VERSION`, `DESIGN_PROFILES`, `resolveDesignProfile(theme)` und `validateDesignTheme(theme)` werden vom Renderer-Teil geliefert. Keine Modelllabels als Signaturquelle.
- Root pflegt zentral `spec/contracts.schema.json`, `src/agents.ts`, `src/fixtures.ts`, `src/model-contracts.ts`, Provider und Orchestrator. Andere Arbeiten liefern ihre Integrationsschnittstellen, bearbeiten diese Dateien nicht gleichzeitig.
- Recherche erweitert DesignReference optional um `selection_role`, `selection_reason`, `capture_limitations`; maximal zwei Bilder je Referenz, insgesamt höchstens vier Bildeingaben für Strategist (Desktop je Referenz plus Mobile für erste Referenz). Limits des Collectors unverändert/kumulativ.
- Copy behält `Copy{text,kind,fact_ids}` bei und ergänzt eng begrenzte faktgebundene Satzrahmen; keine beliebige Editorial-Freigabe.
- QA erweitert IssueProposal/Issue optional um `acceptance_criterion`, neue QA-Inputs aktivieren verpflichtende konkrete Bildbefunde. Alte Verträge bleiben lesbar.
- Exploration ist `task: design_exploration` auf bestehender Rolle Strategist, eigener schema-validierter Output, bestehender Provider samt Quoten/Reservierungen. Kein neues Runtime-Modell.

## Arbeitspakete

- [x] Recherche: Branchen-/Kontrastkandidaten, begründete Auswahl, mobile Zusatzansicht innerhalb bestehender Limits; Tests mit injiziertem Collector, keine externen Abrufe.
- [x] Capabilities/Renderer: drei neue zusammenhängende Profile, echte unterschiedliche Strukturen auch ohne Fotos; unbekannte Optionen ablehnen; Renderer- und Browserfälle.
- [x] Copy/QA: sichere Satzrahmen, negative Claim-Tests, reale Route-/Artefakt-/Bildbindung und konkrete Abnahmebefunde; bestehende Reparaturgrenzen erhalten.
- [x] Historie: Kit-Helfer an tatsächliche Typen adaptieren, bis acht validierte frühere Projekte, Selbstvergleich ausschliessen, Warnungen statt Qualitätsnoten, alte Signaturen als begrenzt vergleichbar behandeln.
- [x] Konzepte: opt-in Config, gemeinsamer evidenzgebundener Mini-Inhalt, drei kompakte Strategistkonzepte, geschütztes Rendering/Browserbilder, CLI anzeigen/auswählen, persistierte Hash-/Revisionsbindung, Resume ohne Dispatch beim Warten, Invalidierung.
- [x] Integration: lokale negative/positive Tests, bestehende Suite, Build/Lint, Demo und Browserbilder, unabhängige Codeprüfung, dokumentierter Ergebnisstand und lokale Ansicht.

## Prüffälle

Unbekannte Profile, widersprüchliche Theme-Werte, null/Legacy-Felder, fehlende Assets, identische Signaturen, ältere Wiederholung, fremde Fakten-IDs, erfundene Zusagen, stale Screenshots, falsche Route/Viewport, fehlendes Abnahmekriterium, drei gleiche Konzepte, stale Auswahl, erneuertes Referenzpaket, geänderte Capability-Version, ausgeschöpftes Kontingent, Resume am Auswahlpunkt und höchstens zwei Reparaturen.

## Rulings / Integration

- Nutzer hat lokale Implementierung nach kurzem Plan ausdrücklich beauftragt; keine zusätzliche Plan-Freigabe oder Wartepause.
- Vorhandenen Checkout verwenden, da Nutzer diesen als Arbeitsort benannt hat; Branch ist bereits ein Entwicklungsbranch. Vorhandene unversionierte Übergabe nicht überschreiben.
- Keine automatische Veröffentlichung/Commits des übrigen Nutzerbestands.
- Gemeinsame Dateien werden nur vom Root bearbeitet. Delegierte Teile arbeiten an getrennten Quelldateien und ihren Tests; Schnittstellen werden vor Integration abgeglichen.

## Nachweise

- Build und Lint bestanden; finale Vollsuite 35 Dateien / 308 Tests, 170,43 Sekunden.
- Siebenervergleich: `work/design-showcase/2026-09-22T18-10-31.085Z/`, 21 Bilder, 154 Browserchecks ohne Fehler. Drei Bilder aus dem letzten Lauf tatsächlich geöffnet; frühere Desktop-/Mobilbilder während der Korrekturen ebenfalls angesehen.
- Vollständige Fixture-Demo: Run `90941161-16a1-4250-ae4e-9829b2cc70e3`, sieben Rollen, 22 Browserchecks, simulierter lokaler Export, kein Versand.
- Konzeptlauf `design-upgrade-preview`, Revision 16, wartet auf menschliche Auswahl; neun aktuelle Renderbilder und 66 Browserchecks ohne Fehler. Galerie bei 1440/375 px aufgenommen und angesehen; alle drei aktuellen mobilen Konzeptbilder angesehen.
- Wortumbruch «Haarschnitte», lange Titel, überlappende Posterzeilen, leere Navigation und wirkungslose Profil-Abstandsoptionen nach Browserbefunden korrigiert und mit Regressionstests belegt.
- Unabhängiger Review: QA-Issues müssen eigene aktuelle Screenshot-Evidence haben; historische Signaturen werden nicht aus neuen Capabilities rückwirkend erzeugt. Beide Lücken behoben, keine verbleibenden wichtigen Findings.
- Vollständiges Dateimanifest, genaue Startbefehle, Screenshotpfade und ausdrücklich offene Live-/Qualitätsprüfung: `docs/DESIGN-UPGRADE-2026-09-22.md`.
