import {test,expect} from '@playwright/test';
test('sculpture responds to click, scroll stage changes and reduced motion resolves',async({page})=>{
 await page.goto('/');await expect(page.locator('.sculpture-toggle')).toBeVisible({timeout:3000});
 await page.locator('.intro-skip').waitFor({state:'hidden'});
 const closed=await page.locator('.sculpture-plane').last().evaluate(n=>getComputedStyle(n).transform);
 await page.locator('.sculpture-pause').click();await expect.poll(()=>page.locator('.sculpture-stack').evaluate(n=>getComputedStyle(n).animationPlayState)).toBe('paused');
 await page.locator('.sculpture-toggle').click();await expect(page.locator('.hero-art')).toHaveAttribute('data-expanded','true');
 await page.locator('.sculpture-toggle').click();await expect(page.locator('.hero-art')).toHaveAttribute('data-expanded','false');
 await expect.poll(()=>page.locator('.sculpture-plane').last().evaluate(n=>getComputedStyle(n).transform)).toBe(closed);
 const stage=page.locator('.kinetic-story');await stage.scrollIntoViewIfNeeded();
 const before=await stage.evaluate(n=>Number(n.style.getPropertyValue('--story')));await page.mouse.wheel(0,250);
 await expect.poll(()=>stage.evaluate(n=>Number(n.style.getPropertyValue('--story')))).not.toBe(before);
 await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>stage.evaluate(n=>n.style.getPropertyValue('--story'))).toBe('1');
 await expect(page.locator('.kinetic-stage')).toBeVisible();
});
