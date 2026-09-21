/* global document, window, getComputedStyle */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const out = path.resolve(root, '../..', 'work', 'demo-qa-2026-09-21');
mkdirSync(out, { recursive: true }); mkdirSync(path.join(root, 'public', 'thumbnails'), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const base = process.env.POLIRE_DEMO_BASE ?? 'http://127.0.0.1:4320';
const results = []; let cursor = 0;
try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    const page = await browser.newPage();
    while (cursor < manifest.leads.length) {
      const lead = manifest.leads[cursor++];
      const errors = []; const failedRequests = [];
      const onError = error => errors.push(error.message);
      const onResponse = response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); };
      page.on('pageerror', onError); page.on('response', onResponse);
      const checks = [];
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
        await page.goto(`${base}/sites/${lead.slug}/`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => { await document.fonts.ready; [...document.images].forEach(i => { i.loading = 'eager'; }); await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
        const state = await page.evaluate(() => ({
          width: window.innerWidth, contentWidth: document.documentElement.scrollWidth,
          headings: document.querySelectorAll('h1').length,
          badImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
          badAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => a.hash && !document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a => a.hash),
          realContacts: [...document.querySelectorAll('a[href^="tel:"],a[href^="mailto:"],form')].map(e => e.outerHTML.slice(0,160)),
          noindex: document.querySelector('meta[name="robots"]')?.content?.includes('noindex'),
          overflow: [...document.querySelectorAll('body *')].filter(e => {const r=e.getBoundingClientRect();return r.width>0 && r.right>window.innerWidth+1 && getComputedStyle(e).position!=='fixed';}).slice(0,6).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right})),
        }));
        const menu = page.locator('[data-menu-toggle]').first();
        let menuWorks = true;
        if (await menu.count() && await menu.isVisible()) { await menu.click(); menuWorks = await menu.getAttribute('aria-expanded') === 'true' && await page.locator('#site-nav').isVisible(); await menu.click(); }
        const contact = page.locator('[data-demo-contact]:visible').first();
        await contact.click();
        const dialogWorks = await page.locator('.polire-dialog').isVisible();
        await page.locator('[data-close-demo]').click();
        const closed = !await page.locator('.polire-dialog').isVisible();
        const screenshot = `${lead.slug}-${width}.png`;
        if (width === 375) await page.screenshot({ path:path.join(out,screenshot), fullPage:true });
        if (width === 1440) {
          await page.screenshot({ path:path.join(root,'public','thumbnails',`${lead.slug}.png`) });
          await page.screenshot({ path:path.join(out,screenshot), fullPage:true });
        }
        checks.push({ ...state, menuWorks, dialogWorks, dialogClosed:closed });
      }
      await page.emulateMedia({ colorScheme:'dark', reducedMotion:'reduce' });
      await page.screenshot({path:path.join(out,`${lead.slug}-dark.png`),fullPage:true});
      const darkOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      const passed = checks.every(c=>c.contentWidth<=c.width+1 && c.headings===1 && !c.badImages.length && !c.badAnchors.length && !c.realContacts.length && c.noindex && c.menuWorks && c.dialogWorks && c.dialogClosed) && !darkOverflow && !errors.length && !failedRequests.length;
      const result = {slug:lead.slug,passed,checks,darkOverflow,errors,failedRequests}; results.push(result);
      process.stdout.write(JSON.stringify({slug:lead.slug,passed,problems:checks.filter(c=>c.contentWidth>c.width+1||c.badImages.length||c.badAnchors.length||!c.menuWorks)})+'\n');
      page.off('pageerror',onError); page.off('response',onResponse);
    }
    await page.close();
  }));
} finally { await browser.close(); }
writeFileSync(path.join(root,'browser-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),mode:'real_local_browser_checks',viewports:[375,768,1440],darkMode:true,reducedMotion:true,results},null,2)+'\n');
if (results.length!==15 || results.some(r=>!r.passed)) process.exitCode=1;
