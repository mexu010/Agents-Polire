const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const json = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({ '<': '\\u003C', '>': '\\u003E', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' })[char]);
const navItems = [['/', 'Start'], ['/salon/', 'Salon'], ['/besuch/', 'Besuch'], ['/journal/', 'Journal'], ['/kontakt/', 'Kontakt']];
const safeAsset = path => typeof path === 'string' && /^\/assets\/[\w./-]+$/.test(path) && !path.includes('..') ? path : '';
const href = phone => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;
const emailHref = email => `mailto:${encodeURIComponent(String(email ?? ''))}`;
const addressText = b => `${b.street}, ${b.postalCode} ${b.city}`;
const address = b => `<address>${esc(b.street)}<br>${esc(b.postalCode)} ${esc(b.city)}</address>`;
const link = (path, label, className = 'text-link') => `<a class="${className}" href="${path}">${label}<span aria-hidden="true"> ↗</span></a>`;
const heading = value => esc(value).replace(/\r?\n/g, '<br>');

function hours(content) {
  return `<dl class="hours-list">${(content.hours || []).map(row => `<div><dt>${esc(row.day)}</dt><dd>${esc(row.hours)}</dd></div>`).join('')}</dl>`;
}

function notice(content) {
  return content.notice ? `<aside class="notice" aria-label="Aktueller Hinweis"><span>Aktueller Hinweis</span><p>${esc(content.notice)}</p></aside>` : '';
}

function scene(content) {
  const asset = safeAsset(content.heroImage);
  if (!asset) return '';
  const symbolic = asset === '/assets/salon-stilllife.webp';
  const responsive = symbolic ? ' srcset="/assets/salon-stilllife-small.webp 560w, /assets/salon-stilllife.webp 1122w" sizes="(max-width: 760px) calc(100vw - 48px), 54vw"' : '';
  return `<figure class="scene-wrap${symbolic ? ' scene-symbolic' : ' scene-upload'}"><div class="scene"><img src="${esc(asset)}"${responsive} alt="${esc(content.heroAlt)}" fetchpriority="high"${symbolic ? ' width="1122" height="1402"' : ''}></div>${symbolic ? '<figcaption>Symbolbild · keine Aufnahme des Salons</figcaption>' : ''}</figure>`;
}

function contactShort(b, heading = 'Wir freuen uns auf Ihre Nachricht.') {
  return `<section class="contact-band section-wrap"><div><h2>${esc(heading)}</h2><p>Für Fragen und Terminanfragen sind wir telefonisch oder per Nachricht erreichbar.</p></div><div class="contact-band-actions">${link('/kontakt/', 'Kontakt aufnehmen', 'button button-solid')}<a class="text-link" href="${esc(href(b.phone))}">${esc(b.phone)} <span aria-hidden="true">↗</span></a></div></section>`;
}

function home(content) {
  const b = content.business;
  return `<section class="hero section-wrap"><div class="hero-heading"><p class="eyebrow">${esc(content.home.eyebrow)}</p><h1>${heading(content.home.headline)}</h1></div><div class="hero-spread${safeAsset(content.heroImage) ? '' : ' is-text-only'}">${scene(content)}<div class="hero-copy"><div><h2>${esc(b.person)}</h2><p class="lead">${esc(content.home.intro)}</p><div class="hero-actions">${link('/kontakt/', 'Termin anfragen', 'button button-solid')}<a class="quiet-link" href="${esc(href(b.phone))}">Oder anrufen: ${esc(b.phone)}</a></div></div><div class="hero-location">${address(b)}${link('/salon/', 'Den Salon kennenlernen')}</div></div></div></section>${notice(content)}
  <section class="visit-preview section-wrap" aria-labelledby="visit-title"><div class="visit-heading"><h2 id="visit-title">Ihr Besuch <br>bei uns.</h2><p>${esc(content.visit.intro)}</p>${link('/besuch/', 'Anfahrt ansehen')}</div><div class="preview-hours"><h3>Öffnungszeiten</h3>${hours(content)}</div><div class="preview-contact"><h3>Kontakt &amp; Termin</h3><dl><div><dt>Telefon</dt><dd><a href="${esc(href(b.phone))}">${esc(b.phone)}</a></dd></div><div><dt>E-Mail</dt><dd><a href="${esc(emailHref(b.email))}">${esc(b.email)}</a></dd></div></dl><p class="small-note">Eine Anfrage ist noch keine Terminbestätigung.</p></div></section>`;
}

function salon(content) {
  const b = content.business;
  return `<section class="page-intro section-wrap salon-intro"><div class="salon-heading"><p class="eyebrow">Der Salon</p><h1>${heading(content.salon.headline)}</h1></div><div class="salon-spread${safeAsset(content.heroImage) ? '' : ' is-text-only'}"><div class="salon-copy"><h2>${esc(b.person)}</h2><p class="lead">${esc(content.salon.intro)}</p>${link('/kontakt/', 'Termin anfragen', 'button button-solid')}</div>${scene(content)}</div></section>${notice(content)}
  <section class="place-strip section-wrap"><div><p class="eyebrow">Der Standort</p><h2>${esc(b.city)}</h2></div><div>${address(b)}<a class="text-link" href="${esc(href(b.phone))}">${esc(b.phone)}</a></div>${link('/besuch/', 'Besuch planen')}</section>${contactShort(b, 'Sprechen wir über Ihren Besuch.')}`;
}

function visit(content) {
  const b = content.business;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(b))}`;
  return `<section class="page-intro section-wrap narrow"><p class="eyebrow">Besuch</p><h1>Gut zu finden.<br>Gut zu wissen.</h1><p class="lead">${esc(content.visit.intro)}</p></section>
  <section class="visit-grid section-wrap"><div class="visit-address"><h2>Hier finden Sie uns</h2>${address(b)}<a class="text-link" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">In Google Maps öffnen <span aria-hidden="true">↗</span></a></div><div class="visit-hours"><h2>Öffnungszeiten</h2>${hours(content)}<p class="small-note">Termine und kurzfristige Änderungen bitte direkt beim Salon erfragen.</p></div></section>${notice(content)}
  <section class="detail-section section-wrap"><h2>Vor Ihrem Besuch</h2><div><p>Rufen Sie für eine Terminabsprache an. Eine Nachricht über das Kontaktformular ist eine Anfrage; der Termin steht erst nach einer persönlichen Bestätigung fest.</p><a class="text-link" href="${esc(href(b.phone))}">${esc(b.phone)} <span aria-hidden="true">↗</span></a></div></section>${contactShort(b, `Bis bald in ${b.city}.`)}`;
}

function contact(content, opts) {
  const b = content.business;
  return `<section class="page-intro section-wrap narrow"><p class="eyebrow">Kontakt</p><h1>Wir hören gerne<br>von Ihnen.</h1><p class="lead">${esc(content.contact.intro)}</p></section>
  <section class="contact-grid section-wrap"><div class="contact-details"><h2>Direkt erreichen</h2><dl><div><dt>Telefon</dt><dd><a href="${esc(href(b.phone))}">${esc(b.phone)}</a></dd></div><div><dt>Mobil</dt><dd><a href="${esc(href(b.mobile))}">${esc(b.mobile)}</a></dd></div><div><dt>E-Mail</dt><dd><a href="${esc(emailHref(b.email))}">${esc(b.email)}</a></dd></div><div><dt>Adresse</dt><dd>${address(b)}</dd></div></dl><p>${link('/besuch/', 'Öffnungszeiten und Anfahrt')}</p></div>
  <div class="form-panel"><h2>Nachricht schreiben</h2>${opts.stage !== 'production' ? '<p class="review-notice">Im Testbetrieb wird keine E-Mail versendet. Ihre Nachricht wird nur im geschützten Posteingang dieser Vorschau gespeichert.</p>' : ''}<noscript><p>Für das Formular benötigen Sie JavaScript. Bitte rufen Sie uns an oder schreiben Sie eine E-Mail.</p></noscript>
  <form id="contact-form" action="/api/contact" method="post" novalidate><input type="hidden" name="formToken" value="${esc(opts.formToken)}"><input type="hidden" name="formStartedAt" value="${esc(opts.formStartedAt)}"><div class="honeypot" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
  <div class="form-row"><div class="field"><label for="contact-name">Name <span aria-hidden="true">*</span></label><input id="contact-name" name="name" autocomplete="name" minlength="2" maxlength="100" aria-describedby="error-name" required><small class="field-error" id="error-name" data-error-for="name"></small></div><div class="field"><label for="contact-email">E-Mail <span aria-hidden="true">*</span></label><input id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" aria-describedby="error-email" required><small class="field-error" id="error-email" data-error-for="email"></small></div></div>
  <div class="field"><label for="contact-phone">Telefon <span class="optional">optional</span></label><input id="contact-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" aria-describedby="error-phone"><small class="field-error" id="error-phone" data-error-for="phone"></small></div>
  <div class="field"><label for="contact-message">Ihre Nachricht <span aria-hidden="true">*</span></label><textarea id="contact-message" name="message" rows="6" minlength="10" maxlength="3000" aria-describedby="error-message" required></textarea><small class="field-error" id="error-message" data-error-for="message"></small></div>
  <div class="consent-field"><input id="contact-consent" name="consent" type="checkbox" aria-describedby="error-consent" required><label for="contact-consent">Ich bin einverstanden, dass meine Angaben zur Bearbeitung dieser Anfrage gespeichert und verwendet werden. <a href="/datenschutz/">Datenschutzhinweise</a></label></div><small class="field-error" id="error-consent" data-error-for="consent"></small>
  <p class="form-help">Pflichtfelder sind mit * markiert. Ihre Anfrage ist keine Terminbestätigung.</p><div class="form-bottom"><button class="button button-solid" type="submit">Nachricht senden</button><p class="form-status" id="contact-status" role="status" aria-live="polite"></p></div></form></div></section>`;
}

function journal(content) {
  const articles = (content.articles || []).filter(a => a.status === 'published');
  return `<section class="page-intro section-wrap narrow"><p class="eyebrow">Journal</p><h1>Aus dem Salon.</h1><p class="lead">Neuigkeiten und Gedanken von ${esc(content.business.name)} finden Sie hier, sobald sie veröffentlicht sind.</p></section>
  <section class="journal-section section-wrap">${articles.length ? `<div class="article-list">${articles.map(article => `<article><time datetime="${esc(article.date)}">${esc(formatDate(article.date))}</time><div><h2><a class="journal-entry-link" href="/journal/${encodeURIComponent(article.slug)}/">${esc(article.title)}</a></h2><p>${esc(article.excerpt)}</p></div><a class="article-arrow" href="/journal/${encodeURIComponent(article.slug)}/" aria-label="${esc(article.title)} lesen">↗</a></article>`).join('')}</div>` : `<div class="journal-empty"><h2>Hier entsteht etwas Neues.</h2><p>Aktuell sind noch keine Beiträge veröffentlicht. Für Fragen erreichen Sie uns direkt.</p>${link('/kontakt/', 'Kontakt aufnehmen')}</div>`}</section>`;
}

function formatDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00Z`) : null;
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) : '';
}

