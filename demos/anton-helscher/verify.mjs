import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
assert.ok(fs.existsSync(path.join(here,'index.html')), 'Demo homepage must exist');
const require=createRequire(path.resolve(process.env.FACTORY_DIR || '../../website-factory','package.json'));
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[];
try {
 for(const width of [375,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4318');
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow at ${width}`);
  await page.getByRole('button',{name:'Projekt besprechen',exact:true}).first().click();
  await page.getByLabel('Ihr Name').fill('Demo Test');
  await page.getByLabel('E-Mail').fill('demo@example.test');
  await page.getByRole('button',{name:'Anfrage testen'}).click();
  await page.getByText('Demo erfolgreich getestet. Es wurde nichts versendet.').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#contact-dialog').evaluate(el=>el.open),false);
  if(width===375){await page.getByRole('button',{name:'Menü öffnen'}).click();await page.getByRole('navigation').getByRole('link',{name:'Leistungen',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Menü öffnen'}).getAttribute('aria-expanded'),'false');}
  await page.screenshot({path:path.join(here,`preview-${width}.png`),fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: 3 viewports, overflow, dialog, local-only form, mobile menu, no JS errors');
}finally{await browser.close();}
