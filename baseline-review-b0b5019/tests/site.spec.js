import { test, expect } from '@playwright/test';
const ids = ['home', 'work', 'services', 'process'];
async function navigate(page, id, width) {
  if (width <= 860) {
    await page.locator('.menu-toggle').click();
    await page.locator(`#mobile-navigation a[href="#${id}"]`).click();
  } else await page.locator(`.nav-links a[href="#${id}"]`).click();
  await expect(page.locator(`.nav-links a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location');
  await expect.poll(() => page.locator(`#${id}`).evaluate(n => Math.round(n.getBoundingClientRect().top))).toBe(id === 'home' ? 0 : width <= 860 ? 90 : 112);
}
for (const [width,height] of [[1440,900],[1280,800],[1024,768],[768,1024],[390,844],[375,812]]) {
  test(`${width}px: navigation, language cycles, section visibility, layout`,async({page})=>{
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.setViewportSize({width,height}); await page.goto('/');
    await expect(page.locator('h1')).toContainText('Mit Haltung.');
    await expect(page.locator('main > section')).toHaveCount(5);
    await expect.poll(()=>page.locator('main > section').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual([...ids,'contact']);
    for (const id of ['work','services','process','home','work']) await navigate(page,id,width);
    for (const language of ['en','de','en','de']) {
      const oldTop=await page.locator('#work').evaluate(n=>n.getBoundingClientRect().top);
      await page.locator('.nav-actions .lang').click();
      await expect(page.locator('html')).toHaveAttribute('lang',language);
      await expect.poll(()=>page.locator('#work').evaluate(n=>n.getBoundingClientRect().top)).toBeCloseTo(oldTop,0);
      expect(await page.locator('main > section').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).opacity==='1'&&n.getBoundingClientRect().height>0))).toBeTruthy();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      expect(await page.locator('h1,h2,h3,button,.button,.nav').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').every(n=>n.scrollWidth<=n.clientWidth+2))).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}
test('browser history restores language from URL',async({page})=>{
  await page.goto('/'); await page.setViewportSize({width:1440,height:900});
  await navigate(page,'work',1440); await page.locator('.nav-actions .lang').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.goBack(); await expect(page.locator('html')).toHaveAttribute('lang','de');
  await page.goForward(); await expect(page.locator('html')).toHaveAttribute('lang','en');
});
test('keyboard disclosure, menu escape, legal links and email destination',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await page.keyboard.press('Tab'); await expect(page.locator('.skip-link')).toBeFocused();
  await page.locator('.menu-toggle').click(); await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-navigation')).toBeHidden(); await expect(page.locator('.menu-toggle')).toBeFocused();
  await navigate(page,'services',390);
  const service=page.locator('[aria-controls="service-03"]'); await service.focus(); await page.keyboard.press('Enter');
  await expect(service).toHaveAttribute('aria-expanded','true'); await expect(page.locator('#service-03')).toBeVisible();
  await page.locator('.nav-actions .lang').click(); await expect(service).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#service-03')).toContainText('Fast, responsive');
  await expect(page.locator('.contact .button')).toHaveAttribute('href',/^mailto:hello@polire.ch\?subject=/);
  for (const route of ['impressum','datenschutz']) {
    await page.locator(`footer a[href="/${route}?lang=en"]`).click();
    await expect(page.locator('h1')).toContainText(route==='impressum'?'Legal notice':'Privacy notice');
    await expect(page.locator('.legal-warning')).toBeVisible();
    await page.locator('.legal-top a').first().click(); await expect(page.locator('html')).toHaveAttribute('lang','en');
  }
});
test('reduced motion and no-JavaScript content stay readable',async({browser})=>{
  const context=await browser.newContext({reducedMotion:'reduce'}); const page=await context.newPage();
  await page.goto(process.env.POLIRE_TEST_URL||'http://127.0.0.1:3000');
  expect(await page.locator('.hero-title>span').first().evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await context.close();
  const noJs=await browser.newContext({javaScriptEnabled:false}); const staticPage=await noJs.newPage();
  await staticPage.goto(process.env.POLIRE_TEST_URL||'http://127.0.0.1:3000');
  await expect(staticPage.locator('main>section')).toHaveCount(5); await expect(staticPage.locator('h1')).toBeVisible();
  await noJs.close();
});
