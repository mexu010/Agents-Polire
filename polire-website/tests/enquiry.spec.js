import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('conditional project details, custom budget and start choices reach the request', async ({page}) => {
  let sent;
  await page.route('**/api/enquiry', async route => {sent=route.request().postDataJSON();await route.fulfill({json:{ok:true}});});
  await openForm(page); await fillRequired(page);
  await expect(page.locator('#enquiry-other')).toHaveCount(0);
  await page.getByRole('radio',{name:'Etwas anderes / noch offen',exact:true}).check();
  await page.locator('#enquiry-other').fill('Eine Buchungsplattform');
  await page.getByRole('radio',{name:'Eigenes Budget',exact:true}).check();
  await page.locator('#enquiry-custom-budget').fill('CHF 1800');
  await page.getByRole('radio',{name:'Datum selbst auswählen',exact:true}).check();
  await page.locator('#enquiry-timing').fill('2026-12-01');
  await page.getByRole('radio',{name:'So schnell wie möglich',exact:true}).check();
  await expect(page.locator('#enquiry-timing')).toHaveCount(0);
  await page.getByRole('button',{name:'Anfrage senden',exact:true}).click();
  await expect(page.locator('#enquiry-success')).toBeVisible();
  expect(sent).toMatchObject({otherDetails:'Eine Buchungsplattform',budget:'custom',budgetDetails:'CHF 1800',timingMode:'asap'});
  expect(sent.timing).toBeUndefined();
});

async function openForm(page, suffix = '') {
  await page.goto(`/${suffix}#contact`);
  await page.locator('.contact button[aria-haspopup=dialog]').click();
  return page.getByRole('dialog');
}

async function fillRequired(page) {
  await page.getByRole('textbox', { name: 'Ihr Name', exact: true }).fill('Testperson');
  await page.getByRole('textbox', { name: 'E-Mail', exact: true }).fill('test@example.com');
  await page.getByRole('radio', { name: 'Meine Website überarbeiten', exact: true }).check();
  await page.getByRole('textbox', { name: 'Was wünschen Sie sich?', exact: true }).fill('Eine klare Website mit Terminbuchung und ruhigen Farben.');
}

test('contact opens a keyboard-accessible dialog and preserves a draft on close', async ({ page }) => {
  const dialog = await openForm(page);
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await fillRequired(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.contact button[aria-haspopup=dialog]')).toBeFocused();
  await page.locator('.contact button[aria-haspopup=dialog]').click();
  await expect(page.getByRole('textbox', { name: 'Ihr Name', exact: true })).toHaveValue('Testperson');
  await page.getByRole('button', { name: 'Formular schliessen' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Anfrage senden', exact: true })).toBeFocused();
});

test('submits the existing website and multiple inspiration links, then confirms acceptance', async ({ page }) => {
  let sent;
  await page.route('**/api/enquiry', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await openForm(page);
  await fillRequired(page);
  await page.getByRole('textbox', { name: 'Bisherige Website', exact: true }).fill('https://example.com');
  await page.getByRole('textbox', { name: 'Beispiel-Website 1', exact: true }).fill('https://example.org');
  await page.getByRole('button', { name: 'Weiteres Beispiel hinzufügen' }).click();
  await page.getByRole('textbox', { name: 'Beispiel-Website 2', exact: true }).fill('https://example.net');
  await page.getByRole('textbox', { name: 'Was gefällt Ihnen an den Beispielen?', exact: true }).fill('Die Farben und die übersichtliche Navigation.');
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vielen Dank für Ihre Anfrage.' })).toBeVisible();
  expect(sent.website).toBe('https://example.com');
  expect(sent.examples).toEqual(['https://example.org', 'https://example.net']);
  expect(sent.inspiration).toContain('Farben');
  expect(sent.email).toBe('test@example.com');
  expect(sent.company).toBe('');
  expect(sent.budget).toBe('');
});

test('an unavailable sender shows an honest error and preserves all answers for retry', async ({ page }) => {
  await page.route('**/api/enquiry', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await openForm(page);
  await fillRequired(page);
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('nicht gesendet');
  await expect(page.getByRole('textbox', { name: 'Ihr Name', exact: true })).toHaveValue('Testperson');
  await expect(page.getByRole('button', { name: 'Anfrage senden', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Vielen Dank für Ihre Anfrage.' })).not.toBeVisible();
});

test('required fields prevent sending and optional website links validate their format', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/enquiry', route => { requests++; return route.fulfill({ status: 200, json: { ok: true } }); });
  await openForm(page);
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  expect(requests).toBe(0);
  await fillRequired(page);
  await page.getByRole('textbox', { name: 'Bisherige Website', exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  expect(requests).toBe(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a lost connection does not claim delivery or a definite failure', async ({ page }) => {
  await page.route('**/api/enquiry', route => route.abort('failed'));
  await openForm(page);
  await fillRequired(page);
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('nicht bestätigt');
  await expect(page.getByRole('textbox', { name: 'Ihr Name', exact: true })).toHaveValue('Testperson');
});

test('anonymous browser delivery waits for the provider before showing success', async ({ page }) => {
  await page.route('**/api/enquiry', route => route.fulfill({ status: 200, json: { browserDelivery: { url: 'https://formsubmit.co/ajax/verified-form-id', payload: { name: 'Testperson', email: 'test@example.com', Wünsche: 'Test' } } } }));
  let sent;
  await page.route('https://formsubmit.co/ajax/verified-form-id', route => { sent = route.request().postDataJSON(); return route.fulfill({ status: 200, json: { success: 'true' } }); });
  await openForm(page);
  await fillRequired(page);
  await page.getByRole('button', { name: 'Anfrage senden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vielen Dank für Ihre Anfrage.' })).toBeVisible();
  expect(sent.email).toBe('test@example.com');
});

for (const width of [375, 768, 1440]) {
  test(`form fits ${width}px and its submit button remains reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    const dialog = await openForm(page);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Anfrage senden', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Anfrage senden', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Formular schliessen' }).click();
    await expect(dialog).not.toBeVisible();
  });
}

test('English form and privacy link follow the selected language', async ({ page }) => {
  const dialog = await openForm(page, '?lang=en');
  await expect(dialog).toContainText('Tell us about your project.');
  await expect(page.getByRole('textbox', { name: 'Current website', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/datenschutz?lang=en');
});

test('server rejects invalid input and cross-origin submissions', async ({ request, baseURL }) => {
  const invalid = await request.post('/api/enquiry', { data: {}, headers: { origin: baseURL } });
  expect(invalid.status()).toBe(400);
  const foreign = await request.post('/api/enquiry', { data: {}, headers: { origin: 'https://example.net' } });
  expect(foreign.status()).toBe(403);
});
