# POLIRE Factory: Design-Upgrade, 22. September 2026

## Geltungsbereich und Arbeitsstand

Aktiver Checkout: `C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory`, Branch `codex/factory-implementation`, Ausgangscommit `fcc070ff2db1119ff36aae09af0bde11b3d3aea0`.

Das ZIP wurde separat nach `C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\polire-design-upgrade-input-2026-09-22\polire-design-upgrade` entpackt. Es wurde als Entwicklungsauftrag und Hilfsquelle gelesen, nicht über das Projekt kopiert. Die vorhandene unversionierte technische Übergabe blieb erhalten. Die Änderungen sind lokal und nicht committed/veröffentlicht. Kein Abgleich mit der separaten Repository-Kopie.

Unverändert: Agentenrollen, Node/TypeScript/React/SQLite/Playwright, Authentifizierungswege, Modelle, Reasoning, Budget- und Quotenlimits, Asset-Freigaben, Lead-Scores, menschliche Demo-/Preview-Freigaben. Keine Änderung an `clients/coiffeur-lanz/`, an den bestehenden 15 Demos oder an der POLIRE-Agenturwebsite. Keine Live-Inferenz, bezahlte Suche, Veröffentlichung oder Kontaktaufnahme.

## Tatsächlich implementiert

1. **Recherche.** Belegte Branchen-/Leistungsdaten steuern Referenzkandidaten. Ein Projekt erhält passende Kandidaten sowie einen erklärten Gestaltungskontrast. Erfolgreiche Suche wird mit einem Katalogkontrast gemischt; Betreiber-URLs behalten Vorrang. Auswahlrolle, Grund und Erfassungslücken sind persistiert. Craft-Katalogquellen gelten ausdrücklich als benachbart oder branchenfremd, nicht als Sanitär-/Elektriker-Nachweis. Erste lesbare Referenz nach Möglichkeit Desktop und Mobil, weitere Referenzen Desktop; maximal vier gebundene Bildeingaben. Keine visuellen Beobachtungen allein aus URLs, Pfaden oder nicht gelieferten Bild-IDs.
2. **Rendererfähigkeiten.** Drei echte Profile: `editorial-spread`, `service-index`, `type-poster`. Unterschiedliche Hero-/Leistungsstrukturen, Typografie, Bildführung, Rhythmik und mobile Anordnung. Die vier älteren Kompositionen bleiben lesbar. Profile und zulässige Kompositions-/Schriftkombinationen werden validiert. Builder muss das ausgewählte Profil und die Abschnittsfolge erhalten. Unbekannte Profile werden abgewiesen.
3. **Gestaltung ohne Fotos.** Alle Profile funktionieren mit Typografie und Flächen. Mini-Vorschauen verwenden nur bereits freigegebene Fotos/Illustrationen; keine Referenzbilder, Fonts oder Logos als versehentliche Hero-Fotos. Leere Navigation und mehrere schlecht lesbare Wortumbrüche wurden nach tatsächlicher Bildsichtung korrigiert.
4. **Copy.** Zusätzliche neutrale redaktionelle Texte und eng begrenzte faktgebundene Satzrahmen. Die Struktur `Copy{text,kind,fact_ids}` und ihre Validierung bleiben erhalten. Negative Tests prüfen erfundene Preise, Garantien, Qualifikationen, Bewertungen und falsche Fakt-IDs. Prompts wurden gekürzt, um unnötigen Input zu vermeiden; Limits wurden nicht angehoben.
5. **Historie.** Bis acht validierte frühere Projekte derselben Branchenkategorie und Betriebsart; gleiche Firmenhosts und eigene Revisionen zählen nicht mehrfach. Der Kit-Helfer arbeitet über einen Adapter mit tatsächlichen Factory-Typen. Versionierte Signaturen werden beim Briefing gespeichert. Altbestand ohne passenden Snapshot bleibt eine Vergleichslücke. Das Modell erhält kompakte frühere Layoutzusammenfassungen, der deterministische Vergleich verwendet die vollständigen gespeicherten Signaturen. Wiederholungswarnungen erscheinen im Report. Signaturvielfalt wird ausdrücklich nicht als visuelle Qualität bewertet.
6. **Visuelle QA.** Neue Browserläufe kennzeichnen ihre QA-Eingaben als `rendered-views/2`. Visuelle Entscheidungen müssen tatsächliche aktuelle Bildinputs und deren Screenshot-Evidence zitieren: Artefakt, Bildhash, Route, Viewport und Full-Page-Locator stimmen überein. Visuelle Fehler benötigen konkrete Beobachtung, Änderungsvorschlag und Abnahmekriterium. Alte Verträge bleiben lesbar; die bestehenden höchstens zwei Site-Reparaturrunden bleiben bestehen.
7. **Optionaler Konzeptmodus.** `designExploration.enabled=false` bleibt Standard. Opt-in erzeugt einen zusätzlichen aufgabenspezifischen Strategist-Schritt, drei tatsächliche Mini-Seiten mit identischen Inhalten, neun Browserbilder und eine Auswahlpause. Erst die menschliche Auswahl startet den vollständigen Build. Hash-/Revisionsbindung, Generation-Snapshot, Manipulations- und Ablaufprüfung verhindern veraltete Auswahl. Wartendes `resume` löst keine neuen Modellaufrufe aus. Exploration und normales Briefing besitzen getrennte Protokolle; beide zählen über denselben Provider auf die vorhandenen Budgets/Quoten.
8. **Lokaler Vergleich.** Geschützte, schreibgeschützte Konzeptgalerie und neue CLI-Befehle `concepts show/open/select`. Profiltexte in der Galerie stammen aus implementierten Fähigkeiten; freie Modellprosa wird nicht als verifizierter visueller Befund angezeigt. `designs:check` umfasst die vier älteren Kompositionen plus drei neue Profile.

