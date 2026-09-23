import { initialContent } from '../content.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const concepts = {
  a: { title: 'Persönlich und einladend', short: 'Bei Vreni', description: 'Eine persönliche Begrüssung und eine Kontaktkarte. Der Salon erhält ein Gesicht durch seinen Namen und seinen Ort, auch ohne Porträtfoto.', headline: 'Bei Vreni Lanz.\nIn Bleienbach.', assetNote: 'Ohne Symbolfoto. Ein freigegebenes Porträt wäre später eine mögliche Ergänzung, keine Voraussetzung.' },
  b: { title: 'Redaktionell und ausdrucksstark', short: 'Der Salon als Editorial', description: 'Eine klare Titelzeile, ein bewusst gesetzter Bildausschnitt und eine seitliche Kontaktspalte. Besuchsinformationen bilden den ruhigen Abschluss.', headline: 'Coiffeur Lanz.\nIn Bleienbach.', assetNote: 'Das Stillleben ist ein vorhandenes KI-Symbolbild. Es zeigt weder den Salon noch eine Kundenarbeit.' },
  c: { title: 'Grafisch und fotoarm', short: 'Der Salon-Aushang', description: 'Name, Ort und Öffnungszeiten werden selbst zur Gestaltung. Eine kompakte Informationstafel mit kräftigen Schriftgewichten und klaren Flächen.', headline: 'Coiffeur\nLanz.', assetNote: 'Bewusst ohne Foto. Original-Logo und präzise gesetzte Informationen tragen den Entwurf.' },
};

const address = b => `${esc(b.street)}<br>${esc(b.postalCode)} ${esc(b.city)}`;
const heading = text => esc(text).replaceAll('\n', '<br>');
const logo = b => `<img class="original-logo" src="/assets/coiffeur-lanz-logo.png" alt="${esc(b.name)}" width="972" height="449">`;
const action = (label = 'Termin anfragen') => `<a class="action" href="#kontakt">${label}</a>`;
const hours = content => `<dl class="hours">${content.hours.map(row => `<div${row.hours === 'Geschlossen' ? ' class="closed"' : ''}><dt>${esc(row.day)}</dt><dd>${esc(row.hours)}</dd></div>`).join('')}</dl>`;
const contacts = content => `<dl class="contacts"><div><dt>Telefon</dt><dd>${esc(content.business.phone)}</dd></div><div><dt>E-Mail</dt><dd>${esc(content.business.email)}</dd></div></dl>`;
const note = content => content.notice ? `<aside class="notice"><strong>Aktueller Hinweis</strong><p>${esc(content.notice)}</p></aside>` : '';
const contactNote = '<p class="contact-note">Eine Anfrage ist noch keine Terminbestätigung.</p>';
const optionalContactNote = content => content.contact.intro.includes('Eine Anfrage ist noch keine Terminbestätigung.') ? '' : contactNote;

function header(b) {
  return `<header class="site-header"><a class="brand" href="#main" aria-label="${esc(b.name)}: Seitenanfang">${logo(b)}</a><nav aria-label="Vorschau-Navigation"><a href="#besuch">Besuch</a><a href="#kontakt">Kontakt</a></nav></header>`;
}

function personal(content) {
  const b = content.business;
  return `${header(b)}<main id="main"><section class="a-intro"><div class="a-welcome"><h1>${heading(content.home.headline)}</h1><p class="intro">${esc(content.home.intro)}</p>${action()}</div><aside class="a-card" aria-label="Salon und Standort"><div class="a-card-brand">${logo(b)}</div><div class="a-card-copy"><p class="a-person">${esc(b.person)}</p><address>${address(b)}</address></div><a class="plain-link" href="#besuch">Öffnungszeiten ansehen</a></aside></section>${note(content)}<section class="a-visit" id="besuch"><div class="a-contact" id="kontakt"><h2>Für Ihren Besuch.</h2><p>${esc(content.contact.intro)}</p>${contacts(content)}${optionalContactNote(content)}</div><div class="a-hours"><h2>Öffnungszeiten</h2>${hours(content)}</div></section></main>`;
}

function editorial(content) {
  const b = content.business;
  const image = content.heroImage === '/assets/salon-stilllife.webp' ? `<figure class="b-image"><img src="/assets/salon-stilllife.webp" alt="${esc(content.heroAlt)}" width="1122" height="1402" fetchpriority="high"><figcaption>Symbolbild · keine Aufnahme des Salons</figcaption></figure>` : '';
  return `${header(b)}<main id="main"><section class="b-intro"><h1>${heading(content.home.headline)}</h1><div class="b-spread">${image}<div class="b-side"><div><h2>${esc(b.person)}</h2><p>${esc(content.salon.intro)}</p>${action()}</div><address>${address(b)}</address></div></div></section>${note(content)}<section class="b-visit" id="besuch"><div class="b-visit-title"><h2>Ihr Besuch <br>bei Lanz.</h2><p>${esc(content.visit.intro)}</p></div><div class="b-practical"><div class="b-hours"><h3>Öffnungszeiten</h3>${hours(content)}</div><div id="kontakt" class="b-contact"><h3>Kontakt &amp; Termin</h3>${contacts(content)}${contactNote}</div></div></section></main>`;
}

