const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL || 'http://localhost:3000');await page.waitForFunction(()=>document.querySelector('#street3d').dataset.engine==='webgl');
 await page.locator('#street3d').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 assert(await page.locator('#street').evaluate(e=>e.hidden));
 assert(await page.locator('#street3d canvas').evaluate(e=>e.width>0));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const before=await page.locator('#street3d canvas').screenshot();await page.waitForTimeout(700);const after=await page.locator('#street3d canvas').screenshot();assert(!before.equals(after),'3D animation must move');
 await page.screenshot({path:`/tmp/gyoza-${width}.png`,fullPage:false});
 await page.locator('#cartBtn').click();assert(await page.locator('#drawer').getAttribute('aria-hidden')==='false');await page.locator('#closeCart').click();
 await page.locator('[data-add]').first().click();assert.equal(await page.locator('#cartBadge').textContent(),'1');
 assert.equal(await page.locator('.booking-fab').getAttribute('target'),'_blank');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#street3d').dataset.engine==='webgl');
 assert(await page.locator('#menuGrid [data-add]').count()>0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#street3d').scrollIntoViewIfNeeded();await page.waitForTimeout(200);const still=await page.locator('#street3d canvas').screenshot();await page.waitForTimeout(300);assert(still.equals(await page.locator('#street3d canvas').screenshot()),'reduced motion should be static');
 assert.deepEqual(errors,[]);console.log(`PASS ${width}px: WebGL animation, layout, cart, booking, offline reload, reduced motion; zero JS errors`);await context.close();
}
const context=await browser.newContext();const page=await context.newPage();await page.route('**/assets/vendor/three.min.js',r=>r.abort());await page.goto(process.env.TEST_URL || 'http://localhost:3000');assert(await page.locator('#street').isVisible());assert(await page.locator('.walker.entering').count()>0);console.log('PASS: 2D fallback with Three.js unavailable');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
