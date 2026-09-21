import { escapeHtml as e } from '../lib.mjs';
import { css } from './salon-dining/styles.mjs';

const asset = (lead, match, alt, className = '') => {
  const item = (lead.assets || []).find(a => a.path.includes(match));
  return item ? `<img class="${className}" src="../../${e(item.path)}" alt="${e(alt)}" loading="eager" decoding="async" width="${item.width}" height="${item.height}">` : '';
};
const action = label => `<button class="sd-action" type="button" data-demo-contact>${label}</button>`;
const header = (lead, brand, links, label) => `<header class="sd-header"><a class="sd-brand" href="#start" aria-label="${e(lead.name)}: zum Anfang">${brand}</a><button class="sd-menu" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false">Menü</button><nav id="site-nav" class="sd-nav" aria-label="Hauptnavigation">${links.map(([name,id]) => `<a href="#${id}">${name}</a>`).join('')}${action(label)}</nav></header>`;
const footer = (lead, address) => `<footer class="sd-footer"><strong>${e(lead.name)}</strong><span>${e(address)}</span><span>${e(lead.phone)}</span><a href="${e(lead.website)}" target="_blank" rel="noopener noreferrer">Original-Website ↗</a></footer>`;

function sopra(lead) {
  const html = `<div class="sd-site sd-sopra" id="start">
  ${header(lead, 'sopra<span class="sd-brand-dot">.</span>', [['Küche','kueche'],['Gastgeber','gastgeber'],['Besuch','besuch']], 'Reservation anfragen')}
  <main>
    <section class="so-hero"><div class="so-hero-top"><span>RESTAURANT SOPRA</span><span>ATTELWIL / AARGAU</span></div><div class="so-hero-core"><h1>Einfach<br><em>gut essen.</em></h1><div class="so-hero-side"><p>Mediterrane, italienische und Schweizer Küche in Attelwil.</p>${action('Reservation anfragen')}</div></div><div class="so-hero-bottom"><span>Hauptstrasse 56 · 5056 Attelwil</span><a href="#kueche">Zur Küche <span aria-hidden="true">↗</span></a></div></section>
    <section class="so-menu" id="kueche"><div class="so-menu-heading"><span>Aus der Küche</span><h2>Drei Richtungen.<br>Ein Tisch.</h2></div><div class="so-menu-index"><div><strong>Mediterran</strong></div><div><strong>Italienisch</strong></div><div><strong>Schweizerisch</strong></div></div><p>Auch für unterwegs: Takeaway gehört zum Angebot.</p></section>
    <section class="so-host" id="gastgeber"><div class="so-host-mark" aria-hidden="true">S</div><div><h2>Mit Freude<br>am Kochen.</h2><p>Veprim Ukaj ist Geschäftsführer und Koch. Im Sopra bringt er seine langjährige Erfahrung in der Gastronomie und seine Freude am Kochen an einen Tisch.</p></div></section>
    <section class="so-visit" id="besuch"><div><h2>Platz nehmen<br>in Attelwil.</h2><address>Hauptstrasse 56<br>5056 Attelwil</address>${action('Reservation anfragen')}</div><div class="so-contact"><span>Kontakt</span><strong>${e(lead.phone)}</strong><p>Die Öffnungszeiten und aktuelle Speisekarte finden Sie auf der Original-Website.</p></div></section>
  </main>${footer(lead, 'Hauptstrasse 56, 5056 Attelwil')}</div>`;
  return { html, css };
}