## Lokal ansehen

Es werden keine zusätzlichen Schlüssel benötigt. Alle folgenden Befehle verwenden synthetische Daten und simulierte Modellantworten, aber echtes Rendering und echte Browserprüfungen.

```powershell
Set-Location 'C:\Users\StartKlar\Documents\ChatGPT\Project-Polire\website-factory'
pnpm factory --config config/design-exploration.fixture.json run --mode fixture --run-id design-upgrade-preview --domain https://fixture.alpina-service.example/
pnpm factory --config config/design-exploration.fixture.json concepts open design-upgrade-preview --port 4331
```

Den ausgegebenen geschützten Link öffnen. Der Server läuft bis `Ctrl+C`; Vorschauen sind zeitlich begrenzt. In einem zweiten Terminal:

```powershell
pnpm factory --config config/design-exploration.fixture.json concepts show design-upgrade-preview
pnpm factory --config config/design-exploration.fixture.json concepts select design-upgrade-preview CONCEPT_ID --revision REVISION --review-hash REVIEW_HASH
pnpm factory --config config/design-exploration.fixture.json preview open design-upgrade-preview
```

`CONCEPT_ID`, `REVISION`, `REVIEW_HASH` aus dem aktuellen `concepts show` übernehmen. Der Testlauf bleibt bewusst vor dieser Auswahl stehen. Die automatisierten Integrationstests prüfen separat eine simulierte Betreiberwahl und den anschliessenden vollständigen Build.

Nach Ablauf die aktuelle Revision mit `show` lesen und die synthetischen Vorschauen erneuern:

```powershell
pnpm factory --config config/design-exploration.fixture.json show design-upgrade-preview
'{"refreshDesignReferences":true}' | Set-Content -Encoding ascii work/design-upgrade-refresh.json
pnpm factory --config config/design-exploration.fixture.json revise design-upgrade-preview --revision REVISION --file work/design-upgrade-refresh.json
pnpm factory --config config/design-exploration.fixture.json resume design-upgrade-preview
pnpm factory --config config/design-exploration.fixture.json concepts open design-upgrade-preview --port 4331
```

`REVISION` aus dem aktuellen `show` übernehmen; einen älteren Server auf Port 4331 vorher mit `Ctrl+C` beenden. Diese Fixture-Konfiguration verursacht keine API-Ausgaben. Im Live-Modus kann eine neue Recherche erneut Kosten/Quoten verbrauchen und ist hier nicht freigegeben.

Zusätzlicher Vergleich mit synthetischen Salon-Inhalten:

```powershell
pnpm designs
pnpm designs:check
```

`designs` zeigt die lokale Übersicht auf Port 4321. `designs:check` erzeugt sieben Varianten bei 375/768/1440 px unter `work/design-showcase/`.

## Grenzen und noch offene Vorschläge