function graphic(content) {
  const b = content.business;
  return `${header(b)}<main id="main"><section class="c-intro"><div class="c-name"><h1>${heading(content.home.headline)}</h1><p class="c-town">${esc(b.city)}</p></div><div class="c-next"><p class="c-person">Bei ${esc(b.person)}.</p><p>${esc(content.home.intro)}</p>${action()}<address>${address(b)}</address></div></section>${note(content)}<section class="c-board" id="besuch"><div class="c-hours"><h2>Wann passt <br>Ihr Besuch?</h2>${hours(content)}</div><div class="c-contact" id="kontakt"><h2>Kontakt.</h2><p>${esc(content.contact.intro)}</p>${contacts(content)}${optionalContactNote(content)}<div class="c-place"><span>${esc(b.street)}</span><span>${esc(b.postalCode)} ${esc(b.city)}</span></div></div></section></main>`;
}

export function renderConcept(id, source = initialContent) {
  if (!concepts[id]) return null;
  // Draft copy uses the existing editable field; the saved customer content is never written.
  const content = structuredClone(source);
  content.home.headline = id === 'a'
    ? `Bei ${content.business.person}.\nIn ${content.business.city}.`
    : id === 'b' ? `${content.business.name}.\nIn ${content.business.city}.`
      : content.business.name.replace(/\s+/, '\n') + '.';
  const body = { a: personal, b: editorial, c: graphic }[id](content);
  return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${esc(content.business.name)} · Entwurf ${id.toUpperCase()}</title><link rel="icon" href="/assets/favicon.svg"><link rel="stylesheet" href="/review/base.css"><link rel="stylesheet" href="/review/${id}.css"><meta name="color-scheme" content="light"></head><body class="concept-${id}"><div class="review-strip"><a href="/">Zur Auswahl</a><span>Entwurf ${id.toUpperCase()} · ${esc(concepts[id].title)}</span></div><a class="skip" href="#main">Zum Inhalt springen</a>${body}<footer class="review-footer"><span>${esc(content.business.name)} · ${esc(content.business.city)}</span><p>Gestaltungsvorschau. Kontaktangaben sind nur angezeigt; es wird keine Nachricht versendet.</p><a href="/">Die drei Richtungen vergleichen</a></footer></body></html>`;
}

export function renderGallery() {
  return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Coiffeur Lanz · Drei Richtungen</title><link rel="stylesheet" href="/review/base.css"><link rel="stylesheet" href="/review/compare.css"></head><body class="gallery"><main><header><p class="gallery-brand">POLIRE / Coiffeur Lanz</p><h1>Drei Richtungen.<br>Ein Salon.</h1><p class="gallery-intro">Drei Mini-Entwürfe zur Auswahl. Derselbe Salon, dieselben bestätigten Informationen, drei unterschiedliche Gestaltungen. Die bestehende Kundenwebsite bleibt unverändert.</p></header><div class="gallery-grid">${Object.entries(concepts).map(([id, concept]) => `<article><div class="gallery-title"><span class="letter">${id.toUpperCase()}</span><div><h2>${esc(concept.short)}</h2><p>${esc(concept.title)}</p></div></div><a class="capture-link" href="/${id}/" aria-label="Entwurf ${id.toUpperCase()} öffnen"><img class="desktop-capture" src="/captures/${id}-1440.png" width="1440" height="1000" alt="Tatsächliche Desktopansicht von Entwurf ${id.toUpperCase()}"></a><p class="description">${esc(concept.description)}</p><p class="asset-note">${esc(concept.assetNote)}</p><div class="gallery-actions"><a class="action" href="/${id}/">Entwurf ${id.toUpperCase()} ansehen</a><a class="plain-link" href="/captures/${id}-1440.png">Desktopbild</a><a class="plain-link" href="/captures/${id}-390.png">Mobilbild</a></div></article>`).join('')}</div><section class="decision"><h2>Welche Richtung passt zu Lanz?</h2><p>Schreib im Chat <strong>A, B oder C</strong> und gerne, was du daran behalten oder ändern möchtest. Erst danach wird eine Richtung auf die vollständige Website übertragen.</p><a href="http://127.0.0.1:4330/">Bisherige Gestaltung ansehen</a></section><p class="gallery-fine">Lokale Entwürfe. Kein Versand, keine Veröffentlichung. Echte Salon- und Porträtfotos sowie eine bestätigte Leistungsliste fehlen weiterhin.</p></main></body></html>`;
}
