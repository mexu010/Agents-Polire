export function renderAdmin() {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#172735">
  <title>Kundenbereich · Coiffeur Lanz</title>
  <link rel="stylesheet" href="/assets/admin.css">
  <script type="module" src="/assets/admin.js"></script>
</head>
<body>
  <div id="live-status" class="sr-only" role="status" aria-live="polite"></div>
  <main id="login-view" class="login-wrap" hidden>
    <div class="login-brand"><span class="brand-mark">L</span><span>Coiffeur Lanz<br><small>Kundenbereich</small></span></div>
    <section class="login-card" aria-labelledby="login-title">
      <p class="eyebrow">Willkommen zurück</p>
      <h1 id="login-title">Ihr Salon. Ihr Auftritt.</h1>
      <p class="muted">Melden Sie sich an, um Ihre Website zu pflegen.</p>
      <form id="login-form">
        <label for="password">Passwort</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <p id="login-error" class="message error" role="alert" hidden></p>
        <button class="button primary full" type="submit">Anmelden</button>
      </form>
    </section>
    <p class="login-foot">Ein privater Bereich für Coiffeur Lanz</p>
  </main>
  <div id="app-view" class="app" hidden>
    <aside class="sidebar">
      <a class="app-brand" href="/"><span class="brand-mark">L</span><span>Coiffeur Lanz<small>Website-Verwaltung</small></span></a>
      <nav class="side-nav" aria-label="Kundenbereich">
        <button type="button" data-tab="overview" aria-controls="panel-overview" aria-current="page">Übersicht</button>
        <button type="button" data-tab="content" aria-controls="panel-content">Inhalte</button>
        <button type="button" data-tab="journal" aria-controls="panel-journal">Journal</button>
        <button type="button" data-tab="inquiries" aria-controls="panel-inquiries">Anfragen <span id="inquiry-badge" class="badge" hidden></span></button>
        <button type="button" data-tab="operations" aria-controls="panel-operations">Betrieb</button>
      </nav>
      <div class="sidebar-foot"><a href="/" target="_blank" rel="noopener">Website ansehen ↗</a><button id="logout" type="button">Abmelden</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><button id="menu-toggle" class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav">Menü</button><span id="topbar-label">Übersicht</span><span id="stage-chip" class="stage-chip"></span></header>
      <nav id="mobile-nav" class="mobile-nav" aria-label="Kundenbereich mobil" hidden>
        <button type="button" data-tab="overview">Übersicht</button><button type="button" data-tab="content">Inhalte</button><button type="button" data-tab="journal">Journal</button><button type="button" data-tab="inquiries">Anfragen</button><button type="button" data-tab="operations">Betrieb</button>
      </nav>
      <main class="main-content">
        <p id="global-message" class="message" role="status" hidden></p>
        <section id="panel-overview" class="panel" aria-labelledby="overview-title">
          <div class="page-heading"><div><p class="eyebrow">Guten Tag</p><h1 id="overview-title">Alles im Blick</h1><p class="muted">Ihre Website im aktuellen Monat.</p></div><a class="button secondary" href="/" target="_blank" rel="noopener">Website öffnen ↗</a></div>
          <div id="review-note" class="notice-card" hidden></div>
          <div class="metric-grid"><article class="metric"><span>Seitenaufrufe</span><strong id="stat-views">–</strong></article><article class="metric"><span>Besucher ungefähr</span><strong id="stat-visitors">–</strong></article><article class="metric"><span>Neue Anfragen</span><strong id="stat-inquiries">–</strong></article></div>
          <div class="two-col"><article class="card"><h2>Häufig besuchte Seiten</h2><div id="top-pages" class="data-list"></div></article><article class="card"><h2>Zuletzt eingegangen</h2><div id="recent-inquiries" class="data-list"></div></article></div>
        </section>
        <section id="panel-content" class="panel" aria-labelledby="content-title" hidden>
          <div class="page-heading"><div><p class="eyebrow">Website pflegen</p><h1 id="content-title">Inhalte</h1><p class="muted">Texte, Öffnungszeiten und Startbild bearbeiten.</p></div><button class="button primary save-content" type="button">Änderungen speichern</button></div>
          <form id="content-form" class="stack" autocomplete="off">
            <article class="card"><div class="card-intro"><h2>Startseite</h2><p>Die erste Begrüssung für Ihre Besucher.</p></div><div class="form-grid"><label>Kleine Zeile<input name="home.eyebrow" maxlength="160"></label><label>Haupttitel<textarea name="home.headline" rows="2" maxlength="160" required></textarea></label><label class="wide">Einleitung<textarea name="home.intro" rows="4" maxlength="2000"></textarea></label></div></article>
            <article class="card"><div class="card-intro"><h2>Salon & Besuch</h2><p>Was Gäste über den Salon und den Besuch wissen sollen.</p></div><div class="form-grid"><label>Titel Salon<input name="salon.headline" maxlength="160"></label><label class="wide">Einleitung Salon<textarea name="salon.intro" rows="4" maxlength="2000"></textarea></label><label class="wide">Einleitung Besuch<textarea name="visit.intro" rows="4" maxlength="2000"></textarea></label></div></article>
            <article class="card"><div class="card-intro"><h2>Kontakt & Aktuelles</h2><p>Diese Angaben erscheinen auf der öffentlichen Website.</p></div><div class="form-grid"><label class="wide">Einleitung Kontakt<textarea name="contact.intro" rows="3" maxlength="2000"></textarea></label><label class="wide">Aktuelle Mitteilung<textarea name="notice" rows="3" maxlength="600" placeholder="Leer lassen, wenn es nichts Aktuelles gibt"></textarea></label></div></article>
            <article class="card"><div class="card-intro"><h2>Öffnungszeiten</h2><p>Schliessen Sie einen Tag mit «Geschlossen».</p></div><div id="hours-fields" class="hours-grid"></div></article>
            <article class="card"><div class="card-intro"><h2>Startbild</h2><p>PNG, JPG oder WebP, maximal 2 MB. Verwenden Sie nur Bilder, die Sie veröffentlichen dürfen.</p></div><div class="image-edit"><img id="hero-preview" alt="Aktuelles Startbild" hidden><div><label for="hero-file" class="button secondary file-label" tabindex="0">Bild auswählen</label><input id="hero-file" type="file" accept="image/png,image/jpeg,image/webp" tabindex="-1"><p id="hero-file-name" class="muted">Kein neues Bild ausgewählt</p></div></div><label>Bildbeschreibung<input name="heroAlt" maxlength="300" placeholder="Beschreiben Sie das Bild für Menschen mit Sehbehinderung"></label></article>
            <article class="card"><div class="card-intro"><h2>Rechtliche Angaben</h2><p>Bitte vor der Veröffentlichung mit den tatsächlichen Angaben ergänzen und prüfen.</p></div><div class="form-grid"><label>Hosting-Anbieter<input name="legal.hostingProvider" maxlength="250" placeholder="Name des Anbieters"></label><label>Hosting-Land<input name="legal.hostingCountry" maxlength="250" placeholder="Land der Datenhaltung"></label><label class="wide">Kontakt für Datenschutzfragen<input name="legal.privacyContact" maxlength="250" placeholder="Name oder Kontaktadresse"></label><label class="wide">Weitere Datenschutzangaben<textarea name="legal.additionalPrivacy" rows="5" maxlength="4000" placeholder="Nur bestätigte Angaben zum tatsächlichen Betrieb"></textarea></label></div></article>
            <div class="form-footer"><span id="content-save-state" class="muted">Alle Änderungen gespeichert</span><button class="button primary save-content" type="submit">Änderungen speichern</button></div>
          </form>
        </section>
        <section id="panel-journal" class="panel" aria-labelledby="journal-title" hidden>
          <div class="page-heading"><div><p class="eyebrow">Geschichten aus dem Salon</p><h1 id="journal-title">Journal</h1><p class="muted">Entwürfe schreiben und Beiträge veröffentlichen.</p></div><button id="new-article" class="button primary" type="button">Neuer Beitrag</button></div>
          <div class="two-col journal-layout"><article class="card"><h2>Beiträge</h2><div id="article-list" class="article-list"></div></article><article id="article-editor-card" class="card" hidden><h2 id="article-editor-title">Beitrag bearbeiten</h2><form id="article-form" class="stack"><label>Titel<input name="title" maxlength="160" required></label><label>Kurztext<textarea name="excerpt" rows="3" maxlength="500"></textarea></label><label>Text<textarea name="body" rows="12" maxlength="20000"></textarea></label><label>Datum<input name="date" type="date"></label><div class="form-footer"><button id="delete-draft" class="button danger" type="button">Entwurf entfernen</button><div class="button-row"><button id="save-draft" class="button secondary" type="submit" data-status="draft">Entwurf speichern</button><button id="publish-article" class="button primary" type="submit" data-status="published">Veröffentlichen</button></div></div></form></article></div>
        </section>
        <section id="panel-inquiries" class="panel" aria-labelledby="inquiries-title" hidden>
          <div class="page-heading"><div><p class="eyebrow">Kontaktformular</p><h1 id="inquiries-title">Anfragen</h1><p class="muted">Nachrichten von Ihrer Website. Antworten Sie über Ihr eigenes E-Mail-Programm.</p></div><button id="refresh-inquiries" class="button secondary" type="button">Aktualisieren</button></div>
          <div class="filter-row" role="group" aria-label="Anfragen filtern"><button type="button" class="filter active" data-filter="all">Alle</button><button type="button" class="filter" data-filter="new">Neu</button><button type="button" class="filter" data-filter="done">Erledigt</button></div><div id="inquiry-list" class="stack"></div>
        </section>
        <section id="panel-operations" class="panel" aria-labelledby="operations-title" hidden>
          <div class="page-heading"><div><p class="eyebrow">Verwaltung</p><h1 id="operations-title">Betrieb</h1><p class="muted">Sicherungen, Berichte und Vorbereitung der Veröffentlichung.</p></div></div>
          <p id="operations-warning" class="message error" role="alert" hidden></p>
          <div class="two-col"><article class="card"><h2>Datensicherung</h2><p id="backup-summary" class="muted"></p><div class="button-row"><button id="create-backup" class="button primary" type="button">Sicherung erstellen</button><button id="download-content" class="button secondary" type="button">Inhalte herunterladen</button></div><div id="backup-list" class="data-list"></div></article><article class="card"><h2>Monatsbericht</h2><p class="muted">Echte Zahlen zu Besuchen und Anfragen als Datei.</p><label for="report-month">Monat</label><div class="button-row"><input id="report-month" type="month"><button id="download-report" class="button secondary" type="button">Bericht herunterladen</button></div></article></div>
          <article class="card launch-card"><h2>Vor der Veröffentlichung</h2><p class="muted">Diese Punkte werden vor dem öffentlichen Start gemeinsam geprüft.</p><div id="launch-checks" class="check-list"></div></article>
        </section>
      </main>
    </div>
  </div>
</body>
</html>`;
}