- Keine neue Live-Recherche oder Live-Modellqualität geprüft. Externe Quellen wurden in diesem Auftrag nicht als Inspiration betrachtet; Recherchetests arbeiten mit injizierten Collector-Ergebnissen. Fixture-Bilder zeigen synthetische Firmen, keine fertigen Kundenprojekte.
- Der kleine Katalog ist keine umfassende Branchenrecherche. Bei unbekannten oder nur benachbarten Branchen wird die Lücke ausgewiesen. Offene Suche benötigt die bereits vorhandene, ausdrücklich freigegebene und budgetierte Anbindung.
- Drei neue unterstützte Profile sind ein begrenzter Renderer-Wortschatz, keine freie Codegenerierung. Layoutgleichheiten bleiben bei sehr dünnen Inhalten möglich. Fachliche Copy und echte Materialien brauchen weiterhin bestätigte Fakten und freigegebene Assets.
- Der Konzeptmodus rendert kompakte vergleichbare Seiten. Er stellt weder drei vollständig ausgearbeitete Websites noch drei getestete Motion-Systeme her. Auswahl erfolgt lokal über die CLI, nicht über einen Web-Button.
- QA erhält aktuelle Renderbilder, aber kein zusätzliches automatisches visuelles Vergleichsmodell für fremde Referenzbilder. Statische Bilder beweisen keine Interaktionen oder Animationen. Die technische Prüfung kann gestalterische Qualität nicht garantieren.
- Faktenbindung bleibt bewusst eng. Freie Werbeparaphrasen, erfundene Erfahrungswerte oder Versprechen sind weiterhin unzulässig.
- Die konservativen Eingabelimits bleiben hart. Umfangreiche Fakten-/Referenzpakete können vor Dispatch mit `INPUT_LIMIT` stoppen; es gibt keinen stillen Modellwechsel oder höhere Budgets. Kompakte Prompts und Historien reduzieren unnötigen Input.
- Der vorgeschlagene menschlich bewertete Vergleich an 20 realen Fällen wurde nicht ausgeführt. Dafür fehlen in diesem Auftrag die separate Freigabe für Modellläufe und Ausgaben sowie reale Briefings/Assets und die menschlichen Bewertungen.

## Verifikation und Dateimanifest

Abschliessende lokale Prüfungen am 22.09.2026:

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| `pnpm build` | Bestanden, TypeScript ohne Fehler |
| `pnpm lint` | Bestanden |
| `pnpm test --maxWorkers=1` | 35 Testdateien, 308 Tests bestanden; 170,43 Sekunden, Start 20:07:25 Ortszeit |
| Vollständige Fixture-Demo | Alle sieben Agenten, 22 echte Browserprüfungen, simulierter lokaler Export; kein Versand |
| Optionaler Konzeptlauf | Drei tatsächlich gerenderte Konzepte, neun Bilder bei 375/768/1440 px, 66 Browserchecks ohne Fehler; wartet auf Auswahl |
| Konzeptgalerie | Bei 1440 und 375 px im Browser geprüft: drei Karten, sechs geladene Bilder, kein seitlicher Überlauf, keine Browserfehler, kein Formular, `noindex` |
| `pnpm designs:check` | Sieben Varianten bei 375/768/1440 px, 21 aktuelle PNGs, 154 Browserchecks, kein Fehler |
| Formatierung und Diff | Prettier für alle geänderten/neuen TS-/TSX-Dateien sowie `git diff --check` bestanden |
| Unabhängiger Code-Review | Nach Korrektur der gefundenen QA-/Historienlücken keine verbleibenden wichtigen Findings |

Der vollständige Fixture-Demolauf hat die ID `90941161-16a1-4250-ae4e-9829b2cc70e3`. Ergebnis: `work/design-upgrade-final-demo-result.json`. Seine Betreiberfreigaben und Sales-Ausgabe sind ausdrücklich simuliert. Das prüft den bestehenden Ablauf, nicht die Qualität eines Live-Modells.

Die sichtbare Konzeptgalerie verwendet `design-upgrade-preview`, Revision **16**, Status `concept_review / waiting_approval`. Die vorherige Fassung wurde nach den Renderer-Korrekturen über den vorhandenen Revisionsweg erneuert. Der aktuelle Review-Hash ist `43b0fb647b17858ddcca303bf5e6a5c2622bfa377353786fc5325afff2b9f43c`; bei späteren Änderungen immer den frisch ausgegebenen Wert verwenden.

### Aktuelle Screenshot-Belege

