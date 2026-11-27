const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader']});
  try {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const context = await browser.newContext({reducedMotion, viewport: {width: 390, height: 844}});
      const page = await context.newPage();
      await page.goto(process.env.TEST_URL || 'http://localhost:3000', {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('#street3d').dataset.engine === 'webgl');
      const canvas = page.locator('#street3d canvas');
      await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      async function moving() {
        const before = await canvas.screenshot(); await page.waitForTimeout(500);
        return !before.equals(await canvas.screenshot());
      }
      const startsMoving = await moving();
      console.log(`Initial ${reducedMotion}: moving=${startsMoving}`);
      assert.equal(startsMoving, reducedMotion !== 'reduce');
      const control = page.getByRole('button', {name: reducedMotion === 'reduce' ? '播放動畫' : '暫停動畫', exact: true});
      assert.equal(await control.count(), 1, 'Animation needs an explicit play/pause control, including when reduced motion freezes the scene');
      await control.click(); await page.waitForTimeout(150);
      assert.equal(await moving(), reducedMotion === 'reduce', 'User must be able to override pause or motion');
      if (reducedMotion === 'reduce') {
        await page.getByRole('button', {name: '暫停動畫', exact: true}).click();
        await page.waitForTimeout(150); assert.equal(await moving(), false);
      }
      await context.close();
    }
    console.log('PASS: automatic motion, reduced motion, manual play and pause');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
