// Browser contract test: GAS is simulated here; this does NOT prove a Google deployment works.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext();const page=await context.newPage();const requests=[];let attempts=0;const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/assets/order-config.js*',r=>r.fulfill({contentType:'application/javascript',body:"window.JIANFU_ORDER_CONFIG={provider:'gas',gasUrl:'https://script.google.com/macros/s/TEST/exec'};"}));
 await page.route('https://script.google.com/macros/s/TEST/exec',async route=>{
  const body=route.request().postDataJSON();requests.push(body);attempts++;
  if(attempts===1) return route.abort('failed');
  return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body.action==='track'?{ok:true,orderNo:'JF261127-001',total:85,subtotal:85,fee:0,status:'新訂單',items:[{name:'招牌',qty:1,price:85}]}:{ok:true,orderNo:'JF261127-001',total:85,eta:'約 15–20 分鐘'})});
 });
 await page.goto(process.env.TEST_URL || 'http://localhost:3000',{waitUntil:'domcontentloaded'});
 await page.locator('[data-add="s1"]').click();await page.locator('#cartBtn').click();await page.locator('#checkoutBtn').click();
 await page.locator('#checkoutForm label').filter({has:page.locator('input[name="mode"][value="take"]')}).click();await page.locator('#checkoutForm [name="name"]').fill('課程測試');await page.locator('#checkoutForm [name="phone"]').fill('0900000000');
 await page.locator('#checkoutForm button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#formError').classList.contains('hidden'));
 assert.equal(await page.locator('#cartBadge').textContent(),'1');assert.equal(await page.locator('#checkoutForm [name="name"]').inputValue(),'課程測試');
 await page.locator('#checkoutForm button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#successView').classList.contains('hidden'));
 assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(await page.locator('#okNo').textContent(),'JF261127-001');assert.equal(await page.locator('#cartBadge').textContent(),'0');
 await page.locator('#okTrackBtn').click();await page.waitForFunction(()=>!document.querySelector('#trackResult').classList.contains('hidden'));
 assert.equal(requests[2].action,'track');assert.equal(await page.locator('#trNo').textContent(),'JF261127-001');assert.deepEqual(errors,[]);
 console.log('PASS: simulated GAS checkout, failed-response retry retains request ID/cart/form, confirmed success clears cart, track readback');
 await context.close();
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
