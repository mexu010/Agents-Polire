/* global getComputedStyle -- Browser callbacks */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from './server.mjs';
import { initialContent } from './content.mjs';
import { renderPage } from './render.mjs';
import { renderAdmin } from './admin.mjs';
import { hashPassword } from './security.mjs';

const dataDir = await mkdtemp(join(tmpdir(), 'lanz-design-b-check-'));
const evidence = resolve('work/lanz-direction-b/after');
await mkdir(evidence, { recursive: true });
const config = { dataDir, passwordHash: await hashPassword('Isolierter Browsercheck 2026'), sessionSecret: 'isolated-lanz-design-check-'.repeat(3), stage: 'review', origin: 'http://127.0.0.1', host: '127.0.0.1', port: 0, minFormAge: 0, scheduledTasks: false };
const seed = structuredClone(initialContent);
const app = await createApp({ config, seed, renderPage, renderAdmin });
let browser;
const errors = [], checks = [];
const routes = [['/', 'home'], ['/salon/', 'salon'], ['/besuch/', 'visit'], ['/kontakt/', 'contact'], ['/journal/', 'journal-empty'], ['/impressum/', 'imprint'], ['/datenschutz/', 'privacy'], ['/nicht-vorhanden/', '404']];
function contrast(a, b) {
  const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
async function checkContrast(page) {
  const colors = await page.evaluate(() => {
    const action = getComputedStyle(document.querySelector('.hero-actions .button'));
    return [action.color, action.backgroundColor, getComputedStyle(document.querySelector('.hero .lead')).color, getComputedStyle(document.body).backgroundColor];
  });
  assert.ok(contrast(colors[0], colors[1]) >= 4.5, 'primary action contrast');
  assert.ok(contrast(colors[2], colors[3]) >= 4.5, 'body copy contrast');
}
async function capture(page, name, fullPage = true) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(evidence, `${name}.png`), fullPage });
}
async function dimensions(page, label) {
  const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, broken: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src), h1: document.querySelectorAll('h1').length, noindex: document.querySelector('[name="robots"]')?.content }));
  assert.equal(result.overflow, false, `${label}: overflow`);
  assert.deepEqual(result.broken, [], `${label}: broken images`);
  assert.equal(result.h1, 1, label);
  assert.match(result.noindex, /noindex/);
  return result;
}
try {
  await app.listen();
  config.origin = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce', colorScheme: 'light' });
    await context.route('**/*', route => route.request().url().startsWith(config.origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const [path, name] of routes) {
      const tracking = [];
      const observe = request => { if (request.url().endsWith('/api/view')) tracking.push(request); };
      page.on('request', observe);
      const response = await page.goto(config.origin + path, { waitUntil: 'networkidle' });
      page.off('request', observe);
      if (name === '404') assert.equal(tracking.length, 0, '404 must not submit an invalid pageview');
      assert.equal(response.status(), name === '404' ? 404 : 200);
      await page.evaluate(() => document.fonts.ready);
      checks.push({ width, path, ...await dimensions(page, `${width}/${name}`) });
      if (name === 'home') {
        await checkContrast(page);
        const action = await page.locator('.hero-actions .button').boundingBox();
        assert.ok(action.y + action.height <= (width === 1440 ? 1000 : 844), `${width}: primary action below first screen`);
        assert.ok(action.height >= 44);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.skip-link').evaluate(el => el === document.activeElement), true);
        assert.notEqual(await page.locator('.skip-link').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#main').evaluate(el => el === document.activeElement), true);
        if (width < 761) {
          await page.getByRole('button', { name: 'Menü' }).click();
          if (width === 390) await capture(page, 'menu-390-open', false);
          await page.locator('#main-nav a').first().focus();
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.menu-toggle').evaluate(el => el === document.activeElement), true);
          assert.equal(await page.locator('#main-nav').isVisible(), false);
        }
        await page.goto(config.origin + path, { waitUntil: 'networkidle' });
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
        if (width === 390 || width === 1440) await capture(page, `home-${width}-entry`, false);
      }
      if (width === 390 || width === 1440 || name === 'home' || name === 'contact') await capture(page, `${name}-${width}`);
    }
    if (width === 390) {
      await page.goto(config.origin + '/kontakt/', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Nachricht senden' }).click();
      assert.equal(await page.locator('#contact-name').getAttribute('aria-invalid'), 'true');
      await page.locator('.form-panel').scrollIntoViewIfNeeded();
      await capture(page, 'contact-390-errors', false);
      await page.locator('#contact-name').fill('Isolierte Testperson');
      await page.locator('#contact-email').fill('test@example.test');
      await page.locator('#contact-message').fill('Ausschliesslich ein lokaler Formularcheck mit Testdaten.');
      await page.locator('#contact-consent').check();
      await page.route('**/api/contact', route => route.abort('failed'));
      await page.getByRole('button', { name: 'Nachricht senden' }).click();
      await page.locator('#contact-status').getByText(/Verbindung ist unterbrochen/).waitFor();
      await page.locator('.form-bottom').scrollIntoViewIfNeeded();
      await capture(page, 'contact-390-network-error', false);
      await page.unroute('**/api/contact');
      await page.getByRole('button', { name: 'Nachricht senden' }).click();
      await page.locator('#contact-status').getByText(/keine E-Mail versendet/).waitFor();
      assert.equal(app.store.inquiries().length, 1);
      assert.equal(app.store.inquiries()[0].delivery, 'review');
      await page.locator('.form-bottom').scrollIntoViewIfNeeded();
      await capture(page, 'contact-390-success', false);
    }
    await context.close();
  }

  // This article exists only in the temporary test database, never as a salon claim.
  const state = app.store.getContent();
  state.content.articles.push({ id: 'isolated-test', slug: 'testbeitrag', title: 'Testbeitrag zur Gestaltung', excerpt: 'Nur Testdaten für die Darstellung eines veröffentlichten Beitrags.', body: 'Dieser Text prüft ausschliesslich die Gestaltung eines Journalbeitrags. Er ist keine Nachricht des Salons.\n\nEin zweiter Absatz prüft Zeilenlänge, Abstand und die Lesbarkeit auf kleinen Bildschirmen.', status: 'published', date: '2026-09-22' });
  state.content.notice = 'Testhinweis: Diese Mitteilung prüft nur die Anzeige im lokalen Testdatenbestand.';
  app.store.saveContent(state.content, state.revision);
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 1000 : 844 }, colorScheme: 'light' });
    for (const [path, name] of [['/journal/', 'journal-filled'], ['/journal/testbeitrag/', 'article'], ['/', 'home-notice']]) {
      await page.goto(config.origin + path, { waitUntil: 'networkidle' });
      await dimensions(page, name);
      await capture(page, `${name}-${width}`);
    }
    await page.close();
  }
  const dark = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await dark.goto(config.origin, { waitUntil: 'networkidle' });
  await dimensions(dark, 'dark');
  await checkContrast(dark);
  await capture(dark, 'home-390-dark');
  await dark.close();
  const noScript = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await noScript.goto(config.origin + '/kontakt/', { waitUntil: 'networkidle' });
  assert.equal(await noScript.locator('#main-nav').isVisible(), true);
  assert.equal(await noScript.locator('#contact-form').isVisible(), false);
  assert.equal(await noScript.locator('noscript p').isVisible(), true);
  assert.match(await noScript.locator('noscript p').textContent(), /Für das Formular benötigen Sie JavaScript/);
  await capture(noScript, 'contact-390-no-script');
  await noScript.close();
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, 'checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, formStates: ['invalid', 'network-error', 'success'], keyboard: 'passed', journal: 'empty + published + article', noJavaScript: 'navigation and contact fallback passed', isolatedData: true }, null, 2));
  console.log(`Direction B: ${checks.length} page/width combinations, keyboard navigation, three form states, journal, dark and no-JS checks passed. Evidence: ${evidence}`);
} finally {
  if (browser) await browser.close();
  await app.close();
  const target = resolve(dataDir);
  if (target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('lanz-design-b-check-')) await rm(target, { recursive: true, force: true });
}
