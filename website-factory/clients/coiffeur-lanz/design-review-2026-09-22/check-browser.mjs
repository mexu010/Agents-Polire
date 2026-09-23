/* global document, getComputedStyle, innerWidth, innerHeight, scrollTo -- Playwright browser callbacks */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startPreview, evidenceRoot } from './preview.mjs';
import { renderConcept } from './views.mjs';
import { initialContent } from '../content.mjs';

await mkdir(evidenceRoot, { recursive: true });
const preview = await startPreview(0);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const checks = [];
const errors = [];
function rgb(value) { return value.match(/[\d.]+/g).slice(0,3).map(Number); }
function luminance(value) { return rgb(value).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126,.7152,.0722][i], 0); }
function contrast(a,b) { const values=[luminance(a),luminance(b)].sort((a,b)=>b-a); return (values[0]+.05)/(values[1]+.05); }
try {
  const mutable = structuredClone(initialContent);
  mutable.business.name='Testsalon <Lanz>';
  mutable.business.person='Geprüfte Testperson';
  mutable.business.city='Testort';
  mutable.business.phone='012 345 67 89';
  mutable.hours[1].hours='14:00–17:00';
  for (const id of ['a','b','c']) {
    const html=renderConcept(id,mutable);
    for (const value of ['Testsalon &lt;Lanz&gt;','Geprüfte Testperson','Testort','012 345 67 89','14:00–17:00']) assert.ok(html.includes(value),`${id}: dynamic ${value}`);
    assert.ok(!html.includes('<Lanz>'));
  }
  for (const width of [320,390,768,1440]) {
    const context = await browser.newContext({ viewport:{width,height:width===1440?1000:844}, colorScheme:'light', reducedMotion:'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(preview.url) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    for (const id of ['a','b','c']) {
      const response = await page.goto(`${preview.url}${id}/`, {waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(response.status(),200);
      const result=await page.evaluate(()=>{
        const button=document.querySelector('.action');
        const bounds=button.getBoundingClientRect();
        const style=getComputedStyle(button);
        return { width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth, h1:document.querySelectorAll('h1').length, broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src), primaryAboveFold:bounds.bottom<=innerHeight, primaryRect:{height:bounds.height,width:bounds.width}, buttonColor:style.color, buttonBackground:style.backgroundColor, forms:document.forms.length, unsafeContacts:document.querySelectorAll('[href^="tel:"],[href^="mailto:"]').length, robots:document.querySelector('[name=robots]')?.content, fontReady:document.fonts.check('500 17px Satoshi') };
      });
      assert.equal(result.overflow,false,`${id}/${width} overflow`);
      assert.equal(result.h1,1);
      assert.deepEqual(result.broken,[]);
      assert.equal(result.primaryAboveFold,true,`${id}/${width}: action outside first screen`);
      assert.equal(result.fontReady,true);
      assert.equal(result.forms,0);
      assert.equal(result.unsafeContacts,0);
      assert.match(result.robots,/noindex/);
      result.buttonContrast=contrast(result.buttonColor,result.buttonBackground);
      assert.ok(result.buttonContrast>=4.5,`${id}: CTA contrast ${result.buttonContrast}`);
      assert.ok(result.primaryRect.height>=44);
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>{const style=getComputedStyle(document.activeElement);return{width:style.outlineWidth,style:style.outlineStyle};});
      assert.notEqual(focus.style,'none');
      await page.locator('.action').click();
      assert.equal(new URL(page.url()).hash,'#kontakt');
      await page.evaluate(()=>scrollTo(0,0));
      await page.mouse.move(0,0);
      const screenshot=join(evidenceRoot,`${id}-${width}.png`);
      await page.screenshot({path:screenshot,fullPage:true});
      checks.push({id,...result,screenshot});
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  for(const width of [390,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(preview.url,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.gallery-grid article').count(),3);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);
    await page.screenshot({path:join(evidenceRoot,`comparison-${width}.png`),fullPage:true});
  }
  await context.close();
  assert.deepEqual(errors,[]);
  assert.equal((await fetch(preview.url+'a/',{method:'POST'})).status,405);
  assert.equal((await fetch(preview.url+'assets/../.env')).status,404);
  assert.equal((await fetch(preview.url+'review/views.mjs')).status,404);
  assert.equal((await fetch(preview.url+'missing/')).status,404);
  await writeFile(join(evidenceRoot,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,errors,contentBinding:'passed',readOnlyServer:'passed'},null,2));
  console.log(JSON.stringify({views:checks.length,widths:[320,390,768,1440],galleryWidths:[390,1440],errors,evidenceRoot,contentBinding:'passed',readOnlyServer:'passed'},null,2));
} finally { await browser.close(); await preview.close(); }
