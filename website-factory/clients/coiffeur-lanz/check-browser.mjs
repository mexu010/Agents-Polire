// Full public-site browser smoke check against the real server and an isolated SQLite database.
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from './server.mjs';
import { hashPassword } from './security.mjs';
import { initialContent } from './content.mjs';
import { renderPage } from './render.mjs';
import { renderAdmin } from './admin.mjs';
import { Store } from './store.mjs';

const routes = ['/', '/salon/', '/besuch/', '/kontakt/', '/journal/', '/impressum/', '/datenschutz/'];
const dataDir = await mkdtemp(join(tmpdir(), 'lanz-browser-'));
const snapshotDir = process.argv.includes('--screenshots') ? resolve('work/lanz-business') : '';
const config = {
  dataDir, passwordHash: await hashPassword('Browserprüfung-123456'), sessionSecret: 'browser-check-secret-'.repeat(4),
  stage: 'review', origin: 'http://127.0.0.1', host: '127.0.0.1', port: 0,
  minFormAge: 0, scheduledTasks: false,
};
const app = await createApp({ config, seed: initialContent, renderPage, renderAdmin });
let browser;
try {
  await app.listen();
  config.origin = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  if (snapshotDir) await mkdir(snapshotDir, { recursive: true });
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'light' });
    const failures = [];
    page.on('pageerror', error => failures.push(`script: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });
    page.on('response', response => { if (response.url().includes('/assets/') && response.status() >= 400) failures.push(`asset ${response.status()}: ${response.url()}`); });
    for (const route of routes) {
      const response = await page.goto(config.origin + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${route} at ${width}`);
      assert.equal(await page.locator('main').count(), 1, `main ${route} at ${width}`);
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(dimensions.scroll <= dimensions.viewport, `overflow ${route} at ${width}: ${JSON.stringify(dimensions)}`);
      const broken = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src));
      assert.deepEqual(broken, [], `broken images ${route} at ${width}`);
      if (snapshotDir && ['/', '/kontakt/'].includes(route)) await page.screenshot({ path: join(snapshotDir, `${width}-${route === '/' ? 'home' : 'contact'}.png`), fullPage: true });
    }
    if (width === 375) {
      await page.goto(config.origin + '/', { waitUntil: 'networkidle' });
      const toggle = page.getByRole('button', { name: 'Menü' });
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#main-nav').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#main-nav').isVisible(), false);
    }
    assert.deepEqual(failures, [], `browser errors at ${width}`);
    await page.close();
    console.log(`${width}px: ${routes.length} pages, assets, layout, scripts${width === 375 ? ', menu' : ''} OK`);
  }
  const page = await browser.newPage();
  await page.goto(config.origin + '/kontakt/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  assert.match(await page.locator('#contact-status').innerText(), /Bitte prüfen/);
  assert.match(await page.locator('#error-name').innerText(), /zwei Zeichen/);
  for (const [index, message] of ['Erste konkrete Terminanfrage für die Browserprüfung.', 'Zweite eigenständige Anfrage für die Browserprüfung.'].entries()) {
    await page.locator('#contact-name').fill(index ? 'Zweite Testperson' : 'Erste Testperson');
    await page.locator('#contact-email').fill(index ? 'zweite@example.test' : 'erste@example.test');
    await page.locator('#contact-message').fill(message);
    await page.locator('#contact-consent').check();
    await page.getByRole('button', { name: 'Nachricht senden' }).click();
    await page.waitForFunction(() => document.querySelector('#contact-status')?.dataset.state === 'success');
    assert.match(await page.locator('#contact-status').innerText(), /keine E-Mail versendet/);
  }
  assert.equal(app.store.inquiries().length, 2, 'two distinct inquiries saved');
  const reopened = new Store(dataDir, initialContent);
  try { assert.equal(reopened.inquiries().length, 2, 'inquiries survive opening the saved database'); }
  finally { reopened.close(); }
  await page.close();
  console.log('Contact: validation, two submissions and durable inbox OK');
} finally {
  if (browser) await browser.close();
  await app.close();
  if (dataDir.startsWith(resolve(tmpdir()) + '\\') && dataDir.split('\\').at(-1).startsWith('lanz-browser-')) await rm(dataDir, { recursive: true, force: true });
}
