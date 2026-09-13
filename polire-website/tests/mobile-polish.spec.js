import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test('slow mobile connection: navigation and delayed submission remain usable',async({page,context})=>{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:350,downloadThroughput:180000,uploadThroughput:80000});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('.menu-toggle').click();await page.locator('#mobile-navigation a[href="#faq"]').click();await expect(page.locator('#mobile-navigation')).toBeHidden();await expect(page.locator('#faq')).toBeInViewport();
 await page.locator('.contact button[aria-haspopup=dialog]').click();await page.getByRole('radio',{name:'Meine Website überarbeiten',exact:true}).check();await page.getByRole('textbox',{name:'Ihr Name',exact:true}).fill('Mobiler Test');await page.getByRole('textbox',{name:'E-Mail',exact:true}).fill('test@example.com');await page.getByRole('textbox',{name:'Was wünschen Sie sich?',exact:true}).fill('Eine mobile Website.');
 let calls=0;await page.route('**/api/enquiry',async route=>{calls++;await new Promise(r=>setTimeout(r,2200));await route.fulfill({json:{ok:true}});});
 await page.getByRole('button',{name:'Anfrage senden',exact:true}).click();await expect(page.getByRole('button',{name:'Wird gesendet …'})).toBeDisabled();await expect(page.getByRole('heading',{name:'Vielen Dank für Ihre Anfrage.'})).toBeVisible();expect(calls).toBe(1);
});
for(const width of [320,375,390,768])test(`mobile layout ${width}`,async({page})=>{await page.setViewportSize({width,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.contact button[aria-haspopup=dialog]').click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);});