function articlePage(article) {
  const paragraphs = String(article.body ?? '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<article class="article-page section-wrap"><a class="back-link" href="/journal/">← Zum Journal</a><header><time datetime="${esc(article.date)}">${esc(formatDate(article.date))}</time><h1>${esc(article.title)}</h1><p class="lead">${esc(article.excerpt)}</p></header><div class="article-body">${paragraphs}</div></article>`;
}

function legal(content, type, opts) {
  const b = content.business;
  const l = content.legal || {};
  if (type === 'impressum') return `<section class="page-intro section-wrap narrow"><p class="eyebrow">Rechtliches</p><h1>Impressum.</h1></section><section class="legal section-wrap"><h2>Kontaktangaben</h2><p>${esc(b.name)}<br>${esc(b.person)}<br>${esc(b.street)}<br>${esc(b.postalCode)} ${esc(b.city)}<br>Schweiz</p><p>Telefon: <a href="${esc(href(b.phone))}">${esc(b.phone)}</a><br>E-Mail: <a href="${esc(emailHref(b.email))}">${esc(b.email)}</a></p>${opts.stage !== 'production' ? '<p class="legal-caution">Vorschau: Rechtliche Betreiberangaben müssen vor der Veröffentlichung durch die Inhaberin bestätigt und ergänzt werden.</p>' : ''}</section>`;
  const privacyEmail = l.privacyContact || b.email;
  return `<section class="page-intro section-wrap narrow"><p class="eyebrow">Rechtliches</p><h1>Datenschutz.</h1></section><section class="legal section-wrap"><h2>Kontakt und Verantwortlichkeit</h2><p>${esc(b.name)}, ${esc(b.person)}, ${esc(addressText(b))}. Fragen zum Datenschutz: <a href="${esc(emailHref(privacyEmail))}">${esc(privacyEmail)}</a>.</p><h2>Kontaktformular</h2><p>Wenn Sie uns eine Nachricht senden, speichern wir Name, E-Mail-Adresse, eine freiwillig angegebene Telefonnummer, Ihre Nachricht und den Zeitpunkt der Anfrage. Wir verwenden diese Angaben zur Bearbeitung Ihrer Anfrage. Die Übermittlung ist freiwillig; ohne die Pflichtangaben können wir die Anfrage nicht beantworten. Erledigte Anfragen werden nach 90 Tagen gelöscht; offene Anfragen bleiben bis zur Bearbeitung gespeichert.</p><h2>Statistik und technische Daten</h2><p>Wir zählen Seitenaufrufe und ungefähre Besucherzahlen ohne externe Analysedienste. Dazu verwenden wir täglich wechselnde pseudonyme Kennungen auf Basis der IP-Adresse, ohne die rohe IP-Adresse für die Statistik zu speichern. Die Kennungen werden am Folgetag entfernt; zusammengefasste Zählwerte bleiben bis zu 400 Tage erhalten. Do Not Track und Global Privacy Control werden berücksichtigt. Auf der öffentlichen Seite setzen wir keine Cookies. Für die geschützte Verwaltung ist ein Sitzungscookie notwendig.</p><h2>Sicherung und Hosting</h2><p>Die Datenbank wird täglich gesichert. Tägliche Datenbanksicherungen werden nach 7 Tagen gelöscht; wöchentliche Quellstandsicherungen nach 28 Tagen.</p>${l.hostingProvider ? `<p>Hosting-Anbieter: ${esc(l.hostingProvider)}${l.hostingCountry ? `, Standort: ${esc(l.hostingCountry)}` : ''}.</p>` : ''}${l.additionalPrivacy ? `<h2>Weitere Hinweise</h2><p>${esc(l.additionalPrivacy).replace(/\n/g, '<br>')}</p>` : ''}<h2>Ihre Rechte</h2><p>Sie können Auskunft, Berichtigung oder Löschung Ihrer Angaben verlangen. Schreiben Sie uns dafür an die genannte E-Mail-Adresse. Gesetzliche Aufbewahrungspflichten bleiben vorbehalten.</p>${opts.stage !== 'production' ? '<p class="legal-caution">Vorschau: Dieser Text muss vor der Veröffentlichung rechtlich geprüft und um die tatsächlichen Betriebs- und Hostingangaben ergänzt werden.</p>' : ''}</section>`;
}

function missing(content) {
  return `<section class="page-intro section-wrap narrow"><p class="eyebrow">404</p><h1>Seite nicht gefunden.</h1><p class="lead">Dieser Weg führt hier nicht weiter. Über die Startseite finden Sie zurück zu ${esc(content.business.name)}.</p>${link('/', 'Zur Startseite', 'button button-solid')}</section>`;
}

export function renderPage(pathname, content, options = {}) {
  const opts = { origin: '', stage: 'review', nonce: '', formToken: '', formStartedAt: '', ...options };
  const b = content.business;
  const origin = (() => { try { const u = new URL(opts.origin); return ['http:', 'https:'].includes(u.protocol) ? u.origin : ''; } catch { return ''; } })();
  let path = String(pathname || '/').split(/[?#]/)[0];
  if (!path.startsWith('/')) path = `/${path}`;
  const published = (content.articles || []).filter(a => a.status === 'published');
  const slug = /^\/journal\/([^/]+)\/$/.exec(path)?.[1];
  let decodedSlug = '';
  try { decodedSlug = slug ? decodeURIComponent(slug) : ''; } catch { decodedSlug = ''; }
  const article = decodedSlug ? published.find(a => a.slug === decodedSlug) : null;
  const pages = {
    '/': ['Start', home(content)], '/salon/': ['Salon', salon(content)],
    '/besuch/': ['Besuch', visit(content)], '/kontakt/': ['Kontakt', contact(content, opts)],
    '/journal/': ['Journal', journal(content)], '/impressum/': ['Impressum', legal(content, 'impressum', opts)],
    '/datenschutz/': ['Datenschutz', legal(content, 'datenschutz', opts)],
  };
  const [title, body] = pages[path] || (article ? [article.title, articlePage(article)] : ['Seite nicht gefunden', missing(content)]);
  const status = pages[path] || article ? 200 : 404;
  const description = path === '/' ? content.home.intro : path === '/salon/' ? content.salon.intro : path === '/besuch/' ? content.visit.intro : path === '/kontakt/' ? content.contact.intro : article ? article.excerpt : `${title} bei ${b.name} in ${b.city}.`;
  const canonical = `${origin}${path}`;
  const days = { Montag: 'Monday', Dienstag: 'Tuesday', Mittwoch: 'Wednesday', Donnerstag: 'Thursday', Freitag: 'Friday', Samstag: 'Saturday', Sonntag: 'Sunday' };
  const openingHoursSpecification = (content.hours || []).flatMap(row => {
    const times = /^(\d{2}:\d{2})[–-](\d{2}:\d{2})$/.exec(String(row.hours).replace(/\s/g, ''));
    return days[row.day] && times ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: days[row.day], opens: times[1], closes: times[2] }] : [];
  });
  const salonSchema = { '@type': 'HairSalon', name: b.name, url: origin || undefined, telephone: b.phone, email: b.email, address: { '@type': 'PostalAddress', streetAddress: b.street, postalCode: b.postalCode, addressLocality: b.city, addressCountry: 'CH' }, openingHoursSpecification };
  const schema = { '@context': 'https://schema.org', '@graph': [salonSchema, ...(article ? [{ '@type': 'BlogPosting', headline: article.title, description: article.excerpt, datePublished: article.date, mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: b.name } }] : [])] };
  const nav = navItems.map(([url, label]) => `<a href="${url}"${path === url || (url === '/journal/' && article) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const socialImage = safeAsset(content.heroImage);
  const socialImageMeta = socialImage && origin ? `<meta property="og:image" content="${esc(origin + socialImage)}"><meta property="og:image:alt" content="${esc(content.heroAlt)}">` : '';
  const html = `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | ${esc(b.name)}</title><meta name="description" content="${esc(description)}">${opts.stage !== 'production' || status === 404 ? '<meta name="robots" content="noindex, nofollow">' : ''}<link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)} | ${esc(b.name)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${socialImageMeta}<meta name="theme-color" content="#f8f9f9"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/satoshi-500.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/site.css"><script type="application/ld+json"${opts.nonce ? ` nonce="${esc(opts.nonce)}"` : ''}>${json(schema)}</script><script src="/assets/site.js" defer${opts.nonce ? ` nonce="${esc(opts.nonce)}"` : ''}></script></head><body data-stage="${esc(opts.stage)}" data-page-status="${status}"><a class="skip-link" href="#main">Zum Inhalt springen</a><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="${esc(b.name)}: Startseite"><img src="/assets/coiffeur-lanz-logo.png" width="972" height="449" alt=""><span>${esc(b.name)}</span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav"><span>Menü</span><span class="menu-icon" aria-hidden="true"></span></button><nav id="main-nav" class="main-nav" aria-label="Hauptnavigation">${nav}</nav><a class="header-call" href="${esc(href(b.phone))}">Anrufen <span aria-hidden="true">↗</span></a></div></header><main id="main" tabindex="-1">${body}</main><footer class="site-footer"><div class="footer-main section-wrap"><a class="footer-brand" href="/">${esc(b.name)}<span>${esc(b.city)}</span></a><div><h2>Besuch</h2>${address(b)}${link('/besuch/', 'Anfahrt ansehen')}</div><div><h2>Kontakt</h2><a href="${esc(href(b.phone))}">${esc(b.phone)}</a><a href="${esc(emailHref(b.email))}">${esc(b.email)}</a></div></div><div class="footer-bottom section-wrap"><span>© ${new Date().getFullYear()} ${esc(b.name)}</span><div><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a></div></div></footer></body></html>`;
  return { status, html };
}
