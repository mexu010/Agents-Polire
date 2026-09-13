import { test, expect } from '@playwright/test';
test('comparison is operable by keyboard and survives language changes', async ({page}) => {
 await page.goto('/'); const slider=page.locator('.comparison input');
 await slider.focus(); await page.keyboard.press('End'); await expect(slider).toHaveValue('100');
 await page.locator('.nav-actions .lang').click(); await expect(slider).toHaveValue('100');
 await page.keyboard.press('Tab'); await slider.focus(); await page.keyboard.press('Home'); await expect(slider).toHaveValue('0');
});
test('intro runs once per session and reduced motion skips it', async ({page}) => {
 await page.goto('/'); await expect(page.locator('.intro-skip')).toBeVisible(); await page.locator('.intro-skip').click();
 await expect(page.locator('.intro-skip')).toHaveCount(0); await page.reload(); await expect(page.locator('.intro-skip')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'}); await page.evaluate(()=>sessionStorage.clear()); await page.reload(); await expect(page.locator('.intro-skip')).toHaveCount(0);
});
test('mobile menu fills screen and keeps keyboard focus within navigation', async ({page}) => {
 await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.locator('.menu-toggle').click();
 const menu=page.locator('#mobile-navigation'); expect(await menu.evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThan(700);
 for(let i=0;i<10;i++){await page.keyboard.press('Tab'); expect(await page.evaluate(()=>!!document.activeElement.closest('header'))).toBeTruthy();}
 await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(page.locator('.menu-toggle')).toBeFocused();
});
test('desktop service click retains selection and landscape menu scrolls', async ({page})=>{
 await page.goto('/');await page.setViewportSize({width:1440,height:900}); const service=page.locator('[aria-controls="service-03"]'); await service.hover();await service.click();await expect(service).toHaveAttribute('aria-expanded','true');
 await page.setViewportSize({width:844,height:390});await page.locator('.menu-toggle').click();await page.locator('.mobile-cta').scrollIntoViewIfNeeded();await expect(page.locator('.mobile-cta')).toBeInViewport();
});
