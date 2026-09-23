import test from 'node:test';
import assert from 'node:assert/strict';
import { initialContent } from '../content.mjs';
import { renderPage } from '../render.mjs';

const options = { origin: 'http://localhost:3000', stage: 'review', nonce: 'nonce123', formToken: 'signed-test-token', formStartedAt: 12345 };
const page = (path, content = initialContent, opts = options) => renderPage(path, content, opts);

test('public page routes have one main landmark, navigation and distinct metadata', () => {
  for (const path of ['/', '/salon/', '/besuch/', '/kontakt/', '/journal/', '/impressum/', '/datenschutz/']) {
    const result = page(path);
    assert.equal(result.status, 200, path);
    assert.match(result.html, /<main\b/);
    assert.match(result.html, /<nav\b[^>]*aria-label="Hauptnavigation"/);
    assert.match(result.html, /<title>[^<]+<\/title>/);
    assert.match(result.html, /<link rel="canonical" href="http:\/\/localhost:3000/);
    assert.match(result.html, /<meta name="robots" content="noindex, nofollow"/);
  }
});

test('contact route embeds signed form settings and shows honest review notice', () => {
  const { html } = page('/kontakt/');
  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /name="formToken" value="signed-test-token"/);
  assert.match(html, /name="formStartedAt" value="12345"/);
  assert.match(html, /Im Testbetrieb wird keine E-Mail versendet/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /name="consent"/);
  assert.match(html, /id="contact-name"[^>]*aria-describedby="error-name"/);
  assert.match(html, /id="error-message"/);
});

test('owner supplied hosting and privacy additions are escaped while retention stays accurate', () => {
  const content = structuredClone(initialContent);
  content.legal.hostingProvider = '<Host>';
  content.legal.hostingCountry = 'Schweiz';
  content.legal.privacyContact = 'privacy@example.ch';
  content.legal.additionalPrivacy = 'Weitere Angabe <script>';
  const { html } = page('/datenschutz/', content);
  assert.match(html, /&lt;Host&gt;/);
  assert.match(html, /Weitere Angabe &lt;script&gt;/);
  assert.match(html, /90 Tagen/);
  assert.match(html, /7 Tagen/);
  assert.doesNotMatch(html, /<Host>/);
});

test('unpublished articles remain absent and published articles render plain text safely', () => {
  assert.doesNotMatch(page('/journal/').html, /journal-entry-link/);
  assert.equal(page('/journal/ausblick/').status, 404);
  const content = structuredClone(initialContent);
  content.articles.push({ id: 'x', slug: 'ausblick', title: '<b>Ausblick</b>', excerpt: 'Neue <Sache>', body: 'Absatz <script>alert(1)</script>\n\nZweiter Absatz', status: 'published', date: '2026-09-22' });
  assert.match(page('/journal/', content).html, /journal-entry-link/);
  const article = page('/journal/ausblick/', content);
  assert.equal(article.status, 200);
  assert.match(article.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(article.html, /<script>alert/);
  assert.match(article.html, /Zweiter Absatz/);
});

test('editable content and JSON-LD cannot escape HTML or script context', () => {
  const content = structuredClone(initialContent);
  content.home.headline = 'Titel <img src=x onerror=alert(1)>';
  content.business.name = '</script><script>alert(1)</script>';
  const { html } = page('/', content);
  assert.match(html, /Titel &lt;img/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003C\/script\\u003E/);
});

test('production metadata indexes pages and unknown routes return a real 404', () => {
  const prod = page('/', initialContent, { ...options, stage: 'production' });
  assert.doesNotMatch(prod.html, /noindex, nofollow/);
  assert.match(prod.html, /salon-stilllife-small\.webp 560w/);
  assert.match(prod.html, /property="og:image" content="http:\/\/localhost:3000\/assets\/salon-stilllife.webp"/);
  assert.match(prod.html, /"openingHoursSpecification"/);
  assert.match(prod.html, /"dayOfWeek":"Tuesday"/);
  assert.doesNotMatch(prod.html, /"dayOfWeek":"Sunday"/);
  const missing = page('/fehlend/');
  assert.equal(missing.status, 404);
  assert.match(missing.html, /Seite nicht gefunden/);
  assert.match(missing.html, /data-page-status="404"/);
});

test('published article has BlogPosting metadata with its date', () => {
  const content = structuredClone(initialContent);
  content.articles.push({ id: 'x', slug: 'ausblick', title: 'Ausblick', excerpt: 'Ein Artikel', body: 'Ein vollständiger veröffentlichter Artikel.', status: 'published', date: '2026-09-22' });
  const { html } = page('/journal/ausblick/', content);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"datePublished":"2026-09-22"/);
});

test('editorial pages keep the saved identity and copy instead of embedding original business facts', () => {
  const content = structuredClone(initialContent);
  Object.assign(content.business, { name: 'Salon Test', person: 'Testperson', city: 'Testort', street: 'Testweg 9', postalCode: '9999' });
  content.home = { eyebrow: 'Eigener Einstieg', headline: 'Mein <Titel>\nZweite Zeile', intro: 'Eigene Startbeschreibung.' };
  content.salon = { headline: 'Eigener Salontitel', intro: 'Eigene Salonbeschreibung.' };
  content.visit.intro = 'Eigene Besuchsbeschreibung.';
  content.contact.intro = 'Eigene Kontaktbeschreibung.';
  for (const path of ['/', '/salon/', '/besuch/', '/kontakt/', '/journal/']) {
    const html = page(path, content).html;
    const visible = html.slice(html.indexOf('<body'));
    assert.doesNotMatch(visible, /Vreni Lanz|Coiffeur Lanz|Bleienbach|Eichi 20/, path);
    assert.match(visible, /Testort/);
  }
  const html = page('/', content).html;
  assert.match(html, /Mein &lt;Titel&gt;<br>Zweite Zeile/);
  assert.match(html, /Eigener Einstieg/);
  assert.match(html, /Eigene Startbeschreibung/);
  assert.match(page('/salon/', content).html, /Eigener Salontitel/);
  assert.match(page('/salon/', content).html, /Eigene Salonbeschreibung/);
});

test('editorial image uses the approved local asset or a complete text-only layout', () => {
  const content = structuredClone(initialContent);
  content.heroImage = '/assets/uploads/approved.png';
  content.heroAlt = 'Freigegebene Aufnahme <Salon>';
  const uploaded = page('/', content).html;
  assert.match(uploaded, /src="\/assets\/uploads\/approved.png"/);
  assert.match(uploaded, /alt="Freigegebene Aufnahme &lt;Salon&gt;"/);
  assert.doesNotMatch(uploaded, /<figcaption>Symbolbild/);
  for (const image of ['', 'https://unapproved.example/image.jpg', '/assets/../private.png']) {
    content.heroImage = image;
    const html = page('/', content).html;
    assert.match(html, /class="hero-spread is-text-only"/);
    assert.doesNotMatch(html, /<figure/);
    assert.match(html, /Termin anfragen/);
  }
});
