// Repeatable editor browser check against an isolated SQLite database and the real server.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from './server.mjs';
import { initialContent } from './content.mjs';
import { renderPage } from './render.mjs';
import { renderAdmin } from './admin.mjs';
import { hashPassword, issueFormToken } from './security.mjs';

const password = 'Adminprüfung-123456';
const dataDir = await mkdtemp(join(tmpdir(), 'lanz-admin-check-'));
const config = {
  dataDir, passwordHash: await hashPassword(password), sessionSecret: 'isolated-admin-check-secret-'.repeat(3),
  stage: 'review', origin: 'http://127.0.0.1', host: '127.0.0.1', port: 0,
  minFormAge: 0, scheduledTasks: false,
};

async function launchBrowser() {
  if (process.env.CHROME_PATH) return chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch({ headless: true }); }
  catch (bundledError) {
    const installed = [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/usr/bin/google-chrome', '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].find(existsSync);
    if (!installed) throw bundledError;
    return chromium.launch({ headless: true, executablePath: installed });
  }
}

let app, browser;
try {
  app = await createApp({ config, seed: initialContent, renderPage, renderAdmin });
  await app.listen();
  config.origin = `http://127.0.0.1:${app.server.address().port}`;
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`Asset ${response.status()}: ${response.url()}`);
  });

  await page.goto(`${config.origin}/verwaltung/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#login-view').isVisible(), true, 'login required');
  await page.locator('#password').fill(password);
  await page.locator('#login-form button').click();
  await page.getByRole('heading', { name: 'Alles im Blick' }).waitFor();
  assert.equal(await page.locator('#stat-views').innerText(), '0', 'real empty analytics');

  await page.locator('.side-nav [data-tab="content"]').click();
  await page.locator('[name="home.headline"]').fill('Ein bestätigter Testtitel.');
  await page.locator('[name="legal.hostingProvider"]').fill('Test Hosting');
  await page.locator('[name="legal.hostingCountry"]').fill('Schweiz');
  await page.locator('[name="legal.privacyContact"]').fill('datenschutz@example.test');
  await page.locator('#content-form .save-content').click();
  await page.locator('#global-message').getByText('Ihre Änderungen wurden gespeichert.').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.side-nav [data-tab="content"]').click();
  assert.equal(await page.locator('[name="home.headline"]').inputValue(), 'Ein bestätigter Testtitel.');
  assert.equal(await page.locator('[name="legal.hostingProvider"]').inputValue(), 'Test Hosting');
  assert.equal(await page.locator('[name="legal.hostingCountry"]').inputValue(), 'Schweiz');
  assert.equal(await page.locator('[name="legal.privacyContact"]').inputValue(), 'datenschutz@example.test');
  assert.equal(app.store.getContent().content.business.phone, initialContent.business.phone, 'untouched fields preserved');

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lL8AAAAASUVORK5CYII=', 'base64');
  await page.locator('#hero-file').setInputFiles({ name: 'startbild.png', mimeType: 'image/png', buffer: png });
  await page.getByText(/hochgeladen. Bitte Änderungen speichern/).waitFor();
  await page.locator('#content-form .save-content').click();
  await page.locator('#global-message').getByText('Ihre Änderungen wurden gespeichert.').waitFor();
  assert.match(app.store.getContent().content.heroImage, /^\/assets\/uploads\/[\w-]+\.png$/, 'image path saved');

  await page.locator('.side-nav [data-tab="journal"]').click();
  assert.equal(await page.locator('#article-list .article-row').count(), 3, 'three unpublished prompts');
  await page.locator('#new-article').click();
  await page.locator('[name="title"]').fill('Ein bestätigter Artikel');
  await page.locator('[name="excerpt"]').fill('Eine Nachricht aus dem Salon.');
  await page.locator('[name="body"]').fill('Dieser Browsercheck veröffentlicht einen vollständigen Beispieltext.');
  await page.locator('#publish-article').click();
  await page.locator('#global-message').getByText('Der Beitrag ist veröffentlicht.').waitFor();
  const article = await fetch(`${config.origin}/journal/ein-bestatigter-artikel/`);
  assert.equal(article.status, 200, 'published article has a public route');
  assert.match(await article.text(), /Ein bestätigter Artikel/);

  const started = Date.now() - 5000;
  const inquiry = await fetch(`${config.origin}/api/contact`, {
    method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Beispiel Kundin', email: 'kunde@example.test', phone: '',
      message: 'Ich möchte einen Termin im Salon anfragen.', consent: true, website: '',
      formStartedAt: started, formToken: issueFormToken(config.sessionSecret, started),
    }),
  });
  assert.equal(inquiry.status, 201, 'inquiry accepted without email dispatch in review mode');
  assert.equal((await inquiry.json()).delivery, 'review');
  await page.locator('.side-nav [data-tab="inquiries"]').click();
  await page.locator('#refresh-inquiries').click();
  await page.getByRole('heading', { name: 'Beispiel Kundin' }).waitFor();
  await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
  await page.getByRole('button', { name: 'Wieder öffnen' }).waitFor();
  assert.equal(app.store.inquiries()[0].status, 'done');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Löschen' }).click();
  await page.locator('#inquiry-list').getByText('Noch keine Anfragen.').waitFor();
  assert.equal(app.store.inquiries().length, 0);

  await page.locator('.side-nav [data-tab="operations"]').click();
  await page.locator('#create-backup').click();
  await page.locator('#global-message').getByText(/Sicherung .* erstellt/).waitFor();
  assert.ok((await app.store.backups()).length, 'backup persisted');
  await page.locator('#logout').click();
  await page.locator('#login-view').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#login-view').isVisible(), true, 'logout returns to login');
  const unauthenticated = await page.evaluate(async () => (await fetch('/api/admin/state')).status);
  assert.equal(unauthenticated, 401, 'logout invalidates session');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#password').fill(password);
  await page.locator('#login-form button').click();
  await page.getByRole('heading', { name: 'Alles im Blick' }).waitFor();
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.locator('#mobile-nav [data-tab="journal"]').click();
  assert.equal(await page.getByRole('heading', { name: 'Journal' }).isVisible(), true);
  const width = await page.locator('html').evaluate(element => ({ content: element.scrollWidth, viewport: element.clientWidth }));
  assert.ok(width.content <= width.viewport, `mobile overflow: ${JSON.stringify(width)}`);
  assert.deepEqual(errors, [], 'no script or asset errors');
  await page.close();
  console.log('Admin: login, content and legal persistence, image upload, journal publish, inquiry status/delete, backup, logout, mobile navigation OK');
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  const target = resolve(dataDir), temporary = resolve(tmpdir()) + sep;
  if (target.startsWith(temporary) && basename(target).startsWith('lanz-admin-check-')) await rm(target, { recursive: true, force: true });
}