function wacker(lead) {
  const html = `<div class="sd-site sd-wacker" id="start">
  ${header(lead, '<span class="wa-brand">WACKER<small>RESTAURANT · REINACH</small></span>', [['Die Karte','karte'],['Mittag','mittag'],['Besuch','besuch']], 'Reservierung anfragen')}
  <main>
    <section class="wa-hero"><div class="wa-frame"><div class="wa-rule"><span>FLEISCHBACHSTRASSE 25</span><span>4153 REINACH</span></div><h1>Wacker<span class="wa-star" aria-hidden="true">✳</span></h1><p>Saisonale Küche, Klassiker und Weine.</p><div class="wa-hero-actions">${action('Reservierung anfragen')}<a href="#karte">Die Karte ansehen ↗</a></div><div class="wa-rule wa-bottom"><span>RESTAURANT</span><span>IN REINACH</span></div></div></section>
    <section class="wa-menu" id="karte"><div class="wa-menu-intro"><span>Auf der Karte</span><h2>Für jeden<br>Anlass am Tisch.</h2></div><div class="wa-menu-lines"><div><h3>Saisonale Küche<br>& Klassiker</h3></div><div><h3>Charbonnade<br>à discrétion</h3></div><div><h3>Weine</h3></div></div></section>
    <section class="wa-lunch" id="mittag"><div><span>Mittags</span><h2>Eine gute Pause<br>in Reinach.</h2></div><p>Wochenmenü und Business Lunch sind Teil des Angebots. Die aktuelle Auswahl finden Sie beim Restaurant.</p></section>
    <section class="wa-visit" id="besuch"><div><h2>Willkommen<br>im Wacker.</h2><address>Fleischbachstrasse 25<br>4153 Reinach</address></div><div class="wa-visit-aside"><p class="wa-holiday">Betriebsferien laut Wochenmenü-Hinweis: 21. September bis und mit 12. Oktober 2026. Bitte vor einem Besuch prüfen.</p><span>Kontakt</span><strong>${e(lead.phone)}</strong>${action('Reservierung anfragen')}</div></section>
  </main>${footer(lead, 'Fleischbachstrasse 25, 4153 Reinach')}</div>`;
  return { html, css };
}

function lanz(lead) {
  const logo = asset(lead, 'coiffeur-lanz-', 'Originales Logo von Coiffeur Lanz', 'la-logo');
  const html = `<div class="sd-site sd-lanz" id="start">
  ${header(lead, 'COIFFEUR LANZ', [['Willkommen','willkommen'],['Adresse','adresse'],['Kontakt','kontakt']], 'Termin anfragen')}
  <main>
    <section class="la-hero"><div class="la-hero-inner"><div class="la-logo-wrap">${logo}</div><div class="la-hero-copy"><span>Vreni Lanz · Bleienbach</span><h1>Für einen<br>neuen Schnitt.</h1><p>Coiffeur Lanz in Bleienbach.</p>${action('Termin anfragen')}</div></div></section>
    <section class="la-welcome" id="willkommen"><span class="la-small">Willkommen</span><h2>Bei Vreni Lanz.</h2><p>Ein Salon mit einer klaren Adresse in Bleienbach. Für einen Termin oder Fragen erreichen Sie Coiffeur Lanz direkt.</p></section>
    <section class="la-address" id="adresse"><div class="la-place"><span>Hier finden Sie uns</span><h2>Bleienbach<span aria-hidden="true">.</span></h2></div><address>Eichi 20<br>3368 Bleienbach</address></section>
    <section class="la-contact" id="kontakt"><div><span>Kontakt</span><h2>Wir hören<br>von Ihnen.</h2></div><div><p>Telefon ${e(lead.phone)}<br>Mobil 079 713 62 32<br>info@coiffeurlanz.ch</p>${action('Termin anfragen')}</div></section>
  </main>${footer(lead, 'Eichi 20, 3368 Bleienbach')}</div>`;
  return { html, css };
}

