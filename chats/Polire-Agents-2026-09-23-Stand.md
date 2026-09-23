# Letzte Projektentscheidungen: POLIRE Agents

Stand: 23. September 2026. Dies ist eine Zusammenfassung sichtbarer Nutzerentscheidungen und überprüfter Projektergebnisse, kein vollständiger Chat-Export und kein Export interner Modellüberlegungen. Ältere verfügbare Nachrichten liegen in den anderen Dateien dieses Ordners.

- Der Nutzer beauftragte ein Designupgrade der bestehenden Factory: echte Quellen/Bildinputs, unterschiedliche Layouts, faktgebundene individuellere Texte, Vergleich früherer Projekte, visuelle QA und optionale Mini-Vorschauen. Kein Architekturwechsel und keine weiteren kostenpflichtigen Live-Läufe.
- Danach wurde Coiffeur Lanz separat überarbeitet. Der Nutzer wählte aus drei Mini-Entwürfen die Richtung B. Diese Richtung ist in der vollständigen Anwendung mit Verwaltung umgesetzt.
- Der Nutzer bat um einen Upload und präzisierte: vollständiger Betrieb mit Verwaltung. Ein Hosting-Paket und eine Render-Konfiguration wurden vorbereitet. Das ist noch kein erfolgtes Deployment.
- Im anschliessenden Gespräch wurden Vercel, einzelne Render-Dienste, ein gemeinsamer Server und ein zweiter Ausfallserver besprochen. Diese Überlegungen sind keine gebuchten Dienste oder implementierte Hochverfügbarkeit.
- Die zuletzt gewählte Richtung lautet: ein eigener kleiner Dienst je Kunde. Zunächst soll der Nutzer den Plan mit Aufbau und Kosten prüfen. Der Hostingplan liegt unter `website-factory/docs/superpowers/plans/2026-09-23-polire-kundenhosting.md`.
- Anschliessend bat der Nutzer ausdrücklich darum, alles auf GitHub zu pushen. Die aktuellen Factory-/Lanz-Änderungen, Pläne, bereitgestellten Designunterlagen und öffentlichen Testbilder werden daher auf einem separaten Sicherungsbranch gesammelt. Zugangsdaten und private Laufzeitdaten werden nicht übertragen.

Aktuelle technische Nachweise: `website-factory/docs/GITHUB-STAND-2026-09-23.md`. Historische Aussagen in früheren Chats sind gegen den aktuellen Quellcode und diese Nachweise zu prüfen.
