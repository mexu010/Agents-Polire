/* global document, axe */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.resolve('lighthouse'));
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const axeVersion = JSON.parse(readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version;
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const base = process.env.POLIRE_DEMO_BASE ?? 'http://127.0.0.1:4320';
const targets = [...manifest.leads.map(lead => ({slug: lead.slug, route: `/sites/${lead.slug}/`})), {slug: 'gallery', route: '/'}];
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const results = [];
let cursor = 0;
try {
  await Promise.all(Array.from({length: 3}, async () => {
    // CSP bypass only injects the local audit library into this test browser.
    const page = await browser.newPage({bypassCSP: true});
    while (cursor < targets.length) {
      const target = targets[cursor++];
      for (const width of [375, 1440]) {
        await page.setViewportSize({width, height: 960});
        for (const colorScheme of ['light', 'dark']) {
          await page.emulateMedia({colorScheme, reducedMotion: 'reduce'});
          await page.goto(base + target.route, {waitUntil: 'networkidle'});
          await page.evaluate(async () => { await document.fonts.ready; });
          await page.addScriptTag({content: axeSource});
          const violations = await page.evaluate(async () => {
            const audit = await axe.run(document, {runOnly: {type: 'rule', values: ['color-contrast', 'link-name', 'button-name', 'html-has-lang', 'image-alt', 'landmark-one-main', 'page-has-heading-one']}});
            return audit.violations.map(violation => ({id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({target: node.target, summary: node.failureSummary}))}));
          });
          results.push({slug: target.slug, width, colorScheme, violations});
          process.stdout.write(JSON.stringify({slug: target.slug, width, colorScheme, violations: violations.length}) + '\n');
        }
      }
    }
    await page.close();
  }));
} finally {
  await browser.close();
}
writeFileSync(path.join(root, 'accessibility-checks.json'), JSON.stringify({checkedAt: new Date().toISOString(), method: `axe-core ${axeVersion}, seven selected rules, mobile/desktop light and dark; not a complete accessibility certification`, results}, null, 2) + '\n');
if (results.length !== targets.length * 4 || results.some(result => result.violations.length > 0)) process.exitCode = 1;
