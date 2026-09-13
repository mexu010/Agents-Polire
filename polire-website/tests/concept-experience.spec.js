import {test, expect} from '@playwright/test';

for (const kind of ['raum','glanz','tavola']) {
  for (const width of [375,1440]) {
    test(`${kind} interactive chapter at ${width}px`, async ({page}) => {
      await page.setViewportSize({width,height:900});
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(`/konzepte/${kind}`);
      await expect(page.locator('h1')).toBeVisible();
      await page.screenshot({path:`test-results/${kind}-${width}-hero.png`});
      const tabs=page.getByRole('tab');
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
      await expect(page.getByRole('tabpanel')).toContainText(kind==='raum'?'Ruhe in ihrer reinsten Form.':kind==='glanz'?'Reflexion ohne Ablenkung.':'Noch einen Teller teilen.');
      await tabs.nth(1).press('ArrowRight');
      await expect(tabs.nth(2)).toBeFocused();
      await expect(tabs.nth(2)).toHaveAttribute('aria-selected','true');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(kind==='raum') {
        await page.getByRole('button',{name:'Interior',exact:true}).click();
        await expect(page.locator('.concept-cards article')).toHaveCount(1);
        await expect(page.locator('.concept-cards article')).toBeVisible();
      }
      expect(errors).toEqual([]);
      for(const section of ['.concept-story','.concept-request']) {
        await page.locator(section).scrollIntoViewIfNeeded();
        await expect(page.locator(section)).toHaveCSS('opacity','1');
      }
      await page.screenshot({path:`test-results/${kind}-${width}.png`,fullPage:true});
    });
  }
}
test('reduced motion keeps content visible without animated ribbons', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/konzepte/raum');
  expect(await page.locator('.concept-ribbon>div').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.experience').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
});
