import { test, expect } from '@playwright/test';

test('pages keep working under the security policy and private files stay unavailable', async ({ page, request }) => {
  await page.addInitScript(() => {
    window.cspErrors = [];
    document.addEventListener('securitypolicyviolation', event => window.cspErrors.push(event.violatedDirective));
  });
  for (const path of ['/', '/konzepte/raum', '/konzepte/glanz', '/konzepte/tavola']) {
    const response = await page.goto(path);
    expect(response.headers()['x-frame-options']).toBe('DENY');
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.cspErrors)).toEqual([]);
  }
  for (const path of ['/.env', '/.env.local', '/.git/config', '/package.json', '/admin']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