Alle Pfade beziehen sich auf den oben genannten Factory-Ordner. Galerie und alle drei aktuellen mobilen Konzeptbilder wurden tatsächlich geöffnet und visuell angesehen. Die technischen Browserläufe verwendeten das installierte Chrome; das separate Playwright-Browserpaket ist auf diesem Rechner nicht installiert.

- Galerie Desktop: `work/design-upgrade-local/gallery-desktop.png`
- Galerie Mobil: `work/design-upgrade-local/gallery-mobile.png`
- Galeriebefunde: `work/design-upgrade-local/gallery-browser-checks.json`
- Konzeptmanifest mit allen neun Screenshotpfaden, Hashes und Browserbefunden: `work/design-upgrade-concepts-final.json`
- Aktuelle Konzeptbilder liegen unter `work/design-upgrade-local/artifacts/lead-691e99fd-e943-4720-ac42-0127d9db6eae/concept_previews-bef52660-66e2-404d-a0b1-33045b9ece16/CONCEPT_ID/screenshots/root-375.png`, entsprechend `root-768.png` und `root-1440.png`.
- `CONCEPT_ID`: `concept-4a4c92c88489bd15` für Editorial, `concept-12c70c78dfbf0fd3` für Leistungsindex, `concept-f25b31fb2b8d9adc` für Plakat.
- Zusätzliche mobile Salonprüfung: `work/design-profile-review/2026-09-22/haarschnitte-editorial-spread-mobile.png`, `haarschnitte-service-index-mobile.png`, `haarschnitte-type-poster-mobile.png`. Der Wortumbruch und die überlappenden Posterzeilen wurden anhand dieser Bilder korrigiert; das letzte Posterbild wurde erneut geöffnet.
- Vollständiges Testprotokoll: `work/design-upgrade-tests-final.log`.
- Abschliessender Siebenervergleich: `work/design-showcase/2026-09-22T18-10-31.085Z/`; je Variante `checks/VARIANTE/root-375.png`, `root-768.png`, `root-1440.png`. Aus diesem letzten Lauf wurden Editorial und Leistungsindex bei 1440 px sowie das Plakat bei 375 px tatsächlich geöffnet. Alle 21 Bilder wurden erzeugt, nicht jedes einzeln manuell beurteilt. Übersicht `showcase.json`, technische Ergebnisse `VARIANTE-checks.json`, Befehlsausgabe `work/design-upgrade-showcase.log`.

Screenshotdateien und synthetische Laufdaten liegen absichtlich im von Git ausgeschlossenen `work/`. Die Befehle unter «Lokal ansehen» erzeugen sie auf einem anderen Checkout erneut.

### Geänderte und neue Dateien dieses Auftrags

- `config/design-exploration.fixture.json`
- `docs/DESIGN-UPGRADE-2026-09-22.md`
- `docs/superpowers/plans/2026-09-22-factory-design-upgrade.md`
- `prompts/builder.ts`
- `prompts/common.ts`
- `prompts/design-exploration.ts`
- `prompts/qa.ts`
- `prompts/sales.ts`
- `prompts/strategist.ts`
- `README.md`
- `scripts/design-showcase.ts`
- `spec/contracts.schema.json`
- `src/agents.ts`
- `src/browser-tests.ts`
- `src/cli.ts`
- `src/concept-preview.ts`
- `src/config.ts`
- `src/copy-policy.ts`
- `src/design-capabilities.ts`
- `src/design-concepts.ts`
- `src/design-diversity.ts`
- `src/design-policy.ts`
- `src/design-research.ts`
- `src/design-styles.ts`
- `src/fixtures.ts`
- `src/model-contracts.ts`
- `src/orchestrator.ts`
- `src/provider.ts`
- `src/renderer.tsx`
- `src/visual-qa.ts`
- `src/workflow.ts`
- `tests/browser-tests.test.ts`
- `tests/concept-preview.test.ts`
- `tests/copy-policy.test.ts`
- `tests/design-capabilities.test.ts`
- `tests/design-concepts.test.ts`
- `tests/design-exploration-provider.test.ts`
- `tests/design-history.test.ts`
- `tests/design-orchestration.test.ts`
- `tests/design-policy.test.ts`
- `tests/design-research.test.ts`
- `tests/design-upgrade-contracts.test.ts`
- `tests/fixtures.test.ts`
- `tests/renderer.test.ts`
- `tests/visual-qa.test.ts`