function hairstudio(lead) {
  const logo = asset(lead, 'hairstudio-f-', 'Originales Logo von Hairstudio F', 'hf-logo');
  const html = `<div class="sd-site sd-hairstudio" id="start">
  ${header(lead, 'HAIRSTUDIO <i>F</i>', [['Angebot','angebot'],['Studio','studio'],['Besuch','besuch']], 'Termin anfragen')}
  <main>
    <section class="hf-hero"><div class="hf-logo-strip">${logo}</div><div class="hf-hero-type"><h1>Cut, Colors<br><i>& more.</i></h1><div class="hf-hero-right"><p>Hairstudio F in Fehraltorf. Schnitt, Farbe und mehr an der Bahnhofstrasse 12.</p>${action('Termin anfragen')}</div></div><span class="hf-f" aria-hidden="true">F</span></section>
    <section class="hf-offer" id="angebot"><h2>Was passt<br>zu Ihnen?</h2><div class="hf-offer-grid"><div><b>Cut</b><p>Waschen, schneiden, föhnen</p></div><div><b>Colors</b><p>Färben, tönen und Mèches</p></div><div><b>More</b><p>Dauerwelle, Augenbrauen und Wimpern</p></div></div></section>
    <section class="hf-studio" id="studio"><div class="hf-studio-word" aria-hidden="true">F.</div><div><h2>F wie<br>Fehraltorf.</h2><p>Fiorina Provenzano begrüsst Sie im Hairstudio F. Der Salon ist rollstuhlgängig und ein Kundenparkplatz befindet sich vor dem Haus.</p></div></section>
    <section class="hf-visit" id="besuch"><div><h2>Bis bald.</h2><address>Bahnhofstrasse 12<br>8320 Fehraltorf</address></div><div><p class="hf-note">Ferienhinweis der Website: 24. bis und mit 26. September 2026; ab 28. September wieder da.</p><p>${e(lead.phone)}</p>${action('Termin anfragen')}</div></section>
  </main>${footer(lead, 'Bahnhofstrasse 12, 8320 Fehraltorf')}</div>`;
  return { html, css };
}

function holiday(lead) {
  const portrait = asset(lead, 'holiday-b54a03', 'Ursula Böhlen im Coiffeur Holiday', 'ho-portrait');
  const room = asset(lead, 'holiday-b7484', 'Blick in den Coiffeur Holiday', 'ho-room');
  const detail = asset(lead, 'holiday-3d3b', 'Weitere Ansicht des Salons', 'ho-detail-image');
  const logo = asset(lead, 'holiday-1160', 'Coiffeur Holiday, Ursula Böhlen', 'ho-logo');
  const html = `<div class="sd-site sd-holiday" id="start">
  ${header(lead, 'COIFFEUR HOLIDAY', [['Salon','salon'],['Ursula Böhlen','ursula'],['Kontakt','kontakt']], 'Termin anfragen')}
  <main>
    <section class="ho-hero"><div class="ho-hero-image">${portrait}</div><div class="ho-hero-title"><div class="ho-logo-wrap">${logo}</div><h1>Herzlich<br>willkommen.</h1><p>Coiffeur Holiday in Wangen an der Aare.</p>${action('Termin anfragen')}</div></section>
    <section class="ho-place" id="salon"><div class="ho-place-copy"><h2>Ein Blick<br>in den Salon.</h2><p>Vorstadt 4 in Wangen an der Aare.</p></div><figure>${room}<figcaption>Coiffeur Holiday, Wangen an der Aare</figcaption></figure></section>
    <section class="ho-person" id="ursula"><div><h2>Ursula<br>Böhlen.</h2><p>Die Inhaberin von Coiffeur Holiday.</p></div><div class="ho-detail">${detail}</div></section>
    <section class="ho-contact" id="kontakt"><div><h2>Wir sehen<br>uns bald.</h2><address>Vorstadt 4<br>3380 Wangen an der Aare</address></div><div><p class="ho-note">Ferienhinweis der Website: 24. September bis 12. Oktober 2026. Die veröffentlichten regulären Öffnungszeiten weichen je nach Unterseite ab; bitte direkt beim Salon nachfragen.</p><strong>${e(lead.phone)}</strong>${action('Termin anfragen')}</div></section>
  </main>${footer(lead, 'Vorstadt 4, 3380 Wangen an der Aare')}</div>`;
  return { html, css };
}

export function render(lead) {
  const views = { sopra, wacker, 'coiffeur-lanz': lanz, 'hairstudio-f': hairstudio, holiday };
  const view = views[lead.slug];
  if (!view) throw new Error(`Unsupported salon-dining lead: ${lead.slug}`);
  return view(lead);
}
